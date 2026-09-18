"""0.1.72: arming schedules (B5), the recording schedule (C1) and smart rules (B4) against the fake NVR."""
from __future__ import annotations

import httpx
from conftest import as_user, bind
from fastapi.testclient import TestClient

from smplwise.main import create_app
from smplwise.services import nvr, nvr_schedule, nvr_write

NS = 'xmlns="http://www.hikvision.com/ver20/XMLSchema"'
OK = '<?xml version="1.0" encoding="UTF-8" ?><ResponseStatus><statusCode>1</statusCode><statusString>OK</statusString><subStatusCode>ok</subStatusCode></ResponseStatus>'


def _blocks(days):
    return "".join(f"<TimeBlock><dayOfWeek>{d}</dayOfWeek><TimeRange><beginTime>00:00:00</beginTime><endTime>24:00:00</endTime></TimeRange></TimeBlock>" for d in days)


SCHED = (f'<?xml version="1.0" encoding="UTF-8" ?><Schedule xmlns:hik="http://www.hikvision.com/ver20/XMLSchema"><id>VMD_video1</id><eventType>VMD</eventType><videoInputChannelID>1</videoInputChannelID>'
         f'<TimeBlockList size="7">{_blocks(range(1, 8))}</TimeBlockList><HolidayBlockList><TimeBlock><TimeRange><beginTime>00:00:00</beginTime><endTime>24:00:00</endTime></TimeRange></TimeBlock></HolidayBlockList></Schedule>')


def _action(n, d0, t0, d1, t1, mode):
    return (f"<ScheduleAction><id>{n}</id><ScheduleActionStartTime><DayOfWeek>{d0}</DayOfWeek><TimeOfDay>{t0}</TimeOfDay></ScheduleActionStartTime><ScheduleActionEndTime><DayOfWeek>{d1}</DayOfWeek><TimeOfDay>{t1}</TimeOfDay></ScheduleActionEndTime>"
            f"<ScheduleDSTEnable>true</ScheduleDSTEnable><Description>nothing</Description><Actions><Record>true</Record><Log>false</Log><SaveImg>false</SaveImg><ActionRecordingMode>{mode}</ActionRecordingMode></Actions></ScheduleAction>")


TRACK = (f'<?xml version="1.0" encoding="UTF-8" ?><Track version="1.0" {NS}><id>101</id><Channel>101</Channel><Enable>true</Enable><DefaultRecordingMode>CMR</DefaultRecordingMode>'
         f'<TrackSchedule><ScheduleBlockList><ScheduleBlock><ScheduleBlockGUID>{{0}}</ScheduleBlockGUID><ScheduleBlockType>www.hikvision.com/racm/schedule/ver10</ScheduleBlockType>'
         f'{_action(1, "Monday", "00:00:00", "Tuesday", "00:00:00", "MOTION")}{_action(2, "Tuesday", "08:00:00", "Tuesday", "18:00:00", "CMR")}</ScheduleBlock></ScheduleBlockList></TrackSchedule>'
         f'<CustomExtensionList><CustomExtension><CustomExtensionName>www.hikvision.com/RaCM/trackExt/ver10</CustomExtensionName><enableSchedule>true</enableSchedule><PreRecordTimeSeconds>5</PreRecordTimeSeconds><PostRecordTimeSeconds>60</PostRecordTimeSeconds>'
         f'<HolidaySchedule><ScheduleBlock><ScheduleBlockGUID>{{0}}</ScheduleBlockGUID>{_action(1, "Monday", "00:00:00", "Tuesday", "00:00:00", "CMR")}</ScheduleBlock></HolidaySchedule></CustomExtension></CustomExtensionList></Track>')
LINE = (f'<?xml version="1.0" encoding="UTF-8" ?><LineDetection version="1.0" {NS}><id>1</id><enabled>false</enabled><normalizedScreenSize><normalizedScreenWidth>1000</normalizedScreenWidth><normalizedScreenHeight>1000</normalizedScreenHeight></normalizedScreenSize>'
        '<LineItemList size="2">' + "".join(f'<LineItem><id>{i}</id><enabled>false</enabled><sensitivityLevel>50</sensitivityLevel><directionSensitivity>any</directionSensitivity><CoordinatesList><Coordinates><positionX>0</positionX><positionY>1000</positionY></Coordinates><Coordinates><positionX>0</positionX><positionY>1000</positionY></Coordinates></CoordinatesList><humanMisinfoFilterEnabled>false</humanMisinfoFilterEnabled><vehicleMisinfoFilterEnabled>false</vehicleMisinfoFilterEnabled></LineItem>' for i in (1, 2))
        + '</LineItemList><recogRuleType>vectorMode</recogRuleType><humanMisinfoFilterEnabled>false</humanMisinfoFilterEnabled><vehicleMisinfoFilterEnabled>false</vehicleMisinfoFilterEnabled></LineDetection>')
