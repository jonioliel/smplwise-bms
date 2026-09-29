"""Plan Studio persistence (T084, CR-003): the structure document of each plan version in plan_geometry - one draft
(the editor's autosave target), at most one published row, and the archived history the historical map reads. A
document is stored as canonical JSON with its SHA-256; the map bundle carries only (id, hash). The server rebases every
document on its version, so ids, size and calibration can never be changed by a client."""
from __future__ import annotations

import copy
import hashlib
import json
import math
import sqlite3
from typing import Any, Callable

from ..db import new_id, now_iso
from ..errors import ApiError, conflict
from . import plan_catalog
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


def _prepare(conn: sqlite3.Connection, version: sqlite3.Row, doc: dict[str, Any]) -> dict[str, Any]:
    """What every document goes through on its way into the table and out to the editor: the rebase on its version
    (ids, size, calibration), the normalization (circuit power, the connectors derived from objects that connect
    levels), dropping the read-only `far` of cross-floor connectors (attach_far computes it on every read, review M4)
    and the refresh of bound bodies from the floor's live anchors (design 2a, rule 1)."""
    doc = pg.rebase(doc, version, _asset(conn, version))
    doc = strip_far(pg.normalize(doc, plan_catalog.item_index(conn)))
    return pg.apply_anchor_positions(doc, anchor_positions(conn, version["floor_id"]))


def working_doc(conn: sqlite3.Connection, version: sqlite3.Row) -> tuple[dict[str, Any], sqlite3.Row | None]:
    """The document the editor starts from: the stored draft, else a copy of the published document, else a new one -
    prepared, so bodies sit on their anchors even when the anchor moved after the last save."""
    d = draft_row(conn, version["id"])
    if d is not None:
        return _prepare(conn, version, load_doc(d)), d
    p = published_row(conn, version["id"])
    return (_prepare(conn, version, load_doc(p)) if p is not None else pg.new_document(version, _asset(conn, version))), None


def save_draft(conn: sqlite3.Connection, version: sqlite3.Row, doc: dict[str, Any], base_revision: int, actor_id: str | None, now: str | None = None,
               *, can_edit: Callable[[str], bool] | None = None, synced: list[str] | None = None) -> sqlite3.Row:
    """Store the editor's draft. With `can_edit` (the PUT route: map.edit per floor) a change of a cross-floor stair's
    model also reaches its twin on the other floors the person may edit (_sync_twins; their ids go to `synced` for the
    audit); internal saves pass nothing and never write another floor."""
    now = now or now_iso()
    doc = _prepare(conn, version, doc)
    d = draft_row(conn, version["id"])
    current = d["revision"] if d is not None else 0
    if base_revision != current:
        raise conflict("stale_revision", "טיוטת המבנה השתנתה בינתיים; טען מחדש את העורך.", current_revision=current, sent_revision=base_revision)
    if d is None:
        row = _insert(conn, version, "draft", doc, actor_id, now)
        prev = None
    elif doc_hash(doc) == d["doc_hash"]:
        return d
    else:
        prev = load_doc(d)
        row = _replace_draft(conn, version, doc, actor_id, now)
    if can_edit is not None:
        if prev is None:
            p = published_row(conn, version["id"])
            prev = load_doc(p) if p is not None else None
        _sync_twins(conn, version, prev, doc, can_edit, actor_id, now, synced)
    return row


def pending_doc(conn: sqlite3.Connection, version: sqlite3.Row) -> dict[str, Any] | None:
    """The draft that publishing the version would publish, or None when there is nothing new. 422 when invalid."""
    d = draft_row(conn, version["id"])
    if d is None:
        return None
    doc = _prepare(conn, version, load_doc(d))
    p = published_row(conn, version["id"])
    if p is not None and p["doc_hash"] == doc_hash(doc):
        return None
    if p is None and pg.is_empty(doc):
        return None
    errors = [i for i in pg.validate(doc, plan_catalog.item_index(conn)) if i["severity"] == "error"]
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
    doc = _prepare(conn, version, load_doc(src))
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
    doc = _prepare(conn, target, load_doc(p))
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


def unbind_anchor(conn: sqlite3.Connection, floor_id: str, resource_type: str, resource_id: str, actor_id: str | None, now: str | None = None,
                  last: dict[str, Any] | None = None) -> int:
    """Deleting an anchor leaves its bodies where they are, unbound: every draft of the floor loses the anchor_ref and
    keeps the anchor's last position (`last` = {x, y, rotation}, read by the delete route before the tombstone), with
    revision + 1 so an open editor sees a conflict and reloads instead of writing the reference back. Published
    documents are history and keep the reference; their bodies draw at the position last refreshed. Returns the
    drafts changed."""
    now = now or now_iso()
    changed = 0
    for d in conn.execute("SELECT * FROM plan_geometry WHERE floor_id = ? AND status = 'draft'", (floor_id,)).fetchall():
        doc = load_doc(d)
        hit = False
        for o in doc.get("objects") or []:
            ref = o.get("anchor_ref") if isinstance(o, dict) else None
            if isinstance(ref, dict) and ref.get("resource_type") == resource_type and ref.get("resource_id") == resource_id:
                o["anchor_ref"] = None
                if last is not None:
                    o["position"] = [round(float(last["x"]), 6), round(float(last["y"]), 6)]
                    o["rotation_deg"] = round(float(last.get("rotation") or 0), 3)
                hit = True
        if hit:
            conn.execute("UPDATE plan_geometry SET doc_json = ?, doc_hash = ?, revision = revision + 1, updated_at = ? WHERE id = ?",
                         (pg.canonical_json(doc), doc_hash(doc), now, d["id"]))
            changed += 1
    return changed


