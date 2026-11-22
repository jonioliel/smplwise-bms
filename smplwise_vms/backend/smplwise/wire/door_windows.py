"""Response models of the door windows and emergency door controls API (routers/door_windows.py, CR-039 / DOORWIN-295,
`/api/v1/doors/windows...` and `/api/v1/doors/emergency...`). The server is the only authority; these answers are what the
`#/wiskey/door-windows` screen and the emergency strip shape themselves from. A trigger token is answered ONCE (rule save / token
renewal) and never stored in the clear. Field order is the order the router and its services (services/door_windows.py,
door_window_triggers.py, door_emergency.py, door_emergency_grants.py, special_days.py) build their dicts in."""
from __future__ import annotations

from typing import Literal

from pydantic import Field

from . import WireModel

# routes without a JSON body: none
NO_JSON: frozenset[str] = frozenset()

DwTier = Literal["program", "prepared"]


# ================================================================ door windows

class DwProgram(WireModel):
    """A door's program write state (services/door_windows.program_view): only `state` / `drift_kind` are enumerations."""
    state: str
    message: str
    version: int
    verified_at: str | None
    drift_kind: str | None
    drift_at: str | None
    attempts: int
    next_attempt_at: str | None
    revision: int | None


class DwRuleDoor(WireModel):
    station_id: str
    relay: int
    key: str
    label: str
    visible: bool


class DwPeriod(WireModel):
    weekday: int | None
    on_date: str | None
    start: str
    end: str


class DwTrigger(WireModel):
    """An `event` rule's trigger: never the token, only whether one exists and when it was made."""
    source: Literal["ha_event", "arx_automation"]
    duration_s: int
    automation_id: str | None
    allowed_from: str | None
    allowed_to: str | None
    max_per_day: int
    cooldown_s: int
    arm_state: Literal["simulate", "armed"]
    has_token: bool
    token_set_at: str | None
    can_arm: bool


class DwRule(WireModel):
    """A rule as this reader may see it: doors outside the reader's visible set are only counted (`hidden_doors`). `trigger` and
    `snippet` only on an `event` rule; `manageable` only in the screen state."""
    id: str
    name: str
    kind: Literal["weekly", "once", "event"]
    state: Literal["draft", "enabled", "paused", "retired"]
    calendar_policy: Literal["skip_holidays", "holidays_like_friday", "ignore_calendar"]
    notes: str
    revision: int
    updated_at: str | None
    approved: bool
    doors: list[DwRuleDoor]
    hidden_doors: int
    periods: list[DwPeriod]
    trigger: DwTrigger | None = None
    snippet: str = ""
    """The Home Assistant action text with a `<TOKEN>` placeholder."""
    manageable: bool = False


class DwOccurrence(WireModel):
    id: str
    door: str
    label: str
    rule_id: str | None
    rule_name: str
    start_at: str
    end_at: str
    zone: str
    state: str
    tier: DwTier
    retries: int
    unconfirmed_at: str | None
    last_reason: str | None
    resolution: str | None
    resolved_at: str | None


class DwCan(WireModel):
    manage: bool
    cancel: bool
    configure: bool


class DwForeignPaused(WireModel):
    """A door whose own (foreign) program an emergency LOCK paused and nobody re-activated yet."""
    door: str
    station_id: str
    relay: int
    incident_id: str | None
    paused_at: str | None
    label: str


class DwTriggerLog(WireModel):
    at: str
    source: str
    door: str
    decision: str
    reason: str | None
    end_at: str | None


class DwDoor(WireModel):
    key: str
    station_id: str
    relay: int
    label: str
    station_name: str
    name: str
    zone: str
    manage: bool
    cancel: bool
    exterior: bool
    program: DwProgram


class DwState(WireModel):
    """GET /doors/windows/state: everything the door-windows screen shows to this person."""
    enabled: bool
    tier: DwTier
    go_live_permitted: bool
    settings: dict[str, str]
    """The door-window settings by their short name (`max_hours`, `quiet_from`, ...), values as stored text."""
    can: DwCan
    automation_actor: bool
    foreign_paused: list[DwForeignPaused]
    triggers: list[DwTriggerLog]
    doors: list[DwDoor]
    rules: list[DwRule]
    occurrences: list[DwOccurrence]
    now: str


