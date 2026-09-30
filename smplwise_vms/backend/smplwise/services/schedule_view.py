"""CR-014 (schedules): what a caller sees and may do - the read model per caller (docs/architecture/SCHEDULER_API.md §2.1,
§3.1-§3.4b, §3.16-§3.18, §4).

`Ctx` is the per-request context: the installation's settings, the mirrored entities the schedules name (loaded in
batches, classified once: §5.1), the alarm panels' code needs and the write state. `Access` holds the caller's reach for
each permission (a placement rule per action entity: services/ha_scope.py). Visibility (decision 1a: by ACTION entities
only, conditions never hide a schedule), the change rights `can`, the read-only reasons and the review issues are
computed here; the writes (`schedule_ops.py`) reuse the same rule functions, so a right shown is a right enforced."""
from __future__ import annotations

import datetime as dt
import json
import sqlite3
from typing import Any

from ..db import get_setting
from ..rbac import INSTALLATION, Principal, authorize, permissions_anywhere
from . import alarm as alarm_svc
from . import devices as dsvc
from . import ha_scope, ha_sync
from . import schedule_model as model
from . import schedule_policy as policy
from . import schedules as store

VIEW, MANAGE, SENSITIVE = "schedule.view", "schedule.manage", "schedule.sensitive"
PERMS = (VIEW, MANAGE, SENSITIVE, "devices.read", "entity.state.read", "ha.entity.control", "devices.control", "door.unlock", "alarm.view", "alarm.arm", "alarm.disarm")
CATALOG_LIMIT = 500
CANDIDATE_LIMIT = 500
CATALOG_DOMAINS = ("light", "switch", "cover", "climate", "fan", "alarm_control_panel", "lock", "button")
COND_DOMAINS = ("binary_sensor", "sensor", "sun", "input_boolean")
STATES = ("on", "off", "triggered", "completed", "unavailable", "unknown")

REASON_MESSAGES = {
    "no_manage_permission": "אין לך הרשאה לנהל תזמונים של ההתקנים האלה.",
    "sensitive_permission_required": "תזמון של אזעקה, מנעולים, דלתות ושערים דורש הרשאה לתזמון פעולות רגישות.",
    "class_disabled": "סוג ההתקן כובה בהגדרות › תזמונים.",
    "unsupported_content": "התזמון כולל תוכן שהמערכת אינה מציגה במלואו; אפשר לערוך אותו רק ברכיב המקורי.",
    "feature_disabled": "התזמונים כבויים בהגדרות המערכת.",
    "component_unavailable": "רכיב התזמונים אינו זמין כרגע.",
    "ha_unavailable": "תשתית המערכת אינה זמינה כרגע.",
    "bridge_unavailable": "נדרש עדכון או צימוד של רכיב החיבור כדי לשמור תזמונים.",
}
WRITE_BLOCK_REASON = {"feature_disabled": "feature_disabled", "component_missing": "component_unavailable", "ha_unavailable": "ha_unavailable",
                      "bridge_missing": "bridge_unavailable", "bridge_unpaired": "bridge_unavailable", "bridge_too_old": "bridge_unavailable"}


def reason(code: str, entity_id: str | None = None, message: str | None = None) -> dict[str, Any]:
    out: dict[str, Any] = {"code": code, "message": message or REASON_MESSAGES.get(code, code)}
    if entity_id:
        out["entity_id"] = entity_id
    return out


def redact(value: Any) -> Any:
    """`value` with every code-like key's value hidden - a schedule that (wrongly) carries a code must never show it."""
    if isinstance(value, dict):
        return {k: ("***" if isinstance(k, str) and k.lower() in policy._CODE_KEYS else redact(v)) for k, v in value.items()}
    if isinstance(value, list):
        return [redact(v) for v in value]
    return value


# ---------------------------------------------------------------- access

class Access:
    """The caller's reach per permission, computed once per request (`ha_scope.visible_floors`)."""

    def __init__(self, conn: sqlite3.Connection, principal: Principal | None) -> None:
        self.conn, self.principal = conn, principal
        self.reach: dict[str, tuple[bool, set[str]]] = {}
        if principal is not None:
            self.reach = {p: ha_scope.visible_floors(conn, principal, p) for p in PERMS}
        self._placed: dict | None = None
        self._own: dict | None = None
        self._reaches = None

    def wide(self, perm: str) -> bool:
        return bool(self.reach.get(perm, (False, set()))[0])

    def anywhere(self, perm: str) -> bool:
        wide, floors = self.reach.get(perm, (False, set()))
        return bool(wide or floors)

    def placed(self) -> dict:
        if self._placed is None:
            self._placed = ha_scope.placements(self.conn)
        return self._placed

    def own_placed(self) -> dict:
        if self._own is None:
            self._own = ha_scope.own_placements(self.conn)
        return self._own

    def allowed(self, perm: str, entity_id: str, *, own: bool = False) -> bool:
        wide, floors = self.reach.get(perm, (False, set()))
        if wide:
            return True
        if not floors:
            return False
        return ha_scope.entity_visible(False, floors, self.own_placed() if own else self.placed(), entity_id)

    def decision(self, perm: str, entity_id: str):
        """The allowing decision behind `allowed` (installation-wide, else the first floor the entity is placed on) - what an
        audit row records as the scope the action was authorised under. None = not allowed."""
        if self.principal is None:
            return None
        for target in [INSTALLATION] + [("floor", p["floor_id"]) for p in self.placed().get(entity_id, [])]:
            d = authorize(self.conn, self.principal, perm, target)
            if d.allowed:
                return d
        return None

    def control(self, entity_id: str) -> bool:
        """ha_scope.control_allowed as a predicate on this request's reach (ha.entity.control at the entity, or
        devices.control for the everyday domains it can reach)."""
        if self.allowed("ha.entity.control", entity_id):
            return True
        if self._reaches is None:
            self._reaches = ha_scope.devices_control_reaches_checker(self.conn)
        return self._reaches(entity_id) and self.allowed("devices.control", entity_id)

    def can_read_state(self, entity_id: str) -> bool:
        return self.allowed("entity.state.read", entity_id) or self.allowed("devices.read", entity_id)


# ---------------------------------------------------------------- context

_ENTITY_COLS = ("entity_id, name, original_name, domain, device_class, unit, supported_features, state, attributes_json, available, platform, unique_id, "
                "area_id, area_name, ha_floor_id, ha_floor_name, removed_at, disabled, entity_category")


