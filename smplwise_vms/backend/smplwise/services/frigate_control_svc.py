"""Frigate runtime control (NN5 F2): the rules around the writes of `recorders/frigate_control.py`.

The adapter does the I/O; this module decides, records and verifies. The model of a write, in order:

1. permission - the class's permission on the camera (or on the installation for a recorder-wide class);
2. class approval - `frigate_write_policy`: a class is OFF for a recorder until an administrator switches it on (the owner's "approve a
   class once"); default off, so an installation that never opens the settings never writes to Frigate;
3. per-action confirmation for the classes that change recording, the active profile or the physical camera (`PER_ACTION`);
4. read before (the camera's switches, hashed), ONE write, read after;
5. a change-log row with the state before and after, and an audit row; a change can be undone from the log (`revert`), provided
   the state is still what the change left (else 409 `frigate_change_stale`).

Nothing here repeats a write, queues one for later, or targets all cameras (`*` exists only for the profile slot). The `ptz` class is
released by the code flag `PTZ_RELEASED` (False): the plumbing is complete and tested, and cannot be switched on from the UI until the
owner decides (owner decision 2026-10-06, "no PTZ now, prepare the plumbing")."""
from __future__ import annotations

import json
import sqlite3
import threading
import time
from typing import Any

from ..audit import audit
from ..db import new_id, now_iso
from ..errors import ApiError
from ..rbac import INSTALLATION, Principal, authorize, require
from .access import require_camera
from .recorders import frigate_control as fc
from .recorders.frigate import FrigateAdapter

CLASSES = ("analytics", "record", "profile", "review", "events", "ptz", "exports", "cases", "config")
PERMISSION = {"analytics": "analytics.control", "record": "analytics.record_control", "profile": "analytics.profile",
              "review": "analytics.review", "events": "analytics.events", "ptz": "camera.ptz", "exports": "analytics.exports", "cases": "analytics.cases",
              "config": "system.configure"}   # FRGS: zones and camera settings, persisted in Frigate's configuration file
PER_ACTION = frozenset({"record", "profile", "ptz", "config"})
# F2b: `exports` and `cases` confirm per action only where it destroys something (delete, and an undo that deletes); see needs_confirm in _gate

CONTROL_PERMISSIONS = frozenset(p for c, p in PERMISSION.items() if c != "review")  # who may SEE the control screens (the reviewed mirror is not management)
ALARM_STATES = ("disarmed", "armed_home", "armed_away", "armed_night", "armed_vacation", "armed_custom_bypass", "pending", "arming", "triggered")
PTZ_RELEASED = False              # code flag: the owner has not released PTZ (2026-10-06); tests set it to prove the plumbing
PTZ_LEASE_S = 30.0
_LEASES: dict[str, tuple[str, float]] = {}   # recorder:camera key -> (user id, until monotonic)
_LEASE_LOCK = threading.Lock()


def _actor(principal: Principal) -> tuple[str | None, str | None]:
    return getattr(principal, "user_id", None), getattr(principal, "username", None)


# ---------------------------------------------------------------------------------------------- the class policy

def policy(conn: sqlite3.Connection, recorder_id: str) -> dict[str, bool]:
    out = {c: False for c in CLASSES}
    for r in conn.execute("SELECT class, enabled FROM frigate_write_policy WHERE recorder_id = ?", (recorder_id,)).fetchall():
        if r["class"] in out:
            out[r["class"]] = bool(r["enabled"])
    return out


def set_policy(conn: sqlite3.Connection, principal: Principal, recorder_id: str, classes: dict[str, bool], request_id: str | None) -> dict[str, bool]:
    """Switch write classes on / off for a recorder (the caller holds system.configure). `ptz` cannot be switched on while it is not released."""
    for cls, on in classes.items():
        if cls not in CLASSES:
            raise ApiError(422, "frigate_class_unknown", "סוג הפעולה אינו מוכר.", details={"class": str(cls)[:30]})
        if cls == "ptz" and on and not PTZ_RELEASED:
            raise ApiError(409, "frigate_ptz_not_released", "שליטת PTZ אינה משוחררת עדיין.", details={"class": "ptz"})
    before = policy(conn, recorder_id)
    now = now_iso()
    uid, _ = _actor(principal)
    for cls, on in classes.items():
        conn.execute("INSERT INTO frigate_write_policy(recorder_id, class, enabled, changed_by, changed_at) VALUES (?,?,?,?,?) "
                     "ON CONFLICT(recorder_id, class) DO UPDATE SET enabled = excluded.enabled, changed_by = excluded.changed_by, changed_at = excluded.changed_at",
                     (recorder_id, cls, 1 if on else 0, uid, now))
    after = policy(conn, recorder_id)
    audit(conn, actor=principal, action="frigate.control.policy", decision="allowed", resource_type="recorder", resource_id=recorder_id, request_id=request_id,
          details={"before": before, "after": after})
    return after


