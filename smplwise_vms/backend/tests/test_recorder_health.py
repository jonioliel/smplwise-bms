"""CR-026 recorder health monitoring (fake Provision-ISR device only, no network): the adapter's health read, the conditions,
the notifications with hold / bands / recover hold, camera connectivity through camera.offline, the API and its permissions.
Scenarios: disk full / locked / unformatted / missing, disk alarm, camera disconnect and reconnect, recording stopped,
clock drift, API down, certificate expiry. Every scenario also asserts that nothing was written to the device."""
from __future__ import annotations

import dataclasses
import datetime as dt
import sys
import time
from pathlib import Path

import pytest
from conftest import as_user
from notify_src_world import API, Clock, World, clock, fake_push, iso  # noqa: F401 - fixtures

from smplwise.services import recorder_health as rh
from smplwise.services.recorders import base
from smplwise.services.recorders import provision_isr as pisr
from smplwise.services.recorders import provision_time as pt

sys.path.insert(0, str(Path(__file__).resolve().parent / "fixtures"))
from fake_provision import FakeProvision, settings_for  # noqa: E402

PIN = "cd" * 32


@pytest.fixture()
def fake() -> FakeProvision:
    pisr.clear_auth_cache()
    rh.reset()
    f = FakeProvision()
    yield f
    rh.reset()
    pisr.clear_auth_cache()


def device_now(offset_s: float = 0.0) -> str:
    """The fake's wall clock = the real time (+ offset) in the fake's own rule (IST-2IDT,M3.4.4/26,M10.5.0)."""
    tz = pt.PosixTz("IST-2IDT,M3.4.4/26,M10.5.0")
    return pt.format_wall(pt.utc_to_wall(dt.datetime.now(dt.timezone.utc) + dt.timedelta(seconds=offset_s), tz))


def adapter(settings, fake: FakeProvision, **extra) -> pisr.ProvisionIsrAdapter:
    return pisr.ProvisionIsrAdapter("nvr-1", settings_for(settings, auth="basic", **extra), transport=fake.transport())


# ---------------------------------------------------------------- the adapter's read (device I/O, read-only)

def test_read_health_reads_disks_recording_channels_and_clock_without_writing(settings, fake):
    fake.clock = lambda: device_now(+3)
    a = adapter(settings, fake)
    assert a.capabilities().health_detail is True
    r = a.read_health()
    assert r.errors == {}
    assert [(d.ref, d.state, d.raw, d.total_mb, d.free_mb) for d in r.disks] == [("1", "ok", "read/write", 953869, 847872)]
    assert {c.channel: (c.connected, c.record_state) for c in r.channels} == {1: (True, "recording"), 2: (True, "idle"), 3: (False, None), 4: (False, None)}
    assert 1.0 <= r.clock_drift_s <= 5.0, r.clock_drift_s
    assert r.clock_sync == "NTP" and r.certificate is None and r.disk_alarms == ()
    assert fake.writes == []


@pytest.mark.parametrize("status,state", [("read", "read_only"), ("locked", "locked"), ("unformat", "unformatted"), ("exception", "error"), ("formatting", "formatting"), ("weird", "unknown")])
def test_disk_states_are_normalized_and_the_raw_word_kept(settings, fake, status, state):
    fake.disks = [(1000, 10, status)]
    d = adapter(settings, fake).read_health().disks[0]
    assert (d.state, d.raw) == (state, status)


def test_an_nvr_without_a_disk_reports_missing_and_disk_alarms_are_named(settings, fake):
    fake.disks = []
    fake.alarms = {("diskFullAlarm", None): True, ("motionAlarm", 1): True}
    r = adapter(settings, fake).read_health()
    assert [d.state for d in r.disks] == ["missing"]
    assert r.disk_alarms == ("diskFullAlarm",)


def test_live_shape_offline_alarm_marks_the_channel_disconnected(settings, fake):
    fake.shape = "live"
    fake.channels = {1: "online", 2: "offline"}
    r = adapter(settings, fake).read_health()
    assert {c.channel: c.connected for c in r.channels} == {1: True, 2: False}


def test_a_failed_part_is_named_and_the_rest_still_read(settings, fake):
    fake.fail = {"GetRecordStatusInfo": 5}
    r = adapter(settings, fake).read_health()
    assert "recording" in r.errors and r.disks is not None
    assert all(c.record_state is None for c in r.channels)


def test_pinned_https_reports_the_certificate_expiry_with_one_cached_handshake(settings, fake, monkeypatch):
    calls = []
    monkeypatch.setattr(pisr, "PEER_CERTIFICATE", lambda host, port, timeout: calls.append(port) or {"sha256": PIN, "self_signed": True, "not_after": "2034-01-01T00:00:00Z"})
    a = adapter(settings, fake, scheme="https", tls_mode="pin", tls_pin=PIN)
    assert a.read_health().certificate == {"not_after": "2034-01-01T00:00:00Z", "self_signed": True}
    a.read_health()
    assert len(calls) == 2, "one handshake for the pin check, one for the expiry; the second read uses both caches"


