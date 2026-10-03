"""CR-020 S2 (S2-10): undo of a `stream_encoding` change through `POST /api/v1/nvr/changes/{id}/rollback` - a guarded write of
its own: `nvr.configure` at installation and on the change's camera, the literal `confirm: true` (owner Q3=A), the etag of the
change's `after` must still be the stream's, only an `applied` change, the same two phases and audit rows, the registry
refreshed. The generic rollback path can never PUT a stream document. AT-020-12."""
from __future__ import annotations

import json

import pytest
from conftest import as_user, bind
from test_nvr_stream_write import audits, device_element, fake, put, registry_main, rows, stream, w, with_nvr  # noqa: F401 - fixtures

from smplwise.db import new_id, now_iso, permission_revision
from smplwise.errors import ApiError
from smplwise.services import nvr_write


def rollback(c, change_id: str, body: object = None, headers: dict | None = None):
    kwargs = {"headers": headers or {}}
    if body is not None:
        kwargs["json"] = body
    return c.post(f"/api/v1/nvr/changes/{change_id}/rollback", **kwargs)


def applied(c, cid: str) -> dict:
    r = put(c, cid, "101", {"svc": False})
    assert r.status_code == 200, r.text
    return r.json()["change"]


def test_undo_restores_the_document_and_the_registry(w):
    app, c, fake, ids = w
    element = device_element("101")
    etag0 = stream(c, ids[1], "101")["etag"]
    ch = applied(c, ids[1])
    assert registry_main(app, ids[1])["webrtc"] == "ok"
    r = rollback(c, ch["id"], {"confirm": True})
    assert r.status_code == 201, r.text
    body = r.json()
    assert (body["change"]["status"], body["change"]["rollback_of"], body["rollback_of"], body["stream"]["svc"]) == ("applied", ch["id"], ch["id"], True)
    assert body["stream"]["etag"] == etag0 and device_element("101") == element, "the device shows the original document again"
    assert fake.writes == ["nvr PUT /ISAPI/Streaming/channels/101"] * 2
    assert fake.nvr["put_bodies"][1] == '<?xml version="1.0" encoding="UTF-8"?>' + element, "the undo PUTs the stored before-document"
    orig = rows(app, "SELECT * FROM nvr_changes WHERE id = ?", ch["id"])[0]
    undo = rows(app, "SELECT * FROM nvr_changes WHERE rollback_of = ?", ch["id"])[0]
    assert orig["status"] == "rolled_back" and json.loads(undo["fields_json"]) == {"svc": [False, True]} and undo["camera_id"] == ids[1]
    assert (registry_main(app, ids[1])["svc"], registry_main(app, ids[1])["webrtc"]) == (True, "unknown")
    phases = [(a["decision"], json.loads(a["details_json"])["phase"], json.loads(a["details_json"]).get("rollback_of")) for a in audits(app, "nvr.rollback")]
    assert phases == [("allowed", "attempt", ch["id"]), ("allowed", "outcome", ch["id"])]
    again = rollback(c, ch["id"], {"confirm": True})
    assert again.status_code == 409 and again.json()["code"] == "not_rollbackable", "a rolled-back change is not rolled back again"
    assert len(fake.writes) == 2


@pytest.mark.parametrize("body", [None, {}, {"confirm": False}, {"confirm": "true"}, {"confirm": 1}])
def test_undo_needs_the_literal_confirm(w, body):
    app, c, fake, ids = w
    ch = applied(c, ids[1])
    r = rollback(c, ch["id"], body)
    assert r.status_code == 422 and r.json()["code"] == "confirm_required", r.text
    assert len(fake.writes) == 1
    assert audits(app, "nvr.rollback")[-1]["reason"] == "confirm_required"


def test_undo_refuses_when_the_stream_moved_since(w):
    app, c, fake, ids = w
    ch = applied(c, ids[1])
    fake.nvr["encodings_by_channel"] = {**fake.nvr["encodings_by_channel"], 1: {"main": {**fake.nvr["encodings_by_channel"][1]["main"], "gop": 88}}}
    r = rollback(c, ch["id"], {"confirm": True})
    assert r.status_code == 409 and r.json()["code"] == "stale" and r.json()["details"]["stream"]["gop"] == 88
    assert len(fake.writes) == 1 and rows(app, "SELECT status FROM nvr_changes WHERE id = ?", ch["id"])[0]["status"] == "applied"


def test_undo_refuses_changes_that_are_not_applied(w):
    app, c, fake, ids = w
    fake.nvr["put"] = {"status": "busy"}
    put(c, ids[1], "101", {"svc": False})
    [refused] = rows(app, "SELECT * FROM nvr_changes")
    r = rollback(c, refused["id"], {"confirm": True})
    assert r.status_code == 409 and r.json()["code"] == "not_rollbackable"
    assert len(fake.writes) == 1


def test_undo_permission_and_camera_scope(w, settings):
    app, c, fake, ids = w
    s = with_nvr(settings)
    ch = applied(c, ids[1])
    role = c.post("/api/v1/access/roles", json={"name": "NVR", "description": "", "permissions": ["map.read"], "sensitive": ["nvr.config.write", "nvr.config.osd"]}).json()
    bind(c, s, "cara", role["id"], "installation", "*")
    bind(c, s, "sam", "site_admin", "installation", "*")
    for user in ("cara", "sam", "nobody"):
        assert rollback(c, ch["id"], {"confirm": True}, as_user(user)).status_code == 403, user
    c.get("/api/v1/me", headers=as_user("ron"))
    with app.state.db.connection() as conn:
        for scope_type, scope_id, effect in (("installation", "*", "allow"), ("camera", ids[1], "deny")):
            conn.execute("INSERT INTO bindings(id, subject_kind, subject_id, role_id, scope_type, scope_id, effect, permission_revision, assigned_by, created_at) VALUES (?, 'user', 'dev-ron', 'system_admin', ?, ?, ?, ?, 'test', ?)",
                         (new_id(), scope_type, scope_id, effect, permission_revision(conn), now_iso()))
    assert rollback(c, ch["id"], {"confirm": True}, as_user("ron")).status_code == 403, "a camera deny covers the undo of that camera's change"
    assert len(fake.writes) == 1 and rows(app, "SELECT status FROM nvr_changes WHERE id = ?", ch["id"])[0]["status"] == "applied"


def test_the_generic_rollback_path_never_writes_a_stream_document(w, settings):
    app, c, fake, ids = w
    ch = applied(c, ids[1])
    with app.state.db.connection() as conn:
        with pytest.raises(ApiError) as e:
            nvr_write.rollback(with_nvr(settings), conn, None, ch["id"])
    assert e.value.code == "not_rollbackable" and len(fake.writes) == 1


def test_change_log_filter_by_camera(w):
    app, c, fake, ids = w
    applied(c, ids[1])
    r = put(c, ids[2], "201", {"svc": False})
    assert r.status_code == 200
    by1 = c.get(f"/api/v1/nvr/changes?camera_id={ids[1]}").json()["changes"]
    assert [x["camera_id"] for x in by1] == [ids[1]] and by1[0]["stream_ref"] == "101" and by1[0]["has_before"] is True
    assert len(c.get("/api/v1/nvr/changes").json()["changes"]) == 2
    assert "before_xml" not in json.dumps(by1)
