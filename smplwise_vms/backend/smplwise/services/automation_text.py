"""CR-017 Hebrew sentences: one line per trigger, condition, action step and whole item ("כש… , אם … – פעולה; פעולה").

The wording is the contract of the client file `frontend/src/api/automations.ts` (section "Hebrew sentences") and the golden strings of its spec
(`frontend/tests/unit-automations.spec.ts`); `tests/golden/automation_sentences.json` holds them for this side. The SERVER's sentence is
authoritative (the client versions exist for the code view, the mock and a draft that has not been sent yet), so a change of wording is made
in both places and in the golden file.

Pure functions over the block dictionaries of `automation_model` (the JSON shape of AUTOMATIONS_API.md section 2.1). No Home Assistant, no I/O.
Names come from the caller (`ModelContext.names`): the entity id is the fallback, never an error.
"""
from __future__ import annotations

import math
import re
from dataclasses import dataclass
from typing import Any, Callable, Collection, Iterable, Mapping

from . import automation_policy as policy

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


def join_names(ids: Iterable[str], ctx: ModelContext | None = None) -> str:
    """"a", "a וb", "a, b וc"; "…" for none."""
    ctx = ctx or ModelContext()
    n = [name_of(ctx, i) for i in ids]
    if not n:
        return "…"
    if len(n) == 1:
        return n[0]
    if len(n) == 2:
        return f"{n[0]} ו{n[1]}"
    return f"{', '.join(n[:-1])} ו{n[-1]}"


def duration_text(d: Mapping[str, Any] | None) -> str:
    """"5 דקות", "שעה ו30 דקות"."""
    if not d:
        return ""
    p: list[str] = []
    h, m, s = d.get("hours"), d.get("minutes"), d.get("seconds")
    if h:
        p.append("שעה" if h == 1 else "שעתיים" if h == 2 else f"{num(h)} שעות")
    if m:
        p.append("דקה" if m == 1 else "שתי דקות" if m == 2 else f"{num(m)} דקות")
    if s:
        p.append("שנייה" if s == 1 else "שתי שניות" if s == 2 else f"{num(s)} שניות")
    return " ו".join(p)


WEEKDAYS = policy.WEEKDAYS
WD_SHORT = {"sun": "א׳", "mon": "ב׳", "tue": "ג׳", "wed": "ד׳", "thu": "ה׳", "fri": "ו׳", "sat": "ש׳"}
_CLOCK_ZERO_RE = re.compile(r"^\d{1,2}:\d{2}:00$")


def clock(t: str) -> str:
    return t[:-3] if _CLOCK_ZERO_RE.match(t) else t


def state_word(ids: list[str], to: Any, frm: Any) -> str:
    """What a device "does" when it reaches `to` (by its domain, and for sensors by the id: motion, door, window, leak)."""
    eid = ids[0] if ids else ""
    dom = eid.split(".")[0]
    if to is _UNDEF and frm is _UNDEF:
        return "משתנה"
    if dom == "binary_sensor":
        if re.search(r"motion|occupancy|presence", eid):
            return "מזהה תנועה" if to == "on" else "מפסיק לזהות תנועה"
        if re.search(r"door|window|gate", eid):
            return "נפתח/ת" if to == "on" else "נסגר/ת"
        if re.search(r"leak|water|flood", eid):
            return "מזהה מים" if to == "on" else "מתייבש"
        if re.search(r"smoke|gas|fire", eid):
            return "מזהה עשן" if to == "on" else "חוזר לתקין"
        return "מופעל" if to == "on" else "כבוי"
    if dom in ("person", "device_tracker"):
        if to == "home":
            return "חוזר/ת הביתה" if frm not in (None, _UNDEF, "") else "בבית"
        return "יוצא/ת מהבית" if to == "not_home" else f"ב{js_str(to)}"
    if dom == "climate":
        return "מקרר" if to == "cool" else "מחמם" if to == "heat" else "כבוי" if to == "off" else f"במצב {js_str(to)}"
    if dom == "lock":
        return "ננעל" if to == "locked" else "נפתח" if to == "unlocked" else f"במצב {js_str(to)}"
    if dom == "alarm_control_panel":
        if to == "triggered":
            return "מופעלת"
        if to == "disarmed":
            return "מנוטרלת"
        return "דרוכה" if isinstance(to, str) and to.startswith("armed") else f"במצב {js_str(to)}"
    if dom == "cover":
        return "נפתח" if to == "open" else "נסגר" if to == "closed" else f"במצב {js_str(to)}"
    if to == "on":
        return "נדלק/ת" if dom == "light" else "מופעל/ת"
    if to == "off":
        return "נכבה/ית" if dom == "light" else "כבוי/ה"
    return f'במצב "{js_str(to)}"'


