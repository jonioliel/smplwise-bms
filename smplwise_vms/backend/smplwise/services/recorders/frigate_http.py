"""The only code that talks HTTP to a Frigate server (NN5 phase F1, docs/changes/CR-029-FRIGATE-PROVIDER.md).

Frigate 0.18 in one paragraph: the authenticated port (8971, TLS with a self-signed certificate by default) takes
`POST /api/login {"user","password"}` and answers a JWT cookie `frigate_token` (24 h). Everything else this phase uses is a
GET under `/api/...`, `/vod/...` or `/clips/...`. A viewer account is enough; the adapter never creates one.

F1 is READ-ONLY toward Frigate; F2 adds `FrigateHttp.write` with its own, separate allow-list (`WRITE_ALLOWED`, one class per unit of
approval) and never widens `GET_ALLOWED` into a write. The read paths below stay read-only. The traffic this module may send is exactly: one login POST per session and GETs whose path
matches `GET_ALLOWED`. Every other path is refused locally before a byte is sent (`frigate_path_not_allowed`), as Provision's
`READ_COMMANDS`. Two routes the study measured as dangerous are not on the list: `/api/events/summary` (14 MB unfiltered) and
the export family (`/api/export...`, a write). The `clip.mp4` GETs are read-only and on the list since finding H2 of the
supervised verification; they are fetched only through `open_stream` (streamed, size and time capped).

Rules kept from the other adapters (ADP section 1): device I/O only (no SQLite, no audit, no permission decisions),
synchronous and bounded (the `nvr.deadline` contract applies), errors are `ApiError` with the shared codes, and no address,
user name, password, token or stream URL in any error detail or log line. The JWT lives in memory only.
"""
from __future__ import annotations

import hashlib
import json
import re
import threading
import time
from dataclasses import dataclass
from typing import Any
from urllib.parse import quote

import httpx

from ...config import Settings
from ...errors import ApiError
from .. import nvr

VENDOR = "frigate"

CAM = r"[A-Za-z0-9_.-]{1,64}"
ID = r"[0-9]{9,11}(?:\.[0-9]+)?-[A-Za-z0-9]{4,10}"
NUM = r"[0-9]{1,11}(?:\.[0-9]+)?"
# The F1 allow-list. Anchored full-path matches; query strings are validated separately (`_check_query`).
GET_ALLOWED: tuple[re.Pattern[str], ...] = tuple(re.compile(p) for p in (
    r"/api/version",
    r"/api/stats",
    r"/api/config",
    r"/api/openapi\.json",
    r"/api/go2rtc/streams",
    r"/api/labels",
    r"/api/sub_labels",
    r"/api/profile",
    r"/api/profiles",                                # F2: read before / after a profile switch
    r"/api/profile/active",
    r"/api/events",                                  # always with a window and a limit (see WINDOWED)
    rf"/api/events/{ID}",
    rf"/api/events/{ID}/thumbnail\.jpg",
    rf"/api/events/{ID}/snapshot\.jpg",
    r"/api/review",                                  # always with a window and a limit
    rf"/api/review/{ID}",
    r"/api/review/summary",
    r"/api/review/activity/motion",
    rf"/api/{CAM}/recordings",
    rf"/api/{CAM}/recordings/summary",
    r"/api/recordings/storage",
    rf"/api/{CAM}/latest\.jpg",
    rf"/api/{CAM}/recordings/{NUM}/snapshot\.jpg",
    rf"/clips/review/thumb-{CAM}-{ID}\.webp",
    rf"/vod/{CAM}/start/{NUM}/end/{NUM}/index\.m3u8",
    rf"/vod/{CAM}/start/{NUM}/end/{NUM}/(?:init-v\d+\.mp4|seg-\d+-v\d+\.m4s)",
    # The clip family, GET only, read through `FrigateHttp.open_stream` (a streamed, size- and time-capped read; `get` would buffer):
    rf"/api/{CAM}/start/{NUM}/end/{NUM}/clip\.mp4",   # the clip of a camera window
    rf"/api/events/{ID}/clip\.mp4",                    # the clip of one event
))
# F2: reads that exist only to support a write class (a camera's PTZ facts). Not on GET_ALLOWED: the F1 read paths are unchanged, and
# these are reachable only with `control=True`, which `recorders/frigate_control.py` alone passes.
CONTROL_GET_ALLOWED: tuple[re.Pattern[str], ...] = (re.compile(rf"/api/{CAM}/ptz/info"),)

