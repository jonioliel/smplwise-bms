"""NVR writes (0.1.64): the document helper for Notify Surveillance Center, the change log with rollback, the
sensitive permission gate, and the notify endpoints against a fake NVR (httpx MockTransport)."""
from __future__ import annotations

import httpx
from conftest import as_user, bind
from fastapi.testclient import TestClient

from smplwise.main import create_app
from smplwise.services import nvr_write

TRIGGER = ('<?xml version="1.0" encoding="UTF-8" ?><EventTrigger version="2.0" xmlns="http://www.isapi.org/ver20/XMLSchema"><id>{t}-{ch}</id><eventType>{t}</eventType>'
           '<dynVideoInputChannelID>{ch}</dynVideoInputChannelID><EventTriggerNotificationList version="2.0" xmlns="http://www.isapi.org/ver20/XMLSchema">'
           '<EventTriggerNotification><id>record-{ch}</id><notificationMethod>record</notificationMethod><dynVideoInputID>{ch}</dynVideoInputID></EventTriggerNotification>'
           '{center}</EventTriggerNotificationList></EventTrigger>')
OK = '<?xml version="1.0" encoding="UTF-8" ?><ResponseStatus><requestURL>/x</requestURL><statusCode>1</statusCode><statusString>OK</statusString><subStatusCode>ok</subStatusCode></ResponseStatus>'
NOT_SUPPORTED = '<?xml version="1.0" encoding="UTF-8" ?><ResponseStatus><statusCode>4</statusCode><statusString>Invalid Operation</statusString><subStatusCode>notSupport</subStatusCode></ResponseStatus>'


def test_with_center_is_idempotent_and_reversible():
    base = TRIGGER.format(t="VMD", ch=1, center="")
    assert not nvr_write.has_center(base)
    on = nvr_write.with_center(base, True)
    assert nvr_write.has_center(on) and on.count("<notificationMethod>record</notificationMethod>") == 1
    assert nvr_write.with_center(on, True) == on, "already on: untouched"
    assert nvr_write.with_center(on, False) == base, "removing gives the original back"
    empty = '<EventTrigger><id>VMD-2</id><EventTriggerNotificationList version="2.0"/></EventTrigger>'
    assert nvr_write.has_center(nvr_write.with_center(empty, True)) and "</EventTriggerNotificationList>" in nvr_write.with_center(empty, True)


class FakeNvr:
    """An NVR that keeps documents per path; unknown trigger paths answer 403 notSupport like the real one."""

    def __init__(self):
        self.docs = {f"/ISAPI/Event/triggers/VMD-{ch}": TRIGGER.format(t="VMD", ch=ch, center="") for ch in (1, 2)}
        self.docs["/ISAPI/Event/triggers/linedetection-1"] = TRIGGER.format(t="linedetection", ch=1, center="")
        self.docs["/ISAPI/Event/triggers/VMD-2"] = TRIGGER.format(t="VMD", ch=2, center=nvr_write.CENTER_BLOCK)
        self.puts: list[tuple[str, str]] = []

    def handler(self, request: httpx.Request) -> httpx.Response:
        path = request.url.path
        if request.method == "GET":
            return httpx.Response(200, text=self.docs[path]) if path in self.docs else httpx.Response(403, text=NOT_SUPPORTED)
        if request.method == "PUT":
            if path.startswith("/ISAPI/ContentMgmt/record/control/manual/"):
                self.puts.append((path, ""))
                return httpx.Response(200, text=OK)
            if path not in self.docs:
                return httpx.Response(403, text=NOT_SUPPORTED)
            self.docs[path] = request.content.decode("utf-8")
            self.puts.append((path, self.docs[path]))
            return httpx.Response(200, text=OK)
        return httpx.Response(405)

    def client(self, _settings=None) -> httpx.Client:
        return httpx.Client(transport=httpx.MockTransport(self.handler), base_url="http://nvr")


