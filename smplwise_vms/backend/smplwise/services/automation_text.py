"""CR-017 Hebrew sentences: one line per trigger, condition, action step and whole item ("כש… , אם … – פעולה; פעולה").

The wording is the contract of the client file `frontend/src/api/automations.ts` (section "Hebrew sentences") and the golden strings of its spec
(`frontend/tests/unit-automations.spec.ts`); `tests/golden/automation_sentences.json` holds them for this side. The SERVER's sentence is
authoritative (the client versions exist for the code view, the mock and a draft that has not been sent yet), so a change of wording is made
in both places and in the golden file.

Pure functions over the block dictionaries of `automation_model` (the JSON shape of AUTOMATIONS_API.md section 2.1). No Home Assistant, no I/O.
Names come from the caller (`ModelContext.names`): the entity id is the fallback, never an error.

I18N-BACKEND-2490: every sentence is a `Msg` (smplwise/i18n.py) built from the `auto.*` texts of services/automation_text_i18n.py: its
string value is the Hebrew sentence, byte for byte (the golden file, the stored trace and version summaries, the client mirror), and the
screens that answer one user render it in that user's interface language (the automation routers call `localize`). Names, numbers,
times and quoted user texts inside a sentence are data and stay as they are.
"""
from __future__ import annotations

import math
import re
from dataclasses import dataclass
from typing import Any, Callable, Collection, Iterable, Mapping

from ..i18n import cat, join, t
from . import automation_policy as policy
from . import automation_text_i18n as words
from . import building_presence_blocks as bpb

Block = Mapping[str, Any]
_UNDEF = object()


@dataclass
class ModelContext:
    """What reading, writing and sentences need beyond the stored config: names, the allow-list and the Shabbat sensor of CR-014."""

    names: Callable[[str], str] | None = None
    notify_name: Callable[[str], str | None] | None = None  # the Hebrew name of a notify service (`notify.mobile_app_x`), or None
    device_name: Callable[[str], str | None] | None = None
    shabbat_sensor: str | None = None  # a `state` condition on it with state on / off is the `shabbat` block
    allowed_actions: Collection[str] | None = None  # the catalogue's approved services; None = the built-in list and any notify service
    uid: Callable[[], str] | None = None
    template_text: bool = True  # put the first template text in `template_text` of locked template blocks (the server sets it per caller)
    # KAV079-295 (the extension of the schedules / automations editors, default OFF): a wall-button device trigger is read as the typed
    # `button` block only while `automations.wall_buttons_editable` is on; a `state` condition on the configured "who is in the building"
    # entity is the typed `presence` block (the Shabbat pattern of CR-014)
    wall_buttons: bool = False
    presence_entity: str | None = None
    # BUILDING-PRESENCE-2271: the presence sensors the owner tagged (services/building_presence.py). Non-empty switches on the typed `building_empty`
    # trigger and `room_occupied` condition (services/building_presence_blocks.py); empty = a stored step of that shape stays a locked template
    presence_sensors: tuple[str, ...] = ()


# ---------------------------------------------------------------- small helpers (JavaScript-like formatting of numbers)

def num(x: Any) -> str:
    """A number as the client prints it: 24.0 -> "24", 23.5 -> "23.5" (JSON from Home Assistant carries both)."""
    if isinstance(x, float):
        if x.is_integer() and abs(x) < 1e21:
            return str(int(x))
        return repr(x)
    return str(x)


def js_round(x: float) -> int:
    """JavaScript's Math.round (half up), not Python's banker's rounding."""
    return int(math.floor(x + 0.5))


def js_str(x: Any) -> str:
    if x is None:
        return "null"
    if x is _UNDEF:
        return "undefined"
    if isinstance(x, bool):
        return "true" if x else "false"
    if isinstance(x, (int, float)):
        return num(x)
    return str(x)


def _is_num(x: Any) -> bool:
    return isinstance(x, (int, float)) and not isinstance(x, bool)


def _nn(x: Any) -> bool:
    """JavaScript `!= null`."""
    return x is not None and x is not _UNDEF


def name_of(ctx: ModelContext, entity_id: str) -> str:
    n = ctx.names(entity_id) if ctx.names else None
    return n if n else entity_id


