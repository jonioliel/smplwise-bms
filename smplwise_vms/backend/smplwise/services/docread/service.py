"""SUPPLIERDOCS-297: document reading for the maintenance module's certificate / supplier-document files - proposals and the
field-by-field decisions (docs/changes/CR-SUPPLIERDOCS-297.md).

Rules of this slice (PROVISIONAL - owner questions q52-q56 are open; each rule sits in one place so an answer is a small change):
* kind = certificate only; source = a file already attached to a `certificate` / `vendor_document` task (`maint_files`). No upload
  route, no read at upload time, never reachable from a public page.
* text-layer PDFs only. A picture or a PDF without a text layer ends in `needs_ocr` (the OCR port has only its null reader).
* no external or local model: the model port has only its null implementation and nothing selects it.
* the read stores PROPOSALS. The task itself never changes here (applying the decided values to the task is the next slice).
* every field is decided on its own (confirm / edit / reject); there is no "approve all" anywhere. All five decided -> `reviewed`.
* the stored row holds the parsed candidates with <= 80-character scrubbed snippets, never the document text; the audit holds ids,
  counts, field NAMES and decisions, never a value. Drafts are deleted RETENTION_DAYS after the last activity, or with their file."""
from __future__ import annotations

import json
import re
import sqlite3
import threading
import time
from datetime import date, datetime, timedelta, timezone
from pathlib import Path
from typing import Any, Callable

from ...audit import audit
from ...db import Database, get_setting, new_id
from ...errors import ApiError
from ..maintenance import access as maccess
from ..maintenance import service as msvc
from ..maintenance.access import MANAGE, Viewer
from . import certificate_rules, ports
from .pdftext import PdftotextReader

FEATURE_KEY = "docread.enabled"
KINDS = ("certificate",)
FIELDS = certificate_rules.FIELDS
DECISIONS = ("confirm", "edit", "reject")
MAX_PAGES = 10            # tier 1 page cap (CR-OCR119 section 6.1)
OCR_MAX_PAGES = 4         # tier 2 page cap (for the OCR port, not built)
RETENTION_DAYS = 14       # an undecided / reviewed draft is deleted this long after its last activity (CR-OCR119 q10, recommended)
DOCNO_MAX = 60
LIVE = ("proposed", "reviewed", "needs_ocr")
OPEN = ("proposed", "reviewed")
_ISO_DATE = re.compile(r"^\d{4}-\d{2}-\d{2}$")

_text_reader_override: ports.TextLayerReader | None = None
_ocr_reader: ports.OcrReader = ports.NullOcrReader()
MODEL: ports.ModelExtractor = ports.NullModelExtractor()  # tier 3 seam: never called in this slice


def set_text_reader(reader: ports.TextLayerReader | None) -> None:
    """Tests inject a fake reader; None restores the default (pdftotext from PATH)."""
    global _text_reader_override
    _text_reader_override = reader


def text_reader() -> ports.TextLayerReader:
    return _text_reader_override if _text_reader_override is not None else PdftotextReader()


def set_ocr_reader(reader: ports.OcrReader | None) -> None:
    """The OCR extension point (tier 2, a later slice): None restores the null reader."""
    global _ocr_reader
    _ocr_reader = reader or ports.NullOcrReader()


# ---------------------------------------------------------------- gates

def enabled(conn: sqlite3.Connection) -> bool:
    return (get_setting(conn, FEATURE_KEY, "false") or "false") == "true"


def require_enabled(conn: sqlite3.Connection) -> None:
    if not enabled(conn):
        raise ApiError(404, "feature_disabled", "קריאת מסמכים כבויה בהגדרות המערכת.")


def module_state(conn: sqlite3.Connection) -> dict[str, Any]:
    reader = text_reader()
    return {"enabled": enabled(conn), "kinds": list(KINDS), "fields": list(FIELDS), "text_reader": getattr(reader, "name", "none"),
            "ocr": not isinstance(_ocr_reader, ports.NullOcrReader), "model": MODEL.name, "confirm": "per_field", "provisional": True}


def _not_found() -> ApiError:
    return ApiError(404, "docread_not_found", "הקריאה לא נמצאה.")


# ---------------------------------------------------------------- presentation

def _purge_at(now: datetime) -> str:
    return (now + timedelta(days=RETENTION_DAYS)).strftime("%Y-%m-%dT%H:%M:%SZ")


