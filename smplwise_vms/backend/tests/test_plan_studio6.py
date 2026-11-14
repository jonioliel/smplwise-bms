"""Plan Studio 6, slice S0 (CR-029): document 2.2 - the material, ceiling, tint, light, north and walk-position fields,
the material library manifest and the resolver. Old documents open unchanged (version, hashes, validation); a 2.2
document validates; unknown materials warn, never fail; the resolver is deterministic and matches the shared golden the
frontend's material-resolve.ts is tested against (contracts/fixtures/plan_geometry/sample-v22.materials.json)."""
from __future__ import annotations

import copy
import json
import pathlib
import random

import pytest

from smplwise.services import geometry_store as store
from smplwise.services import plan_catalog as cat
from smplwise.services import plan_geometry as pg
from smplwise.services import plan_package as pkg
from smplwise.services import plan_studio6 as s6

ROOT = pathlib.Path(__file__).resolve().parents[3]
FIX = ROOT / "contracts" / "fixtures" / "plan_geometry"
SCHEMA = ROOT / "contracts" / "schemas" / "plan_geometry.v2.schema.json"


def _load(name: str) -> dict:
    return json.loads((FIX / name).read_text(encoding="utf-8"))


def _codes(doc: dict) -> set[tuple[str, str | None, str]]:
    return {(i["code"], i["id"], i["severity"]) for i in pg.validate(doc)}


ITEMS = cat.builtin()["items"]


# ---------------------------------------------------------------- the library

def test_library_is_valid_and_the_frontend_copy_identical():
    data = json.loads(s6.MATERIALS_FILE.read_text(encoding="utf-8"))
    assert s6.check_library(data) == []
    front = ROOT / "frontend" / "src" / "map" / "materials.json"
    assert front.read_bytes() == s6.MATERIALS_FILE.read_bytes(), "frontend/src/map/materials.json must be a byte copy"
    ids = s6.library()["ids"]
    # LOOK_SPEC section 2 ids are all present, and the CR-029 section 6.2 spellings resolve through aliases
    for mid in ("plaster_white", "plaster_exterior", "plaster_ceiling", "concrete", "tiles_white", "tiles_grey", "oak", "carpet", "fabric_grey",
                "fabric_accent", "fabric_rug", "linen", "leather", "wood_light", "wood_dark", "door_wood", "metal_dark", "metal_light", "asphalt",
                "grass", "screen_off", "shutter", "glass", "glass_frosted", "door_metal", "brick_painted", "floor_sport", "plastic"):
        assert mid in ids, mid
    assert [s6.canonical(a) for a in ("floor_oak", "floor_concrete", "floor_tiles_grey", "floor_carpet", "floor_asphalt", "floor_grass")] == \
        ["oak", "concrete", "tiles_grey", "carpet", "asphalt", "grass"]
    assert s6.canonical("nope") is None and s6.canonical(None) is None and s6.canonical(3) is None


def test_library_checker_reports_problems():
    good = json.loads(s6.MATERIALS_FILE.read_text(encoding="utf-8"))
    bad = copy.deepcopy(good)
    bad["materials"][0]["tint"] = {"light": "red"}
    bad["materials"][1]["aliases"] = ["plaster_white"]
    bad["materials"][2]["roughness"] = 2
    errs = s6.check_library(bad)
    assert any("tint" in e for e in errs) and any("duplicate" in e for e in errs) and any("roughness" in e for e in errs)
    assert s6.check_library({"format": "x"}) == ["format: must be plan3d-materials-1"]


# ---------------------------------------------------------------- versions: old documents unchanged, 2.2 validates

@pytest.mark.parametrize(("name", "version"), [("sample-v2.json", "2.0"), ("sample-v2-glass.json", "2.1"), ("sample-curved.json", "2.1")])
def test_older_documents_keep_their_version_and_validation(name, version):
    doc = _load(name)
    assert doc["schema_version"] == version and pg.document_version(doc) == version and not s6.uses_studio6(doc)
    before = pg.validate(doc)
    assert [i for i in before if i["code"] == "material_unknown"] == []
    normalized = pg.normalize(doc, ITEMS)
    assert pg.document_version(normalized) == version
    # the geometry hash of a document without the new top-level fields is exactly the old formula
    old_formula = pkg._sha(pg.canonical_json({k: doc.get(k) for k in (*pg.COLLECTIONS, "floor_height_m")}).encode("utf-8"))
    assert pkg.geometry_hash(doc) == old_formula


