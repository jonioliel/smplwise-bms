"""NVR-H264-BULK-2341: the per-recorder switch "אפשר שינויי הגדרות ב־NVR" and the one-click "convert every stream to H.264"
(docs/changes/NVR-H264-BULK-2341.md). The preset reuses the CR-020 phase D engine (preview -> confirm -> apply -> undo-all);
these tests pin what the preset relies on and the new switch: permission + audit, writes refused while it is off (preview,
start, single write, the adapters), partial plans, and the undo restoring the values captured before the change.

Fake devices only (tests/fixtures/fake_devices.py): nothing here reaches a real NVR."""
from __future__ import annotations

import dataclasses
import json
import sys
from pathlib import Path

import pytest
from conftest import as_user, bind
from fastapi.testclient import TestClient
from nvr_batch_helpers import audits, batch_rows, camera_ids, details, fast_unknown, make_app, puts, quiet_alert_stream, ready, wait_done, with_nvr  # noqa: F401

from smplwise import recorder_scope
from smplwise.db import now_iso
from smplwise.services import nvr_batch, nvr_write_switch
from smplwise.services.recorders import registry

sys.path.insert(0, str(Path(__file__).resolve().parent / "fixtures"))
from fake_devices import FakeDevices  # noqa: E402
from nvr_batch_helpers import setup_fake  # noqa: E402

PREVIEW = "/api/v1/nvr/encoding-batches/preview"
START = "/api/v1/nvr/encoding-batches"
WRITES = "/api/v1/recorders/nvr-1/writes"
H264 = {"codec": "H.264"}  # exactly what the screen's preset sends: only the codec; every other field "leave as is"


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
        quiet_alert_stream()
        yield app, c, fake, camera_ids(app)
    assert nvr_batch.wait_idle(10)


def refs(ids: dict[int, str], chans, kinds=("01", "02")) -> list[dict]:
    return [{"camera_id": ids[ch], "stream_ref": f"{ch}{k}"} for ch in chans for k in kinds]


def preview(c: TestClient, tg: list[dict], settings: dict | None = None, headers: dict | None = None):
    return c.post(PREVIEW, json={"settings": settings or H264, "targets": tg}, headers=headers or {})


def planned(body: dict) -> list[dict]:
    return [{"camera_id": i["camera_id"], "stream_ref": i["stream_ref"], "if_match": i["if_match"], "changes": i["changes"]} for i in body["items"] if i["status"] == "change"]


def start(c: TestClient, tg: list[dict], settings: dict | None = None):
    return c.post(START, json={"confirm": True, "settings": settings or H264, "targets": tg})


def h265_mains(fake, chans=(1, 2)) -> None:
    for ch in chans:
        fake.nvr["encodings_by_channel"].setdefault(ch, {})["main"] = {"codec": "H.265", "profile": "Main", "svc": True}


def custom_role(app, c, settings, user: str, perms: list[str]) -> None:
    with app.state.db.connection() as conn:
        conn.execute("INSERT INTO custom_roles(id, name_he, permissions_json, created_at, updated_at) VALUES (?, ?, ?, ?, ?)",
                     (f"r_{user}", f"r_{user}", json.dumps(perms), now_iso(), now_iso()))
    bind(c, with_nvr(settings), user, f"r_{user}", "installation", "*")


# ------------------------------------------------------------------------------------------------ the switch

def test_the_switch_shows_the_vendor_default_and_who_changed_it_last(ew):
    app, c, fake, ids = ew
    r = c.get(WRITES)
    assert r.status_code == 200, r.text
    s = r.json()
    assert (s["supported"], s["enabled"], s["explicit"], s["default"], s["last_change"], s["can_change"]) == (True, True, False, True, None, True), \
        "a Hikvision recorder that was never switched keeps the writes shipped since CR-020 S2"
    off = c.patch(WRITES, json={"enabled": False})
    assert off.status_code == 200, off.text
    s = off.json()
    assert (s["enabled"], s["explicit"]) == (False, True) and s["last_change"]["enabled"] is False and s["last_change"]["by"] and s["last_change"]["at"]
    assert c.get(WRITES).json()["enabled"] is False


