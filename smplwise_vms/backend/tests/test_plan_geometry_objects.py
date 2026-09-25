"""Plan Studio document v2, phase 2 (T085): objects, groups, connectors and circuits have structural field rules
(a save is refused) and geometric rules (kept with the draft, block publishing) - a missing catalog item is geometric,
never structural; normalize() sums circuit power and derives a connector from a tribune that connects levels; the
body of an anchor takes the anchor's position; counts and the schema cover the new collections."""
from __future__ import annotations

import copy
import json
import pathlib

from smplwise.services import plan_catalog as cat
from smplwise.services import plan_geometry as pg

SCHEMA = pathlib.Path(__file__).resolve().parents[3] / "contracts" / "schemas" / "plan_geometry.v2.schema.json"
VERSION = {"id": "v1", "floor_id": "f1", "asset_id": "a1", "page": 1, "rotation": 0, "crop_json": None, "width_px": 1000, "height_px": 800,
           "scale_m_per_px": 0.01, "calibration_json": '{"method": "two_point", "pairs": [], "residual_pct": 0.0}'}


def _doc() -> dict:
    d = pg.new_document(VERSION, None)
    d["levels"].append({"id": "L1", "name": "אולם תחתון", "elevation_m": -1.2, "ceiling_height_m": 6.0, "is_default": False, "external_ids": {}})
    return d


def OBJ(oid: str, item: str = "chair.basic", pos=(0.2, 0.2), **kw) -> dict:
    o = {"id": oid, "item_id": item, "level_id": "L0", "position": list(pos), "rotation_deg": 0, "size": {"w_m": 0.45, "d_m": 0.45, "h_m": 0.85}, "z_m": 0, "params": {},
         "label": None, "anchor_ref": None, "group_id": None, "confidence": 1, "source": "manual", "locked": False, "external_ids": {}}
    o.update(kw)
    return o


def CONN(cid: str, **kw) -> dict:
    c = {"id": cid, "kind": "stairs", "level_from": "L0", "level_to": "L1", "floor_ids": [], "polyline": [[0.7, 0.7], [0.8, 0.7]], "width_m": 1.2, "label": None,
         "object_id": None, "source": "manual", "external_ids": {}}
    c.update(kw)
    return c


def _codes(doc) -> set[tuple[str, str | None]]:
    return {(i["code"], i["id"]) for i in pg.validate(doc) if not i["structural"]}


def _structural(doc) -> set[str]:
    return {i["path"] for i in pg.validate(doc) if i["structural"]}


def test_field_types_of_the_new_collections_are_structural():
    d = _doc()
    d["objects"] = [OBJ("o1", position="x", size=None, params=[], rotation_deg="north")]
    d["groups"] = [{"id": "g1", "kind": 3, "member_ids": "o1"}]
    d["connectors"] = [{"id": "c1", "kind": "stairs", "level_from": None, "floor_ids": "f", "polyline": "p", "width_m": "wide", "source": "manual"}]
    d["circuits"] = [{"id": "k1", "name": None, "switch_entity_id": 5, "member_ids": [1], "color_token": None}]
    paths = _structural(d)
    assert {"objects[0].position", "objects[0].size", "objects[0].params", "objects[0].rotation_deg", "groups[0].kind", "groups[0].member_ids",
            "connectors[0].level_from", "connectors[0].floor_ids", "connectors[0].polyline", "connectors[0].width_m",
            "circuits[0].name", "circuits[0].switch_entity_id", "circuits[0].member_ids", "circuits[0].color_token"} <= paths
    assert pg.validate(_doc()) == []


