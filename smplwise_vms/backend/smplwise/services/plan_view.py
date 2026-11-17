"""Plan Studio 6 look settings (CR-029 S0, LOOK_SPEC section 10; owner rule 2026-10-09: every look choice stays changeable
later in settings). Two layers, the ui.look pattern:

- the installation's `plan.view` (settings table, system.configure, audited as settings.update, in every backup): every
  dial, the defaults below until an administrator changes them;
- a person's own partial override (table plan_view_prefs, migration 0074, map.read, audited as plan.view_prefs, in every
  backup): only the dials of USER_DIALS, each one following the installation when not set.

The view applies `effective` = installation <- own. Presentation only: nothing here grants or limits access, and the
dials never reach a device. Defaults are the owner's 2026-10-09 answers: schematic for everyone (realistic is a person's
own choice), the furniture models and the CC0 texture files on, the wall display live, eye 1.65 m, drag-to-look.

Per-display / per-device choices (the kiosk's live-or-stills, its idle seconds, the quality rung and the DPR cap of one
tablet) take the installation value here and may be overridden in that browser only (frontend localStorage, S5) - a wall
tablet has no person of its own.
"""
from __future__ import annotations

import json
import math
import sqlite3
from typing import Any

from ..db import now_iso

KEY = "plan.view"
# every dial: allowed values (a tuple) or a numeric range (lo, hi, step)
CHOICES: dict[str, tuple[Any, ...]] = {
    "style": ("auto", "light", "dark"),          # auto = follow the UI theme (light -> architectural, dark -> digital twin)
    "default_view": ("schematic", "realistic"),  # the level a 3D view opens with
    "furniture": ("models", "procedural"),       # CC0 models per catalog item (procedural fallback per item) or procedural only
    "textures": ("files", "procedural"),         # the CC0 texture sets by id, or the procedural detail
    "wall_display": ("live", "stills"),          # the wall tablet: live 3D, or the pre-rendered stills
    "time_source": ("clock", "manual"),          # the site's clock (time.zone) or the slider
    "mouse_mode": ("drag", "lock", "auto"),      # walk mouse look: drag, pointer lock, or lock where the frame allows it
    "quality": ("auto", "realistic", "lite", "full", "schematic"),  # the fallback ladder (auto) or one fixed rung
    "kiosk_idle_s": (0, 10, 30, 120, 600),       # seconds of no change before the kiosk swaps to the still; 0 = never
    # PLAN3D-REALISM2-2433: what stands behind the model in the realistic orbit views - the sun's sky, or the dark studio
    # gradient (no horizon). A JSON dial like the others: no migration (plan.view is one settings value, the override one row)
    "backdrop": ("sky", "studio"),
    # PLAN3D-REALISM2-2433 (owner 2026-11-11): what the living floors are made of at the realistic level (frontend map/floor-finish.ts):
    # the library oak, or the generated marble / luxury ceramic. A content dial: per installation (the home's floors), marble at install
    # PLAN3D-R32-ANSWERS-2438 (owner round 32, Q-MAP-11): polished Calacatta marble at install, and a travertine floor added
    "floor_finish": ("wood", "marble", "ceramic", "travertine"),
    # PLAN3D-R32-ANSWERS-2438 (owner round 32): the 3D map's look answers, each the owner's choice by default and changeable here
    "wall_cut": ("low", "mid"),                    # Q-MAP-13: the orbit views cut the walls low (1.25 m, the mockup) or at 0.6 of the ceiling (before)
    "light_mood": ("auto", "day", "evening", "night"),  # Q-MAP-14: day / evening / night light by the hour, or locked to one
    "room_marks": ("bar_edge", "floor", "bar"),    # Q-MAP-16: a room's state as a wall-top bar + a floor perimeter line, the floor tint (before), or the bar only
    "light_mark": ("bar", "none", "bar_floor"),    # Q-MAP-17: a light on as a thin amber wall-top bar, nothing, or the bar and a floor line
    "alarm_motion": ("pulse", "steady"),           # Q-MAP-18: an alarm room pulses slowly, or stays steady (reduced motion keeps it steady anyway)
}
# walk_guard: the walk drops a rung under 24 fps (a session flag); floor_reflections (PLAN3D-LEVEL3-2435): the realistic rung's
# screen-space reflections on the polished floors - a display / performance choice, so a person may turn it off for themselves
# reflections_auto (PLAN3D-R32-ANSWERS-2438, Q-MAP-12 / Q-MAP-20): on a weak device, and first when the frame rate falls, the floor
# reflections go off before anything else is lowered
FLAGS = ("section_cut", "show_temps", "motion", "walk_guard", "floor_reflections", "reflections_auto")
RANGES: dict[str, tuple[float, float, float]] = {"eye_m": (1.2, 2.0, 0.05), "dpr_cap": (1.0, 2.0, 0.25)}
DEFAULT: dict[str, Any] = {
    "style": "auto", "default_view": "schematic", "furniture": "models", "textures": "files", "wall_display": "live",
    "time_source": "clock", "mouse_mode": "drag", "quality": "auto", "kiosk_idle_s": 30, "eye_m": 1.65, "dpr_cap": 1.25,
    "section_cut": True, "show_temps": False, "motion": True, "walk_guard": True, "backdrop": "sky",
    "floor_finish": "marble", "floor_reflections": True,
    "wall_cut": "low", "light_mood": "auto", "room_marks": "bar_edge", "light_mark": "bar", "alarm_motion": "pulse", "reflections_auto": True,
}
# the installation never makes realistic the default for everyone (owner Q11 א): default_view stays a person's choice
SITE_DIALS: tuple[str, ...] = tuple(k for k in DEFAULT if k != "default_view")
# what a person may set for themselves; the content (furniture, textures, floor_finish) and the display dials stay per installation
USER_DIALS: tuple[str, ...] = ("style", "default_view", "time_source", "mouse_mode", "quality", "eye_m", "dpr_cap", "section_cut", "show_temps", "motion", "walk_guard",
                               "backdrop", "floor_reflections", "wall_cut", "light_mood", "room_marks", "light_mark", "alarm_motion", "reflections_auto")


