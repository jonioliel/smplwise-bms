"""CR-038 section 13 (slice 6): the pure logic of "stuck" - which SLA threshold an open ticket has crossed, since when, when the
monitor must look at it next, and what the reminder / escalation ladder does now. No SQL, no clock of its own: every function takes
the ticket row, its department x priority rule and `now`, so the unit tests drive it with a fake clock row by row.

Thresholds (section 13.1, every one per department x priority, an empty cell = off; calendar time, D7 - or working minutes when the installation set a working-hours calendar, SLACAL: work_calendar.py):

    kind        applies while                                   crossed at
    unassigned  new / returned (nobody holds the ticket)        unassigned_since + unassigned_after_min
    overdue     any open status but done                        created_at + resolve_within_min
    unopened    assigned to an outside contact, link not opened link sent + link_unopened_min   (D11; external only)
    ack         assigned (not acknowledged yet)                 assigned_at + ack_within_min
    stuck       acknowledged / in progress                      last_activity_at + stuck_after_min  (a future ETA pushes it out)
    waiting     waiting for a part                              last_activity_at + stuck_waiting_min (a future ETA pushes it out)

When several are crossed, the first of that order is the ticket's `stuck_kind` (the manager sees ONE reason; "overdue" outranks the
per-step ones because the promise to the requester is broken). Progress (section 13.2: any status / note / photo / ETA / assignment)
moves `last_activity_at` or the status, so the crossing disappears or moves - the ladder then starts again from zero.

The ladder of one crossing (section 13.3), deterministic and idempotent (the stored state says what was done already):
  1. remind the assignee - the first reminder at the crossing, then every `remind_every_min`, at most `max_reminders`;
     an outside contact is reminded only inside the vendor send window (D4: the reminder waits for the morning, the managers do not);
  2. alert the department's managers once `manager_alert_after_steps` reminders went unanswered for one cadence
     (0 = at the crossing; at once for `unassigned`, and whenever the assignee cannot be reminded at all);
  3. after `max_reminders` nothing more is sent; the ticket stays "stuck" on the board until someone acts.
`stuck_level`: 0 none, 1 reminded, 2 managers alerted."""
from __future__ import annotations

import datetime as dt
from dataclasses import dataclass, field
from typing import Any, Iterable

from . import work_calendar

KINDS: tuple[str, ...] = ("unassigned", "overdue", "unopened", "ack", "stuck", "waiting")
OPEN_STATUSES = frozenset({"new", "assigned", "acknowledged", "in_progress", "waiting_part", "done", "returned"})
RECHECK_MAX = dt.timedelta(hours=6)  # a ticket with nothing due is still looked at again within this (a safety net, cheap)
RULE_FIELDS = ("unassigned_after_min", "link_unopened_min", "ack_within_min", "stuck_after_min", "stuck_waiting_min",
               "resolve_within_min", "remind_every_min", "max_reminders", "manager_alert_after_steps")


def parse(at: str | None) -> dt.datetime | None:
    if not at:
        return None
    try:
        v = dt.datetime.fromisoformat(str(at).replace("Z", "+00:00"))
    except ValueError:
        return None
    return v if v.tzinfo else v.replace(tzinfo=dt.timezone.utc)


def iso(v: dt.datetime | None) -> str | None:
    if v is None:
        return None
    return v.astimezone(dt.timezone.utc).replace(microsecond=0).isoformat().replace("+00:00", "Z")


def _mins(rule: dict[str, Any] | None, key: str) -> dt.timedelta | None:
    v = (rule or {}).get(key)
    if v is None or isinstance(v, bool):
        return None
    try:
        n = int(v)
    except (TypeError, ValueError):
        return None
    return dt.timedelta(minutes=n) if n > 0 else None


def _count(rule: dict[str, Any] | None, key: str, default: int) -> int:
    v = (rule or {}).get(key)
    try:
        return max(0, int(v)) if v is not None and not isinstance(v, bool) else default
    except (TypeError, ValueError):
        return default


