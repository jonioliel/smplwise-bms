"""CAM-H264-VERIFY-2361: after a bulk encoding change, verify per stream at the NVR and at the MEDIA layer (what the camera really sends,
go2rtc's stream probe - read-only), report it per channel with the batch (reopenable, with a worklist and a read-only re-check), and the
refusal policy "skip and continue" (default) / "stop" (docs/changes/CAM-H264-VERIFY-2361.md).

Fake devices only (tests/fixtures/fake_devices.py: the fake NVR and the fake go2rtc): nothing here reaches a real NVR or go2rtc. Every
write in these tests is the existing approved NVR path behind the existing switch; the verification itself writes nothing to a device."""
from __future__ import annotations

import dataclasses
import json
import sys

from pathlib import Path

import pytest
from conftest import as_user, bind
from fastapi.testclient import TestClient
from nvr_batch_helpers import audits, camera_ids, details, make_app, puts, quiet_alert_stream, ready, wait_done, with_nvr  # noqa: F401

from smplwise import recorder_scope
from smplwise.db import now_iso
from smplwise.services import go2rtc as g2
from smplwise.services import nvr_batch, nvr_verify

sys.path.insert(0, str(Path(__file__).resolve().parent / "fixtures"))
from fake_devices import GO2RTC_HOST, FakeDevices  # noqa: E402
from nvr_batch_helpers import setup_fake  # noqa: E402

PREVIEW = "/api/v1/nvr/encoding-batches/preview"
START = "/api/v1/nvr/encoding-batches"
H264 = {"codec": "H.264"}
GO2RTC_URL = f"http://{GO2RTC_HOST}:1984"


def sname(ch: int, role: str = "main") -> str:
    return f"smplwise_nvr-1_ch{ch}_{role}"


@pytest.fixture()
def fast(monkeypatch):
    monkeypatch.setattr(nvr_batch, "UNKNOWN_CHECK_DELAY_S", 0.0)
    monkeypatch.setattr(nvr_verify, "SETTLE_S", 0.0)
    monkeypatch.setattr(nvr_verify, "PROBE_GAP_S", 0.0)
    monkeypatch.setattr(nvr_verify, "RECHECK_MIN_S", 0.0)
    monkeypatch.setattr(nvr_verify, "LIVE_COUNT", lambda: 0)


@pytest.fixture()
def fake(monkeypatch) -> FakeDevices:
    f = FakeDevices()
    f.install(monkeypatch)
    setup_fake(f)  # mains 1-4 H.264, main 5 H.265; subs H.264
    for ch in (1, 2, 3):
        f.nvr["encodings_by_channel"].setdefault(ch, {})["main"] = {"codec": "H.265", "profile": "Main", "svc": True}
    for ch in range(1, 6):
        for role in ("main", "sub"):
            f.go2rtc["streams"][sname(ch, role)] = False  # our streams exist in go2rtc (no producer connected)
    return f


def _app(settings, go2rtc: bool):
    return make_app(dataclasses.replace(settings, go2rtc_url=GO2RTC_URL if go2rtc else None))


@pytest.fixture()
def vw(settings, fake, fast):
    app = _app(settings, True)
    with TestClient(app) as c:
        ready(app, 5)
        quiet_alert_stream()
        yield app, c, fake, camera_ids(app)
    assert nvr_batch.wait_idle(10) and nvr_verify.wait_idle(10)
    recorder_scope.WRITES.pop("nvr-1", None)


@pytest.fixture()
def nogo(settings, fake, fast):
    app = _app(settings, False)
    with TestClient(app) as c:
        ready(app, 5)
        quiet_alert_stream()
        yield app, c, fake, camera_ids(app)
    assert nvr_batch.wait_idle(10)


def mains(ids, chans) -> list[dict]:
    return [{"camera_id": ids[ch], "stream_ref": f"{ch}01"} for ch in chans]


def planned(body: dict) -> list[dict]:
    return [{"camera_id": i["camera_id"], "stream_ref": i["stream_ref"], "if_match": i["if_match"], "changes": i["changes"]} for i in body["items"] if i["status"] == "change"]


