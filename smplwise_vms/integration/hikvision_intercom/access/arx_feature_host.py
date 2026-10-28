"""Register the six native coordinators against one current, durable Arx source.

Registration is not authority: every start still verifies the original transport,
committed peer binding and complete current policy. A host never constructs a
policy from a WebSocket payload or falls back to ordinary administrator dispatch.
"""

from __future__ import annotations

import asyncio
import weakref
from collections.abc import Callable, Coroutine, Mapping
from dataclasses import dataclass, field
from typing import TYPE_CHECKING, Any
from uuid import uuid4

from homeassistant.const import EVENT_HOMEASSISTANT_STOP
from homeassistant.core import HomeAssistant, callback

from ..const import DOMAIN
from ..trusted_actions.envelope import freeze, thaw
from ..trusted_actions.source_bindings import same_ports
from ..trusted_actions.validation import Refusal
from .arx_door_execution import AutomationDoorCoordinator, DoorWindowCoordinator, NativeDoorTarget
from .arx_emergency_event_contract import KINDS as EMERGENCY_EVENT_KINDS
from .arx_emergency_event_execution import EmergencyEventCoordinator
from .arx_emergency_execution import EmergencyCoordinator
from .arx_execution_authority import (
    DurableFeaturePeerRegistry,
    FeatureAuthoritySource,
    FeatureLease,
)
from .arx_execution_journal import FeatureExecutionJournal
from .arx_feature_execution_contract import FeatureBoundary, FeatureRequest
from .arx_feature_plans import REQUIREMENTS
from .arx_media_execution import MediaExecutionCoordinator
from .arx_people_execution import PeopleCsvCoordinator
from .arx_validation_execution import ValidationCoordinator, ValidationExecutionJournal
from .manager import AccessManager

if TYPE_CHECKING:
    from homeassistant.auth.models import User

    from ..arx_media_ingress import FeatureMediaIngress, _Plan
    from ..trusted_actions.native_peer_source import NativePeerRegistry
    from .arx_validation_execution import ValidationMediaInput
    from .repository import AccessRepository

type _Controller = (
    PeopleCsvCoordinator
    | AutomationDoorCoordinator
    | DoorWindowCoordinator
    | EmergencyCoordinator
    | EmergencyEventCoordinator
    | ValidationCoordinator
    | MediaExecutionCoordinator
)
type _HostRoots = tuple[
    HomeAssistant,
    dict[Any, Any],
    dict[str, Any],
    AccessManager,
    AccessRepository,
    FeatureBoundary,
    FeatureAuthoritySource,
    DurableFeaturePeerRegistry,
    NativePeerRegistry,
    FeatureExecutionJournal,
    ValidationExecutionJournal,
]

KEY = "arx_feature_host"
MAX_JOBS = 128
_OWNERS: weakref.WeakKeyDictionary[NativeFeatureHost, _Owner] = weakref.WeakKeyDictionary()
_CLOSED: weakref.WeakKeyDictionary[
    NativeFeatureHost,
    tuple[weakref.ReferenceType[HomeAssistant], weakref.ReferenceType[AccessRepository], bool],
] = weakref.WeakKeyDictionary()


@dataclass(frozen=True, repr=False)
class _Job:
    reference: str
    original: Mapping[str, Any]
    connection: Any
    user: User
    lease: FeatureLease
    controller: _Controller
    task: asyncio.Task[dict[str, Any]]
    coroutine: Coroutine[Any, Any, dict[str, Any]]


@dataclass(repr=False)
class _Owner:
    roots: _HostRoots
    ports: tuple[Callable[..., Any], ...]
    jobs: dict[str, _Job] = field(default_factory=dict)
    operations: dict[tuple[str, str], str] = field(default_factory=dict)
    subscriptions: dict[str, tuple[dict[int, Callable[[], None]], int, Callable[[], None]]] = field(
        default_factory=dict
    )
    ingress: set[weakref.ReferenceType[FeatureMediaIngress]] = field(default_factory=set)
    cleanup: dict[str, asyncio.Task[None]] = field(default_factory=dict)
    lock: asyncio.Lock = field(default_factory=asyncio.Lock)
    closing: list[Any] = field(default_factory=lambda: [False, None])
    stop_unsubscribe: Callable[[], None] | None = None


