"""Timeline colours - one colour per kind of thing the investigation timeline draws (owner request 2026-10-01: the person
dots and the recording bars were both blue).

`timeline.colors` (PATCH /settings, installation-wide, system.configure like every product setting) is a JSON object
{option: colour}, read back as an object with every option present. An option is one of OPTIONS; a colour is either one
of the named palette TOKENS (the frontend maps each name to a hex, frontend/src/api/timeline-colors.ts keeps the same
list) or a "#rrggbb" string, normalised to lower case. Nothing else is stored, so the value can never carry CSS: the
frontend applies it as custom properties on the document root.

Unknown options and any other colour are refused (422), never dropped silently; options left out take their default."""
from __future__ import annotations

import re
from typing import Any

# the options in the order the settings card lists them
OPTIONS: tuple[str, ...] = ("recording", "motion", "person", "vehicle", "door", "line", "offline")

# the swatches of the palette; "accent" is the product's interaction blue (var(--sw-accent))
TOKENS: tuple[str, ...] = ("accent", "red", "orange", "amber", "green", "teal", "cyan", "purple", "pink", "gray")

DEFAULT: dict[str, str] = {
    "recording": "accent",
    "motion": "red",
    "person": "orange",  # was the same blue as the recording bars
    "vehicle": "green",
    "door": "purple",
    "line": "amber",
    "offline": "gray",
}

HEX = re.compile(r"^#[0-9a-fA-F]{6}$")


def normalize(value: Any) -> dict[str, str]:
    """The value in its canonical form (every option present), or ValueError."""
    if not isinstance(value, dict):
        raise ValueError("timeline colors must be an object")
    unknown = sorted(str(k) for k in set(value) - set(OPTIONS))
    if unknown:
        raise ValueError("unknown timeline option: " + ", ".join(unknown))
    out = dict(DEFAULT)
    for key, colour in value.items():
        if not isinstance(colour, str):
            raise ValueError(f"timeline option {key}: a palette name or #rrggbb")
        if colour in TOKENS:
            out[key] = colour
        elif HEX.fullmatch(colour):  # fullmatch: "$" would let a trailing newline through
            out[key] = colour.lower()
        else:
            raise ValueError(f"timeline option {key}: a palette name or #rrggbb")
    return out
