"""Time helpers of the tickets area (CR-TK-TIMEUTIL-2436, review 01:F-06 and F-07).

Before this module the tickets services re-declared the same ISO formatting and parsing in 17 modules and resolved the
installation's zone in five implementations plus four wrappers. Each module now keeps its public name as an alias of a
helper here, so callers and the tests that patch a module's name do not move.

Formats: `iso_s` (seconds, `Z`; what `db.now_iso()` writes), `iso_ms` (milliseconds, `Z`; the outbox times, which sort
as text) and `iso_s_or_none`. All three are the product-wide helpers of `services/timeutil.py`.

Parsing - two rules for a stored value that carries no zone:

* `parse_utc`: a zone-less value is UTC (the rule of `db.now_iso()` and the target rule of the review).
* `parse_naive_local`: a zone-less value is the process's local time (`astimezone` on a naive value). This is what
  costs, handler links, intake, the outbox, the outgoing documents and the SLA parsers did, and they keep doing it until
  a read-only check on a lab database copy shows that no zone-less value is stored (MASTER_PLAN precondition). For every
  value the product writes (ending in `Z`) the two rules answer the same instant, so switching those aliases to
  `parse_utc` afterwards is a one-line change per module.

Both answer an aware UTC datetime, or None for an empty, non-text or malformed value.

Zone: `zone_named(name)` (an unknown, empty or unusable name is the default zone) and `zone_of(conn)` (the installation's
`time.zone` setting through `zone_named`).
"""
from __future__ import annotations

import datetime as dt
from typing import Any
from zoneinfo import ZoneInfo

from ..timeutil import DEFAULT_ZONE, ZONE_KEY, iso_or_none, iso_utc, iso_utc_ms

UTC = dt.timezone.utc

iso_s = iso_utc
iso_ms = iso_utc_ms
iso_s_or_none = iso_or_none

__all__ = ["DEFAULT_ZONE", "UTC", "iso_ms", "iso_s", "iso_s_or_none", "parse_naive_local", "parse_utc", "zone_named", "zone_of"]


def _fromiso(value: Any) -> dt.datetime | None:
    if not value or not isinstance(value, str):
        return None
    try:
        return dt.datetime.fromisoformat(value.replace("Z", "+00:00"))
    except ValueError:
        return None


def parse_utc(value: Any) -> dt.datetime | None:
    """ISO text -> aware UTC datetime; a zone-less value is UTC. None for an empty, non-text or malformed value."""
    v = _fromiso(value)
    if v is None:
        return None
    return (v if v.tzinfo else v.replace(tzinfo=UTC)).astimezone(UTC)


def parse_naive_local(value: Any) -> dt.datetime | None:
    """As `parse_utc`, but a zone-less value is the process's local time (the earlier rule of six modules, kept until the
    lab check; see the module note)."""
    v = _fromiso(value)
    return None if v is None else v.astimezone(UTC)


def zone_named(name: str | None) -> ZoneInfo:
    """The IANA zone of that name; an empty, unknown or unusable name is DEFAULT_ZONE."""
    try:
        return ZoneInfo(name or DEFAULT_ZONE)
    except Exception:  # noqa: BLE001 - an unknown zone name falls back to the product default
        return ZoneInfo(DEFAULT_ZONE)


def zone_of(conn: Any) -> ZoneInfo:
    """The installation's zone: the `time.zone` setting, DEFAULT_ZONE when it is missing, empty or unknown."""
    from ...db import get_setting  # lazy: this module stays a leaf of the tickets package

    return zone_named(get_setting(conn, ZONE_KEY, None))
