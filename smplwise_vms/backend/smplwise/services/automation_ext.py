"""KAV079-295: the extension of the existing schedules / automations editors ("הרחבת הקברניט", mockup r079, owner answers 358-366).

Everything here is OFF until the administrator turns it on in הגדרות › אוטומציות; nothing changes for an installation that never does.

1. Wall buttons (owner 361: in the first version, 362: a button + press already used by another item is a WARNING by default) - the
   typed `button` trigger itself is in automation_model.py / wall_buttons.py; here: the devices the picker offers, one device's buttons
   (Home Assistant's own trigger list, read-only), which presses other items already use, and "detect by pressing" (a time-limited
   `subscribe_trigger` on the live session - a subscription, never a write).
2. Pre-save checks (owner 365: conflicts between ALL items, schedule / automation against schedule / automation): opposite actions on the
   same device inside the conflict window, a device that is not available now, a button already used. They are WARNINGS the save may
   override ("שמירה עם אזהרות", its own switch); an error always blocks. The list's "התנגשות אפשרית" filter and chips use the same engine.
3. The on-device test (owner 359: ask at the end by default, 360: whoever may edit AND run the item may test it, no new permission): the
   server answers the plan (the device steps, their current states, a snapshot); every step is then sent by the client through the
   ordinary device-control route (the same permission, grant and confirmation rules as a manual action today), and the restore plan
   turns the snapshot back into device actions of the same route.
4. "Who is in the building" (owner 364: as drawn, Wi-Fi only in server mode): the typed `presence` condition is a `state` condition on
   the configured entity (`automations.presence_entity`, the Shabbat pattern); the sources shown are the site's presence sources.
5. Critical sound (owner 363: allowed only for the safety event types enabled in הגדרות › התראות): the notify step's `critical` flag is
   accepted only when the automation is triggered by a safety sensor whose notification source is enabled.

Pure helpers first (unit-tested without a database), then the request-time functions (a `scope.Ctx`)."""
from __future__ import annotations

import asyncio
import concurrent.futures
import json
import re
import sqlite3
import threading
import time
from dataclasses import dataclass
from typing import Any, Callable, Iterable, Mapping

from . import automation_model as model
from . import automation_settings as aset
from . import wall_buttons as wb

# ================================================================ settings

def _on(cfg: Mapping[str, Any], key: str) -> bool:
    return str(cfg.get(key, aset.DEFAULTS.get(key, "false"))) == "true"


def _int(cfg: Mapping[str, Any], key: str) -> int:
    return int(aset.stored(key, cfg.get(key, aset.DEFAULTS[key])))


def _enum(cfg: Mapping[str, Any], key: str) -> str:
    return str(aset.stored(key, cfg.get(key, aset.DEFAULTS[key])))


def precheck_on(cfg: Mapping[str, Any]) -> bool:
    return _on(cfg, "automations.precheck_enabled")


def flags(cfg: Mapping[str, Any]) -> dict[str, Any]:
    """What the editors need to know (echoed in `status.ui.ext` and the catalogue's `extension`)."""
    return {
        "wall_buttons": _on(cfg, "automations.wall_buttons_editable"),
        "wall_timing": {"double_ms": _int(cfg, "automations.wall_double_ms"), "long_ms": _int(cfg, "automations.wall_long_ms"),
                        "debounce_ms": _int(cfg, "automations.wall_debounce_ms"), "listen_s": _int(cfg, "automations.wall_listen_s")},
        "precheck": precheck_on(cfg),
        "conflict_window_min": _int(cfg, "automations.conflict_window_min"),
        "save_with_warnings": _on(cfg, "automations.save_with_warnings"),
        "button_reuse": _enum(cfg, "automations.button_reuse"),
        "device_test": _on(cfg, "automations.device_test_enabled"),
        "device_test_end": _enum(cfg, "automations.device_test_end"),
        "presence": bool(cfg.get("automations.presence_entity")),
        "bridge_required": BRIDGE_KAV_REQUIRED,
    }


# ================================================================ polarity of a device action (pure)

_ON = {"light.turn_on", "switch.turn_on", "fan.turn_on", "media_player.turn_on", "climate.turn_on", "climate.set_temperature", "cover.open_cover",
       "input_boolean.turn_on", "water_heater.turn_on", "humidifier.turn_on", "siren.turn_on", "valve.open_valve", "vacuum.start"}
_OFF = {"light.turn_off", "switch.turn_off", "fan.turn_off", "media_player.turn_off", "climate.turn_off", "cover.close_cover", "input_boolean.turn_off",
        "water_heater.turn_off", "humidifier.turn_off", "siren.turn_off", "valve.close_valve", "vacuum.return_to_base"}


def polarity(service: str, data: Mapping[str, Any] | None = None) -> str | None:
    """'on' / 'off' for a service that switches a device one way, None for anything else (a toggle, a volume, a scene ...)."""
    d = data or {}
    if service == "climate.set_hvac_mode":
        mode = d.get("hvac_mode")
        return None if not isinstance(mode, str) else "off" if mode == "off" else "on"
    if service == "cover.set_cover_position":
        pos = d.get("position")
        return None if not isinstance(pos, (int, float)) or isinstance(pos, bool) else "off" if pos <= 0 else "on"
    if service == "light.turn_on" and d.get("brightness_pct") == 0:
        return "off"
    if service in _ON:
        return "on"
    if service in _OFF:
        return "off"
    return None


