"""WHOIN034-295 (board r034 / r035): "who is in the building" over the CR-027 presence data, and the place editors' server side.

The permission (presence.view: system_admin only, sensitive, scoped like the map), the read API (GET presence/people: beacon >
Wi-Fi > geofence placement, freshness thresholds from the settings, a newer exit wins, the master switch, the current notice, the
phone's own sensor switches), the per-person opt-out (counted, never named or placed), counts-only mode, floor-scoped viewers,
the throttled audit without names, and the geofence / beacon / Wi-Fi validators (floor and area placement, SSIDs hashed and never
stored, one save validated as a whole)."""
from __future__ import annotations

import datetime as dt
import json
from pathlib import Path

import pytest
from conftest import as_user, bind, seed_tree
from fastapi.testclient import TestClient

from smplwise.main import create_app
from smplwise.rbac import ROLES
from smplwise.routers.access import PERMISSION_LABELS
from smplwise.services import presence as svc
from smplwise.services import presence_people as people_svc

API = "/api/v1"
ROOT = Path(__file__).resolve().parents[3]
RECT = [{"x": 0.1, "y": 0.1}, {"x": 0.4, "y": 0.1}, {"x": 0.4, "y": 0.4}, {"x": 0.1, "y": 0.4}]
UUID = "f7826da6-4fa2-4e98-8024-bc5b71e0893e"
SITE = {"id": "site_main", "name": "המשרד", "lat": 32.0, "lon": 34.8, "radius_m": 150}
ON = {"location_auth": "always", "precise": True, "sharing": True, "sensors": {"location": "on", "beacon": "on", "network": "on"}}


@pytest.fixture(autouse=True)
def _limits():
    svc.reset_limits()
    people_svc.reset()
    yield
    svc.reset_limits()
    people_svc.reset()


def ago(minutes: float = 0) -> str:
    return svc.iso(svc.now_utc() - dt.timedelta(minutes=minutes))


def bearer(token: str) -> dict[str, str]:
    return {"Authorization": f"Bearer {token}"}


@pytest.fixture()
def world(settings):
    app = create_app(settings)
    c = TestClient(app)
    ids = seed_tree(c)
    lobby = c.post(f"{API}/floors/{ids['floor2']}/zones", json={"name": "לובי", "polygon": RECT}).json()["id"]
    other = c.post(f"{API}/floors/{ids['floor3']}/zones", json={"name": "מטבח", "polygon": RECT}).json()["id"]
    bind(c, settings, "dana", "operator", "floor", ids["floor2"])
    bind(c, settings, "vera", "viewer", "installation", "*")
    bind(c, settings, "ruth", "viewer", "installation", "*")
    bind(c, settings, "fay", "system_admin", "floor", ids["floor2"])  # presence.view on floor 2 only
    return app, c, {**ids, "lobby": lobby, "kitchen": other}


def places(ids: dict, **more) -> dict:
    return {
        "sites": [SITE],
        "beacons": [{"id": "bcn_lobby", "name": "לובי", "uuid": UUID, "major": 1, "minor": 2, "site_id": "site_main", "floor_id": ids["floor2"], "zone_id": ids["lobby"]}],
        "wifi_sites": [{"id": "wifi_f3", "name": "קומה 3", "site_id": "site_main", "floor_id": ids["floor3"], "add_ssids": ["Office-5G"]}],
        **more,
    }


def enable(c: TestClient, ids: dict, **more) -> dict:
    r = c.put(f"{API}/presence/settings", json={"enabled": True, "notice_text": "הודעה לעובדים.", **places(ids), **more})
    assert r.status_code == 200, r.text
    return r.json()["settings"]


def phone(c: TestClient, user: str, install: str) -> tuple[str, dict]:
    r = c.post(f"{API}/presence/devices", json={"name": f"הנייד של {user}", "platform": "ios", "install_id": install}, headers=as_user(user))
    assert r.status_code in (200, 201), r.text
    return r.json()["device_id"], bearer(r.json()["device_token"])


def ack(c: TestClient, did: str, tok: dict) -> None:
    v = c.get(f"{API}/presence/config", headers=tok).json()["notice_version"]
    assert c.post(f"{API}/presence/devices/{did}/ack", json={"notice_version": v}, headers=tok).status_code == 200


