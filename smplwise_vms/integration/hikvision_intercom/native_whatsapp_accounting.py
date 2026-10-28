"""Optional original native send accounting; never sender or Arx authority.

Production borrows HostPacingPort's original worker/global fallback bucket. An
explicit standalone ledger port is available for a trusted, already verified
SenderMappingPort; this module never infers physical identity from Graph/HA IDs.
No recipient, message, token, PIN or provider response body enters this module.
"""

from __future__ import annotations

import asyncio
import json
import threading
import weakref
from contextlib import asynccontextmanager
from contextvars import ContextVar
from dataclasses import dataclass, field
from types import MethodType

from .trusted_actions.adapters import EngineContext
from .trusted_actions.validation import Refusal
from .whatsapp_pacing_ledger import AttemptOutcome, PacingLedger, SenderMappingPort
from .whatsapp_pacing_outcomes import pacing_refusal_metadata

_LEDGERS = weakref.WeakKeyDictionary()
_OWNERS = weakref.WeakKeyDictionary()
_TICKETS = weakref.WeakKeyDictionary()
_QUEUED = weakref.WeakKeyDictionary()
_ACTIVE_QUEUED = ContextVar("wiskey_native_single_owner_queue", default=None)


class NativeQueuedPreparation:
    """Opaque original preparation; construction alone grants nothing."""

    __slots__ = ("__weakref__",)


@dataclass(repr=False)
class _Queued:
    queue: object
    owner: object
    value: dict
    composition: object
    roots: tuple
    ports: tuple
    context: object
    identity: tuple
    binding: object
    port: object
    sender: object
    preview: object
    source: object
    expires: object
    task: object
    prepared: object = None
    running: bool = False
    attached: object = None
    receipt: object = None
    returned: bool = False
    consumed: bool = False


def _native_queue_ports(roots):
    """Known original library methods plus original borrowed resource roots."""
    from .trusted_actions.messaging import OpaqueMessaging
    from .trusted_actions.native_template_messaging import NativeTemplateMessaging
    from .trusted_actions.owned_resources import OwnedResources
    from .trusted_actions.sensitive import SensitiveReferences
    from .trusted_actions.source_message_frames import SourceMessageFrames

    producer, frames, messaging = roots
    if (
        type(producer) is not NativeTemplateMessaging
        or type(frames) is not SourceMessageFrames
        or type(messaging) is not OpaqueMessaging
        or frames.cache is not producer.cache
        or messaging.source_frames is not frames
    ):
        raise Refusal("binding_denied")
    checks = (
        (frames.preparer, producer, NativeTemplateMessaging.prepare),
        (frames.sender, producer, NativeTemplateMessaging.send),
        (messaging.prepare_preview, frames, SourceMessageFrames.prepare),
        (messaging.send_source, frames, SourceMessageFrames.send),
        (messaging.references.receivers.get("whatsapp/send"), messaging, OpaqueMessaging._receive),
        (
            messaging.references.receivers.get("whatsapp/preview"),
            messaging,
            OpaqueMessaging._receive,
        ),
        (messaging.references.transfer, messaging.references, SensitiveReferences.transfer),
        (messaging.references._check, messaging.references, SensitiveReferences._check),
        (messaging.references._integrity, messaging.references, SensitiveReferences._integrity),
        (messaging.references.discard, messaging.references, SensitiveReferences.discard),
        (messaging.resources.run, messaging.resources, OwnedResources.run),
        (messaging.resources._check_owner, messaging.resources, OwnedResources._check_owner),
        (frames._check, frames, SourceMessageFrames._check),
        (frames._check_owner, frames, SourceMessageFrames._check_owner),
        (frames._item, frames, SourceMessageFrames._item),
        (frames.discard, frames, SourceMessageFrames.discard),
    )
    if any(
        type(port) is not MethodType or port.__self__ is not owner or port.__func__ is not function
        for port, owner, function in checks
    ):
        raise Refusal("binding_denied")
    SourceMessageFrames._check_owner(frames)
    return (
        # Class lookup makes a fresh bound method; check its exact instance and
        # pin the original function instead of that temporary wrapper object.
        *(port.__func__ for port, _, _ in checks),
        frames._bound,
        frames._creation_identity,
        frames._creation_maps,
        frames.clock,
        messaging.resources,
        messaging._resource_owner,
        messaging.resources._creation,
        messaging.references,
        messaging._reference_owner,
        messaging.references._identity,
        messaging.references._creation_maps,
        messaging.fresh_consent,
        messaging.claim_queue,
        messaging._creation_maps,
    )