# ================================================================ timed events and conflicts (pure)

ALL_DAYS = frozenset(("sun", "mon", "tue", "wed", "thu", "fri", "sat"))


@dataclass(frozen=True)
class Ev:
    kind: str  # automation | schedule
    item_id: str
    name: str
    entity_id: str
    minute: int  # minute of the day, 0..1439
    days: frozenset[str]
    pol: str  # on | off
    path: str  # the block (or slot) the event comes from


def _minutes(t: Any) -> int | None:
    m = re.match(r"^(\d{1,2}):(\d{2})(?::(\d{2}))?$", t) if isinstance(t, str) else None
    if not m:
        return None
    h, mi = int(m.group(1)), int(m.group(2))
    return h * 60 + mi if h < 24 and mi < 60 else None


def _dur_min(d: Mapping[str, Any] | None) -> int:
    d = d or {}
    try:
        return int(round(float(d.get("hours") or 0) * 60 + float(d.get("minutes") or 0) + float(d.get("seconds") or 0) / 60))
    except (TypeError, ValueError):
        return 0


def _trigger_ids_of(conds: Iterable[Mapping[str, Any]]) -> set[str] | None:
    """The trigger ids a branch is restricted to (a `trigger` condition), None = no such restriction."""
    ids: set[str] = set()
    found = False
    for c in conds:
        if c.get("kind") == "typed" and c.get("type") == "trigger":
            found = True
            ids.update(i for i in c.get("ids") or [] if isinstance(i, str))
    return ids if found else None


def automation_events(draft: Mapping[str, Any], item_id: str, name: str) -> list[Ev]:
    """The device switches an automation makes at a fixed time: each typed `time` trigger x each device step it reaches (a `choose` /
    `if` branch restricted by "the trigger is ..." reaches only those triggers; a delay before a step moves it later)."""
    trig: list[tuple[str | None, int, str]] = []
    for i, t in enumerate(draft.get("triggers") or []):
        if t.get("kind") == "typed" and t.get("type") == "time":
            m = _minutes(t.get("at"))
            if m is not None:
                trig.append((t.get("id"), m, f"triggers.{i}"))
    if not trig:
        return []
    days = ALL_DAYS
    for c in draft.get("conditions") or []:
        if c.get("kind") == "typed" and c.get("type") == "time" and c.get("weekday"):
            days = days & frozenset(c["weekday"])
    out: list[Ev] = []

    def walk(blocks: list[Mapping[str, Any]], ts: list[tuple[str | None, int, str]], offset: int, prefix: str) -> int:
        for i, b in enumerate(blocks):
            path = f"{prefix}.{i}"
            if b.get("kind") != "typed" or not ts:
                continue
            t = b.get("type")
            if t == "delay":
                offset += _dur_min(b.get("delay"))
            elif t == "service" and b.get("role") == "device":
                p = polarity(b.get("action") or "", b.get("data"))
                if p:
                    for e in b.get("entity_ids") or []:
                        for _tid, m, _tp in ts:
                            out.append(Ev("automation", item_id, name, e, (m + offset) % 1440, days, p, path))
            elif t == "choose":
                taken: set[str | None] = set()
                for oi, o in enumerate(b.get("options") or []):
                    ids = _trigger_ids_of(o.get("conditions") or [])
                    sub = ts if ids is None else [x for x in ts if x[0] in ids]
                    if ids is not None:
                        taken.update(x[0] for x in sub)
                    walk(o.get("sequence") or [], sub, offset, f"{path}.choose.{oi}.sequence")
                if b.get("default"):
                    walk(b["default"], [x for x in ts if x[0] not in taken], offset, f"{path}.default")
            elif t == "if":
                ids = _trigger_ids_of(b.get("conditions") or [])
                walk(b.get("then") or [], ts if ids is None else [x for x in ts if x[0] in ids], offset, f"{path}.then")
                if b.get("else"):
                    walk(b["else"], ts if ids is None else [x for x in ts if x[0] not in ids], offset, f"{path}.else")
            elif t == "repeat_count":
                walk(b.get("sequence") or [], ts, offset, f"{path}.repeat.sequence")
        return offset

    walk(list(draft.get("actions") or []), trig, 0, "actions")
    return out


def schedule_events(core: Mapping[str, Any], item_id: str, name: str) -> list[Ev]:
    """The device switches of a schedule (the normalised core of schedule_model.normalize): each slot's actions at its fixed start time."""
    from . import schedule_model as smodel

    if core.get("enabled") is False:
        return []
    resolved = smodel.resolve_days(list(core.get("weekdays") or ["daily"]))
    days = frozenset(resolved) if resolved else ALL_DAYS  # workday / weekend: unknown here, treated as every day (a warning, never a refusal)
    out: list[Ev] = []
    for sl in core.get("slots") or []:
        start = sl.get("start") or {}
        if start.get("kind") != "fixed":
            continue
        m = _minutes(start.get("time"))
        if m is None:
            continue
        for a in sl.get("actions") or []:
            p = polarity(a.get("service") or "", a.get("data"))
            if p and a.get("entity_id"):
                out.append(Ev("schedule", item_id, name, a["entity_id"], m, days, p, f"slots.{sl.get('index', 0)}"))
    return out


