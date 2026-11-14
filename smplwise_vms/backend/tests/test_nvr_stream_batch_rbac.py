"""CR-020 S2C (PLAN_C section 8 group 6, section 5): who may start, watch, stop and undo a batch. `nvr.configure` (a system
permission: built-in system_admin only, never a custom role) at installation scope, then `confirm` (the literal true)
before any device read, then `nvr.configure` on EVERY target camera (one deny = 403 for the whole batch, zero writes),
and the same check again per item while the batch runs. Fakes only."""
from __future__ import annotations

import sys
from pathlib import Path

import pytest
from conftest import as_user, bind
from fastapi.testclient import TestClient
from nvr_batch_helpers import audits, camera_ids, fast_unknown, make_app, puts, ready, rows, setup_fake, start, statuses, targets, wait_done, wait_put, with_nvr  # noqa: F401

from smplwise.db import new_id, now_iso, permission_revision
from smplwise.services import nvr_batch

sys.path.insert(0, str(Path(__file__).resolve().parent / "fixtures"))
from fake_devices import FakeDevices  # noqa: E402


@pytest.fixture()
def fake(monkeypatch) -> FakeDevices:
    f = FakeDevices()
    f.install(monkeypatch)
    setup_fake(f)
    return f


@pytest.fixture()
def bw(settings, fake, fast_unknown):
    app = make_app(settings)
    with TestClient(app) as c:
        ready(app, 5)
        yield app, c, fake, camera_ids(app)
    assert nvr_batch.wait_idle(10)


def streaming_hits(fake) -> int:
    return len([h for h in fake.hits if "/ISAPI/Streaming" in h])


def _binding(app, user: str, scope_type: str, scope_id: str, effect: str, role: str = "system_admin") -> None:
    with app.state.db.connection() as conn:
        conn.execute("INSERT INTO bindings(id, subject_kind, subject_id, role_id, scope_type, scope_id, effect, permission_revision, assigned_by, created_at)"
                     " VALUES (?, 'user', ?, ?, ?, ?, ?, ?, 'test', ?)", (new_id(), f"dev-{user}", role, scope_type, scope_id, effect, permission_revision(conn), now_iso()))


def test_without_nvr_configure_nobody_starts_watches_stops_or_undoes(bw, settings):
    app, c, fake, ids = bw
    s = with_nvr(settings)
    tg = targets(c, ids, (1, 2))
    role = c.post("/api/v1/access/roles", json={"name": "NVR הכל", "description": "", "permissions": ["map.read", "video.live"],
                                                "sensitive": ["nvr.config.write", "nvr.config.osd", "nvr.config.time", "nvr.system.reboot"]})
    assert role.status_code == 201, role.text
    bind(c, s, "cara", role.json()["id"], "installation", "*")
    bind(c, s, "sam", "site_admin", "installation", "*")
    bind(c, s, "vera", "viewer", "installation", "*")
    src = wait_done(c, start(c, targets(c, ids, (3, 4))).json()["batch_id"])
    hits, writes = streaming_hits(fake), list(fake.writes)
    for user in ("cara", "sam", "vera", "nobody"):
        h = as_user(user)
        assert start(c, tg, headers=h).status_code == 403, user
        assert c.get("/api/v1/nvr/stream-batches", headers=h).status_code == 403
        assert c.get(f"/api/v1/nvr/stream-batches/{src['batch_id']}", headers=h).status_code == 403
        assert c.post(f"/api/v1/nvr/stream-batches/{src['batch_id']}/stop", headers=h).status_code == 403
        assert c.post(f"/api/v1/nvr/stream-batches/{src['batch_id']}/rollback", json={"confirm": True}, headers=h).status_code == 403
    assert streaming_hits(fake) == hits and fake.writes == writes, "no device read, no device write"
    denied = [a for a in audits(app, "nvr.configure") if a["decision"] == "denied"]
    assert {a["actor_username"] for a in denied} >= {"cara", "sam", "vera", "nobody"}
    assert len({r["batch_id"] for r in rows(app, "SELECT batch_id FROM nvr_changes WHERE batch_id IS NOT NULL")}) == 1


