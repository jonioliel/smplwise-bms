"""Process-local immutable references. Restart never revives a cached binding."""
from __future__ import annotations

from dataclasses import dataclass
from datetime import datetime

from .envelope import Request, freeze, thaw, freeze_parameters
from .validation import aware
from .validation import Refusal, reference


@dataclass(frozen=True, repr=False)
class BoundOperation:
    request: Request
    parameters: object
    epoch: str
    expires: datetime
    descriptor: object = None


class ImmutableResolver:
    def __init__(self, epoch: str, *, max_handles=4096):
        if type(max_handles)is not int or not 1<=max_handles<=65536:raise ValueError('bounded handles required')
        self.epoch = reference(epoch)
        self.max_handles=max_handles
        self._disabled=False
        self._bindings: dict[str, BoundOperation] = {}
        self._revoked: set[str] = set()
        self._parameter_refs: set[str] = set()
        self._binding_refs: set[str] = set()
        self._claimed: set[str] = set()

    def bind(self, request: Request, parameters: dict, expires: datetime, *, resolved_target: dict | None = None):
        key = request.get("operation_binding_ref")
        parameter_ref = request.get("operation")["parameter_reference"]
        if self._disabled or len(self._binding_refs)>=self.max_handles or key in self._binding_refs or parameter_ref in self._parameter_refs or type(parameters) is not dict or expires.tzinfo is None:
            raise Refusal("binding_denied")
        if expires > aware(request.get("request_expires_at")):
            raise Refusal("binding_denied")
        # Every draft3 descriptor has an explicit immutable target. A trusted
        # preparer's missing or different resolution must not reach any adapter.
        target=thaw(request.get('target'))
        if type(resolved_target) is not dict or target != resolved_target or any(type(value)is not type(resolved_target[key]) for key,value in target.items()):
            raise Refusal("binding_denied")
        if request.get("action") == "stations/test_unlock":
            if parameters.get("station_id") != resolved_target.get("config_entry_id") or parameters.get("lock") != resolved_target.get("physical_index"):
                raise Refusal("binding_denied")
        self._bindings[key] = BoundOperation(request, freeze_parameters(parameters), self.epoch, expires, request.descriptor)
        self._parameter_refs.add(parameter_ref)
        self._binding_refs.add(key)

    def claim(self, request: Request, epoch: str, now: datetime) -> BoundOperation:
        """Claim once; retain the object itself across awaits, never resolve anew."""
        binding = self.resolve(request, epoch, now)
        key = request.get("operation_binding_ref")
        if key in self._claimed:
            raise Refusal("binding_denied")
        self._claimed.add(key)
        return binding

    def validate(self, binding: BoundOperation, request: Request, epoch: str, now: datetime):
        key = request.get("operation_binding_ref")
        if self._disabled or key not in self._claimed or self._bindings.get(key) is not binding:
            raise Refusal("binding_denied")
        if epoch != self.epoch or binding.epoch != epoch or now >= binding.expires:
            raise Refusal("binding_denied")
        if request.get("grant")["grant_id"] in self._revoked:
            raise Refusal("grant_revoked")
        if binding.descriptor is not request.descriptor and binding.descriptor != request.descriptor:
            raise Refusal("binding_denied")

    def clear(self):
        self._bindings.clear()
        self._claimed.clear()
        self._parameter_refs.clear()
        self._binding_refs.clear()

    def prune(self, now):
        """Drop expired parameter objects, while retaining used public handles."""
        for key,binding in tuple(self._bindings.items()):
            if now>=binding.expires:
                del self._bindings[key]
                self._claimed.discard(key)

    def revoke(self, grant_id: str):
        grant_id=reference(grant_id)
        if grant_id not in self._revoked and len(self._revoked)>=self.max_handles:
            self._disabled=True
            self._bindings.clear()
            self._claimed.clear()
            return  # Fail closed for the epoch; never drop a revocation to admit.
        self._revoked.add(grant_id)

    def resolve(self, request: Request, epoch: str, now: datetime) -> BoundOperation:
        self.prune(now)
        key = request.get("operation_binding_ref")
        binding = self._bindings.get(key)
        if self._disabled or binding is None or epoch != self.epoch or binding.epoch != epoch or now >= binding.expires:
            raise Refusal("binding_denied")
        if request.get("grant")["grant_id"] in self._revoked:
            raise Refusal("grant_revoked")
        if binding.descriptor is not request.descriptor and binding.descriptor != request.descriptor:
            raise Refusal("binding_denied")
        return binding
