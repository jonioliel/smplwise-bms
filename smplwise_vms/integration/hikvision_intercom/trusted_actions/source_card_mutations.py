"""Typed internal card source, OFF without explicit local candidate composition.

Only trusted admitted preparers introduce private RAM data. Existing cards are
carried by public IDs/labels/enabled metadata as in the frozen dispatch branch.
Original build/repository validators handle private conversion and collisions.
No capture fallback, broad person serializer, card value digest or new wire key.
"""
from .source_bindings import same_ports,same_identities
from .source_commit_guard import source_commit

from dataclasses import dataclass,field
from types import MethodType
from asyncio import CancelledError
from .adapters import EngineContext
from .card_receiver import BoundCardEdit
from .envelope import freeze, thaw
from .jobs import same_parameters
from .source_inputs import MemorySourceInputs
from .source_preparer import AdmittedSourcePreparer
from .validation import Refusal


def _same(a,b):
    if a is b:return True
    return a.__self__ is b.__self__ and a.__func__ is b.__func__ if type(a) is MethodType and type(b) is MethodType else a is b


@dataclass(frozen=True, repr=False)
class _CardWork:
    context: object
    ticket: object
    patch: object
    previous: object
    owners: tuple
    configuration_revision: int|None
    _binding:tuple=field(init=False,repr=False)
    _ticket_binding:tuple=field(init=False,repr=False)

    def __post_init__(self):
        object.__setattr__(self,'_binding',(self.context,self.ticket,self.patch,self.previous,self.owners,self.configuration_revision))
        object.__setattr__(self,'_ticket_binding',self.ticket_fields())

    def ticket_fields(self):
        ticket=self.ticket
        return (ticket.descriptor,ticket.epoch,ticket.person_id,ticket.person_revision,ticket.managed_card,ticket.card_id)

    def check_binding(self):
        if not same_identities(self._binding,(self.context,self.ticket,self.patch,self.previous,self.owners,self.configuration_revision)) or not same_identities(self._ticket_binding,self.ticket_fields()):raise Refusal('binding_denied')


