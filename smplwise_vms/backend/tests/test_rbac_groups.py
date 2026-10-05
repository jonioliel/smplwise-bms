"""Groups and delegated administration (T082, R163/R164): group lifecycle with rbac.roles.manage, a revision guard,
delete refused while in use, effective permissions = union of user and group bindings (still per scope), the group
impact preview naming every affected user, delegated assignment for a site admin limited to the allow-list and to
their own scope (no self-escalation, no system/site-admin roles, no group outside their reach - the contract vector
delegated-group-cross-scope), the all-or-nothing bulk routes (permission before body, JSON only, caps) and audit rows
with ids only."""
from __future__ import annotations

import json

from conftest import as_user, bind, seed_tree
from fastapi.testclient import TestClient

from smplwise.main import create_app

S = as_user("sara")


def _setup(settings):
    app = create_app(settings)
    c = TestClient(app)
    ids = seed_tree(c)
    other_site = c.post("/api/v1/sites", json={"name": "אתר ב"}).json()["id"]
    other_bld = c.post(f"/api/v1/sites/{other_site}/buildings", json={"name": "מבנה ב"}).json()["id"]
    ids["other_site"] = other_site
    ids["other_floor"] = c.post(f"/api/v1/buildings/{other_bld}/floors", json={"name": "קומה ב1", "level": 1}).json()["id"]
    for u in ("vera", "dan", "tom", "sara"):
        c.get("/api/v1/me", headers=as_user(u))
    bind(c, settings, "sara", "site_admin", "site", ids["site"])
    return app, c, ids


def _group(c: TestClient, name: str) -> dict:
    r = c.post("/api/v1/access/groups", json={"name": name})
    assert r.status_code == 201, r.text
    return r.json()


def _get_group(c: TestClient, gid: str, headers=None) -> dict:
    return next(g for g in c.get("/api/v1/access/groups", headers=headers or {}).json()["groups"] if g["id"] == gid)


def _bind_group(c: TestClient, gid: str, role: str, scope_type: str, scope_id: str, headers=None, effect: str = "allow"):
    rev = _get_group(c, gid)["revision"]
    return c.post(f"/api/v1/access/groups/{gid}/bindings", json={"role_id": role, "scope_type": scope_type, "scope_id": scope_id, "effect": effect, "revision": rev}, headers=headers or {})


def _members(c: TestClient, gid: str, user_ids: list[str], headers=None, revision: int | None = None):
    rev = revision if revision is not None else _get_group(c, gid)["revision"]
    return c.put(f"/api/v1/access/groups/{gid}/members", json={"user_ids": user_ids, "revision": rev}, headers=headers or {})


def _preview(c: TestClient, user: str, scope_type: str, scope_id: str) -> list[str]:
    return c.post("/api/v1/access/preview", json={"user_id": f"dev-{user}", "scope_type": scope_type, "scope_id": scope_id}).json()["allowed"]


def test_group_lifecycle_revision_guard_and_audit(settings):
    app, c, ids = _setup(settings)
    # lifecycle needs rbac.roles.manage: a site admin (rbac.assign only) cannot create, rename or delete
    assert c.post("/api/v1/access/groups", json={"name": "x"}, headers=S).status_code == 403
    g = _group(c, "שומרי לילה")
    assert g["revision"] == 1 and g["members"] == [] and g["bindings"] == []
    assert c.post("/api/v1/access/groups", json={"name": "שומרי לילה"}).status_code == 409
    assert c.patch(f"/api/v1/access/groups/{g['id']}", json={"name": "אחר", "revision": 1}, headers=S).status_code == 403
    # rename with the revision guard
    stale = c.patch(f"/api/v1/access/groups/{g['id']}", json={"name": "משמרת לילה", "revision": 9})
    assert stale.status_code == 409 and stale.json()["code"] == "stale_revision" and stale.json()["details"]["current_revision"] == 1
    r = c.patch(f"/api/v1/access/groups/{g['id']}", json={"name": "משמרת לילה", "revision": 1})
    assert r.status_code == 200 and r.json()["name"] == "משמרת לילה" and r.json()["revision"] == 2
    # members and bindings move the revision; a stale one is refused for both
    assert _members(c, g["id"], ["dev-vera"], revision=1).json()["code"] == "stale_revision"
    m = _members(c, g["id"], ["dev-vera", "dev-dan"])
    assert m.status_code == 200 and m.json()["revision"] == 3
    b = c.post(f"/api/v1/access/groups/{g['id']}/bindings", json={"role_id": "viewer", "scope_type": "floor", "scope_id": ids["floor2"], "revision": 1})
    assert b.status_code == 409 and b.json()["code"] == "stale_revision"
    b = _bind_group(c, g["id"], "viewer", "floor", ids["floor2"])
    assert b.status_code == 201 and b.json()["group"]["revision"] == 4
    bid = b.json()["binding_id"]
    # delete is refused while the group has members or bindings, and with a stale revision
    d = c.delete(f"/api/v1/access/groups/{g['id']}")
    assert d.status_code == 409 and d.json()["code"] == "group_in_use" and d.json()["details"] == {"members": 2, "bindings": 1}
    assert c.delete(f"/api/v1/access/groups/{g['id']}/bindings/{bid}?revision=1").json()["code"] == "stale_revision"
    assert c.delete(f"/api/v1/access/groups/{g['id']}/bindings/{bid}?revision=4").status_code == 200
    assert c.delete(f"/api/v1/access/groups/{g['id']}").json()["details"] == {"members": 2, "bindings": 0}
    assert _members(c, g["id"], []).status_code == 200
    assert c.delete(f"/api/v1/access/groups/{g['id']}?revision=1").json()["code"] == "stale_revision"
    assert c.delete(f"/api/v1/access/groups/{g['id']}").status_code == 200
    assert c.get("/api/v1/access/groups").json()["groups"] == []
    # every change audited, ids only - the group's name never lands in the audit details
    with app.state.db.connection() as conn:
        rows = conn.execute("SELECT action, resource_id, details_json FROM audit_log WHERE decision = 'allowed' AND (action LIKE 'rbac.group%' OR (action LIKE 'rbac.%bind' AND resource_type = 'group')) ORDER BY rowid").fetchall()
    assert [r[0] for r in rows] == ["rbac.group_create", "rbac.group_rename", "rbac.group_members", "rbac.bind", "rbac.unbind", "rbac.group_members", "rbac.group_delete"]
    assert all(r[1] == g["id"] for r in rows)
    blob = " ".join(r[2] or "" for r in rows)
    assert "שומרי" not in blob and "משמרת" not in blob
    members_row = json.loads(rows[2][2])
    assert members_row["added"] == ["dev-vera", "dev-dan"] and members_row["removed"] == [] and members_row["group_revision"] == 3