def anchor_issues(conn: sqlite3.Connection, floor_id: str, doc: dict[str, Any]) -> list[dict[str, Any]]:
    """A warning per bound object whose anchor is not on the floor (the anchor was deleted, or the reference was typed):
    the body stays where it is; nothing blocks."""
    have = anchor_positions(conn, floor_id)
    out: list[dict[str, Any]] = []
    for o in doc.get("objects") or []:
        ref = o.get("anchor_ref") if isinstance(o, dict) else None
        if isinstance(ref, dict) and f"{ref.get('resource_type')}:{ref.get('resource_id')}" not in have:
            out.append({"code": "anchor_missing", "severity": "warning", "structural": False, "id": o.get("id"), "path": "objects",
                        "message": "העוגן שהעצם מייצג לא קיים בקומה; העצם נשאר במקומו, לא מקושר."})
    return out


def _default_level(doc: dict[str, Any]) -> str:
    return next((lv["id"] for lv in doc.get("levels") or [] if isinstance(lv, dict) and lv.get("is_default")), pg.DEFAULT_LEVEL_ID)


def editor_version(conn: sqlite3.Connection, floor_id: str) -> sqlite3.Row | None:
    """The plan version the floor's editor works on: its latest draft version, else its published one."""
    return conn.execute("SELECT * FROM plan_versions WHERE floor_id = ? AND status IN ('draft', 'published') "
                        "ORDER BY CASE status WHEN 'draft' THEN 0 ELSE 1 END, created_at DESC LIMIT 1", (floor_id,)).fetchone()


def _published_version(conn: sqlite3.Connection, floor_id: str) -> sqlite3.Row | None:
    return conn.execute("SELECT * FROM plan_versions WHERE floor_id = ? AND status = 'published' ORDER BY created_at DESC LIMIT 1", (floor_id,)).fetchone()


def _raw_row(conn: sqlite3.Connection, version: sqlite3.Row, published: bool) -> sqlite3.Row | None:
    return published_row(conn, version["id"]) if published else (draft_row(conn, version["id"]) or published_row(conn, version["id"]))


def _raw_editor_doc(conn: sqlite3.Connection, version: sqlite3.Row, published: bool = False) -> dict[str, Any]:
    """The stored document of the version (its draft, else its published one; `published`: the published one only), else
    a new one - WITHOUT _prepare: what the other-floor lookups read, so reading one floor never prepares another."""
    row = _raw_row(conn, version, published)
    return load_doc(row) if row is not None else pg.new_document(version, _asset(conn, version))


def floor_levels(conn: sqlite3.Connection, floor_id: str) -> tuple[sqlite3.Row | None, list[dict[str, Any]]]:
    """The editor version of a floor and the levels of its document ([] without a plan)."""
    v = editor_version(conn, floor_id)
    if v is None:
        return None, []
    return v, [lv for lv in _raw_editor_doc(conn, v).get("levels") or [] if isinstance(lv, dict) and isinstance(lv.get("id"), str)]


def _cross_other(c: Any, floor_id: str) -> str | None:
    """The one other floor of a drawn connector between this floor and another, or None (same-floor, derived, or a
    floor_ids list that does not name this floor and exactly one other)."""
    if not isinstance(c, dict) or pg._is_derived_connector(c) or not isinstance(c.get("floor_ids"), list):
        return None
    others = [f for f in c["floor_ids"] if isinstance(f, str) and f != floor_id]
    return others[0] if len(others) == 1 and floor_id in c["floor_ids"] else None


def strip_far(doc: dict[str, Any]) -> dict[str, Any]:
    """`far` is computed on every read (attach_far), never stored: a client copy loses it here, so it is not part of the
    stored document or its hash - renaming another floor never makes this one's draft pending (review M4)."""
    for c in doc.get("connectors") or []:
        if isinstance(c, dict):
            c.pop("far", None)
    return doc


