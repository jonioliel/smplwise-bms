"""Plan Studio persistence (T084, CR-003): the structure document of each plan version in plan_geometry - one draft
(the editor's autosave target), at most one published row, and the archived history the historical map reads. A
document is stored as canonical JSON with its SHA-256; the map bundle carries only (id, hash). The server rebases every
document on its version, so ids, size and calibration can never be changed by a client."""
from __future__ import annotations

import hashlib
import json
import sqlite3
from typing import Any

from ..db import new_id, now_iso
from ..errors import ApiError, conflict
from . import plan_geometry as pg

_INSERT = ("INSERT INTO plan_geometry(id, plan_version_id, floor_id, status, revision, doc_json, doc_hash, created_by, created_at, updated_at, published_by, published_at) "
           "VALUES (?, ?, ?, ?, 1, ?, ?, ?, ?, ?, ?, ?)")
_FULL = {"x": 0.0, "y": 0.0, "w": 1.0, "h": 1.0}


def doc_hash(doc: dict[str, Any]) -> str:
    return hashlib.sha256(pg.canonical_json(doc).encode("utf-8")).hexdigest()


def row_api(r: sqlite3.Row) -> dict[str, Any]:
    return {"id": r["id"], "plan_version_id": r["plan_version_id"], "floor_id": r["floor_id"], "status": r["status"], "revision": r["revision"],
            "doc_hash": r["doc_hash"], "created_at": r["created_at"], "updated_at": r["updated_at"], "published_at": r["published_at"],
            "published_by": r["published_by"], "archived_at": r["archived_at"]}


def ref(r: sqlite3.Row | None) -> dict[str, Any] | None:
    """What the map bundle carries: enough to fetch and cache the document, never the document itself."""
    return None if r is None else {"id": r["id"], "doc_hash": r["doc_hash"], "status": r["status"], "revision": r["revision"], "published_at": r["published_at"]}


def load_doc(r: sqlite3.Row) -> dict[str, Any]:
    return json.loads(r["doc_json"])


def get_row(conn: sqlite3.Connection, geometry_id: str) -> sqlite3.Row:
    return conn.execute("SELECT * FROM plan_geometry WHERE id = ?", (geometry_id,)).fetchone()


def _asset(conn: sqlite3.Connection, version: sqlite3.Row) -> sqlite3.Row | None:
    return conn.execute("SELECT * FROM plan_assets WHERE id = ?", (version["asset_id"],)).fetchone()


def _crop(version: sqlite3.Row) -> dict[str, float]:
    return json.loads(version["crop_json"]) if version["crop_json"] else dict(_FULL)


def _same_drawing(a: sqlite3.Row, b: sqlite3.Row) -> bool:
    return (a["asset_id"], a["page"], a["rotation"]) == (b["asset_id"], b["page"], b["rotation"])


def draft_row(conn: sqlite3.Connection, version_id: str) -> sqlite3.Row | None:
    return conn.execute("SELECT * FROM plan_geometry WHERE plan_version_id = ? AND status = 'draft'", (version_id,)).fetchone()


def published_row(conn: sqlite3.Connection, version_id: str) -> sqlite3.Row | None:
    return conn.execute("SELECT * FROM plan_geometry WHERE plan_version_id = ? AND status = 'published'", (version_id,)).fetchone()


def at_row(conn: sqlite3.Connection, version_id: str, iso: str) -> sqlite3.Row | None:
    """The document that was published at the instant (the historical map)."""
    return conn.execute(
        "SELECT * FROM plan_geometry WHERE plan_version_id = ? AND status IN ('published', 'archived') AND published_at IS NOT NULL AND published_at <= ? "
        "AND (archived_at IS NULL OR archived_at > ?) ORDER BY published_at DESC LIMIT 1", (version_id, iso, iso)).fetchone()


def history(conn: sqlite3.Connection, version_id: str) -> list[sqlite3.Row]:
    return conn.execute("SELECT * FROM plan_geometry WHERE plan_version_id = ? AND status IN ('published', 'archived') ORDER BY published_at DESC, rowid DESC",
                        (version_id,)).fetchall()