def send(c: TestClient, did: str, tok: dict, events: list[dict], status: dict | None = ON) -> dict:
    r = c.post(f"{API}/presence/devices/{did}/events", json={"events": events, "status": status}, headers=tok)
    assert r.status_code == 200, r.text
    return r.json()


def beacon(cid: str, minutes: float = 1, **value) -> dict:
    return {"client_event_id": cid, "type": "sensor", "sensor": "beacon", "at": ago(minutes), "value": {"beacon_id": "bcn_lobby", "proximity": "near", **value}}


def network(cid: str, ssid_hash: str, minutes: float = 1) -> dict:
    return {"client_event_id": cid, "type": "sensor", "sensor": "network", "at": ago(minutes), "value": {"type": "wifi", "ssid_hash": ssid_hash}}


def people(c: TestClient, user: str | None = None) -> dict:
    r = c.get(f"{API}/presence/people", headers=as_user(user) if user else {})
    assert r.status_code == 200, r.text
    return r.json()


def populated(c: TestClient, ids: dict) -> dict[str, tuple[str, dict]]:
    """dana by a beacon in the lobby (floor 2), vera by the floor-3 Wi-Fi, ruth by the geofence only."""
    st = enable(c, ids)
    devs = {u: phone(c, u, f"{u:0<8}-0000-0000-0000-000000000000") for u in ("dana", "vera", "ruth")}
    for d, tok in devs.values():
        ack(c, d, tok)
    salt = st["wifi_sites"][0]["ssid_hash_salt"]
    send(c, *devs["dana"], [beacon("b1")])
    send(c, *devs["vera"], [network("n1", svc.ssid_hash(salt, "Office-5G"))])
    send(c, *devs["ruth"], [{"client_event_id": "g1", "type": "enter", "site_id": "site_main", "at": ago(2), "source": "region"}])
    return devs


# ---------------------------------------------------------------- the permission

def test_presence_view_is_system_admin_only_sensitive_and_labelled():
    assert "presence.view" in ROLES["system_admin"]
    assert all("presence.view" not in perms for role, perms in ROLES.items() if role != "system_admin")
    assert PERMISSION_LABELS["presence.view"]
    for path in (ROOT / "smplwise_vms" / "backend" / "smplwise" / "roles.json", ROOT / "contracts" / "examples" / "role-catalog.design.json"):
        cat = json.loads(path.read_text(encoding="utf-8"))
        assert "presence.view" in cat["sensitive_permissions_not_implied"], path
        assert [r["id"] for r in cat["roles"] if "presence.view" in r["permissions"]] == ["system_admin"], path


def test_people_needs_presence_view_and_is_empty_while_switched_off(world):
    app, c, ids = world
    r = c.get(f"{API}/presence/people", headers=as_user("dana"))
    assert r.status_code == 403
    with app.state.db.connection(mode="read") as conn:
        assert conn.execute("SELECT COUNT(*) FROM audit_log WHERE action = 'presence.view' AND decision = 'denied'").fetchone()[0] == 1
    out = people(c)
    assert out["enabled"] is False and out["people"] == [] and out["totals"]["inside"] == 0
    assert {f["floor_id"] for f in out["floors"]} == {ids["floor2"], ids["floor3"]}  # the floors are listed for the map even while off
    assert out["settings"] == {"show_names": True, "refresh_seconds": 30, "stale_minutes": 30, "beacon_max_age_minutes": 10, "wifi_max_age_minutes": 15, "min_proximity": "near"}


# ---------------------------------------------------------------- placement

