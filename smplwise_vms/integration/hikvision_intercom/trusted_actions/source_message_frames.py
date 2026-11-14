"""Owned private preview frames for the injected OFF source messaging path.

Private source tokens/messages/recipients stay in RAM, never in public tickets,
errors, hashes, lengths, audit or artifacts. Cache400/TTL600 remain source
mechanisms, not quotas or consent. A frame carries no sending authority.
"""
import asyncio
from .source_bindings import same_identities

from contextlib import contextmanager
from contextvars import ContextVar
from dataclasses import dataclass
from datetime import timedelta
from uuid import uuid4
from .adapters import EngineContext
from .envelope import freeze,thaw
from .jobs import same_parameters
from .validation import Refusal
from .lifetime import raise_if_cancelling

_capture=ContextVar('wiskey_private_source_preview_capture',default=None)
_owners=ContextVar('wiskey_private_source_preview_owners',default=frozenset())
_consumption=ContextVar('wiskey_private_source_preview_consumption',default=None)


@dataclass(frozen=True,repr=False)
class _Scope:
    issuer:object
    context:object
    task:object


@dataclass(frozen=True,repr=False)
class _Consumption:
    cache:object
    context:object
    task:object
    check:object


class OwnedPreviewCache(dict):
    """Original source dict interface, with per-creation ownership metadata."""
    __slots__=('_issuer','_issued','closed','_owned_issuer','_owned_issued','_creation_identity')
    def __init__(self):
        super().__init__();self._issuer=object();self._issued={};self.closed=False
        self._owned_issuer,self._owned_issued=self._issuer,self._issued
        self._creation_identity=(self._issuer,self._issued)

    def check_owner(self):
        issuer,issued=self._creation_identity
        if self.closed or self._issuer is not issuer or self._owned_issuer is not issuer or self._issued is not issued or self._owned_issued is not issued:raise Refusal('binding_denied')

    def __repr__(self):return '<OwnedPreviewCache private>'
    __str__=__repr__

    @contextmanager
    def capture(self,context):
        self.check_owner()
        if type(context) is not EngineContext or context.request.get('action')!='whatsapp/preview':raise Refusal('binding_denied')
        context.check();self.check_owner();scope=_Scope(self._creation_identity[0],context,asyncio.current_task());marker=_capture.set(scope)
        try:yield scope
        finally:_capture.reset(marker)

    def __setitem__(self,key,value):
        self.check_owner()
        scope=_capture.get()
        if self.closed or type(scope) is not _Scope or scope.issuer is not self._issuer or scope.task is not asyncio.current_task():raise Refusal('binding_denied')
        scope.context.check();self.check_owner()
        if key in self:raise Refusal('unproven_duplicate')
        super().__setitem__(key,value);self._creation_identity[1][key]=scope
        scope.context.check();self.check_owner()

    def __delitem__(self,key):
        self.check_owner();super().__delitem__(key);self._creation_identity[1].pop(key,None)

    def pop(self,key,*default):
        scope=_consumption.get()
        if scope is not None:
            if type(scope) is not _Consumption or scope.cache is not self or scope.task is not asyncio.current_task():raise Refusal('binding_denied')
            scope.context.check();scope.check();raise_if_cancelling()
        self.check_owner();value=super().pop(key,*default);self._creation_identity[1].pop(key,None);return value

    @contextmanager
    def source_consumption(self,context,check):
        """Fresh source-owner check at the original dispatcher's consume step.

        The scope carries no authority/result and cannot be inherited by a
        child task to consume another request's private source entry.
        """
        self.check_owner()
        if type(context) is not EngineContext or context.request.get('action')!='whatsapp/send' or not callable(check) or _consumption.get() is not None:raise Refusal('binding_denied')
        scope=_Consumption(self,context,asyncio.current_task(),check);marker=_consumption.set(scope)
        try:yield
        finally:_consumption.reset(marker)

    def discard(self,scope):
        issuer,issued=self._creation_identity
        if type(scope) is not _Scope or scope.issuer is not issuer:return
        for key,owner in tuple(issued.items()):
            if owner is scope:super().pop(key,None);issued.pop(key,None)

    def check_created(self,key,scope):
        self.check_owner()
        if (self.closed or type(key) is not str or type(scope) is not _Scope
            or scope.issuer is not self._issuer or scope.task is not asyncio.current_task()
            or _capture.get() is not scope or self._issued.get(key) is not scope
            or key not in self):raise Refusal('binding_denied')
        scope.context.check();self.check_owner()

    def close(self):
        self.closed=True
        for scope in tuple(self._creation_identity[1].values()):OwnedPreviewCache.discard(self,scope)


