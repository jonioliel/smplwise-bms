"""OFF source deletion seam and private inventory resource ownership.

The original repository/engine methods are explicit injected source objects.
Public results acknowledge only local intent. Inventory values stay in RAM;
no value/length/hash, device transport, authority fallback or retry is exposed.
"""
from dataclasses import dataclass
from uuid import uuid4
from .adapters import EngineContext
from .envelope import thaw
from .jobs import Provenance,same_parameters
from .source_bindings import same_ports,same_identities
from .source_credentials import CredentialBirth
from .source_identity import SourceIdentities
from .validation import Refusal,Schema,reference


@dataclass(frozen=True,repr=False)
class _InventoryOwner:
    request:object
    parameters:object
    person:str
    revision:int
    station:str
    employee:object
    entries:object


class SourceDeletionResources:
    """Private source-GET births, fixed for this one deletion/station.

    Repeated observation may remove an already bound card; it may never adopt
    another private value as authority for a new resource or retry.
    """
    def __init__(self,context,person,revision,station,employee,inventory_type,current):
        if type(context)is not EngineContext or context.request.get('action')!='users/delete' or not callable(current) or not isinstance(inventory_type,type):raise ValueError('explicit deletion source required')
        if context.parameters.get('user_id')!=person or type(revision)is not int or type(context.parameters.get('revision'))is not int or context.parameters.get('revision')!=revision or type(employee)is not str:raise Refusal('binding_denied')
        self.parent,self.person,self.revision,self.station=context,person,revision,reference(station)
        self.employee,self.inventory_type,self.current=employee,inventory_type,current
        self._issuer=object();self._owner=None;self._owned_inventory=None;self._inventory_binding=None;self._used=set();self._owned_claims=self._used;self.closed=False
        self._ports=(context,person,revision,self.station,employee,inventory_type,current)
        # Cells permit releasing the original private employee/entry links at
        # close without adopting mutable public ownership aliases.
        self._creation=([self._ports],[None,None,{}],self._issuer,self._used)

    def _check_owner(self):
        ports,state,issuer,claims=self._creation
        if (type(self.closed)is not bool or self.closed or self._ports is not ports[0]or self._issuer is not issuer
            or self._owner is not state[0]or self._owned_inventory is not state[0]or self._inventory_binding is not state[1]
            or self._used is not claims or self._owned_claims is not claims
            or not same_ports(ports[0],(self.parent,self.person,self.revision,self.station,self.employee,self.inventory_type,self.current))):raise Refusal('binding_denied')
        if state[0]is not None:
            row=state[0]
            if not same_ports(state[1],(row.request,row.parameters,row.person,row.revision,row.station,row.employee,row.entries)):raise Refusal('binding_denied')

    def check(self):
        self._check_owner();ports=self._creation[0][0]
        ports[0].check();self._check_owner();ports[6]();self._check_owner()

    @staticmethod
    def _birth_fields(birth):
        return (birth.issuer,birth.request,birth.parent,birth.parameters,birth.person_id,birth.revision,
            birth.resource_id,birth.stations,birth.providers)

    def observe(self,inventory,employee):
        self.check()
        if type(inventory)is not self.inventory_type or type(inventory.cards)is not dict or type(employee)is not str or employee!=self.employee:raise Refusal('binding_denied')
        if len(inventory.cards)>10000:raise Refusal('binding_denied')
        entries=[];cards=inventory.cards;observed=tuple(cards.items());state=self._creation[1]
        for value,row in observed:
            if type(value)is not str or type(row)is not dict or type(row.get('employeeNo'))is not str or row['employeeNo']!=self.employee or type(row.get('cardNo'))is not str or row['cardNo']!=value:raise Refusal('binding_denied')
            if self._owner is None:
                identifier=str(uuid4())
                birth=CredentialBirth(self._issuer,self.parent.request,Provenance.capture(self.parent.request,self.parent.epoch),self.parent.parameters,
                    self.person,self.revision,identifier,(self.station,),(self.current,self.inventory_type))
                entries.append((birth,value))
            elif not any(private==value for _,private in self._owner.entries):raise Refusal('binding_denied')
        self.check()
        # The last authority/source callback may change the returned source
        # inventory object. Verify its exact original rows before publication.
        if inventory.cards is not cards or tuple(cards)!=tuple(value for value,_ in observed):raise Refusal('binding_denied')
        for value,row in observed:
            if (cards.get(value)is not row or type(row.get('employeeNo'))is not str or row['employeeNo']!=self.employee
                or type(row.get('cardNo'))is not str or row['cardNo']!=value):raise Refusal('binding_denied')
        if self._owner is None:
            self._owner=_InventoryOwner(self.parent.request,self.parent.parameters,self.person,self.revision,self.station,self.employee,tuple(entries))
            self._owned_inventory=self._owner;row=self._owner
            self._inventory_binding=(row.request,row.parameters,row.person,row.revision,row.station,row.employee,row.entries)
            state[0],state[1]=self._owner,self._inventory_binding
            state[2].update((birth.resource_id,self._birth_fields(birth))for birth,_ in entries)

    def _birth(self,context,birth,station):
        self.check();owner=self._owner
        if (type(context)is not EngineContext or owner is None or context.request is not owner.request
            or context.epoch!=self.parent.epoch or context.parameters is not owner.parameters and not same_parameters(context.parameters,owner.parameters)
            or type(birth)is not CredentialBirth or type(birth.resource_id)is not str or birth.issuer is not self._issuer or birth.request is not owner.request
            or birth.person_id!=self.person or type(birth.revision)is not int or birth.revision!=self.revision
            or station!=self.station or birth.parent!=Provenance.capture(self.parent.request,self.parent.epoch)
            or not any(candidate is birth for candidate,_ in owner.entries)
            or not same_identities(self._creation[1][2].get(birth.resource_id),self._birth_fields(birth))):raise Refusal('binding_denied')
        context.check();self._check_owner()
        if not same_identities(self._creation[1][2].get(birth.resource_id),self._birth_fields(birth)):raise Refusal('binding_denied')

    def for_value(self,value,context):
        self.check()
        if type(value)is not str or self._owner is None:raise Refusal('binding_denied')
        matches=[birth for birth,private in self._owner.entries if private==value]
        if len(matches)!=1:raise Refusal('binding_denied')
        self._birth(context,matches[0],self.station);return matches[0]

    def claim(self,context,birth,station,stage):
        self._birth(context,birth,station)
        if stage!='delete_card':raise Refusal('binding_denied')
        key=(birth.resource_id,station,stage)
        if key in self._creation[3]:raise Refusal('unproven_duplicate')
        self._creation[3].add(key)

    def check_claim(self,context,birth,station,stage):
        self._birth(context,birth,station)
        if stage!='delete_card' or (birth.resource_id,station,stage) not in self._creation[3]:raise Refusal('binding_denied')

    def close(self):
        self.closed=True;self._owner=None;self._owned_inventory=None;self._inventory_binding=None
        ports,state,issuer,claims=self._creation
        claims.clear();state[2].clear();state[:2]=[None,None];ports[0]=()
        self.employee=None;self._ports=()


