"""MGRDASH phase 2 (docs/design/MANAGER_DASHBOARD_SPEC_HE.md sections 4, 5, 7 and 10): the manager overview's summary route,
GET /tickets/dashboard - what the manager board cannot say on its own:

    throughput   per handler in the period (today / 7 days / 30 days of the installation's time zone):
                 done      requests marked done in the period, the HANDLERLOAD definition (services/tickets/handler_load.py): status done
                           or closed, completion time `done_at` inside the period, credited to the assignee AT that moment - so this
                           column and the "handled" number of the handler cards are the same number
                 closed    requests closed in the period (a manager's close or the automatic close), credited to the assignee who held
                           the request when it was closed (none when nobody held it)
                 returned  finished work that came back: a move out of `done` back into handling, or a reopen of a closed request,
                           credited to the handler who held it at its latest move to `done` (none when it was closed without one)
                 median    the median time from that handler's assignment to `done`, over the requests of the `done` column (seconds)
    daily        the last 14 local days: opened (created) and closed per day, oldest first, and the net change
    approvals    waiting for my decision: quotes on tickets (`submitted`), payment demands (`submitted`), RFQ awards waiting for a second
                 approval that THIS caller may give (rfq.second_approvers - the exact rule of the confirm route). Amounts only with
                 tickets.costs.view where the item lies; never summed (currencies are never added up)
    rfqs         open requests for quotation the caller manages (rfq.is_manager): the state in words, quotes received / invited,
                 unanswered vendor questions (counts only, never a text), the deadline; decision first, then questions, then collecting
    departments  for a tickets.all_departments manager only: one row per department (open, stuck, overdue, waiting for a manager,
                 done in 7 days, busy handlers against the department's "busy" threshold `ui.dash_busy` / `ui.dash_busy_departments`)

VISIBILITY (section 4): every ticket number passes access.visible() and must be MANAGED by the caller (`Seen.manager`, the board's rule);
every request passes rfq.visible(). A department filter the caller does not manage is refused by the route (never an empty answer). The
timeline is read by status and time (migration 0120), each ticket it names is checked once per request.

COST (section 5): at most a few range reads on indexes plus one visibility check per ticket touched in the window; the result is kept 30
seconds per caller, department, period and permission revision (ten managers opening together do not run ten heavy reads)."""
from __future__ import annotations

import datetime as dt
import statistics
import threading
import time
from typing import Any, Callable

from ...db import permission_revision
from . import access, board, handler_load, rfq, settings_doc, store, store_dash, store_links, stuck
from .access import Seen, Viewer
from .costs import COSTS_VIEW

PERIODS: dict[str, int] = {"today": 1, "7d": 7, "30d": 30}
DAILY_DAYS = 14
ITEMS_MAX = 50  # rows per list (the counts are always complete)
RFQ_PAGES = 5  # rfq.visible_page pages of 200
CACHE_SECONDS = 30.0
CACHE_MAX = 256
AUDIT_EVERY = 600.0  # an allowed open is audited at most once per caller per 10 minutes (the screen polls every minute)
RETURN_TO = ("new", "assigned", "acknowledged", "in_progress")
CLOSED_KINDS = frozenset({"closed", "auto_closed"})


def period_days(period: str | None, default_days: int) -> tuple[str, int]:
    if period in PERIODS:
        return period, PERIODS[period]
    for name, days in PERIODS.items():
        if days == default_days:
            return name, days
    return "7d", 7


def _key(asg: dict[str, Any] | None) -> str | None:
    if not asg:
        return None
    if asg["assignee_kind"] == "contact":
        return f"contact:{asg['contact_id']}"
    return f"user:{asg['user_id']}"


def _local_date(at: str | None, tz: dt.tzinfo) -> str | None:
    d = stuck.parse(at)
    return d.astimezone(tz).date().isoformat() if d is not None else None


