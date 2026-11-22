"""Response models of routers/access_control_ops.py (RESPONSE-MODELS-E-2480, code review 07:F8 step 2)."""
from __future__ import annotations

from typing import Any

from . import ExactModel

# routes without a JSON body
NO_JSON: frozenset[str] = frozenset()
# JSON routes without a model yet: no test reaches a successful answer (or the answer is not one object); counted by the ratchet
# (scripts/wire_ratchet.py) until they are modelled
UNMODELLED: frozenset[str] = frozenset({'GET /access-control/operations/capacity', 'GET /access-control/operations/events-report', 'GET /access-control/operations/exports/audit.csv', 'GET /access-control/operations/exports/fleet-inventory.csv', 'GET /access-control/operations/investigations', 'GET /access-control/operations/jobs', 'GET /access-control/operations/jobs/{job_id}/errors.csv', 'GET /access-control/operations/operations', 'POST /access-control/operations/jobs/{job_id}/cancel'})


class AccessControlOpsOverviewSummary(ExactModel):
    state: str
    code: str
    message: str
    details: dict[str, str]


class AccessControlOpsOverviewViews(ExactModel):
    summary: Any
    operations: Any
    investigations: Any
    jobs: Any
    job_errors: Any
    capacity: Any
    inventory: Any
    audit_export: Any
    events_report: Any
    cancel: Any


class AccessControlOpsOverviewCan(ExactModel):
    admin: bool
    export: bool
    cancel: bool
    names: bool
    employee_numbers: bool
    actors: bool


class AccessControlOpsOverview(ExactModel):
    """The KPI row and the stations (from `overview/summary`), which views this WisKey lists, and what the caller may do here."""
    summary: AccessControlOpsOverviewSummary
    views: AccessControlOpsOverviewViews
    can: AccessControlOpsOverviewCan
