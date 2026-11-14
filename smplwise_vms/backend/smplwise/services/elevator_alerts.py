"""CR-INFRA-ELEVATORS 2.8.0: the elevator alert settings - master switch, per-state switches, recipients and channels (owner decision 2026-10-18).

Owner decision: elevator alerts never start by themselves. Everything defaults OFF; recipients are chosen now (roles, named users, groups -
nothing selected = nobody is notified); per state the channels the notification pipeline already offers for a module (the inbox always;
push, the phone app and - GENELEV-295, owner brief 2026-10-24 - WhatsApp on request; e-mail is NOT offered for elevators). WhatsApp is an external, budget-limited
channel shared with the tickets module: it is off by default, and adding it or changing who it reaches also needs notify.manage (as for the generator).
Changing the settings needs system.configure.

This reuses the generator's routing pattern (services/generator_alerts.py): the choices live in their own table
(`infra_elevator_alert_settings`, migration 0119) and are MIRRORED onto the CR-018 policy of each source (`elevator.<state>`): enabled =
master AND state, channels from the choice, recipients rule `elevator` - which services/notify.recipients_for resolves through
`recipient_users` (roles against the current bindings, direct and through groups; named users; group members), and then intersects with who
may see the elevator (subject kind `elevator`). Delivery, quiet hours and the delivery log stay with the pipeline.

Rules (documented in docs/changes/CR-INFRA-ELEVATORS.md section 9.4):
* Off -> no notification is raised (the evaluator still records history and still tracks which conditions hold).
* Turning a state on (master or per state) notifies only NEW transitions: a condition that already held keeps its memory row without a
  notification and is never notified retroactively.
* Turning a state off closes its open elevator notifications at once, with the resolution `alerts_disabled` and the visible text
  "התראות המעליות כובו" - never silently. The conditions stay tracked; turning it on again does not re-notify them."""
from __future__ import annotations

import copy
import json
import sqlite3
from typing import Any

from ..audit import audit
from ..db import now_iso
from . import elevators as el
from . import notify, notify_policy

SOURCE_PREFIX = "elevator."
# the roles that may receive elevator alerts: the holders of devices.read (a kiosk is a screen, not a person)
ROUTABLE_ROLES: tuple[str, ...] = ("viewer", "operator", "site_admin", "system_admin")
ROLE_LABELS: dict[str, str] = {"viewer": "צופים", "operator": "מפעילים", "site_admin": "מנהלי אתר", "system_admin": "מנהלי מערכת"}
CHANNELS: tuple[str, ...] = ("push", "app", "whatsapp")  # the inbox is always on; e-mail is not offered for elevators; whatsapp needs notify.manage to add (GENELEV-295)
USERS_MAX, GROUPS_MAX = 100, 20
DISABLED_TEXT = "התראות המעליות כובו"


class AlertsInvalid(ValueError):
    def __init__(self, code: str, message: str, message_en: str, details: dict[str, Any] | None = None) -> None:
        super().__init__(code)
        self.code, self.message, self.message_en, self.details = code, message, message_en, details or {}


def _empty_state() -> dict[str, Any]:
    return {"enabled": False, "recipients": {"roles": [], "users": [], "groups": []}, "channels": []}


def default_settings() -> dict[str, Any]:
    return {"enabled": False, "states": {r: _empty_state() for r in el.ALERT_ROLES}, "row_version": 0}


def load(conn: sqlite3.Connection) -> dict[str, Any]:
    """The stored settings in canonical form (the defaults - everything off, nobody - without a row or before the migration)."""
    try:
        r = conn.execute("SELECT * FROM infra_elevator_alert_settings WHERE id = 1").fetchone()
    except sqlite3.Error:
        return default_settings()
    out = default_settings()
    if r is None:
        return out
    try:
        states = json.loads(r["states_json"] or "{}")
    except ValueError:
        states = {}
    for role in el.ALERT_ROLES:
        s = states.get(role) if isinstance(states, dict) else None
        if isinstance(s, dict):
            rec = s.get("recipients") if isinstance(s.get("recipients"), dict) else {}
            out["states"][role] = {"enabled": s.get("enabled") is True,
                                   "recipients": {k: [x for x in (rec.get(k) or []) if isinstance(x, str)] for k in ("roles", "users", "groups")},
                                   "channels": [c for c in CHANNELS if c in (s.get("channels") or [])]}
    out["enabled"] = bool(r["enabled"])
    out["row_version"] = r["row_version"]
    return out


