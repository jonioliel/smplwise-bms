"""Response models of routers/calendar_attendees.py (RESPONSE-MODELS-E-2480, code review 07:F8 step 2)."""
from __future__ import annotations

from typing import Any

from . import ExactModel, Num

# routes without a JSON body
NO_JSON: frozenset[str] = frozenset()
# JSON routes without a model yet: no test reaches a successful answer (or the answer is not one object); counted by the ratchet
# (scripts/wire_ratchet.py) until they are modelled
UNMODELLED: frozenset[str] = frozenset()


class CalendarAttendeesAttendeesAttendeeLastNotice(ExactModel):
    kind: str
    state: str
    channel: str | None
    reason: Any


class CalendarAttendeesAttendeesAttendeeContact(ExactModel):
    phone: str
    email: str


class CalendarAttendeesAttendeesAttendee(ExactModel):
    id: str
    kind: str
    ref_id: str | None
    name: str
    role: str
    status: str
    notified: bool
    you: bool
    added_by_you: bool = None
    last_notice: CalendarAttendeesAttendeesAttendeeLastNotice | None = None
    contact: CalendarAttendeesAttendeesAttendeeContact = None


class CalendarAttendeesAttendeesMe(ExactModel):
    id: str
    status: str
    role: str


class CalendarAttendeesAttendeesCan(ExactModel):
    manage: bool
    join: bool
    add_guest: bool
    respond: bool
    leave: bool
    contacts: bool


class CalendarAttendeesAttendeesPolicy(ExactModel):
    guests_mode: str
    self_join: bool
    max_attendees: Num


class CalendarAttendeesAttendees(ExactModel):
    event_id: str
    count: Num | None
    list_visible: bool
    attendees: list[CalendarAttendeesAttendeesAttendee]
    me: CalendarAttendeesAttendeesMe | None
    can: CalendarAttendeesAttendeesCan
    policy: CalendarAttendeesAttendeesPolicy


class CalendarAttendeesAddAttendees(ExactModel):
    event_id: str
    count: Num
    list_visible: bool
    attendees: list[CalendarAttendeesAttendeesAttendee]
    me: CalendarAttendeesAttendeesMe | None
    can: CalendarAttendeesAttendeesCan
    policy: CalendarAttendeesAttendeesPolicy
    added: list[str]


class CalendarAttendeesPatchAttendeeAttendeeLastNotice(ExactModel):
    kind: str
    state: str
    channel: Any
    reason: Any


class CalendarAttendeesPatchAttendeeAttendee(ExactModel):
    id: str
    kind: str
    ref_id: str
    name: str
    role: str
    status: str
    notified: bool
    you: bool
    added_by_you: bool
    last_notice: CalendarAttendeesPatchAttendeeAttendeeLastNotice | None


class CalendarAttendeesPatchAttendee(ExactModel):
    event_id: str
    count: Num
    list_visible: bool
    attendees: list[CalendarAttendeesPatchAttendeeAttendee]
    me: Any
    can: CalendarAttendeesAttendeesCan
    policy: CalendarAttendeesAttendeesPolicy


class CalendarAttendeesDeleteAttendeeAttendeeLastNotice(ExactModel):
    kind: str
    state: str
    channel: str
    reason: Any


class CalendarAttendeesDeleteAttendeeAttendee(ExactModel):
    id: str
    kind: str
    ref_id: str
    name: str
    role: str
    status: str
    notified: bool
    you: bool
    added_by_you: bool = None
    last_notice: CalendarAttendeesDeleteAttendeeAttendeeLastNotice = None


class CalendarAttendeesDeleteAttendee(ExactModel):
    event_id: str
    count: Num
    list_visible: bool
    attendees: list[CalendarAttendeesDeleteAttendeeAttendee]
    me: CalendarAttendeesAttendeesMe | None
    can: CalendarAttendeesAttendeesCan
    policy: CalendarAttendeesAttendeesPolicy


class CalendarAttendeesRespondAttendee(ExactModel):
    id: str
    kind: str
    ref_id: str
    name: str
    role: str
    status: str
    notified: bool
    you: bool


class CalendarAttendeesRespond(ExactModel):
    """The attendee's own answer: accepted | declined | tentative."""
    event_id: str
    count: Num
    list_visible: bool
    attendees: list[CalendarAttendeesRespondAttendee]
    me: CalendarAttendeesAttendeesMe
    can: CalendarAttendeesAttendeesCan
    policy: CalendarAttendeesAttendeesPolicy


class CalendarAttendeesDirectoryResult(ExactModel):
    kind: str
    ref_id: str
    name: str


class CalendarAttendeesDirectory(ExactModel):
    """The picker's search: users (holders of calendar.book) and residents (holders of calendar.book_for_others / calendar.manage)."""
    results: list[CalendarAttendeesDirectoryResult]
    residents: bool


class CalendarAttendeesPolicyPolicy(ExactModel):
    guests_mode: str
    self_join: bool
    max_attendees: Num
    notify_on_change: bool
    list_visibility: str
    revision: Num


class CalendarAttendeesPolicy(ExactModel):
    policy: CalendarAttendeesPolicyPolicy
    can_edit: bool


class CalendarAttendeesSettingsChannel(ExactModel):
    key: str
    address: str
    state: str
    available: bool


class CalendarAttendeesSettings(ExactModel):
    settings: dict[str, Any]
    channels: list[CalendarAttendeesSettingsChannel]
    can_configure: bool


class CalendarAttendeesPutSettings(ExactModel):
    settings: dict[str, Any]
    channels: list[CalendarAttendeesSettingsChannel]