# F2 (CR-029): the write allow-list. Every write belongs to ONE class; a class is a unit of approval (frigate_write_policy) and of
# permission (frigate_control_svc.PERMISSION). A path that is not here is refused locally before a byte is sent, exactly like a GET.
# Never listed, on purpose: /api/config/set, /api/config/save, /api/restart, deletes of events / reviews / exports / recordings,
# /api/users*, faces and plates, go2rtc stream edits, `*` as a camera for any feature (only the profile slot takes `*`).
ANALYTICS_FEATURES = ("detect", "motion", "audio", "review_alerts", "review_detections", "notifications", "improve_contrast", "birdseye", "ptz_autotracker")
RECORD_FEATURES = ("enabled", "recordings", "snapshots")
WRITE_ALLOWED: dict[str, tuple[tuple[str, re.Pattern[str]], ...]] = {
    "analytics": (("PUT", re.compile(rf"/api/camera/{CAM}/set/(?:{'|'.join(ANALYTICS_FEATURES)})")),),
    "record": (("PUT", re.compile(rf"/api/camera/{CAM}/set/(?:{'|'.join(RECORD_FEATURES)})")),),
    "profile": (("PUT", re.compile(r"/api/camera/\*/set/profile")),),
    "review": (("POST", re.compile(r"/api/reviews/viewed")), ("DELETE", re.compile(rf"/api/review/{ID}/viewed"))),
    "events": (("POST", re.compile(rf"/api/events/{ID}/retain")), ("DELETE", re.compile(rf"/api/events/{ID}/retain")),
               ("POST", re.compile(rf"/api/events/{ID}/sub_label"))),
}
WRITE_BODY_MAX = 20_000
WRITE_REPLY_MAX = 200_000
WRITE_TIMEOUT_S = 8.0

# Routes that must carry a time window / a limit: an unbounded call returns megabytes (live finding) and loads Frigate's CPU.
WINDOWED = {"/api/events": ("limit",), "/api/review": ("limit",), f"/api/review/activity/motion": ("after", "before")}
QUERY_KEYS = frozenset({"after", "before", "limit", "severity", "reviewed", "cameras", "labels", "zones", "h", "timezone", "camera",
                        "has_clip", "has_snapshot", "include_thumbnails", "bbox", "quality"})
LIMIT_MAX = 500

JSON_MAX_BYTES = 8_000_000
OPENAPI_MAX_BYTES = 3_000_000
IMAGE_MAX_BYTES = 6_000_000
PLAYLIST_MAX_BYTES = 1_000_000
SEGMENT_MAX_BYTES = 24_000_000
READ_TIMEOUT_S = 8.0
CLIP_MAX_BYTES = 150_000_000    # a clip over this is refused (source_too_large), never silently truncated at the start
CLIP_READ_TIMEOUT_S = 20.0      # per network read while streaming; Frigate may need a while to cut the clip before the first byte
CLIP_TOTAL_S = 300.0            # wall-clock cap of one clip transfer
CLIP_TYPE = re.compile(r"^(?:video/[A-Za-z0-9.+-]{1,40}|application/octet-stream)$")
LOGIN_TIMEOUT_S = 8.0
REFUSED_BACKOFF_S = 300.0     # after Frigate refuses the credentials no further login for this long (Frigate rate-limits logins)
TOKEN_TTL_S = 20 * 3600.0     # the cookie is valid 24 h; the adapter renews before that (and on any 401)

_TOKENS: dict[str, tuple[str, float]] = {}   # device_key -> (JWT, obtained at monotonic)
_REFUSED: dict[str, float] = {}              # device_key -> no login before this (monotonic)
_LOCK = threading.Lock()
_LOGIN_LOCKS: dict[str, threading.Lock] = {}
_monotonic = time.monotonic

URL_USERINFO = re.compile(r"(?i)\b([a-z][a-z0-9+.-]*://)[^/@\s\"']+@")
SECRET_KEY = re.compile(r"(?i)(pass(word)?|secret|token|api_?key|auth|credential|user(name)?)$")


def clear_cache() -> None:
    with _LOCK:
        _TOKENS.clear()
        _REFUSED.clear()


