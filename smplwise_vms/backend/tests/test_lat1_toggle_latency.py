"""LAT1 (owner bug report 2026-10-08): a switch turned on / off from Arx must reach Home Assistant at once, and the state
Home Assistant reports back must reach the screens at once.

Everything here runs against a FAKE Home Assistant: a real HTTP server on 127.0.0.1 that answers the bridge's
`smplwise_bridge/execute` like the integration does (signature verified, a 35 ms service ack - the lab floor the lead
measured on HA 2026.9.4 - and the device's `state_changed` 57 ms after the call, pushed through the add-on's own sync
handler), plus a background stream of other entities' states at ~40/s (a busy installation). No real device is touched.

What is measured per toggle (perf_counter, the same clock on both sides):
- dispatch: the request leaving the client -> the execute call arriving at the fake HA;
- response: -> the action route's answer;
- push: -> the `entity_state_changed` frame of the toggled entity reaching a /ha/ws subscriber's queue.

The regression bounds are behavioural (sw_time_factor loosens them on a busy runner): the call never waits for SQLite's
write lock (a writer holding it for 1.5 s does not delay the dispatch), and the idle path stays far below a human's
notice. `-s` prints the per-hop table (the numbers in the LAT1 report)."""
from __future__ import annotations

import json
import queue
import socket
import sqlite3
import statistics
import threading
import time
from dataclasses import replace
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer

import pytest
from conftest import sw_load_factor, sw_time_factor
from fastapi.testclient import TestClient

from smplwise.main import create_app
from smplwise.services import ha_bridge, ha_client, ha_sync

ENTITY = "switch.lat1_relay"
SERVICE_ACK_S = 0.035  # the lab floor (lead, 2026-10-08): service ack ~35 ms ...
STATE_EVENT_S = 0.057  # ... and the device's state_changed ~57 ms after the call
NOISE_HZ = 40.0  # other entities' states per second while the owner taps
RECORD_MS = 40  # SEC246 L3: the allowance for the command's record (committed before the call) in the idle bounds - see the idle test

STATES = [{"entity_id": ENTITY, "state": "off", "attributes": {"friendly_name": "LAT1 relay"}, "last_changed": "2026-10-08T08:00:00+00:00", "last_updated": "2026-10-08T08:00:00+00:00"}] + [
    {"entity_id": f"sensor.noise_{i}", "state": "0", "attributes": {"friendly_name": f"noise {i}"}, "last_changed": "2026-10-08T08:00:00+00:00", "last_updated": "2026-10-08T08:00:00+00:00"} for i in range(20)
]


def _commit_ms(directory, samples: int = 9) -> float:
    """TESTDEBT3-295: the median wall time of ONE durable commit (WAL + synchronous=FULL, the class every command record uses) on the
    filesystem the test database lives on, right now. `sw_load_factor` spins a CPU thread, so it sees CPU contention only; the part of the
    idle bounds that is an fsync (RECORD_MS) slows with DISK contention (another pytest or a build writing on the same runner), which a
    CPU spin cannot see - the 2.9.2 / 2.9.3 flakies of this file. Measured the same way the app commits, after the toggles."""
    conn = sqlite3.connect(str(directory / "lat1_commit_probe.db"))
    try:
        conn.execute("PRAGMA journal_mode=WAL")
        conn.execute("PRAGMA synchronous=FULL")
        conn.execute("CREATE TABLE IF NOT EXISTS probe(x INTEGER)")
        conn.commit()
        took: list[float] = []
        for i in range(samples):
            t0 = time.perf_counter()
            conn.execute("INSERT INTO probe(x) VALUES (?)", (i,))
            conn.commit()
            took.append((time.perf_counter() - t0) * 1000)
        return statistics.median(took)
    finally:
        conn.close()


def _now_iso() -> str:
    import datetime as dt

    return dt.datetime.now(dt.timezone.utc).isoformat()


def _state_event(db, entity_id: str, old: str, new: str) -> None:
    """What the sync's socket handler does with one `state_changed` frame (ha_sync.on_state_changed)."""
    now = _now_iso()
    data = {"entity_id": entity_id, "old_state": {"entity_id": entity_id, "state": old, "attributes": {}}, "new_state": {"entity_id": entity_id, "state": new, "attributes": {"friendly_name": entity_id}, "last_changed": now, "last_updated": now}}
    handler = getattr(ha_sync, "on_state_changed", None)
    if handler is not None:
        handler(db, data)
        return
    row = ha_sync.handle_state_event(db, data)  # before LAT1 the same two steps lived inside the socket closure
    ha_sync.STATE.sequence += 1
    ha_sync.publish({"type": "entity_state_changed", "sequence": ha_sync.STATE.sequence, "entity": row})


