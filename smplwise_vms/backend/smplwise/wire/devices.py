"""Response models of the electricity and device control API (routers/devices.py, `/api/v1/devices/...`; CR-007, CR-019, DEVHIST,
DEVTYPE, owner 2026-09-30 home / area redesign). Projected from the synced infrastructure catalogue; nothing here returns a host or a token.

A card row (services/devices.card_row) is one wide model: the fields every row carries, then the fields each card adds (lighting,
equipment, climate, covers, security, media, sensors) and the ones the area / items routes add - each key is absent where its card or
route does not set it. HA states and attribute texts pass through as reported. The home screen's widget configuration and data
(services/home_screen) and the sync state are documents other modules own and pass through (`dict[str, Any]`). Field order is the order
the router and services/devices build their dicts in."""
from __future__ import annotations

from typing import Any, Literal

from pydantic import Field

from . import Num, WireModel

# routes without a JSON body
NO_JSON: frozenset[str] = frozenset()


class DevicesSync(WireModel):
    """The infrastructure mirror's sync state (services/ha_sync.SyncState.as_dict)."""
    connected: bool
    last_snapshot_at: str | None
    last_event_at: str | None
    last_registry_at: str | None
    last_error: str | None
    reconnects: int
    sequence: int
    entities: int
    started_at: str | None
    ha_version: str | None
    last_registry_error: str | None
    last_structure_at: str | None
    registry_events: int
    auth_refusals: int
    next_attempt_at: str | None


class DeviceAreaMap(WireModel):
    """K88: the plan room linked to the area (services/plan_area_links.area_to_zone) - "הצג על המפה"."""
    floor_id: str
    zone_id: str


class DeviceCounts(WireModel):
    """The per-kind counts of a scope (services/devices.empty_counts)."""
    entities: int
    lights: int
    lights_on: int
    switches: int
    switches_on: int
    switch_entities: int
    switch_entities_on: int
    covers: int
    covers_open: int
    climate: int
    climate_active: int
    heating: int
    heating_active: int
    media: int
    media_on: int
    locks: int
    locks_locked: int
    alarm: str | None
    """The most armed panel state of the scope (null = no panel)."""
    cameras: int
    sensors: int


class DeviceClimateSummary(WireModel):
    """The "מזגני הקומה" strip: mode and target only."""
    entity_id: str
    name: str
    area_name: str | None
    hvac_mode: str | None
    hvac_action: str | None
    current_temperature: float | None
    target_temperature: float | None
    unit: str
    available: bool


class DeviceTreeArea(WireModel):
    area_id: str
    name: str
    icon: str | None
    floor_id: str | None
    counts: DeviceCounts
    has_camera: bool
    map: DeviceAreaMap | None
    climate: list[DeviceClimateSummary]
    temperature: float | None
    open_count: int
    can_bulk: bool = None
    """The tree only."""


class DeviceTreeFloor(WireModel):
    floor_id: str
    name: str
    level: int | None
    icon: str | None
    areas: list[DeviceTreeArea]
    counts: DeviceCounts
    climate: list[DeviceClimateSummary]
    can_bulk: bool = None


class DeviceUnassigned(WireModel):
    area_id: str
    name: str
    counts: DeviceCounts


class DevicesHome(WireModel):
    """The home screen block (services/home_screen.payload): the direction, the widget configuration as this caller sees it and the data
    behind it (documents of the home screen module)."""
    direction: str
    side: str
    time_zone: str | None
    personalize: bool
    config: dict[str, Any]
    data: dict[str, Any]


class DeviceTree(WireModel):
    floors: list[DeviceTreeFloor]
    unassigned: DeviceUnassigned
    building: DeviceCounts
    building_climate: list[DeviceClimateSummary]
    scoped: bool
    can_bulk: bool
    sync: DevicesSync
    home: DevicesHome


class DevicePower(WireModel):
    """An outlet's own power reading (a power sensor on the same device)."""
    entity_id: str
    value: Num | None
    unit: str


