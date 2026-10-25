"""WKR5-295 units C, F and H (FAKES ONLY): the native people writer on the COMBINED candidate (the join of WKDIRECT + WKWRITE + WKCAP +
WKB3 on release/2170W), its three crash windows, the original receipt readers and the lineage administration routes.

"Crash" here is an in-process stand-in: the Arx process of the first join stops recording at the named point (the lineage row is left
as a real crash leaves it) and a SECOND join - a new process: a new lineage holder whose clock is past the dead holder's writer lease, a
new direct socket - takes over. The real OS-process crash windows of the writer itself are tests/test_wkwrite_295_crash.py (WKWRITE).
WisKey is tests/wkwrite_fake.FakeWisKey behind the fake direct server of tests/test_wkjoin_295.py. Nothing reaches a network, Home
Assistant, a station or WisKey."""
from __future__ import annotations

import asyncio
import sqlite3
import uuid
from datetime import datetime, timedelta, timezone
from pathlib import Path
from types import SimpleNamespace
from typing import Any

import pytest
from conftest import as_user
from fastapi.testclient import TestClient
from test_wkjoin_295 import JoinServer
from w10_fake_station import SECRET
from wkwrite_fake import FakeWisKey

from smplwise.services import lease_events
from smplwise.services import wa_template_send as wts
from smplwise.services import wiskey_direct_join as join
from smplwise.services import wiskey_media_bridge as bridge
from smplwise.services import wiskey_native_write as nw
from smplwise.services import wiskey_write_lineage as wl

ACTOR = nw.WriteActor(user_id="arx-user-1", display_name="Operator One", session_active=True)
PIN_MARK = "MRKPIN-WKR5-9917"


class Crash(Exception):
    """The first process dies here: nothing after this point is recorded by it."""


@pytest.fixture(autouse=True)
def _restore_process_state() -> Any:
    saved = (lease_events.TRANSPORT, wts.TRANSPORT_PROVIDER, join.JOIN)
    yield
    lease_events.TRANSPORT, wts.TRANSPORT_PROVIDER, join.JOIN = saved


def _decision() -> nw.ArxDecision:
    return nw.ArxDecision(decision_id=str(uuid.uuid4()), grant_id="grant-1", grant_revision=3, permission_revision=3,
                          decided_at=datetime.now(timezone.utc))


class World:
    def __init__(self, tmp: Path) -> None:
        self.tmp = tmp
        self.main = tmp / "main.db"
        c = sqlite3.connect(self.main)
        c.execute("CREATE TABLE IF NOT EXISTS settings(key TEXT PRIMARY KEY, value TEXT)")
        c.commit()
        c.close()
        self.server = JoinServer()
        self.server.people = FakeWisKey()
        self.server.people.s["entry"] = "entry-1"
        self.procs: list[join.DirectJoin] = []

    def process(self, holder: str, *, skew: timedelta = timedelta(0)) -> join.DirectJoin:
        lin = wl.open_lineage(self.tmp, wl.SettingsAnchor(self.main), holder=holder, clock=lambda: datetime.now(timezone.utc) + skew)
        session = join.DirectCommandSession(bridge.DirectApiTransport(self.server.opener, lambda: SECRET))
        j = join.DirectJoin(session, provider_ok=lambda: True, key_ok=lambda: True, lineage=lin)
        j.command_port.timeout_s = 0.5
        self.procs.append(j)
        return j

    def creates(self) -> int:
        return sum(1 for c, _k, _p in self.server.received if c == "users/create")

    def stop(self) -> None:
        for j in self.procs:
            try:
                j.session.run_sync(self.server.stop(), 5)
            except Exception:  # noqa: BLE001
                pass
            j.close()


@pytest.fixture()
def world(tmp_path: Path) -> Any:
    w = World(tmp_path)
    yield w
    w.stop()


def _create(j: join.DirectJoin, origin: str) -> Any:
    outcome, _raw = asyncio.run(j.native_write("users/create", {"data": {"display_name": "New", "pin": PIN_MARK}}, actor=ACTOR,
                                               decision=_decision(), create_origin_ref=origin))
    return outcome


def _crash_at(lin: wl.WriteLineage, method: str, monkeypatch: Any) -> None:
    def die(*_a: Any, **_k: Any) -> Any:
        raise Crash(method)

    monkeypatch.setattr(lin, method, die)


# ================================================================ unit H: the three crash windows on the combined candidate

