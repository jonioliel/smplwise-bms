"""CAMERA-REBOOT-2407: reboot ONE camera through its NVR channel, against a fake NVR (no device is contacted).

The legacy add-on's request shape (GET /ISAPI/ContentMgmt/InputProxy/channels/{ch}/reboot), the sensitive permission
`nvr.camera.reboot` (installation + camera scope), the NVR-writes switch, the confirmation, the audit / change-log rows, the rate
limits, the one documented GET -> PUT method step, and Provision-ISR refused before any request."""
from __future__ import annotations

import dataclasses
import json
import sqlite3
from pathlib import Path

import httpx
from conftest import as_user, bind
from fastapi.testclient import TestClient

from smplwise.main import create_app
from smplwise.services import camera_reboot

OK = '<?xml version="1.0" encoding="UTF-8" ?><ResponseStatus><statusCode>1</statusCode><statusString>OK</statusString><subStatusCode>ok</subStatusCode></ResponseStatus>'
NOT_SUPPORT = '<?xml version="1.0" encoding="UTF-8" ?><ResponseStatus><statusCode>4</statusCode><statusString>Invalid Operation</statusString><subStatusCode>notSupport</subStatusCode></ResponseStatus>'


class FakeNvr:
    """Answers the camera reboot; `get_answer` / `put_answer` decide what the device says for each method."""

    def __init__(self, get_answer: tuple[int, str] = (200, OK), put_answer: tuple[int, str] = (200, OK)):
        self.get_answer, self.put_answer = get_answer, put_answer
        self.requests: list[tuple[str, str]] = []

    def handler(self, request: httpx.Request) -> httpx.Response:
        self.requests.append((request.method, request.url.path))
        if not request.url.path.endswith("/reboot"):
            return httpx.Response(404)
        status, text = self.get_answer if request.method == "GET" else self.put_answer if request.method == "PUT" else (405, "")
        return httpx.Response(status, text=text)

    def client(self, _settings=None) -> httpx.Client:
        return httpx.Client(transport=httpx.MockTransport(self.handler), base_url="http://nvr")


def _app(settings, monkeypatch, fake: FakeNvr):
    monkeypatch.setattr(camera_reboot, "_client", fake.client)
    return create_app(settings)


def _role(c: TestClient, settings, user: str, sensitive: list[str], scope: tuple[str, str] = ("installation", "*")) -> dict[str, str]:
    role = c.post("/api/v1/access/roles", json={"name": f"מצלמות {user}", "description": "", "permissions": ["map.read", "video.live"], "sensitive": sensitive}).json()
    bind(c, settings, user, role["id"], *scope)
    return as_user(user)


def _db(settings) -> sqlite3.Connection:
    conn = sqlite3.connect(settings.db_path)
    conn.row_factory = sqlite3.Row
    return conn


def _audit(settings, camera_id: str) -> list[sqlite3.Row]:
    with _db(settings) as db:
        rows = db.execute("SELECT decision, reason, details_json FROM audit_log WHERE action = 'nvr.write' AND resource_id = ? ORDER BY id", (camera_id,)).fetchall()
    return [r for r in rows if json.loads(r["details_json"] or "{}").get("kind") == "camera_reboot"]


def test_reboot_sends_the_legacy_request_records_and_audits(settings, monkeypatch):
    fake = FakeNvr()
    with TestClient(_app(settings, monkeypatch, fake)) as c:
        cam = c.post("/api/v1/cameras", json={"channel": 3, "alias": "חניה"}).json()
        st = c.get(f"/api/v1/cameras/{cam['id']}/reboot").json()
        assert st["can_reboot"] is True and st["reason"] is None and st["supported"] and st["writes_enabled"] and st["cooldown_s"] == 0
        r = c.post(f"/api/v1/cameras/{cam['id']}/reboot", json={"confirm": True})
        assert r.status_code == 201, r.text
        assert fake.requests == [("GET", "/ISAPI/ContentMgmt/InputProxy/channels/3/reboot")], "one request, the legacy shape, through the NVR"
        body = r.json()
        assert body["kind"] == "camera_reboot" and body["status"] == "applied" and body["camera_id"] == cam["id"]
        with _db(settings) as db:
            row = db.execute("SELECT * FROM nvr_changes WHERE id = ?", (body["id"],)).fetchone()
        assert row["camera_id"] == cam["id"] and row["permission"] == "nvr.camera.reboot" and row["before_xml"] is None and row["target"] == "camera-3"
        rows = _audit(settings, cam["id"])
        assert [x["decision"] for x in rows] == ["allowed"] and json.loads(rows[0]["details_json"])["method"] == "GET"
        # a reboot has no "before" document: it cannot be rolled back
        assert c.post(f"/api/v1/nvr/changes/{body['id']}/rollback").status_code in (403, 404, 409)
        st = c.get(f"/api/v1/cameras/{cam['id']}/reboot").json()
        assert st["can_reboot"] is False and st["reason"] == "cooldown" and 0 < st["cooldown_s"] <= camera_reboot.CAMERA_COOLDOWN_S


