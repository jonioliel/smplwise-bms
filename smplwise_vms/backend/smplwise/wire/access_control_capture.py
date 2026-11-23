"""Response models of routers/access_control_capture.py (RESPONSE-MODELS-E-2480, code review 07:F8 step 2)."""
from __future__ import annotations

from typing import Any

from . import ExactModel, Num

# routes without a JSON body
NO_JSON: frozenset[str] = frozenset()
# JSON routes without a model yet: no test reaches a successful answer (or the answer is not one object); counted by the ratchet
# (scripts/wire_ratchet.py) until they are modelled
UNMODELLED: frozenset[str] = frozenset()


class AccessControlCaptureCardReadersReaders(ExactModel):
    readers: list[Num]
    card_min: Num
    card_max: Num


class AccessControlCaptureCardReadersSync(ExactModel):
    state: str
    connected: bool
    last_error: str | None
    reconnects: Num
    started_at: str | None
    fetched_at: str | None
    refreshes: Num
    sequence: Num
    wiskey_version: str | None


class AccessControlCaptureCardReaders(ExactModel):
    """The station's card readers (WisKey `cards/reader_capabilities`, a read that reaches the device - WisKey allows it 35 s): `readers` (0 = the station's default reader) and the card-number length bounds."""
    state: str
    configured: bool
    last_error: str | None
    fetched_at: str | None
    readers: AccessControlCaptureCardReadersReaders | None
    sync: AccessControlCaptureCardReadersSync


class AccessControlCaptureCardCaptureStartCapture(ExactModel):
    session_id: str
    person_id: str
    station_id: str
    station_name: str
    reader_id: Num
    state: str
    active: bool
    error: Any
    reason: Any
    card: Any
    started_at: str
    elapsed_s: Num
    collect_remaining_s: Num
    session_remaining_s: Num
    reader_may_be_collecting: bool


class AccessControlCaptureCardCaptureStartSync(ExactModel):
    state: str
    connected: bool
    last_error: Any
    reconnects: Num
    started_at: str
    fetched_at: str
    refreshes: Num
    sequence: Num
    wiskey_version: str


class AccessControlCaptureCardCaptureStart(ExactModel):
    """Start reading a card at a station (WisKey `cards/capture_start`, PHYSICAL: the station's reader enters card- collection mode)."""
    state: str
    configured: bool
    last_error: Any
    capture: AccessControlCaptureCardCaptureStartCapture
    note: str
    command_id: str
    effect: str
    pending: bool
    fetched_at: str = None
    sync: AccessControlCaptureCardCaptureStartSync = None


class AccessControlCaptureCardCaptureStatusCaptureCard(ExactModel):
    masked_number: str
    technology: str
    reader_id: Num


class AccessControlCaptureCardCaptureStatusCapture(ExactModel):
    session_id: str
    person_id: str
    station_id: str
    station_name: str
    reader_id: Num
    state: str
    active: bool
    error: str | None
    reason: Any
    card: AccessControlCaptureCardCaptureStatusCaptureCard | None
    started_at: str
    elapsed_s: Num
    collect_remaining_s: Num | None
    session_remaining_s: Num
    reader_may_be_collecting: bool


class AccessControlCaptureCardCaptureStatus(ExactModel):
    """The caller's own capture session as SMPLWISE's poller last read it from WisKey (no WisKey traffic per request): `state` preparing | waiting | captured | applying (active) or error | cancelled | cancel_unknown | expired | lost | confirmed | """
    capture: AccessControlCaptureCardCaptureStatusCapture


class AccessControlCaptureCardCaptureCancelCancelled(ExactModel):
    cancelled: bool


class AccessControlCaptureCardCaptureCancelCapture(ExactModel):
    session_id: str
    person_id: str
    station_id: str
    station_name: str
    reader_id: Num
    state: str
    active: bool
    error: Any
    reason: Any
    card: Any
    started_at: str
    elapsed_s: Num
    collect_remaining_s: Any
    session_remaining_s: Num
    reader_may_be_collecting: bool


class AccessControlCaptureCardCaptureCancel(ExactModel):
    """Cancel the caller's own capture (WisKey `cards/capture_cancel`): WisKey stops waiting for a card and drops the session."""
    state: str
    configured: bool
    last_error: Any
    fetched_at: str | None = None
    cancelled: Any
    sync: AccessControlCaptureCardCaptureStartSync | None = None
    command_id: str
    capture: AccessControlCaptureCardCaptureCancelCapture
    note: str
    effect: str
    pending: bool


class AccessControlCaptureCardCaptureConfirmPersonStation(ExactModel):
    station_id: str
    enabled: bool
    doors: list[Num]
    sync_state: str
    last_error: str | None
    desired_revision: Num | None
    applied_revision: Num | None


class AccessControlCaptureCardCaptureConfirmPersonCard(ExactModel):
    id: str
    masked_number: str
    label: str
    card_type: str
    enabled: bool


class AccessControlCaptureCardCaptureConfirmPersonPermissionOverrides(ExactModel):
    events: str | None = None


class AccessControlCaptureCardCaptureConfirmPersonTimingPolicySchedule(ExactModel):
    mode: str
    timezone: str
    days: list[Any]
    dates: list[Any]
    periods: list[Any]


class AccessControlCaptureCardCaptureConfirmPersonTimingPolicy(ExactModel):
    mode: str
    schedule: AccessControlCaptureCardCaptureConfirmPersonTimingPolicySchedule
    bindings: dict[str, Any]


class AccessControlCaptureCardCaptureConfirmPerson(ExactModel):
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
    stations: list[AccessControlCaptureCardCaptureConfirmPersonStation]
    phone: str
    identity_locked: bool
    pin_configured: bool | None
    credentials_known: bool
    cards: list[AccessControlCaptureCardCaptureConfirmPersonCard]
    permission_overrides: AccessControlCaptureCardCaptureConfirmPersonPermissionOverrides
    has_timing: bool
    archived: bool
    responsible_person: Any
    access_purpose: Any
    photo_configured: bool | None
    timing_draft: Any
    timing_policy: AccessControlCaptureCardCaptureConfirmPersonTimingPolicy | None
    level: str


class AccessControlCaptureCardCaptureConfirm(ExactModel):
    """Add the collected card to the person (WisKey `cards/capture_confirm`, a people write: the card, enabled, goes to the person's existing station assignments with WisKey's immediate sync - it opens their doors)."""
    state: str
    configured: bool
    last_error: Any
    fetched_at: str | None = None
    person: AccessControlCaptureCardCaptureConfirmPerson
    sync: AccessControlCaptureCardCaptureStartSync | None = None
    command_id: str
    capture: AccessControlCaptureCardCaptureCancelCapture
    note: str
    effect: str
    pending: bool
