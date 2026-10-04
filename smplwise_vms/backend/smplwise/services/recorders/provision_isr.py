"""The Provision-ISR adapter, phase P1: read-only over the vendor's HTTP API v1 (CR-025).

Study: `docs/integrations/provision-isr/API_STUDY.md`. Change request: `docs/changes/CR-025-PROVISION-ISR.md`.

v1 in one paragraph: XML over HTTP, `POST http://<host>[:port]/<Command>[/<channelId>][/<action>]`, HTTP Basic (v1 guide)
or Digest (v2 guide, chosen by the device's configuration), `200` + data document or `400` + `<config status="failed"
errorCode="n"/>`. An NVR lists channels with `GetChannelList`; an IP camera is channel 1. Live video is RTSP
(`rtsp://host:port?chID=<n>&streamType=main|sub` on an NVR, `rtsp://host:port/<streamName>` on a camera).

What P1 reads (and nothing else - `READ_COMMANDS` is an allow-list, every other command is refused before a byte is sent):
device info, channels (+ the OSD name, the only channel name v1 has), every stream's encoding, stream capabilities, a JPEG
snapshot, disks, recording state, ports, device clock, and the alarm status (short polling). The long-polling session
(`PullSubscription`, REALTIME_SUBSCRIBE) is implemented and tested against the fake but is experimental: the guide
documents it for IP cameras only and it was never run against a real unit.

Rules kept from the Hikvision adapter (ADP section 1): device I/O only (no SQLite, no audit, no permission decisions),
synchronous and bounded (the `nvr.deadline` contract applies), declared not guessed (`capabilities()`), errors are `ApiError`
with the shared codes, and no address / user name / password / serial / MAC in any error detail.

Multi-NVR (CR-024, branch pilot/multi-nvr, not merged when this was written): the constructor has the registry's
signature `(recorder_id, settings)`; `settings` is that recorder's effective settings (`recorder_scope.settings_for`), and
`device_key` hashes that connection the same way CR-024's Hikvision adapter does. Registration
(`registry.register_vendor`) is deliberately NOT done here: the catalogue keeps Provision-ISR "coming soon" until the
owner's unit has been validated live (CR-025 section 6)."""
from __future__ import annotations

import hashlib
import re
import threading
import time
import xml.etree.ElementTree as ET
from collections.abc import Callable
from typing import Any, ClassVar
from urllib.parse import quote

import httpx

from ...config import Settings
from ...errors import ApiError
from .. import nvr
from ..events_ingest import ParsedAlert
from . import provision_isr_auth as pauth
from . import provision_isr_xml as px
from .base import ChannelInfo, RecorderCapabilities, RecorderHealth, StreamEncoding, StreamOptions, StreamSnapshot, WriteOutcome

VENDOR = "provision_isr"

# Every command P1 may send. Nothing here changes device state.
READ_COMMANDS = frozenset({
    "GetDeviceInfo", "GetChannelList", "GetDiskInfo", "GetRecordStatusInfo", "GetPortConfig", "GetDateAndTime",
    "GetStreamCaps", "GetVideoStreamConfig", "GetImageOsdConfig", "GetSnapshot", "GetAlarmStatus", "GetAlarmServerConfig",
})
# The long-polling session commands: named Set*, but they manage this client's own subscription, not the device's
# configuration (v1 long-polling guide 2.1-2.4).
EVENT_SESSION_COMMANDS = frozenset({"SetSubscribe", "SetRenew", "SetUnSubscribe", "GetPullMessages"})
# Device writes (P2): only with nvr_extra.writes_enabled (owner approval per unit), only through write_stream_encoding /
# configure_push, never retried. Reads used around them stay in READ_COMMANDS.
WRITE_COMMANDS = frozenset({"SetVideoStreamConfig", "SetAlarmServerConfig"})

XML_MAX_BYTES = 2_000_000
SNAPSHOT_MAX_BYTES = 8_000_000
READ_TIMEOUT_S = 8.0
HEALTH_TIMEOUT_S = 4.0
AUTH_TTL_S = 600.0  # the detected auth scheme is re-probed after this (a firmware change or a device reconfiguration)

REFUSED_BACKOFF_S = 300.0  # after the device refuses the credentials, no further login attempt for this long (lockout guard)

_AUTH: dict[str, tuple[float, str]] = {}  # device_key -> (expires at, scheme)
_CHALLENGE: dict[str, dict[str, Any]] = {}
_PINNED: dict[str, float] = {}  # device_key -> pinned certificate verified until (monotonic)
PIN_TTL_S = 600.0  # device_key -> non-secret facts of the last challenge (provision_isr_auth.describe)
_REFUSED: dict[str, float] = {}  # device_key -> no login attempt before this (monotonic)
_AUTH_LOCK = threading.Lock()
_monotonic = time.monotonic


def clear_auth_cache() -> None:
    with _AUTH_LOCK:
        _AUTH.clear()
        _REFUSED.clear()
        _CHALLENGE.clear()
        _PINNED.clear()


def _unavailable(op: str, exc: Exception) -> ApiError:
    return ApiError(503, "source_unavailable", "ה־NVR אינו זמין כרגע.", retryable=True, details={"op": op, "error": type(exc).__name__})


def _invalid(op: str, exc: Exception | None = None) -> ApiError:
    return ApiError(503, "source_invalid", "תשובת ה־NVR אינה מסמך תקין.", details={"op": op, "error": type(exc).__name__ if exc else "shape"})


def _device_error(op: str, status: int, body: str) -> ApiError:
    """Map a non-200 answer. 400 carries the vendor's errorCode (v1 guide 1.3.6, v2 table for newer firmware)."""
    if status == 401:
        return ApiError(503, "source_forbidden", "ה־NVR דחה את פרטי הגישה.", details={"op": op, "status": status})
    _st, code, _desc = px.response_status(body or "")
    name = px.ERROR_CODES.get(code or -1)
    details: dict[str, Any] = {"op": op, "status": status, "device_code": code}
    if code in (4, 9, 10) or status == 403:
        return ApiError(503, "source_forbidden", "ה־NVR דחה את הבקשה (הרשאות המשתמש ב־NVR).", details={**details, "reason": name})
    if code in (1, 11, 12):
        return ApiError(409, "nvr_not_supported", "ה־NVR אינו תומך בבקשה הזו.", details={**details, "reason": name})
    if code == 7:
        return ApiError(409, "nvr_busy", "ה־NVR עסוק כרגע.", retryable=True, details={**details, "reason": name})
    return ApiError(503, "source_error", "ה־NVR החזיר שגיאה.", retryable=True, details={**details, "reason": name})


