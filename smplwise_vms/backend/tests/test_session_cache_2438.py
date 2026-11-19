"""CR-SESSION-CACHE-2438 (code review 2026-11-13, part 02, P2-4 and P2-8).

P2-4: the session cache of local_identity (Arx-only sessions) and app_session (the phone app's web-view sessions) is one class,
services/session_cache.SessionCache. Covered here: the shared behaviour (time-to-live, expiry, eviction, drop_user, clear and the close
queue), the stricter clock-moved-back rule now in both stores (lead decision L4), and the rule that a cache never lets a revoked session
through - also when a resolve read the session row just before the revocation committed and puts it back after the revocation's drop.

P2-8: a failing capture-lease hook is logged by every wrapper (reason only, never an id)."""
from __future__ import annotations

import dataclasses
import json
import logging

import pytest
from fastapi.testclient import TestClient
from starlette.websockets import WebSocketDisconnect
from test_app_refresh_295 import rx  # noqa: F401 - the shared fixture
from test_app_session_295 import me, signed_in
from test_local_identity import lx  # noqa: F401 - the shared fixture
from test_remote_access import ORIGIN

from smplwise.services import app_session as xs
from smplwise.services import local_identity as li
from smplwise.services import session_cache as sc

WS = "/arx/api/v1/me/ws"


@dataclasses.dataclass
class Sess:
    sid_hash: str
    user_id: str = "u1"
    chain_id: str = "c1"
    loaded_at: float = 1000.0
    expires_at: float = 10_000.0
    idle_expires_at: float = 10_000.0


class Sock:
    pass


class Clock:
    def __init__(self, t: float = 1000.0) -> None:
        self.t = t

    def __call__(self) -> float:
        return self.t


def _cache(clock: Clock, ttl: float = 15.0) -> sc.SessionCache:
    return sc.SessionCache(clock=clock, ttl_s=lambda: ttl)


# ---------------------------------------------------------------- the shared cache (P2-4)

def test_get_within_the_time_to_live_and_not_after():
    clock = Clock()
    c = _cache(clock)
    c.put(Sess("a"))
    assert c.get("a").sid_hash == "a"
    clock.t += 15.0
    assert c.get("a") is not None  # the boundary itself is still fresh (strictly greater expires)
    clock.t += 0.01
    assert c.get("a") is None and "a" not in c._by_sid


@pytest.mark.parametrize("field", ["expires_at", "idle_expires_at"])
def test_an_expired_or_idle_session_is_dropped(field):
    clock = Clock()
    c = _cache(clock)
    c.put(Sess("a", **{field: 1005.0}))
    clock.t = 1004.9
    assert c.get("a") is not None
    clock.t = 1005.0
    assert c.get("a") is None and "a" not in c._by_sid


def test_an_entry_loaded_in_the_future_is_dropped():
    """Lead decision L4 (fail-closed): the wall clock moved back since the entry was loaded - re-read it from the database."""
    clock = Clock(1000.0)
    c = _cache(clock)
    c.put(Sess("a", loaded_at=1000.0))
    clock.t = 999.0
    assert c.get("a") is None and "a" not in c._by_sid


@pytest.mark.parametrize("store", [li._Cache, xs._Cache])
def test_both_stores_apply_the_clock_moved_back_rule(store):
    clock = Clock(1000.0)
    c = store()
    c._clock = clock
    c.put(Sess("a", loaded_at=1000.0))
    assert c.get("a") is not None
    clock.t = 999.0
    assert c.get("a") is None


def test_both_stores_read_their_own_clock_at_each_lookup(rx):
    """The app store reads app_refresh's clock (the tests move it), the local store time.time - neither is captured at construction."""
    s = Sess("a", loaded_at=rx.clock(), expires_at=rx.clock() + 1e6, idle_expires_at=rx.clock() + 1e6)
    xs.CACHE.put(s)
    try:
        assert xs.CACHE.get("a") is s
        rx.clock.advance(xs.CACHE_TTL_S + 1)
        assert xs.CACHE.get("a") is None
    finally:
        xs.CACHE.clear()
        xs.CACHE.take_to_close()


def test_put_evicts_the_oldest_batch_above_the_cap():
    c = _cache(Clock())
    for i in range(sc.MAX_ENTRIES + 1):
        c.put(Sess(f"s{i}"))
    c.put(Sess("new"))
    assert len(c._by_sid) == sc.MAX_ENTRIES + 2 - sc.EVICT_BATCH
    assert "s0" not in c._by_sid and f"s{sc.EVICT_BATCH - 1}" not in c._by_sid and f"s{sc.EVICT_BATCH}" in c._by_sid and "new" in c._by_sid