def _same_queue_pacing(owner, port, sender):
    """Exact original direct or Host port; no SQL/current-allow cache."""
    from .whatsapp_pacing_runtime import HostPacingPort, native_queue_sender

    if type(port) is NativeLedgerPacingPort:
        original = NativeLedgerPacingPort.check(port)
        return owner.configuration[0] is original.ledger and sender is original.sender
    if type(port) is HostPacingPort:
        return owner.configuration[0] is port and sender is native_queue_sender(port)
    return False


def prepare_native_queued_send(value, composition, context, *, issued_at, expires_at):
    """Bind a real private preview on its original queue preparation Task.

    This composition borrows the original direct ledger or typed Host worker.
    It never manufactures consent, sender identity or a private payload.
    """
    from .trusted_actions.native_template_messaging import (
        _COMPOSITIONS,
        NativeTemplateMessaging,
        TemplateMessagingComposition,
    )
    from .trusted_actions.validation import aware
    from .whatsapp_pacing_queue import native_preparation_owner
    from .whatsapp_pacing_queue_store import encoded, job
    from .whatsapp_pacing_reservations import utc

    queue, owner, sender = native_preparation_owner(value)
    if type(composition) is not TemplateMessagingComposition:
        raise Refusal("binding_denied")
    roots = _COMPOSITIONS.get(composition)
    if roots is None:
        raise Refusal("binding_denied")
    producer, frames, messaging = roots
    NativeTemplateMessaging._stable(producer)
    binding = producer.accounting
    native_owner = NativeWhatsAppAccounting.check(binding)
    if type(context) is not EngineContext or not _same_queue_pacing(
        owner, native_owner.port, sender
    ):
        raise Refusal("binding_denied")
    identity = EngineContext._check_identity(context)
    if identity[2] is None:
        raise Refusal("binding_denied")
    issued, expires = utc(issued_at), utc(expires_at)
    request = identity[0]
    preview = messaging._creation_maps[0].get(context.parameters.get("preview_reference"))
    if (
        value["message_class"] != "code"
        or request.get("action") != "whatsapp/send"
        or request.get("request_id") != value["request_id"]
        or request.get("operation_id") != value["action_identity"]
        or context.parameters.get("confirmed") is not True
        or preview is None
        or frames._creation_maps[1].get(context.parameters["preview_reference"])
        is not preview.source
        or expires > aware(request.get("request_expires_at"))
        or not 0 < (expires - issued).total_seconds() <= 15
    ):
        raise Refusal("binding_denied")
    token = NativeQueuedPreparation()
    _QUEUED[token] = _Queued(
        queue,
        owner,
        json.loads(encoded(job(value))),
        composition,
        roots,
        _native_queue_ports(roots),
        context,
        identity,
        binding,
        native_owner.port,
        sender,
        preview,
        preview.source,
        expires,
        asyncio.current_task(),
    )
    owner.native_prepared = token
    check_native_queued_preparation(token)
    return token


def _queued(token, *, cleanup=False, guard_only=False):
    from .whatsapp_pacing_queue import check_native_queue_owner

    record = _QUEUED.get(token) if type(token) is NativeQueuedPreparation else None
    if record is None or (not guard_only and record.task is not asyncio.current_task()):
        raise Refusal("binding_denied")
    check_native_queue_owner(
        record.queue, record.owner, token, record.value, cleanup=cleanup, guard_only=guard_only
    )
    return record


