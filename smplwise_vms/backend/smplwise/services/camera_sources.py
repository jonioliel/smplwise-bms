"""A camera's video source (CAMERA-STREAM-SOURCES-2410, owner decision 08.11; docs/changes/CAMERA-STREAM-SOURCES-2410.md).

Per camera, a "video source":
- "from the recorder" (the default, no row in `camera_stream_sources`): live video and snapshots come from the camera's recorder,
  exactly as before - nothing in this module touches such a camera;
- "manual address": the owner typed the camera's own RTSP address for the main stream and for the sub stream (one filled address
  serves both). Live video and snapshots then come from those addresses through ONE go2rtc stream per profile,
  `smplwise_cam_<camera id>_<main|sub>` (STREAM_PREFIX: a namespace of its own inside the product's `smplwise_`, so `reconcile` can
  delete what nobody wants without ever naming an NVR, WisKey, Home Assistant camera or foreign stream).
A camera WITHOUT a recorder ("add camera without a recorder": name, area, main / sub address) is a catalogue camera of the
pseudo-recorder STANDALONE (`recorders` row created with the first such camera, vendor `standalone`): it appears wherever a camera
appears (camera list, live wall, camera cards of the area screens, camera screen) and always has a manual source. Its recorder id is
not a server-assigned `nvr-<n>`, so recorder_scope.settings_for gives it no connection: every recorder-only path (recordings,
playback, events, NVR settings, camera reboot) answers 409 at the device boundary - it can never reach a device. The screens hide
those actions for it (`standalone: true` in the camera list) with a short reason.

Owner answers (all final):
1. the addresses (user:pass inside) are stored ENCRYPTED (connection_store.seal_camera_source: the recorder password's key file and
   format). No answer ever returns them: the API shows the address with its password masked (`rtsp://user:***@host/path`, a secret
   query value masked the same way) and `has_password`. A save that sends the masked address back keeps the stored secret; one that
   changes the host while the password is still masked is refused (`password_reenter`) - a stored password never travels to a new host.
2. a camera without a recorder = live + snapshots only.
3. every change needs `system.configure` (the permission of the recorder connection settings) and is audited - with the camera id,
   the mode, which profiles are set and the revision only; never an address, a host or a user name.
4. "test stream" before saving (`test_stream`): the address is checked by the source policy, then go2rtc takes ONE frame through a
   throwaway in-memory stream `smplwise_cam_probe_<random>` (deleted right after); the answer is a small JPEG preview, the resolution
   and the codec - or a fixed Hebrew error. Saving does not require a passing test.
5. a manual source that stops working stays as it is (no fallback to the recorder); `HEALTH` records it and the notification source
   `camera.source` (services/notify_sources.py) raises "the camera's manual source is not working" until it works again.
6. ONVIF discovery: not in scope.

Security: every address goes through services/source_policy.py before it is stored, tested or written to go2rtc (rtsp / rtsps only,
no loopback / link-local / multicast host in any spelling, no go2rtc itself on its ports, a host name judged by what it resolves to),
and at write time an address whose first path segment names a go2rtc stream outside `smplwise_cam_` is refused
(`names_foreign_stream`). An address is never logged, audited, returned, put in an error message or written anywhere but the sealed
column and go2rtc's API (the go2rtc listing of `GET /media/streams` shows it with its credentials hidden: go2rtc.redact_source). The
known limit of services/go2rtc.py applies: go2rtc may persist a stream's source into its own configuration file on its host."""
from __future__ import annotations

import base64
import collections
import io
import json
import logging
import os
import posixpath
import re
import secrets
import sqlite3
import threading
import time
from typing import Any, Callable
from urllib.parse import unquote, urlsplit, urlunsplit

from ..audit import audit
from ..config import Settings
from ..db import Database, new_id, now_iso, unlocked
from ..errors import ApiError
from . import connection_store as cs
from . import go2rtc as g2
from . import source_policy

log = logging.getLogger("smplwise.camera_sources")

STANDALONE = "standalone"  # the pseudo-recorder of the cameras without a recorder (never a server-assigned nvr-<n>)
STANDALONE_NAME = "מצלמות ללא מקליט"
STANDALONE_VENDOR = "standalone"
STANDALONE_MAX = 64  # cameras without a recorder per installation
STANDALONE_SORT_BASE = 10000  # after every recorder channel in the catalogue order
STREAM_PREFIX = f"{g2.STREAM_PREFIX}cam_"
PROBE_PREFIX = f"{STREAM_PREFIX}probe_"
PROFILES = ("main", "sub")
TRANSCODE_SUFFIX = "_h264"  # live_codec.TRANSCODE_SUFFIX (not imported: live_codec imports go2rtc only, kept that way)
CAMERA_ID_RE = re.compile(r"^[A-Za-z0-9][A-Za-z0-9_-]{0,63}$")
STREAM_SHAPE_RE = re.compile(r"^smplwise_cam_(?!probe_)[A-Za-z0-9][A-Za-z0-9_-]{0,63}_(main|sub)(_h264)?$")  # exactly what stream_name builds
AREA_ID_RE = re.compile(r"^[A-Za-z0-9_.-]{1,120}$")
MASK = "***"
SECRET_QUERY_RE = re.compile(r"(pass|pwd|token|secret|key|auth|sig)", re.IGNORECASE)
NAME_MAX = 120

PERMISSION = "system.configure"  # the permission of the recorder connection settings (routers/nvr_connection.py)

