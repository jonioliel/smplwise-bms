"""XSCENARIO109-295 (docs/changes/CR-SCENARIO109.md, section 17): cross-module scenarios on one condition model.

Fake module state only (rows in the HA state mirror, a temperature unit, flags) and an injected clock: no device, bridge, recorder or door
is contacted. Covers the OFF switch, permissions (managers from day one, presence only with occupancy.view), the closed action set and the
door wall, validation, the dry run / simulation gate before enabling, the engine (hold, hysteresis, cooldown, clear, unknown -> degraded,
treat_as_false), the author-rights recheck and reassign, the kill switch, per-action switches, caps with per-rule override, the generic
notice for recipients without the module rights, flag chains and cycles, settings validation and audit."""
from __future__ import annotations

import datetime as dt
import json
import sys
from pathlib import Path

import pytest

from smplwise.db import Database, bump_permission_revision, now_iso, set_setting
from smplwise.services import ha_sync
from smplwise.services import scenario_model as m
from smplwise.services import scenarios as svc

sys.path.insert(0, str(Path(__file__).resolve().parent))
from conftest import as_user, bind  # noqa: E402

API = "/api/v1/scenarios"
UTC = dt.timezone.utc
ADMIN = "dev-joni"


class World:
    def __init__(self, client, settings, monkeypatch) -> None:
        self.c, self.settings = client, settings
        client.get("/api/v1/me")  # schema + bootstrap administrator (joni)
        self.db = Database(settings.db_path)
        monkeypatch.setattr(ha_sync.STATE, "connected", True, raising=False)
        at = now_iso()
        with self.db.connection() as conn:
            for eid, dom, dc, unit, state in (("sensor.cold_temp", "sensor", "temperature", "°C", "4.0"),
                                              ("binary_sensor.cold_door", "binary_sensor", "door", None, "off"),
                                              ("binary_sensor.lobby_door", "binary_sensor", "door", None, "off")):
                conn.execute("""INSERT INTO ha_entities (entity_id, name, domain, device_class, unit, state, available, last_changed, last_updated, state_seen_at,
                                first_seen_at, updated_at) VALUES (?,?,?,?,?,?,1,?,?,?,?,?)""", (eid, eid.split(".")[1], dom, dc, unit, state, at, at, at, at, at))
            conn.execute("""INSERT INTO infra_temp_units (id, name, name_key, temp_entity_id, door_entity_id, low, high, created_at, updated_at)
                            VALUES ('u1', 'חדר קירור', 'חדר קירור', 'sensor.cold_temp', 'binary_sensor.cold_door', 2, 6, ?, ?)""", (at, at))
        self.clock = dt.datetime(2026, 10, 23, 19, 0, tzinfo=UTC)  # 22:00 site time, Friday (after hours by default)

    def set(self, **kv: str) -> None:
        with self.db.connection() as conn:
            for k, v in kv.items():
                set_setting(conn, k.replace("__", "."), v)

    def on(self, *actions: str) -> None:
        self.set(**{"scenarios__enabled": "true"})
        for a in actions:
            self.set(**{f"scenarios__actions__{a}": "true"})

    def entity(self, eid: str, state: str, seen: dt.datetime | None = None, changed: dt.datetime | None = None) -> None:
        at = m.iso(seen or self.clock)
        with self.db.connection() as conn:
            conn.execute("UPDATE ha_entities SET state = ?, state_seen_at = ?, last_updated = ?, last_changed = COALESCE(?, last_changed) WHERE entity_id = ?",
                         (state, at, at, m.iso(changed) if changed else None, eid))

    def step(self, rid: str, seconds: float = 0) -> str | None:
        self.clock += dt.timedelta(seconds=seconds)
        with self.db.connection() as conn:
            return svc.step(conn, rid, self.clock)

    def row(self, rid: str) -> dict:
        with self.db.connection(mode="read") as conn:
            return dict(conn.execute("SELECT * FROM scenario_rules WHERE id = ?", (rid,)).fetchone())

    def runs(self, rid: str) -> list[dict]:
        with self.db.connection(mode="read") as conn:
            return [dict(r) for r in conn.execute("SELECT * FROM scenario_runs WHERE rule_id = ? ORDER BY at, rowid", (rid,)).fetchall()]

    def flag(self, name: str) -> str | None:
        with self.db.connection(mode="read") as conn:
            r = conn.execute("SELECT value FROM scenario_flags WHERE name = ?", (name,)).fetchone()
            return r["value"] if r else None

    def notices(self, source: str) -> list[dict]:
        with self.db.connection(mode="read") as conn:
            return [dict(r) for r in conn.execute("SELECT * FROM notifications WHERE source = ? ORDER BY created_at", (source,)).fetchall()]

    def audit(self, action: str) -> list[dict]:
        with self.db.connection(mode="read") as conn:
            return [dict(r) for r in conn.execute("SELECT * FROM audit_log WHERE action = ?", (action,)).fetchall()]

    def create(self, definition: dict, headers: dict | None = None, name: str = "קירור אחרי שעות") -> dict:
        r = self.c.post(API, json={"name": name, "definition": definition}, headers=headers or {})
        assert r.status_code == 201, r.text
        return r.json()

    def enable(self, rule: dict, confirm: bool = False) -> dict:
        t = self.c.post(f"{API}/{rule['id']}/test", json={})
        assert t.status_code == 200, t.text
        r = self.c.post(f"{API}/{rule['id']}/enable", json={"version": rule["version"], "confirm": confirm})
        assert r.status_code == 200, r.text
        return r.json()


