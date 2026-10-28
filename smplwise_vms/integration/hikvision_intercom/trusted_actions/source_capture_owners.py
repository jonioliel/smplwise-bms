"""Connection identities for an explicitly injected OFF capture source.

Identity only: client, pooled session, settings object, generation and method
owners. No address, credentials, settings content, card or source body is read.
"""
from types import MethodType
from .source_bindings import same_identities
from .validation import Refusal


class SourceCaptureOwners:
    def __init__(self,current_client,current_generation):
        if not callable(current_client) or not callable(current_generation):raise ValueError('explicit source connection providers required')
        self.client,self.generation=current_client,current_generation
        self._ports=(current_client,current_generation)
        self._creation=self._ports

    def _check_owner(self):
        reader,generation=self._creation
        if self._ports is not self._creation or self.client is not reader or self.generation is not generation:raise Refusal('binding_denied')

    @staticmethod
    def _methods(client):
        owners=[]
        for name in ('async_confirm_identity','_get'):
            method=getattr(client,name,None)
            if type(method) is MethodType:owners.extend((method.__self__,method.__func__))
            elif callable(method):owners.append(method)
            else:raise Refusal('binding_denied')
        return tuple(owners)

    def __call__(self,station):
        self._check_owner();reader,generation=self._creation
        client=reader(station);self._check_owner()
        version=generation(station);self._check_owner()
        if client is None or version is None:raise Refusal('binding_denied')
        session,settings=client._session,client.settings
        if session is None or settings is None:raise Refusal('binding_denied')
        methods=self._methods(client)
        if reader(station) is not client:raise Refusal('binding_denied')
        self._check_owner()
        if generation(station) is not version:raise Refusal('binding_denied')
        self._check_owner()
        if client._session is not session or client.settings is not settings or not same_identities(methods,self._methods(client)):
            raise Refusal('binding_denied')
        return (client,session,settings,version,*methods)