def _gate(conn: sqlite3.Connection, principal: Principal, recorder_id: str, cls: str, camera_id: str | None, *, confirm: bool, request_id: str | None, what: str,
          needs_confirm: bool | None = None) -> None:
    """Steps 1-3 of the model. Raises 403 (permission), 409 `frigate_write_class_off`, 409 `confirmation_required`. `needs_confirm` overrides
    the class default (PER_ACTION) for one action (F2b: a delete asks, a rename does not)."""
    perm = PERMISSION[cls]
    if camera_id is not None:
        require_camera(conn, principal, camera_id, perm)
    else:
        require(conn, principal, perm, INSTALLATION)
    if not policy(conn, recorder_id).get(cls):
        audit(conn, actor=principal, action=f"frigate.control.{cls}", decision="denied", resource_type="recorder", resource_id=recorder_id, reason="class_off",
              request_id=request_id, details={"what": what, "camera_id": camera_id})
        raise ApiError(409, "frigate_write_class_off", "סוג הפעולה הזה כבוי עבור המקליט. מנהל המערכת יכול להפעיל אותו בהגדרות.", details={"class": cls})
    if (cls in PER_ACTION if needs_confirm is None else needs_confirm) and not confirm:
        raise ApiError(409, "confirmation_required", "פעולה זו דורשת אישור מפורש.", details={"class": cls})


def _log(conn: sqlite3.Connection, principal: Principal, *, recorder_id: str, camera_id: str | None, camera_key: str | None, cls: str, kind: str, target: str,
         before: Any, after: Any, state_hash: str | None, status: str, error: str | None = None, reversible: bool = True, reverts_id: str | None = None,
         request_id: str | None = None) -> str:
    cid = new_id()
    uid, name = _actor(principal)
    conn.execute("INSERT INTO frigate_changes(id, recorder_id, camera_id, camera_key, class, kind, target, before_json, after_json, state_hash, status, error_code, reversible, "
                 "reverts_id, actor_id, actor_name, created_at) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)",
                 (cid, recorder_id, camera_id, camera_key, cls, kind, target, json.dumps(before), json.dumps(after), state_hash, status, error, 1 if reversible else 0, reverts_id, uid, name, now_iso()))
    audit(conn, actor=principal, action=f"frigate.control.{cls}", decision="allowed" if status in ("applied", "unverified") else "denied", resource_type="camera" if camera_id else "recorder",
          resource_id=camera_id or recorder_id, reason=error, request_id=request_id,
          details={"kind": kind, "target": target, "before": before, "after": after, "status": status, "change_id": cid, "reverts": reverts_id})
    return cid


def _failed(conn: sqlite3.Connection, principal: Principal, exc: ApiError, **kw: Any) -> ApiError:
    """The write (or its pre-read) raised: the attempt is logged as `failed` (outcome unknown for `frigate_write_unknown`) and the same error is returned."""
    _log(conn, principal, status="failed", error=exc.code, reversible=False, **kw)
    return exc


# ---------------------------------------------------------------------------------------------- camera switches (W1 / W2)

def camera_state(adapter: FrigateAdapter, camera_key: str) -> dict[str, bool | None]:
    return fc.FrigateControl(adapter).read_features(camera_key)


