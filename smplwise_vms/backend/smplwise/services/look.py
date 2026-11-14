"""The "look" dials of the design layer (Bubble foundation, owner decisions 2026-10-02): every presentation option of a
skin is a value the owner can change through the UI, nothing is hard-coded.

One value shape, `ui.look`, owned twice:
  - the installation default (`ui.look` in PATCH /settings): the FULL object, every dial present;
  - a user's own override (`ui.look` in PUT /me/prefs): a PARTIAL object - only the dials the user set; a dial that is
    absent follows the installation (null clears the whole override).

  {
    "density":      "wide" | "regular" | "compact" | "row",       size and layout of pills / cards; row = the list view
    "surface":      "flat" | "glass" | "gradient" | "fill",       what a pill is painted with
    "popup":        "sheet" | "centred" | "inline",               how a pop-up opens (sheet = bottom sheet on a phone)
    "radius":       "pill" | "soft" | "square",                   the corner scale
    "slider":       "horizontal" | "vertical",                    BV1 (2026-10-05): the device sheet's sliders as pills (today) or as tall
                                                                  vertical sliders side by side; `surface` also takes "none" - no fill at all
    "transparency": 40 .. 100,                                    opacity of translucent layers, in percent (100 = opaque)
    "scale":        80 .. 130,                                    size of the components, in percent
    "touch":        32 | 44,                                      the minimum pointer target on a desktop, in px (touch layouts are always 44)
    "performance":  "auto" | "full" | "lite",                     what the glass costs: full = blur on every glass layer, lite = blur only
                                                                  on the dock, rail, tree, scrim and the open pop-up (wall tablets, weak
                                                                  phones), auto = the device decides (a client-side probe, design/performance.ts)
    "palette":      "default" | <one of the ten ids> | "custom-<slug>"  the colour set (services/palettes.py): default = the skin's own colours, the ten ready
                                                                  palettes, or a custom palette an administrator saved (`ui.palettes`); an id that no longer
                                                                  exists reads as default on the frontend
    "depth":        0 | 1 | 2,                                    MD1 (owner 2026-10-03): the material's relief - 0 off (today's flat pills), 1 the 1 px bevel
                                                                  rim and a soft lift, 2 the same x1.8
    "tint":         0 | 1 | 2,                                    the state wash on tiles whose state carries a tone - 0 off, 1 soft, 2 strong (the word and the
                                                                  dot always stay; lists take the tone in a side stripe, never on the row)
    "material":     "none" | "frosted" | "paper" | "neon",        a preset of the material numbers (sheen, shade, rim, lift, wash, blur, glow, grain); none =
                                                                  the base numbers, so depth and tint work alone. Choosing a preset in the UI also writes depth,
                                                                  tint and a suggested transparency (a macro); the stored value is only the preset's name
  }

Unknown keys, unknown values, non-integers and out-of-range numbers are refused (never clamped silently), so the
frontend (design/look.ts, the same lists and ranges) can trust what it reads. Presentation only: no permission depends on it.
The frontend keeps the effective translucency above a contrast floor it computes (design/contrast.ts); the stored value
is what the person chose."""
from __future__ import annotations

import json
from typing import Any

from .palettes import BUILTIN_IDS, valid_dial_value

DENSITIES: tuple[str, ...] = ("wide", "regular", "compact", "row")
SURFACES: tuple[str, ...] = ("flat", "glass", "gradient", "fill", "none")  # BV1: `none` = the surfaceless look (ring + text, no fill)
POPUPS: tuple[str, ...] = ("sheet", "centred", "inline")
RADII: tuple[str, ...] = ("pill", "soft", "square")
SLIDERS: tuple[str, ...] = ("horizontal", "vertical")  # BV1: the device sheet's sliders as pills, or as tall vertical sliders
TOUCH: tuple[int, ...] = (32, 44)
PALETTES: tuple[str, ...] = ("default", *BUILTIN_IDS)  # the fixed choices; a `custom-<slug>` id is valid too (palettes.valid_dial_value)
PERFORMANCES: tuple[str, ...] = ("auto", "full", "lite")
MATERIALS: tuple[str, ...] = ("none", "frosted", "paper", "neon")  # MD1: Chalk was shown in the mockups and dropped by the owner (2026-10-03)
LEVELS: tuple[int, ...] = (0, 1, 2)  # depth and tint: off / normal / strong
TRANSPARENCY_RANGE = (40, 100)
SCALE_RANGE = (80, 130)