def test_drop_user_drops_entries_and_keeps_sockets():
    c = _cache(Clock())
    c.put(Sess("a", user_id="u1"))
    c.put(Sess("b", user_id="u2"))
    ws = Sock()
    assert c._attach("a", ws, lambda: True)
    c.drop_user("u1")
    assert set(c._by_sid) == {"b"} and ws in c._sockets["a"] and c.take_to_close() == []


def test_clear_queues_every_socket_once():
    c = _cache(Clock())
    c.put(Sess("a"))
    w1, w2 = Sock(), Sock()
    assert c._attach("a", w1, lambda: True) and c._attach("b", w2, lambda: True)
    c.clear()
    assert c._by_sid == {} and c._sockets == {}
    assert {id(w) for w in c.take_to_close()} == {id(w1), id(w2)}
    assert c.take_to_close() == []


def test_local_drop_chains_closes_the_chain_and_refuses_a_late_put():
    c = li._Cache()
    s = Sess("a", chain_id="ch")
    c._clock = Clock(s.loaded_at)
    c.put(s)
    ws = Sock()
    assert c.attach("a", "ch", ws) is True
    c.drop_chains({"ch"})
    assert c._by_sid == {} and c.take_to_close() == [ws]
    c.put(dataclasses.replace(s, sid_hash="rotated"))  # a resolve that read the chain's row before the revocation committed
    assert c._by_sid == {} and c.attach("rotated", "ch", Sock()) is False
    c.put(Sess("other", chain_id="ch2"))  # another chain is not affected
    assert "other" in c._by_sid


def test_app_drop_closes_the_session_and_refuses_a_late_put():
    c = xs._Cache()
    s = Sess("a")
    c._clock = Clock(s.loaded_at)
    c.put(s)
    ws = Sock()
    assert c.attach("a", ws) is True
    c.drop({"a"})
    assert c._by_sid == {} and c.take_to_close() == [ws]
    c.put(s)
    assert c._by_sid == {} and c.attach("a", Sock()) is False


def test_an_ended_key_is_forgotten_after_the_keep_time(monkeypatch):
    t = [5000.0]
    monkeypatch.setattr(sc.time, "monotonic", lambda: t[0])
    c = xs._Cache()
    s = Sess("a")
    c._clock = Clock(s.loaded_at)
    c.drop({"a"})
    c.put(s)
    assert c._by_sid == {}
    t[0] += sc.ENDED_KEEP_S + 1  # a revocation that rolled back only over-revoked the cache for a while
    c.put(s)
    assert "a" in c._by_sid
    c.drop({"b"})  # the next revocation prunes the forgotten key
    assert set(c._ended) == {"b"}


def test_clear_keeps_the_ended_keys_and_forget_ended_resets_them():
    c = xs._Cache()
    s = Sess("a")
    c._clock = Clock(s.loaded_at)
    c.drop({"a"})
    c.clear()
    c.put(s)
    assert c._by_sid == {}
    c.forget_ended()
    c.put(s)
    assert "a" in c._by_sid


def test_ha_session_store_uses_the_shared_attach_rule():
    from smplwise.services import ha_user_auth as hua

    store = hua.SessionStore()
    assert store.attach_socket("no-such-session", Sock()) is False and store._sockets == {}
    assert store.take_sockets_to_close() == []


# ---------------------------------------------------------------- a revoked session is never served from the cache

def _refused(client: TestClient) -> int:
    with pytest.raises(WebSocketDisconnect) as exc:
        with client.websocket_connect(WS, headers=ORIGIN) as ws:
            ws.receive_text()
    return exc.value.code


def test_local_session_revoked_after_the_read_and_before_the_put_is_not_cached(lx, monkeypatch):
    """The revocation commits after the resolve read the row and before it puts the session: the late put is refused, so the socket is
    refused (nothing would close it) and the next request reads the database and is refused too."""
    lx.enable()
    _created, c = lx.ready("maria")
    assert c.get("/arx/api/v1/me").status_code == 200
    chain = next(iter(li.CACHE._by_sid.values())).chain_id
    li.CACHE.clear()  # the next resolve reads the database
    li.CACHE.take_to_close()
    real_put = li.CACHE.put
    fired = []

    def revoke_then_put(s):
        if not fired:
            fired.append(1)
            with lx.db.connection(label="test revoke") as conn:  # committed before the put, after the resolve's read
                assert li.revoke_chain(conn, s.chain_id, "admin") == 1
        real_put(s)

    monkeypatch.setattr(li.CACHE, "put", revoke_then_put)
    assert _refused(c) == 4401
    assert fired and li.CACHE._sockets == {}
    assert not any(v.chain_id == chain for v in li.CACHE._by_sid.values())
    assert c.get("/arx/api/v1/me").status_code == 401


