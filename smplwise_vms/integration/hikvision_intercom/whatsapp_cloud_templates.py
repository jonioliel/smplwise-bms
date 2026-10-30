"""Explicit approved Cloud API text-template provider, unregistered and OFF.

No account, token, template, recipient or message is created here. Owner-supplied
configuration and current source admission are required. Provider acceptance is
never reported as delivery, and a failed/unknown POST is never retried.
"""

from __future__ import annotations

import asyncio
import re
import weakref
from contextvars import ContextVar
from dataclasses import astuple, dataclass
from datetime import UTC, datetime

import httpx

from .access.models import SecretValue
from .media_lifetime import join_owned
from .trusted_actions.source_bindings import same_ports
from .trusted_actions.validation import Refusal, reference, strict_json
from .whatsapp_pacing_outcomes import (
    PacingProviderRefusal,
    _issue_provider_refusal,
    pacing_refusal_metadata,
    retry_after_seconds,
)

_FIELDS = frozenset({"display_name", "employee_no", "pin", "valid_from", "valid_until"})
_PLACEHOLDER = re.compile(r"\{\{([1-9][0-9]?)\}\}")
_PROVIDERS = weakref.WeakKeyDictionary()
_TRANSPORTS = weakref.WeakKeyDictionary()
_NETWORKS = weakref.WeakKeyDictionary()
_STREAMS = weakref.WeakKeyDictionary()
_BACKENDS = weakref.WeakKeyDictionary()
_RESPONSES = weakref.WeakKeyDictionary()
_ATTEMPTS = weakref.WeakKeyDictionary()
_RECIPIENTS = weakref.WeakKeyDictionary()
_SCOPE = ContextVar("wiskey_cloud_template_original_request", default=None)
_CLIENT_CLOSE = httpx.AsyncClient.aclose


@dataclass(frozen=True, repr=False, eq=False)
class CloudSendAttempt:
    """Identity-issued classification only; this is never sending authority."""

    provider: object


@dataclass(frozen=True, repr=False)
class _RequestScope:
    task: object
    request: object
    transport: object
    guard: object
    attempted: list
    accounting: object = None


def _check_scope(request, transport):
    scope = _SCOPE.get()
    if (
        type(scope) is not _RequestScope
        or scope.task is not asyncio.current_task()
        or scope.request is not request
        or scope.transport is not transport
    ):
        raise Refusal("binding_denied")
    scope.guard()
    if _SCOPE.get() is not scope or asyncio.current_task().cancelling():
        raise Refusal("binding_denied")
    return scope


def _network_current():
    scope = _SCOPE.get()
    if type(scope) is not _RequestScope:
        raise Refusal("binding_denied")
    _check_scope(scope.request, scope.transport)


class _CloudNetworkStream:
    """Fence actual native httpcore socket calls, including connect/TLS waits."""

    def __init__(self, original):
        self._original = original
        _STREAMS[self] = (
            original,
            original.read,
            original.write,
            original.aclose,
            original.start_tls,
            original.get_extra_info,
        )

    def _stable(self):
        record = _STREAMS.get(self)
        if (
            record is None
            or self._original is not record[0]
            or not same_ports(
                record[1:],
                (
                    record[0].read,
                    record[0].write,
                    record[0].aclose,
                    record[0].start_tls,
                    record[0].get_extra_info,
                ),
            )
        ):
            raise Refusal("binding_denied")
        return record

    async def read(self, max_bytes, timeout=None):  # noqa: ASYNC109 - httpcore interface
        record = self._stable()
        _network_current()
        self._stable()
        value = await record[1](max_bytes, timeout=timeout)
        _network_current()
        self._stable()
        return value

    async def write(self, buffer, timeout=None):  # noqa: ASYNC109 - httpcore interface
        record = self._stable()
        _network_current()
        self._stable()
        await record[2](buffer, timeout=timeout)
        _network_current()
        self._stable()

    async def aclose(self):
        _, cancelled = await join_owned(_STREAMS[self][3]())
        if cancelled:
            raise asyncio.CancelledError

    async def start_tls(self, ssl_context, server_hostname=None, timeout=None):  # noqa: ASYNC109
        record = self._stable()
        _network_current()
        self._stable()
        stream = await record[4](ssl_context, server_hostname=server_hostname, timeout=timeout)
        close = stream.aclose
        try:
            self._stable()
            _network_current()
            self._stable()
        except BaseException:
            await join_owned(close())
            raise
        return _CloudNetworkStream(stream)

    def get_extra_info(self, info):
        return self._stable()[5](info)