def run(c: TestClient, tg: list[dict], **extra) -> dict:
    p = c.post(PREVIEW, json={"settings": H264, "targets": tg})
    assert p.status_code == 200, p.text
    r = c.post(START, json={"confirm": True, "settings": H264, "targets": planned(p.json()), **extra})
    assert r.status_code == 202, r.text
    return wait_done(c, r.json()["batch_id"])


def by_ref(body: dict) -> dict[str, dict]:
    return {i["stream_ref"]: i for i in body["items"]}


def go2rtc_writes(fake, since: int = 0) -> list[str]:
    return [w for w in fake.writes[since:] if w.startswith("go2rtc")]


# ------------------------------------------------------------------------------------------------ the media check

def test_accepted_by_the_nvr_but_the_camera_still_sends_h265_is_reported_and_listed(vw):
    app, c, fake, ids = vw
    fake.go2rtc["media_codec"] = {sname(2): "h265"}  # the NVR takes the change; camera 2 keeps sending H.265
    writes_before = len(fake.writes)
    body = run(c, mains(ids, (1, 2, 3)))
    assert body["state"] == "completed" and [i["status"] for i in body["items"]] == ["applied"] * 3, "the NVR read-back accepted all three"
    it = by_ref(body)
    assert (it["101"]["verify"]["outcome"], it["101"]["verify"]["label"]) == ("confirmed", "המצלמה אישרה (H.264)")
    assert (it["201"]["verify"]["outcome"], it["201"]["verify"]["label"]) == ("still_old", "עדיין H.265")
    assert it["201"]["verify"]["media_codec"] == "H.265" and it["201"]["verify"]["nvr"] == "applied"
    assert it["301"]["verify"]["outcome"] == "confirmed"
    v = body["verify"]
    assert v["state"] == "done" and v["counts"]["confirmed"] == 2 and v["counts"]["still_old"] == 1
    assert [w["stream_ref"] for w in v["worklist"]] == ["201"] and v["can_recheck"] is True
    assert sorted(fake.go2rtc["probes"]) == sorted([sname(1), sname(2), sname(3)]), "one probe per changed stream, by our name"
    assert go2rtc_writes(fake, writes_before) == [], "the media check never creates, changes or deletes a go2rtc stream"
    assert puts(fake) == ["101", "201", "301"], "no write beyond the confirmed plan"


def test_a_probe_that_cannot_answer_is_not_checked_and_never_confirmed(vw):
    app, c, fake, ids = vw
    fake.go2rtc["probe"] = False  # a go2rtc without the probe: the stream answers without a codec
    body = run(c, mains(ids, (1,)))
    v = by_ref(body)["101"]["verify"]
    assert (v["outcome"], v["label"], v["media"], v["media_reason"]) == ("nvr_accepted", "המקליט קיבל", "not_checked", "no_codec")
    fake.go2rtc["probe"] = True
    fake.go2rtc["up"] = False  # go2rtc down
    body = run(c, mains(ids, (2,)))
    v = by_ref(body)["201"]["verify"]
    assert (v["outcome"], v["media"]) == ("nvr_accepted", "not_checked") and v["media_reason"] in ("unavailable", "media_not_configured")


def test_without_go2rtc_the_report_says_the_nvr_accepted(nogo):
    app, c, fake, ids = nogo
    body = run(c, mains(ids, (1,)))
    v = by_ref(body)["101"]["verify"]
    assert (v["outcome"], v["media_reason"]) == ("nvr_accepted", "media_not_configured") and "go2rtc" in v["detail"]
    assert fake.go2rtc["probes"] == []


def test_the_probe_respects_the_live_session_cap(vw, monkeypatch):
    app, c, fake, ids = vw
    monkeypatch.setattr(nvr_verify, "LIVE_COUNT", lambda: 10_000)  # every live slot is taken
    monkeypatch.setattr(nvr_verify, "SLOT_WAIT_S", 0.0)
    body = run(c, mains(ids, (1,)))
    v = by_ref(body)["101"]["verify"]
    assert (v["outcome"], v["media_reason"]) == ("nvr_accepted", "busy")
    assert fake.go2rtc["probes"] == [], "no RTSP session is opened while the live sessions are at the cap"


