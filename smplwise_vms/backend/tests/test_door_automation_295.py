"""CR-AUTODOORS-295: automations that open WisKey doors - the Arx side, on fakes only.

Proven here (no Home Assistant, bridge, WisKey, door or key is contacted; the sender is a recording fake):
- the automation operator is its own principal type: never a human, refused by the human door rule, holds no binding;
- `access.doors.automate`: sensitive, built-in holder system_admin only, labelled, station-carriable;
- the block (policy) is validated on the server with safe defaults; an edit disarms;
- arming is a human step: confirmation, the permission and the one door rule on every door, loop protection, the kill switch;
- the fire path: every gate in order (feature, kill switch, expiry, autonomous trigger only, revision binding, window, armer's
  authority, cooldown, caps, storm), the two audit rows as an automation, never retried, one door's failure not stopping the next;
- the feature switch cannot be turned on in this build (GO_LIVE_PERMITTED is False) and the live sender refuses;
- simulation is side-effect free; the access audit lists the automation rows; the mirror hook never raises.

DOORHARD-295 (Fable review section 5, owner decisions 2026-10-21) is proven at the end of this file: A-01 corroboration of the event with the mirror
(a spoofed event without a person's context is refused), A-02 the switches re-read inside the per-door transaction, A-03 the per-door cap across blocks,
A-04 manual detection by context and an allow-list of sources, A-09 the bounded queue with one worker, A-10 DST, CR 12.1 operator AND armer stored,
12.3 a restore brings blocks back disarmed, 12.4 `automation.manage` at a floor."""
from __future__ import annotations

import datetime as _dt
import json
from typing import Any

import pytest
from automations_fixture import place
from conftest import as_user, seed_tree
from fake_trusted_bridge import FakeWisKeyFeed, station
from fastapi.testclient import TestClient

from smplwise import rbac
from smplwise.db import Database, new_id, now_iso, permission_revision, set_setting
from smplwise.main import create_app
from smplwise.rbac import INSTALLATION, ROLES, STATION, Principal
from smplwise.routers import access_control
from smplwise.services import door_authority, door_automation, intercom_sync

API = "/api/v1"
ENTRY = "01JTESTSTATIONENTRY000000A"
DOCK = "01JTESTSTATIONENTRY000000C"
# Monday 2026-10-05 09:00 in Asia/Jerusalem (UTC+3)
MONDAY_9 = _dt.datetime(2026, 10, 5, 6, 0, tzinfo=_dt.timezone.utc)
POLICY = {"doors": [{"station_id": ENTRY, "relay": 1}], "windows": [{"days": [0, 1, 2, 3, 4], "start": "07:00", "end": "10:00"}]}


class FakeSender:
    """Records every door the fire path hands on; `outcomes` is consumed per call (default `sent`)."""

    def __init__(self) -> None:
        self.calls: list[dict[str, Any]] = []
        self.outcomes: list[tuple[str, str | None]] = []

    def open(self, *, operator: Principal, station_id: str, relay: int, request_id: str, not_after: _dt.datetime) -> tuple[str, str | None]:
        self.calls.append({"operator": operator, "station_id": station_id, "relay": relay, "request_id": request_id})
        return self.outcomes.pop(0) if self.outcomes else ("sent", None)


class Clock:
    def __init__(self, at: _dt.datetime) -> None:
        self.at = at

    def __call__(self) -> _dt.datetime:
        return self.at

    def advance(self, **kw: Any) -> None:
        self.at = self.at + _dt.timedelta(**kw)


def _item(conn: Any, item_id: str, alias: str, triggers: list[dict[str, Any]], revision: str = "rev0000000000001", target: str = "light.lobby") -> None:
    cfg = {"id": item_id, "alias": alias, "triggers": triggers, "conditions": [], "actions": [{"action": "light.turn_on", "target": {"entity_id": target}}], "mode": "single"}
    conn.execute("INSERT OR REPLACE INTO ha_config_items(kind, item_id, config_id, entity_id, source, revision, config_json, seen_at, changed_at) VALUES ('automation',?,?,?,'ui',?,?,?,?)",
                 (item_id, item_id, f"automation.a_{item_id}", revision, json.dumps(cfg, ensure_ascii=False), now_iso(), now_iso()))


@pytest.fixture(autouse=True)
def _clean():
    access_control.RELAYS.clear()
    intercom_sync.SYNC.reset()
    door_automation.reset_for_tests()
    yield
    access_control.RELAYS.clear()
    intercom_sync.SYNC.reset()
    door_automation.reset_for_tests()


@pytest.fixture()
def world(settings, monkeypatch):
    monkeypatch.setattr(door_automation, "CORROBORATE_WAIT_S", 0.0)  # an uncorroborated event is refused at once (the wait has its own test)
    feed = FakeWisKeyFeed([station(ENTRY, "כניסה ראשית"), station(DOCK, "רציף", relays=[1, 2])]).install(monkeypatch)
    app = create_app(settings)
    c = TestClient(app)
    db = Database(settings.db_path)
    sender = FakeSender()
    clock = Clock(MONDAY_9)
    door_automation.SENDER = sender
    door_automation.set_clock(clock)
    door_automation.DISPATCH = lambda fn: fn()  # synchronous in tests
    # DA-01: Home Assistant's state machine, read directly at decision time. `corroborate()` records a real run here AND in the mirror;
    # a test that forges the mirror alone leaves this unchanged.
    machine: dict[str, dict[str, Any]] = {}
    reads: list[str] = []

    def read_state(_settings: Any, entity_id: str) -> dict[str, Any] | None:
        reads.append(entity_id)
        return machine.get(entity_id)

    door_automation.STATE_READER = read_state
    c.get(f"{API}/me")  # joni: the bootstrap system administrator
    with db.connection() as conn:
        for eid, platform, entry in (("lock.entrance", "hikvision_intercom", ENTRY), ("lock.dock_gate", "hikvision_intercom", DOCK),
                                     ("binary_sensor.entrance_call", "hikvision_intercom", ENTRY), ("binary_sensor.lobby_motion", "zha", None)):
            conn.execute("INSERT INTO ha_entities(entity_id, domain, name, platform, config_entry_id, state, state_seen_at, first_seen_at, updated_at) VALUES (?,?,?,?,?,?,?,?,?)",
                         (eid, eid.split(".")[0], eid.split(".")[1], platform, entry, "off", now_iso(), now_iso(), now_iso()))
        for eid, entry, relay in (("lock.entrance", ENTRY, 1), ("lock.dock_gate", DOCK, 2)):
            conn.execute("INSERT INTO intercom_door_map(entity_id, config_entry_id, physical_index, source, mapped_by, mapped_at) VALUES (?,?,?,'manual','test',?)", (eid, entry, relay, now_iso()))
        set_setting(conn, "time.zone", "Asia/Jerusalem")
        _item(conn, "9001", "פתיחת שער בבוקר", [{"trigger": "state", "entity_id": "binary_sensor.lobby_motion", "to": "on"}])
        _item(conn, "9002", "לולאה דרך האינטרקום", [{"trigger": "state", "entity_id": ["binary_sensor.entrance_call"], "to": "on"}])
        _item(conn, "9003", "טריגר מחושב", [{"trigger": "template", "value_template": "{{ true }}"}])
        _item(conn, "9004", "לולאה דרך המנעול", [{"trigger": "state", "entity_id": "lock.entrance", "to": "unlocked"}])
        _item(conn, "9005", "בשעה קבועה", [{"trigger": "time", "at": "08:00:00"}])
        _item(conn, "9006", "חיישן או שעה", [{"trigger": "state", "entity_id": "binary_sensor.lobby_motion", "to": "on"}, {"trigger": "time", "at": "08:00:00"}])
        _item(conn, "9007", "מאפיין של חיישן", [{"trigger": "state", "entity_id": "binary_sensor.lobby_motion", "attribute": "battery", "to": "low"}])
        # the mirror's own entities of the automations (their `last_triggered` is what an event is matched with) and a light
        for item in ("9001", "9002", "9003", "9004", "9005", "9006", "9007"):
            conn.execute("INSERT INTO ha_entities(entity_id, domain, name, platform, state, attributes_json, state_seen_at, first_seen_at, updated_at) VALUES (?,?,?,?,?,?,?,?,?)",
                         (f"automation.a_{item}", "automation", f"a_{item}", "automation", "on", "{}", now_iso(), now_iso(), now_iso()))
        conn.execute("INSERT INTO ha_entities(entity_id, domain, name, platform, state, state_seen_at, first_seen_at, updated_at) VALUES ('light.lobby','light','lobby','zha','off',?,?,?)",
                     (now_iso(), now_iso(), now_iso()))
    return {"app": app, "c": c, "db": db, "sender": sender, "clock": clock, "feed": feed, "settings": settings, "machine": machine, "reads": reads}


@pytest.fixture()
def live(world, monkeypatch):
    """The fire path reachable: the go-live constant patched for the test only and the feature switch on (written directly - the
    route refuses it, see test_feature_switch_cannot_be_turned_on_in_this_build)."""
    monkeypatch.setattr(door_automation, "GO_LIVE_PERMITTED", True)
    with world["db"].connection() as conn:
        set_setting(conn, door_automation.FLAG_KEY, "on")
    return world


def _bind(db: Database, user: str, role: str, scope_type: str = "installation", scope_id: str = "*", effect: str = "allow") -> str:
    bid = new_id()
    with db.connection() as conn:
        conn.execute("INSERT OR IGNORE INTO users(id, username, display_name, source, active, first_seen_at, last_seen_at) VALUES (?,?,?,'dev',1,?,?)", (f"dev-{user}", user, user, now_iso(), now_iso()))
        conn.execute("INSERT INTO bindings(id, subject_kind, subject_id, role_id, scope_type, scope_id, effect, permission_revision, assigned_by, created_at) VALUES (?, 'user', ?, ?, ?, ?, ?, ?, 'test', ?)",
                     (bid, f"dev-{user}", role, scope_type, scope_id, effect, permission_revision(conn), now_iso()))
    return bid


def _role(c: TestClient, name: str, sensitive: list[str], permissions: list[str] | None = None) -> str:
    r = c.post(f"{API}/access/roles", json={"name": name, "permissions": permissions or ["map.read"], "sensitive": sensitive})
    assert r.status_code == 201, r.text
    return r.json()["id"]