def check_native_queued_preparation(token):
    from .trusted_actions.native_template_messaging import _COMPOSITIONS, NativeTemplateMessaging
    from .whatsapp_pacing_queue import _now
    from .whatsapp_pacing_queue_store import instant

    # Existing OwnedResources checks this guard in its joined admission child.
    # Freshness is not dispatch authority: issuance/send/completion below still
    # require the exact original queue Task and private SourceMessageFrames.
    record = _queued(token, guard_only=True)
    producer, frames, messaging = record.roots
    if (
        _COMPOSITIONS.get(record.composition) is not record.roots
        or record.composition._original is not record.roots
        or any(
            a is not b
            for a, b in zip(
                record.roots,
                (
                    record.composition.producer,
                    record.composition.frames,
                    record.composition.messaging,
                ),
                strict=True,
            )
        )
        or producer.accounting is not record.binding
        or NativeWhatsAppAccounting.check(record.binding).port is not record.port
        or not _same_queue_pacing(record.owner, record.port, record.sender)
        or EngineContext._check_identity(record.context) is not record.identity
        or any(
            a is not b for a, b in zip(record.ports, _native_queue_ports(record.roots), strict=True)
        )
        or instant(record.expires) <= _now(record.owner.configuration[1])
        or (
            not record.running
            and messaging._creation_maps[0].get(record.context.parameters["preview_reference"])
            is not record.preview
        )
    ):
        raise Refusal("binding_denied")
    NativeTemplateMessaging._stable(producer)
    EngineContext.check(record.context)


def bind_native_queued_preparation(token, prepared):
    from .whatsapp_pacing_queue import _PREPARED, PreparedQueuedSend

    record = _queued(token)
    if (
        type(prepared) is not PreparedQueuedSend
        or _PREPARED[prepared].native is not token
        or record.prepared is not None
    ):
        raise Refusal("binding_denied")
    record.prepared = weakref.ref(prepared)


async def send_native_queued_preparation(token, before_io):
    from .trusted_actions.messaging import OpaqueMessaging
    from .whatsapp_pacing_queue import _PREPARED

    record = _queued(token)
    check_native_queued_preparation(token)
    prepared = record.prepared() if record.prepared is not None else None
    if record.running or record.consumed or prepared is None or not _PREPARED[prepared].consumed:
        raise Refusal("binding_denied")
    before_io()
    record.running = True
    marker = _ACTIVE_QUEUED.set(token)

    def current(_):
        check_native_queued_preparation(token)
        return True

    scoped = EngineContext.scoped(record.context, current)
    try:
        await OpaqueMessaging.read(record.roots[2], scoped.parameters, scoped)
        current(None)
        record.returned = True
    finally:
        # Absence of a native ticket is not an issued no-send proof. Once the
        # queue barrier exists, missing completion stays UNKNOWN, including
        # consent refusal before ticket creation or process interruption.
        _ACTIVE_QUEUED.reset(marker)
    return AttemptOutcome.UNKNOWN  # Queue consumes only the original receipt.


def consume_native_queued_completion(token):
    record = _queued(token, cleanup=True)
    if record.consumed:
        raise Refusal("binding_denied")
    record.consumed = True
    receipt = record.receipt
    if receipt is None:
        return AttemptOutcome.UNKNOWN, None, True
    if receipt[0] is AttemptOutcome.ACCEPTED and not record.returned:
        return AttemptOutcome.UNKNOWN, None, True
    return receipt


def retire_native_queued_preparation(token):
    record = _queued(token, cleanup=True)
    if _QUEUED.get(token) is record:
        _QUEUED.pop(token)


def _attach_native_queued(binding, provider, cloud_attempt, context):
    token = _ACTIVE_QUEUED.get()
    if token is None:
        return None
    record = _queued(token)
    check_native_queued_preparation(token)
    from .trusted_actions.source_message_frames import SourceMessageFrames

    identity = EngineContext._check_identity(context)
    if (
        not record.running
        or record.attached is not None
        or binding is not record.binding
        or not any(provider is p for p in record.roots[0].providers)
        or identity[0] is not record.identity[0]
        or identity[2] is not record.identity[2]
        or identity[3] is not record.identity[3]
        or record.roots[1]._creation_maps[2].get(record.source.reference) is not record.task
        or not SourceMessageFrames.owns_current(record.roots[1])
    ):
        raise Refusal("binding_denied")
    record.attached = weakref.ref(cloud_attempt)
    return token