# The verb of a service ("{n}" = where the device names go; without it the names follow the verb).
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


def action_label(action: str) -> str:
    """The short Hebrew label of a service in the action picker (the verb without its placeholder)."""
    return ACTION_VERBS.get(action, action).replace("{n}", "").rstrip("־").strip()


# ---------------------------------------------------------------- locked blocks

LOCK_KEY_LABEL = {
    "variables": "משתנים", "wait_template": "המתנה לתנאי", "wait_for_trigger": "המתנה לאירוע", "parallel": "פעולות במקביל", "sequence": "רצף צעדים",
    "event": "שליחת אירוע", "scene": "הפעלת סצנה (פורמט ישן)", "set_conversation_response": "תגובת שיחה", "stop": "עצירה",
}


def locked_label(raw: Any, reason: str, section: str, ctx: ModelContext | None = None) -> str:
    """The Hebrew label of a locked block (also its sentence)."""
    ctx = ctx or ModelContext()
    r = raw if isinstance(raw, dict) else {}
    if reason == "template":
        return "תבנית"
    if reason == "device":
        did = r.get("device_id")
        name = ctx.device_name(did) if ctx.device_name and isinstance(did, str) else None
        what = name or "מכשיר"
        return f"כפתור · {what}" if section == "trigger" else f"תנאי מכשיר · {what}" if section == "condition" else f"פעולת מכשיר · {what}"
    if reason == "purpose_trigger":
        return f"טריגר ייעודי · {js_str(r.get('trigger')) if r.get('trigger') is not None else ''}"
    if reason == "custom_service":
        svc = r.get("action") if r.get("action") is not None else r.get("service")
        return f"שירות מיוחד · {(js_str(svc) if svc is not None else '').split('.')[0]}"
    if reason == "service_not_allowed":
        svc = r.get("action") if r.get("action") is not None else r.get("service")
        return f"שירות לא מותר · {js_str(svc) if svc is not None else ''}"
    if reason == "disabled_step":
        return "צעד מושבת" if r.get("enabled") is False else "צעד עם המשך בשגיאה"
    if reason == "secret":
        return "ערך חסוי"
    if reason == "code":
        return "קוד חסוי"
    if reason == "unsupported_step":
        key = next((k for k in r if k in LOCK_KEY_LABEL), None)
        if isinstance(r.get("repeat"), dict):
            return "חזרה מתקדמת"
        if key:
            return LOCK_KEY_LABEL[key]
        return "טריגר מתקדם" if section == "trigger" else "תנאי מתקדם" if section == "condition" else "צעד מתקדם"
    return "טריגר לא מוכר" if section == "trigger" else "תנאי לא מוכר" if section == "condition" else "צעד לא מוכר"


# ---------------------------------------------------------------- sentences

def service_sentence(b: Block, ctx: ModelContext) -> str:
    n = join_names(b["entity_ids"], ctx)
    d = b.get("data") or {}
    role, action = b.get("role"), b["action"]
    if role == "scene":
        return f'הפעל סצנה "{n}"'
    if role == "script":
        return f'הרץ "{n}"'
    if role == "automation":
        return f'{ACTION_VERBS.get(action, action)} "{n}"'
    if role == "notify":
        target = ctx.notify_name(action) if ctx.notify_name else None
        if not target:
            target = re.sub(r"^mobile_app_", "", re.sub(r"^notify\.", "", action)).replace("_", " ") or "התראות"
        msg = d.get("message") if isinstance(d.get("message"), str) else ""
        return f'שלח ל{target} "{msg}"' if msg else f"שלח התראה ל{target}"
    verb = ACTION_VERBS.get(action)
    if not verb:
        text = f"{action} · {n}"
    elif "{n}" in verb:
        text = verb.replace("{n}", n)
    elif verb.endswith("־"):
        text = f"{verb}{n}"
    else:
        text = f"{verb} {n}"
    if action == "light.turn_on":
        if _is_num(d.get("brightness_pct")):
            text += f" ל־{num(d['brightness_pct'])}%"
        elif _is_num(d.get("brightness")):
            text += f" ל־{js_round(d['brightness'] / 255 * 100)}%"
    if action == "climate.set_temperature" and _is_num(d.get("temperature")):
        text += f" ל־{num(d['temperature'])}°"
    if action == "cover.set_cover_position" and _is_num(d.get("position")):
        text += f" ל־{num(d['position'])}%"
    if action == "media_player.volume_set" and _is_num(d.get("volume_level")):
        text += f" ל־{js_round(d['volume_level'] * 100)}%"
    if action == "fan.set_percentage" and _is_num(d.get("percentage")):
        text += f" ל־{num(d['percentage'])}%"
    return text


