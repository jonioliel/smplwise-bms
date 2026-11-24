"""Response models of routers/camera_sources.py (RESPONSE-MODELS-E-2480, code review 07:F8 step 2)."""
from __future__ import annotations

from typing import Any

from . import ExactModel, Num

# routes without a JSON body
NO_JSON: frozenset[str] = frozenset()
# JSON routes without a model yet: no test reaches a successful answer (or the answer is not one object); counted by the ratchet
# (scripts/wire_ratchet.py) until they are modelled
UNMODELLED: frozenset[str] = frozenset()


class CameraSourcesSourceMain(ExactModel):
    url: str
    has_password: bool


class CameraSourcesSourceProbeMain(ExactModel):
    codec: str
    width: Num
    height: Num
    at: str


class CameraSourcesSourceProbe(ExactModel):
    main: CameraSourcesSourceProbeMain = None


class CameraSourcesSourceHealth(ExactModel):
    state: str
    code: Any
    checked_at: str | None
    ok_at: str | None
    since: Any


class CameraSourcesSourceCapabilities(ExactModel):
    live: bool
    snapshot: bool
    recording: bool
    playback: bool
    events: bool
    reboot: bool


class CameraSourcesSource(ExactModel):
    """The camera's video source (never an address: the masked form and `has_password`)."""
    camera_id: str
    mode: str
    origin: str | None = None  # ONVIF-CLIENT-2500: manual | onvif; null on the recorder (declared at the RELEASE-2510-TRAIN merge)
    standalone: bool
    main: CameraSourcesSourceMain | None
    sub: CameraSourcesSourceMain | None
    area_id: str | None
    revision: Num
    updated_at: str | None
    probe: CameraSourcesSourceProbe
    health: CameraSourcesSourceHealth | None
    capabilities: CameraSourcesSourceCapabilities


class CameraSourcesPutSourceHealth(ExactModel):
    state: str
    code: Any
    checked_at: Any
    ok_at: Any
    since: Any


class CameraSourcesPutSource(ExactModel):
    """Change the camera's video source (the recorder, or its own RTSP addresses)."""
    camera_id: str
    mode: str
    origin: str | None = None  # ONVIF-CLIENT-2500: manual | onvif; null on the recorder (declared at the RELEASE-2510-TRAIN merge)
    standalone: bool
    main: CameraSourcesSourceMain | None
    sub: CameraSourcesSourceMain | None
    area_id: Any
    revision: Num
    updated_at: str | None
    probe: dict[str, Any]
    health: CameraSourcesPutSourceHealth | None
    capabilities: CameraSourcesSourceCapabilities


class CameraSourcesTestSource(ExactModel):
    """Test an address before saving: one frame -> a small preview, the resolution and the codec, or a fixed Hebrew error."""
    ok: bool
    width: Num = None
    height: Num = None
    codec: str = None
    codec_label: str = None
    preview: str = None
    code: str = None
    message: str = None


class CameraSourcesCreateStandalone(ExactModel):
    """Add a camera without a recorder: live video and snapshots from its own RTSP addresses."""
    id: str
    recorder_id: str
    channel: Num
    name: str
    name_source: str
    alias: str
    enabled: bool
    sort_order: Num
    main_track: Any
    sub_track: Any
    status: str
    last_seen_at: Any
    stream: Any
    encoding: Any
    grid_col_span: Num
    wall_hidden: bool
    standalone: bool
    video_source: str
    area_id: str


class CameraSourcesDeleteStandalone(ExactModel):
    """Remove a camera without a recorder (a camera on a recorder is refused: 409 not_standalone)."""
    camera_id: str
    deleted: bool
