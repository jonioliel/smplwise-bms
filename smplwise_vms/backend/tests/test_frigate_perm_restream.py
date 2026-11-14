"""FRIGPERM-295 - the permanent-restream plan for Frigate. Pure plan tests plus the fake Frigate (`fixtures/fake_frigate.py`) over an
httpx mock transport: nothing here talks to a real Frigate, a real go2rtc or a lab device, and the planted camera credentials of the
fake's `/api/config` must never reach a report, a digest or a write body."""
from __future__ import annotations

import json
import sys
from pathlib import Path

import pytest

from smplwise.errors import ApiError
from smplwise.services.recorders import frigate as fr
from smplwise.services.recorders import frigate_perm_restream as fp

sys.path.insert(0, str(Path(__file__).resolve().parent / "fixtures"))
from fake_frigate import HOST, PLANTED_PASSWORD, PLANTED_TOKEN_USER, FakeFrigate, camera_config, settings_for  # noqa: E402


def cam(path: str | None, *, enabled: bool = True) -> dict:
    c = camera_config("x", enabled=enabled)
    c["ffmpeg"]["inputs"] = [{"path": path, "roles": ["detect", "record"]}] if path else []
    return c


CFG = {"cameras": {
    "front_door": cam("rtsp://10.9.8.7:8554/front_door"),
    "parking": cam("rtsp://10.9.8.7:8554/parking_main"),
    "street": cam("rtsp://*:*@10.9.8.9:554/Streaming/Channels/102"),
    "loop": cam("rtsp://127.0.0.1:8554/loop"),
    "off_cam": cam("rtsp://10.9.8.7:8554/off", enabled=False),
    "no_input": cam(None),
}}


def plan(cfg=CFG, **kw):
    return fp.build_plan(cfg, frigate_host="frigate.test", **kw)


def states(p):
    return {r["camera"]: (r["state"], r["reason"]) for r in p["cameras"]}


def test_plan_classifies_every_camera():
    p = plan()
    assert states(p) == {
        "front_door": ("add", "missing"), "parking": ("add", "missing"),
        "street": ("needs_owner", "credentials"), "loop": ("needs_owner", "self_reference"),
        "off_cam": ("skipped", "camera_disabled"), "no_input": ("skipped", "no_input"),
    }
    assert p["counts"] == {"present": 0, "add": 2, "conflict": 0, "needs_owner": 2, "skipped": 2}
    assert p["restart_required"] is True


def test_existing_entries_are_present_conflict_or_foreign_and_never_rewritten():
    cfg = {**CFG, "go2rtc": {"streams": {
        "front_door": ["rtsp://10.9.8.7:8554/front_door"],      # same source -> present
        "parking": "rtsp://10.9.8.7:8554/other",                # different -> conflict
        "street": ["rtsp://user:pw@10.9.8.9:554/x"],            # owner already added by hand -> present
        "intercom_door": ["rtsp://x/y"]}}}                      # not an Arx camera -> left alone
    p = plan(cfg)
    assert states(p)["front_door"] == ("present", "in_yaml") and states(p)["street"] == ("present", "in_yaml")
    assert states(p)["parking"] == ("conflict", "different_source")
    assert p["foreign_streams_left_alone"] == 1
    assert "front_door" not in (p["_sources"] or {}) and "parking" not in p["_sources"]
    with pytest.raises(ApiError) as e:
        fp.config_set_body(p)
    assert e.value.code == "frigate_perm_nothing_to_add"


def test_runtime_only_stream_still_needs_the_permanent_entry():
    p = plan(runtime_streams=["front_door"])
    assert states(p)["front_door"] == ("add", "runtime_only")


def test_only_limits_the_cameras_and_a_second_run_is_idempotent():
    p = plan(only=["front_door"])
    assert [r["camera"] for r in p["cameras"]] == ["front_door"]
    assert plan()["digest"] == plan()["digest"] != plan(only=["front_door"])["digest"]
    after = {**CFG, "go2rtc": {"streams": {"front_door": ["rtsp://10.9.8.7:8554/front_door"], "parking": ["rtsp://10.9.8.7:8554/parking_main"]}}}
    assert plan(after)["counts"]["add"] == 0 and plan(after)["restart_required"] is False


def test_report_is_redacted():
    cfg = {"cameras": {**CFG["cameras"], "q": cam(f"rtsp://{PLANTED_TOKEN_USER}:{PLANTED_PASSWORD}@10.9.8.1:554/a?token=SECRETQ")}}
    text = fp.report(plan(cfg))
    for bad in ("10.9.8", "127.0.0.1", PLANTED_PASSWORD, PLANTED_TOKEN_USER, "SECRETQ", "token=", "frigate.test"):
        assert bad not in text, bad
    assert "host-A" in text and "needs_owner (credentials)" in text and "digest" in text
    assert json.dumps(fp.public(plan(cfg))).find("10.9.8") == -1


