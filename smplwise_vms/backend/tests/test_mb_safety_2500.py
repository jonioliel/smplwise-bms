"""MULTI-BUILDING-SAFETY-2500 (owner decisions 22.11, Q62 / Q63 = the recommendations).

Q62: a floor moves to another building of its site only for someone who manages the content of BOTH buildings, after an impact preview
that names who loses access (`GET /floors/{id}/move-preview`, `POST /floors/{id}/move` confirmed with the preview's digest).
Q63: turning the multi-building switch on needs the check (`GET /home/multi-building/check`, `PUT /home/multi-building` with the
digest); an administrator of roles may skip it with `home.multi_building.review` = skip, audited."""
from __future__ import annotations

import json

from conftest import as_user, bind
from test_building_scope_control_2351 import _site
from test_devices import bulk_app, dev_app  # noqa: F401 - the fixtures of the bulk tests

from smplwise.db import Database, new_id, now_iso, permission_revision
from smplwise.services import floor_move, multi_building_check, revocation, shared_spaces

API = "/api/v1"


# ---------------------------------------------------------------------------------------------------------------------------- helpers

def _two_buildings(client) -> dict[str, str]:
    site = client.post(f"{API}/sites", json={"name": "מתחם"}).json()
    a = client.post(f"{API}/sites/{site['id']}/buildings", json={"name": "בניין א"}).json()
    b = client.post(f"{API}/sites/{site['id']}/buildings", json={"name": "בניין ב"}).json()
    fa = client.post(f"{API}/buildings/{a['id']}/floors", json={"name": "קומה 1", "level": 1}).json()
    fa2 = client.post(f"{API}/buildings/{a['id']}/floors", json={"name": "קומה 2", "level": 2}).json()
    fb = client.post(f"{API}/buildings/{b['id']}/floors", json={"name": "קומה 1", "level": 1}).json()
    return {"site": site["id"], "A": a["id"], "B": b["id"], "fA": fa["id"], "fA2": fa2["id"], "fB": fb["id"]}


def _bind_raw(settings, subject: str, role: str, scope_type: str, scope_id: str, *, kind: str = "user", effect: str = "allow") -> None:
    with Database(settings.db_path).connection() as conn:
        conn.execute("INSERT INTO bindings(id, subject_kind, subject_id, role_id, scope_type, scope_id, effect, permission_revision, assigned_by, created_at) "
                     "VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'test', ?)", (new_id(), kind, subject, role, scope_type, scope_id, effect, permission_revision(conn), now_iso()))


def _group(client, settings, name: str, members: list[str]) -> str:
    gid = new_id()
    for m in members:
        client.get(f"{API}/me", headers=as_user(m))
    with Database(settings.db_path).connection() as conn:
        conn.execute("INSERT INTO groups(id, name, created_at) VALUES (?, ?, ?)", (gid, name, now_iso()))
        for m in members:
            conn.execute("INSERT INTO group_members(group_id, user_id) VALUES (?, ?)", (gid, f"dev-{m}"))
    return gid


def _audit(settings, action: str, decision: str | None = None) -> list[dict]:
    with Database(settings.db_path).connection() as conn:
        rows = conn.execute("SELECT * FROM audit_log WHERE action = ? ORDER BY rowid", (action,)).fetchall()
    out = [{**dict(r), "details": json.loads(r["details_json"] or "{}")} for r in rows]
    return [r for r in out if decision is None or r["decision"] == decision]


def _preview(client, floor_id: str, building: str, headers: dict | None = None):
    return client.get(f"{API}/floors/{floor_id}/move-preview", params={"building": building}, headers=headers or {})


def _move(client, floor_id: str, building: str, digest: str, headers: dict | None = None):
    return client.post(f"{API}/floors/{floor_id}/move", json={"building_id": building, "preview_digest": digest}, headers=headers or {})


def _floor_building(settings, floor_id: str) -> str:
    with Database(settings.db_path).connection() as conn:
        return conn.execute("SELECT building_id FROM floors WHERE id = ?", (floor_id,)).fetchone()[0]


# ------------------------------------------------------------------------------------------------------------------- Q62: floor move

