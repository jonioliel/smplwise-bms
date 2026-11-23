"""I18N-DEFAULT-NAMES-2490 (owner answer N53 / Q15 = b, "translate at creation"), second pass over the server's default names: the
level of a new plan structure, the first NVR's row, the group of cameras without a recorder, the labels of objects imported from a
DXF drawing and the ready automations of the editor's gallery. Each is made in the interface language (`ui.lang`) of the person whose
request creates it; a Hebrew user (or no stored value) gets exactly the Hebrew written before; a stored name is never rewritten."""
from __future__ import annotations

import pytest
from automations_fixture import autos_app  # noqa: F401 - the automation editor's world (fixture)
from conftest import as_user, png_bytes, seed_tree
from fastapi.testclient import TestClient
from test_camera_sources_2410 import add_standalone, world  # noqa: F401 - `world` is a fixture
from test_plan_dxf_map import CATALOG, _drawing

from smplwise.main import create_app
from smplwise.services import autosync
from smplwise.services import camera_sources as cs
from smplwise.services import default_names as dn
from smplwise.services import plan_dxf_map
from smplwise.services import plan_geometry as pg

API = "/api/v1"
HEBREW = range(0x0590, 0x0600)


def _has_hebrew(text: str) -> bool:
    return any(ord(ch) in HEBREW for ch in text)


def _lang(c: TestClient, lang: str, user: str | None = None) -> None:
    r = c.put(f"{API}/me/prefs", json={"ui.lang": lang}, headers=as_user(user) if user else None)
    assert r.status_code == 200 and r.json()["prefs"]["ui.lang"] == lang, r.text


# ---------------------------------------------------------------- the catalogue


def test_the_new_entries_keep_the_old_hebrew_and_have_english():
    assert dn.name("plan.level_main", "he") == pg.DEFAULT_LEVEL_NAME == "מפלס ראשי"
    assert dn.name("recorder.primary", "he") == "NVR ראשי"
    assert dn.name("recorder.standalone", "he") == cs.STANDALONE_NAME == "מצלמות ללא מקליט"
    assert dn.name("plan.object_generic", "he") == plan_dxf_map.GENERIC_NAME == "עצם כללי"
    for key in ("plan.level_main", "recorder.primary", "recorder.standalone", "plan.object_generic"):
        assert dn.name(key, "en") and not _has_hebrew(dn.name(key, "en")), key
    assert set(dn.BLOCK_WORD_EN) == set(plan_dxf_map.BLOCK_WORDS), "every block word has its English"
    assert not any(_has_hebrew(v) for v in dn.BLOCK_WORD_EN.values())
    assert not any(_has_hebrew(n) or _has_hebrew(d) for n, d in dn.AUTOMATION_TEMPLATE_EN.values())
    assert not any(_has_hebrew(v) for v in dn.AUTOMATION_MESSAGE_EN.values())
    # an unknown language is Hebrew, as for every entry
    assert dn.block_word("chair", "כיסא", "ru") == "כיסא" and dn.automation_message("הדלת פתוחה", "ar") == "הדלת פתוחה"


# ---------------------------------------------------------------- the level of a new plan structure


def test_new_document_level_name_per_language():
    version = {"id": "v1", "floor_id": "f1", "page": 1, "width_px": 100, "height_px": 80, "scale_m_per_px": None, "rotation": 0, "crop_json": None,
               "calibration_json": None}
    he = pg.new_document(version, None)
    en = pg.new_document(version, None, "en")
    assert he["levels"][0]["name"] == "מפלס ראשי" and en["levels"][0]["name"] == "Main level"
    assert {k: v for k, v in he["levels"][0].items() if k != "name"} == {k: v for k, v in en["levels"][0].items() if k != "name"}, "only the name differs"


def _plan(c: TestClient, floor: str) -> str:
    asset = c.post(f"{API}/floors/{floor}/plan-assets", files={"file": ("plan.png", png_bytes(), "image/png")}).json()
    v = c.post(f"{API}/floors/{floor}/plan-versions", json={"asset_id": asset["id"]}).json()
    assert c.post(f"{API}/plan-versions/{v['id']}/publish").status_code == 200
    return v["id"]


