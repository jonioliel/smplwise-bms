"""The capture lease's signed revocation stream and the lease worker (CR-WISKEY-LEASE-REVOCATION-EVENT slice L3).

What leaves Arx here, all signed with the pairing secret through services/trusted_caller.py, protocol `wiskey-capture-lease-v1`
(docs/contracts/wiskey-capture-lease/), message lifetime <= 15 s, at most 8192 bytes:

- `lease_revoke` - the authority of the named lease(s) is gone (scope lease | actor | station | all). Sent at least once:
  retried every RETRY_S with a NEW envelope (new request_id, new nonce, the SAME sequence and params) until a closed answer
  (`acknowledged | duplicate | stale | gap | conflict | unknown_stream`) arrives or `lease_expires_at + 15 s` of the revoked
  rows has passed. After CANCEL_AFTER_S without an answer the lease's own signed `capture_cancel` is sent once too (F1: an
  independent "lose authority" signal). Retrying is allowed because the message only REMOVES authority (CR section 8.1).
- `lease_heartbeat` - every HEARTBEAT_S while at least one lease is live; repeats the last sequence, carries the live lease
  refs (<= 8), grants nothing, never extends a lease. WisKey destroys every live lease after SILENCE_S without a revoke or a
  heartbeat (WisKey's rule, confirmed 2026-10-21). Heartbeats are not audited per message: `.heartbeat_start` / `.heartbeat_stop` only.
- `lease_stream_reset` - a new stream (start-up with live rows or the route on, re-pair, restore, key rotation, a host that
  lost the stream): every lease from an earlier stream is destroyed on the host; the new stream's sequence 1.

THE WIRE IS CLOSED (LEASEARX-295, WisKey's answer of 2026-10-21): DTO v3, `protocol = wiskey-capture-lease-v1`, the service data exactly
`{signed_message_json}`, no generalized W1 envelope field, and no `kid` on the wire (lease.schema.json is closed). The final service names
are SERVICE_EVENT and SERVICE_REQUEST below; they are written in this one place only.

THE TRANSPORT IS AN INTERFACE (slice L4 - the bridge services below - waits for the bridge release and WisKey's consumer):
`BridgeLeaseTransport` is what the bridge line 0.9.x is called through; it is never reached in this build because the
route cannot be switched on (capture_lease.MIN_BRIDGE_FOR_CAPTURE_LEASE is None) and nothing is sent while no lease is live.
Tests install a fake transport (tests/fake_trusted_bridge.py `FakeLeaseBridge` + tests/fake_wiskey.py `FakeLeaseHost`).

The worker thread starts only when there is something to do (a live lease, a pending message, a trigger) and ends when idle;
`step()` is one deterministic round that tests drive with a fake clock (AUTO_THREAD = False)."""
from __future__ import annotations

import logging
import sqlite3
import threading
import uuid
from dataclasses import dataclass, field
from typing import Any, Protocol

from ..db import Database, get_setting, is_busy
from . import capture_lease as cl
from . import bridge_rotation as _rotation
from . import ha_bridge, lease_answers, trusted_caller
from .wiskey_channels import LEASE_SIGNED

log = logging.getLogger("smplwise.capture_lease")

MESSAGE_LIFETIME_S = 15  # 0 < expires_at - issued_at <= 15 s for every lease-route message (CR 1.1)
MAX_MESSAGE_BYTES = 8192
EVENT_ACTIONS = ("lease_revoke", "lease_heartbeat", "lease_stream_reset")
REQUEST_ACTIONS = cl.LEASE_ACTIONS
if frozenset(REQUEST_ACTIONS) != LEASE_SIGNED:  # one closed list of the four signed lease actions
    raise RuntimeError("capture lease actions out of step with wiskey_channels.LEASE_SIGNED")