MSG = {
    "not_found": "המצלמה לא נמצאה.",
    "url_required": "יש להזין כתובת RTSP לזרם הראשי או לזרם המשני.",
    "no_stream_source": "יש להזין כתובת RTSP.",
    "source_not_supported": "הכתובת אינה כתובת RTSP נתמכת (rtsp:// או rtsps://).",
    "source_not_allowed": "הכתובת הזו אינה מותרת כמקור וידאו.",
    "password_reenter": "הכתובת השתנתה: יש להקליד שוב את הסיסמה.",
    "stale": "הגדרות המקור השתנו בינתיים; טענו את הדף מחדש.",
    "standalone_needs_source": "למצלמה ללא מקליט חייבת להיות כתובת ידנית.",
    "standalone_limit": "הגעתם למספר המרבי של מצלמות ללא מקליט.",
    "not_standalone": "המצלמה הזו מחוברת למקליט; אפשר לשנות רק את מקור הווידאו שלה.",
    "name_required": "יש להזין שם למצלמה.",
    "area_invalid": "האזור שנבחר אינו תקין.",
    "media_not_configured": "שירות הווידאו לא הוגדר; אי אפשר לבדוק את הזרם.",
    "webrtc_server_required": "כדי להוסיף מצלמה או לבדוק זרם נדרש שרת WebRTC. אפשר להגדיר אותו בהגדרות ← חיבורים.",
    "source_unreadable": "כתובת המקור השמורה אינה קריאה; יש להזין אותה מחדש.",
    "source_missing": "למצלמה אין מקור וידאו מוגדר.",
    "rate_limited": "יותר מדי בדיקות ברצף; נסו שוב בעוד דקה.",
}
# the outcome of a stream test that ran (HTTP 200, ok false) -> fixed Hebrew text; never go2rtc's own words (they may carry the address)
TEST_TEXT = {
    "auth_failed": "המצלמה דחתה את שם המשתמש או הסיסמה.",
    "unreachable": "אין תשובה מהכתובת. בדקו את הכתובת, הפורט ושהמצלמה מחוברת לרשת.",
    "path_not_found": "המצלמה ענתה, אבל הנתיב בכתובת לא נמצא.",
    "no_video": "התקבל חיבור, אבל לא התקבלה תמונה מהזרם.",
    "media_unavailable": "שירות הווידאו אינו זמין כרגע.",
    "failed": "הבדיקה נכשלה: לא התקבלה תמונה מהזרם.",
}


# ---------------------------------------------------------------- names

def stream_name(camera_id: str, profile: str) -> str:
    """smplwise_cam_<camera id>_<main|sub>: deterministic, in our namespace and in the narrower one this feature owns."""
    if profile not in PROFILES or not CAMERA_ID_RE.fullmatch(camera_id or "") or camera_id.startswith("probe_"):
        raise ValueError("not a camera id / profile")
    name = f"{STREAM_PREFIX}{camera_id}_{profile}"
    if not g2.NAME_RE.match(name):
        raise ValueError(name)
    return name


def transcode_name(camera_id: str, profile: str) -> str:
    return f"{stream_name(camera_id, profile)}{TRANSCODE_SUFFIX}"


def is_standalone(cam: Any) -> bool:
    try:
        return str(cam["recorder_id"]) == STANDALONE
    except (KeyError, IndexError, TypeError):
        return False


# ---------------------------------------------------------------- the address: masked form, merge with the stored secret

def _split_userinfo(netloc: str) -> tuple[str | None, str | None, str]:
    """(user, password, host[:port]) of a netloc; user / password None when absent (raw, still percent-encoded)."""
    userinfo, at, hostport = netloc.rpartition("@")
    if not at:
        return None, None, netloc
    user, colon, pw = userinfo.partition(":")
    return user, (pw if colon else None), hostport


def mask(url: str) -> tuple[str, bool]:
    """The address as an answer may show it: the password (and a secret-looking query value) replaced by `***`, plus whether
    there was one. Never raises: something that does not parse is shown as `***`."""
    try:
        parts = urlsplit(url)
    except ValueError:
        return MASK, False
    user, pw, hostport = _split_userinfo(parts.netloc)
    has = False
    netloc = parts.netloc
    if user is not None:
        if pw:
            has = True
            netloc = f"{user}:{MASK}@{hostport}"
        else:
            netloc = f"{user}@{hostport}"
    query = parts.query
    if query:
        out = []
        for chunk in query.split("&"):
            k, eq, v = chunk.partition("=")
            if eq and v and SECRET_QUERY_RE.search(unquote(k)):
                has = True
                out.append(f"{k}={MASK}")
            else:
                out.append(chunk)
        query = "&".join(out)
    return urlunsplit((parts.scheme, netloc, parts.path, query, "")), has


def _host_key(url: str) -> tuple[str, int | None] | None:
    try:
        p = urlsplit(url)
        return ((p.hostname or "").lower(), p.port)
    except ValueError:
        return None


def merge(new: str, stored: str | None) -> str:
    """The full address to keep for an edit: `new` as typed, with a masked password / secret query value taken from `stored` - only
    when the host and port did not change (a stored password never travels to a new host). ApiError 422 `password_reenter` when a
    mask is left that cannot be filled."""
    if MASK not in new:
        return new
    if stored is None or _host_key(new) != _host_key(stored) or _host_key(new) is None:
        raise ApiError(422, "password_reenter", MSG["password_reenter"])
    np_, sp_ = urlsplit(new), urlsplit(stored)
    nu, npw, nhost = _split_userinfo(np_.netloc)
    _su, spw, _ = _split_userinfo(sp_.netloc)
    netloc = np_.netloc
    if npw == MASK:
        if spw is None:
            raise ApiError(422, "password_reenter", MSG["password_reenter"])
        netloc = f"{nu}:{spw}@{nhost}"
    stored_q = {k: v for k, v in (c.partition("=")[::2] for c in sp_.query.split("&") if c)}
    query = []
    for chunk in np_.query.split("&") if np_.query else []:
        k, eq, v = chunk.partition("=")
        if eq and v == MASK:
            if k not in stored_q:
                raise ApiError(422, "password_reenter", MSG["password_reenter"])
            query.append(f"{k}={stored_q[k]}")
        else:
            query.append(chunk)
    if npw != MASK and nu is not None and MASK in nu:
        raise ApiError(422, "password_reenter", MSG["password_reenter"])  # a mask in the user name: never guessed at
    return urlunsplit((np_.scheme, netloc, np_.path, "&".join(query), np_.fragment))


def refusal(url: Any, settings: Settings) -> str | None:
    """None when `url` may be stored / tested / handed to go2rtc, else the policy's code (`no_stream_source`, `source_not_supported`,
    `source_not_allowed`). Blocking (a host name is resolved): call without the database write lock."""
    return source_policy.source_refusal(url, source_policy.go2rtc_targets(settings.go2rtc_url))


def names_foreign_stream(src: str, stream_names: Any) -> bool:
    """True when the first path segment of `src` (raw, percent-decoded twice, dot segments resolved, case-insensitive) is the name of
    a go2rtc stream outside `smplwise_cam_` (an alias of go2rtc's RTSP restream: `rtsp://<go2rtc by any name>/<another stream>`)."""
    try:
        path = urlsplit(src).path
    except ValueError:
        return True
    decoded = unquote(unquote(path))
    normal = posixpath.normpath("/" + decoded.lstrip("/"))
    first = {seg.lower() for seg in (path.lstrip("/").split("/", 1)[0], decoded.lstrip("/").split("/", 1)[0], normal.lstrip("/").split("/", 1)[0]) if seg}
    return bool(first & {n.lower() for n in stream_names if not n.startswith(STREAM_PREFIX)})