def set_feature(conn: sqlite3.Connection, principal: Principal, adapter: FrigateAdapter, cam: sqlite3.Row, feature: str, value: bool, *, confirm: bool,
                request_id: str | None) -> dict[str, Any]:
    cls = fc.feature_class(feature)
    rid = adapter.recorder_id
    _gate(conn, principal, rid, cls, cam["id"], confirm=confirm, request_id=request_id, what=feature)
    ctl = fc.FrigateControl(adapter)
    base = dict(recorder_id=rid, camera_id=cam["id"], camera_key=cam["source_ref"], cls=cls, kind="feature", target=feature, request_id=request_id)
    before_all = ctl.read_features(cam["source_ref"])
    before = before_all.get(feature)
    if before is value:
        return {"changed": False, "feature": feature, "value": value, "verified": True, "change_id": None}
    h = fc.state_hash(before_all)
    try:
        ctl.set_feature(cam["source_ref"], feature, value)
    except ApiError as exc:
        raise _failed(conn, principal, exc, before={"value": before}, after={"value": value}, state_hash=h, **base) from None
    verified, after = _read_back(ctl, cam["source_ref"], feature, value)
    cid = _log(conn, principal, before={"value": before}, after={"value": value}, state_hash=h, status="applied" if verified else "unverified", **base)
    return {"changed": True, "feature": feature, "value": value, "verified": verified, "observed": after, "change_id": cid}


def _read_back(ctl: fc.FrigateControl, camera_key: str, feature: str, value: bool) -> tuple[bool, bool | None]:
    try:
        seen = ctl.read_features(camera_key).get(feature)
    except ApiError:
        return False, None
    return seen is value, seen


# ---------------------------------------------------------------------------------------------- profiles (W3)

def set_profile(conn: sqlite3.Connection, principal: Principal, adapter: FrigateAdapter, profile: str | None, *, confirm: bool, request_id: str | None) -> dict[str, Any]:
    rid = adapter.recorder_id
    _gate(conn, principal, rid, "profile", None, confirm=confirm, request_id=request_id, what=profile or "none")
    return apply_profile(conn, principal, adapter, profile, request_id=request_id)


def apply_profile(conn: sqlite3.Connection, principal: Principal, adapter: FrigateAdapter, profile: str | None, *, request_id: str | None, auto: dict[str, Any] | None = None) -> dict[str, Any]:
    """Steps 4-5 of the model for the profile slot (read, ONE write, read back, change-log row). The gates were passed by the caller: a
    person's confirmation (`set_profile`) or the recorder's auto-apply consent (`frigate_auto_profile`; `auto` names the alarm change)."""
    rid = adapter.recorder_id
    ctl = fc.FrigateControl(adapter)
    state = ctl.active_profile()
    if profile is not None and state["names"] and profile not in state["names"]:
        raise ApiError(422, "frigate_profile_unknown", "הפרופיל אינו מוגדר ב־Frigate.", details={"profile": profile})
    base = dict(recorder_id=rid, camera_id=None, camera_key="*", cls="profile", kind="profile", target="active", request_id=request_id)
    if state["active"] == profile:
        return {"changed": False, "active": profile, "verified": True, "change_id": None}
    try:
        ctl.set_profile(profile)
    except ApiError as exc:
        raise _failed(conn, principal, exc, before={"profile": state["active"]}, after={"profile": profile}, state_hash=None, **base) from None
    try:
        now = ctl.active_profile()["active"]
        verified = now == profile
    except ApiError:
        verified = False
    why = {"auto": auto} if auto else {}
    cid = _log(conn, principal, before={"profile": state["active"], **why}, after={"profile": profile}, state_hash=None, status="applied" if verified else "unverified", **base)
    return {"changed": True, "active": profile, "verified": verified, "change_id": cid, "note": "frigate_clears_runtime_toggles"}


def profile_view(adapter: FrigateAdapter) -> dict[str, Any]:
    return fc.FrigateControl(adapter).active_profile()


def rules(conn: sqlite3.Connection, recorder_id: str) -> dict[str, str]:
    return {r["alarm_state"]: r["profile"] for r in conn.execute("SELECT alarm_state, profile FROM frigate_profile_rules WHERE recorder_id = ?", (recorder_id,)).fetchall()}