class SourceCardMutations:
    def __init__(self, *, repository, build_user, validate, managed_card_type, now,
                 audit_scope, enqueue, changed, private_inputs=None, private_preparer=None, retirement_births=None, credential_resources=None, limit=128,configuration=None):
        if repository is None or not isinstance(managed_card_type,type) or not all(callable(p) for p in (build_user,validate,now,audit_scope,enqueue,changed)) or type(limit) is not int or not 1 <= limit <= 4096:
            raise ValueError('explicit card source dependencies required')
        if private_inputs is not None and type(private_inputs) is not MemorySourceInputs:raise ValueError('explicit private memory carrier required')
        if private_preparer is not None and (type(private_preparer) is not AdmittedSourcePreparer or private_preparer.inputs is not private_inputs):raise ValueError('same admitted card preparer required')
        self.repository,self.build_user,self.validate,self.card_type=repository,build_user,validate,managed_card_type
        if configuration is not None:
            from .source_configuration import SourceConfigurationRevision
            if type(configuration) is not SourceConfigurationRevision or configuration.repository is not repository:raise ValueError('same source configuration revision required')
        self.configuration=configuration
        self.now,self.audit_scope,self.enqueue,self.changed=now,audit_scope,enqueue,changed
        self.inputs,self.preparer=private_inputs,private_preparer
        if retirement_births is not None:
            from .retirement import RetirementBirths
            if type(retirement_births) is not RetirementBirths:raise ValueError('sealed retirement source required')
        self.retirement_births=retirement_births;self._retired={}
        if credential_resources is not None:
            from .source_credentials import SourceCredentialResources, _same
            if type(credential_resources) is not SourceCredentialResources or not _same(credential_resources.current_user,repository.get):raise ValueError('same source credential repository required')
        self.credential_resources=credential_resources
        self._cleanup_resources=tuple((owner,type(owner).close) for owner in (private_inputs,credential_resources,retirement_births) if owner is not None)
        self._cleanup_admitted=False
        self.limit=limit;self.closed=False;self._used=set();self._work={};self._scopes={}
        self._scope_maps=(self._used,self._work,self._scopes,self._retired)
        self._owned_scope_maps=self._scope_maps
        self._creation_scope=(limit,self._scope_maps)
        self._creation_cleanup=[self._cleanup_resources,False,False]

    def _maps_current(self):
        limit,maps=self._creation_scope
        return (not self._creation_cleanup[2] and type(self.closed)is bool and not self.closed and type(self.limit)is int and self.limit==limit
            and self._scope_maps is maps and self._owned_scope_maps is maps
            and same_identities(maps,(self._used,self._work,self._scopes,self._retired))
            and self._cleanup_resources is self._creation_cleanup[0]
            and type(self._cleanup_admitted)is bool and self._cleanup_admitted is self._creation_cleanup[1])

    def _owners(self):
        return (self.repository,self.build_user,self.validate,self.card_type,self.now,self.audit_scope,self.enqueue,self.changed,
            self.inputs,self.preparer,getattr(self.repository,'get',None),getattr(self.repository,'permission_data',None),getattr(self.repository,'async_update',None),getattr(self.repository,'_save',None),getattr(self.repository,'_lock',None),self.retirement_births,self.credential_resources,self.configuration,getattr(self.configuration,'repository',None),getattr(self.configuration,'current',None))

    def _check(self,context,owners,configuration_revision=None):
        if not self._maps_current() or not same_ports(owners,self._owners()):raise Refusal('binding_denied')
        context.check()
        if not self._maps_current() or not same_ports(owners,self._owners()):raise Refusal('binding_denied')
        if self.configuration is not None and self.configuration.current()!=configuration_revision:raise Refusal('binding_denied')
        # Configuration is another source callback. It may not replace the
        # original private scope or ports after the last ownership comparison.
        if not self._maps_current() or not same_ports(owners,self._owners()):raise Refusal('binding_denied')

    def _work_for(self,context,ticket):
        if not self._maps_current():raise Refusal('binding_denied')
        work=self._owned_scope_maps[1].get(context.request.get('operation_binding_ref'))
        scope=self._owned_scope_maps[2].get(id(context))
        if (type(work) is not _CardWork or work.context is not context or work.ticket is not ticket
            or type(scope) is not tuple or len(scope)!=7 or scope[0] is not context or scope[6] is not work):raise Refusal('binding_denied')
        work.check_binding();return work

    async def resolve(self,action,params,context):
        if type(context) is not EngineContext or action not in {'cards/add','cards/remove'} or action!=context.request.get('action') or params is not context.parameters and not same_parameters(params,context.parameters):raise Refusal('binding_denied')
        if not self._maps_current():raise Refusal('binding_denied')
        if action=='cards/add' and (type(self.inputs) is not MemorySourceInputs or type(self.preparer) is not AdmittedSourcePreparer or self.preparer.inputs is not self.inputs):raise Refusal('binding_denied')
        context.check();key=context.request.get('operation_binding_ref');owners=self._owners()
        used,work,scopes,retired=self._creation_scope[1]
        if self.closed or not self._maps_current() or key in used or len(used)>=self.limit:raise Refusal('binding_denied')
        if context.request.get('actor')['kind']!='human':raise Refusal('binding_denied')
        if not self._cleanup_admitted:
            from .source_bindings import retain_cleanup_owners
            self._cleanup_resources=retain_cleanup_owners(self._cleanup_resources,(self.inputs,self.credential_resources,self.retirement_births))
            self._cleanup_admitted=True
            self._creation_cleanup[:2]=[self._cleanup_resources,True]
        used.add(key);repo,build,validate,card_type,now,*_=owners
        scope=(context,self.inputs,self.preparer,context.request,self.credential_resources,self.retirement_births)
        scopes[id(context)]=scope
        try:
            configuration_revision=self.configuration.current() if self.configuration is not None else None
            previous=repo.get(params['user_id']);self._check(context,owners,configuration_revision)
            if previous.id!=params['user_id'] or type(previous.revision) is not int or previous.revision!=params['revision']:raise Refusal('binding_denied')
            cards=[{'id':c.id,'label':c.label,'enabled':c.enabled} for c in previous.cards]
            if action=='cards/add':
                if self.inputs is None or self.preparer is None:raise Refusal('binding_denied')
                self.preparer.issue(context);self._check(context,owners,configuration_revision)
                payload=self.inputs.consume(context);self._check(context,owners,configuration_revision)
                if type(payload) is not dict or set(payload)!={'cards'} or type(payload['cards']) is not list or len(payload['cards'])!=1:raise Refusal('invalid_fields')
                raw=payload['cards'][0]
                if type(raw) is not dict or 'card_no' not in raw or not set(raw)<={'card_no','card_type','label','enabled'}:raise Refusal('invalid_fields')
                candidate=build(repo.permission_data({'cards':[*cards,raw]},previous),previous=previous,employee_no=previous.employee_no,now=now())
                self._check(context,owners,configuration_revision);validate(candidate);self._check(context,owners,configuration_revision)
                new=[c for c in candidate.cards if c.id not in {v['id'] for v in cards}]
                if len(new)!=1 or type(new[0]) is not card_type:raise Refusal('binding_denied')
                card=new[0]
                # Its ID is generated by source, never supplied by the caller.
                patch={'cards':[*cards,{**raw,'id':card.id}]}
                payload=raw=None
            else:
                matches=[c for c in previous.cards if c.id==params['card_id']]
                if len(matches)!=1:raise Refusal('invalid_fields')
                card=matches[0];patch={'cards':[v for v in cards if v['id']!=params['card_id']]}
                candidate=build(repo.permission_data(patch,previous),previous=previous,employee_no=previous.employee_no,now=now())
                self._check(context,owners,configuration_revision);validate(candidate);self._check(context,owners,configuration_revision)
            ticket=BoundCardEdit(context.request.descriptor,context.epoch,previous.id,previous.revision,card)
            record=_CardWork(context,ticket,freeze(patch),previous,owners,configuration_revision)
            if scopes.get(id(context)) is not scope:raise Refusal('binding_denied')
            # Publish the independent scope anchor before any callback can
            # observe this work. No value/permission/result is fingerprinted.
            scopes[id(context)]=(*scope,record);work[key]=record
            self._check(context,owners,configuration_revision);self._work_for(context,ticket);return ticket
        except BaseException:
            self.discard(context);raise

    async def apply(self,action,ticket,params,context):
        key=context.request.get('operation_binding_ref');work=self._work_for(context,ticket)
        admitted=context
        def current(_):
            self._check(admitted,work.owners,work.configuration_revision)
            if self._work_for(admitted,ticket) is not work:raise Refusal('binding_denied')
            return True
        context=EngineContext.scoped(admitted,current);context.trace=admitted.trace
        self._check(context,work.owners,work.configuration_revision);repo=work.owners[0]
        if type(repo.get(ticket.person_id).revision) is not int or repo.get(ticket.person_id).revision!=ticket.person_revision:raise Refusal('binding_denied')
        births=self.retirement_births
        before=births.snapshot('retired_cards',context) if births is not None else None
        def commit_current():current(None)
        with work.owners[5](context.request.get('actor')['user_id'],action),source_commit(repo,commit_current):
            patch=thaw(work.patch)
            user=await context.wait(lambda:repo.async_update(ticket.person_id,patch,expected_revision=ticket.person_revision))
        self._check(context,work.owners,work.configuration_revision)
        if user.id!=ticket.person_id or type(user.revision) is not int or user.revision!=ticket.person_revision+1:raise Refusal('binding_denied')
        if births is not None:self._creation_scope[1][3][key]=births.observe(context,'retired_cards',user.id,user.revision,before)
        if self.credential_resources is not None:self.credential_resources.observe(context,user.id,user.revision)
        self._check(context,work.owners,work.configuration_revision)
        await context.wait(lambda:work.owners[6](user.id,user.revision,context));self._check(context,work.owners,work.configuration_revision)
        work.owners[7]();self._check(context,work.owners,work.configuration_revision)

    async def public_result(self,ticket,context):
        work=self._work_for(context,ticket)
        def current():
            self._check(context,work.owners,work.configuration_revision)
            if self._work_for(context,ticket) is not work:raise Refusal('binding_denied')
        current();user=work.owners[0].get(ticket.person_id)
        result={k:getattr(user,k) for k in ('id','revision','display_name','valid_from','valid_until','group_ids')}
        current();return result

    def discard(self,context):
        # Cleanup is based on the original context identity even if admission
        # failed because its fields were replaced. One-use tombstones remain.
        used,work_items,scopes,retired=self._creation_scope[1]
        scope=scopes.pop(id(context),None)
        held=scope[6] if type(scope) is tuple and len(scope)==7 and scope[0] is context else None
        for key,work in tuple(work_items.items()):
            if work is held or type(work) is _CardWork and work.context is context:work_items.pop(key,None);retired.pop(key,None)
        if scope is not None and scope[0] is context:
            if scope[1] is not None:MemorySourceInputs.discard(scope[1],context)
            if scope[2] is not None:AdmittedSourcePreparer.discard(scope[2],scope[3])
            if scope[4] is not None:
                from .source_credentials import SourceCredentialResources
                SourceCredentialResources.discard(scope[4],scope[3])
            if scope[5] is not None:
                from .retirement import RetirementBirths
                RetirementBirths.discard(scope[5],scope[3])

    def close(self):
        held=self._creation_cleanup
        if held[2]:return
        held[2]=True
        self.closed=True
        maps=self._creation_scope[1]
        first=None
        for scope in tuple(maps[2].values()):
            try:SourceCardMutations.discard(self,scope[0])
            except (Exception,CancelledError) as error:
                if first is None:first=error
        for table in maps:table.clear()
        for owner,close in held[0]:
            try:close(owner)
            except (Exception,CancelledError) as error:
                if first is None:first=error
        if first is not None:raise first
