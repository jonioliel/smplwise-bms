"""SCHEDIMPACT-295 (Fable security review 4 of 2026-10-21, finding V-02): the BRIDGE's own judgement of a `schedule` message that
service_identity.screen accepted ON BEHALF OF an Arx-only person - independently of the add-on (which applies the same rule first,
smplwise_vms/backend/smplwise/services/schedule_identity.py). A Home Assistant user's own message is never judged here.

`schedules` is a basic-mode feature: screen() judges only the op. Without this module a local person could schedule `script.turn_on` /
`scene.turn_on` of any script - which the Scheduler component then runs - under the service user without the runnable allowlist or the impact
check, and a door unlock or arming with the bypass set that the never-list refuses to a direct call.

What is judged: the content the op makes run.
- `add`, and an `edit` that carries `timeslots`: every action of the payload (schedule_policy has validated it: a listed service and an
  entity of the service's domain).
- `copy`, `run`, `enable`, and an `edit` that keeps the slots: the CURRENT content, read from the schedule switch's state attributes (the
  component reports every action entity in `entities` and the first action of each slot in `actions`). Attributes that cannot be read in that
  shape: `schedule_content_unverifiable` (fail closed).
- `remove`, `disable`: nothing (they stop things).

The rule (the same as the add-on's):
1. an action's (domain, service) pair on the never-list of the current mode (service_identity.never_list - in the basic mode doors, arming
   with the bypass set, scripts and scenes): `service_identity_refused`;
2. an action that runs a script / scene / automation (by its service OR its entity) must be `script.turn_on` + `script.<id>` or
   `scene.turn_on` + `scene.<id>` (in the attributes: a script / scene entity, or the `script.<object id>` service naming its script);
   an automation or any other shape: `service_identity_refused`;
3. in the extended mode each such item must be on THIS bridge's runnable allowlist (`service_identity_not_runnable`) and pass
   runnable.impact_refusal - every step, one nested level, the closed step list, the service user's entity policy (the impact codes).
Answers carry the code only. Dependency-free (Home Assistant through runnable's deps, or a test's `deps`).
"""
from __future__ import annotations

import re
from typing import Any, Iterable, Mapping

from . import runnable
from .service_identity import SCRIPT_SCENE_PAIRS, never_local

REFUSED = "service_identity_refused"
UNVERIFIABLE = "schedule_content_unverifiable"
RUN_DOMAINS = frozenset({"script", "scene", "automation"})
_PAIR_RE = re.compile(r"^[a-z0-9_]+\.[a-z0-9_]+$")
# what this module can answer (runnable's codes for the impact check, POLICY_UNAVAILABLE included)
REFUSAL_CODES = frozenset({REFUSED, UNVERIFIABLE}) | runnable.REFUSAL_CODES


def current_actions(attributes: Any) -> list[tuple[str | None, str | None]] | None:
    """(service, entity) facts of an existing schedule from its switch's state attributes; None when they cannot be read."""
    if not isinstance(attributes, Mapping):
        return None
    entities, actions = attributes.get("entities"), attributes.get("actions")
    if not isinstance(entities, (list, tuple)) or not isinstance(actions, (list, tuple)):
        return None
    out: list[tuple[str | None, str | None]] = []
    for a in actions:
        if not isinstance(a, Mapping) or not isinstance(a.get("service"), str):
            return None
        out.append((a["service"], None))
    for e in entities:
        if not isinstance(e, str):
            return None
        out.append((None, e))
    return out


def run_items(actions: Iterable[tuple[str | None, str | None]], extended: bool) -> tuple[list[str], str | None]:
    """The script / scene entities the actions run, or (_, the refusal code). Pure."""
    runs: list[str] = []
    for service, entity in actions:
        pair: tuple[str, str] | None = None
        if service is not None:
            svc = str(service).strip().lower()
            if not _PAIR_RE.fullmatch(svc):
                return runs, REFUSED
            pair = tuple(svc.split(".", 1))  # type: ignore[assignment]
            if never_local("execute", pair, extended):
                return runs, REFUSED
            if pair[0] in RUN_DOMAINS:
                if pair in SCRIPT_SCENE_PAIRS:
                    pass  # its target is the entity (in the payload) or among `entities` (in the attributes)
                elif pair[0] == "script" and pair[1] not in ("turn_on", "turn_off", "toggle", "reload"):
                    runs.append(svc)  # `script.<object id>` as a service: the script itself
                else:
                    return runs, REFUSED  # an automation, script.turn_off / toggle, scene.apply / create ...: not judged here, refused
        if entity is not None:
            ent = str(entity).strip().lower()
            if not runnable.ENTITY_RE.fullmatch(ent):
                return runs, REFUSED
            kind = ent.split(".", 1)[0]
            if kind in RUN_DOMAINS:
                if kind == "automation" or (pair is not None and pair != (kind, "turn_on")):
                    return runs, REFUSED
                runs.append(ent)
    return list(dict.fromkeys(runs)), None


async def schedule_refusal(hass: Any, user: Any, op: Any, refs: Iterable[Any], msg: Mapping[str, Any], runnable_ids: frozenset[str], extended: bool,
                           deps: Any = None) -> str | None:
    """None when the content the op makes run passes the rule above, else the code. `refs`: schedule_policy's validated actions of an add /
    edit; `user`: the service user (screen() checked it); `runnable_ids`: this bridge's allowlist; `extended`: this bridge's switch."""
    if op in ("remove", "disable"):
        return None
    payload = msg.get("payload") if isinstance(msg.get("payload"), Mapping) else {}
    if op == "add" or (op == "edit" and "timeslots" in payload):
        actions: list[tuple[str | None, str | None]] | None = [(f"{r.domain}.{r.service}", r.entity_id) for r in refs]
    else:
        entity_id = msg.get("schedule_entity_id")
        try:
            state = hass.states.get(entity_id) if isinstance(entity_id, str) else None
        except Exception:  # noqa: BLE001 - a state we cannot read is a content we cannot judge
            state = None
        actions = current_actions(getattr(state, "attributes", None)) if state is not None else None
        if actions is None:
            return UNVERIFIABLE
    runs, why = run_items(actions, extended is True)
    if why:
        return why
    if not runs:
        return None
    if extended is not True:
        return REFUSED
    deps = deps or runnable.ha_deps()
    for entity_id in runs:
        if entity_id not in runnable_ids:
            return runnable.NOT_RUNNABLE
        why = await runnable.impact_refusal(hass, deps, user, entity_id, runnable=runnable_ids)
        if why:
            return why
    return None