class ProvisionIsrAdapter:
    """`RecorderAdapter` for Provision-ISR NVRs and IP cameras over HTTP API v1 (read-only in P1).

    Connection extras (`settings.nvr_extra`, all optional): `scheme` ("http" | "https", default http), `https_port`
    (default 443), `tls_verify` (bool, default True; a device's self-signed certificate needs False or, later, pinning),
    `auth` ("basic" | "digest", default: detected from the device's 401 challenge), `rtsp_style` ("query" | "path",
    default "query" = the guide's `?chID=` form), `device_kind` ("nvr" | "ipc", default from GetDeviceInfo),
    `osd_names` (bool, default True: read each channel's OSD name), `long_polling_port` (int, default from GetPortConfig)."""

    vendor: ClassVar[str] = VENDOR

    def __init__(self, recorder_id: str, settings: Settings, *, transport: httpx.BaseTransport | None = None) -> None:
        self.recorder_id = recorder_id
        self._settings = settings
        self._transport = transport  # tests: httpx.MockTransport(fake.handle)
        self._info: dict[str, Any] | None = None
        self._caps: dict[int, dict[str, Any]] = {}

    # ------------------------------------------------------------------------------------------ connection

    @property
    def _extra(self) -> dict[str, Any]:
        return self._settings.nvr_extra if isinstance(self._settings.nvr_extra, dict) else {}

    @property
    def device_key(self) -> str:
        """The physical device (CR-024 rule): a hash of the destination, never the address itself."""
        dest = f"{(self._settings.nvr_host or '').strip('[]').lower()}|{self._settings.nvr_http_port}|{self.scheme}"
        return "pisr-" + hashlib.sha256(dest.encode("utf-8")).hexdigest()[:16]

    @property
    def scheme(self) -> str:
        return "https" if str(self._extra.get("scheme", "http")).lower() == "https" else "http"

    def transport_info(self) -> dict[str, Any]:
        """For the settings screen / health: how this connection authenticates. `insecure`: HTTP Basic over plain HTTP
        (the password crosses the network in base64 on every request). `challenge`: non-secret facts of the device's last
        401 (scheme, qop, algorithm, vendor `AuthVersion`)."""
        auth = self._cached_auth()
        with _AUTH_LOCK:
            challenge = dict(_CHALLENGE.get(self.device_key) or {})
        return {"scheme": self.scheme, "auth": auth, "insecure": self.scheme == "http" and auth == "basic", "challenge": challenge or None}

    def warnings(self) -> list[dict[str, Any]]:
        """Settings-screen warnings (owner decision 2026-10-04: Basic over HTTP is allowed, with a warning that can be
        dismissed in the UI or suppressed for this recorder by `nvr_extra.suppress_insecure_warning`)."""
        out: list[dict[str, Any]] = []
        info = self.transport_info()
        if info["insecure"] and not self._extra.get("suppress_insecure_warning"):
            out.append({"code": "basic_over_http", "severity": "warning", "dismissible": True,
                        "message": "החיבור ל־NVR שולח את הסיסמה בלי הצפנה (Basic על HTTP). מומלץ להפעיל HTTPS או Digest במכשיר."})
        if self.scheme == "https" and self.tls_mode() == "trust" and not self._extra.get("suppress_tls_warning"):
            out.append({"code": "tls_trust_any", "severity": "warning", "dismissible": True,
                        "message": "תעודת ה־HTTPS של ה־NVR אינה נבדקת. מומלץ לנעוץ את התעודה בבדיקת החיבור."})
        challenge = info.get("challenge") or {}
        if challenge.get("auth_version") and info["auth"] != "vendor_v1_1":
            out.append({"code": "vendor_auth_version", "severity": "info", "dismissible": True,
                        "message": "ה־NVR מבקש גרסת אימות של היצרן שעדיין לא מומשה; אם הכניסה נכשלת, החליפו בשרת ה־API של המכשיר את סוג ההצפנה."})
        return out
    def _base_url(self, port: int | None = None) -> str:
        if self.scheme == "https":
            port = port or int(self._extra.get("https_port") or 443)
        else:
            port = port or self._settings.nvr_http_port
        return f"{self.scheme}://{self._settings.nvr_host}:{port}"

    def tls_mode(self) -> str:
        """HTTPS certificate handling: `verify` (system CAs; default), `pin` (the device's own certificate, SHA-256 in
        `tls_pin`, recorded by the connection test - the right fix for a self-signed NVR) or `trust` (any certificate;
        warned). The legacy `tls_verify: false` means `trust`."""
        mode = str(self._extra.get("tls_mode") or "").lower()
        if mode in ("verify", "pin", "trust"):
            return mode
        return "trust" if self._extra.get("tls_verify") is False else "verify"

    def _verify(self) -> Any:
        if self.scheme == "https" and self.tls_mode() in ("pin", "trust"):
            return False  # pin: the certificate is checked by its fingerprint before any credentials are sent (_check_pin)
        return nvr._ssl_context()

    def _check_pin(self) -> None:
        """Pinned HTTPS: one TLS handshake (no HTTP, no credentials) compares the device certificate's SHA-256 with `tls_pin`
        before a request carrying credentials is sent. A good answer is cached per device for PIN_TTL_S."""
        if self.scheme != "https" or self.tls_mode() != "pin":
            return
        pin = str(self._extra.get("tls_pin") or "").strip().lower().replace(":", "")
        if not re.fullmatch(r"[0-9a-f]{64}", pin):
            raise ApiError(409, "tls_pin_missing", "לא נשמרה טביעת אצבע של תעודת ה־NVR. בצעו בדיקת חיבור ושמרו.", details={"op": "tls"})
        with _AUTH_LOCK:
            ok_until = _PINNED.get(self.device_key)
        if ok_until and ok_until > _monotonic():
            return
        try:
            got = PEER_CERTIFICATE(self._settings.nvr_host or "", int(self._extra.get("https_port") or 443), HEALTH_TIMEOUT_S)
        except OSError as exc:
            raise _unavailable("tls", exc) from exc
        if got.get("sha256") != pin:
            raise ApiError(503, "tls_pin_mismatch", "תעודת ה־NVR השתנתה. יש לאשר את התעודה החדשה בהגדרות החיבור.", details={"op": "tls"})
        with _AUTH_LOCK:
            _PINNED[self.device_key] = _monotonic() + PIN_TTL_S

    def _client(self, timeout: float = READ_TIMEOUT_S, auth: httpx.Auth | None = None, port: int | None = None) -> httpx.Client:
        from ...mode import ensure_nvr

        ensure_nvr(self._settings)  # NVR-less mode: 409 nvr_not_configured
        from ...mode import ensure_recorder_enabled

        ensure_recorder_enabled(self._settings)  # security review M3: a recorder disabled while running is never contacted
        s = self._settings
        if not s.nvr_host or not s.nvr_user or not s.nvr_password:
            raise ApiError(503, "source_not_configured", "פרטי ה־NVR לא הוגדרו.")
        self._check_pin()
        kwargs: dict[str, Any] = {"base_url": self._base_url(port), "timeout": timeout, "verify": self._verify()}
        if auth is not None:
            kwargs["auth"] = auth
        if self._transport is not None:
            kwargs["transport"] = self._transport
        return httpx.Client(**kwargs)

    def _cached_auth(self) -> str | None:
        forced = str(self._extra.get("auth") or "").lower()
        if forced in pauth.SCHEMES:
            return forced
        with _AUTH_LOCK:
            hit = _AUTH.get(self.device_key)
        return hit[1] if hit and hit[0] > _monotonic() else None

    def _detect_auth(self) -> str:
        """One unauthenticated read (GetDeviceInfo) to learn the scheme from `WWW-Authenticate`. Basic when the device
        says Basic or says nothing usable (the v1 guide's only scheme); Digest when it challenges with Digest."""
        cached = self._cached_auth()
        if cached:
            return cached
        nvr.check_deadline("auth")
        with self._client(timeout=HEALTH_TIMEOUT_S) as client:
            try:
                r = client.post("/GetDeviceInfo", timeout=nvr.bounded_timeout(client.timeout))
            except httpx.HTTPError as exc:
                if nvr.past_deadline():
                    raise nvr.deadline_error("auth") from exc
                raise _unavailable("auth", exc) from exc
        challenge = r.headers.get("www-authenticate", "")
        scheme = pauth.detect(challenge)
        with _AUTH_LOCK:
            _AUTH[self.device_key] = (_monotonic() + AUTH_TTL_S, scheme)
            _CHALLENGE[self.device_key] = pauth.describe(challenge)
        return scheme

    def _check_refused(self, op: str) -> None:
        """Live finding 2026-10-04: a device that refuses the credentials must not see another login per call (the account
        locks after repeated failures, v2 error 10). Until REFUSED_BACKOFF_S has passed every call fails locally."""
        with _AUTH_LOCK:
            until = _REFUSED.get(self.device_key)
        if until is not None and until > _monotonic():
            raise ApiError(503, "source_forbidden", "ה־NVR דחה את פרטי הגישה. ניסיון נוסף יתאפשר בעוד כמה דקות.",
                           details={"op": op, "reason": "credentials_refused_backoff"})

    def _auth(self) -> httpx.Auth:
        s = self._settings
        self._check_refused("auth")
        return pauth.build(self._detect_auth(), s.nvr_user or "", s.nvr_password or "")

    def _forget_auth(self) -> None:
        with _AUTH_LOCK:
            _AUTH.pop(self.device_key, None)

    # ------------------------------------------------------------------------------------------ one request

    def _call(self, command: str, channel: int | None = None, *, body: str | None = None, max_bytes: int = XML_MAX_BYTES,
              timeout: float = READ_TIMEOUT_S, client: httpx.Client | None = None, allowed: frozenset[str] = READ_COMMANDS) -> tuple[bytes, str]:
        """POST one allow-listed command; (body bytes, content type). Raises ApiError for everything but a 200."""
        if command not in allowed:
            raise ApiError(409, "nvr_not_supported", "הפעולה אינה מותרת בשלב הזה.", details={"op": command, "reason": "not_allowed"})
        path = f"/{command}" + (f"/{int(channel)}" if channel is not None else "")
        own = client is None
        c = client or self._client(timeout=timeout, auth=self._auth())
        try:
            nvr.check_deadline(command)
            content = body.encode("utf-8") if body is not None else b""
            headers = {"Content-Type": 'application/xml; charset="UTF-8"'} if body is not None else {}
            try:
                with c.stream("POST", path, content=content, headers=headers, timeout=nvr.bounded_timeout(c.timeout)) as r:
                    declared = r.headers.get("content-length")
                    if declared and declared.isdigit() and int(declared) > max_bytes:
                        raise ApiError(503, "source_too_large", "תשובת ה־NVR גדולה מהצפוי.", details={"op": command})
                    data = nvr.read_capped(r, max_bytes, command)
                    status, ctype = r.status_code, r.headers.get("content-type", "")
            except httpx.HTTPError as exc:
                if nvr.past_deadline():
                    raise nvr.deadline_error(command) from exc
                raise _unavailable(command, exc) from exc
        finally:
            if own:
                c.close()
        if status != 200:
            if status == 401:
                self._forget_auth()  # the scheme may have changed; the next attempt (after the backoff) probes again
                with _AUTH_LOCK:
                    _REFUSED[self.device_key] = _monotonic() + REFUSED_BACKOFF_S
            raise _device_error(command, status, data.decode("utf-8", "replace"))
        return data, ctype

    def _xml(self, command: str, channel: int | None = None, parser: Callable[..., Any] | None = None, *args: Any, **kw: Any) -> Any:
        data, _ = self._call(command, channel, **kw)
        status, code, _desc = px.response_status(data)
        if status == "failed":  # a 200 carrying a failure document (seen on several ODM firmwares)
            raise _device_error(command, 400, data.decode("utf-8", "replace"))
        if parser is None:
            return data
        try:
            return parser(data, *args)
        except (ET.ParseError, ValueError) as exc:
            raise _invalid(command, exc) from exc

    # ------------------------------------------------------------------------------------------ RecorderAdapter

    @property
    def writes_enabled(self) -> bool:
        """Device writes are off unless the recorder's connection says `writes_enabled: true` (set only after the owner's
        approval for that unit). With it off every write method refuses before a request is built."""
        return self._extra.get("writes_enabled") is True

    def event_mode(self) -> str:
        """`poll` (default, owner decision 2026-10-04) or `push` (the device posts alarms to the add-on's listener),
        selected per recorder by `nvr_extra.event_mode`."""
        return "push" if self._extra.get("event_mode") == "push" else "poll"

    def capabilities(self) -> RecorderCapabilities:
        return RecorderCapabilities(
            vendor=self.vendor, read_encodings=True, write_encodings=self.writes_enabled, encoding_fields=frozenset(px.ENCODING_FIELDS),
            add_channel=False, remove_channel=False, max_channels=(self._info or {}).get("chl_max_count"),
            live="rtsp", playback="rtsp", events=self.event_mode(),  # P3: RTSP playback (provision_playback)  # type: ignore[arg-type]
        )
    def device_info(self, *, refresh: bool = False) -> dict[str, Any]:
        if self._info is None or refresh:
            self._info = self._xml("GetDeviceInfo", None, px.parse_device_info, timeout=HEALTH_TIMEOUT_S)
        return self._info

    def kind(self) -> str:
        forced = str(self._extra.get("device_kind") or "").lower()
        return forced if forced in ("nvr", "ipc") else self.device_info()["kind"]

    def health(self) -> RecorderHealth:
        try:
            info = self.device_info(refresh=True)
        except ApiError as exc:
            if exc.code == "nvr_not_configured":
                raise
            return RecorderHealth(online=False, model=None, firmware=None, error=exc.code)
        return RecorderHealth(online=True, model=info.get("model"), firmware=info.get("firmware"), error=None)

    def list_channels(self) -> list[ChannelInfo]:
        if self.kind() == "ipc":
            return [ChannelInfo(source_ref="1", channel=1, name=self._channel_name(1) or "ערוץ 1", online=True)]
        out = []
        for ch, status, listed in self._xml("GetChannelList", None, px.parse_channel_list_named):
            online = px.CHANNEL_ONLINE.get(status or "")
            # live firmware names each channel in the list itself; the OSD read is the fallback for firmware that does not
            name = listed or (self._channel_name(ch) if online is not False else None)
            out.append(ChannelInfo(source_ref=str(ch), channel=ch, name=name or f"ערוץ {ch}", online=online))
        return out

    def _channel_name(self, ch: int) -> str | None:
        """The OSD channel name, best-effort: a channel whose OSD cannot be read keeps the generic name."""
        if self._extra.get("osd_names") is False:
            return None
        try:
            return self._xml("GetImageOsdConfig", ch, px.parse_osd_channel_name)
        except ApiError as exc:
            if exc.code in ("source_unavailable", "source_forbidden", "source_timeout", "nvr_not_configured"):
                raise
            return None

    def _channel_ids(self) -> list[int]:
        if self.kind() == "ipc":
            return [1]
        return [ch for ch, _status in self._xml("GetChannelList", None, px.parse_channel_list)]

    def _streams(self, ch: int) -> list[dict[str, Any]]:
        return self._xml("GetVideoStreamConfig", ch, px.parse_video_stream_config, ch)

    def read_stream_encodings(self) -> dict[str, list[StreamEncoding]]:
        """Every stream of every channel (one GetVideoStreamConfig per channel). A channel the device refuses (offline,
        unsupported) is left out; an unreachable or refusing device raises."""
        out: dict[str, list[StreamEncoding]] = {}
        for ch in self._channel_ids():
            try:
                streams = self._streams(ch)
            except ApiError as exc:
                if exc.code in ("source_error", "nvr_not_supported", "source_invalid"):
                    continue
                raise
            out[str(ch)] = [self._encoding(s) for s in streams]
        return out

    @staticmethod
    def _encoding(s: dict[str, Any]) -> StreamEncoding:
        enc = {k: v for k, v in s.items() if k not in ("stream_ref", "stream_id", "stream_no", "channel", "role", "fields", "etag", "element", "limits", "name", "url_path")}
        return StreamEncoding(stream_ref=s["stream_ref"], role=s["role"], enabled=True, encoding=enc, fields=s["fields"], etag=s["etag"])

    def _find_stream(self, ref: str) -> tuple[int, dict[str, Any]]:
        try:
            ch, sid = px.split_stream_ref(ref)
        except ValueError as exc:
            raise ApiError(422, "value_not_allowed", "הערך אינו מותר.", details={"field": "stream_ref"}) from exc
        for s in self._streams(ch):
            if s["stream_no"] == sid:
                return ch, s
        raise ApiError(404, "not_found", "הזרם לא נמצא ב־NVR.", details={"stream_ref": ref})

    def read_stream(self, stream_ref: str) -> StreamSnapshot:
        _ch, s = self._find_stream(stream_ref)
        parsed = {k: v for k, v in s.items() if k != "element"}
        return StreamSnapshot(stream_ref=stream_ref, element=s["element"], etag=s["etag"], parsed=parsed)

    def stream_caps(self, ch: int, *, refresh: bool = False) -> dict[str, Any]:
        if refresh or ch not in self._caps:
            self._caps[ch] = self._xml("GetStreamCaps", ch, px.parse_stream_caps)
        return self._caps[ch]

    def stream_options(self, stream_ref: str, codec: str | None = None) -> StreamOptions:
        """API 3.3 options for one stream, in the shape `nvr_settings.validate_changes` reads: codec families, profiles and
        resolutions per codec, fps values, bitrate / GOP bounds, bitrate modes, quality 1..5, smart codec. Built from
        GetStreamCaps + the stream's own bounds and codec tokens. `writable` only when writes are enabled for this recorder."""
        ch, s = self._find_stream(stream_ref)
        caps = self.stream_caps(ch).get("streams", {}).get(s["stream_no"], {})
        tokens = [t.lower() for t in (s["limits"]["codecs"] or caps.get("codecs") or [s["codec_raw"] or ""]) if t]
        families: list[str] = []
        for tok in tokens:
            fam = {"h264": "H.264", "h265": "H.265", "mjpeg": "MJPEG"}.get(tok.replace("plus", "").replace("smart", ""))
            if fam and fam not in families:
                families.append(fam)
        resolutions = [r["resolution"] for r in caps.get("resolutions", [])] or ([s["resolution"]] if s["resolution"] else [])
        top = max([r["max_fps"] or 0 for r in caps.get("resolutions", [])] + [int(s["fps"] or 0)])
        profiles = [p for p in (caps.get("profiles") or []) if p in ("baseline", "main", "high")]
        smart = any(t.endswith(("plus", "smart")) for t in tokens)
        options: dict[str, Any] = {
            "codec": families,
            "profile": {f: (profiles or ([s["profile"]] if s["profile"] else [])) for f in families if f == "H.264"}
            | ({"H.265": [s["profile"]]} if "H.265" in families and s["profile"] and s["codec"] == "H.265" else {}),
            "resolution": {f: list(resolutions) for f in families},
            "fps": [float(v) for v in range(1, top + 1)],
            "fps_full": False,
            "bitrate_mode": ["CBR", "VBR"] if s["bitrate_mode"] else [],
            "bitrate_kbps": s["limits"]["bitrate"],
            "bitrate_list": s["limits"]["bitrate_list"],
            "quality": list(range(1, len(px.QUALITY_WORDS) + 1)) if s["quality"] is not None else [],
            "gop": s["limits"]["gop"],
            "svc": False, "smart_codec": smart, "b_frames": False, "locks": {},
            "max_fps": {r["resolution"]: r["max_fps"] for r in caps.get("resolutions", []) if r.get("max_fps")},
            "source": "stream_caps",
        }
        if not self.writes_enabled:
            return StreamOptions(writable=False, reason="writes_disabled", options=options, write_via=None, source="stream_caps")
        return StreamOptions(writable=True, reason=None, options=options, write_via="direct", source="stream_caps")

    # -- vendor hooks used by services/nvr_settings.py (getattr seam; Hikvision keeps nvr.stream_document / parse_stream_element)

    @staticmethod
    def stream_document(element: str, changes: dict[str, Any]) -> str:
        """The edited stream item (no attributes) for write_stream_encoding. Raises ApiError 422 for a value it cannot write."""
        try:
            return px.edited_item(element, changes)
        except (ValueError, ET.ParseError) as exc:
            raise ApiError(422, "value_not_allowed", "הערך אינו בין הערכים שהמכשיר מקבל.", details={"field": str(exc)[:32]}) from exc

    @staticmethod
    def parse_element(element: str) -> dict[str, Any]:
        return px.parse_element(element)

    @staticmethod
    def registry_encoding(element: str) -> dict[str, Any] | None:
        """The codec-registry entry of a verified stream item (the keys the player reads)."""
        try:
            p = px.parse_element(element)
        except ET.ParseError:
            return None
        keep = ("codec", "codec_raw", "profile", "b_frames", "svc", "smart_codec", "resolution", "fps", "gop", "webrtc", "webrtc_reason")
        out = {k: p.get(k) for k in keep}
        out["reason"] = out.pop("webrtc_reason")
        out["source"] = "provision_isr"
        return out

    def _check_limits(self, ch: int, item: str) -> None:
        """fps against the resolution's own maximum (GetStreamCaps), which validate_changes cannot see."""
        p = px.parse_element(item, ch)
        caps = next((c for c in self.stream_caps(ch).get("streams", {}).values() if c.get("device_id") == p["stream_id"]), {})
        top = {r["resolution"]: r["max_fps"] for r in caps.get("resolutions", [])}.get(p["resolution"])
        if top and p["fps"] and p["fps"] > top:
            raise ApiError(422, "value_not_allowed", "קצב הפריימים גבוה מהמותר ברזולוציה הזו.", details={"field": "fps", "allowed": {"max": top}})

    def write_stream_encoding(self, stream_ref: str, expect_etag: str, element: str, write_via: str) -> WriteOutcome:
        """CR-020 contract: read the channel again, refuse 409 `stale` when the stream's etag moved, send
        SetVideoStreamConfig/{ch} with every stream of the channel (v1 guide 3.3.4: the whole `streams` element, no
        attributes; `element` replaces the target), read again. Never retried; a failure after the request was sent is
        `outcome: unknown`. Refused locally unless writes are enabled for this recorder."""
        if not self.writes_enabled:
            raise ApiError(409, "nvr_not_supported", "כתיבה ל־NVR הזה כבויה עד לאישור.", details={"op": "put", "reason": "writes_disabled"})
        if write_via != "direct":
            raise ApiError(409, "nvr_not_supported", "ה־NVR אינו תומך בשינוי הזה בזרם הזה.", details={"op": "put"})
        try:
            ch, sid = px.split_stream_ref(stream_ref)
            target = px.to_int(px.parse(element).attrib.get("id"))
        except (ValueError, ET.ParseError) as exc:
            raise ApiError(422, "value_not_allowed", "הערך אינו מותר.", details={"field": "stream_ref"}) from exc
        get_xml = self._xml("GetVideoStreamConfig", ch)
        before = next((s for s in px.parse_video_stream_config(get_xml, ch) if s["stream_no"] == sid), None)
        if before is None:
            raise ApiError(404, "not_found", "הזרם לא נמצא ב־NVR.", details={"stream_ref": stream_ref})
        if target != before["stream_id"]:  # the element must name the device's own id of this stream
            raise ApiError(422, "value_not_allowed", "הערך אינו מותר.", details={"field": "stream_ref"})
        if before["etag"] != expect_etag:
            raise ApiError(409, "stale", "ההגדרות השתנו ב־NVR. נטען מחדש.", details={"op": "pre_put", "etag": before["etag"]})
        self._check_limits(ch, element)
        body = px.set_streams_document(get_xml, element)
        nvr.check_deadline("put")  # past the deadline before anything was sent: a plain refusal, never unknown
        try:
            data, _ = self._call("SetVideoStreamConfig", ch, body=body, allowed=WRITE_COMMANDS, timeout=25.0)
        except ApiError as exc:
            if exc.code in ("source_unavailable", "source_timeout", "source_too_large"):
                exc.retryable = False
                exc.details = {**exc.details, "op": "put", "outcome": "unknown"}
            elif exc.code == "source_error" and exc.details.get("device_code") in (3, 15, 16, 18, 19):
                raise ApiError(409, "nvr_rejected", "ה־NVR דחה את ההגדרות.", details={"op": "put", "device_code": exc.details.get("device_code")}) from exc
            raise
        status, code, _desc = px.response_status(data)
        if status == "failed":
            raise ApiError(409, "nvr_rejected", "ה־NVR דחה את ההגדרות.", details={"op": "put", "device_code": code})
        try:
            verified = self.read_stream(stream_ref)
        except ApiError as exc:
            raise ApiError(503, "source_unavailable", "ה־NVR קיבל את השינוי אבל לא ניתן לאמת אותו. המצב ייבדק מחדש.", retryable=False,
                           details={"op": "verify", "cause": exc.code, "outcome": "unknown"}) from exc
        return WriteOutcome(device_status="success", reboot_required=False, verified=verified)

    # ------------------------------------------------------------------------------------------ device push (events)

    def push_config(self) -> dict[str, Any]:
        """GetAlarmServerConfig: where the device posts alarms today (address redacted to a boolean)."""
        return self._xml("GetAlarmServerConfig", None, px.parse_alarm_server)

    def configure_push(self, server: str, port: int, *, heartbeat_s: int = 30, path: str | None = None) -> dict[str, Any]:
        """SetAlarmServerConfig (a device configuration write: needs writes enabled for this recorder). Points the device's
        alarm push at the add-on's listener; reads the configuration back to verify."""
        if not self.writes_enabled:
            raise ApiError(409, "nvr_not_supported", "כתיבה ל־NVR הזה כבויה עד לאישור.", details={"op": "push_config", "reason": "writes_disabled"})
        before = self._xml("GetAlarmServerConfig", None, px.parse_alarm_server, True)
        try:
            body = px.alarm_server_document(server, port, heartbeat_s, path=path, fields=set(before.get("fields") or ()))
        except ValueError as exc:
            raise ApiError(422, "value_not_allowed", "הערך אינו מותר.", details={"field": str(exc)}) from exc
        self._xml("SetAlarmServerConfig", None, body=body, allowed=WRITE_COMMANDS)
        got = self._xml("GetAlarmServerConfig", None, px.parse_alarm_server, True)
        ok = got.get("address") == server and got.get("port") == port and (got.get("heartbeat") is not False)
        return {"applied": ok, "port": got.get("port"), "heartbeat_s": got.get("heartbeat_s"), "path_supported": bool(before.get("has_url")),
                "previous": {"configured": before.get("configured"), "port": before.get("port")}}

    # ------------------------------------------------------------------------------------------ smart events

    def smart_events(self) -> list[str]:
        """The smart event kinds this device offers (GetDeviceInfo `support*` flags), as alarm-status element names."""
        info = self.device_info()
        offered = [kind for flag, kind in SMART_FLAGS.items() if (info.get("support") or {}).get(flag)]
        return ["motionAlarm", "sensorAlarmIn"] + sorted(set(offered))

    def subscribe_types(self) -> tuple[str, ...]:
        """Long-polling smartTypes for what this device offers (falls back to the default list when it says nothing)."""
        try:
            kinds = self.smart_events()
        except ApiError:
            return SUBSCRIBE_TYPES
        out: list[str] = []
        for k in kinds:
            t = SUBSCRIBE_KIND.get(k)
            if t and t not in out:
                out.append(t)
        return tuple(out) or SUBSCRIBE_TYPES

    # ------------------------------------------------------------------------------------------ media

    def live_source(self, source_ref: str, role: str) -> str:
        """The server-side RTSP URL go2rtc pulls (credentials inside; never returned to a browser or logged).
        NVR: `rtsp://u:p@host:port?chID=<n>&streamType=main|sub` (guide 3.1.1; `rtsp_style: path` gives
        `.../chID=<n>&streamType=...`, the form the playback URL uses - which one a given firmware accepts is the first item
        of the live validation). IPC: `rtsp://u:p@host:port/<streamName>` with the name from GetStreamCaps."""
        from ...mode import ensure_nvr, ensure_recorder_enabled

        ensure_nvr(self._settings)
        ensure_recorder_enabled(self._settings)  # security review M3: no source URL for a disabled recorder
        s = self._settings
        if not s.nvr_host or not s.nvr_user or not s.nvr_password:
            raise ApiError(503, "source_not_configured", "פרטי ה־NVR לא הוגדרו.")
        if not str(source_ref).isdigit() or int(source_ref) < 1:
            raise ApiError(422, "value_not_allowed", "הערך אינו מותר.", details={"field": "source_ref"})
        ch = int(source_ref)
        base = f"rtsp://{quote(s.nvr_user, safe='')}:{quote(s.nvr_password, safe='')}@{s.nvr_host}:{s.nvr_rtsp_port}"
        no = {"main": 1, "sub": 2, "third": 3}.get(role)
        style = self._extra.get("rtsp_style")
        if self.kind() == "nvr" and style in ("query", "path"):  # forced by the connection: no discovery call
            if role not in ("main", "sub"):
                raise ApiError(409, "nvr_not_supported", "ה־NVR מספק זרם ראשי ומשני בלבד.", details={"role": role})
            query = f"chID={ch}&streamType={role}"
            return f"{base}/{query}" if style == "path" else f"{base}?{query}"
        stream = self.stream_caps(ch).get("streams", {}).get(no or 0, {}) if no else {}
        # live 2026-10-04: the NVR names each stream by its own RTSP URL (`/chID=1&streamType=main`, sub = `sub1`); the
        # path is taken from the device, the host / port / credentials are always the connection's
        if stream.get("url_path"):
            return f"{base}{stream['url_path']}"
        if stream.get("name"):
            return f"{base}/{stream['name']}"
        if self.kind() == "nvr" and role in ("main", "sub"):
            return f"{base}/chID={ch}&streamType={role}"  # the form the live unit uses, when the caps name nothing
        raise ApiError(409, "nvr_not_supported", "הזרם המבוקש אינו קיים.", details={"role": role})

    def snapshot(self, source_ref: str) -> bytes:
        """One JPEG of the channel (GetSnapshot). The device's Content-Type is often application/octet-stream (Postman
        example), so the JPEG signature decides."""
        if not str(source_ref).isdigit():
            raise ApiError(422, "value_not_allowed", "הערך אינו מותר.", details={"field": "source_ref"})
        data, _ctype = self._call("GetSnapshot", int(source_ref), max_bytes=SNAPSHOT_MAX_BYTES)
        if not data.startswith(b"\xff\xd8\xff"):
            raise ApiError(503, "snapshot_unavailable", "ה־NVR לא סיפק תמונה לערוץ זה.", retryable=True, details={"op": "snapshot"})
        return data

    # ------------------------------------------------------------------------------------------ status reads

    def storage(self) -> list[dict[str, Any]]:
        return self._xml("GetDiskInfo", None, px.parse_disk_info)

    def record_status(self) -> dict[int, dict[str, Any]]:
        return self._xml("GetRecordStatusInfo", None, px.parse_record_status)

    def ports(self) -> dict[str, Any]:
        return self._xml("GetPortConfig", None, px.parse_port_config)

    def device_time(self) -> dict[str, Any]:
        """The device's wall clock (local, no offset) and POSIX zone string; drift is computed by the caller in the
        recorder's IANA zone (KNOWN_QUIRKS T2: keep the raw string as evidence)."""
        return self._xml("GetDateAndTime", None, px.parse_date_time)

    def alarm_status(self) -> dict[tuple[str, int | None], bool]:
        return self._xml("GetAlarmStatus", None, px.parse_alarm_status)

    def channel_states(self) -> dict[int, bool | None]:
        if self.kind() == "ipc":
            return {1: True}
        return {ch: px.CHANNEL_ONLINE.get(st or "") for ch, st in self._xml("GetChannelList", None, px.parse_channel_list)}

    def poll_events(self, tracker: "AlarmTracker", *, channels: bool = True) -> list[ParsedAlert]:
        """One short-polling round: GetAlarmStatus (+ GetChannelList on an NVR for camera offline / back online), turned
        into edge events by `tracker`. The caller decides the interval (CR-025: 2 s default, never below 1 s)."""
        status = self.alarm_status()
        alerts = tracker.update(status, ipc=self.kind() == "ipc")
        native_offline = any(k in ("chlOfflineAlarm", "videoLossAlarm") for k, _i in status)  # live 1.4.7 reports it in v1
        if channels and self.kind() == "nvr" and not native_offline and not tracker.native_offline:
            alerts += tracker.update_channels(self.channel_states())
        return alerts

    def pull_subscription(self) -> "PullSubscription":
        return PullSubscription(self)


