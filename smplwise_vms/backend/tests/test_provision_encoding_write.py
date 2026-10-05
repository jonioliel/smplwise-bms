"""CR-025 NN2B: Provision-ISR encoding writes (single stream and bulk) - FAKE DEVICE ONLY. No real NVR is contacted: every
request goes to `fake_provision.FakeProvision` on httpx's transport.

Covers: v1 whole-`streams` write and v2 partial write chosen by the device's own GetSupportedAPIs, the value validation
against GetStreamCaps, the support gate (`nvr_not_supported`, per-stream `writable` after validation, R2 per-channel refusal
tolerated), stale / diverged / no_effect / unknown outcomes, never retried, the bulk preview + batch + undo-all on a Provision
recorder, one recorder per batch, audit rows, and the capability data that hides SVC / B-frame controls."""
from __future__ import annotations

import json
import sys
import time
from pathlib import Path

import pytest
from fastapi.testclient import TestClient
from nvr_batch_helpers import audits, details, fast_unknown, wait_done  # noqa: F401
from test_provision_isr_p2 import fake, make, writer  # noqa: F401 - the shared fixture and constructors

from smplwise.errors import ApiError
from smplwise.services import nvr_batch
from smplwise.services.recorders import provision_isr as pisr
from smplwise.services.recorders import registry

sys.path.insert(0, str(Path(__file__).resolve().parent / "fixtures"))
from fake_provision import settings_for  # noqa: E402

PREVIEW = "/api/v1/nvr/encoding-batches/preview"
START = "/api/v1/nvr/encoding-batches"
V2_APIS = ["GetSupportedAPIs", "GetStreamCaps", "GetVideoStreamConfig", "SetVideoStreamConfig"]


def lines(fake) -> list[str]:
    return fake.set_bodies


# ------------------------------------------------------------------------------------------------ adapter: write modes

def test_v1_device_gets_the_whole_streams_element(settings, fake):
    a = writer(settings, fake)
    assert a.supported_apis() is None and a.write_mode() == "whole"
    snap = a.read_stream("101")
    a.write_stream_encoding("101", snap.etag, a.stream_document(snap.element, {"gop": 60}), "direct")
    assert fake.set_bodies[0].count("<item id=") == 3 and fake.writes == ["SetVideoStreamConfig"]


def test_v2_device_gets_one_item_with_only_the_changed_fields(settings, fake):
    fake.supported_apis = V2_APIS
    a = writer(settings, fake)
    assert a.write_mode() == "partial"
    snap = a.read_stream("101")
    out = a.write_stream_encoding("101", snap.etag, a.stream_document(snap.element, {"gop": 60, "bitrate_kbps": 2048}), "direct")
    body = fake.set_bodies[0]
    assert body.count("<item id=") == 1 and "<GOP>60</GOP>" in body and "<maxBitRate>2048</maxBitRate>" in body
    for untouched in ("resolution", "frameRate", "encodeType", "quality", "bitRateType", "name"):
        assert f"<{untouched}>" not in body, untouched
    assert (out.verified.parsed["gop"], out.verified.parsed["bitrate_kbps"]) == (60, 2048)
    assert a.read_stream("102").parsed["bitrate_kbps"] == 512, "siblings never sent"


def test_v2_write_with_no_difference_sends_nothing(settings, fake):
    fake.supported_apis = V2_APIS
    a = writer(settings, fake)
    snap = a.read_stream("101")
    out = a.write_stream_encoding("101", snap.etag, a.stream_document(snap.element, {"gop": 50}), "direct")
    assert out.device_status == "unchanged" and fake.writes == []


def test_stream_write_can_be_forced_by_the_connection(settings, fake):
    a = writer(settings, fake, stream_write="partial")
    snap = a.read_stream("101")
    a.write_stream_encoding("101", snap.etag, a.stream_document(snap.element, {"gop": 60}), "direct")
    assert fake.set_bodies[0].count("<item id=") == 1


# ------------------------------------------------------------------------------------------------ adapter: validation

