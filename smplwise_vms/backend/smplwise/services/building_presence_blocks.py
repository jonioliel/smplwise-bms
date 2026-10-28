"""BUILDING-PRESENCE-2271 (board r339, plan section 5.2): the cockpit's two presence blocks, compiled to PLAIN automation configuration.

The automations run in the automation host, which cannot read an Arx aggregate. So the blocks are typed views over a fixed template shape
that reads the tagged sensors directly (no helper entity is created, nothing in the host is changed):

- trigger   `building_empty`  - "the building is empty for N minutes": every listed sensor is `off` (an unavailable / unknown sensor keeps
                                 the building "not empty", exactly like the Arx aggregate), held for N minutes (the `for` of the trigger).
- condition `room_occupied`   - `mode: occupied` (at least one listed sensor is `on`) or `mode: empty` (all are `off`), for the whole building
                                 or for one room (the sensors the editor picked).

The blocks exist only while the owner has tagged presence sensors (`ModelContext.building_presence`); a stored step with the same template shape
is read as a typed block only then and stays a locked template otherwise. The parse is strict (the exact text these builders write), so any
hand-edited template remains locked. Pure functions, no I/O."""
from __future__ import annotations

import re
from typing import Any, Mapping

from .automation_policy import is_entity_id

TRIGGER_TYPE = "building_empty"
CONDITION_TYPE = "room_occupied"
MODES = ("occupied", "empty")
MAX_MINUTES = 1440
MAX_SENSORS = 200

_LIST = r"\[((?:'[a-z0-9_]+\.[a-z0-9_]+'(?:, )?)+)\]"
_EMPTY_RE = re.compile(r"^\{\{ " + _LIST + r" \| reject\('is_state', 'off'\) \| list \| count == 0 \}\}$")
_OCCUPIED_RE = re.compile(r"^\{\{ " + _LIST + r" \| select\('is_state', 'on'\) \| list \| count > 0 \}\}$")


def _ids(text: str) -> list[str] | None:
    ids = re.findall(r"'([^']+)'", text)
    return ids if ids and all(is_entity_id(i) for i in ids) else None


def template_for(mode: str, sensors: list[str]) -> str:
    """The exact template text for `mode` (`occupied` | `empty`) over `sensors`."""
    lst = "[" + ", ".join(f"'{s}'" for s in sensors) + "]"
    if mode == "occupied":
        return f"{{{{ {lst} | select('is_state', 'on') | list | count > 0 }}}}"
    return f"{{{{ {lst} | reject('is_state', 'off') | list | count == 0 }}}}"


def read_template(text: Any) -> tuple[str, list[str]] | None:
    """(mode, sensors) of a template written by `template_for`, else None."""
    if not isinstance(text, str):
        return None
    for mode, rx in (("empty", _EMPTY_RE), ("occupied", _OCCUPIED_RE)):
        m = rx.match(text)
        if m:
            ids = _ids(m.group(1))
            return (mode, ids) if ids and len(ids) <= MAX_SENSORS else None
    return None


def minutes_of(duration: Mapping[str, Any] | None) -> int | None:
    """Whole minutes of a Duration dict, or None when it is not a whole number of minutes in 1..MAX_MINUTES."""
    if not duration:
        return None
    secs = (duration.get("hours") or 0) * 3600 + (duration.get("minutes") or 0) * 60 + (duration.get("seconds") or 0)
    if secs <= 0 or secs % 60 or secs // 60 > MAX_MINUTES:
        return None
    return int(secs // 60)


def duration_of(minutes: int) -> dict[str, int]:
    return {"hours": minutes // 60, "minutes": minutes % 60, "seconds": 0}


def parse_trigger(raw: Mapping[str, Any], parsed_for: Mapping[str, Any] | None) -> dict[str, Any] | None:
    """The typed fields of a `building_empty` trigger, or None. `parsed_for` is the already parsed `for` Duration."""
    got = read_template(raw.get("value_template"))
    mins = minutes_of(parsed_for)
    if not got or got[0] != "empty" or mins is None:
        return None
    return {"type": TRIGGER_TYPE, "sensors": got[1], "minutes": mins}


def parse_condition(raw: Mapping[str, Any]) -> dict[str, Any] | None:
    got = read_template(raw.get("value_template"))
    if not got:
        return None
    return {"type": CONDITION_TYPE, "mode": got[0], "sensors": got[1]}


def build_trigger(b: Mapping[str, Any]) -> dict[str, Any]:
    return {"trigger": "template", "value_template": template_for("empty", list(b["sensors"])), "for": duration_of(int(b["minutes"]))}


def build_condition(b: Mapping[str, Any]) -> dict[str, Any]:
    return {"condition": "template", "value_template": template_for(b["mode"], list(b["sensors"]))}


def trigger_sentence(b: Mapping[str, Any]) -> str:
    n = int(b.get("minutes") or 0)
    return f"כשהמבנה ריק במשך {n} דקות" if n != 1 else "כשהמבנה ריק במשך דקה"


def condition_sentence(b: Mapping[str, Any], building_sensors: list[str] | None = None, names: Any = None) -> str:
    """"יש נוכחות במבנה" for the whole building (the block lists exactly the tagged sensors), else "ב<names>"."""
    occupied = b.get("mode") != "empty"
    word = "יש נוכחות" if occupied else "אין נוכחות"
    sensors = list(b.get("sensors") or [])
    if building_sensors is not None and set(sensors) == set(building_sensors):
        return f"{word} במבנה"
    if names:
        return f"{word} ב" + " · ".join(names(s) for s in sensors[:3]) + (f" ועוד {len(sensors) - 3}" if len(sensors) > 3 else "")
    return f"{word} באזור שנבחר"


def validate(b: Mapping[str, Any], section: str, tagged: list[str] | None, enabled: bool) -> list[tuple[str, str]]:
    """(code, Hebrew message) per problem of a NEW / CHANGED block."""
    out: list[tuple[str, str]] = []
    if not enabled:
        out.append(("building_presence_off", "אין חיישני נוכחות מסומנים במבנה"))
        return out
    sensors = b.get("sensors")
    if not isinstance(sensors, list) or not sensors or len(sensors) > MAX_SENSORS or not all(isinstance(s, str) and is_entity_id(s) for s in sensors):
        out.append(("presence_sensors_required", "בחרו חיישני נוכחות"))
    elif tagged is not None and any(s not in tagged for s in sensors):
        out.append(("presence_sensor_untagged", "החיישן אינו מסומן כחיישן נוכחות"))
    if section == "trigger":
        m = b.get("minutes")
        if isinstance(m, bool) or not isinstance(m, int) or not 1 <= m <= MAX_MINUTES:
            out.append(("presence_minutes_invalid", "הגדירו זמן בדקות (1 עד 1440)"))
    elif b.get("mode") not in MODES:
        out.append(("presence_mode_invalid", "בחרו מצב"))
    return out
