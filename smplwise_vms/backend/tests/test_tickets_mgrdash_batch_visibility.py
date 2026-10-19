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
from smplwise.services.tickets import access, dashboard, store
from test_tickets_mgrdash_summary import _quote_and_claim, done_by
from tickets_s4_world import API, build_s4

# every kind of caller of the cast (tests/tickets_world.py): admin, department managers, an all-departments viewer who manages nothing,
# a member, a non-member creator, floor-scoped operators, a member denied tickets.view, a viewer without any ticket permission
USERS = ("joni", "mona", "cleo", "alda", "tom", "nora", "fred", "gil", "dina", "vic")
NOW = dt.datetime.now(dt.timezone.utc) + dt.timedelta(minutes=5)


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
    with s4.db.connection() as conn:
        conn.execute("UPDATE tickets SET created_by = 'dev-nora' WHERE id = ?", (n["id"],))
        conn.execute("UPDATE tickets SET created_by = 'dev-fred' WHERE id = ?", (fr["id"],))
    for k, t in zip("abcdefghnFvw", (a, b, c, d, e, f, g, h, n, fr, v1, v2)):
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


def _summary(s4, user: str, department_id: str | None, period: str, batched: bool) -> dict:
    with pytest.MonkeyPatch.context() as mp:
        if not batched:
            mp.setattr(dashboard._Managed, "prefetch", _per_ticket)
        with s4.db.connection(mode="read") as conn:
            return dashboard.summary(conn, _viewer(conn, user), department_id=department_id, period=period, now=NOW, tz=dt.timezone.utc)


def test_the_summary_is_identical_for_every_caller_department_and_period(world):
    s4, _ids = world
    for user in USERS:
        for period in ("today", "7d", "30d"):
            for department_id in (None, "dept-maintenance", s4.w.cleaning):
                old = _summary(s4, user, department_id, period, batched=False)
                new = _summary(s4, user, department_id, period, batched=True)
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
                    mp.setattr(dashboard._Managed, "prefetch", _per_ticket)
                dashboard.CACHE.clear()
                r = s4.c.get(f"{API}/tickets/dashboard", params={"period": "30d"}, headers=s4.h(user))
            assert r.status_code == 200, r.text
            body = r.json()
            for k in ("generated_at", "now", "since"):
                body.pop(k, None)
            body["daily"].pop("since", None)
            bodies.append(body)
        assert bodies[0] == bodies[1], user
