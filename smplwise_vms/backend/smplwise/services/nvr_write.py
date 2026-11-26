"""Writes to the NVR (owner-approved on 2026-09-17, one capability at a time).

Every change goes the same way: GET the document, derive the new one, PUT it, GET it again to verify, keep both
documents in `nvr_changes` (rollback = PUT the old one), and write an audit row. The permission that allows a
change is a sensitive one - never implied by a built-in role, granted only through a custom role. Recordings
are never touched here.
"""
from __future__ import annotations

import datetime as dt
import json
import re
import sqlite3
from collections.abc import Callable
from typing import Any

import httpx

from ..audit import audit
from ..config import Settings
from ..db import is_busy, new_id, now_iso, unlocked
from ..errors import ApiError
from ..recorder_scope import PRIMARY, camera_settings, settings_for
from . import nvr_write_guard
from .nvr import _client, _get
from . import device_http
from ..test_reset import register_reset

CENTER_BLOCK = "<EventTriggerNotification><id>center</id><notificationMethod>center</notificationMethod></EventTriggerNotification>"
SMART_TYPES = ("linedetection", "fielddetection", "regionEntrance", "regionExiting")
NOTIFY_TYPES = ("VMD",) + SMART_TYPES
TYPE_LABEL = {"VMD": "זיהוי תנועה", "linedetection": "חציית קו", "fielddetection": "פריצה לאזור", "regionEntrance": "כניסה לאזור", "regionExiting": "יציאה מאזור"}


def trigger_path(event_type: str, channel: int) -> str:
    return f"/ISAPI/Event/triggers/{event_type}-{channel}"


# ---------------------------------------------------------------- document helpers (pure)

def has_center(xml: str) -> bool:
    return re.search(r"<notificationMethod>\s*center\s*</notificationMethod>", xml) is not None


def with_center(xml: str, on: bool) -> str:
    """The trigger document with "Notify Surveillance Center" added or removed; other linkages stay as they are."""
    if on == has_center(xml):
        return xml
    if on:
        m = re.search(r"<EventTriggerNotificationList([^>]*)/>", xml)
        if m:
            return xml[: m.start()] + f"<EventTriggerNotificationList{m.group(1)}>{CENTER_BLOCK}</EventTriggerNotificationList>" + xml[m.end():]
        if "</EventTriggerNotificationList>" in xml:
            return xml.replace("</EventTriggerNotificationList>", CENTER_BLOCK + "</EventTriggerNotificationList>", 1)
        return xml.replace("</EventTrigger>", f"<EventTriggerNotificationList>{CENTER_BLOCK}</EventTriggerNotificationList></EventTrigger>", 1)
    return re.sub(r"<EventTriggerNotification>\s*<id>center</id>.*?</EventTriggerNotification>\s*", "", xml, count=1, flags=re.S)


def _normalize(xml: str) -> str:
    return re.sub(r"\s+", "", xml)


def response_status(xml: str) -> tuple[int | None, str | None]:
    """`(statusCode, subStatusCode)` of an ISAPI answer body (None when absent): the write path's view of the shared reader
    (services/device_http.py)."""
    rs = device_http.read_response_status(xml)
    return rs.code, rs.sub


# ---------------------------------------------------------------- transport

def _probe(client: httpx.Client, path: str) -> tuple[int, str]:
    r = device_http.request(client, "GET", path)
    if r.status_code == 401:  # a stale digest nonce under parallel requests: one retry answers the fresh challenge
        r = device_http.request(client, "GET", path)
    return r.status_code, r.text


def _put(client: httpx.Client, path: str, xml: str) -> str:
    r = device_http.request(client, "PUT", path, content=xml.encode("utf-8"), headers={"Content-Type": "application/xml"})
    code, sub = response_status(r.text)
    if r.status_code in (401, 403):
        if sub == "notSupport":
            raise ApiError(409, "nvr_not_supported", "ה־NVR אינו תומך בשינוי הזה בנתיב הזה.", details={"path": path})
        raise ApiError(503, "source_forbidden", "ה־NVR דחה את הכתיבה (הרשאות המשתמש ב־NVR).", details={"path": path, "status": r.status_code, "sub": sub})
    if r.status_code != 200 or (code is not None and code != 1):
        raise ApiError(409, "nvr_rejected", "ה־NVR דחה את המסמך.", details={"path": path, "status": r.status_code, "code": code, "sub": sub})
    return r.text


