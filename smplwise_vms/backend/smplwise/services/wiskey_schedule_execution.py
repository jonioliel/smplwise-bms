"""WISKEY-A2-EXEC-2530 (target 2.53; owner 25.11: A2 deferred from 2.52, option b - "the owner approves in WisKey's screen, Arx shows
status only"; WisKey PRODUCT 2.0.1-rc.20 `dcebb9f34c8f`, contract `wiskey-schedule-execution.v1`, docs/contracts/full-management-v1/
schedules--operations_*_v1): the READ-ONLY view of WisKey's reviewed schedule execution in Arx.

What WisKey's contract lets the add-on identity (the signed pairing principal of the direct join) do - the gap analysis is in
docs/changes/WISKEY-A2-EXEC-2530.md section 2; the short form:
- `schedules/operations_status_v1` {job_id}, `schedules/operations_pending_v1` {}, `schedules/operations_review_v1` {review_id}: READS
  (WisKey's READ_COMMANDS; over the bridge `require_owner` passes for a verified pairing scope). Arx uses these three, and only these.
- `schedules/operations_decide_v1`: an APPROVAL. WisKey refuses only the review's own actor (`separate_approver_required`), so the
  pairing principal could approve a review someone else opened. The owner decided Arx never approves: never sent.
- `schedules/operations_execute_v1`: over the bridge WisKey SKIPS its dual-approval check (`dual = ... and not bridge_authorized(...)`,
  schedule_execution_api.py), so an execute from Arx would run a schedule on a station with no owner approval at all - the same as a
  self-approval. Never sent.
- `schedules/operations_preview_v1`: opens a review bound to the CALLER's actor; only that actor can consume it (operations_center
  `consume`: `row["actor"] != actor` -> review_expired). A review Arx opened could be approved by the owner but executed only by Arx -
  which is the execute above. Never sent. `schedules/operations_cancel_v1`: a write on the operation; status only - never sent.
  These four are refused `owner_action_in_wiskey` before any byte by wiskey_direct_catalog.direct_refusal (SCHEDULE_EXECUTION_OWNER_ONLY).
- There is no "submit for the owner's approval" primitive that the owner can both approve AND run: the owner works on WisKey's JOBS
  (operations list) in WisKey's own screen - preview, his own approval rules, execute. Arx's existing deploy (`operations_create` +
  WisKey's preflight, services/wiskey_schedule_writes.py) already puts the job in that list. This module adds nothing that writes.

The status read (the B2-ABI rules applied to a read):
- a fresh signed frame per call (DirectLink signs every request with its own nonce and 10 s proof window), each call's timeout
  0 < t <= 58 s checked before anything is sent (`timeout_exceeds_abi`, not_sent);
- discovery first: `operations_status_v1` must be listed for the CURRENT direct connection (else `unsupported` / `unavailable`, nothing
  sent; no version inference, no fallback to the classic Home Assistant socket - that socket's identity is not the add-on's);
- the answer must be exactly WisKey's ScheduleExecutionStatus (closed: eleven keys, the constants `contract`, `physical_result:
  unproven`, `replay_available: false`, `all_intermediate_events_delivered: false`, the job's closed ScheduleJob and the deployment's
  closed ScheduleDeployment) for the job that was asked; anything else is `contract_mismatch` and changes nothing;
- UNKNOWN is settled only by a status read of the SAME job id; a failed read never downgrades what was known, and a final result
  (executed and verified, cancelled) is not read again. Nothing is ever re-sent: there is nothing here to replay.

The phase Arx shows (never "open", never a button that runs anything):
    waiting_owner   the job exists in WisKey, nothing ran; the next step is the owner's, in WisKey's screen
    review_pending  WisKey holds a review of this job waiting for a second approver (WisKey's dual-approval setting)
    approved        a review of this job is approved in WisKey; it has not run yet
    rejected        the review of this job was rejected in WisKey
    executing       WisKey's deployment record exists and is in progress
    attention       interrupted / recovery required - WisKey's screen decides what happens next
    executed        job `verified` AND deployment `verified` with every step verified (WisKey's own read-back; `physical_result`
                    stays `unproven` as WisKey says it)
    failed          the job failed or the deployment is in conflict
    cancelled       the job was cancelled in WisKey
    not_found       WisKey does not know this job id (archived or never there)
    unknown         a read could not tell (no read yet after a failure, an answer outside the contract, a verified job without a
                    deployment record - a legacy job is never shown as executed)
The existing deploy warning (`deployWritesOff`) stays; the screen softens it only after a status read showed `executed`.

Everything behind the installation switch `wiskey.schedule_execution_status` (default `off`: nothing is read, nothing changes on any
screen). The last reads are kept in memory only (a restart forgets them: the warning comes back until a new read). Tests:
tests/test_wiskey_schedule_execution_2530.py (fakes only). Nothing here was run against a real WisKey, Home Assistant or station."""
from __future__ import annotations