class _CloudNetworkBackend:
    def __init__(self, original):
        self._original = original
        _BACKENDS[self] = original, original.connect_tcp, original.sleep

    def _stable(self):
        record = _BACKENDS.get(self)
        if (
            record is None
            or self._original is not record[0]
            or not same_ports(record[1:], (record[0].connect_tcp, record[0].sleep))
        ):
            raise Refusal("binding_denied")
        return record

    async def connect_tcp(self, host, port, timeout=None, local_address=None, socket_options=None):  # noqa: ASYNC109
        record = self._stable()
        _network_current()
        self._stable()
        stream = await record[1](
            host, port, timeout=timeout, local_address=local_address, socket_options=socket_options
        )
        close = stream.aclose
        try:
            self._stable()
            _network_current()
            self._stable()
        except BaseException:
            await join_owned(close())
            raise
        return _CloudNetworkStream(stream)

    async def connect_unix_socket(self, *args, **kwargs):
        # This provider has one exact HTTPS Graph endpoint and no Unix socket.
        raise Refusal("binding_denied")

    async def sleep(self, seconds):
        record = self._stable()
        _network_current()
        self._stable()
        await record[2](seconds)
        _network_current()
        self._stable()


class _CloudStream(httpx.AsyncByteStream):
    def __init__(self, original, request, transport):
        self.original, self.request, self.transport = original, request, transport
        _RESPONSES[self] = original, request, transport, original.aclose

    def _stable(self):
        record = _RESPONSES.get(self)
        if (
            record is None
            or self.original is not record[0]
            or self.request is not record[1]
            or self.transport is not record[2]
        ):
            raise Refusal("binding_denied")
        return record

    async def __aiter__(self):
        record = self._stable()
        async for chunk in record[0]:
            _check_scope(record[1], record[2])
            self._stable()
            yield chunk

    async def aclose(self):
        _, cancelled = await join_owned(_RESPONSES[self][3]())
        if cancelled:
            raise asyncio.CancelledError


class _CloudTransport(httpx.AsyncBaseTransport):
    """Only the original guarded provider request can enter the private pool.

    Provider lock is retained until its response is closed. Every legitimate
    request is serialized; a foreign request cannot occupy this dedicated pool.
    """

    def __init__(self, original):
        _TRANSPORTS[self] = original, original.handle_async_request, original.aclose
        if type(original) is httpx.AsyncHTTPTransport:
            pool = original._pool
            backend = _CloudNetworkBackend(pool._network_backend)
            pool._network_backend = backend
            _NETWORKS[self] = pool, backend

    def check(self):
        record = _TRANSPORTS[self]
        original = record[0]
        if not same_ports(record[1:], (original.handle_async_request, original.aclose)):
            raise Refusal("binding_denied")
        network = _NETWORKS.get(self)
        if network is not None and (
            original._pool is not network[0] or network[0]._network_backend is not network[1]
        ):
            raise Refusal("binding_denied")

    async def handle_async_request(self, request):
        self.check()
        scope = _check_scope(request, self)
        if scope.accounting is not None:
            from .native_whatsapp_accounting import before_native_cloud_post

            await before_native_cloud_post(scope.accounting, request, self)
            _check_scope(request, self)
            self.check()
        scope.attempted[0] = True
        response = await _TRANSPORTS[self][1](request)
        original_stream, close = response.stream, response.stream.aclose
        try:
            _check_scope(request, self)
            if response.stream is not original_stream:
                raise Refusal("binding_denied")
        except BaseException:
            await join_owned(close())
            raise
        response.stream = _CloudStream(original_stream, request, self)
        return response

    async def aclose(self):
        record = _TRANSPORTS[self]
        network = _NETWORKS.get(self)
        if network is not None:
            record[0]._pool = network[0]
        _, cancelled = await join_owned(record[2]())
        if cancelled:
            raise asyncio.CancelledError


@dataclass(frozen=True, repr=False)
class _CloudOwnership:
    account: object
    configuration: tuple
    ports: tuple
    transport: object
    enabled: bool
    lifecycle: list