class DeviceRow(WireModel):
    """One card row (services/devices.card_row and the routes' additions)."""
    entity_id: str
    name: str
    domain: str
    device_class: str | None
    state: str | None
    available: bool
    fresh: bool
    active: bool
    icon: str | None
    last_changed: str | None
    activity: bool
    activity_kind: str | None
    activity_permissions: list[str] = None
    """A lock / alarm panel: the permissions that operate it (its activity is behind them)."""
    alarm_managed: bool = None
    can_control: bool
    # lighting
    brightness_pct: int | None = None
    color_mode: str | None = None
    dimmable: bool = None
    # equipment (vacuum, valve, water heater)
    battery_level: int | None = None
    fan_speed: str | None = None
    status: str | None = None
    position: int | None = None
    moving: bool = None
    current_temperature: float | None = None
    target_temperature: float | None = None
    unit: str | None = None
    # climate
    climate_kind: str = None
    hvac_mode: str | None = None
    hvac_action: str | None = None
    target_temp_low: float | None = None
    target_temp_high: float | None = None
    fan_mode: str | None = None
    preset_mode: str | None = None
    hvac_modes: list[str] | None = None
    fan_modes: list[str] | None = None
    min_temp: float | None = None
    max_temp: float | None = None
    target_temp_step: float | None = None
    preset_modes: list[str] | None = None
    swing_mode: str | None = None
    swing_modes: list[str] | None = None
    current_humidity: float | None = None
    target_humidity: float | None = None
    min_humidity: float | None = None
    max_humidity: float | None = None
    # fan / humidifier
    percentage: int | None = None
    mode: str | None = None
    available_modes: list[str] | None = None
    # covers
    tilt: int | None = None
    door_class: bool = None
    # security
    kind: str = None
    has_camera: bool = None
    still_url: str | None = None
    armed: bool = None
    locked: bool = None
    wiskey_door: bool = None
    # media
    media_title: str | None = None
    source: str | None = None
    volume_pct: int | None = None
    muted: bool | None = None
    # sensors
    value: float | None = None
    on: bool | None = None
    group: str = None
    # the area cards: an outlet's power sensor
    power: DevicePower | None = None
    # GET /devices/entities
    card: str = None
    area_id: str | None = None
    area_name: str | None = None
    # GET /devices/items
    floor_id: str | None = None
    floor_name: str | None = None
    # the area / items routes
    managed_label: str = None
    media_managed: bool = None
    bulk_excluded: str | None = None
    bulk_protected: bool = None
    bulk_reason: str = None
    unlock_reason: str = None
    can_unlock: bool = None


class DeviceRows(WireModel):
    entities: list[DeviceRow]


class DeviceCard(WireModel):
    id: str
    label: str
    entities: list[DeviceRow]
    count: int
    active: int


class DeviceAreaHeader(WireModel):
    area_id: str
    name: str
    icon: str | None
    floor_id: str | None
    floor_name: str | None
    level: int | None
    map: DeviceAreaMap | None = None
    """Absent for the "ללא שיוך" bucket."""


class DeviceAreaSibling(WireModel):
    area_id: str
    name: str
    icon: str | None
    counts: DeviceCounts


class DeviceArea(WireModel):
    """One area's cards (services/devices.build_area) with the route's flags."""
    area: DeviceAreaHeader
    floor_areas: list[DeviceAreaSibling]
    cards: dict[str, DeviceCard]
    counts: DeviceCounts
    scoped: bool
    can_bulk: bool
    can_mark_bulk_protected: bool = None
    """Only for a caller who may start a bulk action somewhere."""
    can_assign_area: bool
    sync: DevicesSync


class DeviceItemsArea(WireModel):
    area_id: str
    name: str
    items: list[DeviceRow]


class DeviceItemsFloor(WireModel):
    floor_id: str
    name: str
    level: int | None
    areas: list[DeviceItemsArea]


class DeviceItemsCounts(WireModel):
    total: int
    active: int
    inactive: int
    unavailable: int


