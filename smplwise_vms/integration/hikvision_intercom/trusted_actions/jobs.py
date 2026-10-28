"""Explicit candidate derived-job hooks; never attach a classic shared worker.

A trusted host injects an admitted EngineContext for each effect. The provider
must perform actual existing verifier/Arx admission; no default or role fallback
exists here. These are local in-process hooks, not a new transport or endpoint.
"""
from collections.abc import Mapping
from dataclasses import dataclass
import asyncio
from contextvars import ContextVar
from .adapters import EngineContext
from .envelope import freeze,thaw,Request
from .validation import Refusal,reference
from .journal import Journal
from types import MappingProxyType

_job_owners=ContextVar('wiskey_derived_job_owners',default=frozenset())

# Repeated effects under one write parent are not a source-proven workflow.
# Named multi-stage/fanout derivations remain a separate unclosed frontier.
# A fresh request ID alone never authorizes retry of an uncertain write.
ONE_EFFECT_ACTIONS=frozenset({'stations/test_unlock','users/create','users/update','users/set_active',
    'users/delete','users/archive','users/unarchive','users/temporary_cancel','cards/add','cards/remove',
    'whatsapp/preview','whatsapp/send','tts/start','media/signal'})

@dataclass(frozen=True,repr=False)
class Provenance:
    parent_request_id:str
    parent_operation_id:str
    actor:object
    target:object
    action:str
    grant:object
    selection_revision:str
    schema:object
    epoch:str
    channel:str

    @classmethod
    def capture(cls,request,epoch):
        if type(request) is Request:
            # Reuse only parts of the same owned immutable envelope. This
            # neither evaluates nor caches the caller's current authority.
            grant,schema=request.binding_parts()
        else:
            op=request.get('operation')
            grant=freeze({k:request.get('grant')[k] for k in ('grant_id','grant_revision','permission_revision')})
            schema=freeze({**{k:op[k] for k in ('request_schema_id','request_schema_revision','parameter_transport','public_descriptor_revision')},
                'definition_revision':op.get('definition_revision'),'operation_scope':request.descriptor.get('operation_scope')})
        return cls(request.get('request_id'),request.get('operation_id'),request.get('actor'),request.get('target'),request.get('action'),
                   grant,request.get('selection_revision'),schema,epoch,request.get('channel'))

_JSON_SCALARS=frozenset({str,int,float,bool,type(None)})
_JSON_OBJECTS=frozenset({dict,MappingProxyType})
_JSON_ARRAYS=frozenset({list,tuple})


def same_parameters(left,right):
    """Fresh exact JSON-view comparison, without hashes or a value cache.

    Scalar leaves use exact types (True never equals integer1); complex or
    caller-defined mappings retain the recursive semantics of the old path.
    No validation, authority callback, effect boundary or assertion is skipped.
    """
    lk,rk=type(left),type(right)
    if lk in _JSON_SCALARS:return lk is rk and left==right
    if lk in _JSON_ARRAYS:
        if rk not in _JSON_ARRAYS or len(left)!=len(right):return False
        for a,b in zip(left,right):
            kind=type(a)
            if kind in _JSON_SCALARS:
                if type(b) is not kind or a!=b:return False
            elif not same_parameters(a,b):return False
        return True
    if lk in _JSON_OBJECTS and rk in _JSON_OBJECTS:
        if not left.keys()==right.keys():return False
        for key in left:
            a,b=left[key],right[key];kind=type(a)
            if kind in _JSON_SCALARS:
                if type(b) is not kind or a!=b:return False
            elif not same_parameters(a,b):return False
        return True
    left_object=isinstance(left,Mapping);right_object=isinstance(right,Mapping)
    if left_object or right_object:
        return left_object and right_object and left.keys()==right.keys() and all(same_parameters(left[k],right[k]) for k in left)
    if lk is not rk:return False
    return left==right

