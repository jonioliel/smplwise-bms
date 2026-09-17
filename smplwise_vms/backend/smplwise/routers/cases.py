"""Investigation cases (T049): a case links events and recording clips from several cameras with notes, tags and
a status. A clip is a bookmark that points at the NVR until an export job copies it (preserved); footage the NVR
no longer has is reported as missing and never as preserved. Edits need cases.manage and the current revision."""
from __future__ import annotations

import datetime as dt
import hashlib
import json
import pathlib
import sqlite3
from typing import Any

from fastapi import APIRouter, Depends, File, Query, Request, UploadFile
from fastapi.responses import FileResponse
from pydantic import BaseModel, Field

from ..audit import audit
from ..auth import current_principal, current_principal_ro, get_conn, get_read_conn, settings_of
from ..config import Settings
from ..db import new_id, now_iso, unlocked
from ..errors import ApiError, conflict, not_found
from ..rbac import INSTALLATION, Principal, authorize, require
from ..services import bundle as bundle_svc
from ..services import signing
from ..services import exports as ex
from ..services import nvr, recordings
from ..services.access import camera_allowed, require_camera, visible_camera_ids
from ..services.events_ingest import row_to_event
from ..services.timeutil import iso_utc, local_day_bounds, parse_utc, zone
from .events import _with_names, _with_thumbs
from .settings import read_settings

router = APIRouter()

EVENT_BEFORE_S = 5
EVENT_AFTER_S = 30
MAX_CLIP = dt.timedelta(hours=6)
SEARCH = recordings.search_segments  # replaced in tests
SNAPSHOT = nvr.fetch_snapshot  # replaced in tests
MAX_BUNDLE_UPLOAD = 2048 * 1024 * 1024


def _rid(request: Request) -> str | None:
    return getattr(request.state, "correlation_id", None)


def _read_scope(conn: sqlite3.Connection, principal: Principal) -> set[str] | None:
    """None = every camera's items; a set = only those cameras' items. Nobody without events.read reads cases."""
    ids = visible_camera_ids(conn, principal, "events.read")
    if ids is not None and not ids:
        require(conn, principal, "events.read", INSTALLATION)  # 403 with an audit row
    return ids


def _can_manage(conn: sqlite3.Connection, principal: Principal) -> bool:
    ids = visible_camera_ids(conn, principal, "cases.manage")
    return ids is None or bool(ids)


def _require_manage(conn: sqlite3.Connection, principal: Principal) -> None:
    if not _can_manage(conn, principal):
        require(conn, principal, "cases.manage", INSTALLATION)


def _get(conn: sqlite3.Connection, case_id: str) -> sqlite3.Row:
    row = conn.execute("SELECT * FROM cases WHERE id = ?", (case_id,)).fetchone()
    if not row:
        raise not_found("התיק לא נמצא.")
    return row


def _clean_tags(tags: list[str]) -> list[str]:
    out: list[str] = []
    for t in tags:
        t = t.strip()[:40]
        if t and t not in out:
            out.append(t)
    return out[:20]


def _counts(conn: sqlite3.Connection, case_ids: list[str]) -> dict[str, dict[str, int]]:
    out = {cid: {"items": 0, "events": 0, "clips": 0, "notes": 0, "snapshots": 0, "preserved": 0} for cid in case_ids}
    if not case_ids:
        return out
    q = ",".join("?" * len(case_ids))
    for r in conn.execute(f"SELECT ci.case_id, ci.kind, ej.state AS job_state, ej.payload_json FROM case_items ci LEFT JOIN export_jobs ej ON ej.id = ci.export_job_id WHERE ci.case_id IN ({q})", case_ids).fetchall():
        c = out[r["case_id"]]
        c["items"] += 1
        c[{"event": "events", "clip": "clips", "note": "notes", "snapshot": "snapshots"}[r["kind"]]] += 1
        if r["kind"] == "snapshot" or (r["job_state"] in ("done", "partial") and json.loads(r["payload_json"] or "{}").get("output")):
            c["preserved"] += 1
    return out