def test_a_deny_on_one_target_refuses_the_whole_batch(bw):
    app, c, fake, ids = bw
    c.get("/api/v1/me", headers=as_user("ron"))
    _binding(app, "ron", "installation", "*", "allow")
    _binding(app, "ron", "camera", ids[2], "deny")
    tg = targets(c, ids, (1, 3)) + [{"camera_id": ids[2], "stream_ref": "201", "if_match": "0" * 16}]
    hits = streaming_hits(fake)
    r = start(c, tg, headers=as_user("ron"))
    assert r.status_code == 403, r.text
    assert fake.writes == [] and streaming_hits(fake) == hits, "authorization of every target comes before any device read"
    assert rows(app, "SELECT id FROM nvr_changes WHERE batch_id IS NOT NULL") == []
    [deny] = [a for a in audits(app, "nvr.configure") if a["decision"] == "denied" and a["actor_username"] == "ron"]
    assert (deny["resource_type"], deny["resource_id"]) == ("camera", ids[2])


@pytest.mark.parametrize("confirm", [None, False, "true", 1, [True]])
def test_confirm_is_checked_before_any_device_read(bw, confirm):
    app, c, fake, ids = bw
    tg = targets(c, ids, (1, 2))
    hits, reads = streaming_hits(fake), fake.nvr["list_reads"]
    body = {"changes": {"svc": False}, "targets": tg}
    if confirm is not None:
        body["confirm"] = confirm
    r = c.post("/api/v1/nvr/stream-batches", json=body)
    assert r.status_code == 422 and r.json()["code"] == "confirm_required", r.text
    assert streaming_hits(fake) == hits and fake.nvr["list_reads"] == reads and fake.writes == []
    [a] = audits(app, "nvr.stream.batch")
    assert (a["decision"], a["reason"]) == ("denied", "confirm_required")
    assert c.post("/api/v1/nvr/stream-batches").json()["code"] == "confirm_required", "no body at all"
    assert c.post("/api/v1/nvr/stream-batches", content=b"{not json", headers={"Content-Type": "application/json"}).json()["code"] == "confirm_required"


def test_unauthorised_caller_gets_403_whatever_the_body(bw):
    app, c, fake, ids = bw
    r = c.post("/api/v1/nvr/stream-batches", content=b"garbage", headers={**as_user("nobody"), "Content-Type": "application/json"})
    assert r.status_code == 403


def test_a_deny_added_mid_batch_stops_it(bw):
    app, c, fake, ids = bw
    fake.nvr["put_hold_s"] = 1.0
    bid = start(c, targets(c, ids, (1, 2, 3))).json()["batch_id"]
    wait_put(fake, 1)
    _binding(app, "joni", "camera", ids[2], "deny")
    fake.nvr["put_hold_s"] = 0.0
    body = wait_done(c, bid)
    assert (body["state"], body["stopped_reason"]) == ("failed", "forbidden")
    assert [i["status"] for i in body["items"] if i["camera_id"] != ids[2]] == ["applied", "not_attempted"]
    assert body["hidden"] == 1, "the denied camera's item is not shown to this caller any more"
    assert puts(fake) == ["101"]
    with app.state.db.connection(mode="read") as conn:
        st = conn.execute("SELECT status, error FROM nvr_changes WHERE batch_id = ? AND batch_index = 1", (bid,)).fetchone()
    assert (st["status"], st["error"]) == ("refused", "forbidden")


def test_items_are_filtered_by_camera_scope_and_undo_needs_every_camera(bw):
    app, c, fake, ids = bw
    src = wait_done(c, start(c, targets(c, ids, (1, 2, 3))).json()["batch_id"])
    c.get("/api/v1/me", headers=as_user("ron"))
    _binding(app, "ron", "installation", "*", "allow")
    _binding(app, "ron", "camera", ids[3], "deny")
    seen = c.get(f"/api/v1/nvr/stream-batches/{src['batch_id']}", headers=as_user("ron")).json()
    assert [i["camera_id"] for i in seen["items"]] == [ids[1], ids[2]] and seen["hidden"] == 1
    r = c.post(f"/api/v1/nvr/stream-batches/{src['batch_id']}/rollback", json={"confirm": True}, headers=as_user("ron"))
    assert r.status_code == 403
    assert len(puts(fake)) == 3 and len({x["batch_id"] for x in rows(app, "SELECT batch_id FROM nvr_changes WHERE batch_id IS NOT NULL")}) == 1
