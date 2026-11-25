"""Response models of routers/access_control_station_ops.py (RESPONSE-MODELS-E-2480, code review 07:F8 step 2)."""
from __future__ import annotations

from typing import Any

from . import ExactModel

# routes without a JSON body
NO_JSON: frozenset[str] = frozenset()
# JSON routes without a model yet: no test reaches a successful answer (or the answer is not one object); counted by the ratchet
# (scripts/wire_ratchet.py) until they are modelled
UNMODELLED: frozenset[str] = frozenset({'POST /access-control/stations/{station_id}/maintenance/{action}'})


class AccessControlStationOpsMaintenanceViewReport(ExactModel):
    state: str
    fresh: bool
    fetched_at: Any
    last_error: str | None
    health: Any
    auth: Any


class AccessControlStationOpsMaintenanceViewLastRuns(ExactModel):
    sync: Any
    rescan: Any
    health_refresh: Any
    clock_refresh: Any


class AccessControlStationOpsMaintenanceView(ExactModel):
    station_id: str
    online: Any
    feed: str
    health_hidden: bool
    technical: Any
    report: AccessControlStationOpsMaintenanceViewReport
    auth_seen: Any
    actions: dict[str, Any]
    last_runs: AccessControlStationOpsMaintenanceViewLastRuns
    sync_mode: str  # WISKEY-R4-2520: `request_id` (sync/station_v1) | `classic` (sync/station)
    sync_gate: str | None  # WISKEY-R4-2520: null, `outcome_pending` or `readback_required` (an unknown numbered sync holds the next one)


class AccessControlStationOpsSyncRequest(ExactModel):
    """WISKEY-R4-2520: GET .../maintenance/sync-request - the station's numbered sync as WisKey's `system/status_v1` shows it."""

    station_id: str
    state: str
    reason: str | None
    wiskey_code: str | None
    fetched_at: str | None
    gate_before: str | None
    gate: str | None
    last_request: Any  # {status, request_id, at, code} | null
    match: str | None  # running | queued | finished | not_observed | null
    observation: Any  # {connection, loaded, sync_state, last_reconciled_at, request} | null
