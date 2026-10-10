"""Plan Studio 6 (CR-029 slice S0): the document fields of the realistic 3D level and the eye-level walk, the material
library manifest (catalog/materials.json) and the material resolver.

Document 2.2 is one minor, additive bump over 2.1 (window walls / curved walls): it is written only on a document that
carries one of the fields below, so every other document stays byte-identical 2.0 / 2.1 and an older server keeps reading
it (and refuses, never misreads, a 2.2 one - plan_geometry.SCHEMA_VERSIONS). All fields are optional:

| field | on | meaning |
|---|---|---|
| material_id | walls, openings, objects | a material of the library (an alias is normalised to its id) |
| floor_material_id / ceiling_material_id | rooms, levels | the floor and ceiling material (a room's wins over its level's) |
| ceiling | rooms | false = no ceiling (a hall with a visible roof, an outdoor room); absent = true |
| tint | window openings | clear / tinted / frosted / reflective (the window wall glazing's tints) |
| light | objects (lamps) | {kind, color_k, lumens, beam_deg?}: the lamp's emission; absent = the catalog item's |
| north_deg | document | plan up = north is 0; the sun's direction (S2). Top level: `transform` is server-owned |
| walk_positions | document | the saved walk viewpoints [{id, name, x, y, level_id, heading_deg, is_default}] (0..1 plan space) |

Contradictions with CR-029 section 5.2, recorded (docs/changes/CR-029-ST7-PORT-NOTES.md): the CR names the bump "2.1", which the
window walls and curved walls took first (so: 2.2); it puts north under `transform`, which rebase() rewrites from the plan
version on every save (so: top level); it calls the window field `glazing`, which on a wall is an object (so: `tint`, the
glazing block's own field name and values); it names floors `floor_oak` etc. while LOOK_SPEC section 2 (binding for the port)
names them `oak` etc. (so: LOOK_SPEC ids, the CR spellings as aliases).

The resolver is a pure function (frontend/src/map/material-resolve.ts mirrors it; contracts/fixtures/plan_geometry/
sample-v22.materials.json pins both): the same document and library give the same materials. An unknown material id is a
WARNING with the default in its place - never an error, so an older library build still opens a newer document.
"""
from __future__ import annotations

import json
import math
from functools import lru_cache
from pathlib import Path
from typing import Any, Callable, Mapping

from . import plan_glass

SCHEMA_VERSION = "2.2"
MATERIALS_FILE = Path(__file__).resolve().parents[1] / "catalog" / "materials.json"
MATERIALS_FORMAT = "plan3d-materials-1"
MATERIAL_GROUPS = ("wall", "floor", "ceiling", "door", "window", "object", "outdoor")
TINTS = plan_glass.TINTS
LIGHT_KINDS = ("ceiling", "wall", "spot", "strip", "floor", "pendant")
COLOR_K = (1800, 6500)
LUMENS = (1, 20000)
BEAM_DEG = (1, 180)
MAX_WALK_POSITIONS = 50
MAX_NAME = 40
MAX_ID = 64
ITEM_FIELDS = {
    "walls": ("material_id",),
    "openings": ("material_id",),
    "objects": ("material_id",),
    "rooms": ("floor_material_id", "ceiling_material_id"),
    "levels": ("floor_material_id", "ceiling_material_id"),
}
DOC_FIELDS = ("north_deg", "walk_positions")
STUDIO6_ITEM_KEYS = {"walls": ("material_id",), "openings": ("material_id", "tint"), "objects": ("material_id", "light"),
                     "rooms": ("floor_material_id", "ceiling_material_id", "ceiling"), "levels": ("floor_material_id", "ceiling_material_id")}

# defaults (CR-029 section 5.2 "default when absent", in LOOK_SPEC ids)
WALL_DEFAULT = {"exterior": "plaster_exterior", "glass": "glass", "railing": "metal_dark"}
WALL_FALLBACK = "plaster_white"
OPENING_DEFAULT = {"door": "door_wood", "window": "glass"}
LEVEL_FLOOR = "concrete"
LEVEL_CEILING = "plaster_ceiling"
ROLE_MATERIAL = {"furniture": "wood_light", "kitchen": "wood_light", "sanitary": "tiles_white", "office": "plastic", "light": "metal_dark",
                 "electrical": "metal_light", "safety": "metal_light", "medical": "metal_light", "sport": "metal_dark", "structure": "concrete",
                 "circulation": "concrete", "security": "metal_dark", "outdoor": "concrete"}
