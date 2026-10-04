"""CR-020 phase D: one encoding change on many streams ("set every camera to H.264") against the fake NVR - the read-only
preview (before -> after, adjusted values, skips with the reason, zero writes), the start (confirm first, re-planned from a
fresh read: stale / plan_changed refuse with zero writes), the phase C runner reused (one camera at a time, main and sub
streams, stop at the first failure, the unknown-outcome rule, undo-all as a reversed batch), the device lock, permissions,
the remote channel and no leaks. Fakes only; nothing touches a real device."""
from __future__ import annotations

import json
import sys
from pathlib import Path

import pytest
from conftest import as_user, bind
from fastapi.testclient import TestClient
from nvr_batch_helpers import SECRETS, audits, batch_rows, camera_ids, details, fast_unknown, make_app, puts, ready, rows, setup_fake, wait_done, wait_put, with_nvr  # noqa: F401

from smplwise.routers import nvr_batch as batch_router
from smplwise.services import nvr_batch

sys.path.insert(0, str(Path(__file__).resolve().parent / "fixtures"))
from fake_devices import FakeDevices  # noqa: E402

PREVIEW = "/api/v1/nvr/encoding-batches/preview"
START = "/api/v1/nvr/encoding-batches"


@pytest.fixture()
def fake(monkeypatch) -> FakeDevices:
    f = FakeDevices()
    f.install(monkeypatch)
    setup_fake(f)  # mains 1-4 H.264 High 2560x1440 SVC on; main 5 H.265 Main; subs H.264 Baseline 640x360 CBR
    return f


@pytest.fixture()
def ew(settings, fake, fast_unknown):
    app = make_app(settings)
    with TestClient(app) as c:
        ready(app, 5)
        yield app, c, fake, camera_ids(app)
    assert nvr_batch.wait_idle(10)


def refs(ids: dict[int, str], chans, kinds=("01",)) -> list[dict]:
    return [{"camera_id": ids[ch], "stream_ref": f"{ch}{k}"} for ch in chans for k in kinds]


def preview(c: TestClient, settings: dict, tg: list[dict], headers: dict | None = None):
    return c.post(PREVIEW, json={"settings": settings, "targets": tg}, headers=headers or {})


def planned(body: dict) -> list[dict]:
    """The start targets from a preview: every stream with a change, exactly as shown."""
    return [{"camera_id": i["camera_id"], "stream_ref": i["stream_ref"], "if_match": i["if_match"], "changes": i["changes"]} for i in body["items"] if i["status"] == "change"]


def start(c: TestClient, settings: dict, tg: list[dict], headers: dict | None = None, **body):
    return c.post(START, json={"confirm": True, "settings": settings, "targets": tg, **body}, headers=headers or {})


def run(c: TestClient, settings: dict, tg: list[dict]) -> dict:
    p = preview(c, settings, tg)
    assert p.status_code == 200, p.text
    r = start(c, settings, planned(p.json()))
    assert r.status_code == 202, r.text
    return wait_done(c, r.json()["batch_id"])


def enc(fake, ch: int, kind: str = "main") -> dict:
    return fake._encoding(ch, kind)


# ------------------------------------------------------------------------------------------------ preview

