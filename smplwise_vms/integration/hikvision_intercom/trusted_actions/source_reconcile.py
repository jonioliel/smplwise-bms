"""Owned source reconciliation under fresh per-effect admissions, OFF candidate.

The original engine is explicit. A per-request driver wrapper replaces no
method on a shared connection; concurrent requests cannot borrow each other's
guards. This is not an Arx transport, classic retry policy or authority cache.
"""
from .source_bindings import same_ports,same_identities

from copy import deepcopy
import asyncio
from dataclasses import dataclass
from types import MethodType, MappingProxyType
from .adapters import EngineContext
from .envelope import freeze, thaw
from .owned_resources import OwnedResources, OwnedObject
from .jobs import same_parameters
from .source_effects import SourceEffectSession
from .source_identity import SourceIdentities
from .validation import Refusal, reference


def _same(a,b):
    if a is b:return True
    return a.__self__ is b.__self__ and a.__func__ is b.__func__ if type(a) is MethodType and type(b) is MethodType else a is b


def _driver_ports(driver,timing):
    if driver is None:return ()
    names=('async_inventory','async_person','async_write_person','async_delete_person','async_write_card','async_delete_card')
    if timing is not None:names+=('_require_mutation','_json','_verified_right_plans')
    return (driver,driver.capabilities,*_connection_ports(driver.client),*(getattr(driver,name) for name in names))


def _connection_ports(client):
    # Object ownership only: never inspect settings, credentials, addresses or
    # identity values. Replacing a session on the same client is a new binding.
    return client,getattr(client,'_session',None),getattr(client,'settings',None),getattr(client,'_expected_identity',None)


