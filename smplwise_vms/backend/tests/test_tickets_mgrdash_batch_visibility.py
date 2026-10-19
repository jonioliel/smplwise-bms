"""MGRDASH speed fix (docs/design/evidence/dash3/speed_fix.md): GET /tickets/dashboard decides visibility in batches
(access.visible_many - one IN read of the ticket rows, then THE rule of access.visible per row; dashboard._Managed.prefetch) instead of
one access.visible_by_id per ticket. These tests hold the batched path to the per-ticket one on a mixed-permission seed: the same rows,
the same Seen (row, full, reasons, manager, assignee) for every caller, the same summary for every caller, period and department - so
the batch can never show a ticket the per-ticket path hid. Every name and number here is invented."""
from __future__ import annotations

import datetime as dt

import pytest
from conftest import bind

from smplwise.rbac import Principal
from smplwise.db import new_id
from smplwise.services.tickets import access, dashboard, store, store_dash
from test_tickets_mgrdash_summary import _quote_and_claim, done_by
from tickets_s4_world import API, build_s4

# every kind of caller of the cast (tests/tickets_world.py): admin, department managers, an all-departments viewer who manages nothing,
# a member, a non-member creator, floor-scoped operators, a member denied tickets.view, a viewer without any ticket permission
USERS = ("joni", "mona", "cleo", "alda", "tom", "nora", "fred", "gil", "dina", "vic")


def _now() -> dt.datetime:
    """A fixed instant for both paths of one comparison, just after the seed (taken per test: a slow run must not age it)."""
    return dt.datetime.now(dt.timezone.utc) + dt.timedelta(minutes=5)


@pytest.fixture()
def world(settings, monkeypatch):
    dashboard.CACHE.clear()
    s4 = build_s4(settings, monkeypatch)
    bind(s4.c, settings, "mona", "tickets_external", "installation", "*")
    bind(s4.c, settings, "mona", "tickets_costs_view", "installation", "*")
    s4.w.member(s4.w.cleaning, "tom", "member")
    ids: dict[str, str] = {}
    # maintenance: done and closed / done and sent back / open and assigned
    a = s4.ticket("mona", "מזגן")
    done_by(s4, a)
    assert s4.w.status("mona", a["id"], "closed").status_code == 200
    b = s4.ticket("mona", "דלת")
    done_by(s4, b)
    assert s4.w.status("mona", b["id"], "in_progress", note="חסר בורג").status_code == 200
    c = s4.ticket("mona", "נורה")
    assert s4.w.assign("mona", c["id"], "tom").status_code == 200
    # cleaning: done by the shared handler, and one open
    d = s4.ticket("cleo", "רצפה", dept=s4.w.cleaning)
    done_by(s4, d, manager="cleo")
    e = s4.ticket("cleo", "חלון", dept=s4.w.cleaning)
    # placed tickets: floor 2 (fred's floor) and floor 3 (gil's floor), one per department
    f = s4.ticket("joni", "תקרה")
    s4.w.place(f["id"], "floor2")
    g = s4.ticket("joni", "מעלית")
    s4.w.place(g["id"], "floor3")
    done_by(s4, g)
    h = s4.ticket("joni", "שטיח", dept=s4.w.cleaning)
    s4.w.place(h["id"], "floor2")
    # a request opened by a non-member (nora) - the creator's limited view - and one by fred, placeless
    n = s4.ticket("joni", "רעש")
    fr = s4.ticket("joni", "ריח")
    # sent to outside contacts (the vendor and the plain contact), with a quote and a payment demand waiting
    v1, _ = s4.sent("מזגן דולף")
    _quote_and_claim(s4, v1["id"], s4.contact["id"])
    v2 = s4.ticket("joni", "משאבה")
    assert s4.assign_contact(v2["id"], s4.vendor["id"]).status_code == 200
    _quote_and_claim(s4, v2["id"], s4.vendor["id"])
    # reassigned (tom -> gil, done by gil), and two assignments with the SAME start (the rowid decides, like the SQL's ORDER BY)
    r = s4.ticket("mona", "ברז")
    assert s4.w.assign("mona", r["id"], "tom").status_code == 200
    assert s4.w.assign("mona", r["id"], "gil").status_code == 200
    assert s4.w.status("gil", r["id"], "in_progress").status_code == 200
    assert s4.w.status("gil", r["id"], "done").status_code == 200
    with s4.db.connection() as conn:
        a0 = dict(conn.execute("SELECT * FROM ticket_assignments WHERE ticket_id = ? ORDER BY rowid DESC LIMIT 1", (a["id"],)).fetchone())
        twin = {**a0, "id": new_id(), "assignee_name": "תאום"}
        conn.execute(f"INSERT INTO ticket_assignments ({', '.join(twin)}) VALUES ({', '.join('?' * len(twin))})", tuple(twin.values()))
        conn.execute("UPDATE tickets SET created_by = 'dev-nora' WHERE id = ?", (n["id"],))
        conn.execute("UPDATE tickets SET created_by = 'dev-fred' WHERE id = ?", (fr["id"],))
    for k, t in zip("abcdefghnFvwr", (a, b, c, d, e, f, g, h, n, fr, v1, v2, r)):
        ids[k] = t["id"]
    yield s4, ids
    dashboard.CACHE.clear()


