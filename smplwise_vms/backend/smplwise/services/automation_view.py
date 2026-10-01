"""CR-017: what a caller sees - the read model per caller (docs/architecture/AUTOMATIONS_API.md §2.3-§2.4, §3.1-§3.2, CR §4.1-§4.6).

Visibility is applied BEFORE filters, totals, counts and pagination (an invisible item is absent everywhere: list, detail, runs, versions, trash, counts, the
review list). An item the caller may see is shown with what the caller may DO with it (`can`, with the reasons when not), its Hebrew sentence and blocks
(trigger / condition entities outside the caller's reach and every locked block are shown locked; raw content and template text only to callers with the code
view), and warnings. No secret-like value, user id or context id is ever returned."""
from __future__ import annotations

import datetime as dt
import json
import sqlite3
from typing import Any

from ..db import get_setting
from ..errors import ApiError
from ..rbac import INSTALLATION, Principal, authorize
from . import automation_draft as drafts
from . import automation_model as model
from . import automation_policy as pol
from . import automation_scope as scope
from . import automation_text as text
from . import automation_trace as trace
from . import automation_transport as tr
from . import automations as store
from . import ha_bridge, ha_sync
from .timeutil import iso_utc, parse_utc, zone

LIST_LIMIT_MAX = 500
STATES = ("on", "off", "running", "unavailable", "invalid", "scene")
DOMAIN_CLASS = {"light": "light", "switch": "switch", "cover": "cover", "climate": "climate", "fan": "fan", "lock": "lock", "alarm_control_panel": "alarm", "siren": "siren", "media_player": "media",
                "scene": "scene", "script": "script", "automation": "automation", "humidifier": "climate", "vacuum": "vacuum", "button": "button", "number": "helper", "select": "helper",
                "input_number": "helper", "input_select": "helper", "input_boolean": "helper"}
CLASS_LABELS = {"alarm": "אזעקה", "lock": "מנעול", "door": "דלת / שער", "siren": "צופר", "locked": "שלב נעול"}


# ================================================================ rows

class Row:
    def __init__(self, r: sqlite3.Row, meta: sqlite3.Row | None, pref: sqlite3.Row | None) -> None:
        self.kind, self.item_id, self.config_id, self.entity_id = r["kind"], r["item_id"], r["config_id"], r["entity_id"]
        self.source, self.revision, self.masked, self.reason, self.changed_at = r["source"], r["revision"], bool(r["masked"]), r["reason"], r["changed_at"]
        self.cfg = store.row_config(r)
        self.meta, self.pref = meta, pref

    @property
    def key(self) -> tuple[str, str]:
        return self.kind, self.item_id


def load_rows(ctx: scope.Ctx, kinds: tuple[str, ...] = pol.ITEM_KINDS) -> list[Row]:
    meta = store.meta_rows(ctx.conn)
    prefs = {(r["kind"], r["item_id"]): r for r in ctx.conn.execute("SELECT * FROM automation_prefs WHERE user_id = ?", (ctx.principal.user_id,)).fetchall()} if ctx.principal is not None else {}
    rows = [Row(r, meta.get((r["kind"], r["item_id"])), prefs.get((r["kind"], r["item_id"]))) for r in store.cache_rows(ctx.conn) if r["kind"] in kinds]
    ctx.preload([r.entity_id for r in rows if r.entity_id])
    return rows


def analyse_row(ctx: scope.Ctx, row: Row, *, code_view: bool = False, scoped: bool = True) -> tuple[dict[str, Any] | None, dict[str, Any]]:
    """(the read item, its facts); the read item is None when the row has no readable config."""
    if row.cfg is None:
        facts = {"targets": [], "refs": [], "steps": [], "locked": [], "unknown_effects": False, "trigger_entities": [], "condition_entities": [], "locked_count": 0, "unsupported": False,
                 "masked": False, "sensitive_classes": [], "sensitive": False}
        if row.kind == "scene" and row.entity_id:  # a native scene without a readable config: what the state says it sets
            attrs = (ctx.entity(row.entity_id) or {}).get("attributes") or {}
            members = attrs.get("entity_id")
            if isinstance(members, list):
                facts["targets"] = [m for m in members if isinstance(m, str)]
        return None, facts
    rd = drafts.read(row.kind, row.cfg, ctx.model_ctx(code_view=code_view, scoped=scoped))
    return rd, scope.facts_of(ctx, row.kind, rd, entity_id=row.entity_id)


def row_visible(ctx: scope.Ctx, row: Row, facts: dict[str, Any]) -> bool:
    return scope.visible(ctx, row.kind, facts, source=row.source, entity_id=row.entity_id)


# ================================================================ one item

def _name_of_row(ctx: scope.Ctx, row: Row, rd: dict[str, Any] | None) -> str:
    if rd is not None:
        n = rd["draft"].get("name") if row.kind == "scene" else rd["draft"].get("alias")
        if n:
            return n
    ent = ctx.entity(row.entity_id) if row.entity_id else None
    return (ent["name"] if ent else None) or (row.config_id or row.item_id)


def _state_of(ctx: scope.Ctx, row: Row) -> str:
    if row.kind == "scene":
        return "scene"
    ent = ctx.entity(row.entity_id) if row.entity_id else None
    if ent is None:
        return "unavailable"
    if ent["state"] in ("unavailable", None):
        return "invalid" if row.cfg is not None and row.kind == "automation" else "unavailable"
    if row.kind == "script":
        cur = ent["attributes"].get("current")
        return "running" if (ent["state"] == "on" or (isinstance(cur, (int, float)) and cur > 0)) else "off"
    return "on" if ent["state"] == "on" else "off"


