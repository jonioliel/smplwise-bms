"""Source-observed create/update/tombstone identities for one derived effect.

Only post-save public IDs/revisions and target membership are read. No source
body, fingerprint, credential, private serializer or authority/result cache is
used. Retired-value and multistage derivations are deliberately not inferred.
These are internal candidates, not source_proof_id or a new wire contract.
"""
from dataclasses import dataclass

from .adapters import EngineContext
from .envelope import freeze,thaw
from .jobs import DerivedJobs,same_parameters
from .validation import Refusal,Schema,reference


@dataclass(frozen=True,repr=False)
class ResourceState:
    owner:object
    person_id:str
    revision:int
    stations:tuple
    kind:str


@dataclass(frozen=True,repr=False)
class SourceOrigin:
    issuer:object
    descriptor:object
    parameters:object
    epoch:str
    state:ResourceState
    source_owners:tuple


class ResourceMetadata:
    def __init__(self,current_state):
        if not callable(current_state):raise ValueError('explicit source metadata provider required')
        self.current_state=current_state

    def read(self,kind,person):
        Schema({'type':'string','format':'uuid'})(person)
        provider=self.current_state;state=provider()
        if type(state)is not dict:raise Refusal('binding_denied')
        if kind=='user':
            users=state['users'];raw=users.get(person)
            if type(users)is not dict or type(raw)is not dict or raw['id']!=person or type(raw['assignments'])is not dict:raise Refusal('binding_denied')
            revision=raw['revision'];stations=tuple(raw['assignments'])
        elif kind=='tombstone':
            collection=state['tombstones'];raw=collection.get(person)
            if type(collection)is not dict or type(raw)is not dict or raw['user_id']!=person or type(raw['record'])is not dict:raise Refusal('binding_denied')
            # The preserved revision is public metadata. No other record field
            # or retired value is accessed, copied, measured or hashed.
            revision=raw['record']['revision'];targets,confirmed=raw['targets'],raw['confirmed']
            if type(targets)is not list or type(confirmed)is not list or not set(confirmed)<=set(targets):raise Refusal('binding_denied')
            stations=tuple(target for target in targets if target not in confirmed)
        else:raise Refusal('binding_denied')
        if type(revision)is not int or revision<1 or len(stations)>100 or len(set(stations))!=len(stations):raise Refusal('binding_denied')
        for station in stations:reference(station)
        if self.current_state is not provider or provider()is not state:raise Refusal('binding_denied')
        return ResourceState(raw,person,revision,stations,kind)


class SourceOrigins:
    def __init__(self,metadata,*,limit=4096):
        if type(metadata)is not ResourceMetadata or type(limit)is not int or not 1<=limit<=4096:raise ValueError('explicit source metadata and bound required')
        self.metadata,self.limit=metadata,limit;self._issuer=object();self._items={};self._claimed=set();self.closed=False

    def observe(self,context,action,person,revision):
        if type(context)is not EngineContext or context.epoch is None or context.parameters is None or action!=context.request.get('action'):raise Refusal('binding_denied')
        context.check();params=context.parameters
        if action=='users/create':kind='user';expected=1
        elif action=='users/delete':kind='tombstone';expected=params.get('revision')
        elif action in {'users/update','users/set_active','users/archive','users/unarchive','users/temporary_cancel'}:kind='user';expected=params.get('revision',0)+1
        else:raise Refusal('binding_denied')
        if action!='users/create'and params.get('user_id')!=person:raise Refusal('binding_denied')
        if type(revision)is not int or revision!=expected:raise Refusal('binding_denied')
        key=context.request.get('operation_binding_ref')
        if self.closed or key in self._items or len(self._items)>=self.limit:raise Refusal('binding_denied')
        metadata=self.metadata;state=metadata.read(kind,person);context.check()
        if self.metadata is not metadata or state.revision!=revision:raise Refusal('binding_denied')
        origin=SourceOrigin(self._issuer,context.request.descriptor,context.parameters,context.epoch,state,(metadata,metadata.current_state))
        self._items[key]=origin;return origin

    def for_parent(self,context):
        context.check();key=context.request.get('operation_binding_ref');origin=self._items.get(key)
        if self.closed or type(origin)is not SourceOrigin or origin.issuer is not self._issuer or origin.descriptor!=context.request.descriptor or origin.epoch!=context.epoch or not same_parameters(origin.parameters,context.parameters):raise Refusal('binding_denied')
        self.current(origin);return origin

    def current(self,origin):
        if self.closed or type(origin)is not SourceOrigin or origin.issuer is not self._issuer or self._items.get(origin.descriptor['operation_binding_ref'])is not origin:raise Refusal('binding_denied')
        metadata=self.metadata
        if metadata is not origin.source_owners[0]or metadata.current_state is not origin.source_owners[1]:raise Refusal('binding_denied')
        fresh=metadata.read(origin.state.kind,origin.state.person_id)
        if self.metadata is not metadata or metadata.current_state is not origin.source_owners[1]or fresh.owner is not origin.state.owner or (fresh.person_id,fresh.revision,fresh.stations,fresh.kind)!=(origin.state.person_id,origin.state.revision,origin.state.stations,origin.state.kind):raise Refusal('binding_denied')
        return fresh

    def claim(self,context,origin):
        if self.for_parent(context)is not origin:raise Refusal('binding_denied')
        key=context.request.get('operation_binding_ref')
        if key in self._claimed:raise Refusal('unproven_duplicate')
        self._claimed.add(key)

    def close(self):self.closed=True;self._items.clear();self._claimed.clear()


