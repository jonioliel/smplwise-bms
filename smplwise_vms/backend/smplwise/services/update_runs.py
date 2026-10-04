"""CR-021 S3: the run state machine of the in-app update (`apply`) and the platform restart (`restart-platform`).

One table, `update_runs` (migration 0051, no new migration): `restart_platform = 0` is an update of this add-on, `1` a platform restart.
States: requested -> backing_up -> updating -> restarting -> verifying -> succeeded | failed | abandoned (the CHECK of 0051). `step` is a
small fixed vocabulary for the status screen (STEPS); `error_code` a code of ERROR_CODES. Neither ever carries an upstream text, a slug,
a token, an address or a backup name.

The two-phase rule of CR-020 applies to every call with an effect:
1. reads first (`GET /addons/self/info` / `GET /core/info`), with the request's write lock released (`unlocked`), nothing written;
2. under the write lock: refuse a second active run (one INSERT ... WHERE NOT EXISTS, so two requests can never both pass), insert the run
   row and the audit row `phase: "attempt"`, COMMIT - before anything is sent;
3. a worker thread sends the call (no database connection is held while it waits) and records the outcome: the run row and the audit row
   `system.update.result` with `phase: "outcome"`.
An outcome that is not known (the connection broke after the request went out: `Reply.kind == "dropped"`) is never retried and never
claimed: the update run goes to `restarting` with step `outcome_unknown` and is settled by the next start of Arx (`on_startup`) or by the
timeout (`abandoned`); the platform restart run is settled by polling the platform.

The update kills this very process. The new process calls `on_startup` right after its migrations: the running version equal to the
target -> `verifying` and the health check (with one retry) -> `succeeded` / `failed`; three starts of the target version without a
healthy check -> `failed/restart_loop` (a crash / watchdog loop never ends in "success"). Starts are counted by `early_boot`, which
main.py calls BEFORE the migrations, so a version that crashes in a migration or at import still reaches the loop verdict.

Security review of 2026-10-04 (no verdict from one observation):
* a start on the SOURCE version while the run is `backing_up` / `updating` / `restarting` (an Arx restart - NVR connection saved, the
  Arx restart button, the watchdog - in the middle of the Supervisor job) does not fail the run: the run stays open (the single-run
  guard holds) and `_follow` keeps reading the job; `failed/version_unchanged` only when no update job has been running for
  NO_JOB_GRACE_S and the infrastructure still reports the source version installed;
* a local build may take longer than UPDATE_EXPECTED_S (20 min, shown to the UI as `expected_s`): the worker keeps following the job up to
  the ceiling UPDATE_TIMEOUT_S (90 min, `timeout_s`); a run abandoned at the ceiling is reopened and verified when its target version
  starts within REOPEN_WINDOW_S (audit `phase: "reopened"`); the janitor (main.janitor_tick -> `janitor`) settles runs past the ceiling;
* `backup` on the run is what was CONFIRMED (the backup child job finished without errors), `backup_requested` what was asked;
* the 10-minute gap between two updates is part of the INSERT's WHERE (two parallel requests cannot both pass it);
* a platform restart succeeds only after the core was seen down twice in a row (or the settle time of an accepted restart passed), then
  `running` twice in a row (the post-restart check), and - when the bridge is paired - a bridge directory push after the core came back.

No rate limit on the platform restart (owner answer 8): the route checks the permission and the confirmation, and the single-active-run
rule keeps two restarts from overlapping. The update keeps the design's 1 per 10 minutes (DB-backed: it must survive the restart).

Seams for tests: SPAWN (how a worker starts), `_sleep` / `_clock` (virtual time) and `_now` (wall clock of the rows)."""
from __future__ import annotations

import datetime as dt
import logging
import re
import sqlite3
import threading
import time
from dataclasses import dataclass
from typing import Any, Callable

from .. import __version__
from ..audit import audit
from ..config import Settings
from ..db import MIGRATIONS_DIR, Database, commit_now, get_setting, new_id, set_setting, unlocked
from ..errors import ApiError
from . import addon_restart, platform_restart
from . import self_update as su
from .timeutil import iso_utc

log = logging.getLogger(__name__)

TERMINAL = ("succeeded", "failed", "abandoned")
UPDATE_EXPECTED_S = 20 * 60       # what a locally built add-on image usually takes (design section 6); shown as `expected_s`; lab measures
UPDATE_TIMEOUT_S = 90 * 60        # the ceiling of an update run (`timeout_s`): a slow local build (aarch64, wheels compiled) is still followed
RESTART_TIMEOUT_S = 10 * 60
APPLY_MIN_GAP_S = 10 * 60         # design section 8; the platform restart has none (owner answer 8)
POLL_S = 5.0
HEALTH_RETRY_S = 60.0
RESTART_SETTLE_S = 30.0           # a platform that answers "running" right after an accepted restart may not have gone down yet
LOOP_BOOTS = 3
UPDATE_CALL_TIMEOUT_S = 30.0
NO_JOB_GRACE_S = 120.0            # no update job seen for this long (and the source version installed) before `version_unchanged`
DOWN_SAMPLES = 2                  # consecutive non-running answers that count as "the core went down" (one error is no restart)
UP_SAMPLES = 2                    # consecutive `running` answers after it: the post-restart check
REOPEN_WINDOW_S = 24 * 3600       # a run abandoned at the ceiling is verified when its target version starts within this window
UPDATE_JOB_NAME = "addon_manager_update"   # the Supervisor's job name of an add-on update (assumption A3, confirmed in the lab)
RESUMABLE = ("backing_up", "updating", "restarting")
BACKUP_NONE, BACKUP_REQUESTED, BACKUP_CONFIRMED = 0, 1, 2   # update_runs.backup