class ClipStream:
    """An open, validated, streamed 200 answer. `content_type` / `content_length` are Frigate's (the only headers ever forwarded);
    `chunks()` yields the body with the size and wall-clock caps enforced; `close()` releases the connection. Built by
    `FrigateHttp.open_stream` only."""

    def __init__(self, client: httpx.Client, cm: Any, response: httpx.Response, max_bytes: int, total_s: float) -> None:
        self._client, self._cm, self._r, self._max = client, cm, response, max_bytes
        self._deadline = _monotonic() + total_s
        self.content_type = response.headers.get("content-type", "video/mp4").split(";")[0].strip().lower()
        declared = response.headers.get("content-length")
        self.content_length = int(declared) if declared and declared.isdigit() else None
        self._closed = False

    def chunks(self):
        sent = 0
        try:
            for chunk in self._r.iter_bytes(64 * 1024):
                sent += len(chunk)
                if sent > self._max or _monotonic() > self._deadline:
                    break  # the answer has started: the connection is cut and the client sees a short body
                yield chunk
        except httpx.HTTPError:
            return
        finally:
            self.close()

    def close(self) -> None:
        if not self._closed:
            self._closed = True
            try:
                self._cm.__exit__(None, None, None)
            finally:
                self._client.close()


@dataclass(frozen=True)
class Reply:
    status: int
    headers: dict[str, str]
    body: bytes

    def json(self) -> Any:
        try:
            return json.loads(self.body.decode("utf-8"))
        except (ValueError, UnicodeDecodeError) as exc:
            raise ApiError(503, "source_invalid", "תשובת Frigate אינה מסמך תקין.", details={"error": type(exc).__name__}) from exc

    def text(self) -> str:
        return self.body.decode("utf-8", "replace")


# ---------------------------------------------------------------------------------------------- scrubbing

def scrub_text(value: str) -> str:
    """URL user-info (`rtsp://user:pass@host`) removed from any text; used before a string leaves the adapter."""
    return URL_USERINFO.sub(r"\1***@", value)


def scrub(value: Any) -> Any:
    """A copy of a decoded JSON document with every secret-shaped value removed: keys named like a password / token / user /
    secret, URL user-info inside strings, and Frigate's `ffmpeg_cmds` (full command lines with the same credentials)."""
    if isinstance(value, dict):
        out: dict[str, Any] = {}
        for k, v in value.items():
            if k == "ffmpeg_cmds":
                continue
            if isinstance(k, str) and SECRET_KEY.search(k):
                out[k] = "***" if v not in (None, "") else v
            else:
                out[k] = scrub(v)
        return out
    if isinstance(value, list):
        return [scrub(v) for v in value]
    if isinstance(value, str):
        return scrub_text(value)
    return value


# ---------------------------------------------------------------------------------------------- errors

def unavailable(op: str, exc: Exception) -> ApiError:
    return ApiError(503, "source_unavailable", "Frigate אינו זמין כרגע.", retryable=True, details={"op": op, "error": type(exc).__name__})


def forbidden(op: str, status: int, reason: str | None = None) -> ApiError:
    return ApiError(503, "source_forbidden", "Frigate דחה את פרטי הגישה או את ההרשאה.", details={"op": op, "status": status, **({"reason": reason} if reason else {})})


def map_status(op: str, status: int, optional: bool = False) -> ApiError:
    """The study's error map (7.3): 401/403 -> source_forbidden, 404 on an optional route -> `frigate_route_missing` (the caller
    turns that into capability False), 400 -> nvr_rejected, 429 and 5xx -> source_unavailable."""
    if status in (401, 403):
        return forbidden(op, status)
    if status == 404:
        return ApiError(404, "frigate_route_missing" if optional else "not_found", "המשאב לא נמצא ב־Frigate.", details={"op": op, "status": status})
    if status == 400:
        return ApiError(409, "nvr_rejected", "Frigate דחה את הבקשה.", details={"op": op, "status": status})
    return ApiError(503, "source_unavailable", "Frigate אינו זמין כרגע.", retryable=True, details={"op": op, "status": status})


def _check_query(path: str, params: dict[str, Any] | None) -> None:
    params = params or {}
    for key in params:
        if key not in QUERY_KEYS:
            raise ApiError(409, "frigate_path_not_allowed", "בקשה אל Frigate אינה מותרת.", details={"op": "query", "reason": "query_key"})
    for must in WINDOWED.get(path, ()):
        if must not in params:
            raise ApiError(409, "frigate_path_not_allowed", "בקשה אל Frigate חייבת להיות מוגבלת בזמן ובכמות.", details={"op": "query", "reason": "unbounded"})
    if "limit" in params:
        try:
            if not 1 <= int(params["limit"]) <= LIMIT_MAX:
                raise ValueError
        except (TypeError, ValueError) as exc:
            raise ApiError(409, "frigate_path_not_allowed", "מגבלת הבקשה אינה תקינה.", details={"op": "query", "reason": "limit"}) from exc