def case_row(r: sqlite3.Row, counts: dict[str, int]) -> dict[str, Any]:
    return {
        "id": r["id"], "title": r["title"], "description": r["description"], "status": r["status"], "tags": json.loads(r["tags_json"] or "[]"),
        "owner_user_id": r["owner_user_id"], "owner_username": r["owner_username"], "revision": r["revision"],
        "created_at": r["created_at"], "updated_at": r["updated_at"], "closed_at": r["closed_at"], "counts": counts,
    }


def _camera_name(cam: sqlite3.Row) -> str:
    return cam["alias"] or cam["name_source"] or f"ערוץ {cam['channel']}"


def _preservation(settings: Settings, conn: sqlite3.Connection, item: sqlite3.Row, cam: sqlite3.Row | None, tz_name: str, check: bool) -> tuple[str, dict[str, Any] | None]:
    """preserved = an export job copied the footage; preserving = the copy is running; nvr_only = the NVR still has it;
    missing = the NVR no longer has it (overwritten); unknown = not checked / not checkable; none = nothing to preserve."""
    export = None
    if item["export_job_id"]:
        job = ex.get_job(conn, item["export_job_id"])
        if job:
            export = {"id": job["id"], "state": job["state"], "progress": job["progress"], "download_ready": job["download_ready"], "error": job["error"]}
            if job["download_ready"]:
                return "preserved", export
            if job["state"] in ("queued", "running"):
                return "preserving", export
    if item["kind"] == "snapshot":
        p = settings.data_dir / item["file_path"] if item["file_path"] else None
        return ("preserved" if p and p.is_file() else "missing"), None
    if item["kind"] == "note" or cam is None or not item["from_at"] or not item["to_at"]:
        return "none", export
    if not check or not settings.nvr_host or not cam["main_track"]:
        return "unknown", export
    try:
        start, end = parse_utc(item["from_at"]), parse_utc(item["to_at"])
        with unlocked(conn):
            result = SEARCH(settings, conn, cam, start, end, tz_name)
    except Exception:  # noqa: BLE001 - the NVR being unreachable is an honest "unknown", never "preserved"
        return "unknown", export
    if any(s.start_at < item["to_at"] and s.end_at > item["from_at"] for s in result.segments):
        return "nvr_only", export
    return ("missing" if result.coverage != "unknown" else "unknown"), export


def _items(settings: Settings, conn: sqlite3.Connection, case_id: str, scope: set[str] | None, check: bool) -> tuple[list[dict[str, Any]], int]:
    rows = conn.execute("SELECT * FROM case_items WHERE case_id = ? ORDER BY created_at, sort_order", (case_id,)).fetchall()
    cams = {r["id"]: r for r in conn.execute("SELECT * FROM cameras").fetchall()}
    tz_name = read_settings(conn)["time.zone"]
    ev_ids = [r["event_id"] for r in rows if r["event_id"]]
    events: dict[str, dict[str, Any]] = {}
    if ev_ids:
        q = ",".join("?" * len(ev_ids))
        evs = [row_to_event(r) for r in conn.execute(f"SELECT * FROM events WHERE id IN ({q})", ev_ids).fetchall()]
        _with_thumbs(settings, evs)
        _with_names(conn, evs)
        events = {e["id"]: e for e in evs}
    out: list[dict[str, Any]] = []
    hidden = 0
    for r in rows:
        if r["camera_id"] and scope is not None and r["camera_id"] not in scope:
            hidden += 1
            continue
        cam = cams.get(r["camera_id"]) if r["camera_id"] else None
        preservation, export = _preservation(settings, conn, r, cam, tz_name, check)
        ev = events.get(r["event_id"]) if r["event_id"] else None
        out.append({
            "id": r["id"], "case_id": case_id, "kind": r["kind"], "camera_id": r["camera_id"], "camera_name": _camera_name(cam) if cam else None,
            "event_id": r["event_id"],
            "event": {k: ev.get(k) for k in ("type", "occurred_at", "ended_at", "severity", "confidence", "thumbnail", "acked_at", "source")} if ev else None,
            "export_job_id": r["export_job_id"], "from_at": r["from_at"], "to_at": r["to_at"], "note": r["note"],
            "added_by_username": r["added_by_username"], "created_at": r["created_at"], "preservation": preservation, "export": export,
            "file_path": r["file_path"], "file_sha256": r["file_sha256"],
            "file_url": f"api/v1/cases/{case_id}/items/{r['id']}/file" if r["file_path"] else None,
        })
    return out, hidden


