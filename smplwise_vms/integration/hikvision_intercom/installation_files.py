"""Canonical complete distribution digest; shared byte-identical in both loaders and installer."""

import hashlib
import json
from contextlib import contextmanager
from pathlib import Path


def files(root):
    root = Path(root)
    rows = []
    for p in sorted(root.rglob("*")):
        rel = p.relative_to(root)
        if (
            "__pycache__" in rel.parts
            or p.suffix == ".pyc"
            or p.name in {".DS_Store", ".smplwise_installed.json"}
        ):
            continue
        if p.is_symlink():
            raise ValueError("component_symlink")
        if p.is_file():
            data = p.read_bytes()
            rows.append(
                {
                    "path": rel.as_posix(),
                    "bytes": len(data),
                    "sha256": hashlib.sha256(data).hexdigest(),
                }
            )
        elif not p.is_dir():
            raise ValueError("component_non_regular")
    if not any(r["path"] == "manifest.json" for r in rows):
        raise ValueError("component_manifest_missing")
    return rows


def digest(root):
    return hashlib.sha256(
        json.dumps(files(root), sort_keys=True, separators=(",", ":")).encode()
    ).hexdigest()


@contextmanager
def locked_generation(config_root):
    import fcntl
    import os

    path = Path(config_root) / ".storage/hikvision_intercom.arx_installation/generation.lock"
    path.parent.mkdir(mode=0o700, parents=True, exist_ok=True)
    fd = os.open(path, os.O_RDWR | os.O_CREAT | os.O_NOFOLLOW, 0o600)
    try:
        fcntl.flock(fd, fcntl.LOCK_EX)
        yield
    finally:
        fcntl.flock(fd, fcntl.LOCK_UN)
        os.close(fd)


def validate_generation(value):
    """Closed private journal syntax shared by both original component readers."""
    import re

    names = {"smplwise_bridge", "hikvision_intercom"}
    required = {
        "format",
        "schema_version",
        "generation_id",
        "state",
        "expected",
        "staged",
        "installed",
        "previously_present",
        "restart",
    }
    optional = {"last_verified_boot_id", "native_restart", "stop_request", "stopped_boot_id"}
    if (
        type(value) is not dict
        or set(value) - required - optional
        or not required <= set(value)
        or value["format"] != "wiskey-installation-generation.v1"
        or type(value["schema_version"]) is not int
        or value["schema_version"] != 1
        or type(value["generation_id"]) is not str
        or re.fullmatch("[0-9a-f]{32}", value["generation_id"]) is None
        or type(value["state"]) is not str
        or value["state"]
        not in {
            "staging",
            "installing",
            "installed",
            "failed",
            "rolled_back",
            "uninstalling",
            "uninstalled",
        }
    ):
        raise ValueError("generation_storage_invalid")
    for field in ["expected", "staged", "installed"]:
        mapping = value[field]
        if (
            type(mapping) is not dict
            or set(mapping) - names
            or field == "expected"
            and set(mapping) != names
            or any(
                type(v) is not str or re.fullmatch("[0-9a-f]{64}", v) is None
                for v in mapping.values()
            )
        ):
            raise ValueError("generation_storage_invalid")
    if value["state"] == "installed" and any(
        value[k] != value["expected"] for k in ["staged", "installed"]
    ):
        raise ValueError("generation_storage_invalid")
    previous = value["previously_present"]
    if (
        type(previous) is not dict
        or set(previous) != names
        or any(type(v) is not bool for v in previous.values())
    ):
        raise ValueError("generation_storage_invalid")
    restart = value["restart"]
    if (
        type(restart) is not dict
        or set(restart) != {"state", "boot_id"}
        or type(restart["state"]) is not str
        or restart["state"] not in {"not_requested", "requested", "failed", "unknown", "completed"}
        or restart["boot_id"] is not None
        and (type(restart["boot_id"]) is not str or not restart["boot_id"])
    ):
        raise ValueError("generation_storage_invalid")
    native = value.get("native_restart")
    if native is not None and (
        type(native) is not dict
        or set(native) != {"state", "boot_id", "process_id"}
        or type(native["state"]) is not str
        or native["state"] not in {"requested", "failed"}
        or type(native["boot_id"]) is not str
        or not native["boot_id"]
        or type(native["process_id"]) is not int
        or native["process_id"] < 1
    ):
        raise ValueError("generation_storage_invalid")
    stop = value.get("stop_request")
    if stop is not None and (
        type(stop) is not dict
        or set(stop) != {"state"}
        or type(stop["state"]) is not str
        or stop["state"] not in {"requested", "confirmed", "unknown", "failed"}
    ):
        raise ValueError("generation_storage_invalid")
    for field in ["last_verified_boot_id", "stopped_boot_id"]:
        if field in value and (type(value[field]) is not str or not value[field]):
            raise ValueError("generation_storage_invalid")
    return value