# ---------------------------------------------------------------- change records

def _fields(r: sqlite3.Row) -> dict[str, Any] | None:
    """CR-020 S2 frozen API shape: a stream change's field diff as an object ({"svc": [true, false]}), never a JSON string."""
    raw = r["fields_json"] if "fields_json" in r.keys() else None
    if not raw:
        return None
    try:
        value = json.loads(raw)
    except ValueError:
        return None
    return value if isinstance(value, dict) else None


def _row(r: sqlite3.Row) -> dict[str, Any]:
    return ({k: r[k] for k in r.keys() if k not in ("before_xml", "after_xml", "fields_json")}
            | {"fields": _fields(r), "has_before": bool(r["before_xml"]), "has_after": bool(r["after_xml"])})


def change_detail(r: sqlite3.Row) -> dict[str, Any]:
    """One change with both documents (the "before / after" view); the caller has checked who may see them."""
    return {k: r[k] for k in r.keys() if k != "fields_json"} | {"fields": _fields(r)}


STREAM_KIND = "stream_encoding"
VERIFY_FAILED = "verify_failed"  # BACKEND-SAFETY-2435: the device accepted the write, the read-back GET failed


def list_changes(conn: sqlite3.Connection, limit: int = 50, camera_id: str | None = None,
                 stream_visible: Callable[[str | None], bool] | None = None, recorder_id: str | None = None,
                 row_visible: Callable[[sqlite3.Row], bool] | None = None) -> list[dict[str, Any]]:
    """The newest changes. A `stream_encoding` row is listed only when `stream_visible(camera_id)` says so (CR-020 S2 review
    M1: the caller's nvr.configure camera scope); without that predicate no stream change is listed at all. CR-024:
    `recorder_id` keeps one recorder's changes. VIDEO-SECFIX-2520 (deep review V-04): `row_visible` - any other row is listed
    only when it says so (the caller's camera scope over the row's cameras, change_cameras); None = every such row."""
    conds, args = [], []
    if camera_id:
        conds.append("camera_id = ?")
        args.append(camera_id)
    if recorder_id:
        conds.append("recorder_id = ?")
        args.append(recorder_id)
    where = ("WHERE " + " AND ".join(conds)) if conds else ""
    if stream_visible is None:
        where = (where + " AND" if where else "WHERE") + " kind != ?"
        args.append(STREAM_KIND)
        if row_visible is None:
            return [_row(r) for r in conn.execute(f"SELECT * FROM nvr_changes {where} ORDER BY created_at DESC LIMIT ?", (*args, limit)).fetchall()]

    def visible(r: sqlite3.Row) -> bool:
        if r["kind"] == STREAM_KIND:
            return stream_visible is not None and stream_visible(r["camera_id"])
        return row_visible is None or row_visible(r)

    out: list[dict[str, Any]] = []
    cur = conn.execute(f"SELECT * FROM nvr_changes {where} ORDER BY created_at DESC", args)
    while len(out) < limit:
        batch = cur.fetchmany(200)
        if not batch:
            break
        out.extend(_row(r) for r in batch if visible(r))
    return out[:limit]


def get_change(conn: sqlite3.Connection, change_id: str) -> sqlite3.Row | None:
    return conn.execute("SELECT * FROM nvr_changes WHERE id = ?", (change_id,)).fetchone()


def _record(conn: sqlite3.Connection, principal: Any, *, kind: str, permission: str, target: str, path: str, before: str | None, after: str | None,
            status: str, error: str | None = None, rollback_of: str | None = None, note: str = "", recorder_id: str = PRIMARY,
            camera_id: str | None = None) -> dict[str, Any]:
    """CR-024: the row knows its recorder, so the undo reaches the same device. VIDEO-SECFIX-2520 (deep review V-04): and the
    camera whose settings it changed (None for an installation-level change), so its detail and its undo keep the camera scope
    of the write; both are part of the one INSERT (no window in which the row names the wrong recorder)."""
    cid = new_id()
    conn.execute(
        "INSERT INTO nvr_changes(id, kind, permission, target, path, before_xml, after_xml, status, error, rollback_of, note, actor_id, actor_username, created_at,"
        " recorder_id, camera_id) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)",
        (cid, kind, permission, target, path, before, after, status, error, rollback_of, note, getattr(principal, "user_id", None), getattr(principal, "username", None), now_iso(),
         recorder_id or PRIMARY, camera_id),
    )
    return _row(get_change(conn, cid))  # type: ignore[arg-type]