def schedule_draft_core(draft: Mapping[str, Any]) -> dict[str, Any]:
    """A schedule DRAFT of the editor (§2.2 shape: weekdays, slots[{start, stop, actions[{service, entity_id, data}]}]) as a normalised core."""
    from . import schedule_model as smodel

    item = {"weekdays": draft.get("weekdays") or ["daily"], "enabled": True,
            "timeslots": [{"start": s.get("start"), "stop": s.get("stop"), "actions": [{"service": a.get("service"), "entity_id": a.get("entity_id"), "service_data": a.get("data") or {}}
                                                                               for a in (s.get("actions") or []) if isinstance(a, dict)]}
                          for s in (draft.get("slots") or []) if isinstance(s, dict)]}
    return smodel.normalize(item)


def _delta(a: int, b: int) -> int:
    d = abs(a - b) % 1440
    return min(d, 1440 - d)


def find_conflicts(mine: list[Ev], others: list[Ev], window_min: int) -> list[dict[str, Any]]:
    """Opposite switches of the same device, on a common day, at most `window_min` minutes apart, between DIFFERENT items. One row per
    (event of mine, other item, entity) - the nearest of the other item's events."""
    by_entity: dict[str, list[Ev]] = {}
    for o in others:
        by_entity.setdefault(o.entity_id, []).append(o)
    best: dict[tuple[str, str, str, str, int], tuple[int, Ev, Ev]] = {}
    for m in mine:
        for o in by_entity.get(m.entity_id, []):
            if (o.kind, o.item_id) == (m.kind, m.item_id) or o.pol == m.pol or not (o.days & m.days):
                continue
            d = _delta(m.minute, o.minute)
            if d > window_min:
                continue
            key = (o.kind, o.item_id, m.entity_id, m.path, m.minute)
            if key not in best or d < best[key][0]:
                best[key] = (d, m, o)
    out = []
    for d, m, o in sorted(best.values(), key=lambda x: (x[0], x[1].path, x[2].name)):
        out.append({"other": {"kind": o.kind, "id": o.item_id, "name": o.name}, "entity_id": m.entity_id, "mine_at": _clock(m.minute), "other_at": _clock(o.minute),
                    "delta_min": d, "mine": m.pol, "theirs": o.pol, "path": m.path, "other_path": o.path})
    return out


def _clock(m: int) -> str:
    return f"{m // 60:02d}:{m % 60:02d}"


def conflict_text(c: Mapping[str, Any], entity_name: str, window_min: int, *, mine_kind: str = "automation") -> tuple[str, str]:
    """(title, detail) in Hebrew, as drawn: "התנגשות עם התזמון ״X״" / "התזמון מכבה את Y ב־21:55, וכאן הוא נדלק ב־22:00: ..."."""
    other = c["other"]
    noun = "התזמון" if other["kind"] == "schedule" else "האוטומציה"
    fem = other["kind"] == "automation"
    verb_other = ("מדליקה" if fem else "מדליק") if c["theirs"] == "on" else ("מכבה")
    here = "נדלק" if c["mine"] == "on" else "נכבה"
    title = f"התנגשות עם {noun} ״{other['name']}״"
    detail = (f"{noun} {verb_other} את {entity_name} ב־{c['other_at']}, וכאן הוא {here} ב־{c['mine_at']}: פעולות הפוכות בהפרש של {c['delta_min']} דקות, "
              f"בתוך חלון של {window_min} דקות.")
    return title, detail


# ================================================================ wall buttons: presses in use (pure over drafts)

def button_keys(draft: Mapping[str, Any]) -> list[tuple[str, str]]:
    """(key, trigger path) of every button press an automation draft uses (typed `button` blocks and locked device triggers of the same shape)."""
    out: list[tuple[str, str]] = []
    for i, t in enumerate(draft.get("triggers") or []):
        if t.get("kind") == "typed" and t.get("type") == "button":
            ha_type = wb.type_for(str(t.get("ha_type") or ""), str(t.get("press") or "")) or t.get("ha_type")
            ha_sub = wb.subtype_for(str(t.get("ha_subtype") or ""), int(t["button"])) if isinstance(t.get("button"), int) else t.get("ha_subtype")
            if isinstance(t.get("device_id"), str) and ha_type and ha_sub:
                out.append((wb.key_of(t["device_id"], str(ha_sub), str(ha_type)), f"triggers.{i}"))
        elif t.get("kind") == "locked" and isinstance(t.get("raw"), dict) and wb.is_button_trigger(t["raw"]):
            r = t["raw"]
            out.append((wb.key_of(r["device_id"], r["subtype"], r["type"]), f"triggers.{i}"))
    return out


# ================================================================ request time (a scope.Ctx)

def _other_automations(ctx: Any, exclude_id: str | None) -> list[tuple[str, str, dict[str, Any]]]:
    """(id, name, draft) of the automations the caller may see, except `exclude_id`."""
    from . import automation_view as view

    out = []
    for row, rd, _facts in view.visible_rows(ctx, ("automation",)):
        if rd is None or row.item_id == exclude_id:
            continue
        out.append((row.item_id, rd["draft"].get("alias") or row.item_id, rd["draft"]))
    return out


