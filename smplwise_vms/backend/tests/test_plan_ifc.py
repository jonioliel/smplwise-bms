"""Plan Studio 8 (T090, CR-037): the IFC4 export and the IFC import.

Export: the written file is read back with our own bounded STEP reader; every reference resolves, every storey is
aggregated into the building, elements are contained in their storey, Hebrew survives, two exports are byte-identical
and the GlobalIds are stable (and taken from external_ids.ifc_guid when an item came from an IFC). Round trip: the
sample document (two levels, every opening kind, objects, a curved wall, a glass wall) exported and read back restores
the candidates. Foreign file: a hand-written IFC2X3 in millimetres (rectangle-profile wall without Axis, material
layers, Pset_WallCommon, a door through an opening, a space, a rotated chair) maps best effort with a report. Hostile
files: not STEP, compressed, NUL, unterminated, deep nesting, too many instances, cyclic placement, absurd numbers,
unknown schema, a storey out of range, the deadline. Routes: calibration required, permissions, audit, the accept."""
from __future__ import annotations

import json
import math
import pathlib
import sqlite3
import time
import uuid

import pytest
from conftest import as_user, bind, png_bytes, seed_tree
from fastapi.testclient import TestClient

from smplwise.main import create_app
from smplwise.services import plan_catalog, plan_ifc, plan_ifc_read

FIX = pathlib.Path(__file__).resolve().parents[3] / "contracts" / "fixtures" / "plan_geometry"
ZONES = [{"id": "z1", "name": "מחסן", "kind": "room", "polygon": [{"x": 0.1, "y": 0.1}, {"x": 0.6, "y": 0.1}, {"x": 0.6, "y": 0.5}, {"x": 0.1, "y": 0.5}]}]
ANCHORS = [{"resource_type": "camera", "resource_id": "cam1", "name": "כניסה ראשית", "x": 0.5, "y": 0.5, "rotation_degrees": 90},
           {"resource_type": "ha_entity", "resource_id": "light.hall", "name": "תאורת מבואה", "x": 0.2, "y": 0.7, "rotation_degrees": 0}]
PLAN = dict(width_px=1000, height_px=800, scale_m_per_px=0.01, scale_status="measured")


def _sample() -> dict:
    doc = json.loads((FIX / "sample-v2.json").read_text(encoding="utf-8"))
    # a curved wall and a glass wall on L0 (document 2.1), with a door on the curve
    doc["walls"].append({"id": "wk", "level_id": "L0", "polyline": [[0.2, 0.9], [0.5, 0.9]], "bulges": [0.3], "thickness_m": 0.2, "height_m": None, "base_z_m": 0,
                         "kind": "interior", "confidence": 1, "source": "manual", "locked": False, "external_ids": {}})
    doc["walls"].append({"id": "wg", "level_id": "L0", "polyline": [[0.7, 0.8], [0.95, 0.8]], "thickness_m": 0.08, "height_m": 2.6, "base_z_m": 0.1,
                         "kind": "glass", "confidence": 1, "source": "manual", "locked": False, "external_ids": {}})
    doc["openings"].append({"id": "ok", "wall_id": "wk", "t": 0.4, "kind": "door", "width_m": 0.9, "height_m": 2.1, "sill_m": 0, "swing": "left", "hinge": "end",
                            "anchor_ref": None, "confidence": 1, "source": "manual", "external_ids": {}})
    doc["schema_version"] = "2.1"
    return doc


def _export(doc: dict, **kw) -> bytes:
    args = dict(floor_id="F1", floor_name="קומה 2", version_id="V1", stage="draft", anchors=ANCHORS)
    args.update(kw)
    return plan_ifc.build(doc, ZONES, 1000, 800, **args)[0]


def _read(data: bytes, level_id: str = "L0", elevation: float = 0.0, **kw) -> dict:
    args = {**PLAN, "level_id": level_id, "level_elevation_m": elevation, "run_id": "t1", "catalog": plan_catalog.builtin()["items"]}
    args.update(kw)
    return plan_ifc_read.read(data, **args)


def _ifc(lines: list[str], schema: str = "IFC4") -> bytes:
    head = ["ISO-10303-21;", "HEADER;", "FILE_DESCRIPTION(('test'),'2;1');", "FILE_NAME('t.ifc','2026-10-13T00:00:00',(''),(''),'','','');", f"FILE_SCHEMA(('{schema}'));", "ENDSEC;", "DATA;"]
    return "\n".join(head + lines + ["ENDSEC;", "END-ISO-10303-21;"]).encode("utf-8")


def _g(n: int) -> str:
    return plan_ifc.compress_guid(uuid.uuid5(plan_ifc.NAMESPACE, f"test:{n}"))


# ---------------------------------------------------------------- encoding

def test_global_id_encoding_round_trips_and_is_stable():
    for u in (uuid.UUID(int=0), uuid.UUID(int=2**128 - 1), uuid.uuid5(plan_ifc.NAMESPACE, "x")):
        g = plan_ifc.compress_guid(u)
        assert len(g) == 22 and plan_ifc.expand_guid(g) == u
    assert plan_ifc.expand_guid("not a guid") is None and plan_ifc.expand_guid("z" * 22) is None
    assert plan_ifc.global_id("F1", "walls", {"id": "w1"}) == plan_ifc.global_id("F1", "walls", {"id": "w1"})
    assert plan_ifc.global_id("F1", "walls", {"id": "w1"}) != plan_ifc.global_id("F2", "walls", {"id": "w1"})
    kept = plan_ifc.compress_guid(uuid.uuid4())
    assert plan_ifc.global_id("F1", "walls", {"id": "w1", "external_ids": {"ifc_guid": kept}}) == kept, "an item from an IFC keeps its id"
    assert plan_ifc.global_id("F1", "walls", {"id": "w1", "external_ids": {"ifc_guid": "bogus"}}) != "bogus"


