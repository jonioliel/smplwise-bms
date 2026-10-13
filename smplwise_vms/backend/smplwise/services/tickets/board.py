"""CR-038 sections 13.5 / 13.6 / 13.7 (slice 6): the manager board and the facet counts.

Every row comes through the ONE visibility gate: access.visible_page() (an indexed superset, then access.visible() per row), scanned up
to SCAN_CAP rows ("2000+" when there are more); the board keeps the tickets the caller MANAGES (seen.manager - manager rights in the
ticket's department where it lies), facets keep every visible one. Nothing here reads a ticket row any other way.

The board's sections (13.5), decided per ticket:
  waiting  "ממתין לי"  waiting_on = manager (unassigned, returned / not mine, done awaiting close, a failed send, an expired link ...)
  stuck    "תקועות"    stuck_kind set by the SLA monitor (and not waiting for the manager)
  handling "בטיפול"    the rest, also grouped by assignee (count, oldest, last activity, nearest ETA)
plus the recently closed ones (collapsed). Whether the screen groups at all is D20 (`ui.grouping`), applied by the screen; the state
strip (D21) and the floors tree / chips (D19 / D30) come from the counts and the tree here."""
from __future__ import annotations

import datetime as dt
from dataclasses import dataclass, field
from typing import Any, Iterable

from . import access, model, present, store, stuck
from .access import Seen, Viewer

SCAN_CAP = 2000
BOARD_ITEMS_MAX = 500
CLOSED_SHOWN = 50
PAGE = 200
GROUPS = ("waiting", "stuck", "handling")
STATES = ("all", "waiting", "stuck", "unassigned", "closed")
PRIORITY_KEYS = ("urgent", "high", "normal", "low")


@dataclass
class Filters:
    department_id: str | None = None
    priorities: tuple[str, ...] = ()
    assignee: str | None = None        # 'user:<id>' | 'contact:<id>' | 'none'
    place: str | None = None           # 'site:<id>' | 'building:<id>' | 'floor:<id>' | 'zone:<id>' | 'area:<id>' | 'none'
    stuck_kind: str | None = None      # a stuck.KINDS value or 'any'
    waiting: bool = False
    q: str = ""


@dataclass
class Scan:
    rows: list[Seen] = field(default_factory=list)
    truncated: bool = False


def scan(viewer: Viewer, *, scope: str, statuses: tuple[str, ...] | None, department_id: str | None, query: str, cap: int = SCAN_CAP) -> Scan:
    """Every visible ticket of a scope (newest activity first), at most `cap` - through access.visible_page only."""
    out = Scan()
    cursor: str | None = None
    while True:
        page, cursor = access.visible_page(viewer, scope=scope, statuses=statuses, department_id=department_id, query=query, cursor=cursor,
                                           limit=PAGE)
        out.rows.extend(page)
        if len(out.rows) >= cap:
            out.truncated = cursor is not None or len(out.rows) > cap
            out.rows = out.rows[:cap]
            return out
        if cursor is None:
            return out


def _place_keys(row: dict[str, Any]) -> list[str]:
    keys = [f"{k}:{row[k + '_id']}" for k in ("site", "building", "floor", "zone", "area") if row.get(k + "_id")]
    return keys or ["none"]


def assignee_key(row: dict[str, Any]) -> str:
    if not row.get("current_assignment_id") or row.get("asg_ended_at"):
        return "none"
    if row.get("asg_kind") == "contact":
        return f"contact:{row.get('asg_contact_id')}"
    return f"user:{row.get('asg_user_id')}"


def matches(row: dict[str, Any], f: Filters, prio_key: str | None) -> bool:
    if f.department_id and row["department_id"] != f.department_id:
        return False
    if f.priorities and prio_key not in f.priorities:
        return False
    if f.assignee and assignee_key(row) != f.assignee:
        return False
    if f.place and f.place not in _place_keys(row):
        return False
    if f.stuck_kind:
        kind = row.get("stuck_kind") if row.get("status") in stuck.OPEN_STATUSES else None
        if (f.stuck_kind == "any" and not kind) or (f.stuck_kind != "any" and kind != f.stuck_kind):
            return False
    if f.waiting and not (row.get("waiting_on") == "manager" and row.get("status") in stuck.OPEN_STATUSES):
        return False
    return True


def group_of(row: dict[str, Any]) -> str:
    if row.get("waiting_on") == "manager":
        return "waiting"
    if row.get("stuck_kind"):
        return "stuck"
    return "handling"


class Lookups(present.Lookups):
    """present.Lookups + the SLA rules and the department's automatic close."""

    def __init__(self, conn):
        super().__init__(conn)
        self._rule: dict[tuple[str, str], dict[str, Any] | None] = {}

    def rule(self, dept_id: str, prio_id: str) -> dict[str, Any] | None:
        k = (dept_id, prio_id)
        if k not in self._rule:
            self._rule[k] = store.sla_rule(self.conn, dept_id, prio_id)
        return self._rule[k]

    def prio_key(self, pid: str) -> str | None:
        p = self.priority(pid)
        return p["key"] if p else None