CHOICES: dict[str, tuple[str, ...]] = {"density": DENSITIES, "surface": SURFACES, "popup": POPUPS, "radius": RADII, "slider": SLIDERS, "performance": PERFORMANCES, "palette": PALETTES, "material": MATERIALS}
INT_CHOICES: dict[str, tuple[int, ...]] = {"touch": TOUCH, "depth": LEVELS, "tint": LEVELS}
RANGES: dict[str, tuple[int, int]] = {"transparency": TRANSPARENCY_RANGE, "scale": SCALE_RANGE}
KEYS: tuple[str, ...] = ("density", "surface", "popup", "radius", "slider", "transparency", "scale", "touch", "performance", "palette", "depth", "tint", "material")

DEFAULT: dict[str, Any] = {
    "density": "regular",
    "surface": "fill",
    "popup": "sheet",
    "radius": "pill",
    "slider": "horizontal",  # BV1: a stored default from before the dial reads as horizontal (no pixel change)
    "transparency": 72,
    "scale": 100,
    "touch": 44,
    "performance": "auto",
    "palette": "default",
    # the material dials are OFF by default: today's pixels are unchanged until an owner turns one (MD1 phase 2)
    "depth": 0,
    "tint": 0,
    "material": "none",
}


def _dial(key: str, value: Any) -> Any:
    """One dial's value in its canonical form, or ValueError."""
    if key == "palette":
        if not valid_dial_value(value):
            raise ValueError("look palette must be default, a ready palette id or a custom-<name> id")
        return value
    if key in CHOICES:
        if not isinstance(value, str) or value not in CHOICES[key]:
            raise ValueError(f"look {key} must be one of {', '.join(CHOICES[key])}")
        return value
    if key in RANGES:
        lo, hi = RANGES[key]
        if isinstance(value, bool) or not isinstance(value, int):
            raise ValueError(f"look {key} must be a whole number")
        if not lo <= value <= hi:
            raise ValueError(f"look {key} must be between {lo} and {hi}")
        return value
    if key in INT_CHOICES:
        if isinstance(value, bool) or not isinstance(value, int) or value not in INT_CHOICES[key]:
            raise ValueError(f"look {key} must be one of {', '.join(str(v) for v in INT_CHOICES[key])}")
        return value
    raise ValueError(f"unknown look option: {str(key)[:32]}")


def normalize(value: Any, partial: bool = False) -> dict[str, Any]:
    """The value in its canonical form (keys in the fixed order), or ValueError. `partial` (a user's override) allows a
    subset of the dials; the installation default must carry every dial."""
    if not isinstance(value, dict):
        raise ValueError("look must be an object")
    out: dict[str, Any] = {}
    for key, raw in value.items():
        if key not in KEYS:
            raise ValueError(f"unknown look option: {str(key)[:32]}")
        out[key] = _dial(key, raw)
    if not partial:
        missing = [k for k in KEYS if k not in out]
        if missing:
            raise ValueError("look is missing " + ", ".join(missing))
    return {k: out[k] for k in KEYS if k in out}


def normalize_partial(value: Any) -> dict[str, Any]:
    """A user's own override: any subset of the dials (an empty object is allowed and means "nothing overridden")."""
    return normalize(value, partial=True)


def normalize_own(value: Any) -> dict[str, Any]:
    """A user's own override (/me/prefs). The palette is chosen ONLY by the installation's system administrator (owner decision
    2026-10-02), so a `palette` in a personal override is validated like any dial and then dropped: it never overrides anything."""
    out = normalize_partial(value)
    out.pop("palette", None)
    return out


def stored(raw: Any) -> dict[str, Any]:
    """The stored installation default as an object. A stored value from an older release that lacks a dial that was added
    later keeps the dials it has and takes the default for the rest; a corrupt or foreign value reads as the defaults."""
    try:
        data = json.loads(raw) if isinstance(raw, str) else raw
        got = normalize(data, partial=True)
    except (ValueError, TypeError):
        return dict(DEFAULT)
    return {**DEFAULT, **got}