@dataclass(repr=False)
class _Ledger:
    ledger: object
    roots: tuple
    sender: object
    mapping: object
    provider: object
    loop: object
    thread: int
    lock: object


class NativeLedgerPacingPort:
    """Borrow an original same-loop ledger; no worker/SQLite connection move.

    Omit mapping/provider/sender together for the installation fallback bucket.
    Otherwise the existing original mapping port must already attest this exact
    Cloud provider and SenderHandle. Verification belongs to trusted composition,
    not this constructor; provider membership alone does not establish identity.
    The borrowed ledger and provider remain their original owner's resources.
    """

    def __init__(self, ledger, *, mapping=None, provider=None, sender=None):
        if type(ledger) is not PacingLedger:
            raise ValueError("original pacing ledger required")
        if any(value is not None for value in (mapping, provider, sender)):
            from .whatsapp_cloud_templates import CloudTemplateProvider
            from .whatsapp_pacing_ledger import _sender

            if (
                type(mapping) is not SenderMappingPort
                or type(provider) is not CloudTemplateProvider
                or SenderMappingPort._check(mapping)[0]() is not ledger
                or mapping.source is not provider
                or mapping.provider_kind != "cloud_api"
                or mapping.provider_backend != "cloud_api"
                or _sender(ledger, sender)[4] is not mapping
            ):
                raise Refusal("binding_denied")
            CloudTemplateProvider.check(provider)
        else:
            sender = PacingLedger.unknown_sender(ledger)
        self.ledger = ledger
        _LEDGERS[self] = _Ledger(
            ledger,
            (ledger.db, ledger.path, ledger.profile, ledger.clock, ledger.ledger_id),
            sender,
            mapping,
            provider,
            asyncio.get_running_loop(),
            threading.get_ident(),
            asyncio.Lock(),
        )

    def check(self):
        record = _LEDGERS.get(self)
        if (
            record is None
            or self.ledger is not record.ledger
            or threading.get_ident() != record.thread
            or asyncio.get_running_loop() is not record.loop
            or any(
                left is not right
                for left, right in zip(
                    record.roots,
                    (
                        record.ledger.db,
                        record.ledger.path,
                        record.ledger.profile,
                        record.ledger.clock,
                        record.ledger.ledger_id,
                    ),
                    strict=True,
                )
            )
        ):
            raise Refusal("binding_denied")
        from .whatsapp_pacing_ledger import _owner, _sender

        _owner(record.ledger)
        if record.mapping is not None:
            SenderMappingPort._check(record.mapping)
        _sender(record.ledger, record.sender)
        return record


@dataclass(repr=False)
class _Owner:
    port: object
    providers: tuple
    loop: object
    thread: int
    origins: dict = field(default_factory=dict)
    active: dict = field(default_factory=dict)
    issued: object = field(default_factory=weakref.WeakSet)
    closed: bool = False


class NativeAccountingAttempt:
    __slots__ = ("__weakref__",)


@dataclass(repr=False)
class _Attempt:
    owner: weakref.ReferenceType
    provider: weakref.ReferenceType
    cloud_attempt: weakref.ReferenceType
    context: object
    task: weakref.ReferenceType
    origin: object
    phase: str = "issued"
    ledger_attempt: object = None
    dispatch_binding: object = None
    outcome: object = None
    queued: object = None