ALL_ACTIONS = EVENT_ACTIONS + REQUEST_ACTIONS
RETRY_S = 2.0
CANCEL_AFTER_S = 5.0
HEARTBEAT_S = 5.0  # owner decision 2026-10-16 q3
SILENCE_S = 15.0  # WisKey destroys after this much silence (confirmed 2026-10-21); Arx uses it only to name a reconciliation `host_silence`
DEADLINE_GRACE_S = 15.0  # retries stop lease_expires_at + this
# K-02 (review 3, after HMACACT2-295): a message held by the bridge-key rotation pause is held at most this long. While paused no
# heartbeat and no revoke reaches the host, so after SILENCE_S its own silence rule has destroyed every live lease: the held message
# has nothing left to act on and describes an older world than the host's. It is then dropped - audited (`held_expired`), never silently -
# and the rotation's own stream reset (T9 `key_rotation`) starts the next stream.
HELD_MAX_S = SILENCE_S
TICK_S = 0.25
JANITOR_S = 1.0
SHUTDOWN_BUDGET_S = 2.0
ANNOUNCE_TIMEOUT_S = 3.0
MAX_LIVE_IN_HEARTBEAT = 8
BUSY_RETRIES = 3  # ledger writes tried this many times on "database is locked" before F3 degrades the route (review M3)
BUSY_BACKOFF_S = 0.5  # 0.5 s, then 1 s between the tries (each try itself waits up to db.BUSY_TIMEOUT_S for the lock)
RECENT_GRACE_S = 2 * 5.0  # a lease Arx ended this long before a heartbeat was sent is not "unknown" to that heartbeat (M2)
ACK_RESULTS = ("acknowledged", "duplicate", "stale", "gap", "conflict", "unknown_stream")
CLOCK_CODES = ("time/clock_invalid", "time/not_yet_valid")
AUTO_THREAD = True  # tests switch it off and call WORKER.step() with a fake clock
# test hook (N6): the worker stops beating, so the host's silence rule fires
TEST_SUPPRESS_HEARTBEAT = False


# ---------------------------------------------------------------- the transport interface

class LeaseTransport(Protocol):
    def event(self, settings: Any, text: str) -> Any:
        """`smplwise_bridge.lease_event` (SERVICE_EVENT) with {signed_message_json: text}, return_response."""

    def request(self, settings: Any, action: str, text: str) -> Any:
        """One of the four lease requests (capture_start / status / confirm / cancel): `smplwise_bridge.lease_request` (SERVICE_REQUEST)."""


BRIDGE_DOMAIN = "smplwise_bridge"
SERVICE_EVENT = "lease_event"  # lease_revoke | lease_heartbeat | lease_stream_reset (FINAL, WisKey 2026-10-21)
SERVICE_REQUEST = "lease_request"  # capture_start | capture_status | capture_confirm | capture_cancel (FINAL, WisKey 2026-10-21)
SERVICE_DATA_KEY = "signed_message_json"  # the service data is exactly {signed_message_json}


class BridgeLeaseTransport:
    """The real transport, for the bridge line that will offer it (slice L4, PENDING). Two services, both with `supports_response: ONLY`
    and data exactly `{signed_message_json}`: `smplwise_bridge.lease_event` (the revocation stream) and `smplwise_bridge.lease_request`
    (the four lease requests). Unreachable in this build (the route cannot be switched on while MIN_BRIDGE_FOR_CAPTURE_LEASE is None)."""

    def event(self, settings: Any, text: str) -> Any:
        from . import ha_client

        return ha_client.call_service(settings, BRIDGE_DOMAIN, SERVICE_EVENT, {SERVICE_DATA_KEY: text}, return_response=True)

    def request(self, settings: Any, action: str, text: str) -> Any:
        from . import ha_client

        return ha_client.call_service(settings, BRIDGE_DOMAIN, SERVICE_REQUEST, {SERVICE_DATA_KEY: text}, return_response=True)


TRANSPORT: LeaseTransport = BridgeLeaseTransport()


def set_transport(transport: LeaseTransport | None) -> None:
    global TRANSPORT
    TRANSPORT = transport or BridgeLeaseTransport()


# ---------------------------------------------------------------- signing

class NotSendable(Exception):
    """No pairing secret / not paired / a message the signer refuses: nothing was sent. `code` only, never input."""

    def __init__(self, code: str) -> None:
        super().__init__(code)
        self.code = code


def _secret(conn: sqlite3.Connection) -> str:
    """The signing key (a `ha_bridge.BridgeKey` once the key set exists). Its key id never goes on a lease wire: see `sign`."""
    if _rotation.door_commands_paused(conn):  # HMACACT2-295: held - the event worker retries it, for at most HELD_MAX_S (K-02)
        raise NotSendable(_rotation.PAUSE_CODE)
    secret = ha_bridge.signing_key(conn)
    if not secret or not get_setting(conn, "bridge.paired_at"):
        raise NotSendable("bridge_not_paired")
    return secret