def _after(base: dt.datetime, span: dt.timedelta, cal: "work_calendar.Calendar | None") -> dt.datetime:
    """SLACAL: `span` after `base` - in working time when the installation set a working-hours calendar, else wall-clock (the default)."""
    if cal is None or cal.is_24x7:
        return base + span
    return work_calendar.add_working_time(base, span.total_seconds() / 60.0, cal)


@dataclass(frozen=True)
class LinkInfo:
    """The current handler link of an external assignment (slice 4's `ticket_links`), as far as the monitor needs it."""

    sent_at: str | None
    first_opened_at: str | None
    expires_at: str | None = None
    cap_at: str | None = None
    revoked: bool = False


@dataclass(frozen=True)
class Crossing:
    kind: str
    due: dt.datetime


@dataclass(frozen=True)
class Evaluation:
    crossed: Crossing | None
    """the ONE reason the manager sees (first crossed kind in KINDS order), or None"""
    dues: dict[str, dt.datetime]
    """every applicable threshold of the current state, crossed or not (the board's SLA column: the nearest future one)"""

    def next_due(self, now: dt.datetime) -> dt.datetime | None:
        future = [d for d in self.dues.values() if d > now]
        return min(future) if future else None


def evaluate(row: dict[str, Any], rule: dict[str, Any] | None, now: dt.datetime, *, unassigned_since: str | None = None,
             link: LinkInfo | None = None, cal: "work_calendar.Calendar | None" = None) -> Evaluation:
    """Which thresholds apply to the ticket now and which one is crossed. `row` is a ticket row with its current assignment
    (`asg_kind`, `asg_at`, `asg_ended_at` - store._TICKET_SELECT); `unassigned_since` = when nobody holds it any more (creation,
    the return, the reopen); `link` = the external assignment's live link (None for internal users / no link); `cal` = the working-hours calendar of the ticket's
    department (SLACAL; None or disabled = wall-clock minutes, exactly as before)."""
    status = row.get("status")
    dues: dict[str, dt.datetime] = {}
    if status not in OPEN_STATUSES:
        return Evaluation(None, dues)
    held = bool(row.get("current_assignment_id")) and not row.get("asg_ended_at")
    eta = parse(row.get("eta_at"))
    last = parse(row.get("last_activity_at")) or parse(row.get("created_at"))
    created = parse(row.get("created_at"))
    if status in ("new", "returned") and not held:
        since = parse(unassigned_since) or created
        d = _mins(rule, "unassigned_after_min")
        if since and d:
            dues["unassigned"] = _after(since, d, cal)
    if status != "done" and created:
        d = _mins(rule, "resolve_within_min")
        if d:
            dues["overdue"] = _after(created, d, cal)
    if status == "assigned" and held:
        if row.get("asg_kind") == "contact" and link is not None and not link.revoked and not link.first_opened_at:
            sent = parse(link.sent_at) or parse(row.get("asg_at"))
            d = _mins(rule, "link_unopened_min")
            if sent and d:
                dues["unopened"] = _after(sent, d, cal.counts_link_unopened() if cal is not None else None)  # the vendor's clock unless chosen
        at = parse(row.get("asg_at"))
        d = _mins(rule, "ack_within_min")
        if at and d:
            dues["ack"] = _after(at, d, cal)
    if status in ("acknowledged", "in_progress") and last:
        d = _mins(rule, "stuck_after_min")
        if d:
            due = _after(last, d, cal)
            dues["stuck"] = max(due, eta) if eta and eta > due else due  # 13.2: a promised ETA suppresses "stuck" until it passes
    if status == "waiting_part" and last:
        d = _mins(rule, "stuck_waiting_min")
        if d:
            due = _after(last, d, cal)
            dues["waiting"] = max(due, eta) if eta and eta > due else due
    crossed = None
    for kind in KINDS:
        due = dues.get(kind)
        if due is not None and due <= now:
            crossed = Crossing(kind, due)
            break
    return Evaluation(crossed, dues)


# ---------------------------------------------------------------- the ladder

@dataclass(frozen=True)
class LadderState:
    """What was done for the current crossing (stored on the ticket: stuck_kind / stuck_level / reminders_sent, and the crossing's
    due + the time of the last reminder from the timeline)."""

    kind: str | None = None
    level: int = 0
    reminders: int = 0
    due: str | None = None
    last_reminder_at: str | None = None