def allowed(path: str) -> bool:
    return any(p.fullmatch(path) for p in GET_ALLOWED)


def control_read_allowed(path: str) -> bool:
    return any(p.fullmatch(path) for p in CONTROL_GET_ALLOWED)


def write_allowed(klass: str, method: str, path: str) -> bool:
    return any(m == method and p.fullmatch(path) for m, p in WRITE_ALLOWED.get(klass, ()))


# ---------------------------------------------------------------------------------------------- the client

class FrigateHttp:
    """One recorder's HTTP access. Constructed from that recorder's effective settings (`recorder_scope.settings_for`):
    `nvr_host`, `nvr_http_port` (default 8971), `nvr_user` / `nvr_password` (the encrypted connection secret), and the extras
    `scheme` ("https" default | "http"), `tls_mode` ("pin" | "verify" | "trust"), `tls_pin` (SHA-256), `restream_port`."""

    def __init__(self, recorder_id: str, settings: Settings, *, transport: httpx.BaseTransport | None = None) -> None:
        self.recorder_id = recorder_id
        self._settings = settings
        self._transport = transport  # tests: httpx.MockTransport(fake.handle)

    # ------------------------------------------------------------------------------------------ connection

    @property
    def extra(self) -> dict[str, Any]:
        return self._settings.nvr_extra if isinstance(self._settings.nvr_extra, dict) else {}

    @property
    def scheme(self) -> str:
        return "http" if str(self.extra.get("scheme", "https")).lower() == "http" else "https"

    @property
    def device_key(self) -> str:
        dest = f"{(self._settings.nvr_host or '').strip('[]').lower()}|{self._settings.nvr_http_port}|{self.scheme}|{self._settings.nvr_user or ''}"
        return "frig-" + hashlib.sha256(dest.encode("utf-8")).hexdigest()[:16]

    def tls_mode(self) -> str:
        mode = str(self.extra.get("tls_mode") or "").lower()
        if mode in ("verify", "pin", "trust"):
            return mode
        return "trust" if self.extra.get("tls_verify") is False else "pin" if self.extra.get("tls_pin") else "verify"

    def base_url(self) -> str:
        host = self._settings.nvr_host or ""
        if ":" in host and not host.startswith("["):
            host = f"[{host}]"
        return f"{self.scheme}://{host}:{self._settings.nvr_http_port}"

    def _pin(self) -> str:
        pin = str(self.extra.get("tls_pin") or "").strip().lower().replace(":", "")
        if not re.fullmatch(r"[0-9a-f]{64}", pin):
            raise ApiError(409, "tls_pin_missing", "לא נשמרה טביעת אצבע של תעודת Frigate. בצעו בדיקת חיבור ושמרו.", details={"op": "tls"})
        return pin

    def _verify(self) -> Any:
        from . import provision_isr as pisr

        if self.scheme == "https" and self.tls_mode() == "pin":
            return pisr.pinned_context(self._pin())  # the pin is checked on the SAME connection, before any request byte
        if self.scheme == "https" and self.tls_mode() == "trust":
            return False
        return nvr._ssl_context()

    def _client(self, timeout: float = READ_TIMEOUT_S) -> httpx.Client:
        from ...mode import ensure_recorder_enabled

        ensure_recorder_enabled(self._settings)  # a recorder disabled while the process runs is never contacted
        s = self._settings
        if not s.nvr_host or not s.nvr_user or not s.nvr_password:
            raise ApiError(503, "source_not_configured", "פרטי Frigate לא הוגדרו.")
        kwargs: dict[str, Any] = {"base_url": self.base_url(), "timeout": timeout, "verify": self._verify()}
        if self._transport is not None:
            kwargs["transport"] = self._transport
        return httpx.Client(**kwargs)

    def warnings(self) -> list[dict[str, Any]]:
        out: list[dict[str, Any]] = []
        if self.scheme == "http":
            out.append({"code": "frigate_plain_http", "severity": "warning", "dismissible": True,
                        "message": "החיבור ל־Frigate אינו מוצפן; הסיסמה והתמונות עוברות ברשת כמות שהן."})
        if self.scheme == "https" and self.tls_mode() == "trust":
            out.append({"code": "tls_trust_any", "severity": "warning", "dismissible": True,
                        "message": "תעודת ה־HTTPS של Frigate אינה נבדקת. מומלץ לנעוץ את התעודה בבדיקת החיבור."})
        return out

    # ------------------------------------------------------------------------------------------ session

    def _login_lock(self) -> threading.Lock:
        with _LOCK:
            return _LOGIN_LOCKS.setdefault(self.device_key, threading.Lock())

    def _cached_token(self) -> str | None:
        with _LOCK:
            hit = _TOKENS.get(self.device_key)
        return hit[0] if hit and _monotonic() - hit[1] < TOKEN_TTL_S else None

    def forget_token(self) -> None:
        with _LOCK:
            _TOKENS.pop(self.device_key, None)

    def _check_refused(self) -> None:
        with _LOCK:
            until = _REFUSED.get(self.device_key)
        if until is not None and until > _monotonic():
            raise ApiError(503, "source_forbidden", "Frigate דחה את פרטי הגישה. ניסיון נוסף יתאפשר בעוד כמה דקות.",
                           details={"op": "login", "reason": "credentials_refused_backoff"})

    def login(self) -> str:
        """The ONE non-GET request of this adapter: POST /api/login. One login at a time per device; a refusal starts a
        backoff (Frigate rate-limits logins: 5 per minute). The token is returned and cached in memory, never stored."""
        with self._login_lock():
            cached = self._cached_token()
            if cached:
                return cached
            self._check_refused()
            nvr.check_deadline("login")
            s = self._settings
            with self._client(timeout=LOGIN_TIMEOUT_S) as c:
                try:
                    r = c.post("/api/login", json={"user": s.nvr_user, "password": s.nvr_password}, timeout=nvr.bounded_timeout(c.timeout))
                except httpx.HTTPError as exc:
                    if nvr.past_deadline():
                        raise nvr.deadline_error("login") from exc
                    from . import provision_isr as pisr

                    if pisr.PIN_MISMATCH in str(exc):
                        raise ApiError(503, "tls_pin_mismatch", "תעודת Frigate השתנתה. יש לאשר את התעודה החדשה בהגדרות החיבור.", details={"op": "login"}) from exc
                    raise unavailable("login", exc) from exc
            if r.status_code in (401, 403):
                with _LOCK:
                    _REFUSED[self.device_key] = _monotonic() + REFUSED_BACKOFF_S
                raise forbidden("login", r.status_code, "credentials")
            if r.status_code == 429:
                raise ApiError(503, "source_unavailable", "Frigate הגביל ניסיונות כניסה. נסו שוב בעוד דקה.", retryable=True, details={"op": "login", "status": 429})
            if r.status_code != 200:
                raise map_status("login", r.status_code)
            token = r.cookies.get("frigate_token") or _token_from_set_cookie(r.headers.get_list("set-cookie"))
            if not token:
                try:
                    body = r.json()
                    token = body.get("access_token") or body.get("token") if isinstance(body, dict) else None
                except ValueError:
                    token = None
            if not token or not isinstance(token, str):
                raise ApiError(503, "source_invalid", "Frigate לא החזיר אסימון כניסה.", details={"op": "login"})
            with _LOCK:
                _TOKENS[self.device_key] = (token, _monotonic())
                _REFUSED.pop(self.device_key, None)
            return token

    # ------------------------------------------------------------------------------------------ one GET

    def get(self, path: str, params: dict[str, Any] | None = None, *, max_bytes: int = JSON_MAX_BYTES, optional: bool = False,
            timeout: float = READ_TIMEOUT_S, control: bool = False) -> Reply:
        """GET one allow-listed path. 401 -> one fresh login and one retry; a second 401 is `source_forbidden`. Raises ApiError for
        everything but a 200."""
        if not (allowed(path) or (control and control_read_allowed(path))):
            raise ApiError(409, "frigate_path_not_allowed", "בקשה אל Frigate אינה מותרת בשלב הזה.", details={"op": "get", "reason": "not_allowed"})
        _check_query(path, params)
        for attempt in (0, 1):
            token = self.login()
            reply = self._send(path, params, token, max_bytes, timeout)
            if reply.status == 401 and attempt == 0:
                self.forget_token()
                continue
            break
        if reply.status == 401:
            with _LOCK:
                _REFUSED[self.device_key] = _monotonic() + REFUSED_BACKOFF_S
            self.forget_token()
        if reply.status != 200:
            raise map_status(_op(path), reply.status, optional)
        return reply

    def open_stream(self, path: str, *, max_bytes: int | None = None, total_s: float | None = None, timeout: float | None = None) -> ClipStream:
        """GET one allow-listed path as a stream (the clip family). Status, declared size and content type are checked BEFORE the first
        byte goes on: a non-200 or an oversized / non-video answer raises an ApiError and nothing stays open. 401 -> one fresh login, one retry."""
        if not allowed(path):
            raise ApiError(409, "frigate_path_not_allowed", "בקשה אל Frigate אינה מותרת בשלב הזה.", details={"op": "get", "reason": "not_allowed"})
        op = _op(path)
        max_bytes = CLIP_MAX_BYTES if max_bytes is None else max_bytes
        total_s = CLIP_TOTAL_S if total_s is None else total_s
        timeout = CLIP_READ_TIMEOUT_S if timeout is None else timeout
        for attempt in (0, 1):
            token = self.login()
            nvr.check_deadline(path)
            client = self._client(timeout=timeout)
            cm = client.stream("GET", path, headers={"Cookie": f"frigate_token={token}"})
            try:
                r = cm.__enter__()
            except httpx.HTTPError as exc:
                client.close()
                from . import provision_isr as pisr

                if pisr.PIN_MISMATCH in str(exc):
                    raise ApiError(503, "tls_pin_mismatch", "תעודת Frigate השתנתה. יש לאשר את התעודה החדשה בהגדרות החיבור.", details={"op": op}) from exc
                raise unavailable(op, exc) from exc
            if r.status_code == 401 and attempt == 0:
                cm.__exit__(None, None, None)
                client.close()
                self.forget_token()
                continue
            try:
                if r.status_code != 200:
                    if r.status_code == 401:
                        with _LOCK:
                            _REFUSED[self.device_key] = _monotonic() + REFUSED_BACKOFF_S
                        self.forget_token()
                    raise map_status(op, r.status_code)
                stream = ClipStream(client, cm, r, max_bytes, total_s)
                if not CLIP_TYPE.fullmatch(stream.content_type):
                    raise ApiError(503, "source_invalid", "Frigate לא החזיר וידאו.", details={"op": op})
                if stream.content_length is not None and stream.content_length > max_bytes:
                    raise ApiError(503, "source_too_large", "הקליפ של Frigate גדול מהמותר.", details={"op": op})
                return stream
            except BaseException:
                cm.__exit__(None, None, None)
                client.close()
                raise
        raise map_status(op, 401)

    def _send(self, path: str, params: dict[str, Any] | None, token: str, max_bytes: int, timeout: float) -> Reply:
        nvr.check_deadline(path)
        with self._client(timeout=timeout) as c:
            try:
                with c.stream("GET", path, params=params, headers={"Cookie": f"frigate_token={token}"}, timeout=nvr.bounded_timeout(c.timeout)) as r:
                    declared = r.headers.get("content-length")
                    if declared and declared.isdigit() and int(declared) > max_bytes:
                        raise ApiError(503, "source_too_large", "תשובת Frigate גדולה מהצפוי.", details={"op": _op(path)})
                    data = nvr.read_capped(r, max_bytes, _op(path)) if r.status_code == 200 else b""
                    return Reply(r.status_code, {k.lower(): v for k, v in r.headers.items()}, data)
            except httpx.HTTPError as exc:
                if nvr.past_deadline():
                    raise nvr.deadline_error(_op(path)) from exc
                from . import provision_isr as pisr

                if pisr.PIN_MISMATCH in str(exc):
                    raise ApiError(503, "tls_pin_mismatch", "תעודת Frigate השתנתה. יש לאשר את התעודה החדשה בהגדרות החיבור.", details={"op": _op(path)}) from exc
                raise unavailable(_op(path), exc) from exc

    # ------------------------------------------------------------------------------------------ one write (F2)

    def write(self, klass: str, method: str, path: str, body: Any = None) -> Reply:
        """ONE write to Frigate: `method path` must be on the allow-list of `klass` (WRITE_ALLOWED) or nothing is sent. 401 -> one fresh
        login and one retry of the SAME request (a refused request never reached Frigate's handler, so this cannot repeat an effect);
        any other failure is NOT retried here or by a caller (a lost answer is reported as an unknown outcome, never repeated). A 403 is
        `frigate_write_forbidden` (the account is not allowed to write). Raises ApiError for everything but a 2xx."""
        if not write_allowed(klass, method, path):
            raise ApiError(409, "frigate_path_not_allowed", "בקשת כתיבה ל־Frigate אינה מותרת.", details={"op": "write", "reason": "not_allowed"})
        payload = json.dumps(body).encode("utf-8") if body is not None else None
        if payload is not None and len(payload) > WRITE_BODY_MAX:
            raise ApiError(422, "frigate_body_too_large", "גוף הבקשה גדול מדי.", details={"op": "write"})
        for attempt in (0, 1):
            token = self.login()
            reply = self._send_write(method, path, payload, token)
            if reply.status == 401 and attempt == 0:
                self.forget_token()
                continue
            break
        if reply.status == 401:
            self.forget_token()
        if reply.status in (401, 403):
            raise ApiError(409, "frigate_write_forbidden", "חשבון Frigate אינו מורשה לבצע שינויים.", details={"op": _op(path), "status": reply.status})
        if not 200 <= reply.status < 300:
            raise map_status(_op(path), reply.status)
        return reply

    def _send_write(self, method: str, path: str, payload: bytes | None, token: str) -> Reply:
        nvr.check_deadline(path)
        headers = {"Cookie": f"frigate_token={token}"}
        if payload is not None:
            headers["Content-Type"] = "application/json"
        with self._client(timeout=WRITE_TIMEOUT_S) as c:
            try:
                with c.stream(method, path, content=payload, headers=headers, timeout=nvr.bounded_timeout(c.timeout)) as r:
                    data = nvr.read_capped(r, WRITE_REPLY_MAX, _op(path)) if 200 <= r.status_code < 300 else b""
                    return Reply(r.status_code, {k.lower(): v for k, v in r.headers.items()}, data)
            except httpx.HTTPError as exc:
                if nvr.past_deadline():
                    raise nvr.deadline_error(_op(path)) from exc
                from . import provision_isr as pisr

                if pisr.PIN_MISMATCH in str(exc):
                    raise ApiError(503, "tls_pin_mismatch", "תעודת Frigate השתנתה. יש לאשר את התעודה החדשה בהגדרות החיבור.", details={"op": _op(path)}) from exc
                raise ApiError(503, "frigate_write_unknown", "לא התקבלה תשובה מ־Frigate; מצב השינוי אינו ידוע. בדקו את המצב לפני ניסיון נוסף.",
                               details={"op": _op(path), "error": type(exc).__name__}) from exc

    # ------------------------------------------------------------------------------------------ conveniences

    def get_json(self, path: str, params: dict[str, Any] | None = None, *, max_bytes: int = JSON_MAX_BYTES, optional: bool = False, control: bool = False) -> Any:
        return self.get(path, params, max_bytes=max_bytes, optional=optional, control=control).json()

    def websocket_url(self) -> str:
        return ("wss" if self.scheme == "https" else "ws") + self.base_url()[len(self.scheme):] + "/ws"

    def websocket_headers(self) -> dict[str, str]:
        return {"Cookie": f"frigate_token={self.login()}"}

    def websocket_ssl(self) -> Any:
        """The TLS context for the `/ws` connection: the same rule as the HTTP client (verify / pin / trust)."""
        if self.scheme != "https":
            return None
        return self._verify() if self.tls_mode() != "trust" else _trust_context()


def _trust_context() -> Any:
    import ssl

    ctx = ssl.create_default_context()
    ctx.check_hostname = False
    ctx.verify_mode = ssl.CERT_NONE
    return ctx


def _token_from_set_cookie(headers: list[str]) -> str | None:
    for h in headers:
        m = re.match(r"\s*frigate_token=([^;]+)", h)
        if m:
            return m.group(1)
    return None


def _op(path: str) -> str:
    """A path as the error detail names it: camera names and ids are generic, never a host. Long ids are shortened."""
    return re.sub(r"[0-9]{9,11}(?:\.[0-9]+)?-[A-Za-z0-9]{4,10}", "<id>", path)[:80]


def q(value: str) -> str:
    return quote(value, safe="")
