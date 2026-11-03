"""Typed, key-free handoff boundary. No HA/service/provider/network code is imported."""
from __future__ import annotations

import asyncio
import json
import weakref
from dataclasses import dataclass
from typing import Awaitable, Callable, Mapping

from .envelope import CSV_ACTIONS, OFF_ACTIONS, ClockSample, Request, freeze, thaw
from .journal import Journal
from .resolver import ImmutableResolver, BoundOperation
from .proofs import ProofEmitter, Trace
from .artifacts import Artifacts
from .validation import Refusal, Schema, reference, resource
from .source_bindings import same_identities

SENSITIVE = frozenset({"users/pin_generate", "whatsapp/preview", "whatsapp/send", "tts/start"})
PUBLIC_ERRORS = frozenset({"Unauthorized", "action_failed", "binding_denied", "cursor_stale", "device_unavailable",
                          "grant_revoked", "invalid_field", "invalid_fields", "permission_revision_changed",
                          "permissions_changed", "record_too_large", "status_unknown", "storage_write_failed",
                          "unauthorized", "unknown_action", "unknown_contract_version", "unproven_duplicate"})

# Version negotiation is original construction state, never caller metadata or
# a mutable public instance label. The old schema and default wire stay intact.
_MESSAGING_PACING = weakref.WeakKeyDictionary()


def messaging_pacing_capabilities(producer):
    selected = _MESSAGING_PACING.get(producer) if type(producer) is Producer else None
    return frozenset({"whatsapp_pacing_errors_v1"}) if selected is not None and selected[0] else frozenset()


@dataclass(frozen=True, repr=False)
class AuthenticatedDescriptor:
    """Returned ONLY by the existing trusted bridge verifier, not decoded from caller JSON."""
    public_json: str
    epoch: str
    human_session_active: bool

    def __post_init__(self):
        reference(self.epoch)
        if type(self.public_json) is not str or type(self.human_session_active) is not bool:
            raise Refusal()


@dataclass(frozen=True, repr=False)
class _Permit:
    issuer: object
    request: Request
    epoch: str
    human_session_active: bool


@dataclass(frozen=True, repr=False)
class DispatchReply:
    """Internal handoff. metadata matches W6; projection keeps its own action schema."""
    metadata: Mapping
    projection: object | None = None
    artifact_reference: str | None = None


@dataclass(frozen=True, repr=False)
class _ExecutionGuard:
    """Internal exact bound-operation context, never decoded from JSON.

    The existing one-use producer permit issues it. Its callable still validates
    the actual resolver object, clock and current Arx binding at each boundary.
    An epoch annotation alone is not admission or cryptographic proof.
    """
    request: Request
    bound: BoundOperation
    epoch: str
    check: Callable

    def __call__(self):return self.check()


@dataclass(frozen=True, repr=False)
class Adapter:
    request_schema_id: str
    request_schema_revision: str
    parameters: Schema
    output: Schema
    delegate: Callable[[Mapping], Awaitable[dict]]
    selected_fields: tuple[str, ...]
    with_request: bool = False
    projector: Callable | None = None
    with_guard: bool = False
    profile_status: str = 'UNREVIEWED'
    catalog_seal: object = None

    def project(self, result):
        if self.projector is not None:
            projected = self.projector(result)
            self.output(projected)
            return freeze(projected)
        if type(result) is not dict:
            raise Refusal()
        # Read only selected fields. Never inspect/copy/serialize other values.
        projected = {key: result[key] for key in self.selected_fields if key in result}
        self.output(projected)
        return freeze(projected)


class Registry:
    def __init__(self, selected_rev1: frozenset[str]):
        if selected_rev1!=frozenset(resource('selection.json')['rev1']) or selected_rev1 & (CSV_ACTIONS | OFF_ACTIONS):
            raise ValueError("invalid selection definition")
        self.selected_rev1 = selected_rev1
        self._adapters: dict[str, Adapter] = {}

    def register(self, action: str, adapter: Adapter):
        if action not in self.selected_rev1 | CSV_ACTIONS or action in self._adapters:
            raise ValueError("invalid adapter registration")
        adapter.parameters.require_closed()
        adapter.output.require_closed(projection=True,query_marker=action=='users/query',diagnostic=action in {'overview','conflicts/list'})
        forbidden = {"pin", "pin_configured", "created_at", "last_sync_at", "last_error", "stale", "card_no", "api_key"}
        if action=='users/query' and adapter.output.definition.get('properties',{}).get('stale')=={'type':'boolean'}:forbidden.discard('stale')
        if any(field in forbidden for field in adapter.selected_fields):
            raise ValueError("forbidden projection field")
        self._adapters[action] = adapter

    def admit(self, request: Request) -> Adapter:
        action = request.get("action")
        if action in OFF_ACTIONS or action not in self.selected_rev1 | CSV_ACTIONS:
            raise Refusal("unknown_action")
        adapter = self._adapters.get(action)
        if adapter is None:
            raise Refusal("unknown_action")
        op = request.get("operation")
        if (op["request_schema_id"], op["request_schema_revision"]) != (adapter.request_schema_id, adapter.request_schema_revision):
            raise Refusal("binding_denied")
        if action in SENSITIVE and op["parameter_transport"] != "agreed_sensitive_opaque_reference":
            raise Refusal("binding_denied")
        return adapter


