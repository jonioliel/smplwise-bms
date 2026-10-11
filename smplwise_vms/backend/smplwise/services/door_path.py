"""Which saved Arx items open a WisKey door (CR-033 slice D7, owner decision 15 = א) - the static resolver and the read-only
inventory. The resolver is shared with the run guard (services/door_run_guard.py, slice D9, rule R-17).

Read-only by construction: it reads Arx's own mirror tables (`ha_config_items`, `automation_meta`, `automation_versions`,
`automation_runs`, `schedule_cache`, `schedule_meta`, `schedule_runs`, `ha_entities`, `intercom_door_map`, the home
screen's launcher setting and `audit_log`) and nothing else: no Home Assistant call, no WisKey call, no write.

A DOOR STEP is a step that opens a WisKey door: `lock.unlock` / `lock.open` on a WisKey lock entity (registry platform
`hikvision_intercom` or `smplwise_intercom`), a scene member of such a lock captured as unlocked, a device action
`lock` / `unlock|open` on one, or WisKey's own `<domain>.unlock_door` service. Targets are expanded statically through
entity ids, devices, areas, floors, `all`, lock groups and the call chain (`script.turn_on`, `script.<name>`,
`automation.trigger`, `scene.turn_on`, `scene.apply`, `homeassistant.turn_on|toggle`, nested to MAX_DEPTH). Anything
that cannot be expanded where a door could hide is UNRESOLVED (fail closed): a template service or target, a label
target (labels are not mirrored), an item or entity the mirror does not know, a template lock or button, a lock group whose
members the mirror does not hold, a WisKey device
action or button, a chain deeper than MAX_DEPTH. A door step whose lock is not in the door map is a door step whose door
is not known (`problem = unmapped`).

Honest limits (documented, not hidden): a chain that goes through an EVENT or a STATE CHANGE (the item fires an event or
turns on a helper that another automation watches) is not followed - that other automation is its own item and is listed
on its own; `lock.lock` steps on a WisKey lock are counted (`lock_steps`, they always fail) but are not door steps.

The inventory classifies each item (CR-033 6.1): `arx_authored` (created through Arx and the live revision is the one
Arx wrote), `arx_edited_externally`, `external`, `unknown`; and names the approver: the person whose confirming write
covers the LIVE revision (schedules: a write that carried the lowering confirmation; automations / scripts / scenes: a
write that carried the sensitive content), never `created_by` / `updated_by` alone. Screens get names only: no entity
ids, no station ids, no addresses."""
from __future__ import annotations

import json
import re
import sqlite3
from dataclasses import dataclass, field
from typing import Any

from ..db import now_iso
from ..rbac import Principal
from . import intercom_doors, intercom_sync

WISKEY_DOMAINS = intercom_doors.WISKEY_PLATFORMS  # the integration's own service domain has the same two names
OPEN_SERVICES = frozenset({"lock.unlock", "lock.open"})
SCRIPT_DOMAIN_SERVICES = frozenset({"turn_on", "turn_off", "toggle", "reload"})
OPEN_STATES = frozenset({"unlocked", "open", "opening", "unlocking"})
LOCKED_STATES = frozenset({"locked", "locking"})
MAX_DEPTH = 6
_TEMPLATE = re.compile(r"\{\{|\{%|\{#")
_REGISTRY_ID = re.compile(r"^[0-9a-f]{32}$")
_ENTITY = re.compile(r"^[a-z0-9_]+\.[a-z0-9_]+$")
_TARGET_KEYS = ("entity_id", "device_id", "area_id", "floor_id", "label_id")

# Hebrew text of each reason a step could not be resolved (the report shows these, never the code)
UNRESOLVED_TEXT = {
    "template_service": "שם הפעולה מחושב בזמן ריצה",
    "template_target": "היעד מחושב בזמן ריצה",
    "template_data": "מספר הממסר מחושב בזמן ריצה",
    "label_target": "היעד הוא תווית",
    "unknown_entity": "התקן שאינו מוכר למערכת",
    "unknown_item": "פריט שאינו מוכר למערכת",
    "unreadable_item": "פריט שתוכנו אינו קריא",
    "template_lock": "מנעול וירטואלי שתוכנו אינו ידוע",
    "group_lock": "קבוצת מנעולים שחבריה אינם ידועים",
    "template_button": "כפתור וירטואלי שתוכנו אינו ידוע",
    "wiskey_button": "כפתור של מערכת האינטרקום",
    "wiskey_device_action": "פעולת התקן של מערכת האינטרקום",
    "door_target_unknown": "לא צוינה דלת",
    "scene_state_unknown": "מצב המנעול בסצנה אינו ידוע",
    "too_deep": "שרשרת קריאות ארוכה מדי",
}
DOOR_PROBLEM_TEXT = {"unmapped": "הדלת לא משויכת לממסר"}


# ================================================================ the resolution of one item

@dataclass(frozen=True)
class DoorStep:
    """One step that opens a WisKey door. `station_id` / `relay` are the door when known (`problem` None)."""

    path: str
    service: str
    entity_id: str | None
    station_id: str | None
    relay: int | None
    via: tuple[str, ...] = ()
    problem: str | None = None


@dataclass(frozen=True)
class Unresolved:
    path: str
    reason: str
    via: tuple[str, ...] = ()


