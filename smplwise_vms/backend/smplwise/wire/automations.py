"""Response models of routers/automations.py (RESPONSE-MODELS-E-2480, code review 07:F8 step 2)."""
from __future__ import annotations

from typing import Any

from pydantic import Field

from . import ExactModel, Num

# routes without a JSON body
NO_JSON: frozenset[str] = frozenset()
# JSON routes without a model yet: no test reaches a successful answer (or the answer is not one object); counted by the ratchet
# (scripts/wire_ratchet.py) until they are modelled
UNMODELLED: frozenset[str] = frozenset({'GET /automations/compat', 'POST /automations/automation/{item_id}/disable', 'POST /automations/automation/{item_id}/enable', 'POST /automations/automation/{item_id}/run', 'POST /automations/scene/{item_id}/apply', 'POST /automations/script/{item_id}/run', 'POST /automations/script/{item_id}/stop', 'POST /automations/trash/{trash_id}/restore', 'POST /automations/{kind}', 'POST /automations/{kind}/{item_id}/copy', 'POST /automations/{kind}/{item_id}/delete', 'POST /automations/{kind}/{item_id}/versions/{version_id}/restore', 'PUT /automations/{kind}/{item_id}', 'PUT /automations/{kind}/{item_id}/code'})


class AutomationsAutomationsStatusScopeFloor(ExactModel):
    id: str
    name: str


class AutomationsAutomationsStatusScope(ExactModel):
    installation: bool
    scoped: bool
    floors: list[AutomationsAutomationsStatusScopeFloor]
    areas: list[Any]


class AutomationsAutomationsStatusCan(ExactModel):
    view: bool
    scene_run: bool
    manage: bool
    scene_manage: bool
    script_run: bool
    script_manage: bool
    code_view: bool
    configure: bool


class AutomationsAutomationsStatusDelegation(ExactModel):
    on: bool
    needed: bool


class AutomationsAutomationsStatusUiExtWallTiming(ExactModel):
    double_ms: Num
    long_ms: Num
    debounce_ms: Num
    listen_s: Num


class AutomationsAutomationsStatusUiExt(ExactModel):
    wall_buttons: bool
    wall_timing: AutomationsAutomationsStatusUiExtWallTiming
    precheck: bool
    conflict_window_min: Num
    save_with_warnings: bool
    button_reuse: str
    device_test: bool
    device_test_end: str
    presence: bool
    bridge_required: str


class AutomationsAutomationsStatusUi(ExactModel):
    sensitive_warning: bool
    ask_when_on_new: bool
    templates_enabled: bool
    phone_filter: str
    sensitive_chip: str
    ext: AutomationsAutomationsStatusUiExt


class AutomationsAutomationsStatusAdmin(ExactModel):
    ha_version: str
    bridge_version: str
    bridge_required: str
    delegation_changed_at: str
    caller_is_ha_admin: bool
    config_api: str
    authoring_block_reason: str | None


class AutomationsAutomationsStatus(ExactModel):
    """§3.1 row 1 - never 403: a caller who may see nothing of the area gets `can.view = false` and zero counts; one who only runs scripts / activates scenes gets those counts and capabilities alone (no automation count, no name)."""
    scope: AutomationsAutomationsStatusScope
    available: str
    stale: bool
    last_sync_at: str | None
    writable: bool
    write_block: str | None
    scheduler_present: bool
    can: AutomationsAutomationsStatusCan
    delegation: AutomationsAutomationsStatusDelegation
    ui: AutomationsAutomationsStatusUi
    counts: dict[str, Any]
    admin: AutomationsAutomationsStatusAdmin = None


class AutomationsCatalogEntity(ExactModel):
    entity_id: str
    name: str
    domain: str
    floor: AutomationsAutomationsStatusScopeFloor | None
    area: AutomationsAutomationsStatusScopeFloor | None
    class_: str | None = Field(alias='class')
    device_class: str | None
    state: str
    missing: bool
    triggers: list[str]
    actions: list[str]