def _visible_schedules(ctx: Any, exclude_id: str | None = None) -> list[tuple[str, str, dict[str, Any]]]:
    """(id, name, core) of the schedules the caller may see (the schedules screen's own visibility); nothing when that feature is off."""
    try:
        from . import schedule_view as sview

        sctx = sview.Ctx(ctx.conn, ctx.principal)
        rows, _n = sview.visible_rows(sctx)
    except Exception:  # noqa: BLE001 - the schedules module off / unavailable: no schedule takes part
        return []
    return [(r.core["id"], r.core.get("name") or str(r.core["id"]), r.core) for r in rows if r.core.get("id") and r.core["id"] != exclude_id]


def others_events(ctx: Any, *, exclude: tuple[str, str] | None = None) -> list[Ev]:
    ex_auto = exclude[1] if exclude and exclude[0] == "automation" else None
    ex_sched = exclude[1] if exclude and exclude[0] == "schedule" else None
    evs: list[Ev] = []
    for iid, name, d in _other_automations(ctx, ex_auto):
        evs.extend(automation_events(d, iid, name))
    for sid, name, core in _visible_schedules(ctx, ex_sched):
        evs.extend(schedule_events(core, sid, name))
    return evs


def conflicts_for(ctx: Any, source: str, item_id: str | None, draft: Mapping[str, Any]) -> list[dict[str, Any]]:
    """The conflicts of one draft (an automation or a schedule) against every other item the caller may see, with the Hebrew lines."""
    window = _int(ctx.cfg, "automations.conflict_window_min")
    me = item_id or "__draft__"
    if source == "schedule":
        mine = schedule_events(schedule_draft_core(draft), me, "")
    else:
        mine = automation_events(draft, me, "")
    if not mine:
        return []
    rows = find_conflicts(mine, others_events(ctx, exclude=(source, item_id) if item_id else None), window)
    for c in rows:
        title, detail = conflict_text(c, ctx.name_of(c["entity_id"]) if ctx.access.can_read_state(c["entity_id"]) else c["entity_id"], window, mine_kind=source)
        c["title"], c["detail"], c["window_min"] = title, detail, window
    return rows


def conflict_summary(ctx: Any) -> dict[str, Any]:
    """Per visible item, how many possible conflicts it has (the list's "התנגשות אפשרית" filter and chips). One pass over every event."""
    window = _int(ctx.cfg, "automations.conflict_window_min")
    evs: list[Ev] = []
    for iid, name, d in _other_automations(ctx, None):
        evs.extend(automation_events(d, iid, name))
    for sid, name, core in _visible_schedules(ctx):
        evs.extend(schedule_events(core, sid, name))
    counts: dict[tuple[str, str], set[tuple[str, str, str]]] = {}
    by_item: dict[tuple[str, str], list[Ev]] = {}
    for e in evs:
        by_item.setdefault((e.kind, e.item_id), []).append(e)
    for key, mine in by_item.items():
        for c in find_conflicts(mine, evs, window):
            counts.setdefault(key, set()).add((c["other"]["kind"], c["other"]["id"], c["entity_id"]))
    return {"window_min": window, "items": [{"kind": k[0], "id": k[1], "count": len(v)} for k, v in sorted(counts.items())]}


def button_usage(ctx: Any, exclude_id: str | None) -> dict[str, list[dict[str, str]]]:
    """key -> the other automations (the caller may see) that use that press."""
    out: dict[str, list[dict[str, str]]] = {}
    for iid, name, d in _other_automations(ctx, exclude_id):
        for key, _p in button_keys(d):
            out.setdefault(key, []).append({"id": iid, "name": name})
    return out


def _reuse_issues(ctx: Any, draft: Mapping[str, Any], item_id: str | None) -> list[dict[str, Any]]:
    keys = button_keys(draft)
    if not keys:
        return []
    used = button_usage(ctx, item_id)
    out = []
    for key, path in keys:
        if key in used:
            who = used[key][0]["name"]
            out.append({"path": path, "code": "button_in_use", "message": f"הכפתור והלחיצה כבר מפעילים את ״{who}״",
                        "detail": "אותה לחיצה תפעיל את שני הפריטים.", "other": used[key][0]})
    return out


def precheck_warnings(ctx: Any, draft: Mapping[str, Any], item_id: str | None) -> list[dict[str, Any]]:
    """The pre-save warnings of an automation draft (the preview appends them while `automations.precheck_enabled` is on)."""
    out: list[dict[str, Any]] = []
    for c in conflicts_for(ctx, "automation", item_id, draft):
        out.append({"path": c["path"], "code": "conflict", "message": c["title"], "detail": c["detail"], "other": c["other"], "delta_min": c["delta_min"]})
    if _enum(ctx.cfg, "automations.button_reuse") != "error":
        out.extend(_reuse_issues(ctx, draft, item_id))
    for w in model.walk_draft(draft):
        b = w.block
        if w.section != "action" or b.get("kind") != "typed" or b.get("type") != "service" or b.get("role") != "device":
            continue
        for e in b.get("entity_ids") or []:
            info = ctx.entity(e)
            if info is not None and not info["available"] and ctx.access.can_read_state(e):
                out.append({"path": w.path, "code": "device_unavailable", "message": f"{info['name']} לא זמין כרגע",
                            "detail": "השמירה אפשרית; הפעולה תיכשל אם ההתקן לא יחזור."})
                break
    return out


# ---------------------------------------------------------------- errors of a draft (both the preview and the save)

