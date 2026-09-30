"""CR-014 (schedules) - the normalised model, pure (docs/architecture/SCHEDULER_API.md §2, §6.4, §6.5).

No database, no Home Assistant, no request: every function takes what it needs. `normalize(item)` reads the component's
item (V-LIVE shape: `HH:MM:SS` and `sunset+HH:MM:SS` times, a null `stop` for a point action, actions with a null
entity, the same conditions in every slot, `timestamps` / `next_entries`), `classify` judges it against the safety
policy, `to_component_payload` turns a draft back into what the bridge sends (untouched slots verbatim), and
`validate_draft` checks a draft. Instants are UTC ISO-8601 with `Z`; the component's strings are kept as stored."""
from __future__ import annotations

import copy
import datetime as dt
import hashlib
import json
import re
from typing import Any, Callable, Literal, Protocol, Union

from pydantic import BaseModel, ConfigDict, Field, StrictFloat, StrictInt, StrictStr

from . import schedule_policy as policy
from .timeutil import UTC, iso_utc, parse_utc, zone

DAY_ORDER = ["sun", "mon", "tue", "wed", "thu", "fri", "sat"]
DAY_TOKENS = frozenset(DAY_ORDER) | {"daily", "workday", "weekend"}
_PY_WEEKDAY_TO_TOKEN = ["mon", "tue", "wed", "thu", "fri", "sat", "sun"]  # datetime.weekday(): Monday = 0
DAY_LONG = {"sun": "ראשון", "mon": "שני", "tue": "שלישי", "wed": "רביעי", "thu": "חמישי", "fri": "שישי", "sat": "שבת"}

ITEM_KEYS = frozenset({"schedule_id", "entity_id", "name", "enabled", "weekdays", "start_date", "end_date", "repeat_type", "tags", "timeslots", "timestamps", "next_entries"})
SLOT_KEYS = frozenset({"start", "stop", "conditions", "condition_type", "track_conditions", "actions"})
ACTION_KEYS = frozenset({"service", "entity_id", "service_data"})
COND_KEYS = frozenset({"entity_id", "attribute", "value", "match_type"})
REVISION_SKIP = ("timestamps", "next_entries", "enabled", "entity_id")

MATCH_TYPES = ("is", "not", "above", "below")
CONDITION_DOMAINS = frozenset({"binary_sensor", "sensor", "sun", "input_boolean"})
ATTRIBUTE = re.compile(r"^[a-z_][a-z0-9_]{0,63}$")
ENTITY_ID = re.compile(r"^[a-z0-9_]+\.[a-z0-9_]{1,100}$")
DATE = re.compile(r"^\d{4}-\d{2}-\d{2}$")

# caps (§3.19)
MAX_NAME, MAX_SLOTS, MAX_ACTIONS, MAX_CONDITIONS, MAX_ENTITIES, MAX_TAGS, MAX_TAG, MAX_DATA = 80, 48, 20, 10, 50, 10, 40, 8


# ---------------------------------------------------------------- draft (§2.2) - closed pydantic models

class DraftActionModel(BaseModel):
    model_config = ConfigDict(extra="forbid")
    service: StrictStr
    entity_id: StrictStr | None = None
    data: dict[str, Any] = Field(default_factory=dict)


class DraftSlotModel(BaseModel):
    model_config = ConfigDict(extra="forbid")
    start: StrictStr
    stop: StrictStr | None = None
    actions: list[DraftActionModel] = Field(default_factory=list)


class DraftConditionModel(BaseModel):
    model_config = ConfigDict(extra="forbid")
    entity_id: StrictStr
    attribute: StrictStr = "state"
    match_type: Literal["is", "not", "above", "below"] = "is"
    value: Union[StrictStr, StrictInt, StrictFloat]


class DraftConditionsModel(BaseModel):
    model_config = ConfigDict(extra="forbid")
    items: list[DraftConditionModel] = Field(default_factory=list)
    type: Literal["and", "or"] | None = None
    track: bool = False


class ScheduleDraftModel(BaseModel):
    model_config = ConfigDict(extra="forbid")
    name: StrictStr | None = None
    weekdays: list[StrictStr] = Field(default_factory=lambda: ["daily"])
    start_date: StrictStr | None = None
    end_date: StrictStr | None = None
    repeat: Literal["repeat", "pause", "single"] = "repeat"
    tags: list[StrictStr] = Field(default_factory=list)
    conditions: DraftConditionsModel = Field(default_factory=DraftConditionsModel)
    slots: list[DraftSlotModel] = Field(default_factory=list)


# ---------------------------------------------------------------- codes never stored, content fingerprint

def mask_codes(value: Any, depth: int = 0) -> Any:
    """`value` with the value of every code-like key replaced by "***" (keys kept, so the schedule still reads as one that
    carries a code: read-only, never re-sent). What Arx caches or snapshots never holds a code typed in Home Assistant."""
    if depth > 8:
        return value
    if isinstance(value, dict):
        return {k: ("***" if isinstance(k, str) and k.lower() in policy._CODE_KEYS else mask_codes(v, depth + 1)) for k, v in value.items()}
    if isinstance(value, list):
        return [mask_codes(v, depth + 1) for v in value]
    return value


def fingerprint(item: dict[str, Any]) -> str:
    """What identifies a schedule's content (name, days, slots, conditions), from the component's item OR from the payload
    Arx sent: the bridge's answer is trusted only when the schedule it names has this fingerprint (review M2)."""
    core = normalize(item)
    body = {"name": core["name"] or "", "days": sorted(core["weekdays"]), "slots": [_core_slot_form(sl) for sl in core["slots"]],
            "conditions": [core["conditions"]["items"], core["conditions"]["type"], core["conditions"]["track"]]}
    return hashlib.sha256(canonical(body).encode("utf-8")).hexdigest()[:16]


# ---------------------------------------------------------------- revision (§2.5)

def canonical(value: Any) -> str:
    return json.dumps(value, sort_keys=True, separators=(",", ":"), ensure_ascii=False)


