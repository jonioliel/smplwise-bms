"""TimeAdapter for the Hikvision NVR (chapter 20, T014, KNOWN_QUIRKS T2/T4).

The NVR's search API reads and writes *local wall clock* digits and ignores the `Z` suffix. Internally
everything is UTC; the conversion uses the IANA zone configured for the installation, per instant
(so DST is right on both sides of the boundary). Raw device strings are kept next to the converted
values wherever they are stored, so a mistake here is auditable rather than silent.
"""
from __future__ import annotations

import datetime as dt
from zoneinfo import ZoneInfo, ZoneInfoNotFoundError

UTC = dt.timezone.utc


def zone(name: str) -> ZoneInfo:
    try:
        return ZoneInfo(name)
    except (ZoneInfoNotFoundError, ValueError):
        return ZoneInfo("Asia/Jerusalem")


def parse_utc(value: str) -> dt.datetime:
    """'2026-09-14T07:28:12Z' (or with offset) → aware UTC datetime. Naive input is refused."""
    v = value.strip()
    if v.endswith("Z"):
        v = v[:-1] + "+00:00"
    parsed = dt.datetime.fromisoformat(v)
    if parsed.tzinfo is None:
        raise ValueError("timestamp without timezone")
    return parsed.astimezone(UTC)


def iso_utc(value: dt.datetime) -> str:
    return value.astimezone(UTC).replace(microsecond=0).isoformat().replace("+00:00", "Z")


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
