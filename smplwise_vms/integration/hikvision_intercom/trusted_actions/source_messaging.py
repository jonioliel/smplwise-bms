"""Owned original messaging dispatch with synthetic source ports, OFF.

Arx consent/queue admission stays in OpaqueMessaging. This component pins the
WisKey dispatcher, manager, source connection and cache, and accepts only the
two selected closed calls. It defines no provider, quota, transport or private
edit field. A source acknowledgment is not evidence of message delivery.
"""
from .source_bindings import same_ports

from types import MethodType
from .adapters import EngineContext
from .messaging import MessageAcknowledgment
from .sensitive_producers import PersonMetadata,same_person
from .source_message_frames import OwnedPreviewCache
from .validation import Refusal,reference


def _same(a,b):
    if a is b:return True
    return a.__self__ is b.__self__ and a.__func__ is b.__func__ if type(a) is MethodType and type(b) is MethodType else a is b


class SourceMessagingProducer:
    def __init__(self,*,current_dispatch,current_hass,current_manager,current_owners,current_person,cache,domain):
        callbacks=(current_dispatch,current_hass,current_manager,current_owners,current_person)
        if not all(callable(p) for p in callbacks) or type(cache) is not OwnedPreviewCache:raise ValueError('explicit original messaging source ports required')
        self.dispatch,self.hass,self.manager,self.owners,self.person=callbacks
        self.cache=cache;self.domain=reference(domain);self.closed=False
        self._source=current_dispatch();self._hass=current_hass();self._manager=current_manager();self._owners=tuple(current_owners())
        if not callable(self._source) or not self._owners or any(v is None for v in self._owners):raise ValueError('explicit source identity required')
        self._bound=self.ports()
        self._creation=(self._source,self._hass,self._manager,self.cache,self._owners,self._bound,*callbacks)

    def _check_metadata(self):
        current=(self._source,self._hass,self._manager,self.cache,self._owners,self._bound,
            self.dispatch,self.hass,self.manager,self.owners,self.person)
        if (type(self.closed)is not bool or self.closed
            or any(a is not b for a,b in zip(self._creation,current))
            or self.cache.closed is not False):raise Refusal('binding_denied')

    def _check_ports(self):
        self._check_metadata();current=self.ports();self._check_metadata()
        if not same_ports(self._creation[5],current):raise Refusal('binding_denied')

    def ports(self):
        hass,manager=self.hass(),self.manager();data=hass.data;source=data.get(self.domain)
        if type(source) is not dict or source.get('whatsapp_previews') is not self.cache:raise Refusal('binding_denied')
        namespace=getattr(self._source,'__globals__',{})
        algorithms=tuple(namespace.get(k) for k in ('DOMAIN','AccessError','access_message','_accounts','whatsapp_number','render_template','message_warnings','secrets'))
        return (self.dispatch,self.hass,self.manager,self.owners,self.person,self.cache,self.cache.pop,self.cache.source_consumption,self.domain,self.dispatch(),hass,manager,
            data,source,source.get('whatsapp_templates'),hass.services,hass.services.has_service,hass.services.async_call,
            hass.config_entries,hass.config_entries.async_entries,hass.loop,hass.loop.time,
            manager.repository,manager.repository.get,manager.stations,getattr(self._source,'__code__',None),*algorithms)

    def check(self,context):
        self._check_metadata();context.check();self._check_ports()
        owners=tuple(self.owners())
        self._check_ports()
        if len(owners)!=len(self._owners) or any(a is not b for a,b in zip(owners,self._owners)):raise Refusal('binding_denied')
        context.check()
        person=self.person(context.request);context.check()
        if type(person) is not PersonMetadata or not same_person(person,person) or person.person_id!=context.parameters.get('user_id'):raise Refusal('binding_denied')
        # A person/authority callback may have changed the dispatch ports.
        # Reread every source owner after those callbacks, never a verdict.
        self._check_ports()
        owners=tuple(self.owners())
        self._check_ports()
        if len(owners)!=len(self._owners) or any(a is not b for a,b in zip(owners,self._owners)):raise Refusal('binding_denied')
        return person

    async def prepare(self,opaque,context):
        if type(context) is not EngineContext or context.parameters is None or context.request.get('action')!='whatsapp/preview' or set(context.parameters)!={'user_id','account','language'}:raise Refusal('binding_denied')
        person=self.check(context);params=context.parameters
        source,hass=self._creation[:2]
        def dispatch():
            if not same_person(self.check(context),person):raise Refusal('binding_denied')
            return source(hass,'whatsapp/preview',
                {k:params[k] for k in ('user_id','account','language')},context.request.get('actor')['user_id'])
        value=await context.wait(dispatch)
        if not same_person(self.check(context),person):raise Refusal('binding_denied')
        return value

    async def send(self,opaque,private,context):
        if type(context) is not EngineContext or context.parameters is None or context.request.get('action')!='whatsapp/send' or set(context.parameters)!={'user_id','account','preview_reference','confirmed'} or context.parameters.get('confirmed') is not True:
            raise Refusal('binding_denied')
        if type(private) is not dict or set(private)!={'token','recipient','message','warnings'}:raise Refusal('binding_denied')
        person=self.check(context);params=context.parameters
        source,hass=self._creation[:2]
        def before_consume():
            if not same_person(self.check(context),person):raise Refusal('binding_denied')
        # The original dispatcher calls repository/account/clock callbacks
        # before consuming its preview. Check at that last synchronous step
        # as well as on entry/return, before a provider can be invoked.
        with self.cache.source_consumption(context,before_consume):
            def dispatch():
                if not same_person(self.check(context),person):raise Refusal('binding_denied')
                return source(hass,'whatsapp/send',
                    {'user_id':params['user_id'],'account':params['account'],'confirmed':True,'token':private['token'],'message':private['message']},context.request.get('actor')['user_id'])
            result=await context.wait(dispatch)
        if not same_person(self.check(context),person):raise Refusal('binding_denied')
        if type(result) is not dict or set(result)!={'accepted'} or result['accepted'] is not True:raise Refusal('action_failed')
        return MessageAcknowledgment(True)

    def close(self):self.closed=True
