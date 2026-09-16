"""Custom roles and delegated administration (T082): a custom role is ordinary permissions plus explicit sensitive
grants and never a system permission; it authorizes immediately, changes show their impact first and take effect
on the next request, deletion is refused while bound; a site admin assigns only allowlisted roles, only what they
hold at that scope, only to users, only inside their scope; the allowlist is a setting."""
from __future__ import annotations

from conftest import as_user, bind, png_bytes, seed_tree
from fastapi.testclient import TestClient

from smplwise.main import create_app


def _setup(settings):
    app = create_app(settings)
    c = TestClient(app)
    ids = seed_tree(c)
    f2 = ids["floor2"]
    cam = c.post("/api/v1/cameras", json={"channel": 1, "alias": "לובי"}).json()["id"]
    asset = c.post(f"/api/v1/floors/{f2}/plan-assets", files={"file": ("plan.png", png_bytes(), "image/png")}).json()
    v = c.post(f"/api/v1/floors/{f2}/plan-versions", json={"asset_id": asset["id"]}).json()
    c.post(f"/api/v1/plan-versions/{v['id']}/publish")
    c.post(f"/api/v1/floors/{f2}/anchors", json={"resource_type": "camera", "resource_id": cam, "x": 0.3, "y": 0.3})
    return app, c, ids, cam