def _viewer(conn, user: str) -> access.Viewer:
    return access.Viewer(conn, Principal(f"dev-{user}", user, user, "dev"))


def _all_ids(s4) -> list[str]:
    with s4.db.connection(mode="read") as conn:
        return [r[0] for r in conn.execute("SELECT id FROM tickets ORDER BY number")]


def test_the_batched_rows_are_the_single_reads(world):
    s4, _ids = world
    ids = _all_ids(s4)
    with s4.db.connection(mode="read") as conn:
        batch = store.ticket_rows_unchecked(conn, ids + ["no-such-ticket"])
        assert set(batch) == set(ids), "an unknown id is simply absent"
        for i in ids:
            single = store.ticket_row_unchecked(conn, i)
            assert batch[i] == single and list(batch[i]) == list(single), i  # same values, same keys, same key order


def test_every_caller_sees_exactly_what_the_per_ticket_rule_shows(world, monkeypatch):
    s4, _ids = world
    ids = _all_ids(s4) + ["no-such-ticket"]
    for batch_ids in (access.BATCH_IDS, 2):  # 2: many IN batches, the seams included
        monkeypatch.setattr(access, "BATCH_IDS", batch_ids)
        for user in USERS:
            with s4.db.connection(mode="read") as conn:
                old = {i: access.visible_by_id(_viewer(conn, user), i) for i in ids}
                new = access.visible_many(_viewer(conn, user), ids + ids[:3] + ["", None])
            assert list(new) == ids, "every id asked for once, in the order asked, the empty ones dropped"
            assert new == old, f"{user} (batch {batch_ids}): the batch decided differently"


def test_the_seed_really_mixes_the_permissions(world):
    """The equivalence above is only worth something when the callers see different things."""
    s4, ids = world
    every = _all_ids(s4)
    with s4.db.connection(mode="read") as conn:
        seen = {u: {i for i, s in access.visible_many(_viewer(conn, u), every).items() if s is not None} for u in USERS}
        managed = {u: {i for i, s in access.visible_many(_viewer(conn, u), every).items() if s is not None and s.manager} for u in USERS}
        limited = {u: {i for i, s in access.visible_many(_viewer(conn, u), every).items() if s is not None and not s.full} for u in USERS}
    assert seen["joni"] == set(every)
    assert seen["vic"] == set() and seen["dina"] == set()
    assert ids["d"] in seen["cleo"] and ids["a"] not in seen["cleo"]
    assert ids["a"] in seen["mona"] and ids["e"] not in seen["mona"]
    assert seen["alda"] == set(every) and managed["alda"] == set()
    assert ids["n"] in limited["nora"] and seen["nora"] == {ids["n"]}
    assert ids["F"] in seen["fred"] and ids["a"] not in seen["fred"]
    assert ids["g"] in seen["gil"] and ids["f"] not in seen["gil"], "gil is bound to floor 3 only"
    assert ids["c"] in seen["tom"] and managed["tom"] == set()
    assert managed["mona"] and managed["cleo"] and not managed["mona"] & managed["cleo"]


def test_module_off_hides_everything_in_the_batch_too(world):
    s4, _ids = world
    ids = _all_ids(s4)
    s4.c.patch(f"{API}/settings", json={"tickets.enabled": "false"})
    with s4.db.connection(mode="read") as conn:
        assert access.visible_many(_viewer(conn, "joni"), ids) == dict.fromkeys(ids)
        assert all(access.visible_by_id(_viewer(conn, "joni"), i) is None for i in ids)