OBJECT_FALLBACK = "plastic"
LIGHT_DEFAULT = {"kind": "ceiling", "color_k": 3000, "lumens": 800}
# a room's floor by its tags (first rule whose keyword is inside a tag, case-folded); nothing matches = its level's floor
ROOM_FLOOR_RULES: tuple[tuple[str, tuple[str, ...]], ...] = (
    ("tiles_grey", ("bath", "toilet", "shower", "sanitary", "wc", "kitchen", "אמבטיה", "שירותים", "מקלחת", "רחצה", "מטבח")),
    ("floor_sport", ("sport", "gym", "court", "ספורט", "כושר", "מגרש")),
    ("asphalt", ("parking", "road", "חניה", "חנייה", "כביש")),
    ("grass", ("garden", "lawn", "yard", "גינה", "דשא", "חצר")),
    ("carpet", ("office", "meeting", "משרד", "ישיבות")),
    ("oak", ("residential", "living", "bedroom", "apartment", "מגורים", "סלון", "חדר שינה", "דירה")),
)


def _num(v: Any) -> bool:
    if not isinstance(v, (int, float)) or isinstance(v, bool):
        return False
    try:
        return math.isfinite(v)
    except OverflowError:
        return False


def _id(v: Any) -> bool:
    return isinstance(v, str) and 1 <= len(v) <= MAX_ID


# ---------------------------------------------------------------- the library manifest

def check_library(data: Any) -> list[str]:
    """Every problem of a materials manifest (empty when it is valid)."""
    if not isinstance(data, dict) or data.get("format") != MATERIALS_FORMAT:
        return ["format: must be " + MATERIALS_FORMAT]
    errors: list[str] = []
    if not isinstance(data.get("library_version"), str) or not data["library_version"]:
        errors.append("library_version: missing")
    mats = data.get("materials")
    if not isinstance(mats, list) or not mats:
        return errors + ["materials: must be a non-empty list"]
    seen: set[str] = set()
    for m in mats:
        mid = m.get("id") if isinstance(m, dict) else None
        tag = mid if isinstance(mid, str) else "?"
        if not isinstance(m, dict) or not isinstance(mid, str) or not mid.replace("_", "").isalnum() or mid != mid.lower():
            errors.append(f"{tag}: id must be lower-case letters, digits and _")
            continue
        names = [mid, *(m.get("aliases") or [])]
        for n in names:
            if n in seen:
                errors.append(f"{tag}: duplicate id or alias {n}")
            seen.add(n)
        if m.get("group") not in MATERIAL_GROUPS:
            errors.append(f"{tag}: unknown group")
        if not isinstance(m.get("he"), str) or not m["he"].strip():
            errors.append(f"{tag}: he name missing")
        if not (_num(m.get("tile_m")) and 0.05 <= m["tile_m"] <= 20):
            errors.append(f"{tag}: tile_m must be 0.05..20")
        tint = m.get("tint")
        if not isinstance(tint, dict) or set(tint) != {"light", "dark"} or not all(isinstance(v, str) and len(v) == 7 and v.startswith("#") for v in tint.values()):
            errors.append(f"{tag}: tint must be {{light, dark}} as #rrggbb")
        for key in ("roughness", "metalness"):
            if not (_num(m.get(key)) and 0 <= m[key] <= 1):
                errors.append(f"{tag}: {key} must be 0..1")
        if not (_num(m.get("normal")) and 0 <= m["normal"] <= 4):
            errors.append(f"{tag}: normal must be 0..4")
        if m.get("set") is not None and not isinstance(m["set"], str):
            errors.append(f"{tag}: set must be a string or null")
    return errors