def _contact_label(conn, contact_id: str | None) -> str:
    c = store_links.contact(conn, contact_id) if contact_id else None
    if not c or c.get("erased_at"):
        return ""
    vendor = store_links.contact(conn, c.get("vendor_id")) if c.get("vendor_id") else None
    return (vendor or {}).get("display_name") or c.get("display_name") or ""


class _Managed:
    """One visibility decision per ticket per request: the ticket when the caller sees AND manages it (and it is in the filtered
    department), else None."""

    def __init__(self, viewer: Viewer, department_id: str | None):
        self.viewer = viewer
        self.department_id = department_id
        self._seen: dict[str, Seen | None] = {}

    def get(self, ticket_id: str | None) -> Seen | None:
        if not ticket_id:
            return None
        if ticket_id not in self._seen:
            s = access.visible_by_id(self.viewer, ticket_id)
            ok = s is not None and s.manager and (not self.department_id or s.row["department_id"] == self.department_id)
            self._seen[ticket_id] = s if ok else None
        return self._seen[ticket_id]


# ---------------------------------------------------------------- throughput and the 14 days

def _done_rows(conn, managed: _Managed, since: str, until: str) -> list[tuple[Seen, dict[str, Any] | None, str]]:
    out = []
    for r in store_dash.done_between(conn, since, until):
        s = managed.get(r["id"])
        if s is not None:
            out.append((s, store_dash.assignment_at(conn, r["id"], r["done_at"]), r["done_at"]))
    return out


def _throughput(conn, managed: _Managed, since: str, until: str, closed_moves: list[dict[str, Any]]) -> dict[str, Any]:
    rows: dict[str, dict[str, Any]] = {}
    spans: dict[str, list[float]] = {}
    total = {"done": 0, "closed": 0, "returned": 0}

    def row(asg: dict[str, Any]) -> dict[str, Any]:
        k = _key(asg) or "none"
        r = rows.setdefault(k, {"key": k, "kind": asg["assignee_kind"], "name": asg.get("assignee_name") or "", "done": 0, "closed": 0,
                                "returned": 0, "median_seconds": None})
        if asg.get("assignee_name"):
            r["name"] = asg["assignee_name"]  # the latest name the period knows
        return r

    for s, asg, done_at in _done_rows(conn, managed, since, until):
        total["done"] += 1
        if asg is None:
            continue
        row(asg)["done"] += 1
        a, b = stuck.parse(asg["assigned_at"]), stuck.parse(done_at)
        if a is not None and b is not None and b >= a:
            spans.setdefault(_key(asg) or "none", []).append((b - a).total_seconds())
    seen_closed: set[tuple[str, str]] = set()
    for ev in closed_moves:
        if not since <= ev["at"] <= until or managed.get(ev["ticket_id"]) is None:
            continue
        asg = store_dash.assignment_at(conn, ev["ticket_id"], ev["at"])
        k = (_key(asg) or "none", ev["ticket_id"])
        if k in seen_closed:
            continue
        seen_closed.add(k)
        total["closed"] += 1
        if asg is not None:
            row(asg)["closed"] += 1
    seen_returned: set[tuple[str, str]] = set()
    for ev in store_dash.status_moves(conn, RETURN_TO, since, until):
        if ev["from_status"] not in ("done", "closed") or managed.get(ev["ticket_id"]) is None:
            continue
        done_at = store_dash.last_done_before(conn, ev["ticket_id"], ev["id"])
        asg = store_dash.assignment_at(conn, ev["ticket_id"], done_at) if done_at else None
        k = (_key(asg) or "none", ev["ticket_id"])
        if k in seen_returned:
            continue
        seen_returned.add(k)
        total["returned"] += 1
        if asg is not None:
            row(asg)["returned"] += 1
    for k, r in rows.items():
        if spans.get(k):
            r["median_seconds"] = int(statistics.median(spans[k]))
    all_spans = [x for v in spans.values() for x in v]
    total["median_seconds"] = int(statistics.median(all_spans)) if all_spans else None
    out = sorted(rows.values(), key=lambda r: (-r["done"], -r["closed"], r["name"]))
    return {"rows": out, "total": total}


