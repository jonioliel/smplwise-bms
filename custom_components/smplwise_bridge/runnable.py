"""0.9.2 (SVCIDENT3, the 2.7.0 security review S1 / S2): what an Arx-only person may RUN through the service identity, judged here,
independently of the add-on - the fences the extended mode needs before it may ever be turned on (CR-USR2 section 11.9 / 12).

Three checks, all only for a message that `service_identity.screen` accepted ON BEHALF OF an Arx-only person (a Home Assistant user's own
message is never judged here):

1. S1 (a) - the runnable allowlist. A script / scene / automation runs (`execute` `script.turn_on` / `scene.turn_on`, `config_item`
   `trigger` / `run_script` / `apply_scene`) only when its entity id is on THIS bridge's list - the options-flow field
   `local_identity_runnable`, empty by default, set by a Home Assistant administrator inside Home Assistant. The add-on has its own copy
   (`security.local_identity_runnable`); both must list the item. Refusal: `service_identity_not_runnable`.
2. S1 (b) - the impact check. The item's configuration is read (the UI files `scripts.yaml` / `automations.yaml` / `scenes.yaml`, the same
   store config_service.py writes) and walked - every step at any depth, and ONE level of a nested script / scene / automation call. It is
   refused (fail closed) when a step:
   - reaches a NEVER-LOCAL target (`lock.unlock`, `lock.open`, `alarm_control_panel.alarm_disarm`, `alarm_control_panel.alarm_arm_custom_bypass`,
     a scene that sets a lock to anything but `locked` or sets an alarm panel at all): `impact_never_local`;
   - calls a service outside the closed step allow-list (the everyday device pairs, plain arming and the owner's additions of 2026-10-18 -
     IMPACT_STEP_PAIRS, STEP_ADDITIONS): `impact_service_not_allowed`;
   - drives a cover (any cover service, or a scene setting a cover) whose `device_class` is not plainly a window covering - a door, a gate, a
     garage, a shutter, an unknown or missing class: `impact_physical_access` (owner 2026-10-18: when unsure, refuse);
   - calls a nested script / scene / automation that is not itself on the allowlist: `impact_nested_not_runnable` (owner 2026-10-18);
   - names its service or target by a template: `impact_template`;
   - targets anything but literal entity ids (an area, a device, a floor, a label, `all`, nothing): `impact_target_unresolved`;
   - is a device action (opaque: its `entity_id` is a registry id): `impact_device_action`; fires an event: `impact_event`;
   - is not a step shape this check knows: `impact_step_unknown`; nests a second level: `impact_nesting_too_deep`;
   - is too deep / too many steps to judge: `impact_too_large`;
   or when the item (or a nested one) cannot be found or read in those files: `impact_unknown_item`; or when the service user's Home Assistant
   entity policy does not allow controlling every entity the steps target: `impact_entity_policy`.
3. S2 - the service user's entity policy for every entity of a screened `execute` (`permissions.check_entity(entity_id, POLICY_CONTROL)`):
   `service_identity_entity_policy`; a target that is not a literal entity list: `service_identity_target`; a permission API that is missing
   or raises: `service_identity_policy_unavailable`. Home Assistant does not apply a user's entity policy to an in-process service call, so
   this is the second fence, independent of Arx's own scope computation (`ha_scope`).

The codes are a closed list (REFUSAL_CODES); answers carry the code only, never a config, a value or an entity of a step. Dependency-free
(Home Assistant is reached through config_service.ha_deps() lazily, or a test's `deps`).
"""
from __future__ import annotations

import logging
import re
from dataclasses import dataclass, field
from typing import Any, Iterable

from .config_policy import has_template
from .config_service import PLATFORM, entity_of, ha_deps
from .config_store import StoreError
from .service_identity import ALARM_PAIRS, DEVICE_PAIRS

_LOGGER = logging.getLogger(__name__)