FIELD = (f'<?xml version="1.0" encoding="UTF-8" ?><FieldDetection version="1.0" {NS}><id>1</id><enabled>false</enabled><normalizedScreenSize><normalizedScreenWidth>1000</normalizedScreenWidth><normalizedScreenHeight>1000</normalizedScreenHeight></normalizedScreenSize>'
         '<FieldDetectionRegionList size="2">' + "".join(f'<FieldDetectionRegion><id>{i}</id><sensitivityLevel>50</sensitivityLevel><RegionCoordinatesList></RegionCoordinatesList><humanMisinfoFilterEnabled>false</humanMisinfoFilterEnabled><vehicleMisinfoFilterEnabled>false</vehicleMisinfoFilterEnabled></FieldDetectionRegion>' for i in (1, 2))
         + '</FieldDetectionRegionList><humanMisinfoFilterEnabled>false</humanMisinfoFilterEnabled><vehicleMisinfoFilterEnabled>false</vehicleMisinfoFilterEnabled></FieldDetection>')


class FakeNvr:
    def __init__(self):
        self.docs = {"/ISAPI/Event/schedules/motionDetection/VMD_video1": SCHED, "/ISAPI/ContentMgmt/record/tracks/101": TRACK, "/ISAPI/Smart/LineDetection/1": LINE, "/ISAPI/Smart/FieldDetection/1": FIELD}

    def handler(self, request: httpx.Request) -> httpx.Response:
        path = request.url.path
        if request.method == "GET":
            return httpx.Response(200, text=self.docs[path]) if path in self.docs else httpx.Response(403, text="<ResponseStatus><statusCode>4</statusCode><subStatusCode>notSupport</subStatusCode></ResponseStatus>")
        if request.method == "PUT" and path in self.docs:
            self.docs[path] = request.content.decode("utf-8")
            return httpx.Response(200, text=OK)
        return httpx.Response(403, text="<ResponseStatus><statusCode>4</statusCode><subStatusCode>notSupport</subStatusCode></ResponseStatus>")

    def client(self, _settings=None) -> httpx.Client:
        return httpx.Client(transport=httpx.MockTransport(self.handler), base_url="http://nvr")


def test_week_round_trips():
    week = nvr_schedule.week_from_schedule(SCHED)
    assert len(week) == 7 and all(d == [{"begin": "00:00:00", "end": "24:00:00"}] for d in week)
    nights = [[{"begin": "20:00:00", "end": "24:00:00"}] if i < 5 else [] for i in range(7)]
    doc = nvr_schedule.schedule_document(SCHED, nights)
    assert nvr_schedule.week_from_schedule(doc) == nights and "<HolidayBlockList>" in doc and 'size="5"' in doc
    rec = nvr_schedule.record_from_track(TRACK)
    assert rec["enabled"] is True and rec["default_mode"] == "CMR" and rec["days"][0] == [{"begin": "00:00:00", "end": "24:00:00", "mode": "MOTION"}]
    assert rec["days"][1] == [{"begin": "08:00:00", "end": "18:00:00", "mode": "CMR"}] and rec["days"][6] == []
    days = [[{"begin": "00:00:00", "end": "24:00:00", "mode": "CMR"}] for _ in range(7)]
    doc = nvr_schedule.track_document(TRACK, days, schedule_enabled=False)
    rec2 = nvr_schedule.record_from_track(doc)
    assert all(d == [{"begin": "00:00:00", "end": "24:00:00", "mode": "CMR"}] for d in rec2["days"]) and rec2["schedule_enabled"] is False
    assert doc.count("<ScheduleAction>") == 7 + 1, "the holiday block is untouched"
    assert "<DayOfWeek>Monday</DayOfWeek><TimeOfDay>00:00:00</TimeOfDay></ScheduleActionEndTime>" in doc, "Sunday to 24:00 ends on Monday 00:00"


def test_smart_documents():
    view = nvr_schedule.smart_from_docs(LINE, FIELD)
    assert view["line"]["enabled"] is False and len(view["line"]["lines"]) == 2 and len(view["field"]["regions"]) == 2 and view["field"]["regions"][0]["points"] == []
    doc = nvr_schedule.line_document(LINE, {"enabled": True, "lines": [{"id": 1, "enabled": True, "sensitivity": 70, "direction": "left-right", "points": [[100, 900], [900, 100]], "human": True}]})
    v = nvr_schedule.smart_from_docs(doc, None)["line"]
    assert v["enabled"] is True and v["lines"][0] == {"id": 1, "enabled": True, "sensitivity": 70, "direction": "left-right", "points": [[100, 900], [900, 100]], "human": True, "vehicle": False}
    assert v["lines"][1]["enabled"] is False, "the other line stays"
    doc = nvr_schedule.field_document(FIELD, {"enabled": True, "regions": [{"id": 2, "sensitivity": 60, "points": [[0, 0], [1000, 0], [1000, 1000], [0, 1000]], "vehicle": True}]})
    f = nvr_schedule.smart_from_docs(None, doc)["field"]
    assert f["enabled"] is True and f["regions"][1]["points"] == [[0, 0], [1000, 0], [1000, 1000], [0, 1000]] and f["regions"][1]["vehicle"] is True and f["regions"][0]["points"] == []


