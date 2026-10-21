"""CR-039 9 / DOORWIN2-295 (slice W4): event-triggered door windows - "when X happens, hold this door open for N minutes".

Three sources start the same object, an event OCCURRENCE (origin `event`, a plan row like any other window):
- `arx_button`   a person's confirmed click on a door ("open for N hours", routers/door_windows.py): audited as the person, needs
                 `access.windows.manage` on the door; no rule, no token, never simulated;
- `ha_event`     any Home Assistant automation fires the custom event `smplwise_arx_door_window` with `{rule_id, token}`: the rule's secret token
                 (shown once, stored as SHA-256 only), its allowed hours, caps and cooldown decide;
- `arx_automation` an Arx automation (the HA entity is named in the trigger) ran: matched to the rule by its entity id and the live revision
                 the approver saw.

SAFETY (CR-039 4.1, SR-1..SR-5, T4, T5, T16) - what is NOT here: this module never sends anything to a door or an engine. It writes plan rows
and a log; the compile (services/door_windows.sync) turns the running holds into a date exception of the door's program and the engine
(WisKey, tier B) holds and relocks; the watchdog confirms. An event never opens a door from an Arx timer.
- the authority at fire time is the rule's authorising actor (the person whose approval covers the live revision), re-checked every time for
  `access.windows.manage` on EVERY door of the rule; lost -> refused and listed;
- an `ha_event` / `arx_automation` rule is SIMULATED unless a person armed it AND `doors.automation_actor` is on AND the contract reports the W1
  automation actor (`door_windows.automation_actor_available`, False in this build): a simulated trigger writes a log row, an audit row and an
  inbox notice "this window would have opened" - no occurrence, nothing for the engine to hold;
- caps, all durable (counted from the trigger log / occurrences, they survive a restart): per door per day (the rule's `max_per_day` and the
  installation's `max_per_day_per_door` over every origin), `cooldown_s`, the allowed hours, the quiet hours, `doors.windows.max_hours`, no window
  across local midnight (WisKey's windows have no overnight period), no window on a `closed` day, and an installation-wide storm cap of
  STORM_PER_HOUR starts per hour (refused + a `door.windows.storm` alert);
- never while the door's previous occurrence is `relock_unconfirmed` (SR-5), under an override pause, or under an emergency incident;
- a trigger that falls inside / touching another window is refused, except a second event touching a not-yet-running event hold, which EXTENDS
  it once; extending a RUNNING hold makes the program blink (~15 s), so it is refused unless `doors.windows.event_extend_owned` is on;
- one delivery of one event is one trigger (Home Assistant may redeliver: the context id is the key).

Times: the hold starts at the next whole minute at least LEAD_S seconds away (WisKey's window token has minute resolution and the compile must
reach the engine before the window starts - a window that starts before it was written is `not_started`, the safe direction).
"""
from __future__ import annotations

import collections
import datetime as dt
import hashlib
import hmac
import logging
import re
import secrets
import sqlite3
import threading
import time
from concurrent.futures import ThreadPoolExecutor
from typing import Any
from zoneinfo import ZoneInfo

from ..audit import audit
from ..db import Database, new_id
from ..errors import ApiError
from ..rbac import Principal
from . import door_windows as dw
from . import door_windows_engine as dwe

log = logging.getLogger("smplwise.doors")

EVENT_TYPE = "smplwise_arx_door_window"
SOURCES = ("arx_automation", "ha_event")
ALL_SOURCES = ("arx_button", *SOURCES)
MANUAL = "button"                       # the synthetic rule id of a person's one-off hold (stored as rule_id NULL)
LEAD_S = 20
STORM_PER_HOUR = 20
MIN_DURATION_S = 60
AUTOMATION_RE = re.compile(r"^automation\.[a-z0-9_]{1,80}$")
HOLD_STATES = ("prepared", "planned", "armed", "starting", "active")             # a hold that still feeds the compile
LIVE_STATES = ("prepared", "planned", "armed", "starting", "active", "not_started", "ending", "relock_unconfirmed")
EXTENDABLE_BEFORE_START = ("prepared", "planned", "armed")
RUNNING = ("starting", "active")


# ---------------------------------------------------------------- the trigger definition (rule editor)

