"""The `smplwise_bridge.config_item` service (CR-017, bridge 0.6.0): writes an automation, a script or a scene on behalf of a VMS user, and runs / enables /
disables / applies them with that user's own Home Assistant context - after the add-on's own checks and independently of them (AUTOMATIONS_API.md section 4).

Kept apart from `__init__.py` so it can be unit-tested without Home Assistant installed: Home Assistant is imported lazily (`ha_deps()`), everything else is
duck-typed (`hass.auth`, `hass.services`, `hass.states`, an entity registry, a store). A test supplies its own `deps`.

The order of the checks: signature / replay window -> active HA user -> op allow-list and the closed shape of the message (config_policy.validate_message) ->
for `upsert` / `delete`: an HA administrator, or the delegation switch (`delegated`) and the `builder` profile (the `code` profile always needs an administrator;
CR section 8.3, the owner's approval of 2026-10-01) -> under the write lock: the stored item and the revision (`stale`) -> the policy of the config
(config_policy.validate_config: closed schemas, allow-list, secrets, preserved blocks, the sensitive flag) -> for a non-administrator, the user's own control
permission on every entity the item drives -> Home Assistant's own validation -> backup ring, atomic write, verify (config_store) -> reload ONLY the changed
item and wait up to 5 s for its entity.

Never called from here: any `*.reload` but the one of the item just written, `homeassistant.*`, `hassio.*`, the user directory, the registries except the removal
of the entity of a deleted item. Errors are fixed codes or class names; configs, values, template text and exception texts are never logged or returned.
"""
from __future__ import annotations

import asyncio
import logging
import re
import weakref
from types import SimpleNamespace
from typing import Any, Callable, Mapping

from . import config_policy as policy
from .config_store import ConfigStore, StoreError

_LOGGER = logging.getLogger(__name__)

RELOAD_WAIT_S = 5.0
RELOAD_POLL_S = 0.25
TRIGGER_WAIT_S = 5.0  # `automation.trigger` blocks until the run ends: its errors are awaited this long, the run itself is never cancelled
PLATFORM = {"automation": "automation", "script": "script", "scene": "homeassistant"}  # the registry platform of an item written through the config API


# ---------------------------------------------------------------- Home Assistant, lazily

async def _ha_validate(hass: Any, kind: str, item_id: str, config: dict[str, Any]) -> tuple[str, str | None]:
    """Home Assistant's own validation of an item (U-3: the import paths are verified on the lab in phase 0). ("ok", None), ("failed", message) or ("skipped", None)
    when this core has no validator under the names tried - the write goes on, the add-on's and the bridge's own policy already judged the config."""
    try:
        if kind == "automation":
            from homeassistant.components.automation.config import async_validate_config_item as validate  # type: ignore[import-not-found]
        elif kind == "script":
            from homeassistant.components.script.config import async_validate_config_item as validate  # type: ignore[import-not-found]
        else:
            from homeassistant.components.scene import PLATFORM_SCHEMA  # type: ignore[import-not-found]

            PLATFORM_SCHEMA(dict(config))
            return "ok", None
    except ImportError:
        return "skipped", None
    except Exception as exc:  # noqa: BLE001 - a schema error: the first line of its text names the path, never a template
        return "failed", str(exc).splitlines()[0][:200] if str(exc) else type(exc).__name__
    try:
        try:
            result = await validate(hass, item_id, dict(config), True, False)
        except TypeError:
            result = await validate(hass, item_id, dict(config))
    except Exception as exc:  # noqa: BLE001
        return "failed", str(exc).splitlines()[0][:200] if str(exc) else type(exc).__name__
    status = getattr(result, "validation_status", None)
    if status is not None and str(getattr(status, "value", status)) not in ("ok", "None", "none"):
        return "failed", str(getattr(result, "validation_error", "") or status).splitlines()[0][:200]
    return "ok", None


def ha_deps() -> SimpleNamespace:
    """Home Assistant symbols, imported on first use so this module imports without Home Assistant (unit tests pass their own `deps`). A missing
    POLICY_CONTROL means the permission API changed: fail closed."""
    from homeassistant.core import Context
    from homeassistant.exceptions import ServiceValidationError, Unauthorized
    from homeassistant.helpers import entity_registry as er

    try:
        from homeassistant.auth.permissions.const import POLICY_CONTROL
    except ImportError:
        POLICY_CONTROL = None

    async def run_io(hass: Any, fn: Callable[[], Any]) -> Any:
        return await hass.async_add_executor_job(fn)

    return SimpleNamespace(Context=Context, Unauthorized=Unauthorized, ServiceValidationError=ServiceValidationError, POLICY_CONTROL=POLICY_CONTROL,
                           registry=lambda hass: er.async_get(hass), run_io=run_io, store=lambda hass: ConfigStore(hass.config.config_dir), validate=_ha_validate,
                           sleep=asyncio.sleep)


