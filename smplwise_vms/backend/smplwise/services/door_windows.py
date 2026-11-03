"""CR-039 / DOORWIN-295: door windows - timed hold-open schedules of WisKey doors, planned by Arx, executed by the engine.

The core safety principle (CR-039 4.1): a window is executed by whoever can guarantee the relock. Arx never sends "open" at a window's
start and "close" at its end from its own timer. Arx holds:
- the RULES (weekly / one-off windows per door, a calendar of special days) and their versions;
- the COMPILE: one WisKey hold-open program per door (the union of the door's enabled rules + date exceptions), written through the typed
  seam (services/door_windows_engine.py) only when the compiled document changed, and never over a program a person made by hand;
- the durable PLAN: one occurrence row per planned hold-open (UTC instants + the station zone + WisKey's window token);
- the WATCHDOG (services/door_windows_watch.py): confirms the relock from the engine's own status and, when it cannot, raises a critical
  notification and retries the CLOSE direction (bounded), never the open.

Shipped OFF: `doors.windows.enabled` = off. With it on but no permitted AND built live engine (this build: door_windows_engine.
LIVE_ENGINE_BUILT is False, review 3 DW-02) the tier is D ("prepared"): rules, calendar and occurrences work, nothing is written to or read
from WisKey.

DST (CR-039 4.5, W0 finding 8): occurrences follow WisKey's window token - a wall-clock string compare in the station's IANA zone. A
window partly inside the spring-forward gap is held for the part that exists; a window crossing the fall-back repeat is one token, one
occurrence. No fixed offsets anywhere (AGENTS.md)."""
from __future__ import annotations

import datetime as dt
import hashlib
import json
import logging
import re
import sqlite3
import threading
import time
from dataclasses import dataclass, field
from typing import Any, Callable, Iterable
from zoneinfo import ZoneInfo, ZoneInfoNotFoundError

from ..audit import audit
from ..db import Database, get_setting, new_id, now_iso, set_setting
from ..errors import ApiError
from ..rbac import STATION, Principal, authorize
from . import door_windows_engine as dwe

log = logging.getLogger("smplwise.doors")
UTC = dt.timezone.utc

# ---------------------------------------------------------------- permissions (CR-039 7.1; labels: routers/access.py PERMISSION_LABELS)
MANAGE = "access.windows.manage"  # create / edit / enable / pause / retire rules, calendar, manual relock check
CANCEL = "access.windows.cancel"  # the guard override (end a running window now) and the manual relock check
READ = "access.stations.read"     # who sees the rules and occurrences (the schedules screen's audience, CR-039 7.1)
PERMISSIONS = (MANAGE, CANCEL)

# ---------------------------------------------------------------- settings (CR-039 13; `doors.` is kept out of backup restores)
ENABLED = "doors.windows.enabled"
AUTOMATION_ACTOR = "doors.automation_actor"
HM_RE = re.compile(r"^([01]\d|2[0-3]):[0-5]\d$")
DATE_RE = re.compile(r"^\d{4}-\d{2}-\d{2}$")


def _int_in(lo: int, hi: int) -> Callable[[str], bool]:
    return lambda v: v.isdigit() and lo <= int(v) <= hi


SETTINGS: dict[str, tuple[str, Callable[[str], bool]]] = {
    ENABLED: ("off", lambda v: v in ("off", "on")),
    "doors.windows.max_hours": ("4", _int_in(1, 12)),
    "doors.windows.max_per_day_per_door": ("3", _int_in(1, 6)),
    "doors.windows.quiet_from": ("22:00", lambda v: bool(HM_RE.match(v))),
    "doors.windows.quiet_to": ("06:00", lambda v: bool(HM_RE.match(v))),
    "doors.windows.relock_grace_s": ("120", _int_in(60, 600)),
    "doors.windows.relock_retries": ("3", _int_in(0, 5)),
    "doors.windows.reraise_min": ("15", _int_in(5, 60)),
    "doors.windows.exterior_allowed": ("false", lambda v: v in ("false", "true")),
    # DOORWIN2-295 (CR-039 5.4 / 9.3 / 9.4)
    "doors.windows.calendar_generator": ("israel", lambda v: v in ("israel", "none")),
    "doors.windows.event_extend_owned": ("false", lambda v: v in ("false", "true")),  # an event may extend a RUNNING window (the program blinks ~15 s)
    "doors.automation_actor": ("off", lambda v: v in ("off", "on")),                   # cannot be on while the contract reports no automation actor
}


def setting(conn: sqlite3.Connection, key: str) -> str:
    default, valid = SETTINGS[key]
    value = get_setting(conn, key) or default
    return value if valid(value) else default


def int_setting(conn: sqlite3.Connection, key: str) -> int:
    return int(setting(conn, key))


def enabled(conn: sqlite3.Connection) -> bool:
    return setting(conn, ENABLED) == "on"


def _no_automation_actor() -> bool:
    return False


# Whether the installed WisKey contract reports the W1 automation actor (CR-039 9.4). This build has no such capability (W1 is unanswered):
# False, always. A test replaces the probe to exercise the armed path on fakes; nothing in the product does.
AUTOMATION_ACTOR_PROBE: Callable[[], bool] = _no_automation_actor


def automation_actor_available() -> bool:
    try:
        return AUTOMATION_ACTOR_PROBE() is True
    except Exception:  # noqa: BLE001
        return False


def automation_actor_on(conn: sqlite3.Connection) -> bool:
    return automation_actor_available() and setting(conn, AUTOMATION_ACTOR) == "on"


def settings_view(conn: sqlite3.Connection) -> dict[str, str]:
    return {k: setting(conn, k) for k in SETTINGS}


def update_settings(conn: sqlite3.Connection, changes: dict[str, Any]) -> dict[str, tuple[str, str]]:
    """Validate and store; returns {key: (before, after)} of what changed. Unknown keys / invalid values: 422."""
    out: dict[str, tuple[str, str]] = {}
    for key, value in changes.items():
        if key not in SETTINGS or not isinstance(value, str) or not SETTINGS[key][1](value):
            raise ApiError(422, "invalid_setting", "ערך לא תקין להגדרה.", details={"key": str(key)[:64]})
    if changes.get(AUTOMATION_ACTOR) == "on" and not automation_actor_available():
        # T16: the refusal of an automation opening a door is lifted by a setting only when the contract reports the capability - fail closed
        raise ApiError(409, "automation_actor_unavailable", "הפעלה מאוטומציה אינה זמינה: אין עדיין זהות אוטומציה מאומתת.")
    for key, value in changes.items():
        before = setting(conn, key)
        if before != value:
            set_setting(conn, key, value)
            out[key] = (before, value)
    return out


# ---------------------------------------------------------------- the door directory (from the WisKey copy; tests replace it)

@dataclass(frozen=True)
class Door:
    station_id: str
    relay: int
    name: str
    station_name: str
    zone: str

    @property
    def key(self) -> str:
        return door_key(self.station_id, self.relay)

    @property
    def label(self) -> str:
        return f"{self.station_name} · {self.name}" if self.station_name else self.name


def door_key(station_id: str, relay: int) -> str:
    return f"{station_id}:{relay}"


def installation_zone(conn: sqlite3.Connection) -> str:
    name = get_setting(conn, "time.zone", "Asia/Jerusalem") or "Asia/Jerusalem"
    return name if valid_zone(name) else "Asia/Jerusalem"


def valid_zone(name: Any) -> bool:
    if not isinstance(name, str) or not name or len(name) > 64:
        return False
    try:
        ZoneInfo(name)
    except (ZoneInfoNotFoundError, ValueError):
        return False
    return True


def _sync_doors(conn: sqlite3.Connection) -> list[Door]:
    """Every relay of every lock-enabled station of the served WisKey copy (names only; never read from the device). A station's own
    display zone when WisKey reports a valid one, else the installation's."""
    from . import intercom_sync

    fallback = installation_zone(conn)
    out: list[Door] = []
    for s in intercom_sync.SYNC.stations():
        if not s.get("lock_enabled"):
            continue
        zone = (s.get("zone") or {}).get("name") if isinstance(s.get("zone"), dict) else None
        zone = zone if valid_zone(zone) else fallback
        for lock in s.get("locks") or []:
            relay = lock.get("physical_index")
            if isinstance(relay, int) and not isinstance(relay, bool):
                out.append(Door(s["id"], relay, lock.get("name") or f"דלת {relay}", s.get("name") or "", zone))
    return out


DOOR_DIRECTORY: Callable[[sqlite3.Connection], list[Door]] = _sync_doors


def doors(conn: sqlite3.Connection) -> list[Door]:
    return list(DOOR_DIRECTORY(conn))


def doors_by_key(conn: sqlite3.Connection) -> dict[str, Door]:
    return {d.key: d for d in doors(conn)}