@pytest.mark.parametrize("changes, field", [
    ({"resolution": "1280x720"}, "resolution"),       # not listed in this stream's GetStreamCaps
    ({"bitrate_kbps": 70000}, "bitrate_kbps"),        # above the stream's own max (8192)
    ({"bitrate_kbps": 10}, "bitrate_kbps"),           # below its min (64)
    ({"gop": 5}, "gop"),                              # below the main stream's min (25)
    ({"gop": 5000}, "gop"),
    ({"codec": "MJPEG"}, "codec"),                    # the main stream's caps list h264 / h265 only
])
def test_values_outside_the_device_documents_are_refused_before_a_request(settings, fake, changes, field):
    a = writer(settings, fake)
    snap = a.read_stream("101")
    try:
        item = a.stream_document(snap.element, changes)
    except ApiError as exc:  # refused while the document is built: nothing was sent either
        assert exc.code == "value_not_allowed"
        assert fake.writes == []
        return
    with pytest.raises(ApiError) as e:
        a.write_stream_encoding("101", snap.etag, item, "direct")
    assert e.value.code == "value_not_allowed" and e.value.details["field"] == field and fake.writes == []


def test_svc_and_b_frames_are_not_writable_on_provision(settings, fake):
    a = writer(settings, fake)
    snap = a.read_stream("101")
    for name in ("svc", "b_frames"):
        with pytest.raises(ApiError) as e:
            a.stream_document(snap.element, {name: True})
        assert e.value.code == "value_not_allowed"
    opts = a.stream_options("101")
    assert opts.options["svc"] is False and opts.options["b_frames"] is False
    assert {"svc", "b_frames"} <= set(snap.parsed["fields"]) and snap.parsed["fields"]["svc"] == {"supported": False, "editable": False}


# ------------------------------------------------------------------------------------------------ adapter: support gate

def test_a_v2_device_without_the_write_command_is_not_writable_and_refuses_cleanly(settings, fake):
    fake.supported_apis = ["GetSupportedAPIs", "GetStreamCaps", "GetVideoStreamConfig"]
    a = writer(settings, fake)
    opts = a.stream_options("101")
    assert (opts.writable, opts.reason, opts.write_via) == (False, "write_api_missing", None) and opts.options is not None
    snap = a.read_stream("101")
    with pytest.raises(ApiError) as e:
        a.write_stream_encoding("101", snap.etag, a.stream_document(snap.element, {"gop": 60}), "direct")
    assert (e.value.status, e.value.code, e.value.details["reason"]) == (409, "nvr_not_supported", "write_api_missing") and fake.writes == []


def test_no_capability_document_means_not_writable_and_nothing_is_sent(settings, fake):
    a = writer(settings, fake)
    snap = a.read_stream("101")
    item = a.stream_document(snap.element, {"gop": 60})
    fake.caps_missing = {1}
    a2 = writer(settings, fake)
    opts = a2.stream_options("101")
    assert (opts.writable, opts.reason, opts.options) == (False, "capabilities_unreadable", None)
    with pytest.raises(ApiError) as e:
        a2.write_stream_encoding("101", snap.etag, item, "direct")
    assert e.value.code == "nvr_not_supported" and e.value.details["reason"] == "no_caps" and fake.writes == []
    assert writer(settings, fake).stream_options("201").writable is True, "another channel keeps its own answer"


@pytest.mark.parametrize("code", [1, 4])
def test_a_refusal_for_one_channel_is_remembered_and_leaves_the_others_writable(settings, fake, code):
    fake.set_refused = {1: code}
    a = writer(settings, fake)
    snap = a.read_stream("101")
    with pytest.raises(ApiError) as e:
        a.write_stream_encoding("101", snap.etag, a.stream_document(snap.element, {"gop": 60}), "direct")
    assert (e.value.status, e.value.code, e.value.details["reason"]) == (409, "nvr_not_supported", "device_refused")
    assert fake.writes == ["SetVideoStreamConfig"], "never retried"
    again = writer(settings, fake).stream_options("101")
    assert (again.writable, again.reason) == (False, "device_refused")
    assert writer(settings, fake).stream_options("201").writable is True
    writes = len(fake.writes)
    with pytest.raises(ApiError):
        a.write_stream_encoding("101", snap.etag, a.stream_document(snap.element, {"gop": 70}), "direct")
    assert len(fake.writes) == writes, "the remembered refusal blocks further attempts before a request"