def _join_steps(blocks: Iterable[Block], ctx: ModelContext) -> str:
    return ", ".join(action_sentence(x, ctx, True) for x in blocks)


def _time_pattern_every(v: Any, unit: tuple[str, str, str]) -> str | None:
    m = re.match(r"^/(\d+)$", v) if isinstance(v, str) and v else None
    if not m:
        return None
    return f"כל {unit[0]}" if m.group(1) == "1" else f"כל {m.group(1)} {unit[2]}"


def trigger_sentence(b: Block, ctx: ModelContext | None = None) -> str:
    ctx = ctx or ModelContext()
    if b.get("kind") == "locked":
        return b["label"]
    t = b["type"]
    if t == "state":
        dur = f" במשך {duration_text(b['for'])}" if b.get("for") is not None else ""
        return f"כש{join_names(b['entity_ids'], ctx)} {state_word(b['entity_ids'], b.get('to', _UNDEF), b.get('from', _UNDEF))}{dur}"
    if t == "numeric_state":
        ids, above, below = b["entity_ids"], b.get("above"), b.get("below")
        if len(ids) == 1 and ids[0] == "zone.home" and below == 1 and above is None:
            return "כשכולם יוצאים מהבית"
        rng = (f"בין {num(above)} ל־{num(below)}" if _nn(above) and _nn(below) else f"מעל {num(above)}" if _nn(above)
               else f"מתחת ל־{num(below)}" if _nn(below) else "משתנה")
        dur = f" במשך {duration_text(b['for'])}" if b.get("for") is not None else ""
        return f"כש{join_names(ids, ctx)} {rng}{dur}"
    if t == "time":
        return f"בשעה {clock(b['at'])}"
    if t == "time_pattern":
        mins, hrs, secs = b.get("minutes"), b.get("hours"), b.get("seconds")
        return (_time_pattern_every(mins, ("דקה", "דקות", "דקות")) or _time_pattern_every(hrs, ("שעה", "שעות", "שעות"))
                or _time_pattern_every(secs, ("שנייה", "שניות", "שניות"))
                or (f"בדקה {mins} של כל שעה" if mins and re.match(r"^\d+$", str(mins)) else "לפי תבנית זמן"))
    if t == "sun":
        word = "שקיעה" if b["event"] == "sunset" else "זריחה"
        off = b.get("offset_min") or 0
        return f"{abs(off)} דק׳ {'לפני' if off < 0 else 'אחרי'} ה{word}" if off else f"ב{word}"
    if t == "homeassistant":
        return "כשהמערכת עולה"
    return b.get("label", "")


def condition_sentence(b: Block, ctx: ModelContext | None = None) -> str:
    ctx = ctx or ModelContext()
    if b.get("kind") == "locked":
        return b["label"]
    t = b["type"]
    if t == "state":
        st = b["state"] if isinstance(b["state"], list) else [b["state"]]
        w = state_word(b["entity_ids"], st[0], _UNDEF) if len(st) == 1 else " או ".join(f'"{s}"' for s in st)
        dur = f" במשך {duration_text(b['for'])}" if b.get("for") is not None else ""
        return f"{join_names(b['entity_ids'], ctx)} {w if len(st) == 1 else f'במצב {w}'}{dur}"
    if t == "numeric_state":
        above, below = b.get("above"), b.get("below")
        rng = f"בין {num(above)} ל־{num(below)}" if _nn(above) and _nn(below) else f"מעל {num(above)}" if _nn(above) else f"מתחת ל־{js_str(below)}"
        return f"{join_names(b['entity_ids'], ctx)} {rng}"
    if t == "time":
        p: list[str] = []
        after, before, wd = b.get("after"), b.get("before"), b.get("weekday")
        if after and before:
            p.append(f"בין {clock(after)} ל־{clock(before)}")
        elif after:
            p.append(f"אחרי {clock(after)}")
        elif before:
            p.append(f"לפני {clock(before)}")
        if wd:
            p.append("בכל יום" if len(wd) == 7 else f"בימים {', '.join(WD_SHORT[d] for d in WEEKDAYS if d in wd)}")
        return " ".join(p) or "בכל שעה"
    if t == "sun":
        def w(r: str) -> str:
            return "שקיעה" if r == "sunset" else "זריחה"
        after, before = b.get("after"), b.get("before")
        if after and before:
            return f"בין ה{w(after)} ל{w(before)}"
        return f"אחרי ה{w(after)}" if after else f"לפני ה{w(before)}" if before else "בכל שעה"
    if t == "trigger":
        return "הטריגר הוא " + " או ".join(f'"{i}"' for i in b["ids"])
    if t == "and":
        return " וגם ".join(condition_sentence(c, ctx) for c in b["conditions"])
    if t == "or":
        return " או ".join(condition_sentence(c, ctx) for c in b["conditions"])
    if t == "not":
        return f"לא ({' וגם '.join(condition_sentence(c, ctx) for c in b['conditions'])})"
    if t == "shabbat":
        return "בשבת וחג בלבד" if b["mode"] == "only_holy_days" else "לא בשבת וחג"
    return b.get("label", "")


