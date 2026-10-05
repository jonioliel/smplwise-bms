"""Which look a tab group gets when it is presented as a dropdown (release 0.1.157, owner decision 2026-10-03): `auto` (today's
look, the default) or one of six styles (pill, field, underline, text, prefix, tonal). One global value plus a per-group override,
both as the installation's default (`ui.dd_style`, `ui.dd_style_groups` product settings) and as a user's own choice (the same keys
in /me/prefs; null = follow the installation). Presentation only: nothing here is a permission. The groups are the same closed
list as services/tabs_mode.py; the frontend twin is shell/tabs-mode.ts (DD_STYLES)."""
from __future__ import annotations

import json
from typing import Any

from .tabs_mode import GROUPS

STYLES: tuple[str, ...] = ("auto", "pill", "field", "underline", "text", "prefix", "tonal", "capsule")
DEFAULT_STYLE = "auto"

# Unreleased (owner request 2026-10-04): the SIZE of a dropdown, `md` being the reference size (and the size every style has had so far).
# Same shape as the style: one global value plus a per-group override, as the installation's default (`ui.dd_size`, `ui.dd_size_groups`
# product settings) and as a user's own choice (the same keys in /me/prefs; null = follow the installation).
SIZES: tuple[str, ...] = ("sm", "md", "lg")
DEFAULT_SIZE = "md"

# Unreleased (owner decisions 2026-10-04, capsule style only): the RING THICKNESS in px (ids are strings: "1", "1.5", "2", "3"; default "2")
# and the width of the OPEN PANEL (`button` = as wide as the button, or "240" / "300" px at the normal size; default "240", scaled with the
# size dial in the frontend). Same shape as the size: global + per tab group, installation (`ui.dd_ring`, `ui.dd_ring_groups`, `ui.dd_panel`,
# `ui.dd_panel_groups`) and personal (/me/prefs; null = follow the installation). Other styles ignore both.
RINGS: tuple[str, ...] = ("1", "1.5", "2", "3")
DEFAULT_RING = "2"
PANELS: tuple[str, ...] = ("button", "240", "300")
DEFAULT_PANEL = "240"

# How a dropdown opens on a phone (owner decision 2026-10-03): `sheet` = a bottom sheet that slides up (the default, thumb-friendly),
# `list` = the regular small list under the field. One global value (no per-group override): `ui.dd_phone` as the installation's default
# and as a user's own choice (null = follow the installation). Presentation only; desktop and tablet widths are unaffected.
PHONE_MODES: tuple[str, ...] = ("sheet", "list")
DEFAULT_PHONE = "sheet"

# 2.0.2 (owner feedback 2026-10-05, the camera comparison pickers): from how many cameras a multi-select list carries a search field -
# `always`, `4` (default), `8` (the single-choice lists' rule), `never`. One global value: `ui.dd_search` as the installation's default
# and as a user's own choice (null = follow the installation). Single-choice lists keep their 8+ rule; this dial is the multi-select's.
SEARCH_MODES: tuple[str, ...] = ("always", "4", "8", "never")
DEFAULT_SEARCH = "4"

# 2.0.2 (owner feedback 2026-10-05): how the camera comparison picker is shown (recordings, synchronized playback) - `dropdown` (the
# multi-select list, default; the phone keeps its bottom sheet) or `chips` (a button per camera, the 2.0.0 look). One global value:
# `ui.dd_picker` as the installation's default and as a user's own choice (null = follow the installation). Presentation only.
PICKERS: tuple[str, ...] = ("dropdown", "chips")
DEFAULT_PICKER = "dropdown"


def normalize_search(value: Any) -> str:
    """Exactly one of SEARCH_MODES (a string, no trimming, no case folding); else refused."""
    if isinstance(value, str) and value in SEARCH_MODES:
        return value
    raise ValueError(f"dropdown search threshold must be one of {', '.join(SEARCH_MODES)}")


def stored_search(raw: Any) -> str:
    """The stored installation value as read back; a corrupt or foreign value reads as the default."""
    try:
        return normalize_search(raw)
    except ValueError:
        return DEFAULT_SEARCH


def normalize_picker(value: Any) -> str:
    """Exactly one of PICKERS (no trimming, no case folding); else refused."""
    if isinstance(value, str) and value in PICKERS:
        return value
    raise ValueError(f"camera picker must be one of {', '.join(PICKERS)}")


def stored_picker(raw: Any) -> str:
    """The stored installation value as read back; a corrupt or foreign value reads as the default."""
    try:
        return normalize_picker(raw)
    except ValueError:
        return DEFAULT_PICKER


def normalize_phone(value: Any) -> str:
    """Exactly one of PHONE_MODES (no trimming, no case folding); else refused."""
    if isinstance(value, str) and value in PHONE_MODES:
        return value
    raise ValueError(f"phone dropdown mode must be one of {', '.join(PHONE_MODES)}")


def stored_phone(raw: Any) -> str:
    """The stored installation value as read back; a corrupt or foreign value reads as the default."""
    try:
        return normalize_phone(raw)
    except ValueError:
        return DEFAULT_PHONE


