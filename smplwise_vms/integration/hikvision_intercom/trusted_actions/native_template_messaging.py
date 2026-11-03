"""Native person -> private approved-template frame -> real Cloud API sender.

Compose with the existing OpaqueMessaging, OwnedResources and SourceMessageFrames
to retain the closed preview/send receiver, fresh consent and installation queue.
No route, native service replacement or activation is installed by this module.
"""

from __future__ import annotations

import asyncio
import secrets
import weakref
from dataclasses import astuple, dataclass
from types import MethodType

from ..access.manager import AccessManager
from ..access.models import ManagedUser
from ..access.repository import AccessRepository
from ..media_lifetime import join_owned
from ..phone import whatsapp_number
from ..whatsapp_cloud_templates import _PLACEHOLDER, ApprovedTextTemplate, CloudTemplateProvider
from ..whatsapp_pacing_outcomes import PacingProviderRefusal, pacing_refusal_metadata
from .adapters import EngineContext
from .messaging import MessageAcknowledgment, OpaqueMessaging
from .owned_resources import OwnedResources
from .source_bindings import same_ports
from .source_message_frames import OwnedPreviewCache, SourceMessageFrames
from .validation import Refusal

_SOURCES = weakref.WeakKeyDictionary()
_COMPOSITIONS = weakref.WeakKeyDictionary()


@dataclass(frozen=True, repr=False)
class _Prepared:
    actor: object
    target: object
    epoch: str
    user_id: str
    account: str
    template: ApprovedTextTemplate
    template_snapshot: tuple
    person_snapshot: tuple
    recipient: str
    parameters: tuple
    rendered: str


