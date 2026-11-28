"""Response models of the calendars API (routers/calendar.py, CALENDARS-298 / CALENDARS-UI-2310, `/api/v1/calendar...` and
`/api/v1/me/calendar`). The module's own state and settings answer on `open_router` (also while the module is off); everything else on
`router` behind the module gate. The settings document is passed through as stored (its own versioning in services/calendar/model.py);
an entry's attendee view (CAL-ATTENDEES-2343) is routers/calendar_attendees.py's document and passes through as built there.
Field order is the order the router and its services (services/calendar/calendars.py, events.py, decisions.py, guests.py) build
their dicts in."""
from __future__ import annotations

from typing import Any, Literal

from pydantic import Field

from . import WireModel
from .building_filter import BuildingFilter

# routes without a JSON body
NO_JSON = frozenset({"DELETE /calendar/events/{eid}/guests"})

CalRole = Literal["view", "book", "edit", "manage"]


# ---------------------------------------------------------------- module state and settings (open_router)

class CalModuleState(WireModel):
    """GET /calendar/module: the switch, the menu position, what the caller may do anywhere, and the presentation choices every screen
    needs before it draws."""
    enabled: bool
    menu_position: str
    can: dict[str, bool]
    """Permission short name (`view`, `book`, `book_for_others`, `manage`, `maintenance`, `guests`, `configure`, `connect`) -> held anywhere."""
    ui: dict[str, Any]
    """A slice of the settings document (the UI choices, `allow_displace`, `guest_details_enabled`)."""


class CalSettingsView(WireModel):
    settings: dict[str, Any]
    """The settings document as stored (services/calendar/model.read_settings)."""
    can_configure: bool
    revision: int
    """FIX-CALENDAR-2570 (SA2-06): the document's version; a save that names an older one (`base_revision`) is refused with 409 `revision_conflict`."""


class CalSettingsSaved(WireModel):
    settings: dict[str, Any]
    erase_preview: int
    """Guest records a shorter retention erases (0 when the retention did not change)."""
    revision: int
    """FIX-CALENDAR-2570 (SA2-06): the document's version after this save."""


class CalGuestsPurged(WireModel):
    erased: int


# ---------------------------------------------------------------- calendars

class CalPerson(WireModel):
    id: str
    name: str


class CalSync(WireModel):
    """The calendar's binding to an external one (never a reference or a token)."""
    state: str
    provider: str
    direction: str
    detail: str
    dedicated: bool


class CalCalendar(WireModel):
    """services/calendar/calendars.serialize."""
    id: str
    name: str
    type: Literal["room", "team", "maintenance", "event"]
    description: str
    color: str
    tz: str
    owner: CalPerson | None
    my_role: CalRole | None
    visibility: str
    approval_mode: str
    approval_timeout_h: int | None
    capacity: int | None
    equipment: list[str]
    floor_id: str | None
    area_ref: str | None
    conflict_policy: str
    buffer_before_min: int
    buffer_after_min: int
    slot_step_min: int
    min_minutes: int | None
    max_minutes: int | None
    lead_min: int
    horizon_days: int
    hours_mode: str
    hours_json: dict[str, Any] | None
    """The calendar's own hours as stored ({weekdays, start, end})."""
    holiday_rule: str
    overlap_override: str | None
    sync: CalSync | None
    pending_count: int
    archived: bool
    revision: int
    approved_move: str
    open_hours: dict[str, Any] | None
    """The hours in force ({weekdays ISO 1-7, start, end}): the calendar's own or the installation's default; null = always open."""


class CalCalendarList(WireModel):
    calendars: list[CalCalendar]


class CalCalendarOne(WireModel):
    calendar: CalCalendar


class CalMembersSummary(WireModel):
    count: int


class CalCalendarDetail(WireModel):
    calendar: CalCalendar
    members_summary: CalMembersSummary


class CalCalendarArchived(WireModel):
    calendar: CalCalendar
    cancelled: int


class CalMember(WireModel):
    subject_kind: Literal["user", "role", "department", "everyone"]
    subject_id: str
    label: str
    cal_role: CalRole


class CalMembers(WireModel):
    members: list[CalMember]


# ---------------------------------------------------------------- entries

class CalHeld(WireModel):
    """The approved slot a change request keeps until the decision."""
    calendar_id: str
    start: str
    end: str


class CalOccurrence(WireModel):
    """One cached occurrence as this viewer may see it (`title` / `organizer` null at the busy detail level). `held_slot` only on the
    approved slot of a change request (drawn dotted, never dragged)."""
    occurrence_id: str
    event_id: str
    calendar_id: str
    room_calendar_ids: list[str]
    start: str
    end: str
    state: str
    kind: str
    title: str | None
    on_behalf_label: str | None
    organizer: CalPerson | None
    recurring: bool
    contested: bool
    sync_flag: str | None
    can_edit: bool
    revision: int
    local_start: str
    all_day: bool
    held: CalHeld | None
    held_slot: bool = None


class CalOccurrences(WireModel):
    occurrences: list[CalOccurrence]
    truncated: bool


class CalOpenSpan(WireModel):
    from_: str = Field(alias="from")
    to: str


class CalRoomDay(WireModel):
    calendar_id: str
    name: str
    capacity: int | None
    equipment: list[str]
    open: list[CalOpenSpan]
    entries: list[CalOccurrence]
    # MULTI-BUILDING-NEXT-2500: the buildings the room serves - only when the answer carries `building_filter`
    buildings: list[str] | None = None


