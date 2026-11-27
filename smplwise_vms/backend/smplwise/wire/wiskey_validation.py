"""Response models of routers/wiskey_validation.py (RESPONSE-MODELS-E-2480, code review 07:F8 step 2)."""
from __future__ import annotations

from typing import Any

from . import ExactModel, Num

# routes without a JSON body
NO_JSON: frozenset[str] = frozenset({'GET /wiskey-validation/runs/{run_id}/export.csv'})
# JSON routes without a model yet: no test reaches a successful answer (or the answer is not one object); counted by the ratchet
# (scripts/wire_ratchet.py) until they are modelled
UNMODELLED: frozenset[str] = frozenset({'POST /wiskey-validation/runs/{run_id}/cancel'})


class WiskeyValidationOverviewStation(ExactModel):
    id: str
    name: str
    online: bool
    doors: list[dict[str, Any]]
    can_pulse: bool


class WiskeyValidationOverviewCheck(ExactModel):
    key: str
    label: str


class WiskeyValidationOverviewRun(ExactModel):
    id: str
    scope: str
    state: str
    created_by_name: str | None
    created_at: str
    finished_at: str | None
    station_count: Num
    counts: dict[str, Any]


class WiskeyValidationOverviewRights(ExactModel):
    run: bool
    pulse: bool
    pulse_local: bool


class WiskeyValidationOverview(ExactModel):
    feed_state: str
    stations: list[WiskeyValidationOverviewStation]
    checks: list[WiskeyValidationOverviewCheck]
    runs: list[WiskeyValidationOverviewRun]
    active_run_id: str | None
    rights: WiskeyValidationOverviewRights


class WiskeyValidationStart(ExactModel):
    run_id: str


class WiskeyValidationRunStationProgress(ExactModel):
    done: Num
    total: Num


class WiskeyValidationRunStation(ExactModel):
    station_id: str
    name: str | None
    checks: list[dict[str, Any]]
    counts: dict[str, Any]
    progress: WiskeyValidationRunStationProgress


class WiskeyValidationRunPuls(ExactModel):
    id: str
    kind: str
    scope: str
    parent_run_id: str
    state: str
    created_by: str
    created_by_name: str | None
    created_at: str
    finished_at: str | None  # WIRE-DRIFT-2550: null while the run is running
    cancel_requested: bool
    station_count: Num
    stations: list[dict[str, Any]]
    counts: dict[str, Any]
    progress: WiskeyValidationRunStationProgress
    pulses: list[Any]


class WiskeyValidationRun(ExactModel):
    id: str
    kind: str
    scope: str
    parent_run_id: Any
    state: str
    created_by: str
    created_by_name: str | None
    created_at: str
    finished_at: str | None  # WIRE-DRIFT-2550: null while the run is running
    cancel_requested: bool
    station_count: Num
    stations: list[WiskeyValidationRunStation]
    counts: dict[str, Any]
    progress: WiskeyValidationRunStationProgress
    pulses: list[WiskeyValidationRunPuls]


class WiskeyValidationPulse(ExactModel):
    run_id: str
    result: dict[str, Any]


class WiskeyValidationWitness(ExactModel):
    run_id: str
    status: str
    reason: str
