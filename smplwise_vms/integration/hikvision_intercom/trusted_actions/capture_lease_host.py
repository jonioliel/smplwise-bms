"""Keyless capture host behind explicit, trusted in-process source ports.

This is the WisKey composition API used by the original bridge source adapter.
Only a bound bridge may supply owns_dto/project_dto/source_current; ownership
means its immutable DTO passed bridge stages 1–7. No wire JSON, signature or
signing key enters this module. A production factory must remain unavailable
until the actual bridge CODE/type/capability lifecycle can bind these ports.
"""

from __future__ import annotations

import asyncio
import hashlib
import inspect
import json
import unicodedata
from contextvars import Context, ContextVar
from dataclasses import dataclass
from datetime import timedelta
from pathlib import Path
from types import MappingProxyType
from weakref import WeakKeyDictionary
from weakref import ref as weakref_ref

from .envelope import ClockSample, freeze
from .lease_answers import LeaseAnswers, _validator
from .lease_experimental import (
    EVENTS,
    REQUESTS,
    ExperimentalLeaseHost,
    LeaseRejected,
    _lease_owners,
    authority_valid,
    uuid4_value,
)
from .lease_service import ClosedLeaseServices
from .source_bindings import same_ports
from .validation import Refusal, aware

_SCHEMA_SHA256 = "7934baea878112ea12051d6d7de0429b8f80a6e11ecf878caf41e53112aceb3c"
# Native DTO v1 exposes this digest only. The trusted source projection also
# supplies the fixed protocol from its capability, never a second digest.
_METADATA = {"body_sha256"}
_HOST_OWNERS = WeakKeyDictionary()
_HOST_ADMISSIONS = WeakKeyDictionary()
_HOST_SIGNAL_GENERATIONS = WeakKeyDictionary()
_HOST_CLOSINGS = WeakKeyDictionary()
_LIVE_CLEANUP = ContextVar("wiskey_keyless_live_cleanup", default=None)


def _same_ports(actual, expected):
    return (
        type(actual) is tuple
        and type(expected) is tuple
        and len(actual) == len(expected)
        and all(a is b for a, b in zip(actual, expected, strict=True))
    )


def _schema():
    raw = (Path(__file__).parent / "resources/CAPTURE_LEASE.v1.schema.json").read_bytes()
    if hashlib.sha256(raw).hexdigest() != _SCHEMA_SHA256:
        raise ValueError("capture lease schema binding changed")
    return json.loads(raw)


def _immutable_plain(value, depth=0):
    """Accept only a closed immutable JSON tree from the trusted projection."""
    if depth > 32:
        raise LeaseRejected("schema", "bad_value")
    if type(value) is MappingProxyType:
        if any(type(key) is not str for key in value):
            raise LeaseRejected("schema", "wrong_type")
        return {key: _immutable_plain(item, depth + 1) for key, item in value.items()}
    if type(value) is tuple:
        return [_immutable_plain(item, depth + 1) for item in value]
    if value is None or type(value) in (str, int, bool):
        if type(value) is str and any(unicodedata.category(c) in {"Cc", "Cf", "Cs"} for c in value):
            raise LeaseRejected("schema", "bad_format")
        return value
    raise LeaseRejected("schema", "wrong_type")


@dataclass(frozen=True, repr=False)
class _SourceMessage:
    """Owned host snapshot; never represented as an Arx DTO or a verified wire."""

    body: object
    dto: object
    seal: object


@dataclass(frozen=True, repr=False)
class CaptureRequestContext:
    """Previously admitted metadata for runtime publication checks; no authority."""

    action: str
    request_id: str
    lease_ref: str | None


@dataclass(frozen=True, repr=False)
class _ActiveCleanup:
    host: object
    parent: object
    active: list


@dataclass(frozen=True, repr=False)
class _CollectorBinding:
    start: object
    status: object
    confirm: object
    discard: object
    close: object
    preflight: object


@dataclass(frozen=True, repr=False)
class _HostOwner:
    source: object
    source_ports: tuple
    source_seal: object
    validator: object
    replay_keys: set
    admitted: dict
    answers: object
    authority_ports: tuple
    current: object
    collector_input: object
    collector_binding: object
    collector_methods: tuple
    sessions: dict
    births: dict
    installation_id: str | None
    lifecycle_owner: object
    starts: set
    effects: set
    cleanup_tasks: set
    signal_generation: list
    retired: list
    retired_ids: set
    resources: list
    cleanup_failures: list
    closing: list


