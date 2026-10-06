"""Automatic Frigate profile on an alarm-state change (NN5 F2b, docs/changes/CR-029-FRIGATE-PROVIDER.md section 11).

The stored mapping (`frigate_profile_rules`: alarm state -> profile) was only ever a suggestion the operator confirmed. This module adds the
rule-engine hook that acts on it, per recorder, in one of three modes (`frigate_profile_auto_setting.mode`, default `off`):

- `off`     - nothing happens (and nothing is queued).
- `suggest` - an alarm change that the mapping answers is recorded as an open suggestion (`frigate_profile_auto`); an operator with
              `analytics.profile` applies it with the normal confirmed write (`apply_suggestion`) or dismisses it.
- `apply`   - Arx switches the profile by itself, ONLY when all of these hold, else the row stays a suggestion with the reason named:
              the `profile` write class is on for the recorder, the administrator gave the explicit auto-apply consent (a flag stored per
              recorder, separate from the mode), and a person already did one supervised write of this kind (`frigate_first_write`,
              kind `profile_auto`; the wire shape is unverified, so the first one is never automatic).

Two parts, so that nothing slow runs on the Home Assistant transaction: `note_alarm_change` is called by `ha_sync.handle_state_event` inside its
transaction, touches the database only, and queues a row; `tick` / `process` run in the recorder's own event loop, read the queue and do the
Frigate I/O. The automatic switch goes through the same `apply_profile` as a manual one (read, ONE write, read back, change-log row, audit row),
so it can be undone from the change log like any other change. A write that fails or whose answer is lost is final for that row (`failed`;
never retried, never queued again); a row older than `MAX_AGE_S` expires instead of switching a stale profile; a newer alarm change supersedes
every older open row."""
from __future__ import annotations

import datetime as dt
import logging
import sqlite3
from dataclasses import dataclass
from typing import Any

from ..audit import audit
from ..db import new_id, now_iso
from ..errors import ApiError
from ..rbac import INSTALLATION, Principal, require
from . import frigate_control_svc as cs
from . import frigate_native_svc as native
from .recorders.frigate import FrigateAdapter
from .timeutil import parse_utc

log = logging.getLogger("smplwise.frigate")

MODES = ("off", "suggest", "apply")
MAX_AGE_S = 600.0            # an alarm change older than this never switches a profile
TICK_S = 2.0
KIND = "profile_auto"        # the first-supervised-write kind
OPEN = ("pending", "suggested")


@dataclass(frozen=True)
class AutoActor:
    """Who the audit and change-log rows name for an automatic switch (there is no user)."""

    user_id: str = "system:frigate-auto"
    username: str = "arx-auto"
    display_name: str = "Arx (automatic)"
    source: str = "system"
    via: str = ""


ACTOR = AutoActor()


# ---------------------------------------------------------------------------------------------- the per-recorder setting

def get_setting(conn: sqlite3.Connection, recorder_id: str) -> dict[str, Any]:
    r = conn.execute("SELECT * FROM frigate_profile_auto_setting WHERE recorder_id = ?", (recorder_id,)).fetchone()
    mode = r["mode"] if r else "off"
    consent = bool(r["auto_apply_consent"]) if r else False
    return {"recorder_id": recorder_id, "mode": mode, "auto_apply_consent": consent, "consent_by": r["consent_by"] if r else None, "consent_at": r["consent_at"] if r else None,
            "profile_class_on": cs.policy(conn, recorder_id)["profile"], "first_write_done": native.supervised_ok(conn, recorder_id, KIND),
            "will_apply": bool(mode == "apply" and consent and cs.policy(conn, recorder_id)["profile"] and native.supervised_ok(conn, recorder_id, KIND))}


