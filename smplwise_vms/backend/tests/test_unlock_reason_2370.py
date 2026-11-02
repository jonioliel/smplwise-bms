"""UNLOCK-REASON-2370: a lock that cannot be opened says WHY. `can_unlock` is `unlock_reason == "ok"` - one function
(services/door_authority.unlock_reason) behind `GET /devices/items?kind=locks`, `GET /ha/entities/{id}` and the WisKey open button -
so the panel stops saying "פתיחה דורשת הרשאה נפרדת" for every refusal. The lab case that prompted it: ten WisKey doors, none in the door
map, a system administrator who held every permission. Fakes only: no Home Assistant, no WisKey, no door."""
from __future__ import annotations

from typing import Any

from conftest import as_user, bind, png_bytes, seed_tree
from fastapi.testclient import TestClient

from smplwise.rbac import Principal
from smplwise.services import alarm as alarm_svc
from smplwise.services import door_authority
from test_wiskey_door_path import API, DOCK, ENTRY, SIDE, _clean, custom_role, map_all, world  # noqa: F401 - the fixtures

REASONS = {"ok", "no_permission", "door_not_mapped", "alarm_managed", "not_placed", "wall_profile", "no_control"}


def lock_rows(c: TestClient, user: str | None = None) -> dict[str, dict[str, Any]]:
    body = c.get(f"{API}/devices/items", params={"kind": "locks"}, headers=as_user(user) if user else {})
    assert body.status_code == 200, body.text
    return {r["entity_id"]: r for f in body.json()["floors"] for a in f["areas"] for r in a["items"]}


def reasons(c: TestClient, user: str | None = None) -> dict[str, str]:
    return {k: v["unlock_reason"] for k, v in lock_rows(c, user).items()}


def entity(c: TestClient, entity_id: str, user: str | None = None) -> dict[str, Any]:
    r = c.get(f"{API}/ha/entities/{entity_id}", headers=as_user(user) if user else {})
    assert r.status_code == 200, r.text
    return r.json()


def unlock_action(e: dict[str, Any]) -> dict[str, Any]:
    return next(a for a in e["actions"] if a["id"] == "lock.unlock")


def publish_plan(c: TestClient, floor_id: str) -> None:
    asset = c.post(f"{API}/floors/{floor_id}/plan-assets", files={"file": ("p.png", png_bytes(), "image/png")}).json()
    v = c.post(f"{API}/floors/{floor_id}/plan-versions", json={"asset_id": asset["id"]}).json()
    assert c.post(f"{API}/plan-versions/{v['id']}/publish").status_code in (200, 201)


def place(c: TestClient, floor_id: str, entity_id: str) -> None:
    """An anchor of the lock entity on the floor's map (the placement a floor-scoped door grant reaches through)."""
    r = c.post(f"{API}/floors/{floor_id}/anchors", json={"resource_type": "ha_entity", "resource_id": entity_id, "x": 0.2, "y": 0.2})
    assert r.status_code == 201, r.text


def principal(name: str) -> Principal:
    return Principal(user_id=f"dev-{name}", username=name, display_name=name, source="dev")


# ---------------------------------------------------------------- the lab case: an intercom door without a door-map entry

def test_unmapped_wiskey_doors_say_so_whatever_the_callers_permissions(world):
    """The system administrator holds every permission and still gets `door_not_mapped`: nothing else is evaluated for a door that has no
    station (the lab's ten locks). The list and the single view agree, and the open action carries the same reason."""
    c = world["c"]
    assert reasons(c) == {"lock.entrance": "door_not_mapped", "lock.side": "door_not_mapped", "lock.dock_gate": "door_not_mapped", "lock.office": "no_permission"}
    rows = lock_rows(c)
    assert all(r["can_unlock"] is False for r in rows.values()) and all(r["unlock_reason"] in REASONS for r in rows.values())
    e = entity(c, "lock.entrance")
    assert e["unlock_reason"] == "door_not_mapped" and e["wiskey_door"] is True
    assert unlock_action(e)["granted"] is False and unlock_action(e)["reason"] == "door_not_mapped"
    assert all(a["id"] != "lock.lock" for a in e["actions"]), "a WisKey door has no lock action (D6)"
    # an operator without any door grant gets the same word: the mapping is what is missing for everyone
    bind(c, world["settings"], "otto", "operator", "installation", "*")
    assert reasons(c, "otto")["lock.entrance"] == "door_not_mapped"


