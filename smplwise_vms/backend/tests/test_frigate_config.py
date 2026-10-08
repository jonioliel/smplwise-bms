"""FRGS - Frigate zones and schema-driven camera settings (CR-029 section 13), end to end against the in-process fake Frigate
(`fixtures/fake_frigate.py`; never a real Frigate): the schema API, the read of one camera's zones and settings through the existing
`/api/config` read, and the guarded write (class `config` off by default, system.configure, per-action confirmation, the first supervised
write of each kind, read-back, change log, undo, stale undo), plus the allow-list and validation rules. No wall clock is involved."""
from __future__ import annotations

import sys
from pathlib import Path

import pytest

from smplwise.services.recorders import frigate_config as fcfg
from smplwise.services.recorders import frigate_http as fh

sys.path.insert(0, str(Path(__file__).resolve().parent))
sys.path.insert(0, str(Path(__file__).resolve().parent / "fixtures"))
from conftest import as_user, bind  # noqa: E402
from test_frigate_control import BASE, World, _clean, world  # noqa: E402,F401  (fixtures)

SQUARE = [[0.2, 0.2], [0.6, 0.2], [0.6, 0.7], [0.2, 0.7]]


def _cam(w: World, key: str = "cam_front") -> str:
    return w.cams()[key]


def _view(w: World, key: str = "cam_front", headers=None):
    return w.call("GET", f"{BASE}/cameras/{_cam(w, key)}/config", headers=headers or {})


def _zone(w: World, name: str, key: str = "cam_front", headers=None, **body):
    payload = {"points": SQUARE, "objects": ["person"], "confirm": True, "supervised": True, **body}
    return w.call("PUT", f"{BASE}/cameras/{_cam(w, key)}/config/zones/{name}", json=payload, headers=headers or {})


def _settings(w: World, section: str, values: dict, key: str = "cam_front", **body):
    payload = {"values": values, "confirm": True, "supervised": True, **body}
    return w.call("PUT", f"{BASE}/cameras/{_cam(w, key)}/config/settings/{section}", json=payload)


def _config_writes(w: World):
    return [x for x in w.fake.writes if x[1] == "/api/config/set"]


# ---------------------------------------------------------------------------------------------- schema and reads

def test_the_schema_is_served_and_compared_with_the_instance_schema_only_on_request(world):
    r = world.call("GET", f"{BASE}/config/schema")
    assert r.status_code == 200
    s = r.json()
    assert s["version"] == fcfg.SCHEMA_VERSION and s["frigate_check"] is None and s["persists"] is True
    assert [x["key"] for x in s["settings"]] == [x["key"] for x in fcfg.SETTINGS] and set(s["sections"]) == {"detect", "motion", "objects", "snapshots", "record", "review"}
    assert {f["key"] for f in s["zone"]["fields"]} == {"points", "objects", "inertia", "loitering_time"} and "person" in s["labels"]
    assert not any(h.endswith("/api/config/schema.json") for h in world.fake.hits), "the static schema needs no Frigate call"
    v = world.call("GET", f"{BASE}/config/schema?verify=true").json()
    assert v["frigate_check"] == {"checked": True, "missing": []}
    world.fake.schema_drop = {"motion.lightning_threshold", "zones.loitering_time"}
    assert world.call("GET", f"{BASE}/config/schema?verify=true").json()["frigate_check"] == {"checked": True, "missing": ["motion.lightning_threshold", "zones.*.loitering_time"]}
    world.fake.schema_served = False
    assert world.call("GET", f"{BASE}/config/schema?verify=true").json()["frigate_check"] == {"checked": False, "missing": []}
    assert world.fake.writes == []


def test_the_schema_check_is_a_control_read_never_a_plain_read():
    assert not fh.allowed("/api/config/schema.json") and fh.control_read_allowed("/api/config/schema.json")
    assert fh.write_allowed("config", "PUT", "/api/config/set")
    for klass, method, path in [("config", "POST", "/api/config/set"), ("config", "PUT", "/api/config/save"), ("config", "POST", "/api/restart"), ("analytics", "PUT", "/api/config/set"),
                                ("config", "PUT", "/api/config/set/../save"), ("config", "PUT", "/api/config/setx")]:
        assert not fh.write_allowed(klass, method, path), (klass, method, path)