class FakeHA:
    """The integration's execute service over HTTP, as Home Assistant serves it (`?return_response`)."""

    def __init__(self, db, secret: str) -> None:
        self.db, self.secret = db, secret
        self.arrivals: "queue.Queue[tuple[float, dict]]" = queue.Queue()
        self.connections = 0
        fake = self

        class Handler(BaseHTTPRequestHandler):
            protocol_version = "HTTP/1.1"  # keep-alive, as aiohttp behind the Supervisor proxy

            def setup(self) -> None:
                super().setup()
                # aiohttp (Home Assistant, the Supervisor proxy) sets TCP_NODELAY on its sockets; without it a kept-alive
                # connection would add the 40 ms Nagle / delayed-ACK stall that a real HA does not have
                self.connection.setsockopt(socket.IPPROTO_TCP, socket.TCP_NODELAY, 1)
                fake.connections += 1

            def log_message(self, *_a) -> None:  # quiet
                pass

            def do_POST(self) -> None:  # noqa: N802
                arrived = time.perf_counter()
                body = json.loads(self.rfile.read(int(self.headers.get("Content-Length") or 0)) or b"{}")
                fake.arrivals.put((arrived, body))
                ha_bridge.verify(fake.secret, dict(body))  # the integration verifies exactly this
                state = "on" if body.get("service") == "turn_on" else "off"
                entity = body["data"]["entity_id"]
                threading.Timer(STATE_EVENT_S, _state_event, args=(fake.db, entity, "off" if state == "on" else "on", state)).start()
                time.sleep(SERVICE_ACK_S)  # blocking=True: HA answers once the integration's service handler returned
                out = json.dumps({"changed_states": [], "service_response": {"ok": True, "context_id": "ctx-" + body["request_id"], "request_id": body["request_id"]}}).encode()
                self.send_response(200)
                self.send_header("Content-Type", "application/json")
                self.send_header("Content-Length", str(len(out)))
                self.end_headers()
                self.wfile.write(out)

        self.server = ThreadingHTTPServer(("127.0.0.1", 0), Handler)
        self.server.daemon_threads = True
        self.url = f"http://127.0.0.1:{self.server.server_address[1]}"
        threading.Thread(target=self.server.serve_forever, daemon=True).start()

    def close(self) -> None:
        self.server.shutdown()
        self.server.server_close()


@pytest.fixture()
def lat_app(settings, monkeypatch):
    monkeypatch.setattr(ha_client, "get_states", lambda _s: STATES)
    app = create_app(replace(settings, ha_url="http://placeholder.invalid", ha_token="t"))
    ha_sync.STATE.connected = True  # the socket thread is not started in tests
    c = TestClient(app)
    secret = c.get("/api/v1/ha/bridge/pairing").json()["pairing_code"]
    assert c.post("/api/v1/ha/bridge/ping", json=ha_bridge.sign(secret, {"version": "0.8.0"})).status_code == 200
    fake = FakeHA(app.state.db, secret)
    s = replace(settings, ha_url=fake.url, ha_token="t")
    app.state.settings = s
    ha_sync.snapshot(app.state.db, s)
    stop = threading.Event()

    def noise() -> None:  # a busy installation: other entities' states keep arriving through the same sync handler
        i = 0
        while not stop.is_set():
            i += 1
            try:
                _state_event(app.state.db, f"sensor.noise_{i % 20}", str(i - 1), str(i))
            except Exception:  # noqa: BLE001 - a dropped noise state is irrelevant here
                pass
            stop.wait(1.0 / NOISE_HZ)

    t = threading.Thread(target=noise, daemon=True)
    t.start()
    try:
        yield app, c, fake
    finally:
        stop.set()
        t.join(timeout=5)
        fake.close()
        ha_client.reset_bridge_session() if hasattr(ha_client, "reset_bridge_session") else None


def _body(n: int, action: str) -> dict:
    return {"allowed_action_id": action, "arguments": {}, "expected_state_version": None, "confirmation_grant": None, "client_request_id": f"lat1-{n}-{time.time_ns()}", "expires_at": "2099-01-01T00:00:00Z"}