def _create(c: TestClient, item: str = "9001", policy: dict[str, Any] | None = None, user: str | None = None, name: str = "שער בוקר") -> Any:
    return c.post(f"{API}/door-automations", json={"automation_id": item, "name": name, "policy": policy or POLICY}, headers=as_user(user) if user else {})


def _arm(c: TestClient, da: dict[str, Any], user: str | None = None, confirmed: Any = True, **extra: Any) -> Any:
    return c.post(f"{API}/door-automations/{da['id']}/arm", json={"confirmed": confirmed, "policy_revision": da["policy_revision"], **extra}, headers=as_user(user) if user else {})


def _armed(c: TestClient, item: str = "9001", policy: dict[str, Any] | None = None) -> dict[str, Any]:
    r = _create(c, item, policy)
    assert r.status_code == 201, r.text
    r = _arm(c, r.json())
    assert r.status_code == 200 and r.json()["state"] == "armed", r.text
    return r.json()


def frame(item: str = "9001", user: str | None = None, source: str = "state of binary_sensor.lobby_motion") -> dict[str, Any]:
    return {"type": "event", "event": {"event_type": "automation_triggered", "time_fired": "2026-10-05T06:00:00+00:00",
                                       "data": {"name": "x", "entity_id": f"automation.a_{item}", "source": source},
                                       "context": {"id": "01JCTX", "parent_id": None, "user_id": user}}}


def corroborate(w: dict[str, Any], item: str = "9001", *, run: bool = True, change: bool = True, offset_s: float = 0.0) -> None:
    """What the mirror holds when a REAL run happened: the automation entity's `last_triggered` (a new, later stamp every call) and the watched sensor's
    change. `offset_s` moves the stamp away from now (stale / future); `run=False` / `change=False` leave that half out."""
    at = w["clock"].at
    w["seq"] = w.get("seq", 0) + 1
    last = at - _dt.timedelta(seconds=1) + _dt.timedelta(seconds=offset_s, microseconds=w["seq"])
    with w["db"].connection() as conn:
        if run:
            conn.execute("UPDATE ha_entities SET attributes_json = ? WHERE entity_id = ?", (json.dumps({"last_triggered": last.isoformat()}), f"automation.a_{item}"))
            if "machine" in w:
                w["machine"][f"automation.a_{item}"] = {"entity_id": f"automation.a_{item}", "state": "on", "attributes": {"last_triggered": last.isoformat()}}
        if change:
            conn.execute("UPDATE ha_entities SET last_changed = ?, last_updated = ? WHERE entity_id = 'binary_sensor.lobby_motion'", (at.isoformat(), at.isoformat()))
            if "machine" in w:  # DA-06: the same change in Home Assistant's own state machine
                w["machine"]["binary_sensor.lobby_motion"] = {"entity_id": "binary_sensor.lobby_motion", "state": "on", "last_changed": at.isoformat(), "last_updated": at.isoformat()}


def fire(w: dict[str, Any], seed: bool = True, **kw: Any) -> list[dict[str, Any]]:
    """An `automation_triggered` frame. `seed` (default) first puts a real run in the mirror; `seed=False` is the event alone."""
    if seed:
        corroborate(w, kw.get("item", "9001"))
    return door_automation.handle_trigger(w["db"], w["settings"], frame(**kw))


def audit_rows(db: Database, action: str) -> list[dict[str, Any]]:
    with db.connection(mode="read") as conn:
        out = conn.execute("SELECT actor_user_id, actor_username, action, decision, resource_type, resource_id, reason, details_json FROM audit_log WHERE action = ? ORDER BY rowid", (action,)).fetchall()
    return [{**dict(r), "details": json.loads(r["details_json"] or "{}")} for r in out]


def state_of(c: TestClient, da_id: str) -> dict[str, Any]:
    r = c.get(f"{API}/door-automations/{da_id}")
    assert r.status_code == 200, r.text
    return r.json()


# ================================================================ the operator and the permission

def test_operator_is_never_a_human_and_humans_never_fire(world):
    c, db = world["c"], world["db"]
    da = _create(c).json()
    op = door_automation.operator_of(da["id"], da["name"])
    assert op.source == "automation" and op.user_id == f"automation:{da['id']}" and door_automation.is_operator(op)
    assert not door_automation.is_operator(Principal("dev-joni", "joni", "joni", "dev"))
    with db.connection() as conn:
        assert door_authority.identity_ok(op, True, conn) is False, "the human door rule refuses the operator"
        assert door_authority.check(conn, op, ENTRY, 1, dev_mode=True).reason == "identity_unmapped"
        assert not rbac.authorize(conn, op, "access.doors.open", INSTALLATION).allowed
        assert not rbac.authorize(conn, op, door_automation.AUTOMATE, INSTALLATION).allowed
        assert rbac.permissions_anywhere(conn, op) == []
    # an operator-shaped id can never be a person: no HA (hex), local (l_) or developer (dev-) id carries a colon
    for human in ("0123456789abcdef0123456789abcdef", "l_abc", "dev-joni"):
        assert not human.startswith(door_automation.OPERATOR_PREFIX)


def test_the_permission_is_sensitive_system_admin_only_and_station_carriable():
    from pathlib import Path

    from smplwise.routers.access import PERMISSION_LABELS, SENSITIVE, SYSTEM_PERMISSIONS

    assert door_automation.AUTOMATE == "access.doors.automate"
    assert {r for r, perms in ROLES.items() if door_automation.AUTOMATE in perms} == {"system_admin"}
    assert door_automation.AUTOMATE in SENSITIVE and door_automation.AUTOMATE not in SYSTEM_PERMISSIONS
    assert PERMISSION_LABELS[door_automation.AUTOMATE]
    assert door_automation.AUTOMATE in rbac.STATION_PERMISSIONS
    contract = json.loads((Path(__file__).resolve().parents[3] / "contracts" / "examples" / "role-catalog.design.json").read_text(encoding="utf-8"))
    assert {r["id"] for r in contract["roles"] if door_automation.AUTOMATE in r["permissions"]} == {"system_admin"}
    assert door_automation.AUTOMATE in contract["sensitive_permissions_not_implied"]


# ================================================================ the block: validation, create, update

@pytest.mark.parametrize("policy, field", [
    ({"doors": [], "windows": POLICY["windows"]}, "doors"),
    ({"doors": [{"station_id": ENTRY, "relay": 1}] * 2, "windows": POLICY["windows"]}, "doors"),
    ({"doors": [{"station_id": ENTRY, "relay": n} for n in range(1, 18)], "windows": POLICY["windows"]}, "doors"),
    ({"doors": [{"station_id": ENTRY, "relay": 0}], "windows": POLICY["windows"]}, "doors"),
    ({"doors": POLICY["doors"], "windows": "always"}, "windows"),
    ({"doors": POLICY["doors"], "windows": [{"days": [7], "start": "07:00", "end": "10:00"}]}, "windows"),
    ({"doors": POLICY["doors"], "windows": [{"days": [0], "start": "10:00", "end": "07:00"}]}, "windows"),
    ({"doors": POLICY["doors"], "windows": [{"days": [0], "start": "7:00", "end": "10:00"}]}, "windows"),
    ({"doors": POLICY["doors"], "windows": [{"days": [], "start": "07:00", "end": "10:00"}]}, "windows"),
    ({**POLICY, "cooldown_s": 0}, "cooldown_s"),
    ({**POLICY, "max_per_hour": 601}, "max_per_hour"),
    ({**POLICY, "max_per_day": 0}, "max_per_day"),
    ({**POLICY, "arm_days": 366}, "arm_days"),
    ({**POLICY, "unknown_key": 1}, "unknown_key"),
])
def test_policy_validation_refuses_and_names_the_field(world, policy, field):
    r = _create(world["c"], policy=policy)
    assert r.status_code == 422 and r.json()["code"] == "door_automation_invalid", r.text
    assert field in r.json()["details"]["fields"]


def test_defaults_are_safe_and_a_new_block_is_a_draft(world):
    c = world["c"]
    r = _create(c)
    assert r.status_code == 201, r.text
    da = r.json()
    assert da["state"] == "draft" and da["policy_revision"] == 1 and da["armed_by"] is None
    # owner decision 2026-10-21: few limits; a step without its own values follows the installation's settings
    assert not {"cooldown_s", "max_per_hour", "max_per_day", "arm_days"} & set(da["policy"])
    assert da["effective_limits"] == {"cooldown_s": 10, "max_per_hour": 30, "max_per_day": 300, "arm_days": 180}
    assert da["doors"] == [{"station_id": ENTRY, "relay": 1, "name": "כניסה ראשית"}]
    assert _create(c).json()["code"] == "door_automation_exists", "one block per automation"
    rows = audit_rows(world["db"], "door_automation.create")
    assert len(rows) == 1 and rows[0]["decision"] == "allowed"


def test_create_refuses_unknown_automation_unknown_door_and_callers_without_the_permission(world):
    c, db = world["c"], world["db"]
    assert _create(c, item="nope").status_code == 404
    r = _create(c, policy={**POLICY, "doors": [{"station_id": ENTRY, "relay": 2}]})
    assert r.status_code == 422 and r.json()["code"] == "door_automation_door_unknown", r.text
    r = _create(c, policy={**POLICY, "doors": [{"station_id": "01JNOSUCHSTATION0000000000", "relay": 1}]})
    assert r.status_code == 422 and r.json()["code"] == "door_automation_door_unknown"
    _bind(db, "dana", "operator")
    assert _create(c, user="dana").status_code == 403
    assert c.get(f"{API}/door-automations", headers=as_user("dana")).status_code == 403
    # the permission alone is not enough: automation.manage at the installation too (v1, fail closed)
    role = _role(c, "פותח באוטומציה", [door_automation.AUTOMATE, "access.doors.open"])
    _bind(db, "dana", role)
    r = _create(c, user="dana")
    assert r.status_code == 403 and r.json()["details"]["permission"] == "automation.manage", r.text


