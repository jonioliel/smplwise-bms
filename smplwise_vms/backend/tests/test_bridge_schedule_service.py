"""CR-014 / bridge 0.3.0: the `smplwise_bridge.schedule` service.

Behaviour is tested through integration/smplwise_bridge/schedule_service.py against a FAKE Home Assistant (users,
states, an entity registry with scheduler-platform switches, and a FAKE `scheduler` service domain built from the V-LIVE
shapes of SCHEDULER_API.md 9). Registration, unload, the schema, the version and the never-called services are checked
structurally on `__init__.py` (it needs Home Assistant and voluptuous to import, which this suite does not install).
Synthetic data only."""
from __future__ import annotations

import ast
import asyncio
import copy
import json
import sys
from pathlib import Path
from types import SimpleNamespace

import pytest

from bridge_loader import MIRROR, REPO, SRC, init_tree, load

sys.path.insert(0, str(REPO / "scripts"))

service = load("schedule_service")
signing = load("signing")
const = load("const")
policy = load("schedule_policy")

SECRET = "pairing-secret-for-tests"
COND = {"entity_id": "binary_sensor.shabbat_mode", "attribute": "state", "value": "on", "match_type": "is"}


# ---------------------------------------------------------------- the fake Home Assistant


class FakeUnauthorized(Exception):
    pass


class FakeContext:
    _n = 0

    def __init__(self, user_id=None):
        FakeContext._n += 1
        self.user_id = user_id
        self.id = f"ctx{FakeContext._n}"


class FakeUser:
    def __init__(self, uid="u1", *, admin=True, active=True, allowed=None, api=True):
        self.id, self.is_active, self.is_admin = uid, active, admin
        self.allowed = allowed  # None = everything
        self.checked: list[tuple[str, str]] = []
        if api:
            self.permissions = SimpleNamespace(check_entity=self._check)
        else:
            self.permissions = SimpleNamespace()

    def _check(self, entity_id, key):
        self.checked.append((entity_id, key))
        return self.allowed is None or entity_id in self.allowed


class FakeEntry:
    def __init__(self, entity_id, unique_id, platform="scheduler"):
        self.entity_id, self.unique_id, self.platform = entity_id, unique_id, platform


class FakeRegistry:
    def __init__(self):
        self.entities: dict[str, FakeEntry] = {}

    def async_get(self, entity_id):
        return self.entities.get(entity_id)

    def add(self, unique_id, entity_id=None, platform="scheduler"):
        eid = entity_id or f"switch.schedule_{unique_id}"
        self.entities[eid] = FakeEntry(eid, unique_id, platform)
        return eid


class FakeStates:
    def __init__(self):
        self.data: dict[str, SimpleNamespace] = {}

    def set(self, entity_id, state="on", **attrs):
        self.data[entity_id] = SimpleNamespace(state=state, attributes=attrs)

    def get(self, entity_id):
        return self.data.get(entity_id)


class FakeServices:
    """The registered services, recorded calls, and a FAKE scheduler component behind `scheduler.*`."""

    def __init__(self, registry: FakeRegistry, states: "FakeStates", *, installed=True):
        self.registry = registry
        self.states = states
        self.attr_override: dict | None = None  # a component that writes other content than it was given (mismatch tests)
        self.calls: list[dict] = []
        self.handlers: dict[tuple[str, str], object] = {}
        self.fail: dict[tuple[str, str], Exception] = {}
        self.late_s = 0.0  # >0: a new schedule appears in the registry only after this delay
        self.extra_new = 0  # schedules created by someone else at the same moment
        self.counter = 0
        if installed:
            for name in ("add", "edit", "remove", "copy", "run_action", "enable_all", "disable_all"):
                self.handlers[("scheduler", name)] = getattr(self, f"_{name}")
        for name in ("turn_on", "turn_off"):
            self.handlers[("switch", name)] = lambda data: None

    def has_service(self, domain, service):
        return (domain, service) in self.handlers

    async def async_call(self, domain, service, data, blocking=False, context=None):
        self.calls.append({"domain": domain, "service": service, "data": copy.deepcopy(data), "blocking": blocking, "context": context, "registry_len": len(self.registry.entities)})
        if (domain, service) in self.fail:
            raise self.fail[(domain, service)]
        result = self.handlers[(domain, service)](data)
        if asyncio.iscoroutine(result):
            await result

    # fake component
    def _new_id(self):
        self.counter += 1
        return f"{0xa1b2c0 + self.counter:06x}"

    def _register(self, sid, attrs):
        def do():
            self.registry.add(sid)
            self.states.set(f"switch.schedule_{sid}", "on", **attrs)

        if self.late_s:
            asyncio.get_running_loop().call_later(self.late_s, do)  # the component registers AFTER the service returned
        else:
            do()

    def _create(self, attrs):
        self._register(self._new_id(), self.attr_override if self.attr_override is not None else attrs)
        for _ in range(self.extra_new):
            self._register(self._new_id(), {"weekdays": ["sat"], "timeslots": ["01:00:00"], "actions": [{"service": "switch.turn_on", "data": {}}]})

    @staticmethod
    def _real_component_rejects(data):
        """What the real component refused in the phase-0 lab run: null / empty values in a slot (stop, conditions,
        condition_type), a null action entity_id, unknown keys."""
        for t in data.get("timeslots", []):
            if "stop" in t and t["stop"] is None:
                raise ValueError("stop null")
            if "conditions" in t and not t["conditions"]:
                raise ValueError("conditions []")
            if "condition_type" in t and t["condition_type"] is None:
                raise ValueError("condition_type null")
            if any(a.get("entity_id", "x") is None for a in t["actions"]):
                raise ValueError("entity_id null")

    def _add(self, data):
        assert "entity_id" not in data
        self._real_component_rejects(data)
        slots = data["timeslots"]
        self._create({"weekdays": list(data["weekdays"]), "timeslots": [f"{t['start']} - {t['stop']}" if t.get("stop") else t["start"] for t in slots],
                      "actions": [{"service": t["actions"][0]["service"], "data": {}} for t in slots]})

    def _copy(self, data):
        assert set(data) == {"entity_id", "name"}
        self._create(dict(getattr(self.states.get(data["entity_id"]), "attributes", {})))

    def _edit(self, data):
        assert "entity_id" in data
        self._real_component_rejects(data)
        assert "start_date" in data and "end_date" in data, "the real component would wipe the dates"

    def _remove(self, data):
        self.registry.entities.pop(data["entity_id"], None)

    def _run_action(self, data):
        assert "entity_id" in data

    def _enable_all(self, data):  # pragma: no cover - a test asserts the bridge never gets here
        raise AssertionError("enable_all called")

    _disable_all = _enable_all