def _insert(conn: sqlite3.Connection, version: sqlite3.Row, status: str, doc: dict[str, Any], actor_id: str | None, now: str) -> sqlite3.Row:
    gid = new_id()
    published = status == "published"
    conn.execute(_INSERT, (gid, version["id"], version["floor_id"], status, pg.canonical_json(doc), doc_hash(doc), actor_id, now, now,
                           actor_id if published else None, now if published else None))
    return get_row(conn, gid)


def _replace_draft(conn: sqlite3.Connection, version: sqlite3.Row, doc: dict[str, Any], actor_id: str | None, now: str) -> sqlite3.Row:
    d = draft_row(conn, version["id"])
    if d is None:
        return _insert(conn, version, "draft", doc, actor_id, now)
    conn.execute("UPDATE plan_geometry SET doc_json = ?, doc_hash = ?, revision = revision + 1, updated_at = ? WHERE id = ?",
                 (pg.canonical_json(doc), doc_hash(doc), now, d["id"]))
    return get_row(conn, d["id"])


def working_doc(conn: sqlite3.Connection, version: sqlite3.Row) -> tuple[dict[str, Any], sqlite3.Row | None]:
    """The document the editor starts from: the stored draft, else a copy of the published document, else a new one."""
    asset = _asset(conn, version)
    d = draft_row(conn, version["id"])
    if d is not None:
        return pg.rebase(load_doc(d), version, asset), d
    p = published_row(conn, version["id"])
    return (pg.rebase(load_doc(p), version, asset) if p is not None else pg.new_document(version, asset)), None


def save_draft(conn: sqlite3.Connection, version: sqlite3.Row, doc: dict[str, Any], base_revision: int, actor_id: str | None, now: str | None = None) -> sqlite3.Row:
    now = now or now_iso()
    doc = pg.rebase(doc, version, _asset(conn, version))
    d = draft_row(conn, version["id"])
    current = d["revision"] if d is not None else 0
    if base_revision != current:
        raise conflict("stale_revision", "טיוטת המבנה השתנתה בינתיים; טען מחדש את העורך.", current_revision=current, sent_revision=base_revision)
    if d is None:
        return _insert(conn, version, "draft", doc, actor_id, now)
    if doc_hash(doc) == d["doc_hash"]:
        return d
    return _replace_draft(conn, version, doc, actor_id, now)


def pending_doc(conn: sqlite3.Connection, version: sqlite3.Row) -> dict[str, Any] | None:
    """The draft that publishing the version would publish, or None when there is nothing new. 422 when invalid."""
    d = draft_row(conn, version["id"])
    if d is None:
        return None
    doc = pg.rebase(load_doc(d), version, _asset(conn, version))
    p = published_row(conn, version["id"])
    if p is not None and p["doc_hash"] == doc_hash(doc):
        return None
    if p is None and pg.is_empty(doc):
        return None
    errors = [i for i in pg.validate(doc) if i["severity"] == "error"]
    if errors:
        raise ApiError(422, "geometry_invalid", "במבנה יש שגיאות שמונעות פרסום; הן מסומנות באדום על המפה.", details={"issues": errors[:50]})
    return doc


def publish(conn: sqlite3.Connection, version: sqlite3.Row, actor_id: str | None, now: str | None = None) -> dict[str, Any]:
    now = now or now_iso()
    prev = published_row(conn, version["id"])
    prev_doc = load_doc(prev) if prev is not None else None
    doc = pending_doc(conn, version)
    if doc is None:
        return {"published": row_api(prev) if prev is not None else None, "diff": pg.diff(prev_doc, prev_doc or {}), "unchanged": True}
    if prev is not None:
        conn.execute("UPDATE plan_geometry SET status = 'archived', archived_at = ?, updated_at = ? WHERE id = ?", (now, now, prev["id"]))
    row = _insert(conn, version, "published", doc, actor_id, now)
    return {"published": row_api(row), "diff": pg.diff(prev_doc, doc), "unchanged": False}


