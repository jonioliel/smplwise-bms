"""CR-020 S2 (S2-02, S2-06..S2-08, S2-12): the guarded single-stream write `PUT /api/v1/nvr/cameras/{id}/streams/{ref}`
against the fake NVR - permission (`nvr.configure`, a system permission) and camera scope first, the literal `confirm: true`
before any device read, validation against the device's options, the etag guard, the two-phase change record with its
attempt / outcome audit rows, the codec-registry refresh, every device outcome of API 5.2, and no collateral (no go2rtc call,
no other device write, no address or credential anywhere). AT-020-06..11, AT-020-15."""
from __future__ import annotations

import dataclasses
import json
import sys
import time
from pathlib import Path

import httpx
import pytest
from conftest import as_user, bind
from fastapi.testclient import TestClient

from smplwise.db import new_id, now_iso, permission_revision
from smplwise.main import create_app
from smplwise.services import nvr, stream_codecs

sys.path.insert(0, str(Path(__file__).resolve().parent / "fixtures"))
from fake_devices import NVR_HOST, FakeDevices  # noqa: E402

SECRETS = (NVR_HOST, "fake-password", "reader", "http://")


def with_nvr(settings, **extra):
    return dataclasses.replace(settings, nvr_host=NVR_HOST, nvr_user="reader", nvr_password="fake-password", **extra)


@pytest.fixture()
def fake(monkeypatch) -> FakeDevices:
    f = FakeDevices()
    f.install(monkeypatch)
    f.nvr["channels"] = 3
    f.nvr["encodings"] = {"main": {"codec": "H.264", "svc": True, "width": 2560, "height": 1440, "bitrate_kbps": 3072, "quality": 60, "fps": 25, "bitrate_mode": "VBR", "profile": "High"},
                          "sub": {"codec": "H.264", "svc": None, "width": 640, "height": 360, "bitrate_kbps": 512, "bitrate_mode": "CBR", "fps": 20, "profile": "Baseline"}}
    f.nvr["encodings_by_channel"] = {2: {"main": {"codec": "H.265", "svc": True, "profile": "Main"}}}
    return f


def ready(app, channels: int = 3) -> None:
    """Wait for the start-up discovery (a background task) to write every camera row with its codec registry entry, so its
    device reads never interleave with what a test counts."""
    deadline = time.monotonic() + 20
    while time.monotonic() < deadline:
        with app.state.db.connection(mode="read") as conn:
            rows = conn.execute("SELECT capabilities_json FROM cameras WHERE recorder_id = 'nvr-1'").fetchall()
        if len(rows) >= channels and all("encoding" in (r["capabilities_json"] or "") for r in rows):
            time.sleep(0.2)
            return
        time.sleep(0.05)
    raise AssertionError("start-up discovery did not finish")


def camera_ids(app) -> dict[int, str]:
    with app.state.db.connection(mode="read") as conn:
        return {int(r["channel"]): r["id"] for r in conn.execute("SELECT id, channel FROM cameras WHERE recorder_id = 'nvr-1'").fetchall()}


@pytest.fixture()
def w(settings, fake):
    app = create_app(with_nvr(settings))
    with TestClient(app) as c:
        ready(app)
        yield app, c, fake, camera_ids(app)


def stream(c: TestClient, cid: str, ref: str, headers: dict | None = None) -> dict:
    r = c.get(f"/api/v1/nvr/cameras/{cid}", headers=headers or {})
    assert r.status_code == 200, r.text
    return next(s for s in r.json()["camera"]["streams"] if s["stream_ref"] == ref)


def put(c: TestClient, cid: str, ref: str, changes: dict, etag: str | None = None, headers: dict | None = None, **body) -> httpx.Response:
    payload = {"if_match": etag if etag is not None else stream(c, cid, ref)["etag"], "confirm": True, "changes": changes, **body}
    return c.put(f"/api/v1/nvr/cameras/{cid}/streams/{ref}", json=payload, headers=headers or {})


def rows(app, sql: str, *args) -> list[dict]:
    with app.state.db.connection(mode="read") as conn:
        return [dict(r) for r in conn.execute(sql, args).fetchall()]


def audits(app, action: str) -> list[dict]:
    return rows(app, "SELECT * FROM audit_log WHERE action = ? ORDER BY id", action)