def test_union_of_user_and_group_bindings_stays_per_scope(settings):
    app, c, ids = _setup(settings)
    f2, f3 = ids["floor2"], ids["floor3"]
    g = _group(c, "עורכי קומה 3")
    assert _bind_group(c, g["id"], "editor", "floor", f3).status_code == 201
    assert _members(c, g["id"], ["dev-vera"]).status_code == 200
    assert c.post("/api/v1/access/bindings", json={"subject_kind": "user", "subject_id": "dev-vera", "role_id": "operator", "scope_type": "floor", "scope_id": f2}).status_code == 201
    on_f2, on_f3 = set(_preview(c, "vera", "floor", f2)), set(_preview(c, "vera", "floor", f3))
    assert {"video.playback", "events.ack"} <= on_f2 and "map.edit" not in on_f2, "operator on floor 2 only"
    assert {"map.edit", "placement.edit"} <= on_f3 and "video.playback" not in on_f3, "editor via the group on floor 3 only"
    # the preview lists both sources; the group one names the group
    via = {b["role_id"]: b["via_group"] for b in c.post("/api/v1/access/preview", json={"user_id": "dev-vera", "scope_type": "floor", "scope_id": f3}).json()["bindings"]}
    assert via == {"operator": None, "editor": "עורכי קומה 3"}
    # leaving the group takes the group's grants away at once and leaves her own
    assert _members(c, g["id"], []).status_code == 200
    assert "map.edit" not in _preview(c, "vera", "floor", f3) and "video.playback" in _preview(c, "vera", "floor", f2)


def test_group_impact_preview_names_every_affected_user(settings):
    app, c, ids = _setup(settings)
    f2 = ids["floor2"]
    g = _group(c, "מפעילים")
    assert _members(c, g["id"], ["dev-vera", "dev-dan"]).status_code == 200
    im = c.post(f"/api/v1/access/groups/{g['id']}/impact", json={"op": "bind", "role_id": "operator", "scope_type": "floor", "scope_id": f2})
    assert im.status_code == 200, im.text
    body = im.json()
    assert [u["id"] for u in body["users"]] == ["dev-dan", "dev-vera"] and all(u["change"] == "member" for u in body["users"])
    assert all({"video.playback", "events.read", "map.read"} <= set(u["added"]) and u["removed"] == [] for u in body["users"])
    assert body["scopes"][0]["scope_id"] == f2 and body["revision"] == 2
    # nothing was written by the preview
    assert _get_group(c, g["id"])["bindings"] == [] and "video.playback" not in _preview(c, "vera", "floor", f2)
    b = _bind_group(c, g["id"], "operator", "floor", f2).json()
    # unbind: both lose; members: the one added gains, the one removed loses
    un = c.post(f"/api/v1/access/groups/{g['id']}/impact", json={"op": "unbind", "binding_id": b["binding_id"]}).json()
    assert {u["id"] for u in un["users"]} == {"dev-vera", "dev-dan"} and all("video.playback" in u["removed"] for u in un["users"])
    mem = c.post(f"/api/v1/access/groups/{g['id']}/impact", json={"op": "members", "user_ids": ["dev-vera", "dev-tom"]}).json()
    changes = {u["id"]: u for u in mem["users"]}
    assert changes["dev-tom"]["change"] == "added" and "video.playback" in changes["dev-tom"]["added"]
    assert changes["dev-dan"]["change"] == "removed" and "video.playback" in changes["dev-dan"]["removed"] and "dev-vera" not in changes
    assert {m["id"] for m in _get_group(c, g["id"])["members"]} == {"dev-dan", "dev-vera"}, "previews write nothing"
    # a delegated admin cannot preview outside her reach either
    assert c.post(f"/api/v1/access/groups/{g['id']}/impact", json={"op": "bind", "role_id": "viewer", "scope_type": "floor", "scope_id": ids["other_floor"]}, headers=S).status_code == 403