def test_reboot_required_and_an_old_live_session_need_a_restart(vw):
    app, c, fake, ids = vw
    fake.nvr["put_by_stream"] = {"101": "reboot"}  # Hikvision statusCode 7: applied, reboot required
    fake.go2rtc["media_codec"] = {sname(1): "h265"}
    fake.go2rtc["viewers"] = {sname(2): "h265"}  # somebody watches camera 2: the live session predates the change
    body = run(c, mains(ids, (1, 2, 3)))
    it = by_ref(body)
    assert it["101"]["reboot_required"] is True
    assert (it["101"]["verify"]["outcome"], it["101"]["verify"]["reason"], it["101"]["verify"]["label"]) == ("restart_needed", "reboot_required", "צריך אתחול")
    assert (it["201"]["verify"]["outcome"], it["201"]["verify"]["reason"], it["201"]["verify"]["reconnect"]) == ("restart_needed", "reconnect", True)
    assert it["301"]["verify"]["outcome"] == "confirmed"
    assert {w["stream_ref"] for w in body["verify"]["worklist"]} == {"101", "201"}


# ------------------------------------------------------------------------------------------------ refusal policy

def test_a_refused_camera_is_skipped_by_default_and_the_batch_continues(vw):
    app, c, fake, ids = vw
    fake.nvr["put_by_stream"] = {"201": "notsupport"}  # the NVR does not pass the change to camera 2
    body = run(c, mains(ids, (1, 2, 3)))
    assert (body["state"], body["on_refusal"], body["skipped"]) == ("completed", "skip", 1)
    assert [(i["status"], i["error_code"], i["skipped"]) for i in body["items"]] == [("applied", None, False), ("refused", "nvr_not_supported", True), ("applied", None, False)]
    assert puts(fake) == ["101", "201", "301"] and [fake._encoding(ch, "main")["codec"] for ch in (1, 2, 3)] == ["H.264", "H.265", "H.264"]
    v = by_ref(body)["201"]["verify"]
    assert v["outcome"] == "failed" and v["label"].startswith("נכשל: ") and v["skipped"] is True and "דולג" in v["detail"]
    assert [s["stream_ref"] for s in body["verify"]["skipped"]] == ["201"]
    skips = [details(a) for a in audits(app, "nvr.stream.batch") if details(a).get("phase") == "skip"]
    assert len(skips) == 1 and skips[0]["stream_ref"] == "201" and skips[0]["code"] == "nvr_not_supported"
    att = [details(a) for a in audits(app, "nvr.stream.batch") if details(a).get("phase") == "attempt"]
    assert att[-1]["on_refusal"] == "skip"


def test_stop_policy_from_the_setting_or_the_start_keeps_the_s2c_rule(vw):
    app, c, fake, ids = vw
    fake.nvr["put_by_stream"] = {"201": "notsupport"}
    assert c.patch("/api/v1/settings", json={"nvr.batch_on_refusal": "stop"}).status_code == 200
    body = run(c, mains(ids, (1, 2, 3)))
    assert (body["state"], body["stopped_reason"], body["on_refusal"]) == ("failed", "item_failed", "stop")
    assert [i["status"] for i in body["items"]] == ["applied", "refused", "not_attempted"] and body["skipped"] == 0
    assert by_ref(body)["301"]["verify"]["outcome"] == "failed"
    # the start's own choice wins over the setting
    for ch in (1,):
        fake.nvr["encodings_by_channel"][ch]["main"] = {"codec": "H.265", "profile": "Main", "svc": True}
    body = run(c, mains(ids, (1, 2, 3)), on_refusal="skip")
    assert body["state"] == "completed" and body["on_refusal"] == "skip" and body["skipped"] == 1
    r = c.post(START, json={"confirm": True, "settings": H264, "targets": [], "on_refusal": "maybe"})
    assert r.status_code == 422


