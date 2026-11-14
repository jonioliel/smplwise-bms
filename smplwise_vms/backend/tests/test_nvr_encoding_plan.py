"""CR-020 phase D: the pure per-stream plan of a bulk encoding change (`nvr_encoding_batch.plan_stream`) and the body rules.
No device, no database: the reconciliation of the target settings with one stream's own options - closest valid values,
clamped ranges, the profile a codec switch needs, fields kept as they are (absent, locked by smart codec, quality under
CBR), whole-stream skips with a reason, and the S2A validation as the final gate (an invalid write is never planned)."""
from __future__ import annotations

import pytest

from smplwise.errors import ApiError
from smplwise.services import nvr_encoding_batch as enc
from smplwise.services import nvr_settings

OPTIONS = {
    "codec": ["H.264", "H.265"],
    "profile": {"H.264": ["Baseline", "Main", "High"], "H.265": ["Main"]},
    "resolution": {"H.264": ["2560x1440", "1920x1080", "1280x720"], "H.265": ["2560x1440", "1920x1080"]},
    "fps": [25.0, 20.0, 15.0, 10.0, 5.0], "fps_full": True,
    "bitrate_mode": ["CBR", "VBR"], "bitrate_kbps": {"min": 32, "max": 8192}, "quality": [10, 30, 45, 60, 75, 90],
    "gop": {"min": 1, "max": 400}, "svc": True, "smart_codec": True, "b_frames": False,
    "locks": {"smart_codec": ["gop", "bitrate_mode", "quality"]},
}


def main(**over) -> dict:
    s = {"codec": "H.265", "profile": "Main", "resolution": "2560x1440", "fps": 25.0, "fps_full": False, "bitrate_mode": "VBR", "bitrate_kbps": 4096,
         "quality": 60, "gop": 50, "svc": True, "smart_codec": False, "b_frames": None, "fields": {"b_frames": {"supported": False, "editable": False}}}
    s.update(over)
    return s


def sub(**over) -> dict:
    s = main(codec="H.264", profile="Baseline", resolution="640x360", fps=20.0, bitrate_mode="CBR", bitrate_kbps=512, quality=None, svc=None,
             fields={"svc": {"supported": False, "editable": False}, "quality": {"supported": False, "editable": False}, "b_frames": {"supported": False, "editable": False}})
    s.update(over)
    return s


def kinds(plan) -> list[tuple[str, str, str]]:
    return [(n["kind"], n["field"], n["reason"]) for n in plan.notes]


def test_codec_switch_h265_to_h264_keeps_a_profile_the_new_codec_has():
    p = enc.plan_stream(main(), OPTIONS, {"codec": "H.264"})
    assert p.status == "change"
    assert p.changes == {"codec": "H.264"} and p.fields == {"codec": ["H.265", "H.264"]}, "Main exists in H.264: no profile change"
    assert p.notes == []


def test_codec_switch_picks_the_profile_the_new_codec_needs_and_says_so():
    p = enc.plan_stream(main(codec="H.264", profile="High"), OPTIONS, {"codec": "H.265"})
    assert p.status == "change"
    assert p.changes == {"codec": "H.265", "profile": "Main"}
    assert kinds(p) == [("adjusted", "profile", "profile_codec")]
    assert p.notes[0]["requested"] == "High" and p.notes[0]["value"] == "Main" and p.notes[0]["message"]


def test_codec_switch_moves_a_resolution_the_new_codec_lacks_to_the_closest():
    opts = {**OPTIONS, "resolution": {"H.264": ["1920x1080", "1280x720"], "H.265": ["2560x1440", "1920x1080"]}}
    p = enc.plan_stream(main(resolution="2560x1440"), opts, {"codec": "H.264"})
    assert p.changes == {"codec": "H.264", "resolution": "1920x1080"}
    assert kinds(p) == [("adjusted", "resolution", "codec_resolution")]


def test_requested_resolution_not_offered_takes_the_closest_and_a_tie_takes_the_smaller():
    p = enc.plan_stream(main(), OPTIONS, {"resolution": "1600x900"})
    assert p.changes == {"resolution": "1920x1080"} and kinds(p) == [("adjusted", "resolution", "closest")]
    assert enc.closest_resolution("1000x1000", ["1100x1000", "900x1000"]) == "900x1000"