def sign(conn: sqlite3.Connection, action: str, actor_id: str, display_name: str, station: str, params: dict[str, Any],
         request_id: str | None = None, nonce: str | None = None, at: Any = None) -> trusted_caller.Signed:
    """One signed lease-route message with the host clock (capture_lease.now). Raises NotSendable before anything leaves.

    The v1 lease wire is CLOSED (lease.schema.json has no `kid`): after a key rotation the message is signed with the v2 recipe of the
    current key (the key id is bound into the MAC) but the `kid` field is NOT put on the wire (review L-05); the bridge verifies by
    trying the key ids its key set accepts."""
    secret = _secret(conn)
    try:
        return trusted_caller.sign(secret, protocol=cl.PROTOCOL, actions=ALL_ACTIONS, action=action, actor_id=actor_id, display_name=display_name,
                                   station=station, params=params, request_id=request_id or str(uuid.uuid4()), lifetime_s=MESSAGE_LIFETIME_S,
                                   max_lifetime_s=MESSAGE_LIFETIME_S, max_bytes=MAX_MESSAGE_BYTES, now=at or cl.now(), nonce=nonce, kid_on_wire=False)
    except (trusted_caller.MessageInvalid, ValueError):
        raise NotSendable("message_invalid") from None


# ---------------------------------------------------------------- answers (closed set, CR 1.2)

def classify(answer: Any, request_id: str, sequence: int | None = None, action: str | None = None) -> tuple[str, dict[str, Any]]:
    """(kind, data). kind: one of ACK_RESULTS, `rejected` (data: code = "<stage>/<code>"), or `invalid` (not one of the
    closed shapes of lease.schema.json `answer_event`, or it names another request / another sequence: NOT an acknowledgement - F6).
    The closed shapes and the stage / request_id rules live in services/lease_answers.py."""
    r = trusted_caller.response_of(answer)
    if r is None:
        return "invalid", {"code": "invalid_response"}
    return lease_answers.classify_event(r, request_id, sequence, action)


# ---------------------------------------------------------------- the worker

@dataclass
class Pending:
    action: str  # lease_revoke | lease_stream_reset
    stream_id: str
    sequence: int
    actor_id: str
    station: str
    params: dict[str, Any]
    deadline: float  # monotonic
    created: float = field(default_factory=cl.mono)
    next_try: float = 0.0
    attempts: int = 0
    cancel_sent: bool = False
    unknown_streams: int = 0
    done: bool = False
    held_since: float | None = None  # monotonic: when the rotation pause first held this message (K-02)
    sessions: list[tuple[str, str, str, str]] = field(default_factory=list)  # (lease_ref, session_id, station, actor) for the F1 cancel