def _per_ticket(self, ticket_ids) -> None:
    """The path before the fix: no batch, every ticket through access.visible_by_id one by one (_Managed.get's fallback)."""


_STATUS_MOVES = store_dash.status_moves


def _full_status_moves(conn, to_statuses, since, until, **_filters):
    """The timeline read before the fix: every row moving to those statuses, the caller filters in Python."""
    return _STATUS_MOVES(conn, to_statuses, since, until)


def _row_dicts(cur):
    """The row build before the fix."""
    return [dict(r) for r in cur.fetchall()]


def _old_path(mp) -> None:
    """Every change of the speed fix switched off: visibility and assignments one ticket at a time, rows built by dict(row), the
    timeline read whole and filtered in Python - as before."""
    mp.setattr(dashboard._Managed, "prefetch", _per_ticket)
    mp.setattr(dashboard._Assignments, "prefetch", _per_ticket)
    mp.setattr(store, "_dicts", _row_dicts)
    mp.setattr(store_dash, "status_moves", _full_status_moves)


def _summary(s4, user: str, department_id: str | None, period: str, batched: bool, now: dt.datetime | None = None) -> dict:
    with pytest.MonkeyPatch.context() as mp:
        if not batched:
            _old_path(mp)
        with s4.db.connection(mode="read") as conn:
            return dashboard.summary(conn, _viewer(conn, user), department_id=department_id, period=period, now=now or _now(), tz=dt.timezone.utc)


def test_the_summary_is_identical_for_every_caller_department_and_period(world):
    s4, _ids = world
    now = _now()
    for user in USERS:
        for period in ("today", "7d", "30d"):
            for department_id in (None, "dept-maintenance", s4.w.cleaning):
                old = _summary(s4, user, department_id, period, batched=False, now=now)
                new = _summary(s4, user, department_id, period, batched=True, now=now)
                assert new == old, (user, department_id, period)


def test_the_seeded_summaries_are_not_empty(world):
    s4, ids = world
    mona = _summary(s4, "mona", None, "7d", batched=True)
    joni = _summary(s4, "joni", None, "7d", batched=True)
    assert mona["throughput"]["total"]["done"] >= 2 and mona["throughput"]["total"]["returned"] == 1
    assert joni["throughput"]["total"]["done"] > mona["throughput"]["total"]["done"]
    assert mona["approvals"]["quotes"]["count"] == 2 and mona["approvals"]["claims"]["count"] == 2
    assert mona["approvals"]["quotes"]["items"][0]["amount_minor"] is not None, "mona holds tickets.costs.view"
    assert joni["departments"] and len(joni["departments"]) == 2
    assert _summary(s4, "cleo", None, "7d", batched=True)["approvals"]["quotes"]["count"] == 0


def test_the_route_answers_the_same_both_ways(world):
    s4, _ids = world
    for user in ("mona", "cleo", "joni"):
        bodies = []
        for batched in (False, True):
            with pytest.MonkeyPatch.context() as mp:
                if not batched:
                    _old_path(mp)
                dashboard.CACHE.clear()
                r = s4.c.get(f"{API}/tickets/dashboard", params={"period": "30d"}, headers=s4.h(user))
            assert r.status_code == 200, r.text
            body = r.json()
            for k in ("generated_at", "now", "since"):
                body.pop(k, None)
            body["daily"].pop("since", None)
            bodies.append(body)
        assert bodies[0] == bodies[1], user


def _shift(at: str, seconds: int) -> str:
    d = dt.datetime.strptime(at[:19], "%Y-%m-%dT%H:%M:%S") + dt.timedelta(seconds=seconds)
    return d.strftime("%Y-%m-%dT%H:%M:%S") + at[19:]


