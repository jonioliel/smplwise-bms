"""CR-017: who sees and who may change what - the permission and scope layer of automations, scenes and scripts
(docs/architecture/AUTOMATIONS_API.md §3.2, CR §7, §9.2).

`Ctx` is the per-request context (settings, mirrored entities classified once, the caller's reach per permission, the write state).
`Access` holds the caller's reach for each permission (a placement rule per TARGET entity: services/ha_scope.py; HA areas are never a scope).
VISIBILITY comes first and is decided by the item's ACTION targets (scenes and scripts an automation calls count through their own members); with
no target by its trigger entities; with neither only installation-wide viewers see it. Trigger and condition entities outside the caller's reach never
hide an item - they are shown by name and locked for that caller (the model's `editable_entity`). CHANGE needs the right permission at every target of the
old AND the new content, control there (`ha_scope.control_allowed`) and, for every sensitive step, THE SAME GRANT MANUAL CONTROL NEEDS at that entity (owner
decision 6ג: `alarm.arm`, `alarm.disarm`, `door.unlock`, the lock / door / siren control classes) - there is no separate "sensitive content" permission.
The writes (services/automation_ops.py) reuse these rule functions, so a right shown is a right enforced."""
from __future__ import annotations

import json
import sqlite3
from typing import Any

from ..db import get_setting
from ..rbac import INSTALLATION, Principal, authorize, bindings_of
from . import alarm as alarm_svc
from . import automation_draft as drafts
from . import automation_model as model
from . import automation_policy as pol
from . import automation_transport as tr
from . import devices as dsvc
from . import ha_scope

VIEW, MANAGE, SCENE_MANAGE = "automation.view", "automation.manage", "scene.manage"
SCRIPT_RUN, SCRIPT_MANAGE, CODE_VIEW = "script.run", "script.manage", "automation.code_view"
MANAGE_OF = {"automation": MANAGE, "script": SCRIPT_MANAGE, "scene": SCENE_MANAGE}
VIEW_PERMS = {"automation": (VIEW, MANAGE), "script": (VIEW, SCRIPT_RUN, SCRIPT_MANAGE), "scene": (VIEW, SCENE_MANAGE)}
PERMS = (VIEW, MANAGE, SCENE_MANAGE, SCRIPT_RUN, SCRIPT_MANAGE, CODE_VIEW, "devices.read", "entity.state.read", "ha.entity.control", "devices.control", "door.unlock",
         "alarm.view", "alarm.arm", "alarm.disarm", "system.configure")
EFFECT_DEPTH = 3

REASON_MESSAGES = {
    "no_permission": "אין לך הרשאה לנהל את ההתקנים של הפריט הזה.",
    "entity_not_controllable": "אין לך הרשאת שליטה בהתקן.",
    "grant_required": "אין לך הרשאה לפעולה הרגישה.",
    "yaml_managed": "מוגדרת בקובץ תצורה – לצפייה בלבד",
    "no_config_id": "לפריט אין מזהה תצורה – לצפייה בלבד",
    "integration_scene": "סצנה של התקן – אפשר רק להפעיל",
    "masked_values": "הפריט כולל ערכים חסויים; ערכו אותו בתשתית המערכת.",
    "config_api_unavailable": "עריכת אוטומציות אינה זמינה כרגע.",
    "bridge_unavailable": "נדרש עדכון או צימוד של רכיב החיבור כדי לשמור אוטומציות.",
    "delegation_off": "שמירה דורשת מנהל",
    "feature_disabled": "האוטומציות כבויות בהגדרות המערכת.",
    "ha_unavailable": "תשתית המערכת אינה זמינה כרגע.",
    "unsupported_content": "הפריט כולל תוכן שהמערכת אינה מציגה במלואו.",
}
WRITE_BLOCK_REASON = {"feature_disabled": "feature_disabled", "ha_unavailable": "ha_unavailable", "config_api_unavailable": "config_api_unavailable", "bridge_missing": "bridge_unavailable",
                      "bridge_unpaired": "bridge_unavailable", "bridge_too_old": "bridge_unavailable", "authoring_blocked": "config_api_unavailable", "delegation_off": "delegation_off"}