# VIDEO-SECFIX-2520 (deep review V-04): the change kinds that are a recorder's own settings (clock / NTP, the recorder's reboot,
# an alarm output, a disk test). Every other kind - a kind added later included - is a camera's setting (fail closed).
INSTALLATION_KINDS = frozenset({"time", "reboot", "alarm_output", "storage_test"})
_TARGET_NUMBER = re.compile(r"-(\d{1,6})$")


def change_cameras(conn: sqlite3.Connection, r: sqlite3.Row) -> tuple[bool, frozenset[str]]:
    """VIDEO-SECFIX-2520 (deep review V-04): `(camera_level, camera ids)` of a change row - which cameras' scope its detail and
    its undo must respect. An installation-level kind: `(False, {})`. Otherwise the row's own `camera_id` (written since 2.52)
    and the camera its target names on its recorder NOW (`track-<n>`: the camera whose main track it is; `<anything>-<n>`: the
    camera on channel n) - the undo writes to that channel, so its camera counts too. A row written before 2.52 has only its
    target; when no camera can be found the set is empty and the caller fails closed (the unrestricted permission)."""
    if r["kind"] in INSTALLATION_KINDS:
        return False, frozenset()
    keys = r.keys()
    ids: set[str] = set()
    stored = r["camera_id"] if "camera_id" in keys else None
    if stored:
        ids.add(str(stored))
    target = str(r["target"] or "")
    m = _TARGET_NUMBER.search(target)
    if m:
        rec_id = (r["recorder_id"] if "recorder_id" in keys else None) or PRIMARY
        n = int(m.group(1))
        if target.startswith("track-"):  # routers/nvr_write._track_of: the main track, or `<channel>01` when none is recorded
            sql, args = "SELECT id FROM cameras WHERE recorder_id = ? AND (main_track = ? OR (main_track IS NULL AND channel * 100 + 1 = ?))", (rec_id, n, n)
        else:
            sql, args = "SELECT id FROM cameras WHERE recorder_id = ? AND channel = ?", (rec_id, n)
        ids.update(str(x[0]) for x in conn.execute(sql, args).fetchall())
    return True, frozenset(ids)


