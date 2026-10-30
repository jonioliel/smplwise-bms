"""Bounded public TTS metadata and WhatsApp availability; never sends/starts.

The trusted host injects each read-only source callback. These local profiles
have no HA imports/discovery or provider invocation, and do not select accounts,
look up a person or calculate Arx permissions. All composition remains explicit.
"""
from .validation import Refusal

class TtsMetadata:
    def __init__(self,read_metadata):
        if not callable(read_metadata):raise ValueError('explicit public metadata reader required')
        self.read_metadata=read_metadata
    async def read(self,params,context):
        reader=self.read_metadata
        context.check()
        result=reader()  # Existing available_engines is synchronous and public.
        context.check()
        if self.read_metadata is not reader:raise Refusal('binding_denied')
        return result

class WhatsAppAvailability:
    def __init__(self,has_service,has_accounts):
        if not callable(has_service) or not callable(has_accounts):raise ValueError('explicit catalogue/existence readers required')
        self.has_service,self.has_accounts=has_service,has_accounts
    async def read(self,params,context):
        service,accounts=self.has_service,self.has_accounts
        def current():
            context.check()
            if self.has_service is not service or self.has_accounts is not accounts:raise Refusal('binding_denied')
        current();configured=accounts();current()
        send=service('whatsapp','send_message');current()
        history=service('whatsapp','get_chat_messages');current()
        if any(type(v)is not bool for v in (configured,send,history)):raise Refusal('invalid_fields')
        # Exact source predicates. Account IDs/names, credentials and quota are
        # absent from this deliberately bounded projection.
        return {'available':send and configured,'history':history}

class IntegrationMetadata:
    """Three proven diagnostics fields only; no metrics/client/firmware reads."""
    def __init__(self,current_entry,integration_version):
        if not callable(current_entry) or type(integration_version)is not str:raise ValueError('explicit entry reader and public version required')
        self.current_entry,self.integration_version=current_entry,integration_version
    async def read(self,params,context):
        reader,version=self.current_entry,self.integration_version
        context.check();entry=reader(params['station_id']);context.check()
        if self.current_entry is not reader or entry is None:raise Refusal('device_unavailable')
        if entry.entry_id!=params['station_id']:raise Refusal('binding_denied')
        runtime=getattr(entry,'runtime_data',None)
        closed=None if runtime is None else runtime.is_closed
        if closed is not None and type(closed)is not bool:raise Refusal('invalid_fields')
        result={'integration_version':version,'loaded':runtime is not None and not closed,
                'config_schema':{'version':entry.version,'minor_version':entry.minor_version}}
        context.check()
        if self.current_entry is not reader or self.integration_version!=version or reader(params['station_id'])is not entry or getattr(entry,'runtime_data',None)is not runtime or (runtime is not None and runtime.is_closed is not closed):raise Refusal('binding_denied')
        return result

class FleetAlertsRead:
    """Injected source public report; selected fields are enforced by the spec."""
    def __init__(self,read_report):
        if not callable(read_report):raise ValueError('explicit read-only public report producer required')
        self.read_report=read_report
    async def read(self,params,context):
        reader=self.read_report
        result=await context.wait(lambda:reader(params))
        if self.read_report is not reader:raise Refusal('binding_denied')
        return result