def device_element(ref: str) -> str:
    with httpx.Client(base_url=f"http://{NVR_HOST}") as client:
        el = nvr.slice_stream_element(client.get("/ISAPI/Streaming/channels").text, ref)
    assert el is not None
    return el


def streaming_hits(fake: FakeDevices) -> list[str]:
    return [h for h in fake.hits if "/ISAPI/Streaming" in h or "StreamingProxy" in h]


# ------------------------------------------------------------------------------------------------ the happy path

def test_svc_off_happy_path_records_audits_refreshes_and_writes_once(w):
    app, c, fake, ids = w
    cid = ids[1]
    before = stream(c, cid, "101")
    assert (before["svc"], before["webrtc"], before["webrtc_reason"], before["writable"]) == (True, "unknown", "svc", True)
    element = device_element("101")
    go2rtc_before = [h for h in fake.hits if "go2rtc" in h]
    r = put(c, cid, "101", {"svc": False}, before["etag"])
    assert r.status_code == 200, r.text
    body = r.json()
    assert (body["change"]["status"], body["change"]["kind"], body["applied_fields"], body["unchanged_fields"], body["reboot_required"]) == ("applied", "stream_encoding", ["svc"], [], False)
    assert (body["stream"]["svc"], body["stream"]["webrtc"], body["stream"]["webrtc_reason"]) == (False, "ok", "h264"), "the verdict flips from the verified reading"
    assert body["stream"]["etag"] != before["etag"]
    assert fake.writes == ["nvr PUT /ISAPI/Streaming/channels/101"], "exactly one device write, on the stream's own path"
    assert fake.nvr["put_bodies"] == ['<?xml version="1.0" encoding="UTF-8"?>' + element.replace("<SVC><enabled>true</enabled>", "<SVC><enabled>false</enabled>")], \
        "the PUT is the LIST element with one value changed - every other byte as the device sent it"
    [ch] = rows(app, "SELECT * FROM nvr_changes")
    assert (ch["status"], ch["kind"], ch["permission"], ch["recorder_id"], ch["camera_id"], ch["stream_ref"]) == ("applied", "stream_encoding", "nvr.configure", "nvr-1", cid, "101")
    assert json.loads(ch["fields_json"]) == {"svc": [True, False]} and ch["etag_before"] == before["etag"] and ch["etag_after"] == body["stream"]["etag"]
    assert (ch["device_status"], ch["reboot_required"], ch["error"]) == ("1", 0, None)
    assert ch["before_xml"] == element and "<SVC><enabled>false</enabled>" in ch["after_xml"]
    phases = [(a["decision"], json.loads(a["details_json"])["phase"]) for a in audits(app, "nvr.stream.write")]
    assert phases == [("allowed", "attempt"), ("allowed", "outcome")]
    out = json.loads(audits(app, "nvr.stream.write")[-1]["details_json"])
    assert (out["status"], out["fields"], out["change_id"], out["stream_ref"], out["role"], out["recorder_id"], out["reboot_required"]) == ("applied", {"svc": [True, False]}, ch["id"], "101", "main", "nvr-1", False)
    with app.state.db.connection(mode="read") as conn:
        enc = stream_codecs.encoding_of(conn.execute("SELECT * FROM cameras WHERE id = ?", (cid,)).fetchone())
        summary = stream_codecs.summary(conn)
    assert enc is not None and (enc["main"]["svc"], enc["main"]["webrtc"], enc["main"]["reason"], enc["main"]["source"], enc["error"]) == (False, "ok", "h264", "isapi", None)
    assert enc["sub"]["resolution"] == "640x360", "the other role's entry is kept"
    assert summary["main"]["ok"] == 1, "the WebRTC summary shows the new verdict at once"
    assert [h for h in fake.hits if "go2rtc" in h] == go2rtc_before, "an encoding change makes no go2rtc request"
    assert stream(c, cid, "101")["svc"] is False


def test_unchanged_request_writes_nothing(w):
    app, c, fake, ids = w
    r = put(c, ids[1], "101", {"svc": True})
    assert r.status_code == 200, r.text
    assert (r.json()["change"], r.json()["applied_fields"], r.json()["unchanged_fields"]) == (None, [], ["svc"])
    assert fake.writes == [] and rows(app, "SELECT * FROM nvr_changes") == []
    assert json.loads(audits(app, "nvr.stream.write")[-1]["details_json"])["status"] == "unchanged"