class DwPreviewOccurrence(WireModel):
    start_at: str
    end_at: str
    token: str


class DwPreviewDoor(WireModel):
    door: str
    label: str
    zone: str
    errors: list[str]
    occurrences: list[DwPreviewOccurrence]


class DwRulePreview(WireModel):
    doors: list[DwPreviewDoor]
    tier: DwTier


class DwRuleSaved(WireModel):
    """A save: the rule, and for a new `ha_event` trigger its token ONCE (with the action text carrying it)."""
    rule: DwRule
    token: str = ""
    snippet: str = ""


class DwRuleOne(WireModel):
    rule: DwRule


class DwToken(WireModel):
    token: str
    snippet: str


class DwOccurrenceOne(WireModel):
    occurrence: DwOccurrence


class DwOpenForDecision(WireModel):
    door: str
    decision: str
    """`started` / `extended` (a refusal is answered 409)."""
    reason: str | None
    occurrence_id: str | None
    start_at: str | None
    end_at: str | None


class DwOpenFor(WireModel):
    decision: DwOpenForDecision


class DwDoorHandled(WireModel):
    door: str
    handled: bool


class DwProgramException(WireModel):
    date: str
    periods: list[str]


class DwProgramSummary(WireModel):
    """The program Arx would write, summarised: per WisKey day name its periods (`HH:MM-HH:MM`)."""
    timezone: str | None
    name: str | None
    weekly: dict[str, list[str]]
    exceptions: int
    next_exceptions: list[DwProgramException]


class DwEngineCurrent(WireModel):
    """What the engine holds now (one read)."""
    exists: bool
    enabled: bool
    revision: int
    arx: bool
    status: str
    matches: bool


class DwProgramPreview(WireModel):
    """The dry run of one door's program write. `action`: prepared | blocked | invalid | held | unreadable | foreign | nothing | pause |
    unchanged | write; `reason` with blocked / held / unreadable."""
    door: str
    label: str
    zone: str
    enabled: bool
    tier: DwTier
    sha: str | None
    program: DwProgramSummary | None
    errors: list[str]
    invalid: str | None
    request_bytes: int
    write: DwProgram
    current: DwEngineCurrent | None
    two_writes: bool
    in_window: bool
    dry_run: bool
    action: str
    reason: str = ""


class DwProgramPreviewOne(WireModel):
    preview: DwProgramPreview


class DwProgramResult(WireModel):
    """The door's sync result after a "write again", and its new write state."""
    door: str
    outcome: str
    code: str
    errors: list[str]
    write: DwProgram


class DwProgramApplied(WireModel):
    result: DwProgramResult


class DwCalendarDay(WireModel):
    on_date: str
    scope_key: str
    day_type: str
    label: str | None


class DwHoliday(WireModel):
    date: str
    kind: Literal["holiday", "holiday_eve", "regular", "closed"]
    name_he: str
    source: Literal["generated", "manual"]
    generated_kind: str | None


class DwCalendar(WireModel):
    days: list[DwCalendarDay]
    generator: str
    holidays: list[DwHoliday]


class DwCalendarSaved(WireModel):
    saved: int


class DwSettings(WireModel):
    settings: dict[str, str]
    """The door-window settings by their full key (`doors.windows.max_hours`, ...), values as stored text."""
    go_live_permitted: bool
    program_engine_built: bool


class DwSettingsSaved(WireModel):
    settings: dict[str, str]
    changed: list[str]


class DwDoorFlags(WireModel):
    door: str
    exterior: bool


# ================================================================ emergency

class DwEmergencyCan(WireModel):
    lock: bool
    open: bool
    grant: bool


class DwIncidentCounts(WireModel):
    total: int
    ok: int
    failed: int
    unknown: int


class DwIncidentDoor(WireModel):
    door: str
    label: str
    phase: Literal["apply", "release"]
    state: str
    attempts: int
    code: str | None


class DwIncidentForeign(WireModel):
    door: str
    label: str


