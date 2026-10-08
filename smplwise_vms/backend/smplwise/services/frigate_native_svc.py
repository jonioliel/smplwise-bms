"""Frigate-native exports, cases and manual events (NN5 F2b, docs/changes/CR-029-FRIGATE-PROVIDER.md section 11).

Same model of a write as `frigate_control_svc` (permission on the camera or the installation -> the class switched on for the recorder ->
read before, ONE write, read back -> a change-log row and an audit row -> undo from the log), with three additions that exist because the
wire shapes of these calls are NOT verified against a real Frigate:

- the "first supervised write" flag (`frigate_first_write`): the first write of each kind toward a recorder is refused (409
  `frigate_first_write_unsupervised`) unless the request says `supervised: true` and comes from a holder of system.configure; the flag is
  stored once Frigate accepted that write. It is the owner's "watch the first one" rule in code, and it keeps every automatic action of a kind
  from writing before a person saw one real write of that kind.
- ownership: Arx renames or deletes only the exports and cases it created itself (`frigate_native_objects`), and ends only the manual events it
  created (their `event_create` change rows). Frigate's own objects are never touched.
- only `delete` and an undo that deletes ask for a per-action confirmation; a create or rename does not.

Nothing here retries, queues or targets more than one camera."""
from __future__ import annotations

import sqlite3
import time
from typing import Any

from ..audit import audit
from ..db import now_iso
from ..errors import ApiError
from ..rbac import INSTALLATION, Principal, authorize, require
from .access import camera_allowed, require_camera
from . import frigate_control_svc as cs
from .recorders import frigate_control as fc
from .recorders.frigate import FrigateAdapter

SUPERVISED_KINDS = ("export_create", "export_rename", "export_delete", "case_create", "case_rename", "case_delete", "event_create", "event_end", "profile_auto", "clip_read",
                   "config_zone", "config_settings")   # FRGS: zones and camera settings (config class)
CONFIGURE = "system.configure"
NOW = time.time   # tests replace it


# ---------------------------------------------------------------------------------------------- the first supervised write

def first_writes(conn: sqlite3.Connection, recorder_id: str) -> dict[str, bool]:
    done = {r["kind"] for r in conn.execute("SELECT kind FROM frigate_first_write WHERE recorder_id = ?", (recorder_id,)).fetchall()}
    return {k: k in done for k in SUPERVISED_KINDS}


def supervised_ok(conn: sqlite3.Connection, recorder_id: str, kind: str) -> bool:
    return conn.execute("SELECT 1 FROM frigate_first_write WHERE recorder_id = ? AND kind = ?", (recorder_id, kind)).fetchone() is not None


def check_supervised(conn: sqlite3.Connection, principal: Principal, recorder_id: str, kind: str, supervised: bool, request_id: str | None) -> None:
    """Refuse the first write of a kind unless a system administrator says they are watching it."""
    if supervised_ok(conn, recorder_id, kind):
        return
    if not supervised:
        audit(conn, actor=principal, action=f"frigate.control.{kind}", decision="denied", resource_type="recorder", resource_id=recorder_id, reason="first_write_unsupervised", request_id=request_id)
        raise ApiError(409, "frigate_first_write_unsupervised", "זו הכתיבה הראשונה מסוג זה אל Frigate. מנהל מערכת צריך לבצע אותה בפיקוח ולאשר זאת במפורש.", details={"kind": kind})
    require(conn, principal, CONFIGURE, INSTALLATION)


def mark_first_write(conn: sqlite3.Connection, principal: Principal, recorder_id: str, kind: str) -> None:
    conn.execute("INSERT OR IGNORE INTO frigate_first_write(recorder_id, kind, confirmed_by, confirmed_at) VALUES (?,?,?,?)", (recorder_id, kind, getattr(principal, "user_id", None), now_iso()))


# ---------------------------------------------------------------------------------------------- what Arx created