class FarContext:
    """What one request knows about the other floors its documents' connectors reach: each floor row, its plan version
    and the levels, connectors and floor height of its document - one query and one parse per floor per request, shared
    by attach_far and link_issues (review M5). `published`: read the other floors' published documents (the map, the
    export), else their editor documents (the editor). `can_read(floor_id)`: whether the reader may see that floor's
    names (review L12); None = yes."""

    def __init__(self, conn: sqlite3.Connection, *, published: bool = False, can_read: Callable[[str], bool] | None = None) -> None:
        self.conn = conn
        self.published = published
        self.can_read = can_read
        self._floors: dict[str, dict[str, Any]] = {}
        self._buildings: dict[str, list[sqlite3.Row]] = {}
        self._heights: dict[str, float] = {}

    def floor(self, floor_id: str) -> dict[str, Any]:
        hit = self._floors.get(floor_id)
        if hit is not None:
            return hit
        row = self.conn.execute("SELECT id, name, level, building_id, deleted_at FROM floors WHERE id = ?", (floor_id,)).fetchone()
        info: dict[str, Any] = {"row": row, "gone": row is None or row["deleted_at"] is not None, "version": None, "levels": {}, "twins": {}, "height": pg.DEFAULT_FLOOR_HEIGHT_M}
        if not info["gone"]:
            v = (_published_version(self.conn, floor_id) if self.published else None) or editor_version(self.conn, floor_id)
            if v is not None:
                doc = _raw_editor_doc(self.conn, v, self.published and v["status"] == "published")
                info["version"] = v
                info["levels"] = {lv["id"]: lv for lv in doc.get("levels") or [] if isinstance(lv, dict) and isinstance(lv.get("id"), str)}
                info["twins"] = {c["id"]: c for c in doc.get("connectors") or [] if isinstance(c, dict) and isinstance(c.get("id"), str)}
                info["height"] = pg.floor_height(doc)
        self._heights[floor_id] = info["height"]
        self._floors[floor_id] = info
        return info

    def readable(self, floor_id: str) -> bool:
        return self.can_read is None or bool(self.can_read(floor_id))

    def _height(self, floor_id: str) -> float:
        if floor_id not in self._heights:
            v = (_published_version(self.conn, floor_id) if self.published else None) or editor_version(self.conn, floor_id)
            row = _raw_row(self.conn, v, self.published and v["status"] == "published") if v is not None else None
            raw = self.conn.execute("SELECT json_extract(doc_json, '$.floor_height_m') FROM plan_geometry WHERE id = ?", (row["id"],)).fetchone()[0] if row is not None else None
            self._heights[floor_id] = pg.floor_height({"floor_height_m": raw})
        return self._heights[floor_id]

    def datum(self, me: sqlite3.Row, own_height: float, far: sqlite3.Row) -> float:
        """How far the other floor's datum (its default level's floor) is above this floor's, in metres: the floor
        heights of the building's floors from this one up to the other (one per floor number; this floor's from the
        document at hand), negative downwards (review M1, owner's "גובה קומה")."""
        rows = self._buildings.get(me["building_id"])
        if rows is None:
            rows = self.conn.execute("SELECT id, level FROM floors WHERE building_id = ? AND deleted_at IS NULL ORDER BY level, sort_order, id", (me["building_id"],)).fetchall()
            self._buildings[me["building_id"]] = rows
        heights: dict[int, float] = {me["level"]: own_height}
        for r in rows:
            if r["level"] not in heights:
                heights[r["level"]] = self._height(r["id"])
        a, b = me["level"], far["level"]
        if b > a:
            return round(sum(h for lv, h in heights.items() if a <= lv < b), 4)
        if b < a:
            return round(-sum(h for lv, h in heights.items() if b <= lv < a), 4)
        return 0.0


def attach_far(conn: sqlite3.Connection, floor_id: str, doc: dict[str, Any], ctx: FarContext | None = None) -> dict[str, Any]:
    """A copy of the document where every connector to another floor carries `far`: that floor's name, the name and
    elevation of the level it reaches there (level_to is a level of THAT floor), the other floor's datum above this one
    (floor heights) and up / down by the floors' numbers - what the label "↑ קומה 1 · גלריה" and the 3D rise read.
    Computed on every read (draft, published, export), never stored (review M4); a reader who may not read the other
    floor gets the neutral "קומה אחרת" and no level name (review L12); a deleted floor gives {missing: true}."""
    connectors = doc.get("connectors")
    if not isinstance(connectors, list) or not any(_cross_other(c, floor_id) for c in connectors):
        return doc
    ctx = ctx or FarContext(conn)
    me = conn.execute("SELECT id, name, level, building_id FROM floors WHERE id = ?", (floor_id,)).fetchone()
    own_height = pg.floor_height(doc)
    out = dict(doc)
    out["connectors"] = []
    for c in connectors:
        other = _cross_other(c, floor_id)
        if other is None:
            out["connectors"].append(c)
            continue
        c2 = {k: v for k, v in c.items() if k != "far"}
        info = ctx.floor(other)
        if info["gone"]:
            c2["far"] = {"floor_id": other, "floor_name": None, "level_name": None, "direction": None, "missing": True}
        else:
            f = info["row"]
            lv = info["levels"].get(c.get("level_to")) if isinstance(c.get("level_to"), str) else None
            readable = ctx.readable(other)
            direction = None if me is None or f["level"] == me["level"] else ("up" if f["level"] > me["level"] else "down")
            elev = lv.get("elevation_m") if lv else None
            c2["far"] = {"floor_id": other, "floor_name": f["name"] if readable else "קומה אחרת", "level_name": str(lv.get("name") or lv["id"]) if lv and readable else None,
                         "direction": direction, "level_elevation_m": float(elev) if pg._num(elev) else 0.0,
                         "datum_m": ctx.datum(me, own_height, f) if me is not None and me["building_id"] == f["building_id"] else None}
        out["connectors"].append(c2)
    return out