def test_a_camera_view_carries_zones_relative_and_curated_settings_only(world):
    r = _view(world)
    assert r.status_code == 200, r.text
    v = r.json()
    assert v["frame"] == {"width": 1920, "height": 1080} and v["writable"] is False
    assert v["zones"] == [{"name": "porch", "points": None, "editable": False, "objects": [], "inertia": None, "loitering_time": None}], "a two-point line is shown, never edited"
    assert set(v["settings"]) == set(fcfg.SETTING) and v["settings"]["detect.fps"] == 5 and v["settings"]["objects.track"] == ["car", "person"]
    assert v["first_write_done"] == {"config_zone": False, "config_settings": False} and v["can_supervise"] is True
    assert "rtsp" not in r.text and "192.0.2" not in r.text and "ffmpeg" not in r.text, "only the curated fields leave the adapter"
    assert world.fake.non_get == ["POST /api/login"]


def test_a_zone_in_pixels_is_shown_relative_and_a_two_point_line_is_read_only(world):
    world.fake.cameras["cam_yard"]["zones"] = {"drive": {"coordinates": "256,144,1280,144,1280,720"}, "line": {"coordinates": "0.1,0.1,0.2,0.2"}}
    zones = {z["name"]: z for z in _view(world, "cam_yard").json()["zones"]}
    assert zones["drive"]["points"] == [[0.1, 0.1], [0.5, 0.1], [0.5, 0.5]] and zones["drive"]["editable"] is True
    assert zones["line"]["points"] is None and zones["line"]["editable"] is False


# ---------------------------------------------------------------------------------------------- gates

def test_the_config_class_is_off_by_default_and_needs_confirmation_and_supervision(world):
    pol = {c["class"]: c for c in world.call("GET", f"{BASE}/control/policy").json()["classes"]}
    assert pol["config"] == {"class": "config", "enabled": False, "per_action": True, "permission": "system.configure", "available": True, "confirm_actions": [], "persists": True}
    r = _zone(world, "gate")
    assert r.status_code == 409 and r.json()["code"] == "frigate_write_class_off"
    world.policy(config=True)
    assert _view(world).json()["writable"] is True
    r = _zone(world, "gate", confirm=False)
    assert r.status_code == 409 and r.json()["code"] == "confirmation_required"
    r = _zone(world, "gate", supervised=False)
    assert r.status_code == 409 and r.json()["code"] == "frigate_first_write_unsupervised"
    r = _settings(world, "motion", {"motion.threshold": 40}, supervised=False)
    assert r.status_code == 409 and r.json()["code"] == "frigate_first_write_unsupervised"
    assert world.fake.writes == [] and world.fake.non_get == ["POST /api/login"]


def test_only_a_system_administrator_may_write_and_an_operator_sees_nothing_writable(world):
    world.policy(config=True)
    bind(world.c, world.s, "tal", "site_admin", "installation", "*")
    h = as_user("tal")
    assert _zone(world, "gate", headers=h).status_code == 403
    bind(world.c, world.s, "lena", "operator", "installation", "*")
    assert _view(world, headers=as_user("lena")).status_code == 403, "the control screens' read gate"
    assert world.fake.writes == []


def test_validation_refuses_bad_zones_and_settings_before_any_write(world):
    world.policy(config=True)
    for name, body, code in [("Bad-Name", {}, "frigate_zone_name_invalid"), ("ok", {"points": [[0.1, 0.1], [0.2, 0.2], [0.1, 0.1]]}, "frigate_zone_points_invalid"),
                             ("ok", {"points": [[0.1, 0.1], [1.2, 0.2], [0.1, 0.5]]}, "frigate_zone_points_invalid"),
                             ("ok", {"points": [[0.1, 0.1], [0.2, 0.2], [0.3, 0.3]]}, "frigate_zone_points_invalid"),
                             ("ok", {"objects": ["Person!"]}, "frigate_config_value_invalid"), ("ok", {"inertia": 11}, "frigate_config_value_invalid"),
                             ("cam_front", {}, "frigate_zone_name_invalid")]:
        r = _zone(world, name, **body)
        assert r.status_code == 422 and r.json()["code"] == code, (name, body, r.text)
    for section, values, code in [("motion", {"motion.threshold": 0}, "frigate_config_value_invalid"), ("motion", {"detect.fps": 5}, "frigate_config_key_unknown"),
                                  ("ffmpeg", {"ffmpeg.inputs": []}, "frigate_config_section_unknown"), ("motion", {"motion.mask": "0,0"}, "frigate_config_key_unknown"),
                                  ("detect", {"detect.fps": 2.5}, "frigate_config_value_invalid"), ("objects", {"objects.track": ["person", 3]}, "frigate_config_value_invalid")]:
        r = _settings(world, section, values)
        assert r.status_code == 422 and r.json()["code"] == code, (section, values, r.text)
    assert world.fake.writes == []