def set_setting(conn: sqlite3.Connection, principal: Principal, recorder_id: str, mode: str | None, consent: bool | None, request_id: str | None) -> dict[str, Any]:
    """Change the mode and / or the auto-apply consent (system.configure, held by the caller). `apply` needs the consent; withdrawing the
    consent drops an `apply` mode to `suggest`."""
    if mode is not None and mode not in MODES:
        raise ApiError(422, "frigate_auto_mode_invalid", "מצב ההחלפה האוטומטית אינו מוכר.", details={"modes": list(MODES)})
    before = get_setting(conn, recorder_id)
    new_mode = mode if mode is not None else before["mode"]
    new_consent = before["auto_apply_consent"] if consent is None else bool(consent)
    if new_mode == "apply" and not new_consent:
        if mode == "apply":   # asked for explicitly without the consent
            raise ApiError(422, "frigate_auto_consent_required", "החלפה אוטומטית דורשת הסכמה מפורשת של מנהל המערכת.", details={"mode": "apply"})
        new_mode = "suggest"  # the consent was withdrawn while the mode was apply
    uid = getattr(principal, "user_id", None)
    now = now_iso()
    consent_by, consent_at = (before["consent_by"], before["consent_at"]) if new_consent == before["auto_apply_consent"] else ((uid, now) if new_consent else (None, None))
    conn.execute("INSERT INTO frigate_profile_auto_setting(recorder_id, mode, auto_apply_consent, consent_by, consent_at, changed_by, changed_at) VALUES (?,?,?,?,?,?,?) "
                 "ON CONFLICT(recorder_id) DO UPDATE SET mode = excluded.mode, auto_apply_consent = excluded.auto_apply_consent, consent_by = excluded.consent_by, "
                 "consent_at = excluded.consent_at, changed_by = excluded.changed_by, changed_at = excluded.changed_at",
                 (recorder_id, new_mode, 1 if new_consent else 0, consent_by, consent_at, uid, now))
    if new_mode == "off":   # nothing open survives switching it off
        conn.execute("UPDATE frigate_profile_auto SET status = 'dismissed', reason = 'mode_off', processed_at = ? WHERE recorder_id = ? AND status IN ('pending','suggested')", (now, recorder_id))
    after = get_setting(conn, recorder_id)
    audit(conn, actor=principal, action="frigate.control.profile_auto_setting", decision="allowed", resource_type="recorder", resource_id=recorder_id, request_id=request_id,
          details={"before": {k: before[k] for k in ("mode", "auto_apply_consent")}, "after": {k: after[k] for k in ("mode", "auto_apply_consent")}})
    return after


# ---------------------------------------------------------------------------------------------- the hook (HA transaction: database only)

def note_alarm_change(conn: sqlite3.Connection, old: dict[str, Any] | None, new: dict[str, Any]) -> int:
    """Queue one row per recorder whose mode is not `off` and whose mapping answers the new alarm state; older open rows of such a recorder
    are superseded. Cheap for everything else: one indexed read of a small table. Never raises (the caller's savepoint is its own)."""
    try:
        eid = str(new.get("entity_id") or "")
        state = new.get("state")
        if not eid.startswith("alarm_control_panel.") or old is None or old.get("state") == state or state not in cs.ALARM_STATES:
            return 0
        recorders = [r["recorder_id"] for r in conn.execute("SELECT recorder_id FROM frigate_profile_auto_setting WHERE mode != 'off'").fetchall()]
        queued = 0
        now = now_iso()
        for rid in recorders:
            conn.execute("UPDATE frigate_profile_auto SET status = 'superseded', processed_at = ? WHERE recorder_id = ? AND status IN ('pending','suggested')", (now, rid))
            rule = conn.execute("SELECT profile FROM frigate_profile_rules WHERE recorder_id = ? AND alarm_state = ?", (rid, state)).fetchone()
            if rule is None:
                continue
            mode = conn.execute("SELECT mode FROM frigate_profile_auto_setting WHERE recorder_id = ?", (rid,)).fetchone()["mode"]
            conn.execute("INSERT INTO frigate_profile_auto(id, recorder_id, alarm_state, entity_id, profile, mode, status, created_at) VALUES (?,?,?,?,?,?, 'pending', ?)",
                         (new_id(), rid, state, eid, rule["profile"], mode, now))
            queued += 1
        return queued
    except Exception:  # noqa: BLE001 - the state update itself is never lost to this hook
        log.exception("frigate auto-profile hook failed")
        return 0


# ---------------------------------------------------------------------------------------------- the processor (the recorder's own loop)

def _mark(conn: sqlite3.Connection, item_id: str, status: str, reason: str | None = None, change_id: str | None = None) -> None:
    conn.execute("UPDATE frigate_profile_auto SET status = ?, reason = ?, change_id = ?, processed_at = ? WHERE id = ?", (status, reason, change_id, now_iso(), item_id))


def _profile_arg(name: str) -> str | None:
    return None if name.lower() == "none" else name


def process(conn: sqlite3.Connection, adapter: FrigateAdapter, now_ts: float) -> list[dict[str, Any]]:
    """Handle this recorder's pending rows (usually zero or one). Returns what happened, for tests and logs."""
    rid = adapter.recorder_id
    out: list[dict[str, Any]] = []
    for r in conn.execute("SELECT * FROM frigate_profile_auto WHERE recorder_id = ? AND status = 'pending' ORDER BY created_at, rowid", (rid,)).fetchall():
        res = {"id": r["id"], "alarm_state": r["alarm_state"], "profile": r["profile"]}
        out.append(res)
        age = now_ts - parse_utc(r["created_at"]).timestamp()
        st = get_setting(conn, rid)
        if age > MAX_AGE_S:
            _mark(conn, r["id"], "expired", "too_old")
            res["status"] = "expired"
            continue
        if st["mode"] == "off":
            _mark(conn, r["id"], "dismissed", "mode_off")
            res["status"] = "dismissed"
            continue
        if st["mode"] == "suggest":
            _mark(conn, r["id"], "suggested")
            res["status"] = "suggested"
            continue
        reason = None if st["profile_class_on"] and st["auto_apply_consent"] and st["first_write_done"] else (
            "class_off" if not st["profile_class_on"] else "no_consent" if not st["auto_apply_consent"] else "first_write_unsupervised")
        if reason:
            audit(conn, actor=ACTOR, action="frigate.control.profile", decision="denied", resource_type="recorder", resource_id=rid, reason=reason,
                  details={"auto": True, "alarm_state": r["alarm_state"], "profile": r["profile"]})
            _mark(conn, r["id"], "suggested", reason)
            res["status"], res["reason"] = "suggested", reason
            continue
        try:
            done = cs.apply_profile(conn, ACTOR, adapter, _profile_arg(r["profile"]), request_id=None, auto={"alarm_state": r["alarm_state"], "item": r["id"]})
        except ApiError as exc:   # final for this row: no retry, no queue
            _mark(conn, r["id"], "failed", exc.code)
            res["status"], res["reason"] = "failed", exc.code
            continue
        if not done["changed"]:
            _mark(conn, r["id"], "skipped", "already_active")
            res["status"] = "skipped"
        else:
            status = "applied" if done["verified"] else "unverified"
            _mark(conn, r["id"], status, None, done["change_id"])
            res["status"], res["change_id"] = status, done["change_id"]
    return out


