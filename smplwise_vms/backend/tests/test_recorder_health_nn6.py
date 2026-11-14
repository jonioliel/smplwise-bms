"""NN6B + NN6H (CR-026 follow-ups), fake devices only (no network):

- NN6H: the Hikvision adapter's health detail - disks (`ContentMgmt/Storage`), connectivity (`InputProxy/channels/status`),
  recording (`System/workingstatus?format=json`, shaped like the lab capture of 2026-09-14) and the clock (`System/time`, read in
  the recorder's zone); GETs only, a failed part named and the rest still read, a refused or silent device stops the read.
- NN6B: the continuous-recording expectation per camera on top of the recorder's choice (both off by default).

Every device scenario asserts that only GET requests were sent."""
from __future__ import annotations

import datetime as dt
import json
import sys
from pathlib import Path
from zoneinfo import ZoneInfo

import httpx
import pytest
from conftest import as_user
from notify_src_world import API, World, clock  # noqa: F401 - fixtures

from smplwise.services import nvr
from smplwise.services import recorder_health as rh
from smplwise.services.recorders import hikvision as hik
from smplwise.services.recorders import provision_isr as pisr

sys.path.insert(0, str(Path(__file__).resolve().parent / "fixtures"))
from fake_provision import FakeProvision, settings_for  # noqa: E402

NS = 'xmlns="http://www.hikvision.com/ver20/XMLSchema"'
TZ = "Asia/Jerusalem"


class FakeHik:
    """A Hikvision NVR answering the four health reads (+ deviceInfo). Synthetic values; no address, serial or account."""

    def __init__(self) -> None:
        self.disks: list[tuple[str, str, str, int, int]] = [("2", "ok", "RW", 1907729, 596992)]  # (id, status, property, capacity, free)
        self.nas: list[tuple[str, str, str, int, int]] = []
        self.online = {1: True, 2: True, 3: False}
        self.records: dict[int, int] | None = {1: 1, 2: 0, 3: 0}
        self.wall: dt.datetime | None = None  # the device's wall clock (default: the real time in Israel)
        self.fail: dict[str, int] = {}  # path fragment -> HTTP status
        self.down = False
        self.requests: list[tuple[str, str]] = []

    def _storage(self) -> str:
        def one(tag, d):
            return (f"<{tag}><id>{d[0]}</id><{tag}Name>{tag}{d[0]}</{tag}Name><{tag}Type>SATA</{tag}Type><status>{d[1]}</status>"
                    f"<capacity>{d[3]}</capacity><freeSpace>{d[4]}</freeSpace><property>{d[2]}</property></{tag}>")
        return (f'<?xml version="1.0" encoding="UTF-8" ?><storage {NS}><hddList>{"".join(one("hdd", d) for d in self.disks)}</hddList>'
                f'<nasList>{"".join(one("nas", d) for d in self.nas)}</nasList><workMode>group</workMode></storage>')

    def _status(self) -> str:
        items = "".join(f"<InputProxyChannelStatus><id>{c}</id><online>{'true' if up else 'false'}</online></InputProxyChannelStatus>" for c, up in self.online.items())
        return f'<?xml version="1.0" encoding="UTF-8" ?><InputProxyChannelStatusList {NS}>{items}</InputProxyChannelStatusList>'

    def _working(self) -> str:
        chans = [{"chanNo": c, "online": 1, "record": r, "signal": 0, "linkNum": 0, "bitRate": 3145728} for c, r in (self.records or {}).items()]
        return json.dumps({"WorkingStatus": {"devStatus": 0, "ChanStatus": chans, "HDStatus": [{"hdNo": 2, "status": 0, "volume": 1907729, "freeSpace": 596992}]}})

    def _time(self) -> str:
        wall = self.wall or dt.datetime.now(ZoneInfo(TZ))
        # Hikvision tags the summer wall clock with the zone's STANDARD offset (+02:00) - KNOWN_QUIRKS
        local = wall.strftime("%Y-%m-%dT%H:%M:%S") + "+02:00"
        return f'<?xml version="1.0" encoding="UTF-8" ?><Time {NS}><timeMode>NTP</timeMode><localTime>{local}</localTime><timeZone>CST-2:00:00DST01:00:00,M3.5.5/02:00:00,M10.5.0/02:00:00</timeZone></Time>'

    def handler(self, request: httpx.Request) -> httpx.Response:
        path = request.url.path + (f"?{request.url.query.decode()}" if request.url.query else "")
        self.requests.append((request.method, path))
        if self.down:
            raise httpx.ConnectError("down")
        for frag, code in self.fail.items():
            if frag in path:
                return httpx.Response(code, text="<ResponseStatus><statusCode>4</statusCode></ResponseStatus>")
        if path.startswith("/ISAPI/System/deviceInfo"):
            return httpx.Response(200, text=f"<DeviceInfo {NS}><model>DS-TEST</model><firmwareVersion>V4.0</firmwareVersion></DeviceInfo>")
        if path == hik.STORAGE_PATH:
            return httpx.Response(200, text=self._storage())
        if path == hik.CHANNEL_STATUS_PATH:
            return httpx.Response(200, text=self._status())
        if path == hik.WORKING_STATUS_PATH:
            return httpx.Response(200, text=self._working())
        if path == hik.TIME_PATH:
            return httpx.Response(200, text=self._time())
        return httpx.Response(404, text="notFound")

    @property
    def writes(self) -> list[tuple[str, str]]:
        return [r for r in self.requests if r[0] != "GET"]


