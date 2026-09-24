"""Plan Studio object library (T085, CR-003): the built-in catalog shipped with the add-on (catalog/objects.json,
versioned) and the installation's custom items (catalog_items, migration 0020). A custom item may be "based on" a
built-in one and inherits what its row does not carry (z_ref, params_schema, anchor_kinds, ifc). Everything the
validator, the renderer, the search and the API need comes through the indexes here; nothing else reads the file."""
from __future__ import annotations

import json
import re
import sqlite3
from functools import lru_cache
from math import isfinite
from pathlib import Path
from typing import Any

CATALOG_FILE = Path(__file__).resolve().parents[1] / "catalog" / "objects.json"
CATEGORIES = ("structure", "circulation", "seating", "storage", "lighting", "electrical", "safety", "medical", "sport", "facilities", "security", "outdoor")
ROLES = ("furniture", "light", "electrical", "safety", "medical", "sport", "structure", "circulation", "security", "outdoor", "sanitary", "office", "kitchen")
SHAPES = ("box", "cylinder", "extruded_polygon", "stepped", "composite")
ICONS = ("box", "cylinder", "chair", "table", "sofa", "bed", "cabinet", "lamp", "panel", "socket", "extinguisher", "smoke", "exit", "aed", "medical", "goal",
         "mat", "stairs", "elevator", "doorstation", "tree", "sanitary", "office", "parking")
COLOR_TOKENS = ("object", "structure", "circulation", "furniture", "light", "electrical", "safety", "medical", "sport", "sanitary", "security", "outdoor")
Z_REFS = ("floor", "ceiling")
MIN_SIZE_M, MAX_SIZE_M = 0.05, 100.0
MIN_Z_M, MAX_Z_M = -50.0, 500.0
MAX_PARAMS_BYTES = 4096
MAX_TAGS = 20
ID_RE = re.compile(r"^[a-z0-9][a-z0-9._-]{0,63}$")
DEFAULT_IFC = {"class": "IfcFurniture", "predefined_type": "USERDEFINED"}


def _num(v: Any) -> bool:
    return isinstance(v, (int, float)) and not isinstance(v, bool) and isfinite(v)


def _size_ok(size: Any) -> bool:
    return isinstance(size, dict) and all(_num(size.get(k)) and MIN_SIZE_M <= size[k] <= MAX_SIZE_M for k in ("w_m", "d_m", "h_m")) and set(size) == {"w_m", "d_m", "h_m"}


def check_item(item: Any, ids: set[str], *, builtin: bool) -> list[str]:
    """Problems of one catalog item as "<id>: <what>" strings - the rules the file and a custom item share. `ids` collects
    the ids seen so far (a duplicate is a problem). A custom item is checked without z_ref / params_schema / anchor_kinds /
    ifc, which it takes from its base."""
    if not isinstance(item, dict):
        return ["item: not an object"]
    iid = item.get("id")
    tag = iid if isinstance(iid, str) else "?"
    out: list[str] = []
    if not isinstance(iid, str) or not ID_RE.match(iid):
        out.append(f"{tag}: id must match {ID_RE.pattern}")
    elif iid in ids:
        out.append(f"{tag}: duplicate id")
    else:
        ids.add(iid)
    if item.get("category") not in CATEGORIES:
        out.append(f"{tag}: unknown category")
    names = item.get("names")
    if not isinstance(names, dict) or not isinstance(names.get("he"), str) or not 1 <= len(names["he"].strip()) <= 80:
        out.append(f"{tag}: names.he must be 1..80 characters")
    if isinstance(names, dict) and "en" in names and (not isinstance(names["en"], str) or len(names["en"]) > 80):
        out.append(f"{tag}: names.en must be a string of at most 80 characters")
    tags = item.get("tags", [])
    if not isinstance(tags, list) or len(tags) > MAX_TAGS or not all(isinstance(t, str) and 1 <= len(t) <= 40 for t in tags):
        out.append(f"{tag}: tags must be up to {MAX_TAGS} strings of 1..40 characters")
    if item.get("role") not in ROLES:
        out.append(f"{tag}: unknown role")
    if item.get("shape") not in SHAPES:
        out.append(f"{tag}: unknown shape")
    if not _size_ok(item.get("size")):
        out.append(f"{tag}: size w_m / d_m / h_m must be {MIN_SIZE_M}..{MAX_SIZE_M} m")
    if not _num(item.get("z_m")) or not MIN_Z_M <= item["z_m"] <= MAX_Z_M:
        out.append(f"{tag}: z_m must be {MIN_Z_M}..{MAX_Z_M} m")
    params = item.get("params", {})
    if not isinstance(params, dict) or len(json.dumps(params, ensure_ascii=False)) > MAX_PARAMS_BYTES:
        out.append(f"{tag}: params must be an object under {MAX_PARAMS_BYTES} bytes")
    elif item.get("shape") == "stepped" and not (isinstance(params.get("rows"), int) and params["rows"] >= 1 and _num(params.get("step_height_m")) and _num(params.get("step_width_m"))):
        out.append(f"{tag}: a stepped shape needs params rows, step_height_m and step_width_m")
    if item.get("icon") not in ICONS:
        out.append(f"{tag}: unknown icon")
    if item.get("color_token") not in COLOR_TOKENS:
        out.append(f"{tag}: unknown color_token")
    if builtin:
        if item.get("z_ref") not in Z_REFS:
            out.append(f"{tag}: z_ref must be floor or ceiling")
        if not isinstance(item.get("params_schema"), dict):
            out.append(f"{tag}: params_schema must be an object")
        if not isinstance(item.get("anchor_kinds"), list) or not all(isinstance(k, str) for k in item["anchor_kinds"]):
            out.append(f"{tag}: anchor_kinds must be a list of domains")
        ifc = item.get("ifc")
        if not isinstance(ifc, dict) or not isinstance(ifc.get("class"), str) or not ifc["class"].startswith("Ifc"):
            out.append(f"{tag}: ifc.class must name an Ifc class")
    return out


