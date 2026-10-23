"""CR-TIMESCRUB101 slice 1: the building at an instant (snapshot) and over a period (range) on the historical map.

Pinned here (CR sections 4, 6, 7, 8, 10.1, 10.2): the flag off answers 404 feature_off and leaves the floor bundle as it was; each
layer is classified and authorised on its own - a locked layer carries no data, not even entity ids; presence needs the separate
history.presence (not implied by devices.read) and is audited once per (user, floor, day); a recorded gap makes every HA state
unknown inside it AND after it until the next change (never carried across); the range is exact below MAX_POINTS, bucketed above
it (last state per bucket, the change count, the bucket's start), 413 above the scan cap, 422 beyond history.range_max_days; the
presence retention only shortens the history and runs only with the flag on; the connect note writes the gap row."""
from __future__ import annotations

import datetime as dt
import json

from conftest import as_user, bind, png_bytes, seed_tree
from fastapi.testclient import TestClient

from smplwise.db import bump_permission_revision, now_iso
from smplwise.main import create_app
from smplwise.services import ha_history, ha_sync, timescrub

NOW = dt.datetime.now(dt.timezone.utc).replace(microsecond=0)


def iso(d: dt.datetime) -> str:
    return d.strftime("%Y-%m-%dT%H:%M:%SZ")


def _st(entity_id: str, state: str, when: dt.datetime, **attrs):
    return {"entity_id": entity_id, "state": state, "last_changed": iso(when), "last_updated": iso(when), "attributes": attrs}


ENTITIES = (  # entity, device_class, anchor layer, expected time-scrub layer
    ("light.lobby", None, "lights", "lights"),
    ("switch.corridor", None, "lights", "lights"),
    ("switch.pump", None, "devices", "devices"),
    ("binary_sensor.lobby_motion", "motion", "sensors", "presence"),
    ("binary_sensor.office_door", "door", "doors", "openings"),
    ("lock.front", None, "doors", "openings"),
    ("sensor.office_temp", "temperature", "sensors", "temperature"),
    ("alarm_control_panel.home", None, "alarm", "alarm"),
)


def _floor(c: TestClient, app) -> str:
    ids = seed_tree(c)
    floor = ids["floor2"]
    asset = c.post(f"/api/v1/floors/{floor}/plan-assets", files={"file": ("plan.png", png_bytes(), "image/png")}).json()
    v = c.post(f"/api/v1/floors/{floor}/plan-versions", json={"asset_id": asset["id"]}).json()
    c.post(f"/api/v1/plan-versions/{v['id']}/publish")
    with app.state.db.connection() as conn:
        for eid, dc, _layer, _ in ENTITIES:
            attrs = {"friendly_name": eid, **({"device_class": dc} if dc else {})}
            ha_sync.upsert_state(conn, _st(eid, "off" if not eid.startswith(("lock.", "sensor.", "alarm_")) else {"lock": "locked", "sens": "21.5", "alar": "armed_home"}[eid[:4]], NOW - dt.timedelta(hours=3), **attrs))
        conn.execute("UPDATE ha_state_history SET recorded_at = ?", (iso(NOW - dt.timedelta(hours=4)),))
        # the day of the test: the lobby light on 2 h ago, off 1 h ago; motion on 90 min ago, off 80 min ago; the door open 30 min ago
        for eid, state, ago in (("light.lobby", "on", 120), ("light.lobby", "off", 60), ("binary_sensor.lobby_motion", "on", 90),
                                ("binary_sensor.lobby_motion", "off", 80), ("binary_sensor.office_door", "on", 30)):
            ha_sync.upsert_state(conn, _st(eid, state, NOW - dt.timedelta(minutes=ago)))
    for i, (eid, _dc, layer, _) in enumerate(ENTITIES):
        r = c.post(f"/api/v1/floors/{floor}/anchors", json={"resource_type": "ha_entity", "resource_id": eid, "x": 0.1 + i * 0.05, "y": 0.5, "layer_id": layer})
        assert r.status_code == 201, r.text
    return floor


def _on(c: TestClient) -> None:
    assert c.patch("/api/v1/settings", json={"history.timescrub": "true"}).status_code == 200