def test_object_rules_name_the_item_and_a_missing_catalog_item_blocks_only_publishing():
    d = _doc()
    d["objects"] = [OBJ("o1"), OBJ("o2", item="spaceship"), OBJ("o3", size={"w_m": 0.01, "d_m": 1, "h_m": 1}), OBJ("o4", position=(1.2, 0.5)), OBJ("o5", level_id="L9"),
                    OBJ("o6", group_id="g9"), OBJ("o7", z_m=900), OBJ("o8", anchor_ref={"resource_type": "camera"}), OBJ("o9", source="dreamed", confidence=2)]
    codes = _codes(d)
    assert ("unknown_item", "o2") in codes and not any(i["structural"] for i in pg.validate(d)), "a missing item is geometric, the save goes through"
    assert ("size", "o3") in codes and ("bounds", "o4") in codes and ("unknown_level", "o5") in codes and ("unknown_group", "o6") in codes
    assert ("z", "o7") in codes and ("anchor_ref", "o8") in codes and ("enum", "o9") in codes and ("confidence", "o9") in codes
    assert not any(c[1] == "o1" for c in codes)
    # a custom item known through the index passes; the same document without the index reports it missing
    d2 = _doc()
    d2["objects"] = [OBJ("o1", item="c-custom")]
    assert ("unknown_item", "o1") in _codes(d2)
    assert [i for i in pg.validate(d2, items={**cat.builtin()["items"], "c-custom": {"id": "c-custom", "role": "furniture"}}) if not i["structural"]] == []


def test_group_connector_and_circuit_rules():
    d = _doc()
    d["objects"] = [OBJ("o1"), OBJ("o2", item="light.ceiling", pos=(0.5, 0.3)), OBJ("o3", item="light.ceiling", pos=(0.6, 0.3))]
    d["groups"] = [{"id": "g1", "kind": "array", "member_ids": ["o1", "o9"], "params": {}}, {"id": "g2", "kind": "manual", "member_ids": ["o1"], "params": {}},
                   {"id": "g3", "kind": "cloud", "member_ids": [], "params": {}}]
    d["connectors"] = [CONN("c1"), CONN("c2", level_to="L0"), CONN("c3", level_to="L7"), CONN("c4", polyline=[[0.1, 0.1], [1.4, 0.1]]), CONN("c5", width_m=0.01),
                       CONN("c6", kind="teleport"), CONN("c7", level_to=None, floor_ids=[]), CONN("c8", level_to=None, floor_ids=["f-other"]), CONN("c9", object_id="o9")]
    d["circuits"] = [{"id": "k1", "name": "אולם", "switch_entity_id": "switch.hall", "member_ids": ["o2", "o3"], "color_token": "circuit-1", "power_w": 0},
                     {"id": "k2", "name": "", "switch_entity_id": "sensor.x", "member_ids": ["o1", "o9"], "color_token": "circuit-2", "power_w": -1}]
    codes = _codes(d)
    assert ("unknown_member", "g1") in codes and ("duplicate_member", "g2") in codes and ("enum", "g3") in codes
    assert ("connector_levels", "c2") in codes and ("unknown_level", "c3") in codes and ("bounds", "c4") in codes and ("size", "c5") in codes
    assert ("enum", "c6") in codes and ("connector_levels", "c7") in codes and ("unknown_object", "c9") in codes
    assert not any(c[1] in ("c1", "c8", "k1") for c in codes), "a cross-floor connector needs no level_to; the lamp circuit is fine"
    assert ("name", "k2") in codes and ("switch_entity", "k2") in codes and ("unknown_member", "k2") in codes and ("power", "k2") in codes
    assert [i["severity"] for i in pg.validate(d) if i["code"] == "not_a_light"] == ["warning"], "a chair on a circuit is only a warning"
    # limits stay structural
    big = _doc()
    big["objects"] = [OBJ(f"o{i}") for i in range(pg.LIMITS["objects"] + 1)]
    assert any(i["code"] == "limit" and i["structural"] for i in pg.validate(big))


