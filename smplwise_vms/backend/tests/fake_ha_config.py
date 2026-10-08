"""A FAKE Home Assistant config surface for CR-017 (docs/architecture/AUTOMATIONS_API.md section 5): the automations, scripts and scenes files, the
config REST API with HA's exact status codes and messages, the WebSocket commands the add-on reads (`get_states`, `config/entity_registry/list`,
`automation/config`, `script/config`, `trace/list`, `trace/get`, `validate_config`, `get_services`, label / floor / category registries), the runtime services
(`automation.turn_on|turn_off|trigger|reload`, `script.turn_on|turn_off|<key>|reload`, `scene.turn_on|apply|create|delete|reload`) with their events and traces,
and - from the bridge milestone on - the bridge's `config_item` service on the same state.

The shapes come from the V-SRC reading of Home Assistant core (CR-017 section 3) and the anonymised probe of four real systems; every name and value is
GENERIC (see `automations_seed.py`). Pure Python: no Home Assistant, no network, no real clock. Deterministic (ids from a counter) and driven by an injectable
clock.

What it mimics on purpose (each is a CR-017 assumption the real system must confirm in phase 0):
- GET of an unknown id: 404 "Resource not found"; DELETE of an unknown id: **400** "Resource not found"; POST is an UPSERT (an unknown key appends); POST
  validates, then stores the RAW body as sent (with `id` first for automations and scenes); success `{"result": "ok"}`; an invalid body: 400 "Message malformed: ...".
- After a POST, `automation.reload {id}` (only that automation), `script.reload` (a diff) and `scene.reload` (all UI scenes) run as Home Assistant does; after a
  DELETE the registry entry (and so the entity) is removed and nothing reloads.
- `include_loaded=False`: the include line of the file is missing, so a write never loads (U-5).
- An invalid automation is an `unavailable` entity (a repairs issue is recorded in `repairs`).
- The config REST API and WS `automation/config` / `script/config` / `trace/*` / `validate_config` are admin-only: `rest(..., admin=False)` answers 401.

`FakeTransport` is NOT here: the add-on seam is S1's (`services/ha_client`); this module offers `rest`, `ws` and `call_service` for it to wrap.
"""
from __future__ import annotations

import copy
import datetime as dt
import re
from typing import Any, Callable

import automations_seed as seed

UTC = dt.timezone.utc
MODES = ("single", "restart", "queued", "parallel")
TRIGGER_TYPES = {"state", "numeric_state", "time", "time_pattern", "sun", "homeassistant", "template", "device", "event", "zone", "mqtt", "webhook", "calendar", "tag", "geo_location", "conversation", "persistent_notification", "sentence"}
CONDITION_TYPES = {"state", "numeric_state", "time", "sun", "trigger", "and", "or", "not", "template", "device", "zone"}
STEP_KEYS = {"action", "service", "delay", "choose", "if", "repeat", "condition", "stop", "variables", "wait_template", "wait_for_trigger", "parallel", "sequence", "event", "scene",
             "set_conversation_response", "type", "device_id", "domain"}
AUTOMATION_KEYS = {"id", "alias", "description", "triggers", "trigger", "conditions", "condition", "actions", "action", "mode", "max", "max_exceeded", "variables", "trigger_variables", "initial_state",
                   "trace", "use_blueprint", "note", "enabled", "metadata"}
SCRIPT_KEYS = {"alias", "description", "icon", "mode", "max", "max_exceeded", "fields", "sequence", "variables", "trace", "note", "metadata"}
SCENE_KEYS = {"id", "name", "icon", "entities", "metadata"}
CONFIG_PATH = re.compile(r"^/api/config/(automation|script|scene)/config/([^/]+)$")
# HA 2026.10 (core#174083, homeassistant/helpers/config_validation.py): a state condition with `for` refuses an attribute, a list of
# states other than a one-item list, and a state that names an input helper. This is HA's own pattern for the last one.
INPUT_HELPER_STATE = re.compile(r"^input_(?:select|text|number|boolean|datetime)\.(?!.+__)(?!_)[\da-z_]+(?<!_)$")


def version_tuple(text: str) -> tuple[int, int]:
    """"2026.10.1" -> (2026, 10); anything unreadable counts as the newest profile."""
    m = re.match(r"^(\d{4})\.(\d{1,2})", str(text or ""))
    return (int(m.group(1)), int(m.group(2))) if m else (9999, 0)


class FakeInvalid(Exception):
    """The body was rejected: becomes 400 "Message malformed: ..."."""


class FakeServiceError(Exception):
    """A service call failed inside Home Assistant (unknown entity, bad data)."""


def slug(text: str) -> str:
    return re.sub(r"[^a-z0-9]+", "_", (text or "").lower()).strip("_")


def canon(v: Any) -> str:
    import json

    return json.dumps(v, sort_keys=True, separators=(",", ":"), ensure_ascii=False)