def test_step_strings_carry_hebrew_and_decode_back():
    s = "מבואה 'ראשית' \\ a‏b\x01"
    enc = plan_ifc.step_string(plan_ifc.clean_text(s))
    assert enc.startswith("'\\X2\\") and "''" in enc and "\\\\" in enc and "‏" not in enc
    assert plan_ifc_read.decode_string(enc[1:-1]) == "מבואה 'ראשית' \\ ab"
    assert plan_ifc_read.decode_string("\\X4\\0001F600\\X0\\") == "\U0001F600"
    assert plan_ifc_read.decode_string("a\\X\\E9b\\S\\!c") == "a\xe9b\xa1c"
    assert plan_ifc.fmt_real(1.0) == "1.0" and plan_ifc.fmt_real(-0.0) == "0.0" and plan_ifc.fmt_real(0.1234567) == "0.123457" and plan_ifc.fmt_real(1e-5) == "0.00001"
    with pytest.raises(ValueError):
        plan_ifc.fmt_real(float("nan"))


# ---------------------------------------------------------------- the written file

def test_export_structure_references_resolve_and_storeys_hold_their_elements():
    doc = _sample()
    data, counts = plan_ifc.build(doc, ZONES, 1000, 800, floor_id="F1", floor_name="קומה 2", version_id="V1", stage="published", anchors=ANCHORS)
    assert counts == {"levels": 2, "walls": 6, "openings": 7, "rooms": 1, "objects": 5, "connectors": 2, "anchors": 2}
    text = data.decode("utf-8")
    assert text.startswith("ISO-10303-21;\nHEADER;") and "FILE_SCHEMA(('IFC4'));" in text and text.rstrip().endswith("END-ISO-10303-21;")
    assert "\\X2\\" in text and "קומה" not in text, "Hebrew is STEP-encoded"
    m = plan_ifc_read.Model(text)
    ids = set(m.spans)
    import re
    for n in map(int, re.findall(r"#(\d+)", text.split("DATA;", 1)[1])):
        assert n in ids, f"dangling reference #{n}"
    assert len(m.of("IFCPROJECT")) == 1 and len(m.of("IFCSITE")) == 1 and len(m.of("IFCBUILDING")) == 1
    assert len(m.of("IFCBUILDINGSTOREY")) == 2 and len(m.of("IFCWALL")) == 6 and len(m.of("IFCOPENINGELEMENT")) == 7
    assert len(m.of("IFCDOOR")) == 5 and len(m.of("IFCWINDOW")) == 1 and len(m.of("IFCRELFILLSELEMENT")) == 6 and len(m.of("IFCRELVOIDSELEMENT")) == 7
    assert len(m.of("IFCSPACE")) == 1 and len(m.of("IFCAUDIOVISUALAPPLIANCE")) == 1 and len(m.of("IFCBUILDINGELEMENTPROXY")) == 1
    assert {m.type_of(i) for i in m.of("IFCSTAIR", "IFCTRANSPORTELEMENT")} and len(m.of("IFCSTAIR", "IFCRAMP", "IFCTRANSPORTELEMENT")) == 3, "2 connectors + the tribune object"
    # every storey is aggregated into the building; every element is contained in exactly one storey
    storeys = set(m.of("IFCBUILDINGSTOREY"))
    agg = [m.args(i) for i in m.of("IFCRELAGGREGATES")]
    building = m.of("IFCBUILDING")[0]
    assert {r.n for a in agg if a[4].n == building for r in a[5]} == storeys
    contained: dict[int, int] = {}
    for i in m.of("IFCRELCONTAINEDINSPATIALSTRUCTURE"):
        a = m.args(i)
        assert a[5].n in storeys
        for r in a[4]:
            assert r.n not in contained
            contained[r.n] = a[5].n
    elements = set(m.of("IFCWALL", "IFCDOOR", "IFCWINDOW", "IFCFURNITURE", "IFCLIGHTFIXTURE", "IFCFIRESUPPRESSIONTERMINAL", "IFCSTAIR", "IFCTRANSPORTELEMENT", "IFCAUDIOVISUALAPPLIANCE", "IFCBUILDINGELEMENTPROXY"))
    assert elements <= set(contained), elements - set(contained)
    # the units are metres and the project carries the plan's identity
    units = [m.args(i) for i in m.of("IFCSIUNIT")]
    assert any(u[1].v == "LENGTHUNIT" and u[2] is None and u[3].v == "METRE" for u in units)
    psets = plan_ifc_read._psets(m)
    project = psets[m.of("IFCPROJECT")[0]][plan_ifc.PSET]
    assert project["PlanVersionId"] == "V1" and project["Stage"] == "published" and project["ScaleStatus"] == "measured"
    storey_names = {plan_ifc_read.text(m.args(i)[2]) for i in storeys}
    assert storey_names == {lv["name"] for lv in doc["levels"]}, "Hebrew level names read back"
    cam = psets[m.of("IFCAUDIOVISUALAPPLIANCE")[0]][plan_ifc.PSET]
    assert cam["ResourceType"] == "camera" and cam["ResourceId"] == "cam1" and cam["Heading"] == 90.0


def test_export_is_deterministic_and_a_level_filter_writes_that_storey_only():
    doc = _sample()
    a = _export(doc)
    b = _export(json.loads(json.dumps(doc)))
    assert a == b
    assert _export(doc, generated_at="2026-10-13T10:00:00Z") != a and _export(doc, generated_at="2026-10-13T10:00:00Z").replace(b"2026-10-13T10:00:00Z", b"1970-01-01T00:00:00Z") == a
    one = plan_ifc_read.Model(_export(doc, level="L1").decode())
    assert len(one.of("IFCBUILDINGSTOREY")) == 1 and len(one.of("IFCWALL")) == 1
    # the GlobalId of a wall is the same in both files (identity across exports)
    full = plan_ifc_read.Model(a.decode())
    wd = {plan_ifc_read.text(full.args(i)[0]) for i in full.of("IFCWALL") if plan_ifc_read.text(full.args(i)[2]) == "wd"}
    assert wd == {plan_ifc_read.text(one.args(i)[0]) for i in one.of("IFCWALL")}