# ---------------------------------------------------------------------------------------------- zones

def test_a_zone_is_created_read_back_logged_and_undone(world):
    world.policy(config=True)
    r = _zone(world, "driveway", objects=["car", "person"], inertia=4)
    assert r.status_code == 200, r.text
    out = r.json()
    assert out["changed"] is True and out["verified"] is True and out["zone"]["points"] == SQUARE
    assert _config_writes(world) == [("PUT", "/api/config/set", {"requires_restart": 0, "update_topic": "config/cameras/cam_front/zones", "config_data": {"cameras": {"cam_front": {"zones": {
        "driveway": {"coordinates": "0.2,0.2,0.6,0.2,0.6,0.7,0.2,0.7", "objects": ["car", "person"], "inertia": 4, "loitering_time": ""}}}}}})]
    assert world.fake.cameras["cam_front"]["zones"]["driveway"]["coordinates"] == "0.2,0.2,0.6,0.2,0.6,0.7,0.2,0.7"
    assert _view(world).json()["first_write_done"]["config_zone"] is True
    log = world.changes()[0]
    assert log["class"] == "config" and log["kind"] == "config_zone" and log["target"] == "driveway" and log["before"] is None and log["status"] == "applied" and log["reversible"] is True
    assert _zone(world, "driveway", objects=["car", "person"], inertia=4, supervised=False).json()["changed"] is False, "same zone: no write"
    no = world.call("POST", f"{BASE}/changes/{log['id']}/revert", json={})
    assert no.status_code == 409 and no.json()["code"] == "confirmation_required"
    undo = world.call("POST", f"{BASE}/changes/{log['id']}/revert", json={"confirm": True})
    assert undo.status_code == 200 and undo.json()["verified"] is True
    assert "driveway" not in world.fake.cameras["cam_front"]["zones"] and _config_writes(world)[-1][2]["config_data"]["cameras"]["cam_front"]["zones"] == {"driveway": ""}
    assert world.audit("frigate.control.config")[-1]["decision"] == "allowed"


def test_a_zone_edit_and_delete_are_undone_to_the_previous_shape(world):
    world.policy(config=True)
    assert _zone(world, "porch").json()["code"] == "frigate_zone_not_editable", "the fixture's two-point porch is read-only"
    world.fake.cameras["cam_front"]["zones"]["porch"] = {"coordinates": "0.1,0.1,0.5,0.1,0.5,0.5", "inertia": 5}
    assert _zone(world, "porch").json()["verified"] is True
    edit = world.changes()[0]
    assert edit["before"] == {"points": [[0.1, 0.1], [0.5, 0.1], [0.5, 0.5]], "objects": [], "inertia": 5, "loitering_time": 0} and edit["after"]["points"] == SQUARE
    undo_edit = world.call("POST", f"{BASE}/changes/{edit['id']}/revert", json={"confirm": True})
    assert undo_edit.status_code == 200 and undo_edit.json()["verified"] is True and world.fake.cameras["cam_front"]["zones"]["porch"]["coordinates"] == "0.1,0.1,0.5,0.1,0.5,0.5"
    gone = world.call("POST", f"{BASE}/cameras/{_cam(world)}/config/zones/porch/delete", json={"confirm": True})
    assert gone.status_code == 200 and gone.json()["deleted"] is True and gone.json()["verified"] is True
    assert "porch" not in world.fake.cameras["cam_front"]["zones"]
    undo = world.call("POST", f"{BASE}/changes/{world.changes()[0]['id']}/revert", json={"confirm": True})
    assert undo.status_code == 200 and undo.json()["verified"] is True
    assert world.fake.cameras["cam_front"]["zones"]["porch"]["coordinates"] == "0.1,0.1,0.5,0.1,0.5,0.5"
    missing = world.call("POST", f"{BASE}/cameras/{_cam(world)}/config/zones/nowhere/delete", json={"confirm": True})
    assert missing.status_code == 404