def test_notify_endpoints_change_log_and_rollback(settings, monkeypatch):
    fake = FakeNvr()
    monkeypatch.setattr(nvr_write, "_client", fake.client)
    app = create_app(settings)
    with TestClient(app) as c:
        cam1 = c.post("/api/v1/cameras", json={"channel": 1, "alias": "לובי"}).json()
        c.post("/api/v1/cameras", json={"channel": 2, "alias": "קבלה"})
        # reading the matrix: system.configure (the bootstrap admin has it); channel 1 has motion + line crossing, no center
        st = c.get("/api/v1/nvr/notify").json()
        by = {ch["channel"]: ch for ch in st["channels"]}
        assert by[1]["camera_id"] == cam1["id"] and by[1]["motion"] == {"supported": True, "center": False} and by[1]["smart_supported"] == 1 and by[1]["smart_center"] == 0
        assert by[2]["motion"]["center"] is True and by[2]["smart_supported"] == 0
        assert st["can_write"] is True, "since 0.1.74 the system administrator holds the NVR write permissions (owner decision)"
        # everyone else needs the sensitive permission through a custom role
        bind(c, settings, "sam", "site_admin", "installation", "*")  # a site administrator: NVR writes stay out of reach
        hs = as_user("sam")
        assert c.put("/api/v1/nvr/notify", json={"smart": True}, headers=hs).status_code == 403
        role = c.post("/api/v1/access/roles", json={"name": "מפעיל NVR", "description": "התראות", "permissions": ["map.read"], "sensitive": ["nvr.config.events"]}).json()
        assert "id" in role, role
        bind(c, settings, "dan", role["id"], "installation", "*")
        h = as_user("dan")
        r = c.put("/api/v1/nvr/notify", json={"smart": True}, headers=h)
        assert r.status_code == 200, r.text
        body = r.json()
        assert body["applied"] == 2 and body["unchanged"] == 1, body  # VMD-1 + linedetection-1 applied, VMD-2 already on
        assert body["skipped"] == 7, "smart types the channels do not have are skipped, not failed (2 channels x 4 smart types, one exists)"
        assert all(nvr_write.has_center(fake.docs[p]) for p in ("/ISAPI/Event/triggers/VMD-1", "/ISAPI/Event/triggers/linedetection-1"))
        assert len(fake.puts) == 2
        st2 = c.get("/api/v1/nvr/notify", headers=h).json()
        assert st2["can_write"] is True and all(ch["motion"]["center"] for ch in st2["channels"])
        # the change log and a rollback of the first change
        changes = c.get("/api/v1/nvr/changes", headers=h).json()["changes"]
        applied = [x for x in changes if x["status"] == "applied"]
        assert len(applied) == 2 and all(x["kind"] == "notify_center" and x["has_before"] and x["has_after"] for x in applied)
        first = next(x for x in applied if x["target"] == "VMD-1")
        detail = c.get(f"/api/v1/nvr/changes/{first['id']}", headers=h).json()
        assert not nvr_write.has_center(detail["before_xml"]) and nvr_write.has_center(detail["after_xml"])
        assert c.post(f"/api/v1/nvr/changes/{first['id']}/rollback", headers=hs).status_code == 403, "rollback needs the same permission"
        rb = c.post(f"/api/v1/nvr/changes/{first['id']}/rollback", headers=h)
        assert rb.status_code == 201 and rb.json()["rollback_of"] == first["id"]
        assert not nvr_write.has_center(fake.docs["/ISAPI/Event/triggers/VMD-1"])
        assert c.get(f"/api/v1/nvr/changes/{first['id']}", headers=h).json()["status"] == "rolled_back"
        # audit rows for the writes
        with app.state.db.connection(mode="read") as conn:
            actions = [r["action"] for r in conn.execute("SELECT action FROM audit_log WHERE action LIKE 'nvr.%'").fetchall()]
        assert "nvr.write" in actions and "nvr.rollback" in actions
        # unknown channel
        assert c.put("/api/v1/nvr/notify", json={"channels": [9]}, headers=h).status_code == 422


MOTION = ('<?xml version="1.0" encoding="UTF-8" ?><MotionDetection version="2.0" xmlns="http://www.isapi.org/ver20/XMLSchema"><enabled>true</enabled>'
          '<enableHighlight>true</enableHighlight><samplingInterval>5</samplingInterval><regionType>grid</regionType><Grid><rowGranularity>2</rowGranularity>'
          '<columnGranularity>10</columnGranularity></Grid><MotionDetectionLayout version="2.0"><sensitivityLevel>60</sensitivityLevel><layout><gridMap>ffc0ffc0</gridMap></layout>'
          '<targetType>human,vehicle</targetType></MotionDetectionLayout></MotionDetection>')


