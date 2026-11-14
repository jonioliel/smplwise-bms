"""Data-free refresh lifetime seam; it never turns a callback into a result.

The host injects connect/disconnect and an Arx-current decision check. No HA
dispatcher is imported and no native subscription registration is performed.
"""
from dataclasses import dataclass
from uuid import uuid4

from .validation import Refusal
from .source_bindings import same_identities


@dataclass(repr=False)
class RefreshLease:
    reference: str
    context: object
    disconnect: object = None
    active: bool = True
    owners: tuple = ()


class RefreshSubscriptions:
    def __init__(self, connect, emit, current):
        self.connect, self.emit, self.current = connect, emit, current
        self.leases = {}
        self.closed = False

    def _allowed(self, lease):
        try:
            if not same_identities(lease.owners,(self.connect,self.emit,self.current)):return False
            lease.context.check()
            return (not self.closed and lease.active and self.leases.get(lease.reference) is lease
                    and self.current(lease.context.request) is True
                    and same_identities(lease.owners,(self.connect,self.emit,self.current)))
        except Exception:
            return False

    def _drop(self, lease):
        lease.active = False
        if self.leases.get(lease.reference) is lease:
            del self.leases[lease.reference]
        disconnect, lease.disconnect = lease.disconnect, None
        if disconnect is not None:
            try:disconnect()
            except Exception:pass

    async def attach(self, context):
        context.check()
        if self.closed or self.current is None or len(self.leases)>=128:
            raise Refusal('binding_denied')
        lease = RefreshLease('subscription-'+uuid4().hex,context,owners=(self.connect,self.emit,self.current))
        self.leases[lease.reference] = lease
        def changed(*_args, **_kwargs):
            # Incoming source callback data is ignored without inspection.
            if not self._allowed(lease):
                self._drop(lease)
                return
            try:self.emit(lease.reference,{'kind':'refresh'})
            except Exception:self._drop(lease)
        try:
            # Register through the explicitly injected fake/host connector only.
            # The frozen dispatcher registration is synchronous and returns its
            # cleanup callable. Keep that ownership before the next check.
            disconnect = self.connect(changed)
            if not callable(disconnect):
                raise Refusal('binding_denied')
            lease.disconnect = disconnect
            context.check()
            if not self._allowed(lease):
                raise Refusal('grant_revoked')
            return {'subscription_id':lease.reference}
        except BaseException:
            self._drop(lease)
            raise

    def cancel(self, reference):
        lease = self.leases.get(reference)
        if lease is not None:self._drop(lease)

    def close(self):
        self.closed = True
        for lease in tuple(self.leases.values()):self._drop(lease)
