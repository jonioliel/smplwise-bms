"""Opaque messaging control-plane candidate, PARTIAL_OFF without source closure.

Arx supplies consent and owns its installation queue. No quota, rate estimate,
phone, message, provider API or resend exists here. Source cache capacity/TTL
are never interpreted as permission or rate authority. Preview locators bind
metadata only; sending always needs a fresh separate admitted operation.
"""
from .source_bindings import same_identities

from dataclasses import dataclass
from datetime import timedelta
from uuid import uuid4

from .adapters import EngineContext
from .jobs import same_parameters
from .owned_resources import OwnedResources
from .sensitive import SensitiveReferences
from .validation import Refusal,reference

_FRAME_UNBOUND=object()


@dataclass(frozen=True,repr=False)
class ConsentView:
    person_id:str
    person_revision:int
    account:str
    consent_revision:int
    permitted:bool
    queue_reference:str
    queue_revision:int


@dataclass(frozen=True,repr=False)
class QueueBinding:
    request_id:str
    operation_binding_ref:str
    epoch:str
    queue_reference:str
    queue_revision:int
    consent_revision:int


@dataclass(frozen=True,repr=False)
class MessageAcknowledgment:
    acknowledged:bool


@dataclass(frozen=True,repr=False)
class _Preview:
    actor:object
    target:object
    epoch:str
    person_id:str
    account:str
    consent:object
    expires:object
    source:object=None


def _consent_binding(view):
    # Revision/ownership binding metadata only, never a cached permitted result.
    return (view.person_revision,view.consent_revision,view.queue_reference,view.queue_revision)