def _refuse_foreign(src: str) -> Callable[[dict[str, g2.StreamInfo]], None]:
    def check(streams: dict[str, g2.StreamInfo]) -> None:
        if names_foreign_stream(src, streams):
            raise ApiError(422, "source_not_allowed", MSG["source_not_allowed"])

    return check


def _refuse(code: str) -> ApiError:
    return ApiError(422, code, MSG.get(code, MSG["source_not_allowed"]))


# ---------------------------------------------------------------- the stored row

def get_row(conn: sqlite3.Connection, camera_id: str) -> sqlite3.Row | None:
    try:
        return conn.execute("SELECT * FROM camera_stream_sources WHERE camera_id = ?", (camera_id,)).fetchone()
    except sqlite3.OperationalError:  # a database before 0209
        return None


def manual_ids(conn: sqlite3.Connection) -> set[str]:
    try:
        return {str(r[0]) for r in conn.execute("SELECT camera_id FROM camera_stream_sources").fetchall()}
    except sqlite3.OperationalError:
        return set()


def ensure_webrtc_server(settings: Settings) -> None:
    """NVRLESS-CAMERAS-2411 (owner, 08.11: "show, but a WebRTC server is required"): adding a camera without a recorder and the
    stream test need go2rtc. 409 `webrtc_server_required` (stable code, fixed Hebrew text) - the caller has checked the permission
    and has not looked at any address yet."""
    if not (settings.go2rtc_url or "").strip():
        raise ApiError(409, "webrtc_server_required", MSG["webrtc_server_required"], details={"settings_href": "#/system/setup"})


def standalone_count(conn: sqlite3.Connection) -> int:
    """How many cameras without a recorder this installation has (NVRLESS-CAMERAS-2411: the `cameras_available` capability)."""
    try:
        return int(conn.execute("SELECT COUNT(*) FROM cameras WHERE recorder_id = ?", (STANDALONE,)).fetchone()[0])
    except sqlite3.OperationalError:  # a database without the catalogue (never in practice; the capability block must not fail)
        return 0


def areas(conn: sqlite3.Connection) -> dict[str, str | None]:
    """camera id -> the area of a camera without a recorder (None when none was chosen)."""
    try:
        return {str(r["camera_id"]): r["area_id"] for r in conn.execute(
            "SELECT s.camera_id, s.area_id FROM camera_stream_sources s JOIN cameras c ON c.id = s.camera_id WHERE c.recorder_id = ?", (STANDALONE,)).fetchall()}
    except sqlite3.OperationalError:
        return {}


def _probe(row: Any) -> dict[str, Any]:
    try:
        data = json.loads(row["probe_json"] or "{}") if row is not None else {}
    except (ValueError, TypeError):
        data = {}
    return data if isinstance(data, dict) else {}


def with_source(conn: sqlite3.Connection, cam: Any) -> Any:
    """The camera row as the live / snapshot / cast paths use it: unchanged for a camera on its recorder, else a dict with the sealed
    source (`_manual`, opened only where the address is needed) and the codecs of the last stream test in place of the recorder's
    registry (live_codec.registry_codecs reads them). A camera without a recorder whose row is gone gets `_manual` = {} (fails closed)."""
    if cam is None:
        return cam
    row = get_row(conn, str(cam["id"]))
    if row is None and not is_standalone(cam):
        return cam
    out = dict(cam)
    out["_manual"] = dict(row) if row is not None else {}
    probe = _probe(row)
    enc = {p: {"codec": (probe.get(p) or {}).get("codec_label")} for p in PROFILES if (probe.get(p) or {}).get("codec_label")}
    out["capabilities_json"] = json.dumps({"encoding": enc} if enc else {})
    return out


def manual_of(cam: Any) -> dict[str, Any] | None:
    """The sealed source a camera row was given by `with_source`, or None for a camera on its recorder."""
    if isinstance(cam, dict) and "_manual" in cam:
        return cam["_manual"]
    return None


def open_urls(settings: Settings, row: Any) -> dict[str, str]:
    """profile -> the full address (one filled address serves both profiles). Raises ApiError 409 `source_unreadable` when a sealed
    address cannot be opened (another key, a damaged value) and 409 `source_missing` without a row."""
    if not row:
        raise ApiError(409, "source_missing", MSG["source_missing"])
    cid = str(row["camera_id"])
    out: dict[str, str] = {}
    try:
        for p in PROFILES:
            blob = row[f"{p}_url_enc"]
            if blob:
                out[p] = cs.open_camera_source(settings.data_dir, cid, p, blob)
    except cs.SecretError:
        raise ApiError(409, "source_unreadable", MSG["source_unreadable"]) from None
    if not out:
        raise ApiError(409, "source_missing", MSG["source_missing"])
    for p in PROFILES:
        out.setdefault(p, out.get("sub" if p == "main" else "main", ""))
    return out


def _side(row: Any, p: str) -> dict[str, Any] | None:
    if row is None or not row[f"{p}_url_enc"]:
        return None
    return {"url": row[f"{p}_display"] or MASK, "has_password": bool(row[f"{p}_has_password"])}


def view(conn: sqlite3.Connection, cam: Any) -> dict[str, Any]:
    """`GET /cameras/{id}/source`: never a secret - the masked address of each profile, `has_password`, the last test result and
    the health of the source."""
    row = get_row(conn, str(cam["id"]))
    standalone = is_standalone(cam)
    probe = _probe(row)
    return {
        "camera_id": cam["id"],
        "mode": "manual" if row is not None else "nvr",
        "standalone": standalone,
        "main": _side(row, "main"),
        "sub": _side(row, "sub"),
        "area_id": row["area_id"] if row is not None else None,
        "revision": int(row["revision"]) if row is not None else 0,
        "updated_at": row["updated_at"] if row is not None else None,
        "probe": {p: {k: v for k, v in (probe.get(p) or {}).items() if k in ("codec", "width", "height", "at")} for p in PROFILES if probe.get(p)},
        "health": health_view(str(cam["id"])) if row is not None else None,
        # what a camera with this source can do (owner answer 2): the screens grey or hide the rest with a short reason
        "capabilities": {"live": True, "snapshot": True, "recording": not standalone, "playback": not standalone, "events": not standalone,
                         "reboot": not standalone},
    }


# ---------------------------------------------------------------- saving