def test_beacon_wifi_and_geofence_place_people_by_floor_and_area(world):
    app, c, ids = world
    populated(c, ids)
    out = people(c)
    assert out["enabled"] is True and out["totals"] == {"inside": 3, "named": 3, "hidden": 0, "on_floors": 2, "site_only": 1}
    by = {p["name"]: p for p in out["people"]}
    assert by["dana"]["source"] == "beacon" and by["dana"]["floor_id"] == ids["floor2"] and by["dana"]["zone_id"] == ids["lobby"] and by["dana"]["zone_name"] == "לובי"
    assert by["vera"]["source"] == "wifi" and by["vera"]["floor_id"] == ids["floor3"] and by["vera"]["zone_id"] is None
    assert by["ruth"]["source"] == "geofence" and by["ruth"]["floor_id"] is None and by["ruth"]["site_name"] == "המשרד"
    floors = {f["floor_id"]: f for f in out["floors"]}
    assert floors[ids["floor2"]]["count"] == 1 and floors[ids["floor2"]]["zones"] == [{"zone_id": ids["lobby"], "name": "לובי", "count": 1}]
    assert floors[ids["floor3"]]["count"] == 1 and floors[ids["floor3"]]["zones"] == []
    assert out["sites"] == [{"site_id": "site_main", "name": "המשרד", "count": 1}]
    assert out["configured"] == {"sites": 1, "beacons": 1, "wifi_sites": 1}
    # the read is audited once per viewer per window, with counts and no names
    people(c)
    with app.state.db.connection(mode="read") as conn:
        rows = conn.execute("SELECT details_json FROM audit_log WHERE action = 'presence.people.view'").fetchall()
    assert len(rows) == 1 and json.loads(rows[0][0])["inside"] == 3 and "dana" not in rows[0][0]


def test_a_newer_exit_a_sensor_switched_off_stale_reports_and_far_beacons_do_not_count(world):
    app, c, ids = world
    devs = populated(c, ids)
    did, tok = devs["dana"]
    # the phone switches the beacon sensor off: the lobby report no longer counts (no location state either)
    send(c, did, tok, [], {**ON, "sensors": {"location": "on", "network": "on"}})
    assert "dana" not in {p["name"] for p in people(c)["people"]}
    send(c, did, tok, [], ON)
    assert "dana" in {p["name"] for p in people(c)["people"]}
    # an exit newer than the beacon report: she left
    send(c, did, tok, [{"client_event_id": "x1", "type": "exit", "site_id": "site_main", "at": ago(0), "source": "region"}])
    assert "dana" not in {p["name"] for p in people(c)["people"]}
    # a newer beacon report again, but "far" while the setting asks for "near"
    send(c, did, tok, [beacon("b2", minutes=-0.1, proximity="far")])
    assert "dana" not in {p["name"] for p in people(c)["people"]}
    assert c.put(f"{API}/presence/settings", json={"people": {"min_proximity": "far"}}).status_code == 200
    assert "dana" in {p["name"] for p in people(c)["people"]}
    # ruth's geofence state ages past stale_minutes (30): gone; a longer window brings her back
    with app.state.db.connection() as conn:
        rid = devs["ruth"][0]
        p = json.loads(conn.execute("SELECT presence_json FROM mobile_devices WHERE id = ?", (rid,)).fetchone()[0])
        conn.execute("UPDATE mobile_devices SET presence_json = ? WHERE id = ?", (json.dumps({**p, "at": ago(45)}), rid))
    assert "ruth" not in {p["name"] for p in people(c)["people"]}
    assert c.put(f"{API}/presence/settings", json={"people": {"stale_minutes": 60}}).status_code == 200
    assert "ruth" in {p["name"] for p in people(c)["people"]}
    # a beacon report older than beacon_max_age_minutes does not place
    beacon_only = {**ON, "sensors": {"location": "off", "beacon": "on", "network": "off"}}
    send(c, *devs["vera"], [beacon("vb", minutes=20)], beacon_only)
    assert "vera" not in {p["name"] for p in people(c)["people"]}
    assert c.put(f"{API}/presence/settings", json={"people": {"beacon_max_age_minutes": 30}}).status_code == 200
    out = people(c)
    assert {p["name"]: p["zone_name"] for p in out["people"]}.get("vera") == "לובי"
    # each threshold save is partial: the others keep their stored values
    assert out["settings"]["stale_minutes"] == 60 and out["settings"]["min_proximity"] == "far" and out["settings"]["beacon_max_age_minutes"] == 30


def test_the_switch_and_a_new_notice_withdraw_everyone(world):
    app, c, ids = world
    devs = populated(c, ids)
    assert c.put(f"{API}/presence/settings", json={"notice_text": "נוסח חדש."}).status_code == 200
    assert people(c)["totals"]["inside"] == 0  # nobody acknowledged the new version yet
    ack(c, *devs["dana"])
    assert [p["name"] for p in people(c)["people"]] == ["dana"]
    assert c.put(f"{API}/presence/settings", json={"enabled": False}).status_code == 200
    out = people(c)
    assert out["enabled"] is False and out["people"] == [] and out["totals"]["inside"] == 0