def apply_change(settings: Settings, conn: sqlite3.Connection, principal: Any, *, kind: str, permission: str, target: str, path: str,
                 mutate: Callable[[str], str], note: str = "", request_id: str | None = None, client: httpx.Client | None = None, keep_before: bool = True,
                 camera_id: str | None = None) -> dict[str, Any]:
    """GET → mutate → PUT → GET-verify → record + audit. `unchanged` when the document already says what was asked.
    The caller holds the request's connection; NVR I/O happens on `client` (opened here unless given).
    CR-024: `settings` is the TARGET recorder's settings (recorder_scope.camera_settings / settings_for); the change log row
    records that recorder.
    keep_before=False records no previous document, so the change cannot be rolled back (a clock write, for one).
    CR-NVR-GUARD-2438: refused (409 nvr_writes_off, audited, nothing sent) while the recorder's settings switch is off.
    VIDEO-SECFIX-2520 (deep review V-04): `camera_id` - the camera whose setting this is (None for a recorder-level change); the
    row keeps it so the change's detail and undo apply the same camera scope as this write."""
    nvr_write_guard.guard(settings, conn, principal, kind, request_id=request_id, target=target)
    own = client is None
    c = client or _client(settings)
    try:
        before = _get(c, path)
        after = mutate(before)
        if after == before or _normalize(after) == _normalize(before):  # a rebuilt document may differ only in whitespace
            return _record(conn, principal, kind=kind, permission=permission, target=target, path=path, before=before if keep_before else None, after=after, status="unchanged", note=note, recorder_id=settings.nvr_recorder_id, camera_id=camera_id)
        try:
            _put(c, path, after)
        except ApiError as exc:
            rec = _record(conn, principal, kind=kind, permission=permission, target=target, path=path, before=before, after=after, status="failed", error=exc.code, note=note, recorder_id=settings.nvr_recorder_id, camera_id=camera_id)
            audit(conn, actor=principal, action="nvr.write", decision="denied", resource_type="nvr", resource_id=target, reason=exc.code, request_id=request_id, details={"kind": kind, "path": path, "change_id": rec["id"]})
            raise
        try:
            verify = _get(c, path)
        except ApiError as exc:
            # BACKEND-SAFETY-2435 (review 03 F01): the device ACCEPTED the PUT, only the read-back failed. The change is
            # recorded (status applied, error verify_failed, the document sent as `after`, the previous one kept for the
            # undo) and audited as unverified; the caller still receives the same error.
            rec = _record(conn, principal, kind=kind, permission=permission, target=target, path=path, before=before if keep_before else None, after=after,
                          status="applied", error=VERIFY_FAILED, note=note, recorder_id=settings.nvr_recorder_id, camera_id=camera_id)
            audit(conn, actor=principal, action="nvr.write", decision="allowed", resource_type="nvr", resource_id=target, request_id=request_id,
                  details={"kind": kind, "path": path, "change_id": rec["id"], "permission": permission, "note": note, "verified": False, "verify_error": exc.code})
            raise
    finally:
        if own:
            c.close()
    if _normalize(verify) == _normalize(before) and keep_before:
        # the device answered OK but kept its old document (e.g. a sensitivity outside the values it accepts)
        rec = _record(conn, principal, kind=kind, permission=permission, target=target, path=path, before=before, after=verify, status="no_effect", note=note, recorder_id=settings.nvr_recorder_id, camera_id=camera_id)
        audit(conn, actor=principal, action="nvr.write", decision="denied", resource_type="nvr", resource_id=target, reason="no_effect", request_id=request_id, details={"kind": kind, "path": path, "change_id": rec["id"]})
        raise ApiError(409, "nvr_no_effect", "ה־NVR אישר את הכתיבה אבל לא שינה את ההגדרה (ערך מחוץ לטווח שהמכשיר מקבל?).", details={"path": path, "change_id": rec["id"]})
    rec = _record(conn, principal, kind=kind, permission=permission, target=target, path=path, before=before if keep_before else None, after=verify, status="applied", note=note, recorder_id=settings.nvr_recorder_id, camera_id=camera_id)
    audit(conn, actor=principal, action="nvr.write", decision="allowed", resource_type="nvr", resource_id=target, request_id=request_id,
          details={"kind": kind, "path": path, "change_id": rec["id"], "permission": permission, "note": note})
    return rec


CHANGED_SINCE_TEXT = "ההגדרה במכשיר שונתה מאז השינוי הזה; ההחזרה תדרוס את מה שיש בו עכשיו. אפשר לאשר החזרה בכל זאת."
ALREADY_ROLLED_BACK_TEXT = "השינוי הזה כבר הוחזר."


