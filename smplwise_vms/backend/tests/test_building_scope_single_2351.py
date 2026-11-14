"""BUILDING-SCOPE-CONTROL-2351, the single-entity gap: a control pressed inside one building of a multi-building site (the tiles' panel
rows, its lock-all, a WisKey door's open from a tile) goes through POST /ha/entities/{id}/actions, which took no building - so a crafted
request from building A's view could act on one device of building B. The route now takes the same optional `building` as the bulk
routes and runs the same shared check (services/building_scope.Cut); without it - and always while the multi-building switch is off,
where the client never sends it - nothing new runs and the replies, the audit rows and the bridge payload are today's."""
from __future__ import annotations

import json
from types import SimpleNamespace

import pytest
from conftest import as_user, bind
from test_building_scope_control_2351 import _preview, _site
from test_devices import _bulk, _finish, _place, _publish_plan, bulk_app, dev_app  # noqa: F401 - the fixtures of the bulk tests

from smplwise.services import building_scope

API = "/api/v1"


def _act(c, entity_id: str, rid: str, action: str = "light.turn_off", headers: dict | None = None, **extra):
    body = {"allowed_action_id": action, "arguments": {}, "expected_state_version": None, "confirmation_grant": None, "client_request_id": rid,
            "expires_at": "2099-01-01T00:00:00Z", **extra}
    return c.post(f"{API}/ha/entities/{entity_id}/actions", json=body, headers=headers or {})


def _ha_rows(app) -> list[dict]:
    with app.state.db.connection() as conn:
        rows = [dict(r) for r in conn.execute("SELECT * FROM audit_log WHERE action = 'ha.action' ORDER BY rowid").fetchall()]
    for r in rows:
        r["details"] = json.loads(r["details_json"] or "{}")
    return rows


def _sent(fake) -> list[str]:
    return [p["data"]["entity_id"] for p in fake.calls]


def _multi_on(c) -> None:
    assert c.put(f"{API}/home/multi-building", json={"enabled": True}).status_code == 200


def test_a_single_control_inside_a_building_reaches_only_that_buildings_devices(bulk_app):
    app, _s, c, fake = bulk_app
    ids = _site(c, app)
    _multi_on(c)
    # the building's own device: sent, the attempt row as always
    r = _act(c, "light.lobby", "in-a", building=ids["A"])
    assert r.status_code == 202, r.text
    assert _sent(fake) == ["light.lobby"]
    # the shared building is a building like any other: its own device only
    assert _act(c, "light.office", "in-b", building=ids["B"]).status_code == 202
    assert _sent(fake) == ["light.lobby", "light.office"]
    before = len(fake.calls)
    # a device of the other building, and a device of no building at all: refused, audited, nothing recorded or sent
    for eid, b, rid in (("light.office", ids["A"], "x1"), ("light.lobby", ids["B"], "x2"), ("light.garden", ids["B"], "x3"), ("switch.loose", ids["A"], "x4")):
        r = _act(c, eid, rid, action="switch.turn_on" if eid.startswith("switch.") else "light.turn_off", building=b)
        assert (r.status_code, r.json()["code"]) == (403, "outside_building"), (eid, r.text)
        assert r.json()["details"] == {"building_id": b, "entity_id": eid}
    assert len(fake.calls) == before, "nothing of another building is ever sent"
    denied = [x for x in _ha_rows(app) if x["decision"] == "denied" and x["reason"] == "outside_building"]
    assert [x["resource_id"] for x in denied] == ["light.office", "light.lobby", "light.garden", "switch.loose"]
    assert all(x["details"]["building_id"] and x["details"]["action"] for x in denied)
    with app.state.db.connection() as conn:
        assert not conn.execute("SELECT 1 FROM ha_actions WHERE client_request_id IN ('x1','x2','x3','x4')").fetchone(), "no pending record either"
    # an unknown / deleted building: 404, audited; an empty id: the body check
    r = _act(c, "light.lobby", "x5", building="no-such-building")
    assert (r.status_code, r.json()["code"]) == (404, "building_not_found")
    assert _ha_rows(app)[-1]["reason"] == "building_not_found"
    assert _act(c, "light.lobby", "x6", building="").status_code == 422
    assert len(fake.calls) == before