class FakeHass:
    def __init__(self, user: FakeUser | None, *, installed=True):
        self.registry = FakeRegistry()
        self.states = FakeStates()
        self.services = FakeServices(self.registry, self.states, installed=installed)
        self.user = user
        self.auth = SimpleNamespace(async_get_user=self._get_user)
        self.registry.add("3f9a1c", "switch.schedule_shbt_slvn")
        self.states.set("switch.schedule_shbt_slvn", "on", weekdays=["daily"], timeslots=["00:00:00 - 06:00:00", "06:00:00 - 00:00:00"],
                        actions=[{"service": "climate.set_temperature", "data": {}}, {"service": "climate.turn_off", "data": {}}])
        for eid, attrs in (("climate.living_room", {}), ("light.hall", {}), ("cover.gym_shutter", {"device_class": "shutter"}), ("cover.main_gate", {"device_class": "gate"}),
                           ("switch.sockets", {}), ("lock.front", {}), ("alarm_control_panel.house", {}), ("button.door_release", {}), ("fan.office", {})):
            self.states.set(eid, "on", **attrs)

    async def _get_user(self, uid):
        return self.user if self.user is not None and self.user.id == uid else None


@pytest.fixture(autouse=True)
def fake_ha(monkeypatch):
    monkeypatch.setattr(service, "_ha", lambda: SimpleNamespace(Context=FakeContext, Unauthorized=FakeUnauthorized, ServiceValidationError=ValueError, POLICY_CONTROL="control"))
    monkeypatch.setattr(service, "_registry", lambda hass: hass.registry)
    monkeypatch.setattr(service, "ID_POLL_INTERVAL_S", 0.01)
    monkeypatch.setattr(service, "ID_POLL_TIMEOUT_S", 0.3)


# ---------------------------------------------------------------- helpers


def act(svc, entity, data=None):
    return {"service": svc, "entity_id": entity, "service_data": data if data is not None else {}}


def slot(start, stop, actions):
    return {"start": start, "stop": stop, "conditions": [copy.deepcopy(COND)], "condition_type": "or", "track_conditions": False, "actions": actions}


def payload():
    return {"weekdays": ["daily"], "repeat_type": "repeat", "name": "Living room Shabbat cooling", "start_date": None, "end_date": None,
            "timeslots": [slot("00:00:00", "06:00:00", [act("climate.set_temperature", "climate.living_room", {"hvac_mode": "cool", "temperature": 25})]),
                          slot("06:00:00", "00:00:00", [act("climate.turn_off", "climate.living_room")])]}


def body(op, **kw):
    b = {"user_id": "u1", "op": op, "request_id": "op-1"}
    if op in policy.OPS_ON_EXISTING:
        b.update(schedule_id="3f9a1c", schedule_entity_id="switch.schedule_shbt_slvn")
    if op in ("add", "edit"):
        b["payload"] = payload()
    if op == "copy":
        b["name"] = "Copy of it"
    b.update(kw)
    return b


def call(hass, message, *, verifier=None, signed=True, secret=SECRET):
    verifier = verifier or signing.Verifier(SECRET)
    msg = signing.sign(secret, message) if signed else message
    return asyncio.run(service.async_handle_schedule(hass, verifier, msg))


def no_component_call(hass):
    assert hass.services.calls == [], hass.services.calls


# ---------------------------------------------------------------- happy paths


def test_add_creates_and_learns_the_new_id_from_the_registry_diff():
    hass = FakeHass(FakeUser())
    out = call(hass, body("add"))
    assert out["ok"] is True and out["request_id"] == "op-1" and "error" not in out
    assert out["schedule_id"] == "a1b2c1" and out["entity_id"] == "switch.schedule_a1b2c1"
    (c,) = hass.services.calls
    assert (c["domain"], c["service"], c["blocking"]) == ("scheduler", "add", True)
    assert c["data"] == payload(), "the component receives exactly the validated payload"
    assert c["context"].user_id == "u1" and out["context_id"] == c["context"].id, "runs in the caller's own context"


def test_edit_resends_untouched_slots_byte_identical_and_names_the_switch():
    hass = FakeHass(FakeUser())
    p = payload()
    out = call(hass, body("edit", payload={"start_date": "2026-10-31", "end_date": None, "timeslots": p["timeslots"]}))
    assert out["ok"] is True and out["schedule_id"] == "3f9a1c" and out["entity_id"] == "switch.schedule_shbt_slvn"
    (c,) = hass.services.calls
    assert (c["domain"], c["service"]) == ("scheduler", "edit")
    assert c["data"] == {"entity_id": "switch.schedule_shbt_slvn", "start_date": "2026-10-31", "end_date": None, "timeslots": p["timeslots"]}, "dates forwarded exactly as sent, null included"
    assert json.dumps(c["data"]["timeslots"], sort_keys=True) == json.dumps(p["timeslots"], sort_keys=True)


def test_remove_run_enable_disable_and_copy_make_exactly_one_component_call_each():
    for op, expect_service, expect_data in (
        ("remove", ("scheduler", "remove"), {"entity_id": "switch.schedule_shbt_slvn"}),
        ("enable", ("switch", "turn_on"), {"entity_id": "switch.schedule_shbt_slvn"}),
        ("disable", ("switch", "turn_off"), {"entity_id": "switch.schedule_shbt_slvn"}),
        ("run", ("scheduler", "run_action"), {"entity_id": "switch.schedule_shbt_slvn", "skip_conditions": False}),
        ("copy", ("scheduler", "copy"), {"entity_id": "switch.schedule_shbt_slvn", "name": "Copy of it"}),
    ):
        hass = FakeHass(FakeUser())
        out = call(hass, body(op))
        assert out["ok"] is True, (op, out)
        assert [(c["domain"], c["service"]) for c in hass.services.calls] == [expect_service]
        assert hass.services.calls[0]["data"] == expect_data
        if op == "copy":
            assert out["schedule_id"] == "a1b2c1" and out["entity_id"] == "switch.schedule_a1b2c1"
        elif op == "remove":
            assert "switch.schedule_shbt_slvn" not in hass.registry.entities
    hass = FakeHass(FakeUser())
    out = call(hass, body("run", time="07:00:00", skip_conditions=True))
    assert out["ok"] and hass.services.calls[0]["data"] == {"entity_id": "switch.schedule_shbt_slvn", "skip_conditions": True, "time": "07:00:00"}