def reason(code: str, entity_id: str | None = None, message: str | None = None, **extra: Any) -> dict[str, Any]:
    out: dict[str, Any] = {"code": code, "message": message or REASON_MESSAGES.get(code, code)}
    if entity_id:
        out["entity_id"] = entity_id
    out.update(extra)
    return out


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

    def any_of(self, perms: tuple[str, ...]) -> bool:
        return any(self.anywhere(p) for p in perms)

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

    def any_allowed(self, perms: tuple[str, ...], entity_id: str) -> bool:
        return any(self.allowed(p, entity_id) for p in perms)

    def control(self, entity_id: str) -> bool:
        """ha_scope.control_allowed as a predicate on this request's reach (ha.entity.control at the entity, or devices.control for the everyday
        domains it can reach)."""
        if self.allowed("ha.entity.control", entity_id):
            return True
        if self._reaches is None:
            self._reaches = ha_scope.devices_control_reaches_checker(self.conn)
        return self._reaches(entity_id) and self.allowed("devices.control", entity_id)

    def can_read_state(self, entity_id: str) -> bool:
        return self.allowed("entity.state.read", entity_id) or self.allowed("devices.read", entity_id)

    def wide_manage_all(self) -> bool:
        return all(self.wide(p) for p in (MANAGE,))


# ---------------------------------------------------------------- context

_ENTITY_COLS = ("entity_id, name, original_name, domain, device_class, unit, supported_features, state, attributes_json, available, platform, unique_id, "
                "area_id, area_name, ha_floor_id, ha_floor_name, removed_at, last_changed")


