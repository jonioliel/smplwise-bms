"""0.1.71: NVR system writes against the fake NVR - clock sync (not rollbackable), NTP, OSD + channel name, alarm
output pulse, S.M.A.R.T. test, reboot with the typed word, and the VMS-side connection edit."""
from __future__ import annotations

import datetime as dt
from zoneinfo import ZoneInfo
import json

import httpx
from conftest import as_user, bind
from fastapi.testclient import TestClient

from smplwise.main import create_app
from smplwise.services import nvr, nvr_system, nvr_write

NS = 'xmlns="http://www.hikvision.com/ver20/XMLSchema"'
OK = '<?xml version="1.0" encoding="UTF-8" ?><ResponseStatus><statusCode>1</statusCode><statusString>OK</statusString><subStatusCode>ok</subStatusCode></ResponseStatus>'
TIME = f'<?xml version="1.0" encoding="UTF-8" ?><Time version="1.0" {NS}><timeMode>NTP</timeMode><localTime>2026-09-18T02:35:00+02:00</localTime><timeZone>CST-2:00:00DST01:00:00,M3.5.5/02:00:00,M10.5.0/02:00:00</timeZone><windowsZone>Israel Standard Time</windowsZone></Time>'
NTP = f'<?xml version="1.0" encoding="UTF-8" ?><NTPServer version="1.0" {NS}><id>1</id><addressingFormatType>hostname</addressingFormatType><hostName>ntp.example.org</hostName><portNo>123</portNo><synchronizeInterval>1440</synchronizeInterval></NTPServer>'
OVERLAYS = (f'<?xml version="1.0" encoding="UTF-8" ?><VideoOverlay version="1.0" {NS}><normalizedScreenSize><normalizedScreenWidth>704</normalizedScreenWidth><normalizedScreenHeight>576</normalizedScreenHeight></normalizedScreenSize>'
            f'<DateTimeOverlay version="1.0" {NS}><enabled>true</enabled><positionX>0</positionX><positionY>576</positionY><dateStyle>MM-DD-YYYY</dateStyle><timeStyle>24hour</timeStyle><displayWeek>true</displayWeek></DateTimeOverlay>'
            f'<channelNameOverlay version="1.0" {NS}><enabled>true</enabled><positionX>512</positionX><positionY>64</positionY></channelNameOverlay></VideoOverlay>')
PROXY = f'<?xml version="1.0" encoding="UTF-8" ?><InputProxyChannel version="1.0" {NS}><id>1</id><name>Camera 01</name><sourceInputPortDescriptor><proxyProtocol>HIKVISION</proxyProtocol><userName>admin</userName></sourceInputPortDescriptor></InputProxyChannel>'
OUTPUTS = (f'<?xml version="1.0" encoding="UTF-8" ?><IOOutputPortList version="1.0" {NS}><IOOutputPort version="1.0" {NS}><id>1</id><PowerOnState><defaultState>low</defaultState><outputState>pulse</outputState><pulseDuration>5000</pulseDuration></PowerOnState><name>ממסר</name><IOUseType>disable</IOUseType><enabled>true</enabled><IOType>local</IOType></IOOutputPort>'
           f'<IOOutputPort version="1.0" {NS}><id>802</id><PowerOnState><defaultState/><outputState/><pulseDuration/></PowerOnState><IOUseType>whiteLight</IOUseType><enabled>true</enabled><IOType>digitalChannel</IOType></IOOutputPort></IOOutputPortList>')
HDD = f'<?xml version="1.0" encoding="UTF-8" ?><hddList version="1.0" {NS}><hdd version="1.0" {NS}><id>2</id><hddName>hdd2</hddName><hddType>SATA</hddType><status>ok</status><capacity>1907729</capacity><freeSpace>41984</freeSpace><property>RW</property></hdd></hddList>'
SMART = f'<?xml version="1.0" encoding="UTF-8" ?><SMARTTest version="1.0" {NS}><id>2</id><temprature>40</temprature><powerOnDay>23</powerOnDay><selfEvaluaingStatus>ok</selfEvaluaingStatus><allEvaluaingStatus>functional</allEvaluaingStatus><selfTestPercent>0</selfTestPercent></SMARTTest>'
DEVICE = f'<?xml version="1.0" encoding="UTF-8" ?><DeviceInfo version="1.0" {NS}><model>DS-TEST</model><firmwareVersion>V1</firmwareVersion><deviceType>NVR</deviceType></DeviceInfo>'