def rollback(conn: sqlite3.Connection, version: sqlite3.Row, geometry_id: str, actor_id: str | None, now: str | None = None) -> sqlite3.Row:
    now = now or now_iso()
    src = conn.execute("SELECT * FROM plan_geometry WHERE id = ? AND plan_version_id = ?", (geometry_id, version["id"])).fetchone()
    if src is None or src["status"] != "archived":
        raise conflict("not_archived", "רק גרסת מבנה מהארכיון ניתנת לשחזור.")
    doc = pg.rebase(load_doc(src), version, _asset(conn, version))
    prev = published_row(conn, version["id"])
    if prev is not None:
        conn.execute("UPDATE plan_geometry SET status = 'archived', archived_at = ?, updated_at = ? WHERE id = ?", (now, now, prev["id"]))
    row = _insert(conn, version, "published", doc, actor_id, now)
    _replace_draft(conn, version, doc, actor_id, now)
    return row


def copy_published(conn: sqlite3.Connection, source: sqlite3.Row, target: sqlite3.Row, actor_id: str | None, now: str | None = None) -> bool:
    """A restored plan version (plans.rollback_version) gets the structure its source had, published and as its draft."""
    now = now or now_iso()
    p = published_row(conn, source["id"])
    if p is None:
        return False
    doc = pg.rebase(load_doc(p), target, _asset(conn, target))
    _insert(conn, target, "published", doc, actor_id, now)
    _replace_draft(conn, target, doc, actor_id, now)
    return True


def carry_calibration(conn: sqlite3.Connection, source: sqlite3.Row, target: sqlite3.Row) -> None:
    """Metres per pixel follow a re-crop of the same drawing: m_new = m_old x (old width x new crop w) / (old crop w x new width).
    An uncalibrated source passes on its estimated scale (a 0.2 m wall drawn ESTIMATED_WALL_FRACTION of its width wide),
    so metres stay consistent across the re-crop before anyone calibrates; the record then says estimated (the UI shows
    the approximate sign), and so does one carried on from an estimated record. A measured source gives a measured
    record, as before."""
    if target["scale_m_per_px"]:
        return
    measured = bool(source["scale_m_per_px"]) and pg.calibration_of(source, None)["status"] == "measured"
    old = source["scale_m_per_px"] or pg.DEFAULT_WALL_THICKNESS_M / (pg.ESTIMATED_WALL_FRACTION * source["width_px"])
    oc, nc = _crop(source), _crop(target)
    scale = old * (source["width_px"] * nc["w"]) / (oc["w"] * target["width_px"])
    record: dict[str, Any] = {"method": "carried", "pairs": [], "residual_pct": None, "from_version": source["id"]}
    if not measured:
        record["status"] = "estimated"
    conn.execute("UPDATE plan_versions SET scale_m_per_px = ?, calibration_json = ? WHERE id = ?", (scale, json.dumps(record), target["id"]))


def carry(conn: sqlite3.Connection, target: sqlite3.Row, actor_id: str | None, now: str | None = None) -> str:
    """A new plan version starts from the published structure of the floor's published plan: the same drawing and crop
    copies it, a re-crop of the same page maps it through both crops, anything else starts empty (the editor offers a
    manual copy). A structure that is only a draft is not carried - publishing the new plan version would publish work
    in progress (R-T7-2); copy_from still offers it. The calibration belongs to the published plan version, not to its
    structure, so the same drawing takes it whatever the structure is. What the new version cannot keep is pruned in
    its own pixels and metres, after the rebase, as its publish will judge it (review of c6c35fc).
    Returns "copied" | "transformed" | "none"."""
    now = now or now_iso()
    source = conn.execute("SELECT * FROM plan_versions WHERE floor_id = ? AND status = 'published' AND id != ?", (target["floor_id"], target["id"])).fetchone()
    if source is None or not _same_drawing(source, target):
        return "none"
    carry_calibration(conn, source, target)  # before the structure checks; transform_crop below is metric-free
    row = published_row(conn, source["id"])
    if row is None or draft_row(conn, target["id"]) is not None:
        return "none"
    doc = load_doc(row)
    if pg.is_empty(doc):
        return "none"
    mode = "copied"
    if _crop(source) != _crop(target):  # parsed, so no crop and an explicit full crop are the same crop
        doc = pg.transform_crop(doc, _crop(source), _crop(target))
        mode = "transformed"
    target = conn.execute("SELECT * FROM plan_versions WHERE id = ?", (target["id"],)).fetchone()  # with the carried scale
    doc, _ = pg.prune_unfit(pg.rebase(doc, target, _asset(conn, target)))
    save_draft(conn, target, doc, 0, actor_id, now)
    return mode


