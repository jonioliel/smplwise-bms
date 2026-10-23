"""CR-WATER78 slice 2: the leak rules' installation defaults, the per-meter overrides and the alert routing (migration 0152, built as provisional 0153,
`water_alert_settings`, one row; overrides in `water_meters.rules_json`).

Owner decisions 2026-10-23: alerts ON by default once the module is on (Q3); the night window 01:00-05:00 with 6 L/h over two hours (eight
consecutive 15-minute buckets, Q8); the night rule OFF by default for irrigation meters (Q9; abnormal and burst stay on); no actuation,
ever (Q6). Every number is a setting with an installation default and a per-meter override.

Three notification sources (services/notify_policy.py): `water.leak` (night flow and burst; a night-flow WARNING is sent at severity
`alert`, an ALARM - a burst, or flow through the whole night window - at `critical`), `water.abnormal` (alert) and `water.offline` (alert,
inbox). Per kind: on / off, recipients (roles, named users, groups) and channels; the choices are MIRRORED onto the CR-018 policy of each
source with the recipients rule `water`, which services/notify.recipients_for resolves through recipient_users() and then intersects with
who may see the meter (subject kind `water`: water.view, floor-scoped). The pipeline's own quiet hours, severity pass-through and
delivery stay the pipeline's; the module's own quiet hours and mute hold WARNINGS only (services/water_runtime.holds).

Reading the rules needs water.manage; changing the installation defaults and the routing needs system.configure (the elevators' and the
temperature module's rule)."""
from __future__ import annotations

import copy
import json
import re
import sqlite3
from decimal import Decimal, InvalidOperation
from typing import Any

from ..db import now_iso
from . import notify_policy

KINDS: tuple[str, ...] = ("leak", "abnormal", "offline")
SOURCE = {"leak": "water.leak", "abnormal": "water.abnormal", "offline": "water.offline"}
EVENT_KIND_TO_ROUTE = {"night_flow": "leak", "burst": "leak", "abnormal": "abnormal", "offline": "offline"}
ROUTABLE_ROLES: tuple[str, ...] = ("viewer", "operator", "site_admin", "system_admin")
ROLE_LABELS: dict[str, str] = {"viewer": "צופים", "operator": "מפעילים", "site_admin": "מנהלי אתר", "system_admin": "מנהלי מערכת"}
CHANNELS: tuple[str, ...] = ("push", "app", "email", "whatsapp")
USERS_MAX, GROUPS_MAX = 100, 20
# CR section 9: a leak reaches the operators and the site / system administrators; the rest the administrators
ROUTING_DEFAULTS: dict[str, dict[str, Any]] = {
    "leak": {"enabled": True, "recipients": {"roles": ["operator", "site_admin", "system_admin"], "users": [], "groups": []}, "channels": ["push", "app"]},
    "abnormal": {"enabled": True, "recipients": {"roles": ["site_admin", "system_admin"], "users": [], "groups": []}, "channels": ["push"]},
    "offline": {"enabled": True, "recipients": {"roles": ["site_admin", "system_admin"], "users": [], "groups": []}, "channels": []},
}

