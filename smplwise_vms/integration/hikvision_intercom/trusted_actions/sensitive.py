"""One-use opaque software handoff; never generates or examines sensitive data.

Only an explicitly injected fake/trusted receiver can consume an item. No
source generator, classic preview, provider, photo decoder, transport or native
registration is imported. This is a component, not closure of a PG/WA/TTS/photo
adapter. No key, signature, content hash, value length or success cache exists.
"""
from dataclasses import dataclass

from .adapters import EngineContext
from .preparation_scope import opaque_owner
from .validation import Refusal,aware,reference


ACTIONS=frozenset({'users/pin_generate','users/photo_get','whatsapp/preview','whatsapp/send','tts/start'})


@dataclass(frozen=True,repr=False)
class _Item:
    descriptor:object
    epoch:str
    expires:object
    payload:object
    owner:object
    issuer:object


class SensitiveReferences:
    def __init__(self,*,epoch,clock_sample,receivers,limit=128,tombstone_limit=4096):
        if not callable(clock_sample) or type(receivers)is not dict or not receivers or not set(receivers)<=ACTIONS or not all(callable(v) for v in receivers.values()):raise ValueError('explicit clock and opaque receivers required')
        if type(limit)is not int or type(tombstone_limit)is not int or not 1<=limit<=128 or not limit<=tombstone_limit<=65536:raise ValueError('bounded references required')
        self.epoch=reference(epoch);self.clock=clock_sample;self.receivers=dict(receivers)
        self.limit,self.tombstone_limit=limit,tombstone_limit;self.closed=False;self._items={};self._used=set()
        self._issuer=object()
        self._creation_maps=(self._items,self._used)
        self._identity=(self.epoch,self.clock,self.receivers,tuple(self.receivers.items()),self.limit,self.tombstone_limit,self._issuer)

    def _integrity(self):
        epoch,clock,receivers,ports,limit,tombstones,issuer=self._identity
        items,used=self._creation_maps
        if (self.closed or self.epoch!=epoch or self.clock is not clock or self.receivers is not receivers
            or self._items is not items or self._used is not used or self._issuer is not issuer
            or type(self.limit) is not int or self.limit!=limit
            or type(self.tombstone_limit) is not int or self.tombstone_limit!=tombstones
            or len(receivers)!=len(ports) or any(receivers.get(action) is not receiver for action,receiver in ports)):
            raise Refusal('binding_denied')

    def _check(self,context):
        if type(context)is not EngineContext:raise Refusal('binding_denied')
        self._integrity()
        if context.epoch!=self.epoch:raise Refusal('binding_denied')
        context.check();self._integrity();request=context.request
        if request.get('action')not in self.receivers or request.get('operation')['parameter_transport']!='agreed_sensitive_opaque_reference':raise Refusal('binding_denied')
        if request.get('action')=='users/pin_generate' and request.get('actor')['kind']!='human':raise Refusal('binding_denied')
        clock=self.clock;sample=clock();sample.check();request.check_time(sample.now)
        context.check()
        self._integrity()
        return sample.now

    def issue(self,context,payload):
        now=self._check(context)
        items,used=self._creation_maps
        cleanup=opaque_owner(context.request)
        for key,item in tuple(items.items()):
            if type(item) is not _Item or item.issuer is not self._identity[6]:raise Refusal('binding_denied')
            if now>=item.expires:del items[key]
        key=reference(context.request.get('operation')['parameter_reference'])
        if key in used or len(used)>=self.tombstone_limit or len(items)>=self.limit:raise Refusal('binding_denied')
        used.add(key)
        item=_Item(context.request.descriptor,self.epoch,aware(context.request.get('request_expires_at')),payload,context.request,self._identity[6])
        items[key]=item
        if cleanup is not None:cleanup.append((items,key,item))

    async def transfer(self,context):
        # Only the matching admitted request can consume its item. Refusal of
        # that owner never restores authority; a foreign request cannot erase
        # another operation's private payload by guessing its locator.
        if type(context)is not EngineContext:raise Refusal('binding_denied')
        try:self._integrity()
        except Refusal:
            self.discard(context.request)
            raise
        items=self._creation_maps[0]
        key=reference(context.request.get('operation')['parameter_reference']);item=items.get(key)
        if type(item) is not _Item or item.issuer is not self._identity[6] or item.descriptor!=context.request.descriptor or item.epoch!=context.epoch:raise Refusal('binding_denied')
        items.pop(key)
        now=self._check(context)
        if item is None or item.descriptor!=context.request.descriptor or item.epoch!=context.epoch or now>=item.expires:raise Refusal('binding_denied')
        action=context.request.get('action');receiver=self.receivers[action];receivers=self.receivers;clock=self.clock;epoch=self.epoch
        def current(_):
            self._check(context)
            if self.receivers is not receivers or self.receivers.get(action)is not receiver or self.clock is not clock or self.epoch!=epoch:raise Refusal('binding_denied')
            return True
        scoped=EngineContext.scoped(context,current)
        result=await scoped.wait(lambda:receiver(item.payload,scoped))
        self._check(context)
        if self.receivers is not receivers or self.receivers.get(action)is not receiver or self.clock is not clock or self.epoch!=epoch:raise Refusal('binding_denied')
        return result

    def discard(self,request):
        items=self._creation_maps[0]
        key=request.get('operation')['parameter_reference'];item=items.get(key)
        if type(item) is _Item and item.issuer is self._identity[6] and (item.owner is request or item.descriptor==request.descriptor):items.pop(key,None)

    def close(self):
        self.closed=True
        items,used=self._creation_maps
        dict.clear(items);set.clear(used)
