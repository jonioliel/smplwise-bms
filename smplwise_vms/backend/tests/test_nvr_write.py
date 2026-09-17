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
        assert st["can_write"] is False, "a sensitive permission is never implied, not even for the system admin"
        # writing needs the sensitive permission through a custom role
        assert c.put("/api/v1/nvr/notify", json={"smart": True}).status_code == 403
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
        assert c.post(f"/api/v1/nvr/changes/{first['id']}/rollback").status_code == 403, "rollback needs the same permission"
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
