"""Plan Studio object library (T085, CR-003): migration 0020 adds the custom items table; the built-in catalog file
is valid by the same rules the API applies to custom items (153 items in the 12 categories, 24 symbols); a custom
item based on a built-in one inherits what its row does not carry; the library revision follows the custom rows."""
from __future__ import annotations

import copy
import json
import sqlite3

from smplwise.main import create_app
from smplwise.services import plan_catalog as cat


def _cols(conn: sqlite3.Connection, table: str) -> set[str]:
    return {r[1] for r in conn.execute(f"PRAGMA table_info({table})").fetchall()}


def test_migration_0020_adds_the_custom_items_table(settings):
    app = create_app(settings)
    with app.state.db.connection() as conn:
        assert {"id", "based_on", "names_json", "category", "tags_json", "role", "shape", "size_json", "z_m", "params_json", "icon", "color_token",
                "created_by", "created_at", "updated_at"} == _cols(conn, "catalog_items")


def test_the_built_in_catalog_is_valid_and_complete():
    data = json.loads(cat.CATALOG_FILE.read_text(encoding="utf-8"))
    assert cat.check_catalog(data) == []
    b = cat.builtin()
    items = b["items"]
    assert b["catalog_version"] == "2026.09.1" and len(items) == 153
    assert [c["id"] for c in b["categories"]] == list(cat.CATEGORIES) and len(cat.CATEGORIES) == 12
    assert {i["category"] for i in items.values()} == set(cat.CATEGORIES), "every category has items"
    assert {i["icon"] for i in items.values()} == set(cat.ICONS) and len(cat.ICONS) == 24, "every symbol is used"
    assert all(i["color_token"] in cat.COLOR_TOKENS for i in items.values())
    assert all(cat.MIN_SIZE_M <= i["size"][k] <= cat.MAX_SIZE_M for i in items.values() for k in ("w_m", "d_m", "h_m"))
    chair, lamp, tribune, door_station = items["chair.basic"], items["light.ceiling"], items["tribune.stepped"], items["doorstation.intercom"]
    assert chair["size"] == {"w_m": 0.45, "d_m": 0.45, "h_m": 0.85} and chair["icon"] == "chair" and chair["anchor_kinds"] == []
    assert lamp["z_ref"] == "ceiling" and lamp["z_m"] == -0.3 and lamp["params"]["power_w"] == 36 and lamp["anchor_kinds"] == ["light", "switch"]
    assert lamp["ifc"]["class"] == "IfcLightFixture"
    assert tribune["shape"] == "stepped" and tribune["params"] == {"rows": 4, "step_height_m": 0.3, "step_width_m": 1.0, "connects_levels": None}
    assert "יציע" in tribune["tags"] and "bleachers" in tribune["tags"], "synonyms for the search"
    assert door_station["icon"] == "doorstation" and "camera" in door_station["anchor_kinds"]
    assert cat.builtin_ids() == frozenset(items)


def test_check_catalog_names_every_problem():
    data = json.loads(cat.CATALOG_FILE.read_text(encoding="utf-8"))
    broken = copy.deepcopy(data)
    broken["items"][1]["id"] = broken["items"][0]["id"]  # duplicate
    broken["items"][2]["icon"] = "spaceship"
    broken["items"][3]["size"]["w_m"] = 0.01
    broken["items"][4]["category"] = "toys"
    broken["items"][5]["names"] = {"he": ""}
    errors = cat.check_catalog(broken)
    assert any("duplicate" in e for e in errors) and any("icon" in e for e in errors) and any("size" in e for e in errors)
    assert any("category" in e for e in errors) and any("names.he" in e for e in errors)
    assert cat.check_catalog({"catalog_version": "x", "categories": [], "icons": [], "color_tokens": [], "items": []}) != []
    assert cat.check_catalog("nope") == ["catalog: not an object"]


def test_custom_items_merge_with_their_base_and_move_the_revision(settings):
    app = create_app(settings)
    with app.state.db.connection() as conn:
        assert cat.revision(conn) == "2026.09.1:0:" and cat.custom_items(conn) == []
        conn.execute("INSERT INTO catalog_items(id, based_on, names_json, category, tags_json, role, shape, size_json, z_m, params_json, icon, color_token, created_by, created_at, updated_at) "
                     "VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
                     ("c1", "light.ceiling", '{"he": "מנורת אולם", "en": "Hall lamp"}', "lighting", '["אולם"]', "light", "cylinder", '{"w_m": 0.6, "d_m": 0.6, "h_m": 0.2}', -0.5,
                      '{"power_w": 120}', "lamp", "light", "dev-joni", "2026-09-25T08:00:00Z", "2026-09-25T08:00:00Z"))
        items = cat.custom_items(conn)
        assert len(items) == 1
        c = items[0]
        assert c["custom"] is True and c["based_on"] == "light.ceiling" and c["names"]["he"] == "מנורת אולם" and c["size"]["w_m"] == 0.6 and c["z_m"] == -0.5
        assert c["z_ref"] == "ceiling" and c["anchor_kinds"] == ["light", "switch"] and c["params_schema"] == cat.builtin()["items"]["light.ceiling"]["params_schema"]
        assert c["ifc"]["class"] == "IfcLightFixture" and c["params"] == {"power_w": 120}
        idx = cat.item_index(conn)
        assert "c1" in idx and "chair.basic" in idx and len(idx) == 154
        assert cat.names_index(conn)["c1"] == {"he": "מנורת אולם", "en": "Hall lamp", "tags": ["אולם"]}
        assert cat.revision(conn) == "2026.09.1:1:2026-09-25T08:00:00Z"
        lib = cat.library(conn)
        assert lib["revision"] == cat.revision(conn) and len(lib["items"]) == 154 and lib["items"][0]["custom"] is False and lib["items"][-1]["id"] == "c1"
        # a custom item without a base takes the neutral defaults
        conn.execute("INSERT INTO catalog_items(id, based_on, names_json, category, tags_json, role, shape, size_json, z_m, params_json, icon, color_token, created_by, created_at, updated_at) "
                     "VALUES ('c2', NULL, '{\"he\": \"ארגז\"}', 'storage', '[]', 'furniture', 'box', '{\"w_m\": 1, \"d_m\": 1, \"h_m\": 1}', 0, '{}', 'box', 'furniture', NULL, '2026-09-25T09:00:00Z', '2026-09-25T09:00:00Z')")
        c2 = cat.item_index(conn)["c2"]
        assert c2["z_ref"] == "floor" and c2["anchor_kinds"] == [] and c2["params_schema"] == {} and c2["ifc"] == {"class": "IfcFurniture", "predefined_type": "USERDEFINED"}
        assert c2["names"] == {"he": "ארגז", "en": ""}