class NativeFeatureHost:
    """Actual native host; supplied ports must come from the authenticated bridge.

    Completed attempts stay bounded and never confer replay authority. Private
    media inputs are native objects supplied by the actual registered media
    ingress, never JSON objects claiming to be connections, requests or views.
    """

    def __init__(
        self,
        hass: HomeAssistant,
        boundary: FeatureBoundary,
        authority: FeatureAuthoritySource,
        journal: FeatureExecutionJournal,
        validation_journal: ValidationExecutionJournal,
    ) -> None:
        from homeassistant.core import HomeAssistant

        if (
            type(hass) is not HomeAssistant
            or hass.is_stopping
            or type(boundary) is not FeatureBoundary
            or type(authority) is not FeatureAuthoritySource
            or type(authority.registry) is not DurableFeaturePeerRegistry
            or type(journal) is not FeatureExecutionJournal
            or type(validation_journal) is not ValidationExecutionJournal
        ):
            raise Refusal("feature_host_unavailable")
        data = hass.data
        namespace = data.get(DOMAIN)
        manager = namespace.get("access") if type(namespace) is dict else None
        registry = authority.registry.registry
        if (
            type(namespace) is not dict
            or type(manager) is not AccessManager
            or manager.repository is not registry.repository
            or boundary.repository_id != registry.repository_id
            or journal.repository_id != registry.repository_id
            or validation_journal.repository_id != registry.repository_id
            or namespace.get(KEY) is not None
        ):
            raise Refusal("feature_host_unavailable")
        FeatureAuthoritySource._stable(authority)
        registry._stable()
        journal._stable()
        validation_journal._stable()
        self.hass, self.boundary, self.authority = hass, boundary, authority
        self.manager, self.journal, self.validation_journal = manager, journal, validation_journal
        roots = (
            hass,
            data,
            namespace,
            manager,
            manager.repository,
            boundary,
            authority,
            authority.registry,
            registry,
            journal,
            validation_journal,
        )
        ports = (
            boundary.verify,
            boundary.check,
            authority.admit,
            authority.check,
            registry._stable,
            hass.config_entries.async_get_entry,
        )
        _OWNERS[self] = _Owner(roots, ports)

    def _stable(self) -> _Owner:
        owner = _OWNERS.get(self)
        if type(owner) is not _Owner or owner.closing[0]:
            raise Refusal("feature_host_unavailable")
        h, data, ns, manager, repo, boundary, source, adapter, registry, journal, validation = (
            owner.roots
        )
        if (
            self.hass is not h
            or h.is_stopping
            or h.data is not data
            or data.get(DOMAIN) is not ns
            or ns.get(KEY) is not self
            or ns.get("access") is not manager
            or self.manager is not manager
            or manager.repository is not repo
            or manager._closed
            or self.boundary is not boundary
            or self.authority is not source
            or source.registry is not adapter
            or adapter.registry is not registry
            or registry.repository is not repo
            or self.journal is not journal
            or self.validation_journal is not validation
            or not same_ports(
                owner.ports,
                (
                    boundary.verify,
                    boundary.check,
                    source.admit,
                    source.check,
                    registry._stable,
                    h.config_entries.async_get_entry,
                ),
            )
        ):
            raise Refusal("binding_denied")
        FeatureAuthoritySource._stable(source)
        registry._stable()
        journal._stable()
        validation._stable()
        return owner

    def _targets(self, lease: FeatureLease) -> tuple[NativeDoorTarget, ...]:
        owner = NativeFeatureHost._stable(self)
        hass = owner.roots[0]
        targets = []
        for grant in lease.policy.stations:
            lease.check()
            entry = hass.config_entries.async_get_entry(grant.station_id)
            if entry is None or entry.domain != DOMAIN:
                raise Refusal("binding_denied")
            targets.append(NativeDoorTarget(entry.runtime_data, grant))
        NativeFeatureHost._stable(self)
        lease.check()
        return tuple(targets)

    def _construct(
        self, lease: FeatureLease, *, validation_media: tuple[ValidationMediaInput, ...]
    ) -> _Controller:
        owner = NativeFeatureHost._stable(self)
        targets = NativeFeatureHost._targets(self, lease)
        feature = lease.message.request.get("feature")
        if feature == "people_csv":
            return PeopleCsvCoordinator(owner.roots[3], lease)
        if feature == "emergency_buttons":
            from ..native_emergency_recovery_host import require_native_emergency_recovery

            original_hass = weakref.ref(owner.roots[0])
            original_journal = weakref.ref(owner.roots[9])
            original_grants = lease.policy.stations

            def startup_current() -> None:
                hass, journal = original_hass(), original_journal()
                if hass is None or journal is None:
                    raise Refusal("emergency_recovery_unavailable")
                require_native_emergency_recovery(hass, journal, original_grants)

            private = thaw(lease.private_input)
            coordinator = (
                EmergencyEventCoordinator
                if type(private) is dict and private.get("kind") in EMERGENCY_EVENT_KINDS
                else EmergencyCoordinator
            )
            return coordinator(lease, targets, owner.roots[9], startup_guard=startup_current)
        if feature == "live_validation":
            return ValidationCoordinator(
                lease, targets, owner.roots[10], media_inputs=validation_media
            )
        if len(targets) != 1:
            raise Refusal("binding_denied")
        if feature == "door_automations":
            return AutomationDoorCoordinator(lease, targets[0], owner.roots[9])
        if feature == "door_windows":
            return DoorWindowCoordinator(lease, targets[0], owner.roots[9])
        if feature == "live_media":
            return MediaExecutionCoordinator(lease, targets[0], owner.roots[9])
        raise Refusal("unknown_action")

    @staticmethod
    async def _run(
        controller: _Controller,
        *,
        connection: Any,
        subscription: int | None,
        video: tuple[Any, Any] | None,
    ) -> dict[str, Any]:
        if type(controller) is PeopleCsvCoordinator:
            return await PeopleCsvCoordinator.execute(controller)
        if type(controller) is AutomationDoorCoordinator:
            return await AutomationDoorCoordinator.execute(controller)
        if type(controller) is EmergencyCoordinator:
            return await EmergencyCoordinator.execute(controller)
        if type(controller) is EmergencyEventCoordinator:
            return await EmergencyEventCoordinator.execute(controller)
        if type(controller) is DoorWindowCoordinator:
            return await DoorWindowCoordinator.run(controller)
        if type(controller) is ValidationCoordinator:
            return await ValidationCoordinator.run(controller)
        if type(controller) is MediaExecutionCoordinator:
            if controller.direction == "two_way_audio" and video is None:
                return await controller.audio(connection, subscription)
            if controller.direction == "video_only" and type(video) is tuple and len(video) == 2:
                return await controller.video(*video)
            raise Refusal("native_media_ingress_required")
        raise Refusal("binding_denied")

    async def start(
        self,
        encoded: Any,
        connection: Any,
        *,
        subscription: int | None = None,
        video: tuple[Any, Any] | None = None,
        validation_media: tuple[ValidationMediaInput, ...] = (),
    ) -> str:
        lease = await NativeFeatureHost.admit_media_source(self, encoded, connection)
        return await NativeFeatureHost.start_admitted(
            self,
            lease,
            connection,
            subscription=subscription,
            video=video,
            validation_media=validation_media,
        )

    async def admit_media_source(self, encoded: Any, connection: Any) -> FeatureLease:
        """Internal native admission; no caller-supplied policy or device effect."""
        owner = NativeFeatureHost._stable(self)
        message = await owner.roots[5].verify(encoded, connection)
        NativeFeatureHost._stable(self)
        lease = await owner.roots[6].admit(message)
        NativeFeatureHost._stable(self)
        lease.check()
        return lease

    def check_admitted(self, lease: FeatureLease, connection: Any) -> None:
        """Only this host's actual original boundary/source can issue admission."""
        owner = NativeFeatureHost._stable(self)
        owner.roots[6].check(lease)
        owner.roots[5].check(lease.message)
        if lease.message._connection is not connection:
            raise Refusal("Unauthorized")
        lease.check()

    def attach_media_ingress(self, view: FeatureMediaIngress) -> None:
        from ..arx_media_ingress import FeatureMediaIngress

        if type(view) is not FeatureMediaIngress:
            raise Refusal("binding_denied")
        owner = NativeFeatureHost._stable(self)
        FeatureMediaIngress.check_host(view, self)
        owner.ingress.add(weakref.ref(view))

    async def start_admitted(
        self,
        lease: FeatureLease,
        connection: Any,
        *,
        subscription: int | None = None,
        video: tuple[Any, Any] | None = None,
        validation_media: tuple[ValidationMediaInput, ...] = (),
        media_preparation: _Plan | None = None,
    ) -> str:
        NativeFeatureHost.check_admitted(self, lease, connection)
        owner = NativeFeatureHost._stable(self)
        message = lease.message
        if message.request.get("feature") == "live_validation" and not validation_media:
            from .arx_validation_execution import ValidationMediaInput

            source = thaw(lease.private_input)
            if type(source) is not dict or type(source.get("steps")) is not list:
                raise Refusal("binding_denied")
            media = []
            for step in source["steps"]:
                if step.get("action") == "video":
                    raise Refusal("native_media_ingress_required")
                if step.get("action") == "two_way_audio":
                    if type(subscription) is not int or subscription <= 0:
                        raise Refusal("native_media_ingress_required")
                    media.append(
                        ValidationMediaInput(step["step_id"], connection, subscription=subscription)
                    )
            validation_media = tuple(media)
        peer = message.verification
        original = freeze(
            {
                "request": thaw(message.request.descriptor),
                "repository_id": peer.repository_id,
                "peer": peer.verified_peer_ref,
                "binding": peer.peer_binding_ref,
                "binding_revision": peer.peer_binding_revision,
                "query_owner_id": message.query_owner_id,
            }
        )
        key = (peer.verified_peer_ref, message.request.get("operation_id"))
        async with owner.lock:
            NativeFeatureHost._stable(self)
            NativeFeatureHost.check_admitted(self, lease, connection)
            NativeFeatureHost._retire_joined(self, owner)
            if media_preparation is not None:
                from ..arx_media_ingress import check_prepared_start

                check_prepared_start(media_preparation, self, lease, connection)
            existing = owner.operations.get(key)
            if existing is not None:
                job = owner.jobs[existing]
                if (
                    job.original != original
                    or job.connection is not connection
                    or job.user is not connection.user
                ):
                    raise Refusal("operation_conflict")
                return job.reference
            if len(owner.jobs) >= MAX_JOBS:
                raise Refusal("feature_host_capacity")
            controller = NativeFeatureHost._construct(
                self, lease, validation_media=validation_media
            )
            if type(controller) is MediaExecutionCoordinator:
                if controller.direction == "two_way_audio":
                    if type(subscription) is not int or subscription <= 0 or video is not None:
                        raise Refusal("native_media_ingress_required")
                elif type(video) is not tuple or len(video) != 2:
                    raise Refusal("native_media_ingress_required")
            # No await occurs between final admission and owned task publication.
            NativeFeatureHost._stable(self)
            NativeFeatureHost.check_admitted(self, lease, connection)
            if media_preparation is not None:
                from ..arx_media_ingress import check_prepared_start, prepared_started

                check_prepared_start(media_preparation, self, lease, connection)
                prepared_started(media_preparation)
            coroutine = NativeFeatureHost._run(
                controller, connection=connection, subscription=subscription, video=video
            )
            from ..arx_native_feature_source import NativeBridgeFeatureSource

            source = getattr(owner.roots[5].verify_transport, "__self__", None)
            if type(source) is NativeBridgeFeatureSource:
                from .admin_audit import audit_actor

                # Descendant CSV/native row commits inherit only this privacy
                # restriction, never HA admin/authorship or command authority.
                with audit_actor(message.query_owner_id, "system", value_free=True):
                    task = asyncio.create_task(coroutine)
            else:
                task = asyncio.create_task(coroutine)
            ref = uuid4().hex  # lookup handle only; never a transport/peer credential
            owner.jobs[ref] = _Job(
                ref, original, connection, connection.user, lease, controller, task, coroutine
            )
            owner.operations[key] = ref
            return ref

    def _retire_joined(self, owner: _Owner) -> None:
        """Reclaim expired handles only after their original cleanup joined.

        Durable effect/person receipts remain intact. Unknown/failed/cancelled
        cleanup never becomes a free slot and no controller is reconstructed.
        """
        if NativeFeatureHost._stable(self) is not owner:
            raise Refusal("binding_denied")
        now = owner.roots[5].clock().now
        for reference, job in tuple(owner.jobs.items()):
            cleanup = owner.cleanup.get(reference)
            request = job.lease.message.request
            if type(request) is not FeatureRequest:
                raise Refusal("binding_denied")
            if (
                not job.task.done()
                or not isinstance(cleanup, asyncio.Task)
                or not cleanup.done()
                or cleanup.cancelled()
                or cleanup.exception() is not None
                or now < request._original().execution_end
            ):
                continue
            registration = owner.subscriptions.pop(reference, None)
            if registration is not None:
                subscriptions, number, callback = registration
                if subscriptions.get(number) is callback:
                    subscriptions.pop(number)
            for key, value in tuple(owner.operations.items()):
                if value == reference:
                    owner.operations.pop(key)
            owner.cleanup.pop(reference)
            owner.jobs.pop(reference)

    def _job(self, reference: str, connection: Any) -> _Job:
        owner = NativeFeatureHost._stable(self)
        job = owner.jobs.get(reference) if type(reference) is str else None
        if (
            type(job) is not _Job
            or job.connection is not connection
            or connection.user is not job.user
            or job.user.is_active is not True
            or job.task.get_coro() is not job.coroutine
        ):
            raise Refusal("Unauthorized")
        return job

    def own_connection(self, reference: str, connection: Any, subscription: int) -> None:
        """Attach cleanup to the genuine HA subscription/disconnect lifetime."""
        job = NativeFeatureHost._job(self, reference, connection)
        owner = NativeFeatureHost._stable(self)
        if reference in owner.subscriptions:
            return
        subscriptions = connection.subscriptions
        if (
            type(subscriptions) is not dict
            or type(subscription) is not int
            or subscription <= 0
            or subscription in subscriptions
        ):
            raise Refusal("invalid_fields")
        scheduled = [False]

        def disconnected() -> None:
            if not scheduled[0] and not job.task.done():
                scheduled[0] = True
                owner.roots[0].async_create_task(NativeFeatureHost._stop_job(self, job))

        subscriptions[subscription] = disconnected
        owner.subscriptions[reference] = subscriptions, subscription, disconnected

        def finished(task: asyncio.Task[dict[str, Any]]) -> None:
            if subscriptions.get(subscription) is disconnected:
                subscriptions.pop(subscription)
            if not task.cancelled():
                task.exception()  # preserve receipt/outcome, consume task warning

        job.task.add_done_callback(finished)

    def check_publication(self, reference: str, connection: Any, *, cleanup: bool = False) -> None:
        """No awaited auth/source work may precede a stale success reply."""
        job = NativeFeatureHost._job(self, reference, connection)
        if not cleanup:
            job.lease.check()

    def result(self, reference: str, connection: Any, *, principal=None) -> dict[str, Any]:
        job = NativeFeatureHost._job(self, reference, connection)
        if principal is None:
            job.lease.check()
        else:
            from ..arx_native_feature_source import NativeBridgeFeatureSource
            from ..bridge_command_auth import VerifiedBridgePrincipal

            owner = NativeFeatureHost._stable(self)
            source = getattr(owner.roots[6].resolve_policy, "__self__", None)
            if (
                type(principal) is not VerifiedBridgePrincipal
                or principal.command != "features/result"
                or principal.parameters != {"operation_ref": reference}
                or principal.owner_key[3] is not connection
                or type(source) is not NativeBridgeFeatureSource
            ):
                raise Refusal("Unauthorized")
            NativeBridgeFeatureSource.check_completion(source, job.lease, principal)
        if not job.task.done():
            return {"schema_version": 1, "operation_ref": reference, "state": "running"}
        if job.task.cancelled():
            return {
                "schema_version": 1,
                "operation_ref": reference,
                "state": "cancelled",
                "replay_available": False,
            }
        error = job.task.exception()
        if error is not None:
            return {
                "schema_version": 1,
                "operation_ref": reference,
                "state": "unknown",
                "replay_available": False,
            }
        return {
            "schema_version": 1,
            "operation_ref": reference,
            "state": "finished",
            "receipt": job.task.result(),
            "replay_available": False,
        }

    async def _stop_job(self, job: _Job) -> None:
        # Only constructor-owned instances and the exact original coroutine are
        # cleanup targets, including after public aliases/authorization changed.
        owner = _OWNERS.get(self)
        if (
            type(owner) is not _Owner
            or owner.jobs.get(job.reference) is not job
            or job.task.get_coro() is not job.coroutine
        ):
            raise Refusal("binding_denied")
        if job.reference not in owner.cleanup:

            async def finish() -> None:
                error: BaseException | None
                controller, error = job.controller, None
                try:
                    if type(controller) is ValidationCoordinator:
                        await ValidationCoordinator.abort(controller)
                    elif type(controller) is DoorWindowCoordinator:
                        await DoorWindowCoordinator.close(controller)
                    elif type(controller) is EmergencyCoordinator:
                        await EmergencyCoordinator.close(controller)
                    elif type(controller) is EmergencyEventCoordinator:
                        await EmergencyEventCoordinator.close(controller)
                    elif type(controller) is PeopleCsvCoordinator:
                        await PeopleCsvCoordinator.close(controller)
                    elif type(controller) is MediaExecutionCoordinator:
                        await MediaExecutionCoordinator.close(controller)
                except BaseException as failure:
                    error = failure
                finally:
                    if not job.task.done() and not job.task.cancelling():
                        job.task.cancel()
                    await asyncio.gather(job.task, return_exceptions=True)
                if error is not None:
                    raise error

            owner.cleanup[job.reference] = asyncio.create_task(finish())
        # Caller cancellation cannot cancel the original cleanup or its join.
        # Concurrent disconnect/cancel/HAStop all await the same owned task.
        await _join(owner.cleanup[job.reference])

    async def cancel(self, reference: str, connection: Any) -> dict[str, Any]:
        job = NativeFeatureHost._job(self, reference, connection)
        await NativeFeatureHost._stop_job(self, job)
        return {
            "schema_version": 1,
            "operation_ref": reference,
            "state": "cleanup_joined",
            "replay_available": False,
        }

    async def close(self) -> None:
        owner = _OWNERS.get(self)
        if type(owner) is not _Owner:
            if self in _CLOSED:
                if _CLOSED[self][2]:
                    raise Refusal("feature_cleanup_unknown")
                return
            raise Refusal("binding_denied")
        owner.closing[0] = True
        if owner.closing[1] is None:

            async def finish() -> None:
                failed = True
                try:
                    from ..arx_media_ingress import FeatureMediaIngress

                    ingress_results = await asyncio.gather(
                        *(
                            FeatureMediaIngress.close_host(view, self)
                            for view_ref in tuple(owner.ingress)
                            if (view := view_ref()) is not None
                        ),
                        return_exceptions=True,
                    )
                    results = await asyncio.gather(
                        *(
                            NativeFeatureHost._stop_job(self, job)
                            for job in tuple(owner.jobs.values())
                        ),
                        return_exceptions=True,
                    )
                    failed = any(
                        isinstance(value, BaseException) for value in (*ingress_results, *results)
                    )
                    if failed:
                        raise Refusal("feature_cleanup_unknown")
                finally:
                    if owner.stop_unsubscribe is not None:
                        remove, owner.stop_unsubscribe = owner.stop_unsubscribe, None
                        remove()
                    # Keep original jobs/resources and namespace ownership on
                    # failed cleanup. A weak failure label cannot replace them
                    # or allow a second native host to be installed.
                    if not failed:
                        namespace = owner.roots[2]
                        if namespace.get(KEY) is self:
                            namespace.pop(KEY)
                        _CLOSED[self] = (
                            weakref.ref(owner.roots[0]),
                            weakref.ref(owner.roots[4]),
                            False,
                        )
                        _OWNERS.pop(self, None)

            owner.closing[1] = asyncio.create_task(finish())
        await _join(owner.closing[1])


