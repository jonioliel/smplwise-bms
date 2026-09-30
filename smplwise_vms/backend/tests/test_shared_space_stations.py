"""CR-009 §13 / §14 (owner decisions 2026-09-30): WisKey stations as members of a shared space (listed by name, no reach, the
existing `access.read` model, fail closed) and one-step deletion of a shared room from its home floor."""
from __future__ import annotations

import sqlite3
from typing import Any

import pytest
from conftest import as_user
from test_shared_spaces import _binding, _live_share_rows, _p, _share, _world

from smplwise.db import Database
from smplwise.services import intercom_sync
from smplwise.services import shared_spaces as ss

STATIONS = {"stations": [{"id": "entry-a", "name": "Main gate"}, {"id": "entry-b", "name": "Side door"}]}


@pytest.fixture()
def wiskey(monkeypatch):
    """The served WisKey copy: `state["copy"]` is the overview served (None: no honest copy)."""
    state: dict[str, Any] = {"copy": STATIONS}
    monkeypatch.setattr(intercom_sync.SYNC, "served", lambda settings: ("ready" if state["copy"] else "connecting", state["copy"]))
    return state


def _members_url(w: dict) -> str:
    return f"/api/v1/zones/{w['hall']}/share/members"


def _station_ids(body: dict) -> set[str]:
    return {m["resource_id"] for m in body["members"] if m["resource_type"] == "wiskey_station"}


def test_a_station_is_listed_as_a_member_by_name_with_no_floors_and_no_reach(settings, wiskey):
    w = _world(settings)
    c = w["c"]
    _share(w)
    listing = c.get(_members_url(w)).json()
    picks = [x for x in listing["candidates"] if x["resource_type"] == "wiskey_station"]
    assert [(x["resource_id"], x["kind"], x["name"], x["floors"]) for x in picks] == [("entry-a", "station", "Main gate", []), ("entry-b", "station", "Side door", [])]
    r = c.post(_members_url(w), json={"resource_type": "wiskey_station", "resource_id": "entry-a"})
    assert r.status_code == 201 and r.json()["added"] is True
    assert c.post(_members_url(w), json={"resource_type": "wiskey_station", "resource_id": "entry-a"}).json()["added"] is False
    body = c.get(_members_url(w)).json()
    m = next(x for x in body["members"] if x["resource_type"] == "wiskey_station")
    assert (m["resource_id"], m["kind"], m["name"], m["floors"]) == ("entry-a", "station", "Main gate", [])
    assert set(m) == {"resource_type", "resource_id", "kind", "name", "added_at", "floors"}, "id and name only: no state, people, events, camera or door data"
    assert "entry-a" not in {x["resource_id"] for x in body["candidates"]}
    with w["app"].state.db.connection() as conn:
        # a station has no anchor and reaches no floor: every reach helper leaves it out
        assert not any(k[0] == "wiskey_station" for k in ss.mirrored_anchor_floors(conn))
        assert not any(k[0] == "wiskey_station" for k in ss.member_share_floors(conn))
        assert not any(k[0] == "wiskey_station" for k in ss.floor_mirrored(conn, w["f3"]))
        row = conn.execute("SELECT details_json FROM audit_log WHERE action = 'zone.share.member_add' AND details_json LIKE '%wiskey_station:entry-a%'").fetchone()
        assert row is not None


def test_only_a_reader_with_access_read_sees_a_station_member_and_a_floor_reader_never_does(settings, wiskey):
    w = _world(settings)
    c = w["c"]
    _share(w)
    assert c.post(_members_url(w), json={"resource_type": "wiskey_station", "resource_id": "entry-a"}).status_code == 201
    for u in ("dana", "inst"):
        c.get("/api/v1/me", headers=as_user(u))
    _binding(settings, "dana", "viewer", "floor", w["f3"])  # reaches the hall (its cameras), but access.read is installation-only
    _binding(settings, "inst", "viewer", "installation", "*")
    dana = c.get(_members_url(w), headers=as_user("dana")).json()
    assert _station_ids(dana) == set() and dana["members"], "the room's other members are still hers"
    inst = c.get(_members_url(w), headers=as_user("inst")).json()
    assert _station_ids(inst) == {"entry-a"} and inst["can_manage"] is False and "candidates" not in inst
    # exactly what the WisKey screens require of the same user
    assert c.get("/api/v1/intercom/overview", headers=as_user("dana")).status_code == 403
    assert c.get("/api/v1/intercom/overview", headers=as_user("inst")).status_code == 200