def _prepare(settings: Settings, conn: sqlite3.Connection, camera_id: str, main: str | None, sub: str | None, row: Any) -> dict[str, str | None]:
    """The full address of each profile after the merge with the stored secret, every one checked by the source policy (the name
    resolution runs without the write lock). Empty = not set; at least one is required."""
    stored: dict[str, str] = {}
    if row is not None and ((main and MASK in main) or (sub and MASK in sub)):
        try:
            stored = {p: cs.open_camera_source(settings.data_dir, camera_id, p, row[f"{p}_url_enc"]) for p in PROFILES if row[f"{p}_url_enc"]}
        except cs.SecretError:
            raise ApiError(422, "password_reenter", MSG["password_reenter"]) from None
    out: dict[str, str | None] = {}
    for p, value in (("main", main), ("sub", sub)):
        value = (value or "").strip()
        if not value:
            out[p] = None
            continue
        # the masked address of THIS profile is merged with this profile's stored address (else the other one's, when only one was stored)
        out[p] = merge(value, stored.get(p) or stored.get("sub" if p == "main" else "main"))
    if not out["main"] and not out["sub"]:
        raise ApiError(422, "url_required", MSG["url_required"], details={"fields": ["main_url", "sub_url"]})
    with unlocked(conn):
        for p in PROFILES:
            if out[p]:
                code = refusal(out[p], settings)
                if code:
                    raise ApiError(422, code, MSG.get(code, MSG["source_not_allowed"]), details={"fields": [f"{p}_url"]})
    return out


def _write(conn: sqlite3.Connection, settings: Settings, camera_id: str, urls: dict[str, str | None], actor_id: str, area_id: str | None,
           keep_probe: bool) -> int:
    row = get_row(conn, camera_id)
    now = now_iso()
    cols: dict[str, Any] = {}
    for p in PROFILES:
        url = urls[p]
        if url:
            shown, has = mask(url)
            cols[f"{p}_url_enc"] = cs.seal_camera_source(settings.data_dir, camera_id, p, url)
            cols[f"{p}_display"] = shown
            cols[f"{p}_has_password"] = int(has)
        else:
            cols[f"{p}_url_enc"], cols[f"{p}_display"], cols[f"{p}_has_password"] = None, None, 0
    probe = _probe(row) if keep_probe else {}
    if row is None:
        conn.execute(
            """INSERT INTO camera_stream_sources(camera_id, main_url_enc, sub_url_enc, main_display, sub_display, main_has_password, sub_has_password,
                                                 area_id, probe_json, revision, created_at, updated_at, updated_by)
               VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 1, ?, ?, ?)""",
            (camera_id, cols["main_url_enc"], cols["sub_url_enc"], cols["main_display"], cols["sub_display"], cols["main_has_password"],
             cols["sub_has_password"], area_id, json.dumps(probe), now, now, actor_id))
        return 1
    revision = int(row["revision"]) + 1
    conn.execute(
        """UPDATE camera_stream_sources SET main_url_enc = ?, sub_url_enc = ?, main_display = ?, sub_display = ?, main_has_password = ?,
                  sub_has_password = ?, area_id = ?, probe_json = ?, revision = ?, updated_at = ?, updated_by = ? WHERE camera_id = ?""",
        (cols["main_url_enc"], cols["sub_url_enc"], cols["main_display"], cols["sub_display"], cols["main_has_password"], cols["sub_has_password"],
         area_id, json.dumps(probe), revision, now, actor_id, camera_id))
    return revision


def _area(value: Any) -> str | None:
    if value in (None, ""):
        return None
    if not isinstance(value, str) or not AREA_ID_RE.fullmatch(value):
        raise ApiError(422, "area_invalid", MSG["area_invalid"], details={"fields": ["area_id"]})
    return value


def _camera(conn: sqlite3.Connection, camera_id: str) -> sqlite3.Row:
    cam = conn.execute("SELECT * FROM cameras WHERE id = ?", (camera_id,)).fetchone() if CAMERA_ID_RE.fullmatch(camera_id or "") else None
    if cam is None:
        raise ApiError(404, "not_found", MSG["not_found"])
    return cam


def _after_change(conn: sqlite3.Connection, settings: Settings, camera_id: str) -> None:
    """A changed or removed source: the go2rtc streams of the old source are deleted (the next viewer re-creates them from the new
    one), the cached snapshot (a picture of the old source) is dropped and the health starts again. go2rtc down: `reconcile` /
    the next ensure fixes it."""
    forget_health(camera_id)
    try:
        (settings.data_dir / "snapshots" / f"{camera_id}.jpg").unlink(missing_ok=True)
    except OSError:
        pass
    if not settings.go2rtc_url:
        return
    try:
        with unlocked(conn):
            client = g2.Go2rtc(settings)
            listed = client.list_streams()
            for p in PROFILES:
                for name in (stream_name(camera_id, p), transcode_name(camera_id, p)):
                    if name in listed:
                        _delete(client, name)
    except (ApiError, ValueError) as exc:
        log.warning("camera source streams not refreshed: %s", getattr(exc, "code", type(exc).__name__))


def save(conn: sqlite3.Connection, settings: Settings, principal: Any, camera_id: str, *, mode: str, main_url: str | None, sub_url: str | None,
         if_revision: int | None, area_id: Any = None, request_id: str | None = None) -> dict[str, Any]:
    """`PUT /cameras/{id}/source`. The caller has checked `system.configure`. `mode` `nvr` removes the manual source (refused for a
    camera without a recorder); `manual` stores the addresses (sealed). `if_revision` (optional) must match the stored revision."""
    cam = _camera(conn, camera_id)
    standalone = is_standalone(cam)
    row = get_row(conn, camera_id)
    current = int(row["revision"]) if row is not None else 0
    if if_revision is not None and if_revision != current:
        raise ApiError(409, "stale", MSG["stale"], details={"revision": current})
    if mode == "nvr":
        if standalone:
            raise ApiError(409, "standalone_needs_source", MSG["standalone_needs_source"])
        if row is not None:
            conn.execute("DELETE FROM camera_stream_sources WHERE camera_id = ?", (camera_id,))
        audit(conn, actor=principal, action="camera.source.update", decision="allowed", resource_type="camera", resource_id=camera_id, request_id=request_id,
              details={"mode": "nvr", "was_manual": row is not None})
        _after_change(conn, settings, camera_id)
        return view(conn, cam)
    area = _area(area_id) if standalone else None
    try:
        urls = _prepare(settings, conn, camera_id, main_url, sub_url, row)
    except ApiError as exc:
        if exc.code in ("source_not_allowed", "source_not_supported", "no_stream_source", "password_reenter"):
            audit(conn, actor=principal, action="camera.source.update", decision="denied", resource_type="camera", resource_id=camera_id, reason=exc.code,
                  request_id=request_id, details={"mode": "manual"})
        raise
    same = row is not None and all(
        (urls[p] or None) == (_open_or_none(settings, camera_id, p, row[f"{p}_url_enc"]) if row[f"{p}_url_enc"] else None) for p in PROFILES)
    revision = _write(conn, settings, camera_id, urls, principal.user_id, area if standalone else (row["area_id"] if row is not None else None), keep_probe=same)
    audit(conn, actor=principal, action="camera.source.update", decision="allowed", resource_type="camera", resource_id=camera_id, request_id=request_id,
          details={"mode": "manual", "main": bool(urls["main"]), "sub": bool(urls["sub"]), "address_changed": not same, "revision": revision,
                   **({"standalone": True} if standalone else {})})
    if not same:
        _after_change(conn, settings, camera_id)
    return view(conn, cam)


