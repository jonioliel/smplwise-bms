"""External go2rtc adapter (MASTER_SPEC ch. 21, ADR-011/ADR-013).

The product owns only streams whose name starts with `smplwise_`; everything else on the shared
go2rtc (intercom, other projects) is never listed as ours, modified or deleted. Source URLs carry the
NVR credentials and therefore never leave the server: they are written to go2rtc's API and nothing
else. Browser media goes through the add-on's WebSocket relay (see routers/media.py).

Known limit (to be verified on the lab's go2rtc version): go2rtc may persist a stream created through `PUT /api/streams` -
its source, credentials included - into its own configuration file on the go2rtc host, and this adapter cannot see or remove
that. Deleting the stream through the API is what `delete_stream` does; whether the file entry goes with it depends on the
go2rtc version. The credentials of every source written here (NVR, WisKey stations, Home Assistant cameras) therefore also live
on the go2rtc host, which is the owner's own machine; protect that file like the secrets it holds.
"""
from __future__ import annotations

import hashlib
import logging
import posixpath
import re
import threading
import time
from dataclasses import dataclass
from typing import Any, Callable
from urllib.parse import quote, unquote, urlsplit, urlunsplit

import httpx

from ..config import Settings
from ..errors import ApiError

log = logging.getLogger("smplwise.go2rtc")


def _verify():
    """httpx's default verification, built once and shared with the NVR client (nvr._ssl_context): a client built without it
    loads the CA bundle again (QUARANTINE-295: 1.4 s per client under load, two clients per health probe of go2rtc)."""
    from .nvr import _ssl_context

    return _ssl_context()


STREAM_PREFIX = "smplwise_"
NAME_RE = re.compile(r"^[A-Za-z0-9_.-]+$")


def stream_name(recorder_id: str, channel: int, profile: str) -> str:
    """Deterministic, readable and namespaced: smplwise_nvr-1_ch4_sub."""
    if profile not in ("main", "sub"):
        raise ValueError(profile)
    if f"{recorder_id}_".startswith("ha_"):  # `smplwise_ha_` is the namespace of the Home Assistant camera streams (ha_stream_name)
        raise ValueError("a recorder id must not start with ha_")
    name = f"{STREAM_PREFIX}{recorder_id}_ch{channel}_{profile}"
    if not NAME_RE.match(name):
        raise ValueError(name)
    return name


def rtsp_url(host: str, port: int | str, path: str, user: str, password: str, query: str = "") -> str:
    """CR-GO2RTC-ADAPTER-2436 (review 03 F20): `rtsp://<user>:<password>@<host>:<port><path>[?<query>]` - the one place an RTSP
    address with credentials is assembled. The user and the password are percent-encoded whole (`quote(..., safe='')`, so
    `@ : / #` stay inside the userinfo); `host` is used as given (callers pass a checked or bracketed host, see rtsp_host).
    Server-side only."""
    url = f"rtsp://{quote(user, safe='')}:{quote(password, safe='')}@{host}:{port}{path}"
    return f"{url}?{query}" if query else url


def hikvision_rtsp_url(settings: Settings, channel: int, profile: str) -> str:
    """rtsp://user:pass@host:554/Streaming/Channels/<ch>01 (main) or <ch>02 (sub). Server-side only."""
    from ..mode import ensure_nvr

    ensure_nvr(settings)  # NVR-less mode: 409 nvr_not_configured
    from ..mode import ensure_recorder_enabled

    ensure_recorder_enabled(settings)  # CR-024: a disabled recorder's stream is never (re)created
    from .nvr import ensure_isapi_vendor

    ensure_isapi_vendor(settings, "rtsp")  # finding 3: Hikvision stream paths only for a Hikvision recorder
    if not settings.nvr_host or not settings.nvr_user or not settings.nvr_password:
        raise ApiError(503, "source_not_configured", "פרטי ה־NVR לא הוגדרו בהגדרות ה־Add-on.")
    track = f"{channel}0{1 if profile == 'main' else 2}"
    return rtsp_url(settings.nvr_host, settings.nvr_rtsp_port, f"/Streaming/Channels/{track}", settings.nvr_user, settings.nvr_password)


# WisKey's own station source (WISKEY_SOURCE_EXTRACTION.md 0.4 / ConnectionSettings): rtsp_source() =
# rtsp://<user>:<pass>@<host>:<rtsp_port>/Streaming/Channels/101. WisKey's overview exposes the host but not the RTSP
# port, so WisKey's own default port is used.
WISKEY_RTSP_PORT = 554
WISKEY_RTSP_PATH = "/Streaming/Channels/101"
_HOSTNAME_RE = re.compile(r"(?=.{1,253}\Z)[A-Za-z0-9](?:[A-Za-z0-9-]{0,61}[A-Za-z0-9])?(?:\.[A-Za-z0-9](?:[A-Za-z0-9-]{0,61}[A-Za-z0-9])?)*")
FRAME_MAX = 4 * 1024 * 1024  # WisKey's own cap for a station picture
# Frame streams this process has registered with go2rtc: name -> sha256 of the source (security review S1). go2rtc up
# to 1.9.11 logs the whole source URL - credentials included - every time GetOrPatch creates or re-points a stream, so
# the source is sent once per (name, source); every other grab names the stream only.
_REGISTERED: dict[str, str] = {}
_REGISTERED_LOCK = threading.Lock()