@pytest.fixture()
def w(client, settings, monkeypatch) -> World:
    return World(client, settings, monkeypatch)


def cold_room(**opts) -> dict:
    return {"when": {"op": "and", "items": [
        {"signal": "temperature.value", "subject": "u1", "cmp": "gt", "value": 8.0, "hold_s": 60},
        {"signal": "temperature.door_open", "subject": "u1", "cmp": "is_true", "debounce_s": 0},
        {"signal": "time.after_hours", "cmp": "is_true"}]},
        "actions": [{"type": "set_flag", "flag": "cold_alarm", "value": True}, {"type": "notify", "to": {"users": [ADMIN]}}],
        "options": {"cooldown_s": 900, "clear_after_s": 60, **opts}}


# ---------------------------------------------------------------- OFF by default

def test_off_by_default_every_route_but_status_and_settings_answers_409(w):
    s = w.c.get(f"{API}/status").json()
    assert s["enabled"] is False and s["can"] == {"view": True, "manage": True, "admin": True}
    assert all(v is False for v in s["actions"].values())
    for method, url in (("get", API), ("get", f"{API}/signals"), ("post", API), ("get", f"{API}/flags")):
        r = getattr(w.c, method)(url, **({"json": {"name": "x", "definition": cold_room()}} if method == "post" else {}))
        assert r.status_code == 409 and r.json()["code"] == "scenarios_disabled", r.text
    assert w.c.get(f"{API}/settings").status_code == 200
    with w.db.connection(mode="read") as conn:
        assert conn.execute("SELECT COUNT(*) FROM scenario_rules").fetchone()[0] == 0
        assert svc.tick(w.db, w.clock) == {"skipped": "disabled"}


def test_status_never_403_and_viewer_has_no_rights(w):
    bind(w.c, w.settings, "viewer1", "viewer", "installation", "*")
    h = as_user("viewer1")
    s = w.c.get(f"{API}/status", headers=h)
    assert s.status_code == 200 and s.json()["can_use"] is False
    w.on()
    assert w.c.get(API, headers=h).status_code == 403
    assert w.c.put(f"{API}/settings", json={"changes": {"scenarios.tick_s": 20}, "confirmed": True}, headers=h).status_code == 403


def test_managers_author_from_day_one_but_only_the_system_admin_edits_settings(w):
    bind(w.c, w.settings, "mgr", "site_admin", "installation", "*")
    h = as_user("mgr")
    w.on()
    rule = w.create(cold_room(), headers=h)
    assert rule["enabled"] is False and rule["state"] == "off" and rule["service_identity"] == f"svc:scenario:{rule['id']}"
    assert w.c.get(f"{API}/settings", headers=h).status_code == 403
    assert w.c.post(f"{API}/{rule['id']}/reassign", json={"owner_user_id": ADMIN}, headers=h).status_code == 403


# ---------------------------------------------------------------- the closed format and the door wall