def _daily(conn, managed: _Managed, now: dt.datetime, tz: dt.tzinfo, closed_moves: list[dict[str, Any]]) -> dict[str, Any]:
    start = handler_load.period_start(now, DAILY_DAYS, tz)
    since, until = stuck.iso(start) or "", stuck.iso(now) or ""
    first = now.astimezone(tz).date() - dt.timedelta(days=DAILY_DAYS - 1)
    days = {(first + dt.timedelta(days=i)).isoformat(): {"opened": 0, "closed": 0} for i in range(DAILY_DAYS)}
    for ev in store_dash.status_moves(conn, ("new",), since, until):
        if ev["kind"] != "created" or managed.get(ev["ticket_id"]) is None:
            continue
        d = _local_date(ev["at"], tz)
        if d in days:
            days[d]["opened"] += 1
    closed_on: set[tuple[str, str]] = set()
    for ev in closed_moves:
        if not since <= ev["at"] <= until or managed.get(ev["ticket_id"]) is None:
            continue
        d = _local_date(ev["at"], tz)
        if d in days and (d, ev["ticket_id"]) not in closed_on:
            closed_on.add((d, ev["ticket_id"]))
            days[d]["closed"] += 1
    rows = [{"date": d, **v} for d, v in days.items()]
    return {"days": rows, "net": sum(r["opened"] - r["closed"] for r in rows), "since": since}


# ---------------------------------------------------------------- waiting for my decision

def _approvals(conn, viewer: Viewer, managed: _Managed, department_id: str | None) -> dict[str, Any]:
    def ticket_item(s: Seen, item_id: str, contact_id: str | None, since: str | None, total: Any, currency: str | None) -> dict[str, Any]:
        amounts = viewer.holds(COSTS_VIEW, s.row)
        return {"id": item_id, "ticket": {"id": s.row["id"], "number": s.row["number"], "title": s.row.get("title") or ""},
                "department_id": s.row["department_id"], "vendor": _contact_label(conn, contact_id), "since": since,
                "amount_minor": int(total) if (amounts and total is not None) else None, "currency": currency if amounts else None}

    quotes = [ticket_item(s, q["id"], q["contact_id"], q["created_at"], q["total_minor"], q["currency"])
              for q in store_dash.submitted_ticket_quotes(conn) if (s := managed.get(q["ticket_id"])) is not None]
    claims = [ticket_item(s, c["id"], c["contact_id"], c["updated_at"], c["total_minor"], c["currency"])
              for c in store_dash.submitted_claims(conn) if (s := managed.get(c["ticket_id"])) is not None]
    second = []
    from .store_quotes import quote as quote_row
    from .store_rfq import vendor as rfq_vendor

    for a in store_dash.pending_second_awards(conn):
        seen = rfq.visible_by_id(viewer, a["rfq_id"])
        if seen is None or (department_id and seen.row["department_id"] != department_id):
            continue
        if viewer.uid not in rfq.second_approvers(conn, seen.row, a["first_by"], quote_row(conn, a["quote_id"])):
            continue
        amounts = rfq.sees_amounts(viewer, seen)
        v = rfq_vendor(conn, a["rfq_vendor_id"]) or {}
        second.append({"id": a["id"], "rfq": {"id": seen.row["id"], "number": seen.row["number"], "ref": rfq.ref(seen.row["number"]),
                                              "title": seen.row.get("title") or ""},
                       "department_id": seen.row["department_id"], "vendor": _contact_label(conn, v.get("contact_id")), "since": a["first_at"],
                       "amount_minor": int(a["approved_total_minor"]) if amounts else None, "currency": a["currency"] if amounts else None})
    return {k: {"count": len(v), "items": v[:ITEMS_MAX]} for k, v in (("quotes", quotes), ("claims", claims), ("second", second))}