def test_an_edit_disarms_and_bumps_the_revision(world):
    c = world["c"]
    da = _armed(c)
    r = c.put(f"{API}/door-automations/{da['id']}", json={"name": "שער בוקר 2", "policy": {**POLICY, "cooldown_s": 120}, "policy_revision": da["policy_revision"]})
    assert r.status_code == 200, r.text
    after = r.json()
    assert after["state"] == "disarmed" and after["disarm_reason"] == "edited" and after["policy_revision"] == 2 and after["policy"]["cooldown_s"] == 120
    stale = c.put(f"{API}/door-automations/{da['id']}", json={"name": "x", "policy": POLICY, "policy_revision": 1})
    assert stale.status_code == 409 and stale.json()["code"] == "door_automation_changed"


def test_the_door_picker_lists_names_and_what_the_caller_may_arm(world):
    c, db = world["c"], world["db"]
    doors = c.get(f"{API}/door-automations/doors").json()["doors"]
    assert [(d["name"], d["relay"], d["can_arm"]) for d in doors] == [("כניסה ראשית", 1, True), ("רציף · ממסר 1", 1, True), ("רציף · ממסר 2", 2, True)]
    role = _role(c, "פותח באוטומציה", [door_automation.AUTOMATE])
    _bind(db, "dana", role, STATION, ENTRY)
    doors = c.get(f"{API}/door-automations/doors", headers=as_user("dana")).json()["doors"]
    assert [(d["name"], d["can_arm"]) for d in doors] == [("כניסה ראשית", False)], "only her station, and she may not open it herself"
    _bind(db, "eli", "operator")
    assert c.get(f"{API}/door-automations/doors", headers=as_user("eli")).status_code == 403
    assert c.get(f"{API}/door-automations/status", headers=as_user("eli")).json() == {"visible": False}


# ================================================================ arming: a human step

def test_arm_needs_a_confirmation_and_binds_the_revision_and_expiry(world):
    c = world["c"]
    da = _create(c).json()
    r = _arm(c, da, confirmed="yes")
    assert r.status_code == 409 and r.json()["code"] == "confirmation_required"
    r = _arm(c, {**da, "policy_revision": 7})
    assert r.status_code == 409 and r.json()["code"] == "door_automation_changed"
    r = _arm(c, da)
    assert r.status_code == 200, r.text
    armed = r.json()
    assert armed["state"] == "armed" and armed["armed_by"] == "dev-joni" and armed["bound_item_revision"] == "rev0000000000001"
    assert armed["armed_until"] == "2027-04-03T06:00:00Z", "180 days (the default setting) from the (fake) arming instant"
    assert [r["decision"] for r in audit_rows(world["db"], "door_automation.arm")] == ["denied", "denied", "allowed"]


def test_arm_needs_the_permission_and_the_door_rule_on_every_door(world):
    c, db = world["c"], world["db"]
    da = _create(c, policy={**POLICY, "doors": [{"station_id": ENTRY, "relay": 1}, {"station_id": DOCK, "relay": 2}]}).json()
    # dana may create (automation.manage) and holds the automation permission, but may open the entrance only
    role = _role(c, "עורך אוטומציות דלתות", [door_automation.AUTOMATE, "automation.manage"])
    _bind(db, "dana", role)
    _bind(db, "dana", "door_opener", STATION, ENTRY)
    r = _arm(c, da, user="dana")
    assert r.status_code == 403 and r.json()["details"]["reason"] == "door_not_allowed" and r.json()["details"]["door"] == "רציף", r.text
    _bind(db, "dana", "door_opener", STATION, DOCK)
    deny = _bind(db, "dana", role, STATION, DOCK, effect="deny")  # a deny of the automation permission on the dock wins
    r = _arm(c, da, user="dana")
    assert r.status_code == 403 and r.json()["details"]["reason"] == "automate_not_allowed", r.text
    with db.connection() as conn:
        conn.execute("UPDATE bindings SET revoked_at = ? WHERE id = ?", (now_iso(), deny))
    assert _arm(c, da, user="dana").status_code == 200


def test_arm_refuses_loop_risk_and_unresolvable_triggers(world):
    c = world["c"]
    for item, code in (("9002", "loop_risk"), ("9004", "loop_risk"), ("9003", "triggers_unresolvable")):
        da = _create(c, item=item).json()
        r = _arm(c, da)
        assert r.status_code == 409 and r.json()["code"] == code, (item, r.text)
    da = _create(c, item="9005").json()
    assert _arm(c, da).status_code == 200, "a time trigger cannot be caused by a door"


def test_arm_is_refused_while_the_kill_switch_is_on(world):
    c = world["c"]
    da = _create(c).json()
    assert c.put(f"{API}/door-automations/kill", json={"on": True, "confirmed": True}).status_code == 200
    r = _arm(c, da)
    assert r.status_code == 409 and r.json()["code"] == "door_automation_killed"


# ================================================================ the feature switch and the live sender

def test_feature_switch_cannot_be_turned_on_in_this_build(world):
    c = world["c"]
    assert door_automation.GO_LIVE_PERMITTED is False
    r = c.put(f"{API}/door-automations/settings", json={"feature": "on", "confirmed": True})
    assert r.status_code == 409 and r.json()["code"] == "door_automation_not_permitted", r.text
    st = c.get(f"{API}/door-automations/status").json()
    assert st["feature"] == "off" and st["go_live_permitted"] is False and st["available"] is False and st["killed"] is False
    assert c.put(f"{API}/door-automations/settings", json={"feature": "off", "confirmed": True}).status_code == 200
    out = door_automation.LiveSender().open(operator=door_automation.operator_of("x", "x"), station_id=ENTRY, relay=1, request_id="r", not_after=MONDAY_9)
    assert out == ("not_sent", "transport_not_selected")  # WISKEY-OWNER26-297: the Native sender, no direct connection selected here


def test_an_armed_block_with_the_feature_off_records_a_refusal_and_sends_nothing(world):
    c, sender = world["c"], world["sender"]
    da = _armed(c)
    out = fire(world)
    assert sender.calls == [] and out == [{"door": None, "outcome": "refused", "reason": "feature_off"}]
    rows = audit_rows(world["db"], "door_automation.fire")
    assert rows[-1]["decision"] == "denied" and rows[-1]["reason"] == "feature_off" and rows[-1]["actor_user_id"] == f"automation:{da['id']}"


def test_a_draft_or_an_unrelated_automation_is_silent(live):
    c, sender = live["c"], live["sender"]
    _create(c)
    assert fire(live) == [] and fire(live, item="9999") == [] and sender.calls == []
    assert audit_rows(live["db"], "door_automation.fire") == []


# ================================================================ the fire path

def test_a_fire_opens_through_the_sender_as_the_automation_with_both_audit_rows(live):
    c, sender, db = live["c"], live["sender"], live["db"]
    da = _armed(c)
    out = fire(live)
    assert [o["outcome"] for o in out] == ["sent"] and out[0]["door"] == "כניסה ראשית"
    assert len(sender.calls) == 1
    call = sender.calls[0]
    assert call["operator"] == door_automation.operator_of(da["id"], da["name"]) and call["station_id"] == ENTRY and call["relay"] == 1
    rows = audit_rows(db, "intercom.release")
    assert [r["details"]["phase"] for r in rows] == ["attempt", "outcome"]
    for r in rows:
        d = r["details"]
        assert r["actor_user_id"] == f"automation:{da['id']}" and r["actor_username"] == "automation"
        assert d["actor_kind"] == "automation" and d["automation_id"] == da["id"] and d["automation_item_id"] == "9001"
        assert d["entry_point"] == "door_job" and d["origin"] == "automation:9001" and d["armed_by"] == "dev-joni"
        assert d["item_revision"] == "rev0000000000001" and d["policy_revision"] == 1 and d["door_request_id"] == call["request_id"]
        assert d["trigger"] == {"source": "state of binary_sensor.lobby_motion", "time_fired": "2026-10-05T06:00:00+00:00"}
        assert not ({"signature", "nonce", "key", "body", "secret"} & set(d))
    assert rows[1]["details"]["outcome"] == "sent"
    fires = c.get(f"{API}/door-automations/{da['id']}/fires").json()["fires"]
    assert [f["outcome"] for f in fires] == ["sent"]


def test_every_gate_refuses_in_order_and_sends_nothing(live):
    c, sender, clock, db = live["c"], live["sender"], live["clock"], live["db"]
    da = _armed(c)
    # the kill switch (and a garbage value is a stop too)
    with db.connection() as conn:
        set_setting(conn, door_automation.KILL_KEY, "maybe")
    assert fire(live)[0]["reason"] == "killed"
    with db.connection() as conn:
        set_setting(conn, door_automation.KILL_KEY, "off")
    # a person ran it (a context user, or a manual run): never the automation path
    assert fire(live, user="0123456789abcdef0123456789abcdef")[0]["reason"] == "manual_trigger"
    assert fire(live, source="trigger action")[0]["reason"] == "manual_trigger"
    # outside the window (Monday 11:00 local), and on Saturday
    clock.advance(hours=2)
    assert fire(live)[0]["reason"] == "outside_window"
    clock.at = _dt.datetime(2026, 10, 10, 6, 0, tzinfo=_dt.timezone.utc)
    assert fire(live)[0]["reason"] == "outside_window"
    clock.at = MONDAY_9
    assert sender.calls == [] and state_of(c, da["id"])["state"] == "armed", "none of these disarm"
    # the automation changed in Home Assistant: refused and disarmed
    with db.connection() as conn:
        conn.execute("UPDATE ha_config_items SET revision = 'rev0000000000002' WHERE item_id = '9001'")
    assert fire(live)[0]["reason"] == "item_changed"
    st = state_of(c, da["id"])
    assert st["state"] == "disarmed" and st["disarm_reason"] == "item_changed"
    assert sender.calls == []
    assert [r["reason"] for r in audit_rows(db, "door_automation.auto_disarm")] == ["item_changed"]


def test_an_expired_arming_and_a_missing_automation_disarm(live):
    c, clock, db = live["c"], live["clock"], live["db"]
    da = _armed(c)
    clock.advance(days=180, seconds=1)
    assert fire(live)[0]["reason"] == "arm_expired" and state_of(c, da["id"])["disarm_reason"] == "arm_expired"
    clock.at = MONDAY_9
    da2 = _armed(c, item="9005")
    with db.connection() as conn:
        conn.execute("DELETE FROM ha_config_items WHERE item_id = '9005'")
    assert fire(live, item="9005") == [], "no mirror row: the event names no known automation"
    out = door_automation.handle_item_event(db, live["settings"], "9005", {"source": "time", "time_fired": "x"}, None)
    assert out[0]["reason"] == "item_missing" and state_of(c, da2["id"])["disarm_reason"] == "item_missing"
    assert live["sender"].calls == []


