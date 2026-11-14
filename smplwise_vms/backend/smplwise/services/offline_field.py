"""OFFLINE110-295 slice 1: offline field work, the SERVER half (task r110). No mobile code here; the app teams consume these contracts.

Switch `field_offline.enabled` is OFF by default. Every number below is a setting, editable by a system administrator (system.configure).

  bundle    today's work for one technician: tickets assigned to him for `bundle_days` days ahead (default 3), the round points, the cards of
            the devices those tickets name; NO floor plans. Valid `cache_hours` (36) from issue; after that the phone seals its cache.
  replay    the phone's outbox ops (client_request_id = the tickets' CLIENT_REQUEST_RE, so a replay is idempotent):
            - note / checklist_point / round_checkpoint are append-only: they commute and are applied.
            - status_move is re-validated against the CURRENT state (STATUS_MOVES, note_required). Server wins: if the ticket moved on and the
              move is no longer legal, it is NOT applied and the technician's intent is kept as a note on the ticket (`conflict_rule`).
            - a ticket the user no longer holds (reassigned, closed, cancelled, gone) is never written: the op is HELD for a manager review.
            - an op claimed older than `unsent_retention_days` (14) is HELD for manager review instead of being applied.
  device    lock / remote wipe: a manager can mark a device; a phone that connects after `cache_hours` is told to lock (sealed until a fresh
            bundle) and, after the retention window too, to wipe. A wipe is delivered at the next connect and confirmed by the phone.
  day list  read-only list of the day with an acknowledge-receipt per user and day.
  tags      round-point tag `SWRP1.<point>.<mac>`: HMAC-SHA256 under a server key file in the data directory. Verified here; PRINTING tags is a
            later job (this module only produces the payload text)."""
from __future__ import annotations

import base64
import datetime as dt
import hashlib
import hmac
import json
import os
import re
import sqlite3
from pathlib import Path
from typing import Any, Callable
from zoneinfo import ZoneInfo

from ..audit import audit
from ..db import get_setting, new_id, now_iso, set_setting
from ..errors import ApiError
from ..rbac import Principal
from .tickets import access, model, service, store
from .tickets.access import Viewer
from .timeutil import parse_utc

PREFIX = "field_offline."
OP_TYPES = ("note", "status_move", "checklist_point", "round_checkpoint")
APPEND_ONLY = ("note", "checklist_point", "round_checkpoint")
MAX_OPS = 200
TAG_RE = re.compile(r"^SWRP1\.([A-Za-z0-9_-]{4,40})\.([A-Za-z0-9_-]{22})$")


def _int_in(lo: int, hi: int) -> Callable[[str], bool]:
    return lambda v: v.isdigit() and lo <= int(v) <= hi


def _bool(v: str) -> bool:
    return v in ("0", "1")


SETTINGS: dict[str, tuple[str, Callable[[str], bool]]] = {
    PREFIX + "enabled": ("0", _bool),                                  # the module is OFF until the owner turns it on
    PREFIX + "bundle_days": ("3", _int_in(1, 14)),                      # assigned requests this many days ahead
    PREFIX + "cache_hours": ("36", _int_in(1, 168)),                    # cache validity on the phone
    PREFIX + "include_rounds": ("1", _bool),
    PREFIX + "include_device_cards": ("1", _bool),
    PREFIX + "conflict_rule": ("server_wins_note", lambda v: v in ("server_wins_note", "hold_for_review")),
    PREFIX + "reassigned_to_review": ("1", _bool),                      # changes of a reassigned request go to manager review (0 = rejected)
    PREFIX + "unsent_retention_days": ("14", _int_in(1, 90)),           # unsent changes older than this go to review instead of the request
    PREFIX + "lock_on_expiry": ("1", _bool),
    PREFIX + "wipe_on_expiry": ("1", _bool),                            # wipe at the next connect once expiry + retention passed
    PREFIX + "day_list_ack": ("1", _bool),
}


def setting(conn: sqlite3.Connection, key: str) -> str:
    default, valid = SETTINGS[key]
    v = get_setting(conn, key, default)
    return v if isinstance(v, str) and valid(v) else default


def settings_view(conn: sqlite3.Connection) -> dict[str, str]:
    return {k: setting(conn, k) for k in SETTINGS}


def enabled(conn: sqlite3.Connection) -> bool:
    return setting(conn, PREFIX + "enabled") == "1"


