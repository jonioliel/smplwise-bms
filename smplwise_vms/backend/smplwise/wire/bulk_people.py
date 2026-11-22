"""Response models of routers/bulk_people.py (RESPONSE-MODELS-E-2480, code review 07:F8 step 2)."""
from __future__ import annotations

from typing import Any

from . import ExactModel, Num

# routes without a JSON body
NO_JSON: frozenset[str] = frozenset({'GET /access-control/bulk-people/export.csv', 'GET /access-control/bulk-people/template.csv'})
# JSON routes without a model yet: no test reaches a successful answer (or the answer is not one object); counted by the ratchet
# (scripts/wire_ratchet.py) until they are modelled
UNMODELLED: frozenset[str] = frozenset({'GET /access-control/bulk-people/jobs/{job_id}/wiskey-result'})


class BulkPeopleSettingsLimits(ExactModel):
    max_file_bytes: Num
    max_rows: Num
    max_edit_people: Num
    batch: Num
    export_rows: Num
    job_hours: Num


class BulkPeopleSettingsWiskeyCsv(ExactModel):
    enabled: str
    available: bool
    blockers: list[str]
    mode: str
    modes: list[str]
    fields: list[str]


class BulkPeopleSettings(ExactModel):
    enabled: str
    go_live_permitted: bool
    limits: BulkPeopleSettingsLimits
    columns: list[str]
    wiskey_csv: BulkPeopleSettingsWiskeyCsv
    system_admin: bool
    may_import: bool
    may_export: bool


class BulkPeoplePutSettings(ExactModel):
    enabled: str
    go_live_permitted: bool
    limits: BulkPeopleSettingsLimits
    columns: list[str]


class BulkPeopleStageImportJobReportItem(ExactModel):
    row: Num
    status: str
    codes: list[str]
    fields: list[str]


class BulkPeopleStageImportJobProgress(ExactModel):
    done: Num
    total: Num


class BulkPeopleStageImportJob(ExactModel):
    id: str
    kind: str
    state: str
    row_count: Num
    created_at: str
    expires_at: str
    report: list[BulkPeopleStageImportJobReportItem]
    counts: dict[str, Any]
    plan: Any
    plan_digest: Any
    previewed_at: Any
    writes: Any
    confirmed: bool
    results: list[Any]
    outcomes: dict[str, Any]
    progress: BulkPeopleStageImportJobProgress
    go_live_permitted: bool


class BulkPeopleStageImport(ExactModel):
    """Upload -> parse -> the validation report."""
    job: BulkPeopleStageImportJob
    replayed: bool


class BulkPeopleStageEditJobReportItem(ExactModel):
    row: Num
    status: str
    codes: list[Any]
    fields: list[str]


class BulkPeopleStageEditJob(ExactModel):
    id: str
    kind: str
    state: str
    row_count: Num
    created_at: str
    expires_at: str
    report: list[BulkPeopleStageEditJobReportItem]
    counts: dict[str, Any]
    plan: Any
    plan_digest: Any
    previewed_at: Any
    writes: Any
    confirmed: bool
    results: list[Any]
    outcomes: dict[str, Any]
    progress: BulkPeopleStageImportJobProgress
    go_live_permitted: bool


class BulkPeopleStageEdit(ExactModel):
    """Bulk edit: validity window, doors add / remove, groups add / remove, activate / deactivate - staged like an import."""
    job: BulkPeopleStageEditJob
    replayed: bool


class BulkPeopleJob(ExactModel):
    job: BulkPeopleStageEditJob


class BulkPeopleDryRunJobPlanItem(ExactModel):
    row: Num
    op: str
    person_id: str | None
    revision: Num | None
    fields: list[str]
    data: str


class BulkPeopleDryRunJob(ExactModel):
    id: str
    kind: str
    state: str
    row_count: Num
    created_at: str
    expires_at: str
    report: list[BulkPeopleStageImportJobReportItem]
    counts: dict[str, Any]
    plan: list[BulkPeopleDryRunJobPlanItem]
    plan_digest: str
    previewed_at: str
    writes: Num
    confirmed: bool
    results: list[Any]
    outcomes: dict[str, Any]
    progress: BulkPeopleStageImportJobProgress
    go_live_permitted: bool


class BulkPeopleDryRunRow(ExactModel):
    row: Num
    op: str
    person_id: str | None
    status: str
    codes: list[str]
    fields: list[str]
    name: str = None
    diff: list[dict[str, Any]] = None


class BulkPeopleDryRun(ExactModel):
    """The diff at the caller's field level against one fresh directory read."""
    job: BulkPeopleDryRunJob
    rows: list[BulkPeopleDryRunRow]


class BulkPeopleConfirmJob(ExactModel):
    id: str
    kind: str
    state: str
    row_count: Num
    created_at: str
    expires_at: str
    report: list[BulkPeopleStageEditJobReportItem]
    counts: dict[str, Any]
    plan: list[BulkPeopleDryRunJobPlanItem]
    plan_digest: str
    previewed_at: str
    writes: Num
    confirmed: bool
    results: list[Any]
    outcomes: dict[str, Any]
    progress: BulkPeopleStageImportJobProgress
    go_live_permitted: bool


class BulkPeopleConfirm(ExactModel):
    job: BulkPeopleConfirmJob


class BulkPeopleApplyJobResult(ExactModel):
    row: Num
    outcome: str
    code: str | None
    person_id: str | None


class BulkPeopleApplyJob(ExactModel):
    id: str
    kind: str
    state: str
    row_count: Num
    created_at: str
    expires_at: str
    report: list[BulkPeopleStageEditJobReportItem]
    counts: dict[str, Any]
    plan: list[BulkPeopleDryRunJobPlanItem]
    plan_digest: str
    previewed_at: str
    writes: Num
    confirmed: bool
    results: list[BulkPeopleApplyJobResult]
    outcomes: dict[str, Num]
    progress: BulkPeopleStageImportJobProgress
    go_live_permitted: bool
    stalled: bool = None
    more: bool = None


class BulkPeopleApply(ExactModel):
    """The next bounded batch."""
    job: BulkPeopleApplyJob


class BulkPeopleWiskeyPreview(ExactModel):
    """WisKey's own verified preview of the file the job was staged from (the same bytes: their SHA-256 must equal the job's)."""
    job: BulkPeopleStageImportJob
    preview: dict[str, Any]


class BulkPeopleWiskeyConfirmOperation(ExactModel):
    state: str
    replay_available: bool


class BulkPeopleWiskeyConfirm(ExactModel):
    """The explicit confirm: a system administrator in an interactive session types the number of lines shown."""
    job: BulkPeopleStageEditJob
    operation: BulkPeopleWiskeyConfirmOperation