def test_normalize_sums_circuit_power_and_derives_the_tribune_connector():
    d = _doc()
    d["objects"] = [OBJ("l1", item="light.ceiling", pos=(0.5, 0.3), size={"w_m": 0.4, "d_m": 0.4, "h_m": 0.1}, z_m=2.7),
                    OBJ("l2", item="light.ceiling", pos=(0.6, 0.3), size={"w_m": 0.4, "d_m": 0.4, "h_m": 0.1}, z_m=2.7, params={"power_w": 60}),
                    OBJ("t1", item="tribune.stepped", pos=(0.25, 0.6), rotation_deg=180, size={"w_m": 4, "d_m": 3, "h_m": 1.2},
                        params={"rows": 4, "step_height_m": 0.3, "step_width_m": 1.0, "connects_levels": "L1"})]
    d["circuits"] = [{"id": "k1", "name": "אולם", "switch_entity_id": "switch.hall", "member_ids": ["l1", "l2", "ghost"], "color_token": "circuit-1", "power_w": 0}]
    d["connectors"] = [CONN("c1")]
    items = cat.builtin()["items"]
    n = pg.normalize(d, items)
    assert n["circuits"][0]["power_w"] == 96, "36 from the item default + 60 from the object; a missing member counts nothing"
    assert [c["id"] for c in n["connectors"]] == ["c1", "cx-t1"]
    cx = n["connectors"][1]
    assert cx == {"id": "cx-t1", "kind": "tribune", "level_from": "L0", "level_to": "L1", "floor_ids": [], "polyline": [[0.25, 0.4125], [0.25, 0.7875]], "width_m": 4.0,
                  "label": None, "object_id": "t1", "source": "auto", "external_ids": {}}
    assert pg.normalize(n, items) == n, "idempotent"
    assert [i["code"] for i in pg.validate(n) if i["severity"] == "error"] == ["unknown_member"], "only the ghost member; the derived connector validates"
    assert d["connectors"] == [CONN("c1")] and d["circuits"][0]["power_w"] == 0, "the input is untouched"
    # the connector follows the object: no more connects_levels, no connector; stairs items derive their own kind
    gone = copy.deepcopy(n)
    gone["objects"][2]["params"]["connects_levels"] = None
    assert [c["id"] for c in pg.normalize(gone, items)["connectors"]] == ["c1"]
    ramp = copy.deepcopy(n)
    ramp["objects"][2].update({"item_id": "ramp.straight", "params": {"connects_levels": "L1"}})
    assert pg.normalize(ramp, items)["connectors"][1]["kind"] == "ramp"
    assert pg.object_axis(n["objects"][2], 1000, 800, 0.01) == [[0.25, 0.4125], [0.25, 0.7875]]
    assert pg.object_axis(dict(n["objects"][2], rotation_deg=90), 1000, 800, 0.01) == [[0.1, 0.6], [0.4, 0.6]]
    assert pg.normalize({"objects": "x"}, items) == {"objects": "x"}, "malformed input passes through"


def test_the_body_of_an_anchor_takes_the_anchor_position():
    d = _doc()
    d["objects"] = [OBJ("o1", item="light.ceiling", anchor_ref={"resource_type": "ha_entity", "resource_id": "light.store"}, rotation_deg=45),
                    OBJ("o2", item="light.ceiling", anchor_ref={"resource_type": "ha_entity", "resource_id": "light.gone"}), OBJ("o3")]
    moved = pg.apply_anchor_positions(d, {"ha_entity:light.store": {"x": 0.7123456789, "y": 0.25, "rotation": 90}})
    assert moved["objects"][0]["position"] == [0.712346, 0.25] and moved["objects"][0]["rotation_deg"] == 90
    assert moved["objects"][1]["position"] == [0.2, 0.2] and moved["objects"][2]["position"] == [0.2, 0.2]
    assert d["objects"][0]["position"] == [0.2, 0.2], "the input is untouched"


def test_counts_and_diff_cover_the_new_collections():
    d = _doc()
    d["objects"] = [OBJ("o1")]
    d["circuits"] = [{"id": "k1", "name": "x", "switch_entity_id": "switch.a", "member_ids": [], "color_token": "circuit-1", "power_w": 0}]
    d["connectors"] = [CONN("c1")]
    d["groups"] = [{"id": "g1", "kind": "manual", "member_ids": ["o1"], "params": {}}]
    assert pg.counts(d) == {"walls": 0, "openings": 0, "labels": 0, "objects": 1, "connectors": 1, "circuits": 1, "levels": 2, "groups": 1}
    diff = pg.diff(_doc(), d)
    assert set(diff["collections"]) == {"objects", "circuits", "connectors", "groups"} and diff["total"] == 4