def is_on(settings: dict[str, Any], role: str) -> bool:
    """A state notifies only while the master switch AND its own switch are on."""
    return bool(settings["enabled"] and settings["states"].get(role, {}).get("enabled"))


def view(conn: sqlite3.Connection) -> dict[str, Any]:
    """GET payload: the settings plus what may be chosen (routable roles with labels, channels)."""
    return {**load(conn), "roles": [{"id": r, "label": ROLE_LABELS[r]} for r in ROUTABLE_ROLES], "channels": list(CHANNELS), "states_order": list(el.ALERT_ROLES)}


def _validate(conn: sqlite3.Connection, body: dict[str, Any], cur: dict[str, Any]) -> dict[str, Any]:
    out = copy.deepcopy(cur)
    if "enabled" in body:
        if not isinstance(body["enabled"], bool):
            raise AlertsInvalid("validation", "הערך חייב להיות כן או לא.", "The value must be true or false.", {"fields": ["enabled"]})
        out["enabled"] = body["enabled"]
    states = body.get("states")
    if states is None:
        return out
    if not isinstance(states, dict):
        raise AlertsInvalid("validation", "מבנה לא תקין.", "Invalid structure.", {"fields": ["states"]})
    unknown = [k for k in states if k not in el.ALERT_ROLES]
    if unknown:
        raise AlertsInvalid("validation", "מצב לא מוכר.", "Unknown state.", {"fields": [f"states.{k}" for k in unknown]})
    active_users = {r[0] for r in conn.execute("SELECT id FROM users WHERE active = 1").fetchall()}
    groups = {r[0] for r in conn.execute("SELECT id FROM groups").fetchall()}
    for role, s in states.items():
        if not isinstance(s, dict) or set(s) - {"enabled", "recipients", "channels"}:
            raise AlertsInvalid("validation", "מבנה לא תקין.", "Invalid structure.", {"fields": [f"states.{role}"]})
        st = out["states"][role]
        if "enabled" in s:
            if not isinstance(s["enabled"], bool):
                raise AlertsInvalid("validation", "הערך חייב להיות כן או לא.", "The value must be true or false.", {"fields": [f"states.{role}.enabled"]})
            st["enabled"] = s["enabled"]
        if "recipients" in s:
            rec = s["recipients"]
            if not isinstance(rec, dict) or set(rec) - {"roles", "users", "groups"}:
                raise AlertsInvalid("validation", "נמענים לא תקינים.", "Invalid recipients.", {"fields": [f"states.{role}.recipients"]})
            roles, users, grps = rec.get("roles") or [], rec.get("users") or [], rec.get("groups") or []
            if not all(isinstance(x, list) for x in (roles, users, grps)) or len(users) > USERS_MAX or len(grps) > GROUPS_MAX or len(roles) > len(ROUTABLE_ROLES):
                raise AlertsInvalid("validation", "נמענים לא תקינים.", "Invalid recipients.", {"fields": [f"states.{role}.recipients"]})
            if any(r not in ROUTABLE_ROLES for r in roles):
                raise AlertsInvalid("recipient_role", "תפקיד שלא יכול לקבל התראות מעליות.", "This role cannot receive elevator alerts.", {"fields": [f"states.{role}.recipients.roles"]})
            if any(u not in active_users for u in users):
                raise AlertsInvalid("recipient_user", "משתמש לא מוכר.", "Unknown user.", {"fields": [f"states.{role}.recipients.users"]})
            if any(g not in groups for g in grps):
                raise AlertsInvalid("recipient_group", "קבוצה לא מוכרת.", "Unknown group.", {"fields": [f"states.{role}.recipients.groups"]})
            st["recipients"] = {"roles": [r for r in ROUTABLE_ROLES if r in roles], "users": sorted(set(users)), "groups": sorted(set(grps))}
        if "channels" in s:
            ch = s["channels"]
            if not isinstance(ch, list) or any(c not in CHANNELS for c in ch):
                raise AlertsInvalid("channel", "ערוץ שלא זמין להתראות מעליות.", "This channel is not available for elevator alerts.", {"fields": [f"states.{role}.channels"]})
            st["channels"] = [c for c in CHANNELS if c in ch]
    return out