class AutomationsCatalogNotifyTarget(ExactModel):
    action: str
    name: str


class AutomationsCatalogScene(ExactModel):
    entity_id: str
    name: str
    area: Any
    integration: bool


class AutomationsCatalogScript(ExactModel):
    entity_id: str
    name: str
    fields_: list[dict[str, Any]] = Field(alias='fields')


class AutomationsCatalogArea(ExactModel):
    id: str
    name: str
    floor: str


class AutomationsCatalog(ExactModel):
    """§3.1 row 4 - the editor's pickers: the pickable entities of the caller's reach, the closed service table with argument specs, notify targets, scenes, scripts."""
    scope: AutomationsAutomationsStatusScope
    entities: list[AutomationsCatalogEntity]
    actions: dict[str, Any]
    notify_targets: list[AutomationsCatalogNotifyTarget]
    scenes: list[AutomationsCatalogScene]
    scripts: list[AutomationsCatalogScript]
    floors: list[AutomationsAutomationsStatusScopeFloor]
    areas: list[AutomationsCatalogArea]
    shabbat_sensor: str
    allowed_actions: list[str]
    extension: AutomationsAutomationsStatusUiExt


class AutomationsTemplatesTemplate(ExactModel):
    id: str
    name: str
    icon: str
    description: str
    target: str
    draft: dict[str, Any]
    suggest_schedule: bool
    sensitive: bool


class AutomationsTemplates(ExactModel):
    """§3.1 row 5 - the gallery (manage)."""
    templates: list[AutomationsTemplatesTemplate]


class AutomationsTrashItem(ExactModel):
    trash_id: str
    kind: str
    config_id: str
    name: str
    sentence: str
    deleted_at: str
    expires_at: str
    deleted_by: str
    sensitive: bool
    entities: list[str]
    can_restore: bool


class AutomationsTrash(ExactModel):
    """§3.1 row 20 - the trash the caller may see (30 days, setting `automations.trash_days`)."""
    items: list[AutomationsTrashItem]


class AutomationsPurgeTrash(ExactModel):
    ok: bool


class AutomationsReviewItem(ExactModel):
    kind: str
    id: str
    name: str
    at: str | None
    issue: str
    detail: str


class AutomationsReview(ExactModel):
    """§3.1 row 22 - the administrator's review list (installation-wide automation.manage)."""
    items: list[AutomationsReviewItem]


class AutomationsPreviewError(ExactModel):
    path: str
    code: str
    message: str


class AutomationsPreviewEffectsEntity(ExactModel):
    entity_id: str
    name: str
    floor: str | None
    area: str | None
    from_: str | None = Field(alias='from')
    to: str | None


class AutomationsPreviewEffects(ExactModel):
    entities: list[AutomationsPreviewEffectsEntity]
    unknown: bool


class AutomationsPreviewSensitiveStep(ExactModel):
    path: str
    entity_id: str
    action: str
    grant: str
    granted: bool
    class_: str = Field(alias='class')
    label: str
    name: str


class AutomationsPreviewRequires(ExactModel):
    confirm: bool
    code_view: bool
    ha_admin: bool


class AutomationsPreviewSuggestScheduleScheduleDraft(ExactModel):
    name: str
    weekdays: list[str]
    start_date: Any
    end_date: Any
    repeat: str
    tags: list[Any]
    conditions: dict[str, Any]
    slots: list[dict[str, Any]]


class AutomationsPreviewSuggestSchedule(ExactModel):
    schedule_draft: AutomationsPreviewSuggestScheduleScheduleDraft


class AutomationsPreviewExtensionCritical(ExactModel):
    allowed: bool
    sources: list[Any]


class AutomationsPreviewExtension(ExactModel):
    critical: AutomationsPreviewExtensionCritical


