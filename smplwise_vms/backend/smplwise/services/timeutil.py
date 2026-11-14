"""TimeAdapter for the Hikvision NVR (chapter 20, T014, KNOWN_QUIRKS T2/T4).

The NVR's search API reads and writes *local wall clock* digits and ignores the `Z` suffix. Internally
everything is UTC; the conversion uses the IANA zone configured for the installation, per instant
(so DST is right on both sides of the boundary). Raw device strings are kept next to the converted
values wherever they are stored, so a mistake here is auditable rather than silent.

CR-TIMEUTIL-2436 (review 04:F14, F15): the one place for the product's UTC ISO text (`iso_utc`, `iso_utc_ms`,
`iso_from_epoch`, the `*_or_none` forms) and for the installation's time zone (`DEFAULT_ZONE`, `site_zone_name`,
`site_zone`). Modules that had their own copy keep their local name as an alias of these, so callers and the tests that
patch them do not move. Formats that really differ stay local: microseconds (`bridge_keys`, `wiskey_write_lineage`),
the two that skip `astimezone` (`backup_drill`, `offbox_restore`), `+00:00` suffixes and `time.gmtime` truncation.
"""
from __future__ import annotations

import datetime as dt
import sqlite3
from zoneinfo import ZoneInfo, ZoneInfoNotFoundError

UTC = dt.timezone.utc

# The installation's IANA zone when none is stored (= settings_store.DEFAULTS["time.zone"]; a test keeps them equal).
DEFAULT_ZONE = "Asia/Jerusalem"
ZONE_KEY = "time.zone"


def zone(name: str) -> ZoneInfo:
    try:
        return ZoneInfo(name)
    except (ZoneInfoNotFoundError, ValueError):
        return ZoneInfo(DEFAULT_ZONE)


def site_zone_name(conn: sqlite3.Connection) -> str:
    """The stored `time.zone` text, DEFAULT_ZONE when there is no row or it is empty / NULL. Not validated: a caller that
    needs a ZoneInfo uses `site_zone` (an unknown name falls back to the default there)."""
    from ..db import get_setting  # lazy: this module stays free of package imports

    return get_setting(conn, ZONE_KEY, DEFAULT_ZONE) or DEFAULT_ZONE


def site_zone(conn: sqlite3.Connection) -> ZoneInfo:
    """The installation's zone as a ZoneInfo; an unknown or malformed name is DEFAULT_ZONE (the rule of `zone`)."""
    return zone(site_zone_name(conn))


def parse_utc(value: str) -> dt.datetime:
    """'2026-09-14T07:28:12Z' (or with offset) → aware UTC datetime. Naive input is refused, and so is an instant the
    conversion cannot represent (9999-12-31T23:59:59-01:00 overflows): both are a ValueError, so a route that answers
    a ValueError with 422 does so for both instead of a 500 (R-T7b-1)."""
    v = value.strip()
    if v.endswith("Z"):
        v = v[:-1] + "+00:00"
    parsed = dt.datetime.fromisoformat(v)
    if parsed.tzinfo is None:
        raise ValueError("timestamp without timezone")
    try:
        return parsed.astimezone(UTC)
    except OverflowError as exc:
        raise ValueError("timestamp out of range") from exc


def iso_utc(value: dt.datetime) -> str:
    """'2026-09-14T07:28:12Z': whole seconds (sub-second digits are dropped, never rounded). A naive value is read as
    the process's local time by `astimezone` - every caller hands an aware value."""
    return value.astimezone(UTC).replace(microsecond=0).isoformat().replace("+00:00", "Z")


def iso_or_none(value: dt.datetime | None) -> str | None:
    return None if value is None else iso_utc(value)


def iso_utc_ms(value: dt.datetime) -> str:
    """'2026-09-14T07:28:12.345Z': milliseconds, truncated (not rounded) from the microseconds."""
    return value.astimezone(UTC).strftime("%Y-%m-%dT%H:%M:%S.%f")[:-3] + "Z"


def iso_from_epoch(ts: float) -> str:
    """A Unix time in seconds -> iso_utc text. `fromtimestamp` rounds to the microsecond first, then the second is
    truncated - the rule of every helper this replaced (unlike `time.gmtime`, which truncates the float directly)."""
    return iso_utc(dt.datetime.fromtimestamp(ts, UTC))


def iso_from_epoch_or_none(ts: float | None) -> str | None:
    return None if ts is None else iso_from_epoch(ts)


def utc_to_nvr_wall(value: dt.datetime, tz: ZoneInfo) -> str:
    """UTC → the NVR's search format: local wall clock digits with a (meaningless) Z suffix."""
    local = value.astimezone(tz).replace(microsecond=0, tzinfo=None)
    return local.isoformat() + "Z"


def nvr_wall_to_utc(value: str, tz: ZoneInfo) -> dt.datetime:
    """NVR result time ('2026-09-14T10:24:36Z', local wall clock) → UTC. In the autumn fold hour the
    earlier instant is chosen; in the spring gap the time is shifted forward like the NVR does."""
    v = value.strip()
    if v.endswith("Z"):
        v = v[:-1]
    if "+" in v[10:]:
        v = v[: v.index("+", 10)]
    naive = dt.datetime.fromisoformat(v)
    return naive.replace(tzinfo=tz, fold=0).astimezone(UTC)


def compact_wall(value: dt.datetime, tz: ZoneInfo) -> str:
    """RTSP playback time: YYYYMMDDTHHMMSSZ in local wall clock (quirk T4)."""
    local = value.astimezone(tz).replace(microsecond=0)
    return local.strftime("%Y%m%dT%H%M%SZ")


def local_day_bounds(day: dt.date, tz: ZoneInfo) -> tuple[dt.datetime, dt.datetime]:
    """[00:00, 24:00) of a local day as UTC instants (23/25-hour days handled by the zone rules)."""
    start = dt.datetime.combine(day, dt.time(0, 0), tzinfo=tz)
    end = dt.datetime.combine(day + dt.timedelta(days=1), dt.time(0, 0), tzinfo=tz)
    return start.astimezone(UTC), end.astimezone(UTC)