def _bridge(conn: sqlite3.Connection, settings: dict[str, Any]) -> None:
    """Mirror each state onto its CR-018 source policy, in the same transaction (enabled = master AND state; rule `elevator`)."""
    for role in el.ALERT_ROLES:
        src = SOURCE_PREFIX + role
        st = settings["states"][role]
        base = notify_policy.default_row(notify_policy.BY_KEY[src])
        ch = {"inbox": True, "webpush": "push" in st["channels"], "email": False, "app": "app" in st["channels"], "announce": False, "ha_mobile": False, "whatsapp": "whatsapp" in st["channels"]}
        conn.execute(
            """INSERT INTO notify_policies(source, enabled, severity, category, after_s, dedupe_window_s, resolve_notice, recipients_json, channels_json, revision, updated_at)
               VALUES (?,?,?,?,?,?,?,?,?,1,?)
               ON CONFLICT(source) DO UPDATE SET enabled = excluded.enabled, recipients_json = excluded.recipients_json, channels_json = excluded.channels_json,
                 revision = revision + 1, updated_at = excluded.updated_at""",
            (src, int(is_on(settings, role)), base["severity"], base["category"], base["after_s"], base["dedupe_window_s"], int(base["resolve_notice"]),
             json.dumps({"rule": "elevator"}), json.dumps(ch), now_iso()))


def whatsapp_change(cur: dict[str, Any], body: dict[str, Any]) -> bool:
    """True when the save would add WhatsApp to a state, or change who / whether WhatsApp reaches on a state that carries it after the save (its
    switch, its recipients, or the master switch). Such a save also needs notify.manage; other edits, and removing WhatsApp, do not. `body` is the raw PUT body."""
    master_changed = "enabled" in body and body["enabled"] != cur["enabled"]
    states = body.get("states") if isinstance(body.get("states"), dict) else {}
    for role in el.ALERT_ROLES:
        before = cur["states"][role]
        s = states.get(role) if isinstance(states.get(role), dict) else {}
        channels = s["channels"] if isinstance(s.get("channels"), list) else before["channels"]
        if "whatsapp" not in channels:
            continue
        if "whatsapp" not in before["channels"] or master_changed:
            return True
        if "enabled" in s and s["enabled"] != before["enabled"]:
            return True
        rec = s.get("recipients")
        if isinstance(rec, dict):
            for k in ("roles", "users", "groups"):
                if k in rec and sorted(x for x in rec[k] if isinstance(x, str)) != sorted(before["recipients"][k]):
                    return True
    return False


def close_open(conn: sqlite3.Connection, roles: list[str]) -> int:
    """Turning alerts off for `roles`: their open elevator notifications are resolved (resolution `alerts_disabled`, visible text), and the
    memory rows forget the notification (the condition stays tracked, so turning on again never re-notifies it). Returns how many closed."""
    if not roles:
        return 0
    marks = ",".join("?" * len(roles))
    rows = conn.execute(
        f"""SELECT a.elevator_id, a.role, a.notification_id, e.name, e.area_id FROM infra_elevator_alerts a JOIN infra_elevators e ON e.id = a.elevator_id
            WHERE a.notification_id IS NOT NULL AND a.role IN ({marks})""", roles).fetchall()
    n = 0
    for r in rows:
        res = notify.emit_full(conn, notify.Signal(SOURCE_PREFIX + r["role"], "elevator", r["elevator_id"], dedupe_key=f"{SOURCE_PREFIX}{r['role']}:{r['elevator_id']}", resolve=True,
                                                   params={"name": r["name"], "resolution": "alerts_disabled", "resolve_text": DISABLED_TEXT}, origin={"elevator_id": r["elevator_id"]}))
        n += res.action == "resolved"
        conn.execute("UPDATE infra_elevator_alerts SET notification_id = NULL WHERE elevator_id = ? AND role = ?", (r["elevator_id"], r["role"]))
    return n