# the installation defaults (column -> (kind, min, max)); 'hhmm' is a local "HH:MM"
RULE_COLUMNS: dict[str, tuple[str, float | None, float | None]] = {
    "night_from": ("hhmm", None, None), "night_to": ("hhmm", None, None),
    "night_min_lph": ("float", 0.5, 10_000), "night_min_intervals": ("int", 1, 96),
    "abnormal_factor": ("decimal", 1.1, 20), "abnormal_min_l": ("int", 0, 10_000_000), "baseline_days": ("int", 7, 90),
    "offline_min": ("int", 15, 10_080),
    "alerts_enabled": ("bool", None, None), "quiet_enabled": ("bool", None, None), "quiet_from": ("hhmm", None, None), "quiet_to": ("hhmm", None, None),
    "quiet_includes_alarms": ("bool", None, None), "mute_includes_alarms": ("bool", None, None),
}
RULE_DEFAULTS: dict[str, Any] = {
    "night_from": "01:00", "night_to": "05:00", "night_min_lph": 6.0, "night_min_intervals": 8, "abnormal_factor": "2.0", "abnormal_min_l": 500,
    "baseline_days": 28, "offline_min": 120, "alerts_enabled": True, "quiet_enabled": False, "quiet_from": "22:00", "quiet_to": "07:00",
    "quiet_includes_alarms": False, "mute_includes_alarms": False,
}
# per-meter overrides (water_meters.rules_json): the rule switches and the thresholds; the window, quiet hours and holds stay installation-wide
OVERRIDE_KEYS: dict[str, tuple[str, float | None, float | None]] = {
    "night_rule": ("bool", None, None), "abnormal_rule": ("bool", None, None), "burst_rule": ("bool", None, None), "offline_rule": ("bool", None, None),
    "night_min_lph": RULE_COLUMNS["night_min_lph"], "night_min_intervals": RULE_COLUMNS["night_min_intervals"],
    "abnormal_factor": RULE_COLUMNS["abnormal_factor"], "abnormal_min_l": RULE_COLUMNS["abnormal_min_l"],
    "burst_lph": ("float", 1, 1_000_000), "offline_min": RULE_COLUMNS["offline_min"],
}
MUTE_MINUTES = (15, 30, 60, 120)
# CR-WATER78 section 16 (owner review 24.10): the alert snooze ("נדנוד") - the offered durations (editable list), the main button's default
# and the maximum, stored in water_alert_settings (0154) with one revision with the routing. Initial set 15 min, 1 hour, 4 hours, 1 day;
# default 1 hour; maximum 7 days (a proposal the owner may change in Settings).
SNOOZE_DEFAULTS: dict[str, Any] = {"durations": [15, 60, 240, 1440], "default": 60, "max": 10080}
SNOOZE_LIMITS = {"min": 5, "max": 43200, "count": 12}  # 5 minutes .. 30 days, at most 12 offered durations
_HHMM = re.compile(r"^([01]\d|2[0-3]):([0-5]\d)$")


class AlertsInvalid(ValueError):
    def __init__(self, code: str, message: str, message_en: str, details: dict[str, Any] | None = None) -> None:
        super().__init__(code)
        self.code, self.message, self.message_en, self.details = code, message, message_en, details or {}


def minutes_of(hhmm: str) -> int:
    h, m = str(hhmm).split(":", 1)
    return int(h) * 60 + int(m)


def _bad(field: str) -> AlertsInvalid:
    return AlertsInvalid("validation", f"ערך לא תקין: {field}", f"Invalid value: {field}", {"fields": [field]})


def check_value(field: str, spec: tuple[str, float | None, float | None], raw: Any) -> Any:
    kind, lo, hi = spec
    if kind == "bool":
        if not isinstance(raw, bool):
            raise _bad(field)
        return raw
    if kind == "hhmm":
        if not isinstance(raw, str) or not _HHMM.match(raw):
            raise _bad(field)
        return raw
    if isinstance(raw, bool):
        raise _bad(field)
    if kind == "int":
        if not isinstance(raw, int):
            raise _bad(field)
        v: Any = raw
    elif kind == "decimal":
        try:
            d = Decimal(str(raw))
        except InvalidOperation:
            raise _bad(field) from None
        if not d.is_finite():
            raise _bad(field)
        if (lo is not None and d < Decimal(str(lo))) or (hi is not None and d > Decimal(str(hi))):
            raise _bad(field)
        return str(d)
    else:
        if not isinstance(raw, (int, float)) or raw != raw:
            raise _bad(field)
        v = float(raw)
    if (lo is not None and v < lo) or (hi is not None and v > hi):
        raise _bad(field)
    return v


# ---------------------------------------------------------------- load

def _row(conn: sqlite3.Connection) -> sqlite3.Row | None:
    try:
        return conn.execute("SELECT * FROM water_alert_settings WHERE id = 1").fetchone()
    except sqlite3.Error:
        return None


def _rec_of(rec: Any) -> dict[str, list[str]]:
    rec = rec if isinstance(rec, dict) else {}
    return {x: [y for y in (rec.get(x) or []) if isinstance(y, str)] for x in ("roles", "users", "groups")}