class ScopedCtx:
    """A draft is judged as the CALLER sees the world (review L5 / L10): an entity they cannot read is `entity_unknown` -
    no existence, availability, arm modes, code needs, state or name leaks through a preview - and a NEW action entity must
    be one they would still see the schedule through (schedule.view or manage + a state read + alarm.view for a panel), so a
    manager can neither create a schedule they cannot see nor learn about entities outside their scope."""

    def __init__(self, ctx: "Ctx") -> None:
        self._ctx = ctx

    def __getattr__(self, name: str) -> Any:
        return getattr(self._ctx, name)

    def entity(self, entity_id: str) -> dict[str, Any] | None:
        info = self._ctx.entity(entity_id)
        if info is None:
            return None
        a = self._ctx.access
        if not a.can_read_state(entity_id):
            return None  # (a caller who reads it but may not manage it gets the ordinary 403 from the manage rule)
        if info["domain"] == "alarm_control_panel" and not a.allowed("alarm.view", entity_id, own=True):
            return None
        return info

    def resolver(self, entity_id: str) -> dict[str, Any] | None:
        return self.entity(entity_id)

    def condition_entity(self, entity_id: str) -> dict[str, Any] | None:
        info = self._ctx.entity(entity_id)
        if info is None:
            return None
        return info if (entity_id == self._ctx.shabbat_sensor or self._ctx.access.can_read_state(entity_id)) else None


class Ctx:
    """Per-request facts: settings, entities (batched), classes, panels, sun, write state. `principal` may be None (the
    mirror classifies for its audit rows without a caller)."""

    def __init__(self, conn: sqlite3.Connection, principal: Principal | None) -> None:
        from ..routers.settings import read_settings

        self.conn, self.principal = conn, principal
        self.cfg = read_settings(conn)
        self.tz_name: str = self.cfg["time.zone"]
        self.shabbat_sensor: str = self.cfg["schedules.shabbat_sensor"] or ""
        self._classes = set(self.cfg["schedules.classes"])
        self._entities: dict[str, dict[str, Any] | None] = {}
        self._panels: dict[str, dict[str, Any]] = {}
        self._bulk_safe: set[str] | None = None
        self._door_layer: set[str] | None = None
        self._managed: set[str] | None = None
        self._access: Access | None = None
        self._write: tuple[bool, str | None] | None = None
        self._sun: dict[str, int] | None | bool = False
        self._owners: dict[str, "Ctx"] = {}  # the review's owner contexts, one per user per request (review L6)

    @property
    def access(self) -> Access:
        if self._access is None:
            self._access = Access(self.conn, self.principal)
        return self._access

    # -- DraftContext protocol (services/schedule_model.py)

    def enabled_classes(self) -> set[str]:
        return set(self._classes)

    def entity(self, entity_id: str) -> dict[str, Any] | None:
        if entity_id not in self._entities:
            self.preload([entity_id])
        return self._entities.get(entity_id)

    def resolver(self, entity_id: str) -> dict[str, Any] | None:
        return self.entity(entity_id)

    def panel(self, entity_id: str) -> dict[str, Any]:
        if entity_id not in self._panels:
            self._panels[entity_id] = alarm_svc.schedule_panel_check(self.conn, entity_id)
        return self._panels[entity_id]

    def sun_seconds(self) -> dict[str, int] | None:
        if self._sun is False:
            sun = self.entity("sun.sun")
            attrs = (sun or {}).get("attributes") or {}
            self._sun = model.sun_seconds_from(attrs.get("next_rising"), attrs.get("next_setting"), self.tz_name)
        return self._sun  # type: ignore[return-value]

    # -- entities

    def _sets(self) -> None:
        if self._bulk_safe is None:
            self._bulk_safe = {r[0] for r in self.conn.execute("SELECT entity_id FROM device_bulk_safe").fetchall()}
            self._door_layer = {r[0] for r in self.conn.execute(
                "SELECT resource_id FROM map_anchors WHERE resource_type = 'ha_entity' AND layer_id = ? AND effective_to IS NULL", (dsvc.DOOR_LAYER,)).fetchall()}

    def _alarm_managed(self) -> set[str]:
        if self._managed is None:
            self._managed = alarm_svc.managed_controls(self.conn)
        return self._managed

    def preload(self, entity_ids: list[str]) -> None:
        need = [e for e in dict.fromkeys(entity_ids) if e not in self._entities]
        for i in range(0, len(need), 400):
            chunk = need[i:i + 400]
            rows = self.conn.execute(f"SELECT {_ENTITY_COLS} FROM ha_entities WHERE entity_id IN ({','.join('?' * len(chunk))})", chunk).fetchall()
            found = set()
            for r in rows:
                found.add(r["entity_id"])
                self._entities[r["entity_id"]] = self._info(r)
            for e in chunk:
                self._entities.setdefault(e, None)

    def _info(self, r: sqlite3.Row) -> dict[str, Any] | None:
        if r["removed_at"]:
            return None
        try:
            attrs = json.loads(r["attributes_json"] or "{}")
        except ValueError:
            attrs = {}
        state = r["state"]
        info: dict[str, Any] = {
            "entity_id": r["entity_id"], "name": r["name"] or attrs.get("friendly_name") or r["original_name"] or r["entity_id"], "domain": r["domain"],
            "device_class": r["device_class"], "unit": r["unit"], "supported_features": int(r["supported_features"] or 0), "state": state, "attributes": attrs,
            "available": bool(r["available"]) and state not in ("unavailable", None), "platform": r["platform"], "unique_id": r["unique_id"],
            "area_id": r["area_id"], "area_name": r["area_name"], "floor_id": r["ha_floor_id"], "floor_name": r["ha_floor_name"],
            "entity_category": r["entity_category"], "disabled": bool(r["disabled"]),
        }
        self._sets()
        managed = r["domain"] in ("switch", "select") and info["entity_id"] in self._alarm_managed()
        cls, refusal = policy.classify_entity(info, bulk_safe=info["entity_id"] in (self._bulk_safe or ()), on_door_layer=info["entity_id"] in (self._door_layer or ()), alarm_managed=managed)
        info["class"], info["refusal"] = cls, refusal
        return info

    def name_of(self, entity_id: str) -> str:
        info = self.entity(entity_id)
        return info["name"] if info else entity_id

    # -- write state (§3.1 write_block)

    def write_state(self) -> tuple[bool, str | None]:
        if self._write is None:
            self._write = _write_state(self.conn, self.cfg)
        return self._write

    @property
    def writable(self) -> bool:
        return self.write_state()[0]


