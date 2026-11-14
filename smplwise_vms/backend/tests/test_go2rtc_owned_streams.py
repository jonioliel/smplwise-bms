"""CR-GO2RTC-OWNED-2436 (code review 2026-11-13, report 03 F09 and the caller half of F10).

The "streams one feature owns" rule lives once in services/go2rtc.py (`names_foreign_stream`, `refuse_foreign`, `OwnedStreams`,
`delete_listed`); manual camera sources, Home Assistant cameras, the playback orphan sweep, the disabled-recorder cleanup and the Frigate
restream check delegate to it. The acceptance list is the namespace table of report 03 section 3.0: only `smplwise_` streams - and per
feature only its own prefix and shape - are ever written or deleted. The shared go2rtc also serves a separate intercom project; its
streams (and every other foreign name) must stay untouched whatever a feature's wanted-set says.

In-memory fakes only: no request reaches a real go2rtc.
"""
from __future__ import annotations

import re
import threading
import time

import pytest

from smplwise.errors import ApiError
from smplwise.services import go2rtc as g2

# names on the shared go2rtc that Arx must never write or delete: the intercom project's streams and other foreign names, plus
# `smplwise_` names of OTHER features (each feature owns only its own prefix)
FOREIGN = ["door_1", "intercom_front", "Door-Lobby", "smplwise", "smplwisex_cam_a_sub", "SMPLWISE_cam_a_sub"]
OTHER_FEATURE = ["smplwise_nvr-1_ch1_sub", "smplwise_wiskey_st1", "smplwise_ha_garden", "smplwise_pb_t1_abc_g0"]
CAM_SHAPE = re.compile(r"^smplwise_cam_(?!probe_)[A-Za-z0-9][A-Za-z0-9_-]{0,63}_(main|sub)(_h264)?$")


class FakeClient:
    """`Go2rtc`'s list / ensure / delete over a dict; records every write and delete."""

    def __init__(self, names=()):
        self.store: dict[str, list[str]] = {n: ["rtsp://x"] for n in names}
        self.writes: list[str] = []
        self.deletes: list[str] = []
        self.fail_delete_after: int | None = None
        self.on_list = None

    def list_streams(self):
        if self.on_list is not None:
            self.on_list()
        return {n: g2.StreamInfo(name=n, sources=list(s), online=False) for n, s in self.store.items()}

    def ensure_stream(self, name, src, check=None, streams=None):
        if not name.startswith(g2.STREAM_PREFIX):  # the adapter's own guard
            raise ValueError("refusing to write a stream outside the smplwise_ namespace")
        if check is not None:
            check(self.list_streams())
        self.writes.append(name)
        existed = name in self.store
        self.store[name] = [src]
        return "updated" if existed else "created"

    def delete_stream(self, name, *, strict=False):
        if not name.startswith(g2.STREAM_PREFIX):
            raise ValueError("refusing to delete a stream outside the smplwise_ namespace")
        if self.fail_delete_after is not None and len(self.deletes) >= self.fail_delete_after:
            raise ApiError(503, "media_unavailable", "go2rtc down", retryable=True)
        self.deletes.append(name)
        self.store.pop(name, None)


def cam_owned() -> g2.OwnedStreams:
    return g2.OwnedStreams("smplwise_cam_", CAM_SHAPE)


# ------------------------------------------------------------------------------------------- the namespace guarantee


def test_owns_only_smplwise_names_of_the_feature_prefix_and_shape():
    owned = cam_owned()
    assert owned.owns("smplwise_cam_abc_sub") and owned.owns("smplwise_cam_abc_main_h264")
    for name in FOREIGN + OTHER_FEATURE + ["smplwise_cam_probe_1_sub", "smplwise_cam_abc", "smplwise_cam_a b_sub", None, 7]:
        assert not owned.owns(name), name


def test_a_prefix_outside_smplwise_can_never_be_owned():
    """Even a feature misconfigured with a foreign prefix owns nothing: `smplwise_` is checked on top of the feature prefix."""
    owned = g2.OwnedStreams("door_")
    client = FakeClient(["door_1", "door_2"])
    assert not owned.owns("door_1")
    assert owned.reconcile(client, set, grace_s=0.0) == [] and client.deletes == []
    with pytest.raises(ValueError):
        owned.write(client, "door_1", "rtsp://evil/x")
    with pytest.raises(ValueError):
        owned.delete(client, "door_1")
    assert client.writes == [] and sorted(client.store) == ["door_1", "door_2"]