def join_names(ids: Iterable[str], ctx: ModelContext | None = None) -> Any:
    """"a", "a וb", "a, b וc"; "…" for none. The names are data; the word "and" is a `Msg` (I18N-BACKEND-2490)."""
    ctx = ctx or ModelContext()
    n = [name_of(ctx, i) for i in ids]
    if not n:
        return "…"
    if len(n) == 1:
        return n[0]
    if len(n) == 2:
        return t("auto.names2", v=n[0], v2=n[1])
    return t("auto.names2", v=", ".join(n[:-1]), v2=n[-1])


def duration_text(d: Mapping[str, Any] | None) -> Any:
    """"5 דקות", "שעה ו30 דקות"."""
    if not d:
        return ""
    p: list[Any] = []
    h, m, s = d.get("hours"), d.get("minutes"), d.get("seconds")
    if h:
        p.append(t("auto.hour1") if h == 1 else t("auto.hour2") if h == 2 else t("auto.hours", n=num(h)))
    if m:
        p.append(t("auto.minute1") if m == 1 else t("auto.minute2") if m == 2 else t("auto.minutes", n=num(m)))
    if s:
        p.append(t("auto.second1") if s == 1 else t("auto.second2") if s == 2 else t("auto.seconds", n=num(s)))
    return join(t("auto.dur_and"), p)


WEEKDAYS = policy.WEEKDAYS
WD_SHORT = {d: t(f"auto.wd.{d}") for d in ("sun", "mon", "tue", "wed", "thu", "fri", "sat")}
_CLOCK_ZERO_RE = re.compile(r"^\d{1,2}:\d{2}:00$")


def clock(c: str) -> str:
    return c[:-3] if _CLOCK_ZERO_RE.match(c) else c


def state_word(ids: list[str], to: Any, frm: Any) -> Any:
    """What a device "does" when it reaches `to` (by its domain, and for sensors by the id: motion, door, window, leak)."""
    eid = ids[0] if ids else ""
    dom = eid.split(".")[0]
    if to is _UNDEF and frm is _UNDEF:
        return t("auto.st.changes")
    if dom == "binary_sensor":
        if re.search(r"motion|occupancy|presence", eid):
            return t("auto.st.motion_on") if to == "on" else t("auto.st.motion_off")
        if re.search(r"door|window|gate", eid):
            return t("auto.st.opens") if to == "on" else t("auto.st.closes")
        if re.search(r"leak|water|flood", eid):
            return t("auto.st.water_on") if to == "on" else t("auto.st.water_off")
        if re.search(r"smoke|gas|fire", eid):
            return t("auto.st.smoke_on") if to == "on" else t("auto.st.smoke_off")
        return t("auto.st.on") if to == "on" else t("auto.st.off")
    if dom in ("person", "device_tracker"):
        if to == "home":
            return t("auto.st.comes_home") if frm not in (None, _UNDEF, "") else t("auto.st.home")
        return t("auto.st.leaves_home") if to == "not_home" else t("auto.st.at", to=js_str(to))
    if dom == "climate":
        return t("auto.st.cooling") if to == "cool" else t("auto.st.heating") if to == "heat" else t("auto.st.off") if to == "off" else t("auto.st.in_state", to=js_str(to))
    if dom == "lock":
        return t("auto.st.locks") if to == "locked" else t("auto.st.unlocks") if to == "unlocked" else t("auto.st.in_state", to=js_str(to))
    if dom == "alarm_control_panel":
        if to == "triggered":
            return t("auto.st.triggered")
        if to == "disarmed":
            return t("auto.st.disarmed")
        return t("auto.st.armed") if isinstance(to, str) and to.startswith("armed") else t("auto.st.in_state", to=js_str(to))
    if dom == "cover":
        return t("auto.st.cover_opens") if to == "open" else t("auto.st.cover_closes") if to == "closed" else t("auto.st.in_state", to=js_str(to))
    if to == "on":
        return t("auto.st.light_on") if dom == "light" else t("auto.st.turns_on")
    if to == "off":
        return t("auto.st.light_off") if dom == "light" else t("auto.st.is_off")
    return t("auto.st.in_state_q", to=js_str(to))


