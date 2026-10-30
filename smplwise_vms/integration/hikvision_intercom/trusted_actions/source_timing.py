"""Internal native-plan resource provenance. No registration or runtime grant.

Only an already admitted source mutation can derive these write boundaries.
Journal/normalizer/compiler ports are explicit, owned dependencies. A journal
intent is necessary but supplies no authority: every resource still requires
fresh Arx admission through SourceEffectSession.
"""
from .source_bindings import same_ports,same_identities

from dataclasses import dataclass
from types import MethodType
from .adapters import EngineContext
from .envelope import freeze, thaw
from .jobs import Provenance, same_parameters
from .validation import Refusal, reference

KINDS = frozenset({'weekly', 'template', 'holiday_group', 'holiday'})
ROOTS = {'weekly':'UserRightWeekPlanCfg','template':'UserRightPlanTemplate','holiday_group':'UserRightHolidayGroupCfg','holiday':'UserRightHolidayPlanCfg'}


@dataclass(frozen=True,repr=False)
class PolicyCompletion:
    issuer:object
    context:object
    person_id:str
    revision:int


class SourcePolicyWorker:
    """Owned source worker seam, invoked only by a revision-3 local candidate.

    The run port must perform fresh per-effect admission; this wrapper does not
    confer the parent's authority on a timer, retry or child. No scheduler is
    started here and no policy route becomes accessible in the product.
    """
    def __init__(self, run, current_user, owners, *, limit=128):
        if not all(callable(p) for p in (run, current_user, owners)) or type(limit) is not int or not 1 <= limit <= 4096:
            raise ValueError('explicit bounded policy worker ports required')
        self.run, self.current_user, self.owners = run, current_user, owners
        self.continuations=None;self._completion_issuer=object();self._completed={}
        self.limit = limit; self.closed = False; self._used = set(); self._active = set()
        self._creation=(run,current_user,owners,limit,self._completion_issuer,self._used,self._active,self._completed,{})
        self._continuation_owner=[None,False]

    def _check_owner(self):
        run,user,owners,limit,issuer,used,active,completed,seals=self._creation
        continuation,admitted=self._continuation_owner
        if (type(self.closed)is not bool or self.closed or type(self.limit)is not int or self.limit!=limit
            or not same_ports((run,user,owners),(self.run,self.current_user,self.owners))
            or self._completion_issuer is not issuer or self._used is not used or self._active is not active or self._completed is not completed
            or admitted and self.continuations is not continuation):raise Refusal('binding_denied')

    @staticmethod
    def _completion_fields(completed):return completed.issuer,completed.context,completed.person_id,completed.revision

    async def enqueue(self, person_id, revision, context):
        import asyncio
        if type(context) is not EngineContext or type(revision) is not int or revision<1: raise Refusal('binding_denied')
        self._check_owner()
        reference(person_id)
        context.check();self._check_owner();key = context.request.get('operation_binding_ref')
        if not self._continuation_owner[1]:self._continuation_owner[:]=[self.continuations,True]
        used,active,completed,seals=self._creation[5:]
        if self.closed or key in self._used or len(self._used) >= self.limit: raise Refusal('binding_denied')
        ports = (self.run, self.current_user, self.owners,self.continuations); owners = tuple(self.owners())
        def current(_):
            self._check_owner()
            context.check()
            self._check_owner()
            if self.closed or not same_ports(ports,(self.run,self.current_user,self.owners,self.continuations)): raise Refusal('binding_denied')
            fresh = tuple(self.owners())
            self._check_owner()
            user=self.current_user(person_id)
            self._check_owner()
            if len(fresh) != len(owners) or any(a is not b for a, b in zip(fresh, owners)) or type(user.id) is not str or user.id!=person_id or type(user.revision) is not int or user.revision != revision: raise Refusal('binding_denied')
            return True
        current(None); used.add(key)
        scoped = EngineContext.scoped(context,current); scoped.trace = context.trace
        task = asyncio.current_task(); active.add(task)
        try:
            value=await scoped.wait(lambda:ports[0](person_id,revision,scoped));current(None)
            if ports[3] is not None:
                from .source_policy_continuations import SourcePolicyContinuations
                if type(ports[3]) is not SourcePolicyContinuations:raise Refusal('binding_denied')
                receipt=PolicyCompletion(self._creation[4],scoped,person_id,revision)
                completed[key]=receipt;seals[key]=self._completion_fields(receipt)
                ports[3].arm(receipt);current(None)
                if key in completed or key in seals:raise Refusal('binding_denied')
            return value
        finally:
            completed.pop(key,None);seals.pop(key,None);active.discard(task)

    def claim_completion(self,completed,consumer):
        self._check_owner();issuer=self._creation[4];items,seals=self._creation[7:]
        if type(completed) is not PolicyCompletion or completed.issuer is not issuer or self.continuations is not consumer or not self._continuation_owner[1]:raise Refusal('binding_denied')
        if len(items)>self._creation[3]:raise Refusal('binding_denied')
        keys=[key for key,value in items.items()if value is completed]
        if len(keys)!=1:raise Refusal('binding_denied')
        key=keys[0];context=completed.context
        if type(context)is not EngineContext:raise Refusal('binding_denied')
        def identity():
            self._check_owner()
            if (items.get(key)is not completed or not same_identities(seals.get(key),self._completion_fields(completed))
                or self.continuations is not consumer):raise Refusal('binding_denied')
        identity();context.check();identity()
        items.pop(key);seals.pop(key)
        return completed

    def close(self):
        self.closed = True
        # Tombstones persist for this lifetime. Close must never make a prior
        # admission reusable while an in-flight callback unwinds.
        self._creation[7].clear();self._creation[8].clear()


