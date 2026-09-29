"""Camera leases (T055 session downgrade): an open live or playback relay keeps its camera only while the viewer still
holds the permission on it. The relay's watch loop asks `should_stop()` every second; the lease re-checks the camera
through the shared camera scope (services/access.py) as soon as the user's access generation moves (a binding or
membership change, a disable in HA - services/revocation) and at least every RECHECK_S seconds (a binding that simply
expired, a camera moved to a floor the viewer does not hold). The re-check runs in the thread pool, never on the event
loop; until it answers the stream keeps flowing, and a database error leaves the lease as it was (retried next tick).
A lost lease ends the relay with the reason `access_lost` - within about a second of the change, well inside the 30 s
of §11."""
from __future__ import annotations

import asyncio
import logging
import time
from typing import Any, Callable

from starlette.concurrency import run_in_threadpool

from ..rbac import Principal
from . import revocation

log = logging.getLogger("smplwise.leases")

RECHECK_S = 20.0


class CameraLease:
    def __init__(self, db: Any, principal: Principal, camera_id: str, permission: str, extra_stop: Callable[[], bool] | None = None) -> None:
        self.db = db
        self.principal = principal
        self.camera_id = camera_id
        self.permission = permission
        self.extra_stop = extra_stop
        self.generation = revocation.generation(principal.user_id)
        self.checked_at = time.time()
        self.lost = False
        self._pending: asyncio.Task[None] | None = None

    def allowed_now(self) -> bool:
        """The synchronous check (thread pool): the camera through the one shared rule."""
        from .access import camera_allowed

        with self.db.connection(mode="read", label=f"lease {self.permission} {self.camera_id}") as conn:
            return camera_allowed(conn, self.principal, self.camera_id, self.permission)

    async def _recheck(self) -> None:
        try:
            ok = await run_in_threadpool(self.allowed_now)
        except Exception as exc:  # noqa: BLE001 - a busy database must not kill (or silently keep forever) a stream
            log.warning("lease re-check for camera %s failed: %s", self.camera_id, type(exc).__name__)
            self._pending = None
            return
        self.checked_at = time.time()
        if not ok:
            self.lost = True
            log.info("lease on camera %s lost for user %s", self.camera_id, self.principal.user_id)
        self._pending = None

    def should_stop(self) -> bool:
        if self.lost:
            return True
        if self.extra_stop is not None and self.extra_stop():
            return True
        gen = revocation.generation(self.principal.user_id)
        if self._pending is None and (gen != self.generation or time.time() - self.checked_at >= RECHECK_S):
            self.generation = gen
            try:
                self._pending = asyncio.get_running_loop().create_task(self._recheck())
            except RuntimeError:  # no running loop (a synchronous caller): check inline
                self.checked_at = time.time()
                self.lost = not self.allowed_now()
        return self.lost
