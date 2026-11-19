"""The in-memory session caches of the sign-in stores (code review 2026-11-13, part 02, P1-1 and P2-4).

`SessionCache` is the one copy of the cache that `local_identity._Cache` (Arx-only sessions, sockets keyed by sign-in chain) and
`app_session._Cache` (the phone app's web-view sessions, sockets keyed by session) used to carry twice: a dict of loaded sessions with a
short time-to-live, the WebSockets attached to them, and the queue of sockets a revocation has to close. Each store keeps its own
subclass for what differs (the socket key, which drops close sockets, `peek_live`).

`get` is the stricter of the two former copies (lead decision L4, fail-closed): an entry loaded "in the future" (the wall clock moved
back since it was loaded) is dropped like an expired one, so the next request re-reads the session from the database. The cache is a
read-through cache only - a dropped entry never ends a session, it only costs one database read.

attach_if_live: the "review M2" rule of ha_user_auth.SessionStore.attach_socket, shared by all three stores. A WebSocket handshake
resolves its session in the thread pool and attaches afterwards; a revocation that lands in between drops the cache entry (and queues the
sockets already attached), but a socket attached after it would never be closed. The liveness check and the attach therefore run under
the cache's own lock, so a revocation is either before the check (refused) or after the attach (closed by the revocation). No database
read: "live" means the entry the resolve just put is still there.

Ended keys (the same idea as ha_user_auth.SessionStore._revoked_iss): a revocation drops the cache entries inside its own database
transaction, before the commit. A resolve that read the session row just before that commit (a read transaction sees the last committed
state) would otherwise put the revoked session back into the cache after the drop, where it would be served - and its WebSocket attached,
with nothing left to close it - until the time-to-live ran out. The keys a revocation ends are therefore remembered for ENDED_KEEP_S and
`put` refuses an entry under one of them: that request was concurrent with the revocation and is answered from its own read, every later
one reads the database again. A revocation that then rolls back has only over-revoked the cache (the safe side): the session keeps
working, read from the database on each request until the key is forgotten.

Held users (CR-APP-SESSION-CACHE-2443, the same race one level up): `drop_users` / `drop_user` run when a user's state changes without
ending a session (a factor removed or enrolled, a display-name change, an access change - services/revocation). The change commits after
the drop, so a request that read before the commit must not cache the old principal back: `put` refuses the user's sessions for the
store's `user_hold_s` (read through the store's own clock, so a test that moves the clock ends the hold; a clock that went back keeps it -
fail closed). A held user's session is not ended: `_user_held_live_locked` lets its WebSocket attach unless its own key was ended."""
from __future__ import annotations

import threading
import time
import weakref
from typing import Any, Callable, Generic, Protocol, TypeVar

MAX_ENTRIES = 5000  # above this, the oldest EVICT_BATCH entries go (insertion order); an evicted entry is simply re-read
EVICT_BATCH = 500
ENDED_KEEP_S = 300.0  # how long an ended key is refused by `put`: far longer than a revocation's transaction or a resolve's read


class CachedSession(Protocol):
    sid_hash: str
    user_id: str
    loaded_at: float
    expires_at: float
    idle_expires_at: float


S = TypeVar("S", bound=CachedSession)


def attach_if_live(lock: threading.Lock, sockets: dict[str, weakref.WeakSet], key: str, websocket: Any, *, live: Callable[[], bool]) -> bool:
    """Attach `websocket` under `key` only while `live()` holds, both under `lock`. False = the session ended since its lookup: the caller
    refuses the socket (4401), exactly as for an unknown cookie. `live` is called with `lock` held and must not take it again."""
    with lock:
        if not live():
            return False
        sockets.setdefault(key, weakref.WeakSet()).add(websocket)
        return True


def take_queued(holder: Any) -> list[Any]:
    """The sockets a revocation queued for closing (`holder._to_close`, under `holder._lock`), handed over once."""
    with holder._lock:
        out, holder._to_close = holder._to_close, []
    return out


