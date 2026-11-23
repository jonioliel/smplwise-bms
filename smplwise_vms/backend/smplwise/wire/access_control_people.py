"""Response models of routers/access_control_people.py (RESPONSE-MODELS-E-2480, code review 07:F8 step 2)."""
from __future__ import annotations

from typing import Any

from . import ExactModel, Num

# routes without a JSON body
NO_JSON: frozenset[str] = frozenset()
# JSON routes without a model yet: no test reaches a successful answer (or the answer is not one object); counted by the ratchet
# (scripts/wire_ratchet.py) until they are modelled
UNMODELLED: frozenset[str] = frozenset()


class AccessControlPeoplePeopleEditorContextSync(ExactModel):
    state: str
    connected: bool
    last_error: str | None
    reconnects: Num
    started_at: str | None
    fetched_at: str | None
    refreshes: Num
    sequence: Num
    wiskey_version: str | None


class AccessControlPeoplePeopleEditorContext(ExactModel):
    """What the editor needs from WisKey's `overview` beyond the entry center (intercom_sync.project_editor_context): the stations with their relays and whether each can take a keypad PIN, the HA display zone, WisKey's `api.capabilities`, whether """
    state: str
    configured: bool
    last_error: str | None
    fetched_at: str | None
    context: dict[str, Any] | None
    sync: AccessControlPeoplePeopleEditorContextSync


class AccessControlPeoplePersonEditorPersonStation(ExactModel):
    station_id: str
    enabled: bool
    doors: list[Num]
    sync_state: str
    last_error: str | None
    desired_revision: Num
    applied_revision: Num


class AccessControlPeoplePersonEditorPersonCard(ExactModel):
    id: str
    masked_number: str
    label: str
    card_type: str
    enabled: bool


class AccessControlPeoplePersonEditorPersonTimingDraft(ExactModel):
    mode: str
    timezone: str
    days: list[str]
    dates: list[Any]
    periods: list[dict[str, str]]


class AccessControlPeoplePersonEditorPersonTimingPolicySchedule(ExactModel):
    mode: str
    timezone: str
    days: list[Any]
    dates: list[str]
    periods: list[dict[str, str]]


class AccessControlPeoplePersonEditorPersonTimingPolicy(ExactModel):
    mode: str
    schedule: AccessControlPeoplePersonEditorPersonTimingPolicySchedule
    bindings: dict[str, Any]


class AccessControlPeoplePersonEditorPerson(ExactModel):
    id: str
    employee_no: str
    display_name: str
    active: bool
    valid_from: Any
    valid_until: str
    revision: Num
    access_category: str
    access_known: bool
    stations_known: bool
    redacted_fields: list[Any]
    operator_editable: Any
    group_ids: list[str]
    stations: list[AccessControlPeoplePersonEditorPersonStation]
    phone: str | None
    identity_locked: bool
    pin_configured: bool | None
    credentials_known: bool
    cards: list[AccessControlPeoplePersonEditorPersonCard] | None
    permission_overrides: dict[str, Any]
    has_timing: bool
    archived: bool
    responsible_person: str | None
    access_purpose: str | None
    photo_configured: bool | None
    timing_draft: AccessControlPeoplePersonEditorPersonTimingDraft | None
    timing_policy: AccessControlPeoplePersonEditorPersonTimingPolicy | None
    level: str


class AccessControlPeoplePersonEditorSync(ExactModel):
    state: str
    connected: bool
    last_error: Any
    reconnects: Num
    started_at: str | None
    fetched_at: str | None
    refreshes: Num
    sequence: Num
    wiskey_version: str | None


class AccessControlPeoplePersonEditor(ExactModel):
    """One person for editing (WisKey `users/get`): the read projection plus phone, the PIN flag, the cards in WisKey's masked form (`•••• 1234` - the full number never leaves WisKey), the overrides, `identity_locked`, `has_timing`, each assignmen"""
    state: str
    configured: bool
    last_error: str | None
    fetched_at: str | None
    person: AccessControlPeoplePersonEditorPerson | None
    sync: AccessControlPeoplePersonEditorSync