def _remember(conn: sqlite3.Connection, principal: Principal, rid: str, kind: str, object_id: str, name: str, cam: sqlite3.Row | None = None, start: float | None = None, end: float | None = None) -> None:
    conn.execute("INSERT OR REPLACE INTO frigate_native_objects(recorder_id, kind, object_id, name, camera_id, camera_key, start_ts, end_ts, created_by, created_at, deleted_at) VALUES (?,?,?,?,?,?,?,?,?,?,NULL)",
                 (rid, kind, object_id, name, cam["id"] if cam is not None else None, cam["source_ref"] if cam is not None else None, start, end, getattr(principal, "user_id", None), now_iso()))


def _owned(conn: sqlite3.Connection, rid: str, kind: str, object_id: str) -> sqlite3.Row:
    row = conn.execute("SELECT * FROM frigate_native_objects WHERE recorder_id = ? AND kind = ? AND object_id = ? AND deleted_at IS NULL", (rid, kind, object_id)).fetchone()
    if row is None:
        raise ApiError(409, "frigate_object_not_arx", "Arx משנה או מוחק רק פריטים שהוא יצר בעצמו.", details={"kind": kind})
    return row


def _forget(conn: sqlite3.Connection, rid: str, kind: str, object_id: str) -> None:
    conn.execute("UPDATE frigate_native_objects SET deleted_at = ? WHERE recorder_id = ? AND kind = ? AND object_id = ?", (now_iso(), rid, kind, object_id))


# ---------------------------------------------------------------------------------------------- exports

def list_exports(conn: sqlite3.Connection, principal: Principal, adapter: FrigateAdapter) -> list[dict[str, Any]]:
    """Frigate's exports for the cameras the caller may export; `arx_created` marks the ones Arx may rename / delete."""
    rid = adapter.recorder_id
    cams = {r["source_ref"]: r["id"] for r in conn.execute("SELECT id, source_ref FROM cameras WHERE recorder_id = ? AND source_ref IS NOT NULL", (rid,)).fetchall()}
    mine = {r["object_id"] for r in conn.execute("SELECT object_id FROM frigate_native_objects WHERE recorder_id = ? AND kind = 'export' AND deleted_at IS NULL", (rid,)).fetchall()}
    out = []
    for x in fc.FrigateControl(adapter).list_exports():
        cid = cams.get(x["camera"] or "")
        if cid is None or not camera_allowed(conn, principal, cid, "video.export"):
            continue
        out.append({**x, "camera_id": cid, "arx_created": x["id"] in mine})
    return out


def _find_export(ctl: fc.FrigateControl, export_id: str) -> dict[str, Any] | None:
    for x in ctl.list_exports():
        if x["id"] == export_id:
            return x
    return None


def create_export(conn: sqlite3.Connection, principal: Principal, adapter: FrigateAdapter, cam: sqlite3.Row, start: float, end: float, name: str, *, supervised: bool,
                  request_id: str | None) -> dict[str, Any]:
    rid = adapter.recorder_id
    require_camera(conn, principal, cam["id"], "video.export")
    cs._gate(conn, principal, rid, "exports", cam["id"], confirm=False, request_id=request_id, what="export_create", needs_confirm=False)
    check_supervised(conn, principal, rid, "export_create", supervised, request_id)
    if end > NOW() + 60:
        raise ApiError(422, "frigate_export_range_invalid", "טווח הייצוא אינו תקין.")
    ctl = fc.FrigateControl(adapter)
    want = ctl._name(name)
    base = dict(recorder_id=rid, camera_id=cam["id"], camera_key=cam["source_ref"], cls="exports", kind="export_create", request_id=request_id)
    after = {"name": want, "camera": cam["source_ref"], "start": start, "end": end}
    known = {x["id"] for x in ctl.list_exports()}
    try:
        eid = ctl.create_export(cam["source_ref"], start, end, want)
    except ApiError as exc:
        raise cs._failed(conn, principal, exc, target=want[:60], before=None, after=after, state_hash=None, **base) from None
    verified = False
    try:
        if eid:
            verified = _find_export(ctl, eid) is not None
        else:
            fresh = [x for x in ctl.list_exports() if x["id"] not in known and x["camera"] == cam["source_ref"] and x["name"] == want]
            if len(fresh) == 1:
                eid, verified = fresh[0]["id"], True
    except ApiError:
        verified = False
    cid = cs._log(conn, principal, target=eid or want[:60], before=None, after={**after, "id": eid or None}, state_hash=None, status="applied" if verified else "unverified",
                  reversible=bool(eid), **base)
    if eid:
        _remember(conn, principal, rid, "export", eid, want, cam, start, end)
    mark_first_write(conn, principal, rid, "export_create")
    return {"created": True, "export_id": eid or None, "verified": verified, "change_id": cid}