def test_flag_off_404_and_settings(settings):
    app = create_app(settings)
    c = TestClient(app)
    floor = _floor(c, app)
    s = c.get("/api/v1/settings").json()["settings"]
    assert s["history.timescrub"] == "false" and s["history.range_max_days"] == 7 and s["history.presence_retention_days"] == 7
    for url in (f"/api/v1/floors/{floor}/history/snapshot?at={iso(NOW)}", f"/api/v1/floors/{floor}/history/range?from={iso(NOW - dt.timedelta(hours=1))}&to={iso(NOW)}"):
        r = c.get(url)
        assert r.status_code == 404 and r.json()["code"] == "feature_off"
    # flag off: the bundle at an instant is today's - the presence sensor's past is there for a map reader
    m = c.get(f"/api/v1/floors/{floor}/map?at={iso(NOW - dt.timedelta(minutes=85))}").json()
    ent = {a["resource_id"]: a["entity"]["state_at"] for a in m["anchors"] if a["resource_type"] == "ha_entity"}
    assert ent["binary_sensor.lobby_motion"]["known"] is True and ent["binary_sensor.lobby_motion"]["state"] == "on"
    # validation of the new settings
    assert c.patch("/api/v1/settings", json={"history.range_max_days": 31}).status_code == 422
    assert c.patch("/api/v1/settings", json={"history.presence_retention_days": 0}).status_code == 422
    assert c.patch("/api/v1/settings", json={"history.range_max_days": 30, "history.presence_retention_days": 3}).status_code == 200
    s = c.get("/api/v1/settings").json()["settings"]
    assert s["history.range_max_days"] == 30 and s["history.presence_retention_days"] == 3


def test_classification_mirrors_the_live_map():
    for eid, dc, layer, want in ENTITIES:
        assert timescrub.layer_of(eid.split(".")[0], dc, eid, layer) == want, eid
    assert timescrub.layer_of("binary_sensor", None, "binary_sensor.hall_pir", None) == "presence", "no class: the id's word decides"
    assert timescrub.layer_of("binary_sensor", None, "binary_sensor.garage_gate", None) == "openings"
    assert timescrub.layer_of("cover", "garage_door", "cover.garage", None) == "openings"
    assert timescrub.layer_of("cover", "shade", "cover.blind", None) == "devices"
    assert timescrub.layer_of("switch", None, "switch.x", None) == "devices", "a switch counts as a light only on the lights layer"


def test_snapshot_admin_all_layers(settings):
    app = create_app(settings)
    c = TestClient(app)
    floor = _floor(c, app)
    _on(c)
    r = c.get(f"/api/v1/floors/{floor}/history/snapshot?at={iso(NOW - dt.timedelta(minutes=85))}")
    assert r.status_code == 200, r.text
    body = r.json()
    L = body["layers"]
    assert set(L) == {"lights", "presence", "openings", "temperature", "devices", "alarm", "elevators", "cameras", "events"}
    assert L["lights"]["status"] == "ok" and L["lights"]["retention_days"] == 30
    assert L["lights"]["entities"]["light.lobby"] == {"state": "on", "changed_at": iso(NOW - dt.timedelta(minutes=120)), "known": True, "reason": None}
    assert set(L["lights"]["entities"]) == {"light.lobby", "switch.corridor"}
    assert L["presence"]["status"] == "ok" and L["presence"]["retention_days"] == 7
    assert L["presence"]["entities"]["binary_sensor.lobby_motion"]["state"] == "on"
    assert L["openings"]["entities"]["binary_sensor.office_door"]["state"] == "off" and set(L["openings"]["entities"]) == {"binary_sensor.office_door", "lock.front"}
    assert L["temperature"]["entities"]["sensor.office_temp"]["state"] == "21.5"
    assert set(L["devices"]["entities"]) == {"switch.pump"} and set(L["alarm"]["entities"]) == {"alarm_control_panel.home"}
    assert L["elevators"]["status"] == "empty" and L["elevators"]["position"] == "not_recorded"
    assert L["cameras"]["status"] == "empty" and L["events"]["status"] == "ok"
    assert body["settings"] == {"range_max_days": 7, "presence_retention_days": 7}
    assert body["coverage"]["gaps"] == [] and body["coverage"]["forward_fill_max_s"] == 24 * 3600
    # before the local history began: not recorded, every entity unknown
    early = c.get(f"/api/v1/floors/{floor}/history/snapshot?at={iso(NOW - dt.timedelta(hours=6))}").json()["layers"]
    assert early["lights"]["status"] == "not_recorded" and early["lights"]["entities"]["light.lobby"]["known"] is False
    # presence served to the admin: one audit row per (user, floor, day), not one per cursor move
    c.get(f"/api/v1/floors/{floor}/history/snapshot?at={iso(NOW - dt.timedelta(minutes=70))}")
    with app.state.db.connection() as conn:
        assert conn.execute("SELECT COUNT(*) FROM audit_log WHERE action = 'history.presence.view' AND resource_id = ?", (floor,)).fetchone()[0] == 1
    assert c.get(f"/api/v1/floors/{floor}/history/snapshot?at=yesterday").status_code == 422


