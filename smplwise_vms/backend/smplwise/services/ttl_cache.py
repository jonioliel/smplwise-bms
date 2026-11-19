"""One small time-to-live cache (CR-HEALTH-POLLERS, review 03:F21).

Replaces hand-written `dict[key] = (stored_at, value)` caches that each had their own eviction rule (two had none).

- An entry is `(stored_at, value)`. `entry(key)` / `get(key)` answer only while it is younger than the TTL (the cache's, or
  the one given for this read: some callers keep a short TTL for "now" and a long one for the past). `peek(key)` answers at
  any age.
- `maxsize` bounds the cache: when a put goes over it, the oldest quarter is dropped (the rule the recordings caches used).
- `flight(key)` is the single-flight guard: one loader per key at a time; a follower waits, then re-reads the cache.
- Every method takes the cache's lock; loaders run outside it. The clock is read at call time (`time.time` unless given).
"""
from __future__ import annotations

import threading
import time
from contextlib import contextmanager
from typing import Any, Callable, Generic, Hashable, Iterator, TypeVar

K = TypeVar("K", bound=Hashable)
V = TypeVar("V")


class TtlCache(Generic[K, V]):
    def __init__(self, ttl: float, maxsize: int | None = None, *, clock: Callable[[], float] | None = None) -> None:
        self.ttl = ttl
        self.maxsize = maxsize
        self._clock = clock
        self._lock = threading.Lock()
        self._data: dict[K, tuple[float, V]] = {}
        self._flights: dict[K, threading.Lock] = {}
        self._flight_guard = threading.Lock()

    def now(self) -> float:
        return self._clock() if self._clock is not None else time.time()

    def peek(self, key: K) -> tuple[float, V] | None:
        """The entry at any age."""
        with self._lock:
            return self._data.get(key)

    def entry(self, key: K, ttl: float | None = None) -> tuple[float, V] | None:
        """`(stored_at, value)` while younger than the TTL, else None."""
        hit = self.peek(key)
        if hit is not None and self.now() - hit[0] < (self.ttl if ttl is None else ttl):
            return hit
        return None

    def get(self, key: K, default: Any = None, ttl: float | None = None) -> Any:
        hit = self.entry(key, ttl)
        return default if hit is None else hit[1]

    def put(self, key: K, value: V, at: float | None = None) -> float:
        at = self.now() if at is None else at
        with self._lock:
            self._data[key] = (at, value)
            if self.maxsize is not None and len(self._data) > self.maxsize:
                for old in sorted(self._data, key=lambda k: self._data[k][0])[: max(1, self.maxsize // 4)]:
                    self._data.pop(old, None)
        return at

    def pop(self, key: K, default: Any = None) -> Any:
        with self._lock:
            hit = self._data.pop(key, None)
        return default if hit is None else hit[1]

    def discard(self, match: Callable[[K], bool]) -> int:
        with self._lock:
            gone = [k for k in self._data if match(k)]
            for k in gone:
                self._data.pop(k, None)
        return len(gone)

    def clear(self) -> None:
        with self._lock:
            self._data.clear()

    def __len__(self) -> int:
        with self._lock:
            return len(self._data)

    def __contains__(self, key: object) -> bool:
        with self._lock:
            return key in self._data

    @contextmanager
    def flight(self, key: K) -> Iterator[None]:
        """One holder per key at a time. The caller re-reads the cache inside: a follower finds the leader's answer."""
        with self._flight_guard:
            lock = self._flights.setdefault(key, threading.Lock())
        try:
            with lock:
                yield
        finally:
            with self._flight_guard:
                if self._flights.get(key) is lock:
                    self._flights.pop(key, None)

    def load(self, key: K, loader: Callable[[], V], ttl: float | None = None) -> V:
        """The fresh value, or the loader's (stored). Concurrent callers of one key run the loader once."""
        hit = self.entry(key, ttl)
        if hit is not None:
            return hit[1]
        with self.flight(key):
            hit = self.entry(key, ttl)
            if hit is not None:
                return hit[1]
            value = loader()
            self.put(key, value)
            return value