def _safe_detail(message: str | None) -> str:
    """The part of Home Assistant's validation message that is safe to hand back: what is wrong and WHERE (`@ data[...]`), with anything quoted or in parentheses
    - a template, a value, an entity - replaced by an ellipsis. Never logged."""
    text = (message or "invalid").splitlines()[0]
    where = re.search(r"@ data(?:\[[^\]]*\])+", text)
    head = text[: where.start()] if where else text
    head = re.sub(r"\([^)]*\)|'[^']*'|\"[^\"]*\"", "…", head).strip()[:100]
    return f"{head} {where.group(0)}".strip()[:200] if where else head


# ---------------------------------------------------------------- one write at a time

class _WriteState:
    def __init__(self) -> None:
        self.lock = asyncio.Lock()


_STATES: "weakref.WeakKeyDictionary[Any, _WriteState]" = weakref.WeakKeyDictionary()
_STATES_BY_ID: dict[int, _WriteState] = {}


def _write_state(hass: Any) -> _WriteState:
    try:
        state = _STATES.get(hass)
        if state is None:
            state = _STATES[hass] = _WriteState()
        return state
    except TypeError:
        return _STATES_BY_ID.setdefault(id(hass), _WriteState())


def _refuse(msg: Mapping[str, Any], error: str, path: str | None = None, **extra: Any) -> dict[str, Any]:
    out: dict[str, Any] = {"ok": False, "request_id": msg.get("request_id"), "error": error}
    if path:
        out["path"] = path
    out.update(extra)
    return out


def _entries(registry: Any) -> list[Any]:
    entries = getattr(registry, "entities", None)
    return list(entries.values()) if entries is not None else []


def entity_of(registry: Any, domain: str, platform: str, unique_id: str) -> str | None:
    """The entity id of an item (registry platform + unique_id == the config id; a script's unique_id is its object id)."""
    for e in _entries(registry):
        if getattr(e, "platform", None) == platform and str(getattr(e, "unique_id", "")) == unique_id and str(getattr(e, "entity_id", "")).startswith(domain + "."):
            return e.entity_id
    return None


def _check_permissions(user: Any, deps: SimpleNamespace, entity_ids: list[str]) -> str | None:
    """None when the person may control every entity (an administrator always may), else the refusal code. The config API's writes are not entity services,
    so Home Assistant would not check the entities named inside the item: this check does, with the user's own policy."""
    if getattr(user, "is_admin", False):
        return None
    check = getattr(getattr(user, "permissions", None), "check_entity", None)
    if not callable(check) or deps.POLICY_CONTROL is None:
        return "permission_check_unavailable"
    for entity_id in entity_ids:
        try:
            allowed = check(entity_id, deps.POLICY_CONTROL)
        except Exception:  # noqa: BLE001 - an API that raises is an API we cannot rely on: closed
            return "permission_check_unavailable"
        if not allowed:
            return "unauthorized"
    return None


# ---------------------------------------------------------------- the handler

async def async_handle_config_item(hass: Any, verifier: Any, msg: dict[str, Any], *, delegated: Callable[[], bool], deps: SimpleNamespace | None = None) -> dict[str, Any]:
    """Run one signed `config_item` request. Always answers a dict, never raises for a refusal."""
    reason = verifier.verify(msg)
    if reason:
        _LOGGER.warning("smplwise_bridge.config_item refused: %s", reason)
        return _refuse(msg, reason)
    user = await hass.auth.async_get_user(msg["user_id"])
    if user is None or not user.is_active:
        return _refuse(msg, "unknown_user")
    try:
        parsed = policy.validate_message(msg)
    except policy.PolicyError as exc:
        _LOGGER.warning("smplwise_bridge.config_item %s refused: %s", msg.get("op"), exc.code)
        return _refuse(msg, exc.code, exc.path)
    deps = deps or ha_deps()
    if parsed.op in policy.RUNTIME_OPS:
        return await _run_op(hass, deps, user, parsed, msg)
    # upsert / delete: an administrator, or the delegation switch with simple-builder content only (CR section 8.3)
    if not getattr(user, "is_admin", False):
        if not delegated():
            return _refuse(msg, "delegation_off")
        if parsed.profile != "builder":
            return _refuse(msg, "not_ha_admin")
    return await _write(hass, deps, user, parsed, msg)