def test_an_unreachable_device_stops_the_read(settings, fake):
    fake.down = True
    st = rh.probe("nvr-1", "מקליט", "provision_isr", adapter(settings, fake))
    assert (st.reachable, st.error, st.reading) == (False, "source_unavailable", None)


# ---------------------------------------------------------------- pure parts

def test_fill_projection_needs_six_hours_and_a_shrinking_disk():
    h = 3600
    assert rh.fill_projection([(0, 1000, 2000), (h, 900, 2000)]) is None, "too short"
    assert rh.fill_projection([(0, 1000, 2000), (6 * h, 1000, 2000)]) is None, "not shrinking"
    assert rh.fill_projection([(0, 10, 2000), (6 * h, 5, 2000)]) is None, "full: an overwriting NVR stays full"
    days = rh.fill_projection([(0, 1000, 2000), (12 * h, 900, 2000)])
    assert days == pytest.approx(900 / (100 / (12 * h)) / 86400, rel=0.01)


def test_thresholds_validate_and_fall_back_to_defaults():
    assert rh.validate({"clock_drift_s": 30, "continuous_recorders": ["nvr-2", "nvr-1", "nvr-2"]}) == {"clock_drift_s": 30, "continuous_recorders": ["nvr-1", "nvr-2"]}
    for bad in ({"clock_drift_s": 1}, {"clock_drift_s": True}, {"nope": 1}, {"continuous_recorders": "nvr-1"}, {"continuous_recorders": ["ha_x"]},
                {"continuous_recorders": [""]}, {"recording_mode": "continuous"}):
        with pytest.raises(Exception):
            rh.validate(bad)
    d = rh.thresholds_defaults()
    assert d["disk_fill_days"] == 0 and d["continuous_recorders"] == [], "owner 2026-10-05: both off by default"


def test_disk_fill_forecast_is_off_by_default_and_works_when_set(w, settings, fake):
    st = rh.state_of("nvr-1")
    st.name, st.detail_supported = "מקליט ראשי", True
    t0 = w.clock.now.timestamp()
    for i in range(13):  # 12 hours, 100 MB an hour less: the last 800 MB last about 8 hours
        st.samples.append((t0 - (12 - i) * 3600, 2000 - i * 100, 4000))
    fake.disks = [(4000, 800, "read/write")]
    for _ in range(3):
        step(w, settings, fake, seconds=1)
    assert w.rows("recorder.disk_space") == []
    assert w.c.put(f"{API}/recorder-health/settings", json={"disk_fill_days": 10}).status_code == 200
    step(w, settings, fake, seconds=1)
    assert "ימים" in w.one("recorder.disk_space")["body"]


# ---------------------------------------------------------------- notifications (World: the real app, database and notification core)

@pytest.fixture()
def w(settings, clock) -> World:  # noqa: F811
    rh.reset()
    yield World(settings, clock)
    rh.reset()


def poll(w: World, settings, fake: FakeProvision) -> rh.RecState:
    return rh.probe("nvr-1", "מקליט ראשי", "provision_isr", adapter(settings, fake), now_ts=w.clock.now.timestamp())


def step(w: World, settings, fake: FakeProvision, **advance) -> None:
    if advance:
        w.clock.advance(**advance)
    poll(w, settings, fake)
    w.tick()


def test_disk_locked_is_held_announced_once_and_resolved_only_after_the_recover_hold(w, settings, fake):
    fake.disks = [(1000, 500, "locked")]
    step(w, settings, fake)
    assert w.rows("recorder.disk") == [], "held for the policy's 60 s"
    step(w, settings, fake, seconds=65)
    n = w.one("recorder.disk")
    assert (n["severity"], n["category"], n["subject_kind"], n["subject_id"], n["dedupe_key"]) == ("alert", "device_faults", "system", "nvr-1", "recorder.disk:nvr-1:1")
    assert "מקליט ראשי" in n["body"] and "נעול" in n["body"] and n["link"] == "#/system/diagnostics?tab=health"
    step(w, settings, fake, seconds=60)
    assert w.one("recorder.disk")["count"] == 1
    fake.disks = [(1000, 500, "read/write")]
    step(w, settings, fake, seconds=30)
    assert w.one("recorder.disk")["state"] != "resolved", "clear for less than recover_s (120 s): still open"
    step(w, settings, fake, seconds=130)
    assert w.one("recorder.disk")["state"] == "resolved"
    assert fake.writes == []