def revision(item: dict[str, Any]) -> str:
    """First 16 hex chars of SHA-256 over the canonical JSON of the item minus `timestamps`, `next_entries`, `enabled`,
    `entity_id` - what changes when the definition changes, not when time passes or the switch flips."""
    body = {k: v for k, v in item.items() if k not in REVISION_SKIP}
    return hashlib.sha256(canonical(body).encode("utf-8")).hexdigest()[:16]


# ---------------------------------------------------------------- days

def resolve_days(tokens: list[str]) -> list[str] | None:
    """Explicit days (Sunday first) for `daily` / named days; None when `workday` / `weekend` is involved (P0-1)."""
    if "daily" in tokens:
        return list(DAY_ORDER)
    if "workday" in tokens or "weekend" in tokens:
        return None
    return [d for d in DAY_ORDER if d in tokens]


def days_kind(tokens: list[str]) -> str:
    if "daily" in tokens:
        return "daily"
    named = [t for t in tokens if t in DAY_ORDER]
    if "workday" in tokens:
        return "mixed" if named else "workday"
    if "weekend" in tokens:
        return "mixed" if named else "weekend"
    return "days"


def days_view(tokens: list[str]) -> dict[str, Any]:
    kind = days_kind(tokens)
    return {"tokens": list(tokens), "kind": kind, "days": resolve_days(tokens) if kind in ("days", "daily") else None}


# ---------------------------------------------------------------- normalisation (§6.4)

def _clean_data(service_data: Any) -> tuple[dict[str, Any], bool]:
    """(service_data minus entity_id, whether it carried one)."""
    if not isinstance(service_data, dict):
        return {}, False
    return {k: v for k, v in service_data.items() if k != "entity_id"}, "entity_id" in service_data


def _condition(c: Any) -> dict[str, Any]:
    c = c if isinstance(c, dict) else {}
    return {"entity_id": c.get("entity_id"), "attribute": c.get("attribute") or "state", "match_type": c.get("match_type") or "is", "value": c.get("value")}


def normalize(item: dict[str, Any]) -> dict[str, Any]:
    """The component's item as the `ScheduleCore` the rest of this module reads. Accepts `HH:MM` and `HH:MM:SS`, a `stop`
    that is null or absent, `service_data` that contains `entity_id`, weekday tokens in any order, a missing `tags`."""
    tokens = [t for t in (item.get("weekdays") or []) if isinstance(t, str)]
    tokens = tokens if tokens else ["daily"]
    slots: list[dict[str, Any]] = []
    for index, raw_slot in enumerate(item.get("timeslots") or []):
        raw_slot = raw_slot if isinstance(raw_slot, dict) else {}
        start_raw, stop_raw = raw_slot.get("start"), raw_slot.get("stop")
        start = policy.parse_time(start_raw)
        stop = policy.parse_time(stop_raw) if stop_raw not in (None, "") else None
        issues: list[str] = []
        if start is None:
            issues.append("start")
        if stop_raw not in (None, "") and stop is None:
            issues.append("stop")
        actions = []
        for raw_action in raw_slot.get("actions") or []:
            raw_action = raw_action if isinstance(raw_action, dict) else {}
            data, had_entity = _clean_data(raw_action.get("service_data"))
            actions.append({
                "service": raw_action.get("service") if isinstance(raw_action.get("service"), str) else "",
                "entity_id": raw_action.get("entity_id") if isinstance(raw_action.get("entity_id"), str) and raw_action.get("entity_id") else None,
                "data": data,
                "data_had_entity_id": had_entity,
                "unknown_keys": sorted(str(k) for k in raw_action if k not in ACTION_KEYS),
            })
        conditions = [_condition(c) for c in (raw_slot.get("conditions") or [])]
        slots.append({
            "index": index,
            "start": start or {"kind": "fixed", "time": "00:00", "raw": str(start_raw or ""), "seconds": 0},
            "stop": stop,
            "actions": actions,
            "conditions": conditions,
            "condition_type": raw_slot.get("condition_type"),
            "track": bool(raw_slot.get("track_conditions")),
            "unknown_keys": sorted(str(k) for k in raw_slot if k not in SLOT_KEYS),
            "condition_unknown_keys": sorted({str(k) for c in (raw_slot.get("conditions") or []) if isinstance(c, dict) for k in c if k not in COND_KEYS}),
            "time_issues": issues,
        })
    first = slots[0] if slots else None
    signature = [canonical([s["conditions"], s["condition_type"], s["track"]]) for s in slots]
    uniform = len(set(signature)) <= 1
    return {
        "id": item.get("schedule_id"),
        "entity_id": item.get("entity_id") if isinstance(item.get("entity_id"), str) else None,
        "name": item.get("name") if isinstance(item.get("name"), str) else None,
        "enabled": bool(item.get("enabled", True)),
        "weekdays": tokens,
        "days": days_view(tokens),
        "start_date": item.get("start_date") or None,
        "end_date": item.get("end_date") or None,
        "repeat": item.get("repeat_type") if item.get("repeat_type") in ("repeat", "pause", "single") else "repeat",
        "tags": [t for t in (item.get("tags") or []) if isinstance(t, str)],
        "slots": slots,
        "conditions": {"items": list(first["conditions"]) if first else [], "type": first["condition_type"] if first else None, "track": first["track"] if first else False, "uniform": uniform},
        "timestamps": list(item.get("timestamps") or []),
        "next_entries": [i for i in (item.get("next_entries") or []) if isinstance(i, int)],
        "extra_keys": sorted(str(k) for k in item if k not in ITEM_KEYS),
    }


def action_entities(core: dict[str, Any]) -> list[str]:
    """Distinct action entity ids of a core, in first-seen order."""
    seen: list[str] = []
    for slot in core["slots"]:
        for a in slot["actions"]:
            if a["entity_id"] and a["entity_id"] not in seen:
                seen.append(a["entity_id"])
    return seen