@pytest.mark.parametrize("action", [
    {"type": "unlock", "entity_id": "lock.front"}, {"type": "open_door", "door": "d1"}, {"type": "run_safe_scene", "scene": "scene.x"},
    {"type": "call_service", "domain": "lock", "service": "unlock"}, {"type": "alarm_arm"}, {"type": "webhook", "url": "http://x"},
])
def test_any_operating_action_is_refused(w, action):
    w.on()
    d = cold_room()
    d["actions"] = [action]
    r = w.c.post(API, json={"name": "x", "definition": d})
    assert r.status_code == 422
    assert [e["code"] for e in r.json()["details"]["errors"]] == ["scenario_forbidden_action"]


def test_validation_unknown_keys_depth_leaves_and_kinds(w):
    w.on()
    deep = {"signal": "time.after_hours", "cmp": "is_true"}
    for _ in range(5):
        deep = {"op": "not", "item": deep}
    cases = [
        ({**cold_room(), "extra": 1}, "unknown_key"),
        ({"when": deep, "actions": [{"type": "set_flag", "flag": "f1", "value": True}]}, "too_deep"),
        ({"when": {"op": "or", "items": [{"signal": "time.after_hours", "cmp": "is_true"}] * 13}, "actions": [{"type": "set_flag", "flag": "f1", "value": True}]}, "too_many_leaves"),
        ({"when": {"signal": "time.after_hours", "cmp": "gt", "value": 3}, "actions": [{"type": "set_flag", "flag": "f1", "value": True}]}, "bad_cmp"),
        ({"when": {"signal": "temperature.value", "subject": "u1", "cmp": "gt", "value": 900}, "actions": [{"type": "set_flag", "flag": "f1", "value": True}]}, "out_of_range"),
        ({"when": {"signal": "nope", "cmp": "is_true"}, "actions": [{"type": "set_flag", "flag": "f1", "value": True}]}, "unknown_signal"),
        ({"when": {"signal": "time.after_hours", "cmp": "is_true"}, "actions": []}, "no_actions"),
        ({**cold_room(), "options": {"cooldown_s": 5}}, "out_of_range"),
    ]
    for d, code in cases:
        r = w.c.post(API, json={"name": "x", "definition": d})
        assert r.status_code == 422, (code, r.text)
        assert code in [e["code"] for e in r.json()["details"]["errors"]], (code, r.json())


def test_presence_needs_the_people_count_permission_and_names_never_appear(w):
    bind(w.c, w.settings, "mgr", "site_admin", "installation", "*")
    w.on()
    with w.db.connection() as conn:
        conn.execute("INSERT INTO ha_areas(area_id, name, position, updated_at) VALUES ('lobby', 'Lobby', 0, ?)", (now_iso(),))
    d = {"when": {"signal": "presence.count", "subject": "lobby", "cmp": "gt", "value": 5}, "actions": [{"type": "set_flag", "flag": "crowd", "value": True}]}
    r = w.c.post(API, json={"name": "x", "definition": d}, headers=as_user("mgr"))
    assert r.status_code == 422 and r.json()["details"]["errors"][0]["code"] == "not_referenced"
    sigs = w.c.get(f"{API}/signals", headers=as_user("mgr")).json()["signals"]
    assert not any(s["module"] == "presence" for s in sigs)
    admin_presence = [s for s in w.c.get(f"{API}/signals").json()["signals"] if s["module"] == "presence"]
    assert {s["kind"] for s in admin_presence} == {"count", "bool"} and all(s["subjects"] == [] for s in admin_presence)  # areas only, and only mapped ones


def test_ticket_action_is_refused_while_the_service_module_is_off(w):
    w.on("create_ticket")
    d = cold_room()
    d["actions"] = [{"type": "create_service_request", "department_id": "dep1"}]
    r = w.c.post(API, json={"name": "x", "definition": d})
    assert r.status_code == 422 and r.json()["details"]["errors"][0]["code"] == "tickets_off"


def test_flag_cycles_are_refused(w):
    w.on()
    a = {"when": {"signal": "flag.value", "subject": "f_b", "cmp": "is_true"}, "actions": [{"type": "set_flag", "flag": "f_a", "value": True}]}
    w.create(a)
    b = {"when": {"signal": "flag.value", "subject": "f_a", "cmp": "is_true"}, "actions": [{"type": "set_flag", "flag": "f_b", "value": True}]}
    r = w.c.post(API, json={"name": "y", "definition": b})
    assert r.status_code == 422 and r.json()["details"]["errors"][0]["code"] == "flag_cycle"


# ---------------------------------------------------------------- dry run before enabling

