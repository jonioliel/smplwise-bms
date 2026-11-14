"""What the home screen shows next to an area's name and in a floor's header (owner request 2026-09-30, release 0.1.149).

Two installation settings (PATCH /settings, system.configure like every devices.* key), each a JSON object read back as an
object with every key present:

  devices.area_row   {"items": [...], "climate": "icon|temp|mode", "show_empty": false, "climate_mode": "mean|lead",
                      "climate_lead": {area_id: climate entity_id}, "only_active": [...]}
      `items` - the indicators shown on one line after the area's name, in this order (an id that is not listed is not
      shown; the opened area screen always has everything): climate | temperature | lights | switches | covers | media |
      openings | locks | alarm.  `climate` - what the single air-conditioning indicator says next to its icon: nothing (icon),
      the room temperature (temp) or the working mode (mode).  `show_empty` - a counter whose value is zero is hidden
      unless this is true, except the items listed in `only_active` ("show only when something is on / open / unlocked"; by default
      the open doors and the unlocked locks), which are never drawn idle. `climate_mode` - with several air conditioners in one area:
      `mean` (the mean temperature of the running ones and how many run) or `lead` (one unit leads, its own temperature and mode are
      shown; `climate_lead` names it per area, absent = the first running one).
  devices.floor_row  {"items": [...]}
      The floor header's count chips, in this order: lights | switches | covers | climate | media | locks | sensors | cameras.

A user who holds `screen.personalize` may override both for themselves (/me/prefs `home.personal.area_row`, same keys, each
optional; `floor_items` for the floor header); the server stores what the user sent and the screen lays it over the
installation's value only while the permission is held. Presentation only: no permission depends on any of it. Unknown keys and
unknown, repeated or non-string ids are refused (422), never dropped silently; keys left out keep their default."""
from __future__ import annotations

import re
from typing import Any

AREA_ITEMS: tuple[str, ...] = ("climate", "temperature", "lights", "switches", "covers", "media", "openings", "locks", "alarm")
FLOOR_ITEMS: tuple[str, ...] = ("lights", "switches", "covers", "climate", "media", "locks", "sensors", "cameras")
CLIMATE_DISPLAYS: tuple[str, ...] = ("icon", "temp", "mode")

# short by default: the A/C indicator with the room temperature, what is lit, what is playing. Everything else is one tick away
# in the settings and always in the opened area.
AREA_ROW_DEFAULT: dict[str, Any] = {"items": ["climate", "lights", "switches", "media"], "climate": "temp", "show_empty": False, "climate_mode": "mean", "climate_lead": {}, "only_active": ["openings", "locks"]}
FLOOR_ROW_DEFAULT: dict[str, Any] = {"items": ["lights", "switches", "covers", "climate", "media", "locks", "sensors"]}

# the items that have an idle state (zero / closed / locked) the row may hide
ACTIVE_ITEMS: tuple[str, ...] = ("lights", "switches", "covers", "media", "openings", "locks")
CLIMATE_MODES: tuple[str, ...] = ("mean", "lead")
LEAD_MAX = 400
_ENTITY = re.compile(r"^climate\.[a-z0-9_]{1,100}$")

PERSONAL_KEYS = ("items", "climate", "show_empty", "floor_items", "climate_mode", "climate_lead", "only_active")


def _items(value: Any, allowed: tuple[str, ...], name: str) -> list[str]:
    if not isinstance(value, list):
        raise ValueError(f"{name} must be a list")
    if len(value) > len(allowed):
        raise ValueError(f"{name} has too many entries")
    out: list[str] = []
    for item in value:
        if not isinstance(item, str) or item not in allowed:
            raise ValueError(f"{name}: unknown item {item!r}")
        if item in out:
            raise ValueError(f"{name}: {item} is listed twice")
        out.append(item)
    return out


def _climate(value: Any, name: str) -> str:
    if not isinstance(value, str) or value not in CLIMATE_DISPLAYS:
        raise ValueError(f"{name} must be one of {', '.join(CLIMATE_DISPLAYS)}")
    return value