def test_turning_on_needs_the_confirmation_and_both_permissions_and_every_attempt_is_audited(ew, settings):
    app, c, fake, ids = ew
    assert c.patch(WRITES, json={"enabled": False}).status_code == 200, "turning off is never confirmed (a safety action)"
    r = c.patch(WRITES, json={"enabled": True})
    assert (r.status_code, r.json()["code"]) == (422, "confirm_required")
    assert c.get(WRITES).json()["enabled"] is False
    for bad in ({"enabled": "yes", "confirm": True}, {"enabled": True, "confirm": True, "extra": 1}, {}):
        assert c.patch(WRITES, json=bad).status_code == 422
    custom_role(app, c, settings, "cfg", ["system.configure"])
    custom_role(app, c, settings, "nvrw", ["nvr.configure"])
    for user in ("cfg", "nvrw"):
        r = c.patch(WRITES, json={"enabled": True, "confirm": True}, headers=as_user(user))
        assert r.status_code == 403, (user, r.text)
        r = c.patch(WRITES, content=b"{not json", headers={**as_user(user), "Content-Type": "application/json"})
        assert r.status_code == 403, "the permission before the body"
    assert c.get(WRITES, headers=as_user("cfg")).json()["can_change"] is False
    assert c.get(WRITES).json()["enabled"] is False
    on = c.patch(WRITES, json={"enabled": True, "confirm": True})
    assert on.status_code == 200 and on.json()["enabled"] is True
    rows = audits(app, "nvr.writes.switch")
    allowed = [details(a) for a in rows if a["decision"] == "allowed"]
    assert [(d["previous"], d["enabled"], d["changed"]) for d in allowed] == [(True, False, True), (False, True, True)]
    assert any(a["decision"] == "denied" and a["reason"] == "confirm_required" for a in rows)
    assert all(a["resource_type"] == "recorder" and a["resource_id"] == "nvr-1" for a in rows)
    with app.state.db.connection() as conn:
        assert nvr_write_switch.stored(conn, "nvr-1") is True


def test_unknown_recorders_and_the_remote_channel(ew):
    from smplwise import remote_channel

    app, c, fake, ids = ew
    assert c.get("/api/v1/recorders/nvr-77/writes").status_code == 404
    assert c.patch("/api/v1/recorders/../writes", json={"enabled": False}).status_code in (404, 405)
    assert any(WRITES.startswith(p) for p in remote_channel.BLOCKED_ON_REMOTE), "local channel only (the recorders prefix)"


def test_the_switch_is_loaded_at_start_up(ew):
    app, c, fake, ids = ew
    assert c.patch(WRITES, json={"enabled": False}).status_code == 200
    recorder_scope.WRITES.clear()  # a new process
    assert recorder_scope.writes_override("nvr-1") is None
    with app.state.db.connection(mode="read") as conn:
        assert nvr_write_switch.load_all(conn) == 1
    assert recorder_scope.writes_override("nvr-1") is False


# ------------------------------------------------------------------------------------------------ writes refused while off

def test_with_the_switch_off_nothing_is_written_preview_start_single_and_undo(ew):
    app, c, fake, ids = ew
    h265_mains(fake)
    done = None
    # a batch applied while on: its undo must also be refused once the switch is off
    p = preview(c, refs(ids, (1,), ("01",))).json()
    r = start(c, planned(p))
    assert r.status_code == 202, r.text
    done = wait_done(c, r.json()["batch_id"])
    assert done["state"] == "completed"
    written = len(puts(fake))
    assert c.patch(WRITES, json={"enabled": False}).status_code == 200
    body = preview(c, refs(ids, (2, 5))).json()
    by = {i["stream_ref"]: i for i in body["items"]}
    assert (by["201"]["status"], by["201"]["reason"]) == ("skip", "writes_disabled") and "בהגדרות החיבור" in by["201"]["message"]
    assert body["counts"]["change"] == 0
    forged = [{"camera_id": ids[2], "stream_ref": "201", "if_match": by["201"]["if_match"], "changes": {"codec": "H.264"}}]
    r = start(c, forged)
    assert (r.status_code, r.json()["code"]) == (422, "batch_target_not_allowed")
    s = next(x for x in c.get(f"/api/v1/nvr/cameras/{ids[2]}").json()["camera"]["streams"] if x["stream_ref"] == "201")
    assert s["writable"] is False and s.get("not_writable_reason") == "writes_disabled"
    single = c.put(f"/api/v1/nvr/cameras/{ids[2]}/streams/201", json={"if_match": s["etag"], "confirm": True, "changes": {"codec": "H.264"}})
    assert single.status_code in (409, 422), single.text
    u = c.post(f"/api/v1/nvr/stream-batches/{done['batch_id']}/rollback", json={"confirm": True})
    if u.status_code == 202:
        undone = wait_done(c, u.json()["batch_id"])
        assert undone["state"] != "completed"
    assert len(puts(fake)) == written, "not one PUT while the switch is off"
    # on again: the same preview plans the change
    assert c.patch(WRITES, json={"enabled": True, "confirm": True}).status_code == 200
    assert preview(c, refs(ids, (2,), ("01",))).json()["counts"]["change"] == 1