def rename_export(conn: sqlite3.Connection, principal: Principal, adapter: FrigateAdapter, export_id: str, name: str, *, supervised: bool, request_id: str | None) -> dict[str, Any]:
    rid = adapter.recorder_id
    own = _owned(conn, rid, "export", export_id)
    cs._gate(conn, principal, rid, "exports", own["camera_id"], confirm=False, request_id=request_id, what="export_rename", needs_confirm=False)
    check_supervised(conn, principal, rid, "export_rename", supervised, request_id)
    ctl = fc.FrigateControl(adapter)
    want = ctl._name(name)
    cur = _find_export(ctl, export_id)
    if cur is None:
        raise ApiError(404, "not_found", "הייצוא לא נמצא ב־Frigate.")
    base = dict(recorder_id=rid, camera_id=own["camera_id"], camera_key=own["camera_key"], cls="exports", kind="export_rename", target=export_id, request_id=request_id)
    if cur["name"] == want:
        return {"changed": False, "export_id": export_id, "name": want, "verified": True, "change_id": None}
    try:
        ctl.rename_export(export_id, want)
    except ApiError as exc:
        raise cs._failed(conn, principal, exc, before={"name": cur["name"]}, after={"name": want}, state_hash=None, **base) from None
    try:
        now = _find_export(ctl, export_id)
        verified = now is not None and now["name"] == want
    except ApiError:
        verified = False
    cid = cs._log(conn, principal, before={"name": cur["name"]}, after={"name": want}, state_hash=None, status="applied" if verified else "unverified", **base)
    conn.execute("UPDATE frigate_native_objects SET name = ? WHERE recorder_id = ? AND kind = 'export' AND object_id = ?", (want, rid, export_id))
    mark_first_write(conn, principal, rid, "export_rename")
    return {"changed": True, "export_id": export_id, "name": want, "verified": verified, "change_id": cid}


def delete_export(conn: sqlite3.Connection, principal: Principal, adapter: FrigateAdapter, export_id: str, *, confirm: bool, supervised: bool, request_id: str | None) -> dict[str, Any]:
    rid = adapter.recorder_id
    own = _owned(conn, rid, "export", export_id)
    cs._gate(conn, principal, rid, "exports", own["camera_id"], confirm=confirm, request_id=request_id, what="export_delete", needs_confirm=True)
    check_supervised(conn, principal, rid, "export_delete", supervised, request_id)
    ctl = fc.FrigateControl(adapter)
    cur = _find_export(ctl, export_id)
    base = dict(recorder_id=rid, camera_id=own["camera_id"], camera_key=own["camera_key"], cls="exports", kind="export_delete", target=export_id, request_id=request_id)
    if cur is None:   # already gone in Frigate: nothing to write
        _forget(conn, rid, "export", export_id)
        return {"deleted": False, "export_id": export_id, "verified": True, "change_id": None}
    try:
        ctl.delete_export(export_id)
    except ApiError as exc:
        raise cs._failed(conn, principal, exc, before={"name": cur["name"]}, after=None, state_hash=None, **base) from None
    try:
        verified = _find_export(ctl, export_id) is None
    except ApiError:
        verified = False
    cid = cs._log(conn, principal, before={"name": cur["name"]}, after=None, state_hash=None, status="applied" if verified else "unverified", reversible=False, **base)
    _forget(conn, rid, "export", export_id)
    mark_first_write(conn, principal, rid, "export_delete")
    return {"deleted": True, "export_id": export_id, "verified": verified, "change_id": cid}


# ---------------------------------------------------------------------------------------------- cases

def list_cases(conn: sqlite3.Connection, principal: Principal, adapter: FrigateAdapter) -> list[dict[str, Any]]:
    rid = adapter.recorder_id
    mine = {r["object_id"] for r in conn.execute("SELECT object_id FROM frigate_native_objects WHERE recorder_id = ? AND kind = 'case' AND deleted_at IS NULL", (rid,)).fetchall()}
    return [{**x, "arx_created": x["id"] in mine} for x in fc.FrigateControl(adapter).list_cases()]


