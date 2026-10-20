"""CR-INFRA-TEMPERATURE 2.9.1: who receives the temperature alerts and on which channels.

Three notification sources (services/notify_policy.py): `temperature.alarm` (critical - an excursion longer than Z minutes, a door open longer
than X minutes), `temperature.warning` (alert - an excursion from its first moment) and `temperature.offline` (alert - the sensor does not
report). Per kind: on / off, recipients (roles, named users, groups) and channels (the inbox always; push, the phone app, e-mail and WhatsApp on
request - WhatsApp is the user's OWN opted-in number through the notification pipeline, never a new transport).

Unlike the elevators (off by default), a temperature unit exists to raise alerts: every kind starts ON and reaches the managers (site and
system administrators; alarms also the operators) until an administrator changes it. A unit may replace the recipients with its own list
(`infra_temp_units.recipients_json`, the wizard's "who receives"). The choices live in `infra_temp_alert_settings` (migration 0124) and are
MIRRORED onto the CR-018 policy of each source, recipients rule `temperature`, which services/notify.recipients_for resolves through
recipient_users() and then intersects with who may see the unit (subject kind `temperature`). Delivery, the pipeline's own quiet hours and the
delivery log stay with the pipeline. The temperature module's own quiet hours (warnings only) are applied before a warning is emitted.

Changing the routing needs system.configure (like the elevators)."""
from __future__ import annotations

import copy
import json
import sqlite3
from typing import Any

from ..audit import audit
from ..db import now_iso
from . import notify_policy

SOURCE_PREFIX = "temperature."
KINDS: tuple[str, ...] = ("alarm", "warning", "offline")
ROUTABLE_ROLES: tuple[str, ...] = ("viewer", "operator", "site_admin", "system_admin")
ROLE_LABELS: dict[str, str] = {"viewer": "צופים", "operator": "מפעילים", "site_admin": "מנהלי אתר", "system_admin": "מנהלי מערכת"}
CHANNELS: tuple[str, ...] = ("push", "app", "email", "whatsapp")
USERS_MAX, GROUPS_MAX = 100, 20
DEFAULTS: dict[str, dict[str, Any]] = {
    "alarm": {"enabled": True, "recipients": {"roles": ["operator", "site_admin", "system_admin"], "users": [], "groups": []}, "channels": ["push", "app"]},
    "warning": {"enabled": True, "recipients": {"roles": ["site_admin", "system_admin"], "users": [], "groups": []}, "channels": ["push"]},
    "offline": {"enabled": True, "recipients": {"roles": ["site_admin", "system_admin"], "users": [], "groups": []}, "channels": []},
}


class AlertsInvalid(ValueError):
    def __init__(self, code: str, message: str, message_en: str, details: dict[str, Any] | None = None) -> None:
        super().__init__(code)
        self.code, self.message, self.message_en, self.details = code, message, message_en, details or {}


def default_settings() -> dict[str, Any]:
    return {"kinds": copy.deepcopy(DEFAULTS), "row_version": 0}


def load(conn: sqlite3.Connection) -> dict[str, Any]:
    out = default_settings()
    try:
        r = conn.execute("SELECT * FROM infra_temp_alert_settings WHERE id = 1").fetchone()
    except sqlite3.Error:
        return out
    if r is None:
        return out
    try:
        kinds = json.loads(r["kinds_json"] or "{}")
    except ValueError:
        kinds = {}
    for k in KINDS:
        s = kinds.get(k) if isinstance(kinds, dict) else None
        if isinstance(s, dict):
            rec = s.get("recipients") if isinstance(s.get("recipients"), dict) else {}
            out["kinds"][k] = {"enabled": s.get("enabled") is True,
                               "recipients": {x: [y for y in (rec.get(x) or []) if isinstance(y, str)] for x in ("roles", "users", "groups")},
                               "channels": [c for c in CHANNELS if c in (s.get("channels") or [])]}
    out["row_version"] = r["row_version"]
    return out


def view(conn: sqlite3.Connection) -> dict[str, Any]:
    return {**load(conn), "roles": [{"id": r, "label": ROLE_LABELS[r]} for r in ROUTABLE_ROLES], "channels": list(CHANNELS), "kinds_order": list(KINDS)}


def validate_recipients(conn: sqlite3.Connection, rec: Any, field: str) -> dict[str, list[str]]:
    if not isinstance(rec, dict) or set(rec) - {"roles", "users", "groups"}:
        raise AlertsInvalid("validation", "נמענים לא תקינים.", "Invalid recipients.", {"fields": [field]})
    roles, users, grps = rec.get("roles") or [], rec.get("users") or [], rec.get("groups") or []
    if not all(isinstance(x, list) for x in (roles, users, grps)) or len(users) > USERS_MAX or len(grps) > GROUPS_MAX or len(roles) > len(ROUTABLE_ROLES):
        raise AlertsInvalid("validation", "נמענים לא תקינים.", "Invalid recipients.", {"fields": [field]})
    if any(r not in ROUTABLE_ROLES for r in roles):
        raise AlertsInvalid("recipient_role", "תפקיד שלא יכול לקבל התראות טמפרטורה.", "This role cannot receive temperature alerts.", {"fields": [f"{field}.roles"]})
    active = {r[0] for r in conn.execute("SELECT id FROM users WHERE active = 1").fetchall()}
    if any(u not in active for u in users):
        raise AlertsInvalid("recipient_user", "משתמש לא מוכר.", "Unknown user.", {"fields": [f"{field}.users"]})
    groups = {r[0] for r in conn.execute("SELECT id FROM groups").fetchall()}
    if any(g not in groups for g in grps):
        raise AlertsInvalid("recipient_group", "קבוצה לא מוכרת.", "Unknown group.", {"fields": [f"{field}.groups"]})
    return {"roles": [r for r in ROUTABLE_ROLES if r in roles], "users": sorted(set(users)), "groups": sorted(set(grps))}