def _version_tuple(text: str | None) -> tuple[int, ...]:
    out = []
    for part in (text or "").split("."):
        digits = "".join(ch for ch in part if ch.isdigit())
        out.append(int(digits) if digits else 0)
    return tuple(out)


def availability(conn: sqlite3.Connection, cfg: dict[str, Any]) -> str:
    """§3.1 `available`."""
    tr = store.get_transport()
    if cfg["schedules.enabled"] != "true":
        return "feature_disabled"
    if not tr.configured():
        return "not_configured"
    st = store.MIRROR.state(conn)
    if st.get("missing_confirmed"):
        return "component_missing"
    if not tr.connected():
        return "ha_unavailable"
    if st.get("last_error") and st["last_error"] != "unknown_command":
        return "error"
    return "ok"


def _write_state(conn: sqlite3.Connection, cfg: dict[str, Any]) -> tuple[bool, str | None]:
    avail = availability(conn, cfg)
    if avail == "feature_disabled":
        return False, "feature_disabled"
    if avail == "component_missing":
        return False, "component_missing"
    if avail in ("ha_unavailable", "not_configured", "error"):
        return False, "ha_unavailable"
    if not get_setting(conn, "bridge.secret"):
        return False, "bridge_missing"
    if not get_setting(conn, "bridge.paired_at"):
        return False, "bridge_unpaired"
    if _version_tuple(get_setting(conn, "bridge.integration_version")) < _version_tuple(store.BRIDGE_REQUIRED):
        return False, "bridge_too_old"
    return True, None


# ---------------------------------------------------------------- rights (§4.3, §4.4)

def item_entities(core: dict[str, Any]) -> list[str]:
    return model.action_entities(core)


def is_visible(ctx: Ctx, core: dict[str, Any]) -> bool:
    """§4.3: the caller sees a schedule iff EVERY action entity passes (view or manage) + (devices.read or
    entity.state.read) + (a panel: alarm.view at its own placements). No action entity: installation-wide viewers only.
    Conditions never hide a schedule."""
    a = ctx.access
    eids = item_entities(core)
    if not eids:
        return a.wide(VIEW) or a.wide(MANAGE)
    for e in eids:
        if not (a.allowed(VIEW, e) or a.allowed(MANAGE, e)):
            return False
        if not a.can_read_state(e):
            return False
        info = ctx.entity(e)
        if (info and info["domain"] == "alarm_control_panel") or e.startswith("alarm_control_panel."):
            if not a.allowed("alarm.view", e, own=True):
                return False
    return True


def _alarm_kind(service: str) -> str:
    return "disarm" if service == policy.LOWERING_ARM_OFF else "arm"


def action_reasons(ctx: Ctx, service: str, entity_id: str, cls: str | None, *, strict: bool = True) -> list[dict[str, Any]]:
    """§4.4 for one action: why the caller may NOT change it (empty = may). `strict` adds the class-enabled rule
    (disabling and deleting ignore it)."""
    a = ctx.access
    out: list[dict[str, Any]] = []
    if not a.allowed(MANAGE, entity_id):
        out.append(reason("no_manage_permission", entity_id))
    if cls is None:
        return out
    if strict and cls not in ctx.enabled_classes():
        out.append(reason("class_disabled", entity_id))
    if cls in policy.SENSITIVE_CLASSES and not a.allowed(SENSITIVE, entity_id):
        out.append(reason("sensitive_permission_required", entity_id))
    name = ctx.name_of(entity_id)
    not_controllable = reason("entity_not_controllable", entity_id, f"אין לך הרשאת שליטה ב־{name}.")
    if cls in ("light", "switch", "cover", "climate", "fan"):
        if not a.control(entity_id):
            out.append(not_controllable)
    elif cls in ("lock", "door"):
        if not a.allowed("ha.entity.control", entity_id):
            out.append(not_controllable)
        elif service == "lock.unlock" and not a.allowed("door.unlock", entity_id):
            out.append(reason("grant_required", entity_id, "הפעולה דורשת הרשאה נפרדת (פתיחת דלת)."))
    elif cls == "alarm":
        perm = "alarm.disarm" if _alarm_kind(service) == "disarm" else "alarm.arm"
        if not a.allowed(perm, entity_id, own=True):
            from ..routers.access import PERMISSION_LABELS

            out.append(reason("grant_required", entity_id, f"הפעולה דורשת הרשאה נפרדת ({PERMISSION_LABELS[perm]})."))
        block = remote_block(ctx, _alarm_kind(service))
        if block:
            out.append({**reason("entity_not_controllable", entity_id, block[1]), "_remote": block[0]})
    return out


def remote_block(ctx: Ctx, kind: str) -> tuple[str, str] | None:
    """The remote channel's refusal of an alarm action (`alarm.remote_control` / `alarm.remote_disarm`): (code, message)."""
    if ctx.principal is None or ctx.principal.source != "remote":
        return None
    from ..routers import alarm as alarm_router

    code = alarm_router._remote_block(ctx.principal, alarm_router._settings(ctx.conn), kind)
    return (code, alarm_router.REMOTE_MESSAGES[code]) if code else None


def core_reasons(ctx: Ctx, core: dict[str, Any], cls_info: dict[str, Any], *, strict: bool = True) -> list[dict[str, Any]]:
    """`action_reasons` over every supported action of a schedule, de-duplicated."""
    out: list[dict[str, Any]] = []
    seen: set[str] = set()
    for si, slot in enumerate(core["slots"]):
        for ai, a in enumerate(slot["actions"]):
            res = cls_info["slots"][si]["actions"][ai]
            if not res["supported"] or not a["entity_id"]:
                continue
            for r in action_reasons(ctx, a["service"], a["entity_id"], res["class"], strict=strict):
                key = f"{r['code']}|{r.get('entity_id')}|{r['message']}"
                if key not in seen:
                    seen.add(key)
                    out.append(r)
    return out