def _open_or_none(settings: Settings, camera_id: str, p: str, blob: str) -> str | None:
    try:
        return cs.open_camera_source(settings.data_dir, camera_id, p, blob)
    except cs.SecretError:
        return None


# ---------------------------------------------------------------- cameras without a recorder

def _ensure_standalone_recorder(conn: sqlite3.Connection) -> None:
    now = now_iso()
    conn.execute(
        """INSERT INTO recorders(id, name, created_at) VALUES (?, ?, ?) ON CONFLICT(id) DO NOTHING""", (STANDALONE, STANDALONE_NAME, now))
    try:
        conn.execute("UPDATE recorders SET vendor = ?, removed_at = NULL, enabled = 1, sort_order = ? WHERE id = ?", (STANDALONE_VENDOR, STANDALONE_SORT_BASE, STANDALONE))
    except sqlite3.OperationalError:  # a database before 0055 (never with 0209 applied)
        pass


def create_standalone(conn: sqlite3.Connection, settings: Settings, principal: Any, *, name: str, area_id: Any, main_url: str | None, sub_url: str | None,
                      request_id: str | None = None) -> dict[str, Any]:
    """`POST /cameras/standalone`: a catalogue camera of the pseudo-recorder STANDALONE with its manual source. The caller has
    checked `system.configure`. The addresses are checked BEFORE anything is written."""
    name = (name or "").strip()
    if not name or len(name) > NAME_MAX:
        raise ApiError(422, "name_required", MSG["name_required"], details={"fields": ["name"]})
    area = _area(area_id)
    count = conn.execute("SELECT COUNT(*) FROM cameras WHERE recorder_id = ?", (STANDALONE,)).fetchone()[0]
    if count >= STANDALONE_MAX:
        raise ApiError(409, "standalone_limit", MSG["standalone_limit"], details={"max": STANDALONE_MAX})
    cid = new_id()
    try:
        urls = _prepare(settings, conn, cid, main_url, sub_url, None)
    except ApiError as exc:
        if exc.code in ("source_not_allowed", "source_not_supported", "no_stream_source", "password_reenter"):
            audit(conn, actor=principal, action="camera.standalone.create", decision="denied", resource_type="camera", resource_id=None, reason=exc.code,
                  request_id=request_id)
        raise
    _ensure_standalone_recorder(conn)
    channel = int(conn.execute("SELECT COALESCE(MAX(channel), 0) + 1 FROM cameras WHERE recorder_id = ?", (STANDALONE,)).fetchone()[0])
    now = now_iso()
    conn.execute(
        "INSERT INTO cameras(id, recorder_id, channel, name_source, alias, sort_order, status, created_at, updated_at) VALUES (?, ?, ?, '', ?, ?, 'unknown', ?, ?)",
        (cid, STANDALONE, channel, name, STANDALONE_SORT_BASE + channel, now, now))
    try:
        conn.execute("UPDATE cameras SET source_ref = ? WHERE id = ?", (f"cam-{channel}", cid))
    except sqlite3.OperationalError:
        pass
    _write(conn, settings, cid, urls, principal.user_id, area, keep_probe=False)
    audit(conn, actor=principal, action="camera.standalone.create", decision="allowed", resource_type="camera", resource_id=cid, request_id=request_id,
          details={"channel": channel, "alias": name, "area": bool(area), "main": bool(urls["main"]), "sub": bool(urls["sub"])})
    from ..routers.anchors import camera_row

    return {**camera_row(conn.execute("SELECT * FROM cameras WHERE id = ?", (cid,)).fetchone()), "standalone": True, "video_source": "manual",
            "area_id": area}


def delete_standalone(conn: sqlite3.Connection, settings: Settings, principal: Any, camera_id: str, request_id: str | None = None) -> dict[str, Any]:
    """`DELETE /cameras/standalone/{id}`: the camera row, its source and its map placements go; its go2rtc streams are deleted.
    A camera on a recorder is refused (it is removed with its recorder). History rows that name the camera id stay (audit)."""
    cam = _camera(conn, camera_id)
    if not is_standalone(cam):
        raise ApiError(409, "not_standalone", MSG["not_standalone"])
    conn.execute("DELETE FROM camera_stream_sources WHERE camera_id = ?", (camera_id,))
    conn.execute("DELETE FROM cameras WHERE id = ?", (camera_id,))
    try:
        conn.execute("UPDATE map_anchors SET effective_to = ? WHERE resource_type = 'camera' AND resource_id = ? AND effective_to IS NULL", (now_iso(), camera_id))
    except sqlite3.OperationalError:
        pass
    audit(conn, actor=principal, action="camera.standalone.delete", decision="allowed", resource_type="camera", resource_id=camera_id, request_id=request_id,
          details={"channel": cam["channel"]})
    _after_change(conn, settings, camera_id)
    return {"camera_id": camera_id, "deleted": True}


# ---------------------------------------------------------------- go2rtc: the live streams of a manual source

_STREAM_LOCK = threading.Lock()
_WRITTEN: dict[str, float] = {}
WRITE_GRACE_S = 120.0


def _delete(client: g2.Go2rtc, name: str) -> None:
    if not STREAM_SHAPE_RE.fullmatch(name):
        raise ValueError("refusing to delete a stream outside the smplwise_cam_ namespace")
    with _STREAM_LOCK:
        client.delete_stream(name)
        _WRITTEN.pop(name, None)