def test_the_22_fixture_validates_with_one_warning_and_is_22():
    doc = _load("sample-v22.json")
    assert doc["schema_version"] == "2.2" and pg.document_version(doc) == "2.2"
    assert _codes(doc) == {("material_unknown", "wc", "warning")}
    assert "2.2" in pg.SCHEMA_VERSIONS and pg.SCHEMA_VERSIONS[-1] == "2.2"


@pytest.mark.parametrize("patch", [
    lambda d: d["walls"][0].__setitem__("material_id", "oak"),
    lambda d: d["openings"][1].__setitem__("tint", "clear"),
    lambda d: d["objects"][0].__setitem__("light", {"kind": "ceiling", "color_k": 3000, "lumens": 800}),
    lambda d: d.__setitem__("rooms", [{"id": "r", "ceiling": False}]),
    lambda d: d["levels"][0].__setitem__("floor_material_id", "oak"),
    lambda d: d.__setitem__("north_deg", 0),
    lambda d: d.__setitem__("walk_positions", [{"id": "p", "name": "x", "x": 0.5, "y": 0.5, "level_id": "L0", "heading_deg": 0}]),
])
def test_any_new_field_makes_the_document_22(patch):
    doc = _load("sample-v2.json")
    patch(doc)
    assert s6.uses_studio6(doc) and pg.document_version(doc) == "2.2"


def test_an_empty_walk_positions_list_is_normalised_away():
    doc = _load("sample-v2.json")
    doc["walk_positions"] = []
    assert pg.document_version(doc) == "2.0"
    out = pg.normalize(doc, ITEMS)
    assert "walk_positions" not in out and pg.document_version(out) == "2.0"


def test_normalize_turns_aliases_into_ids_and_folds_headings():
    doc = _load("sample-v22.json")
    doc["levels"][1]["floor_material_id"] = "floor_oak"
    doc["walls"][1]["material_id"] = "floor_concrete"
    doc["walk_positions"][1]["heading_deg"] = -90
    out = pg.normalize(doc, ITEMS)
    assert out["levels"][1]["floor_material_id"] == "oak" and out["walls"][1]["material_id"] == "concrete"
    assert out["walk_positions"][1]["heading_deg"] == 270.0
    assert out["walls"][0]["material_id"] == "no_such_material"  # unknown ids stay as written (a newer library may know them)
    assert doc["levels"][1]["floor_material_id"] == "floor_oak"  # the input is untouched


# ---------------------------------------------------------------- validation rules

def _with(patch) -> dict:
    doc = _load("sample-v22.json")
    patch(doc)
    return doc


@pytest.mark.parametrize("patch", [
    lambda d: d["walls"][0].__setitem__("material_id", 5),
    lambda d: d["walls"][0].__setitem__("material_id", "x" * 65),
    lambda d: d["rooms"][0].__setitem__("ceiling", "no"),
    lambda d: d["openings"][0].__setitem__("tint", 1),
    lambda d: d["objects"][0].__setitem__("light", {"kind": "ceiling", "color_k": "warm", "lumens": 1}),
    lambda d: d["objects"][0].__setitem__("light", "on"),
    lambda d: d["levels"][0].__setitem__("ceiling_material_id", []),
    lambda d: d.__setitem__("north_deg", "north"),
    lambda d: d.__setitem__("walk_positions", {"a": 1}),
    lambda d: d["walk_positions"].append({"id": "p3", "name": "x", "x": "0.5", "y": 0.5, "level_id": "L0", "heading_deg": 0}),
    lambda d: d.__setitem__("walk_positions", [{"id": f"p{i}", "name": "x", "x": 0.5, "y": 0.5, "level_id": "L0", "heading_deg": 0} for i in range(51)]),
])
def test_wrong_types_refuse_the_save(patch):
    assert any(i["structural"] for i in pg.validate(_with(patch)))


@pytest.mark.parametrize(("patch", "code"), [
    (lambda d: d["openings"][1].__setitem__("tint", "green"), "enum"),
    (lambda d: d["objects"][2].__setitem__("light", {"kind": "laser", "color_k": 3000, "lumens": 800}), "enum"),
    (lambda d: d["objects"][2].__setitem__("light", {"kind": "spot", "color_k": 1000, "lumens": 800}), "light"),
    (lambda d: d["objects"][2].__setitem__("light", {"kind": "spot", "color_k": 3000, "lumens": 0}), "light"),
    (lambda d: d["objects"][2].__setitem__("light", {"kind": "spot", "color_k": 3000, "lumens": 10, "beam_deg": 200}), "light"),
    (lambda d: d.__setitem__("north_deg", 360), "north"),
    (lambda d: d.__setitem__("north_deg", -1), "north"),
    (lambda d: d["walk_positions"].append(dict(d["walk_positions"][0])), "duplicate_id"),
    (lambda d: d["walk_positions"][1].__setitem__("is_default", True), "walk_default"),
    (lambda d: d["walk_positions"][1].__setitem__("level_id", "nope"), "unknown_level"),
    (lambda d: d["walk_positions"][1].__setitem__("x", 1.5), "bounds"),
    (lambda d: d["walk_positions"][1].__setitem__("name", "   "), "name"),
])
def test_value_rules_are_errors(patch, code):
    issues = pg.validate(_with(patch))
    assert not any(i["structural"] for i in issues)
    assert any(i["code"] == code and i["severity"] == "error" for i in issues), issues


