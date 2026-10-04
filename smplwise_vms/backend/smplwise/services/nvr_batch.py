"""CR-020 S2 phase C: the same stream change on many cameras of one recorder (docs/architecture/NVR_SETTINGS_API.md 3.7).

The batch runs on the SERVER, in a background thread with its own connections, one camera at a time - closing the page
never stops it, the operator can stop it, and every decision is read from the database (one source of truth for the
status route). Owner decisions 2026-10-03 (binding):
- always on (no gate), one audit row per batch naming who started it, plus the S2A per-item rows carrying `batch_id`;
- allowed fields v1: exactly `{"svc": false}`; any H.264 main stream whose SVC is on, derived from the device (no channel
  list); no cap on the number of cameras (an input-size guard only, MAX_TARGETS); progress is paged, memory bounded (the
  runner holds one item at a time);
- each item is the unchanged S2A guarded write (`nvr_settings.write_stream` with `batch` / `adopt`): fresh read, own etag
  check, pending row committed before the PUT, the PUT outside the write lock, the outcome in one transaction;
- the first failure stops the batch (remaining items `not_attempted`); never a retry, never a re-order, never a skip;
- an UNKNOWN device outcome stops the batch, then ONE read-only check of that camera (after UNKNOWN_CHECK_DELAY_S, the
  time the device may still be applying the PUT): the batch continues by itself only when the check PROVES the change
  was applied; not applied, partial or unreadable -> `interrupted`, the rest `not_attempted`;
- while a batch runs, single writes / undos on the same recorder are refused 409 `batch_in_progress` (nvr_settings.batch_guard);
- `nvr.configure` at installation scope plus `require_camera` for every target, up front and again per item;
- undo-all = a NEW batch of single undos in reverse order, confirmed once (the toast press is that confirmation);
- a restart never resumes a write: `recover_batches` marks a batch whose runner is gone `interrupted`.

Security review 2026-10-04 (private/cr020-s2c-review/SECURITY_REVIEW.md), fixed on pilot/CR020-s2c-fixes:
- the unknown check counts `applied` only when every other encoding field is unchanged (nvr_settings._settle_one), and an
  undo restores only the fields our change modified (nvr_settings.rollback_stream);
- every item runs under a hard wall-clock deadline (ITEM_DEADLINE_S, nvr.deadline); a runner still inside one item after
  HUNG_AFTER_S is abandoned by "stop" or by the periodic recovery (`deadline`): the batch ends `interrupted`, the lock is
  released, its queued items can never be claimed (no further PUT) and the late thread never rewrites the end;
- status, list and stop answer on a READ connection; a dead batch is ended by the periodic maintenance (janitor_tick) or by
  an explicit stop - a GET never reads the device or writes;
- the lock is keyed by the device (`adapter.device_key`), not by the recorder row;
- the permission is checked again under the write lock right before the item's claim.

Single process (review finding 13): the add-on runs ONE worker process. `_live` (the runners of this process) is the
source of truth for "is this runner alive"; start-up recovery interrupts every batch left running. A second worker would
interrupt another worker's live batch at its start-up and could not see its runners - it would need a per-process id with
the heartbeat before more than one worker is ever configured.

Storage without a migration (0050 already has `nvr_changes.batch_id` / `batch_index`): the items are `nvr_changes` rows
(placeholder status `queued` until their turn - outside the partial unique index of pending rows and invisible to the
pending janitor); the batch's own record, its heartbeat and the device lock are three keys of the `settings` table
(META_KEY, BEAT_KEY, nvr_settings.BATCH_ACTIVE_KEY) - never in a backup and never restored (services/backup.py). No
response, audit row or log line carries a device address, a device user name, a password, a serial number or a MAC.
"""
from __future__ import annotations

import json
import logging
import re
import sqlite3
import threading
import time
from dataclasses import dataclass
from typing import Any

from ..audit import audit
from ..config import Settings
from ..db import commit_now, get_setting, new_id, now_iso, set_setting, unlocked
from ..errors import ApiError
from ..rbac import INSTALLATION, require
from . import nvr, nvr_settings
from .access import camera_scope, require_camera
from .recorders import registry

log = logging.getLogger(__name__)

WRITE_PERMISSION = nvr_settings.WRITE_PERMISSION
BATCH_FIELDS: dict[str, Any] = {"svc": False}  # the allow-list v1: exactly this change
MIN_TARGETS = 2  # one camera is the single route
MAX_TARGETS = 1024  # an input-size guard against an abusive body, not a product cap (a recorder has at most 256 channels here)
BEAT_STALE_S = 180  # a running batch whose heartbeat is older than this and whose runner is not in this process is interrupted
BEAT_EVERY_S = 20.0
UNKNOWN_CHECK_DELAY_S = float(nvr_settings.UNKNOWN_SETTLE_MIN_S)  # tests set 0
# review finding 2: the hard wall-clock limit of one item's device work (reads, PUT, verify; nvr.deadline) and of the
# read-only check after an unknown outcome. A runner still inside one item HUNG_AFTER_S after it began (something the
# deadline cannot reach) is abandoned by stop / recovery.
ITEM_DEADLINE_S = 90.0
CHECK_DEADLINE_S = 30.0
HUNG_AFTER_S = ITEM_DEADLINE_S + 60.0
PAGE_DEFAULT = 200
PAGE_MAX = 500
LIST_LIMIT = 20
META_KEY = "nvr.batch.{}"
BEAT_KEY = "nvr.batch.{}.beat"
ACTIONS = {"write": "nvr.stream.batch", "rollback": "nvr.stream.batch.rollback"}
CAMERA_ID_RE = re.compile(r"^[A-Za-z0-9_.:-]{1,64}$")
STREAM_REF_RE = re.compile(r"^\d{1,6}$")
ETAG_RE = re.compile(r"^[0-9a-f]{16}$")
RECORDER_RE = re.compile(r"^[A-Za-z0-9_.-]{1,40}$")
# why a batch ended without completing -> its state
STOP_STATES = {"user_stop": "stopped", "item_failed": "failed", "item_refused": "failed", "forbidden": "failed",
               "unknown_not_applied": "interrupted", "unknown_unverified": "interrupted", "unknown_diverged": "interrupted", "deadline": "interrupted",
               "interrupted": "interrupted", "shutdown": "interrupted", "error": "interrupted"}
