"""LEASE-BUILD: shared fakes for the capture-lease tests. Fakes only - no Home Assistant, bridge, WisKey, reader, door or key (the
pairing secret is the published golden-vector TEST constant). One fake clock drives the Arx ledger (wall + monotonic), the
bridge's time stage and the host's silence rule."""
from __future__ import annotations

import types
from datetime import datetime, timezone
from typing import Any

import pytest

from fake_trusted_bridge import TEST_SECRET, FakeLeaseBridge
from fake_wiskey import FakeLeaseHost

from smplwise.db import Database, bump_permission_revision, set_setting
from smplwise.services import capture_lease as cl
from smplwise.services import lease_events as le

T0 = 1_792_152_000  # 2026-10-16T12:00:00Z


class LeaseClock:
    """Wall (epoch) and monotonic time that only move when a test says so."""

    def __init__(self, t: float = T0) -> None:
        self.t = float(t)
        self.m = 1000.0

    def now(self) -> int:  # the bridge / host clock (epoch seconds)
        return int(self.t)

    def wall(self) -> datetime:
        return datetime.fromtimestamp(self.t, tz=timezone.utc)

    def mono(self) -> float:
        return self.m

    def advance(self, seconds: float) -> None:
        self.t += seconds
        self.m += seconds


def principal(user_id: str, source: str = "ingress") -> Any:
    return types.SimpleNamespace(user_id=user_id, username=user_id, display_name=user_id, source=source)


class LeaseWorld:
    def __init__(self, db: Database, settings: Any, clock: LeaseClock, host: FakeLeaseHost, bridge: FakeLeaseBridge) -> None:
        self.db, self.settings, self.clock, self.host, self.bridge = db, settings, clock, host, bridge

    def step(self, seconds: float = 0.0) -> None:
        if seconds:
            self.clock.advance(seconds)
        le.WORKER.step()

    def run(self, seconds: float, tick: float = 0.25) -> None:
        """Advance the clock in ticks, one worker round per tick (the thread's cadence)."""
        steps = int(round(seconds / tick))
        for _ in range(steps):
            self.clock.advance(tick)
            le.WORKER.step()

    def issue(self, actor: str = "dev-sam", station: str = "entry-a", reader: int = 0, person: str = "u1", activate: bool = True) -> cl.Lease:
        """A lease the way the route issues it (decision snapshot, ledger row) plus the host's session, without HTTP."""
        snap = cl.REG.snapshot(actor, station, person)
        with self.db.connection(label="test.issue") as conn:
            rev = cl.permission_revision(conn)
            lease = cl.issue(conn, principal=principal(actor), station_id=station, reader_id=reader, person_id=person, person_revision=4,
                             binding_revision=None, decision_revision=rev, start_request_id=le_request_id(), snap=snap)
        if activate:
            with self.db.connection(mode="read") as conn:
                signed = le.sign(conn, "capture_start", actor, actor, station, {"lease": lease.lease_object()}, request_id=lease.start_request_id)
            answer = self.bridge.request(self.settings, "capture_start", signed.text)
            session = answer["service_response"]["session"]["session_id"]
            assert cl.activate(self.db, lease.lease_ref, session)
        return lease

    def rows(self) -> list[dict[str, Any]]:
        with self.db.connection(mode="read") as conn:
            return [dict(r) for r in conn.execute("SELECT * FROM capture_leases ORDER BY created_at, id").fetchall()]

    def row(self, ref: str) -> dict[str, Any]:
        with self.db.connection(mode="read") as conn:
            return dict(conn.execute("SELECT * FROM capture_leases WHERE id = ?", (ref,)).fetchone())

    def audit(self, like: str = "intercom.capture_lease.%") -> list[dict[str, Any]]:
        with self.db.connection(mode="read") as conn:
            return [dict(r) for r in conn.execute("SELECT * FROM audit_log WHERE action LIKE ? ORDER BY rowid", (like,)).fetchall()]

    def bump(self) -> int:
        with self.db.connection(label="test.bump") as conn:
            return bump_permission_revision(conn)

    def events(self, action: str | None = None) -> list[dict[str, Any]]:
        return [e for e in self.host.events if action is None or e["action"] == action]


def le_request_id() -> str:
    import uuid

    return str(uuid.uuid4())


@pytest.fixture()
def lease_world(settings, monkeypatch) -> LeaseWorld:
    """A migrated database with a paired (TEST key) bridge, the route switched on for the test (MIN_BRIDGE patched - never in
    production code), the fake bridge + host as the lease transport, the worker attached without its thread, the fake clock."""
    cl.reset_for_tests()
    le.reset_for_tests()
    clock = LeaseClock()
    cl.set_clock(clock.wall, clock.mono)
    db = Database(settings.db_path)
    db.migrate()
    with db.connection() as conn:
        set_setting(conn, "bridge.secret", TEST_SECRET)
        set_setting(conn, "bridge.paired_at", "2026-10-16T11:00:00Z")
        set_setting(conn, "bridge.integration_version", "0.9.9")
        set_setting(conn, "installation_id", "arx-installation-1")
        set_setting(conn, cl.FLAG_KEY, "on")
    monkeypatch.setattr(cl, "MIN_BRIDGE_FOR_CAPTURE_LEASE", "0.9.0")
    monkeypatch.setattr(le, "AUTO_THREAD", False)
    host = FakeLeaseHost(clock)
    bridge = FakeLeaseBridge(host, clock)
    le.set_transport(bridge)
    le.WORKER.attach(db, settings)
    assert le.WORKER.ensure_announced(), "the stream is announced to the host before any lease"
    world = LeaseWorld(db, settings, clock, host, bridge)
    yield world
    le.reset_for_tests()
    cl.reset_for_tests()
