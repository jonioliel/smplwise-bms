"""WISKEY-SCHED-READS-2520 (owner decision B2-ABI = a; WisKey PRODUCT 2.0.1-rc.20 `dcebb9f34c8f`, contract `wiskey-schedule-reads.v1`,
docs/contracts/schedule-reads-v1/ README + start / status / result schemas): Arx's consumer of WisKey's signed schedule INSPECTION jobs.

Why: WisKey's six schedule inspections read the station for up to 70-130 s, but every signed call Arx makes must end within 58 s
(Home Assistant's 60 s call limit; Arx's DirectLink cap). The synchronous reads of services/wiskey_schedule_writes.py therefore end
"still reading - try again" (unknown) on a slow station. The ABI splits one inspection into a short signed START and signed STATUS
reads, each well under 58 s. A timeout cap alone is not this ABI: this module is the full start / status cycle.

The cycle (exactly the contract's three rules):
1. Discovery first. Both `schedules/read_start_v1` and `schedules/read_status_v1` must be listed for the CURRENT direct connection's
   identity (direct/capabilities[_v3] `commands`) AND named `{"contract": "wiskey-schedule-reads.v1"}` in its `business_contracts`.
   Otherwise nothing is persisted and nothing is sent: the answer is `unsupported` (not listed / another contract) or `unavailable`
   (the signed direct connection is not in use, not connected, not discovered). No version-label inference, no fallback to the
   synchronous read after a refusal.
2. A canonical UUID `request_id` is generated and its row COMMITTED (state `sending`) before the start frame is written. The start
   is sent ONCE. Its outcome:
     ok        -> WisKey's status (`accepted` / `running` / `completed` / `refused`) as it answered;
     not_sent  -> proven: no byte of the frame was written (state `not_sent`; nothing to ask about);
     refused   -> a verified refusal with a definite code (state `refused`, WisKey's code kept);
     anything else (timeout, lost connection, unverifiable or out-of-contract reply, a refusal whose code says nothing about the
     outcome) -> `unknown`. An UNKNOWN start is settled ONLY by a status read with the SAME UUID. Start is never sent again for a
     row - not on a retry, a reconnect, a process restart or an unknown status (WisKey would refuse `schedule_read_request_reused`
     anyway; Arx does not even ask).
3. Every status read is a NEW signed request: the direct link signs each frame with a fresh nonce and its own 10 s proof window
   (wiskey_media_bridge.DirectLink), so a status read after the start proof expired carries a valid fresh proof. Each call's timeout
   is checked here to be 0 < t <= 58 s before anything is sent (`timeout_exceeds_abi`, not_sent). A status that WisKey reports as
   `unknown` (no record: evicted, restarted, never admitted) keeps the row UNKNOWN (`history_complete` is false): it is never read
   as "not sent" and never as "done". A row that is final (`completed`, `refused`) is not read again: a later eviction can never turn
   a known result back into unknown.

Closed schemas (rejected WHOLE, never trimmed): the start business parameters (`start.schema.json`, including the per-operation
parameter sets of its `oneOf`) and the status parameters are built and checked here before sending; the reply must be exactly
`result.schema.json` (ten keys, the constants `contract`, `scope`, `history_complete: false`, `replay_available: false`,
`max_status_wait_seconds: 0`, the status enum, the operation enum) for the request id that was asked and the operation that was
started. An undeclared key, a missing key or a wrong value refuses the whole answer (`contract_mismatch`); for a start that makes the
outcome `unknown` (the frame was sent).

What is kept from a completed result: the closed projection of the ORIGINAL operation result by the same functions as the synchronous
reads (wiskey_schedule_writes.project_*), with every one-use `token` removed (a token is bound to WisKey's pairing principal and Arx
has no use for it: this is a read), and the returned plan revision (`revision` of a plan, `plan_revision` of a claim preview) - never
assumed to increment or stay the same.

Not here (and not authorised by this ABI): any station write, claim confirmation, deployment, approval, grant, user / card change, or
the reviewed schedule execution family (`operations_decide_v1` and the rest: Arx A2, deferred by the owner to 2.53). The existing
warning that Arx does not execute schedules on the stations stays as it is; legacy schedules are never shown as open.

Transport: the installed direct join (services/wiskey_direct_join.py) - its one authenticated signed connection, its discovery and its
`call` (outcome contract not_sent / refused / unknown). WisKey admits these commands only from a genuine pairing principal; the Home
Assistant channel answers `pairing_authentication_required`, so Arx never sends them there. Tests: tests/test_wiskey_schedule_reads_2520.py
(fakes only). Nothing here was run against a real WisKey, Home Assistant or station."""
from __future__ import annotations

