"""Local TEST-only lease DRAFT consumer. No registration, pairing or live I/O.

Caller supplies the pinned public schema and an in-memory TEST key explicitly.
The legacy compose catalogue never imports or enables this module. Wire gaps
in capture responses remain gaps; internal capture outcomes are not wire ACKs.
"""

from __future__ import annotations

import asyncio
import hashlib
import hmac
import json
import unicodedata
from contextvars import ContextVar
from dataclasses import dataclass
from datetime import timedelta
from uuid import UUID

from .envelope import ClockSample, freeze
from .validation import Refusal, Schema, aware, strict_json

PROTOCOL = "wiskey-capture-lease-v1"
EVENTS = frozenset({"lease_revoke", "lease_heartbeat", "lease_stream_reset"})
REQUESTS = frozenset({"capture_start", "capture_status", "capture_confirm", "capture_cancel"})
GO_LIVE_PERMITTED = False
_lease_owners = ContextVar("wiskey_experimental_lease_owners", default=frozenset())
_lease_step = ContextVar("wiskey_experimental_lease_step", default=None)


class LeaseRejected(Exception):
    def __init__(self, stage, code):
        self.stage, self.code, self.request_id = stage, code, None
        super().__init__(stage + "/" + code)


def canonical(value):
    return json.dumps(
        value, sort_keys=True, ensure_ascii=False, separators=(",", ":"), allow_nan=False
    ).encode("utf-8")


def uuid4_value(value):
    try:
        parsed = UUID(value)
        if parsed.version != 4 or str(parsed) != value:
            raise ValueError()
    except (ValueError, TypeError, AttributeError):
        raise LeaseRejected("schema", "bad_format") from None


@dataclass(frozen=True, repr=False)
class VerifiedLease:
    body: object
    seal: object