class SourceUserDeletion:
    def __init__(self,*,repository,worker,audit_scope,changed,limit=4096):
        from .source_removal_worker import SourceRemovalWorker
        if type(worker)is not SourceRemovalWorker or worker.repository is not repository or not callable(audit_scope) or not callable(changed) or type(limit)is not int or not 1<=limit<=4096:raise ValueError('same owned source deletion worker required')
        self.repository,self.worker,self.audit_scope,self.changed,self.limit=repository,worker,audit_scope,changed,limit
        self.identities=SourceIdentities(repository);self._used=set();self._active=set();self.closed=False
        self._owned_used,self._owned_active=self._used,self._active
        self._worker_methods=(worker.enqueue,worker.check_binding)
        self._creation=(repository,worker,audit_scope,changed,limit,self.identities,self._used,self._active,self._worker_methods)

    def _check_creation(self):
        repository,worker,audit,changed,limit,identities,used,active,methods=self._creation
        if (type(self.closed)is not bool or self.closed or type(self.limit)is not int or self.limit!=limit
            or not same_ports((repository,worker,audit,changed),(self.repository,self.worker,self.audit_scope,self.changed))
            or self.identities is not identities or identities.repository is not repository
            or self._used is not used or self._owned_used is not used or self._active is not active or self._owned_active is not active
            or self._worker_methods is not methods or not same_ports(methods,(worker.enqueue,worker.check_binding))):raise Refusal('binding_denied')

    def _ports(self):
        r=self.repository
        return r,self.worker,self.worker.enqueue,self.worker.check_binding,self.audit_scope,self.changed,self.limit,self.identities,self.identities.repository,r.async_delete,r._delete_user,r._commit,r._save,r._lock,self._used,self._active,self._owned_used,self._owned_active

    async def apply(self,params,context):
        if type(context)is not EngineContext or context.request.get('action')!='users/delete' or context.request.get('actor')['kind']!='human' or context.parameters is None or params is not context.parameters and not same_parameters(params,context.parameters):raise Refusal('binding_denied')
        self._check_creation()
        from .profiles import catalog_profile
        Schema(catalog_profile('users/delete').parameters)(thaw(params));context.check();self._check_creation()
        params=context.parameters;key=context.request.get('operation_binding_ref')
        used,active=self._creation[6:8]
        if self.closed or self._used is not used or self._active is not active or key in used or len(used)>=self.limit:raise Refusal('binding_denied')
        ports=self._ports();repository,worker,enqueue,check_binding,audit_scope,changed,*_=ports
        configuration=worker.live.configuration;configuration_revision=configuration.current()
        used.add(key);active.add(key)
        def current(_=None):
            self._check_creation();context.check();self._check_creation()
            if not same_ports(self._worker_methods,(worker.enqueue,worker.check_binding)):raise Refusal('binding_denied')
            check_binding()
            if self.closed or not same_ports(ports,self._ports()) or configuration is not worker.live.configuration or configuration.current()!=configuration_revision:raise Refusal('binding_denied')
            check_binding();self._check_creation()
            if not same_ports(ports,self._ports()):raise Refusal('binding_denied')
            return True
        try:
            current();identity=self.identities.identity(params['user_id']);current()
            if type(identity.revision)is not int or identity.revision!=params['revision']:raise Refusal('binding_denied')
            with audit_scope(context.request.get('actor')['user_id'],'users/delete'):
                await context.wait(lambda:repository.async_delete(params['user_id'],expected_revision=params['revision']))
            current()
            scoped=EngineContext.scoped(context,current);scoped.trace=context.trace
            await scoped.wait(lambda:worker.enqueue(params['user_id'],params['revision'],scoped))
            current();changed();current()
            return {'accepted':True}
        finally:active.discard(key)

    def close(self):self.closed=True