import json
import logging
import uuid
from datetime import datetime, timedelta, timezone
from typing import Any, Callable, Mapping, Protocol

from . import wiskey_schedule_writes as sw

log = logging.getLogger("smplwise.wiskey.schedule_reads")

CONTRACT = "wiskey-schedule-reads.v1"
START = "schedules/read_start_v1"
STATUS = "schedules/read_status_v1"
COMMANDS = (START, STATUS)
SCOPE = "current_runtime_and_pairing"

# the Arx action (what the browser names) -> the original WisKey operation the worker runs
ACTIONS: dict[str, str] = {
    "readiness": "schedules/readiness",
    "dependencies": "schedules/dependencies",
    "assess": "schedules/assess",
    "plan_preview": "schedules/plan_preview",
    "plan_recheck": "schedules/plan_recheck",
    "claim_preview": "schedules/operations_claim_preview",
}
OPERATIONS = frozenset(ACTIONS.values())
ACTION_OF = {v: k for k, v in ACTIONS.items()}
# start.schema.json `oneOf`: the exact parameter set of each operation and the JSON type of each parameter
PARAMETERS: dict[str, dict[str, type]] = {
    "schedules/readiness": {"station_id": str},
    "schedules/dependencies": {"station_id": str},
    "schedules/assess": {"station_id": str, "data": dict},
    "schedules/plan_preview": {"station_id": str, "schedule_id": str, "revision": int, "bindings": dict},
    "schedules/plan_recheck": {"plan_id": str, "revision": int},
    "schedules/operations_claim_preview": {"plan_id": str, "revision": int},
}
STATUSES = ("accepted", "running", "completed", "refused", "unknown")
RESULT_KEYS = frozenset({"contract", "request_id", "status", "operation", "result", "error", "scope", "history_complete", "replay_available",
                         "max_status_wait_seconds"})
ROW_STATES = ("sending", "not_sent", "accepted", "running", "completed", "refused", "unknown")
FINAL = frozenset({"completed", "refused", "not_sent"})  # nothing more to ask WisKey about

START_TIMEOUT_S = 10.0  # the start acknowledges one admission without waiting for the station
STATUS_TIMEOUT_S = 15.0  # WisKey answers a status at once (`max_status_wait_seconds` 0)
MAX_TIMEOUT_S = 58.0  # B2-ABI: every signed call 0 < t <= 58 s (wiskey_media_bridge.MAX_CALL_TIMEOUT_S)
SENDING_STALE_S = 120.0  # a `sending` row older than this lost its start outcome (a crash mid-send): UNKNOWN, settled by status only
KEEP_ROWS = 200  # retention: the newest rows; final rows go first
MAX_RESULT_BYTES = 256 * 1024  # WisKey's own per-result bound
# a start refusal whose code says nothing about whether WisKey admitted the job: the outcome is unknown (settled by status)
UNCLEAR_CODES = frozenset({"", "bridge_outcome_unknown", "Unauthorized", "unauthorized", "unknown_error", "timeout", "invalid_response",
                           "storage_or_internal_error", "action_failed"})


class SchemaError(ValueError):
    """A request or an answer outside the closed contract: `code` (`schema_rejected` / `contract_mismatch`), `where` the field path."""

    def __init__(self, code: str, where: str) -> None:
        super().__init__(f"{code}:{where}")
        self.code, self.where = code, where