def test_preview_plans_every_stream_with_before_after_adjustments_and_skips_and_writes_nothing(ew):
    app, c, fake, ids = ew
    fake.nvr["caps_status_by_stream"] = {"302": {"direct": 404, "proxy": 404}}  # one stream without a capability document
    hits = len(fake.writes)
    r = preview(c, {"codec": "H.265", "svc": False}, refs(ids, (1, 2, 3, 5), ("01", "02")))
    assert r.status_code == 200, r.text
    body = r.json()
    by = {i["stream_ref"]: i for i in body["items"]}
    # an H.264 High main: codec + the profile H.265 needs (shown as adjusted) + SVC off
    m1 = by["101"]
    assert m1["status"] == "change" and m1["role"] == "main" and len(m1["if_match"]) == 16
    assert m1["changes"] == {"codec": "H.265", "profile": "Main", "svc": False}
    assert m1["fields"] == {"codec": ["H.264", "H.265"], "profile": ["High", "Main"], "svc": [True, False]}
    assert [(n["kind"], n["field"], n["reason"]) for n in m1["notes"]] == [("adjusted", "profile", "profile_codec")]
    assert m1["before"]["codec"] == "H.264" and m1["before"]["resolution"] == "2560x1440"
    # a sub: no SVC element (kept, with a note); its 640x360 is not offered: the closest offered resolution
    s1 = by["102"]
    assert s1["status"] == "change" and s1["changes"] == {"codec": "H.265", "profile": "Main", "resolution": "1280x720"}
    assert ("kept", "svc", "not_in_stream") in [(n["kind"], n["field"], n["reason"]) for n in s1["notes"]]
    # the H.265 main 5 only needs SVC off; the stream without capabilities is skipped with its reason
    assert by["501"]["changes"] == {"svc": False}
    assert (by["302"]["status"], by["302"]["reason"], by["302"]["changes"]) == ("skip", "not_writable", {})
    assert by["302"]["message"]
    assert body["counts"] == {"change": 7, "unchanged": 0, "skip": 1}
    assert body["changes_total"] == sum(len(i["fields"]) for i in body["items"] if i["status"] == "change")
    assert body["adjusted"] >= 4 and body["batch_in_progress"] is False
    assert len(fake.writes) == hits and puts(fake) == [], "the preview never writes"
    a = audits(app, "nvr.stream.batch.preview")
    assert len(a) == 1 and a[0]["decision"] == "allowed" and details(a[0])["counts"] == body["counts"] and details(a[0])["mode"] == "encoding"


def test_preview_uses_the_codec_specific_resolution_list(ew):
    app, c, fake, ids = ew
    fake.nvr["dynamic_cap"] = {"H.264": ["1920x1080", "1280x720"]}
    body = preview(c, {"codec": "H.264"}, refs(ids, (5,))).json()
    item = body["items"][0]
    assert item["changes"] == {"codec": "H.264", "resolution": "1920x1080"}, "H.264 does not offer 2560x1440 on this camera: the closest"
    assert [(n["field"], n["reason"]) for n in item["notes"]] == [("resolution", "codec_resolution")]


def test_preview_offline_camera_and_unchanged_stream(ew):
    app, c, fake, ids = ew
    fake.nvr["offline"] = [2]
    body = preview(c, {"codec": "H.264"}, refs(ids, (1, 2, 5))).json()
    assert [(i["stream_ref"], i["status"], i["reason"]) for i in body["items"]] == [("101", "unchanged", None), ("201", "skip", "offline"), ("501", "change", None)]


def test_preview_refuses_bad_settings_and_unknown_cameras_with_zero_device_reads(ew):
    app, c, fake, ids = ew
    before = len(fake.hits)
    for bad, code in (({"profile": "High"}, "batch_field_not_allowed"), ({"codec": "MJPEG"}, "validation"), ({}, "validation")):
        r = preview(c, bad, refs(ids, (1,)))
        assert (r.status_code, r.json()["code"]) == (422, code)
    r = preview(c, {"codec": "H.264"}, [{"camera_id": "nope", "stream_ref": "101"}])
    assert r.status_code in (403, 404)
    assert len([h for h in fake.hits[before:] if "/ISAPI/" in h]) == 0
    assert all(a["decision"] == "denied" for a in audits(app, "nvr.stream.batch.preview"))


# ------------------------------------------------------------------------------------------------ start + run

