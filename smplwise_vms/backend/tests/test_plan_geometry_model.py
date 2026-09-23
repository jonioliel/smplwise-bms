"""Plan Studio document v2 (T084): a new document carries the version's source, size and calibration and one default
level; the validator separates structural problems (a save is refused) from geometric ones (kept with the draft,
block publishing); the published JSON schema and the validator agree on the enums."""
from __future__ import annotations

import copy
import json
import pathlib

import pytest

from smplwise.services import plan_geometry as pg

SCHEMA = pathlib.Path(__file__).resolve().parents[3] / "contracts" / "schemas" / "plan_geometry.v2.schema.json"
VERSION = {"id": "v1", "floor_id": "f1", "asset_id": "a1", "page": 1, "rotation": 0, "crop_json": None, "width_px": 1000, "height_px": 500,
           "scale_m_per_px": 0.02, "calibration_json": None}
ASSET = {"sha256": "b" * 64, "original_name": "plan.pdf", "mime": "application/pdf"}


def _doc() -> dict:
    d = pg.new_document(VERSION, ASSET)
    d["walls"] = [
        {"id": "w1", "level_id": "L0", "polyline": [[0.1, 0.2], [0.5, 0.2]], "thickness_m": 0.2, "height_m": None, "base_z_m": 0, "kind": "exterior",
         "confidence": 1, "source": "manual", "locked": False, "external_ids": {}},
        {"id": "w2", "level_id": "L0", "polyline": [[0.5, 0.2], [0.5, 0.8]], "thickness_m": 0.15, "height_m": 3.0, "base_z_m": 0, "kind": "interior",
         "confidence": 1, "source": "manual", "locked": False, "external_ids": {}},
    ]
    d["openings"] = [{"id": "o1", "wall_id": "w1", "t": 0.5, "kind": "door", "width_m": 0.9, "height_m": 2.1, "sill_m": 0, "swing": "right", "hinge": "start",
                      "anchor_ref": None, "confidence": 1, "source": "manual", "external_ids": {}}]
    d["labels"] = [{"id": "t1", "text": "מחסן", "position": [0.3, 0.4], "level_id": "L0", "size": 14}]
    return d


def _codes(doc) -> set[tuple[str, str | None]]:
    return {(i["code"], i["id"]) for i in pg.validate(doc)}


def test_new_document_takes_the_version_and_validates():
    d = pg.new_document(VERSION, ASSET)
    assert d["schema_version"] == "2.0" and d["plan_version_id"] == "v1" and d["floor_id"] == "f1"
    assert d["dimensions"] == {"width_px": 1000, "height_px": 500, "scale_m_per_px": 0.02,
                               "calibration": {"status": "measured", "method": "manual", "pairs": [], "residual_pct": None, "reason": None}}
    assert [lv["id"] for lv in d["levels"]] == ["L0"] and d["levels"][0]["is_default"] is True
    assert all(d[c] == [] for c in pg.COLLECTIONS if c != "levels")
    assert pg.validate(d) == [] and pg.validate(_doc()) == []
    missing = pg.new_document(dict(VERSION, scale_m_per_px=None), ASSET)
    assert missing["dimensions"]["calibration"]["status"] == "missing" and pg.validate(missing) == []


def test_calibration_record_and_rebase_come_from_the_version():
    rec = {"method": "two_point", "pairs": [{"a": [0.1, 0.1], "b": [0.6, 0.1], "metres": 10}], "residual_pct": 0.0}
    d = pg.new_document(dict(VERSION, calibration_json=json.dumps(rec)), ASSET)
    assert d["dimensions"]["calibration"]["method"] == "two_point" and d["dimensions"]["calibration"]["pairs"] == rec["pairs"]
    tampered = _doc()
    tampered["plan_version_id"] = "other"
    tampered["dimensions"]["scale_m_per_px"] = 99
    back = pg.rebase(tampered, VERSION, ASSET)
    assert back["plan_version_id"] == "v1" and back["dimensions"]["scale_m_per_px"] == 0.02 and back["walls"] == tampered["walls"]


def test_structural_problems_are_flagged_as_structural():
    assert [i["code"] for i in pg.validate([])] == ["type"]
    d = _doc()
    d["walls"] = "nope"
    issues = pg.validate(d)
    assert issues and all(i["structural"] for i in issues) and issues[0]["path"] == "walls"
    d = _doc()
    d["openings"].append({"wall_id": "w1"})
    assert any(i["structural"] and i["path"] == "openings[1]" for i in pg.validate(d))
    d = _doc()
    d["schema_version"] = "1.0"
    assert any(i["code"] == "schema_version" and i["structural"] for i in pg.validate(d))
    d = _doc()
    d["labels"] = [dict(d["labels"][0], id=f"t{i}") for i in range(pg.LIMITS["labels"] + 1)]
    assert any(i["code"] == "limit" for i in pg.validate(d))