@dataclass(frozen=True,repr=False)
class ResourcePlan:
    person_id:str
    revision:int
    station_id:str
    kind:str
    mapping:object


class SourceResourceWorkers:
    def __init__(self,*,origins,jobs,current_mapping,jobs_for_station):
        if type(origins)is not SourceOrigins or type(jobs)is not DerivedJobs or not callable(current_mapping)or not callable(jobs_for_station):raise ValueError('explicit source origin, admitted jobs and mapping required')
        self.origins,self.jobs,self.mapping,self.reader=origins,jobs,current_mapping,jobs_for_station
        self.closed=False

    def start(self,key,parent,origin,receiver):
        if not callable(receiver):raise Refusal('binding_denied')
        origins,jobs,mapping,reader=self.origins,self.jobs,self.mapping,self.reader
        # Validate provenance and the complete target before consuming the
        # one-effect origin. A missing/mismatched route has not admitted work.
        if origins.for_parent(parent)is not origin:raise Refusal('binding_denied')
        resolved=mapping(parent.request);parent.check()
        if type(resolved)is not dict or any(type(resolved.get(k))is not type(v)or resolved.get(k)!=v for k,v in thaw(parent.request.get('target')).items()):raise Refusal('binding_denied')
        station=reference(resolved.get('config_entry_id'))
        plan=ResourcePlan(origin.state.person_id,origin.state.revision,station,origin.state.kind,freeze(resolved))
        def current(context):
            context.check()
            if self.closed or self.origins is not origins or self.jobs is not jobs or self.mapping is not mapping or self.reader is not reader:raise Refusal('binding_denied')
            state=origins.current(origin)
            if station not in state.stations or not same_parameters(mapping(context.request),plan.mapping):raise Refusal('binding_denied')
            ids=reader(station)
            if type(ids)is not list or len(ids)>10000 or any(type(uid)is not str for uid in ids)or len(set(ids))!=len(ids)or plan.person_id not in ids:raise Refusal('binding_denied')
            context.check()
            if origins.current(origin).revision!=plan.revision:raise Refusal('binding_denied')
            if self.closed or self.origins is not origins or self.jobs is not jobs or self.mapping is not mapping or self.reader is not reader:raise Refusal('binding_denied')
            return True
        current(parent)
        origins.claim(parent,origin)
        async def worker(effect):
            async def run(context):
                scoped=EngineContext.scoped(context,lambda _:current(context))
                scoped.check();value=await receiver(plan,scoped);scoped.check();return value
            return await effect(run)
        return jobs.start(key,parent,worker)

    def owns_current(self):return self.jobs.owns_current()
    async def close(self):self.closed=True;await self.jobs.close();self.origins.close()