def _validate(conn: sqlite3.Connection, body: dict[str, Any], cur: dict[str, Any]) -> dict[str, Any]:
    out = copy.deepcopy(cur)
    kinds = body.get("kinds")
    if kinds is None:
        return out
    if not isinstance(kinds, dict) or any(k not in KINDS for k in kinds):
        raise AlertsInvalid("validation", "סוג התראה לא מוכר.", "Unknown alert kind.", {"fields": ["kinds"]})
    for k, s in kinds.items():
        if not isinstance(s, dict) or set(s) - {"enabled", "recipients", "channels"}:
            raise AlertsInvalid("validation", "מבנה לא תקין.", "Invalid structure.", {"fields": [f"kinds.{k}"]})
        st = out["kinds"][k]
        if "enabled" in s:
            if not isinstance(s["enabled"], bool):
                raise AlertsInvalid("validation", "הערך חייב להיות כן או לא.", "The value must be true or false.", {"fields": [f"kinds.{k}.enabled"]})
            st["enabled"] = s["enabled"]
        if "recipients" in s:
            st["recipients"] = validate_recipients(conn, s["recipients"], f"kinds.{k}.recipients")
        if "channels" in s:
            ch = s["channels"]
            if not isinstance(ch, list) or any(c not in CHANNELS for c in ch):
                raise AlertsInvalid("channel", "ערוץ לא זמין.", "This channel is not available.", {"fields": [f"kinds.{k}.channels"]})
            st["channels"] = [c for c in CHANNELS if c in ch]
    return out


def _bridge(conn: sqlite3.Connection, settings: dict[str, Any]) -> None:
    for k in KINDS:
        src = SOURCE_PREFIX + k
        st = settings["kinds"][k]
        base = notify_policy.default_row(notify_policy.BY_KEY[src])
        ch = {"inbox": True, "webpush": "push" in st["channels"], "email": "email" in st["channels"], "app": "app" in st["channels"], "announce": False,
              "ha_mobile": False, "whatsapp": "whatsapp" in st["channels"]}
        conn.execute(
            """INSERT INTO notify_policies(source, enabled, severity, category, after_s, dedupe_window_s, resolve_notice, recipients_json, channels_json, revision, updated_at)
               VALUES (?,?,?,?,?,?,?,?,?,1,?)
               ON CONFLICT(source) DO UPDATE SET enabled = excluded.enabled, recipients_json = excluded.recipients_json, channels_json = excluded.channels_json,
                 revision = revision + 1, updated_at = excluded.updated_at""",
            (src, int(st["enabled"]), base["severity"], base["category"], base["after_s"], base["dedupe_window_s"], int(base["resolve_notice"]),
             json.dumps({"rule": "temperature"}), json.dumps(ch), now_iso()))


def save(conn: sqlite3.Connection, principal: Any, body: dict[str, Any]) -> dict[str, Any]:
    cur = load(conn)
    if body.get("row_version") is not None and body["row_version"] != cur["row_version"]:
        raise AlertsInvalid("revision_conflict", "ההגדרות השתנו בינתיים.", "The settings were changed meanwhile.", {"row_version": cur["row_version"]})
    new = _validate(conn, body, cur)
    conn.execute(
        """INSERT INTO infra_temp_alert_settings(id, kinds_json, row_version, updated_by, updated_at) VALUES (1, ?, 1, ?, ?)
           ON CONFLICT(id) DO UPDATE SET kinds_json = excluded.kinds_json, row_version = row_version + 1, updated_by = excluded.updated_by, updated_at = excluded.updated_at""",
        (json.dumps(new["kinds"], ensure_ascii=False), principal.user_id, now_iso()))
    _bridge(conn, new)
    audit(conn, actor=principal, action="infra.temperature.alerts.update", decision="allowed", resource_type="infra_temperature_alerts", resource_id="settings",
          details={"on": [k for k in KINDS if new["kinds"][k]["enabled"]]})
    return view(conn)


def _expand(conn: sqlite3.Connection, rec: dict[str, list[str]]) -> list[str]:
    out: list[str] = list(rec.get("users") or [])
    grps = rec.get("groups") or []
    if grps:
        marks = ",".join("?" * len(grps))
        out += [r[0] for r in conn.execute(f"SELECT user_id FROM group_members WHERE group_id IN ({marks})", grps).fetchall()]
    roles = [r for r in (rec.get("roles") or []) if r in ROUTABLE_ROLES]
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


def recipient_users(conn: sqlite3.Connection, n: dict[str, Any]) -> list[str]:
    """The `temperature` recipient rule: the unit's own list when it has one, else the installation's recipients of the notification's kind -
    only while that kind is on. The caller intersects the result with who may see the unit."""
    source = str(n.get("source") or "")
    kind = source[len(SOURCE_PREFIX):] if source.startswith(SOURCE_PREFIX) else ""
    s = load(conn)
    if kind not in KINDS or not s["kinds"][kind]["enabled"]:
        return []
    rec = s["kinds"][kind]["recipients"]
    try:
        u = conn.execute("SELECT recipients_json FROM infra_temp_units WHERE id = ?", (n.get("subject_id"),)).fetchone()
    except sqlite3.Error:
        u = None
    if u is not None and u["recipients_json"]:
        try:
            own = json.loads(u["recipients_json"])
            if isinstance(own, dict):
                rec = {k: [x for x in (own.get(k) or []) if isinstance(x, str)] for k in ("roles", "users", "groups")}
        except ValueError:
            pass
    return _expand(conn, rec)
