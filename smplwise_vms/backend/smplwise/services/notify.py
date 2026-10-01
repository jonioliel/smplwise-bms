"""Notifications (CR-018): the ONE pipeline every source feeds and the inbox every channel mirrors.

    signal --> policy --> notification (folded by dedupe key) --> recipients (policy rule x visibility)
                                   |                                  |
                                   |                                  +--> outbox --> channels (push, e-mail) --> delivery log
                                   +--> resolve / acknowledge / escalate timers

`emit()` is the single entry point (docs/architecture/NOTIFICATIONS_API.md 2.4). It writes inside the caller's transaction and
only ENQUEUES channel work (the `notify_outbox` table): the notifier thread (services/push.PushNotifier) takes the rows after
the commit and sends. Nothing is sent under the SQLite write lock, and a crash between commit and send loses nothing - the
rows are still in the outbox.

A notification is one OPEN CONDITION. A new signal with the same dedupe key folds into it (count, last_at) instead of making a
row or a new push; a higher severity re-notifies; a resolve signal closes it; a signal after the policy's fold window
supersedes the old row. Who receives it is decided when it is created (policy rule intersected with visibility, services/
notify_visibility), and visibility is checked again at every delivery and at every inbox read.

Per user only: read / unread, snooze and (when permitted) acknowledge. Everything else is the administrator's (notify.manage).

STABLE INTERFACE (what the source agents S2 and the channel agent S4 build on - do not change a signature without the coordinator)
---------------------------------------------------------------------------------------------------------------------------------
    emit(conn, Signal(source, subject_kind, subject_id, severity=None, dedupe_key=None, params={}, origin={}, initiator_user_id=None,
                      resolve=False, category=None, link=None, area_id=None, place=None)) -> str | None
        the id of a CREATED row; None when the source is disabled or the signal folded into (or resolved) an open row.
    emit_full(conn, signal) -> EmitResult(id, action)    same, but always says what happened: created | folded | renotified | resolved |
                                                         disabled | nothing_to_resolve | unknown_source (and the row id when there is one).
    A source needs a policy row: the catalogue in services/notify_policy.py lists EVERY v1 source with its defaults (category, severity, hold
    time, fold window, recipients, channels); a new source key is added there. The title / body are rendered from that catalogue's templates
    and `params` (`name`, `place`, ... never a person). Visibility - who may see the subject - is services/notify_visibility.Reach, keyed by
    `subject_kind`; the subject kinds are fixed (camera, entity, area, alarm_panel, door, schedule, automation, bulk_job, system, session).
    Call `emit` INSIDE the transaction you already hold (the row commits with it; channel work waits in `notify_outbox` until after the commit).
    A caller with no transaction opens one (`db.connection()`); a caller on a thread that must not write (an asyncio feed) hands the signal to a
    thread that may. `resolve=True` + the same dedupe key closes the open row ("the condition ended").
    CHANNELS: services/notify_channels.Channel (plan / prepare / send) + register(); services/push.PushNotifier.schedule() for retries.
"""
from __future__ import annotations

import datetime as dt
import hashlib
import json
import logging
import secrets
import sqlite3
from dataclasses import dataclass, field
from typing import Any

from ..db import new_id
from ..rbac import INSTALLATION, Principal, authorize
from . import notify_policy as policies
from . import notify_settings as nsettings
from .notify_visibility import MANAGE, Reach, principal_of
from .timeutil import iso_utc, parse_utc

log = logging.getLogger("smplwise.notify")

SEVERITY_RANK = policies.SEVERITY_RANK
TOKEN_TTL_S = 3600  # an action button lives as long as the push (TTL_S in services/push.py)
SNOOZE_MINUTES = 60
SENT_STALE_S = 3600  # an outbox dispatch older than this is not worth waking a phone for (TTL semantics)
TIMELINE_KINDS = ("created", "folded", "escalated", "acknowledged", "resolved", "delivery_failed")
ACTIONS = ("ack", "snooze")  # the ONLY actions a notification token can authorise; there is no door action (CR section 9)


def now_utc() -> dt.datetime:
    """The clock of this module (tests replace it to cross quiet hours, escalation and retention boundaries)."""
    return dt.datetime.now(dt.timezone.utc)


# ---------------------------------------------------------------- the signal

@dataclass
class Signal:
    source: str                          # policy key, e.g. 'sensor.leak'
    subject_kind: str
    subject_id: str | None
    severity: str | None = None          # None = the policy's
    dedupe_key: str | None = None        # None = f"{source}:{subject_kind}:{subject_id}"
    params: dict[str, Any] = field(default_factory=dict)   # template parameters - names of places and devices, never people
    origin: dict[str, Any] = field(default_factory=dict)   # {'alert_id'|'event_id'|'run_id'|'automation_id'|'bulk_id'|'camera_id': ...}
    initiator_user_id: str | None = None  # for the recipient rule 'initiator' (bulk starter / account owner)
    resolve: bool = False                # the condition ended: resolve the open row with this dedupe key
    category: str | None = None          # None = the policy's (rule alerts pick doors / device_faults per event type)
    link: str | None = None
    area_id: str | None = None
    place: str | None = None             # shown next to the title ("type · place"); also params['place']