def test_a_busy_nvr_or_the_switch_turned_off_mid_batch_still_stops(vw):
    app, c, fake, ids = vw
    fake.nvr["put_by_stream"] = {"201": "busy"}
    body = run(c, mains(ids, (1, 2, 3)))
    assert (body["state"], [i["status"] for i in body["items"]]) == ("failed", ["applied", "refused", "not_attempted"]), "a busy NVR is not one camera's refusal"
    fake.nvr["put_by_stream"] = {}

    def switch_off(_request) -> None:
        recorder_scope.set_writes_override("nvr-1", False)

    fake.nvr["on_put"] = switch_off  # the switch goes off while the first stream is written
    for ch in (1,):
        fake.nvr["encodings_by_channel"][ch]["main"] = {"codec": "H.265", "profile": "Main", "svc": True}
    p = c.post(PREVIEW, json={"settings": H264, "targets": mains(ids, (1, 2, 3))}).json()
    r = c.post(START, json={"confirm": True, "settings": H264, "targets": planned(p)})
    body = wait_done(c, r.json()["batch_id"])
    assert body["state"] == "failed" and body["skipped"] == 0
    assert [i["status"] for i in body["items"]][1:] == ["refused", "not_attempted"], "writes off is never skipped"


# ------------------------------------------------------------------------------------------------ rollback

def test_rollback_after_a_partial_batch_restores_only_what_changed_and_is_verified(vw):
    app, c, fake, ids = vw
    fake.nvr["put_by_stream"] = {"201": "notsupport"}
    body = run(c, mains(ids, (1, 2, 3)))
    assert body["skipped"] == 1 and body["can_rollback"] is True
    fake.nvr["put_by_stream"] = {"101": "notsupport"}  # the undo of camera 1 is refused this time
    u = c.post(f"/api/v1/nvr/stream-batches/{body['batch_id']}/rollback", json={"confirm": True})
    assert u.status_code == 202, u.text
    undone = wait_done(c, u.json()["batch_id"])
    assert (undone["state"], undone["kind"], undone["mode"], undone["skipped"]) == ("completed", "rollback", "encoding", 1)
    assert puts(fake)[3:] == ["301", "101"], "reverse order; the skipped stream 201 was never changed, so never undone"
    assert [fake._encoding(ch, "main")["codec"] for ch in (1, 2, 3)] == ["H.264", "H.265", "H.265"]
    uv = by_ref(undone)
    assert (uv["301"]["verify"]["outcome"], uv["301"]["verify"]["label"]) == ("confirmed", "המצלמה אישרה (H.265)")
    assert uv["101"]["verify"]["outcome"] == "failed" and uv["101"]["skipped"] is True
    src = c.get(f"/api/v1/nvr/stream-batches/{body['batch_id']}").json()
    assert src["can_rollback"] is True and [i["status"] for i in src["items"]] == ["applied", "refused", "rolled_back"]
    fake.nvr["put_by_stream"] = {}
    again = wait_done(c, c.post(f"/api/v1/nvr/stream-batches/{body['batch_id']}/rollback", json={"confirm": True}).json()["batch_id"])
    assert again["state"] == "completed" and [i["stream_ref"] for i in again["items"]] == ["101"], "a second undo retries exactly the stream still changed"
    assert [fake._encoding(ch, "main")["codec"] for ch in (1, 2, 3)] == ["H.265"] * 3


# ------------------------------------------------------------------------------------------------ the report kept + re-check