def test_the_single_route_and_the_bulk_route_agree_on_what_is_inside(bulk_app):
    """One shared check: whatever a building's bulk preview would send, its single route accepts - and nothing else."""
    app, _s, c, fake = bulk_app
    ids = _site(c, app)
    _multi_on(c)
    with app.state.db.connection() as conn:
        inside = {aid for aid in building_scope.cut(conn, ids["A"]).areas}
    targets = {t["entity_id"] for t in _preview(c, building=ids["A"]).json()["targets"]}
    assert targets == {"light.lobby", "light.garden"}
    for i, eid in enumerate(sorted(targets)):
        assert _act(c, eid, f"agree-{i}", building=ids["A"]).status_code == 202, eid
    assert _act(c, "light.office", "agree-x", building=ids["A"]).status_code == 403
    assert {"lobby", "garden"} <= inside and "office" not in inside


def test_permission_first_a_caller_without_control_learns_nothing_about_buildings(bulk_app):
    """The building check runs after the permission: a viewer gets the same audited 403 `forbidden` whatever building it names."""
    app, s, c, fake = bulk_app
    ids = _site(c, app)
    _multi_on(c)
    bind(c, s, "vi", "viewer", "installation", "*")
    for b in (ids["A"], ids["B"], "no-such-building"):
        r = _act(c, "light.office", f"vi-{b}", headers=as_user("vi"), building=b)
        assert (r.status_code, r.json()["code"]) == (403, "forbidden"), b
    assert not fake.calls
    assert not [x for x in _ha_rows(app) if x["reason"] in building_scope.REFUSAL_CODES]


def test_a_user_bound_to_building_a_never_controls_building_b(bulk_app):
    """The per-user limit is the role binding (rbac: a building-scoped binding reaches the floors of that building, and a device is
    reached through where it is placed on their maps - ha_scope). The single route enforces it with or without a building id, and a
    building id never widens it: naming the other building, or no building at all, is the same audited 403."""
    app, s, c, fake = bulk_app
    ids = _site(c, app)
    _multi_on(c)
    for f, eid in ((ids["fA"], "light.lobby"), (ids["fB"], "light.office")):
        _publish_plan(c, f)
        _place(c, f, eid)
    bind(c, s, "opa", "operator", "building", ids["A"])
    who = as_user("opa")
    assert _act(c, "light.lobby", "a-1", headers=who).status_code == 202
    assert _act(c, "light.lobby", "a-2", headers=who, building=ids["A"]).status_code == 202
    for rid, extra in (("b-1", {}), ("b-2", {"building": ids["B"]}), ("b-3", {"building": ids["A"]})):
        r = _act(c, "light.office", rid, headers=who, **extra)
        assert (r.status_code, r.json()["code"]) == (403, "forbidden"), extra
    assert _sent(fake) == ["light.lobby", "light.lobby"]
    # the bulk route agrees: building B's area is outside this user's reach whichever building the request names
    assert _preview(c, scope="area", id="office", building=ids["B"]).status_code == 200  # the installation admin, inside B: allowed
    r = c.get(f"{API}/devices/actions/preview", params={"kind": "lights_off", "scope": "area", "id": "office", "building": ids["B"]}, headers=who)
    assert r.status_code == 403