class NativeWhatsAppAccounting:
    """Explicit opt-in binding of original Cloud providers to an actual port."""

    def __init__(self, port, *, providers):
        from .whatsapp_cloud_templates import CloudTemplateProvider

        if (
            type(providers) is not tuple
            or not providers
            or len(providers) > 128
            or any(type(provider) is not CloudTemplateProvider for provider in providers)
        ):
            raise ValueError("original bounded native providers required")
        _check_port(port)
        for provider in providers:
            CloudTemplateProvider.check(provider)
        if type(port) is NativeLedgerPacingPort:
            mapped = NativeLedgerPacingPort.check(port).provider
            if mapped is not None and (len(providers) != 1 or providers[0] is not mapped):
                raise Refusal("binding_denied")
        else:
            from .whatsapp_pacing_runtime import native_queue_provider

            mapped = native_queue_provider(port)
            if mapped is not None and (len(providers) != 1 or providers[0] is not mapped):
                raise Refusal("binding_denied")
        self.port, self.providers = port, providers
        _OWNERS[self] = _Owner(port, providers, asyncio.get_running_loop(), threading.get_ident())

    def check(self):
        owner = _OWNERS.get(self)
        if (
            owner is None
            or owner.closed
            or self.port is not owner.port
            or self.providers is not owner.providers
            or asyncio.get_running_loop() is not owner.loop
            or threading.get_ident() != owner.thread
        ):
            raise Refusal("binding_denied")
        _check_port(owner.port)
        from .whatsapp_cloud_templates import CloudTemplateProvider

        for provider in owner.providers:
            CloudTemplateProvider.check(provider)
        return owner

    def bind_arx_message(self, context, registry, message):
        """One original current mutation ingress; not a caller-origin flag.

        Trusted composition must carry the actual PeerMessage into this native
        EngineContext. A reparsed equal descriptor or read-only bootstrap proof
        cannot acquire the exemption. No origin is inferred when absent.
        """
        from .trusted_actions.native_peer_source import NativePeerRegistry
        from .trusted_actions.peer_boundary import PeerMessage
        from .whatsapp_pacing_ledger import authenticated_arx_origin

        owner = NativeWhatsAppAccounting.check(self)
        for key, refs in tuple(owner.origins.items()):
            if any(reference() is None for reference in refs):
                owner.origins.pop(key, None)
        if (
            type(context) is not EngineContext
            or type(registry) is not NativePeerRegistry
            or type(message) is not PeerMessage
            or message.request is not context.request
            or context.request.get("action") != "whatsapp/send"
            or len(owner.origins) >= 128
            or id(context.request) in owner.origins
        ):
            raise Refusal("Unauthorized")
        EngineContext.check(context)
        # Validate now; issue the actual ledger origin again at its use boundary.
        authenticated_arx_origin(registry, message)
        owner.origins[id(context.request)] = (
            weakref.ref(context.request),
            weakref.ref(registry),
            weakref.ref(message),
        )

    def issue(self, provider, cloud_attempt, context):
        from .whatsapp_cloud_templates import _ATTEMPTS, CloudSendAttempt

        owner = NativeWhatsAppAccounting.check(self)
        original = _ATTEMPTS.get(cloud_attempt) if type(cloud_attempt) is CloudSendAttempt else None
        if (
            type(context) is not EngineContext
            or original is None
            or original[0] is not provider
            or original[1] is not asyncio.current_task()
            or original[3] is not context.request
            or original[2][0]
            or not any(provider is item for item in owner.providers)
            or len(owner.issued) >= 128
            or context.request.get("action") not in {"whatsapp/send", "whatsapp/template_send_v1"}
        ):
            raise Refusal("binding_denied")
        EngineContext.check(context)
        origin = owner.origins.pop(id(context.request), None)
        if origin is not None and origin[0]() is not context.request:
            raise Refusal("Unauthorized")
        ticket = NativeAccountingAttempt()
        _TICKETS[ticket] = _Attempt(
            weakref.ref(self),
            weakref.ref(provider),
            weakref.ref(cloud_attempt),
            context,
            weakref.ref(asyncio.current_task()),
            origin,
            queued=_attach_native_queued(self, provider, cloud_attempt, context),
        )
        owner.issued.add(ticket)
        return ticket

    def close(self):
        """Retire this optional binding; original provider/ledger remain borrowed.

        Caller first joins its original native sends, as with provider shutdown.
        Refusing active close never releases their accounting scope prematurely.
        """
        owner = _OWNERS.get(self)
        if owner is None:
            raise Refusal("binding_denied")
        if owner.active:
            raise Refusal("action_failed")
        owner.origins.clear()
        for ticket in tuple(owner.issued):
            _TICKETS.pop(ticket, None)
        owner.issued.clear()
        owner.closed = True