def exterior_doors(conn: sqlite3.Connection) -> set[str]:
    return {door_key(r["station_id"], r["relay"]) for r in conn.execute("SELECT station_id, relay FROM door_window_door_flags WHERE exterior = 1")}


# ---------------------------------------------------------------- authority

def identity_refusal(conn: sqlite3.Connection, principal: Principal, *, dev_mode: bool = False) -> str | None:
    """The person rule of every window / emergency WRITE (CR-033 4.1 step 1, reused): an identified principal, active, never a wall /
    kiosk account, never a bearer-token client (an interactive session only - a script holding a token is not a person at a door)."""
    from . import door_authority

    if not door_authority.identity_ok(principal, dev_mode, conn):
        return "identity_unmapped"
    user = conn.execute("SELECT active FROM users WHERE id = ?", (principal.user_id,)).fetchone()
    if user is not None and not user["active"]:
        return "user_inactive"
    if door_authority.is_wall_account(conn, principal.user_id):
        return "wall_account"
    if getattr(principal, "via", "") == "bearer":
        return "interactive_session_required"
    return None


def require_person(conn: sqlite3.Connection, principal: Principal, action: str, *, dev_mode: bool = False) -> None:
    reason = identity_refusal(conn, principal, dev_mode=dev_mode)
    if reason:
        audit(conn, actor=principal, action=action, decision="denied", reason=reason)
        raise ApiError(403, "forbidden", "הפעולה דורשת משתמש מזוהה במסך פעיל.", details={"reason": reason})


def may(conn: sqlite3.Connection, principal: Principal, permission: str, station_id: str) -> bool:
    return authorize(conn, principal, permission, (STATION, station_id)).allowed


def visible_doors(conn: sqlite3.Connection, principal: Principal, permission: str = READ) -> list[Door]:
    """The doors whose station chain grants `permission` to the principal (deny wins, per station)."""
    cache: dict[str, bool] = {}
    out = []
    for d in doors(conn):
        if d.station_id not in cache:
            cache[d.station_id] = may(conn, principal, permission, d.station_id)
        if cache[d.station_id]:
            out.append(d)
    return out


def require_doors(conn: sqlite3.Connection, principal: Principal, keys: Iterable[tuple[str, int]], permission: str, action: str) -> None:
    """Every door of a rule / an action needs `permission` on its own station chain (CR-039 7.4: explicit doors, deny wins)."""
    for station_id, relay in keys:
        if not may(conn, principal, permission, station_id):
            audit(conn, actor=principal, action=action, decision="denied", resource_type="door", resource_id=door_key(station_id, relay), reason="no_permission")
            raise ApiError(403, "forbidden", "אין הרשאה לאחת הדלתות שנבחרו.", details={"permission": permission})


# ---------------------------------------------------------------- times

def minutes(hm: str) -> int:
    return 24 * 60 if hm == "24:00" else int(hm[:2]) * 60 + int(hm[3:])


def hm_of(m: int) -> str:
    return "24:00" if m >= 24 * 60 else f"{m // 60:02d}:{m % 60:02d}"


def valid_hm(value: Any, *, end: bool = False) -> bool:
    return isinstance(value, str) and (bool(HM_RE.match(value)) or (end and value == "24:00"))


def iso(at: dt.datetime) -> str:
    return at.astimezone(UTC).replace(microsecond=0).strftime("%Y-%m-%dT%H:%M:%SZ")


def parse_iso(value: str) -> dt.datetime:
    return dt.datetime.strptime(value, "%Y-%m-%dT%H:%M:%SZ").replace(tzinfo=UTC)


def sun0(day: dt.date) -> int:
    """0 = Sunday .. 6 = Saturday (the Israeli week the screens show)."""
    return (day.weekday() + 1) % 7


WISKEY_DAYS = ("Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday")  # date.weekday() order (R)
FRIDAY = 5  # sun0


def wiskey_day(weekday_sun0: int) -> str:
    return WISKEY_DAYS[(weekday_sun0 - 1) % 7]


def wall_instant(day: dt.date, hm: str, tz: ZoneInfo) -> dt.datetime:
    """The first UTC instant at which the local wall clock on `day` reads `hm` or later - exactly when WisKey's token compare
    (`start <= HH:MM < end`) turns. A nonexistent wall time (the spring-forward gap) resolves to the end of the gap; an ambiguous one
    (the fall-back repeat) to its first occurrence. "24:00" is the next day's local midnight."""
    if hm == "24:00":
        return wall_instant(day + dt.timedelta(days=1), "00:00", tz)
    naive = dt.datetime.combine(day, dt.time(int(hm[:2]), int(hm[3:])))
    first = naive.replace(tzinfo=tz, fold=0).astimezone(UTC)
    if first.astimezone(tz).replace(tzinfo=None) == naive:
        return first
    probe = first - dt.timedelta(hours=3)  # inside a gap: walk minute by minute to the first local time at or after `hm`
    for _ in range(6 * 60 + 1):
        local = probe.astimezone(tz).replace(tzinfo=None)
        if local >= naive:
            return probe
        probe += dt.timedelta(minutes=1)
    return first


def local_date(at: dt.datetime, tz: ZoneInfo) -> dt.date:
    return at.astimezone(tz).date()


# ---------------------------------------------------------------- rules

KINDS = ("weekly", "once", "event")  # 'event' = CR-039 9 (DOORWIN2-295): an event starts a hold of N minutes; its trigger lives in services/door_window_triggers.py
CALENDAR_POLICIES = ("skip_holidays", "holidays_like_friday", "ignore_calendar")
RULE_STATES = ("draft", "enabled", "paused", "retired")
MAX_PERIODS_PER_DAY = 8  # WisKey's own cap per weekday (R)
MAX_EXCEPTIONS = 100     # date exceptions per program (W?: the fake's assumption, CR-039 5.4)
MAX_DOORS = 64
NAME_MAX = 60
HORIZON_DAYS = 400       # CR-039 5.4: date exceptions this far ahead
PLAN_DAYS = 8            # occurrences materialised this far ahead (today + 7)


@dataclass(frozen=True)
class Period:
    weekday: int | None  # 0 = Sunday .. 6; None for 'once'
    on_date: str | None  # YYYY-MM-DD for 'once'
    start: str
    end: str


@dataclass(frozen=True)
class RuleDoc:
    id: str
    name: str
    kind: str
    state: str
    calendar_policy: str
    doors: tuple[tuple[str, int], ...]
    periods: tuple[Period, ...]
    revision: int = 1


def validate_rule(body: dict[str, Any], *, max_hours: int, max_per_day: int, quiet: tuple[str, str], today: dt.date) -> tuple[str, str, str, str, list[tuple[str, int]], list[Period]]:
    """(name, kind, calendar_policy, notes, doors, periods) of a rule body, or 422 with the first problem's code. SR-2: every period has
    an end; no overnight period; no period longer than `max_hours`; no period touching the quiet hours."""
    def bad(code: str, text: str, **details: Any) -> ApiError:
        return ApiError(422, code, text, details=details or None)

    name = body.get("name")
    if not isinstance(name, str) or not name.strip() or len(name.strip()) > NAME_MAX or any(ord(c) < 32 for c in name):
        raise bad("invalid_name", "שם החלון חסר או ארוך מדי.")
    kind = body.get("kind")
    if kind not in KINDS:
        raise bad("invalid_kind", "סוג החלון לא תקין.")
    policy = body.get("calendar_policy", "skip_holidays")
    if policy not in CALENDAR_POLICIES:
        raise bad("invalid_calendar_policy", "מדיניות לוח השנה לא תקינה.")
    notes = body.get("notes") or ""
    if not isinstance(notes, str) or len(notes) > 300:
        raise bad("invalid_notes", "ההערה ארוכה מדי.")
    raw_doors = body.get("doors")
    if not isinstance(raw_doors, list) or not 1 <= len(raw_doors) <= MAX_DOORS:
        raise bad("invalid_doors", "יש לבחור לפחות דלת אחת.")
    doors_out: list[tuple[str, int]] = []
    for d in raw_doors:
        sid = d.get("station_id") if isinstance(d, dict) else None
        relay = d.get("relay") if isinstance(d, dict) else None
        if not isinstance(sid, str) or not 0 < len(sid) <= 128 or any(ord(c) < 32 for c in sid) or not isinstance(relay, int) or isinstance(relay, bool) or not 1 <= relay <= 64:
            raise bad("invalid_doors", "דלת לא תקינה.")
        if (sid, relay) in doors_out:
            raise bad("invalid_doors", "דלת מופיעה פעמיים.")
        doors_out.append((sid, relay))
    raw_periods = body.get("periods")
    if kind == "event":  # an event rule has no periods of its own: the event decides when (its trigger carries the length and the allowed hours)
        if raw_periods not in (None, []):
            raise bad("invalid_periods", "לחלון לפי אירוע אין שעות קבועות.")
        return name.strip(), kind, policy, notes, doors_out, []
    if not isinstance(raw_periods, list) or not 1 <= len(raw_periods) <= 7 * MAX_PERIODS_PER_DAY:
        raise bad("invalid_periods", "יש להגדיר לפחות חלון זמן אחד.")
    periods: list[Period] = []
    for p in raw_periods:
        if not isinstance(p, dict):
            raise bad("invalid_periods", "חלון זמן לא תקין.")
        start, end = p.get("start"), p.get("end")
        if not valid_hm(start) or not valid_hm(end, end=True):
            raise bad("invalid_time", "שעה לא תקינה.")
        if minutes(end) <= minutes(start):
            raise bad("invalid_time", "שעת הסיום חייבת להיות אחרי שעת ההתחלה (חלון לילה מוגדר כשני חלונות).")
        if minutes(end) - minutes(start) > max_hours * 60:
            raise bad("window_too_long", "החלון ארוך מהמותר.", max_hours=max_hours)
        if _touches_quiet(start, end, quiet):
            raise bad("quiet_hours", "החלון נוגע בשעות השקטות.", quiet_from=quiet[0], quiet_to=quiet[1])
        if kind == "weekly":
            wd = p.get("weekday")
            if not isinstance(wd, int) or isinstance(wd, bool) or not 0 <= wd <= 6:
                raise bad("invalid_weekday", "יום בשבוע לא תקין.")
            periods.append(Period(wd, None, start, end))
        else:
            on = p.get("on_date")
            if not isinstance(on, str) or not DATE_RE.match(on):
                raise bad("invalid_date", "תאריך לא תקין.")
            try:
                day = dt.date.fromisoformat(on)
            except ValueError:
                raise bad("invalid_date", "תאריך לא תקין.") from None
            if day < today or day > today + dt.timedelta(days=HORIZON_DAYS):
                raise bad("invalid_date", "התאריך עבר או רחוק מדי.")
            periods.append(Period(None, on, start, end))
    by_day: dict[Any, list[Period]] = {}
    for p in periods:
        by_day.setdefault(p.weekday if kind == "weekly" else p.on_date, []).append(p)
    for group in by_day.values():
        spans = sorted((minutes(p.start), minutes(p.end)) for p in group)
        if any(a[1] > b[0] for a, b in zip(spans, spans[1:])):
            raise bad("overlap", "שני חלונות חופפים באותו יום.")
        if len(group) > max_per_day:
            raise bad("too_many_per_day", "יותר מדי חלונות ביום אחד.", max_per_day=max_per_day)
    return name.strip(), kind, policy, notes, doors_out, periods