def test_delegated_site_admin_allow_list_scope_and_no_self_escalation(settings):
    app, c, ids = _setup(settings)
    f2, site = ids["floor2"], ids["site"]

    def bind_as_sara(subject: str, role: str, scope_type: str, scope_id: str):
        return c.post("/api/v1/access/bindings", json={"subject_kind": "user", "subject_id": subject, "role_id": role, "scope_type": scope_type, "scope_id": scope_id}, headers=S)

    # the default allow-list is viewer + operator
    assert bind_as_sara("dev-vera", "viewer", "floor", f2).status_code == 201
    assert bind_as_sara("dev-dan", "operator", "site", site).status_code == 201
    assert bind_as_sara("dev-tom", "editor", "floor", f2).json()["code"] == "role_not_delegable"
    assert bind_as_sara("dev-tom", "site_admin", "floor", f2).json()["code"] == "role_not_delegable"
    assert bind_as_sara("dev-tom", "system_admin", "site", site).status_code in (403, 422)
    assert bind_as_sara("dev-tom", "system_admin", "installation", "*").status_code == 403
    # never a wider scope, never another site
    assert bind_as_sara("dev-tom", "viewer", "installation", "*").status_code == 403
    assert bind_as_sara("dev-tom", "viewer", "floor", ids["other_floor"]).status_code == 403
    # no self-escalation, not even an allow-listed role inside her own site
    selfie = bind_as_sara("dev-sara", "viewer", "floor", f2)
    assert selfie.status_code == 403 and selfie.json()["code"] == "delegation_self"
    # the allow-list is edited only with rbac.roles.manage; editor added -> she may assign it
    assert c.put("/api/v1/access/delegation", json={"delegable_roles": ["viewer", "operator", "editor"]}, headers=S).status_code == 403
    assert c.put("/api/v1/access/delegation", json={"delegable_roles": ["viewer", "operator", "site_admin"]}).json()["code"] == "system_role_not_delegable"
    assert c.put("/api/v1/access/delegation", json={"delegable_roles": ["viewer", "operator", "editor"]}).status_code == 200
    assert bind_as_sara("dev-tom", "editor", "floor", f2).status_code == 201
    # revoking follows the same limits: an allow-listed role in reach yes; the admin's own site_admin binding no
    vera_b = next(b for b in c.get("/api/v1/access/bindings").json()["bindings"] if b["subject_id"] == "dev-vera")
    assert c.delete(f"/api/v1/access/bindings/{vera_b['id']}", headers=S).status_code == 200
    own = next(b for b in c.get("/api/v1/access/bindings").json()["bindings"] if b["subject_id"] == "dev-sara")
    assert c.delete(f"/api/v1/access/bindings/{own['id']}", headers=S).json()["code"] == "role_not_delegable"
    # no shared/global role edit through delegation
    assert c.post("/api/v1/access/roles", json={"name": "x", "permissions": ["map.read"]}, headers=S).status_code == 403
    assert c.patch("/api/v1/access/roles/viewer", json={"name": "x", "permissions": ["map.read"], "revision": 1}, headers=S).status_code == 403
    # what she sees: only assignable roles, only her scopes, only active users with the bindings inside her reach
    roles = c.get("/api/v1/access/roles", headers=S).json()
    assert {r["id"] for r in roles["roles"]} == {"viewer", "operator", "editor"} and roles["can_manage_roles"] is False and roles["delegated"] is True
    d = c.get("/api/v1/identity/users", headers=S).json()
    assert d["delegated"] is True and d["assignable_roles"] == ["editor", "operator", "viewer"]
    assert {s["type"] for s in d["assign_scopes"]} == {"site", "building", "floor"} and all(s["id"] != ids["other_floor"] for s in d["assign_scopes"])
    joni = next(u for u in d["users"] if u["id"] == "dev-joni")
    assert joni["bindings"] == [] and joni["is_admin"] is False, "the installation-wide system_admin binding is outside her reach"
    # every refusal audited with its reason
    with app.state.db.connection() as conn:
        reasons = {r[0] for r in conn.execute("SELECT reason FROM audit_log WHERE decision = 'denied' AND actor_username = 'sara'").fetchall()}
    assert {"role_not_delegable", "delegation_self", "no_binding"} <= reasons