class TestLeaseVerifier:
    """Real HMAC in a bounded in-memory TEST harness, not production pairing."""

    def __init__(self, schema, test_key, clock, *, capacity=4096, replay=None):
        if (
            type(test_key) is not bytes
            or not test_key
            or type(capacity) is not int
            or not 1 <= capacity <= 4096
        ):
            raise ValueError("explicit bounded TEST verifier required")
        self.clock, self._key, self._seal = clock, test_key, object()
        self.capacity, self.seen, self.last_now = capacity, {}, None
        if replay is not None:
            from .lease_replay import LeaseReplay

            if type(replay) is not LeaseReplay:
                raise ValueError("explicit temporary replay store required")
        self.replay = replay
        self.definition = {k: v for k, v in schema.items() if k != "$defs"}
        self.resources = {"#/$defs/" + k: v for k, v in schema["$defs"].items()}
        self.schema = Schema(self.definition, self.resources)

    def owns(self, message):
        return type(message) is VerifiedLease and message.seal is self._seal

    def sample(self):
        clock = self.clock
        try:
            value = clock()
        except Exception:
            raise LeaseRejected("time", "clock_invalid") from None
        if self.clock is not clock:
            raise LeaseRejected("time", "clock_invalid")
        try:
            if type(value) is not ClockSample:
                raise Refusal()
            value.check()
            if self.last_now is not None and value.now < self.last_now:
                raise Refusal()
        except Refusal:
            raise LeaseRejected("time", "clock_invalid") from None
        if self.replay is not None:
            try:
                self.replay.observe(value.now)
            except Refusal:
                raise LeaseRejected("time", "clock_invalid") from None
        self.last_now = value.now
        return value.now

    def _shape(self, schema, value):
        if "$ref" in schema:
            self._shape(self.resources[schema["$ref"]], value)
        if type(value) is dict:
            props = schema.get("properties", {})
            if not set(schema.get("required", ())) <= value.keys():
                raise LeaseRejected("schema", "missing_field")
            if schema.get("additionalProperties") is False and value.keys() - props.keys():
                raise LeaseRejected("schema", "unknown_field")
            for k, v in value.items():
                if k in props:
                    self._shape(props[k], v)
        if type(value) is str:
            if any(unicodedata.category(c) in ("Cc", "Cf", "Cs") for c in value):
                raise LeaseRejected("schema", "bad_format")
            if schema.get("pattern") and not __import__("re").search(schema["pattern"], value):
                raise LeaseRejected("schema", "bad_format")
        if type(value) is list and type(schema.get("items")) is dict:
            for item in value:
                self._shape(schema["items"], item)

    def verify(self, service, encoded):
        try:
            return self._verify(service, encoded)
        except LeaseRejected as error:
            # Only these stages are reached after complete request schema and
            # UUID checks. Never echo a partially parsed/unvalidated identity.
            if error.stage in ("binding", "signature", "time", "state"):
                body = strict_json(encoded, limit=8192)
                error.request_id = body["request_id"]
            raise

    def _verify(self, service, encoded):
        try:
            body = strict_json(encoded, limit=8192)
        except Refusal:
            raise LeaseRejected("parse", "invalid_json") from None
        self._shape(self.definition, body)
        action, params = body.get("action"), body.get("params")
        if action in EVENTS | REQUESTS:
            self._shape(self.resources["#/$defs/params_" + action], params)
        try:
            self.schema(body)
        except Refusal:
            raise LeaseRejected("schema", "bad_value") from None
        uuid4_value(body["request_id"])
        for k in ["issued_at", "expires_at"]:
            try:
                aware(body[k])
            except Refusal:
                raise LeaseRejected("schema", "bad_format") from None
        if action == "lease_revoke":
            if params["scope"] == "lease":
                uuid4_value(params["lease_ref"])
            elif params["lease_ref"] != "*":
                raise LeaseRejected("schema", "bad_format")
        if action == "lease_heartbeat":
            for ref in params["live_leases"]:
                uuid4_value(ref)
        if action in REQUESTS:
            uuid4_value(
                params["lease"]["lease_ref"] if action == "capture_start" else params["lease_ref"]
            )
        if action == "capture_start":
            lease = params["lease"]
            try:
                start, end = aware(lease["lease_issued_at"]), aware(lease["lease_expires_at"])
            except Refusal:
                raise LeaseRejected("schema", "bad_format") from None
            if not 0 < (end - start).total_seconds() <= 120:
                raise LeaseRejected("schema", "bad_value")
            if not start <= aware(body["issued_at"]) < end:
                raise LeaseRejected("binding", "lease_window")
        star = (
            action in ("lease_heartbeat", "lease_stream_reset")
            or action == "lease_revoke"
            and params["scope"] == "all"
        )
        if (body["station"] == "*") != star:
            raise LeaseRejected("binding", "station_scope_mismatch")
        expected = "lease_event" if action in EVENTS else "lease_request"
        if service not in (expected, "smplwise_bridge." + expected):
            raise LeaseRejected("binding", "action_service_mismatch")
        if body["ts"] != int(aware(body["issued_at"]).timestamp()):
            raise LeaseRejected("binding", "ts_mismatch")
        signed = {k: v for k, v in body.items() if k not in ("ts", "nonce", "sig")}
        digest = hashlib.sha256(canonical(signed)).hexdigest()
        expected_sig = hmac.new(
            self._key, f"{body['ts']}.{body['nonce']}.{digest}".encode(), hashlib.sha256
        ).hexdigest()
        if not hmac.compare_digest(expected_sig, body["sig"]):
            raise LeaseRejected("signature", "bad_signature")
        issued, expires = aware(body["issued_at"]), aware(body["expires_at"])
        if (
            body["ts"] != int(issued.timestamp())
            or not 0 < (expires - issued).total_seconds() <= 15
        ):
            raise LeaseRejected("time", "lifetime_invalid")
        now = self.sample()
        if now >= expires or issued > now + timedelta(seconds=2):
            error = LeaseRejected("time", "expired_or_future")
            error.wire_code = "expired" if now >= expires else "not_yet_valid"
            raise error
        # Seven-day identity replay retention; capacity refuses instead of evicting.
        self.seen = {k: v for k, v in self.seen.items() if (now - v).total_seconds() < 7 * 86400}
        keys = (("request", body["request_id"]), ("nonce", body["nonce"]))
        if self.replay is not None:
            try:
                self.replay.reserve(body["request_id"], body["nonce"], now)
            except Refusal as e:
                raise LeaseRejected(
                    "state", "replay" if e.code == "unproven_duplicate" else "replay_unavailable"
                ) from None
        if any(k in self.seen for k in keys):
            raise LeaseRejected("state", "replay")
        if len(self.seen) + 2 > 2 * self.capacity:
            raise LeaseRejected("state", "capacity")
        self.seen.update({k: now for k in keys})
        return VerifiedLease(freeze(body), self._seal)