def test_fps_closest_lower_on_a_tie_and_full_when_offered():
    assert enc.plan_stream(main(), OPTIONS, {"fps": 12.5}).changes == {"fps": 10.0}
    over = enc.plan_stream(main(fps=15.0), OPTIONS, {"fps": 30})
    assert over.changes == {"fps": 25.0} and over.notes[0]["value"] == 25.0, "above the device's maximum: the maximum"
    assert enc.plan_stream(main(), OPTIONS, {"fps": "full"}).changes == {"fps": "full"}
    no_full = enc.plan_stream(main(), {**OPTIONS, "fps_full": False}, {"fps": "full"})
    assert no_full.status == "unchanged" and kinds(no_full) == [("adjusted", "fps", "closest")], "max fps = the current 25: nothing to write"


def test_bitrate_and_gop_are_clamped_into_the_device_range():
    p = enc.plan_stream(main(), OPTIONS, {"bitrate_kbps": 20000, "gop": 1000})
    assert p.changes == {"bitrate_kbps": 8192, "gop": 400}
    assert kinds(p) == [("adjusted", "bitrate_kbps", "clamped"), ("adjusted", "gop", "clamped")]


def test_quality_is_kept_under_cbr_and_closest_under_vbr():
    assert kinds(enc.plan_stream(main(bitrate_mode="CBR"), OPTIONS, {"quality": 75})) == [("kept", "quality", "quality_cbr")]
    p = enc.plan_stream(main(), OPTIONS, {"quality": 70})
    assert p.changes == {"quality": 75}, "70 is between 60 and 75: 75 is nearer"
    switched = enc.plan_stream(main(bitrate_mode="CBR"), OPTIONS, {"bitrate_mode": "VBR", "quality": 90})
    assert switched.changes == {"bitrate_mode": "VBR", "quality": 90}, "switching to VBR in the same change unlocks quality"


def test_smart_codec_on_locks_gop_bitrate_mode_and_quality_which_stay_as_they_are():
    p = enc.plan_stream(main(smart_codec=True), OPTIONS, {"gop": 100, "bitrate_mode": "CBR", "quality": 90, "codec": "H.264"})
    assert p.status == "change" and p.changes == {"codec": "H.264"}
    assert kinds(p) == [("kept", "bitrate_mode", "locked_smart"), ("kept", "quality", "locked_smart"), ("kept", "gop", "locked_smart")]
    turning_on = enc.plan_stream(main(), OPTIONS, {"smart_codec": True, "gop": 100})
    assert turning_on.changes == {"smart_codec": True} and kinds(turning_on) == [("kept", "gop", "locked_smart")]


def test_a_field_the_stream_does_not_have_is_kept_and_the_rest_applies():
    p = enc.plan_stream(sub(), OPTIONS, {"svc": False, "codec": "H.265"})
    assert p.status == "change"
    assert p.changes == {"codec": "H.265", "profile": "Main", "resolution": "1920x1080"}, "the sub's 640x360 is not offered for H.265: the closest"
    assert ("kept", "svc", "not_in_stream") in kinds(p)


def test_skips_with_a_reason_when_no_valid_counterpart_exists():
    assert enc.plan_stream(main(), None, {"codec": "H.264"}).reason == "capabilities_unreadable"
    assert enc.plan_stream(main(), {**OPTIONS, "codec": ["H.265"]}, {"codec": "H.264"}).reason == "codec_not_offered"
    assert enc.plan_stream(main(codec="H.264", profile="High"), {**OPTIONS, "profile": {"H.264": ["High"]}}, {"codec": "H.265"}).reason == "profile_unavailable"
    assert enc.plan_stream(main(), {**OPTIONS, "bitrate_mode": ["VBR"]}, {"bitrate_mode": "CBR"}).reason == "bitrate_mode_not_offered"
    assert enc.plan_stream(main(), {**OPTIONS, "resolution": {}}, {"resolution": "1920x1080"}).reason == "resolution_unavailable"
    locked_codec = main(fields={"codec": {"supported": True, "editable": False}})
    assert enc.plan_stream(locked_codec, OPTIONS, {"codec": "H.264"}).reason == "codec_not_supported"
    skip = enc.plan_stream(main(), {**OPTIONS, "codec": ["H.265"]}, {"codec": "H.264"}).as_dict()
    assert skip["status"] == "skip" and skip["message"] == enc.SKIP_HE["codec_not_offered"] and skip["changes"] == {}