@dataclass
class Resolution:
    door_steps: list[DoorStep] = field(default_factory=list)
    lock_steps: list[str] = field(default_factory=list)  # paths of lock.lock on a WisKey lock (always fails)
    unresolved: list[Unresolved] = field(default_factory=list)
    refs: list[str] = field(default_factory=list)  # the nested items the chain went through

    @property
    def has_door(self) -> bool:
        """Whether the item opens (or may open) a WisKey door: a door step, or a step that cannot be resolved."""
        return bool(self.door_steps or self.unresolved)

    @property
    def resolvable(self) -> bool:
        """Every door step is resolved to a known door and nothing is unresolved."""
        return not self.unresolved and all(s.problem is None for s in self.door_steps)

    def doors(self) -> list[tuple[str, int]]:
        out: list[tuple[str, int]] = []
        for s in self.door_steps:
            if s.problem is None and s.station_id is not None and s.relay is not None and (s.station_id, s.relay) not in out:
                out.append((s.station_id, s.relay))
        return out


def _listify(value: Any) -> list[Any]:
    if value is None:
        return []
    if isinstance(value, list):
        return value
    if isinstance(value, str):
        return [v.strip() for v in value.split(",") if v.strip()]
    return [value]


def _has_template(value: Any, depth: int = 0) -> bool:
    if depth > 12:
        return True
    if isinstance(value, str):
        return bool(_TEMPLATE.search(value))
    if isinstance(value, dict):
        return any(_has_template(k, depth + 1) or _has_template(v, depth + 1) for k, v in value.items())
    if isinstance(value, list):
        return any(_has_template(v, depth + 1) for v in value)
    return False


@dataclass
class _Targets:
    entities: list[str] = field(default_factory=list)
    all_entities: bool = False
    problems: list[str] = field(default_factory=list)  # template_target | label_target | unknown_entity
    explicit: set[str] = field(default_factory=set)  # entity ids named directly (an unknown one is a problem for a lock service)


