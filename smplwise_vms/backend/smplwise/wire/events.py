"""Response models of the event centre API (routers/events.py, `/api/v1/events...` and `/api/v1/cameras/{id}/events`; chapter 26,
T032, T053 correlation, T062 spatial search, T064 suggested route, M047 review windows). Field order is the order the router builds
its dicts in. An event row is the `events` table row (services/events_ingest.row_to_event) with its `details` document passed through as
stored; several writers fill the table (alert stream, recordings, system, sensors, Frigate, WisKey), so `source`, `type`, `state`,
`severity` and `confidence` are the stored strings."""
from __future__ import annotations

from typing import Any, Literal

from pydantic import Field

from . import Num, WireModel

# routes without a JSON body: the 204 of an ungroup, the thumbnail (a JPEG, or a 202 JSONResponse while it is grabbed)
NO_JSON = frozenset({"DELETE /events/windows/groups/{group_id}", "GET /events/{event_id}/thumbnail"})

Thumbnail = Literal["ready", "pending", "unavailable", "none"]


class EventRow(WireModel):
    """One stored event (the `events` row; `details` is the stored JSON document)."""
    id: str
    source: str
    raw_type: str
    type: str
    camera_id: str | None
    channel: int | None
    occurred_at: str
    ended_at: str | None
    received_at: str
    state: str
    count: int
    severity: str
    confidence: str
    dedup_key: str
    acked_at: str | None
    acked_by: str | None
    acked_by_username: str | None
    created_at: str
    recorder_id: str | None = None
    """CR-024: the recorder whose alert stream (or camera) produced it (absent on a database before migration 0055)."""
    details: dict[str, Any]


class EventNamed(EventRow):
    """An event with its camera's name (a sensor event: the sensor's name; null when neither is known)."""
    camera_name: str | None


class EventPlace(WireModel):
    """NVRLESS-295: where a sensor event's entity is placed now."""
    floor_id: str
    floor_name: str
    building_name: str
    zone: str | None


class EventListed(EventNamed):
    """An event in `GET /events`: plus its picture state and, for a sensor (`source` 'ha') event, its current place."""
    place: EventPlace | None = None
    thumbnail: Thumbnail


class EventIngestQueue(WireModel):
    depth: int
    max: int
    high_water: int
    accepted: int
    processed: int
    failed: int
    coalesced: int
    dropped: int
    dropped_repeats: int
    dropped_shutdown: int


class EventIngest(WireModel):
    """The alert-stream listener's live state (services/events_ingest.STATE)."""
    connected: bool
    last_heartbeat_at: str | None
    last_event_at: str | None
    last_error: str | None
    reconnects: int
    events_stored: int
    started_at: str | None
    queue: EventIngestQueue
    ws_drops: int


class EventDerive(WireModel):
    """The recording-derived events job (services/events_derive.STATE)."""
    last_run: str | None
    last_ok: str | None
    last_error: str | None
    derived: int


class EventUnsupportedFilter(WireModel):
    """A filter that cannot match by construction, with the reason (T062)."""
    field: str
    value: str
    reason: str


class EventFilters(WireModel):
    applied: dict[str, str]
    unsupported: list[EventUnsupportedFilter]


class EventList(WireModel):
    events: list[EventListed]
    from_: str = Field(alias="from")
    to: str
    timezone: str
    types: list[str]
    filters: EventFilters
    ingest: EventIngest
    derive: EventDerive


class EventTypeCount(WireModel):
    type: str
    count: int


class EventSourceCount(WireModel):
    source: str
    count: int


class EventSeverityCount(WireModel):
    severity: str
    count: int


class EventUnavailableType(WireModel):
    type: str
    reason: str


class EventFacetZone(WireModel):
    id: str
    name: str
    kind: str
    cameras: int
    sensors: int


class EventFacetFloor(WireModel):
    id: str
    name: str
    cameras: int
    sensors: int
    zones: list[EventFacetZone]


class EventFacetBuilding(WireModel):
    id: str
    name: str
    floors: list[EventFacetFloor]


class EventFacetSite(WireModel):
    id: str
    name: str
    buildings: list[EventFacetBuilding]


class EventFacets(WireModel):
    """`GET /events/facets`: which search fields have data and why the others are empty (T062)."""
    days: int
    since: str
    types: list[EventTypeCount]
    sources: list[EventSourceCount]
    severities: list[EventSeverityCount]
    unavailable_types: list[EventUnavailableType]
    places: list[EventFacetSite]
    notes: list[str]


class EventToday(WireModel):
    total: int
    unacked: int
    by_type: dict[str, int]
    measured: int
    inferred: int


class EventSummary(WireModel):
    today: EventToday
    ingest: EventIngest
    derive: EventDerive


class EventSpotlightRule(WireModel):
    """One deterministic rule a window met (M047); `why` is the rule in the operator's words."""
    code: str
    score: int
    label: str
    why: str


class EventSpotlight(WireModel):
    on: bool
    score: int
    rules: list[EventSpotlightRule]
    confidence: Literal["measured", "inferred"]
    sources: list[str]