IDEMPOTENCY_RE = re.compile(r"[A-Za-z0-9_-]{8,64}")
RUN_ID_RE = re.compile(r"[0-9a-f]{16}")
JOB_ID_RE = re.compile(r"[0-9a-fA-F-]{8,64}")

K_BOOT_RUN = "update.boot_run"
K_BOOT_COUNT = "update.boot_count"
K_JOB_ID = "update.job_id"        # the Supervisor job of the open update run (so a restarted process keeps following it)

STEPS = ("sending", "job_running", "backup_done", "job_done", "outcome_unknown", "health_check", "health_retry", "config_check",
         "restart_sent", "restart_accepted", "waiting_for_platform", "bridge_wait")
ERROR_CODES = ("platform_not_permitted", "infrastructure_unreachable", "infrastructure_busy", "infrastructure_error", "update_job_failed",
               "version_unchanged", "version_unexpected", "interrupted", "restart_loop", "health_check_failed", "timeout",
               "platform_config_invalid", "platform_not_back", "bridge_not_loaded", "restart_not_observed")


def _default_spawn(fn: Callable[[], None], name: str) -> None:
    threading.Thread(target=fn, name=name, daemon=True).start()


SPAWN: Callable[[Callable[[], None], str], None] = _default_spawn
_sleep: Callable[[float], None] = time.sleep
_clock: Callable[[], float] = time.monotonic
_BOOT_COUNTED: str | None = None  # the run whose boot count this process already raised in `early_boot`


def _now() -> dt.datetime:
    return dt.datetime.now(dt.timezone.utc)


def _iso() -> str:
    return iso_utc(_now())


def _age_s(created_at: str) -> float:
    try:
        then = dt.datetime.fromisoformat(created_at.replace("Z", "+00:00"))
    except ValueError:
        return float("inf")
    return (_now() - then).total_seconds()


def kind_of(row: sqlite3.Row) -> str:
    return "platform_restart" if row["restart_platform"] else "update"


def timeout_of(row: sqlite3.Row) -> int:
    return RESTART_TIMEOUT_S if row["restart_platform"] else UPDATE_TIMEOUT_S


def expected_of(row: sqlite3.Row) -> int:
    return RESTART_TIMEOUT_S if row["restart_platform"] else UPDATE_EXPECTED_S


def backup_state(row: Any) -> str:
    """`not_requested` | `requested` (asked, not seen to finish) | `confirmed` (the backup child job finished without errors)."""
    value = int(row["backup"] or 0)
    return "confirmed" if value >= BACKUP_CONFIRMED else "requested" if value == BACKUP_REQUESTED else "not_requested"


def run_view(row: sqlite3.Row) -> dict[str, Any]:
    """What the status screen polls. No backup name, no slug, no upstream text. `backup` is true only for a CONFIRMED backup."""
    bs = backup_state(row)
    return {"run_id": row["id"], "kind": kind_of(row), "state": row["state"], "step": row["step"], "started_at": row["created_at"],
            "finished_at": row["finished_at"], "from_version": row["from_version"], "to_version": row["to_version"], "backup": bs == "confirmed",
            "backup_requested": bs != "not_requested", "backup_state": bs, "error_code": row["error_code"], "timeout_s": timeout_of(row),
            "expected_s": expected_of(row)}


def get_run(conn: sqlite3.Connection, run_id: str) -> sqlite3.Row | None:
    return conn.execute("SELECT * FROM update_runs WHERE id = ?", (run_id,)).fetchone()


def active_run(conn: sqlite3.Connection) -> sqlite3.Row | None:
    return conn.execute("SELECT * FROM update_runs WHERE state NOT IN ('succeeded', 'failed', 'abandoned') ORDER BY created_at DESC LIMIT 1").fetchone()


def overdue(row: sqlite3.Row) -> bool:
    return row["state"] not in TERMINAL and _age_s(row["created_at"]) > timeout_of(row)


# ------------------------------------------------------------------------------------------------ row transitions

def _set(conn: sqlite3.Connection, run_id: str, *, state: str | None = None, step: str | None = None, error_code: str | None = None) -> bool:
    """One transition of a run that is not finished yet. Returns False when the run was already terminal (nothing changed)."""
    assert step is None or step in STEPS, step
    assert error_code is None or error_code in ERROR_CODES, error_code
    sets, args = [], []
    if state is not None:
        sets.append("state = ?")
        args.append(state)
        if state in TERMINAL:
            sets.append("finished_at = ?")
            args.append(_iso())
    if step is not None:
        sets.append("step = ?")
        args.append(step)
    if error_code is not None:
        sets.append("error_code = ?")
        args.append(error_code)
    cur = conn.execute(f"UPDATE update_runs SET {', '.join(sets)} WHERE id = ? AND state NOT IN ('succeeded', 'failed', 'abandoned')", (*args, run_id))
    return cur.rowcount == 1