def test_export_without_anchors_or_items_still_writes_every_wall():
    doc = _sample()
    data, counts = plan_ifc.build(doc, [], 1000, 800, floor_id="F1", floor_name="", version_id="V1", stage="draft", anchors=None, items={})
    assert counts["walls"] == 6 and counts["rooms"] == 0 and counts["anchors"] == 0 and counts["objects"] == 5
    m = plan_ifc_read.Model(data.decode())
    assert len(m.of("IFCFURNITURE")) == 5, "an object without a catalog item is the default furniture class"


# ---------------------------------------------------------------- round trip

def _by_tag(items: list[dict], key: str) -> dict:
    return {i["external_ids"].get("ifc_guid"): i for i in items}


def test_round_trip_restores_walls_openings_objects_and_rooms():
    doc = _sample()
    data = _export(doc)
    items = plan_catalog.builtin()["items"]
    walls0 = {w["id"]: w for w in doc["walls"]}
    guid = {w["id"]: plan_ifc.global_id("F1", "walls", w) for w in doc["walls"]}
    for lid, el in (("L0", 0.0), ("L1", -1.2)):
        r = _read(data, lid, el)
        rep = r["ifc"]
        assert rep["schema"] == "IFC4" and rep["metres_per_unit"] == 1.0 and rep["alignment"] == {"dx_m": 0.0, "dy_m": 0.0, "fits": True, "needed_m": None, "plan_m": [10.0, 8.0]}
        assert [s["chosen"] for s in rep["storeys"]] == ([False, True] if lid == "L0" else [True, False])
        expected = [w for w in doc["walls"] if w["level_id"] == lid]
        assert rep["counts"]["walls"] == len(expected) and len(r["walls"]) == len(expected)
        got = {w["external_ids"]["ifc_guid"]: w for w in r["walls"]}
        for w in expected:
            g = got[guid[w["id"]]]
            assert all(math.isclose(a, b, abs_tol=1e-4) for p, q in zip(g["polyline"], w["polyline"]) for a, b in zip(p, q)), (w["id"], g["polyline"])
            assert g["thickness_m"] == w["thickness_m"] and g["kind"] == w["kind"] and g["height_m"] == w["height_m"] and g["base_z_m"] == w["base_z_m"]
            assert g["source"] == "imported" and g["level_id"] == lid and g["confidence"] == 0.9 and g["external_ids"]["ifc_class"] == "IFCWALL"
            if w.get("bulges"):
                assert g["bulges"] == w["bulges"]
            else:
                assert "bulges" not in g
        ids_back = {g["external_ids"]["ifc_guid"]: g["id"] for g in r["walls"]}
        exp_open = [o for o in doc["openings"] if walls0[o["wall_id"]]["level_id"] == lid]
        assert len(r["openings"]) == len(exp_open)
        gopen = {o["external_ids"]["ifc_guid"]: o for o in r["openings"]}
        for o in exp_open:
            key = plan_ifc.global_id("F1", "fills" if o["kind"] != "passage" else "openings", {"id": o["id"]})
            g = gopen[key]
            assert g["wall_id"] == ids_back[guid[o["wall_id"]]] and g["t"] == o["t"] and g["kind"] == o["kind"]
            assert (g["width_m"], g["height_m"], g["sill_m"], g["swing"], g["hinge"]) == (o["width_m"], o["height_m"], o["sill_m"], o["swing"], o["hinge"])
            assert g["external_ids"]["ifc_class"] == {"door": "IFCDOOR", "window": "IFCWINDOW", "passage": "IFCOPENINGELEMENT"}[o["kind"]]
        exp_obj = [o for o in doc["objects"] if o["level_id"] == lid]
        assert len(r["objects"]) == len(exp_obj)
        gobj = {o["external_ids"]["ifc_guid"]: o for o in r["objects"]}
        for o in exp_obj:
            g = gobj[plan_ifc.global_id("F1", "objects", o)]
            assert g["item_id"] == o["item_id"] and g["position"] == o["position"] and g["rotation_deg"] == o["rotation_deg"] % 360 and g["size"] == o["size"] and g["z_m"] == o["z_m"]
            assert g["external_ids"]["ifc_class"] == items[o["item_id"]]["ifc"]["class"].upper()
        if lid == "L0":
            assert len(r["rooms"]) == 1 and r["rooms"][0]["name"] == "מחסן" and r["rooms"][0]["polygon"] == ZONES[0]["polygon"]
        else:
            assert r["rooms"] == []
        # the report says what did not come back and why
        by = rep["skipped_by_reason"]
        assert by.get("live_device") == 2 and by.get("connector_not_imported") == (2 if lid == "L0" else None), "the connectors sit on L0; on L1 they are another storey's"
        assert all(s["id"].startswith("#") and s["class"] and s["reason"] for s in rep["skipped"]) and rep["skipped_total"] == sum(by.values())
    # explicit storey choice: storey 0 is L1 (the lower one), whatever the target level says
    r = _read(data, "L0", 0.0, storey=0)
    assert [s["chosen"] for s in r["ifc"]["storeys"]] == [True, False] and len(r["walls"]) == 1
    with pytest.raises(plan_ifc_read.IfcError) as exc:
        _read(data, "L0", 0.0, storey=5)
    assert exc.value.code == "ifc_storey"


def test_re_export_of_imported_candidates_keeps_the_architects_global_ids():
    doc = _sample()
    data = _export(doc)
    r = _read(data)
    doc2 = {**doc, "walls": r["walls"], "openings": r["openings"], "objects": r["objects"], "connectors": [], "circuits": [], "groups": []}
    doc2["levels"] = [lv for lv in doc["levels"] if lv["id"] == "L0"]
    again = plan_ifc_read.Model(_export(doc2, floor_id="F-other").decode())
    guids = {plan_ifc_read.text(again.args(i)[0]) for i in again.of("IFCWALL")}
    assert guids == {w["external_ids"]["ifc_guid"] for w in r["walls"]}, "a wall that came from an IFC keeps that GlobalId on another floor"


# ---------------------------------------------------------------- a foreign file (IFC2X3, millimetres)