class _Driver:
    def __init__(self, driver, current_driver, context, session, retirement_for, credential_for):
        if type(context) is not EngineContext or type(session) is not SourceEffectSession or session.parent is not context:raise ValueError('same owned source session context required')
        self._session_check=session.check_source
        self._driver,self._current,self._context,self._session=driver,current_driver,context,session
        self._retirement_for=retirement_for
        self._credential_for=credential_for
        self._methods=MappingProxyType({name:getattr(driver,name) for name in ('async_inventory','async_person','async_write_person','async_delete_person','async_write_card','async_delete_card')})
        self._caps,self._client=driver.capabilities,driver.client
        self._connection=_connection_ports(self._client)
        self._timing=session.timing_owner
        self._native=MappingProxyType({name:getattr(driver,name) for name in ('_require_mutation','_json','_verified_right_plans')}) if self._timing is not None else None
        self._identity=(driver,current_driver,context,session,retirement_for,credential_for,self._methods,self._caps,self._client,self._connection,self._timing,self._native,self._session_check)

    def check(self):
        if not same_identities(self._identity,(self._driver,self._current,self._context,self._session,self._retirement_for,self._credential_for,self._methods,self._caps,self._client,self._connection,self._timing,self._native,self._session_check)):raise Refusal('binding_denied')
        if self._session.parent is not self._context or not _same(self._session.check_source,self._session_check):raise Refusal('binding_denied')
        # The pinned source checker performs this very context's fresh guard
        # both before and after its metadata callbacks. Do not call the same
        # parent a third time before any intervening work.
        self._session_check()
        if self._current() is not self._driver or self._driver.capabilities is not self._caps or self._driver.client is not self._client or any(not _same(method,getattr(self._driver,name,None)) for name,method in self._methods.items()):
            raise Refusal('binding_denied')
        if not same_identities(self._connection,_connection_ports(self._client)):raise Refusal('binding_denied')
        if self._native is not None and any(not _same(port,getattr(self._driver,name,None)) for name,port in self._native.items()):raise Refusal('binding_denied')

    @property
    def capabilities(self):self.check();return self._caps
    @property
    def client(self):self.check();return self._client
    @property
    def _verified_right_plans(self):
        self.check()
        if self._native is None:raise Refusal('binding_denied')
        return self._native['_verified_right_plans']

    def _require_mutation(self,resource,operation):
        self.check()
        if self._native is None or (resource,operation)!=('UserInfo','put'):raise Refusal('binding_denied')
        result=self._native['_require_mutation'](resource,operation);self.check();return result

    async def _json(self,method,route,body=None):
        self.check()
        if self._native is None:raise Refusal('binding_denied')
        call=self._native['_json']
        if method=='GET' and route=='/ISAPI/AccessControl/UserInfo/capabilities?format=json' and body is None:
            value=await self._context.wait(lambda:call(method,route));self.check();return value
        if method!='PUT':raise Refusal('binding_denied')
        b=self._session.birth
        birth=self._timing.pending_write(self._context,person_id=b.person_id,revision=b.revision,station_id=b.station_id,route=route,body=body)
        bound=freeze(body)
        self.check()
        async def effect(child):
            self.check();child.check()
            if not same_parameters(body,bound) or not same_parameters(bound,birth.body):raise Refusal('binding_denied')
            value=await child.wait(lambda:call(method,route,thaw(bound)));child.check();self.check();return value
        value=await self._session.dispatch('timing_'+birth.kind,effect,timing=birth)
        self.check();return value

    async def _read(self,name,*args):
        self.check();method=self._methods[name]
        value=await self._context.wait(lambda:method(*args));self.check();return value
    async def async_inventory(self):return await self._read('async_inventory')
    async def async_person(self,person):return await self._read('async_person',person)

    async def _write(self,stage,name,*args,retirement=None,credential=None,**kwargs):
        self.check();method=self._methods[name];bound=freeze({'args':list(args),'kwargs':kwargs})
        async def effect(child):
            self.check();child.check()
            if not same_parameters({'args':list(args),'kwargs':kwargs},bound):raise Refusal('binding_denied')
            data=thaw(bound)
            value=await child.wait(lambda:method(*data['args'],**data['kwargs']))
            child.check();self.check();return value
        result=await self._session.dispatch(stage,effect,retirement=retirement,credential=credential)
        self.check();return result
    async def async_write_person(self,payload,*,create):return await self._write('create_person' if create else 'update_person','async_write_person',payload,create=create)
    async def async_delete_person(self,person):return await self._write('delete_person','async_delete_person',person)
    async def async_write_card(self,person,number,card_type,*,create):
        self.check()
        if self._credential_for is None:raise Refusal('binding_denied')
        birth=self._credential_for(number,self._context,True);self.check()
        return await self._write('create_card' if create else 'update_card','async_write_card',person,number,card_type,create=create,credential=birth)
    async def async_delete_card(self,number):
        self.check()
        if self._credential_for is not None:
            live=self._credential_for(number,self._context,False);self.check()
            if live is not None:return await self._write('delete_card','async_delete_card',number,credential=live)
        if self._retirement_for is None:raise Refusal('binding_denied')
        birth=self._retirement_for(number,self._context)
        self.check()
        return await self._write('delete_card','async_delete_card',number,retirement=birth)


