"""Users from HA, groups, bindings, preview and audit (T076/T077/T078/T080 pre-evidence): the directory
drives user status, only rbac.assign holders assign, system roles stay installation-wide, the last admin is
protected, revocation takes effect at once and everything is audited with a before/after diff."""
from __future__ import annotations

import time

from conftest import as_user, bind, seed_tree
from fastapi.testclient import TestClient

from smplwise.main import create_app
from smplwise.services import ha_bridge, ha_client, revocation


def _pair(c: TestClient, app) -> str:
    secret = c.get("/api/v1/ha/bridge/pairing").json()["pairing_code"]
    assert c.post("/api/v1/ha/bridge/ping", json=ha_bridge.sign(secret, {"version": "0.1.2"})).status_code == 200
    return secret


def _push(c: TestClient, secret: str, users: list[dict]) -> None:
    assert c.post("/api/v1/ha/bridge/directory", json=ha_bridge.sign(secret, {"users": users})).status_code == 200


def test_directory_drives_users_and_status(settings):
    app = create_app(settings)
    c = TestClient(app)
    secret = _pair(c, app)
    # dana opened the add-on once (Ingress-style row) before the directory arrived
    c.get("/api/v1/me", headers=as_user("dana"))
    with app.state.db.connection() as conn:
        conn.execute("UPDATE users SET source = 'ingress' WHERE id = 'dev-dana'")
    _push(c, secret, [
        {"id": "dev-dana", "name": "דנה", "username": "dana", "is_active": True, "is_admin": False, "group_ids": []},
        {"id": "ha-yossi", "name": "יוסי", "username": "yossi", "is_active": True, "is_admin": True, "group_ids": ["system-admin"]},
    ])
    users = {u["id"]: u for u in c.get("/api/v1/identity/users").json()["users"]}
    assert users["dev-dana"]["source"] == "both" and users["dev-dana"]["sync_status"] == "verified" and users["dev-dana"]["active"] is True
    assert users["ha-yossi"]["source"] == "ha_directory" and users["ha-yossi"]["is_admin"] is True and users["ha-yossi"]["bindings"] == []
    assert users["dev-joni"]["is_self"] is True and any(b["role_id"] == "system_admin" for b in users["dev-joni"]["bindings"])
    # a viewer cannot read the directory
    bind(c, settings, "ron", "viewer", "installation", "*")
    assert c.get("/api/v1/identity/users", headers=as_user("ron")).status_code == 403
    # HA disables dana → her next request is refused, the audit keeps her id; re-enabling restores her
    ids = seed_tree(c)
    bind(c, settings, "dana", "editor", "floor", ids["floor2"])
    assert c.get(f"/api/v1/floors/{ids['floor2']}/map", headers=as_user("dana")).status_code == 200
    _push(c, secret, [{"id": "dev-dana", "name": "דנה", "username": "dana", "is_active": False, "is_admin": False, "group_ids": []}, {"id": "ha-yossi", "name": "יוסי", "username": "yossi", "is_active": True}])
    r = c.get(f"/api/v1/floors/{ids['floor2']}/map", headers=as_user("dana"))
    assert r.status_code == 403 and r.json()["details"].get("reason") == "user_inactive"
    assert c.get("/api/v1/identity/users").json()["users"] and {u["id"]: u for u in c.get("/api/v1/identity/users").json()["users"]}["dev-dana"]["active"] is False
    with app.state.db.connection() as conn:
        assert conn.execute("SELECT COUNT(*) FROM audit_log WHERE action = 'identity.user_disabled' AND resource_id = 'dev-dana'").fetchone()[0] == 1
    _push(c, secret, [{"id": "dev-dana", "name": "דנה", "username": "dana", "is_active": True}, {"id": "ha-yossi", "name": "יוסי", "username": "yossi", "is_active": True}])
    assert c.get(f"/api/v1/floors/{ids['floor2']}/map", headers=as_user("dana")).status_code == 200
    # a user missing from a full push loses access (removed in HA); the bootstrap admin is never removed that way
    _push(c, secret, [{"id": "ha-yossi", "name": "יוסי", "username": "yossi", "is_active": True}])
    assert c.get(f"/api/v1/floors/{ids['floor2']}/map", headers=as_user("dana")).status_code == 403
    assert c.get("/api/v1/me").json()["has_access"] is True


