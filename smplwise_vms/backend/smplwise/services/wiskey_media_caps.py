"""WISKEY-TALK-CAPS-2382: WisKey's W10 station-media commands as the SIGNED `direct/capabilities` lists them - the second discovery source
of the station media provider choice (services/intercom_media.py `listing` / `provider_for` / `readiness` / `talk_gap`).

Why (lab 03.11, WisKey 2.0.1-rc.10, docs/changes/WISKEY-RC10-PIN-2382.md section 5 item 1): the feed's `overview.api.commands` (258
commands for the paired service user) never lists the six W10 commands; rc.10 offers them in the signed `direct/capabilities` of the direct
WebSocket (`/api/hikvision_intercom/arx_bridge/v1/ws`) and to the paired bridge identity. With `access.station_media_provider = auto` Arx
therefore stayed on its own video-only source and talk was never available. Arx does not wait for WisKey to list them in the overview: when
the overview lacks them, this module answers from the signed document instead.

Where the document comes from (in this order; nothing else):
1. the cache (`TTL_S` after a read, `FAIL_TTL_S` after a failed one), valid only for the SAME pairing key (an in-memory HMAC fingerprint
   with a per-process random salt - never the key, never stored or logged) and the SAME `access.station_media_provider` value: a re-pair,
   a restore, a rotation or a provider change makes the entry stale at once (and `invalidate()` drops it explicitly);
2. the direct join (services/wiskey_direct_join.py) when it is up: the document its CURRENT authenticated connection already read
   (`DirectCommandSession.discovery`, bound to that connection_ref, time observation admitting Arx's signing window) - no I/O, no nonce;
3. a one-off signed read: a NEW direct socket (`DirectApiTransport.connect`: hello, signed `direct/connect`, verified service identity),
   then `direct/capabilities` + `direct/time` with `parameters = {}` (WKR5-295's reader `DirectDiscovery`, closed schema), then the socket
   closes. Each of the three signed frames is built afresh by the existing signer (its own ts and random nonce); NOTHING is retried or
   re-sent - a failed read is cached as `unread` with its reason for `FAIL_TTL_S`, and the next read builds new frames on a new socket.
   Never on an event loop thread (the caller then gets the cache or nothing), one read at a time per process.

Never an unsigned path: without a pairing key that signs (absent, unreadable, rotated) nothing is read and nothing is cached; the feed's
overview remains the only (unsigned, read-only) source. The document decides ONLY whether W10 is listed for Arx; it grants nothing, and every
W10 command still leaves signed through the bridge provider (`WiskeyBridgeProvider`, AutoTransport), exactly as before.

Status: implemented and tested against the in-memory fake direct server (tests/test_wiskey_talk_caps_2382.py). NOT run against a real
WisKey; no lab access in this task."""
from __future__ import annotations

import asyncio
import hashlib
import hmac
import logging
import secrets
import threading
import time
from collections.abc import Awaitable, Callable
from dataclasses import dataclass
from datetime import datetime, timezone
from typing import Any

from . import wiskey_media_bridge as bridge
from . import wiskey_media_contract as w10
from .wiskey_direct_discovery import Capabilities, DirectDiscovery, TimeObservation

log = logging.getLogger("smplwise.wiskey.media_caps")


def _mono() -> float:
    """The TTL clock (a seam: tests move it without touching the event loop's own clock)."""
    return time.monotonic()

TTL_S = 300.0  # a read document is trusted this long (a WisKey upgrade or downgrade is noticed within it)
FAIL_TTL_S = 60.0  # a failed read is not tried again before this (no hammering; the next try builds new signed frames)
READ_TIMEOUT_S = 8.0  # the whole one-off read: connect + two signed reads
LOCK_WAIT_S = READ_TIMEOUT_S + 2.0

READ = "read"  # the signed document was read (it may or may not list W10)
UNREAD = "unread"  # the signed read failed (`reason` says why)
SOURCE_JOIN = "join"
SOURCE_READ = "read"

# the reason codes of a failed read, as the Settings row groups them (the code itself is served too; it is a rule name, never a value)
KIND_UNREACHABLE = "unreachable"
KIND_REFUSED = "refused"
KIND_CLOCK = "clock"
KIND_INCOMPATIBLE = "incompatible"
KIND_FAILED = "failed"
_REFUSED = frozenset({"Unauthorized", "direct_connect_refused", "reply_unauthenticated", "direct_identity_invalid", "bridge_command_replayed"})
_UNREACHABLE = frozenset({"direct_unreachable", "direct_connect_timeout", "direct_hello_timeout", "direct_connect_failed", "read_timeout",
                          "connection_closed", "outcome_unknown", "direct_hello_invalid", "direct_connection_capacity"})