def test_site_admin_bound_installation_wide_is_still_delegated(settings):
    """Before T082 'rbac.assign at installation scope' was full authority: a site_admin bound installation-wide could
    hand out system_admin. Full authority now also needs rbac.roles.manage."""
    app, c, ids = _setup(settings)
    bind(c, settings, "omer", "site_admin", "installation", "*")
    o = as_user("omer")
    r = c.post("/api/v1/access/bindings", json={"subject_kind": "user", "subject_id": "dev-tom", "role_id": "system_admin", "scope_type": "installation", "scope_id": "*"}, headers=o)
    assert r.status_code == 403 and r.json()["code"] == "delegation_exceeded"
    assert c.post("/api/v1/access/bindings", json={"subject_kind": "user", "subject_id": "dev-tom", "role_id": "site_admin", "scope_type": "site", "scope_id": ids["site"]}, headers=o).json()["code"] == "role_not_delegable"
    assert c.post("/api/v1/access/bindings", json={"subject_kind": "user", "subject_id": "dev-tom", "role_id": "viewer", "scope_type": "installation", "scope_id": "*"}, headers=o).status_code == 201


def test_delegated_group_cross_scope(settings):
    """contracts/examples/authorization-scenarios.design.json `delegated-group-cross-scope`: a site admin of site A
    cannot manage a group bound in site A and site B; a group bound only inside site A is in her reach."""
    app, c, ids = _setup(settings)
    wide = _group(c, "שני אתרים")
    assert _bind_group(c, wide["id"], "viewer", "site", ids["site"]).status_code == 201
    assert _bind_group(c, wide["id"], "viewer", "site", ids["other_site"]).status_code == 201
    r = _members(c, wide["id"], ["dev-vera"], headers=S)
    assert r.status_code == 403 and r.json()["code"] == "delegation_group_scope" and r.json()["details"]["reason"] == "scope"
    assert _bind_group(c, wide["id"], "viewer", "floor", ids["floor2"], headers=S).json()["code"] == "delegation_group_scope"
    assert all(g["id"] != wide["id"] for g in c.get("/api/v1/access/groups", headers=S).json()["groups"]), "not even listed for her"
    # a group anchored inside her site: membership and further allow-listed bindings are hers to manage
    local = _group(c, "צופי קומה 2")
    assert _bind_group(c, local["id"], "viewer", "floor", ids["floor2"]).status_code == 201
    assert [g["id"] for g in c.get("/api/v1/access/groups", headers=S).json()["groups"]] == [local["id"]]
    assert _members(c, local["id"], ["dev-vera"], headers=S).status_code == 200
    assert c.get(f"/api/v1/floors/{ids['floor2']}/map", headers=as_user("vera")).status_code == 200
    assert _bind_group(c, local["id"], "operator", "floor", ids["floor3"], headers=S).status_code == 201
    # ...but never a scope outside her site, a role off the list, or herself
    assert _bind_group(c, local["id"], "viewer", "floor", ids["other_floor"], headers=S).status_code == 403
    assert _bind_group(c, local["id"], "editor", "floor", ids["floor2"], headers=S).json()["code"] == "role_not_delegable"
    me = _members(c, local["id"], ["dev-vera", "dev-sara"], headers=S)
    assert me.status_code == 403 and me.json()["code"] == "delegation_self" and me.json()["details"]["item_id"] == "dev-sara"
    # once she is a member (added by the system admin) the group is out of her hands: no self-escalation via a group
    assert _members(c, local["id"], ["dev-vera", "dev-sara"]).status_code == 200
    assert _bind_group(c, local["id"], "operator", "floor", ids["floor2"], headers=S).json()["code"] == "delegation_self"
    assert _members(c, local["id"], ["dev-vera", "dev-sara", "dev-dan"], headers=S).json()["code"] == "delegation_self"
    assert c.get("/api/v1/access/groups", headers=S).json()["groups"] == [], "a group she belongs to is not hers to manage"
    # an operator binding the system admin puts on the group lifts it past her ceiling? no - operator is hers; a
    # system-admin-only role on the group takes it out of her reach
    assert _members(c, local["id"], ["dev-vera"]).status_code == 200
    assert _bind_group(c, local["id"], "editor", "floor", ids["floor2"]).status_code == 201
    assert _members(c, local["id"], ["dev-vera", "dev-dan"], headers=S).json()["details"]["reason"] == "role"
    # group lifecycle is never hers
    assert c.delete(f"/api/v1/access/groups/{local['id']}", headers=S).status_code == 403