@dataclass(frozen=True, repr=False)
class LeaseAuthority:
    actor_id: str
    station: str
    lease_ref: str
    person_ref: str
    person_revision: int | None
    permission_revision: int
    binding_revision: str | None
    reader_id: int
    receiver: object
    generation: object
    allowed: bool
    principal_kind: str


def authority_valid(value):
    """Check the trusted port's exact types, not Python numeric equality."""
    if type(value) is not LeaseAuthority:
        return False
    for name in ("actor_id", "station", "lease_ref", "person_ref", "principal_kind"):
        item = getattr(value, name)
        if (
            type(item) is not str
            or not item
            or any(unicodedata.category(c) in ("Cc", "Cf", "Cs") for c in item)
        ):
            return False
    return (
        (
            value.person_revision is None
            or type(value.person_revision) is int
            and value.person_revision >= 0
        )
        and type(value.permission_revision) is int
        and value.permission_revision >= 0
        and (value.binding_revision is None or type(value.binding_revision) is str)
        and type(value.reader_id) is int
        and 0 <= value.reader_id <= 8
        and type(value.allowed) is bool
        and value.receiver is not None
        and value.generation is not None
        and value.principal_kind in ("arx_human", "ha_human")
    )


@dataclass(frozen=True, repr=False)
class CaptureSession:
    session_id: str
    message: VerifiedLease
    authority: LeaseAuthority
    collector: object
    verifier: object
    current: object
    wire_owner: object = None
    resource: object = None
    possible_dispatch: bool = False
    started: bool = False


@dataclass(frozen=True, repr=False)
class LeaseOperation:
    """Host-generated internal identities; never added to the signed DTO."""

    operation_id: str
    operation_binding_ref: str
    request_id: str
    lease_ref: str
    session_id: str
    action: str
    check: object


def current_lease_operation(host, session):
    value = _lease_step.get()
    if (
        value is None
        or value[0] is not host
        or value[1] is not session
        or value[3] is not asyncio.current_task()
    ):
        raise LeaseRejected("binding", "operation_missing")
    value[2].check()
    return value[2]


