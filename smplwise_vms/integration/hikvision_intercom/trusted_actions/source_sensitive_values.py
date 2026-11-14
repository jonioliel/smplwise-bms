"""Selected original PG/photo source values, retained privately before await.

This local OFF producer exposes neither a value nor a transport. The original
repository generates/checks PINs; the original photo parser checks the source
field. Only the owned factory's RAM retainer receives the result. Human-only
admission and the public person revision remain bound to the same request.
"""
from .source_bindings import same_ports

from types import MethodType
from .adapters import EngineContext
from .jobs import same_parameters
from .sensitive_producers import PersonMetadata,same_person
from .source_identity import SourceIdentities
from .validation import Refusal


def _same(a,b):
    if a is b:return True
    return a.__self__ is b.__self__ and a.__func__ is b.__func__ if type(a) is MethodType and type(b) is MethodType else a is b


class SourceSensitiveValues:
    def __init__(self,*,repository,bound_person,photo_enabled,photo_parser):
        if repository is None or not all(callable(p) for p in (bound_person,photo_enabled,photo_parser)) or not callable(getattr(repository,'generate_unique_pin',None)) or not callable(getattr(repository,'pin_available',None)):
            raise ValueError('explicit original private source dependencies required')
        self.repository,self.bound_person,self.photo_enabled,self.photo_parser=repository,bound_person,photo_enabled,photo_parser
        self.identities=SourceIdentities(repository);self._ports=self.ports();self.closed=False

    def ports(self):
        return (self.repository,self.bound_person,self.photo_enabled,self.photo_parser,self.identities,self.identities.repository,
            self.repository.generate_unique_pin,self.repository.pin_available)

    def check(self):
        if self.closed or not same_ports(self._ports,self.ports()):raise Refusal('binding_denied')

    def current_person(self,request):
        self.check()
        if request.get('action')=='users/photo_get':
            enabled=self.photo_enabled();self.check()
            if enabled is not True:raise Refusal('action_failed')
        person=self.bound_person(request);self.check()
        if person=='':
            if request.get('action')!='users/pin_generate':raise Refusal('binding_denied')
            return None
        identity=self.identities.identity(person);self.check()
        return PersonMetadata(identity.id,identity.revision)

    async def produce(self,action,opaque,context,retain):
        if type(context) is not EngineContext or context.parameters is None or context.request.get('action')!=action or action not in {'users/pin_generate','users/photo_get'} or context.request.get('actor')['kind']!='human' or not callable(retain):raise Refusal('binding_denied')
        context.check();self.check();params=context.parameters
        if set(params)!={'user_id'} or self.bound_person(context.request)!=params['user_id']:raise Refusal('binding_denied')
        person=self.current_person(context.request);context.check()
        if action=='users/pin_generate':
            # Original generator and collision/retirement checks, only inside
            # synthetic source RAM. Opaque input is never inspected or echoed.
            private={'pin':self.repository.generate_unique_pin(exclude_user_id=params['user_id'] or None)}
        else:
            if person is None or self.photo_enabled() is not True:raise Refusal('action_failed')
            self.check();context.check();state=self.repository._state;users=state['users']
            row=users.get(person.person_id)
            if type(row) is not dict:raise Refusal('binding_denied')
            original=row.get('photo');value=self.photo_parser(original)
            if value is None:raise Refusal('action_failed')
            private={'photo':value}
            # Parser return is a callback boundary. Reusing the same revision
            # or row cannot certify a replaced map or private source value.
            if (self.repository._state is not state or state['users'] is not users
                or users.get(person.person_id) is not row or row.get('photo') is not original):raise Refusal('binding_denied')
        # No await occurs between creation and retention. If the final source
        # check refuses, the factory already owns and cleans this exact value.
        retain(private)
        self.check();context.check()
        if not same_person(self.current_person(context.request),person):raise Refusal('binding_denied')
        return None

    def close(self):self.closed=True
