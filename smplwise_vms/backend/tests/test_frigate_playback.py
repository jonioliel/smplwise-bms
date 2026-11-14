"""NN5 F1 - Frigate recordings: coverage / policy / motion density (partial is not empty), the HLS playlist rewrite (only VOD
names, only under the Arx prefix), window rules, and the playback / export DESIGN (anchors unproven, nothing executed)."""
from __future__ import annotations

import pytest

from smplwise.errors import ApiError
from smplwise.services.recorders import frigate_playback as fp

T0 = 1_000_000.0
MOTION_ONLY = {"record_enabled": True, "continuous_days": 0, "motion_days": 10, "alerts_days": 30, "detections_days": 30}


def seg(start, motion=5, objects=0, length=9.99):
    return {"start_time": start, "end_time": start + length, "motion": motion, "objects": objects}


def test_policy_from_retention():
    assert fp.recording_policy({"record_enabled": True, "continuous_days": 3}) == "continuous"
    assert fp.recording_policy(MOTION_ONLY) == "motion"
    assert fp.recording_policy({"record_enabled": True, "continuous_days": 0, "motion_days": 0, "alerts_days": 5}) == "events"
    assert fp.recording_policy({"record_enabled": False}) == "off" and fp.recording_policy({}) == "unknown" and fp.recording_policy(None) == "unknown"


def test_adjacent_segments_merge_and_a_hole_splits():
    segs = [seg(T0 + 10 * i) for i in range(6)] + [seg(T0 + 200 + 10 * i) for i in range(3)]
    c = fp.coverage(segs, T0, T0 + 300, MOTION_ONLY)
    assert [(r["start"], round(r["end"]), r["segments"]) for r in c["ranges"]] == [(T0, T0 + 60, 6), (T0 + 200, T0 + 230, 3)]
    assert c["covered_s"] == pytest.approx(89.97, abs=0.1) and c["partial"] is True and c["policy"] == "motion" and c["sparse_by_design"] is True
    assert c["ratio"] == pytest.approx(0.3, abs=0.01)


def test_partial_is_not_empty_and_empty_is_reported_as_such():
    one = fp.coverage([seg(T0 + 5)], T0, T0 + 600, MOTION_ONLY)
    assert one["partial"] and one["covered_s"] > 0 and one["ranges"] and one["sparse_by_design"]
    none = fp.coverage([], T0, T0 + 600, MOTION_ONLY)
    assert none["ranges"] == [] and none["covered_s"] == 0 and none["ratio"] == 0 and none["partial"] and none["policy"] == "motion"


def test_a_continuous_policy_with_a_full_window_is_not_partial():
    segs = [seg(T0 + 10 * i, length=10.0) for i in range(30)]
    c = fp.coverage(segs, T0, T0 + 300, {"record_enabled": True, "continuous_days": 7})
    assert c["partial"] is False and c["ratio"] == 1.0 and c["sparse_by_design"] is False and len(c["ranges"]) == 1


def test_segments_are_clipped_to_the_window_and_junk_is_ignored():
    segs = [seg(T0 - 5), seg(T0 + 295), {"start_time": "x"}, {"start_time": 5, "end_time": 4}, {}, seg(T0 + 1000)]
    c = fp.coverage(segs, T0, T0 + 300, None)
    assert c["ranges"][0]["start"] == T0 and c["ranges"][-1]["end"] == T0 + 300 and len(c["ranges"]) == 2 and c["policy"] == "unknown"


def test_motion_density_buckets():
    segs = [seg(T0 + 10 * i, motion=10, objects=1 if i == 1 else 0) for i in range(12)]
    c = fp.coverage(segs, T0, T0 + 120, MOTION_ONLY, bucket_s=60)
    assert [(b["start"], b["motion"], b["objects"]) for b in c["density"]] == [(T0, 60.0, 1.0), (T0 + 60, 60.0, 0.0)]


PLAYLIST = '#EXTM3U\n#EXT-X-MAP:URI="init-v1.mp4"\n#EXTINF:9.998,\nseg-1-v1.m4s\n#EXTINF:3.0,\nseg-12-v1.m4s\n#EXT-X-ENDLIST\n'


def test_playlist_rewrite_points_everything_at_the_arx_prefix():
    out = fp.rewrite_playlist(PLAYLIST, "/api/v1/frigate/nvr-2/cameras/c1/playback/10/20/")
    lines = out.splitlines()
    assert '#EXT-X-MAP:URI="/api/v1/frigate/nvr-2/cameras/c1/playback/10/20/init-v1.mp4"' in lines
    assert "/api/v1/frigate/nvr-2/cameras/c1/playback/10/20/seg-12-v1.m4s" in lines and "#EXT-X-ENDLIST" in lines
    assert "frigate" not in out.replace("/api/v1/frigate/", "")


@pytest.mark.parametrize("bad", [
    "http://frigate.test:8971/vod/x/seg-1-v1.m4s", "//evil/seg-1-v1.m4s", "../seg-1-v1.m4s", "/vod/seg-1-v1.m4s", "seg-1-v1.m4s?token=1", "seg-a-v1.m4s", "index.m3u8", "evil.ts",
])
def test_a_foreign_segment_uri_is_refused(bad):
    with pytest.raises(ApiError) as e:
        fp.rewrite_playlist(f"#EXTM3U\n#EXTINF:1,\n{bad}\n", "/p/")
    assert e.value.code == "source_invalid"


def test_a_foreign_init_uri_is_refused():
    with pytest.raises(ApiError):
        fp.rewrite_playlist('#EXTM3U\n#EXT-X-MAP:URI="http://x/init.mp4"\n', "/p/")


def test_windows():
    now = 2_000_000.0
    fp.validate_window(now - 100, now, 3600, now)
    for s, e in ((now, now - 1), (now - 10_000, now), (now + 1000, now + 1100)):
        with pytest.raises(ApiError) as exc:
            fp.validate_window(s, e, 3600, now)
        assert exc.value.code in ("window_invalid", "window_too_long")


def test_playback_plan_marks_anchors_unproven_and_hides_frigate():
    segs = [seg(T0 - 4), seg(T0 + 6)]
    p = fp.playback_plan("nvr-2", "cam_front", T0, T0 + 60, segs, MOTION_ONLY, camera_ref="cid1")
    assert p["kind"] == "hls" and p["anchors"]["proven"] is False and p["anchors"]["status"] == "unproven"
    assert p["anchors"]["first_segment_start"] == T0 - 4 and p["anchors"]["first_segment_starts_before_request"] is True
    assert p["playlist"].startswith("/api/v1/frigate/nvr-2/cameras/cid1/playback/index.m3u8?start=") and "cam_front" not in p["playlist"] + p["assets"]
    assert p["coverage"]["policy"] == "motion" and "seek generation" in p["anchors"]["to_prove"]
    assert fp.ANCHORS_PROVEN is False


def test_export_plan_is_design_only():
    p = fp.export_plan("nvr-2", "cam_front", T0, T0 + 300, camera_ref="cid1")
    assert p["executed"] is False and p["status"] == "design_only" and p["verified"] is False and p["allow_listed"] is False
    assert p["limits"]["max_window_s"] == 3600 and "approval" in " ".join(p["needs"])