def test_the_component_is_never_asked_for_enable_all_disable_all_or_reload_storage():
    hass = FakeHass(FakeUser())
    for op in ("add", "edit", "remove", "copy", "run", "enable", "disable"):
        assert call(hass, body(op))["ok"] is True
        hass.registry.add("3f9a1c", "switch.schedule_shbt_slvn")  # keep the schedule around for the next op
    called = {(c["domain"], c["service"]) for c in hass.services.calls}
    assert called <= set(service.COMPONENT_CALLS.values()) and called.isdisjoint({("scheduler", "enable_all"), ("scheduler", "disable_all"), ("scheduler", "reload_storage")})
    assert set(service.COMPONENT_CALLS) == policy.OPS
    assert {s for d, s in service.COMPONENT_CALLS.values() if d == "scheduler"} == {"add", "edit", "remove", "copy", "run_action"}


# ---------------------------------------------------------------- signature, user, op


def test_signature_replay_and_stale_are_refused_before_anything_else(monkeypatch):
    hass = FakeHass(FakeUser())
    assert call(hass, body("enable"), secret="another-secret")["error"] == "bad_signature"
    assert call(hass, body("enable"), signed=False)["error"] in ("bad_signature", "stale")
    verifier = signing.Verifier(SECRET)
    signed = signing.sign(SECRET, body("enable"))
    assert asyncio.run(service.async_handle_schedule(hass, verifier, dict(signed)))["ok"] is True
    assert asyncio.run(service.async_handle_schedule(hass, verifier, dict(signed)))["error"] == "replay"
    old = signing.sign(SECRET, body("enable"), ts=1)
    assert asyncio.run(service.async_handle_schedule(hass, verifier, old))["error"] == "stale"
    tampered = signing.sign(SECRET, body("enable"))
    tampered["schedule_entity_id"] = "switch.schedule_other"
    assert asyncio.run(service.async_handle_schedule(hass, verifier, tampered))["error"] == "bad_signature"
    assert len(hass.services.calls) == 1, "only the one valid, first delivery reached the component"


def test_unknown_or_inactive_user_and_disallowed_op():
    assert call(FakeHass(None), body("enable"))["error"] == "unknown_user"
    assert call(FakeHass(FakeUser(active=False)), body("enable"))["error"] == "unknown_user"
    hass = FakeHass(FakeUser())
    for op in ("enable_all", "disable_all", "reload_storage", "run_action", "trigger"):
        message = body("enable")
        message["op"] = op
        out = call(hass, message)
        assert out["ok"] is False and out["error"] == "op_not_allowed" and out["request_id"] == "op-1"
    no_component_call(hass)


# ---------------------------------------------------------------- independent re-validation


def test_policy_refusals_carry_a_path_and_reach_no_component():
    hass = FakeHass(FakeUser())
    bad = payload()
    bad["timeslots"][1]["actions"] = [act("climate.set_temperature", "climate.living_room", {"temperature": 99})]
    out = call(hass, body("edit", payload=bad))
    assert (out["ok"], out["error"], out["path"]) == (False, "argument_not_allowed", "timeslots[1].actions[0].service_data.temperature")
    bad = payload()
    bad["timeslots"][0]["actions"] = [act("script.turn_on", "script.night")]
    assert call(hass, body("edit", payload=bad))["error"] == "service_not_allowed"
    bad = payload()
    bad["timeslots"][0]["actions"] = [act("lock.unlock", "lock.front", {"code": "1234"})]
    out = call(hass, body("edit", payload=bad, sensitive=True))
    assert out["error"] == "code_not_allowed" and out["path"].endswith("code") and "1234" not in json.dumps(out)
    bad = payload()
    bad["surprise"] = True
    assert call(hass, body("edit", payload=bad))["error"] == "invalid_payload"
    assert call(hass, body("enable", extra_key=1))["error"] == "invalid_payload"
    no_component_call(hass)


def test_every_action_entity_must_exist_in_home_assistant():
    hass = FakeHass(FakeUser())
    bad = payload()
    bad["timeslots"][0]["actions"] = [act("light.turn_on", "light.ghost", {"brightness": 20})]
    out = call(hass, body("add", payload=bad))
    assert out["error"] == "entity_not_found" and out["path"] == "timeslots[0].actions[0].entity_id"
    no_component_call(hass)


@pytest.mark.parametrize("svc,entity", [
    ("lock.unlock", "lock.front"), ("lock.lock", "lock.front"), ("alarm_control_panel.alarm_arm_home", "alarm_control_panel.house"),
    ("alarm_control_panel.alarm_disarm", "alarm_control_panel.house"), ("cover.open_cover", "cover.main_gate"), ("button.press", "button.door_release"),
])
def test_sensitive_actions_need_the_sensitive_flag(svc, entity):
    hass = FakeHass(FakeUser())
    p = payload()
    p["timeslots"][0]["actions"] = [act(svc, entity)]
    for flagged in (None, False):
        b = body("add", payload=p)
        if flagged is not None:
            b["sensitive"] = flagged
        out = call(hass, b)
        assert out["error"] == "sensitive_flag_mismatch" and out["path"] == "timeslots[0].actions[0]"
    no_component_call(hass)
    assert call(hass, body("add", payload=p, sensitive=True))["ok"] is True


def test_a_sensitive_flag_without_need_is_harmless_and_plain_actions_need_none():
    hass = FakeHass(FakeUser())
    assert call(hass, body("add", sensitive=True))["ok"] is True
    assert call(hass, body("add"))["ok"] is True
    p = payload()
    p["timeslots"][0]["actions"] = [act("cover.close_cover", "cover.gym_shutter"), act("light.turn_on", "light.hall", {"brightness": 51}), act("fan.turn_on", "fan.office")]
    assert call(hass, body("add", payload=p))["ok"] is True


