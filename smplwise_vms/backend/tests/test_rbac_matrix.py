"""Spatial RBAC matrix and audit (T055): the same requests answered per user, role and scope across map, live,
playback, events, cases, exports, plan publishing, placements, HA actions, storage and access administration; an
explicit deny beats an inherited allow; every refusal is audited with its reason; audit reading is restricted; a
revoked binding takes effect on the next request of an open session; audit rows age out by retention."""
from __future__ import annotations

import datetime as dt
import json

from conftest import as_user, bind, png_bytes, seed_tree
from fastapi.testclient import TestClient

from smplwise import audit as audit_mod
from smplwise.db import Database, new_id, now_iso, permission_revision
from smplwise.main import create_app
from smplwise.services import ha_sync


def _event(app, eid: str, camera_id: str) -> None:
    occurred = (dt.datetime.now(dt.timezone.utc) - dt.timedelta(minutes=5)).strftime("%Y-%m-%dT%H:%M:%SZ")
    with app.state.db.connection() as conn:
        conn.execute(
            "INSERT INTO events(id, source, raw_type, type, camera_id, channel, occurred_at, ended_at, received_at, state, count, severity, confidence, details_json, dedup_key, created_at) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)",
            (eid, "alertstream", "VMD", "motion", camera_id, 1, occurred, None, occurred, "inactive", 1, "info", "measured", json.dumps({}), f"t:{eid}", occurred),
        )


def _deny(settings, username: str, role: str, scope_type: str, scope_id: str) -> None:
    with Database(settings.db_path).connection() as conn:
        conn.execute(
            "INSERT INTO bindings(id, subject_kind, subject_id, role_id, scope_type, scope_id, effect, permission_revision, assigned_by, created_at) VALUES (?, 'user', ?, ?, ?, ?, 'deny', ?, 'test', ?)",
            (new_id(), f"dev-{username}", role, scope_type, scope_id, permission_revision(conn), now_iso()),
        )


def _seed(app, c, settings):
    ids = seed_tree(c)
    f2, f3 = ids["floor2"], ids["floor3"]
    cam2 = c.post("/api/v1/cameras", json={"channel": 1, "alias": "לובי"}).json()["id"]
    cam3 = c.post("/api/v1/cameras", json={"channel": 2, "alias": "חניה"}).json()["id"]
    drafts = {}
    for fid in (f2, f3):
        asset = c.post(f"/api/v1/floors/{fid}/plan-assets", files={"file": ("plan.png", png_bytes(), "image/png")}).json()
        v = c.post(f"/api/v1/floors/{fid}/plan-versions", json={"asset_id": asset["id"]}).json()
        assert c.post(f"/api/v1/plan-versions/{v['id']}/publish").status_code == 200
        drafts[fid] = c.post(f"/api/v1/floors/{fid}/plan-versions", json={"asset_id": asset["id"], "rotation": 90}).json()["id"]
    assert c.post(f"/api/v1/floors/{f2}/anchors", json={"resource_type": "camera", "resource_id": cam2, "x": 0.3, "y": 0.3}).status_code == 201
    assert c.post(f"/api/v1/floors/{f3}/anchors", json={"resource_type": "camera", "resource_id": cam3, "x": 0.6, "y": 0.6}).status_code == 201
    _event(app, "e2", cam2)
    _event(app, "e3", cam3)
    with app.state.db.connection() as conn:
        ha_sync.upsert_state(conn, {"entity_id": "lock.front", "state": "locked", "last_changed": "2026-09-16T09:00:00+00:00", "attributes": {"friendly_name": "מנעול"}})
    case = c.post("/api/v1/cases", json={"title": "מטריצה"}).json()
    for eid in ("e2", "e3"):
        assert c.post(f"/api/v1/cases/{case['id']}/items", json={"kind": "event", "event_id": eid}).status_code == 201
    # users: viewer / operator / editor of floor 2, site admin of the site, an installation-wide operator denied on floor 2
    bind(c, settings, "vera", "viewer", "floor", f2)
    bind(c, settings, "omer", "operator", "floor", f2)
    bind(c, settings, "eli", "editor", "floor", f2)
    bind(c, settings, "sara", "site_admin", "site", ids["site"])
    bind(c, settings, "dan", "operator", "installation", "*")
    _deny(settings, "dan", "operator", "floor", f2)
    return ids, cam2, cam3, drafts, case["id"]