def wiskey_stream_name(station_id: str) -> str:
    """smplwise_wiskey_<station id>: in our namespace, so only ever one of OUR streams; a station id that is not a
    plain name is replaced by a digest of it."""
    safe = station_id if re.fullmatch(r"[A-Za-z0-9_.-]{1,64}", station_id) else "h" + hashlib.sha256(station_id.encode()).hexdigest()[:16]
    name = f"{STREAM_PREFIX}wiskey_{safe}"
    if not NAME_RE.match(name):
        raise ValueError(name)
    return name


def wiskey_probe_stream_name() -> str:
    """A throwaway stream name for a connection test (delta review S-4): smplwise_wiskey_probe_<random>, in our namespace."""
    import secrets as _secrets

    return f"{STREAM_PREFIX}wiskey_probe_{_secrets.token_hex(6)}"


def rtsp_host(host: str) -> str | None:
    """The host as it may stand in an RTSP URL (an IPv6 address bracketed), or None when it is not a plain IP address
    or host name. The value comes from WisKey's `overview`, which is untrusted input."""
    import ipaddress

    bare = host[1:-1] if host.startswith("[") and host.endswith("]") else host
    try:
        ip = ipaddress.ip_address(bare)
    except ValueError:
        return host if _HOSTNAME_RE.fullmatch(host) else None
    return f"[{ip}]" if ip.version == 6 else str(ip)


def wiskey_rtsp_url(host: str, username: str, password: str) -> str:
    """WisKey's station source with the credentials SMPLWISE holds. Server-side only, like hikvision_rtsp_url."""
    safe_host = rtsp_host(host)
    if safe_host is None:
        raise ApiError(503, "intercom_camera_host_unknown", "כתובת העמדה שהתקבלה מ־WisKey אינה תקינה.")
    return rtsp_url(safe_host, WISKEY_RTSP_PORT, WISKEY_RTSP_PATH, username, password)


HA_STREAM_PREFIX = "smplwise_ha_"  # streams of standalone Home Assistant cameras the owner chose to show live
HA_SLUG_RE = re.compile(r"^[a-z0-9_]{1,100}$")


def ha_stream_name(entity_id: str) -> str:
    """smplwise_ha_<slug> for `camera.<slug>` (docs/design/CAMERA_CARD_HA_SOURCE.md): deterministic, one stream per entity, in
    our namespace and in the narrower one this feature owns. A value that is not a plain lower-case camera entity id is
    refused (ValueError) - an entity id never becomes a stream name by any other route."""
    domain, _, slug = (entity_id or "").partition(".")
    if domain != "camera" or not HA_SLUG_RE.fullmatch(slug):
        raise ValueError("not a camera entity id")
    name = f"{HA_STREAM_PREFIX}{slug}"
    if not NAME_RE.match(name):
        raise ValueError(name)
    return name


def redact_ha_source(url: str) -> str:
    """The source of a Home Assistant camera stream, for anything that leaves the server: the scheme only. The address,
    the credentials (`user:pass@`, but also a bare user, a token in the path or the query) and the path are all hidden -
    nothing about such a source is safe to show, log or audit."""
    m = re.match(r"^([A-Za-z][A-Za-z0-9+.-]{0,15})://", url or "")
    return f"{m.group(1).lower()}://***" if m else "***"


def redact_source(name: str, url: str) -> str:
    """A source as `GET /media/streams` may show it: credentials hidden always, and for a WisKey station stream the
    whole address too (the station host is never served, security review N1): rtsp://***/Streaming/Channels/101. A
    Home Assistant camera's source shows the scheme only (redact_ha_source)."""
    if name.startswith(HA_STREAM_PREFIX) or name.startswith(f"{STREAM_PREFIX}cam_"):
        # CAMERA-STREAM-SOURCES-2410: a camera's own RTSP address may carry a secret in its query too - the scheme only, like an HA camera's
        return redact_ha_source(url)
    if name.startswith(f"{STREAM_PREFIX}wiskey_"):
        return re.sub(r"://[^/\s]*", "://***", url, count=1)
    return redact_url(url)


def redact_url(url: str) -> str:
    """rtsp://user:pass@host → rtsp://***@host (for logs and audit details)."""
    return re.sub(r"://[^/@\s]+:[^/@\s]+@", "://***@", url)


@dataclass
class StreamInfo:
    name: str
    sources: list[str]
    # "go2rtc is pulling this stream right now" (a connected producer, or a consumer attached) - NOT "the camera works": go2rtc
    # connects a source on demand, so an idle stream that plays the moment someone opens it is `online` False (`state` "idle").
    online: bool
    # LIVE-H265-2341: the video codec go2rtc's producer reports once it has connected (`h264` | `h265` | `mjpeg` | other
    # lower-case name); None while no producer is connected (go2rtc only knows the codec after the first consumer)
    video_codec: str | None = None
    # GO2RTC-STREAM-SYNC-2436: consumers attached now (viewers, a frame grab, a probe)
    consumers: int = 0

    @property
    def state(self) -> str:
        """`active` (pulling now) | `idle` (a source is set; go2rtc connects it when someone watches) | `no_source`."""
        if self.online:
            return "active"
        return "idle" if any(self.sources) else "no_source"


# GO2RTC-STREAM-SYNC-2436: the keys of a go2rtc 1.9 producer that only a CONNECTED producer has (core.Connection's JSON). An idle
# producer of an on-demand stream is `{"url": <source>}` alone (lab 12.11, go2rtc 1.9.15: 41/41 ours idle between viewers).
_CONNECTED_KEYS = ("medias", "receivers", "bytes_recv", "remote_addr", "format_name", "id")


