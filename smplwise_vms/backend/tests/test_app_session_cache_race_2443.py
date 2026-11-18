"""CR-APP-SESSION-CACHE-2443: the phone app's WebView session cache (services/app_session.py `_Cache`) has the shape CR-LOCAL-USER-CREATE-2438
fixed in the local identity: `resolve()` reads the session row, and caches the session AFTER the read. Every ending drops the cache entry
inside the revoking transaction, BEFORE its commit. A request that read its row before the commit put the session back after the drop and
was answered from the cache for CACHE_TTL_S (15 s) - and a WebSocket attached in that window was never closed (the drop that would close
it had already happened). Separately, a role change or an Arx disable (services/revocation.mark / changed) reached the cached web session
only when its entry aged out (15 s). Fakes only: no Home Assistant, no phone."""
from __future__ import annotations

import time

import pytest
from fastapi.testclient import TestClient
from test_app_refresh_295 import API, ARX, rx  # noqa: F401 - rx is the shared fixture
from test_app_session_295 import COOKIE, me, signed_in, web_rows
from test_remote_access import ORIGIN

from smplwise.services import app_session as xs
from smplwise.services import local_identity as li
from smplwise.services import revocation


class _Sock:
    """A stand-in for a WebSocket (the cache keeps them in a WeakSet)."""


def _cookie(wv: TestClient) -> str:
    return next(c.value for c in wv.cookies.jar if c.name == COOKIE)


def _end(rx, how: str, out: dict, wv: TestClient) -> None:
    """One of the routes that end a web session, answered and committed."""
    if how == "family":  # an administrator ends the saved sign-in
        r = rx.c.delete(f"{API}/auth/app/families/{out['family_id']}")
        assert r.status_code == 204, r.text
    elif how == "everywhere":  # the user signs out everywhere from another device
        r = rx.user("dana").delete(f"{ARX}/auth/sessions")
        assert r.status_code == 200, r.text
    elif how == "row":  # the user ends the app row in the sessions list (S-04)
        r = rx.user("dana").delete(f"{ARX}/auth/sessions/{web_rows(rx)[0]['public_id']}")
        assert r.status_code == 200, r.text
    elif how == "logout":  # the web sign-out (decision 394), from a second tab of the same WebView
        other = TestClient(rx.app, headers=ORIGIN, cookies={COOKIE: _cookie(wv)})
        r = other.delete(f"{ARX}/auth/session")
        assert r.status_code == 204, r.text
    else:
        raise AssertionError(how)


def _race(rx, monkeypatch, how: str, out: dict, wv: TestClient) -> list[int]:
    """The next cache put first lets the ending commit: read -> commit -> put."""
    rx.clock.advance(xs.CACHE_TTL_S + 1)  # the session's next request looks the row up
    real_put = xs.CACHE.put
    fired: list[int] = []

    def racing(s):
        if not fired:
            fired.append(1)
            _end(rx, how, out, wv)
        return real_put(s)

    monkeypatch.setattr(xs.CACHE, "put", racing)
    return fired


@pytest.mark.parametrize("how", ["family", "everywhere", "row", "logout"])
def test_an_ended_web_session_is_not_cached_back_by_a_request_that_read_before_the_commit(rx, monkeypatch, how):
    dev, out, key, wv = signed_in(rx)
    assert me(wv).status_code == 200
    fired = _race(rx, monkeypatch, how, out, wv)
    me(wv)  # the in-flight request (its answer is not asserted: it read a live row)
    assert fired == [1]
    vars(xs.CACHE).pop("put", None)  # the real put again
    assert web_rows(rx)[0]["revoked_at"] is not None  # the ending committed
    assert me(wv).status_code == 401  # was 200 for up to CACHE_TTL_S (15 s)
    assert wv.get(f"{ARX}/sites").status_code == 401


def test_a_websocket_cannot_attach_to_a_session_ended_between_its_read_and_its_put(rx, monkeypatch):
    """resolve() for a WebSocket handshake, then attach: the socket must be refused, or nothing would ever close it."""
    dev, out, key, wv = signed_in(rx)
    sh = xs.sid_hash_of(_cookie(wv))
    _race(rx, monkeypatch, "family", out, wv)
    s = xs.resolve(rx.db, None, _cookie(wv))  # read before the commit, put after it
    assert s is not None  # the in-flight handshake read a live row
    sock = _Sock()
    assert xs.CACHE.attach(sh, sock) is False
    assert sh not in xs.CACHE._sockets


