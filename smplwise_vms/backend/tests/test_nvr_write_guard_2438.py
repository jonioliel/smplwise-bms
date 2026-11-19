"""CR-NVR-GUARD-2438 (review 03 F06, owner decision O2 = b): the per-recorder switch "allow settings changes on the recorder"
covers every settings change (notifications, motion, clock, NTP, OSD, schedules, smart rules, privacy masks, undo) and not the
operational actions (manual recording, output pulse, disk test). One table (services/nvr_write_guard.KINDS), one guard.

Fake NVR only (httpx MockTransport); nothing reaches a device."""
from __future__ import annotations

import re
from pathlib import Path

import httpx
import pytest
from fastapi.testclient import TestClient

from smplwise.errors import ApiError
from smplwise.main import create_app
from smplwise.services import camera_reboot, nvr_privacy, nvr_system, nvr_write, nvr_write_guard
from test_nvr_system import FakeNvr as SystemFake
from test_nvr_write import MOTION, TRIGGER

SRC = Path(__file__).resolve().parents[1] / "smplwise"
WEEK = [[] for _ in range(7)]


class Fake(SystemFake):
    """The system fake plus the camera documents; every request is counted (a refused write must send nothing, not even a GET)."""

    def __init__(self):
        super().__init__()
        self.docs["/ISAPI/Event/triggers/VMD-1"] = TRIGGER.format(t="VMD", ch=1, center="")
        self.docs["/ISAPI/System/Video/inputs/channels/1/motionDetection"] = MOTION
        self.requests: list[tuple[str, str]] = []
        inner = self.handler

        def handler(request: httpx.Request) -> httpx.Response:
            self.requests.append((request.method, request.url.path))
            if request.method == "PUT" and request.url.path.startswith("/ISAPI/ContentMgmt/record/control/manual/"):
                return httpx.Response(200, text='<ResponseStatus><statusCode>1</statusCode><subStatusCode>ok</subStatusCode></ResponseStatus>')
            return inner(request)

        self.handler = handler  # type: ignore[method-assign]


@pytest.fixture()
def fake(monkeypatch) -> Fake:
    f = Fake()
    for mod in (nvr_write, nvr_system, nvr_privacy, camera_reboot):
        monkeypatch.setattr(mod, "_client", f.client)
    return f


def _switch(c: TestClient, on: bool) -> None:
    body = {"enabled": True, "confirm": True} if on else {"enabled": False}
    r = c.patch("/api/v1/recorders/nvr-1/writes", json=body)
    assert r.status_code == 200, r.text


def _camera(c: TestClient, app) -> dict:
    cam = c.post("/api/v1/cameras", json={"channel": 1, "alias": "לובי"}).json()
    with app.state.db.connection() as conn:
        conn.execute("UPDATE cameras SET main_track = 101 WHERE id = ?", (cam["id"],))
    return cam


# ---------------------------------------------------------------- the table

def test_the_table_is_the_owner_decision():
    settings = {k for k, v in nvr_write_guard.KINDS.items() if v == nvr_write_guard.SETTINGS}
    operational = {k for k, v in nvr_write_guard.KINDS.items() if v == nvr_write_guard.OPERATIONAL}
    assert settings == {"notify_center", "detection", "time", "osd", "schedule", "record_schedule", "smart", "privacy_mask",
                        "stream_encoding", "reboot", "camera_reboot"}
    assert operational == {"manual_record", "alarm_output", "storage_test"}
    assert nvr_write_guard.covered("something_new"), "an unknown kind is a settings change (fail closed)"


def test_every_recorded_kind_is_in_the_table():
    """Grep-driven: every `kind="..."` an NVR writer records is a row of the table, so a new writer cannot slip past it."""
    files = [SRC / "services" / n for n in ("nvr_write.py", "nvr_system.py", "nvr_privacy.py", "camera_reboot.py", "nvr_settings.py")] + [SRC / "routers" / "nvr_write.py"]
    kinds: set[str] = set()
    for f in files:
        kinds |= set(re.findall(r'\bkind="([a-z_]+)"', f.read_text(encoding="utf-8")))
    kinds |= {nvr_privacy.KIND, camera_reboot.KIND, nvr_write.STREAM_KIND}
    assert kinds and kinds <= set(nvr_write_guard.KINDS), kinds - set(nvr_write_guard.KINDS)


