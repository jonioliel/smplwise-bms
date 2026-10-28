"""Narrow injected I/O guard for source-bound development receivers.

Nothing discovers or constructs a real client. Only the four explicit methods
used by the selected call-signal source are forwarded. This boundary checks the
same immutable operation and client identity before and after every await;
there is no generic attribute proxy, retry, transport or organizational RBAC.
"""
from .validation import Refusal
from .source_bindings import same_identities,same_ports
import asyncio
from contextvars import ContextVar
from types import MethodType
from dataclasses import dataclass

_audio_close_owners=ContextVar('wiskey_audio_close_owners',default=frozenset())


@dataclass(frozen=True,repr=False)
class _CallOwner:
    client: object
    current: object
    context: object
    allow_request: bool
    ports: tuple


class CheckedCallClient:
    _PORT_NAMES=('async_confirm_identity','async_call_status','_get','_request')

    def __init__(self, client, current_client, context, *, allow_request=True):
        self._client = client
        self._current = current_client
        self._context = context
        self._allow_request = allow_request
        self._creation = _CallOwner(client,current_client,context,allow_request,
            tuple(getattr(client,name,None)for name in self._PORT_NAMES))

    def _check(self):
        o=self._creation
        def stable():
            if (self._client is not o.client or self._current is not o.current or self._context is not o.context
                or self._allow_request is not o.allow_request
                or not same_ports(o.ports,tuple(getattr(o.client,name,None)for name in CheckedCallClient._PORT_NAMES))):
                raise Refusal('binding_denied')
        stable();o.context.check();stable()
        if o.current() is not o.client:
            raise Refusal('binding_denied')
        stable();o.context.check();stable()

    async def _call(self, method, *args, **kwargs):
        if method not in CheckedCallClient._PORT_NAMES:
            raise Refusal('binding_denied')
        self._check()
        o=self._creation;port=o.ports[CheckedCallClient._PORT_NAMES.index(method)]
        if not callable(port) or method=='_request' and o.allow_request is not True:
            raise Refusal('binding_denied')
        def invoke():
            self._check()
            return port(*args,**kwargs)
        # Only the constructor-owned, explicitly named port can execute.
        result = await o.context.wait(invoke)
        self._check()
        return result

    async def async_confirm_identity(self):
        return await self._call('async_confirm_identity')

    async def async_call_status(self):
        return await self._call('async_call_status')

    async def _get(self, path):
        return await self._call('_get',path)

    async def _request(self, method, path, **kwargs):
        self._check()
        if self._creation.allow_request is not True:
            raise Refusal('binding_denied')
        return await self._call('_request',method,path,**kwargs)


class BoundMediaPort:
    """Explicit source receiver builder, used with local fake clients only here."""
    def __init__(self, current_client, source_receiver):
        self.current_client, self.source_receiver = current_client, source_receiver
        self._creation=(current_client,source_receiver)

    def _check(self,context):
        def stable():
            if not same_identities(self._creation,(self.current_client,self.source_receiver)):
                raise Refusal('binding_denied')
        stable();context.check();stable()

    async def signal(self, parameters, context):
        self._check(context)
        provider,source=self._creation
        station,command=parameters['station_id'],parameters['command']
        def current():
            self._check(context);client=provider(station);self._check(context)
            return client
        client=current()
        if client is None:
            raise Refusal('device_unavailable')
        checked=CheckedCallClient(client,current,context)
        receiver=source(checked);signal_port=receiver.signal
        def unchanged():
            self._check(context);checked._check()
            if not callable(signal_port)or not same_ports((signal_port,),(receiver.signal,)):
                raise Refusal('binding_denied')
        unchanged()
        def invoke():
            unchanged();return signal_port(command)
        result=await context.wait(invoke)
        unchanged()
        return result


class BoundReadPort:
    """One explicitly selected read function, with generic request disabled."""
    def __init__(self, current_client, source_read):
        self.current_client, self.source_read = current_client, source_read
        self._creation=(current_client,source_read)

    def _check(self,context):
        def stable():
            if not same_identities(self._creation,(self.current_client,self.source_read)):
                raise Refusal('binding_denied')
        stable();context.check();stable()

    async def read(self, parameters, context):
        self._check(context)
        provider,source=self._creation;station=parameters['station_id']
        def current():
            self._check(context);client=provider(station);self._check(context)
            return client
        client=current()
        if client is None:raise Refusal('device_unavailable')
        checked=CheckedCallClient(client,current,context,allow_request=False)
        def invoke():
            self._check(context);checked._check()
            return source(checked)
        result=await context.wait(invoke)
        self._check(context);checked._check()
        return result


@dataclass(frozen=True,repr=False)
class _AudioSessionOwner:
    session: object
    current: object
    context: object
    owners: tuple
    ports: tuple
    token: object
    cleanup: list


class CheckedAudioSession:
    """Source TTS session effects under an existing immutable fake context.

    No client/session factory is discovered or called here. Close always joins
    cleanup of the captured owner, even after revocation or owner replacement;
    it is not rollback. This component does not activate tts/start or media.
    """
    def __init__(self,session,current_session,context):
        if session is None or not callable(current_session):raise ValueError('explicit owned audio session required')
        self._session,self._current,self._context=session,current_session,context
        self._owners=(session,current_session,context)
        self._methods=(session.start,session.send,session.close)
        self._method_snapshot=self._methods
        self._closed=False;self._closing=None;self._close_owner=object()
        self._creation=_AudioSessionOwner(session,current_session,context,self._owners,self._methods,self._close_owner,[False,None])

    def _check(self):
        o=self._creation
        def stable():
            if (o.cleanup[0] or self._closed or self._owners is not o.owners or self._methods is not o.ports
                or self._method_snapshot is not o.ports or self._close_owner is not o.token
                or not same_identities(o.owners,(self._session,self._current,self._context))):raise Refusal('binding_denied')
            if not same_ports(o.ports,(o.session.start,o.session.send,o.session.close)):raise Refusal('binding_denied')
        stable();o.context.check();stable()
        if o.current()is not o.session:raise Refusal('binding_denied')
        stable()
        o.context.check()
        stable()

    async def start(self):
        self._check();o=self._creation
        def invoke():
            self._check();return o.ports[0]()
        await o.context.wait(invoke);self._check()

    def send(self,packet):
        self._check();self._creation.ports[1](packet);self._check()

    @property
    def failure(self):
        from .producer import PUBLIC_ERRORS
        self._check();value=self._creation.session.failure;self._check()
        if value is None:return None
        return value if type(value)is str and value in PUBLIC_ERRORS else 'action_failed'

    @property
    def microphone_bytes(self):
        self._check();value=self._creation.session.microphone_bytes;self._check()
        if type(value)is not int or not 0<=value<=2**63-1:raise Refusal('binding_denied')
        return value

    async def close(self):
        o=self._creation;o.cleanup[0]=True
        self._closed=True
        if o.cleanup[1] is None:
            async def cleanup():
                marker=_audio_close_owners.set(_audio_close_owners.get() | {o.token})
                try:await o.ports[2]()
                except Exception:raise Refusal('action_failed') from None
                finally:_audio_close_owners.reset(marker)
            o.cleanup[1]=asyncio.create_task(cleanup());self._closing=o.cleanup[1]
        if o.token in _audio_close_owners.get():return
        cancelled=False
        while not o.cleanup[1].done():
            try:await asyncio.shield(o.cleanup[1])
            except asyncio.CancelledError:cancelled=True
        o.cleanup[1].result()
        if cancelled:raise asyncio.CancelledError