def out(conn: sqlite3.Connection, r: sqlite3.Row, viewer: Viewer | None = None, task: Any = None) -> dict[str, Any]:
    fields = json.loads(r["fields_json"] or "{}")
    shown = {name: {"proposed": f.get("proposed"), "confidence": f.get("confidence", "none"), "evidence": f.get("evidence", ""),
                    "snippet": f.get("snippet", ""), "status": f.get("status", "proposed"), "value": f.get("value"),
                    "decided_by_name": msvc._user_name(conn, f["decided_by"]) if f.get("decided_by") else None, "decided_at": f.get("decided_at")}
             for name, f in fields.items()}
    can_decide = bool(viewer is not None and task is not None and r["state"] in OPEN and viewer.holds_on(MANAGE, task))
    return {"id": r["id"], "kind": r["kind"], "task_id": r["task_id"], "file_id": r["source_id"], "state": r["state"], "error_code": r["error_code"],
            "summary": r["summary"], "flags": json.loads(r["flags_json"] or "[]"), "engine": r["engine"], "rules_version": r["rules_version"],
            "tier": r["tier"], "pages": r["pages"], "fields": shown, "requested_by_name": msvc._user_name(conn, r["requested_by"]),
            "requested_at": r["requested_at"], "reviewed_by_name": msvc._user_name(conn, r["reviewed_by"]) if r["reviewed_by"] else None,
            "reviewed_at": r["reviewed_at"], "revision": r["revision"], "confirm": "per_field", "provisional": True, "can": {"decide": can_decide}}


# ---------------------------------------------------------------- reading

def read_precheck(viewer: Viewer, task_id: str, file_id: str) -> tuple[sqlite3.Row, sqlite3.Row]:
    """Before anything is read: the task is visible, is a certificate or a supplier document, the caller manages it (an audited 403),
    and the file belongs to it."""
    task = msvc.require_task(viewer, task_id)
    if task["kind"] not in msvc.FILE_KINDS:
        raise ApiError(409, "docread_kind_not_supported", "קריאת מסמכים זמינה לאישורים ולמסמכי ספקים בלבד.")
    viewer.require_on(MANAGE, task, action="docread.read")
    return task, msvc.file_get(viewer, task_id, file_id)


def live_for(conn: sqlite3.Connection, file_id: str) -> sqlite3.Row | None:
    return conn.execute(f"SELECT * FROM doc_extractions WHERE source_kind = 'maint_file' AND source_id = ? AND state IN ({','.join('?' * len(LIVE))})",
                        (file_id, *LIVE)).fetchone()


def run_reader(file_kind: str, path: Path) -> ports.TextResult:
    """Blocking (a child process): the caller runs it outside the write lock. A picture goes to the OCR port (null in this slice)."""
    if file_kind != "pdf":
        return _ocr_reader.read(path, max_pages=OCR_MAX_PAGES)
    res = text_reader().read(path, max_pages=MAX_PAGES)
    if not isinstance(res, ports.TextResult) or res.status not in ("ok", "no_text", "unreadable", "too_many_pages", "timeout", "unavailable"):
        return ports.TextResult(status="unreadable", engine=getattr(res, "engine", "none"))
    if res.status == "no_text":  # a scanned PDF: tier 2 would take it from here
        ocr = _ocr_reader.read(path, max_pages=OCR_MAX_PAGES)
        if ocr.status == "ok":
            return ocr
        return ports.TextResult(status="no_text", pages=res.pages, engine=res.engine)
    return res


READ_CONCURRENCY = 2      # security review SUPPLIERDOCS2-297 (F3): at most this many reads (child + rules) at once in the add-on
_READ_SLOTS = threading.BoundedSemaphore(READ_CONCURRENCY)


def read_slot() -> bool:
    """Take a reading slot without waiting; False = all slots busy (the route answers 429 `busy`). Release with `release_slot()`."""
    return _READ_SLOTS.acquire(blocking=False)


def release_slot() -> None:
    _READ_SLOTS.release()


def analyse(res: ports.TextResult) -> ports.Extraction | None:
    """The rules over a read text (pure CPU work): the caller runs it OUTSIDE the database write lock (security review F1)."""
    if res.status != "ok":
        return None
    return certificate_rules.extract(res.text[: 1024 * 1024])


_STATE_OF = {"no_text": ("needs_ocr", "no_text_layer"), "ocr_not_available": ("needs_ocr", "ocr_not_available"),
             "unreadable": ("failed", "unreadable"), "too_many_pages": ("failed", "too_many_pages"), "timeout": ("failed", "timeout")}