# ---------------------------------------------------------------------------------------------- events

# device alarm element -> the eventType vocabulary `events_ingest.TYPE_MAP` already normalizes (motion / line / field /
# tamper / person / vehicle / io / offline); kinds without a product type keep their own name and become "other".
ALARM_TYPES: dict[str, str] = {
    "motionAlarm": "VMD",
    "tripwireAlarm": "linedetection",
    "perimeterAlarm": "fielddetection",
    "aoiEntryAlarm": "regionEntrance",
    "aoiLeaveAlarm": "regionExiting",
    "ipdAlarm": "intrusion",
    "avdAlarm": "tamperdetection",
    "sceneChange": "tamperdetection",
    "clarityAbnormal": "tamperdetection",
    "colorAbnormal": "tamperdetection",
    "vfdAlarm": "facedetection",
    "vehicleAlarm": "vehicledetection",
    "sensorAlarmIn": "IO",
    # every further smart kind the device may report (owner decision 2026-10-04: as many as the device offers). They keep
    # a vendor-neutral raw type; events_ingest.TYPE_MAP files them as "other" until a product type exists, and the raw kind
    # stays in raw_tags["kind"] for filters.
    "vfdMatchAlarm": "faceMatch",
    "oscAlarm": "objectStatusChange",
    "cpcAlarm": "peopleCounting",
    "cddAlarm": "crowdDensity",
    "passlineAlarm": "lineCounting",
    "trafficAlarm": "areaCounting",
    "pvdAlarm": "illegalParking",
    "loiteringAlarm": "loitering",
    "asdAlarm": "audioException",
    "crowdGatheringAlarm": "crowdGathering",
    "fireAlarm": "fire",
    "temperatureAlarm": "temperature",
    "soundAbruptUpAlarm": "audioException",
    "soundAbruptDownAlarm": "audioException",
    "chlOfflineAlarm": "IPCDisconnect",
    "videoLossAlarm": "IPCDisconnect",
}
INPUT_KINDS = {"sensorAlarmIn"}  # ids are alarm-input numbers, not channels (guide 5.3.1 tip)

