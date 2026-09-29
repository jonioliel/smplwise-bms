"""The remote channel authenticates BEFORE the request's write transaction (auth.resolve_remote_first; round-10 §6.1 /
CR-008 §9 follow-up, 2026-09-30): an unauthenticated remote POST never takes a turn in the write gate's queue, so a
flood of them neither touches the gate counters nor delays a legitimate writer. Proved with the gate's own counters
(db.lock_stats, a count of WriteGate.acquire calls) and the I/O guard (tests/db_io_guard.py)."""
from __future__ import annotations

import threading
import time

import pytest
from fastapi.testclient import TestClient

from conftest import sw_time_factor
from fake_ha_core import make_jwt
from smplwise import auth as auth_mod
from smplwise import db as db_mod
from smplwise.services import ha_user_auth as hua
from test_remote_access import ORIGIN, Arx


@pytest.fixture()
def arx(settings, tmp_path, monkeypatch):
    a = Arx(settings, tmp_path, monkeypatch)
    a.flag("u-owner")
    a.bind("u-owner", "system_admin")
    yield a
    hua.reset_for_tests()


class GateSpy:
    """Counts every WriteGate.acquire of the app's database and every audit row written, and runs the I/O guard."""

    def __init__(self, arx, monkeypatch) -> None:
        import db_io_guard

        self.gate = arx.app.state.db.gate
        self.acquires = 0
        real = self.gate.acquire

        def acquire(*a, **kw):
            self.acquires += 1
            return real(*a, **kw)

        monkeypatch.setattr(self.gate, "acquire", acquire)
        self.arx = arx
        self._guard = db_io_guard
        db_io_guard.FINDINGS.items.clear()
        self._mp = pytest.MonkeyPatch()
        db_io_guard.install(self._mp.setattr)

    def audit_rows(self) -> int:
        with self.arx.db.connection(mode="read") as conn:
            return conn.execute("SELECT COUNT(*) FROM audit_log").fetchone()[0]

    def close(self) -> None:
        self._mp.undo()
        found = self._guard.FINDINGS.report()
        self._guard.FINDINGS.items.clear()
        assert found == [], found


@pytest.fixture()
def spy(arx, monkeypatch):
    s = GateSpy(arx, monkeypatch)
    yield s
    s.close()


def _flood_requests(arx) -> list:
    """Unauthenticated state-changing requests of every kind a stranger can send: no credential, forged Ingress headers,
    a cookie of no session, a garbage / expired / already-refused bearer token - on POST, PUT, PATCH and DELETE routes
    that open a write transaction."""
    refused = make_jwt(time.time() + 600)
    hua._remember_rejected(refused)
    creds = [
        {},
        {"X-Remote-User-Id": "u-owner", "X-Remote-User-Name": "joni", "X-SW-Dev-User": "joni"},
        {"Cookie": "arx_session=" + "0" * 20},
        {"Authorization": "Bearer not-a-token"},
        {"Authorization": "Bearer a.b.c"},
        {"Authorization": f"Bearer {make_jwt(time.time() - 5)}"},
        {"Authorization": f"Bearer {refused}"},
    ]
    calls = [
        ("POST", "/arx/api/v1/evidence/signing/rotate", {"content": b"x", "headers": {"Content-Type": "text/plain"}}),
        ("POST", "/arx/api/v1/sites", {"json": {"name": "flood"}}),
        ("PUT", "/arx/api/v1/access/users/u-owner/remote-access", {"json": {"enabled": False}}),
        ("PATCH", "/arx/api/v1/settings", {"json": {"remote.csp_enforce": True}}),
        ("DELETE", "/arx/api/v1/backups/x.zip", {}),
    ]
    return [(m, p, {**kw, "headers": {**ORIGIN, **kw.get("headers", {}), **c}}) for c in creds for m, p, kw in calls]