def set_rules(conn: sqlite3.Connection, principal: Principal, recorder_id: str, mapping: dict[str, str | None], request_id: str | None) -> dict[str, str]:
    """Store which profile an alarm state suggests (a state mapped to None / "" is removed). Names are validated; a rule never switches anything."""
    for state, prof in mapping.items():
        if state not in ALARM_STATES:
            raise ApiError(422, "frigate_alarm_state_unknown", "מצב האזעקה אינו מוכר.", details={"state": str(state)[:30]})
        if prof and not fc.PROFILE_NAME.fullmatch(prof):
            raise ApiError(422, "frigate_profile_invalid", "שם פרופיל לא תקין.")
    before = rules(conn, recorder_id)
    uid, _ = _actor(principal)
    for state, prof in mapping.items():
        if prof:
            conn.execute("INSERT INTO frigate_profile_rules(recorder_id, alarm_state, profile, changed_by, changed_at) VALUES (?,?,?,?,?) "
                         "ON CONFLICT(recorder_id, alarm_state) DO UPDATE SET profile = excluded.profile, changed_by = excluded.changed_by, changed_at = excluded.changed_at",
                         (recorder_id, state, prof, uid, now_iso()))
        else:
            conn.execute("DELETE FROM frigate_profile_rules WHERE recorder_id = ? AND alarm_state = ?", (recorder_id, state))
    after = rules(conn, recorder_id)
    audit(conn, actor=principal, action="frigate.control.profile_rules", decision="allowed", resource_type="recorder", resource_id=recorder_id, request_id=request_id,
          details={"before": before, "after": after})
    return after


# ---------------------------------------------------------------------------------------------- event actions

def _event_scope(conn: sqlite3.Connection, principal: Principal, recorder_id: str, event_id: str) -> sqlite3.Row:
    """The stored review item that holds this tracked-object id: an event the caller cannot reach through a review is a 404.
    Security review 2.2.0 L5: the id is validated BEFORE the lookup (the same 422 as the adapter's) and the LIKE pattern is
    escaped, so `%` / `_` in a URL can never match another camera's review row."""
    if not isinstance(event_id, str) or not fc.EVENT_ID.fullmatch(event_id):
        raise ApiError(422, "frigate_event_invalid", "מזהה אירוע לא תקין.")
    needle = event_id.replace("\\", "\\\\").replace("%", "\\%").replace("_", "\\_")
    row = conn.execute("SELECT review_id, camera_id, source_ref FROM frigate_reviews WHERE recorder_id = ? AND detections_json LIKE ? ESCAPE '\\'",
                       (recorder_id, f'%"{needle}"%')).fetchone()
    if row is None:
        raise ApiError(404, "not_found", "האירוע לא נמצא.")
    if row["camera_id"]:
        require_camera(conn, principal, row["camera_id"], "events.read")
    else:
        require(conn, principal, "events.read", INSTALLATION)
    return row


def set_retain(conn: sqlite3.Connection, principal: Principal, adapter: FrigateAdapter, event_id: str, retain: bool, *, request_id: str | None) -> dict[str, Any]:
    rid = adapter.recorder_id
    scope = _event_scope(conn, principal, rid, event_id)
    _gate(conn, principal, rid, "events", scope["camera_id"], confirm=True, request_id=request_id, what="retain")
    ctl = fc.FrigateControl(adapter)
    cur = ctl.event(event_id)
    base = dict(recorder_id=rid, camera_id=scope["camera_id"], camera_key=scope["source_ref"], cls="events", kind="event_retain", target=event_id, request_id=request_id)
    if cur["retain"] is retain:
        return {"changed": False, "event_id": event_id, "retain": retain, "verified": True, "change_id": None}
    try:
        ctl.set_retain(event_id, retain)
    except ApiError as exc:
        raise _failed(conn, principal, exc, before={"retain": cur["retain"]}, after={"retain": retain}, state_hash=None, **base) from None
    try:
        verified = ctl.event(event_id)["retain"] is retain
    except ApiError:
        verified = False
    cid = _log(conn, principal, before={"retain": cur["retain"]}, after={"retain": retain}, state_hash=None, status="applied" if verified else "unverified", **base)
    return {"changed": True, "event_id": event_id, "retain": retain, "verified": verified, "change_id": cid}