# GetDeviceInfo / GetDeviceDetail support flag (lower-case) -> the alarm-status kind it produces
SMART_FLAGS: dict[str, str] = {
    "supportpea": "tripwireAlarm", "supporttripwire": "tripwireAlarm", "supportperimeter": "perimeterAlarm",
    "supportosc": "oscAlarm", "supportavd": "avdAlarm", "supportvfd": "vfdAlarm", "supportvfdmatch": "vfdMatchAlarm",
    "supportcpc": "cpcAlarm", "supportcdd": "cddAlarm", "supportipd": "ipdAlarm", "supportvehice": "vehicleAlarm",
    "supportvehicle": "vehicleAlarm", "supportaoientry": "aoiEntryAlarm", "supportaoileave": "aoiLeaveAlarm",
    "supportpasslinecount": "passlineAlarm", "supporttraffic": "trafficAlarm", "supportpvd": "pvdAlarm",
    "supportloitering": "loiteringAlarm", "supportasd": "asdAlarm",
}
# alarm kind -> long-polling smartType (v1 guide), for a subscription built from what the device offers
SUBSCRIBE_KIND: dict[str, str] = {
    "motionAlarm": "MOTION", "sensorAlarmIn": "SENSOR", "tripwireAlarm": "PEA", "perimeterAlarm": "PEA", "avdAlarm": "AVD",
    "oscAlarm": "OSC", "cpcAlarm": "CPC", "cddAlarm": "CDD", "ipdAlarm": "IPD", "vfdAlarm": "VFD", "vfdMatchAlarm": "VFD_MATCH",
    "vehicleAlarm": "VEHICLE", "aoiEntryAlarm": "AOIENTRY", "aoiLeaveAlarm": "AOILEAVE", "passlineAlarm": "PASSLINECOUNT",
    "trafficAlarm": "TRAFFIC",
}