def require_enabled(conn: sqlite3.Connection) -> None:
    if not enabled(conn):
        raise ApiError(404, "feature_disabled", "עבודת שטח ללא קליטה כבויה בהגדרות המערכת.")


def update_settings(conn: sqlite3.Connection, principal: Principal, changes: dict[str, Any], rid: str | None) -> dict[str, tuple[str, str]]:
    for key, value in changes.items():
        if key not in SETTINGS or not isinstance(value, str) or not SETTINGS[key][1](value):
            raise ApiError(422, "invalid_setting", "ערך לא תקין להגדרה.", details={"key": str(key)[:64]})
    out: dict[str, tuple[str, str]] = {}
    for key, value in changes.items():
        before = setting(conn, key)
        if before != value:
            set_setting(conn, key, value)
            out[key] = (before, value)
            audit(conn, actor=principal, action="settings.changed", decision="allowed", resource_type="setting", resource_id=key, request_id=rid,
                  details={"key": key, "before": before, "after": value})
    return out


def _z(v: dt.datetime) -> str:
    return v.astimezone(dt.timezone.utc).replace(microsecond=0).isoformat().replace("+00:00", "Z")


def _now(now: dt.datetime | None) -> dt.datetime:
    return now or dt.datetime.now(dt.timezone.utc)


# ---------------------------------------------------------------- devices

def _device(conn: sqlite3.Connection, user_id: str, device_id: str, now: dt.datetime) -> dict[str, Any]:
    row = conn.execute("SELECT * FROM offline_devices WHERE user_id = ? AND device_id = ?", (user_id, device_id)).fetchone()
    if row is None:
        conn.execute("INSERT INTO offline_devices(device_id, user_id, state, created_at, last_seen_at) VALUES (?, ?, 'active', ?, ?)",
                     (device_id, user_id, _z(now), _z(now)))
        row = conn.execute("SELECT * FROM offline_devices WHERE user_id = ? AND device_id = ?", (user_id, device_id)).fetchone()
    conn.execute("UPDATE offline_devices SET last_seen_at = ? WHERE user_id = ? AND device_id = ?", (_z(now), user_id, device_id))
    return dict(row)


def device_action(conn: sqlite3.Connection, dev: dict[str, Any], now: dt.datetime) -> str:
    """What the phone must do at this connect: ok | lock | wipe. A pending (or done) wipe always wins."""
    if dev["state"] in ("wipe_pending", "wiped"):
        return "wipe"
    if dev["state"] == "locked":
        return "lock"
    until = dev.get("valid_until")
    if until:
        expired = parse_utc(until)
        if now > expired:
            keep = dt.timedelta(days=int(setting(conn, PREFIX + "unsent_retention_days")))
            if setting(conn, PREFIX + "wipe_on_expiry") == "1" and now > expired + keep:
                return "wipe"
            if setting(conn, PREFIX + "lock_on_expiry") == "1":
                return "lock"
    return "ok"


def set_device_state(conn: sqlite3.Connection, principal: Principal, user_id: str, device_id: str, action: str, reason: str, rid: str | None,
                     now: dt.datetime | None = None) -> dict[str, Any]:
    now = _now(now)
    row = conn.execute("SELECT * FROM offline_devices WHERE user_id = ? AND device_id = ?", (user_id, device_id)).fetchone()
    if row is None:
        raise ApiError(404, "device_not_found", "המכשיר לא נמצא.")
    if action == "lock":
        conn.execute("UPDATE offline_devices SET state = 'locked', lock_reason = ? WHERE user_id = ? AND device_id = ?", (reason[:200], user_id, device_id))
    elif action == "unlock":
        if row["state"] in ("wipe_pending", "wiped"):
            raise ApiError(409, "device_wiped", "מכשיר שנמחק לא ננעל מחדש. יש לאשר אותו מחדש.")
        conn.execute("UPDATE offline_devices SET state = 'active', lock_reason = NULL WHERE user_id = ? AND device_id = ?", (user_id, device_id))
    elif action == "wipe":
        conn.execute("UPDATE offline_devices SET state = 'wipe_pending', wipe_requested_at = ?, lock_reason = ? WHERE user_id = ? AND device_id = ?",
                     (_z(now), reason[:200], user_id, device_id))
    elif action == "reenroll":  # a wiped phone signs in again: the device becomes active and gets a fresh bundle
        conn.execute("UPDATE offline_devices SET state = 'active', lock_reason = NULL, valid_until = NULL WHERE user_id = ? AND device_id = ?", (user_id, device_id))
    else:
        raise ApiError(422, "invalid_action", "פעולה לא ידועה.")
    audit(conn, actor=principal, action=f"offline.device.{action}", decision="allowed", resource_type="offline_device", resource_id=device_id,
          request_id=rid, details={"user_id": user_id})
    return dict(conn.execute("SELECT * FROM offline_devices WHERE user_id = ? AND device_id = ?", (user_id, device_id)).fetchone())