def link_issues(conn: sqlite3.Connection, floor_id: str, doc: dict[str, Any], ctx: FarContext | None = None) -> list[dict[str, Any]]:
    """Warnings (never errors: publishing never fails on a link) for the connectors to another floor: the other floor
    was deleted or has no plan, the level it reaches there is gone, the twin is missing there (or a different item holds
    its id), or this twin was placed at the centre of the plan and still waits to be placed here (needs_placement)."""
    out: list[dict[str, Any]] = []

    def warn(cid: Any, code: str, message: str) -> None:
        out.append({"code": code, "severity": "warning", "structural": False, "id": cid, "path": "connectors", "message": message})

    for c in doc.get("connectors") or []:
        if not isinstance(c, dict) or pg._is_derived_connector(c) or not c.get("floor_ids"):
            continue
        cid = c.get("id")
        other = _cross_other(c, floor_id)
        if other is None:
            warn(cid, "connector_floors", "המחבר לא מקשר את הקומה הזו לקומה אחת אחרת; קשר אותו מחדש.")
            continue
        ctx = ctx or FarContext(conn)
        info = ctx.floor(other)
        if info["gone"]:
            warn(cid, "connector_far_missing", "הקומה השנייה של המחבר נמחקה; מחק את המחבר או קשר אותו לקומה אחרת.")
            continue
        if info["version"] is None:
            warn(cid, "connector_far_missing", "לקומה השנייה של המחבר אין תוכנית; קשר אותו מחדש אחרי שתעלה תוכנית.")
            continue
        if isinstance(c.get("level_to"), str) and c["level_to"] not in info["levels"]:
            warn(cid, "connector_far_level", "המפלס שהמחבר מגיע אליו בקומה השנייה לא קיים עוד; בחר מפלס יעד מחדש.")
        twin = info["twins"].get(cid)
        if twin is None or floor_id not in (twin.get("floor_ids") or []):
            warn(cid, "connector_twin_missing", "בקומה השנייה אין את המחבר התאום; קשר אותו מחדש או מחק אותו.")
        if c.get("needs_placement"):
            warn(cid, "connector_placement", "מקם את המדרגות בקומה הזו: הן נוצרו במרכז התוכנית כי לשתי הקומות אין מסגרת משותפת.")
    return out


def frame_of(conn: sqlite3.Connection, a: sqlite3.Row, b: sqlite3.Row) -> str | None:
    """Whether a point in normalized plan space means the same place on both versions: "sheet" - the same sheet (same
    file, page, rotation and crop); "size" - two calibrated plans that cover the same metres (width and height within
    2 %), which is likely but not certain to be one frame (the editor asks to check the place, review L9); None - no
    shared origin: a twin goes to the centre instead."""
    ra, rb = _asset(conn, a), _asset(conn, b)
    if ra is not None and rb is not None and ra["sha256"] == rb["sha256"] and (a["page"], a["rotation"]) == (b["page"], b["rotation"]) and _crop(a) == _crop(b):
        return "sheet"
    sa, sb = a["scale_m_per_px"], b["scale_m_per_px"]
    if not sa or not sb:
        return None
    wa, ha = a["width_px"] * sa, a["height_px"] * sa
    wb, hb = b["width_px"] * sb, b["height_px"] * sb
    return "size" if abs(wa - wb) <= 0.02 * max(wa, wb) and abs(ha - hb) <= 0.02 * max(ha, hb) else None


def same_frame(conn: sqlite3.Connection, a: sqlite3.Row, b: sqlite3.Row) -> bool:
    return frame_of(conn, a, b) is not None


def _turn_of(points: list[Any]) -> str | None:
    """The side the walking line turns to at its first corner (plan y points down: a positive cross product turns right)."""
    if len(points) < 3:
        return None
    (x0, y0), (x1, y1), (x2, y2) = points[0], points[1], points[2]
    cross = (x1 - x0) * (y2 - y1) - (y1 - y0) * (x2 - x1)
    return None if abs(cross) < 1e-12 else ("right" if cross > 0 else "left")


def _centred(polyline: list[Any], sdoc: dict[str, Any], tdoc: dict[str, Any]) -> list[list[float]]:
    """The polyline moved to the centre of the other plan, kept at its size in metres (each plan's effective scale)."""
    ss, _ = pg.effective_scale(sdoc)
    ts, _ = pg.effective_scale(tdoc)
    sw, sh = sdoc["dimensions"]["width_px"] * ss, sdoc["dimensions"]["height_px"] * ss
    tw, th = tdoc["dimensions"]["width_px"] * ts, tdoc["dimensions"]["height_px"] * ts
    pts = [(float(p[0]) * sw, float(p[1]) * sh) for p in polyline]
    cx = (min(p[0] for p in pts) + max(p[0] for p in pts)) / 2
    cy = (min(p[1] for p in pts) + max(p[1] for p in pts)) / 2
    return [[round(min(1.0, max(0.0, (x - cx) / tw + 0.5)), 6) + 0.0, round(min(1.0, max(0.0, (y - cy) / th + 0.5)), 6) + 0.0] for x, y in pts]