def test_bulk_all_or_nothing_and_envelope(settings):
    app, c, ids = _setup(settings)
    f2, f3 = ids["floor2"], ids["floor3"]
    item = lambda subject, role, scope_id: {"subject_kind": "user", "subject_id": subject, "role_id": role, "scope_type": "floor", "scope_id": scope_id}  # noqa: E731

    def count() -> int:
        return len(c.get("/api/v1/access/bindings").json()["bindings"])

    # permission before body: someone without rbac.assign gets an audited 403 even for garbage
    bind(c, settings, "ron", "viewer", "installation", "*")
    n0 = count()
    assert c.post("/api/v1/access/bindings/bulk", content=b"not json", headers={**as_user("ron"), "content-type": "text/plain"}).status_code == 403
    assert c.put("/api/v1/access/groups/nope/members", content=b"{", headers={**as_user("ron"), "content-type": "application/json"}).status_code == 403
    # JSON only, a byte cap, an item cap
    assert c.post("/api/v1/access/bindings/bulk", content=json.dumps({"items": [item("dev-vera", "viewer", f2)]}), headers={**S, "content-type": "text/plain"}).status_code == 415
    assert c.post("/api/v1/access/bindings/bulk", content=b'{"items": [' + b" " * 70000 + b"]}", headers={**S, "content-type": "application/json"}).status_code == 413
    assert c.post("/api/v1/access/bindings/bulk", json={"items": [item("dev-vera", "viewer", f2)] * 51}, headers=S).status_code == 422
    # the second item is refused (editor is off her list): the whole request is refused, nothing written
    r = c.post("/api/v1/access/bindings/bulk", json={"items": [item("dev-vera", "viewer", f2), item("dev-dan", "editor", f2), item("dev-tom", "viewer", f3)]}, headers=S)
    assert r.status_code == 403 and r.json()["code"] == "role_not_delegable"
    assert r.json()["details"]["item_index"] == 1 and r.json()["details"]["item_id"] == "dev-dan" and r.json()["details"]["outcome"] == "nothing_written"
    assert count() == n0 and c.get(f"/api/v1/floors/{f2}/map", headers=as_user("vera")).status_code == 403
    # a later item outside her scope, or naming herself, refuses it the same way
    r = c.post("/api/v1/access/bindings/bulk", json={"items": [item("dev-vera", "viewer", f2), item("dev-tom", "viewer", ids["other_floor"])]}, headers=S)
    assert r.status_code == 403 and r.json()["details"]["item_index"] == 1 and count() == n0
    r = c.post("/api/v1/access/bindings/bulk", json={"items": [item("dev-vera", "viewer", f2), item("dev-sara", "operator", f3)]}, headers=S)
    assert r.status_code == 403 and r.json()["code"] == "delegation_self" and count() == n0
    # a duplicate inside the request is refused too
    r = c.post("/api/v1/access/bindings/bulk", json={"items": [item("dev-vera", "viewer", f2), item("dev-vera", "viewer", f2)]}, headers=S)
    assert r.status_code == 409 and r.json()["code"] == "duplicate_item" and count() == n0
    # all good -> all written, each audited plus one summary row
    ok = c.post("/api/v1/access/bindings/bulk", json={"items": [item("dev-vera", "viewer", f2), item("dev-tom", "operator", f3)]}, headers=S)
    assert ok.status_code == 201, ok.text
    assert [x["index"] for x in ok.json()["created"]] == [0, 1] and count() == n0 + 2
    assert c.get(f"/api/v1/floors/{f2}/map", headers=as_user("vera")).status_code == 200
    with app.state.db.connection() as conn:
        rows = conn.execute("SELECT action, details_json FROM audit_log WHERE decision = 'allowed' AND actor_username = 'sara' ORDER BY rowid").fetchall()
    assert [r[0] for r in rows] == ["rbac.bind", "rbac.bind", "rbac.bind_bulk"]
    assert json.loads(rows[2][1])["binding_ids"] == [x["binding_id"] for x in ok.json()["created"]]
    # membership is a bulk request too: an unknown user refuses the whole replacement
    g = _group(c, "בדיקה")
    r = _members(c, g["id"], ["dev-vera", "dev-nobody", "dev-dan"])
    assert r.status_code == 404 and r.json()["details"]["item_id"] == "dev-nobody" and _get_group(c, g["id"])["members"] == []


def test_last_admin_cannot_leave_through_group_membership(settings):
    app, c, ids = _setup(settings)
    g = _group(c, "מנהלים")
    assert _members(c, g["id"], ["dev-joni"]).status_code == 200
    assert _bind_group(c, g["id"], "system_admin", "installation", "*").status_code == 201
    own = next(b for b in c.get("/api/v1/access/bindings").json()["bindings"] if b["subject_id"] == "dev-joni" and b["subject_kind"] == "user")
    assert c.delete(f"/api/v1/access/bindings/{own['id']}").status_code == 200, "the group still makes joni an admin"
    r = _members(c, g["id"], [])
    assert r.status_code == 409 and r.json()["code"] == "last_admin"
    assert [m["id"] for m in _get_group(c, g["id"])["members"]] == ["dev-joni"], "nothing written"