def test_rate_limit_per_camera_and_per_user(settings, monkeypatch):
    fake = FakeNvr()
    with TestClient(_app(settings, monkeypatch, fake)) as c:
        cams = [c.post("/api/v1/cameras", json={"channel": n, "alias": f"מצלמה {n}"}).json() for n in range(1, 6)]
        assert c.post(f"/api/v1/cameras/{cams[0]['id']}/reboot", json={"confirm": True}).status_code == 201
        again = c.post(f"/api/v1/cameras/{cams[0]['id']}/reboot", json={"confirm": True})
        assert again.status_code == 429 and again.json()["code"] == "rate_limited"
        assert len(fake.requests) == 1, "the refused press never reached the device"
        assert [x["decision"] for x in _audit(settings, cams[0]["id"])] == ["allowed", "denied"]
        for cam in cams[1:3]:
            assert c.post(f"/api/v1/cameras/{cam['id']}/reboot", json={"confirm": True}).status_code == 201
        fourth = c.post(f"/api/v1/cameras/{cams[3]['id']}/reboot", json={"confirm": True})
        assert fourth.status_code == 429 and fourth.json()["code"] == "rate_limited", "at most USER_PER_WINDOW reboots per user per window"
        assert len(fake.requests) == camera_reboot.USER_PER_WINDOW


def test_permission_and_camera_scope_refused(settings, monkeypatch):
    fake = FakeNvr()
    with TestClient(_app(settings, monkeypatch, fake)) as c:
        cam = c.post("/api/v1/cameras", json={"channel": 1, "alias": "לובי"}).json()
        other = c.post("/api/v1/cameras", json={"channel": 2, "alias": "מחסן"}).json()
        bind(c, settings, "sam", "site_admin", "installation", "*")  # a site administrator does not hold the sensitive permission
        hs = as_user("sam")
        assert c.post(f"/api/v1/cameras/{cam['id']}/reboot", json={"confirm": True}, headers=hs).status_code == 403
        st = c.get(f"/api/v1/cameras/{cam['id']}/reboot", headers=hs).json()
        assert st["can_reboot"] is False and st["reason"] == "no_permission" and st["permitted"] is False
        # the NVR reboot permission is not the camera reboot permission
        hn = _role(c, settings, "nadav", ["nvr.system.reboot"])
        assert c.post(f"/api/v1/cameras/{cam['id']}/reboot", json={"confirm": True}, headers=hn).status_code == 403
        # camera scope: the permission bound to one camera does not reach another
        hc = _role(c, settings, "carmel", ["nvr.camera.reboot"], ("camera", cam["id"]))
        assert c.post(f"/api/v1/cameras/{other['id']}/reboot", json={"confirm": True}, headers=hc).status_code == 403
        assert fake.requests == [], "no refused call reached the device"
        hd = _role(c, settings, "dana", ["nvr.camera.reboot"])
        assert c.get(f"/api/v1/cameras/{cam['id']}/reboot", headers=hd).json()["can_reboot"] is True
        assert c.post(f"/api/v1/cameras/{cam['id']}/reboot", json={"confirm": True}, headers=hd).status_code == 201
        assert c.post("/api/v1/cameras/no-such-camera/reboot", json={"confirm": True}, headers=hd).status_code in (403, 404)


def test_confirmation_required(settings, monkeypatch):
    fake = FakeNvr()
    with TestClient(_app(settings, monkeypatch, fake)) as c:
        cam = c.post("/api/v1/cameras", json={"channel": 1, "alias": "לובי"}).json()
        r = c.post(f"/api/v1/cameras/{cam['id']}/reboot", json={})
        assert r.status_code == 422 and r.json()["code"] == "confirm_required"
        assert c.post(f"/api/v1/cameras/{cam['id']}/reboot", json={"confirm": False}).status_code == 422
        assert c.post(f"/api/v1/cameras/{cam['id']}/reboot", json={"confirm": "yes"}).status_code == 422, "only the JSON literal true confirms"
        assert fake.requests == []
        assert "confirm_required" in [x["reason"] for x in _audit(settings, cam["id"])]