def normalize_style(value: Any) -> str:
    """Exactly one of STYLES (no trimming, no case folding: the settings route's pattern accepts the same strings); else refused."""
    if isinstance(value, str) and value in STYLES:
        return value
    raise ValueError(f"dropdown style must be one of {', '.join(STYLES)}")


def normalize_groups(value: Any) -> dict[str, str]:
    """A per-group override: an object {group: style}. An unknown group or style is refused (never silently dropped); {} = no override."""
    if not isinstance(value, dict):
        raise ValueError("dd_style_groups must be an object {group: style}")
    out: dict[str, str] = {}
    for group, style in value.items():
        if group not in GROUPS:
            raise ValueError(f"unknown tab group: {str(group)[:32]}")
        out[group] = normalize_style(style)
    return {g: out[g] for g in GROUPS if g in out}


def normalize_size(value: Any) -> str:
    """Exactly one of SIZES (no trimming, no case folding: the settings route's pattern accepts the same strings); else refused."""
    if isinstance(value, str) and value in SIZES:
        return value
    raise ValueError(f"dropdown size must be one of {', '.join(SIZES)}")


def normalize_size_groups(value: Any) -> dict[str, str]:
    """A per-group override: an object {group: size}. An unknown group or size is refused (never silently dropped); {} = no override."""
    if not isinstance(value, dict):
        raise ValueError("dd_size_groups must be an object {group: size}")
    out: dict[str, str] = {}
    for group, size in value.items():
        if group not in GROUPS:
            raise ValueError(f"unknown tab group: {str(group)[:32]}")
        out[group] = normalize_size(size)
    return {g: out[g] for g in GROUPS if g in out}


def stored_size(raw: Any) -> str:
    """The stored installation size as read back; a corrupt or foreign value reads as the default."""
    try:
        return normalize_size(raw)
    except ValueError:
        return DEFAULT_SIZE


def stored_size_groups(raw: Any) -> dict[str, str]:
    """The stored installation size overrides as an object; a corrupt value reads as no override."""
    try:
        return normalize_size_groups(json.loads(raw) if isinstance(raw, str) else raw)
    except (ValueError, TypeError):
        return {}


def stored_style(raw: Any) -> str:
    """The stored installation style as read back; a corrupt or foreign value reads as the default."""
    try:
        return normalize_style(raw)
    except ValueError:
        return DEFAULT_STYLE


def stored_groups(raw: Any) -> dict[str, str]:
    """The stored installation overrides as an object; a corrupt value reads as no override."""
    try:
        return normalize_groups(json.loads(raw) if isinstance(raw, str) else raw)
    except (ValueError, TypeError):
        return {}


def _normalize_choice(value: Any, allowed: tuple[str, ...], what: str) -> str:
    if isinstance(value, str) and value in allowed:
        return value
    raise ValueError(f"dropdown {what} must be one of {', '.join(allowed)}")


def _normalize_choice_groups(value: Any, normalize: Any, what: str) -> dict[str, str]:
    if not isinstance(value, dict):
        raise ValueError(f"dd_{what}_groups must be an object {{group: {what}}}")
    out: dict[str, str] = {}
    for group, item in value.items():
        if group not in GROUPS:
            raise ValueError(f"unknown tab group: {str(group)[:32]}")
        out[group] = normalize(item)
    return {g: out[g] for g in GROUPS if g in out}


def _stored_choice(raw: Any, normalize: Any, default: str) -> str:
    try:
        return normalize(raw)
    except ValueError:
        return default


def _stored_choice_groups(raw: Any, normalize_groups_fn: Any) -> dict[str, str]:
    try:
        return normalize_groups_fn(json.loads(raw) if isinstance(raw, str) else raw)
    except (ValueError, TypeError):
        return {}


def normalize_ring(value: Any) -> str:
    """Exactly one of RINGS (a string, no trimming); else refused. Capsule style only."""
    return _normalize_choice(value, RINGS, "ring thickness")


def normalize_ring_groups(value: Any) -> dict[str, str]:
    """A per-group override {group: ring}; an unknown group or value is refused; {} = no override."""
    return _normalize_choice_groups(value, normalize_ring, "ring")


def stored_ring(raw: Any) -> str:
    return _stored_choice(raw, normalize_ring, DEFAULT_RING)


def stored_ring_groups(raw: Any) -> dict[str, str]:
    return _stored_choice_groups(raw, normalize_ring_groups)


def normalize_panel(value: Any) -> str:
    """Exactly one of PANELS (a string, no trimming); else refused. Capsule style only."""
    return _normalize_choice(value, PANELS, "panel width")


def normalize_panel_groups(value: Any) -> dict[str, str]:
    """A per-group override {group: panel}; an unknown group or value is refused; {} = no override."""
    return _normalize_choice_groups(value, normalize_panel, "panel")


def stored_panel(raw: Any) -> str:
    return _stored_choice(raw, normalize_panel, DEFAULT_PANEL)


def stored_panel_groups(raw: Any) -> dict[str, str]:
    return _stored_choice_groups(raw, normalize_panel_groups)