@lru_cache(maxsize=1)
def library() -> dict[str, Any]:
    """The material library, read once; a broken file is a packaging error (refuse to start rather than half serve)."""
    data = json.loads(MATERIALS_FILE.read_text(encoding="utf-8"))
    errors = check_library(data)
    if errors:
        raise RuntimeError("catalog/materials.json is invalid: " + "; ".join(errors[:5]))
    ids = tuple(m["id"] for m in data["materials"])
    aliases = {a: m["id"] for m in data["materials"] for a in m.get("aliases") or []}
    return {"library_version": data["library_version"], "ids": ids, "aliases": aliases}


def canonical(mid: Any) -> str | None:
    """The library id a material id names (itself or through an alias), or None when unknown."""
    if not isinstance(mid, str):
        return None
    lib = library()
    if mid in lib["ids"]:
        return mid
    return lib["aliases"].get(mid)


# ---------------------------------------------------------------- the document fields

def uses_studio6(doc: Any) -> bool:
    """Whether the document needs version 2.2: a Studio 6 field anywhere (empty walk_positions is normalised away)."""
    if not isinstance(doc, dict):
        return False
    if doc.get("north_deg") is not None or doc.get("walk_positions"):
        return True
    for coll, keys in STUDIO6_ITEM_KEYS.items():
        items = doc.get(coll)
        if isinstance(items, list) and any(isinstance(i, dict) and any(i.get(k) is not None for k in keys) for i in items):
            return True
    return False


def check_item_fields(coll: str, item: Mapping[str, Any], bad: Callable[[str], None]) -> None:
    """Structural types of the item fields (plan_geometry._check_fields calls it): a wrong type refuses the save."""
    for key in ITEM_FIELDS.get(coll, ()):
        v = item.get(key)
        if v is not None and not _id(v):
            bad(key)
    if coll == "rooms" and item.get("ceiling") is not None and not isinstance(item["ceiling"], bool):
        bad("ceiling")
    if coll == "openings" and item.get("tint") is not None and not isinstance(item["tint"], str):
        bad("tint")
    if coll == "objects" and item.get("light") is not None:
        light = item["light"]
        if not isinstance(light, dict) or not isinstance(light.get("kind"), str) or not _num(light.get("color_k")) or not _num(light.get("lumens")) \
                or (light.get("beam_deg") is not None and not _num(light["beam_deg"])):
            bad("light")


def check_doc_fields(doc: Mapping[str, Any], issue: Callable[..., None]) -> None:
    """Structural types of the document-level fields: north_deg a number, walk_positions a bounded list of objects."""
    north = doc.get("north_deg")
    if north is not None and not _num(north):
        issue("type", "השדה north_deg בסוג לא נכון.", path="north_deg", structural=True)
    wp = doc.get("walk_positions")
    if wp is None:
        return
    if not isinstance(wp, list):
        issue("type", "walk_positions חייב להיות רשימה.", path="walk_positions", structural=True)
        return
    if len(wp) > MAX_WALK_POSITIONS:
        issue("limit", f"walk_positions: יותר מ־{MAX_WALK_POSITIONS} עמדות.", path="walk_positions", structural=True)
        return
    for i, p in enumerate(wp):
        ok = (isinstance(p, dict) and _id(p.get("id")) and isinstance(p.get("name"), str) and _num(p.get("x")) and _num(p.get("y"))
              and isinstance(p.get("level_id"), str) and _num(p.get("heading_deg")) and (p.get("is_default") is None or isinstance(p["is_default"], bool)))
        if not ok:
            issue("type", f"walk_positions[{i}] בסוג לא נכון.", path=f"walk_positions[{i}]", structural=True)