def _foreign(extra: list[str] | None = None, wall_placement: str = "#22", schema: str = "IFC2X3") -> bytes:
    lines = [
        "#1=IFCCARTESIANPOINT((0.,0.,0.));", "#2=IFCDIRECTION((0.,0.,1.));", "#3=IFCDIRECTION((1.,0.,0.));", "#4=IFCAXIS2PLACEMENT3D(#1,#2,#3);",
        "#5=IFCSIUNIT(*,.LENGTHUNIT.,.MILLI.,.METRE.);", "#6=IFCUNITASSIGNMENT((#5));", "#7=IFCGEOMETRICREPRESENTATIONCONTEXT($,'Model',3,1.E-05,#4,$);",
        f"#8=IFCPROJECT('{_g(1)}',$,'Foreign',$,$,$,$,(#7),#6);", "#9=IFCLOCALPLACEMENT($,#4);",
        f"#10=IFCSITE('{_g(2)}',$,'Site',$,$,#9,$,$,.ELEMENT.,$,$,$,$,$);", "#11=IFCLOCALPLACEMENT(#9,#4);",
        f"#12=IFCBUILDING('{_g(3)}',$,'B',$,$,#11,$,$,.ELEMENT.,$,$,$);", "#13=IFCLOCALPLACEMENT(#11,#4);",
        f"#14=IFCBUILDINGSTOREY('{_g(4)}',$,'Ground',$,$,#13,$,$,.ELEMENT.,0.);",
        f"#15=IFCRELAGGREGATES('{_g(5)}',$,$,$,#8,(#10));", f"#16=IFCRELAGGREGATES('{_g(6)}',$,$,$,#10,(#12));", f"#17=IFCRELAGGREGATES('{_g(7)}',$,$,$,#12,(#14));",
        # the wall: a rectangle profile 6000 x 200 centred 3000 mm along x, placed at (10000, 5000), no Axis, 200 mm material layer, external
        "#20=IFCCARTESIANPOINT((10000.,5000.,0.));", "#21=IFCAXIS2PLACEMENT3D(#20,#2,#3);", "#22=IFCLOCALPLACEMENT(#13,#21);",
        "#23=IFCCARTESIANPOINT((3000.,0.));", "#24=IFCAXIS2PLACEMENT2D(#23,$);", "#25=IFCRECTANGLEPROFILEDEF(.AREA.,$,#24,6000.,200.);",
        "#26=IFCEXTRUDEDAREASOLID(#25,#4,#2,2800.);", "#27=IFCSHAPEREPRESENTATION(#7,'Body','SweptSolid',(#26));", "#28=IFCPRODUCTDEFINITIONSHAPE($,$,(#27));",
        f"#29=IFCWALLSTANDARDCASE('{_g(8)}',$,'Wall-1',$,$,{wall_placement},#28,$);",
        "#30=IFCMATERIALLAYER($,200.,$);", "#31=IFCMATERIALLAYERSET((#30),'Block');", "#32=IFCMATERIALLAYERSETUSAGE(#31,.AXIS2.,.POSITIVE.,-100.);",
        f"#33=IFCRELASSOCIATESMATERIAL('{_g(9)}',$,$,$,(#29),#32);",
        "#34=IFCPROPERTYSINGLEVALUE('IsExternal',$,IFCBOOLEAN(.T.),$);", f"#35=IFCPROPERTYSET('{_g(10)}',$,'Pset_WallCommon',$,(#34));",
        f"#36=IFCRELDEFINESBYPROPERTIES('{_g(11)}',$,$,$,(#29),#35);",
        # the opening at 2000 mm along the wall, filled by a door (IFC2X3: OverallHeight / OverallWidth, no operation type)
        "#40=IFCCARTESIANPOINT((2000.,0.,0.));", "#41=IFCAXIS2PLACEMENT3D(#40,#2,#3);", "#42=IFCLOCALPLACEMENT(#22,#41);",
        "#44=IFCCARTESIANPOINT((0.,0.));", "#45=IFCAXIS2PLACEMENT2D(#44,$);", "#43=IFCRECTANGLEPROFILEDEF(.AREA.,$,#45,900.,300.);",
        "#46=IFCEXTRUDEDAREASOLID(#43,#4,#2,2100.);", "#47=IFCSHAPEREPRESENTATION(#7,'Body','SweptSolid',(#46));", "#48=IFCPRODUCTDEFINITIONSHAPE($,$,(#47));",
        f"#49=IFCOPENINGELEMENT('{_g(12)}',$,'Opening',$,$,#42,#48,$);", f"#50=IFCRELVOIDSELEMENT('{_g(13)}',$,$,$,#29,#49);",
        "#51=IFCLOCALPLACEMENT(#42,#4);", f"#52=IFCDOOR('{_g(14)}',$,'Door-1',$,$,#51,#48,$,2100.,900.);", f"#53=IFCRELFILLSELEMENT('{_g(15)}',$,$,$,#49,#52);",
        # a space 6 x 4 m
        "#60=IFCCARTESIANPOINT((10000.,5000.));", "#61=IFCCARTESIANPOINT((16000.,5000.));", "#62=IFCCARTESIANPOINT((16000.,9000.));", "#63=IFCCARTESIANPOINT((10000.,9000.));",
        "#64=IFCPOLYLINE((#60,#61,#62,#63,#60));", "#65=IFCARBITRARYCLOSEDPROFILEDEF(.AREA.,$,#64);", "#66=IFCEXTRUDEDAREASOLID(#65,#4,#2,2800.);",
        "#67=IFCSHAPEREPRESENTATION(#7,'Body','SweptSolid',(#66));", "#68=IFCPRODUCTDEFINITIONSHAPE($,$,(#67));", "#69=IFCLOCALPLACEMENT(#13,#4);",
        f"#70=IFCSPACE('{_g(16)}',$,'101',$,$,#69,#68,'Lobby',.ELEMENT.,.INTERNAL.,$);", f"#71=IFCRELAGGREGATES('{_g(17)}',$,$,$,#14,(#70));",
        # a chair turned 90 degrees counter-clockwise, 450 x 500 x 850
        "#80=IFCCARTESIANPOINT((11000.,7000.,0.));", "#81=IFCDIRECTION((0.,1.,0.));", "#82=IFCAXIS2PLACEMENT3D(#80,#2,#81);", "#83=IFCLOCALPLACEMENT(#13,#82);",
        "#84=IFCRECTANGLEPROFILEDEF(.AREA.,$,#45,450.,500.);", "#85=IFCEXTRUDEDAREASOLID(#84,#4,#2,850.);", "#86=IFCSHAPEREPRESENTATION(#7,'Body','SweptSolid',(#85));",
        "#87=IFCPRODUCTDEFINITIONSHAPE($,$,(#86));", f"#88=IFCFURNISHINGELEMENT('{_g(18)}',$,'Chair \\X2\\05DB05E105D0\\X0\\',$,$,#83,#87,$);",
        # a slab (not imported) and a stair (a connector: reported)
        f"#90=IFCSLAB('{_g(19)}',$,'Slab',$,$,#69,$,$,.FLOOR.);", f"#91=IFCSTAIR('{_g(20)}',$,'Stair',$,$,#69,$,$,.STRAIGHT_RUN_STAIR.);",
        f"#99=IFCRELCONTAINEDINSPATIALSTRUCTURE('{_g(21)}',$,$,$,(#29,#52,#88,#90,#91),#14);",
    ]
    return _ifc(lines + (extra or []), schema)