class PushClock:
    """A /ha/ws subscriber that stamps every push of ENTITY the moment it is published (a reader thread, as the socket's
    executor read in routers/ha.py ha_ws) - never when the test gets round to reading it."""

    def __init__(self) -> None:
        self.q = ha_sync.subscribe()
        self.seen: "queue.Queue[tuple[float, str]]" = queue.Queue()
        self.stop = False
        threading.Thread(target=self._run, daemon=True).start()

    def _run(self) -> None:
        while not self.stop:
            try:
                msg = self.q.get(timeout=0.2)
            except queue.Empty:
                continue
            if msg.get("type") == "entity_state_changed" and msg["entity"]["entity_id"] == ENTITY:
                self.seen.put((time.perf_counter(), msg["entity"]["state"]))

    def close(self) -> None:
        self.stop = True
        ha_sync.unsubscribe(self.q)


def _toggle(c: TestClient, fake: FakeHA, sub: PushClock, n: int) -> dict[str, float]:
    target = "on" if n % 2 == 0 else "off"
    t0 = time.perf_counter()
    r = c.post(f"/api/v1/ha/entities/{ENTITY}/actions", json=_body(n, f"switch.turn_{target}"))
    t_resp = time.perf_counter()
    assert r.status_code == 202, r.text
    arrived, _payload = fake.arrivals.get(timeout=20)
    t_push = None
    deadline = time.monotonic() + 20
    while time.monotonic() < deadline:
        at, state = sub.seen.get(timeout=20)
        if state == target and at >= t0:
            t_push = at
            break
    assert t_push is not None, "the toggled entity's state push never reached the subscriber"
    return {"dispatch": (arrived - t0) * 1000, "response": (t_resp - t0) * 1000, "push": (t_push - t0) * 1000, "server_timing": r.headers.get("server-timing", "")}


def _table(title: str, rows: list[dict[str, float]]) -> str:
    out = [f"LAT1 {title} (n={len(rows)}; ms from the request leaving the client; HA floor ack {SERVICE_ACK_S * 1000:.0f} / event {STATE_EVENT_S * 1000:.0f})"]
    for k in ("dispatch", "response", "push"):
        v = [r[k] for r in rows]
        out.append(f"  {k:9s} median {statistics.median(v):7.1f}  p90 {sorted(v)[int(len(v) * 0.9) - 1]:7.1f}  max {max(v):7.1f}")
    if rows and rows[-1].get("server_timing"):
        out.append(f"  Server-Timing (last): {rows[-1]['server_timing']}")
        # SEC246 L3: where the time goes, per hop over every toggle (the record's queue wait and its commit are their own hops)
        hops: dict[str, list[float]] = {}
        for r in rows:
            for part in (r.get("server_timing") or "").split(","):
                name, _, dur = part.strip().partition(";dur=")
                try:
                    hops.setdefault(name, []).append(float(dur))
                except ValueError:
                    pass
        out.append("  Server-Timing medians / p90: " + ", ".join(
            f"{k} {statistics.median(v):.1f}/{sorted(v)[max(0, int(len(v) * 0.9) - 1)]:.1f}" for k, v in hops.items() if v))
    return "\n".join(out)


def test_toggles_reuse_one_connection_and_report_every_hop(lat_app):
    """The behaviour of the idle path without a clock (blocking gate, GATELANES-297): 6 toggles reach the fake HA and push back, over
    one keep-alive connection, and the answer names every hop. The latency bounds are the timing-lane test below."""
    _app, c, fake = lat_app
    sub = PushClock()
    try:
        rows = [_toggle(c, fake, sub, n) for n in range(6)]
    finally:
        sub.close()
    assert len(rows) == 6
    assert fake.connections <= 2, f"{fake.connections} connections for {len(rows)} toggles"
    st = rows[-1]["server_timing"]
    for hop in ("checks;dur=", "bridge;dur=", "pending_row;dur=", "pending_wait;dur=", "pending_commit;dur=", "record;dur=", "total;dur="):
        assert hop in st, st