def test_custom_role_lifecycle_and_impact(settings):
    app, c, ids, cam = _setup(settings)
    f2 = ids["floor2"]
    # validation: sensitive only in the sensitive list, no system permissions, known names
    base = {"name": "שומר לילה", "description": "לייב, אירועים וייצוא", "permissions": ["map.read", "video.live", "events.read"], "sensitive": ["video.export"]}
    assert c.post("/api/v1/access/roles", json={**base, "permissions": base["permissions"] + ["video.export"], "sensitive": []}).json()["code"] == "sensitive_in_permissions"
    assert c.post("/api/v1/access/roles", json={**base, "permissions": base["permissions"] + ["system.configure"]}).json()["code"] == "system_permission_not_allowed"
    assert c.post("/api/v1/access/roles", json={**base, "permissions": ["not.a.permission"]}).json()["code"] == "permission_unknown"
    assert c.post("/api/v1/access/roles", json={**base, "sensitive": ["map.read"]}).json()["code"] == "not_sensitive"
    assert c.post("/api/v1/access/roles", json={**base, "name": "צופה"}).status_code == 409, "built-in names are reserved"
    r = c.post("/api/v1/access/roles", json=base)
    assert r.status_code == 201, r.text
    role = r.json()
    assert role["id"].startswith("custom-") and role["custom"] is True and role["revision"] == 1 and role["permissions"] == ["events.read", "map.read", "video.export", "video.live"]
    assert role["sensitive_included"] == ["video.export"] and role["system_role"] is False and role["delegable"] is False and role["created_by_username"]
    listed = c.get("/api/v1/access/roles").json()
    assert any(x["id"] == role["id"] for x in listed["roles"]) and listed["can_manage_roles"] is True and "rbac.assign" not in listed["system_permissions"]
    # the role authorizes at once through a binding
    c.get("/api/v1/me", headers=as_user("guard"))
    b = c.post("/api/v1/access/bindings", json={"subject_kind": "user", "subject_id": "dev-guard", "role_id": role["id"], "scope_type": "floor", "scope_id": f2})
    assert b.status_code == 201, b.text
    g = as_user("guard")
    assert c.get(f"/api/v1/floors/{f2}/map", headers=g).status_code == 200
    assert c.get(f"/api/v1/media/live/{cam}", headers=g).status_code == 200
    assert c.post("/api/v1/exports", json={"camera_id": cam, "from_at": "2026-09-16T08:00:00Z", "to_at": "2026-09-16T08:01:00Z"}, headers=g).status_code == 409, "export granted (stops at the missing track), playback not"
    assert c.get(f"/api/v1/cameras/{cam}/recordings?date=2026-09-16", headers=g).status_code == 403
    me = c.get("/api/v1/me", headers=g).json()
    assert me["bindings"][0]["role_id"] == role["id"]
    # preview the impact of removing the export grant: one user, one binding, the removed permission named
    pv = c.post("/api/v1/access/roles/preview", json={"role_id": role["id"], "permissions": base["permissions"], "sensitive": []}).json()
    assert pv["bindings"] == 1 and [u["id"] for u in pv["users"]] == ["dev-guard"] and pv["removed"] == ["video.export"] and pv["added"] == [] and pv["scopes"]
    # a stale revision is refused; the change applies on the next request of the open session
    assert c.patch(f"/api/v1/access/roles/{role['id']}", json={**base, "sensitive": [], "revision": 7}).status_code == 409
    upd = c.patch(f"/api/v1/access/roles/{role['id']}", json={**base, "sensitive": [], "revision": 1}).json()
    assert upd["revision"] == 2 and upd["impact"]["removed"] == ["video.export"] and upd["impact"]["users"][0]["id"] == "dev-guard"
    assert c.post("/api/v1/exports", json={"camera_id": cam, "from_at": "2026-09-16T08:00:00Z", "to_at": "2026-09-16T08:01:00Z"}, headers=g).status_code == 403
    assert c.get(f"/api/v1/floors/{f2}/map", headers=g).status_code == 200
    # built-ins are immutable; a bound role cannot be deleted; after revocation it can
    assert c.patch("/api/v1/access/roles/viewer", json={**base, "revision": 1}).json()["code"] == "builtin_role"
    assert c.delete("/api/v1/access/roles/operator").json()["code"] == "builtin_role"
    d = c.delete(f"/api/v1/access/roles/{role['id']}")
    assert d.status_code == 409 and d.json()["code"] == "role_in_use" and d.json()["details"]["bindings"] == 1
    assert c.delete(f"/api/v1/access/bindings/{b.json()['id']}").status_code == 200
    assert c.delete(f"/api/v1/access/roles/{role['id']}").status_code == 200
    assert not any(x["id"] == role["id"] for x in c.get("/api/v1/access/roles").json()["roles"])
    assert c.get(f"/api/v1/floors/{f2}/map", headers=g).status_code == 403
    with app.state.db.connection() as conn:
        actions = [r[0] for r in conn.execute("SELECT action FROM audit_log WHERE action LIKE 'rbac.role.%'").fetchall()]
    assert actions == ["rbac.role.create", "rbac.role.update", "rbac.role.delete"]
    # nobody without rbac.roles.manage creates roles
    bind(c, settings, "omer", "operator", "installation", "*")
    assert c.post("/api/v1/access/roles", json=base, headers=as_user("omer")).status_code == 403