class DerivedJobs:
    def __init__(self,fresh_admission,*,journal,clock_sample,limit=128,max_effects_per_job=128):
        if not callable(fresh_admission) or type(journal)is not Journal or not callable(clock_sample) or type(limit)is not int or not 1<=limit<=1024:raise ValueError('explicit decision, journal, clock and bounded limit required')
        if type(max_effects_per_job)is not int or not 1<=max_effects_per_job<=1024:raise ValueError('bounded per-job admissions required')
        self._admit=fresh_admission;self._limit=limit;self._tasks={};self._used=set();self.closed=False
        self._journal,self._clock=journal,clock_sample
        self._max_effects=max_effects_per_job;self._closing=None;self._owner=object()
        self._write_origins=set()

    def start(self,key,parent,worker):
        reference(key)
        if self.closed or len(self._used)>=self._limit or key in self._used:raise Refusal('binding_denied')
        if type(parent)is not EngineContext or parent.parameters is None or parent.epoch is None or not callable(worker):raise Refusal('binding_denied')
        parent.check();origin=Provenance.capture(parent.request,parent.epoch);parameters=parent.parameters
        write_origin=(origin.epoch,parent.request.get('operation_binding_ref'))
        if origin.action in ONE_EFFECT_ACTIONS:
            if write_origin in self._write_origins:raise Refusal('unproven_duplicate')
            self._write_origins.add(write_origin)
        self._used.add(key)
        configured_maximum=self._max_effects
        maximum=1 if origin.action in ONE_EFFECT_ACTIONS else configured_maximum
        async def run_owned():
            used_requests={origin.parent_request_id};used_operations={origin.parent_operation_id}
            used_bindings={parent.request.get('operation_binding_ref')}
            used_parameters={parent.request.get('operation')['parameter_reference']}
            used_decisions={parent.request.get('decision')['decision_id']}
            attempts=0
            async def effect(factory):
                nonlocal attempts
                if self.closed or self._max_effects is not configured_maximum or attempts>=maximum:raise Refusal('binding_denied')
                attempts+=1
                provider,journal,clock=self._admit,self._journal,self._clock
                clock_provider=getattr(clock,'provider',None)
                context=await provider(origin)
                if self.closed or self._admit is not provider or self._journal is not journal or self._clock is not clock or getattr(clock,'provider',None)is not clock_provider or type(context)is not EngineContext:raise Refusal('binding_denied')
                context.check()
                if context.parameters is None or not same_parameters(parameters,context.parameters):raise Refusal('binding_denied')
                child=Provenance.capture(context.request,context.epoch)
                sample=clock();sample.check();context.request.check_time(sample.now)
                if (child.actor,child.target,child.action,child.grant,child.selection_revision,child.schema,child.epoch,child.channel)!=(origin.actor,origin.target,origin.action,origin.grant,origin.selection_revision,origin.schema,origin.epoch,origin.channel):raise Refusal('binding_denied')
                binding=context.request.get('operation_binding_ref');parameter=context.request.get('operation')['parameter_reference'];decision=context.request.get('decision')['decision_id']
                if child.parent_request_id in used_requests or child.parent_operation_id in used_operations or binding in used_bindings or parameter in used_parameters or decision in used_decisions:raise Refusal('unproven_duplicate')
                used_requests.add(child.parent_request_id);used_operations.add(child.parent_operation_id)
                used_bindings.add(binding);used_parameters.add(parameter);used_decisions.add(decision)
                def current(_):
                    if self.closed or self._admit is not provider or self._journal is not journal or self._clock is not clock or getattr(clock,'provider',None)is not clock_provider or self._max_effects is not configured_maximum:raise Refusal('binding_denied')
                    context.check()
                    if not same_parameters(parameters,context.parameters):raise Refusal('binding_denied')
                    current_sample=clock();current_sample.check();context.request.check_time(current_sample.now)
                    return True
                derived=EngineContext.scoped(context,current)
                derived.check()
                journal.reserve(child.parent_request_id,child.parent_operation_id,sample.now)
                try:return await derived.wait(lambda:factory(derived))
                finally:journal.finish(child.parent_request_id)
            return await worker(effect)
        async def run():
            marker=_job_owners.set(_job_owners.get() | {self._owner})
            try:return await run_owned()
            finally:_job_owners.reset(marker)
        task=asyncio.create_task(run());self._tasks[key]=task
        # Callers retain task outcomes, but no arbitrary exception reaches logs.
        def done(value):
            if self._tasks.get(key)is value:self._tasks.pop(key,None)
            if not value.cancelled():value.exception()
        task.add_done_callback(done);return task

    async def close(self):
        self.closed=True
        if self._closing is None:self._closing=asyncio.create_task(self._join())
        if self._owner in _job_owners.get():return
        cancelled=False
        while not self._closing.done():
            try:await asyncio.shield(self._closing)
            except asyncio.CancelledError:cancelled=True
        self._closing.result()
        if cancelled:raise asyncio.CancelledError

    def owns_current(self):
        """Explicit lifetime ownership predicate for an injected host owner."""
        return self._owner in _job_owners.get()

    async def _join(self):
        tasks=tuple(self._tasks.values())
        for task in tasks:task.cancel()
        if tasks:
            joining=asyncio.gather(*tasks,return_exceptions=True);cancelled=False
            while not joining.done():
                try:await asyncio.shield(joining)
                except asyncio.CancelledError:cancelled=True
            self._tasks.clear()
            if cancelled:raise asyncio.CancelledError
        self._used.clear()
        self._write_origins.clear()