def _find_case(ctl: fc.FrigateControl, case_id: str) -> dict[str, Any] | None:
    for x in ctl.list_cases():
        if x["id"] == case_id:
            return x
    return None


def create_case(conn: sqlite3.Connection, principal: Principal, adapter: FrigateAdapter, name: str, description: str | None, *, supervised: bool, request_id: str | None) -> dict[str, Any]:
    rid = adapter.recorder_id
    cs._gate(conn, principal, rid, "cases", None, confirm=False, request_id=request_id, what="case_create", needs_confirm=False)
    check_supervised(conn, principal, rid, "case_create", supervised, request_id)
    ctl = fc.FrigateControl(adapter)
    want = ctl._name(name)
    known = {x["id"] for x in ctl.list_cases()}
    base = dict(recorder_id=rid, camera_id=None, camera_key=None, cls="cases", kind="case_create", request_id=request_id)
    after = {"name": want, "description": (description or "").strip()}
    try:
        cid_ = ctl.create_case(want, description)
    except ApiError as exc:
        raise cs._failed(conn, principal, exc, target=want[:60], before=None, after=after, state_hash=None, **base) from None
    verified = False
    try:
        if cid_:
            verified = _find_case(ctl, cid_) is not None
        else:
            fresh = [x for x in ctl.list_cases() if x["id"] not in known and x["name"] == want]
            if len(fresh) == 1:
                cid_, verified = fresh[0]["id"], True
    except ApiError:
        verified = False
    ch = cs._log(conn, principal, target=cid_ or want[:60], before=None, after={**after, "id": cid_ or None}, state_hash=None, status="applied" if verified else "unverified", reversible=bool(cid_), **base)
    if cid_:
        _remember(conn, principal, rid, "case", cid_, want)
    mark_first_write(conn, principal, rid, "case_create")
    return {"created": True, "case_id": cid_ or None, "verified": verified, "change_id": ch}


def rename_case(conn: sqlite3.Connection, principal: Principal, adapter: FrigateAdapter, case_id: str, name: str, *, supervised: bool, request_id: str | None) -> dict[str, Any]:
    rid = adapter.recorder_id
    _owned(conn, rid, "case", case_id)
    cs._gate(conn, principal, rid, "cases", None, confirm=False, request_id=request_id, what="case_rename", needs_confirm=False)
    check_supervised(conn, principal, rid, "case_rename", supervised, request_id)
    ctl = fc.FrigateControl(adapter)
    want = ctl._name(name)
    cur = _find_case(ctl, case_id)
    if cur is None:
        raise ApiError(404, "not_found", "התיק לא נמצא ב־Frigate.")
    base = dict(recorder_id=rid, camera_id=None, camera_key=None, cls="cases", kind="case_rename", target=case_id, request_id=request_id)
    if cur["name"] == want:
        return {"changed": False, "case_id": case_id, "name": want, "verified": True, "change_id": None}
    try:
        ctl.rename_case(case_id, want)
    except ApiError as exc:
        raise cs._failed(conn, principal, exc, before={"name": cur["name"]}, after={"name": want}, state_hash=None, **base) from None
    try:
        now = _find_case(ctl, case_id)
        verified = now is not None and now["name"] == want
    except ApiError:
        verified = False
    ch = cs._log(conn, principal, before={"name": cur["name"]}, after={"name": want}, state_hash=None, status="applied" if verified else "unverified", **base)
    conn.execute("UPDATE frigate_native_objects SET name = ? WHERE recorder_id = ? AND kind = 'case' AND object_id = ?", (want, rid, case_id))
    mark_first_write(conn, principal, rid, "case_rename")
    return {"changed": True, "case_id": case_id, "name": want, "verified": verified, "change_id": ch}