def test_the_editors_new_structure_takes_the_editors_language_and_keeps_it(settings):
    c = TestClient(create_app(settings))
    ids = seed_tree(c)
    he_vid = _plan(c, ids["floor3"])
    assert c.get(f"{API}/plan-versions/{he_vid}/geometry?draft=true").json()["doc"]["levels"][0]["name"] == "מפלס ראשי", "Hebrew as before"
    _lang(c, "en")
    vid = _plan(c, ids["floor2"])
    g = c.get(f"{API}/plan-versions/{vid}/geometry?draft=true").json()
    assert g["doc"]["levels"][0]["name"] == "Main level"
    saved = c.put(f"{API}/plan-versions/{vid}/geometry", json={"doc": g["doc"], "base_revision": 0})
    assert saved.status_code == 200, saved.text
    _lang(c, "he")  # the same person back in Hebrew: the stored name is data, not translated on read
    assert c.get(f"{API}/plan-versions/{vid}/geometry?draft=true").json()["doc"]["levels"][0]["name"] == "Main level"


# ---------------------------------------------------------------- the first NVR and the cameras without a recorder


def _recorder_name(app, rid: str) -> str | None:
    with app.state.db.connection(mode="read") as conn:
        row = conn.execute("SELECT name FROM recorders WHERE id = ?", (rid,)).fetchone()
        return row["name"] if row is not None else None


@pytest.mark.parametrize(("lang", "expected"), [("he", "NVR ראשי"), ("en", "Main NVR")])
def test_registering_the_first_camera_names_the_first_nvr_in_the_callers_language(settings, lang, expected):
    app = create_app(settings)
    c = TestClient(app)
    _lang(c, lang)
    r = c.post(f"{API}/cameras", json={"channel": 1, "alias": "לובי"})
    assert r.status_code == 201, r.text
    assert _recorder_name(app, r.json()["recorder_id"]) == expected
    _lang(c, "he" if lang == "en" else "en")
    assert c.post(f"{API}/cameras", json={"channel": 2, "alias": "חניה"}).status_code == 201
    assert _recorder_name(app, r.json()["recorder_id"]) == expected, "an existing row keeps its name"


def test_autosync_ensure_recorder_language(settings):
    app = create_app(settings)
    with app.state.db.connection() as conn:
        autosync.ensure_recorder(conn, recorder_id="nvr-1", lang="en")
        autosync.ensure_recorder(conn, recorder_id="nvr-1")  # the background discovery later: never renames
        assert conn.execute("SELECT name FROM recorders WHERE id = 'nvr-1'").fetchone()[0] == "Main NVR"
        autosync.ensure_recorder(conn, recorder_id="nvr-2", lang="en")
        assert conn.execute("SELECT name FROM recorders WHERE id = 'nvr-2'").fetchone()[0] == "nvr-2", "only the first recorder has a default name"
        conn.execute("DELETE FROM recorders WHERE id = 'nvr-1'")
        autosync.ensure_recorder(conn, recorder_id="nvr-1")
        assert conn.execute("SELECT name FROM recorders WHERE id = 'nvr-1'").fetchone()[0] == "NVR ראשי", "no caller (the discovery pass) = Hebrew"


def test_cameras_without_a_recorder_group_follows_the_first_creator(world):  # noqa: F811
    _lang(world.c, "en")
    r = add_standalone(world)
    assert r.status_code == 201, r.text
    assert _recorder_name(world.app, cs.STANDALONE) == "Cameras without a recorder"
    listed = world.c.get(f"{API}/cameras").json()
    assert {"id": cs.STANDALONE, "name": "Cameras without a recorder", "vendor": "standalone"} in listed["recorders"]
    _lang(world.c, "he")
    assert add_standalone(world, name="חצר").status_code == 201
    assert _recorder_name(world.app, cs.STANDALONE) == "Cameras without a recorder", "made once; never rewritten"


