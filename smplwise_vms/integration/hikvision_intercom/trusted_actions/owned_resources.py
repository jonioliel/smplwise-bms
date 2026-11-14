"""One-operation opaque resources with an exact-scope joining shutdown barrier.

Creation and captured cleanup are joined even after cancellation/revocation.
Only explicit injected factories run; no source/authority/result is cached.
Cleanup is not rollback, a receipt, or physical no-write proof.
"""
import asyncio
from contextvars import ContextVar
from dataclasses import dataclass

from .adapters import EngineContext
from .validation import Refusal,reference

_resource_owners=ContextVar('wiskey_resource_owners',default=frozenset())


@dataclass(frozen=True,repr=False)
class OwnedObject:
    value:object
    close:object


@dataclass(frozen=True,repr=False)
class _Entry:
    owner:object
    finished:object
    state:object


class OwnedResources:
    def __init__(self,*,epoch,limit=128,tombstones=4096):
        if type(limit)is not int or type(tombstones)is not int or not 1<=limit<=128 or not limit<=tombstones<=65536:
            raise ValueError('bounded resource capacities required')
        self.epoch=reference(epoch);self.limit,self.tombstones=limit,tombstones
        self.closed=False;self._active={};self._used=set();self._owner=object();self._closing=None
        self._owned_active,self._owned_used,self._owned_owner=self._active,self._used,self._owner
        self._creation=(self.epoch,limit,tombstones,self._active,self._used,self._owner)

    def _check_owner(self):
        epoch,limit,tombstones,active,used,owner=self._creation
        if (type(self.closed)is not bool or self.closed or type(self.epoch)is not str or self.epoch!=epoch
            or type(self.limit)is not int or self.limit!=limit or type(self.tombstones)is not int or self.tombstones!=tombstones
            or self._active is not active or self._owned_active is not active
            or self._used is not used or self._owned_used is not used
            or self._owner is not owner or self._owned_owner is not owner):raise Refusal('binding_denied')

    async def run(self,context,factory,receiver):
        self._check_owner()
        if type(context)is not EngineContext or context.epoch!=self.epoch or context.parameters is None or not callable(factory)or not callable(receiver):raise Refusal('binding_denied')
        context.check();key=context.request.get('operation_binding_ref')
        self._check_owner()
        epoch,limit,tombstones,active,used,owner_token=self._creation
        if key in used or len(used)>=tombstones or len(active)>=limit:raise Refusal('binding_denied')
        used.add(key);owner=asyncio.current_task();finished=asyncio.get_running_loop().create_future()
        state={'item':None,'cleanup':None,'creation':None,'value':None,'stop':None}
        entry=_Entry(owner,finished,state);active[key]=entry
        marker=_resource_owners.set(_resource_owners.get()|{owner_token})
        def current(_):
            context.check()
            self._check_owner()
            if (active.get(key)is not entry
                or entry.owner is not owner or entry.finished is not finished or entry.state is not state or finished.done()):raise Refusal('binding_denied')
            item=state['item']
            if item is not None and (item.value is not state['value'] or item.close is not state['stop']):raise Refusal('binding_denied')
            return True
        scoped=EngineContext.scoped(context,current)
        async def create():
            scoped.check();item=await factory(scoped)
            # Capture the original owner before any post-await refusal. A
            # replacement of the frozen handoff cannot redirect its cleanup.
            if type(item)is OwnedObject and callable(item.close):
                state['item'],state['value'],state['stop']=item,item.value,item.close
            scoped.check()
            if state['item']is None:raise Refusal('binding_denied')
            return item
        try:
            scoped.check();state['creation']=asyncio.create_task(create())
            item=await asyncio.shield(state['creation']);scoped.check()
            result=await scoped.wait(lambda:receiver(state['value'],scoped))
            scoped.check();return result
        finally:
            cancelled=False;creation=state['creation']
            if creation is not None:
                joining=asyncio.gather(creation,return_exceptions=True)
                while not joining.done():
                    try:await asyncio.shield(joining)
                    except asyncio.CancelledError:cancelled=True
            stop=state['stop']
            if stop is not None:
                async def cleanup():
                    try:await stop()
                    except Exception:raise Refusal('action_failed')from None
                state['cleanup']=asyncio.create_task(cleanup())
                cleaning=asyncio.gather(state['cleanup'],return_exceptions=True)
                while not cleaning.done():
                    try:await asyncio.shield(cleaning)
                    except asyncio.CancelledError:cancelled=True
                failed=isinstance(cleaning.result()[0],BaseException)
            else:failed=False
            if active.get(key)is entry:active.pop(key)
            state.clear();_resource_owners.reset(marker)
            if not finished.done():finished.set_result(None)
            if cancelled:raise asyncio.CancelledError
            if failed:raise Refusal('action_failed')from None

    def owns_current(self):return self._creation[5] in _resource_owners.get()

    async def close(self):
        self.closed=True
        if self._closing is None:self._closing=asyncio.create_task(self._join())
        if self.owns_current():return
        cancelled=False
        while not self._closing.done():
            try:await asyncio.shield(self._closing)
            except asyncio.CancelledError:cancelled=True
        self._closing.result()
        if cancelled:raise asyncio.CancelledError

    async def _join(self):
        active,used=self._creation[3:5]
        entries=tuple(active.values());owners={entry.owner for entry in entries}
        for owner in owners:owner.cancel()
        if entries:
            # Join every exact resource scope including creation and cleanup.
            # A caller can continue outside run() and join this close without
            # creating a cycle with unrelated subsequent work in that task.
            joining=asyncio.gather(*(entry.finished for entry in entries),return_exceptions=True)
            while not joining.done():
                try:await asyncio.shield(joining)
                except asyncio.CancelledError:pass
        if active:raise Refusal('binding_denied')
        used.clear()