def test_disk_error_and_missing_disk_are_critical(w, settings, fake):
    fake.disks = [(1000, 0, "exception")]
    step(w, settings, fake)
    step(w, settings, fake, seconds=65)
    assert w.one("recorder.disk")["severity"] == "critical"


def test_disk_full_with_recording_continuing_is_not_a_fault(w, settings, fake):
    fake.disks = [(1000, 0, "read/write")]
    fake.record = {1: "recording"}
    step(w, settings, fake)
    step(w, settings, fake, seconds=600)
    assert w.rows("recorder.disk") == [] and w.rows("recorder.disk_space") == []
    with w.db.connection(mode="read") as conn:
        card = rh.view(conn, w.settings, w.clock.now.timestamp())
    disks = next(c for c in card if c["id"] == "nvr-1")["disks"]
    assert disks["full"] is True and disks["state"] == "ok"


def test_recording_stopped_after_the_gap_and_back_for_a_continuous_recorder(w, settings, fake):
    r = w.c.put(f"{API}/recorder-health/settings", json={"continuous_recorders": ["nvr-1"]})
    assert r.status_code == 200 and r.json()["values"]["continuous_recorders"] == ["nvr-1"], r.text
    fake.record = {1: "norecording"}
    step(w, settings, fake)
    step(w, settings, fake, minutes=20)
    assert w.rows("recorder.recording") == [], "inside the 30-minute gap"
    step(w, settings, fake, minutes=11)
    step(w, settings, fake, seconds=65)
    n = w.one("recorder.recording")
    assert (n["subject_kind"], n["subject_id"], n["severity"]) == ("camera", w.cam, "alert")
    assert "לובי" in n["body"]
    fake.record = {1: "recording"}
    step(w, settings, fake, seconds=60)
    step(w, settings, fake, seconds=90)
    assert w.one("recorder.recording")["state"] == "resolved"


def test_by_default_only_device_reported_recording_faults_alert(w, settings, fake):
    """Owner 2026-10-05: a camera that records on motion only is idle most of the time - no alert unless its recorder is marked
    continuous; a recording exception the device reports alerts at once."""
    fake.record = {1: "norecording"}
    step(w, settings, fake)
    step(w, settings, fake, minutes=45)
    assert w.rows("recorder.recording") == []
    fake.record = {1: "exception"}
    step(w, settings, fake, seconds=5)
    step(w, settings, fake, seconds=65)
    assert "תקלת הקלטה" in w.one("recorder.recording")["body"]


def test_clock_drift_has_a_band_and_a_hold(w, settings, fake):
    fake.clock = lambda: device_now(+200)
    step(w, settings, fake)
    step(w, settings, fake, seconds=300)
    assert w.rows("recorder.clock") == [], "held for 600 s"
    step(w, settings, fake, seconds=320)
    assert "מקדים" in w.one("recorder.clock")["body"]
    fake.clock = lambda: device_now(+40)  # under 60 but above 30: the band keeps it on
    step(w, settings, fake, seconds=300)
    assert w.one("recorder.clock")["state"] != "resolved"
    fake.clock = lambda: device_now(+2)
    step(w, settings, fake, seconds=30)
    step(w, settings, fake, seconds=130)
    assert w.one("recorder.clock")["state"] == "resolved"


def test_api_down_is_announced_and_keeps_the_detail_alerts_open(w, settings, fake):
    fake.disks = [(1000, 500, "unformat")]
    step(w, settings, fake)
    step(w, settings, fake, seconds=65)
    assert w.one("recorder.disk")["state"] != "resolved"
    fake.down = True
    step(w, settings, fake, seconds=30)
    step(w, settings, fake, seconds=130)
    n = w.one("recorder.unreachable")
    assert (n["severity"], n["subject_id"]) == ("critical", "nvr-1") and "אין תקשורת" in n["body"]
    step(w, settings, fake, seconds=300)
    assert w.one("recorder.disk")["state"] != "resolved", "a recorder that does not answer does not resolve its disk alert"
    fake.down = False
    fake.disks = None
    step(w, settings, fake, seconds=30)
    step(w, settings, fake, seconds=130)
    assert w.one("recorder.unreachable")["state"] == "resolved" and w.one("recorder.disk")["state"] == "resolved"


def test_a_stale_reading_is_not_judged(w, settings, fake):
    fake.disks = [(1000, 500, "locked")]
    step(w, settings, fake)
    step(w, settings, fake, seconds=65)
    w.clock.advance(minutes=30)  # the poller stopped: nothing fresh
    w.tick()
    assert w.one("recorder.disk")["state"] != "resolved"
    assert w.rows("recorder.unreachable") == []