def classify(core: dict[str, Any], resolve: Callable[[str], dict[str, Any] | None]) -> dict[str, Any]:
    """§2.6: judge every action and slot. Returns `{"slots": [{"actions": [...], "supported", "unsupported"}], "understood",
    "sensitive_classes", "sensitive", "lowering"}` - the per-action `supported` / `class` / `sensitive` / `lowering`
    fields of the read model. A schedule is understood only when every slot is (whole-schedule read-only otherwise)."""
    out_slots: list[dict[str, Any]] = []
    classes: list[str] = []
    lowering = False
    base_signature = canonical([core["slots"][0]["conditions"], core["slots"][0]["condition_type"], core["slots"][0]["track"]]) if core["slots"] else ""
    for slot in core["slots"]:
        unsupported: list[dict[str, str]] = []
        actions_out = []
        for ai, a in enumerate(slot["actions"]):
            path = f"slots[{slot['index']}].actions[{ai}]"
            info = resolve(a["entity_id"]) if a["entity_id"] else None
            cls = info["class"] if info else None
            problem: dict[str, str] | None = None
            if policy.contains_code(a["data"]) or policy.contains_code(a["service"]):
                problem = {"code": "contains_code", "message": "הפעולה כוללת קוד השמור בתוך התזמון.", "path": path}
            elif not a["entity_id"]:
                problem = {"code": "action_without_entity", "message": "פעולה ללא התקן (למשל סקריפט).", "path": path}
            elif info is None:
                problem = {"code": "action_not_allowed", "message": "ההתקן אינו מוכר למערכת.", "path": path}
            elif cls is None:
                code = "alarm_managed_control" if info.get("refusal") == "alarm_managed_control" else "action_not_allowed"
                problem = {"code": code, "message": "רכיב זה נשלט ממסך האזעקה." if code == "alarm_managed_control" else "סוג ההתקן אינו מותר בתזמונים.", "path": path}
            elif not policy.service_allowed(cls, a["service"]):
                problem = {"code": "action_not_allowed", "message": "הפעולה אינה מותרת בתזמון.", "path": path}
            else:
                bad, _ = policy.check_arguments(a["service"], a["data"], None, dynamic=False)
                if bad:
                    code = "contains_code" if bad[0]["code"] == "code_not_allowed" else "argument_not_allowed"
                    problem = {"code": code, "message": bad[0]["message"], "path": path}
            if a["unknown_keys"] and problem is None:
                problem = {"code": "unknown_fields", "message": "לפעולה שדות שהמערכת אינה מכירה.", "path": path}
            if problem:
                unsupported.append(problem)
            sensitive = cls in policy.SENSITIVE_CLASSES if cls else False
            low = bool(problem is None and policy.is_lowering(a["service"], cls, a["data"]))
            lowering = lowering or low
            if cls and problem is None:
                classes.append(cls)
            actions_out.append({"service": a["service"], "entity_id": a["entity_id"], "data": dict(a["data"]), "supported": problem is None, "class": cls if problem is None else None,
                                "sensitive": sensitive if problem is None else False, "lowering": low})
        if slot["unknown_keys"] or slot["condition_unknown_keys"] or slot["time_issues"]:
            unsupported.append({"code": "unknown_fields", "message": "במשבצת שדות או זמנים שהמערכת אינה מכירה.", "path": f"slots[{slot['index']}]"})
        sig = canonical([slot["conditions"], slot["condition_type"], slot["track"]])
        if sig != base_signature:
            unsupported.append({"code": "conditions_differ", "message": "תנאים שונים במשבצות שונות.", "path": f"slots[{slot['index']}]"})
        out_slots.append({"actions": actions_out, "supported": not unsupported, "unsupported": unsupported})
    sensitive_classes = [c for c in policy.ALL_CLASSES if c in classes and c in policy.SENSITIVE_CLASSES]
    return {"slots": out_slots, "understood": all(s["supported"] for s in out_slots), "sensitive_classes": sensitive_classes, "sensitive": bool(sensitive_classes), "lowering": lowering}


# ---------------------------------------------------------------- upcoming (§6.5)

def _parse_iso(value: Any) -> dt.datetime | None:
    try:
        return parse_utc(value) if isinstance(value, str) else None
    except ValueError:
        return None


def upcoming(core: dict[str, Any], limit: int = 10) -> list[dict[str, Any]]:
    """The component's own next occurrence of each slot, in upcoming order: `timestamps[next_entries[k]]` (V-LIVE)."""
    stamps = core["timestamps"]
    out: list[dict[str, Any]] = []
    for index in core["next_entries"]:
        if not 0 <= index < len(stamps):
            continue
        at = _parse_iso(stamps[index])
        if at is not None:
            out.append({"at": iso_utc(at), "slot_index": index})
    return out[:limit]


def slot_seconds(spec: dict[str, Any], sun_seconds: dict[str, int] | None) -> int | None:
    """Local seconds since midnight of a time spec; sun times from `sun_seconds` (today's, local), offsets clamped."""
    if spec["kind"] == "fixed":
        return int(spec["seconds"])
    base = (sun_seconds or {}).get(spec["event"])
    if base is None:
        return None
    return max(0, min(86340, base + int(spec.get("offset_seconds", spec["offset_min"] * 60))))  # clamped to 00:00 - 23:59


