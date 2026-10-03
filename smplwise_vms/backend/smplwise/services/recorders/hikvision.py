"""The Hikvision adapter (CR-020): a thin wrapper over the proven ISAPI code in `services/nvr.py`.

S1 reads. S2 adds the ONE device write of this adapter: `PUT` of one stream's `<StreamingChannel>` element (its encoding),
on `/ISAPI/Streaming/channels/{sid}` or - when only the proxy capability document answers - on
`/ISAPI/ContentMgmt/StreamingProxy/channels/{sid}`. Rules kept here (ADP section 1, API sections 4-5):
- never receives a SQLite connection; the service calls it inside `with unlocked(conn):` and records everything itself;
- capability discovery, never guesses: no capability document (404 / 403 on both paths) = not writable;
- every read of the stream is the LIST (the lab firmware's single-stream GET lacks <SVC>);
- a device command is never retried, and an answer that leaves the device state unknown says so (`outcome: unknown`);
- no address, user name, password, serial number or MAC in any error detail.
"""
from __future__ import annotations

import threading
import time
import xml.etree.ElementTree as ET

import httpx

from ...config import Settings
from ...errors import ApiError
from .. import nvr
from ..nvr_write import response_status
from .base import ChannelInfo, RecorderCapabilities, RecorderHealth, StreamEncoding, StreamOptions, StreamSnapshot, WriteOutcome

WRITE_PATHS = {"direct": "/ISAPI/Streaming/channels/{sid}", "proxy": "/ISAPI/ContentMgmt/StreamingProxy/channels/{sid}"}
CAPS_PATHS = (("direct", "/ISAPI/Streaming/channels/{sid}/capabilities", "capabilities"),
              ("proxy", "/ISAPI/ContentMgmt/StreamingProxy/channels/{sid}/capabilities", "proxy_capabilities"))
DYNAMIC_CAP_PATH = "/ISAPI/Streaming/channels/{sid}/dynamicCap"
REFUSED_CODES = ("stale", "nvr_busy", "nvr_not_supported", "nvr_rejected")
# Review M2: how long the stream PUT waits for the device's answer. An encoder restart can take the NVR many seconds; an
# answer that never comes is an unknown outcome (the service waits UNKNOWN_SETTLE_MIN_S before settling it from a read).
PUT_READ_TIMEOUT_S = 25.0
# Review L1: capability discovery is cached per process by recorder + stream + codec. A positive answer is re-read after
# OPTIONS_TTL_S (a firmware upgrade can change it), a negative one (403 / 404 on both paths) after NEGATIVE_TTL_S, and a
# change the device applied drops the stream's entries (forget_options). A hit makes no device call at all.
OPTIONS_TTL_S = 600.0
NEGATIVE_TTL_S = 60.0

_OPTIONS: dict[tuple[str, str, str], tuple[float, StreamOptions]] = {}  # (recorder, stream, codec or "") -> (expires at, options)
_OPTIONS_LOCK = threading.Lock()
_monotonic = time.monotonic  # tests move this clock


def clear_options_cache() -> None:
    with _OPTIONS_LOCK:
        _OPTIONS.clear()


def _unavailable(op: str, exc: Exception, *, outcome: str | None = None) -> ApiError:
    """A device that did not answer. With `outcome="unknown"` (the PUT may have been applied) the error is NOT retryable:
    the next write of the stream waits for the pending change to be settled from a read (review M2)."""
    details: dict[str, object] = {"op": op, "error": type(exc).__name__}
    if outcome:
        details["outcome"] = outcome
    return ApiError(503, "source_unavailable", "ה־NVR אינו זמין כרגע.", retryable=outcome is None, details=details)


def _outcome_unknown(op: str, exc: ApiError) -> ApiError:
    """After an accepted PUT the verify read failed (any error, a missing stream included): the device state is unknown."""
    return ApiError(503, "source_unavailable", "ה־NVR קיבל את השינוי אבל לא ניתן לאמת אותו. המצב ייבדק מחדש.", retryable=False,
                    details={"op": op, "cause": exc.code, "outcome": "unknown"})