def _audit_result(conn: sqlite3.Connection, row: sqlite3.Row, state: str, error_code: str | None, extra: dict[str, Any] | None = None) -> None:
    audit(conn, actor=None, action="system.update.result", decision="allowed" if state == "succeeded" else "denied", resource_type="installation",
          resource_id="update", reason=error_code,
          details={"phase": "outcome", "run_id": row["id"], "kind": kind_of(row), "state": state, "error_code": error_code, "from": row["from_version"],
                   "to": row["to_version"], "backup": backup_state(row) == "confirmed", "backup_requested": backup_state(row) != "not_requested",
                   "actor_user_id": row["actor_user_id"], **(extra or {})})


def _clear_update_keys(conn: sqlite3.Connection) -> None:
    conn.execute("DELETE FROM settings WHERE key IN (?, ?, ?)", (K_BOOT_RUN, K_BOOT_COUNT, K_JOB_ID))


def finish(db: Database, run_id: str, state: str, error_code: str | None = None, step: str | None = None, extra: dict[str, Any] | None = None) -> bool:
    """A terminal transition and its outcome audit row in one transaction (a run finishes once)."""
    assert state in TERMINAL
    with db.connection(label="update_runs.finish") as conn:
        row = get_run(conn, run_id)
        if row is None or not _set(conn, run_id, state=state, step=step, error_code=error_code):
            return False
        _audit_result(conn, row, state, error_code, extra)
        if state == "succeeded" and row["restart_platform"]:
            platform_restart.clear_after_restart(conn, row["created_at"])
        if row["restart_platform"] == 0:
            _clear_update_keys(conn)
    return True


def advance(db: Database, run_id: str, *, state: str | None = None, step: str | None = None) -> bool:
    with db.connection(label="update_runs.advance") as conn:
        return _set(conn, run_id, state=state, step=step)


def sweep_overdue(conn: sqlite3.Connection) -> list[str]:
    """Every unfinished run past its timeout becomes `abandoned` (with its outcome audit row). Runs on a write connection."""
    swept = []
    for row in conn.execute("SELECT * FROM update_runs WHERE state NOT IN ('succeeded', 'failed', 'abandoned')").fetchall():
        if overdue(row) and _set(conn, row["id"], state="abandoned", error_code="timeout"):
            _audit_result(conn, row, "abandoned", "timeout")
            if row["restart_platform"] == 0:
                _clear_update_keys(conn)
            swept.append(row["id"])
    return swept


def janitor(db: Database) -> list[str]:
    """The scheduled clean-up (main.janitor_tick, every 30 s): unfinished runs past their ceiling become `abandoned`. Writes only when
    there is something to settle."""
    with db.connection(mode="read", label="update_runs.janitor_read") as conn:
        rows = conn.execute("SELECT * FROM update_runs WHERE state NOT IN ('succeeded', 'failed', 'abandoned')").fetchall()
    if not any(overdue(r) for r in rows):
        return []
    with db.connection(label="update_runs.janitor") as conn:
        return sweep_overdue(conn)


# ------------------------------------------------------------------------------------------------ requests

@dataclass(frozen=True)
class ApplyRequest:
    target_version: str
    backup: bool
    idempotency_key: str


@dataclass(frozen=True)
class RestartRequest:
    idempotency_key: str


def _replay(conn: sqlite3.Connection, key: str, restart: bool, target: str | None) -> dict[str, Any] | None:
    row = conn.execute("SELECT * FROM update_runs WHERE idempotency_key = ?", (key,)).fetchone()
    if row is None:
        return None
    if bool(row["restart_platform"]) != restart or (target is not None and row["to_version"] != target):
        raise ApiError(409, "idempotency_key_reused", "מזהה הבקשה כבר שימש לפעולה אחרת.")
    return run_view(row)


def _refuse_active(conn: sqlite3.Connection) -> None:
    row = active_run(conn)
    if row is not None:
        raise ApiError(409, "update_in_progress", "פעולת עדכון או הפעלה מחדש אחרת עדיין מתבצעת.", retryable=True,
                       details={"run_id": row["id"], "kind": kind_of(row), "state": row["state"]})


def refuse_arx_restart_during_update(conn: sqlite3.Connection) -> None:
    """Owner decision 2026-10-04: while an UPDATE run is active, nothing that restarts Arx may start (saving the NVR connection, the Arx
    restart button): 409 `update_running`. A platform-restart run does not restart Arx and does not block. The Arx restart route of
    CR-022 (`addon_restart.restart`) must call this before it restarts the add-on."""
    row = active_run(conn)
    if row is not None and kind_of(row) == "update":
        raise ApiError(409, "update_running", "מתבצע עדכון, נסו שוב בסיום.", retryable=True,
                       details={"run_id": row["id"], "kind": "update", "state": row["state"]})


def _nvr_write_pending(conn: sqlite3.Connection) -> bool:
    """CR-020: a guarded NVR write whose outcome is not recorded yet (pending, younger than its settle window)."""
    try:
        from .nvr_settings import PENDING_SETTLE_S

        rows = conn.execute("SELECT created_at FROM nvr_changes WHERE status = 'pending'").fetchall()
    except (sqlite3.OperationalError, ImportError):
        return False
    return any(_age_s(r["created_at"]) <= PENDING_SETTLE_S for r in rows)


def _upstream_refusal(reply: su.Reply) -> ApiError:
    if reply.kind == "forbidden":
        return ApiError(503, "platform_not_permitted", "ל־Arx אין הרשאה לבצע את הפעולה בתשתית המערכת.", details={"required_role": "manager"})
    if reply.kind == "unreachable":
        return ApiError(503, "infrastructure_unreachable", "תשתית המערכת אינה זמינה.", retryable=True)
    return ApiError(502, "infrastructure_error", "תשתית המערכת החזירה שגיאה.", retryable=True, details={"upstream_status": reply.status})


