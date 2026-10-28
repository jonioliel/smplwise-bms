"""Explicit source creation ownership for OFF PG/photo descriptor candidates.

Only the injected source produces a private value. It hands that value to a
request-owned RAM retainer before its next await. Nothing here generates,
serializes, hashes, measures, logs or transports the value. This does not
invent a private Arx channel or make a descriptor a product capability.
"""
import asyncio
from .source_bindings import same_ports,same_identities

from contextvars import ContextVar
from dataclasses import dataclass
from types import MethodType
from uuid import uuid4
from .adapters import EngineContext
from .owned_resources import OwnedObject
from .sensitive_producers import OpaqueDescriptor,PersonMetadata,same_person
from .validation import Refusal,reference

_owners=ContextVar('wiskey_opaque_source_factory_owners',default=frozenset())
_EMPTY=object()


def _same(a,b):
    if a is b:return True
    return a.__self__ is b.__self__ and a.__func__ is b.__func__ if type(a) is MethodType and type(b) is MethodType else a is b


@dataclass(repr=False)
class _Entry:
    request:object
    context:object
    task:object
    private:object=_EMPTY


class SourceOpaqueFactory:
    def __init__(self,*,epoch,source,current_person,clock_sample,limit=128,tombstones=4096):
        if not all(callable(p) for p in (source,current_person,clock_sample)) or type(limit) is not int or type(tombstones) is not int or not 1<=limit<=128 or not limit<=tombstones<=65536:
            raise ValueError('explicit bounded opaque source dependencies required')
        self.epoch=reference(epoch);self.source,self.person,self.clock=source,current_person,clock_sample
        self.limit,self.tombstones=limit,tombstones;self._issuer=object();self._entries={};self._used=set();self._tasks={};self._closing=None;self.closed=False
        self._owned_maps=(self._entries,self._tasks,self._used);self._owned_issuer=self._issuer
        self._creation_maps=self._owned_maps
        self._creation_issuer=self._issuer
        self._creation_bounds=(self.epoch,limit,tombstones)

    def _ports(self):return self.epoch,self.source,self.person,self.clock,self.limit,self.tombstones

    def _retire(self,key,entry):
        entries=self._creation_maps[0]
        if entries.get(key) is entry:entries.pop(key,None)
        entry.private=_EMPTY

    def _maps_current(self):
        epoch,limit,tombstones=self._creation_bounds
        return (self.epoch==epoch and type(self.limit) is int and self.limit==limit
            and type(self.tombstones) is int and self.tombstones==tombstones
            and self._issuer is self._creation_issuer and self._owned_issuer is self._creation_issuer
            and self._owned_maps is self._creation_maps and same_identities(self._creation_maps,(self._entries,self._tasks,self._used)))

    async def open(self,action,opaque,context):
        if type(context) is not EngineContext or context.parameters is None or context.epoch!=self.epoch or context.request.get('action')!=action or action not in {'users/photo_get','users/pin_generate'} or context.request.get('actor')['kind']!='human':raise Refusal('binding_denied')
        context.check();key=context.request.get('operation_binding_ref');ports=self._ports()
        epoch,source,reader,clock,_,_=ports
        entries,tasks,used=self._creation_maps
        if self.closed or not self._maps_current() or key in used or len(used)>=self.tombstones or len(entries)>=self.limit:raise Refusal('binding_denied')
        request,task=context.request,asyncio.current_task()
        used.add(key);entry=_Entry(request,context,task);entries[key]=entry;tasks[key]=task
        marker=_owners.set(_owners.get()|{self._creation_issuer});transferred=False;person=_EMPTY
        def check_metadata():
            if self.closed or not self._maps_current() or entries.get(key) is not entry or entry.request is not request or entry.context is not context or entry.task is not task or not same_ports(ports,self._ports()):raise Refusal('binding_denied')
        def current(_=None):
            context.check();check_metadata()
            if person is not _EMPTY and not same_person(reader(request),person):raise Refusal('binding_denied')
            sample=clock();sample.check();request.check_time(sample.now);context.check()
            # Person, clock and authority callbacks may replace an entry or a
            # port. Recheck before delegating/retaining a private source value.
            check_metadata()
            return True
        scoped=EngineContext.scoped(context,current)
        def retain(private):
            # Record ownership before the post-creation check. A refusal after
            # this point cannot orphan the private object or clear another one.
            current()
            # The creation task is the admitted local owner. A rewritten entry
            # field cannot delegate retention to an inherited child task.
            if asyncio.current_task() is not task or entry.private is not _EMPTY:raise Refusal('binding_denied')
            entry.private=private;current()
        try:
            current();person=reader(request);current()
            if person is None:
                if action!='users/pin_generate' or context.parameters.get('user_id')!='':raise Refusal('binding_denied')
            elif not same_person(person,person) or person.person_id!=context.parameters.get('user_id'):raise Refusal('binding_denied')
            result=await scoped.wait(lambda:source(action,opaque,scoped,retain))
            current()
            if result is not None or entry.private is _EMPTY or not same_person(reader(request),person):raise Refusal('binding_denied')
            context.check();check_metadata()
            descriptor=OpaqueDescriptor(request.get('request_id'),epoch,'pin' if action=='users/pin_generate' else 'photo',str(uuid4()),person,request.get('request_expires_at'))
            async def cleanup():self._retire(key,entry)
            transferred=True;return OwnedObject(descriptor,cleanup)
        finally:
            if not transferred:self._retire(key,entry)
            tasks.pop(key,None);_owners.reset(marker)

    def owns_current(self):return self._creation_issuer in _owners.get()

    async def close(self):
        self.closed=True
        # Close must still reach a retained private value and its live source
        # task after the visible tracking snapshot has been replaced.
        for key,entry in tuple(self._creation_maps[0].items()):self._retire(key,entry)
        if self._closing is None:self._closing=asyncio.create_task(self._join())
        if SourceOpaqueFactory.owns_current(self):return
        cancelled=False
        while not self._closing.done():
            try:await asyncio.shield(self._closing)
            except asyncio.CancelledError:cancelled=True
        self._closing.result()
        if cancelled:raise asyncio.CancelledError

    async def _join(self):
        tasks=set(self._creation_maps[1].values())
        for task in tasks:task.cancel()
        if tasks:
            joining=asyncio.gather(*tasks,return_exceptions=True)
            while not joining.done():
                try:await asyncio.shield(joining)
                except asyncio.CancelledError:pass