class AlarmTracker:
    """Edge detector over successive alarm-status reads (levels -> active / inactive events). The first read reports what
    is active now and nothing inactive; a kind that disappears from a later read is inactive (v2 firmware reports only the
    alarms that are on). Thread-unsafe by design: one tracker per recorder poll loop."""

    def __init__(self) -> None:
        self._last: dict[tuple[str, int | None], bool] = {}
        self.native_offline = False  # the device has reported chlOfflineAlarm at least once
        self._channels: dict[int, bool | None] = {}
        self._primed = False

    def active(self) -> list[tuple[str, int | None]]:
        return [k for k, v in self._last.items() if v]

    def update(self, status: dict[tuple[str, int | None], bool], *, ipc: bool = False, device_time: str = "") -> list[ParsedAlert]:
        out: list[ParsedAlert] = []
        if any(k in ("chlOfflineAlarm", "videoLossAlarm") for k, _i in status):
            self.native_offline = True
        keys = set(status) | {k for k, v in self._last.items() if v}
        for key in sorted(keys, key=lambda k: (k[0], k[1] if k[1] is not None else -1)):
            now = bool(status.get(key, False))
            was = bool(self._last.get(key, False))
            if now == was:
                continue
            if not now and not self._primed:
                continue
            out.append(self._alert(key, now, ipc, device_time))
        self._last = {k: v for k, v in status.items() if v}
        self._primed = True
        return out

    def update_channels(self, states: dict[int, bool | None]) -> list[ParsedAlert]:
        """Camera behind an NVR channel went offline / came back (GetChannelList status). `ipcdisconnect` is used rather
        than `videoloss` because the Hikvision ingest treats `videoloss/inactive` as its heartbeat."""
        out: list[ParsedAlert] = []
        for ch, online in sorted(states.items()):
            before = self._channels.get(ch)
            if online is None or online == before:
                continue
            if before is None and online:
                continue  # first sighting of an online channel is not an event (an offline one is: it is offline now)
            out.append(ParsedAlert(raw_type="IPCDisconnect", state="inactive" if online else "active", channel=ch, dyn_channel=None,
                                   device_time="", description="channel offline" if not online else "channel online", target="",
                                   active_post_count=0, raw_tags={"vendor": VENDOR, "kind": "channelStatus"}))
        self._channels = {**self._channels, **{ch: v for ch, v in states.items() if v is not None}}
        return out

    @staticmethod
    def _alert(key: tuple[str, int | None], active: bool, ipc: bool, device_time: str) -> ParsedAlert:
        kind, ident = key
        raw = ALARM_TYPES.get(kind, kind)
        if kind in INPUT_KINDS:
            channel = None
        else:
            channel = ident if ident is not None else (1 if ipc else None)
        tags = {"vendor": VENDOR, "kind": kind}
        if kind in INPUT_KINDS and ident is not None:
            tags["input"] = str(ident)
        return ParsedAlert(raw_type=raw, state="active" if active else "inactive", channel=channel, dyn_channel=None,
                           device_time=device_time, description=kind, target="", active_post_count=0, raw_tags=tags)