# ---------------------------------------------------------------- security review (T082): deny bindings and leaks

def _assigner(c: TestClient, ids: dict) -> dict:
    """mo: a custom role naming rbac.assign plus exactly the viewer permissions, bound on floor 2 - a delegated actor
    whose ceiling is the viewer role."""
    role = c.post("/api/v1/access/roles", json={"name": "משייך קומה", "permissions": ["rbac.assign", "map.read", "video.live", "entity.state.read", "devices.read", "media.read", "access.read", "alarm.view", "presence.report"]})
    assert role.status_code == 201, role.text
    c.get("/api/v1/me", headers=as_user("mo"))
    assert c.post("/api/v1/access/bindings", json={"subject_kind": "user", "subject_id": "dev-mo", "role_id": role.json()["id"], "scope_type": "floor", "scope_id": ids["floor2"]}).status_code == 201
    return as_user("mo")


def test_delegated_actor_cannot_lift_a_deny_above_their_own_permissions(settings):
    app, c, ids = _setup(settings)
    f2 = ids["floor2"]
    mo = _assigner(c, ids)
    c.get("/api/v1/me", headers=as_user("xavi"))
    for effect in ("allow", "deny"):
        assert c.post("/api/v1/access/bindings", json={"subject_kind": "user", "subject_id": "dev-xavi", "role_id": "operator", "scope_type": "floor", "scope_id": f2, "effect": effect}).status_code == 201
    assert "ha.entity.control" not in _preview(c, "xavi", "floor", f2)
    # granting operator is above mo's ceiling; so is revoking the deny of operator (it would hand operator out)
    esc = c.post("/api/v1/access/bindings", json={"subject_kind": "user", "subject_id": "dev-vera", "role_id": "operator", "scope_type": "floor", "scope_id": f2}, headers=mo)
    assert esc.status_code == 403 and esc.json()["code"] == "delegation_escalation"
    deny = next(b for b in c.get("/api/v1/access/bindings").json()["bindings"] if b["subject_id"] == "dev-xavi" and b["effect"] == "deny")
    r = c.delete(f"/api/v1/access/bindings/{deny['id']}", headers=mo)
    assert r.status_code == 403 and r.json()["code"] == "delegation_escalation"
    assert "ha.entity.control" not in _preview(c, "xavi", "floor", f2)
    # a group holding a deny of operator: removing a member would lift it - the group is out of mo's reach (ceiling)
    g = _group(c, "חסומים")
    assert _bind_group(c, g["id"], "viewer", "floor", f2).status_code == 201
    assert _bind_group(c, g["id"], "operator", "floor", f2, effect="deny").status_code == 201
    assert _members(c, g["id"], ["dev-vera"]).status_code == 200
    r = _members(c, g["id"], [], headers=mo)
    assert r.status_code == 403 and r.json()["code"] == "delegation_group_scope" and r.json()["details"]["reason"] == "ceiling"
    assert [m["id"] for m in _get_group(c, g["id"])["members"]] == ["dev-vera"]
    # control: a group with only a viewer allow is within mo's ceiling and scope; operator on it is not
    ok = _group(c, "צופים")
    assert _bind_group(c, ok["id"], "viewer", "floor", f2).status_code == 201
    assert _members(c, ok["id"], ["dev-tom"], headers=mo).status_code == 200
    assert _bind_group(c, ok["id"], "operator", "floor", f2, headers=mo).json()["code"] == "delegation_escalation"


def test_delegated_admin_never_creates_a_deny(settings):
    app, c, ids = _setup(settings)
    f2, site = ids["floor2"], ids["site"]
    bind(c, settings, "pia", "site_admin", "site", site)
    g = _group(c, "עם מנהל")
    assert _bind_group(c, g["id"], "viewer", "floor", f2).status_code == 201
    assert _members(c, g["id"], ["dev-joni"]).status_code == 200
    for subject in ({"subject_kind": "user", "subject_id": "dev-joni"}, {"subject_kind": "user", "subject_id": "dev-pia"}, {"subject_kind": "group", "subject_id": g["id"]}):
        r = c.post("/api/v1/access/bindings", json={**subject, "role_id": "operator", "scope_type": "site", "scope_id": site, "effect": "deny"}, headers=S)
        assert r.status_code == 403 and r.json()["code"] == "delegation_deny_forbidden", subject
    assert _bind_group(c, g["id"], "viewer", "floor", f2, headers=S, effect="deny").json()["code"] == "delegation_deny_forbidden"
    bulk = c.post("/api/v1/access/bindings/bulk", json={"items": [{"subject_kind": "user", "subject_id": "dev-vera", "role_id": "viewer", "scope_type": "floor", "scope_id": f2},
                                                                  {"subject_kind": "user", "subject_id": "dev-joni", "role_id": "viewer", "scope_type": "floor", "scope_id": f2, "effect": "deny"}]}, headers=S)
    assert bulk.status_code == 403 and bulk.json()["code"] == "delegation_deny_forbidden" and bulk.json()["details"]["item_index"] == 1
    assert "video.live" in _preview(c, "joni", "floor", f2) and "video.live" in _preview(c, "pia", "floor", f2)
    with app.state.db.connection() as conn:
        assert conn.execute("SELECT COUNT(*) FROM bindings WHERE effect = 'deny'").fetchone()[0] == 0