def save(conn: sqlite3.Connection, principal: Any, body: dict[str, Any]) -> dict[str, Any]:
    cur = load(conn)
    if body.get("row_version") is not None and body["row_version"] != cur["row_version"]:
        raise AlertsInvalid("revision_conflict", "ההגדרות השתנו בינתיים.", "The settings were changed meanwhile.", {"row_version": cur["row_version"]})
    new = _validate(conn, body, cur)
    turned_off = [r for r in el.ALERT_ROLES if is_on(cur, r) and not is_on(new, r)]
    conn.execute(
        """INSERT INTO infra_elevator_alert_settings(id, enabled, states_json, row_version, updated_by, updated_at) VALUES (1, ?, ?, 1, ?, ?)
           ON CONFLICT(id) DO UPDATE SET enabled = excluded.enabled, states_json = excluded.states_json, row_version = row_version + 1,
             updated_by = excluded.updated_by, updated_at = excluded.updated_at""",
        (int(new["enabled"]), json.dumps(new["states"], ensure_ascii=False), principal.user_id, now_iso()))
    _bridge(conn, new)
    closed = close_open(conn, turned_off)
    audit(conn, actor=principal, action="infra.elevator.alerts.update", decision="allowed", resource_type="infra_elevator_alerts", resource_id="settings",
          details={"enabled": new["enabled"], "states_on": [r for r in el.ALERT_ROLES if is_on(new, r)], "closed": closed,
                    "channels": {r: new["states"][r]["channels"] for r in el.ALERT_ROLES},
                    "recipient_counts": {r: {k: len(v) for k, v in new["states"][r]["recipients"].items()} for r in el.ALERT_ROLES}})
    return view(conn)


def recipient_users(conn: sqlite3.Connection, n: dict[str, Any]) -> list[str]:
    """The `elevator` recipient rule of services/notify.recipients_for: the saved recipients of the notification's state, only while that state is
    on. Roles resolve against the CURRENT bindings (direct, and through a group the user is in); groups to their members; plus the named users.
    The caller intersects the result with who may see the elevator. Nothing selected = nobody."""
    source = str(n.get("source") or "")
    role = source[len(SOURCE_PREFIX):] if source.startswith(SOURCE_PREFIX) else ""
    s = load(conn)
    if role not in el.ALERT_ROLES or not is_on(s, role):
        return []
    rec = s["states"][role]["recipients"]
    out: list[str] = list(rec["users"])
    if rec["groups"]:
        marks = ",".join("?" * len(rec["groups"]))
        out += [r[0] for r in conn.execute(f"SELECT user_id FROM group_members WHERE group_id IN ({marks})", rec["groups"]).fetchall()]
    roles = [r for r in rec["roles"] if r in ROUTABLE_ROLES]
    if roles:
        marks = ",".join("?" * len(roles))
        now = now_iso()
        out += [r[0] for r in conn.execute(
            f"""SELECT DISTINCT b.subject_id FROM bindings b WHERE b.subject_kind = 'user' AND b.role_id IN ({marks})
                AND b.revoked_at IS NULL AND b.effect = 'allow' AND (b.expires_at IS NULL OR b.expires_at > ?)""", (*roles, now)).fetchall()]
        out += [r[0] for r in conn.execute(
            f"""SELECT DISTINCT m.user_id FROM bindings b JOIN group_members m ON m.group_id = b.subject_id WHERE b.subject_kind = 'group' AND b.role_id IN ({marks})
                AND b.revoked_at IS NULL AND b.effect = 'allow' AND (b.expires_at IS NULL OR b.expires_at > ?)""", (*roles, now)).fetchall()]
    active = {r[0] for r in conn.execute("SELECT id FROM users WHERE active = 1").fetchall()}
    return [u for u in dict.fromkeys(out) if u in active]