@pytest.fixture()
def fh(monkeypatch) -> FakeHik:
    f = FakeHik()
    monkeypatch.setattr(nvr, "_client", lambda settings, timeout=8.0: httpx.Client(base_url="http://nvr.test", transport=httpx.MockTransport(f.handler), timeout=timeout))
    rh.reset()
    yield f
    rh.reset()


def hik_adapter(settings, zone: str | None = TZ) -> hik.HikvisionAdapter:
    a = hik.HikvisionAdapter("nvr-1", settings)
    a.health_zone = zone
    return a


# ---------------------------------------------------------------- NN6H: the Hikvision read

def test_hikvision_declares_health_detail_and_reads_every_part_with_gets_only(settings, fh):
    a = hik_adapter(settings)
    assert a.capabilities().health_detail is True
    r = a.read_health()
    assert r.errors == {}
    assert [(d.ref, d.state, d.raw, d.total_mb, d.free_mb) for d in r.disks] == [("2", "ok", "ok", 1907729, 596992)]
    assert {c.channel: (c.connected, c.record_state) for c in r.channels} == {1: (True, "recording"), 2: (True, "idle"), 3: (False, "idle")}
    assert abs(r.clock_drift_s) <= 3, "the +02:00 summer tag is read as Israel wall clock, not an hour ahead"
    assert r.clock_sync == "NTP" and r.certificate is None and r.disk_alarms == ()
    assert fh.writes == []
    assert {p for _m, p in fh.requests} == {hik.STORAGE_PATH, hik.CHANNEL_STATUS_PATH, hik.WORKING_STATUS_PATH, hik.TIME_PATH}


@pytest.mark.parametrize("status,prop,state", [("ok", "RW", "ok"), ("ok", "RO", "read_only"), ("idle", "RW", "ok"), ("unformatted", "RW", "unformatted"),
                                               ("formating", "RW", "formatting"), ("error", "RW", "error"), ("smartFailed", "RW", "error"),
                                               ("offline", "RW", "error"), ("whatever", "RW", "unknown")])
def test_hikvision_disk_words_are_normalized_and_the_raw_word_kept(settings, fh, status, prop, state):
    fh.disks = [("1", status, prop, 1000, 10)]
    d = hik_adapter(settings).read_health().disks[0]
    assert (d.state, d.raw) == (state, status)


def test_hikvision_without_a_disk_reports_missing_and_a_nas_counts_as_a_disk(settings, fh):
    fh.disks = []
    assert [d.state for d in hik_adapter(settings).read_health().disks] == ["missing"]
    fh.nas = [("1", "ok", "RW", 5000, 2500)]
    assert [(d.ref, d.state) for d in hik_adapter(settings).read_health().disks] == [("nas1", "ok")]


def test_hikvision_a_refused_part_is_named_and_the_rest_still_read(settings, fh):
    fh.fail = {"workingstatus": 403}
    r = hik_adapter(settings).read_health()
    assert r.errors == {"recording": "source_forbidden"}
    assert r.disks is not None and all(c.record_state is None for c in r.channels) and r.channels[2].connected is False


def test_hikvision_recording_is_not_mapped_when_the_channel_numbers_do_not_cover_the_inputs(settings, fh):
    fh.records = {33: 1, 34: 0}  # numbering of another kind (e.g. a hybrid unit): no formula is guessed
    r = hik_adapter(settings).read_health()
    assert r.errors == {"recording": "channel_map_unproven"} and all(c.record_state is None for c in r.channels)


def test_hikvision_clock_drift_and_no_zone_means_not_judged(settings, fh):
    fh.wall = dt.datetime.now(ZoneInfo(TZ)) + dt.timedelta(seconds=200)
    assert 195 <= hik_adapter(settings).read_health().clock_drift_s <= 205
    r = hik_adapter(settings, zone=None).read_health()
    assert r.clock_drift_s is None and "clock" not in r.errors
    assert all(p != hik.TIME_PATH for _m, p in fh.requests[-3:])