SUBSCRIBE_TYPES = ("MOTION", "SENSOR", "PEA", "AVD", "OSC", "IPD", "VFD", "VEHICLE", "AOIENTRY", "AOILEAVE")


def subscribe_document(init_term_s: int = 60, types: tuple[str, ...] = SUBSCRIBE_TYPES) -> str:
    """SetSubscribe body: REALTIME_SUBSCRIBE (the client pulls), relation ALARM (status only, no feature images)."""
    items = "".join(f"<item><smartType>{t}</smartType><subscribeRelation>ALARM</subscribeRelation></item>" for t in types)
    return ('<?xml version="1.0" encoding="UTF-8"?><config version="1.0" xmlns="http://www.ipc.com/ver10">'
            f"<channelID>1</channelID><initTermTime>{int(init_term_s)}</initTermTime>"
            f"<subscribeFlag>REALTIME_SUBSCRIBE</subscribeFlag><subscribeList type=\"list\" count=\"{len(types)}\">{items}</subscribeList></config>")


def _address_document(address: str, extra: str = "") -> str:
    safe = address.replace("]]>", "")
    return ('<?xml version="1.0" encoding="UTF-8"?><config version="1.0" xmlns="http://www.ipc.com/ver10">'
            f"<serverAddress><![CDATA[{safe}]]></serverAddress>{extra}</config>")