# The verb of a service ("{n}" = where the device names go; without it the names follow the verb). Plain Hebrew (the picker's catalogue and the
# golden strings read it); the sentence and the picker label use the `auto.verb.*` / `auto.label.*` texts built from it (automation_text_i18n).
ACTION_VERBS: dict[str, str] = {
    "light.turn_on": "הדלק", "light.turn_off": "כבה", "light.toggle": "החלף מצב של",
    "switch.turn_on": "הפעל", "switch.turn_off": "כבה", "switch.toggle": "החלף מצב של",
    "fan.turn_on": "הפעל", "fan.turn_off": "כבה", "fan.toggle": "החלף מצב של", "fan.set_percentage": "כוון מהירות של",
    "climate.turn_on": "הפעל", "climate.turn_off": "כבה", "climate.set_temperature": "כוון טמפרטורה של", "climate.set_hvac_mode": "כוון מצב של",
    "climate.set_fan_mode": "כוון מאוורר של", "climate.set_preset_mode": "כוון מצב מוגדר של",
    "cover.open_cover": "פתח", "cover.close_cover": "סגור", "cover.stop_cover": "עצור", "cover.set_cover_position": "כוון מיקום של", "cover.toggle": "החלף מצב של",
    "lock.lock": "נעל", "lock.unlock": "פתח את",
    "alarm_control_panel.alarm_arm_away": "דרוך את {n} (מלא)", "alarm_control_panel.alarm_arm_home": "דרוך את {n} (בית)",
    "alarm_control_panel.alarm_arm_night": "דרוך את {n} (לילה)", "alarm_control_panel.alarm_disarm": "נטרל את {n}",
    "siren.turn_on": "הפעל", "siren.turn_off": "כבה",
    "media_player.turn_on": "הדלק", "media_player.turn_off": "כבה", "media_player.media_play": "נגן ב־", "media_player.media_pause": "השהה את",
    "media_player.volume_set": "כוון עוצמה של", "media_player.volume_mute": "השתק את", "media_player.select_source": "בחר מקור ב־",
    "select.select_option": "בחר אפשרות ב־", "number.set_value": "כוון ערך של", "input_boolean.turn_on": "הפעל", "input_boolean.turn_off": "כבה",
    "input_select.select_option": "בחר אפשרות ב־",
    "timer.start": "התחל את", "timer.cancel": "בטל את", "timer.pause": "השהה את", "timer.finish": "סיים את",
    "scene.turn_on": "הפעל סצנה", "automation.turn_on": "הפעל את האוטומציה", "automation.turn_off": "כבה את האוטומציה", "automation.trigger": "הרץ את האוטומציה",
}
words.register_verbs(ACTION_VERBS)


def action_label(action: str) -> Any:
    """The short label of a service in the action picker (the verb without its placeholder)."""
    return t(f"auto.label.{action}") if action in ACTION_VERBS else action.replace("{n}", "").rstrip("־").strip()


# ---------------------------------------------------------------- locked blocks

LOCK_KEY_LABEL = {k: t(f"auto.lock.{k}") for k in ("variables", "wait_template", "wait_for_trigger", "parallel", "sequence", "event", "scene", "set_conversation_response", "stop")}


def locked_label(raw: Any, reason: str, section: str, ctx: ModelContext | None = None) -> Any:
    """The label of a locked block (also its sentence)."""
    ctx = ctx or ModelContext()
    r = raw if isinstance(raw, dict) else {}
    if reason == "template":
        return t("auto.locked.template")
    if reason == "device":
        did = r.get("device_id")
        name = ctx.device_name(did) if ctx.device_name and isinstance(did, str) else None
        what = name or t("auto.locked.device")
        return t("auto.locked.button", v=what) if section == "trigger" else t("auto.locked.device_condition", v=what) if section == "condition" else t("auto.locked.device_action", v=what)
    if reason == "purpose_trigger":
        return t("auto.locked.purpose_trigger", v=js_str(r.get("trigger")) if r.get("trigger") is not None else "")
    if reason == "custom_service":
        svc = r.get("action") if r.get("action") is not None else r.get("service")
        return t("auto.locked.custom_service", v=(js_str(svc) if svc is not None else "").split(".")[0])
    if reason == "service_not_allowed":
        svc = r.get("action") if r.get("action") is not None else r.get("service")
        return t("auto.locked.not_allowed", v=js_str(svc) if svc is not None else "")
    if reason == "disabled_step":
        return t("auto.locked.disabled") if r.get("enabled") is False else t("auto.locked.continue_on_error")
    if reason == "secret":
        return t("auto.locked.secret")
    if reason == "code":
        return t("auto.locked.code")
    if reason == "unsupported_step":
        key = next((k for k in r if k in LOCK_KEY_LABEL), None)
        if isinstance(r.get("repeat"), dict):
            return t("auto.locked.repeat")
        if key:
            return LOCK_KEY_LABEL[key]
        return t("auto.locked.adv_trigger") if section == "trigger" else t("auto.locked.adv_condition") if section == "condition" else t("auto.locked.adv_step")
    return t("auto.locked.unknown_trigger") if section == "trigger" else t("auto.locked.unknown_condition") if section == "condition" else t("auto.locked.unknown_step")