def test_already_as_asked_is_unchanged_with_no_change_to_write():
    p = enc.plan_stream(main(), OPTIONS, {"codec": "H.265", "svc": True, "resolution": "2560x1440"})
    assert (p.status, p.changes, p.fields) == ("unchanged", {}, {})


@pytest.mark.parametrize("target", [
    {"codec": "H.264"}, {"codec": "H.265"}, {"resolution": "1600x900"}, {"fps": 7}, {"fps": "full"}, {"bitrate_mode": "CBR", "bitrate_kbps": 99999},
    {"quality": 1}, {"gop": 0 + 1}, {"svc": False}, {"smart_codec": True, "gop": 9}, {"codec": "H.264", "resolution": "640x480", "fps": 60, "gop": 5000},
])
@pytest.mark.parametrize("stream", ["main", "main264", "sub", "smart"])
def test_every_planned_change_passes_the_s2a_validation(target, stream):
    cur = {"main": main(), "main264": main(codec="H.264", profile="High"), "sub": sub(), "smart": main(smart_codec=True)}[stream]
    p = enc.plan_stream(cur, OPTIONS, target)
    if p.status == "change":
        effective, fields, _ = nvr_settings.validate_changes(cur, OPTIONS, p.changes)  # never raises for a planned change
        assert effective == p.changes and fields == p.fields


def test_settings_whitelist_and_types():
    assert enc.parse_settings({"codec": "H.264", "fps": "full", "svc": False}) == {"codec": "H.264", "fps": "full", "svc": False}
    for bad in ({}, None, [], {"codec": "MJPEG"}, {"codec": "h264"}, {"resolution": "1920*1080"}, {"fps": 0}, {"fps": True}, {"fps": float("nan")},
                {"bitrate_kbps": "4096"}, {"bitrate_kbps": 2.5}, {"quality": 101}, {"gop": 0}, {"svc": "false"}, {"smart_codec": 0}):
        with pytest.raises(ApiError) as e:
            enc.parse_settings(bad)
        assert e.value.status == 422
    with pytest.raises(ApiError) as e:
        enc.parse_settings({"profile": "High"})
    assert e.value.code == "batch_field_not_allowed", "the profile is never chosen by the person"
    with pytest.raises(ApiError) as e:
        enc.parse_settings({"b_frames": True})
    assert e.value.code == "batch_field_not_allowed"


def test_start_body_confirm_first_then_targets_with_the_planned_change():
    with pytest.raises(ApiError) as e:
        enc.parse_start_body({"confirm": "true", "settings": {"codec": "H.264"}, "targets": []})
    assert e.value.code == "confirm_required"
    good = {"camera_id": "cam-1", "stream_ref": "101", "if_match": "0123456789abcdef", "changes": {"codec": "H.264", "profile": "Main"}}
    target, targets, rid = enc.parse_start_body({"confirm": True, "settings": {"codec": "H.264"}, "targets": [good], "recorder_id": "nvr-1"})
    assert (target, rid, targets[0].changes) == ({"codec": "H.264"}, "nvr-1", {"codec": "H.264", "profile": "Main"})
    for bad in ({**good, "changes": {}}, {**good, "changes": {"b_frames": True}}, {**good, "changes": {"profile": "<x/>"}}, {**good, "if_match": "XYZ"},
                {**good, "extra": 1}, {k: v for k, v in good.items() if k != "changes"}):
        with pytest.raises(ApiError) as e:
            enc.parse_start_body({"confirm": True, "settings": {"codec": "H.264"}, "targets": [bad]})
        assert e.value.code == "validation"
    with pytest.raises(ApiError) as e:  # the same stream twice
        enc.parse_start_body({"confirm": True, "settings": {"codec": "H.264"}, "targets": [good, good]})
    assert e.value.details["duplicate"] is True
    # main and sub of ONE camera are two targets (the SVC batch allowed one stream per camera)
    _t, two, _r = enc.parse_preview_body({"settings": {"codec": "H.264"}, "targets": [{"camera_id": "cam-1", "stream_ref": "101"}, {"camera_id": "cam-1", "stream_ref": "102"}]})
    assert [t.stream_ref for t in two] == ["101", "102"]