def _insert(conn: sqlite3.Connection, *, run_id: str, principal: Any, from_version: str, to_version: str | None, backup: bool, restart: bool,
            key: str, step: str | None) -> bool:
    """The single-active-run rule in ONE statement under the write lock: the row is inserted only when no unfinished run exists - and, for an
    update, when no other update started within APPLY_MIN_GAP_S (the gap is re-checked here, not only before the unlocked read)."""
    gap = ""
    args: list[Any] = [run_id, _iso(), getattr(principal, "user_id", None), from_version, to_version, BACKUP_REQUESTED if backup else BACKUP_NONE,
                       1 if restart else 0, step, key]
    if not restart:
        gap = " AND NOT EXISTS (SELECT 1 FROM update_runs WHERE restart_platform = 0 AND created_at > ?)"
        args.append(iso_utc(_now() - dt.timedelta(seconds=APPLY_MIN_GAP_S)))
    cur = conn.execute(
        "INSERT INTO update_runs(id, created_at, actor_user_id, from_version, to_version, backup, restart_platform, state, step, idempotency_key) "
        "SELECT ?, ?, ?, ?, ?, ?, ?, 'requested', ?, ? WHERE NOT EXISTS (SELECT 1 FROM update_runs WHERE state NOT IN ('succeeded', 'failed', 'abandoned'))"
        + gap, args)
    return cur.rowcount == 1


def _refuse_gap(conn: sqlite3.Connection) -> None:
    last = conn.execute("SELECT created_at FROM update_runs WHERE restart_platform = 0 ORDER BY created_at DESC LIMIT 1").fetchone()
    if last is not None and _age_s(last["created_at"]) < APPLY_MIN_GAP_S:
        wait = max(1, int(APPLY_MIN_GAP_S - _age_s(last["created_at"])))
        raise ApiError(429, "rate_limited", "עדכון הופעל זה עתה. נסו שוב בעוד כמה דקות.", retryable=True, details={"retry_after_s": wait})


def start_update(conn: sqlite3.Connection, db: Database, settings: Settings, principal: Any, req: ApplyRequest, *, remote: bool,
                 request_id: str | None) -> tuple[dict[str, Any], bool]:
    """`POST /apply` after the permission, the same-origin check and the body. Returns (run view, created)."""
    replay = _replay(conn, req.idempotency_key, False, req.target_version)
    if replay is not None:
        return replay, False
    sweep_overdue(conn)
    _refuse_active(conn)
    _refuse_gap(conn)
    if _nvr_write_pending(conn):
        raise ApiError(409, "nvr_write_in_progress", "שינוי הגדרות מצלמה עדיין מתבצע. נסו שוב בעוד רגע.", retryable=True)
    if not su.configured(settings):
        raise ApiError(503, "infrastructure_unreachable", "תשתית המערכת אינה זמינה.", retryable=True)
    with unlocked(conn):  # phase 1: the pre-check read, nothing written, no lock held
        reply = su.call(settings, "GET", su.P_INFO)
    if reply.kind != "ok":
        raise _upstream_refusal(reply)
    data = reply.data or {}
    info = su.parse_info(data)
    if info is None:
        raise ApiError(502, "infrastructure_error", "תשתית המערכת החזירה שגיאה.", retryable=True, details={"upstream_status": reply.status})
    if not info.update_available:
        raise ApiError(409, "update_not_available", "אין גרסה חדשה להתקנה.", details={"installed": info.installed})
    if info.latest != req.target_version:
        raise ApiError(409, "target_version_mismatch", "הגרסה הזמינה השתנתה. רעננו את המסך.", details={"latest": info.latest})
    if data.get("state") != "started":
        raise ApiError(409, "platform_busy", "תשתית המערכת עסוקה כרגע. נסו שוב מאוחר יותר.", retryable=True)
    slug = data.get("slug")
    if not isinstance(slug, str) or not su.SLUG_RE.fullmatch(slug):
        raise ApiError(502, "infrastructure_error", "תשתית המערכת החזירה שגיאה.", details={"reason": "identity_unreadable"})
    # phase 2: the row and the attempt audit, committed before anything is sent
    replay = _replay(conn, req.idempotency_key, False, req.target_version)  # a parallel request with the same key won while unlocked
    if replay is not None:
        return replay, False
    run_id = new_id()
    try:
        inserted = _insert(conn, run_id=run_id, principal=principal, from_version=info.installed, to_version=req.target_version, backup=req.backup,
                           restart=False, key=req.idempotency_key, step=None)
    except sqlite3.IntegrityError:
        replay = _replay(conn, req.idempotency_key, False, req.target_version)
        if replay is not None:
            return replay, False
        raise
    if not inserted:
        _refuse_active(conn)
        _refuse_gap(conn)  # another update started (and maybe already failed) while this request read unlocked
        raise ApiError(409, "update_in_progress", "פעולת עדכון או הפעלה מחדש אחרת עדיין מתבצעת.", retryable=True)
    audit(conn, actor=principal, action="system.update.apply", decision="allowed", resource_type="installation", resource_id="update", request_id=request_id,
          details={"phase": "attempt", "run_id": run_id, "from": info.installed, "to": req.target_version, "backup": req.backup, "remote": remote})
    row = get_run(conn, run_id)
    commit_now(conn)
    SPAWN(lambda: update_worker(db, settings, run_id, slug, req.backup), f"update-run-{run_id}")
    return run_view(row), True