class PullSubscription:
    """EXPERIMENTAL long-polling session (v1 long-polling guide, REALTIME_SUBSCRIBE) on the device's `longPollingPort`.
    The device ends the subscription when the TCP connection drops and expects SetSubscribe within 10 s of connecting,
    so one `httpx.Client` (one keep-alive connection) carries the whole session. Documented for IP cameras only; an NVR
    is served by `poll_events` (short polling). Never run against a real unit yet (CR-025 live-validation list)."""

    def __init__(self, adapter: ProvisionIsrAdapter, *, port: int | None = None, pull_timeout_s: int = 20) -> None:
        self._a = adapter
        self._port = port
        self.pull_timeout_s = max(1, min(int(pull_timeout_s), 60))
        self._client: httpx.Client | None = None
        self.address: str | None = None
        self.termination_time: int | None = None
        self.tracker = AlarmTracker()

    def _resolve_port(self) -> int:
        port = self._port or self._a._extra.get("long_polling_port")
        if not port:
            ports = self._a.ports()
            if ports.get("long_polling_enabled") is False:
                raise ApiError(409, "nvr_not_supported", "שירות ה־Long Polling כבוי ב־NVR.", details={"op": "subscribe"})
            port = ports.get("long_polling")
        if not port:
            raise ApiError(409, "nvr_not_supported", "ה־NVR אינו מפרסם פורט Long Polling.", details={"op": "subscribe"})
        return int(port)

    def open(self, init_term_s: int = 60) -> dict[str, Any]:
        port = self._resolve_port()
        auth = self._a._auth()
        self._client = self._a._client(timeout=self.pull_timeout_s + 10.0, auth=auth, port=port)
        data, _ = self._a._call("SetSubscribe", body=subscribe_document(init_term_s, self._a.subscribe_types()), client=self._client, allowed=EVENT_SESSION_COMMANDS)
        try:
            sub = px.parse_subscribe(data)
        except ET.ParseError as exc:
            self.close()
            raise _invalid("SetSubscribe", exc) from exc
        self.address, self.termination_time = sub["server_address"], sub["termination_time"]
        return sub

    def pull(self, message_limit: int = 10) -> list[ParsedAlert]:
        if not self._client or not self.address:
            raise ApiError(409, "conflict", "אין מנוי פעיל.", details={"op": "GetPullMessages"})
        body = _address_document(self.address, f"<timeout>{self.pull_timeout_s}</timeout><messageLimit>{max(1, min(int(message_limit), 30))}</messageLimit>")
        data, _ = self._a._call("GetPullMessages", body=body, client=self._client, allowed=EVENT_SESSION_COMMANDS)
        try:
            got = px.parse_pull_messages(data)
        except ET.ParseError as exc:
            raise _invalid("GetPullMessages", exc) from exc
        self.termination_time = got["termination_time"] or self.termination_time
        ipc = self._a.kind() == "ipc"
        alerts: list[ParsedAlert] = []
        for m in got["messages"]:
            alerts += self.tracker.update(m["status"], ipc=ipc, device_time=m["data_time"] or "")
        return alerts

    def renew(self, seconds: int = 60) -> None:
        if not self._client or not self.address:
            raise ApiError(409, "conflict", "אין מנוי פעיל.", details={"op": "SetRenew"})
        data, _ = self._a._call("SetRenew", body=_address_document(self.address, f"<renewTime>{int(seconds)}</renewTime>"),
                                client=self._client, allowed=EVENT_SESSION_COMMANDS)
        try:
            self.termination_time = px.to_int(px.text(px.parse(data), "terminationTime")) or self.termination_time
        except ET.ParseError:
            pass

    def close(self) -> None:
        """SetUnSubscribe (best-effort) and drop the connection (which ends the subscription anyway)."""
        if self._client is not None:
            try:
                if self.address:
                    self._a._call("SetUnSubscribe", body=_address_document(self.address), client=self._client, allowed=EVENT_SESSION_COMMANDS)
            except ApiError:
                pass
            finally:
                self._client.close()
        self._client, self.address = None, None