RUNNABLE_RE = re.compile(r"^(script|scene|automation)\.[a-z0-9_]{1,100}$")
# 0.9.4 (EXTID-295, CR-USR2 12.4 item 4): the domains the options-flow picker offers - the same three RUNNABLE_RE admits
RUNNABLE_DOMAINS = ("automation", "scene", "script")
MAX_RUNNABLE = 100
ENTITY_RE = re.compile(r"^[a-z0-9_]+\.[a-z0-9_]+$")
SERVICE_RE = ENTITY_RE
MAX_DEPTH = 24
MAX_STEPS = 500

NOT_RUNNABLE = "service_identity_not_runnable"
TARGET_REFUSED = "service_identity_target"
POLICY_REFUSED = "service_identity_entity_policy"
POLICY_UNAVAILABLE = "service_identity_policy_unavailable"
IMPACT_CODES = frozenset({
    "impact_unknown_item", "impact_never_local", "impact_service_not_allowed", "impact_template", "impact_target_unresolved",
    "impact_device_action", "impact_event", "impact_step_unknown", "impact_nesting_too_deep", "impact_too_large", "impact_entity_policy",
    "impact_physical_access", "impact_nested_not_runnable",
})
REFUSAL_CODES = IMPACT_CODES | {NOT_RUNNABLE, TARGET_REFUSED, POLICY_REFUSED, POLICY_UNAVAILABLE}

# What a step of a runnable item may never reach, directly or one level down (doors, disarming, arming with the bypass set)
IMPACT_NEVER = frozenset({
    ("lock", "unlock"), ("lock", "open"), ("alarm_control_panel", "alarm_disarm"), ("alarm_control_panel", "alarm_arm_custom_bypass"),
})
# The closed allow-list of a step's service: what an Arx-only person may do directly under `devices.control` in the 2.6.4 tables (never a
# door, a script or a scene) plus plain arming. Anything else - notify, homeassistant.*, mqtt, shell / rest commands, input_* helpers outside
# the pairs, `*.toggle`, `automation.turn_on` - is refused (fail closed; the owner widens it by a change request, not by configuration).
IMPACT_STEP_PAIRS = frozenset(DEVICE_PAIRS | (ALARM_PAIRS - IMPACT_NEVER))
# The owner's additions to the closed step list (2026-10-18), each with its reason. Everything not named here stays refused.
STEP_ADDITIONS: dict[str, str] = {
    "notify.*": "a notification only informs a person; allowed with LITERAL message / title / data / target only - any template refuses the step",
    "light.toggle": "light: no physical-access effect",
    "switch.toggle": "switch.turn_on / turn_off are already in the step list; toggle reaches nothing more (a relay wired to a gate is the same "
                     "residual risk as turn_on: bounded by the allowlist and the service user's entity policy)",
    "fan.toggle": "fan: no physical-access effect",
    "input_boolean.toggle": "a helper flag: no device of its own",
    "media_player.toggle": "media power: no physical-access effect",
}
# Never toggled from a runnable item (owner 2026-10-18): cover (doors, gates, garages), lock, alarm panel, climate (a mode change can harm),
# siren, and anything else that can open or close a door or gate. They stay outside STEP_ADDITIONS on purpose.
TOGGLE_DOMAINS = frozenset({"light", "switch", "fan", "input_boolean", "media_player"})
TOGGLE_PAIRS = frozenset((d, "toggle") for d in TOGGLE_DOMAINS)
NOTIFY_KEYS = frozenset({"action", "service", "data", "target", "entity_id", "alias", "enabled", "continue_on_error"})
# A cover is driven by a runnable item only when its class is PLAINLY a window covering; a door / gate / garage / shutter / damper, an unknown
# or missing class is physical access or unsure - refused (owner 2026-10-18: "when unsure refuse").
COVER_SAFE_CLASSES = frozenset({"blind", "curtain", "shade", "awning"})
# The domains a runnable SCENE may set (a lock only to `locked`; an alarm panel never)
SCENE_DOMAINS = frozenset({"light", "switch", "fan", "cover", "climate", "media_player", "input_boolean", "input_number", "input_select", "select", "number",
                           "humidifier", "water_heater", "valve", "lock"})