@dataclass(frozen=True, repr=False)
class CloudAccount:
    account: str
    api_version: str
    business_id: str
    phone_number_id: str
    token: SecretValue

    def __post_init__(self):
        reference(self.account)
        if (
            type(self.api_version) is not str
            or re.fullmatch(r"v[1-9][0-9]?\.0", self.api_version) is None
            or any(
                type(v) is not str or re.fullmatch(r"[1-9][0-9]{0,31}", v) is None
                for v in (self.business_id, self.phone_number_id)
            )
            or type(self.token) is not SecretValue
            or type(self.token.value) is not str
            or not 1 <= len(self.token.value) <= 4096
            or any(ord(c) < 33 or ord(c) > 126 for c in self.token.value)
        ):
            raise ValueError("explicit owner-pinned Cloud API account required")


@dataclass(frozen=True, repr=False)
class ApprovedTextTemplate:
    reference: str
    revision: int
    account: str
    ui_language: str
    template_id: str
    name: str
    language: str
    body: str
    parameter_fields: tuple[str, ...]

    def __post_init__(self):
        reference(self.reference)
        reference(self.account)
        if (
            type(self.revision) is not int
            or not 1 <= self.revision < 2**63
            or self.ui_language not in {"he", "en"}
            or type(self.template_id) is not str
            or re.fullmatch(r"[1-9][0-9]{0,31}", self.template_id) is None
            or type(self.name) is not str
            or re.fullmatch(r"[a-z][a-z0-9_]{0,127}", self.name) is None
            or type(self.language) is not str
            or re.fullmatch(r"[a-z]{2,3}(?:_[A-Z]{2})?", self.language) is None
            or type(self.body) is not str
            or not 1 <= len(self.body) <= 4096
            or type(self.parameter_fields) is not tuple
            or len(self.parameter_fields) > 20
            or any(type(p) is not str or p not in _FIELDS for p in self.parameter_fields)
        ):
            raise ValueError("explicit bounded approved text-template binding required")
        positions = [int(m) for m in _PLACEHOLDER.findall(self.body)]
        remainder = _PLACEHOLDER.sub("", self.body)
        if (
            set(positions) != set(range(1, len(self.parameter_fields) + 1))
            or "{{" in remainder
            or "}}" in remainder
        ):
            raise ValueError("template requires exact contiguous positional text parameters")