def _touches_quiet(start: str, end: str, quiet: tuple[str, str]) -> bool:
    qf, qt = minutes(quiet[0]), minutes(quiet[1])
    s, e = minutes(start), minutes(end)
    if qf == qt:
        return False
    ranges = [(qf, qt)] if qf < qt else [(qf, 24 * 60), (0, qt)]
    return any(s < b and a < e for a, b in ranges)


def load_rules(conn: sqlite3.Connection, states: Iterable[str] = ("enabled",)) -> list[RuleDoc]:
    states = tuple(states)
    rows = conn.execute(f"SELECT * FROM door_window_rules WHERE state IN ({','.join('?' * len(states))}) ORDER BY created_at, id", states).fetchall()
    return [_rule_doc(conn, r) for r in rows]


def _rule_doc(conn: sqlite3.Connection, r: sqlite3.Row) -> RuleDoc:
    doors_ = tuple((d["station_id"], d["relay"]) for d in conn.execute("SELECT station_id, relay FROM door_window_rule_doors WHERE rule_id = ? ORDER BY station_id, relay", (r["id"],)))
    periods = tuple(Period(p["weekday"], p["on_date"], p["start_hm"], p["end_hm"]) for p in conn.execute(
        "SELECT weekday, on_date, start_hm, end_hm FROM door_window_periods WHERE rule_id = ? ORDER BY COALESCE(on_date, ''), weekday, start_hm", (r["id"],)))
    return RuleDoc(r["id"], r["name"], r["kind"], r["state"], r["calendar_policy"], doors_, periods, r["revision"])


def rule_row(conn: sqlite3.Connection, rule_id: str) -> sqlite3.Row | None:
    return conn.execute("SELECT * FROM door_window_rules WHERE id = ?", (rule_id,)).fetchone()


def _document(name: str, kind: str, policy: str, notes: str, doors_: list[tuple[str, int]], periods: list[Period], trigger: dict[str, Any] | None = None) -> str:
    doc: dict[str, Any] = {"name": name, "kind": kind, "calendar_policy": policy, "notes": notes, "doors": [list(d) for d in doors_],
                           "periods": [[p.weekday, p.on_date, p.start, p.end] for p in periods]}
    if trigger is not None:
        doc["trigger"] = {k: v for k, v in trigger.items() if k != "token"}  # the version history never holds a secret
    return json.dumps(doc, ensure_ascii=False, sort_keys=True)


def save_rule(conn: sqlite3.Connection, principal: Principal, body: dict[str, Any], *, rule_id: str | None = None, today: dt.date,
              secrets_out: dict[str, str] | None = None) -> str:
    """Create (rule_id None) or replace a rule's definition. The caller checked the person and the permission on every door. A save never
    enables: a new rule is a draft; an edited enabled rule stays enabled with its new revision - and the approver becomes the editor.
    An `event` rule also stores its trigger (services/door_window_triggers.py); the plaintext trigger token of a new rule is put in
    `secrets_out["token"]` ONCE (only its SHA-256 is stored)."""
    quiet = (setting(conn, "doors.windows.quiet_from"), setting(conn, "doors.windows.quiet_to"))
    name, kind, policy, notes, doors_, periods = validate_rule(
        body, max_hours=int_setting(conn, "doors.windows.max_hours"), max_per_day=int_setting(conn, "doors.windows.max_per_day_per_door"),
        quiet=quiet, today=today)
    trigger = None
    if kind == "event":
        from . import door_window_triggers as dwt

        trigger = dwt.validate_trigger(body.get("trigger"), max_hours=int_setting(conn, "doors.windows.max_hours"),
                                       max_per_day=int_setting(conn, "doors.windows.max_per_day_per_door"), quiet=quiet)
    known = doors_by_key(conn)
    missing = [door_key(*d) for d in doors_ if door_key(*d) not in known]
    if missing:
        raise ApiError(422, "door_unknown", "אחת הדלתות אינה מוכרת כרגע.", details={"doors": missing[:8]})
    if setting(conn, "doors.windows.exterior_allowed") != "true":
        ext = exterior_doors(conn)
        if any(door_key(*d) in ext for d in doors_):
            raise ApiError(422, "exterior_not_allowed", "דלת חיצונית אינה יכולה להיות בחלון פתיחה.")
    at = now_iso()
    if rule_id is None:
        rule_id = new_id()
        conn.execute("""INSERT INTO door_window_rules(id, name, kind, state, calendar_policy, notes, created_by, created_at, updated_by, updated_at, revision)
                        VALUES (?, ?, ?, 'draft', ?, ?, ?, ?, ?, ?, 1)""", (rule_id, name, kind, policy, notes, principal.user_id, at, principal.user_id, at))
        revision = 1
    else:
        row = rule_row(conn, rule_id)
        if row is None or row["state"] == "retired":
            raise ApiError(404, "not_found", "החלון לא נמצא.")
        if row["kind"] != kind:
            raise ApiError(422, "invalid_kind", "אי אפשר לשנות את סוג החלון.")
        expected = body.get("revision")
        if expected is not None and expected != row["revision"]:
            raise ApiError(409, "revision_conflict", "החלון השתנה בינתיים - יש לטעון מחדש.")
        revision = row["revision"] + 1
        approved = (principal.user_id, at) if row["state"] == "enabled" else (row["approved_by"], row["approved_at"])
        conn.execute("""UPDATE door_window_rules SET name = ?, calendar_policy = ?, notes = ?, updated_by = ?, updated_at = ?, revision = ?,
                        approved_by = ?, approved_at = ? WHERE id = ?""", (name, policy, notes, principal.user_id, at, revision, *approved, rule_id))
        conn.execute("DELETE FROM door_window_rule_doors WHERE rule_id = ?", (rule_id,))
        conn.execute("DELETE FROM door_window_periods WHERE rule_id = ?", (rule_id,))
    conn.executemany("INSERT INTO door_window_rule_doors(rule_id, station_id, relay) VALUES (?, ?, ?)", [(rule_id, s, r) for s, r in doors_])
    conn.executemany("INSERT INTO door_window_periods(rule_id, weekday, on_date, start_hm, end_hm) VALUES (?, ?, ?, ?, ?)",
                     [(rule_id, p.weekday, p.on_date, p.start, p.end) for p in periods])
    if trigger is not None:
        from . import door_window_triggers as dwt

        token = dwt.store_trigger(conn, principal, rule_id, trigger, created=revision == 1)
        if token and secrets_out is not None:
            secrets_out["token"] = token
    conn.execute("INSERT INTO door_window_rule_versions(rule_id, revision, document, saved_by, saved_at) VALUES (?, ?, ?, ?, ?)",
                 (rule_id, revision, _document(name, kind, policy, notes, doors_, periods, trigger), principal.user_id, at))
    return rule_id