class SessionCache(Generic[S]):
    """Loaded sessions by sid hash, their sockets by a store-specific key, and the close queue - all under one lock.

    `clock` and `ttl_s` are called on every lookup (not captured at construction), so a store's own clock - and a test that moves it -
    stays the one the cache reads. A subclass names the key its sockets and its revocations use (`_ended_key`: the session by default)."""

    def __init__(self, *, clock: Callable[[], float], ttl_s: Callable[[], float], user_hold_s: Callable[[], float] = lambda: 0.0) -> None:
        self._clock = clock
        self._ttl_s = ttl_s
        self._user_hold_s = user_hold_s
        self._lock = threading.Lock()
        self._by_sid: dict[str, S] = {}
        self._sockets: dict[str, weakref.WeakSet] = {}
        self._to_close: list[Any] = []
        self._ended: dict[str, float] = {}  # key -> time.monotonic() of its revocation (see the module docstring)
        self._held_users: dict[str, float] = {}  # user id -> store clock time of drop_users (CR-APP-SESSION-CACHE-2443)

    def _ended_key(self, s: S) -> str:
        return s.sid_hash

    def get(self, sid_hash: str) -> S | None:
        now = self._clock()
        with self._lock:
            s = self._by_sid.get(sid_hash)
            if s is None:
                return None
            if now - s.loaded_at > self._ttl_s() or now < s.loaded_at or s.expires_at <= now or s.idle_expires_at <= now:
                self._by_sid.pop(sid_hash, None)
                return None
            return s

    def _key_ended_locked(self, key: str) -> bool:
        ended_at = self._ended.get(key) if self._ended else None
        return ended_at is not None and time.monotonic() - ended_at <= ENDED_KEEP_S

    def _user_held_locked(self, user_id: str, now: float) -> bool:
        at = self._held_users.get(user_id) if self._held_users else None
        if at is None:
            return False
        if now - at < self._user_hold_s():
            return True
        self._held_users.pop(user_id, None)
        return False

    def _put_refused_locked(self, s: S) -> bool:
        """True = do not cache `s`: its key was ended, or its user is held, since the caller read it (see the module docstring)."""
        return self._key_ended_locked(self._ended_key(s)) or self._user_held_locked(s.user_id, self._clock())

    def _user_held_live_locked(self, key: str, user_id: str) -> bool:
        """For `attach`: a session absent from the cache only because its USER is held (not an ending) is still live."""
        return bool(user_id) and not self._key_ended_locked(key) and self._user_held_locked(user_id, self._clock())

    def put(self, s: S) -> None:
        """Cache `s` - unless a revocation ended its key meanwhile (the resolve read the row before that revocation committed), or its
        user's state changed meanwhile (drop_users)."""
        with self._lock:
            if self._put_refused_locked(s):
                return
            if len(self._by_sid) > MAX_ENTRIES:
                for k in list(self._by_sid)[:EVICT_BATCH]:
                    self._by_sid.pop(k, None)
            self._by_sid[s.sid_hash] = s

    def drop_user(self, user_id: str) -> None:
        self.drop_users({user_id})

    def drop_users(self, user_ids: set[str]) -> None:
        """The users' entries only (the next request re-reads), held for `user_hold_s`; attached sockets stay - a revocation closes them
        through its own drop."""
        if not user_ids:
            return
        now = self._clock()
        with self._lock:
            if len(self._held_users) > MAX_ENTRIES:
                hold = self._user_hold_s()
                for k in [k for k, at in self._held_users.items() if now - at >= hold]:
                    del self._held_users[k]
            for u in user_ids:
                self._held_users[u] = now
            for k in [k for k, v in self._by_sid.items() if v.user_id in user_ids]:
                self._by_sid.pop(k, None)

    def _end_keys_locked(self, keys: Any) -> None:
        """A revocation of `keys` (the caller holds the lock and has dropped their entries): the sockets attached under them are queued
        for closing, and `put` refuses the keys for ENDED_KEEP_S."""
        now = time.monotonic()
        for key in [k for k, at in self._ended.items() if now - at > ENDED_KEEP_S]:
            del self._ended[key]
        for key in keys:
            self._ended[key] = now
            socks = self._sockets.pop(key, None)
            if socks:
                self._to_close.extend(list(socks))

    def _attach(self, key: str, websocket: Any, live: Callable[[], bool]) -> bool:
        return attach_if_live(self._lock, self._sockets, key, websocket, live=live)

    def take_to_close(self) -> list[Any]:
        return take_queued(self)

    def forget_ended(self) -> None:
        """Tests only (reset_for_tests): forget the ended keys and the held users."""
        with self._lock:
            self._ended.clear()
            self._held_users.clear()

    def clear(self) -> None:
        """Every entry goes and every socket is queued for closing; the ended keys stay (a revocation of everything names its keys
        through the subclass's drop first). The held users go too: nothing of theirs is cached any more."""
        with self._lock:
            self._by_sid.clear()
            self._held_users.clear()
            for socks in self._sockets.values():
                self._to_close.extend(list(socks))
            self._sockets.clear()