# ---------------------------------------------------------------- cases

class CaseIn(BaseModel):
    title: str = Field(min_length=1, max_length=120)
    description: str = Field(default="", max_length=4000)
    tags: list[str] = Field(default_factory=list, max_length=20)
    status: str = Field(default="open", pattern="^(open|in_review|closed)$")


class CasePatch(BaseModel):
    revision: int = Field(ge=1)
    title: str | None = Field(default=None, min_length=1, max_length=120)
    description: str | None = Field(default=None, max_length=4000)
    tags: list[str] | None = Field(default=None, max_length=20)
    status: str | None = Field(default=None, pattern="^(open|in_review|closed)$")


@router.get("/cases")
def list_cases(
    principal: Principal = Depends(current_principal_ro),
    conn: sqlite3.Connection = Depends(get_read_conn),
    status: str | None = Query(None, pattern="^(open|in_review|closed)$"),
    q: str | None = Query(None, max_length=80),
    limit: int = Query(100, ge=1, le=500),
) -> dict[str, Any]:
    _read_scope(conn, principal)
    where: list[str] = []
    args: list[Any] = []
    if status:
        where.append("status = ?")
        args.append(status)
    if q:
        like = f"%{q.strip()}%"
        where.append("(title LIKE ? OR description LIKE ? OR tags_json LIKE ?)")
        args += [like, like, like]
    sql = "SELECT * FROM cases" + (" WHERE " + " AND ".join(where) if where else "") + " ORDER BY updated_at DESC LIMIT ?"
    rows = conn.execute(sql, (*args, limit)).fetchall()
    counts = _counts(conn, [r["id"] for r in rows])
    return {"cases": [case_row(r, counts[r["id"]]) for r in rows], "can_manage": _can_manage(conn, principal)}


@router.post("/cases", status_code=201)
def create_case(body: CaseIn, request: Request, principal: Principal = Depends(current_principal), conn: sqlite3.Connection = Depends(get_conn)) -> dict[str, Any]:
    _require_manage(conn, principal)
    now = now_iso()
    cid = new_id()
    conn.execute(
        "INSERT INTO cases(id, title, description, status, tags_json, owner_user_id, owner_username, revision, created_at, updated_at, closed_at) VALUES (?,?,?,?,?,?,?,1,?,?,?)",
        (cid, body.title.strip(), body.description, body.status, json.dumps(_clean_tags(body.tags), ensure_ascii=False), principal.user_id, principal.username, now, now, now if body.status == "closed" else None),
    )
    audit(conn, actor=principal, action="case.create", decision="allowed", resource_type="case", resource_id=cid, request_id=_rid(request), details={"title": body.title.strip(), "status": body.status})
    return case_row(_get(conn, cid), _counts(conn, [cid])[cid])