class FakeNvr:
    def __init__(self):
        self.docs = {"/ISAPI/System/time": TIME, "/ISAPI/System/time/ntpServers/1": NTP, "/ISAPI/System/Video/inputs/channels/1/overlays": OVERLAYS,
                     "/ISAPI/ContentMgmt/InputProxy/channels/1": PROXY, "/ISAPI/System/IO/outputs": OUTPUTS, "/ISAPI/ContentMgmt/Storage/hdd": HDD,
                     "/ISAPI/ContentMgmt/Storage/hdd/2/SMARTTest/status": SMART, "/ISAPI/System/deviceInfo": DEVICE}
        self.commands: list[tuple[str, str]] = []

    def handler(self, request: httpx.Request) -> httpx.Response:
        path = request.url.path
        if request.method == "GET":
            return httpx.Response(200, text=self.docs[path]) if path in self.docs else httpx.Response(403, text="<ResponseStatus><statusCode>4</statusCode><subStatusCode>notSupport</subStatusCode></ResponseStatus>")
        if request.method == "PUT":
            if path.endswith("/trigger") or path.endswith("/SMARTTest") or path == "/ISAPI/System/reboot":
                self.commands.append((path, request.content.decode("utf-8")))
                return httpx.Response(200, text=OK)
            if path not in self.docs:
                return httpx.Response(403, text="<ResponseStatus><statusCode>4</statusCode><subStatusCode>notSupport</subStatusCode></ResponseStatus>")
            self.docs[path] = request.content.decode("utf-8")
            return httpx.Response(200, text=OK)
        return httpx.Response(405)

    def client(self, _settings=None) -> httpx.Client:
        return httpx.Client(transport=httpx.MockTransport(self.handler), base_url="http://nvr")


def _grant(c: TestClient, settings, sensitive: list[str]) -> dict[str, str]:
    role = c.post("/api/v1/access/roles", json={"name": "מערכת NVR", "description": "", "permissions": ["map.read"], "sensitive": sensitive}).json()
    bind(c, settings, "dan", role["id"], "installation", "*")
    return as_user("dan")


def test_xml_helpers():
    assert nvr_system.tag(TIME, "timeMode") == "NTP"
    assert "<timeMode>manual</timeMode>" in nvr_system.set_tag(TIME, "timeMode", "manual")
    d = nvr_system.osd_document(OVERLAYS, name_enabled=False, datetime_enabled=None, date_style="DD-MM-YYYY", time_style=None, display_week=None)
    assert "<channelNameOverlay" in d and d.count("<enabled>false</enabled>") == 1 and "<dateStyle>DD-MM-YYYY</dateStyle>" in d
    assert "<enabled>true</enabled>" in d.split("<channelNameOverlay")[0], "the DateTimeOverlay block keeps its own enabled flag"
    t = nvr_system.time_document(TIME, mode="manual", at=dt.datetime(2026, 9, 18, 0, 40, 5, tzinfo=dt.timezone.utc))
    assert "<localTime>2026-09-18T02:40:05+02:00</localTime>" in t and "<timeMode>manual</timeMode>" in t
    # with the installation zone the clock is written as the wall clock (summer time applied) under the device's own tag
    tz = ZoneInfo("Asia/Jerusalem")
    t = nvr_system.time_document(TIME, mode=None, at=dt.datetime(2026, 9, 18, 0, 40, 5, tzinfo=dt.timezone.utc), tz=tz)
    assert "<localTime>2026-09-18T03:40:05+02:00</localTime>" in t
    n = nvr_system.ntp_document(NTP, host="192.0.2.5", port=123, interval_min=60)
    assert "<addressingFormatType>ipaddress</addressingFormatType>" in n and "<synchronizeInterval>60</synchronizeInterval>" in n