def test_enable_needs_a_dry_run_of_this_version(w):
    w.on()
    rule = w.create(cold_room())
    r = w.c.post(f"{API}/{rule['id']}/enable", json={"version": 1})
    assert r.status_code == 409 and r.json()["code"] == "test_required"
    t = w.c.post(f"{API}/{rule['id']}/test", json={}).json()
    assert t["result"] in ("FALSE", "UNKNOWN") and len(t["snapshot"]) == 3 and t["sentence"]
    assert w.c.post(f"{API}/{rule['id']}/enable", json={"version": 1}).json()["enabled"] is True
    # an edit makes a new version: it must be tested again
    upd = w.c.put(f"{API}/{rule['id']}", json={"name": "n2", "definition": cold_room(cooldown_s=1200), "version": 1}).json()
    w.c.post(f"{API}/{rule['id']}/disable", json={"version": upd["version"]})
    r = w.c.post(f"{API}/{rule['id']}/enable", json={"version": upd["version"]})
    assert r.status_code == 409 and r.json()["code"] == "test_required"
    assert w.runs(rule["id"])[0]["outcome"] == "test"
    assert not w.audit("scenario.fire")  # a dry run never acts


def test_simulate_runs_no_action_and_writes_nothing(w):
    w.on("set_flag", "notify")
    # every leaf simulated: the unsaved definition is evaluated on the real clock, so an unsimulated time.after_hours made this
    # test depend on the hour it ran (FALSE inside the Sunday-Thursday working window - the 2.19.0 gate ran on Sunday 11:00 site time)
    over = {"when.items[0]": 9.5, "when.items[1]": True, "when.items[2]": True}
    r = w.c.post(f"{API}/simulate", json={"definition": cold_room(), "overrides": over})
    assert r.status_code == 200, r.text
    body = r.json()
    assert body["result"] == "TRUE" and body["would_fire"] is True and body["simulated"] is True
    assert w.flag("cold_alarm") is None and not w.notices("scenario.fired")
    bad = w.c.post(f"{API}/simulate", json={"definition": cold_room(), "overrides": {"when.items[9]": 1}})
    assert bad.status_code == 422
    # and the clock leaf really is what decides: inside working hours the same simulation is FALSE and would not fire
    r = w.c.post(f"{API}/simulate", json={"definition": cold_room(), "overrides": {**over, "when.items[2]": False}})
    assert r.status_code == 200 and r.json()["result"] == "FALSE" and r.json()["would_fire"] is False, r.text


def test_version_conflict(w):
    w.on()
    rule = w.create(cold_room())
    w.c.put(f"{API}/{rule['id']}", json={"name": "a", "definition": cold_room(), "version": 1})
    r = w.c.put(f"{API}/{rule['id']}", json={"name": "b", "definition": cold_room(), "version": 1})
    assert r.status_code == 409 and r.json()["code"] == "version_conflict"


# ---------------------------------------------------------------- the engine

def test_temperature_door_and_after_hours_fire_once_then_clear(w):
    w.on("set_flag", "notify")
    rule = w.enable(w.create(cold_room()))
    rid = rule["id"]
    w.entity("sensor.cold_temp", "9.4")
    w.entity("binary_sensor.cold_door", "on")
    assert w.step(rid) is None                                   # holding (60 s)
    w.entity("sensor.cold_temp", "7.8", seen=w.clock + dt.timedelta(seconds=30))
    assert w.step(rid, 30) is None                               # 7.8 > 8.0 - 0.5: hysteresis keeps it armed, the hold goes on
    w.entity("sensor.cold_temp", "9.0", seen=w.clock + dt.timedelta(seconds=31))
    w.entity("binary_sensor.cold_door", "on", seen=w.clock + dt.timedelta(seconds=31))
    assert w.step(rid, 31) == "fired"
    assert w.flag("cold_alarm") == "true"
    fired = w.notices("scenario.fired")
    assert len(fired) == 1 and "9" in (fired[0].get("body") or json.dumps(fired[0], ensure_ascii=False))
    assert w.row(rid)["state"] == "active"
    assert w.step(rid, 5) is None                                # still true: no second fire
    run = [r for r in w.runs(rid) if r["outcome"] == "fired"][0]
    snap = json.loads(run["snapshot_json"])
    assert {lf["result"] for lf in snap["leaves"]} == {"TRUE"} and snap["service_identity"] == f"svc:scenario:{rid}"
    w.entity("sensor.cold_temp", "5.0", seen=w.clock + dt.timedelta(seconds=10))
    assert w.step(rid, 10) is None                               # false, waiting clear_after_s
    w.entity("sensor.cold_temp", "5.0", seen=w.clock + dt.timedelta(seconds=61))
    w.entity("binary_sensor.cold_door", "on", seen=w.clock + dt.timedelta(seconds=61))
    assert w.step(rid, 61) == "cleared"
    assert w.row(rid)["state"] == "ok"
    fire = w.audit("scenario.fire")
    assert len(fire) == 1 and fire[0]["actor_user_id"] in (None, "")