def test_write_and_delete_refuse_every_foreign_or_other_feature_name_before_any_request():
    owned = cam_owned()
    client = FakeClient(FOREIGN + OTHER_FEATURE)
    for name in FOREIGN + OTHER_FEATURE:
        with pytest.raises(ValueError):
            owned.write(client, name, "rtsp://cam/x")
        with pytest.raises(ValueError):
            owned.delete(client, name)
        with pytest.raises(ValueError):
            owned.note_written(name)
    assert client.writes == [] and client.deletes == [] and sorted(client.store) == sorted(FOREIGN + OTHER_FEATURE)


def test_reconcile_deletes_only_its_own_unwanted_streams():
    owned = cam_owned()
    mine = ["smplwise_cam_keep_sub", "smplwise_cam_gone_sub", "smplwise_cam_gone_main_h264", "smplwise_cam_probe_x_sub"]
    client = FakeClient(FOREIGN + OTHER_FEATURE + mine)
    gone = owned.reconcile(client, lambda: {"smplwise_cam_keep_sub"}, grace_s=0.0)
    assert gone == ["smplwise_cam_gone_main_h264", "smplwise_cam_gone_sub"]
    assert all(n in client.store for n in FOREIGN + OTHER_FEATURE + ["smplwise_cam_keep_sub", "smplwise_cam_probe_x_sub"])


def test_reconcile_with_an_empty_wanted_set_still_leaves_every_foreign_stream():
    owned = g2.OwnedStreams(g2.HA_STREAM_PREFIX, re.compile(r"^smplwise_ha_[a-z0-9_]{1,100}$"))
    others = [n for n in OTHER_FEATURE if not n.startswith(g2.HA_STREAM_PREFIX)]
    client = FakeClient(FOREIGN + others + ["smplwise_ha_a", "smplwise_ha_UPPER", "smplwise_ha_"])
    assert owned.reconcile(client, set, grace_s=0.0) == ["smplwise_ha_a"]
    assert client.deletes == ["smplwise_ha_a"] and all(n in client.store for n in FOREIGN + others)


# ------------------------------------------------------------------------------------------- grace, second look, lock


def test_written_a_moment_ago_is_not_deleted():
    owned = cam_owned()
    client = FakeClient()
    assert owned.write(client, "smplwise_cam_new_sub", "rtsp://cam/x") == "created"
    assert owned.reconcile(client, set, grace_s=120.0) == [] and "smplwise_cam_new_sub" in client.store
    assert owned.reconcile(client, set, grace_s=0.0) == ["smplwise_cam_new_sub"] and "smplwise_cam_new_sub" not in client.store
    assert "smplwise_cam_new_sub" not in owned.written  # the note goes with the stream


def test_a_noted_write_is_protected_too_and_forget_lifts_it():
    owned = g2.OwnedStreams(lambda: "smplwise_pb_t9_")
    client = FakeClient(["smplwise_pb_t9_s1_g0"])
    owned.note_written("smplwise_pb_t9_s1_g0")
    assert owned.reconcile(client, set, grace_s=60.0) == []
    owned.forget("smplwise_pb_t9_s1_g0")
    assert owned.reconcile(client, set, grace_s=60.0) == ["smplwise_pb_t9_s1_g0"]


def test_reconcile_asks_wanted_again_right_before_each_delete():
    owned = cam_owned()
    client = FakeClient(["smplwise_cam_late_sub"])
    calls = []

    def wanted():
        calls.append(1)
        return set() if len(calls) == 1 else {"smplwise_cam_late_sub"}  # enabled just after the first look

    assert owned.reconcile(client, wanted, grace_s=0.0) == [] and "smplwise_cam_late_sub" in client.store and len(calls) == 2


def test_reconcile_waits_for_a_writer_that_holds_the_lock():
    owned = cam_owned()
    client = FakeClient(["smplwise_cam_stray_sub"])
    done = threading.Event()
    owned.lock.acquire()
    worker = threading.Thread(target=lambda: (owned.reconcile(client, set, grace_s=0.0), done.set()))
    try:
        worker.start()
        time.sleep(0.3)
        assert not done.is_set() and "smplwise_cam_stray_sub" in client.store
    finally:
        owned.lock.release()
    worker.join(10)
    assert done.is_set() and "smplwise_cam_stray_sub" not in client.store


def test_the_grace_is_read_under_the_lock():
    """A write that lands while reconcile waits for the lock is seen by the grace check (the camera-sources reconcile read it outside)."""
    owned = cam_owned()
    client = FakeClient(["smplwise_cam_race_sub"])
    owned.lock.acquire()
    worker = threading.Thread(target=lambda: owned.reconcile(client, set, grace_s=120.0))
    try:
        worker.start()
        time.sleep(0.2)
        owned.written["smplwise_cam_race_sub"] = time.monotonic()  # the writer holding the lock notes its write
    finally:
        owned.lock.release()
    worker.join(10)
    assert "smplwise_cam_race_sub" in client.store


