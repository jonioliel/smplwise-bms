"""Investigation cases (T049): a case links events and recording clips from several cameras with notes, tags and
a status. A clip is a bookmark that points at the NVR until an export job copies it (preserved); footage the NVR
no longer has is reported as missing and never as preserved. Edits need cases.manage and the current revision."""
from __future__ import annotations

import asyncio
import datetime as dt
import hashlib
import json
import os
import pathlib
import shutil
import sqlite3
import tempfile
import threading
import time
import zipfile
from typing import Any

from fastapi import APIRouter, Depends, Query, Request
from fastapi.responses import FileResponse
from pydantic import BaseModel, Field
from starlette.concurrency import run_in_threadpool
from starlette.datastructures import UploadFile as StarletteUploadFile
from starlette.exceptions import HTTPException as StarletteHTTPException
from starlette.formparsers import MultiPartException
from starlette.requests import ClientDisconnect

from ..audit import audit
from ..auth import current_principal, current_principal_ro, get_conn, get_read_conn, settings_of
from ..config import Settings
from ..db import Database, new_id, now_iso, unlocked
from ..errors import ApiError, conflict, not_found
from ..rbac import INSTALLATION, Principal, authorize, require
from ..services import bundle as bundle_svc
from ..services import bundle_import
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
MB = 1024 * 1024
MULTIPART_SLACK = 64 * 1024  # multipart framing around the file part
RAW_ZIP_TYPES = {"application/zip", "application/x-zip-compressed", "application/x-zip", "application/octet-stream"}
# Bundle uploads write up to the cap into /data (where SQLite lives) and hash it: one verify / import at a time per
# process, one integrity re-hash at a time, and the same case re-hashed at most once a minute (review round 1).
_TRANSFER_LOCK = threading.Lock()
_INTEGRITY_LOCK = threading.Lock()
INTEGRITY_COOLDOWN_S = 60.0
_integrity_last: dict[str, float] = {}
FREE_CHECK_EVERY = 64 * MB
# a trickling client must not hold the one-at-a-time lock: at most UPLOAD_IDLE_S between two body chunks and
# UPLOAD_DEADLINE_S for the whole body, else 408 (the lock is released and the staging file removed)
UPLOAD_IDLE_S = 30.0
UPLOAD_DEADLINE_S = 600.0


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
    for r in conn.execute(f"SELECT ci.case_id, ci.kind, ci.file_path, ej.state AS job_state, ej.payload_json FROM case_items ci LEFT JOIN export_jobs ej ON ej.id = ci.export_job_id WHERE ci.case_id IN ({q})", case_ids).fetchall():
        c = out[r["case_id"]]
        c["items"] += 1
        c[{"event": "events", "clip": "clips", "note": "notes", "snapshot": "snapshots"}[r["kind"]]] += 1
        if r["kind"] == "snapshot" or (r["kind"] != "note" and r["file_path"]) or (r["job_state"] in ("done", "partial") and json.loads(r["payload_json"] or "{}").get("output")):
            c["preserved"] += 1
    return out


def _json(text: str | None) -> Any:
    try:
        return json.loads(text) if text else None
    except ValueError:
        return None


def case_row(r: sqlite3.Row, counts: dict[str, int]) -> dict[str, Any]:
    return {
        "id": r["id"], "title": r["title"], "description": r["description"], "status": r["status"], "tags": json.loads(r["tags_json"] or "[]"),
        "owner_user_id": r["owner_user_id"], "owner_username": r["owner_username"], "revision": r["revision"],
        "created_at": r["created_at"], "updated_at": r["updated_at"], "closed_at": r["closed_at"], "counts": counts,
        # T050 import: 'imported' cases carry where the bundle came from (source installation, exporter, export time, hash)
        "origin": r["origin"], "provenance": _json(r["provenance_json"]),
    }


def _camera_name(cam: sqlite3.Row) -> str:
    return cam["alias"] or cam["name_source"] or f"ערוץ {cam['channel']}"


