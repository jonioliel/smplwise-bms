"""Explicit composition seam for the existing bridge; never registers a service.

Only a trusted in-process host injects verification, Arx decisions and immutable
parameter preparation. There is deliberately no default verifier or classic
dispatch fallback. This module neither implements nor simulates cryptography.
"""
from __future__ import annotations

from dataclasses import dataclass
from datetime import datetime
import json
import asyncio
from contextvars import ContextVar, Context

from .artifacts import Artifacts
from .envelope import ClockSample, Request, freeze, thaw
from .journal import Journal
from .producer import AuthenticatedDescriptor, DispatchReply, Producer, Registry, TrustedIngress
from .proofs import ProofEmitter
from .preparation_scope import PreparationScope, scopes as _preparation_scopes
from .repository_view import RepositoryPublicSource
from .resolver import ImmutableResolver
from .safe_csv import SafeCsv
from .source_bindings import same_identities
from .validation import Refusal, Schema, reference, resources, resource


_shutdown_owners = ContextVar('wiskey_shutdown_owners', default=frozenset())


@dataclass(frozen=True, repr=False)
class PreparedOperation:
    parameters: object
    expires: datetime
    resolved_target: object

    @classmethod
    def create(cls, parameters, expires, resolved_target):
        return cls(freeze(parameters), expires, freeze(resolved_target))


class HostClock:
    """Check fresh host/Supervisor samples, without fetching or caching health."""
    def __init__(self, sample_provider):
        self.provider = sample_provider
        self.last = None

    def __call__(self):
        provider=self.provider
        sample = provider()
        if self.provider is not provider:raise Refusal('binding_denied')
        if type(sample) is not ClockSample:
            raise Refusal("binding_denied")
        sample.check()
        if self.last is not None and sample.now < self.last:
            raise Refusal("binding_denied")
        self.last = sample.now
        return sample