# ---------------------------------------------------------------- privacy

def test_opt_out_is_self_service_counted_never_named_or_placed(world):
    app, c, ids = world
    populated(c, ids)
    assert c.get(f"{API}/presence/people/me", headers=as_user("vera")).json() == {"opted_out": False, "enabled": True}
    r = c.put(f"{API}/presence/people/me", json={"opted_out": True}, headers=as_user("vera"))
    assert r.status_code == 200 and r.json() == {"opted_out": True}
    out = people(c)
    assert "vera" not in json.dumps(out, ensure_ascii=False) and out["totals"] == {"inside": 3, "named": 2, "hidden": 1, "on_floors": 1, "site_only": 1}
    assert {f["floor_id"]: f["count"] for f in out["floors"]}[ids["floor3"]] == 0
    st = c.get(f"{API}/presence/settings").json()["settings"]
    assert st["people_opt_out_count"] == 1 and "vera" not in json.dumps(st)  # the administrator sees how many, not who
    assert c.put(f"{API}/presence/people/me", json={"opted_out": False}, headers=as_user("vera")).json() == {"opted_out": False}
    assert "vera" in {p["name"] for p in people(c)["people"]}
    with app.state.db.connection(mode="read") as conn:
        assert conn.execute("SELECT COUNT(*) FROM audit_log WHERE action = 'presence.people.opt_out' AND resource_id = 'dev-vera'").fetchone()[0] == 2
    # someone without presence.report (no binding at all) cannot write the list
    c.get(f"{API}/me", headers=as_user("nobody"))
    assert c.put(f"{API}/presence/people/me", json={"opted_out": True}, headers=as_user("nobody")).status_code == 403
    assert c.put(f"{API}/presence/people/me", json={"opted_out": True, "user_id": "dev-dana"}, headers=as_user("vera")).status_code == 422


def test_counts_only_mode_and_a_floor_scoped_viewer(world):
    app, c, ids = world
    populated(c, ids)
    fay = people(c, "fay")  # presence.view on floor 2 only
    assert [p["name"] for p in fay["people"]] == ["dana"] and [f["floor_id"] for f in fay["floors"]] == [ids["floor2"]]
    assert fay["totals"]["inside"] == 1 and fay["sites"] == []  # the site-only person needs installation scope
    assert c.put(f"{API}/presence/settings", json={"people": {"show_names": False}}).status_code == 200
    out = people(c)
    assert out["people"] == [] and out["totals"]["inside"] == 3 and out["totals"]["named"] == 0 and out["settings"]["show_names"] is False
    assert "dana" not in json.dumps(out, ensure_ascii=False)


# ---------------------------------------------------------------- the editors' server side