def test_a_channel_the_nvr_will_not_read_is_left_out_not_fatal(settings, fake):
    fake.video_refused = {2}
    a = writer(settings, fake)
    got = a.read_stream_encodings()
    assert "1" in got and "2" not in got


def test_a_login_refusal_still_stops_the_encoding_read(settings, fake):
    import dataclasses

    pisr.clear_auth_cache()
    a = pisr.ProvisionIsrAdapter("nvr-3", dataclasses.replace(settings_for(settings, writes_enabled=True), nvr_password="wrong"), transport=fake.transport())
    with pytest.raises(ApiError) as e:
        a.read_stream_encodings()
    assert e.value.code in ("source_forbidden", "nvr_not_configured")


def test_rejected_values_busy_device_and_unknown_outcome_are_never_retried(settings, fake):
    a = writer(settings, fake)
    snap = a.read_stream("101")
    item = a.stream_document(snap.element, {"gop": 60})
    for code, expect in ((3, "nvr_rejected"), (7, "nvr_busy")):
        fake.fail["SetVideoStreamConfig"] = code
        fake.writes.clear()
        with pytest.raises(ApiError) as e:
            a.write_stream_encoding("101", snap.etag, item, "direct")
        assert e.value.code == expect and fake.writes == ["SetVideoStreamConfig"], code
    del fake.fail["SetVideoStreamConfig"]
    fake.set_after = "drop"
    fake.writes.clear()
    with pytest.raises(ApiError) as e:
        a.write_stream_encoding("101", snap.etag, item, "direct")
    assert e.value.details["outcome"] == "unknown" and e.value.retryable is False and fake.writes == ["SetVideoStreamConfig"]


def test_a_change_made_on_the_device_meanwhile_is_stale_and_nothing_is_sent(settings, fake):
    a = writer(settings, fake)
    snap = a.read_stream("101")
    item = a.stream_document(snap.element, {"gop": 60})
    fake._state(1)[1]["GOP"] = "75"  # someone changed the stream on the NVR itself
    with pytest.raises(ApiError) as e:
        a.write_stream_encoding("101", snap.etag, item, "direct")
    assert e.value.code == "stale" and fake.writes == []


# ------------------------------------------------------------------------------------------------ app: single stream route

def wait_cameras(app, n: int) -> dict[int, str]:
    deadline = time.monotonic() + 25
    while time.monotonic() < deadline:
        with app.state.db.connection(mode="read") as conn:
            rows = conn.execute("SELECT id, channel, capabilities_json FROM cameras WHERE recorder_id = 'nvr-1'").fetchall()
        if len(rows) >= n and all("encoding" in (r["capabilities_json"] or "") for r in rows):
            time.sleep(0.2)
            return {int(r["channel"]): r["id"] for r in rows}
        time.sleep(0.05)
    raise AssertionError("discovery did not finish")


@pytest.fixture()
def pw(settings, fake, monkeypatch, fast_unknown):
    """An app whose primary recorder is the fake Provision NVR with writes enabled; channels 1-3 online."""
    from smplwise.main import create_app

    fake.channels = {1: "online", 2: "online", 3: "online"}
    fake.install(monkeypatch)
    monkeypatch.setitem(registry.VENDORS, "provision_isr", pisr.ProvisionIsrAdapter)
    s = settings_for(settings, writes_enabled=True, auth="basic", osd_names=False)
    app = create_app(s)
    with TestClient(app) as c:
        yield app, c, fake, wait_cameras(app, 3), s
    assert nvr_batch.wait_idle(10)


def etag(c: TestClient, cid: str, ref: str) -> str:
    r = c.get(f"/api/v1/nvr/cameras/{cid}")
    assert r.status_code == 200, r.text
    return next(s for s in r.json()["camera"]["streams"] if s["stream_ref"] == ref)["etag"]