# the operator's line per item (server-side, short, no device detail)
MESSAGES = {
    "queued": "ממתין.", "running": "מתבצע.", "applied": "נשמר.", "unchanged": "כבר מוגדר כך.", "rolled_back": "הוחזר.",
    "unknown": "לא ברור אם בוצע. נבדק מול ה־NVR.", "no_effect": "ה־NVR לא שינה את ההגדרה.", "diverged": "ה־NVR שינה רק חלק מההגדרה.",
}
ERROR_MESSAGES = {
    "stopped": "לא בוצע (נעצר).", "earlier_failure": "לא בוצע (נעצר בשגיאה קודמת).", "earlier_unknown": "לא בוצע (נעצר אחרי תוצאה לא ברורה).",
    "interrupted": "לא בוצע (השינוי נקטע).", "stale": "ההגדרות השתנו ב־NVR.", "nvr_busy": "ה־NVR עסוק.", "forbidden": "אין הרשאה למצלמה הזו.",
    "write_in_progress": "שינוי אחר של הזרם הזה מתבצע.", "batch_in_progress": "מתבצע שינוי מרובה.", "outcome_unknown": "לא ברור אם בוצע. נבדק מול ה־NVR.",
    "not_rollbackable": "אי אפשר לבטל את השינוי הזה.", "capabilities_unreadable": "ה־NVR אינו מפרסם את יכולות הזרם.", "source_unavailable": "ה־NVR אינו זמין.",
    "source_timeout": "ה־NVR לא ענה בזמן.",
}

_live: dict[str, threading.Thread] = {}
_item_started: dict[str, float] = {}  # batch id -> monotonic start of the item its runner is inside now (finding 2)
_live_lock = threading.Lock()
_shutdown = threading.Event()


# ------------------------------------------------------------------------------------------------ body

@dataclass(frozen=True)
class Target:
    camera_id: str
    stream_ref: str
    if_match: str


@dataclass(frozen=True)
class BatchRequest:
    targets: tuple[Target, ...]
    recorder_id: str | None


def _invalid(message: str, **details: Any) -> ApiError:
    return ApiError(422, "validation", message, details=details or None)


def parse_batch_body(body: Any) -> BatchRequest:
    """`POST /nvr/stream-batches` body. `confirm` first (only the JSON literal true; a missing confirmation never reaches a
    device read), then the allow-list of the change, then the targets (strict JSON types)."""
    if not isinstance(body, dict) or body.get("confirm") is not True:
        raise ApiError(422, "confirm_required", "יש לאשר את השינוי.")
    extra = set(body) - {"confirm", "changes", "targets", "recorder_id"}
    if extra:
        raise _invalid("בקשה לא תקינה.", extra=sorted(str(k)[:32] for k in extra)[:5])
    changes = body.get("changes")
    if not isinstance(changes, dict):
        raise _invalid("בקשה לא תקינה.", field="changes")
    if set(changes) != set(BATCH_FIELDS) or any(changes[k] is not v for k, v in BATCH_FIELDS.items()):
        raise ApiError(422, "batch_field_not_allowed", "שינוי מרובה מאפשר כרגע רק כיבוי SVC.", details={"allowed": BATCH_FIELDS})
    rid = body.get("recorder_id")
    if rid is not None and (not isinstance(rid, str) or not RECORDER_RE.fullmatch(rid)):
        raise _invalid("מזהה NVR לא תקין.", field="recorder_id")
    raw = body.get("targets")
    if not isinstance(raw, list) or not MIN_TARGETS <= len(raw) <= MAX_TARGETS:
        raise _invalid("יש לבחור לפחות שתי מצלמות.", field="targets", min=MIN_TARGETS, max=MAX_TARGETS)
    targets: list[Target] = []
    refs: set[str] = set()
    cams: set[str] = set()
    for i, t in enumerate(raw):
        ok = (isinstance(t, dict) and set(t) == {"camera_id", "stream_ref", "if_match"} and isinstance(t["camera_id"], str) and CAMERA_ID_RE.fullmatch(t["camera_id"])
              and isinstance(t["stream_ref"], str) and STREAM_REF_RE.fullmatch(t["stream_ref"]) and isinstance(t["if_match"], str) and ETAG_RE.fullmatch(t["if_match"]))
        if not ok:
            raise _invalid("יעד לא תקין.", index=i)
        if t["stream_ref"] in refs or t["camera_id"] in cams:
            raise _invalid("אותה מצלמה או אותו זרם נבחרו פעמיים.", index=i, duplicate=True)
        refs.add(t["stream_ref"])
        cams.add(t["camera_id"])
        targets.append(Target(t["camera_id"], t["stream_ref"], t["if_match"]))
    return BatchRequest(tuple(targets), rid)


def authorize_targets(conn: sqlite3.Connection, principal: Any, camera_ids: list[str]) -> None:
    """`nvr.configure` on EVERY target camera's chain: the first deny is a 403 for the whole batch (audited by `require`)."""
    for cid in camera_ids:
        require_camera(conn, principal, cid, WRITE_PERMISSION)


# ------------------------------------------------------------------------------------------------ batch record

def _meta(conn: sqlite3.Connection, batch_id: str) -> dict[str, Any] | None:
    raw = get_setting(conn, META_KEY.format(batch_id))
    if not raw:
        return None
    try:
        meta = json.loads(raw)
    except ValueError:
        return None
    return meta if isinstance(meta, dict) else None


def _save_meta(conn: sqlite3.Connection, batch_id: str, meta: dict[str, Any]) -> None:
    set_setting(conn, META_KEY.format(batch_id), json.dumps(meta, ensure_ascii=False, separators=(",", ":")))


def _beat(conn: sqlite3.Connection, batch_id: str) -> None:
    set_setting(conn, BEAT_KEY.format(batch_id), now_iso())


def _beat_age_s(conn: sqlite3.Connection, batch_id: str) -> float:
    raw = get_setting(conn, BEAT_KEY.format(batch_id))
    if not raw:
        return 10.0**9
    return nvr_settings._age_s(raw)