def test_the_adapters_obey_the_switch(settings):
    base = with_nvr(settings)
    hik = registry.constructor_for(dataclasses.replace(base, nvr_vendor="hikvision"))("nvr-1", dataclasses.replace(base, nvr_vendor="hikvision"))
    assert hik.writes_enabled is True and hik.capabilities().write_encodings is True
    off = dataclasses.replace(base, nvr_vendor="hikvision", nvr_extra={"writes_enabled": False})
    assert registry.constructor_for(off)("nvr-1", off).writes_enabled is False
    pv = dataclasses.replace(base, nvr_vendor="provision_isr", nvr_extra={})
    adapter = registry.constructor_for(pv)("nvr-1", pv)
    assert adapter.writes_enabled is False and adapter.capabilities().write_encodings is False, "Provision-ISR stays off until switched on"
    recorder_scope.set_writes_override("nvr-1", True)
    assert adapter.writes_enabled is True and hik.writes_enabled is True
    recorder_scope.set_writes_override("nvr-1", False)
    legacy_on = dataclasses.replace(base, nvr_vendor="provision_isr", nvr_extra={"writes_enabled": True})
    assert registry.constructor_for(legacy_on)("nvr-1", legacy_on).writes_enabled is False, "the switch wins over the legacy extra flag"
    assert hik.writes_enabled is False
    with pytest.raises(Exception) as e:
        hik.write_stream_encoding("101", "0" * 16, "<StreamingChannel/>", "direct")
    assert getattr(e.value, "code", None) == "nvr_not_supported" and e.value.details["reason"] == "writes_disabled"
    assert nvr_write_switch.effective("nvr-9", "frigate", {}) is False and nvr_write_switch.supported("frigate") is False


# ------------------------------------------------------------------------------------------------ the preset

def test_the_h264_preset_changes_only_the_codec_and_the_profile_it_needs_and_keeps_the_rest(ew):
    app, c, fake, ids = ew
    fake.nvr["encodings_by_channel"].setdefault(1, {})["main"] = {"codec": "H.265", "profile": "Main", "svc": True}
    body = preview(c, refs(ids, (1, 2, 3, 4, 5))).json()
    by = {i["stream_ref"]: i for i in body["items"]}
    for ref in ("101", "501"):
        it = by[ref]
        assert it["status"] == "change" and it["changes"]["codec"] == "H.264" and it["fields"]["codec"] == ["H.265", "H.264"]
        assert set(it["changes"]) <= {"codec", "profile", "resolution"}, "bitrate, frame rate, GOP, quality are never touched by the preset"
        assert it["before"]["codec"] == "H.265"
    assert {r: by[r]["status"] for r in ("201", "301", "401", "102", "202")} == dict.fromkeys(("201", "301", "401", "102", "202"), "unchanged")
    assert body["counts"] == {"change": 2, "unchanged": 8, "skip": 0}


def test_main_only_and_sub_only_targets(ew):
    app, c, fake, ids = ew
    h265_mains(fake, (1, 2, 3))
    mains = preview(c, refs(ids, (1, 2, 3, 4, 5), ("01",))).json()
    assert {i["stream_ref"] for i in mains["items"]} == {"101", "201", "301", "401", "501"}
    assert mains["counts"]["change"] == 4
    subs = preview(c, refs(ids, (1, 2, 3, 4, 5), ("02",))).json()
    assert subs["counts"] == {"change": 0, "unchanged": 5, "skip": 0}


def test_partial_plan_refused_and_offline_streams_are_listed_and_the_rest_applies(ew):
    app, c, fake, ids = ew
    h265_mains(fake, (1, 2, 3))
    fake.nvr["caps_status_by_stream"] = {"201": {"direct": 404, "proxy": 404}}  # the NVR refuses this camera's capabilities
    fake.nvr["offline"] = [3]
    body = preview(c, refs(ids, (1, 2, 3, 5), ("01",))).json()
    by = {i["stream_ref"]: i for i in body["items"]}
    assert (by["201"]["status"], by["301"]["status"], by["301"]["reason"]) == ("skip", "skip", "offline")
    assert by["201"]["message"] and by["301"]["message"]
    assert [i["stream_ref"] for i in body["items"] if i["status"] == "change"] == ["101", "501"]
    r = start(c, planned(body))
    assert r.status_code == 202, r.text
    done = wait_done(c, r.json()["batch_id"])
    assert done["state"] == "completed" and [i["status"] for i in done["items"]] == ["applied", "applied"]
    assert puts(fake) == ["101", "501"], "only the planned streams; the refused and the offline ones are never written"


def test_the_undo_restores_the_values_captured_before_the_change(ew):
    app, c, fake, ids = ew
    h265_mains(fake, (1, 2))
    body = preview(c, refs(ids, (1, 2, 5))).json()
    r = start(c, planned(body))
    done = wait_done(c, r.json()["batch_id"])
    assert done["state"] == "completed"
    stored = batch_rows(app, done["batch_id"])
    assert len(stored) == 3 and all(row["before_xml"] and "H.265" in row["before_xml"] for row in stored), "the pre-change stream is kept in the batch"
    assert [fake._encoding(ch, "main")["codec"] for ch in (1, 2, 5)] == ["H.264"] * 3
    u = c.post(f"/api/v1/nvr/stream-batches/{done['batch_id']}/rollback", json={"confirm": True})
    assert u.status_code == 202, u.text
    undone = wait_done(c, u.json()["batch_id"])
    assert (undone["state"], undone["kind"], undone["mode"]) == ("completed", "rollback", "encoding")
    assert [fake._encoding(ch, "main")["codec"] for ch in (1, 2, 5)] == ["H.265"] * 3
    assert fake._encoding(5, "main").get("profile") in ("Main", None)