NESTED_KINDS = ("script", "scene", "automation")
TARGET_KEYS = frozenset({"area_id", "device_id", "floor_id", "label_id"})
# Keys of a step that only orders other steps or waits (its children are walked); a step made only of these acts by itself on nothing
CONTROL_KEYS = frozenset({"choose", "default", "if", "then", "else", "repeat", "parallel", "sequence", "conditions", "delay", "wait_template", "wait_for_trigger",
                          "timeout", "continue_on_timeout", "variables", "stop", "error", "response_variable", "alias", "enabled", "continue_on_error",
                          "set_conversation_response"})


class Impact(Exception):
    def __init__(self, code: str) -> None:
        super().__init__(code)
        self.code = code


# ---------------------------------------------------------------- the allowlist (options flow)

def parse_runnable(value: Any) -> tuple[frozenset[str] | None, str | None]:
    """(the ids, None) or (None, an options-flow error key). Accepts a list of ids or a text of ids separated by commas / whitespace."""
    if value in (None, "", []):
        return frozenset(), None
    if isinstance(value, str):
        items = [x for x in re.split(r"[\s,]+", value.strip().lower()) if x]
    elif isinstance(value, (list, tuple)) and all(isinstance(x, str) for x in value):
        items = [x.strip().lower() for x in value if x.strip()]
    else:
        return None, "runnable_format"
    if not all(RUNNABLE_RE.fullmatch(x) for x in items):
        return None, "runnable_format"
    out = frozenset(items)
    if len(out) > MAX_RUNNABLE:
        return None, "runnable_too_many"
    return out, None


def allowlist(value: Any) -> frozenset[str]:
    """The stored option as used at run time: a malformed value is an EMPTY list (every run refused - fail closed)."""
    ids, err = parse_runnable(value)
    return ids if ids is not None and err is None else frozenset()


def selector_value(value: Any) -> list[str]:
    """0.9.4 (EXTID-295): the stored option as the options-flow picker shows it - the sorted run-time list (a 0.9.2 text value becomes a
    list; a malformed value shows nothing, exactly what runs)."""
    return sorted(allowlist(value))


# ---------------------------------------------------------------- the pure walk

@dataclass
class Facts:
    targets: list[str] = field(default_factory=list)
    nested: list[str] = field(default_factory=list)
    covers: list[str] = field(default_factory=list)  # covers the item drives: their device class is judged against Home Assistant's state
    steps: int = 0


def _entity_ids(value: Any) -> list[str]:
    """Literal entity ids of a target value (a string, a comma-separated string or a list) - Impact otherwise."""
    if has_template(value):
        raise Impact("impact_template")
    items: list[Any]
    if isinstance(value, str):
        items = [x.strip() for x in value.split(",")]
    elif isinstance(value, list):
        items = value
    else:
        raise Impact("impact_target_unresolved")
    out = []
    for x in items:
        if not isinstance(x, str) or not ENTITY_RE.fullmatch(x) or len(x) > 255:
            raise Impact("impact_target_unresolved")
        out.append(x)
    if not out:
        raise Impact("impact_target_unresolved")
    return out


def _step_targets(step: dict[str, Any]) -> list[str]:
    """Every entity a service step targets, from `target`, `entity_id` and `data` / `data_template` - only literal entity ids."""
    found: list[str] = []
    tgt = step.get("target")
    if tgt is not None:
        if not isinstance(tgt, dict):
            raise Impact("impact_template" if has_template(tgt) else "impact_target_unresolved")
        if set(tgt) - {"entity_id"}:
            raise Impact("impact_target_unresolved")
        if "entity_id" in tgt:
            found += _entity_ids(tgt["entity_id"])
    if "entity_id" in step:
        found += _entity_ids(step["entity_id"])
    for key in ("data", "data_template"):
        data = step.get(key)
        if data is None:
            continue
        if not isinstance(data, dict):
            raise Impact("impact_template" if has_template(data) else "impact_step_unknown")
        if TARGET_KEYS & set(data):
            raise Impact("impact_target_unresolved")
        if "entity_id" in data:
            found += _entity_ids(data["entity_id"])
    if TARGET_KEYS & set(step):
        raise Impact("impact_target_unresolved")
    return found