class Ctx:
    """Per-request facts: settings, entities (batched), the caller's reach, the write state. `principal` may be None (the mirror classifies for
    its audit rows without a caller)."""

    def __init__(self, conn: sqlite3.Connection, principal: Principal | None) -> None:
        from ..routers.settings import read_settings

        self.conn, self.principal = conn, principal
        self.cfg = read_settings(conn)
        self.tz_name: str = self.cfg["time.zone"]
        self.shabbat_sensor: str = self.cfg["schedules.shabbat_sensor"] or ""
        self.notify_targets: tuple[str, ...] = tuple(self.cfg["automations.notify_targets"])
        self.limits: dict[str, int] = self.cfg["automations.limits"]
        self._entities: dict[str, dict[str, Any] | None] = {}
        self._access: Access | None = None
        self._door_layer: set[str] | None = None
        self._ha_admin: bool | None = None
        self._scheduler_present: bool | None = None
        self._device_names: dict[str, str | None] = {}

    @property
    def access(self) -> Access:
        if self._access is None:
            self._access = Access(self.conn, self.principal)
        return self._access

    # -- entities

    def preload(self, entity_ids: list[str]) -> None:
        need = [e for e in dict.fromkeys(entity_ids) if e and e not in self._entities]
        for i in range(0, len(need), 400):
            chunk = need[i:i + 400]
            rows = self.conn.execute(f"SELECT {_ENTITY_COLS} FROM ha_entities WHERE entity_id IN ({','.join('?' * len(chunk))})", chunk).fetchall()
            for r in rows:
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
        return {"entity_id": r["entity_id"], "name": r["name"] or attrs.get("friendly_name") or r["original_name"] or r["entity_id"], "domain": r["domain"], "device_class": r["device_class"],
                "state": r["state"], "attributes": attrs, "available": bool(r["available"]) and r["state"] not in ("unavailable", None), "platform": r["platform"], "unique_id": r["unique_id"],
                "area_id": r["area_id"], "area_name": r["area_name"], "floor_id": r["ha_floor_id"], "floor_name": r["ha_floor_name"], "last_changed": r["last_changed"]}

    def entity(self, entity_id: str) -> dict[str, Any] | None:
        if entity_id not in self._entities:
            self.preload([entity_id])
        return self._entities.get(entity_id)

    def name_of(self, entity_id: str) -> str:
        info = self.entity(entity_id)
        return info["name"] if info else entity_id

    def door_layer(self) -> set[str]:
        if self._door_layer is None:
            self._door_layer = {r[0] for r in self.conn.execute("SELECT resource_id FROM map_anchors WHERE resource_type = 'ha_entity' AND layer_id = ? AND effective_to IS NULL", (dsvc.DOOR_LAYER,)).fetchall()}
        return self._door_layer

    def door_cover(self, entity_id: str) -> bool:
        if not entity_id.startswith("cover."):
            return False
        info = self.entity(entity_id)
        return bool(entity_id in self.door_layer() or (info and (info["device_class"] or "") in dsvc.DOOR_COVER_CLASSES))

    def entity_class(self, entity_id: str) -> str | None:
        """The sensitive class of an entity as the client names it: alarm / lock / siren, or a door-class cover's own class (door / gate / garage)."""
        domain = entity_id.split(".", 1)[0]
        if domain == "alarm_control_panel":
            return "alarm"
        if domain in ("lock", "siren"):
            return domain
        if domain == "cover" and self.door_cover(entity_id):
            dc = (self.entity(entity_id) or {}).get("device_class") or ""
            return dc if dc in ("door", "gate", "garage") else "door"
        return None

    def sens_class(self, action: str, entity_id: str) -> str | None:
        return pol.sensitive_class_of(action, self.entity_class(entity_id))

    # -- the caller

    @property
    def ha_admin(self) -> bool:
        """Whether the caller is an HA administrator (the directory the bridge pushes every minute): decides who may save without the delegation switch."""
        if self._ha_admin is None:
            row = self.conn.execute("SELECT is_admin FROM ha_users WHERE id = ?", (self.principal.user_id,)).fetchone() if self.principal is not None else None
            self._ha_admin = bool(row and row["is_admin"])
        return self._ha_admin

    @property
    def delegation_on(self) -> bool:
        return (get_setting(self.conn, "bridge.delegated_authoring") or "false") == "true"

    def delegation_changed_at(self) -> str | None:
        return get_setting(self.conn, "bridge.delegation_changed_at") or None

    def code_view_allowed(self) -> bool:
        """The permission anywhere AND at least one of the caller's roles in the setting `automations.code_view_roles` (the toggle is shown to nobody else)."""
        if self.principal is None or not self.access.anywhere(CODE_VIEW):
            return False
        roles = set(self.cfg["automations.code_view_roles"])
        return any(b["role_id"] in roles for b in bindings_of(self.conn, self.principal) if b["effect"] == "allow")

    def scheduler_present(self) -> bool:
        if self._scheduler_present is None:
            row = self.conn.execute("SELECT 1 FROM ha_entities WHERE platform = 'scheduler' AND removed_at IS NULL LIMIT 1").fetchone()
            self._scheduler_present = row is not None
        return self._scheduler_present

    # -- write state

    def write_block(self) -> str | None:
        """Why the caller cannot save right now (feature / HA / bridge / delegation), None = may."""
        block = tr.write_block(self.conn, self.cfg)
        if block:
            return block
        if self.principal is not None and not self.ha_admin and not self.delegation_on:
            return "delegation_off"
        return None

    def allowed_actions(self) -> list[str]:
        """The services the builder may type: the closed device list plus the notify targets the administrator approved."""
        return [*pol.DEFAULT_ALLOWED_ACTIONS, *self.notify_targets]

    def notify_name(self, action: str) -> str | None:
        return action.split(".", 1)[1].replace("_", " ") if action in self.notify_targets else None

    def model_ctx(self, *, code_view: bool, scoped: bool = True, names_scoped: bool = False) -> model.ModelContext:
        """The model's context for this caller. `names_scoped`: an entity the caller may not read is named by its id (a preview of a DRAFT never tells a caller
        the name of a device outside their reach). `code_view` decides whether a template's text travels in its locked block."""
        name_of = (lambda e: self.name_of(e) if self.access.can_read_state(e) else e) if (names_scoped and self.principal is not None) else self.name_of
        return model.ModelContext(names=name_of, notify_name=self.notify_name, device_name=self.device_name, shabbat_sensor=self.shabbat_sensor or None, allowed_actions=self.allowed_actions(),
                                  template_text=code_view)

    def device_name(self, device_id: str) -> str | None:
        """The name of a Home Assistant device (a wall switch a `device` trigger belongs to) from the mirror, for the label of its locked block."""
        if device_id not in self._device_names:
            row = self.conn.execute("SELECT COALESCE(NULLIF(name_by_user, ''), NULLIF(name, '')) FROM ha_devices WHERE device_id = ? AND removed_at IS NULL", (device_id,)).fetchone()
            self._device_names[device_id] = row[0] if row and row[0] else None
        return self._device_names[device_id]

    def scope_info(self) -> dict[str, Any]:
        """The caller's reach for the authoring permissions, explicit: `installation` = at least one of them holds for the whole installation, `scoped` = the
        caller works inside floors only (never both), `floors` = those floors (Arx floors; the placements decide which devices are in them - Home Assistant's own
        areas are never a scope), `areas` is always empty (kept for clients that read it)."""
        a = self.access
        perms = (VIEW, MANAGE, SCENE_MANAGE, SCRIPT_RUN, SCRIPT_MANAGE)
        wide = any(a.wide(p) for p in perms)
        ids: set[str] = set()
        for p in perms:
            ids |= set(a.reach.get(p, (False, set()))[1])
        floors: list[dict[str, str]] = []
        if ids and not wide:
            rows = self.conn.execute(f"SELECT id, name FROM floors WHERE id IN ({','.join('?' * len(ids))}) AND deleted_at IS NULL ORDER BY level, sort_order, name", sorted(ids)).fetchall()
            floors = [{"id": r["id"], "name": r["name"]} for r in rows]
        return {"installation": wide, "scoped": bool(not wide and ids), "floors": floors, "areas": []}

    def can_watch(self, entity_id: str) -> bool:
        """Whether the caller may see the entity a trigger or condition watches (else the block is a locked view for them)."""
        return self.access.can_read_state(entity_id) if self.principal is not None else True


