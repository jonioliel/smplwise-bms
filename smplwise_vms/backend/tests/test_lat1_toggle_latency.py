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
import statistics
import threading
import time
from dataclasses import replace
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer

import pytest
from conftest import sw_time_factor
from fastapi.testclient import TestClient

from smplwise.main import create_app
from smplwise.services import ha_bridge, ha_client, ha_sync

ENTITY = "switch.lat1_relay"
SERVICE_ACK_S = 0.035  # the lab floor (lead, 2026-10-08): service ack ~35 ms ...
STATE_EVENT_S = 0.057  # ... and the device's state_changed ~57 ms after the call
NOISE_HZ = 40.0  # other entities' states per second while the owner taps

STATES = [{"entity_id": ENTITY, "state": "off", "attributes": {"friendly_name": "LAT1 relay"}, "last_changed": "2026-10-08T08:00:00+00:00", "last_updated": "2026-10-08T08:00:00+00:00"}] + [
    {"entity_id": f"sensor.noise_{i}", "state": "0", "attributes": {"friendly_name": f"noise {i}"}, "last_changed": "2026-10-08T08:00:00+00:00", "last_updated": "2026-10-08T08:00:00+00:00"} for i in range(20)
]


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


def _toggle(c: TestClient, fake: FakeHA, sub: "queue.Queue[dict]", n: int) -> dict[str, float]:
    target = "on" if n % 2 == 0 else "off"
    t0 = time.perf_counter()
    r = c.post(f"/api/v1/ha/entities/{ENTITY}/actions", json=_body(n, f"switch.turn_{target}"))
    t_resp = time.perf_counter()
    assert r.status_code == 202, r.text
    arrived, _payload = fake.arrivals.get(timeout=20)
    deadline = time.monotonic() + 20
    t_push = None
    while time.monotonic() < deadline:
        msg = sub.get(timeout=20)
        if msg.get("type") == "entity_state_changed" and msg["entity"]["entity_id"] == ENTITY and msg["entity"]["state"] == target:
            t_push = time.perf_counter()
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
    return "\n".join(out)


def test_toggle_reaches_ha_and_pushes_back_without_waiting(lat_app):
    """Idle path with the 40/s state stream: 12 toggles, alternating on / off."""
    app, c, fake = lat_app
    sub = ha_sync.subscribe()
    try:
        rows = [_toggle(c, fake, sub, n) for n in range(12)]
    finally:
        ha_sync.unsubscribe(sub)
    print("\n" + _table("idle + 40/s state stream", rows))
    f = sw_time_factor()
    dispatch = statistics.median(r["dispatch"] for r in rows)
    push = statistics.median(r["push"] for r in rows)
    # the fake HA's own share of the push is 57 ms; everything else is Arx. Generous bounds: a behavioural check, not a benchmark
    assert dispatch < 60 * f, _table("idle", rows)
    assert push < (STATE_EVENT_S * 1000 + 80) * f, _table("idle", rows)
    # one keep-alive connection is reused for the bridge calls (no new TCP + HTTP setup per toggle)
    assert fake.connections <= 2, f"{fake.connections} connections for {len(rows)} toggles"
    # the owner's own view of the hops: DevTools -> Network -> the POST -> Timing (Server-Timing), and the answer's timing_ms
    st = rows[-1]["server_timing"]
    for hop in ("checks;dur=", "bridge;dur=", "pending_row;dur=", "record;dur=", "total;dur="):
        assert hop in st, st


def test_dispatch_does_not_wait_for_the_write_lock(lat_app):
    """A writer holding SQLite's single write lock for 1.5 s (a long transaction elsewhere) must not delay the call to
    Home Assistant: before LAT1 the route took the write lock first (BEGIN IMMEDIATE), so the dispatch waited it out."""
    app, c, fake = lat_app
    held = threading.Event()
    release = threading.Event()

    def holder() -> None:
        with app.state.db.connection(label="lat1 holder") as conn:
            conn.execute("UPDATE settings SET value = value WHERE key = 'permission_revision'")
            held.set()
            release.wait(1.5)

    t = threading.Thread(target=holder, daemon=True)
    t.start()
    assert held.wait(5)
    t0 = time.perf_counter()
    result: dict = {}

    def post() -> None:
        result["r"] = c.post(f"/api/v1/ha/entities/{ENTITY}/actions", json=_body(0, "switch.turn_on"))
        result["t"] = time.perf_counter()

    p = threading.Thread(target=post, daemon=True)
    p.start()
    arrived, payload = fake.arrivals.get(timeout=20)
    dispatch_ms = (arrived - t0) * 1000
    release.set()
    p.join(timeout=30)
    t.join(timeout=5)
    print(f"\nLAT1 write lock held 1.5 s: dispatch {dispatch_ms:.1f} ms, response {(result['t'] - t0) * 1000:.1f} ms")
    assert dispatch_ms < 400 * sw_time_factor(), f"the call waited {dispatch_ms:.0f} ms for the write lock"
    r = result["r"]
    assert r.status_code == 202, r.text
    a = r.json()
    # the record and the audit row are still written (after the lock was free), and they describe this very call
    assert a["status"] == "pending" and payload["request_id"] == a["id"]
    with app.state.db.connection(mode="read") as conn:
        assert conn.execute("SELECT COUNT(*) FROM ha_actions WHERE id = ?", (a["id"],)).fetchone()[0] == 1
        rows = conn.execute("SELECT decision, details_json FROM audit_log WHERE action = 'ha.action' AND resource_id = ?", (ENTITY,)).fetchall()
    assert any(json.loads(r["details_json"] or "{}").get("id") == a["id"] and r["decision"] == "allowed" for r in rows)