def board_item(conn, seen: Seen, lk: Lookups, now: dt.datetime) -> dict[str, Any]:
    """present.ticket_item + what the board adds: the stuck reason (kind, since, reminders), the SLA cell, the section, the place keys
    and the automatic-close date of a done ticket (11.2: "ייסגר אוטומטית ב-<date>")."""
    row = seen.row
    item = present.ticket_item(conn, seen, lk)
    since = store.unassigned_since(conn, row) if row["status"] in ("new", "returned") else None
    ev = stuck.evaluate(row, lk.rule(row["department_id"], row["priority_id"]), now, unassigned_since=since)
    reason = stuck.reason(row)
    if reason is not None:
        due = ev.dues.get(reason["kind"])
        reason["since"] = stuck.iso(due) if due is not None and due <= now else None
    auto_close_at = None
    dept = lk.department(row["department_id"]) or {}
    if row["status"] == "done" and row.get("done_at") and dept.get("auto_close_after_days"):
        d = stuck.parse(row["done_at"])
        if d is not None:
            auto_close_at = stuck.iso(d + dt.timedelta(days=int(dept["auto_close_after_days"])))
    item.update({
        "group": group_of(row) if row["status"] in stuck.OPEN_STATUSES else "closed",
        "stuck": reason,
        "sla_cell": stuck.nearest_due(ev, now) if row["status"] in stuck.OPEN_STATUSES else None,
        "place_keys": _place_keys(row),
        "assignee_key": assignee_key(row),
        "auto_close_at": auto_close_at,
        "manager": seen.manager,
    })
    return item


def _counts(rows: Iterable[Seen]) -> dict[str, int]:
    c = {"all": 0, "waiting": 0, "stuck": 0, "unassigned": 0}
    for s in rows:
        r = s.row
        c["all"] += 1
        g = group_of(r)
        if g == "waiting":
            c["waiting"] += 1
        if r.get("stuck_kind"):
            c["stuck"] += 1
        if r["status"] in ("new", "returned"):
            c["unassigned"] += 1
    return c


def tree(conn, rows: Iterable[Seen]) -> list[dict[str, Any]]:
    """The floors / areas tree of D19 with open counts: sites > buildings > floors > rooms (spatial zones, else the device's area),
    plus "none" for tickets without a place. Flat nodes with a parent key; the screen nests them."""
    counts: dict[str, int] = {}
    ids: dict[str, set[str]] = {"site": set(), "building": set(), "floor": set(), "zone": set(), "area": set()}
    for s in rows:
        for k in _place_keys(s.row):
            counts[k] = counts.get(k, 0) + 1
            if k != "none":
                kind, _, pid = k.partition(":")
                ids[kind].add(pid)
    names = store.place_names(conn, ids)
    out: list[dict[str, Any]] = []
    for key, n in counts.items():
        if key == "none":
            out.append({"key": "none", "kind": "none", "name": "", "parent": None, "count": n, "order": 1 << 30})
            continue
        kind, _, pid = key.partition(":")
        info = names.get(key, {})
        parent_kind = {"building": "site", "floor": "building", "zone": "floor", "area": "floor"}.get(kind)
        parent = f"{parent_kind}:{info['parent']}" if parent_kind and info.get("parent") and f"{parent_kind}:{info['parent']}" in counts else None
        order = info.get("level") if kind == "floor" and info.get("level") is not None else info.get("sort_order") or 0
        out.append({"key": key, "kind": kind, "name": info.get("name") or "", "parent": parent, "count": n, "order": order})
    rank = {"site": 0, "building": 1, "floor": 2, "zone": 3, "area": 3, "none": 9}
    out.sort(key=lambda x: (rank[x["kind"]], x["order"], x["name"]))
    return out