import logging
import re
import threading
from collections import OrderedDict
from datetime import datetime, timezone
from typing import Any, Callable, Mapping, Protocol

log = logging.getLogger("smplwise.wiskey.schedule_execution")

CONTRACT = "wiskey-schedule-execution.v1"
STATUS = "schedules/operations_status_v1"
PENDING = "schedules/operations_pending_v1"
REVIEW = "schedules/operations_review_v1"
READS = (STATUS, PENDING, REVIEW)
# Never sent by Arx, whatever discovery lists (owner 25.11 option b; the gap analysis above). The same set is refused on the direct
# envelope by wiskey_direct_catalog.SCHEDULE_EXECUTION_OWNER_ONLY.
NEVER = frozenset({"schedules/operations_decide_v1", "schedules/operations_execute_v1", "schedules/operations_preview_v1",
                   "schedules/operations_cancel_v1"})

SWITCH_KEY = "wiskey.schedule_execution_status"  # "on" shows the status block; anything else (default) is off
AUDIT_SETTINGS = "intercom.schedule_execution_settings"

STATUS_TIMEOUT_S = 15.0  # WisKey answers from its journal at once; no station I/O
REVIEW_TIMEOUT_S = 10.0
MAX_TIMEOUT_S = 58.0  # B2-ABI: every signed call 0 < t <= 58 s
MAX_REVIEW_READS = 3  # per status check
KEEP = 64  # remembered jobs (memory only)

JOB_STATUSES = ("pending", "queued", "checking", "blocked", "ready", "interrupted", "failed", "cancelled", "verified")
DEPLOYMENT_STATUSES = ("ready", "recovery_required", "conflict", "verified")
ISSUES = ("read_failed", "write_uncertain", "context_changed", "resource_changed")
OWNERSHIP = ("not_checked", "missing", "current", "changed")
STEP_STATES = ("pending", "intent", "verified")
RESUME_STATES = ("snapshot", "unchanged", "reset_required")
REVIEW_STATES = ("pending", "approved", "rejected")
PHASES = ("waiting_owner", "review_pending", "approved", "rejected", "executing", "attention", "executed", "failed", "cancelled",
          "not_found", "unknown")
FINAL_PHASES = frozenset({"executed", "cancelled"})

STATUS_KEYS = frozenset({"contract", "operation_id", "cursor", "resume_state", "reason", "all_intermediate_events_delivered", "job",
                         "deployment", "terminal", "physical_result", "replay_available"})
JOB_KEYS = frozenset({"id", "revision", "plan_id", "plan_revision", "station_id", "name", "resource_keys", "created_at", "updated_at",
                      "status", "error", "blockers", "report", "journal_id", "ownership"})
DEPLOYMENT_KEYS = frozenset({"id", "revision", "status", "issue", "created_at", "updated_at", "steps"})
STEP_KEYS = frozenset({"key", "state", "attempted"})
PENDING_KEYS = frozenset({"contract", "reviews"})
PENDING_ROW_KEYS = frozenset({"review_id", "operation_id", "own_request", "remaining_seconds"})
REVIEW_KEYS = frozenset({"contract", "review_id", "operation_id", "fingerprint", "draft", "station_id", "resource_keys", "own_request",
                         "state", "remaining_seconds"})
