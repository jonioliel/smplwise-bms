"""Response models of routers/access_control_schedule_execution.py (WISKEY-A2-EXEC-2530: the read-only status of WisKey's reviewed
schedule execution, contract `wiskey-schedule-execution.v1`; the owner approves and runs in WisKey's own screen)."""
from __future__ import annotations

from . import ExactModel

# routes without a JSON body
NO_JSON: frozenset[str] = frozenset()
# JSON routes without a model yet (scripts/wire_ratchet.py): none
UNMODELLED: frozenset[str] = frozenset()


class ScheduleExecutionSupport(ExactModel):
    """Whether the status read can run now: `state` supported / unsupported (WisKey does not list `operations_status_v1` for the add-on's
    signed connection) / unavailable (the signed direct connection is not in use or not ready) / off (the switch is off: nothing read);
    `reason` a code; `contract` the execution contract."""
    state: str
    reason: str | None
    contract: str


class ScheduleExecutionReviews(ExactModel):
    """How many of WisKey's reviews of this job are pending / approved / rejected (WisKey's dual approval; read, never decided)."""
    pending: int
    approved: int
    rejected: int


class ScheduleExecutionJob(ExactModel):
    """The last status read of one WisKey job (memory only). `phase`: waiting_owner / review_pending / approved / rejected / executing /
    attention / executed / failed / cancelled / not_found / unknown. `physical_result` is always `unproven` (WisKey's own word);
    `final`: executed or cancelled - not read again."""
    job_id: str
    phase: str
    code: str | None
    job_status: str | None
    job_revision: int | None
    station_id: str | None
    deployment_status: str | None
    steps_total: int
    steps_verified: int
    reviews: ScheduleExecutionReviews
    reviews_read: bool
    physical_result: str
    read_at: str
    final: bool


class ScheduleExecutionView(ExactModel):
    """`GET /access-control/schedules/execution`: the switch, whether this user may change it, the support state (no WisKey call when
    the switch is off) and the jobs read so far."""
    enabled: bool
    can_configure: bool
    support: ScheduleExecutionSupport
    jobs: list[ScheduleExecutionJob]


class ScheduleExecutionStatusRead(ExactModel):
    """The outcome of the status read itself: ok / not_needed (final) / not_sent / refused / unknown / error (`contract_mismatch`)."""
    outcome: str
    code: str | None


class ScheduleExecutionCheck(ExactModel):
    """`POST /access-control/schedules/execution/{job_id}/status`: one signed status read (never anything else)."""
    support: ScheduleExecutionSupport
    job: ScheduleExecutionJob | None
    status_read: ScheduleExecutionStatusRead