def test_the_armer_losing_the_right_disarms_at_the_next_fire(live):
    c, db, sender = live["c"], live["db"], live["sender"]
    role = _role(c, "עורך אוטומציות דלתות", [door_automation.AUTOMATE, "automation.manage", "access.doors.open"])
    bid = _bind(db, "dana", role)
    r = _create(c, user="dana")
    assert r.status_code == 201, r.text
    da = r.json()
    assert _arm(c, da, user="dana").status_code == 200
    with db.connection() as conn:
        conn.execute("UPDATE bindings SET revoked_at = ? WHERE id = ?", (now_iso(), bid))
    out = fire(live)
    assert out[0]["reason"] == "armer_lost_authority" and sender.calls == []
    assert state_of(c, da["id"])["disarm_reason"] == "armer_lost_authority"


def test_cooldown_caps_and_storm(live):
    c, clock, sender = live["c"], live["clock"], live["sender"]
    da = _armed(c, policy={**POLICY, "cooldown_s": 60, "max_per_hour": 2})
    assert fire(live)[0]["outcome"] == "sent"
    assert fire(live)[0]["reason"] == "cooldown"
    clock.advance(seconds=61)
    assert fire(live)[0]["outcome"] == "sent"
    clock.advance(seconds=61)
    assert fire(live)[0]["reason"] == "rate_hour"
    assert len(sender.calls) == 2
    for _ in range(3):
        clock.advance(seconds=61)
        assert fire(live)[0]["reason"] == "rate_hour"
    st = state_of(c, da["id"])
    assert st["state"] == "disarmed" and st["disarm_reason"] == "storm", "five cooldown / rate refusals in 10 minutes (the default setting)"
    assert fire(live) == [], "a disarmed block is silent"
    assert len(sender.calls) == 2


def test_the_daily_cap_counts_the_block(live):
    c, clock = live["c"], live["clock"]
    _armed(c, policy={**POLICY, "cooldown_s": 10, "max_per_hour": 30, "max_per_day": 2})
    assert fire(live)[0]["outcome"] == "sent"
    clock.advance(seconds=11)
    assert fire(live)[0]["outcome"] == "sent"
    clock.advance(seconds=11)
    assert fire(live)[0]["reason"] == "rate_day"


def test_never_retried_and_one_door_does_not_stop_the_next(live):
    c, sender, db = live["c"], live["sender"], live["db"]
    _armed(c, policy={**POLICY, "doors": [{"station_id": ENTRY, "relay": 1}, {"station_id": DOCK, "relay": 2}]})
    sender.outcomes = [("unknown", "timeout"), ("refused", "time/clock_invalid")]
    out = fire(live)
    assert [(o["door"], o["outcome"]) for o in out] == [("כניסה ראשית", "unknown"), ("רציף", "refused")]
    assert len(sender.calls) == 2, "each door once, never again"
    outcomes = [r["details"]["outcome"] for r in audit_rows(db, "intercom.release") if r["details"]["phase"] == "outcome"]
    assert outcomes == ["unknown", "refused"]
    assert fire(live)[0]["reason"] == "cooldown", "an unknown outcome counts: the door may have opened"


def test_a_door_that_left_the_wiskey_copy_is_refused(live, monkeypatch):
    c, sender = live["c"], live["sender"]
    _armed(c)
    FakeWisKeyFeed([station(ENTRY, "כניסה ראשית", online=False), station(DOCK, "רציף", relays=[1, 2])]).install(monkeypatch)
    assert fire(live)[0]["reason"] == "door_unavailable" and sender.calls == []


def test_the_sender_raising_is_recorded_unknown_and_never_retried(live):
    c, db = live["c"], live["db"]
    _armed(c)

    class Boom(FakeSender):
        def open(self, **kw: Any) -> tuple[str, str | None]:
            self.calls.append(kw)
            raise RuntimeError("transport")

    boom = Boom()
    door_automation.SENDER = boom
    out = fire(live)
    assert out[0]["outcome"] == "unknown" and len(boom.calls) == 1
    assert audit_rows(db, "intercom.release")[-1]["details"]["outcome"] == "unknown"


# ================================================================ kill switch, disarm, delete, simulation, audit, hook

def test_kill_switch_rights_stop_is_easy_restart_is_for_the_system_administrator(world):
    c, db = world["c"], world["db"]
    role = _role(c, "עוצר אוטומציות דלתות", [door_automation.AUTOMATE])
    _bind(db, "dana", role)
    _bind(db, "eli", "operator")
    assert c.put(f"{API}/door-automations/kill", json={"on": True, "confirmed": True}, headers=as_user("eli")).status_code == 403
    assert c.put(f"{API}/door-automations/kill", json={"on": True}, headers=as_user("dana")).json()["code"] == "confirmation_required"
    assert c.put(f"{API}/door-automations/kill", json={"on": True, "confirmed": True}, headers=as_user("dana")).status_code == 200
    r = c.put(f"{API}/door-automations/kill", json={"on": False, "confirmed": True}, headers=as_user("dana"))
    assert r.status_code == 403, "lifting the stop needs a system administrator"
    assert c.get(f"{API}/door-automations/status").json()["killed"] is True
    assert c.put(f"{API}/door-automations/kill", json={"on": False, "confirmed": True}).status_code == 200
    assert c.get(f"{API}/door-automations/status").json()["killed"] is False
    assert [r["decision"] for r in audit_rows(db, "door_automation.kill")] == ["denied", "denied", "allowed", "denied", "allowed"]


def test_disarm_is_always_allowed_to_a_holder_and_delete_disarms(world):
    c, db = world["c"], world["db"]
    da = _armed(c)
    role = _role(c, "עוצר אוטומציות דלתות", [door_automation.AUTOMATE])
    _bind(db, "dana", role)
    r = c.post(f"{API}/door-automations/{da['id']}/disarm", json={}, headers=as_user("dana"))
    assert r.status_code == 200 and r.json()["state"] == "disarmed" and r.json()["disarm_reason"] == "manual", r.text
    assert c.delete(f"{API}/door-automations/{da['id']}").status_code == 200
    assert c.get(f"{API}/door-automations/{da['id']}").status_code == 404
    assert c.get(f"{API}/door-automations").json()["items"] == []
    assert _create(c).status_code == 201, "a deleted block frees its automation"


def test_simulation_shows_every_gate_and_changes_nothing(world):
    c, db, sender = world["c"], world["db"], world["sender"]
    da = _armed(c)
    r = c.post(f"{API}/door-automations/{da['id']}/simulate", json={})
    assert r.status_code == 200, r.text
    sim = r.json()
    gates = {g["gate"]: g for g in sim["gates"]}
    assert gates["feature"]["ok"] is False and gates["feature"]["reason"] == "feature_off"
    assert gates["armed"]["ok"] and gates["window"]["ok"] and gates["revision"]["ok"] and gates["trigger"]["ok"]
    assert "corroboration" not in gates, "a simulation has no event to corroborate"
    assert sim["would_send"] is False and [d["decision"] for d in sim["doors"]] == ["would_open"]
    late = c.post(f"{API}/door-automations/{da['id']}/simulate", json={"at": "2026-10-05T09:00:00Z", "source": "trigger action"}).json()
    lg = {g["gate"]: g for g in late["gates"]}
    assert lg["window"]["reason"] == "outside_window" and lg["trigger"]["reason"] == "manual_trigger"
    assert sender.calls == [] and c.get(f"{API}/door-automations/{da['id']}/fires").json()["fires"] == []
    assert state_of(c, da["id"])["state"] == "armed"
    assert len(audit_rows(db, "door_automation.simulate")) == 2 and audit_rows(db, "intercom.release") == []


def test_the_access_audit_lists_the_automation_rows(live):
    c = live["c"]
    _armed(c)
    fire(live)
    rows = c.get(f"{API}/audit", params={"prefix": "intercom.", "actor_kind": "automation"}).json()["rows"]
    assert len(rows) == 2 and all(r["actor_user_id"].startswith("automation:") and r["details"]["actor_kind"] == "automation" for r in rows)
    assert c.get(f"{API}/audit", params={"prefix": "door_automation.", "actor_kind": "person"}).json()["rows"], "the person's own rows"
    assert all(not r["actor_user_id"].startswith("automation:") for r in c.get(f"{API}/audit", params={"prefix": "", "actor_kind": "person"}).json()["rows"] if r["actor_user_id"])


def test_the_mirror_hook_fires_and_never_raises(live, monkeypatch):
    from smplwise.services import automations

    c, sender = live["c"], live["sender"]
    _armed(c)
    monkeypatch.setattr(automations.MIRROR, "db", live["app"].state.db)  # restored after the test (the mirror is process-wide)
    monkeypatch.setattr(automations.MIRROR, "settings", live["settings"])
    corroborate(live)
    automations.MIRROR.on_ha_event(frame())
    assert len(sender.calls) == 1

    def explode(*_a: Any, **_k: Any) -> Any:
        raise RuntimeError("boom")

    monkeypatch.setattr(door_automation, "handle_trigger", explode)
    automations.MIRROR.on_ha_event(frame())  # the mirror keeps working


def test_the_window_rule_in_the_installation_zone():
    w = [{"days": [0], "start": "07:00", "end": "10:00"}, {"days": [6], "start": "00:00", "end": "24:00"}]
    tz = "Asia/Jerusalem"
    assert door_automation.in_window(w, MONDAY_9, tz)
    assert not door_automation.in_window(w, MONDAY_9 + _dt.timedelta(hours=1), tz), "10:00 is the end, exclusive"
    assert door_automation.in_window(w, _dt.datetime(2026, 10, 11, 20, 59, tzinfo=_dt.timezone.utc), tz), "Sunday 23:59 local"
    assert not door_automation.in_window(w, _dt.datetime(2026, 10, 11, 21, 0, tzinfo=_dt.timezone.utc), tz), "Monday 00:00 local"
    with pytest.raises(door_automation.ClockUntrusted):
        door_automation.in_window(w, MONDAY_9, "Mars/Olympus")