def producer_connected(p: Any) -> bool:
    return isinstance(p, dict) and any(p.get(k) for k in _CONNECTED_KEYS)


# ------------------------------------------------------------------------------------------- source comparison (GO2RTC-STREAM-SYNC-2436)
# go2rtc 1.9.15 answers `GET /api/streams` with each producer's source WITHOUT its user and password (1.9.14 and older: the source
# as written). Comparing the raw strings therefore never matched on 1.9.15 and every live open and every stream sync deleted and
# re-created each of our streams (lab 12.11: 32/32 differed in the credentials only). Sources are now compared by their parts:
# scheme, host, port (the scheme's default port filled in), path (percent-decoded), query and `#` options as multisets (order free).
# A user / password / query value go2rtc hid (absent, empty or a mask) cannot be compared; such a match is only "unchanged" when
# this process itself last wrote exactly this source to the stream (`_SOURCE_DIGEST`, a digest - never the source). After a restart the
# first sync therefore writes each stream once more; a changed password (an add-on option, so always a restart) is still applied.
_DEFAULT_PORTS = {"rtsp": 554, "rtsps": 322, "rtspx": 322, "http": 80, "https": 443, "ws": 80, "wss": 443, "rtmp": 1935, "rtmps": 443}
_MASK_RE = re.compile(r"^(?:\*+|x+|X+|•+|\.\.\.|<?redacted>?|<?hidden>?|%2A+)$", re.IGNORECASE)
_USERINFO_RE = re.compile(r"(://)[^/@\s?#]*@")
# CR-GO2RTC-OWNED-2436 (review 03 F09 / F26): was `_WRITTEN`, the name the feature modules use for their write timestamps
_SOURCE_DIGEST: dict[str, str] = {}
_SOURCE_DIGEST_LOCK = threading.Lock()

SAME, SAME_IF_HIDDEN, DIFFERENT = "same", "same_if_hidden", "different"


def _hidden(value: str | None) -> bool:
    return value is None or value == "" or bool(_MASK_RE.match(value))


def _multiset(text: str, sep: str) -> dict[str, list[str]]:
    from urllib.parse import parse_qsl

    out: dict[str, list[str]] = {}
    for k, v in parse_qsl(text, keep_blank_values=True, separator=sep) if text else []:
        out.setdefault(k, []).append(v)
    return out


def _compare_params(reported: str, wanted: str, sep: str) -> str:
    """Query / `#` options: the same keys, each with the same values in any order; a value go2rtc hid makes it SAME_IF_HIDDEN."""
    a, b = _multiset(reported, sep), _multiset(wanted, sep)
    if a.keys() != b.keys():
        return DIFFERENT
    verdict = SAME
    for k, want in b.items():
        got = a[k]
        if sorted(got) == sorted(want):
            continue
        if len(got) == len(want) and all(_hidden(v) for v in got):
            verdict = SAME_IF_HIDDEN
            continue
        return DIFFERENT
    return verdict


def compare_source(reported: str, wanted: str) -> str:
    """How the source go2rtc reports for a stream relates to the one we would write: SAME (nothing to do), SAME_IF_HIDDEN (equal in
    everything go2rtc shows; the credentials or a query value were hidden) or DIFFERENT."""
    if reported == wanted:
        return SAME
    try:
        r, w = urlsplit(reported), urlsplit(wanted)
        r_port, w_port = r.port, w.port
    except ValueError:
        return DIFFERENT
    if not w.netloc or not r.netloc:
        # not an address with a host (e.g. `ffmpeg:<url>#video=h264`): the strings with any `user:pass@` taken out
        if _USERINFO_RE.sub(r"\1", reported) != _USERINFO_RE.sub(r"\1", wanted):
            return DIFFERENT
        return SAME_IF_HIDDEN
    scheme = w.scheme.lower()
    if r.scheme.lower() != scheme or (r.hostname or "").lower() != (w.hostname or "").lower():
        return DIFFERENT
    if (r_port or _DEFAULT_PORTS.get(scheme)) != (w_port or _DEFAULT_PORTS.get(scheme)):
        return DIFFERENT
    if unquote(r.path or "/") != unquote(w.path or "/"):
        return DIFFERENT
    verdict = SAME
    for got, want, sep in ((r.query, w.query, "&"), (r.fragment, w.fragment, "#")):
        v = _compare_params(got, want, sep)
        if v == DIFFERENT:
            return DIFFERENT
        if v == SAME_IF_HIDDEN:
            verdict = SAME_IF_HIDDEN
    r_user, r_pw = (unquote(x) if x is not None else None for x in (r.username, r.password))
    w_user, w_pw = (unquote(x) if x is not None else None for x in (w.username, w.password))
    if (r_user, r_pw) == (w_user, w_pw):
        return verdict
    if w_user is None and w_pw is None:
        return DIFFERENT  # go2rtc holds credentials the source we want has none of
    if r_user is not None and not _hidden(r_user) and r_user != w_user:
        return DIFFERENT
    if r_pw is not None and not _hidden(r_pw) and r_pw != w_pw:
        return DIFFERENT
    return SAME_IF_HIDDEN


