"""CR-025 wiring on CR-024 (fake devices only): Provision-ISR discovery, go2rtc stream sources, snapshot route, the
per-recorder event loop (sampling and push with fallback), the connection test with TLS pinning, and the Hikvision paths
unchanged. No real device: the fakes answer `.test` names."""
from __future__ import annotations

import dataclasses
import json
import sys
import threading
import time
from pathlib import Path

import pytest
from fastapi.testclient import TestClient

from smplwise.services import autosync, connection_probe, events_ingest
from smplwise.services import go2rtc as g2
from smplwise.services.recorders import provision_events
from smplwise.services.recorders import provision_isr as pisr
from smplwise.services.recorders import vendor_io

sys.path.insert(0, str(Path(__file__).resolve().parent / "fixtures"))
from fake_provision import HOST, PASSWORD, USER, FakeProvision, settings_for  # noqa: E402

PIN = "ab" * 32


@pytest.fixture()
def fake(monkeypatch) -> FakeProvision:
    pisr.clear_auth_cache()
    f = FakeProvision()
    f.shape = "live"
    f.names = {1: "Gate", 2: "Lobby", 3: "Yard", 4: "Roof"}
    f.install(monkeypatch)
    return f


def wait_rows(app, n: int, timeout: float = 20.0) -> list[dict]:
    deadline = time.monotonic() + timeout
    while time.monotonic() < deadline:
        with app.state.db.connection(mode="read") as conn:
            rows = [dict(r) for r in conn.execute("SELECT * FROM cameras WHERE recorder_id = 'nvr-1' ORDER BY channel").fetchall()]
        if len(rows) >= n and all("encoding" in (r["capabilities_json"] or "") or r["status"] == "offline" for r in rows):
            return rows
        time.sleep(0.05)
    raise AssertionError("discovery did not finish")


# ---------------------------------------------------------------------------------------------- discovery and media

def test_discovery_creates_cameras_from_the_provision_recorder(settings, fake):
    from smplwise.main import create_app

    s = settings_for(settings, auth="basic")
    app = create_app(s)
    with TestClient(app):
        rows = wait_rows(app, 4)
        with app.state.db.connection(mode="read") as conn:
            rec = dict(conn.execute("SELECT * FROM recorders WHERE id = 'nvr-1'").fetchone())
    assert [(r["channel"], r["name_source"], r["status"]) for r in rows] == [(1, "Gate", "online"), (2, "Lobby", "online"), (3, "Yard", "offline"), (4, "Roof", "offline")]
    enc = json.loads(rows[0]["capabilities_json"])["encoding"]
    assert enc["main"]["source"] == "provision_isr" and enc["main"]["resolution"] == "2592x1520" and enc["sub"]["resolution"] == "704x576"
    assert rec["model"] == "NVR5-8200PX" and rec["vendor"] == "provision_isr"
    assert json.loads(rec["capabilities_json"])["events"] == "poll"
    assert fake.writes == [], "discovery is read-only"


def test_stream_sync_uses_the_device_paths_and_only_the_namespace(settings, fake, monkeypatch):
    from smplwise.db import Database

    seen: list[tuple[str, str]] = []
    monkeypatch.setattr(g2.Go2rtc, "ensure_stream", lambda self, name, src, check=None: seen.append((name, src)) or "created")
    monkeypatch.setattr(g2.Go2rtc, "list_streams", lambda self: {"intercom_door_1": None})
    s = dataclasses.replace(settings_for(settings, auth="basic"), go2rtc_url="http://go2rtc.test:1984")
    db = Database(s.db_path)
    db.migrate() if hasattr(db, "migrate") else None
    from smplwise.main import create_app

    app = create_app(s)
    with TestClient(app):
        wait_rows(app, 4)
        seen.clear()
        with app.state.db.connection() as conn:
            r = autosync.ensure_streams(s, conn, reason="manual")
    srcs = dict(seen)
    # live finding: go2rtc plays this NVR only through its ffmpeg source (vendor_io.go2rtc_source)
    assert srcs["smplwise_nvr-1_ch1_main"] == f"ffmpeg:rtsp://{USER}:{PASSWORD}@{HOST}:554/chID=1&streamType=main#video=copy"
    assert srcs["smplwise_nvr-1_ch1_sub"] == f"ffmpeg:rtsp://{USER}:{PASSWORD}@{HOST}:554/chID=1&streamType=sub1#video=copy"
    assert all(n.startswith("smplwise_") for n in srcs) and r["foreign_streams_untouched"] == 1