def set_rule_state(conn: sqlite3.Connection, principal: Principal, rule_id: str, state: str) -> sqlite3.Row:
    row = rule_row(conn, rule_id)
    if row is None or row["state"] == "retired":
        raise ApiError(404, "not_found", "החלון לא נמצא.")
    at = now_iso()
    if state == "enabled":
        conn.execute("UPDATE door_window_rules SET state = 'enabled', approved_by = ?, approved_at = ?, updated_by = ?, updated_at = ? WHERE id = ?",
                     (principal.user_id, at, principal.user_id, at, rule_id))
        conn.execute("UPDATE door_window_triggers SET authorising_actor = ? WHERE rule_id = ?", (principal.user_id, rule_id))  # the approver covers the live revision
    elif state == "paused":
        conn.execute("UPDATE door_window_rules SET state = 'paused', updated_by = ?, updated_at = ? WHERE id = ?", (principal.user_id, at, rule_id))
    elif state == "retired":
        conn.execute("UPDATE door_window_rules SET state = 'retired', retired_at = ?, updated_by = ?, updated_at = ? WHERE id = ?",
                     (at, principal.user_id, at, rule_id))
    else:
        raise ApiError(422, "invalid_state", "מצב לא תקין.")
    return rule_row(conn, rule_id)


def stale_approvals(conn: sqlite3.Connection, rules: list[RuleDoc]) -> list[str]:
    """CR-039 5.5 / T11: an enabled rule whose approver is inactive or lost `access.windows.manage` on any of its doors is paused by the
    next compile (never executed on a stale approval)."""
    out = []
    for r in rules:
        row = rule_row(conn, r.id)
        approver = row["approved_by"] if row else None
        if not approver:
            out.append(r.id)
            continue
        user = conn.execute("SELECT id, username, display_name, active FROM users WHERE id = ?", (approver,)).fetchone()
        if user is None or not user["active"]:
            out.append(r.id)
            continue
        p = Principal(user["id"], user["username"] or "", user["display_name"] or "", "internal")
        if not all(may(conn, p, MANAGE, s) for s, _ in r.doors):
            out.append(r.id)
    return out


# ---------------------------------------------------------------- calendar

DAY_TYPES = ("holiday", "holiday_eve", "regular", "closed")


def calendar_for(conn: sqlite3.Connection, station_id: str, start: dt.date, days: int) -> dict[str, str]:
    """{YYYY-MM-DD: day_type}: the generated Israeli holidays and eves (services/special_days.py, `doors.windows.calendar_generator`) under the
    manager's overrides; among the overrides a station-scoped entry beats the installation-wide one. A `regular` override cancels a generated
    holiday: the day stays in the result so the compile sees a regular day (not a missing one)."""
    from . import special_days

    end = (start + dt.timedelta(days=days)).isoformat()
    out: dict[str, str] = dict(special_days.day_types(special_days.generator_of(conn), start, start + dt.timedelta(days=days)))
    rows = conn.execute("SELECT on_date, scope_key, day_type FROM door_window_calendar WHERE on_date >= ? AND on_date <= ? AND scope_key IN ('*', ?)",
                        (start.isoformat(), end, station_id)).fetchall()
    for r in sorted(rows, key=lambda r: r["scope_key"] != "*"):  # '*' first, the station's entry overrides it
        out[r["on_date"]] = r["day_type"]
    return out


# ---------------------------------------------------------------- the compile (one program per door, CR-039 4.3 / 5.4)

Span = tuple[int, int, tuple[str, ...]]  # start minute, end minute, contributing rule ids


def merge(spans: Iterable[tuple[int, int, str]]) -> list[Span]:
    """Union of periods; overlapping AND touching periods become one hold (one continuous window, one token)."""
    out: list[list[Any]] = []
    for s, e, rid in sorted(spans):
        if out and s <= out[-1][1]:
            out[-1][1] = max(out[-1][1], e)
            if rid not in out[-1][2]:
                out[-1][2].append(rid)
        else:
            out.append([s, e, [rid]])
    return [(s, e, tuple(r)) for s, e, r in out]


def day_spans(rules: list[RuleDoc], day: dt.date, day_type: str | None) -> list[Span]:
    """The periods of `day` under each rule's calendar policy (CR-039 5.4): `closed` drops everything; a holiday has no window
    (skip_holidays), Friday's periods (holidays_like_friday) or its own (ignore_calendar); a holiday eve is a Friday unless the rule ignores
    the calendar; a one-off rule adds its periods on its date (dropped on a closed day)."""
    if day_type == "closed":
        return []
    wd = sun0(day)
    spans: list[tuple[int, int, str]] = []
    for r in rules:
        if r.kind == "weekly":
            src = wd
            if day_type == "holiday":
                if r.calendar_policy == "skip_holidays":
                    continue
                if r.calendar_policy == "holidays_like_friday":
                    src = FRIDAY
            elif day_type == "holiday_eve" and r.calendar_policy != "ignore_calendar":
                src = FRIDAY
            spans += [(minutes(p.start), minutes(p.end), r.id) for p in r.periods if p.weekday == src]
        elif r.kind in ("once", "event"):  # an event hold is a one-off period on its date (services/door_window_triggers.py feeds it as a synthetic rule)
            spans += [(minutes(p.start), minutes(p.end), r.id) for p in r.periods if p.on_date == day.isoformat()]
    return merge(spans)


@dataclass
class Compiled:
    door: str
    zone: str
    weekly: dict[int, list[Span]]                    # sun0 weekday -> spans
    exceptions: dict[str, list[Span]]                # date -> spans (replaces the weekday, R)
    rules: tuple[str, ...]
    errors: list[str] = field(default_factory=list)
    policy: dict[str, Any] | None = None
    sha: str | None = None
    once_rules: frozenset[str] = frozenset()
    event_rules: frozenset[str] = frozenset()

    def spans_on(self, day: dt.date) -> list[Span]:
        return self.exceptions.get(day.isoformat(), self.weekly.get(sun0(day), []))


def program_name(relay: int) -> str:
    return f"{dwe.ARX_PREFIX}windows r{relay}"[: dwe.NAME_MAX]


def policy_sha(policy: dict[str, Any] | None) -> str | None:
    if policy is None:
        return None
    return hashlib.sha256(json.dumps(policy, sort_keys=True, ensure_ascii=False).encode("utf-8")).hexdigest()


def compile_door(rules: list[RuleDoc], door: Door, calendar: dict[str, str], today: dt.date, *, max_per_day: int = MAX_PERIODS_PER_DAY,
                 horizon: int = HORIZON_DAYS, excluded: frozenset[str] = frozenset()) -> Compiled:
    """The door's program: the weekly union of its weekly rules, plus a date exception for every date in [today, today+horizon] whose
    periods differ from that union (a special day, a one-off window, a closed day). `policy` is None when no rule covers the door."""
    mine = [r for r in rules if (door.station_id, door.relay) in r.doors]
    # an event rule is only a definition; what reaches the program is its running HOLDS (synthetic rules of kind 'event' carrying periods)
    holds = [r for r in mine if r.kind == "event" and r.periods]
    mine = [r for r in mine if r.kind != "event" or r.periods]
    c = Compiled(door.key, door.zone, {}, {}, tuple(r.id for r in mine), once_rules=frozenset(r.id for r in mine if r.kind == "once"),
                 event_rules=frozenset(r.id for r in holds))
    if not mine:
        return c
    weekly_rules = [r for r in mine if r.kind == "weekly"]
    for wd in range(7):
        spans = merge((minutes(p.start), minutes(p.end), r.id) for r in weekly_rules for p in r.periods if p.weekday == wd)
        if spans:
            c.weekly[wd] = spans
    dates = {d for d in calendar if today.isoformat() <= d <= (today + dt.timedelta(days=horizon)).isoformat()}
    dates |= {p.on_date for r in mine if r.kind in ("once", "event") for p in r.periods if p.on_date and p.on_date >= today.isoformat()}
    dates |= {t.split("/")[0] for t in excluded if today.isoformat() <= t.split("/")[0] <= (today + dt.timedelta(days=horizon)).isoformat()}
    for d in sorted(dates):
        day = dt.date.fromisoformat(d)
        spans = [sp for sp in day_spans(mine, day, calendar.get(d)) if window_token(day, sp[0], sp[1]) not in excluded]  # W-01: a cancelled window is not in the program
        if [(s, e) for s, e, _ in spans] != [(s, e) for s, e, _ in c.weekly.get(sun0(day), [])]:
            c.exceptions[d] = spans
    cap = min(max_per_day, MAX_PERIODS_PER_DAY)
    if any(len(v) > cap for v in c.weekly.values()) or any(len(v) > cap for v in c.exceptions.values()):
        c.errors.append("too_many_per_day")
    if len(c.exceptions) > MAX_EXCEPTIONS:
        c.errors.append("too_many_exceptions")
    if c.errors:
        return c
    c.policy = {"timezone": door.zone, "schedule": {
        "name": program_name(door.relay),
        "weekly": {wiskey_day(wd): [{"start": hm_of(s), "end": hm_of(e)} for s, e, _ in c.weekly.get(wd, [])] for wd in range(7)},
        "holidays": [{"name": _exception_name(calendar.get(d)), "start": d, "end": d, "periods": [{"start": hm_of(s), "end": hm_of(e)} for s, e, _ in spans]}
                     for d, spans in sorted(c.exceptions.items())],
    }}
    c.sha = policy_sha(c.policy)
    return c