def test_geometric_problems_name_the_item():
    d = _doc()
    d["walls"][0]["polyline"][1] = [1.3, 0.2]
    assert ("bounds", "w1") in _codes(d)
    d = _doc()
    d["walls"][1]["level_id"] = "L9"
    assert ("unknown_level", "w2") in _codes(d)
    d = _doc()
    d["openings"][0]["wall_id"] = "w9"
    assert ("unknown_wall", "o1") in _codes(d)
    d = _doc()
    d["openings"][0]["t"] = 0.99  # w1 is 0.4 x 1000 px x 0.02 = 8 m; a 0.9 m door centred at 7.92 m sticks out
    assert ("opening_outside_wall", "o1") in _codes(d)
    d = _doc()
    d["labels"][0]["id"] = "w1"
    assert ("duplicate_id", "w1") in _codes(d)
    d = _doc()
    d["walls"][0]["thickness_m"] = 0
    assert ("thickness", "w1") in _codes(d)
    d = _doc()
    d["walls"][0]["polyline"] = [[0.2, 0.2], [0.2, 0.2]]
    assert ("too_short", "w1") in _codes(d)
    d = _doc()
    d["levels"].append(dict(d["levels"][0], id="L1", is_default=True))
    codes = _codes(d)
    assert ("levels", None) in codes and ("duplicate_elevation", "L1") in codes
    d = _doc()
    d["openings"].append(dict(d["openings"][0], id="o2", t=0.52))
    issues = pg.validate(d)
    assert [i["severity"] for i in issues if i["code"] == "overlap"] == ["warning"]
    assert not any(i["severity"] == "error" for i in issues) and not any(i["structural"] for i in issues)


def test_scale_is_measured_or_estimated():
    d = pg.new_document(dict(VERSION, scale_m_per_px=None), ASSET)
    scale, estimated = pg.effective_scale(d)
    assert estimated and scale == pytest.approx(0.2 / (0.006 * 1000))
    assert pg.effective_scale(_doc()) == (0.02, False)


def test_two_point_scale_mean_and_residual():
    s, r = pg.two_point_scale([([0.1, 0.1], [0.6, 0.1], 10.0)], 1000, 500)
    assert s == pytest.approx(0.02) and r == 0.0
    s, r = pg.two_point_scale([([0.1, 0.1], [0.6, 0.1], 10.0), ([0.1, 0.1], [0.1, 0.5], 4.4)], 1000, 500)
    assert s == pytest.approx((0.02 * 500 + 0.022 * 200) / 700) and r > 3
    with pytest.raises(ValueError):
        pg.two_point_scale([([0.1, 0.1], [0.101, 0.1], 1.0)], 1000, 500)


def test_schema_file_matches_the_validator():
    schema = json.loads(SCHEMA.read_text(encoding="utf-8"))
    assert schema["properties"]["schema_version"] == {"const": pg.SCHEMA_VERSION}
    defs = schema["$defs"]
    assert set(defs["wall"]["properties"]["kind"]["enum"]) == set(pg.WALL_KINDS)
    assert set(defs["opening"]["properties"]["kind"]["enum"]) == set(pg.OPENING_KINDS)
    assert set(defs["opening"]["properties"]["swing"]["enum"]) == set(pg.SWINGS)
    assert set(defs["calibration"]["properties"]["status"]["enum"]) == set(pg.CAL_STATUSES)
    assert set(schema["required"]) >= {"schema_version", "source", "dimensions", "transform", *pg.COLLECTIONS, "uncertainty"}
    assert copy.deepcopy(_doc())["schema_version"] == schema["properties"]["schema_version"]["const"]