# ---------------------------------------------------------------- facts of an item

def facts_of(ctx: Ctx, kind: str, rd: dict[str, Any], *, entity_id: str | None = None, depth: int = 0) -> dict[str, Any]:
    """What the rules need to know about a READ item (`automation_draft.read`): its device targets (scenes and scripts it calls expanded through their own
    members, depth 3), the references it makes to other items, the sensitive steps (one per device a typed step drives), the locked blocks and the entities
    its triggers and conditions watch."""
    f: dict[str, Any] = {"targets": [], "refs": [], "steps": [], "locked": [], "unknown_effects": False, "trigger_entities": [], "condition_entities": [],
                         "locked_count": rd.get("locked_count", 0), "unsupported": bool(rd.get("unsupported")), "masked": bool(rd.get("masked"))}
    d = rd["draft"]
    if kind == "scene":
        for m in d["members"]:
            f["targets"].append(m["entity_id"])
            if m["entity_id"].startswith("lock."):
                f["steps"].append({"path": "members", "action": "lock.lock" if m["state"] == "locked" else "lock.unlock", "entity_id": m["entity_id"], "role": "device", "sens": "lock"})
        return _finish(ctx, f)
    f["trigger_entities"] = model.trigger_entities(d) if kind == "automation" else []
    f["condition_entities"] = model.condition_entities(d) if kind == "automation" else []
    for w in model.walk_draft(d):
        b = w.block
        if w.section != "action":
            continue
        if b.get("kind") == "typed" and b.get("type") == "service":
            role = b["role"]
            if role == "device":
                for e in b["entity_ids"]:
                    cls = pol.sensitive_class_of(b["action"], ctx.entity_class(e))
                    f["steps"].append({"path": w.path, "action": b["action"], "entity_id": e, "role": "device", "sens": cls})
                    if e not in f["targets"]:
                        f["targets"].append(e)
            elif role in ("scene", "script", "automation"):
                for e in b["entity_ids"]:
                    f["refs"].append({"role": role, "entity_id": e})
        elif b.get("kind") == "locked":
            f["locked"].append({"path": w.path, "fingerprint": b["fingerprint"], "reason": b["reason"], "sensitive": bool(b.get("sensitive")), "effects": b.get("effects")})
            if b.get("effects") == "unknown":
                f["unknown_effects"] = True
            elif isinstance(b.get("effects"), list):
                for e in b["effects"]:
                    if e not in f["targets"] and pol.ENTITY_RE.match(str(e)):
                        f["targets"].append(e)
            if b.get("sensitive"):
                f["steps"].append({"path": w.path, "action": None, "entity_id": "", "role": "locked", "sens": "locked"})
    return _finish(ctx, f, entity_id=entity_id, depth=depth, draft=d)