def _device_entities(conn: sqlite3.Connection, device_id: str) -> list[str]:
    return [r[0] for r in conn.execute("SELECT entity_id FROM ha_entities WHERE device_id = ? AND removed_at IS NULL", (device_id,)).fetchall()]


def device_reachable(ctx: Any, device_id: str) -> bool:
    """A wall switch is the caller's when they manage automations installation-wide or for one of the device's own entities."""
    from . import automation_scope as scope

    a = ctx.access
    if a.wide(scope.MANAGE):
        return True
    return any(a.allowed(scope.MANAGE, e) for e in _device_entities(ctx.conn, device_id))


SAFETY_TRIGGER_TEXT = "צליל קריטי מותר רק לאירועי בטיחות שהופעלו בהגדרות › התראות"
# The first bridge whose closed schema accepts a wall-button press and the critical-sound payload (custom_components/smplwise_bridge/config_policy.py,
# KAV079-295). The release that ships this change bumps the bridge to this version; an older bridge would refuse such a save as a changed locked part.
BRIDGE_KAV_REQUIRED = "0.10.0"
BRIDGE_TOO_OLD_TEXT = "נדרש עדכון של רכיב החיבור כדי לשמור את החלק הזה"


def bridge_ready(conn: sqlite3.Connection) -> bool:
    from ..db import get_setting
    from . import automation_transport as tr

    return tr.version_tuple(get_setting(conn, "bridge.integration_version")) >= tr.version_tuple(BRIDGE_KAV_REQUIRED)


def safety_sources_of(ctx: Any, draft: Mapping[str, Any]) -> list[str]:
    """The notification sources of the safety sensors that trigger the automation (a leak / smoke / gas / CO sensor, an alarm panel)."""
    from . import notify_sensors

    out: list[str] = []
    for e in model.trigger_entities(draft):
        info = ctx.entity(e)
        if not info:
            continue
        if info["domain"] == "binary_sensor" and (info.get("device_class") or "") in notify_sensors.SAFETY_CLASSES:
            out.append(notify_sensors.SAFETY_CLASSES[info["device_class"]])
        elif info["domain"] == "alarm_control_panel":
            out.append("alarm.triggered")
    return list(dict.fromkeys(out))


def _source_enabled(conn: sqlite3.Connection, source: str) -> bool:
    from . import notify_policy

    row = conn.execute("SELECT enabled FROM notify_policies WHERE source = ?", (source,)).fetchone()
    if row is not None:
        return bool(row["enabled"])
    s = notify_policy.BY_KEY.get(source) if hasattr(notify_policy.BY_KEY, "get") else None
    return bool(s.enabled) if s is not None else False


def critical_allowed(ctx: Any, draft: Mapping[str, Any]) -> dict[str, Any]:
    """Whether a notify step of this automation may carry the critical sound, and which safety event types make it so."""
    srcs = [s for s in safety_sources_of(ctx, draft) if _source_enabled(ctx.conn, s)]
    return {"allowed": bool(srcs), "sources": srcs}


def draft_errors(ctx: Any, kind: str, draft: Mapping[str, Any], item_id: str | None = None) -> list[dict[str, str]]:
    """What the model cannot judge alone: a NEW / CHANGED button trigger on a device outside the caller's reach, a new critical sound that is not
    allowed, and - when the administrator chose "error" for a button already used - that reuse."""
    if kind != "automation":
        return []
    out: list[dict[str, str]] = []
    mctx = model.ModelContext(shabbat_sensor=ctx.shabbat_sensor or None, wall_buttons=ctx.wall_buttons, presence_entity=ctx.presence_entity, presence_sensors=ctx.presence_sensors)
    crit: dict[str, Any] | None = None
    for w in model.walk_draft(draft):
        b = w.block
        if b.get("kind") != "typed":
            continue
        fresh = model.block_changed(b, w.section, mctx)
        if w.section == "trigger" and b.get("type") == "button" and fresh and isinstance(b.get("device_id"), str) and b["device_id"]:
            if ctx.principal is not None and not device_reachable(ctx, b["device_id"]):
                out.append({"path": w.path, "code": "device_not_in_scope", "message": "המפסק אינו בהיקף ההרשאה שלך"})
            elif not bridge_ready(ctx.conn):
                out.append({"path": w.path, "code": "bridge_too_old", "message": BRIDGE_TOO_OLD_TEXT})
        if w.section == "action" and b.get("type") == "service" and b.get("role") == "notify" and b.get("critical") and fresh:
            crit = crit if crit is not None else critical_allowed(ctx, draft)
            if not crit["allowed"]:
                out.append({"path": w.path, "code": "critical_not_allowed", "message": SAFETY_TRIGGER_TEXT})
            elif not bridge_ready(ctx.conn):
                out.append({"path": w.path, "code": "bridge_too_old", "message": BRIDGE_TOO_OLD_TEXT})
    if _enum(ctx.cfg, "automations.button_reuse") == "error" and precheck_on(ctx.cfg):
        for i in _reuse_issues(ctx, draft, item_id):
            out.append({"path": i["path"], "code": "button_in_use", "message": i["message"]})
    return out


# ---------------------------------------------------------------- the picker: wall-button devices and one device's buttons