@router.get("/cases/bookmarks")
def list_bookmarks(
    request: Request,
    camera_id: str = Query(min_length=1, max_length=120),
    date: str = Query(pattern=r"^\d{4}-\d{2}-\d{2}$"),
    principal: Principal = Depends(current_principal_ro),
    conn: sqlite3.Connection = Depends(get_read_conn),
) -> dict[str, Any]:
    """The timeline's bookmarks (T049): the event / clip items of every case for one camera whose window meets a
    local day. Preservation comes from the export job alone (no NVR probe here): preserved, preserving, or nvr - a
    bookmark the NVR still has to serve. Declared before /cases/{case_id} so 'bookmarks' is never read as an id."""
    _read_scope(conn, principal)
    require_camera(conn, principal, camera_id, "events.read")
    cam = conn.execute("SELECT * FROM cameras WHERE id = ?", (camera_id,)).fetchone()
    if not cam:
        raise not_found("המצלמה לא נמצאה.")
    try:
        day = dt.date.fromisoformat(date)
    except ValueError:
        raise ApiError(422, "validation", "תאריך לא תקין.") from None
    tz_name = read_settings(conn)["time.zone"]
    start, end = local_day_bounds(day, zone(tz_name))
    rows = conn.execute(
        "SELECT ci.*, c.title AS case_title, c.status AS case_status FROM case_items ci JOIN cases c ON c.id = ci.case_id "
        "WHERE ci.camera_id = ? AND ci.kind IN ('event', 'clip') AND ci.from_at IS NOT NULL AND ci.to_at IS NOT NULL "
        "AND ci.from_at < ? AND ci.to_at > ? ORDER BY ci.from_at, ci.created_at",
        (camera_id, iso_utc(end), iso_utc(start)),
    ).fetchall()
    settings = settings_of(request)
    out: list[dict[str, Any]] = []
    for r in rows:
        preservation, _export = _preservation(settings, conn, r, cam, tz_name, False)
        out.append({
            "id": r["id"], "case_id": r["case_id"], "case_title": r["case_title"], "case_status": r["case_status"], "kind": r["kind"],
            "event_id": r["event_id"], "from_at": r["from_at"], "to_at": r["to_at"], "note": r["note"], "added_by_username": r["added_by_username"],
            "preservation": preservation if preservation in ("preserved", "preserving") else "nvr",
        })
    return {"camera_id": camera_id, "date": date, "bookmarks": out}


@router.get("/cases/{case_id}")
def get_case(case_id: str, request: Request, principal: Principal = Depends(current_principal), conn: sqlite3.Connection = Depends(get_conn), check: bool = True) -> dict[str, Any]:
    """The case with its items; `check=false` skips the NVR coverage probe (preservation then reads unknown)."""
    settings = settings_of(request)
    scope = _read_scope(conn, principal)
    r = _get(conn, case_id)
    items, hidden = _items(settings, conn, case_id, scope, check)
    return {**case_row(r, _counts(conn, [case_id])[case_id]), "items": items, "hidden_items": hidden, "can_manage": _can_manage(conn, principal), "checked": bool(check and settings.nvr_host)}


@router.patch("/cases/{case_id}")
def patch_case(case_id: str, body: CasePatch, request: Request, principal: Principal = Depends(current_principal), conn: sqlite3.Connection = Depends(get_conn)) -> dict[str, Any]:
    _require_manage(conn, principal)
    r = _get(conn, case_id)
    if body.revision != r["revision"]:
        raise conflict("stale_revision", "התיק השתנה בינתיים; טען מחדש.", current_revision=r["revision"], sent_revision=body.revision)
    fields: dict[str, Any] = {}
    if body.title is not None:
        fields["title"] = body.title.strip()
    if body.description is not None:
        fields["description"] = body.description
    if body.tags is not None:
        fields["tags_json"] = json.dumps(_clean_tags(body.tags), ensure_ascii=False)
    now = now_iso()
    if body.status is not None and body.status != r["status"]:
        fields["status"] = body.status
        fields["closed_at"] = now if body.status == "closed" else None
    sets = "".join(f"{k} = ?, " for k in fields)
    conn.execute(f"UPDATE cases SET {sets}revision = revision + 1, updated_at = ? WHERE id = ?", (*fields.values(), now, case_id))
    audit(conn, actor=principal, action="case.update", decision="allowed", resource_type="case", resource_id=case_id, request_id=_rid(request), details={"fields": sorted(fields), "status": fields.get("status")})
    return case_row(_get(conn, case_id), _counts(conn, [case_id])[case_id])