def test_station_visibility_fails_closed(settings, monkeypatch):
    w = _world(settings)
    with w["app"].state.db.connection() as conn:
        assert ss.station_visible(conn, _p("admin"), "entry-a") in (True, False)
        assert ss.station_visible(conn, _p("nobody-at-all"), "entry-a") is False
        assert ss.station_visible(conn, _p("admin"), "") is False
        assert ss.station_visible(conn, _p("admin"), "x" * 129) is False

        def boom(*a: Any, **k: Any) -> Any:
            raise RuntimeError("rbac exploded")

        import smplwise.rbac as rbac

        monkeypatch.setattr(rbac, "authorize", boom)
        assert ss.station_visible(conn, _p("admin"), "entry-a") is False


def test_adding_a_station_needs_the_share_rights_access_read_and_a_real_station(settings, wiskey):
    w = _world(settings)
    c = w["c"]
    _share(w)
    for u in ("ofer", "both"):
        c.get("/api/v1/me", headers=as_user(u))
    _binding(settings, "ofer", "editor", "floor", w["f3"])
    _binding(settings, "both", "editor", "floor", w["f2"])
    _binding(settings, "both", "editor", "floor", w["f3"])
    body = {"resource_type": "wiskey_station", "resource_id": "entry-a"}
    assert c.post(_members_url(w), json=body, headers=as_user("ofer")).status_code == 403  # one floor only
    both = c.post(_members_url(w), json=body, headers=as_user("both"))
    assert both.status_code == 403 and both.json()["details"]["permission"] == "access.read", "the share rights alone do not show a station"
    assert c.post(_members_url(w), json={"resource_type": "wiskey_station", "resource_id": "nope"}).status_code == 404
    wiskey["copy"] = None
    assert c.post(_members_url(w), json=body).status_code == 503
    wiskey["copy"] = STATIONS
    assert c.post(_members_url(w), json={"resource_type": "door", "resource_id": "entry-a"}).status_code == 422
    with w["app"].state.db.connection() as conn:
        assert ss.member_rows(conn) and not [m for m in ss.member_rows(conn) if m["resource_type"] == "wiskey_station"]


def test_a_station_member_ends_with_remove_unshare_and_floor_delete_and_the_stale_one_is_for_managers_only(settings, wiskey):
    w = _world(settings)
    c = w["c"]
    _share(w)
    url = _members_url(w)
    assert c.post(url, json={"resource_type": "wiskey_station", "resource_id": "entry-a"}).status_code == 201
    assert c.delete(f"{url}/wiskey_station/entry-a").status_code == 204
    assert c.delete(f"{url}/wiskey_station/entry-a").status_code == 404
    assert c.post(url, json={"resource_type": "wiskey_station", "resource_id": "entry-b"}).status_code == 201
    wiskey["copy"] = {"stations": [{"id": "entry-a", "name": "Main gate"}]}  # WisKey dropped entry-b
    stale = next(m for m in c.get(url).json()["members"] if m["resource_id"] == "entry-b")
    assert "שאינה קיימת" in stale["name"], "a manager can still see it to remove it"
    c.get("/api/v1/me", headers=as_user("inst"))
    _binding(settings, "inst", "viewer", "installation", "*")
    assert _station_ids(c.get(url, headers=as_user("inst")).json()) == set()
    wiskey["copy"] = STATIONS
    assert c.delete(f"/api/v1/zones/{w['hall']}/share/{w['f3']}").status_code == 204  # unshare: the last share ends every member
    with w["app"].state.db.connection() as conn:
        assert ss.member_rows(conn) == []
    # a floor delete ends them too (end_for_floor is type-blind)
    w2 = _world(settings)
    _share(w2)
    assert w2["c"].post(_members_url(w2), json={"resource_type": "wiskey_station", "resource_id": "entry-a"}).status_code == 201
    assert w2["c"].delete(f"/api/v1/floors/{w2['f3']}?force=true").status_code == 204
    with w2["app"].state.db.connection() as conn:
        assert conn.execute("SELECT COUNT(*) FROM shared_space_members WHERE removed_at IS NULL").fetchone()[0] == 0