def store(viewer: Viewer, task: sqlite3.Row, frow: sqlite3.Row, res: ports.TextResult, rid: str | None,
          ext: ports.Extraction | None = None) -> sqlite3.Row:
    """`ext`: the result of `analyse(res)`, computed by the caller outside the write lock; computed here only when missing."""
    conn = viewer.conn
    now = maccess.now()
    xid = new_id()
    fields: dict[str, Any] = {}
    summary, flags, state, code = None, [], "proposed", None
    ext = ext or analyse(res)
    if ext is not None:
        summary, flags = ext.summary, list(ext.flags)
        for name in FIELDS:
            f = ext.fields[name]
            fields[name] = {"proposed": f.value, "confidence": f.confidence, "evidence": f.evidence[:40], "snippet": f.snippet[: ports.SNIPPET_MAX],
                            "status": "proposed", "value": None, "decided_by": None, "decided_at": None}
    else:
        state, code = _STATE_OF.get(res.status, ("failed", "unreadable"))
    conn.execute("INSERT INTO doc_extractions(id, kind, source_kind, source_id, task_id, file_sha256, tier, engine, rules_version, state, error_code, pages,"
                 " summary, flags_json, fields_json, requested_by, requested_at, purge_after) VALUES (?, 'certificate', 'maint_file', ?, ?, ?, 1, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
                 (xid, frow["id"], task["id"], frow["sha256"], (res.engine or "none")[:40], certificate_rules.RULES_VERSION, state, code, res.pages or None,
                  summary, json.dumps(flags), json.dumps(fields, ensure_ascii=False), viewer.uid, now.strftime("%Y-%m-%dT%H:%M:%SZ"), _purge_at(now)))
    audit(conn, actor=viewer.principal, action="docread.read", decision="allowed", resource_type="maint_task", resource_id=task["id"], request_id=rid,
          details={"extraction_id": xid, "file_id": frow["id"], "state": state, "error_code": code, "engine": res.engine, "tier": 1,
                   "fields_found": sum(1 for f in fields.values() if f["proposed"] is not None), "fields_total": len(fields)})
    return conn.execute("SELECT * FROM doc_extractions WHERE id = ?", (xid,)).fetchone()


# ---------------------------------------------------------------- reading a proposal back

def _visible(viewer: Viewer, xid: str) -> tuple[sqlite3.Row, sqlite3.Row]:
    """The proposal and its task: the task visible (maintenance.view), the file still attached - otherwise the same 404."""
    r = viewer.conn.execute("SELECT * FROM doc_extractions WHERE id = ?", (xid,)).fetchone()
    if r is None or not r["task_id"]:
        raise _not_found()
    try:
        task = msvc.require_task(viewer, r["task_id"])
    except ApiError:
        raise _not_found() from None
    f = viewer.conn.execute("SELECT 1 FROM maint_files WHERE id = ? AND task_id = ? AND deleted_at IS NULL", (r["source_id"], r["task_id"])).fetchone()
    if f is None:
        raise _not_found()
    return r, task


def get(viewer: Viewer, xid: str) -> dict[str, Any]:
    r, task = _visible(viewer, xid)
    return out(viewer.conn, r, viewer, task)


def for_file(viewer: Viewer, task_id: str, file_id: str) -> dict[str, Any] | None:
    task = msvc.require_task(viewer, task_id)
    msvc.file_get(viewer, task_id, file_id)
    r = live_for(viewer.conn, file_id)
    return out(viewer.conn, r, viewer, task) if r is not None and r["task_id"] == task_id else None


# ---------------------------------------------------------------- the person decides, one field at a time

def _invalid(field: str, problem: str) -> ApiError:
    return ApiError(422, "validation", "ערך לא תקין: " + field, details={"fields": [field], "problem": problem})


def _edited_value(field: str, raw: Any) -> str:
    if not isinstance(raw, str):
        raise _invalid(field, "required")
    text = " ".join(certificate_rules.normalise(raw).split())
    if not text:
        raise _invalid(field, "required")
    if field in certificate_rules.DATE_FIELDS:
        if not _ISO_DATE.fullmatch(text):
            raise _invalid(field, "date_format")
        try:
            d = date.fromisoformat(text)
        except ValueError:
            raise _invalid(field, "date_invalid") from None
        if not (certificate_rules.YEAR_MIN <= d.year <= certificate_rules.YEAR_MAX):
            raise _invalid(field, "date_range")
        return d.isoformat()
    limit = DOCNO_MAX if field == "document_number" else ports.VALUE_MAX
    if len(text) > limit:
        raise _invalid(field, "too_long")
    return text