def test_cooldown_blocks_a_second_fire(w):
    w.on("set_flag")
    d = {"when": {"signal": "door.is_open", "subject": "binary_sensor.lobby_door", "cmp": "is_true", "debounce_s": 0},
         "actions": [{"type": "set_flag", "flag": "lobby_open", "value": True}], "options": {"cooldown_s": 900, "clear_after_s": 0}}
    rid = w.enable(w.create(d))["id"]
    w.entity("binary_sensor.lobby_door", "on")
    assert w.step(rid) == "fired"
    w.entity("binary_sensor.lobby_door", "off", seen=w.clock + dt.timedelta(seconds=1))
    assert w.step(rid, 1) == "cleared"
    w.entity("binary_sensor.lobby_door", "on", seen=w.clock + dt.timedelta(seconds=1))
    assert w.step(rid, 1) is None                               # inside the cooldown
    w.entity("binary_sensor.lobby_door", "on", seen=w.clock + dt.timedelta(seconds=900))
    assert w.step(rid, 900) == "fired"


def test_unknown_never_fires_holds_then_degrades(w):
    w.on("set_flag")
    d = cold_room(unknown_grace_s=120)
    rid = w.enable(w.create(d))["id"]
    w.entity("binary_sensor.cold_door", "on")
    w.entity("sensor.cold_temp", "unavailable")
    assert w.step(rid) is None
    assert w.step(rid, 60) is None and w.row(rid)["state"] == "ok"
    assert w.step(rid, 61) == "degraded"
    row = w.row(rid)
    assert row["state"] == "degraded" and row["state_reason"] == "sensor_unknown"
    assert w.flag("cold_alarm") is None                          # a lost sensor never acts
    w.entity("sensor.cold_temp", "4.0", seen=w.clock + dt.timedelta(seconds=5))
    w.entity("binary_sensor.cold_door", "on", seen=w.clock + dt.timedelta(seconds=5))
    w.step(rid, 5)
    assert w.row(rid)["state"] == "ok"


def test_mirror_disconnected_is_unknown_not_false(w, monkeypatch):
    w.on("set_flag")
    d = {"when": {"op": "not", "item": {"signal": "door.is_open", "subject": "binary_sensor.lobby_door", "cmp": "is_true", "debounce_s": 0}},
         "actions": [{"type": "set_flag", "flag": "lobby_closed", "value": True}]}
    rid = w.enable(w.create(d))["id"]
    monkeypatch.setattr(ha_sync.STATE, "connected", False, raising=False)
    assert w.step(rid) is None and w.flag("lobby_closed") is None
    assert w.row(rid)["last_result"] == "UNKNOWN"


def test_treat_as_false_option(w):
    w.on("set_flag")
    d = {"when": {"op": "or", "items": [{"signal": "temperature.value", "subject": "u1", "cmp": "gt", "value": 8.0}]},
         "actions": [{"type": "set_flag", "flag": "x1", "value": True}], "options": {"on_unknown": "treat_as_false", "unknown_grace_s": 0}}
    rid = w.enable(w.create(d))["id"]
    w.entity("sensor.cold_temp", "unavailable")
    w.step(rid)
    w.step(rid, 10)
    assert w.row(rid)["state"] == "ok"                           # never degraded, never fired


def test_kill_switch_and_action_switches(w):
    w.on("notify")  # set_flag stays off
    d = {"when": {"signal": "door.is_open", "subject": "binary_sensor.lobby_door", "cmp": "is_true", "debounce_s": 0},
         "actions": [{"type": "set_flag", "flag": "k1", "value": True}, {"type": "notify", "to": {"users": [ADMIN]}}], "options": {"clear_after_s": 0}}
    rid = w.enable(w.create(d))["id"]
    w.set(scenarios__kill_switch="true")
    w.entity("binary_sensor.lobby_door", "on")
    assert w.step(rid) == "suppressed"
    assert w.step(rid, 5) is None and len(w.audit("scenario.suppressed")) == 1   # audited once, no storm
    assert w.flag("k1") is None and not w.notices("scenario.fired")
    w.set(scenarios__kill_switch="false")
    assert w.step(rid, 5) == "fired"
    acts = json.loads([r for r in w.runs(rid) if r["outcome"] == "fired"][0]["actions_json"])
    assert acts[0] == {"type": "set_flag", "status": "skipped", "reason": "action_off"} and acts[1]["status"] == "ok"