def _target_entry(ctx: scope.Ctx, e: str, facts: dict[str, Any]) -> dict[str, Any]:
    info = ctx.entity(e)
    sens = next((s["sens"] for s in facts["steps"] if e == s["entity_id"] and s.get("sens")), None)
    return {"entity_id": e, "name": info["name"] if info else e, "floor": info["floor_name"] if info else None, "area": info["area_name"] if info else None,
            "class": sens or DOMAIN_CLASS.get(e.split(".", 1)[0]), "sensitive": bool(sens), "missing": info is None}


def _last_run(ctx: scope.Ctx, row: Row, summary: dict[str, Any] | None, state: str) -> dict[str, Any] | None:
    ent = ctx.entity(row.entity_id) if row.entity_id else None
    if state == "running":
        return {"at": (ent or {}).get("last_changed") or "", "result": "running"}
    at = summary["last_at"] if summary else None
    result = (summary or {}).get("last_result")
    lt = (ent or {}).get("attributes", {}).get("last_triggered")
    if isinstance(lt, str) and lt:
        try:
            lt_iso = iso_utc(parse_utc(lt))
        except ValueError:
            lt_iso = None
        if lt_iso and (at is None or lt_iso > at):
            at, result = lt_iso, None
    if not at:
        return None
    return {"at": at, "result": result if result in ("ok", "error", "stopped", "running", "not_triggered") else "ok"}


def drift_set(conn: sqlite3.Connection) -> set[tuple[str, str]]:
    """Items whose latest version was seen outside Arx (and that have more than the baseline version): the chip "שונתה מחוץ למערכת"."""
    rows = conn.execute("SELECT v.kind, v.item_id FROM automation_versions v JOIN (SELECT kind, item_id, MAX(id) mid, COUNT(*) c FROM automation_versions GROUP BY kind, item_id) m "
                        "ON v.id = m.mid WHERE m.c > 1 AND v.via = 'external'").fetchall()
    return {(r["kind"], r["item_id"]) for r in rows}


def storm_set(conn: sqlite3.Connection, ctx: scope.Ctx) -> set[tuple[str, str]]:
    since = iso_utc(store.MIRROR.now() - dt.timedelta(minutes=1))
    lim = ctx.limits["storm_item_per_min"]
    return {(r["kind"], r["item_id"]) for r in conn.execute("SELECT kind, item_id, COUNT(*) c FROM automation_runs WHERE at >= ? GROUP BY kind, item_id HAVING c > ?", (since, lim)).fetchall()}


class Env:
    """Things every row of one request shares (computed once)."""

    def __init__(self, ctx: scope.Ctx) -> None:
        self.ctx = ctx
        self.now = store.MIRROR.now()
        self.runs = store.runs_summary(ctx.conn, self.now)
        self.drift = drift_set(ctx.conn)
        self.storms = storm_set(ctx.conn, ctx)
        self.runtime_block = tr.write_block(ctx.conn, ctx.cfg)
        self.edit_block = ctx.write_block()
        self.code_view = ctx.code_view_allowed()
        self._cycles: dict[tuple[str, str], list[str]] | None = None
        self.tz = zone(ctx.tz_name)

    def cycles(self) -> dict[tuple[str, str], list[str]]:
        """§9.4: item -> the other items it forms an automation cycle with (trigger entity <- action target graph over every automation of the installation)."""
        if self._cycles is None:
            graph: dict[str, dict[str, Any]] = {}
            mctx = self.ctx.model_ctx(code_view=False, scoped=False)
            for r in store.cache_rows(self.ctx.conn):
                cfg = store.row_config(r)
                if r["kind"] != "automation" or cfg is None:
                    continue
                d = model.config_to_draft("automation", cfg, mctx).draft
                graph[r["item_id"]] = {"entity_id": r["entity_id"], "watches": set(model.trigger_entities(d)), "drives": set(model.draft_targets(d))}
            out: dict[tuple[str, str], list[str]] = {}
            for cyc in pol.find_cycles(graph):
                for item in cyc:
                    out.setdefault(("automation", item), cyc)
            self._cycles = out
        return self._cycles


def can_and_reasons(ctx: scope.Ctx, env: Env, row: Row, rd: dict[str, Any] | None, facts: dict[str, Any]) -> tuple[dict[str, bool], list[dict[str, Any]]]:
    """(`can`, the read-only reasons) of one item for the caller (§2.3)."""
    reasons: list[dict[str, Any]] = []
    kind = row.kind
    editable_source = row.source == "ui" and rd is not None and not rd.get("unsupported")
    if kind == "scene" and row.source == "integration":
        reasons.append(scope.reason("integration_scene"))
    elif row.source == "yaml":
        reasons.append(scope.reason(row.reason or "yaml_managed"))
    elif rd is None:
        reasons.append(scope.reason("ha_unavailable"))
    elif rd.get("unsupported"):
        reasons.append(scope.reason("unsupported_content"))
    if editable_source:
        if env.edit_block:
            reasons.append(scope.reason(scope.WRITE_BLOCK_REASON[env.edit_block]))
        reasons.extend(scope.change_reasons(ctx, kind, facts, facts))
    edit = not reasons
    run_ok = False
    toggle_ok = False
    if env.runtime_block is None and (row.config_id is not None or kind == "scene"):
        rr = scope.run_reasons(ctx, kind, facts, entity_id=row.entity_id, source=row.source)
        run_ok = not rr and (kind != "scene" or bool(row.entity_id))
        toggle_ok = kind == "automation" and run_ok
    delete_ok = bool(editable_source and env.edit_block is None and not scope.change_reasons(ctx, kind, facts, None))
    code_ok = False
    if env.code_view and rd is not None:
        ents = facts["targets"]
        a = ctx.access
        code_ok = a.wide(scope.CODE_VIEW) or (bool(ents) and all(a.allowed(scope.CODE_VIEW, e) for e in ents))
    can = {"edit": edit, "code_view": code_ok, "toggle": toggle_ok, "run": run_ok, "delete": delete_ok, "copy": edit and not (kind == "scene" and row.source == "integration")}
    shown = [{k: v for k, v in r.items() if not k.startswith("_") and k != "path"} for r in reasons]
    return can, shown


