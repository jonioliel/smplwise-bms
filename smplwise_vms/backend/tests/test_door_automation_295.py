"""CR-AUTODOORS-295: automations that open WisKey doors - the Arx side, on fakes only.

Proven here (no Home Assistant, bridge, WisKey, door or key is contacted; the sender is a recording fake):
- the automation operator is its own principal type: never a human, refused by the human door rule, holds no binding;
- `access.doors.automate`: sensitive, built-in holder system_admin only, labelled, station-carriable;
- the block (policy) is validated on the server with safe defaults; an edit disarms;
- arming is a human step: confirmation, the permission and the one door rule on every door, loop protection, the kill switch;
- the fire path: every gate in order (feature, kill switch, expiry, autonomous trigger only, revision binding, window, armer's
  authority, cooldown, caps, storm), the two audit rows as an automation, never retried, one door's failure not stopping the next;
- the feature switch cannot be turned on in this build (GO_LIVE_PERMITTED is False) and the live sender refuses;
- simulation is side-effect free; the access audit lists the automation rows; the mirror hook never raises."""
from __future__ import annotations

import datetime as _dt
import json
from typing import Any

import pytest
from conftest import as_user
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


def _item(conn: Any, item_id: str, alias: str, triggers: list[dict[str, Any]], revision: str = "rev0000000000001") -> None:
    cfg = {"id": item_id, "alias": alias, "triggers": triggers, "conditions": [], "actions": [{"action": "light.turn_on", "target": {"entity_id": "light.lobby"}}], "mode": "single"}
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
    feed = FakeWisKeyFeed([station(ENTRY, "כניסה ראשית"), station(DOCK, "רציף", relays=[1, 2])]).install(monkeypatch)
    app = create_app(settings)
    c = TestClient(app)
    db = Database(settings.db_path)
    sender = FakeSender()
    clock = Clock(MONDAY_9)
    door_automation.SENDER = sender
    door_automation.set_clock(clock)
    door_automation.DISPATCH = lambda fn: fn()  # synchronous in tests
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
    return {"app": app, "c": c, "db": db, "sender": sender, "clock": clock, "feed": feed, "settings": settings}


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


def fire(w: dict[str, Any], **kw: Any) -> list[dict[str, Any]]:
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
    roles_json = json.loads((Path(door_automation.__file__).resolve().parents[1] / "roles.json").read_text(encoding="utf-8"))
    assert contract == roles_json


# ================================================================ the block: validation, create, update

@pytest.mark.parametrize("policy, field", [
    ({"doors": [], "windows": POLICY["windows"]}, "doors"),
    ({"doors": [{"station_id": ENTRY, "relay": 1}] * 2, "windows": POLICY["windows"]}, "doors"),
    ({"doors": [{"station_id": ENTRY, "relay": n} for n in range(1, 6)], "windows": POLICY["windows"]}, "doors"),
    ({"doors": [{"station_id": ENTRY, "relay": 0}], "windows": POLICY["windows"]}, "doors"),
    ({"doors": POLICY["doors"], "windows": []}, "windows"),
    ({"doors": POLICY["doors"], "windows": [{"days": [7], "start": "07:00", "end": "10:00"}]}, "windows"),
    ({"doors": POLICY["doors"], "windows": [{"days": [0], "start": "10:00", "end": "07:00"}]}, "windows"),
    ({"doors": POLICY["doors"], "windows": [{"days": [0], "start": "7:00", "end": "10:00"}]}, "windows"),
    ({"doors": POLICY["doors"], "windows": [{"days": [], "start": "07:00", "end": "10:00"}]}, "windows"),
    ({**POLICY, "cooldown_s": 5}, "cooldown_s"),
    ({**POLICY, "max_per_hour": 31}, "max_per_hour"),
    ({**POLICY, "max_per_day": 0}, "max_per_day"),
    ({**POLICY, "arm_days": 91}, "arm_days"),
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
    assert da["policy"]["cooldown_s"] == 60 and da["policy"]["max_per_hour"] == 4 and da["policy"]["max_per_day"] == 20 and da["policy"]["arm_days"] == 30
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
    assert armed["armed_until"] == "2026-11-04T06:00:00Z", "30 days from the (fake) arming instant"
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
    assert out == ("not_sent", "live_transport_not_built")


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
    clock.advance(days=30, seconds=1)
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
    clock.advance(seconds=61)
    assert fire(live)[0]["reason"] == "rate_hour"
    st = state_of(c, da["id"])
    assert st["state"] == "disarmed" and st["disarm_reason"] == "storm", "three cooldown / rate refusals in 10 minutes"
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
    rows = c.get(f"{API}/access/audit", params={"prefix": "intercom.", "actor_kind": "automation"}).json()["rows"]
    assert len(rows) == 2 and all(r["actor_user_id"].startswith("automation:") and r["details"]["actor_kind"] == "automation" for r in rows)
    assert c.get(f"{API}/access/audit", params={"prefix": "door_automation.", "actor_kind": "person"}).json()["rows"], "the person's own rows"
    assert all(not r["actor_user_id"].startswith("automation:") for r in c.get(f"{API}/access/audit", params={"prefix": "", "actor_kind": "person"}).json()["rows"] if r["actor_user_id"])


def test_the_mirror_hook_fires_and_never_raises(live, monkeypatch):
    from smplwise.services import automations

    c, sender = live["c"], live["sender"]
    _armed(c)
    automations.MIRROR.bind(live["app"].state.db, live["settings"])
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
