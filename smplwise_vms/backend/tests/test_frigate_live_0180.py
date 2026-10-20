"""FRIGLIVE-295: regressions for what the live session on the owner's Frigate 0.18.0 (2026-10-21) found, against the fake Frigate with the
measured behaviour switched on (`micro_cache`, `strict_delete`, `effective_defaults`, `clip_no_recordings`; see fixtures/fake_frigate.py).
Evidence and the compatibility report: docs/changes/CR-FRIGATE-LIVE-0180-REPORT.md. Nothing here talks to a real server.

1. Frigate's nginx serves `/api/*` from a ~5 s micro-cache: a read right after a write showed the old state (every toggle "appeared" after
   5.5-6.1 s). Reads that decide about a write send `X-Cache-Bypass: 1`; polling and discovery keep the cache.
2. `GET /api/exports` rows name the case `export_case` (not `export_case_id`).
3. A range clip over a window without recordings is 400 "No recordings found ..." -> Arx `no_recording`, not a generic refusal.
4. `config/set` with "" for a key the YAML file does not hold is a 500 (update_yaml `del`): the first live zone create failed that way.
5. `/api/config` is the EFFECTIVE config: an undo that wrote the inherited value back pinned it in the YAML (one extra line).
"""
from __future__ import annotations

import sys
from pathlib import Path

from smplwise.services.recorders import frigate as fr
from smplwise.services.recorders import frigate_http as fh
from smplwise.services.recorders.frigate_control import FrigateControl

sys.path.insert(0, str(Path(__file__).resolve().parent))
sys.path.insert(0, str(Path(__file__).resolve().parent / "fixtures"))
from fake_frigate import T0, FakeFrigate, settings_for  # noqa: E402
from test_frigate_config import _cam, _config_writes, _settings, _zone  # noqa: E402
from test_frigate_control import BASE, World, _clean, world  # noqa: E402,F401  (fixtures)
from test_frigate_f2b import _clip_url  # noqa: E402


def _plain_adapter(w: World) -> fr.FrigateAdapter:
    return fr.FrigateAdapter("nvr-1", w.s, transport=w.fake.transport())


# ---------------------------------------------------------------------------------------------- 1. the micro-cache

def test_a_toggle_is_verified_and_undone_at_once_although_frigate_caches_api_reads(world):
    world.fake.micro_cache = True
    _plain_adapter(world).http.get_json("/api/config")          # a cached copy of the config BEFORE the write, as Frigate's nginx keeps it
    world.policy(analytics=True)
    r = world.toggle("cam_front", "improve_contrast", False).json()
    assert r["changed"] is True and r["verified"] is True and r["observed"] is False, "the read-back bypassed the cache"
    stale = _plain_adapter(world).http.get_json("/api/config")["cameras"]["cam_front"]["motion"]["improve_contrast"]
    assert stale is True, "a plain read still gets the cached (old) document: this is what made every live read-back look unverified"
    undo = world.call("POST", f"{BASE}/changes/{r['change_id']}/revert", json={})
    assert undo.status_code == 200 and undo.json()["verified"] is True, "no false frigate_change_stale right after the change"
    assert "/api/config" in world.fake.bypass_gets


def test_polling_and_discovery_keep_frigate_s_cache():
    fake = FakeFrigate()
    fake.micro_cache = True
    from smplwise.config import Settings

    s = settings_for(Settings(data_dir=Path("."), www_dir=None, in_addon=False, trusted_proxies=(), dev_user=None, bootstrap_admin_username=None,
                              nvr_host=None, nvr_http_port=80, nvr_user=None, nvr_password=None, go2rtc_url=None, log_level="warning"))
    a = fr.FrigateAdapter("nvr-9", s, transport=fake.transport())
    fh.clear_cache()
    a.discover(refresh=True)
    a.review_items(T0 - 3600, T0)
    assert fake.bypass_gets == [], "only reads that verify a write bypass the cache"
    FrigateControl(a).read_features("cam_front")
    FrigateControl(a).list_exports()
    assert fake.bypass_gets == ["/api/config", "/api/exports"]


def test_retain_and_reviewed_reads_bypass_the_cache(world):
    world.fake.micro_cache = True
    ctl = FrigateControl(_plain_adapter(world))
    ctl.event("1791227000.100000-aaa111")
    ctl.active_profile()
    ctl.list_cases()
    assert {"/api/events/1791227000.100000-aaa111", "/api/profiles", "/api/cases"} <= set(world.fake.bypass_gets)


# ---------------------------------------------------------------------------------------------- 2. export rows

def test_the_case_of_an_export_row_is_read_from_export_case_and_from_export_case_id(world):
    world.fake.exports.append({"id": "cam_yard_live", "camera": "cam_yard", "name": "live shape", "date": 1, "in_progress": False, "export_case": "case_foreign"})
    world.fake.exports.append({"id": "cam_yard_old", "camera": "cam_yard", "name": "job shape", "date": 1, "in_progress": False, "export_case_id": "case_foreign"})
    rows = {x["id"]: x for x in FrigateControl(_plain_adapter(world)).list_exports()}
    assert rows["cam_yard_live"]["case_id"] == "case_foreign" and rows["cam_yard_old"]["case_id"] == "case_foreign"
    assert rows["cam_front_foreign"]["case_id"] is None


# ---------------------------------------------------------------------------------------------- 3. a clip without recordings

def test_a_range_clip_without_recordings_is_no_recording(world):
    world.fake.clip_no_recordings = True
    r = world.call("GET", _clip_url(world, supervised=True))
    assert r.status_code == 409 and r.json()["code"] == "no_recording"
    assert world.fake.clip_hits == [] or all("/start/" in h for h in world.fake.clip_hits)