def test_a_wiskey_door_opened_from_a_tile_is_checked_before_the_door_path(bulk_app, monkeypatch):
    """The tile's open of a WisKey door leaves through the door authority, not the bridge - the building check runs before that hand-off."""
    app, _s, c, fake = bulk_app
    ids = _site(c, app)
    _multi_on(c)
    from smplwise.routers import access_control
    from smplwise.services import door_authority, intercom_doors

    monkeypatch.setattr(intercom_doors, "is_wiskey_lock", lambda _conn, eid: eid == "lock.front")
    monkeypatch.setattr(door_authority, "check", lambda *_a, **_k: SimpleNamespace(allowed=True, reason=None))
    opened: list[str] = []

    def fake_open(_request, _principal, entity_id, *_a):
        opened.append(entity_id)
        return {"id": "door-1", "status": "pending"}

    monkeypatch.setattr(access_control, "open_from_tile", fake_open)
    r = _act(c, "lock.front", "door-b", action="lock.unlock", confirmation_grant="confirmed", building=ids["B"])
    assert (r.status_code, r.json()["code"]) == (403, "outside_building")
    assert not opened and not fake.calls
    assert _ha_rows(app)[-1]["reason"] == "outside_building"
    r = _act(c, "lock.front", "door-a", action="lock.unlock", confirmation_grant="confirmed", building=ids["A"])
    assert r.status_code == 202, r.text
    assert opened == ["lock.front"]


@pytest.mark.parametrize("multi", [False, True])
def test_without_a_building_nothing_new_runs_and_every_reply_is_todays(bulk_app, monkeypatch, multi):
    """The switch OFF (the default - the client never names a building then) and the site level with the switch on: the building code is
    never entered (it would raise here), and the single action's reply, its audit rows and the bridge payload carry exactly today's
    fields; the tiles list and the bulk preview / run carry no building either."""
    app, _s, c, fake = bulk_app
    _site(c, app)
    if multi:
        _multi_on(c)
    else:
        with app.state.db.connection() as conn:
            assert conn.execute("SELECT value FROM settings WHERE key = 'home.multi_building.enabled'").fetchone() is None, "default OFF"

    def never(*_a, **_k):
        raise AssertionError("no building named: the building code must not run")

    for fn in ("cut", "require_entity", "building_areas", "area_buildings"):
        monkeypatch.setattr(building_scope, fn, never)
    r = _act(c, "light.lobby", "same-1")
    assert r.status_code == 202, r.text
    out = r.json()
    assert "building_id" not in out and "building" not in out
    from smplwise.services import ha_actions

    with app.state.db.connection() as conn:
        record = ha_actions.action_row(conn, out["id"])
    assert set(out) == set(record) | {"note", "timing_ms"}, "the reply is the action record plus today's two fields - nothing building-shaped"
    rows = [x for x in _ha_rows(app) if x["resource_id"] == "light.lobby"]
    attempt = [x for x in rows if x["details"].get("phase") == "attempt"][-1]
    assert set(attempt["details"]) == {"action", "id", "phase", "arguments", "sensitive"}
    assert all("building_id" not in x["details"] for x in rows)
    payload = fake.calls[-1]
    assert payload["data"] == {"entity_id": "light.lobby"} and (payload["domain"], payload["service"]) == ("light", "turn_off")
    # the list and the bulk routes without a building: the same - nothing building-shaped in the replies or the rows
    items = c.get(f"{API}/devices/items", params={"kind": "lights"})
    assert items.status_code == 200 and "building_id" not in items.json() and items.json()["name"]
    prev = _preview(c)
    assert prev.status_code == 200 and "building_id" not in prev.json()
    run = c.post(f"{API}/devices/actions", json=_bulk(scope="building", id="*", kind="lights_off", preview_digest=prev.json()["digest"]))
    assert run.status_code == 202, run.text
    _finish(c, run.json()["id"])
    with app.state.db.connection() as conn:
        bulk_rows = [json.loads(x[0] or "{}") for x in conn.execute("SELECT details_json FROM audit_log WHERE action = 'devices.bulk'").fetchall()]
    assert bulk_rows and all("building_id" not in d for d in bulk_rows)