def delete_case(conn: sqlite3.Connection, principal: Principal, adapter: FrigateAdapter, case_id: str, *, confirm: bool, supervised: bool, request_id: str | None) -> dict[str, Any]:
    rid = adapter.recorder_id
    _owned(conn, rid, "case", case_id)
    cs._gate(conn, principal, rid, "cases", None, confirm=confirm, request_id=request_id, what="case_delete", needs_confirm=True)
    check_supervised(conn, principal, rid, "case_delete", supervised, request_id)
    ctl = fc.FrigateControl(adapter)
    cur = _find_case(ctl, case_id)
    base = dict(recorder_id=rid, camera_id=None, camera_key=None, cls="cases", kind="case_delete", target=case_id, request_id=request_id)
    if cur is None:
        _forget(conn, rid, "case", case_id)
        return {"deleted": False, "case_id": case_id, "verified": True, "change_id": None}
    try:
        ctl.delete_case(case_id)
    except ApiError as exc:
        raise cs._failed(conn, principal, exc, before={"name": cur["name"]}, after=None, state_hash=None, **base) from None
    try:
        verified = _find_case(ctl, case_id) is None
    except ApiError:
        verified = False
    ch = cs._log(conn, principal, before={"name": cur["name"]}, after=None, state_hash=None, status="applied" if verified else "unverified", reversible=False, **base)
    _forget(conn, rid, "case", case_id)
    mark_first_write(conn, principal, rid, "case_delete")
    return {"deleted": True, "case_id": case_id, "verified": verified, "change_id": ch}


# ---------------------------------------------------------------------------------------------- manual events

def create_event(conn: sqlite3.Connection, principal: Principal, adapter: FrigateAdapter, cam: sqlite3.Row, label: str, *, duration_s: int | None, sub_label: str | None,
                 supervised: bool, request_id: str | None) -> dict[str, Any]:
    rid = adapter.recorder_id
    cs._gate(conn, principal, rid, "events", cam["id"], confirm=False, request_id=request_id, what="event_create", needs_confirm=False)
    check_supervised(conn, principal, rid, "event_create", supervised, request_id)
    if not cam["enabled"]:
        raise ApiError(409, "camera_disabled", "המצלמה מושבתת במערכת.")
    ctl = fc.FrigateControl(adapter)
    base = dict(recorder_id=rid, camera_id=cam["id"], camera_key=cam["source_ref"], cls="events", kind="event_create", request_id=request_id)
    after = {"camera": cam["source_ref"], "label": label, "duration_s": duration_s, "sub_label": (sub_label or "").strip() or None}
    try:
        eid = ctl.create_event(cam["source_ref"], label, duration_s=duration_s, sub_label=sub_label)
    except ApiError as exc:
        raise cs._failed(conn, principal, exc, target=label[:40], before=None, after=after, state_hash=None, **base) from None
    verified = False
    if eid:
        try:
            d = ctl.event_detail(eid)
            verified = d["camera"] in (None, cam["source_ref"])
        except ApiError:
            verified = False
    ch = cs._log(conn, principal, target=eid or label[:40], before=None, after={**after, "id": eid or None}, state_hash=None, status="applied" if verified else "unverified", reversible=bool(eid), **base)
    mark_first_write(conn, principal, rid, "event_create")
    return {"created": True, "event_id": eid or None, "open": duration_s is None, "verified": verified, "change_id": ch}


def _manual_event(conn: sqlite3.Connection, rid: str, event_id: str) -> sqlite3.Row:
    row = conn.execute("SELECT * FROM frigate_changes WHERE recorder_id = ? AND kind = 'event_create' AND target = ? AND status IN ('applied','unverified','reverted') ORDER BY created_at DESC LIMIT 1", (rid, event_id)).fetchone()
    if row is None:
        raise ApiError(409, "frigate_object_not_arx", "Arx מסיים רק אירועים ידניים שהוא יצר בעצמו.", details={"kind": "event"})
    return row