async def _join(task: asyncio.Task[None]) -> None:
    cancelled = False
    while not task.done():
        try:
            await asyncio.shield(task)
        except asyncio.CancelledError:
            cancelled = True
    task.result()
    if cancelled:
        raise asyncio.CancelledError


def install_native_feature_host(
    hass: HomeAssistant,
    *,
    boundary: FeatureBoundary,
    authority: FeatureAuthoritySource,
    journal: FeatureExecutionJournal,
    validation_journal: ValidationExecutionJournal,
) -> NativeFeatureHost:
    host = NativeFeatureHost(hass, boundary, authority, journal, validation_journal)
    hass.data[DOMAIN][KEY] = host
    owner = NativeFeatureHost._stable(host)

    @callback
    def stop(_event: Any) -> None:
        # Revoke admission/publication in the synchronous stop callback, before
        # the scheduled finalizer gets a turn. Cleanup still joins original jobs.
        owner.closing[0] = True
        # The event bus consumed its once-listener before entering this callback.
        # Clear the original removal handle before any concurrent async cleanup.
        owner.stop_unsubscribe = None
        hass.async_create_task(NativeFeatureHost.close(host))

    owner.stop_unsubscribe = hass.bus.async_listen_once(EVENT_HOMEASSISTANT_STOP, stop)
    return host