def test_snapshot_viewer_presence_locked_without_ids(settings):
    app = create_app(settings)
    c = TestClient(app)
    floor = _floor(c, app)
    _on(c)
    bind(c, settings, "vera", "viewer", "floor", floor)  # map.read, devices.read, alarm.view - NOT history.presence, NOT video.playback
    r = c.get(f"/api/v1/floors/{floor}/history/snapshot?at={iso(NOW - dt.timedelta(minutes=85))}", headers=as_user("vera"))
    assert r.status_code == 200, r.text
    L = r.json()["layers"]
    assert L["presence"] == {"status": "not_permitted", "retention_days": None, "from": None, "entities": {}}
    assert "lobby_motion" not in r.text, "a locked layer names nothing - not even the entity id"
    assert L["lights"]["status"] == "ok" and L["alarm"]["status"] == "ok"
    assert L["cameras"]["status"] == "not_permitted" and L["events"]["status"] == "not_permitted"
    # the bundle at an instant no longer hands out the presence past either (flag on)
    m = c.get(f"/api/v1/floors/{floor}/map?at={iso(NOW - dt.timedelta(minutes=85))}", headers=as_user("vera")).json()
    ent = {a["resource_id"]: a["entity"]["state_at"] for a in m["anchors"] if a["resource_type"] == "ha_entity"}
    assert ent["binary_sensor.lobby_motion"]["known"] is False and ent["binary_sensor.lobby_motion"]["state"] is None
    assert ent["light.lobby"]["known"] is True
    with app.state.db.connection() as conn:
        assert conn.execute("SELECT COUNT(*) FROM audit_log WHERE action = 'history.presence.view'").fetchone()[0] == 0
    # history.presence alone reveals no other layer (a custom role: map.read + history.presence)
    with app.state.db.connection() as conn:
        conn.execute("INSERT INTO custom_roles(id, name_he, permissions_json, sensitive_json, created_at, updated_at) VALUES ('pres_only', 'pres', ?, ?, ?, ?)",
                     (json.dumps(["map.read"]), json.dumps(["history.presence"]), now_iso(), now_iso()))
        bump_permission_revision(conn)
    bind(c, settings, "pia", "pres_only", "floor", floor)
    L2 = c.get(f"/api/v1/floors/{floor}/history/snapshot?at={iso(NOW - dt.timedelta(minutes=85))}", headers=as_user("pia")).json()["layers"]
    assert L2["presence"]["status"] == "ok" and L2["presence"]["entities"]["binary_sensor.lobby_motion"]["state"] == "on"
    assert all(L2[k]["status"] == "not_permitted" and L2[k]["entities"] == {} for k in ("lights", "openings", "temperature", "devices", "alarm"))
    # no floor reach at all: the audited 403
    assert c.get(f"/api/v1/floors/{floor}/history/snapshot?at={iso(NOW)}", headers=as_user("nobody")).status_code == 403


