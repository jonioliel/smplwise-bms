"""Plan Studio persistence (T084, CR-003): the structure document of each plan version in plan_geometry - one draft
(the editor's autosave target), at most one published row, and the archived history the historical map reads. A
document is stored as canonical JSON with its SHA-256; the map bundle carries only (id, hash). The server rebases every
document on its version, so ids, size and calibration can never be changed by a client."""
from __future__ import annotations

import copy
import hashlib
import json
import sqlite3
from typing import Any

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
    levels) and the refresh of bound bodies from the floor's live anchors (design 2a, rule 1)."""
    doc = pg.rebase(doc, version, _asset(conn, version))
    doc = pg.normalize(doc, plan_catalog.item_index(conn))
    return pg.apply_anchor_positions(doc, anchor_positions(conn, version["floor_id"]))


def working_doc(conn: sqlite3.Connection, version: sqlite3.Row) -> tuple[dict[str, Any], sqlite3.Row | None]:
    """The document the editor starts from: the stored draft, else a copy of the published document, else a new one -
    prepared, so bodies sit on their anchors even when the anchor moved after the last save."""
    d = draft_row(conn, version["id"])
    if d is not None:
        return _prepare(conn, version, load_doc(d)), d
    p = published_row(conn, version["id"])
    return (_prepare(conn, version, load_doc(p)) if p is not None else pg.new_document(version, _asset(conn, version))), None


def save_draft(conn: sqlite3.Connection, version: sqlite3.Row, doc: dict[str, Any], base_revision: int, actor_id: str | None, now: str | None = None) -> sqlite3.Row:
    now = now or now_iso()
    doc = _prepare(conn, version, doc)
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


def link_connector(conn: sqlite3.Connection, source: sqlite3.Row, connector_id: str, target_floor_id: str, actor_id: str | None, now: str | None = None) -> dict[str, Any]:
    """Stairs or an elevator between two floors exist in both floors' documents under the same id (design section 8,
    for T064). The source draft's connector gets both floor ids and no level_to (it leaves the floor); the target
    floor's editor version (its latest draft, else its published plan) gets the same connector on its draft - the
    polyline copied, level_from = its default level - upserted by id, so linking twice changes nothing there."""
    now = now or now_iso()
    doc, draft = working_doc(conn, source)
    item = next((c for c in doc.get("connectors") or [] if isinstance(c, dict) and c.get("id") == connector_id), None)
    if item is None:
        raise ApiError(404, "not_found", "המחבר לא נמצא בטיוטה.")
    if item.get("object_id"):
        raise conflict("derived_connector", "מחבר שנגזר מעצם (טריבונה) מחבר מפלסים באותה קומה; קשר לקומה מדרגות או מעלית שציירת.")
    target_version = conn.execute("SELECT * FROM plan_versions WHERE floor_id = ? AND status IN ('draft', 'published') "
                                  "ORDER BY CASE status WHEN 'draft' THEN 0 ELSE 1 END, created_at DESC LIMIT 1", (target_floor_id,)).fetchone()
    if target_version is None:
        raise conflict("no_plan", "לקומה השנייה אין תוכנית; העלה תוכנית לפני שמקשרים אליה.")
    floors = sorted({source["floor_id"], target_floor_id, *[f for f in item.get("floor_ids") or [] if isinstance(f, str)]})
    item["floor_ids"] = floors
    item["level_to"] = None
    save_draft(conn, source, doc, draft["revision"] if draft is not None else 0, actor_id, now)
    tdoc, tdraft = working_doc(conn, target_version)
    twin = {**copy.deepcopy(item), "level_from": _default_level(tdoc), "level_to": None, "floor_ids": floors, "source": "manual"}
    connectors = [c for c in tdoc.get("connectors") or [] if not (isinstance(c, dict) and c.get("id") == connector_id)]
    if twin in (tdoc.get("connectors") or []):
        row = tdraft
    else:
        tdoc["connectors"] = [*connectors, twin]
        row = save_draft(conn, target_version, tdoc, tdraft["revision"] if tdraft is not None else 0, actor_id, now)
    return {"connector": item, "target": {"floor_id": target_floor_id, "version_id": target_version["id"], "revision": row["revision"] if row is not None else 0}}


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
    if row is None:
        return []
    circuits = load_doc(row).get("circuits")
    return [c for c in circuits if isinstance(c, dict) and isinstance(c.get("id"), str) and isinstance(c.get("switch_entity_id"), str)] if isinstance(circuits, list) else []


def _cached(cache: dict[str, Any], row: sqlite3.Row, build) -> Any:
    hit = cache.get(row["doc_hash"])
    if hit is None:
        hit = build(load_doc(row))
        if len(cache) >= _CACHE_MAX:
            cache.clear()
        cache[row["doc_hash"]] = hit
    return hit


def _current_published(conn: sqlite3.Connection) -> list[sqlite3.Row]:
    """The published structure of every floor's published plan version - the only documents the live map, the scope
    and the search read."""
    return conn.execute("SELECT g.floor_id, g.plan_version_id, g.doc_hash, g.doc_json FROM plan_geometry g JOIN plan_versions v ON v.id = g.plan_version_id "
                        "WHERE g.status = 'published' AND v.status = 'published'").fetchall()


def circuit_switches(conn: sqlite3.Connection) -> dict[str, list[str]]:
    """The switch entity of every circuit in a published document, keyed entity id -> floor ids: for scope purposes such
    a switch counts as placed on the floor (a floor viewer reads its state, a floor operator toggles it through the
    entity action route). One parse per document hash, bounded."""
    out: dict[str, list[str]] = {}
    for r in _current_published(conn):
        for eid in _cached(_SWITCH_CACHE, r, lambda doc: sorted({c["switch_entity_id"] for c in doc.get("circuits") or [] if isinstance(c, dict) and isinstance(c.get("switch_entity_id"), str)})):
            out.setdefault(eid, []).append(r["floor_id"])
    return out


def published_objects(conn: sqlite3.Connection) -> dict[str, list[dict[str, Any]]]:
    """What the global search scans: the objects of every published document, keyed by floor - id, item, label, level
    and position. One parse per document hash, bounded."""
    out: dict[str, list[dict[str, Any]]] = {}
    for r in _current_published(conn):
        entries = _cached(_OBJECT_CACHE, r, lambda doc: [{"id": o["id"], "item_id": str(o.get("item_id") or ""), "label": o.get("label") or None, "level_id": o.get("level_id"), "position": o.get("position")}
                                                         for o in doc.get("objects") or [] if isinstance(o, dict) and isinstance(o.get("id"), str)])
        if entries:
            out.setdefault(r["floor_id"], []).extend(entries)
    return out