# ---------------------------------------------------------------- requests for quotation

RFQ_STAGE_RANK = {"second": 0, "decide": 0, "questions": 1, "collecting": 2}


def _rfqs(conn, viewer: Viewer, department_id: str | None, now: dt.datetime) -> dict[str, Any]:
    mine: list[tuple[rfq.RfqSeen, str]] = []
    cursor: str | None = None
    for _ in range(RFQ_PAGES):
        page, cursor = rfq.visible_page(viewer, state="open", department_id=department_id, query="", cursor=cursor, limit=200)
        for seen in page:
            state = rfq.effective_state(seen.row, now)
            if state in rfq.OPEN and rfq.is_manager(viewer, seen):
                mine.append((seen, state))
        if cursor is None:
            break
    pending = store_dash.pending_second_rfqs(conn, [s.row["id"] for s, _ in mine])
    items = []
    for seen, state in mine:
        s = rfq.summary(conn, viewer, seen, now)
        k = s["kpis"]
        questions = int((s.get("questions") or {}).get("pending") or 0)
        if seen.row["id"] in pending:
            stage = "second"
        elif state == "due_passed" or (k["invited"] and k["quoted"] and k["quoted"] + k["declined"] >= k["invited"]):
            stage = "decide"
        elif questions:
            stage = "questions"
        else:
            stage = "collecting"
        items.append({"id": s["id"], "number": s["number"], "ref": s["ref"], "title": s["title"], "department": s["department"], "state": state,
                      "stage": stage, "due_at": s["due_at"], "work_from": s["work_from"], "invited": k["invited"], "quoted": k["quoted"],
                      "declined": k["declined"], "questions": questions})
    items.sort(key=lambda r: (RFQ_STAGE_RANK[r["stage"]], r["due_at"] or "9999", r["number"]))
    return {"count": len(items), "decide": sum(1 for r in items if r["stage"] in ("decide", "second")),
            "questions": sum(r["questions"] for r in items), "items": items[:ITEMS_MAX]}


# ---------------------------------------------------------------- the department comparison

def _departments(conn, viewer: Viewer, now: dt.datetime, done7: list[tuple[Seen, dict[str, Any] | None, str]]) -> tuple[list[dict[str, Any]], bool]:
    ui = settings_doc.read(conn)["ui"]
    busy_default = int(ui.get("dash_busy") or 8)
    busy_map = ui.get("dash_busy_departments") or {}
    sc = board.scan(viewer, scope="all", statuses=board.model_open(), department_id=None, query="")
    lk = board.Lookups(conn)
    per: dict[str, dict[str, Any]] = {}
    load: dict[tuple[str, str], int] = {}

    def dept(d: str) -> dict[str, Any]:
        return per.setdefault(d, {"open": 0, "stuck": 0, "overdue": 0, "waiting": 0, "done_7d": 0, "busy_handlers": 0})

    for s in sc.rows:
        if not s.manager:
            continue
        r = s.row
        c = dept(r["department_id"])
        c["open"] += 1
        if r.get("stuck_kind"):
            c["stuck"] += 1
        if r.get("waiting_on") == "manager":
            c["waiting"] += 1
        since = store.unassigned_since(conn, r) if r["status"] in ("new", "returned") else None
        cell = stuck.nearest_due(stuck.evaluate(r, lk.rule(r["department_id"], r["priority_id"]), now, unassigned_since=since), now)
        if cell and cell.get("over"):
            c["overdue"] += 1
        k = board.assignee_key(r)
        if k != "none" and board.group_of(r) == "handling":
            load[(r["department_id"], k)] = load.get((r["department_id"], k), 0) + 1
    for (d, _k), n in load.items():
        if n >= int(busy_map.get(d) or busy_default):
            dept(d)["busy_handlers"] += 1
    for s, _asg, _at in done7:
        dept(s.row["department_id"])["done_7d"] += 1
    out = []
    for d in store.departments(conn, include_inactive=True):
        if d["id"] in per or d["active"]:
            out.append({"id": d["id"], "name": d["name"], **dept(d["id"])})
    return out, sc.truncated