class AutomationsPreview(ExactModel):
    """§3.1 row 6 - always 200 for a well-formed body; problems are data."""
    valid: bool
    errors: list[AutomationsPreviewError]
    warnings: list[AutomationsPreviewError]
    ha_validation: str
    sentence: str
    block_sentences: dict[str, str]
    effects: AutomationsPreviewEffects
    sensitive: bool
    sensitive_steps: list[AutomationsPreviewSensitiveStep]
    requires: AutomationsPreviewRequires
    suggest_schedule: AutomationsPreviewSuggestSchedule | None
    extension: AutomationsPreviewExtension = None


class AutomationsCaptureSceneMember(ExactModel):
    entity_id: str
    state: str
    attributes: dict[str, Any]


class AutomationsCaptureSceneSkippedItem(ExactModel):
    entity_id: str
    reason: str


class AutomationsCaptureScene(ExactModel):
    """§3.1 row 16 - the members of the selected entities as their states are now (no write): scene.manage + control of each, the lock grants for a lock."""
    members: list[AutomationsCaptureSceneMember]
    skipped: list[AutomationsCaptureSceneSkippedItem]


class AutomationsItemsItemLastRun(ExactModel):
    at: str
    result: str


class AutomationsItemsItemOwner(ExactModel):
    display_name: str


class AutomationsItemsItemCan(ExactModel):
    edit: bool
    code_view: bool
    toggle: bool
    run: bool
    delete: bool
    copy_: bool = Field(alias='copy')


class AutomationsItemsItemReadOnly(ExactModel):
    reasons: list[dict[str, str]]


class AutomationsItemsItem(ExactModel):
    kind: str
    id: str
    config_id: str | None
    entity_id: str
    name: str
    description: str
    icon: str | None
    source: str
    state: str
    sentence: str
    floors: list[dict[str, str]]
    areas: list[dict[str, str]]
    targets: list[dict[str, Any]]
    sensitive: bool
    sensitive_classes: list[str]
    locked_count: Num
    unknown_effects: bool
    mode: str | None
    extras: list[str]
    labels: list[Any]
    category: Any
    last_run: AutomationsItemsItemLastRun | None
    runs_7d: Num | None
    created_via: str
    owner: AutomationsItemsItemOwner | None
    updated_at: str
    revision: str | None
    pinned: bool
    favourite: bool
    hidden: bool
    can: AutomationsItemsItemCan
    read_only: AutomationsItemsItemReadOnly | None
    warnings: list[dict[str, str]]


class AutomationsItemsStatus(ExactModel):
    available: str
    stale: bool
    last_sync_at: str


class AutomationsItems(ExactModel):
    """§3.1 row 2 - visibility is applied before filters, totals and pagination."""
    items: list[AutomationsItemsItem]
    total: Num
    offset: Num
    limit: Num
    status: AutomationsItemsStatus


class AutomationsItemTarget(ExactModel):
    entity_id: str
    name: str
    floor: str | None
    area: str | None
    class_: str = Field(alias='class')
    sensitive: bool
    missing: bool


class AutomationsItemReadOnlyReason(ExactModel):
    code: str
    message: str
    entity_id: str = None
    grant: str = None


class AutomationsItemReadOnly(ExactModel):
    reasons: list[AutomationsItemReadOnlyReason]


class AutomationsItemWarning(ExactModel):
    code: str
    message: str