def test_multiple_fields_and_the_h265_main(w):
    app, c, fake, ids = w
    r = put(c, ids[1], "101", {"gop": 25, "bitrate_kbps": 2048, "fps": 12.5})
    assert r.status_code == 404 or r.status_code == 422 or r.status_code == 200, r.text
    # 12.5 fps is not in the fake's options (25, 20, 15, 10, 5, full): refused before any write
    assert r.status_code == 422 and r.json()["code"] == "value_not_allowed" and r.json()["details"]["field"] == "fps" and fake.writes == []
    r = put(c, ids[1], "101", {"gop": 25, "bitrate_kbps": 2048, "fps": 10})
    assert r.status_code == 200, r.text
    assert r.json()["applied_fields"] == ["bitrate_kbps", "fps", "gop"] and (r.json()["stream"]["gop"], r.json()["stream"]["bitrate_kbps"], r.json()["stream"]["fps"]) == (25, 2048, 10.0)
    r = put(c, ids[2], "201", {"svc": False})
    assert r.status_code == 200 and r.json()["stream"]["webrtc_reason"] == "h265", "an H.265 main stays 'unknown' with SVC off (only H.264 mains prove AT-020-16)"


# ------------------------------------------------------------------------------------------------ permission and scope

def test_without_nvr_configure_every_principal_is_refused_audited_and_the_device_untouched(w, settings):
    app, c, fake, ids = w
    s = with_nvr(settings)
    etag = stream(c, ids[1], "101")["etag"]
    role = c.post("/api/v1/access/roles", json={"name": "NVR הכל", "description": "", "permissions": ["map.read", "video.live"],
                                                "sensitive": ["nvr.config.write", "nvr.config.events", "nvr.config.detection", "nvr.config.privacy", "nvr.config.smart",
                                                              "nvr.config.schedule", "nvr.config.osd", "nvr.config.time", "nvr.system.reboot"]})
    assert role.status_code == 201, role.text
    bind(c, s, "cara", role.json()["id"], "installation", "*")
    bind(c, s, "sam", "site_admin", "installation", "*")
    bind(c, s, "vera", "viewer", "installation", "*")
    hits = len(streaming_hits(fake))
    for user in ("cara", "sam", "vera", "nobody"):
        r = c.put(f"/api/v1/nvr/cameras/{ids[1]}/streams/101", json={"if_match": etag, "confirm": True, "changes": {"svc": False}}, headers=as_user(user))
        assert r.status_code == 403, (user, r.text)
    assert fake.writes == [] and len(streaming_hits(fake)) == hits, "no device read, no device write"
    denied = [a for a in audits(app, "nvr.configure") if a["decision"] == "denied"]
    assert {a["actor_username"] for a in denied} >= {"cara", "sam", "vera", "nobody"}
    assert rows(app, "SELECT * FROM nvr_changes") == []


def test_nvr_configure_is_a_system_permission_and_nvr_config_stream_is_gone(w):
    app, c, fake, ids = w
    cat = c.get("/api/v1/access/roles").json()
    assert "nvr.configure" in cat["system_permissions"] and "nvr.configure" in cat["labels"] and "nvr.configure" not in cat["sensitive"]
    assert "nvr.config.stream" not in cat["labels"] and "nvr.config.stream" not in cat["sensitive"]
    builtin = {r["id"]: r for r in cat["roles"]}
    assert "nvr.configure" in builtin["system_admin"]["permissions"]
    assert not any("nvr.configure" in builtin[r]["permissions"] for r in ("site_admin", "operator", "editor", "viewer", "kiosk"))
    for body in ({"permissions": ["map.read", "nvr.configure"], "sensitive": []}, {"permissions": ["map.read"], "sensitive": ["nvr.configure"]}):
        r = c.post("/api/v1/access/roles", json={"name": "x", "description": "", **body})
        assert r.status_code == 422 and r.json()["code"] == "system_permission_not_allowed", r.text
    r = c.post("/api/v1/access/roles", json={"name": "y", "description": "", "permissions": ["map.read"], "sensitive": ["nvr.config.stream"]})
    assert r.status_code == 422 and r.json()["code"] == "permission_unknown"


