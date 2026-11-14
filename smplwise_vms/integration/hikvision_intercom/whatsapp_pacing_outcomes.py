"""Original provider rejection evidence; never admission or retry permission.

Only the native provider adapter issues this exception after its original POST
response. Generic exceptions, caller JSON and error-message text are not evidence.
Public projection excludes the provider body, identity, recipient and credentials.
"""

from __future__ import annotations

import asyncio
import math
import re
import weakref
from dataclasses import dataclass
from datetime import UTC, datetime
from email.utils import parsedate_to_datetime

from .trusted_actions.validation import Refusal

ERROR_SCHEMA = "whatsapp_send_outcome_v1"
SIGNED_SCHEMA = "wiskey-arx-messaging-outcome.v1"
CAPABILITY = "whatsapp_pacing_errors_v1"
_MAX_SECONDS = 9007199254740991
_RECORDS = weakref.WeakKeyDictionary()
_UNSPECIFIED = object()
_DAY = r"(?:Mon|Tue|Wed|Thu|Fri|Sat|Sun)"
_LONG_DAY = r"(?:Monday|Tuesday|Wednesday|Thursday|Friday|Saturday|Sunday)"
_MONTH = r"(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)"
_TIME = r"[0-9]{2}:[0-9]{2}:[0-9]{2}"
_HTTP_DATES = (
    re.compile(_DAY + r", [0-9]{2} " + _MONTH + r" [0-9]{4} " + _TIME + r" GMT"),
    re.compile(_LONG_DAY + r", [0-9]{2}-" + _MONTH + r"-[0-9]{2} " + _TIME + r" GMT"),
    re.compile(_DAY + " " + _MONTH + r" [ 0-9][0-9] " + _TIME + r" [0-9]{4}"),
)


class PacingProviderRefusal(Refusal):
    """Native adapter-issued, original-attempt rejection; not constructible JSON."""

    def __init__(self, *args, **kwargs):
        raise TypeError("original provider rejection evidence required")


@dataclass(frozen=True, repr=False)
class _Rejection:
    code: str
    scope: str
    retry_after: int | None
    provider: weakref.ReferenceType
    attempt: weakref.ReferenceType
    request: object


def retry_after_seconds(values, *, now: datetime) -> int | None:
    """RFC9110 single original Retry-After, seconds or HTTP date; never infer."""
    if (
        type(values) not in {tuple, list}
        or len(values) != 1
        or type(values[0]) is not str
        or not 1 <= len(values[0]) <= 128
        or type(now) is not datetime
        or now.tzinfo is None
        or now.utcoffset() is None
    ):
        return None
    value = values[0].strip(" \t")
    if re.fullmatch(r"[0-9]{1,16}", value):
        seconds = int(value)
        return seconds if seconds <= _MAX_SECONDS else None
    # HTTP-date is GMT. Mail numeric zones or unknown/naive zones do not
    # establish a provider delay. Obsolete HTTP UTC forms remain accepted.
    try:
        value.encode("ascii", errors="strict")
        if not any(pattern.fullmatch(value) for pattern in _HTTP_DATES):
            return None
        parsed = parsedate_to_datetime(value)
        weekday = value.split(",", 1)[0] if "," in value else value[:3]
        if weekday not in {parsed.strftime("%a"), parsed.strftime("%A")}:
            return None
        if parsed.tzinfo is None:
            if (
                re.fullmatch(r"[A-Z][a-z]{2} [A-Z][a-z]{2} [ 0-9][0-9] [0-9:]{8} [0-9]{4}", value)
                is None
            ):
                return None
            parsed = parsed.replace(tzinfo=UTC)
        elif not value.endswith(" GMT") or parsed.utcoffset().total_seconds() != 0:
            return None
        delay = math.ceil((parsed - now.astimezone(UTC)).total_seconds())
        return min(_MAX_SECONDS, max(0, delay))
    except (ValueError, TypeError, OverflowError, UnicodeError):
        return None


def _issue_provider_refusal(provider, attempt, code, retry_after):
    """Private native source seam; validates original in-progress POST ownership."""
    from . import whatsapp_cloud_templates as cloud

    original = cloud._ATTEMPTS.get(attempt) if type(attempt) is cloud.CloudSendAttempt else None
    scope = cloud._SCOPE.get()
    if (
        type(provider) is not cloud.CloudTemplateProvider
        or original is None
        or original[0] is not provider
        or original[1] is not asyncio.current_task()
        or not original[2][0]
        or type(scope) is not cloud._RequestScope
        or scope.task is not original[1]
        or scope.attempted is not original[2]
        or scope.request.method != "POST"
        or code not in {"rate_limited", "pair_rate_limited"}
        or retry_after is not None
        and (type(retry_after) is not int or not 0 <= retry_after <= _MAX_SECONDS)
    ):
        raise Refusal("binding_denied")
    cloud.CloudTemplateProvider.check(provider)
    cloud._check_scope(scope.request, scope.transport)
    error = PacingProviderRefusal.__new__(PacingProviderRefusal)
    Refusal.__init__(error, code)
    _RECORDS[error] = _Rejection(
        code,
        "pair" if code == "pair_rate_limited" else "account",
        retry_after,
        weakref.ref(provider),
        weakref.ref(attempt),
        original[3],
    )
    return error


def pacing_refusal_metadata(error, *, provider=None, attempt=None, request=_UNSPECIFIED):
    """Return a fresh safe copy only for exact original issued error/identities.

    A signed producer must pass its original Request identity. Native wrappers
    pass their actual provider+attempt. Omission is NOT a source-binding proof
    for an unknown HA service adapter; that caller must match its actual origin.
    """
    record = _RECORDS.get(error) if type(error) is PacingProviderRefusal else None
    if (
        record is None
        or provider is not None
        and record.provider() is not provider
        or attempt is not None
        and record.attempt() is not attempt
        or request is not _UNSPECIFIED
        and record.request is not request
    ):
        return None
    return {
        "code": record.code,
        "send_state": "not_sent",
        "throttle_scope": record.scope,
        "retry_after_s": record.retry_after,
        "retry_after_source": "verified_provider_response"
        if record.retry_after is not None
        else None,
        "cause": "provider_throttle",
    }
