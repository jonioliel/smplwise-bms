"""How a tab group is presented (release 0.1.153, owner decision): as tabs (today), as a hybrid (a segmented control for three
items or fewer, a dropdown for more) or as a dropdown. One global value plus a per-group override, both as the installation's
default (`ui.tabs_mode`, `ui.tabs_mode_groups` product settings) and as a user's own choice (the same keys in /me/prefs; null =
follow the installation). Presentation only: nothing here is a permission, and the frontend (shell/nav.ts tabModeOf) applies
the mode on the phone only."""
from __future__ import annotations

from typing import Any

MODES: tuple[str, ...] = ("tabs", "hybrid", "dropdown")
DEFAULT_MODE = "tabs"
# the tab groups a mode can be set for (frontend shell/nav.ts TAB_GROUPS); the main bottom navigation is not one of them
GROUPS: tuple[str, ...] = ("home", "area", "multimedia", "security", "settings")


def normalize_mode(value: Any) -> str:
    """One of MODES (surrounding spaces ignored); anything else is refused."""
    if isinstance(value, str) and value.strip() in MODES:
        return value.strip()
    raise ValueError(f"tabs mode must be one of {', '.join(MODES)}")


def normalize_groups(value: Any) -> dict[str, str]:
    """A per-group override: an object {group: mode}. An unknown group or mode is refused (never silently dropped); {} = no override."""
    if not isinstance(value, dict):
        raise ValueError("tabs_mode_groups must be an object {group: mode}")
    out: dict[str, str] = {}
    for group, mode in value.items():
        if group not in GROUPS:
            raise ValueError(f"unknown tab group: {str(group)[:32]}")
        out[group] = normalize_mode(mode)
    return {g: out[g] for g in GROUPS if g in out}


def stored_mode(raw: Any) -> str:
    """The stored installation mode as read back; a corrupt or foreign value reads as the default."""
    try:
        return normalize_mode(raw)
    except ValueError:
        return DEFAULT_MODE


def stored_groups(raw: Any) -> dict[str, str]:
    """The stored installation overrides as an object; a corrupt value reads as no override."""
    import json

    try:
        return normalize_groups(json.loads(raw) if isinstance(raw, str) else raw)
    except (ValueError, TypeError):
        return {}