def test_mapping_the_doors_turns_the_reason_into_the_callers_own(world):
    c, s = world["c"], world["settings"]
    bind(c, s, "dana", "door_opener", "installation", "*")
    bind(c, s, "dana", "viewer", "installation", "*")
    bind(c, s, "otto", "operator", "installation", "*")
    bind(c, s, "vera", "viewer", "installation", "*")
    map_all(c)
    wiskey = ("lock.entrance", "lock.side", "lock.dock_gate")
    assert {k: v for k, v in reasons(c, "dana").items() if k in wiskey} == dict.fromkeys(wiskey, "ok")
    assert lock_rows(c, "dana")["lock.entrance"]["can_unlock"] is True
    for who in ("otto", "vera"):  # ha.entity.control (operator) is not a door grant
        assert {k: v for k, v in reasons(c, who).items() if k in wiskey} == dict.fromkeys(wiskey, "no_permission"), who
    e = entity(c, "lock.side", "dana")
    assert e["unlock_reason"] == "ok" and unlock_action(e)["granted"] is True
    e = entity(c, "lock.side", "otto")
    assert e["unlock_reason"] == "no_permission" and unlock_action(e)["granted"] is False


def test_a_stale_mapping_counts_as_not_mapped(world):
    """A map row whose relay left the served copy does not resolve: `door_not_mapped`, not a permission message."""
    c, s = world["c"], world["settings"]
    bind(c, s, "dana", "door_opener", "installation", "*")
    bind(c, s, "dana", "viewer", "installation", "*")
    map_all(c)
    assert reasons(c, "dana")["lock.dock_gate"] == "ok"
    with world["db"].connection() as conn:
        conn.execute("UPDATE intercom_door_map SET physical_index = 9 WHERE entity_id = 'lock.dock_gate'")
    assert reasons(c, "dana")["lock.dock_gate"] == "door_not_mapped"


def test_wall_display_account_gets_wall_profile(world):
    c, s = world["c"], world["settings"]
    map_all(c)
    bind(c, s, "wally", "door_opener", "installation", "*")
    bind(c, s, "wally", "viewer", "installation", "*")
    bind(c, s, "wally", "kiosk", "installation", "*")
    assert reasons(c, "wally")["lock.entrance"] == "wall_profile" and lock_rows(c, "wally")["lock.entrance"]["can_unlock"] is False
    assert entity(c, "lock.entrance", "wally")["unlock_reason"] == "wall_profile"


def test_floor_scoped_door_grant_says_not_placed_until_the_lock_is_on_the_floor(world):
    """The caller reads every lock (devices.read installation-wide) but holds the door grant on one floor only: a lock placed there is
    `ok`, any other - a WisKey door once mapped, or an ordinary one - is `not_placed`, never "needs a separate permission"."""
    c, s, db = world["c"], world["settings"], world["db"]
    ids = seed_tree(c)
    publish_plan(c, ids["floor2"])
    publish_plan(c, ids["floor3"])
    opener = custom_role(c, "פותח לפי קומה", ["door.unlock", "ha.entity.control"], ["devices.read", "entity.state.read"])
    bind(c, s, "viv", "viewer", "installation", "*")
    bind(c, s, "viv", opener, "floor", ids["floor2"])
    map_all(c)
    assert reasons(c, "viv") == {"lock.entrance": "not_placed", "lock.side": "not_placed", "lock.dock_gate": "not_placed", "lock.office": "not_placed"}
    place(c, ids["floor2"], "lock.entrance")
    place(c, ids["floor2"], "lock.office")
    place(c, ids["floor3"], "lock.side")
    assert reasons(c, "viv") == {"lock.entrance": "ok", "lock.side": "not_placed", "lock.dock_gate": "not_placed", "lock.office": "ok"}
    assert lock_rows(c, "viv")["lock.entrance"]["can_unlock"] is True and lock_rows(c, "viv")["lock.side"]["can_unlock"] is False
    with db.connection(mode="read") as conn:
        scope = door_authority.UnlockScope(conn, principal("viv"))
        assert door_authority.unlock_reason(conn, principal("viv"), "lock.side", wiskey=True, scope=scope) == "not_placed"
        assert door_authority.unlock_reason(conn, principal("viv"), "lock.office", wiskey=False, scope=scope) == "ok"


