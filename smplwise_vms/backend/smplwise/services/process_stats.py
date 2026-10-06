"""Process and database-file counters for the health route (soak measurement of leaks).

Coarse integers only: uptime, thread count, open file descriptors, resident memory, and the byte sizes of the main
database file and its -wal. No paths, no names, no content. Cached for a few seconds so polling cannot load the
server, and it never raises: any value that cannot be read is None (Windows has no /proc; a missing file is None).
"""
from __future__ import annotations

import os
import threading
import time
from pathlib import Path
from typing import Any, Callable

CACHE_TTL_S = 5.0
_STARTED = time.monotonic()
_lock = threading.Lock()
_cache: dict[str, Any] = {"at": None, "key": None, "value": None}


def _safe(fn: Callable[[], Any]) -> Any:
    try:
        return fn()
    except Exception:  # noqa: BLE001 - a health counter must never break the health response
        return None


def _open_fds() -> int | None:
    return len(os.listdir("/proc/self/fd")) - 1  # minus the descriptor listdir itself holds


def _rss_mb() -> float | None:
    with open("/proc/self/status", encoding="ascii", errors="ignore") as f:
        for line in f:
            if line.startswith("VmRSS:"):
                return round(int(line.split()[1]) / 1024.0, 1)  # kB -> MB
    return None


def _size(path: Path) -> int | None:
    try:
        return path.stat().st_size
    except FileNotFoundError:
        return 0 if path.name.endswith("-wal") else None  # no WAL file yet is zero bytes of WAL
    except OSError:
        return None


def _compute(db_path: Path, now: float) -> dict[str, Any]:
    return {
        "process": {
            "uptime_s": _safe(lambda: round(now - _STARTED, 1)),
            "threads": _safe(threading.active_count),
            "open_fds": _safe(_open_fds),
            "rss_mb": _safe(_rss_mb),
        },
        "db": {
            "size_bytes": _safe(lambda: _size(db_path)),
            "wal_bytes": _safe(lambda: _size(db_path.with_name(db_path.name + "-wal"))),
        },
    }


def snapshot(db_path: Path, clock: Callable[[], float] = time.monotonic) -> dict[str, Any]:
    """`{process: {...}, db: {...}}`, recomputed at most every CACHE_TTL_S seconds (per database path)."""
    now = clock()
    with _lock:
        if _cache["at"] is not None and _cache["key"] == str(db_path) and 0 <= now - _cache["at"] < CACHE_TTL_S:
            return _cache["value"]
    try:
        value = _compute(db_path, now)
    except Exception:  # noqa: BLE001
        value = {"process": {"uptime_s": None, "threads": None, "open_fds": None, "rss_mb": None},
                 "db": {"size_bytes": None, "wal_bytes": None}}
    with _lock:
        _cache.update(at=now, key=str(db_path), value=value)
    return value


def reset_cache() -> None:
    with _lock:
        _cache.update(at=None, key=None, value=None)