def test_camera_disconnect_and_reconnect_go_through_camera_offline(w, settings, fake):
    w.camera_status("online", w.clock.now)
    fake.channels = {1: "offline", 2: "online"}
    step(w, settings, fake)
    step(w, settings, fake, seconds=130)
    n = w.one("camera.offline")
    assert n["subject_id"] == w.cam
    assert w.rows("recorder.recording") == [], "a disconnected camera is not also a recording fault"
    fake.channels = {1: "online", 2: "online"}
    step(w, settings, fake, seconds=60)
    assert w.one("camera.offline")["state"] == "resolved"


def test_certificate_expiry_is_announced(w, settings, fake, monkeypatch):
    soon = (dt.datetime.now(dt.timezone.utc) + dt.timedelta(days=10)).strftime("%Y-%m-%dT%H:%M:%SZ")
    monkeypatch.setattr(pisr, "PEER_CERTIFICATE", lambda host, port, timeout: {"sha256": PIN, "self_signed": True, "not_after": soon})
    a = adapter(settings, fake, scheme="https", tls_mode="pin", tls_pin=PIN)
    rh.probe("nvr-1", "מקליט ראשי", "provision_isr", a, now_ts=w.clock.now.timestamp())
    w.tick()
    n = w.one("recorder.certificate")
    assert n["severity"] == "alert" and "ימים" in n["body"]


def test_the_primary_unreachable_is_not_told_twice_when_nvr_offline_is_open(w, settings, fake):
    w.emit("nvr.offline", "system", "nvr", params={"name": "המקליט"})
    fake.down = True
    for advance in (0, 130):  # the recorder pass alone (the full tick would judge nvr.offline from this test's healthy summary)
        w.clock.advance(seconds=advance)
        poll(w, settings, fake)
        with w.db.connection() as conn:
            rh.tick(conn, w.clock.now)
    assert w.rows("recorder.unreachable") == []
    assert w.one("nvr.offline")["state"] != "resolved"


# ---------------------------------------------------------------- API

def test_health_api_cards_and_permissions(w, settings, fake):
    fake.disks = [(1000, 400, "read")]
    poll(w, settings, fake)
    r = w.c.get(f"{API}/recorder-health")
    assert r.status_code == 200, r.text
    card = next(c for c in r.json()["recorders"] if c["id"] == "nvr-1")
    assert card["status"] == "error" and card["disks"]["items"][0]["text"] == "לקריאה בלבד"
    assert card["api"]["state"] in ("ok", "warn") and card["clock"]["state"] in ("ok", "warn")
    text = r.text
    for secret in ("provision-nvr.test", "arx-test", "fake-pass-1", "FAKESERIAL0001", "00:00:5E:00:53:01"):
        assert secret not in text, secret
    assert w.c.get(f"{API}/recorder-health", headers=as_user("ops2")).status_code == 403
    assert w.c.get(f"{API}/recorder-health/settings", headers=as_user("ops2")).status_code == 403
    assert w.c.put(f"{API}/recorder-health/settings", json={"clock_drift_s": 30}, headers=as_user("ops2")).status_code == 403
    g = w.c.get(f"{API}/recorder-health/settings").json()
    assert g["values"]["clock_drift_s"] == 60 and g["ranges"]["clock_drift_s"] == {"default": 60, "min": 5, "max": 3600}
    p = w.c.put(f"{API}/recorder-health/settings", json={"clock_drift_s": 30})
    assert p.status_code == 200 and p.json()["values"]["clock_drift_s"] == 30
    assert w.c.put(f"{API}/recorder-health/settings", json={"clock_drift_s": 0}).status_code == 422
    with w.db.connection(mode="read") as conn:
        assert conn.execute("SELECT COUNT(*) FROM audit_log WHERE action = 'recorder_health.settings'").fetchone()[0] == 1
    assert fake.writes == []


def test_an_adapter_without_health_detail_gets_reachability_only(settings):
    """A vendor that does not declare `health_detail` (Hikvision did until NN6H; its detail is in test_recorder_health_nn6)."""
    cap = base.RecorderCapabilities(vendor="hikvision", read_encodings=True, write_encodings=False, encoding_fields=frozenset(), add_channel=False,
                                    remove_channel=False, max_channels=None, live="rtsp", playback="rtsp", events="push")
    assert cap.health_detail is False

    class Hik:
        vendor = "hikvision"

        def capabilities(self):
            return cap

        def health(self):
            return base.RecorderHealth(online=True, model="DS", firmware="V4", error=None)

    rh.reset()
    st = rh.probe("nvr-2", "שני", "hikvision", Hik(), now_ts=time.time())
    v = rh._recorder_view(st, rh.thresholds_defaults(), time.time(), {}, None)
    assert v["status"] == "ok" and v["disks"] == {"state": "off"} and v["certificate"] == {"state": "off"}
    rh.reset()
