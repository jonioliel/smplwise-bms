"""Bounded station derivation for an explicitly admitted user mutation.

The original body/target remain unchanged in every fresh child admission. A
separate immutable local plan selects the user/revision and the station from
the host's target mapping. It is not a new request schema or a classic worker
grant. Only an injected source jobs reader and fake receiver are used here.
"""
from dataclasses import dataclass
from .source_bindings import same_identities

from .adapters import EngineContext
from .envelope import freeze,thaw
from .jobs import DerivedJobs,same_parameters
from .validation import Refusal,Schema,reference


ACTIONS=frozenset({'users/update','users/set_active','users/archive','users/unarchive','users/temporary_cancel'})


@dataclass(frozen=True,repr=False)
class StationPlan:
    source_action:str
    station_id:str
    user_id:str
    expected_revision:int
    desired_revision:int
    target:object
    mapping:object
    parameters:object
    epoch:str


class StationEffect:
    """A receiver sees derived metadata while authority stays on the original."""
    def __init__(self,context,plan,current):
        def admitted(_):current(context,plan);return True
        scoped=EngineContext.scoped(context,admitted)
        self._context,self._plan,self._current=scoped,plan,current
        self._identity=(scoped,plan,current)

    @property
    def plan(self):return self._plan

    def check(self):
        if not same_identities(self._identity,(self._context,self._plan,self._current)):raise Refusal('binding_denied')
        self._context.check()
        if not same_identities(self._identity,(self._context,self._plan,self._current)):raise Refusal('binding_denied')

    async def wait(self,factory):
        self.check()
        result=await self._context.wait(factory)
        self.check();return result


class StationWorkers:
    def __init__(self,fresh_admission,*,journal,clock_sample,current_mapping,jobs_for_station,current_revision=None,limit=128):
        if not callable(current_mapping) or not callable(jobs_for_station):raise ValueError('explicit source jobs and target mapping required')
        if current_revision is not None and not callable(current_revision):raise ValueError('explicit source revision reader required')
        self.mapping,self.jobs_for_station=current_mapping,jobs_for_station
        self.current_revision=current_revision
        self.jobs=DerivedJobs(fresh_admission,journal=journal,clock_sample=clock_sample,limit=limit)
        self._owned_jobs=self.jobs
        self.closed=False

    def _plan(self,parent):
        if self.closed or self.jobs is not self._owned_jobs or not callable(self.current_revision) or type(parent)is not EngineContext or parent.parameters is None or parent.epoch is None:raise Refusal('binding_denied')
        parent.check();request=parent.request;params=parent.parameters
        if request.get('action') not in ACTIONS:raise Refusal('binding_denied')
        user=params.get('user_id');revision=params.get('revision')
        Schema({'type':'string','format':'uuid'})(user)
        if type(revision)is not int or revision<1:raise Refusal('binding_denied')
        mapping=self.mapping(request)
        if type(mapping)is not dict:raise Refusal('binding_denied')
        target=thaw(request.get('target'))
        if any(type(mapping.get(k))is not type(v) or mapping.get(k)!=v for k,v in target.items()):raise Refusal('binding_denied')
        station=reference(mapping.get('config_entry_id'))
        plan=StationPlan(request.get('action'),station,user,revision,revision+1,request.get('target'),freeze(mapping),params,parent.epoch)
        return plan

    def start(self,key,parent,receiver):
        if not callable(receiver):raise Refusal('binding_denied')
        mapping,reader,jobs,revision_reader=self.mapping,self.jobs_for_station,self.jobs,self.current_revision
        plan=self._plan(parent)
        def current(context,candidate):
            if self.closed or self.mapping is not mapping or self.jobs_for_station is not reader or self.jobs is not jobs or self.current_revision is not revision_reader or candidate is not plan:raise Refusal('binding_denied')
            context.check()
            if context.epoch!=plan.epoch or context.request.get('action')!=plan.source_action or not same_parameters(context.request.get('target'),plan.target) or not same_parameters(context.parameters,plan.parameters):raise Refusal('binding_denied')
            if not same_parameters(mapping(context.request),plan.mapping):raise Refusal('binding_denied')
            revision=revision_reader(plan.station_id,plan.user_id)
            if type(revision)is not int or revision!=plan.desired_revision:raise Refusal('binding_denied')
            ids=reader(plan.station_id)
            if type(ids)is not list or len(ids)>10000 or any(type(v)is not str for v in ids) or len(set(ids))!=len(ids) or plan.user_id not in ids:raise Refusal('binding_denied')
            context.check()
            if self.closed or self.mapping is not mapping or self.jobs_for_station is not reader or self.jobs is not jobs or self.current_revision is not revision_reader:raise Refusal('binding_denied')
            fresh_revision=revision_reader(plan.station_id,plan.user_id)
            if type(fresh_revision)is not int or fresh_revision!=plan.desired_revision or not same_parameters(mapping(context.request),plan.mapping):raise Refusal('binding_denied')
            if self.closed or self.mapping is not mapping or self.jobs_for_station is not reader or self.jobs is not jobs or self.current_revision is not revision_reader:raise Refusal('binding_denied')
        current(parent,plan)
        async def worker(effect):
            async def send(context):
                checked=StationEffect(context,plan,current);checked.check()
                result=await receiver(checked)
                checked.check();return result
            return await effect(send)
        return jobs.start(key,parent,worker)

    async def close(self):
        self.closed=True
        await self._owned_jobs.close()

    def owns_current(self):return self._owned_jobs.owns_current()