def _is_live(batch_id: str) -> bool:
    with _live_lock:
        t = _live.get(batch_id)
    return t is not None and t.is_alive()


def _hung(batch_id: str) -> bool:
    """A live runner that has been inside one item longer than HUNG_AFTER_S (the per-item deadline did not stop it)."""
    with _live_lock:
        t = _live.get(batch_id)
        began = _item_started.get(batch_id)
    return t is not None and t.is_alive() and began is not None and time.monotonic() - began > HUNG_AFTER_S


def lock_key(conn: sqlite3.Connection, settings: Settings | None, recorder_id: str) -> str:
    """The `settings` key of the batch lock of the DEVICE behind this recorder row (review finding 6)."""
    try:
        adapter: Any = registry.adapter_for(conn, settings, recorder_id)  # type: ignore[arg-type] - builds only, no device call
    except ApiError:
        adapter = None
    return nvr_settings.batch_lock_key(adapter, recorder_id)


def _release_lock(conn: sqlite3.Connection, batch_id: str) -> None:
    """The heartbeat and whichever device lock this batch holds (only when it is still this batch's)."""
    conn.execute("DELETE FROM settings WHERE key = ?", (BEAT_KEY.format(batch_id),))
    conn.execute("DELETE FROM settings WHERE key LIKE 'nvr.batch.active.%' AND value = ?", (batch_id,))


def _abort_rest(conn: sqlite3.Connection, batch_id: str, why: str) -> int:
    return conn.execute("UPDATE nvr_changes SET status = 'not_attempted', error = ? WHERE batch_id = ? AND status = 'queued'", (why, batch_id)).rowcount


def _item_status(r: sqlite3.Row) -> str:
    s = str(r["status"])
    if s == "pending":
        return "unknown" if r["error"] == "outcome_unknown" else "running"
    return s


def _counts(conn: sqlite3.Connection, batch_id: str) -> dict[str, int]:
    out: dict[str, int] = {}
    for r in conn.execute("SELECT status, error, COUNT(*) AS n FROM nvr_changes WHERE batch_id = ? GROUP BY status, error", (batch_id,)).fetchall():
        key = _item_status(r)
        out[key] = out.get(key, 0) + int(r["n"])
    return out


def _item(r: sqlite3.Row) -> dict[str, Any]:
    status = _item_status(r)
    code = r["error"] if r["error"] and r["error"] != status else None
    message = ERROR_MESSAGES.get(code or "", None) if code else None
    if message is None:
        message = MESSAGES.get(status) or ("השינוי נדחה." if status == "refused" else "השינוי נכשל.")
    return {"index": r["batch_index"], "camera_id": r["camera_id"], "stream_ref": r["stream_ref"], "status": status, "change_id": r["id"],
            "rollback_of": r["rollback_of"], "error_code": code, "user_message": message, "reboot_required": bool(r["reboot_required"])}


# ------------------------------------------------------------------------------------------------ create

def _audit_batch(conn: sqlite3.Connection, actor: Any, kind: str, decision: str, recorder_id: str, details: dict[str, Any], *, reason: str | None = None,
                 request_id: str | None = None) -> None:
    audit(conn, actor=actor, action=ACTIONS[kind], decision=decision, resource_type="recorder", resource_id=recorder_id, reason=reason, request_id=request_id, details=details)


def refuse(conn: sqlite3.Connection, principal: Any, exc: ApiError, request_id: str | None, kind: str = "write", recorder_id: str = "*", **details: Any) -> ApiError:
    """An authorized batch request refused before any device write: one denied audit row with the reason code."""
    _audit_batch(conn, principal, kind, "denied", recorder_id, {"phase": "attempt", **details}, reason=exc.code, request_id=request_id)
    return exc


def _recorder_of(conn: sqlite3.Connection, req: BatchRequest) -> tuple[str, dict[str, sqlite3.Row]]:
    ids = [t.camera_id for t in req.targets]
    rows: dict[str, sqlite3.Row] = {}
    for start in range(0, len(ids), 500):
        chunk = ids[start:start + 500]
        for r in conn.execute(f"SELECT id, recorder_id, channel FROM cameras WHERE id IN ({','.join('?' * len(chunk))})", chunk).fetchall():
            rows[r["id"]] = r
    for i, t in enumerate(req.targets):
        r = rows.get(t.camera_id)
        if r is None or r["channel"] is None:
            raise ApiError(404, "not_found", "המצלמה לא נמצאה.", details={"index": i})
    recorders = {rows[t.camera_id]["recorder_id"] for t in req.targets}
    if len(recorders) != 1:
        raise _invalid("כל המצלמות צריכות להיות באותו NVR.", field="targets")
    rid = recorders.pop()
    if req.recorder_id is not None and req.recorder_id != rid:
        raise _invalid("המצלמות אינן שייכות ל־NVR הזה.", field="recorder_id")
    return rid, rows


def _not_allowed(i: int, reason: str) -> ApiError:
    return ApiError(422, "batch_target_not_allowed", "הזרם הזה אינו מתאים לשינוי המרובה.", details={"index": i, "reason": reason})


