"""MGRDASH phase 3 (docs/design/MANAGER_DASHBOARD_SPEC_HE.md section 5): the speed check of the summary route GET /tickets/dashboard
on a large installation - 20,000 requests and 200,000 timeline rows - against the spec's ceiling of 150 ms per answer.

Opt-in (it seeds about 220,000 rows and takes tens of seconds):

    SW_DASH_PERF=1 python -m pytest tests/test_tickets_mgrdash_perf.py -s -p no:cacheprovider

The seeded history (invented, nothing real): 20,000 requests spread evenly over the last 730 days in two departments (maintenance and
cleaning, every other request), each with exactly 10 timeline rows - opened, assigned, acknowledged, in progress, three notes (no status),
done, a manager's close and a closing note - so 200,000 rows in all. About 5 % of the requests (the newest ones by a stride) are still
open in mixed states. Every request has one assignment of the same handler. That puts roughly 820 requests (8,200 rows) in a 30-day window
and 380 in the 14 days, the realistic picture of an installation of that size; the board's scan of the department comparison sees about
1,000 open requests.

Each viewer and period is measured through the real route with the 30-second cache emptied before every call (the cold path, the cost the
spec bounds) - the median and the worst of RUNS calls are printed. The assertion is the spec's 150 ms on the median, loosened by
sw_load_factor() on a busy machine; SW_PERF=1 keeps the strict 150 ms."""
from __future__ import annotations

import datetime as dt
import os
import statistics
import time
import uuid

import pytest
from conftest import bind, sw_load_factor, sw_perf_enabled

from smplwise.services.tickets import dashboard
from tickets_s4_world import API, build_s4

pytestmark = pytest.mark.skipif(os.environ.get("SW_DASH_PERF") != "1", reason="opt-in measurement (SW_DASH_PERF=1)")

TICKETS = int(os.environ.get("SW_DASH_PERF_TICKETS", "20000"))
EVENTS_PER_TICKET = 10
SPAN_DAYS = 730
OPEN_EVERY = 20  # one request in 20 is still open
RUNS = int(os.environ.get("SW_DASH_PERF_RUNS", "7"))
CEILING_MS = 150.0


def _iso(d: dt.datetime) -> str:
    return d.replace(microsecond=0).strftime("%Y-%m-%dT%H:%M:%SZ")