def test_write_runs_before_inside_the_lock_and_a_refusal_writes_nothing():
    owned = cam_owned()
    client = FakeClient()
    held = []

    def before():
        held.append(owned.lock.locked())
        raise ApiError(404, "not_found", "x")

    with pytest.raises(ApiError):
        owned.write(client, "smplwise_cam_a_sub", "rtsp://cam/x", before=before)
    assert held == [True] and client.writes == [] and "smplwise_cam_a_sub" not in owned.written


def test_key_maps_a_transcoded_variant_to_its_base():
    owned = cam_owned()
    client = FakeClient(["smplwise_cam_a_sub", "smplwise_cam_a_sub_h264", "smplwise_cam_b_sub_h264"])
    base = lambda n: n[:-5] if n.endswith("_h264") else n  # noqa: E731
    assert owned.reconcile(client, lambda: {"smplwise_cam_a_sub"}, grace_s=0.0, key=base) == ["smplwise_cam_b_sub_h264"]


def test_a_go2rtc_failure_mid_way_reports_the_deletes_already_made():
    owned = cam_owned()
    client = FakeClient(["smplwise_cam_a_sub", "smplwise_cam_b_sub", "smplwise_cam_c_sub"])
    client.fail_delete_after = 1
    seen: list[str] = []
    with pytest.raises(ApiError):
        owned.reconcile(client, set, grace_s=0.0, on_deleted=seen.append)
    assert seen == ["smplwise_cam_a_sub"]


# ------------------------------------------------------------------------------------------- foreign sources


def test_names_foreign_stream_reads_the_first_segment_raw_decoded_and_normalised():
    names = ["door_1", "smplwise_nvr-1_ch1_sub", "smplwise_cam_a_sub"]
    assert g2.names_foreign_stream("rtsp://go2rtc:8554/door_1", names, "smplwise_cam_")
    assert g2.names_foreign_stream("rtsp://go2rtc:8554/DOOR_1?x=1", names, "smplwise_cam_")
    assert g2.names_foreign_stream("rtsp://go2rtc:8554/%2564oor_1", names, "smplwise_cam_")  # decoded twice
    assert g2.names_foreign_stream("rtsp://go2rtc:8554/x/../door_1", names, "smplwise_cam_")  # dot segments
    assert g2.names_foreign_stream("rtsp://go2rtc:8554/smplwise_nvr-1_ch1_sub", names, "smplwise_cam_")  # another feature's
    assert not g2.names_foreign_stream("rtsp://go2rtc:8554/smplwise_cam_a_sub", names, "smplwise_cam_")
    assert not g2.names_foreign_stream("rtsp://cam/x/door_1", names, "smplwise_cam_")  # only the first segment names a stream
    assert g2.names_foreign_stream("rtsp://[bad/door_1", names, "smplwise_cam_")  # does not parse: refused


def test_refuse_foreign_raises_the_feature_refusal():
    check = g2.refuse_foreign("rtsp://h:8554/intercom_front", "smplwise_ha_", lambda: ApiError(422, "source_not_allowed", "x"))
    check({"smplwise_ha_a": None})
    with pytest.raises(ApiError) as e:
        check({"intercom_front": None})
    assert e.value.code == "source_not_allowed"


def test_the_feature_modules_keep_their_rules_through_the_shared_helper():
    from smplwise.services import camera_sources as cs
    from smplwise.services import ha_camera_streams as hls
    from smplwise.services import playback as pb

    names = ["door_1", "smplwise_cam_a_sub", "smplwise_ha_b"]
    assert cs.names_foreign_stream("rtsp://h/smplwise_ha_b", names) and not cs.names_foreign_stream("rtsp://h/smplwise_cam_a_sub", names)
    assert hls.names_foreign_stream("rtsp://h/smplwise_cam_a_sub", names) and not hls.names_foreign_stream("rtsp://h/smplwise_ha_b", names)
    with pytest.raises(ApiError) as e:
        cs._refuse_foreign("rtsp://h/door_1")({"door_1": None})
    assert e.value.code == "source_not_allowed" and e.value.status == 422
    with pytest.raises(ApiError) as e:
        hls._refuse_foreign("rtsp://h/door_1")({"door_1": None})
    assert e.value.code == "source_not_allowed"
    # the old names are the helper's own lock and notes (tests and readers that use them see one state)
    assert cs._STREAM_LOCK is cs._OWNED.lock and cs._WRITTEN is cs._OWNED.written and cs._OWNED.shape_re is cs.STREAM_SHAPE_RE
    assert hls._STREAM_LOCK is hls._OWNED.lock and hls._WRITTEN is hls._OWNED.written and hls._OWNED.shape_re is hls.STREAM_SHAPE_RE
    assert pb._OWNED.prefix == pb.own_prefix()


