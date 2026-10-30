"""HOME-295 (owner answers on home mockup round 2, 2026-10-25): the home screen's display options, ONE installation setting.

`home.screen` (PATCH /settings, system.configure like every home.* key; a JSON object read back as an object with every key
present). Every choice the owner answered is only the DEFAULT; each one is a key here:

  summary_tiles     null = every kind the site has devices of (default) | an ordered list of SUMMARY_KINDS - the summary tiles row
  summary_chooser   admin (default: the administrator chooses for everyone) | user (a holder of screen.personalize may choose
                    his own tiles in /me/prefs `home.personal.screen.summary_tiles`)
  area_quick        {area_id: [QUICK_KINDS...]} - the quick actions of one area (screen editor; an area that is not listed shows the
                    kinds it has, in the order lights > climate > covers > switches, at most DEFAULT_QUICK_MAX)
  row_actions       quick (default: the cards-mode area row shows the first two quick actions of the area) | indicators (the row
                    shows the indicators of devices.area_row, as before 2.22.0)
  tile_blinds       pct (default: one button with the open count, a tap offers open / stop / close) | buttons (open and close)
  tile_climate      both (default: the target on the button, the room temperature in the header) | target | room
  phone_area        sheet (default) | full - how an area opens on a phone (a user may choose his own, home.personal.screen)
  desktop_area      drawer (default) | popup | screen - how an area opens on a desktop / tablet (AREAPOPUP-297): the quick-control
                    side drawer, the quick-control pop-up that grows out of the pressed tile, or the area's own screen as before
  floor_off         menu (default: one "turn off floor" button with a menu) | buttons (two direct buttons: lights / everything)
  many_floors       more (default: four floor cards, the rest through "more floors" in the tree) | tree_scroll (the tree lists every
                    floor and scrolls inside its own panel)
  building_off_tablet  hide (default: on a landscape tablet the "turn off building" card drops; the action stays in the floor menu)
                    | keep
  quick_card        show (default: the home's "quick actions" widget - the lights-off / all-off pills - is drawn) | hide (the widget is
                    absent; the summary tiles and the floor menu carry the same actions and the next card takes the whole row)
  popup_alert       show (default: a sensor the manager hid in the area pop-up appears there, red, while it is in alarm) | hide
                    (stays hidden; the alert still arrives as a notice) - AREAEDIT-2290
  popup             {version, site, areas} - the area pop-up layout (sections / sensors hidden and ordered): a site default plus one
                    override per area, versioned for the editor's conflict check (services/popup_layout.py) - AREAEDIT-2290
  phone_floors      selector (default: a phone shows one floor at a time, with the floor switch and the tree button) | all (every floor
                    card stacked one after another down the page; no switch, no tree button). Tablet and desktop are unchanged

The view (cards / tiles) stays `devices.default_view` (default cards), the info row `home.info_style` (auto: cards in cards mode,
a thin bar in tiles mode) and the customer logo on dark `brand.dark_mode` (default invert): one key per choice, no duplicates.
Presentation only: no permission depends on any of it (the bulk actions behind a quick action are authorised by the server).
Unknown keys and unknown, repeated or non-string ids are refused (422), never dropped silently; keys left out keep their default.
"""
from __future__ import annotations

import copy
from typing import Any

SUMMARY_KINDS: tuple[str, ...] = ("lights", "switches", "covers", "climate", "heating", "media", "locks", "sensors", "cameras", "alarm")
QUICK_KINDS: tuple[str, ...] = ("lights", "climate", "covers", "switches")
DEFAULT_QUICK_MAX = 3
AREA_QUICK_MAX = 2000  # areas listed in area_quick
AREA_ID_MAX = 120

CHOICES: dict[str, tuple[str, ...]] = {
    "summary_chooser": ("admin", "user"),
    "row_actions": ("quick", "indicators"),
    "tile_blinds": ("pct", "buttons"),
    "tile_climate": ("both", "target", "room"),
    "phone_area": ("sheet", "full"),
    "desktop_area": ("drawer", "popup", "screen"),
    "floor_off": ("menu", "buttons"),
    "many_floors": ("more", "tree_scroll"),
    "building_off_tablet": ("hide", "keep"),
    "quick_card": ("show", "hide"),
    "phone_floors": ("selector", "all"),
    "popup_alert": ("show", "hide"),
}