def test_malformed_field_values_are_structural_not_crashes():
    def check(d, field_hint):
        issues = pg.validate(d)  # must return, never raise, even for client-controlled junk that passed the id check
        assert issues and all(i["structural"] for i in issues)
        assert any(i["code"] == "type" and field_hint in i["path"] for i in issues)

    d = _doc()
    d["walls"][0]["level_id"] = []
    check(d, "level_id")
    d = _doc()
    d["labels"][0]["level_id"] = {}
    check(d, "level_id")
    d = _doc()
    d["rooms"].append({"id": "r1", "level_id": ["L0"]})
    check(d, "level_id")
    d = _doc()
    d["openings"][0]["wall_id"] = ["w1"]
    check(d, "wall_id")
    d = _doc()
    d["walls"][0]["thickness_m"] = 10**400
    check(d, "thickness_m")
    d = _doc()
    d["walls"][0]["thickness_m"] = "abc"
    check(d, "thickness_m")
    d = _doc()
    d["walls"][0]["polyline"] = "nope"
    check(d, "polyline")
    d = _doc()
    d["dimensions"]["calibration"] = "x"
    check(d, "calibration")
    d = _doc()
    d["walls"][0]["thickness_m"] = float("nan")
    check(d, "thickness_m")


def test_an_over_limit_collection_yields_one_issue():
    d = _doc()
    d["walls"] = [0] * (pg.LIMITS["walls"] + 1)
    issues = pg.validate(d)
    assert len(issues) == 1
    assert issues[0]["code"] == "limit" and issues[0]["path"] == "walls" and issues[0]["structural"] is True


def test_warnings_never_hide_errors():
    d = _doc()
    d["walls"] = [{"id": "w1", "level_id": "L0", "polyline": [[0.1, 0.2], [0.5, 0.2]], "thickness_m": 0.2, "height_m": None, "base_z_m": 0,
                   "kind": "exterior", "confidence": 1, "source": "manual", "locked": False, "external_ids": {}}]
    d["openings"] = [{"id": f"o{i}", "wall_id": "w1", "t": 0.5, "kind": "door", "width_m": 0.1, "height_m": 2.1, "sill_m": 0, "swing": "right",
                      "hinge": "start", "anchor_ref": None, "confidence": 1, "source": "manual", "external_ids": {}} for i in range(501)]
    d["labels"] = [{"id": "t1", "text": "x", "position": [0.3, 0.4], "level_id": "L9", "size": 14}]
    issues = pg.validate(d)
    errors = {(i["code"], i["id"]) for i in issues if i["severity"] == "error"}
    assert ("unknown_level", "t1") in errors
    assert sum(1 for i in issues if i["severity"] == "warning") == pg.MAX_WARNINGS


def test_deep_nesting_is_refused_not_a_crash():
    nested: list = []
    for _ in range(1500):
        nested = [nested]
    d = _doc()
    d["meta"] = {"x": nested}
    issues = pg.validate(d)
    assert issues and all(i["structural"] for i in issues)
    assert any(i["code"] == "type" for i in issues)


def test_nan_in_an_untyped_field_is_structural():
    d = _doc()
    d["objects"] = [{"id": "ob1", "v": float("nan")}]
    issues = pg.validate(d)
    assert len(issues) == 1
    assert issues[0]["structural"] is True and issues[0]["code"] == "type" and issues[0]["path"] == "objects[0].v"
    d = _doc()
    d["walls"][0]["thickness_m"] = float("nan")
    issues = pg.validate(d)
    assert len([i for i in issues if i["path"] == "walls[0].thickness_m"]) == 1


def test_huge_dimensions_are_structural():
    d = _doc()
    d["dimensions"]["width_px"] = 10**400
    issues = pg.validate(d)
    assert any(i["code"] == "dimensions" and i["structural"] for i in issues)


def test_dimension_bounds_edges():
    d = _doc()
    d["dimensions"]["width_px"] = 100000
    assert not any(i["code"] == "dimensions" for i in pg.validate(d))
    d = _doc()
    d["dimensions"]["width_px"] = 100001
    issues = pg.validate(d)
    assert any(i["code"] == "dimensions" and i["structural"] for i in issues)
    d = _doc()
    d["dimensions"]["height_px"] = 10**400
    issues = pg.validate(d)
    assert any(i["code"] == "dimensions" and i["structural"] for i in issues)


def test_the_walk_reports_the_first_problem():
    d = _doc()
    d["objects"] = [{"id": "ob1", "v": float("nan")}, {"id": "ob2", "w": float("nan")}]
    issues = pg.validate(d)
    assert len(issues) == 1
    assert issues[0]["path"] == "objects[0].v"