def takes_listing(client: Any) -> bool:
    """True when `client.ensure_stream` accepts a caller's listing (`streams=`): the real adapter does; a stand-in with the older
    signature does not, and is then called exactly as before (one listing per call)."""
    import inspect

    try:
        return "streams" in inspect.signature(client.ensure_stream).parameters
    except (TypeError, ValueError, AttributeError):
        return False


def _source_digest(name: str, src: str) -> str:
    return hashlib.sha256(f"{name}\n{src}".encode()).hexdigest()


def _note_written(name: str, src: str | None) -> None:
    with _SOURCE_DIGEST_LOCK:
        if src is None:
            _SOURCE_DIGEST.pop(name, None)
        else:
            _SOURCE_DIGEST[name] = _source_digest(name, src)


def stream_up_to_date(name: str, existing: StreamInfo | None, src: str) -> bool:
    """True when go2rtc already holds `src` for `name` (or holds what it shows of it, and this process wrote exactly `src`)."""
    if existing is None or len(existing.sources) != 1:
        return False
    verdict = compare_source(existing.sources[0], src)
    if verdict == SAME:
        _note_written(name, src)  # a go2rtc that shows the whole source: remembered too, so an upgrade to 1.9.15 writes nothing
        return True
    if verdict == SAME_IF_HIDDEN:
        with _SOURCE_DIGEST_LOCK:
            return _SOURCE_DIGEST.get(name) == _source_digest(name, src)
    return False


_MEDIA_CODEC_RE = re.compile(r"^\s*video\s*,[^,]*,\s*([A-Za-z0-9.+_-]+)")


def producer_video_codec(producers: list[Any]) -> str | None:
    """LIVE-H265-2341: the video codec of a go2rtc stream from its producers, as `GET /api/streams` reports them: the
    `receivers[].codec.codec_name` of go2rtc 1.9 (`h264`, `h265`), else the SDP-like `medias` strings
    (`"video, recvonly, H265"`). Lower case, `hevc` folded into `h265`; None when no producer says."""
    for p in producers:
        if not isinstance(p, dict):
            continue
        for rec in p.get("receivers") or []:
            codec = (rec or {}).get("codec") if isinstance(rec, dict) else None
            if isinstance(codec, dict) and codec.get("codec_type", "video") == "video" and codec.get("codec_name"):
                return _fold_codec(str(codec["codec_name"]))
        for media in p.get("medias") or []:
            m = _MEDIA_CODEC_RE.match(str(media))
            if m:
                return _fold_codec(m.group(1))
    return None


def _fold_codec(name: str) -> str:
    n = name.strip().lower().replace(".", "")
    return {"hevc": "h265", "avc": "h264", "jpeg": "mjpeg"}.get(n, n)


def _reached(_response: httpx.Response) -> None:
    """HEALTH-GO2RTC-2430: any HTTP answer from go2rtc - whatever its status - proves it is reachable (services/media_reach.py)."""
    from .media_reach import REACH

    REACH.record_ok()


_REACH_HOOKS = {"response": [_reached]}