def test_schedule_and_smart_endpoints(settings, monkeypatch):
    fake = FakeNvr()
    monkeypatch.setattr(nvr_write, "_client", fake.client)
    monkeypatch.setattr(nvr, "_client", fake.client)  # the zones view reads through the discovery client
    app = create_app(settings)
    with TestClient(app) as c:
        cam = c.post("/api/v1/cameras", json={"channel": 1, "alias": "לובי"}).json()
        s = c.get(f"/api/v1/cameras/{cam['id']}/schedules").json()
        assert s["track_id"] == 101 and len(s["arming"]["motion"]) == 7 and "line" in s["unsupported"] and s["record"]["days"][1][0]["mode"] == "CMR"
        assert s["can"] == {"events": False, "schedule": False}
        assert c.put(f"/api/v1/cameras/{cam['id']}/schedules/motion", json={"days": [[] for _ in range(7)]}).status_code == 403
        role = c.post("/api/v1/access/roles", json={"name": "לוחות", "description": "", "permissions": ["map.read"], "sensitive": ["nvr.config.events", "nvr.config.schedule", "nvr.config.smart"]}).json()
        bind(c, settings, "dan", role["id"], "installation", "*")
        h = as_user("dan")
        nights = [[{"begin": "20:00:00", "end": "24:00:00"}] if i < 5 else [] for i in range(7)]
        r = c.put(f"/api/v1/cameras/{cam['id']}/schedules/motion", json={"days": nights}, headers=h)
        assert r.status_code == 200 and r.json()["status"] == "applied", r.text
        assert c.get(f"/api/v1/cameras/{cam['id']}/schedules", headers=h).json()["arming"]["motion"] == nights
        assert c.put(f"/api/v1/cameras/{cam['id']}/schedules/motion", json={"days": [[{"begin": "10:00:00", "end": "09:00:00"}]] + [[] for _ in range(6)]}, headers=h).status_code == 422
        assert c.put(f"/api/v1/cameras/{cam['id']}/schedules/line", json={"days": nights}, headers=h).status_code == 409, "not on this channel"
        # C1: the recording schedule, rolled back from the change log
        days = [[{"begin": "00:00:00", "end": "24:00:00", "mode": "CMR"}] for _ in range(7)]
        r = c.put(f"/api/v1/cameras/{cam['id']}/record-schedule", json={"days": days}, headers=h)
        assert r.status_code == 200 and r.json()["status"] == "applied", r.text
        assert c.get(f"/api/v1/cameras/{cam['id']}/schedules", headers=h).json()["record"]["days"][1] == [{"begin": "00:00:00", "end": "24:00:00", "mode": "CMR"}]
        assert c.post(f"/api/v1/nvr/changes/{r.json()['id']}/rollback", headers=h).status_code == 201
        assert c.get(f"/api/v1/cameras/{cam['id']}/schedules", headers=h).json()["record"]["days"][1][0]["begin"] == "08:00:00"
        assert c.put(f"/api/v1/cameras/{cam['id']}/record-schedule", json={"days": [[{"begin": "00:00:00", "end": "24:00:00", "mode": "SOMETIMES"}]] + [[] for _ in range(6)]}, headers=h).status_code == 422
        # B4: smart rules
        sm = c.get(f"/api/v1/cameras/{cam['id']}/smart", headers=h).json()
        assert sm["can_write"] is True and len(sm["line"]["lines"]) == 2
        r = c.put(f"/api/v1/cameras/{cam['id']}/smart", json={"line": {"enabled": True, "lines": [{"id": 1, "enabled": True, "points": [[100, 900], [900, 100]], "direction": "any", "human": True}]},
                                                             "field": {"enabled": True, "regions": [{"id": 1, "points": [[100, 100], [900, 100], [900, 900], [100, 900]], "human": True}]}}, headers=h)
        assert r.status_code == 200 and r.json()["line"]["status"] == "applied" and r.json()["field"]["status"] == "applied", r.text
        sm = c.get(f"/api/v1/cameras/{cam['id']}/smart", headers=h).json()
        assert sm["line"]["enabled"] and sm["line"]["lines"][0]["points"] == [[100, 900], [900, 100]] and sm["field"]["regions"][0]["points"][2] == [900, 900]
        z = c.get(f"/api/v1/cameras/{cam['id']}/zones").json()  # the admin reads the zones view (video permissions)
        assert "line_crossing" in z, z
        assert z["line_crossing"]["enabled"] is True and len(z["intrusion"]["regions"]) == 1, "the zones view reflects the new rules"
        assert c.put(f"/api/v1/cameras/{cam['id']}/smart", json={"line": {"lines": [{"id": 1, "points": [[1, 2]]}]}}, headers=h).status_code == 422