def test_foreign_ifc2x3_in_millimetres_maps_best_effort_with_a_report():
    r = _read(_foreign(), width_px=640, height_px=400)
    rep = r["ifc"]
    assert rep["schema"] == "IFC2X3" and rep["metres_per_unit"] == 0.001 and "schema_ifc2x3" in rep["warnings"]
    assert rep["alignment"] == {"dx_m": -10.0, "dy_m": -5.0, "fits": True, "needed_m": [6.0, 4.0], "plan_m": [6.4, 4.0]}, "a foreign origin is moved onto the plan"
    assert rep["counts"] == {"walls": 1, "openings": 1, "objects": 1, "rooms": 1}
    assert rep["skipped_by_reason"] == {"unsupported_class": 1, "connector_not_imported": 1}
    assert {(s["class"], s["name"]) for s in rep["skipped"]} == {("IFCSLAB", "Slab"), ("IFCSTAIR", "Stair")}
    w = r["walls"][0]
    assert w["polyline"] == [[0.0, 1.0], [0.9375, 1.0]] and w["thickness_m"] == 0.2 and w["kind"] == "exterior" and w["height_m"] == 2.8 and w["base_z_m"] == 0.0
    assert w["confidence"] == 0.75 and w["tags"] == ["Wall-1"] and w["external_ids"] == {"ifc_class": "IFCWALLSTANDARDCASE", "ifc_guid": _g(8)}
    o = r["openings"][0]
    assert o["wall_id"] == w["id"] and o["kind"] == "door" and math.isclose(o["t"], 1 / 3, abs_tol=1e-4) and o["width_m"] == 0.9 and o["height_m"] == 2.1
    assert o["sill_m"] == 0.0 and o["swing"] == "none" and o["hinge"] == "start" and o["confidence"] == 0.7
    room = r["rooms"][0]
    assert room["name"] == "Lobby" and room["polygon"] == [{"x": 0.0, "y": 1.0}, {"x": 0.9375, "y": 1.0}, {"x": 0.9375, "y": 0.0}, {"x": 0.0, "y": 0.0}]
    ob = r["objects"][0]
    assert ob["position"] == [0.15625, 0.5] and ob["rotation_deg"] == 270.0 and ob["size"] == {"w_m": 0.45, "d_m": 0.5, "h_m": 0.85} and ob["z_m"] == 0.0
    assert ob["label"] == "Chair כסא" and ob["confidence"] == 0.6
    assert plan_catalog.builtin()["items"][ob["item_id"]]["ifc"]["class"] == "IfcFurniture", "IFC2X3 furnishing element -> a furniture item"


def test_foreign_file_too_large_for_the_plan_reports_what_falls_outside():
    r = _read(_foreign(), width_px=300, height_px=400)  # 3 m x 4 m plan for a 6 m model
    rep = r["ifc"]
    assert rep["alignment"]["fits"] is False and rep["alignment"]["needed_m"] == [6.0, 4.0]
    assert rep["counts"]["walls"] == 0 and rep["skipped_by_reason"]["outside_plan"] >= 2  # the wall and the space (the chair at 1 m still fits)
    assert rep["counts"]["objects"] == 1 and rep["counts"]["openings"] == 0 and any(s["reason"] == "outside_plan" for s in rep["skipped"])


def test_ifc4_door_operation_and_pset_swing_read_back():
    lines = _foreign(schema="IFC4").decode().split("\n")
    text = "\n".join(lines).replace(f"#52=IFCDOOR('{_g(14)}',$,'Door-1',$,$,#51,#48,$,2100.,900.);",
                                    f"#52=IFCDOOR('{_g(14)}',$,'Door-1',$,$,#51,#48,$,2100.,900.,.DOOR.,.DOUBLE_DOOR_SINGLE_SWING.,$);")
    r = _read(text.encode(), width_px=640, height_px=400)
    assert r["openings"][0]["swing"] == "double" and r["ifc"]["warnings"] == []
    assert plan_ifc_read._swing_of("SINGLE_SWING_LEFT") == "left" and plan_ifc_read._swing_of("SLIDING_TO_RIGHT") == "sliding" and plan_ifc_read._swing_of("REVOLVING") == "none"


def test_a_file_without_a_length_unit_assumes_metres_and_says_so():
    data = _foreign().decode().replace("#5=IFCSIUNIT(*,.LENGTHUNIT.,.MILLI.,.METRE.);", "#5=IFCSIUNIT(*,.AREAUNIT.,$,.SQUARE_METRE.);").encode()
    r = _read(data, width_px=640, height_px=400)
    assert r["ifc"]["metres_per_unit"] == 1.0 and "no_length_unit" in r["ifc"]["warnings"]
    assert r["ifc"]["counts"]["walls"] == 0 and r["ifc"]["skipped_by_reason"]["outside_plan"] >= 1, "a 6000 m wall does not fit a 6.4 m plan"