def set_sub_label(conn: sqlite3.Connection, principal: Principal, adapter: FrigateAdapter, event_id: str, label: str | None, *, request_id: str | None) -> dict[str, Any]:
    rid = adapter.recorder_id
    scope = _event_scope(conn, principal, rid, event_id)
    _gate(conn, principal, rid, "events", scope["camera_id"], confirm=True, request_id=request_id, what="sub_label")
    ctl = fc.FrigateControl(adapter)
    cur = ctl.event(event_id)
    want = (label or "").strip() or None
    base = dict(recorder_id=rid, camera_id=scope["camera_id"], camera_key=scope["source_ref"], cls="events", kind="event_sub_label", target=event_id, request_id=request_id)
    if cur["sub_label"] == want:
        return {"changed": False, "event_id": event_id, "sub_label": want, "verified": True, "change_id": None}
    try:
        ctl.set_sub_label(event_id, want)
    except ApiError as exc:
        raise _failed(conn, principal, exc, before={"sub_label": cur["sub_label"]}, after={"sub_label": want}, state_hash=None, **base) from None
    try:
        verified = ctl.event(event_id)["sub_label"] == want
    except ApiError:
        verified = False
    cid = _log(conn, principal, before={"sub_label": cur["sub_label"]}, after={"sub_label": want}, state_hash=None, status="applied" if verified else "unverified", **base)
    return {"changed": True, "event_id": event_id, "sub_label": want, "verified": verified, "change_id": cid}


# ---------------------------------------------------------------------------------------------- reviewed: mirror toward Frigate

def mirror_reviewed(conn: sqlite3.Connection, principal: Principal, adapter: FrigateAdapter, ids: list[str], reviewed: bool, *, request_id: str | None) -> dict[str, Any]:
    """After Arx's own per-user state was written: copy it to Frigate when (a) the `review` class is on for the recorder and (b) the caller
    holds analytics.review. Arx's state is the truth and is never rolled back by a failed mirror; the failure is named in the answer and
    stored on the rows. Frigate's flag is shared (one account), so an UN-mark is mirrored only for an item no other Arx user still holds as
    reviewed."""
    rid = adapter.recorder_id
    if not policy(conn, rid).get("review"):
        return {"state": "off", "count": 0}
    if not authorize(conn, principal, PERMISSION["review"], INSTALLATION).allowed:
        return {"state": "not_permitted", "count": 0}
    ctl = fc.FrigateControl(adapter)
    now = now_iso()
    try:
        if reviewed:
            ctl.mark_reviewed(ids)
            sent = list(ids)
            conn.executemany("UPDATE frigate_review_state SET mirrored_at = ?, mirror_error = NULL WHERE user_id = ? AND recorder_id = ? AND review_id = ?",
                             [(now, principal.user_id, rid, i) for i in ids])
        else:
            sent = []
            for i in ids:
                still = conn.execute("SELECT 1 FROM frigate_review_state WHERE recorder_id = ? AND review_id = ? LIMIT 1", (rid, i)).fetchone()
                if still is None:
                    ctl.unmark_reviewed(i)
                    sent.append(i)
    except ApiError as exc:
        if reviewed:
            conn.executemany("UPDATE frigate_review_state SET mirror_error = ? WHERE user_id = ? AND recorder_id = ? AND review_id = ?",
                             [(exc.code, principal.user_id, rid, i) for i in ids])
        audit(conn, actor=principal, action="frigate.control.review", decision="denied", resource_type="recorder", resource_id=rid, reason=exc.code, request_id=request_id,
              details={"count": len(ids), "reviewed": reviewed})
        return {"state": "failed", "count": 0, "code": exc.code}
    audit(conn, actor=principal, action="frigate.control.review", decision="allowed", resource_type="recorder", resource_id=rid, request_id=request_id,
          details={"count": len(sent), "reviewed": reviewed})
    return {"state": "done", "count": len(sent)}


# ---------------------------------------------------------------------------------------------- PTZ (plumbing, released by code flag)

def ptz_status(conn: sqlite3.Connection, adapter: FrigateAdapter, cam: sqlite3.Row) -> dict[str, Any]:
    info = fc.FrigateControl(adapter).ptz_info(cam["source_ref"])
    return {"released": PTZ_RELEASED, "enabled": policy(conn, adapter.recorder_id)["ptz"], **info}