class CandidateHost:
    def __init__(self, *, epoch, verifier, prepare, binding_current, clock, journal, registry, csv=None, audit_store_for=None):
        self.epoch = reference(epoch)
        self.verifier, self.prepare = verifier, prepare
        self.clock, self.journal, self.registry = clock, journal, registry
        self.resolver = ImmutableResolver(epoch)
        self.artifacts = Artifacts()
        self.proofs = ProofEmitter()
        self.closed = False
        self.csv = csv
        self.audit_store_for=audit_store_for
        self.binding_current=binding_current
        def admitted_current(request):
            if self.closed or self.binding_current is not binding_current or not self._request_maps_current():return False
            allowed=binding_current(request)
            return not self.closed and self.binding_current is binding_current and self._request_maps_current() and allowed is True
        self._prepared = {}
        self._inflight = set()
        self._request_depth={}
        self._request_exits={}
        self._request_owners=(self._inflight,self._request_depth,self._request_exits)
        self._shutdown_task=None
        self._shutdown_owner=object()
        self._lifetimes=[]
        self._ownership_checks=[]
        self._ownership_check_failures=0
        self.cleanup_failures=()
        self.producer = Producer(registry, self.resolver, journal, clock, admitted_current,
                                 enable_rev2=csv is not None, proofs=self.proofs, artifacts=self.artifacts)
        self.ingress = TrustedIngress(self.producer, self._verify_and_prepare)

    def _parts(self):
        return (self.epoch,self.verifier,self.prepare,self.clock,getattr(self.clock,'provider',None),
                self.journal,self.registry,self.resolver,self.producer,self.ingress,self.csv,self.proofs,self.artifacts,
                self.producer.current_arx_binding,self.binding_current,self.audit_store_for,
                self._request_owners,self._inflight,self._request_depth,self._request_exits)

    def _request_maps_current(self):
        owners=self._request_owners
        return type(owners) is tuple and len(owners)==3 and owners[0] is self._inflight and owners[1] is self._request_depth and owners[2] is self._request_exits

    async def _verify_and_prepare(self, signed_message_json):
        if self.closed or self.verifier is None or self.prepare is None:
            raise Refusal("Unauthorized")
        parts=self._parts()
        def stable():
            if self.closed or not same_identities(parts,self._parts()):raise Refusal('binding_denied')
            if (self.producer.clock is not self.clock or self.producer.journal is not self.journal or
                self.producer.registry is not self.registry or self.producer.resolver is not self.resolver or
                self.producer.proofs is not self.proofs or self.producer.artifacts is not self.artifacts):raise Refusal('binding_denied')
        stable()
        verifier,preparer=self.verifier,self.prepare
        verified = await verifier(signed_message_json)
        if self.closed or self.verifier is not verifier or self.prepare is not preparer or type(verified) is not AuthenticatedDescriptor or verified.epoch != self.epoch:
            raise Refusal("Unauthorized")
        stable()
        sample = self.clock()
        request = Request.parse(verified.public_json, sample.now, self.producer.enabled)
        if request.get('actor')['kind']=='human' and verified.human_session_active is not True:raise Refusal('Unauthorized')
        self.resolver.prune(sample.now)
        key = request.get("operation_binding_ref")
        # Immutable preparer runs once, not again for a replay or mutable lookup.
        for old, record in tuple(self._prepared.items()):
            if sample.now >= record[1]:
                del self._prepared[old]
        if self.journal.has_replay(request.get('request_id'),request.get('operation_id'),sample.now):
            # The producer still performs atomic replay admission. Do not read
            # or prepare a parameter body again merely to reject a duplicate.
            return verified
        if key in self._prepared:
            if self._prepared[key][0] != request.descriptor:
                raise Refusal("binding_denied")
            return verified
        if self.producer.current_arx_binding(request) is not True:
            raise Refusal("permission_revision_changed")
        adapter=self.registry.admit(request)
        stable()
        from .source_preparer import AdmittedSourcePreparer
        scope=_preparation_scopes.get()
        if type(preparer) is AdmittedSourcePreparer and scope is not None and scope.host is self:
            if type(preparer._prepared) is not dict:raise Refusal('binding_denied')
            # Capture the owner/map before preparation. A denied late check or
            # replaced in-process port must not orphan this call's record.
            scope.records.append((preparer,request,preparer._prepared))
        if scope is None or scope.host is not self or scope.task is not asyncio.current_task():raise Refusal('binding_denied')
        previous_request=scope.request
        scope.request=request
        try:
            prepared = await preparer(request)
        finally:
            scope.request=previous_request
        stable()
        if self.registry.admit(request) is not adapter:raise Refusal('binding_denied')
        sample = self.clock()
        request.recheck(sample.now,self.producer.enabled)
        if self.closed or self.verifier is not verifier or self.prepare is not preparer or type(prepared) is not PreparedOperation or self.producer.current_arx_binding(request) is not True:
            raise Refusal("binding_denied")
        self.resolver.bind(request, thaw(prepared.parameters), prepared.expires,
                           resolved_target=thaw(prepared.resolved_target))
        self._prepared[key] = (request.descriptor, prepared.expires)
        return verified

    async def handle(self, data, *, return_response):
        """Host service-handler seam, not a registration or a new wire protocol.

        The existing trusted bridge receives DispatchReply in-process. The
        artifact must be consumed through handoff before passing a projection.
        Caller-controlled side parameters, auth flags and transport overrides
        are refused before verification or parameter resolution.
        """
        if self.closed or not self._request_maps_current() or sum(self._request_depth.values())>=128 or return_response is not True or type(data) is not dict or set(data) != {"signed_message_json"}:
            return {"error": "Unauthorized"}
        task = asyncio.current_task()
        inflight,request_depth,request_exits=self._request_owners
        inflight.add(task)
        depth=request_depth.get(task,0)
        if not depth:request_exits[task]=asyncio.get_running_loop().create_future()
        request_exit=request_exits[task]
        request_depth[task]=depth+1
        marker=_shutdown_owners.set(_shutdown_owners.get() | {self._shutdown_owner})
        preparation_scope=PreparationScope(self,task)
        preparation_marker=_preparation_scopes.set(preparation_scope)
        try:
            return await self.ingress.handle(data["signed_message_json"])
        finally:
            from .source_preparer import _Prepared
            for preparer,request,records in preparation_scope.records:
                for key,record in tuple(records.items()):
                    if type(record) is _Prepared and record.request_owner is request:records.pop(key,None)
            for records,key,item in preparation_scope.opaque:
                if records.get(key) is item:records.pop(key,None)
            preparation_scope.records.clear()
            preparation_scope.opaque.clear()
            preparation_scope.request=None
            _preparation_scopes.reset(preparation_marker)
            depth=request_depth[task]-1
            if depth:request_depth[task]=depth
            else:
                request_depth.pop(task,None)
                inflight.discard(task)
                if request_exits.pop(task,None) is not request_exit:raise Refusal('binding_denied')
                if not request_exit.done():request_exit.set_result(None)
            _shutdown_owners.reset(marker)

    def _current(self, request):
        if self.closed or type(request) is not Request:
            raise Refusal("Unauthorized")
        now = self.clock().now
        request.recheck(now,self.producer.enabled)
        if self.producer.current_arx_binding(request) is not True:
            raise Refusal("grant_revoked")
        binding = self.resolver.resolve(request, self.epoch, now)
        self.resolver.validate(binding, request, self.epoch, now)
        return now

    def handoff(self, reply, request):
        """One-use authenticated internal artifact resolution; no success cache."""
        if type(reply) is not DispatchReply or reply.artifact_reference is None:
            raise Refusal("binding_denied")
        try:
            now = self._current(request)
            metadata = thaw(reply.metadata)
            from .validation import resource
            Schema.from_resource("ACTION_RESULT.draft3.schema.json")(metadata)
            if (metadata["request_id"], metadata["operation_id"]) != (request.get("request_id"), request.get("operation_id")):
                raise Refusal("binding_denied")
            return self.artifacts.resolve(reply.artifact_reference, request, self.epoch, now)
        except Exception:
            self.artifacts.discard(reply.artifact_reference)
            raise Refusal('binding_denied') from None

    def status(self, request):
        """Authenticated existing-operation lookup only; never reconstruct a body."""
        now = self._current(request)
        result = {"schema_version": "wiskey-arx-receipt-status-draft.3", "kind": "operation_status",
                  "request_id": request.get("request_id"), "target_operation_reference": request.get("operation_id"),
                  "state": self.journal.lookup_unknown(request.get("request_id"), now)}
        from .validation import resource
        Schema(resource("OPERATION_STATUS.draft3.schema.json"),
               {"ACTION_RESULT.draft3.schema.json": resource("ACTION_RESULT.draft3.schema.json")})(result)
        return freeze(result)

    def revoke(self, grant_id):
        self.resolver.revoke(grant_id)
        self.artifacts.clear()
        if self.csv is not None:
            self.csv.clear()  # Conservative invalidation, never authority for another grant.

    def audit_store(self,request):
        """Select an audit store only from the bound fresh host decision.

        This explicit injected seam has no native discovery or fallback. The
        metadata reader supplies no store/actor/person/station selector.
        """
        self._current(request)
        selector=self.audit_store_for
        if request.get('action')!='audit/list' or not callable(selector):raise Refusal('binding_denied')
        store=selector(request)
        self._current(request)
        if self.audit_store_for is not selector:raise Refusal('binding_denied')
        if type(store)is not dict:raise Refusal('binding_denied')
        return store

    def close(self):
        # Stop new authority immediately; async owners must be cancelled/joined
        # before releasing their resolver, artifacts and replay connection.
        self.closed = True
        if self._request_owners[0] or self._lifetimes or (self._shutdown_task is not None and not self._shutdown_task.done()):raise Refusal('binding_denied')
        self._finish_close()

    def _finish_close(self):
        if any(self._request_owners):raise Refusal('binding_denied')
        self.closed = True
        self.resolver.clear()
        self.artifacts.clear()
        self.proofs.clear()
        self._prepared.clear()
        if self.csv is not None:
            self.csv.clear()
        self.journal.close()

    def own_lifetime(self, async_shutdown, *, owns_current=None):
        """Explicitly register an injected capture/job owner; no discovery."""
        if self.closed or not callable(async_shutdown) or (owns_current is not None and not callable(owns_current)) or len(self._lifetimes)>=16 or async_shutdown in self._lifetimes:
            raise Refusal('binding_denied')
        self._lifetimes.append(async_shutdown)
        self._ownership_checks.append(owns_current)

    async def aclose(self):
        """External callers join; owned callers signal close without self-join.

        A request, cleanup or cleanup descendant cannot wait for a shutdown
        which must itself join that caller. They close admission immediately
        and return to their owner. External callers still await the one shared
        shutdown, even if cancelled. This is a lifetime rule, not authority.
        """
        self.closed=True
        if self._shutdown_task is None:
            # Cleanup tasks are external to admitted resource/job scopes.
            # Preserve only cross-host lifetime markers for reentrant close,
            # never request/preparation/actor/private ContextVar contents.
            shutdown_context=Context()
            shutdown_context.run(_shutdown_owners.set,_shutdown_owners.get()|{self._shutdown_owner})
            self._shutdown_task=asyncio.create_task(self._shutdown(),context=shutdown_context)
        if asyncio.current_task() in self._request_owners[0] or self._shutdown_owner in _shutdown_owners.get():
            return
        for owns_current in self._ownership_checks:
            if owns_current is not None:
                try:owned=owns_current()
                except Exception:
                    self._ownership_check_failures=min(16,self._ownership_check_failures+1)
                    # Close admission and schedule cleanup, but unwind an
                    # unknown owned caller before any potentially cyclic join.
                    raise Refusal('binding_denied') from None
                if type(owned)is not bool:raise Refusal('binding_denied')
                if owned:return
        closing=self._shutdown_task;cancelled=False
        while not closing.done():
            try:await asyncio.shield(closing)
            except asyncio.CancelledError:cancelled=True
        closing.result()
        if cancelled:raise asyncio.CancelledError

    async def _shutdown(self):
        """Stop admission, cancel/join owned host work, then clear local state.

        Completion of a shielded save may precede cancellation; this never
        rolls back effects or permits replay. External collectors are separately
        owned by the injected engine and must be joined by that host owner.
        """
        self.closed = True
        tasks = list(self._request_owners[0])
        # A caller task can continue after handle() returns and then join this
        # very shutdown. Join its exact admitted request scope, not unrelated
        # subsequent work in that caller. The outermost nested request exits
        # only after its finally cleanup; all registered workers still join.
        request_exits=[self._request_owners[2][task] for task in tasks]
        for task in tasks:task.cancel()
        if tasks or self._lifetimes:
            async def shutdown_one(shutdown):
                # A faulty trusted owner must not strand the other owners.
                marker=_shutdown_owners.set(_shutdown_owners.get() | {self._shutdown_owner})
                try:await shutdown()
                finally:_shutdown_owners.reset(marker)
            joining = asyncio.gather(*request_exits,*(shutdown_one(shutdown) for shutdown in self._lifetimes), return_exceptions=True)
            cancelled = False
            while not joining.done():
                try:await asyncio.shield(joining)
                except asyncio.CancelledError:cancelled = True
            self.cleanup_failures=tuple(type(value).__name__ for value in joining.result()[len(tasks):] if isinstance(value,BaseException))
            if self._ownership_check_failures:self.cleanup_failures+=('OwnershipCheckFailure',)
            if not self._request_maps_current():self.cleanup_failures+=('RequestOwnershipReplaced',)
            self._lifetimes.clear()
            self._ownership_checks.clear()
            self._finish_close()
            if cancelled:raise asyncio.CancelledError()
        else:
            if not self._request_maps_current():self.cleanup_failures+=('RequestOwnershipReplaced',)
            self._finish_close()