def confirm_wipe(conn: sqlite3.Connection, user_id: str, device_id: str, now: dt.datetime | None = None) -> None:
    """The phone says the cache is gone."""
    row = conn.execute("SELECT state FROM offline_devices WHERE user_id = ? AND device_id = ?", (user_id, device_id)).fetchone()
    if row is None:
        raise ApiError(404, "device_not_found", "המכשיר לא נמצא.")
    conn.execute("UPDATE offline_devices SET state = 'wiped', wipe_confirmed_at = ?, valid_until = NULL WHERE user_id = ? AND device_id = ?",
                 (_z(_now(now)), user_id, device_id))


# ---------------------------------------------------------------- the bundle

def _my_tickets(conn: sqlite3.Connection, user_id: str, now: dt.datetime, days: int) -> list[dict[str, Any]]:
    horizon = _z(now + dt.timedelta(days=days))
    rows = conn.execute(
        "SELECT t.* FROM tickets t JOIN ticket_assignments a ON a.id = t.current_assignment_id "
        "WHERE a.user_id = ? AND a.ended_at IS NULL AND t.status NOT IN ('closed', 'cancelled', 'new') "
        "AND (t.eta_at IS NULL OR t.eta_at <= ?) ORDER BY COALESCE(t.eta_at, t.created_at), t.number", (user_id, horizon)).fetchall()
    return [dict(r) for r in rows]


def _ticket_view(r: dict[str, Any]) -> dict[str, Any]:
    return {"id": r["id"], "number": r["number"], "title": r["title"], "description": r["description"], "status": r["status"],
            "revision": r["revision"], "eta_at": r["eta_at"], "place_text": r["place_text"], "entity_id": r["entity_id"],
            "device_name": r["device_name"], "department_id": r["department_id"], "updated_at": r["updated_at"]}


def build_bundle(conn: sqlite3.Connection, principal: Principal, device_id: str, now: dt.datetime | None = None) -> dict[str, Any]:
    now = _now(now)
    dev = _device(conn, principal.user_id, device_id, now)
    if dev["state"] in ("wipe_pending", "wiped"):
        return {"status": "wipe", "device_action": "wipe"}
    if dev["state"] == "locked":
        return {"status": "locked", "device_action": "lock", "reason": dev.get("lock_reason")}
    if device_action(conn, dev, now) == "wipe":  # expiry + retention passed: the phone clears itself (its unsent ops come through /sync first)
        return {"status": "wipe", "device_action": "wipe"}
    hours = int(setting(conn, PREFIX + "cache_hours"))
    until = _z(now + dt.timedelta(hours=hours))
    # a connect with a fresh bundle ends an expiry lock
    conn.execute("UPDATE offline_devices SET bundle_issued_at = ?, valid_until = ? WHERE user_id = ? AND device_id = ?", (_z(now), until, principal.user_id, device_id))
    tickets = _my_tickets(conn, principal.user_id, now, int(setting(conn, PREFIX + "bundle_days")))
    out: dict[str, Any] = {"status": "ok", "device_action": "ok", "issued_at": _z(now), "valid_until": until, "cache_hours": hours,
                           "tickets": [_ticket_view(t) for t in tickets], "floor_plans": False}
    if setting(conn, PREFIX + "include_rounds") == "1":
        out["rounds"] = [dict(r) for r in conn.execute("SELECT id, name, entity_id, place_text FROM offline_round_points WHERE enabled = 1 ORDER BY name").fetchall()]
    if setting(conn, PREFIX + "include_device_cards") == "1":
        cards, seen = [], set()
        for t in tickets:
            key = t["entity_id"] or t["registry_id"]
            if key and key not in seen:
                seen.add(key)
                cards.append({"entity_id": t["entity_id"], "registry_id": t["registry_id"], "device_name": t["device_name"], "place_text": t["place_text"],
                              "ticket_ids": [x["id"] for x in tickets if (x["entity_id"] or x["registry_id"]) == key]})
        out["device_cards"] = cards
    return out


# ---------------------------------------------------------------- replay