def _preflight(conn: sqlite3.Connection, settings: Settings, rid: str, req: BatchRequest, cams: dict[str, sqlite3.Row]) -> None:
    """Read-only: ONE LIST read for the whole recorder, then per target the stream's camera, role main, codec H.264, SVC on
    now, the etag the dialog saw, a capability document (cached per process) and the S2A validation. Any failure refuses
    the whole request; nothing is written. Advisory only - each item repeats every S2A check at its own turn."""
    adapter = registry.adapter_for(conn, settings, rid)
    with unlocked(conn):
        by_channel = adapter.read_stream_encodings()
        found: dict[int, Any] = {}
        for i, t in enumerate(req.targets):
            stream = next((s for s in by_channel.get(str(cams[t.camera_id]["channel"]), []) if s.stream_ref == t.stream_ref), None)
            if stream is None:
                found[i] = None
                continue
            try:
                found[i] = (stream, adapter.stream_options(t.stream_ref) if stream.role == "main" and stream.etag == t.if_match else None)
            except ApiError as exc:
                found[i] = (stream, exc)
    for i, t in enumerate(req.targets):
        got = found.get(i)
        if got is None:  # the stream is not this camera's (or is gone)
            raise ApiError(404, "not_found", "הזרם אינו שייך למצלמה הזו.", details={"index": i})
        stream, opts = got
        enc = stream.encoding
        if stream.role != "main":
            raise _not_allowed(i, "role")
        if stream.etag != t.if_match:
            raise ApiError(409, "stale", "ההגדרות השתנו ב־NVR. נטען מחדש.", details={"index": i, "stream": nvr_settings._stream_dict(stream)})
        if enc.get("codec") != "H.264":
            raise _not_allowed(i, "codec")
        if enc.get("svc") is not True:
            raise _not_allowed(i, "svc")
        if isinstance(opts, ApiError):
            raise ApiError(opts.status, opts.code, opts.message, details={"index": i})
        if opts is None or not opts.writable or opts.options is None or opts.write_via is None:
            raise ApiError(503, "capabilities_unreadable", "ה־NVR אינו מפרסם את יכולות הזרם הזה, ולכן השינוי בוטל.", details={"index": i})
        try:
            effective, _fields, _unchanged = nvr_settings.validate_changes(nvr_settings._stream_dict(stream, opts), opts.options, dict(BATCH_FIELDS))
        except ApiError as exc:
            raise ApiError(exc.status, exc.code, exc.message, details={**exc.details, "index": i}) from None
        if not effective:
            raise _not_allowed(i, "svc")


def _locked_checks(conn: sqlite3.Connection, settings: Settings, rid: str, refs: list[str]) -> None:
    """Under the write lock: one batch per device, and no single change pending on a target stream."""
    recover_dead(conn, settings, rid, settle=False)
    nvr_settings.batch_guard(conn, lock_key(conn, settings, rid))
    for start in range(0, len(refs), 500):
        chunk = refs[start:start + 500]
        row = conn.execute(f"SELECT stream_ref FROM nvr_changes WHERE recorder_id = ? AND status = 'pending' AND stream_ref IN ({','.join('?' * len(chunk))}) LIMIT 1",
                           (rid, *chunk)).fetchone()
        if row is not None:
            raise ApiError(409, "write_in_progress", "שינוי אחר של אחד הזרמים עדיין מתבצע.", retryable=True, details={"index": refs.index(row["stream_ref"])})


def _new_batch(conn: sqlite3.Connection, principal: Any, *, kind: str, rid: str, key: str, items: list[dict[str, Any]], request_id: str | None,
               source_batch_id: str | None = None) -> str:
    bid = new_id()
    now = now_iso()
    for i, it in enumerate(items):
        conn.execute(
            "INSERT INTO nvr_changes(id, kind, permission, target, path, before_xml, after_xml, status, error, rollback_of, note, actor_id, actor_username, created_at,"
            " recorder_id, camera_id, stream_ref, fields_json, etag_before, batch_id, batch_index) VALUES (?,?,?,?,'',NULL,NULL,'queued',NULL,?,?,?,?,?,?,?,?,?,?,?,?)",
            (new_id(), nvr_settings.KIND, WRITE_PERMISSION, f"stream-{it['stream_ref']}", it.get("rollback_of"), it.get("note", ""), getattr(principal, "user_id", None),
             getattr(principal, "username", None), now, rid, it["camera_id"], it["stream_ref"], json.dumps(it["fields"]), it["etag"], bid, i),
        )
    _save_meta(conn, bid, {"v": 1, "kind": kind, "recorder_id": rid, "total": len(items), "state": "running", "stopped_reason": None, "stopped_at": None,
                           "created_at": now, "actor_id": getattr(principal, "user_id", None), "actor_username": getattr(principal, "username", None),
                           "request_id": request_id, "source_batch_id": source_batch_id, "lock_key": key})
    set_setting(conn, key, bid)
    _beat(conn, bid)
    return bid


def create_write_batch(conn: sqlite3.Connection, db: Any, settings: Settings, principal: Any, req: BatchRequest, *, request_id: str | None = None) -> dict[str, Any]:
    """`POST /nvr/stream-batches`. The caller has checked `nvr.configure` at installation, parsed the body (confirm first)
    and authorized every target camera. Refusals are audited; on success the placeholders and ONE `nvr.stream.batch`
    attempt row are committed before the runner starts."""
    try:
        rid, cams = _recorder_of(conn, req)
    except ApiError as exc:
        raise refuse(conn, principal, exc, request_id, targets=len(req.targets)) from None
    refs = [t.stream_ref for t in req.targets]
    key = lock_key(conn, settings, rid)
    try:
        recover_dead(conn, settings, rid)
        nvr_settings.batch_guard(conn, key)  # cheap refusal before any device read
        _preflight(conn, settings, rid, req, cams)
        _locked_checks(conn, settings, rid, refs)
    except ApiError as exc:
        raise refuse(conn, principal, exc, request_id, recorder_id=rid, targets=len(req.targets)) from None
    items = [{"camera_id": t.camera_id, "stream_ref": t.stream_ref, "etag": t.if_match, "fields": {k: [True, v] for k, v in BATCH_FIELDS.items()}} for t in req.targets]
    bid = _new_batch(conn, principal, kind="write", rid=rid, key=key, items=items, request_id=request_id)
    _audit_batch(conn, principal, "write", "allowed", rid, {"phase": "attempt", "batch_id": bid, "total": len(items), "fields": sorted(BATCH_FIELDS),
                                                             "targets": [{"camera_id": t.camera_id, "stream_ref": t.stream_ref} for t in req.targets]}, request_id=request_id)
    commit_now(conn)  # the rows exist before the runner looks for them
    start_runner(db, settings, principal, bid)
    return batch_status(conn, principal, bid)