def test_delegated_site_admin_limits(settings):
    app, c, ids, cam = _setup(settings)
    f2, f3, site = ids["floor2"], ids["floor3"], ids["site"]
    other_site = c.post("/api/v1/sites", json={"name": "אתר אחר"}).json()["id"]
    other_bld = c.post(f"/api/v1/sites/{other_site}/buildings", json={"name": "מבנה"}).json()["id"]
    other_floor = c.post(f"/api/v1/buildings/{other_bld}/floors", json={"name": "קומה", "level": 1}).json()["id"]
    bind(c, settings, "sara", "site_admin", "site", site)
    s = as_user("sara")
    for u in ("vera", "dan"):
        c.get("/api/v1/me", headers=as_user(u))
    grp = c.post("/api/v1/access/groups", json={"name": "שומרים"}).json()["id"]
    # allowed: an allowlisted role, inside her site, to a user
    ok = c.post("/api/v1/access/bindings", json={"subject_kind": "user", "subject_id": "dev-vera", "role_id": "operator", "scope_type": "floor", "scope_id": f2}, headers=s)
    assert ok.status_code == 201, ok.text
    assert c.get(f"/api/v1/floors/{f2}/map", headers=as_user("vera")).status_code == 200
    # refused: outside her scope, system roles, roles she does not hold, groups, roles off the allowlist
    assert c.post("/api/v1/access/bindings", json={"subject_kind": "user", "subject_id": "dev-dan", "role_id": "viewer", "scope_type": "floor", "scope_id": other_floor}, headers=s).status_code == 403
    assert c.post("/api/v1/access/bindings", json={"subject_kind": "user", "subject_id": "dev-dan", "role_id": "system_admin", "scope_type": "site", "scope_id": site}, headers=s).status_code in (403, 422)
    assert c.post("/api/v1/access/bindings", json={"subject_kind": "group", "subject_id": grp, "role_id": "viewer", "scope_type": "floor", "scope_id": f3}, headers=s).json()["code"] == "delegation_groups"
    assert c.post("/api/v1/access/bindings", json={"subject_kind": "user", "subject_id": "dev-dan", "role_id": "site_admin", "scope_type": "floor", "scope_id": f3}, headers=s).json()["code"] == "role_not_delegable"
    # a custom role above her own permissions cannot be delegated even when allowlisted; a delegable custom role within them can
    big = c.post("/api/v1/access/roles", json={"name": "מגבה", "permissions": ["map.read"], "sensitive": ["nvr.config.write"], "delegable": True}).json()
    esc = c.post("/api/v1/access/bindings", json={"subject_kind": "user", "subject_id": "dev-dan", "role_id": big["id"], "scope_type": "floor", "scope_id": f3}, headers=s)
    assert esc.status_code == 403 and esc.json()["code"] == "delegation_escalation" and esc.json()["details"]["missing"] == ["nvr.config.write"]
    small = c.post("/api/v1/access/roles", json={"name": "צופה אירועים", "permissions": ["map.read", "video.live", "events.read"], "delegable": True}).json()
    assert c.post("/api/v1/access/bindings", json={"subject_kind": "user", "subject_id": "dev-dan", "role_id": small["id"], "scope_type": "floor", "scope_id": f2}, headers=s).status_code == 201
    assert c.get("/api/v1/events", headers=as_user("dan")).status_code == 200, "floor 2 carries the camera, so the delegated role sees its events"
    assert c.get(f"/api/v1/floors/{f2}/map", headers=as_user("dan")).status_code == 200
    # the allowlist is a setting: remove operator → the next delegated assignment of operator is refused; system roles cannot be listed
    d = c.get("/api/v1/access/delegation").json()
    assert set(d["delegable_roles"]) >= {"viewer", "operator", "editor", "kiosk", big["id"], small["id"]} and len(d["rules"]) == 5
    assert c.put("/api/v1/access/delegation", json={"delegable_roles": ["viewer", "system_admin"]}).json()["code"] == "system_role_not_delegable"
    assert c.put("/api/v1/access/delegation", json={"delegable_roles": ["viewer"]}, headers=s).status_code == 403
    assert c.put("/api/v1/access/delegation", json={"delegable_roles": ["viewer"]}).status_code == 200
    assert c.post("/api/v1/access/bindings", json={"subject_kind": "user", "subject_id": "dev-dan", "role_id": "operator", "scope_type": "floor", "scope_id": f2}, headers=s).json()["code"] == "role_not_delegable"
    assert c.post("/api/v1/access/bindings", json={"subject_kind": "user", "subject_id": "dev-dan", "role_id": "viewer", "scope_type": "floor", "scope_id": f2}, headers=s).status_code == 201
    with app.state.db.connection() as conn:
        denied = {r[0] for r in conn.execute("SELECT reason FROM audit_log WHERE decision = 'denied' AND actor_username = 'sara'").fetchall()}
    assert {"role_not_delegable", "delegation_escalation", "delegation_groups"} <= denied