class ReadError(Exception):
    """A read that could not be (fully) done. `outcome`: not_sent | refused | unknown | error; `code`: the reason."""

    def __init__(self, code: str, outcome: str) -> None:
        super().__init__(code)
        self.code, self.outcome = code, outcome


class PortFailure(Exception):
    """The transport's outcome contract (wiskey_direct_join): not_sent | refused | unknown, with WisKey's / the link's code."""

    def __init__(self, code: str, outcome: str) -> None:
        super().__init__(code)
        self.code, self.outcome = code, outcome


class Port(Protocol):
    def support(self) -> tuple[str, str | None]: ...

    def call(self, command: str, parameters: dict[str, Any], *, timeout: float) -> Any: ...


# ---------------------------------------------------------------- the closed schemas

def canonical_uuid(value: Any) -> bool:
    """A canonical lowercase UUID string (the form Arx generates and WisKey's `format: uuid` names)."""
    if not isinstance(value, str) or len(value) != 36:
        return False
    try:
        return str(uuid.UUID(value)) == value
    except ValueError:
        return False


def new_request_id() -> str:
    return str(uuid.uuid4())


def _typed(value: Any, kind: type) -> bool:
    if kind is int:
        return type(value) is int  # a bool is not an integer here (JSON true is not 1)
    return isinstance(value, kind) and not isinstance(value, bool)


def check_start(body: Any) -> dict[str, Any]:
    """start.schema.json: exactly {request_id, command, parameters}; the command one of the six; the parameters exactly that
    operation's set with their JSON types. Returns the body unchanged; raises SchemaError(`schema_rejected`) otherwise."""
    if not isinstance(body, Mapping) or set(body) != {"request_id", "command", "parameters"}:
        raise SchemaError("schema_rejected", "start")
    if not canonical_uuid(body["request_id"]):
        raise SchemaError("schema_rejected", "request_id")
    command = body["command"]
    if command not in PARAMETERS:
        raise SchemaError("schema_rejected", "command")
    params, shape = body["parameters"], PARAMETERS[command]
    if not isinstance(params, Mapping) or set(params) != set(shape):
        raise SchemaError("schema_rejected", "parameters")
    for key, kind in shape.items():
        if not _typed(params[key], kind):
            raise SchemaError("schema_rejected", f"parameters.{key}")
    return {"request_id": body["request_id"], "command": command, "parameters": dict(params)}


def check_status(body: Any) -> dict[str, Any]:
    """status.schema.json: exactly {request_id} with a canonical UUID."""
    if not isinstance(body, Mapping) or set(body) != {"request_id"} or not canonical_uuid(body["request_id"]):
        raise SchemaError("schema_rejected", "status")
    return {"request_id": body["request_id"]}


def read_result(raw: Any, request_id: str, operation: str) -> dict[str, Any]:
    """result.schema.json, closed, for THIS request id and operation (`operation` may be null only when the status is unknown).
    Raises SchemaError(`contract_mismatch`) on any undeclared / missing key or wrong value - the answer is rejected whole."""
    if not isinstance(raw, Mapping):
        raise SchemaError("contract_mismatch", "result")
    keys = set(raw)
    if keys != RESULT_KEYS:
        raise SchemaError("contract_mismatch", ",".join(sorted(keys ^ RESULT_KEYS))[:64] or "result")
    checks = (
        ("contract", raw["contract"] == CONTRACT and isinstance(raw["contract"], str)),
        ("request_id", raw["request_id"] == request_id and canonical_uuid(raw["request_id"])),
        ("status", isinstance(raw["status"], str) and raw["status"] in STATUSES),
        ("operation", raw["operation"] is None or (isinstance(raw["operation"], str) and raw["operation"] in OPERATIONS)),
        ("result", raw["result"] is None or isinstance(raw["result"], Mapping)),
        ("error", raw["error"] is None or isinstance(raw["error"], str)),
        ("scope", raw["scope"] == SCOPE and isinstance(raw["scope"], str)),
        ("history_complete", raw["history_complete"] is False),
        ("replay_available", raw["replay_available"] is False),
        ("max_status_wait_seconds", type(raw["max_status_wait_seconds"]) is int and raw["max_status_wait_seconds"] == 0),
    )
    for key, ok in checks:
        if not ok:
            raise SchemaError("contract_mismatch", key)
    if raw["operation"] is not None and raw["operation"] != operation:
        raise SchemaError("contract_mismatch", "operation")  # an answer about another operation is not this request's
    if raw["operation"] is None and raw["status"] != "unknown":
        raise SchemaError("contract_mismatch", "operation")
    return {k: raw[k] for k in RESULT_KEYS}


