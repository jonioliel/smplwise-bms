"""Response models of routers/access_control_station_people.py (RESPONSE-MODELS-E-2480, code review 07:F8 step 2)."""
from __future__ import annotations

from typing import Any

from . import ExactModel, Num

# routes without a JSON body
NO_JSON: frozenset[str] = frozenset()
# JSON routes without a model yet: no test reaches a successful answer (or the answer is not one object); counted by the ratchet
# (scripts/wire_ratchet.py) until they are modelled
UNMODELLED: frozenset[str] = frozenset()


class AccessControlStationPeopleStationListStation(ExactModel):
    id: str
    name: str
    online: bool
    ignored: Num
    credentials: bool
    numbers: bool


class AccessControlStationPeopleStationList(ExactModel):
    """The stations whose users the caller may review (`access.people.manage` on each), from the served copy (no WisKey call): `{stations: [{id, name, online, ignored, credentials, numbers}]}` - `ignored` how many of its users an administrator cho"""
    state: str
    stations: list[AccessControlStationPeopleStationListStation]


class AccessControlStationPeopleStationUsersStation(ExactModel):
    id: str
    name: str


class AccessControlStationPeopleStationUsersPeopleItem(ExactModel):
    employee_no: str
    display_name: str
    first_seen_at: str
    last_seen_at: str
    ignored: bool
    ignored_at: str | None
    ignored_in_wiskey: bool
    adoptable: bool
    import_error: str | None
    pin: bool | None
    cards: Num | None
    biometric: bool | None


class AccessControlStationPeopleStationUsers(ExactModel):
    """The station's users that no WisKey person is bound to: `{state, last_error, station: {id, name}, read_at, cached, people}`; each person `{employee_no, display_name, first_seen_at, last_seen_at, ignored, ignored_at, ignored_in_wiskey, adopta"""
    state: str
    last_error: str | None
    cached: bool
    station: AccessControlStationPeopleStationUsersStation
    read_at: str | None
    people: list[AccessControlStationPeopleStationUsersPeopleItem] | None


class AccessControlStationPeopleStationUserCheckMatche(ExactModel):
    id: str
    display_name: str
    employee_no: str
    reasons: list[str]


class AccessControlStationPeopleStationUserCheck(ExactModel):
    """Before adopting: is this station user already a WisKey person (same user number - adopt links to them) or possibly the same person under another number (same name / phone; WisKey `users/duplicate_check`)? Body `{station_id, employee_no}`; t"""
    state: str
    last_error: Any
    checked: bool
    matches: list[AccessControlStationPeopleStationUserCheckMatche]
    total: Num
    same_number: Any
    restricted: bool


class AccessControlStationPeoplePeopleDuplicatesGroup(ExactModel):
    code: str
    field_id: str
    label: str
    people: list[dict[str, str]]
    more: Num


class AccessControlStationPeoplePeopleDuplicates(ExactModel):
    """People who may be the same person twice (WisKey `users/data_quality`, duplicates only): groups `{code, field_id, label, people: [{id, display_name}], more}`, never the shared value."""
    state: str
    last_error: str | None = None
    restricted: bool
    groups: list[AccessControlStationPeoplePeopleDuplicatesGroup] | None
    complete: bool


class AccessControlStationPeoplePinCheck(ExactModel):
    """Whether a PIN typed in the editor is free in WisKey (`users/pin_check`; body `{user_id, pin}`, `user_id` "" for a new person)."""
    state: str
    last_error: Any
    available: bool


class AccessControlStationPeopleAdoptResult(ExactModel):
    station_id: str
    outcome: str
    code: str | None
    message: str | None
    command_id: str = None


class AccessControlStationPeopleAdoptSummary(ExactModel):
    ok: Num
    refused: Num
    unknown: Num
    not_sent: Num


class AccessControlStationPeopleAdoptPerson(ExactModel):
    id: str
    display_name: str


class AccessControlStationPeopleAdopt(ExactModel):
    """Adopt a station user (WisKey `users/adopt`): WisKey creates the person from the user as the station holds it and binds them - nothing is created on the station."""
    results: list[AccessControlStationPeopleAdoptResult]
    summary: AccessControlStationPeopleAdoptSummary
    person: AccessControlStationPeopleAdoptPerson | None
    effect: str
    pending: bool


class AccessControlStationPeopleDeleteFromStationResult(ExactModel):
    station_id: str
    outcome: str
    code: Any
    message: Any
    command_id: str


class AccessControlStationPeopleDeleteFromStation(ExactModel):
    """Delete a user from the station (WisKey `users/delete_unmanaged`: WisKey records the user and its removal in one commit and its own sync deletes it from the device - a DEVICE WRITE, not immediate)."""
    results: list[AccessControlStationPeopleDeleteFromStationResult]
    summary: AccessControlStationPeopleAdoptSummary
    effect: str
    pending: bool
    note: str


class AccessControlStationPeopleIgnoreResult(ExactModel):
    station_id: str
    outcome: str
    code: str | None
    message: str | None
    command_id: str = None
    stored: bool


class AccessControlStationPeopleIgnore(ExactModel):
    """Ignore a station user (or undo it): stored in Arx's list first (migration 0198 - the screen hides it from then on), then mirrored to WisKey's own flag (`users/ignore`) so its unmanaged counts agree."""
    results: list[AccessControlStationPeopleIgnoreResult]
    summary: AccessControlStationPeopleAdoptSummary