@pytest.mark.timing_lane
def test_toggle_reaches_ha_and_pushes_back_without_waiting(lat_app):
    """Idle path with the 40/s state stream: 20 toggles, alternating on / off. GATELANES-297: the timing lane (wall-clock medians
    under a load factor; FLAKY in 3 of the last 40 gate / nightly runs), run when the runner is quiet - scripts/gate/timing_lane.sh."""
    app, c, fake = lat_app
    sub = PushClock()
    try:
        rows = [_toggle(c, fake, sub, n) for n in range(20)]
    finally:
        sub.close()
    print("\n" + _table("idle + 40/s state stream", rows))
    # a latency bound is wall-clock by nature; it scales with the load this machine carried during the toggles (sw_load_factor: 1.0 when
    # idle), so a runner busy with another job does not turn the behavioural check (no hidden wait, no new connection) into noise
    f = sw_load_factor()
    # the record's allowance follows the disk as well as the CPU: 4 x the durable commit measured now (about 5 ms on an idle disk, so
    # the fixed RECORD_MS wins there and nothing is loosened); only a disk that really is slow gives the fsync part more room. The
    # 60 / STATE_EVENT + 80 ms behavioural part (no hidden wait, no new connection) stays exactly as it was.
    record_ms = max(RECORD_MS, 4 * _commit_ms(app.state.settings.db_path.parent))
    dispatch = statistics.median(r["dispatch"] for r in rows)
    push = statistics.median(r["push"] for r in rows)
    # the fake HA's own share of the push is 57 ms; everything else is Arx. Generous bounds: a behavioural check, not a benchmark.
    # SEC246 L3 (owner-approved, 2026-10-11): every command is recorded BEFORE it is sent - the pending ha_actions row and the
    # attempt audit row, one transaction, one COMMIT fsync (synchronous=FULL) - so dispatch, and the push that follows it, carry
    # that commit. The record jumps the write queue (its wait is ~2 ms) and the call leaves from the request thread; what is left
    # is the fsync. Measured on the runner (20 toggles per run, base / record-first alternating, same load, 2026-10-11):
    #   dispatch median  base 14.3 / 10.5 / 15.6 ms (p90 42.4 / 13.5 / 30.5)   record-first 69.2 / 27.3 / 53.7 ms (p90 93.8 / 38.1 / 73.8)
    #   push median      base 210.5 / 87.5 / 128.2 ms                           record-first 199.3 / 102.8 / 136.9 ms
    #   the record (pending_row) median 50.3 / 18.9 / 42.2 ms, of it the commit (pending_commit) 3.2 / 17.2 / 21.3 and the queue
    #   wait (pending_wait) 12.8 / 1.7 / 2.2; earlier record-first runs under a heavier runner load: dispatch median 73.7 / 66.2.
    # Hence RECORD_MS on top of both LAT1 idle bounds (the smallest round allowance that passes the worst observed median, 73.7 ms,
    # with about 25 % to spare), under the same load-factor rule. The held-lock and busy cases have their own tests below.
    assert dispatch < (60 + record_ms) * f, f"f={f:.2f} record_ms={record_ms:.0f}\n" + _table("idle", rows)
    assert push < (STATE_EVENT_S * 1000 + 80 + record_ms) * f, f"f={f:.2f} record_ms={record_ms:.0f}\n" + _table("idle", rows)
    # one keep-alive connection is reused for the bridge calls (no new TCP + HTTP setup per toggle)
    assert fake.connections <= 2, f"{fake.connections} connections for {len(rows)} toggles"
    # the owner's own view of the hops: DevTools -> Network -> the POST -> Timing (Server-Timing), and the answer's timing_ms
    st = rows[-1]["server_timing"]
    for hop in ("checks;dur=", "bridge;dur=", "pending_row;dur=", "pending_wait;dur=", "pending_commit;dur=", "record;dur=", "total;dur="):
        assert hop in st, st


def _hold_write_lock(app, seconds: float):
    held = threading.Event()
    release = threading.Event()

    def holder() -> None:
        with app.state.db.connection(label="lat1 holder") as conn:
            conn.execute("UPDATE settings SET value = value WHERE key = 'permission_revision'")
            held.set()
            release.wait(seconds)

    t = threading.Thread(target=holder, daemon=True)
    t.start()
    assert held.wait(5)
    return t, release