def test_camera_deny_and_a_stream_named_through_another_camera(w, settings):
    app, c, fake, ids = w
    c.get("/api/v1/me", headers=as_user("ron"))
    with app.state.db.connection() as conn:
        for scope_type, scope_id, effect in (("installation", "*", "allow"), ("camera", ids[1], "deny")):
            conn.execute("INSERT INTO bindings(id, subject_kind, subject_id, role_id, scope_type, scope_id, effect, permission_revision, assigned_by, created_at) VALUES (?, 'user', 'dev-ron', 'system_admin', ?, ?, ?, ?, 'test', ?)",
                         (new_id(), scope_type, scope_id, effect, permission_revision(conn), now_iso()))
    etag = stream(c, ids[1], "101")["etag"]
    r = c.put(f"/api/v1/nvr/cameras/{ids[1]}/streams/101", json={"if_match": etag, "confirm": True, "changes": {"svc": False}}, headers=as_user("ron"))
    assert r.status_code == 403
    r = c.put(f"/api/v1/nvr/cameras/{ids[2]}/streams/101", json={"if_match": etag, "confirm": True, "changes": {"svc": False}}, headers=as_user("ron"))
    assert r.status_code == 404 and r.json()["code"] == "not_found", "camera 1's stream is never written through camera 2"
    assert fake.writes == []
    assert c.get(f"/api/v1/nvr/cameras/{ids[1]}", headers=as_user("ron")).status_code == 403
    assert c.get(f"/api/v1/nvr/cameras/{ids[2]}", headers=as_user("ron")).json()["can_write"] is True


# ------------------------------------------------------------------------------------------------ confirm, shape, validation

@pytest.mark.parametrize("confirm", [None, False, "true", 1, "yes", [True], {"v": True}])
def test_confirm_must_be_the_literal_true_and_is_checked_before_any_device_read(w, confirm):
    app, c, fake, ids = w
    etag = stream(c, ids[1], "101")["etag"]
    hits = len(streaming_hits(fake))
    payload = {"if_match": etag, "changes": {"svc": False}}
    if confirm is not None:
        payload["confirm"] = confirm
    r = c.put(f"/api/v1/nvr/cameras/{ids[1]}/streams/101", json=payload)
    assert r.status_code == 422 and r.json()["code"] == "confirm_required", r.text
    assert len(streaming_hits(fake)) == hits and fake.writes == []
    [a] = audits(app, "nvr.stream.write")
    assert (a["decision"], a["reason"]) == ("denied", "confirm_required")
    assert c.put(f"/api/v1/nvr/cameras/{ids[1]}/streams/101").json()["code"] == "confirm_required", "no body at all"


@pytest.mark.parametrize("changes,code", [
    ({}, "validation"), ({"foo": 1}, "validation"), ({"svc": "false"}, "validation"), ({"gop": 2.5}, "validation"), ({"bitrate_mode": "ABR"}, "validation"),
    ({"resolution": "999x999"}, "value_not_allowed"), ({"codec": "MJPEG"}, "value_not_allowed"), ({"gop": 401}, "value_not_allowed"), ({"bitrate_kbps": 20}, "value_not_allowed"),
    ({"quality": 33}, "value_not_allowed"), ({"bitrate_mode": "CBR", "quality": 30}, "field_locked"), ({"b_frames": False}, "field_not_supported"),
    ({"codec": "H.265"}, "value_not_allowed"),  # the High profile does not exist for H.265: the profile must be named
    ({"smart_codec": True, "gop": 30}, "field_locked"),
])
def test_validation_before_any_write(w, changes, code):
    app, c, fake, ids = w
    r = put(c, ids[1], "101", changes)
    assert r.status_code == 422 and r.json()["code"] == code, (changes, r.text)
    assert fake.writes == [] and rows(app, "SELECT * FROM nvr_changes") == []


