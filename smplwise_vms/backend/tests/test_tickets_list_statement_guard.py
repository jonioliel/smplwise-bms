"""TICKETS-PERF-ERASE-2435 (code review 2026-11-13, F-01): the list readers read the tickets module switch ONCE per call, not once per
candidate row - the shape visible_many() already had (MGRDASH speed fix).

Before the fix access.visible_page, access._table_scan (the table, its facets and the CSV export), access.visible_for_entity and
rfq.visible_page called visible() per row, and visible() read the `tickets.enabled` setting each time (51 of 63 statements on
GET /tickets in the review's measurement). These tests hold the fixed path to the per-row one:

- `per_row` puts the old shape back (the switch read beside every _decide) by wrapping _decide, so the SAME routes answer through the
  old and the new path on the same database: every caller, every route, the bodies must be byte-identical;
- the switch is counted: the per-row path reads it about once per row, the fixed path a constant number of times that does not grow
  with the number of tickets;
- with the module off the service functions still return nothing (the routes answer feature_disabled before reaching them).

Every name and number here is invented."""
from __future__ import annotations

import contextlib
from typing import Any

import pytest

from smplwise.services.tickets import access, export, rfq as rfq_mod
from test_tickets_mgrdash_batch_visibility import USERS, _viewer, world  # noqa: F401 - `world` is the shared mixed-permission seed
from tickets_s4_world import API

ROUTES = (
    "/tickets?status=all",
    "/tickets?status=all&limit=3",  # several pages' worth of candidates per call (SCAN_FACTOR x limit)
    "/tickets?scope=mine&status=all",
    "/tickets/table",
    "/tickets/facets",
    "/tickets/board",
    "/tickets/export.csv",
    "/tickets/rfqs?state=all",
)


@pytest.fixture(autouse=True)
def _no_export_rate(monkeypatch):
    monkeypatch.setattr(export, "rate_check", lambda _uid: 0)  # the CSV route is asked many times in a row here


@contextlib.contextmanager
def counting(monkeypatch):
    """Count every read of the module switch made through access.module_on (the list readers and rfq call it by that name)."""
    calls = {"n": 0}
    real = access.module_on

    def counted(conn):
        calls["n"] += 1
        return real(conn)

    monkeypatch.setattr(access, "module_on", counted)
    try:
        yield calls
    finally:
        monkeypatch.setattr(access, "module_on", real)


@contextlib.contextmanager
def per_row(monkeypatch):
    """The pre-fix shape: the module switch is read again beside every per-row decision (visible() = switch + _decide)."""
    real_t, real_r = access._decide, rfq_mod._decide
    monkeypatch.setattr(access, "_decide", lambda v, row: real_t(v, row) if access.module_on(v.conn) else None)
    monkeypatch.setattr(rfq_mod, "_decide", lambda v, row: real_r(v, row) if access.module_on(v.conn) else None)
    try:
        yield
    finally:
        monkeypatch.setattr(access, "_decide", real_t)
        monkeypatch.setattr(rfq_mod, "_decide", real_r)


def _answer(s4, user: str, route: str) -> tuple[int, Any]:
    """The status and the body: a 200 byte for byte; a refusal by its code and details (its request id differs per request)."""
    r = s4.c.get(f"{API}{route}", headers=s4.h(user))
    if r.status_code == 200:
        return 200, r.content
    body = r.json()
    return r.status_code, (body.get("code"), body.get("details"))


def _rfqs(s4, n: int) -> None:
    from test_tickets_rfq import make

    for _ in range(n):
        make(s4)


def test_every_list_route_answers_the_same_through_the_old_and_the_new_path(world, monkeypatch):
    s4, _ids = world
    _rfqs(s4, 3)
    answered = 0
    for user in USERS:
        for route in ROUTES:
            new = _answer(s4, user, route)
            with per_row(monkeypatch):
                old = _answer(s4, user, route)
            assert new == old, f"{user} {route}: the fixed path answered differently ({new[0]} vs {old[0]})"
            answered += new[0] == 200
    assert answered > len(USERS) * 2, "the comparison is only worth something when the routes really answer"


@pytest.mark.parametrize("route", ROUTES)
def test_the_switch_is_not_read_once_per_row(world, monkeypatch, route):
    s4, _ids = world
    _rfqs(s4, 3)
    with counting(monkeypatch) as fixed:
        status, _ = _answer(s4, "joni", route)
    assert status == 200
    with per_row(monkeypatch), counting(monkeypatch) as old:
        _answer(s4, "joni", route)
    rows = old["n"] - fixed["n"]  # the per-row path's extra reads = the rows it decided
    assert rows >= 3, f"{route}: the seed must give the reader rows to decide (old {old['n']}, fixed {fixed['n']})"
    assert fixed["n"] <= 4, f"{route}: {fixed['n']} reads of the module switch for one request"


def test_the_count_does_not_grow_with_the_tickets(world, monkeypatch):
    s4, _ids = world
    counts = []
    for extra in (0, 12):
        for _ in range(extra):
            s4.ticket("joni", "בדיקת עומס")
        with counting(monkeypatch) as c:
            for route in ROUTES:
                assert _answer(s4, "joni", route)[0] == 200, route
        counts.append(c["n"])
    assert counts[0] == counts[1], f"module switch reads grew with the tickets: {counts}"


def test_the_device_tab_reads_the_switch_once_and_decides_the_same(world, monkeypatch):
    s4, ids = world
    with s4.db.connection() as conn:
        conn.execute("UPDATE tickets SET entity_id = 'light.f01_lobby'")  # every ticket of the seed belongs to one device
    for user in USERS:
        with s4.db.connection(mode="read") as conn:
            with counting(monkeypatch) as fixed:
                new = access.visible_for_entity(_viewer(conn, user), "light.f01_lobby", None, limit=200)
            with per_row(monkeypatch):
                old = access.visible_for_entity(_viewer(conn, user), "light.f01_lobby", None, limit=200)
        assert new == old, user
        assert fixed["n"] == 1, (user, fixed["n"])
    with s4.db.connection(mode="read") as conn:
        assert len(access.visible_for_entity(_viewer(conn, "joni"), "light.f01_lobby", None, limit=200)) == len(ids)


def test_module_off_still_yields_nothing(world, monkeypatch):
    s4, _ids = world
    _rfqs(s4, 2)
    assert s4.c.patch(f"{API}/settings", json={"tickets.enabled": "false"}).status_code == 200
    with s4.db.connection(mode="read") as conn:
        v = _viewer(conn, "joni")
        with counting(monkeypatch) as c:
            page, _cursor = access.visible_page(v, scope="visible", statuses=None)
            assert page == []
            assert access.visible_for_entity(v, "light.f01_lobby", None) == []
            assert rfq_mod.visible_page(v, state="all")[0] == []
        assert c["n"] == 3