def _finish(ctx: Ctx, f: dict[str, Any], *, entity_id: str | None = None, depth: int = 0, draft: dict[str, Any] | None = None) -> dict[str, Any]:
    """Expand the references: a scene's members, a script's effects (recursively, depth 3); a reference that cannot be resolved is an unknown effect."""
    for ref in f["refs"]:
        if ref["role"] == "automation":
            continue  # controlling another automation is its own right (rights_over_refs), not an effect on devices
        eff = effects_of_entity(ctx, ref["role"], ref["entity_id"], depth + 1, entity_id)
        if eff is None:
            f["unknown_effects"] = True
            continue
        targets, unknown = eff
        for e in targets:
            if e not in f["targets"]:
                f["targets"].append(e)
        f["unknown_effects"] = f["unknown_effects"] or unknown
    f["targets"] = [e for e in f["targets"] if e not in {r["entity_id"] for r in f["refs"]}]
    ctx.preload(f["targets"] + f["trigger_entities"] + f["condition_entities"])
    classes: list[str] = []
    if draft is not None:
        classes = model.sensitive_classes(draft, ctx.entity_class)
    else:  # a scene: the lock members
        classes = ["lock"] if any(s.get("sens") for s in f["steps"]) else []
    f["sensitive_classes"] = classes
    f["sensitive"] = bool(classes) or any(s.get("sens") for s in f["steps"])
    return f


def effects_of_entity(ctx: Ctx, role: str, ref: str, depth: int, origin: str | None) -> tuple[list[str], bool] | None:
    """(device entities, unknown effects) of the scene / script an entity id names, from the mirror's cache; None when it is not known."""
    if depth > EFFECT_DEPTH:
        return [], True
    row = ctx.conn.execute("SELECT kind, config_json, entity_id FROM ha_config_items WHERE entity_id = ?", (ref,)).fetchone()
    if row is None or row["entity_id"] == origin:
        return None if row is None else ([], False)
    try:
        cfg = json.loads(row["config_json"]) if row["config_json"] else None
    except ValueError:
        cfg = None
    if not isinstance(cfg, dict):
        info = ctx.entity(ref)
        members = (info or {}).get("attributes", {}).get("entity_id") if info else None
        if row["kind"] == "scene" and isinstance(members, list):
            return [m for m in members if isinstance(m, str)], False
        return None
    rd = drafts.read(row["kind"], cfg, ctx.model_ctx(code_view=False, scoped=False))
    inner = facts_of(ctx, row["kind"], rd, entity_id=ref, depth=depth)
    return inner["targets"], inner["unknown_effects"]


# ---------------------------------------------------------------- visibility

def entity_ok(ctx: Ctx, perms: tuple[str, ...], entity_id: str) -> bool:
    a = ctx.access
    if not (a.any_allowed(perms, entity_id) and a.can_read_state(entity_id)):
        return False
    info = ctx.entity(entity_id)
    if entity_id.startswith("alarm_control_panel.") or (info and info["domain"] == "alarm_control_panel"):
        return a.allowed("alarm.view", entity_id, own=True)
    return True


def holds_any(ctx: Ctx, kind: str) -> bool:
    """Whether the caller may see anything of this kind at all: the view permissions anywhere (scenes: also control of an entity anywhere)."""
    a = ctx.access
    if a.any_of(VIEW_PERMS[kind]):
        return True
    return kind == "scene" and a.any_of(("ha.entity.control", "devices.control"))


