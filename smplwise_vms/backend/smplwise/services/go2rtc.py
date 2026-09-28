"""External go2rtc adapter (MASTER_SPEC ch. 21, ADR-011/ADR-013).

The product owns only streams whose name starts with `smplwise_`; everything else on the shared
go2rtc (intercom, other projects) is never listed as ours, modified or deleted. Source URLs carry the
NVR credentials and therefore never leave the server: they are written to go2rtc's API and nothing
else. Browser media goes through the add-on's WebSocket relay (see routers/media.py).
"""
from __future__ import annotations

import hashlib
import logging
import re
import threading
from dataclasses import dataclass
from urllib.parse import quote, urlsplit, urlunsplit

import httpx

from ..config import Settings
from ..errors import ApiError

log = logging.getLogger("smplwise.go2rtc")
STREAM_PREFIX = "smplwise_"
NAME_RE = re.compile(r"^[A-Za-z0-9_.-]+$")


def stream_name(recorder_id: str, channel: int, profile: str) -> str:
    """Deterministic, readable and namespaced: smplwise_nvr-1_ch4_sub."""
    if profile not in ("main", "sub"):
        raise ValueError(profile)
    name = f"{STREAM_PREFIX}{recorder_id}_ch{channel}_{profile}"
    if not NAME_RE.match(name):
        raise ValueError(name)
    return name


def hikvision_rtsp_url(settings: Settings, channel: int, profile: str) -> str:
    """rtsp://user:pass@host:554/Streaming/Channels/<ch>01 (main) or <ch>02 (sub). Server-side only."""
    if not settings.nvr_host or not settings.nvr_user or not settings.nvr_password:
        raise ApiError(503, "source_not_configured", "פרטי ה־NVR לא הוגדרו בהגדרות ה־Add-on.")
    track = f"{channel}0{1 if profile == 'main' else 2}"
    return f"rtsp://{quote(settings.nvr_user, safe='')}:{quote(settings.nvr_password, safe='')}@{settings.nvr_host}:{settings.nvr_rtsp_port}/Streaming/Channels/{track}"


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
    import hashlib

    safe = station_id if re.fullmatch(r"[A-Za-z0-9_.-]{1,64}", station_id) else "h" + hashlib.sha256(station_id.encode()).hexdigest()[:16]
    name = f"{STREAM_PREFIX}wiskey_{safe}"
    if not NAME_RE.match(name):
        raise ValueError(name)
    return name


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
    return f"rtsp://{quote(username, safe='')}:{quote(password, safe='')}@{safe_host}:{WISKEY_RTSP_PORT}{WISKEY_RTSP_PATH}"


def redact_source(name: str, url: str) -> str:
    """A source as `GET /media/streams` may show it: credentials hidden always, and for a WisKey station stream the
    whole address too (the station host is never served, security review N1): rtsp://***/Streaming/Channels/101."""
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
    online: bool


class Go2rtc:
    def __init__(self, settings: Settings):
        if not settings.go2rtc_url:
            raise ApiError(503, "media_not_configured", "כתובת go2rtc לא הוגדרה בהגדרות ה־Add-on.")
        self.base = settings.go2rtc_url.rstrip("/")
        self.auth = (settings.go2rtc_user, settings.go2rtc_password) if settings.go2rtc_user else None

    def _client(self) -> httpx.Client:
        return httpx.Client(base_url=self.base, auth=self.auth, timeout=6.0)

    def _wrap(self, exc: httpx.HTTPError, what: str) -> ApiError:
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
        data = r.json() or {}
        for name, value in data.items():
            producers = (value or {}).get("producers") or []
            sources = [p.get("url", "") for p in producers if isinstance(p, dict)]
            online = any(p.get("medias") or p.get("receivers") for p in producers if isinstance(p, dict))
            out[name] = StreamInfo(name=name, sources=sources, online=online)
        return out

    def ensure_stream(self, name: str, src: str) -> str:
        """Create or update one of our streams. Returns 'unchanged' | 'created' | 'updated'."""
        if not name.startswith(STREAM_PREFIX):
            raise ValueError("refusing to write a stream outside the smplwise_ namespace")
        streams = self.list_streams()
        existing = streams.get(name)
        if existing and existing.sources == [src]:
            return "unchanged"
        with self._client() as c:
            try:
                if existing:
                    c.delete("/api/streams", params={"src": name})
                r = c.put("/api/streams", params={"name": name, "src": src})
            except httpx.HTTPError as exc:
                raise self._wrap(exc, "put") from exc
        if r.status_code not in (200, 201, 204):
            raise ApiError(503, "media_error", "go2rtc סירב ליצור את הזרם.", details={"status": r.status_code, "stream": name})
        log.info("go2rtc stream %s %s (%s)", name, "updated" if existing else "created", redact_url(src))
        return "updated" if existing else "created"

    def delete_stream(self, name: str) -> None:
        if not name.startswith(STREAM_PREFIX):
            raise ValueError("refusing to delete a stream outside the smplwise_ namespace")
        with self._client() as c:
            try:
                c.delete("/api/streams", params={"src": name})
            except httpx.HTTPError as exc:
                raise self._wrap(exc, "delete") from exc

    def _grab(self, params: dict[str, str]) -> tuple[int, bytes, bool]:
        body = bytearray()
        too_large = False
        try:
            with httpx.Client(base_url=self.base, auth=self.auth, timeout=20.0) as c:
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

    def frame_jpeg(self, name: str, src: str) -> bytes:
        """One JPEG frame through go2rtc's /api/frame.jpeg. go2rtc resolves `src` with streams.GetOrPatch: a raw source
        with `name` is Patch(name, src) - an IN-MEMORY stream in our namespace (nothing written to go2rtc's config; and
        without `name` go2rtc would name the stream after the raw URL, credentials included). A plain stream name is
        looked up. So the raw source is sent only to register the stream (first grab in this process, or the source
        changed), and every other grab is `src=<name>` alone - no credentials in the query, nothing for go2rtc < 1.9.14
        to log (S1). A by-name 404 means go2rtc no longer knows the stream (it restarted): registered again once, which
        is also the retry. H.264/H.265 keyframes become a JPEG via go2rtc's ffmpeg (404 stream not found, 500 failed)."""
        if not name.startswith(STREAM_PREFIX):
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

    @staticmethod
    def _frame(status: int, body: bytes, too_large: bool) -> bytes:
        if status in (401, 403):
            raise ApiError(503, "media_error", "go2rtc דחה את פרטי הגישה של ה־Add-on.", details={"op": "frame", "status": status})
        if status != 200 or too_large or not body.startswith(b"\xff\xd8\xff"):
            raise ApiError(503, "snapshot_unavailable", "go2rtc לא סיפק תמונה מהעמדה.", retryable=True, details={"op": "frame", "status": status, **({"reason": "too_large"} if too_large else {})})
        return body

    def ws_url(self, name: str) -> str:
        parts = urlsplit(self.base)
        scheme = "wss" if parts.scheme == "https" else "ws"
        return urlunsplit((scheme, parts.netloc, "/api/ws", f"src={quote(name, safe='')}", ""))

    def ws_headers(self) -> dict[str, str]:
        if not self.auth:
            return {}
        import base64

        token = base64.b64encode(f"{self.auth[0]}:{self.auth[1]}".encode()).decode()
        return {"Authorization": f"Basic {token}"}