# ================================================================ owner decisions 2026-10-21

def test_whoever_creates_automations_may_arm_unless_removed_per_user_or_per_role(live):
    """Decision 1: automation.manage implies the right to arm (no access.doors.automate needed); an administrator removes it per
    person (whatever their roles) or per role; the arming person is still re-checked at every fire."""
    c, db, sender = live["c"], live["db"], live["sender"]
    _bind(db, "sara", "site_admin")
    assert c.get(f"{API}/door-automations/status", headers=as_user("sara")).json()["can_manage"] is True
    da = _create(c, user="sara").json()
    assert _arm(c, da, user="sara").status_code == 200
    assert fire(live)[0]["outcome"] == "sent"
    # removed per person: refused to arm, and the armed step stops at its next fire
    assert c.put(f"{API}/door-automations/users/dev-sara", json={"removed": True, "confirmed": True}, headers=as_user("sara")).status_code == 403
    r = c.put(f"{API}/door-automations/users/dev-sara", json={"removed": True, "confirmed": True})
    assert r.status_code == 200 and r.json() == {"user_id": "dev-sara", "removed": True}, r.text
    live["clock"].advance(seconds=11)
    assert fire(live)[0]["reason"] == "armer_lost_authority" and len(sender.calls) == 1
    assert c.get(f"{API}/door-automations/status", headers=as_user("sara")).json() == {"visible": False}
    assert c.put(f"{API}/door-automations/users/dev-sara", json={"removed": False, "confirmed": True}).status_code == 200
    assert _arm(c, state_of(c, da["id"]), user="sara").status_code == 200
    # removed per role: site_admin's automation.manage no longer implies arming; an explicit grant still does
    r = c.put(f"{API}/door-automations/settings", json={"excluded_roles": ["site_admin"], "confirmed": True})
    assert r.status_code == 200 and r.json()["excluded_roles"] == ["site_admin"], r.text
    assert c.get(f"{API}/door-automations/status", headers=as_user("sara")).json() == {"visible": False}
    role = _role(c, "חימוש דלתות", [door_automation.AUTOMATE])
    _bind(db, "sara", role)
    assert c.get(f"{API}/door-automations/status", headers=as_user("sara")).json()["can_manage"] is True
    # an explicit deny of the permission wins over the implied right
    _bind(db, "joni", role, effect="deny")
    with db.connection(mode="read") as conn:
        joni = Principal("dev-joni", "joni", "joni", "dev")
        assert door_automation.may_automate(conn, joni, ENTRY) is False


def test_every_limit_is_an_administrator_setting(live):
    c, db, clock = live["c"], live["db"], live["clock"]
    st = c.get(f"{API}/door-automations/status").json()
    assert st["limits"] == {"cooldown_s": 10, "max_per_hour": 30, "max_per_day": 300, "arm_days": 180, "storm_refusals": 5, "storm_window_s": 600,
                           "door_max_per_hour": 6, "door_max_per_day": 30, "corroborate_window_s": 10}
    _bind(db, "dana", "operator")
    assert c.put(f"{API}/door-automations/settings", json={"limits": {"cooldown_s": 120}, "confirmed": True}, headers=as_user("dana")).status_code == 403
    r = c.put(f"{API}/door-automations/settings", json={"limits": {"cooldown_s": 0}, "confirmed": True})
    assert r.status_code == 422 and r.json()["details"]["fields"] == ["limits"]
    r = c.put(f"{API}/door-automations/settings", json={"limits": {"cooldown_s": 120, "storm_refusals": 2}, "confirmed": True})
    assert r.status_code == 200 and r.json()["limits"]["cooldown_s"] == 120, r.text
    da = _armed(c)
    assert fire(live)[0]["outcome"] == "sent"
    clock.advance(seconds=60)
    assert fire(live)[0]["reason"] == "cooldown", "the installation's 120 s"
    clock.advance(seconds=1)
    assert fire(live)[0]["reason"] == "cooldown"
    assert state_of(c, da["id"])["disarm_reason"] == "storm", "the installation's storm setting (2)"
    with db.connection() as conn:
        set_setting(conn, "doors.automation.max_per_hour", "garbage")
        assert door_automation.limits(conn)["max_per_hour"] == 30, "garbage falls back to the default, never to no limit"


def test_a_step_without_time_windows_opens_any_time(live):
    c, clock = live["c"], live["clock"]
    _armed(c, policy={"doors": POLICY["doors"]})
    clock.at = _dt.datetime(2026, 10, 10, 0, 30, tzinfo=_dt.timezone.utc)  # Saturday 03:30 local
    assert fire(live)[0]["outcome"] == "sent"


# ================================================================ DOORHARD-295: Fable review section 5 + owner answers 2026-10-21

TWO_DOORS = {**POLICY, "doors": [{"station_id": ENTRY, "relay": 1}, {"station_id": DOCK, "relay": 2}]}


def _setting(db: Database, key: str, value: str) -> None:
    with db.connection() as conn:
        set_setting(conn, key, value)


# ---- A-01: the event alone is not evidence

def test_a_spoofed_event_without_a_person_is_refused_and_sends_nothing(live):
    """A-01: any integration or script in Home Assistant can fire `automation_triggered` with no user context. It used to pass every gate."""
    c, sender, db = live["c"], live["sender"], live["db"]
    da = _armed(c)
    out = fire(live, seed=False)
    assert out == [{"door": None, "outcome": "refused", "reason": "uncorroborated"}] and sender.calls == []
    row = audit_rows(db, "door_automation.fire")[-1]
    assert row["decision"] == "denied" and row["reason"] == "uncorroborated" and row["actor_user_id"] == f"automation:{da['id']}"
    assert fire(live)[0]["outcome"] == "sent" and len(sender.calls) == 1, "the same event with a real run behind it opens"


def test_uncorroborated_events_count_as_a_storm_and_disarm_the_block(live):
    c, sender = live["c"], live["sender"]
    da = _armed(c)
    for _ in range(5):
        assert fire(live, seed=False)[0]["reason"] == "uncorroborated"
    st = state_of(c, da["id"])
    assert st["state"] == "disarmed" and st["disarm_reason"] == "storm" and sender.calls == []
    assert "uncorroborated" in door_automation.STORM_REASONS


@pytest.mark.parametrize("offset", [-30, 30])
def test_a_stale_or_future_last_triggered_does_not_corroborate(live, offset):
    c, sender = live["c"], live["sender"]
    _armed(c)
    corroborate(live, offset_s=offset)
    assert fire(live, seed=False)[0]["reason"] == "uncorroborated" and sender.calls == []


def test_a_state_trigger_also_needs_the_watched_entity_to_have_changed(live):
    c, sender, db = live["c"], live["sender"], live["db"]
    _armed(c)  # 9001 watches binary_sensor.lobby_motion
    corroborate(live, change=False)  # the automation "ran" but its sensor never changed in the mirror
    assert fire(live, seed=False)[0]["reason"] == "uncorroborated"
    old = (live["clock"].at - _dt.timedelta(seconds=60)).isoformat()
    with db.connection() as conn:
        conn.execute("UPDATE ha_entities SET last_changed = ?, last_updated = ? WHERE entity_id = 'binary_sensor.lobby_motion'", (old, old))
    corroborate(live, change=False)
    assert fire(live, seed=False)[0]["reason"] == "uncorroborated", "a change older than the window is no corroboration"
    assert sender.calls == []
    corroborate(live)
    assert fire(live, seed=False)[0]["outcome"] == "sent"


def test_an_attribute_trigger_is_corroborated_by_the_update_not_the_state_change(live):
    c, db = live["c"], live["db"]
    _armed(c)
    _armed(c, item="9007")
    recent, old = live["clock"].at.isoformat(), (live["clock"].at - _dt.timedelta(seconds=60)).isoformat()
    with db.connection() as conn:  # only an attribute of the sensor moved
        conn.execute("UPDATE ha_entities SET last_changed = ?, last_updated = ? WHERE entity_id = 'binary_sensor.lobby_motion'", (old, recent))
    live["machine"]["binary_sensor.lobby_motion"] = {"last_changed": old, "last_updated": recent}
    corroborate(live, "9001", change=False)
    corroborate(live, "9007", change=False)
    assert fire(live, item="9001", seed=False)[0]["reason"] == "uncorroborated"
    assert fire(live, item="9007", seed=False)[0]["outcome"] == "sent"


def test_a_time_trigger_alongside_a_state_trigger_is_corroborated_by_the_run_alone(live):
    c = live["c"]
    _armed(c, item="9006")  # state OR time: Home Assistant does not say which one ran
    corroborate(live, "9006", change=False)
    assert fire(live, item="9006", seed=False)[0]["outcome"] == "sent"
    _armed(c, item="9005")  # time only: the run alone
    corroborate(live, "9005", change=False)
    assert fire(live, item="9005", seed=False, source="time")[0]["outcome"] == "sent"


def test_one_real_run_authorises_one_event_a_replay_is_refused(live):
    c, sender, clock, db = live["c"], live["sender"], live["clock"], live["db"]
    _setting(db, "doors.automation.corroborate_window_s", "60")
    _armed(c)
    corroborate(live)
    assert fire(live, seed=False)[0]["outcome"] == "sent"
    clock.advance(seconds=11)  # past the cooldown, still inside the (widened) window: the same run cannot be matched twice
    assert fire(live, seed=False)[0]["reason"] == "uncorroborated"
    corroborate(live)  # a new run
    assert fire(live, seed=False)[0]["outcome"] == "sent" and len(sender.calls) == 2


def test_unreadable_mirror_data_fails_closed(live):
    c, db, sender = live["c"], live["db"], live["sender"]
    _armed(c)
    corroborate(live)
    with db.connection() as conn:
        conn.execute("UPDATE ha_entities SET attributes_json = 'not json' WHERE entity_id = 'automation.a_9001'")
    assert fire(live, seed=False)[0]["reason"] == "uncorroborated"
    with db.connection() as conn:
        conn.execute("UPDATE ha_entities SET attributes_json = ? WHERE entity_id = 'automation.a_9001'", (json.dumps({"last_triggered": "yesterday"}),))
    assert fire(live, seed=False)[0]["reason"] == "uncorroborated"
    with db.connection() as conn:
        conn.execute("DELETE FROM ha_entities WHERE entity_id = 'automation.a_9001'")
    assert fire(live, seed=False)[0]["reason"] == "uncorroborated" and sender.calls == []