def load(conn: sqlite3.Connection) -> dict[str, Any]:
    """{rules: the installation defaults, kinds: the routing, row_version}. Tolerant: a missing row or column is the default."""
    rules = dict(RULE_DEFAULTS)
    kinds = copy.deepcopy(ROUTING_DEFAULTS)
    version = 0
    r = _row(conn)
    if r is not None:
        keys = r.keys()
        for col, (kind, _lo, _hi) in RULE_COLUMNS.items():
            if col in keys and r[col] is not None:
                v = r[col]
                rules[col] = bool(v) if kind == "bool" else int(v) if kind == "int" else float(v) if kind == "float" else str(v)
        try:
            stored = json.loads(r["kinds_json"] or "{}")
        except ValueError:
            stored = {}
        for k in KINDS:
            s = stored.get(k) if isinstance(stored, dict) else None
            if isinstance(s, dict):
                kinds[k] = {"enabled": s.get("enabled") is True, "recipients": _rec_of(s.get("recipients")),
                            "channels": [c for c in CHANNELS if c in (s.get("channels") or [])]}
        version = int(r["row_version"] or 0)
    return {"rules": rules, "kinds": kinds, "snooze": snooze_of(r), "row_version": version}


def snooze_of(r: Any) -> dict[str, Any]:
    """The snooze settings of the row (tolerant: before 0154, or an unreadable value, the defaults)."""
    out = copy.deepcopy(SNOOZE_DEFAULTS)
    if r is None or "snooze_minutes_json" not in r.keys():
        return out
    try:
        durations = json.loads(r["snooze_minutes_json"] or "[]")
        out["durations"] = sorted({int(x) for x in durations if isinstance(x, int) and not isinstance(x, bool)}) or out["durations"]
    except (ValueError, TypeError):
        pass
    out["default"] = int(r["snooze_default_min"] or out["default"])
    out["max"] = int(r["snooze_max_min"] or out["max"])
    return out


def validate_snooze(raw: Any, cur: dict[str, Any]) -> dict[str, Any]:
    """{durations: [minutes...], default: minutes, max: minutes}: every duration 5 min .. max, at most 12, the default one of them,
    the maximum 5 min .. 30 days."""
    if not isinstance(raw, dict) or set(raw) - {"durations", "default", "max"}:
        raise AlertsInvalid("validation", "הגדרות הנדנוד אינן תקינות.", "The snooze settings are invalid.", {"fields": ["snooze"]})
    out = copy.deepcopy(cur)
    for k in ("default", "max"):
        if k in raw:
            v = raw[k]
            if not isinstance(v, int) or isinstance(v, bool) or not SNOOZE_LIMITS["min"] <= v <= SNOOZE_LIMITS["max"]:
                raise _bad(f"snooze.{k}")
            out[k] = v
    if "durations" in raw:
        d = raw["durations"]
        if not isinstance(d, list) or not 1 <= len(d) <= SNOOZE_LIMITS["count"] or any(not isinstance(x, int) or isinstance(x, bool) for x in d):
            raise _bad("snooze.durations")
        out["durations"] = sorted(set(d))
    if any(not SNOOZE_LIMITS["min"] <= x <= out["max"] for x in out["durations"]):
        raise AlertsInvalid("snooze_over_max", "משך נדנוד ארוך מהמקסימום.", "A snooze duration is longer than the maximum.", {"fields": ["snooze.durations"]})
    if out["default"] not in out["durations"]:
        raise AlertsInvalid("snooze_default", "ברירת המחדל חייבת להיות אחד מהמשכים המוצעים.", "The default must be one of the offered durations.",
                            {"fields": ["snooze.default"]})
    return out


def overrides_of(raw: Any) -> dict[str, Any]:
    """The meter's own overrides (only known keys of the right type; an unreadable value is ignored)."""
    try:
        d = json.loads(raw) if isinstance(raw, str) and raw else (raw or {})
    except ValueError:
        return {}
    if not isinstance(d, dict):
        return {}
    out: dict[str, Any] = {}
    for k, spec in OVERRIDE_KEYS.items():
        if k in d and d[k] is not None:
            try:
                out[k] = check_value(k, spec, d[k])
            except AlertsInvalid:
                continue
    return out


