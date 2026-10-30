"""AREAEDIT-2290 (owner-approved mockup, 2026-10-29): what the area quick-control pop-up shows and in which order.

Stored inside the installation setting `home.screen` (key `popup`, no new table):

    {"version": int, "site": Layout | null, "areas": {area_id: Layout}}
    Layout = {"sections": [section ids, in order], "hidden": [section ids], "items": {section id: {"order": [entity ids], "hidden": [entity ids]}}}

`site` is the default of every area without an override of its own; an area's layout replaces the site's for that area (it does not merge);
neither = the fixed order of today. `version` counts saves: the editor sends the version it loaded and a stale save is refused (409)
unless it says `force`. Presentation only: a layout can only REDUCE or REORDER what a person is already allowed to see - the pop-up
intersects it with the devices the server returned for that person; no permission, alert or automation depends on it.
Unknown sections, repeated or non-string ids are refused (422), never dropped silently.
"""
from __future__ import annotations

from typing import Any

SECTIONS: tuple[str, ...] = ("quick", "lighting", "switches", "climate", "heating", "covers", "media", "sensors", "cameras", "scenes", "schedules", "events")
ITEM_SECTIONS: tuple[str, ...] = ("lighting", "switches", "climate", "heating", "covers", "media", "sensors", "cameras")
AREAS_MAX = 2000
AREA_ID_MAX = 120
ITEMS_MAX = 400
ENTITY_ID_MAX = 255
LAYOUT_KEYS = ("sections", "hidden", "items")


def _ids(value: Any, name: str, allowed: tuple[str, ...] | None, limit: int) -> list[str]:
    if not isinstance(value, list) or len(value) > limit:
        raise ValueError(f"{name} must be a list of at most {limit} ids")
    out: list[str] = []
    for item in value:
        if not isinstance(item, str) or not 0 < len(item) <= ENTITY_ID_MAX or (allowed is not None and item not in allowed):
            raise ValueError(f"{name}: bad id {item!r}")
        if item in out:
            raise ValueError(f"{name}: {item} is listed twice")
        out.append(item)
    return out


def normalize_layout(value: Any, name: str = "layout") -> dict[str, Any]:
    """The canonical layout (every key present), or ValueError."""
    if not isinstance(value, dict):
        raise ValueError(f"{name} must be an object")
    unknown = sorted(set(value) - set(LAYOUT_KEYS))
    if unknown:
        raise ValueError(f"{name}: unknown key " + ", ".join(str(k) for k in unknown))
    out: dict[str, Any] = {
        "sections": _ids(value.get("sections", []), f"{name}.sections", SECTIONS, len(SECTIONS)),
        "hidden": _ids(value.get("hidden", []), f"{name}.hidden", SECTIONS, len(SECTIONS)),
        "items": {},
    }
    items = value.get("items", {})
    if not isinstance(items, dict):
        raise ValueError(f"{name}.items must be an object")
    for section, spec in items.items():
        if section not in ITEM_SECTIONS:
            raise ValueError(f"{name}.items: section {section!r} has no items to choose")
        if not isinstance(spec, dict) or set(spec) - {"order", "hidden"}:
            raise ValueError(f"{name}.items.{section} must be an object with order / hidden")
        entry = {"order": _ids(spec.get("order", []), f"{name}.items.{section}.order", None, ITEMS_MAX),
                 "hidden": _ids(spec.get("hidden", []), f"{name}.items.{section}.hidden", None, ITEMS_MAX)}
        if entry["order"] or entry["hidden"]:
            out["items"][section] = entry
    return out


def normalize_popup(value: Any) -> dict[str, Any]:
    if not isinstance(value, dict) or set(value) - {"version", "site", "areas"}:
        raise ValueError("popup must be an object with version / site / areas")
    version = value.get("version", 0)
    if isinstance(version, bool) or not isinstance(version, int) or version < 0:
        raise ValueError("popup.version must be a non-negative integer")
    site = value.get("site")
    areas = value.get("areas", {})
    if not isinstance(areas, dict) or len(areas) > AREAS_MAX:
        raise ValueError("popup.areas must be an object of area id to layout")
    out_areas: dict[str, Any] = {}
    for area, layout in areas.items():
        if not isinstance(area, str) or not 0 < len(area) <= AREA_ID_MAX:
            raise ValueError(f"popup.areas: bad area id {area!r}")
        out_areas[area] = normalize_layout(layout, f"popup.areas.{area}")
    return {"version": version, "site": None if site is None else normalize_layout(site, "popup.site"), "areas": out_areas}


class Conflict(Exception):
    """The saved version is not the one the editor loaded."""


def save(popup: dict[str, Any], *, area_id: str | None, layout: Any, version: int, force: bool = False) -> dict[str, Any]:
    """The popup object after a save: `layout` (None = reset: the area inherits again / the site default is cleared) at the area or the
    site, version + 1. Raises ValueError (bad layout) or Conflict (stale version, not forced)."""
    if not force and version != popup["version"]:
        raise Conflict
    out = {"version": popup["version"] + 1, "site": popup["site"], "areas": dict(popup["areas"])}
    canon = None if layout is None else normalize_layout(layout)
    if area_id is None:
        out["site"] = canon
    elif canon is None:
        out["areas"].pop(area_id, None)
    else:
        out["areas"][area_id] = canon
    return normalize_popup(out)


def affected_areas(conn: Any, popup: dict[str, Any]) -> int:
    """How many areas a site-wide save changes: the areas without an override of their own (the editor warns with it)."""
    total = conn.execute("SELECT COUNT(*) FROM ha_areas").fetchone()[0]
    return max(0, int(total) - len(popup["areas"]))