def put_result(status: int, text: str) -> tuple[str, bool]:
    """(device_status, reboot_required) for an accepted PUT; an ApiError for every other answer (API 5.2)."""
    code, sub = response_status(text or "")
    sub_s = (sub or "")[:64] or None
    if status == 401:
        raise ApiError(503, "source_forbidden", "ה־NVR דחה את הכתיבה (הרשאות המשתמש ב־NVR).", details={"op": "put", "status": status})
    if code == 2 or sub_s == "deviceBusy":
        raise ApiError(409, "nvr_busy", "ה־NVR עסוק כרגע ולא ביצע את השינוי. אפשר לנסות שוב מאוחר יותר.", retryable=True, details={"op": "put", "code": code, "sub": sub_s})
    if status == 403:
        if sub_s == "notSupport":
            raise ApiError(409, "nvr_not_supported", "ה־NVR אינו תומך בשינוי הזה בזרם הזה.", details={"op": "put", "sub": sub_s})
        raise ApiError(503, "source_forbidden", "ה־NVR דחה את הכתיבה (הרשאות המשתמש ב־NVR).", details={"op": "put", "status": status, "sub": sub_s})
    if status >= 500 and code not in (3, 4, 5, 6):
        # a server error without a refusal code says nothing about what the device did: treat the outcome as unknown
        raise ApiError(503, "source_unavailable", "ה־NVR החזיר שגיאה; לא ידוע אם השינוי בוצע. המצב ייבדק מחדש.", retryable=False,  # never retryable (M2)
                       details={"op": "put", "status": status, "outcome": "unknown"})
    if status == 200 and code == 7:
        return "7", True
    if status == 200 and code in (1, None):
        return "1", False
    raise ApiError(409, "nvr_rejected", "ה־NVR דחה את המסמך.", details={"op": "put", "status": status, "code": code, "sub": sub_s})


