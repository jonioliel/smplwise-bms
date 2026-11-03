"""Pure proposed feature time metadata; no authority or execution adapter.

OFF planners may use these normalizers after their own gate. Native signed
payloads, storage normalization, leases, actor rules and drivers are unchanged.
"""
from __future__ import annotations

from datetime import UTC, datetime
from typing import Any
from zoneinfo import ZoneInfo, ZoneInfoNotFoundError

from .models import AccessError, valid_period


def absolute_time(value: Any) -> datetime:
    if type(value) is not str or not 1 <= len(value) <= 128:
        raise AccessError("invalid_validity")
    try:
        point = datetime.fromisoformat(value)
        if point.tzinfo is None:
            raise ValueError
        point = point.astimezone(UTC)
        if not datetime(1970, 1, 1, tzinfo=UTC) <= point <= datetime(2037, 12, 31, 23, 59, 59, tzinfo=UTC):
            raise ValueError
        return point
    except (ValueError, OverflowError):
        raise AccessError("invalid_validity") from None


def window_intent(values: dict[str, Any]) -> dict[str, Any]:
    """Validate finite aware instants; preserve precision instead of widening.

    The zone is a validated display/planning zone, never permission to guess an
    ambiguous local boundary. A device/expiry guarantee needs separate evidence.
    """
    zone = values["timezone"]
    try:
        ZoneInfo(zone)
    except (ZoneInfoNotFoundError, ValueError, TypeError):
        raise AccessError("invalid_fields") from None
    # Reuse the existing validity domain/order checks, but not its seconds-only
    # serialization: flooring a fractional start could widen a door intent.
    valid_period(values["start"], values["end"])
    start, end = absolute_time(values["start"]), absolute_time(values["end"])
    precision = "microseconds" if start.microsecond or end.microsecond else "seconds"
    return {**values, "start": start.isoformat(timespec=precision), "end": end.isoformat(timespec=precision)}


def expiry_intent(values: dict[str, Any]) -> dict[str, Any]:
    """Canonical finite expiry only; this does not assert it is still future."""
    point = absolute_time(values["expiry"])
    return {**values, "expiry": point.isoformat(timespec="microseconds" if point.microsecond else "seconds")}