class Resolver:
    """The static resolver over one connection (entities and items cached per instance: one request, one snapshot)."""

    def __init__(self, conn: sqlite3.Connection) -> None:
        self.conn = conn
        self._entities: dict[str, dict[str, Any] | None] = {}
        self._items: dict[str, sqlite3.Row | None] = {}
        self._present: bool | None = None
        self._map: dict[str, dict[str, Any]] | None = None

    # ------------------------------------------------------------- facts

    def present(self) -> bool:
        """Whether this installation has any WisKey door at all (a WisKey lock entity in the mirror, or a door map row).
        Without one nothing can be a WisKey door and the guards have nothing to judge."""
        if self._present is None:
            self._present = bool(intercom_doors.wiskey_lock_ids(self.conn)) or bool(intercom_doors.map_rows(self.conn))
        return self._present

    def entity(self, entity_id: str) -> dict[str, Any] | None:
        if entity_id not in self._entities:
            row = self.conn.execute(
                "SELECT entity_id, domain, platform, device_id, area_id, ha_floor_id, registry_id, config_entry_id, attributes_json, name, removed_at FROM ha_entities WHERE entity_id = ?",
                (entity_id,),
            ).fetchone()
            self._entities[entity_id] = dict(row) if row is not None and not row["removed_at"] else None
        return self._entities[entity_id]

    def _by_registry_id(self, registry_id: str) -> str | None:
        row = self.conn.execute("SELECT entity_id FROM ha_entities WHERE registry_id = ? AND removed_at IS NULL", (registry_id,)).fetchone()
        return row["entity_id"] if row else None

    def _select(self, column: str, values: list[str]) -> list[str]:
        if not values:
            return []
        marks = ",".join("?" * len(values))
        return [r[0] for r in self.conn.execute(f"SELECT entity_id FROM ha_entities WHERE {column} IN ({marks}) AND removed_at IS NULL ORDER BY entity_id", values).fetchall()]

    def _domain_entities(self, domain: str) -> list[str]:
        return [r[0] for r in self.conn.execute("SELECT entity_id FROM ha_entities WHERE domain = ? AND removed_at IS NULL ORDER BY entity_id", (domain,)).fetchall()]

    def is_wiskey(self, entity_id: str) -> bool:
        e = self.entity(entity_id)
        return bool(e and (e["platform"] or "") in intercom_doors.WISKEY_PLATFORMS)

    def _map_row(self, entity_id: str) -> dict[str, Any] | None:
        if self._map is None:
            self._map = {r["entity_id"]: r for r in intercom_doors.map_rows(self.conn)}
        return self._map.get(entity_id)

    def item_row(self, entity_id: str) -> sqlite3.Row | None:
        if entity_id not in self._items:
            self._items[entity_id] = self.conn.execute("SELECT kind, item_id, entity_id, source, revision, config_json FROM ha_config_items WHERE entity_id = ?", (entity_id,)).fetchone()
        return self._items[entity_id]

    # ------------------------------------------------------------- targets

    def _targets(self, step: dict[str, Any]) -> _Targets:
        t = _Targets()
        sources: list[Any] = [step]
        for key in ("target", "data", "data_template", "service_data"):
            v = step.get(key)
            if isinstance(v, str):
                if _has_template(v):
                    t.problems.append("template_target")
            elif isinstance(v, dict):
                sources.append(v)
        for src in sources:
            for key in _TARGET_KEYS:
                if key not in src:
                    continue
                raw = src[key]
                if _has_template(raw):
                    t.problems.append("template_target")
                    continue
                values = [v for v in _listify(raw) if isinstance(v, str)]
                if key == "entity_id":
                    for v in values:
                        low = v.lower()
                        if low == "all":
                            t.all_entities = True
                        elif low == "none":
                            continue
                        elif _REGISTRY_ID.fullmatch(low):
                            eid = self._by_registry_id(low)
                            if eid is None:
                                t.problems.append("unknown_entity")
                            else:
                                t.entities.append(eid)
                                t.explicit.add(eid)
                        else:
                            t.entities.append(low)
                            t.explicit.add(low)
                elif key == "device_id":
                    t.entities.extend(self._select("device_id", values))
                elif key == "area_id":
                    t.entities.extend(self._select("area_id", values))
                elif key == "floor_id":
                    t.entities.extend(self._select("ha_floor_id", values))
                elif key == "label_id" and values:
                    t.problems.append("label_target")
        t.entities = list(dict.fromkeys(t.entities))
        return t

    def _of_domain(self, t: _Targets, domain: str) -> list[str]:
        out = [e for e in t.entities if e.split(".", 1)[0] == domain]
        if t.all_entities:
            out += [e for e in self._domain_entities(domain) if e not in out]
        return out

    # ------------------------------------------------------------- walking

    def resolve_actions(self, steps: Any, path: str = "actions", via: tuple[str, ...] = (), depth: int = 0, out: Resolution | None = None, seen: frozenset[str] = frozenset()) -> Resolution:
        """Walk a list of Home Assistant actions (automation `actions`, script `sequence`), every branch included."""
        res = out if out is not None else Resolution()
        if steps is None:
            return res
        if isinstance(steps, dict):
            steps = [steps]
        if not isinstance(steps, list):
            if _has_template(steps):
                res.unresolved.append(Unresolved(path, "template_service", via))
            return res
        for i, s in enumerate(steps):
            p = f"{path}[{i}]"
            if not isinstance(s, dict) or s.get("enabled") is False:
                continue
            self._containers(s, p, via, depth, res, seen)
            svc = s.get("action", s.get("service"))
            if "service_template" in s or (svc is not None and not isinstance(svc, str)):
                res.unresolved.append(Unresolved(p, "template_service", via))
            elif isinstance(svc, str):
                self._call(svc, s, p, via, depth, res, seen)
            elif "scene" in s:
                self._ref_entities([s["scene"]] if isinstance(s["scene"], str) else [], "scene", p, via, depth, res, seen, problems=["template_target"] if _has_template(s["scene"]) else [])
            elif "device_id" in s and "domain" in s and "type" in s:
                self._device_action(s, p, via, depth, res, seen)
        return res

    def _containers(self, s: dict[str, Any], p: str, via: tuple[str, ...], depth: int, res: Resolution, seen: frozenset[str]) -> None:
        if "choose" in s:
            options = s["choose"] if isinstance(s["choose"], list) else [s["choose"]]
            for j, opt in enumerate(options):
                if isinstance(opt, dict):
                    self.resolve_actions(opt.get("sequence"), f"{p}.choose[{j}].sequence", via, depth, res, seen)
            if "default" in s:
                self.resolve_actions(s["default"], f"{p}.default", via, depth, res, seen)
        if "if" in s:
            self.resolve_actions(s.get("then"), f"{p}.then", via, depth, res, seen)
            self.resolve_actions(s.get("else"), f"{p}.else", via, depth, res, seen)
        if "parallel" in s:
            branches = s["parallel"] if isinstance(s["parallel"], list) else [s["parallel"]]
            for j, b in enumerate(branches):
                if isinstance(b, dict) and "sequence" in b and not ({"action", "service"} & set(b)):
                    self.resolve_actions(b.get("sequence"), f"{p}.parallel[{j}].sequence", via, depth, res, seen)
                else:
                    self.resolve_actions([b], f"{p}.parallel[{j}]", via, depth, res, seen)
        if "sequence" in s and not ({"action", "service"} & set(s)):
            self.resolve_actions(s["sequence"], f"{p}.sequence", via, depth, res, seen)
        if isinstance(s.get("repeat"), dict):
            self.resolve_actions(s["repeat"].get("sequence"), f"{p}.repeat.sequence", via, depth, res, seen)

    def _call(self, svc: str, s: dict[str, Any], p: str, via: tuple[str, ...], depth: int, res: Resolution, seen: frozenset[str]) -> None:
        if _has_template(svc):
            res.unresolved.append(Unresolved(p, "template_service", via))
            return
        svc = svc.strip().lower()
        domain, _, name = svc.partition(".")
        if svc in OPEN_SERVICES or svc == "lock.lock":
            t = self._targets(s)
            for prob in dict.fromkeys(t.problems):
                res.unresolved.append(Unresolved(p, prob, via))
            for e in self._of_domain(t, "lock"):
                self._lock(e, svc, p, via, depth, res, seen, explicit=e in t.explicit)
            return
        if domain in WISKEY_DOMAINS:
            if name == "unlock_door":
                self._wiskey_unlock(s, svc, p, via, res)
            return
        if svc in ("script.turn_on", "script.toggle"):
            t = self._targets(s)
            self._ref_entities(self._of_domain(t, "script"), "script", p, via, depth, res, seen, problems=t.problems, explicit=t.explicit)
            return
        if domain == "script" and name and name not in SCRIPT_DOMAIN_SERVICES:
            self._ref_entities([f"script.{name}"], "script", p, via, depth, res, seen, explicit={f"script.{name}"})
            return
        if svc == "automation.trigger":
            t = self._targets(s)
            self._ref_entities(self._of_domain(t, "automation"), "automation", p, via, depth, res, seen, problems=t.problems, explicit=t.explicit)
            return
        if svc == "scene.turn_on":
            t = self._targets(s)
            self._ref_entities(self._of_domain(t, "scene"), "scene", p, via, depth, res, seen, problems=t.problems, explicit=t.explicit)
            return
        if svc == "scene.apply":
            data = s.get("data") if isinstance(s.get("data"), dict) else {}
            self.resolve_scene_members(data.get("entities"), f"{p}.data.entities", via, depth, res, seen)
            return
        if svc in ("homeassistant.turn_on", "homeassistant.toggle"):
            t = self._targets(s)
            self._ref_entities(self._of_domain(t, "script"), "script", p, via, depth, res, seen, problems=t.problems, explicit=t.explicit)
            self._ref_entities(self._of_domain(t, "scene"), "scene", p, via, depth, res, seen, problems=[], explicit=t.explicit)
            return
        if svc == "button.press":
            t = self._targets(s)
            for e in self._of_domain(t, "button"):
                ent = self.entity(e)
                if ent is None:
                    continue
                if (ent["platform"] or "") in intercom_doors.WISKEY_PLATFORMS:
                    res.unresolved.append(Unresolved(p, "wiskey_button", via))
                elif ent["platform"] == "template":
                    res.unresolved.append(Unresolved(p, "template_button", via))

    def _lock(self, entity_id: str, svc: str, p: str, via: tuple[str, ...], depth: int, res: Resolution, seen: frozenset[str], *, explicit: bool) -> None:
        ent = self.entity(entity_id)
        if ent is None:
            if explicit and svc in OPEN_SERVICES:
                res.unresolved.append(Unresolved(p, "unknown_entity", via))
            return
        platform = ent["platform"] or ""
        if platform in intercom_doors.WISKEY_PLATFORMS:
            if svc == "lock.lock":
                res.lock_steps.append(p)
                return
            res.door_steps.append(self._door_of(entity_id, svc, p, via))
            return
        if svc not in OPEN_SERVICES:
            return
        if platform == "template":
            res.unresolved.append(Unresolved(p, "template_lock", via))
        elif platform == "group":
            if depth >= MAX_DEPTH:
                res.unresolved.append(Unresolved(p, "too_deep", via))
                return
            members = _attr_members(ent)
            if not members:
                # the mirror keeps no member list for a lock group (ha_sync stores members only for scenes / media):
                # what it unlocks is unknown, so it is unresolved (fail closed), never "not a door"
                res.unresolved.append(Unresolved(p, "group_lock", via))
                return
            for m in members:
                if m.split(".", 1)[0] == "lock" and m != entity_id and m not in seen:
                    self._lock(m, svc, p, via + (entity_id,), depth + 1, res, seen | {entity_id}, explicit=True)

    def _door_of(self, entity_id: str, svc: str, p: str, via: tuple[str, ...]) -> DoorStep:
        """The door a WisKey lock entity opens: the door map, valid right now (the same rule the transport uses)."""
        row = self._map_row(entity_id)
        if row is None:
            return DoorStep(p, svc, entity_id, None, None, via, "unmapped")
        ent = self.entity(entity_id) or {}
        if intercom_doors.row_valid(self.conn, row, ent.get("config_entry_id")) is not None:
            return DoorStep(p, svc, entity_id, row["config_entry_id"], int(row["physical_index"]), via, "unmapped")
        return DoorStep(p, svc, entity_id, row["config_entry_id"], int(row["physical_index"]), via, None)

    def _wiskey_unlock(self, s: dict[str, Any], svc: str, p: str, via: tuple[str, ...], res: Resolution) -> None:
        """WisKey's `unlock_door`: the target lock entities name the station; `data.lock` (1 | 2, default 1) is the relay."""
        t = self._targets(s)
        for prob in dict.fromkeys(t.problems):
            res.unresolved.append(Unresolved(p, prob, via))
        data = s.get("data") if isinstance(s.get("data"), dict) else {}
        raw_relay = data.get("lock", 1)
        relay: int | None = None
        if _has_template(raw_relay):
            res.unresolved.append(Unresolved(p, "template_data", via))
        else:
            try:
                relay = int(str(raw_relay).strip())
            except ValueError:
                relay = None
        stations: list[tuple[str | None, str | None]] = []
        for e in self._of_domain(t, "lock"):
            ent = self.entity(e)
            if ent is None:
                res.unresolved.append(Unresolved(p, "unknown_entity", via))
                continue
            if (ent["platform"] or "") not in intercom_doors.WISKEY_PLATFORMS:
                continue
            row = self._map_row(e)
            stations.append((row["config_entry_id"] if row else ent["config_entry_id"], e))
        if not stations and not t.problems:
            res.unresolved.append(Unresolved(p, "door_target_unknown", via))
        for station_id, eid in stations:
            ok = station_id is not None and relay is not None
            res.door_steps.append(DoorStep(p, svc, eid, station_id, relay, via, None if ok else "unmapped"))

    def _device_action(self, s: dict[str, Any], p: str, via: tuple[str, ...], depth: int, res: Resolution, seen: frozenset[str]) -> None:
        domain = str(s.get("domain") or "").lower()
        kind = str(s.get("type") or "").lower()
        if domain in WISKEY_DOMAINS:
            res.unresolved.append(Unresolved(p, "wiskey_device_action", via))
            return
        if domain != "lock" or kind not in ("unlock", "open", "lock"):
            return
        raw = s.get("entity_id")
        if _has_template(raw):
            res.unresolved.append(Unresolved(p, "template_target", via))
            return
        eid = raw.lower() if isinstance(raw, str) else None
        if eid and _REGISTRY_ID.fullmatch(eid):
            eid = self._by_registry_id(eid)
        svc = "lock.lock" if kind == "lock" else f"lock.{kind}"
        if eid is None or not _ENTITY.fullmatch(eid):
            if svc in OPEN_SERVICES:
                res.unresolved.append(Unresolved(p, "unknown_entity", via))
            return
        self._lock(eid, svc, p, via, depth, res, seen, explicit=True)

    def _ref_entities(self, entity_ids: list[str], role: str, p: str, via: tuple[str, ...], depth: int, res: Resolution, seen: frozenset[str], *, problems: list[str] | None = None,
                      explicit: set[str] | None = None) -> None:
        """Follow scripts / automations / scenes the step runs. A reference that cannot be expanded is unresolved."""
        for prob in dict.fromkeys(problems or []):
            res.unresolved.append(Unresolved(p, prob, via))
        for eid in entity_ids:
            if eid in seen:
                continue  # a cycle: that item's steps are already being walked
            if depth >= MAX_DEPTH:
                res.unresolved.append(Unresolved(p, "too_deep", via))
                return
            res.refs.append(eid)
            self.resolve_entity_item(eid, role, p, via + (eid,), depth + 1, res, seen | {eid}, explicit=bool(explicit and eid in explicit))

    def resolve_entity_item(self, entity_id: str, role: str, p: str, via: tuple[str, ...], depth: int, res: Resolution, seen: frozenset[str], *, explicit: bool = True) -> None:
        row = self.item_row(entity_id)
        if row is None:
            ent = self.entity(entity_id)
            if role == "scene" and ent is not None:
                # a scene the editor does not hold (an integration scene, YAML): only its members are known, not their states
                for m in _attr_members(ent):
                    if m.split(".", 1)[0] == "lock" and self.is_wiskey(m):
                        res.unresolved.append(Unresolved(p, "scene_state_unknown", via))
                return
            if ent is None and not explicit:
                return
            res.unresolved.append(Unresolved(p, "unknown_item", via))
            return
        cfg = _config(row)
        if cfg is None:
            res.unresolved.append(Unresolved(p, "unreadable_item", via))
            return
        self.resolve_config(row["kind"], cfg, via, depth, res, seen, path=p)

    def resolve_config(self, kind: str, cfg: dict[str, Any], via: tuple[str, ...] = (), depth: int = 0, res: Resolution | None = None, seen: frozenset[str] = frozenset(),
                       path: str = "") -> Resolution:
        res = res if res is not None else Resolution()
        prefix = f"{path}>" if path else ""
        if kind == "scene":
            self.resolve_scene_members(cfg.get("entities"), f"{prefix}entities", via, depth, res, seen)
        elif kind == "script":
            self.resolve_actions(cfg.get("sequence"), f"{prefix}sequence", via, depth, res, seen)
        elif kind == "automation":
            self.resolve_actions(cfg.get("actions", cfg.get("action")), f"{prefix}actions", via, depth, res, seen)
        return res

    def resolve_scene_members(self, entities: Any, p: str, via: tuple[str, ...], depth: int, res: Resolution, seen: frozenset[str]) -> None:
        if entities is None:
            return
        if not isinstance(entities, dict):
            if _has_template(entities):
                res.unresolved.append(Unresolved(p, "template_target", via))
            return
        for eid, value in entities.items():
            if not isinstance(eid, str) or eid.split(".", 1)[0] != "lock":
                continue
            state = value.get("state") if isinstance(value, dict) else value
            mp = f"{p}.{eid}"
            if _has_template(state) or not isinstance(state, str):
                if self.is_wiskey(eid) or (self.entity(eid) or {}).get("platform") in ("template", "group") or self.entity(eid) is None:
                    res.unresolved.append(Unresolved(mp, "scene_state_unknown", via))
                continue
            st = state.strip().lower()
            if st in OPEN_STATES:
                self._lock(eid.lower(), "lock.unlock", mp, via, depth, res, seen, explicit=True)
            elif st in LOCKED_STATES:
                self._lock(eid.lower(), "lock.lock", mp, via, depth, res, seen, explicit=True)

    # ------------------------------------------------------------- items

    def resolve_item(self, kind: str, item_id: str) -> tuple[Resolution, sqlite3.Row | None]:
        """An automation / script / scene of the mirror by its item id."""
        row = self.conn.execute("SELECT kind, item_id, entity_id, source, revision, config_json FROM ha_config_items WHERE kind = ? AND item_id = ?", (kind, item_id)).fetchone()
        res = Resolution()
        if row is None:
            return res, None
        cfg = _config(row)
        seen = frozenset({row["entity_id"]}) if row["entity_id"] else frozenset()
        if cfg is None:
            if kind == "scene" and row["entity_id"]:
                self.resolve_entity_item(row["entity_id"], "scene", "entities", (), 0, res, frozenset(), explicit=True)
            else:
                res.unresolved.append(Unresolved("", "unreadable_item"))
            return res, row
        return self.resolve_config(kind, cfg, (), 0, res, seen), row

    def resolve_schedule_slots(self, item: dict[str, Any], slots: list[int] | None = None) -> Resolution:
        """A schedule of the scheduler component (`timeslots[].actions[]` = {service, entity_id, service_data}); `slots`
        limits it to the slots that run (a "run now" runs one)."""
        res = Resolution()
        timeslots = item.get("timeslots") if isinstance(item.get("timeslots"), list) else []
        for k, slot in enumerate(timeslots):
            if slots is not None and k not in slots:
                continue
            actions = slot.get("actions") if isinstance(slot, dict) and isinstance(slot.get("actions"), list) else []
            steps = []
            for a in actions:
                if not isinstance(a, dict):
                    continue
                step: dict[str, Any] = {"action": a.get("service")}
                if a.get("entity_id") is not None:
                    step["entity_id"] = a.get("entity_id")
                if isinstance(a.get("service_data"), dict):
                    step["data"] = a["service_data"]
                elif a.get("service_data") is not None:
                    step["data"] = a["service_data"]
                steps.append(step)
            self.resolve_actions(steps, f"timeslots[{k}].actions", (), 0, res, frozenset())
        return res


