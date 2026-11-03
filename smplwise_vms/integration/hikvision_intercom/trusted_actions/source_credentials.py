"""Post-save source credential identities for bounded local OFF composition.

The admitted source receiver calls observe only after its owned repository save.
Births contain public IDs, revisions and provenance only. Private card values
are compared inside the injected source provider in RAM, never returned,
formatted, measured or hashed. These are not Arx decisions or wire fields.
"""
from dataclasses import dataclass
from types import MethodType
from .adapters import EngineContext
from .jobs import Provenance, same_parameters
from .validation import Refusal, Schema, reference

# Original build_user storage bounds, not station/firmware capabilities.
MAX_SOURCE_CARDS=255
MAX_SOURCE_ASSIGNMENTS=100


def _same(a,b):
    if a is b:return True
    return a.__self__ is b.__self__ and a.__func__ is b.__func__ if type(a) is MethodType and type(b) is MethodType else a is b


@dataclass(frozen=True,repr=False)
class CredentialBirth:
    issuer:object
    request:object
    parent:Provenance
    parameters:object
    person_id:str
    revision:int
    resource_id:str
    stations:tuple
    providers:tuple


@dataclass(frozen=True,repr=False)
class _PersonValues:
    request:object
    parameters:object
    epoch:object
    person:str
    revision:int
    reader:object
    repository:object
    employee:object
    pin:object
    issuer:object