def test_the_batched_assignment_is_the_single_read_at_every_instant(world):
    """store_dash.pick_assignment over assignments_of() == store_dash.assignment_at() for every ticket at every instant that matters:
    each assignment's start and end, one second either side, every timeline row, and the tie of two assignments with the same start."""
    s4, ids = world
    every = _all_ids(s4)
    with s4.db.connection(mode="read") as conn:
        batch = store_dash.assignments_of(conn, every + ["no-such-ticket"])
        assert "no-such-ticket" not in batch
        assert len(batch[ids["r"]]) == 2 and len(batch[ids["a"]]) == 2
        checked = 0
        for tid in every:
            rows = batch.get(tid, [])
            instants = {ev["at"] for ev in conn.execute("SELECT at FROM ticket_events WHERE ticket_id = ?", (tid,))}
            for r in rows:
                for at in (r["assigned_at"], r["ended_at"]):
                    if at:
                        instants |= {at, _shift(at, -1), _shift(at, 1)}
            instants |= {"0000", "9999"}
            for at in sorted(instants):
                assert store_dash.pick_assignment(rows, at) == store_dash.assignment_at(conn, tid, at), (tid, at)
                checked += 1
        assert checked > 40
        twin = store_dash.pick_assignment(batch[ids["a"]], batch[ids["a"]][0]["assigned_at"])
        assert twin is not None and twin["assignee_name"] == "תאום", "the later rowid wins the tie, as in the SQL"
    with pytest.raises(store_dash.NotComparable):
        store_dash.pick_assignment([], None)


def test_an_assignment_nobody_prefetched_is_read_the_old_way(world):
    s4, ids = world
    with s4.db.connection(mode="read") as conn:
        asgs = dashboard._Assignments(conn)
        at = dashboard.stuck.iso(_now())
        assert asgs.at(ids["c"], at) == store_dash.assignment_at(conn, ids["c"], at)
        asgs.prefetch([ids["c"]])
        assert asgs.at(ids["c"], at) == store_dash.assignment_at(conn, ids["c"], at) is not None
        assert asgs.at(ids["c"], None) == store_dash.assignment_at(conn, ids["c"], None)  # not text: asked of the SQL


def test_the_one_pass_row_build_is_dict_of_row(world):
    """store._dicts == [dict(row) ...] (values, keys, key order) for the list read the board scan uses and for the batched read."""
    s4, _ids = world
    with s4.db.connection(mode="read") as conn:
        for sql in (store._TICKET_SELECT + " ORDER BY t.id", "SELECT 1 AS x, 2 AS X"):  # the second: a repeated name, case-insensitively
            new, old = store._dicts(conn.execute(sql)), _row_dicts(conn.execute(sql))
            assert new == old and [list(r) for r in new] == [list(r) for r in old]
        assert store._dicts(conn.execute("SELECT 1 AS x, 2 AS X")) == [{"x": 1, "X": 1}], "dict(row)'s first match for both names"


def test_every_list_and_scan_is_the_same_both_ways(world):
    s4, _ids = world
    for user in USERS:
        got = []
        for batched in (False, True):
            with pytest.MonkeyPatch.context() as mp:
                if not batched:
                    _old_path(mp)
                with s4.db.connection(mode="read") as conn:
                    v = _viewer(conn, user)
                    page, cursor = access.visible_page(v, scope="visible", limit=5)
                    scan = dashboard.board.scan(v, scope="visible", statuses=dashboard.board.model_open(), department_id=None, query="")
                    got.append(([(s.row, s.full, s.reasons, s.manager) for s in page], cursor,
                                [(s.row, s.full, s.reasons, s.manager) for s in scan.rows], scan.truncated))
        assert got[0] == got[1], user


def test_the_filtered_timeline_reads_are_the_filtered_full_reads(world):
    s4, _ids = world
    with s4.db.connection(mode="read") as conn:
        full = lambda st: _STATUS_MOVES(conn, st, "0000", "9999")  # noqa: E731
        cases = [(("closed",), {"kinds": sorted(dashboard.CLOSED_KINDS)}, lambda e: e["kind"] in dashboard.CLOSED_KINDS),
                 (dashboard.RETURN_TO, {"from_statuses": dashboard.RETURN_FROM}, lambda e: e["from_status"] in dashboard.RETURN_FROM),
                 (("new",), {"kinds": ("created",)}, lambda e: e["kind"] == "created"),
                 (("done", "closed"), {"kinds": ("status",), "from_statuses": ("in_progress", "done")},
                  lambda e: e["kind"] == "status" and e["from_status"] in ("in_progress", "done"))]
        for st, kw, keep in cases:
            want = [e for e in full(st) if keep(e)]
            assert store_dash.status_moves(conn, st, "0000", "9999", **kw) == want, (st, kw)
        assert any(store_dash.status_moves(conn, dashboard.RETURN_TO, "0000", "9999", from_statuses=dashboard.RETURN_FROM))
        assert store_dash.status_moves(conn, ("new",), "0000", "9999", kinds=()) == []