def test_the_event_may_arrive_before_the_state_frame(live, monkeypatch):
    """The wait: an event that fails only the corroboration is re-checked for a few seconds; the state frame lands meanwhile."""
    import time

    c, sender = live["c"], live["sender"]
    _armed(c)
    monkeypatch.setattr(door_automation, "CORROBORATE_WAIT_S", 2.0)
    slept: list[float] = []

    def sleep(seconds: float) -> None:
        slept.append(seconds)
        corroborate(live)  # the mirror receives the automation's state frame while Arx waits

    monkeypatch.setattr(door_automation, "_sleep", sleep)
    assert fire(live, seed=False)[0]["outcome"] == "sent" and len(slept) == 1 and len(sender.calls) == 1
    # no state frame ever: refused after the wait, recorded once
    monkeypatch.setattr(door_automation, "CORROBORATE_WAIT_S", 0.2)
    monkeypatch.setattr(door_automation, "_sleep", lambda _s: time.sleep(0.05))
    live["clock"].advance(seconds=11)
    before = len(audit_rows(live["db"], "door_automation.fire"))
    assert fire(live, seed=False)[0]["reason"] == "uncorroborated" and len(sender.calls) == 1
    assert len(audit_rows(live["db"], "door_automation.fire")) == before + 1


# ---- A-02: the switches are read again inside the per-door transaction

def test_the_kill_switch_set_while_the_first_door_is_sent_stops_the_second(live):
    c, db = live["c"], live["db"]
    _armed(c, policy=TWO_DOORS)

    class KillOnSend(FakeSender):
        def open(self, **kw: Any) -> tuple[str, str | None]:
            with db.connection() as conn:  # the send runs outside any transaction: an administrator stops everything now
                set_setting(conn, door_automation.KILL_KEY, "on")
            return super().open(**kw)

    sender = KillOnSend()
    door_automation.SENDER = sender
    out = fire(live)
    assert [(o["door"], o["outcome"], o.get("reason")) for o in out] == [("כניסה ראשית", "sent", None), ("רציף", "refused", "killed")]
    assert len(sender.calls) == 1


def test_the_feature_switch_and_the_expiry_are_read_again_per_door(live):
    c, db, clock, sender = live["c"], live["db"], live["clock"], live["sender"]
    da = _armed(c)
    door, trigger, dev = POLICY["doors"][0], {"source": "state", "time_fired": None}, bool(live["settings"].dev_user)
    _setting(db, door_automation.FLAG_KEY, "off")
    assert door_automation._fire_door(db, da["id"], door, trigger, dev)["reason"] == "feature_off"
    _setting(db, door_automation.FLAG_KEY, "on")
    clock.advance(days=181)
    out = door_automation._fire_door(db, da["id"], door, trigger, dev)
    assert out["reason"] == "arm_expired" and state_of(c, da["id"])["disarm_reason"] == "arm_expired" and sender.calls == []


# ---- A-03: the per-door cap across every block

def test_a_door_has_one_installation_wide_cap_across_all_blocks(live):
    c, clock, sender = live["c"], live["clock"], live["sender"]
    assert (door_automation.DOOR_DEFAULTS["door_max_per_hour"], door_automation.DOOR_DEFAULTS["door_max_per_day"]) == (6, 30)
    _armed(c, item="9001")
    _armed(c, item="9005")  # a second block on the SAME door
    for _ in range(3):
        assert fire(live, item="9001")[0]["outcome"] == "sent"
        assert fire(live, item="9005", source="time")[0]["outcome"] == "sent"
        clock.advance(seconds=11)
    assert len(sender.calls) == 6
    assert fire(live, item="9001")[0]["reason"] == "door_rate_hour", "6 an hour on the door, whichever block asks"
    assert fire(live, item="9005", source="time")[0]["reason"] == "door_rate_hour"
    assert len(sender.calls) == 6
    assert "door_rate_hour" in door_automation.STORM_REASONS and "door_rate_day" in door_automation.STORM_REASONS


def test_the_door_day_cap_and_both_caps_are_administrator_settings(live):
    c, clock, db = live["c"], live["clock"], live["db"]
    bad = c.put(f"{API}/door-automations/settings", json={"limits": {"door_max_per_hour": 0}, "confirmed": True})
    assert bad.status_code == 422 and bad.json()["details"]["fields"] == ["limits"]
    r = c.put(f"{API}/door-automations/settings", json={"limits": {"door_max_per_hour": 50, "door_max_per_day": 2, "corroborate_window_s": 20}, "confirmed": True})
    assert r.status_code == 200 and r.json()["limits"]["door_max_per_day"] == 2 and r.json()["limits"]["corroborate_window_s"] == 20, r.text
    _armed(c)
    assert fire(live)[0]["outcome"] == "sent"
    clock.advance(seconds=11)
    assert fire(live)[0]["outcome"] == "sent"
    clock.advance(seconds=11)
    assert fire(live)[0]["reason"] == "door_rate_day"
    with db.connection() as conn:
        set_setting(conn, "doors.automation.door_max_per_day", "garbage")
        assert door_automation.limits(conn)["door_max_per_day"] == 30, "garbage falls back to the default, never to no limit"


def test_a_deleted_blocks_fires_still_count_for_the_door(live):
    c, clock, sender = live["c"], live["clock"], live["sender"]
    _setting(live["db"], "doors.automation.door_max_per_day", "2")
    da = _armed(c)
    assert fire(live)[0]["outcome"] == "sent"
    clock.advance(seconds=11)
    assert fire(live)[0]["outcome"] == "sent"
    assert c.delete(f"{API}/door-automations/{da['id']}").status_code == 200
    _armed(c)  # delete and recreate does not give the door a fresh budget
    clock.advance(seconds=11)
    assert fire(live)[0]["reason"] == "door_rate_day" and len(sender.calls) == 2


# ---- A-04: manual detection by context, and an allow-list of automatic sources

@pytest.mark.parametrize("source, user, parent, manual", [
    ("state of binary_sensor.lobby_motion", None, None, False),
    ("numeric state of sensor.temp", None, None, False),
    ("time pattern", None, None, False),
    ("time", None, None, False),
    ("sun", None, None, False),
    ("state of binary_sensor.lobby_motion", "0123456789abcdef0123456789abcdef", None, True),  # a person's context
    ("state of binary_sensor.lobby_motion", None, "01JPARENT", False),  # owner 2026-10-21: a parent context is normal for a run, not refused
    ("trigger action", None, None, True),
    ("manual", None, None, True),
    ("Trigger Action", None, None, True),
    ("", None, None, True),  # unknown wording fails closed
    ("something new in a later Home Assistant", None, None, False),  # owner 2026-10-21: unfamiliar wording is not refused
])
def test_manual_detection_is_a_persons_context_or_a_manual_run(source, user, parent, manual):
    ctx = {"user_id": user, "parent_id": parent}
    assert door_automation.is_manual({"source": source}, ctx) is manual
    if user:
        assert door_automation.is_manual({"source": source}, user) is True, "a bare user id (older callers) still counts"


def test_a_parent_context_fires_when_corroborated_and_is_kept_in_the_audit(live):
    """Owner decision 2026-10-21: a run with a parent context (the usual case in Home Assistant) is not refused; corroboration decides.
    An empty source is still a manual run."""
    c, sender, clock = live["c"], live["sender"], live["clock"]
    _armed(c)
    corroborate(live)
    f = frame()
    f["event"]["context"]["parent_id"] = "01JPARENT"
    assert door_automation.handle_trigger(live["db"], live["settings"], f)[0]["outcome"] == "sent"
    attempt = [r for r in audit_rows(live["db"], "intercom.release") if r["details"]["phase"] == "attempt"][-1]
    assert attempt["details"]["trigger"]["parent_context"] == "01JPARENT"
    clock.advance(seconds=11)
    assert fire(live, source="")[0]["reason"] == "manual_trigger"
    assert len(sender.calls) == 1


# ---- A-09: one bounded queue, one worker, a dropped counter

def test_events_go_through_one_bounded_queue_and_a_full_queue_counts_drops(live, monkeypatch):
    import queue
    import threading
    import time

    db, settings, c = live["db"], live["settings"], live["c"]
    door_automation.DISPATCH = None
    handled: list[int] = []
    threads: set[int] = set()
    started, gate = threading.Event(), threading.Event()

    def slow_handle(_db: Any, _settings: Any, frm: Any, **_kw: Any) -> list[Any]:
        started.set()
        gate.wait(10)
        handled.append(frm["n"])
        threads.add(threading.get_ident())
        return []

    monkeypatch.setattr(door_automation, "handle_trigger", slow_handle)
    monkeypatch.setattr(door_automation, "_QUEUE", queue.Queue(maxsize=3))
    monkeypatch.setattr(door_automation, "_WORKER", None)
    door_automation.on_event(db, settings, {"n": 0})
    assert started.wait(5), "the worker took the first event"
    before = threading.active_count()
    for n in range(1, 10):
        door_automation.on_event(db, settings, {"n": n})
    assert threading.active_count() == before, "no thread per event"
    assert door_automation.STATS["dropped"] == 6, "1 in hand + 3 queued, the other 6 dropped and counted"
    assert c.get(f"{API}/door-automations/status").json()["dropped_events"] == 6
    gate.set()
    for _ in range(100):
        if len(handled) == 4:
            break
        time.sleep(0.05)
    assert handled == [0, 1, 2, 3] and len(threads) == 1, "in order, by one worker"


def test_on_event_without_a_database_or_with_a_failing_dispatch_never_raises(live):
    door_automation.on_event(None, live["settings"], frame())

    def broken(_fn: Any) -> None:
        raise RuntimeError("no queue")

    door_automation.DISPATCH = broken
    door_automation.on_event(live["db"], live["settings"], frame())


# ---- A-10: DST