def test_the_members_table_of_a_database_from_before_stations_is_widened_in_place():
    mem = sqlite3.connect(":memory:")
    mem.execute("CREATE TABLE spatial_zones(id TEXT PRIMARY KEY)")
    mem.execute("CREATE TABLE floors(id TEXT PRIMARY KEY)")
    mem.execute("CREATE TABLE cache_versions(name TEXT PRIMARY KEY, version INTEGER)")
    mem.execute("INSERT INTO cache_versions VALUES ('structure', 1)")
    mem.execute("CREATE TABLE shared_spaces(id TEXT PRIMARY KEY, zone_id TEXT, home_floor_id TEXT, floor_id TEXT, other_zone_id TEXT, placement_json TEXT, revision INTEGER, created_by TEXT, "
                "created_at TEXT, updated_at TEXT, removed_at TEXT, removed_by TEXT)")
    mem.execute("CREATE TABLE shared_space_members(id TEXT PRIMARY KEY, zone_id TEXT NOT NULL REFERENCES spatial_zones(id), resource_type TEXT NOT NULL CHECK (resource_type IN ('camera', 'ha_entity')), "
                "resource_id TEXT NOT NULL, added_by TEXT, added_at TEXT NOT NULL, removed_at TEXT, removed_by TEXT)")
    mem.execute("INSERT INTO spatial_zones VALUES ('z1')")
    mem.execute("INSERT INTO shared_space_members(id, zone_id, resource_type, resource_id, added_at) VALUES ('m1', 'z1', 'camera', 'cam1', 't')")
    with pytest.raises(sqlite3.IntegrityError):
        mem.execute("INSERT INTO shared_space_members(id, zone_id, resource_type, resource_id, added_at) VALUES ('m2', 'z1', 'wiskey_station', 'entry-a', 't')")
    assert ss.ensure_schema(mem) == ["shared_space_members.wiskey_station"]
    assert ss.ensure_schema(mem) == []
    assert mem.execute("SELECT id, resource_id FROM shared_space_members").fetchall() == [("m1", "cam1")], "the rows survive"
    mem.execute("INSERT INTO shared_space_members(id, zone_id, resource_type, resource_id, added_at) VALUES ('m2', 'z1', 'wiskey_station', 'entry-a', 't')")
    with pytest.raises(sqlite3.IntegrityError):  # the unique index came back with the table
        mem.execute("INSERT INTO shared_space_members(id, zone_id, resource_type, resource_id, added_at) VALUES ('m3', 'z1', 'wiskey_station', 'entry-a', 't')")
    triggers = {r[0] for r in mem.execute("SELECT name FROM sqlite_master WHERE type = 'trigger'")}
    assert {"trg_cv_shared_members_ins", "trg_cv_shared_members_upd", "trg_cv_shared_members_del"} <= triggers


# ---------------------------------------------------------------- §14: deleting a shared room in one step


def _zone_alive(w: dict, zid: str) -> bool:
    with w["app"].state.db.connection() as conn:
        return conn.execute("SELECT deleted_at FROM spatial_zones WHERE id = ?", (zid,)).fetchone()[0] is None