def _exception_name(day_type: str | None) -> str:
    return {"holiday": "Arx holiday", "holiday_eve": "Arx holiday eve", "closed": "Arx closed", "regular": "Arx regular"}.get(day_type or "", "Arx one-off")


def window_token(day: dt.date, start_m: int, end_m: int) -> str:
    """WisKey's `hold_open.window` token: 'YYYY-MM-DD/HH:MM/HH:MM' (the local date and the period's wall-clock bounds)."""
    return f"{day.isoformat()}/{hm_of(start_m)}/{hm_of(end_m)}"


@dataclass(frozen=True)
class Planned:
    start_at: dt.datetime
    end_at: dt.datetime
    token: str
    rule_id: str
    origin: str


def plan(compiled: Compiled, first: dt.date, days: int = PLAN_DAYS) -> list[Planned]:
    """The concrete occurrences of the compiled program on local dates [first, first+days): each span resolved by `wall_instant` in the
    door's zone (the token semantics). A span that falls entirely inside a spring-forward gap does not exist and is skipped."""
    if compiled.policy is None:
        return []
    tz = ZoneInfo(compiled.zone)
    out = []
    for i in range(days):
        day = first + dt.timedelta(days=i)
        for s, e, rids in compiled.spans_on(day):
            start_at, end_at = wall_instant(day, hm_of(s), tz), wall_instant(day, hm_of(e), tz)
            if end_at <= start_at:
                continue
            origin = "event" if all(r in compiled.event_rules for r in rids) else ("once" if all(r in compiled.once_rules for r in rids) else "weekly")
            out.append(Planned(start_at, end_at, window_token(day, s, e), rids[0], origin))
    return out


def preview(conn: sqlite3.Connection, body: dict[str, Any], now: dt.datetime, *, days: int = 7) -> dict[str, Any]:
    """The compiled occurrences of a rule body for the next `days` days, per door, without saving (CR-039 10.1 "preview first")."""
    known = doors_by_key(conn)
    zone0 = installation_zone(conn)
    today = local_date(now, ZoneInfo(zone0))
    name, kind, policy, notes, doors_, periods = validate_rule(
        body, max_hours=int_setting(conn, "doors.windows.max_hours"), max_per_day=int_setting(conn, "doors.windows.max_per_day_per_door"),
        quiet=(setting(conn, "doors.windows.quiet_from"), setting(conn, "doors.windows.quiet_to")), today=today)
    rule = RuleDoc("preview", name, kind, "enabled", policy, tuple(doors_), tuple(periods))
    out = []
    for sid, relay in doors_:
        door = known.get(door_key(sid, relay)) or Door(sid, relay, f"דלת {relay}", "", zone0)
        tz = ZoneInfo(door.zone)
        first = local_date(now, tz)
        c = compile_door([rule], door, calendar_for(conn, sid, first, HORIZON_DAYS), first)
        out.append({"door": door.key, "label": door.label, "zone": door.zone, "errors": c.errors,
                    "occurrences": [{"start_at": iso(p.start_at), "end_at": iso(p.end_at), "token": p.token} for p in plan(c, first, days) if p.end_at > now]})
    return {"doors": out, "tier": dwe.window_engine(None).tier if enabled(conn) else "prepared"}


# ---------------------------------------------------------------- occurrences

OCC_STATES = ("prepared", "planned", "armed", "starting", "active", "not_started", "ending", "relock_unconfirmed", "closed_confirmed",
              "cancelled", "superseded", "elapsed")
OPEN_STATES = ("planned", "armed", "starting", "active", "not_started", "ending", "relock_unconfirmed")  # the watchdog judges these
TERMINAL = ("closed_confirmed", "cancelled", "superseded", "elapsed")


def occurrence_row(conn: sqlite3.Connection, occ_id: str) -> sqlite3.Row | None:
    return conn.execute("SELECT * FROM door_window_occurrences WHERE id = ?", (occ_id,)).fetchone()


def door_blocked(conn: sqlite3.Connection, station_id: str, relay: int, now: dt.datetime) -> str | None:
    """Why the door's program may not be (re-)enabled now: SR-5 (a relock not confirmed), an override / emergency pause, or an emergency
    incident in effect on the door."""
    if conn.execute("SELECT 1 FROM door_window_occurrences WHERE station_id = ? AND relay = ? AND state = 'relock_unconfirmed'", (station_id, relay)).fetchone():
        return "relock_unconfirmed"
    row = conn.execute("SELECT paused_until FROM door_window_engine WHERE station_id = ? AND relay = ?", (station_id, relay)).fetchone()
    if row is not None and row["paused_until"] and row["paused_until"] > iso(now):
        return "paused"
    if conn.execute("""SELECT 1 FROM door_emergency_doors d JOIN door_emergency_incidents i ON i.id = d.incident_id
                       WHERE d.station_id = ? AND d.relay = ? AND d.phase = 'apply' AND i.drill = 0
                         AND i.state IN ('applying','in_effect','in_effect_partial','releasing')""", (station_id, relay)).fetchone():
        return "emergency"
    return None


def _store_plan(conn: sqlite3.Connection, door: Door, planned: list[Planned], tier: str, written: bool, now: dt.datetime) -> None:
    """Insert new occurrences, arm the planned ones once the engine holds the program, cancel future ones that left the plan. Started
    occurrences are never touched here (the watchdog owns them)."""
    at = iso(now)
    tokens = {p.token for p in planned}
    future = conn.execute("""SELECT id, token, state FROM door_window_occurrences WHERE station_id = ? AND relay = ? AND start_at > ?
                             AND state IN ('prepared','planned','armed')""", (door.station_id, door.relay, at)).fetchall()
    for r in future:
        if r["token"] not in tokens:
            conn.execute("UPDATE door_window_occurrences SET state = 'cancelled', updated_at = ? WHERE id = ?", (at, r["id"]))
        elif tier == "program" and written and r["state"] == "planned":
            conn.execute("UPDATE door_window_occurrences SET state = 'armed', updated_at = ? WHERE id = ?", (at, r["id"]))
    for p in planned:
        if p.end_at <= now:
            continue
        state = "prepared" if tier == "prepared" else ("armed" if written else "planned")
        conn.execute("""INSERT INTO door_window_occurrences(id, rule_id, station_id, relay, start_at, end_at, zone, token, origin, tier, state, created_at, updated_at)
                        VALUES (?, (SELECT id FROM door_window_rules WHERE id = ?), ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                        ON CONFLICT(station_id, relay, token) DO NOTHING""",
                     (new_id(), p.rule_id, door.station_id, door.relay, iso(p.start_at), iso(p.end_at), door.zone, p.token,
                      p.origin, tier, state, at, at))
        # an occurrence cancelled earlier whose window came back (a rule re-enabled) is planned again, if it has not started
        conn.execute("""UPDATE door_window_occurrences SET state = ?, tier = ?, updated_at = ? WHERE station_id = ? AND relay = ? AND token = ?
                        AND state = 'cancelled' AND start_at > ? AND COALESCE(resolution, '') <> 'override'""", (state, tier, at, door.station_id, door.relay, p.token, at))


# ---------------------------------------------------------------- the sync: rules -> compile -> engine -> plan

@dataclass
class DoorWork:
    door: Door
    compiled: Compiled
    blocked: str | None
    written_sha: str | None
    foreign: bool
    row: dict[str, Any] | None = None  # the door's `door_window_engine` row as read before the engine I/O (DOORWRITE-297 write state)


def _engine_row(conn: sqlite3.Connection, station_id: str, relay: int) -> sqlite3.Row | None:
    return conn.execute("SELECT * FROM door_window_engine WHERE station_id = ? AND relay = ?", (station_id, relay)).fetchone()


def _upsert_engine(conn: sqlite3.Connection, door: Door, tier: str, **fields: Any) -> None:
    conn.execute("INSERT INTO door_window_engine(station_id, relay, tier) VALUES (?, ?, ?) ON CONFLICT(station_id, relay) DO UPDATE SET tier = excluded.tier",
                 (door.station_id, door.relay, tier))
    if fields:
        conn.execute(f"UPDATE door_window_engine SET {', '.join(f'{k} = ?' for k in fields)} WHERE station_id = ? AND relay = ?",
                     (*fields.values(), door.station_id, door.relay))