def test_dst_edges_are_safe_and_documented():
    tz = "Asia/Jerusalem"

    def minutes_in(windows: list[dict[str, Any]], day_start_utc: _dt.datetime) -> int:
        return sum(1 for m in range(24 * 60) if door_automation.in_window(windows, day_start_utc + _dt.timedelta(minutes=m), tz))

    # spring forward (Friday 2026-03-27, 02:00 -> 03:00): a window inside the skipped hour never matches that day
    skipped = [{"days": [4], "start": "02:15", "end": "02:45"}]
    assert minutes_in(skipped, _dt.datetime(2026, 3, 26, 21, 0, tzinfo=_dt.timezone.utc)) == 0
    # fall back (Sunday 2026-10-25, 02:00 -> 01:00): a window inside the repeated hour is open in BOTH passes (documented)
    repeated = [{"days": [6], "start": "01:15", "end": "01:45"}]
    assert minutes_in(repeated, _dt.datetime(2026, 10, 24, 21, 0, tzinfo=_dt.timezone.utc)) == 60, "30 minutes twice"
    assert "DST" in (door_automation.in_window.__doc__ or "")


# ---- CR 12.1: the operator AND the approving person are stored

def test_every_decision_stores_the_operator_and_the_armer(live):
    c, db = live["c"], live["db"]
    da = _armed(c)
    assert state_of(c, da["id"])["operator_id"] == f"automation:{da['id']}"
    assert fire(live, seed=False)[0]["reason"] == "uncorroborated"
    assert fire(live)[0]["outcome"] == "sent"
    with db.connection(mode="read") as conn:
        rows = conn.execute("SELECT attempted, reason, operator_id, armed_by, armed_by_name FROM door_automation_fires ORDER BY rowid").fetchall()
    assert len(rows) == 2
    for r in rows:
        assert r["operator_id"] == f"automation:{da['id']}" and r["armed_by"] == "dev-joni" and r["armed_by_name"]
    fires = c.get(f"{API}/door-automations/{da['id']}/fires").json()["fires"]
    assert all(f["operator_id"] == f"automation:{da['id']}" and f["armed_by"] == "dev-joni" for f in fires)
    for rr in audit_rows(db, "intercom.release"):
        d = rr["details"]
        assert rr["actor_user_id"] == f"automation:{da['id']}" and d["operator_id"] == f"automation:{da['id']}" and d["armed_by"] == "dev-joni" and d["armed_by_name"]


# ---- CR 12.3: backup / restore brings blocks back disarmed

def test_a_restore_brings_every_block_back_disarmed_and_never_the_fire_history(live):
    import io
    import zipfile

    from smplwise.db import get_setting
    from smplwise.services import backup

    c, db = live["c"], live["db"]
    assert "door_automations" in backup.PROJECT_TABLES and "door_automation_fires" in backup.NEVER_EXPORTED_TABLES
    assert "door_automation_fires" not in backup.PROJECT_TABLES + backup.ACCESS_TABLES
    da = _armed(c)
    other = _create(c, item="9005").json()  # a draft stays a draft
    assert fire(live)[0]["outcome"] == "sent"
    e = c.post(f"{API}/backups", json={"note": "doors"}).json()
    assert e["tables"]["door_automations"] == 2 and "door_automation_fires" not in e["tables"]
    raw = c.get(f"{API}/backups/{e['name']}/download").content
    with zipfile.ZipFile(io.BytesIO(raw)) as z:
        assert "data/door_automations.json" in z.namelist() and "data/door_automation_fires.json" not in z.namelist()
        rows = json.loads(z.read("data/door_automations.json"))
    assert {r["id"]: r["state"] for r in rows} == {da["id"]: "armed", other["id"]: "draft"}, "the archive says what the block was"
    # tamper with the archive: an armed block with a bad policy is dropped, a valid armed one is disarmed whatever it says
    bad = {**rows[0], "id": "da_" + "b" * 32, "automation_item_id": "9006", "state": "armed", "policy_json": json.dumps({"doors": []})}
    patched = io.BytesIO()
    with zipfile.ZipFile(io.BytesIO(raw)) as zin, zipfile.ZipFile(patched, "w") as zout:
        for n in zin.namelist():
            zout.writestr(n, json.dumps([*rows, bad]) if n == "data/door_automations.json" else zin.read(n))
    up = c.post(f"{API}/backups/upload", files={"file": ("doors.zip", patched.getvalue(), "application/zip")})
    assert up.status_code == 201, up.text
    res = c.post(f"{API}/backups/{up.json()['name']}/restore", json={"mode": "replace", "scope": "project", "confirm": "RESTORE"})
    assert res.status_code == 200, res.text
    assert res.json()["door_automations"] == {"disarmed": 1, "dropped": 1}
    by_id = {b["id"]: b for b in c.get(f"{API}/door-automations").json()["items"]}
    assert set(by_id) == {da["id"], other["id"]}
    assert by_id[da["id"]]["state"] == "disarmed" and by_id[da["id"]]["disarm_reason"] == "restored" and by_id[da["id"]]["armed_until"] is None
    assert by_id[other["id"]]["state"] == "draft"
    assert fire(live) == [], "a restored block is silent until a person arms it again"
    with db.connection(mode="read") as conn:
        assert get_setting(conn, door_automation.FLAG_KEY) == "on", "the doors.* switches are never touched by a restore"
    assert _arm(c, by_id[da["id"]]).status_code == 200, "a person arms it again (the arming checks run again)"


def test_an_older_archive_without_the_table_keeps_the_blocks_but_disarms_them(live):
    import io
    import zipfile

    c = live["c"]
    da = _armed(c)
    e = c.post(f"{API}/backups", json={}).json()
    raw = c.get(f"{API}/backups/{e['name']}/download").content
    old = io.BytesIO()
    with zipfile.ZipFile(io.BytesIO(raw)) as zin, zipfile.ZipFile(old, "w") as zout:
        for n in zin.namelist():
            if n != "data/door_automations.json":
                zout.writestr(n, zin.read(n))
    up = c.post(f"{API}/backups/upload", files={"file": ("old.zip", old.getvalue(), "application/zip")})
    res = c.post(f"{API}/backups/{up.json()['name']}/restore", json={"mode": "replace", "scope": "project", "confirm": "RESTORE"})
    assert res.status_code == 200 and "door_automations" in res.json()["kept_current"], res.text
    assert state_of(c, da["id"])["state"] == "disarmed" and state_of(c, da["id"])["disarm_reason"] == "restored"


# ---- CR 12.4: automation.manage at the installation AND at a floor

def test_automation_manage_at_a_floor_reaches_only_the_automations_on_that_floor(live):
    c, db = live["c"], live["db"]
    ids = seed_tree(c)
    place(c, ids["floor2"], "light.lobby", "binary_sensor.lobby_motion")
    with db.connection() as conn:
        conn.execute("INSERT INTO ha_entities(entity_id, domain, name, platform, state, state_seen_at, first_seen_at, updated_at) VALUES ('light.garage','light','garage','zha','off',?,?,?)",
                     (now_iso(), now_iso(), now_iso()))
        _item(conn, "9101", "חצר", [{"trigger": "time", "at": "08:00:00"}], target="light.garage")  # not on dana's floor
    role = _role(c, "עורך קומה", ["automation.manage"], ["entity.state.read", "devices.read"])
    _bind(db, "dana", role, "floor", ids["floor2"])
    _bind(db, "dana", "door_opener", STATION, ENTRY)  # she may open the entrance herself, not the dock
    mine = {"headers": as_user("dana")}
    st = c.get(f"{API}/door-automations/status", **mine).json()
    assert st["visible"] is True and st["can_manage"] is True, "the implied right of automation.manage counts at a floor too"
    # her own automation: created and armed
    r = _create(c, user="dana")
    assert r.status_code == 201, r.text
    # an automation outside her floor: refused (the floor is the limit)
    r2 = _create(c, item="9101", user="dana", name="חצר", policy={"doors": POLICY["doors"]})
    assert r2.status_code == 403 and r2.json()["details"]["permission"] == "automation.manage", r2.text
    da = r.json()
    assert _arm(c, da, user="dana").status_code == 200
    # the door rule still applies: she cannot give the automation a door she may not open
    dock = _create(c, item="9006", user="dana", policy={**POLICY, "doors": [{"station_id": DOCK, "relay": 2}]})
    assert dock.status_code == 201, dock.text
    refused = _arm(c, dock.json(), user="dana")
    assert refused.status_code == 403 and refused.json()["details"]["reason"] == "door_not_allowed", refused.text
    # the picker shows her only what she may open
    assert [d["name"] for d in c.get(f"{API}/door-automations/doors", **mine).json()["doors"]] == ["כניסה ראשית"]
    # the arming person is re-checked at every fire, including that the automation is still on her floor
    assert fire(live)[0]["outcome"] == "sent"
    with db.connection() as conn:
        conn.execute("DELETE FROM map_anchors WHERE resource_id = 'light.lobby'")
    live["clock"].advance(seconds=11)
    assert fire(live)[0]["reason"] == "armer_lost_authority"
    # an installation-wide deny of automation.manage takes the floor away too (deny wins)
    _bind(db, "dana", "site_admin", effect="deny")
    assert c.get(f"{API}/door-automations/status", **mine).json() == {"visible": False}


def test_manage_reach_names_the_scope_and_never_lets_the_operator_in(live):
    db = live["db"]
    with db.connection(mode="read") as conn:
        joni = Principal("dev-joni", "joni", "joni", "dev")
        assert door_automation.manage_reach(conn, joni) == "installation"
        assert door_automation.manage_reach(conn, door_automation.operator_of("x", "x")) is None
        assert door_automation.manage_reach(conn, Principal("dev-nobody", "nobody", "nobody", "dev")) is None


# ---- DA-01 (Fable review 2): one direct read of Home Assistant's state machine at decision time