def test_the_preview_names_who_loses_gains_and_changes_and_nothing_is_written(client, settings):
    ids = _two_buildings(client)
    bind(client, settings, "ana", "viewer", "building", ids["A"])       # loses the floor
    bind(client, settings, "bob", "viewer", "building", ids["B"])       # gains it
    bind(client, settings, "flo", "viewer", "floor", ids["fA"])         # floor binding: moves with the floor, unchanged
    bind(client, settings, "sit", "viewer", "site", ids["site"])        # site binding: unchanged
    bind(client, settings, "two", "operator", "building", ids["A"])     # operator on A, viewer on B: keeps viewer, loses the rest
    bind(client, settings, "two", "viewer", "building", ids["B"])
    gid = _group(client, settings, "דיירי א", ["gma"])
    _bind_raw(settings, gid, "viewer", "building", ids["A"], kind="group")  # through a group: loses
    client.get(f"{API}/me", headers=as_user("off"))
    bind(client, settings, "off", "viewer", "building", ids["A"])
    with Database(settings.db_path).connection() as conn:
        conn.execute("UPDATE users SET active = 0 WHERE id = 'dev-off'")  # a disabled user holds nothing: not listed

    r = _preview(client, ids["fA"], ids["B"])
    assert r.status_code == 200, r.text
    pv = r.json()
    people = {p["user_id"]: p for p in pv["people"]["items"]}
    assert set(people) == {"dev-ana", "dev-bob", "dev-two", "dev-gma"}
    assert people["dev-ana"]["change"] == "loses" and "map.read" in people["dev-ana"]["lost"] and people["dev-ana"]["gained"] == []
    assert people["dev-gma"]["change"] == "loses"
    assert people["dev-bob"]["change"] == "gains" and "map.read" in people["dev-bob"]["gained"]
    assert people["dev-two"]["change"] == "changes" and "map.read" not in people["dev-two"]["lost"] and people["dev-two"]["lost"]
    assert (pv["people"]["loses"], pv["people"]["gains"], pv["people"]["changes"], pv["people"]["total"]) == (2, 1, 1, 4)
    assert [p["change"] for p in pv["people"]["items"]] == ["loses", "loses", "changes", "gains"], "who loses access comes first"
    assert pv["moves_with"]["floor_bindings"] == 1
    assert (pv["from_building"]["id"], pv["to_building"]["id"], pv["can_move"], pv["blockers"]) == (ids["A"], ids["B"], True, [])
    codes = [w["code"] for w in pv["warnings"]]
    assert codes == ["level_clash", "people_lose_access"], "B already has a floor on level 1; two people lose access"
    assert {i["id"] for i in pv["warnings"][1]["items"]} == {"dev-ana", "dev-gma"}
    assert _preview(client, ids["fA"], ids["B"]).json()["digest"] == pv["digest"], "the digest is stable"
    assert _floor_building(settings, ids["fA"]) == ids["A"], "the preview writes nothing"
    assert not _audit(settings, "floor.move")


def test_moving_needs_the_content_permission_on_both_buildings(client, settings):
    ids = _two_buildings(client)
    bind(client, settings, "eda", "site_admin", "building", ids["A"])
    bind(client, settings, "edb", "site_admin", "building", ids["B"])
    bind(client, settings, "edf", "site_admin", "floor", ids["fA"])
    bind(client, settings, "both", "site_admin", "building", ids["A"])
    bind(client, settings, "both", "site_admin", "building", ids["B"])
    digest = _preview(client, ids["fA"], ids["B"]).json()["digest"]
    for who, denied_on in (("eda", ("building", ids["B"])), ("edb", ("building", ids["A"])), ("edf", ("building", ids["A"]))):
        r = _preview(client, ids["fA"], ids["B"], headers=as_user(who))
        assert r.status_code == 403, (who, r.text)
        r = _move(client, ids["fA"], ids["B"], digest, headers=as_user(who))
        assert r.status_code == 403, (who, r.text)
        rows = [x for x in _audit(settings, "site.content.configure", "denied") if x["actor_user_id"] == f"dev-{who}"]
        assert rows and (rows[-1]["resource_type"], rows[-1]["resource_id"]) == denied_on, who
    assert _floor_building(settings, ids["fA"]) == ids["A"]
    r = _preview(client, ids["fA"], ids["B"], headers=as_user("both"))
    assert r.status_code == 200, r.text
    r = _move(client, ids["fA"], ids["B"], r.json()["digest"], headers=as_user("both"))
    assert r.status_code == 200, r.text
    assert _floor_building(settings, ids["fA"]) == ids["B"]