def test_conversion_based_units_feet():
    data = _foreign().decode().replace("#5=IFCSIUNIT(*,.LENGTHUNIT.,.MILLI.,.METRE.);",
                                      "#5=IFCCONVERSIONBASEDUNIT(#100,.LENGTHUNIT.,'FOOT',#101);\n#100=IFCDIMENSIONALEXPONENTS(1,0,0,0,0,0,0);\n"
                                      "#101=IFCMEASUREWITHUNIT(IFCLENGTHMEASURE(0.3048),#102);\n#102=IFCSIUNIT(*,.LENGTHUNIT.,$,.METRE.);").encode()
    r = _read(data, width_px=640, height_px=400)
    assert math.isclose(r["ifc"]["metres_per_unit"], 0.3048)


# ---------------------------------------------------------------- hostile files

def test_hostile_files_are_refused_with_a_code_never_a_crash(monkeypatch):
    def code(data: bytes, **kw) -> str:
        with pytest.raises(plan_ifc_read.IfcError) as exc:
            _read(data, **kw)
        return exc.value.code

    assert code(b"\x89PNG\r\n\x1a\n" + b"x" * 100) == "ifc_not_step"
    assert code(b"PK\x03\x04" + b"\x00" * 50) == "ifc_compressed"
    assert code(b"ISO-10303-21;\nHEADER;\x00\nDATA;") == "ifc_not_step"
    assert code(_ifc(["#1=IFCWALL('a',$,'unterminated,$);"])) == "ifc_not_step"
    assert code(_ifc(["#1=IFCWALL("])) == "ifc_not_step"
    assert code(b"ISO-10303-21;\nHEADER;\nFILE_SCHEMA(('IFC4'));\nENDSEC;\nEND-ISO-10303-21;") == "ifc_not_step"
    assert code(_ifc(["#1=IFCWALL('a');"], schema="IFC5X9")) == "ifc_schema"
    assert code(_ifc(["#1=IFCWALL('a');"], schema="")) == "ifc_schema"
    deep = "#1=IFCWALL(" + "(" * 60 + ")" * 60 + ");"
    assert code(_ifc([deep])) == "ifc_too_complex"
    assert code(_ifc(["#1=IFCWALL('" + "a" * (plan_ifc_read.MAX_STRING * 12 + 10) + "');"])) == "ifc_too_complex"
    monkeypatch.setattr(plan_ifc_read, "MAX_INSTANCES", 50)
    assert code(_ifc([f"#{i}=IFCCARTESIANPOINT((0.,0.));" for i in range(1, 70)])) == "ifc_too_complex"
    monkeypatch.setattr(plan_ifc_read, "MAX_INSTANCES", 400_000)
    monkeypatch.setattr(plan_ifc_read, "MAX_INSTANCE_CHARS", 200)
    assert code(_ifc(["#1=IFCCARTESIANPOINT((" + ",".join(["0."] * 200) + "));"])) == "ifc_too_complex"
    monkeypatch.setattr(plan_ifc_read, "MAX_INSTANCE_CHARS", 64 * 1024)
    monkeypatch.setattr(plan_ifc_read, "MAX_AGGREGATE", 10)
    assert code(_ifc(["#1=IFCCARTESIANPOINT((" + ",".join(["0."] * 20) + "));", "#2=IFCPROJECT('a',$,'p',$,$,$,$,$,#3);", "#3=IFCUNITASSIGNMENT((#1));"])) == "ifc_too_complex"
    monkeypatch.setattr(plan_ifc_read, "MAX_AGGREGATE", 50_000)
    # oversize: the service refuses before parsing
    monkeypatch.setattr(plan_ifc_read, "MAX_BYTES", 100)
    assert code(_foreign()) == "ifc_too_large"


def test_cyclic_placement_and_absurd_numbers_skip_the_element_only():
    r = _read(_foreign(extra=["#200=IFCLOCALPLACEMENT(#201,#4);", "#201=IFCLOCALPLACEMENT(#200,#4);"], wall_placement="#200"), width_px=640, height_px=400)
    assert r["ifc"]["counts"]["walls"] == 0 and r["ifc"]["skipped_by_reason"]["placement_cycle"] == 2, "the wall, and its door reported with the wall's reason"
    assert {(s["class"], s["reason"]) for s in r["ifc"]["skipped"] if s["reason"] == "placement_cycle"} == {("IFCWALLSTANDARDCASE", "placement_cycle"), ("IFCDOOR", "placement_cycle")}
    assert r["ifc"]["counts"]["rooms"] == 1 and r["ifc"]["counts"]["objects"] == 1
    bad = _foreign().decode().replace("#20=IFCCARTESIANPOINT((10000.,5000.,0.));", "#20=IFCCARTESIANPOINT((1.E300,5000.,0.));").encode()
    r = _read(bad, width_px=640, height_px=400)
    assert r["ifc"]["counts"]["walls"] == 0 and r["ifc"]["skipped_by_reason"]["bad_placement"] == 2, "the wall and its door"
    inf = _foreign().decode().replace("#26=IFCEXTRUDEDAREASOLID(#25,#4,#2,2800.);", "#26=IFCEXTRUDEDAREASOLID(#25,#4,#2,-5.);").encode()
    r = _read(inf, width_px=640, height_px=400)
    assert r["ifc"]["counts"]["walls"] == 0 and r["ifc"]["skipped_by_reason"]["bad_number"] >= 1
    # a self-referencing mapped item and a boolean result chain do not recurse forever
    loop = _foreign(extra=["#300=IFCMAPPEDITEM(#301,$);", "#301=IFCREPRESENTATIONMAP(#4,#302);", "#302=IFCSHAPEREPRESENTATION(#7,'Body','MappedRepresentation',(#300));"]).decode()
    loop = loop.replace("#27=IFCSHAPEREPRESENTATION(#7,'Body','SweptSolid',(#26));", "#27=IFCSHAPEREPRESENTATION(#7,'Body','MappedRepresentation',(#300));")
    r = _read(loop.encode(), width_px=640, height_px=400)
    assert r["ifc"]["counts"]["walls"] == 0 and r["ifc"]["skipped_by_reason"].get("placement_cycle", 0) + r["ifc"]["skipped_by_reason"].get("no_geometry", 0) >= 1


