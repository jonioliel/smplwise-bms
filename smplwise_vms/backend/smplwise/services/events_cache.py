"""In-process cache of the last query windows of the event centre (T068): the events list, the facets and the per-camera
timeline recompute a whole day (up to 1000 rows, place joins, facet counts) per request, and under a busy NVR - eight
channels notifying the surveillance centre, the 0.1.58 incident - several screens ask the same window again and again.

Correctness rules:
- A cached value is only ever served for the exact version it was computed at. The versions are change counters kept
  by triggers in the database (migration 0031, `cache_versions`), bumped in the same transaction as every write that
  can change a window: any event insert / update / delete (alert stream, recording derivation, HA transitions, acks,
  pruning, a restore), camera names, the site / building / floor / anchor / zone structure, the time zone. The caller
  reads the counters in the SAME transaction as the rows it computes from, so a value and its version always match.
- The key carries the database file, the endpoint, every parameter and the caller's visible scope (installation-wide or
  the exact set of camera ids): two principals with different scopes never share an entry. Authorization runs on every
  request before the cache is consulted.
- A TTL (<= 5 s) is only a safety net (windows that end at "now", a counter that could not be read).
- Memory is bounded twice: at most MAX_ENTRIES windows and at most MAX_ROWS event rows across all of them (least
  recently used first out); a single window larger than MAX_ROWS is never cached.
- A hit returns fresh copies of the row dicts (callers annotate rows with thumbnail state), sharing only the nested
  `details` dicts, which no caller mutates.
"""
from __future__ import annotations

import os
import sqlite3
import threading
import time
from collections import OrderedDict
from dataclasses import dataclass
from typing import Any, Callable, Hashable

MAX_ENTRIES = 32
MAX_ROWS = 5000  # ~1-2 KB per event row dict: <= ~10 MB worst case
TTL_S = 5.0
ENABLED = os.environ.get("SW_EVENTS_CACHE", "1") != "0"


@dataclass
class _Entry:
    version: tuple[int, ...]
    stored: float
    value: Any
    cost: int


def read_versions(conn: sqlite3.Connection) -> dict[str, int] | None:
    """The change counters, read inside the caller's transaction; None when the table is missing (never cache then)."""
    try:
        return {r[0]: int(r[1]) for r in conn.execute("SELECT name, version FROM cache_versions").fetchall()}
    except sqlite3.OperationalError:
        return None


def scope_key(wide: bool, ids: set[str] | None) -> Hashable:
    """The caller's visible scope as part of the key: the exact id set, not a hash, so no collision can mix scopes."""
    return ("*",) if wide else tuple(sorted(ids or ()))


def copy_rows(rows: list[dict[str, Any]]) -> list[dict[str, Any]]:
    return [dict(r) for r in rows]


class WindowCache:
    def __init__(self, max_entries: int = MAX_ENTRIES, max_rows: int = MAX_ROWS, ttl_s: float = TTL_S) -> None:
        self.max_entries = max_entries
        self.max_rows = max_rows
        self.ttl_s = ttl_s
        self.enabled = ENABLED
        self._lock = threading.Lock()
        self._entries: OrderedDict[Hashable, _Entry] = OrderedDict()
        self._rows = 0
        self.hits = 0
        self.misses = 0
        self.stale = 0  # a key found at an older version (a write happened since)
        self.expired = 0
        self.evictions = 0
        self.oversize = 0
        self.bypass = 0  # counters unreadable: computed without the cache

    # ------------------------------------------------------------------ core
    def _drop(self, key: Hashable) -> None:
        e = self._entries.pop(key, None)
        if e is not None:
            self._rows -= e.cost

    def get(self, key: Hashable, version: tuple[int, ...]) -> Any | None:
        now = time.monotonic()
        with self._lock:
            e = self._entries.get(key)
            if e is None:
                self.misses += 1
                return None
            if e.version != version:
                self.stale += 1
                self.misses += 1
                self._drop(key)
                return None
            if now - e.stored > self.ttl_s:
                self.expired += 1
                self.misses += 1
                self._drop(key)
                return None
            self._entries.move_to_end(key)
            self.hits += 1
            return e.value

    def put(self, key: Hashable, version: tuple[int, ...], value: Any, cost: int) -> None:
        cost = max(1, int(cost))
        with self._lock:
            if cost > self.max_rows:
                self.oversize += 1
                return
            self._drop(key)
            self._entries[key] = _Entry(version, time.monotonic(), value, cost)
            self._rows += cost
            while self._entries and (len(self._entries) > self.max_entries or self._rows > self.max_rows):
                old, _ = next(iter(self._entries.items()))
                self._drop(old)
                self.evictions += 1

    def fetch(self, conn: sqlite3.Connection, key: Hashable, counters: tuple[str, ...], compute: Callable[[], Any],
              cost: Callable[[Any], int], copy: Callable[[Any], Any]) -> Any:
        """The cached value for `key` at the current counters, else `compute()` (stored). Always returns a copy."""
        if not self.enabled:
            return compute()
        versions = read_versions(conn)
        if versions is None:
            with self._lock:
                self.bypass += 1
            return compute()
        version = tuple(versions.get(c, -1) for c in counters)
        hit = self.get(key, version)
        if hit is not None:
            return copy(hit)
        value = compute()
        self.put(key, version, copy(value), cost(value))
        return value

    def clear(self) -> None:
        with self._lock:
            self._entries.clear()
            self._rows = 0

    def reset_stats(self) -> None:
        with self._lock:
            self.hits = self.misses = self.stale = self.expired = self.evictions = self.oversize = self.bypass = 0

    def stats(self) -> dict[str, Any]:
        with self._lock:
            lookups = self.hits + self.misses
            return {
                "enabled": self.enabled, "hits": self.hits, "misses": self.misses,
                "hit_rate": round(self.hits / lookups, 3) if lookups else None,
                "stale": self.stale, "expired": self.expired, "evictions": self.evictions, "oversize": self.oversize, "bypass": self.bypass,
                "size": len(self._entries), "rows": self._rows, "max_entries": self.max_entries, "max_rows": self.max_rows, "ttl_s": self.ttl_s,
            }


CACHE = WindowCache()