def _lead(value: Any, name: str, blank: bool = False) -> dict[str, str]:
    if not isinstance(value, dict) or len(value) > LEAD_MAX:
        raise ValueError(f"{name} must be an object of area id to climate entity id")
    out: dict[str, str] = {}
    for area, entity in value.items():
        # a personal override may say "" for an area: no leading unit there (the first running one), over the installation's choice
        if not isinstance(area, str) or not 0 < len(area) <= 120 or not isinstance(entity, str) or not ((blank and entity == "") or _ENTITY.match(entity)):
            raise ValueError(f"{name}: bad entry {area!r}")
        out[area] = entity
    return out


def _mode(value: Any, name: str) -> str:
    if not isinstance(value, str) or value not in CLIMATE_MODES:
        raise ValueError(f"{name} must be one of {', '.join(CLIMATE_MODES)}")
    return value


def _bool(value: Any, name: str) -> bool:
    if not isinstance(value, bool):
        raise ValueError(f"{name} must be true or false")
    return value


def _object(value: Any, name: str, allowed: tuple[str, ...]) -> dict[str, Any]:
    if not isinstance(value, dict):
        raise ValueError(f"{name} must be an object")
    unknown = sorted(set(value) - set(allowed))
    if unknown:
        raise ValueError(f"{name}: unknown key " + ", ".join(str(k) for k in unknown))
    return value


def normalize_area(value: Any) -> dict[str, Any]:
    """devices.area_row in its canonical form (every key present), or ValueError."""
    given = _object(value, "area_row", ("items", "climate", "show_empty", "climate_mode", "climate_lead", "only_active"))
    out: dict[str, Any] = {"items": list(AREA_ROW_DEFAULT["items"]), "climate": AREA_ROW_DEFAULT["climate"], "show_empty": AREA_ROW_DEFAULT["show_empty"],
                           "climate_mode": AREA_ROW_DEFAULT["climate_mode"], "climate_lead": {}, "only_active": list(AREA_ROW_DEFAULT["only_active"])}
    if "items" in given:
        out["items"] = _items(given["items"], AREA_ITEMS, "area_row.items")
    if "climate" in given:
        out["climate"] = _climate(given["climate"], "area_row.climate")
    if "show_empty" in given:
        out["show_empty"] = _bool(given["show_empty"], "area_row.show_empty")
    if "climate_mode" in given:
        out["climate_mode"] = _mode(given["climate_mode"], "area_row.climate_mode")
    if "climate_lead" in given:
        out["climate_lead"] = _lead(given["climate_lead"], "area_row.climate_lead")
    if "only_active" in given:
        out["only_active"] = _items(given["only_active"], ACTIVE_ITEMS, "area_row.only_active")
    return out


def normalize_floor(value: Any) -> dict[str, Any]:
    """devices.floor_row in its canonical form, or ValueError."""
    given = _object(value, "floor_row", ("items",))
    return {"items": _items(given["items"], FLOOR_ITEMS, "floor_row.items") if "items" in given else list(FLOOR_ROW_DEFAULT["items"])}


def normalise_personal(value: Any) -> dict[str, Any]:
    """`home.personal.area_row`: the user's own override, every key optional (null / missing = follow the installation).
    Canonical form: only the keys the user set; ValueError for anything else."""
    given = _object(value, "home.personal.area_row", PERSONAL_KEYS)
    out: dict[str, Any] = {}
    if given.get("items") is not None:
        out["items"] = _items(given["items"], AREA_ITEMS, "home.personal.area_row.items")
    if given.get("climate") is not None:
        out["climate"] = _climate(given["climate"], "home.personal.area_row.climate")
    if given.get("show_empty") is not None:
        out["show_empty"] = _bool(given["show_empty"], "home.personal.area_row.show_empty")
    if given.get("climate_mode") is not None:
        out["climate_mode"] = _mode(given["climate_mode"], "home.personal.area_row.climate_mode")
    if given.get("climate_lead") is not None:
        out["climate_lead"] = _lead(given["climate_lead"], "home.personal.area_row.climate_lead", blank=True)
    if given.get("only_active") is not None:
        out["only_active"] = _items(given["only_active"], ACTIVE_ITEMS, "home.personal.area_row.only_active")
    if given.get("floor_items") is not None:
        out["floor_items"] = _items(given["floor_items"], FLOOR_ITEMS, "home.personal.area_row.floor_items")
    return out