class SourceReconcileWorker:
    def __init__(self, *, epoch, repository, engine, current_driver, target_stations,
                 current_mapping, source_owners, fresh_admission, journal, clock_sample,
                 retirement_births=None, retirement_for=None, credential_resources=None, timing_resources=None, limit=128):
        if repository is None or engine is None or not all(callable(p) for p in (current_driver,target_stations,current_mapping,source_owners,fresh_admission,clock_sample)):
            raise ValueError('explicit source reconciliation ports required')
        self.repository,self.engine=repository,engine
        self.identities=SourceIdentities(repository)
        from .source_configuration import SourceConfigurationRevision
        self.configuration=SourceConfigurationRevision(repository)
        self.current_driver,self.targets,self.mapping,self.owners=current_driver,target_stations,current_mapping,source_owners
        self.admit,self.journal,self.clock=fresh_admission,journal,clock_sample
        self.retirement_births,self.retirement_for=retirement_births,retirement_for
        if retirement_births is not None and retirement_for is None:
            from .retirement import RetirementBirths
            if type(retirement_births) is not RetirementBirths or not retirement_births.bind_card_values or retirement_births.state() is not repository._state:raise ValueError('same bound retirement source required')
            self.retirement_for=retirement_births.for_value
        if credential_resources is not None:
            from .source_credentials import SourceCredentialResources
            if type(credential_resources) is not SourceCredentialResources or not _same(credential_resources.current_user,repository.get):raise ValueError('same source credential repository required')
        self.credentials=credential_resources
        if timing_resources is not None:
            from .source_timing import SourceTimingResources
            if type(timing_resources) is not SourceTimingResources or not _same(timing_resources.current_user,repository.get):raise ValueError('same timing source repository required')
        self.timing=timing_resources
        self.resources=OwnedResources(epoch=epoch,limit=limit)
        self._station_locks={};self._station_owners={}
        self._owned_station_locks,self._owned_station_owners=self._station_locks,self._station_owners
        self._owned_resources=self.resources;self.closed=False
        self._creation_pool=(self.resources,self._station_locks,self._station_owners)

    def _check_creation(self):
        pool,locks,owners=self._creation_pool
        if (type(self.closed)is not bool or self.closed or self.resources is not pool or self._owned_resources is not pool
            or self._station_locks is not locks or self._owned_station_locks is not locks
            or self._station_owners is not owners or self._owned_station_owners is not owners):raise Refusal('binding_denied')

    def _ports(self):
        return (self.repository,self.engine,self.identities,self.identities.repository,self.configuration,self.configuration.repository,self.configuration.current,self._station_locks,self._station_owners,self._owned_station_locks,self._owned_station_owners,self.current_driver,self.targets,self.mapping,self.owners,self.admit,self.journal,self.clock,
            self.retirement_births,self.retirement_for,getattr(self.retirement_births,'state',None),getattr(self.retirement_births,'revision',None),getattr(self.retirement_births,'bind_card_values',None),self.credentials,getattr(self.credentials,'current_user',None),getattr(self.credentials,'card_type',None),self.timing,
            *(self.timing._providers() if self.timing is not None else ()),self.resources,getattr(self.engine,'_person',None),getattr(self.repository,'get',None),getattr(self.engine,'native_timing',None),getattr(self.engine,'_timing_clocks',None))

    async def enqueue(self,person_id,revision,parent):
        if type(parent) is not EngineContext or type(revision) is not int or revision<1:raise Refusal('binding_denied')
        self._check_creation()
        reference(person_id);parent.check()
        self._check_creation()
        ports=self._ports();configuration_revision=self.configuration.current()
        def current(_):
            self._check_creation()
            parent.check()
            fresh_ports=self._ports()
            if self.closed or self.resources is not self._owned_resources or not same_ports(ports,fresh_ports):raise Refusal('binding_denied')
            if self.configuration.current()!=configuration_revision:raise Refusal('binding_denied')
            user=self.identities.identity(person_id)
            if user.id!=person_id or type(user.revision) is not int or user.revision!=revision:raise Refusal('binding_denied')
            if self.credentials is not None:self.credentials.check_person(parent,person_id,revision,self.repository)
            elif self.repository._state['users'][person_id].get('pin') is not None:
                # A public/policy context cannot carry an unbound sensitive
                # person value into a source effect. An explicit post-save
                # private birth owner is required; no fallback is inferred.
                raise Refusal('binding_denied')
            self._check_creation()
            if not same_ports(ports,self._ports()):raise Refusal('binding_denied')
            return True
        current(None)
        async def create(owned):
            current(None);targets=self.targets(person_id);current(None)
            if type(targets) is not tuple or len(targets)>100 or len(set(targets))!=len(targets):raise Refusal('binding_denied')
            for target in targets:reference(target)
            # Pin every receiver/connection before the first station await.
            # Fresh child authority never silently adopts a second connection
            # that appeared while the first station's effect was in flight.
            bindings={}
            for target in targets:
                driver=self.current_driver(target);current(None)
                bindings[target]=(driver,_driver_ports(driver,self.timing),tuple(self.owners(target)),freeze(self.mapping(parent.request,target)))
                current(None)
            sessions=[]
            async def cleanup():
                for session in sessions:session.close()
                sessions.clear()
            return OwnedObject((targets,sessions,bindings),cleanup)
        async def run(value,owned):
            targets,sessions,bindings=value
            def scoped_current(_):
                current(None);owned.check()
                if self.targets(person_id)!=targets:raise Refusal('binding_denied')
                return True
            scoped=EngineContext.scoped(parent,scoped_current);scoped.trace=parent.trace
            async def station_work(station,local):
                local.check();driver,driver_ports,station_owners,bound_mapping=bindings[station]
                def check_station():
                    local.check();fresh_driver=self.current_driver(station)
                    if fresh_driver is not driver:raise Refusal('binding_denied')
                    ports=_driver_ports(fresh_driver,self.timing);fresh_owners=tuple(self.owners(station))
                    if not same_ports(ports,driver_ports) or len(fresh_owners)!=len(station_owners) or any(a is not b for a,b in zip(fresh_owners,station_owners)) or not same_parameters(self.mapping(parent.request,station),bound_mapping):raise Refusal('binding_denied')
                    local.check()
                check_station()
                if driver is None:raise Refusal('device_unavailable')
                user=self.repository.get(person_id);assignment=user.assignments.get(station);local.check()
                if user.access_timing_policy is not None and user.active and assignment is not None and assignment.enabled and self.timing is None:
                    # Inactive policy users may still be removed. Active policy
                    # reconciliation needs the typed resource source explicitly.
                    raise Refusal('binding_denied')
                def mapping(_,station=station):
                    # The source session checks the parent and the complete
                    # source snapshot before/after these synchronous metadata
                    # reads. No permission/authority/result is cached here.
                    return self.mapping(parent.request,station)
                def source_owners(station=station,driver=driver):
                    if self.current_driver(station) is not driver:raise Refusal('binding_denied')
                    current_owners=tuple(self.owners(station))
                    if len(current_owners)!=len(station_owners) or any(a is not b for a,b in zip(current_owners,station_owners)):raise Refusal('binding_denied')
                    return (self.repository,self.engine,driver,*station_owners)
                session=SourceEffectSession(local,person_id=person_id,revision=revision,station_id=station,
                    current_mapping=mapping,source_version=lambda person:self.identities.identity(person).revision,
                    source_owners=source_owners,fresh_admission=self.admit,journal=self.journal,clock_sample=self.clock,retirement_owner=self.retirement_births,credential_owner=self.credentials,timing_owner=self.timing,require_bound_admission=True,configuration_revision=configuration_revision)
                sessions.append(session)
                def credential_for(value,context,required,station=station):
                    local.check()
                    if self.credentials is None:raise Refusal('binding_denied')
                    return self.credentials.for_value(context,person_id,revision,station,value,required=required)
                checked=_Driver(driver,lambda station=station:self.current_driver(station),local,session,self.retirement_for,credential_for if self.credentials is not None else None)
                if self.timing is not None:
                    # Match the frozen async_reconcile entry: each new source
                    # transaction rechecks device-clock evidence, not a prior
                    # transaction's optional timing observation cache.
                    clocks=self.engine._timing_clocks
                    if type(clocks) is not set:raise Refusal('binding_denied')
                    clocks.discard(station)
                inventory=await checked.async_inventory()
                await local.wait(lambda:self.engine._person(station,person_id,checked,inventory))
                checked.check()
            _,locks,owners=self._creation_pool
            for station in targets:
                scoped.check()
                if station not in locks:
                    if len(locks)>=256:raise Refusal('binding_denied')
                    locks[station]=asyncio.Lock()
                lock=locks[station];token=object();acquired=False
                async def acquire():
                    nonlocal acquired
                    await lock.acquire();acquired=True;owners[station]=token
                def local_current(_):
                    scoped.check()
                    if locks.get(station) is not lock or owners.get(station) is not token or not lock.locked():raise Refusal('binding_denied')
                    return True
                try:
                    # Capture ownership before the post-await check; a refusal
                    # immediately after acquisition must still release our lock.
                    await scoped.wait(acquire)
                    local=EngineContext.scoped(parent,local_current);local.trace=parent.trace
                    await station_work(station,local)
                finally:
                    if acquired and owners.get(station) is token:
                        owners.pop(station,None);lock.release()
            scoped.check()
        return await self._creation_pool[0].run(parent,create,run)

    def owns_current(self):return self._creation_pool[0].owns_current()
    def close(self):self.closed=True
    async def aclose(self):
        self.closed=True;pool,locks,owners=self._creation_pool
        try:await pool.close()
        finally:
            if not pool._creation[3]:locks.clear();owners.clear()