def _record(conn: sqlite3.Connection, principal: Principal, device_id: str, op: dict[str, Any], outcome: str, reason: str | None, review: str, now: dt.datetime) -> str:
    oid = new_id()
    conn.execute(
        "INSERT INTO offline_ops(id, user_id, device_id, client_request_id, ticket_id, base_revision, op_type, payload_json, claimed_at, received_at, outcome, reason, review_state) "
        "VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
        (oid, principal.user_id, device_id, op["client_request_id"], op.get("ticket_id"), op.get("base_revision"), op["type"],
         json.dumps(op.get("payload") or {}, ensure_ascii=False)[:8000], op.get("claimed_device_time"), _z(now), outcome, reason, review))
    return oid


def _check_op(op: Any) -> dict[str, Any]:
    if not isinstance(op, dict):
        raise ValueError("op")
    if not isinstance(op.get("client_request_id"), str) or not model.CLIENT_REQUEST_RE.match(op["client_request_id"]):
        raise ValueError("client_request_id")
    if op.get("type") not in OP_TYPES:
        raise ValueError("type")
    if op.get("ticket_id") is not None and not isinstance(op["ticket_id"], str):
        raise ValueError("ticket_id")
    if op["type"] != "round_checkpoint" and not op.get("ticket_id"):
        raise ValueError("ticket_id")
    if op.get("base_revision") is not None and (isinstance(op["base_revision"], bool) or not isinstance(op["base_revision"], int)):
        raise ValueError("base_revision")
    if op.get("payload") is not None and not isinstance(op["payload"], dict):
        raise ValueError("payload")
    c = op.get("claimed_device_time")
    if c is not None:
        try:
            parse_utc(c)
        except Exception:  # noqa: BLE001
            raise ValueError("claimed_device_time") from None
    return op


def _res(op: dict[str, Any], outcome: str, reason: str | None) -> dict[str, Any]:
    return {"client_request_id": op["client_request_id"], "outcome": outcome, "reason": reason}


def replay_op(conn: sqlite3.Connection, principal: Principal, data_dir: Path, device_id: str, raw: Any, rid: str | None, now: dt.datetime) -> dict[str, Any]:
    try:
        op = _check_op(raw)
    except ValueError as exc:
        return {"client_request_id": raw.get("client_request_id") if isinstance(raw, dict) else None, "outcome": "rejected", "reason": f"invalid_{exc}"}
    prior = conn.execute("SELECT * FROM offline_ops WHERE user_id = ? AND client_request_id = ?", (principal.user_id, op["client_request_id"])).fetchone()
    if prior is not None:
        return {**_res(op, prior["outcome"], prior["reason"]), "replayed": True}
    review_on = setting(conn, PREFIX + "reassigned_to_review") == "1"
    payload = op.get("payload") or {}
    # too old: to a manager, never onto the request
    keep = dt.timedelta(days=int(setting(conn, PREFIX + "unsent_retention_days")))
    claimed = op.get("claimed_device_time")
    if claimed and now - parse_utc(claimed) > keep:
        _record(conn, principal, device_id, op, "held", "retention_expired", "pending", now)
        return _res(op, "held", "retention_expired")
    # a round checkpoint must carry a tag this server signed
    point = None
    if op["type"] == "round_checkpoint":
        point = verify_tag(conn, data_dir, str(payload.get("tag", "")))
        if point is None:
            _record(conn, principal, device_id, op, "rejected", "bad_tag", "none", now)
            return _res(op, "rejected", "bad_tag")
    viewer = Viewer(conn, principal)
    seen = access.visible_by_id(viewer, op["ticket_id"]) if op.get("ticket_id") else None
    if op.get("ticket_id") and (seen is None or not seen.assignee or seen.row["status"] in model.FINAL):
        outcome, review = ("held", "pending") if review_on else ("rejected", "none")
        _record(conn, principal, device_id, op, outcome, "not_assignee_or_closed", review, now)
        return _res(op, outcome, "not_assignee_or_closed")
    result, reason = "applied", None
    text = str(payload.get("text") or payload.get("note") or "")[:model.NOTE_MAX]
    if op["type"] in APPEND_ONLY:
        if seen is not None:
            body = text or op["type"]
            if op["type"] == "round_checkpoint":
                body = f"נקודת סבב: {point['name']}"
            elif op["type"] == "checklist_point":
                body = f"נקודת רשימה: {text or payload.get('point', '')}"[:model.NOTE_MAX]
            service.add_note(conn, viewer, seen, body, False, rid)
    else:  # status_move: the server wins
        to = str(payload.get("to", ""))
        frm = seen.row["status"]
        legal = model.may_move("assignee", frm, to) and not model.note_required(frm, to)
        if legal:
            try:
                service.change_status(conn, viewer, seen, to, text or None, seen.row["revision"], None, rid)
            except ApiError as exc:
                legal = False
                reason = f"move_refused_{exc.code}"
        if not legal:
            if setting(conn, PREFIX + "conflict_rule") == "hold_for_review":
                _record(conn, principal, device_id, op, "held", reason or "conflict", "pending", now)
                return _res(op, "held", reason or "conflict")
            kept = f"פעולת הטכנאי בלי קליטה לא יושמה (המצב השתנה): {frm} ← {to}. {text}".strip()[:model.NOTE_MAX]
            service.add_note(conn, viewer, seen, kept, False, rid)
            result, reason = "noted", reason or "state_moved"
    _record(conn, principal, device_id, op, result, reason, "none", now)
    return _res(op, result, reason)


