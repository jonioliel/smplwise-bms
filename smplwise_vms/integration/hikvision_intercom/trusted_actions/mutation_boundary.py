"""Checked preparation/save/publication/enqueue boundary, component-only.

No classic manager/repository is discovered or patched. Explicit source
callbacks still need their own transitive closure before a mutation adapter
can leave PARTIAL_OFF. This coordinator never calls broad user.public(),
copies private repository state, retries storage, or claims DEVICE_APPLIED.
"""
from dataclasses import dataclass

from .adapters import EngineContext,project_selected
from .envelope import freeze,thaw
from .jobs import same_parameters
from .source_bindings import same_identities
from .validation import Refusal,Schema,reference


ACTIONS=frozenset({'users/create','users/update','users/set_active','users/archive','users/unarchive','users/temporary_cancel'})


@dataclass(frozen=True,repr=False)
class PreparedMutation:
    user_id:str
    prior_revision:int
    next_revision:int
    operation_binding_ref:str
    epoch:str
    opaque:object


class MutationBoundary:
    def __init__(self,*,prepare,save,publish,public_result,enqueue,row_schema,limit=128):
        if not all(callable(v) for v in (prepare,save,publish,public_result,enqueue)) or type(limit)is not int or not 1<=limit<=4096:raise ValueError('explicit source transaction callbacks and bounded capacity required')
        self.prepare,self.save,self.publish,self.public_result,self.enqueue=prepare,save,publish,public_result,enqueue
        schema=Schema(row_schema);schema.require_closed(projection=True)
        self._row_definition=freeze(schema.definition)
        self.limit=limit;self.closed=False;self._active=set();self._used=set()

    def _owners(self):return (self.prepare,self.save,self.publish,self.public_result,self.enqueue,self._row_definition,self.limit)

    async def apply(self,action,params,context):
        if type(context)is not EngineContext or context.parameters is None or context.epoch is None or action not in ACTIONS or action!=context.request.get('action') or not same_parameters(params,context.parameters):raise Refusal('binding_denied')
        key=context.request.get('operation_binding_ref');reference(key)
        if self.closed or key in self._used or len(self._used)>=self.limit:raise Refusal('binding_denied')
        owners=self._owners();self._used.add(key);self._active.add(key)
        prepare,save,publish,public_result,enqueue,definition,_=owners
        schema=Schema(thaw(definition))
        def current():
            context.check()
            if self.closed or not same_identities(owners,self._owners()) or not same_parameters(params,context.parameters):raise Refusal('binding_denied')
        try:
            current();ticket=await context.wait(lambda:prepare(action,context.parameters,context));current()
            if type(ticket)is not PreparedMutation or ticket.operation_binding_ref!=key or ticket.epoch!=context.epoch:raise Refusal('binding_denied')
            Schema({'type':'string','format':'uuid'})(ticket.user_id)
            if type(ticket.prior_revision)is not int or type(ticket.next_revision)is not int or ticket.prior_revision<0 or ticket.next_revision!=ticket.prior_revision+1:raise Refusal('binding_denied')
            if action=='users/create':
                if ticket.prior_revision!=0:raise Refusal('binding_denied')
            elif ticket.user_id!=params.get('user_id') or type(params.get('revision'))is not int or ticket.prior_revision!=params['revision']:raise Refusal('binding_denied')
            async def saving():
                current()
                await save(ticket)
            # Once persistence is submitted, cancellation/revocation must not
            # prevent the captured source publisher from exposing committed
            # state. New dispatch/output below still needs fresh admission.
            await context.save(saving,lambda:publish(ticket))
            current()
            raw=await context.wait(lambda:public_result(ticket,context));current()
            result=project_selected(raw,schema.definition);schema(result)
            if result.get('id')!=ticket.user_id or type(result.get('revision'))is not int or result['revision']!=ticket.next_revision:raise Refusal('binding_denied')
            # An explicit source enqueue seam must itself use a fresh per-effect
            # station admission. sync_now=false is never a no-effect proof.
            current();await context.wait(lambda:enqueue(ticket,context));current()
            return result
        finally:
            self._active.discard(key)
            if self.closed and not self._active:self._used.clear()

    def close(self):
        self.closed=True
        # In-flight shielded persistence is joined by its owning host request.
        # Tombstones survive until close; a closed coordinator never reopens.
        if not self._active:self._used.clear()