def test_all_cameras_to_h264_main_and_sub_one_at_a_time_then_undo_all(ew):
    app, c, fake, ids = ew
    for ch in (1, 2):
        fake.nvr["encodings_by_channel"].setdefault(ch, {})["main"] = {"codec": "H.265", "profile": "Main", "svc": True}
    settings = {"codec": "H.264", "bitrate_kbps": 99999, "gop": 25}
    body = run(c, settings, refs(ids, (1, 2, 3, 4, 5), ("01", "02")))
    assert (body["state"], body["mode"], body["settings"]) == ("completed", "encoding", settings)
    # mains 1, 2, 5 switch codec; every stream gets the clamped bitrate (16384 = the device max) and GOP 25
    assert [enc(fake, ch)["codec"] for ch in (1, 2, 3, 4, 5)] == ["H.264"] * 5
    assert {enc(fake, ch).get("gop") for ch in (1, 2, 3, 4, 5)} == {25} and {enc(fake, ch, "sub").get("gop") for ch in (1, 2, 3, 4, 5)} == {25}
    assert {enc(fake, ch).get("bitrate_kbps") for ch in (1, 2, 3, 4, 5)} == {16384}
    assert puts(fake) == ["101", "102", "201", "202", "301", "302", "401", "402", "501", "502"], "one stream at a time, in the confirmed order"
    items = body["items"]
    assert all(i["status"] == "applied" for i in items) and items[0]["fields"]["codec"] == ["H.265", "H.264"]
    att = details(audits(app, "nvr.stream.batch")[0])
    assert (att["phase"], att["mode"], att["settings"], att["total"]) == ("attempt", "encoding", settings, 10)
    assert {"codec", "bitrate_kbps", "gop"} <= set(att["fields"])
    # undo-all: a NEW batch in reverse order, one confirmation, everything back
    u = c.post(f"/api/v1/nvr/stream-batches/{body['batch_id']}/rollback", json={"confirm": True})
    assert u.status_code == 202, u.text
    undone = wait_done(c, u.json()["batch_id"])
    assert (undone["state"], undone["kind"], undone["mode"]) == ("completed", "rollback", "encoding")
    assert puts(fake)[10:] == ["502", "501", "402", "401", "302", "301", "202", "201", "102", "101"]
    assert [enc(fake, ch)["codec"] for ch in (1, 2, 3, 4, 5)] == ["H.265", "H.265", "H.264", "H.264", "H.265"]
    assert enc(fake, 3).get("gop") == 50 and enc(fake, 3).get("bitrate_kbps") == 3072


def test_a_camera_that_refuses_stops_the_batch_and_the_rest_is_not_attempted(ew):
    app, c, fake, ids = ew
    fake.nvr["put_fail_at"] = 2  # the second PUT: the device is busy
    body = run(c, {"codec": "H.265"}, refs(ids, (1, 2, 3, 4)))
    assert (body["state"], body["stopped_reason"]) == ("failed", "item_failed")
    assert [(i["status"], i["error_code"]) for i in body["items"]] == [("applied", None), ("refused", "nvr_busy"), ("not_attempted", "earlier_failure"), ("not_attempted", "earlier_failure")]
    assert puts(fake) == ["101", "201"] and enc(fake, 3)["codec"] == "H.264"


@pytest.mark.parametrize("applies, state, statuses", [
    (True, "completed", ["applied", "applied", "applied"]),
    (False, "interrupted", ["applied", "failed", "not_attempted"]),
])
def test_unknown_outcome_continues_only_when_a_read_proves_the_whole_change(ew, applies, state, statuses):
    app, c, fake, ids = ew
    fake.nvr["put_unknown_at"] = 2
    fake.nvr["timeout_applies"] = applies
    body = run(c, {"codec": "H.265", "gop": 30}, refs(ids, (1, 2, 3)))
    assert body["state"] == state
    assert [i["status"] for i in body["items"]] == statuses
    checks = [details(a) for a in audits(app, "nvr.stream.batch") if details(a).get("phase") == "check"]
    assert len(checks) == 1 and checks[0]["continue"] is applies


def test_a_timeout_before_the_put_is_a_refusal_and_never_unknown(ew, monkeypatch):
    app, c, fake, ids = ew
    monkeypatch.setattr(nvr_batch, "ITEM_DEADLINE_S", 0.0)  # the item's deadline has passed before anything is sent
    body = run(c, {"codec": "H.265"}, refs(ids, (1, 2)))
    assert (body["state"], body["stopped_reason"]) == ("interrupted", "deadline")
    assert [(i["status"], i["error_code"]) for i in body["items"]] == [("refused", "source_timeout"), ("not_attempted", "interrupted")]
    assert puts(fake) == []