async def _run_op(hass: Any, deps: SimpleNamespace, user: Any, p: policy.Message, msg: Mapping[str, Any]) -> dict[str, Any]:
    """Runtime ops: the service runs with `Context(user_id)`, so Home Assistant's own per-user entity permissions decide - and this bridge asks the same
    question first, because a non-blocking call would swallow the refusal."""
    registry = deps.registry(hass)
    if p.op == "apply_scene":
        entity_id = p.entity_id or ""
        if registry.async_get(entity_id) is None:
            return _refuse(msg, "not_found", "entity_id")
        domain, service, data = "scene", "turn_on", {"entity_id": entity_id}
    else:
        assert p.kind and p.item_id
        domain = p.kind
        entity_id = entity_of(registry, domain, PLATFORM["script" if domain == "script" else "automation"], p.item_id) or ""
        if not entity_id:
            return _refuse(msg, "not_found", "item_id")
        service = {"enable": "turn_on", "disable": "turn_off", "trigger": "trigger", "run_script": "turn_on", "stop_script": "turn_off"}[p.op]
        data = {"entity_id": entity_id}
        if p.op == "trigger" and p.skip_condition is not None:
            data["skip_condition"] = p.skip_condition
        if p.op in ("trigger", "run_script") and p.variables:
            data["variables"] = dict(p.variables)
    refusal = _check_permissions(user, deps, [entity_id])
    if refusal:
        _LOGGER.warning("smplwise_bridge.config_item %s refused: %s", p.op, refusal)
        return _refuse(msg, refusal)
    if not hass.services.has_service(domain, service):
        return _refuse(msg, "service_unavailable")
    context = deps.Context(user_id=user.id)
    try:
        if p.op == "trigger":
            await _call_without_cancelling(hass, domain, service, data, context)
        else:
            await hass.services.async_call(domain, service, data, blocking=True, context=context)
    except deps.Unauthorized:
        return _refuse(msg, "unauthorized")
    except Exception as exc:  # noqa: BLE001 - class name only: the text may carry names or values
        _LOGGER.warning("smplwise_bridge.config_item %s failed: %s", p.op, type(exc).__name__)
        return _refuse(msg, type(exc).__name__)
    return {"ok": True, "request_id": msg["request_id"], "context_id": context.id, "entity_id": entity_id}


async def _call_without_cancelling(hass: Any, domain: str, service: str, data: dict[str, Any], context: Any) -> None:
    """`automation.trigger` blocks until the run ends (it may wait for hours): a refusal that comes quickly is raised, the run is never cancelled."""
    task = asyncio.ensure_future(hass.services.async_call(domain, service, data, blocking=True, context=context))
    done, _pending = await asyncio.wait({task}, timeout=TRIGGER_WAIT_S)
    if done:
        task.result()
    else:
        task.add_done_callback(lambda t: t.exception() if not t.cancelled() else None)  # the result of a long run is nobody's