def test_an_undo_is_refused_when_frigate_moved_since(world):
    world.policy(config=True)
    _zone(world, "gate")
    cid = world.changes()[0]["id"]
    world.fake.cameras["cam_front"]["zones"]["gate"]["coordinates"] = "0.3,0.3,0.9,0.3,0.9,0.9"
    r = world.call("POST", f"{BASE}/changes/{cid}/revert", json={"confirm": True})
    assert r.status_code == 409 and r.json()["code"] == "frigate_change_stale"
    assert world.changes()[0]["id"] == cid and world.changes()[0]["status"] == "applied", "the claim is released"


def test_a_write_frigate_does_not_reflect_is_logged_unverified_and_a_refused_one_failed(world):
    world.policy(config=True)
    world.fake.config_reflect = False
    r = _zone(world, "gate").json()
    assert r["changed"] is True and r["verified"] is False and world.changes()[0]["status"] == "unverified"
    world.fake.config_reflect = True
    world.fake.write_status = 400
    r = _settings(world, "motion", {"motion.threshold": 50})
    assert r.status_code == 409 and r.json()["code"] == "nvr_rejected"
    assert world.changes()[0]["status"] == "failed" and world.changes()[0]["kind"] == "config_settings"
    assert _view(world).json()["first_write_done"]["config_settings"] is False, "a refused first write does not count"


# ---------------------------------------------------------------------------------------------- settings

def test_settings_of_one_section_write_only_what_changed_and_undo_back_to_the_default(world):
    world.policy(config=True)
    r = _settings(world, "motion", {"motion.threshold": 45, "motion.contour_area": 10})
    assert r.status_code == 200, r.text
    out = r.json()
    assert out["changed"] is True and out["verified"] is True and out["settings"] == {"motion.threshold": 45}
    body = _config_writes(world)[-1][2]
    assert body["update_topic"] == "config/cameras/cam_front/motion" and body["config_data"] == {"cameras": {"cam_front": {"motion": {"threshold": 45}}}}, \
        "contour_area 10 equals the default of an unset key: not written"
    log = world.changes()[0]
    assert log["kind"] == "config_settings" and log["target"] == "motion" and log["before"] == {"motion.threshold": None} and log["after"] == {"motion.threshold": 45}
    assert _settings(world, "motion", {"motion.threshold": 45}, supervised=False).json()["changed"] is False
    undo = world.call("POST", f"{BASE}/changes/{log['id']}/revert", json={"confirm": True})
    assert undo.status_code == 200 and undo.json()["verified"] is True
    assert "threshold" not in world.fake.cameras["cam_front"]["motion"], "undo removes the key so Frigate's default applies again"
    lab = _settings(world, "review", {"review.alerts.labels": ["person", "dog"]}).json()
    assert lab["verified"] is True and world.fake.cameras["cam_front"]["review"]["alerts"]["labels"] == ["dog", "person"]
    deep = _settings(world, "record", {"record.alerts.retain.days": 14}).json()
    assert deep["verified"] is True and world.fake.cameras["cam_front"]["record"]["alerts"] == {"retain": {"days": 14}}
    assert world.fake.cameras["cam_front"]["record"]["enabled"] is True, "a deep write merges, never replaces the section"


def test_nothing_but_the_config_set_route_and_reads_reach_frigate(world):
    world.policy(config=True)
    _zone(world, "gate")
    _settings(world, "detect", {"detect.fps": 7})
    assert set(world.fake.non_get) == {"POST /api/login", "PUT /api/config/set"}
    for _, _, body in _config_writes(world):
        assert set(body) == {"requires_restart", "update_topic", "config_data"} and body["requires_restart"] == 0
        assert list(body["config_data"]) == ["cameras"] and list(body["config_data"]["cameras"]) == ["cam_front"]
        assert len(body["config_data"]["cameras"]["cam_front"]) == 1, "one section per write"


@pytest.mark.parametrize("coords,expected", [("0.1,0.1,0.5,0.1,0.5,0.5", [[0.1, 0.1], [0.5, 0.1], [0.5, 0.5]]), (["0.1,0.2", "0.3,0.4", "0.5,0.1"], [[0.1, 0.2], [0.3, 0.4], [0.5, 0.1]]),
                                             ("x,1,2,3,4,5", None), (None, None)])
def test_points_are_parsed_from_frigate_shapes(coords, expected):
    assert fcfg.parse_points(coords, 1000, 1000) == expected
