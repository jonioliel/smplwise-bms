"""Passive Core-process observation; no grant, repository or installer access.

Disk bytes are labelled disk evidence. Python function code is hashed from the
loaded objects. A native library's mapped executable image is NOT attested by a
post-load disk hash; the compatibility consumer must preserve that distinction.
No Fragment instance, heartbeat or crash probe is created.
"""

import hashlib
import importlib.metadata
import marshal
import os
import platform
import stat
import sys
import sysconfig
import time
import uuid
import weakref
from pathlib import Path

CONTRACT = "wiskey-core-runtime-observation.v1"
BOOT_ID = uuid.uuid4().hex
_REGISTERED = weakref.WeakKeyDictionary()


def _disk(path):
    if path is None:
        return None
    path = Path(path)
    fd = os.open(path, os.O_RDONLY | getattr(os, "O_NOFOLLOW", 0))
    try:
        before = os.fstat(fd)
        if not stat.S_ISREG(before.st_mode) or before.st_size > 32 * 1024 * 1024:
            return None
        with os.fdopen(os.dup(fd), "rb") as stream:
            digest = hashlib.file_digest(stream, "sha256").hexdigest()
        after = os.fstat(fd)
        if (before.st_dev, before.st_ino, before.st_size, before.st_mtime_ns) != (
            after.st_dev,
            after.st_ino,
            after.st_size,
            after.st_mtime_ns,
        ):
            return None
        return {"name": path.name, "sha256": digest, "bytes": before.st_size}
    except OSError:
        return None
    finally:
        os.close(fd)


def inspect(challenge):
    """Called on the original HA executor, once per authenticated request."""
    # Process birth comes from the actual Core OS process, not the add-on's
    # version, a caller string or the lifetime of this observer module.
    started = None
    boot = None
    try:
        import psutil
    except ImportError:
        psutil = None
    if psutil is not None:
        try:
            started = psutil.Process(os.getpid()).create_time()
            boot = hashlib.sha256(
                f"{sys.platform}:{os.getpid()}:{started:.6f}".encode()
            ).hexdigest()
        except (OSError, psutil.Error):
            pass
    modules = {}
    for name in ("orjson", "orjson.orjson", "aiohttp", "aiohttp.web_ws"):
        module = sys.modules.get(name)
        if module is None:
            modules[name] = {
                "loaded": False,
                "version": None,
                "disk": None,
                "loaded_code_sha256": None,
                "native_image_attestation": "unavailable",
            }
            continue
        code_digest = None
        if name == "aiohttp.web_ws":
            response = getattr(module, "WebSocketResponse", None)
            functions = [
                getattr(response, key, None)
                for key in ("_on_data_received", "_reset_heartbeat", "_send_heartbeat")
            ]
            if all(hasattr(f, "__code__") for f in functions):
                code_digest = hashlib.sha256(
                    b"".join(marshal.dumps(f.__code__) for f in functions)
                ).hexdigest()
        try:
            disk = _disk(getattr(module, "__file__", None))
        except OSError:
            disk = None
        modules[name] = {
            "loaded": True,
            "version": getattr(module, "__version__", None),
            "disk": disk,
            "loaded_code_sha256": code_digest,
            "native_image_attestation": "unavailable",
        }
    try:
        core = importlib.metadata.version("homeassistant")
    except importlib.metadata.PackageNotFoundError:
        core = None
    return {
        "contract": CONTRACT,
        "schema_version": 1,
        "challenge": challenge,
        "process_id": os.getpid(),
        "boot_id": boot,
        "process_started_at": started,
        "boot_scope": "core_process_birth" if boot is not None else "unavailable",
        "observer_ref": BOOT_ID,
        "observed_monotonic_ns": time.monotonic_ns(),
        "core_version": core,
        "python": platform.python_version(),
        "implementation": platform.python_implementation(),
        "soabi": sysconfig.get_config_var("SOABI"),
        "architecture": platform.machine(),
        "platform": sys.platform,
        "image_identity": None,
        "image_provenance": "unavailable",
        "modules": modules,
        "scope": "loaded process observation; disk hashes are not native image attestation",
    }


def register(hass, *, namespace="hikvision_intercom/installation"):
    """Separate HA-authenticated READ wrapper; never bridge admission/grant()."""
    import voluptuous as vol
    from homeassistant.components import websocket_api

    if hass in _REGISTERED:
        return

    @websocket_api.websocket_command(
        {
            vol.Required("type"): namespace + "/core_runtime_v1",
            vol.Required("challenge"): vol.All(str, vol.Length(min=16, max=128)),
        }
    )
    @websocket_api.async_response
    async def observation(hass, connection, message):
        user = connection.user
        if user is None or not user.is_active or not user.is_admin:
            connection.send_error(message["id"], "unauthorized", "Core observation refused")
            return
        result = await hass.async_add_executor_job(inspect, message["challenge"])
        # Revocation during executor I/O does not authorize the response.
        if connection.user is not user or not user.is_active or not user.is_admin:
            connection.send_error(message["id"], "unauthorized", "Core observation refused")
            return
        connection.send_result(message["id"], result)

    websocket_api.async_register_command(hass, observation)
    _REGISTERED[hass] = observation