class Go2rtc:
    def __init__(self, settings: Settings):
        if not settings.go2rtc_url:
            raise ApiError(503, "media_not_configured", "כתובת go2rtc לא הוגדרה בהגדרות ה־Add-on.")
        self.base = settings.go2rtc_url.rstrip("/")
        self.auth = (settings.go2rtc_user, settings.go2rtc_password) if settings.go2rtc_user else None

    def _client_for(self, timeout_s: float) -> httpx.Client:
        """Every HTTP client of this adapter: the shared TLS context and the reachability hooks (HEALTH-GO2RTC-2430)."""
        return httpx.Client(base_url=self.base, auth=self.auth, timeout=timeout_s, verify=_verify(), event_hooks=_REACH_HOOKS)

    def _client(self) -> httpx.Client:
        return self._client_for(6.0)

    def _wrap(self, exc: httpx.HTTPError, what: str) -> ApiError:
        from .media_reach import REACH, is_connection_failure

        if is_connection_failure(exc):  # HEALTH-GO2RTC-2430: /health says the video service is down, not just "configured"
            REACH.record_failure(type(exc).__name__)
        return ApiError(503, "media_unavailable", "go2rtc אינו זמין כרגע.", retryable=True, details={"op": what, "error": type(exc).__name__})

    def info(self) -> dict:
        with self._client() as c:
            try:
                r = c.get("/api")
            except httpx.HTTPError as exc:
                raise self._wrap(exc, "info") from exc
        if r.status_code != 200:
            raise ApiError(503, "media_error", "go2rtc החזיר שגיאה.", details={"status": r.status_code})
        try:
            return r.json()
        except ValueError:
            return {"raw": r.text[:200]}

    def list_streams(self) -> dict[str, StreamInfo]:
        with self._client() as c:
            try:
                r = c.get("/api/streams")
            except httpx.HTTPError as exc:
                raise self._wrap(exc, "list") from exc
        if r.status_code != 200:
            raise ApiError(503, "media_error", "go2rtc החזיר שגיאה.", details={"status": r.status_code})
        out: dict[str, StreamInfo] = {}
        try:
            data = r.json() or {}
        except ValueError:
            data = None
        if not isinstance(data, dict):
            # CR-GO2RTC-ADAPTER-2436 (review 03 F12): a 200 that is not a JSON object (a proxy page, say) is go2rtc answering wrongly -
            # the same `media_error` as a non-200, never an unhandled ValueError / AttributeError (a 500)
            raise ApiError(503, "media_error", "go2rtc החזיר שגיאה.", details={"status": r.status_code, "reason": "bad_body"})
        for name, value in data.items():
            value = value if isinstance(value, dict) else {}
            producers = value.get("producers") or []
            producers = producers if isinstance(producers, list) else []
            consumers = value.get("consumers") or []  # go2rtc 1.9: `null` while nobody watches
            n_consumers = len([c for c in consumers if c]) if isinstance(consumers, list) else 0
            sources = [p.get("url", "") for p in producers if isinstance(p, dict)]
            # GO2RTC-STREAM-SYNC-2436: a connected producer (any of its connection keys) or a consumer attached
            online = any(producer_connected(p) for p in producers) or n_consumers > 0
            out[name] = StreamInfo(name=name, sources=sources, online=online, video_codec=producer_video_codec(producers), consumers=n_consumers)
        return out

    def probe_video_codec(self, name: str, timeout_s: float = 12.0) -> tuple[bool, str | None]:
        """CAM-H264-VERIFY-2361: what one of OUR streams really carries now - `(known, codec)`. Read-only: `GET /api/streams?src=<name>&video=all`
        is go2rtc's stream probe (a short-lived probe consumer: go2rtc connects the stream's producer, i.e. opens the recorder's RTSP session for that
        channel for about a second, answers the stream with its producers' receivers, and removes the consumer). Only a NAME is sent - never a
        source - and a plain name is only ever looked up, so nothing can be created, re-pointed or deleted. `known` False: go2rtc does not hold the
        stream (404). The codec is None when no producer reported one (a go2rtc without the probe answers the plain stream JSON)."""
        if not name.startswith(STREAM_PREFIX) or name.startswith(HA_STREAM_PREFIX) or not NAME_RE.match(name):
            raise ValueError("refusing to probe a stream outside the smplwise_ namespace")
        try:
            with self._client_for(timeout_s) as c:
                r = c.get("/api/streams", params={"src": name, "video": "all"})
        except httpx.HTTPError as exc:
            raise self._wrap(exc, "probe") from exc
        if r.status_code == 404:
            return False, None
        if r.status_code != 200:
            raise ApiError(503, "media_error", "go2rtc החזיר שגיאה.", details={"status": r.status_code})
        try:
            data = r.json() or {}
        except ValueError:
            return True, None
        if isinstance(data, dict) and name in data and isinstance(data[name], dict) and "producers" not in data:
            data = data[name]  # an older go2rtc may answer `{name: {...}}`
        producers = data.get("producers") if isinstance(data, dict) else None
        return True, producer_video_codec(producers if isinstance(producers, list) else [])

    def ensure_stream(self, name: str, src: str, check: Callable[[dict[str, StreamInfo]], None] | None = None,
                      streams: dict[str, StreamInfo] | None = None) -> str:
        """Create or update one of our streams. Returns 'unchanged' | 'created' | 'updated'. `check` (optional) is called with the
        stream listing this call fetches anyway, before anything is written; it raises to refuse the write.

        CR-GO2RTC-ADAPTER-2436 (review 03 F03): `streams` is a listing the caller already holds (the stream sync fetches it once per
        run instead of once per stream); the decision is made from it exactly as from a fresh one, and a write updates that copy so the
        next call of the same run sees it."""
        if not name.startswith(STREAM_PREFIX):
            raise ValueError("refusing to write a stream outside the smplwise_ namespace")
        if streams is None:
            streams = self.list_streams()
        if check is not None:
            check(streams)
        existing = streams.get(name)
        if stream_up_to_date(name, existing, src):  # GO2RTC-STREAM-SYNC-2436: go2rtc 1.9.15 shows sources without credentials
            return "unchanged"
        with self._client() as c:
            try:
                if existing:
                    c.delete("/api/streams", params={"src": name})
                r = c.put("/api/streams", params={"name": name, "src": src})
            except httpx.HTTPError as exc:
                raise self._wrap(exc, "put") from exc
        if r.status_code not in (200, 201, 204):
            _note_written(name, None)
            raise ApiError(503, "media_error", "go2rtc סירב ליצור את הזרם.", details={"status": r.status_code, "stream": name})
        _note_written(name, src)
        streams[name] = StreamInfo(name=name, sources=[src], online=False)
        log.info("go2rtc stream %s %s (%s)", name, "updated" if existing else "created", redact_source(name, src))
        return "updated" if existing else "created"

    def create_stream(self, name: str, src: str) -> str:
        """CR-GO2RTC-ADAPTER-2436 (review 03 F03): write one of our streams whose name cannot exist yet (a playback generation:
        `smplwise_pb_<instance>_<session>_g<n>`) - the PUT `ensure_stream` makes for a name the listing does not hold, without
        fetching the listing. Returns 'created'; a refusal is the same `media_error`."""
        if not name.startswith(STREAM_PREFIX) or not NAME_RE.match(name):
            raise ValueError("refusing to write a stream outside the smplwise_ namespace")
        with self._client() as c:
            try:
                r = c.put("/api/streams", params={"name": name, "src": src})
            except httpx.HTTPError as exc:
                raise self._wrap(exc, "put") from exc
        if r.status_code not in (200, 201, 204):
            _note_written(name, None)
            raise ApiError(503, "media_error", "go2rtc סירב ליצור את הזרם.", details={"status": r.status_code, "stream": name})
        _note_written(name, src)
        log.info("go2rtc stream %s created (%s)", name, redact_source(name, src))
        return "created"

    def delete_stream(self, name: str, *, strict: bool = False) -> None:
        """Delete one of our streams. `strict` (WKF01F02-295, the leased station streams): a status go2rtc answers other than 200 / 204 /
        404 (404: it no longer knows the stream) is a refused delete - `ApiError` - so the caller keeps its record instead of forgetting a
        stream that may still hold a private source. The other callers keep the lenient behaviour (only a transport failure raises)."""
        if not name.startswith(STREAM_PREFIX):
            raise ValueError("refusing to delete a stream outside the smplwise_ namespace")
        _note_written(name, None)
        with self._client() as c:
            try:
                response = c.delete("/api/streams", params={"src": name})
            except httpx.HTTPError as exc:
                raise self._wrap(exc, "delete") from exc
        status = getattr(response, "status_code", None)
        if strict and status not in (200, 204, 404):
            raise ApiError(503, "media_unavailable", "go2rtc לא אישר סגירת שידור.", details={"op": "delete", "status": status})

    def _grab(self, params: dict[str, str]) -> tuple[int, bytes, bool]:
        body = bytearray()
        too_large = False
        try:
            with self._client_for(20.0) as c:
                with c.stream("GET", "/api/frame.jpeg", params=params) as r:
                    status = r.status_code
                    if status == 200:
                        for chunk in r.iter_bytes():
                            body += chunk
                            if len(body) > FRAME_MAX:
                                too_large = True
                                break
        except httpx.HTTPError as exc:
            raise self._wrap(exc, "frame") from exc
        return status, bytes(body), too_large

    def grab_probe(self, name: str, src: str, timeout_s: float = 15.0) -> tuple[int, bytes, str]:
        """CR-GO2RTC-ADAPTER-2436 (review 03 F10, adapter half): ONE frame of a throwaway in-memory stream (`/api/frame.jpeg?src=<address>
        &name=<probe name>`: go2rtc's Patch - nothing written to its configuration), through this adapter's client (shared TLS context,
        reachability hooks). Returns (status, body read up to FRAME_MAX, the first 300 bytes of an error answer); a timeout is
        `(0, b"", "timeout")`, any other transport failure `media_unavailable`. The same request `camera_sources._grab_probe` makes."""
        if not name.startswith(STREAM_PREFIX) or not NAME_RE.match(name):
            raise ValueError("refusing to name a stream outside the smplwise_ namespace")
        body = bytearray()
        err = ""
        try:
            with self._client_for(timeout_s) as c:
                with c.stream("GET", "/api/frame.jpeg", params={"src": src, "name": name}) as r:
                    status = r.status_code
                    for chunk in r.iter_bytes():
                        body += chunk
                        if len(body) > FRAME_MAX:
                            break
                    if status != 200:
                        err = bytes(body[:300]).decode("utf-8", "replace")
        except httpx.TimeoutException:
            return 0, b"", "timeout"
        except httpx.HTTPError as exc:
            raise self._wrap(exc, "probe") from exc
        return status, bytes(body), err

    def fetch_capped(self, path: str, params: dict[str, str], cap: int, timeout_s: float) -> tuple[int, bytes]:
        """CR-GO2RTC-ADAPTER-2436 (review 03 F04): one GET read up to `cap` bytes (+ the chunk that crossed it) through this adapter's
        client - the cast relay's HLS fetch. Only a 200's body is read. A transport failure is `media_unavailable` (and a connection
        failure is recorded for /health/video)."""
        body = bytearray()
        try:
            with self._client_for(timeout_s) as c:
                with c.stream("GET", path, params=params) as r:
                    status = r.status_code
                    if status == 200:
                        for chunk in r.iter_bytes():
                            body += chunk
                            if len(body) > cap:
                                return 200, bytes(body)  # over the cap: the caller refuses it
        except httpx.HTTPError as exc:
            raise self._wrap(exc, "fetch") from exc
        return status, bytes(body)

    def frame_jpeg(self, name: str, src: str) -> bytes:
        """One JPEG frame through go2rtc's /api/frame.jpeg. go2rtc resolves `src` with streams.GetOrPatch: a raw source
        with `name` is Patch(name, src) - an IN-MEMORY stream in our namespace (nothing written to go2rtc's config; and
        without `name` go2rtc would name the stream after the raw URL, credentials included). A plain stream name is
        looked up. So the raw source is sent only to register the stream (first grab in this process, or the source
        changed), and every other grab is `src=<name>` alone - no credentials in the query, nothing for go2rtc < 1.9.14
        to log (S1). A by-name 404 means go2rtc no longer knows the stream (it restarted): registered again once, which
        is also the retry. H.264/H.265 keyframes become a JPEG via go2rtc's ffmpeg (404 stream not found, 500 failed)."""
        if not name.startswith(STREAM_PREFIX) or not NAME_RE.match(name):  # review 03 F12: the same guard as frame_existing
            raise ValueError("refusing to name a stream outside the smplwise_ namespace")
        digest = hashlib.sha256(src.encode()).hexdigest()
        with _REGISTERED_LOCK:
            known = _REGISTERED.get(name) == digest
        if known:
            status, body, too_large = self._grab({"src": name})
            if status != 404:
                return self._frame(status, body, too_large)
            with _REGISTERED_LOCK:
                _REGISTERED.pop(name, None)
        status, body, too_large = self._grab({"src": src, "name": name})
        if status not in (401, 403, 404):
            # go2rtc accepted the stream (a frame that then failed - a refused account, say - still left it registered)
            with _REGISTERED_LOCK:
                _REGISTERED[name] = digest
        return self._frame(status, body, too_large)

    def frame_existing(self, name: str) -> bytes:
        """CAMHEALTH091: one JPEG frame of a stream go2rtc ALREADY knows, asked for by name only (`src=<name>`). Never sends a source,
        so it cannot create, register or re-point a stream; a name outside the `smplwise_` namespace is refused. A 404 (the stream is
        gone) is `snapshot_unavailable`, not a retry with the source - re-creating streams is the stream sync's job."""
        if not name.startswith(STREAM_PREFIX) or not NAME_RE.match(name):
            raise ValueError("refusing to name a stream outside the smplwise_ namespace")
        status, body, too_large = self._grab({"src": name})
        return self._frame(status, body, too_large)

    def discard_leased_stream(self, name: str, digest: str | None = None) -> bool:
        """WKLIVE-295: delete a leased station stream (`smplwise_wiskey_<station>...`, never a probe, never another namespace) so the private
        lease source does not outlive its viewers inside go2rtc's memory. The caller decides that no viewer is left.

        WKF01F02-295 (the Mac lease lifecycle, merged): the delete is strict and its outcome is returned. True: go2rtc confirmed it (or no
        longer knew the stream) and the registration is forgotten - only when it is still `digest` (None: whatever it is), so a newer
        registration of the same name is never dropped. False: go2rtc did not confirm; the registration is KEPT, so the caller keeps its
        record (quarantine) instead of forgetting a stream that may still hold the source. A failure is logged by rule only, never a source."""
        if not name.startswith(f"{STREAM_PREFIX}wiskey_") or name.startswith(f"{STREAM_PREFIX}wiskey_probe_") or not NAME_RE.match(name):
            raise ValueError("refusing to delete a stream that is not a leased station stream")
        try:
            self.delete_stream(name, strict=True)
        except ApiError as exc:
            log.warning("leased stream %s not deleted (%s)", name, exc.code)
            return False
        with _REGISTERED_LOCK:
            if digest is None or _REGISTERED.get(name) == digest:
                _REGISTERED.pop(name, None)
        return True

    def discard_probe_stream(self, name: str) -> None:
        """Delete a throwaway probe stream and forget its registration; a failure is logged (never the source) and swallowed - the
        stream is in-memory only and goes at the next go2rtc restart."""
        with _REGISTERED_LOCK:
            _REGISTERED.pop(name, None)
        try:
            self.delete_stream(name)
        except ApiError:
            log.warning("probe stream %s not deleted", name)

    @staticmethod
    def _frame(status: int, body: bytes, too_large: bool) -> bytes:
        if status in (401, 403):
            raise ApiError(503, "media_error", "go2rtc דחה את פרטי הגישה של ה־Add-on.", details={"op": "frame", "status": status})
        if status != 200 or too_large or not body.startswith(b"\xff\xd8\xff"):
            raise ApiError(503, "snapshot_unavailable", "go2rtc לא סיפק תמונה מהעמדה.", retryable=True, details={"op": "frame", "status": status, **({"reason": "too_large"} if too_large else {})})
        return body

    def ws_url(self, name: str) -> str:
        if not name.startswith(STREAM_PREFIX) or not NAME_RE.match(name):  # review 03 F12: never relies on the caller alone
            raise ValueError("refusing to name a stream outside the smplwise_ namespace")
        parts = urlsplit(self.base)
        scheme = "wss" if parts.scheme == "https" else "ws"
        return urlunsplit((scheme, parts.netloc, "/api/ws", f"src={quote(name, safe='')}", ""))

    def ws_headers(self) -> dict[str, str]:
        if not self.auth:
            return {}
        import base64

        token = base64.b64encode(f"{self.auth[0]}:{self.auth[1]}".encode()).decode()
        return {"Authorization": f"Basic {token}"}