def _seed(s4) -> dict[str, int]:
    """Clones of one real request (made through the API, so every column the reads need is filled the way the product fills it)."""
    tpl = s4.ticket("mona", "תבנית")
    assert s4.w.assign("mona", tpl["id"], "tom").status_code == 200
    with s4.db.connection() as conn:
        t0 = dict(conn.execute("SELECT * FROM tickets WHERE id = ?", (tpl["id"],)).fetchone())
        a0 = dict(conn.execute("SELECT * FROM ticket_assignments WHERE ticket_id = ? ORDER BY assigned_at LIMIT 1", (tpl["id"],)).fetchone())
        e0 = dict(conn.execute("SELECT * FROM ticket_events WHERE ticket_id = ? ORDER BY id LIMIT 1", (tpl["id"],)).fetchone())
        number = int(conn.execute("SELECT COALESCE(MAX(number), 0) FROM tickets").fetchone()[0])
        t_cols = [c for c in t0 if c != "rowid"]
        a_cols = list(a0)
        e_cols = [c for c in e0 if c != "id"]
        now = dt.datetime.now(dt.timezone.utc)
        tickets, assignments, events = [], [], []
        open_n = 0
        for i in range(TICKETS):
            number += 1
            tid = uuid.uuid4().hex[:24]
            created = now - dt.timedelta(seconds=SPAN_DAYS * 86400 * (TICKETS - i) / TICKETS)
            dept = "dept-maintenance" if i % 2 == 0 else s4.w.cleaning
            still_open = i % OPEN_EVERY == 0 and created > now - dt.timedelta(days=60)
            assigned = created + dt.timedelta(minutes=20)
            done = created + dt.timedelta(hours=6)
            closed = done + dt.timedelta(hours=2)
            status = ("assigned", "acknowledged", "in_progress", "waiting_part")[i % 4] if still_open else "closed"
            open_n += still_open
            aid = uuid.uuid4().hex[:24]
            t = {**t0, "id": tid, "number": number, "department_id": dept, "title": f"בקשה {number}", "status": status,
                 "current_assignment_id": aid, "created_at": _iso(created), "updated_at": _iso(closed if not still_open else assigned),
                 "last_activity_at": _iso(closed if not still_open else assigned), "done_at": None if still_open else _iso(done),
                 "closed_at": None if still_open else _iso(closed), "closed_by": None if still_open else t0["created_by"],
                 "waiting_on": "assignee" if still_open else "none", "dedupe_key": None, "stuck_kind": None, "stuck_level": 0,
                 "next_check_at": None, "priority_id": t0["priority_id"] if dept == "dept-maintenance" else None}
            tickets.append(t)
            assignments.append({**a0, "id": aid, "ticket_id": tid, "assigned_at": _iso(assigned), "acknowledged_at": _iso(assigned),
                                "ended_at": None if still_open else _iso(closed), "end_reason": None if still_open else "closed"})
            moves = [("created", None, "new", created), ("assigned", "new", "assigned", assigned),
                     ("acknowledged", "assigned", "acknowledged", assigned + dt.timedelta(minutes=5)),
                     ("status", "acknowledged", "in_progress", assigned + dt.timedelta(minutes=30)),
                     ("note", None, None, assigned + dt.timedelta(hours=1)), ("note", None, None, assigned + dt.timedelta(hours=2)),
                     ("note", None, None, assigned + dt.timedelta(hours=3)), ("status", "in_progress", "done", done),
                     ("status", "done", "closed", closed), ("note", None, None, closed + dt.timedelta(minutes=1))]
            for kind, frm, to, at in moves[:EVENTS_PER_TICKET]:
                if still_open and to in ("done", "closed"):
                    to, frm, kind = None, None, "note"  # an open request: the same number of rows, no completion
                events.append({**e0, "ticket_id": tid, "at": _iso(at), "kind": kind, "from_status": frm, "to_status": to,
                               "assignment_id": aid, "body": None})
        # a department needs its own priority row: reuse the template's for maintenance, the cleaning department's first one otherwise
        clean_pri = conn.execute("SELECT id FROM ticket_priorities WHERE department_id = ? ORDER BY rowid LIMIT 1", (s4.w.cleaning,)).fetchone()
        for t in tickets:
            if t["priority_id"] is None:
                t["priority_id"] = clean_pri[0] if clean_pri else t0["priority_id"]
        conn.executemany(f"INSERT INTO tickets ({', '.join(t_cols)}) VALUES ({', '.join('?' * len(t_cols))})",
                         [tuple(t[c] for c in t_cols) for t in tickets])
        conn.executemany(f"INSERT INTO ticket_assignments ({', '.join(a_cols)}) VALUES ({', '.join('?' * len(a_cols))})",
                         [tuple(a[c] for c in a_cols) for a in assignments])
        conn.executemany(f"INSERT INTO ticket_events ({', '.join(e_cols)}) VALUES ({', '.join('?' * len(e_cols))})",
                         [tuple(e[c] for c in e_cols) for e in events])
        conn.execute("ANALYZE")
        counts = {"tickets": int(conn.execute("SELECT COUNT(*) FROM tickets").fetchone()[0]),
                  "events": int(conn.execute("SELECT COUNT(*) FROM ticket_events").fetchone()[0]), "open_seeded": open_n}
    return counts


def _measure(s4, user: str, **q) -> tuple[list[float], dict]:
    times, body = [], {}
    for _ in range(RUNS):
        dashboard.CACHE.clear()
        t = time.perf_counter()
        r = s4.c.get(f"{API}/tickets/dashboard", params=q, headers=s4.h(user))
        times.append((time.perf_counter() - t) * 1000)
        assert r.status_code == 200, r.text
        body = r.json()
    return times, body