def ptz_step(conn: sqlite3.Connection, principal: Principal, adapter: FrigateAdapter, cam: sqlite3.Row, command: str, *, confirm: bool, request_id: str | None) -> dict[str, Any]:
    """ONE physical step. Order: permission, release flag, class policy, explicit confirmation, a 30 s lease (a second user is refused
    while another holds it), the command check, then one message. No queue, no retry, no patrol: a failure is final for this call."""
    rid = adapter.recorder_id
    require_camera(conn, principal, cam["id"], PERMISSION["ptz"])
    if not PTZ_RELEASED:
        audit(conn, actor=principal, action="frigate.control.ptz", decision="denied", resource_type="camera", resource_id=cam["id"], reason="not_released", request_id=request_id)
        raise ApiError(409, "frigate_ptz_disabled", "שליטת PTZ כבויה.", details={"class": "ptz"})
    _gate(conn, principal, rid, "ptz", cam["id"], confirm=confirm, request_id=request_id, what="step")
    cmd = fc.normalize_ptz(command)
    key = f"{rid}:{cam['source_ref']}"
    now = time.monotonic()
    with _LEASE_LOCK:
        held = _LEASES.get(key)
        if held and held[1] > now and held[0] != principal.user_id:
            raise ApiError(409, "ptz_leased", "מישהו אחר שולט כרגע במצלמה.", details={"retry_after_s": int(held[1] - now) + 1})
        _LEASES[key] = (principal.user_id, now + PTZ_LEASE_S)
    base = dict(recorder_id=rid, camera_id=cam["id"], camera_key=cam["source_ref"], cls="ptz", kind="ptz", target=cmd, request_id=request_id)
    try:
        fc.FrigateControl(adapter).ptz(cam["source_ref"], cmd)
    except ApiError as exc:
        raise _failed(conn, principal, exc, before=None, after={"command": cmd}, state_hash=None, **base) from None
    cid = _log(conn, principal, before=None, after={"command": cmd}, state_hash=None, status="applied", reversible=False, **base)
    return {"sent": True, "command": cmd, "change_id": cid, "lease_s": int(PTZ_LEASE_S)}


def clear_leases() -> None:
    with _LEASE_LOCK:
        _LEASES.clear()


# ---------------------------------------------------------------------------------------------- the change log and undo

def change_view(r: sqlite3.Row) -> dict[str, Any]:
    return {"id": r["id"], "recorder_id": r["recorder_id"], "camera_id": r["camera_id"], "camera_key": r["camera_key"], "class": r["class"], "kind": r["kind"], "target": r["target"],
            "before": json.loads(r["before_json"]) if r["before_json"] else None, "after": json.loads(r["after_json"]) if r["after_json"] else None,
            "status": r["status"], "error": r["error_code"], "reversible": bool(r["reversible"]) and r["status"] in ("applied", "unverified"), "reverts_id": r["reverts_id"],
            "actor": r["actor_name"], "at": r["created_at"]}