def test_cameras_without_a_recorder_group_hebrew_is_unchanged(world):  # noqa: F811
    assert add_standalone(world).status_code == 201
    assert _recorder_name(world.app, cs.STANDALONE) == cs.STANDALONE_NAME == "מצלמות ללא מקליט"


# ---------------------------------------------------------------- objects imported from a DXF drawing


def test_suggest_block_names_in_english():
    assert plan_dxf_map.suggest_block("CHAIR_01", (0.45, 0.45), CATALOG, "en") == {"catalog_id": "chair-1", "name": "Chair"}
    assert plan_dxf_map.suggest_block("CHAIR_01", (0.45, 0.45), CATALOG) == {"catalog_id": "chair-1", "name": "כיסא"}, "Hebrew as before"
    assert plan_dxf_map.suggest_block("BED-DOUBLE", (2.0, 1.6), CATALOG, "en") == {"catalog_id": "bed-1", "name": "Single bed"}
    assert plan_dxf_map.suggest_block("WIDGET", (0.5, 0.5), CATALOG, "en") == {"catalog_id": "object.generic", "name": "Generic object"}
    assert plan_dxf_map.suggest_block("CHAIR", (0.5, 0.5), [], "en") == {"catalog_id": "object.generic", "name": "Chair"}, "the word list in English"
    assert plan_dxf_map.suggest_block("CHAIR-TAG", (0.45, 0.45), CATALOG, "en") == {"catalog_id": "object.generic", "name": "Generic object"}
    assert plan_dxf_map.suggest_block("DOOR", (0.9, 0.9), CATALOG, "en") == {"catalog_id": None, "name": "Door"}
    hebrew_only = [{"id": "x-1", "name_he": "ספסל", "name_en": "", "tags": ["bench"], "size": (1.5, 0.5, 0.5)}]
    assert plan_dxf_map.suggest_block("BENCH", (1.5, 0.5), hebrew_only, "en")["name"] == "ספסל", "an item without English keeps its Hebrew"


def test_map_geometry_labels_follow_the_language(tmp_path):
    src = tmp_path / "plan.dxf"
    _drawing(src)
    ext = plan_dxf_map.extent_for(src, None)
    layer_map = {"A-WALL": "walls", "A-DOOR": "openings", "A-GLAZ": "windows", "A-FURN": "objects", "A-AREA": "rooms", "TEXT": "ignore"}
    kw = dict(layer_map=layer_map, units="m", extent=ext, rotation=0, crop=None, level_id="L0", run_id="d1", catalog=CATALOG, scale_m_per_px=0.03)
    he = {o["external_ids"]["dxf_block"]: o["label"] for o in plan_dxf_map.map_geometry(src, block_map={}, **kw)["objects"]}
    en = {o["external_ids"]["dxf_block"]: o["label"] for o in plan_dxf_map.map_geometry(src, block_map={}, lang="en", **kw)["objects"]}
    assert he == {"CHAIR": "כיסא", "BED": "מיטה", "WIDGET": "עצם כללי"}, "Hebrew as before"
    assert en == {"CHAIR": "Chair", "BED": "Single bed", "WIDGET": "Generic object"}
    ov = plan_dxf_map.map_geometry(src, block_map={"WIDGET": "lamp-1", "CHAIR": None}, lang="en", **kw)
    labels = {o["external_ids"]["dxf_block"]: o["label"] for o in ov["objects"]}
    assert labels["WIDGET"] == "Ceiling lamp" and labels["CHAIR"] == "Chair", "the person's choice in English; a null choice keeps the block's word"