class FakeHaConfig:
    def __init__(self, installed: bool = True, config_api: bool = True, include_loaded: bool = True, now: Callable[[], dt.datetime] | None = None,
                 ha_version: str = "2026.9.4", reload_drops_dynamic_scenes: bool = True) -> None:
        self.installed, self.config_api, self.include_loaded = installed, config_api, include_loaded
        self.ha_version = ha_version  # also the validation profile: 2026.9 (probatio wording), 2026.10 (+ the `for` rule of core#174083)
        self.reload_drops_dynamic_scenes = reload_drops_dynamic_scenes
        self._clock = now
        self._t = dt.datetime(2026, 10, 1, 15, 46, 0, tzinfo=UTC)
        self.automations: list[dict[str, Any]] = []  # automations.yaml (a list; `id` per entry)
        self.scripts: dict[str, dict[str, Any]] = {}  # scripts.yaml (a dict keyed by object id)
        self.scenes: list[dict[str, Any]] = []  # scenes.yaml (a list)
        self.states: dict[str, dict[str, Any]] = {}
        self.registry: list[dict[str, Any]] = []
        self.traces: dict[tuple[str, str], list[dict[str, Any]]] = {}  # (domain, item_id) -> runs, newest last (5 kept)
        self.events: list[dict[str, Any]] = []
        self.calls: list[dict[str, Any]] = []  # runtime service calls
        self.rest_calls: list[tuple[str, str]] = []
        self.repairs: list[dict[str, Any]] = []
        self.fail_next: dict[str, Any] = {}  # op -> (status, message) for REST ops ("GET", "POST", "DELETE"), or an Exception for "call:<domain>.<service>"
        self.yaml_items: dict[str, dict[str, Any]] = {}  # entity_id -> config of an automation defined outside the files (WS answers, REST 404)
        self._loaded_auto: dict[str, dict[str, Any]] = {}  # config id -> the config HA's runtime loaded (what the entity runs)
        self._entity_of: dict[tuple[str, str], str] = {}  # (kind, config id) -> entity id
        self._counter = 0
        self._run_counter = 0
        self.subscribed: set[str] = set()
        self.hold_script_runs = False  # True: a started script stays `current: 1` until `finish_script_runs()`
        self.floors = dict(seed.FLOORS)
        self.areas = dict(seed.AREAS)

    @property
    def version(self) -> tuple[int, int]:
        return version_tuple(self.ha_version)

    # ------------------------------------------------------------------ clock and small helpers

    def now(self) -> dt.datetime:
        return self._clock() if self._clock else self._t

    def advance(self, seconds: float) -> None:
        if self._clock is None:
            self._t += dt.timedelta(seconds=seconds)

    def iso(self) -> str:
        return self.now().astimezone(UTC).isoformat().replace("+00:00", "Z")

    def _next(self, prefix: str) -> str:
        self._counter += 1
        return f"{prefix}{self._counter:04d}"

    def _unique_entity(self, domain: str, base: str) -> str:
        base = slug(base) or domain
        eid = f"{domain}.{base}"
        n = 2
        while eid in self.states or any(r["entity_id"] == eid for r in self.registry):
            eid = f"{domain}.{base}_{n}"
            n += 1
        return eid

    # ------------------------------------------------------------------ the world and the seed

    def add_world(self) -> None:
        for eid, (name, area) in seed.WORLD.items():
            if eid in ("switch.boiler",):  # the dangling reference of the probe's system K: no state, no registry row
                continue
            base = seed.WORLD_STATES.get(eid, {"state": "off"})
            self.states[eid] = {"entity_id": eid, "state": base["state"], "attributes": {"friendly_name": name, **(base.get("attributes") or {})}, "last_changed": self.iso()}
            self.registry.append(self._reg_row(eid, platform=eid.split(".")[0] + "_fake", unique_id=eid, area=area, name=name))

    def _reg_row(self, entity_id: str, *, platform: str, unique_id: str, area: str | None = None, name: str | None = None) -> dict[str, Any]:
        return {"entity_id": entity_id, "unique_id": unique_id, "platform": platform, "area_id": area, "device_id": None, "disabled_by": None, "hidden_by": None, "entity_category": None,
                "has_entity_name": False, "icon": None, "id": f"reg{len(self.registry) + 1:05d}", "labels": [], "name": None, "options": {}, "original_name": name, "translation_key": None}

    @classmethod
    def seed_probe_like(cls, **kw: Any) -> "FakeHaConfig":
        """The synthetic population of automations_seed.py: ~46 automations (the probe's distributions), 9 scripts, 21 scenes, a YAML-managed and a no-id automation."""
        f = cls(**kw)
        f.add_world()
        for eid, cid, cfg in seed.fixture_house_automations():
            f._seed_automation(eid, cid, cfg, True)
        for eid, cid, cfg, enabled in seed.extra_automations():
            f._seed_automation(eid, cid, cfg, enabled)
        eid, cid, cfg, enabled = seed.legacy_extra()
        f._seed_automation(eid, cid, cfg, enabled)
        for key, cfg in seed.fixture_house_scripts() + seed.extra_scripts():
            f.scripts[key] = copy.deepcopy(cfg)
            f._seed_script_entity(key, cfg)
        for eid in seed.INTEGRATION_SCENES:
            f.states[eid] = {"entity_id": eid, "state": "unknown", "attributes": {"friendly_name": f"סצנה {eid.split('.')[1]}"}, "last_changed": f.iso()}
            f.registry.append(f._reg_row(eid, platform="wallswitch" if "wall" in eid else "hub", unique_id=f"hw-{eid.split('.')[1]}"))
        eid, cid, cfg = seed.fixture_house_scene()
        f.scenes.append(copy.deepcopy(cfg))
        f._seed_scene_entity(eid, cid, cfg)
        # a YAML-managed automation: entity + id attribute, NOT in automations.yaml (REST 404, WS answers); one without any id (no registry row)
        eid, cid, cfg = seed.YAML_AUTOMATION
        f.yaml_items[eid] = {"id": cid, **cfg}
        f.states[eid] = {"entity_id": eid, "state": "on", "attributes": {"friendly_name": cfg["alias"], "id": cid, "mode": cfg["mode"], "current": 0, "last_triggered": None}, "last_changed": f.iso()}
        f.registry.append(f._reg_row(eid, platform="automation", unique_id=cid))
        eid, cfg = seed.NO_ID_AUTOMATION
        f.yaml_items[eid] = dict(cfg)
        f.states[eid] = {"entity_id": eid, "state": "on", "attributes": {"friendly_name": cfg["alias"], "mode": cfg["mode"], "current": 0, "last_triggered": None}, "last_changed": f.iso()}
        # one automation HA could not load: the entity is `unavailable` and a repairs issue says why
        f.mark_invalid("automation.garden_sunset", "validation_failed")
        f.seed_traces()
        return f

    def _seed_automation(self, entity_id: str, config_id: str, config: dict[str, Any], enabled: bool) -> None:
        self.automations.append(copy.deepcopy(config))
        self._entity_of[("automation", config_id)] = entity_id
        self._loaded_auto[config_id] = copy.deepcopy(config)
        self.states[entity_id] = {"entity_id": entity_id, "state": "on" if enabled else "off", "last_changed": self.iso(),
                                  "attributes": {"friendly_name": config.get("alias", ""), "id": config_id, "mode": config.get("mode", "single"), "current": 0, "last_triggered": None,
                                                 **({"max": config["max"]} if "max" in config else {})}}
        self.registry.append(self._reg_row(entity_id, platform="automation", unique_id=config_id))

    def _seed_script_entity(self, key: str, config: dict[str, Any]) -> None:
        eid = f"script.{key}"
        self._entity_of[("script", key)] = eid
        self.states[eid] = {"entity_id": eid, "state": "off", "last_changed": self.iso(),
                            "attributes": {"friendly_name": config.get("alias", key), "mode": config.get("mode", "single"), "current": 0, "last_triggered": None,
                                           **({"icon": config["icon"]} if "icon" in config else {})}}
        self.registry.append(self._reg_row(eid, platform="script", unique_id=key))

    def _seed_scene_entity(self, entity_id: str, config_id: str, config: dict[str, Any]) -> None:
        self._entity_of[("scene", config_id)] = entity_id
        self.states[entity_id] = {"entity_id": entity_id, "state": "unknown", "last_changed": self.iso(),
                                  "attributes": {"friendly_name": config.get("name", ""), "id": config_id, "entity_id": list(config.get("entities", {}))}}
        self.registry.append(self._reg_row(entity_id, platform="homeassistant", unique_id=config_id))

    def mark_invalid(self, entity_id: str, reason: str = "validation_failed") -> None:
        self.states[entity_id]["state"] = "unavailable"
        self.states[entity_id]["attributes"]["restored"] = True
        self.repairs.append({"issue_id": f"{reason}_{entity_id}", "domain": "automation", "entity_id": entity_id, "severity": "error"})

    # ------------------------------------------------------------------ traces

    def seed_traces(self) -> None:
        for kind, key in (("automation", "automation.hall_motion"), ("automation", "automation.bed_ac_clock"), ("automation", "automation.door_open"), ("automation", "automation.hall_night"),
                          ("automation", "automation.salon_ac_morning"), ("automation", "automation.secret_notify")):
            cid = next(c for (k, c), e in self._entity_of.items() if k == kind and e == key)
            cfg = next(a for a in self.automations if a.get("id") == cid)
            for i in range(3):
                self.add_run("automation", cid, cfg, trigger_index=i % max(1, len(cfg.get("triggers") or [1])), minutes_ago=30 * (3 - i))
        for key in ("good_morning", "vacation"):
            self.add_run("script", key, self.scripts[key], minutes_ago=90)

    def add_run(self, domain: str, item_id: str, config: dict[str, Any], *, trigger_index: int = 0, minutes_ago: float = 0, user_id: str | None = None, fail_step: str | None = None,
                variables: dict[str, Any] | None = None, conditions_pass: bool = True) -> dict[str, Any]:
        """One stored run in HA's shape (V-SRC `trace/get`): `trace` = path -> list of steps with `timestamp`, `changed_variables`, `result`, `error`."""
        start = self.now() - dt.timedelta(minutes=minutes_ago)
        self._run_counter += 1
        run_id = f"{start.strftime('%H%M%S')}{self._run_counter:06d}"
        steps: dict[str, list[dict[str, Any]]] = {}
        t = start

        def stamp(offset: float = 0.0) -> str:
            return (t + dt.timedelta(seconds=offset)).astimezone(UTC).isoformat().replace("+00:00", "+00:00")

        trig_list = config.get("triggers") if domain == "automation" else None
        trig = (trig_list[trigger_index] if trig_list and trigger_index < len(trig_list) else {"trigger": "manual"})
        description = f"{trig.get('trigger')} of {(trig.get('entity_id') or [''])[0]}" if isinstance(trig, dict) and trig.get("entity_id") else str(trig.get("trigger") if isinstance(trig, dict) else "manual")
        if domain == "automation":
            steps[f"trigger/{trigger_index}"] = [{"path": f"trigger/{trigger_index}", "timestamp": stamp(),
                                                  "changed_variables": {"trigger": {"idx": str(trigger_index), "platform": trig.get("trigger") if isinstance(trig, dict) else "manual",
                                                                                    "id": (trig.get("id") if isinstance(trig, dict) else None) or str(trigger_index), "description": description}}}]
            for i, c in enumerate(config.get("conditions") or []):
                steps[f"condition/{i}"] = [{"path": f"condition/{i}", "timestamp": stamp(0.01), "result": {"result": conditions_pass, "entities": []}}]
        last = "action/0"
        failed = False
        seq = config.get("actions") if domain == "automation" else config.get("sequence")
        if conditions_pass or domain != "automation":
            for i, step in enumerate(seq or []):
                path = f"action/{i}" if domain == "automation" else f"sequence/{i}"
                entry: dict[str, Any] = {"path": path, "timestamp": stamp(0.02 + i * 0.1), "changed_variables": {}}
                if isinstance(step, dict) and ("action" in step or "service" in step):
                    entry["result"] = {"params": {"domain": str(step.get("action", step.get("service"))).split(".")[0], "service": str(step.get("action", step.get("service"))).split(".")[-1],
                                                  "service_data": dict((step.get("data") or {})), "target": step.get("target") or {}}, "running_script": False, "limit": 10}
                if variables and i == 0:
                    entry["changed_variables"] = dict(variables)
                if fail_step == path:
                    entry["error"] = "Entity not found"
                    failed = True
                steps[path] = [entry]
                last = path
                if failed:
                    break
        run = {"run_id": run_id, "domain": domain, "item_id": item_id, "state": "stopped", "script_execution": "failed_runtime" if failed else "finished" if conditions_pass else "failed_conditions",
               "last_step": last, "timestamp": {"start": stamp(), "finish": stamp(1.0)}, "trigger": description,
               "trace": steps, "config": copy.deepcopy(config), "context": {"id": f"ctx{self._run_counter:08d}", "parent_id": None, "user_id": user_id},
               "blueprint_inputs": None, **({"error": "Entity not found"} if failed else {})}
        runs = self.traces.setdefault((domain, item_id), [])
        runs.append(run)
        del runs[:-5]  # HA keeps 5 per item by default
        return run

    # ------------------------------------------------------------------ the file layer (what the bridge's store reads and writes)

    def file_item(self, kind: str, item_id: str) -> dict[str, Any] | None:
        """The item as the config GET answers it: automations and scenes carry their `id`, scripts do not."""
        if kind == "script":
            return copy.deepcopy(self.scripts[item_id]) if item_id in self.scripts else None
        data = self.automations if kind == "automation" else self.scenes
        return next((copy.deepcopy(x) for x in data if x.get("id") == item_id), None)

    # ------------------------------------------------------------------ REST: /api/config/{automation|script|scene}/config/{key}

    def rest(self, method: str, path: str, body: Any = None, admin: bool = True) -> tuple[int, Any]:
        self.rest_calls.append((method, path))
        if not admin:
            return 401, "401: Unauthorized"
        failure = self.fail_next.pop(method, None)
        if failure:
            return failure
        m = CONFIG_PATH.match(path)
        if not m or not self.config_api or not self.installed:
            return 404, "404: Not Found"
        kind, key = m.group(1), m.group(2)
        if method == "GET":
            item = self.file_item(kind, key)
            return (200, item) if item is not None else (404, {"message": "Resource not found"})
        if method == "DELETE":
            if self.file_item(kind, key) is None:
                return 400, {"message": "Resource not found"}  # HA's DELETE of an unknown key is a 400
            self._remove_item(kind, key)
            return 200, {"result": "ok"}
        if method == "POST":
            if kind == "script" and not re.match(r"^[a-z0-9_]+$", key):
                return 400, {"message": "Key not valid"}
            if not isinstance(body, dict):
                return 400, {"message": "Invalid JSON specified"}
            try:
                self.validate(kind, body)
            except FakeInvalid as exc:
                return 400, {"message": f"Message malformed: {exc}"}
            self._store_item(kind, key, body)
            return 200, {"result": "ok"}
        return 405, "405: Method Not Allowed"

    def validate(self, kind: str, body: dict[str, Any]) -> None:
        """A small stand-in for `async_validate_config_item` / the scene schema: unknown keys, unknown trigger / step / condition types, bad mode."""
        keys = AUTOMATION_KEYS if kind == "automation" else SCRIPT_KEYS if kind == "script" else SCENE_KEYS
        for k in body:
            if k not in keys:
                # HA validates with probatio since 2026.9 (`f"{message} at '{path}'"`, "not a valid option" for an undeclared key - the
                # same wording fake_ha_core.py records for the login flow); voluptuous said "extra keys not allowed @ data[...]" before
                if self.version >= (2026, 9):
                    raise FakeInvalid(f"not a valid option at '{k}'")
                raise FakeInvalid(f"extra keys not allowed @ data['{k}']")
        if kind == "scene":
            if not isinstance(body.get("name"), str) or not body["name"]:
                raise FakeInvalid("required key not provided @ data['name']")
            if not isinstance(body.get("entities"), dict):
                raise FakeInvalid("required key not provided @ data['entities']")
            return
        if body.get("mode", "single") not in MODES:
            raise FakeInvalid(f"expected one of {list(MODES)} for dictionary value @ data['mode']")
        if kind == "automation":
            trig = body.get("triggers", body.get("trigger"))
            if trig is None:
                raise FakeInvalid("required key not provided @ data['triggers']")
            for i, t in enumerate(trig if isinstance(trig, list) else [trig]):
                self._check_trigger(t, f"triggers[{i}]")
            for i, c in enumerate(_as_list(body.get("conditions", body.get("condition")))):
                self._check_condition(c, f"conditions[{i}]")
            actions = body.get("actions", body.get("action"))
            if actions is None:
                raise FakeInvalid("required key not provided @ data['actions']")
            self._check_steps(actions, "actions")
        else:
            if "sequence" not in body:
                raise FakeInvalid("required key not provided @ data['sequence']")
            self._check_steps(body["sequence"], "sequence")

    def _check_trigger(self, t: Any, path: str) -> None:
        if isinstance(t, str):
            return
        if not isinstance(t, dict):
            raise FakeInvalid(f"expected a dictionary @ data['{path}']")
        typ = t.get("trigger", t.get("platform"))
        if not isinstance(typ, str) or (typ not in TRIGGER_TYPES and "." not in typ):
            raise FakeInvalid(f"Invalid trigger '{typ}' specified @ data['{path}']")

    def _check_condition(self, c: Any, path: str) -> None:
        if isinstance(c, str):
            return
        if not isinstance(c, dict) or c.get("condition") not in CONDITION_TYPES and "." not in str(c.get("condition")):
            raise FakeInvalid(f"Invalid condition \"{c.get('condition') if isinstance(c, dict) else c}\" specified @ data['{path}']")
        self._check_state_for(c, path)
        for i, k in enumerate(_as_list(c.get("conditions"))):
            self._check_condition(k, f"{path}.conditions[{i}]")

    def _check_state_for(self, c: dict[str, Any], path: str) -> None:
        """HA 2026.10 (core#174083), only on the 2026.10 profile."""
        if self.version >= (2026, 10) and c.get("condition") == "state" and c.get("for") is not None:
            state = c.get("state")
            one = state[0] if isinstance(state, list) and len(state) == 1 else state
            # the rule is core#174083's; the exact sentence is NOT verified against HA (only its probatio "<message> at '<path>'" shape)
            if "attribute" in c:
                raise FakeInvalid(f"'for' cannot be combined with 'attribute' at '{path}'")
            if isinstance(state, list) and len(state) != 1:
                raise FakeInvalid(f"'for' cannot be combined with a list of states at '{path}'")
            if isinstance(one, str) and INPUT_HELPER_STATE.match(one):
                raise FakeInvalid(f"'for' cannot be combined with a state from an input helper at '{path}'")

    def _check_steps(self, steps: Any, path: str) -> None:
        for i, s in enumerate(_as_list(steps)):
            p = f"{path}[{i}]"
            if isinstance(s, str):
                continue
            if not isinstance(s, dict):
                raise FakeInvalid(f"expected a dictionary @ data['{p}']")
            if not any(k in s for k in STEP_KEYS):
                raise FakeInvalid(f"Unable to determine action @ data['{p}']")
            if "condition" in s:  # a condition step: only the 2026.10 `for` rule (its type check stays as before)
                self._check_state_for(s, p)
            for k in ("action", "service"):
                if k in s and (not isinstance(s[k], str) or ("." not in s[k] and "{{" not in s[k])):
                    raise FakeInvalid(f"Service {s[k]} does not match format <domain>.<name> @ data['{p}']")
            if "choose" in s:
                for j, o in enumerate(_as_list(s["choose"])):
                    for k, c in enumerate(_as_list((o or {}).get("conditions"))):
                        self._check_condition(c, f"{p}.choose[{j}].conditions[{k}]")
                    self._check_steps((o or {}).get("sequence", []), f"{p}.choose[{j}].sequence")
                if "default" in s:
                    self._check_steps(s["default"], f"{p}.default")
            if "if" in s:
                for k, c in enumerate(_as_list(s["if"])):
                    self._check_condition(c, f"{p}.if[{k}]")
                self._check_steps(s.get("then", []), f"{p}.then")
                if "else" in s:
                    self._check_steps(s["else"], f"{p}.else")
            if "repeat" in s and isinstance(s["repeat"], dict) and "sequence" in s["repeat"]:
                self._check_steps(s["repeat"]["sequence"], f"{p}.repeat.sequence")

    def _store_item(self, kind: str, key: str, body: dict[str, Any]) -> None:
        body = copy.deepcopy(body)
        if kind == "script":
            self.scripts[key] = body
            self._reload_scripts()
            return
        data = self.automations if kind == "automation" else self.scenes
        value = {"id": key}
        value.update(body)  # HA: `updated_value = {CONF_ID: key}; updated_value.update(new_value)` - `id` first, the body's order after
        for i, cur in enumerate(data):
            if cur.get("id") == key:
                data[i] = value
                break
        else:
            data.append(value)
        if kind == "automation":
            self.reload_automation(key)
        else:
            self.reload_scenes()

    def _remove_item(self, kind: str, key: str) -> None:
        if kind == "script":
            del self.scripts[key]
            self._drop_entity(kind, key)
            return
        data = self.automations if kind == "automation" else self.scenes
        data[:] = [x for x in data if x.get("id") != key]
        if kind == "automation":
            self._loaded_auto.pop(key, None)
        self._drop_entity(kind, key)

    def _drop_entity(self, kind: str, key: str) -> None:
        eid = self._entity_of.pop((kind, key), None)
        if eid:
            self.states.pop(eid, None)
            self.registry[:] = [r for r in self.registry if r["entity_id"] != eid]

    # ------------------------------------------------------------------ reload semantics

    def reload_automation(self, config_id: str | None = None) -> None:
        """`automation.reload` with an id reloads ONLY that automation; without one, all. With the include line missing nothing loads (U-5)."""
        if not self.include_loaded:
            return
        ids = [config_id] if config_id else [a.get("id") for a in self.automations if a.get("id")]
        for cid in ids:
            cfg = next((a for a in self.automations if a.get("id") == cid), None)
            if cfg is None:
                self._loaded_auto.pop(cid, None)
                self._drop_entity("automation", cid)
                continue
            self._loaded_auto[cid] = copy.deepcopy(cfg)
            eid = self._entity_of.get(("automation", cid))
            if eid is None:
                eid = self._unique_entity("automation", slug(str(cfg.get("alias", ""))) or f"automation_{cid[-4:]}")
                self._entity_of[("automation", cid)] = eid
                self.registry.append(self._reg_row(eid, platform="automation", unique_id=cid))
                self.states[eid] = {"entity_id": eid, "state": "on", "last_changed": self.iso(), "attributes": {}}
            st = self.states[eid]
            keep = st["attributes"].get("last_triggered")
            st["attributes"] = {"friendly_name": cfg.get("alias", ""), "id": cid, "mode": cfg.get("mode", "single"), "current": 0, "last_triggered": keep,
                                **({"max": cfg["max"]} if "max" in cfg else {})}
            if st["state"] == "unavailable":
                st["state"] = "on"
        self._event("automation_reloaded", {"domain": "automation"})

    def _reload_scripts(self) -> None:
        """`script.reload` applies the DIFF of scripts.yaml against what is loaded."""
        if not self.include_loaded:
            return
        for key, cfg in self.scripts.items():
            eid = self._entity_of.get(("script", key))
            if eid is None:
                self._seed_script_entity(key, cfg)
            else:
                st = self.states[eid]["attributes"]
                st.update({"friendly_name": cfg.get("alias", key), "mode": cfg.get("mode", "single")})
        for (kind, key), eid in list(self._entity_of.items()):
            if kind == "script" and key not in self.scripts:
                self._drop_entity("script", key)

    def reload_scenes(self) -> None:
        """`scene.reload` reloads ALL scenes of scenes.yaml (no diff); dynamic scenes (`scene.create`) are dropped when `reload_drops_dynamic_scenes`."""
        if not self.include_loaded:
            return
        wanted = {c.get("id"): c for c in self.scenes if c.get("id")}
        for cid, cfg in wanted.items():
            eid = self._entity_of.get(("scene", cid))
            if eid is None:
                eid = self._unique_entity("scene", slug(str(cfg.get("name", ""))) or f"scene_{cid[-4:]}")
                self._seed_scene_entity(eid, cid, cfg)
            else:
                self.states[eid]["attributes"].update({"friendly_name": cfg.get("name", ""), "entity_id": list(cfg.get("entities", {}))})
        for (kind, key), eid in list(self._entity_of.items()):
            if kind == "scene" and key not in wanted:
                self._drop_entity("scene", key)
        if self.reload_drops_dynamic_scenes:
            for eid in [e for e, s in self.states.items() if e.startswith("scene.") and s["attributes"].get("dynamic")]:
                self.states.pop(eid, None)
        self._event("scene_reloaded", {"domain": "scene"})

    def _event(self, event_type: str, data: dict[str, Any], user_id: str | None = None) -> None:
        self._counter += 1
        self.events.append({"event_type": event_type, "data": data, "time_fired": self.iso(), "context": {"id": f"evt{self._counter:06d}", "parent_id": None, "user_id": user_id}})

    def drain_events(self, event_type: str | None = None) -> list[dict[str, Any]]:
        out = [e for e in self.events if event_type is None or e["event_type"] == event_type]
        self.events = [e for e in self.events if e not in out]
        return out

    # ------------------------------------------------------------------ the runtime services

    def entity_registry_entry(self, entity_id: str) -> dict[str, Any] | None:
        return next((r for r in self.registry if r["entity_id"] == entity_id), None)

    def call_service(self, domain: str, service: str, data: dict[str, Any] | None = None, *, user_id: str | None = None) -> dict[str, Any]:
        data = copy.deepcopy(data or {})
        self.calls.append({"domain": domain, "service": service, "data": copy.deepcopy(data), "user_id": user_id})
        failure = self.fail_next.pop(f"call:{domain}.{service}", None)
        if isinstance(failure, Exception):
            raise failure
        if (domain, service) == ("automation", "reload"):
            self.reload_automation(data.get("id"))
            return {}
        if (domain, service) == ("script", "reload"):
            self._reload_scripts()
            return {}
        if (domain, service) == ("scene", "reload"):
            self.reload_scenes()
            return {}
        if domain == "automation":
            return self._automation_service(service, data, user_id)
        if domain == "script":
            return self._script_service(service, data, user_id)
        if domain == "scene":
            return self._scene_service(service, data, user_id)
        raise FakeServiceError(f"service {domain}.{service} not found")

    def _targets(self, data: dict[str, Any], platform: str) -> list[str]:
        raw = data.get("entity_id")
        ids = [raw] if isinstance(raw, str) else list(raw or [])
        for eid in ids:
            reg = self.entity_registry_entry(eid)
            if eid not in self.states or reg is None and not self.states[eid]["attributes"].get("dynamic"):
                raise FakeServiceError(f"Referenced entities {eid} are missing or not currently available")
        return ids

    def _automation_service(self, service: str, data: dict[str, Any], user_id: str | None) -> dict[str, Any]:
        ids = self._targets(data, "automation")
        for eid in ids:
            st = self.states[eid]
            if service == "turn_on":
                st["state"] = "on"
            elif service == "turn_off":
                st["state"] = "off"
            elif service == "toggle":
                st["state"] = "off" if st["state"] == "on" else "on"
            elif service == "trigger":
                skip = data.get("skip_condition", True)  # HA's default
                if st["state"] == "unavailable":
                    raise FakeServiceError("automation is unavailable")
                cid = st["attributes"].get("id")
                cfg = self._loaded_auto.get(cid) or self.yaml_items.get(eid) or {}
                ok = bool(skip) or self._conditions_hold(cfg)
                st["attributes"]["last_triggered"] = self.iso()
                self._event("automation_triggered", {"name": st["attributes"].get("friendly_name"), "entity_id": eid, "source": "service call"}, user_id)
                if cid:
                    run = self.add_run("automation", cid, cfg, user_id=user_id, conditions_pass=ok)
                    run["trigger"] = "manual"
                if ok:
                    self._apply_actions(cfg.get("actions") or [])
            else:
                raise FakeServiceError(f"service automation.{service} not found")
        return {}

    def _script_service(self, service: str, data: dict[str, Any], user_id: str | None) -> dict[str, Any]:
        if service in ("turn_on", "turn_off", "toggle"):
            keys = [e.split(".", 1)[1] for e in self._targets(data, "script")]
        elif service in self.scripts:
            keys = [service]  # `script.<key>`: the fields arrive as data and the call WAITS until the run ends
            data = {"variables": {k: v for k, v in data.items() if k != "entity_id"}}
        else:
            raise FakeServiceError(f"service script.{service} not found")
        for key in keys:
            eid = f"script.{key}"
            st = self.states[eid]
            if service == "turn_off":
                st["attributes"]["current"] = 0
                st["state"] = "off"
                continue
            st["attributes"]["last_triggered"] = self.iso()
            st["attributes"]["current"] = 1 if self.hold_script_runs else 0
            st["state"] = "on" if self.hold_script_runs else "off"
            self._event("script_started", {"name": st["attributes"].get("friendly_name"), "entity_id": eid}, user_id)
            self.add_run("script", key, self.scripts[key], user_id=user_id, variables=data.get("variables"))
            self._apply_actions(self.scripts[key].get("sequence") or [])
        return {}

    def finish_script_runs(self) -> None:
        for (kind, key), eid in self._entity_of.items():
            if kind == "script":
                self.states[eid]["attributes"]["current"] = 0
                self.states[eid]["state"] = "off"

    def _scene_service(self, service: str, data: dict[str, Any], user_id: str | None) -> dict[str, Any]:
        if service == "create":
            sid = str(data.get("scene_id") or "")
            if not re.match(r"^[a-z0-9_]+$", sid):
                raise FakeServiceError("invalid scene id")
            members = list(data.get("snapshot_entities") or (data.get("entities") or {}))
            self.states[f"scene.{sid}"] = {"entity_id": f"scene.{sid}", "state": "unknown", "last_changed": self.iso(),
                                           "attributes": {"friendly_name": sid, "entity_id": members, "dynamic": True, "snapshot": {e: copy.deepcopy(self.states.get(e)) for e in members}}}
            return {}
        if service == "delete":
            ids = [e for e in self._targets(data, "scene")]
            for eid in ids:
                if not self.states[eid]["attributes"].get("dynamic"):
                    raise FakeServiceError("Scene is not a dynamically created scene")
                del self.states[eid]
            return {}
        if service == "apply":
            for eid, v in (data.get("entities") or {}).items():
                self._set_state(eid, v)
            return {}
        if service == "turn_on":
            for eid in self._targets(data, "scene"):
                st = self.states[eid]
                st["state"] = self.iso()
                cid = st["attributes"].get("id")
                cfg = next((s for s in self.scenes if s.get("id") == cid), None)
                snap = st["attributes"].get("snapshot")
                if cfg:
                    for m, v in cfg["entities"].items():
                        self._set_state(m, v)
                elif snap:
                    for m, prior in snap.items():
                        if prior:
                            self.states[m] = copy.deepcopy(prior)
            return {}
        raise FakeServiceError(f"service scene.{service} not found")

    def _set_state(self, entity_id: str, value: Any) -> None:
        st = self.states.get(entity_id)
        if st is None:
            return
        if isinstance(value, dict):
            st["state"] = str(value.get("state", st["state"]))
            st["attributes"].update({k: v for k, v in value.items() if k != "state"})
        else:
            st["state"] = str(value)

    def _apply_actions(self, steps: list[Any]) -> None:
        """A tiny effect model for typed device services so the world changes visibly (turn_on / turn_off / open / close / alarm)."""
        for s in steps:
            if not isinstance(s, dict):
                continue
            for sub in (s.get("sequence") or [], (s.get("repeat") or {}).get("sequence") or [], s.get("then") or [], s.get("default") or []):
                self._apply_actions(sub)
            for o in s.get("choose") or []:
                self._apply_actions((o or {}).get("sequence") or [])
            svc = s.get("action") or s.get("service")
            if not isinstance(svc, str) or "." not in svc:
                continue
            tgt = (s.get("target") or {}).get("entity_id") or s.get("entity_id") or []
            ids = [tgt] if isinstance(tgt, str) else list(tgt)
            word = {"turn_on": "on", "turn_off": "off", "open_cover": "open", "close_cover": "closed", "lock": "locked", "unlock": "unlocked", "alarm_disarm": "disarmed",
                    "alarm_arm_away": "armed_away", "alarm_arm_home": "armed_home", "alarm_arm_night": "armed_night"}.get(svc.split(".")[1])
            for eid in ids:
                if word and isinstance(eid, str) and eid in self.states and not eid.startswith(("automation.", "script.", "scene.")):
                    self.states[eid]["state"] = word

    def _conditions_hold(self, cfg: dict[str, Any]) -> bool:
        for c in cfg.get("conditions") or []:
            if not isinstance(c, dict):
                continue
            ids = c.get("entity_id")
            ids = [ids] if isinstance(ids, str) else list(ids or [])
            if c.get("condition") == "state" and ids:
                want = c.get("state")
                want = want if isinstance(want, list) else [want]
                if self.states.get(ids[0], {}).get("state") not in want:
                    return False
            if c.get("condition") == "numeric_state" and ids:
                try:
                    v = float(self.states[ids[0]]["state"])
                except (KeyError, ValueError):
                    return False
                if "above" in c and not v > c["above"] or "below" in c and not v < c["below"]:
                    return False
        return True

    # ------------------------------------------------------------------ WebSocket

    def ws(self, msg: dict[str, Any], admin: bool = True) -> dict[str, Any]:
        """The result envelope of one command: `{"success": True, "result": ...}` or `{"success": False, "error": {"code", "message"}}`."""
        t = msg.get("type")

        def ok(result: Any) -> dict[str, Any]:
            return {"success": True, "result": copy.deepcopy(result)}

        def err(code: str, message: str) -> dict[str, Any]:
            return {"success": False, "error": {"code": code, "message": message}}

        if t == "get_config":
            return ok({"version": self.ha_version, "config_dir": "/config", "location_name": "Home", "time_zone": "Asia/Jerusalem",
                       "components": ["automation", "script", "scene", "config", "trace", "blueprint", "websocket_api", "api", "device_automation"]})  # `config.automation` & co are NOT listed (the probe's finding)
        if t == "render_template":
            return ok(None)
        if t == "call_service":
            try:
                self.call_service(str(msg.get("domain")), str(msg.get("service")), dict(msg.get("service_data") or {}), user_id=msg.get("_user_id"))
            except FakeServiceError as exc:
                return err("home_assistant_error", str(exc))
            return ok({"context": {"id": "ctx", "parent_id": None, "user_id": msg.get("_user_id")}})
        if t == "get_states":
            return ok(list(self.states.values()))
        if t == "get_services":
            return ok({d: {s: {"name": s, "description": "", "fields": {}} for s in svcs} for d, svcs in seed.SERVICES.items()})
        if t == "config/entity_registry/list":
            return ok(self.registry)
        if t == "config/label_registry/list":
            return ok([{"label_id": "night", "name": "לילה", "icon": None, "color": None, "description": None}])
        if t == "config/category_registry/list":
            return ok([{"category_id": "cat_lights", "name": "תאורה", "icon": None}] if msg.get("scope") == "automation" else [])
        if t == "config/floor_registry/list":
            return ok([{"floor_id": fid, "name": n, "level": i, "icon": None, "aliases": []} for i, (fid, n) in enumerate(self.floors.items())])
        if t == "config/area_registry/list":
            return ok([{"area_id": a, "name": n, "floor_id": seed.AREA_FLOOR.get(a), "labels": [], "aliases": []} for a, n in self.areas.items()])
        if t == "subscribe_events":
            self.subscribed.add(str(msg.get("event_type")))
            return ok(None)
        if not admin:
            return err("unauthorized", "Unauthorized")
        if t in ("automation/config", "script/config"):
            eid = msg.get("entity_id")
            domain = t.split("/")[0]
            if not isinstance(eid, str) or not eid.startswith(domain + ".") or eid not in self.states:
                return err("not_found", "Entity not found")
            if eid in self.yaml_items:
                return ok({"config": self.yaml_items[eid]})
            kind_key = next((k for k, e in self._entity_of.items() if e == eid), None)
            if kind_key is None:
                return err("not_found", "Entity not found")
            item = self.file_item(kind_key[0], kind_key[1])
            return ok({"config": item}) if item is not None else err("not_found", "Entity not found")
        if t == "trace/list":
            domain, item_id = msg.get("domain"), msg.get("item_id")
            runs = [r for (d, i), rs in self.traces.items() if d == domain and (item_id is None or i == item_id) for r in rs]
            short_keys = ("run_id", "domain", "item_id", "state", "script_execution", "last_step", "timestamp", "trigger")
            return ok([{k: r[k] for k in short_keys if k in r} for r in runs])
        if t == "trace/get":
            run = next((r for r in self.traces.get((msg.get("domain"), msg.get("item_id")), []) if r["run_id"] == msg.get("run_id")), None)
            return ok(run) if run else err("not_found", "The trace was not found")
        if t == "validate_config":
            out: dict[str, Any] = {}
            for key, check in (("triggers", self._check_trigger), ("conditions", self._check_condition), ("actions", self._check_steps)):
                if key in msg:
                    try:
                        if key == "actions":
                            check(msg[key], "actions")
                        else:
                            for i, x in enumerate(_as_list(msg[key])):
                                check(x, f"{key}[{i}]")
                        out[key] = {"valid": True, "error": None}
                    except FakeInvalid as exc:
                        out[key] = {"valid": False, "error": str(exc)}
            return ok(out)
        return err("unknown_command", f"Unknown command {t}")