def test_a_locked_field_is_kept_and_never_written(ew):
    app, c, fake, ids = ew
    fake.nvr["encodings_by_channel"].setdefault(1, {})["main"] = {"smart": True}
    p = preview(c, {"gop": 100, "codec": "H.265"}, refs(ids, (1, 2))).json()
    by = {i["stream_ref"]: i for i in p["items"]}
    assert "gop" not in by["101"]["changes"] and ("kept", "gop", "locked_smart") in [(n["kind"], n["field"], n["reason"]) for n in by["101"]["notes"]]
    assert by["201"]["changes"]["gop"] == 100
    r = start(c, {"gop": 100, "codec": "H.265"}, planned(p))
    body = wait_done(c, r.json()["batch_id"])
    assert body["state"] == "completed" and enc(fake, 1).get("gop", 50) == 50 and enc(fake, 2)["gop"] == 100
    assert "<GovLength>100</GovLength>" not in fake.nvr["put_bodies"][0]


# ------------------------------------------------------------------------------------------------ start refusals (zero writes)

def test_start_refuses_stale_and_a_changed_plan_and_a_missing_confirm_with_zero_writes(ew):
    app, c, fake, ids = ew
    p = preview(c, {"codec": "H.265"}, refs(ids, (1, 2))).json()
    tg = planned(p)
    r = c.post(START, json={"confirm": "true", "settings": {"codec": "H.265"}, "targets": tg})
    assert (r.status_code, r.json()["code"]) == (422, "confirm_required")
    tampered = [{**tg[0], "changes": {"codec": "H.265"}}, tg[1]]  # without the profile the preview showed
    r = start(c, {"codec": "H.265"}, tampered)
    assert (r.status_code, r.json()["code"], r.json()["details"]["index"]) == (409, "plan_changed", 0)
    fake.nvr["encodings_by_channel"].setdefault(2, {})["main"] = {"gop": 77}  # someone changed camera 2 on the NVR meanwhile
    r = start(c, {"codec": "H.265"}, tg)
    assert (r.status_code, r.json()["code"], r.json()["details"]["index"]) == (409, "stale", 1)
    r = start(c, {"codec": "H.264"}, tg)  # settings under which these streams are no change at all
    assert (r.status_code, r.json()["code"]) in ((422, "batch_target_not_allowed"), (409, "stale"))
    assert puts(fake) == [] and batch_rows(app, "x") == []
    assert rows(app, "SELECT COUNT(*) AS n FROM nvr_changes")[0]["n"] == 0
    denied = [a for a in audits(app, "nvr.stream.batch") if a["decision"] == "denied"]
    assert {a["reason"] for a in denied} >= {"confirm_required", "plan_changed", "stale"}


def test_single_writes_and_another_batch_are_refused_while_an_encoding_batch_runs(ew):
    app, c, fake, ids = ew
    fake.nvr["put_hold_s"] = 1.0
    p = preview(c, {"codec": "H.265"}, refs(ids, (1, 2, 3))).json()
    r = start(c, {"codec": "H.265"}, planned(p))
    assert r.status_code == 202
    wait_put(fake, 1)
    s4 = next(s for s in c.get(f"/api/v1/nvr/cameras/{ids[4]}").json()["camera"]["streams"] if s["stream_ref"] == "401")
    single = c.put(f"/api/v1/nvr/cameras/{ids[4]}/streams/401", json={"if_match": s4["etag"], "confirm": True, "changes": {"svc": False}})
    assert (single.status_code, single.json()["code"]) == (409, "batch_in_progress")
    second = start(c, {"codec": "H.265"}, planned(preview(c, {"codec": "H.265"}, refs(ids, (4,))).json()))
    assert (second.status_code, second.json()["code"]) == (409, "batch_in_progress")
    assert preview(c, {"codec": "H.265"}, refs(ids, (4,))).json()["batch_in_progress"] is True
    wait_done(c, r.json()["batch_id"])