class DeviceItems(WireModel):
    """Every entity of one kind in a scope, grouped by floor › area (services/devices.build_items) with the route's flags."""
    kind: str
    scope: Literal["building", "floor", "area"]
    id: str
    name: str
    floor_name: str | None
    counts: DeviceItemsCounts
    floors: list[DeviceItemsFloor]
    truncated: bool
    scoped: bool
    can_bulk: bool
    can_mark_bulk_protected: bool
    sync: DevicesSync
    building_id: str = None
    """BUILDING-SCOPE-CONTROL-2351: only with `?building=`."""


class DeviceBuilding(WireModel):
    counts: DeviceCounts
    floors: int
    areas: int
    unassigned: int
    scoped: bool
    sync: DevicesSync


class DeviceHomeEntity(WireModel):
    entity_id: str
    name: str
    state: str | None


class DeviceHomeSensor(WireModel):
    entity_id: str
    name: str
    state: str | None
    unit: str | None
    device_class: str | None
    suggested: bool
    """A Jewish-calendar sensor (listed first)."""
    binary: bool


class DeviceHomeCandidates(WireModel):
    """Edit mode of the home screen (services/home_screen.candidates): names and current states only. A weather entity carries what it
    can show (values, forecast, offers) and a calendar its next event, as the home screen module reads them (its documents)."""
    weather: list[dict[str, Any]]
    alarms: list[DeviceHomeEntity]
    sensors: list[DeviceHomeSensor]
    suggested_calendar: dict[str, str]
    """Per Jewish-calendar field the sensor the catalogue suggests ("" = none)."""
    calendars: list[dict[str, Any]]
    scenes: list[DeviceHomeEntity]
    scripts: list[DeviceHomeEntity]


class DeviceActivityActor(WireModel):
    type: str
    name: str = None


class DeviceActivitySource(WireModel):
    type: str
    id: str | None
    name: str | None


class DeviceActivityItem(WireModel):
    id: int
    at: str
    kind: str
    actor: DeviceActivityActor
    source: DeviceActivitySource | None
    from_: dict[str, Any] = Field(alias="from")
    to: dict[str, Any]
    changed: list[str]
    via: str | None
    confidence: str | None


class DeviceActivityGap(WireModel):
    from_: str = Field(alias="from")
    to: str | None
    reason: str | None


class DeviceActivityCoverage(WireModel):
    from_: str | None = Field(alias="from")
    gaps: list[DeviceActivityGap]


class DeviceActivityEntity(WireModel):
    entity_id: str
    name: str
    domain: str
    activity_kind: str | None
    virtual: bool
    power: DevicePower | None


class DeviceActivity(WireModel):
    """DEVHIST (CR-032): one device's activity, newest first (services/device_activity.list_activity) and the device."""
    tracked_since: str | None
    items: list[DeviceActivityItem]
    next_cursor: str | None
    retention_days: int
    coverage: DeviceActivityCoverage
    availability: Literal["ok", "partial", "unavailable"]
    entity: DeviceActivityEntity


class DevicePoolEntity(WireModel):
    entity_id: str
    name: str
    card: str
    domain: str
    group: str | None
    door: bool
    area_id: str | None
    area_name: str | None
    state: str | None


class DeviceEntityPool(WireModel):
    entities: list[DevicePoolEntity]
    truncated: bool


class DeviceRefresh(WireModel):
    """"רענן מ-Home Assistant": the registry refresh's outcome and the sync state."""
    changed: bool
    last_registry_at: str | None
    coalesced: bool = None
    sync: DevicesSync


class DeviceSwitchProtection(WireModel):
    """One switch in the review list of "מתגים מוגנים" (CR-019 section 7.3)."""
    entity_id: str
    name: str
    area_id: str | None
    area_name: str | None
    floor_id: str | None
    floor_name: str | None
    state: str | None
    available: bool
    platform: str | None
    protected: bool
    suggested: bool
    source: str | None
    category: str | None
    category_label: str | None
    rule: str | None
    reviewed: bool | None
    included: bool
    reason: str
    reason_label: str | None
    alarm_managed: bool
    doors_layer: bool
    media_managed: bool
    marked_by: str | None
    marked_at: str | None
    reviewed_by: str | None
    reviewed_at: str | None