def _as_list(v: Any) -> list[Any]:
    return [] if v is None else v if isinstance(v, list) else [v]


# ---------------------------------------------------------------------------------------------------- the bridge's `config_item` on the same state

class FakeUnauthorized(Exception):
    """Home Assistant's `Unauthorized`: the user's own policy refused an entity."""


class FakeContext:
    _n = 0

    def __init__(self, user_id: str | None = None) -> None:
        FakeContext._n += 1
        self.user_id, self.id = user_id, f"bctx{FakeContext._n:05d}"


class FakeUser:
    def __init__(self, uid: str, *, admin: bool = True, active: bool = True, allowed: set[str] | None = None, api: bool = True) -> None:
        from types import SimpleNamespace

        self.id, self.is_admin, self.is_active = uid, admin, active
        self.allowed = allowed  # None = every entity; else the entities the person may control
        self.checked: list[tuple[str, str]] = []
        self.permissions = SimpleNamespace(check_entity=self._check) if api else SimpleNamespace()

    def _check(self, entity_id: str, key: str) -> bool:
        self.checked.append((entity_id, key))
        return self.allowed is None or entity_id in self.allowed


class _Row:
    def __init__(self, row: dict[str, Any]) -> None:
        self.entity_id, self.unique_id, self.platform = row["entity_id"], row["unique_id"], row["platform"]