# ---------------------------------------------------------------- permissions (non-admin)


def test_non_admin_needs_control_of_every_action_entity_and_of_the_schedule_switch():
    user = FakeUser(admin=False, allowed={"climate.living_room", "switch.schedule_shbt_slvn", "light.hall"})
    hass = FakeHass(user)
    out = call(hass, body("edit"))
    assert out["ok"] is True
    assert {e for e, _ in user.checked} == {"climate.living_room", "switch.schedule_shbt_slvn"} and {k for _, k in user.checked} == {"control"}
    # one entity outside the user's policy: refused, nothing sent
    p = payload()
    p["timeslots"][0]["actions"] = [act("light.turn_on", "light.hall"), act("switch.turn_on", "switch.sockets")]
    hass.services.calls.clear()
    out = call(hass, body("edit", payload=p))
    assert out["ok"] is False and out["error"] == "unauthorized"
    no_component_call(hass)
    # add needs the actions only (no schedule exists yet)
    hass2 = FakeHass(FakeUser(admin=False, allowed={"climate.living_room"}))
    assert call(hass2, body("add"))["ok"] is True
    # every other op needs the schedule's own switch
    for op in ("remove", "copy", "run", "enable", "disable"):
        hass3 = FakeHass(FakeUser(admin=False, allowed={"climate.living_room"}))
        out = call(hass3, body(op))
        assert out["error"] == "unauthorized", op
        no_component_call(hass3)
        hass4 = FakeHass(FakeUser(admin=False, allowed={"switch.schedule_shbt_slvn"}))
        assert call(hass4, body(op))["ok"] is True, op


def test_a_missing_or_broken_permission_api_fails_closed(monkeypatch):
    hass = FakeHass(FakeUser(admin=False, api=False))
    out = call(hass, body("edit"))
    assert out["ok"] is False and out["error"] == "permission_check_unavailable"
    no_component_call(hass)
    # the constant moved: closed as well
    monkeypatch.setattr(service, "_ha", lambda: SimpleNamespace(Context=FakeContext, Unauthorized=FakeUnauthorized, ServiceValidationError=ValueError, POLICY_CONTROL=None))
    assert call(FakeHass(FakeUser(admin=False)), body("edit"))["error"] == "permission_check_unavailable"
    # an API that raises is not trusted either
    user = FakeUser(admin=False)
    user.permissions.check_entity = lambda *_: (_ for _ in ()).throw(RuntimeError("boom"))
    monkeypatch.setattr(service, "_ha", lambda: SimpleNamespace(Context=FakeContext, Unauthorized=FakeUnauthorized, ServiceValidationError=ValueError, POLICY_CONTROL="control"))
    assert call(FakeHass(user), body("edit"))["error"] == "permission_check_unavailable"
    # an administrator does not depend on it at all
    assert call(FakeHass(FakeUser(admin=True, api=False)), body("edit"))["ok"] is True


# ---------------------------------------------------------------- the schedule's own switch (registry)


@pytest.mark.parametrize("op", ["edit", "remove", "copy", "run", "enable", "disable"])
def test_only_a_scheduler_switch_with_the_matching_id_may_be_acted_on(op):
    for setup in ("missing", "other_platform", "id_mismatch"):
        hass = FakeHass(FakeUser())
        if setup == "missing":
            hass.registry.entities.pop("switch.schedule_shbt_slvn")
        elif setup == "other_platform":
            hass.registry.entities["switch.schedule_shbt_slvn"].platform = "template"
        else:
            hass.registry.entities["switch.schedule_shbt_slvn"].unique_id = "ffffff"
        out = call(hass, body(op))
        assert out["ok"] is False and out["error"] == "not_a_schedule" and out["path"] == "schedule_entity_id", (op, setup)
        no_component_call(hass)
    # a plain switch (the classic attack: enable / remove something that is not a schedule)
    hass = FakeHass(FakeUser())
    out = call(hass, body(op, schedule_entity_id="switch.sockets"))
    assert out["error"] == "not_a_schedule"
    no_component_call(hass)


def test_missing_scheduler_component_is_reported():
    hass = FakeHass(FakeUser(), installed=False)
    for op in ("add", "edit", "remove", "copy", "run"):
        out = call(hass, body(op))
        assert out["ok"] is False and out["error"] == "scheduler_missing", op
    # enable / disable only need the switch domain
    assert call(hass, body("enable"))["ok"] is True


# ---------------------------------------------------------------- learning the new id


def test_no_new_schedule_appears_gives_ok_with_id_unknown():
    hass = FakeHass(FakeUser())
    hass.services.handlers[("scheduler", "add")] = lambda data: None
    out = call(hass, body("add"))
    assert out["ok"] is True and out["error"] == "id_unknown" and out["schedule_id"] is None and out["entity_id"] is None


def test_two_new_schedules_at_once_are_never_guessed():
    hass = FakeHass(FakeUser())
    hass.services.extra_new = 1
    out = call(hass, body("add"))
    assert out["ok"] is True and out["error"] == "id_unknown" and out["schedule_id"] is None


def test_a_schedule_that_appears_a_moment_later_is_found_by_polling():
    hass = FakeHass(FakeUser())
    hass.services.late_s = 0.05
    out = call(hass, body("add"))
    assert out["ok"] is True and "error" not in out and out["schedule_id"] == "a1b2c1"


def test_existing_schedules_are_not_mistaken_for_the_new_one():
    hass = FakeHass(FakeUser())
    hass.registry.add("aaaaaa")
    hass.registry.add("bbbbbb", platform="other")  # not a scheduler switch
    out = call(hass, body("copy"))
    assert out["schedule_id"] == "a1b2c1"


# ---------------------------------------------------------------- component failures


def test_component_failures_answer_with_a_class_name_never_the_message():
    hass = FakeHass(FakeUser())
    hass.services.fail[("scheduler", "edit")] = FakeUnauthorized("user u1 may not")
    out = call(hass, body("edit"))
    assert out["ok"] is False and out["error"] == "unauthorized"
    hass.services.fail[("scheduler", "edit")] = KeyError("secret-value-1234")
    out = call(hass, body("edit"))
    assert out["ok"] is False and out["error"] == "KeyError" and "secret-value-1234" not in json.dumps(out)