def _scene_entities(entities: Any, facts: Facts) -> None:
    """A scene's `entities` (or `scene.apply`'s inline ones): the domains it may set, a lock only to `locked`, an alarm panel never."""
    if entities in (None, {}):
        return
    if not isinstance(entities, dict):
        raise Impact("impact_template" if has_template(entities) else "impact_step_unknown")
    for eid, value in entities.items():
        if not isinstance(eid, str) or not ENTITY_RE.fullmatch(eid):
            raise Impact("impact_template" if has_template(eid) else "impact_target_unresolved")
        if has_template(value):
            raise Impact("impact_template")
        domain = eid.split(".", 1)[0]
        state = value.get("state") if isinstance(value, dict) else value
        if domain == "alarm_control_panel" or (domain == "lock" and state != "locked"):
            raise Impact("impact_never_local")
        if domain not in SCENE_DOMAINS:
            raise Impact("impact_service_not_allowed")
        if domain == "cover":
            facts.covers.append(eid)
        facts.targets.append(eid)


def _nested(ids: Iterable[str], kind: str, level: int, facts: Facts) -> None:
    ids = list(ids)
    if level >= 1:
        raise Impact("impact_nesting_too_deep")
    if not ids or not all(i.startswith(kind + ".") for i in ids):
        raise Impact("impact_target_unresolved")
    facts.nested.extend(ids)


def _service_step(step: dict[str, Any], level: int, facts: Facts) -> None:
    svc = step.get("action") if step.get("action") is not None else step.get("service")
    if not isinstance(svc, str):
        raise Impact("impact_step_unknown")
    if has_template(svc):
        raise Impact("impact_template")
    svc = svc.strip().lower()
    if not SERVICE_RE.fullmatch(svc):
        raise Impact("impact_step_unknown")
    domain, service = svc.split(".", 1)
    if domain == "scene" and service == "apply":  # inline scene states: judged like a scene, one nesting level
        if level >= 1:
            raise Impact("impact_nesting_too_deep")
        data = step.get("data") if isinstance(step.get("data"), dict) else {}
        if set(step) - {"action", "service", "data", "alias", "enabled", "continue_on_error"}:
            raise Impact("impact_step_unknown")
        _scene_entities(data.get("entities"), facts)
        return
    if (domain, service) in IMPACT_NEVER:
        raise Impact("impact_never_local")  # before the targets: whatever it targets
    targets = _step_targets(step)
    if domain == "script" and service == "turn_on":
        return _nested(targets, "script", level, facts)
    if domain == "script" and service not in ("turn_off", "toggle", "reload"):
        return _nested([svc], "script", level, facts)  # `script.<object id>`: the script itself
    if (domain, service) in (("automation", "trigger"), ("scene", "turn_on")):
        return _nested(targets, domain, level, facts)
    if domain == "notify":
        # owner 2026-10-18: a notification with literal content only (a template could reach anything a template reaches)
        if set(step) - NOTIFY_KEYS or has_template({k: v for k, v in step.items() if k not in ("alias",)}):
            raise Impact("impact_template" if has_template(step) else "impact_step_unknown")
        facts.targets.extend(targets)  # notify.send_message names notify entities: still under the entity policy
        return None
    if (domain, service) not in IMPACT_STEP_PAIRS and (domain, service) not in TOGGLE_PAIRS:
        raise Impact("impact_service_not_allowed")
    if not targets or any(t.split(".", 1)[0] != domain for t in targets):
        raise Impact("impact_target_unresolved")
    if domain == "cover":
        facts.covers.extend(targets)
    facts.targets.extend(targets)