def _attr_members(ent: dict[str, Any]) -> list[str]:
    try:
        attrs = json.loads(ent.get("attributes_json") or "{}")
    except ValueError:
        return []
    members = attrs.get("entity_id") if isinstance(attrs, dict) else None
    return [m.lower() for m in members if isinstance(m, str)] if isinstance(members, list) else []


def _config(row: sqlite3.Row) -> dict[str, Any] | None:
    try:
        cfg = json.loads(row["config_json"]) if row["config_json"] else None
    except ValueError:
        return None
    return cfg if isinstance(cfg, dict) else None


# ================================================================ the inventory (D7)

ORIGIN_TEXT = {"arx_authored": "נוצר ב-Arx", "arx_edited_externally": "נוצר ב-Arx ושונה מחוץ למערכת", "external": "נוצר מחוץ למערכת", "unknown": "מקור לא ידוע"}
KIND_TEXT = {"automation": "אוטומציה", "script": "סקריפט", "scene": "סצנה", "schedule": "תזמון", "launcher": "כפתור מהיר במסך הבית"}
SUGGESTION_TEXT = {
    "door_button": "כפתור הדלת",
    "hold_open_program": "תוכנית החזקה פתוחה ב-WisKey",
    "arx_event_job": "משימת דלת של Arx (בהמשך)",
    "manual_review": "בדיקה ידנית - לא ניתן לזהות את הדלתות",
    "remove_lock_step": "הסרת שלב הנעילה (אינו נתמך בדלת אינטרקום)",
    "external_untouched": "לא מטופל ב-Arx - נשאר כפי שהוא",
}
GUARD_TEXT = {
    "refused_not_converted": "הרצה מ-Arx נחסמת: יש בפריט פתיחת דלת שלא הוסבה",
    "refused_unresolvable": "הרצה מ-Arx נחסמת: לא ניתן לזהות את הדלתות בפריט",
    "unchanged": "הרצה מ-Arx ללא שינוי",
}
APPROVER_TEXT = {"approved": "מאושר", "none": "אין מאשר", "inactive": "המאשר אינו פעיל", "no_permission": "למאשר אין הרשאת פתיחה"}
AUTOMATION_WRITES = ("automation.create", "automation.update", "automation.code_edit", "automation.copy", "automation.restore")
SCHEDULE_WRITES = ("schedule.create", "schedule.update", "schedule.enable", "schedule.split", "schedule.copy", "schedule.restore")