def test_window_1_crash_before_the_send_is_recovered_as_not_sent_and_nothing_left(world: World, monkeypatch: Any) -> None:
    p1 = world.process("proc-1")
    _crash_at(p1.lineage, "begin_send", monkeypatch)
    with pytest.raises(Crash):
        _create(p1, "arx-create:w1")
    (row,) = p1.lineage.open_intents()
    assert row.state == "intent" and world.creates() == 0  # the intent was COMMITTED before any I/O; no frame was written
    p2 = world.process("proc-2", skew=timedelta(seconds=60))  # past the dead holder's 30 s writer lease
    assert p2.recover_now(timeout=10) == {"not_sent": 1, "unknown": 0}
    assert p2.lineage.get(row.operation_id).state == "not_sent" and world.creates() == 0


def test_window_2_crash_after_the_send_without_ack_stays_unknown_and_is_never_resent(world: World, monkeypatch: Any) -> None:
    p1 = world.process("proc-1")
    world.server.people.faults["users/create"] = ["lost_before_commit"]  # WisKey never committed; the answer never came
    _crash_at(p1.lineage, "mark_unknown", monkeypatch)
    with pytest.raises(Crash):
        _create(p1, "arx-create:w2")
    (row,) = p1.lineage.open_intents()
    assert row.state == "sending" and world.creates() == 1
    p2 = world.process("proc-2", skew=timedelta(seconds=60))
    assert p2.recover_now(timeout=10) == {"not_sent": 0, "unknown": 1}
    out = asyncio.run(p2.resolve(row.operation_id))  # the original reader: a CURRENT read binding + the stored full original7
    assert (out.state, out.code) == ("unknown", "remote:unknown") and not out.replay_permitted
    assert world.creates() == 1, "UNKNOWN is a state: the write was not sent again"
    resolve = [p for c, _k, p in world.server.received if c == "peer_receipts/resolve"]
    assert len(resolve) == 1 and len(resolve[0]["original"]) == 7 and "original" in resolve[0]["original"]  # the full original7, as stored
    p2.close_unknown(row.operation_id, actor_ref="arx-user:admin", code="operator_closed")
    i = p2.lineage.get(row.operation_id)
    assert i.state == "unknown" and i.ended_at and i.closed_by == "arx-user:admin"  # closed stays UNKNOWN, never not_sent


def test_window_3_crash_after_person_and_receipt_commit_is_resolved_from_the_receipt(world: World, monkeypatch: Any) -> None:
    p1 = world.process("proc-1")
    world.server.people.faults["users/create"] = ["commit_then_lose_ack"]  # WisKey committed person + receipt; the ACK is lost
    _crash_at(p1.lineage, "mark_unknown", monkeypatch)
    with pytest.raises(Crash):
        _create(p1, "arx-create:w3")
    (row,) = p1.lineage.open_intents()
    assert row.state == "sending"
    p2 = world.process("proc-2", skew=timedelta(seconds=60))
    p2.recover_now(timeout=10)
    assert p2.lineage.get(row.operation_id).state == "unknown"
    out = asyncio.run(p2.resolve(row.operation_id))
    assert out.state == "committed" and out.person_revision == 1
    assert world.creates() == 1 and p2.lineage.get(row.operation_id).state == "committed"
    import json

    assert PIN_MARK not in json.dumps(p2.lineage.handoff_export())  # the raw PIN only ever travelled inside the signed command


def test_a_fenced_old_writer_cannot_open_the_send_door(world: World, monkeypatch: Any) -> None:
    p1 = world.process("proc-1")
    assert _create(p1, "arx-create:f1").state == "committed"
    p2 = world.process("proc-2", skew=timedelta(seconds=60))
    p2.recover_now(timeout=10)  # proc-2 takes the scope over (fence bumped)
    with pytest.raises(nw.NativeWriteError) as exc:  # proc-1 is still alive but lost the scope: refused before any intent or I/O
        _create(p1, "arx-create:f2")
    assert exc.value.code == "writer_busy"
    assert world.creates() == 1 and [i.create_origin_ref for i in p1.lineage.open_intents()] == []