def visible(ctx: Ctx, kind: str, facts: dict[str, Any], *, source: str = "ui", entity_id: str | None = None) -> bool:
    perms = VIEW_PERMS[kind]
    a = ctx.access
    if kind == "scene" and source == "integration":
        return bool(entity_id) and (any(a.wide(p) for p in perms) or a.control(entity_id))
    ents = facts["targets"]
    if ents:
        if all(entity_ok(ctx, perms, e) for e in ents):
            return True
        return kind == "scene" and all(a.control(e) for e in ents)
    trig = facts["trigger_entities"]
    if trig:
        return all(entity_ok(ctx, perms, e) for e in trig)
    return any(a.wide(p) for p in perms)


# ---------------------------------------------------------------- rights

GRANT_FOR = {"alarm_control_panel.alarm_disarm": "alarm.disarm", "lock.unlock": "door.unlock"}


def grant_reasons(ctx: Ctx, steps: list[dict[str, Any]]) -> list[dict[str, Any]]:
    """The manual-control grants of every sensitive typed step (owner decision 6ג): the same permission, at the same entity, manual control asks for."""
    from ..routers.access import PERMISSION_LABELS

    a = ctx.access
    out: list[dict[str, Any]] = []
    seen: set[str] = set()
    for s in steps:
        if not s.get("sens") or s["role"] != "device":
            continue
        action, e = s["action"], s["entity_id"]
        if s["sens"] == "alarm":
            perm = "alarm.disarm" if action == "alarm_control_panel.alarm_disarm" else "alarm.arm"
            ok = a.allowed(perm, e, own=True)
            block = _remote_block(ctx, "disarm" if perm == "alarm.disarm" else "arm") if ok else None
            if block:
                key = f"remote|{e}"
                if key not in seen:
                    seen.add(key)
                    out.append(reason("entity_not_controllable", e, block[1], _remote=block[0], path=s["path"]))
                continue
        else:
            perm = GRANT_FOR.get(action)
            if perm is None:
                continue  # lock.lock / siren / door covers need control only (below)
            ok = a.allowed(perm, e)
        if not ok:
            key = f"{perm}|{e}"
            if key not in seen:
                seen.add(key)
                out.append(reason("grant_required", e, f"אין לך הרשאה ל{PERMISSION_LABELS[perm]} ב־{ctx.name_of(e)}.", grant=perm, path=s["path"]))
    return out


def _remote_block(ctx: Ctx, kind: str) -> tuple[str, str] | None:
    from .schedule_view import remote_block

    return remote_block(ctx, kind)  # type: ignore[arg-type]


def control_reasons(ctx: Ctx, entity_ids: list[str]) -> list[dict[str, Any]]:
    a = ctx.access
    out = []
    for e in entity_ids:
        if e.startswith("alarm_control_panel."):
            continue  # a panel is armed / disarmed under its own grants (grant_reasons), not under entity control
        if not a.control(e):
            out.append(reason("entity_not_controllable", e, f"אין לך הרשאת שליטה ב־{ctx.name_of(e)}.", grant=None))
    return out


def change_reasons(ctx: Ctx, kind: str, old: dict[str, Any] | None, new: dict[str, Any] | None) -> list[dict[str, Any]]:
    """Why the caller may NOT change an item whose current content has facts `old` into `new` (empty = may): the manage permission at every target of
    both, control and the sensitive grants at the targets of the new content."""
    a = ctx.access
    perm = MANAGE_OF[kind]
    out: list[dict[str, Any]] = []
    ents = list(dict.fromkeys((old["targets"] if old else []) + (new["targets"] if new else [])))
    if not ents and not a.wide(perm):
        out.append(reason("no_permission"))
    for e in ents:
        if not a.allowed(perm, e):
            out.append(reason("no_permission", e))
    side = new if new is not None else old
    if side is not None and not out:
        out.extend(control_reasons(ctx, side["targets"]))
        out.extend(grant_reasons(ctx, side["steps"]))
        out.extend(ref_reasons(ctx, side))
    return out