def test_field_the_stream_lacks_and_bad_identifiers(w):
    app, c, fake, ids = w
    r = put(c, ids[1], "102", {"svc": True})
    assert r.status_code == 422 and r.json()["code"] == "field_not_supported", "the sub stream has no SVC element"
    assert put(c, ids[1], "101", {"svc": False}, etag="XYZ").json()["code"] == "validation"
    assert c.put(f"/api/v1/nvr/cameras/{ids[1]}/streams/abc", json={"confirm": True}).status_code == 422
    assert put(c, "no-such-camera", "101", {"svc": False}, etag="0" * 16).status_code in (403, 404)
    assert put(c, ids[1], "109", {"svc": False}, etag="0" * 16).status_code == 404
    assert fake.writes == []


def test_stale_etag_is_refused_with_the_current_stream(w):
    app, c, fake, ids = w
    old = stream(c, ids[1], "101")["etag"]
    fake.nvr["encodings_by_channel"] = {1: {"main": {"gop": 99}}}  # changed on the NVR meanwhile
    r = put(c, ids[1], "101", {"svc": False}, old)
    assert r.status_code == 409 and r.json()["code"] == "stale"
    assert r.json()["details"]["stream"]["gop"] == 99 and r.json()["details"]["stream"]["etag"] != old
    assert fake.writes == [] and rows(app, "SELECT * FROM nvr_changes") == []
    assert (audits(app, "nvr.stream.write")[-1]["decision"], audits(app, "nvr.stream.write")[-1]["reason"]) == ("denied", "stale")


def test_a_change_between_the_first_read_and_the_put_is_stale_too(w):
    app, c, fake, ids = w
    etag = stream(c, ids[1], "101")["etag"]
    start = fake.nvr["list_reads"]

    def change_on_second_read(f, n):
        if n == start + 2:  # the service's own read is start+1; the adapter's pre-PUT read is start+2
            f.nvr["encodings_by_channel"] = {1: {"main": {"gop": 77}}}

    fake.nvr["on_list_read"] = change_on_second_read
    r = put(c, ids[1], "101", {"svc": False}, etag)
    assert r.status_code == 409 and r.json()["code"] == "stale", r.text
    assert fake.writes == []
    [ch] = rows(app, "SELECT * FROM nvr_changes")
    assert (ch["status"], ch["error"]) == ("refused", "stale"), "the pending row is settled as refused, nothing was sent"


# ------------------------------------------------------------------------------------------------ device outcomes

def registry_main(app, cid: str) -> dict:
    with app.state.db.connection(mode="read") as conn:
        return (stream_codecs.encoding_of(conn.execute("SELECT * FROM cameras WHERE id = ?", (cid,)).fetchone()) or {}).get("main") or {}


@pytest.mark.parametrize("mode,http,code,status", [
    ("busy", 409, "nvr_busy", "refused"), ("notsupport", 409, "nvr_not_supported", "refused"), ("invalid", 409, "nvr_rejected", "refused"), ("forbidden", 503, "source_forbidden", "failed"),
])
def test_device_refusals(w, mode, http, code, status):
    app, c, fake, ids = w
    reg = registry_main(app, ids[1])
    fake.nvr["put"] = {"status": mode}
    r = put(c, ids[1], "101", {"svc": False})
    assert r.status_code == http and r.json()["code"] == code, r.text
    assert fake.writes == ["nvr PUT /ISAPI/Streaming/channels/101"], "exactly one PUT, never retried"
    [ch] = rows(app, "SELECT * FROM nvr_changes")
    assert (ch["status"], ch["error"]) == (status, code) and r.json()["details"]["change_id"] == ch["id"]
    assert registry_main(app, ids[1]) == reg, "the registry is untouched"
    assert [json.loads(a["details_json"])["phase"] for a in audits(app, "nvr.stream.write")] == ["attempt", "outcome"]
    assert audits(app, "nvr.stream.write")[-1]["reason"] == code
    assert NVR_HOST not in r.text


def test_device_keeps_the_old_value(w):
    app, c, fake, ids = w
    fake.nvr["put"] = {"status": "ok", "keeps_old": True}
    r = put(c, ids[1], "101", {"svc": False})
    assert r.status_code == 409 and r.json()["code"] == "nvr_no_effect"
    [ch] = rows(app, "SELECT * FROM nvr_changes")
    assert ch["status"] == "no_effect" and len(fake.writes) == 1 and registry_main(app, ids[1])["svc"] is True


