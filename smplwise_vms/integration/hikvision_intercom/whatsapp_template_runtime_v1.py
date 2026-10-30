"""Native, source-bound Arx template path; no recipient-consent prerequisite.

This numbered route borrows the existing Cloud provider, accounting and owned
queue resources. It has no default source, provider configuration or queue.
In-process construction is not installation or agreement on an Arx wire API.
"""

from __future__ import annotations

import asyncio
import hashlib
import json
import re
import weakref
from dataclasses import astuple, dataclass, field
from types import MappingProxyType

from .access.manager import AccessManager
from .access.models import ManagedUser
from .access.pin_quarantine import NativePinDeliveryPolicy
from .access.repository import AccessRepository
from .media_lifetime import join_owned
from .native_whatsapp_accounting import NativeWhatsAppAccounting
from .phone import whatsapp_number
from .trusted_actions.adapters import EngineContext
from .trusted_actions.envelope import thaw
from .trusted_actions.owned_resources import OwnedObject, OwnedResources
from .trusted_actions.source_bindings import same_ports
from .trusted_actions.validation import Refusal, reference
from .whatsapp_cloud_templates import ApprovedTextTemplate, CloudTemplateProvider

COMMAND = "whatsapp/template_send_v1"
KEY = "arx_template_send_v1"
FIELDS = frozenset(
    {
        "schema_version",
        "request_id",
        "operation_id",
        "recipient_ref",
        "account",
        "template_name",
        "language",
        "parameters",
    }
)
CONSENT_POLICY = "owner-arx-template-v1-recipient-consent-not-required"
_SOURCES = weakref.WeakKeyDictionary()
_HOSTS = weakref.WeakKeyDictionary()


def descriptor(value):
    """Copy only a bounded closed template request; no policy from JSON."""
    if type(value) is not dict or set(value) != FIELDS:
        raise Refusal("invalid_fields")
    if type(value["schema_version"]) is not int or value["schema_version"] != 1:
        raise Refusal("invalid_fields")
    for key in ("request_id", "operation_id", "recipient_ref", "account"):
        reference(value[key])
    if (
        type(value["template_name"]) is not str
        or re.fullmatch(r"[a-z][a-z0-9_]{0,127}", value["template_name"]) is None
        or type(value["language"]) is not str
        or re.fullmatch(r"[a-z]{2,3}(?:_[A-Z]{2})?", value["language"]) is None
        or type(value["parameters"]) is not list
        or len(value["parameters"]) > 20
        or any(
            type(v) is not str or not 1 <= len(v) <= 1024 or any(ord(c) < 32 for c in v)
            for v in value["parameters"]
        )
    ):
        raise Refusal("invalid_fields")
    result = {key: value[key] for key in FIELDS - {"parameters"}}
    result["parameters"] = list(value["parameters"])
    if len(_encoded(result)) > 32768:
        raise Refusal("invalid_fields")
    return result


def _encoded(value):
    return json.dumps(
        value, sort_keys=True, separators=(",", ":"), ensure_ascii=True, allow_nan=False
    ).encode()


def _result(state, code):
    return {
        "schema_version": 1,
        "state": state,
        "code": code,
        "provider_accepted": True
        if state == "accepted"
        else False
        if state == "not_sent"
        else None,
        "delivery": "unknown",
        "retry_permitted": False,
    }


class TemplateExecutionSourceV1:
    """Trusted native admission/current ports, never a caller policy document.

    The real bridge composition must authenticate its original principal,
    descriptor, actor RBAC/scope, source epoch, recipient and current grant.
    admit returns an original EngineContext for COMMAND, carrying these exact
    parameters. check re-resolves that original authority synchronously. No
    default implementation, HA account or Arx signed-envelope shape is supplied.
    """

    def __init__(self, source, *, admit, check, is_current):
        if source is None or not all(callable(p) for p in (admit, check, is_current)):
            raise ValueError("original authenticated native source ports required")
        self.source, self.admit, self.check, self.is_current = source, admit, check, is_current
        _SOURCES[self] = source, admit, check, is_current

    def stable(self):
        original = _SOURCES.get(self)
        if (
            original is None
            or self.source is not original[0]
            or not same_ports(original[1:], (self.admit, self.check, self.is_current))
            or original[3](original[0]) is not True
        ):
            raise Refusal("template_source_unavailable")
        if self.source is not original[0] or not same_ports(
            original[1:], (self.admit, self.check, self.is_current)
        ):
            raise Refusal("template_source_unavailable")
        return original