# ---------------------------------------------------------------- sentences

PRESS_WORD = {p: t(f"auto.press.{p}") for p in ("short", "double", "long")}  # KAV079-295


def service_sentence(b: Block, ctx: ModelContext) -> Any:
    n = join_names(b["entity_ids"], ctx)
    d = b.get("data") or {}
    role, action = b.get("role"), b["action"]
    if role == "scene":
        return t("auto.scene", n=n)
    if role == "script":
        return t("auto.script", n=n)
    if role == "automation":
        return t("auto.quoted", verb=t(f"auto.word.{action}") if action in ACTION_VERBS else action, n=n)
    if role == "notify":
        target = ctx.notify_name(action) if ctx.notify_name else None
        if not target:
            target = re.sub(r"^mobile_app_", "", re.sub(r"^notify\.", "", action)).replace("_", " ") or t("auto.notifications")
        msg = d.get("message") if isinstance(d.get("message"), str) else ""
        crit = t("auto.critical") if b.get("critical") else ""  # KAV079-295
        return t("auto.send_msg", target=target, msg=msg, crit=crit) if msg else t("auto.send", target=target, crit=crit)
    text: Any = t(f"auto.verb.{action}", n=n) if action in ACTION_VERBS else t("auto.service_dot", action=action, n=n)
    tail: Any = ""
    if action == "light.turn_on":
        if _is_num(d.get("brightness_pct")):
            tail = t("auto.to_pct", v=num(d["brightness_pct"]))
        elif _is_num(d.get("brightness")):
            tail = t("auto.to_pct", v=js_round(d["brightness"] / 255 * 100))
    if action == "climate.set_temperature" and _is_num(d.get("temperature")):
        tail = t("auto.to_deg", v=num(d["temperature"]))
    if action == "cover.set_cover_position" and _is_num(d.get("position")):
        tail = t("auto.to_pct", v=num(d["position"]))
    if action == "media_player.volume_set" and _is_num(d.get("volume_level")):
        tail = t("auto.to_pct", v=js_round(d["volume_level"] * 100))
    if action == "fan.set_percentage" and _is_num(d.get("percentage")):
        tail = t("auto.to_pct", v=num(d["percentage"]))
    return cat(text, tail) if tail else text


def _join_steps(blocks: Iterable[Block], ctx: ModelContext) -> Any:
    return join(", ", [action_sentence(x, ctx, True) for x in blocks])


def _time_pattern_every(v: Any, unit: tuple[Any, Any, Any]) -> Any:
    m = re.match(r"^/(\d+)$", v) if isinstance(v, str) and v else None
    if not m:
        return None
    return t("auto.every1", v=unit[0]) if m.group(1) == "1" else t("auto.every", v=m.group(1), v2=unit[2])


def _for(b: Block) -> Any:
    return t("auto.for", **{"for": duration_text(b["for"])}) if b.get("for") is not None else ""