def start_platform_restart(conn: sqlite3.Connection, db: Database, settings: Settings, principal: Any, req: RestartRequest, *, remote: bool,
                           request_id: str | None) -> tuple[dict[str, Any], bool]:
    """`POST /restart-platform` after the permission, the same-origin check and the body (`confirm: true`). No rate limit (owner answer 8)."""
    replay = _replay(conn, req.idempotency_key, True, None)
    if replay is not None:
        return replay, False
    sweep_overdue(conn)
    _refuse_active(conn)
    if not addon_restart.configured(settings):
        raise ApiError(503, "infrastructure_unreachable", "תשתית המערכת אינה זמינה.", retryable=True)
    with unlocked(conn):
        reply = addon_restart.platform_info(settings)
    if reply.kind != "ok":
        raise _upstream_refusal(reply)
    version = str((reply.data or {}).get("version") or "")
    from_version = version if su.VERSION_RE.fullmatch(version) else "unknown"
    replay = _replay(conn, req.idempotency_key, True, None)
    if replay is not None:
        return replay, False
    run_id = new_id()
    try:
        inserted = _insert(conn, run_id=run_id, principal=principal, from_version=from_version, to_version=None, backup=False, restart=True,
                           key=req.idempotency_key, step="config_check")
    except sqlite3.IntegrityError:
        replay = _replay(conn, req.idempotency_key, True, None)
        if replay is not None:
            return replay, False
        raise
    if not inserted:
        _refuse_active(conn)
        raise ApiError(409, "update_in_progress", "פעולת עדכון או הפעלה מחדש אחרת עדיין מתבצעת.", retryable=True)
    audit(conn, actor=principal, action="system.update.restart_platform", decision="allowed", resource_type="installation", resource_id="platform",
          request_id=request_id, details={"phase": "attempt", "run_id": run_id, "from": from_version, "remote": remote,
                                          "reasons": [r["code"] for r in platform_restart.reasons(conn)]})
    row = get_run(conn, run_id)
    commit_now(conn)
    SPAWN(lambda: platform_worker(db, settings, run_id), f"platform-restart-{run_id}")
    return run_view(row), True


# ------------------------------------------------------------------------------------------------ the update worker (old process)

def _error_code(reply: su.Reply) -> str:
    if reply.kind == "forbidden":
        return "platform_not_permitted"
    if reply.kind == "unreachable":
        return "infrastructure_unreachable"
    if reply.kind == "error" and reply.status == 409:
        return "infrastructure_busy"
    return "infrastructure_error"


def _find_job(jobs: Any, job_id: str) -> dict[str, Any] | None:
    for job in jobs if isinstance(jobs, list) else []:
        if not isinstance(job, dict):
            continue
        if job.get("uuid") == job_id:
            return job
        found = _find_job(job.get("child_jobs"), job_id)
        if found is not None:
            return found
    return None


def _job_failed(job: dict[str, Any]) -> bool:
    return bool(job.get("errors")) or any(_job_failed(c) for c in job.get("child_jobs") or [] if isinstance(c, dict))


def _backup_done(job: dict[str, Any]) -> bool:
    """A backup child job that FINISHED WITHOUT ERRORS (a failed or unfinished backup is never shown as taken)."""
    return any(isinstance(c, dict) and "backup" in str(c.get("name") or "") and c.get("done") is True and not _job_failed(c)
               for c in job.get("child_jobs") or [])


def _update_job_running(jobs: Any) -> bool:
    """Some add-on update job is still running (by name: the job id is unknown after a dropped call). Used only as a reason to WAIT."""
    for job in jobs if isinstance(jobs, list) else []:
        if not isinstance(job, dict):
            continue
        if job.get("name") == UPDATE_JOB_NAME and job.get("done") is not True:
            return True
        if _update_job_running(job.get("child_jobs")):
            return True
    return False


def _read_run(db: Database, run_id: str) -> sqlite3.Row | None:
    with db.connection(mode="read", label="update_runs.poll") as conn:
        return get_run(conn, run_id)


def _confirm_backup(db: Database, run_id: str, from_backing_up: bool) -> None:
    with db.connection(label="update_runs.backup") as conn:
        conn.execute("UPDATE update_runs SET backup = ? WHERE id = ? AND backup = ? AND state NOT IN ('succeeded', 'failed', 'abandoned')",
                     (BACKUP_CONFIRMED, run_id, BACKUP_REQUESTED))
        if from_backing_up:
            _set(conn, run_id, state="updating", step="backup_done")


def update_worker(db: Database, settings: Settings, run_id: str, slug: str, backup: bool) -> None:
    """Send the update and follow the Supervisor job while this process lives. Never raises; never retries the update call."""
    try:
        _update_worker(db, settings, run_id, slug, backup)
    except Exception:  # noqa: BLE001 - the run is settled by on_startup or the timeout
        log.exception("update run %s: the worker stopped", run_id)