class OpaqueMessaging:
    def __init__(self,*,epoch,clock_sample,resources,fresh_consent,prepare_preview,claim_queue,send_source,source_frames=None):
        if type(resources)is not OwnedResources or resources.epoch!=epoch or not all(callable(v)for v in (fresh_consent,prepare_preview,claim_queue,send_source)):
            raise ValueError('explicit source, consent and owned queue dependencies required')
        self.resources,self.fresh_consent,self.prepare_preview,self.claim_queue,self.send_source=resources,fresh_consent,prepare_preview,claim_queue,send_source
        self.source_frames=source_frames
        self._frame_owner=_FRAME_UNBOUND
        self.references=SensitiveReferences(epoch=epoch,clock_sample=clock_sample,receivers={'whatsapp/preview':self._receive,'whatsapp/send':self._receive})
        self._resource_owner,self._reference_owner=resources,self.references
        self._previews={};self._consumed=set();self.closed=False
        self._owned_previews,self._owned_consumed=self._previews,self._consumed
        self._creation_maps=(self._previews,self._consumed)

    async def read(self,params,context):
        if type(context)is not EngineContext or not same_parameters(params,context.parameters):raise Refusal('binding_denied')
        if (self.resources is not self._resource_owner or self.references is not self._reference_owner
            or self._frame_owner is not _FRAME_UNBOUND and self.source_frames is not self._frame_owner):
            SensitiveReferences.discard(self._reference_owner,context.request)
            raise Refusal('binding_denied')
        return await self.references.transfer(context)

    async def _receive(self,opaque,context):
        action=context.request.get('action');params=context.parameters
        if action not in {'whatsapp/preview','whatsapp/send'}:raise Refusal('binding_denied')
        owners=(self.resources,self.fresh_consent,self.prepare_preview,self.claim_queue,self.send_source,self.references,self.source_frames)
        resources,consent_provider,preview_source,claim,send,refs,frames=owners
        if resources is not self._resource_owner or refs is not self._reference_owner:raise Refusal('binding_denied')
        if self._frame_owner is not _FRAME_UNBOUND and frames is not self._frame_owner:raise Refusal('binding_denied')
        previews,consumed=self._creation_maps
        if frames is not None:
            from types import MethodType
            from .source_message_frames import SourceMessageFrames
            if type(frames) is not SourceMessageFrames:raise Refusal('binding_denied')
            for given,expected in ((preview_source,frames.prepare),(send,frames.send)):
                if type(given) is not MethodType or given.__self__ is not frames or given.__func__ is not expected.__func__:raise Refusal('binding_denied')
        def current(_=None):
            context.check()
            if self.closed or self._frame_owner is not _FRAME_UNBOUND and self._frame_owner is not frames or self._previews is not previews or self._owned_previews is not previews or self._consumed is not consumed or self._owned_consumed is not consumed or not same_identities(owners,(self.resources,self.fresh_consent,self.prepare_preview,self.claim_queue,self.send_source,self.references,self.source_frames)):raise Refusal('binding_denied')
            return True
        async def consent():
            current();value=await context.wait(lambda:consent_provider(context.request));current()
            if (type(value)is not ConsentView or type(value.permitted)is not bool or not value.permitted or value.person_id!=params['user_id']or value.account!=params['account']or
                any(type(v)is not int or v<1 for v in (value.person_revision,value.consent_revision,value.queue_revision))):raise Refusal('binding_denied')
            reference(value.queue_reference);return value
        current()
        # Fixtures/composition may assemble coherent typed source ports before
        # the first request. After first admission, cleanup belongs to that
        # exact frame owner even if the public dependency is later replaced.
        if self._frame_owner is _FRAME_UNBOUND:self._frame_owner=frames
        view=await consent()
        sample=refs.clock();sample.check();context.request.check_time(sample.now)
        for key,old in tuple(previews.items()):
            if sample.now>=old.expires:
                previews.pop(key)
                if frames is not None:SourceMessageFrames.discard(frames,old.source)
        if action=='whatsapp/preview':
            if len(previews)>=128:raise Refusal('binding_denied')
            ticket=await context.wait(lambda:preview_source(opaque,context));kept=False
            try:
                current()
                if await consent()!=view:raise Refusal('permissions_changed')
                sample=refs.clock();sample.check();context.request.check_time(sample.now);current()
                locator=str(uuid4());expires=sample.now+timedelta(seconds=600)
                if frames is not None:frames.bind(locator,ticket,context)
                previews[locator]=_Preview(context.request.get('actor'),context.request.get('target'),context.epoch,params['user_id'],params['account'],_consent_binding(view),expires,ticket)
                kept=True
                return {'preview_reference':locator,'consent_revision':view.consent_revision,'expires_at':expires.isoformat()}
            finally:
                if frames is not None and not kept:SourceMessageFrames.discard(frames,ticket)
        locator=params['preview_reference']
        # Consume before any queue admission; no failure restores a preview or
        # reuses a previous writing decision. A locator grants no authority.
        old=previews.get(locator)
        if old is not None and (old.actor!=context.request.get('actor') or old.target!=context.request.get('target') or old.epoch!=context.epoch or old.person_id!=params['user_id'] or old.account!=params['account']):raise Refusal('binding_denied')
        old=previews.pop(locator,None)
        if old is None:raise Refusal('binding_denied')
        if locator in consumed or len(consumed)>=4096:
            # This attempt already removed the public locator. Retire its
            # owned private source frame even when queue admission is denied
            # before the normal send/finally scope can begin.
            if frames is not None:SourceMessageFrames.discard(frames,old.source)
            raise Refusal('binding_denied')
        consumed.add(locator)
        scoped=EngineContext.scoped(context,current)
        async def factory(owned):return await claim(view,owned)
        async def dispatch(binding,owned):
            owned.check()
            if type(binding)is not QueueBinding or not same_parameters((binding.request_id,binding.operation_binding_ref,binding.epoch,binding.queue_reference,binding.queue_revision,binding.consent_revision),(context.request.get('request_id'),context.request.get('operation_binding_ref'),context.epoch,view.queue_reference,view.queue_revision,view.consent_revision)):raise Refusal('binding_denied')
            # Latest consent after the final queue await, immediately before
            # the source dispatch. Possible send with no result stays unknown.
            if await consent()!=view:raise Refusal('permissions_changed')
            owned.check();ack=await owned.wait(lambda:send(opaque,locator,owned));owned.check()
            if await consent()!=view:raise Refusal('permissions_changed')
            if type(ack)is not MessageAcknowledgment or ack.acknowledged is not True:raise Refusal('action_failed')
            return {'accepted':True}
        try:
            if old.consent!=_consent_binding(view) or sample.now>=old.expires or params['confirmed']is not True:raise Refusal('binding_denied')
            return await resources.run(scoped,factory,dispatch)
        finally:
            if frames is not None:SourceMessageFrames.discard(frames,old.source)

    def _lifetime_frames(self):
        from .source_message_frames import SourceMessageFrames
        frames=self.source_frames if self._frame_owner is _FRAME_UNBOUND else self._frame_owner
        return frames if type(frames) is SourceMessageFrames else None

    def owns_current(self):
        from .source_message_frames import SourceMessageFrames
        frames=self._lifetime_frames()
        return OwnedResources.owns_current(self._resource_owner) or frames is not None and SourceMessageFrames.owns_current(frames)

    async def close(self):
        from .source_message_frames import SourceMessageFrames
        frames=self._lifetime_frames()
        if self._frame_owner is _FRAME_UNBOUND:self._frame_owner=frames
        self.closed=True;SensitiveReferences.close(self._reference_owner)
        for owned in self._creation_maps:owned.clear()
        try:
            if frames is not None:await SourceMessageFrames.close(frames)
        finally:
            await OwnedResources.close(self._resource_owner)