def create_rollback_batch(conn: sqlite3.Connection, db: Any, settings: Settings, principal: Any, source_id: str, *, request_id: str | None = None) -> dict[str, Any]:
    """`POST /nvr/stream-batches/{id}/rollback` (confirm checked by the caller): a NEW batch of single undos of the source
    batch's applied items, in reverse order, run by the same runner with the same stop-at-first-failure and unknown rules.
    Items not applied (failed, refused, not attempted, unchanged, already undone) are skipped. Every camera is authorized."""
    meta = _meta(conn, source_id)
    if meta is None:
        raise ApiError(404, "not_found", "השינוי המרובה לא נמצא.")
    rid = str(meta["recorder_id"])
    try:
        if meta.get("kind") != "write":
            raise ApiError(409, "not_rollbackable", "אי אפשר לבטל את השינוי הזה.", details={"reason": "kind"})
        recover_dead(conn, settings, rid)
        meta = _meta(conn, source_id) or meta
        if meta.get("state") == "running":
            raise ApiError(409, "batch_in_progress", "מתבצע שינוי מרובה.", retryable=True)
        if conn.execute("SELECT 1 FROM nvr_changes WHERE batch_id = ? AND status IN ('pending', 'queued') LIMIT 1", (source_id,)).fetchone() is not None:
            raise ApiError(409, "not_rollbackable", "יש מצלמה שעדיין לא ברור אם השתנתה.", details={"reason": "pending"})
        applied = conn.execute("SELECT id, camera_id, stream_ref, fields_json, etag_after FROM nvr_changes WHERE batch_id = ? AND status = 'applied' ORDER BY batch_index DESC",
                               (source_id,)).fetchall()
        if not applied:
            raise ApiError(409, "not_rollbackable", "אין מה לבטל.", details={"reason": "nothing_applied"})
    except ApiError as exc:
        raise refuse(conn, principal, exc, request_id, kind="rollback", recorder_id=rid, source_batch_id=source_id) from None
    authorize_targets(conn, principal, sorted({str(r["camera_id"]) for r in applied}))
    key = lock_key(conn, settings, rid)
    try:
        nvr_settings.batch_guard(conn, key)
    except ApiError as exc:
        raise refuse(conn, principal, exc, request_id, kind="rollback", recorder_id=rid, source_batch_id=source_id) from None
    items = []
    for r in applied:
        try:
            orig = json.loads(r["fields_json"] or "{}")
        except ValueError:
            orig = {}
        items.append({"camera_id": r["camera_id"], "stream_ref": r["stream_ref"], "etag": r["etag_after"], "rollback_of": r["id"], "note": f"החזר של {r['id']}",
                      "fields": {k: [v[1], v[0]] for k, v in orig.items() if isinstance(v, list) and len(v) == 2}})
    bid = _new_batch(conn, principal, kind="rollback", rid=rid, key=key, items=items, request_id=request_id, source_batch_id=source_id)
    _audit_batch(conn, principal, "rollback", "allowed", rid, {"phase": "attempt", "batch_id": bid, "source_batch_id": source_id, "total": len(items),
                                                                "targets": [{"camera_id": r["camera_id"], "stream_ref": r["stream_ref"], "rollback_of": r["id"]} for r in applied]},
                 request_id=request_id)
    commit_now(conn)
    start_runner(db, settings, principal, bid)
    return batch_status(conn, principal, bid)


# ------------------------------------------------------------------------------------------------ status, list, stop

def batch_status(conn: sqlite3.Connection, principal: Any, batch_id: str, *, offset: int = 0, limit: int = PAGE_DEFAULT) -> dict[str, Any]:
    """One batch from its rows (any worker answers the same). Items are paged by `batch_index`; items of a camera outside
    the caller's nvr.configure camera scope are left out (counted in `hidden`). Read-only (review finding 3): works on a
    read connection, never recovers a dead batch, never reads the device - the periodic maintenance does that.
    Review finding 12 (accepted, documented): `total`, `counts`, `current_index` and `hidden` still count the items of
    cameras outside the caller's scope - only system_admin holds nvr.configure, so nobody sees a count they could not see."""
    meta = _meta(conn, batch_id)
    if meta is None:
        raise ApiError(404, "not_found", "השינוי המרובה לא נמצא.")
    limit = max(1, min(int(limit), PAGE_MAX))
    offset = max(0, int(offset))
    scope = camera_scope(conn, principal, WRITE_PERMISSION)
    page = conn.execute("SELECT * FROM nvr_changes WHERE batch_id = ? ORDER BY batch_index LIMIT ? OFFSET ?", (batch_id, limit, offset)).fetchall()
    items = [_item(r) for r in page if scope.allows(r["camera_id"])]
    counts = _counts(conn, batch_id)
    total = int(meta.get("total") or sum(counts.values()))
    cur = conn.execute("SELECT batch_index FROM nvr_changes WHERE batch_id = ? AND status = 'pending' ORDER BY batch_index LIMIT 1", (batch_id,)).fetchone()
    done = total - counts.get("queued", 0) - counts.get("running", 0) - counts.get("unknown", 0)
    state = str(meta.get("state"))
    reboots = int(conn.execute("SELECT COUNT(*) FROM nvr_changes WHERE batch_id = ? AND reboot_required = 1", (batch_id,)).fetchone()[0])
    return {
        "batch_id": batch_id, "kind": meta.get("kind"), "state": state, "recorder_id": meta.get("recorder_id"), "total": total, "done": done,
        "reboot_required": reboots,
        "current_index": cur["batch_index"] if cur is not None else None, "counts": counts, "items": items, "hidden": len(page) - len(items),
        "offset": offset, "limit": limit, "next_offset": offset + len(page) if offset + len(page) < total else None,
        "created_at": meta.get("created_at"), "started_by": meta.get("actor_username"), "stopped_at": meta.get("stopped_at"),
        "stopped_reason": meta.get("stopped_reason"), "source_batch_id": meta.get("source_batch_id"),
        "can_rollback": meta.get("kind") == "write" and state != "running" and counts.get("applied", 0) > 0
                        and not counts.get("running") and not counts.get("unknown") and not counts.get("queued"),
    }


def _summary(conn: sqlite3.Connection, batch_id: str, meta: dict[str, Any]) -> dict[str, Any]:
    counts = _counts(conn, batch_id)
    return {"batch_id": batch_id, "kind": meta.get("kind"), "state": meta.get("state"), "recorder_id": meta.get("recorder_id"), "total": meta.get("total"),
            "counts": counts, "created_at": meta.get("created_at"), "started_by": meta.get("actor_username"), "stopped_reason": meta.get("stopped_reason")}