def test_daily_cap_with_per_rule_override(w):
    w.on("set_flag")
    d = {"when": {"signal": "door.is_open", "subject": "binary_sensor.lobby_door", "cmp": "is_true", "debounce_s": 0},
         "actions": [{"type": "set_flag", "flag": "c1", "value": True}], "options": {"cooldown_s": 60, "clear_after_s": 0, "max_fires_per_day": 2}}
    rid = w.enable(w.create(d))["id"]
    outcomes = []
    for _ in range(3):
        w.entity("binary_sensor.lobby_door", "on", seen=w.clock + dt.timedelta(seconds=61))
        outcomes.append(w.step(rid, 61))
        w.entity("binary_sensor.lobby_door", "off", seen=w.clock + dt.timedelta(seconds=1))
        w.step(rid, 1)
    assert outcomes == ["fired", "fired", "suppressed"]
    assert w.row(rid)["fires_today"] == 2


def test_author_rights_are_rechecked_at_every_run_and_an_admin_reassigns(w):
    bind(w.c, w.settings, "mgr", "site_admin", "installation", "*")
    w.on("set_flag")
    d = {"when": {"signal": "door.is_open", "subject": "binary_sensor.lobby_door", "cmp": "is_true", "debounce_s": 0},
         "actions": [{"type": "set_flag", "flag": "r1", "value": True}]}
    h = as_user("mgr")
    rule = w.create(d, headers=h)
    w.c.post(f"{API}/{rule['id']}/test", json={}, headers=h)
    w.c.post(f"{API}/{rule['id']}/enable", json={"version": 1}, headers=h)
    with w.db.connection() as conn:
        conn.execute("UPDATE bindings SET revoked_at = ? WHERE subject_id = 'dev-mgr'", (now_iso(),))
        bump_permission_revision(conn)
    w.entity("binary_sensor.lobby_door", "on")
    assert w.step(rule["id"]) == "degraded"
    row = w.row(rule["id"])
    assert (row["state"], row["state_reason"]) == ("degraded", "author_rights_lost") and w.flag("r1") is None
    assert w.step(rule["id"], 30) is None                         # stays stopped
    r = w.c.post(f"{API}/{rule['id']}/reassign", json={"owner_user_id": ADMIN})
    assert r.status_code == 200 and r.json()["owner"]["id"] == ADMIN and r.json()["state"] == "ok"
    assert w.step(rule["id"], 5) == "fired"


def test_recipients_without_the_module_rights_get_a_generic_notice(w):
    bind(w.c, w.settings, "guard", "kiosk", "installation", "*")  # no devices.read: cannot see the door sensor
    w.c.get("/api/v1/me", headers=as_user("guard"))
    w.on("notify")
    d = {"when": {"signal": "door.is_open", "subject": "binary_sensor.lobby_door", "cmp": "is_true", "debounce_s": 0},
         "actions": [{"type": "notify", "to": {"users": [ADMIN, "dev-guard"]}}]}
    rid = w.enable(w.create(d))["id"]
    w.entity("binary_sensor.lobby_door", "on")
    assert w.step(rid) == "fired"
    full, generic = w.notices("scenario.fired"), w.notices("scenario.fired_generic")
    assert len(full) == 1 and len(generic) == 1
    assert json.loads(full[0]["origin_json"])["to"] == [ADMIN]
    assert json.loads(generic[0]["origin_json"])["to"] == ["dev-guard"]
    assert "lobby" not in json.dumps(generic[0], ensure_ascii=False).lower()