def test_ordinary_lock_reasons_permission_control_alarm(world, monkeypatch):
    c, s = world["c"], world["settings"]
    assert reasons(c)["lock.office"] == "no_permission", "the administrator holds ha.entity.control but not door.unlock"
    both = custom_role(c, "פותח מלא", ["door.unlock", "ha.entity.control"], ["devices.read", "entity.state.read"])
    only_unlock = custom_role(c, "פותח בלי שליטה", ["door.unlock"], ["devices.read", "entity.state.read"])
    bind(c, s, "dana", both, "installation", "*")
    bind(c, s, "uri", only_unlock, "installation", "*")
    bind(c, s, "vera", "viewer", "installation", "*")
    assert reasons(c, "dana")["lock.office"] == "ok"
    assert reasons(c, "uri")["lock.office"] == "no_control" and lock_rows(c, "uri")["lock.office"]["can_unlock"] is False
    assert reasons(c, "vera")["lock.office"] == "no_permission"
    assert entity(c, "lock.office", "uri")["unlock_reason"] == "no_control"
    # the alarm section owns the control: read-only here, for everyone
    monkeypatch.setattr(alarm_svc, "managed_controls", lambda conn: {"lock.office"})
    monkeypatch.setattr(alarm_svc, "is_managed_control", lambda conn, eid: eid == "lock.office")
    assert reasons(c, "dana")["lock.office"] == "alarm_managed" and reasons(c)["lock.office"] == "alarm_managed"
    assert entity(c, "lock.office", "dana")["unlock_reason"] == "alarm_managed"


def test_the_rule_judges_placement_before_control(world):
    """Pure function: a floor-bound door grant with the lock on another floor is `not_placed` even without control; placed, control decides."""
    c, s, db = world["c"], world["settings"], world["db"]
    ids = seed_tree(c)
    publish_plan(c, ids["floor2"])
    publish_plan(c, ids["floor3"])
    opener = custom_role(c, "פותח לפי קומה", ["door.unlock", "ha.entity.control"], ["devices.read", "entity.state.read"])
    bind(c, s, "fred", opener, "floor", ids["floor2"])
    place(c, ids["floor3"], "lock.office")
    with db.connection(mode="read") as conn:
        p = principal("fred")
        assert door_authority.unlock_reason(conn, p, "lock.office", wiskey=False, can_control=True) == "not_placed"
        assert door_authority.unlock_reason(conn, p, "lock.office", wiskey=False, can_control=False) == "not_placed"
        assert door_authority.unlock_reason(conn, p, "lock.office", wiskey=False, alarm_managed=True) == "alarm_managed", "the alarm wins over everything"
    place(c, ids["floor2"], "lock.office")
    with db.connection(mode="read") as conn:
        assert door_authority.unlock_reason(conn, principal("fred"), "lock.office", wiskey=False, can_control=True) == "ok"
        assert door_authority.unlock_reason(conn, principal("fred"), "lock.office", wiskey=False, can_control=False) == "no_control"