def test_hikvision_a_silent_or_refusing_device_stops_the_read(settings, fh):
    fh.down = True
    st = rh.probe("nvr-1", "מקליט", "hikvision", hik_adapter(settings))
    assert (st.reachable, st.error, st.reading) == (False, "source_unavailable", None)
    fh.down = False
    fh.fail = {"Storage": 401}
    st = rh.probe("nvr-1", "מקליט", "hikvision", hik_adapter(settings))
    assert (st.reachable, st.error) == (False, "source_forbidden")
    assert fh.writes == []


def test_hikvision_card_shows_the_detail_sections(settings, fh):
    fh.disks = [("2", "ok", "RW", 1000, 0)]
    st = rh.probe("nvr-1", "מקליט", "hikvision", hik_adapter(settings))
    import time

    v = rh._recorder_view(st, rh.thresholds_defaults(), time.time(), {}, None)
    assert v["detail_supported"] is True and v["status"] == "warn"  # channel 3 disconnected
    assert v["disks"]["state"] == "ok" and v["disks"]["full"] is True, "full alone is not a fault (an overwriting NVR)"
    assert (v["recording"]["recording"], v["recording"]["watched"], v["recording"]["state"]) == (1, 2, "ok")
    assert v["channels"]["connected"] == 2 and v["channels"]["total"] == 3
    assert v["clock"]["state"] == "ok" and v["certificate"] is None


def test_the_poller_gives_a_hikvision_adapter_the_recorder_zone(settings, fh, monkeypatch):
    from fastapi.testclient import TestClient

    from smplwise import recorder_scope
    from smplwise.main import create_app

    monkeypatch.setattr(recorder_scope, "ready_ids", lambda s: ["nvr-1"])
    app = create_app(settings)
    with TestClient(app):
        db = app.state.db
        targets = rh._targets(db, settings)
        assert [(t[0], t[2], t[3].health_zone) for t in targets] == [("nvr-1", "hikvision", "Asia/Jerusalem")], "the installation's zone"
        with db.connection() as conn:
            conn.execute("INSERT OR IGNORE INTO recorders(id, name, created_at) VALUES ('nvr-1', 'NVR', '2026-10-05T00:00:00Z')")
            conn.execute("UPDATE recorders SET time_zone = 'Europe/London' WHERE id = 'nvr-1'")
        assert rh._targets(db, settings)[0][3].health_zone == "Europe/London", "the recorder's own zone wins"
    assert fh.requests == [], "building the targets makes no device call"


# ---------------------------------------------------------------- NN6H: notifications through the real app (World)

@pytest.fixture()
def w(settings, clock) -> World:  # noqa: F811
    rh.reset()
    yield World(settings, clock)
    rh.reset()


def hstep(w: World, settings, **advance) -> None:
    if advance:
        w.clock.advance(**advance)
    rh.probe("nvr-1", "מקליט ראשי", "hikvision", hik_adapter(settings), now_ts=w.clock.now.timestamp())
    w.tick()


def test_hikvision_disk_error_is_announced_and_motion_only_cameras_are_not(w, settings, fh):
    fh.records = {1: 0, 2: 0, 3: 0}  # nothing recording (motion-only): no alert by default (owner 2026-10-05)
    fh.disks = [("2", "error", "RW", 1000, 500)]
    hstep(w, settings)
    hstep(w, settings, seconds=65)
    hstep(w, settings, minutes=45)
    n = w.one("recorder.disk")
    assert n["severity"] == "critical" and "מקליט ראשי" in n["body"] and n["dedupe_key"] == "recorder.disk:nvr-1:2"
    assert w.rows("recorder.recording") == []
    assert fh.writes == []


def test_hikvision_camera_disconnect_goes_through_camera_offline(w, settings, fh):
    w.camera_status("online", w.clock.now)
    fh.online = {1: False, 2: True}
    fh.records = {1: 0, 2: 1}
    hstep(w, settings)
    hstep(w, settings, seconds=130)
    assert w.one("camera.offline")["subject_id"] == w.cam
    fh.online = {1: True, 2: True}
    hstep(w, settings, seconds=60)
    assert w.one("camera.offline")["state"] == "resolved"


# ---------------------------------------------------------------- NN6B: per-camera expectation