def test_writes_switch_off_refuses_before_any_request(settings, monkeypatch):
    fake = FakeNvr()
    with TestClient(_app(settings, monkeypatch, fake)) as c:
        cam = c.post("/api/v1/cameras", json={"channel": 1, "alias": "לובי"}).json()
        assert c.patch("/api/v1/recorders/nvr-1/writes", json={"enabled": False}).status_code == 200
        st = c.get(f"/api/v1/cameras/{cam['id']}/reboot").json()
        assert st["can_reboot"] is False and st["reason"] == "writes_off" and st["writes_enabled"] is False
        r = c.post(f"/api/v1/cameras/{cam['id']}/reboot", json={"confirm": True})
        assert r.status_code == 409 and r.json()["code"] == "nvr_writes_off"
        assert fake.requests == []
        assert [x["reason"] for x in _audit(settings, cam["id"])] == ["nvr_writes_off"]
        assert c.patch("/api/v1/recorders/nvr-1/writes", json={"enabled": True, "confirm": True}).status_code == 200
        assert c.post(f"/api/v1/cameras/{cam['id']}/reboot", json={"confirm": True}).status_code == 201


def test_put_only_when_the_get_was_not_executed(settings, monkeypatch):
    fake = FakeNvr(get_answer=(403, NOT_SUPPORT))
    with TestClient(_app(settings, monkeypatch, fake)) as c:
        cam = c.post("/api/v1/cameras", json={"channel": 4, "alias": "גג"}).json()
        r = c.post(f"/api/v1/cameras/{cam['id']}/reboot", json={"confirm": True})
        assert r.status_code == 201, r.text
        path = "/ISAPI/ContentMgmt/InputProxy/channels/4/reboot"
        assert fake.requests == [("GET", path), ("PUT", path)]
        assert json.loads(_audit(settings, cam["id"])[-1]["details_json"])["method"] == "PUT"


def test_device_refusal_is_recorded_and_never_retried(settings, monkeypatch):
    fake = FakeNvr(get_answer=(403, NOT_SUPPORT), put_answer=(403, NOT_SUPPORT))
    with TestClient(_app(settings, monkeypatch, fake)) as c:
        cam = c.post("/api/v1/cameras", json={"channel": 5, "alias": "כניסה"}).json()
        r = c.post(f"/api/v1/cameras/{cam['id']}/reboot", json={"confirm": True})
        assert r.status_code == 409 and r.json()["code"] == "nvr_not_supported"
        assert len(fake.requests) == 2, "GET, then the one PUT; nothing more"
        with _db(settings) as db:
            row = db.execute("SELECT status, error FROM nvr_changes WHERE kind = 'camera_reboot' AND camera_id = ?", (cam["id"],)).fetchone()
        assert row["status"] == "failed" and row["error"] == "nvr_not_supported"
        assert [x["decision"] for x in _audit(settings, cam["id"])] == ["denied"]
        # a failed command does not hold the camera cooldown
        assert c.get(f"/api/v1/cameras/{cam['id']}/reboot").json()["reason"] is None

    fake2 = FakeNvr(get_answer=(401, ""))
    monkeypatch.setattr(camera_reboot, "_client", fake2.client)
    with TestClient(create_app(settings)) as c:
        cam = c.post("/api/v1/cameras", json={"channel": 6, "alias": "גינה"}).json()
        r = c.post(f"/api/v1/cameras/{cam['id']}/reboot", json={"confirm": True})
        assert r.status_code == 503 and r.json()["code"] == "source_forbidden"
        assert fake2.requests == [("GET", "/ISAPI/ContentMgmt/InputProxy/channels/6/reboot")], "a credential refusal is not a method refusal: no PUT"


def test_provision_isr_is_not_supported(settings, monkeypatch):
    fake = FakeNvr()
    pisr = dataclasses.replace(settings, nvr_vendor="provision_isr", nvr_extra={"writes_enabled": True})
    assert camera_reboot.supported(pisr) is False and camera_reboot.supported(settings) is True
    with TestClient(_app(pisr, monkeypatch, fake)) as c:
        cam = c.post("/api/v1/cameras", json={"channel": 1, "alias": "לובי"}).json()
        st = c.get(f"/api/v1/cameras/{cam['id']}/reboot").json()
        assert st["supported"] is False and st["reason"] == "not_supported" and st["can_reboot"] is False
        r = c.post(f"/api/v1/cameras/{cam['id']}/reboot", json={"confirm": True})
        assert r.status_code == 409 and r.json()["code"] == "camera_reboot_not_supported"
        assert fake.requests == []


def test_permission_is_registered_as_sensitive():
    from smplwise.routers import access, nvr_write, recorders

    roles = json.loads((Path(camera_reboot.__file__).parents[1] / "roles.json").read_text(encoding="utf-8"))
    assert "nvr.camera.reboot" in roles["sensitive_permissions_not_implied"]
    assert [r["id"] for r in roles["roles"] if "nvr.camera.reboot" in r["permissions"]] == ["system_admin"], "built-in: the system administrator only"
    assert "nvr.camera.reboot" in nvr_write.NVR_PERMISSIONS and "nvr.camera.reboot" in recorders.READ_PERMISSIONS
    labels = getattr(access, "PERMISSION_LABELS", None) or next(v for k, v in vars(access).items() if isinstance(v, dict) and "nvr.system.reboot" in v)
    assert labels["nvr.camera.reboot"]