def test_a_forged_mirror_without_a_real_run_in_the_state_machine_never_opens(live):
    """The attacker of A-01 can fire `state_changed` too, so the mirror alone is not evidence: the run must be in Home Assistant's state machine."""
    c, sender, db, clock = live["c"], live["sender"], live["db"], live["clock"]
    _armed(c)
    corroborate(live)
    live["machine"].clear()  # the mirror says it ran; the state machine does not know the automation
    assert fire(live, seed=False)[0]["reason"] == "uncorroborated"
    live["machine"]["automation.a_9001"] = {"attributes": {"last_triggered": (clock.at - _dt.timedelta(hours=2)).isoformat()}}  # an old run
    assert fire(live, seed=False)[0]["reason"] == "uncorroborated"
    live["machine"]["automation.a_9001"] = {"attributes": {"last_triggered": "garbage"}}
    assert fire(live, seed=False)[0]["reason"] == "uncorroborated"
    assert sender.calls == []
    reads_before = len(live["reads"])
    assert fire(live)[0]["outcome"] == "sent"  # a real run: mirror AND state machine
    assert live["reads"][reads_before:] == ["automation.a_9001", "binary_sensor.lobby_motion"], "one direct read of the automation, one of the first watched entity (DA-06)"


def test_a_failing_state_read_refuses(live):
    c, sender = live["c"], live["sender"]
    _armed(c)

    def boom(_s: Any, _e: str) -> Any:
        raise RuntimeError("Home Assistant unreachable")

    door_automation.STATE_READER = boom
    assert fire(live)[0]["reason"] == "uncorroborated" and sender.calls == []


def test_one_state_machine_run_opens_once_even_for_two_events(live):
    c, sender = live["c"], live["sender"]
    _armed(c)
    corroborate(live)
    assert door_automation.handle_trigger(live["db"], live["settings"], frame())[0]["outcome"] == "sent"
    live["clock"].advance(seconds=11)
    # a second event for the SAME run (no new run in the state machine): a replay, refused
    assert door_automation.handle_trigger(live["db"], live["settings"], frame())[0]["reason"] == "uncorroborated"
    assert fire(live)[0]["outcome"] == "sent", "a later real run opens again"
    assert len(sender.calls) == 2


def test_a_replace_restore_keeps_the_fire_history(live):
    """Owner decision 2026-10-21: a replace restore brings the blocks back disarmed but does not wipe the history an administrator reads, nor the
    counters the per-door cap and the cooldown use; a block the archive does not have keeps its history as a deleted record."""
    c = live["c"]
    da = _armed(c)
    assert fire(live)[0]["outcome"] == "sent"
    e = c.post(f"{API}/backups", json={}).json()
    gone = _create(c, item="9005").json()
    with live["db"].connection() as conn:  # a decision of a block the archive does not have
        conn.execute("INSERT INTO door_automation_fires(id, automation_id, door_key, at, attempted, outcome, reason) VALUES ('f-gone', ?, ?, ?, 0, 'refused', 'cooldown')",
                     (gone["id"], f"{ENTRY}#1", door_automation.iso(live["clock"].at)))
    res = c.post(f"{API}/backups/{e['name']}/restore", json={"mode": "replace", "scope": "project", "confirm": "RESTORE"})
    assert res.status_code == 200, res.text
    assert state_of(c, da["id"])["state"] == "disarmed" and state_of(c, da["id"])["disarm_reason"] == "restored"
    assert [f["outcome"] for f in c.get(f"{API}/door-automations/{da['id']}/fires").json()["fires"]] == ["sent"]
    with live["db"].connection(mode="read") as conn:
        assert conn.execute("SELECT COUNT(*) FROM door_automation_fires WHERE id = 'f-gone'").fetchone()[0] == 1
        tomb = conn.execute("SELECT state, deleted_at FROM door_automations WHERE id = ?", (gone["id"],)).fetchone()
    assert tomb["state"] != "armed" and tomb["deleted_at"], "kept only as a deleted record"
    assert _arm(c, state_of(c, da["id"])).status_code == 200
    assert fire(live)[0]["reason"] == "cooldown", "the restored block still sees its own last opening"


# ---- DA-06 (Fable review 3, F3C-295): the watched entity is corroborated against Home Assistant's state machine too

def test_a_forged_mirror_change_of_the_watched_entity_alone_never_opens(live):
    c, sender = live["c"], live["sender"]
    _armed(c)
    corroborate(live)  # mirror AND state machine: a real run and a real change
    live["machine"].pop("binary_sensor.lobby_motion")  # the state machine never saw the sensor change; only the mirror was forged
    assert fire(live, seed=False)[0]["reason"] == "uncorroborated" and sender.calls == []


def test_a_stale_or_unreadable_watched_state_refuses_and_a_fresh_one_opens(live):
    c, sender, clock = live["c"], live["sender"], live["clock"]
    _armed(c)
    old = (clock.at - _dt.timedelta(seconds=60)).isoformat()
    corroborate(live)
    live["machine"]["binary_sensor.lobby_motion"] = {"last_changed": old, "last_updated": old}
    assert fire(live, seed=False)[0]["reason"] == "uncorroborated"
    corroborate(live)
    live["machine"]["binary_sensor.lobby_motion"] = {"last_changed": "garbage"}
    assert fire(live, seed=False)[0]["reason"] == "uncorroborated" and sender.calls == []
    corroborate(live)
    assert fire(live, seed=False)[0]["outcome"] == "sent"


def test_a_failing_watched_read_refuses(live):
    c, sender = live["c"], live["sender"]
    _armed(c)
    corroborate(live)
    base = door_automation.STATE_READER

    def only_the_automation(s_: Any, eid: str) -> Any:
        if eid.startswith("binary_sensor."):
            raise RuntimeError("Home Assistant unreachable")
        return base(s_, eid)

    door_automation.STATE_READER = only_the_automation
    assert fire(live, seed=False)[0]["reason"] == "uncorroborated" and sender.calls == []


def test_a_time_only_automation_reads_no_watched_entity(live):
    c = live["c"]
    _armed(c, item="9005")
    corroborate(live, "9005", change=False)
    before = len(live["reads"])
    assert fire(live, item="9005", seed=False, source="time")[0]["outcome"] == "sent"
    assert live["reads"][before:] == ["automation.a_9005"]


# ---- Fable review 2: DA-02, DA-03, DA-04

def test_da02_no_corroboration_wait_while_other_events_queue_behind(live, monkeypatch):
    """A burst of forged events must not hold the one worker CORROBORATE_WAIT_S per event: with a backlog the event is refused at once."""
    import queue

    c, sender = live["c"], live["sender"]
    _armed(c)
    monkeypatch.setattr(door_automation, "CORROBORATE_WAIT_S", 2.0)
    slept: list[float] = []
    monkeypatch.setattr(door_automation, "_sleep", lambda s: slept.append(s))
    backlog: queue.Queue[Any] = queue.Queue()
    for _ in range(door_automation.CORROBORATE_WAIT_MAX_QUEUED + 1):
        backlog.put_nowait(lambda: None)
    monkeypatch.setattr(door_automation, "_QUEUE", backlog)
    assert fire(live, seed=False)[0]["reason"] == "uncorroborated"
    assert slept == [] and sender.calls == [], "refused without waiting"
    # an idle queue still waits (the state frame may be late), as before
    monkeypatch.setattr(door_automation, "_QUEUE", queue.Queue())

    def late_frame(seconds: float) -> None:
        slept.append(seconds)
        corroborate(live)

    monkeypatch.setattr(door_automation, "_sleep", late_frame)
    live["clock"].advance(seconds=11)
    assert fire(live, seed=False)[0]["outcome"] == "sent" and len(slept) == 1


def test_da03_the_corroboration_wait_reads_and_writes_once(live, monkeypatch):
    """The re-check loop holds no write transaction: every pass reads; the single write is the decision after the loop."""
    import contextlib

    c, db = live["c"], live["db"]
    _armed(c)
    monkeypatch.setattr(door_automation, "CORROBORATE_WAIT_S", 2.0)
    monkeypatch.setattr(door_automation, "CORROBORATE_POLL_S", 0.25)  # exact in binary: the pass count below is exact
    t = [0.0]
    monkeypatch.setattr(door_automation, "_monotonic", lambda: t[0])

    def tick(seconds: float) -> None:
        t[0] += seconds

    monkeypatch.setattr(door_automation, "_sleep", tick)
    opened: list[tuple[str, str]] = []
    real = db.connection

    @contextlib.contextmanager
    def spy(*a: Any, **kw: Any):
        opened.append((kw.get("mode", "write"), kw.get("label", "")))
        with real(*a, **kw) as conn:
            yield conn

    monkeypatch.setattr(db, "connection", spy)
    assert fire(live, seed=False)[0]["reason"] == "uncorroborated"
    gates = [m for m, label in opened if label == "door automation gates"]
    writes = [label for m, label in opened if m != "read"]
    assert len(gates) == 9 and set(gates) == {"read"}, opened  # the passes at 0, 0.25 ... 2.0 s
    assert writes == ["door automation decide run"], opened


def test_da04_corroboration_is_measured_from_receipt_not_from_the_dequeue(live):
    """A real run that waited in the queue longer than corroborate_window_s is still matched: the window counts from when Arx received
    the event (its own clock), not from when the worker took it."""
    c, sender, clock = live["c"], live["sender"], live["clock"]
    _armed(c)
    jobs: list[Any] = []
    door_automation.DISPATCH = jobs.append
    corroborate(live)
    door_automation.on_event(live["db"], live["settings"], frame())  # received now
    window = door_automation.DOOR_DEFAULTS["corroborate_window_s"]
    clock.advance(seconds=window + 5)  # the worker was busy
    jobs.pop()()
    assert len(sender.calls) == 1, "matched with the receipt time"
    # the same delay measured from the dequeue (no receipt time) is refused: the old behaviour, still the fallback
    clock.advance(seconds=11)
    corroborate(live)
    clock.advance(seconds=window + 5)
    assert door_automation.handle_trigger(live["db"], live["settings"], frame())[0]["reason"] == "uncorroborated"
    clock.advance(seconds=11)
    corroborate(live)
    received = door_automation.now()
    clock.advance(seconds=window + 5)
    assert door_automation.handle_trigger(live["db"], live["settings"], frame(), received_at=received)[0]["outcome"] == "sent"
    # a receipt time in the future is never believed (it can only come from a bug): the decision time is used
    clock.advance(seconds=11)
    corroborate(live)
    future = door_automation.now() + _dt.timedelta(seconds=window + 30)
    assert door_automation.handle_trigger(live["db"], live["settings"], frame(), received_at=future)[0]["outcome"] == "sent"
    assert len(sender.calls) == 3