# ------------------------------------------------------------------------------------------------ permissions, remote, leaks

def test_without_nvr_configure_no_preview_and_no_start_and_one_camera_deny_refuses_all(ew, settings):
    app, c, fake, ids = ew
    s = with_nvr(settings)
    bind(c, s, "sam", "site_admin", "installation", "*")
    p = preview(c, {"codec": "H.265"}, refs(ids, (1, 2))).json()
    hits = len(fake.hits)
    for path, body in ((PREVIEW, {"settings": {"codec": "H.265"}, "targets": refs(ids, (1,))}), (START, {"confirm": True, "settings": {"codec": "H.265"}, "targets": planned(p)})):
        r = c.post(path, json=body, headers=as_user("sam"))
        assert r.status_code == 403, r.text
        r = c.post(path, content=b"{not json", headers={**as_user("sam"), "Content-Type": "application/json"})
        assert r.status_code == 403, "permission before the body"
    assert len(fake.hits) == hits and puts(fake) == []
    # a system administrator with a deny on one camera: the whole preview and the whole start are refused, before any device read
    from smplwise.db import new_id, now_iso, permission_revision

    c.get("/api/v1/me", headers=as_user("ron"))
    with app.state.db.connection() as conn:
        for scope_type, scope_id, effect in (("installation", "*", "allow"), ("camera", ids[2], "deny")):
            conn.execute("INSERT INTO bindings(id, subject_kind, subject_id, role_id, scope_type, scope_id, effect, permission_revision, assigned_by, created_at)"
                         " VALUES (?, 'user', 'dev-ron', 'system_admin', ?, ?, ?, ?, 'test', ?)", (new_id(), scope_type, scope_id, effect, permission_revision(conn), now_iso()))
    assert preview(c, {"codec": "H.265"}, refs(ids, (1, 2)), headers=as_user("ron")).status_code == 403
    assert start(c, {"codec": "H.265"}, planned(p), headers=as_user("ron")).status_code == 403
    assert len(fake.hits) == hits and puts(fake) == []
    assert preview(c, {"codec": "H.265"}, refs(ids, (1, 3)), headers=as_user("ron")).status_code == 200


def test_the_routes_are_local_only_and_an_encoding_undo_is_refused_remotely(ew, monkeypatch):
    from smplwise import remote_channel

    app, c, fake, ids = ew
    assert "/api/v1/nvr/encoding-batches" in remote_channel.BLOCKED_ON_REMOTE
    body = run(c, {"codec": "H.265"}, refs(ids, (1, 2)))
    monkeypatch.setattr(batch_router, "is_remote", lambda request: True)
    r = c.post(f"/api/v1/nvr/stream-batches/{body['batch_id']}/rollback", json={"confirm": True})
    assert r.status_code == 404
    monkeypatch.setattr(batch_router, "is_remote", lambda request: False)
    r = c.post(f"/api/v1/nvr/stream-batches/{body['batch_id']}/rollback", json={"confirm": True})
    assert r.status_code == 202
    wait_done(c, r.json()["batch_id"])


def test_no_address_or_credential_in_any_answer_audit_or_row(ew):
    app, c, fake, ids = ew
    p = preview(c, {"codec": "H.265", "resolution": "1920x1080"}, refs(ids, (1, 2), ("01", "02")))
    body = run(c, {"codec": "H.265", "resolution": "1920x1080"}, refs(ids, (1, 2), ("01", "02")))
    texts = [p.text, json.dumps(body), json.dumps(audits(app, "nvr.stream.batch")), json.dumps(audits(app, "nvr.stream.batch.preview")),
             json.dumps([{k: v for k, v in r.items() if k not in ("before_xml", "after_xml")} for r in batch_rows(app, body["batch_id"])])]
    for t in texts:
        for secret in SECRETS:
            assert secret not in t
    assert [h for h in fake.hits if "go2rtc" in h and "PUT" in h] == [], "no go2rtc write on an encoding change"