def test_motion_document_and_endpoint(settings, monkeypatch):
    from smplwise.services.nvr import _hex_bits

    # helper: the grid round-trips through the NVR's hex packing, other settings stay untouched
    cells = [[True] * 10, [False] * 10]
    doc = nvr_write.motion_document(MOTION, cells=cells, sensitivity=35, enabled=False)
    assert "<gridMap>ffc00000</gridMap>" in doc and "<sensitivityLevel>35</sensitivityLevel>" in doc and doc.count("<enabled>false</enabled>") == 1
    assert "<enableHighlight>true</enableHighlight>" in doc and "<targetType>human,vehicle</targetType>" in doc
    assert _hex_bits("ffc00000", 2, 10) == cells
    try:
        nvr_write.motion_document(MOTION, cells=[[True] * 9, [False] * 9], sensitivity=None, enabled=None)
        raise AssertionError("a grid of the wrong size must be refused")
    except Exception as exc:  # noqa: BLE001
        assert getattr(exc, "code", "") == "validation"

    fake = FakeNvr()
    fake.docs["/ISAPI/System/Video/inputs/channels/1/motionDetection"] = MOTION
    monkeypatch.setattr(nvr_write, "_client", fake.client)
    app = create_app(settings)
    with TestClient(app) as c:
        cam = c.post("/api/v1/cameras", json={"channel": 1, "alias": "לובי"}).json()
        bind(c, settings, "sam", "site_admin", "installation", "*")  # a site administrator: NVR writes stay out of reach
        hs = as_user("sam")
        assert c.put(f"/api/v1/cameras/{cam['id']}/motion", json={"sensitivity": 40}, headers=hs).status_code == 403, "sensitive: not implied below the system administrator"
        role = c.post("/api/v1/access/roles", json={"name": "עורך זיהוי", "description": "", "permissions": ["map.read", "video.live"], "sensitive": ["nvr.config.detection"]}).json()
        bind(c, settings, "dan", role["id"], "installation", "*")
        h = as_user("dan")
        assert c.put(f"/api/v1/cameras/{cam['id']}/motion", json={}, headers=h).status_code == 422
        r = c.put(f"/api/v1/cameras/{cam['id']}/motion", json={"cells": cells, "sensitivity": 40}, headers=h)
        assert r.status_code == 200, r.text
        rec = r.json()
        assert rec["status"] == "applied" and rec["kind"] == "detection" and rec["target"] == "motion-1"
        assert "<gridMap>ffc00000</gridMap>" in fake.docs["/ISAPI/System/Video/inputs/channels/1/motionDetection"]
        rb = c.post(f"/api/v1/nvr/changes/{rec['id']}/rollback", headers=h)
        assert rb.status_code == 201 and "<gridMap>ffc0ffc0</gridMap>" in fake.docs["/ISAPI/System/Video/inputs/channels/1/motionDetection"]


def test_no_effect_and_sensitivity_snap(settings, monkeypatch):
    """A device that answers OK but keeps its document is reported as no_effect (409) and the change log says so;
    the sensitivity is snapped to the device's step before writing (the lab NVR accepts 0, 20, ... 100 only)."""
    fake = FakeNvr()
    fake.docs["/ISAPI/System/Video/inputs/channels/1/motionDetection"] = MOTION
    fake.docs["/ISAPI/System/Video/inputs/channels/1/motionDetection/capabilities"] = MOTION.replace("<sensitivityLevel>60</sensitivityLevel>", '<sensitivityLevel min="0" max="100" step="20">60</sensitivityLevel>')
    ignore = {"on": False}
    original = fake.handler

    def handler(request: httpx.Request) -> httpx.Response:
        if request.method == "PUT" and ignore["on"]:
            return httpx.Response(200, text=OK)  # OK, but the document stays as it was
        return original(request)

    fake.handler = handler
    monkeypatch.setattr(nvr_write, "_client", fake.client)
    from smplwise.routers import cameras as cameras_router

    monkeypatch.setattr(cameras_router, "ZONES", lambda _s, _ch: {"motion": None, "privacy_mask": None, "intrusion": None, "line_crossing": None, "unsupported": {}})
    nvr_write._MOTION_CAPS.clear()
    assert nvr_write.snap_sensitivity(65, {"min": 0, "max": 100, "step": 20}) == 60 and nvr_write.snap_sensitivity(71, {"min": 0, "max": 100, "step": 20}) == 80
    assert nvr_write.snap_sensitivity(130, {"min": 0, "max": 100, "step": 20}) == 100
    app = create_app(settings)
    with TestClient(app) as c:
        cam = c.post("/api/v1/cameras", json={"channel": 1, "alias": "לובי"}).json()
        role = c.post("/api/v1/access/roles", json={"name": "עורך זיהוי", "description": "", "permissions": ["map.read", "video.live"], "sensitive": ["nvr.config.detection"]}).json()
        bind(c, settings, "dan", role["id"], "installation", "*")
        h = as_user("dan")
        z = c.get(f"/api/v1/cameras/{cam['id']}/zones", headers=h).json()
        assert z["can_edit_motion"] is True and z["sensitivity_caps"] == {"min": 0, "max": 100, "step": 20}
        r = c.put(f"/api/v1/cameras/{cam['id']}/motion", json={"sensitivity": 65}, headers=h)
        assert r.status_code == 200 and r.json()["sensitivity_written"] == 60 and r.json()["status"] == "unchanged", r.text
        r = c.put(f"/api/v1/cameras/{cam['id']}/motion", json={"sensitivity": 71}, headers=h)
        assert r.status_code == 200 and r.json()["sensitivity_written"] == 80 and "<sensitivityLevel>80</sensitivityLevel>" in fake.docs["/ISAPI/System/Video/inputs/channels/1/motionDetection"]
        ignore["on"] = True
        r = c.put(f"/api/v1/cameras/{cam['id']}/motion", json={"sensitivity": 40}, headers=h)
        assert r.status_code == 409 and r.json()["code"] == "nvr_no_effect", r.text
        changes = c.get("/api/v1/nvr/changes", headers=h).json()["changes"]
        assert changes[0]["status"] == "no_effect"