def ensure_stream(settings: Settings, cam: Any, profile: str) -> str:
    """The go2rtc stream of a camera with a manual source (a `with_source` row), created or re-pointed from the stored address. The
    address is checked by the source policy again (a name may resolve elsewhere today) and against go2rtc's stream list. A failure
    is recorded in the health of the source and raised (ApiError: the socket is refused, the viewer sees the stream as unavailable)."""
    return ensure_stream_outcome(settings, cam, profile)[0]


def ensure_stream_outcome(settings: Settings, cam: Any, profile: str) -> tuple[str, str]:
    """`ensure_stream` with go2rtc's outcome (`created` | `updated` | `unchanged`) for the stream sync's counts."""
    camera_id = str(cam["id"])
    name = stream_name(camera_id, profile)
    try:
        urls = open_urls(settings, manual_of(cam))
        src = urls[profile]
        code = refusal(src, settings)
        if code:
            raise _refuse(code)
        with _STREAM_LOCK:
            outcome = g2.Go2rtc(settings).ensure_stream(name, src, check=_refuse_foreign(src))
            _WRITTEN[name] = time.monotonic()
    except ApiError as exc:
        if exc.code not in ("media_not_configured", "media_unavailable", "media_error"):  # go2rtc's own outage is not the camera's
            record_fail(camera_id, exc.code)
        raise
    return name, outcome


def snapshot(settings: Settings, cam: Any) -> bytes:
    """One JPEG of a camera with a manual source: its sub stream (else the main) is ensured, then ONE frame is asked for by name only
    (go2rtc.frame_existing - no source in the query). The outcome feeds the health of the source."""
    if not settings.go2rtc_url:
        raise ApiError(409, "media_not_configured", MSG["media_not_configured"])
    camera_id = str(cam["id"])
    name = ensure_stream(settings, cam, "sub")
    try:
        data = g2.Go2rtc(settings).frame_existing(name)
    except ApiError as exc:
        if exc.code == "snapshot_unavailable":  # the camera gave no picture; go2rtc's own outage / refusal is not the camera's
            record_fail(camera_id, exc.code)
        raise
    record_ok(camera_id)
    return data


def reconcile(db: Database, settings: Settings, *, force: bool = False) -> dict[str, int]:
    """Make go2rtc hold only the `smplwise_cam_` streams a camera with a manual source wants: every other stream of the exact shape
    `stream_name` builds (and its transcoded variant) is deleted - a source removed while go2rtc was down, a deleted camera. Nothing
    outside that shape is ever touched. Throttled (RECONCILE_EVERY_S); never raises for a go2rtc that is down."""
    global _last_reconcile
    out = {"deleted": 0}
    if not settings.go2rtc_url:
        return out
    now = time.monotonic()
    if not force and now - _last_reconcile < RECONCILE_EVERY_S:
        return out
    _last_reconcile = now
    try:
        client = g2.Go2rtc(settings)
        with db.connection(mode="read", label="camera sources reconcile") as conn:
            wanted = _wanted(conn)
        stray = sorted(n for n in client.list_streams() if STREAM_SHAPE_RE.fullmatch(n) and _base(n) not in wanted)
        for name in stray:
            if time.monotonic() - _WRITTEN.get(name, -1e9) < WRITE_GRACE_S:
                continue
            with db.connection(mode="read", label="camera sources reconcile") as conn:
                if _base(name) in _wanted(conn):
                    continue
            _delete(client, name)
            out["deleted"] += 1
            with db.connection() as conn:
                audit(conn, actor=None, action="camera.source.stream_removed", decision="allowed", resource_type="go2rtc_stream", resource_id=name, reason="not_wanted")
    except ApiError as exc:
        log.warning("camera sources reconcile: go2rtc unavailable: %s", exc.code)
    return out


RECONCILE_EVERY_S = 300.0
_last_reconcile = 0.0


def _base(name: str) -> str:
    return name[: -len(TRANSCODE_SUFFIX)] if name.endswith(TRANSCODE_SUFFIX) else name


def _wanted(conn: sqlite3.Connection) -> set[str]:
    out: set[str] = set()
    try:
        rows = conn.execute("SELECT s.camera_id FROM camera_stream_sources s JOIN cameras c ON c.id = s.camera_id WHERE c.enabled = 1").fetchall()
    except sqlite3.OperationalError:
        return out
    for r in rows:
        for p in PROFILES:
            try:
                out.add(stream_name(str(r[0]), p))
            except ValueError:
                pass
    return out


# ---------------------------------------------------------------- "test stream" (before saving)

TEST_MAX_PER_MIN = 6
PREVIEW_MAX_PX = 640
_TESTS: dict[str, collections.deque[float]] = {}
_TESTS_LOCK = threading.Lock()


def _test_budget(user_id: str) -> bool:
    now = time.monotonic()
    with _TESTS_LOCK:
        q = _TESTS.setdefault(user_id, collections.deque())
        while q and now - q[0] > 60.0:
            q.popleft()
        if len(q) >= TEST_MAX_PER_MIN:
            return False
        q.append(now)
        return True


def classify(status: int, text: str) -> str:
    """A failed probe grab (go2rtc's status and the first bytes of its error text, which is NEVER passed on: it may carry the address)
    -> one of TEST_TEXT's codes."""
    t = (text or "").lower()
    if "401" in t or "unauthorized" in t or "403" in t or "forbidden" in t:
        return "auth_failed"
    if "404" in t or "not found" in t:
        return "path_not_found"
    if any(w in t for w in ("timeout", "refused", "no route", "unreachable", "no such host", "i/o", "eof", "reset")):
        return "unreachable"
    if status in (500, 502, 503) and t:
        return "no_video"
    return "failed"


def _grab_probe(client: g2.Go2rtc, name: str, src: str, timeout_s: float = 15.0) -> tuple[int, bytes, str]:
    """ONE frame of a throwaway in-memory stream (`/api/frame.jpeg?src=<address>&name=<probe name>`: go2rtc's Patch - nothing written to
    its configuration). Returns (status, jpeg, the first 300 bytes of an error answer)."""
    import httpx

    body = bytearray()
    err = ""
    try:
        with httpx.Client(base_url=client.base, auth=client.auth, timeout=timeout_s, verify=g2._verify()) as c:
            with c.stream("GET", "/api/frame.jpeg", params={"src": src, "name": name}) as r:
                status = r.status_code
                for chunk in r.iter_bytes():
                    body += chunk
                    if len(body) > g2.FRAME_MAX:
                        break
                if status != 200:
                    err = bytes(body[:300]).decode("utf-8", "replace")
    except httpx.TimeoutException:
        return 0, b"", "timeout"
    except httpx.HTTPError as exc:
        raise client._wrap(exc, "probe") from exc
    return status, bytes(body), err


