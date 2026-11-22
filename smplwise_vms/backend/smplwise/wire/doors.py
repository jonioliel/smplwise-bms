"""Response models of the WisKey door administration API (routers/doors.py, CR-033): the door map and station placement, the
door-opening grant card, the trusted-path / editor-block / conversion flags, the door-path inventory and its "disable and list"
conversion, the signed open's status read and the blocks screen. Settings screens only; names on screen, ids as keys. Field
order is the order the router and its services (services/door_path.py, door_conversion.py, door_blocks.py) build their dicts in."""
from __future__ import annotations

from typing import Literal

from . import WireModel

# routes without a JSON body: none (the mapping delete answers {removed})
NO_JSON: frozenset[str] = frozenset()


# ---------------------------------------------------------------- door map + station placement

class DoorMapRelay(WireModel):
    physical_index: int
    name: str | None


class DoorPlacement(WireModel):
    site_id: str | None
    building_id: str | None


class DoorMapStation(WireModel):
    id: str
    name: str
    online: bool
    relays: list[DoorMapRelay]
    """Only for a station whose lock is enabled in the WisKey copy."""
    placement: DoorPlacement | None


class DoorMapLockMapping(WireModel):
    station_id: str
    station_name: str | None
    relay: int
    source: Literal["wiskey_explicit", "single_relay", "manual"]
    mapped_at: str
    valid: bool
    problem: str | None


class DoorMapSuggestion(WireModel):
    station_id: str
    relay: int


class DoorMapLock(WireModel):
    entity_id: str
    name: str
    removed: bool
    disabled: bool
    station_id: str | None
    mapping: DoorMapLockMapping | None
    suggestion: DoorMapSuggestion | None


class DoorMapSite(WireModel):
    id: str
    name: str


class DoorMapBuilding(WireModel):
    id: str
    site_id: str
    name: str


class DoorMap(WireModel):
    state: str
    """The WisKey copy's sync state (services/intercom_sync)."""
    has_copy: bool
    stations: list[DoorMapStation]
    locks: list[DoorMapLock]
    sites: list[DoorMapSite]
    buildings: list[DoorMapBuilding]


class DoorMapRow(WireModel):
    """The stored map row (table intercom_door_map) as written."""
    entity_id: str
    config_entry_id: str
    physical_index: int
    source: Literal["wiskey_explicit", "single_relay", "manual"]
    mapped_by: str | None
    mapped_at: str
    revision: int


class DoorMappingSet(WireModel):
    mapping: DoorMapRow


class DoorMappingCleared(WireModel):
    removed: bool


class DoorSuggestionsApplied(WireModel):
    applied: list[str]
    """The lock entity ids now mapped by their `single_relay` suggestion."""


class DoorStationPlaced(WireModel):
    placement: DoorPlacement | None
    scope_name: str


# ---------------------------------------------------------------- door opening grants

class DoorGrantOther(WireModel):
    binding_id: str
    role_name: str
    scope_name: str


class DoorGrantSubject(WireModel):
    kind: Literal["user", "group"]
    id: str
    name: str
    active: bool
    granted: bool
    other: list[DoorGrantOther]


class DoorGrantRole(WireModel):
    """A built-in role carries `answer`; a custom role `delegable` and `revision`."""
    id: str
    name: str
    custom: bool
    includes: bool
    editable: bool
    answer: Literal["yes", "per_user", "never"] = "never"
    delegable: bool = False
    revision: int = 0


class DoorUnmappedSummary(WireModel):
    count: int
    with_suggestion: int


class DoorGrants(WireModel):
    users: list[DoorGrantSubject]
    groups: list[DoorGrantSubject]
    roles: list[DoorGrantRole]
    """Empty unless the caller may manage roles."""
    can_manage_roles: bool
    can_manage_subjects: bool
    delegated: bool
    unmapped_doors: DoorUnmappedSummary


class DoorSubjectSwitched(WireModel):
    """On: the card's binding (`binding_id`, the permission `revision`). Off: the bindings revoked (`revoked`; `revision` null when
    there was none)."""
    granted: bool
    binding_id: str = ""
    revoked: list[str] = []
    revision: int | None


class DoorRoleSwitched(WireModel):
    id: str
    includes: bool
    revision: int
    permission_revision: int = 0
    """Only when the role changed."""


# ---------------------------------------------------------------- flags and the status read

class DoorLockJob(WireModel):
    schedule_id: str
    name: str
    locks: list[str]
    note: str


class DoorSettings(WireModel):
    trusted_path: Literal["off", "on"]
    trusted_path_available: bool
    editor_block: Literal["blocked", "allowed"]
    editor_allowed_available: bool
    lock_jobs: list[DoorLockJob]
    conversion: Literal["off", "on"]