ID_RE = re.compile(r"^[^\x00-\x1f\x7f]{1,128}$")
CODE_RE = re.compile(r"^[a-z][a-z0-9_]{0,63}$")
CURSOR_RE = re.compile(r"^[1-9][0-9]{0,9}\.[0-9]{1,10}\.[0-9a-f]{64}$")


class SchemaError(ValueError):
    """An answer outside the closed contract (`code` = contract_mismatch, `where` the field)."""

    def __init__(self, code: str, where: str) -> None:
        super().__init__(f"{code}:{where}")
        self.code, self.where = code, where


class ReadError(Exception):
    """A read that could not be done; `outcome` not_sent | refused | unknown."""

    def __init__(self, code: str, outcome: str) -> None:
        super().__init__(code)
        self.code, self.outcome = code, outcome


class PortFailure(Exception):
    """The transport's outcome contract (wiskey_direct_join): not_sent | refused | unknown, with WisKey's / the link's code."""

    def __init__(self, code: str, outcome: str) -> None:
        super().__init__(code)
        self.code, self.outcome = code, outcome


class Port(Protocol):
    def support(self) -> tuple[str, str | None, frozenset[str]]: ...

    def call(self, command: str, parameters: dict[str, Any], *, timeout: float) -> Any: ...


def _code(value: Any) -> str | None:
    """A machine code as Arx keeps it; free text is never echoed."""
    if value is None:
        return None
    return value if isinstance(value, str) and CODE_RE.fullmatch(value) else "other"


def check_timeout(timeout: Any) -> float:
    """B2-ABI: 0 < timeout <= 58 s for every signed call, checked before anything is signed or sent."""
    if isinstance(timeout, bool) or not isinstance(timeout, (int, float)) or not 0 < timeout <= MAX_TIMEOUT_S:
        raise ReadError("timeout_exceeds_abi", "not_sent")
    return float(timeout)


def valid_job_id(value: Any) -> bool:
    return isinstance(value, str) and ID_RE.fullmatch(value) is not None


# ---------------------------------------------------------------- the closed answers

def _int(v: Any, lo: int, hi: int) -> bool:
    return type(v) is int and lo <= v <= hi


def _str(v: Any, hi: int, lo: int = 1) -> bool:
    return isinstance(v, str) and lo <= len(v) <= hi


def _nullable_str(v: Any, hi: int) -> bool:
    return v is None or _str(v, hi, 0)


def _check_job(job: Any, job_id: str) -> dict[str, Any]:
    if not isinstance(job, Mapping) or set(job) != JOB_KEYS:
        raise SchemaError("contract_mismatch", "job")
    checks = (
        ("job.id", valid_job_id(job["id"]) and job["id"] == job_id),
        ("job.revision", _int(job["revision"], 1, 2147483647)),
        ("job.plan_id", valid_job_id(job["plan_id"])),
        ("job.plan_revision", _int(job["plan_revision"], 1, 9007199254740991)),
        ("job.station_id", valid_job_id(job["station_id"])),
        ("job.name", _str(job["name"], 32)),
        ("job.resource_keys", isinstance(job["resource_keys"], list) and len(job["resource_keys"]) <= 67
         and all(_str(k, 64) for k in job["resource_keys"])),
        ("job.created_at", _str(job["created_at"], 64)),
        ("job.updated_at", _str(job["updated_at"], 64)),
        ("job.status", isinstance(job["status"], str) and job["status"] in JOB_STATUSES),
        ("job.error", _nullable_str(job["error"], 128)),
        ("job.blockers", isinstance(job["blockers"], list) and len(job["blockers"]) <= 32 and all(_str(b, 128, 0) for b in job["blockers"])),
        ("job.report", job["report"] is None or isinstance(job["report"], Mapping)),
        ("job.journal_id", job["journal_id"] is None or valid_job_id(job["journal_id"])),
        ("job.ownership", isinstance(job["ownership"], str) and job["ownership"] in OWNERSHIP),
    )
    for where, ok in checks:
        if not ok:
            raise SchemaError("contract_mismatch", where)
    return dict(job)