class _FakeRegistry:
    """The entity registry the bridge reads: `entities` (live), `async_get`, `async_remove`."""

    def __init__(self, hass: "FakeBridgeHass") -> None:
        self._hass = hass

    @property
    def entities(self) -> dict[str, _Row]:
        return {r["entity_id"]: _Row(r) for r in self._hass.fake.registry}

    def async_get(self, entity_id: str) -> _Row | None:
        return self._hass._reg_get(entity_id)

    def async_remove(self, entity_id: str) -> None:
        self._hass._reg_remove(entity_id)


class FakeBridgeHass:
    """Home Assistant as the bridge sees it, over a FakeHaConfig: the three YAML files of a temp directory are what the bridge's store reads and writes; a
    `*.reload` service pulls them into the fake (as Home Assistant's reload would) and then reloads. Users, an entity registry, states and services are duck-typed
    like the schedule tests' fake."""

    def __init__(self, fake: FakeHaConfig, config_dir: Any) -> None:
        from types import SimpleNamespace

        self.fake, self.config = fake, SimpleNamespace(config_dir=str(config_dir))
        self.users: dict[str, FakeUser] = {}
        self.denied: dict[tuple[str, str], bool] = {}  # (user id, entity id) the person's own policy refuses at the service
        self.calls: list[dict[str, Any]] = []
        self.auth = SimpleNamespace(async_get_user=self._get_user)
        self.services = SimpleNamespace(has_service=self._has, async_call=self._call)
        self.states = SimpleNamespace(get=self._state)
        self.registry = _FakeRegistry(self)
        self.pull_on_reload = True
        self.write_files()

    # the files
    def write_files(self) -> None:
        """Write the fake's current lists as the three files (the starting point of a bridge test)."""
        from pathlib import Path

        import bridge_loader

        store_mod = bridge_loader.load("config_store")
        d = Path(self.config.config_dir)
        d.mkdir(parents=True, exist_ok=True)
        store_mod.ConfigStore._atomic_write(d / "automations.yaml", store_mod._dump(self.fake.automations))
        store_mod.ConfigStore._atomic_write(d / "scripts.yaml", store_mod._dump(self.fake.scripts))
        store_mod.ConfigStore._atomic_write(d / "scenes.yaml", store_mod._dump(self.fake.scenes))

    def pull_files(self) -> None:
        import bridge_loader

        store = bridge_loader.load("config_store").ConfigStore(self.config.config_dir)
        self.fake.automations[:] = store._read("automation")[0]
        self.fake.scripts.clear()
        self.fake.scripts.update(store._read("script")[0])
        self.fake.scenes[:] = store._read("scene")[0]

    # users
    async def _get_user(self, uid: str) -> FakeUser | None:
        return self.users.get(uid)

    # services
    def _has(self, domain: str, service: str) -> bool:
        if domain == "automation" and not self.fake.installed:
            return False
        return (domain, service) in {(d, s) for d in ("automation", "script", "scene") for s in ("reload", "turn_on", "turn_off", "trigger", "toggle", "apply", "create", "delete")}

    async def _call(self, domain: str, service: str, data: dict[str, Any], blocking: bool = False, context: Any = None) -> None:
        self.calls.append({"domain": domain, "service": service, "data": copy.deepcopy(data), "blocking": blocking, "context": context})
        uid = getattr(context, "user_id", None)
        user = self.users.get(uid) if uid else None
        if service != "reload" and user is not None and not user.is_admin:
            for eid in _as_list(data.get("entity_id")):
                if self.denied.get((uid, eid)):
                    raise FakeUnauthorized()
        if service == "reload" and self.pull_on_reload:
            self.pull_files()
        self.fake.call_service(domain, service, data, user_id=uid)

    # states and the registry
    def _state(self, entity_id: str) -> Any:
        from types import SimpleNamespace

        st = self.fake.states.get(entity_id)
        return SimpleNamespace(state=st["state"], attributes=st["attributes"]) if st else None

    def _reg_get(self, entity_id: str) -> _Row | None:
        r = self.fake.entity_registry_entry(entity_id)
        return _Row(r) if r else None

    def _reg_remove(self, entity_id: str) -> None:
        for (kind, key), eid in list(self.fake._entity_of.items()):
            if eid == entity_id:
                self.fake._entity_of.pop((kind, key))
        self.fake.states.pop(entity_id, None)
        self.fake.registry[:] = [r for r in self.fake.registry if r["entity_id"] != entity_id]