@dataclass(frozen=True, repr=False)
class ArxTemplateConsentPolicyV1:
    """Explicit native policy for this route only; not a forged consent fact."""

    directive: str = CONSENT_POLICY

    def check(self):
        if self.directive != CONSENT_POLICY:
            raise Refusal("template_source_unavailable")


@dataclass(repr=False)
class _QueueClaim:
    item: object
    value: object
    close: object
    task: object = None
    failed: object = None


@dataclass(repr=False)
class _Owner:
    roots: tuple
    ports: tuple
    active: dict = field(default_factory=dict)
    receipts: dict = field(default_factory=dict)
    operations: dict = field(default_factory=dict)
    claims: dict = field(default_factory=dict)
    stopping: bool = False
    cleanup_failed: bool = False
    bridge_requests: dict = field(default_factory=dict)
    bridge_operations: dict = field(default_factory=dict)
    pacing_results: dict = field(default_factory=dict)


@dataclass(frozen=True, repr=False)
class _BridgeAdmission:
    principal: object
    connection: object
    host: object
    guard: object
    context: object

    def check(self, connection, context):
        from .bridge_command_auth import VerifiedBridgePrincipal

        if (
            type(self.principal) is not VerifiedBridgePrincipal
            or connection is not self.connection
            or context is not self.context
        ):
            raise Refusal("Unauthorized")
        self.principal.check()
        if (
            self.principal.repository is not self.host.manager.repository
            or self.principal.owner_key[3] is not connection
        ):
            raise Refusal("Unauthorized")
        if self.guard() is not None:
            raise Refusal("template_source_unavailable")
        return True