_CLOCK = frozenset({"clock_skew", "ttl_exceeds_server_max"})
_INCOMPATIBLE = frozenset({"capabilities_invalid", "capabilities_unsupported", "lifecycle_unsupported", "time_invalid", "command_unavailable",
                           "unknown_command"})


def reason_kind(reason: str | None) -> str | None:
    """`unreachable` | `refused` | `clock` | `incompatible` | `failed` for a failed read's reason (None for no reason)."""
    if not reason:
        return None
    code = reason.split(":", 1)[1] if ":" in reason else reason  # `discovery_refused:Unauthorized` -> `Unauthorized`
    if code in _CLOCK:
        return KIND_CLOCK
    if code in _REFUSED or reason.startswith("discovery_refused:Unauthorized"):
        return KIND_REFUSED
    if code in _INCOMPATIBLE or reason.startswith("discovery_refused:"):
        return KIND_INCOMPATIBLE
    if code in _UNREACHABLE or reason.startswith(("discovery_unknown:", "discovery_not_sent:", "discovery_closed:")):
        return KIND_UNREACHABLE
    return KIND_FAILED


@dataclass(frozen=True)
class SignedListing:
    """What the signed document says about W10 for Arx (`state` READ), or why it could not be read (`state` UNREAD + `reason`)."""

    state: str
    video: bool
    talk: bool
    reason: str | None
    source: str | None
    at: float  # wall clock of the read (served as `read_at`)
    mono: float  # monotonic clock of the read (the TTL)
    marker: tuple[str, str] = ("", "")  # (key fingerprint, provider choice) the entry belongs to - never served

    @property
    def ok(self) -> bool:
        return self.state == READ

    def expired(self, now_mono: float | None = None) -> bool:
        now_mono = _mono() if now_mono is None else now_mono
        return now_mono - self.mono >= (TTL_S if self.ok else FAIL_TTL_S)

    def public(self) -> dict[str, Any]:
        return {"state": self.state, "video_listed": self.video, "talk_listed": self.talk, "reason": self.reason,
                "reason_kind": reason_kind(self.reason), "source": self.source,
                "read_at": datetime.fromtimestamp(self.at, timezone.utc).isoformat(timespec="seconds").replace("+00:00", "Z")}


def listed_in(cap: Capabilities) -> tuple[bool, bool]:
    """(video, talk) the way `w10.listed` reads the overview: video = the descriptor and the lease, talk = video and all four talk commands."""
    names = {c[len(w10.DOMAIN) + 1:] if c.startswith(w10.DOMAIN + "/") else c for c in cap.commands}
    video = all(c in names for c in w10.VIDEO_COMMANDS)
    return video, video and all(c in names for c in w10.TALK_COMMANDS)


def from_document(cap: Capabilities | None, t: TimeObservation | None, error: str | None, *, source: str, marker: tuple[str, str],
                  window_s: int = bridge.WINDOW_S) -> SignedListing:
    """A `DirectDiscovery` result as a listing: unread when either document is missing (its reader's reason) or when the time observation
    does not admit Arx's signing window (a W10 command could not be admitted then, so its listing is not used)."""
    now, mono = time.time(), _mono()
    if cap is None or t is None:
        return SignedListing(UNREAD, False, False, error or "discovery_missing", source, now, mono, marker)
    refusal = t.admits(window_s)
    if refusal is not None:
        return SignedListing(UNREAD, False, False, refusal, source, now, mono, marker)
    video, talk = listed_in(cap)
    return SignedListing(READ, video, talk, None, source, now, mono, marker)


# ---------------------------------------------------------------- the cache

_SALT = secrets.token_bytes(32)  # per process: the fingerprint never outlives the process and cannot be recomputed elsewhere
_LOCK = threading.Lock()  # one read at a time
_STATE_LOCK = threading.Lock()
_ENTRY: SignedListing | None = None
_OPENER_FOR_TESTS: Callable[[], Awaitable[Any]] | None = None
READS = {"started": 0}  # counters for tests and diagnostics (never a value of the document)


def invalidate() -> None:
    """Drop the cached listing (the next caller that may read reads afresh). Called on a provider change and by tests; a key change is
    noticed by the fingerprint without a call."""
    global _ENTRY
    with _STATE_LOCK:
        _ENTRY = None


def set_opener_for_tests(opener: Callable[[], Awaitable[Any]] | None) -> None:
    global _OPENER_FOR_TESTS
    _OPENER_FOR_TESTS = opener
    invalidate()


def key_fingerprint(key: Any) -> str | None:
    """A salted HMAC of the pairing material, or None when the key cannot sign (absent, unreadable, rotated). In memory only."""
    try:
        text = bridge._key_text(key)  # noqa: SLF001 - the signer's own rule: a rotated key never signs
    except bridge.MediaBridgeError:
        return None
    return hmac.new(_SALT, text.encode("utf-8"), hashlib.sha256).hexdigest()[:24]