def test_gap_makes_states_unknown_inside_and_after(settings):
    app = create_app(settings)
    c = TestClient(app)
    floor = _floor(c, app)
    _on(c)
    # Arx was not listening 50..40 minutes ago (the door opened 30 min ago, AFTER the gap - it is known again)
    assert ha_history.note_connect_gap(app.state.db, iso(NOW - dt.timedelta(minutes=50)), iso(NOW - dt.timedelta(minutes=40))) is True
    assert ha_history.note_connect_gap(app.state.db, iso(NOW - dt.timedelta(seconds=30)), iso(NOW)) is False, "under 60 s is no gap"
    assert ha_history.note_connect_gap(app.state.db, None) is False
    inside = c.get(f"/api/v1/floors/{floor}/history/snapshot?at={iso(NOW - dt.timedelta(minutes=45))}").json()
    assert inside["coverage"]["gaps"] == [{"from": iso(NOW - dt.timedelta(minutes=50)), "to": iso(NOW - dt.timedelta(minutes=40)), "reason": "disconnected"}]
    assert inside["layers"]["lights"]["status"] == "gap"
    assert inside["layers"]["lights"]["entities"]["light.lobby"]["known"] is False and "פער" in inside["layers"]["lights"]["entities"]["light.lobby"]["reason"]
    after = c.get(f"/api/v1/floors/{floor}/history/snapshot?at={iso(NOW - dt.timedelta(minutes=35))}").json()["layers"]
    assert after["lights"]["status"] == "ok"
    assert after["lights"]["entities"]["light.lobby"]["known"] is False, "off since 60 min ago: the gap lies between - never carried across"
    late = c.get(f"/api/v1/floors/{floor}/history/snapshot?at={iso(NOW - dt.timedelta(minutes=20))}").json()["layers"]
    assert late["openings"]["entities"]["binary_sensor.office_door"] == {"state": "on", "changed_at": iso(NOW - dt.timedelta(minutes=30)), "known": True, "reason": None}
    # a range that starts after the gap: the gap is not in its window, yet its initial state does not cross it
    rng = c.get(f"/api/v1/floors/{floor}/history/range?from={iso(NOW - dt.timedelta(minutes=35))}&to={iso(NOW)}&layers=lights,openings").json()
    assert rng["coverage"]["gaps"] == [] and rng["layers"]["lights"]["entities"]["light.lobby"]["initial"] == {"state": None, "known": False}
    assert set(rng["layers"]) == {"lights", "openings"} and rng["layers"]["lights"]["status"] == "ok"
    # a range over the gap carries it (status gap); an initial state before the gap is still known
    over = c.get(f"/api/v1/floors/{floor}/history/range?from={iso(NOW - dt.timedelta(minutes=55))}&to={iso(NOW)}&layers=lights").json()
    assert over["layers"]["lights"]["status"] == "gap" and len(over["coverage"]["gaps"]) == 1
    assert over["layers"]["lights"]["entities"]["light.lobby"]["initial"] == {"state": "off", "known": True}


def test_connect_gap_written_by_the_sync_hook(settings):
    app = create_app(settings)
    with app.state.db.connection() as conn:
        ha_sync.upsert_state(conn, _st("light.x", "on", NOW - dt.timedelta(hours=1)))
        conn.execute("UPDATE ha_entities SET state_seen_at = ?", (iso(NOW - dt.timedelta(minutes=10)),))
    ha_sync._note_connect_gap(app.state.db)
    with app.state.db.connection() as conn:
        rows = conn.execute("SELECT from_utc, reason FROM ha_state_history_gaps").fetchall()
    assert [(r["from_utc"], r["reason"]) for r in rows] == [(iso(NOW - dt.timedelta(minutes=10)), "disconnected")]


def test_range_exact_bucketed_and_limits(settings, monkeypatch):
    app = create_app(settings)
    c = TestClient(app)
    floor = _floor(c, app)
    _on(c)
    lo, hi = iso(NOW - dt.timedelta(hours=2, minutes=30)), iso(NOW)
    r = c.get(f"/api/v1/floors/{floor}/history/range?from={lo}&to={hi}")
    assert r.status_code == 200, r.text
    body = r.json()
    assert body["bucket_s"] is None and set(body["layers"]) == set(timescrub.RANGE_LAYERS)
    lobby = body["layers"]["lights"]["entities"]["light.lobby"]
    assert lobby["initial"] == {"state": "off", "known": True}
    assert lobby["points"] == [[iso(NOW - dt.timedelta(minutes=120)), "on", 1], [iso(NOW - dt.timedelta(minutes=60)), "off", 1]]
    assert lobby["bounded_after"] is False
    assert body["layers"]["presence"]["entities"]["binary_sensor.lobby_motion"]["points"][0][1] == "on"
    early = c.get(f"/api/v1/floors/{floor}/history/range?from={iso(NOW - dt.timedelta(hours=3, minutes=30))}&to={iso(NOW - dt.timedelta(minutes=100))}&layers=lights").json()
    assert early["layers"]["lights"]["entities"]["light.lobby"]["bounded_after"] is True, "a change after `to` bounds the last state"
    # bucketed above MAX_POINTS: the last state of each bucket, its change count, the bucket's start
    monkeypatch.setattr(timescrub, "MAX_POINTS", 2)
    b = c.get(f"/api/v1/floors/{floor}/history/range?from={lo}&to={hi}&layers=lights,presence&step=3600").json()
    assert b["bucket_s"] == 3600 and b["native_rows"] == 4
    mot = b["layers"]["presence"]["entities"]["binary_sensor.lobby_motion"]["points"]
    assert len(mot) == 1 and mot[0][1] == "off" and mot[0][2] == 2, "on + off inside one bucket: the last state and 2 changes"
    assert mot[0][0] == iso(NOW - dt.timedelta(hours=2, minutes=30) + dt.timedelta(seconds=3600)), "t = the bucket's start"
    # the scan cap: 413 with the limit named
    monkeypatch.setattr(timescrub, "ROW_SCAN_CAP", 3)
    big = c.get(f"/api/v1/floors/{floor}/history/range?from={lo}&to={hi}")
    assert big.status_code == 413 and big.json()["code"] == "range_too_large" and big.json()["details"]["limit"] == "range_too_large"
    monkeypatch.undo()
    # longer than history.range_max_days (7 by default): 422 range_too_long; bad windows and layers: 422
    long = c.get(f"/api/v1/floors/{floor}/history/range?from={iso(NOW - dt.timedelta(days=8))}&to={hi}")
    assert long.status_code == 422 and long.json()["code"] == "range_too_long" and long.json()["details"]["max_days"] == 7
    assert c.get(f"/api/v1/floors/{floor}/history/range?from={hi}&to={lo}").status_code == 422
    assert c.get(f"/api/v1/floors/{floor}/history/range?from={lo}&to={hi}&layers=gps").status_code == 422
    # a viewer: presence locked in the range too, no ids
    bind(c, settings, "vera", "viewer", "floor", floor)
    v = c.get(f"/api/v1/floors/{floor}/history/range?from={lo}&to={hi}", headers=as_user("vera"))
    assert v.status_code == 200 and v.json()["layers"]["presence"]["status"] == "not_permitted" and "lobby_motion" not in v.text