def can_of(ctx: Ctx, core: dict[str, Any], cls_info: dict[str, Any], enabled: bool) -> tuple[dict[str, bool], list[dict[str, Any]]]:
    """(`can`, the read-only reasons) of one schedule for the caller (§4.4 table)."""
    writable, block = ctx.write_state()
    strict = core_reasons(ctx, core, cls_info, strict=True)
    loose = [r for r in strict if r["code"] != "class_disabled"]
    understood = cls_info["understood"]
    wide_manage = ctx.access.wide(MANAGE)
    if enabled:
        toggle = writable and ((not loose) if understood else wide_manage)
    else:
        toggle = writable and understood and not strict
    edit = writable and understood and not strict
    can = {"edit": edit, "toggle": toggle, "run": edit, "delete": writable and ((not loose) if understood else wide_manage), "copy": edit}
    reasons: list[dict[str, Any]] = []
    if not edit:
        if block:
            reasons.append(reason(WRITE_BLOCK_REASON[block]))
        if not understood:
            reasons.append(reason("unsupported_content"))
        reasons.extend({k: v for k, v in r.items() if not k.startswith("_")} for r in strict)  # `_remote` is for the write path's error code only
    return can, reasons


# ---------------------------------------------------------------- the read model

def condition_views(ctx: Ctx, core: dict[str, Any]) -> list[dict[str, Any]]:
    a = ctx.access
    out = []
    for c in core["conditions"]["items"]:
        eid = c["entity_id"] or ""
        info = ctx.entity(eid) if eid else None
        readable = bool(eid) and (eid == ctx.shabbat_sensor or a.can_read_state(eid))
        out.append({
            "entity_id": eid, "name": info["name"] if info else eid, "attribute": c["attribute"], "match_type": c["match_type"], "value": c["value"],
            "readable": readable, "state": (info["state"] if info else None) if readable else None,
            "available": (info["available"] if info else False) if readable else None, "locked": not readable,
        })
    return out


def display_name(core: dict[str, Any], ctx: Ctx) -> str:
    if core["name"]:
        return core["name"]
    eids = item_entities(core)
    if not eids:
        return "תזמון ללא שם"
    return f"{ctx.name_of(eids[0])} · {len(core['slots'])} משבצות"


def build_schedule(ctx: Ctx, row: sqlite3.Row, meta: sqlite3.Row | None, last_run: dict[str, Any] | None, *, detail: bool = False, tz_now: dt.datetime | None = None) -> dict[str, Any]:
    """One `Schedule` for the caller (§2.1). `raw` (the component's item, code-like keys hidden) only with `detail`."""
    item = store.item_of(row)
    core = model.normalize(item)
    cls = model.classify(core, ctx.resolver)
    can, reasons = can_of(ctx, core, cls, core["enabled"])
    entities = []
    for e in item_entities(core):
        info = ctx.entity(e)
        entities.append({"entity_id": e, "name": info["name"] if info else e, "domain": (info["domain"] if info else e.split(".", 1)[0]), "role": "action",
                         "area_id": info["area_id"] if info else None, "area_name": info["area_name"] if info else None,
                         "floor_id": info["floor_id"] if info else None, "floor_name": info["floor_name"] if info else None,
                         "class": info["class"] if info else None, "sensitive": bool(info and info["class"] in policy.SENSITIVE_CLASSES), "available": bool(info and info["available"])})
    cond_views = condition_views(ctx, core)
    summary, preset = model.condition_summary(core["conditions"]["items"], core["conditions"]["type"], ctx.shabbat_sensor or None, ctx.name_of)
    conditional = bool(core["conditions"]["items"])
    ups = model.upcoming(core)
    source = "component"
    if not ups and core["slots"]:
        sun = ctx.sun_seconds()
        ups = model.next_runs_computed(core, tz_now or store.MIRROR.now(), ctx.tz_name, sun, 5)
        source = "computed"
    next_run = {**ups[0], "source": source, "conditional": conditional} if ups else None
    switch = ctx.entity(core["entity_id"]) if core["entity_id"] else None
    state = switch["state"] if switch and switch["state"] in STATES else ("on" if core["enabled"] else "off")
    warnings = _warnings(ctx, core, cls, cond_views)
    slots = []
    for s, res in zip(core["slots"], cls["slots"]):
        slots.append({"index": s["index"], "start": _spec_out(s["start"]), "stop": _spec_out(s["stop"]) if s["stop"] else None,
                      "actions": [{**a, "data": redact(a["data"])} for a in res["actions"]], "supported": res["supported"], "unsupported": res["unsupported"]})
    out = {
        "id": core["id"], "entity_id": core["entity_id"], "name": core["name"], "display_name": display_name(core, ctx), "enabled": core["enabled"], "state": state,
        "days": core["days"], "start_date": core["start_date"], "end_date": core["end_date"], "repeat": core["repeat"], "slots": slots,
        "conditions": {"items": cond_views, "type": core["conditions"]["type"], "track": core["conditions"]["track"], "uniform": core["conditions"]["uniform"], "summary": summary, "preset": preset},
        "entities": entities, "tags": core["tags"], "folder_id": meta["folder_id"] if meta else None, "order": meta["sort_key"] if meta else None, "pinned": bool(meta["pinned"]) if meta else False,
        "next_run": next_run, "upcoming": ups, "last_run": last_run, "sensitive": cls["sensitive"], "sensitive_classes": cls["sensitive_classes"], "lowering": cls["lowering"],
        "source": "arx" if meta and meta["created_via"] == "arx" else "external", "owner": store.owner_of(meta), "created_at": meta["created_at"] if meta else None,
        "updated_at": (meta["updated_at"] if meta and meta["updated_at"] else row["changed_at"]), "revision": row["revision"], "can": can, "read_only": {"reasons": reasons} if reasons else None,
        "warnings": warnings,
    }
    if detail:
        out["raw"] = redact(item)
    return out


def _spec_out(spec: dict[str, Any]) -> dict[str, Any]:
    if spec["kind"] == "fixed":
        return {"kind": "fixed", "time": spec["time"], "raw": spec["raw"]}
    return {"kind": "sun", "event": spec["event"], "offset_min": spec["offset_min"], "raw": spec["raw"]}