def test_matrix_by_role_scope_and_deny(settings):
    app = create_app(settings)
    c = TestClient(app)
    ids, cam2, cam3, drafts, case_id = _seed(app, c, settings)
    f2, f3 = ids["floor2"], ids["floor3"]
    H = {u: as_user(u) for u in ("vera", "omer", "eli", "sara", "dan")}

    def st(user: str, method: str, path: str, **kw) -> int:
        return getattr(c, method)(path, headers=H[user], **kw).status_code

    # map.read: floor scope, site inheritance, explicit deny on floor 2 for the installation-wide operator
    assert [st(u, "get", f"/api/v1/floors/{f2}/map") for u in ("vera", "omer", "eli", "sara", "dan")] == [200, 200, 200, 200, 403]
    assert [st(u, "get", f"/api/v1/floors/{f3}/map") for u in ("vera", "omer", "eli", "sara", "dan")] == [403, 403, 403, 200, 200]
    # video.live per camera through its placement
    assert [st(u, "get", f"/api/v1/media/live/{cam2}") for u in ("vera", "omer", "sara", "dan")] == [200, 200, 200, 403]
    assert [st(u, "get", f"/api/v1/media/live/{cam3}") for u in ("vera", "omer", "sara", "dan")] == [403, 403, 200, 200]
    # video.playback: the viewer has none; allowed users reach the NVR step (503 here: no NVR), never a 403
    assert st("vera", "get", f"/api/v1/cameras/{cam2}/recordings?date=2026-09-16") == 403
    assert st("omer", "get", f"/api/v1/cameras/{cam2}/recordings?date=2026-09-16") in (409, 503), "allowed: stops at the missing track / NVR, never 403"
    assert st("omer", "get", f"/api/v1/cameras/{cam3}/recordings?date=2026-09-16") == 403
    assert st("dan", "get", f"/api/v1/cameras/{cam2}/recordings?date=2026-09-16") == 403 and st("dan", "get", f"/api/v1/cameras/{cam3}/recordings?date=2026-09-16") in (409, 503)
    # events.read: server-side filtering of the list, even when another camera is requested explicitly
    assert st("vera", "get", "/api/v1/events") == 403
    assert [e["id"] for e in c.get("/api/v1/events", headers=H["omer"]).json()["events"]] == ["e2"]
    assert c.get(f"/api/v1/events?camera_id={cam3}", headers=H["omer"]).json()["events"] == []
    assert [e["id"] for e in c.get("/api/v1/events", headers=H["dan"]).json()["events"]] == ["e3"]
    assert st("omer", "get", "/api/v1/events/e3") == 403 and st("omer", "get", "/api/v1/events/e2") == 200
    assert st("omer", "get", "/api/v1/events/e3/correlation") == 403
    # video.export: separate grant; the allowed path stops at the missing track (409), the refused one at 403
    body = {"camera_id": cam2, "from_at": "2026-09-16T08:00:00Z", "to_at": "2026-09-16T08:01:00Z"}
    assert st("vera", "post", "/api/v1/exports", json=body) == 403
    assert st("omer", "post", "/api/v1/exports", json=body) == 409
    assert st("omer", "post", "/api/v1/exports", json={**body, "camera_id": cam3}) == 403
    assert st("eli", "post", "/api/v1/exports", json=body) == 403, "map editing is not video export"
    # placement.edit and map.publish per floor
    anchor = {"resource_type": "ha_entity", "resource_id": "lock.front", "x": 0.2, "y": 0.2, "layer_id": "doors"}
    assert st("eli", "post", f"/api/v1/floors/{f3}/anchors", json=anchor) == 403
    assert st("vera", "post", f"/api/v1/floors/{f2}/anchors", json=anchor) == 403
    assert st("eli", "post", f"/api/v1/floors/{f2}/anchors", json=anchor) == 201
    zone = {"name": "z", "kind": "room", "polygon": [{"x": 0.1, "y": 0.1}, {"x": 0.4, "y": 0.1}, {"x": 0.4, "y": 0.4}]}
    assert st("omer", "post", f"/api/v1/floors/{f2}/zones", json=zone) == 403 and st("eli", "post", f"/api/v1/floors/{f2}/zones", json=zone) == 201
    assert st("vera", "post", f"/api/v1/plan-versions/{drafts[f2]}/publish") == 403
    assert st("eli", "post", f"/api/v1/plan-versions/{drafts[f3]}/publish") == 403
    assert st("eli", "post", f"/api/v1/plan-versions/{drafts[f2]}/publish") == 200
    assert st("sara", "post", f"/api/v1/plan-versions/{drafts[f3]}/publish") == 200
    # cases: reading needs events.read; items outside the reader's cameras are hidden; adding needs playback on that camera
    assert st("vera", "get", "/api/v1/cases") == 403
    d = c.get(f"/api/v1/cases/{case_id}", headers=H["omer"]).json()
    assert d["can_manage"] is True and [i["event_id"] for i in d["items"]] == ["e2"] and d["hidden_items"] == 1
    d = c.get(f"/api/v1/cases/{case_id}", headers=H["dan"]).json()
    assert [i["event_id"] for i in d["items"]] == ["e3"] and d["hidden_items"] == 1
    other = c.post("/api/v1/cases", json={"title": "של עומר"}, headers=H["omer"]).json()
    assert st("omer", "post", f"/api/v1/cases/{other['id']}/items", json={"kind": "event", "event_id": "e3"}) == 403
    assert st("omer", "post", f"/api/v1/cases/{other['id']}/items", json={"kind": "event", "event_id": "e2"}) == 201
    # HA control, storage and access administration are separate grants
    action = {"allowed_action_id": "lock.unlock", "client_request_id": "r1", "expires_at": "2099-01-01T00:00:00Z"}
    assert st("vera", "post", "/api/v1/ha/entities/lock.front/actions", json=action) == 403
    assert st("sara", "get", "/api/v1/storage") == 403 and c.get("/api/v1/storage").status_code == 200
    binding = {"subject_kind": "user", "subject_id": "dev-vera", "role_id": "operator", "scope_type": "floor", "scope_id": f2}
    assert st("omer", "post", "/api/v1/access/bindings", json=binding) == 403
    assert st("sara", "post", "/api/v1/access/bindings", json={**binding, "role_id": "system_admin"}) in (403, 422), "a site admin never hands out system roles"
    assert st("sara", "post", "/api/v1/access/bindings", json=binding) == 201, "delegated: an allowlisted role inside her site (T082)"
    assert st("vera", "get", "/api/v1/audit") == 403 and st("sara", "get", "/api/v1/audit") == 403
    # every refusal is audited with its reason, without secrets
    rows = c.get("/api/v1/audit?prefix=&limit=500").json()
    denied = [r for r in rows.get("entries", rows.get("rows", [])) if r["decision"] == "denied"]
    assert any(r["actor_username"] == "dan" and r["reason"] == "explicit_deny" for r in denied)
    assert any(r["actor_username"] == "vera" and r["action"] == "video.export" and r["reason"] == "no_binding" for r in denied)
    assert any(r["actor_username"] == "eli" and r["action"] == "placement.edit" and r["resource_id"] == f3 for r in denied)
    assert not any("password" in json.dumps(r, ensure_ascii=False).lower() for r in denied)