def test_name_ref_apply_lost_is_read_back_by_the_same_actor_with_bulk_receipt(world: World) -> None:
    p1 = world.process("proc-1")
    world.server.people.seed_user("u-7", revision=4)
    world.server.people.faults["users/name_ref_apply_v1"] = ["commit_then_lose_ack"]

    async def rename() -> Any:
        writer = nw.NativePeopleWriter(p1.command_port, p1.lineage)
        await p1._ensure_recovered(writer)
        return await writer.rename(person_ref="u-7", expected_person_revision=4, display_name="Renamed", actor=ACTOR)

    out = asyncio.run(p1.session.run_async(rename()))
    assert out.state == "unknown"
    res = asyncio.run(p1.resolve(out.operation_id))
    assert res.state == "committed" and res.person_revision == 5
    receipts = [p for c, _k, p in world.server.received if c == "users/bulk_receipt"]
    assert receipts == [{"operation_id": out.operation_id}], "no `actor` parameter: the same pairing-service actor reads its receipt"
    applies = [c for c, _k, _p in world.server.received if c == "users/name_ref_apply_v1"]
    assert len(applies) == 1


# ================================================================ unit C: retention

def test_the_janitor_purges_only_ended_operations_after_30_days_hourly(world: World) -> None:
    p1 = world.process("proc-1")
    assert _create(p1, "arx-create:p1").state == "committed"
    world.server.people.faults["users/create"] = ["lost_before_commit"]
    open_unknown = _create(p1, "arx-create:p2")
    assert open_unknown.state == "unknown"
    assert p1.purge_due(now=0.0) == 0 and p1.purge_due(now=10.0) is None  # at most once an hour
    p1.lineage.clock = lambda: datetime.now(timezone.utc) + timedelta(days=31)
    assert p1.purge_due(now=4000.0) == 1  # the committed one; the open unknown is kept
    assert p1.lineage.get(open_unknown.operation_id).state == "unknown"
    join.JOIN = None
    assert join.janitor() is None


# ================================================================ the lineage administration routes

@pytest.fixture()
def app_world(settings, world: World, monkeypatch: Any) -> Any:
    from smplwise.main import create_app

    c = TestClient(create_app(settings))
    c.get("/api/v1/me")  # joni bootstraps as system administrator
    p = world.process("proc-route")
    monkeypatch.setattr(join, "JOIN", p)
    return SimpleNamespace(c=c, join=p, world=world)


BASE = "/api/v1/access-control/wiskey-lineage"


def test_routes_show_open_operations_resolve_and_close_for_an_administrator_only(app_world: Any) -> None:
    a = app_world
    a.world.server.people.faults["users/create"] = ["commit_then_lose_ack"]
    out = _create(a.join, "arx-create:r1")
    assert out.state == "unknown"
    assert a.c.get(BASE, headers=as_user("plain")).status_code == 403
    v = a.c.get(BASE).json()
    assert v["installed"] is True and v["lineage"]["writable"] is True
    assert [o["operation_id"] for o in v["lineage"]["open"]] == [out.operation_id]
    assert PIN_MARK not in str(v) and "original" not in v["lineage"]["open"][0]
    assert a.c.post(f"{BASE}/{out.operation_id}/resolve", headers=as_user("plain")).status_code == 403
    r = a.c.post(f"{BASE}/{out.operation_id}/resolve")
    assert r.status_code == 200 and r.json()["state"] == "committed" and r.json()["resent"] is False
    assert a.world.creates() == 1
    assert a.c.post(f"{BASE}/{out.operation_id}/close", json={"code": "x", "confirm": True}).status_code == 409  # committed: nothing to close


def test_close_route_needs_confirm_and_keeps_unknown(app_world: Any) -> None:
    a = app_world
    a.world.server.people.faults["users/create"] = ["lost_before_commit"]
    out = _create(a.join, "arx-create:r2")
    assert a.c.post(f"{BASE}/{out.operation_id}/close", json={"code": "operator_closed"}).status_code == 422
    r = a.c.post(f"{BASE}/{out.operation_id}/close", json={"code": "operator_closed", "confirm": True})
    assert r.status_code == 200 and r.json() == {"operation_id": out.operation_id, "state": "unknown", "closed": True, "resent": False}
    assert a.c.get(BASE).json()["lineage"]["open"] == []
    assert a.c.post(f"{BASE}/reinitialise", json={"confirm": "אתחול"}).status_code == 409  # an ok lineage needs no re-initialisation


def test_routes_without_an_installed_join_touch_nothing(settings, monkeypatch: Any) -> None:
    from smplwise.main import create_app

    c = TestClient(create_app(settings))
    c.get("/api/v1/me")
    monkeypatch.setattr(join, "JOIN", None)
    assert c.get(BASE).json() == {"installed": False, "lineage": None}
    r = c.post(f"{BASE}/{uuid.uuid4()}/close", json={"code": "x", "confirm": True})
    assert r.status_code == 409 and r.json()["code"] == "wiskey_direct_not_installed"