def _details(row: sqlite3.Row) -> dict[str, Any]:
    try:
        d = json.loads(row["details_json"] or "{}")
    except ValueError:
        return {}
    return d if isinstance(d, dict) else {}


def approver_of(conn: sqlite3.Connection, kind: str, item_id: str, revision: str | None) -> dict[str, Any] | None:
    """The person whose CONFIRMING write covers the live revision (CR-033 6.1 / transition table section 6 step 3), or None.
    Schedules: an allowed write whose `revision_after` is the live revision and that carried the lowering confirmation
    (opening a lock is a lowering; the write was refused without the confirmation). Automations / scripts / scenes: an
    allowed write whose `revision_after` is the live revision and whose content was sensitive (the writer held the
    sensitive grant for every step). The latest such row wins. `created_by` / `updated_by` alone never count."""
    if not revision:
        return None
    if kind == "schedule":
        actions, resource, flag = SCHEDULE_WRITES, item_id, "lowering"
    else:
        actions, resource, flag = AUTOMATION_WRITES, f"{kind}:{item_id}", "sensitive"
    marks = ",".join("?" * len(actions))
    rows = conn.execute(
        f"SELECT at, actor_user_id, actor_username, details_json FROM audit_log WHERE action IN ({marks}) AND decision = 'allowed' AND resource_id = ? AND reason IS NULL ORDER BY id DESC LIMIT 200",
        (*actions, resource),
    ).fetchall()
    for r in rows:
        d = _details(r)
        if d.get("revision_after") == revision and d.get(flag) is True and r["actor_user_id"]:
            return {"user_id": r["actor_user_id"], "username": r["actor_username"], "revision": revision, "at": r["at"]}
    return None