def test_a_deny_never_locks_out_the_last_admin(settings):
    app, c, ids = _setup(settings)
    f2 = ids["floor2"]
    r = c.post("/api/v1/access/bindings", json={"subject_kind": "user", "subject_id": "dev-joni", "role_id": "system_admin", "scope_type": "installation", "scope_id": "*", "effect": "deny"})
    assert r.status_code == 409 and r.json()["code"] == "last_admin"
    assert c.get("/api/v1/identity/users").status_code == 200, "still an administrator"
    # through a group: a deny on a group joni belongs to, and joni joining a group that holds such a deny
    g = _group(c, "כולם")
    assert _members(c, g["id"], ["dev-joni", "dev-vera"]).status_code == 200
    r = _bind_group(c, g["id"], "system_admin", "installation", "*", effect="deny")
    assert r.status_code == 409 and r.json()["code"] == "last_admin" and _get_group(c, g["id"])["bindings"] == []
    h = _group(c, "חסימה")
    assert _bind_group(c, h["id"], "system_admin", "installation", "*", effect="deny").status_code == 201
    r = _members(c, h["id"], ["dev-joni"])
    assert r.status_code == 409 and r.json()["code"] == "last_admin" and _get_group(c, h["id"])["members"] == []
    # a failure in the WRITE phase of a bulk request rolls back the items already written in it
    n0 = len(c.get("/api/v1/access/bindings").json()["bindings"])
    r = c.post("/api/v1/access/bindings/bulk", json={"items": [{"subject_kind": "user", "subject_id": "dev-vera", "role_id": "viewer", "scope_type": "floor", "scope_id": f2},
                                                               {"subject_kind": "user", "subject_id": "dev-joni", "role_id": "system_admin", "scope_type": "installation", "scope_id": "*", "effect": "deny"}]})
    assert r.status_code == 409 and r.json()["code"] == "last_admin"
    assert len(c.get("/api/v1/access/bindings").json()["bindings"]) == n0 and c.get(f"/api/v1/floors/{f2}/map", headers=as_user("vera")).status_code == 403
    with app.state.db.connection() as conn:
        assert conn.execute("SELECT COUNT(*) FROM audit_log WHERE action = 'rbac.bind' AND decision = 'allowed' AND resource_id = 'dev-vera'").fetchone()[0] == 0


def test_no_existence_leaks_before_the_permission(settings):
    app, c, ids = _setup(settings)
    bind(c, settings, "ron", "viewer", "installation", "*")
    R = as_user("ron")
    g = _group(c, "סודית")
    assert _bind_group(c, g["id"], "viewer", "floor", ids["floor2"]).status_code == 201
    bid = _get_group(c, g["id"])["bindings"][0]["id"]
    for gid in (g["id"], "no-such-group"):
        calls = [
            c.patch(f"/api/v1/access/groups/{gid}", json={"name": "x", "revision": 99}, headers=R),
            c.delete(f"/api/v1/access/groups/{gid}?revision=99", headers=R),
            c.post(f"/api/v1/access/groups/{gid}/bindings", json={"role_id": "viewer", "scope_type": "floor", "scope_id": "nope", "revision": 99}, headers=R),
            c.delete(f"/api/v1/access/groups/{gid}/bindings/{bid}?revision=99", headers=R),
            c.post(f"/api/v1/access/groups/{gid}/impact", json={"op": "bind", "role_id": "viewer", "scope_type": "floor", "scope_id": "nope"}, headers=R),
            c.put(f"/api/v1/access/groups/{gid}/members", json={"user_ids": [], "revision": 99}, headers=R),
        ]
        assert [x.status_code for x in calls] == [403] * 6 and {x.json()["code"] for x in calls} == {"forbidden"}, gid
    for body in ({"subject_kind": "group", "subject_id": "no-such-group"}, {"subject_kind": "user", "subject_id": "dev-vera"}):
        r = c.post("/api/v1/access/bindings", json={**body, "role_id": "viewer", "scope_type": "floor", "scope_id": "nope"}, headers=R)
        assert r.status_code == 403 and r.json()["code"] == "forbidden"
    assert c.get("/api/v1/access/bindings", headers=R).status_code == 403
    assert c.delete(f"/api/v1/access/bindings/{bid}", headers=R).status_code == 403
    # a delegated admin gets 403, not 422, for a scope outside her reach that does not exist either
    assert c.post("/api/v1/access/bindings", json={"subject_kind": "user", "subject_id": "dev-vera", "role_id": "viewer", "scope_type": "floor", "scope_id": "nope"}, headers=S).status_code == 403