def test_frigate_restream_check_keeps_the_whole_name_rule_and_gains_the_shared_one():
    from smplwise.services.recorders import frigate_restream as frs

    with pytest.raises(ApiError):
        frs.refuse_foreign("a/b")({"a/b": None})  # the whole-name comparison of before
    with pytest.raises(ApiError):
        frs.refuse_foreign("Door_1")({"door_1": None})
    frs.refuse_foreign("cam_front")({"smplwise_cam_front": None, "other": None})


# ------------------------------------------------------------------------------------------- delete by exact name


def test_delete_listed_deletes_only_listed_smplwise_names_the_caller_owns():
    client = FakeClient(FOREIGN + ["smplwise_nvr-2_ch1_sub", "smplwise_nvr-2_ch1_main", "smplwise_nvr-3_ch1_sub"])
    names = ["smplwise_nvr-2_ch1_sub", "smplwise_nvr-2_ch1_main", "smplwise_nvr-2_ch2_sub", "door_1", "intercom_front"]
    assert g2.delete_listed(client, names, lambda n: n.startswith(g2.STREAM_PREFIX)) == 2
    assert client.deletes == ["smplwise_nvr-2_ch1_sub", "smplwise_nvr-2_ch1_main"]
    assert all(n in client.store for n in FOREIGN + ["smplwise_nvr-3_ch1_sub"])
    # an `owns` that would accept anything still cannot reach a foreign name
    assert g2.delete_listed(client, ["door_1"], lambda n: True) == 0 and "door_1" in client.store
    assert g2.delete_listed(client, [], lambda n: True) == 0


def test_recorder_live_delete_streams_goes_through_the_shared_helper(monkeypatch):
    from types import SimpleNamespace

    from smplwise.services import recorder_live as rl

    client = FakeClient(["door_1", "smplwise_nvr-2_ch1_sub"])
    monkeypatch.setattr(rl.g2, "Go2rtc", lambda _s: client)
    s = SimpleNamespace(go2rtc_url="http://go2rtc.invalid:1984")
    assert rl.delete_streams(s, ["smplwise_nvr-2_ch1_sub", "door_1"]) == 1 and client.store == {"door_1": ["rtsp://x"]}
    assert rl.delete_streams(SimpleNamespace(go2rtc_url=None), ["smplwise_nvr-2_ch1_sub"]) == 0


# ------------------------------------------------------------------------------------------- playback sweep


def test_playback_sweep_leaves_a_generation_written_a_moment_ago_and_other_instances(monkeypatch):
    from types import SimpleNamespace

    from smplwise.services import playback as pb

    prev = pb._INSTANCE["id"]
    pb.set_instance_id("t7")
    pb.REGISTRY.sessions.clear()
    client = FakeClient(["smplwise_pb_t7_fresh_g0", "smplwise_pb_t7_dead_g0", "smplwise_pb_other_x_g0", "pb_legacy", "door_1"])
    monkeypatch.setattr(pb.g2, "Go2rtc", lambda _s: client)
    s = SimpleNamespace(go2rtc_url="http://go2rtc.invalid:1984")
    try:
        pb._OWNED.written.clear()
        pb._OWNED.note_written("smplwise_pb_t7_fresh_g0")  # created; its session has not recorded `stream` yet
        assert pb.sweep_orphans(s) == ["smplwise_pb_t7_dead_g0"]
        assert sorted(client.store) == ["door_1", "pb_legacy", "smplwise_pb_other_x_g0", "smplwise_pb_t7_fresh_g0"]
        pb._delete_stream(s, "smplwise_pb_t7_fresh_g0")  # a closed session: the note goes, the stream goes
        assert "smplwise_pb_t7_fresh_g0" not in pb._OWNED.written and "smplwise_pb_t7_fresh_g0" not in client.store
    finally:
        pb._OWNED.written.clear()
        pb._INSTANCE["id"] = prev


# ------------------------------------------------------------------------------------------- F10: the probe grab


def test_camera_sources_probe_grab_is_the_adapters_grab_probe():
    from smplwise.services import camera_sources as cs

    calls = []

    class Client:
        def grab_probe(self, name, src, timeout_s=15.0):
            calls.append((name, src, timeout_s))
            return 200, b"\xff\xd8\xff", ""

    assert cs._grab_probe(Client(), "smplwise_cam_probe_ab", "rtsp://cam/x") == (200, b"\xff\xd8\xff", "")
    assert calls == [("smplwise_cam_probe_ab", "rtsp://cam/x", 15.0)]
