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
from . import provision_isr_xml as px
from .base import ChannelInfo, RecorderCapabilities, RecorderHealth, StreamEncoding, StreamOptions, StreamSnapshot, WriteOutcome

VENDOR = "provision_isr"

# Every command P1 may send. Nothing here changes device state.
READ_COMMANDS = frozenset({
    "GetDeviceInfo", "GetChannelList", "GetDiskInfo", "GetRecordStatusInfo", "GetPortConfig", "GetDateAndTime",
    "GetStreamCaps", "GetVideoStreamConfig", "GetImageOsdConfig", "GetSnapshot", "GetAlarmStatus",
})
# The long-polling session commands: named Set*, but they manage this client's own subscription, not the device's
# configuration (v1 long-polling guide 2.1-2.4).
EVENT_SESSION_COMMANDS = frozenset({"SetSubscribe", "SetRenew", "SetUnSubscribe", "GetPullMessages"})

XML_MAX_BYTES = 2_000_000
SNAPSHOT_MAX_BYTES = 8_000_000
READ_TIMEOUT_S = 8.0
HEALTH_TIMEOUT_S = 4.0
AUTH_TTL_S = 600.0  # the detected auth scheme is re-probed after this (a firmware change or a device reconfiguration)

REFUSED_BACKOFF_S = 300.0  # after the device refuses the credentials, no further login attempt for this long (lockout guard)

_AUTH: dict[str, tuple[float, str]] = {}  # device_key -> (expires at, "basic" | "digest")
_REFUSED: dict[str, float] = {}  # device_key -> no login attempt before this (monotonic)
_AUTH_LOCK = threading.Lock()
_monotonic = time.monotonic


