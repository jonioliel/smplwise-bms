"""0.10.5 (DOOR-BRIDGE-BLOCK-2404, CR-033 slice D5a, owner decision 20): `smplwise_bridge.execute` refuses door services on
WisKey doors unless an administrator allowed it.

The add-on never sends `execute` for a WisKey door (its own guard, services/door_execute_guard.py, since 2.4.9): a WisKey door
opens only through Arx's one door path (the door authority, the WisKey direct transport). This module is the same rule on the
bridge side, as defence in depth: whatever built a signed `execute` message, the bridge itself refuses a `lock` or `button`
service whose target is a door of the WisKey intercom component.

The setting: the bridge's options-flow field `wiskey_execute_policy` (Home Assistant > Settings > Devices & services >
SMPLWISE Bridge > Configure), `blocked` or `allowed`. Default `blocked`: absent, empty or any other value is `blocked` (fail
closed). Read live on every call, so a change applies to the next call without a reload. Only a Home Assistant administrator
can open the form; nothing the add-on sends can change it.

What is refused under `blocked` (`lock.*` and `button.press`; every other domain is never looked at):
- a target whose entity-registry platform is a WisKey platform (`hikvision_intercom`, `smplwise_intercom`) - reason `wiskey_platform`;
- a group (an entity whose state lists `entity_id` members, e.g. a lock group) with such a member - `wiskey_group_member`;
- where any WisKey entity exists in the registry: a `lock` target (or group member) the registry does not know - `unknown_lock`,
  and a group whose members cannot be read - `group_unverifiable`;
- a registry that cannot be read - `registry_unavailable`.
The answer is always the code `wiskey_door_execute_blocked` (the add-on maps it to a failed action, never "pending"); the
reason is a fixed token. Nothing is called.

Not touched here: WisKey's own direct path (the add-on talks to WisKey itself; this bridge never carries it), WisKey's own
entities and screens inside Home Assistant, every other `execute` service and every other bridge service.

SR-1 review (CR-039): this module opens nothing, sends nothing and holds no timer or scheduler - it only refuses."""
from __future__ import annotations

from collections.abc import Mapping
from typing import Any, Callable

from .const import CONF_WISKEY_EXECUTE_POLICY

__all__ = ["CONF_WISKEY_EXECUTE_POLICY", "policy", "refusal", "answer", "event_data"]
POLICY_BLOCKED = "blocked"
POLICY_ALLOWED = "allowed"
POLICIES = (POLICY_BLOCKED, POLICY_ALLOWED)
DEFAULT_POLICY = POLICY_BLOCKED
BLOCKED_CODE = "wiskey_door_execute_blocked"  # the same code the add-on's own guard answers (CR-033 5.3)
WISKEY_PLATFORMS = frozenset({"hikvision_intercom", "smplwise_intercom"})
DOOR_DOMAINS = frozenset({"lock", "button"})
GROUP_DEPTH = 3
EVENT_REFUSED = "smplwise_bridge_door_execute_refused"


def policy(options: Any) -> str:
    """The administrator's setting, read from the entry options: `allowed` only when it says exactly that."""
    value = options.get(CONF_WISKEY_EXECUTE_POLICY) if isinstance(options, Mapping) else None
    return POLICY_ALLOWED if value == POLICY_ALLOWED else POLICY_BLOCKED


def targets(data: Any) -> list[str]:
    value = data.get("entity_id") if isinstance(data, Mapping) else None
    if isinstance(value, str):
        return [v.strip() for v in value.split(",") if v.strip()]
    if isinstance(value, (list, tuple)):
        return [v for v in value if isinstance(v, str)]
    return []


def _platform(registry: Any, entity_id: str) -> tuple[bool, str]:
    entry = registry.async_get(entity_id)
    return (entry is not None, str(getattr(entry, "platform", "") or "") if entry is not None else "")


def _wiskey_present(registry: Any) -> bool:
    entities = registry.entities
    values = entities.values() if hasattr(entities, "values") else entities
    return any(str(getattr(e, "platform", "") or "") in WISKEY_PLATFORMS for e in values)


def refusal(domain: str, data: Any, registry_of: Callable[[], Any], state_of: Callable[[str], Any], policy_value: str) -> str | None:
    """The reason this `execute` must not run (a fixed token), or None. `registry_of()`: Home Assistant's entity registry (read
    inside the fail-closed block); `state_of(entity_id)`: the state object or None."""
    if domain not in DOOR_DOMAINS or policy_value == POLICY_ALLOWED:
        return None
    ids = targets(data)
    if not ids:
        return None  # the bridge refuses a call without a target itself (entity_required / invalid_entity_id)
    try:
        reg = registry_of()
        present_cache: list[bool] = []

        def present() -> bool:
            if not present_cache:
                present_cache.append(_wiskey_present(reg))
            return present_cache[0]

        def judge(entity_id: str, depth: int, seen: set[str]) -> str | None:
            known, platform = _platform(reg, entity_id)
            if platform in WISKEY_PLATFORMS:
                return "wiskey_platform" if depth == 0 else "wiskey_group_member"
            if entity_id in seen:
                return None
            seen.add(entity_id)
            state = state_of(entity_id)
            members = (getattr(state, "attributes", None) or {}).get("entity_id") if state is not None else None
            if members is not None:
                if isinstance(members, str):
                    members = [members]
                if not isinstance(members, (list, tuple)) or depth >= GROUP_DEPTH or not all(isinstance(m, str) for m in members):
                    return "group_unverifiable" if present() else None
                for member in members:
                    why = judge(member, depth + 1, seen)
                    if why:
                        return "wiskey_group_member" if why == "wiskey_platform" else why
            if not known and entity_id.startswith("lock.") and present():
                return "unknown_lock"
            return None

        for entity_id in ids:
            why = judge(entity_id, 0, set())
            if why:
                return why
    except Exception:  # noqa: BLE001 - a registry or state that cannot be read refuses the two door domains (fail closed)
        return "registry_unavailable"
    return None


def answer(request_id: Any, reason: str) -> dict[str, Any]:
    return {"ok": False, "request_id": request_id, "error": BLOCKED_CODE, "reason": reason}


def event_data(request_id: Any, domain: str, service: str, data: Any, reason: str, policy_value: str) -> dict[str, Any]:
    """What the Home Assistant event (the logbook's audit row) carries: names and fixed tokens only - never a signature, a
    nonce, a key or the signed body."""
    return {"request_id": str(request_id or "")[:64], "domain": domain, "service": service, "entity_ids": targets(data)[:20], "reason": reason,
            "code": BLOCKED_CODE, "policy": policy_value}
