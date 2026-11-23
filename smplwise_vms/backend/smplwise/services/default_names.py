"""I18N-EN-2490 (owner answer N53 / Q15 = b, "translate at creation"): the default names and titles the SERVER writes into stored data
when the caller gave none - a room the plan wizard accepted unnamed, a manual live incident, a case opened from a suggested route, a
generator registered without a name, the split half of a schedule, an automation made from a ready template, a request approved from
the intake queue without a subject, the NVR channel name written to the camera picture.

Rule: the name is made ONCE, at creation, in the interface language of the user whose request creates it (`ui.lang`, the personal
preference of services/user_prefs.py; no stored value = Hebrew, the product's language). It is data from then on: a later reader in
another language sees it as it was written, and nothing stored before this change is rewritten (no migration). A name made with no
requesting user (a background pass, an automatic alarm hook, a scenario run) stays Hebrew.

Not here, on purpose (the inventory in docs/changes/I18N-EN-2490.md section 5):
- display fallbacks that are never stored (an unnamed camera's "ערוץ 3" in a list, "ללא שם" in a picker) - they belong to the
  screens' own catalogues;
- names that are COMPARED later: the guest name Arx writes to WisKey ("אורח", services/access_external.arx_name and the dispatch of
  services/access_grants) is re-derived by the background name pass and checked by digest, so a per-user language would read as drift;
- tags and other matched words (the case tag "מסלול מוצע").

The Hebrew of every entry is exactly the text the code wrote before this change, so a Hebrew user's stored names are unchanged.
"""
from __future__ import annotations

import json
import re
import sqlite3
from typing import Any

LANGS: tuple[str, ...] = ("he", "en")  # the interface languages offered (services/user_prefs.UI_LANGS)
DEFAULT_LANG = "he"

TEXTS: dict[str, dict[str, str]] = {
    # routers/zones.py accept_zones: an accepted room candidate the user left unnamed
    "zone.room": {"he": "חדר {n}", "en": "Room {n}"},
    # routers/incidents.py: a live incident opened by hand without a title
    "incident.manual": {"he": "אירוע ידני", "en": "Manual incident"},
    "incident.manual_at": {"he": "אירוע ידני · {name}", "en": "Manual incident · {name}"},
    "incident.event_at": {"he": "{label} · {camera}", "en": "{label} · {camera}"},
    # routers/incidents.py (the alarm screen's button) and services/incidents.alarm_location: the burglary alarm incident
    "incident.burglary": {"he": "אזעקת פריצה", "en": "Burglary alarm"},
    "incident.burglary_at": {"he": "אזעקת פריצה · {name}", "en": "Burglary alarm · {name}"},
    # routers/cases.py: a case opened from a suggested route, and an imported bundle without a case title
    "case.route": {"he": "מסלול מוצע · {camera} · {time}", "en": "Suggested route · {camera} · {time}"},
    "case.route_event": {"he": "אירוע", "en": "Event"},
    "case.imported": {"he": "תיק מיובא", "en": "Imported case"},
    # services/generator_core.py: a generator whose device has no name
    "generator": {"he": "גנרטור", "en": "Generator"},
    # services/door_conversion.py: the door window a door-opening schedule is handed over to
    "door_window": {"he": "חלון פתיחה", "en": "Door window"},
    "door_window.moved_note": {"he": "הועבר מתזמון שפתח את הדלת", "en": "Moved from a schedule that opened the door"},
    # services/schedule_ops.py split: "<name> · <the days moved>"
    "schedule.split": {"he": "{name} · {days}", "en": "{name} · {days}"},
    # routers/nvr_write.py: the channel name written to the NVR when the camera has no name at all
    "nvr.channel": {"he": "ערוץ {n}", "en": "Channel {n}"},
    # services/tickets/intake.py approve: a request approved from the intake queue without a subject ({ticket}: the module's own name,
    # services/tickets/naming.py, rendered in the same language)
    "ticket.from_place": {"he": "פנייה - {place}", "en": "{ticket} - {place}"},
    "ticket.no_subject": {"he": "פנייה ללא נושא", "en": "{ticket} without a subject"},
}