def _bridge_hass(fake: FakeHaConfig) -> FakeBridgeHass:
    if getattr(fake, "_bridge", None) is None:
        import tempfile

        fake._bridge_tmp = tempfile.TemporaryDirectory(prefix="fake-ha-config-")
        fake._bridge = FakeBridgeHass(fake, fake._bridge_tmp.name)
    return fake._bridge


def _bridge_deps(hass: FakeBridgeHass) -> Any:
    import asyncio
    from types import SimpleNamespace

    import bridge_loader

    store_mod = bridge_loader.load("config_store")

    async def run_io(_hass: Any, fn: Callable[[], Any]) -> Any:
        return fn()

    async def validate(_hass: Any, kind: str, item_id: str, config: dict[str, Any]) -> tuple[str, str | None]:
        try:
            hass.fake.validate(kind, config)
        except FakeInvalid as exc:
            return "failed", str(exc)
        return "ok", None

    async def sleep(_s: float) -> None:
        await asyncio.sleep(0)

    return SimpleNamespace(Context=FakeContext, Unauthorized=FakeUnauthorized, ServiceValidationError=ValueError, POLICY_CONTROL="control", registry=lambda h: h.registry, run_io=run_io,
                           store=lambda h: store_mod.ConfigStore(h.config.config_dir), validate=validate, sleep=sleep)


