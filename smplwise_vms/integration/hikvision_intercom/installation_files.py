"""Versioned portable file-set digest. No host case-fold ordering or path aliases."""

import hashlib
import json
import re
import stat
from contextlib import contextmanager
from pathlib import Path

DIGEST_ALGORITHM = "wiskey-posix-tree-sha256.v1"
_RESERVED = {"CON", "PRN", "AUX", "NUL"} | {
    prefix + str(i) for prefix in ("COM", "LPT") for i in range(1, 10)
}


def canonical_rows(rows):
    """Exact POSIX names, case-sensitive Unicode ordering and compact UTF-8 JSON.

    Case-insensitive aliases are refused, never renamed or used to sort. This
    makes the same accepted file set representable on every supported host.
    """
    result, names, portable = [], set(), set()
    for row in rows:
        if type(row) is not dict or set(row) != {"path", "bytes", "sha256"}:
            raise ValueError("component_row_invalid")
        name = row["path"]
        if type(name) is not str or not name or "\\" in name:
            raise ValueError("component_path_invalid")
        parts = name.split("/")
        if any(
            not part
            or part in {".", ".."}
            or part[-1] in {".", " "}
            or any(ord(c) < 32 or ord(c) == 127 or c in ':*?"<>|' for c in part)
            or part.split(".", 1)[0].upper() in _RESERVED
            for part in parts
        ):
            raise ValueError("component_path_invalid")
        if name in names or name.casefold() in portable:
            raise ValueError("component_path_collision")
        if (
            type(row["bytes"]) is not int
            or row["bytes"] < 0
            or type(row["sha256"]) is not str
            or re.fullmatch("[0-9a-f]{64}", row["sha256"]) is None
        ):
            raise ValueError("component_row_invalid")
        names.add(name)
        portable.add(name.casefold())
        result.append(dict(row))
    return sorted(result, key=lambda row: row["path"])


def files(root):
    root = Path(root)
    if root.is_symlink():
        raise ValueError("component_symlink")
    rows = []
    for p in root.rglob("*"):
        mode = p.lstat().st_mode
        if stat.S_ISLNK(mode):
            raise ValueError("component_symlink")
        if not (stat.S_ISREG(mode) or stat.S_ISDIR(mode)):
            raise ValueError("component_non_regular")
        rel = p.relative_to(root)
        if (
            "__pycache__" in rel.parts
            or p.suffix == ".pyc"
            or p.name in {".DS_Store", ".smplwise_installed.json"}
        ):
            continue
        if stat.S_ISREG(mode):
            data = p.read_bytes()
            rows.append(
                {
                    "path": rel.as_posix(),
                    "bytes": len(data),
                    "sha256": hashlib.sha256(data).hexdigest(),
                }
            )
    rows = canonical_rows(rows)
    if not any(row["path"] == "manifest.json" for row in rows):
        raise ValueError("component_manifest_missing")
    return rows


def digest_rows(rows):
    return hashlib.sha256(
        json.dumps(
            canonical_rows(rows),
            ensure_ascii=True,
            sort_keys=True,
            separators=(",", ":"),
            allow_nan=False,
        ).encode("utf-8")
    ).hexdigest()


def digest(root):
    return digest_rows(files(root))


@contextmanager
def locked_generation(config_root, *, timeout=None):
    import fcntl
    import os
    import time

    path = Path(config_root) / ".storage/hikvision_intercom.arx_installation/generation.lock"
    path.parent.mkdir(mode=0o700, parents=True, exist_ok=True)
    fd = os.open(path, os.O_RDWR | os.O_CREAT | os.O_NOFOLLOW, 0o600)
    try:
        if timeout is None:
            fcntl.flock(fd, fcntl.LOCK_EX)
        else:
            deadline = time.monotonic() + timeout
            while True:
                try:
                    fcntl.flock(fd, fcntl.LOCK_EX | fcntl.LOCK_NB)
                    break
                except BlockingIOError:
                    if time.monotonic() >= deadline:
                        raise TimeoutError("generation_fence_busy") from None
                    time.sleep(min(0.01, max(0, deadline - time.monotonic())))
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