# ---------------------------------------------------------------------------------------------- registration (CR-024 seam)

def register(*, selectable: bool = False) -> Callable[[], None] | None:
    """Register the adapter and its connection-form spec through CR-024's `registry.register_vendor` when that seam exists
    (branch pilot/multi-nvr). Returns the undo function, or None on a registry without the seam (g0/intake today), where
    nothing is changed. `selectable=False` keeps Provision-ISR "coming soon" (CR-022 D1) until the owner's unit is
    validated; the extra fields map to `recorder_connections` extras (`nvr_extra`)."""
    from . import registry

    reg = getattr(registry, "register_vendor", None)
    if reg is None:
        return None
    base = tuple(getattr(registry, "_NETWORK_FIELDS", ()))
    VF = registry.VendorField
    def sel(key: str, label: str, options: tuple[tuple[str, str], ...], advanced: bool = False) -> Any:
        try:
            return VF(key, label, "select", False, options=options, advanced=advanced)
        except TypeError:  # a registry without select fields: plain text
            return VF(key, label, "text", False)

    def adv(key: str, label: str, kind: str) -> Any:
        try:
            return VF(key, label, kind, False, advanced=True)
        except TypeError:
            return VF(key, label, kind, False)

    extra = (
        sel("scheme", "חיבור", (("https", "HTTPS (מוצפן)"), ("http", "HTTP"))),
        VF("https_port", "פורט HTTPS", "port", False),
        sel("tls_mode", "תעודת HTTPS", (("pin", "נעיצת תעודת המכשיר"), ("verify", "אימות רגיל"), ("trust", "לסמוך על כל תעודה"))),
        adv("tls_pin", "טביעת אצבע של התעודה (SHA-256)", "text"),
        sel("auth", "שיטת אימות", (("", "אוטומטי"), ("basic", "Basic"), ("digest", "Digest"))),
        sel("event_mode", "אירועים", (("poll", "דגימה כל 2 שניות"), ("push", "דחיפה מהמכשיר"))),
        sel("time_basis", "זמני ההקלטות", (("device", "לפי שעון המכשיר"), ("iana", "תמיד שעון ישראל"))),
        adv("poll_interval_s", "מרווח דגימה (שניות)", "text"),
        adv("push_port", "פורט קבלת דחיפות", "port"),
        adv("push_advertise_host", "כתובת התוסף כפי שה־NVR רואה אותה", "text"),
        adv("push_advertise_port", "פורט התוסף כפי שה־NVR רואה אותו", "port"),
        sel("push_auth", "אימות דחיפות", (("token", "מפתח בנתיב"), ("address", "לפי כתובת המכשיר"), ("token_and_address", "מפתח וכתובת")), advanced=True),
        sel("rtsp_style", "כתובת RTSP", (("", "לפי המכשיר"), ("path", "/chID=…"), ("query", "?chID=…")), advanced=True),
        sel("go2rtc_source", "חיבור go2rtc לווידאו", (("ffmpeg", "דרך ffmpeg (מומלץ למכשיר הזה)"), ("rtsp", "RTSP ישיר")), advanced=True),
        adv("suppress_insecure_warning", "להסתיר את אזהרת החיבור הלא מוצפן", "bool"),
        adv("suppress_tls_warning", "להסתיר את אזהרת התעודה", "bool"),
    )
    spec = registry.VendorSpec(VENDOR, "Provision-ISR", "available" if selectable else "planned", {"http_port": 80, "rtsp_port": 554}, base + extra)
    return reg(spec, ProvisionIsrAdapter)


def peer_certificate(host: str, port: int, timeout: float) -> dict[str, Any]:
    """One TLS handshake without verification (no HTTP request, no credentials): the certificate's SHA-256 (hex) and whether
    it is self-signed. Used to record a pin at the connection test and to check it before every client."""
    import socket
    import ssl

    ctx = ssl.create_default_context()
    ctx.check_hostname = False
    ctx.verify_mode = ssl.CERT_NONE
    with socket.create_connection((host, port), timeout=timeout) as sock, ctx.wrap_socket(sock, server_hostname=host) as tls:
        der = tls.getpeercert(binary_form=True) or b""
    self_signed: bool | None = None
    try:
        from cryptography import x509

        cert = x509.load_der_x509_certificate(der)
        self_signed = cert.issuer == cert.subject
    except Exception:  # noqa: BLE001 - optional detail
        pass
    return {"sha256": hashlib.sha256(der).hexdigest(), "self_signed": self_signed}


PEER_CERTIFICATE = peer_certificate  # tests replace this (no sockets)