class _KeylessSource:
    def __init__(self, host, owns_dto, project_dto, source_current, clock, definition):
        self.host = host
        self.owns_dto, self.project_dto = owns_dto, project_dto
        self.source_current, self.clock = source_current, clock
        self._ports = (owns_dto, project_dto, source_current, clock)
        self._seal = object()
        self.last_now = None
        self.replay = None  # Existing event state machine owns stream retention.
        self.seen = set()
        self.admitted = {}
        definition = json.loads(json.dumps(definition))
        definition["required"] = [key for key in definition["required"] if key not in {"ts", "sig"}]
        for key in ("ts", "sig"):
            del definition["properties"][key]
        for key in _METADATA:
            definition["required"].append(key)
            definition["properties"][key] = {"type": "string", "pattern": "^[0-9a-f]{64}$"}
        self.validator = _validator(definition)

    def current(self):
        if not self.host._roots_current() or not self.host._ports_current():
            return False
        if not _same_ports(
            (self.owns_dto, self.project_dto, self.source_current, self.clock), self._ports
        ):
            return False
        try:
            return (
                self.source_current() is True
                and _same_ports(
                    (self.owns_dto, self.project_dto, self.source_current, self.clock), self._ports
                )
                and self.host._roots_current()
                and self.host._ports_current()
            )
        except Exception:
            return False

    def owns(self, message):
        if (
            type(message) is not _SourceMessage
            or message.seal is not self._seal
            or not self.current()
        ):
            return False
        try:
            return self.owns_dto(message.dto) is True and self.current()
        except Exception:
            return False

    def sample(self):
        try:
            if not self.current():
                raise Refusal()
            value = self.clock()
            if type(value) is not ClockSample:
                raise Refusal()
            value.check()
            if not self.current() or self.last_now is not None and value.now < self.last_now:
                raise Refusal()
        except Exception:
            raise LeaseRejected("time", "clock_invalid") from None
        self.last_now = value.now
        return value.now

    def project(self, dto):
        try:
            if not self.current() or self.owns_dto(dto) is not True:
                raise LeaseRejected("state", "unverified")
            projected = self.project_dto(dto)
            if not self.current() or self.owns_dto(dto) is not True:
                raise LeaseRejected("state", "unverified")
        except LeaseRejected:
            self.host._destroy()
            raise
        except Exception:
            self.host._destroy()
            raise LeaseRejected("state", "unverified") from None
        body = _immutable_plain(projected)
        if type(body) is not dict:
            raise LeaseRejected("schema", "wrong_type")
        error = next(self.validator.iter_errors(body), None)
        if error is not None:
            code = {
                "type": "wrong_type",
                "required": "missing_field",
                "additionalProperties": "unknown_field",
                "pattern": "bad_format",
            }.get(error.validator, "bad_value")
            raise LeaseRejected("schema", code)
        uuid4_value(body["request_id"])
        message = _SourceMessage(freeze(body), dto, self._seal)
        try:
            issued, expires = aware(body["issued_at"]), aware(body["expires_at"])
            now = self.sample()
            if not timedelta(0) < expires - issued <= timedelta(seconds=15):
                raise LeaseRejected("time", "lifetime_invalid")
            if now < issued:
                raise LeaseRejected("time", "not_yet_valid")
            if now >= expires:
                raise LeaseRejected("time", "expired")
            action, params = body["action"], body["params"]
            star = action in {"lease_heartbeat", "lease_stream_reset"} or (
                action == "lease_revoke" and params["scope"] == "all"
            )
            if (body["station"] == "*") != star:
                raise LeaseRejected("binding", "station_scope_mismatch")
            if action == "capture_start":
                lease = params["lease"]
                start, end = aware(lease["lease_issued_at"]), aware(lease["lease_expires_at"])
                if not timedelta(0) < end - start <= timedelta(seconds=120):
                    raise LeaseRejected("schema", "bad_value")
                if not start <= issued < end:
                    raise LeaseRejected("binding", "lease_window")
            if not self.owns(message):
                raise LeaseRejected("state", "unverified")
            keys = (("request", body["request_id"]), ("nonce", body["nonce"]))
            if any(key in self.seen for key in keys):
                raise LeaseRejected("state", "replay")
            if len(self.seen) + 2 > 8192:
                raise LeaseRejected("state", "storage_unavailable")
            self.seen.update(keys)
            params = body["params"]
            ref = (
                params["lease"]["lease_ref"]
                if action == "capture_start"
                else params.get("lease_ref")
            )
            self.admitted[id(dto)] = (
                dto,
                message,
                CaptureRequestContext(action, body["request_id"], ref),
            )
        except Refusal:
            raise LeaseRejected("schema", "bad_format") from None
        except LeaseRejected as rejected:
            if rejected.stage != "schema":
                rejected.request_id = body["request_id"]
            raise
        return message