def test_viewer_without_module_rights_sees_redacted_leaves(w):
    with w.db.connection() as conn:
        conn.execute("INSERT INTO custom_roles(id, name_he, permissions_json, sensitive_json, created_at, updated_at) VALUES ('scen_view', 'צופה תרחישים', '[]', ?, ?, ?)",
                     (json.dumps(["scenario.view"]), now_iso(), now_iso()))
        bump_permission_revision(conn)
    bind(w.c, w.settings, "watcher", "scen_view", "installation", "*")
    w.on()
    rid = w.create(cold_room())["id"]
    r = w.c.get(f"{API}/{rid}", headers=as_user("watcher"))
    assert r.status_code == 200, r.text
    v = r.json()
    assert v["redacted_leaves"] == ["when.items[0]", "when.items[1]"]
    assert v["definition"]["when"]["items"][0] == {"redacted": True, "message": svc.TEXT["redacted"]}
    assert v["definition"]["when"]["items"][2]["signal"] == "time.after_hours"
    assert w.c.post(f"{API}/{rid}/test", json={}, headers=as_user("watcher")).status_code == 403  # view only

# ---------------------------------------------------------------- settings

def test_settings_are_validated_confirmed_and_audited(w):
    s = w.c.get(f"{API}/settings").json()["settings"]
    assert s["scenarios.max_fires_per_day"] == 100 and s["scenarios.max_tickets_per_day"] == 20 and s["scenarios.max_actions_per_hour"] == 600
    assert s["scenarios.enabled"] is False and s["scenarios.kill_switch"] is False
    assert w.c.put(f"{API}/settings", json={"changes": {"scenarios.tick_s": 20}}).status_code == 409
    for bad in ({"scenarios.tick_s": 5}, {"scenarios.nope": 1}, {"scenarios.work_window": {"days": [9], "from": "08:00", "to": "17:00"}},
                {"scenarios.default_recipients": {"users": ["a b"]}}):
        assert w.c.put(f"{API}/settings", json={"changes": bad, "confirmed": True}).status_code == 422, bad
    r = w.c.put(f"{API}/settings", json={"changes": {"scenarios.enabled": True, "scenarios.work_window": {"days": [6, 0, 1, 2, 3], "from": "07:00", "to": "19:00"},
                                                     "scenarios.kill_switch": True}, "confirmed": True})
    assert r.status_code == 200 and set(r.json()["changed"]) == {"scenarios.enabled", "scenarios.work_window", "scenarios.kill_switch"}
    assert w.audit("scenario.kill_switch") and w.audit("scenario.settings.change")


def test_after_hours_follows_the_window_in_settings(w):
    w.on("set_flag")
    d = {"when": {"signal": "time.after_hours", "cmp": "is_true"}, "actions": [{"type": "set_flag", "flag": "ah", "value": True}]}
    rid = w.enable(w.create(d))["id"]
    w.set(scenarios__work_window='{"days":[0,1,2,3,4,5,6],"from":"00:00","to":"23:59"}')
    assert w.step(rid) is None and w.flag("ah") is None
    w.set(scenarios__work_window='{"days":[6,0,1,2,3],"from":"08:00","to":"17:00"}')
    assert w.step(rid, 1) == "fired"


# ---------------------------------------------------------------- the HA path is not touched

def test_no_scenario_module_reaches_the_bridge_or_a_device():
    root = Path(__file__).resolve().parents[1] / "smplwise"
    for rel in ("services/scenarios.py", "services/scenario_model.py", "services/scenario_signals.py", "services/scenario_settings.py", "routers/scenarios.py"):
        code = [ln for ln in (root / rel).read_text(encoding="utf-8").splitlines() if ln.lstrip().startswith(("import ", "from "))]
        for word in ("automation_transport", "automation_ops", "bridge", "call_service", "door_execute", "door_run", "intercom", "go2rtc", "nvr", "recorders"):
            assert not any(word in ln for ln in code), (rel, word)  # the imports name no device, bridge or HA-automation path


def test_choices_offer_names_for_the_pickers(w):
    bind(w.c, w.settings, "mgr", "site_admin", "installation", "*")
    assert w.c.get(f"{API}/choices").status_code == 200  # also while the module is off (the settings card)
    w.on()
    r = w.c.get(f"{API}/choices")
    assert r.status_code == 200, r.text
    body = r.json()
    assert ADMIN in {u["id"] for u in body["users"]} and all(u["name"] for u in body["users"])
    assert {"site_admin", "system_admin"} <= {x["id"] for x in body["roles"]}
    assert body["departments"] == []  # the service module is off
    bind(w.c, w.settings, "viewer2", "viewer", "installation", "*")
    assert w.c.get(f"{API}/choices", headers=as_user("viewer2")).status_code == 403