def rollback(settings: Settings, conn: sqlite3.Connection, principal: Any, change_id: str, *, request_id: str | None = None, client: httpx.Client | None = None,
             force: bool = False) -> dict[str, Any]:
    """PUT the document the change replaced; recorded as its own change pointing back at the original.
    CAST-RELAY-HARDEN-2540 (deep review V-03): like the privacy-mask and encoding undo, only while the device still holds what the
    change left: the document is read first and compared (whitespace aside) with the change's `after`; when it differs the undo is
    refused (409 `changed_since`, audited, nothing written) - a later change, or an edit in the recorder's own screens, would be
    overwritten. A change already undone is refused too (409 `already_rolled_back`). `force=True` (the caller's explicit
    confirmation, body `{"force": true}`) skips both checks and writes the old document anyway.
    LISTENER-DEADLINE-2540: the document is read in every case, and the undo records what it actually overwrote as its `before`
    (as a write does), so a forced undo over a newer device state can itself be undone back to that state; its audit row says
    `overwrote_device_change: true`."""
    orig = get_change(conn, change_id)
    if not orig:
        raise ApiError(404, "not_found", "השינוי לא נמצא.")
    if orig["kind"] == "stream_encoding":
        # CR-020 S2: an encoding change is undone only by services/nvr_settings.rollback_stream (nvr.configure on the camera,
        # confirm, etag-of-after check, two phases). This generic path must never PUT its document.
        raise ApiError(409, "not_rollbackable", "שינוי קידוד מבוטל רק דרך מסך הגדרות המצלמות.", details={"kind": orig["kind"]})
    rec_id = orig["recorder_id"] if "recorder_id" in orig.keys() else PRIMARY
    # CR-NVR-GUARD-2438: an undo is a settings change on the recorder the change was made on - its switch decides
    nvr_write_guard.guard(settings_for(settings, rec_id), conn, principal, orig["kind"], request_id=request_id, target=orig["target"])
    if orig["kind"] == "privacy_mask":
        # NVRMASK-295: PUT of the old document does not remove stored regions on the lab firmware (it merges); the privacy
        # module restores the original exactly (PUT + DELETE of the added regions + verified read-back).
        from .nvr_privacy import restore_change

        return restore_change(settings, conn, principal, change_id, request_id=request_id, client=client)
    if orig["status"] not in ("applied", "rolled_back") or not orig["before_xml"]:
        raise ApiError(409, "not_rollbackable", "אין לשינוי הזה מסמך קודם להחזיר.", details={"status": orig["status"]})
    if orig["status"] == "rolled_back" and not force:
        audit(conn, actor=principal, action="nvr.rollback", decision="denied", resource_type="nvr", resource_id=orig["target"], reason="already_rolled_back",
              request_id=request_id, details={"kind": orig["kind"], "path": orig["path"], "rollback_of": change_id})
        raise ApiError(409, "already_rolled_back", ALREADY_ROLLED_BACK_TEXT, details={"change_id": change_id, "force_allowed": True})
    settings = settings_for(settings, rec_id)  # CR-024: the undo goes to the recorder the change was made on
    own = client is None
    c = client or _client(settings)
    try:
        current = _get(c, orig["path"])  # LISTENER-DEADLINE-2540: read even when forced - the undo's `before` is what it overwrites
        changed = not orig["after_xml"] or _normalize(current) != _normalize(orig["after_xml"])
        if changed and not force:
            audit(conn, actor=principal, action="nvr.rollback", decision="denied", resource_type="nvr", resource_id=orig["target"], reason="changed_since",
                  request_id=request_id, details={"kind": orig["kind"], "path": orig["path"], "rollback_of": change_id})
            raise ApiError(409, "changed_since", CHANGED_SINCE_TEXT, details={"change_id": change_id, "force_allowed": True})
        _put(c, orig["path"], orig["before_xml"])
        try:
            verify = _get(c, orig["path"])
        except ApiError as exc:
            # BACKEND-SAFETY-2435 (review 03 F01): the device accepted the old document; only its read-back failed. The undo
            # is recorded as such (the document sent as `after`) and audited as unverified, then the same error is raised.
            conn.execute("UPDATE nvr_changes SET status = 'rolled_back' WHERE id = ?", (change_id,))
            rec = _record(conn, principal, kind=orig["kind"], permission=orig["permission"], target=orig["target"], path=orig["path"], before=current,
                          after=orig["before_xml"], status="applied", error=VERIFY_FAILED, rollback_of=change_id, note=f"החזר של {change_id}", recorder_id=rec_id, camera_id=orig["camera_id"] if "camera_id" in orig.keys() else None)
            audit(conn, actor=principal, action="nvr.rollback", decision="allowed", resource_type="nvr", resource_id=orig["target"], request_id=request_id,
                  details={"kind": orig["kind"], "path": orig["path"], "change_id": rec["id"], "rollback_of": change_id, "verified": False, "verify_error": exc.code})
            raise
    finally:
        if own:
            c.close()
    conn.execute("UPDATE nvr_changes SET status = 'rolled_back' WHERE id = ?", (change_id,))
    rec = _record(conn, principal, kind=orig["kind"], permission=orig["permission"], target=orig["target"], path=orig["path"], before=current, after=verify,
                  status="applied", rollback_of=change_id, note=f"החזר של {change_id}", recorder_id=rec_id, camera_id=orig["camera_id"] if "camera_id" in orig.keys() else None)
    audit(conn, actor=principal, action="nvr.rollback", decision="allowed", resource_type="nvr", resource_id=orig["target"], request_id=request_id,
          details={"kind": orig["kind"], "path": orig["path"], "change_id": rec["id"], "rollback_of": change_id, **({"forced": True} if force else {}),
                   **({"overwrote_device_change": True} if force and changed else {})})
    return rec