@router.delete("/cases/{case_id}", status_code=204)
def delete_case(case_id: str, request: Request, principal: Principal = Depends(current_principal), conn: sqlite3.Connection = Depends(get_conn)) -> None:
    _require_manage(conn, principal)
    r = _get(conn, case_id)
    n = conn.execute("SELECT COUNT(*) FROM case_items WHERE case_id = ?", (case_id,)).fetchone()[0]
    conn.execute("DELETE FROM case_items WHERE case_id = ?", (case_id,))
    conn.execute("DELETE FROM cases WHERE id = ?", (case_id,))
    audit(conn, actor=principal, action="case.delete", decision="allowed", resource_type="case", resource_id=case_id, request_id=_rid(request), details={"title": r["title"], "items": n})


# ---------------------------------------------------------------- items

class ItemIn(BaseModel):
    kind: str = Field(pattern="^(event|clip|note|snapshot)$")
    event_id: str | None = Field(default=None, max_length=64)
    camera_id: str | None = Field(default=None, max_length=32)
    from_at: str | None = Field(default=None, max_length=40)
    to_at: str | None = Field(default=None, max_length=40)
    note: str = Field(default="", max_length=4000)


def _item(settings: Settings, conn: sqlite3.Connection, case_id: str, item_id: str) -> dict[str, Any]:
    items, _ = _items(settings, conn, case_id, None, False)
    return next(i for i in items if i["id"] == item_id)


@router.post("/cases/{case_id}/items", status_code=201)
def add_item(case_id: str, body: ItemIn, request: Request, principal: Principal = Depends(current_principal), conn: sqlite3.Connection = Depends(get_conn)) -> dict[str, Any]:
    _require_manage(conn, principal)
    r = _get(conn, case_id)
    if r["status"] == "closed":
        raise conflict("case_closed", "התיק סגור; פתח אותו מחדש כדי להוסיף פריטים.")
    camera_id = event_id = from_at = to_at = None
    if body.kind == "event":
        if not body.event_id:
            raise ApiError(422, "validation", "חסר מזהה אירוע.")
        ev = conn.execute("SELECT * FROM events WHERE id = ?", (body.event_id,)).fetchone()
        if not ev:
            raise not_found("האירוע לא נמצא.")
        if conn.execute("SELECT 1 FROM case_items WHERE case_id = ? AND event_id = ?", (case_id, ev["id"])).fetchone():
            raise conflict("already_in_case", "האירוע כבר בתיק.")
        camera_id, event_id = ev["camera_id"], ev["id"]
        t0 = parse_utc(ev["occurred_at"])
        t1 = parse_utc(ev["ended_at"]) if ev["ended_at"] else t0
        from_at, to_at = iso_utc(t0 - dt.timedelta(seconds=EVENT_BEFORE_S)), iso_utc(t1 + dt.timedelta(seconds=EVENT_AFTER_S))
    elif body.kind == "clip":
        if not (body.camera_id and body.from_at and body.to_at):
            raise ApiError(422, "validation", "קטע דורש מצלמה וטווח זמן.")
        try:
            t0, t1 = parse_utc(body.from_at), parse_utc(body.to_at)
        except ValueError:
            raise ApiError(422, "validation", "זמן חייב להיות UTC (Z).")
        if t1 <= t0 or (t1 - t0) > MAX_CLIP:
            raise ApiError(422, "validation", "טווח הקטע ריק או ארוך מ־6 שעות.")
        camera_id, from_at, to_at = body.camera_id, iso_utc(t0), iso_utc(t1)
    elif body.kind == "snapshot":
        if not body.camera_id:
            raise ApiError(422, "validation", "תמונה דורשת מצלמה.")
        camera_id = body.camera_id
    elif not body.note.strip():
        raise ApiError(422, "validation", "הערה ריקה.")
    if camera_id:
        if not conn.execute("SELECT 1 FROM cameras WHERE id = ?", (camera_id,)).fetchone():
            raise not_found("המצלמה לא נמצאה.")
        require_camera(conn, principal, camera_id, "video.playback")
    now = now_iso()
    iid = new_id()
    file_path = file_sha = None
    if body.kind == "snapshot":
        settings = settings_of(request)
        if not settings.nvr_host:
            raise ApiError(503, "nvr_unconfigured", "לא הוגדר NVR; אין ממה לצלם.")
        cam = conn.execute("SELECT * FROM cameras WHERE id = ?", (camera_id,)).fetchone()
        with unlocked(conn):
            data = SNAPSHOT(settings, int(cam["channel"]))
        if not data or not data.startswith(b"\xff\xd8\xff"):
            raise ApiError(503, "snapshot_unavailable", "המצלמה לא סיפקה תמונה.", retryable=True)
        rel = pathlib.Path("cases") / case_id / f"{iid}.jpg"
        dest = settings.data_dir / rel
        dest.parent.mkdir(parents=True, exist_ok=True)
        dest.write_bytes(data)
        file_path, file_sha = rel.as_posix(), hashlib.sha256(data).hexdigest()
        from_at = to_at = now
    conn.execute(
        "INSERT INTO case_items(id, case_id, kind, camera_id, event_id, export_job_id, from_at, to_at, note, added_by, added_by_username, created_at, sort_order, file_path, file_sha256) VALUES (?,?,?,?,?,NULL,?,?,?,?,?,?,0,?,?)",
        (iid, case_id, body.kind, camera_id, event_id, from_at, to_at, body.note.strip(), principal.user_id, principal.username, now, file_path, file_sha),
    )
    conn.execute("UPDATE cases SET updated_at = ? WHERE id = ?", (now, case_id))
    audit(conn, actor=principal, action="case.item.add", decision="allowed", resource_type="case", resource_id=case_id, request_id=_rid(request),
          details={"item": iid, "kind": body.kind, "camera_id": camera_id, "event_id": event_id, "from": from_at, "to": to_at})
    return _item(settings_of(request), conn, case_id, iid)


