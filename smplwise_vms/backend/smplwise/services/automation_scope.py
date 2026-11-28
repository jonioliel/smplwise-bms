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
from ..i18n import CATALOGUE, t
from ..rbac import Principal, bindings_of
from . import automation_draft as drafts
from . import automation_model as model
from . import automation_policy as pol
from . import automation_transport as tr
from . import devices as dsvc
from . import ha_scope

MANAGE, SCENE_MANAGE = "automation.manage", "scene.manage"
SCRIPT_RUN, SCRIPT_MANAGE, CODE_VIEW = "script.run", "script.manage", "automation.code_view"
MANAGE_OF = {"automation": MANAGE, "script": SCRIPT_MANAGE, "scene": SCENE_MANAGE}
# owner decision 2026-10-01 (CR-017 1b): there is NO view-only access to automations - whoever may not edit and save them may not see them at all (list, detail, runs,
# trace, versions, review, templates, catalog, trash, notifications). A scene or a script is seen by who may activate / run / manage it.
VIEW_PERMS = {"automation": (MANAGE,), "script": (SCRIPT_RUN, SCRIPT_MANAGE), "scene": (SCENE_MANAGE,)}
PERMS = (MANAGE, SCENE_MANAGE, SCRIPT_RUN, SCRIPT_MANAGE, CODE_VIEW, "devices.read", "entity.state.read", "ha.entity.control", "devices.control", "door.unlock",
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
# I18N-BACKEND-2490 (third pass): each message a `Msg` (`ascope.reason.<code>`, services/automation_scope_text.py) whose string value is the
# Hebrew above, byte for byte; the routes render it in the reader's language
from . import automation_scope_text  # noqa: E402,F401 - registers `ascope.*` and `sched.*`

REASON_MESSAGES = {k: (t(f"ascope.reason.{k}") if CATALOGUE.get(f"ascope.reason.{k}", {}).get("he") == v else v) for k, v in REASON_MESSAGES.items()}
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
                                  template_text=code_view, wall_buttons=self.wall_buttons, presence_entity=self.presence_entity,
                                  presence_sensors=self.presence_sensors)

    # KAV079-295: the two model switches of the editors' extension (both default off / empty)
    @property
    def wall_buttons(self) -> bool:
        return self.cfg.get("automations.wall_buttons_editable") == "true"

    @property
    def presence_sensors(self) -> tuple[str, ...]:
        """BUILDING-PRESENCE-2271: the presence sensors the owner tagged (empty = the cockpit's building-presence blocks do not exist)."""
        from . import building_presence as bp

        return tuple(bp.tagged_ids(self.conn)) if bp.is_enabled(self.conn) else ()  # PRESENCE-2280: master switch off = not offered

    @property
    def presence_entity(self) -> str | None:
        return (self.cfg.get("automations.presence_entity") or "") or None

    def device_name(self, device_id: str) -> str | None:
        """The name of a Home Assistant device (a wall switch a `device` trigger belongs to) from the mirror, for the label of its locked block."""
        if device_id not in self._device_names:
            from . import ha_naming

            # HA-2026-11-COMPAT-2404: a child device (one gang of a multi-gang switch) is named with its parent
            row = self.conn.execute("SELECT d.device_id, d.name, d.name_by_user, d.parent_device_id, d.next_name_part, p.device_id AS p_id, p.name AS p_name, "
                                    "p.name_by_user AS p_name_by_user FROM ha_devices d LEFT JOIN ha_devices p ON p.device_id = d.parent_device_id AND p.removed_at IS NULL "
                                    "WHERE d.device_id = ? AND d.removed_at IS NULL", (device_id,)).fetchone()
            self._device_names[device_id] = (ha_naming.mirror_row_label(row) or None) if row else None
        return self._device_names[device_id]

    def scope_info(self) -> dict[str, Any]:
        """The caller's reach for the authoring permissions, explicit: `installation` = at least one of them holds for the whole installation, `scoped` = the
        caller works inside floors only (never both), `floors` = those floors (Arx floors; the placements decide which devices are in them - Home Assistant's own
        areas are never a scope), `areas` is always empty (kept for clients that read it)."""
        a = self.access
        perms = (MANAGE, SCENE_MANAGE, SCRIPT_RUN, SCRIPT_MANAGE)
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
            step = scene_member_step(ctx, m["entity_id"], m["state"])
            if step is not None:
                f["steps"].append(step)
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