def wall_devices(ctx: Any) -> list[dict[str, Any]]:
    """The devices the button picker offers: devices with a button `event` entity, and devices a stored automation already presses."""
    conn = ctx.conn
    ids = {r[0] for r in conn.execute(
        "SELECT DISTINCT device_id FROM ha_entities WHERE domain = 'event' AND removed_at IS NULL AND device_id IS NOT NULL AND (device_class IS NULL OR device_class IN ('button', 'doorbell'))").fetchall()}
    for _iid, _name, d in _other_automations(ctx, None):
        for key, _p in button_keys(d):
            ids.add(key.split("|", 1)[0])
    out = []
    for did in sorted(ids):
        r = conn.execute("SELECT d.device_id, COALESCE(NULLIF(d.name_by_user, ''), NULLIF(d.name, '')) AS name, d.area_id, a.name AS area_name, f.name AS floor_name "
                         "FROM ha_devices d LEFT JOIN ha_areas a ON a.area_id = d.area_id LEFT JOIN ha_floors f ON f.floor_id = a.floor_id "
                         "WHERE d.device_id = ? AND d.removed_at IS NULL", (did,)).fetchone()
        if r is None or not device_reachable(ctx, did):
            continue
        out.append({"device_id": did, "name": r["name"] or did, "area": r["area_name"], "floor": r["floor_name"]})
    out.sort(key=lambda x: (x["floor"] or "", x["area"] or "", x["name"]))
    return out


def device_buttons(ctx: Any, device_id: str, item_id: str | None, list_triggers: Callable[[str], list[Any] | None]) -> dict[str, Any]:
    """One device's buttons (Home Assistant's trigger list when it answers, else what stored automations already use) and which presses
    other items use ("בשימוש")."""
    triggers = list_triggers(device_id)
    used = button_usage(ctx, item_id)
    if triggers is None:  # Home Assistant did not answer: the presses stored items already use are all that is known
        triggers = []
        for key in used:
            did, sub, typ = key.split("|", 2)
            if did == device_id:
                triggers.append({"device_id": did, "domain": "", "type": typ, "subtype": sub})
        source = "stored"
    else:
        source = "platform"
    buttons = wb.buttons_from_triggers([{**t, "domain": t.get("domain") or "unknown"} for t in triggers])
    for b in buttons:
        for p in b["presses"]:
            k = wb.key_of(device_id, p["ha_subtype"], p["ha_type"])
            p["used_by"] = used.get(k, [])
        b["used"] = any(p["used_by"] for p in b["presses"])
    return {"device_id": device_id, "buttons": buttons, "source": source}


# ---------------------------------------------------------------- "detect by pressing": a time-limited subscription (never a write)

class Listener:
    """The live session's `subscribe_trigger` for every press of one device; the first that fires wins. Swappable in tests."""

    def listen(self, triggers: list[dict[str, Any]], timeout_s: float) -> dict[str, Any] | None:  # pragma: no cover - needs a live platform
        from . import ha_sync

        sync = ha_sync.SYNC
        loop, call = sync._session_loop, sync._session_call
        if loop is None or call is None or not ha_sync.STATE.connected:
            return None
        hit: dict[str, Any] = {}
        done = threading.Event()

        async def run() -> None:
            subs: dict[int, dict[str, Any]] = {}
            try:
                for t in triggers:
                    cfg = {"trigger": "device", **{k: t[k] for k in ("device_id", "domain", "type", "subtype", "discovery_id") if t.get(k)}}
                    reply = await call("subscribe_trigger", trigger=cfg)
                    if isinstance(reply, dict) and reply.get("success") and isinstance(reply.get("id"), int):
                        subs[reply["id"]] = t
                for sid, t in subs.items():
                    LISTENERS.add(sid, lambda _msg, t=t: (hit.update(t), done.set()))
                await asyncio.get_event_loop().run_in_executor(None, done.wait, timeout_s)
            finally:
                for sid in subs:
                    LISTENERS.drop(sid)
                    try:
                        await call("unsubscribe_events", subscription=sid)
                    except Exception:  # noqa: BLE001
                        pass

        fut = asyncio.run_coroutine_threadsafe(run(), loop)
        try:
            fut.result(timeout=timeout_s + 10)
        except (concurrent.futures.TimeoutError, Exception):  # noqa: BLE001
            fut.cancel()
        return hit or None


class _Registry:
    """Subscription id -> callback, consulted by the live session's message hook (ha_sync.on_message) before anything else."""

    def __init__(self) -> None:
        self._subs: dict[int, Callable[[dict[str, Any]], Any]] = {}
        self._lock = threading.Lock()

    def add(self, sid: int, cb: Callable[[dict[str, Any]], Any]) -> None:
        with self._lock:
            self._subs[sid] = cb

    def drop(self, sid: int) -> None:
        with self._lock:
            self._subs.pop(sid, None)

    def dispatch(self, msg: dict[str, Any]) -> bool:
        if msg.get("type") != "event" or not isinstance(msg.get("id"), int):
            return False
        with self._lock:
            cb = self._subs.get(msg["id"])
        if cb is None:
            return False
        try:
            cb(msg)
        except Exception:  # noqa: BLE001 - a listener's failure never reaches the session
            pass
        return True


LISTENERS = _Registry()
_LISTENER: Listener = Listener()
_ACTIVE: dict[str, float] = {}
_ACTIVE_LOCK = threading.Lock()


def set_listener(listener: Listener | None) -> None:
    global _LISTENER
    _LISTENER = listener or Listener()