def test_deleting_a_shared_room_from_its_home_floor_unshares_and_deletes_in_one_request(settings, wiskey):
    w = _world(settings)
    c = w["c"]
    _share(w)
    assert c.post(_members_url(w), json={"resource_type": "wiskey_station", "resource_id": "entry-a"}).status_code == 201
    url = f"/api/v1/zones/{w['hall']}"
    plain = c.delete(url)
    assert plain.status_code == 409 and plain.json()["code"] == "zone_shared"
    assert plain.json()["details"]["home_floor_id"] == w["f2"] and plain.json()["details"]["home_zone_id"] == w["hall"]
    assert c.delete(f"/api/v1/zones/{w['dup']}?with_unshare=true").status_code == 409, "another floor's outline is deleted from the home floor"
    assert _live_share_rows(w)[0] == 1 and _zone_alive(w, w["hall"])
    assert c.delete(f"{url}?with_unshare=true").status_code == 204
    assert _live_share_rows(w) == (0, 0) and not _zone_alive(w, w["hall"])
    assert _zone_alive(w, w["dup"]), "the other floor keeps its outline as an ordinary room"
    with w["app"].state.db.connection() as conn:
        actions = [r[0] for r in conn.execute("SELECT action FROM audit_log WHERE resource_id = ? AND action IN ('zone.unshare', 'zone.delete') ORDER BY rowid", (w["hall"],)).fetchall()]
        assert actions == ["zone.unshare", "zone.delete"]
        # cameras and entities are not deleted: the anchors and the camera rows are where they were
        assert conn.execute("SELECT COUNT(*) FROM map_anchors WHERE floor_id = ? AND effective_to IS NULL", (w["f2"],)).fetchone()[0] == 4
        assert conn.execute("SELECT COUNT(*) FROM cameras").fetchone()[0] == 4
    # the mirror is gone from the other floor at once
    assert not any(a.get("shared") for a in c.get(f"/api/v1/floors/{w['f3']}/map").json()["anchors"])


def test_deleting_a_shared_room_needs_the_share_rights_on_every_floor_and_writes_nothing_otherwise(settings, wiskey):
    w = _world(settings)
    c = w["c"]
    _share(w)
    for u in ("only2", "both"):
        c.get("/api/v1/me", headers=as_user(u))
    _binding(settings, "only2", "editor", "floor", w["f2"])
    _binding(settings, "both", "editor", "floor", w["f2"])
    _binding(settings, "both", "editor", "floor", w["f3"])
    url = f"/api/v1/zones/{w['hall']}?with_unshare=true"
    r = c.delete(url, headers=as_user("only2"))
    assert r.status_code == 403
    assert _live_share_rows(w)[0] == 1 and _zone_alive(w, w["hall"]), "nothing was written"
    deny = _binding(settings, "both", "editor", "floor", w["f3"], effect="deny")
    assert c.delete(url, headers=as_user("both")).status_code == 403 and _zone_alive(w, w["hall"])
    with Database(settings.db_path).connection() as conn:
        conn.execute("DELETE FROM bindings WHERE id = ?", (deny,))
    assert c.delete(url, headers=as_user("both")).status_code == 204
    assert _live_share_rows(w) == (0, 0) and not _zone_alive(w, w["hall"])


def test_a_failure_in_the_middle_of_the_delete_rolls_everything_back(settings, monkeypatch):
    w = _world(settings)
    c = w["c"]
    _share(w)
    from smplwise.services import revocation

    def boom(*a: Any, **k: Any) -> None:
        raise RuntimeError("revocation failed")

    monkeypatch.setattr(revocation, "mark", boom)
    with pytest.raises(RuntimeError):
        c.delete(f"/api/v1/zones/{w['hall']}?with_unshare=true")
    assert _live_share_rows(w)[0] == 1 and _live_share_rows(w)[1] >= 1 and _zone_alive(w, w["hall"])
    with w["app"].state.db.connection() as conn:
        assert conn.execute("SELECT COUNT(*) FROM audit_log WHERE resource_id = ? AND action IN ('zone.unshare', 'zone.delete')", (w["hall"],)).fetchone()[0] == 0


def test_an_ordinary_room_still_deletes_as_before(settings):
    w = _world(settings)
    c = w["c"]
    assert c.delete(f"/api/v1/zones/{w['dup']}").status_code == 204
    assert not _zone_alive(w, w["dup"])


# ---------------------------------------------------------------- Opus review of the branch