def test_detail_declares_writable_per_stream_and_carries_the_data_that_hides_svc_and_b_frames(pw):
    app, c, fake, ids, s = pw
    fake.caps_missing = set()
    r = c.get(f"/api/v1/nvr/cameras/{ids[1]}")
    body = r.json()
    for st in body["camera"]["streams"]:
        assert st["writable"] is True and st["not_writable_reason"] is None
        assert st["svc"] is None and st["b_frames"] is None
        assert st["fields"]["svc"] == {"supported": False, "editable": False} and st["fields"]["b_frames"]["supported"] is False
        o = body["options"][st["stream_ref"]]
        assert o["svc"] is False and o["b_frames"] is False
        assert {"codec", "resolution", "fps", "bitrate_mode", "bitrate_kbps", "quality", "gop"} <= {k for k, v in o.items() if v}


def test_detail_declares_a_refused_stream_not_writable_with_its_reason(pw):
    app, c, fake, ids, s = pw
    fake.set_refused = {2: 4}
    snap = pisr.ProvisionIsrAdapter("nvr-1", s).read_stream("201")
    r = c.put(f"/api/v1/nvr/cameras/{ids[2]}/streams/201", json={"if_match": snap.etag, "confirm": True, "changes": {"gop": 60}})
    assert (r.status_code, r.json()["code"]) == (409, "nvr_not_supported"), r.text
    assert fake.writes == ["SetVideoStreamConfig"]
    body = c.get(f"/api/v1/nvr/cameras/{ids[2]}").json()
    refused = {x["stream_ref"]: (x["writable"], x["not_writable_reason"]) for x in body["camera"]["streams"]}
    assert refused and all(v == (False, "device_refused") for v in refused.values()), refused
    other = c.get(f"/api/v1/nvr/cameras/{ids[1]}").json()
    assert all(x["writable"] for x in other["camera"]["streams"])
    # a second attempt is refused by the gate: no second request reaches the device
    r2 = c.put(f"/api/v1/nvr/cameras/{ids[2]}/streams/201", json={"if_match": snap.etag, "confirm": True, "changes": {"gop": 70}})
    assert r2.status_code == 409 and r2.json()["code"] == "nvr_not_supported" and fake.writes == ["SetVideoStreamConfig"]
    # audited both times
    assert len(audits(app, "nvr.stream.write")) >= 3


def test_route_refuses_svc_and_b_frames_for_provision(pw):
    app, c, fake, ids, s = pw
    et = etag(c, ids[1], "101")
    for name in ("svc", "b_frames"):
        r = c.put(f"/api/v1/nvr/cameras/{ids[1]}/streams/101", json={"if_match": et, "confirm": True, "changes": {name: True}})
        assert r.status_code in (409, 422), r.text
    assert fake.writes == []


def test_route_diverged_readback_is_reported_and_never_retried(pw):
    app, c, fake, ids, s = pw
    fake.set_effect = "partial"  # the device applies only the first changed field
    et = etag(c, ids[1], "101")
    r = c.put(f"/api/v1/nvr/cameras/{ids[1]}/streams/101", json={"if_match": et, "confirm": True, "changes": {"gop": 60, "bitrate_kbps": 2048}})
    assert r.status_code == 409 and r.json()["code"] == "nvr_diverged", r.text
    assert fake.writes == ["SetVideoStreamConfig"]
    assert r.json()["code"] == "nvr_diverged"
    with app.state.db.connection(mode="read") as conn:
        assert conn.execute("SELECT status FROM nvr_changes ORDER BY created_at DESC LIMIT 1").fetchone()["status"] == "diverged"


def test_route_no_effect_when_the_device_accepts_and_ignores(pw):
    app, c, fake, ids, s = pw
    fake.set_effect = "ignore"
    et = etag(c, ids[1], "101")
    r = c.put(f"/api/v1/nvr/cameras/{ids[1]}/streams/101", json={"if_match": et, "confirm": True, "changes": {"gop": 60}})
    assert (r.status_code, r.json()["code"]) == (409, "nvr_no_effect") and fake.writes == ["SetVideoStreamConfig"]