def sync(conn: sqlite3.Connection, principal: Principal, data_dir: Path, device_id: str, ops: list[Any], rid: str | None, now: dt.datetime | None = None) -> dict[str, Any]:
    now = _now(now)
    if len(ops) > MAX_OPS:
        raise ApiError(413, "too_many_ops", "יותר מדי פעולות בבקשה אחת.")
    dev = _device(conn, principal.user_id, device_id, now)
    results = []
    for raw in ops:  # every op in its own savepoint: one bad op never costs the batch
        conn.execute("SAVEPOINT offline_op")
        try:
            results.append(replay_op(conn, principal, data_dir, device_id, raw, rid, now))
            conn.execute("RELEASE SAVEPOINT offline_op")
        except ApiError as exc:
            conn.execute("ROLLBACK TO SAVEPOINT offline_op")
            conn.execute("RELEASE SAVEPOINT offline_op")
            results.append({"client_request_id": raw.get("client_request_id") if isinstance(raw, dict) else None, "outcome": "rejected", "reason": exc.code})
    # the ops above were accepted first, so an expired phone loses nothing when it is then told to lock / wipe
    return {"results": results, "device_action": device_action(conn, dev, now)}


# ---------------------------------------------------------------- manager review

def review_list(conn: sqlite3.Connection, limit: int = 100) -> list[dict[str, Any]]:
    rows = conn.execute("SELECT o.*, t.number AS ticket_number, t.title AS ticket_title FROM offline_ops o LEFT JOIN tickets t ON t.id = o.ticket_id "
                        "WHERE o.review_state = 'pending' ORDER BY o.received_at LIMIT ?", (limit,)).fetchall()
    out = []
    for r in rows:
        d = dict(r)
        d["payload"] = json.loads(d.pop("payload_json") or "{}")
        out.append(d)
    return out


def review_resolve(conn: sqlite3.Connection, principal: Principal, op_id: str, decision: str, note: str, rid: str | None) -> dict[str, Any]:
    row = conn.execute("SELECT * FROM offline_ops WHERE id = ?", (op_id,)).fetchone()
    if row is None:
        raise ApiError(404, "op_not_found", "הפריט לא נמצא.")
    if row["review_state"] != "pending":
        raise ApiError(409, "already_reviewed", "הפריט כבר טופל.")
    if decision not in ("approve", "dismiss"):
        raise ApiError(422, "invalid_decision", "החלטה לא ידועה.")
    if decision == "approve" and row["ticket_id"]:
        # approving never replays a status move: the manager acts on the request himself. The technician's entry is kept as a note on it.
        t = conn.execute("SELECT id FROM tickets WHERE id = ?", (row["ticket_id"],)).fetchone()
        if t is not None:
            payload = json.loads(row["payload_json"] or "{}")
            body = f"רישום טכנאי מעבודה בלי קליטה (אושר ע״י מנהל): {row['op_type']} {payload.get('to', '')} {payload.get('text', payload.get('note', ''))}".strip()[:model.NOTE_MAX]
            store.insert_event(conn, row["ticket_id"], "note", actor_kind="user", actor_user_id=principal.user_id, actor_name=principal.display_name or principal.username,
                               body=body, visible_external=False, at=now_iso())
    conn.execute("UPDATE offline_ops SET review_state = ?, reviewed_by = ?, reviewed_at = ?, review_note = ? WHERE id = ?",
                 ("approved" if decision == "approve" else "dismissed", principal.user_id, now_iso(), note[:500], op_id))
    audit(conn, actor=principal, action=f"offline.review.{decision}", decision="allowed", resource_type="offline_op", resource_id=op_id, request_id=rid,
          details={"op_type": row["op_type"]})
    return dict(conn.execute("SELECT id, review_state, reviewed_by, reviewed_at FROM offline_ops WHERE id = ?", (op_id,)).fetchone())


