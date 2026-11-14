"""One-use source birth metadata for newly retired resources, never values."""
from dataclasses import dataclass
from .adapters import EngineContext
from .envelope import freeze
from .jobs import Provenance,same_parameters
from .validation import Refusal,Schema,reference
from .source_bindings import same_identities

@dataclass(frozen=True,repr=False)
class RetirementBirth:
    issuer:object
    parent:Provenance
    descriptor:object
    parameters:object
    kind:str
    resource_id:str
    person_id:str
    revision:int
    stations:tuple
    providers:tuple

@dataclass(frozen=True,repr=False)
class BirthCheckpoint:
    issuer:object
    descriptor:object
    epoch:str
    kind:str
    keys:frozenset
    providers:tuple

@dataclass(frozen=True,repr=False)
class _Ownership:
    state:object
    revision:object
    limit:int
    bind_card_values:bool
    issuer:object
    items:dict
    used:set
    checkpoints:dict
    private:dict
    requests:dict
    checkpoint_owners:dict
    checkpoint_seals:dict
    birth_seals:dict

class RetirementBirths:
    def __init__(self,current_state,current_revision,*,limit=4096,bind_card_values=False):
        if not callable(current_state) or not callable(current_revision) or type(limit) is not int or not 1<=limit<=4096:
            raise ValueError('explicit bounded source metadata providers required')
        if type(bind_card_values) is not bool:raise ValueError('explicit source binding mode required')
        self.state,self.revision,self.limit=current_state,current_revision,limit
        self.bind_card_values=bind_card_values
        self._issuer=object();self._items={};self._used=set();self._checkpoints={};self.closed=False
        # Private comparison material exists only in the exact admitted
        # request's RAM binding. Births/descriptors/evidence contain no value,
        # content hash or length. Legacy metadata-only callers inspect none.
        self._private={};self._requests={};self._checkpoint_owners={}
        self._creation=_Ownership(current_state,current_revision,limit,bind_card_values,self._issuer,
            self._items,self._used,self._checkpoints,self._private,self._requests,self._checkpoint_owners,{}, {})

    def _check_owner(self):
        o=self._creation
        if (type(self.closed)is not bool or self.closed or self.state is not o.state or self.revision is not o.revision
            or type(self.limit)is not int or self.limit!=o.limit or type(self.bind_card_values)is not bool or self.bind_card_values is not o.bind_card_values
            or self._issuer is not o.issuer or not same_identities((o.items,o.used,o.checkpoints,o.private,o.requests,o.checkpoint_owners),
                (self._items,self._used,self._checkpoints,self._private,self._requests,self._checkpoint_owners))):raise Refusal('binding_denied')

    def _checkpoint(self,context):
        self._check_owner()
        if type(context)is not EngineContext:raise Refusal('binding_denied')
        context.check();self._check_owner()

    def _rows(self,kind):
        self._check_owner()
        if kind not in ('retired_cards','retired_pins'):raise Refusal('binding_denied')
        state=self._creation.state();self._check_owner()
        if type(state)is not dict or type(state.get(kind))is not dict or len(state[kind])>10000:raise Refusal('binding_denied')
        return state,state[kind]

    def _keys(self,kind):
        _,rows=self._rows(kind)
        return frozenset(rows)  # public resource identities only

    @staticmethod
    def _checkpoint_fields(before):
        return before.issuer,before.descriptor,before.epoch,before.kind,before.keys,before.providers

    @staticmethod
    def _birth_fields(birth):
        return (birth.issuer,birth.parent,birth.descriptor,birth.parameters,birth.kind,
            birth.resource_id,birth.person_id,birth.revision,birth.stations,birth.providers)

    @staticmethod
    def _pending_stations(row):
        targets,confirmed=row.get('targets'),row.get('confirmed')
        if (type(targets)is not list or type(confirmed)is not list
            or any(type(station)is not str for station in (*targets,*confirmed))or len(set(targets))!=len(targets)
            or len(set(confirmed))!=len(confirmed)or not set(confirmed)<=set(targets)):raise Refusal('binding_denied')
        for station in targets:reference(station)
        return tuple(station for station in targets if station not in confirmed)
    def snapshot(self,kind,context):
        if type(context) is not EngineContext or context.parameters is None or context.epoch is None:
            raise Refusal('binding_denied')
        self._checkpoint(context);key=(context.request.get('operation_binding_ref'),kind)
        expected=context.parameters.get('revision');person=context.parameters.get('user_id')
        if type(expected)is not int or expected<1:raise Refusal('binding_denied')
        Schema({'type':'string','format':'uuid'})(person)
        o=self._creation;revision=o.revision(person);self._check_owner()
        checkpoints,owners=o.checkpoints,o.checkpoint_owners
        if key in checkpoints or len(checkpoints)>=o.limit or type(revision) is not int or revision!=expected:
            raise Refusal('binding_denied')
        checkpoint=BirthCheckpoint(o.issuer,context.request.descriptor,context.epoch,kind,self._keys(kind),(o.state,o.revision))
        checkpoints[key]=checkpoint;owners[key]=context.request
        o.checkpoint_seals[key]=self._checkpoint_fields(checkpoint)
        try:
            self._checkpoint(context)
            fresh=o.revision(person);self._check_owner()
            if (type(fresh)is not int or fresh!=expected or self._keys(kind)!=checkpoint.keys
                or checkpoints.get(key)is not checkpoint or owners.get(key)is not context.request
                or not same_identities(o.checkpoint_seals.get(key),self._checkpoint_fields(checkpoint))):raise Refusal('binding_denied')
        except BaseException:
            RetirementBirths.discard(self,context.request);raise
        return checkpoint
    def observe(self,context,kind,person,revision,before):
        if type(context) is not EngineContext or context.parameters is None or context.epoch is None or type(before) is not BirthCheckpoint:
            raise Refusal('binding_denied')
        self._checkpoint(context)
        key=(context.request.get('operation_binding_ref'),kind)
        o=self._creation;provider,reader=o.state,o.revision
        limit,private,issuer=o.limit,o.bind_card_values,o.issuer
        items,checkpoints,values,requests,owners=o.items,o.checkpoints,o.private,o.requests,o.checkpoint_owners
        # A foreign request may not consume the original owner's checkpoint.
        if private and owners.get(key)is not context.request:raise Refusal('binding_denied')
        if (before.issuer is not issuer or checkpoints.get(key)is not before or before.descriptor!=context.request.descriptor
                or before.epoch!=context.epoch or before.kind!=kind or type(before.providers)is not tuple or len(before.providers)!=2
                or provider is not before.providers[0] or reader is not before.providers[1]
                or not same_identities(o.checkpoint_seals.get(key),self._checkpoint_fields(before))):
            raise Refusal('binding_denied')
        previous_keys=before.keys
        checkpoints.pop(key);owners.pop(key,None);o.checkpoint_seals.pop(key,None)
        current_revision=reader(person);self._check_owner();expected=context.parameters.get('revision')
        if (type(revision)is not int or type(current_revision)is not int or current_revision!=revision
            or type(expected)is not int or expected<1 or context.parameters.get('user_id')!=person or expected+1!=revision):
            raise Refusal('binding_denied')
        state,rows=self._rows(kind);births=[];pending_values={};row_owners={};new_keys=frozenset(rows)-previous_keys
        for key in sorted(new_keys):
            Schema({'type':'string','format':'uuid'})(key)
            raw=rows[key]
            if type(raw)is not dict:raise Refusal('binding_denied')
            if raw['user_id']!=person:continue
            stations=self._pending_stations(raw)
            if key in items or len(items)+len(births)>=limit:raise Refusal('binding_denied')
            birth=RetirementBirth(issuer,Provenance.capture(context.request,context.epoch),context.request.descriptor,context.parameters,kind,key,person,revision,stations,(provider,reader))
            births.append(birth);row_owners[key]=raw
            if private and kind=='retired_cards':
                if type(raw.get('card_no')) is not str:raise Refusal('binding_denied')
                pending_values[key]=raw['card_no']
        self._checkpoint(context)
        fresh_revision=reader(person);self._check_owner();fresh_state,fresh_rows=self._rows(kind)
        if (type(fresh_revision)is not int or fresh_revision!=revision or fresh_state is not state or fresh_rows is not rows
            or frozenset(rows)-previous_keys!=new_keys or len(items)+len(births)>limit
            or any(birth.resource_id in items for birth in births)):raise Refusal('binding_denied')
        for birth in births:
            raw=rows.get(birth.resource_id)
            if (raw is not row_owners[birth.resource_id] or raw.get('user_id')!=person
                or self._pending_stations(raw)!=birth.stations
                or birth.resource_id in pending_values and (type(raw.get('card_no'))is not str or raw['card_no']!=pending_values[birth.resource_id])):raise Refusal('binding_denied')
        # Publish one complete generation only after every row/last callback is
        # checked. A malformed later row cannot leave a partial private birth.
        for birth in births:
            items[birth.resource_id]=birth;requests[birth.resource_id]=context.request
            o.birth_seals[birth.resource_id]=self._birth_fields(birth)
        values.update(pending_values)
        return tuple(births)
    def _identity(self,context,birth):
        o=self._creation
        if (type(birth)is not RetirementBirth or type(birth.resource_id)is not str
            or birth.issuer is not o.issuer or o.items.get(birth.resource_id)is not birth
            or not same_identities(o.birth_seals.get(birth.resource_id),self._birth_fields(birth))
            or birth.descriptor!=context.request.descriptor or birth.parent!=Provenance.capture(context.request,context.epoch)
            or not same_parameters(birth.parameters,context.parameters)or type(birth.revision)is not int
            or type(birth.providers)is not tuple or len(birth.providers)!=2
            or birth.providers[0]is not o.state or birth.providers[1]is not o.revision):raise Refusal('binding_denied')

    def _row(self,context,birth,station=None):
        self._check_owner();self._identity(context,birth);o=self._creation
        state,rows=self._rows(birth.kind);row=rows.get(birth.resource_id)
        revision=o.revision(birth.person_id);self._check_owner();self._identity(context,birth)
        fresh_state,fresh_rows=self._rows(birth.kind);self._identity(context,birth)
        if (type(row)is not dict or row.get('user_id')!=birth.person_id or type(revision)is not int or revision!=birth.revision
            or fresh_state is not state or fresh_rows is not rows or state.get(birth.kind)is not rows
            or rows.get(birth.resource_id)is not row):raise Refusal('binding_denied')
        pending=self._pending_stations(row)
        if not set(pending)<=set(birth.stations)or station is not None and (station not in birth.stations or station not in pending):raise Refusal('binding_denied')
        if o.bind_card_values and birth.kind=='retired_cards':
            if (o.requests.get(birth.resource_id)is not context.request or birth.resource_id not in o.private
                or type(row.get('card_no'))is not str or row['card_no']!=o.private[birth.resource_id]):raise Refusal('binding_denied')
        return state,rows,row

    def _validate(self,context,birth,station):
        self._checkpoint(context);before=self._row(context,birth,station)
        self._checkpoint(context);after=self._row(context,birth,station)
        if not same_identities(before,after):raise Refusal('binding_denied')
        return birth

    def for_value(self,value,context):
        """Match a pending source deletion to its newly born public ID."""
        self._checkpoint(context);o=self._creation
        if not o.bind_card_values or type(value)is not str:raise Refusal('binding_denied')
        matches=[];row_owners=[]
        for key,request in tuple(o.requests.items()):
            if request is not context.request or key not in o.private or o.private[key]!=value:continue
            birth=o.items.get(key)
            if type(birth)is not RetirementBirth or birth.kind!='retired_cards':raise Refusal('binding_denied')
            row_owners.append(self._row(context,birth));matches.append(birth)
        if len(matches)!=1:raise Refusal('binding_denied')
        self._checkpoint(context)
        if o.private.get(matches[0].resource_id)!=value or not same_identities(row_owners[0],self._row(context,matches[0])):raise Refusal('binding_denied')
        return matches[0]
    def claim(self,context,birth,station):
        self._validate(context,birth,station);key=(birth.resource_id,station)
        if key in self._creation.used:raise Refusal('unproven_duplicate')
        self._creation.used.add(key);self._checkpoint(context);self._row(context,birth,station);return birth
    def check_claim(self,context,birth,station):
        self._validate(context,birth,station)
        if (birth.resource_id,station) not in self._creation.used:raise Refusal('binding_denied')
        return birth
    def discard(self,request):
        o=self._creation;retired=set()
        for key,owner in tuple(o.requests.items()):
            if owner is request:
                o.requests.pop(key,None);o.items.pop(key,None);o.private.pop(key,None);o.birth_seals.pop(key,None);retired.add(key)
        for key in tuple(o.used):
            if type(key)is tuple and len(key)==2 and key[0]in retired:o.used.discard(key)
        for key,owner in tuple(o.checkpoint_owners.items()):
            if owner is request:o.checkpoint_owners.pop(key,None);o.checkpoints.pop(key,None);o.checkpoint_seals.pop(key,None)

    def close(self):
        self.closed=True;o=self._creation
        for table in (o.items,o.used,o.checkpoints,o.private,o.requests,o.checkpoint_owners,o.checkpoint_seals,o.birth_seals):table.clear()
