"""OFF source HA renewal continuation, with explicit fake scheduler/admissions.

A successful owned source worker issues a one-use completion. A timer stores
only its source/provenance binding; it carries no authority. Every firing needs
a fresh verified context from the injected Arx admission port, new identities,
the same true actor/scope and current source policy/revision. No service,
transport, scheduler, HA integration or restart activation is installed here.
"""
import asyncio
from .source_bindings import same_ports,same_identities

from contextvars import ContextVar
from dataclasses import dataclass
from datetime import timedelta
import inspect
import math
from uuid import uuid4
from .adapters import EngineContext
from .lifetime import raise_if_cancelling
from .envelope import freeze,thaw
from .jobs import Provenance,same_parameters
from .source_identity import SourceIdentities
from .source_timing import SourcePolicyWorker,same_owner
from .validation import Refusal,reference

_owners=ContextVar('wiskey_policy_continuation_owners',default=frozenset())
_credential_scope=ContextVar('wiskey_policy_renewal_credential_scope',default=None)


@dataclass(frozen=True,repr=False)
class _CredentialScope:
    continuation:object
    context:object
    birth:object
    task:object


def current_credential_birth(continuation,context,resources):
    """Only this fresh admitted timer task may bind its current source row."""
    scope=_credential_scope.get()
    if type(continuation)is not SourcePolicyContinuations:raise Refusal('binding_denied')
    continuation._check()
    if (type(scope) is not _CredentialScope
        or scope.continuation is not continuation or scope.context is not context or scope.task is not asyncio.current_task()
        or continuation.credential_resources is not resources or continuation._inflight.get(scope.birth.key) is not scope.task
        or continuation._inflight_births.get(scope.birth.key) is not scope.birth):
        raise Refusal('binding_denied')
    context.check();continuation._live(scope.birth)
    if _credential_scope.get() is not scope:raise Refusal('binding_denied')
    return scope.birth.person_id,scope.birth.revision


@dataclass(frozen=True,repr=False)
class PolicyContinuation:
    key:str
    origin:Provenance
    parameters:object
    person_id:str
    revision:int
    stations:tuple
    policy:object
    armed_at:object
    due_at:object
    source_owners:tuple


@dataclass(frozen=True,repr=False)
class _RenewalRecord:
    birth:object
    fields:tuple
    cleanup:list


@dataclass(frozen=True,repr=False)
class _ContinuationOwner:
    worker:object
    identities:object
    credentials:object
    bound:tuple
    pending:dict
    inflight:dict
    births:dict
    history:set
    parents:set
    cancelled:set
    ids:dict
    id_sets:tuple
    token:object
    records:dict
    closing:list
    identity_ports:tuple