# ---------------------------------------------------------------- the route's answer, cached

def summary(conn, viewer: Viewer, *, department_id: str | None, period: str, now: dt.datetime, tz: dt.tzinfo) -> dict[str, Any]:
    days = PERIODS[period]
    managed = _Managed(viewer, department_id)
    since = stuck.iso(handler_load.period_start(now, days, tz)) or ""
    since14 = stuck.iso(handler_load.period_start(now, DAILY_DAYS, tz)) or ""
    until = stuck.iso(now) or ""
    closed_moves = [e for e in store_dash.status_moves(conn, ("closed",), min(since, since14), until) if e["kind"] in CLOSED_KINDS]
    all_depts = access.ALL_DEPARTMENTS in viewer.anywhere
    departments, truncated = None, False
    if all_depts:
        since7 = stuck.iso(handler_load.period_start(now, 7, tz)) or ""
        everywhere = _Managed(viewer, None)
        departments, truncated = _departments(conn, viewer, now, _done_rows(conn, everywhere, since7, until))
    return {
        "period": period, "days": days, "since": since, "now": until, "department_id": department_id,
        "throughput": _throughput(conn, managed, since, until, closed_moves),
        "daily": _daily(conn, managed, now, tz, closed_moves),
        "approvals": _approvals(conn, viewer, managed, department_id),
        "rfqs": _rfqs(conn, viewer, department_id, now),
        "departments": departments,
        "all_departments": all_depts,
        "truncated": truncated,
    }


class _Cache:
    """Per process: (database, caller, permission revision, department, period) -> (expiry, answer). Thread-safe, bounded."""

    def __init__(self) -> None:
        self._lock = threading.Lock()
        self._rows: dict[tuple[Any, ...], tuple[float, dict[str, Any]]] = {}
        self._audited: dict[tuple[str, str], float] = {}

    def clear(self) -> None:
        with self._lock:
            self._rows.clear()
            self._audited.clear()

    def get_or_build(self, key: tuple[Any, ...], build: Callable[[], dict[str, Any]], clock: Callable[[], float] = time.monotonic) -> dict[str, Any]:
        t = clock()
        with self._lock:
            hit = self._rows.get(key)
            if hit is not None and hit[0] > t:
                return hit[1]
        value = build()
        with self._lock:
            if len(self._rows) >= CACHE_MAX:
                for k in [k for k, (exp, _v) in self._rows.items() if exp <= t] or list(self._rows)[: CACHE_MAX // 4]:
                    self._rows.pop(k, None)
            self._rows[key] = (t + CACHE_SECONDS, value)
        return value

    def audit_due(self, db_key: str, uid: str, clock: Callable[[], float] = time.monotonic) -> bool:
        t = clock()
        with self._lock:
            last = self._audited.get((db_key, uid))
            if last is not None and t - last < AUDIT_EVERY:
                return False
            if len(self._audited) >= 4 * CACHE_MAX:
                self._audited.clear()
            self._audited[(db_key, uid)] = t
            return True


CACHE = _Cache()


def db_key(conn) -> str:
    row = conn.execute("PRAGMA database_list").fetchone()
    return str(row[2] if row is not None else "")


def cached_summary(conn, viewer: Viewer, *, department_id: str | None, period: str, now: dt.datetime, tz: dt.tzinfo) -> dict[str, Any]:
    key = (db_key(conn), viewer.uid, permission_revision(conn), department_id or "", period)
    out = CACHE.get_or_build(key, lambda: {**summary(conn, viewer, department_id=department_id, period=period, now=now, tz=tz),
                                           "generated_at": stuck.iso(now)})
    return out