@dataclass
class EmitResult:
    id: str | None
    action: str  # created | folded | renotified | resolved | disabled | nothing_to_resolve | unknown_source


def dedupe_key_of(s: Signal) -> str:
    return s.dedupe_key or f"{s.source}:{s.subject_kind}:{s.subject_id}"


def _default_link(s: Signal) -> str:
    o = s.origin or {}
    if s.link:
        return s.link
    if s.subject_kind == "camera":
        return f"#/investigate/events/{o['event_id']}" if o.get("event_id") else f"#/live/cameras/{s.subject_id}" if s.subject_id else "#/investigate/events"
    if o.get("event_id"):
        return f"#/investigate/events/{o['event_id']}"
    return {
        "entity": f"#/devices?entity={s.subject_id}" if s.subject_id else "#/devices", "area": "#/devices", "alarm_panel": "#/security/alarm", "door": "#/wiskey/overview",
        "schedule": f"#/devices/schedules/{s.subject_id}" if s.subject_id else "#/devices/schedules", "automation": "#/devices/schedules", "bulk_job": "#/devices",
        "system": "#/system/diagnostics", "session": "#/system/security",
    }.get(s.subject_kind, "#/system/notifications")


def _enqueue(conn: sqlite3.Connection, kind: str, notification_id: str | None, payload: dict[str, Any]) -> None:
    conn.execute("INSERT INTO notify_outbox(kind, notification_id, payload_json, created_at) VALUES (?,?,?,?)", (kind, notification_id, json.dumps(payload, ensure_ascii=False), iso_utc(now_utc())))
    wake()


def wake() -> None:
    """Tell the notifier thread there is outbox work (a no-op when it is not running: the rows wait for it)."""
    try:
        from . import push

        push.wake_all()
    except Exception:  # noqa: BLE001 - a wake-up is a hint, never a failure of the writer
        log.debug("could not wake the notifier", exc_info=True)


def _event(conn: sqlite3.Connection, nid: str, kind: str, at: str, *, step: int | None = None, count: int | None = None, by: str | None = None, channel: str | None = None) -> None:
    conn.execute("INSERT INTO notification_events(notification_id, at, kind, step, count, by_user_id, channel) VALUES (?,?,?,?,?,?,?)", (nid, at, kind, step, count, by, channel))


def _recipient_ids(conn: sqlite3.Connection, nid: str) -> list[str]:
    return [r[0] for r in conn.execute("SELECT user_id FROM notification_recipients WHERE notification_id = ?", (nid,)).fetchall()]


def _frames(conn: sqlite3.Connection, nid: str, frames: list[dict[str, Any]], users: list[str] | None = None) -> None:
    users = users if users is not None else _recipient_ids(conn, nid)
    if users and frames:
        _enqueue(conn, "ui", nid, {"users": users, "frames": frames})


# ---------------------------------------------------------------- recipients

def _active_users(conn: sqlite3.Connection) -> list[str]:
    return [r[0] for r in conn.execute("SELECT id FROM users WHERE active = 1 ORDER BY id").fetchall()]


def managers(conn: sqlite3.Connection) -> list[str]:
    """Holders of notify.manage at installation scope (the "administrators")."""
    out = []
    for uid in _active_users(conn):
        p = principal_of(conn, uid)
        if p is not None and authorize(conn, p, MANAGE, INSTALLATION).allowed:
            out.append(uid)
    return out


def recipients_for(conn: sqlite3.Connection, policy: dict[str, Any], n: dict[str, Any]) -> list[str]:
    """The policy's recipient rule intersected with visibility - a ceiling the rule cannot raise (CR section 7)."""
    rec = policies.effective_recipients(policy, nsettings.failures_audience(conn))
    rule = rec.get("rule") or "scope"
    if rule == "scope":
        candidates = _active_users(conn)
    elif rule == "managers":
        candidates = managers(conn)
    elif rule == "initiator":
        candidates = [n["initiator_user_id"]] if n.get("initiator_user_id") else []
    else:
        candidates = list(rec.get("user_ids") or [])
    out = []
    for uid in dict.fromkeys(candidates):
        p = principal_of(conn, uid)
        if p is not None and Reach(conn, p).can_see(n):
            out.append(uid)
    return out


def escalation_targets(conn: sqlite3.Connection, esc: dict[str, Any], n: dict[str, Any]) -> list[str]:
    """Who an escalation reaches: the notify.manage holders (or the named users) who may also see the row."""
    ids = managers(conn) if esc.get("to") == "managers" else [u for u in (esc.get("to") or []) if isinstance(u, str)]
    out = []
    for uid in dict.fromkeys(ids):
        p = principal_of(conn, uid)
        if p is not None and Reach(conn, p).can_see(n):
            out.append(uid)
    return out