def test_the_move_is_confirmed_by_the_digest_written_once_audited_and_signalled(client, settings):
    ids = _two_buildings(client)
    bind(client, settings, "ana", "viewer", "building", ids["A"])
    bind(client, settings, "bob", "viewer", "building", ids["B"])
    assert client.get(f"{API}/floors/{ids['fA']}", headers=as_user("ana")).status_code == 200
    assert client.get(f"{API}/floors/{ids['fA']}", headers=as_user("bob")).status_code == 403
    pv = _preview(client, ids["fA"], ids["B"]).json()
    # something changed since the preview (a new binding on A): the move is refused and nothing is written
    bind(client, settings, "cid", "viewer", "building", ids["A"])
    r = _move(client, ids["fA"], ids["B"], pv["digest"])
    assert (r.status_code, r.json()["code"]) == (409, "preview_stale"), r.text
    assert _floor_building(settings, ids["fA"]) == ids["A"]
    fresh = _preview(client, ids["fA"], ids["B"]).json()
    assert fresh["digest"] != pv["digest"] and fresh["people"]["loses"] == 2
    # a ticket-like record on the floor follows it (the building copied next to the floor)
    with Database(settings.db_path).connection() as conn:
        conn.execute("INSERT INTO incidents(id, status, source, title, building_id, floor_id, opened_at, opened_by, last_trigger_at) "
                     "VALUES ('inc1', 'open', 'manual', 't', ?, ?, ?, 'test', ?)", (ids["A"], ids["fA"], now_iso(), now_iso()))
    fresh = _preview(client, ids["fA"], ids["B"]).json()
    assert fresh["moves_with"]["records"]["incidents"] == 1
    gen = {u: revocation.generation(u) for u in ("dev-ana", "dev-bob")}
    r = _move(client, ids["fA"], ids["B"], fresh["digest"])
    assert r.status_code == 200, r.text
    out = r.json()
    assert out["floor"]["building_id"] == ids["B"] and out["records"]["incidents"] == 1 and (out["loses"], out["gains"]) == (2, 1)
    with Database(settings.db_path).connection() as conn:
        assert conn.execute("SELECT building_id FROM incidents WHERE id = 'inc1'").fetchone()[0] == ids["B"]
    assert all(revocation.generation(u) > g for u, g in gen.items()), "open sockets re-scope at once"
    rows = _audit(settings, "floor.move", "allowed")
    assert len(rows) == 1
    d = rows[0]["details"]
    assert (d["from"], d["to"], d["loses"], d["gains"], d["changes"]) == (ids["A"], ids["B"], 2, 1, 0)
    assert sorted(d["lost_users"]) == ["dev-ana", "dev-cid"] and d["records"]["incidents"] == 1
    # reach followed the floor
    assert client.get(f"{API}/floors/{ids['fA']}", headers=as_user("ana")).status_code == 403
    assert client.get(f"{API}/floors/{ids['fA']}", headers=as_user("bob")).status_code == 200
    # undo = move it back (the same flow)
    back = _preview(client, ids["fA"], ids["A"]).json()
    assert back["people"]["gains"] == 2 and back["people"]["loses"] == 1
    assert _move(client, ids["fA"], ids["A"], back["digest"]).status_code == 200
    assert _floor_building(settings, ids["fA"]) == ids["A"]


def test_the_target_must_be_another_live_building_of_the_same_site(client, settings):
    ids = _two_buildings(client)
    other = client.post(f"{API}/sites", json={"name": "אתר אחר"}).json()
    ob = client.post(f"{API}/sites/{other['id']}/buildings", json={"name": "רחוק"}).json()
    gone = client.post(f"{API}/sites/{ids['site']}/buildings", json={"name": "נמחק"}).json()
    assert client.delete(f"{API}/buildings/{gone['id']}").status_code == 204
    assert _preview(client, ids["fA"], ids["A"]).status_code == 422, "already there"
    assert _preview(client, ids["fA"], ob["id"]).status_code == 422, "another site"
    r = _preview(client, ids["fA"], gone["id"])
    assert (r.status_code, r.json()["code"]) == (404, "building_not_found")
    assert _preview(client, ids["fA"], "nope").status_code == 404
    assert _preview(client, "nope", ids["B"]).status_code == 404
    assert client.get(f"{API}/floors/{ids['fA']}/move-preview").status_code == 422, "the target is required"
    assert _move(client, ids["fA"], ob["id"], "x").status_code == 422
    assert client.post(f"{API}/floors/{ids['fA']}/move", json={"building_id": ids["B"]}).status_code == 422, "the digest is required"


