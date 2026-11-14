"""FOLLOWUPS-2406: a refused Home Assistant token is retried on a slow shared ladder (not once a minute by every loop), and the push
sockets wait for their next frame without holding a thread of the default executor. (The WisKey re-probe ladder is in
tests/test_intercom.py; the refused-token outage scenario in tests/test_outage_run_t035.py::test_s03_token_revoked.)"""
from __future__ import annotations

import asyncio
import contextlib
import json
import queue
import threading
import time
from dataclasses import replace
from typing import Any

import pytest
from conftest import as_user
from fastapi.testclient import TestClient
from test_intercom import FakeHa, ha_config, normal

from smplwise.main import create_app
from smplwise.services import ha_client, ha_sync, push_queue


# ================================================================ the refused-token ladder (ha_client)

def test_refused_ladder_values():
    assert [ha_client.refused_step(n) for n in range(1, 9)] == [30.0, 60.0, 120.0, 240.0, 480.0, 900.0, 900.0, 900.0]
    assert ha_client.refused_step(10_000) == 900.0 and ha_client.refused_step(10**7) == 900.0, "capped at 15 minutes, no float overflow"


def test_a_refused_token_is_held_one_attempt_per_step_and_a_new_token_never_is(monkeypatch):
    monkeypatch.setattr(ha_client, "REFUSED_FIRST_S", 0.2)
    monkeypatch.setattr(ha_client, "REFUSED_MAX_S", 0.8)
    assert ha_client.refused_wait("old") == 0 and ha_client.refusal_state("old") is None
    ha_client.note_refused("old")
    assert 0.1 < ha_client.refused_wait("old") <= 0.21
    state = ha_client.refusal_state("old")
    assert state and state["refusals"] == 1 and state["next_attempt_at"].endswith("Z") and state["since"].endswith("Z")
    assert ha_client.refused_wait("new") == 0, "a different token (the owner's new one, a fresh Supervisor token) is not held"
    assert ha_client._claim_attempt("old") > 0, "before its step: held"
    time.sleep(0.22)
    assert ha_client._claim_attempt("old") == 0, "the step passed: one attempt goes"
    assert ha_client._claim_attempt("old") > 0, "and only one: the next caller waits for the following step"
    ha_client.note_refused("old")
    assert 0.3 < ha_client.refused_wait("old") <= 0.41, "the second refusal doubles the wait"
    ha_client.note_accepted("old")
    assert ha_client.refused_wait("old") == 0 and ha_client.refusal_state("old") is None, "accepted: forgotten"
    ha_client.note_refused("old")
    gen = ha_client.refusals_generation()
    ha_client.reset_refusals()
    assert ha_client.refused_wait("old") == 0 and ha_client.refusals_generation() == gen + 1


def test_the_ledger_never_holds_the_token_itself():
    ha_client.note_refused("secret-token-value")
    assert all("secret-token-value" not in k for k in ha_client._refusals)
    assert "secret-token-value" not in json.dumps(ha_client.refusal_state("secret-token-value"))


def test_a_held_session_does_not_contact_home_assistant(settings, monkeypatch):
    import websockets

    monkeypatch.setattr(ha_client, "REFUSED_FIRST_S", 5.0)
    connects: list[str] = []

    def connect(url: str, **_kw: Any) -> FakeHa:
        connects.append(url)
        return FakeHa(lambda msg, fake: normal(msg, fake))

    monkeypatch.setattr(websockets, "connect", connect)
    s = replace(settings, ha_url="http://ha.local:8123", ha_token="revoked")

    async def ready(_call: Any) -> None:
        return None

    async def run() -> str:
        stop = asyncio.Event()
        try:
            await ha_client.ws_session(s, ready, lambda data: None, stop)
        except Exception as exc:  # noqa: BLE001
            return f"{getattr(exc, 'code', type(exc).__name__)}|{bool(getattr(exc, 'details', {}).get('held'))}"
        return "ok"

    assert asyncio.run(run()) == "ha_forbidden|False", "FakeHa answers auth_invalid for any token but 't'"
    assert len(connects) == 1
    assert asyncio.run(run()) == "ha_forbidden|True", "held: refused at once"
    assert len(connects) == 1, "Home Assistant was not asked again before the step"
    ok = replace(s, ha_token="t")
    stop = asyncio.Event()
    stop.set()

    async def run_ok() -> None:
        await ha_client.ws_session(ok, ready, lambda data: None, stop)

    asyncio.run(run_ok())
    assert len(connects) == 2, "another token goes through at once"


# ================================================================ the HA sync loop on a refused token

@pytest.fixture()
def ha_state_kept():
    st = ha_sync.STATE
    saved = {k: st.__dict__.get(k) for k in ("last_error", "auth_refusals", "next_attempt_at", "started_at", "reconnects")}
    yield st
    st.__dict__.update(saved)