def validate_trigger(raw: Any, *, max_hours: int, max_per_day: int, quiet: tuple[str, str]) -> dict[str, Any]:
    """The cleaned trigger of an `event` rule body, or 422. SR-2: the length is bounded by `max_hours`; the allowed hours are one daily range."""
    def bad(code: str, text: str, **details: Any) -> ApiError:
        return ApiError(422, code, text, details=details or None)

    if not isinstance(raw, dict):
        raise bad("invalid_trigger", "חסרה הגדרת האירוע.")
    source = raw.get("source")
    if source not in SOURCES:
        raise bad("invalid_trigger_source", "מקור האירוע לא תקין.")
    duration = raw.get("duration_s")
    if not isinstance(duration, int) or isinstance(duration, bool) or not MIN_DURATION_S <= duration <= max_hours * 3600:
        raise bad("invalid_duration", "משך החלון לא תקין או ארוך מהמותר.", max_hours=max_hours)
    duration = ((duration + 59) // 60) * 60
    frm, to = raw.get("allowed_from"), raw.get("allowed_to")
    if (frm in (None, "")) != (to in (None, "")):
        raise bad("invalid_allowed_hours", "יש להגדיר גם שעת התחלה וגם שעת סיום, או אף אחת.")
    if frm in (None, ""):
        frm = to = None
    else:
        if not dw.valid_hm(frm) or not dw.valid_hm(to, end=True) or dw.minutes(to) <= dw.minutes(frm):
            raise bad("invalid_allowed_hours", "טווח השעות המותר לא תקין (עד חצות בלבד).")
        if dw._touches_quiet(frm, to, quiet):
            raise bad("quiet_hours", "טווח השעות נוגע בשעות השקטות.", quiet_from=quiet[0], quiet_to=quiet[1])
    cap = raw.get("max_per_day", 1)
    if not isinstance(cap, int) or isinstance(cap, bool) or not 1 <= cap <= max_per_day:
        raise bad("invalid_cap", "מספר ההפעלות ליום לא תקין.", max=max_per_day)
    cooldown = raw.get("cooldown_s", 900)
    if not isinstance(cooldown, int) or isinstance(cooldown, bool) or not 0 <= cooldown <= 86400:
        raise bad("invalid_cooldown", "זמן ההמתנה בין הפעלות לא תקין.")
    out: dict[str, Any] = {"source": source, "duration_s": duration, "allowed_from_hm": frm, "allowed_to_hm": to, "max_per_day": cap, "cooldown_s": cooldown,
                           "automation_id": None, "regenerate_token": raw.get("regenerate_token") is True}
    if source == "arx_automation":
        auto = raw.get("automation_id")
        if not isinstance(auto, str) or not AUTOMATION_RE.match(auto):
            raise bad("invalid_automation", "יש לבחור אוטומציה.")
        out["automation_id"] = auto
    return out


def _live_revision(conn: sqlite3.Connection, entity_id: str) -> str | None:
    row = conn.execute("SELECT revision FROM ha_config_items WHERE kind = 'automation' AND entity_id = ?", (entity_id,)).fetchone()
    return row["revision"] if row is not None else None


def token_sha(token: str) -> str:
    return hashlib.sha256(token.encode("utf-8")).hexdigest()


def store_trigger(conn: sqlite3.Connection, principal: Principal, rule_id: str, trigger: dict[str, Any], *, created: bool) -> str | None:
    """Write the rule's trigger. Returns the NEW plaintext token (ha_event: on creation or when asked to regenerate) - shown once by the route,
    never stored, never audited. A save always returns the rule to `simulate`: an armed state covers the revision a person armed, not the next."""
    existing = conn.execute("SELECT * FROM door_window_triggers WHERE rule_id = ?", (rule_id,)).fetchone()
    token: str | None = None
    sha = existing["token_sha256"] if existing is not None else None
    set_at = existing["token_set_at"] if existing is not None else None
    revision = None
    if trigger["source"] == "ha_event":
        if sha is None or created or trigger["regenerate_token"] or (existing is not None and existing["source"] != "ha_event"):
            token = secrets.token_urlsafe(24)
            sha, set_at = token_sha(token), dw.iso(dt.datetime.now(dw.UTC))
    else:
        sha, set_at = None, None
        revision = _live_revision(conn, trigger["automation_id"])
        if revision is None:
            raise ApiError(422, "automation_unknown", "האוטומציה לא נמצאה.", details={"automation_id": trigger["automation_id"]})
    values = (trigger["source"], trigger["duration_s"], trigger["automation_id"], revision, sha, set_at, trigger["allowed_from_hm"], trigger["allowed_to_hm"],
              trigger["max_per_day"], trigger["cooldown_s"], principal.user_id)
    if existing is None:
        conn.execute("""INSERT INTO door_window_triggers(rule_id, source, duration_s, automation_id, item_revision, token_sha256, token_set_at, allowed_from_hm,
                        allowed_to_hm, max_per_day, cooldown_s, authorising_actor, arm_state) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'simulate')""", (rule_id, *values))
    else:
        conn.execute("""UPDATE door_window_triggers SET source = ?, duration_s = ?, automation_id = ?, item_revision = ?, token_sha256 = ?, token_set_at = ?,
                        allowed_from_hm = ?, allowed_to_hm = ?, max_per_day = ?, cooldown_s = ?, authorising_actor = ?, arm_state = 'simulate' WHERE rule_id = ?""",
                     (*values, rule_id))
    return token


def trigger_view(conn: sqlite3.Connection, rule_id: str) -> dict[str, Any] | None:
    """The trigger as the screen shows it: never the token (only whether one exists and when it was made)."""
    r = conn.execute("SELECT * FROM door_window_triggers WHERE rule_id = ?", (rule_id,)).fetchone()
    if r is None:
        return None
    return {"source": r["source"], "duration_s": r["duration_s"], "automation_id": r["automation_id"], "allowed_from": r["allowed_from_hm"],
            "allowed_to": r["allowed_to_hm"], "max_per_day": r["max_per_day"], "cooldown_s": r["cooldown_s"], "arm_state": r["arm_state"],
            "has_token": bool(r["token_sha256"]), "token_set_at": r["token_set_at"], "can_arm": dw.automation_actor_on(conn)}


def snippet(rule_id: str, token: str = "<TOKEN>") -> str:
    """The Home Assistant action that starts the window (CR-039 9.5): an event, never `lock.unlock`."""
    return f"event: {EVENT_TYPE}\nevent_data:\n  rule_id: \"{rule_id}\"\n  token: \"{token}\"\n"


def set_arm_state(conn: sqlite3.Connection, principal: Principal, rule_id: str, armed: bool) -> str:
    """Arm / disarm a rule. Arming needs the automation actor (fail closed, T16); the arming person becomes the authorising actor."""
    row = conn.execute("SELECT * FROM door_window_triggers WHERE rule_id = ?", (rule_id,)).fetchone()
    if row is None:
        raise ApiError(404, "not_found", "החלון לא נמצא.")
    if armed and not dw.automation_actor_on(conn):
        raise ApiError(409, "automation_actor_unavailable", "הפעלה מאוטומציה אינה זמינה: אין עדיין זהות אוטומציה מאומתת.")
    state = "armed" if armed else "simulate"
    conn.execute("UPDATE door_window_triggers SET arm_state = ?, authorising_actor = ? WHERE rule_id = ?", (state, principal.user_id, rule_id))
    return state


# ---------------------------------------------------------------- running holds -> the compile

def _token_parts(token: str) -> tuple[str, str, str]:
    day, start, end = token.split("/")
    return day, start, end


def running_holds(conn: sqlite3.Connection, now: dt.datetime) -> list[dw.RuleDoc]:
    """The event holds that are planned or running, as synthetic one-off rules (one per rule per door) so the existing compile turns them into a
    date exception of the door's program. Nothing about them is stored: they are rebuilt from the occurrence rows at every compile."""
    placeholders = ",".join("?" * len(HOLD_STATES))
    rows = conn.execute(f"SELECT * FROM door_window_occurrences WHERE origin = 'event' AND state IN ({placeholders}) AND end_at > ? ORDER BY start_at",
                        (*HOLD_STATES, dw.iso(now))).fetchall()
    grouped: dict[tuple[str, str, int], list[dw.Period]] = collections.defaultdict(list)
    for r in rows:
        day, start, end = _token_parts(r["token"])
        grouped[(r["rule_id"] or MANUAL, r["station_id"], r["relay"])].append(dw.Period(None, day, start, end))
    return [dw.RuleDoc(rid, "event", "event", "enabled", "ignore_calendar", ((sid, relay),), tuple(ps)) for (rid, sid, relay), ps in sorted(grouped.items())]


# ---------------------------------------------------------------- one door's decision

class Decision:
    __slots__ = ("door", "decision", "reason", "occurrence_id", "start_at", "end_at")

    def __init__(self, door: str, decision: str, reason: str | None = None, occurrence_id: str | None = None, start_at: str | None = None, end_at: str | None = None) -> None:
        self.door, self.decision, self.reason, self.occurrence_id, self.start_at, self.end_at = door, decision, reason, occurrence_id, start_at, end_at

    def as_dict(self) -> dict[str, Any]:
        return {"door": self.door, "decision": self.decision, "reason": self.reason, "occurrence_id": self.occurrence_id, "start_at": self.start_at, "end_at": self.end_at}


def _next_minute(now: dt.datetime) -> dt.datetime:
    t = now + dt.timedelta(seconds=LEAD_S)
    return t.replace(second=0, microsecond=0) + dt.timedelta(minutes=1) if (t.second or t.microsecond) else t


def _hm(at: dt.datetime, tz: ZoneInfo) -> str:
    local = at.astimezone(tz)
    return f"{local.hour:02d}:{local.minute:02d}"


def _log(conn: sqlite3.Connection, now: dt.datetime, *, source: str, rule_id: str | None, door: dw.Door | None, d: Decision, trigger_ref: str | None, actor: str | None) -> None:
    conn.execute("""INSERT INTO door_window_trigger_log(id, at, source, rule_id, station_id, relay, decision, reason, trigger_ref, start_at, end_at, occurrence_id, actor)
                    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)""",
                 (new_id(), dw.iso(now), source, rule_id, door.station_id if door else None, door.relay if door else None, d.decision, d.reason, trigger_ref,
                  d.start_at, d.end_at, d.occurrence_id, actor))


def _since(now: dt.datetime, **delta: float) -> str:
    return dw.iso(now - dt.timedelta(**delta))


def decide_door(conn: sqlite3.Connection, settings: Any, now: dt.datetime, door: dw.Door, *, source: str, rule_id: str | None, duration_s: int,
                trigger_ref: str | None, actor: str | None, simulate: bool, max_per_day: int | None, cooldown_s: int, allowed: tuple[str, str] | None) -> Decision:
    """The whole judgement of one door for one trigger, in one write transaction (the caller's). Order: cheap refusals first, caps, then the
    start. Returns the decision; logs and audits it. Never touches an engine."""
    key = door.key

    def out(decision: str, reason: str | None = None, occ: str | None = None, s: str | None = None, e: str | None = None) -> Decision:
        d = Decision(key, decision, reason, occ, s, e)
        _log(conn, now, source=source, rule_id=rule_id, door=door, d=d, trigger_ref=trigger_ref, actor=actor)
        audit(conn, actor=None, action="door.window.trigger", decision="allowed" if decision != "refused" else "denied", resource_type="door", resource_id=key,
              reason=reason or decision, details={"source": source, "decision": decision, "reason": reason, "rule_id": rule_id, "trigger_ref": trigger_ref,
                                                   "authorising_actor": actor, "simulated": decision == "simulated", "occurrence_id": occ})
        return d

    if trigger_ref and conn.execute("""SELECT 1 FROM door_window_trigger_log WHERE source = ? AND rule_id IS ? AND station_id = ? AND relay = ? AND trigger_ref = ?
                                       AND decision <> 'refused'""", (source, rule_id, door.station_id, door.relay, trigger_ref)).fetchone():
        return Decision(key, "duplicate", "already_handled")  # a redelivery is not a second trigger (and writes nothing)
    if conn.execute("SELECT COUNT(*) FROM door_window_trigger_log WHERE decision IN ('started','simulated','extended') AND at > ?", (_since(now, hours=1),)).fetchone()[0] >= STORM_PER_HOUR:
        _notify_storm(conn, now)
        return out("refused", "storm")
    if key in dw.exterior_doors(conn) and dw.setting(conn, "doors.windows.exterior_allowed") != "true":
        return out("refused", "exterior_not_allowed")  # owner 2026-10-13: interior doors first
    tz = ZoneInfo(door.zone)
    local_now = now.astimezone(tz)
    today = local_now.date()
    if dw.calendar_for(conn, door.station_id, today, 0).get(today.isoformat()) == "closed":
        return out("refused", "closed_day")
    if allowed is not None and not (dw.minutes(allowed[0]) <= local_now.hour * 60 + local_now.minute < dw.minutes(allowed[1])):
        return out("refused", "outside_hours")
    start = _next_minute(now)
    seconds = ((duration_s + 59) // 60) * 60
    max_h = dw.int_setting(conn, "doors.windows.max_hours")
    if seconds > max_h * 3600:
        return out("refused", "too_long")
    end = start + dt.timedelta(seconds=seconds)
    ls, le = start.astimezone(tz), end.astimezone(tz)
    if ls.date() != le.date() and not (le.time() == dt.time(0, 0) and (le.date() - ls.date()).days == 1):
        return out("refused", "crosses_midnight")
    s_hm, e_hm = f"{ls.hour:02d}:{ls.minute:02d}", ("24:00" if le.date() != ls.date() else f"{le.hour:02d}:{le.minute:02d}")
    if dw.minutes(e_hm) <= dw.minutes(s_hm):
        return out("refused", "ambiguous_time")
    if dw._touches_quiet(s_hm, e_hm, (dw.setting(conn, "doors.windows.quiet_from"), dw.setting(conn, "doors.windows.quiet_to"))):
        return out("refused", "quiet_hours")
    blocked = dw.door_blocked(conn, door.station_id, door.relay, now)
    if blocked:
        return out("refused", blocked)  # SR-5 relock_unconfirmed | an override / emergency pause | an incident in effect
    s_iso, e_iso = dw.iso(start), dw.iso(end)
    placeholders = ",".join("?" * len(LIVE_STATES))
    overlapping = conn.execute(f"""SELECT * FROM door_window_occurrences WHERE station_id = ? AND relay = ? AND state IN ({placeholders})
                                   AND start_at <= ? AND end_at >= ? ORDER BY start_at""", (door.station_id, door.relay, *LIVE_STATES, e_iso, s_iso)).fetchall()
    for o in overlapping:
        if o["origin"] != "event" or o["state"] not in (*EXTENDABLE_BEFORE_START, *RUNNING):
            return out("refused", "inside_window" if o["end_at"] >= e_iso else "overlaps_window", occ=o["id"])
        if o["end_at"] >= e_iso:
            return out("refused", "already_covered", occ=o["id"])
        if o["state"] in RUNNING and dw.setting(conn, "doors.windows.event_extend_owned") != "true":
            return out("refused", "would_extend_running", occ=o["id"])  # the program would blink ~15 s: audited, not done (the default)
        if conn.execute("SELECT 1 FROM door_window_trigger_log WHERE decision = 'extended' AND occurrence_id = ?", (o["id"],)).fetchone():
            return out("refused", "extended_already", occ=o["id"])
        if simulate:
            return out("simulated", "would_extend", occ=o["id"], s=o["start_at"], e=e_iso)
        new_token = dw.window_token(dt.date.fromisoformat(_token_parts(o["token"])[0]), dw.minutes(_token_parts(o["token"])[1]), dw.minutes(e_hm))
        conn.execute("UPDATE door_window_occurrences SET end_at = ?, token = ?, last_reason = 'extended', updated_at = ? WHERE id = ?", (e_iso, new_token, dw.iso(now), o["id"]))
        return out("extended", None, occ=o["id"], s=o["start_at"], e=e_iso)
    day_start, day_end = dw.iso(dw.wall_instant(today, "00:00", tz)), dw.iso(dw.wall_instant(today, "24:00", tz))
    if conn.execute("SELECT COUNT(*) FROM door_window_occurrences WHERE station_id = ? AND relay = ? AND state <> 'cancelled' AND start_at >= ? AND start_at < ?",
                    (door.station_id, door.relay, day_start, day_end)).fetchone()[0] >= dw.int_setting(conn, "doors.windows.max_per_day_per_door"):
        return out("refused", "daily_cap")
    if max_per_day is not None and conn.execute("""SELECT COUNT(*) FROM door_window_trigger_log WHERE decision IN ('started','simulated') AND rule_id IS ? AND station_id = ?
                                                   AND relay = ? AND at >= ? AND at < ?""", (rule_id, door.station_id, door.relay, day_start, day_end)).fetchone()[0] >= max_per_day:
        return out("refused", "rule_daily_cap")
    if cooldown_s and conn.execute("""SELECT 1 FROM door_window_trigger_log WHERE decision IN ('started','simulated') AND station_id = ? AND relay = ? AND at > ?""",
                                   (door.station_id, door.relay, _since(now, seconds=cooldown_s))).fetchone():
        return out("refused", "cooldown")
    if simulate:
        _notify_simulated(conn, door, actor, e_iso)
        return out("simulated", None, s=s_iso, e=e_iso)
    tier = "program" if dwe.window_engine(settings).tier == "program" else "prepared"
    state = "prepared" if tier == "prepared" else "planned"
    token = dw.window_token(ls.date(), dw.minutes(s_hm), dw.minutes(e_hm))
    occ_id = new_id()
    stamp = dw.iso(now)
    try:
        conn.execute("""INSERT INTO door_window_occurrences(id, rule_id, station_id, relay, start_at, end_at, zone, token, origin, tier, state, created_at, updated_at, trigger_ref)
                        VALUES (?, (SELECT id FROM door_window_rules WHERE id = ?), ?, ?, ?, ?, ?, ?, 'event', ?, ?, ?, ?, ?)""",
                     (occ_id, rule_id, door.station_id, door.relay, s_iso, e_iso, door.zone, token, tier, state, stamp, stamp, trigger_ref))
    except sqlite3.IntegrityError:
        return out("refused", "already_covered")
    return out("started", None, occ=occ_id, s=s_iso, e=e_iso)


# ---------------------------------------------------------------- notifications

def _door_label(door: dw.Door | None) -> str:
    return door.label if door else ""


def _notify_simulated(conn: sqlite3.Connection, door: dw.Door, actor: str | None, until_iso: str) -> None:
    from . import notify

    tz = ZoneInfo(door.zone)
    until = dw.parse_iso(until_iso).astimezone(tz).strftime("%H:%M")
    notify.emit(conn, notify.Signal("door.windows.simulated", "door", door.key, dedupe_key=f"door.windows.simulated:{door.key}:{until_iso}", params={"name": door.label, "until": until},
                                    origin={"door": door.key}, initiator_user_id=actor))


def _notify_storm(conn: sqlite3.Connection, now: dt.datetime) -> None:
    from . import notify

    hour = now.replace(minute=0, second=0, microsecond=0)
    notify.emit(conn, notify.Signal("door.windows.storm", "door", "windows", dedupe_key=f"door.windows.storm:{dw.iso(hour)}", params={}, origin={}))


# ---------------------------------------------------------------- the three sources

_REFUSALS: collections.deque[float] = collections.deque()
_REFUSALS_LOCK = threading.Lock()
MAX_REFUSAL_AUDITS_PER_HOUR = 60


def _refusal_budget() -> bool:
    """A forged event can be fired by anyone who can reach Home Assistant: its refusals are audited, but at most MAX_REFUSAL_AUDITS_PER_HOUR an hour
    (a flood must not become a write storm)."""
    now = time.monotonic()
    with _REFUSALS_LOCK:
        while _REFUSALS and now - _REFUSALS[0] > 3600:
            _REFUSALS.popleft()
        if len(_REFUSALS) >= MAX_REFUSAL_AUDITS_PER_HOUR:
            return False
        _REFUSALS.append(now)
        return True


def reset_budget() -> None:
    with _REFUSALS_LOCK:
        _REFUSALS.clear()


def _actor_ok(conn: sqlite3.Connection, user_id: str, rule_doors: list[tuple[str, int]]) -> bool:
    user = conn.execute("SELECT id, username, display_name, active FROM users WHERE id = ?", (user_id,)).fetchone()
    if user is None or not user["active"]:
        return False
    p = Principal(user["id"], user["username"] or "", user["display_name"] or "", "internal")
    return all(dw.may(conn, p, dw.MANAGE, s) for s, _ in rule_doors)


def fire_rule(db: Database, settings: Any, now: dt.datetime, *, rule_id: Any, source: str, trigger_ref: str | None, token: Any = None,
              automation_id: str | None = None) -> dict[str, Any]:
    """One trigger of an event rule from `ha_event` / `arx_automation`: every check, then one decision per door of the rule. Returns
    {decision: ignored | refused | simulated | started | ..., doors: [...]}. Writes plan rows and logs only; the caller wakes the compile."""
    if source not in SOURCES or not isinstance(rule_id, str) or not 0 < len(rule_id) <= 64:
        return {"decision": "ignored", "reason": "malformed", "doors": []}
    with db.connection(label="door window trigger") as conn:
        if not dw.enabled(conn):
            return {"decision": "ignored", "reason": "windows_off", "doors": []}
        rule = dw.rule_row(conn, rule_id)
        trig = conn.execute("SELECT * FROM door_window_triggers WHERE rule_id = ?", (rule_id,)).fetchone()
        if rule is None or rule["kind"] != "event" or trig is None or trig["source"] != source:
            if _refusal_budget():
                audit(conn, actor=None, action="door.window.trigger", decision="denied", resource_type="door_window_rule", reason="unknown_rule", details={"source": source})
            return {"decision": "refused", "reason": "unknown_rule", "doors": []}
        if source == "ha_event":
            stored = trig["token_sha256"] or ""
            if not isinstance(token, str) or not 8 <= len(token) <= 128 or not stored or not hmac.compare_digest(token_sha(token), stored):
                if _refusal_budget():
                    audit(conn, actor=None, action="door.window.trigger", decision="denied", resource_type="door_window_rule", resource_id=rule_id, reason="bad_token",
                          details={"source": source, "trigger_ref": trigger_ref})
                return {"decision": "refused", "reason": "bad_token", "doors": []}
        else:
            live = _live_revision(conn, automation_id or "")
            if automation_id != trig["automation_id"] or live is None or live != trig["item_revision"]:
                if _refusal_budget():
                    audit(conn, actor=None, action="door.window.trigger", decision="denied", resource_type="door_window_rule", resource_id=rule_id, reason="item_changed",
                          details={"source": source, "trigger_ref": trigger_ref})
                return {"decision": "refused", "reason": "item_changed", "doors": []}
        known = dw.doors_by_key(conn)
        rule_doors = [(r["station_id"], r["relay"]) for r in conn.execute("SELECT station_id, relay FROM door_window_rule_doors WHERE rule_id = ? ORDER BY station_id, relay", (rule_id,))]
        actor = trig["authorising_actor"]
        if rule["state"] != "enabled":
            return {"decision": "refused", "reason": "rule_not_enabled", "doors": []}
        results: list[Decision] = []
        if not _actor_ok(conn, actor, rule_doors):
            for s, r in rule_doors:
                door = known.get(dw.door_key(s, r)) or dw.Door(s, r, f"דלת {r}", "", dw.installation_zone(conn))
                d = Decision(door.key, "refused", "authorising_actor_lost")
                _log(conn, now, source=source, rule_id=rule_id, door=door, d=d, trigger_ref=trigger_ref, actor=actor)
                audit(conn, actor=None, action="door.window.trigger", decision="denied", resource_type="door", resource_id=door.key, reason="authorising_actor_lost",
                      details={"source": source, "rule_id": rule_id, "trigger_ref": trigger_ref, "authorising_actor": actor})
                results.append(d)
            return {"decision": "refused", "reason": "authorising_actor_lost", "doors": [d.as_dict() for d in results]}
        simulate = not (trig["arm_state"] == "armed" and dw.automation_actor_on(conn))
        allowed = (trig["allowed_from_hm"], trig["allowed_to_hm"]) if trig["allowed_from_hm"] else None
        for s, r in rule_doors:
            door = known.get(dw.door_key(s, r))
            if door is None:
                d = Decision(dw.door_key(s, r), "refused", "door_unknown")
                results.append(d)
                continue
            results.append(decide_door(conn, settings, now, door, source=source, rule_id=rule_id, duration_s=trig["duration_s"], trigger_ref=trigger_ref, actor=actor,
                                       simulate=simulate, max_per_day=trig["max_per_day"], cooldown_s=trig["cooldown_s"], allowed=allowed))
    started = [d for d in results if d.decision in ("started", "extended")]
    if started:
        dw.WORKER.wake()
    kinds = {d.decision for d in results}
    top = next((k for k in ("started", "extended", "simulated", "duplicate", "refused") if k in kinds), "ignored")
    return {"decision": top, "reason": None, "doors": [d.as_dict() for d in results]}


def open_for(db: Database, settings: Any, now: dt.datetime, principal: Principal, door: dw.Door, duration_s: int) -> Decision:
    """The `arx_button` source: a person's confirmed click (routers/door_windows.py checked the person, the permission and the confirmation).
    Never simulated, no rule, no token; the caps are the installation's."""
    with db.connection(label="door window open-for") as conn:
        d = decide_door(conn, settings, now, door, source="arx_button", rule_id=None, duration_s=duration_s, trigger_ref=None, actor=principal.user_id, simulate=False,
                        max_per_day=None, cooldown_s=0, allowed=None)
    if d.decision in ("started", "extended"):
        dw.WORKER.wake()
    return d


# ---------------------------------------------------------------- Home Assistant events (never on the WebSocket loop)

DISPATCH: Any = None  # tests: a callable(run) executing inline
_POOL: ThreadPoolExecutor | None = None
_POOL_LOCK = threading.Lock()


def _pool() -> ThreadPoolExecutor:
    global _POOL
    with _POOL_LOCK:
        if _POOL is None:
            _POOL = ThreadPoolExecutor(max_workers=1, thread_name_prefix="door-window-trigger")  # one at a time: the caps are counted, not raced
        return _POOL


def _submit(run: Any) -> None:
    try:
        if DISPATCH is not None:
            DISPATCH(run)
        else:
            _pool().submit(run)
    except Exception:  # noqa: BLE001
        log.exception("door window trigger: dispatch failed")


def _now() -> dt.datetime:
    return dt.datetime.now(dw.UTC)


def on_door_window_event(db: Database | None, settings: Any, frame: Any) -> None:
    """A frame of the `smplwise_arx_door_window` subscription (services/ha_sync.py). Shape-checked (two short strings; anything else is dropped,
    a template is never rendered), then judged on a worker thread. The event data is never logged or stored."""
    event = frame.get("event") if isinstance(frame, dict) else None
    if db is None or not isinstance(event, dict) or event.get("event_type") != EVENT_TYPE:
        return
    data = event.get("data") if isinstance(event.get("data"), dict) else {}
    rule_id, token = data.get("rule_id"), data.get("token")
    if not isinstance(rule_id, str) or not isinstance(token, str):
        return
    context = event.get("context") if isinstance(event.get("context"), dict) else {}
    ref = context.get("id") if isinstance(context.get("id"), str) else None

    def run() -> None:
        try:
            fire_rule(db, settings, _now(), rule_id=rule_id, source="ha_event", trigger_ref=ref, token=token)
        except Exception:  # noqa: BLE001
            log.exception("door window trigger: an event could not be handled")

    _submit(run)


def on_automation_event(db: Database | None, settings: Any, frame: Any) -> None:
    """The automations mirror's hook (services/automations.py): an `automation_triggered` frame -> the event rules whose trigger names that entity."""
    event = frame.get("event") if isinstance(frame, dict) else None
    if db is None or not isinstance(event, dict) or event.get("event_type") != "automation_triggered":
        return
    data = event.get("data") if isinstance(event.get("data"), dict) else {}
    eid = data.get("entity_id")
    if not isinstance(eid, str) or not AUTOMATION_RE.match(eid):
        return
    context = event.get("context") if isinstance(event.get("context"), dict) else {}
    ref = context.get("id") if isinstance(context.get("id"), str) else None

    def run() -> None:
        try:
            with db.connection(mode="read", label="door window automation lookup") as conn:
                rules = [r["rule_id"] for r in conn.execute("SELECT rule_id FROM door_window_triggers WHERE source = 'arx_automation' AND automation_id = ?", (eid,))]
            for rid in rules:
                fire_rule(db, settings, _now(), rule_id=rid, source="arx_automation", trigger_ref=ref, automation_id=eid)
        except Exception:  # noqa: BLE001
            log.exception("door window trigger: an automation event could not be handled")

    _submit(run)