def clear_auth_cache() -> None:
    with _AUTH_LOCK:
        _AUTH.clear()
        _REFUSED.clear()


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
        (the password crosses the network in base64 on every request)."""
        auth = self._cached_auth()
        return {"scheme": self.scheme, "auth": auth, "insecure": self.scheme == "http" and auth == "basic"}

    def _base_url(self, port: int | None = None) -> str:
        if self.scheme == "https":
            port = port or int(self._extra.get("https_port") or 443)
        else:
            port = port or self._settings.nvr_http_port
        return f"{self.scheme}://{self._settings.nvr_host}:{port}"

    def _verify(self) -> Any:
        if self.scheme == "https" and self._extra.get("tls_verify") is False:
            return False
        return nvr._ssl_context()

    def _client(self, timeout: float = READ_TIMEOUT_S, auth: httpx.Auth | None = None, port: int | None = None) -> httpx.Client:
        from ...mode import ensure_nvr

        ensure_nvr(self._settings)  # NVR-less mode: 409 nvr_not_configured
        s = self._settings
        if not s.nvr_host or not s.nvr_user or not s.nvr_password:
            raise ApiError(503, "source_not_configured", "פרטי ה־NVR לא הוגדרו.")
        kwargs: dict[str, Any] = {"base_url": self._base_url(port), "timeout": timeout, "verify": self._verify()}
        if auth is not None:
            kwargs["auth"] = auth
        if self._transport is not None:
            kwargs["transport"] = self._transport
        return httpx.Client(**kwargs)

    def _cached_auth(self) -> str | None:
        forced = str(self._extra.get("auth") or "").lower()
        if forced in ("basic", "digest"):
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
        challenge = r.headers.get("www-authenticate", "").strip().lower()
        scheme = "digest" if challenge.startswith("digest") else "basic"
        with _AUTH_LOCK:
            _AUTH[self.device_key] = (_monotonic() + AUTH_TTL_S, scheme)
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
        scheme = self._detect_auth()
        return httpx.DigestAuth(s.nvr_user or "", s.nvr_password or "") if scheme == "digest" else httpx.BasicAuth(s.nvr_user or "", s.nvr_password or "")

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

    def capabilities(self) -> RecorderCapabilities:
        return RecorderCapabilities(
            vendor=self.vendor, read_encodings=True, write_encodings=False, encoding_fields=frozenset(px.ENCODING_FIELDS),
            add_channel=False, remove_channel=False, max_channels=(self._info or {}).get("chl_max_count"),
            live="rtsp", playback="none", events="poll",
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
        for ch, status in self._xml("GetChannelList", None, px.parse_channel_list):
            online = px.CHANNEL_ONLINE.get(status or "")
            out.append(ChannelInfo(source_ref=str(ch), channel=ch, name=(self._channel_name(ch) if online is not False else None) or f"ערוץ {ch}", online=online))
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
        enc = {k: v for k, v in s.items() if k not in ("stream_ref", "stream_id", "channel", "role", "fields", "etag", "element", "limits", "name")}
        return StreamEncoding(stream_ref=s["stream_ref"], role=s["role"], enabled=True, encoding=enc, fields=s["fields"], etag=s["etag"])

    def _find_stream(self, ref: str) -> tuple[int, dict[str, Any]]:
        try:
            ch, sid = px.split_stream_ref(ref)
        except ValueError as exc:
            raise ApiError(422, "value_not_allowed", "הערך אינו מותר.", details={"field": "stream_ref"}) from exc
        for s in self._streams(ch):
            if s["stream_id"] == sid:
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
        """What the device lists for one stream (GetStreamCaps + the stream's own bitrate list and bounds). Never writable
        in P1: the write path (SetVideoStreamConfig) is P2, behind the CR-020 approval gates."""
        ch, s = self._find_stream(stream_ref)
        caps = self.stream_caps(ch).get("streams", {}).get(s["stream_id"], {})
        options = {
            "codec": caps.get("codecs") or s["limits"]["codecs"],
            "profile": caps.get("profiles") or [],
            "resolution": [r["resolution"] for r in caps.get("resolutions", [])],
            "max_fps": {r["resolution"]: r["max_fps"] for r in caps.get("resolutions", []) if r.get("max_fps")},
            "bitrate_kbps": s["limits"]["bitrate_list"], "bitrate_bounds": s["limits"]["bitrate"], "gop_bounds": s["limits"]["gop"],
            "bitrate_mode": ["CBR", "VBR"], "quality": ["lowest", "lower", "medium", "higher", "highest"], "source": "stream_caps",
        }
        return StreamOptions(writable=False, reason="read_only_phase", options=options, write_via=None, source="stream_caps")

    def write_stream_encoding(self, stream_ref: str, expect_etag: str, element: str, write_via: str) -> WriteOutcome:
        raise ApiError(409, "nvr_not_supported", "שינוי הגדרות ב־Provision-ISR עדיין אינו זמין.", details={"op": "put", "reason": "read_only_phase"})

    # ------------------------------------------------------------------------------------------ media

    def live_source(self, source_ref: str, role: str) -> str:
        """The server-side RTSP URL go2rtc pulls (credentials inside; never returned to a browser or logged).
        NVR: `rtsp://u:p@host:port?chID=<n>&streamType=main|sub` (guide 3.1.1; `rtsp_style: path` gives
        `.../chID=<n>&streamType=...`, the form the playback URL uses - which one a given firmware accepts is the first item
        of the live validation). IPC: `rtsp://u:p@host:port/<streamName>` with the name from GetStreamCaps."""
        s = self._settings
        if not s.nvr_host or not s.nvr_user or not s.nvr_password:
            raise ApiError(503, "source_not_configured", "פרטי ה־NVR לא הוגדרו.")
        if not str(source_ref).isdigit() or int(source_ref) < 1:
            raise ApiError(422, "value_not_allowed", "הערך אינו מותר.", details={"field": "source_ref"})
        ch = int(source_ref)
        base = f"rtsp://{quote(s.nvr_user, safe='')}:{quote(s.nvr_password, safe='')}@{s.nvr_host}:{s.nvr_rtsp_port}"
        if self.kind() == "ipc":
            sid = {"main": 1, "sub": 2, "third": 3}.get(role)
            name = self.stream_caps(ch).get("streams", {}).get(sid or 0, {}).get("name") if sid else None
            if not name:
                raise ApiError(409, "nvr_not_supported", "הזרם המבוקש אינו קיים במצלמה.", details={"role": role})
            return f"{base}/{name}"
        if role not in ("main", "sub"):
            raise ApiError(409, "nvr_not_supported", "ה־NVR מספק זרם ראשי ומשני בלבד.", details={"role": role})
        query = f"chID={ch}&streamType={role}"
        return f"{base}/{query}" if self._extra.get("rtsp_style") == "path" else f"{base}?{query}"

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
        alerts = tracker.update(self.alarm_status(), ipc=self.kind() == "ipc")
        if channels and self.kind() == "nvr":
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
}
INPUT_KINDS = {"sensorAlarmIn"}  # ids are alarm-input numbers, not channels (guide 5.3.1 tip)


class AlarmTracker:
    """Edge detector over successive alarm-status reads (levels -> active / inactive events). The first read reports what
    is active now and nothing inactive; a kind that disappears from a later read is inactive (v2 firmware reports only the
    alarms that are on). Thread-unsafe by design: one tracker per recorder poll loop."""

    def __init__(self) -> None:
        self._last: dict[tuple[str, int | None], bool] = {}
        self._channels: dict[int, bool | None] = {}
        self._primed = False

    def update(self, status: dict[tuple[str, int | None], bool], *, ipc: bool = False, device_time: str = "") -> list[ParsedAlert]:
        out: list[ParsedAlert] = []
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
        data, _ = self._a._call("SetSubscribe", body=subscribe_document(init_term_s), client=self._client, allowed=EVENT_SESSION_COMMANDS)
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