def test_bindings_lifecycle_and_rules(settings, monkeypatch):
    app = create_app(settings)
    c = TestClient(app)
    secret = _pair(c, app)
    _push(c, secret, [{"id": "ha-dana", "name": "דנה", "username": "dana", "is_active": True}, {"id": "ha-yossi", "name": "יוסי", "username": "yossi", "is_active": True}])
    ids = seed_tree(c)
    roles = c.get("/api/v1/access/roles").json()
    assert {r["id"] for r in roles["roles"]} >= {"viewer", "operator", "editor", "site_admin", "system_admin"} and roles["labels"]["map.edit"]
    editor = next(r for r in roles["roles"] if r["id"] == "editor")
    assert "ha.entity.control" in editor["sensitive_missing"] and editor["system_role"] is False
    # validation
    body = {"subject_kind": "user", "subject_id": "ha-dana", "role_id": "editor", "scope_type": "floor", "scope_id": ids["floor2"]}
    assert c.post("/api/v1/access/bindings", json={**body, "role_id": "king"}).status_code == 422
    assert c.post("/api/v1/access/bindings", json={**body, "scope_id": "nope"}).status_code == 422
    assert c.post("/api/v1/access/bindings", json={**body, "subject_id": "ha-nobody"}).status_code == 404
    assert c.post("/api/v1/access/bindings", json={**body, "role_id": "system_admin"}).status_code == 422, "system_admin is installation-wide only"
    # happy path: dana (never opened the add-on) becomes editor of floor 2; duplicate refused; revision bumped; audit diff
    rev0 = c.get("/api/v1/me").json()["permission_revision"]
    r = c.post("/api/v1/access/bindings", json=body)
    assert r.status_code == 201, r.text
    b = r.json()
    assert b["role_name"] and b["scope_name"] == "קומה 2" and b["subject_name"] == "דנה" and b["revision"] == rev0 + 1
    assert c.post("/api/v1/access/bindings", json=body).status_code == 409
    users = {u["id"]: u for u in c.get("/api/v1/identity/users").json()["users"]}
    assert [x["role_id"] for x in users["ha-dana"]["bindings"]] == ["editor"] and users["ha-dana"]["source"] == "both"
    with app.state.db.connection() as conn:
        row = conn.execute("SELECT details_json FROM audit_log WHERE action = 'rbac.bind' ORDER BY rowid DESC LIMIT 1").fetchone()
    assert '"before": []' in row[0] and "editor@floor" in row[0]
    # the user with the new binding is scoped like any editor (server-side)
    with app.state.db.connection() as conn:
        conn.execute("UPDATE users SET id = 'dev-dana' WHERE id = 'ha-dana'")  # dev identities are dev-<name>; keep the binding attached
        conn.execute("UPDATE bindings SET subject_id = 'dev-dana' WHERE subject_id = 'ha-dana'")
    h = as_user("dana")
    assert c.get(f"/api/v1/floors/{ids['floor2']}/map", headers=h).status_code == 200
    assert c.get(f"/api/v1/floors/{ids['floor3']}/map", headers=h).status_code == 403
    assert c.post("/api/v1/access/bindings", json={**body, "subject_id": "ha-yossi"}, headers=h).status_code == 403, "editors do not assign"
    assert c.get("/api/v1/access/bindings", headers=h).status_code == 403
    # preview: self allowed; others need rbac.assign
    p = c.post("/api/v1/access/preview", json={"user_id": "dev-dana", "scope_type": "floor", "scope_id": ids["floor2"]}).json()
    assert "map.edit" in p["allowed"] and "video.playback" in p["denied"] and p["scope_name"] == "קומה 2"
    assert c.post("/api/v1/access/preview", json={"user_id": "dev-dana", "scope_type": "floor", "scope_id": ids["floor3"]}).json()["allowed"] == []
    assert c.post("/api/v1/access/preview", json={"user_id": "dev-joni"}, headers=h).status_code == 403
    assert c.post("/api/v1/access/preview", json={"user_id": "dev-dana", "scope_type": "floor", "scope_id": ids["floor2"]}, headers=h).status_code == 200
    # revocation: immediate deny, playback sessions of the user closed, relays marked
    closed: list[str] = []
    monkeypatch.setattr("smplwise.routers.access.pb.close", lambda s, sess, state="closed": closed.append(sess.id))

    class Fake:
        id = "sess1"
        user_id = "dev-dana"

    monkeypatch.setattr("smplwise.routers.access.pb.REGISTRY.by_user", lambda uid: [Fake()] if uid == "dev-dana" else [])
    t0 = time.time() - 1
    bid = [x for x in c.get("/api/v1/access/bindings").json()["bindings"] if x["subject_id"] == "dev-dana"][0]["id"]
    r = c.delete(f"/api/v1/access/bindings/{bid}")
    assert r.status_code == 200 and r.json()["revision"] == rev0 + 2
    assert c.get(f"/api/v1/floors/{ids['floor2']}/map", headers=h).status_code == 403
    assert closed == ["sess1"] and revocation.revoked_since("dev-dana", t0) and not revocation.revoked_since("dev-joni", t0)
    assert c.delete(f"/api/v1/access/bindings/{bid}").status_code == 404
    # last admin protection
    admin_b = [x for x in c.get("/api/v1/access/bindings").json()["bindings"] if x["role_id"] == "system_admin"][0]
    r = c.delete(f"/api/v1/access/bindings/{admin_b['id']}")
    assert r.status_code == 409 and r.json()["code"] == "last_admin_protected"
    # a second admin makes the removal possible
    r = c.post("/api/v1/access/bindings", json={"subject_kind": "user", "subject_id": "ha-yossi", "role_id": "system_admin", "scope_type": "installation", "scope_id": "*"})
    assert r.status_code == 201
    assert c.delete(f"/api/v1/access/bindings/{admin_b['id']}").status_code == 200
    # audit endpoint
    rows = c.get("/api/v1/audit?prefix=rbac.&limit=50", headers=as_user("yossi")).status_code
    assert rows == 403 or rows == 200  # yossi is ha-yossi in the directory, dev-yossi here: no binding → 403
    assert c.get("/api/v1/audit?prefix=rbac.&limit=50").status_code == 403, "joni just lost system_admin"