def _check_port(port):
    from .whatsapp_pacing_runtime import HostPacingPort, check_native_pacing_port

    if type(port) is HostPacingPort:
        check_native_pacing_port(port)
    elif type(port) is NativeLedgerPacingPort:
        NativeLedgerPacingPort.check(port)
    else:
        raise ValueError("original typed native pacing port required")


def _record(ticket, *, cleanup=False):
    record = _TICKETS.get(ticket) if type(ticket) is NativeAccountingAttempt else None
    if record is None or record.task() is not asyncio.current_task():
        raise Refusal("binding_denied")
    binding = record.owner()
    owner = _OWNERS.get(binding)
    if owner is None or owner.active.get(ticket) is not record:
        raise Refusal("binding_denied")
    if not cleanup:
        NativeWhatsAppAccounting.check(binding)
        EngineContext.check(record.context)
        if record.queued is not None:
            check_native_queued_preparation(record.queued)
    return record, owner


@asynccontextmanager
async def native_accounting_scope(ticket):
    from .whatsapp_pacing_runtime import HostPacingPort, native_send_scope

    record = _TICKETS.get(ticket) if type(ticket) is NativeAccountingAttempt else None
    if record is None or record.task() is not asyncio.current_task() or record.phase != "issued":
        raise Refusal("binding_denied")
    owner = NativeWhatsAppAccounting.check(record.owner())
    owner.active[ticket] = record
    record.phase = "entered"
    try:
        if type(owner.port) is HostPacingPort:
            async with native_send_scope(owner.port):
                _record(ticket)
                yield
        else:
            _record(ticket)
            yield
    finally:
        owner.active.pop(ticket, None)
        owner.issued.discard(ticket)
        record.phase = "closed"
        # Ledger binding -> Cloud attempt -> this ticket must not retain a
        # completed private frame/context through module weak-map values.
        _TICKETS.pop(ticket, None)


async def before_native_cloud_post(ticket, request, transport):
    """Durable reserve+dispatch immediately before the original transport call."""
    from .whatsapp_cloud_templates import _ATTEMPTS, _check_scope
    from .whatsapp_pacing_ledger import authenticated_arx_origin
    from .whatsapp_pacing_runtime import (
        HostPacingPort,
        bind_native_cloud_dispatch,
        mark_native_dispatch,
        reserve_native_send,
    )

    record, owner = _record(ticket)
    cloud_attempt = record.cloud_attempt()
    original = _ATTEMPTS.get(cloud_attempt)
    scope = _check_scope(request, transport)
    if (
        record.phase != "entered"
        or request.method != "POST"
        or original is None
        or original[0] is not record.provider()
        or original[2] is not scope.attempted
        or original[3] is not record.context.request
        or original[4] is not ticket
    ):
        raise Refusal("binding_denied")
    origin = None
    if record.origin is not None:
        request_ref, registry_ref, message_ref = record.origin
        message = message_ref()
        if request_ref() is not record.context.request or message is None:
            raise Refusal("Unauthorized")
        origin = authenticated_arx_origin(registry_ref(), message)
    kwargs = dict(
        request_id=record.context.request.get("request_id"),
        action_identity=record.context.request.get("operation_id"),
        message_class="code",
        origin=origin,
        known_local=False,
    )
    if type(owner.port) is HostPacingPort:
        record.dispatch_binding = bind_native_cloud_dispatch(
            owner.port, record.provider(), cloud_attempt
        )
    else:
        port = NativeLedgerPacingPort.check(owner.port)
        record.dispatch_binding = PacingLedger.bind_cloud_dispatch(
            port.ledger, port.sender, record.provider(), cloud_attempt
        )
    kwargs["dispatch_binding"] = record.dispatch_binding
    _record(ticket)
    _check_scope(request, transport)
    record.phase = "reserving"
    if type(owner.port) is HostPacingPort:
        attempt, fresh = await reserve_native_send(owner.port, **kwargs)
    else:
        port = NativeLedgerPacingPort.check(owner.port)
        async with port.lock:
            _record(ticket)
            attempt, fresh = PacingLedger.reserve(port.ledger, port.sender, **kwargs)
    if fresh is not True:
        raise Refusal("operation_conflict")
    record.ledger_attempt = attempt
    record.phase = "reserved"
    _record(ticket)
    _check_scope(request, transport)
    if type(owner.port) is HostPacingPort:
        await mark_native_dispatch(owner.port, attempt)
    else:
        port = NativeLedgerPacingPort.check(owner.port)
        async with port.lock:
            _record(ticket)
            PacingLedger.mark_dispatch(port.ledger, attempt)
    record.phase = "dispatched"
    _record(ticket)
    _check_scope(request, transport)