# ---------------------------------------------------------------- B2: motion detection grid + sensitivity

def motion_path(channel: int) -> str:
    return f"/ISAPI/System/Video/inputs/channels/{channel}/motionDetection"


_MOTION_CAPS: dict[int, dict[str, int]] = {}


def motion_capabilities(settings: Settings, channel: int, *, client: httpx.Client | None = None) -> dict[str, int]:
    """min / max / step of the sensitivity as the device reports them (cached per process); defaults 0 / 100 / 1."""
    if channel in _MOTION_CAPS:
        return _MOTION_CAPS[channel]
    own = client is None
    c = client or _client(settings)
    try:
        status, text = _probe(c, motion_path(channel) + "/capabilities")
    finally:
        if own:
            c.close()
    caps = {"min": 0, "max": 100, "step": 1}
    if status == 200:
        m = re.search(r"<sensitivityLevel([^>]*)>", text)
        if m:
            for key in ("min", "max", "step"):
                v = re.search(rf'{key}="(\d+)"', m.group(1))
                if v:
                    caps[key] = int(v.group(1))
    _MOTION_CAPS[channel] = caps
    return caps


def snap_sensitivity(value: int, caps: dict[str, int]) -> int:
    """The nearest value the device accepts (its min / max / step) - a value in between is silently ignored by the NVR."""
    step = max(1, caps.get("step", 1))
    lo, hi = caps.get("min", 0), caps.get("max", 100)
    snapped = lo + round((value - lo) / step) * step
    return max(lo, min(hi, snapped))


def bits_to_hex(cells: list[list[bool]], cols: int) -> str:
    """Inverse of nvr._hex_bits: each row packed MSB-first into ceil(cols/8) bytes, rows concatenated as hex."""
    row_bytes = (cols + 7) // 8
    width = row_bytes * 8
    out = []
    for row in cells:
        value = 0
        for c in range(cols):
            if c < len(row) and row[c]:
                value |= 1 << (width - 1 - c)
        out.append(format(value, f"0{row_bytes * 2}x"))
    return "".join(out)


def motion_document(xml: str, *, cells: list[list[bool]] | None, sensitivity: int | None, enabled: bool | None) -> str:
    """The motionDetection document with a new grid / sensitivity / enabled flag; every other setting stays as it is.
    The grid must match the device's granularity (rows x columns) - anything else is refused before any write."""
    rows_m = re.search(r"<rowGranularity>(\d+)</rowGranularity>", xml)
    cols_m = re.search(r"<columnGranularity>(\d+)</columnGranularity>", xml)
    if cells is not None:
        if not rows_m or not cols_m:
            raise ApiError(409, "nvr_not_supported", "המצלמה אינה מדווחת רשת זיהוי (regionType אינו grid).")
        rows, cols = int(rows_m.group(1)), int(cols_m.group(1))
        if len(cells) != rows or any(len(r) != cols for r in cells):
            raise ApiError(422, "validation", "הרשת אינה תואמת את המצלמה.", details={"rows": rows, "cols": cols, "got_rows": len(cells), "got_cols": len(cells[0]) if cells else 0})
        if not re.search(r"<gridMap>[0-9a-fA-F]*</gridMap>", xml):
            raise ApiError(409, "nvr_not_supported", "במסמך אין gridMap לעריכה.")
        xml = re.sub(r"<gridMap>[0-9a-fA-F]*</gridMap>", f"<gridMap>{bits_to_hex(cells, cols)}</gridMap>", xml, count=1)
    if sensitivity is not None:
        if not 0 <= sensitivity <= 100:
            raise ApiError(422, "validation", "רגישות בין 0 ל־100.")
        if not re.search(r"<sensitivityLevel>\d+</sensitivityLevel>", xml):
            raise ApiError(409, "nvr_not_supported", "במסמך אין sensitivityLevel לעריכה.")
        xml = re.sub(r"<sensitivityLevel>\d+</sensitivityLevel>", f"<sensitivityLevel>{sensitivity}</sensitivityLevel>", xml, count=1)
    if enabled is not None:
        xml = re.sub(r"(<MotionDetection[^>]*>\s*)<enabled>(true|false)</enabled>", lambda m: f"{m.group(1)}<enabled>{'true' if enabled else 'false'}</enabled>", xml, count=1)
    return xml