def _check_deployment(dep: Any) -> dict[str, Any] | None:
    if dep is None:
        return None
    if not isinstance(dep, Mapping) or set(dep) != DEPLOYMENT_KEYS:
        raise SchemaError("contract_mismatch", "deployment")
    steps = dep["steps"]
    checks = (
        ("deployment.id", valid_job_id(dep["id"])),
        ("deployment.revision", _int(dep["revision"], 1, 2147483647)),
        ("deployment.status", isinstance(dep["status"], str) and dep["status"] in DEPLOYMENT_STATUSES),
        ("deployment.issue", dep["issue"] is None or (isinstance(dep["issue"], str) and dep["issue"] in ISSUES)),
        ("deployment.created_at", _str(dep["created_at"], 64)),
        ("deployment.updated_at", _str(dep["updated_at"], 64)),
        ("deployment.steps", isinstance(steps, list) and len(steps) <= 67),
    )
    for where, ok in checks:
        if not ok:
            raise SchemaError("contract_mismatch", where)
    for step in steps:
        if (not isinstance(step, Mapping) or set(step) != STEP_KEYS or not _str(step["key"], 64)
                or not (isinstance(step["state"], str) and step["state"] in STEP_STATES) or type(step["attempted"]) is not bool):
            raise SchemaError("contract_mismatch", "deployment.steps")
    return {**dict(dep), "steps": [dict(s) for s in steps]}


def read_status(raw: Any, job_id: str) -> dict[str, Any]:
    """WisKey's ScheduleExecutionStatus, closed, for THIS job id. Raises SchemaError(`contract_mismatch`) - the answer is rejected whole."""
    if not isinstance(raw, Mapping):
        raise SchemaError("contract_mismatch", "result")
    keys = set(raw)
    if keys != STATUS_KEYS:
        raise SchemaError("contract_mismatch", ",".join(sorted(keys ^ STATUS_KEYS))[:64] or "result")
    checks = (
        ("contract", raw["contract"] == CONTRACT),
        ("operation_id", raw["operation_id"] == job_id),
        ("cursor", isinstance(raw["cursor"], str) and len(raw["cursor"]) <= 96 and CURSOR_RE.fullmatch(raw["cursor"]) is not None),
        ("resume_state", isinstance(raw["resume_state"], str) and raw["resume_state"] in RESUME_STATES),
        ("reason", raw["reason"] in (None, "cursor_ahead", "intermediate_transitions_not_retained")),
        ("all_intermediate_events_delivered", raw["all_intermediate_events_delivered"] is False),
        ("terminal", type(raw["terminal"]) is bool),
        ("physical_result", raw["physical_result"] == "unproven"),
        ("replay_available", raw["replay_available"] is False),
    )
    for where, ok in checks:
        if not ok:
            raise SchemaError("contract_mismatch", where)
    return {"job": _check_job(raw["job"], job_id), "deployment": _check_deployment(raw["deployment"]), "terminal": raw["terminal"]}


def read_pending(raw: Any) -> list[dict[str, Any]]:
    """SchedulePending, closed. Returns the rows (review ids stay in memory only for the review reads of this check)."""
    if not isinstance(raw, Mapping) or set(raw) != PENDING_KEYS or raw["contract"] != CONTRACT:
        raise SchemaError("contract_mismatch", "pending")
    rows = raw["reviews"]
    if not isinstance(rows, list) or len(rows) > 200:
        raise SchemaError("contract_mismatch", "pending.reviews")
    out = []
    for row in rows:
        if (not isinstance(row, Mapping) or set(row) != PENDING_ROW_KEYS or not valid_job_id(row["review_id"])
                or not valid_job_id(row["operation_id"]) or type(row["own_request"]) is not bool
                or not _int(row["remaining_seconds"], 0, 300)):
            raise SchemaError("contract_mismatch", "pending.reviews")
        out.append(dict(row))
    return out