def build_item(ctx: scope.Ctx, env: Env, row: Row, *, rd: dict[str, Any] | None, facts: dict[str, Any], detail: bool = False) -> dict[str, Any]:
    """One `Item` for the caller (the caller has already established visibility)."""
    state = _state_of(ctx, row)
    ent = ctx.entity(row.entity_id) if row.entity_id else None
    targets = [_target_entry(ctx, e, facts) for e in facts["targets"]]
    floors = list({t["floor"]: {"id": (ctx.entity(t["entity_id"]) or {}).get("floor_id") or t["floor"], "name": t["floor"]} for t in targets if t["floor"]}.values())
    areas = list({t["area"]: {"id": (ctx.entity(t["entity_id"]) or {}).get("area_id") or t["area"], "name": t["area"]} for t in targets if t["area"]}.values())
    can, reasons = can_and_reasons(ctx, env, row, rd, facts)
    draft = rd["draft"] if rd is not None else None
    warnings: list[dict[str, str]] = []
    missing = [e for e in facts["targets"] + facts["trigger_entities"] + facts["condition_entities"] if ctx.entity(e) is None]
    if missing:
        warnings.append({"code": "missing_entity", "message": f"מכשיר חסר: {missing[0]}"})
    if state == "invalid":
        warnings.append({"code": "invalid_config", "message": "לא פעילה – שגיאה בהגדרה"})
    if row.key in env.drift:
        warnings.append({"code": "changed_outside", "message": "שונתה מחוץ למערכת"})
    if row.key in env.storms:
        warnings.append({"code": "storm", "message": "רצה בתדירות גבוהה מאוד"})
    if facts["unknown_effects"]:
        warnings.append({"code": "unknown_effects", "message": "לפריט פעולות שאינן ידועות מראש"})
    if facts["sensitive"]:
        warnings.append({"code": "sensitive", "message": "פעולה רגישה"})
    if rd is not None and row.kind == "automation":
        if pol.self_trigger(facts["trigger_entities"], [s["entity_id"] for s in facts["steps"] if s["role"] == "device"], guarded=bool(rd["draft"]["conditions"])):
            warnings.append({"code": "self_trigger", "message": "פעולה משנה התקן שגם מפעיל את האוטומציה"})
        if row.key in env.cycles():
            warnings.append({"code": "cycle", "message": "מעגל בין אוטומציות"})
        if detail and suggest_schedule_for(ctx, rd) is not None:
            warnings.append({"code": "suggest_schedule", "message": "אפשר ליצור כתזמון"})
    meta = row.meta
    owner = None
    if meta is not None and (meta["updated_by"] or meta["created_by"]):
        name = meta["updated_by_username"] or meta["created_by_username"] or ""
        owner = {"display_name": name}
    summary = env.runs.get(row.key)
    item: dict[str, Any] = {
        "kind": row.kind, "id": row.item_id, "config_id": row.config_id, "entity_id": row.entity_id,
        "name": _name_of_row(ctx, row, rd), "description": (draft or {}).get("description") or "", "icon": (draft or {}).get("icon") or ((ent or {}).get("attributes") or {}).get("icon"),
        "source": row.source, "state": state, "sentence": rd["sentence"] if rd is not None else "", "floors": floors, "areas": areas, "targets": targets,
        "sensitive": facts["sensitive"], "sensitive_classes": facts["sensitive_classes"], "locked_count": facts["locked_count"], "unknown_effects": facts["unknown_effects"],
        "mode": (draft or {}).get("mode") if row.kind != "scene" else None, "extras": rd["extras"] if rd is not None else [], "labels": [], "category": None,
        "last_run": _last_run(ctx, row, summary, state) if row.kind != "scene" else None, "runs_7d": (summary["n7"] if summary else 0) if row.kind != "scene" else None,
        "created_via": (meta["created_via"] if meta is not None else "external"), "owner": owner, "updated_at": (meta["updated_at"] if meta is not None and meta["updated_at"] else row.changed_at),
        "revision": row.revision, "pinned": bool(row.pref["pinned"]) if row.pref is not None else False, "favourite": bool(row.pref["favourite"]) if row.pref is not None else False,
        "hidden": bool(meta["hidden"]) if meta is not None else False, "can": can, "read_only": None if can["edit"] else {"reasons": reasons}, "warnings": warnings,
    }
    return item


