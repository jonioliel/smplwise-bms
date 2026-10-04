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
from ..rbac import INSTALLATION, Principal, authorize, is_system_admin, permissions_anywhere
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
CATALOG_DOMAINS = ("light", "switch", "cover", "climate", "fan", "alarm_control_panel", "lock", "button", "script", "scene", "input_boolean", "input_number", "input_select",
                   "humidifier", "vacuum", "siren", "media_player", "number", "select")
# 2026-10-04: an administrator's "this is fine from our side" on a review issue, bound to the schedule's content (`revision`): the chip is
# silenced until the content changes outside Arx. Kept in the settings table (`schedules.acks`, a JSON object; no migration).
ACK_KEY = "schedules.acks"
ACKABLE = ("no_owner_sensitive", "unsupported_content")
# 2026-10-04 follow-up (owner decision 2): a system administrator's "allowed in schedules" mark of ONE script that disarms / unlocks / opens a
# door (or whose content Arx cannot read), bound to the script's content (`script_content_hash`): a change of the script revokes it by itself.
# {entity_id: {hash, by, by_name, at}} in the settings table (no migration).
SCRIPT_MARKS_KEY = "schedules.script_marks"
# the media device kinds a schedule may drive (a group / session / service fans out or is not a room's own player: never one schedule call)
MEDIA_KINDS = ("screen", "speaker", "player", "receiver")
COND_DOMAINS = ("binary_sensor", "sensor", "sun", "input_boolean")
STATES = ("on", "off", "triggered", "completed", "unavailable", "unknown")

