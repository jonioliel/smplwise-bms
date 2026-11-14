"""TICKETS-PERF-ERASE-2435 (code review 2026-11-13, F-02): the outbox worker's queries reach the partial index built for them.

`idx_ticket_outbox_queue` (migrations 0081 / 0089 / 0128 / 0170) is declared `WHERE state IN ('queued', 'held', 'sending')`. SQLite
uses a partial index only when the query's WHERE carries a term that implies its predicate, and `state IN ('queued', 'held')` or
`state = ?` is not proved to. `due()` and `any_open()` run on every 2-second worker check, `open_rows()` / `in_state('sending')` on
every tick, and final rows stay 90 days - before the fix each was a full SCAN of ticket_outbox.

Over the REAL migrated schema, with a row in every state and hold reason:
- the statements the code really sends (captured with the trace callback) plan as SEARCH ... USING ... idx_ticket_outbox_queue;
- the rows (and their order) are the ones the pre-fix SQL returns, kept here verbatim as the reference;
- in_state() for a state outside the index keeps its old query and its rows.
No migration: the schema is unchanged. Every value here is invented."""
from __future__ import annotations

import datetime as dt
import itertools

import pytest

from smplwise.db import Database
from smplwise.services.tickets import outbox_store as obs

UTC = dt.timezone.utc
NOW = dt.datetime(2026, 11, 13, 10, 0, tzinfo=UTC)
STATES = ("queued", "held", "sending", "sent", "refused", "unknown", "not_sent", "cancelled", "superseded")
HELD = (None, "send_hours", "channel_down", "account_unmapped", "module_off")

# the pre-fix SQL, verbatim (outbox_store.py at v2.43.4) - the reference the rewritten queries must match row for row
OLD_OPEN = "SELECT * FROM ticket_outbox WHERE state IN ('queued', 'held') ORDER BY priority, not_before, created_at, id"
OLD_IN_STATE = "SELECT * FROM ticket_outbox WHERE state = ? ORDER BY created_at, id"
OLD_DUE_OFF = ("SELECT 1 FROM ticket_outbox WHERE state IN ('queued', 'held') AND "
               "(held_reason IS NULL OR held_reason != 'module_off') LIMIT 1")
OLD_DUE_ON = ("SELECT 1 FROM ticket_outbox WHERE state IN ('queued', 'held') AND (not_before <= ? OR held_reason IN "
              "('channel_down', 'account_unmapped', 'module_off')) LIMIT 1")
OLD_ANY_OPEN = "SELECT 1 FROM ticket_outbox WHERE state IN ('queued', 'held', 'sending') LIMIT 1"


def _iso(t: dt.datetime) -> str:
    return t.strftime("%Y-%m-%dT%H:%M:%SZ")


@pytest.fixture()
def db(client, settings):
    client.get("/api/v1/me")  # the app's start-up migrated the database
    return Database(settings.db_path)


def _seed(conn, *, only: tuple[str, ...] = STATES) -> int:
    n = 0
    for state, held, prio, minutes in itertools.product(only, HELD, (0, 1, 2), (-30, 30)):
        if held is not None and state != "held":
            continue
        n += 1
        t = NOW + dt.timedelta(minutes=minutes)
        conn.execute(
            "INSERT INTO ticket_outbox (id, recipient_kind, channel, purpose, use_key, state, held_reason, not_before, priority, "
            "created_at, updated_at) VALUES (?, 'test', 'whatsapp', 'test', 'tickets', ?, ?, ?, ?, ?, ?)",
            (f"ob-{n:04d}", state, held, _iso(t), prio, _iso(NOW - dt.timedelta(minutes=n % 7)), _iso(NOW)))
    return n


def _plan(conn, sql: str) -> str:
    return " | ".join(str(r[3]) for r in conn.execute("EXPLAIN QUERY PLAN " + sql).fetchall())


def _traced(conn, fn):
    seen: list[str] = []
    conn.set_trace_callback(seen.append)
    try:
        out = fn()
    finally:
        conn.set_trace_callback(None)
    return out, [s for s in seen if "ticket_outbox" in s and s.lstrip().upper().startswith("SELECT")]


def _ids(rows) -> list[str]:
    return [r.id if hasattr(r, "id") else r["id"] for r in rows]


def test_the_worker_queries_plan_through_the_queue_index(db):
    store = obs.SqliteOutboxStore(db)
    with db.connection() as conn:
        _seed(conn)
        with obs.bound(conn):
            calls = {
                "open_rows": lambda: store.open_rows(),
                "in_state(sending)": lambda: store.in_state("sending"),
                "due(on)": lambda: obs.due(conn, NOW, True),
                "due(off)": lambda: obs.due(conn, NOW, False),
                "any_open": lambda: obs.any_open(conn),
            }
            for name, fn in calls.items():
                _out, sqls = _traced(conn, fn)
                assert len(sqls) == 1, (name, sqls)
                plan = _plan(conn, sqls[0])
                assert "idx_ticket_outbox_queue" in plan and "SCAN ticket_outbox" not in plan, f"{name}: {plan}"
        # the reference: the old forms really were scans (else this test proves nothing about the fix)
        assert "SCAN ticket_outbox" in _plan(conn, OLD_OPEN)
        assert "SCAN ticket_outbox" in _plan(conn, OLD_DUE_OFF)


def test_the_rows_are_the_rows_of_the_old_queries(db):
    store = obs.SqliteOutboxStore(db)
    with db.connection() as conn:
        assert _seed(conn) > 20
        with obs.bound(conn):
            assert _ids(store.open_rows()) == _ids(conn.execute(OLD_OPEN).fetchall())
            assert store.open_rows(), "the seed has open rows"
            for state in STATES:
                assert _ids(store.in_state(state)) == _ids(conn.execute(OLD_IN_STATE, (state,)).fetchall()), state
                assert store.in_state(state), state
            for now in (NOW - dt.timedelta(hours=1), NOW, NOW + dt.timedelta(hours=1)):
                assert obs.due(conn, now, True) is (conn.execute(OLD_DUE_ON, (obs.iso(now),)).fetchone() is not None)
            assert obs.due(conn, NOW, False) is (conn.execute(OLD_DUE_OFF).fetchone() is not None)
            assert obs.any_open(conn) is (conn.execute(OLD_ANY_OPEN).fetchone() is not None)


@pytest.mark.parametrize("only,expect", [
    ((), (False, False, False)),  # empty outbox
    (("sent", "cancelled"), (False, False, False)),  # only final rows: nothing due, nothing open
    (("sending",), (False, False, True)),  # in flight only: not due, still open
    (("held",), (True, True, True)),  # held rows: module_off / channel_down ones are due when the module is on
])
def test_due_and_any_open_answer_like_before_on_every_mix(db, only, expect):
    with db.connection() as conn:
        if only:
            _seed(conn, only=only)
        got = (obs.due(conn, NOW - dt.timedelta(hours=1), True), obs.due(conn, NOW, False), obs.any_open(conn))
        old = (conn.execute(OLD_DUE_ON, (obs.iso(NOW - dt.timedelta(hours=1)),)).fetchone() is not None,
               conn.execute(OLD_DUE_OFF).fetchone() is not None,
               conn.execute(OLD_ANY_OPEN).fetchone() is not None)
        assert got == old == expect, (only, got, old)
