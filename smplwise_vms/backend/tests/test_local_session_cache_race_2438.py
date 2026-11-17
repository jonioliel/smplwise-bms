"""CR-LOCAL-USER-CREATE-2438, second finding: a revoked local session must not be cached back by a request that read its row before
the revocation committed (services/local_identity.py `_Cache`, DROP_HOLD_S). Fakes only: no Home Assistant, no device."""
from __future__ import annotations

import pytest

from smplwise.services import local_identity as li
from test_local_identity import Lx, lx  # noqa: F401 - `lx` is the fixture

ADMIN_PW = "seven green boats 91"
URL = "/api/v1/identity/local-users"



@pytest.mark.parametrize("how", ["password", "revoke", "disable"])
def test_a_revoked_session_is_not_cached_back_by_a_request_that_read_before_the_commit(lx, monkeypatch, how):
    """The browser spec caught it once on a busy workstation: the administrator set the password, the answer said `sessions_ended: 1`,
    and the user's open page still got 200 from `/me`. `resolve()` reads the session row, THEN the revocation commits and drops the
    cache, THEN `resolve()` caches what it read - a revoked session lived on for CACHE_TTL_S (15 s). The same interleaving reaches
    every route that ends a user's sessions (here also the older `sessions/revoke` and disable). The request that was already in flight
    is answered from what it read; nothing after it is."""
    lx.enable()
    created, c = lx.ready("maria")
    uid = created["user"]["id"]
    li.CACHE.clear()  # the session's next request looks the row up
    real = li._lookup
    fired: list[int] = []

    def racing(db, sid_hash):
        found = real(db, sid_hash)  # the request read its row: not revoked yet
        if not fired:
            fired.append(1)  # ... and the administrator's change commits before the request caches it
            r = (lx.admin.put(f"{URL}/{uid}/password", json={"password": ADMIN_PW}) if how == "password"
                 else lx.admin.post(f"{URL}/{uid}/sessions/revoke") if how == "revoke"
                 else lx.admin.patch(f"{URL}/{uid}", json={"active": False}))
            assert r.status_code == 200, r.text
        return found

    monkeypatch.setattr(li, "_lookup", racing)
    c.get("/arx/api/v1/me")  # the in-flight request
    assert fired == [1]
    monkeypatch.setattr(li, "_lookup", real)
    assert c.get("/arx/api/v1/me").status_code == 401
    assert c.get("/arx/api/v1/sites").status_code == 401


def test_the_hold_is_per_chain_and_ends(lx, monkeypatch):
    """A chain that was not revoked is cached as before; a dropped chain is cached again once the hold is over (a rolled-back
    revocation costs 30 s of database reads, nothing else)."""
    lx.enable()
    _created, c = lx.ready("maria")
    _other, c2 = lx.ready("dana2")
    sid = next(iter(li.CACHE._by_sid))
    s = li.CACHE._by_sid[sid]
    li.CACHE.drop_chains({s.chain_id})
    li.CACHE.put(s)
    assert sid not in li.CACHE._by_sid                      # held
    assert len(li.CACHE._by_sid) == 1                       # the other user's chain is untouched
    assert c2.get("/arx/api/v1/me").status_code == 200
    monkeypatch.setattr(li, "DROP_HOLD_S", 0.0)
    li.CACHE.put(s)
    assert sid in li.CACHE._by_sid and s.chain_id not in li.CACHE._dropped