REASON_MESSAGES = {
    "no_manage_permission": "אין לך הרשאה לנהל תזמונים של ההתקנים האלה.",
    "sensitive_permission_required": "תזמון של אזעקה, צופרים, מנעולים, דלתות ושערים דורש הרשאה לתזמון פעולות רגישות.",
    "class_disabled": "סוג ההתקן כובה בהגדרות › תזמונים.",
    "unsupported_content": "התזמון כולל תוכן שהמערכת אינה מציגה במלואו; אפשר לערוך אותו רק ברכיב המקורי.",
    "feature_disabled": "התזמונים כבויים בהגדרות המערכת.",
    "component_unavailable": "רכיב התזמונים אינו זמין כרגע.",
    "ha_unavailable": "תשתית המערכת אינה זמינה כרגע.",
    "bridge_unavailable": "נדרש עדכון או צימוד של רכיב החיבור כדי לשמור תזמונים.",
    "action_invalid": "פעולה בתזמון אינה תקפה עוד (ההתקן חסר או אינו תומך בה); אפשר לערוך ולהסיר אותה.",
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
        self._door_layer: set[str] | None = None
        self._managed: set[str] | None = None
        self._media_managed: set[str] | None = None
        self._access: Access | None = None
        self._write: tuple[bool, str | None] | None = None
        self._sun: dict[str, int] | None | bool = False
        self._owners: dict[str, "Ctx"] = {}  # the review's owner contexts, one per user per request (review L6)
        self._marks: dict[str, Any] | None = None  # `schedules.script_marks`, read once per request
        self._media_access: Any = None
        self._actx: Any = None  # the automations context (services/automation_scope.Ctx): what a script / scene drives and who may run it

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

    def allow_disarm(self) -> bool:
        """`schedules.allow_disarm`: whether a NEW schedule may disarm a panel directly (default off; a system administrator's typed decision)."""
        return self.cfg.get("schedules.allow_disarm") == "true"

    def bridge_at_least(self, version: str) -> bool:
        return _version_tuple(get_setting(self.conn, "bridge.integration_version")) >= _version_tuple(version)

    @property
    def actx(self) -> Any:
        if self._actx is None:
            from . import automation_scope as ascope

            self._actx = ascope.Ctx(self.conn, self.principal)
        return self._actx

    def sun_seconds(self) -> dict[str, int] | None:
        if self._sun is False:
            sun = self.entity("sun.sun")
            attrs = (sun or {}).get("attributes") or {}
            self._sun = model.sun_seconds_from(attrs.get("next_rising"), attrs.get("next_setting"), self.tz_name)
        return self._sun  # type: ignore[return-value]

    # -- entities

    def _sets(self) -> None:
        if self._door_layer is None:
            self._door_layer = {r[0] for r in self.conn.execute(
                "SELECT resource_id FROM map_anchors WHERE resource_type = 'ha_entity' AND layer_id = ? AND effective_to IS NULL", (dsvc.DOOR_LAYER,)).fetchall()}

    def _media_owned(self) -> set[str]:
        if self._media_managed is None:
            from . import media_store

            self._media_managed = media_store.managed_entities(self.conn)
        return self._media_managed

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
        cls, refusal = policy.classify_entity(info, on_door_layer=info["entity_id"] in (self._door_layer or ()), alarm_managed=managed)
        if refusal != "alarm_managed_control" and r["domain"] in ("switch", "select", "button", "number") and info["entity_id"] in self._media_owned():
            cls, refusal = None, "media_managed_control"  # CR-016 review M4: a screen's / speaker's own switch is operated from "מולטימדיה" only
        if cls == "media":
            why, facts = self._media_facts(info["entity_id"])
            if why:
                cls, refusal = None, why
            else:
                info.update(facts)
        info["class"], info["refusal"] = cls, refusal
        if cls in policy.ITEM_CLASSES:
            info.update(self._item_facts(info["entity_id"], cls))
        return info

    def _media_facts(self, entity_id: str) -> tuple[str | None, dict[str, Any]]:
        """A media player is schedulable only as a VISIBLE endpoint of an APPROVED screen / speaker / player / receiver of the multimedia settings
        (multimedia on): (refusal, facts). The facts carry the device's anchor (the multimedia permissions are judged there), whether it is public,
        the volume ceiling (the administrator's `volume_max` and the night window's max, the lower one - a schedule may fire inside the window) and
        the sources the administrator hid."""
        from . import media_store

        if not media_store.enabled(self.conn):
            return "media_disabled", {}
        row = self.conn.execute(
            "SELECT d.device_key, d.kind, d.anchor_entity_id, d.is_public, d.volume_max, d.volume_night_json, d.sources_json, e.hidden FROM media_device_endpoints e "
            "JOIN media_devices d ON d.device_key = e.device_key WHERE e.ref = ? AND e.source = 'ha' AND d.approved = 1 AND d.removed_at IS NULL", (entity_id,)).fetchone()
        if row is None or row["hidden"] or row["kind"] not in MEDIA_KINDS:
            return "media_not_approved", {}
        ceiling = row["volume_max"]
        night = media_store.night_window(dict(row))
        if night is not None:
            ceiling = night["max"] if ceiling is None else min(ceiling, night["max"])
        try:
            curated = json.loads(row["sources_json"] or "[]")
        except ValueError:
            curated = []
        hidden = [c.get("id") for c in curated if isinstance(c, dict) and c.get("hidden") and isinstance(c.get("id"), str)] if isinstance(curated, list) else []
        return None, {"media": {"device_key": row["device_key"], "anchor": row["anchor_entity_id"] or entity_id, "public": bool(row["is_public"])},
                      "volume_ceiling": (ceiling / 100.0) if isinstance(ceiling, (int, float)) and not isinstance(ceiling, bool) else None, "hidden_sources": hidden}

    def media_access(self) -> Any:
        if self._media_access is None:
            from . import media_store

            self._media_access = media_store.Access(self.conn, self.principal, media_store.ALL_PERMS) if self.principal is not None else None
        return self._media_access

    def script_marks(self) -> dict[str, Any]:
        if self._marks is None:
            self._marks = read_script_marks(self.conn)
        return self._marks

    def _item_facts(self, entity_id: str, cls: str) -> dict[str, Any]:
        """What a script / scene drives, read from the automations mirror (`ha_config_items`, services/automation_scope.facts_of): `sensitive`
        (an alarm / lock / door step, or effects that are not known - a script whose config Arx cannot read counts as sensitive), `lowering`
        (a known step that disarms, unlocks or opens a door) and, for a script, its fields (`script_fields`, None when unknown)."""
        out: dict[str, Any] = {"effects_known": False, "script_fields": None, "sensitive": cls == "script", "lowering": False, "_facts": None, "_source": None}
        try:
            row = self.conn.execute("SELECT kind, config_json, source FROM ha_config_items WHERE entity_id = ? AND kind = ?", (entity_id, cls)).fetchone()
        except sqlite3.Error:
            row = None
        if cls == "script":
            out["content_hash"] = script_content_hash(entity_id, row)
            res = self._script_facts(entity_id, row, out)
            self._approval(entity_id, res)
            return res
        if row is None:
            return out
        return self._config_facts(entity_id, cls, row, out)

    def _approval(self, entity_id: str, out: dict[str, Any]) -> None:
        """Owner decision 2: a script whose known steps disarm, unlock or open a door - or whose content Arx cannot read - runs from a schedule only
        while a system administrator's mark holds for its current content."""
        out["approval_required"] = bool(out.get("lowering") or not out.get("effects_known"))
        mark = self.script_marks().get(entity_id)
        out["approval_ok"] = bool(isinstance(mark, dict) and mark.get("hash") == out["content_hash"])
        out["approval_stale"] = bool(isinstance(mark, dict) and not out["approval_ok"])

    def _script_facts(self, entity_id: str, row: sqlite3.Row | None, out: dict[str, Any]) -> dict[str, Any]:
        if row is None:
            return out
        return self._config_facts(entity_id, "script", row, out)

    def _config_facts(self, entity_id: str, cls: str, row: sqlite3.Row, out: dict[str, Any]) -> dict[str, Any]:
        out["_source"] = row["source"]
        try:
            cfg = json.loads(row["config_json"]) if row["config_json"] else None
        except ValueError:
            cfg = None
        if not isinstance(cfg, dict):
            return out
        from . import automation_draft as drafts
        from . import automation_scope as ascope

        try:
            rd = drafts.read(cls, cfg, self.actx.model_ctx(code_view=False, scoped=False))
            facts = ascope.facts_of(self.actx, cls, rd, entity_id=entity_id)
        except Exception:  # noqa: BLE001 - a config the model cannot read is "effects unknown", never a crash of the schedules screen
            return out
        out.update(effects_known=not facts["unknown_effects"], _facts=facts, sensitive=bool(facts["sensitive"] or facts["unknown_effects"]),
                   lowering=any(_lowering_step(s) for s in facts["steps"]))
        if cls == "script":
            out["script_fields"] = script_fields(rd["draft"].get("fields") or [])
        return out

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


def _lowering_step(step: dict[str, Any]) -> bool:
    action, sens = step.get("action") or "", step.get("sens")
    if action in (policy.LOWERING_ARM_OFF, "lock.unlock", "lock.open"):
        return True
    return sens in ("door", "gate", "garage") and action in ("cover.open_cover", "cover.set_cover_position", "cover.toggle")


def script_fields(fields: list[dict[str, Any]]) -> dict[str, dict[str, Any]]:
    """A script's fields (automation_model._parse_fields) as the schedules validate them: {key: {name, required, default?, kind, min, max, step,
    options}}. A field whose selector the schedules do not model keeps its kind (`entity`, `locked`): it is never offered, and a REQUIRED one
    without a default makes the script unschedulable with a clear reason."""
    out: dict[str, dict[str, Any]] = {}
    for f in fields:
        key = f.get("key")
        if not isinstance(key, str) or not policy.VAR_KEY.match(key) or key.lower() in policy._CODE_KEYS:
            continue
        sel = f.get("selector") or {}
        d: dict[str, Any] = {"name": f.get("name") or key, "required": bool(f.get("required")), "kind": sel.get("kind") or "locked"}
        if "default" in f:
            d["default"] = f["default"]
        if d["kind"] == "number":
            d.update(min=sel.get("min"), max=sel.get("max"), step=sel.get("step"), unit=sel.get("unit"))
        elif d["kind"] == "select":
            d["options"] = [o for o in sel.get("options") or [] if isinstance(o, str)]
        elif d["kind"] == "text" and sel.get("max") is not None:
            d["max"] = sel["max"]
        out[key] = d
    return out


VAR_KINDS = ("number", "boolean", "select", "text")


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
    info = ctx.entity(entity_id)
    if policy.is_sensitive(cls, info) and not a.allowed(SENSITIVE, entity_id):
        out.append(reason("sensitive_permission_required", entity_id))
    name = ctx.name_of(entity_id)
    not_controllable = reason("entity_not_controllable", entity_id, f"אין לך הרשאת שליטה ב־{name}.")
    if cls in ("light", "switch", "cover", "climate", "fan", "helper", "humidifier", "vacuum", "number", "select"):
        if not a.control(entity_id):
            out.append(not_controllable)
    elif cls == "siren":
        # a siren is judged like the alarm's own devices: control of the entity itself (never the everyday devices.control), and the remote
        # channel's alarm rule (no alarm control from outside the local network unless the administrator allowed it)
        if not a.allowed("ha.entity.control", entity_id):
            out.append(not_controllable)
        block = remote_block(ctx, "arm")
        if block:
            out.append({**reason("entity_not_controllable", entity_id, block[1]), "_remote": block[0]})
    elif cls == "media":
        out.extend(media_reasons(ctx, service, entity_id, info))
    elif cls in policy.ITEM_CLASSES:
        out.extend(item_run_reasons(ctx, cls, entity_id, info))
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


def item_run_reasons(ctx: Ctx, cls: str, entity_id: str, info: dict[str, Any] | None) -> list[dict[str, Any]]:
    """Scheduling a script / scene asks what RUNNING it asks (services/automation_scope.run_reasons, owner decision 6ג): `script.run` at every
    device it drives, control there and the same grant manual control needs for every sensitive step (alarm.disarm for a disarm, door.unlock,
    the remote channel's alarm refusal included). A script whose effects are not known needs the permission installation-wide; a scene that is
    not known (an integration's scene) needs control of the scene itself."""
    from . import automation_scope as ascope

    a = ctx.access
    name = ctx.name_of(entity_id)
    facts = (info or {}).get("_facts")
    if facts is None:
        if cls == "scene":
            return [] if a.control(entity_id) else [reason("entity_not_controllable", entity_id, f"אין לך הרשאה להפעיל את {name}.")]
        if any(ctx.actx.access.wide(p) for p in (ascope.SCRIPT_RUN, ascope.SCRIPT_MANAGE)):
            return []
        return [reason("entity_not_controllable", entity_id, f"פעולות הסקריפט {name} אינן ידועות למערכת; תזמון שלו דורש הרשאת הרצת סקריפטים בכל ההתקנה.")]
    source = "integration" if (info or {}).get("_source") == "integration" else "ui"
    out: list[dict[str, Any]] = []
    for r in ascope.run_reasons(ctx.actx, cls, facts, entity_id=entity_id, source=source):
        code = r.get("code")
        if code == "grant_required":
            out.append({"code": "grant_required", "message": r.get("message") or "", "entity_id": entity_id})
        elif r.get("_remote"):
            out.append({"code": "entity_not_controllable", "message": r.get("message") or "", "entity_id": entity_id, "_remote": r["_remote"]})
        else:
            msg = r.get("message") if code == "entity_not_controllable" and r.get("entity_id") else f"אין לך הרשאה להפעיל את {name}."
            out.append({"code": "entity_not_controllable", "message": msg, "entity_id": entity_id})
    return out


def media_reasons(ctx: Ctx, service: str, entity_id: str, info: dict[str, Any] | None) -> list[dict[str, Any]]:
    """A media player is scheduled under the multimedia rules (CR-015 / CR-016): media.read and the command's own permission at the DEVICE's anchor
    (media.power for power and source, media.control for the rest) - and on a public device a source change also needs media.public."""
    from . import media_store

    media = (info or {}).get("media") or {}
    anchor = media.get("anchor") or entity_id
    acc = ctx.media_access()
    name = ctx.name_of(entity_id)
    if acc is None:
        return [reason("entity_not_controllable", entity_id, f"אין לך הרשאה להפעיל את {name}.")]
    perm = media_store.PERM_POWER if service in ("media_player.turn_on", "media_player.turn_off", "media_player.select_source") else media_store.PERM_CONTROL
    out: list[dict[str, Any]] = []
    if not acc.has(media_store.PERM_READ, anchor) or not acc.has(perm, anchor):
        from ..routers.access import PERMISSION_LABELS

        out.append(reason("grant_required", entity_id, f"הפעולה דורשת הרשאת מולטימדיה ({PERMISSION_LABELS.get(perm, perm)})."))
    elif service == "media_player.select_source" and media.get("public") and not acc.has(media_store.PERM_PUBLIC, anchor):
        out.append(reason("grant_required", entity_id, "החלפת מקור במסך ציבורי דורשת הרשאה נפרדת."))
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
    can = {"edit": edit, "toggle": toggle, "run": edit and not cls_info.get("invalid") and not cls_info.get("blocked"), "delete": writable and ((not loose) if understood else wide_manage), "copy": edit}
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
                         "class": info["class"] if info else None, "sensitive": bool(info and policy.is_sensitive(info["class"], info)), "available": bool(info and info["available"])})
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
    for p in (cls.get("invalid") or []) + (cls.get("blocked") or []):
        out.append({"path": p["path"], "code": p["code"], "message": p["message"]})
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
            counts["attention"] = sum(1 for x in review_items(ctx, visible) if x["issues"])
        else:
            acks = read_acks(conn)
            counts["attention"] = sum(1 for r in visible if not model.classify(r.core, ctx.resolver)["understood"] and not ack_of(acks, r.core["id"], "unsupported_content", r.row["revision"]))
        if can["configure"]:
            counts["hidden"] = total - len(visible)
    shabbat = None
    if ctx.shabbat_sensor and can["view"]:  # a calendar fact for schedule viewers, not for every signed-in user
        info = ctx.entity(ctx.shabbat_sensor)
        shabbat = {"entity_id": ctx.shabbat_sensor, "name": info["name"] if info else ctx.shabbat_sensor, "state": info["state"] if info else None, "available": bool(info and info["available"])}
    out: dict[str, Any] = {
        "available": avail, "feature_enabled": cfg["schedules.enabled"] == "true", "stale": stale, "last_sync_at": st.get("last_sync_at"),
        "writable": writable, "write_block": block, "capabilities": dict(policy.CAPABILITIES), "can": {**can, "acknowledge": bool(can["configure"] and is_system_admin(conn, principal.user_id))}, "counts": counts,
        "settings": {"snap_minutes": int(cfg["schedules.snap_minutes"]), "default_repeat": cfg["schedules.default_repeat"], "classes": cfg["schedules.classes"], "shabbat_sensor": shabbat,
                     "allow_disarm": cfg.get("schedules.allow_disarm") == "true"},
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
    stored = read_acks(ctx.conn)
    for r in rows:
        cls = model.classify(r.core, ctx.resolver)
        issues = _issues(ctx, r, cls)
        if issues:
            acked = [a for a in (ack_of(stored, r.core["id"], i, r.row["revision"]) for i in issues) if a]
            names = {a["issue"] for a in acked}
            out.append({"schedule": build_schedule(ctx, r.row, r.meta, runs.get(r.core["id"])), "issues": [i for i in issues if i not in names], "acknowledged": acked})
    return out


def read_acks(conn: sqlite3.Connection) -> dict[str, dict[str, dict[str, Any]]]:
    """`schedules.acks`: {schedule_id: {issue: {hash, by, by_name, at}}}; a corrupt value reads as none (the warnings come back)."""
    try:
        data = json.loads(get_setting(conn, ACK_KEY, "{}") or "{}")
    except ValueError:
        return {}
    return data if isinstance(data, dict) else {}


def ack_of(stored: dict[str, Any], schedule_id: str, issue: str, revision: str) -> dict[str, Any] | None:
    """The acknowledgement of `issue` that still holds - its content hash is the schedule's current revision (a change made outside Arx brings
    the warning back by itself)."""
    if issue not in ACKABLE:
        return None
    rec = (stored.get(schedule_id) or {}).get(issue) if isinstance(stored.get(schedule_id), dict) else None
    if not isinstance(rec, dict) or rec.get("hash") != revision:
        return None
    return {"issue": issue, "by": {"user_id": rec.get("by"), "username": rec.get("by_name") or "", "display_name": rec.get("by_name") or ""}, "at": rec.get("at")}


# ---------------------------------------------------------------- scripts "allowed in schedules" (owner decision 2, 2026-10-04)

def read_script_marks(conn: sqlite3.Connection) -> dict[str, dict[str, Any]]:
    """`schedules.script_marks`: {script entity_id: {hash, by, by_name, at}}; a corrupt value reads as none (nothing is approved)."""
    try:
        data = json.loads(get_setting(conn, SCRIPT_MARKS_KEY, "{}") or "{}")
    except ValueError:
        return {}
    return {k: v for k, v in data.items() if isinstance(k, str) and isinstance(v, dict)} if isinstance(data, dict) else {}


def script_content_hash(entity_id: str, row: sqlite3.Row | None) -> str:
    """What a mark is bound to: the script's configuration as the automations mirror holds it (`ha_config_items.config_json`, canonical JSON). A
    script whose configuration Arx cannot read at all hashes to its id alone - a change Arx cannot see cannot revoke its mark (recorded)."""
    cfg: Any = None
    if row is not None and row["config_json"]:
        try:
            cfg = json.loads(row["config_json"])
        except ValueError:
            cfg = row["config_json"]
    import hashlib

    return hashlib.sha256(model.canonical({"entity_id": entity_id, "config": cfg}).encode("utf-8")).hexdigest()[:16]


def script_approval_view(ctx: Ctx, entity_id: str, info: dict[str, Any]) -> dict[str, Any]:
    """`{required, approved, stale, by, at}` of one script for the UI (the picker's reason, the settings list)."""
    mark = ctx.script_marks().get(entity_id)
    held = bool(info.get("approval_ok"))
    return {"required": bool(info.get("approval_required")), "approved": held, "stale": bool(info.get("approval_stale")),
            "by": ({"user_id": mark.get("by"), "username": mark.get("by_name") or "", "display_name": mark.get("by_name") or ""} if isinstance(mark, dict) else None),
            "at": mark.get("at") if isinstance(mark, dict) else None}


def scripts_payload(ctx: Ctx) -> dict[str, Any]:
    """`GET /schedules/scripts`: every script the caller may manage with whether a schedule may use it - the ones that need a system administrator's
    mark first (they disarm / unlock / open a door, or their content is not known), the mark and who set it when, and whether it lapsed because the
    script changed. `can_mark`: the caller is a system administrator."""
    a = ctx.access
    rows = ctx.conn.execute("SELECT entity_id FROM ha_entities WHERE removed_at IS NULL AND disabled = 0 AND domain = 'script' ORDER BY name, entity_id").fetchall()
    ctx.preload([r[0] for r in rows])
    out = []
    for r in rows:
        info = ctx.entity(r[0])
        if info is None or info["class"] != "script" or not (a.allowed(MANAGE, info["entity_id"]) and a.can_read_state(info["entity_id"])):
            continue
        out.append({"entity_id": info["entity_id"], "name": info["name"], "area_name": info["area_name"], "lowering": bool(info.get("lowering")), "effects_known": bool(info.get("effects_known")),
                    "sensitive": bool(info.get("sensitive")), "approval": script_approval_view(ctx, info["entity_id"], info)})
    return {"scripts": out, "can_mark": bool(ctx.principal is not None and is_system_admin(ctx.conn, ctx.principal.user_id))}


def _issues(ctx: Ctx, r: Row, cls: dict[str, Any]) -> list[str]:
    issues: list[str] = []
    core = r.core
    sub = [p for s in cls["slots"] for p in s["unsupported"]]
    if any(p["code"] == "contains_code" for p in sub):
        issues.append("contains_code")
    if any(p["code"] != "contains_code" for p in sub):
        issues.append("unsupported_content")
    if cls.get("invalid"):
        issues.append("action_invalid")
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
    """The argument form of one service for THIS entity: ranges, modes and options from the entity's own attributes, a script's variables from
    its own fields; an argument the entity cannot take is left out (never offered)."""
    attrs = info.get("attributes") or {}
    out = []
    for name, a in spec["args"].items():
        if not policy.arg_capable(service, name, info):
            continue
        d: dict[str, Any] = {"name": name, "type": a["type"], "required": bool(a.get("required")), "label": policy.arg_label(name)}
        if name == "temperature":
            lo, hi = policy._temperature_range(info)
            d.update(min=lo, max=hi)
        elif name in ("value", "humidity"):
            lo, hi = policy._entity_range(info, name, a.get("min"), a.get("max"))
            d.update(min=lo, max=hi)
            step = policy._number(attrs.get("step")) if name == "value" else None
            if step:
                d["step"] = step
        elif name == "volume_level":
            ceiling = policy._number(info.get("volume_ceiling"))
            d.update(min=a.get("min"), max=min(a.get("max", 1), ceiling) if ceiling is not None else a.get("max"), step=0.01)
        elif a["type"] in ("int", "float"):
            d.update(min=a.get("min"), max=a.get("max"))
        elif name == "tone":
            d.update(type="enum", choices=policy.siren_tones(info))
        elif name == "source":
            hidden = set(info.get("hidden_sources") or [])
            offered = [s for s in (policy._attr_list(info, "source_list") or []) if s not in hidden]
            if not offered:
                continue
            d.update(type="enum", choices=offered)
        elif name == "hvac_mode":
            d["choices"] = policy._attr_list(info, "hvac_modes") or list(a["choices"])
        elif name in policy.OFFERED_LIST:
            offered = policy._attr_list(info, policy.OFFERED_LIST[name])
            if offered:
                d.update(type="enum", choices=offered)
        elif a["type"] == "vars":
            fields = [_var_spec(k, f) for k, f in (info.get("script_fields") or {}).items() if f.get("kind") in VAR_KINDS]
            if not fields:
                continue  # a script without fields the schedules model is run without variables
            d["fields"] = fields
        out.append(d)
    return out


def _var_spec(key: str, f: dict[str, Any]) -> dict[str, Any]:
    kind = f["kind"]
    d: dict[str, Any] = {"name": key, "label": f.get("name") or key, "required": bool(f.get("required")) and "default" not in f}
    if "default" in f:
        d["default"] = f["default"]
    if kind == "number":
        integral = all(isinstance(v, int) and not isinstance(v, bool) for v in (f.get("min"), f.get("max"), f.get("step") or 1) if v is not None)
        d.update(type="int" if integral else "float", min=f.get("min"), max=f.get("max"))
        if f.get("step"):
            d["step"] = f["step"]
        if f.get("unit"):
            d["unit"] = f["unit"]
    elif kind == "boolean":
        d["type"] = "bool"
    elif kind == "select":
        d.update(type="enum", choices=list(f.get("options") or []))
    else:
        d["type"] = "str"
        if f.get("max") is not None:
            d["max"] = f["max"]
    return d


def catalog_actions(cls: str, info: dict[str, Any], ctx: Ctx) -> tuple[list[dict[str, Any]], dict[str, Any] | None]:
    """(the services a new schedule may use on this entity, the reason when there are none)."""
    services = SCHEDULE_ACTIONS_BY_CLASS(cls)
    out = []
    attrs = info.get("attributes") or {}
    too_old = False
    for service, spec in services.items():
        if not policy.service_allowed(cls, service, info["entity_id"]):
            continue  # another domain of the same class (a helper's, a door switch's)
        if not policy.service_capable(service, info):
            continue  # capability discovery: only what this entity reports it can do
        if service == "media_player.select_source" and not [s for s in (policy._attr_list(info, "source_list") or []) if s not in set(info.get("hidden_sources") or [])]:
            continue  # nothing the administrator left visible to switch to
        if service in policy.NEWER_BRIDGE_SERVICES and not ctx.bridge_at_least(policy.NEWER_BRIDGE):
            too_old = True
            continue
        if cls == "alarm":
            panel = ctx.panel(info["entity_id"])
            if service == policy.LOWERING_ARM_OFF:
                if panel.get("needs_code_disarm") or not ctx.allow_disarm():
                    continue  # never with a code; and only when a system administrator allowed scheduled disarming
            else:
                if policy.ARM_MODE_OF.get(service) not in (panel.get("arm_modes") or []) or panel.get("needs_code_arm"):
                    continue
        out.append({"service": service, "label": spec["label"], "lowering": policy.is_lowering(service, cls, {"position": 1} if service == "cover.set_cover_position" else {}, info),
                    "args": _catalog_args(service, spec, info)})
    if not out and too_old:
        return [], {"code": "bridge_too_old_for_action", "message": "נדרש עדכון של רכיב החיבור כדי לתזמן פעולה זו."}
    if not out and cls == "alarm":
        return [], {"code": "alarm_code_needed", "message": "לוח האזעקה דורש קוד לפעולה זו. תזמון אינו שומר קודים, ולכן אי אפשר לתזמן אותה."}
    if cls == "lock" and attrs.get("code_format"):
        return [], {"code": "lock_code_needed", "message": "המנעול דורש קוד. תזמון אינו שומר קודים, ולכן אי אפשר לתזמן אותו."}
    if cls == "script":
        blocking = [f.get("name") or k for k, f in (info.get("script_fields") or {}).items() if f.get("required") and "default" not in f and f.get("kind") not in VAR_KINDS]
        if blocking:
            return [], {"code": "script_field_unsupported", "message": f"לסקריפט משתנה חובה שהמערכת אינה מציגה ({blocking[0]}); אפשר לתזמן אותו רק ברכיב המקורי."}
        if info.get("approval_required") and not info.get("approval_ok"):
            # listed (the person sees why), disabled: only a system administrator's mark for the script's current content makes it schedulable
            return out, {"code": "script_not_approved", "message": model.SCRIPT_NOT_APPROVED}
    return out, None


def SCHEDULE_ACTIONS_BY_CLASS(cls: str) -> dict[str, dict[str, Any]]:
    return policy.SCHEDULE_ACTIONS.get(cls, {})


def _catalog_attrs(info: dict[str, Any]) -> dict[str, Any]:
    keep = ("current_position", "current_tilt_position", "hvac_modes", "min_temp", "max_temp", "fan_modes", "preset_modes", "temperature", "brightness", "percentage", "code_format",
            "swing_modes", "available_modes", "options", "min", "max", "step", "min_humidity", "max_humidity", "supported_color_modes", "mode", "humidity", "swing_mode",
            "available_tones", "source_list", "source", "volume_level")
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
        if cls is None:
            continue  # scheduler switches, alarm-managed controls, plain buttons, unknown domains ... never appear
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
        actions, why = catalog_actions(cls, info, ctx)
        if why is None and not actions:
            why = {"code": "action_not_allowed", "message": "אין פעולות מותרות להתקן זה."}
        if why is None:
            sample = core_sample(eid, cls, actions)
            blocked = next((x for x in (action_reasons(ctx, s, eid, cls, strict=True) for s in sample) if x), None)
            if blocked:
                why = {"code": blocked[0]["code"], "message": blocked[0]["message"]}
        entry = {
            "entity_id": eid, "name": info["name"], "domain": info["domain"], "class": cls or "switch", "sensitive": policy.is_sensitive(cls, info), "area_id": info["area_id"], "area_name": info["area_name"],
            "floor_id": info["floor_id"], "floor_name": info["floor_name"], "available": info["available"], "selectable": why is None, "reason": why, "attributes": _catalog_attrs(info), "actions": actions if why is None or cls else [],
        }
        if cls == "script":
            entry["approval"] = script_approval_view(ctx, eid, info)
        out.append(entry)
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