def _user_active(conn: sqlite3.Connection, user_id: str) -> tuple[bool, sqlite3.Row | None]:
    u = conn.execute("SELECT id, username, display_name, source, active FROM users WHERE id = ?", (user_id,)).fetchone()
    if u is None or not u["active"]:
        return False, u
    try:
        ha = conn.execute("SELECT is_active FROM ha_users WHERE id = ?", (user_id,)).fetchone()
    except sqlite3.OperationalError:
        ha = None
    if ha is not None and not ha["is_active"]:
        return False, u
    return True, u


def approver_status(conn: sqlite3.Connection, approver: dict[str, Any] | None, doors: list[tuple[str, int]], *, dev_mode: bool) -> str:
    """`approved` (active and, today, allowed by the one door rule for every known door), `none`, `inactive`, `no_permission`."""
    from . import door_authority

    if approver is None:
        return "none"
    active, u = _user_active(conn, approver["user_id"])
    if not active or u is None:
        return "inactive"
    p = Principal(u["id"], u["username"] or "", u["display_name"] or "", u["source"] or "ingress")
    for station_id, relay in doors:
        if not door_authority.check(conn, p, station_id, relay, dev_mode=dev_mode).allowed:
            return "no_permission"
    return "approved"


def _automation_origin(conn: sqlite3.Connection, kind: str, item_id: str, revision: str | None) -> tuple[str, sqlite3.Row | None]:
    meta = conn.execute("SELECT * FROM automation_meta WHERE kind = ? AND item_id = ?", (kind, item_id)).fetchone()
    if meta is None:
        return "unknown", None
    if meta["created_via"] == "external":
        return "external", meta
    last = conn.execute("SELECT via, revision FROM automation_versions WHERE kind = ? AND item_id = ? ORDER BY id DESC LIMIT 1", (kind, item_id)).fetchone()
    if last is None:
        return "unknown", meta
    if last["via"] == "arx" and revision and last["revision"] == revision:
        return "arx_authored", meta
    return "arx_edited_externally", meta