def next_runs_computed(core: dict[str, Any], now_utc: dt.datetime, tz_name: str, sun_seconds: dict[str, int] | None, count: int = 5) -> list[dict[str, Any]]:
    """Next `count` runs computed by Arx (a draft's preview, or an item without `timestamps`): days from today in the
    installation's zone, day tokens (`workday` / `weekend` are not computed), the dates and `repeat` (`single` / `pause`
    run once); sun times from today's for every future day ("משוער"). Conditions are never evaluated (§6.5)."""
    days = resolve_days(core["weekdays"])
    if not days:
        return []
    tz = zone(tz_name)
    today = now_utc.astimezone(tz).date()
    start = _date(core.get("start_date"))
    end = _date(core.get("end_date"))
    out: list[dict[str, Any]] = []
    for offset in range(0, 400):
        day = today + dt.timedelta(days=offset)
        if start and day < start:
            continue
        if end and day > end:
            break
        if _PY_WEEKDAY_TO_TOKEN[day.weekday()] not in days:
            continue
        for slot in core["slots"]:
            secs = slot_seconds(slot["start"], sun_seconds)
            if secs is None:
                continue
            local = dt.datetime.combine(day, dt.time(secs // 3600, secs % 3600 // 60, secs % 60), tzinfo=tz)
            at = local.astimezone(UTC)
            if at <= now_utc:
                continue
            out.append({"at": iso_utc(at), "slot_index": slot["index"]})
        if len(out) >= count * 2 and offset >= 1:
            break
    out.sort(key=lambda r: (r["at"], r["slot_index"]))
    if core["repeat"] in ("single", "pause"):
        out = out[:1]
    return out[:count]


def _date(value: Any) -> dt.date | None:
    try:
        return dt.date.fromisoformat(value) if isinstance(value, str) and DATE.match(value) else None
    except ValueError:
        return None


def sun_seconds_from(next_rising: Any, next_setting: Any, tz_name: str) -> dict[str, int] | None:
    """Today's sunrise / sunset as local seconds since midnight, from `sun.sun`'s `next_rising` / `next_setting`."""
    tz = zone(tz_name)
    out: dict[str, int] = {}
    for key, value in (("sunrise", next_rising), ("sunset", next_setting)):
        at = _parse_iso(value)
        if at is not None:
            local = at.astimezone(tz)
            out[key] = local.hour * 3600 + local.minute * 60 + local.second
    return out or None


# ---------------------------------------------------------------- conditions (§2.4)

def detect_preset(items: list[dict[str, Any]], sensor: str | None) -> str | None:
    if not sensor or len(items) != 1:
        return None
    c = items[0]
    if c.get("entity_id") != sensor or (c.get("attribute") or "state") != "state" or c.get("match_type") != "is":
        return None
    return {"on": "only_holy_days", "off": "not_holy_days"}.get(c.get("value"))  # type: ignore[arg-type]


PRESET_LABEL = {"only_holy_days": "רק בשבת ובחג", "not_holy_days": "לא בשבת ובחג"}
MATCH_LABEL = {"is": "שווה ל", "not": "שונה מ", "above": "מעל", "below": "מתחת"}


def condition_summary(items: list[dict[str, Any]], ctype: str | None, sensor: str | None, name_of: Callable[[str], str]) -> tuple[str | None, str | None]:
    """(summary, preset): "רק בשבת ובחג" / "לא בשבת ובחג" when the block is one of the presets on the configured
    Shabbat sensor, else "בתנאי: {name} פעיל" parts joined by "או" / "וגם"; (None, None) without conditions."""
    if not items:
        return None, None
    preset = detect_preset(items, sensor)
    if preset:
        return PRESET_LABEL[preset], preset
    parts = []
    for c in items:
        name = name_of(c["entity_id"]) if c.get("entity_id") else ""
        if (c.get("attribute") or "state") == "state" and c.get("value") in ("on", "off"):
            parts.append(f"{name} {'פעיל' if (c.get('match_type') == 'is') == (c.get('value') == 'on') else 'כבוי'}")
        else:
            parts.append(f"{name} {MATCH_LABEL.get(c.get('match_type') or 'is', '')} {c.get('value')}")
    return "בתנאי: " + (" וגם " if ctype == "and" else " או ").join(parts), None


# ---------------------------------------------------------------- draft -> component payload (§8.2)

def _draft_conditions(draft: dict[str, Any]) -> tuple[list[dict[str, Any]], str | None, bool]:
    block = draft.get("conditions") or {}
    items = [{"entity_id": c["entity_id"], "attribute": c.get("attribute") or "state", "value": c["value"], "match_type": c.get("match_type") or "is"} for c in block.get("items") or []]
    ctype = block.get("type") or ("or" if items else None)
    return items, (ctype if items else None), bool(block.get("track")) if items else False


def draft_slot_form(slot: dict[str, Any]) -> dict[str, Any]:
    """A draft slot in canonical stored form (times canonical, actions as the component stores them) - what two slots are
    compared by when deciding whether one was touched."""
    return {
        "start": policy.canonical_time(slot.get("start") or "") or slot.get("start"),
        "stop": (policy.canonical_time(slot["stop"]) or slot["stop"]) if slot.get("stop") else None,
        "actions": [{"service": a["service"], "entity_id": a.get("entity_id"), "service_data": _stored_data(a.get("entity_id"), a.get("data") or {})} for a in slot.get("actions") or []],
    }


def _stored_data(entity_id: str | None, data: dict[str, Any]) -> dict[str, Any]:
    return dict(data)


def _core_slot_form(slot: dict[str, Any]) -> dict[str, Any]:
    return {
        "start": policy.canonical_time(slot["start"]["raw"]) or slot["start"]["raw"],
        "stop": (policy.canonical_time(slot["stop"]["raw"]) or slot["stop"]["raw"]) if slot["stop"] else None,
        "actions": [{"service": a["service"], "entity_id": a["entity_id"], "service_data": dict(a["data"])} for a in slot["actions"]],
    }


def component_slot(raw: dict[str, Any]) -> dict[str, Any]:
    """A slot in the form the component ACCEPTS on write (verified on a real component, 2026-09-30, P0-11): the component
    rejects or crashes on nulls and empties, so `stop` is omitted when null, an action's `entity_id` when null / "",
    `service_data` when empty, and `conditions` / `condition_type` / `track_conditions` when the slot has no conditions
    (`conditions: []` is rejected: "length must be at least 1"; a null `condition_type` too). It reads back as `stop: null`,
    `conditions: []`, `condition_type: null`, `track_conditions: false`, `entity_id: null`, `service_data: {}` - so a slot
    can never be re-sent byte-identical; what holds is round-trip EQUIVALENCE: read -> component_slot -> write -> read is the
    same slot. `raw` is a stored slot or a draft slot in stored form (`start`, `stop`, `conditions`, ..., `actions`)."""
    out: dict[str, Any] = {"start": raw["start"]}
    if raw.get("stop"):
        out["stop"] = raw["stop"]
    conds = []
    for c in raw.get("conditions") or []:
        cond = {"entity_id": c["entity_id"], "match_type": c.get("match_type") or "is", "value": c.get("value")}
        if c.get("attribute"):
            cond["attribute"] = c["attribute"]  # optional on write (null reads back)
        conds.append(cond)
    if conds:
        out["conditions"] = conds
        out["condition_type"] = raw.get("condition_type") or "or"
        out["track_conditions"] = bool(raw.get("track_conditions"))
    actions = []
    for a in raw.get("actions") or []:
        act: dict[str, Any] = {"service": a["service"]}
        if a.get("entity_id"):
            act["entity_id"] = a["entity_id"]
        if a.get("service_data"):
            act["service_data"] = copy.deepcopy(a["service_data"])
        actions.append(act)
    out["actions"] = actions
    return out


def to_component_payload(draft: dict[str, Any], current_item: dict[str, Any] | None, *, tags_supported: bool | None = None) -> dict[str, Any]:
    """The payload the bridge sends the component (verified forms, see `component_slot`). Create (`current_item` None): the
    fields that are set. Edit: only the changed top-level fields, `timeslots` whole when any slot or the conditions changed
    (untouched slots re-sent in their equivalent write form) - and, whenever anything is sent, ALWAYS `start_date` and
    `end_date` (current values or null): an edit that omits them resets both to null, even a name-only edit (verified). Tags
    replace (`[]` clears). The schedule's conditions are copied into EVERY slot that has any."""
    if tags_supported is None:
        tags_supported = policy.CAPABILITIES["tags"]
    cond_items, cond_type, cond_track = _draft_conditions(draft)
    weekdays = list(dict.fromkeys(draft.get("weekdays") or ["daily"]))
    name = draft.get("name") or ""

    def build_slot(slot: dict[str, Any]) -> dict[str, Any]:
        form = draft_slot_form(slot)
        return component_slot({"start": form["start"], "stop": form["stop"], "conditions": cond_items, "condition_type": cond_type, "track_conditions": cond_track, "actions": form["actions"]})

    if current_item is None:
        payload: dict[str, Any] = {"weekdays": weekdays, "timeslots": [build_slot(s) for s in draft.get("slots") or []], "repeat_type": draft.get("repeat") or "repeat", "name": name}
        if draft.get("start_date"):
            payload["start_date"] = draft["start_date"]
        if draft.get("end_date"):
            payload["end_date"] = draft["end_date"]
        if tags_supported and draft.get("tags"):
            payload["tags"] = list(draft["tags"])
        return payload

    core = normalize(current_item)
    payload = {}
    if name != (core["name"] or ""):
        payload["name"] = name
    if set(weekdays) != set(core["weekdays"]):
        payload["weekdays"] = weekdays
    if (draft.get("start_date") or None) != core["start_date"] or (draft.get("end_date") or None) != core["end_date"]:
        payload["start_date"] = draft.get("start_date") or None
        payload["end_date"] = draft.get("end_date") or None
    if (draft.get("repeat") or "repeat") != core["repeat"]:
        payload["repeat_type"] = draft.get("repeat") or "repeat"
    if tags_supported and list(draft.get("tags") or []) != core["tags"]:
        payload["tags"] = list(draft.get("tags") or [])
    old_block = (canonical(core["conditions"]["items"]), core["conditions"]["type"], core["conditions"]["track"])
    new_block = (canonical(cond_items), cond_type, cond_track)
    conditions_changed = old_block != new_block
    draft_slots = draft.get("slots") or []
    slots_changed = len(draft_slots) != len(core["slots"]) or any(draft_slot_form(d) != _core_slot_form(c) for d, c in zip(draft_slots, core["slots"]))
    if conditions_changed or slots_changed:
        raw_slots = current_item.get("timeslots") or []
        out = []
        for i, d in enumerate(draft_slots):
            same = i < len(core["slots"]) and draft_slot_form(d) == _core_slot_form(core["slots"][i]) and not conditions_changed and isinstance(raw_slots[i], dict)
            out.append(component_slot(raw_slots[i]) if same else build_slot(d))
        payload["timeslots"] = out
    if payload:
        payload.setdefault("start_date", draft.get("start_date") or None)  # an edit that leaves them out wipes them
        payload.setdefault("end_date", draft.get("end_date") or None)
    return payload


# ---------------------------------------------------------------- diff (§4.6)

def diff_summary(old: dict[str, Any] | None, new_draft: dict[str, Any]) -> dict[str, Any]:
    """The audit `diff` of an edit: which parts changed (never values of service data)."""
    cond_items, cond_type, cond_track = _draft_conditions(new_draft)
    if old is None:
        return {"days": True, "dates": bool(new_draft.get("start_date") or new_draft.get("end_date")), "repeat": (new_draft.get("repeat") or "repeat") != "repeat", "conditions_changed": bool(cond_items),
                "slots_added": len(new_draft.get("slots") or []), "slots_removed": 0, "slots_changed": 0, "name_changed": True}
    old_forms = [_core_slot_form(s) for s in old["slots"]]
    new_forms = [draft_slot_form(s) for s in new_draft.get("slots") or []]
    common = min(len(old_forms), len(new_forms))
    return {
        "days": list(new_draft.get("weekdays") or ["daily"]) != old["weekdays"],
        "dates": (new_draft.get("start_date") or None) != old["start_date"] or (new_draft.get("end_date") or None) != old["end_date"],
        "repeat": (new_draft.get("repeat") or "repeat") != old["repeat"],
        "conditions_changed": (canonical(cond_items), cond_type, cond_track) != (canonical(old["conditions"]["items"]), old["conditions"]["type"], old["conditions"]["track"]),
        "slots_added": max(0, len(new_forms) - len(old_forms)),
        "slots_removed": max(0, len(old_forms) - len(new_forms)),
        "slots_changed": sum(1 for i in range(common) if old_forms[i] != new_forms[i]),
        "name_changed": (new_draft.get("name") or "") != (old["name"] or ""),
    }


# ---------------------------------------------------------------- validation (§5.7, §5.8)

class DraftContext(Protocol):
    """What `validate_draft` asks of its caller (the service builds a real one from the mirror, tests a small fake)."""

    def entity(self, entity_id: str) -> dict[str, Any] | None: ...  # mirrored row: entity_id, name, domain, attributes, supported_features, available, state, class, refusal
    def panel(self, entity_id: str) -> dict[str, Any]: ...  # services/alarm.schedule_panel_check
    def enabled_classes(self) -> set[str]: ...
    def sun_seconds(self) -> dict[str, int] | None: ...
    tz_name: str
    shabbat_sensor: str


def _problem(code: str, message: str, path: str) -> dict[str, str]:
    return {"path": path, "code": code, "message": message}


def _slot_span(slot: dict[str, Any], sun: dict[str, int] | None) -> tuple[int, int] | None:
    a = policy.parse_time(slot.get("start"))
    if a is None:
        return None
    start = slot_seconds(a, sun)
    if start is None:
        return None
    if slot.get("stop"):
        b = policy.parse_time(slot["stop"])
        if b is None:
            return None
        stop = slot_seconds(b, sun)
        if stop is None:
            return None
        if b["kind"] == "fixed" and b["seconds"] == 0:
            stop = 86400  # "00:00:00" as stop = end of day
        return start, stop
    return start, start + 60  # a point action occupies one minute


def validate_draft(draft: dict[str, Any], ctx: DraftContext, *, old: dict[str, Any] | None = None, creating: bool = True, inherited_days: list[str] | None = None) -> tuple[list[dict[str, str]], list[dict[str, str]]]:
    """Structural (§5.7), action (§5.2 / §5.4, §5.6) and condition (§5.8) validation of a draft. Returns
    (errors, warnings), each `{"path", "code", "message"}`. `old` is the schedule's current normalised core: actions
    unchanged from it are exempt from the dynamic checks and from the alarm-code refusal (§5.6)."""
    errors: list[dict[str, str]] = []
    warnings: list[dict[str, str]] = []
    name = (draft.get("name") or "").strip()
    if len(name) > MAX_NAME or any(ord(c) < 32 or ord(c) == 127 for c in name):
        errors.append(_problem("validation", f"שם: עד {MAX_NAME} תווים, בלי תווי בקרה.", "name"))
    if creating and not name:
        errors.append(_problem("validation", "שם התזמון חובה.", "name"))
    elif not creating and not name and old is not None and (old["name"] or ""):
        errors.append(_problem("validation", "אי אפשר להשאיר תזמון בלי שם.", "name"))
    tokens = draft.get("weekdays") or []
    if not tokens or any(t not in DAY_TOKENS for t in tokens) or len(set(tokens)) != len(tokens):
        errors.append(_problem("validation", "ימים לא תקינים.", "weekdays"))  # (the component refuses [], duplicates and upper case)
    elif ("workday" in tokens or "weekend" in tokens) and (list(tokens) != (old["weekdays"] if old is not None else inherited_days)):
        errors.append(_problem("validation", "ימי עבודה וסוף שבוע אפשריים רק כשלא שונו; בחרו ימים מפורשים.", "weekdays"))
    for key in ("start_date", "end_date"):
        if draft.get(key) and _date(draft[key]) is None:
            errors.append(_problem("validation", "תאריך לא תקין (YYYY-MM-DD).", key))
    if _date(draft.get("start_date")) and _date(draft.get("end_date")) and _date(draft["start_date"]) > _date(draft["end_date"]):  # type: ignore[operator]
        errors.append(_problem("validation", "תאריך ההתחלה אחרי תאריך הסיום.", "start_date"))
    if draft.get("repeat") == "single":
        warnings.append(_problem("single_deletes", "תזמון חד־פעמי נמחק מהרכיב לאחר ההרצה.", "repeat"))
    tags = draft.get("tags") or []
    if len(tags) > MAX_TAGS or any((not t.strip()) or len(t) > MAX_TAG or any(ord(c) < 32 for c in t) for t in tags):
        errors.append(_problem("validation", f"תגיות: עד {MAX_TAGS}, באורך 1–{MAX_TAG} תווים.", "tags"))
    if not policy.CAPABILITIES["tags"] and list(tags) != (old["tags"] if old is not None else []):
        errors.append(_problem("tags_not_supported", "רכיב התזמונים בגרסה זו אינו שומר תגיות.", "tags"))
    slots = draft.get("slots") or []
    if not slots:
        errors.append(_problem("validation", "לתזמון חייבת להיות לפחות משבצת אחת.", "slots"))
    if len(slots) > MAX_SLOTS:
        errors.append(_problem("validation", f"עד {MAX_SLOTS} משבצות.", "slots"))
    enabled_classes = ctx.enabled_classes()
    entities_seen: list[str] = []
    old_actions = _old_action_keys(old)
    for si, slot in enumerate(slots[: MAX_SLOTS + 1]):
        sp = f"slots[{si}]"
        start = policy.parse_time(slot.get("start"))
        stop = policy.parse_time(slot["stop"]) if slot.get("stop") else None
        if start is None:
            errors.append(_problem("validation", "שעת התחלה לא תקינה.", f"{sp}.start"))
        if slot.get("stop") and stop is None:
            errors.append(_problem("validation", "שעת סיום לא תקינה.", f"{sp}.stop"))
        for label, spec in (("start", start), ("stop", stop)):
            if spec and spec["kind"] == "sun" and spec["offset_seconds"] < 0 and not policy.CAPABILITIES["negative_sun_offset"]:
                errors.append(_problem("validation", "היסט שלילי משקיעה / זריחה אינו נתמך עדיין.", f"{sp}.{label}"))
        if start and stop and start["kind"] == "fixed" and stop["kind"] == "fixed" and stop["seconds"] != 0 and stop["seconds"] <= start["seconds"]:
            errors.append(_problem("validation", "שעת הסיום חייבת להיות אחרי שעת ההתחלה באותו יום.", f"{sp}.stop"))
        acts = slot.get("actions") or []
        if not acts:
            errors.append(_problem("validation", "למשבצת חייבת להיות לפחות פעולה אחת.", f"{sp}.actions"))
        if len(acts) > MAX_ACTIONS:
            errors.append(_problem("validation", f"עד {MAX_ACTIONS} פעולות במשבצת.", f"{sp}.actions"))
        for ai, act in enumerate(acts[: MAX_ACTIONS + 1]):
            ap = f"{sp}.actions[{ai}]"
            errors.extend(_check_action(act, ap, ctx, enabled_classes, old_actions.get((si, ai)), warnings, entities_seen))
    if len(entities_seen) > MAX_ENTITIES:
        errors.append(_problem("validation", f"עד {MAX_ENTITIES} התקנים שונים בתזמון.", "slots"))
    errors.extend(_overlaps(slots, ctx))
    warnings.extend(sun_overlap_warnings(slots, ctx))
    _check_conditions(draft, ctx, old, errors, warnings)
    track = (draft.get("conditions") or {}).get("track")
    if track and any(not s.get("stop") for s in slots):
        warnings.append(_problem("track_needs_window", "בדיקת התנאי לכל אורך החלון דורשת שעת סיום בכל משבצת.", "conditions.track"))
    return errors, warnings


def _old_action_keys(old: dict[str, Any] | None) -> dict[tuple[int, int], str]:
    """The current actions by (slot index, action position): an action is "unchanged" only when the SAME position of the
    same slot holds the same action (review L8: an action equal to some other action of the old schedule is a new one)."""
    if old is None:
        return {}
    return {(si, ai): canonical([a["service"], a["entity_id"], a["data"]]) for si, s in enumerate(old["slots"]) for ai, a in enumerate(s["actions"])}


def _check_action(act: dict[str, Any], path: str, ctx: DraftContext, enabled: set[str], old_key: str | None, warnings: list[dict[str, str]], seen: list[str]) -> list[dict[str, str]]:
    out: list[dict[str, str]] = []
    service, eid, data = act.get("service") or "", act.get("entity_id"), act.get("data") or {}
    unchanged = old_key is not None and canonical([service, eid, data]) == old_key
    if policy.contains_code(data) or policy.contains_code(service):
        return [_problem("code_not_allowed", "אסור לשמור קוד בתוך תזמון.", f"{path}.data")]
    if len(data) > MAX_DATA:
        return [_problem("validation", f"עד {MAX_DATA} ארגומנטים בפעולה.", f"{path}.data")]
    if not eid:
        return [_problem("action_not_allowed", "פעולה חייבת להצביע על התקן.", f"{path}.entity_id")]
    if not ENTITY_ID.match(eid):
        return [_problem("validation", "מזהה התקן לא תקין.", f"{path}.entity_id")]
    if eid not in seen:
        seen.append(eid)
    info = ctx.entity(eid)
    if info is None:
        return [_problem("entity_unknown", "ההתקן אינו מוכר למערכת.", f"{path}.entity_id")]
    cls, refusal = info.get("class"), info.get("refusal")
    if cls is None:
        code = refusal or "action_not_allowed"
        msgs = {"switch_not_marked": "המתג לא סומן כבטוח לפעולה קבוצתית; רק מתגים מסומנים נכנסים לתזמון.", "alarm_managed_control": "רכיב זה נשלט ממסך האזעקה ואינו נכנס לתזמון.",
                "action_not_allowed": "סוג ההתקן אינו מותר בתזמונים."}
        return [_problem(code, msgs.get(code, msgs["action_not_allowed"]), f"{path}.entity_id")]
    if cls not in enabled and not unchanged:
        return [_problem("class_not_allowed", "סוג ההתקן אינו מותר בתזמונים (הגדרות › תזמונים).", f"{path}.entity_id")]
    if not policy.service_allowed(cls, service):
        return [_problem("action_not_allowed", "הפעולה אינה מותרת בתזמון.", f"{path}.service")]
    problems, _ = policy.check_arguments(service, data, info, dynamic=not unchanged)
    for p in problems:  # the field-level code stays in the problem; the router promotes only §3.20 codes, else `validation`
        out.append(_problem(p["code"], p["message"], f"{path}.data.{p['arg']}"))
    if cls in ("alarm", "lock") and not problems:
        out.extend(_code_rules(cls, service, eid, path, info, ctx, unchanged, warnings))
    if info.get("available") is False:
        warnings.append(_problem("entity_unavailable", "ההתקן אינו זמין כרגע.", f"{path}.entity_id"))
    return out


def _code_rules(cls: str, service: str, eid: str, path: str, info: dict[str, Any], ctx: DraftContext, unchanged: bool, warnings: list[dict[str, str]]) -> list[dict[str, str]]:
    """§5.6: no code ever reaches the component. A new or changed alarm / lock action whose device needs a code is refused;
    an unchanged existing one is kept with a warning."""
    if cls == "alarm":
        panel = ctx.panel(eid)
        if not panel.get("discovered"):
            return [_problem("action_not_allowed", "לוח האזעקה אינו מוכר למערכת האזעקה.", f"{path}.entity_id")]
        if service != "alarm_control_panel.alarm_disarm":
            mode = policy.ARM_MODE_OF.get(service)
            if mode and mode not in (panel.get("arm_modes") or []):
                return [_problem("arm_mode_not_supported", "לוח האזעקה אינו תומך במצב דריכה זה.", f"{path}.service")]
        needs = panel.get("needs_code_disarm") if service == "alarm_control_panel.alarm_disarm" else panel.get("needs_code_arm")
        if needs:
            if unchanged:
                warnings.append(_problem("alarm_may_need_code", "לוח האזעקה עשוי לדרוש קוד לפעולה זו.", path))
                return []
            return [_problem("alarm_code_needed", "לוח האזעקה דורש קוד לפעולה זו. תזמון אינו שומר קודים, ולכן אי אפשר לתזמן אותה.", f"{path}.service")]
    elif cls == "lock":
        if (info.get("attributes") or {}).get("code_format") and not unchanged:
            return [_problem("lock_code_needed", "המנעול דורש קוד. תזמון אינו שומר קודים, ולכן אי אפשר לתזמן אותו.", f"{path}.entity_id")]
    return []


def _overlaps(slots: list[dict[str, Any]], ctx: DraftContext) -> list[dict[str, str]]:
    """§5.7: fixed-time slots must not overlap (half-open; `stop == next start` is the normal contiguous case; a point
    slot occupies one minute) -> `slots_overlap`; slots with a sun time are compared with today's sun times only as a
    warning (handled by the caller through `sun_overlap_possible`)."""
    out: list[dict[str, str]] = []
    spans: list[tuple[int, int, int]] = []
    for i, s in enumerate(slots):
        a, b = policy.parse_time(s.get("start")), (policy.parse_time(s["stop"]) if s.get("stop") else None)
        if a is None or (s.get("stop") and b is None):
            continue
        if a["kind"] != "fixed" or (b is not None and b["kind"] != "fixed"):
            continue
        span = _slot_span(s, None)
        if span:
            spans.append((span[0], span[1], i))
    spans.sort()
    reach = -1  # the latest end seen so far in start order: a slot starting before it overlaps (half-open)
    reach_index = -1
    flagged: set[int] = set()
    for start, stop, index in spans:
        if start < reach:
            flagged.add(max(index, reach_index))
        if stop > reach:
            reach, reach_index = stop, index
    return [_problem("slots_overlap", "משבצות חופפות באותו תזמון.", f"slots[{i}]") for i in sorted(flagged)]


def sun_overlap_warnings(slots: list[dict[str, Any]], ctx: DraftContext) -> list[dict[str, str]]:
    """Sun slots against today's sun times: an overlap on today's figures is a warning, never an error."""
    sun = ctx.sun_seconds()
    if not sun:
        return []
    spans: list[tuple[int, int, int, bool]] = []  # (start, stop, index, uses a sun time)
    for i, s in enumerate(slots):
        a = policy.parse_time(s.get("start"))
        b = policy.parse_time(s["stop"]) if s.get("stop") else None
        span = _slot_span(s, sun)
        if span and a is not None:
            spans.append((span[0], span[1], i, a["kind"] == "sun" or (b is not None and b["kind"] == "sun")))
    out: list[dict[str, str]] = []
    for x in range(len(spans)):
        for y in range(x + 1, len(spans)):
            (s1, e1, i1, sun1), (s2, e2, i2, sun2) = spans[x], spans[y]
            if (sun1 or sun2) and s2 < e1 and s1 < e2:
                out.append(_problem("sun_overlap_possible", "משבצות עם שקיעה / זריחה עלולות לחפוף בימים מסוימים.", f"slots[{max(i1, i2)}]"))
    return out


def _check_conditions(draft: dict[str, Any], ctx: DraftContext, old: dict[str, Any] | None, errors: list[dict[str, str]], warnings: list[dict[str, str]]) -> None:
    block = draft.get("conditions") or {}
    items = block.get("items") or []
    if len(items) > MAX_CONDITIONS:
        errors.append(_problem("validation", f"עד {MAX_CONDITIONS} תנאים.", "conditions.items"))
        items = items[:MAX_CONDITIONS]
    old_keys = {canonical(c) for c in (old["conditions"]["items"] if old else [])}
    cond_entity = getattr(ctx, "condition_entity", ctx.entity)  # a scoped context answers only for what the caller may read
    has_sensitive = False
    for slot in draft.get("slots") or []:
        for a in slot.get("actions") or []:
            info = ctx.entity(a.get("entity_id") or "") if a.get("entity_id") else None
            if info and info.get("class") in policy.SENSITIVE_CLASSES:
                has_sensitive = True
    for ci, c in enumerate(items):
        path = f"conditions.items[{ci}]"
        eid = c.get("entity_id") or ""
        attr, match, value = c.get("attribute") or "state", c.get("match_type") or "is", c.get("value")
        existing = canonical({"entity_id": eid, "attribute": attr, "match_type": match, "value": value}) in old_keys
        if not ENTITY_ID.match(eid):
            errors.append(_problem("validation", "מזהה התקן לא תקין.", f"{path}.entity_id"))
            continue
        info = cond_entity(eid)
        if not existing and eid.split(".", 1)[0] not in CONDITION_DOMAINS:
            errors.append(_problem("condition_domain_not_allowed", "אפשר להתנות רק בחיישנים, חיישנים בינאריים, מתגי עזר או מצב השמש.", f"{path}.entity_id"))
            continue
        if info is None and not existing:
            errors.append(_problem("entity_unknown", "ההתקן אינו מוכר למערכת.", f"{path}.entity_id"))
            continue
        if attr != "state" and not ATTRIBUTE.match(attr):
            errors.append(_problem("validation", "שם תכונה לא תקין.", f"{path}.attribute"))
            continue
        if match in ("is", "not"):
            if not isinstance(value, str) or not 1 <= len(value) <= 100:
                errors.append(_problem("validation", "ערך התנאי: טקסט של 1–100 תווים.", f"{path}.value"))
                continue
        else:
            if isinstance(value, bool) or not isinstance(value, (int, float)):
                errors.append(_problem("validation", "ערך התנאי חייב להיות מספר.", f"{path}.value"))
                continue
            if info is not None and not existing:
                probe = info.get("state") if attr == "state" else (info.get("attributes") or {}).get(attr)
                try:
                    float(probe)
                except (TypeError, ValueError):
                    if probe not in (None, "unknown", "unavailable"):
                        errors.append(_problem("validation", "ההשוואה המספרית דורשת מצב או תכונה מספריים.", f"{path}.attribute"))
                        continue
        if info is not None and info.get("available") is False:
            warnings.append(_problem("condition_entity_unavailable", "חיישן התנאי אינו זמין כרגע.", path))
        if has_sensitive and (info is None or info.get("available") is False or info.get("state") in ("unavailable", "unknown")):
            warnings.append(_problem("sensitive_condition_unavailable", "תזמון של פעולה רגישה תלוי בחיישן שאינו זמין כעת.", path))
    ctype = block.get("type")
    if items and len(items) > 1 and ctype not in ("and", "or"):
        errors.append(_problem("validation", "עם כמה תנאים יש לבחור: כולם / אחד מהם.", "conditions.type"))