# ---------------------------------------------------------------- emit

def _row_note(row: sqlite3.Row) -> dict[str, Any]:
    d = dict(row)
    d["origin"] = json.loads(d.get("origin_json") or "{}")
    d["params"] = json.loads(d.get("params_json") or "{}")
    return d


def _escalate_at(conn: sqlite3.Connection, severity: str, now: dt.datetime) -> str | None:
    if severity != "critical":
        return None
    esc = nsettings.load(conn)["escalation"]
    if not esc["enabled"]:
        return None
    return iso_utc(now + dt.timedelta(minutes=esc["after_min"]))


def emit(conn: sqlite3.Connection, signal: Signal) -> str | None:
    """The notification id when a row was CREATED; None when the source is disabled or the signal folded into an open row (or
    resolved one). Callers that need the row id in every case use emit_full()."""
    r = emit_full(conn, signal)
    return r.id if r.action == "created" else None


def emit_full(conn: sqlite3.Connection, signal: Signal) -> EmitResult:
    """emit() with the full answer. Atomic inside the caller's transaction: it runs in a SAVEPOINT, so an error part-way (a row made, its recipients
    not) is rolled back to the savepoint and re-raised - a caller that catches it (every source hook does) never commits a half-made notification
    and never loses the rest of its own transaction."""
    conn.execute("SAVEPOINT notify_emit")
    try:
        res = _emit(conn, signal)
    except BaseException:
        conn.execute("ROLLBACK TO notify_emit")
        conn.execute("RELEASE notify_emit")
        raise
    conn.execute("RELEASE notify_emit")
    return res


def _emit(conn: sqlite3.Connection, signal: Signal) -> EmitResult:
    policy = policies.get_policy(conn, signal.source)
    if policy is None:
        log.warning("notification signal of an unknown source %r ignored", signal.source)
        return EmitResult(None, "unknown_source")
    key = dedupe_key_of(signal)
    now = now_utc()
    open_row = conn.execute("SELECT * FROM notifications WHERE dedupe_key = ? AND state != 'resolved'", (key,)).fetchone()
    if signal.resolve:
        if open_row is None:
            return EmitResult(None, "nothing_to_resolve")
        _resolve(conn, open_row, policy, now, str(signal.params.get("resolution") or "condition_ended"), signal.params.get("resolve_text"))
        return EmitResult(open_row["id"], "resolved")
    if not policy["enabled"]:
        return EmitResult(None, "disabled")
    severity = signal.severity if signal.severity in SEVERITY_RANK else policy["severity"]
    if open_row is not None:
        window = int(policy["dedupe_window_s"] or 0)
        age = (now - parse_utc(open_row["last_at"])).total_seconds()
        if window == 0 or age <= window:
            return _fold(conn, open_row, signal, severity, policy, now)
        _resolve(conn, open_row, policy, now, "superseded", None, notice=False)
    return _create(conn, signal, severity, policy, key, now)


def _create(conn: sqlite3.Connection, s: Signal, severity: str, policy: dict[str, Any], key: str, now: dt.datetime) -> EmitResult:
    nid = new_id()
    stamp = iso_utc(now)
    params = dict(s.params)
    place = s.place or params.get("place")
    area = s.area_id
    if s.subject_kind == "entity" and s.subject_id:
        r = conn.execute("SELECT area_id, area_name FROM ha_entities WHERE entity_id = ?", (s.subject_id,)).fetchone()
        if r:
            area = area if area is not None else r["area_id"]
            place = place or r["area_name"] or None  # the label the title shows: the entity's area
    elif s.subject_kind == "camera" and s.subject_id and not place:
        r = conn.execute("SELECT alias, name_source, channel FROM cameras WHERE id = ?", (s.subject_id,)).fetchone()
        place = (r["alias"] or r["name_source"] or f"ערוץ {r['channel']}") if r else None
    if place:
        params["place"] = place
    title, body = policies.render(s.source, params)
    category = s.category if s.category in policies.CATEGORIES else policy["category"]
    conn.execute(
        """INSERT INTO notifications(id, source, category, severity, subject_kind, subject_id, area_id, title, body, place, link, params_json, dedupe_key, count, first_at, last_at, state,
                                     origin_json, initiator_user_id, escalation_step, escalate_at, created_at)
           VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,1,?,?,'open',?,?,0,?,?)""",
        (nid, s.source, category, severity, s.subject_kind, s.subject_id, area, title, body, place, _default_link(s), json.dumps(params, ensure_ascii=False), key, stamp, stamp,
         json.dumps(s.origin, ensure_ascii=False), s.initiator_user_id, _escalate_at(conn, severity, now), stamp),
    )
    _event(conn, nid, "created", stamp)
    n = _row_note(conn.execute("SELECT * FROM notifications WHERE id = ?", (nid,)).fetchone())
    users = recipients_for(conn, policy, n)
    for uid in users:
        conn.execute("INSERT INTO notification_recipients(notification_id, user_id, decision, added_at) VALUES (?,?,?,?)", (nid, uid, policies.effective_recipients(policy, nsettings.failures_audience(conn))["rule"], stamp))
    _enqueue(conn, "dispatch", nid, {"mode": "new"})
    _frames(conn, nid, [{"type": "notification", "payload": {"id": nid, "category": category, "severity": severity, "unread": True}}], users)
    return EmitResult(nid, "created")