def _preservation(settings: Settings, conn: sqlite3.Connection, item: sqlite3.Row, cam: sqlite3.Row | None, tz_name: str, check: bool) -> tuple[str, dict[str, Any] | None]:
    """preserved = an export job copied the footage; preserving = the copy is running; nvr_only = the NVR still has it;
    missing = the NVR no longer has it (overwritten); unknown = not checked / not checkable; none = nothing to preserve."""
    export = None
    if item["origin_json"]:
        # an imported item: preserved = its verified copy is on disk here; not_in_bundle = a bookmark the source never copied
        if item["file_path"]:
            p = settings.data_dir / item["file_path"]
            return ("preserved" if p.is_file() else "missing"), None
        return ("none" if item["kind"] == "note" else "not_in_bundle"), None
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
        origin = _json(r["origin_json"])
        if origin is not None and scope is not None:
            # an imported item belongs to no camera here: only readers of every camera (installation scope) see it
            hidden += 1
            continue
        cam = cams.get(r["camera_id"]) if r["camera_id"] else None
        preservation, export = _preservation(settings, conn, r, cam, tz_name, check)
        ev = events.get(r["event_id"]) if r["event_id"] else None
        event = {k: ev.get(k) for k in ("type", "occurred_at", "ended_at", "severity", "confidence", "thumbnail", "acked_at", "source")} if ev else None
        if origin is not None and origin.get("event"):
            event = {**origin["event"], "thumbnail": None, "acked_at": None}
        out.append({
            "id": r["id"], "case_id": case_id, "kind": r["kind"], "camera_id": r["camera_id"],
            "camera_name": _camera_name(cam) if cam else (origin or {}).get("camera_name"),
            "event_id": r["event_id"], "event": event,
            "export_job_id": r["export_job_id"], "from_at": r["from_at"], "to_at": r["to_at"], "note": r["note"],
            "added_by_username": r["added_by_username"], "created_at": r["created_at"], "preservation": preservation, "export": export,
            "file_path": r["file_path"], "file_sha256": r["file_sha256"],
            "file_url": f"api/v1/cases/{case_id}/items/{r['id']}/file" if r["file_path"] else None,
            "imported": origin is not None, "origin": origin,
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
    return {"cases": [case_row(r, counts[r["id"]]) for r in rows], "can_manage": _can_manage(conn, principal),
            "can_import": authorize(conn, principal, "cases.manage", INSTALLATION).allowed}


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
    audit(conn, actor=principal, action="case.delete", decision="allowed", resource_type="case", resource_id=case_id, request_id=_rid(request),
          details={"title": r["title"], "items": n, "origin": r["origin"], "import_sha256": r["import_sha256"]})
    if r["import_sha256"]:
        # the imported copies go with the case. The rows are committed first; then, under the write lock again (the one a
        # re-import of the same bundle takes to put its folder in place), the folder is detached only if no case refers
        # to the hash, and removed outside the lock - a concurrent re-import can never lose its new files to this delete.
        settings = settings_of(request)
        with unlocked(conn):
            pass
        trash = None
        if not conn.execute("SELECT 1 FROM cases WHERE import_sha256 = ?", (r["import_sha256"],)).fetchone():
            trash = bundle_import.detach_case_files(settings, r["import_sha256"])
        if trash is not None:
            with unlocked(conn):
                shutil.rmtree(trash, ignore_errors=True)


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
    if it["origin_json"]:
        raise conflict("imported_read_only", "פריט מיובא הוא חלק מהחבילה המקורית ואינו ניתן להסרה; מחיקת התיק מסירה את כל הייבוא.")
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
    def not_preserving(c: sqlite3.Connection) -> None:
        row = c.execute("SELECT export_job_id FROM case_items WHERE id = ?", (item_id,)).fetchone()
        job = ex.get_job(c, row["export_job_id"]) if row and row["export_job_id"] else None
        if job and job["state"] in ("queued", "running", "done", "partial"):
            raise conflict("already_preserving", "כבר קיימת עבודת שימור לפריט.", state=job["state"])

    not_preserving(conn)  # fails fast; create_job checks again after the NVR search, in the INSERT's transaction
    if not settings.nvr_host:
        raise ApiError(503, "nvr_unconfigured", "לא הוגדר NVR; אין ממה להעתיק.")
    cam = conn.execute("SELECT * FROM cameras WHERE id = ?", (it["camera_id"],)).fetchone()
    if not cam:
        raise not_found("המצלמה לא נמצאה.")
    require_camera(conn, principal, cam["id"], "video.export")
    if not cam["main_track"]:
        raise ApiError(409, "no_track", "למצלמה אין track הקלטה ידוע; הרץ סנכרון מצלמות.")
    s = read_settings(conn)
    ex.check_quota(conn, principal)
    job = ex.create_job(conn, settings, principal, cam, parse_utc(it["from_at"]), parse_utc(it["to_at"]), s["time.zone"], s["exports.max_mb"] * 1024 * 1024,
                        recheck=not_preserving)
    conn.execute("UPDATE case_items SET export_job_id = ? WHERE id = ?", (job["id"], item_id))
    conn.execute("UPDATE cases SET updated_at = ? WHERE id = ?", (now_iso(), case_id))
    audit(conn, actor=principal, action="case.item.preserve", decision="allowed", resource_type="case", resource_id=case_id, request_id=_rid(request),
          details={"item": item_id, "job": job["id"], "camera_id": cam["id"], "from": it["from_at"], "to": it["to_at"]})
    return _item(settings, conn, case_id, item_id)


# ---------------------------------------------------------------- item files, evidence bundles (T050) and verification

@router.get("/cases/{case_id}/items/{item_id}/file")
def item_file(case_id: str, item_id: str, request: Request, principal: Principal = Depends(current_principal), conn: sqlite3.Connection = Depends(get_conn)) -> FileResponse:
    """The stored copy of a snapshot or of an imported clip / snapshot. An imported file is served as what its bytes
    are (JPEG / MP4 by signature, anything else as an attachment), never sniffed, in a sandbox."""
    scope = _read_scope(conn, principal)
    _get(conn, case_id)
    it = conn.execute("SELECT * FROM case_items WHERE id = ? AND case_id = ?", (item_id, case_id)).fetchone()
    if not it or not it["file_path"]:
        raise not_found("אין קובץ לפריט.")
    if (it["camera_id"] and scope is not None and it["camera_id"] not in scope) or (it["origin_json"] and scope is not None):
        require(conn, principal, "events.read", INSTALLATION)
    p = settings_of(request).data_dir / it["file_path"]
    if not p.is_file():
        raise not_found("הקובץ חסר בדיסק.")
    headers = {"Cache-Control": "private, max-age=3600", "X-Content-Type-Options": "nosniff"}
    if not it["origin_json"]:
        return FileResponse(p, media_type="image/jpeg", headers=headers)
    with open(p, "rb") as fh:
        head = fh.read(12)
    headers["Content-Security-Policy"] = "sandbox; default-src 'none'"
    if head.startswith(b"\xff\xd8\xff"):
        return FileResponse(p, media_type="image/jpeg", headers=headers)
    if head[4:8] == b"ftyp":
        return FileResponse(p, media_type="video/mp4", headers=headers, filename=p.name, content_disposition_type="inline")
    return FileResponse(p, media_type="application/octet-stream", headers=headers, filename=p.name)


@router.post("/cases/{case_id}/integrity")
def case_integrity(case_id: str, request: Request, principal: Principal = Depends(current_principal_ro), conn: sqlite3.Connection = Depends(get_read_conn)) -> dict[str, Any]:
    """Re-hash every stored copy of the case (snapshots, imported clips and snapshots) against the hash recorded when it
    was captured or imported: per item ok / mismatch / missing. A match means "unchanged since then" - not authenticity."""
    scope = _read_scope(conn, principal)
    r = _get(conn, case_id)
    settings = settings_of(request)
    items, hidden = _items(settings, conn, case_id, scope, False)
    todo = [(i["id"], i["kind"], i["file_path"], i["file_sha256"]) for i in items if i["file_path"] and i["file_sha256"]]
    wait = INTEGRITY_COOLDOWN_S - (time.monotonic() - _integrity_last.get(case_id, -1e9))
    if wait > 0:
        raise ApiError(429, "cooldown", f"התיק נבדק לפני רגע; אפשר לבדוק שוב בעוד {int(wait) + 1} שניות.", retryable=True, details={"retry_after_s": int(wait) + 1})
    if not _INTEGRITY_LOCK.acquire(blocking=False):
        raise _busy()

    def check() -> list[dict[str, Any]]:
        out = []
        for iid, kind, rel, sha in todo:
            p = settings.data_dir / rel
            if not p.is_file():
                out.append({"item_id": iid, "kind": kind, "status": "missing", "expected": sha, "actual": None})
                continue
            h = hashlib.sha256()
            with open(p, "rb") as fh:
                for chunk in iter(lambda: fh.read(MB), b""):
                    h.update(chunk)
            out.append({"item_id": iid, "kind": kind, "status": "ok" if h.hexdigest() == sha else "mismatch", "expected": sha, "actual": h.hexdigest()})
        return out

    try:
        _integrity_last[case_id] = time.monotonic()
        with unlocked(conn):
            files = check()
    finally:
        _INTEGRITY_LOCK.release()
    ok = all(f["status"] == "ok" for f in files)
    audit(conn, actor=principal, action="case.integrity", decision="allowed", resource_type="case", resource_id=case_id, request_id=_rid(request),
          details={"files": len(files), "ok": ok, "origin": r["origin"]})
    return {"case_id": case_id, "checked_at": now_iso(), "ok": ok, "files": files, "hidden_items": hidden,
            "note": "התאמת hash מוכיחה שהעותק השמור לא השתנה מאז שנשמר או יובא; היא אינה מוכיחה את אמיתות הצילום."}


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
    iid = bundle_svc.installation_id(conn, create=True)  # names the producer in the manifest (T050 import)
    with unlocked(conn):
        desc = bundle_svc.build(settings, conn, case, items, principal, tz_name, installation=iid)
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
    scope = _read_scope(conn, principal)
    _get(conn, case_id)
    if scope is not None:
        # T055: a built bundle holds every item of the case - a reader who does not see all of its cameras (or its
        # imported, camera-less items) gets the case's items one by one, not the whole ZIP
        cams = {r[0] for r in conn.execute("SELECT DISTINCT camera_id FROM case_items WHERE case_id = ? AND camera_id IS NOT NULL", (case_id,)).fetchall()}
        imported = conn.execute("SELECT 1 FROM case_items WHERE case_id = ? AND origin_json IS NOT NULL LIMIT 1", (case_id,)).fetchone()
        if cams - scope or imported:
            require(conn, principal, "events.read", INSTALLATION)
    if not bundle_svc.re.fullmatch(r"case-[0-9a-f]{8}-\d{8}T\d{6}Z\.zip", name):
        raise not_found("החבילה לא נמצאה.")
    p = bundle_svc.bundles_dir(settings_of(request), case_id) / name
    if not p.is_file():
        raise not_found("החבילה לא נמצאה.")
    audit(conn, actor=principal, action="case.bundle.download", decision="allowed", resource_type="case", resource_id=case_id, request_id=_rid(request), details={"bundle": name})
    return FileResponse(p, media_type="application/zip", filename=name)


def _bundle_reader(principal: Principal = Depends(current_principal_ro), conn: sqlite3.Connection = Depends(get_read_conn)) -> Principal:
    """Reading cases (events.read somewhere - the gate of bundle download), checked before the body is read."""
    _read_scope(conn, principal)
    return principal


def _bundle_importer(principal: Principal = Depends(current_principal_ro), conn: sqlite3.Connection = Depends(get_read_conn)) -> Principal:
    """cases.manage at installation scope (an imported case belongs to no camera here), checked before the body is read;
    require() audits a refusal."""
    require(conn, principal, "cases.manage", INSTALLATION)
    return principal


def _upload_cap(conn: sqlite3.Connection) -> int:
    return int(read_settings(conn)["cases.import_max_mb"]) * MB


def _limits(cap: int) -> bundle_svc.Limits:
    return bundle_svc.Limits(max_uncompressed=max(2 * cap, 64 * MB))


def _too_large(cap: int) -> ApiError:
    return ApiError(413, "payload_too_large", f"החבילה גדולה מהמותר ({cap // MB} MB; ההגדרה cases.import_max_mb).", details={"max_bytes": cap})


def _upload_timeout() -> ApiError:
    return ApiError(408, "upload_timeout", "העלאת החבילה נעצרה או איטית מדי; נסה שוב.", retryable=True,
                    details={"idle_s": UPLOAD_IDLE_S, "deadline_s": UPLOAD_DEADLINE_S})


def _busy() -> ApiError:
    return ApiError(429, "busy", "פעולה דומה (אימות, ייבוא או בדיקת hash) רצה כרגע; נסה שוב בעוד רגע.", retryable=True)


def _min_free(conn: sqlite3.Connection) -> int:
    return int(read_settings(conn)["storage.min_free_mb"]) * MB


def _no_space(free: int, need: int, min_free: int) -> ApiError:
    return ApiError(507, "insufficient_storage", "אין מספיק מקום פנוי בדיסק של התוסף לחבילה הזו (ההגדרה storage.min_free_mb שומרת מרווח למסד הנתונים).",
                    details={"free_bytes": free, "needed_bytes": need, "min_free_bytes": min_free})


def _unsafe_error(exc: bundle_svc.UnsafeBundle) -> ApiError:
    return ApiError(422, "unsafe_bundle", "החבילה נדחתה לפני שנקראה: " + {
        "unsafe_entries": "יש בה נתיבים לא בטוחים (.., נתיב מוחלט, אות כונן, קישור סמלי או רשומה מוצפנת).",
        "too_many_entries": "יש בה יותר מדי קבצים.",
        "central_directory_too_large": "רשימת הקבצים שלה גדולה מדי.",
        "too_large_uncompressed": "הקבצים בה גדולים מדי אחרי פריסה.",
    }.get(exc.code, exc.message), details={"reason": exc.code, "detail": exc.message, "entries": exc.entries})


async def _receive_bundle(request: Request, settings: Settings, cap: int, name: str | None, min_free: int = 0) -> dict[str, Any]:
    """Stream the uploaded bundle into a temp file under <data>/imported/.staging, hashing it on the way: a raw ZIP body
    (application/zip) or multipart with a `file` field. Never more than `cap` bytes, never the whole file in memory.
    Returns {path, sha256, bytes, name}; the caller removes the file."""
    length = request.headers.get("content-length")
    if length and length.isdigit() and int(length) > cap + MULTIPART_SLACK:
        raise _too_large(cap)
    ctype = (request.headers.get("content-type") or "").split(";")[0].strip().lower()
    if ctype != "multipart/form-data" and ctype not in RAW_ZIP_TYPES:
        raise ApiError(415, "unsupported_media_type", "שלח את החבילה כקובץ ZIP (Content-Type: application/zip) או כ־multipart עם השדה file.",
                       details={"content_type": ctype[:100]})
    free = bundle_import.free_bytes(settings)
    need = int(length) if length and length.isdigit() else cap
    if free - need < min_free:
        raise _no_space(free, need, min_free)
    fd, tmp = tempfile.mkstemp(prefix="upload-", suffix=".zip", dir=bundle_import.staging_root(settings))
    path = pathlib.Path(tmp)
    h = hashlib.sha256()
    size = 0
    try:
        with os.fdopen(fd, "wb") as out:

            def take(chunk: bytes) -> None:
                nonlocal size
                size += len(chunk)
                if size > cap:
                    raise _too_large(cap)
                if size // FREE_CHECK_EVERY != (size - len(chunk)) // FREE_CHECK_EVERY:
                    now_free = bundle_import.free_bytes(settings)
                    if now_free < min_free:  # the disk filled up while we wrote (another writer): stop before SQLite starves
                        raise _no_space(now_free, 0, min_free)
                h.update(chunk)
                out.write(chunk)

            deadline = time.monotonic() + UPLOAD_DEADLINE_S
            timed_out = False

            async def next_message() -> Any:
                # one body message within the idle timeout and the overall deadline
                nonlocal timed_out
                wait = min(UPLOAD_IDLE_S, deadline - time.monotonic())
                try:
                    if wait <= 0:
                        raise asyncio.TimeoutError
                    return await asyncio.wait_for(request.receive(), wait)
                except asyncio.TimeoutError:
                    timed_out = True
                    raise _upload_timeout() from None

            if ctype == "multipart/form-data":
                seen = 0
                over = False

                async def receive() -> Any:  # counts the body at the ASGI level, before the multipart parser buffers it
                    nonlocal seen, over
                    try:
                        message = await next_message()
                    except ApiError:
                        raise MultiPartException("upload timed out") from None
                    if message["type"] == "http.request":
                        seen += len(message.get("body", b""))
                        if seen > cap + MULTIPART_SLACK:
                            over = True
                            raise MultiPartException("request body over the bundle cap")
                    return message

                try:
                    form = await Request(request.scope, receive).form(max_files=1, max_fields=4)
                except StarletteHTTPException:
                    if timed_out:
                        raise _upload_timeout() from None
                    if over:
                        raise _too_large(cap) from None
                    raise ApiError(422, "validation", "גוף ה־multipart אינו תקין.", details={"fields": ["file"]}) from None
                try:
                    part = form.get("file")
                    if not isinstance(part, StarletteUploadFile):
                        raise ApiError(422, "validation", "חסר קובץ בשדה file.", details={"fields": ["file"]})
                    name = name or part.filename
                    while chunk := await part.read(MB):
                        take(chunk)
                finally:
                    await form.close()
            else:
                while True:
                    message = await next_message()
                    if message["type"] == "http.disconnect":
                        raise ClientDisconnect()
                    if message["type"] != "http.request":
                        continue
                    if message.get("body"):
                        take(message["body"])
                    if not message.get("more_body", False):
                        break
    except BaseException:
        path.unlink(missing_ok=True)
        raise
    if size == 0:
        path.unlink(missing_ok=True)
        raise ApiError(422, "validation", "הקובץ ריק.", details={"fields": ["file"]})
    return {"path": path, "sha256": h.hexdigest(), "bytes": size, "name": bundle_svc.clean_text(name or "").strip()[:200] or None}


@router.post("/cases/bundles/verify")
async def verify_bundle(request: Request, name: str | None = Query(None, max_length=200), principal: Principal = Depends(_bundle_reader),
                        conn: sqlite3.Connection = Depends(get_read_conn)) -> dict[str, Any]:
    """Verify an evidence bundle (raw ZIP or multipart `file`, at most cases.import_max_mb, streamed to a temp file that
    is removed): refuses unsafe archives (ZIP-slip names, symlinks, bombs) with 422, then re-hashes every file of the
    manifest (ok / missing / mismatch / corrupt), checks the signature and reports the producing installation, whether it
    is this one, and a plain-language summary. Nothing from the bundle is executed or rendered."""
    settings = settings_of(request)
    cap = _upload_cap(conn)
    local_iid = bundle_svc.installation_id(conn)
    keyring = signing.load_keyring(settings)
    min_free = _min_free(conn)
    unsafe: bundle_svc.UnsafeBundle | None = None
    if not _TRANSFER_LOCK.acquire(blocking=False):
        raise _busy()
    try:
        with unlocked(conn):  # no read snapshot held while the upload streams in
            up = await _receive_bundle(request, settings, cap, name, min_free)
            try:
                report, _manifest = await run_in_threadpool(bundle_svc.verify_source, up["path"], keyring, local_iid, _limits(cap))
            except bundle_svc.UnsafeBundle as exc:
                unsafe = exc
            finally:
                up["path"].unlink(missing_ok=True)
    finally:
        _TRANSFER_LOCK.release()
    if unsafe is not None:
        audit(conn, actor=principal, action="case.bundle.verify", decision="denied", resource_type="bundle", resource_id=up["sha256"], reason=unsafe.code, request_id=_rid(request),
              details={"name": up["name"], "bytes": up["bytes"], "entries": len(unsafe.entries)})
        raise _unsafe_error(unsafe)
    existing = conn.execute("SELECT id, title FROM cases WHERE import_sha256 = ?", (up["sha256"],)).fetchone()
    report["bundle"] = {"sha256": up["sha256"], "bytes": up["bytes"], "name": up["name"]}
    report["already_imported"] = {"case_id": existing["id"], "title": existing["title"]} if existing else None
    report["importable"] = bool(report["ok"]) and existing is None
    audit(conn, actor=principal, action="case.bundle.verify", decision="allowed", resource_type="bundle", resource_id=up["sha256"], request_id=_rid(request),
          details={"name": up["name"], "ok": report["ok"], "files": len(report["files"]), "mismatches": sum(1 for f in report["files"] if f["status"] != "ok"),
                   "extra": len(report["extra"]), "source_installation": (report.get("origin") or {}).get("installation_id")})
    return report


@router.post("/cases/bundles/import", status_code=201)
async def import_bundle(request: Request, name: str | None = Query(None, max_length=200), principal: Principal = Depends(_bundle_importer),
                        conn: sqlite3.Connection = Depends(get_read_conn)) -> dict[str, Any]:
    """Import a verified evidence bundle as a NEW case marked imported (cases.manage at installation scope, checked
    before the body): verification runs again on the uploaded file and must pass; clips and snapshots are copied under
    <data>/imported/<bundle sha256>/, notes become read-only imported notes, provenance records the source installation,
    exporter, export time and the bundle hash. Nothing becomes a camera, plan, user or setting. The same bundle is
    refused with 409 while its case exists. Audited."""
    settings = settings_of(request)
    cap = _upload_cap(conn)
    local_iid = bundle_svc.installation_id(conn)
    keyring = signing.load_keyring(settings)
    db: Database = request.app.state.db
    min_free = _min_free(conn)
    if not _TRANSFER_LOCK.acquire(blocking=False):
        raise _busy()
    try:
        with unlocked(conn):
            up = await _receive_bundle(request, settings, cap, name, min_free)
            try:
                return await run_in_threadpool(_import_bundle, db, settings, up, principal, _rid(request), local_iid, keyring, cap, min_free)
            finally:
                up["path"].unlink(missing_ok=True)
    finally:
        _TRANSFER_LOCK.release()


def _import_bundle(db: Database, settings: Settings, up: dict[str, Any], principal: Principal, rid: str | None, local_iid: str | None,
                   keyring: dict[str, Any], cap: int, min_free: int = 0) -> dict[str, Any]:
    sha = up["sha256"]

    def refused(status: int, code: str, message: str, audit_reason: str, **details: Any) -> ApiError:
        with db.write_aside(label="POST /cases/bundles/import") as w:
            audit(w, actor=principal, action="case.import", decision="denied", resource_type="bundle", resource_id=sha, reason=audit_reason, request_id=rid,
                  details={"name": up["name"], "bytes": up["bytes"], **{k: v for k, v in details.items() if k in ("case_id", "counts", "errors", "reason")}})
        return ApiError(status, code, message, details=details)

    def duplicate(c: sqlite3.Connection) -> sqlite3.Row | None:
        return c.execute("SELECT id, title FROM cases WHERE import_sha256 = ?", (sha,)).fetchone()

    bundle_import.sweep_staging(settings)
    with db.connection(mode="read", label="POST /cases/bundles/import") as r:
        existing = duplicate(r)
    if existing:
        raise refused(409, "already_imported", f"החבילה הזו כבר יובאה לתיק \"{existing['title']}\".", "duplicate", case_id=existing["id"], title=existing["title"])
    try:
        report, manifest = bundle_svc.verify_source(up["path"], keyring, local_iid, _limits(cap))
    except bundle_svc.UnsafeBundle as exc:
        e = _unsafe_error(exc)
        raise refused(422, e.code, e.user_message, exc.code, **e.details) from None
    if not report["ok"] or manifest is None:
        raise refused(409, "bundle_not_verified", "החבילה לא עברה אימות ולכן לא יובאה. " + report["summary"], "not_verified",
                      counts=report["counts"], errors=report["errors"], files=[f for f in report["files"] if f["status"] != "ok"][:50], extra=report["extra"][:50])
    wanted = bundle_import.files_to_store(manifest)
    need = sum(f["bytes"] or 0 for f in report["files"] if f["path"] in wanted)
    free = bundle_import.free_bytes(settings)
    if free - need < min_free:
        e = _no_space(free, need, min_free)
        raise refused(507, e.code, e.user_message, "insufficient_storage", **e.details)
    staging = bundle_import.new_staging_dir(settings)
    final = bundle_import.case_dir(settings, sha)
    moved = False
    try:
        try:
            stored = bundle_import.extract(up["path"], wanted, staging)
        except (ValueError, OSError, zipfile.BadZipFile) as exc:
            raise refused(409, "bundle_changed", "החבילה השתנתה בזמן הייבוא; נסה שוב.", "changed", detail=type(exc).__name__) from None
        now = now_iso()
        prov = bundle_import.provenance(manifest, report, up, stored, principal, now)
        rows = bundle_import.plan_items(manifest, stored, sha, (report.get("origin") or {}).get("installation_id"))
        src_case = manifest.get("case") if isinstance(manifest.get("case"), dict) else {}
        title = (bundle_svc._s(src_case.get("title"), 120) or "").strip() or "תיק מיובא"
        description = (bundle_svc._s(src_case.get("description"), 4000) or "")
        tags = _clean_tags([bundle_svc.clean_text(t) for t in src_case.get("tags") or [] if isinstance(t, str)] if isinstance(src_case.get("tags"), list) else [])
        with db.connection(label="POST /cases/bundles/import") as w:
            again = duplicate(w)
            if again:
                audit(w, actor=principal, action="case.import", decision="denied", resource_type="bundle", resource_id=sha, reason="duplicate", request_id=rid, details={"case_id": again["id"]})
                raise conflict("already_imported", f"החבילה הזו כבר יובאה לתיק \"{again['title']}\".", case_id=again["id"], title=again["title"])
            if final.exists():
                shutil.rmtree(final)  # the leftover of an import that crashed before its commit: no case refers to it (checked above)
            final.parent.mkdir(parents=True, exist_ok=True)
            staging.rename(final)
            moved = True
            cid = new_id()
            w.execute(
                "INSERT INTO cases(id, title, description, status, tags_json, owner_user_id, owner_username, revision, created_at, updated_at, closed_at, origin, provenance_json, import_sha256) "
                "VALUES (?,?,?,'open',?,?,?,1,?,?,NULL,'imported',?,?)",
                (cid, title, description, json.dumps(tags, ensure_ascii=False), principal.user_id, principal.username, now, now, bundle_import.dump(prov), sha),
            )
            for row in rows:
                w.execute(
                    "INSERT INTO case_items(id, case_id, kind, camera_id, event_id, export_job_id, from_at, to_at, note, added_by, added_by_username, created_at, sort_order, file_path, file_sha256, origin_json) "
                    "VALUES (?,?,?,NULL,NULL,NULL,?,?,?,?,?,?,?,?,?,?)",
                    (new_id(), cid, row["kind"], row["from_at"], row["to_at"], row["note"], principal.user_id, principal.username, now, row["sort_order"], row["file_path"], row["file_sha256"], bundle_import.dump(row["origin"])),
                )
            audit(w, actor=principal, action="case.import", decision="allowed", resource_type="case", resource_id=cid, request_id=rid,
                  details={"bundle_sha256": sha, "bytes": up["bytes"], "name": up["name"], "source_installation": prov["source_installation_id"], "this_installation": prov["this_installation"],
                           "exported_at": prov["exported_at"], "items": len(rows), "files": prov["files_stored"], "stored_bytes": prov["bytes_stored"], "signature": prov["signature"].get("trust")})
            case = case_row(_get(w, cid), _counts(w, [cid])[cid])
    except BaseException:
        if moved:
            shutil.rmtree(final, ignore_errors=True)
        raise
    finally:
        shutil.rmtree(staging, ignore_errors=True)
    return {"case": case, "items": len(rows), "files": prov["files_stored"], "bytes": prov["bytes_stored"],
            "bundle": {"sha256": sha, "bytes": up["bytes"], "name": up["name"]},
            "report": {k: report.get(k) for k in ("ok", "summary", "counts", "origin", "signature", "schema", "schema_version", "authenticity")}}


# ---------------------------------------------------------------- evidence signing keys (T067)

@router.get("/evidence/signing")
def signing_info(request: Request, principal: Principal = Depends(current_principal), conn: sqlite3.Connection = Depends(get_conn)) -> dict[str, Any]:
    """The installation's evidence-signing keys — public halves only — with the trust statement; anyone who can
    verify a bundle may read them. The private half never leaves /data/keys and is not part of any backup."""
    return {**signing.public_info(settings_of(request)), "can_rotate": authorize(conn, principal, "system.configure", INSTALLATION).allowed,
            "installation_id": bundle_svc.installation_id(conn, create=True)}


@router.post("/evidence/signing/rotate")
def rotate_signing(request: Request, principal: Principal = Depends(current_principal), conn: sqlite3.Connection = Depends(get_conn)) -> dict[str, Any]:
    """New active key (system.configure); the previous public key stays in the ring as retired, so earlier bundles
    still verify and are reported as signed by a retired key of this installation."""
    require(conn, principal, "system.configure", INSTALLATION)
    info = signing.rotate(settings_of(request))
    audit(conn, actor=principal, action="evidence.key.rotate", decision="allowed", resource_type="installation", resource_id="*", request_id=_rid(request),
          details={"active": info["active"], "keys": len(info["keys"])})
    return {**info, "can_rotate": True}

