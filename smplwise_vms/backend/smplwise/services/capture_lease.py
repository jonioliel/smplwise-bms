"""The Arx-side capture lease ledger and its authority triggers (CR-WISKEY-LEASE-REVOCATION-EVENT slices L1 + L2).

A *lease* is the Arx decision issued at `capture_start` that lets WisKey continue ONE card-collection session for at most
LEASE_MAX_S (120 s, a constant). It is created only by the fresh decision in `card_capture_start` (routers/access_control.py,
services/capture_lease_route.py) and only while the route is on (`access.capture_lease`, default `off`, AND a bridge that
offers `lease_event` - MIN_BRIDGE_FOR_CAPTURE_LEASE is None in this build, so the route cannot be switched on at all).

States (migration 0103, provisional number): issued -> active -> (revoked | expired | destroyed). Terminal states are final.
The database enforces one live lease per receiver and per actor (partial unique indexes) and the lifetime CHECK; the issuing
transaction enforces the installation ceiling (3) and that the permission revision and the in-memory authority epochs are
still the ones the decision was made at.

Triggers (section 1.4): `on_authority_change(reason, ...)` is called from every place that changes the authority of an
outstanding lease. It NEVER touches the database and never blocks (it may be called from inside another module's lock, from
the WisKey feed's event loop or from inside `db.bump_permission_revision`'s transaction): it moves in-memory epochs at once
(so a lease whose authority moved is unusable from that instant, and a start decided before the move can no longer be
issued), and queues the trigger for the lease worker (services/lease_events.py), which marks the ledger rows `revoked` in
one transaction with the next stream sequence and sends the signed `lease_revoke`. Strict rule (owner decision 2026-10-16,
question 2 option a): ANY `permission_revision` bump revokes EVERY live lease, with no re-check.

Audit rows carry ids only - never a card value / mask / length, a person or station name, an address, a nonce, a signature,
a key or a message body."""
from __future__ import annotations

import logging
import queue
import re
import secrets
import sqlite3
import threading
import time
import uuid
from dataclasses import dataclass, field
from datetime import datetime, timedelta, timezone
from typing import Any, Callable, Iterable

from ..db import Database, get_setting, now_iso, permission_revision
from ..errors import ApiError

log = logging.getLogger("smplwise.capture_lease")

# ---------------------------------------------------------------- constants and settings

FLAG_KEY = "access.capture_lease"
FLAG_VALUES = ("off", "on")
SECONDS_KEY = "access.capture_lease_seconds"
SECONDS_VALUES = ("120", "90", "60")  # owner decision 2026-10-16 q1: default 120 = the cap; the setting may only lower it
LOOKUP_KEY = "access.lookup_scope"
LOOKUP_VALUES = ("holder", "holder_or_audit_readers")  # owner decision 2026-10-16 q5
LOOKUP_WIDE_WORD = "הרחב בירור"  # the typed confirmation for the WIDER lookup value (never stored)
KEYS = (FLAG_KEY, SECONDS_KEY, LOOKUP_KEY)
DEFAULTS = {FLAG_KEY: "off", SECONDS_KEY: "120", LOOKUP_KEY: "holder"}

PROTOCOL = "wiskey-capture-lease-v1"
LEASE_MAX_S = 120  # a constant, never a setting (section 2.2); also the CHECK in migration 0103 and the signer's bound
CEILING = 3  # WisKey's own installation-wide session limit
RETENTION_DAYS = 7  # terminal rows are pruned this long after state_at (WisKey's replay-journal horizon)
# The first bridge version that offers `smplwise_bridge.lease_event` (slice L4, bridge 0.9.x with door_open). None: no bridge
# does yet, so the route cannot be switched on in this build (fail closed, exactly the doors.trusted_path pattern).
MIN_BRIDGE_FOR_CAPTURE_LEASE: str | None = None