def detect_press(ctx: Any, device_id: str, buttons: list[dict[str, Any]]) -> dict[str, Any]:
    """Wait (at most `automations.wall_listen_s`) for one real press of the device; one listen per caller at a time."""
    user = ctx.principal.user_id if ctx.principal is not None else "?"
    with _ACTIVE_LOCK:
        if time.monotonic() - _ACTIVE.get(user, -1e9) < 1:
            from ..errors import ApiError

            raise ApiError(429, "rate_limited", "יותר מדי בקשות ברצף; נסו שוב בעוד רגע.")
        _ACTIVE[user] = time.monotonic()
    timeout = _int(ctx.cfg, "automations.wall_listen_s")
    triggers = [{"device_id": device_id, "domain": p["domain"], "type": p["ha_type"], "subtype": p["ha_subtype"], **({"discovery_id": p["discovery_id"]} if p.get("discovery_id") else {})}
                for b in buttons for p in b["presses"]]
    hit = _LISTENER.listen(triggers, float(timeout)) if triggers else None
    if not hit:
        return {"detected": False, "listen_s": timeout}
    return {"detected": True, "button": wb.button_of(hit.get("subtype")), "press": wb.press_of(hit.get("type")), "ha_type": hit.get("type"), "ha_subtype": hit.get("subtype"),
            "domain": hit.get("domain"), "listen_s": timeout}


# ---------------------------------------------------------------- the on-device test: plan and restore plan

_SNAP_ATTRS = ("brightness", "hvac_mode", "temperature", "current_position", "percentage")


def snapshot_of(info: Mapping[str, Any] | None) -> dict[str, Any] | None:
    if not info:
        return None
    attrs = info.get("attributes") or {}
    return {"entity_id": info["entity_id"], "state": info.get("state"), "attributes": {k: attrs[k] for k in _SNAP_ATTRS if k in attrs}}


def test_plan(ctx: Any, draft: Mapping[str, Any]) -> dict[str, Any]:
    """The device steps of an automation in order (path, sentence, entity, action, data, sensitive, the state now), the snapshot to restore, and
    the button triggers the dialog may listen to."""
    steps = []
    snap: dict[str, Any] = {}
    mctx = ctx.model_ctx(code_view=False, scoped=False, names_scoped=True)
    for w in model.walk_draft(draft):
        b = w.block
        if w.section != "action" or b.get("kind") != "typed" or b.get("type") != "service" or b.get("role") != "device":
            continue
        ents = [e for e in b.get("entity_ids") or [] if ctx.access.can_read_state(e)]
        for e in ents:
            s = snapshot_of(ctx.entity(e))
            if s is not None:
                snap.setdefault(e, s)
        steps.append({"path": w.path, "sentence": model.block_sentence(b, "action", mctx), "action": b.get("action"), "data": b.get("data") or {}, "entity_ids": ents,
                      "sensitive": any(ctx.sens_class(b.get("action") or "", e) for e in ents),
                      "now": [{"entity_id": e, "state": (ctx.entity(e) or {}).get("state")} for e in ents]})
    triggers = [{"path": f"triggers.{i}", "device_id": t.get("device_id"), "button": t.get("button"), "press": t.get("press"), "sentence": model.block_sentence(t, "trigger", mctx)}
                for i, t in enumerate(draft.get("triggers") or []) if t.get("kind") == "typed" and t.get("type") == "button"]
    return {"steps": steps, "snapshot": list(snap.values()), "triggers": triggers, "end": _enum(ctx.cfg, "automations.device_test_end")}


def schedule_test_plan(ctx: Any, draft: Mapping[str, Any], may_manage: Callable[[str], bool] | None = None) -> dict[str, Any]:
    """KAVDEVTEST-295: the device steps of a schedule DRAFT, in the shape of `test_plan` so the same dialog runs them. A slot action is a device
    step when its service is one of the device-control route's allow-listed action ids (`ha_bridge.ACTIONS`) and its entity matches that action's
    domain; the client sends each step through that route, with its own permission and confirmation rules. Nothing is sent from here. An action
    that cannot be a step (an unknown service, no entity, an entity the caller may not read) is listed with no entities, so the dialog shows it
    and its button stays disabled."""
    from . import ha_bridge

    core = schedule_draft_core(draft)
    ctx.preload([a["entity_id"] for sl in core["slots"] for a in sl["actions"] if a.get("entity_id")])
    steps: list[dict[str, Any]] = []
    snap: dict[str, Any] = {}
    for sl in core["slots"]:
        when = (sl.get("start") or {}).get("time") or ""
        for ai, a in enumerate(sl["actions"]):
            spec = ha_bridge.ACTIONS.get(a.get("service") or "")
            eid = a.get("entity_id")
            testable = bool(spec and spec.get("route") is None and eid and eid.split(".", 1)[0] == spec.get("entity_domain", spec["domain"]) and ctx.access.can_read_state(eid) and (may_manage is None or may_manage(eid)))
            if testable:
                try:
                    _spec, cleaned = ha_bridge.validate_action(a["service"], eid, {k: v for k, v in (a.get("data") or {}).items() if k in spec["args"]})
                except Exception:  # noqa: BLE001 - an invalid argument set is shown but never offered
                    testable, cleaned = False, {}
            else:
                cleaned = {}
            name = ctx.name_of(eid) if eid and ctx.access.can_read_state(eid) else (eid or "")
            label = spec["label"] if spec else (a.get("service") or "")
            if testable:
                s = snapshot_of(ctx.entity(eid))
                if s is not None:
                    snap.setdefault(eid, s)
            steps.append({"path": f"slots.{sl['index']}.actions.{ai}", "sentence": f"{when} · {label} · {name}".strip(" ·"), "action": a.get("service"),
                          "data": {k: v for k, v in cleaned.items() if k != "entity_id"} if testable else {}, "entity_ids": [eid] if testable else [],
                          "sensitive": bool(testable and (spec["sensitive"] or ctx.sens_class(a["service"], eid))),
                          "now": [{"entity_id": eid, "state": (ctx.entity(eid) or {}).get("state")}] if testable else []})
    return {"steps": steps, "snapshot": list(snap.values()), "triggers": [], "end": _enum(ctx.cfg, "automations.device_test_end")}