def test_the_command_is_recorded_before_it_leaves_and_waits_for_a_short_write_lock(lat_app):
    """SEC246 L3 (owner 2026-10-11): record, then send. LAT1 made the call independent of SQLite's write lock (fire first); the
    owner chose a durable record first. A writer holding the lock for 1.5 s (inside the record budget, routers/ha.PENDING_WAIT_S)
    therefore delays the call until the lock is free - the record (the pending ha_actions row and the `attempt` audit row) is
    committed before the command leaves - and the call then goes out at once. The pre-SEC246 bound (dispatch < 400 ms under a held
    lock) no longer applies by design; the idle path keeps its LAT1 bound (test_toggle_reaches_ha_and_pushes_back_without_waiting)."""
    from smplwise.routers import ha as ha_router

    app, c, fake = lat_app
    hold_s = 1.5
    assert hold_s < ha_router.PENDING_WAIT_S
    t, release = _hold_write_lock(app, hold_s)
    t0 = time.perf_counter()
    result: dict = {}

    def post() -> None:
        result["r"] = c.post(f"/api/v1/ha/entities/{ENTITY}/actions", json=_body(0, "switch.turn_on"))
        result["t"] = time.perf_counter()

    p = threading.Thread(target=post, daemon=True)
    p.start()
    arrived, payload = fake.arrivals.get(timeout=20)
    dispatch_ms = (arrived - t0) * 1000
    with app.state.db.connection(mode="read") as conn:  # the record was durable before the call arrived
        assert conn.execute("SELECT COUNT(*) FROM ha_actions WHERE id = ?", (payload["request_id"],)).fetchone()[0] == 1
    p.join(timeout=30)
    t.join(timeout=5)
    print(f"\nSEC246 L3 write lock held {hold_s} s: dispatch {dispatch_ms:.1f} ms, response {(result['t'] - t0) * 1000:.1f} ms")
    assert dispatch_ms >= (hold_s * 1000) * 0.8, f"the call left after {dispatch_ms:.0f} ms, before the record could be written"
    assert dispatch_ms < (hold_s * 1000 + 400) * sw_time_factor(), f"the call waited {dispatch_ms:.0f} ms after the lock was free"
    r = result["r"]
    assert r.status_code == 202, r.text
    a = r.json()
    assert a["status"] == "pending" and payload["request_id"] == a["id"]
    with app.state.db.connection(mode="read") as conn:
        rows = conn.execute("SELECT decision, reason, details_json FROM audit_log WHERE action = 'ha.action' AND resource_id = ?", (ENTITY,)).fetchall()
    mine = [r for r in rows if json.loads(r["details_json"] or "{}").get("id") == a["id"]]
    assert [x["reason"] for x in mine][:1] == ["attempt"] and len(mine) == 2, [tuple(x) for x in mine]


def test_a_command_whose_record_cannot_be_written_in_time_is_never_sent(lat_app):
    """SEC246 L3: a write lock held past the record budget -> 503 busy (retryable), nothing reaches Home Assistant, no record."""
    from smplwise.routers import ha as ha_router

    app, c, fake = lat_app
    t, release = _hold_write_lock(app, ha_router.PENDING_WAIT_S + 2.0)
    try:
        t0 = time.perf_counter()
        body = _body(0, "switch.turn_on")
        r = c.post(f"/api/v1/ha/entities/{ENTITY}/actions", json=body)
        took_ms = (time.perf_counter() - t0) * 1000
    finally:
        release.set()
        t.join(timeout=10)
    print(f"\nSEC246 L3 record budget exceeded: 503 after {took_ms:.0f} ms")
    assert r.status_code == 503 and r.json()["code"] == "busy" and r.json()["retryable"] is True, r.text
    assert r.json()["details"]["sent"] is False
    time.sleep(0.2)
    assert fake.arrivals.empty(), "a command left although it could not be recorded"
    with app.state.db.connection(mode="read") as conn:
        assert conn.execute("SELECT COUNT(*) FROM ha_actions WHERE client_request_id = ?", (body["client_request_id"],)).fetchone()[0] == 0


def test_a_duplicate_click_is_sent_once_even_without_the_write_lock(lat_app):
    """The idempotency the write lock used to give (the pending row inserted before the call, under BEGIN IMMEDIATE) now
    comes from the in-flight claim plus a fresh look after it: the same client_request_id sent three times at once and
    once more right after reaches Home Assistant ONCE, and every answer names the same record."""
    app, c, fake = lat_app
    body = _body(0, "switch.turn_on")
    answers: list = []

    def post() -> None:
        answers.append(c.post(f"/api/v1/ha/entities/{ENTITY}/actions", json=body))

    threads = [threading.Thread(target=post) for _ in range(3)]
    for t in threads:
        t.start()
    for t in threads:
        t.join(timeout=30)
    post()  # a late duplicate, after the first finished
    assert [r.status_code for r in answers] == [202] * 4, [r.text for r in answers]
    assert len({r.json()["id"] for r in answers}) == 1
    fake.arrivals.get(timeout=5)
    time.sleep(0.3)
    assert fake.arrivals.empty(), "a duplicate click reached Home Assistant twice"
