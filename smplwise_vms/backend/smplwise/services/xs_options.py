"""Cross-section and synoptic-map options (release 2.29.0, owner decisions 2026-10-29).

`ui.xs` (PATCH /settings, installation-wide, system.configure like every ui.* key) is one JSON object, read back as an object with every key.
Every behaviour of the building cross-section (the floors screen), the synoptic map (a tab of ראשי and the wall screen) and the fire-alarm UI
is an option, and the defaults are the owner's:

  desktop_place   left | right | off      the section in the empty area of the floors screen (default), at the other side, or off
  phone_place     side | card | sheet     a tile beside each card (default; above 12 floors the compact card), a compact card, a sheet button
  many            steps | scroll | near   many floors: cards shrink in steps (default), only the list scrolls, the selected floor and its neighbours
  links           fold | full | hide      "links between floors" folds to one row when space is short (default), is always full, or is not drawn
  click           select | open           a click on a floor in the section selects first (default) or opens at once
  shafts          bool (true)             stairs and lifts drawn on the section
  animate         bool (true)             false = a fade only
  temp_threshold  1 | 2 | 3 | 4           degrees from the target before a floor reads hot / cold (default 2)
  syn_tab         bool (true)             the synoptic map tab of ראשי
  syn_columns     all | few | custom      all signal columns (default), temperature / lighting / alerts, or the columns ticked in syn_custom
  syn_custom      list of columns         the columns of syn_columns=custom, any of light, temp, presence, cameras, doors, alerts, fire
                                          (default: all seven); the board keeps its fixed order whatever the list order is
  syn_hide_empty  bool (true)             a column with no source on any floor of the building (e.g. no temperature sensors) is not drawn
  syn_events      bool (true)             the event strip beside the board on wide screens
  fire_column     hidden | dashed         the fire column before an integration exists: hidden (default) or a dashed "not connected"
  fire_ui         bool (FALSE)            master switch of the alarm UI (the red bar, the acknowledge control). Fire detection is NOT a product
                                          feature yet: nothing reports a fire, the switch only prepares the UI and the labelled demo
  ack             hold | confirm | tap    acknowledging an alarm: a 1.2 s long press (default), press then confirm, a single press
  ack_who         separate | viewers | admin   who may acknowledge: the separate permission fire.acknowledge (default), anyone who sees the board, administrators
  alarm_bar       everywhere | home       the red bar on every screen (default) or only on ראשי and the synoptic map
  wall            bool (true)             the wall screen address (#/kiosk/synoptic) is served

Unknown keys and out-of-range values are refused (422), never dropped silently; keys left out keep their default. The frontend
(frontend/src/xsection/xs-model.ts) keeps the same keys and defaults."""
from __future__ import annotations

from typing import Any

ENUMS: dict[str, tuple[str, ...]] = {
    "desktop_place": ("left", "right", "off"),
    "phone_place": ("side", "card", "sheet"),
    "many": ("steps", "scroll", "near"),
    "links": ("fold", "full", "hide"),
    "click": ("select", "open"),
    "syn_columns": ("all", "few", "custom"),
    "fire_column": ("hidden", "dashed"),
    "ack": ("hold", "confirm", "tap"),
    "ack_who": ("separate", "viewers", "admin"),
    "alarm_bar": ("everywhere", "home"),
}
BOOLS: tuple[str, ...] = ("shafts", "animate", "syn_tab", "syn_events", "syn_hide_empty", "fire_ui", "wall")
SYN_COLUMNS: tuple[str, ...] = ("light", "temp", "presence", "cameras", "doors", "alerts", "fire")
THRESHOLDS: tuple[int, ...] = (1, 2, 3, 4)

DEFAULT: dict[str, Any] = {
    "desktop_place": "left",
    "phone_place": "side",
    "many": "steps",
    "links": "fold",
    "click": "select",
    "shafts": True,
    "animate": True,
    "temp_threshold": 2,
    "syn_tab": True,
    "syn_columns": "all",
    "syn_custom": list(SYN_COLUMNS),
    "syn_hide_empty": True,
    "syn_events": True,
    "fire_column": "hidden",
    "fire_ui": False,
    "ack": "hold",
    "ack_who": "separate",
    "alarm_bar": "everywhere",
    "wall": True,
}


def normalize(value: Any) -> dict[str, Any]:
    """The value in its canonical form (every key present), or ValueError."""
    if not isinstance(value, dict):
        raise ValueError("xs options must be an object")
    unknown = sorted(set(value) - set(DEFAULT))
    if unknown:
        raise ValueError("unknown xs option: " + ", ".join(str(k) for k in unknown))
    out = {k: (list(v) if isinstance(v, list) else v) for k, v in DEFAULT.items()}
    for key, item in value.items():
        if key in ENUMS:
            if not isinstance(item, str) or item not in ENUMS[key]:
                raise ValueError(f"xs option {key} must be one of {', '.join(ENUMS[key])}")
        elif key in BOOLS:
            if not isinstance(item, bool):
                raise ValueError(f"xs option {key} must be true or false")
        elif key == "temp_threshold":
            if isinstance(item, bool) or not isinstance(item, int) or item not in THRESHOLDS:
                raise ValueError("xs option temp_threshold must be 1, 2, 3 or 4")
        elif key == "syn_custom":
            if not isinstance(item, list) or any(not isinstance(c, str) or c not in SYN_COLUMNS for c in item) or len(set(item)) != len(item):
                raise ValueError("xs option syn_custom must be a list of distinct columns: " + ", ".join(SYN_COLUMNS))
            item = [c for c in SYN_COLUMNS if c in item]  # canonical: the board order
        out[key] = item
    return out