class LeaseWorker:
    def __init__(self) -> None:
        self.db: Database | None = None
        self.settings: Any = None
        self._lock = threading.RLock()  # one round at a time (thread vs a test's / the route's own step)
        self._thread: threading.Thread | None = None
        self._stop = threading.Event()
        self._wake = threading.Event()
        self.pending: list[Pending] = []
        self.last_beat = -1e9
        self.last_ok = cl.mono()  # the last answered exchange (any closed answer) - names a reconciliation host_silence
        self.beating = False
        self.last_janitor = -1e9
        self.announced: str | None = None  # the stream id the host acknowledged a reset for
        self.reset_requested: tuple[str, bool] | None = None  # (reason, there were live leases) - processed by the next round
        cl.REG.wake = self.wake

    # -- lifecycle
    def attach(self, db: Database, settings: Any) -> None:
        self.db = db
        self.settings = settings

    def wake(self) -> None:
        self._wake.set()
        if AUTO_THREAD and self.db is not None:
            self._ensure_thread()

    def _ensure_thread(self) -> None:
        with self._lock:
            if self._thread is None or not self._thread.is_alive():
                self._stop = threading.Event()
                self._thread = threading.Thread(target=self._run, args=(self._stop,), name="capture-lease", daemon=True)
                self._thread.start()

    def _busy(self) -> bool:
        return cl.has_live() or any(not p.done for p in self.pending) or not cl.REG.triggers.empty() or self.beating or self.reset_requested is not None

    def _run(self, stop: threading.Event) -> None:
        while not stop.is_set():
            try:
                self.step()
            except Exception:  # noqa: BLE001 - the worker never dies of one round
                log.exception("capture lease worker: round failed")
            if not self._busy():
                with self._lock:
                    if self._thread is threading.current_thread():
                        self._thread = None
                return
            self._wake.wait(TICK_S)
            self._wake.clear()

    def stop(self) -> None:
        self._stop.set()
        self._wake.set()

    def reset(self) -> None:
        self.stop()
        with self._lock:
            self.pending = []
            self.last_beat = -1e9
            self.last_ok = cl.mono()
            self.beating = False
            self.last_janitor = -1e9
            self.announced = None
            self.reset_requested = None
            self._thread = None
        cl.REG.wake = self.wake

    def request_reset(self, reason: str) -> None:
        """T9 / restore: a new stream after a re-pair, a pairing-key regeneration, a key rotation or a restore. Taken by the next
        round; a stream reset is SENT only when there were live leases or the route is on (no traffic otherwise)."""
        self.reset_requested = (reason, cl.has_live() or bool(self.reset_requested and self.reset_requested[1]))
        self.announced = None
        self._wake.set()
        if AUTO_THREAD and self.db is not None:
            self._ensure_thread()

    # -- one round
    def step(self) -> None:
        if self.db is None:
            return
        with self._lock:
            cl.emergency_sweep(self.db)  # CAPEMERGENCY2-295: a lease live while an emergency OPEN holds is revoked (never raises)
            self._apply_triggers()
            if self.reset_requested is not None:
                reason, had_live = self.reset_requested
                self.reset_requested = None
                try:
                    with self.db.connection(mode="read", label="capture_lease.reset") as conn:
                        on = cl.route_on(conn) if cl.tables_present(conn) else False
                    if on or had_live:
                        self.reset_stream(reason)
                except Exception:  # noqa: BLE001
                    log.warning("capture lease: the requested stream reset failed", exc_info=True)
            for p in [p for p in self.pending if not p.done]:
                self._service(p)
            self.pending = [p for p in self.pending if not p.done]
            self._heartbeat()
            if cl.mono() - self.last_janitor >= JANITOR_S:
                self.last_janitor = cl.mono()
                self._janitor()

    # -- triggers -> ledger -> pending messages
    def _apply_triggers(self) -> None:
        """Every queued trigger -> the ledger (one write each) -> a pending revoke. Review M3: "database is locked" (a backup,
        a restore or a large import holding the write lock) is retried BUSY_RETRIES times with backoff before F3 degrades the
        route; while a retry waits, `GUARDS.ledger_busy` keeps the route closed (no issue, no heartbeat - the epochs already
        moved, so the lease is unusable in Arx at once and the host's silence rule is the backstop)."""
        assert self.db is not None
        deferred: list[cl.Trigger] = []
        now = cl.mono()
        while True:
            try:
                trigger = cl.REG.triggers.get_nowait()
            except Exception:  # noqa: BLE001 - queue.Empty
                break
            if trigger.not_before > now:
                deferred.append(trigger)
                continue
            try:
                with self.db.write_aside(label="capture_lease.revoke", priority=trigger.attempts > 0) as conn:
                    revocation = cl.revoke(conn, trigger)
            except Exception as exc:  # noqa: BLE001 - F3: the ledger / counter write failed
                if is_busy(exc) and trigger.attempts + 1 < BUSY_RETRIES:
                    trigger.attempts += 1
                    trigger.not_before = cl.mono() + BUSY_BACKOFF_S * (2 ** (trigger.attempts - 1))
                    log.warning("capture lease: the ledger was busy while revoking (attempt %s); retrying", trigger.attempts)
                    deferred.append(trigger)
                    continue
                self._ledger_failed(trigger, exc)
                continue
            if revocation is not None:
                self._queue_revoke(revocation)
        for trigger in deferred:
            cl.REG.triggers.put(trigger)
        cl.GUARDS.ledger_busy = any(t.attempts > 0 for t in deferred)

    def _queue_revoke(self, rev: cl.Revocation) -> None:
        expires = max(cl.parse_iso(r["lease_expires_at"]) for r in rev.rows)
        remaining = (expires - cl.now()).total_seconds()
        params = {"stream_id": rev.stream_id, "sequence": rev.sequence, "scope": rev.scope, "lease_ref": rev.lease_ref,
                  "permission_revision": rev.permission_revision, "reason": rev.reason, "revoked_at": rev.revoked_at}
        sessions = [(r["id"], r["wiskey_session_id"] or "*", r["station_id"], r["actor_user_id"]) for r in rev.rows]
        self.pending.append(Pending("lease_revoke", rev.stream_id, rev.sequence, rev.actor_id, rev.station, params,
                                    deadline=cl.mono() + max(0.0, remaining) + DEADLINE_GRACE_S, sessions=sessions))

    def _ledger_failed(self, trigger: cl.Trigger, exc: BaseException) -> None:
        """F3: send `lease_revoke scope: all` with the last known sequence (the host's gap / conflict logic destroys
        everything either way) and switch the route off in memory until restart or an administrator's audited
        `degraded_reenable` (routers/capture_lease.py)."""
        cl.GUARDS.degraded = True
        cl.GUARDS.ledger_busy = False
        log.error("capture lease: the ledger could not record a revoke (%s); every lease is revoked and the route is off until restart or an administrator's re-enable",
                  type(exc).__name__)
        assert self.db is not None
        stream_id, sequence, actor = "0" * 32, 1, "smplwise-arx"
        try:
            with self.db.connection(mode="read", label="capture_lease.degraded") as conn:
                found = cl.last_sequence(conn)
                actor = cl.installation_actor(conn)
                if found:
                    stream_id, sequence = found[0], max(1, found[1])
        except Exception:  # noqa: BLE001
            pass
        with cl.REG.lock:
            refs = list(cl.REG.live)
            cl.REG.live.clear()
            cl.REG.epoch_all += 1
        params = {"stream_id": stream_id, "sequence": sequence, "scope": "all", "lease_ref": "*", "permission_revision": 0,
                  "reason": "ledger_unavailable", "revoked_at": cl.iso(cl.now())}
        self.pending.append(Pending("lease_revoke", stream_id, sequence, actor, "*", params, deadline=cl.mono() + cl.LEASE_MAX_S + DEADLINE_GRACE_S))
        self._audit_aside("intercom.capture_lease.event_failed", f"stream:{stream_id}", {"code": "ledger_unavailable", "leases": len(refs)})

    # -- sending
    def _send_event(self, conn: sqlite3.Connection, action: str, actor_id: str, station: str, params: dict[str, Any]) -> tuple[trusted_caller.Signed, Any]:
        signed = sign(conn, action, actor_id, actor_id, station, params)
        answer = TRANSPORT.event(self.settings, signed.text)
        return signed, answer

    def _service(self, p: Pending) -> None:
        assert self.db is not None
        now = cl.mono()
        if now >= p.deadline:
            p.done = True
            self._audit_aside("intercom.capture_lease.event_failed", f"stream:{p.stream_id}", {"code": "deadline_passed", "sequence": p.sequence, "attempts": p.attempts})
            return
        if p.action == "lease_revoke" and not p.cancel_sent and now - p.created >= CANCEL_AFTER_S:
            p.cancel_sent = True
            self._cancel_sessions(p)
        if now < p.next_try:
            return
        p.next_try = now + RETRY_S
        p.attempts += 1
        try:
            with self.db.connection(mode="read", label="capture_lease.send") as conn:
                signed, answer = self._send_event(conn, p.action, p.actor_id, p.station, p.params)
        except NotSendable as exc:
            if exc.code == _rotation.PAUSE_CODE:
                self._held(p, now)
                return
            p.held_since = None
            self._audit_aside("intercom.capture_lease.event_failed", f"stream:{p.stream_id}", {"code": exc.code, "sequence": p.sequence, "attempt": p.attempts})
            return
        except Exception as exc:  # noqa: BLE001 - HA unreachable / service missing / a timeout: retried (F1)
            p.held_since = None  # signed, so no longer paused
            code = getattr(exc, "code", None) or type(exc).__name__
            self._audit_aside("intercom.capture_lease.event_failed", f"stream:{p.stream_id}", {"code": str(code)[:64], "sequence": p.sequence, "attempt": p.attempts})
            return
        p.held_since = None
        self._audit_aside("intercom.capture_lease.event_sent", f"stream:{p.stream_id}",
                          {"action": p.action, "request_id": signed.request_id, "body_sha256": signed.body_sha256, "attempt": p.attempts, "sequence": p.sequence})
        kind, data = classify(answer, signed.request_id, p.sequence, p.action)
        self._on_answer(p, kind, data)

    def _held(self, p: Pending, now: float) -> None:
        """K-02: the rotation pause holds `p`. Audited once when the hold starts (not on every retry); dropped - audited
        `held_expired` - once it has been held HELD_MAX_S, because the host's silence rule has destroyed every lease by then."""
        if p.held_since is None:
            p.held_since = now
            self._audit_aside("intercom.capture_lease.event_failed", f"stream:{p.stream_id}",
                              {"code": _rotation.PAUSE_CODE, "sequence": p.sequence, "attempt": p.attempts})
            return
        if now - p.held_since >= HELD_MAX_S:
            p.done = True
            self._audit_aside("intercom.capture_lease.event_failed", f"stream:{p.stream_id}",
                              {"code": "held_expired", "action": p.action, "sequence": p.sequence, "attempts": p.attempts,
                               "held_s": round(now - p.held_since, 1)})

    def _on_answer(self, p: Pending, kind: str, data: dict[str, Any]) -> None:
        assert self.db is not None
        if kind == "rejected":
            self._audit_aside("intercom.capture_lease.event_failed", f"stream:{p.stream_id}", {"code": data["code"], "sequence": p.sequence, "attempt": p.attempts})
            if data["code"] in CLOCK_CODES:
                self._clock_invalid()
            return
        if kind == "invalid":
            self._audit_aside("intercom.capture_lease.event_failed", f"stream:{p.stream_id}", {"code": data["code"], "sequence": p.sequence, "attempt": p.attempts})
            return
        self.last_ok = cl.mono()
        if kind == "unknown_stream":
            p.unknown_streams += 1
            self._audit_aside("intercom.capture_lease.event_failed", f"stream:{p.stream_id}", {"code": "unknown_stream", "sequence": p.sequence, "attempt": p.attempts})
            if p.action == "lease_stream_reset":
                return  # a reset names its own new stream; unknown_stream to it is just a retry
            if p.unknown_streams >= 2:
                p.done = True
                self._host_lost_stream()
            return
        p.done = True
        if p.action == "lease_stream_reset":
            self.announced = p.stream_id
        try:
            for attempt in range(BUSY_RETRIES):  # review M3: "database is locked" is tried again (priority) before degrading
                try:
                    with self.db.write_aside(label="capture_lease.ack", priority=attempt > 0) as conn:
                        if p.action == "lease_revoke":
                            cl.mark_acked(conn, p.stream_id, p.sequence, kind)
                        cl._audit(conn, "intercom.capture_lease.event_acked", f"stream:{p.stream_id}",
                                  {"action": p.action, "ack_result": kind, "sequence": p.sequence, "destroyed": data.get("destroyed"), "last_sequence": data.get("last_sequence")})
                        if kind in ("gap", "conflict"):
                            # the host destroyed EVERY live lease: the ledger follows (no message: nothing is left to revoke on the host)
                            cl.revoke(conn, cl.Trigger("host_gap" if kind == "gap" else "host_conflict", "all", None), send=False)
                    break
                except Exception as exc:  # noqa: BLE001
                    if not is_busy(exc) or attempt + 1 >= BUSY_RETRIES:
                        raise
                    log.warning("capture lease: the ledger was busy while recording an answer (attempt %s); retrying", attempt + 1)
        except Exception as exc:  # noqa: BLE001 - F3: the answer stands (the host acted); the ledger could not follow
            cl.GUARDS.degraded = True
            log.error("capture lease: the answer to sequence %s could not be recorded (%s); the route is off until restart or an administrator's re-enable",
                      p.sequence, type(exc).__name__)
            if kind in ("gap", "conflict"):
                with cl.REG.lock:
                    cl.REG.live.clear()
                    cl.REG.epoch_all += 1

    def _cancel_sessions(self, p: Pending) -> None:
        """F1: after CANCEL_AFTER_S without an answer to a revoke, the lease's own signed `capture_cancel` - once, never
        retried, idempotent on the host. Recorded as `.event_sent` / `.event_failed` (code only)."""
        assert self.db is not None
        for lease_ref, session_id, station, actor in p.sessions:
            try:
                with self.db.connection(mode="read", label="capture_lease.cancel") as conn:
                    signed = sign(conn, "capture_cancel", actor, actor, station, {"lease_ref": lease_ref, "session_id": session_id})
                TRANSPORT.request(self.settings, "capture_cancel", signed.text)
                self._audit_aside("intercom.capture_lease.event_sent", f"lease:{lease_ref}", {"action": "capture_cancel", "request_id": signed.request_id,
                                                                                             "body_sha256": signed.body_sha256, "attempt": 1})
            except Exception as exc:  # noqa: BLE001
                code = getattr(exc, "code", None) or type(exc).__name__
                self._audit_aside("intercom.capture_lease.event_failed", f"lease:{lease_ref}", {"code": str(code)[:64], "action": "capture_cancel"})

    def _clock_invalid(self) -> None:
        """F5: revoke all, stop issuing, until a good signed exchange of a non-lease message or an administrator re-enables."""
        if not cl.GUARDS.clock_untrusted:
            cl.GUARDS.clock_untrusted = True
            log.warning("capture lease: the bridge reported an untrusted clock; every lease is revoked and no lease is issued")
        cl.on_authority_change("clock_invalid", all=True)

    def _host_lost_stream(self) -> None:
        """F6: `unknown_stream` twice in a row -> a new stream (`lease_stream_reset`) and revoke all (`host_lost_stream`)."""
        cl.on_authority_change("host_lost_stream", all=True)
        self._apply_triggers()
        self.reset_stream("host_lost_stream")

    def reset_stream(self, reason: str) -> str | None:
        """A new stream row + one `lease_stream_reset` (sequence 1). Returns the new stream id (None when the tables are absent)."""
        assert self.db is not None
        with self.db.write_aside(label="capture_lease.stream") as conn:
            if not cl.tables_present(conn):
                return None
            stream_id, previous = cl.new_stream(conn, reason)
            actor = cl.installation_actor(conn)
        params = {"stream_id": stream_id, "previous_stream_id": previous or "*", "sequence": 1, "reason": reason if reason in ("startup", "repair", "restore", "key_rotation") else "repair"}
        self.announced = None
        self.pending.append(Pending("lease_stream_reset", stream_id, 1, actor, "*", params, deadline=cl.mono() + cl.LEASE_MAX_S + DEADLINE_GRACE_S))
        return stream_id

    def ensure_announced(self, timeout: float = ANNOUNCE_TIMEOUT_S) -> bool:
        """Before the first lease of a stream is signed, the host must know the stream: send its reset (if not acknowledged
        yet) and wait for the answer. False -> the start is refused (503), nothing was signed for the capture."""
        assert self.db is not None
        with self._lock:
            with self.db.connection(mode="read", label="capture_lease.announce") as conn:
                found = cl.current_stream(conn) if cl.tables_present(conn) else None
            if found is not None and self.announced == found[0]:
                return True
            if not any(p.action == "lease_stream_reset" and not p.done for p in self.pending):
                self.reset_stream("startup" if found is None else "repair")
        deadline = cl.mono() + timeout
        while cl.mono() < deadline:
            self.step()
            with self.db.connection(mode="read", label="capture_lease.announce") as conn:
                found = cl.current_stream(conn)
            if found is not None and self.announced == found[0]:
                return True
            if not AUTO_THREAD:
                return False  # a test drives the clock: one round is all it gets here
            self._wake.wait(0.1)
        return False

    # -- heartbeat and reconciliation
    def _heartbeat(self) -> None:
        assert self.db is not None
        live = cl.live_refs()
        if not live:
            if self.beating:
                self.beating = False
                self._audit_aside("intercom.capture_lease.heartbeat_stop", "stream:*", {})
            return
        if not self.beating:
            self.beating = True
            self._audit_aside("intercom.capture_lease.heartbeat_start", "stream:*", {"live": len(live)})
        if TEST_SUPPRESS_HEARTBEAT or cl.GUARDS.ledger_busy or cl.mono() - self.last_beat < HEARTBEAT_S:
            return  # ledger_busy: a revoke waits for the ledger - never tell the host its leases are fine meanwhile (M3)
        self.last_beat = cl.mono()
        sent_at = cl.mono()
        try:
            with self.db.connection(mode="read", label="capture_lease.heartbeat") as conn:
                found = cl.last_sequence(conn)
                if found is None:
                    return
                with cl.REG.lock:  # every LIVE lease, `issued` included (a start in flight may already hold a session; review L2)
                    active = [ref for ref, e in cl.REG.live.items() if e.state in cl.LIVE][:MAX_LIVE_IN_HEARTBEAT]
                params = {"stream_id": found[0], "sequence": max(1, found[1]), "live_leases": active, "permission_revision": cl.permission_revision(conn)}
                signed, answer = self._send_event(conn, "lease_heartbeat", cl.installation_actor(conn), "*", params)
        except Exception as exc:  # noqa: BLE001 - a heartbeat that cannot be sent is simply missed; the host's silence rule is the backstop
            log.debug("capture lease heartbeat not sent (%s)", getattr(exc, "code", type(exc).__name__))
            return
        kind, data = classify(answer, signed.request_id, params["sequence"], "lease_heartbeat")
        if kind == "rejected":
            if data["code"] in CLOCK_CODES:
                self._clock_invalid()
            return
        if kind == "unknown_stream":
            self._host_lost_stream()
            return
        if kind != "acknowledged" or "live_leases" not in data:
            return
        silent = sent_at - self.last_ok > SILENCE_S
        self.last_ok = cl.mono()
        self._reconcile(set(data["live_leases"]), sent_at, silent)

    def _reconcile(self, host_live: set[str], sent_at: float, silent: bool) -> None:
        """F7 / N6: a lease the host lists that Arx has no live row for -> revoke all (`unknown_lease_on_host`); an active Arx
        lease (activated before the heartbeat was sent) the host no longer holds -> `destroyed(host_silence | host_absent)`.
        Review M2: a lease Arx itself ended (confirm, cancel, revoke, expiry) shortly before or while this heartbeat was in
        flight is NOT unknown - the host's answer simply predates its end; only a ref Arx never ended recently counts."""
        with cl.REG.lock:
            entries = {ref: e for ref, e in cl.REG.live.items() if e.state in cl.LIVE}
        unknown = host_live - set(entries) - cl.REG.ended_since(sent_at - RECENT_GRACE_S)
        if unknown:
            cl.on_authority_change("unknown_lease_on_host", all=True)
            return
        assert self.db is not None
        for ref, entry in entries.items():
            if entry.state == "active" and entry.activated_mono is not None and entry.activated_mono < sent_at and ref not in host_live:
                cl.finish(self.db, ref, "destroyed", "host_silence" if silent else "host_absent")

    # -- janitor
    def _janitor(self) -> None:
        assert self.db is not None
        try:
            with self.db.write_aside(label="capture_lease.janitor") as conn:
                if not cl.tables_present(conn):
                    return
                cl.expire_due(conn)
                cl.drop_orphans(conn)
                cl.prune(conn)
        except Exception:  # noqa: BLE001
            log.warning("capture lease janitor failed", exc_info=True)

    def _audit_aside(self, action: str, resource_id: str, details: dict[str, Any]) -> None:
        if self.db is None:
            return
        try:
            with self.db.write_aside(label="capture_lease.audit") as conn:
                cl._audit(conn, action, resource_id, details)
        except Exception:  # noqa: BLE001 - best effort, like the physical actions' outcome rows
            log.warning("capture lease: audit row %s could not be recorded", action)

    # -- start-up and shutdown (T11, F4)
    def on_startup(self, db: Database, settings: Any) -> None:
        """Every live row -> revoked(startup); a new stream + one `lease_stream_reset` when there were live rows or the route
        is on; nothing at all (no stream row, no traffic) when the tables are absent or the route is off with nothing live."""
        self.attach(db, settings)
        try:
            with db.write_aside(label="capture_lease.startup") as conn:
                if not cl.tables_present(conn):
                    return
                revoked = cl.startup_revoke(conn)
                on = cl.route_on(conn)
                cl.reload_live(conn)
            if revoked or on:
                self.reset_stream("startup")
                self.wake()
        except Exception:  # noqa: BLE001 - start-up never fails on this
            log.warning("capture lease start-up handling failed", exc_info=True)

    def on_shutdown(self, budget_s: float = SHUTDOWN_BUDGET_S) -> None:
        """Before the WisKey feed stops: when anything is live, `lease_revoke scope: all` (reason shutdown) within the budget."""
        if self.db is None or not cl.has_live():
            self.stop()
            return
        cl.on_authority_change("shutdown", all=True)
        deadline = cl.mono() + budget_s
        import time as _t

        while cl.mono() < deadline:
            self.step()
            if not any(not p.done for p in self.pending):
                break
            if not AUTO_THREAD:
                break
            _t.sleep(0.05)
        self.stop()


WORKER = LeaseWorker()


def reset_for_tests() -> None:
    global AUTO_THREAD, TEST_SUPPRESS_HEARTBEAT
    WORKER.reset()
    WORKER.db = None
    WORKER.settings = None
    TEST_SUPPRESS_HEARTBEAT = False
    set_transport(None)