def check_timeout(timeout: Any) -> float:
    """B2-ABI: 0 < timeout <= 58 s for every signed call, checked before anything is signed or sent."""
    if isinstance(timeout, bool) or not isinstance(timeout, (int, float)) or not 0 < timeout <= MAX_TIMEOUT_S:
        raise ReadError("timeout_exceeds_abi", "not_sent")
    return float(timeout)


# ---------------------------------------------------------------- the completed result (closed projection, no tokens)

PROJECT: dict[str, Callable[[Any], Any]] = {
    "schedules/readiness": sw.project_readiness,
    "schedules/dependencies": sw.project_dependencies,
    "schedules/assess": sw.project_assess,
    "schedules/plan_preview": sw.project_plan,
    "schedules/plan_recheck": sw.project_plan,
    "schedules/operations_claim_preview": sw.project_claim_preview,
}


def _no_tokens(value: Any) -> Any:
    if isinstance(value, dict):
        return {k: _no_tokens(v) for k, v in value.items() if k != "token"}
    if isinstance(value, list):
        return [_no_tokens(v) for v in value]
    return value


def project_completed(operation: str, result: Any) -> tuple[dict[str, Any] | None, int | None, str | None]:
    """(data, plan_revision, code): the operation's closed projection without tokens, the plan revision it returned (None when it
    returned none), and a code when the result could not be read (`result_missing`, `result_unrecognised`, `result_too_large`)."""
    if not isinstance(result, Mapping):
        return None, None, "result_missing"
    try:
        data = _no_tokens(PROJECT[operation](dict(result)))
    except (ValueError, KeyError, TypeError):
        return None, None, "result_unrecognised"
    revision: int | None = None
    if operation in ("schedules/plan_preview", "schedules/plan_recheck"):
        revision = data.get("revision") if type(data.get("revision")) is int else None
    elif operation == "schedules/operations_claim_preview":
        revision = data.get("plan_revision") if type(data.get("plan_revision")) is int else None
    if len(json.dumps(data, ensure_ascii=False).encode("utf-8")) > MAX_RESULT_BYTES:
        return None, revision, "result_too_large"
    return data, revision, None


# ---------------------------------------------------------------- the transport (the installed direct join)

class JoinPort:
    """The two commands over the installed direct join's ONE signed connection."""

    RUN_MARGIN_S = 5.0

    def __init__(self, join: Any) -> None:
        self.join = join

    def __repr__(self) -> str:
        return "JoinPort()"

    def support(self) -> tuple[str, str | None]:
        """(`supported`, None) | (`unsupported`, reason) | (`unavailable`, reason). May open the connection and read discovery (never a
        schedule command)."""
        join = self.join
        if not join.configured():
            return "unavailable", "direct_not_selected"
        for command in COMMANDS:
            if not join.selected(command):
                refusal = join.session.transport_refusal(command)
                if refusal == "command_not_discovered":
                    return "unsupported", "not_listed"
                return "unavailable", refusal or "wiskey_direct_not_connected"
        caps = getattr(join.session.discovery, "capabilities", None)
        if caps is None:
            return "unavailable", "discovery_missing"
        for command in COMMANDS:
            declared = caps.business_contracts.get(command) if isinstance(caps.business_contracts, Mapping) else None
            if not isinstance(declared, Mapping) or dict(declared) != {"contract": CONTRACT}:
                return "unsupported", "contract_mismatch"
        return "supported", None

    def call(self, command: str, parameters: dict[str, Any], *, timeout: float) -> Any:
        from . import wiskey_media_bridge as bridge

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