LIVE = ("issued", "active")
STATES = ("issued", "active", "revoked", "expired", "destroyed")
SCOPES = ("lease", "actor", "station", "all")
# the closed `reason` enum of `lease_revoke` (section 1.4 plus the failure rules of section 3)
REVOKE_REASONS = (
    "permission_revision", "actor_disabled", "actor_removed", "access_changed", "session_ended", "abandoned", "second_factor_changed",
    "binding_changed", "receiver_changed", "receiver_offline", "feed_reconnect", "feature_off", "repair", "emergency", "shutdown",
    "person_changed", "clock_invalid", "start_unknown", "host_lost_stream", "unknown_lease_on_host", "ledger_unavailable",
    "key_rotation", "restore", "cancel_unknown",
)
# ledger-only reasons: the host already destroyed the leases (no message is sent for these)
HOST_REASONS = ("host_gap", "host_conflict", "startup")
DESTROY_REASONS = ("confirmed", "confirm_unknown", "cancelled", "lost", "error", "start_refused", "host_silence", "host_absent")
STREAM_REASONS = ("startup", "repair", "restore", "key_rotation", "host_lost_stream", "first")
LEASE_ACTIONS = ("capture_start", "capture_status", "capture_confirm", "capture_cancel")

UNAVAILABLE_TEXT = "קריאת כרטיס אינה זמינה כעת"
STOPPED_TEXT = "קריאת הכרטיס הופסקה"
CLOCK_TEXT = "שעון המערכת לא אמין"
_HEX32 = re.compile(r"^[0-9a-f]{32}$")


# ---------------------------------------------------------------- the clock (injectable: tests drive a fake one)

def _real_now() -> datetime:
    return datetime.now(timezone.utc)


_now_fn: Callable[[], datetime] = _real_now
_mono_fn: Callable[[], float] = time.monotonic


def now() -> datetime:
    """The host clock in UTC whole seconds - the only source of lease times (section 3.4, F5: no skew allowance, no re-anchor)."""
    return _now_fn().astimezone(timezone.utc).replace(microsecond=0)


def mono() -> float:
    return _mono_fn()


def set_clock(now_fn: Callable[[], datetime] | None = None, mono_fn: Callable[[], float] | None = None) -> None:
    global _now_fn, _mono_fn
    _now_fn = now_fn or _real_now
    _mono_fn = mono_fn or time.monotonic