def _fold(conn: sqlite3.Connection, row: sqlite3.Row, s: Signal, severity: str, policy: dict[str, Any], now: dt.datetime) -> EmitResult:
    stamp = iso_utc(now)
    nid = row["id"]
    count = row["count"] + 1
    params = {**json.loads(row["params_json"] or "{}"), **s.params}
    if s.place:
        params["place"] = s.place
    title, body = policies.render(s.source, params)
    rose = SEVERITY_RANK[severity] > SEVERITY_RANK[row["severity"]]
    escalate = row["escalate_at"]
    sets = {"count": count, "last_at": stamp, "params_json": json.dumps(params, ensure_ascii=False), "body": body, "title": title}
    if rose:
        sets["severity"] = severity
        if row["state"] == "open" and not escalate:
            sets["escalate_at"] = _escalate_at(conn, severity, now)
    conn.execute(f"UPDATE notifications SET {', '.join(f'{k} = ?' for k in sets)} WHERE id = ?", (*sets.values(), nid))
    last = conn.execute("SELECT id, kind FROM notification_events WHERE notification_id = ? ORDER BY id DESC LIMIT 1", (nid,)).fetchone()
    if last is not None and last["kind"] == "folded":  # a burst is one timeline entry that keeps counting
        conn.execute("UPDATE notification_events SET at = ?, count = ? WHERE id = ?", (stamp, count, last["id"]))
    else:
        _event(conn, nid, "folded", stamp, count=count)
    if rose:
        conn.execute("UPDATE notification_recipients SET read_at = NULL WHERE notification_id = ?", (nid,))
        _enqueue(conn, "dispatch", nid, {"mode": "renotify"})
    _frames(conn, nid, [{"type": "notification_state", "payload": {"id": nid, "state": row["state"], "count": count}}])
    if rose:
        _frames(conn, nid, [{"type": "notification", "payload": {"id": nid, "category": row["category"], "severity": severity, "unread": True}}])
    return EmitResult(nid, "renotified" if rose else "folded")


def _resolve(conn: sqlite3.Connection, row: sqlite3.Row, policy: dict[str, Any], now: dt.datetime, resolution: str, text: str | None, *, notice: bool = True) -> None:
    stamp = iso_utc(now)
    nid = row["id"]
    conn.execute("UPDATE notifications SET state = 'resolved', resolved_at = ?, resolution = ?, escalate_at = NULL WHERE id = ?", (stamp, resolution, nid))
    _event(conn, nid, "resolved", stamp)
    _frames(conn, nid, [{"type": "notification_state", "payload": {"id": nid, "state": "resolved"}}])
    if notice and policy.get("resolve_notice") and resolution != "superseded":
        _enqueue(conn, "dispatch", nid, {"mode": "resolved", "text": text})


# ---------------------------------------------------------------- reading (inbox, summary, one row)

def _display(conn: sqlite3.Connection, user_id: str | None) -> str | None:
    if not user_id:
        return None
    r = conn.execute("SELECT display_name, username FROM users WHERE id = ?", (user_id,)).fetchone()
    return (r["display_name"] or r["username"] or None) if r else None


def _timeline(conn: sqlite3.Connection, nid: str) -> list[dict[str, Any]]:
    out = []
    for e in conn.execute("SELECT * FROM notification_events WHERE notification_id = ? ORDER BY id", (nid,)).fetchall():
        item: dict[str, Any] = {"at": e["at"], "kind": e["kind"]}
        if e["step"] is not None:
            item["step"] = e["step"]
        if e["count"] is not None:
            item["count"] = e["count"]
        if e["by_user_id"]:
            by = _display(conn, e["by_user_id"])
            if by:
                item["by_display"] = by
        if e["channel"]:
            item["channel"] = e["channel"]
        out.append(item)
    return out


def _snapshot_ready(conn: sqlite3.Connection, n: dict[str, Any], data_dir: Any) -> bool:
    if n["subject_kind"] != "camera" and not n["origin"].get("camera_id"):
        return False
    ev = n["origin"].get("event_id")
    if not ev or data_dir is None:
        return False
    try:
        from . import thumbnails

        return thumbnails.path_for(_FakeSettings(data_dir), str(ev)).is_file()
    except Exception:  # noqa: BLE001 - a missing thumbnail folder is "no snapshot"
        return False