def test_camera_choice_validates_and_is_empty_by_default():
    assert rh.thresholds_defaults()["camera_recording"] == {}, "owner 2026-10-05: no expectation by default"
    assert rh.validate({"camera_recording": {"b": "events", "a": "continuous"}}) == {"camera_recording": {"a": "continuous", "b": "events"}}
    for bad in ({"camera_recording": []}, {"camera_recording": {"a": "always"}}, {"camera_recording": {"../x": "continuous"}}, {"camera_recording": {"a": True}},
                {"camera_recording": {f"c{i}": "events" for i in range(rh.CAMERA_MAX + 1)}}):
        with pytest.raises(Exception):
            rh.validate(bad)
    th = {**rh.thresholds_defaults(), "continuous_recorders": ["nvr-1"], "camera_recording": {"x": "events", "y": "continuous"}}
    assert rh.camera_continuous(th, "nvr-1", "x") is False and rh.camera_continuous(th, "nvr-1", "z") is True
    assert rh.camera_continuous(th, "nvr-2", "y") is True and rh.camera_continuous(th, "nvr-2", "z") is False


@pytest.fixture()
def fake() -> FakeProvision:
    pisr.clear_auth_cache()
    rh.reset()
    yield FakeProvision()
    rh.reset()
    pisr.clear_auth_cache()


def pstep(w: World, settings, fake: FakeProvision, **advance) -> None:
    if advance:
        w.clock.advance(**advance)
    a = pisr.ProvisionIsrAdapter("nvr-1", settings_for(settings, auth="basic"), transport=fake.transport())
    rh.probe("nvr-1", "מקליט ראשי", "provision_isr", a, now_ts=w.clock.now.timestamp())
    w.tick()


def test_one_camera_marked_continuous_alerts_while_its_recorder_stays_off(w, settings, fake):
    cam2 = w.c.post(f"{API}/cameras", json={"channel": 2, "alias": "חניה"}).json()["id"]
    g = w.c.get(f"{API}/recorder-health/settings").json()
    assert g["values"]["camera_recording"] == {} and {c["id"] for c in g["cameras"]} >= {w.cam, cam2}
    assert all(set(c) == {"id", "name", "recorder_id", "channel"} for c in g["cameras"])
    r = w.c.put(f"{API}/recorder-health/settings", json={"camera_recording": {cam2: "continuous"}})
    assert r.status_code == 200 and r.json()["values"]["camera_recording"] == {cam2: "continuous"} and r.json()["values"]["continuous_recorders"] == []
    fake.record = {1: "norecording", 2: "norecording"}
    pstep(w, settings, fake)
    pstep(w, settings, fake, minutes=31)
    pstep(w, settings, fake, seconds=65)
    rows = w.rows("recorder.recording")
    assert [x["subject_id"] for x in rows] == [cam2], "only the camera marked continuous"
    assert "חניה" in rows[0]["body"]
    with w.db.connection(mode="read") as conn:
        card = next(c for c in rh.view(conn, w.settings, w.clock.now.timestamp()) if c["id"] == "nvr-1")
    assert card["recording"]["continuous"] is False and card["recording"]["expected"] == 1 and [s["name"] for s in card["recording"]["stopped"]] == ["חניה"]
    assert fake.writes == []


def test_a_camera_marked_events_is_exempt_on_a_continuous_recorder(w, settings, fake):
    r = w.c.put(f"{API}/recorder-health/settings", json={"continuous_recorders": ["nvr-1"], "camera_recording": {w.cam: "events"}})
    assert r.status_code == 200, r.text
    fake.record = {1: "norecording"}
    pstep(w, settings, fake)
    pstep(w, settings, fake, minutes=31)
    pstep(w, settings, fake, seconds=65)
    assert w.rows("recorder.recording") == []
    fake.record = {1: "exception"}  # a fault the device reports still alerts
    pstep(w, settings, fake, seconds=5)
    pstep(w, settings, fake, seconds=65)
    assert "תקלת הקלטה" in w.one("recorder.recording")["body"]


def test_camera_choice_api_is_for_administrators_and_audited(w, settings):
    assert w.c.put(f"{API}/recorder-health/settings", json={"camera_recording": {w.cam: "continuous"}}, headers=as_user("ops2")).status_code == 403
    assert w.c.put(f"{API}/recorder-health/settings", json={"camera_recording": {w.cam: "sometimes"}}).status_code == 422
    assert w.c.put(f"{API}/recorder-health/settings", json={"camera_recording": {w.cam: "continuous"}}).status_code == 200
    with w.db.connection(mode="read") as conn:
        row = conn.execute("SELECT details_json FROM audit_log WHERE action = 'recorder_health.settings' ORDER BY rowid DESC LIMIT 1").fetchone()
    assert "camera_recording" in row[0]
