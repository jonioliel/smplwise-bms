"""Response models of the intrusion alarm API (routers/alarm.py, `/api/v1/alarm/...`; CR-010, docs/changes/CR-010-SECURITY-ALARM.md).
Panels, zones and bypass controls are the discovery views of services/alarm.py over the platform's mirror; a zone the caller may not view
on every panel that lists it is redacted (its state fields null, `redacted: true`). No answer carries a code or a PIN: the panel code is
reported as set / when / by whom only. Field order is the order the services build their dicts in."""
from __future__ import annotations

from typing import Any, Literal

from . import Num, WireModel

# every JSON route of the router is modelled
NO_JSON: frozenset[str] = frozenset()

Policy = Literal["no_code", "code_required"]
CodeMode = Literal["personal_pin", "panel_code"]
Prompt = Literal["none", "pin", "pin_missing", "panel", "unverifiable"]


class AlarmBypassControl(WireModel):
    """The zone's paired bypass control (a switch or a select) and its live state."""
    entity_id: str
    domain: str
    name: str
    state: str | None
    available: bool
    bypassed: bool | None
    strategy: str
    on_option: str | None
    off_option: str | None


class AlarmZone(WireModel):
    """One zone (services/alarm._zone_view). Redacted for this caller: the state fields are null, `state` is "unknown", `kind` "zone"."""
    entity_id: str
    name: str
    platform: str | None
    device_class: str | None
    kind: Literal["opening", "motion", "fault", "other", "zone"]
    state: str | None
    available: bool | None
    open: bool | None
    fault: bool | None
    tamper: bool | None
    battery_low: bool | None
    battery_level: Num | None
    alarmed: bool | None
    bypassed: bool | None
    last_changed: str | None
    area_id: str | None
    area_name: str | None
    ha_floor_name: str | None
    zone_number: int | None
    aux: list[str] | None
    shared: bool
    bypass: AlarmBypassControl | None
    panels: list[str]
    """Every panel that lists this zone (all partitions while it is shared)."""
    redacted: bool = None
    """Present (true) only for a zone redacted for this caller."""


class AlarmUnpairedControl(WireModel):
    entity_id: str
    domain: str
    name: str
    state: str | None
    bypassed: bool | None


class AlarmReadiness(WireModel):
    """What stands in the way of arming: open openings and faulty zones that are not bypassed (entity ids)."""
    ready: bool
    open: list[str]
    faults: list[str]


class AlarmPanelCan(WireModel):
    arm: bool
    disarm: bool
    bypass: bool
    restore: bool


class AlarmCodePrompts(WireModel):
    """Per action what the user must type."""
    arm: Prompt
    disarm: Prompt
    bypass: Prompt


class AlarmPanelCodeInfo(WireModel):
    """The panel's stored code: whether it is set, when and by whom - never the code. `readable` only in the configuration."""
    set: bool
    set_at: str | None
    set_by: str | None
    readable: bool | None = None


class AlarmPanel(WireModel):
    """One panel (services/alarm._panel_view + zones + unpaired controls + readiness). `can`, `panel_code_set` and `code` only in
    `GET /alarm/panels`; `panel_code` only in `GET /alarm/config`."""
    entity_id: str
    name: str
    platform: str | None
    integration: str
    integration_note: str
    config_entry_id: str | None
    device_id: str | None
    state: str | None
    available: bool
    fresh: bool
    last_changed: str | None
    changed_by: str | None
    arm_modes: list[str]
    features_reported: bool
    code_format: Literal["number", "text"] | None
    code_arm_required: bool
    needs_code_arm: bool
    needs_code_disarm: bool
    area_name: str | None
    open_sensors: list[str]
    bypassed_sensors: list[str]
    zones: list[AlarmZone]
    unpaired_controls: list[AlarmUnpairedControl]
    ready: AlarmReadiness
    can: AlarmPanelCan = None
    panel_code_set: bool = None
    code: AlarmCodePrompts = None
    panel_code: AlarmPanelCodeInfo = None


class AlarmCounts(WireModel):
    panels: int
    zones: int
    open: int
    bypassed: int
    faults: int


class AlarmRemote(WireModel):
    control: bool
    disarm: bool
    codeless: bool


class AlarmMeBrief(WireModel):
    arm_policy: Policy
    disarm_policy: Policy
    pin_set: bool


class AlarmPanels(WireModel):
    """`GET /alarm/panels`: the panels the caller may view, the summary, the remote-channel rules, the caller's code policy and the
    platform link's state (`sync`, services/ha_sync.SyncState)."""
    panels: list[AlarmPanel]
    counts: AlarmCounts
    channel: Literal["remote", "local"]
    remote: AlarmRemote
    code_mode: CodeMode
    me: AlarmMeBrief
    can_configure: bool
    sync: dict[str, Any]


class AlarmAction(WireModel):
    """A device-action record (services/ha_actions.as_dict: the `ha_actions` row, its arguments, how it can be confirmed). `note` only on
    the answer that sent the command (absent on a repeated request id)."""
    id: str
    entity_id: str
    action_id: str
    principal_user_id: str
    principal_username: str | None
    client_request_id: str
    status: str
    error: str | None
    requested_at: str
    responded_at: str | None
    confirmed_at: str | None
    expected_state: str | None
    observed_state: str | None
    via: str
    bulk_id: str | None
    context_id: str | None
    arguments: dict[str, Any]
    confirmation: str
    note: str | None = None


class AlarmMe(WireModel):
    arm_policy: Policy
    disarm_policy: Policy
    pin_set: bool
    pin_set_at: str | None
    code_mode: CodeMode


class AlarmPinSet(WireModel):
    pin_set: bool
    pin_set_at: str | None


class AlarmOverride(WireModel):
    """An administrator's pairing override (the `alarm_zone_overrides` row; `excluded` is the stored 0 / 1)."""
    zone_entity_id: str
    panel_entity_id: str | None
    bypass_entity_id: str | None
    excluded: int
    updated_at: str
    updated_by: str | None


class AlarmEntityBrief(WireModel):
    entity_id: str
    name: str
    platform: str | None
    domain: str


class AlarmCandidates(WireModel):
    controls: list[AlarmEntityBrief]
    sensors: list[AlarmEntityBrief]


class AlarmIntegration(WireModel):
    label: str
    note: str
    verified: bool


class AlarmSettings(WireModel):
    remote_control: bool
    remote_disarm: bool
    remote_codeless: bool
    code_mode: CodeMode
    pin_min_length: int


class AlarmConfig(WireModel):
    """`GET /alarm/config` (system.configure): every panel with its zones and stored-code facts, the platform entities excluded from
    the discovery, the overrides, the pairing candidates, the integration profiles, the held / released controls and the settings."""
    panels: list[AlarmPanel]
    excluded: list[str]
    overrides: list[AlarmOverride]
    candidates: AlarmCandidates
    integrations: dict[str, AlarmIntegration]
    fallback_controls: list[str]
    not_alarm: list[str]
    settings: AlarmSettings


class AlarmNotAlarm(WireModel):
    entity_id: str
    not_alarm: bool
    alarm_managed: bool


class AlarmRemoved(WireModel):
    removed: int


class AlarmPanelCode(WireModel):
    panel_code: AlarmPanelCodeInfo


class AlarmUserPolicy(WireModel):
    """A user's code policy and PIN facts (never the PIN). `code_mode` only on the read."""
    user_id: str
    arm_policy: Policy
    disarm_policy: Policy
    pin_set: bool
    pin_set_at: str | None
    pin_set_by: str | None
    code_mode: CodeMode = None