def test_an_unauthenticated_remote_flood_never_touches_the_gate(arx, spy):
    client = TestClient(arx.app)
    stats, rows = db_mod.lock_stats(), spy.audit_rows()
    for _round in range(3):
        for method, path, kw in _flood_requests(arx):
            r = client.request(method, path, **kw)
            assert r.status_code == 401, (method, path, kw["headers"], r.text)
    after = db_mod.lock_stats()
    assert spy.acquires == 0
    for key in ("holds", "busy_errors", "gate_timeouts", "waits_over_1s"):
        assert after[key] == stats[key], key
    assert spy.audit_rows() == rows  # nothing an anonymous caller can repeat writes a row per request
    assert spy.gate.state() == {"held": False, "waiting": 0}

    # the counter is sensitive: the same request authenticated inside the write transaction (the old order) takes a turn
    real = auth_mod.resolve_remote_first
    try:
        auth_mod.resolve_remote_first = lambda request: None
        assert client.post("/arx/api/v1/sites", json={"name": "old order"}, headers=ORIGIN).status_code == 401
    finally:
        auth_mod.resolve_remote_first = real
    assert spy.acquires == 1


def test_the_flood_does_not_queue_behind_a_writer_nor_delay_the_next_one(arx, spy):
    db = arx.app.state.db
    factor = sw_time_factor()
    holding, release = threading.Event(), threading.Event()
    got: dict[str, float] = {}

    def holder() -> None:
        with db.connection(label="long holder"):
            holding.set()
            release.wait(10)

    def writer() -> None:
        with db.connection(label="legit writer") as conn:
            got["at"] = time.monotonic()
            db_mod.set_setting(conn, "legit", "1")

    h = threading.Thread(target=holder)
    h.start()
    assert holding.wait(5)
    w = threading.Thread(target=writer)
    w.start()
    deadline = time.monotonic() + 2
    while spy.gate.state()["waiting"] < 1 and time.monotonic() < deadline:
        time.sleep(0.005)
    assert spy.gate.state()["waiting"] == 1
    baseline = spy.acquires  # the holder's and the legitimate writer's

    most_waiting = {"n": 0}
    stop = threading.Event()

    def monitor() -> None:
        while not stop.is_set():
            most_waiting["n"] = max(most_waiting["n"], spy.gate.state()["waiting"])
            time.sleep(0.002)

    m = threading.Thread(target=monitor)
    m.start()
    requests = _flood_requests(arx)
    codes: list[int] = []
    started = time.monotonic()

    def flood(part: list) -> None:
        c = TestClient(arx.app)
        for method, path, kw in part:
            codes.append(c.request(method, path, **kw).status_code)

    workers = [threading.Thread(target=flood, args=(requests[i::4],)) for i in range(4)]
    for t in workers:
        t.start()
    for t in workers:
        t.join(30)
    flood_s = time.monotonic() - started
    stop.set()
    m.join(5)
    # every stranger was refused while the gate was HELD - none of them waited for it (the old order queued each one
    # behind the holder, up to the 10 s busy timeout)
    assert codes == [401] * len(requests)
    assert most_waiting["n"] == 1  # only the legitimate writer ever queued
    assert flood_s < 5.0 * factor
    try:
        assert spy.acquires == baseline  # not one acquire by the flood
    finally:
        released = time.monotonic()
        release.set()
    h.join(5)
    w.join(5)
    assert got["at"] - released < 0.5 * factor  # handed the lock at once: first in the queue, nobody in front of it
    with db.connection(mode="read") as conn:
        assert db_mod.get_setting(conn, "legit") == "1"


def test_a_signed_in_remote_writer_is_resolved_before_its_transaction(arx, spy, monkeypatch):
    """First sight of a bearer token: Home Assistant is asked while the request holds nothing - not the gate, not a turn
    in its queue - and the write then goes through. A cookie session and a cached bearer answer from memory."""
    seen: list[tuple[int, bool]] = []
    real_validate = hua.validate_token

    async def validate(settings, tok, ip):
        seen.append((spy.acquires, spy.gate.state()["held"]))
        return await real_validate(settings, tok, ip)

    monkeypatch.setattr(hua, "validate_token", validate)
    token = arx.token(arx.owner)
    bearer = TestClient(arx.app, headers={"Authorization": f"Bearer {token}"})
    r = bearer.post("/arx/api/v1/sites", json={"name": "from the app"})
    assert r.status_code == 201, r.text
    assert seen == [(0, False)]  # asked before any gate acquire of the request
    assert spy.acquires >= 1  # ... and the write itself took its turn afterwards
    r = bearer.post("/arx/api/v1/sites", json={"name": "cached"})
    assert r.status_code == 201 and len(seen) == 1
    assert arx.login(arx.owner).status_code == 200
    assert arx.client.post("/arx/api/v1/sites", json={"name": "cookie"}).status_code == 201
    assert len(seen) == 2  # the exchange asked HA once; the cookie request did not


