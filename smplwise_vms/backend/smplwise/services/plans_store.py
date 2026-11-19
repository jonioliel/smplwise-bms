"""The SQL of the floor-plan router (routers/plans.py, T019 / T038; CR-ROUTER-SQL-2450, review 05:P2-07): every statement the router
ran inline, moved here unchanged (same text, same arguments, same order of calls). The router keeps the checks, the rendering and
file work, the anchor-carry rule and the audit; each function runs on the connection the route hands it."""
from __future__ import annotations

import sqlite3
from typing import Any

Rows = list[sqlite3.Row]


# ---------------------------------------------------------------- plan versions

def published_version(conn: sqlite3.Connection, floor_id: str) -> sqlite3.Row | None:
    return conn.execute("SELECT * FROM plan_versions WHERE floor_id = ? AND status = 'published'", (floor_id,)).fetchone()


def other_versions(conn: sqlite3.Connection, floor_id: str, version_id: str) -> Rows:
    """Every version of the floor except this one."""
    return conn.execute("SELECT * FROM plan_versions WHERE floor_id = ? AND id != ?", (floor_id, version_id)).fetchall()


def floor_versions(conn: sqlite3.Connection, floor_id: str) -> Rows:
    return conn.execute("SELECT * FROM plan_versions WHERE floor_id = ?", (floor_id,)).fetchall()


def floor_versions_newest_first(conn: sqlite3.Connection, floor_id: str) -> Rows:
    return conn.execute("SELECT * FROM plan_versions WHERE floor_id = ? ORDER BY created_at DESC", (floor_id,)).fetchall()


def version_published_at(conn: sqlite3.Connection, floor_id: str, iso: str) -> sqlite3.Row | None:
    """The version that was published at the instant."""
    return conn.execute(
        "SELECT * FROM plan_versions WHERE floor_id = ? AND status != 'draft' AND published_at IS NOT NULL AND published_at <= ? AND (archived_at IS NULL OR archived_at > ?) ORDER BY published_at DESC LIMIT 1",
        (floor_id, iso, iso),
    ).fetchone()


def version(conn: sqlite3.Connection, version_id: str) -> sqlite3.Row | None:
    return conn.execute("SELECT * FROM plan_versions WHERE id = ?", (version_id,)).fetchone()


def insert_draft(conn: sqlite3.Connection, values: tuple[Any, ...]) -> None:
    """(id, floor_id, asset_id, page, rotation, crop_json, width_px, height_px, image_path, scale_m_per_px, notes, created_by, created_at)."""
    conn.execute(
        """INSERT INTO plan_versions(id, floor_id, asset_id, page, rotation, crop_json, width_px, height_px, image_path, scale_m_per_px, status, revision, notes, created_by, created_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'draft', 1, ?, ?, ?)""",
        values,
    )


def insert_restored(conn: sqlite3.Connection, values: tuple[Any, ...]) -> None:
    """(id, floor_id, asset_id, page, rotation, crop_json, width_px, height_px, image_path, scale_m_per_px, calibration_json, notes, created_by, created_at,
    published_by, published_at, render_mode, stylized_path, stylize_json): a published copy of an older version."""
    conn.execute(
        """INSERT INTO plan_versions(id, floor_id, asset_id, page, rotation, crop_json, width_px, height_px, image_path, scale_m_per_px, calibration_json, status, revision, notes,
                                     created_by, created_at, published_by, published_at, render_mode, stylized_path, stylize_json)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'published', 1, ?, ?, ?, ?, ?, ?, ?, ?)""",
        values,
    )


def archive_version(conn: sqlite3.Connection, version_id: str, at: str) -> None:
    conn.execute("UPDATE plan_versions SET status = 'archived', archived_at = ?, revision = revision + 1 WHERE id = ?", (at, version_id))


def publish_version(conn: sqlite3.Connection, version_id: str, by: str | None, at: str) -> None:
    conn.execute("UPDATE plan_versions SET status = 'published', published_by = ?, published_at = ?, revision = revision + 1 WHERE id = ?", (by, at, version_id))