def test_logs_carry_no_payload_values(caplog):
    hass = FakeHass(FakeUser())
    hass.services.fail[("scheduler", "add")] = ValueError("Living room Shabbat cooling 25")
    with caplog.at_level("DEBUG"):
        call(hass, body("add"))
        bad = payload()
        bad["timeslots"][0]["actions"] = [act("lock.unlock", "lock.front", {"code": "9876"})]
        call(hass, body("add", payload=bad, sensitive=True))
    text = caplog.text
    assert "9876" not in text and "Living room Shabbat cooling" not in text and "climate.living_room" not in text


# ---------------------------------------------------------------- structure of __init__.py, const, manifest, mirror


def _init_assign(name: str) -> ast.Assign:
    for node in init_tree().body:
        if isinstance(node, ast.Assign) and any(isinstance(t, ast.Name) and t.id == name for t in node.targets):
            return node
    raise AssertionError(name)


def test_the_service_is_registered_with_response_and_removed_on_unload():
    src = (SRC / "__init__.py").read_text(encoding="utf-8")
    assert "hass.services.async_register(DOMAIN, SERVICE_SCHEDULE, schedule, schema=SCHEDULE_SCHEMA, supports_response=SupportsResponse.ONLY)" in src
    assert "hass.services.async_remove(DOMAIN, SERVICE_SCHEDULE)" in src
    assert "from .schedule_service import async_handle_schedule" in src
    assert 'SERVICE_SCHEDULE = "schedule"' in (SRC / "const.py").read_text(encoding="utf-8") and const.SERVICE_SCHEDULE == "schedule"
    unload = next(n for n in ast.walk(init_tree()) if isinstance(n, ast.AsyncFunctionDef) and n.name == "async_unload_entry")
    removed = [ast.unparse(n.args[1]) for n in ast.walk(unload) if isinstance(n, ast.Call) and ast.unparse(n.func) == "hass.services.async_remove"]
    assert set(removed) == {"SERVICE_EXECUTE", "SERVICE_SET_AREA", "SERVICE_SCHEDULE", "SERVICE_STREAM_SOURCE", "SERVICE_SYNC"}
    # the existing services stay as they were
    assert 'hass.services.async_register(DOMAIN, SERVICE_EXECUTE, execute, schema=EXECUTE_SCHEMA' in src and "async_register(DOMAIN, SERVICE_SET_AREA" in src


def test_the_schema_has_no_defaults_so_the_signed_data_is_never_altered():
    text = ast.unparse(_init_assign("SCHEDULE_SCHEMA"))
    assert "default" not in text, "a voluptuous default would add keys to call.data after the add-on signed it"
    assert "vol.ALLOW_EXTRA" in text
    for key in ("user_id", "op", "request_id", "schedule_id", "schedule_entity_id", "payload", "name", "time", "skip_conditions", "sensitive", "ts", "nonce", "sig"):
        assert f"'{key}'" in text, key
    assert {k for k in policy.MESSAGE_KEYS} == {"user_id", "op", "request_id", "schedule_id", "schedule_entity_id", "payload", "name", "time", "skip_conditions", "sensitive", "ts", "nonce", "sig"}


def test_no_integration_source_ever_names_the_forbidden_component_services():
    forbidden = {"enable_all", "disable_all", "reload_storage"}
    for path in SRC.glob("*.py"):
        for node in ast.walk(ast.parse(path.read_text(encoding="utf-8"))):
            if isinstance(node, ast.Constant) and isinstance(node.value, str):
                assert node.value not in forbidden, f"{path.name}: {node.value!r}"


def test_execute_allow_list_is_intact_and_never_reaches_the_scheduler():
    from bridge_loader import init_allowed_services

    allowed = init_allowed_services()
    assert not any(d == "scheduler" for d, _ in allowed), "the execute service never reaches the scheduler component: schedule writes go through the schedule service only"
    assert ("switch", "turn_on") in allowed and ("alarm_control_panel", "alarm_disarm") in allowed  # the existing list is intact


def test_version_is_consistent_in_const_manifest_and_card_and_the_mirror_matches():
    manifest = json.loads((SRC / "manifest.json").read_text(encoding="utf-8"))
    assert manifest["version"] == const.VERSION == "0.3.1"
    assert "const VERSION = '0.3.1'" in (SRC / "www" / "smplwise-card.js").read_text(encoding="utf-8")
    import sync_integration

    assert sync_integration.differences() == [], "run python scripts/sync_integration.py"
    for name in ("schedule_policy.py", "schedule_service.py"):
        assert (SRC / name).read_bytes() == (MIRROR / name).read_bytes()


def test_service_description_and_translations_exist():
    yaml_text = (SRC / "services.yaml").read_text(encoding="utf-8")
    assert "\nschedule:\n" in yaml_text and "\nexecute:\n" in "\n" + yaml_text
    block = yaml_text.split("\nschedule:\n", 1)[1].split("\nsync_directory:", 1)[0]
    for field in ("user_id", "op", "request_id", "schedule_id", "schedule_entity_id", "payload", "name", "time", "skip_conditions", "sensitive", "ts", "nonce", "sig"):
        assert f"\n    {field}:\n" in "\n" + block, field
    for rel in ("strings.json", "translations/en.json", "translations/he.json"):
        data = json.loads((SRC / rel).read_text(encoding="utf-8"))
        assert data["services"]["schedule"]["name"] and data["services"]["schedule"]["description"] and "config" in data, rel


# ---------------------------------------------------------------- CR-014 security review: concurrent creates, content check, execute guard


def _slot_payload(start, stop, service_id, entity, name):
    p = payload()
    p["name"] = name
    p["timeslots"] = [slot(start, stop, [act(service_id, entity)])]
    return p