def read_review(raw: Any, review_id: str, job_id: str) -> str:
    """ScheduleReview: only `state` is kept (pending / approved / rejected). The fingerprint and the draft are never kept: Arx does not
    decide."""
    if not isinstance(raw, Mapping) or set(raw) != REVIEW_KEYS or raw["contract"] != CONTRACT:
        raise SchemaError("contract_mismatch", "review")
    if raw["review_id"] != review_id or raw["operation_id"] != job_id:
        raise SchemaError("contract_mismatch", "review.ids")
    if not (isinstance(raw["state"], str) and raw["state"] in REVIEW_STATES):
        raise SchemaError("contract_mismatch", "review.state")
    return raw["state"]


# ---------------------------------------------------------------- the phase

def phase_of(status: dict[str, Any], reviews: Mapping[str, int]) -> tuple[str, str | None]:
    """(phase, code) from one closed status answer and the review counts of this job."""
    job, dep = status["job"], status["deployment"]
    js = job["status"]
    ds = dep["status"] if dep else None
    if js == "cancelled":
        return "cancelled", None
    if js == "failed":
        return "failed", _code(job["error"]) or "schedule_operation_failed"
    if dep is not None:
        if ds == "conflict":
            return "failed", dep["issue"] or "deployment_conflict"
        if ds == "recovery_required" or js == "interrupted":
            return "attention", dep["issue"] or ("schedule_operation_interrupted" if js == "interrupted" else "recovery_required")
        if js == "verified" and ds == "verified" and dep["steps"] and all(s["state"] == "verified" for s in dep["steps"]):
            return "executed", None
        if js == "verified" and ds == "verified":
            return "unknown", "deployment_steps_unverified"
        return "executing", None
    # no deployment record: nothing ran through WisKey's reviewed execution
    if js == "verified":
        return "unknown", "deployment_missing"  # a legacy job is never shown as executed
    if js == "interrupted":
        return "attention", _code(job["error"]) or "schedule_operation_interrupted"
    if reviews.get("approved"):
        return "approved", None
    if reviews.get("pending"):
        return "review_pending", None
    if reviews.get("rejected"):
        return "rejected", None
    blockers = [b for b in job["blockers"] if isinstance(b, str) and b]
    return "waiting_owner", _code(job["error"]) or (_code(blockers[0]) if blockers else None)


# ---------------------------------------------------------------- the transport (the installed direct join)

class JoinPort:
    """The three reads over the installed direct join's ONE signed connection."""

    RUN_MARGIN_S = 5.0

    def __init__(self, join: Any) -> None:
        self.join = join

    def __repr__(self) -> str:
        return "JoinPort()"

    def support(self) -> tuple[str, str | None, frozenset[str]]:
        """(`supported`, None, listed reads) | (`unsupported`, reason, ...) | (`unavailable`, reason, ...). May open the connection and
        read discovery (never a schedule command)."""
        join = self.join
        if not join.configured():
            return "unavailable", "direct_not_selected", frozenset()
        if not join.selected(STATUS):
            refusal = join.session.transport_refusal(STATUS)
            if refusal == "command_not_discovered":
                return "unsupported", "not_listed", frozenset()
            return "unavailable", refusal or "wiskey_direct_not_connected", frozenset()
        listed = {STATUS}
        if join.selected(PENDING) and join.selected(REVIEW):
            listed |= {PENDING, REVIEW}
        return "supported", None, frozenset(listed)

    def call(self, command: str, parameters: dict[str, Any], *, timeout: float) -> Any:
        from . import wiskey_media_bridge as bridge

        if command not in READS:  # the three reads only; NEVER is refused again by the session (catalog.direct_refusal)
            raise PortFailure("owner_action_in_wiskey", "not_sent")
        session = self.join.session
        try:
            return session.run_sync(session.call(command, parameters, timeout=timeout), timeout + self.RUN_MARGIN_S)
        except bridge.MediaBridgeError as exc:
            outcome = exc.outcome if exc.outcome in ("not_sent", "refused") else "unknown"
            raise PortFailure(exc.code, outcome) from None
        except Exception as exc:  # noqa: BLE001 - after a possible hand-over: unknown, never a not-sent proof
            raise PortFailure(type(exc).__name__, "unknown") from None