class CloudTemplateProvider:
    """A real bounded HTTPS adapter; default OFF and no automatic API upgrade."""

    def __init__(self, account: CloudAccount, *, enabled=False, transport=None):
        if type(account) is not CloudAccount or type(enabled) is not bool:
            raise ValueError("explicit Cloud API account and activation state required")
        self.account, self.enabled = account, enabled
        self._enabled = enabled
        self._configuration = astuple(account)
        original_transport = (
            transport
            if transport is not None
            else httpx.AsyncHTTPTransport(
                retries=0, trust_env=False, limits=httpx.Limits(max_connections=1)
            )
        )
        self._session = httpx.AsyncClient(
            transport=_CloudTransport(original_transport),
            trust_env=False,
            follow_redirects=False,
            timeout=httpx.Timeout(30, connect=10),
            limits=httpx.Limits(max_connections=1),
        )
        self._lock, self._closed = asyncio.Lock(), False
        self._ports = self._session, self._session.send, self._session.build_request, self._lock
        self._root_account = account
        _PROVIDERS[self] = _CloudOwnership(
            account,
            self._configuration,
            self._ports,
            self._session._transport,
            enabled,
            [False, None],
        )

    def check(self):
        owner = _PROVIDERS.get(self)
        if (
            type(owner) is not _CloudOwnership
            or owner.lifecycle[0]
            or self._closed
            or self._ports is not owner.ports
            or self._root_account is not owner.account
            or self._configuration is not owner.configuration
            or self._enabled is not owner.enabled
            or self.enabled is not self._enabled
            or self.enabled is not True
            or self.account is not self._root_account
            or astuple(self.account) != self._configuration
            or self._session._transport is not owner.transport
            or self._session.auth is not None
            or self._session.params
            or self._session.cookies
            or self._session.trust_env is not False
            or self._session.follow_redirects is not False
            or any(self._session.event_hooks.values())
            or self._session._mounts
            or not same_ports(
                self._ports,
                (self._session, self._session.send, self._session.build_request, self._lock),
            )
        ):
            raise Refusal("binding_denied")
        owner.transport.check()

    def send_attempt(self, *, context=None, accounting=None):
        CloudTemplateProvider.check(self)
        if context is not None:
            from .trusted_actions.adapters import EngineContext

            if type(context) is not EngineContext:
                raise Refusal("binding_denied")
            context.check()
        ticket = CloudSendAttempt(self)
        _ATTEMPTS[ticket] = (
            self,
            asyncio.current_task(),
            [False],
            context.request if context is not None else None,
            None,
        )
        if accounting is not None:
            from .native_whatsapp_accounting import NativeWhatsAppAccounting

            if type(accounting) is not NativeWhatsAppAccounting:
                raise Refusal("binding_denied")
            token = NativeWhatsAppAccounting.issue(accounting, self, ticket, context)
            _ATTEMPTS[ticket] = (*_ATTEMPTS[ticket][:4], token)
        return ticket

    def was_dispatched(self, attempt):
        item = _ATTEMPTS.get(attempt) if type(attempt) is CloudSendAttempt else None
        if item is None or item[0] is not self or attempt.provider is not self:
            raise Refusal("binding_denied")
        return item[2][0]

    def pacing_recipient(self, attempt):
        """Original private validated recipient for native ledger HMAC only.

        This is neither a public query nor a caller-provided pair reference.
        The issuer must be executing the exact original POST scope/Task.
        """
        CloudTemplateProvider.check(self)
        original = _ATTEMPTS.get(attempt) if type(attempt) is CloudSendAttempt else None
        private = _RECIPIENTS.get(attempt)
        scope = _SCOPE.get()
        if (
            original is None
            or original[0] is not self
            or original[1] is not asyncio.current_task()
            or private is None
            or private[0]() is not self
            or type(scope) is not _RequestScope
            or scope.request.method != "POST"
            or scope.attempted is not original[2]
        ):
            raise Refusal("binding_denied")
        _check_scope(scope.request, scope.transport)
        CloudTemplateProvider.check(self)
        return SecretValue(private[1])

    async def _request(self, method, path, current, *, query=None, body=None, attempt=None):
        try:
            return await CloudTemplateProvider._exchange(
                self, method, path, current, query=query, body=body, attempt=attempt
            )
        except TimeoutError:
            raise Refusal("status_unknown" if method == "POST" else "action_failed") from None

    async def _exchange(self, method, path, current, *, query=None, body=None, attempt=None):
        CloudTemplateProvider.check(self)
        current()
        async with self._lock, asyncio.timeout(40):
            CloudTemplateProvider.check(self)
            current()
            url = f"https://graph.facebook.com/{self.account.api_version}/{path}"
            request = self._session.build_request(
                method,
                url,
                params=query,
                json=body,
                headers={
                    "Authorization": "Bearer " + self.account.token.value,
                    "Accept-Encoding": "identity",
                },
            )
            response = None
            attempted = [False]
            if method == "POST":
                item = _ATTEMPTS.get(attempt) if type(attempt) is CloudSendAttempt else None
                if item is None or item[0] is not self or item[1] is not asyncio.current_task():
                    raise Refusal("binding_denied")
                attempted = item[2]
            marker = _SCOPE.set(
                _RequestScope(
                    asyncio.current_task(),
                    request,
                    self._session._transport,
                    lambda: (CloudTemplateProvider.check(self), current()),
                    attempted,
                    item[4] if method == "POST" else None,
                )
            )
            failure = "status_unknown" if method == "POST" else "action_failed"
            try:
                response = await self._session.send(request, stream=True, follow_redirects=False)
                CloudTemplateProvider.check(self)
                current()
                status = response.status_code
                retry_headers = tuple(response.headers.get_list("retry-after"))
                if response.headers.get("content-encoding", "identity").lower() != "identity":
                    raise Refusal(failure)
                data = bytearray()
                async for chunk in response.aiter_bytes(chunk_size=65536):
                    CloudTemplateProvider.check(self)
                    current()
                    if len(chunk) > 262144 - len(data):
                        raise Refusal(failure)
                    data.extend(chunk)
                CloudTemplateProvider.check(self)
                current()
                try:
                    value = strict_json(data.decode("utf-8"), limit=262144)
                except (ValueError, UnicodeError, RecursionError, Refusal):
                    raise Refusal(failure) from None
                if method == "POST" and status in {400, 429}:
                    error = value.get("error")
                    # Explicit original rejection, never a mixed success/error,
                    # free text, bool/coerced code or arbitrary HTTP failure.
                    if (
                        type(error) is dict
                        and type(error.get("code")) is int
                        and "messages" not in value
                        and "contacts" not in value
                        and error["code"] in {130429, 131048, 131056}
                    ):
                        code = "pair_rate_limited" if error["code"] == 131056 else "rate_limited"
                        raise _issue_provider_refusal(
                            self,
                            attempt,
                            code,
                            retry_after_seconds(retry_headers, now=datetime.now(UTC)),
                        )
                    if status == 429 and "messages" not in value and "contacts" not in value:
                        raise _issue_provider_refusal(
                            self,
                            attempt,
                            "rate_limited",
                            retry_after_seconds(retry_headers, now=datetime.now(UTC)),
                        )
                if status != 200 or "error" in value:
                    raise Refusal(failure)
                return value
            except (httpx.HTTPError, TimeoutError):
                # Never include the request, response, recipient or token.
                raise Refusal("status_unknown" if method == "POST" else "action_failed") from None
            except PacingProviderRefusal as error:
                # Only original issuance for this exact native attempt survives.
                if pacing_refusal_metadata(error, provider=self, attempt=attempt) is None:
                    raise Refusal(failure) from None
                raise
            except Refusal:
                if method == "POST" and attempted[0]:
                    raise Refusal("status_unknown") from None
                raise
            finally:
                try:
                    if response is not None:
                        _, cancelled = await join_owned(response.aclose())
                        if cancelled:
                            raise asyncio.CancelledError
                finally:
                    _SCOPE.reset(marker)

    async def verify(self, template: ApprovedTextTemplate, current):
        CloudTemplateProvider.check(self)
        if type(template) is not ApprovedTextTemplate or template.account != self.account.account:
            raise Refusal("binding_denied")
        senders = await CloudTemplateProvider._request(
            self,
            "GET",
            self.account.business_id + "/phone_numbers",
            current,
            query={"fields": "id", "limit": 100},
        )
        phones, paging = senders.get("data"), senders.get("paging", {})
        if (
            type(phones) is not list
            or len(phones) > 100
            or type(paging) is not dict
            or paging.get("next")
            or any(type(row) is not dict or type(row.get("id")) is not str for row in phones)
            or sum(row["id"] == self.account.phone_number_id for row in phones) != 1
        ):
            raise Refusal("binding_denied")
        value = await CloudTemplateProvider._request(
            self,
            "GET",
            self.account.business_id + "/message_templates",
            current,
            query={
                "name": template.name,
                "fields": "id,name,status,language,components",
                "limit": 100,
            },
        )
        rows = value.get("data")
        paging = value.get("paging", {})
        if (
            type(rows) is not list
            or len(rows) > 100
            or type(paging) is not dict
            or paging.get("next")
        ):
            raise Refusal("action_failed")
        exact = [
            r
            for r in rows
            if type(r) is dict
            and r.get("id") == template.template_id
            and r.get("name") == template.name
            and r.get("language") == template.language
        ]
        if len(exact) != 1 or exact[0].get("status") != "APPROVED":
            raise Refusal("action_failed")
        components = exact[0].get("components")
        if (
            type(components) is not list
            or len(components) != 1
            or type(components[0]) is not dict
            or components[0].get("type") != "BODY"
            or components[0].get("text") != template.body
        ):
            raise Refusal("binding_denied")

    async def send(self, template, recipient, parameters, current, *, attempt=None):
        attempt = CloudTemplateProvider.send_attempt(self) if attempt is None else attempt
        original = _ATTEMPTS.get(attempt)
        if original is None or original[0] is not self:
            raise Refusal("binding_denied")
        token = original[4]
        if token is None:
            return await CloudTemplateProvider._send_without_accounting(
                self, template, recipient, parameters, current, attempt=attempt
            )
        from .native_whatsapp_accounting import finish_native_cloud_send, native_accounting_scope

        async with native_accounting_scope(token):
            try:
                accepted = await CloudTemplateProvider._send_without_accounting(
                    self, template, recipient, parameters, current, attempt=attempt
                )
            except BaseException as error:
                original_current = True
                if not isinstance(error, asyncio.CancelledError):
                    try:
                        CloudTemplateProvider.check(self)
                        current()
                        CloudTemplateProvider.check(self)
                    except Exception:
                        original_current = False
                try:
                    await finish_native_cloud_send(token, error=error if original_current else None)
                except asyncio.CancelledError:
                    raise
                except Exception:
                    if isinstance(error, asyncio.CancelledError):
                        raise error from None
                    raise Refusal("status_unknown") from None
                if not original_current:
                    raise Refusal("status_unknown") from None
                try:
                    CloudTemplateProvider.check(self)
                    current()
                    CloudTemplateProvider.check(self)
                except Exception:
                    raise Refusal("status_unknown") from None
                raise
            else:
                try:
                    await finish_native_cloud_send(token, accepted=accepted is True)
                    CloudTemplateProvider.check(self)
                    current()
                    CloudTemplateProvider.check(self)
                except asyncio.CancelledError:
                    raise
                except Exception:
                    raise Refusal("status_unknown") from None
                return accepted

    async def _send_without_accounting(self, template, recipient, parameters, current, *, attempt):
        CloudTemplateProvider.check(self)
        if (
            type(template) is not ApprovedTextTemplate
            or type(recipient) is not str
            or re.fullmatch(r"[1-9][0-9]{7,14}", recipient) is None
            or type(parameters) is not tuple
            or len(parameters) != len(template.parameter_fields)
            or any(
                type(v) is not str or not 1 <= len(v) <= 1024 or any(ord(c) < 32 for c in v)
                for v in parameters
            )
        ):
            raise Refusal("invalid_fields")
        original = _ATTEMPTS.get(attempt) if type(attempt) is CloudSendAttempt else None
        if original is None or original[0] is not self or original[1] is not asyncio.current_task():
            raise Refusal("binding_denied")
        private = _RECIPIENTS.get(attempt)
        if private is None:
            _RECIPIENTS[attempt] = weakref.ref(self), recipient
        elif private[0]() is not self or private[1] != recipient:
            raise Refusal("binding_denied")
        # Approval is read again on the fresh admitted send, after queue/consent.
        await CloudTemplateProvider.verify(self, template, current)
        current()
        payload = {
            "messaging_product": "whatsapp",
            "to": recipient,
            "type": "template",
            "template": {"name": template.name, "language": {"code": template.language}},
        }
        if parameters:
            payload["template"]["components"] = [
                {
                    "type": "body",
                    "parameters": [{"type": "text", "text": text} for text in parameters],
                }
            ]
        attempt = CloudTemplateProvider.send_attempt(self) if attempt is None else attempt
        try:
            value = await CloudTemplateProvider._request(
                self,
                "POST",
                self.account.phone_number_id + "/messages",
                current,
                body=payload,
                attempt=attempt,
            )
        except PacingProviderRefusal as error:
            # Response close is awaited by _exchange. Its completion is not
            # fresh policy; direct callers get the same final guard as native
            # composition before they can publish original rejection metadata.
            try:
                CloudTemplateProvider.check(self)
                current()
                CloudTemplateProvider.check(self)
                if pacing_refusal_metadata(error, provider=self, attempt=attempt) is None:
                    raise Refusal("status_unknown")
            except Refusal:
                raise Refusal("status_unknown") from None
            raise
        try:
            CloudTemplateProvider.check(self)
            current()
            CloudTemplateProvider.check(self)
        except Refusal:
            raise Refusal("status_unknown") from None
        messages = value.get("messages")
        if (
            value.get("messaging_product") != "whatsapp"
            or type(messages) is not list
            or len(messages) != 1
            or type(messages[0]) is not dict
            or type(messages[0].get("id")) is not str
            or not 1 <= len(messages[0]["id"]) <= 512
        ):
            raise Refusal("status_unknown")
        return True

    async def close(self):
        self._closed = True
        owner = _PROVIDERS.get(self)
        if type(owner) is not _CloudOwnership:
            raise Refusal("binding_denied")
        owner.lifecycle[0] = True
        if owner.lifecycle[1] is None:

            async def close_original():
                session = owner.ports[0]
                # The client is ours, but replacement transports/mounts are not.
                # Restore only constructor-owned cleanup roots before HTTPX exit.
                session._transport = owner.transport
                session._mounts = {}
                await _CLIENT_CLOSE(session)

            owner.lifecycle[1] = asyncio.create_task(close_original())
        _, cancelled = await join_owned(owner.lifecycle[1])
        if cancelled:
            raise asyncio.CancelledError