def validate_overrides(raw: Any) -> dict[str, Any] | None:
    """The PATCH body's `rules` (water.manage): None / {} clears; unknown keys and bad values are refused (422)."""
    if raw is None:
        return None
    if not isinstance(raw, dict) or set(raw) - set(OVERRIDE_KEYS):
        raise AlertsInvalid("validation", "כללי המונה אינם תקינים.", "The meter rules are invalid.", {"fields": ["rules"]})
    out = {k: check_value(f"rules.{k}", OVERRIDE_KEYS[k], v) for k, v in raw.items() if v is not None}
    return out or None


def effective(rules: dict[str, Any], meter: Any) -> dict[str, Any]:
    """The rules that apply to one meter: the installation defaults, the kind's defaults (irrigation: night rule off - owner Q9), the burst
    threshold = the meter's plausibility cap (`max_flow_lph`), then the meter's own overrides."""
    eff = dict(rules)
    eff.update(night_rule=(meter["kind"] != "irrigation"), abnormal_rule=True, burst_rule=True, offline_rule=True,
               burst_lph=float(meter["max_flow_lph"] or 20000.0))
    eff.update(overrides_of(meter["rules_json"] if "rules_json" in meter.keys() else None))
    return eff


# ---------------------------------------------------------------- save (system.configure)

def view(conn: sqlite3.Connection) -> dict[str, Any]:
    return {**load(conn), "roles": [{"id": r, "label": ROLE_LABELS[r]} for r in ROUTABLE_ROLES], "channels": list(CHANNELS), "kinds_order": list(KINDS),
            "mute_minutes": list(MUTE_MINUTES), "snooze_limits": dict(SNOOZE_LIMITS), "ranges": {k: {"kind": s[0], "min": s[1], "max": s[2]} for k, s in RULE_COLUMNS.items()}}


def validate_recipients(conn: sqlite3.Connection, rec: Any, field: str) -> dict[str, list[str]]:
    if not isinstance(rec, dict) or set(rec) - {"roles", "users", "groups"}:
        raise AlertsInvalid("validation", "נמענים לא תקינים.", "Invalid recipients.", {"fields": [field]})
    roles, users, grps = rec.get("roles") or [], rec.get("users") or [], rec.get("groups") or []
    if not all(isinstance(x, list) for x in (roles, users, grps)) or len(users) > USERS_MAX or len(grps) > GROUPS_MAX or len(roles) > len(ROUTABLE_ROLES):
        raise AlertsInvalid("validation", "נמענים לא תקינים.", "Invalid recipients.", {"fields": [field]})
    if any(r not in ROUTABLE_ROLES for r in roles):
        raise AlertsInvalid("recipient_role", "תפקיד שלא יכול לקבל התראות מים.", "This role cannot receive water alerts.", {"fields": [f"{field}.roles"]})
    active = {r[0] for r in conn.execute("SELECT id FROM users WHERE active = 1").fetchall()}
    if any(u not in active for u in users):
        raise AlertsInvalid("recipient_user", "משתמש לא מוכר.", "Unknown user.", {"fields": [f"{field}.users"]})
    groups = {r[0] for r in conn.execute("SELECT id FROM groups").fetchall()}
    if any(g not in groups for g in grps):
        raise AlertsInvalid("recipient_group", "קבוצה לא מוכרת.", "Unknown group.", {"fields": [f"{field}.groups"]})
    return {"roles": [r for r in ROUTABLE_ROLES if r in roles], "users": sorted(set(users)), "groups": sorted(set(grps))}