class DoorOpenStatus(WireModel):
    door_request_id: str
    outcome: str
    code: str | None
    text: str


# ---------------------------------------------------------------- the door-path inventory

class DoorPathLastRun(WireModel):
    at: str
    result: str | None


class DoorPathItem(WireModel):
    kind: str
    kind_text: str
    key: str
    name: str
    origin: str
    origin_text: str
    state: str
    autonomous: bool
    author: str | None
    created_by: str | None
    approver: str | None
    approved_at: str | None
    approver_status: str
    approver_text: str
    last_run: DoorPathLastRun | None
    door_steps: int
    lock_steps: int
    doors: list[str]
    resolvable: bool
    unresolved: list[str]
    run_guard: str
    run_guard_text: str
    suggestion: str
    suggestion_text: str
    disable_required: bool
    revision: str | None


class DoorPathCounts(WireModel):
    items: int
    door_steps: int
    unresolvable: int
    arx_authored: int
    external: int
    disable_required: int


class DoorPathInventory(WireModel):
    wiskey_present: bool
    generated_at: str
    counts: DoorPathCounts
    items: list[DoorPathItem]


# ---------------------------------------------------------------- disable and list

class DoorConversionPeriod(WireModel):
    start: str
    end: str


class DoorConversionProgram(WireModel):
    name: str
    days: list[int]
    days_text: str
    periods: list[DoorConversionPeriod]
    doors: list[str]


class DoorConversionOffer(WireModel):
    """`doors` / `removed_steps` with an offered `convert_event_job`, `program` with an offered `hand_over_program`."""
    available: bool
    reason: str | None
    reason_text: str
    doors: list[str] = []
    removed_steps: int = 0
    program: DoorConversionProgram = None


class DoorConversionRecord(WireModel):
    id: str
    item_key: str
    kind: str
    name: str
    action: Literal["disabled", "converted", "handed_over"]
    state: Literal["done", "undone"]
    door_job_id: str | None
    program_rule_id: str | None
    doors: int
    done_by: str
    done_at: str
    undone_by: str | None
    undone_at: str | None


class DoorConversionItem(WireModel):
    key: str
    kind: str
    name: str
    category: str
    category_text: str
    origin: str
    origin_text: str
    state: str
    autonomous: bool
    revision: str | None
    door_steps: int
    doors: list[str]
    resolvable: bool
    unresolved: list[str]
    disable_required: bool
    approver_text: str
    run_guard_text: str
    actions: dict[str, DoorConversionOffer]
    offered: list[str]
    record: DoorConversionRecord | None


class DoorConversionCounts(WireModel):
    items: int
    disable: int
    convert_event_job: int
    hand_over_program: int
    list_only: int
    disable_required: int
    handled: int


class DoorConversionList(WireModel):
    switch: Literal["off", "on"]
    state: Literal["no_wiskey", "nothing_found", "items"]
    state_text: str
    wiskey_present: bool
    generated_at: str
    counts: DoorConversionCounts
    items: list[DoorConversionItem]
    records: list[DoorConversionRecord]


class DoorConversionDone(WireModel):
    record: DoorConversionRecord
    changed: bool


class DoorConversionUndone(WireModel):
    record: DoorConversionRecord
    re_enabled: bool
    ha_steps_restored: bool | None


# ---------------------------------------------------------------- the blocks screen

class DoorBlockOverride(WireModel):
    note: str
    by: str
    at: str


class DoorBlockEntity(WireModel):
    entity_id: str
    name: str
    domain: str
    platform: str | None
    area: str | None
    state: Literal["door", "unblocked", "blocked"]
    overridable: bool
    stale: bool
    override: DoorBlockOverride | None
    used_by: list[str]
    used_more: int


class DoorBlockDevice(WireModel):
    name: str
    state: Literal["unblocked", "blocked"]


class DoorBlockItem(WireModel):
    key: str
    kind: str
    kind_text: str
    name: str
    state: str
    blocked: bool
    opens_door: bool
    guard: str
    why: str | None
    reasons: list[str]
    devices: list[DoorBlockDevice]
    devices_more: int


class DoorBlockCounts(WireModel):
    entities: int
    blocked: int
    unblocked: int
    items: int
    items_blocked: int


class DoorBlocks(WireModel):
    wiskey_present: bool
    generated_at: str
    entities: list[DoorBlockEntity]
    items: list[DoorBlockItem]
    counts: DoorBlockCounts
    truncated: bool


class DoorEntityBlock(WireModel):
    entity_id: str
    state: Literal["unblocked", "blocked"]
    override: DoorBlockOverride | None
    changed: bool