class _FakeSettings:
    def __init__(self, data_dir: Any) -> None:
        self.data_dir = data_dir


def serialize(conn: sqlite3.Connection, row: sqlite3.Row, principal: Principal, reach: Reach, rec: sqlite3.Row | None = None, data_dir: Any = None) -> dict[str, Any]:
    n = _row_note(row)
    if rec is None:
        rec = conn.execute("SELECT * FROM notification_recipients WHERE notification_id = ? AND user_id = ?", (n["id"], principal.user_id)).fetchone()
    mine = [
        {"channel": d["channel"], "status": d["status"], "reason": d["reason"], "at": d["sent_at"] or d["created_at"]}
        for d in conn.execute("SELECT channel, status, reason, sent_at, created_at FROM notification_deliveries WHERE notification_id = ? AND user_id = ? ORDER BY created_at, id", (n["id"], principal.user_id)).fetchall()
    ]
    return {
        "id": n["id"], "source": n["source"], "category": n["category"], "severity": n["severity"], "title": n["title"], "body": n["body"], "place_name": n["place"],
        "subject": {"kind": n["subject_kind"], "id": n["subject_id"], "area_id": n["area_id"]}, "link": n["link"], "count": n["count"],
        "first_at": n["first_at"], "last_at": n["last_at"], "state": n["state"], "acked_at": n["acked_at"], "acked_by_display": _display(conn, n["acked_by"]), "resolved_at": n["resolved_at"],
        "me": {"read_at": rec["read_at"] if rec else None, "snoozed_until": rec["snoozed_until"] if rec else None},
        "can_ack": n["state"] != "resolved" and reach.can_ack(n), "has_snapshot": _snapshot_ready(conn, n, data_dir), "door": reach.door(n),
        "timeline": _timeline(conn, n["id"]), "my_deliveries": mine,
    }


def get_row(conn: sqlite3.Connection, principal: Principal, nid: str) -> tuple[sqlite3.Row, sqlite3.Row, Reach] | None:
    """The notification AND the caller's recipient row, only when the caller is a recipient who still may see it."""
    row = conn.execute("SELECT * FROM notifications WHERE id = ?", (nid,)).fetchone()
    rec = conn.execute("SELECT * FROM notification_recipients WHERE notification_id = ? AND user_id = ?", (nid, principal.user_id)).fetchone()
    if row is None or rec is None:
        return None
    reach = Reach(conn, principal)
    if not reach.can_see(_row_note(row)):
        return None
    return row, rec, reach


def list_for(conn: sqlite3.Connection, principal: Principal, *, state: str = "all", category: str | None = None, severity_min: str | None = None, unread: bool = False,
             before: str | None = None, limit: int = 50, data_dir: Any = None) -> dict[str, Any]:
    """The caller's inbox, newest first, each row re-checked against the caller's CURRENT visibility."""
    where = ["r.user_id = ?"]
    params: list[Any] = [principal.user_id]
    if state == "open":
        where.append("n.state != 'resolved'")
    if category:
        where.append("n.category = ?")
        params.append(category)
    if severity_min in SEVERITY_RANK:
        want = [s for s, rank in SEVERITY_RANK.items() if rank >= SEVERITY_RANK[severity_min]]
        where.append(f"n.severity IN ({','.join('?' * len(want))})")
        params.extend(want)
    if unread:
        where.append("r.read_at IS NULL")
    if before:
        where.append("n.last_at < ?")
        params.append(before)
    reach = Reach(conn, principal)
    out: list[dict[str, Any]] = []
    cursor = None
    last_at = None
    while len(out) < limit:  # rows hidden by a revoked scope are skipped, not counted
        page = conn.execute(
            f"SELECT n.*, r.read_at AS _read_at, r.snoozed_until AS _snoozed FROM notifications n JOIN notification_recipients r ON r.notification_id = n.id WHERE {' AND '.join(where)}"
            + (" AND n.last_at < ?" if last_at else "") + " ORDER BY n.last_at DESC, n.id DESC LIMIT ?",
            (*params, *([last_at] if last_at else []), limit * 2),
        ).fetchall()
        if not page:
            cursor = None
            break
        for row in page:
            last_at = row["last_at"]
            if not reach.can_see(_row_note(row)):
                continue
            rec = {"read_at": row["_read_at"], "snoozed_until": row["_snoozed"]}
            out.append(serialize(conn, row, principal, reach, rec, data_dir))  # type: ignore[arg-type]
            if len(out) >= limit:
                break
        if len(page) < limit * 2:
            break
    next_before = out[-1]["last_at"] if len(out) >= limit else None
    # pinned: open critical safety rows stay at the top until acknowledged or resolved
    out.sort(key=lambda x: 0 if (x["category"] == "safety" and x["severity"] == "critical" and x["state"] == "open") else 1)
    return {"notifications": out, "next_before": next_before}


