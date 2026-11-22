"""Response models of routers/intercom_listen.py (RESPONSE-MODELS-E-2480, code review 07:F8 step 2)."""
from __future__ import annotations

from typing import Any

from . import ExactModel, Num

# routes without a JSON body
NO_JSON: frozenset[str] = frozenset()
# JSON routes without a model yet: no test reaches a successful answer (or the answer is not one object); counted by the ratchet
# (scripts/wire_ratchet.py) until they are modelled
UNMODELLED: frozenset[str] = frozenset({'POST /access-control/listen/{session_id}/stop'})


class IntercomListenListenCapability(ExactModel):
    """`available` false with a short `reason`: `off` (the setting), `forbidden` (no `access.call` on the station), `feed`, `offline`, `unavailable`, `unsupported` (this provider has no downlink), `no_listen` (the station does not say it can be li"""
    station_id: str
    available: bool
    reason: Any
    codec: str
    sample_rate: Num
    frame_ms: Num
    max_seconds: Num
    listeners: Num


class IntercomListenListenStart(ExactModel):
    """Reserves a listen session for the caller."""
    session: str
    ws_path: str
    expires_at: str
    max_seconds: Num
    attach_within_s: Num
    codec: str
    sample_rate: Num
    frame_ms: Num
    request_id: str