# ---------------------------------------------------------------- the stairs model walked back (review M3)

STAIR_GOING_M = 0.28
STAIR_WELL_M = 0.1
_MODEL_KEYS = ("kind", "width_m", "shape", "turn", "flights", "landing_depth_m")


def _flip(turn: Any) -> Any:
    return {"left": "right", "right": "left"}.get(turn, turn)


def twin_model(src: dict[str, Any]) -> dict[str, Any]:
    """The stairs model the twin of `src` must carry: the same kind, width, shape and landing, the flights reversed and
    an L or a U turning to the other side (walked back, a right turn becomes a left one)."""
    flights = src.get("flights")
    return {"kind": src.get("kind"), "width_m": src.get("width_m"), "shape": src.get("shape"), "landing_depth_m": src.get("landing_depth_m"),
            "flights": [dict(f) for f in reversed(flights)] if isinstance(flights, list) else flights,
            "turn": _flip(src.get("turn")) if src.get("shape") in ("l", "u") else src.get("turn")}


def stair_path(shape: str, start: Any, direction: tuple[float, float], width_m: float, runs_m: list[float], landing_m: float, turn: str,
               width: float, height: float, scale: float) -> list[list[float]]:
    """The walking line of a straight, L or U stair from its start (normalized), the first flight's direction (plan
    pixels), width, flight runs, landing depth and turn - the backend twin of geometry.ts stairPath."""
    k = 1 / scale
    n = math.hypot(*direction)
    f = (direction[0] / n, direction[1] / n) if n > 1e-12 else (0.0, -1.0)
    r = (-f[1], f[0])
    s = (-r[0], -r[1]) if turn == "left" else r
    p0 = (float(start[0]) * width, float(start[1]) * height)
    r1 = (runs_m[0] if runs_m else STAIR_GOING_M) * k
    r2 = (runs_m[1] if len(runs_m) > 1 else 0.0) * k
    d = landing_m * k
    w = width_m * k

    def add(p: tuple[float, float], v: tuple[float, float], m: float) -> tuple[float, float]:
        return (p[0] + v[0] * m, p[1] + v[1] * m)

    if shape == "u":
        p1 = add(p0, f, r1 + d / 2)
        p2 = add(p1, s, w + STAIR_WELL_M * k)
        pts = [p0, p1, p2, add(p2, f, -(d / 2 + r2))]
    elif shape == "l":
        p1 = add(p0, f, r1 + d / 2)
        pts = [p0, p1, add(p1, s, w / 2 + r2)]
    else:
        pts = [p0, add(p0, f, r1 + (d + r2 if len(runs_m) > 1 else 0.0))]
    return [[round(min(1.0, max(0.0, x / width)), 6) + 0.0, round(min(1.0, max(0.0, y / height)), 6) + 0.0] for x, y in pts]


def _going(c: dict[str, Any], width: float, height: float, scale: float) -> float:
    """The tread depth of a drawn stair (its first flight's run over its steps, 0.15..0.5 m), as geometry.ts stairGoing."""
    flights = c.get("flights") if isinstance(c.get("flights"), list) else []
    n1 = flights[0].get("steps") if flights and isinstance(flights[0], dict) else None
    pts = [(float(p[0]) * width, float(p[1]) * height) for p in c.get("polyline") or []]
    if not isinstance(n1, int) or n1 < 1 or len(pts) < 2:
        return STAIR_GOING_M
    d = float(c.get("landing_depth_m") or c.get("width_m") or 1.0)
    seg = math.hypot(pts[1][0] - pts[0][0], pts[1][1] - pts[0][1]) * scale
    shape = c.get("shape") or "straight"
    if shape in ("l", "u"):
        run = seg - d / 2
    elif len(flights) > 1 and isinstance(flights[1], dict) and isinstance(flights[1].get("steps"), int):
        run = (seg - d) * n1 / (n1 + flights[1]["steps"])
    else:
        run = seg
    return min(0.5, max(0.15, run / n1))


def apply_twin_model(twin: dict[str, Any], src: dict[str, Any], tdoc: dict[str, Any]) -> dict[str, Any]:
    """The twin with the source's stairs model walked back (twin_model); when the geometry of the model changed, its
    walking line is regenerated from the twin's OWN start and first direction with its own tread depth (the twin keeps
    its place on its floor; review M3). Unchanged -> the same dict."""
    want = twin_model(src)
    if all(twin.get(k) == want[k] for k in _MODEL_KEYS):
        return twin
    out = {**twin, **want}
    reshape = any(twin.get(k) != want[k] for k in ("width_m", "shape", "turn", "flights", "landing_depth_m"))
    flights = out.get("flights") if isinstance(out.get("flights"), list) else []
    if reshape and (out.get("shape") or flights) and len(twin.get("polyline") or []) >= 2:
        dims = tdoc.get("dimensions") or {}
        w, h = float(dims.get("width_px") or 1), float(dims.get("height_px") or 1)
        scale, _ = pg.effective_scale(tdoc)
        going = _going(twin, w, h, scale)
        (x0, y0), (x1, y1) = twin["polyline"][0], twin["polyline"][1]
        shape = out.get("shape") or "straight"
        steps = [int(f.get("steps") or 1) for f in flights if isinstance(f, dict)] or [max(1, round(math.hypot((x1 - x0) * w, (y1 - y0) * h) * scale / going))]
        width_m = float(out.get("width_m") or 1.0)
        landing = float(out.get("landing_depth_m") or width_m)
        out["polyline"] = stair_path(shape, (x0, y0), ((x1 - x0) * w, (y1 - y0) * h), width_m, [n * going for n in steps], landing,
                                     out.get("turn") if out.get("turn") in ("left", "right") else "right", w, h, scale)
    return out