def check(doc: Mapping[str, Any], levels: set[str], items: Mapping[str, Mapping[str, Any]], issue: Callable[..., None]) -> None:
    """The value rules (after the structural pass): unknown materials warn, ranges and enums are errors."""
    for coll, keys in ITEM_FIELDS.items():
        for it in doc.get(coll) or []:
            for key in keys:
                v = it.get(key)
                if v is not None and canonical(v) is None:
                    issue("material_unknown", f"החומר {v} לא קיים בספריית החומרים; מוצג חומר ברירת המחדל.", item=it["id"], path=coll, severity="warning")
    for o in doc.get("openings") or []:
        t = o.get("tint")
        if t is not None and t not in TINTS:
            issue("enum", "גוון זכוכית לא מוכר (clear / tinted / frosted / reflective).", item=o["id"], path="openings")
    for o in doc.get("objects") or []:
        light = o.get("light")
        if light is None:
            continue
        if light["kind"] not in LIGHT_KINDS:
            issue("enum", "סוג תאורה לא מוכר.", item=o["id"], path="objects")
        if not COLOR_K[0] <= light["color_k"] <= COLOR_K[1]:
            issue("light", f"טמפרטורת הצבע בין {COLOR_K[0]} ל־{COLOR_K[1]} K.", item=o["id"], path="objects")
        if not LUMENS[0] <= light["lumens"] <= LUMENS[1]:
            issue("light", f"עוצמת האור בין {LUMENS[0]} ל־{LUMENS[1]} לומן.", item=o["id"], path="objects")
        beam = light.get("beam_deg")
        if beam is not None and not BEAM_DEG[0] <= beam <= BEAM_DEG[1]:
            issue("light", f"זווית האלומה בין {BEAM_DEG[0]} ל־{BEAM_DEG[1]} מעלות.", item=o["id"], path="objects")
        role = (items.get(o.get("item_id")) or {}).get("role")
        if role is not None and role != "light":
            issue("not_a_light", "פרטי תאורה על עצם שאינו גוף תאורה; הם לא ישפיעו.", item=o["id"], path="objects", severity="warning")
    north = doc.get("north_deg")
    if north is not None and not 0 <= north < 360:
        issue("north", "כיוון הצפון בין 0 ל־360 מעלות (לא כולל 360).", path="north_deg")
    seen: set[str] = set()
    defaults = 0
    for p in doc.get("walk_positions") or []:
        pid = p["id"]
        if pid in seen:
            issue("duplicate_id", f"עמדת הסיור {pid} מופיעה פעמיים.", item=pid, path="walk_positions")
        seen.add(pid)
        if not 1 <= len(p["name"].strip()) <= MAX_NAME:
            issue("name", f"שם עמדת סיור 1 עד {MAX_NAME} תווים.", item=pid, path="walk_positions")
        if not (0 <= p["x"] <= 1 and 0 <= p["y"] <= 1):
            issue("bounds", "עמדת הסיור מחוץ לתוכנית.", item=pid, path="walk_positions")
        if p["level_id"] not in levels:
            issue("unknown_level", "עמדת הסיור שייכת למפלס שלא קיים.", item=pid, path="walk_positions")
        defaults += 1 if p.get("is_default") is True else 0
    if defaults > 1:
        issue("walk_default", "רק עמדת סיור אחת יכולה להיות ברירת המחדל.", path="walk_positions")


def normalize(doc: dict[str, Any]) -> None:
    """In place, on every save: material aliases become their library ids, an empty walk_positions list goes (absent and
    empty are the same - the document stays 2.0 / 2.1), headings fold into [0, 360). Malformed values are left for
    validate() to report."""
    for coll, keys in ITEM_FIELDS.items():
        for it in doc.get(coll) if isinstance(doc.get(coll), list) else []:
            if not isinstance(it, dict):
                continue
            for key in keys:
                c = canonical(it.get(key))
                if c is not None and c != it.get(key):
                    it[key] = c
    wp = doc.get("walk_positions")
    if isinstance(wp, list) and not wp:
        del doc["walk_positions"]
    elif isinstance(wp, list):
        for p in wp:
            if isinstance(p, dict) and _num(p.get("heading_deg")):
                h = round(float(p["heading_deg"]) % 360.0, 3)
                p["heading_deg"] = 0.0 if h >= 360.0 else h + 0.0


# ---------------------------------------------------------------- the resolver

def _room_floor_by_tags(tags: Any) -> str | None:
    if not isinstance(tags, list):
        return None
    folded = [t.casefold() for t in tags if isinstance(t, str)]
    for material, words in ROOM_FLOOR_RULES:
        if any(w in t for t in folded for w in words):
            return material
    return None