def support() -> dict[str, Any]:
    """Whether the cycle can run now: {state: supported | unsupported | unavailable, reason, contract}. Never raises."""
    port = PORT_PROVIDER()
    if port is None:
        return {"state": "unavailable", "reason": "direct_not_installed", "contract": CONTRACT}
    try:
        state, reason = port.support()
    except Exception as exc:  # noqa: BLE001 - unreadable: not usable now
        state, reason = "unavailable", type(exc).__name__
    if state not in ("supported", "unsupported", "unavailable"):
        state, reason = "unavailable", "support_unreadable"
    return {"state": state, "reason": reason, "contract": CONTRACT}


# ---------------------------------------------------------------- the persisted rows

def _now(clock: Callable[[], datetime] | None = None) -> datetime:
    return (clock or (lambda: datetime.now(timezone.utc)))()


def _iso(t: datetime) -> str:
    return t.astimezone(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")


COLUMNS = ("request_id", "action", "operation", "subject", "revision", "state", "start_outcome", "wiskey_code", "plan_revision", "result_json",
           "requested_by", "created_at", "updated_at", "status_at", "status_reads")


def _row(r: Any) -> dict[str, Any]:
    return dict(zip(COLUMNS, tuple(r)))


def get(db: Any, request_id: str) -> dict[str, Any] | None:
    with db.connection(mode="read") as conn:
        r = conn.execute(f"SELECT {', '.join(COLUMNS)} FROM wiskey_schedule_reads WHERE request_id = ?", (request_id,)).fetchone()
    return None if r is None else _row(r)


def recent(db: Any, limit: int = 10) -> list[dict[str, Any]]:
    with db.connection(mode="read") as conn:
        rows = conn.execute(f"SELECT {', '.join(COLUMNS)} FROM wiskey_schedule_reads ORDER BY created_at DESC, rowid DESC LIMIT ?",
                            (max(1, min(int(limit), 50)),)).fetchall()
    return [_row(r) for r in rows]


def _update(db: Any, request_id: str, now: datetime, **fields: Any) -> None:
    sets = ", ".join(f"{k} = ?" for k in fields)
    with db.write_aside() as w:
        w.execute(f"UPDATE wiskey_schedule_reads SET {sets}, updated_at = ? WHERE request_id = ?", (*fields.values(), _iso(now), request_id))


def settle_stale(db: Any, clock: Callable[[], datetime] | None = None) -> int:
    """A row still `sending` long after its start (the process died mid-send) lost its start outcome: UNKNOWN, settled by status only."""
    now = _now(clock)
    cutoff = _iso(now - timedelta(seconds=SENDING_STALE_S))
    with db.connection(mode="read") as conn:  # the write lock only when there is something to settle
        if conn.execute("SELECT 1 FROM wiskey_schedule_reads WHERE state = 'sending' AND created_at < ? LIMIT 1", (cutoff,)).fetchone() is None:
            return 0
    with db.write_aside() as w:
        cur = w.execute("UPDATE wiskey_schedule_reads SET state = 'unknown', start_outcome = 'unknown', wiskey_code = 'start_outcome_lost', "
                        "updated_at = ? WHERE state = 'sending' AND created_at < ?", (_iso(now), cutoff))
        return cur.rowcount or 0


def prune(db: Any) -> int:
    """Keep the newest KEEP_ROWS rows; the oldest FINAL rows go first, an open UNKNOWN only when nothing final is left to drop."""
    with db.write_aside() as w:
        n = w.execute("SELECT COUNT(*) FROM wiskey_schedule_reads").fetchone()[0]
        extra = n - KEEP_ROWS
        if extra <= 0:
            return 0
        w.execute("DELETE FROM wiskey_schedule_reads WHERE request_id IN (SELECT request_id FROM wiskey_schedule_reads "
                  "ORDER BY CASE WHEN state IN ('completed', 'refused', 'not_sent') THEN 0 ELSE 1 END, created_at ASC LIMIT ?)", (extra,))
        return extra


def view(row: dict[str, Any]) -> dict[str, Any]:
    """What the screen shows: ids, the action, the station / plan, the state, WisKey's code, the returned plan revision and the closed
    projection of a completed result. `can_check`: a status read may tell more (the row is not final and not being sent now)."""
    data = None
    if row.get("result_json"):
        try:
            data = json.loads(row["result_json"])
        except ValueError:
            data = None
    state = row["state"]
    return {
        "request_id": row["request_id"], "action": row["action"], "subject": row["subject"], "revision": row["revision"],
        "state": state, "start_outcome": row["start_outcome"], "wiskey_code": row["wiskey_code"], "plan_revision": row["plan_revision"],
        "data": data, "created_at": row["created_at"], "updated_at": row["updated_at"], "status_at": row["status_at"],
        "status_reads": row["status_reads"], "final": state in FINAL, "can_check": state in ("accepted", "running", "unknown"),
    }


# ---------------------------------------------------------------- the cycle

def _c(code: Any) -> str | None:
    """A machine code as Arx keeps it (free text is never echoed: intercom_adapter._code)."""
    return sw.ad._code(code)


def _apply(db: Any, request_id: str, operation: str, result: dict[str, Any], now: datetime, **extra: Any) -> None:
    status = result["status"]
    fields: dict[str, Any] = dict(extra)
    if status == "completed":
        data, plan_revision, code = project_completed(operation, result["result"])
        fields.update(state="completed", wiskey_code=code, plan_revision=plan_revision,
                      result_json=None if data is None else json.dumps(data, ensure_ascii=False, separators=(",", ":")))
    elif status == "refused":
        fields.update(state="refused", wiskey_code=sw.ad._code(result["error"]) or "refused")
    elif status == "unknown":
        fields.update(state="unknown", wiskey_code=sw.ad._code(result["error"]) or "status_unknown")
    else:  # accepted / running: not completion
        fields.update(state=status, wiskey_code=None)
    _update(db, request_id, now, **fields)


def start(db: Any, user: str, action: str, parameters: Mapping[str, Any], *, port: Port | None = None,
          clock: Callable[[], datetime] | None = None, timeout: float = START_TIMEOUT_S) -> dict[str, Any]:
    """One inspection: the closed start body, discovery, the row committed, the start sent ONCE. Returns {support, read}: `read` is None
    (nothing persisted or sent) unless the cycle is supported. Raises SchemaError (`schema_rejected`, nothing sent) or ReadError
    (`timeout_exceeds_abi`, nothing sent)."""
    if action not in ACTIONS:
        raise SchemaError("schema_rejected", "action")
    operation = ACTIONS[action]
    request_id = new_request_id()
    body = check_start({"request_id": request_id, "command": operation, "parameters": dict(parameters)})
    check_timeout(timeout)
    port = port if port is not None else PORT_PROVIDER()
    sup = support() if port is None else _support_of(port)
    if sup["state"] != "supported" or port is None:
        return {"support": sup, "read": None}
    now = _now(clock)
    params = body["parameters"]
    subject = params.get("station_id") or params.get("plan_id") or ""
    revision = params.get("revision") if type(params.get("revision")) is int else None
    with db.write_aside() as w:  # committed BEFORE the frame: a lost acknowledgement stays an UNKNOWN with this UUID
        w.execute("INSERT INTO wiskey_schedule_reads(request_id, action, operation, subject, revision, state, requested_by, created_at, updated_at) "
                  "VALUES (?, ?, ?, ?, ?, 'sending', ?, ?, ?)", (request_id, action, operation, subject, revision, user, _iso(now), _iso(now)))
    try:
        raw = port.call(START, body, timeout=timeout)
    except PortFailure as f:
        if f.outcome == "not_sent":
            _update(db, request_id, _now(clock), state="not_sent", start_outcome="not_sent", wiskey_code=_c(f.code))
        elif f.outcome == "refused" and f.code not in UNCLEAR_CODES:
            _update(db, request_id, _now(clock), state="refused", start_outcome="refused", wiskey_code=_c(f.code))
        else:
            _update(db, request_id, _now(clock), state="unknown", start_outcome="unknown", wiskey_code=_c(f.code) or "start_outcome_unknown")
        log.info("wiskey schedule read %s: start %s (%s)", action, f.outcome, f.code)
    except BaseException:
        _update(db, request_id, _now(clock), state="unknown", start_outcome="unknown", wiskey_code="start_outcome_unknown")
        raise
    else:
        try:
            result = read_result(raw, request_id, operation)
        except SchemaError as exc:  # sent, but the answer is outside the contract: the outcome is unknown, never "not sent"
            _update(db, request_id, _now(clock), state="unknown", start_outcome="unknown", wiskey_code=exc.code)
        else:
            _apply(db, request_id, operation, result, _now(clock), start_outcome="ok")
    prune(db)
    row = get(db, request_id)
    return {"support": sup, "read": view(row) if row else None}


def _support_of(port: Port) -> dict[str, Any]:
    try:
        state, reason = port.support()
    except Exception as exc:  # noqa: BLE001
        state, reason = "unavailable", type(exc).__name__
    if state not in ("supported", "unsupported", "unavailable"):
        state, reason = "unavailable", "support_unreadable"
    return {"state": state, "reason": reason, "contract": CONTRACT}


def status(db: Any, request_id: str, *, port: Port | None = None, clock: Callable[[], datetime] | None = None,
           timeout: float = STATUS_TIMEOUT_S) -> dict[str, Any]:
    """One signed status read for a row Arx started. Returns {support, read, status_read: {outcome, code}}: `outcome` ok when WisKey
    answered within the contract (the row then carries its answer), else not_sent / refused / unknown / error with the row UNCHANGED.
    Never sends start. Raises SchemaError (malformed id) or LookupError (Arx never started this id)."""
    check_status({"request_id": request_id})
    check_timeout(timeout)
    settle_stale(db, clock)
    row = get(db, request_id)
    if row is None:
        raise LookupError(request_id)
    port = port if port is not None else PORT_PROVIDER()
    sup = support() if port is None else _support_of(port)

    def answer(outcome: str, code: str | None) -> dict[str, Any]:
        current = get(db, request_id) or row
        return {"support": sup, "read": view(current), "status_read": {"outcome": outcome, "code": code}}

    if row["state"] in FINAL:
        return answer("not_needed", "final" if row["state"] != "not_sent" else "never_sent")
    if row["state"] == "sending":
        return answer("not_sent", "start_in_flight")
    if sup["state"] != "supported" or port is None:
        return answer("not_sent", sup["reason"] or sup["state"])
    try:
        raw = port.call(STATUS, {"request_id": request_id}, timeout=timeout)
    except PortFailure as f:
        return answer(f.outcome, _c(f.code))
    try:
        result = read_result(raw, request_id, row["operation"])
    except SchemaError as exc:
        return answer("error", exc.code)
    now = _now(clock)
    _apply(db, request_id, row["operation"], result, now, status_at=_iso(now), status_reads=int(row["status_reads"] or 0) + 1)
    return answer("ok", None)


def listing(db: Any, limit: int = 10, *, clock: Callable[[], datetime] | None = None) -> dict[str, Any]:
    """The screen's list: the support state and the newest rows (no WisKey call beyond discovery)."""
    settle_stale(db, clock)
    return {"support": support(), "reads": [view(r) for r in recent(db, limit)]}