@router.delete("/cases/{case_id}/items/{item_id}", status_code=204)
def remove_item(case_id: str, item_id: str, request: Request, principal: Principal = Depends(current_principal), conn: sqlite3.Connection = Depends(get_conn)) -> None:
    _require_manage(conn, principal)
    _get(conn, case_id)
    it = conn.execute("SELECT * FROM case_items WHERE id = ? AND case_id = ?", (item_id, case_id)).fetchone()
    if not it:
        raise not_found("הפריט לא נמצא.")
    now = now_iso()
    if it["file_path"]:
        (settings_of(request).data_dir / it["file_path"]).unlink(missing_ok=True)
    conn.execute("DELETE FROM case_items WHERE id = ?", (item_id,))
    conn.execute("UPDATE cases SET updated_at = ? WHERE id = ?", (now, case_id))
    audit(conn, actor=principal, action="case.item.remove", decision="allowed", resource_type="case", resource_id=case_id, request_id=_rid(request), details={"item": item_id, "kind": it["kind"]})


@router.post("/cases/{case_id}/items/{item_id}/preserve", status_code=201)
def preserve_item(case_id: str, item_id: str, request: Request, principal: Principal = Depends(current_principal), conn: sqlite3.Connection = Depends(get_conn)) -> dict[str, Any]:
    """Copy the footage out of the NVR through an export job (T048) and link it; only then the item counts as preserved."""
    _require_manage(conn, principal)
    settings = settings_of(request)
    _get(conn, case_id)
    it = conn.execute("SELECT * FROM case_items WHERE id = ? AND case_id = ?", (item_id, case_id)).fetchone()
    if not it:
        raise not_found("הפריט לא נמצא.")
    if it["kind"] == "note" or not it["camera_id"] or not it["from_at"]:
        raise conflict("not_a_clip", "רק אירוע או קטע עם מצלמה ניתנים לשימור.")
    if it["export_job_id"]:
        job = ex.get_job(conn, it["export_job_id"])
        if job and job["state"] in ("queued", "running", "done", "partial"):
            raise conflict("already_preserving", "כבר קיימת עבודת שימור לפריט.", state=job["state"])
    if not settings.nvr_host:
        raise ApiError(503, "nvr_unconfigured", "לא הוגדר NVR; אין ממה להעתיק.")
    cam = conn.execute("SELECT * FROM cameras WHERE id = ?", (it["camera_id"],)).fetchone()
    if not cam:
        raise not_found("המצלמה לא נמצאה.")
    require_camera(conn, principal, cam["id"], "video.export")
    if not cam["main_track"]:
        raise ApiError(409, "no_track", "למצלמה אין track הקלטה ידוע; הרץ סנכרון מצלמות.")
    s = read_settings(conn)
    active = conn.execute("SELECT COUNT(*) FROM export_jobs WHERE owner_user_id = ? AND state IN ('queued','running')", (principal.user_id,)).fetchone()[0]
    if active >= 5:
        raise ApiError(429, "too_many_jobs", "יש כבר 5 עבודות ייצוא ממתינות; המתן לסיומן.", retryable=True)
    job = ex.create_job(conn, settings, principal, cam, parse_utc(it["from_at"]), parse_utc(it["to_at"]), s["time.zone"], s["exports.max_mb"] * 1024 * 1024)
    conn.execute("UPDATE case_items SET export_job_id = ? WHERE id = ?", (job["id"], item_id))
    conn.execute("UPDATE cases SET updated_at = ? WHERE id = ?", (now_iso(), case_id))
    audit(conn, actor=principal, action="case.item.preserve", decision="allowed", resource_type="case", resource_id=case_id, request_id=_rid(request),
          details={"item": item_id, "job": job["id"], "camera_id": cam["id"], "from": it["from_at"], "to": it["to_at"]})
    return _item(settings, conn, case_id, item_id)