class AutomationsItem(ExactModel):
    """§3.1 row 3 - the `ItemDetail`."""
    kind: str
    id: str
    config_id: str
    entity_id: str
    name: str
    description: str
    icon: str | None
    source: str
    state: str
    sentence: str
    floors: list[AutomationsAutomationsStatusScopeFloor]
    areas: list[AutomationsAutomationsStatusScopeFloor]
    targets: list[AutomationsItemTarget]
    sensitive: bool
    sensitive_classes: list[str]
    locked_count: Num
    unknown_effects: bool
    mode: str | None
    extras: list[str]
    labels: list[Any]
    category: Any
    last_run: AutomationsItemsItemLastRun | None
    runs_7d: Num | None
    created_via: str
    owner: AutomationsItemsItemOwner | None
    updated_at: str
    revision: str
    pinned: bool
    favourite: bool
    hidden: bool
    can: AutomationsItemsItemCan
    read_only: AutomationsItemReadOnly | None
    warnings: list[AutomationsItemWarning]
    draft: dict[str, Any]
    versions: Num
    trash_restore_of: Any
    config: dict[str, Any] | None
    config_masked: bool
    suggest_schedule: AutomationsPreviewSuggestSchedule | None = None


class AutomationsPutMetaTarget(ExactModel):
    entity_id: str
    name: str
    floor: str
    area: str
    class_: str = Field(alias='class')
    sensitive: bool
    missing: bool


class AutomationsPutMetaReadOnly(ExactModel):
    reasons: list[AutomationsItemWarning]


class AutomationsPutMeta(ExactModel):
    """§3.1 row 21 - the caller's own pin / favourite; `hidden` (integration scenes) by an administrator."""
    kind: str
    id: str
    config_id: str | None
    entity_id: str
    name: str
    description: str
    icon: Any
    source: str
    state: str
    sentence: str
    floors: list[AutomationsAutomationsStatusScopeFloor]
    areas: list[AutomationsAutomationsStatusScopeFloor]
    targets: list[AutomationsPutMetaTarget]
    sensitive: bool
    sensitive_classes: list[Any]
    locked_count: Num
    unknown_effects: bool
    mode: str | None
    extras: list[Any]
    labels: list[Any]
    category: Any
    last_run: Any
    runs_7d: Num | None
    created_via: str
    owner: Any
    updated_at: str
    revision: str | None
    pinned: bool
    favourite: bool
    hidden: bool
    can: AutomationsItemsItemCan
    read_only: AutomationsPutMetaReadOnly | None
    warnings: list[Any]


class AutomationsDryRunEffectsEntity(ExactModel):
    entity_id: str
    name: str
    floor: str
    area: str
    from_: str = Field(alias='from')
    to: str | None


class AutomationsDryRunEffects(ExactModel):
    entities: list[AutomationsDryRunEffectsEntity]
    unknown: bool


class AutomationsDryRun(ExactModel):
    """§3.1 row 17 - no execution: the current truth of each typed condition from the mirror and the device diff."""
    conditions: list[dict[str, Any]]
    effects: AutomationsDryRunEffects


class AutomationsRunsItem(ExactModel):
    run_id: str
    at: str
    finished_at: str
    result: str
    sentence: str


class AutomationsRuns(ExactModel):
    """§3.1 row 18 - `RunSummary[]` from the stored traces."""
    items: list[AutomationsRunsItem]


class AutomationsRunStepChangedVariables(ExactModel):
    api_key: str
    level: Num


class AutomationsRunStep(ExactModel):
    path: str
    depth: Num
    sentence: str
    result: str
    started_at: str | None
    duration_ms: Num | None
    error: str | None
    changed_variables: AutomationsRunStepChangedVariables | None


class AutomationsRun(ExactModel):
    """§3.1 row 18 - one `RunTrace`, complete (owner decision 9ג)."""
    run_id: str
    at: str
    finished_at: str
    duration_ms: Num
    result: str
    sentence: str
    trigger: dict[str, str]
    conditions: list[dict[str, Any]]
    steps: list[AutomationsRunStep]
    variables: dict[str, Any]
    context: dict[str, Any]


class AutomationsVersionsItem(ExactModel):
    version_id: str
    revision: str
    at: str
    via: str
    actor: str | None
    summary: str
    current: bool
    masked: bool


class AutomationsVersions(ExactModel):
    """§3.1 row 19 - the history (last `automations.versions_keep`)."""
    items: list[AutomationsVersionsItem]