def test_review_m1_removing_a_station_member_needs_access_read_before_any_lookup(settings, wiskey):
    """A both-floors editor without access.read must not learn (404 vs 204) which station ids are members, nor remove one."""
    w = _world(settings)
    c = w["c"]
    _share(w)
    assert c.post(_members_url(w), json={"resource_type": "wiskey_station", "resource_id": "entry-a"}).status_code == 201
    c.get("/api/v1/me", headers=as_user("both"))
    _binding(settings, "both", "editor", "floor", w["f2"])
    _binding(settings, "both", "editor", "floor", w["f3"])
    url = _members_url(w)
    member = c.delete(f"{url}/wiskey_station/entry-a", headers=as_user("both"))
    stranger = c.delete(f"{url}/wiskey_station/not-a-member", headers=as_user("both"))
    assert member.status_code == 403 and stranger.status_code == 403, "the same answer for a member and a non-member"
    assert member.json()["details"]["permission"] == "access.read"
    with w["app"].state.db.connection() as conn:
        assert [m["resource_id"] for m in ss.member_rows(conn) if m["resource_type"] == "wiskey_station"] == ["entry-a"]
    assert c.delete(f"{url}/wiskey_station/entry-a").status_code == 204  # the admin holds access.read


def test_review_l2_the_409_names_the_home_floor_only_to_a_caller_who_may_read_it(settings):
    w = _world(settings)
    c = w["c"]
    _share(w)
    c.get("/api/v1/me", headers=as_user("only3"))
    _binding(settings, "only3", "editor", "floor", w["f3"])
    mine = c.delete(f"/api/v1/zones/{w['dup']}", headers=as_user("only3"))  # her own floor's outline of the room
    assert mine.status_code == 409 and mine.json()["code"] == "zone_shared"
    assert mine.json()["details"] == {"home_floor_name": ss.OTHER_FLOOR}, "no home floor id, no floors"
    admin = c.delete(f"/api/v1/zones/{w['dup']}")
    assert admin.status_code == 409 and admin.json()["details"]["home_floor_id"] == w["f2"] and "floors" not in admin.json()["details"]


def test_review_l3_the_map_bundle_hides_the_names_of_floors_the_reader_may_not_read(settings):
    w = _world(settings)
    c = w["c"]
    _share(w)
    for u in ("only2", "only3"):
        c.get("/api/v1/me", headers=as_user(u))
    _binding(settings, "only3", "editor", "floor", w["f3"])
    _binding(settings, "only2", "editor", "floor", w["f2"])
    mirror = c.get(f"/api/v1/floors/{w['f3']}/map", headers=as_user("only3")).json()
    marks = [z["shared"] for z in mirror["zones"] if z.get("shared")]
    assert marks and all(m["home_floor_name"] == ss.OTHER_FLOOR for m in marks)
    home = c.get(f"/api/v1/floors/{w['f2']}/map", headers=as_user("only2")).json()
    hm = next(z["shared"] for z in home["zones"] if z.get("shared") and z["shared"]["role"] == "home")
    assert hm["home_floor_name"] and hm["floors"] and all(f["name"] == ss.OTHER_FLOOR for f in hm["floors"]), "her own floor is named, the floors she may not read are not"
    both = c.get(f"/api/v1/floors/{w['f2']}/map").json()  # the admin reads every floor
    assert all(f["name"] != ss.OTHER_FLOOR for z in both["zones"] if z.get("shared") for f in z["shared"].get("floors", []))


def test_review_l4_revocation_is_marked_again_after_the_commit(settings, monkeypatch):
    w = _world(settings)
    c = w["c"]
    _share(w)
    from smplwise.services import revocation

    seen: list[bool] = []

    def spy(users: Any) -> None:
        with Database(settings.db_path).connection(mode="read") as other:  # a second connection sees committed state only
            seen.append(other.execute("SELECT deleted_at FROM spatial_zones WHERE id = ?", (w["hall"],)).fetchone()[0] is not None)

    monkeypatch.setattr(revocation, "mark", spy)
    assert c.delete(f"/api/v1/zones/{w['hall']}?with_unshare=true").status_code == 204
    assert seen[0] is False and seen[-1] is True, "once before the commit, and again when the new state is visible to a second reader"