def _walk(raw: Any, level: int, facts: Facts, depth: int = 0) -> None:
    if depth > MAX_DEPTH:
        raise Impact("impact_too_large")
    if raw is None:
        return
    if isinstance(raw, list):
        for x in raw:
            _walk(x, level, facts, depth + 1)
        return
    if not isinstance(raw, dict):
        raise Impact("impact_step_unknown")
    facts.steps += 1
    if facts.steps > MAX_STEPS:
        raise Impact("impact_too_large")
    if "action" in raw or "service" in raw:
        return _service_step(raw, level, facts)
    if "event" in raw:
        raise Impact("impact_event")
    if "device_id" in raw:
        raise Impact("impact_device_action")
    if "scene" in raw:
        if set(raw) - {"scene", "alias", "enabled", "continue_on_error"}:
            raise Impact("impact_step_unknown")
        return _nested(_entity_ids(raw["scene"]), "scene", level, facts)
    if isinstance(raw.get("condition"), str):
        return  # a condition as a step: it only decides, it acts on nothing
    if set(raw) - CONTROL_KEYS:
        raise Impact("impact_step_unknown")
    for key in ("sequence", "then", "else", "default", "parallel"):
        _walk(raw.get(key), level, facts, depth + 1)
    if "choose" in raw:
        if not isinstance(raw["choose"], list):
            raise Impact("impact_step_unknown")
        for option in raw["choose"]:
            if not isinstance(option, dict) or set(option) - {"conditions", "sequence", "alias"}:
                raise Impact("impact_step_unknown")
            _walk(option.get("sequence"), level, facts, depth + 1)
    if "repeat" in raw:
        if not isinstance(raw["repeat"], dict):
            raise Impact("impact_step_unknown")
        _walk(raw["repeat"].get("sequence"), level, facts, depth + 1)


def analyse(kind: str, config: Any, level: int = 0) -> Facts:
    """The impact of ONE item's configuration (Impact on refusal): the entities its steps target and the items it calls (one level)."""
    if not isinstance(config, dict):
        raise Impact("impact_unknown_item")
    facts = Facts()
    if kind == "scene":
        _scene_entities(config.get("entities"), facts)
        return facts
    if kind == "script":
        _walk(config.get("sequence"), level, facts)
    elif kind == "automation":
        for key in ("actions", "action"):
            _walk(config.get(key), level, facts)
    else:
        raise Impact("impact_unknown_item")
    return facts


# ---------------------------------------------------------------- Home Assistant facing (duck-typed)

def policy_refusal(user: Any, policy_control: Any, entity_ids: Iterable[str], refused: str = POLICY_REFUSED) -> str | None:
    """The service user's own Home Assistant entity policy (`check_entity(entity_id, POLICY_CONTROL)`) for every entity - S2. Never skipped for
    an administrator: the service user is never one (service_identity.user_refusal), and an administrator here would be a fault - closed."""
    if getattr(user, "is_admin", True):
        return POLICY_UNAVAILABLE
    check = getattr(getattr(user, "permissions", None), "check_entity", None)
    if not callable(check) or policy_control is None:
        return POLICY_UNAVAILABLE
    for entity_id in entity_ids:
        try:
            allowed = check(entity_id, policy_control)
        except Exception:  # noqa: BLE001 - an API that raises is an API we cannot rely on: closed
            return POLICY_UNAVAILABLE
        if allowed is not True:
            return refused
    return None


async def _load_item(hass: Any, deps: Any, entity_id: str) -> tuple[str, Any]:
    kind = entity_id.split(".", 1)[0]
    if kind not in NESTED_KINDS or not ENTITY_RE.fullmatch(entity_id):
        raise Impact("impact_unknown_item")
    entry = deps.registry(hass).async_get(entity_id)
    if entry is None or getattr(entry, "platform", None) != PLATFORM[kind]:
        raise Impact("impact_unknown_item")  # an item outside the UI files (YAML package, an integration's scene): not judged, not run
    item_id = str(getattr(entry, "unique_id", "") or "")
    if not item_id:
        raise Impact("impact_unknown_item")
    store = deps.store(hass)
    try:
        config = await deps.run_io(hass, lambda: store.get(kind, item_id))
    except StoreError:
        raise Impact("impact_unknown_item") from None
    if config is None:
        raise Impact("impact_unknown_item")
    return kind, config


def _attributes(hass: Any, deps: Any, entity_id: str) -> Any:
    getter = getattr(deps, "attributes", None)
    if callable(getter):
        return getter(entity_id)
    state = hass.states.get(entity_id) if hass is not None else None
    return dict(state.attributes) if state is not None else None