# ---------------------------------------------------------------- day list

def day_list(conn: sqlite3.Connection, principal: Principal, tz: str, now: dt.datetime | None = None) -> dict[str, Any]:
    now = _now(now)
    local = now.astimezone(ZoneInfo(tz))
    day = local.date().isoformat()
    end = _z(dt.datetime.combine(local.date() + dt.timedelta(days=1), dt.time.min, tzinfo=ZoneInfo(tz)))
    items = [t for t in _my_tickets(conn, principal.user_id, now, 1) if (t["eta_at"] or "") < end]
    ack = conn.execute("SELECT acked_at FROM offline_day_acks WHERE user_id = ? AND day = ?", (principal.user_id, day)).fetchone()
    return {"day": day, "read_only": True,
            "items": [{"id": t["id"], "number": t["number"], "title": t["title"], "status": t["status"], "eta_at": t["eta_at"], "place_text": t["place_text"]} for t in items],
            "ack_required": setting(conn, PREFIX + "day_list_ack") == "1", "acknowledged_at": ack["acked_at"] if ack else None}


def ack_day(conn: sqlite3.Connection, principal: Principal, device_id: str | None, tz: str, now: dt.datetime | None = None) -> dict[str, Any]:
    now = _now(now)
    day = now.astimezone(ZoneInfo(tz)).date().isoformat()
    conn.execute("INSERT INTO offline_day_acks(user_id, day, device_id, acked_at) VALUES (?, ?, ?, ?) ON CONFLICT(user_id, day) DO NOTHING",
                 (principal.user_id, day, device_id, _z(now)))
    row = conn.execute("SELECT acked_at FROM offline_day_acks WHERE user_id = ? AND day = ?", (principal.user_id, day)).fetchone()
    return {"day": day, "acknowledged_at": row["acked_at"]}


# ---------------------------------------------------------------- signed round-point tags

def _key_path(data_dir: Path) -> Path:
    return Path(data_dir) / "field_offline_tag.key"


def tag_key(data_dir: Path, *, create: bool = True) -> bytes | None:
    p = _key_path(data_dir)
    if p.exists():
        return p.read_bytes()
    if not create:
        return None
    p.parent.mkdir(parents=True, exist_ok=True)
    key = os.urandom(32)
    p.write_bytes(key)
    return key


def rotate_tag_key(data_dir: Path) -> None:
    """Invalidates every printed tag (a leaked key / a lost batch)."""
    p = _key_path(data_dir)
    p.parent.mkdir(parents=True, exist_ok=True)
    p.write_bytes(os.urandom(32))


def _mac(key: bytes, point_id: str) -> str:
    return base64.urlsafe_b64encode(hmac.new(key, f"SWRP1|{point_id}".encode(), hashlib.sha256).digest()[:16]).decode().rstrip("=")


def make_tag(data_dir: Path, point_id: str) -> str:
    return f"SWRP1.{point_id}.{_mac(tag_key(data_dir), point_id)}"


def verify_tag(conn: sqlite3.Connection, data_dir: Path, tag: str) -> dict[str, Any] | None:
    m = TAG_RE.match(tag or "")
    key = tag_key(data_dir, create=False)
    if not m or key is None:
        return None
    if not hmac.compare_digest(m.group(2), _mac(key, m.group(1))):
        return None
    row = conn.execute("SELECT * FROM offline_round_points WHERE id = ? AND enabled = 1", (m.group(1),)).fetchone()
    return dict(row) if row else None


def create_point(conn: sqlite3.Connection, principal: Principal, name: str, entity_id: str | None, place_text: str, rid: str | None) -> dict[str, Any]:
    pid = new_id()
    conn.execute("INSERT INTO offline_round_points(id, name, entity_id, place_text, enabled, created_at) VALUES (?, ?, ?, ?, 1, ?)",
                 (pid, name.strip()[:120], entity_id, place_text.strip()[:200], now_iso()))
    audit(conn, actor=principal, action="offline.round_point.create", decision="allowed", resource_type="offline_round_point", resource_id=pid, request_id=rid)
    return dict(conn.execute("SELECT * FROM offline_round_points WHERE id = ?", (pid,)).fetchone())