# ---------------------------------------------------------------- A1: manual recording (start / stop, auto-stop)

MANUAL_MAX_MIN = 120


def manual_record(settings: Settings, track_id: int, on: bool, *, client: httpx.Client | None = None) -> None:
    """PUT /ISAPI/ContentMgmt/record/control/manual/{start|stop}/tracks/<track>. The NVR answers OK and keeps no
    readable state for it (this firmware refuses the status path), so the caller records the session itself."""
    own = client is None
    c = client or _client(settings)
    try:
        _put(c, f"/ISAPI/ContentMgmt/record/control/manual/{'start' if on else 'stop'}/tracks/{track_id}", "")
    finally:
        if own:
            c.close()


def manual_active(conn: sqlite3.Connection, camera_id: str) -> sqlite3.Row | None:
    return conn.execute("SELECT * FROM manual_recordings WHERE camera_id = ? AND stopped_at IS NULL ORDER BY started_at DESC LIMIT 1", (camera_id,)).fetchone()


def manual_row(r: sqlite3.Row | None) -> dict[str, Any] | None:
    if not r:
        return None
    d = {k: r[k] for k in r.keys()}
    d["remaining_s"] = max(0, int((_parse(r["stop_at"]) - _now()).total_seconds())) if not r["stopped_at"] else 0
    return d


def start_manual(settings: Settings, conn: sqlite3.Connection, principal: Any, camera_id: str, track_id: int, minutes: int, *, request_id: str | None = None) -> dict[str, Any]:
    """Two-phase: the session row and its audit row are committed BEFORE the NVR is told to record, and the NVR call runs
    without the write lock (round-10 lock storm). Whatever happens afterwards - the NVR refuses, the database stays busy
    when the request takes the lock again - a recording the NVR may be making always has a row the janitor stops."""
    minutes = max(1, min(MANUAL_MAX_MIN, minutes))
    if manual_active(conn, camera_id):  # checked and inserted under the same lock: a parallel start gets 409
        raise ApiError(409, "already_recording", "כבר יש הקלטה ידנית פעילה למצלמה הזו.")
    rid = new_id()
    now = _now()
    details = {"track": track_id, "minutes": minutes, "id": rid}
    conn.execute("INSERT INTO manual_recordings(id, camera_id, track_id, started_at, stop_at, actor_id, actor_username) VALUES (?,?,?,?,?,?,?)",
                 (rid, camera_id, track_id, _iso(now), _iso(now + dt.timedelta(minutes=minutes)), getattr(principal, "user_id", None), getattr(principal, "username", None)))
    audit(conn, actor=principal, action="nvr.record.start", decision="allowed", resource_type="camera", resource_id=camera_id, request_id=request_id, details={**details, "phase": "attempt"})
    refused: list[ApiError] = []
    try:
        with unlocked(conn):  # commits the row and the audit row, then calls the NVR without the lock
            try:
                manual_record(settings, track_id, True)
            except ApiError as exc:
                refused.append(exc)
    except sqlite3.OperationalError as exc:
        if not is_busy(exc) or refused:
            raise
        # the NVR records, but the database stayed busy past the retries: tell it to stop again rather than leave an
        # unconfirmed recording running; the committed row stays open until the janitor closes it at stop_at
        try:
            manual_record(settings, track_id, False)
        except ApiError:
            pass
        raise
    if refused:
        conn.execute("UPDATE manual_recordings SET stopped_at = ?, stop_reason = ? WHERE id = ?", (_iso(_now()), f"start_failed:{refused[0].code}", rid))
        audit(conn, actor=principal, action="nvr.record.start", decision="denied", resource_type="camera", resource_id=camera_id, request_id=request_id,
              reason=refused[0].code, details={**details, "phase": "outcome"})
        raise refused[0]
    return manual_row(conn.execute("SELECT * FROM manual_recordings WHERE id = ?", (rid,)).fetchone()) or {}


