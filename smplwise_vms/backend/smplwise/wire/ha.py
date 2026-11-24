"""Response models of routers/ha.py (RESPONSE-MODELS-E-2480, code review 07:F8 step 2)."""
from __future__ import annotations

from typing import Any

from . import ExactModel, Num

# routes without a JSON body
NO_JSON: frozenset[str] = frozenset()
# JSON routes without a model yet: no test reaches a successful answer (or the answer is not one object); counted by the ratchet
# (scripts/wire_ratchet.py) until they are modelled
UNMODELLED: frozenset[str] = frozenset()


class HaStatusSync(ExactModel):
    connected: bool
    last_snapshot_at: str | None
    last_event_at: Any
    last_registry_at: str | None
    last_error: str | None
    reconnects: Num
    sequence: Num
    entities: Num
    started_at: str | None
    ha_version: str | None
    last_registry_error: str | None
    last_structure_at: str | None
    registry_events: Num
    auth_refusals: Num
    next_attempt_at: Any


class HaStatusBridge(ExactModel):
    paired: bool
    paired_at: str | None
    directory_users: Num
    last_directory_at: str | None


class HaStatusIntegrationWiskeyNative(ExactModel):
    state: str
    code: Any
    version: Any
    restart: Any


class HaStatusIntegration(ExactModel):
    source_version: str | None
    config_dir: str | None
    installed_version: str | None
    installed_at: str | None
    installed_now: bool
    last_run: str | None
    last_error: Any
    discovery_posted_at: str | None
    active_version: str | None
    up_to_date: bool
    state: str
    addon_url: str
    wiskey_native: HaStatusIntegrationWiskeyNative


class HaStatus(ExactModel):
    configured: bool
    sync: HaStatusSync
    bridge: HaStatusBridge
    integration: HaStatusIntegration
    can_configure: bool


class HaEntitiesEntity(ExactModel):
    entity_id: str
    registry_id: str | None
    unique_id: str | None
    platform: str | None
    device_id: str | None
    area_id: str | None
    area_name: str | None
    ha_floor_id: str | None
    ha_floor_name: str | None
    name: str
    original_name: str | None
    domain: str
    device_class: str | None
    unit: str | None
    icon: Any
    entity_category: str | None
    disabled: bool
    hidden: bool
    supported_features: Num
    state: str | None
    last_changed: str | None
    last_updated: str | None
    state_seen_at: str | None
    available: bool
    removed_at: Any
    first_seen_at: str
    updated_at: str
    config_entry_id: str | None
    short_name: str | None
    main_entity: bool
    attributes: dict[str, Any]
    fresh: bool
    placements: list[dict[str, str]]
    alarm_managed: bool
    schedule_entity: bool
    media_managed: bool
    actions: list[dict[str, Any]]


class HaEntitiesArea(ExactModel):
    area_id: str
    area_name: str


class HaEntitiesSync(ExactModel):
    connected: bool
    last_snapshot_at: str | None
    last_event_at: Any
    last_registry_at: str | None
    last_error: str | None
    reconnects: Num
    sequence: Num
    entities: Num
    started_at: str | None
    ha_version: str | None
    last_registry_error: str | None
    last_structure_at: str | None
    registry_events: Num
    auth_refusals: Num
    next_attempt_at: Any


class HaEntities(ExactModel):
    """The catalogue: everything for installation-wide readers, only placed entities on visible floors otherwise."""
    entities: list[HaEntitiesEntity]
    domains: dict[str, Any]
    areas: list[HaEntitiesArea]
    sync: HaEntitiesSync
    can_control: bool


class HaEntityPlacement(ExactModel):
    floor_id: str
    floor_name: str


class HaEntityRecentAction(ExactModel):
    id: str
    action_id: str
    status: str
    requested_at: str
    confirmed_at: str | None
    principal_username: str
    error: str | None


class HaEntity(ExactModel):
    entity_id: str
    registry_id: str | None
    unique_id: str | None
    platform: str | None
    device_id: str | None
    area_id: str | None
    area_name: str | None
    ha_floor_id: str | None
    ha_floor_name: str | None
    name: str
    original_name: str | None
    domain: str
    device_class: str | None
    unit: str | None
    icon: Any
    entity_category: str | None
    disabled: bool
    hidden: bool
    supported_features: Num
    state: str
    last_changed: str | None
    last_updated: str | None
    state_seen_at: str
    available: bool
    removed_at: str | None
    first_seen_at: str
    updated_at: str
    config_entry_id: str | None
    short_name: str | None
    main_entity: bool
    attributes: dict[str, Any]
    fresh: bool
    placements: list[HaEntityPlacement]
    can_control: bool
    alarm_managed: bool
    schedule_entity: bool
    media_managed: bool
    actions: list[dict[str, Any]]
    recent_actions: list[HaEntityRecentAction]
    unlock_reason: str = None
    wiskey_door: bool = None