class Producer:
    def __init__(self, registry: Registry, resolver: ImmutableResolver, journal: Journal,
                 clock: Callable[[], ClockSample], current_arx_binding: Callable[[Request], bool], *, enable_rev2=False, proofs: ProofEmitter | None = None, audit=None, artifacts=None, enable_messaging_pacing_v1=False):
        self.registry, self.resolver, self.journal = registry, resolver, journal
        self.clock, self.current_arx_binding = clock, current_arx_binding
        self.enabled = frozenset({"rev1", "rev2"} if enable_rev2 else {"rev1"})
        if type(enable_rev2) is not bool:raise ValueError('invalid selection setting')
        self._result_schema=Schema.from_resource('ACTION_RESULT.draft3.schema.json')
        if type(enable_messaging_pacing_v1) is not bool:raise ValueError('invalid messaging selection')
        _MESSAGING_PACING[self]=(enable_messaging_pacing_v1, Schema.from_resource('MESSAGING_OUTCOME.v1.schema.json') if enable_messaging_pacing_v1 else None)
        self.__issuer = object()
        self.__permits: dict[int, _Permit] = {}
        self.proofs=proofs
        self.audit=audit
        self.artifacts=artifacts if artifacts is not None else Artifacts()
        if proofs is not None:proofs.bind(self.__issuer)

    def _issue_from_ingress(self, verified: AuthenticatedDescriptor):
        sample = self.clock(); sample.check()
        request = Request.parse(verified.public_json, sample.now, self.enabled)
        permit = _Permit(self.__issuer, request, verified.epoch, verified.human_session_active)
        self.__permits[id(permit)] = permit
        return permit

    def _metadata(self, request, *, error=None, certainty="unknown"):
        result = {"schema_version":"wiskey-arx-outcome-draft.3", "kind":"action_result",
                  "request_id":request.get("request_id"), "operation_id":request.get("operation_id"),
                  "outcome":"sent_unknown", "dispatch_certainty":certainty}
        if error is not None:
            result["error"] = {"code":error if error in PUBLIC_ERRORS else "action_failed"}
        return result

    async def _execute(self, permit) -> DispatchReply:
        if type(permit) is not _Permit or self.__permits.pop(id(permit), None) is not permit or permit.issuer is not self.__issuer:
            raise Refusal("Unauthorized")
        request = permit.request
        registry,resolver,journal,clock,binding_current,enabled,proofs,artifacts=(self.registry,self.resolver,self.journal,self.clock,self.current_arx_binding,self.enabled,self.proofs,self.artifacts)
        clock_provider=getattr(clock,'provider',None)
        owners=(registry,resolver,journal,clock,binding_current,enabled,proofs,artifacts)
        pacing_selection=_MESSAGING_PACING.get(self)
        def stable():
            if not same_identities(owners,(self.registry,self.resolver,self.journal,self.clock,self.current_arx_binding,self.enabled,self.proofs,self.artifacts)) or getattr(clock,'provider',None)is not clock_provider:raise Refusal('binding_denied')
            if _MESSAGING_PACING.get(self) is not pacing_selection:raise Refusal('binding_denied')
        reserved = False
        trace=Trace(request,self.__issuer,prior_possible=True,epoch=permit.epoch)
        def reply(metadata, projection=None, artifact_reference=None):
            if metadata.get('schema_version')=='wiskey-arx-messaging-outcome.v1':
                if pacing_selection is None or not pacing_selection[0]:raise Refusal('binding_denied')
                pacing_selection[1](metadata)
            else:self._result_schema(metadata)
            if self.audit is not None:
                actor=request.get('actor')
                entry={'initiator':actor['user_id'] if actor['kind']=='human' else actor['automation_id'],
                       'request_id':request.get('request_id'),'target':request.get('target')['logical_target_id'],'outcome':metadata['outcome']}
                try:self.audit(freeze(entry))
                except Exception:pass  # Audit failure never retries an action or exposes its exception/body.
            return DispatchReply(freeze(metadata),projection,artifact_reference)
        def refusal_reply(code):
            metadata=self._metadata(request,error=code)
            if proofs is not None:
                proof=proofs.refusal(trace,metadata['error']['code'])
                if proof is not None:metadata.update(proof)
            if reserved:
                try:journal.refused(request.get('request_id'))
                except Exception:
                    # A ledger failure never escapes with a cached projection or a success claim.
                    return reply(self._metadata(request,error="action_failed"))
            return reply(metadata)
        try:
            stable()
            sample=clock(); sample.check()
            request.recheck(sample.now,self.enabled)
            trace.prior_possible=journal.prior_possible(request.get('request_id'),request.get('operation_id'),sample.now)
            journal.reserve(request.get("request_id"), request.get("operation_id"), sample.now)
            reserved=True
            if request.get("actor")["kind"] == "human" and not permit.human_session_active:
                raise Refusal("grant_revoked")
            # This callback compares current authenticated Arx decision/binding state; it computes no roles/permissions.
            if binding_current(request) is not True:
                raise Refusal("permission_revision_changed")
            bound = resolver.claim(request, permit.epoch, sample.now)
            adapter = registry.admit(request)
            adapter.parameters(thaw(bound.parameters))
        except Refusal as err:
            return refusal_reply(err.code)
        except Exception:
            if reserved:
                try:journal.finish(request.get('request_id'))
                except Exception:pass
            return reply(self._metadata(request, error="action_failed"))
        except asyncio.CancelledError:
            if reserved:
                try:journal.finish(request.get('request_id'))
                except Exception:pass
            return reply(self._metadata(request))
        try:
            # Dispatch possibility is recorded before the first callback. Every failure/cancel after this is unknown.
            trace.possible=True
            def check_bound():
                stable()
                if registry.admit(request)is not adapter:raise Refusal('binding_denied')
                current=clock();current.check()
                request.check_time(current.now)
                if request.get('selection_revision') not in self.enabled:
                    raise Refusal('binding_denied')
                resolver.validate(bound,request,permit.epoch,current.now)
                if binding_current(request) is not True:
                    raise Refusal('permission_revision_changed')
                stable()
                return True
            check_bound()
            if adapter.with_guard:
                raw = await adapter.delegate(bound.parameters,request,_ExecutionGuard(request,bound,permit.epoch,check_bound))
            elif adapter.with_request:
                raw = await adapter.delegate(bound.parameters,request)
            else:
                raw = await adapter.delegate(bound.parameters)
            check_bound()
            sample=clock(); sample.check()
            request.recheck(sample.now,enabled)
            resolver.validate(bound, request, permit.epoch, sample.now)
            if binding_current(request) is not True:
                raise Refusal("permission_revision_changed")
            projected = adapter.project(raw)
            # Persist terminal uncertainty before making any response artifact visible.
            journal.finish(request.get("request_id"))
            artifact=artifacts.issue(request,permit.epoch,projected,sample.now)
            return reply(self._metadata(request, certainty="possible"), projected,artifact)
        except Refusal as err:
            if pacing_selection is not None and pacing_selection[0] and request.get('action')=='whatsapp/send':
                from ..whatsapp_pacing_outcomes import pacing_refusal_metadata
                pacing_error=pacing_refusal_metadata(err,request=request)
                if pacing_error is not None:
                    try:
                        # A real provider rejection is not fresh source authority.
                        # Recheck after all native/owned cleanup awaits, then
                        # durably retain replay uncertainty before publication.
                        check_bound()
                        journal.finish(request.get('request_id'))
                        check_bound()
                        return reply({'schema_version':'wiskey-arx-messaging-outcome.v1',
                                      'kind':'action_result','request_id':request.get('request_id'),
                                      'operation_id':request.get('operation_id'),'outcome':'not_sent',
                                      'dispatch_certainty':'possible','stage':'post_dispatch',
                                      'error':pacing_error})
                    except Exception:
                        return reply(self._metadata(request,error='status_unknown',certainty='possible'))
            return reply(self._metadata(request, error=err.code, certainty="possible"))
        except asyncio.CancelledError:
            return reply(self._metadata(request, certainty="possible"))
        except Exception:
            return reply(self._metadata(request, error="action_failed", certainty="possible"))
        finally:
            if reserved:
                try:journal.finish(request.get("request_id"))
                except Exception:pass  # Reservation stays pending/unknown; never a reason to redispatch.


class TrustedIngress:
    """The only input is signed_message_json. verifier=None rejects every call.

    Verification is injected from the existing trusted bridge. This core never
    parses/accepts an 'authenticated' flag and never implements key/signature handling.
    """
    def __init__(self, producer: Producer, verifier: Callable[[str], Awaitable[AuthenticatedDescriptor]] | None):
        self.producer, self.verifier = producer, verifier

    async def handle(self, signed_message_json: str):
        if self.verifier is None or type(signed_message_json) is not str:
            return {"error":"Unauthorized"}
        try:
            if len(signed_message_json.encode("utf-8")) > 1048576:
                raise Refusal()
            producer,verifier=self.producer,self.verifier
            verified = await verifier(signed_message_json)
            if self.producer is not producer or self.verifier is not verifier:raise Refusal('Unauthorized')
            if type(verified) is not AuthenticatedDescriptor:
                raise Refusal()
            permit = self.producer._issue_from_ingress(verified)
        except Exception:
            return {"error":"Unauthorized"}
        return await self.producer._execute(permit)