class CalRoomsDay(WireModel):
    rooms: list[CalRoomDay]
    # MULTI-BUILDING-NEXT-2500: present only on a multi-building site whose rooms sit in two or more buildings (services/building_filter)
    building_filter: BuildingFilter | None = None


class CalSlot(WireModel):
    calendar_id: str
    start: str
    end: str


class CalAvailability(WireModel):
    free: list[CalSlot]
    nearest: list[CalSlot]


class CalEventCan(WireModel):
    edit: bool
    cancel: bool
    approve: bool
    restore: bool


class CalEventRoom(WireModel):
    room_calendar_id: str
    state: str
    contested: bool


class CalEvent(WireModel):
    """services/calendar/events.serialize: fields below the caller's detail level are null (`title`, `notes`, `on_behalf_*`,
    `headcount`, `equipment_req`, `organizer`, `automation_hold`); `sync_flag` only for `edit`+."""
    id: str
    calendar_id: str
    kind: str
    title: str | None
    notes: str | None
    start: str
    end: str
    all_day: bool
    tz: str
    rrule: str | None
    holiday_skip: bool
    exdates: list[str]
    state: str
    contested: bool
    override_of: str | None
    override_start: str | None
    on_behalf_label: str | None
    on_behalf_kind: str | None
    headcount: int | None
    equipment_req: list[str] | None
    organizer: CalPerson | None
    automation_hold: bool | None
    revision: int
    recurring: bool
    source: str
    sync_flag: str | None
    can: CalEventCan
    rooms: list[CalEventRoom]
    held: CalHeld | None


class CalEventWarnings(WireModel):
    outside_hours: bool
    holiday_hits: list[str]


class CalEventCreated(WireModel):
    """A new entry: its state, the room requests it made, the warnings; `attendees` when the request named some (CAL-ATTENDEES-2343)."""
    event: CalEvent
    state: str
    requests: list[CalEventRoom]
    warnings: CalEventWarnings
    attendees: dict[str, Any] = None


class CalConflict(WireModel):
    """`title`: the entry that holds the slot, only where the caller may read it on that calendar (null = "another booking"; RESPONSE-HINTS-2480)."""
    event_id: str
    calendar_id: str
    start: str
    end: str
    state: str
    title: str | None = None


class CalFreeSlot(WireModel):
    start: str
    end: str


class CalEventPreview(WireModel):
    conflicts: list[CalConflict]
    needs_approval_by: list[str]
    contested: bool
    outside_hours: bool
    holiday_hits: list[str]
    capacity_ok: bool
    suggestions: list[CalFreeSlot]


class CalHistoryRow(WireModel):
    action: str
    room_calendar_id: str | None
    actor: str | None
    note: str
    at: str


class CalEventDetail(WireModel):
    """One entry; the approval history and the guest count only for `edit`+ or the organizer (else empty / 0)."""
    event: CalEvent
    history: list[CalHistoryRow]
    guests_count: int
    guests_visible: bool


class CalEventUpdated(WireModel):
    """A move / resize / edit: `change_withdrawn` when an approved booking's pending change was dropped; `attendees` when the attendee
    list was part of the request (CAL-ATTENDEES-2343)."""
    event: CalEvent
    orphaned_overrides: list[str]
    change_withdrawn: bool = None
    attendees: dict[str, Any] = None


class CalEventRestored(WireModel):
    event: CalEvent
    state: str
    """The state the entry had before it was cancelled."""


class CalEventOne(WireModel):
    """A cancel or a withdraw (`change_withdrawn` when only a pending change of an approved booking was withdrawn)."""
    event: CalEvent
    change_withdrawn: bool = None


class CalGuest(WireModel):
    seq: int
    name: str
    phone: str


class CalGuests(WireModel):
    guests: list[CalGuest]
    erase_after: str | None


class CalPending(WireModel):
    event_id: str
    title: str
    start: str
    end: str
    calendar_id: str
    revision: int


class CalMine(WireModel):
    occurrences: list[CalOccurrence]
    pending: list[CalPending]


# ---------------------------------------------------------------- approvals and maintenance

class CalRequestCalendar(WireModel):
    id: str
    name: str
    color: str


class CalRequest(WireModel):
    """A request waiting for this manager, with its place among the overlapping requests of the same calendar."""
    event_id: str
    room_calendar_id: str | None
    calendar: CalRequestCalendar
    title: str
    kind: str
    start: str
    end: str
    recurring: bool
    organizer: CalPerson | None
    on_behalf_label: str | None
    headcount: int | None
    contested: bool
    competing_count: int
    conflicts_now: int
    requested_at: str
    revision: int
    change_of: CalHeld | None
    queue_position: int
    suggested: bool


class CalRequests(WireModel):
    requests: list[CalRequest]


class CalDecided(WireModel):
    """`change_rejected` when a change of an approved booking was rejected (the booking keeps its approved slot)."""
    event: CalEvent
    state: str
    change_rejected: bool = None


class CalOverlap(WireModel):
    event_id: str
    calendar_id: str
    start: str
    end: str
    state: str
    title: str | None
    organizer: CalPerson | None


class CalMaintPreview(WireModel):
    overlaps: list[CalOverlap]
    mode: str
    alternatives: list[CalFreeSlot]


class CalMaintPlaced(WireModel):
    event: CalEvent
    displaced: list[str]
