"""CR-038 section 10.2: the rate limits of the public listener - checked BEFORE any database read (review T2).

Three parts:

1. `ScopedRateLimiter` - sliding-window hit counters per key, written behind to `block_counters` under a SCOPE of their own.
   It is the scope-parameterised form of services/ha_user_auth.RateLimiter (hard-wired to scope `signin`; review C5 / spec
   1B "the limiter gains a scope parameter"): the same bounded key table (MAX_KEYS / LOW_WATER, cold keys evicted first), the
   same half-cap persistence rule (a key is written only once it reached half of a cap - one request from a fresh address is
   never a row), the same flush / restore contract - plus a `horizon_s` per scope (the persisted row lives until the longest
   window of THAT scope has passed; the sign-in limiter's horizon is its own 1 h), `check` (how long until a slot frees,
   nothing recorded) and `record` (count unconditionally: a failure). ha_user_auth.RateLimiter itself is not touched on this
   branch (new files only); it can be re-based on this class later (notes, follow-up).

2. Client network keys. The bucket of a request is the /24 (IPv4) or /64 (IPv6) of its client address. `CF-Connecting-IP` is
   believed ONLY when the TCP peer is inside the trusted proxy networks (`tickets.settings.public.trusted_proxy_cidrs`,
   default the hassio network 172.30.32.0/23 where cloudflared runs); any other peer - a mapped host port, the LAN - is keyed
   by its own address and the header is ignored (review T1a). Residual: every add-on on the hassio network is inside the
   trusted network and could set the header; only the installation-wide caps hold against such a peer.

3. `PublicRateGate` - the policy of spec 10.2 on top of one limiter (scope `tickets_link`):
   - unknown tokens: 20 failures / minute per client network and 300 / minute installation-wide; past either, 429 for every
     request that needs a lookup - except a token this process saw resolve to a live link within the last 15 minutes
     ("known good"), so a flood of guesses does not lock out the vendors already working (review T1b mitigated; a FRESH
     link's first open can still meet the 429 during a flood - the page then says "try again in a minute", never
     "unavailable");
   - a token: 60 requests / minute; writes 20 / hour; photos 10 / hour; invoice files 40 / hour;
   - the e-mail redeem route: 10 / minute per network (on top of the failure caps);
   - the static shell and the health route: 120 / minute per network.
   The per-link verification-code caps (1 / minute, 3 / hour, 6 / day) live in codes.py over the code rows; the
   per-recipient one (6 / hour across links) uses this limiter too."""
from __future__ import annotations

import collections
import ipaddress
import json
import math
import re
import sqlite3
import threading
import time
from dataclasses import dataclass
from typing import Any, Callable, Iterable, Sequence

Limits = tuple[tuple[float, int], ...]
Network = ipaddress.IPv4Network | ipaddress.IPv6Network
Address = ipaddress.IPv4Address | ipaddress.IPv6Address

SCOPE_RE = re.compile(r"[a-z][a-z0-9_]{0,31}")
FOREIGN_SCOPES = frozenset({"signin", "alarm_code"})  # rows other services own in block_counters