def restore_actions(snapshot: list[Mapping[str, Any]], current: Callable[[str], Mapping[str, Any] | None]) -> list[dict[str, Any]]:
    """Device actions (ids of the device-control route's allow-list) that put each snapshot entity back where it was; nothing for one that is
    already there. Pure: `current(entity_id)` gives the mirror's state now."""
    from . import ha_bridge

    out: list[dict[str, Any]] = []

    def add(eid: str, aid: str, args: dict[str, Any] | None = None) -> None:
        spec = ha_bridge.ACTIONS.get(aid)
        if spec is None or eid.split(".", 1)[0] != spec.get("entity_domain", spec["domain"]):
            return
        a = {k: v for k, v in (args or {}).items() if k in spec["args"]}
        out.append({"entity_id": eid, "action": aid, "arguments": a, "sensitive": bool(spec["sensitive"])})

    for s in snapshot:
        eid = s.get("entity_id")
        if not isinstance(eid, str) or "." not in eid:
            continue
        now = current(eid) or {}
        was, attrs = s.get("state"), s.get("attributes") or {}
        if was in (None, "unavailable", "unknown"):
            continue
        dom = eid.split(".", 1)[0]
        if dom == "light":
            if was == "off" and now.get("state") != "off":
                add(eid, "light.turn_off")
            elif was == "on":
                br = attrs.get("brightness")
                pct = max(1, min(100, round(br / 255 * 100))) if isinstance(br, (int, float)) and not isinstance(br, bool) else None
                if now.get("state") != "on" or (pct is not None and (now.get("attributes") or {}).get("brightness") != br):
                    add(eid, "light.turn_on", {"brightness_pct": pct} if pct else None)
        elif dom == "climate":
            if now.get("state") != was:
                add(eid, "climate.set_hvac_mode", {"hvac_mode": was})
            t = attrs.get("temperature")
            if was != "off" and isinstance(t, (int, float)) and (now.get("attributes") or {}).get("temperature") != t:
                add(eid, "climate.set_temperature", {"temperature": t})
        elif dom == "cover":
            pos = attrs.get("current_position")
            if isinstance(pos, (int, float)) and (now.get("attributes") or {}).get("current_position") != pos:
                add(eid, "cover.set_cover_position", {"position": int(pos)})
            elif pos is None and was in ("open", "closed") and now.get("state") != was:
                add(eid, "cover.open_cover" if was == "open" else "cover.close_cover")
        elif was in ("on", "off") and now.get("state") != was:
            add(eid, f"{dom}.turn_{was}")
    return out


def restore_plan(ctx: Any, snapshot: list[Mapping[str, Any]]) -> list[dict[str, Any]]:
    ents = [s["entity_id"] for s in snapshot if isinstance(s, Mapping) and isinstance(s.get("entity_id"), str)]
    ctx.preload(ents)
    allowed = [s for s in snapshot if isinstance(s, Mapping) and s.get("entity_id") in ents and ctx.access.can_read_state(s["entity_id"])]
    return restore_actions(allowed, lambda e: ctx.entity(e))


# ---------------------------------------------------------------- "who is in the building": the sources the site has

def presence_sources(conn: sqlite3.Connection) -> dict[str, Any]:
    """Which presence sources the site uses (shown on the condition): geofence (sites), beacons, Wi-Fi - only while the server matches networks."""
    from ..db import get_setting

    def j(key: str) -> list[Any]:
        try:
            v = json.loads(get_setting(conn, key) or "[]")
        except ValueError:
            return []
        return v if isinstance(v, list) else []

    mode = get_setting(conn, "presence.wifi_match_mode") or "phone"
    return {"enabled": (get_setting(conn, "presence.enabled") or "false") == "true", "geofence": bool(j("presence.sites")), "beacon": bool(j("presence.beacons")),
            "wifi": bool(j("presence.wifi_sites")) and mode == "server", "wifi_mode": mode}


def catalog_extension(ctx: Any) -> dict[str, Any]:
    """The `extension` block of the editors' catalogue (what the new forms need)."""
    f = flags(ctx.cfg)
    out: dict[str, Any] = {**f}
    if f["presence"]:
        out["presence_sources"] = presence_sources(ctx.conn)
        out["presence_entity"] = ctx.presence_entity
    if ctx.presence_sensors:  # BUILDING-PRESENCE-2271 (additive): the tagged sensors the building-empty trigger / room-occupied condition may name
        out["building_presence"] = {"sensors": list(ctx.presence_sensors)}
    return out