@pytest.mark.parametrize("change", ["grant", "revoke_binding"])
def test_a_role_change_reaches_the_cached_web_session_on_the_next_request(rx, change):
    """rbac re-reads the bindings on every request anyway; the web session itself (its permission fingerprint, the administrators'
    caps) was re-checked only when its cache entry aged out. Now the access-change signal drops the user's entries."""
    dev, out, key, wv = signed_in(rx)
    assert me(wv).status_code == 200  # cached
    if change == "grant":
        r = rx.c.post(f"{API}/access/bindings", json={"subject_kind": "user", "subject_id": "u-viewer", "role_id": "operator",
                                                      "scope_type": "installation", "scope_id": "*"})
        assert r.status_code == 201, r.text
    else:
        with rx.db.connection(mode="read") as conn:
            bid = conn.execute("SELECT id FROM bindings WHERE subject_id = 'u-viewer' AND revoked_at IS NULL").fetchone()["id"]
        r = rx.c.delete(f"{API}/access/bindings/{bid}")
        assert r.status_code == 200, r.text
    assert me(wv).status_code == 401  # no clock advance: was 200 until the 15 s cache entry aged out
    assert web_rows(rx)[0]["revoked_reason"] == "permissions"


def test_the_access_signal_touches_only_the_named_users(rx):
    dev, out, key, wv = signed_in(rx)
    assert me(wv).status_code == 200
    sh = xs.sid_hash_of(_cookie(wv))
    revocation.changed({"u-somebody-else"})
    assert xs.CACHE.get(sh) is not None
    revocation.mark({"u-viewer"})
    assert xs.CACHE.get(sh) is None
    assert me(wv).status_code == 200  # nothing changed in the database: the session lives, answered from a fresh read
    assert xs.CACHE.get(sh) is None  # not cached while the user is held (the change may not have committed yet)
    assert xs.CACHE.attach(sh, _Sock(), "u-viewer") is True  # ... but its WebSocket still attaches (a user hold is not an ending)
    rx.clock.advance(xs.DROP_HOLD_S + 1)
    assert me(wv).status_code == 200
    assert xs.CACHE.get(sh) is not None  # cached again after the hold


def test_the_hold_is_per_session_and_per_user_and_ends(rx, monkeypatch):
    """A dropped session (or a user whose factor state changed) is not cached again for DROP_HOLD_S; other sessions are cached as
    before; once the hold is over the entry is cached again (a rolled-back ending costs 30 s of database reads, nothing else)."""
    dev, out, key, wv = signed_in(rx)
    assert me(wv).status_code == 200
    sh = xs.sid_hash_of(_cookie(wv))
    s = xs.CACHE.get(sh)
    xs.CACHE.drop({sh})
    xs.CACHE.put(s)
    assert xs.CACHE.get(sh) is None  # held
    other = xs.AppWebSession(sid_hash="x" * 64, public_id="p", principal=s.principal, user_id="u-other", family_id="f", device_id="d",
                             expires_at=s.expires_at, idle_expires_at=s.idle_expires_at, created_at=s.created_at, last_used_at=s.last_used_at,
                             loaded_at=s.loaded_at)
    xs.CACHE.put(other)
    assert xs.CACHE.get(other.sid_hash) is not None  # another session is untouched
    rx.clock.advance(xs.DROP_HOLD_S + 1)
    s.loaded_at = rx.clock()
    xs.CACHE.put(s)
    assert xs.CACHE.get(sh) is not None and sh not in xs.CACHE._dropped
    xs.drop_user_cache(s.user_id)  # the factor path (local_identity.on_factor_removed)
    xs.CACHE.put(s)
    assert xs.CACHE.get(sh) is None  # held per user
    rx.clock.advance(xs.DROP_HOLD_S + 1)
    s.loaded_at = rx.clock()
    xs.CACHE.put(s)
    assert xs.CACHE.get(sh) is not None


def test_the_local_identity_cache_holds_a_user_after_drop_user(monkeypatch):
    """The same shape in local_identity: `drop_user` (a factor removed / enrolled, a display-name change) drops the entries inside the
    caller's transaction; a request that read before the commit must not cache the old principal (factor_ok) back."""
    li.CACHE.clear()
    s = li.LocalSession(sid_hash="h" * 64, principal=None, user_id="l-u1", chain_id="c1", kind="browser", expires_at=4e9,  # type: ignore[arg-type]
                        idle_expires_at=4e9, created_at=1.0, chain_started_at=1.0, last_used_at=1.0, persistent=False, loaded_at=time.time())
    li.CACHE.put(s)
    assert li.CACHE.get(s.sid_hash) is s
    li.CACHE.drop_user("l-u1")
    li.CACHE.put(s)
    assert li.CACHE.get(s.sid_hash) is None  # held
    monkeypatch.setattr(li, "DROP_HOLD_S", 0.0)
    li.CACHE.put(s)
    assert li.CACHE.get(s.sid_hash) is s
    li.CACHE.clear()