# ------------------------------------------------------------------------------------------- owned streams (CR-GO2RTC-OWNED-2436)
# Review 03 F09: "the streams one feature owns" existed four times (manual camera sources, Home Assistant cameras, the playback orphan
# sweep, the disabled-recorder cleanup) and the copies had drifted. The rule they share lives here once. It never widens what a
# feature may touch: a name is only written or deleted when it is in the `smplwise_` namespace AND in the feature's own prefix AND
# (when the feature gives one) of its exact shape - the intercom project's streams and every other foreign name stay untouchable.


def names_foreign_stream(src: str, stream_names: Any, own_prefix: str) -> bool:
    """True when the first path segment of `src` (raw, percent-decoded twice, dot segments resolved, case-insensitive) is the name of a
    go2rtc stream outside `own_prefix`: an alias of go2rtc's RTSP restream (`rtsp://<go2rtc, by any name>:8554/<another stream>`) that
    would re-publish someone else's stream under one of our names. An address that does not parse counts as foreign (refused)."""
    try:
        path = urlsplit(src).path
    except ValueError:
        return True
    decoded = unquote(unquote(path))
    normal = posixpath.normpath("/" + decoded.lstrip("/"))
    first = {seg.lower() for seg in (path.lstrip("/").split("/", 1)[0], decoded.lstrip("/").split("/", 1)[0], normal.lstrip("/").split("/", 1)[0]) if seg}
    return bool(first & {str(n).lower() for n in stream_names if not str(n).startswith(own_prefix)})