def test_light_on_a_non_lamp_and_unknown_materials_only_warn():
    doc = _with(lambda d: (d["objects"][0].__setitem__("light", {"kind": "spot", "color_k": 3000, "lumens": 10}),
                           d["rooms"][1].__setitem__("floor_material_id", "marble_from_the_future")))
    issues = pg.validate(doc)
    assert {(i["code"], i["severity"]) for i in issues} == {("not_a_light", "warning"), ("material_unknown", "warning")}


# ---------------------------------------------------------------- hashes and diff cover the new fields

def test_doc_and_geometry_hash_cover_the_new_fields():
    base = _load("sample-v22.json")
    h0, g0 = store.doc_hash(base), pkg.geometry_hash(base)
    for patch in (lambda d: d["walls"][1].__setitem__("material_id", "tiles_white"), lambda d: d.__setitem__("north_deg", 90.0),
                  lambda d: d["walk_positions"][0].__setitem__("heading_deg", 10.0), lambda d: d["rooms"][0].__setitem__("ceiling", True)):
        d = copy.deepcopy(base)
        patch(d)
        assert store.doc_hash(d) != h0 and pkg.geometry_hash(d) != g0  # a bake keyed on the geometry is invalidated


def test_diff_reports_a_view_change():
    a = _load("sample-v22.json")
    b = copy.deepcopy(a)
    b["north_deg"] = 45.0
    d = pg.diff(a, b)
    assert d["view_changed"] is True and d["same"] is False and d["total"] == 0
    assert pg.diff(a, copy.deepcopy(a)) == {"collections": {}, "total": 0, "calibration_changed": False, "view_changed": False, "same": True}
    assert pg.diff(None, a)["view_changed"] is False


def test_package_merge_carries_north_and_walk_positions():
    cur = _load("sample-v2.json")
    inc = _load("sample-v22.json")
    out = pkg._merge(cur, inc)
    assert out["north_deg"] == 23.5 and [p["id"] for p in out["walk_positions"]] == ["wp-entry", "wp-hall"]
    cur2 = copy.deepcopy(inc)
    cur2["north_deg"] = 10.0
    cur2["walk_positions"] = [dict(inc["walk_positions"][0], name="ישן"), {"id": "wp-mine", "name": "שלי", "x": 0.1, "y": 0.1, "level_id": "L0", "heading_deg": 0.0}]
    out2 = pkg._merge(cur2, inc)
    assert out2["north_deg"] == 10.0  # the current north stays, as the floor height does
    assert [(p["id"], p["name"]) for p in out2["walk_positions"]] == [("wp-entry", "כניסה"), ("wp-mine", "שלי"), ("wp-hall", "אולם")]


# ---------------------------------------------------------------- the resolver

def test_resolver_matches_the_shared_golden():
    golden = json.loads((FIX / "sample-v22.materials.json").read_text(encoding="utf-8"))
    assert s6.resolve(_load("sample-v22.json"), ITEMS) == golden


def test_resolver_is_deterministic_under_reordering():
    doc = _load("sample-v22.json")
    first = s6.resolve(doc, ITEMS)
    rnd = random.Random(7)
    for _ in range(5):
        d = copy.deepcopy(doc)
        for coll in ("walls", "openings", "objects", "rooms", "levels"):
            rnd.shuffle(d[coll])
        assert pg.canonical_json(s6.resolve(d, ITEMS)) == pg.canonical_json(first)


def test_resolver_defaults_on_an_old_document():
    r = s6.resolve(_load("sample-v2.json"), ITEMS)
    assert r["walls"] == {"wa": "plaster_exterior", "wb": "plaster_white", "wc": "plaster_white", "wd": "plaster_white"}
    assert r["openings"] == {"oa": "door_wood", "ob": "glass", "oc": "door_wood", "od": "door_wood", "oe": None, "of": "door_wood"}
    assert r["levels"] == {"L0": {"floor": "concrete", "ceiling": "plaster_ceiling"}, "L1": {"floor": "concrete", "ceiling": "plaster_ceiling"}}
    assert r["objects"]["o1"] == ITEMS["chair.basic"]["material_id"] and r["lights"]["o3"] == ITEMS["light.ceiling"]["light"]
    assert r["rooms"] == {} and r["warnings"] == []