DEFAULT: dict[str, Any] = {
    "summary_tiles": None,
    "summary_chooser": "admin",
    "area_quick": {},
    "row_actions": "quick",
    "tile_blinds": "pct",
    "tile_climate": "both",
    "phone_area": "sheet",
    "desktop_area": "drawer",
    "floor_off": "menu",
    "many_floors": "more",
    "building_off_tablet": "hide",
    "quick_card": "show",
    "phone_floors": "selector",
    "popup_alert": "show",
    "popup": {"version": 0, "site": None, "areas": {}},
}
KEYS: tuple[str, ...] = tuple(DEFAULT)

# what a user may choose for himself (home.personal.screen): his summary tiles (only while summary_chooser = user) and the phone area
PERSONAL_KEYS: tuple[str, ...] = ("summary_tiles", "phone_area")


def _kinds(value: Any, allowed: tuple[str, ...], name: str) -> list[str]:
    if not isinstance(value, list):
        raise ValueError(f"{name} must be a list")
    if len(value) > len(allowed):
        raise ValueError(f"{name} has too many entries")
    out: list[str] = []
    for item in value:
        if not isinstance(item, str) or item not in allowed:
            raise ValueError(f"{name}: unknown kind {item!r}")
        if item in out:
            raise ValueError(f"{name}: {item} is listed twice")
        out.append(item)
    return out


def _choice(value: Any, key: str, name: str) -> str:
    allowed = CHOICES[key]
    if not isinstance(value, str) or value not in allowed:
        raise ValueError(f"{name} must be one of {', '.join(allowed)}")
    return value


def _area_quick(value: Any, name: str) -> dict[str, list[str]]:
    if not isinstance(value, dict) or len(value) > AREA_QUICK_MAX:
        raise ValueError(f"{name} must be an object of area id to a list of quick actions")
    out: dict[str, list[str]] = {}
    for area, kinds in value.items():
        if not isinstance(area, str) or not 0 < len(area) <= AREA_ID_MAX:
            raise ValueError(f"{name}: bad area id {area!r}")
        out[area] = _kinds(kinds, QUICK_KINDS, f"{name}.{area}")
    return out


def _object(value: Any, name: str, allowed: tuple[str, ...]) -> dict[str, Any]:
    if not isinstance(value, dict):
        raise ValueError(f"{name} must be an object")
    unknown = sorted(set(value) - set(allowed))
    if unknown:
        raise ValueError(f"{name}: unknown key " + ", ".join(str(k) for k in unknown))
    return value


def default() -> dict[str, Any]:
    return copy.deepcopy(DEFAULT)


def normalize(value: Any, base: dict[str, Any] | None = None) -> dict[str, Any]:
    """`home.screen` in its canonical form (every key present), or ValueError. A PATCH is partial: the keys it leaves out keep
    `base` (the stored value; the defaults when nothing was saved). `summary_tiles: null` = back to every kind."""
    given = _object(value, "home.screen", KEYS)
    out = copy.deepcopy(base) if base is not None else default()
    for key in KEYS:
        out.setdefault(key, copy.deepcopy(DEFAULT[key]))
    if "summary_tiles" in given:
        out["summary_tiles"] = None if given["summary_tiles"] is None else _kinds(given["summary_tiles"], SUMMARY_KINDS, "home.screen.summary_tiles")
    if "area_quick" in given:
        out["area_quick"] = _area_quick(given["area_quick"], "home.screen.area_quick")
    if "popup" in given:
        from . import popup_layout

        out["popup"] = popup_layout.normalize_popup(given["popup"])
    for key in CHOICES:
        if key in given:
            out[key] = _choice(given[key], key, f"home.screen.{key}")
    return out


def stored(raw: Any) -> dict[str, Any]:
    """The stored value as an object with every key; nothing stored, or a corrupt value, reads as the defaults."""
    import json

    if raw in (None, ""):
        return default()
    try:
        return normalize(json.loads(raw) if isinstance(raw, str) else raw)
    except (ValueError, TypeError):
        return default()


def normalize_personal(value: Any) -> dict[str, Any]:
    """`home.personal.screen` (/me/prefs, screen.personalize): {"summary_tiles": [...]|null, "phone_area": sheet|full|null};
    canonical form keeps only what says something. The site's summary_chooser decides whether the tiles are honoured."""
    given = _object(value, "home.personal.screen", PERSONAL_KEYS)
    out: dict[str, Any] = {}
    if given.get("summary_tiles") is not None:
        out["summary_tiles"] = _kinds(given["summary_tiles"], SUMMARY_KINDS, "home.personal.screen.summary_tiles")
    if given.get("phone_area") is not None:
        out["phone_area"] = _choice(given["phone_area"], "phone_area", "home.personal.screen.phone_area")
    return out