def _sync_twins(conn: sqlite3.Connection, version: sqlite3.Row, prev: dict[str, Any] | None, doc: dict[str, Any], can_edit: Callable[[str], bool],
                actor_id: str | None, now: str, synced: list[str] | None) -> None:
    """A change of a cross-floor stair's model (kind, width, shape, turn, flights, landing) reaches its twin on the
    other floor's draft - only on floors the person may edit, never recursively, and only when the model changed since
    the stored draft (a move or an unrelated edit reads no other floor)."""
    before = {c.get("id"): c for c in (prev or {}).get("connectors") or [] if isinstance(c, dict)}
    for c in doc.get("connectors") or []:
        other = _cross_other(c, version["floor_id"])
        old = before.get(c.get("id")) if other else None
        if other is None or old is None or all(old.get(k) == c.get(k) for k in _MODEL_KEYS) or not can_edit(other):
            continue
        v = editor_version(conn, other)
        if v is None:
            continue
        tdoc, tdraft = working_doc(conn, v)
        twins = tdoc.get("connectors") or []
        i = next((k for k, x in enumerate(twins) if isinstance(x, dict) and x.get("id") == c["id"] and version["floor_id"] in (x.get("floor_ids") or [])), None)
        if i is None:
            continue
        new = apply_twin_model(twins[i], c, tdoc)
        if new is twins[i]:
            continue
        tdoc["connectors"] = [*twins[:i], new, *twins[i + 1:]]
        save_draft(conn, v, tdoc, tdraft["revision"] if tdraft is not None else 0, actor_id, now)
        if synced is not None:
            synced.append(other)


def _twin(item: dict[str, Any], level_from: str, floors: list[str]) -> dict[str, Any]:
    """The connector as the other floor sees it: the same stairs walked from that floor - the walking line and the
    flights reversed (so every twin's polyline starts on its own level; its footprint is the original's), level_from =
    the level it lands on there, level_to = the level it leaves here. An L or a U turns to the other side walked back
    (_turn_of re-reads it from the reversed path)."""
    twin = copy.deepcopy(item)
    twin.pop("far", None)
    twin.pop("needs_placement", None)
    twin["polyline"] = list(reversed(twin.get("polyline") or []))
    if isinstance(twin.get("flights"), list):
        twin["flights"] = list(reversed(twin["flights"]))
    if twin.get("shape") in ("l", "u"):
        twin["turn"] = _turn_of(twin["polyline"]) or _flip(twin.get("turn"))
    twin.update({"level_from": level_from, "level_to": item.get("level_from"), "floor_ids": floors, "source": "manual", "object_id": None})
    return twin


def remove_twin(conn: sqlite3.Connection, floor_id: str, connector_id: str, source_floor_id: str, actor_id: str | None, now: str | None = None) -> bool:
    """The twin of a cross-floor connector leaves the other floor's editor draft: only a connector of that id that names
    the source floor among its floors (never an unrelated item). Returns whether anything was removed."""
    now = now or now_iso()
    v = editor_version(conn, floor_id)
    if v is None:
        return False
    tdoc, tdraft = working_doc(conn, v)
    before = tdoc.get("connectors") or []
    keep = [c for c in before if not (isinstance(c, dict) and c.get("id") == connector_id and source_floor_id in (c.get("floor_ids") or []))]
    if len(keep) == len(before):
        return False
    tdoc["connectors"] = keep
    save_draft(conn, v, tdoc, tdraft["revision"] if tdraft is not None else 0, actor_id, now)
    return True


def connector_floor_ids(conn: sqlite3.Connection, source: sqlite3.Row, connector_id: str) -> list[str]:
    """The floors a connector of the version's draft names now (what the link route must authorize before it changes
    them); [] when there is no such connector."""
    doc, _ = working_doc(conn, source)
    item = next((c for c in doc.get("connectors") or [] if isinstance(c, dict) and c.get("id") == connector_id), None)
    return [f for f in (item or {}).get("floor_ids") or [] if isinstance(f, str)]


