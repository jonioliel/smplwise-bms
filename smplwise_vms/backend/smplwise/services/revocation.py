"""In-process access-change signals (docs/security/HA_IDENTITY_RBAC_HE.md §11, §15): when a user's bindings change
(granted, revoked, denied, through a group or a role edit) or the user is disabled in Home Assistant, whatever is open
for them must follow. REST requests need nothing - authorize() reads bindings live on every call, nothing is cached
beyond one request. Long-lived things do: a live / playback relay re-checks its camera (services/leases.py), the
push sockets re-scope, and the shell's /me/ws tells the browser `permissions_changed`.

`mark` = access may have SHRUNK (a revoke, a deny, a disable); `changed` = any change (a grant too). Both move the
user's generation, which the sockets poll every second; `revoked_since` keeps the older time-based question."""
from __future__ import annotations

import threading
import time

_marks: dict[str, float] = {}
_generation: dict[str, int] = {}
_lock = threading.Lock()


def changed(user_ids: list[str] | set[str]) -> None:
    with _lock:
        for uid in user_ids:
            _generation[uid] = _generation.get(uid, 0) + 1


def mark(user_ids: list[str] | set[str]) -> None:
    now = time.time()
    with _lock:
        for uid in user_ids:
            _marks[uid] = now
            _generation[uid] = _generation.get(uid, 0) + 1


def generation(user_id: str) -> int:
    with _lock:
        return _generation.get(user_id, 0)


def revoked_since(user_id: str, started_at: float) -> bool:
    """True when the user was marked after `started_at` (a socket opened before the revocation)."""
    with _lock:
        t = _marks.get(user_id)
    return t is not None and t >= started_at
