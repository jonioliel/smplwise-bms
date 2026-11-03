"""Original tombstone engine path with fresh admission for each fake effect.

Shares the live source worker's owned resource pool and station locks. Source
confirm-absent transitions are observed explicitly; missing results remain
unknown. This is not a scheduler, new endpoint, permission system or retry.
"""
import asyncio
from .adapters import EngineContext
from .envelope import freeze
from .jobs import same_parameters
from .owned_resources import OwnedObject
from .source_bindings import same_ports
from .source_reconcile import SourceReconcileWorker,_Driver,_driver_ports
from .source_effects import SourceEffectSession
from .source_deletions import SourceDeletionResources
from .validation import Refusal,reference


class _Run:
    def __init__(self,worker,person,revision,context):
        self.worker,self.person,self.revision,self.context=worker,person,revision,context
        self.confirmed=set();self.finished=False;self.targets=None;self.employee=None
        self.ports=worker._ports();self.configuration=worker.live.configuration.current();self.bound_engine=None;self.engine_ports=None
        self.read(initial=True)
        self._selection=(worker,person,revision,context,self.targets,self.employee,self.ports,self.configuration)

    def read(self,*,initial=False):
        w=self.worker;r=w.repository;state=r._state
        if type(state)is not dict or type(state.get('users'))is not dict or self.person in state['users'] or type(state.get('tombstones'))is not dict:raise Refusal('binding_denied')
        raw=state['tombstones'].get(self.person)
        if raw is None:
            if self.finished or initial:
                if initial:self.targets=();self.finished=True
                return
            raise Refusal('binding_denied')
        if type(raw)is not dict:raise Refusal('binding_denied')
        record=raw.get('record');targets=raw.get('targets');confirmed=raw.get('confirmed')
        if (type(raw)is not dict or raw.get('user_id')!=self.person or type(record)is not dict or record.get('id')!=self.person
            or type(record.get('revision'))is not int or record['revision']!=self.revision or type(record.get('employee_no'))is not str
            or raw.get('employee_no')!=record['employee_no'] or type(targets)is not list or len(targets)>100
            or any(type(v)is not str for v in targets) or len(set(targets))!=len(targets)
            or type(confirmed)is not list or any(type(v)is not str for v in confirmed) or not set(confirmed)<=set(targets)):raise Refusal('binding_denied')
        for station in targets:reference(station)
        if initial:self.targets=tuple(targets);self.employee=record['employee_no'];self.confirmed=set(confirmed)
        if tuple(targets)!=self.targets or record['employee_no']!=self.employee or set(confirmed)!=self.confirmed:raise Refusal('binding_denied')
        if r._state is not state or state['tombstones'].get(self.person)is not raw:raise Refusal('binding_denied')

    def _engine_current(self):
        engine=self.bound_engine;repo=engine.repository
        return (repo,engine._person,engine._step,engine._remove,repo.run,repo.base,repo._check,
            repo.snapshot,repo.fingerprint,repo.async_write_intent,repo.async_record_observation,repo.async_confirm_absent)

    def check(self):
        if not same_ports(self._selection,(self.worker,self.person,self.revision,self.context,self.targets,self.employee,self.ports,self.configuration)):raise Refusal('binding_denied')
        self.context.check();w=self.worker
        if w.closed or w.live.closed or not same_ports(self.ports,w._ports()) or w.live.configuration.current()!=self.configuration:raise Refusal('binding_denied')
        if self.bound_engine is not None and not same_ports(self.engine_ports,self._engine_current()):raise Refusal('binding_denied')
        self.read();self.context.check()
        w.check_binding()

    def observed_confirmation(self,station):
        # Called only after the original bound async_confirm_absent returned.
        r=self.worker.repository;state=r._state;raw=state['tombstones'].get(self.person)
        expected=self.confirmed|{station}
        if raw is None:
            if expected!=set(self.targets) or self.person in state['users']:raise Refusal('binding_denied')
            self.finished=True;self.confirmed=expected
        else:
            if type(raw)is not dict or set(raw.get('confirmed',()))!=expected:raise Refusal('binding_denied')
            self.confirmed=expected
        self.check()


class _Repository:
    """Closed source method surface; no generic forwarding or public serializer."""
    def __init__(self,run):self.run=run;self.base=run.worker.repository;self._binding=(run,self.base)
    def _check(self):
        if not same_ports(self._binding,(self.run,self.base)):raise Refusal('binding_denied')
        self.run.check()
        if not same_ports(self._binding,(self.run,self.base)):raise Refusal('binding_denied')
    def snapshot(self):self._check();value=self.base.snapshot();self._check();return value
    def fingerprint(self,value):self._check();result=self.base.fingerprint(value);self._check();return result
    async def async_write_intent(self,*args,**kwargs):
        self._check();value=await self.base.async_write_intent(*args,**kwargs);self._check();return value
    async def async_record_observation(self,*args,**kwargs):
        self._check();value=await self.base.async_record_observation(*args,**kwargs);self._check();return value
    async def async_confirm_absent(self,station,person,*,revision):
        self._check()
        if person!=self.run.person or type(revision)is not int or revision!=self.run.revision or station not in self.run.targets or station in self.run.confirmed:raise Refusal('binding_denied')
        value=await self.base.async_confirm_absent(station,person,revision=revision)
        self.run.observed_confirmation(station);return value