def test_snapshot_route_reads_the_provision_channel(settings, fake):
    from smplwise.main import create_app

    app = create_app(settings_for(settings, auth="basic"))
    with TestClient(app) as c:
        rows = wait_rows(app, 4)
        r = c.get(f"/api/v1/cameras/{rows[0]['id']}/snapshot.jpg")
    assert r.status_code == 200 and r.content.startswith(b"\xff\xd8\xff")
    assert any(h.startswith("POST /GetSnapshot/1") for h in fake.hits)


# ---------------------------------------------------------------------------------------------- event loop

class FakeListener:
    def __init__(self, s, rounds: int) -> None:
        self.settings = s
        self.recorder_id = "nvr-2"
        self.state = events_ingest.IngestState()
        self.stop = threading.Event()
        self.db = None
        self.got: list = []
        self.rounds = rounds

    def submit(self, alert):
        self.got.append(alert)
        return "queued"

    def sleep(self, s):
        self.rounds -= 1
        if self.rounds <= 0:
            self.stop.set()
        return self.stop.is_set()


def test_poll_loop_submits_edges_and_recovers(settings, fake):
    s = settings_for(settings, auth="basic", poll_interval_s=0.5)
    lst = FakeListener(s, rounds=4)
    fake.alarms = {("motionAlarm", 2): True}
    ad = pisr.ProvisionIsrAdapter("nvr-2", s, transport=fake.transport())
    orig = lst.sleep

    def step(sec):
        if lst.rounds == 3:
            fake.alarms = {}
        if lst.rounds == 2:
            fake.down = True
        if lst.rounds == 1:
            fake.down = False
        return orig(sec)

    provision_events.run_loop(lst, adapter=ad, sleep=step)
    kinds = [(a.raw_type, a.state, a.channel) for a in lst.got]
    assert ("VMD", "active", 2) in kinds and ("VMD", "inactive", 2) in kinds
    assert ("IPCDisconnect", "active", 3) in kinds, "the device's own chlOfflineAlarm"
    assert lst.state.reconnects >= 1 and lst.state.last_heartbeat_at


def test_push_mode_skips_polling_while_fresh_and_falls_back(settings, fake, monkeypatch):
    s = settings_for(settings, auth="basic", event_mode="push")
    lst = FakeListener(s, rounds=3)
    rx = provision_events.PushReceiver("nvr-2", heartbeat_s=10)
    monkeypatch.setattr(provision_events, "_register_push", lambda listener, adapter: rx)
    ad = pisr.ProvisionIsrAdapter("nvr-2", s, transport=fake.transport())
    rx.last_message = time.monotonic()  # fresh push path
    provision_events.run_loop(lst, adapter=ad, sleep=lst.sleep)
    assert not any("GetAlarmStatus" in h for h in fake.hits), "no polling while pushes arrive"
    rx.last_message = time.monotonic() - 100  # stale: falls back to sampling
    lst.stop.clear()
    lst.rounds = 2
    provision_events.run_loop(lst, adapter=ad, sleep=lst.sleep)
    assert any("GetAlarmStatus" in h for h in fake.hits)


def test_alert_listener_delegates_to_the_provision_loop(settings, monkeypatch):
    called = []
    monkeypatch.setattr(provision_events, "run_loop", lambda listener: called.append(listener.recorder_id))
    lst = events_ingest.AlertStreamListener("nvr-7", events_ingest.IngestState(), events_ingest.IngestQueue())
    lst.settings, lst.db = settings_for(settings), object()
    lst._loop()
    assert called == ["nvr-7"]


def test_hikvision_recorders_take_the_old_paths(settings):
    assert not vendor_io.handles(settings) and vendor_io.handles(settings_for(settings))


# ---------------------------------------------------------------------------------------------- connection test

