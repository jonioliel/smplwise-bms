"""Response models of routers/camera_image_health.py (RESPONSE-MODELS-E-2480, code review 07:F8 step 2)."""
from __future__ import annotations

from typing import Any

from . import ExactModel, Num

# routes without a JSON body
NO_JSON: frozenset[str] = frozenset()
# JSON routes without a model yet: no test reaches a successful answer (or the answer is not one object); counted by the ratchet
# (scripts/wire_ratchet.py) until they are modelled
UNMODELLED: frozenset[str] = frozenset()


class CameraImageHealthResultsCameraReference(ExactModel):
    set_at: str
    auto: bool


class CameraImageHealthResultsCamera(ExactModel):
    id: str
    name: str
    state: str
    issues: list[Any]
    texts: list[Any]
    sampled_at: str | None
    attempted_at: str | None
    source: str | None
    error: Any
    error_text: Any
    metrics: dict[str, Any]
    reference: CameraImageHealthResultsCameraReference | None


class CameraImageHealthResults(ExactModel):
    """CAMHEALTH091: the image health of every camera the caller may watch live (names, states and numbers only)."""
    enabled: bool
    interval_s: Num
    checked_at: str | None
    counts: dict[str, Any]
    cameras: list[CameraImageHealthResultsCamera]
    can_manage: bool


class CameraImageHealthCheckCameraMetrics(ExactModel):
    brightness: Num
    sharpness: Num
    diff: Any
    shift_pct: Any
    corr: Any


class CameraImageHealthCheckCamera(ExactModel):
    id: str
    name: str
    state: str
    issues: list[Any]
    texts: list[Any]
    sampled_at: str
    attempted_at: str
    source: str
    error: Any
    error_text: Any
    metrics: CameraImageHealthCheckCameraMetrics
    reference: CameraImageHealthResultsCameraReference


class CameraImageHealthCheck(ExactModel):
    """CAMHEALTH091: sample the oldest cameras now (cache or existing sub stream; at most every 30 s); 409 while switched off."""
    checked: bool
    enabled: bool
    interval_s: Num
    checked_at: str
    counts: dict[str, Any]
    cameras: list[CameraImageHealthCheckCamera]
    can_manage: bool


class CameraImageHealthSettingsRangesIntervalS(ExactModel):
    default: Num
    min: Num
    max: Num


class CameraImageHealthSettingsRanges(ExactModel):
    interval_s: CameraImageHealthSettingsRangesIntervalS
    per_pass_max: dict[str, Num]
    dark_level: CameraImageHealthSettingsRangesIntervalS
    blur_min: CameraImageHealthSettingsRangesIntervalS
    freeze_diff: CameraImageHealthSettingsRangesIntervalS
    freeze_samples: CameraImageHealthSettingsRangesIntervalS
    shift_pct: CameraImageHealthSettingsRangesIntervalS
    shift_corr_min: CameraImageHealthSettingsRangesIntervalS
    confirm_samples: CameraImageHealthSettingsRangesIntervalS
    recover_s: CameraImageHealthSettingsRangesIntervalS


class CameraImageHealthSettingsCamera(ExactModel):
    id: str
    name: str
    recorder_id: str


class CameraImageHealthSettings(ExactModel):
    """CAMHEALTH091: the switch, the sampling interval and every threshold, with defaults and ranges."""
    values: dict[str, Any]
    ranges: CameraImageHealthSettingsRanges
    cameras: list[CameraImageHealthSettingsCamera]
    source: str
