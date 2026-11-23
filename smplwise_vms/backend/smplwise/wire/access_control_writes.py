"""Response models of routers/access_control_writes.py (RESPONSE-MODELS-E-2480, code review 07:F8 step 2)."""
from __future__ import annotations

from typing import Any

from . import ExactModel, Num

# routes without a JSON body
NO_JSON: frozenset[str] = frozenset()
# JSON routes without a model yet: no test reaches a successful answer (or the answer is not one object); counted by the ratchet
# (scripts/wire_ratchet.py) until they are modelled
UNMODELLED: frozenset[str] = frozenset()


class AccessControlWritesPersonArchivePersonStation(ExactModel):
    station_id: str
    enabled: bool
    doors: list[Num]
    sync_state: str
    last_error: Any
    desired_revision: Num
    applied_revision: Num


class AccessControlWritesPersonArchivePersonCard(ExactModel):
    id: str
    masked_number: str
    label: str
    card_type: str
    enabled: bool


class AccessControlWritesPersonArchivePersonTimingDraft(ExactModel):
    mode: str
    timezone: str
    days: list[str]
    dates: list[Any]
    periods: list[dict[str, str]]


class AccessControlWritesPersonArchivePerson(ExactModel):
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
    stations: list[AccessControlWritesPersonArchivePersonStation]
    phone: str
    identity_locked: bool
    pin_configured: bool
    credentials_known: bool
    cards: list[AccessControlWritesPersonArchivePersonCard]
    permission_overrides: dict[str, Any]
    has_timing: bool
    archived: bool
    responsible_person: str
    access_purpose: str
    photo_configured: bool
    timing_draft: AccessControlWritesPersonArchivePersonTimingDraft | None
    timing_policy: Any
    level: str


class AccessControlWritesPersonArchiveSync(ExactModel):
    state: str
    connected: bool
    last_error: Any
    reconnects: Num
    started_at: str
    fetched_at: str
    refreshes: Num
    sequence: Num
    wiskey_version: str


class AccessControlWritesPersonArchive(ExactModel):
    """Archive a person (WisKey `users/archive`): the identity, its history and every pending cleanup are kept, the person is switched off and leaves the active directory; the stations follow."""
    state: str
    configured: bool
    last_error: Any
    fetched_at: str
    person: AccessControlWritesPersonArchivePerson
    sync: AccessControlWritesPersonArchiveSync
    command_id: str
    effect: str
    pending: bool


class AccessControlWritesPersonUnarchivePerson(ExactModel):
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
    stations: list[AccessControlWritesPersonArchivePersonStation]
    phone: str
    identity_locked: bool
    pin_configured: bool
    credentials_known: bool
    cards: list[AccessControlWritesPersonArchivePersonCard]
    permission_overrides: dict[str, Any]
    has_timing: bool
    archived: bool
    responsible_person: str
    access_purpose: str
    photo_configured: bool
    timing_draft: Any
    timing_policy: Any
    level: str


class AccessControlWritesPersonUnarchive(ExactModel):
    """Restore a person from the archive (WisKey `users/unarchive`): the record comes back SWITCHED OFF (WisKey's own rule - it is switched on separately)."""
    state: str
    configured: bool
    last_error: Any
    fetched_at: str
    person: AccessControlWritesPersonUnarchivePerson
    sync: AccessControlWritesPersonArchiveSync
    command_id: str
    effect: str
    pending: bool


class AccessControlWritesPersonPhotoSetPerson(ExactModel):
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
    stations: list[AccessControlWritesPersonArchivePersonStation]
    phone: str
    identity_locked: bool
    pin_configured: bool
    credentials_known: bool
    cards: list[AccessControlWritesPersonArchivePersonCard]
    permission_overrides: dict[str, Any]
    has_timing: bool
    archived: bool
    responsible_person: str
    access_purpose: str
    photo_configured: bool
    timing_draft: AccessControlWritesPersonArchivePersonTimingDraft | None
    timing_policy: Any
    level: str


class AccessControlWritesPersonPhotoSet(ExactModel):
    """Set or remove the person's photo (WisKey `users/update` with `photo`): `{photo: "data:image/jpeg;base64,..." | null, revision, sync_now, client_request_id, expires_at}` - a JPEG of at most 512 x 512 and 32 KB, checked here exactly as WisKey"""
    state: str
    configured: bool
    last_error: Any
    fetched_at: str
    person: AccessControlWritesPersonPhotoSetPerson
    sync: AccessControlWritesPersonArchiveSync
    command_id: str
    effect: str
    pending: bool