def test_the_summary_answers_within_150_ms_on_20000_requests(settings, monkeypatch):
    s4 = build_s4(settings, monkeypatch)
    bind(s4.c, settings, "mona", "tickets_external", "installation", "*")
    t = time.perf_counter()
    counts = _seed(s4)
    seed_s = time.perf_counter() - t
    assert counts["tickets"] >= TICKETS and counts["events"] >= TICKETS * EVENTS_PER_TICKET
    print(f"\nseeded {counts} in {seed_s:.1f} s")
    results = []
    for user, label in (("mona", "department manager"), ("joni", "all-departments manager")):
        for period in ("today", "7d", "30d"):
            times, body = _measure(s4, user, period=period)
            med, worst = statistics.median(times), max(times)
            done = body["throughput"]["total"]["done"]
            results.append((label, period, med, worst))
            print(f"{label:24} {period:5}  median {med:7.1f} ms  worst {worst:7.1f} ms  (done in period {done}, 14-day opened "
                  f"{sum(d['opened'] for d in body['daily']['days'])}, departments {len(body['departments'] or [])})")
            if period == "30d":
                assert done > 0, "the seeded window must hold completions (else the measurement measures nothing)"
    factor = 1.0 if sw_perf_enabled() else sw_load_factor()
    worst_median = max(r[2] for r in results)
    print(f"ceiling {CEILING_MS} ms x load factor {factor:.2f}; worst median {worst_median:.1f} ms")
    for label, period, med, _w in results:
        assert med <= CEILING_MS * factor, f"{label} {period}: median {med:.1f} ms over the spec's {CEILING_MS} ms"


def test_batched_visibility_against_the_per_ticket_path(settings, monkeypatch):
    """The speed fix (docs/design/evidence/dash3/speed_fix.md): the same seed answered by the batched visibility read and by the
    per-ticket path it replaced (_Managed.prefetch switched off, so every ticket goes through access.visible_by_id one by one), the two
    interleaved call by call so a busy workstation slows both alike. The answers must be identical; the medians are printed."""
    s4 = build_s4(settings, monkeypatch)
    bind(s4.c, settings, "mona", "tickets_external", "installation", "*")
    _seed(s4)
    batched = dashboard._Managed.prefetch

    def per_ticket(self, ticket_ids):  # the path before the fix: get() decides each ticket with its own read
        return None

    for user, label in (("mona", "department manager"), ("joni", "all-departments manager")):
        for period in ("today", "7d", "30d"):
            t_old, t_new, bodies = [], [], {}
            for _ in range(RUNS):
                for name, impl, times in (("old", per_ticket, t_old), ("new", batched, t_new)):
                    monkeypatch.setattr(dashboard._Managed, "prefetch", impl)
                    dashboard.CACHE.clear()
                    t = time.perf_counter()
                    r = s4.c.get(f"{API}/tickets/dashboard", params={"period": period}, headers=s4.h(user))
                    times.append((time.perf_counter() - t) * 1000)
                    assert r.status_code == 200, r.text
                    body = r.json()
                    for k in ("generated_at", "now", "since"):  # the clock moves between calls; everything else must not
                        body.pop(k, None)
                    body["daily"].pop("since", None)
                    bodies.setdefault(name, body)
                    assert body == bodies[name], "the same seed must answer the same every call"
            assert bodies["new"] == bodies["old"], f"{label} {period}: the batched read changed the answer"
            mo, mn = statistics.median(t_old), statistics.median(t_new)
            print(f"{label:24} {period:5}  per-ticket median {mo:7.1f} ms (worst {max(t_old):7.1f})  batched median {mn:7.1f} ms "
                  f"(worst {max(t_new):7.1f})  x{mo / mn:4.2f}")