def bump_version(conn: sqlite3.Connection, version_id: str) -> None:
    conn.execute("UPDATE plan_versions SET revision = revision + 1 WHERE id = ?", (version_id,))


def delete_draft(conn: sqlite3.Connection, version_id: str) -> None:
    """The draft's structure document, then the version row."""
    conn.execute("DELETE FROM plan_geometry WHERE plan_version_id = ?", (version_id,))
    conn.execute("DELETE FROM plan_versions WHERE id = ?", (version_id,))


def set_stylized(conn: sqlite3.Connection, version_id: str, stylized_path: str, stylize_json: str) -> None:
    conn.execute("UPDATE plan_versions SET stylized_path = ?, stylize_json = ? WHERE id = ?", (stylized_path, stylize_json, version_id))


def set_render_mode(conn: sqlite3.Connection, version_id: str, render_mode: str) -> None:
    conn.execute("UPDATE plan_versions SET render_mode = ? WHERE id = ?", (render_mode, version_id))


# ---------------------------------------------------------------- plan assets

def asset(conn: sqlite3.Connection, asset_id: str) -> sqlite3.Row | None:
    return conn.execute("SELECT * FROM plan_assets WHERE id = ?", (asset_id,)).fetchone()


def floor_assets(conn: sqlite3.Connection, floor_id: str) -> Rows:
    return conn.execute("SELECT * FROM plan_assets WHERE floor_id = ? ORDER BY created_at DESC", (floor_id,)).fetchall()


def insert_asset(conn: sqlite3.Connection, asset_id: str, floor_id: str, name: str, mime: str, sha256: str, size: int, page_count: int, storage_path: str,
                 uploaded_by: str | None, at: str) -> None:
    conn.execute(
        "INSERT INTO plan_assets(id, floor_id, original_name, mime, sha256, bytes, page_count, storage_path, uploaded_by, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
        (asset_id, floor_id, name, mime, sha256, size, page_count, storage_path, uploaded_by, at),
    )


# ---------------------------------------------------------------- anchors and cameras

def carry_anchors(conn: sqlite3.Connection, floor_id: str, to_version_id: str, from_version_ids: list[str], at: str) -> int:
    """The floor's live anchors on any of `from_version_ids` move to `to_version_id`; returns how many."""
    return conn.execute(
        f"UPDATE map_anchors SET plan_version_id = ?, updated_at = ? WHERE floor_id = ? AND effective_to IS NULL AND plan_version_id IN ({','.join('?' * len(from_version_ids))})",
        (to_version_id, at, floor_id, *from_version_ids),
    ).rowcount


def anchors_off_version(conn: sqlite3.Connection, floor_id: str, version_id: str) -> int:
    """How many live anchors of the floor are on another version."""
    return conn.execute("SELECT COUNT(*) FROM map_anchors WHERE floor_id = ? AND effective_to IS NULL AND plan_version_id != ?", (floor_id, version_id)).fetchone()[0]


def floor_anchors(conn: sqlite3.Connection, floor_id: str) -> Rows:
    return conn.execute("SELECT * FROM map_anchors WHERE floor_id = ? AND effective_to IS NULL ORDER BY layer_id, resource_id", (floor_id,)).fetchall()


def anchors_per_version(conn: sqlite3.Connection, floor_id: str) -> Rows:
    return conn.execute("SELECT plan_version_id, COUNT(*) AS n FROM map_anchors WHERE floor_id = ? AND effective_to IS NULL GROUP BY plan_version_id", (floor_id,)).fetchall()


def version_anchor_count(conn: sqlite3.Connection, version_id: str) -> int:
    """Every anchor row on the version (ended ones too)."""
    return conn.execute("SELECT COUNT(*) FROM map_anchors WHERE plan_version_id = ?", (version_id,)).fetchone()[0]


def camera_name_rows(conn: sqlite3.Connection) -> Rows:
    return conn.execute("SELECT id, channel, name_source, alias FROM cameras").fetchall()