def test_two_concurrent_adds_each_learn_their_own_id_even_when_registration_interleaves():
    hass = FakeHass(FakeUser())
    hass.services.late_s = 0.05  # each switch is registered well after its add returned, while the other add is starting
    verifier = signing.Verifier(SECRET)
    a = signing.sign(SECRET, body("add", request_id="op-A", payload=_slot_payload("07:00:00", "08:00:00", "light.turn_on", "light.hall", "Alpha")))
    b = signing.sign(SECRET, body("add", request_id="op-B", payload=_slot_payload("21:00:00", "22:00:00", "switch.turn_on", "switch.sockets", "Beta")))

    async def both():
        return await asyncio.gather(service.async_handle_schedule(hass, verifier, a), service.async_handle_schedule(hass, verifier, b))

    out_a, out_b = asyncio.run(both())
    assert out_a["ok"] and out_b["ok"] and "error" not in out_a and "error" not in out_b
    assert out_a["schedule_id"] != out_b["schedule_id"]
    for out, want in ((out_a, ("07:00:00 - 08:00:00", "light.turn_on")), (out_b, ("21:00:00 - 22:00:00", "switch.turn_on"))):
        attrs = hass.states.get(out["entity_id"]).attributes
        assert (attrs["timeslots"][0], attrs["actions"][0]["service"]) == want, "each caller got the id of ITS OWN schedule"
    adds = [c for c in hass.services.calls if c["service"] == "add"]
    assert len(adds) == 2 and adds[1]["registry_len"] == adds[0]["registry_len"] + 1, "the second add started only after the first switch was registered and its id learned"


def test_a_new_switch_whose_content_does_not_match_the_payload_is_never_adopted():
    hass = FakeHass(FakeUser())
    hass.services.attr_override = {"weekdays": ["daily"], "timeslots": ["05:00:00 - 06:00:00"], "actions": [{"service": "light.turn_off", "data": {}}]}
    out = call(hass, body("add"))
    assert out["ok"] is True and out["error"] == "id_unknown" and out["schedule_id"] is None and out["entity_id"] is None
    # a copy is checked against its source
    hass2 = FakeHass(FakeUser())
    hass2.services.attr_override = {"weekdays": ["mon"], "timeslots": ["01:00:00"], "actions": [{"service": "light.turn_on", "data": {}}]}
    out = call(hass2, body("copy"))
    assert out["error"] == "id_unknown" and out["schedule_id"] is None
    # a copy whose source state is unknown cannot be verified: id_unknown
    hass3 = FakeHass(FakeUser())
    hass3.states.data.pop("switch.schedule_shbt_slvn")
    assert call(hass3, body("copy"))["error"] == "id_unknown"


def test_a_registered_switch_without_a_state_is_waited_for_then_refused():
    hass = FakeHass(FakeUser())
    hass.services._register = lambda sid, attrs: hass.registry.add(sid)  # registered, never gets a state
    out = call(hass, body("add"))
    assert out["error"] == "id_unknown" and out["schedule_id"] is None


def test_after_an_unresolved_create_the_next_learned_id_is_not_trusted_for_a_while(monkeypatch):
    hass = FakeHass(FakeUser())
    hass.services.attr_override = {"weekdays": ["daily"], "timeslots": ["05:00:00"], "actions": [{"service": "light.turn_off", "data": {}}]}
    first = call(hass, body("add", request_id="op-1"))  # unresolved: the component wrote something else
    assert first["error"] == "id_unknown"
    # a second create finds a new entry that matches, but the first one's switch could still be arriving: not trusted yet
    hass.services.attr_override = None
    second = call(hass, body("add", request_id="op-2"))
    assert second["error"] == "id_unknown" and second["schedule_id"] is None
    monkeypatch.setattr(service, "SUSPECT_WINDOW_S", 0.0)
    third = call(hass, body("add", request_id="op-3"))
    assert third["ok"] and "error" not in third and third["schedule_id"]


def test_fingerprints_read_the_same_facts_from_a_payload_and_from_switch_attributes():
    p = payload()
    fp = service.payload_fingerprint(p)
    assert fp == {"weekdays": ["daily"], "timeslots": [("00:00:00", "06:00:00"), ("06:00:00", "00:00:00")], "actions": ["climate.set_temperature", "climate.turn_off"]}
    point = {"weekdays": ["sat", "mon"], "timeslots": [slot("22:00:00", None, [act("alarm_control_panel.alarm_arm_home", "alarm_control_panel.house")])]}
    assert service.payload_fingerprint(point) == {"weekdays": ["mon", "sat"], "timeslots": [("22:00:00", None)], "actions": ["alarm_control_panel.alarm_arm_home"]}
    assert service.attributes_fingerprint({"weekdays": ["mon", "sat"], "timeslots": ["22:00:00"], "actions": [{"service": "alarm_control_panel.alarm_arm_home", "data": {}}]}) == service.payload_fingerprint(point)
    assert service.attributes_fingerprint({}) is None and service.attributes_fingerprint(None) is None and service.attributes_fingerprint({"weekdays": [], "timeslots": []}) is None


def refuse(hass, entity_id, **extra):
    """execute_refusal for the service data of a signed execute call."""
    return service.execute_refusal(hass, {"entity_id": entity_id, **extra})


def _execute_hass(**platforms):
    hass = FakeHass(FakeUser())
    for eid, platform in platforms.items():
        hass.registry.entities[eid] = FakeEntry(eid, "uid-" + eid, platform)
    return hass


def test_execute_refuses_the_scheduler_components_switches():
    hass = FakeHass(FakeUser())
    assert refuse(hass, "switch.schedule_shbt_slvn") == "scheduler_switch_not_allowed"
    assert refuse(hass, ["switch.sockets", "switch.schedule_shbt_slvn"]) == "scheduler_switch_not_allowed"
    assert refuse(hass, "switch.sockets, switch.schedule_shbt_slvn") == "scheduler_switch_not_allowed"
    # a switch whose registry row says scheduler, whatever its id looks like
    other = _execute_hass(**{"switch.renamed_thing": "scheduler", "switch.template_one": "template"})
    assert refuse(other, "switch.renamed_thing") == "scheduler_switch_not_allowed"
    assert refuse(other, "switch.template_one") is None
    # state-only prefix (no registry row): refused too; an unknown ordinary entity is left to Home Assistant
    assert refuse(other, "switch.schedule_a1b2c3") == "scheduler_switch_not_allowed"
    assert refuse(other, "light.not_in_registry") is None
    assert refuse(other, "switch.schedulexfoo") is None and refuse(other, "switch.lobby_schedule_lamp") is None


@pytest.mark.parametrize("target", ["all", "none", "", ",", "switch.*", "{{ states.switch }}", "Switch.Sockets", 5, None, {"a": 1}, [], ["all"], [["switch.a"]]])
def test_execute_refuses_targets_that_are_not_plain_entity_ids(target):
    assert refuse(FakeHass(FakeUser()), target) == "invalid_entity_id"