def test_system_status_and_writes(settings, monkeypatch):
    fake = FakeNvr()
    monkeypatch.setattr(nvr_write, "_client", fake.client)
    monkeypatch.setattr(nvr_system, "_client", fake.client)
    app = create_app(settings)
    with TestClient(app) as c:
        cam = c.post("/api/v1/cameras", json={"channel": 1, "alias": "לובי"}).json()
        st = c.get("/api/v1/nvr/system").json()
        assert st["time"]["mode"] == "NTP" and st["time"]["ntp"]["host"] == "ntp.example.org" and isinstance(st["time"]["drift_s"], int)
        assert st["disks"][0]["id"] == 2 and st["disks"][0]["smart"]["temperature_c"] == 40 and st["disks"][0]["smart"]["power_on_days"] == 23
        assert [o["id"] for o in st["outputs"]] == [1, 802] and st["outputs"][1]["use_type"] == "whiteLight" and st["outputs"][0]["pulse_supported"] and not st["outputs"][1]["pulse_supported"]
        assert st["can"] == {"time": True, "storage": True, "alarm": True, "reboot": True, "osd": True, "connection": True}, "the system administrator writes to the NVR"
        bind(c, settings, "sam", "site_admin", "installation", "*")  # a site administrator: NVR writes stay out of reach
        hs = as_user("sam")
        # every write needs its own sensitive permission
        assert c.put("/api/v1/nvr/time", json={"sync_now": True}, headers=hs).status_code == 403
        h = _grant(c, settings, ["nvr.config.time", "nvr.config.osd", "nvr.alarm_output", "nvr.storage.test", "nvr.system.reboot"])
        # clock: written in manual mode, mode put back to NTP; neither record can be rolled back
        r = c.put("/api/v1/nvr/time", json={"sync_now": True}, headers=h)
        assert r.status_code == 200, r.text
        assert r.json()["status"] == "applied" and r.json()["has_before"] is False
        assert "<timeMode>NTP</timeMode>" in fake.docs["/ISAPI/System/time"] and "+02:00</localTime>" in fake.docs["/ISAPI/System/time"]
        assert c.post(f"/api/v1/nvr/changes/{r.json()['id']}/rollback", headers=h).status_code == 409
        # NTP
        r = c.put("/api/v1/nvr/ntp", json={"host": "pool.ntp.org", "interval_min": 60}, headers=h)
        assert r.status_code == 200 and "<hostName>pool.ntp.org</hostName>" in fake.docs["/ISAPI/System/time/ntpServers/1"]
        assert c.put("/api/v1/nvr/ntp", json={"host": "bad host!"}, headers=h).status_code == 422
        # OSD
        o = c.get(f"/api/v1/cameras/{cam['id']}/osd", headers=h).json()
        assert o["nvr_name"] == "Camera 01" and o["vms_name"] == "לובי" and o["channel_name"]["enabled"] is True and o["can_write"] is True
        r = c.put(f"/api/v1/cameras/{cam['id']}/osd", json={"datetime_enabled": False, "date_style": "DD-MM-YYYY"}, headers=h)
        assert r.status_code == 200 and "<dateStyle>DD-MM-YYYY</dateStyle>" in fake.docs["/ISAPI/System/Video/inputs/channels/1/overlays"]
        r = c.post(f"/api/v1/cameras/{cam['id']}/osd/name", json={}, headers=h)
        assert r.status_code == 201 and r.json()["name"] == "לובי" and "<name>לובי</name>" in fake.docs["/ISAPI/ContentMgmt/InputProxy/channels/1"]
        assert c.get(f"/api/v1/cameras/{cam['id']}/osd", headers=h).json()["nvr_name"] == "לובי"
        # alarm output pulse, S.M.A.R.T. test, reboot: one-shot commands, recorded without a "before"
        r = c.post("/api/v1/nvr/outputs/802/pulse", headers=h)
        assert r.status_code == 201 and r.json()["has_before"] is False and fake.commands[-1][0] == "/ISAPI/System/IO/outputs/802/trigger" and "<outputState>high</outputState>" in fake.commands[-1][1]
        r = c.post("/api/v1/nvr/storage/2/smart-test", json={"kind": "short"}, headers=h)
        assert r.status_code == 201 and fake.commands[-1][0] == "/ISAPI/ContentMgmt/Storage/hdd/2/SMARTTest" and "<selfTestType>short</selfTestType>" in fake.commands[-1][1]
        assert c.post("/api/v1/nvr/reboot", json={"confirm": "yes"}, headers=h).status_code == 422
        r = c.post("/api/v1/nvr/reboot", json={"confirm": "restart"}, headers=h)
        assert r.status_code == 201 and fake.commands[-1][0] == "/ISAPI/System/reboot"
        kinds = [x["kind"] for x in c.get("/api/v1/nvr/changes").json()["changes"]]
        assert {"time", "osd", "alarm_output", "storage_test", "reboot"} <= set(kinds)
        audit = c.get("/api/v1/audit?prefix=nvr.&limit=50").json()
        rows = audit if isinstance(audit, list) else next((v for v in audit.values() if isinstance(v, list)), [])
        assert any(e.get("action") == "nvr.write" and "reboot" in json.dumps(e.get("details") or {}) for e in rows), rows[:2]