def test_the_report_is_kept_with_the_batch_and_the_recheck_is_read_only(vw):
    app, c, fake, ids = vw
    fake.go2rtc["media_codec"] = {sname(2): "h265"}
    body = run(c, mains(ids, (1, 2, 3)))
    bid = body["batch_id"]
    with app.state.db.connection(mode="read") as conn:
        stored = nvr_verify.load(conn, bid)
    assert stored is not None and stored["state"] == "done" and len(stored["items"]) == 3, "the report is stored with the batch"
    blob = json.dumps(stored)
    assert "fake-password" not in blob and "rtsp://" not in blob and "reader" not in blob, "no credential, user or address in the report"
    again = c.get(f"/api/v1/nvr/stream-batches/{bid}").json()
    assert again["verify"]["worklist"] == body["verify"]["worklist"], "reopened later: the same report"
    listed = c.get("/api/v1/nvr/stream-batches").json()["batches"]
    assert any(b["batch_id"] == bid and b["mode"] == "encoding" for b in listed)
    # the camera follows later (changed in its own UI): a re-check reads it - and writes nothing
    fake.go2rtc["media_codec"] = {}
    put_n, writes_n, probes_n = len(puts(fake)), len(fake.writes), len(fake.go2rtc["probes"])
    r = c.post(f"/api/v1/nvr/stream-batches/{bid}/verify")
    assert r.status_code == 202, r.text
    assert nvr_verify.wait_idle(10)
    after = c.get(f"/api/v1/nvr/stream-batches/{bid}").json()
    assert (by_ref(after)["201"]["verify"]["outcome"], after["verify"]["kind"], after["verify"]["worklist"]) == ("confirmed", "recheck", [])
    assert by_ref(after)["201"]["verify"]["nvr_now"] == "H.264", "the re-check read the NVR's stream list"
    assert len(puts(fake)) == put_n and go2rtc_writes(fake, writes_n) == [], "read-only: no NVR PUT, no go2rtc write"
    assert fake.go2rtc["probes"][probes_n:] == [sname(2)], "only the worklist is probed again"
    r = c.post(f"/api/v1/nvr/stream-batches/{bid}/verify")
    assert (r.status_code, r.json()["code"]) == (409, "nothing_to_verify")
    allowed = [details(a) for a in audits(app, "nvr.stream.batch.verify") if a["decision"] == "allowed"]
    assert allowed == [{"batch_id": bid, "items": 1}]


def test_recheck_is_rate_limited_and_only_for_encoding_batches(vw, monkeypatch):
    app, c, fake, ids = vw
    monkeypatch.setattr(nvr_verify, "RECHECK_MIN_S", 600.0)
    fake.go2rtc["media_codec"] = {sname(1): "h265"}
    body = run(c, mains(ids, (1,)))
    r = c.post(f"/api/v1/nvr/stream-batches/{body['batch_id']}/verify")
    assert (r.status_code, r.json()["code"]) == (429, "verify_too_soon")
    assert c.post("/api/v1/nvr/stream-batches/0123456789abcdef/verify").status_code == 404
    assert c.post("/api/v1/nvr/stream-batches/not-an-id/verify").status_code == 404
    # an SVC batch (phase C) has no media check
    from nvr_batch_helpers import start as svc_start
    from nvr_batch_helpers import targets as svc_targets

    for ch in (4, 5):
        fake.nvr["encodings_by_channel"].setdefault(ch, {})["main"] = {"codec": "H.264", "svc": True, "profile": "High"}
    s = svc_start(c, svc_targets(c, ids, (4, 5)))
    assert s.status_code == 202, s.text
    sb = wait_done(c, s.json()["batch_id"])
    assert sb["verify"] is None and sb["on_refusal"] == "stop"
    r = c.post(f"/api/v1/nvr/stream-batches/{sb['batch_id']}/verify")
    assert (r.status_code, r.json()["code"]) == (409, "verify_not_available")


def _role(app, c, settings, user: str, perms: list[str]) -> None:
    with app.state.db.connection() as conn:
        conn.execute("INSERT INTO custom_roles(id, name_he, permissions_json, created_at, updated_at) VALUES (?, ?, ?, ?, ?)",
                     (f"r_{user}", f"r_{user}", json.dumps(perms), now_iso(), now_iso()))
    bind(c, with_nvr(settings), user, f"r_{user}", "installation", "*")