# services/schedule_ops.DAY_SHORT in English (the split name lists the days it moved)
DAY_SHORT: dict[str, dict[str, str]] = {
    "he": {"sun": "א׳", "mon": "ב׳", "tue": "ג׳", "wed": "ד׳", "thu": "ה׳", "fri": "ו׳", "sat": "ש׳"},
    "en": {"sun": "Sun", "mon": "Mon", "tue": "Tue", "wed": "Wed", "thu": "Thu", "fri": "Fri", "sat": "Sat"},
}

# services/incidents.EVENT_TYPE_HE in English (an incident opened from an event is titled "<event type> · <camera>"); the words of the
# frontend's event-code catalogue (frontend/src/i18n/lang/en/i18n/event-codes.ts)
EVENT_TYPE_EN: dict[str, str] = {
    "motion": "Motion", "person": "Person", "vehicle": "Vehicle", "line": "Line crossing", "field": "Intrusion", "offline": "Video loss",
    "tamper": "Camera tampering", "door": "Door", "io": "Alarm input", "storage": "Storage", "system": "System", "manual": "Manual recording",
}

# services/automation_blueprints.LIBRARY: the alias an automation made from a ready template takes when the user names none
BLUEPRINT_TITLE_EN: dict[str, str] = {
    "lights_off_floor_empty_night": "Lights off when the area is empty at night",
    "door_left_open_notify": "Alert for a door or window left open",
    "temperature_out_of_range": "Temperature out of range alert",
    "scheduled_scene": "Run a scene at a fixed time",
    "motion_light_timer": "Motion lighting with automatic off",
    "water_leak_notify": "Water leak alert",
    "ac_off_window_open": "Air conditioner off when a window is open",
    "area_lights_at_sunset": "Area lights at sunset",
}

_SLOT = re.compile(r"\{(\w+)\}")


def lang_of_user(conn: sqlite3.Connection, user_id: str | None) -> str:
    """The user's interface language (`ui.lang`), or Hebrew: no user, no stored value, or a value that is not offered."""
    if not user_id:
        return DEFAULT_LANG
    try:
        row = conn.execute("SELECT value_json FROM user_prefs WHERE user_id = ? AND key = 'ui.lang'", (user_id,)).fetchone()
        value = json.loads(row[0]) if row is not None else None
    except (sqlite3.Error, ValueError, TypeError):
        return DEFAULT_LANG
    return value if isinstance(value, str) and value in LANGS else DEFAULT_LANG


def lang_of(conn: sqlite3.Connection, principal: Any) -> str:
    """The requesting principal's interface language (Hebrew without one)."""
    return lang_of_user(conn, getattr(principal, "user_id", None) if principal is not None else None)


def template(key: str, lang: str) -> str:
    """One entry's raw text in `lang` (Hebrew when the language has none)."""
    entry = TEXTS[key]
    return entry.get(lang) or entry[DEFAULT_LANG]


def fill(text: str, **values: Any) -> str:
    """`{name}` slots filled in ONE pass, so a value that itself holds braces is never read as a slot; an unknown slot stays."""
    return _SLOT.sub(lambda m: str(values[m.group(1)]) if m.group(1) in values else m.group(0), text)


def name(key: str, lang: str, **values: Any) -> str:
    """A default name in `lang`, its slots filled."""
    return fill(template(key, lang), **values)


def day_short(day: str, lang: str) -> str:
    return (DAY_SHORT.get(lang) or DAY_SHORT[DEFAULT_LANG]).get(day) or DAY_SHORT[DEFAULT_LANG][day]


def event_type(kind: str, he_label: str, lang: str) -> str:
    """An event type's word for an incident title: the Hebrew label as given, or its English."""
    return EVENT_TYPE_EN.get(kind, he_label) if lang == "en" else he_label


def blueprint_title(bp: dict[str, Any], lang: str) -> str:
    """A ready template's title as the default alias of the automation made from it."""
    return BLUEPRINT_TITLE_EN.get(str(bp.get("id")), str(bp["title"])) if lang == "en" else str(bp["title"])
