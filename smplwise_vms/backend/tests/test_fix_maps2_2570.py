"""FIX-MAPS2-2570 (deep review 2.57, area MH): the server side of MH2-04, MH2-05 and MH2-06.

- MH2-06: `GET /skins/status` (whether a render key is configured, the provider, the budget, the last connection test) is the system
  settings' information: `system.configure` on the installation, an audited refusal for anyone else (a viewer, a kiosk / wall user).
- MH2-05: a wall profile save may carry the `version` the dialog loaded; a profile saved meanwhile by another administrator answers 409
  `stale_version` and nothing is written (no bindings re-synced). Without `version` the save is exactly as before (additive).
- MH2-04: `GET /ha/entities?area_buildings=true` adds each area's building (the building cut's own resolution, null = no building), so
  the plan wizard links a room only to an area of its own building. Without the parameter the answer is as before."""
from __future__ import annotations

import json

from conftest import as_user, bind
from test_building_scope_control_2351 import _site
from test_devices import bulk_app, dev_app  # noqa: F401 - the fixtures of the bulk tests
from test_plan_skins import _app as skins_app
from test_wall import ADMIN, _add, _setup

API = "/api/v1"


def _audit(app, action: str) -> list[dict]:
    with app.state.db.connection() as conn:
        rows = [dict(r) for r in conn.execute("SELECT * FROM audit_log WHERE action = ? ORDER BY rowid", (action,)).fetchall()]
    for r in rows:
        r["details"] = json.loads(r["details_json"] or "{}")
    return rows


# ------------------------------------------------------------------------------------------------------------------ MH2-06 skins status

def test_skins_status_is_for_system_configure_only_and_a_refusal_is_audited(settings):
    app, c = skins_app(settings)
    assert c.get(f"{API}/skins/status").status_code == 200, "the installation administrator reads it"
    bind(c, settings, "dana", "viewer", "installation", "*")
    bind(c, settings, "ed", "editor", "installation", "*")
    for who in ("dana", "ed"):
        r = c.get(f"{API}/skins/status", headers=as_user(who))
        assert r.status_code == 403, (who, r.text)
        assert "key_configured" not in r.text and "budget" not in r.text
    denied = [r for r in _audit(app, "system.configure") if r["decision"] == "denied"]
    assert len(denied) >= 2, "each refusal leaves an audit row"


def test_skins_status_refused_to_a_wall_user(settings):
    app, c, cams = _setup(settings)
    assert _add(c, cams).status_code == 201
    r = c.get(f"{API}/skins/status", headers=as_user("wall"))
    assert r.status_code == 403, r.text


# ------------------------------------------------------------------------------------------------------------------ MH2-05 wall version

def test_wall_save_with_a_stale_version_is_refused_and_changes_nothing(settings):
    app, c, cams = _setup(settings)
    assert _add(c, cams).status_code == 201
    loaded = c.get(f"{API}/wall/profiles/dev-wall", headers=ADMIN).json()
    assert loaded["version"] == 1
    # administrator B removes a camera and saves with the version it loaded
    r = c.patch(f"{API}/wall/profiles/dev-wall", json={"version": 1, "config": {"cameras": [cams[0]]}}, headers=ADMIN)
    assert r.status_code == 200, r.text
    assert r.json()["version"] == 2
    # administrator A (dialog opened at version 1) changes the title and sends the whole configuration it loaded
    r = c.patch(f"{API}/wall/profiles/dev-wall", json={"version": 1, "title": "לובי", "config": loaded["config"]}, headers=ADMIN)
    assert r.status_code == 409, r.text
    assert r.json()["code"] == "stale_version"
    assert r.json()["details"]["current_version"] == 2 and r.json()["details"]["sent_version"] == 1
    now = c.get(f"{API}/wall/profiles/dev-wall", headers=ADMIN).json()
    assert now["version"] == 2 and now["title"] == "קבלה" and now["config"]["cameras"] == [cams[0]], "B's change stays"
    assert c.get(f"{API}/media/live/{cams[1]}", headers=as_user("wall")).status_code in (403, 404), "the removed camera is not granted again"
    # the current version saves
    r = c.patch(f"{API}/wall/profiles/dev-wall", json={"version": 2, "title": "לובי"}, headers=ADMIN)
    assert r.status_code == 200 and r.json()["version"] == 3 and r.json()["config"]["cameras"] == [cams[0]]


def test_wall_save_without_a_version_is_as_before(settings):
    app, c, cams = _setup(settings)
    assert _add(c, cams).status_code == 201
    r = c.patch(f"{API}/wall/profiles/dev-wall", json={"title": "לובי"}, headers=ADMIN)
    assert r.status_code == 200 and r.json()["version"] == 2
    assert c.patch(f"{API}/wall/profiles/dev-wall", json={"version": 0}, headers=ADMIN).status_code == 422


# ------------------------------------------------------------------------------------------------------------------ MH2-04 area buildings

def test_entities_name_each_areas_building_only_when_asked(bulk_app):  # noqa: F811 - the fixture imported above
    app, _s, c, _fake = bulk_app
    ids = _site(c, app)
    plain = c.get(f"{API}/ha/entities", params={"limit": 1}).json()
    assert plain["areas"] and all("building_id" not in a for a in plain["areas"]), "without the parameter: as before"
    got = c.get(f"{API}/ha/entities", params={"limit": 1, "area_buildings": "true"}).json()
    by = {a["area_id"]: a["building_id"] for a in got["areas"]}
    want = {"lobby": ids["A"], "empty_room": ids["A"], "garden": ids["A"], "office": ids["B"]}  # building_scope's own answer for _site
    assert {"lobby", "office"} <= set(by) and all(by[a] == want.get(a) for a in by), by
    with app.state.db.connection() as conn:  # an area taken off every floor by hand (and no area -> building row) has no building
        conn.execute("INSERT INTO home_area_links(area_id, floor_id, updated_at, updated_by) VALUES ('lobby', NULL, '2026-11-28T00:00:00Z', 'test')")
    got = c.get(f"{API}/ha/entities", params={"limit": 1, "area_buildings": "true"}).json()
    assert {a["area_id"]: a["building_id"] for a in got["areas"]}["lobby"] is None