@dataclass(frozen=True,repr=False)
class MessagePreview:
    issuer:object
    reference:str


@dataclass(frozen=True,repr=False)
class _Frame:
    ticket:MessagePreview
    scope:object
    request:object
    parameters:object
    epoch:str
    expires:object
    private:object


class SourceMessageFrames:
    def __init__(self,*,epoch,cache,prepare_source,send_source,clock_sample,limit=128,tombstones=4096):
        if type(cache) is not OwnedPreviewCache or not all(callable(p) for p in (prepare_source,send_source,clock_sample)) or type(limit) is not int or type(tombstones) is not int or not 1<=limit<=128 or not limit<=tombstones<=65536:
            raise ValueError('explicit bounded private source ports required')
        self.epoch,self.cache,self.preparer,self.sender,self.clock=epoch,cache,prepare_source,send_source,clock_sample
        self.limit,self.tombstones=limit,tombstones;self.closed=False;self._issuer=object();self._items={};self._bindings={};self._tasks={};self._used=set();self._closing=None
        self._owned_maps=(self._items,self._bindings,self._tasks,self._used)
        self._creation_maps=self._owned_maps
        self._owned_cache,self._owned_issuer=cache,self._issuer
        self._creation_identity=(cache,self._issuer)
        # Admission snapshots may themselves be malformed. Cleanup retains
        # its exact original tables independently of those mutable attributes.
        self._bound=(epoch,cache,prepare_source,send_source,clock_sample,limit,tombstones,self._owned_maps,self._issuer)

    def _check_owner(self):
        cache,issuer=self._creation_identity
        if (self.closed or self._owned_cache is not cache or self._owned_issuer is not issuer
            or not same_identities(self._bound,(self.epoch,self.cache,self.preparer,self.sender,self.clock,self.limit,self.tombstones,self._owned_maps,self._issuer))
            or self.cache is not cache or self._issuer is not issuer
            or self._creation_maps is not self._owned_maps or not same_identities(self._creation_maps,(self._items,self._bindings,self._tasks,self._used))):raise Refusal('binding_denied')
        OwnedPreviewCache.check_owner(cache)

    def _check(self,context):
        context.check();self._check_owner()
        if context.epoch!=self.epoch:raise Refusal('binding_denied')
        sample=self.clock();sample.check();context.request.check_time(sample.now)
        # The clock/sample callbacks must not swap a source dependency before
        # preparation or dispatch. Cleanup still uses constructor roots.
        self._check_owner()
        return sample

    async def prepare(self,opaque,context):
        self._check(context)
        items,bindings,tasks,used=self._creation_maps
        cache,issuer=self._creation_identity
        if context.request.get('action')!='whatsapp/preview' or len(items)+len(tasks)>=self.limit or len(used)>=self.tombstones:raise Refusal('binding_denied')
        key=str(uuid4());used.add(key);tasks[key]=asyncio.current_task();marker=_owners.set(_owners.get()|{issuer});scope=None
        try:
            with cache.capture(context) as scope:
                value=await context.wait(lambda:self.preparer(opaque,context))
                # Capture the exact source value before the post-await check.
                if type(value) is not dict or set(value)!={'token','recipient','message','warnings'}:raise Refusal('binding_denied')
                cache.check_created(value['token'],scope)
                ticket=MessagePreview(issuer,key);sample=self.clock();sample.check()
                items[key]=_Frame(ticket,scope,context.request,context.parameters,context.epoch,sample.now+timedelta(seconds=600),freeze(value))
                self._check(context);return ticket
        except BaseException:
            items.pop(key,None)
            if scope is not None:cache.discard(scope)
            raise
        finally:tasks.pop(key,None);_owners.reset(marker)

    def bind(self,locator,ticket,context):
        self._check(context);item=self._item(ticket);bindings=self._creation_maps[1]
        if item.request is not context.request or item.epoch!=context.epoch or not same_parameters(item.parameters,context.parameters) or locator in bindings:raise Refusal('binding_denied')
        bindings[locator]=ticket

    def _item(self,ticket):
        if type(ticket) is not MessagePreview or ticket.issuer is not self._creation_identity[1]:raise Refusal('binding_denied')
        item=self._creation_maps[0].get(ticket.reference)
        if type(item) is not _Frame or item.ticket is not ticket:raise Refusal('binding_denied')
        return item

    async def send(self,opaque,locator,context):
        sample=self._check(context);items,bindings,tasks,used=self._creation_maps;ticket=bindings.get(locator);item=self._item(ticket)
        if context.request.get('action')!='whatsapp/send' or item.epoch!=context.epoch or item.request.get('actor')!=context.request.get('actor') or item.request.get('target')!=context.request.get('target') or any(item.parameters[k]!=context.parameters[k] for k in ('user_id','account')):raise Refusal('binding_denied')
        # A caller with a foreign binding cannot erase the actual owner's
        # preview. Once ownership matches, expiry/attempt consumes only ours.
        if sample.now>=item.expires:self.discard(ticket);raise Refusal('binding_denied')
        if bindings.pop(locator,None) is not ticket:raise Refusal('binding_denied')
        cache,issuer=self._creation_identity
        items.pop(ticket.reference);tasks[ticket.reference]=asyncio.current_task();marker=_owners.set(_owners.get()|{issuer})
        def current(_):self._check(context);return True
        scoped=EngineContext.scoped(context,current)
        try:return await scoped.wait(lambda:self.sender(opaque,thaw(item.private),scoped))
        finally:
            OwnedPreviewCache.discard(cache,item.scope);tasks.pop(ticket.reference,None);_owners.reset(marker)

    def discard(self,ticket):
        cache,issuer=self._creation_identity
        if type(ticket) is not MessagePreview or ticket.issuer is not issuer:return
        items,bindings,tasks,used=self._creation_maps;item=items.get(ticket.reference)
        if item is not None and item.ticket is ticket:
            items.pop(ticket.reference);OwnedPreviewCache.discard(cache,item.scope)
        for locator,held in tuple(bindings.items()):
            if held is ticket:bindings.pop(locator,None)

    def owns_current(self):return self._creation_identity[1] in _owners.get()

    async def close(self):
        self.closed=True;OwnedPreviewCache.close(self._creation_identity[0])
        for item in tuple(self._creation_maps[0].values()):SourceMessageFrames.discard(self,item.ticket)
        if self._closing is None:self._closing=asyncio.create_task(self._join())
        if SourceMessageFrames.owns_current(self):return
        cancelled=False
        while not self._closing.done():
            try:await asyncio.shield(self._closing)
            except asyncio.CancelledError:cancelled=True
        self._closing.result()
        if cancelled:raise asyncio.CancelledError

    async def _join(self):
        tasks=set(self._creation_maps[2].values())
        for task in tasks:task.cancel()
        if tasks:
            joining=asyncio.gather(*tasks,return_exceptions=True)
            while not joining.done():
                try:await asyncio.shield(joining)
                except asyncio.CancelledError:pass