def cover_refusal(hass: Any, deps: Any, covers: Iterable[str]) -> str | None:
    """A cover driven by a runnable item must report a device class that is plainly a window covering (COVER_SAFE_CLASSES)."""
    for entity_id in covers:
        try:
            attrs = _attributes(hass, deps, entity_id)
        except Exception:  # noqa: BLE001 - unsure: refused
            return "impact_physical_access"
        if not isinstance(attrs, dict) or attrs.get("device_class") not in COVER_SAFE_CLASSES:
            return "impact_physical_access"
    return None


async def impact_refusal(hass: Any, deps: Any, user: Any, entity_id: str, level: int = 0, runnable: frozenset[str] | None = None) -> str | None:
    """S1 (b): None when the item - and every item it calls, one level - reaches no NEVER-LOCAL target and only allowed services on literal
    entities the service user may control; else the impact code. `runnable` (owner 2026-10-18): a nested item must be on the allowlist too
    (None = an empty list: every nested call refused)."""
    try:
        kind, config = await _load_item(hass, deps, entity_id)
        facts = analyse(kind, config, level)
    except Impact as exc:
        return exc.code
    except Exception as exc:  # noqa: BLE001 - whatever could not be judged is refused
        _LOGGER.warning("smplwise_bridge impact check failed: %s", type(exc).__name__)
        return "impact_unknown_item"
    for nested in facts.nested:
        if nested not in (runnable or frozenset()):
            return "impact_nested_not_runnable"
        why = await impact_refusal(hass, deps, user, nested, level + 1, runnable)
        if why:
            return why
    why = cover_refusal(hass, deps, facts.covers)
    if why:
        return why
    why = policy_refusal(user, deps.POLICY_CONTROL, list(facts.targets) + list(facts.nested), refused="impact_entity_policy")
    return why


def execute_targets(data: Any) -> list[str] | None:
    """The entities of a screened `execute` (literal ids only; None = refused): no area / device / floor / label target, no template."""
    if not isinstance(data, dict) or TARGET_KEYS & set(data) or "target" in data:
        return None
    try:
        return _entity_ids(data.get("entity_id"))
    except Impact:
        return None


async def execute_refusal(hass: Any, user: Any, domain: str, service: str, data: Any, runnable: frozenset[str], deps: Any = None) -> str | None:
    """For an `execute` screened on behalf of an Arx-only person: S2 for every entity, then - for `script.turn_on` / `scene.turn_on` - the
    runnable allowlist and the impact check of every item."""
    targets = execute_targets(data)
    if targets is None:
        return TARGET_REFUSED
    deps = deps or ha_deps()
    why = policy_refusal(user, deps.POLICY_CONTROL, targets)
    if why:
        return why
    if (domain, service) in (("script", "turn_on"), ("scene", "turn_on")):
        for entity_id in targets:
            if entity_id.split(".", 1)[0] != domain or entity_id not in runnable:
                return NOT_RUNNABLE
            why = await impact_refusal(hass, deps, user, entity_id, runnable=runnable)
            if why:
                return why
    return None


async def config_item_refusal(hass: Any, user: Any, msg: dict[str, Any], runnable: frozenset[str], deps: Any = None) -> str | None:
    """For a `config_item` run op screened on behalf of an Arx-only person (`trigger` / `run_script` / `apply_scene` - service_identity.screen
    admits no other): the item's entity must be on the runnable allowlist and pass the impact check. (Its own entity's policy is checked by
    config_service._check_permissions, as for everyone.)"""
    deps = deps or ha_deps()
    op = msg.get("op")
    if op == "apply_scene":
        entity_id = msg.get("entity_id")
    elif op in ("trigger", "run_script") and isinstance(msg.get("item_id"), str):
        kind = "automation" if op == "trigger" else "script"
        entity_id = entity_of(deps.registry(hass), kind, PLATFORM[kind], msg["item_id"])
    else:
        return NOT_RUNNABLE
    if not isinstance(entity_id, str) or not RUNNABLE_RE.fullmatch(entity_id):
        return "impact_unknown_item"
    if entity_id not in runnable:
        return NOT_RUNNABLE
    return await impact_refusal(hass, deps, user, entity_id, runnable=runnable)