def detail_item(ctx: scope.Ctx, env: Env, row: Row, rd: dict[str, Any] | None, facts: dict[str, Any]) -> dict[str, Any]:
    """`ItemDetail`: the item plus the draft (blocks, per-caller locking), the version count, and - for a caller with the code view - the config."""
    item = build_item(ctx, env, row, rd=rd, facts=facts, detail=True)
    code_view = bool(item["can"]["code_view"])
    mctx = ctx.model_ctx(code_view=code_view)
    if rd is not None and code_view:
        rd = drafts.read(row.kind, row.cfg, mctx)  # raw content (masked) and template text only for the code view
    item["draft"] = drafts.present(rd["draft"], code_view=code_view, mctx=mctx, can_watch=ctx.can_watch if ctx.principal is not None and row.kind == "automation" else None) if rd is not None else None
    item["versions"] = ctx.conn.execute("SELECT COUNT(*) FROM automation_versions WHERE kind = ? AND item_id = ?", row.key).fetchone()[0]
    item["trash_restore_of"] = None
    if code_view and row.cfg is not None:
        item["config"] = model.to_new_schema(row.kind, row.cfg, mctx)
        item["config_masked"] = row.masked
    else:
        item["config"] = None
        item["config_masked"] = False
    if row.kind == "automation" and rd is not None:
        item["suggest_schedule"] = suggest_schedule_for(ctx, rd)
    return item


# ================================================================ the CR-014 suggestion (§5)

def suggest_schedule_for(ctx: scope.Ctx, rd: dict[str, Any]) -> dict[str, Any] | None:
    """`{schedule_draft}` - a pre-filled CR-014 draft for a time / sun triggered automation of plain device control (a suggestion, never a refusal) - or None
    (no scheduler component, or the content is not expressible as a schedule)."""
    if not ctx.scheduler_present() or rd.get("kind") != "automation":
        return None
    return pol.suggest_schedule(rd["draft"], scheduler_present=True, shabbat_sensor=ctx.shabbat_sensor or None, class_of=ctx.entity_class)


# ================================================================ lists

def visible_rows(ctx: scope.Ctx, kinds: tuple[str, ...] = pol.ITEM_KINDS) -> list[tuple[Row, dict[str, Any] | None, dict[str, Any]]]:
    out = []
    for row in load_rows(ctx, kinds):
        if not scope.holds_any(ctx, row.kind):
            continue
        rd, facts = analyse_row(ctx, row)
        if row_visible(ctx, row, facts):
            out.append((row, rd, facts))
    return out


def matches(item: dict[str, Any], f: dict[str, Any], ctx: scope.Ctx, row: Row) -> bool:
    if f.get("q"):
        needle = f["q"].casefold()
        hay = " ".join([item["name"], item["description"], *(t["name"] for t in item["targets"])]).casefold()
        if needle not in hay:
            return False
    if f.get("floor") and not any(fl["id"] == f["floor"] or fl["name"] == f["floor"] for fl in item["floors"]):
        return False
    if f.get("area") and not any(a["id"] == f["area"] or a["name"] == f["area"] for a in item["areas"]):
        return False
    if f.get("state") and item["state"] != f["state"]:
        return False
    if f.get("sensitive") is not None and bool(item["sensitive"]) != bool(f["sensitive"]):
        return False
    if f.get("source") and item["source"] != f["source"]:
        return False
    if f.get("mine") and not (row.meta is not None and (row.meta["created_by"] == ctx.principal.user_id or row.meta["updated_by"] == ctx.principal.user_id)):
        return False
    if f.get("label") and f["label"] not in item["labels"]:
        return False
    if f.get("category") and item["category"] != f["category"]:
        return False
    return True


def sort_key(sort: str):
    if sort == "name":
        return lambda i: (i["name"] or "").casefold()
    return lambda i: i["name"].casefold()


def list_payload(ctx: scope.Ctx, f: dict[str, Any], sort: str, limit: int, offset: int) -> dict[str, Any]:
    env = Env(ctx)
    items: list[dict[str, Any]] = []
    kinds = (f["kind"],) if f.get("kind") else pol.ITEM_KINDS
    hidden_scenes_ok = ctx.access.anywhere(scope.MANAGE) or authorize(ctx.conn, ctx.principal, "system.configure", INSTALLATION).allowed
    for row, rd, facts in visible_rows(ctx, kinds):
        if row.meta is not None and row.meta["hidden"] and row.kind == "scene" and not hidden_scenes_ok and not f.get("hidden"):
            continue
        item = build_item(ctx, env, row, rd=rd, facts=facts)
        if matches(item, f, ctx, row):
            items.append(item)
    if sort == "name":
        items.sort(key=lambda i: (not i["pinned"], i["name"].casefold()))
    elif sort == "updated":
        items.sort(key=lambda i: i["updated_at"] or "", reverse=True)
    else:  # last run first (never-run last), pinned first
        items.sort(key=lambda i: i["last_run"]["at"] if i["last_run"] else "", reverse=True)
        items.sort(key=lambda i: not i["pinned"])
    total = len(items)
    st = tr.mirror_state(ctx.conn)
    avail = tr.availability(ctx.conn, ctx.cfg)
    return {"items": items[offset:offset + limit], "total": total, "offset": offset, "limit": limit, "status": {"available": avail, "stale": is_stale(ctx, avail, st), "last_sync_at": st.get("last_sync_at")}}


def is_stale(ctx: scope.Ctx, avail: str, st: dict[str, Any]) -> bool:
    if avail in ("ha_unavailable", "error", "not_configured"):
        return True
    if st.get("last_sync_at") is None:
        return ctx.cfg["automations.enabled"] == "true" and avail != "feature_disabled"
    last = store._parse(st["last_sync_at"])
    return bool(last and (store.MIRROR.now() - last).total_seconds() > store.STALE_AFTER_S)