async def _write(hass: Any, deps: SimpleNamespace, user: Any, p: policy.Message, msg: Mapping[str, Any]) -> dict[str, Any]:
    assert p.kind and p.item_id
    kind, item_id = p.kind, p.item_id
    store = deps.store(hass)
    registry = deps.registry(hass)
    io = lambda fn: deps.run_io(hass, fn)  # noqa: E731

    def attributes_of(entity_id: str) -> Mapping[str, Any] | None:
        st = hass.states.get(entity_id)
        return getattr(st, "attributes", None) if st is not None else None

    async with _write_state(hass).lock:
        # ---- the stored item and the revision the user edited
        try:
            stored = await io(lambda: store.get(kind, item_id))
        except StoreError as exc:
            return _refuse(msg, exc.code)
        current = policy.revision_of(stored) if stored is not None else None
        if p.op == "upsert":
            if p.base_revision is None and stored is not None:
                return _refuse(msg, "exists", revision_current=current)
            if p.base_revision is not None and stored is None:
                return _refuse(msg, "not_found")
            if p.base_revision is not None and current != p.base_revision:
                return _refuse(msg, "stale", revision_current=current)  # `stale` also names an expired signature timestamp: only this answer carries `revision_current`
        else:
            if stored is None:
                return _refuse(msg, "not_found")
            if current != p.base_revision:
                return _refuse(msg, "stale", revision_current=current)
        # ---- the policy of the content
        facts = policy.ConfigFacts()
        if p.op == "upsert":
            assert p.config is not None
            try:
                facts = policy.validate_config(kind, item_id, p.config, profile=p.profile, preserved=p.preserved, stored=stored, sensitive=p.sensitive, attributes_of=attributes_of)
            except policy.PolicyError as exc:
                _LOGGER.warning("smplwise_bridge.config_item upsert refused: %s", exc.code)
                return _refuse(msg, exc.code, exc.path)
        else:
            facts = policy.ConfigFacts(stored_targets=policy.step_targets(stored)[0] + ([e for e in (stored.get("entities") or {})] if kind == "scene" else []))
        # ---- a non-administrator controls every entity the item drives (the new content and the old)
        refusal = _check_permissions(user, deps, list(dict.fromkeys(facts.targets + facts.stored_targets)))
        if refusal:
            _LOGGER.warning("smplwise_bridge.config_item %s refused: %s", p.op, refusal)
            return _refuse(msg, refusal)
        # ---- Home Assistant's own validation
        ha_validation = "skipped"
        if p.op == "upsert":
            assert p.config is not None
            ha_validation, detail = await deps.validate(hass, kind, item_id, p.config)
            if ha_validation == "failed":
                return _refuse(msg, "ha_invalid", _safe_detail(detail))
        # ---- write, then reload ONLY this item and wait for it
        try:
            if p.op == "upsert":
                assert p.config is not None
                before, after = await io(lambda: store.upsert(kind, item_id, p.config, p.base_revision))  # type: ignore[arg-type]
            else:
                before = await io(lambda: store.delete(kind, item_id, p.base_revision))
                after = None
        except StoreError as exc:
            _LOGGER.warning("smplwise_bridge.config_item %s failed: %s", p.op, exc.code)
            return _refuse(msg, exc.code, **({"revision_current": policy.revision_of(stored)} if exc.code == "stale" and stored is not None else {}))
        platform = PLATFORM[kind]
        if p.op == "delete":
            entity_id = entity_of(registry, kind, platform, item_id)
            if entity_id:
                try:
                    registry.async_remove(entity_id)  # what Home Assistant's own DELETE does; the entity goes with its registry entry
                except Exception as exc:  # noqa: BLE001
                    _LOGGER.warning("smplwise_bridge.config_item delete: the registry entry stayed (%s)", type(exc).__name__)
            return {"ok": True, "request_id": msg["request_id"], "context_id": None, "revision_before": before, "revision_after": None, "entity_id": entity_id, "loaded": False,
                    "ha_validation": "skipped"}
        reloaded = await _reload(hass, deps, kind, item_id)
        entity_id = await _wait_entity(hass, deps, registry, kind, platform, item_id) if reloaded else None
        loaded = entity_id is not None
        rolled_back = False
        if not loaded and p.base_revision is None:
            # a NEW item that never appeared (the include line of the file is missing, U-5): leave no orphan behind, the add-on reports `not_loaded`
            try:
                await io(lambda: store.delete(kind, item_id, None))
                rolled_back = True
            except StoreError:
                rolled_back = False
        return {"ok": True, "request_id": msg["request_id"], "context_id": None, "revision_before": before, "revision_after": None if rolled_back else after, "entity_id": entity_id,
                "loaded": loaded, "rolled_back": rolled_back, "ha_validation": ha_validation}


async def _reload(hass: Any, deps: SimpleNamespace, kind: str, item_id: str) -> bool:
    """`automation.reload {id}` (only that automation), `script.reload` (a diff), `scene.reload` (all scenes). False when the service does not exist."""
    domain = kind
    data = {"id": item_id} if kind == "automation" else {}
    if not hass.services.has_service(domain, "reload"):
        return False
    try:
        await hass.services.async_call(domain, "reload", data, blocking=True, context=deps.Context())
    except Exception as exc:  # noqa: BLE001
        _LOGGER.warning("smplwise_bridge.config_item reload failed: %s", type(exc).__name__)
        return False
    return True


async def _wait_entity(hass: Any, deps: SimpleNamespace, registry: Any, kind: str, platform: str, item_id: str) -> str | None:
    """The entity of the item once it is in the registry and has a state, polled up to RELOAD_WAIT_S."""
    attempts = max(1, int(RELOAD_WAIT_S / RELOAD_POLL_S)) if RELOAD_POLL_S > 0 else 1
    for attempt in range(attempts + 1):
        eid = entity_of(registry, kind, platform, item_id)
        if eid and hass.states.get(eid) is not None:
            return eid
        if attempt < attempts:
            await deps.sleep(RELOAD_POLL_S)
    return None
