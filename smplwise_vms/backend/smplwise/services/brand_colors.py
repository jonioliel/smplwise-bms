"""The product's accent colour and the colour of a switch that is on (owner 2026-10-10, release 2.4.4).

Two installation settings, `ui.accent` and `ui.toggle_on`, each "default" (the skin's own colour - the system blue of the classic
look), the id of a preset, or a "#rrggbb" colour. The frontend (frontend/src/design/brand.ts, same preset list) turns a choice into the
DU1 token layer: `--sw-accent` and its hover / soft / text / focus companions, and `--sw-toggle-on`; the glass screens follow through
the `--sw-product-*` aliases. Presentation only: nothing server-side depends on them. Changed with system.configure (PATCH /settings),
audited, and carried by the project backup like every row of `settings`.
"""
from __future__ import annotations

import re
from typing import Any

DEFAULT = "default"
# id -> #rrggbb; keep in step with BRAND_PRESETS in frontend/src/design/brand.ts. ios_green is the toggle colour of the earlier glass
# mockup (owner 2026-10-10: selectable again as a preset).
PRESETS: dict[str, str] = {
    "ios_green": "#34c759",
    "ios_blue": "#007aff",
    "teal": "#0d9488",
    "purple": "#7c3aed",
    "orange": "#ea580c",
    "pink": "#db2777",
    "graphite": "#475569",
}
KEYS = ("ui.accent", "ui.toggle_on")
HEX = re.compile(r"^#[0-9a-fA-F]{6}$")


def normalize(value: Any) -> str:
    """A stored or submitted choice in canonical form ("default", a preset id, or a lower-case "#rrggbb"); ValueError otherwise."""
    if not isinstance(value, str):
        raise ValueError("not_a_string")
    v = value.strip()
    if v == DEFAULT or v in PRESETS:
        return v
    if HEX.fullmatch(v):
        return v.lower()
    raise ValueError("unknown_colour")


def stored(raw: Any) -> str:
    """The stored value as read back by GET /settings: anything corrupt reads as the default (the skin's own colour)."""
    try:
        return normalize(raw)
    except ValueError:
        return DEFAULT
