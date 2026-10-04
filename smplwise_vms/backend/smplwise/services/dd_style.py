"""Which look a tab group gets when it is presented as a dropdown (release 0.1.157, owner decision 2026-10-03): `auto` (today's
look, the default) or one of six styles (pill, field, underline, text, prefix, tonal). One global value plus a per-group override,
both as the installation's default (`ui.dd_style`, `ui.dd_style_groups` product settings) and as a user's own choice (the same keys
in /me/prefs; null = follow the installation). Presentation only: nothing here is a permission. The groups are the same closed
list as services/tabs_mode.py; the frontend twin is shell/tabs-mode.ts (DD_STYLES)."""
from __future__ import annotations

import json
from typing import Any

from .tabs_mode import GROUPS

STYLES: tuple[str, ...] = ("auto", "pill", "field", "underline", "text", "prefix", "tonal")
DEFAULT_STYLE = "auto"

# How a dropdown opens on a phone (owner decision 2026-10-03): `sheet` = a bottom sheet that slides up (the default, thumb-friendly),
# `list` = the regular small list under the field. One global value (no per-group override): `ui.dd_phone` as the installation's default
# and as a user's own choice (null = follow the installation). Presentation only; desktop and tablet widths are unaffected.
PHONE_MODES: tuple[str, ...] = ("sheet", "list")
DEFAULT_PHONE = "sheet"


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