def get_item(ctx: scope.Ctx, kind: str, item_id: str) -> tuple[Row, dict[str, Any] | None, dict[str, Any]]:
    """The cached item the caller may see, else 404 `item_not_found` (invisible = unknown)."""
    r = store.cache_row(ctx.conn, kind, item_id)
    if r is None or not scope.holds_any(ctx, kind):
        raise ApiError(404, "item_not_found", "הפריט לא נמצא.")
    meta = store.meta_rows(ctx.conn).get((kind, item_id))
    pref = ctx.conn.execute("SELECT * FROM automation_prefs WHERE user_id = ? AND kind = ? AND item_id = ?", (ctx.principal.user_id, kind, item_id)).fetchone()
    row = Row(r, meta, pref)
    ctx.preload([row.entity_id] if row.entity_id else [])
    rd, facts = analyse_row(ctx, row)
    if not row_visible(ctx, row, facts):
        raise ApiError(404, "item_not_found", "הפריט לא נמצא.")
    return row, rd, facts


# ================================================================ status

def status_payload(conn: sqlite3.Connection, principal: Principal) -> dict[str, Any]:
    ctx = scope.Ctx(conn, principal)
    a = ctx.access
    cfg = ctx.cfg
    avail = tr.availability(conn, cfg)
    st = tr.mirror_state(conn)
    can = {"view": a.any_of((scope.VIEW, scope.MANAGE, scope.SCENE_MANAGE, scope.SCRIPT_RUN, scope.SCRIPT_MANAGE)), "manage": a.anywhere(scope.MANAGE), "scene_manage": a.anywhere(scope.SCENE_MANAGE),
           "script_run": a.anywhere(scope.SCRIPT_RUN), "script_manage": a.anywhere(scope.SCRIPT_MANAGE), "code_view": ctx.code_view_allowed(),
           "configure": authorize(conn, principal, "system.configure", INSTALLATION).allowed}
    block = tr.write_block(conn, cfg)
    if block is None and not ctx.ha_admin and not ctx.delegation_on:
        block = "delegation_off"
    if block == "config_api_unavailable":
        block = "ha_unavailable"
    writable = block is None
    counts: dict[str, Any] = {"automations": 0, "scripts": 0, "scenes": 0, "running": 0, "attention": 0, "hidden": None}
    can_see = can["view"] or a.any_of(("ha.entity.control", "devices.control"))
    if can_see and avail not in ("feature_disabled", "not_configured"):
        env = Env(ctx)
        total_rows = len(store.cache_rows(conn))
        shown = 0
        for row, rd, facts in visible_rows(ctx):
            shown += 1
            counts[{"automation": "automations", "script": "scripts", "scene": "scenes"}[row.kind]] += 1
            item = build_item(ctx, env, row, rd=rd, facts=facts)
            if item["state"] == "running":
                counts["running"] += 1
            if any(w["code"] in ("invalid_config", "missing_entity", "changed_outside", "storm") for w in item["warnings"]):
                counts["attention"] += 1
        if can["configure"]:
            counts["hidden"] = total_rows - shown
    out: dict[str, Any] = {
        "available": avail, "stale": is_stale(ctx, avail, st), "last_sync_at": st.get("last_sync_at"), "writable": writable, "write_block": block, "scheduler_present": ctx.scheduler_present(),
        "can": can, "delegation": {"on": ctx.delegation_on, "needed": not ctx.ha_admin},
        "ui": {"sensitive_warning": cfg["automations.sensitive_warning"] == "true", "ask_when_on_new": cfg["automations.ask_when_on_new"] == "true",
               "templates_enabled": cfg["automations.templates_enabled"] == "true", "phone_filter": cfg["automations.phone_filter"], "sensitive_chip": cfg["automations.sensitive_chip"]},
        "counts": counts,
    }
    if can["configure"]:
        out["admin"] = {"ha_version": ha_sync.STATE.ha_version or st.get("ha_version") or "", "bridge_version": get_setting(conn, "bridge.integration_version") or None, "bridge_required": tr.BRIDGE_REQUIRED,
                        "delegation_changed_at": ctx.delegation_changed_at(), "caller_is_ha_admin": ctx.ha_admin, "config_api": "unavailable" if st.get("config_api") == "unavailable" else "ok",
                        "authoring_block_reason": st.get("authoring_block")}
    return out


# ================================================================ catalog and templates

CATALOG_DOMAINS = ("light", "switch", "cover", "climate", "fan", "humidifier", "media_player", "lock", "alarm_control_panel", "siren", "button", "number", "input_number", "select", "input_select",
                   "input_boolean", "vacuum", "binary_sensor", "sensor", "person", "sun", "scene", "script", "automation", "zone", "timer")
READ_DOMAINS = ("binary_sensor", "sensor", "person", "sun", "zone", "timer", "device_tracker")
CATALOG_LIMIT = 2000


