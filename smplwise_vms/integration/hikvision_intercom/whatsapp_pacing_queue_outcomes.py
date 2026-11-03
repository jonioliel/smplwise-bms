"""Once-bound original Cloud rejection for Stage3a's private queue port."""

from __future__ import annotations

import weakref
from dataclasses import dataclass

from .trusted_actions.validation import Refusal
from .whatsapp_pacing_outcomes import pacing_refusal_metadata
from .whatsapp_pacing_queue_store import encoded, job

_ISSUED = weakref.WeakKeyDictionary()
_ERRORS = weakref.WeakKeyDictionary()


@dataclass(repr=False)
class _Original:
    identity: str
    metadata: dict
    consumed: bool = False


class QueueProviderRejection:
    """Not constructible from JSON, a generic Refusal or a provider error string."""

    def __init__(self):
        raise TypeError("original bound provider evidence required")

    @classmethod
    def from_error(cls, value, error, *, provider, attempt, request):
        from .whatsapp_cloud_templates import CloudSendAttempt, CloudTemplateProvider

        if (
            cls is not QueueProviderRejection
            or type(provider) is not CloudTemplateProvider
            or type(attempt) is not CloudSendAttempt
        ):
            raise Refusal("binding_denied")
        metadata = pacing_refusal_metadata(
            error, provider=provider, attempt=attempt, request=request
        )
        if metadata is None:
            raise Refusal("binding_denied")
        identity = encoded(job(value))
        # A genuine original signed Request must be the same queued request.
        # An ordinary local Cloud attempt has request=None and remains a trusted
        # adapter port, not an authenticated-Arx quota exemption.
        if request is not None:
            from .trusted_actions.envelope import Request

            if (
                type(request) is not Request
                or request.descriptor["request_id"] != value["request_id"]
            ):
                raise Refusal("binding_denied")
        old = _ERRORS.get(error)
        if old is not None:
            original = _ISSUED.get(old)
            if original is None or original.identity != identity:
                raise Refusal("operation_conflict")
            return old
        result = QueueProviderRejection.__new__(QueueProviderRejection)
        _ISSUED[result] = _Original(identity, metadata)
        _ERRORS[error] = result
        return result

    def consume(self, value):
        original = _ISSUED.get(self) if type(self) is QueueProviderRejection else None
        if original is None or original.consumed or original.identity != encoded(job(value)):
            raise Refusal("binding_denied")
        original.consumed = True
        return dict(original.metadata)