def test_execute_fails_closed_when_the_registry_cannot_be_read(monkeypatch):
    def boom(hass):
        raise RuntimeError("registry not loaded")

    monkeypatch.setattr(service, "_registry", boom)
    assert refuse(FakeHass(FakeUser()), "light.hall") == "entity_registry_unavailable"


def test_the_execute_service_calls_the_guard_before_it_calls_home_assistant():
    tree = init_tree()
    setup = next(n for n in ast.walk(tree) if isinstance(n, ast.AsyncFunctionDef) and n.name == "async_setup_entry")
    execute = next(n for n in ast.walk(setup) if isinstance(n, ast.AsyncFunctionDef) and n.name == "execute")
    text = ast.unparse(execute)
    guard, call_at = text.index("execute_refusal(hass, data)"), text.index("hass.services.async_call(domain, service, data")
    assert text.index("'entity_required'") < guard < call_at
    assert "from .schedule_service import async_handle_schedule, execute_refusal" in (SRC / "__init__.py").read_text(encoding="utf-8")


def _learn(hass_attrs, sent_slots, weekdays=("daily",)):
    """Add a schedule whose switch reports `hass_attrs` (the forms the real component writes to its state) and return the answer."""
    hass = FakeHass(FakeUser())
    hass.services.attr_override = hass_attrs
    p = payload()
    p["weekdays"] = list(weekdays)
    p["timeslots"] = sent_slots
    return call(hass, body("add", payload=p))


def test_the_learned_switch_is_matched_in_every_time_form_the_component_uses():
    act1 = [act("light.turn_on", "light.hall", {"brightness": 51})]
    svc1 = [{"service": "light.turn_on", "data": {"brightness": 51}}]
    cases = [
        # (what was sent, what the switch's `timeslots` attribute says)
        ([slot("03:15:00", "03:45:00", act1)], ["03:15:00 - 03:45:00"]),
        ([slot("03:15", "03:45", act1)], ["03:15 - 03:45"]),  # stored as HH:MM, shown as stored
        ([slot("03:15", "03:45", act1)], ["03:15:00 - 03:45:00"]),  # or normalised to seconds: same slot
        ([slot("03:15:00", "03:45:00", act1)], ["03:15 - 03:45"]),
        ([slot("22:00:00", None, act1)], ["22:00:00"]),  # a point action (stop null on read, omitted on write)
        ([slot("22:00:00", None, act1)], ["22:00:00 - None"]),
        ([slot("22:00", None, act1)], ["22:00:00"]),
        ([slot("sunset+00:30:00", "23:00:00", act1)], ["sunset+00:30:00 - 23:00:00"]),
        ([slot("sunset+00:30:00", "23:00:00", act1)], ["sunset+00:30 - 23:00"]),
        ([slot("sunrise-00:15:00", "sunset-00:15:00", act1)], ["sunrise-00:15:00 - sunset-00:15:00"]),
        ([slot("22:00:00", "02:00:00", act1)], ["22:00:00 - 02:00:00"]),
    ]
    for sent, shown in cases:
        out = _learn({"weekdays": ["daily"], "timeslots": shown, "actions": svc1}, sent)
        assert out["ok"] and "error" not in out and out["schedule_id"], (sent[0]["start"], sent[0]["stop"], shown)
    # a different slot is never matched
    out = _learn({"weekdays": ["daily"], "timeslots": ["03:15:00 - 03:46:00"], "actions": svc1}, [slot("03:15:00", "03:45:00", act1)])
    assert out["error"] == "id_unknown"
    out = _learn({"weekdays": ["daily"], "timeslots": ["03:15:00"], "actions": svc1}, [slot("03:15:00", "03:45:00", act1)])
    assert out["error"] == "id_unknown", "a point action is not a window"
    out = _learn({"weekdays": ["mon", "tue"], "timeslots": ["03:15:00 - 03:45:00"], "actions": svc1}, [slot("03:15:00", "03:45:00", act1)], weekdays=("tue", "mon"))
    assert out["ok"] and "error" not in out, "weekday order does not matter"


def test_the_component_gets_the_real_write_form_even_from_a_sender_that_uses_the_stored_form():
    hass = FakeHass(FakeUser())
    p = payload()
    p["timeslots"][0]["stop"] = None  # the stored (read) form an older sender uses
    p["timeslots"][1]["conditions"], p["timeslots"][1]["condition_type"], p["timeslots"][1]["track_conditions"] = [], None, False
    out = call(hass, body("add", payload=p))
    assert out["ok"] is True and "error" not in out, "the fake component rejects nulls like the real one, so the bridge must not forward them"
    sent = hass.services.calls[0]["data"]["timeslots"]
    assert "stop" not in sent[0] and set(sent[1]) == {"start", "stop", "actions"}
    out = call(FakeHass(FakeUser()), body("edit", payload=p))
    assert out["ok"] is True


def test_an_edit_without_both_dates_is_refused_before_the_component_is_called():
    hass = FakeHass(FakeUser())
    for pl in ({"name": "renamed"}, {"name": "renamed", "start_date": None}, {"name": "renamed", "end_date": None}):
        out = call(hass, body("edit", payload=pl))
        assert out["ok"] is False and out["error"] == "dates_required" and out["path"] in ("payload.start_date", "payload.end_date")
    no_component_call(hass)
    out = call(hass, body("edit", payload={"name": "renamed", "start_date": "2026-10-31", "end_date": "2027-03-31"}))
    assert out["ok"] is True and hass.services.calls[0]["data"] == {"entity_id": "switch.schedule_shbt_slvn", "name": "renamed", "start_date": "2026-10-31", "end_date": "2027-03-31"}


def test_run_takes_hh_mm_and_the_registry_check_stays():
    hass = FakeHass(FakeUser())
    assert call(hass, body("run", time="07:30"))["ok"] is True and hass.services.calls[0]["data"]["time"] == "07:30"
    assert call(hass, body("run", time="sunset+00:30:00"))["error"] == "invalid_payload"
    hass.registry.entities.pop("switch.schedule_shbt_slvn")
    assert call(hass, body("run"))["error"] == "not_a_schedule", "a nonexistent entity would be a silent success in the component: the bridge refuses it"