def action_specs(ctx: scope.Ctx) -> dict[str, list[dict[str, Any]]]:
    """The closed service table (§9.1) by service domain, as the builder offers it: label, role, sensitivity and typed arguments - the device services, the
    scene / script / automation calls, and the notify targets the administrator approved."""
    out: dict[str, list[dict[str, Any]]] = {}

    def add(action: str, role: str) -> None:
        out.setdefault(action.split(".", 1)[0], []).append({"action": action, "label": text.action_label(action) if action in text.ACTION_VERBS else action.split(".", 1)[1].replace("_", " "),
                                                            "role": role, "sensitive": pol.sensitive_class_of(action) is not None, "args": pol.arg_specs_for_catalog(action, role)})

    for action in pol.BUILDER_ACTIONS:
        add(action, "device")
    for action, spec in pol.ROLE_ACTIONS.items():
        add(action, spec["role"])
    for action in ctx.notify_targets:
        add(action, "notify")
    return out


def catalog_payload(ctx: scope.Ctx, q: str | None, floor: str | None, area: str | None, cls: str | None) -> dict[str, Any]:
    """`GET /automations/catalog` - the pickable entities of the caller's reach (with the typed triggers and the action ids each supports), the closed service table
    with argument specs, notify targets, scenes and scripts with their fields, floors and areas, the Shabbat sensor."""
    a = ctx.access
    ents: list[dict[str, Any]] = []
    needle = (q or "").casefold()
    rows = ctx.conn.execute(f"SELECT entity_id FROM ha_entities WHERE removed_at IS NULL AND domain IN ({','.join('?' * len(CATALOG_DOMAINS))}) ORDER BY entity_id", list(CATALOG_DOMAINS)).fetchall()
    ctx.preload([r[0] for r in rows])
    floors: dict[str, dict[str, Any]] = {}
    areas: dict[str, dict[str, Any]] = {}
    specs = action_specs(ctx)
    by_domain: dict[str, list[str]] = {}
    for dom_specs in specs.values():
        for sp in dom_specs:
            if sp["role"] == "device":
                by_domain.setdefault(sp["action"].split(".", 1)[0], []).append(sp["action"])
    for r in rows:
        e = r[0]
        info = ctx.entity(e)
        if info is None or not a.can_read_state(e):
            continue
        if needle and needle not in info["name"].casefold() and needle not in e:
            continue
        if floor and info["floor_id"] != floor and info["floor_name"] != floor:
            continue
        if area and info["area_id"] != area and info["area_name"] != area:
            continue
        domain = e.split(".", 1)[0]
        sens = ctx.entity_class(e)
        if cls and (sens or DOMAIN_CLASS.get(domain, domain)) != cls:
            continue
        controllable = domain not in READ_DOMAINS and (a.control(e) or (domain == "alarm_control_panel" and (a.allowed("alarm.arm", e, own=True) or a.allowed("alarm.disarm", e, own=True))))
        if info["floor_id"]:
            floors[info["floor_id"]] = {"id": info["floor_id"], "name": info["floor_name"] or info["floor_id"]}
        if info["area_id"]:
            areas[info["area_id"]] = {"id": info["area_id"], "name": info["area_name"] or info["area_id"], "floor": info["floor_id"]}
        numeric = domain in ("sensor", "number", "input_number", "climate") or (info["state"] or "").replace(".", "", 1).lstrip("-").isdigit()
        ents.append({"entity_id": e, "name": info["name"], "domain": domain, "floor": {"id": info["floor_id"], "name": info["floor_name"]} if info["floor_id"] else None,
                     "area": {"id": info["area_id"], "name": info["area_name"]} if info["area_id"] else None, "class": sens, "state": info["state"], "missing": False,
                     "triggers": ["state", "numeric_state"] if numeric else ["state"], "actions": by_domain.get(domain, []) if controllable else []})
        if len(ents) >= CATALOG_LIMIT:
            break
    scenes, scripts = [], []
    for row, rd, facts in visible_rows(ctx, ("scene", "script")):
        ent = ctx.entity(row.entity_id) if row.entity_id else None
        if row.kind == "scene":
            scenes.append({"entity_id": row.entity_id, "name": _name_of_row(ctx, row, rd), "area": (ent or {}).get("area_name"), "integration": row.source == "integration"})
        else:
            fields = [{"key": f["key"], "name": f["name"], "required": f["required"], "default": f.get("default"), "selector": f["selector"]} for f in (rd["draft"]["fields"] if rd else [])]
            scripts.append({"entity_id": row.entity_id, "name": _name_of_row(ctx, row, rd), "fields": fields})
    return {"entities": ents, "actions": specs, "notify_targets": [{"action": t, "name": ctx.notify_name(t) or t} for t in ctx.notify_targets], "scenes": scenes,
            "scripts": scripts, "floors": sorted(floors.values(), key=lambda f: f["name"]), "areas": sorted(areas.values(), key=lambda x: x["name"]), "shabbat_sensor": ctx.shabbat_sensor or None,
            "allowed_actions": sorted(a for dom in specs.values() for a in (sp["action"] for sp in dom))}


