"""CR-TK-OUTBOX-FILTER (code review 2026-11-13, 01:F-16): the outbox asks its store for the open rows it needs.

Before the change `enqueue` (supersede the older message of one assignment), `cancel_where` (a revoked link, an erased contact, a
closed ticket) and `open_count` (the account screen) each loaded and decoded EVERY open row and filtered in Python, under the outbox
lock. `open_rows_where(...)` is the same selection done by the store.

Both implementations of `outbox.OutboxStore` are held to one reference - "the rows of open_rows(), in its order, that match every
filter given" - over the same seed: the in-memory reference store and `SqliteOutboxStore` on the REAL migrated schema. The outbox's
own behaviour (states, supersede, cancel, counts) is covered by tests/test_tickets_msg_outbox.py. Every value here is invented."""
from __future__ import annotations

import datetime as dt
import itertools
import random
import sqlite3

import pytest

from smplwise.db import Database
from smplwise.services.tickets import outbox as ob
from smplwise.services.tickets import outbox_store as obs

UTC = dt.timezone.utc
NOW = dt.datetime(2026, 11, 16, 10, 0, tzinfo=UTC)
STATES = ("queued", "held", "sending", "sent", "cancelled", "superseded")
FILTERS = ("assignment_id", "link_id", "contact_id", "ticket_id", "use_key")
VALUES = {"assignment_id": (None, "asg-1", "asg-2"), "link_id": (None, "lnk-1", "lnk-2"), "contact_id": (None, "con-1", "con-2"),
          "ticket_id": (None, "tkt-1", "tkt-2"), "use_key": ("tickets.messages", "tickets.codes")}


def _rows() -> list[ob.OutboxRow]:
    """Rows over every state and a spread of the five filter columns, priorities and times (so the order matters)."""
    out = []
    rng = random.Random(2440)
    for n, (state, prio, minutes) in enumerate(itertools.product(STATES, (0, 1, 2), (-45, -5, 20, 20)), start=1):
        asg, lnk, con, tkt, use = (rng.choice(VALUES[f]) for f in FILTERS)
        out.append(ob.OutboxRow(
            id=f"ob-{n:04d}", purpose="test", channel="whatsapp", use_key=use, created_at=NOW - dt.timedelta(minutes=n % 5),
            not_before=NOW + dt.timedelta(minutes=minutes), recipient_kind="test", contact_id=con, ticket_id=tkt, assignment_id=asg,
            link_id=lnk, state=state, held_reason="send_hours" if state == "held" else None, priority=prio, updated_at=NOW))
    return out


def _reference(store, **filters) -> list[str]:
    """What the three callers did before the change: every open row, filtered here."""
    wanted = {k: v for k, v in filters.items() if v is not None}
    return [r.id for r in store.open_rows() if all(getattr(r, k) == v for k, v in wanted.items())]


def _cases():
    yield {}
    for name in FILTERS:
        for value in (*[v for v in VALUES[name] if v is not None], "nobody"):
            yield {name: value}
    yield {"link_id": "lnk-1", "contact_id": "con-1"}
    yield {"link_id": "lnk-1", "contact_id": "con-2", "ticket_id": "tkt-1"}
    yield {"assignment_id": "asg-2", "use_key": "tickets.codes"}
    yield {"assignment_id": "asg-1", "link_id": "lnk-1", "contact_id": "con-1", "ticket_id": "tkt-1", "use_key": "tickets.messages"}
    yield {"ticket_id": "tkt-2", "use_key": "tickets.messages"}


def _check(store) -> None:
    assert len(store.open_rows()) > 20, "the seed has open rows"
    hits = 0
    for case in _cases():
        got = [r.id for r in store.open_rows_where(**case)]
        assert got == _reference(store, **case), case
        hits += bool(got)
    assert hits >= 12, "the cases really select rows"
    assert [r.id for r in store.open_rows_where()] == [r.id for r in store.open_rows()]
    assert all(r.state in ob.OPEN_STATES for r in store.open_rows_where(use_key="tickets.messages"))


def test_memory_store_filters_like_the_python_loop():
    store = ob.MemoryOutboxStore()
    for row in _rows():
        store.insert(row)
    _check(store)


@pytest.fixture()
def db(client, settings):
    client.get("/api/v1/me")  # the app's start-up migrated the database
    return Database(settings.db_path)


def test_sqlite_store_filters_like_the_python_loop(db, settings):
    raw = sqlite3.connect(settings.db_path)  # a plain connection: the invented ticket ids name no ticket row (no foreign-key check)
    try:
        for row in _rows():
            data = obs.to_db(row)
            raw.execute(f"INSERT INTO ticket_outbox({', '.join(obs.COLUMNS)}) VALUES ({', '.join('?' * len(obs.COLUMNS))})",
                        tuple(data[c] for c in obs.COLUMNS))
        raw.commit()
    finally:
        raw.close()
    store = obs.SqliteOutboxStore(db)
    with db.connection(mode="read") as conn, obs.bound(conn):
        _check(store)
        seen: list[str] = []
        conn.set_trace_callback(seen.append)
        try:
            store.open_rows_where(link_id="lnk-1", ticket_id="tkt-1")
        finally:
            conn.set_trace_callback(None)
        sqls = [s for s in seen if "ticket_outbox" in s]
        assert len(sqls) == 1 and "link_id = " in sqls[0] and "ticket_id = " in sqls[0], sqls
        plan = " | ".join(str(r[3]) for r in conn.execute("EXPLAIN QUERY PLAN " + sqls[0]).fetchall())
        assert "SCAN ticket_outbox" not in plan, f"the filtered read uses an index: {plan}"


def test_the_outbox_callers_use_the_filtered_read():
    """enqueue / cancel_where / open_count never ask for the whole open queue any more (the worker's tick still does)."""
    from tickets_msg_fakes import make_env

    env = make_env()
    calls: list[tuple[str, dict]] = []

    class Spy:
        """The store as the outbox sees it; the inner store's own calls are not recorded."""

        def __init__(self, inner) -> None:
            self.inner = inner

        def __getattr__(self, name):
            return getattr(self.inner, name)

        def open_rows(self):
            calls.append(("open_rows", {}))
            return self.inner.open_rows()

        def open_rows_where(self, **filters):
            calls.append(("open_rows_where", {k: v for k, v in filters.items() if v is not None}))
            return self.inner.open_rows_where(**filters)

    object.__setattr__(env.outbox.p, "store", Spy(env.store))
    env.outbox.open_count("tickets.messages")
    env.outbox.cancel_where("link_revoked", NOW, link_id="lnk-9")
    env.outbox.cancel_where("ticket_closed", NOW, ticket_id="tkt-9", contact_id="con-9")
    assert calls == [("open_rows_where", {"use_key": "tickets.messages"}), ("open_rows_where", {"link_id": "lnk-9"}),
                     ("open_rows_where", {"contact_id": "con-9", "ticket_id": "tkt-9"})]
