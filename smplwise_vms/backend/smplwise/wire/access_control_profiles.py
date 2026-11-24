"""Response models of routers/access_control_profiles.py (RESPONSE-MODELS-E-2480, code review 07:F8 step 2)."""
from __future__ import annotations

from typing import Any

from . import ExactModel, Num

# routes without a JSON body
NO_JSON: frozenset[str] = frozenset()
# JSON routes without a model yet: no test reaches a successful answer (or the answer is not one object); counted by the ratchet
# (scripts/wire_ratchet.py) until they are modelled
UNMODELLED: frozenset[str] = frozenset()


class AccessControlProfilesProfilesAccess(ExactModel):
    can_edit: bool
    sensitive: bool


class AccessControlProfilesProfilesViewSync(ExactModel):
    state: str
    connected: bool
    last_error: Any
    reconnects: Num
    started_at: str | None
    fetched_at: str | None
    refreshes: Num
    sequence: Num
    wiskey_version: str | None


class AccessControlProfilesProfilesViewFeaturesView(ExactModel):
    available: bool | None
    reason: Any


class AccessControlProfilesProfilesViewFeaturesEdit(ExactModel):
    available: bool | None
    reason: str | None


class AccessControlProfilesProfilesViewFeatures(ExactModel):
    view: AccessControlProfilesProfilesViewFeaturesView
    edit: AccessControlProfilesProfilesViewFeaturesEdit
    versions: AccessControlProfilesProfilesViewFeaturesView
    compare: AccessControlProfilesProfilesViewFeaturesView
    suggestions: AccessControlProfilesProfilesViewFeaturesView


class AccessControlProfilesProfilesViewStation(ExactModel):
    id: str
    name: str
    online: bool
    lock_enabled: bool


class AccessControlProfilesProfilesViewPolicyGroup(ExactModel):
    id: str
    label: str
    enabled: bool
    station_ids: list[str] | None


class AccessControlProfilesProfilesViewPolicy(ExactModel):
    revision: Num
    photo_enabled: bool
    fields: list[dict[str, Any]]
    groups: list[AccessControlProfilesProfilesViewPolicyGroup]
    templates: Num


class AccessControlProfilesProfilesView(ExactModel):
    configured: bool
    sync: AccessControlProfilesProfilesViewSync
    features: AccessControlProfilesProfilesViewFeatures
    stations: list[AccessControlProfilesProfilesViewStation]
    policy: AccessControlProfilesProfilesViewPolicy | None
    fetched_at: str | None
    last_error: str | None
    state: str


class AccessControlProfilesProfilesPreviewImpactPeopleItem(ExactModel):
    user_id: str
    display_name: str
    employee_no: str | None
    before: list[str]
    after: list[str]
    changed: bool
    overrides: Num


class AccessControlProfilesProfilesPreviewImpactFieldChange(ExactModel):
    field_id: str
    label: str
    new: bool
    checked: Num
    applicable: Num
    inactive: Num
    newly_applicable: Num
    missing: Num
    invalid: Num
    previous_issues: Num
    duplicates: Num
    template_issues: Num
    required: bool
    unique: bool
    examples: list[Any]
    duplicate_examples: list[dict[str, Any]]
    examples_truncated: bool


class AccessControlProfilesProfilesPreviewImpact(ExactModel):
    people: list[AccessControlProfilesProfilesPreviewImpactPeopleItem]
    people_truncated: bool
    changed: Num
    stations: list[str]
    offline: list[Any]
    field_changes: list[AccessControlProfilesProfilesPreviewImpactFieldChange]
    can_apply: bool
    requires_confirmation: bool
    expires_in: Num
    device_writes: Num
    station_names: dict[str, str]


class AccessControlProfilesProfilesPreview(ExactModel):
    """On the READ connection: nothing is stored by a preview, and no write lock is held while WisKey computes the impact (its audit rows go through the audit's own short write)."""
    review_id: str
    base_revision: Num
    expires_at: str
    diff: list[dict[str, Any]]
    impact: AccessControlProfilesProfilesPreviewImpact
    values: dict[str, Any]


class AccessControlProfilesProfilesApplyReceipt(ExactModel):
    saved_at: str
    stations: list[str]
    changed: Num
    station_names: dict[str, str]


class AccessControlProfilesProfilesApplyReadback(ExactModel):
    state: str
    revision: Num
    matches: bool
    unchanged: bool
    last_error: Any


class AccessControlProfilesProfilesApply(ExactModel):
    status: str
    review_id: str
    command_id: str
    revision_before: Num
    receipt: AccessControlProfilesProfilesApplyReceipt
    readback: AccessControlProfilesProfilesApplyReadback
    sync: str
    physical_result: str
    repeated: bool = None


class AccessControlProfilesProfilesCheck(ExactModel):
    review_id: str
    verdict: str
    readback: AccessControlProfilesProfilesApplyReadback
    result: dict[str, Any] | None


class AccessControlProfilesProfilesVersionsVersionsRecord(ExactModel):
    revision: Num
    saved_at: str
    action: str
    origin: str
    field_changes: Num
    group_changes: Num


class AccessControlProfilesProfilesVersionsVersions(ExactModel):
    records: list[AccessControlProfilesProfilesVersionsVersionsRecord]
    total: Num
    offset: Num
    next_offset: Any
    previous_offset: Any
    current_revision: Num
    retained_from_revision: Num


class AccessControlProfilesProfilesVersions(ExactModel):
    fetched_at: str
    versions: AccessControlProfilesProfilesVersionsVersions


class AccessControlProfilesProfilesCompareCompareRow(ExactModel):
    kind: str
    id: str
    label: str
    state: str
    changes: list[dict[str, Any]]


class AccessControlProfilesProfilesCompareCompareSummary(ExactModel):
    fields: Num
    groups: Num


class AccessControlProfilesProfilesCompareCompare(ExactModel):
    before_revision: Num
    after_revision: Num
    rows: list[AccessControlProfilesProfilesCompareCompareRow]
    summary: AccessControlProfilesProfilesCompareCompareSummary


class AccessControlProfilesProfilesCompare(ExactModel):
    compare: AccessControlProfilesProfilesCompareCompare


class AccessControlProfilesProfilesRollbackDraftNote(ExactModel):
    code: str
    id: str


class AccessControlProfilesProfilesRollbackDraft(ExactModel):
    target_revision: Num
    base_revision: Num
    values: dict[str, Any]
    notes: list[AccessControlProfilesProfilesRollbackDraftNote]
    rows: Num


class AccessControlProfilesProfilesSuggestionsSuggestionsSuggestion(ExactModel):
    group_id: str
    label: str
    matching_members: Num
    matching_people: Num
    doors: list[dict[str, Any]]


class AccessControlProfilesProfilesSuggestionsSuggestions(ExactModel):
    user_id: str
    person_revision: Num
    policy_revision: Num
    fields: list[dict[str, Any]]
    selected_fields: list[str]
    suggestions: list[AccessControlProfilesProfilesSuggestionsSuggestionsSuggestion]
    can_apply_to_draft: bool


class AccessControlProfilesProfilesSuggestions(ExactModel):
    fetched_at: str
    suggestions: AccessControlProfilesProfilesSuggestionsSuggestions
    read_only: bool
    physical_result: str
