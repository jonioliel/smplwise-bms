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

3. `PublicRateGate` - the policy of spec 10.2 on two limiters (scope `tickets_link`: the windows; scope `tickets_good`: the
   tokens that resolved to a live link within 24 h, persisted, so neither a flood nor a restart locks working vendors out):
   - failed lookups: 20 / minute per client network and 300 / minute installation-wide (tokens), 300 / minute (redeem ids,
     their own budget); past them, 429 for every request that would need a lookup - except a known-good token (review T1b
     mitigated; a FRESH link's first open can still meet the 429 during a flood - the page then says "try again in a
     minute", never "unavailable"). A request with no well-formed token is refused without a lookup and counts against its
     network only - it cannot fill the installation-wide budget;
   - a token: 60 requests / minute (recorded only once the token proved valid: unknown tokens create no key); writes
     20 / hour, photos 10 / hour, invoice files 40 / hour - checked at admission, SPENT only once the effect happened;
   - the e-mail redeem route: 10 / minute per network (on top of the failure caps);
   - the static shell, the health route and unmatched paths: 120 / minute per network; hashed (immutable) page assets
     300 / minute per network (code review V26: one page load is the shell + ~5 assets);
   - photo reads (`GET /t/api/photo/<id>`): their own per-token window, 120 / minute (V26: a ticket with 40 photos must not
     spend the token's 60 / minute on one page load).
   The keys only valid tokens create (per-token windows and budgets, per-recipient code counts, the global failure counts)
   are never evicted to make room in the key table. The per-link verification-code caps (1 / minute, 3 / hour, 6 / day) live
   in codes.py over the code rows; the per-recipient one (6 / hour across links) uses this limiter too.

4. `RequestCost` (code review 5.1, 2026-10-13) - what ONE request costs, decided explicitly on every exit path. The two High
   findings of that review (V1, V2) were both "an exit path that costs nothing"; the edge (public_http) opens one cost per
   request at admission (`PublicRateGate.open`) and every exit calls one of: `proved` (the one lookup found a live link),
   `unknown` (it did not), `refused_early` (413 / 415 / a malformed shape before any lookup - one network failure unless the
   token is known good), `body_phase` (an UPLOAD starts reading its body: one unit of its budget NOW, whatever follows - a
   trickled 408, a 413, a disconnect, a replay, a refusal after the body, the stored photo), `effect` (a write's effect
   happened: one unit, unless the body phase already paid)."""
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
        self._protected: tuple[str, ...] = ()

    def protect(self, prefixes: Iterable[str]) -> None:
        """Keys starting with one of `prefixes` (or equal to one) are never evicted to make room - only dropped once expired."""
        self._protected = tuple(prefixes)

    def _is_protected(self, key: str) -> bool:
        return bool(self._protected) and key.startswith(self._protected)

    # ---------------------------------------------------------------- the hot path (memory only)

    def _queue(self, key: str, now: float, create: bool, keep_s: float | None = None) -> collections.deque[float] | None:
        """The key's instants, pruned to `keep_s` (the longest window of the limits the caller uses with this key - every key
        prefix has ONE set of limits) or the scope's horizon: a key of a 60 s window keeps one minute of instants, not an
        hour (code review V9: the per-key memory follows the key's own window)."""
        q = self._hits.get(key)
        if q is None:
            if not create:
                return None
            q = self._hits[key] = collections.deque(maxlen=self.max_events)
        else:
            self._hits.move_to_end(key)
        keep = self.horizon_s if keep_s is None else min(self.horizon_s, keep_s)
        while q and now - q[0] > keep:
            q.popleft()
        return q

    @staticmethod
    def _keep(limits: Sequence[tuple[float, int]]) -> float | None:
        return max((w for w, _ in limits), default=None)

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
            q = self._queue(key, now, create=True, keep_s=self._keep(limits))
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
            return self._wait(self._queue(key, now, create=False, keep_s=self._keep(limits)), now, limits)

    def record(self, key: str, limits: Sequence[tuple[float, int]]) -> None:
        """Count one event whatever the windows say (a failure). Hammering past a cap keeps the window full - the lock slides."""
        now = self.clock()
        with self._lock:
            q = self._queue(key, now, create=True, keep_s=self._keep(limits))
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
        LOW_WATER - never a protected key (see `protect`). An evicted key keeps its row (if any) until the row expires; it is no
        longer flushed."""
        for k in [k for k, v in self._hits.items() if not v or now - v[-1] > self.horizon_s]:
            self._drop(k)
        for hot in (False, True):
            if len(self._hits) <= self.low_water:
                return
            victims = [k for k in self._hits if (k in self._persisted) == hot and not self._is_protected(k)]
            for k in victims[: len(self._hits) - self.low_water]:
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
        try:
            with db.connection(label=f"rate_limiter.{self.scope}.flush") as conn:
                n = self.flush(conn)
                try:
                    conn.execute("DELETE FROM block_counters WHERE scope = ? AND expires_at <= ?", (self.scope, self.clock()))
                except sqlite3.OperationalError:
                    pass
                return n
        except sqlite3.OperationalError:
            # the write gate itself was busy (`BEGIN IMMEDIATE` under another writer) - raised before flush() was entered, or
            # at commit: nothing was written for sure, the dirty set is intact or put back; the next janitor tick retries.
            # Never an exception out of the janitor step (W15).
            return 0

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


CLIENT_IP_HEADERS = ("cf-connecting-ip", "x-forwarded-for")


def forwarded_values(header: str, values: Sequence[str]) -> list[str]:
    """The client-address candidates of the trusted header (`tickets.settings.public.client_ip_header`, code review V3):
    `cf-connecting-ip` (the default, cloudflared) as sent - exactly one value is believed; `x-forwarded-for` (another reverse
    proxy) - only the LAST hop of all its lines, the address the trusted proxy itself saw (every earlier hop is whatever the
    client wrote)."""
    if header == "x-forwarded-for":
        hops = [h.strip() for h in ",".join(values).split(",")]
        return [hops[-1]] if hops and hops[-1] else []
    return list(values)


def classify_client(peer: str | None, forwarded: Sequence[str], trusted: Sequence[Network]) -> tuple[str, str]:
    """(network key, source) - `source` says where the address came from, for the health counters (V3): `header` (a trusted
    peer and one usable header value), `trusted_no_header` (a trusted peer WITHOUT one: if most requests are keyed this way,
    every client shares the proxy's bucket - the proxy is not sending the header, or it is not the expected proxy), `peer`
    (an untrusted peer, keyed by itself; its header ignored), `unknown` (no usable peer address)."""
    p = parse_address(peer)
    if p is None:
        return "unknown", "unknown"
    if any(p in net for net in trusted if net.version == p.version):
        if len(forwarded) == 1:
            f = parse_address(forwarded[0])
            if f is not None:
                return network_key(f), "header"
        return network_key(p), "trusted_no_header"
    return network_key(p), "peer"


# ---------------------------------------------------------------- the policy of the public listener

ROUTE_KINDS = ("static", "asset", "health", "token_read", "photo_read", "file_read", "token_write", "photo", "claim_file", "rfq_upload", "code",
               "redeem", "portal_start", "portal_verify", "portal_read",  # + VPORTAL: the vendor portal's routes (per client network, no token)
               "portal_write")  # + VPORTALRFQ: the portal's one write (a technician request / its withdrawal), after the session check
TOKEN_KINDS = frozenset({"token_read", "photo_read", "file_read", "token_write", "photo", "claim_file", "rfq_upload", "code"})
# their body phase is paid when it starts (RequestCost.body_phase); RFQ-VENDOR-UPLOAD: a vendor's file on his quote (`rfq_upload`)
UPLOAD_KINDS = frozenset({"photo", "claim_file", "rfq_upload"})


@dataclass(frozen=True)
class PublicLimits:
    """The numbers of spec 10.2 / 10.5 / 11A.6 (constants, not settings)."""

    static_per_network: Limits = ((60.0, 120),)
    asset_per_network: Limits = ((60.0, 300),)  # hashed, immutable page assets (V26); Cloudflare's cache absorbs repeats
    unknown_per_network: Limits = ((60.0, 20),)
    unknown_global: Limits = ((60.0, 300),)  # failed LOOKUPS of well-formed tokens, installation-wide
    redeem_global: Limits = ((60.0, 300),)  # failed redeem releases, installation-wide (its own: a token flood never blocks e-mail links)
    token_requests: Limits = ((60.0, 60),)
    token_photo_reads: Limits = ((60.0, 120),)  # GET /t/api/photo/<id>: its own window (V26)
    # RFQATT review F4: the full-size request files (documents up to 10 MiB, the Range header is dropped at the edge, so every read is
    # the whole file): 20 a minute and 60 an hour per link - at most ~600 MiB an hour from one link instead of ~20 MB/s; 10 files
    # opened 6 times each in an hour still fit. Thumbnails stay on token_photo_reads.
    token_file_reads: Limits = ((60.0, 20), (3600.0, 60))
    token_writes: Limits = ((3600.0, 20),)
    token_photos: Limits = ((3600.0, 10),)
    token_claim_files: Limits = ((3600.0, 40),)
    # RFQ-VENDOR-UPLOAD (contract 19.10): a vendor's files on his quote - per LINK (an upload's body phase spends one, whatever
    # follows: 5 live files + a few retries / replacements an hour) and per CLIENT NETWORK (/24 or /64, checked and counted at
    # admission before any lookup: one network cannot spread uploads over many stolen / forwarded links)
    token_rfq_uploads: Limits = ((3600.0, 12),)
    rfq_upload_per_network: Limits = ((600.0, 12), (3600.0, 30))
    redeem_per_network: Limits = ((60.0, 10),)
    code_per_recipient: Limits = ((3600.0, 6),)
    # VPORTAL (the vendor portal, services/tickets/vendor_portal.py): per client network (/24 or /64) and installation-wide. The
    # per-NUMBER caps live in the code rows (1 / 60 s, 3 / h, 6 / day) and never answer differently (no enumeration).
    portal_start_per_network: Limits = ((600.0, 10), (3600.0, 30))  # within the limiter's 1 h horizon (no longer window here)
    portal_start_global: Limits = ((3600.0, 300),)
    portal_verify_per_network: Limits = ((600.0, 30),)
    portal_read_per_network: Limits = ((60.0, 120),)
    # VPORTALRFQ: the technician requests - a write of a signed-in session (per company: 5 pending / 10 a day, in the rows themselves)
    portal_write_per_network: Limits = ((600.0, 10), (3600.0, 20))
    portal_write_global: Limits = ((3600.0, 200),)
    known_good_ttl_s: float = 86400.0

    WINDOW_NAMES = ("static_per_network", "asset_per_network", "unknown_per_network", "unknown_global", "redeem_global",
                    "token_requests", "token_photo_reads", "token_file_reads", "token_writes", "token_photos", "token_claim_files",
                    "token_rfq_uploads", "rfq_upload_per_network", "redeem_per_network", "code_per_recipient", "portal_start_per_network", "portal_start_global",
                    "portal_verify_per_network", "portal_read_per_network", "portal_write_per_network", "portal_write_global")

    @property
    def horizon_s(self) -> float:
        return max(w for name in self.WINDOW_NAMES for w, _ in getattr(self, name))

    @property
    def max_cap(self) -> int:
        return max(cap for name in self.WINDOW_NAMES for _w, cap in getattr(self, name))


# the per-token budgets a route SPENDS once its effect happened (PublicRateGate.spend): checked before the lookup, recorded after
SPEND = {"token_write": ("w:", "token_writes", "write_rate"), "photo": ("p:", "token_photos", "photo_rate"),
         "claim_file": ("c:", "token_claim_files", "claim_file_rate"), "rfq_upload": ("u:", "token_rfq_uploads", "rfq_upload_rate")}
# per-token request windows of their own (prefix of the token key, limits); every other token kind uses the token key itself
# with token_requests
WINDOWS = {"photo_read": ("pr:", "token_photo_reads"), "file_read": ("fr:", "token_file_reads")}
# keys only valid tokens / links create: never evicted from the key table (only expired), so an address-rotating flood of
# per-network keys cannot reset a vendor's budgets or a recipient's code count
PROTECTED_PREFIXES = ("t:", "pr:", "fr:", "w:", "p:", "c:", "u:", "cr:", "fail:*", "fail:redeem")


@dataclass(frozen=True)
class Decision:
    ok: bool
    reason: str = "ok"  # ok | no_token | network_locked | flood | token_rate | write_rate | photo_rate | claim_file_rate | redeem_rate | static_rate
    retry_after_s: int = 0
    counted: bool = False  # the token's request was already counted at admission (a known-good token); else success() counts it


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
    """Spec 10.2 on two limiters: `limiter` (scope `tickets_link`: the windows) and `good` (scope `tickets_good`: the tokens
    that resolved to a live link within known_good_ttl_s - persisted like the windows, so a restart does not lock working
    vendors out during a flood). `admit` runs before anything reads the database or the body; `failure` / `success` after the
    one lookup; `spend` after a route's effect (a write stored, a NEW photo stored).

    What counts where (review findings, 2026-10-13):
    - a request without a well-formed token never reaches a lookup: it counts against its network only, never against the
      installation-wide failure budget (it costs nothing to refuse, so it must not be able to fill the budget that protects
      lookups);
    - a well-formed token that is not known good is only CHECKED against its per-token request window before the lookup; the
      request is recorded by `success()` once the token proved valid - unknown tokens create no per-token key at all;
    - the per-token write / photo / file budgets are checked at admission and spent after the effect, so retries, `busy`
      answers and idempotent replays do not use up a vendor's hourly budget;
    - redeem ids have their own installation-wide failure budget: a flood of token guesses does not block e-mail links."""

    def __init__(self, limiter: ScopedRateLimiter, limits: PublicLimits | None = None, good: ScopedRateLimiter | None = None) -> None:
        self.limiter = limiter
        self.limits = limits or PublicLimits()
        if limiter.horizon_s < self.limits.horizon_s:
            raise ValueError("the limiter's horizon is shorter than the longest window of the public limits")
        if self.limits.max_cap >= limiter.max_events:
            raise ValueError("a cap of the public limits does not fit the limiter's per-key event memory")
        limiter.protect(PROTECTED_PREFIXES)
        self.good = good or ScopedRateLimiter("tickets_good", horizon_s=self.limits.known_good_ttl_s, clock=limiter.clock, max_events=4)
        if self.good.horizon_s < self.limits.known_good_ttl_s:
            raise ValueError("the known-good limiter's horizon is shorter than known_good_ttl_s")
        self.good.protect(("g:",))
        self._trips: dict[str, MinuteCounter] = {}

    @property
    def clock(self) -> Callable[[], float]:
        return self.limiter.clock

    # ---------------------------------------------------------------- known good tokens

    def known_good(self, token_key: str | None) -> bool:
        return bool(token_key) and self.good.count("g:" + str(token_key), self.limits.known_good_ttl_s) > 0

    def window(self, kind: str, token_key: str) -> tuple[str, Limits]:
        """The per-token request window of a route kind: (key, limits)."""
        spec = WINDOWS.get(kind)
        if spec is None:
            return token_key, self.limits.token_requests
        prefix, name = spec
        return prefix + token_key, getattr(self.limits, name)

    def success(self, token_key: str, *, counted: bool = True, kind: str = "token_read") -> None:
        """The token resolved to a live link: "known good" for known_good_ttl_s, and - when admission only checked it - its
        request is counted now (in the window of its route kind)."""
        self.good.record("g:" + token_key, ((self.limits.known_good_ttl_s, 1),))
        if not counted:
            self.limiter.record(*self.window(kind, token_key))

    def failure(self, net: str, token_key: str | None = None, *, lookup: bool = True, kind: str = "token") -> None:
        """A refused credential: one failure for the client network; when a lookup was made (`lookup`), one against the
        installation-wide budget of that kind (`token` or `redeem`). A token whose lookup failed loses its known-good mark."""
        self.limiter.record(f"fail:{net}", self.limits.unknown_per_network)
        if lookup:
            if kind == "redeem":
                self.limiter.record("fail:redeem", self.limits.redeem_global)
            else:
                self.limiter.record("fail:*", self.limits.unknown_global)
        if token_key:
            self.good.forget("g:" + token_key)

    def spend(self, kind: str, token_key: str | None) -> None:
        """A route's effect happened (a write stored, a new photo stored, a file stored): spend one unit of its budget."""
        spec = SPEND.get(kind)
        if spec is not None and token_key:
            prefix, name, _reason = spec
            self.limiter.record(prefix + token_key, getattr(self.limits, name))

    # ---------------------------------------------------------------- the decision

    def _refuse(self, reason: str, wait: float) -> Decision:
        counter = self._trips.get(reason)
        if counter is None:
            counter = self._trips.setdefault(reason, MinuteCounter(self.clock))
        counter.add()
        return Decision(False, reason, max(1, math.ceil(wait)))

    def _check(self, key: str, limits: Limits, reason: str) -> Decision | None:
        wait = self.limiter.check(key, limits)
        return self._refuse(reason, wait) if wait > 0 else None

    def _locks(self, net: str, global_key: str | None, global_limits: Limits) -> Decision | None:
        return self._check(f"fail:{net}", self.limits.unknown_per_network, "network_locked") or (
            self._check(global_key, global_limits, "flood") if global_key else None)

    def _hit(self, key: str, limits: Limits, reason: str) -> Decision | None:
        if self.limiter.hit(key, limits):
            return None
        return self._refuse(reason, self.limiter.check(key, limits))

    def admit(self, kind: str, net: str, token_key: str | None = None) -> Decision:
        """May this request go on to its lookup / body? `token_key` is links.limiter_key of the presented token (None when the
        request carries none or a malformed one)."""
        if kind in ("static", "health"):
            return self._hit(f"s:{net}", self.limits.static_per_network, "static_rate") or Decision(True)
        if kind == "asset":
            return self._hit(f"a:{net}", self.limits.asset_per_network, "asset_rate") or Decision(True)
        if kind == "redeem":
            return (self._locks(net, "fail:redeem", self.limits.redeem_global)
                    or self._hit(f"r:{net}", self.limits.redeem_per_network, "redeem_rate") or Decision(True))
        if kind == "portal_start":  # VPORTAL: a code request - its network, then the installation (cost of the WhatsApp account)
            return (self._locks(net, None, ()) or self._hit(f"ps:{net}", self.limits.portal_start_per_network, "portal_rate")
                    or self._hit("ps:*", self.limits.portal_start_global, "flood") or Decision(True))
        if kind == "portal_verify":
            return self._locks(net, None, ()) or self._hit(f"pv:{net}", self.limits.portal_verify_per_network, "portal_rate") or Decision(True)
        if kind == "portal_read":
            return self._locks(net, None, ()) or self._hit(f"pp:{net}", self.limits.portal_read_per_network, "portal_rate") or Decision(True)
        if kind == "portal_write":  # VPORTALRFQ: its network, then the installation
            return (self._locks(net, None, ()) or self._hit(f"pw:{net}", self.limits.portal_write_per_network, "portal_rate")
                    or self._hit("pw:*", self.limits.portal_write_global, "flood") or Decision(True))
        if kind not in TOKEN_KINDS:
            raise ValueError(f"unknown route kind {kind!r}")
        if kind == "rfq_upload":
            # RFQ-VENDOR-UPLOAD: the client network's own upload window first (a locked network learns that first), counted for every
            # attempt that reaches here - a valid token or not - so one network cannot spread uploads over many links
            locked = self._locks(net, None, ())
            if locked is not None:
                return locked
            refused_net = self._hit(f"un:{net}", self.limits.rfq_upload_per_network, "rfq_upload_net_rate")
            if refused_net is not None:
                return refused_net
        if not token_key:
            # nothing to look up: the caller records a network-only failure and answers the uniform 404 - unless the network is
            # already locked, which it learns first
            return self._locks(net, None, ()) or Decision(False, "no_token", 0)
        good = self.known_good(token_key)
        wkey, wlimits = self.window(kind, token_key)
        if not good:
            locked = self._locks(net, "fail:*", self.limits.unknown_global)
            if locked is not None:
                return locked
            refused = self._check(wkey, wlimits, "token_rate")
        else:
            refused = self._hit(wkey, wlimits, "token_rate")
        if refused is None and kind in SPEND:
            prefix, name, reason = SPEND[kind]
            refused = self._check(prefix + token_key, getattr(self.limits, name), reason)
        return refused or Decision(True, counted=good)

    def open(self, kind: str, net: str, token_key: str | None = None) -> "RequestCost":
        """Admission (`admit`) wrapped in the request's cost object - the edge's entry point."""
        decision = self.admit(kind, net, token_key)
        return RequestCost(self, kind, net, token_key, decision, known_good=decision.ok and decision.counted)

    def trips(self, minutes: int = MinuteCounter.SLOTS) -> dict[str, int]:
        """Refusals per reason over the last `minutes` (health: "rate-limit trips last 24 h")."""
        return {reason: c.total(minutes) for reason, c in sorted(self._trips.items())}

    # ---------------------------------------------------------------- persistence of both limiters (the janitor wiring)

    def flush_to(self, db: Any) -> int:
        return self.limiter.flush_to(db) + self.good.flush_to(db)

    def restore_from(self, db: Any) -> int:
        return self.limiter.restore_from(db) + self.good.restore_from(db)


class RequestCost:
    """What ONE request costs (see the module docstring, part 4). Every method is idempotent; a request belongs to one
    coroutine, so no lock (the limiter underneath is thread safe). `charges` lists what was charged, for the request log."""

    __slots__ = ("gate", "kind", "net", "token_key", "decision", "known_good", "link_id", "proved_valid", "failed", "early",
                 "body_spent", "effect_spent")

    def __init__(self, gate: PublicRateGate, kind: str, net: str, token_key: str | None, decision: Decision, *,
                 known_good: bool = False) -> None:
        self.gate = gate
        self.kind = kind
        self.net = net
        self.token_key = token_key
        self.decision = decision
        self.known_good = known_good
        self.link_id: str | None = None
        self.proved_valid = False
        self.failed = False
        self.early = False
        self.body_spent = False
        self.effect_spent = False

    @property
    def trusted(self) -> bool:
        """The token proved valid (now or within known_good_ttl_s): only such a request may make an early answer wait for its
        small body (code review V1 - everything else is answered at once and the connection closes)."""
        return self.known_good or self.proved_valid

    def proved(self, link_id: str | None = None) -> None:
        if self.proved_valid or not self.token_key:
            return
        self.proved_valid = True
        self.link_id = link_id
        self.gate.success(self.token_key, counted=self.decision.counted, kind=self.kind)

    def unknown(self) -> None:
        if self.failed:
            return
        self.failed = True
        self.gate.failure(self.net, self.token_key)

    def refused_early(self) -> None:
        """A refusal before any lookup (a wrong content type, a body over the cap, a body on a GET, no token): one failure for
        the client network - unless the token is known good. Never against the installation-wide budget (no lookup made)."""
        if self.early or self.trusted:
            return
        self.early = True
        self.gate.failure(self.net, None, lookup=False)

    def body_phase(self) -> None:
        """An upload (photo, invoice file) starts reading its body: one unit of its budget, whatever happens next (V2)."""
        if self.body_spent or self.kind not in UPLOAD_KINDS:
            return
        self.body_spent = True
        self.gate.spend(self.kind, self.token_key)

    def effect(self) -> None:
        """A route's effect happened (a write stored): one unit of its budget - unless the body phase already paid."""
        if self.effect_spent or self.body_spent:
            return
        self.effect_spent = True
        self.gate.spend(self.kind, self.token_key)

    @property
    def charges(self) -> str:
        parts = [name for name, on in (("good", self.known_good), ("proved", self.proved_valid), ("unknown", self.failed),
                                       ("early", self.early), ("body", self.body_spent), ("effect", self.effect_spent)) if on]
        return "+".join(parts) or "none"


def new_public_limiter(clock: Callable[[], float] = time.time, limits: PublicLimits | None = None) -> ScopedRateLimiter:
    """The limiter of the public listener: scope `tickets_link`, horizon = the longest public window, per-key memory = twice
    the largest cap (code review V9: 600 instants, not 1024)."""
    lim = limits or PublicLimits()
    return ScopedRateLimiter("tickets_link", horizon_s=lim.horizon_s, clock=clock, max_events=2 * lim.max_cap)