def stop_manual(settings: Settings, conn: sqlite3.Connection, principal: Any, camera_id: str, *, reason: str = "user", request_id: str | None = None) -> dict[str, Any] | None:
    r = manual_active(conn, camera_id)
    if not r:
        return None
    with unlocked(conn):  # the NVR call runs without the write lock (round-10 lock storm)
        manual_record(settings, int(r["track_id"]), False)
    if not conn.execute("UPDATE manual_recordings SET stopped_at = ?, stop_reason = ? WHERE id = ? AND stopped_at IS NULL", (_iso(_now()), reason, r["id"])).rowcount:
        return manual_row(conn.execute("SELECT * FROM manual_recordings WHERE id = ?", (r["id"],)).fetchone())  # a parallel stop recorded it
    audit(conn, actor=principal, action="nvr.record.stop", decision="allowed", resource_type="camera", resource_id=camera_id, request_id=request_id, details={"track": int(r["track_id"]), "reason": reason, "id": r["id"]})
    return manual_row(conn.execute("SELECT * FROM manual_recordings WHERE id = ?", (r["id"],)).fetchone())


def stop_expired_manual(db: Any, settings: Settings) -> int:
    """Janitor: every manual recording whose planned stop has passed is stopped on the NVR and closed here."""
    with db.connection() as conn:
        try:
            rows = conn.execute("SELECT * FROM manual_recordings WHERE stopped_at IS NULL AND stop_at <= ?", (_iso(_now()),)).fetchall()
        except sqlite3.OperationalError:
            return 0
        n = 0
        for r in rows:
            cam = conn.execute("SELECT recorder_id FROM cameras WHERE id = ?", (r["camera_id"],)).fetchone()
            rs = camera_settings(settings, cam)  # CR-024: the camera's own recorder
            with unlocked(conn):  # the NVR call runs without the janitor holding the write lock
                try:
                    manual_record(rs, int(r["track_id"]), False)
                    reason = "expired"
                except ApiError as exc:
                    reason = f"expired_unconfirmed:{exc.code}"  # the NVR could not be told; the row still closes, the reason says so
            if not conn.execute("UPDATE manual_recordings SET stopped_at = ?, stop_reason = ? WHERE id = ? AND stopped_at IS NULL", (_iso(_now()), reason, r["id"])).rowcount:
                continue  # stopped by a user meanwhile (and audited there)
            audit(conn, actor=None, action="nvr.record.stop", decision="allowed", resource_type="camera", resource_id=r["camera_id"], reason=reason, details={"track": int(r["track_id"]), "id": r["id"]})
            n += 1
    return n


def _now() -> dt.datetime:
    return dt.datetime.now(dt.timezone.utc)


def _iso(d: dt.datetime) -> str:
    return d.astimezone(dt.timezone.utc).replace(microsecond=0).isoformat().replace("+00:00", "Z")


def _parse(s: str) -> dt.datetime:
    return dt.datetime.fromisoformat(s.replace("Z", "+00:00"))


# ---------------------------------------------------------------- B1: Notify Surveillance Center

def notify_status(settings: Settings, channels: list[int], *, client: httpx.Client | None = None) -> dict[int, dict[str, Any]]:
    """Per channel: for motion and each smart event type, whether the trigger exists and whether it notifies the
    surveillance centre (a 403 notSupport / 404 means the type is not configured for that channel)."""
    own = client is None
    c = client or _client(settings)
    out: dict[int, dict[str, Any]] = {}
    try:
        for ch in channels:
            types: dict[str, dict[str, Any]] = {}
            for t in NOTIFY_TYPES:
                status, text = _probe(c, trigger_path(t, ch))
                types[t] = {"supported": status == 200, "center": has_center(text) if status == 200 else None}
            out[ch] = types
    finally:
        if own:
            c.close()
    return out


def _reset_for_tests() -> None:
    """Test seam: puts the module-level tables back to what a freshly started process has (smplwise.test_reset; product code never calls it)."""
    _MOTION_CAPS.clear()


register_reset(__name__, ("_MOTION_CAPS",), _reset_for_tests)  # CR-SINGLETON-RESETS-2460: module-level tables (tests/test_singletons_registered.py)