def link_connector(conn: sqlite3.Connection, source: sqlite3.Row, connector_id: str, target_floor_id: str, actor_id: str | None, now: str | None = None,
                   level_to: str | None = None, *, replace: bool = False) -> dict[str, Any]:
    """Stairs or an elevator between two floors exist in both floors' documents under the same id (design section 8,
    for T064). The source's connector gets both floor ids and level_to = the level it reaches on the other floor (the
    one chosen, else that floor's default level); the target floor's editor version (its latest draft, else its
    published plan) gets the twin on its draft (_twin: walked from there). A twin already there keeps its own position
    (moving one twin never moves the other), takes the new levels and the stairs model walked back (apply_twin_model);
    a new twin sits at the same plan coordinates when both plans share a frame (frame_of), else at the centre of the
    other plan with needs_placement. Linking twice changes nothing there.
    Moving the link to another floor (review B1): only from the floor the stairs were linked from (origin_floor_id;
    a twin is refused with 409 "קשר מחדש מהקומה המקורית"), only when `replace` confirms it (409 relink_confirm
    otherwise), and the old twin leaves the old floor - the route authorizes map.edit on every floor involved and audits
    each removal (removed_floors)."""
    now = now or now_iso()
    doc, draft = working_doc(conn, source)
    item = next((c for c in doc.get("connectors") or [] if isinstance(c, dict) and c.get("id") == connector_id), None)
    if item is None:
        raise ApiError(404, "not_found", "המחבר לא נמצא בטיוטה.")
    if item.get("object_id") or pg._is_derived_connector(item):
        raise conflict("derived_connector", "מחבר שנגזר מעצם (טריבונה) מחבר מפלסים באותה קומה; קשר לקומה מדרגות או מעלית שציירת.")
    previous = [f for f in item.get("floor_ids") or [] if isinstance(f, str) and f not in (source["floor_id"], target_floor_id)]
    origin = item.get("origin_floor_id") if isinstance(item.get("origin_floor_id"), str) else None
    if previous and origin and origin != source["floor_id"]:
        raise conflict("relink_from_origin", "המחבר הזה הוא התאום של מדרגות מקומה אחרת; קשר מחדש מהקומה המקורית.", origin_floor_id=origin)
    if previous and not replace:
        raise conflict("relink_confirm", "המחבר מקושר כבר לקומה אחרת; קישור לקומה חדשה ימחק אותו שם. אשר כדי להמשיך.", floors=previous)
    target_version = editor_version(conn, target_floor_id)
    if target_version is None:
        raise conflict("no_plan", "לקומה השנייה אין תוכנית; העלה תוכנית לפני שמקשרים אליה.")
    tdoc, tdraft = working_doc(conn, target_version)
    level_to = level_to or _default_level(tdoc)
    if level_to not in {lv.get("id") for lv in tdoc.get("levels") or [] if isinstance(lv, dict)}:
        raise ApiError(422, "validation", "המפלס שנבחר לא קיים בקומה השנייה.", details={"level_to": level_to})
    existing = next((c for c in tdoc.get("connectors") or [] if isinstance(c, dict) and c.get("id") == connector_id), None)
    if existing is not None and source["floor_id"] not in (existing.get("floor_ids") or []):
        raise conflict("twin_id_taken", "בקומה השנייה יש כבר פריט אחר עם אותו מזהה; צייר את המדרגות מחדש.")
    floors = sorted({source["floor_id"], target_floor_id})
    origin = source["floor_id"] if previous or not origin else origin
    item["floor_ids"] = floors
    item["level_to"] = level_to
    item["origin_floor_id"] = origin
    saved = save_draft(conn, source, doc, draft["revision"] if draft is not None else 0, actor_id, now)
    removed = [old for old in previous if remove_twin(conn, old, connector_id, source["floor_id"], actor_id, now)]
    frame = frame_of(conn, source, target_version)
    if existing is not None:
        base = {**copy.deepcopy(existing), "level_from": level_to, "level_to": item["level_from"], "floor_ids": floors, "origin_floor_id": origin}
        base.pop("far", None)
        twin = apply_twin_model(base, item, tdoc)
        placement = "kept"
    else:
        twin = {**_twin(item, level_to, floors), "origin_floor_id": origin}
        if frame is not None:
            placement = "aligned"
        else:
            twin["polyline"] = _centred(twin["polyline"], doc, tdoc)
            twin["needs_placement"] = True
            placement = "centred"
    if existing is not None and twin == {k: v for k, v in existing.items() if k != "far"}:
        row = tdraft
    else:
        tdoc["connectors"] = [*[c for c in tdoc.get("connectors") or [] if not (isinstance(c, dict) and c.get("id") == connector_id)], twin]
        row = save_draft(conn, target_version, tdoc, tdraft["revision"] if tdraft is not None else 0, actor_id, now)
    mine = next(c for c in load_doc(saved)["connectors"] if c.get("id") == connector_id)
    return {"connector": mine, "removed_floors": removed,
            "target": {"floor_id": target_floor_id, "version_id": target_version["id"], "revision": row["revision"] if row is not None else 0,
                       "level_id": level_to, "placement": placement, "frame": frame}}


