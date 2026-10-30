"""CALENDARS-298 section 12.2 - the provider-neutral sync interface.

An adapter is a PURE translator between Arx's neutral records and one provider. It never touches the Arx database and holds no
credential of its own: the engine hands it a `ConnectionInfo` / `Binding` (plain values) and takes back plain values. Real providers
(iCal, Google, Microsoft) are later phases and are NOT in this slice; the `FakeAdapter` (fake.py) is the reference implementation.

Two-way principle (owner, round 6): a calendar must stay editable outside Arx and Arx adapts to inbound changes. `pull` therefore
reports EVERY external create / edit / delete; the engine accepts them (settings permitting) and never reverts or deletes an entry
on its own: a collision keeps both entries and flags them for a human decision.
"""
from __future__ import annotations

import datetime as dt
from dataclasses import dataclass, field
from typing import Literal, Protocol

Provider = Literal["ics_out", "ics_in", "google", "microsoft"]
PROVIDERS: tuple[str, ...] = ("ics_out", "ics_in", "google", "microsoft")
# What each provider can do: ics_out publishes only, ics_in reads only, the account providers do both.
DIRECTIONS: dict[str, tuple[str, ...]] = {
    "ics_out": ("export",),
    "ics_in": ("import",),
    "google": ("export", "import", "two_way"),
    "microsoft": ("export", "import", "two_way"),
}
DETAILS = ("busy", "titles", "details")


class SyncError(Exception):
    """Base of every adapter failure. `code` is a short machine word shown on the connection (never a secret or a URL)."""

    code = "error"
    retry_after_s: int | None = None

    def __init__(self, message: str = "", *, code: str | None = None, retry_after_s: int | None = None) -> None:
        super().__init__(message or (code or self.code))
        if code:
            self.code = code
        if retry_after_s is not None:
            self.retry_after_s = retry_after_s


class NeedsReauth(SyncError):
    """The provider refused the stored authorisation: the connection owner must authorise again (no retry until then)."""

    code = "needs_reauth"


class RateLimited(SyncError):
    """The provider asked us to slow down; the engine backs off (at least `retry_after_s`)."""

    code = "rate_limited"


@dataclass(frozen=True)
class ConnectionInfo:
    id: str
    provider: str
    label: str
    scope: str  # read | read_write
    token_ref: str | None = None  # an opaque handle into the secrets store; the adapter resolves it itself


@dataclass(frozen=True)
class Binding:
    id: str
    calendar_id: str
    external_ref: str  # the provider's calendar id
    direction: str  # export | import | two_way
    detail: str  # busy | titles | details
    dedicated: bool
    calendar_name: str = ""


@dataclass(frozen=True)
class Health:
    state: Literal["ok", "needs_reauth", "error"]
    code: str | None = None


@dataclass(frozen=True)
class ExtCalendar:
    id_ref: str
    name: str
    can_write: bool
    is_primary: bool = False


@dataclass(frozen=True)
class ExtEvent:
    """One external event, already expanded to a single instance (a recurring provider event arrives as its instances; series import
    from the provider's RRULE is a later refinement - see the contract 12.4 note)."""

    ext_uid: str
    etag: str
    title: str
    start: dt.datetime  # UTC
    end: dt.datetime  # UTC
    notes: str = ""
    all_day: bool = False
    tz: str | None = None
    arx_id: str | None = None  # our marker (Google extendedProperties.private.arx_id / Graph extension / ICS X-ARX-ID) when we pushed it
    updated: dt.datetime | None = None
    status: Literal["confirmed", "cancelled"] = "confirmed"


@dataclass(frozen=True)
class ExtDeletion:
    ext_uid: str


@dataclass
class PullResult:
    changes: list[ExtEvent | ExtDeletion] = field(default_factory=list)
    next_token: str | None = None
    full_resync_required: bool = False  # the sync token is no longer valid (HTTP 410): the engine re-pulls the window from scratch


@dataclass(frozen=True)
class OutEvent:
    """What Arx publishes; built by ONE mapper per detail level (engine.map_out). Guests are never part of it."""

    arx_id: str
    title: str
    start: dt.datetime
    end: dt.datetime
    all_day: bool
    tz: str
    notes: str = ""
    location: str = ""
    rrule: str | None = None
    exdates: tuple[str, ...] = ()


@dataclass(frozen=True)
class PushResult:
    ext_uid: str
    etag: str


class SyncAdapter(Protocol):
    provider: str

    def health(self, connection: ConnectionInfo) -> Health: ...

    def list_calendars(self, connection: ConnectionInfo) -> list[ExtCalendar]: ...

    def pull(self, connection: ConnectionInfo, binding: Binding, since_token: str | None) -> PullResult: ...

    def push(self, connection: ConnectionInfo, binding: Binding, event: OutEvent, ext_uid: str | None, etag: str | None) -> PushResult: ...

    def delete(self, connection: ConnectionInfo, binding: Binding, ext_uid: str, etag: str | None) -> None: ...

    def revoke(self, connection: ConnectionInfo) -> None: ...