def _warnings(ctx: Ctx, core: dict[str, Any], cls: dict[str, Any], cond_views: list[dict[str, Any]]) -> list[dict[str, str]]:
    out: list[dict[str, str]] = []
    if cls["sensitive"]:
        for i, c in enumerate(core["conditions"]["items"]):
            info = ctx.entity(c["entity_id"]) if c["entity_id"] else None
            if info is None or not info["available"] or info["state"] in ("unavailable", "unknown"):
                out.append({"path": f"conditions.items[{i}]", "code": "sensitive_condition_unavailable", "message": "תזמון של פעולה רגישה תלוי בחיישן שאינו זמין כעת."})
    for si, slot in enumerate(core["slots"]):
        for ai, a in enumerate(slot["actions"]):
            res = cls["slots"][si]["actions"][ai]
            if res["class"] == "alarm" and a["entity_id"]:
                panel = ctx.panel(a["entity_id"])
                needs = panel.get("needs_code_disarm") if a["service"] == policy.LOWERING_ARM_OFF else panel.get("needs_code_arm")
                if needs:
                    out.append({"path": f"slots[{si}].actions[{ai}]", "code": "alarm_may_need_code", "message": "לוח האזעקה עשוי לדרוש קוד לפעולה זו."})
    if core["repeat"] == "single":
        out.append({"path": "repeat", "code": "single_deletes", "message": "תזמון חד־פעמי נמחק מהרכיב לאחר ההרצה."})
    return out


# ---------------------------------------------------------------- collections

class Row:
    """A cached schedule with everything needed to judge it (loaded once per request)."""

    __slots__ = ("row", "item", "core", "meta")

    def __init__(self, row: sqlite3.Row, meta: sqlite3.Row | None) -> None:
        self.row, self.meta = row, meta
        self.item = store.item_of(row)
        self.core = model.normalize(self.item)


def cache_shown(ctx: Ctx) -> bool:
    """§6.3: the cache is hidden - never deleted - while the feature is off or the component is confirmed missing."""
    return ctx.cfg["schedules.enabled"] == "true" and not store.MIRROR.state(ctx.conn).get("missing_confirmed")


def load_rows(ctx: Ctx) -> list[Row]:
    if not cache_shown(ctx):
        return []  # the feature is off, or the component is confirmed missing: the cache is never shown (it is kept)
    rows = store.cache_rows(ctx.conn)
    meta = store.meta_rows(ctx.conn)
    out = [Row(r, meta.get(r["schedule_id"])) for r in rows]
    ctx.preload([e for r in out for e in item_entities(r.core)] + [c["entity_id"] for r in out for c in r.core["conditions"]["items"] if c["entity_id"]] + ["sun.sun"])
    if ctx.shabbat_sensor:
        ctx.preload([ctx.shabbat_sensor])
    return out


def visible_rows(ctx: Ctx, rows: list[Row] | None = None) -> tuple[list[Row], int]:
    """(the rows the caller may see, how many there are in all)."""
    rows = rows if rows is not None else load_rows(ctx)
    return [r for r in rows if is_visible(ctx, r.core)], len(rows)


def last_runs(conn: sqlite3.Connection, ids: list[str]) -> dict[str, dict[str, Any]]:
    if not ids:
        return {}
    out: dict[str, dict[str, Any]] = {}
    for i in range(0, len(ids), 400):
        chunk = ids[i:i + 400]
        for r in conn.execute(
            f"SELECT schedule_id, slot_index, started_at, result FROM schedule_runs WHERE schedule_id IN ({','.join('?' * len(chunk))}) ORDER BY started_at ASC", chunk).fetchall():
            out[r["schedule_id"]] = {"at": r["started_at"], "slot_index": r["slot_index"], "result": r["result"]}
    return out


def build_all(ctx: Ctx, rows: list[Row]) -> list[dict[str, Any]]:
    runs = last_runs(ctx.conn, [r.core["id"] for r in rows])
    return [build_schedule(ctx, r.row, r.meta, runs.get(r.core["id"])) for r in rows]


# ---------------------------------------------------------------- status (§3.1)

def status_payload(conn: sqlite3.Connection, principal: Principal) -> dict[str, Any]:
    ctx = Ctx(conn, principal)
    a = ctx.access
    cfg = ctx.cfg
    avail = availability(conn, cfg)
    writable, block = ctx.write_state()
    st = store.MIRROR.state(conn)
    can = {"view": a.anywhere(VIEW) or a.anywhere(MANAGE), "manage": a.anywhere(MANAGE), "sensitive": a.anywhere(SENSITIVE), "configure": authorize(conn, principal, "system.configure", INSTALLATION).allowed}
    counts = {"visible": 0, "enabled": 0, "attention": 0, "hidden": None}
    stale = avail in ("ha_unavailable", "error", "not_configured") or (st.get("last_sync_at") is None and cfg["schedules.enabled"] == "true") or _older_than(st.get("last_sync_at"), store.STALE_AFTER_S)
    if can["view"] and avail not in ("feature_disabled", "component_missing"):
        rows = load_rows(ctx)
        visible, total = visible_rows(ctx, rows)
        counts["visible"] = len(visible)
        counts["enabled"] = sum(1 for r in visible if r.core["enabled"])
        if a.wide(MANAGE):
            counts["attention"] = len(review_items(ctx, visible))
        else:
            counts["attention"] = sum(1 for r in visible if not model.classify(r.core, ctx.resolver)["understood"])
        if can["configure"]:
            counts["hidden"] = total - len(visible)
    shabbat = None
    if ctx.shabbat_sensor and can["view"]:  # a calendar fact for schedule viewers, not for every signed-in user
        info = ctx.entity(ctx.shabbat_sensor)
        shabbat = {"entity_id": ctx.shabbat_sensor, "name": info["name"] if info else ctx.shabbat_sensor, "state": info["state"] if info else None, "available": bool(info and info["available"])}
    out: dict[str, Any] = {
        "available": avail, "feature_enabled": cfg["schedules.enabled"] == "true", "stale": stale, "last_sync_at": st.get("last_sync_at"),
        "writable": writable, "write_block": block, "capabilities": dict(policy.CAPABILITIES), "can": can, "counts": counts,
        "settings": {"snap_minutes": int(cfg["schedules.snap_minutes"]), "default_repeat": cfg["schedules.default_repeat"], "classes": cfg["schedules.classes"], "shabbat_sensor": shabbat},
    }
    if can["configure"]:
        out["admin"] = {"component": "missing" if avail == "component_missing" else ("found" if st.get("last_sync_at") else "unknown"), "component_version": st.get("component_version"),
                        "bridge_version": get_setting(conn, "bridge.integration_version") or None, "bridge_required": store.BRIDGE_REQUIRED, "ha_version": ha_sync.STATE.ha_version}
    else:
        out["counts"].pop("hidden", None)
        out["counts"]["hidden"] = None
    return out


def _older_than(stamp: str | None, seconds: float) -> bool:
    if not stamp:
        return False
    from .timeutil import parse_utc

    try:
        return (store.MIRROR.now() - parse_utc(stamp)).total_seconds() > seconds
    except ValueError:
        return False


