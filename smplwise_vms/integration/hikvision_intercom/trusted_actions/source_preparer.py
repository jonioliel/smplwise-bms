"""Internal admitted preparer seam; no B8 transport, sidecar or fallback.

The same explicit object prepares public parameters for CandidateHost and
issues private memory only in the admitted receiver's immutable EngineContext.
Caller code is trusted in-process; this is not cryptographic authentication.
"""
from .source_bindings import same_ports
import asyncio

from dataclasses import dataclass
from uuid import UUID
from .source_inputs import MemorySourceInputs
from .adapters import EngineContext
from .host import PreparedOperation
from .envelope import freeze,thaw
from .jobs import same_parameters
from .validation import Refusal

PRIVATE_FIELDS=frozenset({'employee_no','phone','pin','cards','photo','responsible_person','access_purpose'})

@dataclass(frozen=True,repr=False)
class _Prepared:
    descriptor:object
    parameters:object
    expires:object
    request_owner:object
    ports:tuple
    issuer:object

@dataclass(frozen=True,repr=False)
class _PreparerOwner:
    inputs:object
    close_inputs:object
    limit:int
    actions:frozenset
    prepared:dict
    used:set
    issuer:object
    life:list

class AdmittedSourcePreparer:
    def has_reference(self,key):
        """Prevent an already private reference from becoming a public call."""
        try:self._check_owner()
        except Refusal:return True
        o=self._creation
        return key in o.used or key in o.prepared

    def __init__(self,public_prepare,private_frame,principal,inputs,*,limit=128,actions=frozenset({'users/create','users/update'})):
        if not all(callable(p) for p in (public_prepare,private_frame,principal)) or type(inputs) is not MemorySourceInputs or type(limit) is not int or not 1<=limit<=4096:
            raise ValueError('explicit internal preparation ports required')
        if type(actions) is not frozenset or not actions or not actions<=frozenset({'users/create','users/update','cards/add'}):raise ValueError('closed admitted private action selection required')
        self.public_prepare,self.private_frame,self.principal,self.inputs=public_prepare,private_frame,principal,inputs
        self.actions=actions;self.limit=limit;self.closed=False;self._prepared={};self._used=set()
        self._creation=_PreparerOwner(inputs,MemorySourceInputs.close,limit,actions,
            self._prepared,self._used,object(),[False,None])
    def _ports(self):return (self.public_prepare,self.private_frame,self.principal,self.inputs,self.actions,self.limit,self._used,self._prepared,self.inputs.issue)

    def _check_owner(self,*,admit=False):
        o=self._creation
        if (o.life[0] or self.closed is not False or self.inputs is not o.inputs
            or self.actions is not o.actions or type(self.limit)is not int or self.limit!=o.limit
            or self._prepared is not o.prepared or self._used is not o.used):raise Refusal('binding_denied')
        ports=self._ports()
        if not all(callable(port)for port in ports[:3]):raise Refusal('binding_denied')
        # Preserve explicit callback assembly before the first preparation.
        # The first call pins identities before invoking/awaiting any provider.
        if o.life[1] is None:
            if admit:o.life[1]=ports
        elif not same_ports(o.life[1],ports):raise Refusal('binding_denied')
        return o.life[1] if o.life[1] is not None else ports

    async def __call__(self,request):
        ports=self._check_owner(admit=True);o=self._creation
        # The host may inject a wrapper around this typed preparer. Register
        # our exact map before its first await so a late admission refusal
        # still retires this request, even when no receiver is entered.
        from .host import _preparation_scopes
        scope=_preparation_scopes.get()
        if scope is not None:
            if scope.task is not asyncio.current_task() or scope.request is not request:raise Refusal('binding_denied')
            if not any(owner is self and previous is request and records is o.prepared for owner,previous,records in scope.records):
                scope.records.append((self,request,o.prepared))
        value=await ports[0](request)
        self._check_owner()
        if type(value) is not PreparedOperation:raise Refusal('binding_denied')
        if request.get('action') in o.actions and request.get('operation')['parameter_transport']=='agreed_sensitive_opaque_reference':
            key=request.get('operation')['parameter_reference']
            try:uid=UUID(key)
            except (ValueError,TypeError,AttributeError):raise Refusal('binding_denied') from None
            if str(uid)!=key or uid.version!=4 or key in o.used or len(o.used)>=o.limit:raise Refusal('binding_denied')
            kind=ports[2](request)
            if request.get('actor')['kind']!='human' or type(kind) is not str or kind not in ('arx_human','ha_human'):raise Refusal('binding_denied')
            self._check_owner()
            o.used.add(key)
            o.prepared[key]=_Prepared(request.descriptor,value.parameters,value.expires,request,ports,o.issuer)
        return value
    def issue(self,context):
        if type(context) is not EngineContext:raise Refusal('binding_denied')
        o=self._creation
        key=context.request.get('operation')['parameter_reference'];record=o.prepared.get(key)
        if type(record) is not _Prepared or record.issuer is not o.issuer or not same_parameters(record.parameters,context.parameters) or record.request_owner is not context.request and record.descriptor!=context.request.descriptor:raise Refusal('binding_denied')
        o.prepared.pop(key)
        self._check_owner()
        context.check()
        self._check_owner()
        if self.closed or type(record) is not _Prepared or record.descriptor!=context.request.descriptor or not same_parameters(record.parameters,context.parameters):raise Refusal('binding_denied')
        if context.request.get('actor')['kind']!='human':raise Refusal('binding_denied')
        ports=record.ports
        if ports is not o.life[1] or not same_ports(ports,self._ports()):raise Refusal('binding_denied')
        if context.request.get('action') not in o.actions:raise Refusal('binding_denied')
        kind=ports[2](context.request)
        if type(kind) is not str or kind not in ('arx_human','ha_human'):raise Refusal('binding_denied')
        context.check()
        self._check_owner()
        value=ports[1](context.request)
        if type(value) is not dict or not value or not set(value)<=PRIVATE_FIELDS or set(value)&set(context.parameters.get('data',{})):raise Refusal('invalid_fields')
        context.check()
        self._check_owner()
        try:
            ports[8](context,value)
            context.check();self._check_owner()
        except BaseException:
            MemorySourceInputs.discard(o.inputs,context)
            raise
    def discard(self,request):
        o=self._creation
        for key,record in tuple(o.prepared.items()):
            if type(record) is _Prepared and record.issuer is o.issuer and record.request_owner is request:o.prepared.pop(key,None)
    def close(self):
        o=self._creation;o.life[0]=self.closed=True
        dict.clear(o.prepared);set.clear(o.used)
        o.close_inputs(o.inputs)