def _update_worker(db: Database, settings: Settings, run_id: str, slug: str, backup: bool) -> None:
    advance(db, run_id, state="backing_up" if backup else "updating", step="sending")
    reply = su.call(settings, "POST", su.P_UPDATE, body={"backup": backup, "background": True}, slug=slug, timeout=UPDATE_CALL_TIMEOUT_S)
    if reply.kind == "dropped":  # the request went out, no answer: the container is probably being replaced - never resent
        advance(db, run_id, state="restarting", step="outcome_unknown")
        return
    if reply.kind != "ok":
        code = _error_code(reply)
        if code == "platform_not_permitted":
            with db.connection(label="update_runs.permitted") as conn:
                set_setting(conn, su.K_PERMITTED, "no")
        finish(db, run_id, "failed", code, extra={"upstream_status": reply.status})
        return
    job_id = str((reply.data or {}).get("job_id") or "")
    advance(db, run_id, step="job_running")
    if not JOB_ID_RE.fullmatch(job_id):
        return  # no job to follow: the restart of this process (or the janitor at the ceiling) settles the run
    with db.connection(label="update_runs.job") as conn:
        set_setting(conn, K_JOB_ID, job_id)
    _follow(db, settings, run_id, job_id)


def _follow(db: Database, settings: Settings, run_id: str, job_id: str) -> None:
    """Follow the Supervisor job of an open update run while this process lives (the old version after `apply`, or the old version
    started again in the middle of the job). Verdicts only from what is observed:
    * the job (by id) reports errors -> `failed/update_job_failed`;
    * no update job has been running for NO_JOB_GRACE_S and the infrastructure reports the SOURCE version installed while this process
      runs it -> `failed/version_unchanged`;
    * the job is running, or the target is installed (the Supervisor replaces this process next), or nothing is readable -> keep waiting;
    * the ceiling (UPDATE_TIMEOUT_S from the run's creation) -> `abandoned/timeout`, reopened by `on_startup` if the target starts."""
    row = _read_run(db, run_id)
    if row is None or row["state"] in TERMINAL:
        return
    deadline = _clock() + max(0.0, timeout_of(row) - _age_s(row["created_at"]))
    idle_since: float | None = None
    while _clock() < deadline:
        _sleep(POLL_S)
        row = _read_run(db, run_id)
        if row is None or row["state"] in TERMINAL:
            return
        jr = su.call(settings, "GET", su.P_JOBS)
        if jr.kind != "ok":
            continue  # nothing observed: no verdict either way
        jobs = (jr.data or {}).get("jobs")
        job = _find_job(jobs, job_id) if job_id else None
        if job is not None and _job_failed(job):
            finish(db, run_id, "failed", "update_job_failed")
            return
        if job is not None and int(row["backup"] or 0) == BACKUP_REQUESTED and _backup_done(job):
            _confirm_backup(db, run_id, from_backing_up=row["state"] == "backing_up")
        if (job is not None and job.get("done") is not True) or (job is None and _update_job_running(jobs)):
            idle_since = None
            continue
        if job is not None and job.get("done") is True and row["state"] != "restarting":
            advance(db, run_id, state="restarting", step="job_done")
        if idle_since is None:
            idle_since = _clock()
            continue
        if _clock() - idle_since < NO_JOB_GRACE_S:
            continue
        info = su.call(settings, "GET", su.P_INFO)
        installed = str((info.data or {}).get("version") or "") if info.kind == "ok" else ""
        if installed and installed == row["from_version"] == __version__:
            finish(db, run_id, "failed", "version_unchanged", extra={"running": __version__})
            return
    finish(db, run_id, "abandoned", "timeout")  # the ceiling: never claimed either way; on_startup reopens it if the target starts


# ------------------------------------------------------------------------------------------------ the new process: on_startup

def _count_boot(conn: sqlite3.Connection, run_id: str) -> int:
    count = int(get_setting(conn, K_BOOT_COUNT, "0") or 0) + 1 if get_setting(conn, K_BOOT_RUN) == run_id else 1
    set_setting(conn, K_BOOT_RUN, run_id)
    set_setting(conn, K_BOOT_COUNT, str(count))
    return count


def early_boot(db: Database) -> str | None:
    """Called by main.py BEFORE the migrations: a start of the target version of the open update run is counted here, so a version that
    crashes in a migration (or anywhere before `on_startup`) still ends in `failed/restart_loop` after LOOP_BOOTS starts. Never raises.
    Returns `counted`, `restart_loop` or None (nothing to count: no open run, another version, a database without the table yet)."""
    global _BOOT_COUNTED
    try:
        with db.connection(label="update_runs.early_boot") as conn:
            row = conn.execute("SELECT * FROM update_runs WHERE restart_platform = 0 AND state NOT IN ('succeeded', 'failed', 'abandoned') "
                               "ORDER BY created_at DESC LIMIT 1").fetchone()
            if row is None or row["to_version"] != __version__:
                return None
            count = _count_boot(conn, row["id"])
        _BOOT_COUNTED = row["id"]
        if count >= LOOP_BOOTS:
            finish(db, row["id"], "failed", "restart_loop", extra={"running": __version__, "stage": "before_start"})
            return "restart_loop"
        return "counted"
    except sqlite3.OperationalError:  # a fresh or very old database: no update_runs table yet
        return None
    except Exception:  # noqa: BLE001 - never block the start
        log.warning("update runs: the early start count failed", exc_info=True)
        return None


