"""Response models of routers/intercom_media.py (RESPONSE-MODELS-E-2480, code review 07:F8 step 2)."""
from __future__ import annotations

from typing import Any

from . import ExactModel, Num

# routes without a JSON body
NO_JSON: frozenset[str] = frozenset({'GET /access-control/stations/{station_id}/thumbnail.jpg'})
# JSON routes without a model yet: no test reaches a successful answer (or the answer is not one object); counted by the ratchet
# (scripts/wire_ratchet.py) until they are modelled
UNMODELLED: frozenset[str] = frozenset()


class IntercomMediaStationMediaVideoProfile(ExactModel):
    id: str
    codec: str
    transports: list[str]
    width: Num | None
    height: Num | None
    fps: Num | None


class IntercomMediaStationMediaVideoPaths(ExactModel):
    main: str = None
    sub: str = None


class IntercomMediaStationMediaVideoTransportPlans(ExactModel):
    main: str
    sub: str = None


class IntercomMediaStationMediaVideoTransport(ExactModel):
    choice: str
    source: str
    channel: str
    order: list[str]
    plans: IntercomMediaStationMediaVideoTransportPlans


class IntercomMediaStationMediaVideo(ExactModel):
    profiles: list[IntercomMediaStationMediaVideoProfile]
    default_profile: str
    allowed: bool
    paths: IntercomMediaStationMediaVideoPaths
    max_viewers: Num
    viewers: Num
    transport: IntercomMediaStationMediaVideoTransport = None


class IntercomMediaStationMediaTalk(ExactModel):
    available: bool
    reason: str | None
    transport: str = None
    codec: str = None
    duplex: str = None
    max_seconds: Num = None
    sample_rate: Num = None
    frame_ms: Num = None
    busy: bool = None


class IntercomMediaStationMedia(ExactModel):
    """`state`: `off` (the setting; the drawer keeps the still and the classic panel), `unavailable` (+ `reason`: `feed`, `offline`, `no_camera`, `no_media`, `no_host`, `no_credentials`, `descriptor_*`, `provider_error`) or `ready`."""
    station_id: str
    mode: str
    state: str
    reason: str | None
    video: IntercomMediaStationMediaVideo | None
    talk: IntercomMediaStationMediaTalk | None
    listen: bool
    expires_at: str | None


class IntercomMediaStationMediaReadinessWiskeyCapabilities(ExactModel):
    state: str
    video_listed: bool
    talk_listed: bool
    reason: str | None
    reason_kind: Any
    source: Any
    read_at: Any


class IntercomMediaStationMediaReadinessWiskey(ExactModel):
    reachable: bool
    video_listed: bool
    talk_listed: bool
    signing: bool
    listed_in: Any
    capabilities: IntercomMediaStationMediaReadinessWiskeyCapabilities


class IntercomMediaStationMediaReadiness(ExactModel):
    """WISKEY-TALK-DIAL-2382: whether the stations screen's video and talk can come from WisKey (`access.station_media_provider = auto`) and every reason they cannot (`missing`: `wiskey_unreachable`, `api_incompatible`, `video_not_listed`, `talk_n"""
    choice: str
    active: str
    mode: str
    wiskey: IntercomMediaStationMediaReadinessWiskey
    missing: list[str]
    video_ready: bool
    talk_ready: bool


class IntercomMediaTalkStart(ExactModel):
    """Reserves the station's talker slot for the caller."""
    session: str
    ws_path: str
    expires_at: str
    max_seconds: Num
    attach_within_s: Num
    transport: str
    codec: str
    duplex: str
    sample_rate: Num
    frame_ms: Num
    request_id: str


class IntercomMediaTalkStop(ExactModel):
    """Ends the caller's own talk session (idempotent); another user's session answers 404 `intercom_talk_not_found`."""
    stopped: bool
