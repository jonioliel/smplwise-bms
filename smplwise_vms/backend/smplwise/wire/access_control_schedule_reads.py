"""Response models of routers/access_control_schedule_reads.py (WISKEY-SCHED-READS-2520: WisKey's signed schedule inspection jobs,
contract `wiskey-schedule-reads.v1`)."""
from __future__ import annotations

from typing import Any

from . import ExactModel

# routes without a JSON body
NO_JSON: frozenset[str] = frozenset()
# JSON routes without a model yet (scripts/wire_ratchet.py): none
UNMODELLED: frozenset[str] = frozenset()


class ScheduleReadsSupport(ExactModel):
    """Whether the start / status cycle can run now: `state` supported / unsupported (WisKey does not list both commands, or names
    another contract) / unavailable (the signed direct connection is not in use or not ready); `reason` a code; `contract` the ABI."""
    state: str
    reason: str | None
    contract: str


class ScheduleRead(ExactModel):
    """One inspection Arx started. `state`: sending / not_sent / accepted / running / completed / refused / unknown (an UNKNOWN is settled
    only by a status read with the same request id; start is never sent again). `data`: the closed projection of a completed result
    (no tokens), else null. `plan_revision`: the plan revision the result returned (never assumed)."""
    request_id: str
    action: str
    subject: str
    revision: int | None
    state: str
    start_outcome: str | None
    wiskey_code: str | None
    plan_revision: int | None
    data: dict[str, Any] | None
    created_at: str
    updated_at: str
    status_at: str | None
    status_reads: int
    final: bool
    can_check: bool


class ScheduleReadsList(ExactModel):
    """`GET /access-control/schedules/reads`: the support state and the newest inspections (persisted rows; no schedule command sent)."""
    support: ScheduleReadsSupport
    reads: list[ScheduleRead]


class ScheduleStatusRead(ExactModel):
    """The outcome of the status read itself: ok (WisKey answered within the contract) / not_needed (the row is final) / not_sent /
    refused / unknown / error (`contract_mismatch`) - the row is unchanged unless ok."""
    outcome: str
    code: str | None


class ScheduleReadAnswer(ExactModel):
    """A start (`read` null when the cycle is not supported now: nothing persisted, nothing sent) or a status read (`status_read`)."""
    support: ScheduleReadsSupport
    read: ScheduleRead | None
    status_read: ScheduleStatusRead | None = None