def summary(conn: sqlite3.Connection, principal: Principal) -> dict[str, Any]:
    """`{unread, open_critical, by_category}` for the user-menu chip and the avatar dot: visible rows only, a snoozed row is not
    unread until its time."""
    now = iso_utc(now_utc())
    reach = Reach(conn, principal)
    unread = 0
    crit = 0
    by_cat: dict[str, int] = {}
    rows = conn.execute(
        """SELECT n.*, r.read_at AS _read_at, r.snoozed_until AS _snoozed FROM notifications n JOIN notification_recipients r ON r.notification_id = n.id
           WHERE r.user_id = ? AND ((r.read_at IS NULL AND (r.snoozed_until IS NULL OR r.snoozed_until <= ?)) OR (n.severity = 'critical' AND n.state = 'open'))
           ORDER BY n.last_at DESC LIMIT 500""",
        (principal.user_id, now),
    ).fetchall()
    for row in rows:
        if not reach.can_see(_row_note(row)):
            continue
        if row["_read_at"] is None and (row["_snoozed"] is None or row["_snoozed"] <= now):
            unread += 1
            by_cat[row["category"]] = by_cat.get(row["category"], 0) + 1
        if row["severity"] == "critical" and row["state"] == "open":
            crit += 1
    return {"unread": unread, "open_critical": crit, "by_category": by_cat}


# ---------------------------------------------------------------- per-user and shared state

def mark_read(conn: sqlite3.Connection, principal: Principal, nid: str) -> bool:
    got = get_row(conn, principal, nid)
    if got is None:
        return False
    conn.execute("UPDATE notification_recipients SET read_at = COALESCE(read_at, ?) WHERE notification_id = ? AND user_id = ?", (iso_utc(now_utc()), nid, principal.user_id))
    _summary_frame(conn, principal.user_id, nid)
    return True


def read_all(conn: sqlite3.Connection, principal: Principal) -> int:
    reach = Reach(conn, principal)
    ids = []
    for row in conn.execute("SELECT n.* FROM notifications n JOIN notification_recipients r ON r.notification_id = n.id WHERE r.user_id = ? AND r.read_at IS NULL", (principal.user_id,)).fetchall():
        if reach.can_see(_row_note(row)):
            ids.append(row["id"])
    stamp = iso_utc(now_utc())
    for i in ids:
        conn.execute("UPDATE notification_recipients SET read_at = ? WHERE notification_id = ? AND user_id = ?", (stamp, i, principal.user_id))
    _summary_frame(conn, principal.user_id, None)
    return len(ids)


def snooze(conn: sqlite3.Connection, principal: Principal, nid: str, minutes: Any, tz_name: str) -> str | None:
    """Snooze for the caller only: 60 minutes, or "until_morning" (the quiet window's end). Returns the instant, None when the
    row is not the caller's."""
    got = get_row(conn, principal, nid)
    if got is None:
        return None
    now = now_utc()
    if minutes == "until_morning":
        until = nsettings.morning_after(nsettings.load(conn)["quiet"], now, tz_name)
    else:
        until = now + dt.timedelta(minutes=SNOOZE_MINUTES)
    conn.execute("UPDATE notification_recipients SET snoozed_until = ? WHERE notification_id = ? AND user_id = ?", (iso_utc(until), nid, principal.user_id))
    _summary_frame(conn, principal.user_id, nid)
    return iso_utc(until)


def _summary_frame(conn: sqlite3.Connection, user_id: str, nid: str | None) -> None:
    _enqueue(conn, "ui", nid, {"users": [user_id], "frames": []})  # an empty frame list = just the refreshed summary


def acknowledge(conn: sqlite3.Connection, principal: Principal, nid: str, *, check: bool = True) -> str:
    """Acknowledge (shared, stops escalation). Returns 'ok' | 'not_found' | 'not_allowed'. A source that cannot tell when its
    condition ended (rule alerts, bulk results, sign-ins) is resolved by the acknowledge; one that can (a sensor, a camera) is
    only acknowledged and resolves when the condition does."""
    got = get_row(conn, principal, nid)
    if got is None:
        return "not_found"
    row, _rec, reach = got
    if check and not reach.can_ack(_row_note(row)):
        return "not_allowed"
    if row["state"] != "open":
        return "ok"  # idempotent: already acknowledged (or resolved)
    _ack_state(conn, row, principal.user_id)
    return "ok"