def revert(conn: sqlite3.Connection, principal: Principal, adapter: FrigateAdapter, change_id: str, *, confirm: bool, request_id: str | None, supervised: bool = False) -> dict[str, Any]:
    """Undo one change from the log: the same class gates apply, and the state must still be what the change left."""
    rid = adapter.recorder_id
    row = conn.execute("SELECT * FROM frigate_changes WHERE id = ? AND recorder_id = ?", (change_id, rid)).fetchone()
    if row is None:
        raise ApiError(404, "not_found", "השינוי לא נמצא ביומן.")
    cls, kind = row["class"], row["kind"]
    if not row["reversible"] or row["status"] not in ("applied", "unverified"):
        raise ApiError(409, "frigate_change_not_reversible", "לא ניתן לבטל את השינוי הזה.", details={"status": row["status"]})
    from . import frigate_native_svc as native

    from . import frigate_config_svc as cfgsvc

    native_kind = kind in native.INVERSE_KIND
    config_kind = kind in cfgsvc.KINDS
    _gate(conn, principal, rid, cls, row["camera_id"], confirm=confirm, request_id=request_id, what=f"revert:{kind}",
          needs_confirm=(kind in native.UNDO_CONFIRMS) if native_kind else None)
    if native_kind:
        native.check_supervised(conn, principal, rid, native.INVERSE_KIND[kind], supervised, request_id)
    if config_kind:
        native.check_supervised(conn, principal, rid, kind, supervised, request_id)   # FRGS: an undo is a write of the same kind
    before, after = json.loads(row["before_json"] or "null"), json.loads(row["after_json"] or "null")
    ctl = fc.FrigateControl(adapter)
    base = dict(recorder_id=rid, camera_id=row["camera_id"], camera_key=row["camera_key"], cls=cls, kind=kind, target=row["target"], reverts_id=change_id, request_id=request_id)

    # single-shot: claim the row (compare-and-set on its status) before anything is written to Frigate; the loser of a race gets 409 and writes nothing
    claimed = conn.execute("UPDATE frigate_changes SET status = 'reverted' WHERE id = ? AND recorder_id = ? AND status IN ('applied', 'unverified')", (change_id, rid))
    if claimed.rowcount != 1:
        raise ApiError(409, "frigate_change_not_reversible", "לא ניתן לבטל את השינוי הזה.", details={"status": "reverted"})

    def release_claim() -> None:
        conn.execute("UPDATE frigate_changes SET status = ? WHERE id = ? AND status = 'reverted'", (row["status"], change_id))

    def stale() -> ApiError:
        return ApiError(409, "frigate_change_stale", "המצב ב־Frigate השתנה מאז השינוי. קראו את המצב ונסו שוב.", details={"kind": kind})

    try:
        if kind == "feature":
            cur = ctl.read_features(row["camera_key"]).get(row["target"])
            if cur is not None and cur is not after["value"]:
                raise stale()
            if before["value"] is None:
                raise ApiError(409, "frigate_change_not_reversible", "המצב הקודם אינו ידוע.")
            ctl.set_feature(row["camera_key"], row["target"], before["value"])
            seen = ctl.read_features(row["camera_key"]).get(row["target"])
            verified = seen is before["value"]
        elif kind == "profile":
            cur = ctl.active_profile()["active"]
            if cur != after["profile"]:
                raise stale()
            ctl.set_profile(before["profile"])
            verified = ctl.active_profile()["active"] == before["profile"]
        elif kind == "event_retain":
            if ctl.event(row["target"])["retain"] is not after["retain"]:
                raise stale()
            ctl.set_retain(row["target"], before["retain"])
            verified = ctl.event(row["target"])["retain"] is before["retain"]
        elif kind == "event_sub_label":
            if ctl.event(row["target"])["sub_label"] != after["sub_label"]:
                raise stale()
            ctl.set_sub_label(row["target"], before["sub_label"])
            verified = ctl.event(row["target"])["sub_label"] == before["sub_label"]
        elif native_kind:
            verified = native.revert_kind(conn, adapter, row, before, after)
        elif config_kind:
            verified = cfgsvc.revert_kind(adapter, row, before, after)
        else:
            raise ApiError(409, "frigate_change_not_reversible", "לא ניתן לבטל את השינוי הזה.")
    except ApiError as exc:
        if exc.code in ("frigate_change_stale", "frigate_change_not_reversible", "frigate_object_not_arx"):
            release_claim()
            raise
        release_claim()
        raise _failed(conn, principal, exc, before=after, after=before, state_hash=None, **base) from None
    new_id_ = _log(conn, principal, before=after, after=before, state_hash=None, status="applied" if verified else "unverified", reversible=False, **base)
    if native_kind:
        native.mark_first_write(conn, principal, rid, native.INVERSE_KIND[kind])
    return {"reverted": True, "change_id": new_id_, "reverts": change_id, "verified": verified}


def changes(conn: sqlite3.Connection, recorder_id: str, *, limit: int = 100, camera_ok=None, installation_ok: bool = True) -> list[dict[str, Any]]:
    """installation_ok=False (security review 2.2.0 L9): the rows without a camera (profile switches) are left out."""
    out = []
    for r in conn.execute("SELECT * FROM frigate_changes WHERE recorder_id = ? ORDER BY created_at DESC, rowid DESC LIMIT ?", (recorder_id, max(1, min(limit, 500)))).fetchall():
        if r["camera_id"] and camera_ok is not None and not camera_ok(r["camera_id"]):
            continue
        if not r["camera_id"] and not installation_ok:
            continue
        out.append(change_view(r))
    return out