def iso(at: datetime) -> str:
    return at.astimezone(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")


def parse_iso(text: str) -> datetime:
    return datetime.strptime(text, "%Y-%m-%dT%H:%M:%SZ").replace(tzinfo=timezone.utc)


# ---------------------------------------------------------------- the route's availability and the guards

class _Guards:
    """Process-wide fail-closed switches. DEGRADED (F3): a ledger / counter write failed while revoking - the route is off
    in memory until restart. CLOCK_UNTRUSTED (F5): the bridge answered `time/clock_invalid` or `time/not_yet_valid` to a
    lease-route message - no lease is issued until a successful signed exchange of a non-lease message (`clock_trusted_again`)
    or an administrator's explicit re-enable."""

    def __init__(self) -> None:
        self.degraded = False
        self.clock_untrusted = False


GUARDS = _Guards()


def _version_tuple(v: str) -> tuple[int, ...]:
    out = []
    for part in v.split("."):
        digits = re.match(r"\d+", part)
        out.append(int(digits.group(0)) if digits else 0)
    return tuple(out)


def bridge_available(conn: sqlite3.Connection) -> bool:
    """A known bridge version that offers `lease_event` (never true in this build: MIN_BRIDGE_FOR_CAPTURE_LEASE is None)."""
    if MIN_BRIDGE_FOR_CAPTURE_LEASE is None:
        return False
    seen = get_setting(conn, "bridge.integration_version") or ""
    return bool(seen) and _version_tuple(seen) >= _version_tuple(MIN_BRIDGE_FOR_CAPTURE_LEASE)


def mode(conn: sqlite3.Connection) -> str:
    """`on` only when the setting says exactly `on`; anything else (absent, garbage) is `off`."""
    try:
        return "on" if (get_setting(conn, FLAG_KEY) or "off") == "on" else "off"
    except sqlite3.Error:
        return "off"


def route_on(conn: sqlite3.Connection) -> bool:
    """The lease route serves a capture only when switched on AND a bridge offers it. Fail closed on anything else."""
    return mode(conn) == "on" and bridge_available(conn)


def lease_seconds(conn: sqlite3.Connection) -> int:
    """min(LEASE_MAX_S, access.capture_lease_seconds); a value that is not one of SECONDS_VALUES reads as the cap."""
    raw = get_setting(conn, SECONDS_KEY) or DEFAULTS[SECONDS_KEY]
    value = int(raw) if raw in SECONDS_VALUES else LEASE_MAX_S
    return min(LEASE_MAX_S, value)


def lookup_scope(conn: sqlite3.Connection) -> str:
    """`holder` unless the setting says exactly `holder_or_audit_readers` (fail closed to the narrow value)."""
    try:
        value = get_setting(conn, LOOKUP_KEY) or DEFAULTS[LOOKUP_KEY]
    except sqlite3.Error:
        return "holder"
    return value if value in LOOKUP_VALUES else "holder"


def unavailable(code: str = "capture_lease_unavailable", text: str = UNAVAILABLE_TEXT) -> ApiError:
    return ApiError(503, code, text, details={"outcome": "not_sent"})


def ensure_issuable(conn: sqlite3.Connection) -> None:
    """F2: no lease while the route is off, the ledger is degraded or the clock is not trusted - before anything is signed."""
    if not route_on(conn) or GUARDS.degraded:
        raise unavailable()
    if GUARDS.clock_untrusted:
        raise unavailable("capture_lease_clock_invalid", CLOCK_TEXT)


def clock_trusted_again(source: str) -> None:
    """A successful signed exchange of a NON-lease message (or an administrator's explicit re-enable) ends the clock guard.
    Extension point: the door path's signed `door_open_status` / `door_open` success calls this once that route is on."""
    if GUARDS.clock_untrusted:
        GUARDS.clock_untrusted = False
        log.warning("capture lease: the clock guard was lifted (%s)", source)


# ---------------------------------------------------------------- in-memory authority epochs and the live cache

@dataclass(frozen=True)
class Snapshot:
    """The authority epochs a decision was made at: the installation's, the actor's, the station's and the person's."""
    all: int
    actor: int
    station: int
    person: int
    actor_id: str
    station_id: str
    person_id: str


@dataclass
class LiveLease:
    lease_ref: str
    actor_id: str
    station_id: str
    reader_id: int
    person_id: str
    expires_at: datetime
    snap: Snapshot
    state: str = "issued"
    session_id: str | None = None
    activated_mono: float | None = None


@dataclass
class Trigger:
    reason: str
    scope: str
    key: str | None  # the lease ref / actor id / station id; None for `all`
    at_mono: float = field(default_factory=lambda: mono())


class _Registry:
    def __init__(self) -> None:
        self.lock = threading.Lock()
        self.epoch_all = 0
        self.epoch_actor: dict[str, int] = {}
        self.epoch_station: dict[str, int] = {}
        self.epoch_person: dict[str, int] = {}
        self.epoch_lease: dict[str, int] = {}
        self.live: dict[str, LiveLease] = {}
        self.triggers: "queue.SimpleQueue[Trigger]" = queue.SimpleQueue()
        self.wake: Callable[[], None] = lambda: None  # set by the lease worker

    def snapshot(self, actor_id: str, station_id: str, person_id: str) -> Snapshot:
        with self.lock:
            return Snapshot(self.epoch_all, self.epoch_actor.get(actor_id, 0), self.epoch_station.get(station_id, 0), self.epoch_person.get(person_id, 0),
                            actor_id, station_id, person_id)

    def valid(self, snap: Snapshot, lease_ref: str | None = None, lease_epoch: int = 0) -> bool:
        with self.lock:
            return (snap.all == self.epoch_all and snap.actor == self.epoch_actor.get(snap.actor_id, 0) and snap.station == self.epoch_station.get(snap.station_id, 0)
                    and snap.person == self.epoch_person.get(snap.person_id, 0) and (lease_ref is None or self.epoch_lease.get(lease_ref, 0) == lease_epoch))

    def reset(self) -> None:
        with self.lock:
            self.epoch_all = 0
            self.epoch_actor.clear()
            self.epoch_station.clear()
            self.epoch_person.clear()
            self.epoch_lease.clear()
            self.live.clear()
            self.triggers = queue.SimpleQueue()


REG = _Registry()


def usable(lease_ref: str) -> bool:
    """A live lease whose authority has not moved since it was issued (any trigger since then makes it unusable at once,
    before the worker has even written the ledger)."""
    with REG.lock:
        entry = REG.live.get(lease_ref)
    if entry is None or entry.state not in LIVE:
        return False
    if entry.expires_at <= now():
        return False
    return REG.valid(entry.snap, lease_ref, 0)


def live_refs() -> list[str]:
    with REG.lock:
        return [ref for ref, entry in REG.live.items() if entry.state in LIVE]


def has_live() -> bool:
    with REG.lock:
        return any(entry.state in LIVE for entry in REG.live.values())


def on_authority_change(reason: str, *, user_ids: Iterable[str] | None = None, station_ids: Iterable[str] | None = None,
                        person_ids: Iterable[str] | None = None, lease_refs: Iterable[str] | None = None, all: bool = False) -> int:
    """THE trigger hook (section 1.4). Never raises, never touches the database, never blocks on I/O. Moves the epochs at
    once and queues one trigger per matching live lease scope for the worker. Returns how many triggers were queued (0 when
    nothing live matched: no message is ever sent for nothing)."""
    try:
        if reason not in REVOKE_REASONS:
            log.warning("capture lease: unknown trigger reason %r treated as access_changed", reason)
            reason = "access_changed"
        users = {u for u in (user_ids or ()) if isinstance(u, str)}
        stations = {s for s in (station_ids or ()) if isinstance(s, str)}
        persons = {p for p in (person_ids or ()) if isinstance(p, str)}
        leases = {r for r in (lease_refs or ()) if isinstance(r, str)}
        queued: list[Trigger] = []
        with REG.lock:
            if all:
                REG.epoch_all += 1
            for u in users:
                REG.epoch_actor[u] = REG.epoch_actor.get(u, 0) + 1
            for s in stations:
                REG.epoch_station[s] = REG.epoch_station.get(s, 0) + 1
            for p in persons:
                REG.epoch_person[p] = REG.epoch_person.get(p, 0) + 1
            for r in leases:
                REG.epoch_lease[r] = REG.epoch_lease.get(r, 0) + 1
            live = [e for e in REG.live.values() if e.state in LIVE]
            if all:
                if live:
                    queued.append(Trigger(reason, "all", None))
            else:
                for u in sorted(users):
                    if any(e.actor_id == u for e in live):
                        queued.append(Trigger(reason, "actor", u))
                for s in sorted(stations):
                    if any(e.station_id == s for e in live):
                        queued.append(Trigger(reason, "station", s))
                for e in live:
                    if e.lease_ref in leases or e.person_id in persons:
                        queued.append(Trigger(reason, "lease", e.lease_ref))
            for t in queued:
                REG.triggers.put(t)
        if queued:
            REG.wake()
        return len(queued)
    except Exception:  # noqa: BLE001 - a trigger must never break its caller (a permission change, a sign-out, the feed)
        log.exception("capture lease: trigger %s could not be queued; the lease worker reconciles on its next tick", reason)
        try:
            GUARDS.degraded = True
        except Exception:  # noqa: BLE001
            pass
        return 0


# ---------------------------------------------------------------- the ledger (database)

@dataclass(frozen=True)
class Lease:
    lease_ref: str
    actor_id: str
    station_id: str
    reader_id: int
    person_id: str
    person_revision: int | None
    binding_revision: str | None
    permission_revision: int
    stream_id: str
    sequence_at_issue: int
    issued_at: str
    expires_at: str
    start_request_id: str
    seconds: int

    def lease_object(self) -> dict[str, Any]:
        """The fields Arx signs INTO the `capture_start` envelope (section 1.2): ids and revisions only - never an address,
        serial, MAC, card value, hash or length."""
        return {
            "lease_ref": self.lease_ref, "lease_issued_at": self.issued_at, "lease_expires_at": self.expires_at,
            "binding_revision": self.binding_revision, "person_ref": self.person_id, "person_revision": self.person_revision,
            "permission_revision": self.permission_revision, "receiver": {"reader_id": self.reader_id}, "stream_id": self.stream_id,
            "sequence_at_issue": self.sequence_at_issue, "lease_actions": list(LEASE_ACTIONS),
        }


def installation_actor(conn: sqlite3.Connection | None) -> str:
    """The `actor.id` of an installation-wide message (scope `all`, stream reset): the add-on's own installation id."""
    try:
        value = (get_setting(conn, "installation_id") or get_setting(conn, "instance_id")) if conn is not None else None
    except sqlite3.Error:
        value = None
    return value if isinstance(value, str) and 0 < len(value) <= 128 and value.isprintable() else "smplwise-arx"


def current_stream(conn: sqlite3.Connection) -> tuple[str, int] | None:
    row = conn.execute("SELECT stream_id, next_sequence FROM capture_lease_stream ORDER BY created_at DESC, rowid DESC LIMIT 1").fetchone()
    return (row[0], int(row[1])) if row else None


def new_stream(conn: sqlite3.Connection, reason: str) -> tuple[str, str | None]:
    """A new stream row: sequence 1 is the `lease_stream_reset` that announces it, so the first revoke takes 2. Returns
    (new stream id, previous stream id or None). Audited `.stream_reset`."""
    if reason not in STREAM_REASONS:
        raise ValueError("stream reason")
    previous = current_stream(conn)
    stream_id = secrets.token_hex(16)
    conn.execute("INSERT INTO capture_lease_stream(stream_id, next_sequence, created_at, reason) VALUES (?, 2, ?, ?)", (stream_id, now_iso(), reason))
    _audit(conn, "intercom.capture_lease.stream_reset", f"stream:{stream_id}", {"reason": reason, "previous_stream_id": previous[0] if previous else None})
    return stream_id, previous[0] if previous else None


def ensure_stream(conn: sqlite3.Connection) -> tuple[str, int]:
    found = current_stream(conn)
    if found is None:
        new_stream(conn, "first")
        found = current_stream(conn)
    assert found is not None
    return found


# test hook (N3): the next allocation skips one sequence, so the host sees a gap
TEST_SKIP_NEXT_SEQUENCE = False


def allocate_sequence(conn: sqlite3.Connection, stream_id: str) -> int:
    """The next revoke sequence: one single-row UPDATE ... RETURNING inside the caller's write transaction (F10)."""
    global TEST_SKIP_NEXT_SEQUENCE
    step = 2 if TEST_SKIP_NEXT_SEQUENCE else 1
    TEST_SKIP_NEXT_SEQUENCE = False
    row = conn.execute("UPDATE capture_lease_stream SET next_sequence = next_sequence + ? WHERE stream_id = ? RETURNING next_sequence", (step, stream_id)).fetchone()
    if row is None:
        raise sqlite3.OperationalError("capture lease stream missing")
    return int(row[0]) - 1


def last_sequence(conn: sqlite3.Connection) -> tuple[str, int] | None:
    found = current_stream(conn)
    return (found[0], found[1] - 1) if found else None


def _audit(conn: sqlite3.Connection, action: str, resource_id: str, details: dict[str, Any], actor: Any = None, decision: str = "allowed", reason: str | None = None) -> None:
    from ..audit import audit

    audit(conn, actor=actor, action=action, decision=decision, resource_type="capture_lease", resource_id=resource_id, reason=reason, details=details)


def _busy(exc: sqlite3.IntegrityError) -> ApiError:
    text = str(exc)
    if "actor_user_id" in text:
        return ApiError(409, "intercom_capture_user_busy", "כבר פתוחה לכם קריאת כרטיס אחרת. סיימו או בטלו אותה לפני שמתחילים חדשה.", details={"outcome": "not_sent"})
    if "station_id" in text or "reader_id" in text:
        return ApiError(409, "capture_receiver_busy", "הקורא הזה כבר בקריאת כרטיס אחרת. הקורא לא הופעל שוב.", details={"outcome": "not_sent"})
    return ApiError(409, "capture_lease_refused", UNAVAILABLE_TEXT, details={"outcome": "not_sent"})


def actor_source(principal: Any) -> str:
    return "local" if getattr(principal, "source", "") == "local" else "ha"


def issue(conn: sqlite3.Connection, *, principal: Any, station_id: str, reader_id: int, person_id: str, person_revision: int | None,
          binding_revision: str | None, decision_revision: int, start_request_id: str, snap: Snapshot) -> Lease:
    """Create the ledger row for a capture start the fresh decision allowed - inside the caller's write transaction, before
    anything is signed or sent. THE only place a row is created. Refusals (all before signing): the route off / degraded /
    clock (503), the permission revision or an authority epoch moved since the decision (409 `capture_lease_stale`), the
    ceiling (409 `intercom_capture_limit`), a live lease on the receiver (409 `capture_receiver_busy`) or of the actor."""
    ensure_issuable(conn)
    if getattr(principal, "user_id", None) != snap.actor_id or not isinstance(snap.actor_id, str) or not snap.actor_id:
        raise ApiError(403, "forbidden", "אין הרשאה.", details={"outcome": "not_sent"})
    if permission_revision(conn) != decision_revision or not REG.valid(snap):
        raise ApiError(409, "capture_lease_stale", "ההרשאות השתנו בזמן ההחלטה. נסו שוב.", details={"outcome": "not_sent"})
    if not isinstance(reader_id, int) or isinstance(reader_id, bool) or not 0 <= reader_id <= 8:
        raise ApiError(422, "validation", "מספר הקורא אינו תקין.", details={"outcome": "not_sent"})
    live = conn.execute("SELECT COUNT(*) FROM capture_leases WHERE state IN ('issued', 'active')").fetchone()[0]
    if live >= CEILING:
        raise ApiError(409, "intercom_capture_limit", "כבר פתוחות שלוש קריאות כרטיס במערכת. נסו שוב בעוד רגע.", details={"outcome": "not_sent"})
    seconds = lease_seconds(conn)
    if not 0 < seconds <= LEASE_MAX_S:
        raise unavailable()
    issued = now()
    expires = issued + timedelta(seconds=seconds)
    stream_id, next_seq = ensure_stream(conn)
    lease_ref = str(uuid.uuid4())
    at = now_iso()
    try:
        conn.execute(
            """INSERT INTO capture_leases(id, actor_user_id, actor_source, station_id, reader_id, person_id, person_revision, binding_revision,
                                          permission_revision, selection_revision, stream_id, sequence_at_issue, start_request_id, wiskey_session_id,
                                          lease_issued_at, lease_expires_at, state, state_at, reason, revoke_sequence, revoke_attempts, acked_at, ack_result, created_at)
               VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, NULL, ?, ?, ?, NULL, ?, ?, 'issued', ?, NULL, NULL, 0, NULL, NULL, ?)""",
            (lease_ref, snap.actor_id, actor_source(principal), station_id, reader_id, person_id, person_revision, binding_revision, decision_revision,
             stream_id, next_seq - 1, start_request_id, iso(issued), iso(expires), at, at),
        )
    except sqlite3.IntegrityError as exc:
        raise _busy(exc) from None
    lease = Lease(lease_ref, snap.actor_id, station_id, reader_id, person_id, person_revision, binding_revision, decision_revision, stream_id, next_seq - 1,
                  iso(issued), iso(expires), start_request_id, seconds)
    _audit(conn, "intercom.capture_lease.issue", f"lease:{lease_ref}", {
        "station": station_id, "reader": reader_id, "person_id": person_id, "person_revision": person_revision, "binding_revision": binding_revision,
        "permission_revision": decision_revision, "stream_id": stream_id, "sequence_at_issue": next_seq - 1, "lease_seconds": seconds,
        "start_request_id": start_request_id,
    }, actor=principal)
    with REG.lock:
        REG.live[lease_ref] = LiveLease(lease_ref, snap.actor_id, station_id, reader_id, person_id, expires, snap)
    REG.wake()
    return lease


def activate(db: Database, lease_ref: str, session_id: str) -> bool:
    """WisKey acknowledged the start and named the session: `issued` -> `active`. False when the row is no longer `issued`
    (revoked meanwhile): the caller then cancels the session it now knows about."""
    with db.write_aside(label="capture_lease.activate") as conn:
        moved = conn.execute("UPDATE capture_leases SET state = 'active', state_at = ?, wiskey_session_id = ? WHERE id = ? AND state = 'issued'",
                             (now_iso(), session_id, lease_ref)).rowcount
        if moved:
            _audit(conn, "intercom.capture_lease.active", f"lease:{lease_ref}", {"wiskey_session_id": session_id})
    with REG.lock:
        entry = REG.live.get(lease_ref)
        if entry is not None:
            entry.session_id = session_id
            if moved:
                entry.state = "active"
                entry.activated_mono = mono()
    return bool(moved)


def finish(db: Database, lease_ref: str, state: str, reason: str, *, only_from: tuple[str, ...] = LIVE) -> bool:
    """Move a row to `destroyed` / `expired` (from a live state only, by default). Terminal states never move again."""
    if state not in ("destroyed", "expired") or (state == "destroyed" and reason not in DESTROY_REASONS):
        raise ValueError("terminal state")
    marks = ",".join("?" * len(only_from))
    with db.write_aside(label="capture_lease.finish") as conn:
        moved = conn.execute(f"UPDATE capture_leases SET state = ?, state_at = ?, reason = ? WHERE id = ? AND state IN ({marks})",
                             (state, now_iso(), reason, lease_ref, *only_from)).rowcount
        if moved:
            _audit(conn, "intercom.capture_lease.destroy" if state == "destroyed" else "intercom.capture_lease.expire", f"lease:{lease_ref}", {"reason": reason})
    _forget(lease_ref, state)
    return bool(moved)


def discard(conn: sqlite3.Connection, lease_ref: str, reason: str) -> None:
    """Inside the issuing transaction: a row that was never sent (the signer refused) -> `destroyed(reason)`, audited."""
    if reason not in DESTROY_REASONS:
        raise ValueError("destroy reason")
    if conn.execute("UPDATE capture_leases SET state = 'destroyed', state_at = ?, reason = ? WHERE id = ? AND state = 'issued'", (now_iso(), reason, lease_ref)).rowcount:
        _audit(conn, "intercom.capture_lease.destroy", f"lease:{lease_ref}", {"reason": reason})
    _forget(lease_ref, "destroyed")


def _forget(lease_ref: str, state: str) -> None:
    with REG.lock:
        entry = REG.live.get(lease_ref)
        if entry is not None:
            entry.state = state
            REG.live.pop(lease_ref, None)


def row(conn: sqlite3.Connection, lease_ref: str) -> dict[str, Any] | None:
    found = conn.execute("SELECT * FROM capture_leases WHERE id = ?", (lease_ref,)).fetchone()
    return dict(found) if found else None


def live_rows(conn: sqlite3.Connection) -> list[dict[str, Any]]:
    return [dict(r) for r in conn.execute("SELECT * FROM capture_leases WHERE state IN ('issued', 'active') ORDER BY created_at, id").fetchall()]


@dataclass
class Revocation:
    """What one applied trigger produced: the rows it revoked and the message that must now be sent."""
    reason: str
    scope: str
    stream_id: str
    sequence: int
    lease_ref: str  # the named lease, or `*`
    actor_id: str
    station: str
    rows: list[dict[str, Any]]
    revoked_at: str
    permission_revision: int


def _match(rows: list[dict[str, Any]], scope: str, key: str | None) -> list[dict[str, Any]]:
    if scope == "all":
        return rows
    field_of = {"lease": "id", "actor": "actor_user_id", "station": "station_id"}[scope]
    return [r for r in rows if r[field_of] == key]


def revoke(conn: sqlite3.Connection, trigger: Trigger, *, send: bool = True) -> Revocation | None:
    """Apply one trigger inside the caller's write transaction: every matching live row -> `revoked(reason)` with the next
    stream sequence (one sequence per message), audited `.revoke`. `send=False` (the host-side reasons: gap, conflict,
    startup) marks the rows without taking a sequence. None when nothing live matched."""
    rows = _match(live_rows(conn), trigger.scope, trigger.key)
    if not rows:
        return None
    at = now_iso()
    revoked_at = iso(now())
    stream_id, _next = ensure_stream(conn)
    sequence = allocate_sequence(conn, stream_id) if send else 0
    ids = [r["id"] for r in rows]
    marks = ",".join("?" * len(ids))
    conn.execute(f"UPDATE capture_leases SET state = 'revoked', state_at = ?, reason = ?, revoke_sequence = ? WHERE id IN ({marks}) AND state IN ('issued', 'active')",
                 (at, trigger.reason, sequence if send else None, *ids))
    for r in rows:
        _audit(conn, "intercom.capture_lease.revoke", f"lease:{r['id']}", {"reason": trigger.reason, "revoke_sequence": sequence if send else None, "scope": trigger.scope})
    for ref in ids:
        _forget(ref, "revoked")
    if trigger.scope == "lease":
        actor_id, station, lease_ref = rows[0]["actor_user_id"], rows[0]["station_id"], rows[0]["id"]
    elif trigger.scope == "actor":
        actor_id, station, lease_ref = rows[0]["actor_user_id"], rows[0]["station_id"], "*"
    elif trigger.scope == "station":
        actor_id, station, lease_ref = installation_actor(conn), rows[0]["station_id"], "*"
    else:
        actor_id, station, lease_ref = installation_actor(conn), "*", "*"
    return Revocation(trigger.reason, trigger.scope, stream_id, sequence, lease_ref, actor_id, station, rows, revoked_at, permission_revision(conn))


def mark_acked(conn: sqlite3.Connection, stream_id: str, sequence: int, result: str) -> None:
    conn.execute("UPDATE capture_leases SET acked_at = ?, ack_result = ? WHERE stream_id = ? AND revoke_sequence = ? AND acked_at IS NULL",
                 (now_iso(), result, stream_id, sequence))


def count_attempt(conn: sqlite3.Connection, stream_id: str, sequence: int) -> None:
    conn.execute("UPDATE capture_leases SET revoke_attempts = revoke_attempts + 1 WHERE stream_id = ? AND revoke_sequence = ?", (stream_id, sequence))


def expire_due(conn: sqlite3.Connection) -> list[str]:
    """The janitor's expiry: live rows whose `lease_expires_at` passed -> `expired` (nothing is sent: both sides enforce it)."""
    cutoff = iso(now())
    ids = [r[0] for r in conn.execute("SELECT id FROM capture_leases WHERE state IN ('issued', 'active') AND lease_expires_at <= ?", (cutoff,)).fetchall()]
    for ref in ids:
        conn.execute("UPDATE capture_leases SET state = 'expired', state_at = ?, reason = 'expired' WHERE id = ? AND state IN ('issued', 'active')", (now_iso(), ref))
        _audit(conn, "intercom.capture_lease.expire", f"lease:{ref}", {"reason": "expired"})
        _forget(ref, "expired")
    return ids


def prune(conn: sqlite3.Connection, days: int = RETENTION_DAYS) -> int:
    cutoff = iso(now() - timedelta(days=days))
    return conn.execute("DELETE FROM capture_leases WHERE state NOT IN ('issued', 'active') AND state_at < ?", (cutoff,)).rowcount


def reload_live(conn: sqlite3.Connection) -> None:
    """Re-read the live rows into the cache (start-up: there should be none after `revoke_all_at_startup`)."""
    rows = live_rows(conn)
    with REG.lock:
        REG.live.clear()
        for r in rows:
            snap = Snapshot(REG.epoch_all, REG.epoch_actor.get(r["actor_user_id"], 0), REG.epoch_station.get(r["station_id"], 0),
                            REG.epoch_person.get(r["person_id"], 0), r["actor_user_id"], r["station_id"], r["person_id"])
            REG.live[r["id"]] = LiveLease(r["id"], r["actor_user_id"], r["station_id"], int(r["reader_id"]), r["person_id"], parse_iso(r["lease_expires_at"]), snap,
                                          r["state"], r["wiskey_session_id"])


def startup_revoke(conn: sqlite3.Connection) -> int:
    """F4: Arx holds no lease after a restart - every live row -> `revoked(startup)` (no sequence: the stream reset that
    follows destroys whatever the host still holds)."""
    rows = live_rows(conn)
    if not rows:
        return 0
    at = now_iso()
    conn.execute("UPDATE capture_leases SET state = 'revoked', state_at = ?, reason = 'startup' WHERE state IN ('issued', 'active')", (at,))
    for r in rows:
        _audit(conn, "intercom.capture_lease.revoke", f"lease:{r['id']}", {"reason": "startup", "revoke_sequence": None, "scope": "all"})
    return len(rows)


def tables_present(conn: sqlite3.Connection) -> bool:
    try:
        return conn.execute("SELECT COUNT(*) FROM sqlite_master WHERE type = 'table' AND name IN ('capture_leases', 'capture_lease_stream')").fetchone()[0] == 2
    except sqlite3.Error:
        return False


def reset_for_tests() -> None:
    global TEST_SKIP_NEXT_SEQUENCE
    REG.reset()
    GUARDS.degraded = False
    GUARDS.clock_untrusted = False
    TEST_SKIP_NEXT_SEQUENCE = False
    set_clock()