def test_a_room_shared_across_the_new_boundary_blocks_the_move(client, settings, monkeypatch):
    ids = _two_buildings(client)
    share = shared_spaces.Share("s1", "zone1", ids["fA2"], ids["fA"], {"mode": "same_frame"}, 1, now_iso(), "לובי כפול", [], 1, None)
    monkeypatch.setattr(shared_spaces, "any_active", lambda _c: True)
    monkeypatch.setattr(shared_spaces, "all_shares", lambda _c: [share])
    pv = _preview(client, ids["fA"], ids["B"]).json()
    assert pv["can_move"] is False and pv["blockers"] == [{"code": "shared_room", "items": [{"id": "zone1", "name": "לובי כפול"}]}]
    r = _move(client, ids["fA"], ids["B"], pv["digest"])
    assert (r.status_code, r.json()["code"]) == (409, "move_blocked")
    assert _floor_building(settings, ids["fA"]) == ids["A"]
    # a share whose other floor ends up in the same building does not block (both floors are in B after the move)
    share_b = shared_spaces.Share("s2", "zone2", ids["fB"], ids["fA"], {"mode": "same_frame"}, 1, now_iso(), "גשר", [], 1, None)
    monkeypatch.setattr(shared_spaces, "all_shares", lambda _c: [share_b])
    assert _preview(client, ids["fA"], ids["B"]).json()["can_move"] is True


def test_the_service_people_rule_matches_authorize_after_the_move(client, settings):
    """The preview's "after" is the real rule: what rbac.authorize answers once the floor has moved."""
    from smplwise.rbac import Principal, authorize

    ids = _two_buildings(client)
    bind(client, settings, "ana", "operator", "building", ids["A"])
    bind(client, settings, "bob", "viewer", "building", ids["B"])
    _bind_raw(settings, "dev-bob", "viewer", "floor", ids["fA"], effect="deny")  # a deny on the floor wins after the move too
    with Database(settings.db_path).connection() as conn:
        who = {p["user_id"]: p for p in floor_move.people(conn, ids["fA"], ids["site"], ids["A"], ids["B"])}
    assert set(who) == {"dev-ana"}, "bob is denied on the floor before and after: no change"
    pv = _preview(client, ids["fA"], ids["B"]).json()
    assert _move(client, ids["fA"], ids["B"], pv["digest"]).status_code == 200
    with Database(settings.db_path).connection() as conn:
        ana = Principal("dev-ana", "ana", "ana", "dev")
        for perm in who["dev-ana"]["lost"]:
            assert not authorize(conn, ana, perm, ("floor", ids["fA"])).allowed, perm


# ------------------------------------------------------------------------------------------------------------- Q63: the pre-enable check

def _check(c, headers: dict | None = None):
    r = c.get(f"{API}/home/multi-building/check", headers=headers or {})
    assert r.status_code == 200, r.text
    return r.json()


def _on(c, digest: str | None = None, headers: dict | None = None):
    body: dict = {"enabled": True}
    if digest is not None:
        body["check_digest"] = digest
    return c.put(f"{API}/home/multi-building", json=body, headers=headers or {})


def _anchor(app, floor_id: str, entity_id: str) -> None:
    """Place a home-system device on a floor's map (a published plan + an anchor), straight in the database."""
    now = now_iso()
    with app.state.db.connection() as conn:
        asset, version = new_id(), new_id()
        conn.execute("INSERT INTO plan_assets(id, floor_id, original_name, mime, sha256, bytes, page_count, storage_path, created_at) "
                     "VALUES (?, ?, 'p.png', 'image/png', 'x', 1, 1, 'x', ?)", (asset, floor_id, now))
        conn.execute("INSERT INTO plan_versions(id, floor_id, asset_id, width_px, height_px, image_path, status, created_at, published_at) "
                     "VALUES (?, ?, ?, 100, 100, 'x', 'published', ?, ?)", (version, floor_id, asset, now, now))
        conn.execute("INSERT INTO map_anchors(id, floor_id, plan_version_id, resource_type, resource_id, x, y, layer_id, effective_from, updated_at) "
                     "VALUES (?, ?, ?, 'ha_entity', ?, 0.5, 0.5, 'devices', ?, ?)", (new_id(), floor_id, version, entity_id, now, now))