class DeviceSwitchSummary(WireModel):
    switches: int
    protected: int
    suggested: int
    unprotected: int
    gone_protected: int


class DeviceCategory(WireModel):
    id: str
    label: str


class DeviceSwitchProtectionList(WireModel):
    switches: list[DeviceSwitchProtection]
    summary: DeviceSwitchSummary
    categories: list[DeviceCategory]
    note: str


class DeviceBatchResult(WireModel):
    entity_id: str
    ok: bool
    reason: str | None
    changed: bool


class DeviceBatch(WireModel):
    """A change of many devices in one call: per id `{entity_id, ok, reason, changed}`."""
    results: list[DeviceBatchResult]
    changed: int
    refused: int


class DeviceSwitchProtected(WireModel):
    entity_id: str
    bulk_protected: bool
    bulk_reason: str
    source: str | None
    reviewed: bool | None


class DeviceClimateKindRow(WireModel):
    entity_id: str
    name: str
    area_name: str | None
    state: str | None
    available: bool
    hvac_modes: list[str] | None
    kind: str
    auto: str
    set: str | None


class DeviceClimateKinds(WireModel):
    climate: list[DeviceClimateKindRow]


class DeviceClimateKind(WireModel):
    entity_id: str
    kind: str | None
    auto: str | None
    set: str | None


class DeviceTypeRow(WireModel):
    """One switch-wired device in the Settings list (services/device_types.listing)."""
    entity_id: str
    name: str
    domain: str
    device_class: str | None
    area_id: str | None
    area_name: str | None
    floor_id: str | None
    floor_name: str | None
    state: str | None
    available: bool
    kind: str
    auto: str
    set: str | None
    options: list[str]
    set_by: str | None
    set_at: str | None
    bulk_on_allowed: bool


class DeviceTypes(WireModel):
    devices: list[DeviceTypeRow]
    kinds: list[str]


class DeviceTypeSet(WireModel):
    entity_id: str
    changed: bool
    kind: str | None
    auto: str | None
    set: str | None


class DeviceBulkOn(WireModel):
    entity_id: str
    changed: bool
    bulk_on_allowed: bool
    kind: str


class DeviceAreaAssigned(WireModel):
    entity_id: str
    area_id: str
    area_name: str


class DeviceBulkTarget(WireModel):
    entity_id: str
    name: str
    domain: str
    action_id: str
    state: str | None
    area_id: str | None
    area_name: str | None
    args: dict[str, Any]


class DeviceBulkExcluded(WireModel):
    entity_id: str
    name: str
    domain: str
    reason: str
    reason_label: str


class DeviceBulkPreview(WireModel):
    """Exactly what `POST /devices/actions` would send (services/device_bulk.resolve)."""
    scope: Literal["building", "floor", "area"]
    id: str
    name: str
    floor_name: str | None
    kind: str
    kind_label: str
    count: int
    targets: list[DeviceBulkTarget]
    by_domain: dict[str, int]
    domain_labels: dict[str, str]
    skipped: dict[str, int]
    """`already`, `unavailable`, and when non-zero `not_confirmed` / `sensitive_type`."""
    excluded: list[DeviceBulkExcluded]
    never_included: dict[str, int]
    """Domains never in a bulk action (locks, the alarm, ...) -> how many the scope holds."""
    digest: str
    narrowed: bool
    building_id: str = None
    server_time_ms: int
    position: int | None
    note: str


class DeviceBulkRun(WireModel):
    """A bulk request with its per-entity outcomes (services/device_bulk.load). A media group operation reports per DEVICE
    (services/media_groups.member_outcomes), whose rows and counts are that module's."""
    id: str
    scope: str
    scope_id: str
    scope_name: str | None
    kind: str
    kind_label: str
    status: str
    requested_at: str
    not_after: str | None
    sent_at: str | None
    done_at: str | None
    principal_user_id: str
    principal_username: str | None
    origin: str | None
    done: bool
    all_confirmed: bool
    counts: dict[str, int]
    items: list[dict[str, Any]]
    note: str