def test_the_deadline_stops_the_scan():
    data = _ifc([f"#{i}=IFCCARTESIANPOINT((0.,0.));" for i in range(1, plan_ifc_read.DEADLINE_EVERY + 10)])
    with pytest.raises(plan_ifc_read.IfcTimeout):
        _read(data, deadline=time.monotonic() - 1)
    r = _read(data, deadline=time.monotonic() + 30)
    assert r["ifc"]["counts"] == {"walls": 0, "openings": 0, "objects": 0, "rooms": 0} and "no_storey_in_file" in r["ifc"]["warnings"]


def test_duplicate_instance_ids_keep_the_first_and_unknown_storey_elements_are_reported():
    data = _foreign(extra=["#29=IFCWALLSTANDARDCASE('zzzzzzzzzzzzzzzzzzzzzz',$,'Evil',$,$,#22,#28,$);"])
    r = _read(data, width_px=640, height_px=400)
    assert [w["tags"] for w in r["walls"]] == [["Wall-1"]]
    two = _foreign(extra=[f"#150=IFCBUILDINGSTOREY('{_g(50)}',$,'First',$,$,#13,$,$,.ELEMENT.,3000.);",
                          f"#151=IFCWALLSTANDARDCASE('{_g(51)}',$,'Orphan',$,$,#22,#28,$);"])
    r = _read(two, width_px=640, height_px=400, elevation=0.0)
    assert [s["name"] for s in r["ifc"]["storeys"]] == ["Ground", "First"] and [s["chosen"] for s in r["ifc"]["storeys"]] == [True, False]
    assert r["ifc"]["skipped_by_reason"]["no_storey"] == 1 and r["ifc"]["counts"]["walls"] == 1
    r = _read(two, width_px=640, height_px=400, elevation=2.9)
    assert [s["chosen"] for s in r["ifc"]["storeys"]] == [False, True] and r["ifc"]["counts"]["walls"] == 0 and r["ifc"]["skipped_by_reason"]["other_storey"] >= 1


# ---------------------------------------------------------------- routes

@pytest.fixture()
def world(settings):
    c = TestClient(create_app(settings))
    ids = seed_tree(c)
    asset = c.post(f"/api/v1/floors/{ids['floor2']}/plan-assets", files={"file": ("plan.png", png_bytes(1000, 800), "image/png")}).json()
    vid = c.post(f"/api/v1/floors/{ids['floor2']}/plan-versions", json={"asset_id": asset["id"]}).json()["id"]
    assert c.post(f"/api/v1/plan-versions/{vid}/publish").status_code == 200
    return c, ids, vid


def _audit(settings, action: str) -> list[dict]:
    with sqlite3.connect(settings.db_path) as con:
        con.row_factory = sqlite3.Row
        return [dict(r) for r in con.execute("SELECT * FROM audit_log WHERE action = ? ORDER BY id", (action,)).fetchall()]


def _calibrate(c: TestClient, vid: str) -> None:
    r = c.patch(f"/api/v1/plan-versions/{vid}/calibration", json={"pairs": [{"a": [0, 0.5], "b": [1, 0.5], "metres": 10}]})
    assert r.status_code == 200 and math.isclose(r.json()["scale_m_per_px"], 10 / 800), r.text  # the stored picture is 800 x 640


