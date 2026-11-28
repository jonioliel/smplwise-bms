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
    """The IANA zone of that name; an unknown, malformed or unusable name is DEFAULT_ZONE. OSError (CR-W2-FOLLOWUPS-2441, lead
    decision 14.11): a name that is a tzdata DIRECTORY ("Asia") is not "not found" for zoneinfo - opening it raises
    PermissionError / IsADirectoryError, which went up to the caller as a 500."""
    try:
        return ZoneInfo(name)
    except (ZoneInfoNotFoundError, ValueError, OSError):
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


def epoch_or_none(iso: str | None) -> float | None:
    """A stored instant as Unix seconds; None for no value or one that does not parse (CR-BE-TWINS-2440: the `_ts` of
    temperature_explain, temperature_runtime and water_runtime)."""
    if not iso:
        return None
    try:
        return parse_utc(iso).timestamp()
    except (ValueError, TypeError):
        return None


def utc_to_nvr_wall(value: dt.datetime, tz: ZoneInfo) -> str:
    """UTC → the NVR's search format: local wall clock digits with a (meaningless) Z suffix."""
    local = value.astimezone(tz).replace(microsecond=0, tzinfo=None)
    return local.isoformat() + "Z"


def nvr_wall_to_utc(value: str, tz: ZoneInfo) -> dt.datetime:
    """NVR result time ('2026-09-14T10:24:36Z', local wall clock) → UTC. In the autumn fold hour the
    earlier instant is chosen; in the spring gap the time is shifted forward like the NVR does."""
    return _naive_wall(value).replace(tzinfo=tz, fold=0).astimezone(UTC)


def _naive_wall(value: str) -> dt.datetime:
    v = value.strip()
    if v.endswith("Z"):
        v = v[:-1]
    if "+" in v[10:]:
        v = v[: v.index("+", 10)]
    return dt.datetime.fromisoformat(v)


def wall_is_repeated(naive: dt.datetime, tz: ZoneInfo) -> bool:
    """FIX-VIDEO2-2570 (VD2-04): True when the local wall time names TWO instants (the hour the autumn clock change repeats).
    A time in the spring gap names none (its two `fold` readings differ too, but neither reads back to the same wall time)."""
    first, second = naive.replace(tzinfo=tz, fold=0), naive.replace(tzinfo=tz, fold=1)
    if first.utcoffset() == second.utcoffset():
        return False
    return first.astimezone(UTC).astimezone(tz).replace(tzinfo=None) == naive


def instant_in_repeated_hour(value: dt.datetime, tz: ZoneInfo) -> bool:
    """True when the instant's local wall time also names another instant (VD2-04): a recorder addressed by wall-clock digits
    (search, RTSP playback, quirk T4) cannot tell the two occurrences apart."""
    return wall_is_repeated(value.astimezone(tz).replace(tzinfo=None, microsecond=0), tz)


def nvr_span_to_utc(start_raw: str, end_raw: str, tz: ZoneInfo, lo: dt.datetime | None = None,
                    hi: dt.datetime | None = None) -> tuple[dt.datetime, dt.datetime, bool] | None:
    """FIX-VIDEO2-2570 (VD2-04): a recorder file's wall-clock start / end -> (start UTC, end UTC, ambiguous). A wall time in the
    hour the autumn change repeats names two instants, so a file touching it has up to four readings. Only readings whose end is after
    their start count (a file from 01:40 to 01:20 crosses the change: it ends on the second occurrence); of those the shortest wins,
    then the earliest - the first one that overlaps [lo, hi) when a window is given (a search inside the second occurrence finds
    the files of that occurrence), else the first. `ambiguous` = an end named two instants, so the answer is a guess the caller
    must report. None = no reading ends after it starts (a malformed file)."""
    s_naive, e_naive = _naive_wall(start_raw), _naive_wall(end_raw)
    s_amb, e_amb = wall_is_repeated(s_naive, tz), wall_is_repeated(e_naive, tz)
    starts = [s_naive.replace(tzinfo=tz, fold=f).astimezone(UTC) for f in ((0, 1) if s_amb else (0,))]
    ends = [e_naive.replace(tzinfo=tz, fold=f).astimezone(UTC) for f in ((0, 1) if e_amb else (0,))]
    valid = sorted(((s, e) for s in starts for e in ends if e > s), key=lambda p: (p[1] - p[0], p[0]))
    if not valid:
        return None
    if lo is not None and hi is not None:
        for s, e in valid:
            if e > lo and s < hi:
                return s, e, s_amb or e_amb
    s, e = valid[0]
    return s, e, s_amb or e_amb


def compact_wall(value: dt.datetime, tz: ZoneInfo) -> str:
    """RTSP playback time: YYYYMMDDTHHMMSSZ in local wall clock (quirk T4)."""
    local = value.astimezone(tz).replace(microsecond=0)
    return local.strftime("%Y%m%dT%H%M%SZ")


def local_day_bounds(day: dt.date, tz: ZoneInfo) -> tuple[dt.datetime, dt.datetime]:
    """[00:00, 24:00) of a local day as UTC instants (23/25-hour days handled by the zone rules)."""
    start = dt.datetime.combine(day, dt.time(0, 0), tzinfo=tz)
    end = dt.datetime.combine(day + dt.timedelta(days=1), dt.time(0, 0), tzinfo=tz)
    return start.astimezone(UTC), end.astimezone(UTC)
