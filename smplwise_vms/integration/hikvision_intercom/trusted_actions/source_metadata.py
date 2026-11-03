"""Metadata-only link from an admitted source context to experimental C03.

No result, body, parameters, PIN, card or content digest is read or stored.
This is not a C03 registration, source success proof or signature assertion.
"""
from .adapters import EngineContext
from .c03_experimental import TemporaryStatusStore
from .source_bindings import same_ports
from .validation import Refusal

class SourceMetadataObserver:
    def __init__(self,store,clock_sample):
        if type(store) is not TemporaryStatusStore or not callable(clock_sample):raise ValueError('explicit temporary metadata and clock required')
        self.store,self.clock=store,clock_sample
        self._creation=(store,clock_sample,store.generation,store.db,
            (store.capture_original,store.record,store._transaction,store._observe,store._fail),
            store.fault,store.capacity)
    def _check_owner(self):
        store,clock,generation,connection,ports,fault,capacity=self._creation
        if (self.store is not store or self.clock is not clock or store.closed
            or store.generation is not generation or store.db is not connection
            or store.fault is not fault or type(store.capacity)is not int or store.capacity!=capacity
            or not same_ports(ports,(store.capture_original,store.record,store._transaction,store._observe,store._fail))):raise Refusal('binding_denied')
    def capture(self,context):
        if type(context) is not EngineContext:raise Refusal('binding_denied')
        self._check_owner()
        _,clock,_,_,ports,_,_=self._creation
        def current(_):
            self._check_owner();context.check();self._check_owner()
            return True
        # The unchanged store also checks this scoped guard immediately before
        # recording. A parent callback cannot retarget its connection there.
        scoped=EngineContext.scoped(context,current);scoped.trace=context.trace
        scoped.check();sample=clock();self._check_owner()
        sample.check();scoped.check();context.request.check_time(sample.now)
        scoped.check()
        result=ports[0](scoped,sample.now)
        scoped.check()
        return result
