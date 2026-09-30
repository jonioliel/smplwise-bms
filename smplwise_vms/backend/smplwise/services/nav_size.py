"""The size of the navigation (side rail and phone bottom bar) - UI round 1, owner request 2026-09-30.

One value shape for the installation default (`ui.nav_size` in PATCH /settings) and the user's own override
(`ui.nav_size` in PUT /me/prefs; the personal value wins, null clears it):

  {"mode": "rel", "preset": "s" | "m" | "l" | "xl"}                      one preset scales every part together
  {"mode": "free", "icon": 14..40, "label": 0 | 9..16, "item": 36..96}    independent sizes in px; label 0 = labels off

Nothing else is stored: unknown keys, other modes, non-integers and out-of-range numbers are refused (never clamped
silently), so the shell can trust what it reads. The frontend (shell/nav-size.ts) turns the value into sizes and keeps
the same ranges; presentation only - no permission depends on it."""
from __future__ import annotations

from typing import Any

PRESETS: tuple[str, ...] = ("s", "m", "l", "xl")
DEFAULT_PRESET = "l"  # owner decision 2026-09-30 (home redesign): the large rail is the installation default; "m" is the size the shell had before the setting
DEFAULT: dict[str, Any] = {"mode": "rel", "preset": DEFAULT_PRESET}

ICON_RANGE = (14, 40)
LABEL_RANGE = (9, 16)  # 0 = labels off
ITEM_RANGE = (36, 96)


def _int_in(value: Any, lo: int, hi: int, name: str, allow_zero: bool = False) -> int:
    # bool is an int subclass: True must not pass as 1
    if isinstance(value, bool) or not isinstance(value, int):
        raise ValueError(f"nav size {name} must be a whole number")
    if allow_zero and value == 0:
        return 0
    if not lo <= value <= hi:
        raise ValueError(f"nav size {name} must be between {lo} and {hi}" + (" (or 0)" if allow_zero else ""))
    return value


def normalize(value: Any) -> dict[str, Any]:
    """The value in its canonical form, or ValueError."""
    if not isinstance(value, dict):
        raise ValueError("nav size must be an object")
    mode = value.get("mode")
    if mode == "rel":
        if set(value) != {"mode", "preset"}:
            raise ValueError("nav size (rel) takes only mode and preset")
        if value["preset"] not in PRESETS:
            raise ValueError("nav size preset must be one of " + ", ".join(PRESETS))
        return {"mode": "rel", "preset": value["preset"]}
    if mode == "free":
        if set(value) != {"mode", "icon", "label", "item"}:
            raise ValueError("nav size (free) takes only mode, icon, label and item")
        return {
            "mode": "free",
            "icon": _int_in(value["icon"], *ICON_RANGE, "icon"),
            "label": _int_in(value["label"], *LABEL_RANGE, "label", allow_zero=True),
            "item": _int_in(value["item"], *ITEM_RANGE, "item"),
        }
    raise ValueError("nav size mode must be rel or free")