def _store(entry: SignedListing) -> SignedListing:
    global _ENTRY
    with _STATE_LOCK:
        _ENTRY = entry
    return entry


def cached(marker: tuple[str, str] | None) -> SignedListing | None:
    """The cached listing when it is current and belongs to `marker`; with `marker` None (a caller without a database connection, e.g. the
    talk open re-check) the latest current entry whatever its marker - its marker was checked by the read that selected the provider."""
    with _STATE_LOCK:
        entry = _ENTRY
    if entry is None or entry.expired():
        return None
    if marker is not None and entry.marker != marker:
        return None
    return entry


def _from_join(marker: tuple[str, str]) -> SignedListing | None:
    """The document of the direct join's CURRENT connection, when it is up and its discovery is current. No I/O; never raises."""
    try:
        from . import wiskey_direct_join

        join = wiskey_direct_join.installed()
        if join is None or not join.configured():
            return None
        session = join.session
        if session.transport_refusal(None) is not None:  # not connected, stopping, no discovery yet, or a clock that does not admit
            return None
        link = session._link  # noqa: SLF001 - read only: the connection the document is bound to
        d = session.discovery
        cap, t = d.capabilities, d.time
        if link is None or cap is None or t is None or cap.connection_ref != link.connection_ref:
            return None
        return from_document(cap, t, None, source=SOURCE_JOIN, marker=marker, window_s=d.window_s)
    except Exception as exc:  # noqa: BLE001 - the join's state is a shortcut only
        log.info("station media: the direct join's discovery was not readable (%s)", type(exc).__name__)
        return None


async def _read_async(opener: Callable[[], Awaitable[Any]], key_provider: Callable[[], Any], marker: tuple[str, str]) -> SignedListing:
    """One new direct socket, one signed connect, `direct/capabilities` + `direct/time` (closed reader), close. Never retried."""
    transport = bridge.DirectApiTransport(opener, key_provider)
    try:
        link = await transport.connect(bridge.PURPOSE_COMMAND)
    except bridge.MediaBridgeError as exc:
        return SignedListing(UNREAD, False, False, exc.code, SOURCE_READ, time.time(), _mono(), marker)
    try:
        disc = DirectDiscovery(window_s=bridge.WINDOW_S)

        async def call(command: str, parameters: Any) -> Any:
            return await link.call_command(command, dict(parameters), kind=bridge.KIND, timeout=READ_TIMEOUT_S / 2)

        await disc.refresh(link.connection_ref, call)  # never raises; a failure leaves `last_error`
        return from_document(disc.capabilities, disc.time, disc.last_error, source=SOURCE_READ, marker=marker)
    finally:
        try:
            await link.close()
        except Exception:  # noqa: BLE001
            pass


def _on_event_loop() -> bool:
    try:
        asyncio.get_running_loop()
    except RuntimeError:
        return False
    return True


def listing(settings: Any, conn: Any, choice: str, *, read: bool = True) -> SignedListing | None:
    """The signed listing for the pairing key `conn` reads now and the provider `choice`, or None when it cannot be consulted: no key that
    signs (nothing is ever read without one), `read` False with nothing cached, or an event loop thread with nothing cached. With `conn`
    None: the latest current entry only (no key check is possible, so no I/O)."""
    if conn is None:
        return cached(None)
    from . import ha_bridge

    try:
        key = ha_bridge.signing_key(conn)
    except Exception:  # noqa: BLE001 - an unreadable key set is "not paired"
        return None
    fp = key_fingerprint(key)
    if fp is None:
        return None
    marker = (fp, choice)
    hit = cached(marker)
    if hit is not None:
        return hit
    joined = _from_join(marker)
    if joined is not None:
        return _store(joined)
    if not read or _on_event_loop():
        return None
    if not _LOCK.acquire(timeout=LOCK_WAIT_S):
        return cached(marker)  # another read is still running: its result, if any
    try:
        hit = cached(marker)  # a read that finished while this caller waited
        if hit is not None:
            return hit
        READS["started"] += 1
        opener = _OPENER_FOR_TESTS or bridge.websocket_opener(settings)
        try:
            entry = asyncio.run(asyncio.wait_for(_read_async(opener, lambda: key, marker), READ_TIMEOUT_S))
        except (asyncio.TimeoutError, TimeoutError):
            entry = SignedListing(UNREAD, False, False, "read_timeout", SOURCE_READ, time.time(), _mono(), marker)
        except Exception as exc:  # noqa: BLE001 - the read never takes the request down; the type only
            log.info("station media: the signed capabilities read failed (%s)", type(exc).__name__)
            entry = SignedListing(UNREAD, False, False, f"read_error:{type(exc).__name__}"[:64], SOURCE_READ, time.time(), _mono(), marker)
        if not entry.ok:
            log.info("station media: WisKey's signed capabilities not read (%s)", entry.reason)
        return _store(entry)
    finally:
        _LOCK.release()