async def close_native_feature_hosts(hass: HomeAssistant, repository: AccessRepository) -> None:
    """Join original hosts before the original repository/manager are closed.

    A replaced/deleted public alias cannot hide owned work or select a foreign
    host. Closed tombstones retain only weak scope references and a boolean.
    """
    active = tuple(
        host
        for host, owner in tuple(_OWNERS.items())
        if type(owner) is _Owner and owner.roots[0] is hass and owner.roots[4] is repository
    )
    for host in active:
        _OWNERS[host].closing[0] = True
    closed = tuple(
        host
        for host, (original_hass, original_repository, _failed) in tuple(_CLOSED.items())
        if original_hass() is hass and original_repository() is repository
    )
    hosts = (*active, *closed)

    async def finish() -> None:
        results = await asyncio.gather(
            *(NativeFeatureHost.close(host) for host in hosts), return_exceptions=True
        )
        if any(isinstance(value, BaseException) for value in results):
            raise Refusal("feature_cleanup_unknown")

    await _join(asyncio.create_task(finish()))


def feature_host_status(hass: HomeAssistant) -> dict[str, Any]:
    from .. import arx_preview_features as gates

    host = hass.data.get(DOMAIN, {}).get(KEY)
    available = False
    current_features = None
    if type(host) is NativeFeatureHost:
        try:
            NativeFeatureHost._stable(host)
            available = True
            from ..arx_native_feature_source import NativeBridgeFeatureSource

            source = getattr(host.boundary.verify_transport, "__self__", None)
            if type(source) is NativeBridgeFeatureSource:
                current_features = NativeBridgeFeatureSource.current_features(source)
                available = bool(current_features)
        except Refusal:
            pass
    recovery_ready = False
    if available:
        from ..native_emergency_recovery_host import native_emergency_recovery_ready

        recovery_ready = native_emergency_recovery_ready(hass, host.journal)
    return {
        "schema_version": 1,
        "host_registered": type(host) is NativeFeatureHost,
        "current_source_available": available,
        "features": {
            name: {
                "implementation": "native_coordinator",
                "build_enabled": gates.PLAN_FLAGS.get(name) is True,
                "execution_available": (
                    available
                    and gates.PLAN_FLAGS.get(name) is True
                    and (current_features is None or name in current_features)
                    and (name != "emergency_buttons" or recovery_ready)
                ),
                "blocker": (
                    "authenticated_current_source_not_installed"
                    if not available
                    else "feature_disabled"
                    if gates.PLAN_FLAGS.get(name) is not True
                    else "signed_feature_policy_not_current"
                    if current_features is not None and name not in current_features
                    else "emergency_recovery_unavailable"
                    if name == "emergency_buttons" and not recovery_ready
                    else None
                ),
            }
            for name in REQUIREMENTS
        },
        "physical_result": "unproven",
    }


async def close_feature_connection(hass, connection) -> None:
    """Join original jobs/HTTP ingress after a native transport disconnect.

    Cleanup uses constructor-owned roots even when authorization/public aliases
    have changed. It closes only jobs belonging to this exact connection.
    """
    for host, owner in tuple(_OWNERS.items()):
        if owner.roots[0] is not hass:
            continue
        from ..arx_media_ingress import _VIEWS, FeatureMediaIngress

        for ref in tuple(owner.ingress):
            view = ref()
            ingress = _VIEWS.get(view) if view is not None else None
            if ingress is not None:
                plans = tuple(p for p in ingress.plans.values() if p.connection is connection)
                await FeatureMediaIngress._close_many(view, plans)
        for job in tuple(owner.jobs.values()):
            if job.connection is connection:
                await NativeFeatureHost._stop_job(host, job)