def test_a_session_revoked_while_waiting_for_the_write_turn_is_resolved_again(arx):
    """A revoke landing between the early resolution and the write transaction: the request is refused (resolved again,
    as a request arriving now would be), not served under the dropped session."""
    assert arx.login(arx.owner).status_code == 200
    real_begin = db_mod._begin_immediate

    def begin(conn, label):
        if label.startswith("POST /arx/api/v1/sites"):
            for s in list(hua.STORE._sessions.values()):
                hua.STORE.revoke_sign_ins({s.iss_hash}, [s])
        return real_begin(conn, label)

    db_mod._begin_immediate = begin
    try:
        r = arx.client.post("/arx/api/v1/sites", json={"name": "late"})
    finally:
        db_mod._begin_immediate = real_begin
    assert r.status_code == 401, r.text
    with arx.db.connection(mode="read") as conn:
        assert conn.execute("SELECT COUNT(*) FROM sites WHERE name = 'late'").fetchone()[0] == 0


def test_refusals_anyone_can_repeat_are_audited_once_a_minute(arx, monkeypatch):
    # a cross-site request with a cookie of no live session: one row per address a minute
    stranger = TestClient(arx.app, headers={"Origin": "https://evil.example.com", "CF-Connecting-IP": "203.0.113.9"})
    stranger.cookies.set("arx_session", "f" * 20)
    for _ in range(5):
        assert stranger.post("/arx/api/v1/sites", json={"name": "x"}).status_code == 403
    assert len(arx.audit("auth.remote_csrf_refused")) == 1
    # ... while a refused request of a REAL session is always recorded (the victim of a CSRF attempt)
    assert arx.login(arx.owner).status_code == 200
    victim = TestClient(arx.app, headers={"Origin": "https://evil.example.com", "CF-Connecting-IP": "203.0.113.9"})
    victim.cookies.update(arx.client.cookies)
    for _ in range(3):
        assert victim.post("/arx/api/v1/sites", json={"name": "x"}).status_code == 403
    assert len(arx.audit("auth.remote_csrf_refused")) == 4
    # a rate-limited sign-in: the first refusal of the minute is written, the rest are counted into the next row
    monkeypatch.setattr(hua, "IP_LIMITS", [(60.0, 2)])
    ip = {"CF-Connecting-IP": "198.51.100.7"}
    codes = [arx.client.post("/arx/api/v1/auth/session", headers={"Authorization": "Bearer a.b.c", **ip}).status_code for _ in range(8)]
    assert codes == [401, 401] + [429] * 6
    rows = arx.audit("auth.remote_session.rejected")
    assert [r["reason"] for r in rows].count("rate_limited_ip") == 1 and [r["reason"] for r in rows].count("token_invalid") == 2
    monkeypatch.setattr(hua.RefusalAudits, "WINDOW_S", 0.0)  # the next minute
    assert arx.client.post("/arx/api/v1/auth/session", headers={"Authorization": "Bearer a.b.c", **ip}).status_code == 429
    import json

    last = [r for r in arx.audit("auth.remote_session.rejected") if r["reason"] == "rate_limited_ip"][-1]
    assert json.loads(last["details_json"])["suppressed_since_last"] == 5


def test_the_ingress_channel_is_unchanged(arx, spy):
    """Local (Ingress / developer) requests resolve inside their transaction exactly as before: no early resolution."""
    calls: list[int] = []
    real = auth_mod.resolve_remote_first
    auth_mod.resolve_remote_first = lambda request: calls.append(1) or real(request)
    try:
        r = TestClient(arx.app).post("/api/v1/sites", json={"name": "local"})
    finally:
        auth_mod.resolve_remote_first = real
    assert r.status_code == 201 and calls == [] and spy.acquires >= 1