def list_batches(conn: sqlite3.Connection, active: bool) -> dict[str, Any]:
    """`?active=1`: the running batches (the screen resumes after a reload); otherwise the latest LIST_LIMIT batches.
    Read-only, like `batch_status` (review finding 3)."""
    if active:
        ids = [r["value"] for r in conn.execute("SELECT value FROM settings WHERE key LIKE 'nvr.batch.active.%' ORDER BY key").fetchall()]
    else:
        ids = [r["batch_id"] for r in conn.execute(
            "SELECT batch_id, MIN(created_at) AS at FROM nvr_changes WHERE batch_id IS NOT NULL GROUP BY batch_id ORDER BY at DESC LIMIT ?", (LIST_LIMIT,)).fetchall()]
    out = []
    for bid in ids:
        meta = _meta(conn, bid)
        if meta is None or (active and meta.get("state") != "running"):
            continue
        out.append(_summary(conn, bid, meta))
    return {"batches": out}


def stop_batch(db: Any, conn: sqlite3.Connection, principal: Any, batch_id: str, *, request_id: str | None = None) -> dict[str, Any]:
    """`conn` is the request's READ connection (review finding 3); the write is a short transaction of its own, taken only
    when there is something to record. Cooperative and idempotent: the still-queued items become `not_attempted`
    (`stopped`); the item in flight is not interrupted (a half-sent PUT is the worst case) - the runner ends after it.
    Review finding 2: a runner that is gone (heartbeat stale) or hung inside one item past HUNG_AFTER_S is abandoned at
    once - the batch ends `interrupted` (`deadline` / `interrupted`), the device lock is released, nothing can be claimed
    any more (no further PUT). No device read here. No confirmation: stopping is the safe way."""
    meta = _meta(conn, batch_id)
    if meta is None:
        raise ApiError(404, "not_found", "השינוי המרובה לא נמצא.")
    gone = _hung(batch_id) or (not _is_live(batch_id) and _beat_age_s(conn, batch_id) > BEAT_STALE_S)
    if meta.get("state") != "running" or (meta.get("stop_requested_at") and not gone):  # nothing to record: stays read-only
        return batch_status(conn, principal, batch_id)
    with db.connection(label="nvr_batch.stop") as w:
        meta = _meta(w, batch_id) or meta
        if meta.get("state") == "running":
            kind = str(meta.get("kind") or "write")
            hung = _hung(batch_id)
            if hung or (not _is_live(batch_id) and _beat_age_s(w, batch_id) > BEAT_STALE_S):
                _abandon(batch_id)
                _audit_batch(w, principal, kind, "allowed", str(meta["recorder_id"]), {"phase": "stop", "batch_id": batch_id, "abandoned": True}, request_id=request_id)
                _interrupt(w, None, batch_id, meta, reason="deadline" if hung else "interrupted")
            elif not meta.get("stop_requested_at"):
                n = _abort_rest(w, batch_id, "stopped")
                meta["stop_requested_at"] = now_iso()
                meta["stop_requested_by"] = getattr(principal, "username", None)
                _save_meta(w, batch_id, meta)
                _audit_batch(w, principal, kind, "allowed", str(meta["recorder_id"]), {"phase": "stop", "batch_id": batch_id, "not_attempted": n}, request_id=request_id)
        return batch_status(w, principal, batch_id)


# ------------------------------------------------------------------------------------------------ the runner

def start_runner(db: Any, settings: Settings, principal: Any, batch_id: str) -> None:
    t = threading.Thread(target=_run, args=(db, settings, principal, batch_id), name=f"nvr-batch-{batch_id}", daemon=True)
    with _live_lock:
        _live[batch_id] = t
    t.start()


def _run(db: Any, settings: Settings, principal: Any, batch_id: str) -> None:
    reason: str | None = None
    try:
        reason = _loop(db, settings, principal, batch_id)
    except Exception:  # noqa: BLE001 - the runner never dies silently: the batch ends `interrupted`
        log.exception("nvr batch %s: runner failed", batch_id)
        reason = "error"
    finally:
        try:
            _finish(db, principal, batch_id, reason)
        except Exception:  # noqa: BLE001 - the recovery pass (start-up / janitor) settles it then
            log.exception("nvr batch %s: could not record the end", batch_id)
        with _live_lock:
            _live.pop(batch_id, None)
            _item_started.pop(batch_id, None)


def _abandon(batch_id: str) -> None:
    """The runner of this batch is left to end on its own (review finding 2). It cannot claim another item (they are all
    `not_attempted` now), and `_loop` / `_finish` see the batch is no longer running and record nothing more."""
    log.warning("nvr batch %s: runner abandoned (gone or past its item deadline); the device lock is released", batch_id)


def _item_begins(batch_id: str) -> None:
    with _live_lock:
        _item_started[batch_id] = time.monotonic()


def _item_ends(batch_id: str) -> None:
    with _live_lock:
        _item_started.pop(batch_id, None)


def _wait(db: Any, batch_id: str, seconds: float) -> bool:
    """Sleep `seconds` while keeping the heartbeat fresh; False when the process shuts down meanwhile."""
    deadline = time.monotonic() + max(0.0, seconds)
    while True:
        left = deadline - time.monotonic()
        if left <= 0:
            return True
        if _shutdown.wait(min(left, BEAT_EVERY_S)):
            return False
        with db.connection(label="nvr_batch.beat") as conn:
            _beat(conn, batch_id)