class ScopedRateLimiter:
    """Sliding-window counters per key; thread safe; `hit`, `check`, `record` never touch the database."""

    MAX_KEYS = 20000
    LOW_WATER = 18000
    FLUSH_MAX = 2000
    MAX_EVENTS = 1024  # instants kept per key (the newest); far above every cap of the public gate

    def __init__(self, scope: str, *, horizon_s: float, clock: Callable[[], float] = time.time, max_keys: int | None = None,
                 low_water: int | None = None, max_events: int | None = None) -> None:
        if not isinstance(scope, str) or not SCOPE_RE.fullmatch(scope) or scope in FOREIGN_SCOPES:
            raise ValueError("scope must be a short lowercase name that no other service uses")
        if not horizon_s > 0:
            raise ValueError("horizon_s must be positive")
        self.scope = scope
        self.horizon_s = float(horizon_s)
        self.clock = clock
        self.max_keys = max_keys or self.MAX_KEYS
        self.low_water = low_water or min(self.LOW_WATER, int(self.max_keys * 0.9))
        self.max_events = max_events or self.MAX_EVENTS
        self._lock = threading.Lock()
        self._hits: collections.OrderedDict[str, collections.deque[float]] = collections.OrderedDict()  # least recently used first
        self._dirty: set[str] = set()
        self._persisted: set[str] = set()

    # ---------------------------------------------------------------- the hot path (memory only)

    def _queue(self, key: str, now: float, create: bool) -> collections.deque[float] | None:
        q = self._hits.get(key)
        if q is None:
            if not create:
                return None
            q = self._hits[key] = collections.deque(maxlen=self.max_events)
        else:
            self._hits.move_to_end(key)
        while q and now - q[0] > self.horizon_s:
            q.popleft()
        return q

    @staticmethod
    def _count(q: collections.deque[float], now: float, window: float) -> int:
        n = 0
        for t in reversed(q):
            if now - t > window:
                break
            n += 1
        return n

    @classmethod
    def _wait(cls, q: collections.deque[float] | None, now: float, limits: Sequence[tuple[float, int]]) -> float:
        """Seconds until every window of `limits` has a free slot (0.0 = now)."""
        if not q:
            return 0.0
        wait = 0.0
        for window, cap in limits:
            n = cls._count(q, now, window)
            if n >= cap:
                if cap <= 0:
                    return float(window)
                frees_at = q[len(q) - cap] + window
                wait = max(wait, frees_at - now)
        return max(wait, 0.0)

    def _note(self, key: str, counts: Iterable[int], limits: Sequence[tuple[float, int]]) -> None:
        if key in self._persisted or any(n >= max(1, (cap + 1) // 2) for n, (_w, cap) in zip(counts, limits)):
            self._dirty.add(key)
            self._persisted.add(key)
        if len(self._hits) > self.max_keys:
            self._shrink(self.clock())

    def hit(self, key: str, limits: Sequence[tuple[float, int]]) -> bool:
        """Record one attempt; False (and nothing recorded) when any window is already full."""
        now = self.clock()
        with self._lock:
            q = self._queue(key, now, create=True)
            assert q is not None
            if self._wait(q, now, limits) > 0.0:
                return False
            q.append(now)
            self._note(key, (self._count(q, now, w) for w, _ in limits), limits)
            return True

    def check(self, key: str, limits: Sequence[tuple[float, int]]) -> float:
        """Seconds until the next attempt would pass (0.0 = it passes now). Records nothing."""
        now = self.clock()
        with self._lock:
            return self._wait(self._queue(key, now, create=False), now, limits)

    def record(self, key: str, limits: Sequence[tuple[float, int]]) -> None:
        """Count one event whatever the windows say (a failure). Hammering past a cap keeps the window full - the lock slides."""
        now = self.clock()
        with self._lock:
            q = self._queue(key, now, create=True)
            assert q is not None
            q.append(now)
            self._note(key, (self._count(q, now, w) for w, _ in limits), limits)

    def count(self, key: str, window_s: float) -> int:
        now = self.clock()
        with self._lock:
            q = self._queue(key, now, create=False)
            return self._count(q, now, window_s) if q else 0

    def forget(self, key: str) -> None:
        """Drop a key from memory and mark it for deletion at the next flush (a row, if any, goes too)."""
        with self._lock:
            q = self._hits.get(key)
            if q is None:
                return
            q.clear()
            if key in self._persisted:
                self._dirty.add(key)
            else:
                self._hits.pop(key, None)

    def _shrink(self, now: float) -> None:
        """Under the lock: expired keys first, then cold ones (never near a cap), then the least recently used, down to
        LOW_WATER. An evicted key keeps its row (if any) until the row expires; it is no longer flushed."""
        for k in [k for k, v in self._hits.items() if not v or now - v[-1] > self.horizon_s]:
            self._drop(k)
        for hot in (False, True):
            if len(self._hits) <= self.low_water:
                return
            for k in [k for k in self._hits if (k in self._persisted) == hot][: len(self._hits) - self.low_water]:
                self._drop(k)

    def _drop(self, k: str) -> None:
        self._hits.pop(k, None)
        self._dirty.discard(k)
        self._persisted.discard(k)

    def clear(self) -> None:
        with self._lock:
            self._hits.clear()
            self._dirty.clear()
            self._persisted.clear()

    @property
    def keys(self) -> int:
        return len(self._hits)

    @property
    def dirty(self) -> int:
        return len(self._dirty)

    # ---------------------------------------------------------------- persistence (block_counters, migration 0071)

    def flush(self, conn: sqlite3.Connection) -> int:
        """Write the keys that changed since the last flush (at most FLUSH_MAX); returns how many. A row lives until `horizon_s`
        after its newest instant; an emptied key deletes its row. A busy database puts the batch back for the next flush."""
        with self._lock:
            keys = list(self._dirty)[: self.FLUSH_MAX]
            batch = {k: list(self._hits.get(k, ())) for k in keys}
            self._dirty.difference_update(keys)
        if not batch:
            return 0
        try:
            for k, hits in batch.items():
                if hits:
                    conn.execute(
                        "INSERT INTO block_counters(scope, key, hits_json, expires_at) VALUES (?,?,?,?) "
                        "ON CONFLICT(scope, key) DO UPDATE SET hits_json = excluded.hits_json, expires_at = excluded.expires_at",
                        (self.scope, k, json.dumps(hits), hits[-1] + self.horizon_s))
                else:
                    conn.execute("DELETE FROM block_counters WHERE scope = ? AND key = ?", (self.scope, k))
        except sqlite3.OperationalError:
            with self._lock:
                self._dirty.update(k for k in batch if k in self._hits)
            return 0
        with self._lock:
            for k, hits in batch.items():
                if not hits and not self._hits.get(k):
                    self._persisted.discard(k)
                    self._hits.pop(k, None)
        return len(batch)

    def restore(self, conn: sqlite3.Connection) -> int:
        """Load the counters a previous process left (rows of this scope not yet expired); returns the number of keys."""
        now = self.clock()
        try:
            rows = conn.execute("SELECT key, hits_json FROM block_counters WHERE scope = ? AND expires_at > ?", (self.scope, now)).fetchall()
        except sqlite3.OperationalError:
            return 0
        n = 0
        with self._lock:
            for key, raw in ((r[0], r[1]) for r in rows):
                try:
                    stored = sorted(float(x) for x in json.loads(raw or "[]") if now - self.horizon_s < float(x) <= now)
                except (ValueError, TypeError):
                    continue
                if not stored:
                    continue
                q = self._hits.get(key)
                if q is None:
                    q = self._hits[key] = collections.deque(maxlen=self.max_events)
                merged = sorted([*q, *stored])
                q.clear()
                q.extend(merged)
                self._persisted.add(key)
                n += 1
        return n

    def flush_to(self, db: Any) -> int:
        """The janitor step (every 30 s) and the shutdown: write the changed counters, then drop this scope's expired rows. No
        write lock at all when nothing changed."""
        if not self._dirty:
            return 0
        with db.connection(label=f"rate_limiter.{self.scope}.flush") as conn:
            n = self.flush(conn)
            try:
                conn.execute("DELETE FROM block_counters WHERE scope = ? AND expires_at <= ?", (self.scope, self.clock()))
            except sqlite3.OperationalError:
                pass
            return n

    def restore_from(self, db: Any) -> int:
        with db.connection(mode="read", label=f"rate_limiter.{self.scope}.restore") as conn:
            return self.restore(conn)


# ---------------------------------------------------------------- client network keys

DEFAULT_TRUSTED_PROXY_CIDRS = ("172.30.32.0/23",)


def parse_trusted_cidrs(values: Iterable[object]) -> tuple[Network, ...]:
    """`tickets.settings.public.trusted_proxy_cidrs` as networks. ValueError for a value that is not a network, and for one
    broader than /8 (IPv4) or /32 (IPv6): trusting `0.0.0.0/0` would let every client choose its own bucket."""
    out: list[Network] = []
    for v in values:
        if not isinstance(v, str):
            raise ValueError("trusted_proxy_cidrs: every entry is a network in CIDR notation")
        try:
            net = ipaddress.ip_network(v.strip(), strict=False)
        except ValueError:
            raise ValueError("trusted_proxy_cidrs: not a network") from None
        if net.prefixlen < (8 if net.version == 4 else 32):
            raise ValueError("trusted_proxy_cidrs: too broad")
        out.append(net)
    return tuple(out)


def parse_address(value: object) -> Address | None:
    """An IP address (a scope id `%eth0` dropped, an IPv4-mapped IPv6 address as its IPv4 address), else None."""
    if not isinstance(value, str) or not value or len(value) > 64:
        return None
    try:
        addr = ipaddress.ip_address(value.strip().split("%", 1)[0])
    except ValueError:
        return None
    if isinstance(addr, ipaddress.IPv6Address) and addr.ipv4_mapped is not None:
        return addr.ipv4_mapped
    return addr


def client_address(peer: str | None, forwarded: Sequence[str], trusted: Sequence[Network]) -> Address | None:
    """The address a request is counted under: the single `CF-Connecting-IP` value when the TCP peer is trusted and the value
    is one address; otherwise the peer itself (a missing, repeated or malformed header from a trusted peer counts as the peer)."""
    p = parse_address(peer)
    if p is None:
        return None
    if len(forwarded) == 1 and any(p in net for net in trusted if net.version == p.version):
        f = parse_address(forwarded[0])
        if f is not None:
            return f
    return p


def network_key(addr: Address | None) -> str:
    if addr is None:
        return "unknown"
    if isinstance(addr, ipaddress.IPv4Address):
        return str(ipaddress.IPv4Network((int(addr) >> 8 << 8, 24)))
    return str(ipaddress.IPv6Network((int(addr) >> 64 << 64, 64)))


def client_network(peer: str | None, forwarded: Sequence[str], trusted: Sequence[Network]) -> str:
    """The rate-limit bucket of a request: the /24 or /64 of `client_address`, or "unknown"."""
    return network_key(client_address(peer, forwarded, trusted))


# ---------------------------------------------------------------- the policy of the public listener

ROUTE_KINDS = ("static", "health", "token_read", "token_write", "photo", "claim_file", "code", "redeem")
TOKEN_KINDS = frozenset({"token_read", "token_write", "photo", "claim_file", "code"})


@dataclass(frozen=True)
class PublicLimits:
    """The numbers of spec 10.2 / 10.5 / 11A.6 (constants, not settings)."""

    static_per_network: Limits = ((60.0, 120),)
    unknown_per_network: Limits = ((60.0, 20),)
    unknown_global: Limits = ((60.0, 300),)
    token_requests: Limits = ((60.0, 60),)
    token_writes: Limits = ((3600.0, 20),)
    token_photos: Limits = ((3600.0, 10),)
    token_claim_files: Limits = ((3600.0, 40),)
    redeem_per_network: Limits = ((60.0, 10),)
    code_per_recipient: Limits = ((3600.0, 6),)
    known_good_ttl_s: float = 900.0
    known_good_max: int = 5000

    @property
    def horizon_s(self) -> float:
        windows = [w for lim in (self.static_per_network, self.unknown_per_network, self.unknown_global, self.token_requests,
                                 self.token_writes, self.token_photos, self.token_claim_files, self.redeem_per_network,
                                 self.code_per_recipient) for w, _ in lim]
        return max(windows)


@dataclass(frozen=True)
class Decision:
    ok: bool
    reason: str = "ok"  # ok | no_token | network_locked | flood | token_rate | write_rate | photo_rate | claim_file_rate | redeem_rate | static_rate
    retry_after_s: int = 0


class MinuteCounter:
    """Events per minute over the last 24 hours in a ring of 1440 buckets (health counters)."""

    SLOTS = 1440

    def __init__(self, clock: Callable[[], float] = time.time) -> None:
        self._clock = clock
        self._slots = [0] * self.SLOTS
        self._minutes = [-1] * self.SLOTS
        self._lock = threading.Lock()

    def add(self, n: int = 1) -> None:
        minute = int(self._clock() // 60)
        i = minute % self.SLOTS
        with self._lock:
            if self._minutes[i] != minute:
                self._minutes[i], self._slots[i] = minute, 0
            self._slots[i] += n

    def total(self, minutes: int = SLOTS) -> int:
        now = int(self._clock() // 60)
        with self._lock:
            return sum(c for m, c in zip(self._minutes, self._slots) if 0 <= now - m < minutes)


class PublicRateGate:
    """Spec 10.2 on one limiter. `admit` runs before anything reads the database or the body; `failure` / `success` after the
    one lookup."""

    def __init__(self, limiter: ScopedRateLimiter, limits: PublicLimits | None = None) -> None:
        self.limiter = limiter
        self.limits = limits or PublicLimits()
        if limiter.horizon_s < self.limits.horizon_s:
            raise ValueError("the limiter's horizon is shorter than the longest window of the public limits")
        caps = [cap for name in ("static_per_network", "unknown_per_network", "unknown_global", "token_requests", "token_writes",
                                 "token_photos", "token_claim_files", "redeem_per_network", "code_per_recipient")
                for _w, cap in getattr(self.limits, name)]
        if max(caps) >= limiter.max_events:
            raise ValueError("a cap of the public limits does not fit the limiter's per-key event memory")
        self._good: collections.OrderedDict[str, float] = collections.OrderedDict()
        self._lock = threading.Lock()
        self._trips: dict[str, MinuteCounter] = {}

    @property
    def clock(self) -> Callable[[], float]:
        return self.limiter.clock

    # ---------------------------------------------------------------- known good tokens

    def known_good(self, token_key: str | None) -> bool:
        if not token_key:
            return False
        now = self.clock()
        with self._lock:
            until = self._good.get(token_key)
            if until is None:
                return False
            if until <= now:
                self._good.pop(token_key, None)
                return False
            return True

    def success(self, token_key: str) -> None:
        """The token resolved to a live link: it is "known good" for known_good_ttl_s."""
        now = self.clock()
        with self._lock:
            self._good[token_key] = now + self.limits.known_good_ttl_s
            self._good.move_to_end(token_key)
            while len(self._good) > self.limits.known_good_max:
                self._good.popitem(last=False)

    def failure(self, net: str, token_key: str | None = None) -> None:
        """An unknown / unavailable token (or redeem id): one failure for the client network and one installation-wide."""
        self.limiter.record(f"fail:{net}", self.limits.unknown_per_network)
        self.limiter.record("fail:*", self.limits.unknown_global)
        if token_key:
            with self._lock:
                self._good.pop(token_key, None)

    # ---------------------------------------------------------------- the decision

    def _refuse(self, reason: str, wait: float) -> Decision:
        counter = self._trips.get(reason)
        if counter is None:
            counter = self._trips.setdefault(reason, MinuteCounter(self.clock))
        counter.add()
        return Decision(False, reason, max(1, math.ceil(wait)))

    def _locks(self, net: str) -> Decision | None:
        wait = self.limiter.check(f"fail:{net}", self.limits.unknown_per_network)
        if wait > 0:
            return self._refuse("network_locked", wait)
        wait = self.limiter.check("fail:*", self.limits.unknown_global)
        if wait > 0:
            return self._refuse("flood", wait)
        return None

    def _hit(self, key: str, limits: Limits, reason: str) -> Decision | None:
        if self.limiter.hit(key, limits):
            return None
        return self._refuse(reason, self.limiter.check(key, limits))

    def admit(self, kind: str, net: str, token_key: str | None = None) -> Decision:
        """May this request go on to its lookup / body? `token_key` is links.limiter_key of the presented token (None when the
        request carries none or a malformed one)."""
        if kind in ("static", "health"):
            return self._hit(f"s:{net}", self.limits.static_per_network, "static_rate") or Decision(True)
        if kind == "redeem":
            return self._locks(net) or self._hit(f"r:{net}", self.limits.redeem_per_network, "redeem_rate") or Decision(True)
        if kind not in TOKEN_KINDS:
            raise ValueError(f"unknown route kind {kind!r}")
        if not token_key:
            # nothing to look up: a failure without any lookup (the caller records it and answers the uniform 404) - unless
            # the network is already locked, which it learns first
            return self._locks(net) or Decision(False, "no_token", 0)
        if not self.known_good(token_key):
            locked = self._locks(net)
            if locked is not None:
                return locked
        refused = self._hit(token_key, self.limits.token_requests, "token_rate")
        if refused is None and kind == "token_write":
            refused = self._hit("w:" + token_key, self.limits.token_writes, "write_rate")
        elif refused is None and kind == "photo":
            refused = self._hit("p:" + token_key, self.limits.token_photos, "photo_rate")
        elif refused is None and kind == "claim_file":
            refused = self._hit("c:" + token_key, self.limits.token_claim_files, "claim_file_rate")
        return refused or Decision(True)

    def trips(self, minutes: int = MinuteCounter.SLOTS) -> dict[str, int]:
        """Refusals per reason over the last `minutes` (health: "rate-limit trips last 24 h")."""
        return {reason: c.total(minutes) for reason, c in sorted(self._trips.items())}


def new_public_limiter(clock: Callable[[], float] = time.time, limits: PublicLimits | None = None) -> ScopedRateLimiter:
    """The limiter of the public listener: scope `tickets_link`, horizon = the longest public window."""
    return ScopedRateLimiter("tickets_link", horizon_s=(limits or PublicLimits()).horizon_s, clock=clock)
