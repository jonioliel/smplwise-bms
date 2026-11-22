"""Response models of routers/transit.py (RESPONSE-MODELS-E-2480, code review 07:F8 step 2)."""
from __future__ import annotations

from typing import Any

from . import ExactModel, Num

# routes without a JSON body
NO_JSON: frozenset[str] = frozenset()
# JSON routes without a model yet: no test reaches a successful answer (or the answer is not one object); counted by the ratchet
# (scripts/wire_ratchet.py) until they are modelled
UNMODELLED: frozenset[str] = frozenset()


class TransitSettingsCatalogue(ExactModel):
    count: Num
    date: str | None
    ok_at: str | None
    error: Any
    error_at: Any


class TransitSettingsHealth(ExactModel):
    enabled: bool
    state: str
    outage: bool
    outage_since: Any
    outage_warn_h: Num
    last_good_at: str | None
    codes_in_use: Num
    age_s: Any
    last_ok_at: str | None
    errors: Num
    consecutive_errors: Num
    last_error: Any
    last_error_at: Any
    backoff_until: Any


class TransitSettingsLimits(ExactModel):
    max_stops: Num
    windows: list[Num]
    window_range: list[Num]
    rows_range: list[Num]
    dwell_range: list[Num]
    clock_after_range: list[Num]
    grace_range: list[Num]
    walk_range: list[Num]
    outage_warn_range: list[Num]
    poll_range: list[Num]
    poll_floor_s: Num
    refresh_range: list[Num]
    position_fresh_range: list[Num]
    layouts: list[str]
    groups: list[str]


class TransitSettingsCan(ExactModel):
    configure: bool
    boards: bool


class TransitSettings(ExactModel):
    config: dict[str, Any]
    catalogue: TransitSettingsCatalogue
    health: TransitSettingsHealth
    limits: TransitSettingsLimits
    can: TransitSettingsCan


class TransitPutSettingsHealth(ExactModel):
    enabled: bool
    state: str
    outage: bool
    outage_since: str | None
    outage_warn_h: Num
    last_good_at: str | None
    codes_in_use: Num
    age_s: Num | None
    last_ok_at: str | None
    errors: Num
    consecutive_errors: Num
    last_error: str | None
    last_error_at: str | None
    backoff_until: str | None


class TransitPutSettings(ExactModel):
    config: dict[str, Any]
    catalogue: TransitSettingsCatalogue
    health: TransitPutSettingsHealth
    limits: TransitSettingsLimits
    can: TransitSettingsCan


class TransitCities(ExactModel):
    cities: list[str]


class TransitSearchStopsStop(ExactModel):
    code: Num
    name: str
    city: str
    lat: Num
    lon: Num


class TransitSearchStops(ExactModel):
    """The search runs on the LOCAL catalogue (city exact, name words, or a code) - no third-party call."""
    stops: list[TransitSearchStopsStop]
    catalogue: TransitSettingsCatalogue


class TransitStatusHealth(ExactModel):
    enabled: bool
    state: str
    outage: bool
    outage_since: str | None
    outage_warn_h: Num
    last_good_at: Any
    codes_in_use: Num
    age_s: Any
    last_ok_at: Any
    errors: Num
    consecutive_errors: Num
    last_error: str | None
    last_error_at: str | None
    backoff_until: str | None


class TransitStatus(ExactModel):
    health: TransitStatusHealth
    catalogue: TransitSettingsCatalogue


class TransitRefreshCatalogue(ExactModel):
    """Download the catalogue now (the nightly job does it by itself)."""
    started: bool
    running: bool


class TransitCheckNowCheck(ExactModel):
    codes: Num
    fetched: Num
    ok: bool
    error: str | None
    skipped: str | None
    retry_after_s: Num | None
    at: str


class TransitCheckNowHealth(ExactModel):
    enabled: bool
    state: str
    outage: bool
    outage_since: str | None
    outage_warn_h: Num
    last_good_at: str | None
    codes_in_use: Num
    age_s: Any
    last_ok_at: str | None
    errors: Num
    consecutive_errors: Num
    last_error: str | None
    last_error_at: str | None
    backoff_until: str | None


class TransitCheckNow(ExactModel):
    """Ask the source ONCE now for the configured stops and answer the new health (`system.configure`, audited `transit.check`, one check per 30 s per installation)."""
    check: TransitCheckNowCheck
    health: TransitCheckNowHealth