def _loop(db: Any, settings: Settings, principal: Any, batch_id: str) -> str | None:
    """Strictly sequential, one item at a time; returns why the batch stopped (None: it ran out of queued items)."""
    while True:
        if _shutdown.is_set():
            return "shutdown"
        unknown_id: str | None = None
        _item_begins(batch_id)
        try:
            with db.connection(label="nvr_batch.item") as conn:
                meta = _meta(conn, batch_id)
                if meta is None:
                    return "error"
                if meta.get("state") != "running":  # abandoned by a stop / the recovery (finding 2): record nothing more
                    return "abandoned"
                _beat(conn, batch_id)
                row = conn.execute("SELECT * FROM nvr_changes WHERE batch_id = ? AND status = 'queued' ORDER BY batch_index LIMIT 1", (batch_id,)).fetchone()
                if row is None:
                    return None
                kind = str(meta.get("kind") or "write")
                idx = int(row["batch_index"])
                camera_id = str(row["camera_id"])

                def authorize(c: sqlite3.Connection, camera_id: str = camera_id) -> None:
                    require(c, principal, WRITE_PERMISSION, INSTALLATION)
                    require_camera(c, principal, camera_id, WRITE_PERMISSION)

                try:  # per-item authorization: a deny or a lost binding added mid-batch stops it (audited by `require`)
                    authorize(conn)
                except ApiError:
                    conn.execute("UPDATE nvr_changes SET status = 'refused', error = 'forbidden' WHERE id = ? AND status = 'queued'", (row["id"],))
                    return "forbidden"
                error: ApiError | None = None
                try:
                    # finding 2: a hard wall-clock limit on the item's device work; finding 11: `authorize` runs again under
                    # the write lock right before the claim (a deny added during the device reads stops this item)
                    with nvr.deadline(ITEM_DEADLINE_S):
                        if kind == "rollback":
                            orig = conn.execute("SELECT * FROM nvr_changes WHERE id = ?", (row["rollback_of"],)).fetchone()
                            if orig is not None and orig["status"] == "rolled_back":  # undone meanwhile (a single undo): nothing to do
                                conn.execute("UPDATE nvr_changes SET status = 'unchanged', error = 'already_rolled_back' WHERE id = ? AND status = 'queued'", (row["id"],))
                                continue
                            if orig is None:
                                raise ApiError(409, "not_rollbackable", "אי אפשר לבטל את השינוי הזה.")
                            nvr_settings.rollback_stream(conn, settings, principal, orig, request_id=meta.get("request_id"), batch=(batch_id, idx), adopt=row["id"],
                                                         authorize=authorize)
                        else:
                            nvr_settings.write_stream(conn, settings, principal, camera_id, str(row["stream_ref"]),
                                                      nvr_settings.WriteRequest(if_match=str(row["etag_before"]), changes=dict(BATCH_FIELDS)),
                                                      request_id=meta.get("request_id"), batch=(batch_id, idx), adopt=row["id"], authorize=authorize)
                except ApiError as exc:
                    error = exc
                timed_out = error is not None and error.code == "source_timeout"
                cur = conn.execute("SELECT * FROM nvr_changes WHERE id = ?", (row["id"],)).fetchone()
                status = str(cur["status"])
                if status == "queued":  # refused before the device was touched, or nothing to change
                    if error is None:
                        conn.execute("UPDATE nvr_changes SET status = 'unchanged', error = NULL WHERE id = ?", (row["id"],))
                        continue
                    code = "forbidden" if error.status == 403 else error.code[:64]
                    conn.execute("UPDATE nvr_changes SET status = 'refused', error = ? WHERE id = ?", (code, row["id"]))
                    return "forbidden" if code == "forbidden" else ("deadline" if timed_out else "item_refused")
                if status == "not_attempted":  # a user stop (or an abandonment) won the race for the claim
                    return None
                if status == "applied":
                    continue
                if status == "pending":
                    unknown_id = str(row["id"])
                else:
                    return "deadline" if timed_out else "item_failed"
        finally:
            _item_ends(batch_id)
        if unknown_id is not None:
            verdict = _check_unknown(db, settings, principal, batch_id, unknown_id)
            if verdict != "applied":
                return verdict


def _check_unknown(db: Any, settings: Settings, principal: Any, batch_id: str, change_id: str) -> str:
    """The owner's unknown-outcome rule: stop, wait until the device may have finished applying the PUT, then ONE read-only
    check of that camera (S2A `_settle_one`). 'applied' only when the reading PROVES it; never a second PUT."""
    if not _wait(db, batch_id, UNKNOWN_CHECK_DELAY_S):
        return "unknown_unverified"
    _item_begins(batch_id)
    try:
        with db.connection(label="nvr_batch.check") as conn:
            meta = _meta(conn, batch_id) or {}
            if meta.get("state") != "running":  # abandoned meanwhile: the janitor settles the item, nothing more here
                return "abandoned"
            row = conn.execute("SELECT * FROM nvr_changes WHERE id = ?", (change_id,)).fetchone()
            if row is not None and row["status"] == "pending":
                with nvr.deadline(CHECK_DEADLINE_S):
                    nvr_settings._settle_one(conn, settings, row)  # reads only; an unreadable device leaves it pending
                row = conn.execute("SELECT * FROM nvr_changes WHERE id = ?", (change_id,)).fetchone()
            status = str(row["status"]) if row is not None else "pending"
            # finding 1: `diverged` (our field took, but something else changed too) is not a proof - the batch stops
            verdict = {"applied": "applied", "pending": "unknown_unverified", "diverged": "unknown_diverged"}.get(status, "unknown_not_applied")
            _audit_check(conn, principal, batch_id, change_id, meta, status, verdict)
    finally:
        _item_ends(batch_id)
    return verdict


def _audit_check(conn: sqlite3.Connection, principal: Any, batch_id: str, change_id: str, meta: dict[str, Any], status: str, verdict: str) -> None:
    _audit_batch(conn, principal, str(meta.get("kind") or "write"), "allowed" if verdict == "applied" else "denied", str(meta.get("recorder_id") or "*"),
                 {"phase": "check", "batch_id": batch_id, "change_id": change_id, "status": status, "continue": verdict == "applied"},
                 reason=None if verdict == "applied" else verdict)