class _RemovalDriver(_Driver):
    def __init__(self,*args,removal,**kwargs):
        self.removal=removal;self._removal_owner=removal
        super().__init__(*args,credential_for=lambda value,context,required:removal.for_value(value,context),**kwargs)
    def check(self):
        if self.removal is not self._removal_owner:raise Refusal('binding_denied')
        super().check()
    async def async_person(self,person):
        value=await super().async_person(person);self.removal.observe(value,person);self.check();return value


class SourceRemovalWorker:
    def __init__(self,live,*,engine_factory,engine_type,inventory_type):
        if type(live)is not SourceReconcileWorker or not callable(engine_factory) or not isinstance(engine_type,type) or not isinstance(inventory_type,type):raise ValueError('explicit same-source worker and engine factory required')
        self.live,self.repository,self.factory,self.engine_type,self.inventory_type=live,live.repository,engine_factory,engine_type,inventory_type
        self._construction=(live,live.repository,engine_factory,engine_type,inventory_type);self.closed=False
    def _ports(self):
        r=self.repository
        return (self.live,r,self.factory,self.engine_type,self.inventory_type,*self.live._ports(),r.snapshot,r.fingerprint,r.async_write_intent,r.async_record_observation,r.async_confirm_absent)
    def check_binding(self):
        if type(self.closed)is not bool or self.closed or not same_ports(self._construction,(self.live,self.repository,self.factory,self.engine_type,self.inventory_type)):raise Refusal('binding_denied')
        self.live._check_creation()

    async def enqueue(self,person,revision,parent):
        if type(parent)is not EngineContext or parent.request.get('action')!='users/delete' or parent.parameters.get('user_id')!=person or type(revision)is not int or type(parent.parameters.get('revision'))is not int or parent.parameters.get('revision')!=revision:raise Refusal('binding_denied')
        self.check_binding()
        run=_Run(self,person,revision,parent);run.check();sessions=[];resources=[]
        async def create(owned):
            run.check();facade=_Repository(run);engine=self.factory(facade);run.check()
            if type(engine)is not self.engine_type or engine.repository is not facade:raise Refusal('binding_denied')
            run.bound_engine=engine;run.engine_ports=run._engine_current()
            bindings={}
            for station in run.targets:
                if station in run.confirmed:continue
                driver=self.live.current_driver(station)
                bindings[station]=(driver,_driver_ports(driver,None),tuple(self.live.owners(station)),freeze(self.live.mapping(parent.request,station)))
                run.check()
            async def cleanup():
                for session in sessions:session.close()
                for resource in resources:resource.close()
                sessions.clear();resources.clear();run.employee=None;run._selection=None
            return OwnedObject((engine,bindings),cleanup)
        async def use(value,owned):
            engine,bindings=value;_,locks,owners=self.live._creation_pool
            for station,(driver,driver_ports,source_owners,bound_mapping) in bindings.items():
                run.check();owned.check()
                if station not in locks:
                    if len(locks)>=256:raise Refusal('binding_denied')
                    locks[station]=asyncio.Lock()
                lock=locks[station];token=object();acquired=False
                async def acquire():
                    nonlocal acquired
                    await lock.acquire();acquired=True;owners[station]=token
                def current(_=None):
                    run.check();owned.check()
                    if locks.get(station)is not lock or owners.get(station)is not token or not lock.locked() or self.live.current_driver(station)is not driver or not same_ports(driver_ports,_driver_ports(driver,None)) or not same_ports(source_owners,tuple(self.live.owners(station))) or not same_parameters(self.live.mapping(parent.request,station),bound_mapping):raise Refusal('binding_denied')
                    return True
                try:
                    await owned.wait(acquire);local=EngineContext.scoped(parent,current);local.trace=parent.trace;local.check()
                    private=SourceDeletionResources(local,person,revision,station,run.employee,self.inventory_type,run.check);resources.append(private)
                    session=SourceEffectSession(local,person_id=person,revision=revision,station_id=station,
                        current_mapping=lambda _:self.live.mapping(parent.request,station),source_version=lambda _:run.check() or revision,
                        source_owners=lambda:(self.repository,engine,driver,*tuple(self.live.owners(station))),
                        fresh_admission=self.live.admit,journal=self.live.journal,clock_sample=self.live.clock,
                        credential_owner=private,require_bound_admission=True,configuration_revision=run.configuration);sessions.append(session)
                    checked=_RemovalDriver(driver,lambda:self.live.current_driver(station),local,session,None,removal=private)
                    inventory=await checked.async_inventory()
                    await local.wait(lambda:engine._person(station,person,checked,inventory));checked.check()
                finally:
                    if acquired and owners.get(station)is token:owners.pop(station,None);lock.release()
            run.check()
        return await self.live._creation_pool[0].run(parent,create,use)
    def owns_current(self):return self._construction[0]._creation_pool[0].owns_current()
    async def close(self):self.closed=True;await self._construction[0].aclose()