# CD2-02: the action Home Assistant's reproduce-state sends for the state a scene sets on an alarm panel
_ALARM_STATE_ACTION = {"disarmed": "alarm_control_panel.alarm_disarm", "armed_home": "alarm_control_panel.alarm_arm_home",
                       "armed_away": "alarm_control_panel.alarm_arm_away", "armed_night": "alarm_control_panel.alarm_arm_night",
                       "armed_vacation": "alarm_control_panel.alarm_arm_vacation", "armed_custom_bypass": "alarm_control_panel.alarm_arm_custom_bypass"}


def scene_member_step(ctx: Ctx, entity_id: str, state: str | None) -> dict[str, Any] | None:
    """CD2-02: the sensitive step one scene member stands for, judged exactly as the same manual action: a lock (lock / unlock), an alarm panel
    (the arm mode or the disarm its state names; a state that names neither - triggered, pending, unknown, a member whose state is not known -
    counts as a disarm, the strictest grant), a siren and a door-class cover (control and a confirmation). None for an ordinary member."""
    dom = entity_id.split(".", 1)[0]
    st = (state or "").strip()
    if dom == "lock":
        return {"path": "members", "action": "lock.lock" if st == "locked" else "lock.unlock", "entity_id": entity_id, "role": "device", "sens": "lock"}
    if dom == "alarm_control_panel":
        return {"path": "members", "action": _ALARM_STATE_ACTION.get(st, "alarm_control_panel.alarm_disarm"), "entity_id": entity_id, "role": "device", "sens": "alarm"}
    if dom == "siren":
        return {"path": "members", "action": "siren.turn_off" if st == "off" else "siren.turn_on", "entity_id": entity_id, "role": "device", "sens": "siren"}
    if dom == "cover" and ctx.door_cover(entity_id):
        return {"path": "members", "action": "cover.close_cover" if st == "closed" else "cover.open_cover", "entity_id": entity_id, "role": "device",
                "sens": ctx.entity_class(entity_id) or "door"}
    return None


def members_unknown(ctx: Ctx, scene_entity_id: str | None, source: str | None) -> bool:
    """VD2-01: a scene whose members Arx cannot read at all (no readable config and no member list in its state) that is not a device
    integration's own scene (a Home Assistant scene: `platform: homeassistant`, or one the mirror could not classify): fail closed."""
    if not scene_entity_id:
        return True
    platform = (ctx.entity(scene_entity_id) or {}).get("platform")
    return source != "integration" or platform in (None, "homeassistant")


UNKNOWN_SCENE_PERMS = ("ha.entity.control", "door.unlock", "alarm.disarm")  # VD2-01: whoever may do every member's manual action anywhere


def unknown_scene_reasons(ctx: Ctx, entity_id: str | None) -> list[dict[str, Any]]:
    """VD2-01: a scene with unknown members runs only for a caller holding control, `door.unlock` and `alarm.disarm` installation-wide."""
    if all(ctx.access.wide(p) for p in UNKNOWN_SCENE_PERMS):
        return []
    return [reason("no_permission", entity_id, t("ascope.scene_members_unknown"), unknown_members=True)]


def scene_member_steps(ctx: Ctx, members: list[str]) -> list[dict[str, Any]]:
    """CD2-02: the sensitive steps of a scene known only by its member list (no readable config: the states it sets are not known)."""
    return [s for s in (scene_member_step(ctx, e, None) for e in members) if s is not None]


