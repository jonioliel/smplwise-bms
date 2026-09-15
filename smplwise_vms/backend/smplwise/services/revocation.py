"""In-process revocation marks (docs/security/HA_IDENTITY_RBAC_HE.md §11): when a binding is revoked or a
user is disabled in Home Assistant, the user's open media sockets must end within 30 s. REST requests are
already refused at once (authorize() reads bindings live); this module lets long-lived relays notice."""
from __future__ import annotations

import threading
import time

_marks: dict[str, float] = {}
_lock = threading.Lock()


def mark(user_ids: list[str] | set[str]) -> None:
    now = time.time()
    with _lock:
        for uid in user_ids:
            _marks[uid] = now


def revoked_since(user_id: str, started_at: float) -> bool:
    """True when the user was marked after `started_at` (a socket opened before the revocation)."""
    with _lock:
        t = _marks.get(user_id)
    return t is not None and t >= started_at