def trigger_sentence(b: Block, ctx: ModelContext | None = None) -> Any:
    ctx = ctx or ModelContext()
    if b.get("kind") == "locked":
        return b["label"]
    kind = b["type"]
    if kind == "state":
        return t("auto.when", v=join_names(b["entity_ids"], ctx), v2=state_word(b["entity_ids"], b.get("to", _UNDEF), b.get("from", _UNDEF)), v3=_for(b))
    if kind == "numeric_state":
        ids, above, below = b["entity_ids"], b.get("above"), b.get("below")
        if len(ids) == 1 and ids[0] == "zone.home" and below == 1 and above is None:
            return t("auto.everyone_leaves")
        rng = (t("auto.between", above=num(above), below=num(below)) if _nn(above) and _nn(below) else t("auto.above", above=num(above)) if _nn(above)
               else t("auto.below", below=num(below)) if _nn(below) else t("auto.st.changes"))
        return t("auto.when", v=join_names(ids, ctx), v2=rng, v3=_for(b))
    if kind == "time":
        return t("auto.at_time", at=clock(b["at"]))
    if kind == "time_pattern":
        mins, hrs, secs = b.get("minutes"), b.get("hours"), b.get("seconds")
        return (_time_pattern_every(mins, (t("auto.unit.minute"), t("auto.unit.minutes"), t("auto.unit.minutes")))
                or _time_pattern_every(hrs, (t("auto.unit.hour"), t("auto.unit.hours"), t("auto.unit.hours")))
                or _time_pattern_every(secs, (t("auto.unit.second"), t("auto.unit.seconds"), t("auto.unit.seconds")))
                or (t("auto.minute_of_hour", minutes=mins) if mins and re.match(r"^\d+$", str(mins)) else t("auto.time_pattern")))
    if kind == "sun":
        word = t("auto.sunset") if b["event"] == "sunset" else t("auto.sunrise")
        off = b.get("offset_min") or 0
        return t("auto.sun_offset", offset_min=abs(off), v=t("auto.before_word") if off < 0 else t("auto.after_word"), word=word) if off else t("auto.at_sun", word=word)
    if kind == "homeassistant":
        return t("auto.system_starts")
    if kind == "building_empty":  # BUILDING-PRESENCE-2271
        return bpb.trigger_sentence(b)
    if kind == "button":  # KAV079-295: a wall button / switch press
        did = b.get("device_id")
        name = (ctx.device_name(did) if ctx.device_name and isinstance(did, str) else None) or t("auto.switch")
        return t("auto.press_on_button", v=PRESS_WORD.get(b.get("press")) or t("auto.press"), button=b.get("button"), v2=name)
    return b.get("label", "")


def _quoted_or(values: Iterable[Any]) -> Any:
    return join(t("auto.or"), [f'"{v}"' for v in values])


def condition_sentence(b: Block, ctx: ModelContext | None = None) -> Any:
    ctx = ctx or ModelContext()
    if b.get("kind") == "locked":
        return b["label"]
    kind = b["type"]
    if kind == "state":
        st = b["state"] if isinstance(b["state"], list) else [b["state"]]
        w = state_word(b["entity_ids"], st[0], _UNDEF) if len(st) == 1 else t("auto.in_state_w", w=_quoted_or(st))
        return cat(t("auto.names_state", v=join_names(b["entity_ids"], ctx), w=w), _for(b))
    if kind == "numeric_state":
        above, below = b.get("above"), b.get("below")
        rng = t("auto.between", above=num(above), below=num(below)) if _nn(above) and _nn(below) else t("auto.above", above=num(above)) if _nn(above) else t("auto.below", below=js_str(below))
        return t("auto.names_state", v=join_names(b["entity_ids"], ctx), w=rng)
    if kind == "time":
        p: list[Any] = []
        after, before, wd = b.get("after"), b.get("before"), b.get("weekday")
        if after and before:
            p.append(t("auto.between_times", after=clock(after), before=clock(before)))
        elif after:
            p.append(t("auto.after_time", after=clock(after)))
        elif before:
            p.append(t("auto.before_time", before=clock(before)))
        if wd:
            p.append(t("auto.every_day") if len(wd) == 7 else t("auto.on_days", v=join(", ", [WD_SHORT[d] for d in WEEKDAYS if d in wd])))
        return join(" ", p) if p else t("auto.any_time")
    if kind == "sun":
        def w(r: str) -> Any:
            return t("auto.sunset") if r == "sunset" else t("auto.sunrise")
        after, before = b.get("after"), b.get("before")
        if after and before:
            return t("auto.between_sun", after=w(after), before=w(before))
        return t("auto.after_sun", after=w(after)) if after else t("auto.before_sun", before=w(before)) if before else t("auto.any_time")
    if kind == "trigger":
        return t("auto.trigger_is", v=_quoted_or(b["ids"]))
    if kind == "and":
        return join(t("auto.and_also"), [condition_sentence(c, ctx) for c in b["conditions"]])
    if kind == "or":
        return join(t("auto.or"), [condition_sentence(c, ctx) for c in b["conditions"]])
    if kind == "not":
        return t("auto.not", v=join(t("auto.and_also"), [condition_sentence(c, ctx) for c in b["conditions"]]))
    if kind == "shabbat":
        return t("auto.holy_only") if b["mode"] == "only_holy_days" else t("auto.not_holy")
    if kind == "room_occupied":  # BUILDING-PRESENCE-2271
        return bpb.condition_sentence(b, list(ctx.presence_sensors) or None, ctx.names)
    if kind == "presence":  # KAV079-295: "who is in the building"
        return t("auto.nobody") if b.get("mode") == "nobody" else t("auto.somebody")
    return b.get("label", "")


