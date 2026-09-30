"""The screens page layout, the personal override and the remote configuration (CR-015 sections 7.1-7.3, MEDIA_API.md 2.4 / 3.6-3.8 /
3.15): pure validation, no database. Presentation only - nothing here is a permission and nothing reaches a device.

Canonical shapes (what the `normalise_*` functions return; every shape is closed, an unknown key is refused so this is never
free-form client storage):

    layout   {"version": 1, "group_by": "floor|area|none", "floor_order": [floor id], "pinned": [device key],
              "order": [device key], "cards": {device key: {"on", "size": "s|m|l", "phone_on": bool|null, "phone_size": "s|m"|null}}}
    personal {"group_by": "floor|area|none"|null, "order": [device key]|null, "cards": {device key: {"on"?, "size"?}}}
    remote   {"sections": [{"id", "on"} x 11, each section once], "more": [section id]}

Unknown device keys are KEPT on write (a device may be temporarily absent) and ignored by the reader; the janitor prunes the keys of
devices deleted for 30 days (`prune_keys`)."""
from __future__ import annotations

import copy
import re
from typing import Any

GROUP_BY = ("floor", "area", "none")
SIZES = ("s", "m", "l")
PHONE_SIZES = ("s", "m")
REMOTE_SECTIONS = ("recent", "nav", "dpad", "touch", "vol", "ch", "pbk", "nums", "colors", "text", "xtra")
MAX_KEYS = 300
MAX_PINNED = 24
MAX_FLOORS = 100
KEY_RE = re.compile(r"^[a-f0-9]{32}$")
FLOOR_RE = re.compile(r"^[^\x00-\x1f\x7f]{1,128}$")

# decision 5b: shown by default, in this order; the rest behind "עוד מקשים". `touch` is the d-pad's alternative (off).
DEFAULT_REMOTE: dict[str, Any] = {
    "sections": [{"id": s, "on": s != "touch"} for s in REMOTE_SECTIONS],
    "more": ["nums", "colors", "text", "xtra"],
}
EMPTY_LAYOUT: dict[str, Any] = {"version": 1, "group_by": "floor", "floor_order": [], "pinned": [], "order": [], "cards": {}}


def _obj(value: Any, name: str, allowed: set[str]) -> dict[str, Any]:
    if not isinstance(value, dict):
        raise ValueError(f"{name} must be an object")
    extra = set(value) - allowed
    if extra:
        raise ValueError(f"{name}: unknown key {sorted(extra)[0]}")
    return value


def _choice(value: Any, allowed: tuple[str, ...], name: str) -> str:
    if not isinstance(value, str) or value not in allowed:
        raise ValueError(f"{name} must be one of {', '.join(allowed)}")
    return value


def _bool(value: Any, name: str) -> bool:
    if not isinstance(value, bool):
        raise ValueError(f"{name} must be true or false")
    return value


def _keys(value: Any, name: str, limit: int) -> list[str]:
    if not isinstance(value, list) or len(value) > limit:
        raise ValueError(f"{name} must be a list of at most {limit} device keys")
    out: list[str] = []
    for item in value:
        if not isinstance(item, str) or not KEY_RE.match(item):
            raise ValueError(f"{name}: not a device key")
        if item not in out:
            out.append(item)
    return out


def default_layout() -> dict[str, Any]:
    return copy.deepcopy(EMPTY_LAYOUT)