def same_owner(a, b):
    if a is b:return True
    if type(a) is MethodType and type(b) is MethodType:
        return a.__self__ is b.__self__ and a.__func__ is b.__func__
    return a is b


@dataclass(frozen=True, repr=False)
class TimingResourceBirth:
    issuer: object
    parent: Provenance
    descriptor: object
    parameters: object
    person_id: str
    revision: int
    station_id: str
    transaction_id: str
    key: str
    kind: str
    resource_id: str
    body: object
    context: object
    policy: object
    providers: tuple


@dataclass(frozen=True,repr=False)
class _TimingOwner:
    providers:tuple
    limit:int
    issuer:object
    items:dict
    used:set
    seals:dict


class SourceTimingResources:
    def __init__(self, *, transaction, current_user, normalize_policy, user_schedule,
                 compile_schedule, transactions=None, limit=256):
        if not all(callable(p) for p in (transaction, current_user, normalize_policy, user_schedule, compile_schedule)) or type(limit) is not int or not 1 <= limit <= 4096:
            raise ValueError('explicit bounded source timing ports required')
        self.transaction, self.current_user = transaction, current_user
        self.normalize_policy, self.user_schedule, self.compile_schedule = normalize_policy, user_schedule, compile_schedule
        if transactions is not None and not callable(transactions):raise ValueError('explicit transaction metadata provider required')
        self.transactions=transactions
        self.limit = limit; self.closed = False
        self._issuer = object(); self._items = {}; self._used = set()
        self._creation=_TimingOwner(self._providers()[1:5],limit,self._issuer,self._items,self._used,{})
        # Source assembly may attach a transaction-list reader or compose the
        # two-station journal reader before first use. Pin both journal ports
        # at first admission; never adopt a later replacement.
        self._transaction_owner=[(transaction,transactions),False]

    def _providers(self):
        return (self.transaction, self.current_user, self.normalize_policy, self.user_schedule, self.compile_schedule, self.transactions)

    def _check_owner(self):
        o=self._creation;transactions,admitted=self._transaction_owner
        if (type(self.closed)is not bool or self.closed or type(self.limit)is not int or self.limit!=o.limit
            or self._issuer is not o.issuer or self._items is not o.items or self._used is not o.used
            or not same_ports(o.providers,self._providers()[1:5])
            or not callable(self.transaction)or admitted and not same_ports(transactions,(self.transaction,self.transactions))
            or self.transactions is not None and not callable(self.transactions)):raise Refusal('binding_denied')

    def _checkpoint(self,parent,*,admit=False):
        self._check_owner()
        if type(parent)is not EngineContext:raise Refusal('binding_denied')
        parent.check();self._check_owner()
        if admit and not self._transaction_owner[1]:self._transaction_owner[:]=[(self.transaction,self.transactions),True]

    @staticmethod
    def _birth_fields(birth):
        return (birth.issuer,birth.parent,birth.descriptor,birth.parameters,birth.person_id,birth.revision,birth.station_id,
            birth.transaction_id,birth.key,birth.kind,birth.resource_id,birth.body,birth.context,birth.policy,birth.providers)

    def _identity(self,parent,birth,station_id):
        o=self._creation
        if (type(birth)is not TimingResourceBirth or type(birth.transaction_id)is not str or type(birth.key)is not str
            or birth.issuer is not o.issuer or o.items.get((birth.transaction_id,birth.key))is not birth
            or not same_identities(o.seals.get((birth.transaction_id,birth.key)),self._birth_fields(birth))
            or birth.descriptor!=parent.request.descriptor or birth.parent!=Provenance.capture(parent.request,parent.epoch)
            or birth.station_id!=station_id or not same_parameters(birth.parameters,parent.parameters)
            or not same_ports(birth.providers,self._providers())):raise Refusal('binding_denied')

    def pending_write(self,parent,*,person_id,revision,station_id,route,body):
        self._checkpoint(parent,admit=True);providers=self._providers()
        if self.closed or self.transactions is None or type(route) is not str or type(body) is not dict:raise Refusal('binding_denied')
        rows=self.transactions();self._check_owner();matches=[]
        if type(rows) is not list or len(rows)>256:raise Refusal('binding_denied')
        for row in rows:
            item=self.transaction(row['id']);self._check_owner()
            if item['station_id']!=station_id:continue
            intent=next((step for step in item['steps'] if step['state']=='intent'),None)
            if intent is None:continue
            resources=self.compile_schedule(item['draft'],item['bindings'],item['capabilities']);self._check_owner()
            for resource in resources:
                expected='/ISAPI/AccessControl/'+ROOTS[resource['kind']]+'/'+str(resource['id'])+'?format=json'
                if resource['key']==intent['key'] and route==expected and same_parameters(resource['body'],body):matches.append((item['id'],resource))
        self._checkpoint(parent)
        if not same_ports(providers,self._providers()) or len(matches)!=1:raise Refusal('binding_denied')
        transaction_id,resource=matches[0]
        return self.issue(parent,person_id=person_id,revision=revision,station_id=station_id,transaction_id=transaction_id,resource=resource)

    def issue(self, parent, *, person_id, revision, station_id, transaction_id, resource):
        if type(parent) is not EngineContext or parent.epoch is None or parent.parameters is None:
            raise Refusal('binding_denied')
        self._checkpoint(parent,admit=True)
        if self.closed or parent.request.get('action') not in {'users/create', 'users/update'}:
            raise Refusal('binding_denied')
        operation = parent.request.get('operation')
        if operation['request_schema_id'] != 'urn:wiskey:local-source-policy:' + parent.request.get('action').replace('/', ':') or operation['request_schema_revision'] != '3':
            raise Refusal('binding_denied')
        policy = self.normalize_policy(thaw(parent.parameters)['data'].get('access_timing_policy'));self._check_owner()
        if type(policy) is not dict or policy['mode'] != 'native': raise Refusal('binding_denied')
        user = self.current_user(person_id);self._check_owner()
        if type(revision) is not int or revision < 1 or user.id != person_id or type(user.revision) is not int or user.revision != revision or not same_parameters(user.access_timing_policy, policy):
            raise Refusal('binding_denied')
        item = self.transaction(transaction_id);self._check_owner()
        expected=self.user_schedule(policy['schedule']);self._check_owner()
        if item['station_id'] != station_id or not same_parameters(item['draft'], expected):
            raise Refusal('binding_denied')
        candidates = self.compile_schedule(item['draft'], item['bindings'], item['capabilities']);self._check_owner()
        if type(resource) is not dict or not any(same_parameters(resource,candidate) for candidate in candidates) or resource['kind'] not in KINDS:
            raise Refusal('binding_denied')
        intent = next((r for r in item['steps'] if r['state'] == 'intent'), None)
        if intent is None or intent['key'] != resource['key']: raise Refusal('binding_denied')
        key = (transaction_id, resource['key'])
        if key in self._items or len(self._items) >= self.limit: raise Refusal('unproven_duplicate')
        birth = TimingResourceBirth(self._issuer, Provenance.capture(parent.request, parent.epoch),
            parent.request.descriptor, parent.parameters, person_id, revision, station_id,
            transaction_id, resource['key'], resource['kind'], transaction_id + ':' + resource['key'],
            freeze(resource['body']), freeze(item['context']), freeze(policy), self._providers())
        self._items[key] = birth
        self._creation.seals[key]=self._birth_fields(birth)
        try:self.check(parent, birth, station_id)
        except BaseException:
            if self._creation.items.get(key)is birth:self._creation.items.pop(key,None);self._creation.seals.pop(key,None)
            raise
        return birth

    def _proof(self,parent,birth,station_id):
        self._check_owner();self._identity(parent,birth,station_id)
        user = self.current_user(birth.person_id)
        self._check_owner();self._identity(parent,birth,station_id)
        if user.id!=birth.person_id or type(user.revision) is not int or user.revision != birth.revision or not same_parameters(user.access_timing_policy, birth.policy): raise Refusal('binding_denied')
        item = self.transaction(birth.transaction_id)
        self._check_owner();self._identity(parent,birth,station_id)
        intent = next((r for r in item['steps'] if r['state'] == 'intent'), None)
        if item['station_id'] != station_id or not same_parameters(item['context'], birth.context) or intent is None or intent['key'] != birth.key:
            raise Refusal('binding_denied')
        expected=self.user_schedule(thaw(birth.policy)['schedule']);self._check_owner();self._identity(parent,birth,station_id)
        if not same_parameters(item['draft'],expected):raise Refusal('binding_denied')
        candidates = self.compile_schedule(item['draft'], item['bindings'], item['capabilities'])
        self._check_owner();self._identity(parent,birth,station_id)
        row = next((r for r in candidates if r['key'] == birth.key), None)
        if row is None or row['kind']!=birth.kind or not same_parameters(row['body'], birth.body): raise Refusal('binding_denied')
        # Recheck the captured public source objects after compiler callbacks.
        if (user.id!=birth.person_id or type(user.revision)is not int or user.revision!=birth.revision
            or not same_parameters(user.access_timing_policy,birth.policy)or item['station_id']!=station_id
            or not same_parameters(item['context'],birth.context)or not same_parameters(item['draft'],expected)
            or next((r for r in item['steps']if r['state']=='intent'),None)is not intent or intent['key']!=birth.key):raise Refusal('binding_denied')
        return freeze({'draft':item['draft'],'bindings':item['bindings'],'capabilities':item['capabilities'],'context':item['context']})

    def check(self, parent, birth, station_id):
        self._checkpoint(parent);before=self._proof(parent,birth,station_id)
        self._checkpoint(parent);after=self._proof(parent,birth,station_id)
        if not same_parameters(before,after):raise Refusal('binding_denied')
        return birth

    def claim(self, parent, birth, station_id):
        self.check(parent, birth, station_id)
        if birth.resource_id in self._creation.used: raise Refusal('unproven_duplicate')
        self._creation.used.add(birth.resource_id); return birth

    def check_claim(self, parent, birth, station_id):
        self.check(parent, birth, station_id)
        if birth.resource_id not in self._creation.used: raise Refusal('binding_denied')

    def close(self):
        self.closed = True; self._creation.items.clear();self._creation.seals.clear()