# ---------------------------------------------------------------------------------------------- 4. config/set deletes only keys the file holds

def test_a_new_zone_without_optional_fields_is_written_without_empty_values(world):
    world.fake.strict_delete = True
    world.fake.effective_defaults = True
    world.policy(config=True)
    r = _zone(world, "lawn", key="cam_yard", objects=[])
    assert r.status_code == 200 and r.json()["verified"] is True, r.text
    body = _config_writes(world)[-1][2]["config_data"]["cameras"]["cam_yard"]["zones"]["lawn"]
    assert body == {"coordinates": "0.2,0.2,0.6,0.2,0.6,0.7,0.2,0.7"}, "no \"\" for objects / inertia / loitering_time the file never held"
    undo = world.call("POST", f"{BASE}/changes/{world.changes()[0]['id']}/revert", json={"confirm": True})
    assert undo.status_code == 200 and undo.json()["verified"] is True
    assert _config_writes(world)[-1][2]["config_data"]["cameras"]["cam_yard"] == {"zones": ""}, "the camera's last zone: the whole key goes"
    assert "zones" not in world.fake.cameras["cam_yard"], "no `zones: {}` is left behind in the file"


def test_removing_one_of_several_zones_removes_that_zone_only(world):
    world.fake.strict_delete = True
    world.policy(config=True)
    assert _zone(world, "lawn").json()["verified"] is True
    gone = world.call("POST", f"{BASE}/cameras/{_cam(world)}/config/zones/lawn/delete", json={"confirm": True})
    assert gone.status_code == 200 and gone.json()["verified"] is True
    assert _config_writes(world)[-1][2]["config_data"]["cameras"]["cam_front"] == {"zones": {"lawn": ""}}
    assert "porch" in world.fake.cameras["cam_front"]["zones"]


def test_clearing_an_optional_field_the_file_holds_still_removes_it(world):
    world.fake.strict_delete = True
    world.fake.effective_defaults = True
    world.policy(config=True)
    world.fake.cameras["cam_front"]["zones"]["porch"] = {"coordinates": "0.1,0.1,0.5,0.1,0.5,0.5", "inertia": 5, "objects": ["car"]}
    r = _zone(world, "porch", objects=[])
    assert r.status_code == 200 and r.json()["verified"] is True, r.text
    body = _config_writes(world)[-1][2]["config_data"]["cameras"]["cam_front"]["zones"]["porch"]
    assert body["inertia"] == "" and body["objects"] == "" and "loitering_time" not in body
    assert world.fake.cameras["cam_front"]["zones"]["porch"] == {"coordinates": "0.2,0.2,0.6,0.2,0.6,0.7,0.2,0.7"}


# ---------------------------------------------------------------------------------------------- 5. an undo does not pin the inherited value

def test_a_settings_undo_removes_the_key_instead_of_pinning_the_inherited_value(world):
    world.fake.strict_delete = True
    world.fake.effective_defaults = True
    world.policy(config=True)
    r = _settings(world, "motion", {"motion.threshold": 45}).json()
    assert r["verified"] is True
    log = world.changes()[0]
    assert log["before"] == {"motion.threshold": 30}, "the effective config shows the default of the unset key"
    undo = world.call("POST", f"{BASE}/changes/{log['id']}/revert", json={"confirm": True})
    assert undo.status_code == 200 and undo.json()["verified"] is True
    assert _config_writes(world)[-1][2]["config_data"]["cameras"]["cam_front"] == {"motion": {"threshold": ""}}
    assert "threshold" not in world.fake.cameras["cam_front"]["motion"], "the file is as it was: no `threshold: 30` line"


def test_a_settings_undo_writes_a_value_that_was_really_set(world):
    world.fake.strict_delete = True
    world.fake.effective_defaults = True
    world.policy(config=True)
    world.fake.cameras["cam_front"]["motion"]["threshold"] = 50
    assert _settings(world, "motion", {"motion.threshold": 45}).json()["verified"] is True
    undo = world.call("POST", f"{BASE}/changes/{world.changes()[0]['id']}/revert", json={"confirm": True})
    assert undo.status_code == 200 and undo.json()["verified"] is True
    assert world.fake.cameras["cam_front"]["motion"]["threshold"] == 50 and _config_writes(world)[-1][2]["config_data"]["cameras"]["cam_front"] == {"motion": {"threshold": 50}}


def test_a_wrong_guess_of_the_inherited_value_is_corrected_with_one_more_write(world, monkeypatch):
    """The key was really set to the value Arx took for the inherited one: removing it reads back a different value, so the value itself is
    written once (a correction, not a repeat of the same write)."""
    from smplwise.services.recorders import frigate_config as fcfg

    world.fake.strict_delete = True
    world.fake.effective_defaults = True
    world.policy(config=True)
    world.fake.cameras["cam_front"]["motion"]["threshold"] = 40
    assert _settings(world, "motion", {"motion.threshold": 45}).json()["verified"] is True
    monkeypatch.setattr(fcfg.FrigateConfig, "inherited", lambda self, keys: {"motion.threshold": 40})
    n = len(_config_writes(world))
    undo = world.call("POST", f"{BASE}/changes/{world.changes()[0]['id']}/revert", json={"confirm": True})
    assert undo.status_code == 200 and undo.json()["verified"] is True
    bodies = [w[2]["config_data"]["cameras"]["cam_front"] for w in _config_writes(world)[n:]]
    assert bodies == [{"motion": {"threshold": ""}}, {"motion": {"threshold": 40}}]
    assert world.fake.cameras["cam_front"]["motion"]["threshold"] == 40
