"""Read-only per-namespace dependency observation, never global HA health."""

import importlib.util
import shutil
from importlib.metadata import PackageNotFoundError, version


def _version(name):
    try:
        return version(name)
    except PackageNotFoundError:
        return None


def inspect():
    from homeassistant.components.camera.img_util import TurboJPEGSingleton

    ffmpeg = shutil.which("ffmpeg") is not None
    turbo = bool(TurboJPEGSingleton.instance())
    vad = importlib.util.find_spec("pymicro_vad") is not None
    return {
        "contract": "wiskey-capability-preflight.v1",
        "schema_version": 1,
        "namespace": "ha_core",
        "global_ha_health": "not_assessed",
        "dependencies": {
            "ffmpeg": {"available": ffmpeg, "version": None},
            "libturbojpeg": {"available": turbo, "version": None},
            "pymicro_vad": {"available": vad, "version": _version("pymicro-vad")},
        },
        "paths": {
            "native_grant_events_g711": "independent_of_these_dependencies",
            "camera_jpeg_resize": "available" if turbo else "original_image_only_bounded",
            "ha_ffmpeg_paths": "available_binary_unprobed" if ffmpeg else "ffmpeg_missing",
            "assist_pipeline": "dependency_present_not_setup_proof"
            if vad
            else "required_dependency_missing",
        },
    }