class AccessControlPeoplePersonPinGeneratePin(ExactModel):
    pin: str


class AccessControlPeoplePersonPinGenerateSync(ExactModel):
    state: str
    connected: bool
    last_error: Any
    reconnects: Num
    started_at: str
    fetched_at: str
    refreshes: Num
    sequence: Num
    wiskey_version: str


class AccessControlPeoplePersonPinGenerate(ExactModel):
    """A free six-digit PIN from WisKey (`users/pin_generate`; body `{user_id}`, "" for a person not saved yet)."""
    state: str
    configured: bool
    last_error: str | None
    fetched_at: str | None
    pin: AccessControlPeoplePersonPinGeneratePin | None
    sync: AccessControlPeoplePersonPinGenerateSync


class AccessControlPeoplePersonCreatePersonStation(ExactModel):
    station_id: str
    enabled: bool
    doors: list[Num]
    sync_state: str
    last_error: Any
    desired_revision: Num | None
    applied_revision: Num | None


class AccessControlPeoplePersonCreatePerson(ExactModel):
    id: str
    employee_no: str
    display_name: str
    active: bool
    valid_from: Any
    valid_until: str | None
    revision: Num
    access_category: str
    access_known: bool
    stations_known: bool
    redacted_fields: list[Any]
    operator_editable: Any
    group_ids: list[str]
    stations: list[AccessControlPeoplePersonCreatePersonStation]
    phone: str | None
    identity_locked: bool
    pin_configured: bool | None
    credentials_known: bool
    cards: list[AccessControlPeoplePersonEditorPersonCard] | None
    permission_overrides: dict[str, Any]
    has_timing: bool
    archived: bool
    responsible_person: str | None
    access_purpose: str | None
    photo_configured: bool | None
    timing_draft: Any
    timing_policy: Any
    level: str


class AccessControlPeoplePersonCreate(ExactModel):
    """Create a person in WisKey (`users/create`)."""
    state: str
    configured: bool
    last_error: Any
    fetched_at: str
    person: AccessControlPeoplePersonCreatePerson
    sync: AccessControlPeoplePersonPinGenerateSync
    command_id: str
    note: str
    effect: str
    pending: bool


class AccessControlPeoplePersonUpdatePerson(ExactModel):
    id: str
    employee_no: str
    display_name: str
    active: bool
    valid_from: Any
    valid_until: str
    revision: Num
    access_category: str
    access_known: bool
    stations_known: bool
    redacted_fields: list[Any]
    operator_editable: Any
    group_ids: list[str]
    stations: list[AccessControlPeoplePersonCreatePersonStation]
    phone: str | None
    identity_locked: bool
    pin_configured: bool | None
    credentials_known: bool
    cards: list[AccessControlPeoplePersonEditorPersonCard] | None
    permission_overrides: dict[str, Any]
    has_timing: bool
    archived: bool
    responsible_person: str | None
    access_purpose: str | None
    photo_configured: bool | None
    timing_draft: AccessControlPeoplePersonEditorPersonTimingDraft | None
    timing_policy: AccessControlPeoplePersonEditorPersonTimingPolicy | None
    level: str


class AccessControlPeoplePersonUpdate(ExactModel):
    """Update a person in WisKey (`users/update`, compare-and-set on `revision`)."""
    state: str
    configured: bool
    last_error: Any
    fetched_at: str
    person: AccessControlPeoplePersonUpdatePerson
    sync: AccessControlPeoplePersonPinGenerateSync
    command_id: str
    note: str
    effect: str
    pending: bool


class AccessControlPeoplePersonDeleteDeleted(ExactModel):
    accepted: bool


class AccessControlPeoplePersonDelete(ExactModel):
    """Delete a person from WisKey (`users/delete`)."""
    state: str
    configured: bool
    last_error: Any
    fetched_at: str
    deleted: AccessControlPeoplePersonDeleteDeleted
    sync: AccessControlPeoplePersonPinGenerateSync
    command_id: str
    note: str
    effect: str
    pending: bool