def _write_program(engine: dwe.WindowEngine, door: Door, compiled: Compiled) -> tuple[str, int | None, str]:
    """Make the engine hold `compiled.policy` (or no enabled Arx program when it is None). Read first, always: an earlier unknown outcome
    is settled by this read (CR-039 4.3: never a blind second save). Returns (outcome, revision, code); outcome in written | paused |
    unchanged | foreign | nothing | readback_mismatch.

    DOORWRITE-297: "written" now means written AND proven by read-back - the save's own listing, or (when that listing does not show the
    program as written) one fresh read. A save that the engine accepted but whose read-back differs is `readback_mismatch` (never "written"),
    and the next attempt starts again from a read. "unchanged" compares the canonical form (dwp.holds), not the raw JSON."""
    from . import door_window_program as dwp

    st = engine.read(door.station_id, door.relay)
    if st.exists and not st.arx:
        return "foreign", st.revision, "foreign_program"
    if compiled.policy is None:
        if st.exists and (st.enabled or st.owned):
            st = engine.pause(door.station_id, door.relay, st.revision)
            return "paused", st.revision, ""
        return "nothing", st.revision if st.exists else None, ""
    if dwp.holds(st, compiled.policy):
        return "unchanged", st.revision, ""
    revision = st.revision if st.exists else 0
    if st.exists and (st.enabled or st.owned):  # WisKey refuses an edit of an enabled program (W0 finding 1): pause, then save-and-activate
        revision = engine.pause(door.station_id, door.relay, revision).revision
    st = engine.save(door.station_id, door.relay, revision, compiled.policy, True)
    if dwp.holds(st, compiled.policy):
        return "written", st.revision, ""
    st = engine.read(door.station_id, door.relay)  # the save's listing did not prove it: one fresh read decides
    if dwp.holds(st, compiled.policy):
        return "written", st.revision, ""
    return "readback_mismatch", st.revision if st.exists else None, "readback_mismatch"


def _load_sync_rules(conn: sqlite3.Connection, now: dt.datetime) -> tuple[list[RuleDoc], set[str]]:
    """The enabled, still-approved rules plus the running event holds (none while the master switch is off), and the stale rule ids."""
    on = enabled(conn)
    rules = load_rules(conn) if on else []
    stale = set(stale_approvals(conn, rules)) if rules else set()
    rules = [r for r in rules if r.id not in stale]
    if on:  # the running event holds join the compile as one-off periods of synthetic rules (a hold is a plan row until it ends)
        from . import door_window_triggers as dwt

        rules = rules + dwt.running_holds(conn, now)
    return rules, stale


def _compose(conn: sqlite3.Connection, rules: list[RuleDoc], now: dt.datetime, only: set[str] | None = None) -> list[DoorWork]:
    """Compose the weekly program of every door that has a rule, an engine row or a pending occurrence (or only the `only` doors)."""
    known = doors_by_key(conn)
    keys = {door_key(s, r) for rule in rules for s, r in rule.doors}
    keys |= {door_key(r["station_id"], r["relay"]) for r in conn.execute("SELECT station_id, relay FROM door_window_engine")}
    keys |= {door_key(r["station_id"], r["relay"]) for r in conn.execute(
        "SELECT DISTINCT station_id, relay FROM door_window_occurrences WHERE state IN ('prepared','planned','armed')")}
    if only is not None:
        keys = set(only)
    work: list[DoorWork] = []
    for key in sorted(keys):
        station_id, relay = key.rsplit(":", 1)
        door = known.get(key) or Door(station_id, int(relay), f"דלת {relay}", "", installation_zone(conn))
        first = local_date(now, ZoneInfo(door.zone))
        compiled = compile_door(rules, door, calendar_for(conn, door.station_id, first, HORIZON_DAYS), first,
                                max_per_day=int_setting(conn, "doors.windows.max_per_day_per_door"), excluded=exclusions_of(conn, door.station_id, door.relay, first))
        row = _engine_row(conn, door.station_id, door.relay)
        work.append(DoorWork(door, compiled, door_blocked(conn, door.station_id, door.relay, now), row["written_sha256"] if row else None,
                             bool(row["foreign_program"]) if row else False, dict(row) if row else None))
    return work


# write states after which the engine may still hold an enabled Arx program although `written_sha256` is NULL: when the desired program
# becomes "none" (switch off, rules removed) such a door is read and paused, never skipped as "nothing" (the close direction)
UNSETTLED_WRITE_STATES = ("drift", "retry_wait", "failed")


def _hold_reason(w: DoorWork, now: dt.datetime) -> str | None:
    """DOORWRITE-297: why the sync must not try this door's write in this pass (None: it may). Only an OPEN-direction write is held - a door
    whose desired program is "none" (switch off, rules removed) is always paused, whatever its write state (the close direction)."""
    row = w.row or {}
    if w.compiled.policy is None:
        return None
    if row.get("drift_at"):
        return "drift"  # a person must look first (the program may have been paused on purpose in the intercom window)
    if row.get("write_state") == "failed" and row.get("compiled_sha256") == w.compiled.sha:
        return "failed"  # the attempts for this document are used up; a new document starts a new cycle
    if row.get("next_attempt_at") and row["next_attempt_at"] > iso(now):
        return "retry_wait"
    return None


def _check_drift(engine: dwe.WindowEngine, w: DoorWork, now: dt.datetime) -> tuple[str, str]:
    """An unchanged door whose last proof is older than DRIFT_CHECK_S is re-read. Returns (outcome, code): unchanged (no read due),
    verified (the read proves it), drift (code = drift kind), or unchanged with code read_failed (a failed read proves nothing either way)."""
    from . import door_window_program as dwp

    row = w.row or {}
    last = row.get("verified_at")
    if last and parse_iso(last) > now - dt.timedelta(seconds=dwp.DRIFT_CHECK_S):
        return "unchanged", ""
    try:
        st = engine.read(w.door.station_id, w.door.relay)
    except dwe.EngineError:
        return "unchanged", "read_failed"
    kind = dwp.drift_of(st, w.compiled.policy)
    return ("drift", kind) if kind else ("verified", "")