def test_body_has_new_entries_only_and_requires_restart():
    b = fp.config_set_body(plan())
    assert b["requires_restart"] == 1 and set(b["config_data"]) == {"go2rtc"}
    assert b["config_data"]["go2rtc"]["streams"] == {"front_door": ["rtsp://10.9.8.7:8554/front_door"], "parking": ["rtsp://10.9.8.7:8554/parking_main"]}
    assert fp.rollback_body(["front_door"])["config_data"]["go2rtc"]["streams"] == {"front_door": ""}
    for bad in ([], ["../x"], ["a b"]):
        with pytest.raises(ApiError):
            fp.rollback_body(bad)


def test_yaml_snippet_has_a_placeholder_for_credentials_not_a_secret():
    s = fp.yaml_snippet(plan())
    assert s.startswith("go2rtc:\n  streams:") and "front_door:" in s and "street:" in s and "<same rtsp address" in s
    assert "loop:" not in s and "off_cam" not in s


# ---------------------------------------------------------------------------------------------- over the fake Frigate

@pytest.fixture()
def world(settings):
    fake = FakeFrigate()
    fake.cameras["cam_front"]["ffmpeg"]["inputs"][0]["path"] = "rtsp://192.0.2.10:8554/front"   # no credentials -> planned
    # cam_yard keeps the fake's planted-credential input -> needs_owner
    ad = fr.FrigateAdapter("nvr-1", settings_for(settings), transport=fake.transport())
    return fake, ad


def test_dry_run_over_the_fake_reads_only_and_never_leaks(world):
    fake, ad = world
    p = fp.load_plan(ad)
    st = states(p)
    assert st["cam_front"] == ("add", "missing") and st["cam_yard"] == ("needs_owner", "credentials")
    assert all(w[0] != "PUT" for w in fake.writes) and fake.writes == []
    text = fp.report(p) + json.dumps(fp.public(p))
    for bad in (PLANTED_PASSWORD, PLANTED_TOKEN_USER, "192.0.2", HOST):
        assert bad not in text


def test_apply_needs_the_owner_phrase_and_the_exact_digest(world):
    fake, ad = world
    p = fp.load_plan(ad)
    with pytest.raises(ApiError) as e:
        fp.apply_plan(ad, p, digest=p["digest"], owner_go="yes")
    assert e.value.code == "frigate_perm_no_owner_go"
    with pytest.raises(ApiError) as e:
        fp.apply_plan(ad, p, digest="0" * 16, owner_go=fp.OWNER_GO)
    assert e.value.code == "frigate_perm_plan_changed"
    assert fake.writes == []


def test_apply_writes_once_then_the_second_plan_is_empty_and_rollback_restores(world):
    fake, ad = world
    p = fp.load_plan(ad)
    out = fp.apply_plan(ad, p, digest=p["digest"], owner_go=fp.OWNER_GO)
    assert out == {"written": ["cam_front"], "restart_required": True, "applied_after_restart_only": True}
    assert [w[1] for w in fake.writes] == ["/api/config/set"] and fake.writes[0][2]["requires_restart"] == 1
    assert fake.go2rtc_yaml == {"cam_front": ["rtsp://192.0.2.10:8554/front"]}
    p2 = fp.load_plan(ad)                       # idempotent: nothing left to add (the entry is in the YAML now)
    assert states(p2)["cam_front"] == ("present", "in_yaml") and p2["counts"]["add"] == 0
    with pytest.raises(ApiError):
        fp.apply_plan(ad, p2, digest=p2["digest"], owner_go=fp.OWNER_GO)
    ad.http.write("config", "PUT", fp.WRITE_PATH, fp.rollback_body(["cam_front"]))
    assert fake.go2rtc_yaml == {}


def test_a_conflict_blocks_the_whole_apply(world):
    fake, ad = world
    fake.go2rtc_yaml["cam_front"] = ["rtsp://192.0.2.99:8554/else"]
    p = fp.load_plan(ad)
    assert states(p)["cam_front"] == ("conflict", "different_source")
    with pytest.raises(ApiError) as e:
        fp.apply_plan(ad, p, digest=p["digest"], owner_go=fp.OWNER_GO)
    assert e.value.code == "frigate_perm_conflict" and fake.writes == []


def test_verify_after_restart_is_read_only(world):
    fake, ad = world
    p = fp.load_plan(ad)
    assert fp.verify_after_restart(ad, p) == {"listed": [], "missing": ["cam_front"]}
    fake.restream, fake.restream_names = True, ["cam_front"]
    assert fp.verify_after_restart(ad, p) == {"listed": ["cam_front"], "missing": []}
    assert fake.writes == []