def test_connection_edit_tests_first_then_saves(settings, monkeypatch, tmp_path):
    fake = FakeNvr()
    seen: list[str] = []

    def fake_client(s):
        seen.append(f"{s.nvr_host}:{s.nvr_http_port}:{s.nvr_user}:{s.nvr_password}")
        if s.nvr_host == "bad":
            return httpx.Client(transport=httpx.MockTransport(lambda _r: httpx.Response(401, text="")), base_url="http://nvr")
        return fake.client(s)

    from smplwise.services import connection_probe

    monkeypatch.setattr(nvr, "_client", fake_client)
    monkeypatch.setattr(connection_probe, "RESOLVE", lambda _h: [])  # no DNS from a test: the fixture names do not resolve
    app = create_app(settings)
    with TestClient(app) as c:
        assert c.get("/api/v1/nvr/connection").json()["has_password"] in (True, False)
        r = c.put("/api/v1/nvr/connection", json={"host": "bad", "user": "u", "password": "p"})
        assert r.status_code in (502, 503), r.text
        # the 0.1.71 body (`user`, no vendor) is still accepted
        r = c.put("/api/v1/nvr/connection", json={"host": "nvr.local", "http_port": 8080, "user": "writer", "password": "s3cret"})
        assert r.status_code == 200, r.text
        body = r.json()
        # CR-022: stored in Arx (no Supervisor options, no workstation file) and applied by a restart, never in-process
        assert body["saved"] is True and body["device"]["model"] == "DS-TEST" and body["host"] == "nvr.local" and body["restarting"] is False
        assert body["restart_required"] is True and body["pending_restart"] is True and body["revision"] == 1
        assert seen[-1] == "nvr.local:8080:writer:s3cret"
        assert not (settings.data_dir / "nvr_connection.json").exists()
        assert app.state.settings.nvr_host == settings.nvr_host, "the running process keeps its connection until the restart"
        v = c.get("/api/v1/nvr/connection").json()
        assert v["host"] == "nvr.local" and v["http_port"] == 8080 and v["has_password"] is True and "s3cret" not in r.text and "s3cret" not in json.dumps(v)
        # keeping the password: absent field
        r = c.put("/api/v1/nvr/connection", json={"host": "nvr.local", "http_port": 8080, "user": "writer"})
        assert r.status_code == 200 and seen[-1].endswith(":writer:s3cret") and r.json()["revision"] == 2


