"""Shared pieces of the in-memory session caches (local_identity._Cache, app_session._Cache).

attach_if_live: the "review M2" rule of ha_user_auth.SessionStore.attach_socket for the two later caches (code review 2026-11-13,
P1-1). A WebSocket handshake resolves its session in the thread pool and attaches afterwards; a revocation that lands in between drops
the cache entry (and queues the sockets already attached), but a socket attached after it would never be closed. The liveness check and
the attach therefore run under the cache's own lock, so a revocation is either before the check (refused) or after the attach (closed by
the revocation). No database read: "live" means the entry the resolve just put is still there."""
from __future__ import annotations

import threading
import weakref
from typing import Any, Callable


def attach_if_live(lock: threading.Lock, sockets: dict[str, weakref.WeakSet], key: str, websocket: Any, *, live: Callable[[], bool]) -> bool:
    """Attach `websocket` under `key` only while `live()` holds, both under `lock`. False = the session ended since its lookup: the caller
    refuses the socket (4401), exactly as for an unknown cookie. `live` is called with `lock` held and must not take it again."""
    with lock:
        if not live():
            return False
        sockets.setdefault(key, weakref.WeakSet()).add(websocket)
        return True