def tick(db: Any, adapter: FrigateAdapter, now_ts: float) -> list[dict[str, Any]]:
    """One pass from the recorder's event loop: a cheap read, and the write connection only when a row is waiting."""
    with db.connection(mode="read") as conn:
        waiting = conn.execute("SELECT 1 FROM frigate_profile_auto WHERE recorder_id = ? AND status = 'pending' LIMIT 1", (adapter.recorder_id,)).fetchone()
    if waiting is None:
        return []
    with db.connection() as conn:
        return process(conn, adapter, now_ts)


# ---------------------------------------------------------------------------------------------- what the operator screen reads / does

def view(r: sqlite3.Row) -> dict[str, Any]:
    return {"id": r["id"], "alarm_state": r["alarm_state"], "profile": r["profile"], "mode": r["mode"], "status": r["status"], "reason": r["reason"], "change_id": r["change_id"],
            "at": r["created_at"], "processed_at": r["processed_at"]}


def items(conn: sqlite3.Connection, recorder_id: str, limit: int = 20) -> list[dict[str, Any]]:
    return [view(r) for r in conn.execute("SELECT * FROM frigate_profile_auto WHERE recorder_id = ? ORDER BY created_at DESC, rowid DESC LIMIT ?", (recorder_id, max(1, min(limit, 100)))).fetchall()]


def _open_item(conn: sqlite3.Connection, recorder_id: str, item_id: str) -> sqlite3.Row:
    r = conn.execute("SELECT * FROM frigate_profile_auto WHERE id = ? AND recorder_id = ?", (item_id, recorder_id)).fetchone()
    if r is None:
        raise ApiError(404, "not_found", "ההצעה לא נמצאה.")
    if r["status"] not in OPEN:
        raise ApiError(409, "frigate_auto_not_open", "ההצעה כבר טופלה או הוחלפה בחדשה.", details={"status": r["status"]})
    return r


def dismiss(conn: sqlite3.Connection, principal: Principal, recorder_id: str, item_id: str, request_id: str | None) -> dict[str, Any]:
    require(conn, principal, cs.PERMISSION["profile"], INSTALLATION)
    r = _open_item(conn, recorder_id, item_id)
    _mark(conn, r["id"], "dismissed", "by_user")
    audit(conn, actor=principal, action="frigate.control.profile_auto_dismiss", decision="allowed", resource_type="recorder", resource_id=recorder_id, request_id=request_id,
          details={"item": item_id, "profile": r["profile"], "alarm_state": r["alarm_state"]})
    return {"id": item_id, "status": "dismissed"}


def apply_suggestion(conn: sqlite3.Connection, principal: Principal, adapter: FrigateAdapter, item_id: str, *, confirm: bool, supervised: bool, request_id: str | None) -> dict[str, Any]:
    """Apply an open suggestion with the normal confirmed profile write. With `supervised: true` from a system administrator this is also
    the supervised first write of the automatic kind: once Frigate accepted it, `apply` mode may switch by itself."""
    rid = adapter.recorder_id
    require(conn, principal, cs.PERMISSION["profile"], INSTALLATION)
    r = _open_item(conn, rid, item_id)
    mark_first = False
    if supervised and not native.supervised_ok(conn, rid, KIND):
        require(conn, principal, native.CONFIGURE, INSTALLATION)
        mark_first = True
    done = cs.set_profile(conn, principal, adapter, _profile_arg(r["profile"]), confirm=confirm, request_id=request_id)
    status = "skipped" if not done["changed"] else ("applied" if done["verified"] else "unverified")
    _mark(conn, r["id"], status, "already_active" if not done["changed"] else None, done["change_id"])
    if mark_first and done["changed"]:
        native.mark_first_write(conn, principal, rid, KIND)
    return {"id": item_id, "status": status, **done}