def test_schema_file_types_the_new_collections():
    schema = json.loads(SCHEMA.read_text(encoding="utf-8"))
    defs = schema["$defs"]
    assert schema["properties"]["objects"]["items"] == {"$ref": "#/$defs/object"} and schema["properties"]["connectors"]["items"] == {"$ref": "#/$defs/connector"}
    assert schema["properties"]["circuits"]["items"] == {"$ref": "#/$defs/circuit"} and schema["properties"]["groups"]["items"] == {"$ref": "#/$defs/group"}
    assert set(defs["connector"]["properties"]["kind"]["enum"]) == set(pg.CONNECTOR_KINDS) and set(defs["group"]["properties"]["kind"]["enum"]) == set(pg.GROUP_KINDS)
    assert set(defs["object"]["required"]) >= {"id", "item_id", "level_id", "position", "rotation_deg", "size", "z_m", "params", "confidence", "source"}
    assert defs["size"]["properties"]["w_m"] == {"type": "number", "minimum": 0.05, "maximum": 100}
    assert defs["circuit"]["properties"]["switch_entity_id"]["pattern"] == pg.SWITCH_RE.pattern


# ---------------------------------------------------------------- fix round 1: malformed input, id length, derived-connector identity


def test_normalize_tolerates_malformed_nested_values():
    d = _doc()
    d["objects"] = [OBJ("o1", item_id=["not", "a", "string"])]
    d["circuits"] = [{"id": "k1", "name": "x", "switch_entity_id": "switch.a", "member_ids": ["o1", ["bad"], 5, None], "color_token": "circuit-1", "power_w": 0}]
    items = cat.builtin()["items"]
    n = pg.normalize(d, items)  # must not raise: TypeError (unhashable list) was the bug
    assert n["circuits"][0]["power_w"] == 0, "no member resolves to a real object with a usable power_w"
    assert isinstance(pg.validate(n), list), "validate() itself must not raise on the still-malformed item_id"


def test_apply_anchor_positions_tolerates_malformed_anchor_values():
    d = _doc()
    d["objects"] = [OBJ("o1", item="light.ceiling", anchor_ref={"resource_type": "ha_entity", "resource_id": "a.not_a_mapping"}, rotation_deg=5),
                    OBJ("o2", item="light.ceiling", anchor_ref={"resource_type": "ha_entity", "resource_id": "a.str_rotation"}, rotation_deg=10),
                    OBJ("o3", item="light.ceiling", anchor_ref={"resource_type": "ha_entity", "resource_id": "a.nan_rotation"}, rotation_deg=20)]
    anchors = {"ha_entity:a.not_a_mapping": ["not", "a", "mapping"], "ha_entity:a.str_rotation": {"x": 0.3, "y": 0.4, "rotation": "north"},
               "ha_entity:a.nan_rotation": {"x": 0.5, "y": 0.6, "rotation": float("nan")}}
    moved = pg.apply_anchor_positions(d, anchors)  # must not raise: AttributeError (list has no .get) / ValueError (float("north")) were the bugs
    assert moved["objects"][0]["position"] == [0.2, 0.2] and moved["objects"][0]["rotation_deg"] == 5, "a non-mapping anchor value is ignored entirely"
    assert moved["objects"][1]["position"] == [0.3, 0.4] and moved["objects"][1]["rotation_deg"] == 10, "a non-numeric rotation keeps the old value"
    assert moved["objects"][2]["position"] == [0.5, 0.6] and moved["objects"][2]["rotation_deg"] == 20, "a NaN rotation keeps the old value, never written"
    assert isinstance(pg.validate(moved), list)


def test_derived_connector_id_length_limit():
    ok_id = "o" * pg.MAX_DERIVED_OBJECT_ID_LEN  # cx- + this fits exactly in 64
    long_id = "o" * (pg.MAX_DERIVED_OBJECT_ID_LEN + 1)  # one over: cx-<long_id> would be 65 characters
    d = _doc()
    d["objects"] = [OBJ(ok_id, item="tribune.stepped", pos=(0.25, 0.6), rotation_deg=180, size={"w_m": 4, "d_m": 3, "h_m": 1.2},
                        params={"rows": 4, "step_height_m": 0.3, "step_width_m": 1.0, "connects_levels": "L1"}),
                    OBJ(long_id, item="tribune.stepped", pos=(0.25, 0.6), rotation_deg=180, size={"w_m": 4, "d_m": 3, "h_m": 1.2},
                        params={"rows": 4, "step_height_m": 0.3, "step_width_m": 1.0, "connects_levels": "L1"})]
    items = cat.builtin()["items"]
    n = pg.normalize(d, items)
    assert [c["id"] for c in n["connectors"]] == ["cx-" + ok_id], "the long id cannot fit cx-<id> within 64 characters, so nothing is derived for it"
    codes = _codes(d)
    assert ("id_too_long_for_connector", long_id) in codes and not any(c[0] == "id_too_long_for_connector" and c[1] == ok_id for c in codes)
    assert not any(i["structural"] for i in pg.validate(d)), "still just geometric: a 64-char id is a valid save, only the derived connector is unavailable"