def test_local_live_session_is_still_cached_and_attaches(lx):
    lx.enable()
    _created, c = lx.ready("maria")
    li.CACHE.clear()
    li.CACHE.take_to_close()
    with c.websocket_connect(WS, headers=ORIGIN) as ws:
        assert json.loads(ws.receive_text())["type"] == "hello"
        assert len(li.CACHE._by_sid) == 1 and sum(len(v) for v in li.CACHE._sockets.values()) == 1
    assert c.get("/arx/api/v1/me").status_code == 200


def test_local_session_revoked_while_cached_is_refused_at_once(lx):
    lx.enable()
    _created, c = lx.ready("maria")
    assert c.get("/arx/api/v1/me").status_code == 200
    s = next(iter(li.CACHE._by_sid.values()))
    with lx.db.connection(label="test revoke") as conn:
        assert li.revoke_chain(conn, s.chain_id, "admin") == 1
    assert li.CACHE.get(s.sid_hash) is None
    assert c.get("/arx/api/v1/me").status_code == 401


def test_app_session_ended_after_the_read_and_before_the_put_is_not_cached(rx, monkeypatch):
    _dev, _out, _key, wv = signed_in(rx)
    assert me(wv).status_code == 200
    xs.CACHE.clear()
    xs.CACHE.take_to_close()
    real_put = xs.CACHE.put
    fired = []

    def end_then_put(s):
        if not fired:
            fired.append(s.sid_hash)
            with rx.db.connection(label="test revoke") as conn:
                assert xs._end_where(conn, "sid_hash = ?", (s.sid_hash,), "revoked_by_admin") == 1
        real_put(s)

    monkeypatch.setattr(xs.CACHE, "put", end_then_put)
    assert _refused(wv) == 4401
    assert fired and xs.CACHE._sockets == {} and fired[0] not in xs.CACHE._by_sid
    assert me(wv).status_code == 401


def test_app_session_ended_while_cached_is_refused_at_once(rx):
    _dev, _out, _key, wv = signed_in(rx)
    assert me(wv).status_code == 200
    s = next(iter(xs.CACHE._by_sid.values()))
    with rx.db.connection(label="test revoke") as conn:
        assert xs._end_where(conn, "sid_hash = ?", (s.sid_hash,), "revoked_by_admin") == 1
    assert xs.CACHE.get(s.sid_hash) is None
    assert me(wv).status_code == 401


# ---------------------------------------------------------------- P2-8: a failing lease hook is logged

def _raise(*a, **k):
    raise RuntimeError("lease registry broken")


def test_remote_session_lease_hook_failure_is_logged_without_ids(monkeypatch, caplog):
    from smplwise.services import capture_lease
    from smplwise.services import ha_user_auth as hua

    monkeypatch.setattr(capture_lease, "on_authority_change", _raise)
    with caplog.at_level(logging.WARNING, logger="smplwise.remote"):
        hua._lease_session_ended("user-secret-17")
    msgs = [r.getMessage() for r in caplog.records if r.name == "smplwise.remote"]
    assert msgs == ["capture lease hook session_ended could not run"]
    assert "user-secret-17" not in caplog.text


def test_intercom_lease_hook_failure_is_logged_without_ids(monkeypatch, caplog):
    from smplwise.services import capture_lease
    from smplwise.services import intercom_sync

    monkeypatch.setattr(capture_lease, "on_authority_change", _raise)
    with caplog.at_level(logging.WARNING, logger="smplwise.intercom"):
        intercom_sync._lease_hook("binding_changed", ["station-secret-9"])
        intercom_sync._lease_hook("feed_lost")
    msgs = [r.getMessage() for r in caplog.records if r.name == "smplwise.intercom"]
    assert msgs == ["capture lease hook binding_changed could not run", "capture lease hook feed_lost could not run"]
    assert "station-secret-9" not in caplog.text


def test_intercom_lease_hook_without_stations_stays_quiet(monkeypatch, caplog):
    """An empty station list calls nothing (unchanged) and logs nothing."""
    from smplwise.services import capture_lease
    from smplwise.services import intercom_sync

    monkeypatch.setattr(capture_lease, "on_authority_change", _raise)
    with caplog.at_level(logging.WARNING, logger="smplwise.intercom"):
        intercom_sync._lease_hook("binding_changed", [])
    assert not [r for r in caplog.records if r.name == "smplwise.intercom"]