def require_view(conn: sqlite3.Connection, principal: Principal) -> None:
    """The permission before anything else: schedule.view or schedule.manage somewhere, else the audited 403."""
    from ..rbac import require

    held = set(permissions_anywhere(conn, principal))
    if not held & {VIEW, MANAGE}:
        require(conn, principal, VIEW, INSTALLATION)


# ---------------------------------------------------------------- review (§3.17, §5.10)

def review_items(ctx: Ctx, rows: list[Row]) -> list[dict[str, Any]]:
    """The administrator's review list: every schedule with an issue (its owner lost rights / is inactive, no owner on a
    sensitive one, a stored code, content Arx does not show, a disabled class, a sensitive condition unavailable, an alarm
    that may need a code). Owner rights are re-evaluated for the OWNER (`services/rbac`)."""
    out = []
    runs = last_runs(ctx.conn, [r.core["id"] for r in rows])
    for r in rows:
        cls = model.classify(r.core, ctx.resolver)
        issues = _issues(ctx, r, cls)
        if issues:
            out.append({"schedule": build_schedule(ctx, r.row, r.meta, runs.get(r.core["id"])), "issues": issues})
    return out


def _issues(ctx: Ctx, r: Row, cls: dict[str, Any]) -> list[str]:
    issues: list[str] = []
    core = r.core
    sub = [p for s in cls["slots"] for p in s["unsupported"]]
    if any(p["code"] == "contains_code" for p in sub):
        issues.append("contains_code")
    if any(p["code"] != "contains_code" for p in sub):
        issues.append("unsupported_content")
    if any(a["class"] and a["class"] not in ctx.enabled_classes() for s in cls["slots"] for a in s["actions"]):
        issues.append("class_disabled")
    if cls["sensitive"]:
        for c in core["conditions"]["items"]:
            info = ctx.entity(c["entity_id"]) if c["entity_id"] else None
            if info is None or not info["available"] or info["state"] in ("unavailable", "unknown"):
                issues.append("sensitive_condition_unavailable")
                break
    for si, slot in enumerate(core["slots"]):
        for ai, a in enumerate(slot["actions"]):
            if cls["slots"][si]["actions"][ai]["class"] == "alarm" and a["entity_id"]:
                panel = ctx.panel(a["entity_id"])
                if (panel.get("needs_code_disarm") if a["service"] == policy.LOWERING_ARM_OFF else panel.get("needs_code_arm")):
                    issues.append("alarm_may_need_code")
                    break
        if "alarm_may_need_code" in issues:
            break
    if core["enabled"] and _requested_disabled(ctx, core["id"]):
        issues.append("requested_disabled")
    owner = store.owner_of(r.meta)
    if owner is None:
        if cls["sensitive"]:
            issues.append("no_owner_sensitive")
    else:
        row = ctx.conn.execute("SELECT active FROM users WHERE id = ?", (owner["user_id"],)).fetchone()
        if row is not None and not row["active"]:
            issues.append("owner_inactive")
        elif not _owner_still_holds(ctx, owner, core, cls):
            issues.append("owner_lost_rights")
    return issues


def _requested_disabled(ctx: Ctx, sid: str) -> bool:
    """The schedule was created / copied / restored / split / edited as DISABLED, yet it is enabled now and nobody enabled it through Arx
    since (an unknown outcome the disable never reached, or a failed disable): listed for the administrator (review R1)."""
    rows = ctx.conn.execute("SELECT id, op, schedule_id, status, error, requested_at FROM schedule_ops WHERE op IN ('create', 'copy', 'restore', 'split', 'update', 'enable') ORDER BY requested_at").fetchall()
    asked_at = None
    for r in rows:
        try:
            meta = json.loads(r["error"] or "{}") or {}
        except ValueError:
            meta = {}
        made = r["schedule_id"] == sid or (r["op"] == "split" and meta.get("created") == sid)
        if r["op"] == "enable" and r["schedule_id"] == sid and asked_at is not None and r["requested_at"] >= asked_at and r["status"] == "ok":
            return False
        if made and r["op"] != "enable" and meta.get("enabled") is False and r["status"] in ("ok", "unknown"):
            asked_at = r["requested_at"]
    return asked_at is not None


def _owner_still_holds(ctx: Ctx, owner: dict[str, Any], core: dict[str, Any], cls: dict[str, Any]) -> bool:
    """Re-evaluate §4.4 for the owner of record (their bindings, not the caller's) over the schedule's supported actions."""
    principal = Principal(user_id=owner["user_id"], username=owner["username"], display_name=owner["display_name"], source="ingress")
    octx = ctx._owners.get(owner["user_id"])
    if octx is None:
        octx = ctx._owners[owner["user_id"]] = Ctx(ctx.conn, principal)
        octx._entities = ctx._entities  # the same mirrored entities and classification
    for si, slot in enumerate(core["slots"]):
        for ai, a in enumerate(slot["actions"]):
            res = cls["slots"][si]["actions"][ai]
            if res["supported"] and a["entity_id"] and action_reasons(octx, a["service"], a["entity_id"], res["class"], strict=False):
                return False
    return True


# ---------------------------------------------------------------- catalogue (§3.4)

def _catalog_args(service: str, spec: dict[str, Any], info: dict[str, Any]) -> list[dict[str, Any]]:
    attrs = info.get("attributes") or {}
    out = []
    for name, a in spec["args"].items():
        d: dict[str, Any] = {"name": name, "type": a["type"], "required": bool(a.get("required"))}
        if name == "temperature":
            lo, hi = policy._temperature_range(info)
            d.update(min=lo, max=hi)
        elif a["type"] in ("int", "float"):
            d.update(min=a.get("min"), max=a.get("max"))
        elif name == "hvac_mode":
            d["choices"] = policy._attr_list(info, "hvac_modes") or list(a["choices"])
        elif name in ("fan_mode", "preset_mode"):
            offered = policy._attr_list(info, "fan_modes" if name == "fan_mode" else "preset_modes")
            if offered:
                d.update(type="enum", choices=offered)
        out.append(d)
    return out