class DwIncident(WireModel):
    """services/door_emergency.incident_view. `doors` unless asked without; the screen state adds `can_release`, `can_retry_open` and
    `verify_required` to the active incident."""
    id: str
    kind: Literal["lock_secure", "open"]
    kind_label: str
    drill: bool
    state: str
    scope_type: str
    scope_id: str
    scope_name: str
    requested_at: str
    released_at: str | None
    reason: str
    counts: DwIncidentCounts
    first_sent_ms: int | None
    last_sent_ms: int | None
    superseded_by: str | None
    doors: list[DwIncidentDoor] = []
    foreign_paused: list[DwIncidentForeign]
    can_release: bool = False
    can_retry_open: bool = False
    verify_required: bool = False


class DwEmergencyScope(WireModel):
    scope_type: Literal["installation", "site", "building"]
    scope_id: str
    name: str
    doors: int


class DwEmergencyScopes(WireModel):
    lock_secure: list[DwEmergencyScope]
    open: list[DwEmergencyScope]


class DwEmergencyState(WireModel):
    """The emergency state: the active incident for everyone who sees doors; `scopes`, `drill`, `foreign_paused` and `recent` only for
    the holders of an emergency permission."""
    enabled: bool
    open_enabled: bool
    hold_ms: int
    home_widget: bool
    can: DwEmergencyCan
    active: DwIncident | None
    scopes: DwEmergencyScopes = None
    drill: DwIncident | None = None
    foreign_paused: list[DwForeignPaused] = []
    recent: list[DwIncident] = []


class DwPrepared(WireModel):
    """The first step of a start / release: the single-use confirmation token and what it confirms."""
    confirm_token: str
    expires_at: str
    doors: int
    kind: Literal["lock_secure", "open"]
    action: Literal["start", "release"]
    drill: bool
    scope_type: str
    scope_id: str
    scope_name: str


class DwIncidentOne(WireModel):
    incident: DwIncident


class DwGrantHolder(WireModel):
    id: str
    subject_kind: Literal["user", "group"]
    subject_id: str
    name: str
    scope_type: str
    scope_id: str
    scope_name: str
    expires_at: str | None
    created_at: str
    assigned_by: str | None
    assigned_by_name: str
    role_name: str


class DwGrantCandidate(WireModel):
    id: str
    name: str


class DwGrantScope(WireModel):
    scope_type: str
    scope_id: str
    name: str


class DwGrants(WireModel):
    """Who holds the emergency-open role, and the people / places a grant may name."""
    basis: Literal["system_admin", "security_manager"]
    default_hours: int
    max_hours: int
    can_no_expiry: bool
    holders: list[DwGrantHolder]
    candidates: list[DwGrantCandidate]
    scopes: list[DwGrantScope]
    role_name: str


class DwGrant(WireModel):
    id: str
    user_id: str
    scope_type: str
    scope_id: str
    expires_at: str | None
    revision: int


class DwGrantOne(WireModel):
    grant: DwGrant


class DwGrantRevoked(WireModel):
    revoked: str
    revision: int


class DwAttestationText(WireModel):
    version: int
    text: str


class DwEmergencySettings(WireModel):
    """The emergency settings (values as stored text, by their full key) and the build / permit facts."""
    announce_phrase: str = Field(alias="doors.emergency.announce_phrase")
    home_widget: str = Field(alias="doors.emergency.home_widget")
    enabled: str = Field(alias="doors.emergency.enabled")
    open_enabled: str = Field(alias="doors.emergency.open_enabled")
    engine_switch: str = Field(alias="doors.emergency.engine_switch")
    automations: str = Field(alias="doors.emergency.automations")
    hold_ms: str = Field(alias="doors.emergency.hold_ms")
    grant_default_hours: str = Field(alias="doors.emergency.grant.default_hours")
    grant_max_hours: str = Field(alias="doors.emergency.grant.max_hours")
    grant_by_security_manager: str = Field(alias="doors.emergency.grant.by_security_manager")
    retry_open_by_holders: str = Field(alias="doors.emergency.retry_open.by_holders")
    go_live_permitted: bool
    live_engine_built: bool
    emergency_engine_built: bool
    build_ready: bool
    """The permit and the engine flag, before the settings switch."""
    open_available: bool
    lock_available: bool
    attested: bool
    attestation: DwAttestationText


class DwEmergencySettingsOne(WireModel):
    settings: DwEmergencySettings


class DwEmergencySettingsSaved(WireModel):
    settings: DwEmergencySettings
    changed: list[str]


class DwAttested(WireModel):
    attested: bool
    version: int