def end_event(conn: sqlite3.Connection, principal: Principal, adapter: FrigateAdapter, event_id: str, *, supervised: bool, request_id: str | None) -> dict[str, Any]:
    rid = adapter.recorder_id
    made = _manual_event(conn, rid, event_id)
    cs._gate(conn, principal, rid, "events", made["camera_id"], confirm=False, request_id=request_id, what="event_end", needs_confirm=False)
    check_supervised(conn, principal, rid, "event_end", supervised, request_id)
    ctl = fc.FrigateControl(adapter)
    cur = ctl.event_detail(event_id)
    base = dict(recorder_id=rid, camera_id=made["camera_id"], camera_key=made["camera_key"], cls="events", kind="event_end", target=event_id, request_id=request_id)
    if cur["end_time"] is not None:
        return {"ended": False, "event_id": event_id, "verified": True, "change_id": None}
    when = NOW()
    try:
        ctl.end_event(event_id, when)
    except ApiError as exc:
        raise cs._failed(conn, principal, exc, before={"end_time": None}, after={"end_time": when}, state_hash=None, **base) from None
    try:
        verified = ctl.event_detail(event_id)["end_time"] is not None
    except ApiError:
        verified = False
    ch = cs._log(conn, principal, before={"end_time": None}, after={"end_time": when}, state_hash=None, status="applied" if verified else "unverified", reversible=False, **base)
    mark_first_write(conn, principal, rid, "event_end")
    return {"ended": True, "event_id": event_id, "verified": verified, "change_id": ch}


# ---------------------------------------------------------------------------------------------- undo of the new kinds

INVERSE_KIND = {"export_create": "export_delete", "export_rename": "export_rename", "case_create": "case_delete", "case_rename": "case_rename", "event_create": "event_end"}
UNDO_CONFIRMS = frozenset({"export_create", "case_create"})   # their inverse deletes something


def revert_kind(conn: sqlite3.Connection, adapter: FrigateAdapter, row: sqlite3.Row, before: Any, after: Any) -> bool:
    """Apply the inverse of one logged change of a new kind and return whether it read back. The caller checked the class gates, the
    first-supervised-write flag and the confirmation; a changed state raises 409 `frigate_change_stale`."""
    kind, target, rid = row["kind"], row["target"], adapter.recorder_id
    ctl = fc.FrigateControl(adapter)

    def stale() -> ApiError:
        return ApiError(409, "frigate_change_stale", "המצב ב־Frigate השתנה מאז השינוי. קראו את המצב ונסו שוב.", details={"kind": kind})

    if kind == "export_create":
        _owned(conn, rid, "export", target)
        if _find_export(ctl, target) is None:
            raise stale()
        ctl.delete_export(target)
        _forget(conn, rid, "export", target)
        return _find_export(ctl, target) is None
    if kind == "export_rename":
        _owned(conn, rid, "export", target)
        cur = _find_export(ctl, target)
        if cur is None or cur["name"] != after["name"]:
            raise stale()
        ctl.rename_export(target, before["name"])
        conn.execute("UPDATE frigate_native_objects SET name = ? WHERE recorder_id = ? AND kind = 'export' AND object_id = ?", (before["name"], rid, target))
        now = _find_export(ctl, target)
        return now is not None and now["name"] == before["name"]
    if kind == "case_create":
        _owned(conn, rid, "case", target)
        if _find_case(ctl, target) is None:
            raise stale()
        ctl.delete_case(target)
        _forget(conn, rid, "case", target)
        return _find_case(ctl, target) is None
    if kind == "case_rename":
        _owned(conn, rid, "case", target)
        cur = _find_case(ctl, target)
        if cur is None or cur["name"] != after["name"]:
            raise stale()
        ctl.rename_case(target, before["name"])
        conn.execute("UPDATE frigate_native_objects SET name = ? WHERE recorder_id = ? AND kind = 'case' AND object_id = ?", (before["name"], rid, target))
        now = _find_case(ctl, target)
        return now is not None and now["name"] == before["name"]
    if kind == "event_create":
        if ctl.event_detail(target)["end_time"] is not None:
            raise stale()
        ctl.end_event(target, NOW())
        return ctl.event_detail(target)["end_time"] is not None
    raise ApiError(409, "frigate_change_not_reversible", "לא ניתן לבטל את השינוי הזה.")


def supervised_view(conn: sqlite3.Connection, principal: Principal, recorder_id: str) -> dict[str, Any]:
    """For the settings screen: which kinds already had their first supervised write, and whether this caller may give the supervision."""
    return {"done": first_writes(conn, recorder_id), "can_supervise": authorize(conn, principal, CONFIGURE, INSTALLATION).allowed}