def test_revocation_in_open_session_and_audit_retention(settings):
    app = create_app(settings)
    c = TestClient(app)
    ids = seed_tree(c)
    f2 = ids["floor2"]
    c.get("/api/v1/me", headers=as_user("tom"))
    b = c.post("/api/v1/access/bindings", json={"subject_kind": "user", "subject_id": "dev-tom", "role_id": "viewer", "scope_type": "floor", "scope_id": f2})
    assert b.status_code == 201, b.text
    assert c.get(f"/api/v1/floors/{f2}/map", headers=as_user("tom")).status_code == 200
    with Database(settings.db_path).connection() as conn:
        rev_before = permission_revision(conn)
    r = c.delete(f"/api/v1/access/bindings/{b.json()['id']}")
    assert r.status_code == 200 and r.json()["revision"] == rev_before + 1
    assert c.get(f"/api/v1/floors/{f2}/map", headers=as_user("tom")).status_code == 403, "the very next request of the open session is refused"
    # a user deactivated in the directory loses everything at once
    c.post("/api/v1/access/bindings", json={"subject_kind": "user", "subject_id": "dev-tom", "role_id": "viewer", "scope_type": "floor", "scope_id": f2})
    assert c.get(f"/api/v1/floors/{f2}/map", headers=as_user("tom")).status_code == 200
    with app.state.db.connection() as conn:
        conn.execute("UPDATE users SET active = 0 WHERE id = 'dev-tom'")
    assert c.get(f"/api/v1/floors/{f2}/map", headers=as_user("tom")).status_code == 403
    # audit retention: rows older than the retention are pruned, recent rows and the count survive
    with app.state.db.connection() as conn:
        conn.execute("INSERT INTO audit_log(at, action, decision) VALUES ('2020-01-01T00:00:00Z', 'old.thing', 'allowed')")
        before = conn.execute("SELECT COUNT(*) FROM audit_log").fetchone()[0]
        removed = audit_mod.prune(conn, audit_mod.RETENTION_DAYS)
        after = conn.execute("SELECT COUNT(*) FROM audit_log").fetchone()[0]
        assert removed == 1 and after == before - 1
        assert conn.execute("SELECT COUNT(*) FROM audit_log WHERE action = 'old.thing'").fetchone()[0] == 0
        assert conn.execute("SELECT COUNT(*) FROM audit_log WHERE action = 'rbac.bind'").fetchone()[0] >= 2