async def _bridge_config_item_async(self: FakeHaConfig, signed: dict[str, Any], secret: str, *, delegated: bool = False, is_admin: bool = True, allowed: set[str] | None = None) -> dict[str, Any]:
    import bridge_loader

    signing = bridge_loader.load("signing")
    service = bridge_loader.load("config_service")
    hass = _bridge_hass(self)
    uid = signed.get("user_id", "u1")
    if uid not in hass.users:
        hass.users[uid] = FakeUser(uid, admin=is_admin, allowed=allowed)
    else:
        hass.users[uid].is_admin = is_admin
        hass.users[uid].allowed = allowed
    verifier = getattr(hass, "_verifier", None) or signing.Verifier(secret)
    hass._verifier = verifier
    return await service.async_handle_config_item(hass, verifier, dict(signed), delegated=lambda: delegated, deps=_bridge_deps(hass))


def _bridge_config_item(self: FakeHaConfig, signed: dict[str, Any], secret: str, delegated: bool = False, is_admin: bool = True, allowed: set[str] | None = None) -> dict[str, Any]:
    """The bridge 0.6.0 `config_item` service on this fake's state (module config_service.py with its real policy and file store): `signed` is the message the
    add-on built and signed with `secret`; `delegated` = the options-flow switch; `is_admin` = the calling HA user's flag; `allowed` = the entities a non-admin may
    control (None = all). Returns the bridge's answer dict. Synchronous (it runs its own event loop); use `bridge_config_item_async` inside one."""
    import asyncio

    return asyncio.run(_bridge_config_item_async(self, signed, secret, delegated=delegated, is_admin=is_admin, allowed=allowed))


FakeHaConfig.bridge_config_item = _bridge_config_item  # type: ignore[attr-defined]
FakeHaConfig.bridge_config_item_async = _bridge_config_item_async  # type: ignore[attr-defined]
FakeHaConfig.bridge_hass = _bridge_hass  # type: ignore[attr-defined]