class NativeTemplateMessaging:
    """Explicit native producer, used only behind current Arx consent/queue.

    current_binding must bind the selected template/configuration revision to
    actual current Arx authority. It is additional to EngineContext admission,
    the native person's current revision, fresh consent and original queue.
    A template name, approval status or local principal is never sending authority.
    """

    def __init__(
        self,
        manager,
        cache,
        providers: tuple,
        templates: tuple,
        *,
        current_binding,
        pin_delivery_policy=None,
        accounting=None,
    ):
        if (
            type(manager) is not AccessManager
            or type(manager.repository) is not AccessRepository
            or type(cache) is not OwnedPreviewCache
            or type(providers) is not tuple
            or not providers
            or any(type(p) is not CloudTemplateProvider for p in providers)
            or type(templates) is not tuple
            or not templates
            or any(type(t) is not ApprovedTextTemplate for t in templates)
            or not callable(current_binding)
        ):
            raise ValueError("explicit native manager, private cache and template sources required")
        by_account = {p.account.account: p for p in providers}
        if (
            len(by_account) != len(providers)
            or len({(t.account, t.ui_language) for t in templates}) != len(templates)
            or any(t.account not in by_account for t in templates)
        ):
            raise ValueError("exact unique account and language bindings required")
        self.manager, self.cache = manager, cache
        self.providers, self.templates, self.current_binding = providers, templates, current_binding
        self.pin_delivery_policy = pin_delivery_policy
        self.accounting = accounting
        if accounting is not None:
            from ..native_whatsapp_accounting import NativeWhatsAppAccounting

            if type(accounting) is not NativeWhatsAppAccounting:
                raise ValueError("original native accounting binding required")
            NativeWhatsAppAccounting.check(accounting)
        if pin_delivery_policy is not None:
            from ..access.pin_quarantine import NativePinDeliveryPolicy

            if (
                type(pin_delivery_policy) is not NativePinDeliveryPolicy
                or pin_delivery_policy.repository is not manager.repository
            ):
                raise ValueError("original configured native PIN delivery policy required")
        self._repository, self._tokens, self.closed = manager.repository, set(), False
        self._template_snapshots = tuple(astuple(t) for t in templates)
        self._ports = (
            manager.repository.get,
            current_binding,
            (pin_delivery_policy.require if pin_delivery_policy is not None else None),
        )
        self._roots = (
            manager,
            cache,
            providers,
            templates,
            self._repository,
            self._tokens,
            self._template_snapshots,
            pin_delivery_policy,
            self._ports,
            accounting,
        )
        _SOURCES[self] = self._roots

    def _stable(self):
        if (
            self.closed
            or self._roots is not _SOURCES.get(self)
            or self.manager._closed
            or any(
                a is not b
                for a, b in zip(
                    (
                        self.manager,
                        self.cache,
                        self.providers,
                        self.templates,
                        self._repository,
                        self._tokens,
                        self._template_snapshots,
                        self.pin_delivery_policy,
                        self._ports,
                        self.accounting,
                    ),
                    self._roots,
                    strict=True,
                )
            )
            or self.manager.repository is not self._repository
            or tuple(astuple(t) for t in self.templates) != self._template_snapshots
            or not same_ports(
                self._ports,
                (
                    self._repository.get,
                    self.current_binding,
                    self.pin_delivery_policy.require
                    if self.pin_delivery_policy is not None
                    else None,
                ),
            )
        ):
            raise Refusal("binding_denied")
        self.cache.check_owner()
        if self.accounting is not None:
            from ..native_whatsapp_accounting import NativeWhatsAppAccounting

            NativeWhatsAppAccounting.check(self.accounting)
        for provider in self.providers:
            CloudTemplateProvider.check(provider)

    def _person(self, user_id):
        user = self._repository.get(user_id)
        if (
            type(user) is not ManagedUser
            or user.id != user_id
            or type(user.revision) is not int
            or user.revision < 1
        ):
            raise Refusal("binding_denied")
        return user

    @staticmethod
    def _snapshot(user, template):
        return (
            user.id,
            user.revision,
            user.phone,
            user.display_name,
            user.employee_no,
            user.pin.value if "pin" in template.parameter_fields and user.pin is not None else None,
            user.valid_from,
            user.valid_until,
        )

    def _current(self, context, template, person_snapshot=None):
        if type(context) is not EngineContext:
            raise Refusal("binding_denied")
        NativeTemplateMessaging._stable(self)
        context.check()
        if self.current_binding(context, template) is not True:
            raise Refusal("permissions_changed")
        NativeTemplateMessaging._stable(self)
        context.check()
        user = NativeTemplateMessaging._person(self, context.parameters["user_id"])
        if "pin" in template.parameter_fields:
            configured = getattr(self._repository, "_pin_quarantine_owner", None)
            if configured is not None and self.pin_delivery_policy is None:
                raise Refusal("permissions_changed")
            if self.pin_delivery_policy is not None:
                from ..access.pin_quarantine import NativePinDeliveryPolicy

                if (
                    type(self.pin_delivery_policy) is not NativePinDeliveryPolicy
                    or self.pin_delivery_policy.repository is not self._repository
                ):
                    raise Refusal("permissions_changed")
                self.pin_delivery_policy.require(user.id, user.revision)
        if (
            person_snapshot is not None
            and NativeTemplateMessaging._snapshot(user, template) != person_snapshot
        ):
            raise Refusal("permissions_changed")
        NativeTemplateMessaging._stable(self)
        return user

    def _provider(self, template):
        return next(p for p in self.providers if p.account.account == template.account)

    async def prepare(self, _opaque, context):
        if (
            type(context) is not EngineContext
            or context.request.get("action") != "whatsapp/preview"
            or set(context.parameters) != {"user_id", "account", "language"}
        ):
            raise Refusal("binding_denied")
        NativeTemplateMessaging._stable(self)
        params = context.parameters
        # Frame expiry/abort removes the original cache entries. Count current
        # owned frames only, preserving existing source capacity semantics.
        self._tokens.intersection_update(self.cache)
        matches = [
            t
            for t in self.templates
            if (t.account, t.ui_language) == (params["account"], params["language"])
        ]
        if len(matches) != 1 or len(self._tokens) >= 128:
            raise Refusal("binding_denied")
        template = matches[0]
        user = NativeTemplateMessaging._current(self, context, template)
        person_snapshot = NativeTemplateMessaging._snapshot(user, template)
        recipient = whatsapp_number(user.phone).lstrip("+")
        values = {
            "display_name": user.display_name,
            "employee_no": user.employee_no,
            "pin": user.pin.value
            if "pin" in template.parameter_fields and user.pin is not None
            else None,
            "valid_from": user.valid_from,
            "valid_until": user.valid_until,
        }
        parameters = tuple(values[key] for key in template.parameter_fields)
        if any(
            type(v) is not str or not 1 <= len(v) <= 1024 or any(ord(c) < 32 for c in v)
            for v in parameters
        ):
            raise Refusal("invalid_fields")
        rendered = _PLACEHOLDER.sub(lambda m: parameters[int(m[1]) - 1], template.body)
        if len(rendered) > 12000:
            raise Refusal("invalid_fields")

        def current():
            NativeTemplateMessaging._current(self, context, template, person_snapshot)

        await context.wait(
            lambda: CloudTemplateProvider.verify(
                NativeTemplateMessaging._provider(self, template), template, current
            )
        )
        current()
        token = secrets.token_urlsafe(32)
        entry = _Prepared(
            context.request.get("actor"),
            context.request.get("target"),
            context.epoch,
            user.id,
            params["account"],
            template,
            astuple(template),
            person_snapshot,
            recipient,
            parameters,
            rendered,
        )
        # OwnedPreviewCache requires SourceMessageFrames' original capture Task.
        self.cache[token] = entry
        self._tokens.add(token)
        return {"token": token, "recipient": recipient, "message": rendered, "warnings": []}

    async def send(self, _opaque, private, context):
        if (
            type(context) is not EngineContext
            or context.request.get("action") != "whatsapp/send"
            or set(context.parameters) != {"user_id", "account", "preview_reference", "confirmed"}
            or context.parameters["confirmed"] is not True
            or type(private) is not dict
            or set(private) != {"token", "recipient", "message", "warnings"}
        ):
            raise Refusal("binding_denied")
        NativeTemplateMessaging._stable(self)
        token = private["token"]
        entry = self.cache.get(token)
        if (
            token not in self._tokens
            or type(entry) is not _Prepared
            or (entry.actor, entry.target, entry.epoch, entry.user_id, entry.account)
            != (
                context.request.get("actor"),
                context.request.get("target"),
                context.epoch,
                context.parameters["user_id"],
                context.parameters["account"],
            )
            or private["recipient"] != entry.recipient
            or private["message"] != entry.rendered
            or private["warnings"] != []
            or astuple(entry.template) != entry.template_snapshot
        ):
            raise Refusal("binding_denied")

        def current():
            NativeTemplateMessaging._current(self, context, entry.template, entry.person_snapshot)

        current()
        # Consume once before fresh approval read and possible POST. No outcome
        # restores the source token, including unknown ACK/cancel/timeout.
        with self.cache.source_consumption(context, current):
            if self.cache.pop(token, None) is not entry:
                raise Refusal("binding_denied")
        self._tokens.remove(token)
        provider = NativeTemplateMessaging._provider(self, entry.template)
        attempt = CloudTemplateProvider.send_attempt(
            provider, context=context, accounting=self.accounting
        )
        try:
            accepted = await context.wait(
                lambda: CloudTemplateProvider.send(
                    provider,
                    entry.template,
                    entry.recipient,
                    entry.parameters,
                    current,
                    attempt=attempt,
                )
            )
            current()
        except PacingProviderRefusal as error:
            current()
            if (
                pacing_refusal_metadata(
                    error, provider=provider, attempt=attempt, request=context.request
                )
                is None
            ):
                raise Refusal("status_unknown") from None
            raise
        except Refusal:
            if CloudTemplateProvider.was_dispatched(provider, attempt):
                raise Refusal("status_unknown") from None
            raise
        if accepted is not True:
            raise Refusal("status_unknown")
        return MessageAcknowledgment(True)

    async def close(self):
        self.closed = True
        roots = _SOURCES.get(self)
        if roots is None:
            raise Refusal("binding_denied")
        cache, tokens = roots[1], roots[5]
        if not cache.closed:
            for token in tuple(tokens):
                cache.pop(token, None)
        tokens.clear()
        # All exact original provider clients must close, even if one fails or
        # caller cancellation repeats. A rebound public label is never closed.
        results, cancelled = await join_owned(
            asyncio.gather(
                *(CloudTemplateProvider.close(provider) for provider in roots[2]),
                return_exceptions=True,
            )
        )
        if cancelled:
            raise asyncio.CancelledError
        if any(isinstance(result, BaseException) for result in results):
            raise Refusal("action_failed")