def _schedule_origin(conn: sqlite3.Connection, schedule_id: str, revision: str | None) -> tuple[str, sqlite3.Row | None]:
    meta = conn.execute("SELECT * FROM schedule_meta WHERE schedule_id = ?", (schedule_id,)).fetchone()
    if meta is None:
        return "unknown", None
    if meta["created_via"] == "external":
        return "external", meta
    marks = ",".join("?" * len(SCHEDULE_WRITES))
    last = conn.execute(f"SELECT details_json FROM audit_log WHERE action IN ({marks}) AND decision = 'allowed' AND resource_id = ? ORDER BY id DESC LIMIT 1", (*SCHEDULE_WRITES, schedule_id)).fetchone()
    if last is None:
        return "unknown", meta
    return ("arx_authored" if revision and _details(last).get("revision_after") == revision else "arx_edited_externally"), meta


def _door_names(res: Resolution, r: Resolver) -> list[str]:
    """The doors an item opens, by name only: the WisKey station's name and the relay (or the lock's own name when the
    door is not known); never an id."""
    out: list[str] = []
    for s in res.door_steps:
        station = intercom_sync.SYNC.station(s.station_id) if s.station_id else None
        if station is not None and s.relay is not None:
            relay_name = next((lk.get("name") for lk in station.get("locks") or [] if int(lk.get("physical_index") or 0) == s.relay), None)
            label = f"{station['name']} · {relay_name or f'ממסר {s.relay}'}"
        else:
            label = (_entity_label(r, s.entity_id) or "דלת לא משויכת") if s.entity_id else "דלת לא מזוהה"
        if label not in out:
            out.append(label)
    return out



def _suggestion(kind: str, origin: str, res: Resolution, recurring: bool) -> str:
    if origin == "external":
        return "external_untouched"
    if res.has_door and not res.resolvable:
        return "manual_review"
    if not res.has_door:
        return "remove_lock_step"
    if kind == "schedule":
        return "hold_open_program" if recurring else "door_button"
    if kind == "automation":
        return "arx_event_job"
    return "door_button"


def _guard(res: Resolution) -> str:
    if not res.has_door:
        return "unchanged"
    return "refused_not_converted" if res.resolvable else "refused_unresolvable"


def _last_automation_run(conn: sqlite3.Connection, kind: str, item_id: str) -> dict[str, Any] | None:
    r = conn.execute("SELECT at, result FROM automation_runs WHERE kind = ? AND item_id = ? ORDER BY at DESC LIMIT 1", (kind, item_id)).fetchone()
    return {"at": r["at"], "result": r["result"]} if r else None


def _last_schedule_run(conn: sqlite3.Connection, schedule_id: str) -> dict[str, Any] | None:
    r = conn.execute("SELECT started_at, result FROM schedule_runs WHERE schedule_id = ? ORDER BY started_at DESC LIMIT 1", (schedule_id,)).fetchone()
    return {"at": r["started_at"], "result": r["result"]} if r else None


def _view(conn: sqlite3.Connection, r: Resolver, *, kind: str, key: str, name: str, origin: str, state: str, autonomous: bool, meta: sqlite3.Row | None, approver: dict[str, Any] | None,
          res: Resolution, last_run: dict[str, Any] | None, recurring: bool, dev_mode: bool, revision: str | None) -> dict[str, Any]:
    status = approver_status(conn, approver, res.doors(), dev_mode=dev_mode)
    suggestion = _suggestion(kind, origin, res, recurring)
    guard = _guard(res)
    unresolved = list(dict.fromkeys(UNRESOLVED_TEXT.get(u.reason, u.reason) for u in res.unresolved))
    unresolved += [DOOR_PROBLEM_TEXT["unmapped"]] if any(s.problem for s in res.door_steps) and DOOR_PROBLEM_TEXT["unmapped"] not in unresolved else []
    # an autonomous item (it fires on its own in the infrastructure) with a door step and no valid approver must be
    # disabled and listed (DR-5, CR-033 6.4) - that disable is an owner-approved write run, never done by this report
    disable_required = autonomous and res.has_door and origin != "external" and status != "approved"
    return {
        "kind": kind,
        "kind_text": KIND_TEXT[kind],
        "key": key,
        "name": name,
        "origin": origin,
        "origin_text": ORIGIN_TEXT[origin],
        "state": state,
        "autonomous": autonomous,
        "author": (meta["updated_by_username"] or meta["created_by_username"]) if meta is not None else None,
        "created_by": meta["created_by_username"] if meta is not None else None,
        "approver": approver["username"] if approver else None,
        "approved_at": approver["at"] if approver else None,
        "approver_status": status,
        "approver_text": APPROVER_TEXT[status],
        "last_run": last_run,
        "door_steps": len(res.door_steps),
        "lock_steps": len(res.lock_steps),
        "doors": _door_names(res, r),
        "resolvable": res.resolvable,
        "unresolved": unresolved,
        "run_guard": guard,
        "run_guard_text": GUARD_TEXT[guard],
        "suggestion": suggestion,
        "suggestion_text": SUGGESTION_TEXT[suggestion],
        "disable_required": disable_required,
        "revision": revision,
    }