def test_diff_names_added_removed_and_changed_items():
    a = _doc()
    b = copy.deepcopy(a)
    b["walls"][0]["thickness_m"] = 0.3
    b["walls"].pop(1)
    b["labels"].append({"id": "t2", "text": "x", "position": [0.1, 0.1], "level_id": "L0", "size": 12})
    d = pg.diff(a, b)
    assert d["collections"]["walls"] == {"added": [], "removed": ["w2"], "changed": ["w1"]}
    assert d["collections"]["labels"] == {"added": ["t2"], "removed": [], "changed": []}
    assert d["total"] == 3 and d["same"] is False and d["calibration_changed"] is False
    assert pg.diff(a, copy.deepcopy(a))["same"] is True
    first = pg.diff(None, a)
    assert first["collections"]["walls"]["added"] == ["w1", "w2"] and first["calibration_changed"] is False
    c = copy.deepcopy(a)
    c["dimensions"]["scale_m_per_px"] = 0.03
    assert pg.diff(a, c)["calibration_changed"] is True
    c2 = copy.deepcopy(a)
    c2["dimensions"]["scale_m_per_px"] = 0.03
    c3 = copy.deepcopy(a)
    c3["dimensions"]["scale_m_per_px"] = 0.03 + 1e-10  # same at canonical_json's 6-digit rounding: not a real change
    noise = pg.diff(c2, c3)
    assert noise["calibration_changed"] is False and noise["same"] is True
    c4 = copy.deepcopy(a)
    c4["dimensions"]["calibration"]["method"] = "two_point"  # _doc()'s method is already "manual"; pick a value that differs
    assert pg.diff(a, c4)["calibration_changed"] is True


def test_transform_crop_maps_points_through_both_crops():
    d = _doc()
    d["walls"].append({"id": "w3", "level_id": "L0", "polyline": [[0.6, 0.2], [0.9, 0.3]], "thickness_m": 0.2, "height_m": None,
                       "base_z_m": 0, "kind": "interior", "confidence": 1, "source": "manual", "locked": False, "external_ids": {}})
    out = pg.transform_crop(d, None, {"x": 0.0, "y": 0.0, "w": 0.5, "h": 1.0})
    assert out["walls"][0]["polyline"] == [[0.2, 0.2], [1.0, 0.2]]
    assert out["labels"][0]["position"] == [0.6, 0.4]
    assert out["walls"][2]["polyline"] == [[1.0, 0.2], [1.0, 0.3]], "points past the new crop's edge are clamped to it"
    assert d["walls"][0]["polyline"] == [[0.1, 0.2], [0.5, 0.2]], "the input is not modified"
    assert any("חיתוך" in n for n in out["uncertainty"]["notes"])


def test_counts():
    assert pg.counts(_doc()) == {"walls": 2, "openings": 1, "labels": 1, "objects": 0}


def test_diff_and_transform_crop_tolerate_malformed_data():
    a = _doc()
    b = dict(_doc(), walls=None)
    d = pg.diff(a, b)
    assert d["collections"]["walls"]["removed"] == ["w1", "w2"]

    m = _doc()
    m["walls"][0]["polyline"] = None
    m["walls"][1]["polyline"] = [[0.1, 0.1], "x", [0.2, 0.2]]
    del m["labels"][0]["position"]
    out = pg.transform_crop(m, None, {"x": 0.0, "y": 0.0, "w": 0.5, "h": 1.0})
    assert out["walls"][0]["polyline"] is None
    assert out["walls"][1]["polyline"] == [[0.2, 0.1], "x", [0.4, 0.2]]
    assert out["labels"][0] == m["labels"][0]


def test_malformed_uncertainty_is_structural():
    """A stored draft with a malformed uncertainty block made copy_from / transform_crop raise, so its shape is structural
    (the save is refused); only the 0..1 range of overall stays geometric (kept with the draft, blocks publishing)."""
    cases = [("x", "uncertainty"), (None, "uncertainty"), ({"overall": 0.5, "notes": None}, "uncertainty.notes"),
             ({"overall": 0.5, "notes": ["ok", 3]}, "uncertainty.notes"), ({"overall": "a", "notes": []}, "uncertainty.overall"),
             ({"overall": True, "notes": []}, "uncertainty.overall")]
    for unc, path in cases:
        d = _doc()
        d["uncertainty"] = unc
        issues = pg.validate(d)  # returns, never raises
        assert [(i["code"], i["structural"], i["path"]) for i in issues] == [("type", True, path)], unc
    d = _doc()
    del d["uncertainty"]
    assert [(i["code"], i["structural"], i["path"]) for i in pg.validate(d)] == [("type", True, "uncertainty")]
    d = _doc()
    d["uncertainty"] = {"overall": 1.5, "notes": []}
    assert [(i["code"], i["structural"]) for i in pg.validate(d)] == [("uncertainty", False)], "the 0..1 range stays geometric"