def template_defs(ctx: scope.Ctx) -> list[dict[str, Any]]:
    """§4.2.4: the gallery - pre-filled drafts (read through the model, so they are exactly what the builder would hold) with the pickers left empty. Nothing is
    saved without review. A template whose notify step needs an approved target uses the first one; without any, that step is shown locked."""
    notify = ctx.notify_targets[0] if ctx.notify_targets else "notify.notify"

    def dur(m: int) -> dict[str, int]:
        return {"hours": 0, "minutes": m, "seconds": 0}

    def svc(action: str, ids: list[str] | None = None, **data: Any) -> dict[str, Any]:
        out: dict[str, Any] = {"action": action}
        if ids is not None:
            out["target"] = {"entity_id": ids}
        if data:
            out["data"] = data
        return out

    def st(ids: list[str], to: str, **kw: Any) -> dict[str, Any]:
        return {"trigger": "state", "entity_id": ids, "to": to, **kw}

    T = [
        ("motion_light", "תאורה בתנועה", "mdi:motion-sensor", "מדליק כשיש תנועה ומכבה אחרי כמה דקות בלי תנועה", False,
         {"triggers": [st([], "on")], "actions": [svc("light.turn_on", [], brightness_pct=40), {"delay": dur(5)}, svc("light.turn_off", [])], "mode": "restart"}),
        ("door_open_notify", "דלת או חלון פתוחים זמן רב", "mdi:door-open", "התראה כשדלת או חלון פתוחים יותר מכמה דקות", False,
         {"triggers": [st([], "on", **{"for": dur(5)})], "actions": [svc(notify, None, message="הדלת פתוחה")]}),
        ("leaving_home", "יציאה מהבית", "mdi:exit-run", "כשכולם יצאו: כיבוי תאורה ומיזוג (דריכת אזעקה אפשרית)", False,
         {"triggers": [{"trigger": "numeric_state", "entity_id": ["zone.home"], "below": 1, "for": dur(2)}], "actions": [svc("light.turn_off", []), svc("climate.turn_off", [])]}),
        ("arrive_after_sunset", "הגעה אחרי השקיעה", "mdi:home-import-outline", "מדליק תאורת כניסה כשמישהו מגיע אחרי השקיעה", False,
         {"triggers": [st([], "home")], "conditions": [{"condition": "sun", "after": "sunset"}], "actions": [svc("light.turn_on", [])]}),
        ("water_leak", "נזילת מים", "mdi:water-alert", "התראה כשחיישן נזילה מזהה מים", False,
         {"triggers": [st([], "on")], "actions": [svc(notify, None, message="זוהתה נזילת מים")]}),
        ("lights_at_sunset", "תאורה בשקיעה", "mdi:weather-sunset", "מדליק תאורה בשקיעה", True,
         {"triggers": [{"trigger": "sun", "event": "sunset"}], "actions": [svc("light.turn_on", [])]}),
        ("ac_by_clock", "מזגן לפי שעות", "mdi:air-conditioner", "מפעיל מזגן בשעה קבועה בימים נבחרים", True,
         {"triggers": [{"trigger": "time", "at": "07:00:00"}], "conditions": [{"condition": "time", "weekday": ["sun", "mon", "tue", "wed", "thu"]}],
          "actions": [svc("climate.set_temperature", [], temperature=24, hvac_mode="cool")]}),
    ]
    mctx = ctx.model_ctx(code_view=False, scoped=False)
    out = []
    for tid, name, icon, desc, time_only, cfg in T:
        draft = model.config_to_draft("automation", {"alias": name, "description": "", "conditions": [], "mode": "single", **cfg}, mctx).draft
        out.append({"id": tid, "name": name, "icon": icon, "description": desc, "target": "automation", "time_only": time_only, "draft": draft})
    return out


def templates_payload(ctx: scope.Ctx) -> dict[str, Any]:
    hidden = set(ctx.cfg["automations.templates_hidden"])
    order = {t: i for i, t in enumerate(ctx.cfg["automations.templates_order"])}
    items = [t for t in template_defs(ctx) if t["id"] not in hidden] if ctx.cfg["automations.templates_enabled"] == "true" else []
    items.sort(key=lambda t: order.get(t["id"], 1000))
    out = []
    for t in items:
        tt = {k: v for k, v in t.items() if k != "time_only"}
        tt["suggest_schedule"] = bool(t["time_only"]) and ctx.scheduler_present()
        tt["sensitive"] = bool(model.sensitive_classes(t["draft"], ctx.entity_class))
        out.append(tt)
    return {"templates": out}


# ================================================================ dry run and capture

def evaluate_condition(c: dict[str, Any], ctx: scope.Ctx, now: dt.datetime, tz: Any) -> bool | None:
    """The current truth of one typed condition from the mirror; None = cannot be decided here (templates, trigger ids, offsets)."""
    kind = c.get("type")
    if c.get("kind") == "locked":
        return None
    if kind in ("state", "numeric_state"):
        results = []
        for e in c["entity_ids"]:
            info = ctx.entity(e)
            if info is None or info["state"] in (None, "unavailable", "unknown"):
                results.append(False)
                continue
            if kind == "state":
                states = c["state"] if isinstance(c["state"], list) else [c["state"]]
                results.append(info["state"] in states)
            else:
                try:
                    v = float(info["state"])
                except (TypeError, ValueError):
                    results.append(False)
                    continue
                results.append((c.get("above") is None or v > c["above"]) and (c.get("below") is None or v < c["below"]))
        return all(results) if results else None
    if kind == "shabbat":
        info = ctx.entity(ctx.shabbat_sensor) if ctx.shabbat_sensor else None
        if info is None or info["state"] in (None, "unavailable"):
            return None
        return (info["state"] == "on") == (c["mode"] == "only_holy_days")
    if kind == "time":
        local = now.astimezone(tz)
        ok = True
        if c.get("weekday"):
            ok = ok and pol.WEEKDAYS[local.weekday()] in c["weekday"]
        t = local.hour * 3600 + local.minute * 60 + local.second

        def secs(v: str) -> int:
            p = [int(x) for x in v.split(":")]
            return p[0] * 3600 + p[1] * 60 + (p[2] if len(p) > 2 else 0)

        a, b = (secs(c["after"]) if c.get("after") else None), (secs(c["before"]) if c.get("before") else None)
        if a is not None and b is not None:
            ok = ok and ((a <= t < b) if a <= b else (t >= a or t < b))
        elif a is not None:
            ok = ok and t >= a
        elif b is not None:
            ok = ok and t < b
        return ok
    if kind == "sun":
        info = ctx.entity("sun.sun")
        if info is None or info["state"] not in ("above_horizon", "below_horizon"):
            return None
        above = info["state"] == "above_horizon"
        a, b = c.get("after"), c.get("before")
        if a and not b:
            return above if a == "sunrise" else (not above)
        if b and not a:
            return (not above) if b == "sunrise" else above
        return None
    if kind in ("and", "or", "not"):
        vals = [evaluate_condition(k, ctx, now, tz) for k in c.get("conditions") or []]
        if kind == "not":
            return None if any(v is None for v in vals) else not any(vals)
        if kind == "and":
            return False if any(v is False for v in vals) else (None if any(v is None for v in vals) else True)
        return True if any(v is True for v in vals) else (None if any(v is None for v in vals) else False)
    return None


