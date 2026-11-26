"""ADR019-L14-STRICT-F123-2520: ADR-019 D2 (L14) step 2 for families 1-3.

Families 1 (calendar, transit, notices, emergency, maintenance, temperature, insights, generator) and 2 (presence, mobile) have no
tolerant web-UI body (family 1 was already `forbid`, family 2's tolerant bodies are the phone app's, tolerant by contract). In family 3
(NVR, recorders, connection, camera, device layouts, wall) the NVR write / privacy-mask / mask-copy bodies and the camera create /
patch bodies flip to `extra="forbid"`: every screen that sends them builds the body from named keys. An unknown key answers 422 with
the ADR-019 D1 envelope (`details.fields` / `details.problems`, code `extra_forbidden`) and changes nothing. The phone-app and
browser-push bodies keep accepting an extra key. The tolerant-model ratchet (scripts/request_strict_ratchet.py) holds."""
from __future__ import annotations

import importlib.util
import json
from pathlib import Path

import pytest
from pydantic import BaseModel, ValidationError

from smplwise.routers import cameras, mask_copy, mobile_notifications, nvr_privacy, nvr_write, presence, push

REPO = Path(__file__).resolve().parents[3]

# every flipped model with a minimal valid body (the unknown key is added by the test)
FLIPPED: list[tuple[type[BaseModel], dict]] = [
    (nvr_write.NotifyIn, {}),
    (nvr_write.MotionIn, {}),
    (nvr_write.RecordIn, {}),
    (nvr_write.TimeIn, {}),
    (nvr_write.NtpIn, {"host": "ntp.example.org"}),
    (nvr_write.SmartIn, {}),
    (nvr_write.RebootIn, {"confirm": "RESTART"}),
    (nvr_write.OsdIn, {}),
    (nvr_write.NameIn, {}),
    (nvr_write.WeekIn, {"days": [[] for _ in range(7)]}),
    (nvr_write.RecordScheduleIn, {}),
    (nvr_write.SmartRulesIn, {}),
    (nvr_privacy.RegionIn, {"points": [[0, 0]]}),
    (nvr_privacy.MaskItemIn, {"camera_id": "c1", "enabled": False}),
    (nvr_privacy.PreviewIn, {"items": [{"camera_id": "c1", "enabled": False}]}),
    (nvr_privacy.ApplyIn, {"items": [{"camera_id": "c1", "enabled": False}], "confirm": True}),
    (mask_copy.CopyPlanIn, {"source_camera_id": "c1", "target_camera_ids": ["c2"]}),
    (cameras.CameraIn, {"channel": 1, "alias": "כניסה"}),
    (cameras.CameraPatch, {}),
]


@pytest.mark.parametrize(("model", "body"), FLIPPED, ids=[m.__name__ for m, _ in FLIPPED])
def test_flipped_model_refuses_an_unknown_key(model: type[BaseModel], body: dict) -> None:
    model.model_validate(body)  # the minimal body is valid
    with pytest.raises(ValidationError) as exc:
        model.model_validate({**body, "nickname": "x"})
    assert [(e["type"], e["loc"]) for e in exc.value.errors()] == [("extra_forbidden", ("nickname",))]


def test_nested_mask_region_refuses_an_unknown_key() -> None:
    with pytest.raises(ValidationError) as exc:
        nvr_privacy.PreviewIn.model_validate({"items": [{"camera_id": "c1", "enabled": True, "regions": [{"points": [[0, 0]], "id": "r1"}]}]})
    assert [(e["type"], e["loc"]) for e in exc.value.errors()] == [("extra_forbidden", ("items", 0, "regions", 0, "id"))]


@pytest.mark.parametrize("model", [presence.RegisterIn, presence.EventsIn, mobile_notifications.PushRegisterIn, push.SubscriptionIn])
def test_phone_app_and_browser_push_bodies_stay_tolerant(model: type[BaseModel]) -> None:
    """ADR-019 D2: released separately (phone apps, contract v2.x) or browser-owned (PushSubscription.toJSON()) - never forbid."""
    assert model.model_config.get("extra") == "ignore"


def test_camera_patch_unknown_key_answers_the_d1_envelope_and_changes_nothing(client) -> None:
    cam = client.post("/api/v1/cameras", json={"channel": 1, "alias": "כניסה"}).json()
    row = lambda: next(c for c in client.get("/api/v1/cameras").json()["cameras"] if c["id"] == cam["id"])  # noqa: E731
    before = row()
    r = client.patch(f"/api/v1/cameras/{cam['id']}", json={"alias": "לובי", "nickname": "x"})
    assert r.status_code == 422
    body = r.json()
    assert body["code"] == "validation" and body["user_message"]
    assert body["details"]["fields"] == ["nickname"]
    assert body["details"]["problems"][0]["field"] == "nickname" and body["details"]["problems"][0]["code"] == "extra_forbidden"
    assert row()["alias"] == before["alias"] == "כניסה", "a refused body changes nothing"
    # the same body without the unknown key is still accepted (the screen's body)
    assert client.patch(f"/api/v1/cameras/{cam['id']}", json={"alias": "לובי"}).status_code == 200


def test_camera_create_unknown_key_is_refused(client) -> None:
    r = client.post("/api/v1/cameras", json={"channel": 2, "alias": "לובי", "recorder": "nvr-1"})
    assert r.status_code == 422 and r.json()["details"]["fields"] == ["recorder"]
    assert all(c["channel"] != 2 for c in client.get("/api/v1/cameras").json()["cameras"])


def _ratchet():
    spec = importlib.util.spec_from_file_location("request_strict_ratchet", REPO / "scripts" / "request_strict_ratchet.py")
    m = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(m)
    return m


def test_ratchet_flags_growth_only() -> None:
    m = _ratchet()
    base = {"web_ui_bodies": {"nvr": 0, "doors": 3}, "nested_only": {"zones": 2}}
    assert m.problems({"web_ui_bodies": {"nvr": 0, "doors": 2}, "nested_only": {"zones": 2}}, base) == []
    assert m.problems({"web_ui_bodies": {"nvr": 1}, "nested_only": {"plans": 1}}, base) == [
        "web_ui_bodies/nvr: 1 tolerant models (baseline 0)", "nested_only/plans: 1 tolerant models (baseline 0)"]


def test_ratchet_holds_on_the_real_code_and_families_1_to_3_have_no_tolerant_web_ui_body() -> None:
    m = _ratchet()
    now = m.counts()
    base = json.loads((REPO / "scripts" / "request_strict_ratchet.json").read_text(encoding="utf-8"))
    assert m.problems(now, base) == []
    done = {"calendar", "transit", "notices", "emergency", "maintenance", "temperature", "insights", "generator", "presence", "mobile",
            "nvr", "recorder", "recorders", "connection", "camera", "cameras", "device", "wall", "mask"}
    assert {f for kind in ("web_ui_bodies", "nested_only") for f in now[kind]} & done == set()