def test_manual_connector_with_object_id_is_not_dropped_as_derived():
    d = _doc()
    d["objects"] = [OBJ("o1")]
    d["connectors"] = [CONN("c1", source="manual", object_id="o1"), CONN("cx-fake", source="manual")]
    items = cat.builtin()["items"]
    n = pg.normalize(d, items)
    assert {c["id"] for c in n["connectors"]} == {"c1", "cx-fake"}, "only source=auto with a cx- id is treated as normalize's own output"


def test_unknown_connects_levels_target_reports_on_the_object_not_the_connector():
    d = _doc()
    d["objects"] = [OBJ("t1", item="tribune.stepped", pos=(0.25, 0.6), rotation_deg=180, size={"w_m": 4, "d_m": 3, "h_m": 1.2},
                        params={"rows": 4, "step_height_m": 0.3, "step_width_m": 1.0, "connects_levels": "L9"})]
    items = cat.builtin()["items"]
    n = pg.normalize(d, items)
    assert [c["id"] for c in n["connectors"]] == ["cx-t1"], "normalize does not know which levels are real; it still derives"
    codes = {(i["code"], i["id"]) for i in pg.validate(n, items) if not i["structural"]}
    assert ("unknown_level", "t1") in codes and not any(c[1] == "cx-t1" for c in codes), "the object is where the user fixes it, not the derived connector"


def test_normalize_requires_integer_dimensions_like_validate():
    d = _doc()
    d["dimensions"]["width_px"] = 1000.0  # a float is not a usable pixel count, exactly like validate()'s own dimensions rule
    d["objects"] = [OBJ("t1", item="tribune.stepped", pos=(0.25, 0.6), rotation_deg=180, size={"w_m": 4, "d_m": 3, "h_m": 1.2},
                        params={"rows": 4, "step_height_m": 0.3, "step_width_m": 1.0, "connects_levels": "L1"})]
    items = cat.builtin()["items"]
    assert pg.normalize(d, items)["connectors"] == [], "float dimensions never derive a connector"


def test_derived_connector_disappears_when_its_object_is_deleted():
    d = _doc()
    d["objects"] = [OBJ("t1", item="tribune.stepped", pos=(0.25, 0.6), rotation_deg=180, size={"w_m": 4, "d_m": 3, "h_m": 1.2},
                        params={"rows": 4, "step_height_m": 0.3, "step_width_m": 1.0, "connects_levels": "L1"})]
    items = cat.builtin()["items"]
    n = pg.normalize(d, items)
    assert [c["id"] for c in n["connectors"]] == ["cx-t1"]
    gone = copy.deepcopy(n)
    gone["objects"] = []
    assert pg.normalize(gone, items)["connectors"] == [], "the object is gone; its derived connector goes with it"


def test_object_and_connector_size_upper_bound():
    d = _doc()
    d["objects"] = [OBJ("o1", size={"w_m": 100, "d_m": 100, "h_m": 100}), OBJ("o2", size={"w_m": 100.01, "d_m": 1, "h_m": 1})]
    d["connectors"] = [CONN("c1", width_m=100), CONN("c2", width_m=100.01)]
    codes = _codes(d)
    assert not any(c[1] == "o1" for c in codes) and ("size", "o2") in codes
    assert not any(c[1] == "c1" for c in codes) and ("size", "c2") in codes


def test_connects_levels_equal_to_own_level_derives_nothing():
    d = _doc()
    d["objects"] = [OBJ("t1", item="tribune.stepped", pos=(0.25, 0.6), rotation_deg=180, size={"w_m": 4, "d_m": 3, "h_m": 1.2},
                        params={"rows": 4, "step_height_m": 0.3, "step_width_m": 1.0, "connects_levels": "L0"})]
    items = cat.builtin()["items"]
    assert pg.normalize(d, items)["connectors"] == [], "a level cannot connect to itself"