@pytest.mark.parametrize("lang", ["he", "en"])
def test_the_import_route_labels_and_the_accepted_draft(settings, tmp_path, lang):
    c = TestClient(create_app(settings))
    f2 = seed_tree(c)["floor2"]
    src = tmp_path / "plan.dxf"
    _drawing(src)
    asset = c.post(f"{API}/floors/{f2}/plan-assets", files={"file": ("plan.dxf", src.read_bytes(), "application/octet-stream")}).json()
    assert c.put(f"{API}/plan-assets/{asset['id']}/dxf", json={"units": "m"}).status_code == 200
    v = c.post(f"{API}/floors/{f2}/plan-versions", json={"asset_id": asset["id"]}).json()
    layer_map = {layer["name"]: layer["suggested"] for layer in c.get(f"{API}/plan-assets/{asset['id']}/dxf/entities").json()["layers"]}
    _lang(c, lang)
    r = c.post(f"{API}/plan-versions/{v['id']}/import-dxf-geometry", json={"layer_map": layer_map, "block_map": {}})
    assert r.status_code == 200, r.text
    cands = r.json()
    labels = {o["external_ids"]["dxf_block"]: o["label"] for o in cands["objects"]}
    assert set(labels) == {"CHAIR", "BED", "WIDGET"}
    if lang == "he":
        assert labels["WIDGET"] == "עצם כללי" and all(_has_hebrew(x) for x in labels.values()), labels
    else:
        assert labels["WIDGET"] == "Generic object" and not any(_has_hebrew(x) for x in labels.values()), labels
    everything = [w["id"] for w in cands["walls"]] + [o["id"] for o in cands["openings"]] + [o["id"] for o in cands["objects"]]
    acc = c.post(f"{API}/plan-versions/{v['id']}/detect/accept", json={"accepted": everything, "edits": {}, "replace_auto": False,
                                                                     "candidates": {"walls": cands["walls"], "openings": cands["openings"], "objects": cands["objects"]},
                                                                     "base_revision": 0, "detector": cands["detector"]})
    assert acc.status_code == 200, acc.text
    _lang(c, "en" if lang == "he" else "he")  # read back in the other language: stored as made
    doc = c.get(f"{API}/plan-versions/{v['id']}/geometry?draft=true").json()["doc"]
    assert {o["external_ids"]["dxf_block"]: o["label"] for o in doc["objects"]} == labels
    assert doc["levels"][0]["name"] == ("מפלס ראשי" if lang == "he" else "Main level"), "the new structure the import read was made with the importer's language"


# ---------------------------------------------------------------- the ready automations of the editor's gallery


def _templates(c: TestClient) -> dict[str, dict]:
    return {t["id"]: t for t in c.get(f"{API}/automations/templates").json()["templates"]}


def _messages(draft) -> list[str]:
    out: list[str] = []

    def walk(v):
        if isinstance(v, dict):
            for k, x in v.items():
                if k == "message" and isinstance(x, str):
                    out.append(x)
                walk(x)
        elif isinstance(v, list):
            for x in v:
                walk(x)

    walk(draft)
    return out


def test_gallery_templates_hebrew_is_unchanged_and_english_follows_the_user(autos_app):  # noqa: F811
    _app, _s, c, _fake, _tr = autos_app
    he = _templates(c)
    assert he["motion_light"]["name"] == "תאורה בתנועה" and he["motion_light"]["draft"]["alias"] == "תאורה בתנועה"
    assert he["water_leak"]["description"] == "התראה כשחיישן נזילה מזהה מים" and "זוהתה נזילת מים" in _messages(he["water_leak"]["draft"])
    assert "הדלת פתוחה" in _messages(he["door_open_notify"]["draft"])
    _lang(c, "en")
    en = _templates(c)
    assert set(en) == set(he) == set(dn.AUTOMATION_TEMPLATE_EN), "every gallery template has its English"
    for tid, t in en.items():
        assert (t["name"], t["description"]) == dn.AUTOMATION_TEMPLATE_EN[tid]
        assert t["draft"]["alias"] == t["name"], "the alias the automation is saved with"
    assert en["motion_light"]["draft"]["alias"] == "Motion lighting"
    assert "Water leak detected" in _messages(en["water_leak"]["draft"]) and "The door is open" in _messages(en["door_open_notify"]["draft"])
    assert not any(_has_hebrew(m) for t in en.values() for m in _messages(t["draft"]))