def decide(viewer: Viewer, xid: str, field: str, body: dict[str, Any], rid: str | None) -> dict[str, Any]:
    conn = viewer.conn
    r, task = _visible(viewer, xid)
    viewer.require_on(MANAGE, task, action="docread.field")
    if r["state"] not in OPEN:
        raise ApiError(409, "docread_closed", "הקריאה הזו כבר סגורה.", details={"state": r["state"]})
    if body.get("revision") != r["revision"]:
        raise ApiError(409, "revision_conflict", "הקריאה עודכנה בינתיים.", details={"revision": r["revision"]})
    decision = body.get("decision")
    if decision not in DECISIONS:
        raise _invalid("decision", "unknown")
    fields = json.loads(r["fields_json"] or "{}")
    if field not in fields:
        raise _invalid(field, "unknown")
    f = fields[field]
    has_value = body.get("value") is not None
    if decision == "edit":
        value = _edited_value(field, body.get("value"))
        status = "edited"
    else:
        if has_value:
            raise _invalid(field, "value_not_allowed")
        if decision == "confirm":
            if f.get("proposed") is None:
                raise ApiError(422, "docread_nothing_to_confirm", "לא נמצא ערך לאישור. אפשר להזין ערך או לדחות את השדה.", details={"field": field})
            value, status = f["proposed"], "confirmed"
        else:
            value, status = None, "rejected"
    now = maccess.now()
    stamp = now.strftime("%Y-%m-%dT%H:%M:%SZ")
    f.update({"status": status, "value": value, "decided_by": viewer.uid, "decided_at": stamp})
    all_done = all(x.get("status") != "proposed" for x in fields.values())
    state = "reviewed" if all_done else "proposed"
    reviewed_by, reviewed_at = (viewer.uid, stamp) if all_done and r["state"] != "reviewed" else (r["reviewed_by"], r["reviewed_at"])
    conn.execute("UPDATE doc_extractions SET fields_json = ?, state = ?, reviewed_by = ?, reviewed_at = ?, purge_after = ?, revision = revision + 1 WHERE id = ?",
                 (json.dumps(fields, ensure_ascii=False), state, reviewed_by, reviewed_at, _purge_at(now), xid))
    audit(conn, actor=viewer.principal, action="docread.field", decision="allowed", resource_type="maint_task", resource_id=task["id"], request_id=rid,
          details={"extraction_id": xid, "field": field, "decision": decision, "state": state})  # the field NAME, never its value
    return out(conn, conn.execute("SELECT * FROM doc_extractions WHERE id = ?", (xid,)).fetchone(), viewer, task)


def discard(viewer: Viewer, xid: str, rid: str | None) -> dict[str, Any]:
    conn = viewer.conn
    r, task = _visible(viewer, xid)
    viewer.require_on(MANAGE, task, action="docread.discard")
    if r["state"] == "discarded":
        return out(conn, r, viewer, task)
    conn.execute("UPDATE doc_extractions SET state = 'discarded', fields_json = '{}', flags_json = '[]', purge_after = ?, revision = revision + 1 WHERE id = ?",
                 (_purge_at(maccess.now()), xid))
    audit(conn, actor=viewer.principal, action="docread.discard", decision="allowed", resource_type="maint_task", resource_id=task["id"], request_id=rid,
          details={"extraction_id": xid})
    return out(conn, conn.execute("SELECT * FROM doc_extractions WHERE id = ?", (xid,)).fetchone(), viewer, task)


# ---------------------------------------------------------------- retention

def purge(conn: sqlite3.Connection, at: datetime | None = None) -> int:
    """Delete drafts past their retention and every proposal whose file or task was removed (the task: security review F6). Returns the
    number of rows deleted."""
    stamp = (at or maccess.now()).astimezone(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")
    cur = conn.execute("DELETE FROM doc_extractions WHERE purge_after < ? OR (source_kind = 'maint_file' AND source_id IN"
                       " (SELECT id FROM maint_files WHERE deleted_at IS NOT NULL))"
                       " OR task_id IN (SELECT id FROM maint_tasks WHERE deleted_at IS NOT NULL)", (stamp,))
    return cur.rowcount or 0


_JANITOR_LOCK = threading.Lock()
_last_janitor = 0.0
JANITOR_EVERY_S = 3600.0


def janitor(db: Database, clock: Callable[[], float] = time.monotonic) -> int:
    """Hourly from the housekeeping loop (main.py). Runs whatever the switch says: turning the feature off must not keep drafts alive."""
    global _last_janitor
    with _JANITOR_LOCK:
        if _last_janitor and clock() - _last_janitor < JANITOR_EVERY_S:
            return 0
        _last_janitor = clock()
    with db.connection() as conn:
        return purge(conn)