def _dial(key: str, value: Any) -> Any:
    """One dial's value, validated (ValueError otherwise). Numbers snap to their step; "1" and 1 are the same choice."""
    if key in FLAGS:
        if not isinstance(value, bool):
            raise ValueError(f"{key} must be true or false")
        return value
    if key in RANGES:
        lo, hi, step = RANGES[key]
        if isinstance(value, bool) or not isinstance(value, (int, float)) or not math.isfinite(value) or not lo - 1e-9 <= value <= hi + 1e-9:
            raise ValueError(f"{key} must be {lo:g}..{hi:g}")
        return round(round((value - lo) / step) * step + lo, 2)
    allowed = CHOICES.get(key)
    if allowed is None:
        raise ValueError(f"unknown dial {key}")
    if isinstance(value, bool):
        raise ValueError(f"{key} must be one of {', '.join(map(str, allowed))}")
    for a in allowed:
        if value == a or (isinstance(a, int) and isinstance(value, str) and value.strip() == str(a)):
            return a
    raise ValueError(f"{key} must be one of {', '.join(map(str, allowed))}")


def normalize_site(value: Any, base: dict[str, Any] | None = None) -> dict[str, Any]:
    """The installation's object: a partial update over `base` (the current value; the defaults when absent). Unknown
    dials and default_view are refused, so a typo never silently does nothing."""
    if not isinstance(value, dict):
        raise ValueError("plan.view must be an object")
    out = {k: (base or DEFAULT).get(k, DEFAULT[k]) for k in SITE_DIALS}
    for k, v in value.items():
        if k not in SITE_DIALS:
            raise ValueError(f"plan.view: {k} is not an installation dial")
        out[k] = _dial(k, v)
    return out


def stored_site(raw: Any) -> dict[str, Any]:
    """The stored installation value as a full object; a corrupt value or a corrupt dial reads as its default."""
    try:
        value = json.loads(raw) if isinstance(raw, str) and raw else {}
    except ValueError:
        value = {}
    out = {k: DEFAULT[k] for k in SITE_DIALS}
    if isinstance(value, dict):
        for k in SITE_DIALS:
            if k in value:
                try:
                    out[k] = _dial(k, value[k])
                except ValueError:
                    pass
    return out


def normalize_own(value: Any) -> dict[str, Any]:
    """A person's own partial override: only USER_DIALS; null removes a dial (back to the installation)."""
    if not isinstance(value, dict):
        raise ValueError("prefs must be an object")
    out: dict[str, Any] = {}
    for k, v in value.items():
        if k not in USER_DIALS:
            raise ValueError(f"{k} is not a personal dial")
        out[k] = None if v is None else _dial(k, v)
    return out


def own(conn: sqlite3.Connection, user_id: str) -> dict[str, Any]:
    row = conn.execute("SELECT value_json FROM plan_view_prefs WHERE user_id = ?", (user_id,)).fetchone()
    if row is None:
        return {}
    try:
        raw = json.loads(row["value_json"])
    except ValueError:
        return {}
    out: dict[str, Any] = {}
    for k, v in (raw.items() if isinstance(raw, dict) else []):
        if k in USER_DIALS and v is not None:
            try:
                out[k] = _dial(k, v)
            except ValueError:
                pass  # an unreadable dial is the installation's, never an error for the view
    return out


def set_own(conn: sqlite3.Connection, user_id: str, patch: dict[str, Any]) -> dict[str, Any]:
    """Apply a validated partial update; returns the stored override. An empty override deletes the row."""
    current = own(conn, user_id)
    for k, v in normalize_own(patch).items():
        if v is None:
            current.pop(k, None)
        else:
            current[k] = v
    if not current:
        conn.execute("DELETE FROM plan_view_prefs WHERE user_id = ?", (user_id,))
    else:
        conn.execute("INSERT INTO plan_view_prefs(user_id, value_json, updated_at) VALUES (?,?,?) "
                     "ON CONFLICT(user_id) DO UPDATE SET value_json = excluded.value_json, updated_at = excluded.updated_at",
                     (user_id, json.dumps({k: current[k] for k in sorted(current)}, separators=(",", ":")), now_iso()))
    return current


def effective(site: dict[str, Any], mine: dict[str, Any]) -> dict[str, Any]:
    out = {**DEFAULT, **site}
    out.update({k: v for k, v in mine.items() if k in USER_DIALS})
    return out