def catalog_actions(cls: str, info: dict[str, Any], ctx: Ctx) -> tuple[list[dict[str, Any]], dict[str, Any] | None]:
    """(the services a new schedule may use on this entity, the reason when there are none)."""
    services = SCHEDULE_ACTIONS_BY_CLASS(cls)
    out = []
    attrs = info.get("attributes") or {}
    for service, spec in services.items():
        if service == "cover.set_cover_position" and attrs.get("current_position") is None and not int(info.get("supported_features") or 0) & 4:
            continue
        if service == "cover.set_cover_tilt_position" and attrs.get("current_tilt_position") is None and not int(info.get("supported_features") or 0) & 128:
            continue
        if cls == "alarm":
            panel = ctx.panel(info["entity_id"])
            if service == policy.LOWERING_ARM_OFF:
                if panel.get("needs_code_disarm"):
                    continue
            else:
                if policy.ARM_MODE_OF.get(service) not in (panel.get("arm_modes") or []) or panel.get("needs_code_arm"):
                    continue
        out.append({"service": service, "label": spec["label"], "lowering": policy.is_lowering(service, cls, {"position": 1} if service == "cover.set_cover_position" else {}), "args": _catalog_args(service, spec, info)})
    if not out and cls == "alarm":
        return [], {"code": "alarm_code_needed", "message": "לוח האזעקה דורש קוד לפעולה זו. תזמון אינו שומר קודים, ולכן אי אפשר לתזמן אותה."}
    if cls == "lock" and attrs.get("code_format"):
        return [], {"code": "lock_code_needed", "message": "המנעול דורש קוד. תזמון אינו שומר קודים, ולכן אי אפשר לתזמן אותו."}
    return out, None


def SCHEDULE_ACTIONS_BY_CLASS(cls: str) -> dict[str, dict[str, Any]]:
    return policy.SCHEDULE_ACTIONS.get(cls, {})


def _catalog_attrs(info: dict[str, Any]) -> dict[str, Any]:
    keep = ("current_position", "current_tilt_position", "hvac_modes", "min_temp", "max_temp", "fan_modes", "preset_modes", "temperature", "brightness", "percentage", "code_format")
    return {k: v for k, v in (info.get("attributes") or {}).items() if k in keep}


def catalog_payload(ctx: Ctx, q: str | None, floor: str | None, area: str | None, cls_filter: str | None) -> dict[str, Any]:
    a = ctx.access
    rows = ctx.conn.execute(
        f"SELECT entity_id FROM ha_entities WHERE removed_at IS NULL AND disabled = 0 AND hidden = 0 AND (entity_category IS NULL OR entity_category = '') AND domain IN ({','.join('?' * len(CATALOG_DOMAINS))}) ORDER BY domain, name, entity_id",
        list(CATALOG_DOMAINS)).fetchall()
    ctx.preload([r[0] for r in rows])
    out: list[dict[str, Any]] = []
    truncated = False
    needle = (q or "").strip().casefold()
    for r in rows:
        info = ctx.entity(r[0])
        if info is None:
            continue
        eid = info["entity_id"]
        cls, refusal = info["class"], info["refusal"]
        if cls is None and refusal != "switch_not_marked":
            continue  # scheduler switches, alarm-managed controls, scripts, scenes, plain buttons ... never appear
        if cls is not None and cls not in ctx.enabled_classes():
            continue
        if not (a.allowed(MANAGE, eid) and a.can_read_state(eid)):
            continue
        if cls == "alarm" and not a.allowed("alarm.view", eid, own=True):
            continue
        if cls_filter and (cls or "switch") != cls_filter:
            continue
        if floor and info["floor_id"] != floor:
            continue
        if area and info["area_id"] != area:
            continue
        if needle and needle not in f"{info['name']} {eid} {info['area_name'] or ''}".casefold():
            continue
        if len(out) >= CATALOG_LIMIT:
            truncated = True
            break
        actions: list[dict[str, Any]] = []
        why: dict[str, Any] | None = None
        if cls is None:
            why = {"code": "switch_not_marked", "message": "המתג לא סומן כבטוח לפעולה קבוצתית."}
        else:
            actions, why = catalog_actions(cls, info, ctx)
            if why is None and not actions:
                why = {"code": "action_not_allowed", "message": "אין פעולות מותרות להתקן זה."}
            if why is None:
                sample = core_sample(eid, cls, actions)
                blocked = next((x for x in (action_reasons(ctx, s, eid, cls, strict=True) for s in sample) if x), None)
                if blocked:
                    why = {"code": blocked[0]["code"], "message": blocked[0]["message"]}
        out.append({
            "entity_id": eid, "name": info["name"], "domain": info["domain"], "class": cls or "switch", "sensitive": bool(cls in policy.SENSITIVE_CLASSES), "area_id": info["area_id"], "area_name": info["area_name"],
            "floor_id": info["floor_id"], "floor_name": info["floor_name"], "available": info["available"], "selectable": why is None, "reason": why, "attributes": _catalog_attrs(info), "actions": actions if why is None or cls else [],
        })
    return {"entities": out, "truncated": truncated}


def core_sample(eid: str, cls: str, actions: list[dict[str, Any]]) -> list[str]:
    """One service per distinct rule outcome (arm vs disarm vs unlock) is enough to judge whether the caller may schedule
    the entity at all."""
    services = [a["service"] for a in actions]
    picks: list[str] = []
    for s in services:
        if cls == "alarm":
            kind = _alarm_kind(s)
            if not any(_alarm_kind(p) == kind for p in picks):
                picks.append(s)
        elif s == "lock.unlock" or not picks:
            picks.append(s)
    return picks or services[:1]


# ---------------------------------------------------------------- condition candidates (§3.4b)