def test_route_v2_partial_write_applies_and_the_undo_restores_it(pw):
    app, c, fake, ids, s = pw
    fake.supported_apis = V2_APIS
    pisr.clear_auth_cache()
    et = etag(c, ids[1], "101")
    r = c.put(f"/api/v1/nvr/cameras/{ids[1]}/streams/101", json={"if_match": et, "confirm": True, "changes": {"bitrate_kbps": 2048}})
    assert r.status_code == 200, r.text
    assert fake.set_bodies[-1].count("<item id=") == 1 and "<maxBitRate>2048</maxBitRate>" in fake.set_bodies[-1]
    u = c.post(f"/api/v1/nvr/changes/{r.json()['change']['id']}/rollback", json={"confirm": True})
    assert u.status_code == 201, u.text
    assert pisr.ProvisionIsrAdapter("nvr-1", s).read_stream("101").parsed["bitrate_kbps"] == 3072
    assert "<maxBitRate>3072</maxBitRate>" in fake.set_bodies[-1] and fake.set_bodies[-1].count("<item id=") == 1


# ------------------------------------------------------------------------------------------------ app: bulk encoding

def refs(ids: dict[int, str], chans, kinds=("01",)) -> list[dict]:
    return [{"camera_id": ids[ch], "stream_ref": f"{ch}{k}"} for ch in chans for k in kinds]


def planned(body: dict) -> list[dict]:
    return [{"camera_id": i["camera_id"], "stream_ref": i["stream_ref"], "if_match": i["if_match"], "changes": i["changes"]} for i in body["items"] if i["status"] == "change"]


def device(fake, ch: int, sid: int) -> dict:
    return fake._state(ch)[sid]


def test_bulk_preview_plans_without_writing_and_skips_what_cannot_be_written(pw):
    app, c, fake, ids, s = pw
    fake.caps_missing = {3}
    target = {"codec": "H.264", "gop": 30, "bitrate_kbps": 2048}
    r = c.post(PREVIEW, json={"settings": target, "targets": refs(ids, (1, 2, 3), ("01", "02"))})
    assert r.status_code == 200, r.text
    body = r.json()
    by = {i["stream_ref"]: i for i in body["items"]}
    assert by["101"]["status"] == "change" and by["101"]["changes"]["codec"] == "H.264" and by["101"]["changes"]["gop"] == 30
    assert by["102"]["status"] == "change" and by["102"]["changes"] == {"gop": 30, "bitrate_kbps": 2048}
    assert by["301"]["status"] == "skip" and by["301"]["reason"] in ("capabilities_unreadable", "not_found") and by["301"]["message"]
    assert fake.writes == [], "the preview never writes"
    assert details(audits(app, "nvr.stream.batch.preview")[0])["mode"] == "encoding"


def test_bulk_batch_one_stream_at_a_time_audited_then_undo_all(pw):
    app, c, fake, ids, s = pw
    target = {"gop": 30, "bitrate_kbps": 2048}
    p = c.post(PREVIEW, json={"settings": target, "targets": refs(ids, (1, 2), ("01", "02"))}).json()
    r = c.post(START, json={"confirm": True, "settings": target, "targets": planned(p)})
    assert r.status_code == 202, r.text
    done = wait_done(c, r.json()["batch_id"])
    assert (done["state"], done["mode"]) == ("completed", "encoding") and all(i["status"] == "applied" for i in done["items"])
    assert fake.writes == ["SetVideoStreamConfig"] * 4 and [b.count("<item id=") for b in fake.set_bodies] == [3, 3, 3, 3]
    assert [device(fake, ch, sid)["GOP"] for ch in (1, 2) for sid in (1, 2)] == ["30"] * 4
    assert device(fake, 3, 1)["GOP"] == "50", "a camera that was not selected is untouched"
    att = details(audits(app, "nvr.stream.batch")[0])
    assert (att["phase"], att["mode"], att["total"]) == ("attempt", "encoding", 4)
    u = c.post(f"/api/v1/nvr/stream-batches/{done['batch_id']}/rollback", json={"confirm": True})
    assert u.status_code == 202, u.text
    back = wait_done(c, u.json()["batch_id"])
    assert (back["state"], back["kind"]) == ("completed", "rollback")
    assert [device(fake, ch, sid)["GOP"] for ch in (1, 2) for sid in (1, 2)] == ["50", "12", "50", "12"]
    assert device(fake, 1, 1)["maxBitRate"] == "3072" and device(fake, 1, 2)["maxBitRate"] == "512"