def default_port() -> Port | None:
    from . import wiskey_direct_join

    join = wiskey_direct_join.installed()
    return None if join is None else JoinPort(join)


PORT_PROVIDER: Callable[[], Port | None] = default_port  # tests replace it


def _support_of(port: Port | None) -> tuple[dict[str, Any], frozenset[str]]:
    if port is None:
        return {"state": "unavailable", "reason": "direct_not_installed", "contract": CONTRACT}, frozenset()
    try:
        state, reason, listed = port.support()
    except Exception as exc:  # noqa: BLE001 - unreadable: not usable now
        state, reason, listed = "unavailable", type(exc).__name__, frozenset()
    if state not in ("supported", "unsupported", "unavailable"):
        state, reason, listed = "unavailable", "support_unreadable", frozenset()
    return {"state": state, "reason": _code(reason), "contract": CONTRACT}, frozenset(listed)


def support() -> dict[str, Any]:
    return _support_of(PORT_PROVIDER())[0]


# ---------------------------------------------------------------- the switch

def switch_on(conn: Any) -> bool:
    from ..db import get_setting

    try:
        return (get_setting(conn, SWITCH_KEY) or "off") == "on"
    except Exception:  # noqa: BLE001 - an unreadable switch is off
        return False


def set_switch(conn: Any, on: bool) -> tuple[str, str]:
    from ..db import set_setting

    before = "on" if switch_on(conn) else "off"
    set_setting(conn, SWITCH_KEY, "on" if on else "off")
    return before, "on" if on else "off"


# ---------------------------------------------------------------- what was read (memory only)

_LOCK = threading.Lock()
_SEEN: "OrderedDict[str, dict[str, Any]]" = OrderedDict()
_BUSY: set[str] = set()


def reset() -> None:
    with _LOCK:
        _SEEN.clear()
        _BUSY.clear()