@dataclass
class Plan:
    """What the monitor does for one ticket in one look."""

    state: LadderState
    next_check: dt.datetime
    started: Crossing | None = None       # a new crossing: write the 'stuck' timeline row
    ended_kind: str | None = None         # the previous crossing is over (progress): resolve its notifications
    remind: bool = False                  # send reminder number state.reminders now
    remind_held_until: dt.datetime | None = None  # an outside reminder waits for the send window
    alert: bool = False                   # alert the department's managers now
    actions: list[str] = field(default_factory=list)


def plan(state: LadderState, ev: Evaluation, rule: dict[str, Any] | None, now: dt.datetime, *, assignee: str | None,
         can_remind: bool = True, window_open: bool = True, next_window: dt.datetime | None = None,
         cal: "work_calendar.Calendar | None" = None) -> Plan:
    """The ladder step for one look at a ticket. `assignee`: 'user' | 'contact' | None (nobody holds it); `can_remind`: whether a
    reminder can reach that assignee at all (an outside contact needs the message channel of slice 5b); `window_open` /
    `next_window`: the vendor send window of the ticket's department (D4) - used for outside contacts only."""
    cap = now + RECHECK_MAX
    cross = ev.crossed
    nxt = ev.next_due(now)
    if cross is None:
        p = Plan(state=LadderState(), next_check=min(nxt, cap) if nxt else cap)
        if state.kind:
            p.ended_kind = state.kind
            p.actions.append("resolved")
        return p
    same = state.kind == cross.kind and parse(state.due) == cross.due
    st = state if same else LadderState(kind=cross.kind, due=iso(cross.due))
    p = Plan(state=st, next_check=cap)
    if not same:
        p.started = cross
        p.actions.append("started")
        if state.kind:
            p.ended_kind = state.kind
    checks: list[dt.datetime] = [cap]
    if nxt:
        checks.append(nxt)
    every = _mins(rule, "remind_every_min")
    max_rem = _count(rule, "max_reminders", 2)
    steps = _count(rule, "manager_alert_after_steps", 1)
    if every is None:
        max_rem = min(max_rem, 1)  # no cadence: one reminder at the crossing
    if cross.kind == "unassigned" or assignee is None or not can_remind:
        max_rem = 0  # nobody to remind: the managers are the ones to act (13.3: at once for unassigned)
    reminders, level = st.reminders, st.level
    last_rem = parse(st.last_reminder_at)
    # SLACAL: the 'link not opened' crossing is the vendor's clock - its cadence follows the threshold's own choice; and an INTERNAL
    # reminder / any manager alert that would fire outside working time waits for the next opening (calendar.hold_internal)
    pcal = cal.counts_link_unopened() if cal is not None and cross.kind == "unopened" else cal
    hold = cal is not None and not cal.is_24x7 and cal.hold_internal and not work_calendar.is_working(now, cal)
    opening = work_calendar.next_opening(now, cal) if hold else None
    # 1. a reminder
    if reminders < max_rem:
        due_at = cross.due if reminders == 0 or last_rem is None else max(cross.due, _after(last_rem, every or dt.timedelta(0), pcal))
        if now >= due_at:
            if assignee == "contact" and not window_open:
                p.remind_held_until = next_window
                checks.append(next_window or cap)
            elif assignee == "user" and hold:
                checks.append(opening or cap)
            else:
                p.remind = True
                reminders += 1
                last_rem = now
                p.actions.append("remind")
        else:
            checks.append(due_at)
    # 2. the managers
    if level < 2:
        # on the NOMINAL ladder (13.1: "an urgent reminder due at 02:00 leaves at 07:00 while the manager alert at 02:00 is not
        # delayed"): `need` reminders, one cadence apart, then the managers - whether or not a held reminder has left yet
        need = min(steps, max_rem)
        alert_at = _after(cross.due, (every or dt.timedelta(0)) * need, pcal)
        if now >= alert_at and hold:
            checks.append(opening or cap)
        elif now >= alert_at:
            p.alert = True
            level = 2
            p.actions.append("alert")
        else:
            checks.append(alert_at)
    if level < 2 and reminders > 0:
        level = 1
    if reminders < max_rem and last_rem is not None and every is not None and reminders > 0:
        checks.append(_after(last_rem, every, pcal))
    p.state = LadderState(kind=cross.kind, level=level, reminders=reminders, due=iso(cross.due), last_reminder_at=iso(last_rem))
    future = [c for c in checks if c > now]
    p.next_check = min(future) if future else now + dt.timedelta(minutes=1)
    return p