def _ack_state(conn: sqlite3.Connection, row: sqlite3.Row, user_id: str | None, *, cascade_alerts: bool = True) -> None:
    nid = row["id"]
    stamp = iso_utc(now_utc())
    if user_id:  # acknowledging also marks the row read for the one who did it
        conn.execute("UPDATE notification_recipients SET read_at = COALESCE(read_at, ?) WHERE notification_id = ? AND user_id = ?", (stamp, nid, user_id))
    src = policies.BY_KEY.get(row["source"])
    resolves_itself = bool(src and src.resolves)
    conn.execute("UPDATE notifications SET state = 'acknowledged', acked_at = ?, acked_by = ?, escalate_at = NULL WHERE id = ?", (stamp, user_id, nid))
    _event(conn, nid, "acknowledged", stamp, by=user_id)
    if not resolves_itself:
        conn.execute("UPDATE notifications SET state = 'resolved', resolved_at = ?, resolution = 'acknowledged' WHERE id = ?", (stamp, nid))
        _event(conn, nid, "resolved", stamp)
    # a rule alert and its notification mirror each other: the alert rows linked to this notification are acknowledged too
    if cascade_alerts:  # (an acknowledge made on an ALERT row acknowledges that one alert; its folded siblings keep their own state)
        who = conn.execute("SELECT username FROM users WHERE id = ?", (user_id,)).fetchone() if user_id else None
        conn.execute("UPDATE rule_alerts SET acked_at = ?, acked_by = ?, acked_by_username = ? WHERE notification_id = ? AND acked_at IS NULL", (stamp, user_id, who["username"] if who else None, nid))
    new_state = "acknowledged" if resolves_itself else "resolved"
    _frames(conn, nid, [{"type": "notification_state", "payload": {"id": nid, "state": new_state, "acked_by_display": _display(conn, user_id)}}])


def ack_from_alert(conn: sqlite3.Connection, notification_id: str | None, principal: Principal) -> None:
    """The rule-alert route acknowledged an alert: its notification follows (the caller already passed events.ack)."""
    if not notification_id:
        return
    row = conn.execute("SELECT * FROM notifications WHERE id = ?", (notification_id,)).fetchone()
    if row is not None and row["state"] == "open":
        _ack_state(conn, row, principal.user_id, cascade_alerts=False)


# ---------------------------------------------------------------- action tokens (push buttons: ack / snooze only)

def _hash(token: str) -> str:
    return hashlib.sha256(token.encode("utf-8")).hexdigest()


def mint_tokens(conn: sqlite3.Connection, nid: str, user_id: str, actions: list[str]) -> dict[str, str]:
    """One single-use token per action (128-bit, only the hash stored, expires with the push TTL). Only `ack` and `snooze` can
    be minted - there is no token for a door, an alarm or a device command (CR section 9)."""
    out: dict[str, str] = {}
    exp = iso_utc(now_utc() + dt.timedelta(seconds=TOKEN_TTL_S))
    for a in actions:
        if a not in ACTIONS:
            raise ValueError(f"no token for action {a!r}")
        token = secrets.token_urlsafe(16)  # 128 bits
        conn.execute("INSERT INTO notify_action_tokens(token_hash, notification_id, user_id, actions, expires_at) VALUES (?,?,?,?,?)", (_hash(token), nid, user_id, a, exp))
        out[a] = token
    return out


def redeem_token(conn: sqlite3.Connection, token: str, action: str, tz_name: str, expect_user: str | None = None) -> dict[str, Any] | None:
    """Single use: returns {user_id, notification_id, result} when the token authorises `action` on its row for its user AND the
    user still sees (and for ack may acknowledge) it; None for anything else (expired, used, other action, lost reach). A token
    that fails for lost reach is not burned; a used or expired one never works again."""
    return redeem_token_ex(conn, token, action, tz_name, expect_user)[0]


def redeem_token_ex(conn: sqlite3.Connection, token: str, action: str, tz_name: str, expect_user: str | None = None) -> tuple[dict[str, Any] | None, str]:
    """redeem_token plus WHY it failed: `malformed` | `unknown` (no such token - a guess) | `expired` | `used` | `mismatch` (another action or another user's
    session) | `lost_reach` | `ok`. The action endpoint's throttle counts only the first two: a stale button is not an attack."""
    if action not in ACTIONS or not isinstance(token, str) or not 8 <= len(token) <= 128:
        return None, "malformed"
    r = conn.execute("SELECT * FROM notify_action_tokens WHERE token_hash = ?", (_hash(token),)).fetchone()
    if r is None:
        return None, "unknown"
    if r["used_at"]:
        return None, "used"
    if r["expires_at"] <= iso_utc(now_utc()):
        return None, "expired"
    if r["actions"] != action or (expect_user is not None and r["user_id"] != expect_user):
        return None, "mismatch"  # (expect_user: the remote channel's session must be the token's own user)
    p = principal_of(conn, r["user_id"])
    if p is None:
        return None, "lost_reach"
    got = get_row(conn, p, r["notification_id"])
    if got is None:
        return None, "lost_reach"
    row, _rec, reach = got
    if action == "ack" and not reach.can_ack(_row_note(row)):
        return None, "lost_reach"
    if conn.execute("UPDATE notify_action_tokens SET used_at = ? WHERE token_hash = ? AND used_at IS NULL", (iso_utc(now_utc()), r["token_hash"])).rowcount != 1:
        return None, "used"
    if action == "ack":
        if row["state"] == "open":
            _ack_state(conn, row, p.user_id)
        result = "acknowledged"
    else:
        snooze(conn, p, r["notification_id"], 60, tz_name)
        result = "snoozed"
    return {"user_id": p.user_id, "username": p.username, "notification_id": r["notification_id"], "result": result, "principal": p}, "ok"