def test_turning_on_needs_the_check_and_its_digest_audited(bulk_app):
    app, s, c, _fake = bulk_app
    ids = _site(c, app)
    rep = _check(c)
    assert rep["blocking"] == 0 and rep["review_mode"] == "required" and rep["buildings"] == 2 and rep["reach_mode"] == "map_and_mapping"
    r = _on(c)
    assert (r.status_code, r.json()["code"]) == (409, "check_required"), r.text
    r = _on(c, "0" * 32)
    assert (r.status_code, r.json()["code"]) == (409, "check_stale") and r.json()["details"]["digest"] == rep["digest"]
    assert c.get(f"{API}/settings").json()["settings"]["home.multi_building"] == "off", "nothing turned on"
    denied = _audit(s, "home.multi_building", "denied")
    assert [d["reason"] for d in denied] == ["check_required", "check_stale"]
    r = _on(c, rep["digest"])
    assert r.status_code == 200 and r.json() == {"enabled": True, "check": "passed"}, r.text
    ok = _audit(s, "home.multi_building", "allowed")[-1]["details"]
    assert ok["enabled"] is True and ok["was"] is False and ok["check"]["result"] == "passed" and ok["check"]["digest"] == rep["digest"]
    # turning it off needs nothing; on again while on is a no-op without a check
    assert c.put(f"{API}/home/multi-building", json={"enabled": False}).json() == {"enabled": False}
    assert _on(c).status_code == 409, "off -> on again: the check again"
    m = c.get(f"{API}/sites/{_site_id(app, ids)}/mapping").json()
    assert (m["review_mode"], m["can_set_review"]) == ("required", True)


def _site_id(app, ids) -> str:
    with app.state.db.connection() as conn:
        return conn.execute("SELECT site_id FROM buildings WHERE id = ?", (ids["A"],)).fetchone()[0]


def test_the_check_reports_reach_gain_holders_sensitive_devices_and_unmapped_areas(bulk_app):
    app, s, c, _fake = bulk_app
    ids = _site(c, app)
    bind(c, s, "opa", "operator", "building", ids["A"])
    gid = _group(c, s, "דיירי ב", ["gmb"])
    _bind_raw(s, gid, "viewer", "building", ids["B"], kind="group")
    rep = _check(c)
    by = {f["code"]: f for f in rep["findings"]}
    gain = {r["id"]: r for r in by["reach_gain"]["items"]}
    assert by["reach_gain"]["severity"] == "warning"
    assert gain[ids["A"]]["holders"] == 1 and gain[ids["A"]]["holder_names"] == ["opa"] and gain[ids["A"]]["devices"] >= 3
    assert gain[ids["B"]]["holder_names"] == ["דיירי ב"], "a group is one holder, by its name"
    assert "entity_cross_building" not in by and rep["blocking"] == 0
    with app.state.db.connection() as conn:
        mapped = set(multi_building_check.report(conn)["findings"][0]["items"][0].keys())
    assert {"devices", "sensitive", "holders", "holder_names", "sensitive_names"} <= mapped
    # placing a device on A's map removes it from A's gain (placement already reaches it)
    before = gain[ids["A"]]["devices"]
    _anchor(app, ids["fA"], "light.lobby")
    after = {r["id"]: r for r in {f["code"]: f for f in _check(c)["findings"]}["reach_gain"]["items"]}
    assert after[ids["A"]]["devices"] == before - 1