def _finish(db: Any, principal: Any, batch_id: str, reason: str | None) -> None:
    with db.connection(label="nvr_batch.finish") as conn:
        meta = _meta(conn, batch_id)
        if meta is None:
            return
        if meta.get("state") != "running":  # abandoned by a stop / the recovery (finding 2): that end stands
            return
        rest = {"item_failed": "earlier_failure", "item_refused": "earlier_failure", "forbidden": "earlier_failure",
                "unknown_not_applied": "earlier_unknown", "unknown_unverified": "earlier_unknown", "unknown_diverged": "earlier_unknown"}.get(reason or "", "interrupted")
        _abort_rest(conn, batch_id, rest)
        if reason is None:
            stopped = conn.execute("SELECT 1 FROM nvr_changes WHERE batch_id = ? AND status = 'not_attempted' AND error = 'stopped' LIMIT 1", (batch_id,)).fetchone()
            reason = "user_stop" if stopped is not None else None
        state = STOP_STATES.get(reason, "interrupted") if reason else "completed"
        meta.update({"state": state, "stopped_reason": reason, "stopped_at": now_iso() if reason else None, "ended_at": now_iso()})
        _save_meta(conn, batch_id, meta)
        rid = str(meta["recorder_id"])
        _release_lock(conn, batch_id)
        counts = _counts(conn, batch_id)
        _audit_batch(conn, principal, str(meta.get("kind") or "write"), "allowed" if state == "completed" else "denied", rid,
                     {"phase": "outcome", "batch_id": batch_id, "state": state, "stopped_reason": reason, "counts": counts, "total": meta.get("total")},
                     reason=reason, request_id=meta.get("request_id"))


# ------------------------------------------------------------------------------------------------ recovery

def _interrupt(conn: sqlite3.Connection, settings: Settings | None, batch_id: str, meta: dict[str, Any], reason: str = "interrupted") -> None:
    """A batch whose runner is gone or hung: the one pending item is settled from a device read when due (S2A rule, reads
    only; `settings` None: left to the janitor), every queued item becomes `not_attempted` (`interrupted`), the batch
    `interrupted` (`stopped_reason` = `reason`: `interrupted`, or `deadline` for a hung runner), the device lock released.
    Never a write, never a resume."""
    if settings is not None:
        for r in conn.execute("SELECT * FROM nvr_changes WHERE batch_id = ? AND status = 'pending'", (batch_id,)).fetchall():
            if nvr_settings._settle_due(r):
                nvr_settings._settle_one(conn, settings, r)
    n = _abort_rest(conn, batch_id, "interrupted")
    rid = str(meta.get("recorder_id") or "*")
    if meta.get("state") == "running":
        meta.update({"state": "interrupted", "stopped_reason": reason, "stopped_at": now_iso(), "ended_at": now_iso()})
        _save_meta(conn, batch_id, meta)
    _release_lock(conn, batch_id)
    _audit_batch(conn, None, str(meta.get("kind") or "write"), "denied", rid, {"phase": "settle", "batch_id": batch_id, "not_attempted": n, "counts": _counts(conn, batch_id)},
                 reason=reason)


def _dead(conn: sqlite3.Connection, batch_id: str, startup: bool) -> bool:
    """A runner of this process: dead only when hung past HUNG_AFTER_S inside one item (finding 2 - recovery never skips
    a live but stuck thread forever). No runner here: at start-up always, otherwise when its heartbeat is stale."""
    if _is_live(batch_id):
        return _hung(batch_id)
    return startup or _beat_age_s(conn, batch_id) > BEAT_STALE_S


def recover_dead(conn: sqlite3.Connection, settings: Settings | None, recorder_id: str, *, settle: bool = True) -> bool:
    """On demand from the write routes (create, rollback - never from a GET): interrupt the running batch that holds this
    recorder's device lock when its runner is gone or hung. `settle=False`: no device read (under the write lock)."""
    bid = get_setting(conn, lock_key(conn, settings, recorder_id))
    done = False
    if bid:
        meta = _meta(conn, bid)
        if meta is not None and meta.get("state") == "running" and _dead(conn, bid, False):
            hung = _is_live(bid)
            if hung:
                _abandon(bid)
            _interrupt(conn, settings if settle else None, bid, meta, reason="deadline" if hung else "interrupted")
            done = True
    return done


def recover_batches(db: Any, settings: Settings, *, startup: bool = False) -> int:
    """The periodic maintenance (janitor_tick, every 30 s) and start-up. Start-up (`startup=True`): no runner of this fresh
    process exists, so every running batch is interrupted - the add-on runs ONE process (finding 13). The janitor pass:
    batches whose runner is not in this process and whose heartbeat is stale, and runners of this process hung inside one
    item past HUNG_AFTER_S (`deadline`). Returns how many batches were interrupted."""
    if startup:
        _shutdown.clear()
    n = 0
    with db.connection(label="nvr_batch.recover") as conn:
        try:
            ids = {r["value"] for r in conn.execute("SELECT value FROM settings WHERE key LIKE 'nvr.batch.active.%'").fetchall()}
            ids |= {r["batch_id"] for r in conn.execute("SELECT DISTINCT batch_id FROM nvr_changes WHERE status = 'queued' AND batch_id IS NOT NULL").fetchall()}
        except sqlite3.OperationalError:
            return 0
        for bid in sorted(ids):
            meta = _meta(conn, bid) or {"kind": "write", "state": "running", "recorder_id": _recorder_of_batch(conn, bid)}
            live = _is_live(bid)
            if not _dead(conn, bid, startup) or (live and meta.get("state") != "running"):
                continue
            if live:
                _abandon(bid)
            _interrupt(conn, settings, bid, meta, reason="deadline" if live else "interrupted")
            n += 1
    return n


def _recorder_of_batch(conn: sqlite3.Connection, batch_id: str) -> str:
    r = conn.execute("SELECT recorder_id FROM nvr_changes WHERE batch_id = ? LIMIT 1", (batch_id,)).fetchone()
    return str(r["recorder_id"]) if r is not None else "*"


def signal_shutdown() -> None:
    """The first step of the application shutdown: no runner starts another item from now on."""
    _shutdown.set()


def shutdown(timeout: float = 5.0) -> None:
    """Application shutdown: every runner ends after its current item (the rest `not_attempted`, the batch `interrupted`)."""
    _shutdown.set()
    with _live_lock:
        threads = list(_live.values())
    deadline = time.monotonic() + timeout
    for t in threads:
        t.join(max(0.0, deadline - time.monotonic()))


def wait_idle(timeout: float = 30.0) -> bool:
    """Tests: True once no runner of this process is alive."""
    deadline = time.monotonic() + timeout
    while time.monotonic() < deadline:
        with _live_lock:
            alive = [t for t in _live.values() if t.is_alive()]
        if not alive:
            return True
        time.sleep(0.02)
    return False