def candidates_payload(ctx: Ctx, q: str | None, domain: str | None) -> dict[str, Any]:
    from .home_screen import is_jewish_calendar

    a = ctx.access
    wide_config = authorize(ctx.conn, ctx.principal, "system.configure", INSTALLATION).allowed if ctx.principal else False
    if ctx.cfg["schedules.enabled"] != "true" and not wide_config:
        return {"entities": [], "truncated": False}  # the feature is off: only the administrator setting it up may look
    domains = [domain] if domain else list(COND_DOMAINS)
    rows = ctx.conn.execute(
        f"SELECT * FROM ha_entities WHERE removed_at IS NULL AND disabled = 0 AND domain IN ({','.join('?' * len(domains))}) ORDER BY domain, name, entity_id", domains).fetchall()
    needle = (q or "").strip().casefold()
    out: list[dict[str, Any]] = []
    truncated = False
    for r in rows:
        e = ha_sync.entity_row(r)
        eid = e["entity_id"]
        if not (wide_config or a.can_read_state(eid) or eid == ctx.shabbat_sensor):
            continue
        name = e.get("name") or (e.get("attributes") or {}).get("friendly_name") or eid
        if needle and needle not in f"{name} {eid}".casefold():
            continue
        try:
            float(e.get("state"))
            numeric = True
        except (TypeError, ValueError):
            numeric = False
        suggested = e["domain"] == "binary_sensor" and (is_jewish_calendar(e) or "issur_melacha" in eid)
        out.append({"entity_id": eid, "name": name, "domain": e["domain"], "device_class": e.get("device_class"), "state": e.get("state"), "unit": e.get("unit"), "numeric": numeric, "suggested_shabbat": suggested})
    order = {"binary_sensor": 0, "sensor": 1, "input_boolean": 2, "sun": 3}
    out.sort(key=lambda c: (not c["suggested_shabbat"], order.get(c["domain"], 9), c["name"].casefold(), c["entity_id"]))
    if len(out) > CANDIDATE_LIMIT:
        out, truncated = out[:CANDIDATE_LIMIT], True
    return {"entities": out, "truncated": truncated}


# ---------------------------------------------------------------- list filters (§3.2)

def matches(s: dict[str, Any], f: dict[str, Any], ctx: Ctx) -> bool:
    q = (f.get("q") or "").strip().casefold()
    if q:
        hay = [s["display_name"], *s["tags"], *(e["name"] for e in s["entities"]), *(e["entity_id"] for e in s["entities"]), *(c["name"] for c in s["conditions"]["items"])]
        if not any(q in h.casefold() for h in hay if h):
            return False
    if f.get("floor") and not any(e["floor_id"] == f["floor"] for e in s["entities"]):
        return False
    if f.get("area") and not any(e["area_id"] == f["area"] for e in s["entities"]):
        return False
    if f.get("entity") and not any(e["entity_id"] == f["entity"] for e in s["entities"]):
        return False
    if f.get("condition") and not any(c["entity_id"] == f["condition"] for c in s["conditions"]["items"]):
        return False
    if f.get("has_conditions") is not None and bool(s["conditions"]["items"]) != f["has_conditions"]:
        return False
    if f.get("preset") and s["conditions"]["preset"] != f["preset"]:
        return False
    if f.get("day"):
        days = s["days"]["days"]
        if days is None:
            days = {"workday": ["sun", "mon", "tue", "wed", "thu"], "weekend": ["fri", "sat"]}.get(s["days"]["kind"], [])
        if f["day"] not in days:
            return False
    st = f.get("state")
    if st:
        if st == "enabled" and not s["enabled"]:
            return False
        if st == "disabled" and s["enabled"]:
            return False
        if st in ("triggered", "completed", "unavailable") and s["state"] != st:
            return False
    if f.get("tag") and f["tag"] not in s["tags"]:
        return False
    if f.get("folder"):
        if f["folder"] == "none":
            if s["folder_id"]:
                return False
        elif s["folder_id"] != f["folder"]:
            return False
    if f.get("source") and s["source"] != f["source"]:
        return False
    if f.get("sensitive") is not None and s["sensitive"] != f["sensitive"]:
        return False
    if f.get("editable") is not None and s["can"]["edit"] != f["editable"]:
        return False
    return True


def sort_key(sort: str):
    if sort == "name":
        return lambda s: ((s["display_name"] or "").casefold(), s["id"])
    if sort == "order":
        return lambda s: (s["order"] is None, s["order"] if s["order"] is not None else 0, (s["display_name"] or "").casefold())
    if sort == "updated":
        return None  # handled by the caller (descending)
    return lambda s: (s["next_run"] is None, s["next_run"]["at"] if s["next_run"] else "", (s["display_name"] or "").casefold(), s["id"])


def list_payload(ctx: Ctx, f: dict[str, Any], sort: str, limit: int, offset: int) -> dict[str, Any]:
    rows, _ = visible_rows(ctx)
    items = [s for s in build_all(ctx, rows) if matches(s, f, ctx)]
    if sort == "updated":
        items.sort(key=lambda s: s["updated_at"] or "", reverse=True)
    else:
        items.sort(key=sort_key(sort))
    total = len(items)
    st = store.MIRROR.state(ctx.conn)
    avail = availability(ctx.conn, ctx.cfg)
    stale = avail in ("ha_unavailable", "error", "not_configured") or _older_than(st.get("last_sync_at"), store.STALE_AFTER_S)
    return {"items": items[offset:offset + limit], "total": total, "offset": offset, "limit": limit, "status": {"available": avail, "stale": stale, "last_sync_at": st.get("last_sync_at")}}


def tags_payload(ctx: Ctx) -> dict[str, Any]:
    rows, _ = visible_rows(ctx)
    counts: dict[str, int] = {}
    for r in rows:
        for t in r.core["tags"]:
            counts[t] = counts.get(t, 0) + 1
    return {"tags": [{"name": n, "count": c} for n, c in sorted(counts.items(), key=lambda kv: (-kv[1], kv[0]))]}


def runs_payload(ctx: Ctx, schedule_id: str | None, since: str | None, result: str | None, limit: int) -> dict[str, Any]:
    rows, _ = visible_rows(ctx)
    visible = {r.core["id"]: r for r in rows}
    sql = "SELECT * FROM schedule_runs"
    where, args = [], []
    if schedule_id:
        where.append("schedule_id = ?")
        args.append(schedule_id)
    if since:
        where.append("started_at >= ?")
        args.append(since)
    if result:
        where.append("result = ?")
        args.append(result)
    if where:
        sql += " WHERE " + " AND ".join(where)
    sql += " ORDER BY started_at DESC LIMIT ?"
    args.append(limit * 4 + 50)
    items = []
    for r in ctx.conn.execute(sql, args).fetchall():
        v = visible.get(r["schedule_id"])
        if v is None:
            continue
        try:
            detail = json.loads(r["detail_json"] or "{}")
        except ValueError:
            detail = {}
        items.append({"id": r["id"], "schedule_id": r["schedule_id"], "schedule_name": display_name(v.core, ctx), "slot_index": r["slot_index"], "started_at": r["started_at"], "settled_at": r["settled_at"],
                      "result": r["result"], "via": r["via"], "sensitive": bool(r["sensitive"]), "detail": {"entities": detail.get("entities") or []}})
        if len(items) >= limit:
            break
    return {"items": items}