def test_elevator_layer_state_only(settings):
    app = create_app(settings)
    c = TestClient(app)
    floor = _floor(c, app)
    _on(c)
    with app.state.db.connection() as conn:
        conn.execute("INSERT INTO infra_elevators(id, name, name_key, created_at, updated_at) VALUES ('el1', 'מעלית צפונית', 'מעלית צפונית', ?, ?)", (now_iso(), now_iso()))
        for ago, state in ((100, "ok"), (50, "unknown"), (40, "fault")):
            conn.execute("INSERT INTO infra_elevator_states(elevator_id, at, state) VALUES ('el1', ?, ?)", (iso(NOW - dt.timedelta(minutes=ago)), state))
    snap = lambda m: c.get(f"/api/v1/floors/{floor}/history/snapshot?at={iso(NOW - dt.timedelta(minutes=m))}").json()["layers"]["elevators"]  # noqa: E731
    assert snap(70)["items"]["el1"] == {"name": "מעלית צפונית", "state": "ok", "at": iso(NOW - dt.timedelta(minutes=100)), "known": True}
    assert snap(45)["items"]["el1"]["known"] is False, "the monitor's unknown row is not a state"
    assert snap(200)["status"] == "not_recorded" and snap(30)["position"] == "not_recorded"
    rng = c.get(f"/api/v1/floors/{floor}/history/range?from={iso(NOW - dt.timedelta(minutes=70))}&to={iso(NOW)}&layers=elevators").json()["layers"]["elevators"]["items"]["el1"]
    assert rng["initial"] == {"state": "ok", "known": True} and [p[1] for p in rng["points"]] == [None, "fault"]
    bind(c, settings, "kai", "kiosk", "floor", floor)  # map.read only: no devices.read
    k = c.get(f"/api/v1/floors/{floor}/history/snapshot?at={iso(NOW)}", headers=as_user("kai")).json()["layers"]
    assert k["elevators"]["status"] == "not_permitted" and k["elevators"]["items"] == {} and k["lights"]["status"] == "not_permitted"


def test_presence_retention_only_shortens_and_only_with_the_flag(settings):
    app = create_app(settings)
    c = TestClient(app)
    _floor(c, app)
    old = iso(NOW - dt.timedelta(days=10))
    with app.state.db.connection() as conn:
        for eid in ("binary_sensor.lobby_motion", "light.lobby"):
            conn.execute("INSERT INTO ha_state_history(entity_id, state, changed_at, recorded_at) VALUES (?, 'on', ?, ?)", (eid, old, old))
        ha_history.prune(conn)  # flag off: the presence past keeps the general 30 days
        assert conn.execute("SELECT COUNT(*) FROM ha_state_history WHERE changed_at = ?", (old,)).fetchone()[0] == 2
    _on(c)
    with app.state.db.connection() as conn:
        assert ha_history.prune(conn) == 1, "flag on: the 10-day-old presence row goes (7 days), the light stays"
        left = [r[0] for r in conn.execute("SELECT entity_id FROM ha_state_history WHERE changed_at = ?", (old,)).fetchall()]
        assert left == ["light.lobby"]
        assert ha_history.prune_presence(conn, 400) == 0, "a longer presence retention never lengthens the 30-day history"