def compose(*, journal_path, epoch, verifier=None, prepare=None, binding_current,
            clock_sample, adapters=(), adapter_specs=(), backend=None, mapping=None, trace_sink=None,
            current_users=None, fresh_arx_view=None, enable_csv=False, audit_store_for=None, require_station_mapping=False):
    """No backend, CSV provider or registration is silently discovered at import."""
    if type(enable_csv) is not bool:
        raise ValueError("invalid CSV setting")
    clock = HostClock(clock_sample)
    registry = Registry(frozenset(resource("selection.json")["rev1"]))
    from .adapters import require_catalog_adapter
    for action, adapter in adapters:
        if adapter.profile_status != 'CLOSED_LOCAL_FAKE':
            raise ValueError('unclosed adapter stays OFF in composition')
        require_catalog_adapter(action,adapter)
        registry.register(action, adapter)
    if adapter_specs:
        if backend is None:
            raise ValueError('explicit engine backend required')
        from .adapters import build_adapter
        for spec in adapter_specs:
            if spec.profile_status != 'CLOSED_LOCAL_FAKE':
                raise ValueError('unclosed adapter stays OFF in composition')
            adapter=build_adapter(spec,backend,binding_current,mapping=mapping,trace_sink=trace_sink,require_station_mapping=require_station_mapping)
            require_catalog_adapter(spec.action,adapter)
            registry.register(spec.action,adapter)
    csv = None
    if enable_csv:
        if current_users is None or fresh_arx_view is None:
            raise ValueError("explicit public source and Arx view required")
        csv = SafeCsv(RepositoryPublicSource(current_users), fresh_arx_view, clock)
        csv.register(registry)
    journal = Journal(journal_path)
    try:
        return CandidateHost(epoch=epoch, verifier=verifier, prepare=prepare, binding_current=binding_current,
                             clock=clock, journal=journal, registry=registry, csv=csv, audit_store_for=audit_store_for)
    except BaseException:
        journal.close()
        raise