EXPECT_TO = {sid: a.get("expect") for sid, a in ha_bridge.ACTIONS.items()}


def dry_run(ctx: scope.Ctx, row: Row, rd: dict[str, Any] | None, facts: dict[str, Any]) -> dict[str, Any]:
    """§4.2.5 "בדיקה": no execution. The current truth of each typed condition from the mirror (template conditions: "לא ניתן לבדוק") and the device diff the
    actions would make."""
    now = store.MIRROR.now()
    tz = zone(ctx.tz_name)
    conds: list[dict[str, Any]] = []
    effects: list[dict[str, Any]] = []
    unknown = bool(facts["unknown_effects"])
    if rd is not None and row.kind == "automation":
        for i, c in enumerate(rd["draft"]["conditions"]):
            passed = evaluate_condition(c, ctx, now, tz)
            conds.append({"path": f"conditions.{i}", "sentence": c["sentence"] if c["kind"] == "typed" else "לא ניתן לבדוק", "passed": passed})
    if rd is not None and row.kind != "scene":
        for w in model.walk_draft(rd["draft"]):
            b = w.block
            if w.section == "action" and b.get("kind") == "typed" and b.get("type") == "service" and b["role"] == "device":
                for e in b["entity_ids"]:
                    info = ctx.entity(e)
                    to = EXPECT_TO.get(b["action"])
                    effects.append({"entity_id": e, "name": info["name"] if info else e, "floor": info["floor_name"] if info else None, "area": info["area_name"] if info else None,
                                    "from": info["state"] if info else None, "to": to})
    elif rd is not None:
        for m in rd["draft"]["members"]:
            info = ctx.entity(m["entity_id"])
            effects.append({"entity_id": m["entity_id"], "name": info["name"] if info else m["entity_id"], "floor": info["floor_name"] if info else None, "area": info["area_name"] if info else None,
                            "from": info["state"] if info else None, "to": m["state"]})
    return {"conditions": conds, "effects": {"entities": effects, "unknown": unknown}}


CAPTURE_DOMAINS = ("light", "switch", "fan", "cover", "climate", "media_player", "lock")


def capture_member(info: dict[str, Any]) -> dict[str, Any] | None:
    """§4.3: one scene member out of a mirrored entity - the per-domain attributes only (never the whole attribute set)."""
    domain = info["domain"]
    attrs = info["attributes"]
    state = info["state"]
    if domain not in CAPTURE_DOMAINS or state in (None, "unavailable", "unknown"):
        return None
    out: dict[str, Any] = {}

    def keep(*keys: str) -> None:
        for k in keys:
            v = attrs.get(k)
            if isinstance(v, (str, bool)) or (isinstance(v, (int, float)) and not isinstance(v, bool)) or (isinstance(v, list) and v and all(isinstance(x, (int, float)) and not isinstance(x, bool) for x in v)):
                out[k] = v

    if domain == "light":
        if state == "on":
            keep("brightness")
            mode = attrs.get("color_mode")
            if mode == "color_temp":
                keep("color_temp_kelvin")
            elif mode in ("hs", "rgb", "xy", "rgbw", "rgbww"):
                keep({"hs": "hs_color", "rgb": "rgb_color", "xy": "xy_color", "rgbw": "rgbw_color", "rgbww": "rgbww_color"}[mode])
            if isinstance(mode, str):
                out["color_mode"] = mode
    elif domain == "fan":
        if state == "on":
            keep("percentage")
    elif domain == "cover":
        keep("current_position", "current_tilt_position")
    elif domain == "climate":
        keep("temperature", "fan_mode", "preset_mode")
        if state in ("heat", "cool", "heat_cool", "auto", "dry", "fan_only", "off"):
            pass
    elif domain == "media_player":
        keep("volume_level", "source")
    return {"entity_id": info["entity_id"], "state": str(state), "attributes": out}


def capture(ctx: scope.Ctx, entity_ids: list[str]) -> list[dict[str, Any]]:
    """`POST /automations/scene/capture` data: the members of the selected entities as their states are now. Entities the caller may not control, and
    domains that cannot be captured (an alarm panel needs a code, which is never stored), are refused by the caller of this function."""
    ctx.preload(entity_ids)
    out = []
    for e in entity_ids:
        info = ctx.entity(e)
        m = capture_member(info) if info is not None else None
        if m is not None:
            out.append(m)
    return out