def test_device_instant_reads_the_wall_clock_in_the_installation_zone():
    tz = ZoneInfo("Asia/Jerusalem")
    utc = dt.timezone.utc
    # September (summer time, +03:00): the NVR shows the right wall clock with the standard tag +02:00
    assert nvr_system.device_instant("2026-09-30T12:04:09+02:00", tz) == dt.datetime(2026, 9, 30, 9, 4, 9, tzinfo=utc)
    assert nvr_system.device_instant("2026-09-30T12:04:09+03:00", tz) == dt.datetime(2026, 9, 30, 9, 4, 9, tzinfo=utc)
    # winter: tag and zone agree
    assert nvr_system.device_instant("2026-12-01T09:00:00+02:00", tz) == dt.datetime(2026, 12, 1, 7, 0, 0, tzinfo=utc)
    # another zone is honoured; a naive value is the zone's wall clock; without a zone the old reading stays
    assert nvr_system.device_instant("2026-09-30T12:04:09+05:00", tz) == dt.datetime(2026, 9, 30, 7, 4, 9, tzinfo=utc)
    assert nvr_system.device_instant("2026-09-30T12:04:09", tz) == dt.datetime(2026, 9, 30, 9, 4, 9, tzinfo=utc)
    assert nvr_system.device_instant("2026-09-30T12:04:09+02:00") == dt.datetime(2026, 9, 30, 10, 4, 9, tzinfo=utc)
    assert nvr_system.device_instant(None, tz) is None and nvr_system.device_instant("garbage", tz) is None


def test_time_status_has_no_phantom_hour_of_drift_in_summer(monkeypatch):
    """The reported bug: a correct NVR clock (12:04 Israel, tag +02:00) showed +3599 s of drift."""
    tz = ZoneInfo("Asia/Jerusalem")
    xml = TIME.replace("2026-09-18T02:35:00+02:00", "2026-09-30T12:04:09+02:00")
    monkeypatch.setattr(nvr_system, "_get", lambda c, path: xml if path == nvr_system.TIME_PATH else "")
    now = dt.datetime(2026, 9, 30, 9, 4, 10, tzinfo=dt.timezone.utc)
    fixed = nvr_system.time_status(None, client=object(), now=now, tz=tz)
    assert fixed["drift_s"] == -1
    assert nvr_system.time_status(None, client=object(), now=now)["drift_s"] == 3599, "the literal reading, kept without a zone"


def test_time_document_survives_an_unreadable_or_offsetless_clock_value():
    tz = ZoneInfo("Asia/Jerusalem")
    at = dt.datetime(2026, 9, 30, 9, 4, 9, tzinfo=dt.timezone.utc)
    junk = TIME.replace("2026-09-18T02:35:00+02:00", "2026-09-30 12:04 junk")
    assert "<localTime>2026-09-30T09:04:09+00:00</localTime>" in nvr_system.time_document(junk, mode=None, at=at, tz=tz), "no 500, UTC digits"
    naive = TIME.replace("2026-09-18T02:35:00+02:00", "2026-09-30T12:04:09")
    assert "<localTime>2026-09-30T12:04:09</localTime>" in nvr_system.time_document(naive, mode=None, at=at, tz=tz), "an offsetless device gets the zone's wall clock, as the read assumes"


def test_a_clock_write_that_leaves_the_device_off_is_reported(monkeypatch):
    import pytest as _pytest

    from smplwise.errors import ApiError

    calls: list[str] = []
    monkeypatch.setattr(nvr_system, "_get", lambda c, path: TIME)
    monkeypatch.setattr(nvr_system, "apply_change", lambda *a, **k: calls.append(k["target"]) or {"status": "applied"})
    monkeypatch.setattr(nvr_system, "time_status", lambda *a, **k: {"drift_s": 3600})
    audited: list[str] = []
    monkeypatch.setattr(nvr_system, "audit", lambda conn, **k: audited.append(k["action"]))
    with _pytest.raises(ApiError) as e:
        nvr_system.sync_clock(None, None, None, client=object(), tz=ZoneInfo("Asia/Jerusalem"))
    assert e.value.code == "clock_verify_failed" and e.value.details["drift_s"] == 3600
    assert calls == ["clock", "time-mode"], "the mode is still put back"
    assert audited == ["nvr.clock.verify_failed"]
    monkeypatch.setattr(nvr_system, "time_status", lambda *a, **k: {"drift_s": 2})
    assert nvr_system.sync_clock(None, None, None, client=object(), tz=ZoneInfo("Asia/Jerusalem"))["status"] == "applied"