# ---------------------------------------------------------------- item files, evidence bundles (T050) and verification

@router.get("/cases/{case_id}/items/{item_id}/file")
def item_file(case_id: str, item_id: str, request: Request, principal: Principal = Depends(current_principal), conn: sqlite3.Connection = Depends(get_conn)) -> FileResponse:
    scope = _read_scope(conn, principal)
    _get(conn, case_id)
    it = conn.execute("SELECT * FROM case_items WHERE id = ? AND case_id = ?", (item_id, case_id)).fetchone()
    if not it or not it["file_path"]:
        raise not_found("אין קובץ לפריט.")
    if it["camera_id"] and scope is not None and it["camera_id"] not in scope:
        require(conn, principal, "events.read", INSTALLATION)
    p = settings_of(request).data_dir / it["file_path"]
    if not p.is_file():
        raise not_found("הקובץ חסר בדיסק.")
    return FileResponse(p, media_type="image/jpeg", headers={"Cache-Control": "private, max-age=3600"})


@router.post("/cases/{case_id}/bundle", status_code=201)
def create_bundle(case_id: str, request: Request, principal: Principal = Depends(current_principal), conn: sqlite3.Connection = Depends(get_conn)) -> dict[str, Any]:
    """One ZIP with the preserved clips, the snapshots, the notes, a manifest with SHA-256 per file and a readable
    report. Items that are only bookmarks (not preserved) are listed as skipped, never silently included."""
    _require_manage(conn, principal)
    settings = settings_of(request)
    scope = _read_scope(conn, principal)
    r = _get(conn, case_id)
    items, hidden = _items(settings, conn, case_id, scope, False)
    case = case_row(r, _counts(conn, [case_id])[case_id])
    tz_name = read_settings(conn)["time.zone"]
    with unlocked(conn):
        desc = bundle_svc.build(settings, conn, case, items, principal, tz_name)
    desc["hidden_items"] = hidden
    audit(conn, actor=principal, action="case.bundle", decision="allowed", resource_type="case", resource_id=case_id, request_id=_rid(request),
          details={"bundle": desc["name"], "bytes": desc["bytes"], "sha256": desc["sha256"], "files": desc["files"], "skipped": len(desc["skipped"])})
    return desc