def _preview(jpeg: bytes) -> tuple[str, int, int]:
    """A small JPEG preview (data URL) and the frame's own size. Pillow reads the header for the size; the preview is re-encoded."""
    from PIL import Image

    with Image.open(io.BytesIO(jpeg)) as im:
        width, height = im.size
        im.draft("RGB", (PREVIEW_MAX_PX, PREVIEW_MAX_PX))
        small = im.convert("RGB")
        small.thumbnail((PREVIEW_MAX_PX, PREVIEW_MAX_PX))
        buf = io.BytesIO()
        small.save(buf, format="JPEG", quality=70)
    return "data:image/jpeg;base64," + base64.b64encode(buf.getvalue()).decode("ascii"), int(width), int(height)


CODEC_LABEL = {"h264": "H.264", "h265": "H.265", "mjpeg": "MJPEG"}


def test_url(settings: Settings, src: str) -> dict[str, Any]:
    """Probe one checked address (`refusal` already returned None): ONE frame through a throwaway `smplwise_cam_probe_<random>`
    stream, its codec from go2rtc's producer, then the stream is deleted. Never raises for a stream that does not answer: `{ok:
    False, code, message}` with a fixed Hebrew text. go2rtc unreachable: `media_unavailable` the same way."""
    client = g2.Go2rtc(settings)
    name = f"{PROBE_PREFIX}{secrets.token_hex(6)}"
    try:
        listed = client.list_streams()
        if names_foreign_stream(src, listed):
            raise _refuse("source_not_allowed")
        status, body, err = _grab_probe(client, name, src)
        if status != 200 or not body.startswith(b"\xff\xd8\xff"):
            code = classify(status, err)
            return {"ok": False, "code": code, "message": TEST_TEXT[code]}
        codec = None
        try:
            info = client.list_streams().get(name)
            codec = info.video_codec if info else None
        except ApiError:
            codec = None
        try:
            preview, width, height = _preview(body)
        except Exception:  # noqa: BLE001 - a frame Pillow cannot read
            return {"ok": False, "code": "no_video", "message": TEST_TEXT["no_video"]}
        return {"ok": True, "width": width, "height": height, "codec": codec, "codec_label": CODEC_LABEL.get(codec or "", (codec or "").upper() or None),
                "preview": preview}
    except ApiError as exc:
        if exc.code.startswith("source_"):
            raise
        return {"ok": False, "code": "media_unavailable", "message": TEST_TEXT["media_unavailable"]}
    finally:
        try:
            client.discard_probe_stream(name)
        except Exception:  # noqa: BLE001 - the probe stream is in memory only; go2rtc's restart drops it
            log.warning("probe stream not deleted")


def test_stream(conn: sqlite3.Connection, settings: Settings, principal: Any, *, url: str | None, camera_id: str | None, profile: str,
                request_id: str | None = None) -> dict[str, Any]:
    """`POST /cameras/source/test`. The caller has checked `system.configure`. `url` as typed; a masked address (`***`) is completed
    from `camera_id`'s stored address of `profile` (same host only). Audited with the outcome only. A passing test of a saved camera
    also records the codec and resolution (the live player's codec choice) and counts as a working source."""
    if not settings.go2rtc_url:
        raise ApiError(409, "media_not_configured", MSG["media_not_configured"])
    if profile not in PROFILES:
        raise ApiError(422, "validation", "פרופיל לא תקין.", details={"fields": ["profile"]})
    value = (url or "").strip()
    row = None
    if camera_id:
        _camera(conn, camera_id)
        row = get_row(conn, camera_id)
    if not value and row is not None:
        value = (row[f"{profile}_display"] or row["sub_display" if profile == "main" else "main_display"] or "")
    if not value:
        raise ApiError(422, "url_required", MSG["url_required"], details={"fields": ["url"]})
    stored = None
    if MASK in value and row is not None:
        stored = _open_or_none(settings, str(camera_id), profile, row[f"{profile}_url_enc"]) if row[f"{profile}_url_enc"] else None
        if stored is None:
            other = "sub" if profile == "main" else "main"
            stored = _open_or_none(settings, str(camera_id), other, row[f"{other}_url_enc"]) if row[f"{other}_url_enc"] else None
    if not _test_budget(principal.user_id):
        raise ApiError(429, "rate_limited", MSG["rate_limited"], retryable=True)
    try:
        src = merge(value, stored)
        with unlocked(conn):
            code = refusal(src, settings)
            if code:
                raise _refuse(code)
            result = test_url(settings, src)
    except ApiError as exc:
        if exc.code.startswith("source_") or exc.code in ("password_reenter", "no_stream_source"):
            audit(conn, actor=principal, action="camera.source.test", decision="denied", resource_type="camera", resource_id=camera_id, reason=exc.code,
                  request_id=request_id, details={"profile": profile})
        raise
    audit(conn, actor=principal, action="camera.source.test", decision="allowed", resource_type="camera", resource_id=camera_id, request_id=request_id,
          details={"profile": profile, "outcome": "ok" if result["ok"] else result["code"]})
    if camera_id and row is not None and result["ok"] and stored is not None:
        _record_probe(conn, str(camera_id), profile, result)
        record_ok(str(camera_id))
    return result


def _record_probe(conn: sqlite3.Connection, camera_id: str, profile: str, result: dict[str, Any]) -> None:
    row = get_row(conn, camera_id)
    if row is None:
        return
    probe = _probe(row)
    probe[profile] = {"codec": result.get("codec"), "codec_label": result.get("codec_label"), "width": result.get("width"), "height": result.get("height"),
                      "at": now_iso()}
    conn.execute("UPDATE camera_stream_sources SET probe_json = ? WHERE camera_id = ?", (json.dumps(probe), camera_id))


# ---------------------------------------------------------------- the health of a manual source (owner answer 5)

FAIL_CONFIRM = 2  # this many failures in a row (with no success between) = failing
CHECK_EVERY_S = 300.0  # the poller checks each manual source this often
PER_PASS = 4
TICK_S = 30.0
_HEALTH: dict[str, dict[str, Any]] = {}
_HEALTH_LOCK = threading.Lock()


def record_ok(camera_id: str) -> None:
    with _HEALTH_LOCK:
        st = _HEALTH.setdefault(camera_id, {})
        st.update(state="ok", fails=0, code=None, ok_at=time.time(), checked_at=time.time())