def test_guard_unit(settings, fake):
    app = create_app(settings)
    with TestClient(app) as c:
        _switch(c, False)
        with app.state.db.connection() as conn:
            for kind in ("notify_center", "time", "privacy_mask", "unknown_kind"):
                with pytest.raises(ApiError) as e:
                    nvr_write_guard.guard(settings, conn, None, kind)
                assert e.value.status == 409 and e.value.code == "nvr_writes_off" and e.value.details["recorder_id"] == "nvr-1"
            for kind in ("manual_record", "alarm_output", "storage_test"):
                nvr_write_guard.guard(settings, conn, None, kind)  # operational: never refused by the switch
            # the service choke point itself refuses, before its first GET
            with pytest.raises(ApiError) as e:
                nvr_write.apply_change(settings, conn, None, kind="osd", permission="nvr.config.osd", target="osd-1", path="/ISAPI/System/Video/inputs/channels/1/overlays",
                                       mutate=lambda x: x + " ")
            assert e.value.code == "nvr_writes_off"
            rows = conn.execute("SELECT COUNT(*) FROM audit_log WHERE reason = 'nvr_writes_off' AND decision = 'denied'").fetchone()[0]
            assert rows == 5
        assert fake.requests == []
        _switch(c, True)
        with app.state.db.connection() as conn:
            nvr_write_guard.guard(settings, conn, None, "notify_center")


def test_a_vendor_without_the_switch_is_not_refused_by_it(settings):
    from dataclasses import replace

    assert nvr_write_guard.writes_on(replace(settings, nvr_vendor="frigate")) is True
    assert nvr_write_guard.writes_on(replace(settings, nvr_vendor="provision_isr")) is True, "Provision-ISR keeps its own vendor_unsupported refusal first"
    assert nvr_write_guard.writes_on(replace(settings, nvr_vendor="")) is nvr_write_guard.writes_on(settings), "no vendor = Hikvision"


# ---------------------------------------------------------------- every settings route, switch off: 409, nothing sent

def _settings_writes(cam_id: str) -> list[tuple[str, str, dict]]:
    return [
        ("PUT", "/api/v1/nvr/notify", {"smart": False}),
        ("PUT", f"/api/v1/cameras/{cam_id}/motion", {"sensitivity": 40}),
        ("PUT", "/api/v1/nvr/time", {"sync_now": True}),
        ("PUT", "/api/v1/nvr/time", {"mode": "manual"}),
        ("PUT", "/api/v1/nvr/ntp", {"host": "ntp.example.org", "port": 123}),
        ("PUT", f"/api/v1/cameras/{cam_id}/osd", {"name_enabled": False}),
        ("POST", f"/api/v1/cameras/{cam_id}/osd/name", {"name": "לובי"}),
        ("PUT", f"/api/v1/cameras/{cam_id}/schedules/motion", {"days": WEEK}),
        ("PUT", f"/api/v1/cameras/{cam_id}/record-schedule", {"enabled": True}),
        ("PUT", f"/api/v1/cameras/{cam_id}/smart", {"line": {"enabled": False}}),
    ]


def test_every_settings_route_is_refused_while_the_switch_is_off(settings, fake):
    app = create_app(settings)
    with TestClient(app) as c:
        cam = _camera(c, app)
        _switch(c, False)
        fake.requests.clear()
        routes = _settings_writes(cam["id"])
        for method, url, body in routes:
            r = c.request(method, url, json=body)
            assert r.status_code == 409 and r.json()["code"] == "nvr_writes_off", (url, r.status_code, r.text)
            assert "בהגדרות החיבור" in r.json()["user_message"], "the message says where to turn it on"
        assert fake.requests == [], "nothing - not even a read - reached the recorder"
        with app.state.db.connection(mode="read") as conn:
            n = conn.execute("SELECT COUNT(*) FROM audit_log WHERE action = 'nvr.write' AND decision = 'denied' AND reason = 'nvr_writes_off'").fetchone()[0]
            assert n == len(routes), "one audit row per refused request"
            assert conn.execute("SELECT COUNT(*) FROM nvr_changes").fetchone()[0] == 0, "a refused request records no change"


def test_settings_routes_work_again_when_the_switch_is_on(settings, fake):
    app = create_app(settings)
    with TestClient(app) as c:
        cam = _camera(c, app)
        _switch(c, False)
        _switch(c, True)
        for method, url, body in (("PUT", "/api/v1/nvr/notify", {"smart": False}), ("PUT", f"/api/v1/cameras/{cam['id']}/osd", {"name_enabled": False}),
                                  ("PUT", "/api/v1/nvr/ntp", {"host": "ntp.example.org", "port": 123})):
            r = c.request(method, url, json=body)
            assert r.status_code in (200, 201) and r.json().get("code") != "nvr_writes_off", (url, r.text)


# ---------------------------------------------------------------- operational actions stay allowed

