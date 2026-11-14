"""Per-user frames for the shell's `/me/ws` socket (CR-018): `notification`, `notification_state`, `notify_summary`.

There is no SSE in Arx: realtime is in-process WebSocket fan-out. Each open `/me/ws` socket registers a bounded queue for
its user; a frame published for a user reaches only that user's own sockets, so no scope filter per frame is needed beyond
"this user is a recipient" (services/notify decides that before it publishes). A slow socket loses a frame (counted); the
client's 60 s summary poll is the fallback."""
from __future__ import annotations

import queue
import threading
from typing import Any

_subs: dict[str, list[queue.Queue]] = {}
_lock = threading.Lock()
STATS = {"published": 0, "dropped": 0}


def subscribe(user_id: str) -> queue.Queue:
    q: queue.Queue = queue.Queue(maxsize=200)
    with _lock:
        _subs.setdefault(user_id, []).append(q)
    return q


def unsubscribe(user_id: str, q: queue.Queue) -> None:
    with _lock:
        lst = _subs.get(user_id)
        if lst and q in lst:
            lst.remove(q)
        if lst == []:
            _subs.pop(user_id, None)


def publish(user_id: str, kind: str, payload: dict[str, Any]) -> int:
    """Deliver one frame to the user's open sockets; returns how many received it."""
    with _lock:
        targets = list(_subs.get(user_id, ()))
    n = 0
    for q in targets:
        try:
            q.put_nowait({"type": kind, "payload": payload})
            n += 1
        except queue.Full:
            STATS["dropped"] += 1
    STATS["published"] += n
    return n


def listeners(user_id: str) -> int:
    with _lock:
        return len(_subs.get(user_id, ()))