def inventory(conn: sqlite3.Connection, *, dev_mode: bool = False) -> dict[str, Any]:
    """The read-only report "פריטים שפותחים דלתות": every saved item with a WisKey door step (or one that cannot be
    resolved, or a lock.lock on a WisKey lock), from Arx's own mirror. No call, no write."""
    r = Resolver(conn)
    present = r.present()
    items: list[dict[str, Any]] = []
    if present:
        items.extend(_config_items(conn, r, dev_mode))
        items.extend(_schedules(conn, r, dev_mode))
        items.extend(_launcher(conn, r, dev_mode))
    order = {"refused_unresolvable": 0, "refused_not_converted": 1, "unchanged": 2}
    items.sort(key=lambda i: (order[i["run_guard"]], i["kind"], i["name"]))
    counts = {
        "items": len(items),
        "door_steps": sum(i["door_steps"] for i in items),
        "unresolvable": sum(1 for i in items if i["run_guard"] == "refused_unresolvable"),
        "arx_authored": sum(1 for i in items if i["origin"] == "arx_authored"),
        "external": sum(1 for i in items if i["origin"] == "external"),
        "disable_required": sum(1 for i in items if i["disable_required"]),
    }
    return {"wiskey_present": present, "generated_at": now_iso(), "counts": counts, "items": items}


def _config_items(conn: sqlite3.Connection, r: Resolver, dev_mode: bool) -> list[dict[str, Any]]:
    out = []
    rows = conn.execute("SELECT kind, item_id, entity_id, source, revision, config_json FROM ha_config_items ORDER BY kind, item_id").fetchall()
    for row in rows:
        res, _ = r.resolve_item(row["kind"], row["item_id"])
        if not (res.has_door or res.lock_steps):
            continue
        kind, item_id = row["kind"], row["item_id"]
        origin, meta = _automation_origin(conn, kind, item_id, row["revision"])
        cfg = _config(row) or {}
        name = str(cfg.get("alias") or cfg.get("name") or "") or _entity_label(r, row["entity_id"]) or KIND_TEXT[kind]
        ent = r.entity(row["entity_id"]) if row["entity_id"] else None
        estate = conn.execute("SELECT state FROM ha_entities WHERE entity_id = ?", (row["entity_id"],)).fetchone() if row["entity_id"] else None
        if meta is not None and meta["gone_at"]:
            state = "gone"
        elif kind == "automation":
            state = "enabled" if estate is not None and estate["state"] == "on" else ("disabled" if estate is not None and estate["state"] == "off" else "unknown")
        else:
            state = "ready" if ent is not None else "unknown"
        approver = approver_of(conn, kind, item_id, row["revision"])
        out.append(_view(conn, r, kind=kind, key=f"{kind}:{item_id}", name=name, origin=origin, state=state, autonomous=(kind == "automation" and state == "enabled"), meta=meta,
                         approver=approver, res=res, last_run=_last_automation_run(conn, kind, item_id), recurring=False, dev_mode=dev_mode, revision=row["revision"]))
    return out


def _entity_label(r: Resolver, entity_id: str | None) -> str:
    if not entity_id:
        return ""
    e = r.entity(entity_id)
    return (e or {}).get("name") or ""


def _schedules(conn: sqlite3.Connection, r: Resolver, dev_mode: bool) -> list[dict[str, Any]]:
    out = []
    for row in conn.execute("SELECT schedule_id, entity_id, revision, item_json, enabled FROM schedule_cache ORDER BY schedule_id").fetchall():
        try:
            item = json.loads(row["item_json"] or "{}")
        except ValueError:
            item = None
        res = r.resolve_schedule_slots(item) if isinstance(item, dict) else Resolution(unresolved=[Unresolved("", "unreadable_item")])
        if not (res.has_door or res.lock_steps):
            continue
        sid = row["schedule_id"]
        origin, meta = _schedule_origin(conn, sid, row["revision"])
        name = str((item or {}).get("name") or "") or KIND_TEXT["schedule"]
        state = "gone" if meta is not None and meta["gone_at"] else ("enabled" if row["enabled"] else "disabled")
        recurring = str((item or {}).get("repeat_type") or "repeat") == "repeat"
        approver = approver_of(conn, "schedule", sid, row["revision"])
        out.append(_view(conn, r, kind="schedule", key=f"schedule:{sid}", name=name, origin=origin, state=state, autonomous=state == "enabled", meta=meta, approver=approver,
                         res=res, last_run=_last_schedule_run(conn, sid), recurring=recurring, dev_mode=dev_mode, revision=row["revision"]))
    return out


def _launcher(conn: sqlite3.Connection, r: Resolver, dev_mode: bool) -> list[dict[str, Any]]:
    """The home screen's quick launcher (BV1): a button that activates a scene or runs a script that opens a door is listed
    too (it is one more way to start the same item from Arx; the run guard covers it on the item's own route)."""
    from . import home_screen

    try:
        cfg = home_screen.effective_config(conn)
    except Exception:  # noqa: BLE001 - a launcher setting that does not parse lists nothing (the home screen shows nothing either)
        return []
    launcher = cfg.get("launcher") if isinstance(cfg, dict) else None
    out = []
    for n, it in enumerate((launcher or {}).get("items") or []):
        if not isinstance(it, dict) or it.get("kind") not in ("scene", "script"):
            continue
        res = Resolution()
        r.resolve_entity_item(str(it.get("id") or ""), it["kind"], "launcher", (), 0, res, frozenset(), explicit=True)
        if not (res.has_door or res.lock_steps):
            continue
        row = r.item_row(str(it.get("id") or ""))
        origin = "unknown"
        if row is not None:
            origin, _ = _automation_origin(conn, row["kind"], row["item_id"], row["revision"])
        name = str(it.get("label") or "") or _entity_label(r, str(it.get("id") or "")) or KIND_TEXT["launcher"]
        out.append(_view(conn, r, kind="launcher", key=f"launcher:{n}", name=name, origin=origin, state="ready", autonomous=False, meta=None, approver=None, res=res,
                         last_run=None, recurring=False, dev_mode=dev_mode, revision=None))
    return out