class NativeTemplateSendHostV1:
    """One real provider path behind original current authority and queue ports.

    Claim_queue must return the original OwnedObject from the installed queue;
    neither a ready marker nor a read binding is an execution binding. Providers
    and accounting are borrowed. This host owns only its own tasks/resources.
    """

    def __init__(
        self,
        manager,
        source,
        *,
        providers,
        templates,
        accounting,
        claim_queue,
        policy,
        epoch,
        pin_delivery_policy=None,
    ):
        if (
            type(manager) is not AccessManager
            or type(manager.repository) is not AccessRepository
            or type(source) is not TemplateExecutionSourceV1
            or type(providers) is not tuple
            or not 1 <= len(providers) <= 128
            or any(type(p) is not CloudTemplateProvider for p in providers)
            or type(templates) is not tuple
            or not 1 <= len(templates) <= 128
            or any(type(t) is not ApprovedTextTemplate for t in templates)
            or type(accounting) is not NativeWhatsAppAccounting
            or not callable(claim_queue)
            or type(policy) is not ArxTemplateConsentPolicyV1
        ):
            raise ValueError("original native template composition required")
        ArxTemplateConsentPolicyV1.check(policy)
        TemplateExecutionSourceV1.stable(source)
        account_names = [p.account.account for p in providers]
        if (
            len(set(account_names)) != len(account_names)
            or len({(t.account, t.name, t.language) for t in templates}) != len(templates)
            or any(t.account not in account_names for t in templates)
        ):
            raise ValueError("unique approved template/provider bindings required")
        if pin_delivery_policy is not None and (
            type(pin_delivery_policy) is not NativePinDeliveryPolicy
            or pin_delivery_policy.repository is not manager.repository
        ):
            raise ValueError("original PIN delivery policy required")
        if any("pin" in t.parameter_fields for t in templates) and pin_delivery_policy is None:
            raise ValueError("templates containing PIN require native PIN delivery policy")
        accounting_owner = NativeWhatsAppAccounting.check(accounting)
        if accounting_owner.providers is not providers:
            raise ValueError("same original accounting provider tuple required")
        self.manager, self.source = manager, source
        self.providers, self.templates, self.accounting = providers, templates, accounting
        self.claim_queue, self.policy, self.pin_delivery_policy = (
            claim_queue,
            policy,
            pin_delivery_policy,
        )
        self.resources = OwnedResources(epoch=epoch)
        roots = (
            manager,
            manager.repository,
            source,
            providers,
            templates,
            accounting,
            claim_queue,
            policy,
            pin_delivery_policy,
            self.resources,
            tuple(astuple(t) for t in templates),
            epoch,
        )
        _HOSTS[self] = _Owner(
            roots,
            (
                manager.repository.get,
                claim_queue,
                pin_delivery_policy.require if pin_delivery_policy is not None else None,
            ),
        )

    def stable(self):
        owner = _HOSTS.get(self)
        if owner is None or owner.stopping:
            raise Refusal("template_source_unavailable")
        roots = owner.roots
        if (
            self.manager._closed
            or any(
                a is not b
                for a, b in zip(
                    (
                        self.manager,
                        self.manager.repository,
                        self.source,
                        self.providers,
                        self.templates,
                        self.accounting,
                        self.claim_queue,
                        self.policy,
                        self.pin_delivery_policy,
                        self.resources,
                    ),
                    roots[:10],
                    strict=True,
                )
            )
            or tuple(astuple(t) for t in roots[4]) != roots[10]
            or not same_ports(
                owner.ports,
                (
                    roots[1].get,
                    self.claim_queue,
                    self.pin_delivery_policy.require
                    if self.pin_delivery_policy is not None
                    else None,
                ),
            )
        ):
            raise Refusal("template_source_unavailable")
        TemplateExecutionSourceV1.stable(roots[2])
        ArxTemplateConsentPolicyV1.check(roots[7])
        NativeWhatsAppAccounting.check(roots[5])
        for provider in roots[3]:
            CloudTemplateProvider.check(provider)
        NativeTemplateSendHostV1._bindings(self, owner)
        return owner

    def _bindings(self, owner):
        """Callback-free final ownership fence after injected current ports."""
        roots = owner.roots
        if (
            _HOSTS.get(self) is not owner
            or owner.stopping
            or any(
                a is not b
                for a, b in zip(
                    (
                        self.manager,
                        self.source,
                        self.providers,
                        self.templates,
                        self.accounting,
                        self.claim_queue,
                        self.policy,
                        self.pin_delivery_policy,
                        self.resources,
                    ),
                    (
                        roots[0],
                        roots[2],
                        roots[3],
                        roots[4],
                        roots[5],
                        roots[6],
                        roots[7],
                        roots[8],
                        roots[9],
                    ),
                    strict=True,
                )
            )
            or roots[0].repository is not roots[1]
            or roots[0]._closed
            or tuple(astuple(t) for t in roots[4]) != roots[10]
            or not same_ports(
                owner.ports,
                (
                    roots[1].get,
                    self.claim_queue,
                    roots[8].require if roots[8] is not None else None,
                ),
            )
        ):
            raise Refusal("template_source_unavailable")

    async def send(self, connection, value, principal_current, *, _bridge=None):
        owner = NativeTemplateSendHostV1.stable(self)
        task = asyncio.current_task()
        if task in owner.active:
            raise Refusal("operation_conflict")
        finished = asyncio.get_running_loop().create_future()
        owner.active[task] = finished
        try:
            return await NativeTemplateSendHostV1._send(
                self, connection, value, principal_current, _bridge=_bridge
            )
        finally:
            owner.active.pop(task, None)
            if not finished.done():
                finished.set_result(None)

    async def send_bridge(self, connection, value, principal, current, *, request_identity):
        """Explicit owner delegation; the original v1 public path is unchanged.

        v2 resolves all private parameters in WisKey and supplies an extra
        revision/current refusal fence. No actor JSON, consent flag or admin
        account can create this native authority.
        """
        from .bridge_command_auth import VerifiedBridgePrincipal

        if type(principal) is not VerifiedBridgePrincipal or not callable(current):
            raise Refusal("Unauthorized")
        principal.check()
        if principal.repository is not self.manager.repository:
            raise Refusal("Unauthorized")
        request = descriptor(value)
        owner = NativeTemplateSendHostV1.stable(self)
        from .whatsapp_template_composition import NativeTemplateComposition

        if type(self.source.source) is NativeTemplateComposition:
            self.source.source.check_principal(principal, connection)
        if type(request_identity) is not bytes or len(request_identity) > 32768:
            raise Refusal("invalid_fields")
        binding = principal.owner_key
        identity = (hashlib.sha256(request_identity).hexdigest(), binding)
        previous = owner.bridge_requests.get(request["request_id"])
        operation = owner.bridge_operations.get(request["operation_id"])
        if (
            previous is not None
            and previous != identity
            or operation is not None
            and operation != (request["request_id"], identity)
        ):
            raise Refusal("operation_conflict")
        if previous is None and len(owner.bridge_requests) >= 4096:
            raise Refusal("template_capacity_reached")
        owner.bridge_requests[request["request_id"]] = identity
        owner.bridge_operations[request["operation_id"]] = (request["request_id"], identity)
        metadata = MappingProxyType(
            {
                "action": COMMAND,
                "request_id": request["request_id"],
                "operation_id": request["operation_id"],
                "operation_binding_ref": request["operation_id"],
            }
        )

        def guard(_request):
            principal.check()
            if current() is not None:
                raise Refusal("template_source_unavailable")
            return True

        context = EngineContext(metadata, guard, parameters=request, epoch=owner.roots[11])
        admission = _BridgeAdmission(principal, connection, self, current, context)
        admission.check(connection, context)
        return await NativeTemplateSendHostV1.send(
            self, connection, request, current, _bridge=admission
        )

    async def _send(self, connection, value, principal_current, *, _bridge=None):
        request = descriptor(value)
        owner = NativeTemplateSendHostV1.stable(self)
        source_ports = TemplateExecutionSourceV1.stable(self.source)
        principal_current()
        # Admission resolves authority only; it cannot dispatch a provider.
        # Bound the external current-source lookup while retaining original
        # parent ownership for stop/unload joins.
        if _bridge is None:
            authority_check = source_ports[2]
            try:
                async with asyncio.timeout(15):
                    context = await source_ports[1](connection, descriptor(request))
            except TimeoutError:
                return _result("not_sent", "source_or_admission_refused")
        elif type(_bridge) is _BridgeAdmission and _bridge.host is self:
            context = _bridge.context
            authority_check = _bridge.check
            authority_check(connection, context)
        else:
            raise Refusal("Unauthorized")
        principal_current()
        if NativeTemplateSendHostV1.stable(self) is not owner:
            raise Refusal("template_source_unavailable")
        if (
            type(context) is not EngineContext
            or context.epoch != owner.roots[11]
            or context.request.get("action") != COMMAND
            or context.request.get("request_id") != request["request_id"]
            or context.request.get("operation_id") != request["operation_id"]
            or _encoded(descriptor(thaw(context.parameters))) != _encoded(request)
        ):
            raise Refusal("template_source_unavailable")
        fingerprint = hashlib.sha256(_encoded(request)).hexdigest()
        previous = owner.receipts.get(request["request_id"])
        operation = owner.operations.get(request["operation_id"])
        if operation is not None and operation != (request["request_id"], fingerprint):
            raise Refusal("operation_conflict")
        if previous is not None:
            if previous[0] != fingerprint:
                raise Refusal("operation_conflict")
            # Exact duplicate never causes a second provider invocation.
            context.check()
            if authority_check(connection, context) is not True:
                raise Refusal("template_source_unavailable")
            principal_current()
            NativeTemplateSendHostV1.stable(self)
            context.check()
            NativeTemplateSendHostV1._bindings(self, owner)
            return dict(previous[1])
        if len(owner.receipts) >= 4096:
            raise Refusal("template_capacity_reached")
        template = next(
            (
                t
                for t in owner.roots[4]
                if (t.account, t.name, t.language)
                == (request["account"], request["template_name"], request["language"])
            ),
            None,
        )
        if template is None or len(request["parameters"]) != len(template.parameter_fields):
            return _result("not_sent", "template_mismatch")
        provider = next(p for p in owner.roots[3] if p.account.account == template.account)
        original_state = owner.roots[1]._state
        original_users = original_state["users"]
        original_row = original_users.get(request["recipient_ref"])
        person = owner.roots[1].get(request["recipient_ref"])
        if (
            type(original_row) is not dict
            or type(person) is not ManagedUser
            or person.id != request["recipient_ref"]
        ):
            raise Refusal("template_source_unavailable")
        snapshot = _person_snapshot(person, template)
        recipient = whatsapp_number(person.phone).lstrip("+")
        values = dict(
            zip(
                ("display_name", "employee_no", "pin", "valid_from", "valid_until"),
                snapshot[3:],
                strict=True,
            )
        )
        if tuple(request["parameters"]) != tuple(values[k] for k in template.parameter_fields):
            return _result("not_sent", "template_mismatch")

        def recipient_current():
            # This final fence invokes no injected authority/principal port.
            # get() is the original native projection, not a foreign getter.
            if (
                owner.roots[1]._state is not original_state
                or original_state.get("users") is not original_users
                or original_users.get(request["recipient_ref"]) is not original_row
                or _person_snapshot(
                    AccessRepository.get(owner.roots[1], request["recipient_ref"]), template
                )
                != snapshot
            ):
                raise Refusal("template_source_unavailable")

        def current():
            principal_current()
            if NativeTemplateSendHostV1.stable(self) is not owner:
                raise Refusal("template_source_unavailable")
            context.check()
            if authority_check(connection, context) is not True:
                raise Refusal("template_source_unavailable")
            NativeTemplateSendHostV1.stable(self)
            if (
                owner.roots[1]._state is not original_state
                or original_state.get("users") is not original_users
                or original_users.get(request["recipient_ref"]) is not original_row
            ):
                raise Refusal("template_source_unavailable")
            current_person = owner.roots[1].get(request["recipient_ref"])
            if (
                type(current_person) is not ManagedUser
                or _person_snapshot(current_person, template) != snapshot
            ):
                raise Refusal("template_source_unavailable")
            if "pin" in template.parameter_fields:
                configured = getattr(owner.roots[1], "_pin_quarantine_owner", None)
                if configured is not None and owner.roots[8] is None:
                    raise Refusal("template_source_unavailable")
                if owner.roots[8] is not None:
                    owner.roots[8].require(current_person.id, current_person.revision)
            principal_current()
            context.check()
            NativeTemplateSendHostV1._bindings(self, owner)
            recipient_current()

        current()
        pending = _result("unknown", "operation_pending_or_unknown")
        owner.receipts[request["request_id"]] = (fingerprint, pending)
        owner.operations[request["operation_id"]] = (request["request_id"], fingerprint)
        attempt = None
        result = pending

        async def receive(_queue_value, scoped):
            nonlocal attempt
            current()
            attempt = CloudTemplateProvider.send_attempt(
                provider, context=scoped, accounting=owner.roots[5]
            )
            accepted = await CloudTemplateProvider.send(
                provider,
                template,
                recipient,
                tuple(request["parameters"]),
                current,
                attempt=attempt,
            )
            current()
            if accepted is not True:
                raise Refusal("status_unknown")
            return _result("accepted", "provider_accepted")

        def scoped_current(_):
            current()
            return True

        scoped = EngineContext.scoped(context, scoped_current)

        async def claim(original_context):
            current()
            item = await owner.roots[6](original_context)
            # Capture original cleanup before any post-wait guard. The owned
            # resource runner joins it even if policy changed during admission.
            if type(item) is not OwnedObject or not callable(item.close):
                raise Refusal("template_source_unavailable")
            close, value = item.close, item.value
            original_claim = _QueueClaim(item, value, close)
            claim_key = context.request.get("operation_binding_ref")
            owner.claims[claim_key] = original_claim

            async def cleanup():
                original_claim.task = asyncio.current_task()
                try:
                    await close()
                except BaseException as error:
                    original_claim.failed = error
                    owner.cleanup_failed = True
                    owner.stopping = True
                    raise
                else:
                    if owner.claims.get(claim_key) is original_claim:
                        owner.claims.pop(claim_key)

            return OwnedObject(value, cleanup)

        try:
            async with asyncio.timeout(45):
                result = await owner.roots[9].run(scoped, claim, receive)
            current()
        except BaseException as error:
            dispatched = True
            if attempt is None:
                dispatched = False
            else:
                try:
                    dispatched = CloudTemplateProvider.was_dispatched(provider, attempt)
                except Exception:
                    pass
            # A new transport attempt entering no POST says nothing about an
            # older durable attempt after host reload. The original ledger's
            # duplicate/reconciliation barrier cannot become not_sent or a
            # permission to replay that prior operation.
            if isinstance(error, Refusal) and error.code in {
                "operation_conflict",
                "pacing_sender_reconciliation_required",
            }:
                dispatched = True
            from .whatsapp_pacing_ledger import PacingBackoff, PacingLimited

            details = None
            if not dispatched and isinstance(error, (PacingLimited, PacingBackoff)):
                details = {
                    "schema_version": 1,
                    "state": "not_sent",
                    "code": "rate_limited",
                    "retry_after_s": error.retry_after_s,
                    "retry_after_source": "original_local_ledger",
                    "observed_at": error.observed_at,
                    "prior_unknown_retry": False,
                }
            if details is not None:
                owner.pacing_results[request["request_id"]] = dict(details)
            result = _result(
                "unknown" if dispatched else "not_sent",
                "provider_outcome_unknown" if dispatched else "source_or_admission_refused",
            )
            if isinstance(error, asyncio.CancelledError):
                raise
            if not isinstance(error, Exception):
                raise
        finally:
            owner.receipts[request["request_id"]] = (fingerprint, result)
        return dict(result)

    def stop(self):
        owner = _HOSTS.get(self)
        if owner is not None:
            owner.stopping = True

    async def close(self):
        owner = _HOSTS.get(self)
        if owner is None:
            raise Refusal("template_source_unavailable")
        NativeTemplateSendHostV1.stop(self)
        resources = owner.roots[9]
        reentrant = OwnedResources.owns_current(resources) or asyncio.current_task() in owner.active
        await OwnedResources.close(resources)
        # Reentrant close fences now and returns to its original action/cleanup.
        # A later external close still joins the original resource close task
        # and the original admission/request futures; no completed wrapper task
        # can hide an outstanding native cleanup.
        cancelled = False
        if not reentrant and owner.active:
            _, cancelled = await join_owned(
                asyncio.gather(*(asyncio.shield(future) for future in tuple(owner.active.values())))
            )
        if owner.cleanup_failed:
            raise Refusal("template_cleanup_failed")
        if cancelled:
            raise asyncio.CancelledError


def _person_snapshot(person, template):
    return (
        person.id,
        person.revision,
        person.phone,
        person.display_name,
        person.employee_no,
        person.pin.value if "pin" in template.parameter_fields and person.pin else None,
        person.valid_from,
        person.valid_until,
    )
