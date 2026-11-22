"""Response models of the outgoing iCal feeds API (routers/calendar_feeds.py, `/api/v1/calendar/feeds...`; CALCONNECT-2330,
CAL-FEED-REVIEW-2351 round 14). A feed answer never carries its token; the address (`path`) is answered once, when it is issued or
renewed. Field order is the order the router builds its dicts in (`_out`)."""
from __future__ import annotations

from typing import Literal

from . import WireModel

# routes without a JSON body: none on `router` (the `<token>.ics` document lives on `public_router`)
NO_JSON: frozenset[str] = frozenset()


class CalFeed(WireModel):
    """One outgoing feed (`_out`, never the token)."""
    id: str
    calendar_ids: list[str]
    detail: Literal["busy", "titles"]
    """The stored choice (CHECK constraint)."""
    detail_effective: Literal["busy", "titles"]
    """Round 14 (4A): what the document really carries - always `busy` while `remote` is on."""
    created_at: str
    last_used_at: str | None
    revoked: bool
    remote: bool
    token_set_at: str
    expires_at: str | None
    """Round 14 (3C): when the current address stops answering (null = no expiry)."""
    can_remote: bool
    """Round 14 (2A): may THIS caller change the remote switch now."""


class CalFeedList(WireModel):
    feeds: list[CalFeed]
    enabled: bool
    local: bool
    """False on the remote channel, where the remote switch is refused."""
    default_max_age_days: int
    """The expiry a new or renewed address gets, in days (0 = no limit)."""


class CalFeedIssued(WireModel):
    """A new or renewed address: the feed and its document path (the only answer that carries the token)."""
    feed: CalFeed
    path: str


class CalFeedOne(WireModel):
    feed: CalFeed