def _conditions_and(conditions: Iterable[Block], ctx: ModelContext) -> Any:
    return join(t("auto.and"), [condition_sentence(c, ctx) for c in conditions]) or "…"


def action_sentence(b: Block, ctx: ModelContext | None = None, short: bool = False) -> Any:
    """One action step. `short` = the one-line form of a nested step ("בחר לפי תנאים (2 ענפים)"); the long form spells the branches."""
    ctx = ctx or ModelContext()
    if b.get("kind") == "locked":
        return b["label"]
    kind = b["type"]
    if kind == "service":
        return service_sentence(b, ctx)
    if kind == "delay":
        return t("auto.wait", v=duration_text(b["delay"]) or "…")
    if kind == "choose":
        if short:
            return t("auto.choose_short", length=len(b["options"]))
        parts = [t("auto.if_then", v=_conditions_and(o["conditions"], ctx), v2=_join_steps(o["sequence"], ctx) or "…") for o in b["options"]]
        if b.get("default"):
            parts.append(t("auto.otherwise", v=_join_steps(b["default"], ctx)))
        return join("; ", parts)
    if kind == "if":
        els = t("auto.else_tail", v=_join_steps(b["else"], ctx)) if b.get("else") else ""
        return t("auto.if_then_else", v=_conditions_and(b["conditions"], ctx), v2=_join_steps(b["then"], ctx) or "…", v3=els)
    if kind == "repeat_count":
        return t("auto.repeat", count=b["count"], v=_join_steps(b["sequence"], ctx) or "…")
    if kind == "condition":
        return t("auto.continue_if", v=condition_sentence(b["condition"], ctx))
    if kind == "stop":
        return t("auto.stop_msg", message=b["message"]) if b.get("message") else t("auto.stop")
    return b.get("label", "")


def block_sentence(b: Block, section: str, ctx: ModelContext | None = None) -> Any:
    """The sentence of one block of any section (what the block's `sentence` holds)."""
    if section == "trigger":
        return trigger_sentence(b, ctx)
    if section == "condition":
        return condition_sentence(b, ctx)
    return action_sentence(b, ctx, True)


def _advanced(n: int) -> Any:
    return t("auto.advanced1") if n == 1 else t("auto.advanced", n=n)


def steps_phrase(blocks: list[Block], ctx: ModelContext) -> Any:
    """Steps as one phrase; locked steps collapse to "ופעולה מתקדמת" (CR section 15.4: the sentence admits there is more than it can say)."""
    typed = [action_sentence(b, ctx) for b in blocks if b.get("kind") == "typed"]
    locked = len(blocks) - len(typed)
    if not locked:
        return join("; ", typed)
    return t("auto.steps_and_locked", v=join("; ", typed), locked=_advanced(locked)) if typed else _advanced(locked)


def automation_sentence(d: Mapping[str, Any], ctx: ModelContext | None = None) -> Any:
    """"כש… או כש… , אם … ו… – פעולה; פעולה"."""
    ctx = ctx or ModelContext()
    tr = [trigger_sentence(x, ctx) for x in d.get("triggers") or []]
    co = [condition_sentence(c, ctx) for c in d.get("conditions") or []]
    s = join(t("auto.or"), tr) if tr else t("auto.when_empty")
    if co:
        s = cat(s, t("auto.if_tail", v=join(t("auto.and"), co)))
    actions = d.get("actions") or []
    return t("auto.item", s=s, v=steps_phrase(actions, ctx) if actions else "…")


def script_sentence(d: Mapping[str, Any], ctx: ModelContext | None = None) -> Any:
    ctx = ctx or ModelContext()
    seq = d.get("sequence") or []
    return steps_phrase(seq, ctx) if seq else "…"


def scene_sentence(d: Mapping[str, Any], ctx: ModelContext | None = None) -> Any:
    ctx = ctx or ModelContext()
    members = d.get("members") or []
    return t("auto.sets", v=join_names([m["entity_id"] for m in members], ctx)) if members else t("auto.empty_scene")


def draft_sentence(kind: str, draft: Mapping[str, Any], ctx: ModelContext | None = None) -> Any:
    if kind == "automation":
        return automation_sentence(draft, ctx)
    if kind == "script":
        return script_sentence(draft, ctx)
    return scene_sentence(draft, ctx)