def test_operational_actions_ignore_the_switch(settings, fake):
    app = create_app(settings)
    with TestClient(app) as c:
        cam = _camera(c, app)
        _switch(c, False)
        r = c.post("/api/v1/nvr/outputs/1/pulse")
        assert r.status_code == 201, r.text
        r = c.post("/api/v1/nvr/storage/2/smart-test", json={"kind": "short"})
        assert r.status_code == 201, r.text
        r = c.post(f"/api/v1/cameras/{cam['id']}/record/start", json={"minutes": 5})
        assert r.status_code == 201, r.text
        r = c.post(f"/api/v1/cameras/{cam['id']}/record/stop")
        assert r.status_code == 200, r.text
        sent = [p for m, p in fake.requests if m == "PUT"]
        assert "/ISAPI/System/IO/outputs/1/trigger" in sent and any(p.endswith("/SMARTTest") for p in sent)
        assert any("/record/control/manual/start/" in p for p in sent) and any("/record/control/manual/stop/" in p for p in sent)
        st = c.get("/api/v1/nvr/system").json()
        assert st["writes_enabled"] is False and st["can"]["storage"] is True and st["can"]["alarm"] is True
        assert c.get(f"/api/v1/cameras/{cam['id']}/record").json()["can_write"] is True


# ---------------------------------------------------------------- undo of a change

def test_undo_needs_the_switch_of_the_changes_recorder(settings, fake):
    app = create_app(settings)
    with TestClient(app) as c:
        cam = _camera(c, app)
        rec = c.put(f"/api/v1/cameras/{cam['id']}/osd", json={"name_enabled": False}).json()
        assert rec["status"] == "applied", rec
        assert c.get("/api/v1/nvr/changes").json()["changes"][0]["writes_enabled"] is True
        _switch(c, False)
        assert c.get("/api/v1/nvr/changes").json()["changes"][0]["writes_enabled"] is False, "the change list says the undo is off"
        before = len(fake.requests)
        r = c.post(f"/api/v1/nvr/changes/{rec['id']}/rollback")
        assert r.status_code == 409 and r.json()["code"] == "nvr_writes_off"
        assert len(fake.requests) == before
        _switch(c, True)
        assert c.post(f"/api/v1/nvr/changes/{rec['id']}/rollback").status_code == 201


# ---------------------------------------------------------------- privacy masks (their own feature switch AND the recorder's)

def test_privacy_mask_writes_are_skipped_while_the_switch_is_off(settings, fake):
    app = create_app(settings)
    with TestClient(app) as c:
        cam = _camera(c, app)
        assert c.patch("/api/v1/settings", json={"nvr.privacy_mask_write": "true"}).status_code == 200
        _switch(c, False)
        fake.requests.clear()
        item = {"camera_id": cam["id"], "enabled": True, "regions": [{"points": [[0, 0], [100, 0], [100, 100], [0, 100]]}], "etag": "e"}
        p = c.post("/api/v1/nvr/privacy-masks/preview", json={"items": [item]})
        assert p.status_code == 200 and p.json()["items"][0]["status"] == "skipped" and p.json()["items"][0]["reason"] == "nvr_writes_off", p.text
        a = c.post("/api/v1/nvr/privacy-masks/apply", json={"items": [item], "confirm": True})
        assert a.status_code == 200 and a.json()["results"][0] == {"camera_id": cam["id"], "channel": 1, "status": "skipped", "reason": "nvr_writes_off",
                                                                   "message": nvr_write_guard.MESSAGE}, a.text
        assert fake.requests == []


# ---------------------------------------------------------------- the screens are told (can flags + writes_enabled)

def test_read_routes_say_the_switch_is_off(settings, fake, monkeypatch):
    from smplwise.routers import cameras as cameras_router

    monkeypatch.setattr(cameras_router, "ZONES", lambda _s, _ch: {"motion": None, "privacy_mask": None, "intrusion": None, "line_crossing": None, "unsupported": {}})
    app = create_app(settings)
    with TestClient(app) as c:
        cam = _camera(c, app)
        cid = cam["id"]
        assert c.get("/api/v1/nvr/notify").json()["can_write"] is True
        _switch(c, False)
        n = c.get("/api/v1/nvr/notify").json()
        assert n["can_write"] is False and n["writes_enabled"] is False
        st = c.get("/api/v1/nvr/system").json()
        assert st["can"]["time"] is False and st["can"]["osd"] is False and st["can"]["reboot"] is False
        o = c.get(f"/api/v1/cameras/{cid}/osd").json()
        assert o["can_write"] is False and o["writes_enabled"] is False
        s = c.get(f"/api/v1/cameras/{cid}/schedules").json()
        assert s["can"] == {"events": False, "schedule": False} and s["writes_enabled"] is False
        sm = c.get(f"/api/v1/cameras/{cid}/smart").json()
        assert sm["can_write"] is False and sm["writes_enabled"] is False
        z = c.get(f"/api/v1/cameras/{cid}/zones?refresh=true").json()
        assert z["can_edit_motion"] is False and z["writes_enabled"] is False
        _switch(c, True)
        assert c.get(f"/api/v1/cameras/{cid}/osd").json()["can_write"] is True
        assert c.get(f"/api/v1/cameras/{cid}/zones?refresh=true").json()["can_edit_motion"] is True