def _iso(t: datetime) -> str:
    return t.astimezone(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")


def _remember(view: dict[str, Any]) -> None:
    with _LOCK:
        _SEEN[view["job_id"]] = view
        _SEEN.move_to_end(view["job_id"])
        while len(_SEEN) > KEEP:
            _SEEN.popitem(last=False)


def known(job_id: str) -> dict[str, Any] | None:
    with _LOCK:
        v = _SEEN.get(job_id)
        return dict(v) if v else None


def known_all() -> list[dict[str, Any]]:
    with _LOCK:
        return [dict(v) for v in reversed(_SEEN.values())]


def _view(job_id: str, phase: str, code: str | None, now: datetime, status: dict[str, Any] | None = None,
          reviews: Mapping[str, int] | None = None, reviews_read: bool = False) -> dict[str, Any]:
    job = status["job"] if status else None
    dep = status["deployment"] if status else None
    steps = dep["steps"] if dep else []
    return {
        "job_id": job_id,
        "phase": phase,
        "code": code,
        "job_status": job["status"] if job else None,
        "job_revision": job["revision"] if job else None,
        "station_id": job["station_id"] if job else None,
        "deployment_status": dep["status"] if dep else None,
        "steps_total": len(steps),
        "steps_verified": sum(1 for s in steps if s["state"] == "verified"),
        "reviews": {k: int((reviews or {}).get(k, 0)) for k in REVIEW_STATES},
        "reviews_read": reviews_read,
        "physical_result": "unproven",
        "read_at": _iso(now),
        "final": phase in FINAL_PHASES,
    }


def check(job_id: str, *, port: Port | None = None, clock: Callable[[], datetime] | None = None,
          timeout: float = STATUS_TIMEOUT_S, review_timeout: float = REVIEW_TIMEOUT_S) -> dict[str, Any]:
    """One status check of one WisKey job: the signed status read, then (when listed) the pending reviews of this job. Returns
    {support, job, status_read: {outcome, code}}; `job` is the remembered view (unchanged unless the read answered within the contract,
    or WisKey said the job does not exist). Never sends anything but the three reads. Raises ValueError on a malformed id, ReadError
    (`timeout_exceeds_abi` / `schedule_status_busy`, not_sent)."""
    if not valid_job_id(job_id):
        raise ValueError("job_id")
    check_timeout(timeout)
    check_timeout(review_timeout)
    now_of = clock or (lambda: datetime.now(timezone.utc))
    prior = known(job_id)
    port = port if port is not None else PORT_PROVIDER()
    sup, listed = _support_of(port)
    if prior is not None and prior["final"]:  # executed / cancelled: a later read can never take that back
        return {"support": sup, "job": prior, "status_read": {"outcome": "not_needed", "code": "final"}}
    if sup["state"] != "supported" or port is None:
        return {"support": sup, "job": prior, "status_read": {"outcome": "not_sent", "code": sup["reason"] or sup["state"]}}
    with _LOCK:
        if job_id in _BUSY:
            raise ReadError("schedule_status_busy", "not_sent")
        _BUSY.add(job_id)
    try:
        return _check(job_id, port, listed, sup, prior, now_of, timeout, review_timeout)
    finally:
        with _LOCK:
            _BUSY.discard(job_id)


def _check(job_id: str, port: Port, listed: frozenset[str], sup: dict[str, Any], prior: dict[str, Any] | None,
           now_of: Callable[[], datetime], timeout: float, review_timeout: float) -> dict[str, Any]:
    def answer(outcome: str, code: str | None, view: dict[str, Any] | None = None) -> dict[str, Any]:
        if view is not None:
            _remember(view)
        return {"support": sup, "job": view if view is not None else prior, "status_read": {"outcome": outcome, "code": code}}

    try:
        raw = port.call(STATUS, {"job_id": job_id}, timeout=timeout)
    except PortFailure as f:
        if f.outcome == "refused" and f.code == "schedule_operation_not_found":
            return answer("ok", f.code, _view(job_id, "not_found", f.code, now_of()))
        log.info("wiskey schedule execution status: %s (%s)", f.outcome, f.code)
        if prior is None:  # nothing known yet: say so, never "not sent" for the job itself
            return answer(f.outcome, _code(f.code), _view(job_id, "unknown", _code(f.code) or "status_unknown", now_of()))
        return answer(f.outcome, _code(f.code))
    try:
        status = read_status(raw, job_id)
    except SchemaError as exc:
        if prior is None:
            return answer("error", exc.code, _view(job_id, "unknown", exc.code, now_of()))
        return answer("error", exc.code)
    counts = {k: 0 for k in REVIEW_STATES}
    reviews_read = False
    if status["deployment"] is None and status["job"]["status"] not in ("cancelled", "failed", "verified") and PENDING in listed:
        reviews_read = _read_reviews(port, job_id, counts, review_timeout)
    phase, code = phase_of(status, counts)
    return answer("ok", None, _view(job_id, phase, code, now_of(), status, counts, reviews_read))


def _read_reviews(port: Port, job_id: str, counts: dict[str, int], timeout: float) -> bool:
    """The pending reviews of this job (WisKey's dual approval). True when they were read; a failed read leaves the counts at zero
    and the phase falls back to `waiting_owner` (which is what the owner's screen will show too)."""
    try:
        rows = read_pending(port.call(PENDING, {}, timeout=timeout))
    except (PortFailure, SchemaError) as exc:
        log.info("wiskey schedule execution pending: %s", getattr(exc, "code", exc))
        return False
    mine = [r for r in rows if r["operation_id"] == job_id][:MAX_REVIEW_READS]
    for row in mine:
        try:
            state = read_review(port.call(REVIEW, {"review_id": row["review_id"]}, timeout=timeout), row["review_id"], job_id)
        except PortFailure as f:
            if f.outcome == "refused" and f.code == "review_expired":
                continue  # expired between the two reads: no longer a review
            return False
        except SchemaError:
            return False
        counts[state] += 1
    return True
