"""Internal one-use in-memory carrier for explicitly supplied source inputs.

No wire field, role, implicit source discovery, value hash or serializer. Only
an admitted immutable request can consume its own parameter reference. Payloads
never appear in repr, diagnostics or the public projection.
"""
from dataclasses import dataclass
from copy import deepcopy
from .adapters import EngineContext
from .jobs import same_parameters
from .envelope import freeze, thaw
from .validation import Refusal

@dataclass(frozen=True, repr=False)
class _Input:
    descriptor: object
    epoch: str
    parameters: object
    payload: object
    owner: object
    generation: object
    context_owner: object
    issuer: object

class MemorySourceInputs:
    def has_reference(self,key):
        """Binding metadata only; never inspect/consume a private payload."""
        try:self._check_owner()
        except Refusal:return True  # invalid private carrier cannot enable a public fallback
        items,used=self._creation[2:4]
        return key in used or key in items

    def __init__(self, current_owner, *, limit=128):
        if not callable(current_owner) or type(limit) is not int or not 1<=limit<=4096:
            raise ValueError('explicit source owner and bounded capacity required')
        self.current_owner,self.limit=current_owner,limit
        self._items,self._used={},set();self.closed=False
        self._creation=(current_owner,limit,self._items,self._used,object(),[False])

    def _check_owner(self):
        provider,limit,items,used,_,stopped=self._creation
        if (stopped[0] or self.closed or self.current_owner is not provider or type(self.limit) is not int
            or self.limit!=limit or self._items is not items or self._used is not used):raise Refusal('binding_denied')

    @staticmethod
    def _owner(provider):
        value=provider()
        if type(value) is not tuple or len(value)!=2 or value[0] is None or value[1] is None:raise Refusal('binding_denied')
        return value

    def issue(self, context, payload):
        if type(context) is not EngineContext or context.parameters is None or context.epoch is None:
            raise Refusal('binding_denied')
        context.check();self._check_owner()
        provider,_,items,used,issuer,_=self._creation
        owner,generation=self._owner(provider);self._check_owner()
        key=context.request.get('operation')['parameter_reference']
        if key in used or len(used)>=self.limit:
            raise Refusal('unproven_duplicate')
        if owner is None or generation is None:raise Refusal('binding_denied')
        used.add(key)  # reserve before any user-defined deepcopy callback
        copied=deepcopy(payload)  # private source copy, memory only
        context.check();self._check_owner()
        fresh=self._owner(provider);context.check();self._check_owner()
        if fresh[0] is not owner or fresh[1] is not generation:
            raise Refusal('binding_denied')
        items[key]=_Input(context.request.descriptor,context.epoch,freeze(thaw(context.parameters)),copied,owner,generation,context,issuer)

    def consume(self, context):
        if type(context) is not EngineContext:raise Refusal('binding_denied')
        provider,_,items,used,issuer,_=self._creation
        key=context.request.get('operation')['parameter_reference']
        item=items.get(key)
        if type(item) is not _Input or item.issuer is not issuer or item.context_owner is not context and (item.descriptor!=context.request.descriptor or item.epoch!=context.epoch or not same_parameters(item.parameters,context.parameters)):raise Refusal('binding_denied')
        items.pop(key)  # the owner's refusal consumes only its own frame
        self._check_owner()
        if self.closed or type(item) is not _Input or item.descriptor!=context.request.descriptor or item.epoch!=context.epoch or not same_parameters(item.parameters,context.parameters):
            raise Refusal('binding_denied')
        context.check();self._check_owner()
        owner,generation=self._owner(provider);context.check();self._check_owner()
        if owner is not item.owner or generation is not item.generation:
            raise Refusal('binding_denied')
        return item.payload

    def discard(self, context):
        # Cleanup has no authority check: it must work after expiry/revocation.
        # It can only remove the exact immutable request's item, never a later
        # or unrelated request that happens to present the same reference.
        if type(context) is not EngineContext:raise Refusal('binding_denied')
        # The mutable in-process Request/EngineContext may itself be the reason
        # admission failed. Use the captured context identity for retirement,
        # never its possibly replaced descriptor, epoch or request reference.
        items=self._creation[2]
        for key,item in tuple(items.items()):
            if type(item) is _Input and item.issuer is self._creation[4] and item.context_owner is context:items.pop(key,None)
    def close(self):
        self._creation[5][0]=self.closed=True
        items,used=self._creation[2:4]
        dict.clear(items);set.clear(used)