# ---------------------------------------------------------------- vendor send hours (D4)

def _hm(v: Any) -> tuple[int, int] | None:
    if not isinstance(v, str) or len(v) != 5 or v[2] != ":":
        return None
    try:
        h, m = int(v[:2]), int(v[3:])
    except ValueError:
        return None
    return (h, m) if 0 <= h <= 23 and 0 <= m <= 59 else None


DEFAULT_WINDOW = ("07:00", "21:00")


def send_window(installation: Any, department_json: str | None) -> tuple[str, str]:
    """The department's override (`ticket_departments.send_hours_json`) or the installation's `send_hours` (14.1), else 07:00-21:00.
    An invalid or across-midnight window is ignored (14.1: refused at save time)."""
    for raw in (department_json, installation):
        val = raw
        if isinstance(raw, str):
            try:
                import json

                val = json.loads(raw)
            except ValueError:
                val = None
        if isinstance(val, dict):
            a, b = _hm(val.get("from")), _hm(val.get("to"))
            if a and b and a < b:
                return val["from"], val["to"]
    return DEFAULT_WINDOW


def _zone(name: str | None) -> dt.tzinfo:
    try:
        from zoneinfo import ZoneInfo

        return ZoneInfo(name or "Asia/Jerusalem")
    except Exception:  # noqa: BLE001 - an unknown zone name falls back to the product default
        from zoneinfo import ZoneInfo

        return ZoneInfo("Asia/Jerusalem")


def window_state(now: dt.datetime, window: tuple[str, str], zone: str | None) -> tuple[bool, dt.datetime]:
    """(inside the window now, the next opening as UTC) in the installation's time zone, every day (DST days follow the zone)."""
    tz = _zone(zone)
    local = now.astimezone(tz)
    (fh, fm), (th, tm) = _hm(window[0]) or (7, 0), _hm(window[1]) or (21, 0)
    start = local.replace(hour=fh, minute=fm, second=0, microsecond=0)
    end = local.replace(hour=th, minute=tm, second=0, microsecond=0)
    if start <= local < end:
        return True, now
    if local < start:
        opening = start
    else:
        nd = (local + dt.timedelta(days=1)).date()
        opening = dt.datetime(nd.year, nd.month, nd.day, fh, fm, tzinfo=tz)
    return False, opening.astimezone(dt.timezone.utc)


# ---------------------------------------------------------------- what the manager reads

def reason(row: dict[str, Any]) -> dict[str, Any] | None:
    """The stored stuck reason of a ticket as the board shows it (kind, level, reminders); None when it is not stuck."""
    kind = row.get("stuck_kind")
    if not kind or row.get("status") not in OPEN_STATUSES:
        return None
    return {"kind": kind, "level": int(row.get("stuck_level") or 0), "reminders": int(row.get("reminders_sent") or 0)}


def nearest_due(ev: Evaluation, now: dt.datetime) -> dict[str, Any] | None:
    """The board's SLA cell: the nearest FUTURE due ("בעוד 3 ש׳"), else the crossed one ("חריגה 2 ימים")."""
    nxt = None
    for kind, due in sorted(ev.dues.items(), key=lambda kv: kv[1]):
        if due > now:
            nxt = {"kind": kind, "at": iso(due), "over": False}
            break
    if ev.crossed is not None:
        return {"kind": ev.crossed.kind, "at": iso(ev.crossed.due), "over": True}
    return nxt


def kinds_in(values: Iterable[str]) -> list[str]:
    return [k for k in KINDS if k in set(values)]