def resolve(doc: Mapping[str, Any], items: Mapping[str, Mapping[str, Any]]) -> dict[str, Any]:
    """The material of every surface the realistic level draws, and every lamp's light, from the document and the item
    index (plan_catalog.item_index): own field > catalog item > rule by kind / tags / role > fallback. Ids sorted; an
    unknown id resolves to the default and is listed in `warnings` ({path, id, material_id}). Pure and deterministic."""
    warnings: list[dict[str, str]] = []

    def own(coll: str, it: Mapping[str, Any], key: str) -> str | None:
        v = it.get(key)
        if v is None:
            return None
        c = canonical(v)
        if c is None:
            warnings.append({"path": f"{coll}.{key}", "id": str(it.get("id")), "material_id": str(v)})
        return c

    def items_of(coll: str) -> list[Mapping[str, Any]]:
        raw = doc.get(coll)
        return sorted((i for i in raw if isinstance(i, dict) and isinstance(i.get("id"), str)), key=lambda i: i["id"]) if isinstance(raw, list) else []

    levels: dict[str, dict[str, str]] = {}
    default_level = None
    for lv in items_of("levels"):
        levels[lv["id"]] = {"floor": own("levels", lv, "floor_material_id") or LEVEL_FLOOR, "ceiling": own("levels", lv, "ceiling_material_id") or LEVEL_CEILING}
        if lv.get("is_default") is True and default_level is None:
            default_level = lv["id"]
    fallback_level = {"floor": LEVEL_FLOOR, "ceiling": LEVEL_CEILING}
    rooms: dict[str, dict[str, Any]] = {}
    for r in items_of("rooms"):
        lv = levels.get(r.get("level_id") or default_level or "", fallback_level)
        rooms[r["id"]] = {"floor": own("rooms", r, "floor_material_id") or _room_floor_by_tags(r.get("tags")) or lv["floor"],
                          "ceiling": own("rooms", r, "ceiling_material_id") or lv["ceiling"], "has_ceiling": r.get("ceiling") is not False}
    walls = {w["id"]: own("walls", w, "material_id") or WALL_DEFAULT.get(str(w.get("kind")), WALL_FALLBACK) for w in items_of("walls")}
    openings: dict[str, str | None] = {}
    for o in items_of("openings"):
        kind = o.get("kind")
        default = ("glass_frosted" if o.get("tint") == "frosted" else "glass") if kind == "window" else OPENING_DEFAULT.get(str(kind))
        openings[o["id"]] = own("openings", o, "material_id") or default
    objects: dict[str, str] = {}
    lights: dict[str, dict[str, Any]] = {}
    for o in items_of("objects"):
        item = items.get(o.get("item_id")) if isinstance(o.get("item_id"), str) else None
        item = item or {}
        objects[o["id"]] = own("objects", o, "material_id") or canonical(item.get("material_id")) or ROLE_MATERIAL.get(str(item.get("role")), OBJECT_FALLBACK)
        if item.get("role") == "light":
            src = o.get("light") if isinstance(o.get("light"), dict) else item.get("light") if isinstance(item.get("light"), dict) else LIGHT_DEFAULT
            light = {"kind": src.get("kind") if src.get("kind") in LIGHT_KINDS else LIGHT_DEFAULT["kind"],
                     "color_k": int(min(COLOR_K[1], max(COLOR_K[0], src["color_k"]))) if _num(src.get("color_k")) else LIGHT_DEFAULT["color_k"],
                     "lumens": int(min(LUMENS[1], max(LUMENS[0], src["lumens"]))) if _num(src.get("lumens")) else LIGHT_DEFAULT["lumens"]}
            if _num(src.get("beam_deg")):
                light["beam_deg"] = int(min(BEAM_DEG[1], max(BEAM_DEG[0], src["beam_deg"])))
            lights[o["id"]] = light
    warnings.sort(key=lambda w: (w["path"], w["id"], w["material_id"]))
    return {"library_version": library()["library_version"], "levels": levels, "rooms": rooms, "walls": walls, "openings": openings,
            "objects": objects, "lights": lights, "warnings": warnings}