class CaptureLeaseHost(ExperimentalLeaseHost):
    """Keyless native host; trusted source, actor and collector ports are required.

    `current(message)` returns the existing LeaseAuthority using fresh native
    receiver/generation/person/permission state. `actor_current(original_dto,
    authority)` separately proves the current human identity from a trusted
    source. The principal_kind string is never sufficient evidence by itself.
    Registration/capability binding is owned by capture_bridge_source.py;
    caller-supplied actor/collector ports still need their original sources.
    """

    def __init__(
        self,
        *,
        installation_id,
        owns_dto,
        project_dto,
        source_current,
        current,
        actor_current,
        collector,
        clock,
        installation_actor_current=None,
    ):
        ports = (owns_dto, project_dto, source_current, current, actor_current, clock)
        if not all(callable(port) for port in ports) or collector is None:
            raise ValueError("explicit trusted capture source ports required")
        if not (
            type(installation_id) is str and installation_id
            or installation_id is None and callable(installation_actor_current)
        ):
            raise ValueError("explicit installation identity required")
        if not all(
            callable(getattr(collector, name, None))
            for name in ("start", "status", "confirm", "discard", "close")
        ):
            raise ValueError("explicit native capture collector required")
        definition = _schema()
        self.answers = LeaseAnswers(definition)
        self._answers = self.answers
        self._current_port, self.actor_current = current, actor_current
        self.installation_actor_current = installation_actor_current
        self._authority_ports = (current, actor_current, installation_actor_current)
        self.installation_id = installation_id
        self._collector_input = collector
        self._collector_owner = collector
        self._collector_methods = tuple(
            getattr(collector, name, None)
            for name in (
                "start",
                "status",
                "confirm",
                "discard",
                "close",
                "preflight",
            )
        )
        self.collector = _CollectorBinding(*self._collector_methods)
        self._collector_binding = self.collector
        self.verifier = _KeylessSource(
            self, owns_dto, project_dto, source_current, clock, definition
        )
        self._source = self.verifier
        self.current = self._authority
        self._current = self.current
        self.stream, self.sequence, self.meaning = None, 0, None
        self._streams, self._consumed = set(), set()
        self.last_signal, self.permission_revision = None, None
        self.sessions, self.retired, self.closed = {}, [], False
        self._sessions, self._births = self.sessions, {}
        self._owner = object()
        self._retired_ids, self._resource_history = set(), []
        self._cleanup_tasks, self._starts, self._effects = set(), set(), set()
        self._closing = None
        self.cleanup_failures, self._busy = [], set()
        self.wire_owner = self
        self._creation = _HostOwner(
            self._source,
            self._source._ports,
            self._source._seal,
            self._source.validator,
            self._source.seen,
            self._source.admitted,
            self.answers,
            self._authority_ports,
            self.current,
            collector,
            self.collector,
            self._collector_methods,
            self.sessions,
            self._births,
            installation_id,
            self._owner,
            self._starts,
            self._effects,
            self._cleanup_tasks,
            [0],
            self.retired,
            self._retired_ids,
            self._resource_history,
            self.cleanup_failures,
            [None],
        )
        _HOST_OWNERS[self] = self._creation
        _HOST_ADMISSIONS[self] = self._source.admitted
        _HOST_SIGNAL_GENERATIONS[self] = self._creation.signal_generation

    def _authority(self, message):
        if not self._wire_stable(None) or not self.verifier.owns(message):
            self.invalidate()
            raise LeaseRejected("binding", "admission_mismatch")
        try:
            authority = self._current_port(message)
            valid = (
                authority_valid(authority)
                and authority.binding_revision is None
                and self.actor_current(message.dto, authority) is True
                and self._wire_stable(None)
                and self.verifier.owns(message)
            )
        except Exception:
            self._destroy()
            raise LeaseRejected("state", "authority_changed") from None
        if not valid:
            self._destroy()
            raise LeaseRejected("binding", "admission_mismatch")
        return authority

    def _ports_current(self):
        owner = _HOST_OWNERS.get(self)
        if owner is None:
            return False
        try:
            return (
                self.collector is owner.collector_binding
                and self._collector_binding is owner.collector_binding
                and self._collector_input is owner.collector_input
                and self._collector_owner is owner.collector_input
                and same_ports(
                    owner.collector_methods,
                    tuple(
                        getattr(owner.collector_binding, name, None)
                        for name in (
                            "start",
                            "status",
                            "confirm",
                            "discard",
                            "close",
                            "preflight",
                        )
                    ),
                )
                and same_ports(
                    owner.collector_methods,
                    tuple(
                        getattr(owner.collector_input, name, None)
                        for name in (
                            "start",
                            "status",
                            "confirm",
                            "discard",
                            "close",
                            "preflight",
                        )
                    ),
                )
            )
        except Exception:
            return False

    def _roots_current(self):
        owner = _HOST_OWNERS.get(self)
        if owner is None or self._creation is not owner:
            return False
        source = owner.source
        return (
            self.verifier is source
            and self._source is source
            and source.host is self
            and _same_ports(source._ports, owner.source_ports)
            and _same_ports(
                (source.owns_dto, source.project_dto, source.source_current, source.clock),
                owner.source_ports,
            )
            and source._seal is owner.source_seal
            and source.validator is owner.validator
            and source.seen is owner.replay_keys
            and source.admitted is owner.admitted
            and self.answers is owner.answers
            and self._answers is owner.answers
            and self.current is owner.current
            and self._current is owner.current
            and _same_ports(self._authority_ports, owner.authority_ports)
            and _same_ports(
                (self._current_port, self.actor_current, self.installation_actor_current),
                owner.authority_ports,
            )
            and self.sessions is owner.sessions
            and self._sessions is owner.sessions
            and self._births is owner.births
            and self._owner is owner.lifecycle_owner
            and self._starts is owner.starts
            and self._effects is owner.effects
            and self._cleanup_tasks is owner.cleanup_tasks
            and self.retired is owner.retired
            and self._retired_ids is owner.retired_ids
            and self._resource_history is owner.resources
            and self.cleanup_failures is owner.cleanup_failures
            and self._closing is owner.closing[0]
            and self.wire_owner is self
            and (type(self.installation_id) is str or self.installation_id is None
                 and callable(self.installation_actor_current))
            and self.installation_id == owner.installation_id
        )

    def _wire_stable(self, session):
        return self._roots_current() and self._source.current()

    def check_binding(self):
        """Check source/port ownership; grants no actor or capture authority."""
        if self.closed or not self._wire_stable(None):
            self.invalidate()
            raise LeaseRejected("state", "unverified")

    def owns_current_lifecycle(self):
        """Original Tasks and descendants of a live original cleanup scope only."""
        owner = _HOST_OWNERS.get(self)
        if owner is None:
            return False
        try:
            task = asyncio.current_task()
        except RuntimeError:
            return False
        if task in owner.starts or task in owner.effects or task in owner.cleanup_tasks:
            return True
        scope = _LIVE_CLEANUP.get()
        return (
            type(scope) is _ActiveCleanup
            and scope.host() is self
            and scope.active[0] is True
            and scope.parent() in owner.cleanup_tasks
        )

    def _operation(self, session, message):
        owner = _HOST_OWNERS.get(self)
        if owner is None:
            raise LeaseRejected("state", "unverified")
        owner.births[id(session)] = session
        return super()._operation(session, message)

    def _consume(self, message, actions):
        super()._consume(message, actions)
        if message.body["action"] in REQUESTS - {"capture_start"}:
            session = self._sessions.get(message.body["params"]["lease_ref"])
            if session is not None:
                # A busy request still needs fresh authority to keep a card.
                self._check(session, request=message)

    def _retire(self, session):
        owner = _HOST_OWNERS.get(self)
        if owner is None or owner.births.get(id(session)) is not session:
            return
        resource = session.resource
        if resource is None or id(resource) in owner.retired_ids:
            return
        owner.retired_ids.add(id(resource))
        owner.resources.append(resource)
        try:
            result = owner.collector_methods[3](resource)
            if inspect.isawaitable(result):
                if inspect.iscoroutine(result):
                    result.close()
                raise TypeError("synchronous discard required")
        except Exception as error:
            owner.cleanup_failures.append(type(error).__name__)
        owner.retired.append((owner.collector_methods[4], resource))

    def _destroy(self, predicate=lambda session: True):
        destroyed = 0
        owner = _HOST_OWNERS.get(self)
        if owner is None:
            return 0
        for ref, session in tuple(owner.sessions.items()):
            if owner.births.get(id(session)) is not session or not predicate(session):
                continue
            if owner.sessions.get(ref) is session:
                owner.sessions.pop(ref)
                self._retire(session)
                destroyed += 1
        return destroyed

    def invalidate(self, lease_refs=None):
        """Synchronously discard owned sessions; timer/reload cleanup, no authority."""
        if lease_refs is None:
            return self._destroy()
        refs = frozenset(lease_refs)
        if any(type(ref) is not str for ref in refs):
            raise ValueError("lease references must be strings")
        return self._destroy(lambda session: session.authority.lease_ref in refs)

    def request_context(self, dto):
        """Read exact original DTO admission metadata without invoking a source port."""
        admitted = _HOST_ADMISSIONS.get(self)
        record = None if admitted is None else admitted.get(id(dto))
        if record is None or record[0] is not dto:
            raise LeaseRejected("state", "unverified")
        return record[2]

    @property
    def signal_generation(self):
        state = _HOST_SIGNAL_GENERATIONS.get(self)
        return 0 if state is None else state[0]

    def event(self, message):
        answer = super().event(message)
        action, result = message.body["action"], answer["result"]
        accepted_signal = (
            action == "lease_revoke"
            and result in {"acknowledged", "duplicate"}
            or action == "lease_stream_reset"
            and result == "acknowledged"
            or action == "lease_heartbeat"
            and result == "acknowledged"
        )
        if accepted_signal:
            self.check_binding()
            # A verified duplicate retry is still a signal from Arx. The
            # original lease deadline remains in its immutable start message.
            self.last_signal = self._source.last_now
            _HOST_OWNERS[self].signal_generation[0] += 1
        return answer

    def _installation_actor(self, message):
        if self.installation_actor_current is None:
            return super()._installation_actor(message)
        self.check_binding()
        if not self.verifier.owns(message):
            raise LeaseRejected("state", "unverified")
        result = self.installation_actor_current(message.dto)
        self.check_binding()
        return result is True and self.verifier.owns(message)

    async def close(self):
        self.closed = True
        self._destroy()
        owner = _HOST_OWNERS.get(self)
        stored = _HOST_CLOSINGS.get(self)
        closing = None if stored is None else stored()
        if closing is None:
            if owner is None:
                return
            closing = asyncio.create_task(self._join(), context=Context())
            owner.closing[0] = self._closing = closing
            _HOST_CLOSINGS[self] = weakref_ref(closing)
            closing.add_done_callback(lambda _: _HOST_OWNERS.pop(self, None), context=Context())
        if self.owns_current_lifecycle():
            return
        cancelled = False
        while not closing.done():
            try:
                await asyncio.shield(closing)
            except asyncio.CancelledError:
                cancelled = True
        closing.result()
        if cancelled:
            raise asyncio.CancelledError()

    async def cleanup(self):
        owner = _HOST_OWNERS.get(self)
        if owner is None or asyncio.current_task() in owner.cleanup_tasks:
            return
        cancelled = False
        while owner.retired or owner.cleanup_tasks:
            while owner.retired:
                original_close, resource = owner.retired.pop(0)

                async def clean(callback, item):
                    current = asyncio.current_task()
                    owner.cleanup_tasks.add(current)
                    scope = _ActiveCleanup(weakref_ref(self), weakref_ref(current), [True])
                    scope_marker = _LIVE_CLEANUP.set(scope)
                    marker = _lease_owners.set(_lease_owners.get() | {owner.lifecycle_owner})
                    try:
                        await callback(item)
                    finally:
                        scope.active[0] = False
                        _LIVE_CLEANUP.reset(scope_marker)
                        _lease_owners.reset(marker)

                task = asyncio.create_task(clean(original_close, resource), context=Context())
                owner.cleanup_tasks.add(task)
            tasks = tuple(owner.cleanup_tasks)
            joining = asyncio.gather(*tasks, return_exceptions=True)
            while not joining.done():
                try:
                    await asyncio.shield(joining)
                except asyncio.CancelledError:
                    cancelled = True
            for result in joining.result():
                if isinstance(result, BaseException):
                    owner.cleanup_failures.append(type(result).__name__)
            owner.cleanup_tasks.difference_update(tasks)
        if cancelled:
            raise asyncio.CancelledError()

    async def _join(self):
        owner = _HOST_OWNERS.get(self)
        if owner is None:
            return
        tasks = tuple(owner.starts | owner.effects)
        if tasks:
            await asyncio.gather(*tasks, return_exceptions=True)
        self._destroy()
        await self.cleanup()

    @staticmethod
    def _lease_ref(message):
        params = message.body["params"]
        return params.get("lease_ref", params.get("lease", {}).get("lease_ref"))

    async def _request(self, message):
        body, action = message.body, message.body["action"]
        rid = body["request_id"]
        ref = self._lease_ref(message)
        owner = _HOST_OWNERS.get(self)
        admitted_session = None if owner is None else owner.sessions.get(ref)
        try:
            if action == "capture_start":
                if body["params"]["lease"]["binding_revision"] is not None:
                    raise LeaseRejected("binding", "admission_mismatch")
                sid = await self.start(message)
                answer = {
                    "result": "acknowledged",
                    "request_id": rid,
                    "session": {"session_id": sid, "state": "preparing"},
                }
            else:
                value = await self.step(message)
                if action == "capture_cancel":
                    answer = {"result": "acknowledged", "request_id": rid, "cancelled": True}
                elif action == "capture_status":
                    answer = (
                        {"result": "refused", "request_id": rid, "code": "capture_not_found"}
                        if body["params"]["session_id"] == "*"
                        else {"result": "acknowledged", "request_id": rid, "capture": value}
                    )
                elif type(value) is str and value == "sent_unknown":
                    answer = {"result": "sent_unknown", "request_id": rid}
                else:
                    answer = {"result": "acknowledged", "request_id": rid, "person": value}
            try:
                return self.answers.validate(action, answer)
            except LeaseRejected:
                if action == "capture_confirm":
                    return self.answers.validate(
                        action, {"result": "sent_unknown", "request_id": rid}
                    )
                self.invalidate((ref,))
                await self.cleanup()
                return self.answers.validate(
                    action,
                    {
                        "result": "refused",
                        "request_id": rid,
                        "code": "capture_failed" if action == "capture_start" else "lease_gone",
                    },
                )
        except LeaseRejected as error:
            mapping = {
                "unverified": "binding_denied",
                "operation_missing": "binding_denied",
                "operation_finished": "binding_denied",
                "admission_mismatch": "binding_denied",
                "actor_mismatch": "binding_denied",
                "session_mismatch": "binding_denied",
                "wildcard_confirm": "binding_denied",
                "stream_or_revision_changed": "lease_gone",
                "authority_changed": "lease_gone",
                "receiver_changed": "lease_gone",
            }
            code = mapping.get(error.code, error.code)
            if code in self.answers.codes["refused"][action]:
                if (
                    action == "capture_start"
                    or code not in self.answers.codes["refused_liveness"]["session_unchanged"]
                ):
                    self._destroy(lambda session: session.authority.lease_ref == ref)
                    await self.cleanup()
                return self.answers.validate(
                    action,
                    {
                        "result": "refused",
                        "request_id": rid,
                        "code": code,
                    },
                )
            return self.answers.validate(action, ClosedLeaseServices._rejected(error, rid))
        except Exception:
            possible = action == "capture_confirm" and any(
                session.possible_dispatch
                for session in self.sessions.values()
                if session.authority.lease_ref == ref
            )
            possible = possible or (
                action == "capture_confirm"
                and admitted_session is not None
                and admitted_session.possible_dispatch
            )
            self._destroy(lambda session: session.authority.lease_ref == ref)
            await self.cleanup()
            answer = (
                {"result": "sent_unknown", "request_id": rid}
                if possible
                else {
                    "result": "refused",
                    "request_id": rid,
                    "code": "capture_failed" if action == "capture_start" else "lease_gone",
                }
            )
            return self.answers.validate(action, answer)

    async def handle(self, dto):
        """Consume one bridge-owned DTO; unowned input raises without echoing IDs."""
        try:
            message = self.verifier.project(dto)
        except LeaseRejected as error:
            if error.code == "unverified":
                raise
            return self.answers.validate("capture_start", ClosedLeaseServices._rejected(error))
        action = message.body["action"]
        if self.closed or not self._wire_stable(None):
            self._destroy()
            raise LeaseRejected("state", "unverified")
        if action in REQUESTS:
            return await self._request(message)
        if action not in EVENTS:
            raise LeaseRejected("schema", "bad_value")
        try:
            answer = self.event(message)
        except LeaseRejected as error:
            answer = ClosedLeaseServices._rejected(error, message.body["request_id"])
        except Exception:
            self.invalidate()
            answer = {
                "result": "rejected",
                "stage": "state",
                "code": "storage_unavailable",
                "request_id": message.body["request_id"],
            }
        return self.answers.validate("lease_event", answer)