def link_targets(conn: sqlite3.Connection, version: sqlite3.Row, can_edit: Callable[[str], bool]) -> list[dict[str, Any]]:
    """The other floors of the version's building a connector can be linked to (can_edit(floor_id): map.edit on it),
    each with its levels (the "מחבר אל" picker lists "קומה 1 · גלריה") and whether it shares this plan's frame."""
    out: list[dict[str, Any]] = []
    rows = conn.execute("SELECT f.* FROM floors f JOIN floors me ON me.building_id = f.building_id WHERE me.id = ? AND f.id != ? AND f.deleted_at IS NULL "
                        "ORDER BY f.level, f.sort_order, f.name", (version["floor_id"], version["floor_id"])).fetchall()
    for f in rows:
        if not can_edit(f["id"]):
            continue
        v, levels = floor_levels(conn, f["id"])
        frame = frame_of(conn, version, v) if v is not None else None
        out.append({"floor_id": f["id"], "name": f["name"], "level": f["level"], "version_id": v["id"] if v is not None else None,
                    "levels": [{"id": lv["id"], "name": str(lv.get("name") or lv["id"]), "elevation_m": lv.get("elevation_m"), "is_default": bool(lv.get("is_default"))} for lv in levels],
                    "same_frame": frame is not None, "frame": frame})
    return out


# ---------------------------------------------------------------- what the bundle, the scope and the search read (phase 2)

_SWITCH_CACHE: dict[str, list[str]] = {}
_OBJECT_CACHE: dict[str, list[dict[str, Any]]] = {}
_CACHE_MAX = 256


def levels_of(row: sqlite3.Row | None) -> list[dict[str, Any]]:
    """The levels of the document a bundle reference names (the live map offers the same level filter as the editor)."""
    if row is None:
        return []
    levels = load_doc(row).get("levels")
    return [lv for lv in levels if isinstance(lv, dict)] if isinstance(levels, list) else []


def circuits_of(row: sqlite3.Row | None) -> list[dict[str, Any]]:
    """A circuit whose switch fails the switch/light entity id shape is dropped, not merely hidden: a draft is never
    validated against Home Assistant's catalogue (the shape check is an error-severity but non-structural issue, so it
    blocks publish but not saving the draft), so a draft could otherwise name any entity id and the bundle would carry
    that entity's state to a floor editor with no placement and no entity.state.read (review R1)."""
    if row is None:
        return []
    circuits = load_doc(row).get("circuits")
    return [c for c in circuits if isinstance(c, dict) and isinstance(c.get("id"), str) and isinstance(c.get("switch_entity_id"), str) and pg.SWITCH_RE.match(c["switch_entity_id"])] if isinstance(circuits, list) else []


def _cached(conn: sqlite3.Connection, cache: dict[str, Any], row: sqlite3.Row, build) -> Any:
    hit = cache.get(row["doc_hash"])
    if hit is None:
        doc_json = conn.execute("SELECT doc_json FROM plan_geometry WHERE doc_hash = ? LIMIT 1", (row["doc_hash"],)).fetchone()[0]
        hit = build(json.loads(doc_json))
        if len(cache) >= _CACHE_MAX:
            cache.clear()
        cache[row["doc_hash"]] = hit
    return hit


def _current_published(conn: sqlite3.Connection) -> list[sqlite3.Row]:
    """The published structure of every floor's published plan version - the only documents the live map, the scope
    and the search read. Only floor_id and doc_hash: the document itself is loaded lazily, once per hash, on a cache
    miss (review R1, Minor 4)."""
    return conn.execute("SELECT g.floor_id, g.doc_hash FROM plan_geometry g JOIN plan_versions v ON v.id = g.plan_version_id "
                        "WHERE g.status = 'published' AND v.status = 'published'").fetchall()


def circuit_switches(conn: sqlite3.Connection) -> dict[str, list[str]]:
    """The switch entity of every circuit in a published document, keyed entity id -> floor ids: for scope purposes such
    a switch counts as placed on the floor (a floor viewer reads its state, a floor operator toggles it through the
    entity action route). One parse per document hash, bounded. The switch/light shape check is redundant here (a
    published document already passed it) but applied anyway, in depth (review R1, Minor 5)."""
    out: dict[str, list[str]] = {}
    for r in _current_published(conn):
        for eid in _cached(conn, _SWITCH_CACHE, r, lambda doc: sorted({c["switch_entity_id"] for c in doc.get("circuits") or [] if isinstance(c, dict) and isinstance(c.get("switch_entity_id"), str) and pg.SWITCH_RE.match(c["switch_entity_id"])})):
            out.setdefault(eid, []).append(r["floor_id"])
    return out


def published_objects(conn: sqlite3.Connection) -> dict[str, list[dict[str, Any]]]:
    """What the global search scans: the objects of every published document, keyed by floor - id, item, label, level
    and position. One parse per document hash, bounded."""
    out: dict[str, list[dict[str, Any]]] = {}
    for r in _current_published(conn):
        entries = _cached(conn, _OBJECT_CACHE, r, lambda doc: [{"id": o["id"], "item_id": str(o.get("item_id") or ""), "label": o.get("label") or None, "level_id": o.get("level_id"), "position": o.get("position")}
                                                         for o in doc.get("objects") or [] if isinstance(o, dict) and isinstance(o.get("id"), str)])
        if entries:
            out.setdefault(r["floor_id"], []).extend(entries)
    return out