# ---------------------------------------------------------------- escalation (owner decision 6a)

def escalation_tick(conn: sqlite3.Connection, now: dt.datetime | None = None) -> int:
    """Re-send every unacknowledged CRITICAL row whose time has come to the administrators (settings: after N minutes, at most
    M steps), bypassing quiet hours; stops at once on acknowledge or resolve (those clear `escalate_at`). Each step is a
    timeline entry and an outbox dispatch. Returns the number of steps taken. Runs in a write transaction."""
    from ..audit import audit

    now = now or now_utc()
    st = nsettings.load(conn)
    esc = st["escalation"]
    stamp = iso_utc(now)
    due = conn.execute("SELECT * FROM notifications WHERE state = 'open' AND severity = 'critical' AND escalate_at IS NOT NULL AND escalate_at <= ? ORDER BY escalate_at", (stamp,)).fetchall()
    steps = 0
    for row in due:
        nid = row["id"]
        if not esc["enabled"] or row["escalation_step"] >= esc["steps"]:
            conn.execute("UPDATE notifications SET escalate_at = NULL WHERE id = ?", (nid,))
            continue
        step = row["escalation_step"] + 1
        n = _row_note(row)
        targets = escalation_targets(conn, esc, n)
        for uid in targets:
            conn.execute("INSERT OR IGNORE INTO notification_recipients(notification_id, user_id, decision, added_at) VALUES (?,?,?,?)", (nid, uid, "escalation", stamp))
        nxt = iso_utc(now + dt.timedelta(minutes=esc["after_min"])) if step < esc["steps"] else None
        conn.execute("UPDATE notifications SET escalation_step = ?, escalate_at = ? WHERE id = ?", (step, nxt, nid))
        _event(conn, nid, "escalated", stamp, step=step, count=len(targets))
        audit(conn, actor=None, action="notify.escalate", decision="allowed", resource_type="notification", resource_id=nid, details={"step": step, "recipients": len(targets), "source": row["source"]})
        _enqueue(conn, "dispatch", nid, {"mode": "escalate", "step": step, "users": targets})
        _frames(conn, nid, [{"type": "notification", "payload": {"id": nid, "category": row["category"], "severity": "critical", "unread": True}}], targets)
        steps += 1
    return steps


# ---------------------------------------------------------------- retention janitor

def retention_sweep(conn: sqlite3.Connection, now: dt.datetime | None = None) -> dict[str, int]:
    """Delete RESOLVED notifications older than the configured retention (their recipients, timeline and deliveries go with them), deliveries
    past 14 days, expired or used action tokens and stale outbox rows. A row whose condition is still open (open, or acknowledged but not
    resolved) is never deleted by age - it is still the live state of something - except as a last-resort cap at a year."""
    now = now or now_utc()
    st = nsettings.load(conn)
    cutoff = iso_utc(now - dt.timedelta(days=st["retention_days"]))
    n = conn.execute("DELETE FROM notifications WHERE state = 'resolved' AND last_at < ?", (cutoff,)).rowcount
    n += conn.execute("DELETE FROM notifications WHERE last_at < ?", (iso_utc(now - dt.timedelta(days=max(365, st["retention_days"]))),)).rowcount
    d = conn.execute("DELETE FROM notification_deliveries WHERE created_at < ?", (iso_utc(now - dt.timedelta(days=st["deliveries_retention_days"])),)).rowcount
    t = conn.execute("DELETE FROM notify_action_tokens WHERE expires_at < ? OR used_at IS NOT NULL", (iso_utc(now - dt.timedelta(hours=1)),)).rowcount
    o = conn.execute("DELETE FROM notify_outbox WHERE created_at < ?", (iso_utc(now - dt.timedelta(days=1)),)).rowcount
    return {"notifications": n, "deliveries": d, "tokens": t, "outbox": o}


def center_state(conn: sqlite3.Connection, tz_name: str, now: dt.datetime | None = None) -> dict[str, Any]:
    """What EVERY user's notification center needs from the installation's settings (the settings themselves are administrator-only): the desktop
    layout (`center_layout`: sheet | page) and whether quiet hours are active right now and until when (the center's "שעות שקט עד 07:00" banner)."""
    now = now or now_utc()
    st = nsettings.load(conn)
    active = nsettings.in_quiet_hours(st["quiet"], now, tz_name)
    return {"center_layout": st["center_layout"], "quiet_active": active, "quiet_until": iso_utc(nsettings.morning_after(st["quiet"], now, tz_name)) if active else None}
