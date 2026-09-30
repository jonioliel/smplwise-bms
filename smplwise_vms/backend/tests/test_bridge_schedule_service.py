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

    def __init__(self, registry: FakeRegistry, *, installed=True):
        self.registry = registry
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
        self.calls.append({"domain": domain, "service": service, "data": copy.deepcopy(data), "blocking": blocking, "context": context})
        if (domain, service) in self.fail:
            raise self.fail[(domain, service)]
        result = self.handlers[(domain, service)](data)
        if asyncio.iscoroutine(result):
            await result

    # fake component
    def _new_id(self):
        self.counter += 1
        return f"{0xa1b2c0 + self.counter:06x}"

    def _create(self):
        sid = self._new_id()
        if self.late_s:
            asyncio.get_running_loop().call_later(self.late_s, lambda: self.registry.add(sid))
        else:
            self.registry.add(sid)
        for _ in range(self.extra_new):
            self.registry.add(self._new_id())

    def _add(self, data):
        assert "entity_id" not in data
        self._create()

    def _copy(self, data):
        assert set(data) == {"entity_id", "name"}
        self._create()

    def _edit(self, data):
        assert "entity_id" in data

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
        self.services = FakeServices(self.registry, installed=installed)
        self.user = user
        self.auth = SimpleNamespace(async_get_user=self._get_user)
        self.registry.add("3f9a1c", "switch.schedule_shbt_slvn")
        self.states.set("switch.schedule_shbt_slvn", "on")
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
    return {"weekdays": ["daily"], "repeat_type": "repeat", "name": "Living room Shabbat cooling",
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
    out = call(hass, body("edit", payload={"timeslots": p["timeslots"]}))
    assert out["ok"] is True and out["schedule_id"] == "3f9a1c" and out["entity_id"] == "switch.schedule_shbt_slvn"
    (c,) = hass.services.calls
    assert (c["domain"], c["service"]) == ("scheduler", "edit")
    assert c["data"] == {"entity_id": "switch.schedule_shbt_slvn", "timeslots": p["timeslots"]}
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
    assert set(removed) == {"SERVICE_EXECUTE", "SERVICE_SET_AREA", "SERVICE_SCHEDULE", "SERVICE_SYNC"}
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
    assert manifest["version"] == const.VERSION == "0.3.0"
    assert "const VERSION = '0.3.0'" in (SRC / "www" / "smplwise-card.js").read_text(encoding="utf-8")
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