class ExperimentalLeaseHost:
    """Explicit isolated instance; event semantics complete, capture wire draft OFF.

    current() is Arx's injected authority oracle. It grants no WisKey role.
    Collector is an explicit fake, never discovered from HA or the network.
    """

    def __init__(self, verifier, installation_id, current, collector):
        if type(verifier) is not TestLeaseVerifier:
            raise ValueError("TEST verifier required")
        if not callable(current) or not all(
            callable(getattr(collector, name, None))
            for name in ("start", "status", "confirm", "close", "discard")
        ):
            raise ValueError("explicit collector and synchronous discard required")
        self.verifier, self.installation_id, self.current, self.collector = (
            verifier,
            installation_id,
            current,
            collector,
        )
        self.stream, self.sequence, self.meaning = None, 0, None
        self._streams = set()
        self.last_signal, self.permission_revision = None, None
        self.sessions, self.retired, self.closed = {}, [], False
        self._consumed = set()
        self._owner = object()
        self._retired_ids = set()
        self._resource_history = []
        self._cleanup_tasks = set()
        self._starts = set()
        self._effects = set()
        self._closing = None
        self.cleanup_failures = []
        self._busy = set()

    def _consume(self, message, actions):
        if not self.verifier.owns(message) or message.body["action"] not in actions or self.closed:
            raise LeaseRejected("state", "unverified")
        now = self.verifier.sample()
        if now >= aware(message.body["expires_at"]):
            raise LeaseRejected("time", "expired_or_future")
        rid = message.body["request_id"]
        if rid in self._consumed:
            raise LeaseRejected("state", "replay")
        if len(self._consumed) >= 4096:
            raise LeaseRejected("state", "capacity")
        self._consumed.add(rid)

    def _retire(self, session):
        resource = session.resource
        if resource is None or id(resource) in self._retired_ids:
            return
        self._retired_ids.add(id(resource))
        self._resource_history.append(resource)
        # Invalidate synchronously before any async join: a revoked card must
        # become unusable at once even while collector cleanup is pending.
        try:
            result = session.collector.discard(resource)
            import inspect

            if inspect.isawaitable(result):
                if inspect.iscoroutine(result):
                    result.close()
                raise TypeError("synchronous discard required")
        except Exception as error:
            self.cleanup_failures.append(type(error).__name__)
        self.retired.append((session.collector, resource))

    def _destroy(self, predicate=lambda session: True):
        refs = [ref for ref, s in self.sessions.items() if predicate(s)]
        destroyed = 0
        for ref in refs:
            session = self.sessions.pop(ref, None)
            if session is None:
                continue
            destroyed += 1
            self._retire(session)
        return destroyed

    def sweep(self):
        try:
            now = self.verifier.sample()
        except LeaseRejected:
            self._destroy()
            raise
        if (
            self.closed
            or self.last_signal is None
            or (now - self.last_signal).total_seconds() >= 15
        ):
            self._destroy()
        self._destroy(lambda s: now >= aware(s.message.body["params"]["lease"]["lease_expires_at"]))
        return now

    def _installation_actor(self, message):
        return message.body["actor"]["id"] == self.installation_id

    def event(self, message):
        self._consume(message, EVENTS)
        now = self.sweep()
        b, p = message.body, message.body["params"]
        rid, seq, action = b["request_id"], p["sequence"], b["action"]
        if (
            action in ("lease_stream_reset", "lease_heartbeat")
            or action == "lease_revoke"
            and p["scope"] in ("station", "all")
        ):
            if not self._installation_actor(message):
                raise LeaseRejected("binding", "actor_mismatch")
        reset_meaning = hashlib.sha256(
            canonical({"actor.id": b["actor"]["id"], "station": b["station"], "params": _plain(p)})
        ).digest()
        if action == "lease_stream_reset":
            if p["stream_id"] == self.stream:
                if seq < self.sequence:
                    return dict(
                        result="stale", request_id=rid, sequence=seq, last_sequence=self.sequence
                    )
                if reset_meaning == self.meaning:
                    return dict(result="duplicate", request_id=rid, sequence=seq)
                return dict(
                    result="conflict", request_id=rid, sequence=seq, destroyed=self._destroy()
                )
            if p["stream_id"] in self._streams:
                raise LeaseRejected("state", "stream_reused")
            if len(self._streams) >= 4096:
                raise LeaseRejected("state", "capacity")
            if self.verifier.replay is not None:
                try:
                    self.verifier.replay.remember_stream(p["stream_id"])
                except Refusal:
                    raise LeaseRejected("state", "stream_reused_or_unavailable") from None
            self._streams.add(p["stream_id"])
            destroyed = self._destroy()
            self.stream, self.sequence, self.meaning, self.last_signal = (
                p["stream_id"],
                1,
                reset_meaning,
                now,
            )
            return dict(result="acknowledged", request_id=rid, sequence=1, destroyed=destroyed)
        if p["stream_id"] != self.stream:
            return dict(result="unknown_stream", request_id=rid)
        destroyed = 0
        if (
            self.permission_revision is not None
            and p["permission_revision"] != self.permission_revision
        ):
            destroyed = self._destroy()
        self.permission_revision = p["permission_revision"]
        meaning = hashlib.sha256(
            canonical({"actor.id": b["actor"]["id"], "station": b["station"], "params": _plain(p)})
        ).digest()
        if action == "lease_heartbeat":
            if seq != self.sequence:
                destroyed += self._destroy()
                return dict(
                    result="gap",
                    request_id=rid,
                    sequence=seq,
                    last_sequence=self.sequence,
                    destroyed=destroyed,
                )
            self.last_signal = now
            return dict(
                result="acknowledged",
                request_id=rid,
                sequence=seq,
                destroyed=destroyed,
                live_leases=sorted(self.sessions),
            )
        if seq == self.sequence:
            if self.meaning == meaning:
                return dict(result="duplicate", request_id=rid, sequence=seq)
            return dict(
                result="conflict",
                request_id=rid,
                sequence=seq,
                destroyed=destroyed + self._destroy(),
            )
        if seq < self.sequence:
            self._revoke(message)
            return dict(result="stale", request_id=rid, sequence=seq, last_sequence=self.sequence)
        if seq != self.sequence + 1:
            return dict(
                result="gap",
                request_id=rid,
                sequence=seq,
                last_sequence=self.sequence,
                destroyed=destroyed + self._destroy(),
            )
        destroyed += self._revoke(message)
        self.sequence, self.meaning, self.last_signal = seq, meaning, now
        return dict(result="acknowledged", request_id=rid, sequence=seq, destroyed=destroyed)

    def _revoke(self, message):
        b, p = message.body, message.body["params"]
        return self._destroy(
            lambda s: (
                p["scope"] == "all"
                or p["scope"] == "station"
                and s.authority.station == b["station"]
                or p["scope"] == "actor"
                and s.authority.actor_id == b["actor"]["id"]
                or p["scope"] == "lease"
                and s.authority.lease_ref == p["lease_ref"]
                and s.authority.actor_id == b["actor"]["id"]
                and s.authority.station == b["station"]
            )
        )

    def _wire_stable(self, session):
        owner = session.wire_owner
        if getattr(self, "wire_owner", None) is not owner:
            return False
        if owner is None:
            return True
        from .lease_service import ClosedLeaseServices

        return (
            type(owner) is ClosedLeaseServices
            and owner.host is self
            and owner._identity is self
            and owner.answers is owner._answers_identity
            and owner.request_validator is owner._request_validator_identity
        )

    def _check(self, session, *, request=None):
        now = self.sweep()
        b = session.message.body
        lease = b["params"]["lease"]
        if (
            not self._wire_stable(session)
            or self.sessions.get(lease["lease_ref"]) is not session
            or lease["stream_id"] != self.stream
            or self.collector is not session.collector
            or self.current is not session.current
            or self.verifier is not session.verifier
        ):
            raise LeaseRejected("state", "lease_gone")
        if request is not None:
            _ = request.body  # immutable, verified by this instance below
            if not self.verifier.owns(request):
                raise LeaseRejected("state", "unverified")
            if (
                request.body["actor"]["id"] != session.authority.actor_id
                or request.body["station"] != session.authority.station
            ):
                raise LeaseRejected("binding", "actor_mismatch")
            if now >= aware(request.body["expires_at"]):
                raise LeaseRejected("time", "expired_or_future")
        current, collector, verifier = self.current, self.collector, self.verifier
        authority = current(session.message if request is None else request)
        if (
            self.current is not current
            or self.collector is not collector
            or self.verifier is not verifier
            or not authority_valid(authority)
            or authority != session.authority
            or authority.allowed is not True
            or authority.principal_kind not in ("arx_human", "ha_human")
            or authority.receiver is not session.authority.receiver
            or authority.generation is not session.authority.generation
        ):
            self._destroy(lambda s: s is session)
            raise LeaseRejected("state", "authority_changed")
        # The final clock callback is also an injected port. After it returns,
        # check ownership without invoking another callback (no check loop).
        clock = verifier.clock
        now = self.sweep()
        if (
            not self._wire_stable(session)
            or self.closed
            or self.current is not current
            or self.collector is not collector
            or self.verifier is not verifier
            or verifier.clock is not clock
        ):
            self._destroy(lambda s: s is session)
            raise LeaseRejected("state", "authority_changed")
        if request is not None and now >= aware(request.body["expires_at"]):
            raise LeaseRejected("time", "expired_or_future")
        if (
            self.sessions.get(lease["lease_ref"]) is not session
            or lease["stream_id"] != self.stream
        ):
            raise LeaseRejected("state", "lease_gone")
        return now

    def _operation(self, session, message):
        from uuid import uuid4

        active = [True]

        def check():
            if not active[0]:
                raise LeaseRejected("state", "operation_finished")
            self._check(session, request=message)

        operation = LeaseOperation(
            str(uuid4()),
            str(uuid4()),
            message.body["request_id"],
            session.authority.lease_ref,
            session.session_id,
            message.body["action"],
            check,
        )
        return operation, active

    async def start(self, message):
        from uuid import uuid4

        self.sweep()
        self._consume(message, {"capture_start"})
        b, lease = message.body, message.body["params"]["lease"]
        if (
            lease["stream_id"] != self.stream
            or lease["sequence_at_issue"] != self.sequence
            or self.permission_revision is not None
            and lease["permission_revision"] != self.permission_revision
        ):
            raise LeaseRejected("state", "stream_or_revision_changed")
        current, collector = self.current, self.collector
        authority = current(message)
        if self.current is not current or self.collector is not collector:
            raise LeaseRejected("binding", "receiver_changed")
        expected = (
            b["actor"]["id"],
            b["station"],
            lease["lease_ref"],
            lease["person_ref"],
            lease["person_revision"],
            lease["permission_revision"],
            lease["binding_revision"],
            lease["receiver"]["reader_id"],
        )
        if (
            not authority_valid(authority)
            or authority.allowed is not True
            or authority.receiver is None
            or authority.principal_kind not in ("arx_human", "ha_human")
            or tuple(
                getattr(authority, k)
                for k in (
                    "actor_id",
                    "station",
                    "lease_ref",
                    "person_ref",
                    "person_revision",
                    "permission_revision",
                    "binding_revision",
                    "reader_id",
                )
            )
            != expected
        ):
            raise LeaseRejected("binding", "admission_mismatch")
        if lease["lease_ref"] in self.sessions or any(
            s.authority.station == authority.station for s in self.sessions.values()
        ):
            raise LeaseRejected("state", "capture_station_busy")
        if len(self.sessions) >= 8:
            raise LeaseRejected("state", "capture_limit")
        session = CaptureSession(
            str(uuid4()),
            message,
            authority,
            collector,
            self.verifier,
            current,
            wire_owner=getattr(self, "wire_owner", None),
        )
        if self.permission_revision is None:
            self.permission_revision = lease["permission_revision"]
        self.sessions[lease["lease_ref"]] = session  # allocated and bound BEFORE first await
        operation, active = self._operation(session, message)
        try:
            self._check(session, request=message)

            async def create():
                marker = _lease_owners.set(_lease_owners.get() | {self._owner})
                token = _lease_step.set((self, session, operation, asyncio.current_task()))
                try:
                    operation.check()
                    resource = await collector.start(session)
                    object.__setattr__(session, "resource", resource)
                    if self.closed or self.sessions.get(lease["lease_ref"]) is not session:
                        self._retire(session)
                    return resource
                finally:
                    _lease_step.reset(token)
                    _lease_owners.reset(marker)

            creation = asyncio.create_task(create())
            self._starts.add(creation)
            try:
                await asyncio.shield(creation)
            except asyncio.CancelledError:
                self._destroy(lambda s: s is session)
                raise
            finally:
                joining = asyncio.gather(creation, return_exceptions=True)
                while not joining.done():
                    try:
                        await asyncio.shield(joining)
                    except asyncio.CancelledError:
                        pass
                self._starts.discard(creation)
            if self.collector is not collector or self.current is not current:
                raise LeaseRejected("binding", "receiver_changed")
            self._check(session, request=message)
            if session.resource is None:
                raise LeaseRejected("state", "capture_not_ready")
            object.__setattr__(session, "started", True)
            active[0] = False
            return session.session_id  # internal outcome; no invented wire state/person shape
        except BaseException:
            active[0] = False
            self._destroy(lambda s: s is session)
            self._retire(session)
            await self.cleanup()
            raise

    async def step(self, message):
        self._consume(message, REQUESTS - {"capture_start"})
        b, p = message.body, message.body["params"]
        action = b["action"]
        session = self.sessions.get(p["lease_ref"])
        if session is None:
            raise LeaseRejected("state", "capture_not_found")
        if session.session_id in self._busy:
            raise LeaseRejected(
                "state",
                "capture_applying" if action == "capture_cancel" else "capture_operation_busy",
            )
        if p["session_id"] == "*":
            if action == "capture_confirm":
                raise LeaseRejected("binding", "wildcard_confirm")
            self._check(session, request=message)
            self._destroy(lambda s: s is session)
            await self.cleanup()
            return None
        if p["session_id"] != session.session_id:
            raise LeaseRejected("binding", "session_mismatch")
        self._check(session, request=message)
        if action == "capture_cancel":
            self._destroy(lambda s: s is session)
            await self.cleanup()
            return None
        if not session.started:
            raise LeaseRejected("state", "capture_not_ready")
        if session.session_id in self._busy:
            raise LeaseRejected("state", "capture_operation_busy")
        self._busy.add(session.session_id)
        operation, active = self._operation(session, message)
        try:
            collector, current = self.collector, self.current
            preflight = getattr(collector, "preflight", None)
            if action == "capture_confirm" and preflight is not None:
                self._check(session, request=message)
                preflight(session, message.body["params"])
                self._check(session, request=message)

            async def run_effect():
                marker = _lease_owners.set(_lease_owners.get() | {self._owner})
                token = _lease_step.set((self, session, operation, asyncio.current_task()))
                try:
                    operation.check()
                    if action == "capture_confirm":
                        object.__setattr__(session, "possible_dispatch", True)
                    return await getattr(
                        collector, "confirm" if action == "capture_confirm" else "status"
                    )(session)
                finally:
                    _lease_step.reset(token)
                    _lease_owners.reset(marker)

            effect = asyncio.create_task(run_effect())
            self._effects.add(effect)
            try:
                result = await asyncio.shield(effect)
            except asyncio.CancelledError:
                self._destroy(lambda s: s is session)
                raise
            finally:
                joining = asyncio.gather(effect, return_exceptions=True)
                while not joining.done():
                    try:
                        await asyncio.shield(joining)
                    except asyncio.CancelledError:
                        pass
                self._effects.discard(effect)
            if self.collector is not collector or self.current is not current:
                raise LeaseRejected("binding", "receiver_changed")
            self._check(session, request=message)
            if action == "capture_confirm":
                self._destroy(lambda s: s is session)
                await self.cleanup()
            return result  # opaque internal result; never serialized by this experimental module
        except BaseException as error:
            possible = session.possible_dispatch
            if (
                not possible
                and type(error) is LeaseRejected
                and error.code
                in {
                    "capture_not_ready",
                    "invalid_text",
                    "capture_operation_busy",
                    "capture_applying",
                }
            ):
                raise
            self._destroy(lambda s: s is session)
            await self.cleanup()
            if possible:
                return "sent_unknown"
            raise
        finally:
            active[0] = False
            self._busy.discard(session.session_id)

    async def cleanup(self):
        import asyncio

        while self.retired:
            collector, resource = self.retired.pop(0)

            async def clean(owner, item):
                marker = _lease_owners.set(_lease_owners.get() | {self._owner})
                try:
                    await owner.close(item)
                finally:
                    _lease_owners.reset(marker)

            task = asyncio.create_task(clean(collector, resource))
            self._cleanup_tasks.add(task)
        tasks = tuple(self._cleanup_tasks)
        if tasks:
            joining = asyncio.gather(*tasks, return_exceptions=True)
            cancelled = False
            while not joining.done():
                try:
                    await asyncio.shield(joining)
                except asyncio.CancelledError:
                    cancelled = True
            for outcome in joining.result():
                if isinstance(outcome, BaseException):
                    self.cleanup_failures.append(type(outcome).__name__)
            self._cleanup_tasks.difference_update(tasks)
            if cancelled:
                raise asyncio.CancelledError()

    async def close(self):
        import asyncio

        self.closed = True
        self._destroy()
        if self._closing is None:
            self._closing = asyncio.create_task(self._join())
        current = asyncio.current_task()
        if (
            self._owner in _lease_owners.get()
            or current in self._starts
            or current in self._effects
            or current in self._cleanup_tasks
        ):
            return
        cancelled = False
        while not self._closing.done():
            try:
                await asyncio.shield(self._closing)
            except asyncio.CancelledError:
                cancelled = True
        self._closing.result()
        if cancelled:
            raise asyncio.CancelledError()

    async def _join(self):
        import asyncio

        tasks = tuple(self._starts | self._effects)
        if tasks:
            await asyncio.gather(*tasks, return_exceptions=True)
        self._destroy()
        await self.cleanup()


def _plain(value):
    if hasattr(value, "items"):
        return {k: _plain(v) for k, v in value.items()}
    if type(value) is tuple:
        return [_plain(v) for v in value]
    return value