def board(conn, viewer: Viewer, f: Filters, state: str, now: dt.datetime, *, closed_since_days: int | None) -> dict[str, Any]:
    """GET /tickets/board: the caller's managed open tickets (filtered), their sections and counts, the closed ones (D21: this week or
    all), the department chips and the floors tree. `state` = the state strip's choice (all | waiting | stuck | unassigned | closed)."""
    all_depts = access.ALL_DEPARTMENTS in viewer.anywhere
    scope = "all" if all_depts else "department"
    lk = Lookups(conn)
    open_scan = scan(viewer, scope=scope, statuses=model_open(), department_id=None, query=f.q)
    managed = [s for s in open_scan.rows if s.manager]
    mine = {d for d, role in viewer.roles.items() if role == "manager"}
    # the department chips count everything else that is filtered (D19 chips row of the mock-up)
    base = Filters(**{**f.__dict__, "department_id": None})
    by_dept: dict[str, int] = {}
    for s in managed:
        if matches(s.row, base, lk.prio_key(s.row["priority_id"])):
            by_dept[s.row["department_id"]] = by_dept.get(s.row["department_id"], 0) + 1
    filtered = [s for s in managed if matches(s.row, f, lk.prio_key(s.row["priority_id"]))]
    counts = _counts(filtered)
    # the closed ones of the same filter (the last item of the state strip, D21)
    closed_scan = scan(viewer, scope=scope, statuses=("closed", "cancelled"), department_id=f.department_id, query=f.q)
    closed = [s for s in closed_scan.rows if s.manager and matches(s.row, Filters(**{**f.__dict__, "stuck_kind": None, "waiting": False}), lk.prio_key(s.row["priority_id"]))]
    week_ago = stuck.iso(now - dt.timedelta(days=7)) or ""
    closed_week = [s for s in closed if (s.row.get("closed_at") or "") >= week_ago]
    counts["closed_week"] = len(closed_week)
    counts["closed_all"] = len(closed)
    shown_closed = closed_week if closed_since_days == 7 else closed
    if state == "waiting":
        items = [s for s in filtered if group_of(s.row) == "waiting"]
    elif state == "stuck":
        items = [s for s in filtered if s.row.get("stuck_kind")]
    elif state == "unassigned":
        items = [s for s in filtered if s.row["status"] in ("new", "returned")]
    elif state == "closed":
        items = shown_closed
    else:
        items = filtered
    risk = {"waiting": 0, "stuck": 1, "handling": 2}

    def order(s: Seen) -> tuple[Any, ...]:
        r = s.row
        p = lk.priority(r["priority_id"]) or {}
        return (risk.get(group_of(r), 3), -int(r.get("stuck_level") or 0), int(p.get("rank", 9)), r["last_activity_at"])

    if state != "closed":
        items = sorted(items, key=order)
    truncated_items = len(items) > BOARD_ITEMS_MAX
    out_items = [board_item(conn, s, lk, now) for s in items[:BOARD_ITEMS_MAX]]
    handling: dict[str, dict[str, Any]] = {}
    for it in out_items:
        if it["group"] != "handling":
            continue
        k = it["assignee_key"]
        a = it.get("assignee") or {}
        h = handling.setdefault(k, {"key": k, "kind": a.get("kind") or "none", "name": a.get("name") or "", "count": 0, "oldest_at": None,
                                    "last_activity_at": None, "eta_at": None, "ids": []})
        h["count"] += 1
        h["ids"].append(it["id"])
        if h["oldest_at"] is None or it["created_at"] < h["oldest_at"]:
            h["oldest_at"] = it["created_at"]
        if h["last_activity_at"] is None or it["last_activity_at"] > h["last_activity_at"]:
            h["last_activity_at"] = it["last_activity_at"]
        if it.get("eta_at") and (h["eta_at"] is None or it["eta_at"] < h["eta_at"]):
            h["eta_at"] = it["eta_at"]
    depts = []
    for d in store.departments(conn, include_inactive=True):
        if d["id"] in by_dept or (d["id"] in mine and d["active"]):
            depts.append({"id": d["id"], "name": d["name"], "count": by_dept.get(d["id"], 0), "mine": d["id"] in mine})
    return {
        "items": out_items,
        "closed": [] if state == "closed" else [board_item(conn, s, lk, now) for s in shown_closed[:CLOSED_SHOWN]],
        "counts": counts,
        "handling": sorted(handling.values(), key=lambda h: (h["kind"] == "none", -h["count"], h["name"])),
        "departments": depts,
        "tree": tree(conn, [s for s in managed if matches(s.row, Filters(**{**f.__dict__, "place": None}), lk.prio_key(s.row["priority_id"]))]),
        "truncated": open_scan.truncated or closed_scan.truncated or truncated_items,
        "all_departments": all_depts,
        "now": stuck.iso(now),
    }


def model_open() -> tuple[str, ...]:
    return tuple(s for s in model.STATUSES if s not in model.FINAL)


def facets(conn, viewer: Viewer, *, scope: str, statuses: tuple[str, ...] | None, f: Filters) -> dict[str, Any]:
    """GET /tickets/facets (13.6): counts over the caller's VISIBLE set for the same filters - per status, per status group, per
    department, per place (the tree), per stuck kind, waiting for the manager - capped at SCAN_CAP rows ("2000+")."""
    lk = Lookups(conn)
    sc = scan(viewer, scope=scope, statuses=statuses, department_id=f.department_id, query=f.q)
    rows = [s for s in sc.rows if matches(s.row, f, lk.prio_key(s.row["priority_id"]))]
    by_status: dict[str, int] = {}
    by_dept: dict[str, int] = {}
    by_stuck: dict[str, int] = {}
    waiting = 0
    for s in rows:
        r = s.row
        by_status[r["status"]] = by_status.get(r["status"], 0) + 1
        by_dept[r["department_id"]] = by_dept.get(r["department_id"], 0) + 1
        if r["status"] in stuck.OPEN_STATUSES:
            if r.get("stuck_kind"):
                by_stuck[r["stuck_kind"]] = by_stuck.get(r["stuck_kind"], 0) + 1
            if r.get("waiting_on") == "manager":
                waiting += 1
    groups = {g: sum(by_status.get(s, 0) for s in sts) for g, sts in store.STATUS_GROUPS.items()}
    return {"status": by_status, "groups": groups, "departments": by_dept, "stuck": by_stuck, "waiting": waiting,
            "tree": tree(conn, [s for s in rows if s.row["status"] in stuck.OPEN_STATUSES]), "total": len(rows), "truncated": sc.truncated}