class SourcePolicyContinuations:
    def __init__(self,*,epoch,worker,identities,normalize_policy,fresh_admission,
                 scheduler,next_delay,clock_sample,source_owners,limit=128,tombstones=4096,credential_resources=None):
        if type(worker) is not SourcePolicyWorker or type(identities) is not SourceIdentities or not all(callable(p) for p in (normalize_policy,fresh_admission,scheduler,next_delay,clock_sample,source_owners)) or type(limit) is not int or type(tombstones) is not int or not 1<=limit<=128 or not limit<=tombstones<=65536:
            raise ValueError('explicit bounded source continuation ports required')
        self.epoch=reference(epoch);self.worker=worker;self.identities=identities
        if credential_resources is not None:
            from types import MethodType
            from .source_credentials import SourceCredentialResources
            from .source_reconcile import SourceReconcileWorker
            callback=worker.run
            if (type(credential_resources) is not SourceCredentialResources or type(callback) is not MethodType
                or type(callback.__self__) is not SourceReconcileWorker or callback.__func__ is not SourceReconcileWorker.enqueue
                or callback.__self__.credentials is not credential_resources or callback.__self__.repository is not identities.repository):
                raise ValueError('same owned renewal credential source required')
        self.credential_resources=credential_resources
        self.normalize,self.admit,self.schedule,self.delay,self.clock,self.owners=normalize_policy,fresh_admission,scheduler,next_delay,clock_sample,source_owners
        self.limit,self.tombstones=limit,tombstones;self.closed=False;self._pending={};self._inflight={};self._inflight_births={};self._history=set();self._parents=set();self._cancelled=set()
        self._ids={name:set() for name in ('request','operation','binding','decision','parameters')}
        self._owner=object();self._closing=None;self._bound=self._ports()
        self._creation=_ContinuationOwner(worker,identities,credential_resources,self._bound,self._pending,self._inflight,self._inflight_births,self._history,
            self._parents,self._cancelled,self._ids,tuple(self._ids.items()),self._owner,{},[None],
            (identities.identity,identities.check_policy))

    def _ports(self):
        return (self.worker,self.worker.run,self.worker.current_user,self.worker.owners,self.worker.claim_completion,self.identities,self.identities.repository,
            self.normalize,self.admit,self.schedule,self.delay,self.clock,self.owners,self.epoch,self.limit,self.tombstones,
            self.credential_resources,getattr(self.credential_resources,'current_user',None),getattr(self.credential_resources,'card_type',None),
            self._pending,self._inflight,self._inflight_births)

    def _check(self):
        o=self._creation
        if (self.worker is not o.worker or self.identities is not o.identities or self.credential_resources is not o.credentials
            or self._bound is not o.bound):raise Refusal('binding_denied')
        if (type(self.closed)is not bool or self.closed or self.worker.closed
            or self.credential_resources is not None and self.credential_resources.closed or self.worker.continuations is not self
            or self._bound is not o.bound or not same_ports(o.bound,self._ports())
            or not same_identities((o.pending,o.inflight,o.births,o.history,o.parents,o.cancelled,o.ids,o.token),
                (self._pending,self._inflight,self._inflight_births,self._history,self._parents,self._cancelled,self._ids,self._owner))
            or len(o.ids)!=len(o.id_sets)or any(o.ids.get(name)is not values for name,values in o.id_sets)
            or not same_ports(o.identity_ports,(self.identities.identity,self.identities.check_policy))):raise Refusal('binding_denied')
        SourcePolicyWorker._check_owner(self.worker)

    @staticmethod
    def _birth_fields(birth):
        origin=birth.origin
        if type(origin)is not Provenance:raise Refusal('binding_denied')
        return (birth.key,birth.origin,birth.parameters,birth.person_id,birth.revision,birth.stations,birth.policy,
            birth.armed_at,birth.due_at,birth.source_owners,origin.parent_request_id,origin.parent_operation_id,
            origin.actor,origin.target,origin.action,origin.grant,origin.selection_revision,origin.schema,origin.epoch,origin.channel)

    def _record(self,birth):
        if type(birth)is not PolicyContinuation or type(birth.key)is not str:raise Refusal('binding_denied')
        record=self._creation.records.get(birth.key)
        if (type(record)is not _RenewalRecord or record.birth is not birth
            or not same_identities(record.fields,self._birth_fields(birth))):raise Refusal('binding_denied')
        return record

    @staticmethod
    def _stop_handle(record):
        handle,stop,stopped,task=record.cleanup
        if stop is not None and not stopped:
            record.cleanup[2]=True
            result=stop()
            if inspect.isawaitable(result):
                if inspect.iscoroutine(result):result.close()
                raise Refusal('binding_denied')

    @staticmethod
    def _identifiers(request):
        return {'request':request.get('request_id'),'operation':request.get('operation_id'),'binding':request.get('operation_binding_ref'),
            'decision':request.get('decision')['decision_id'],'parameters':request.get('operation')['parameter_reference']}

    def _policy_current(self,birth):
        repository=self.identities.repository;state=repository._state
        if type(state)is not dict or type(state.get('users'))is not dict:raise Refusal('binding_denied')
        raw=state['users'].get(birth.person_id)
        if type(raw)is not dict or type(raw.get('assignments'))is not dict or len(raw['assignments'])>100:raise Refusal('binding_denied')
        assigned=raw['assignments']
        if any(type(station)is not str or type(row)is not dict or type(row.get('enabled'))is not bool for station,row in assigned.items()):raise Refusal('binding_denied')
        if tuple(sorted(station for station,row in assigned.items()if row['enabled']))!=birth.stations:raise Refusal('binding_denied')
        for station in birth.stations:self.identities.check_policy(birth.person_id,birth.revision,station,birth.policy)
        if repository._state is not state or state['users'].get(birth.person_id)is not raw:raise Refusal('binding_denied')

    def _live(self,birth):
        self._check();entry=self._record(birth)
        task=entry.cleanup[3]
        if task is not None and (self._creation.inflight.get(birth.key)is not task or self._creation.births.get(birth.key)is not birth):raise Refusal('binding_denied')
        if birth.key in self._cancelled or birth.origin.epoch!=self.epoch:raise Refusal('binding_denied')
        owners=tuple(self.owners())
        if len(owners)!=len(birth.source_owners) or any(a is not b for a,b in zip(owners,birth.source_owners)):raise Refusal('binding_denied')
        self._policy_current(birth)
        sample=self.clock();sample.check()
        if sample.now<birth.armed_at:raise Refusal('clock_unhealthy')
        self._check();self._record(birth)
        owners=tuple(self.owners());self._check();self._record(birth)
        if not same_identities(birth.source_owners,owners):raise Refusal('binding_denied')
        # SourceIdentity is a narrow source reader, not an admission callback.
        # Re-read after the last clock callback so a changed assignment/policy
        # cannot retain the result of an earlier comparison.
        self._policy_current(birth)
        return sample

    def arm(self,completed):
        self._check();completed=self.worker.claim_completion(completed,self)
        context,person,revision=completed.context,completed.person_id,completed.revision
        context.check();self._check()
        if context.epoch!=self.epoch or context.request.get('actor')['kind']!='human':raise Refusal('binding_denied')
        action=context.request.get('action');op=context.request.get('operation')
        if action not in {'users/create','users/update'} or op['request_schema_id']!='urn:wiskey:local-source-policy:'+action.replace('/',':') or op['request_schema_revision']!='3':raise Refusal('binding_denied')
        policy=self.normalize(thaw(context.parameters)['data'].get('access_timing_policy'));self._check()
        if policy is not None and type(policy) is not dict:raise Refusal('binding_denied')
        self.invalidate_person(person,revision)
        raw=self.identities.repository._state['users'][person]
        assigned=raw['assignments']
        if type(assigned) is not dict or len(assigned)>100:raise Refusal('binding_denied')
        stations=tuple(sorted(station for station,assignment in assigned.items() if assignment['enabled'] is True))
        if policy is None or policy.get('mode')=='native' or raw['active'] is False or not stations:return None
        if type(policy) is not dict or policy.get('mode')!='ha':raise Refusal('binding_denied')
        for station in stations:
            reference(station);self.identities.check_policy(person,revision,station,policy)
        sample=self.clock();sample.check();context.request.check_time(sample.now)
        delays=[self.delay(person,station) for station in stations];self._check()
        if any(type(delay) not in (float,int) or not math.isfinite(delay) or not 1<=delay<=300 for delay in delays):raise Refusal('binding_denied')
        delay=min(delays)
        parent=(context.epoch,context.request.get('operation_id'),person,revision,stations)
        pending_count=sum(record.cleanup[3]is None for record in self._creation.records.values())
        if parent in self._parents or pending_count>=self.limit or len(self._history)>=self.tombstones:raise Refusal('binding_denied')
        key=str(uuid4());birth=PolicyContinuation(key,Provenance.capture(context.request,context.epoch),context.parameters,person,revision,stations,freeze(policy),sample.now,sample.now+timedelta(seconds=delay),tuple(self.owners()))
        o=self._creation;handle=None;entry=_RenewalRecord(birth,self._birth_fields(birth),[None,None,False,None])
        o.records[key]=entry;o.parents.add(parent);o.history.add(key)
        try:
            self._live(birth);context.check()
            handle=self.schedule(delay,lambda:self.fire(key))
            stop=getattr(handle,'cancel',None)
            if callable(stop):entry.cleanup[:2]=[handle,stop]
            if inspect.isawaitable(handle):
                if inspect.iscoroutine(handle):handle.close()
                raise Refusal('binding_denied')
            if not callable(stop):raise Refusal('binding_denied')
            self._live(birth);context.check();self._check();self._record(birth)
            o.pending[key]=(birth,handle)
            for name,value in self._identifiers(context.request).items():o.ids[name].add(value)
            return key
        except BaseException:
            o.pending.pop(key,None);o.records.pop(key,None)
            SourcePolicyContinuations._stop_handle(entry)
            raise

    async def fire(self,key):
        self._check();o=self._creation;record=o.pending.get(key)
        if record is None:raise Refusal('unproven_duplicate')
        if type(record)is not tuple or len(record)!=2:raise Refusal('binding_denied')
        birth,handle=record;entry=self._record(birth)
        if birth.key!=key or entry.cleanup[0]is not handle:raise Refusal('binding_denied')
        o.pending.pop(key);task=asyncio.current_task();entry.cleanup[3]=task;o.inflight[key]=task;o.births[key]=birth
        marker=_owners.set(_owners.get()|{o.token})
        try:
            SourcePolicyContinuations._stop_handle(entry)
            raise_if_cancelling()
            sample=self._live(birth)
            if sample.now<birth.due_at:raise Refusal('binding_denied')
            context=await self.admit(birth);raise_if_cancelling();self._live(birth)
            if type(context) is not EngineContext:raise Refusal('binding_denied')
            context.check();self._live(birth);actual=Provenance.capture(context.request,context.epoch)
            names=('actor','target','action','grant','selection_revision','schema','epoch','channel')
            if any(getattr(actual,name)!=getattr(birth.origin,name) for name in names) or not same_parameters(context.parameters,birth.parameters):raise Refusal('binding_denied')
            identifiers=self._identifiers(context.request)
            if any(value in o.ids[name] for name,value in identifiers.items()):raise Refusal('unproven_duplicate')
            for name,value in identifiers.items():o.ids[name].add(value)
            def current(_):
                context.check();sample=self._live(birth);context.request.check_time(sample.now);return True
            scoped=EngineContext.scoped(context,current)
            resources=self.credential_resources
            if resources is None:return await scoped.wait(lambda:self.worker.enqueue(birth.person_id,birth.revision,scoped))
            credential_marker=_credential_scope.set(_CredentialScope(self,scoped,birth,task))
            try:
                resources.observe_policy_renewal(scoped,self)
                return await scoped.wait(lambda:self.worker.enqueue(birth.person_id,birth.revision,scoped))
            finally:
                resources.discard(scoped.request);_credential_scope.reset(credential_marker)
        finally:
            o.inflight.pop(key,None);o.births.pop(key,None);o.records.pop(key,None);_owners.reset(marker)

    def cancel(self,key):
        o=self._creation
        if key not in o.history and key not in o.records:return False
        o.cancelled.add(key);record=o.pending.pop(key,None);entry=o.records.get(key)
        if entry is not None:SourcePolicyContinuations._stop_handle(entry)
        task=entry.cleanup[3]if entry is not None else None
        if task is not None and task is not asyncio.current_task():task.cancel()
        if task is None:o.records.pop(key,None)
        return record is not None or entry is not None or task is not None

    def invalidate_person(self,person,revision):
        self._check();identity=self.identities.identity(person)
        if type(revision) is not int or identity.revision!=revision:raise Refusal('binding_denied')
        self._check();obsolete=set()
        for key,record in tuple(self._creation.records.items()):
            birth=record.birth;self._record(birth)
            if birth.person_id==person and birth.revision!=revision:obsolete.add(key)
        for key in obsolete:SourcePolicyContinuations.cancel(self,key)

    def owns_current(self):return self._creation.token in _owners.get()

    async def close(self):
        self.closed=True;failed=False
        o=self._creation
        for key in tuple(o.records):
            try:SourcePolicyContinuations.cancel(self,key)
            except Exception:failed=True
        if o.closing[0]is None:o.closing[0]=asyncio.create_task(SourcePolicyContinuations._join(self))
        closing=o.closing[0];self._closing=closing
        if self.owns_current():return
        cancelled=False
        while not closing.done():
            try:await asyncio.shield(closing)
            except asyncio.CancelledError:cancelled=True
        closing.result()
        if cancelled:raise asyncio.CancelledError
        if failed:raise Refusal('action_failed')

    async def _join(self):
        tasks={entry.cleanup[3]for entry in self._creation.records.values()if entry.cleanup[3]is not None}
        for task in tasks:task.cancel()
        if tasks:
            joined=asyncio.gather(*tasks,return_exceptions=True)
            while not joined.done():
                try:await asyncio.shield(joined)
                except asyncio.CancelledError:pass