class TemplateMessagingComposition:
    """Explicit opt-in composition with the existing closed opaque receiver.

    The host must own close() and still supply actual fresh Arx consent, queue
    admission and current template policy. Construction does not register it.
    """

    def __init__(
        self, producer: NativeTemplateMessaging, *, epoch, clock_sample, fresh_consent, claim_queue
    ):
        if type(producer) is not NativeTemplateMessaging:
            raise ValueError("original native template producer required")
        self.producer = producer
        self.frames = SourceMessageFrames(
            epoch=epoch,
            cache=producer.cache,
            prepare_source=MethodType(NativeTemplateMessaging.prepare, producer),
            send_source=MethodType(NativeTemplateMessaging.send, producer),
            clock_sample=clock_sample,
        )
        self.messaging = OpaqueMessaging(
            epoch=epoch,
            clock_sample=clock_sample,
            resources=OwnedResources(epoch=epoch),
            fresh_consent=fresh_consent,
            prepare_preview=self.frames.prepare,
            claim_queue=claim_queue,
            send_source=self.frames.send,
            source_frames=self.frames,
        )
        self._original = producer, self.frames, self.messaging
        _COMPOSITIONS[self] = self._original

    async def close(self):
        original = _COMPOSITIONS.get(self)
        if original is None:
            raise Refusal("binding_denied")
        try:
            await original[2].close()
        finally:
            await original[0].close()