def test_reboot_required_is_applied_and_arx_never_reboots(w):
    app, c, fake, ids = w
    fake.nvr["put"] = {"status": "reboot"}
    r = put(c, ids[1], "101", {"svc": False})
    assert r.status_code == 200 and r.json()["reboot_required"] is True and r.json()["change"]["status"] == "applied"
    [ch] = rows(app, "SELECT * FROM nvr_changes")
    assert (ch["device_status"], ch["reboot_required"]) == ("7", 1)
    assert fake.writes == ["nvr PUT /ISAPI/Streaming/channels/101"], "no POST /ISAPI/System/reboot"


def test_no_capability_document_aborts_with_a_clear_error(w):
    app, c, fake, ids = w
    fake.nvr["caps_status"] = {"direct": 404, "proxy": 403}
    r = put(c, ids[1], "101", {"svc": False})
    assert r.status_code == 503 and r.json()["code"] == "capabilities_unreadable" and r.json()["user_message"]
    assert fake.writes == [] and rows(app, "SELECT * FROM nvr_changes") == []
    s = stream(c, ids[1], "101")
    assert (s["writable"], s["not_writable_reason"]) == (False, "notSupport")


def test_proxy_capabilities_write_on_the_proxy_path(w):
    app, c, fake, ids = w
    fake.nvr["caps_status"] = {"direct": 404, "proxy": 200}
    fake.nvr["write_path"] = "proxy"
    r = put(c, ids[1], "101", {"svc": False})
    assert r.status_code == 200, r.text
    assert fake.writes == ["nvr PUT /ISAPI/ContentMgmt/StreamingProxy/channels/101"]


def test_unknown_outcome_stays_pending_and_the_next_write_settles_it(w):
    app, c, fake, ids = w
    fake.nvr["put"] = {"status": "timeout"}
    fake.nvr["timeout_applies"] = True
    r = put(c, ids[1], "101", {"svc": False})
    assert r.status_code == 503 and r.json()["code"] == "source_unavailable"
    [ch] = rows(app, "SELECT * FROM nvr_changes")
    assert (ch["status"], ch["error"]) == ("pending", "outcome_unknown"), "the device may have applied it: no guess"
    fake.nvr["put"] = {"status": "ok"}
    r = put(c, ids[1], "101", {"svc": True})
    assert r.status_code == 200, r.text
    first = rows(app, "SELECT * FROM nvr_changes WHERE id = ?", ch["id"])[0]
    assert first["status"] == "applied", "settled from the device reading before the next write"
    assert [a["actor_username"] for a in audits(app, "nvr.stream.write") if json.loads(a["details_json"])["phase"] == "settle"] == [None]
    assert len(fake.writes) == 2


def test_a_young_pending_change_blocks_the_stream(w):
    app, c, fake, ids = w
    etag = stream(c, ids[1], "101")["etag"]
    with app.state.db.connection() as conn:
        conn.execute("INSERT INTO nvr_changes(id, kind, permission, target, path, status, note, created_at, recorder_id, camera_id, stream_ref, fields_json) "
                     "VALUES ('p1', 'stream_encoding', 'nvr.configure', 'stream-101', 'direct:101', 'pending', '', ?, 'nvr-1', ?, '101', '{\"svc\": [true, false]}')", (now_iso(), ids[1]))
    r = put(c, ids[1], "101", {"svc": False}, etag)
    assert r.status_code == 409 and r.json()["code"] == "write_in_progress"
    assert fake.writes == []
    assert put(c, ids[1], "102", {"gop": 30}).status_code == 200, "another stream is not blocked"


def test_responses_audit_and_change_rows_carry_no_address_or_credential(w):
    app, c, fake, ids = w
    texts = [put(c, ids[1], "101", {"svc": False}).text, c.get(f"/api/v1/nvr/cameras/{ids[1]}").text, c.get("/api/v1/nvr/changes").text]
    fake.nvr["put"] = {"status": "busy"}
    texts.append(put(c, ids[1], "101", {"svc": True}).text)
    for a in audits(app, "nvr.stream.write"):
        texts.append(a["details_json"] or "")
    for ch in rows(app, "SELECT fields_json, error, device_status, path FROM nvr_changes"):
        texts.append(json.dumps(ch))
    for t in texts:
        for secret in SECRETS:
            assert secret not in t, (secret, t[:200])