def sync(db: Database, settings: Any, now: dt.datetime, *, actor: str = "system:door_windows", only: set[str] | None = None) -> dict[str, Any]:
    """One compile pass over every door that has an enabled rule or an Arx program record (or only the `only` door keys). Engine I/O happens
    outside the write lock. With the master switch off the desired program of every door is "none": an Arx program that was written is
    paused (switching off never leaves a door scheduled open), and future occurrences are cancelled.

    DOORWRITE-297 adds, per door: Arx-side validation before any send (`invalid`, nothing sent), read-back proof of every write, a periodic
    drift check of doors believed written, and bounded retries (retry_wait -> failed) with the write state kept on the engine row."""
    from . import door_window_program as dwp

    engine = dwe.window_engine(settings)
    refresh_foreign_paused(db, settings, now)
    with db.connection(mode="read") as conn:
        rules, stale = _load_sync_rules(conn, now)
        work = _compose(conn, rules, now, only)
    results: dict[str, Any] = {"stale_rules": sorted(stale), "doors": {}}
    outcomes: list[tuple[DoorWork, str, int | None, str]] = []
    for w in work:
        if engine.tier != "program" or w.blocked or w.compiled.errors:
            outcomes.append((w, "skipped" if engine.tier == "program" else "prepared", None, w.blocked or ",".join(w.compiled.errors)))
            continue
        held = _hold_reason(w, now)
        if held:
            outcomes.append((w, "held", None, held))
            continue
        if w.compiled.sha == w.written_sha and w.compiled.sha is not None:
            outcome, code = _check_drift(engine, w, now)
            outcomes.append((w, outcome, None, code))
            continue
        if w.compiled.sha is None and w.written_sha is None and (w.row or {}).get("write_state") not in UNSETTLED_WRITE_STATES:
            outcomes.append((w, "nothing", None, ""))
            continue
        invalid =dwp.validate_policy(w.compiled.policy, station_id=w.door.station_id, relay=w.door.relay) if w.compiled.policy is not None else None
        if invalid:
            outcomes.append((w, "invalid", None, invalid))
            continue
        try:
            outcome, revision, code = _write_program(engine, w.door, w.compiled)
        except dwe.EngineError as exc:
            outcome, revision, code = "error", None, f"{exc.kind}:{exc.code}"
        outcomes.append((w, outcome, revision, code))
    at = iso(now)
    with db.connection() as conn:
        conn.execute("DELETE FROM door_window_exclusions WHERE token < ?", ((now - dt.timedelta(days=3)).date().isoformat(),))
        for rid in stale:
            conn.execute("UPDATE door_window_rules SET state = 'paused', updated_by = ?, updated_at = ? WHERE id = ? AND state = 'enabled'", (actor, at, rid))
            audit(conn, actor=None, action="door.window.rule_paused", decision="allowed", resource_type="door_window_rule", resource_id=rid, reason="approval_stale")
        for w, outcome, revision, code in outcomes:
            tier = engine.tier
            row = w.row or {}
            fields: dict[str, Any] = {"compiled_sha256": w.compiled.sha}
            written = False
            version = None
            if outcome == "written":
                version = int(row.get("program_version") or 0) + 1
                fields.update(written_sha256=w.compiled.sha, written_at=at, written_by=actor, foreign_program=0, last_error=None, write_state="verified",
                              write_attempts=0, next_attempt_at=None, verified_at=at, drift_at=None, drift_kind=None, program_version=version)
                if revision is not None:
                    fields["program_revision"] = revision
                written = True
            elif outcome in ("unchanged", "verified"):
                fields.update(written_sha256=w.compiled.sha, foreign_program=0, last_error=None, write_state="verified")
                if outcome == "verified" or (outcome == "unchanged" and row.get("written_sha256") != w.compiled.sha):
                    fields.update(written_at=at, written_by=actor, verified_at=at)  # (an "unchanged" from a write pass: the read proved it)
                if revision is not None:
                    fields["program_revision"] = revision
                written = True
            elif outcome in ("paused", "nothing"):
                fields.update(written_sha256=None, written_at=at, written_by=actor, foreign_program=0, last_error=None, program_revision=revision,
                              write_state="idle", write_attempts=0, next_attempt_at=None, drift_at=None, drift_kind=None)
            elif outcome == "foreign":
                fields.update(foreign_program=1, last_error="foreign_program", written_sha256=None, write_state="foreign", write_attempts=0, next_attempt_at=None)
            elif outcome == "drift":
                # never corrected automatically: future occurrences fall back to `planned` (the engine no longer holds them), the watchdog
                # keeps judging them (a window that does not start is `not_started`: the safe direction, with an alert)
                fields.update(written_sha256=None, write_state="drift", drift_at=at, drift_kind=code, last_error=f"drift:{code}")
                conn.execute("UPDATE door_window_occurrences SET state = 'planned', updated_at = ? WHERE station_id = ? AND relay = ? AND state = 'armed' AND start_at > ?",
                             (at, w.door.station_id, w.door.relay, at))
            elif outcome == "invalid":
                fields.update(write_state="invalid", last_error=f"invalid:{code}"[:64])
                written = w.written_sha is not None and w.written_sha == w.compiled.sha
            elif outcome in ("error", "readback_mismatch"):
                attempts = int(row.get("write_attempts") or 0) + 1
                kind = code.split(":", 1)[0] if outcome == "error" else "unknown"
                nxt = dwp.next_attempt_at(attempts, now) if dwp.retryable(kind) else None
                fields.update(last_error=code[:64], written_sha256=None, write_attempts=attempts,  # unknown: settled by the next pass's read
                              write_state="retry_wait" if nxt is not None else "failed", next_attempt_at=iso(nxt) if nxt is not None else None)
            elif outcome == "held":
                written = w.written_sha is not None and w.written_sha == w.compiled.sha
            elif outcome == "skipped":
                written = w.written_sha is not None and w.written_sha == w.compiled.sha
                fields.update(last_error=code[:64] or None, write_state="blocked" if w.blocked else "invalid")
            elif outcome == "prepared":
                fields["write_state"] = "prepared"
            _upsert_engine(conn, w.door, tier, **fields)
            if outcome in ("written", "paused", "foreign", "error", "readback_mismatch", "invalid"):
                state = fields.get("write_state")
                audit(conn, actor=None, action="door.window.engine_write", decision="allowed" if outcome in ("written", "paused") else "failed",
                      resource_type="door", resource_id=w.door.key, reason=outcome,
                      details={"tier": tier, "outcome": outcome, "code": code[:64] or None, "revision": revision, "compiled_sha": (w.compiled.sha or "")[:16] or None,
                               "version": version, "write_state": state, "attempts": fields.get("write_attempts")})
            elif outcome == "drift":
                audit(conn, actor=None, action="door.window.program_drift", decision="failed", resource_type="door", resource_id=w.door.key, reason=code,
                      details={"tier": tier, "drift_kind": code, "compiled_sha": (w.compiled.sha or "")[:16] or None, "version": row.get("program_version")})
            planned = plan(w.compiled, local_date(now, ZoneInfo(w.door.zone)) - dt.timedelta(days=1), PLAN_DAYS + 1)
            _store_plan(conn, w.door, planned, tier, written, now)
            results["doors"][w.door.key] = {"outcome": outcome, "code": code, "errors": w.compiled.errors}
    return results


# ---------------------------------------------------------------- DOORWRITE-297: the per-door program view, the dry run, "write again"

def program_view(row: Any) -> dict[str, Any]:
    """The door's write state for the screen: state, one Hebrew sentence, version, last proof, drift and retry facts. Ids and codes stay
    server-side except `state` / `drift_kind` (enumerations the screen may style)."""
    from . import door_window_program as dwp

    r = dict(row) if row is not None else {}
    state = r.get("write_state") or ("prepared" if r.get("tier") == "prepared" else "idle")
    return {"state": state, "message": dwp.message_he(state, r.get("last_error"), r.get("drift_kind")), "version": int(r.get("program_version") or 0),
            "verified_at": r.get("verified_at"), "drift_kind": r.get("drift_kind"), "drift_at": r.get("drift_at"), "attempts": int(r.get("write_attempts") or 0),
            "next_attempt_at": r.get("next_attempt_at"), "revision": r.get("program_revision")}


def _summary(policy: dict[str, Any] | None) -> dict[str, Any] | None:
    if policy is None:
        return None
    sched = policy.get("schedule") or {}
    return {"timezone": policy.get("timezone"), "name": sched.get("name"),
            "weekly": {d: [f"{p['start']}-{p['end']}" for p in (sched.get("weekly") or {}).get(d, [])] for d in WISKEY_DAYS},
            "exceptions": len(sched.get("holidays") or []),
            "next_exceptions": [{"date": h["start"], "periods": [f"{p['start']}-{p['end']}" for p in h["periods"]]} for h in (sched.get("holidays") or [])[:10]]}


def program_preview(db: Database, settings: Any, station_id: str, relay: int, now: dt.datetime) -> dict[str, Any]:
    """The dry run of one door's write (CR-039 10.1 "preview first"): the program Arx would write, whether it is valid, what the engine holds
    now (one READ when the tier is `program`; nothing in tier D) and the action the next write would take. Writes NOTHING - not to the engine,
    not to the database. `action`: prepared | blocked | invalid | held | foreign | nothing | pause | unchanged | write.
    `two_writes`: the program must be paused first (an enabled program); `in_window`: the engine holds the door open now, so the write closes
    it and re-opens it within ~15 s (the confirmation sentence says so, CR-039 4.3)."""
    from . import door_window_program as dwp

    engine = dwe.window_engine(settings)
    key = door_key(station_id, relay)
    with db.connection(mode="read") as conn:
        rules, _ = _load_sync_rules(conn, now)
        w = _compose(conn, rules, now, {key})[0]
        on = enabled(conn)
    policy = w.compiled.policy
    invalid = dwp.validate_policy(policy, station_id=station_id, relay=relay) if policy is not None else None
    out: dict[str, Any] = {
        "door": key, "label": w.door.label, "zone": w.door.zone, "enabled": on, "tier": engine.tier if on else "prepared",
        "sha": (w.compiled.sha or "")[:16] or None, "program": _summary(policy), "errors": list(w.compiled.errors), "invalid": invalid,
        "request_bytes": dwp.request_bytes(policy, station_id=station_id, relay=relay) if policy is not None else 0,
        "write": program_view(w.row), "current": None, "two_writes": False, "in_window": False, "dry_run": True,
    }
    if engine.tier != "program" or not on:
        out["action"] = "prepared"
    elif w.blocked:
        out["action"], out["reason"] = "blocked", w.blocked
    elif w.compiled.errors or invalid:
        out["action"] = "invalid"
    elif _hold_reason(w, now):
        out["action"], out["reason"] = "held", _hold_reason(w, now)
    else:
        try:
            st = engine.read(station_id, relay)
        except dwe.EngineError as exc:
            out["action"], out["reason"] = "unreadable", exc.kind
            return out
        out["current"] = {"exists": st.exists, "enabled": st.enabled, "revision": st.revision, "arx": st.arx, "status": st.status,
                          "matches": dwp.holds(st, policy) if policy is not None else False}
        if st.exists and not st.arx:
            out["action"] = "foreign"
        elif policy is None:
            out["action"] = "pause" if st.exists and (st.enabled or st.owned) else "nothing"
        elif dwp.holds(st, policy):
            out["action"] = "unchanged"
        else:
            out["action"] = "write"
            out["two_writes"] = st.exists and (st.enabled or st.owned)
            out["in_window"] = st.exists and (st.owned or st.status in ("opening", "held_acknowledged"))
    return out