class SourceCredentialResources:
    def __init__(self, current_user, managed_card_type, *, limit=4096):
        if not callable(current_user) or not isinstance(managed_card_type,type) or managed_card_type is object or type(limit) is not int or not 1<=limit<=4096:
            raise ValueError('explicit source credential provider and bound required')
        self.current_user,self.card_type,self.limit=current_user,managed_card_type,limit
        self._issuer=object();self._records={};self._used=set();self._seen=set();self.closed=False
        self._creation=(current_user,managed_card_type,limit,self._issuer,self._records,self._used,self._seen)

    def _check_owner(self):
        reader,card_type,limit,issuer,records,used,seen=self._creation
        if (type(self.closed)is not bool or self.closed or not _same(reader,self.current_user)
            or self.card_type is not card_type or type(self.limit)is not int or self.limit!=limit
            or self._issuer is not issuer or self._records is not records
            or self._used is not used or self._seen is not seen):raise Refusal('binding_denied')

    def _checkpoint(self,context):
        self._check_owner()
        if type(context)is not EngineContext:raise Refusal('binding_denied')
        context.check();self._check_owner()

    def _record(self,context):
        record=self._creation[4].get(context.request.get('operation_binding_ref'))
        if (type(record)is not tuple or len(record)!=5 or record[0] is not context.request
            or type(record[1])is not dict or type(record[2])is not dict
            or type(record[4])is not _PersonValues or record[4].issuer is not self._creation[3]
            or record[4].request is not context.request):raise Refusal('binding_denied')
        return record

    def observe(self,context,person,revision):
        return self._observe(context,person,revision)

    def observe_policy_renewal(self,context,continuation):
        from .source_policy_continuations import current_credential_birth
        person,revision=current_credential_birth(continuation,context,self)
        return self._observe(context,person,revision,renewal=True)

    def observe_capture(self,context,receiver,person,revision):
        from .legacy_capture import LegacyCaptureReceiver,current_confirm_context,current_confirm_birth
        if type(receiver) is not LegacyCaptureReceiver:raise Refusal('binding_denied')
        origin=current_confirm_context(receiver);birth=current_confirm_birth(receiver)
        if context.request is not origin.request or context.epoch!=origin.epoch or not same_parameters(context.parameters,origin.parameters) or context.parameters.get('session_id')!=birth.session_id or person!=birth.person or type(revision) is not int or revision!=birth.revision+1:
            raise Refusal('binding_denied')
        return self._observe(context,person,revision,capture=True)

    def _observe(self,context,person,revision,*,capture=False,renewal=False):
        if type(context) is not EngineContext or context.parameters is None or context.epoch is None:raise Refusal('binding_denied')
        self._checkpoint(context);action=context.request.get('action');params=context.parameters
        if action not in {'users/create','users/update','users/set_active','users/archive','users/unarchive','users/temporary_cancel','cards/add','cards/remove','cards/capture_confirm'}:
            raise Refusal('binding_denied')
        expected=1 if action=='users/create' else params.get('revision',0)+1
        if renewal:
            if capture or action not in {'users/create','users/update'} or type(revision) is not int or revision<1:raise Refusal('binding_denied')
        elif capture:
            if action!='cards/capture_confirm':raise Refusal('binding_denied')
        elif type(revision) is not int or revision!=expected or action!='users/create' and params.get('user_id')!=person:raise Refusal('binding_denied')
        key=context.request.get('operation_binding_ref')
        reader,card_type,limit,issuer,records,used,seen=self._creation
        if key in seen or len(seen)>=limit:raise Refusal('binding_denied')
        user=reader(person);self._checkpoint(context)
        if self.closed or not _same(reader,self.current_user) or self.card_type is not card_type or user.id!=person or type(user.revision) is not int or user.revision!=revision:
            raise Refusal('binding_denied')
        if (type(user.cards)is not list or len(user.cards)>MAX_SOURCE_CARDS
            or type(user.assignments)is not dict or len(user.assignments)>MAX_SOURCE_ASSIGNMENTS):raise Refusal('binding_denied')
        stations=tuple(user.assignments)
        for station in stations:reference(station)
        cards={};values={}
        for card in user.cards:
            if type(card) is not card_type:raise Refusal('binding_denied')
            identifier=card.id;Schema({'type':'string','format':'uuid'})(identifier)
            if identifier in cards:raise Refusal('binding_denied')
            cards[identifier]=CredentialBirth(issuer,context.request,Provenance.capture(context.request,context.epoch),params,person,revision,identifier,stations,(reader,card_type))
            # Expected source values live only in this request's private RAM
            # binding. They are never part of CredentialBirth, an artifact,
            # audit, diagnostic, content hash, length or public descriptor.
            number=card.card_no.value
            if type(number)is not str or any(number==previous for previous in values.values()):raise Refusal('binding_denied')
            values[identifier]=number
        repository=reader.__self__ if type(reader) is MethodType else None
        if repository is None:raise Refusal('binding_denied')
        state=repository._state;raw=state['users'].get(person)
        pin=None if user.pin is None else user.pin.value
        def current_person():
            if (type(raw) is not dict or raw.get('id')!=person or type(raw.get('revision'))is not int or raw['revision']!=revision
                or type(user.employee_no) is not str or pin is not None and type(pin) is not str
                or type(raw.get('employee_no')) is not str or raw['employee_no']!=user.employee_no
                or type(raw.get('pin')) is not type(pin) or raw.get('pin')!=pin
                or repository._state is not state or state['users'].get(person)is not raw):raise Refusal('binding_denied')
        current_person()
        private=_PersonValues(context.request,params,context.epoch,person,revision,reader,repository,user.employee_no,pin,issuer)
        self._checkpoint(context);current_person()
        seen.add(key);records[key]=(context.request,cards,values,user.employee_no,private)
        try:self._checkpoint(context);current_person()
        except BaseException:
            SourceCredentialResources.discard(self,context.request)
            raise
        return tuple(cards.values())

    def check_person(self,context,person,revision,repository):
        """Check exact private birth values without rebuilding/serializing a user.

        Only the admitted source worker calls this. These values never leave
        this provider. Fresh authority remains the caller's independent guard.
        """
        self._checkpoint(context)
        records=self._creation[4];key=context.request.get('operation_binding_ref')
        record=self._record(context)
        birth=record[4]
        if (type(birth) is not _PersonValues or birth.issuer is not self._creation[3] or birth.request is not context.request
            or birth.epoch!=context.epoch or birth.parameters is not context.parameters and not same_parameters(birth.parameters,context.parameters)
            or birth.repository is not repository or not _same(birth.reader,self.current_user)
            or birth.person!=person or type(revision) is not int or birth.revision!=revision):raise Refusal('binding_denied')
        state=repository._state;raw=state['users'].get(person)
        def current():
            if (records.get(key)is not record or type(raw) is not dict or raw.get('id')!=person
                or type(raw.get('revision')) is not int or raw['revision']!=revision
                or type(raw.get('employee_no')) is not str or raw['employee_no']!=birth.employee
                or type(raw.get('pin')) is not type(birth.pin) or raw.get('pin')!=birth.pin
                or repository._state is not state or state['users'].get(person) is not raw):raise Refusal('binding_denied')
        current();self._checkpoint(context);current()

    def _current(self,context,birth,station):
        self._checkpoint(context)
        if self.closed or type(birth) is not CredentialBirth or birth.issuer is not self._issuer or birth.request is not context.request or birth.parent!=Provenance.capture(context.request,context.epoch) or birth.parameters is not context.parameters and not same_parameters(birth.parameters,context.parameters):raise Refusal('binding_denied')
        records=self._creation[4];key=context.request.get('operation_binding_ref');record=self._record(context)
        if record[1].get(birth.resource_id) is not birth or not _same(birth.providers[0],self.current_user) or birth.providers[1] is not self.card_type:raise Refusal('binding_denied')
        user=self._creation[0](birth.person_id);self._checkpoint(context)
        if records.get(key)is not record:raise Refusal('binding_denied')
        if user.id!=birth.person_id or type(user.revision) is not int or user.revision!=birth.revision or tuple(user.assignments)!=birth.stations or station not in birth.stations:
            raise Refusal('binding_denied')
        matches=[c for c in user.cards if type(c) is self.card_type and c.id==birth.resource_id]
        if len(matches)!=1 or matches[0].card_no.value!=record[2][birth.resource_id] or user.employee_no!=record[3]:raise Refusal('binding_denied')
        self._checkpoint(context)
        if records.get(key)is not record:raise Refusal('binding_denied')
        return matches[0]

    def for_value(self,context,person,revision,station,value,*,required=True):
        # Only the trusted source driver calls this with its pending source
        # argument. This method emits metadata, never the private argument.
        if type(value) is not str:raise Refusal('binding_denied')
        self._checkpoint(context);records=self._creation[4];key=context.request.get('operation_binding_ref');record=self._record(context)
        matches=[]
        for birth in record[1].values():
            if birth.person_id!=person or birth.revision!=revision:raise Refusal('binding_denied')
            card=self._current(context,birth,station)
            if card.card_no.value==value:matches.append(birth)
        if len(matches)>1 or required and not matches:raise Refusal('binding_denied')
        self._checkpoint(context)
        if records.get(key)is not record:raise Refusal('binding_denied')
        return matches[0] if matches else None

    def claim(self,context,birth,station,stage):
        card=self._current(context,birth,station)
        if stage in {'create_card','update_card'} and card.enabled is not True:raise Refusal('binding_denied')
        key=(birth.parent.parent_operation_id,birth.resource_id,station,stage)
        used=self._creation[5]
        if key in used or len(used)>=self._creation[2]:raise Refusal('unproven_duplicate')
        used.add(key);self._checkpoint(context)

    def check_claim(self,context,birth,station,stage):
        card=self._current(context,birth,station)
        if stage in {'create_card','update_card'} and card.enabled is not True:raise Refusal('binding_denied')
        if (birth.parent.parent_operation_id,birth.resource_id,station,stage) not in self._creation[5]:raise Refusal('binding_denied')

    def discard(self,request):
        records=self._creation[4]
        for key,record in tuple(records.items()):
            if type(record)is tuple and len(record)==5 and record[0] is request:records.pop(key,None)

    def close(self):
        self.closed=True
        for table in self._creation[4:]:table.clear()