def test_a_device_placed_in_one_building_but_mapped_to_another_blocks_until_fixed_or_reach_is_map_only(bulk_app):
    app, s, c, _fake = bulk_app
    ids = _site(c, app)
    _anchor(app, ids["fB"], "light.lobby")  # on B's map, while its area (lobby, platform floor "ground") is mapped to A
    rep = _check(c)
    cross = [f for f in rep["findings"] if f["code"] == "entity_cross_building"][0]
    assert cross["severity"] == "blocking" and rep["blocking"] == 1
    assert cross["items"][0]["id"] == "light.lobby" and cross["items"][0]["placed_in"] == "משותף" and cross["items"][0]["building"] == "בניין א"
    r = _on(c, rep["digest"])
    assert (r.status_code, r.json()["code"]) == (409, "check_blocked"), r.text
    assert _audit(s, "home.multi_building", "denied")[-1]["details"]["check"]["cross_building"] == 1
    # "מיקום במפה": the mapping grants nothing, so the same finding is a warning and the switch may go on
    assert c.put(f"{API}/home/building-reach", json={"mode": "map"}).status_code == 200
    rep = _check(c)
    assert rep["blocking"] == 0 and [f["severity"] for f in rep["findings"] if f["code"] == "entity_cross_building"] == ["warning"]
    assert _on(c, rep["digest"]).status_code == 200


def test_skipping_the_check_is_an_audited_setting_of_the_roles_administrator(bulk_app):
    app, s, c, _fake = bulk_app
    ids = _site(c, app)
    bind(c, s, "sad", "site_admin", "site", _site_id(app, ids))
    r = c.put(f"{API}/home/multi-building/review", json={"mode": "skip"}, headers=as_user("sad"))
    assert r.status_code == 403, "a site administrator may switch multi-building on, but not skip its check"
    assert c.put(f"{API}/home/multi-building/review", json={"mode": "never"}).status_code == 422
    assert c.put(f"{API}/home/multi-building/review", json={"mode": "skip"}).json() == {"mode": "skip"}
    row = _audit(s, "home.multi_building.review", "allowed")[-1]["details"]
    assert row == {"mode": "skip", "was": "required", "multi_building": False}
    assert _check(c)["review_mode"] == "skip"
    _anchor(app, ids["fB"], "light.lobby")  # a blocking finding does not stop a skipped check - it is still recorded
    r = _on(c, headers=as_user("sad"))
    assert r.status_code == 200 and r.json() == {"enabled": True, "check": "skipped"}, r.text
    d = _audit(s, "home.multi_building", "allowed")[-1]["details"]
    assert d["check"]["result"] == "skipped" and d["check"]["blocking"] == 1
    assert c.put(f"{API}/home/multi-building/review", json={"mode": "required"}).status_code == 200


def test_the_check_lists_the_mapping_versions_applied_since_the_switch_was_last_on(client, settings):
    ids = _two_buildings(client)
    with Database(settings.db_path).connection() as conn:
        conn.execute("INSERT INTO ha_areas(area_id, name, floor_id, updated_at) VALUES ('hall', 'אולם', NULL, ?)", (now_iso(),))
    plan = {"areas": [{"area_id": "hall", "floor": "keep", "building": ids["B"]}], "items": []}
    assert client.post(f"{API}/sites/{ids['site']}/mapping/apply", json={"state": {}, "plan": plan}).status_code == 200
    rep = _check(client)
    since = [f for f in rep["findings"] if f["code"] == "versions_since"][0]
    assert since["severity"] == "info" and since["count"] == 1 and since["items"][0]["number"] == 1 and rep["last_on"] is None
    assert _on(client, rep["digest"]).status_code == 200
    assert client.put(f"{API}/home/multi-building", json={"enabled": False}).status_code == 200
    rep = _check(client)
    assert not [f for f in rep["findings"] if f["code"] == "versions_since"] and rep["last_on"]
    assert client.post(f"{API}/sites/{ids['site']}/mapping/apply", json={"state": {}, "plan": plan}).status_code == 200
    since = [f for f in _check(client)["findings"] if f["code"] == "versions_since"][0]
    assert [v["number"] for v in since["items"]] == [2]


def test_the_check_needs_the_switch_permission_and_one_building_is_a_warning_not_a_block(client, settings):
    site = client.post(f"{API}/sites", json={"name": "אתר"}).json()
    client.post(f"{API}/sites/{site['id']}/buildings", json={"name": "יחיד"})
    bind(client, settings, "dana", "viewer", "installation", "*")
    assert client.get(f"{API}/home/multi-building/check", headers=as_user("dana")).status_code == 403
    rep = _check(client)
    codes = {f["code"]: f["severity"] for f in rep["findings"]}
    assert codes == {"single_building": "warning", "mapping_empty": "warning"} and rep["blocking"] == 0
    assert _on(client, rep["digest"]).status_code == 200