def write_again(db: Database, settings: Any, station_id: str, relay: int, now: dt.datetime, *, actor: str) -> dict[str, Any]:
    """A person's "write again" for one door: clears the door's drift / failed / retry wait and runs the sync for that door only (read first,
    pause-then-save when needed, read-back proof). Returns the door's sync result plus its new write state."""
    with db.connection() as conn:
        conn.execute("""UPDATE door_window_engine SET drift_at = NULL, drift_kind = NULL, write_attempts = 0, next_attempt_at = NULL,
                        write_state = CASE WHEN write_state IN ('drift','failed','retry_wait') THEN NULL ELSE write_state END,
                        written_sha256 = NULL WHERE station_id = ? AND relay = ?""", (station_id, relay))
    key = door_key(station_id, relay)
    res = sync(db, settings, now, actor=actor, only={key})
    with db.connection(mode="read") as conn:
        row = _engine_row(conn, station_id, relay)
    return {"door": key, **res["doors"].get(key, {"outcome": "nothing", "code": "", "errors": []}), "write": program_view(row)}


def pause_door(db: Database, settings: Any, station_id: str, relay: int, until: str | None, *, why: str, allow_foreign: bool = False,
               incident_id: str | None = None) -> tuple[str, str]:
    """Pause the door's Arx program now (the close direction: an override, an emergency LOCK) and keep it paused until `until` (None: until
    the caller clears it). Returns (outcome, code). Engine I/O first, outside any write lock; the pause is recorded either way.

    `allow_foreign` is the ONE exception to "a program a person made in the intercom panel is never touched" (CR-039 8.2 / 19.3): an emergency
    LOCK pauses it too (outcome `paused_foreign`, audited with the incident). Arx never re-activates it: the door is listed as needing the person
    who made the program (`foreign_paused_list`) until the program is enabled again or a person marks it handled."""
    engine = dwe.window_engine(settings)
    outcome, code, revision = "prepared", "", None
    if engine.tier == "program":
        try:
            st = engine.read(station_id, relay)
            if st.exists and not st.arx:
                if allow_foreign and (st.enabled or st.owned):
                    revision = engine.pause(station_id, relay, st.revision).revision
                    outcome, code = "paused_foreign", "foreign_program"
                else:
                    outcome, code = "foreign", "foreign_program"  # a program a person made is never touched here (build notes 3.10)
            elif st.exists and (st.enabled or st.owned):
                revision = engine.pause(station_id, relay, st.revision).revision
                outcome = "paused"
            else:
                outcome = "nothing"
        except dwe.EngineError as exc:
            outcome, code = "error", f"{exc.kind}:{exc.code}"
    with db.connection() as conn:
        door = doors_by_key(conn).get(door_key(station_id, relay)) or Door(station_id, relay, "", "", installation_zone(conn))
        extra: dict[str, Any] = {"program_revision": revision} if revision is not None else {}
        if outcome == "paused_foreign":
            extra.update(foreign_paused_incident=incident_id or "", foreign_paused_at=iso(dt.datetime.now(UTC)), foreign_program=1)
        _upsert_engine(conn, door, engine.tier, paused_until=until or "9999-12-31T00:00:00Z", written_sha256=None, last_error=code[:64] or None, **extra)
        audit(conn, actor=None, action="door.window.engine_write", decision="allowed" if outcome in ("paused", "paused_foreign", "nothing", "prepared") else "failed",
              resource_type="door", resource_id=door_key(station_id, relay), reason=why,
              details={"outcome": outcome, "code": code[:64] or None, "why": why, **({"incident_id": incident_id} if incident_id else {})})
    return outcome, code


def foreign_paused_list(conn: sqlite3.Connection) -> list[dict[str, Any]]:
    """Doors whose foreign program an emergency LOCK paused and that nobody has re-activated yet (CR-039 19.3: the strip lists them after the release)."""
    return [{"door": door_key(r["station_id"], r["relay"]), "station_id": r["station_id"], "relay": r["relay"], "incident_id": r["foreign_paused_incident"] or None,
             "paused_at": r["foreign_paused_at"]}
            for r in conn.execute("SELECT station_id, relay, foreign_paused_incident, foreign_paused_at FROM door_window_engine WHERE foreign_paused_at IS NOT NULL "
                                  "ORDER BY foreign_paused_at")]


def clear_foreign_paused(conn: sqlite3.Connection, station_id: str, relay: int) -> bool:
    return conn.execute("UPDATE door_window_engine SET foreign_paused_incident = NULL, foreign_paused_at = NULL WHERE station_id = ? AND relay = ? AND foreign_paused_at IS NOT NULL",
                        (station_id, relay)).rowcount > 0


def refresh_foreign_paused(db: Database, settings: Any, now: dt.datetime) -> list[str]:
    """Doors listed as "foreign program paused by an emergency": once nothing blocks the door, read the program; if the person re-enabled it in
    the intercom panel the entry is cleared (Arx itself never re-activates it). Reads only; a read that fails keeps the entry."""
    engine = dwe.window_engine(settings)
    if engine.tier != "program":
        return []
    with db.connection(mode="read") as conn:
        pending = [(r["station_id"], r["relay"]) for r in foreign_paused_list(conn) if door_blocked(conn, r["station_id"], r["relay"], now) is None]
    cleared: list[str] = []
    for station_id, relay in pending:
        try:
            st = engine.read(station_id, relay)
        except dwe.EngineError:
            continue
        if st.exists and not st.arx and st.enabled:
            with db.connection() as conn:
                if clear_foreign_paused(conn, station_id, relay):
                    audit(conn, actor=None, action="door.window.foreign_reactivated", decision="allowed", resource_type="door", resource_id=door_key(station_id, relay),
                          reason="program_enabled_again")
                    cleared.append(door_key(station_id, relay))
    return cleared


def exclusions_of(conn: sqlite3.Connection, station_id: str, relay: int, first: dt.date) -> frozenset[str]:
    """The window tokens a guard cancelled before they started (W-01), from the day before `first` on; older rows are pruned by `sync`."""
    return frozenset(r["token"] for r in conn.execute("SELECT token FROM door_window_exclusions WHERE station_id = ? AND relay = ? AND token >= ?",
                                                      (station_id, relay, (first - dt.timedelta(days=1)).isoformat())))


def clear_pause(conn: sqlite3.Connection, station_id: str, relay: int) -> None:
    conn.execute("UPDATE door_window_engine SET paused_until = NULL WHERE station_id = ? AND relay = ?", (station_id, relay))


# ---------------------------------------------------------------- the background worker (sync every few minutes, watchdog every tick)

class Worker:
    """One thread: the watchdog every `TICK_S` (services/door_windows_watch.watch), the compile every `SYNC_S` or when woken, the
    emergency retries (services/door_emergency.retry_tick). Everything it does is idle while nothing is planned. SW_DOORWIN_WORKER=0 keeps
    it off (tests call the functions with explicit instants)."""

    TICK_S = 15.0
    SYNC_S = 300.0

    def __init__(self) -> None:
        self._wake = threading.Event()
        self._stop = threading.Event()
        self._thread: threading.Thread | None = None
        self._last_sync = 0.0
        self._sync_now = True

    def wake(self, *, sync: bool = True) -> None:
        self._sync_now = self._sync_now or sync
        self._wake.set()

    def start(self, db: Database, settings: Any) -> None:
        if self._thread is not None and self._thread.is_alive():
            return
        self._stop.clear()
        self._thread = threading.Thread(target=self._run, args=(db, settings), name="door-windows", daemon=True)
        self._thread.start()

    def stop(self) -> None:
        self._stop.set()
        self._wake.set()
        if self._thread is not None:
            self._thread.join(timeout=5.0)

    def run_once(self, db: Database, settings: Any, now: dt.datetime | None = None, *, force_sync: bool = False) -> None:
        from . import door_emergency, door_windows_watch

        now = now or dt.datetime.now(UTC)
        if force_sync or self._sync_now or time.monotonic() - self._last_sync >= self.SYNC_S:
            self._sync_now = False
            self._last_sync = time.monotonic()
            sync(db, settings, now)
        door_windows_watch.watch(db, settings, now)
        door_emergency.retry_tick(db, settings, now)
        from . import door_engine_live

        door_engine_live.tick(db, now)  # DOORLIVE-2310: no contact with the access system during an incident -> a notice (reads and notifies only)

    def _run(self, db: Database, settings: Any) -> None:
        while not self._stop.is_set():
            try:
                self.run_once(db, settings)
            except Exception:  # noqa: BLE001 - one failing pass never ends the watchdog
                log.exception("door windows pass failed")
            self._wake.wait(self.TICK_S)
            self._wake.clear()


WORKER = Worker()