def refuse_foreign(src: str, own_prefix: str, refusal: Callable[[], ApiError]) -> Callable[[dict[str, StreamInfo]], None]:
    """A `check=` for `Go2rtc.ensure_stream`: raises `refusal()` (each feature keeps its own code and text) when `src` names a stream
    outside `own_prefix` (names_foreign_stream). Runs on the listing `ensure_stream` holds, before anything is written."""

    def check(streams: dict[str, StreamInfo]) -> None:
        if names_foreign_stream(src, streams, own_prefix):
            raise refusal()

    return check


class OwnedStreams:
    """The go2rtc streams one feature owns: its prefix (inside `smplwise_`; a zero-argument callable when it is only known at run time,
    as the playback prefix carrying the instance id) and, optionally, the exact shape of the names it builds. Every write and delete of
    the feature goes through `lock`, and `written` says when this process last wrote each name, so `reconcile` never deletes a stream
    written a moment ago (its database row may not be committed yet).

    Locking (the stricter rule the Home Assistant reconcile already had): the grace check, the second "is it wanted?" question and the
    delete happen under ONE hold of `lock`. Callers never take `lock` while holding the database write lock (`wanted` may read the
    database); `forget` takes no lock for that reason."""

    def __init__(self, prefix: str | Callable[[], str], shape_re: re.Pattern[str] | None = None):
        self._prefix = prefix
        self.shape_re = shape_re
        self.lock = threading.Lock()
        self.written: dict[str, float] = {}

    @property
    def prefix(self) -> str:
        return self._prefix() if callable(self._prefix) else self._prefix

    def owns(self, name: Any) -> bool:
        """True only for a name this feature may write or delete: `smplwise_`, the feature's prefix, and its shape when it has one."""
        if not isinstance(name, str) or not name.startswith(STREAM_PREFIX) or not name.startswith(self.prefix):
            return False
        return self.shape_re is None or self.shape_re.fullmatch(name) is not None

    def _guard(self, name: Any, what: str) -> None:
        if not self.owns(name):
            raise ValueError(f"refusing to {what} a stream outside the {self.prefix} namespace")

    def note_written(self, name: str) -> None:
        """Remember a write the caller makes itself, without the lock (playback: a generation's name is new by construction; noted
        BEFORE the write, a sweep that already lists the stream also sees the note)."""
        self._guard(name, "write")
        self.written[name] = time.monotonic()

    def forget(self, name: str) -> None:
        """The stream needs no protection any more (its owner row is gone). Lock-free (see the class note)."""
        self.written.pop(name, None)

    def written_within(self, name: str, grace_s: float) -> bool:
        return time.monotonic() - self.written.get(name, -1e9) < grace_s

    def write(self, client: Any, name: str, src: str, *, check: Callable[[dict[str, StreamInfo]], None] | None = None,
              before: Callable[[], None] | None = None) -> str:
        """`client.ensure_stream(name, src, check=check)` under the lock, noted on success. `before` (optional) runs inside the lock right
        before the write and raises to refuse it (a camera disabled while its source was being read)."""
        self._guard(name, "write")
        with self.lock:
            if before is not None:
                before()
            outcome = client.ensure_stream(name, src, check=check)
            self.written[name] = time.monotonic()
        return outcome

    def delete(self, client: Any, name: str) -> None:
        self._guard(name, "delete")
        with self.lock:
            client.delete_stream(name)
            self.written.pop(name, None)

    def reconcile(self, client: Any, wanted: Callable[[], set[str]], *, grace_s: float, key: Callable[[str], str] | None = None,
                  on_deleted: Callable[[str], None] | None = None) -> list[str]:
        """Delete every stream go2rtc lists that this feature owns (`owns`) and `wanted()` no longer wants (`key` maps a name to the
        name `wanted` holds - a transcoded variant to its base). Per candidate, under one hold of the lock: skipped when written within
        `grace_s`, skipped when `wanted()` - asked again - wants it now, else deleted. `on_deleted` (the audit row) runs after the lock
        is released. Returns the deleted names (sorted); a go2rtc failure raises `ApiError` after the deletes already made were
        reported to `on_deleted`."""
        key = key or (lambda n: n)
        want = wanted()
        stray = sorted(n for n in client.list_streams() if self.owns(n) and key(n) not in want)
        deleted: list[str] = []
        for name in stray:
            with self.lock:
                if self.written_within(name, grace_s):
                    continue  # written a moment ago: its owner row may not be committed yet
                if key(name) in wanted():
                    continue  # wanted again meanwhile
                client.delete_stream(name)
                self.written.pop(name, None)
            deleted.append(name)
            if on_deleted is not None:
                on_deleted(name)
        return deleted


def delete_listed(client: Any, names: list[str], owns: Callable[[str], bool]) -> int:
    """Delete exactly `names` - each only when it is in the `smplwise_` namespace, `owns(name)` and go2rtc lists it (one listing).
    Returns how many were deleted. For a caller that deletes by exact name and keeps no write notes (a disabled recorder's live
    streams)."""
    if not names:
        return 0
    listed = client.list_streams()
    n = 0
    for name in names:
        if isinstance(name, str) and name.startswith(STREAM_PREFIX) and owns(name) and name in listed:
            client.delete_stream(name)
            n += 1
    return n