def test_manual_recording(settings, monkeypatch):
    """A1: start (NVR PUT start), status with the remaining time, stop (PUT stop), the janitor stops an expired one,
    and the sensitive permission gate."""
    import datetime as dt

    from smplwise.main import janitor_tick

    fake = FakeNvr()
    monkeypatch.setattr(nvr_write, "_client", fake.client)
    app = create_app(settings)
    with TestClient(app) as c:
        cam = c.post("/api/v1/cameras", json={"channel": 1, "alias": "לובי"}).json()
        with app.state.db.connection() as conn:
            conn.execute("UPDATE cameras SET main_track = 101 WHERE id = ?", (cam["id"],))
        bind(c, settings, "sam", "site_admin", "installation", "*")  # a site administrator: NVR writes stay out of reach
        hs = as_user("sam")
        assert c.post(f"/api/v1/cameras/{cam['id']}/record/start", json={"minutes": 5}, headers=hs).status_code == 403
        st = c.get(f"/api/v1/cameras/{cam['id']}/record").json()
        assert st["active"] is None and st["can_write"] is True and st["track_id"] == 101
        role = c.post("/api/v1/access/roles", json={"name": "מקליט", "description": "", "permissions": ["map.read", "video.live"], "sensitive": ["nvr.record.manual"]}).json()
        bind(c, settings, "dan", role["id"], "installation", "*")
        h = as_user("dan")
        r = c.post(f"/api/v1/cameras/{cam['id']}/record/start", json={"minutes": 5}, headers=h)
        assert r.status_code == 201, r.text
        assert fake.puts[-1][0] == "/ISAPI/ContentMgmt/record/control/manual/start/tracks/101"
        st = c.get(f"/api/v1/cameras/{cam['id']}/record", headers=h).json()
        assert st["active"]["track_id"] == 101 and 250 <= st["active"]["remaining_s"] <= 300 and st["can_write"] is True
        assert c.post(f"/api/v1/cameras/{cam['id']}/record/start", json={"minutes": 5}, headers=h).json()["code"] == "already_recording"
        r = c.post(f"/api/v1/cameras/{cam['id']}/record/stop", headers=h)
        assert r.status_code == 200 and r.json()["stop_reason"] == "user" and fake.puts[-1][0].endswith("/stop/tracks/101")
        assert c.post(f"/api/v1/cameras/{cam['id']}/record/stop", headers=h).json()["code"] == "not_recording"
        # expiry: a recording whose planned stop already passed is stopped by the janitor
        c.post(f"/api/v1/cameras/{cam['id']}/record/start", json={"minutes": 1}, headers=h)
        with app.state.db.connection() as conn:
            conn.execute("UPDATE manual_recordings SET stop_at = ? WHERE stopped_at IS NULL", ((dt.datetime.now(dt.timezone.utc) - dt.timedelta(seconds=5)).strftime("%Y-%m-%dT%H:%M:%SZ"),))
        n_puts = len(fake.puts)
        janitor_tick(app.state.db, settings)
        assert len(fake.puts) == n_puts + 1 and fake.puts[-1][0].endswith("/stop/tracks/101")
        assert c.get(f"/api/v1/cameras/{cam['id']}/record", headers=h).json()["active"] is None
        with app.state.db.connection(mode="read") as conn:
            reasons = [r["stop_reason"] for r in conn.execute("SELECT stop_reason FROM manual_recordings ORDER BY started_at").fetchall()]
            actions = [r["action"] for r in conn.execute("SELECT action FROM audit_log WHERE action LIKE 'nvr.record.%' ORDER BY id").fetchall()]
        assert reasons == ["user", "expired"] and actions.count("nvr.record.start") == 2 and actions.count("nvr.record.stop") == 2

