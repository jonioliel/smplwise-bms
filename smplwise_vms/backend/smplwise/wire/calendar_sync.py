"""Response models of the external calendar connections API (routers/calendar_sync.py, `/api/v1/calendar/connections...`, the bindings
and the sync flags; CALENDARS-298 phase 2, CALCONNECT-2330, contract sections 12, 13.5 and 15). No answer carries a secret, a token or an
external address: the connection's `setup` holds flags only. Field order is the order the router builds its dicts in."""
from __future__ import annotations

from typing import Any, Literal

from . import WireModel

# routes without a JSON body
NO_JSON = frozenset({"DELETE /calendar/connections/{cid}/authorize", "DELETE /calendar/connections/{cid}"})

# the CHECK constraints of migrations/0183_calendars.sql
Provider = Literal["ics_out", "ics_in", "google", "microsoft"]
ConnectionState = Literal["ok", "needs_reauth", "error", "paused", "revoked"]
Direction = Literal["export", "import", "two_way"]
Detail = Literal["busy", "titles", "details"]


class CalSyncUser(WireModel):
    """A user as the calendar module names one (services/calendar/calendars.user_label)."""
    id: str
    name: str


class CalSyncConnectionBinding(WireModel):
    id: str
    calendar_id: str
    direction: Direction
    detail: Detail
    dedicated: bool


class CalSyncSetup(WireModel):
    """What may be said about the connection's credentials: flags, never a value. `tenant` only for Microsoft (null otherwise);
    `pending_flow` = the provider of a consent in progress."""
    client_id_set: bool
    client_secret_set: bool
    authorized: bool
    feed_url_set: bool
    tenant: str | None
    ready: bool
    pending_flow: str | None


class CalSyncConnection(WireModel):
    id: str
    provider: Provider
    label: str
    scope: Literal["read", "read_write"]
    state: ConnectionState
    owner: CalSyncUser
    last_sync_at: str | None
    next_sync_at: str | None
    error_code: str | None
    adapter_available: bool
    account_hint: str | None
    bindings: list[CalSyncConnectionBinding]
    revision: int
    setup: CalSyncSetup = None
    """Absent only where a route builds the connection without the data folder (every route of this router gives it)."""


class CalSyncProvider(WireModel):
    provider: Provider
    adapter_available: bool


class CalSyncConnections(WireModel):
    connections: list[CalSyncConnection]
    providers: list[CalSyncProvider]
    setup_steps: dict[str, list[str]]
    """provider -> the owner's setup steps (English; the screen translates)."""
    google_redirect: str


class CalSyncConnectionAdded(WireModel):
    connection: CalSyncConnection
    setup_steps: list[str]


class CalSyncConnectionOut(WireModel):
    connection: CalSyncConnection


class CalSyncAuthorizeStart(WireModel):
    """Google: `flow: paste` with the authorize address to open; Microsoft: `flow: device` with the short code. The state / verifier /
    device code never leave the server."""
    flow: Literal["paste", "device"]
    authorize_url: str = None
    redirect_prefix: str = None
    user_code: str = None
    verification_url: str = None
    expires_in: int
    interval: int = None


class CalSyncAuthorizeResult(WireModel):
    """Google's completion, or one Microsoft poll: `state` (none | pending | slow_down | expired | connected), `interval` while pending,
    the connection once connected."""
    state: str
    interval: int = None
    connection: CalSyncConnection = None


class CalSyncExternalCalendar(WireModel):
    id_ref: str
    name: str
    can_write: bool
    is_primary: bool


class CalSyncExternalCalendars(WireModel):
    calendars: list[CalSyncExternalCalendar]


class CalSyncNow(WireModel):
    """A manual "sync now": the engine's report (counts and codes; services/calendar_sync/engine.py) and the connection after it."""
    report: dict[str, Any]
    connection: CalSyncConnection


class CalSyncBinding(WireModel):
    id: str
    connection_id: str
    calendar_id: str
    direction: Direction
    detail: Detail
    dedicated: bool


class CalSyncBindingOut(WireModel):
    """The calendar's binding after the change; null after a removal."""
    binding: CalSyncBinding | None


class CalSyncCalendarRef(WireModel):
    id: str
    name: str
    color: str | None


class CalSyncFlag(WireModel):
    event_id: str
    calendar: CalSyncCalendarRef
    title: str
    start: str
    end: str
    flag: str
    source: str
    state: str
    revision: int


class CalSyncFlags(WireModel):
    flags: list[CalSyncFlag]


class CalSyncResolved(WireModel):
    event_id: str
    state: str
    sync_flag: str | None