class HikvisionAdapter:
    vendor = "hikvision"

    def __init__(self, recorder_id: str, settings: Settings) -> None:
        self.recorder_id = recorder_id
        self._settings = settings

    def capabilities(self) -> RecorderCapabilities:
        # S2: one stream's encoding is writable (guarded path); add / remove a channel stay false until S3.
        return RecorderCapabilities(
            vendor=self.vendor, read_encodings=True, write_encodings=True, encoding_fields=frozenset(nvr.ENCODING_FIELDS),
            add_channel=False, remove_channel=False, max_channels=None, live="rtsp", playback="rtsp", events="push",
        )

    def health(self) -> RecorderHealth:
        try:
            info = nvr.device_info(self._settings)
        except ApiError as exc:
            if exc.code == "nvr_not_configured":
                raise
            return RecorderHealth(online=False, model=None, firmware=None, error=exc.code)
        return RecorderHealth(online=True, model=info.get("model") or None, firmware=info.get("firmware") or None, error=None)

    def list_channels(self) -> list[ChannelInfo]:
        return [ChannelInfo(source_ref=str(c.channel), channel=c.channel, name=c.name, online=c.online) for c in nvr.discover_channels(self._settings)]

    def read_stream_encodings(self) -> dict[str, list[StreamEncoding]]:
        xml = nvr.fetch_streaming_document(self._settings)
        try:
            parsed = nvr.parse_streaming_channels_all(xml)
        except ET.ParseError as exc:  # incl. a DOCTYPE (xmlsafe.UnsafeXml): a device answer that is not a streaming list
            raise ApiError(503, "source_invalid", "תשובת ה־NVR אינה מסמך זרמים תקין.", details={"op": "streaming", "error": type(exc).__name__}) from exc
        out: dict[str, list[StreamEncoding]] = {}
        for s in parsed:
            enc = {k: v for k, v in s.items() if k not in ("stream_ref", "channel", "role", "enabled", "fields", "etag")}
            out.setdefault(str(s["channel"]), []).append(StreamEncoding(
                stream_ref=str(s["stream_ref"]), role=s["role"], enabled=s["enabled"], encoding=enc, fields=s["fields"], etag=str(s["etag"]),  # type: ignore[arg-type]
            ))
        return out

    # ------------------------------------------------------------------------------------------ S2: one stream

    def cached_options(self, stream_ref: str) -> StreamOptions | None:
        """The options already discovered for this stream (not expired), without a device call."""
        with _OPTIONS_LOCK:
            hit = _OPTIONS.get((self.recorder_id, stream_ref, ""))
        return hit[1] if hit is not None and hit[0] > _monotonic() else None

    def forget_options(self, stream_ref: str) -> None:
        """Drop every cached discovery of this stream (all codecs): the device changed it (review L1)."""
        with _OPTIONS_LOCK:
            for key in [k for k in _OPTIONS if k[0] == self.recorder_id and k[1] == stream_ref]:
                del _OPTIONS[key]

    def _snapshot(self, client: httpx.Client, stream_ref: str, op: str = "read") -> StreamSnapshot:
        try:
            xml = nvr._get_capped(client, "/ISAPI/Streaming/channels", nvr.STREAMING_DOC_MAX_BYTES)
        except ApiError as exc:
            exc.details = {**{k: v for k, v in exc.details.items() if k != "path"}, "op": op}
            raise
        element = nvr.slice_stream_element(xml, stream_ref)
        if element is None:
            raise ApiError(404, "not_found", "הזרם לא נמצא ב־NVR.", details={"stream_ref": stream_ref})
        try:
            parsed = nvr.parse_stream_element(element)
        except ET.ParseError as exc:
            raise ApiError(503, "source_invalid", "תשובת ה־NVR אינה מסמך זרם תקין.", details={"op": op, "error": type(exc).__name__}) from exc
        return StreamSnapshot(stream_ref=stream_ref, element=element, etag=str(parsed["etag"]), parsed=parsed)

    def read_stream(self, stream_ref: str) -> StreamSnapshot:
        with nvr._client(self._settings) as client:
            return self._snapshot(client, stream_ref)

    @staticmethod
    def _probe(client: httpx.Client, path: str) -> tuple[int, str]:
        """A bounded read-only GET that answers its status instead of raising for 403 / 404 (capability discovery)."""
        try:
            with client.stream("GET", path) as r:
                body = bytearray()
                for chunk in r.iter_bytes(64 * 1024):
                    body.extend(chunk)
                    if len(body) > nvr.CAPS_DOC_MAX_BYTES:
                        raise ApiError(503, "source_too_large", "תשובת ה־NVR גדולה מהצפוי.", details={"op": "capabilities"})
                return r.status_code, bytes(body).decode(r.encoding or "utf-8", "replace")
        except httpx.HTTPError as exc:
            raise _unavailable("capabilities", exc) from exc

    def stream_options(self, stream_ref: str, codec: str | None = None) -> StreamOptions:
        if codec is not None and not nvr.SAFE_TOKEN.match(codec):
            raise ApiError(422, "value_not_allowed", "הערך אינו מותר.", details={"field": "codec"})
        key = (self.recorder_id, stream_ref, codec or "")
        with _OPTIONS_LOCK:
            hit = _OPTIONS.get(key)
        if hit is not None and hit[0] > _monotonic():  # a hit: no device call at all
            return hit[1]
        with nvr._client(self._settings) as client:
            result: StreamOptions | None = None
            last = "capabilities_unreadable"
            for via, template, source in CAPS_PATHS:
                status, text = self._probe(client, template.format(sid=stream_ref))
                if status == 200:
                    try:
                        options = nvr.parse_stream_capabilities(text, codec)
                    except ET.ParseError:
                        last = "capabilities_invalid"
                        continue
                    if codec is not None:
                        dyn_status, dyn_text = self._probe(client, DYNAMIC_CAP_PATH.format(sid=stream_ref) + f"?videoCodecType={codec}")
                        if dyn_status == 200:
                            try:
                                found = nvr.parse_dynamic_resolutions(dyn_text)
                            except ET.ParseError:
                                found = []
                            if found:
                                options["resolution"] = {**options["resolution"], codec: found}  # type: ignore[dict-item]
                    options["source"] = source
                    result = StreamOptions(writable=True, reason=None, options=options, write_via=via, source=source)  # type: ignore[arg-type]
                    break
                if status in (403, 404):
                    _code, sub = response_status(text or "")
                    last = (sub or f"http_{status}")[:32]
                    continue
                raise ApiError(503, "source_error", "ה־NVR החזיר שגיאה.", retryable=True, details={"op": "capabilities", "status": status})
            if result is None:
                result = StreamOptions(writable=False, reason=last, options=None, write_via=None, source=None)
            with _OPTIONS_LOCK:
                _OPTIONS[key] = (_monotonic() + (OPTIONS_TTL_S if result.writable else NEGATIVE_TTL_S), result)
            return result

    def write_stream_encoding(self, stream_ref: str, expect_etag: str, element: str, write_via: str) -> WriteOutcome:
        if write_via not in WRITE_PATHS:
            raise ApiError(409, "nvr_not_supported", "ה־NVR אינו תומך בשינוי הזה בזרם הזה.", details={"op": "put"})
        path = WRITE_PATHS[write_via].format(sid=stream_ref)
        with nvr._client(self._settings) as client:
            before = self._snapshot(client, stream_ref, "pre_put")
            if before.etag != expect_etag:
                raise ApiError(409, "stale", "ההגדרות השתנו ב־NVR. נטען מחדש.", details={"op": "pre_put", "etag": before.etag})
            body = '<?xml version="1.0" encoding="UTF-8"?>' + element
            try:
                r = client.put(path, content=body.encode("utf-8"), headers={"Content-Type": "application/xml"},
                               timeout=httpx.Timeout(8.0, read=PUT_READ_TIMEOUT_S))
            except httpx.HTTPError as exc:  # sent or not, the device may have applied it: the janitor reads and settles
                raise _unavailable("put", exc, outcome="unknown") from exc
            device_status, reboot = put_result(r.status_code, r.text)
            try:
                verified = self._snapshot(client, stream_ref, "verify")
            except ApiError as exc:
                raise _outcome_unknown("verify", exc) from exc
        return WriteOutcome(device_status=device_status, reboot_required=reboot, verified=verified)