@router.get("/cases/{case_id}/bundles")
def list_bundles(case_id: str, request: Request, principal: Principal = Depends(current_principal), conn: sqlite3.Connection = Depends(get_conn)) -> dict[str, Any]:
    _read_scope(conn, principal)
    _get(conn, case_id)
    d = bundle_svc.bundles_dir(settings_of(request), case_id)
    out = []
    for p in sorted(d.glob("*.zip"), reverse=True) if d.is_dir() else []:
        out.append({"name": p.name, "bytes": p.stat().st_size, "created_at": dt.datetime.fromtimestamp(p.stat().st_mtime, dt.timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ"), "download_url": f"api/v1/cases/{case_id}/bundles/{p.name}", "signed": signing.bundle_kid(p)})
    return {"bundles": out}


@router.get("/cases/{case_id}/bundles/{name}")
def download_bundle(case_id: str, name: str, request: Request, principal: Principal = Depends(current_principal), conn: sqlite3.Connection = Depends(get_conn)) -> FileResponse:
    _read_scope(conn, principal)
    _get(conn, case_id)
    if not bundle_svc.re.fullmatch(r"case-[0-9a-f]{8}-\d{8}T\d{6}Z\.zip", name):
        raise not_found("החבילה לא נמצאה.")
    p = bundle_svc.bundles_dir(settings_of(request), case_id) / name
    if not p.is_file():
        raise not_found("החבילה לא נמצאה.")
    audit(conn, actor=principal, action="case.bundle.download", decision="allowed", resource_type="case", resource_id=case_id, request_id=_rid(request), details={"bundle": name})
    return FileResponse(p, media_type="application/zip", filename=name)


@router.post("/cases/bundles/verify")
async def verify_bundle(request: Request, file: UploadFile = File(...), principal: Principal = Depends(current_principal), conn: sqlite3.Connection = Depends(get_conn)) -> dict[str, Any]:
    """Recompute the hashes of an uploaded bundle against its manifest. Reports per file; never trusts the archive."""
    _read_scope(conn, principal)
    chunks: list[bytes] = []
    size = 0
    while True:
        chunk = await file.read(1024 * 1024)
        if not chunk:
            break
        size += len(chunk)
        if size > MAX_BUNDLE_UPLOAD:
            raise ApiError(413, "payload_too_large", "החבילה גדולה מדי לאימות דרך הדפדפן.")
        chunks.append(chunk)
    result = bundle_svc.verify(b"".join(chunks), signing.load_keyring(settings_of(request)))
    audit(conn, actor=principal, action="case.bundle.verify", decision="allowed", resource_type="bundle", resource_id=file.filename or "", request_id=_rid(request),
          details={"ok": result["ok"], "files": len(result["files"]), "mismatches": sum(1 for f in result["files"] if f["status"] != "ok"), "extra": len(result["extra"])})
    return result


# ---------------------------------------------------------------- evidence signing keys (T067)

@router.get("/evidence/signing")
def signing_info(request: Request, principal: Principal = Depends(current_principal), conn: sqlite3.Connection = Depends(get_conn)) -> dict[str, Any]:
    """The installation's evidence-signing keys — public halves only — with the trust statement; anyone who can
    verify a bundle may read them. The private half never leaves /data/keys and is not part of any backup."""
    return {**signing.public_info(settings_of(request)), "can_rotate": authorize(conn, principal, "system.configure", INSTALLATION).allowed}


@router.post("/evidence/signing/rotate")
def rotate_signing(request: Request, principal: Principal = Depends(current_principal), conn: sqlite3.Connection = Depends(get_conn)) -> dict[str, Any]:
    """New active key (system.configure); the previous public key stays in the ring as retired, so earlier bundles
    still verify and are reported as signed by a retired key of this installation."""
    require(conn, principal, "system.configure", INSTALLATION)
    info = signing.rotate(settings_of(request))
    audit(conn, actor=principal, action="evidence.key.rotate", decision="allowed", resource_type="installation", resource_id="*", request_id=_rid(request),
          details={"active": info["active"], "keys": len(info["keys"])})
    return {**info, "can_rotate": True}