def _reopen_abandoned(conn: sqlite3.Connection) -> str | None:
    """The newest run is an update abandoned at the ceiling, its target is the running version and it is recent: verify it after all
    (the build outlived the old process's ceiling). Returns the run id when reopened."""
    last = conn.execute("SELECT * FROM update_runs ORDER BY created_at DESC, rowid DESC LIMIT 1").fetchone()
    if (last is None or last["restart_platform"] or last["state"] != "abandoned" or last["error_code"] != "timeout"
            or last["to_version"] != __version__ or _age_s(last["created_at"]) > REOPEN_WINDOW_S):
        return None
    cur = conn.execute("UPDATE update_runs SET state = 'verifying', step = 'health_check', finished_at = NULL, error_code = NULL "
                       "WHERE id = ? AND state = 'abandoned' AND NOT EXISTS (SELECT 1 FROM update_runs WHERE state NOT IN ('succeeded', 'failed', 'abandoned'))",
                       (last["id"],))
    if cur.rowcount != 1:
        return None
    _count_boot(conn, last["id"])
    audit(conn, actor=None, action="system.update.result", decision="allowed", resource_type="installation", resource_id="update", reason="reopened",
          details={"phase": "reopened", "run_id": last["id"], "kind": "update", "state": "verifying", "from": last["from_version"], "to": last["to_version"],
                   "running": __version__})
    return last["id"]


def on_startup(db: Database, settings: Settings) -> str | None:
    """Called once by main.py's lifespan right after the migrations and `record_version`. Settles the open update run (if any) and resumes
    an open platform restart run. Never raises. Returns what it did (for logs and tests)."""
    try:
        return _on_startup(db, settings)
    except Exception:  # noqa: BLE001 - never block the start
        log.exception("update runs: the start-up check failed")
        return None


def _on_startup(db: Database, settings: Settings) -> str | None:
    global _BOOT_COUNTED
    outcome: str | None = None
    job_id = ""
    reopened: str | None = None
    with db.connection(label="update_runs.on_startup") as conn:
        restart = conn.execute("SELECT * FROM update_runs WHERE restart_platform = 1 AND state NOT IN ('succeeded', 'failed', 'abandoned')").fetchone()
        row = conn.execute("SELECT * FROM update_runs WHERE restart_platform = 0 AND state NOT IN ('succeeded', 'failed', 'abandoned') ORDER BY created_at DESC LIMIT 1").fetchone()
        if row is not None:
            if __version__ == row["to_version"]:
                if _BOOT_COUNTED == row["id"]:  # early_boot already counted this start
                    count = int(get_setting(conn, K_BOOT_COUNT, "1") or 1)
                else:
                    count = _count_boot(conn, row["id"])
                if count >= LOOP_BOOTS:
                    outcome = "restart_loop"
                else:
                    _set(conn, row["id"], state="verifying", step="health_check")
                    outcome = "verifying"
            elif __version__ == row["from_version"]:
                if row["state"] == "requested":
                    outcome = "interrupted"
                elif row["state"] in RESUMABLE:  # restarted in the middle of the job: the job state decides, not this start
                    outcome = "resumed"
                    job_id = get_setting(conn, K_JOB_ID, "") or ""
                else:
                    outcome = "version_unchanged"
            else:
                outcome = "version_unexpected"
        elif restart is None:
            reopened = _reopen_abandoned(conn)
            if reopened is not None:
                outcome = "verifying"
    _BOOT_COUNTED = None
    if row is not None:
        if outcome in ("restart_loop", "interrupted", "version_unchanged", "version_unexpected"):
            finish(db, row["id"], "failed", outcome, extra={"running": __version__})
        elif outcome == "verifying":
            run_id = row["id"]
            SPAWN(lambda: verify_worker(db, settings, run_id), f"update-verify-{run_id}")
        elif outcome == "resumed":
            run_id = row["id"]
            SPAWN(lambda: update_follow(db, settings, run_id, job_id), f"update-follow-{run_id}")
    elif reopened is not None:
        rid_reopened = reopened
        SPAWN(lambda: verify_worker(db, settings, rid_reopened), f"update-verify-{rid_reopened}")
    if restart is not None:
        rid = restart["id"]
        if restart["state"] == "requested":  # the configuration check never ran or never finished: nothing was restarted by this run
            finish(db, rid, "failed", "interrupted")
        else:
            sent_at = restart["created_at"]
            SPAWN(lambda: _poll_platform(db, settings, rid, sent_ok=True, sent_at=sent_at), f"platform-restart-resume-{rid}")
        outcome = outcome or "platform_resumed"
    return outcome


def update_follow(db: Database, settings: Settings, run_id: str, job_id: str) -> None:
    try:
        _follow(db, settings, run_id, job_id)
    except Exception:  # noqa: BLE001 - the run is settled by the next start or the janitor
        log.exception("update run %s: following the job stopped", run_id)


def health(db: Database, settings: Settings, to_version: str) -> tuple[bool, list[str]]:
    """The checks after an update (design section 6). Returns (healthy, failed check names)."""
    failed: list[str] = []
    try:
        with db.connection(label="update_runs.health") as conn:
            highest = max((int(p.name[:4]) for p in MIGRATIONS_DIR.glob("[0-9][0-9][0-9][0-9]_*.sql")), default=0)
            applied = conn.execute("SELECT MAX(version) FROM schema_migrations").fetchone()[0] or 0
            if applied < highest:
                failed.append("schema")
            set_setting(conn, "update.health_probe_at", _iso())  # the database takes a write
    except sqlite3.Error:
        failed.append("database")
    if __version__ != to_version:
        failed.append("version")
    reply = su.call(settings, "GET", su.P_INFO)
    data = reply.data or {}
    if reply.kind != "ok" or str(data.get("version") or "") != to_version or data.get("state") != "started":
        failed.append("infrastructure")
    return not failed, failed


