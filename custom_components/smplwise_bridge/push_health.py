"""0.10.3 (BRIDGE-STALE-DISCOVERY-2383): the health of the bridge's own signed directory pushes, so a refusal by the add-on is SEEN.

Until 0.10.2 a refused push was logged at debug level only: a bridge signing with a code the add-on no longer holds (a re-pair whose new
code never arrived, or an old code a Supervisor discovery put back) failed silently every 60 s. Now the first refusal is a WARNING with the
fix, the recovery an INFO line, and the state is part of the entry's diagnostics (`diagnostics.py`). Dependency-free (no Home Assistant
import) so it is unit-tested directly. Never holds or logs a code, a key, a signature or an address.

Reasons: `ok` | `addon_refused_signature` (401: the add-on does not accept this bridge's key) | `addon_error` (another HTTP status) |
`addon_unreachable` (no answer) | `unknown` (no push yet)."""
from __future__ import annotations

import datetime as dt
import logging
import time
from typing import Any, Callable

REMIND_S = 3600  # while refusals go on, the warning is repeated at most once an hour

REFUSED_TEXT = ("SMPLWISE Bridge: the add-on refuses this bridge's signed updates (401) - the pairing code in this entry is not the add-on's "
                "current one. In the add-on: Settings > \"Arx - WisKey connection\" > re-pair; if the new code is not delivered automatically, "
                "delete this integration and add it again with the address and code the add-on shows.")


def _iso(at: float) -> str:
    return dt.datetime.fromtimestamp(at, dt.timezone.utc).replace(microsecond=0).isoformat().replace("+00:00", "Z")


class PushHealth:
    def __init__(self, logger: logging.Logger, now: Callable[[], float] = time.time) -> None:
        self._log, self._now = logger, now
        self.reason = "unknown"
        self.status: int | None = None
        self.since: float | None = None      # when the current non-ok reason started
        self.count = 0                       # consecutive non-ok pushes
        self.last_ok: float | None = None
        self._warned_at: float | None = None

    def note(self, status: int | None, error: str | None = None) -> None:
        """One push finished: its HTTP status, or None with the exception class name when there was no answer."""
        now = self._now()
        reason = "ok" if status == 200 else "addon_refused_signature" if status == 401 else "addon_error" if status is not None else "addon_unreachable"
        if reason == "ok":
            if self.reason == "addon_refused_signature":
                self._log.info("SMPLWISE Bridge: the add-on accepts this bridge's signed updates again (after %d refused)", self.count)
            self.reason, self.status, self.since, self.count, self.last_ok, self._warned_at = "ok", status, None, 0, now, None
            return
        if reason != self.reason:
            self.since, self.count = now, 0
        self.reason, self.status = reason, status
        self.count += 1
        if reason == "addon_refused_signature":
            if self._warned_at is None or now - self._warned_at >= REMIND_S:
                self._log.warning("%s (%d refused since %s)", REFUSED_TEXT, self.count, _iso(self.since or now))
                self._warned_at = now
        else:
            self._log.debug("directory push %s: %s", reason, status if status is not None else (error or "-"))

    def state(self) -> dict[str, Any]:
        return {"reason": self.reason, "status": self.status, "since": _iso(self.since) if self.since else None, "count": self.count,
                "last_ok": _iso(self.last_ok) if self.last_ok else None}