def test_routes_calibration_permissions_audit_and_the_accept(settings, world):
    c, ids, vid = world
    g = c.get(f"/api/v1/plan-versions/{vid}/geometry?draft=true").json()
    s = _sample()
    doc = dict(g["doc"], **{k: s[k] for k in ("levels", "walls", "openings", "labels", "objects", "connectors", "groups", "circuits")})
    assert c.put(f"/api/v1/plan-versions/{vid}/geometry", json={"doc": doc, "base_revision": 0}).status_code == 200
    r = c.get(f"/api/v1/plan-versions/{vid}/export.ifc?draft=true")
    assert r.status_code == 422 and r.json()["code"] == "plan_uncalibrated"
    r = c.post(f"/api/v1/plan-versions/{vid}/import-ifc", files={"file": ("x.ifc", _foreign(), "application/octet-stream")})
    assert r.status_code == 422 and r.json()["code"] == "plan_uncalibrated"
    _calibrate(c, vid)
    assert c.get(f"/api/v1/plan-versions/{vid}/export.ifc").status_code == 404, "nothing published yet"
    r = c.get(f"/api/v1/plan-versions/{vid}/export.ifc?draft=true")
    assert r.status_code == 200 and r.headers["content-type"].startswith("application/x-step") and r.headers["content-disposition"].endswith('.ifc"')
    assert r.content.startswith(b"ISO-10303-21;") and b"FILE_SCHEMA(('IFC4'));" in r.content
    assert c.get(f"/api/v1/plan-versions/{vid}/export.ifc?draft=true&level=nope").status_code == 422
    assert c.post(f"/api/v1/plan-versions/{vid}/geometry/publish").status_code == 200
    pub = c.get(f"/api/v1/plan-versions/{vid}/export.ifc")
    assert pub.status_code == 200 and pub.content == c.get(f"/api/v1/plan-versions/{vid}/export.ifc").content, "a published structure exports to the same bytes"
    one = c.get(f"/api/v1/plan-versions/{vid}/export.ifc?level=L1")
    assert one.status_code == 200 and len(plan_ifc_read.Model(one.content.decode()).of("IFCBUILDINGSTOREY")) == 1
    exp = _audit(settings, "geometry.ifc.export")
    assert len(exp) == 4 and json.loads(exp[0]["details_json"])["stage"] == "draft" and json.loads(exp[-1]["details_json"])["walls"] == 1
    # permissions: a floor viewer reads the published file, not the draft; a stranger nothing; the import needs map.import
    bind(c, settings, "dana", "viewer", "floor", ids["floor2"])
    assert c.get(f"/api/v1/plan-versions/{vid}/export.ifc", headers=as_user("dana")).status_code == 200
    assert c.get(f"/api/v1/plan-versions/{vid}/export.ifc?draft=true", headers=as_user("dana")).status_code == 403
    assert c.get(f"/api/v1/plan-versions/{vid}/export.ifc", headers=as_user("stranger")).status_code == 403
    assert c.post(f"/api/v1/plan-versions/{vid}/import-ifc", files={"file": ("x.ifc", _foreign(), "application/octet-stream")}, headers=as_user("dana")).status_code == 403
    assert c.post(f"/api/v1/plan-versions/{vid}/import-ifc", files={"file": ("x.ifc", _foreign(), "application/octet-stream")}, headers=as_user("stranger")).status_code == 403
    # the import: candidates + report, nothing stored
    before = c.get(f"/api/v1/plan-versions/{vid}/geometry?draft=true").json()
    r = c.post(f"/api/v1/plan-versions/{vid}/import-ifc?level_id=L0", files={"file": ("x.ifc", _foreign(), "application/octet-stream")})
    assert r.status_code == 200, r.text
    body = r.json()
    assert body["version_id"] == vid and body["level_id"] == "L0" and body["ifc"]["counts"] == {"walls": 1, "openings": 1, "objects": 1, "rooms": 1}
    assert body["detector"]["name"] == "plan_ifc_read" and body["scale"] == {"m_per_px": 0.0125, "status": "measured"} and body["existing_auto"] == {"walls": 0, "openings": 0, "objects": 0}
    assert c.get(f"/api/v1/plan-versions/{vid}/geometry?draft=true").json()["geometry"]["doc_hash"] == before["geometry"]["doc_hash"], "the import stores nothing"
    assert c.post(f"/api/v1/plan-versions/{vid}/import-ifc?level_id=nope", files={"file": ("x.ifc", _foreign(), "application/octet-stream")}).status_code == 422
    assert c.post(f"/api/v1/plan-versions/{vid}/import-ifc?storey=7", files={"file": ("x.ifc", _foreign(), "application/octet-stream")}).json()["code"] == "ifc_storey"
    r = c.post(f"/api/v1/plan-versions/{vid}/import-ifc", files={"file": ("x.ifc", b"garbage", "application/octet-stream")})
    assert r.status_code == 422 and r.json()["code"] == "ifc_not_step"
    r = c.post(f"/api/v1/plan-versions/{vid}/import-ifc", files={"file": ("x.ifc", b"", "application/octet-stream")})
    assert r.status_code == 422
    # the accept through /detect/accept lands the candidates in the draft as imported items
    rev = c.get(f"/api/v1/plan-versions/{vid}/geometry?draft=true").json()["geometry"]["revision"]
    accepted = [w["id"] for w in body["walls"]] + [o["id"] for o in body["openings"]] + [o["id"] for o in body["objects"]]
    r = c.post(f"/api/v1/plan-versions/{vid}/detect/accept", json={"accepted": accepted, "candidates": {"walls": body["walls"], "openings": body["openings"], "objects": body["objects"]},
                                                                  "base_revision": rev, "detector": body["detector"]})
    assert r.status_code == 200, r.text
    draft = c.get(f"/api/v1/plan-versions/{vid}/geometry?draft=true").json()["doc"]
    imported = [w for w in draft["walls"] if w["source"] == "imported"]
    assert len(imported) == 1 and imported[0]["external_ids"]["ifc_guid"] == _g(8) and any(o["source"] == "imported" for o in draft["openings"])
    r = c.post(f"/api/v1/plan-versions/{vid}/import-ifc?level_id=L0", files={"file": ("x.ifc", _foreign(), "application/octet-stream")})
    assert r.json()["existing_auto"] == {"walls": 1, "openings": 1, "objects": 1}
    imp = _audit(settings, "geometry.ifc.import")
    codes = [json.loads(a["details_json"]) for a in imp]
    assert sum(1 for d in codes if "walls" in d) == 2 and any(d.get("code") == "ifc_storey" for d in codes) and any(d.get("code") == "ifc_not_step" for d in codes)
    assert all(d["bytes"] <= plan_ifc_read.MAX_BYTES for d in codes)


def test_route_refuses_an_oversized_upload_before_reading_it(settings, world, monkeypatch):
    c, ids, vid = world
    _calibrate(c, vid)
    monkeypatch.setattr(plan_ifc_read, "MAX_BYTES", 500)
    r = c.post(f"/api/v1/plan-versions/{vid}/import-ifc", files={"file": ("x.ifc", _foreign(), "application/octet-stream")})
    assert r.status_code == 413 and r.json()["code"] == "ifc_too_large"


def test_round_trip_through_the_routes_keeps_the_published_structure(settings, world):
    c, ids, vid = world
    _calibrate(c, vid)
    g = c.get(f"/api/v1/plan-versions/{vid}/geometry?draft=true").json()
    s = _sample()
    doc = dict(g["doc"], **{k: s[k] for k in ("levels", "walls", "openings", "objects")})
    assert c.put(f"/api/v1/plan-versions/{vid}/geometry", json={"doc": doc, "base_revision": g["geometry"]["revision"]}).status_code == 200
    data = c.get(f"/api/v1/plan-versions/{vid}/export.ifc?draft=true").content
    r = c.post(f"/api/v1/plan-versions/{vid}/import-ifc?level_id=L0", files={"file": ("plan.ifc", data, "application/octet-stream")})
    assert r.status_code == 200, r.text
    body = r.json()
    l0 = [w for w in s["walls"] if w["level_id"] == "L0"]
    assert body["ifc"]["counts"]["walls"] == len(l0) and body["ifc"]["alignment"]["fits"] is True and body["ifc"]["alignment"]["dx_m"] == 0.0
    got = {w["external_ids"]["ifc_guid"]: w for w in body["walls"]}
    floor_id = c.get(f"/api/v1/plan-versions/{vid}").json()["floor_id"]
    for w in l0:
        back = got[plan_ifc.global_id(floor_id, "walls", w)]
        assert all(math.isclose(a, b, abs_tol=1e-4) for p, q in zip(back["polyline"], w["polyline"]) for a, b in zip(p, q))
        assert back["thickness_m"] == w["thickness_m"] and back["kind"] == w["kind"]