def test_recheck_and_report_need_nvr_configure(vw, settings):
    app, c, fake, ids = vw
    fake.go2rtc["media_codec"] = {sname(1): "h265"}
    body = run(c, mains(ids, (1,)))
    bid = body["batch_id"]
    _role(app, c, settings, "cfg", ["system.configure"])
    _role(app, c, settings, "nvrw", ["nvr.configure"])
    for user in ("cfg",):
        assert c.get(f"/api/v1/nvr/stream-batches/{bid}", headers=as_user(user)).status_code == 403
        r = c.post(f"/api/v1/nvr/stream-batches/{bid}/verify", headers=as_user(user))
        assert r.status_code == 403, r.text
    assert fake.go2rtc["probes"] == [sname(1)], "a refused re-check probes nothing"
    r = c.post(f"/api/v1/nvr/stream-batches/{bid}/verify", headers=as_user("nvrw"))
    assert r.status_code == 202, r.text
    assert nvr_verify.wait_idle(10)


def test_the_refusal_setting_is_validated_and_defaults_to_skip(vw):
    app, c, fake, ids = vw
    assert c.get("/api/v1/settings").json()["settings"]["nvr.batch_on_refusal"] == "skip"
    assert c.patch("/api/v1/settings", json={"nvr.batch_on_refusal": "maybe"}).status_code == 422
    assert c.patch("/api/v1/settings", json={"nvr.batch_on_refusal": "stop"}).status_code == 200
    p = c.post(PREVIEW, json={"settings": H264, "targets": mains(ids, (1,))}).json()
    assert p["on_refusal"] == "stop", "the preview names the default the confirmation shows"


# ------------------------------------------------------------------------------------------------ pure pieces

def _row(**kw):
    base = {"id": "c1", "batch_index": 0, "camera_id": "cam", "stream_ref": "101", "status": "applied", "error": None, "reboot_required": 0,
            "fields_json": json.dumps({"codec": ["H.265", "H.264"]})}
    base.update(kw)
    return base


class _R(dict):
    def keys(self):  # sqlite3.Row-like
        return super().keys()


@pytest.mark.parametrize("row, media, outcome", [
    (_row(), nvr_verify.Media("h264"), "confirmed"),
    (_row(), nvr_verify.Media("h265"), "still_old"),
    (_row(), nvr_verify.Media("h265", preexisting=True), "restart_needed"),
    (_row(reboot_required=1), nvr_verify.Media("h265"), "restart_needed"),
    (_row(reboot_required=1), nvr_verify.Media("h264"), "confirmed"),
    (_row(), nvr_verify.Media(None, "unavailable"), "nvr_accepted"),
    (_row(), None, "nvr_accepted"),
    (_row(status="refused", error="nvr_not_supported"), nvr_verify.Media("h264"), "failed"),
    (_row(status="no_effect", error="no_effect"), None, "failed"),
    (_row(status="not_attempted", error="earlier_failure"), None, "failed"),
    (_row(status="unchanged"), None, "unchanged"),
    (_row(fields_json=json.dumps({"bitrate_kbps": [1024, 2048]})), None, "nvr_accepted"),
])
def test_assess(row, media, outcome):
    rec = nvr_verify.assess(_R(row), skipped=False, media=media)
    assert rec["outcome"] == outcome
    assert rec["label"] and "rtsp" not in json.dumps(rec)


def test_role_of_and_probe_names():
    assert nvr_verify.role_of("101", {}) == "main" and nvr_verify.role_of("1202", {}) == "sub" and nvr_verify.role_of("7", {}) is None
    assert nvr_verify.role_of("7", {"7": "sub"}) == "sub"
    client = g2.Go2rtc.__new__(g2.Go2rtc)
    client.base, client.auth = GO2RTC_URL, None
    for bad in ("intercom_door_1", "smplwise_ha_front", "smplwise_x/../y"):
        with pytest.raises(ValueError):
            client.probe_video_codec(bad)


def test_the_probe_sends_a_name_only(fake):
    client = g2.Go2rtc.__new__(g2.Go2rtc)
    client.base, client.auth = GO2RTC_URL, None
    assert client.probe_video_codec(sname(1)) == (True, "h265")
    assert client.probe_video_codec("smplwise_nvr-1_ch99_main") == (False, None)
    probes = [h for h in fake.hits if "fake-go2rtc" in h]
    assert probes and all(h.endswith("GET /api/streams") for h in probes)
    assert "smplwise_nvr-1_ch99_main" not in fake.go2rtc["streams"], "a probe never creates a stream"