def copy_candidates(conn: sqlite3.Connection, target: sqlite3.Row) -> list[dict[str, Any]]:
    out: list[dict[str, Any]] = []
    for v in conn.execute("SELECT * FROM plan_versions WHERE floor_id = ? AND id != ? ORDER BY created_at DESC", (target["floor_id"], target["id"])).fetchall():
        row = published_row(conn, v["id"]) or draft_row(conn, v["id"])
        if row is None:
            continue
        doc = load_doc(row)
        if pg.is_empty(doc):
            continue
        n = pg.counts(doc)
        out.append({"version_id": v["id"], "status": v["status"], "created_at": v["created_at"], "walls": n["walls"], "openings": n["openings"],
                    "same_drawing": _same_drawing(v, target)})
    return out[:5]


def copy_from(conn: sqlite3.Connection, target: sqlite3.Row, source: sqlite3.Row, actor_id: str | None, now: str | None = None) -> sqlite3.Row:
    """The editor's manual copy into a version without structure. The same drawing first takes the source's calibration
    when it has none (as carry does), so the copy is judged in the source's metric; a re-crop then maps the structure
    through both crops and prunes what the re-crop made unfit in the target's pixels and metres (as carry does). The
    same crop, and another drawing (with a note that nothing was aligned, and no calibration), are copied as they are:
    they transform nothing, so nothing is pruned - what does not fit stays, flagged by the validator in the editor
    (review of af47d01)."""
    now = now or now_iso()
    current, draft = working_doc(conn, target)
    if not pg.is_empty(current):
        raise conflict("not_empty", "לגרסה הזו כבר יש מבנה; מחק אותו לפני העתקה.")
    row = published_row(conn, source["id"]) or draft_row(conn, source["id"])
    source_doc = load_doc(row) if row is not None else None
    if source_doc is None or pg.is_empty(source_doc):
        raise conflict("nothing_to_copy", "לגרסה שנבחרה אין מבנה.")
    if not _same_drawing(source, target):
        doc = pg.rebase(source_doc, target, _asset(conn, target))
        unc = doc.get("uncertainty") or {"overall": 0.5, "notes": []}
        doc["uncertainty"] = {**unc, "notes": [*unc.get("notes", []), "המבנה הועתק מגרסה עם שרטוט אחר, בלי יישור — בדוק מיקומים."]}
    else:
        if not target["scale_m_per_px"]:  # after the refusals above: a refused copy (409, committed for its audit) changes nothing
            carry_calibration(conn, source, target)
            target = conn.execute("SELECT * FROM plan_versions WHERE id = ?", (target["id"],)).fetchone()
        if _crop(source) != _crop(target):
            doc, _ = pg.prune_unfit(pg.rebase(pg.transform_crop(source_doc, _crop(source), _crop(target)), target, _asset(conn, target)))
        else:
            doc = pg.rebase(source_doc, target, _asset(conn, target))
    return save_draft(conn, target, doc, draft["revision"] if draft is not None else 0, actor_id, now)


def anchor_positions(conn: sqlite3.Connection, floor_id: str) -> dict[str, dict[str, float]]:
    """The live anchors of a floor keyed "<type>:<id>": what a bound object takes its position and rotation from."""
    return {f"{r['resource_type']}:{r['resource_id']}": {"x": r["x"], "y": r["y"], "rotation": r["rotation_degrees"] or 0}
            for r in conn.execute("SELECT resource_type, resource_id, x, y, rotation_degrees FROM map_anchors WHERE floor_id = ? AND effective_to IS NULL", (floor_id,)).fetchall()}