def _validate(conn: sqlite3.Connection, body: dict[str, Any], cur: dict[str, Any]) -> dict[str, Any]:
    if set(body) - {"rules", "kinds", "snooze", "row_version"}:
        raise AlertsInvalid("validation", "מבנה לא תקין.", "Invalid structure.", {"fields": sorted(set(body) - {"rules", "kinds", "snooze", "row_version"})})
    out = copy.deepcopy(cur)
    if body.get("snooze") is not None:
        out["snooze"] = validate_snooze(body["snooze"], cur["snooze"])
    rules = body.get("rules")
    if rules is not None:
        if not isinstance(rules, dict) or set(rules) - set(RULE_COLUMNS):
            raise AlertsInvalid("validation", "כלל לא מוכר.", "Unknown rule.", {"fields": ["rules"]})
        for k, v in rules.items():
            out["rules"][k] = check_value(f"rules.{k}", RULE_COLUMNS[k], v)
        if out["rules"]["night_from"] == out["rules"]["night_to"]:
            raise AlertsInvalid("validation", "חלון הלילה ריק.", "The night window is empty.", {"fields": ["rules.night_to"]})
    kinds = body.get("kinds")
    if kinds is not None:
        if not isinstance(kinds, dict) or any(k not in KINDS for k in kinds):
            raise AlertsInvalid("validation", "סוג התראה לא מוכר.", "Unknown alert kind.", {"fields": ["kinds"]})
        for k, s in kinds.items():
            if not isinstance(s, dict) or set(s) - {"enabled", "recipients", "channels"}:
                raise AlertsInvalid("validation", "מבנה לא תקין.", "Invalid structure.", {"fields": [f"kinds.{k}"]})
            st = out["kinds"][k]
            if "enabled" in s:
                if not isinstance(s["enabled"], bool):
                    raise _bad(f"kinds.{k}.enabled")
                st["enabled"] = s["enabled"]
            if "recipients" in s:
                st["recipients"] = validate_recipients(conn, s["recipients"], f"kinds.{k}.recipients")
            if "channels" in s:
                ch = s["channels"]
                if not isinstance(ch, list) or any(c not in CHANNELS for c in ch):
                    raise AlertsInvalid("channel", "ערוץ לא זמין.", "This channel is not available.", {"fields": [f"kinds.{k}.channels"]})
                st["channels"] = [c for c in CHANNELS if c in ch]
    return out


def bridge(conn: sqlite3.Connection, settings: dict[str, Any]) -> None:
    """Mirror the routing onto the CR-018 policy rows of the three sources (recipients rule `water`). The severity, category, hold time
    and fold window stay the catalogue's (the pipeline's severity rules are untouched)."""
    for k in KINDS:
        src = SOURCE[k]
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
             json.dumps({"rule": "water"}), json.dumps(ch), now_iso()))


def save(conn: sqlite3.Connection, user_id: str | None, body: dict[str, Any]) -> tuple[dict[str, Any], list[str]]:
    """Store the defaults and the routing (the caller holds system.configure and audits). Returns (the new view, the changed blocks)."""
    cur = load(conn)
    if body.get("row_version") is not None and body["row_version"] != cur["row_version"]:
        raise AlertsInvalid("revision_conflict", "ההגדרות השתנו בינתיים.", "The settings were changed meanwhile.", {"row_version": cur["row_version"]})
    new = _validate(conn, body, cur)
    cols = list(RULE_COLUMNS)
    vals = [int(new["rules"][c]) if RULE_COLUMNS[c][0] == "bool" else new["rules"][c] for c in cols]
    conn.execute(
        f"""UPDATE water_alert_settings SET {', '.join(f'{c} = ?' for c in cols)}, kinds_json = ?, snooze_minutes_json = ?, snooze_default_min = ?,
              snooze_max_min = ?, row_version = row_version + 1, updated_by = ?, updated_at = ? WHERE id = 1""",
        (*vals, json.dumps(new["kinds"], ensure_ascii=False), json.dumps(new["snooze"]["durations"]), new["snooze"]["default"], new["snooze"]["max"],
         user_id, now_iso()))
    bridge(conn, new)
    changed = [b for b in ("rules", "kinds", "snooze") if new[b] != cur[b]]
    return view(conn), changed


# ---------------------------------------------------------------- the `water` recipients rule

def recipient_users(conn: sqlite3.Connection, n: dict[str, Any]) -> list[str]:
    """The installation's recipients of the notification's kind, only while that kind is on. The caller (notify.recipients_for)
    intersects the result with who may see the meter."""
    from .temperature_alerts import _expand  # the same role / user / group expansion (active users, live bindings)

    source = str(n.get("source") or "")
    kind = next((k for k, s in SOURCE.items() if s == source), None)
    if kind is None:
        return []
    s = load(conn)["kinds"][kind]
    return _expand(conn, s["recipients"]) if s["enabled"] else []


def module_on(conn: Any) -> bool:
    """The module switch, read without importing the water services (the policy matrix hides the water sources while it is off)."""
    try:
        row = conn.execute("SELECT value FROM settings WHERE key = 'water.enabled'").fetchone()
    except Exception:  # noqa: BLE001 - a fixture database without the settings table has no module either
        return False
    return bool(row) and str(row[0]) == "true"