class EventWindow(WireModel):
    """A review window (design M26): adjacent events grouped; the raw events stay reachable by id."""
    id: str
    camera_id: str | None
    camera_name: str | None
    channel: int | None
    group: Literal["camera", "all", "zone", "floor", "manual"]
    group_label: str | None
    manual_group_id: str | None
    spotlight: EventSpotlight
    camera_ids: list[str]
    camera_names: list[str]
    start: str
    end: str
    count: int
    types: dict[str, int]
    dominant_type: str
    severity: str
    acked_count: int
    acked: bool
    first_event_id: str
    last_event_id: str
    event_ids: list[str]
    thumbnail: Thumbnail
    thumbnail_event_id: str
    confidence: Literal["measured", "inferred"]


class EventWindows(WireModel):
    windows: list[EventWindow]
    from_: str = Field(alias="from")
    to: str
    timezone: str
    gap_seconds: int
    group: Literal["camera", "all", "zone", "floor"]
    events_total: int
    spotlights: int
    spotlight_rules: list[EventSpotlightRule]
    ingest: EventIngest


class EventWindowGroup(WireModel):
    """`POST /events/windows/groups` (M047): the events that now form one window, and the ones skipped (unknown / out of scope)."""
    group_id: str
    event_ids: list[str]
    skipped: list[str]
    note: str


class EventAckMany(WireModel):
    acked: list[str]
    skipped: list[str]


class EventCameraDay(WireModel):
    """`GET /cameras/{id}/events`: the timeline markers of one camera and local day."""
    camera_id: str
    date: str
    timezone: str
    events: list[EventRow]


class EventLocation(WireModel):
    """Where the event's camera sits (its current anchor); `zone` is the smallest room / zone containing the pin."""
    anchor_id: str
    floor_id: str
    floor_name: str
    building_id: str
    building_name: str
    x: float
    y: float
    zone: str | None
    has_plan: bool


class EventDetail(EventRow):
    """`GET /events/{id}`: the event with its picture state, its camera's name and place, and the installation's time zone."""
    thumbnail: Thumbnail
    camera_name: str | None
    location: EventLocation | None
    timezone: str


class EventCorrelationSubject(WireModel):
    kind: Literal["camera", "entity", "system"]
    id: str | None


class EventCorrelationLocation(WireModel):
    floor_id: str
    floor_name: str
    building_name: str
    x: float
    y: float
    zone: str | None
    radius: float


class EventCorrelationEntity(WireModel):
    entity_id: str
    name: str
    domain: str
    device_class: str | None
    tracked_as: str | None
    state: str | None
    last_changed: str | None
    state_missing: bool
    distance: float | None
    same_zone: bool


class EventCorrelationCamera(WireModel):
    camera_id: str
    distance: float | None
    same_zone: bool


class EventCorrelationLink(WireModel):
    """A sensor transition, a command or a camera event within the window; the keys of the other kinds are absent."""
    kind: Literal["sensor", "command", "camera"]
    event_id: str = None
    action_id: str = None
    entity_id: str = None
    camera_id: str | None = None
    name: str
    type: str = None
    action: str = None
    status: str = None
    by: str | None = None
    at: str
    delta_s: float
    label: str
    certainty: str
    note: str


class EventCorrelationNote(WireModel):
    code: str
    text: str


class EventCorrelationEvent(WireModel):
    id: str
    type: str
    source: str
    camera_id: str | None
    camera_name: str | None
    occurred_at: str
    received_at: str
    confidence: str
    details: dict[str, Any]


class EventCorrelation(WireModel):
    """`GET /events/{id}/correlation` (T053): what nearby sensors, locks, commands and cameras reported within the window."""
    event_id: str
    window_s: int
    subject: EventCorrelationSubject
    spatial: bool
    location: EventCorrelationLocation | None
    entities: list[EventCorrelationEntity]
    cameras: list[EventCorrelationCamera]
    links: list[EventCorrelationLink]
    notes: list[EventCorrelationNote]
    policy: str
    event: EventCorrelationEvent


class EventRouteSubject(WireModel):
    camera_id: str
    name: str
    zone: str | None


class EventRouteLocation(WireModel):
    floor_id: str
    floor_name: str
    building_name: str


class EventRouteWindow(WireModel):
    from_: str = Field(alias="from")
    to: str


class EventRouteVia(WireModel):
    connector_id: str
    kind: str
    kind_label: str
    label: str | None
    floor_id: str
    floor_name: str
    direction: Literal["up", "down"] | None
    twin_published: bool


class EventRouteSuggestion(WireModel):
    camera_id: str
    name: str
    relation: Literal["same_zone", "adjacent_zone", "nearby", "via_connector"]
    relation_label: str
    distance: float
    zone: str | None
    floor_id: str
    floor_name: str
    via: EventRouteVia | None
    activity_events: int
    playback_at: str


class EventRouteConnector(WireModel):
    id: str
    kind: str
    kind_label: str
    other_floor_id: str
    distance: Num
    twin_published: bool


class EventRoute(WireModel):
    """`GET /events/{id}/route` (T064, M064): suggested next cameras - topology only, always hypothetical. `connectors` only when the
    event camera is placed on a plan."""
    event_id: str
    hypothetical: bool
    spatial: bool
    subject: EventRouteSubject | None
    location: EventRouteLocation | None
    window: EventRouteWindow
    suggestions: list[EventRouteSuggestion]
    notes: list[str]
    policy: str
    connectors: list[EventRouteConnector] = None