def test_ha_sync_backs_off_slowly_on_a_refused_token_and_a_reset_retries_at_once(settings, monkeypatch, ha_state_kept):
    """Every `auth` is answered `auth_invalid`. The sync's attempts follow the refused ladder (scaled down: 0.2 s doubling to 0.8 s)
    instead of its own back-off (scaled to 0.05 s), the state says why (`ha_forbidden`, the count, the next attempt), and
    `note_restart_initiated` (the add-on restarted the platform) ends the wait at once."""
    import websockets

    monkeypatch.setattr(ha_client, "REFUSED_FIRST_S", 0.2)
    monkeypatch.setattr(ha_client, "REFUSED_MAX_S", 0.8)
    monkeypatch.setattr(ha_sync, "BACKOFF_START_S", 0.05)
    monkeypatch.setattr(ha_sync, "BACKOFF_MAX_S", 0.1)
    auths: list[float] = []

    class Refusing(FakeHa):
        async def send(self, raw: str) -> None:
            if json.loads(raw).get("type") == "auth":
                auths.append(time.monotonic())
            await super().send(raw)

    monkeypatch.setattr(websockets, "connect", lambda url, **kw: Refusing(lambda msg, fake: [ha_config(msg)]))
    s = replace(settings, ha_url="http://ha.local:8123", ha_token="revoked")
    sync = ha_sync.HaSync()
    sync.settings = s
    sync.db = object()  # never reached: the session ends at the auth step
    sync.stop.clear()
    thread = threading.Thread(target=sync._run, daemon=True)
    thread.start()
    try:
        end = time.monotonic() + 5
        while len(auths) < 4 and time.monotonic() < end:
            time.sleep(0.02)
        assert len(auths) >= 4, auths
        gaps = [b - a for a, b in zip(auths, auths[1:])]
        for gap, step in zip(gaps, (0.2, 0.4, 0.8)):
            assert gap >= step * 0.9, (gaps, "an auth came before its step")
        assert ha_sync.STATE.last_error == "ha_forbidden"
        assert ha_sync.STATE.auth_refusals >= 3 and ha_sync.STATE.next_attempt_at
        assert {"auth_refusals", "next_attempt_at"} <= set(ha_sync.STATE.as_dict())
        # now on the cap: a reset (a new setting / a platform restart started by the add-on) retries at once
        monkeypatch.setattr(ha_client, "REFUSED_FIRST_S", 30.0)
        monkeypatch.setattr(ha_client, "REFUSED_MAX_S", 30.0)
        ha_client.note_refused("revoked")  # the next wait is now 30 s
        time.sleep(0.9)
        before = len(auths)
        asked = time.monotonic()
        ha_sync.note_restart_initiated()
        end = time.monotonic() + 3
        while len(auths) == before and time.monotonic() < end:
            time.sleep(0.02)
        assert len(auths) > before and auths[before] - asked < 1.6, "the reset ended the 30 s wait"
    finally:
        sync.shutdown()
        thread.join(timeout=5)


# ================================================================ the push sockets do not hold a thread each

def test_push_queue_wakes_its_waiter_without_a_thread():
    q = push_queue.PushQueue(maxsize=5)

    async def run() -> tuple[Any, float, bool]:
        t0 = time.monotonic()
        threading.Timer(0.15, lambda: q.put_nowait({"n": 1})).start()
        got = await push_queue.next_item(q, 5)
        waited = time.monotonic() - t0
        try:
            await push_queue.next_item(q, 0.1)
            empty = False
        except queue.Empty:
            empty = True
        return got, waited, empty

    got, waited, empty = asyncio.run(run())
    assert got == {"n": 1} and waited < 1.0 and empty
    assert q._waker is None, "the waiter is removed once it returned"
    for i in range(5):
        q.put_nowait(i)
    with pytest.raises(queue.Full):
        q.put_nowait(5)  # a slow socket still loses frames as before (the publishers catch queue.Full)


def test_a_plain_queue_still_works():
    q: queue.Queue = queue.Queue()

    async def run() -> Any:
        threading.Timer(0.1, lambda: q.put_nowait("x")).start()
        return await push_queue.next_item(q, 2)

    assert asyncio.run(run()) == "x"


def test_a_state_push_is_not_held_up_by_other_idle_sockets(settings):
    """Each idle /events/ws socket (no camera event comes) used to hold one thread of the default executor (at most 32 threads) in
    `q.get(timeout=30)`. With the pool full, a /ha/ws socket's wait queued behind them, so a state push reached its screen only when
    one of those 30 s waits ran out - the home-screen weather card's flake in the combined fixture runs, where several browsers each
    hold their three sockets. Now no socket holds a thread: the push arrives at once."""
    idle = 34  # more than the largest default executor (min(32, cpu_count + 4))
    with TestClient(create_app(settings)) as c, contextlib.ExitStack() as stack:
        for _ in range(idle):
            stack.enter_context(c.websocket_connect("/api/v1/events/ws", headers=as_user("joni")))
        ws = stack.enter_context(c.websocket_connect("/api/v1/ha/ws", headers=as_user("joni")))
        time.sleep(0.5)
        t0 = time.monotonic()
        ha_sync.publish({"type": "ha_sync_state", "connected": True})
        kind = json.loads(ws.receive_text())["type"]
        elapsed = time.monotonic() - t0
    assert kind == "ha_sync_state", kind
    assert elapsed < 5, f"the push took {elapsed:.1f} s behind {idle} idle sockets"