def test_places_validate_place_on_floors_and_areas_and_never_store_an_ssid(world):
    app, c, ids = world
    st = enable(c, ids)
    w = st["wifi_sites"][0]
    assert w["id"] == "wifi_f3" and len(w["ssid_hashes"]) == 1 and w["ssid_hashes"][0] == svc.ssid_hash(w["ssid_hash_salt"], "Office-5G") and "add_ssids" not in w
    b = st["beacons"][0]
    assert b == {"id": "bcn_lobby", "name": "לובי", "uuid": UUID, "major": 1, "minor": 2, "site_id": "site_main", "floor_id": ids["floor2"], "zone_id": ids["lobby"]}
    with app.state.db.connection(mode="read") as conn:
        blob = " ".join(str(r[0]) for r in conn.execute("SELECT value FROM settings").fetchall()) + " ".join(str(r[0]) for r in conn.execute("SELECT details_json FROM audit_log").fetchall())
    assert "Office-5G" not in blob
    # adding a second network keeps the salt and the first hash; the app's config carries the placement keys and the hashes
    st2 = c.put(f"{API}/presence/settings", json={"wifi_sites": [{**w, "add_ssids": ["Guest"]}]}).json()["settings"]
    assert st2["wifi_sites"][0]["ssid_hash_salt"] == w["ssid_hash_salt"] and st2["wifi_sites"][0]["ssid_hashes"] == [w["ssid_hashes"][0], svc.ssid_hash(w["ssid_hash_salt"], "Guest")]
    did, tok = phone(c, "dana", "dddddddd-0000-0000-0000-000000000000")
    cfg = c.get(f"{API}/presence/config", headers=tok).json()
    assert cfg["beacons"][0]["id"] == "bcn_lobby" and cfg["beacons"][0]["uuid"] == UUID and cfg["wifi_sites"][0]["ssid_hashes"] == st2["wifi_sites"][0]["ssid_hashes"]
    # a new geofence without an id gets one; a beacon without an id gets a stable one
    st3 = c.put(f"{API}/presence/settings", json={"sites": [SITE, {"name": "מחסן", "lat": 32.1, "lon": 34.9, "radius_m": 80}],
                                                  "beacons": [{"uuid": UUID.upper(), "site_id": "site_main"}]}).json()["settings"]
    assert st3["sites"][1]["id"].startswith("site_") and st3["beacons"][0]["id"].startswith("bcn_") and st3["beacons"][0]["uuid"] == UUID
    bad_cases = (
        {"beacons": [{"uuid": "not-a-uuid", "site_id": "site_main"}]},
        {"beacons": [{"uuid": UUID, "site_id": "nowhere"}]},
        {"beacons": [{"uuid": UUID, "site_id": "site_main", "floor_id": ids["floor3"], "zone_id": ids["lobby"]}]},  # the lobby is on floor 2
        {"beacons": [{"uuid": UUID, "site_id": "site_main", "zone_id": ids["lobby"]}]},  # an area without a floor
        {"beacons": [{"uuid": UUID, "site_id": "site_main", "floor_id": "f-missing"}]},
        {"beacons": [{"uuid": UUID, "site_id": "site_main", "major": 70000}]},
        {"beacons": [{"id": "a", "uuid": UUID, "site_id": "site_main"}, {"id": "b", "uuid": UUID, "site_id": "site_main"}]},  # the same beacon twice
        {"wifi_sites": [{"site_id": "site_main"}]},  # no network
        {"wifi_sites": [{"site_id": "site_main", "add_ssids": ["x" * 33]}]},
        {"wifi_sites": [{"site_id": "site_main", "ssid_hashes": ["zz"]}]},
        {"sites": []},  # the beacon still names site_main
        {"people": {"stale_minutes": 2}}, {"people": {"min_proximity": "close"}}, {"people": {"show_names": "yes"}}, {"people": {"colour": 1}},
    )
    for bad in bad_cases:
        r = c.put(f"{API}/presence/settings", json=bad)
        assert r.status_code == 422, (bad, r.text)
    # one save is validated as a whole: a bad beacon keeps the geofences of the same save from being written
    before = c.get(f"{API}/presence/settings").json()["settings"]
    r = c.put(f"{API}/presence/settings", json={"sites": [SITE, {"id": "site_new", "name": "חדש", "lat": 31.0, "lon": 34.0}], "beacons": [{"uuid": "bad", "site_id": "site_new"}]})
    assert r.status_code == 422
    assert c.get(f"{API}/presence/settings").json()["settings"]["sites"] == before["sites"]
    # removing a geofence together with what names it is fine
    assert c.put(f"{API}/presence/settings", json={"sites": [], "beacons": [], "wifi_sites": []}).status_code == 200


def test_match_helpers():
    beacons = [{"id": "a", "uuid": UUID, "major": 1, "minor": None}, {"id": "b", "uuid": UUID, "major": 2, "minor": 5}]
    assert people_svc.match_beacon({"beacon_id": "b"}, beacons)["id"] == "b"
    assert people_svc.match_beacon({"uuid": UUID.upper(), "major": 1, "minor": 9}, beacons)["id"] == "a"
    assert people_svc.match_beacon({"uuid": UUID, "major": 2, "minor": 4}, beacons) is None
    assert people_svc.match_beacon({"site_id": "site_main"}, beacons) is None
    wifi = [{"id": "w", "ssid_hashes": [svc.ssid_hash("salt0000", "Net")]}]
    assert people_svc.match_wifi({"ssid_hash": svc.ssid_hash("salt0000", "Net").upper()}, wifi)["id"] == "w"
    assert people_svc.match_wifi({"ssid_hash": "00"}, wifi) is None