def _probe_env(monkeypatch, fake):
    monkeypatch.setattr(connection_probe, "RESOLVE", lambda h: ["192.0.2.50"] if h == HOST else [])
    monkeypatch.setattr(connection_probe, "HOSTNAME", lambda: "arx.test")
    monkeypatch.setattr(connection_probe, "LOCAL_ADDRESSES", lambda: set(), raising=False)
    monkeypatch.setattr(connection_probe, "TRANSPORT", fake.transport())
    monkeypatch.setattr("smplwise.services.connection_store.connect_host", lambda target: HOST)


def test_connection_test_of_a_provision_candidate(settings, fake, monkeypatch):
    from smplwise.main import create_app

    _probe_env(monkeypatch, fake)
    app = create_app(settings)
    with TestClient(app) as c:
        body = {"vendor": "provision_isr", "host": HOST, "http_port": 80, "rtsp_port": 554, "username": USER, "password": PASSWORD, "extra": {}}
        r = c.post("/api/v1/nvr/connection/test", json=body)
    assert r.status_code == 200, r.text
    out = r.json()
    res = out.get("result", out)
    assert res["ok"] is True and res["model"] == "NVR5-8200PX" and res["channels"] == 4
    assert res["transport"] == {"scheme": "http", "auth": "basic", "insecure": True} and "basic_over_http" in res["warnings"]
    assert HOST not in json.dumps(out) and PASSWORD not in json.dumps(out)


def test_https_pin_recorded_checked_and_mismatch_refused(settings, fake, monkeypatch):
    calls = []
    monkeypatch.setattr(pisr, "PEER_CERTIFICATE", lambda host, port, timeout: calls.append(port) or {"sha256": PIN, "self_signed": True})
    good = pisr.ProvisionIsrAdapter("nvr-2", settings_for(settings, scheme="https", tls_mode="pin", tls_pin=PIN, auth="basic"), transport=fake.transport())
    assert good.health().online and calls == [443]
    good.storage()
    assert calls == [443], "a verified pin is cached"
    pisr.clear_auth_cache()
    before = len(fake.hits)
    bad = pisr.ProvisionIsrAdapter("nvr-2", settings_for(settings, scheme="https", tls_mode="pin", tls_pin="cd" * 32, auth="basic"), transport=fake.transport())
    h = bad.health()
    assert not h.online and h.error == "tls_pin_mismatch"
    assert fake.hits[before:] == [], "nothing is sent to the device after a mismatch"
    missing = pisr.ProvisionIsrAdapter("nvr-2", settings_for(settings, scheme="https", tls_mode="pin", auth="basic"), transport=fake.transport())
    assert missing.health().error == "tls_pin_missing"


def test_trust_mode_warns(settings, fake):
    a = pisr.ProvisionIsrAdapter("nvr-2", settings_for(settings, scheme="https", tls_mode="trust", auth="basic"), transport=fake.transport())
    assert "tls_trust_any" in [w["code"] for w in a.warnings()]
    quiet = pisr.ProvisionIsrAdapter("nvr-2", settings_for(settings, scheme="https", tls_mode="trust", auth="basic", suppress_tls_warning=True), transport=fake.transport())
    assert "tls_trust_any" not in [w["code"] for w in quiet.warnings()]


def test_probe_returns_the_certificate_for_pinning(settings, fake, monkeypatch):
    from smplwise.main import create_app

    _probe_env(monkeypatch, fake)
    monkeypatch.setattr(pisr, "PEER_CERTIFICATE", lambda host, port, timeout: {"sha256": PIN, "self_signed": True})
    app = create_app(settings)
    with TestClient(app) as c:
        body = {"vendor": "provision_isr", "host": HOST, "http_port": 80, "rtsp_port": 554, "username": USER, "password": PASSWORD,
                "extra": {"scheme": "https", "https_port": 443, "tls_mode": "trust"}}
        r = c.post("/api/v1/nvr/connection/test", json=body)
    res = r.json().get("result", r.json())
    assert res["ok"] is True and res["certificate"] == {"sha256": PIN, "self_signed": True, "matches_pin": None}
    assert res["transport"]["scheme"] == "https" and "tls_trust_any" in res["warnings"]


def test_go2rtc_source_native_option(settings):
    url = "rtsp://u:p@h:554/chID=1&streamType=main"
    assert vendor_io.go2rtc_source(settings_for(settings), url) == f"ffmpeg:{url}#video=copy"
    assert vendor_io.go2rtc_source(settings_for(settings, go2rtc_source="rtsp"), url) == url