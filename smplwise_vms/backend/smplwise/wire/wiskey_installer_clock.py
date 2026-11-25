"""Response models of routers/wiskey_installer_clock.py (RESPONSE-MODELS-E-2480, code review 07:F8 step 2)."""
from __future__ import annotations

from typing import Any

from . import ExactModel, Num

# routes without a JSON body
NO_JSON: frozenset[str] = frozenset()
# JSON routes without a model yet: no test reaches a successful answer (or the answer is not one object); counted by the ratchet
# (scripts/wire_ratchet.py) until they are modelled
UNMODELLED: frozenset[str] = frozenset({'GET /access-control/installer/clock/stations/{station_id}', 'POST /access-control/installer/clock/host-apply', 'POST /access-control/installer/clock/stations/{station_id}/sync', 'PUT /access-control/installer/clock/settings'})


class WiskeyInstallerClockClockViewHostError(ExactModel):
    code: str
    wiskey_code: str
    message: str


class WiskeyInstallerClockClockViewHost(ExactModel):
    state: str
    error: WiskeyInstallerClockClockViewHostError | None
    fetched_at: Any
    data: Any


class WiskeyInstallerClockClockViewDefaults(ExactModel):
    server: str
    port: Num
    interval: Num


class WiskeyInstallerClockClockViewCooldowns(ExactModel):
    host_apply: Num


class WiskeyInstallerClockClockView(ExactModel):
    settings: dict[str, Any]
    host: WiskeyInstallerClockClockViewHost
    stations: Any
    feed: str
    defaults: WiskeyInstallerClockClockViewDefaults
    host_typed_phrase: str
    cooldowns: WiskeyInstallerClockClockViewCooldowns