def test_a_reason_is_a_code_only_nothing_about_the_configuration(world):
    """A caller without system.configure learns the code, never a station, role or binding through the reason."""
    c, s = world["c"], world["settings"]
    bind(c, s, "vera", "viewer", "installation", "*")
    for stage in ("unmapped", "mapped"):
        if stage == "mapped":
            map_all(c)
        body = c.get(f"{API}/devices/items", params={"kind": "locks"}, headers=as_user("vera")).text
        for needle in (ENTRY, SIDE, DOCK, "door_opener", "system_admin", "intercom_door_map"):
            assert needle not in body, (stage, needle)
        ent = entity(c, "lock.entrance", "vera")
        assert ent["unlock_reason"] in REASONS and unlock_action(ent)["reason"] == ent["unlock_reason"]
        assert set(unlock_action(ent)) - {"id", "label", "sensitive", "risk", "risk_label", "arguments", "argument_specs", "grant", "granted", "reason"} == set()


def test_unlock_reason_is_one_of_the_closed_set_and_can_unlock_follows_it(world):
    c, s = world["c"], world["settings"]
    for u, role in (("a", "viewer"), ("b", "operator"), ("c", "door_opener"), ("d", "site_admin")):
        bind(c, s, u, role, "installation", "*")
    bind(c, s, "c", "viewer", "installation", "*")
    for stage in ("unmapped", "mapped"):
        if stage == "mapped":
            map_all(c)
        for who in (None, "a", "b", "c", "d"):
            rows = lock_rows(c, who)
            assert rows and all(r["unlock_reason"] in REASONS and (r["unlock_reason"] == "ok") == r["can_unlock"] for r in rows.values()), (stage, who)


# ---------------------------------------------------------------- the notices that read the same counts

def test_door_grants_tab_carries_the_unmapped_count(world):
    c = world["c"]
    assert c.get(f"{API}/access/door-grants").json()["unmapped_doors"] == {"count": 3, "with_suggestion": 2}, "the dock has two relays: no one-to-one suggestion"
    map_all(c)
    assert c.get(f"{API}/access/door-grants").json()["unmapped_doors"] == {"count": 0, "with_suggestion": 0}


def _integrations(c: TestClient) -> dict[str, Any]:
    r = c.get(f"{API}/readiness")
    assert r.status_code == 200, r.text
    return next(x for x in r.json()["checks"] if x["id"] == "integrations")


def test_readiness_names_the_doors_waiting_and_links_to_the_door_map(world):
    c = world["c"]
    integ = _integrations(c)
    doors = [f for f in integ["facts"] if f["label"] == "שיוך דלתות"]
    assert len(doors) == 1 and doors[0]["ok"] is False and "ממתינות לשיוך" in doors[0]["value"]
    assert integ["applicable"] is True and integ["fraction"] is not None and integ["fraction"] < 1.0 and "ממתינות לשיוך" in integ["summary"]
    with world["db"].connection(mode="read") as conn:  # read-only: looking at the page maps nothing
        assert conn.execute("SELECT COUNT(*) FROM intercom_door_map").fetchone()[0] == 0
    map_all(c)
    assert not [f for f in _integrations(c)["facts"] if f["label"] == "שיוך דלתות"]


def test_readiness_next_step_is_the_door_map_when_it_is_all_that_is_left(world, monkeypatch):
    from smplwise.services import health_report, readiness

    monkeypatch.setattr(health_report, "build", lambda *a, **k: {"checks": [{"id": "ha_sync", "label": "HA", "status": "ok"}]})
    c = world["c"]
    integ = _integrations(c)
    assert integ["next"] == readiness.DOOR_MAP_NEXT == {"label": "שיוך דלתות", "href": "#/system/setup"} and 0 < integ["fraction"] < 1
    map_all(c)
    integ = _integrations(c)
    assert integ["fraction"] == 1.0 and integ["next"] is None


def test_readiness_clear_one_to_one_wording(world):
    """"N דלתות ממתינות לשיוך - אשר הצעות" when every waiting door has its suggestion (the dock's two relays make it a manual one)."""
    c = world["c"]
    assert c.put(f"{API}/intercom/door-map/lock.dock_gate", json={"station_id": DOCK, "relay": 2, "confirmed": True}).status_code == 200
    facts = _integrations(c)["facts"]
    assert any(f["value"] == "2 דלתות ממתינות לשיוך - אשר הצעות" for f in facts), facts