def scene_member_reasons(conn: sqlite3.Connection, principal: Principal, scene_entity_id: str) -> tuple[list[dict[str, Any]], list[dict[str, Any]]]:
    """CD2-02: (the sensitive member steps, why the caller may NOT activate the scene) for the device-control route's `scene.turn_on`, which checks
    control of the scene entity only: every sensitive member needs what its own manual action needs - control of a lock / siren / door-class
    cover, `door.unlock` for an unlock, `alarm.arm` / `alarm.disarm` (own scope) and the remote channel's alarm rule for a panel. The members
    come from the scene's readable config (the states it sets), else from its state's member list (each judged as its strictest action)."""
    ctx = Ctx(conn, principal)
    steps: list[dict[str, Any]] | None = None
    row = conn.execute("SELECT config_json FROM ha_config_items WHERE kind = 'scene' AND entity_id = ?", (scene_entity_id,)).fetchone()
    if row is not None and row["config_json"]:
        try:
            cfg = json.loads(row["config_json"])
        except ValueError:
            cfg = None
        if isinstance(cfg, dict):
            rd = drafts.read("scene", cfg, ctx.model_ctx(code_view=False, scoped=False))
            steps = facts_of(ctx, "scene", rd, entity_id=scene_entity_id)["steps"]
    if steps is None:
        members = ((ctx.entity(scene_entity_id) or {}).get("attributes") or {}).get("entity_id")
        if isinstance(members, list):
            steps = scene_member_steps(ctx, [m for m in members if isinstance(m, str)])
        else:
            src = conn.execute("SELECT source FROM ha_config_items WHERE kind = 'scene' AND entity_id = ?", (scene_entity_id,)).fetchone()
            if members_unknown(ctx, scene_entity_id, src["source"] if src is not None else None):
                # VD2-01: nothing is known of what it sets - the strongest rights, and the step-up of a disarm and of a door opening
                return list(UNKNOWN_SCENE_STEPS), unknown_scene_reasons(ctx, scene_entity_id)
            steps = []
    sens = [s for s in steps if s.get("sens") and s["role"] == "device"]
    return sens, control_reasons(ctx, list(dict.fromkeys(s["entity_id"] for s in sens))) + grant_reasons(ctx, sens)


# VD2-01: the step-up a scene of unknown members asks (it may disarm or open a door)
UNKNOWN_SCENE_STEPS = ({"path": "members", "action": "alarm_control_panel.alarm_disarm", "entity_id": "", "role": "device", "sens": "alarm"},
                       {"path": "members", "action": "lock.unlock", "entity_id": "", "role": "device", "sens": "lock"})


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
    else:  # a scene: the classes of its sensitive members (lock, alarm, siren, door-class covers - CD2-02)
        classes = list(dict.fromkeys(s["sens"] for s in f["steps"] if s.get("sens")))
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
    from .rbac_admin import PERMISSION_LABELS

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
                out.append(reason("grant_required", e, t("ascope.no_grant_at", perm=PERMISSION_LABELS[perm], name=ctx.name_of(e)), grant=perm, path=s["path"]))
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
            out.append(reason("entity_not_controllable", e, t("ascope.no_control_of", name=ctx.name_of(e)), grant=None))
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
                out.append(reason("entity_not_controllable", entity_id, t("ascope.no_control_of", name=ctx.name_of(entity_id or ""))))
                return out
            # CD2-02: a sensitive member the scene's state lists still needs what its own manual action needs (control, the grant, the remote rule)
            sens = [s for s in facts["steps"] if s.get("sens") and s["role"] == "device"]
            out.extend(control_reasons(ctx, list(dict.fromkeys(s["entity_id"] for s in sens))))
            out.extend(grant_reasons(ctx, sens))
            if facts.get("unknown_effects"):
                out.extend(unknown_scene_reasons(ctx, entity_id))  # VD2-01
            return out
        out.extend(control_reasons(ctx, facts["targets"]))
        out.extend(grant_reasons(ctx, facts["steps"]))
        if facts.get("unknown_effects"):
            out.extend(unknown_scene_reasons(ctx, entity_id))  # VD2-01: members not known - the strongest rights
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
        out.append(reason("no_permission", message=t("ascope.unknown_effects")))
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
