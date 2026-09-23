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
