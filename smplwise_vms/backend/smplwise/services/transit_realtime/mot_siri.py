"""Adapter 2: Ministry of Transport SIRI-SM (stop monitoring) JSON. UNVERIFIED AGAINST THE LIVE FEED: the feed needs an
owner-requested access key and an allow-listed server IP (see docs/design/BUS_REALTIME_NOTE.md); nobody has run this
against it. The parser follows the public SIRI SM structure (MonitoredStopVisit -> MonitoredVehicleJourney ->
MonitoredCall.ExpectedArrivalTime) and is tolerant (missing fields skip the visit, never raise). The first real
response must be recorded and turned into a fixture before this adapter is enabled.

The HTTP request itself (URL, key placement, proxy) is NOT built here: the deployment supplies `request(stop_code)`
returning the parsed JSON document, so the key never enters code, tests or logs of this module."""
from __future__ import annotations

from collections.abc import Callable, Sequence
from datetime import datetime, timezone
from typing import Any

from .model import Observation, ScheduledArrival


def _dt(s: Any) -> datetime | None:
    if not isinstance(s, str) or not s:
        return None
    try:
        d = datetime.fromisoformat(s.replace("Z", "+00:00"))
    except ValueError:
        return None
    return d.astimezone(timezone.utc) if d.tzinfo else d.replace(tzinfo=timezone.utc)


def parse_stop_monitoring(doc: Any, stop_code: int) -> list[Observation]:
    out: list[Observation] = []
    try:
        deliveries = doc["Siri"]["ServiceDelivery"]["StopMonitoringDelivery"]
    except (KeyError, TypeError):
        return out
    if isinstance(deliveries, dict):
        deliveries = [deliveries]
    for dl in deliveries or []:
        for visit in (dl or {}).get("MonitoredStopVisit") or []:
            try:
                mvj = visit["MonitoredVehicleJourney"]
                call = mvj.get("MonitoredCall") or {}
                if str(call.get("StopPointRef", stop_code)) != str(stop_code):
                    continue
                line_ref = int(mvj["LineRef"])
                start = _dt(mvj.get("OriginAimedDepartureTime"))
                rec = _dt(visit.get("RecordedAtTime"))
                if start is None or rec is None:
                    continue
                cancelled = bool(mvj.get("Cancellation") or call.get("Cancellation"))
                out.append(Observation(line_ref=line_ref, ride_start=start, recorded_at=rec, expected=_dt(call.get("ExpectedArrivalTime")),
                                       cancelled=cancelled, vehicle_ref=str(mvj["VehicleRef"]) if mvj.get("VehicleRef") is not None else None,
                                       origin="mot_siri"))
            except (KeyError, TypeError, ValueError):
                continue
    return out


class MotSiriSource:
    name = "mot_siri"

    def __init__(self, request: Callable[[int], Any]):
        self._request = request

    def fetch(self, stop_code: int, now: datetime, rides: Sequence[ScheduledArrival]) -> list[Observation]:
        return parse_stop_monitoring(self._request(stop_code), stop_code)