def test_bulk_batch_v2_sends_partial_items_per_stream(pw):
    app, c, fake, ids, s = pw
    fake.supported_apis = V2_APIS
    pisr.clear_auth_cache()
    target = {"gop": 40}
    p = c.post(PREVIEW, json={"settings": target, "targets": refs(ids, (1, 2))}).json()
    r = c.post(START, json={"confirm": True, "settings": target, "targets": planned(p)})
    assert r.status_code == 202, r.text
    done = wait_done(c, r.json()["batch_id"])
    assert done["state"] == "completed"
    assert [b.count("<item id=") for b in fake.set_bodies] == [1, 1] and all("<GOP>40</GOP>" in b and "<frameRate>" not in b for b in fake.set_bodies)


def test_bulk_batch_stops_at_a_refusing_camera_and_the_next_preview_skips_it(pw):
    app, c, fake, ids, s = pw
    fake.set_refused = {2: 4}  # R2: the NVR does not pass writes to channel 2
    target = {"gop": 30}
    p = c.post(PREVIEW, json={"settings": target, "targets": refs(ids, (1, 2, 3))}).json()
    r = c.post(START, json={"confirm": True, "settings": target, "targets": planned(p)})
    assert r.status_code == 202, r.text
    done = wait_done(c, r.json()["batch_id"])
    assert done["state"] == "failed"
    assert [(i["status"], i["error_code"]) for i in done["items"]] == [("applied", None), ("refused", "nvr_not_supported"), ("not_attempted", "earlier_failure")]
    assert fake.writes == ["SetVideoStreamConfig", "SetVideoStreamConfig"], "channel 3 was never attempted, channel 2 never retried"
    p2 = c.post(PREVIEW, json={"settings": {"gop": 31}, "targets": refs(ids, (1, 2, 3))}).json()
    st = {i["stream_ref"]: (i["status"], i["reason"]) for i in p2["items"]}
    assert st["201"] == ("skip", "device_refused") and st["101"][0] == "change" and st["301"][0] == "change"
    assert next(i for i in p2["items"] if i["stream_ref"] == "201")["message"]


def test_bulk_batch_never_mixes_recorders(pw):
    app, c, fake, ids, s = pw
    with app.state.db.connection() as conn:
        conn.execute("INSERT INTO recorders (id, name, created_at) VALUES ('nvr-9', 'other', '2026-10-05T00:00:00Z')")
        row = conn.execute("SELECT * FROM cameras WHERE id = ?", (ids[3],)).fetchone()
        cols = [k for k in row.keys() if k not in ("id",)]
        vals = [("nvr-9" if k == "recorder_id" else row[k]) for k in cols]
        conn.execute(f"INSERT INTO cameras (id, {', '.join(cols)}) VALUES ('cam-other', {', '.join('?' for _ in cols)})", vals)
    tg = [{"camera_id": ids[1], "stream_ref": "101"}, {"camera_id": "cam-other", "stream_ref": "301"}]
    r = c.post(PREVIEW, json={"settings": {"gop": 30}, "targets": tg})
    assert r.status_code == 422, r.text
    r = c.post(START, json={"confirm": True, "settings": {"gop": 30}, "targets": [{**t, "if_match": "0" * 16, "changes": {"gop": 30}} for t in tg]})
    assert r.status_code == 422 and fake.writes == []


def test_no_address_or_password_leaks_from_any_write_answer_or_audit(pw):
    app, c, fake, ids, s = pw
    fake.set_refused = {1: 4}
    et = etag(c, ids[1], "101")
    r = c.put(f"/api/v1/nvr/cameras/{ids[1]}/streams/101", json={"if_match": et, "confirm": True, "changes": {"gop": 60}})
    blob = r.text + json.dumps([dict(a) for a in audits(app, "nvr.stream.write")], default=str)
    from fake_provision import HOST, PASSWORD, USER
    for secret in (HOST, PASSWORD, USER, "FAKESERIAL0001", "00:00:5E:00:53:01"):
        assert secret not in blob, secret