def normalise_layout(value: Any) -> dict[str, Any]:
    """The installation layout, validated in full; missing keys take their defaults."""
    src = _obj(value, "layout", {"version", "group_by", "floor_order", "pinned", "order", "cards"})
    if src.get("version", 1) != 1 or isinstance(src.get("version"), bool):
        raise ValueError("layout.version must be 1")
    out = default_layout()
    if "group_by" in src:
        out["group_by"] = _choice(src["group_by"], GROUP_BY, "group_by")
    if "floor_order" in src:
        floors = src["floor_order"]
        if not isinstance(floors, list) or len(floors) > MAX_FLOORS:
            raise ValueError(f"floor_order must be a list of at most {MAX_FLOORS} floor ids")
        for f in floors:
            if not isinstance(f, str) or not FLOOR_RE.match(f):
                raise ValueError("floor_order: not a floor id")
            if f not in out["floor_order"]:
                out["floor_order"].append(f)
    if "pinned" in src:
        out["pinned"] = _keys(src["pinned"], "pinned", MAX_PINNED)
    if "order" in src:
        out["order"] = _keys(src["order"], "order", MAX_KEYS)
    if "cards" in src:
        cards = src["cards"]
        if not isinstance(cards, dict) or len(cards) > MAX_KEYS:
            raise ValueError(f"cards must be an object of at most {MAX_KEYS} device keys")
        for key, cfg in cards.items():
            if not isinstance(key, str) or not KEY_RE.match(key):
                raise ValueError("cards: not a device key")
            c = _obj(cfg, "card", {"on", "size", "phone_on", "phone_size"})
            phone_on, phone_size = c.get("phone_on"), c.get("phone_size")
            out["cards"][key] = {
                "on": _bool(c["on"], "card.on") if "on" in c else True,
                "size": _choice(c["size"], SIZES, "card.size") if "size" in c else "m",
                "phone_on": None if phone_on is None else _bool(phone_on, "card.phone_on"),
                "phone_size": None if phone_size is None else _choice(phone_size, PHONE_SIZES, "card.phone_size"),
            }
    return out


def normalise_personal(value: Any) -> dict[str, Any]:
    """The personal override of a holder of `screen.personalize`: group, order and per card on / size only."""
    src = _obj(value, "multimedia.personal", {"group_by", "order", "cards"})
    out: dict[str, Any] = {"group_by": None, "order": None, "cards": {}}
    if src.get("group_by") is not None:
        out["group_by"] = _choice(src["group_by"], GROUP_BY, "group_by")
    if src.get("order") is not None:
        out["order"] = _keys(src["order"], "order", MAX_KEYS)
    cards = src.get("cards") or {}
    if not isinstance(cards, dict) or len(cards) > MAX_KEYS:
        raise ValueError(f"cards must be an object of at most {MAX_KEYS} device keys")
    for key, cfg in cards.items():
        if not isinstance(key, str) or not KEY_RE.match(key):
            raise ValueError("cards: not a device key")
        c = _obj(cfg, "card", {"on", "size"})
        entry: dict[str, Any] = {}
        if "on" in c:
            entry["on"] = _bool(c["on"], "card.on")
        if "size" in c:
            entry["size"] = _choice(c["size"], SIZES, "card.size")
        out["cards"][key] = entry
    return out


def personal_is_empty(personal: dict[str, Any] | None) -> bool:
    return not personal or (personal.get("group_by") is None and personal.get("order") is None and not personal.get("cards"))


def normalise_remote_config(value: Any) -> dict[str, Any]:
    """The remote's sections: all 11 exactly once (order = display order), `more` a subset of them (behind "עוד מקשים")."""
    src = _obj(value, "remote", {"sections", "more", "scope"})
    sections = src.get("sections")
    if not isinstance(sections, list) or len(sections) != len(REMOTE_SECTIONS):
        raise ValueError(f"sections must list all {len(REMOTE_SECTIONS)} sections exactly once")
    out_sections: list[dict[str, Any]] = []
    for s in sections:
        item = _obj(s, "section", {"id", "on"})
        sid = _choice(item.get("id"), REMOTE_SECTIONS, "section.id")
        if any(x["id"] == sid for x in out_sections):
            raise ValueError("a section appears twice")
        out_sections.append({"id": sid, "on": _bool(item.get("on"), "section.on")})
    more = src.get("more")
    if not isinstance(more, list):
        raise ValueError("more must be a list of section ids")
    out_more: list[str] = []
    for m in more:
        if not isinstance(m, str) or m not in REMOTE_SECTIONS:
            raise ValueError("more: unknown section")
        if m not in out_more:
            out_more.append(m)
    return {"sections": out_sections, "more": out_more}


def default_remote() -> dict[str, Any]:
    return copy.deepcopy(DEFAULT_REMOTE)


def prune_keys(layout: dict[str, Any], gone: set[str]) -> dict[str, Any]:
    """The layout without the device keys in `gone` (the janitor, after a device was deleted for 30 days)."""
    out = copy.deepcopy(layout)
    out["pinned"] = [k for k in out.get("pinned", []) if k not in gone]
    out["order"] = [k for k in out.get("order", []) if k not in gone]
    out["cards"] = {k: v for k, v in out.get("cards", {}).items() if k not in gone}
    return out