def action_sentence(b: Block, ctx: ModelContext | None = None, short: bool = False) -> str:
    """One action step. `short` = the one-line form of a nested step ("בחר לפי תנאים (2 ענפים)"); the long form spells the branches."""
    ctx = ctx or ModelContext()
    if b.get("kind") == "locked":
        return b["label"]
    t = b["type"]
    if t == "service":
        return service_sentence(b, ctx)
    if t == "delay":
        return f"המתן {duration_text(b['delay']) or '…'}"
    if t == "choose":
        if short:
            return f"בחר לפי תנאים ({len(b['options'])} ענפים)"
        parts = [f"אם {' ו'.join(condition_sentence(c, ctx) for c in o['conditions']) or '…'} – {_join_steps(o['sequence'], ctx) or '…'}" for o in b["options"]]
        if b.get("default"):
            parts.append(f"אחרת – {_join_steps(b['default'], ctx)}")
        return "; ".join(parts)
    if t == "if":
        els = f", אחרת – {_join_steps(b['else'], ctx)}" if b.get("else") else ""
        return f"אם {' ו'.join(condition_sentence(c, ctx) for c in b['conditions']) or '…'} – {_join_steps(b['then'], ctx) or '…'}{els}"
    if t == "repeat_count":
        return f"חזור {b['count']} פעמים: {_join_steps(b['sequence'], ctx) or '…'}"
    if t == "condition":
        return f"המשך רק אם {condition_sentence(b['condition'], ctx)}"
    if t == "stop":
        return f"עצור: {b['message']}" if b.get("message") else "עצור"
    return b.get("label", "")


def block_sentence(b: Block, section: str, ctx: ModelContext | None = None) -> str:
    """The sentence of one block of any section (what the block's `sentence` holds)."""
    if section == "trigger":
        return trigger_sentence(b, ctx)
    if section == "condition":
        return condition_sentence(b, ctx)
    return action_sentence(b, ctx, True)


def _advanced(n: int) -> str:
    return "פעולה מתקדמת" if n == 1 else f"{n} פעולות מתקדמות"


def steps_phrase(blocks: list[Block], ctx: ModelContext) -> str:
    """Steps as one phrase; locked steps collapse to "ופעולה מתקדמת" (CR section 15.4: the sentence admits there is more than it can say)."""
    typed = [action_sentence(b, ctx) for b in blocks if b.get("kind") == "typed"]
    locked = len(blocks) - len(typed)
    if not locked:
        return "; ".join(typed)
    return f"{'; '.join(typed)} ו{_advanced(locked)}" if typed else _advanced(locked)


def automation_sentence(d: Mapping[str, Any], ctx: ModelContext | None = None) -> str:
    """"כש… או כש… , אם … ו… – פעולה; פעולה"."""
    ctx = ctx or ModelContext()
    tr = [trigger_sentence(t, ctx) for t in d.get("triggers") or []]
    co = [condition_sentence(c, ctx) for c in d.get("conditions") or []]
    s = " או ".join(tr) if tr else "כש…"
    if co:
        s += f", אם {' ו'.join(co)}"
    actions = d.get("actions") or []
    return f"{s} – {steps_phrase(actions, ctx) if actions else '…'}"


def script_sentence(d: Mapping[str, Any], ctx: ModelContext | None = None) -> str:
    ctx = ctx or ModelContext()
    seq = d.get("sequence") or []
    return steps_phrase(seq, ctx) if seq else "…"


def scene_sentence(d: Mapping[str, Any], ctx: ModelContext | None = None) -> str:
    ctx = ctx or ModelContext()
    members = d.get("members") or []
    return f"מכוון {join_names([m['entity_id'] for m in members], ctx)}" if members else "סצנה ריקה"


def draft_sentence(kind: str, draft: Mapping[str, Any], ctx: ModelContext | None = None) -> str:
    if kind == "automation":
        return automation_sentence(draft, ctx)
    if kind == "script":
        return script_sentence(draft, ctx)
    return scene_sentence(draft, ctx)