class HaRunActionTimingMs(ExactModel):
    checks: Num
    pending_wait: Num
    pending_commit: Num
    pending_row: Num
    bridge: Num
    record: Num
    total: Num


class HaRunAction(ExactModel):
    """LAT1 (2026-10-08): every check runs on the request's READ connection (no SQLite write lock is taken before the command leaves), then the durable record - the pending ha_actions row and the `ha.action` attempt audit row - is committed in one"""
    id: str
    entity_id: str = None
    action_id: str = None
    principal_user_id: str = None
    principal_username: str = None
    client_request_id: str = None
    status: str
    error: str | None = None
    requested_at: str = None
    responded_at: str | None = None
    confirmed_at: str | None = None
    expected_state: str | None = None
    observed_state: Any = None
    via: str = None
    bulk_id: Any = None
    context_id: str | None = None
    arguments: dict[str, Any] = None
    confirmation: str = None
    note: str | None = None
    timing_ms: HaRunActionTimingMs = None


class HaAction(ExactModel):
    """Poll a pending action: confirmed when the entity reached the expected state after the request, unknown after 20 s."""
    id: str
    entity_id: str
    action_id: str
    principal_user_id: str
    principal_username: str
    client_request_id: str
    status: str
    error: str | None
    requested_at: str
    responded_at: str | None
    confirmed_at: str | None
    expected_state: str | None
    observed_state: str | None
    via: str
    bulk_id: Any
    context_id: str | None
    arguments: dict[str, Any]
    confirmation: str


class HaBridgeInstallNow(ExactModel):
    """Copy the integration into Home Assistant's config directory again and re-announce it (system.configure)."""
    source_version: str
    config_dir: str
    installed_version: str
    installed_at: str
    installed_now: bool
    last_run: str
    last_error: Any
    discovery_posted_at: Any
    active_version: Any
    up_to_date: bool
    state: str
    addon_url: str
    wiskey_native: HaStatusIntegrationWiskeyNative


class HaPairing(ExactModel):
    pairing_code: str | None
    key_set: bool
    addon_host: str
    addon_url: str
    paired_at: str | None
    announced: bool
    announce_path: bool
    revoked: bool = None


class HaBridgePing(ExactModel):
    """Called by the integration during its config flow: proves the pairing code and marks the bridge paired."""
    ok: bool
    paired_at: str


class HaBridgeDirectoryCast(ExactModel):
    purpose: str
    cast_origin: str | None
    ts: Num
    nonce: str
    sig: str
    kid: str = None


class HaBridgeDirectoryKeyStatusLastRotation(ExactModel):
    rotation_id: str
    mode: str
    state: str
    gen_from: Num
    gen_to: Num
    verified_old_rejected: bool
    anchor_eligible: bool
    completed_at: str


class HaBridgeDirectoryKeyStatus(ExactModel):
    purpose: str
    protocol: str
    key_generation: Num
    rotation_active: bool
    last_rotation: HaBridgeDirectoryKeyStatusLastRotation | None
    anchor_decrease_available: bool
    ts: Num
    nonce: str
    sig: str
    kid: str = None


class HaBridgeDirectory(ExactModel):
    """Signed user directory push from the integration (id, name, username, active, admin, groups)."""
    ok: bool
    users: Num
    cast: HaBridgeDirectoryCast
    key_status: HaBridgeDirectoryKeyStatus


class HaDevStatesEntity(ExactModel):
    entity_id: str
    registry_id: str | None
    unique_id: str | None
    platform: str | None
    device_id: str | None
    area_id: str | None
    area_name: str | None
    ha_floor_id: str | None
    ha_floor_name: str | None
    name: str
    original_name: Any
    domain: str
    device_class: str | None
    unit: str | None
    icon: Any
    entity_category: Any
    disabled: bool
    hidden: bool
    supported_features: Num
    state: str
    last_changed: str
    last_updated: str
    state_seen_at: str
    available: bool
    removed_at: Any
    first_seen_at: str
    updated_at: str
    config_entry_id: Any
    short_name: str | None
    main_entity: bool
    attributes: dict[str, Any]
    fresh: bool


class HaDevStates(ExactModel):
    """Inject entity states as if Home Assistant sent them (the same upsert and the same push the sync uses), for live specs and manual checks without a Home Assistant."""
    entities: list[HaDevStatesEntity]


class HaDevRegistry(ExactModel):
    """Inject entity / device / area / floor registries as if Home Assistant sent them (the same mapping and the same writes the sync's registry refresh uses), for the CR-007 devices specs without a Home Assistant."""
    entities: Num
    areas: Num
    floors: Num
    changed: bool