def test_the_bridge_never_asks_the_component_for_a_response():
    assert "return_response" not in ast.unparse(ast.parse((SRC / "schedule_service.py").read_text(encoding="utf-8")))
    hass = FakeHass(FakeUser())
    for op in ("add", "copy", "edit", "remove", "run", "enable", "disable"):
        assert call(hass, body(op))["ok"] is True
        hass.registry.add("3f9a1c", "switch.schedule_shbt_slvn")


# ---------------------------------------------------------------- re-review: window renewal, area / label / device / floor targets, groups


def test_the_suspect_window_is_not_renewed_by_a_create_it_only_withheld(monkeypatch):
    clock = {"t": 1000.0}
    monkeypatch.setattr(service.time, "monotonic", lambda: clock["t"])
    hass = FakeHass(FakeUser())
    hass.services.attr_override = {"weekdays": ["daily"], "timeslots": ["05:00:00"], "actions": [{"service": "light.turn_off", "data": {}}]}
    assert call(hass, body("add", request_id="op-1"))["error"] == "id_unknown"  # unresolved at t=1000: the window opens
    hass.services.attr_override = None
    for i in range(3):  # creates arriving well inside the window: their ids ARE learned and match, but are withheld
        clock["t"] += 9.0
        out = call(hass, body("add", request_id=f"op-in-{i}"))
        assert out["error"] == "id_unknown" and out["schedule_id"] is None
    clock["t"] += 9.0  # t = 1036: 36 s after the only real failure; the withheld creates did not push it forward
    out = call(hass, body("add", request_id="op-after"))
    assert out["ok"] and "error" not in out and out["schedule_id"] and out["entity_id"], "the window ended 30 s after the one unresolved create"
    # a genuinely unresolved create renews it
    hass.services.attr_override = {"weekdays": ["daily"], "timeslots": ["05:00:00"], "actions": [{"service": "light.turn_off", "data": {}}]}
    assert call(hass, body("add", request_id="op-bad"))["error"] == "id_unknown"
    hass.services.attr_override = None
    clock["t"] += 5.0
    assert call(hass, body("add", request_id="op-again"))["error"] == "id_unknown"


@pytest.mark.parametrize("key", ["area_id", "label_id", "device_id", "floor_id"])
@pytest.mark.parametrize("value", ["kitchen", ["kitchen"], "", None])
def test_execute_refuses_area_label_device_and_floor_targets(key, value):
    hass = FakeHass(FakeUser())
    assert refuse(hass, "switch.sockets", **{key: value}) == "target_not_allowed"
    assert service.execute_refusal(hass, {key: value}) == "target_not_allowed", "even without an entity_id"
    assert service.execute_refusal(hass, {"entity_id": "switch.sockets", "brightness": 5}) is None, "ordinary service data goes on"


def _group(hass, entity_id, members):
    hass.states.data[entity_id] = SimpleNamespace(state="on", attributes={"entity_id": members})


def test_execute_refuses_a_group_with_a_scheduler_switch_among_its_members():
    hass = FakeHass(FakeUser())
    _group(hass, "switch.all_night_things", ["switch.sockets", "switch.schedule_shbt_slvn"])
    assert refuse(hass, "switch.all_night_things") == "scheduler_switch_not_allowed"
    _group(hass, "group.outer", ["switch.sockets", "switch.all_night_things"])  # nested
    assert refuse(hass, "group.outer") == "scheduler_switch_not_allowed"
    hass.registry.entities["switch.renamed_thing"] = FakeEntry("switch.renamed_thing", "u", "scheduler")
    _group(hass, "switch.group_two", ["switch.renamed_thing"])
    assert refuse(hass, "switch.group_two") == "scheduler_switch_not_allowed", "by registry platform, not by id"
    _group(hass, "switch.group_three", "switch.schedule_a1b2c3")  # a single member given as a string
    assert refuse(hass, "switch.group_three") == "scheduler_switch_not_allowed"
    assert refuse(hass, ["light.hall", "switch.all_night_things"]) == "scheduler_switch_not_allowed"


def test_execute_lets_harmless_groups_and_entities_with_an_entity_id_attribute_through():
    hass = FakeHass(FakeUser())
    _group(hass, "light.hall_lights", ["light.hall", "light.other"])
    _group(hass, "switch.sockets_group", ["switch.sockets"])
    _group(hass, "group.empty", [])
    _group(hass, "group.a", ["group.b"])
    _group(hass, "group.b", ["group.a", "light.hall"])  # a cycle that ends in nothing schedulable
    for eid in ("light.hall_lights", "switch.sockets_group", "group.empty", "group.a"):
        assert refuse(hass, eid) is None, eid
    assert refuse(hass, "climate.living_room") is None and refuse(hass, "switch.sockets") is None


def test_execute_fails_closed_on_groups_it_cannot_read():
    hass = FakeHass(FakeUser())
    for bad in ({"a": 1}, 7, ["light.hall", 5], ["light.hall", "not an id"], [["switch.a"]]):
        _group(hass, "switch.weird_group", bad)
        assert refuse(hass, "switch.weird_group") == "scheduler_group_unverifiable", bad
    deep = [f"group.g{i}" for i in range(8)]
    for i, g in enumerate(deep):
        _group(hass, g, [deep[i + 1]] if i + 1 < len(deep) else ["light.hall"])
    assert refuse(hass, "group.g0") == "scheduler_group_unverifiable", "nested deeper than the limit: closed"
    hass.states.get = lambda _e: (_ for _ in ()).throw(RuntimeError("state machine not ready"))
    assert refuse(hass, "light.hall") == "scheduler_group_unverifiable"


def test_the_addons_execute_callers_never_send_area_label_device_or_floor_targets():
    """The three callers build `data` from ha_bridge.validate_action: the entity id plus the action's own arguments."""
    from smplwise.services import ha_bridge

    names = {name for spec in ha_bridge.ACTIONS.values() for name in spec["args"]}
    assert not names & service.FORBIDDEN_EXECUTE_TARGET_KEYS, names & service.FORBIDDEN_EXECUTE_TARGET_KEYS
    _spec, data = ha_bridge.validate_action("light.turn_on", "light.hall", {"brightness_pct": 40})
    assert set(data) == {"entity_id", "brightness_pct"}
