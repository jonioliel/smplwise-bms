"""Typed managed-card receiver component; cards/add/remove stay PARTIAL/OFF.

The injected engine resolves an existing opaque parameter reference to its
exact managed-card type. This component never constructs, converts, reads or
serializes a card value. Actual source conversion/body/worker closure remains
required; a source-shaped lookalike object is not accepted.
"""
from dataclasses import dataclass,field
from types import MethodType

from .adapters import EngineContext,project_selected
from .envelope import freeze,thaw
from .jobs import same_parameters
from .source_bindings import same_identities
from .validation import Refusal,Schema


@dataclass(frozen=True,repr=False)
class BoundCardEdit:
    descriptor:object
    epoch:str
    person_id:str
    person_revision:int
    managed_card:object
    card_id:str=field(init=False)

    def __post_init__(self):
        # Capture the public identity when the resolver issues the ticket,
        # before its await returns. Never inspect a card value or serializer.
        identifier=getattr(self.managed_card,'id',None)
        Schema({'type':'string','format':'uuid'})(identifier)
        object.__setattr__(self,'card_id',identifier)


class ManagedCardReceiver:
    def __init__(self,*,managed_card_type,resolve,apply_source,public_result,row_schema,limit=128,source_receiver=None):
        if not isinstance(managed_card_type,type) or managed_card_type is object or not all(callable(v) for v in (resolve,apply_source,public_result)) or type(limit)is not int or not 1<=limit<=4096:raise ValueError('explicit typed managed-card source dependencies required')
        schema=Schema(row_schema);schema.require_closed(projection=True)
        if set(schema.definition.get('properties',{}))!={'id','revision','display_name','valid_from','valid_until','group_ids'}:raise ValueError('exact public person fields required')
        self.card_type,self.resolve,self.apply_source,self.public_result=managed_card_type,resolve,apply_source,public_result
        self._row=freeze(schema.definition);self.limit=limit;self.closed=False;self._used=set();self._parameters=set()
        if source_receiver is not None:
            from .source_card_mutations import SourceCardMutations
            if type(source_receiver) is not SourceCardMutations or source_receiver.card_type is not managed_card_type:raise ValueError('typed card source receiver required')
            for given,expected in ((resolve,source_receiver.resolve),(apply_source,source_receiver.apply),(public_result,source_receiver.public_result)):
                # User-defined equality is not evidence of source ownership.
                if type(given) is not MethodType or type(expected) is not MethodType or given.__self__ is not source_receiver or given.__func__ is not expected.__func__:
                    raise ValueError('card source callbacks differ')
        self.source_receiver=source_receiver
        self._creation=(self.card_type,source_receiver,self._row,limit,self._used,self._parameters)

    def _check_owner(self):
        card_type,source,row,limit,used,parameters=self._creation
        if (self.closed or self.card_type is not card_type or self.source_receiver is not source
            or self._row is not row or type(self.limit) is not int or self.limit!=limit
            or self._used is not used or self._parameters is not parameters):raise Refusal('binding_denied')

    def _owners(self):return (self.card_type,self.resolve,self.apply_source,self.public_result,self._row,self.limit,self.source_receiver)

    async def apply(self,action,params,context):
        if type(context)is not EngineContext or context.epoch is None or action not in {'cards/add','cards/remove'} or action!=context.request.get('action') or params is not context.parameters and not same_parameters(params,context.parameters):raise Refusal('binding_denied')
        params=context.parameters
        context.check();self._check_owner();Schema({'type':'string','format':'uuid'})(params.get('user_id'))
        if type(params.get('revision'))is not int or params['revision']<1:raise Refusal('binding_denied')
        key=context.request.get('operation_binding_ref')
        parameter=context.request.get('operation')['parameter_reference']
        if action=='cards/add' and context.request.get('operation')['parameter_transport']!='agreed_sensitive_opaque_reference':raise Refusal('binding_denied')
        if self.closed or key in self._used or parameter in self._parameters or len(self._used)>=self.limit:raise Refusal('binding_denied')
        self._used.add(key);self._parameters.add(parameter);owners=self._owners();card_type,resolve,apply_source,public_result,row_schema,_,source_receiver=owners
        held=None
        def current(_):
            context.check();self._check_owner()
            if self.closed or not same_identities(owners,self._owners()):raise Refusal('binding_denied')
            if held is not None:
                ticket,card_id=held
                if ticket.descriptor!=context.request.descriptor or type(ticket.managed_card)is not card_type or type(ticket.managed_card.id)is not str or ticket.managed_card.id!=card_id:raise Refusal('binding_denied')
            return True
        scoped=EngineContext.scoped(context,current)
        try:
            ticket=await scoped.wait(lambda:resolve(action,params,scoped))
            if type(ticket)is not BoundCardEdit or ticket.descriptor!=context.request.descriptor or ticket.epoch!=context.epoch or ticket.person_id!=params['user_id'] or type(ticket.person_revision)is not int or ticket.person_revision!=params['revision'] or type(ticket.managed_card)is not card_type:raise Refusal('binding_denied')
            # ID is public metadata. No card_no/value/private/public method is read.
            card_id=ticket.card_id;Schema({'type':'string','format':'uuid'})(card_id)
            if type(ticket.managed_card.id)is not str or ticket.managed_card.id!=card_id:raise Refusal('binding_denied')
            held=(ticket,card_id)
            if action=='cards/remove' and card_id!=params.get('card_id'):raise Refusal('binding_denied')
            current(None)
            await scoped.wait(lambda:apply_source(action,ticket,params,scoped))
            if ticket.managed_card.id!=card_id:raise Refusal('binding_denied')
            raw=await scoped.wait(lambda:public_result(ticket,scoped))
            schema=object.__new__(Schema);schema.definition=thaw(row_schema);schema.resources={}
            result=project_selected(raw,schema.definition);schema(result)
            if result['id']!=ticket.person_id or type(result['revision'])is not int or result['revision']!=ticket.person_revision+1:raise Refusal('binding_denied')
            current(None);return result
        finally:
            if source_receiver is not None:
                from .source_card_mutations import SourceCardMutations
                SourceCardMutations.discard(source_receiver,scoped)

    def close(self):
        self.closed=True
        _,source,_,_,used,parameters=self._creation
        used.clear();parameters.clear()
        if source is not None:
            from .source_card_mutations import SourceCardMutations
            SourceCardMutations.close(source)
