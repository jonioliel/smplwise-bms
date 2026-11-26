"""Response models of routers/cast.py (RESPONSE-MODELS-E-2480, code review 07:F8 step 2)."""
from __future__ import annotations

from typing import Any

from . import ExactModel, Num

# routes without a JSON body
NO_JSON: frozenset[str] = frozenset()
# JSON routes without a model yet: no test reaches a successful answer (or the answer is not one object); counted by the ratchet
# (scripts/wire_ratchet.py) until they are modelled
UNMODELLED: frozenset[str] = frozenset({'POST /multimedia/cast/sessions', 'POST /multimedia/cast/sessions/{session_id}/switch', 'POST /multimedia/cast/test'})


class CastConfigRelay(ExactModel):
    option: bool
    listening: bool
    container_port: Num
    error: Any


class CastConfigBridge(ExactModel):
    paired: bool
    version: str | None
    required: str
    ready: bool


class CastConfig(ExactModel):
    config: dict[str, Any]
    relay: CastConfigRelay
    bridge: CastConfigBridge
    ready: bool
    reason: str | None


class CastPutConfigBridge(ExactModel):
    paired: bool
    version: str
    required: str
    ready: bool


class CastPutConfig(ExactModel):
    changed: list[str]
    config: dict[str, Any]
    relay: CastConfigRelay
    bridge: CastPutConfigBridge
    ready: bool
    reason: str | None


class CastCheckOrigin(ExactModel):
    ok: bool
    reason: Any


class CastAdminScreensScreenDetected(ExactModel):
    method: str
    confidence: str
    via: str | None
    reason: str


class CastAdminScreensScreenEffective(ExactModel):
    method: str
    confidence: str
    reason: str


class CastAdminScreensScreen(ExactModel):
    key: str
    name: str
    kind: str
    approved: bool
    public: bool
    floor_name: str
    area_name: str
    detected: CastAdminScreensScreenDetected
    effective: CastAdminScreensScreenEffective
    target_entity_id: str | None
    settings: dict[str, Any]
    casting_session_id: Any


class CastAdminScreens(ExactModel):
    screens: list[CastAdminScreensScreen]


class CastPutScreen(ExactModel):
    key: str
    settings: dict[str, Any]
    changed: list[str]


class CastTargetsTarget(ExactModel):
    key: str
    name: str
    kind: str
    floor_id: str
    floor_name: str
    area_name: str
    state: str
    blocked: str | None
    confidence: str
    permanent_allowed: bool
    minutes: Num
    main_allowed: bool
    casting_session_id: str | None


class CastTargets(ExactModel):
    ready: bool
    reason: str | None
    targets: list[CastTargetsTarget]
    blocked_display: str
    main_possible: bool
    max_sessions: Num
    active: Num


class CastSessionsSessionCan(ExactModel):
    stop: bool
    extend: bool
    switch: bool


class CastSessionsSession(ExactModel):
    session_id: str
    device_key: str
    screen_name: str
    floor_name: str
    area_name: str
    kind: str
    camera_id: str
    camera_name: str
    profile: str
    state: str
    started_at: str
    expires_at: str | None  # CAST-RELAY-HARDEN-2540: None = a permanent cast (the model was drawn from timed casts only)
    permanent: bool
    extended_n: Num
    extensions_left: Num
    first_segment_at: Any
    started_by_name: str
    mine: bool
    channel: str
    stopped_at: Any
    stop_reason: Any
    power_off_after: bool
    power_off_state: Any
    can: CastSessionsSessionCan


class CastSessions(ExactModel):
    sessions: list[CastSessionsSession]
    max_sessions: Num


class CastSession(ExactModel):
    session_id: str
    device_key: str
    screen_name: str
    floor_name: str
    area_name: str
    kind: str
    camera_id: str
    camera_name: str
    profile: str
    state: str
    started_at: str
    expires_at: str | None  # CAST-RELAY-HARDEN-2540: None = a permanent cast (the model was drawn from timed casts only)
    permanent: bool
    extended_n: Num
    extensions_left: Num
    first_segment_at: str | None
    started_by_name: str
    mine: bool
    channel: str
    stopped_at: str | None
    stop_reason: str | None
    power_off_after: bool
    power_off_state: str | None
    can: CastSessionsSessionCan


class CastStopSessionSession(ExactModel):
    session_id: str
    device_key: str
    screen_name: str
    floor_name: str
    area_name: str
    kind: str
    camera_id: str
    camera_name: str
    profile: str
    state: str
    started_at: str
    expires_at: str | None
    permanent: bool
    extended_n: Num
    extensions_left: Num
    first_segment_at: str | None
    started_by_name: str
    mine: bool
    channel: str
    stopped_at: str
    stop_reason: str
    power_off_after: bool
    power_off_state: str | None
    can: CastSessionsSessionCan


class CastStopSession(ExactModel):
    status: str
    stop: str
    power_off: str | None
    session: CastStopSessionSession