async def finish_native_cloud_send(ticket, *, accepted=False, error=None):
    """Join original durable completion on its original active send Task.

    Cancellation is deferred until the original SQLite commit completes. No
    foreign child task is registered in the HA worker's active-sends scope.
    """
    from .whatsapp_cloud_templates import CloudTemplateProvider
    from .whatsapp_pacing_runtime import (
        HostPacingPort,
        finish_native_provider_rejection,
        finish_native_send,
    )

    record, owner = _record(ticket, cleanup=True)
    outcome = AttemptOutcome.UNKNOWN
    provider_rejection = False
    metadata = None
    try:
        # Original transport entry never happened. Owned completion preserves
        # that fact even after authority revocation; no new I/O is permitted.
        if CloudTemplateProvider.was_dispatched(record.provider(), record.cloud_attempt()) is False:
            outcome = AttemptOutcome.DEFINITIVELY_NOT_SENT
        else:
            _record(ticket)
            if accepted is True and record.phase == "dispatched":
                outcome = AttemptOutcome.ACCEPTED
            elif record.phase == "dispatched":
                metadata = pacing_refusal_metadata(
                    error,
                    provider=record.provider(),
                    attempt=record.cloud_attempt(),
                    request=record.context.request,
                )
                if metadata is not None:
                    outcome = AttemptOutcome.DEFINITIVELY_NOT_SENT
                    provider_rejection = True
    except Exception:
        pass  # Original completion remains possible after source/label revocation.
    record.outcome = outcome

    def completed():
        if record.queued is not None:
            queued = _queued(record.queued, cleanup=True)
            if (
                queued.attached is None
                or queued.attached() is not record.cloud_attempt()
                or queued.receipt is not None
            ):
                raise Refusal("binding_denied")
            queued.receipt = (outcome, metadata, outcome is AttemptOutcome.UNKNOWN)

    if record.ledger_attempt is None:
        completed()
        return
    cancelled = False
    while True:
        try:
            if type(owner.port) is HostPacingPort:
                if provider_rejection:
                    await finish_native_provider_rejection(
                        owner.port,
                        record.ledger_attempt,
                        error,
                        dispatch_binding=record.dispatch_binding,
                    )
                else:
                    await finish_native_send(owner.port, record.ledger_attempt, outcome)
            else:
                port = _LEDGERS.get(owner.port)
                if port is None:
                    raise Refusal("binding_denied")
                async with port.lock:
                    if provider_rejection:
                        PacingLedger.finish_provider_rejection(
                            port.ledger,
                            record.ledger_attempt,
                            error,
                            dispatch_binding=record.dispatch_binding,
                        )
                    else:
                        PacingLedger.finish(port.ledger, record.ledger_attempt, outcome)
            break
        except asyncio.CancelledError:
            cancelled = True
    record.phase = "finished"
    completed()
    if cancelled:
        raise asyncio.CancelledError
