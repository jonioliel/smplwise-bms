"""Plan Studio storage (T084, CR-003): migration 0018 adds the versioned plan_geometry table (at most one draft and one
published row per plan version) and a calibration record per plan version; 0019 lets rooms and placed items belong to
a level of the floor."""
from __future__ import annotations

import sqlite3

import pytest
from conftest import png_bytes, seed_tree
from fastapi.testclient import TestClient

from smplwise.main import create_app


def _cols(conn: sqlite3.Connection, table: str) -> set[str]:
    return {r[1] for r in conn.execute(f"PRAGMA table_info({table})").fetchall()}


def test_migrations_add_the_geometry_table_and_level_columns(settings):
    app = create_app(settings)
    with app.state.db.connection() as conn:
        assert {"id", "plan_version_id", "floor_id", "status", "revision", "doc_json", "doc_hash", "created_at", "updated_at",
                "published_at", "published_by", "archived_at"} <= _cols(conn, "plan_geometry")
        assert "calibration_json" in _cols(conn, "plan_versions")
        assert {"level_id", "ceiling_height_m"} <= _cols(conn, "spatial_zones")
        assert "level_id" in _cols(conn, "map_anchors")


@pytest.mark.parametrize("status", ["draft", "published"])
def test_at_most_one_draft_and_one_published_row_per_version(settings, status):
    app = create_app(settings)
    c = TestClient(app)
    ids = seed_tree(c)
    asset = c.post(f"/api/v1/floors/{ids['floor2']}/plan-assets", files={"file": ("plan.png", png_bytes(), "image/png")}).json()
    v = c.post(f"/api/v1/floors/{ids['floor2']}/plan-versions", json={"asset_id": asset["id"]}).json()
    sql = ("INSERT INTO plan_geometry(id, plan_version_id, floor_id, status, revision, doc_json, doc_hash, created_at, updated_at) "
           "VALUES (?, ?, ?, ?, 1, '{}', 'h', '2026-09-23T08:00:00Z', '2026-09-23T08:00:00Z')")
    with app.state.db.connection() as conn:
        conn.execute(sql, ("g1", v["id"], ids["floor2"], status))
    with pytest.raises(sqlite3.IntegrityError):
        with app.state.db.connection() as conn:
            conn.execute(sql, ("g2", v["id"], ids["floor2"], status))
    with app.state.db.connection() as conn:  # archived rows are the history: any number of them
        for i in range(3):
            conn.execute(sql, (f"a{i}", v["id"], ids["floor2"], "archived"))