def test_old_single_route_with_groups_and_unanchored_groups(settings):
    app, c, ids = _setup(settings)
    f2 = ids["floor2"]
    bare = _group(c, "ריקה")
    r = c.post("/api/v1/access/bindings", json={"subject_kind": "group", "subject_id": bare["id"], "role_id": "viewer", "scope_type": "floor", "scope_id": f2}, headers=S)
    assert r.status_code == 403 and r.json()["code"] == "delegation_group_scope" and r.json()["details"]["reason"] == "group_unanchored"
    local = _group(c, "מקומית")
    assert _bind_group(c, local["id"], "viewer", "floor", f2).status_code == 201
    r = c.post("/api/v1/access/bindings", json={"subject_kind": "group", "subject_id": local["id"], "role_id": "operator", "scope_type": "floor", "scope_id": ids["floor3"]}, headers=S)
    assert r.status_code == 201 and _get_group(c, local["id"])["revision"] == 3, "the old route moves the group revision too"
    far = _group(c, "רחוקה")
    assert _bind_group(c, far["id"], "viewer", "floor", ids["other_floor"]).status_code == 201
    r = c.post("/api/v1/access/bindings", json={"subject_kind": "group", "subject_id": far["id"], "role_id": "viewer", "scope_type": "floor", "scope_id": f2}, headers=S)
    assert r.status_code == 403 and r.json()["details"]["reason"] == "scope"
    # a delegated admin never edits a custom role, its delegable flag included
    role = c.post("/api/v1/access/roles", json={"name": "צופה אירועים", "permissions": ["map.read", "events.read"]}).json()
    assert c.patch(f"/api/v1/access/roles/{role['id']}", json={"name": role["name"], "permissions": ["map.read", "events.read"], "delegable": True, "revision": 1}, headers=S).status_code == 403
    assert c.put("/api/v1/access/delegation", json={"delegable_roles": ["viewer", "operator", role["id"]]}, headers=S).status_code == 403


def test_delegated_views_stay_inside_their_reach(settings):
    app, c, ids = _setup(settings)
    f2 = ids["floor2"]
    # a site_admin bound installation-wide reaches every scope, still never sees the system administrators' bindings
    bind(c, settings, "omer", "site_admin", "installation", "*")
    listed = c.get("/api/v1/access/bindings", headers=as_user("omer")).json()["bindings"]
    assert listed and all(b["role_id"] != "system_admin" for b in listed) and any(b["subject_id"] == "dev-sara" for b in listed)
    # preview: never more than she holds herself at that scope (joni's NVR permissions stay invisible to sara)
    p = c.post("/api/v1/access/preview", json={"user_id": "dev-joni", "scope_type": "floor", "scope_id": f2}, headers=S).json()
    assert p["limited_to_own"] is True and "map.read" in p["allowed"] and "nvr.config.write" not in p["allowed"] and p["bindings"] == []
    assert "nvr.config.write" in c.post("/api/v1/access/preview", json={"user_id": "dev-joni", "scope_type": "floor", "scope_id": f2}).json()["allowed"]
    # the delegated directory shows display names only, active people only
    with app.state.db.connection() as conn:
        conn.execute("UPDATE users SET active = 0 WHERE id = 'dev-tom'")
    d = c.get("/api/v1/identity/users", headers=S).json()
    assert all(u["username"] == "" for u in d["users"]) and "dev-tom" not in {u["id"] for u in d["users"]}
    # membership: an inactive (hidden) person is neither previewed nor added by her; hidden members are kept
    g = _group(c, "משמרת")
    assert _bind_group(c, g["id"], "viewer", "floor", f2).status_code == 201
    im = c.post(f"/api/v1/access/groups/{g['id']}/impact", json={"op": "members", "user_ids": ["dev-vera", "dev-tom"]}, headers=S).json()
    assert [u["id"] for u in im["users"]] == ["dev-vera"]
    r = _members(c, g["id"], ["dev-vera", "dev-tom"], headers=S)
    assert r.status_code == 404 and r.json()["details"]["item_id"] == "dev-tom"
    assert _members(c, g["id"], ["dev-tom", "dev-vera"]).status_code == 200  # the system admin may
    r = _members(c, g["id"], [], headers=S)
    assert r.status_code == 200 and [m["id"] for m in r.json()["members"]] == ["dev-tom"], "a member she cannot see is not removed by omission"