def ref_reasons(ctx: Ctx, facts: dict[str, Any]) -> list[dict[str, Any]]:
    """Controlling another automation (`automation.turn_on/off/trigger`) needs `automation.manage` at that automation: its own targets, or installation-wide
    when it is not known."""
    a = ctx.access
    out = []
    for ref in facts["refs"]:
        if ref["role"] != "automation":
            continue
        row = ctx.conn.execute("SELECT kind, config_json FROM ha_config_items WHERE entity_id = ?", (ref["entity_id"],)).fetchone()
        targets: list[str] | None = None
        if row is not None and row["config_json"]:
            try:
                rd = drafts.read("automation", json.loads(row["config_json"]), ctx.model_ctx(code_view=False, scoped=False))
                targets = facts_of(ctx, "automation", rd, entity_id=ref["entity_id"], depth=EFFECT_DEPTH)["targets"]
            except (ValueError, TypeError):
                targets = None
        if targets is None or not targets:
            if not a.wide(MANAGE):
                out.append(reason("no_permission", ref["entity_id"]))
        elif any(not a.allowed(MANAGE, e) for e in targets):
            out.append(reason("no_permission", ref["entity_id"]))
    return out


def run_reasons(ctx: Ctx, kind: str, facts: dict[str, Any], *, entity_id: str | None = None, source: str = "ui") -> list[dict[str, Any]]:
    """Run / enable / disable (automations: manage), run (scripts: script.run), activate (scenes: control of every member, or of the scene entity)."""
    a = ctx.access
    out: list[dict[str, Any]] = []
    if kind == "scene":
        if source == "integration":
            if not (entity_id and a.control(entity_id)):
                out.append(reason("entity_not_controllable", entity_id, f"אין לך הרשאת שליטה ב־{ctx.name_of(entity_id or '')}."))
            return out
        out.extend(control_reasons(ctx, facts["targets"]))
        out.extend(grant_reasons(ctx, facts["steps"]))
        return out
    perm = MANAGE if kind == "automation" else SCRIPT_RUN
    perms = (perm,) if kind == "automation" else (SCRIPT_RUN, SCRIPT_MANAGE)
    ents = facts["targets"]
    if not ents and not any(a.wide(p) for p in perms):
        out.append(reason("no_permission"))
    for e in ents:
        if not a.any_allowed(perms, e):
            out.append(reason("no_permission", e))
    if facts["unknown_effects"] and not any(a.wide(p) for p in perms):
        out.append(reason("no_permission", message="לפריט פעולות שאינן ידועות מראש; הרצה דורשת הרשאה בכל ההתקנה."))
    if not out:
        out.extend(control_reasons(ctx, ents))
        out.extend(grant_reasons(ctx, facts["steps"]))
        if kind == "automation":
            out.extend(ref_reasons(ctx, facts))
    return out


def sensitive_steps_view(ctx: Ctx, facts: dict[str, Any]) -> list[dict[str, Any]]:
    """The sensitive steps with the grant each needs and whether the caller holds it (the preview's `sensitive_steps`)."""
    out = []
    for s in facts["steps"]:
        if not s.get("sens") or s["role"] != "device":
            continue
        e = s["entity_id"]
        if s["sens"] == "alarm":
            grant = "alarm.disarm" if s["action"] == "alarm_control_panel.alarm_disarm" else "alarm.arm"
            ok = ctx.access.allowed(grant, e, own=True)
        else:
            grant = GRANT_FOR.get(s["action"], "ha.entity.control")
            ok = ctx.access.allowed(grant, e) if grant != "ha.entity.control" else ctx.access.control(e)
        out.append({"path": s["path"], "entity_id": e, "action": s["action"], "grant": grant, "granted": bool(ok), "class": s["sens"], "label": pol.SENSITIVE_CLASS_LABEL.get(s["sens"], ""),
                    "name": ctx.name_of(e) if ctx.access.can_read_state(e) else e})
    return out