def test_resolver_rules_for_rooms_and_objects():
    doc = _load("sample-v2.json")
    doc["rooms"] = [{"id": "a", "tags": ["סלון"]}, {"id": "b", "tags": ["Gym hall"]}, {"id": "c", "tags": ["חניה"]}, {"id": "d", "tags": ["גינה"]},
                    {"id": "e", "tags": ["unrelated"], "level_id": "L1"}]
    doc["levels"][1]["floor_material_id"] = "carpet"
    doc["objects"].append({"id": "o9", "item_id": "custom.unknown", "level_id": "L0", "position": [0.5, 0.5], "rotation_deg": 0, "size": {"w_m": 1, "d_m": 1, "h_m": 1},
                           "z_m": 0, "params": {}, "label": None, "anchor_ref": None, "group_id": None, "confidence": 1, "source": "manual", "locked": False})
    r = s6.resolve(doc, ITEMS)
    assert {k: v["floor"] for k, v in r["rooms"].items()} == {"a": "oak", "b": "floor_sport", "c": "asphalt", "d": "grass", "e": "carpet"}
    assert r["objects"]["o9"] == "plastic"


# ---------------------------------------------------------------- the catalog fields

def test_builtin_catalog_carries_the_realistic_fields():
    b = cat.builtin()
    assert b["catalog_version"] == "2026.10.1"
    for iid, item in b["items"].items():
        assert s6.canonical(item["material_id"]) == item["material_id"], iid
        assert ("light" in item) == (item["role"] == "light"), iid
    assert b["items"]["stairs.straight"]["walkable"] is True and b["items"]["elevator.passenger"]["walkable"] is False
    assert b["items"]["sofa.3"]["material_id"] == "fabric_accent"  # LOOK_SPEC: the one muted accent


@pytest.mark.parametrize(("patch", "problem"), [
    ({"material_id": "nope"}, "material_id"),
    ({"material_id": "floor_oak"}, "material_id"),  # the file must carry ids, not aliases
    ({"light": {"kind": "ceiling", "color_k": 9000, "lumens": 1}}, "light"),
    ({"walkable": "yes"}, "walkable"),
])
def test_catalog_checker_refuses_bad_fields(patch, problem):
    item = dict(ITEMS["chair.basic"], **patch)
    assert any(problem in e for e in cat.check_item(item, set(), builtin=True))


def test_catalog_checker_refuses_light_on_a_non_lamp():
    item = dict(ITEMS["chair.basic"], light={"kind": "ceiling", "color_k": 3000, "lumens": 800})
    assert any("only for items of role light" in e for e in cat.check_item(item, set(), builtin=True))


def test_custom_items_inherit_the_realistic_fields_from_their_base():
    row = {"id": "my.lamp", "based_on": "light.pendant", "names_json": json.dumps({"he": "מנורה"}), "tags_json": "[]", "role": "light", "shape": "cylinder",
           "size_json": json.dumps({"w_m": 0.4, "d_m": 0.4, "h_m": 0.4}), "z_m": -1.0, "params_json": "{}", "icon": "lamp", "color_token": "light",
           "created_by": "u", "created_at": "t", "updated_at": "t", "category": "lighting"}
    item = cat.row_item(row)
    assert item["light"] == ITEMS["light.pendant"]["light"] and item["material_id"] == ITEMS["light.pendant"]["material_id"]
    assert "light" not in cat.row_item(dict(row, role="furniture"))  # a lamp's light never sticks to a non-lamp
    assert "material_id" not in cat.row_item(dict(row, based_on=None))


# ---------------------------------------------------------------- the published contract

def test_schema_file_describes_document_22():
    schema = json.loads(SCHEMA.read_text(encoding="utf-8"))
    assert schema["properties"]["schema_version"]["enum"] == ["2.0", "2.1", "2.2"]
    defs = schema["$defs"]
    assert defs["light"]["properties"]["kind"]["enum"] == list(s6.LIGHT_KINDS)
    assert defs["opening"]["properties"]["tint"]["enum"] == list(s6.TINTS)
    assert schema["properties"]["walk_positions"]["maxItems"] == s6.MAX_WALK_POSITIONS
    for d, keys in (("wall", ("material_id",)), ("opening", ("material_id", "tint")), ("object", ("material_id", "light")),
                    ("room", ("floor_material_id", "ceiling_material_id", "ceiling")), ("level", ("floor_material_id", "ceiling_material_id"))):
        assert set(keys) <= set(defs[d]["properties"]), d
