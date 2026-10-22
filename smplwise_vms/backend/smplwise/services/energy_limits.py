"""ELECBILL77: rate limits for the two expensive electricity-bill actions - recomputing a draft and rendering a PDF.

The pattern is the one the secrets / music-server connection tests use (services/connection_probe.Limiter: sliding window, `per_user` per key and
`total` for the installation; the router answers 429 with `retry_after_s`), with two additions the bills need:

- the refusal says WHICH limit was hit (`details.scope`: `user` or `installation`);
- recompute also holds an in-flight guard per bill, so a repeated click while the first computation is still running is refused at once
  (429 `recompute_in_progress`) instead of starting a parallel computation that would only lose the row-version check afterwards.

The state lives on the app (`app.state.energy_guards`, created on first use), so every app instance - and every test - has its own counters. The
numbers are module constants, deliberately generous for a person and tight for a script: a bill is recomputed a few times while it is reviewed.
A PDF served from the stored file of an issued bill costs nothing and is not counted - only a render is."""
from __future__ import annotations

import threading
import time
from collections import deque
from contextlib import contextmanager
from typing import Any, Iterator

from ..errors import ApiError

WINDOW_S = 60.0
RECOMPUTE_PER_USER, RECOMPUTE_TOTAL = 10, 30
PDF_PER_USER, PDF_TOTAL = 20, 60
IN_PROGRESS_RETRY_S = 2


class ScopedLimiter:
    """Sliding windows like connection_probe.Limiter, but `take` also names the limit that refused."""

    def __init__(self, per_user: int, total: int, window_s: float = WINDOW_S) -> None:
        self.per_user, self.total, self.window_s = per_user, total, window_s
        self._lock = threading.Lock()
        self._by: dict[str, deque[float]] = {}
        self._all: deque[float] = deque()

    def take(self, key: str, now: float | None = None) -> tuple[int, str | None]:
        """(0, None) when allowed and counted, else (seconds to wait, "user" | "installation")."""
        t = time.monotonic() if now is None else now
        with self._lock:
            mine = self._by.setdefault(key, deque())
            for q in (mine, self._all):
                while q and t - q[0] >= self.window_s:
                    q.popleft()
            if len(mine) >= self.per_user:
                return max(1, int(self.window_s - (t - mine[0])) + 1), "user"
            if len(self._all) >= self.total:
                return max(1, int(self.window_s - (t - self._all[0])) + 1), "installation"
            mine.append(t)
            self._all.append(t)
            return 0, None


class Guards:
    def __init__(self) -> None:
        self.recompute = ScopedLimiter(RECOMPUTE_PER_USER, RECOMPUTE_TOTAL)
        self.pdf = ScopedLimiter(PDF_PER_USER, PDF_TOTAL)
        self.running: set[str] = set()
        self.lock = threading.Lock()


_CREATE_LOCK = threading.Lock()


def guards(app: Any) -> Guards:
    g = getattr(app.state, "energy_guards", None)
    if g is None:
        with _CREATE_LOCK:
            g = getattr(app.state, "energy_guards", None)
            if g is None:
                g = app.state.energy_guards = Guards()
    return g


def _refuse(code: str, message: str, wait: int, scope: str) -> ApiError:
    return ApiError(429, code, message, retryable=True, details={"retry_after_s": wait, "scope": scope})


def take_pdf(app: Any, user_key: str) -> None:
    """Count one PDF render; 429 `rate_limited` when this user (or the installation) rendered too many in the last minute."""
    wait, scope = guards(app).pdf.take(user_key)
    if wait:
        raise _refuse("rate_limited", f"יותר מדי הפקות PDF בזמן קצר; אפשר לנסות שוב בעוד {wait} שניות.", wait, scope or "user")


@contextmanager
def recompute(app: Any, user_key: str, bill_key: str) -> Iterator[None]:
    """Hold the recompute of one bill: refused (429 `recompute_in_progress`) while another computation of it runs, and (429 `rate_limited`) when
    this user or the installation recomputed too often in the last minute. Released when the block ends, whatever happens in it."""
    g = guards(app)
    with g.lock:
        if bill_key in g.running:
            raise _refuse("recompute_in_progress", "החישוב של החיוב הזה כבר רץ. אפשר לנסות שוב בעוד רגע.", IN_PROGRESS_RETRY_S, "bill")
        wait, scope = g.recompute.take(user_key)
        if wait:
            raise _refuse("rate_limited", f"יותר מדי חישובים מחדש בזמן קצר; אפשר לנסות שוב בעוד {wait} שניות.", wait, scope or "user")
        g.running.add(bill_key)
    try:
        yield
    finally:
        with g.lock:
            g.running.discard(bill_key)
