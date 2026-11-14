"""Opaque PG/photo control-plane candidates; selected actions stay PARTIAL_OFF.

Only metadata descriptors are projected. No PIN generator, photo decoder,
binary, URL, message, credential or content digest is read. Injected factories
still require source closure; a fake descriptor is not proof of that source.
"""
from dataclasses import dataclass
from uuid import UUID

from .adapters import EngineContext,closed
from .envelope import thaw
from .jobs import same_parameters
from .owned_resources import OwnedResources
from .sensitive import SensitiveReferences
from .validation import Refusal,Schema,aware


@dataclass(frozen=True,repr=False)
class PersonMetadata:
    person_id:str
    revision:int


def same_person(left,right):
    if left is None or right is None:return left is None and right is None
    return (type(left) is PersonMetadata and type(right) is PersonMetadata and type(left.person_id) is str and type(right.person_id) is str and
        type(left.revision) is int and type(right.revision) is int and left.revision>0 and right.revision>0 and left.person_id==right.person_id and left.revision==right.revision)


@dataclass(frozen=True,repr=False)
class OpaqueDescriptor:
    request_id:str
    epoch:str
    kind:str
    reference:str
    person:object
    expires_at:str


DESCRIPTOR=closed({'kind':{'type':'string','enum':['photo','pin']},
    'reference':{'type':'string','format':'uuid'},
    'person_id':{'type':['string','null'],'format':'uuid'},
    'person_revision':{'type':['integer','null'],'minimum':1},
    'expires_at':{'type':'string','format':'date-time'}})
OPAQUE_RESULT=closed({'descriptor':DESCRIPTOR})


class OpaquePeople:
    def __init__(self,*,epoch,clock_sample,resources,current_person,open_source,source_factory=None):
        if type(resources)is not OwnedResources or resources.epoch!=epoch or not callable(current_person)or not callable(open_source):raise ValueError('explicit owned opaque source dependencies required')
        self.resources,self.current_person,self.open_source=resources,current_person,open_source
        if source_factory is not None:
            from .source_opaque_factory import SourceOpaqueFactory
            from types import MethodType
            if type(source_factory) is not SourceOpaqueFactory or type(open_source) is not MethodType or open_source.__self__ is not source_factory or open_source.__func__ is not SourceOpaqueFactory.open or source_factory.epoch!=epoch:raise ValueError('typed opaque source owner required')
        self.source_factory=source_factory;self._source_owner=source_factory
        self.references=SensitiveReferences(epoch=epoch,clock_sample=clock_sample,receivers={'users/pin_generate':self._receive})
        self._resource_owner,self._reference_owner=resources,self.references
        self.closed=False

    async def read(self,params,context):
        if type(context)is not EngineContext or not same_parameters(params,context.parameters):raise Refusal('binding_denied')
        if self.resources is not self._resource_owner or self.references is not self._reference_owner:
            SensitiveReferences.discard(self._reference_owner,context.request)
            raise Refusal('binding_denied')
        if context.request.get('action')=='users/pin_generate':return await self.references.transfer(context)
        if context.request.get('action')=='users/photo_get':return await self._receive(None,context)
        raise Refusal('unknown_action')

    async def _receive(self,opaque,context):
        action=context.request.get('action')
        if action not in {'users/pin_generate','users/photo_get'} or context.request.get('actor')['kind']!='human':raise Refusal('binding_denied')
        resources,reader,source,refs,factory_owner=self.resources,self.current_person,self.open_source,self.references,self.source_factory
        if resources is not self._resource_owner or refs is not self._reference_owner or factory_owner is not self._source_owner:raise Refusal('binding_denied')
        if factory_owner is not None:
            from .source_opaque_factory import SourceOpaqueFactory
            from types import MethodType
            if type(factory_owner) is not SourceOpaqueFactory or type(source) is not MethodType or source.__self__ is not factory_owner or source.__func__ is not SourceOpaqueFactory.open:raise Refusal('binding_denied')
        context.check();person=reader(context.request);context.check()
        person_id=context.parameters.get('user_id')
        if person_id=='':
            if action!='users/pin_generate'or person is not None:raise Refusal('binding_denied')
        elif type(person)is not PersonMetadata or person.person_id!=person_id or type(person.revision)is not int or person.revision<1:raise Refusal('binding_denied')
        else:Schema({'type':'string','format':'uuid'})(person.person_id)
        def current(_):
            context.check()
            if self.closed or self.resources is not resources or self.current_person is not reader or self.open_source is not source or self.references is not refs or self.source_factory is not factory_owner or not same_person(reader(context.request),person):raise Refusal('binding_denied')
            context.check();return True
        scoped=EngineContext.scoped(context,current)
        async def factory(owned):
            owned.check()
            # The pool captures a late result before testing revocation again.
            return await source(action,opaque,owned)
        async def project(value,owned):
            owned.check()
            if type(value)is not OpaqueDescriptor or value.request_id!=context.request.get('request_id')or value.epoch!=context.epoch or not same_person(value.person,person) or value.kind!=('pin'if action=='users/pin_generate'else'photo'):raise Refusal('binding_denied')
            if type(value.reference)is not str:raise Refusal('binding_denied')
            try:
                parsed=UUID(value.reference)
                if parsed.version!=4 or str(parsed)!=value.reference:raise ValueError
            except (ValueError,AttributeError):raise Refusal('binding_denied')from None
            expires=aware(value.expires_at)
            if expires>aware(context.request.get('request_expires_at')):raise Refusal('binding_denied')
            sample=refs.clock();sample.check()
            if sample.now>=expires:raise Refusal('binding_denied')
            result={'descriptor':{'kind':value.kind,'reference':value.reference,
                'person_id':None if person is None else person.person_id,'person_revision':None if person is None else person.revision,'expires_at':value.expires_at}}
            Schema(OPAQUE_RESULT)(result);owned.check();return result
        return await resources.run(scoped,factory,project)

    def owns_current(self):return self._resource_owner.owns_current() or self._source_owner is not None and self._source_owner.owns_current()
    async def close(self):
        self.closed=True;SensitiveReferences.close(self._reference_owner)
        if self._source_owner is not None:await self._source_owner.close()
        await OwnedResources.close(self._resource_owner)
