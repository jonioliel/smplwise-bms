"""Response models of routers/intercom_calls.py (RESPONSE-MODELS-E-2480, code review 07:F8 step 2)."""
from __future__ import annotations

from typing import Any

from . import ExactModel, Num

# routes without a JSON body
NO_JSON: frozenset[str] = frozenset()
# JSON routes without a model yet: no test reaches a successful answer (or the answer is not one object); counted by the ratchet
# (scripts/wire_ratchet.py) until they are modelled
UNMODELLED: frozenset[str] = frozenset()


class IntercomCallsActiveCallsCall(ExactModel):
    call_id: str
    station_id: str
    station_name: str
    state: str
    rang_at: str
    answered_at: str | None
    answered_by_me: bool
    elapsed_s: Num
    online: bool
    has_camera: bool
    still: bool
    can_open_door: bool
    locks: list[dict[str, Any]]


class IntercomCallsActiveCalls(ExactModel):
    """`{enabled, mode, feed, sound, sound_reason, server_time_ms, calls: [...]}`."""
    enabled: bool
    mode: str
    calls: list[IntercomCallsActiveCallsCall]
    sound: str
    sound_reason: str | None
    feed: str
    server_time_ms: Num


class IntercomCallsCallLogCall(ExactModel):
    id: str
    station_id: str
    station_name: str
    rang_at: str
    observed: str
    state: str
    outcome: str | None
    answered_at: str | None
    answered_via: str | None
    answered_by_name: str | None
    ended_at: str | None
    ended_by_name: str | None
    door_opened_at: str | None
    door_opened_by_name: str | None
    updated_at: str
    answered_by_me: bool


class IntercomCallsCallLog(ExactModel):
    """The call log, newest first."""
    calls: list[IntercomCallsCallLogCall]
    next: Any
    retention_days: Num


class IntercomCallsCallSettingsRole(ExactModel):
    id: str
    name: str


class IntercomCallsCallSettingsDefaults(ExactModel):
    mode: str
    roles: list[Any]
    stations: list[Any]
    sound: bool


class IntercomCallsCallSettings(ExactModel):
    settings: dict[str, Any]
    roles: list[IntercomCallsCallSettingsRole]
    stations: list[IntercomCallsCallSettingsRole]
    defaults: IntercomCallsCallSettingsDefaults