def verify_worker(db: Database, settings: Settings, run_id: str) -> None:
    try:
        _verify(db, settings, run_id)
    except Exception:  # noqa: BLE001
        log.exception("update run %s: the health check stopped", run_id)


def _verify(db: Database, settings: Settings, run_id: str) -> None:
    with db.connection(mode="read", label="update_runs.verify") as conn:
        row = get_run(conn, run_id)
    if row is None or row["state"] in TERMINAL:
        return
    ok, failed = health(db, settings, row["to_version"])
    if not ok:
        advance(db, run_id, step="health_retry")
        _sleep(HEALTH_RETRY_S)
        ok, failed = health(db, settings, row["to_version"])
    if not ok:
        finish(db, run_id, "failed", "health_check_failed", extra={"failed_checks": failed})
        return
    with db.connection(mode="read", label="update_runs.reasons") as conn:
        reasons = [r["code"] for r in platform_restart.reasons(conn)]
    finish(db, run_id, "succeeded", extra={"platform_restart_reasons": reasons})
    try:  # the menu marker and the "update available" state clear (design section 5 step 7)
        out = su.run_check(settings, refresh=False)
        with db.connection(label="update_runs.recheck") as conn:
            su.record(conn, out, _now(), refresh=False)
    except Exception:  # noqa: BLE001
        log.warning("update run %s: the follow-up version read failed", run_id)


# ------------------------------------------------------------------------------------------------ the platform restart worker

def platform_worker(db: Database, settings: Settings, run_id: str) -> None:
    try:
        _platform_worker(db, settings, run_id)
    except Exception:  # noqa: BLE001
        log.exception("platform restart run %s: the worker stopped", run_id)


def _platform_worker(db: Database, settings: Settings, run_id: str) -> None:
    check = addon_restart.check_platform_config(settings)
    if check.kind != "ok":
        if check.kind == "error" and check.status == 400:
            code = "platform_config_invalid"   # the check ran and found the configuration broken: never restart into it
        elif check.kind == "dropped":
            code = "infrastructure_unreachable"  # no answer = no passed check = no restart
        else:
            code = _error_code(check)
        finish(db, run_id, "failed", code, extra={"upstream_status": check.status, "stage": "config_check"})
        return
    if not advance(db, run_id, state="restarting", step="restart_sent"):
        return
    sent_at = _iso()
    reply = addon_restart.restart_platform(settings)
    if reply.kind not in ("ok", "dropped"):
        finish(db, run_id, "failed", _error_code(reply), extra={"upstream_status": reply.status, "stage": "restart"})
        return
    advance(db, run_id, step="restart_accepted" if reply.kind == "ok" else "outcome_unknown")
    _poll_platform(db, settings, run_id, sent_ok=reply.kind == "ok", sent_at=sent_at)


def _bridge_paired(db: Database) -> tuple[bool, str]:
    with db.connection(mode="read", label="update_runs.bridge") as conn:
        return bool(get_setting(conn, "bridge.paired_at")), get_setting(conn, "bridge.directory_at") or ""


def _poll_platform(db: Database, settings: Settings, run_id: str, *, sent_ok: bool, sent_at: str) -> None:
    """Arx keeps running while the platform core restarts. The restart is never resent. Success only after the post-restart check:
    1. the core went down: DOWN_SAMPLES consecutive answers that are not `running` (one transient error is no restart) - or, when the
       restart was ACCEPTED, RESTART_SETTLE_S passed (the call may return only once the core is back);
    2. then UP_SAMPLES consecutive `running` answers (a core that falls again right after it came back is not back);
    3. when the bridge is paired: a bridge directory push at or after the first of those `running` answers (a push of the OLD core
       between the restart call and its shutdown proves nothing).
    `sent_at` is kept for the caller's signature (resume after an Arx restart)."""
    del sent_at
    with db.connection(mode="read", label="update_runs.poll_platform") as conn:
        row = get_run(conn, run_id)
    if row is None or row["state"] in TERMINAL:
        return
    start = _clock()
    deadline = start + max(0.0, timeout_of(row) - _age_s(row["created_at"]))
    seen_down = False
    down_streak = up_streak = 0
    back_at = ""
    core_back = False
    paired, _ = _bridge_paired(db)
    while _clock() < deadline:
        _sleep(POLL_S)
        if not core_back:
            reply = addon_restart.platform_info(settings)
            running = reply.kind == "ok" and (reply.data or {}).get("state") == "running"
            if not running:
                up_streak = 0
                down_streak += 1
                seen_down = seen_down or down_streak >= DOWN_SAMPLES
                continue
            down_streak = 0
            if not seen_down and not (sent_ok and _clock() - start >= RESTART_SETTLE_S):
                continue
            up_streak += 1
            if up_streak == 1:
                back_at = _iso()
            if up_streak < UP_SAMPLES:
                continue
            core_back = True
            advance(db, run_id, state="verifying", step="bridge_wait" if paired else "waiting_for_platform")
            if not paired:
                break
        _, directory_at = _bridge_paired(db)
        if directory_at >= back_at:
            break
    else:
        if core_back:
            code = "bridge_not_loaded"
        elif seen_down or sent_ok:
            code = "platform_not_back"
        else:
            code = "restart_not_observed"  # the outcome of the call is unknown and no restart was seen: never claimed
        finish(db, run_id, "failed", code)
        return
    finish(db, run_id, "succeeded", extra={"bridge_paired": paired})