def record_fail(camera_id: str, code: str) -> None:
    with _HEALTH_LOCK:
        st = _HEALTH.setdefault(camera_id, {"fails": 0})
        st["fails"] = int(st.get("fails") or 0) + 1
        st["code"] = code if re.fullmatch(r"[a-z0-9_]{1,40}", code or "") else "failed"
        st["checked_at"] = time.time()
        if st["fails"] >= FAIL_CONFIRM:
            if st.get("state") != "failing":
                st["since"] = time.time()
            st["state"] = "failing"
        else:
            st.setdefault("state", "unknown")


def forget_health(camera_id: str) -> None:
    with _HEALTH_LOCK:
        _HEALTH.pop(camera_id, None)


def reset_health() -> None:
    with _HEALTH_LOCK:
        _HEALTH.clear()


def failing() -> dict[str, dict[str, Any]]:
    with _HEALTH_LOCK:
        return {k: dict(v) for k, v in _HEALTH.items() if v.get("state") == "failing"}


def _iso(ts: Any) -> str | None:
    import datetime as dt

    return dt.datetime.fromtimestamp(float(ts), dt.timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ") if ts else None


def health_view(camera_id: str) -> dict[str, Any]:
    with _HEALTH_LOCK:
        st = dict(_HEALTH.get(camera_id) or {})
    return {"state": st.get("state") or "unknown", "code": st.get("code") if st.get("state") == "failing" else None,
            "checked_at": _iso(st.get("checked_at")), "ok_at": _iso(st.get("ok_at")), "since": _iso(st.get("since")) if st.get("state") == "failing" else None}


FAIL_TEXT = "מקור הווידאו הידני של המצלמה אינו עובד"


def tick(conn: sqlite3.Connection, now: Any) -> dict[str, int]:
    """The notification pass (inside notify_sources.tick; no device I/O here): every camera with a manual source that is failing ->
    `camera.source` (one row per camera); a source that works again, was changed or removed resolves its row."""
    from . import notify
    from .notify_policy import get_policy
    from .notify_sources import held, reconcile as reconcile_rows

    ts = now.timestamp()
    hold = int((get_policy(conn, "camera.source") or {}).get("after_s") or 0)
    try:
        rows = conn.execute("""SELECT c.id, c.alias, c.name_source, c.channel FROM camera_stream_sources s JOIN cameras c ON c.id = s.camera_id
                               WHERE c.enabled = 1 ORDER BY c.sort_order, c.channel LIMIT 500""").fetchall()
    except sqlite3.OperationalError:
        rows = []
    bad = failing()
    due: dict[str, Any] = {}
    active: set[str] = set()
    for r in rows:
        name = str(r["alias"] or r["name_source"] or f"מצלמה {r['channel']}")
        on = str(r["id"]) in bad
        sig = notify.Signal("camera.source", "camera", r["id"], params={"name": name, "detail": FAIL_TEXT, "place": name}, origin={"camera_id": r["id"]},
                            link=f"#/live/cameras/{r['id']}")
        key = notify.dedupe_key_of(sig)
        if on:
            active.add(key)
        if held(key, on, hold, ts):
            due[key] = sig
    return {"camera.source": reconcile_rows(conn, "camera.source", due, active, now)}


def _status(db: Database, camera_id: str, ok: bool) -> None:
    """A camera without a recorder has no discovery: its catalogue status follows its source's health."""
    try:
        with db.connection(label="camera sources status") as conn:
            conn.execute("UPDATE cameras SET status = ?, last_seen_at = CASE WHEN ? THEN ? ELSE last_seen_at END, updated_at = ? WHERE id = ? AND recorder_id = ?",
                         ("online" if ok else "offline", int(ok), now_iso(), now_iso(), camera_id, STANDALONE))
    except sqlite3.Error as exc:
        log.warning("camera source status not stored: %s", type(exc).__name__)


def check_once(db: Database, settings: Settings, force: bool = False) -> int:
    """One poller pass: the manual sources whose last check is older than CHECK_EVERY_S (at most PER_PASS), each one frame of its sub
    stream (ensured from the stored address first). No database connection is held while go2rtc / the camera answers."""
    if not settings.go2rtc_url:
        return 0
    with db.connection(mode="read", label="camera sources health") as conn:
        try:
            rows = conn.execute("SELECT c.* FROM camera_stream_sources s JOIN cameras c ON c.id = s.camera_id WHERE c.enabled = 1 ORDER BY c.sort_order").fetchall()
        except sqlite3.OperationalError:
            return 0
        cams = [with_source(conn, r) for r in rows]
    now = time.time()
    with _HEALTH_LOCK:
        last = {k: v.get("checked_at") or 0 for k, v in _HEALTH.items()}
    due = [c for c in cams if force or now - (last.get(str(c["id"])) or 0) >= CHECK_EVERY_S]
    due.sort(key=lambda c: last.get(str(c["id"])) or 0)
    done = 0
    for cam in due[:PER_PASS]:
        if POLLER.stop_evt.is_set() and not force:
            break
        try:
            data = snapshot(settings, cam)
            ok = True
            try:
                (settings.data_dir / "snapshots").mkdir(parents=True, exist_ok=True)
                (settings.data_dir / "snapshots" / f"{cam['id']}.jpg").write_bytes(data)
            except OSError:
                pass
        except ApiError:
            ok = False
        except Exception:  # noqa: BLE001 - one camera never stops the others
            log.exception("camera source check failed")
            ok = False
        if is_standalone(cam):
            _status(db, str(cam["id"]), ok)
        done += 1
    return done


class Poller:
    def __init__(self) -> None:
        self.thread: threading.Thread | None = None
        self.stop_evt = threading.Event()

    def start(self, db: Database, settings: Settings) -> None:
        if os.environ.get("SW_CAMERA_SOURCE_HEALTH", "1") == "0" or (self.thread and self.thread.is_alive()):
            return
        self.stop_evt.clear()
        self.thread = threading.Thread(target=self._loop, args=(db, settings), name="camera-source-health", daemon=True)
        self.thread.start()

    def shutdown(self, timeout: float = 3.0) -> None:
        self.stop_evt.set()
        t = self.thread
        if t is not None and t is not threading.current_thread():
            t.join(timeout=timeout)

    def _loop(self, db: Database, settings: Settings) -> None:
        if self.stop_evt.wait(30.0):
            return
        while not self.stop_evt.is_set():
            try:
                check_once(db, settings)
            except Exception:  # noqa: BLE001 - the poller never dies on one bad pass
                log.exception("camera source health pass failed")
            self.stop_evt.wait(TICK_S)


POLLER = Poller()