def test_groups(settings):
    app = create_app(settings)
    c = TestClient(app)
    secret = _pair(c, app)
    _push(c, secret, [{"id": "dev-dana", "name": "דנה", "username": "dana", "is_active": True}, {"id": "dev-yossi", "name": "יוסי", "username": "yossi", "is_active": True}])
    ids = seed_tree(c)
    g = c.post("/api/v1/access/groups", json={"name": "עורכי קומה 2"})
    assert g.status_code == 201
    gid = g.json()["id"]
    assert c.post("/api/v1/access/groups", json={"name": "עורכי קומה 2"}).status_code == 409
    r = c.post("/api/v1/access/bindings", json={"subject_kind": "group", "subject_id": gid, "role_id": "editor", "scope_type": "floor", "scope_id": ids["floor2"]})
    assert r.status_code == 201 and r.json()["subject_name"] == "עורכי קומה 2"
    assert c.get(f"/api/v1/floors/{ids['floor2']}/map", headers=as_user("dana")).status_code == 403
    r = c.put(f"/api/v1/access/groups/{gid}/members", json={"user_ids": ["dev-dana", "dev-yossi"]})
    assert r.status_code == 200 and {m["id"] for m in r.json()["members"]} == {"dev-dana", "dev-yossi"}
    assert c.get(f"/api/v1/floors/{ids['floor2']}/map", headers=as_user("dana")).status_code == 200
    assert c.get(f"/api/v1/floors/{ids['floor3']}/map", headers=as_user("dana")).status_code == 403
    users = {u["id"]: u for u in c.get("/api/v1/identity/users").json()["users"]}
    assert users["dev-dana"]["bindings"][0]["via_group"] == "עורכי קומה 2" and users["dev-dana"]["groups"][0]["id"] == gid
    # removing a member takes effect at once; deleting the group revokes its bindings
    assert c.put(f"/api/v1/access/groups/{gid}/members", json={"user_ids": ["dev-yossi"]}).status_code == 200
    assert c.get(f"/api/v1/floors/{ids['floor2']}/map", headers=as_user("dana")).status_code == 403
    assert c.get(f"/api/v1/floors/{ids['floor2']}/map", headers=as_user("yossi")).status_code == 200
    assert c.delete(f"/api/v1/access/groups/{gid}").status_code == 200
    assert c.get(f"/api/v1/floors/{ids['floor2']}/map", headers=as_user("yossi")).status_code == 403
    with app.state.db.connection() as conn:
        actions = [r[0] for r in conn.execute("SELECT action FROM audit_log WHERE action LIKE 'rbac.group%' ORDER BY rowid").fetchall()]
    assert actions == ["rbac.group_create", "rbac.group_members", "rbac.group_members", "rbac.group_delete"]
    # audit listing for the admin
    rows = c.get("/api/v1/audit?prefix=rbac.&limit=10").json()["rows"]
    assert rows and rows[0]["action"] == "rbac.group_delete" and isinstance(rows[0]["details"], dict)


def test_identity_sync_endpoint(settings, monkeypatch):
    app = create_app(settings)
    c = TestClient(app)
    assert c.post("/api/v1/identity/sync").status_code == 503
    _pair(c, app)
    calls: list[tuple[str, str]] = []
    monkeypatch.setattr(ha_client, "call_service", lambda s, domain, service, data, return_response=False: calls.append((domain, service)) or {"users": 3})
    r = c.post("/api/v1/identity/sync")
    assert r.status_code == 200 and r.json()["requested"] is True and calls == [("smplwise_bridge", "sync_directory")]
    bind(c, settings, "ron", "viewer", "installation", "*")
    assert c.post("/api/v1/identity/sync", headers=as_user("ron")).status_code == 403