def check_catalog(data: Any) -> list[str]:
    """Every problem of a catalog file (empty when it is valid): the header, the category list, each item, and that
    every category is used."""
    if not isinstance(data, dict):
        return ["catalog: not an object"]
    errors: list[str] = []
    if not isinstance(data.get("catalog_version"), str) or not data["catalog_version"].strip():
        errors.append("catalog_version: missing")
    cats = data.get("categories")
    if not isinstance(cats, list) or [c.get("id") if isinstance(c, dict) else None for c in cats] != list(CATEGORIES) or not all(isinstance(c.get("he"), str) and c["he"] for c in cats):
        errors.append("categories: must be the 12 known categories, in order, each with a Hebrew name")
    if data.get("icons") != list(ICONS):
        errors.append("icons: must list the 24 symbol ids")
    if data.get("color_tokens") != list(COLOR_TOKENS):
        errors.append("color_tokens: must list the known tokens")
    items = data.get("items")
    if not isinstance(items, list) or not items:
        errors.append("items: must be a non-empty list")
        return errors
    ids: set[str] = set()
    for item in items:
        errors.extend(check_item(item, ids, builtin=True))
    used = {i.get("category") for i in items if isinstance(i, dict)}
    for c in CATEGORIES:
        if c not in used:
            errors.append(f"category {c}: no items")
    return errors


@lru_cache(maxsize=1)
def builtin() -> dict[str, Any]:
    """The built-in library, read once. A broken file is a packaging error: refuse to start rather than serve half."""
    data = json.loads(CATALOG_FILE.read_text(encoding="utf-8"))
    errors = check_catalog(data)
    if errors:
        raise RuntimeError("catalog/objects.json is invalid: " + "; ".join(errors[:5]))
    return {"catalog_version": data["catalog_version"], "categories": data["categories"], "icons": list(data["icons"]), "color_tokens": list(data["color_tokens"]),
            "items": {i["id"]: i for i in data["items"]}}


def builtin_ids() -> frozenset[str]:
    return frozenset(builtin()["items"])


def row_item(r: sqlite3.Row | dict[str, Any]) -> dict[str, Any]:
    """A custom row as a library item: its own fields, and from its base what a row does not carry."""
    base = builtin()["items"].get(r["based_on"]) if r["based_on"] else None
    names = json.loads(r["names_json"])
    return {
        "id": r["id"], "custom": True, "based_on": r["based_on"], "category": r["category"], "names": {"he": names.get("he", ""), "en": names.get("en", "")},
        "tags": json.loads(r["tags_json"] or "[]"), "role": r["role"], "shape": r["shape"], "size": json.loads(r["size_json"]),
        "z_ref": base["z_ref"] if base else "floor", "z_m": r["z_m"], "params": json.loads(r["params_json"] or "{}"),
        "params_schema": dict(base["params_schema"]) if base else {}, "icon": r["icon"], "color_token": r["color_token"],
        "anchor_kinds": list(base["anchor_kinds"]) if base else [], "ifc": dict(base["ifc"]) if base else dict(DEFAULT_IFC),
        "created_by": r["created_by"], "created_at": r["created_at"], "updated_at": r["updated_at"],
    }


def custom_rows(conn: sqlite3.Connection) -> list[sqlite3.Row]:
    return conn.execute("SELECT * FROM catalog_items ORDER BY created_at, rowid").fetchall()


def custom_items(conn: sqlite3.Connection) -> list[dict[str, Any]]:
    return [row_item(r) for r in custom_rows(conn)]


def revision(conn: sqlite3.Connection) -> str:
    """What a client compares to know whether its copy of the library is current: the built-in version, the number of
    custom items and the latest custom change."""
    row = conn.execute("SELECT COUNT(*), MAX(updated_at) FROM catalog_items").fetchone()
    return f"{builtin()['catalog_version']}:{row[0]}:{row[1] or ''}"


def library(conn: sqlite3.Connection) -> dict[str, Any]:
    b = builtin()
    return {"catalog_version": b["catalog_version"], "revision": revision(conn), "categories": b["categories"], "icons": b["icons"], "color_tokens": b["color_tokens"],
            "items": [dict(i, custom=False, based_on=None) for i in b["items"].values()] + custom_items(conn)}


def item_index(conn: sqlite3.Connection) -> dict[str, dict[str, Any]]:
    """Every item by id (built-in and custom): what the validator, the normalizer and the renderer look up."""
    return {**builtin()["items"], **{i["id"]: i for i in custom_items(conn)}}


def names_index(conn: sqlite3.Connection) -> dict[str, dict[str, Any]]:
    """The searchable names of every item: he, en and tags."""
    return {iid: {"he": i["names"].get("he", ""), "en": i["names"].get("en", ""), "tags": list(i.get("tags", []))} for iid, i in item_index(conn).items()}
