"""Actual HA HTTP ingress for original source-authorized native media jobs.

Tickets identify bounded one-use request slots. They are never authentication,
track consent, source policy, or permission to replay an original operation.
"""

from __future__ import annotations

import asyncio
import hashlib
import json
import secrets
import weakref
from dataclasses import dataclass, field
from datetime import timedelta
from typing import Any

from aiohttp import web
from homeassistant.components.http import KEY_HASS, HomeAssistantView
from homeassistant.components.http.server import HomeAssistantRequest
from homeassistant.const import EVENT_HOMEASSISTANT_STOP
from homeassistant.core import HomeAssistant, callback

from .access.arx_execution_authority import FeatureLease
from .access.arx_feature_host import NativeFeatureHost, _join
from .access.arx_validation_execution import ValidationMediaInput
from .bridge_command_auth import BridgeExecutionBinding, host_for, retain_execution
from .const import DOMAIN
from .trusted_actions.direct_bridge_origin import DirectBridgeConnection, check_connection
from .trusted_actions.envelope import thaw
from .trusted_actions.source_bindings import same_ports
from .trusted_actions.validation import Refusal, aware, strict_json

INGRESS_KEY = "feature_media_ingress"
PREFIX = "/api/hikvision_intercom/features/media/"
DIRECT_PREFIX = "/api/hikvision_intercom/arx_bridge/v1/media/"
DIRECT_KEY = "direct_feature_media_ingress"
MAX_PLANS = 12
MAX_TICKETS = 64
MAX_HISTORY = 128
MAX_VIDEO_INPUTS = 12
CLAIM_SECONDS = 15
_VIEWS = weakref.WeakKeyDictionary()
_CLAIMS = {}  # Request is weak-referenceable but deliberately unhashable in HA.


@dataclass(eq=False, repr=False)
class _Plan:
    reference: str
    host: object
    lease: object
    connection: object
    user: object
    send: object
    subscriptions: dict
    subscription: int
    video: tuple
    audio_subscription: int | None
    tickets: tuple
    fingerprint: str
    operation: tuple
    prepare_deadline: float
    execution_deadline: float
    expires_at: str
    targets: tuple
    refresh_token_id: str | None
    user_id: str
    claims: dict = field(default_factory=dict)
    changed: asyncio.Event = field(default_factory=asyncio.Event)
    job: object = None
    reference_job: str | None = None
    watcher: object = None
    closing: object = None
    closed: bool = False
    on_disconnect: object = None
    active: bool = False


@dataclass(repr=False)
class _View:
    hass: object
    namespace: int
    auth: object
    get_user: object
    plans: dict = field(default_factory=dict)
    tickets: dict = field(default_factory=dict)
    history: dict = field(default_factory=dict)
    requests: dict = field(default_factory=dict)
    closed: bool = False


@dataclass(repr=False)
class _Claim:
    plan: object
    view: object
    step_id: str
    task: object
    coroutine: object
    response: object = None
    permit: object = None
    finished: bool = False
    execution: object = None
    transport: object = None


class FeatureMediaIngress(HomeAssistantView):
    url = PREFIX + "{ticket}"
    name = "api:hikvision_intercom:features:media"
    requires_auth = True

    def __init__(self, hass):
        if type(hass) is not HomeAssistant:
            raise ValueError("actual Home Assistant required")
        self.hass = hass
        _VIEWS[self] = _View(
            weakref.ref(hass),
            id(hass.data[DOMAIN]),
            weakref.ref(hass.auth),
            hass.auth.async_get_user,
        )

    def _owner(self):
        owner = _VIEWS.get(self)
        hass = owner.hass() if owner is not None else None
        if (
            owner is None
            or owner.closed
            or hass is None
            or self.hass is not hass
            or hass.is_stopping
            or id(hass.data.get(DOMAIN)) != owner.namespace
            or hass.data[DOMAIN].get(INGRESS_KEY) is not self
            or hass.auth is not owner.auth()
            or not same_ports((owner.get_user,), (hass.auth.async_get_user,))
        ):
            raise Refusal("native_media_ingress_unavailable")
        return owner

    def check_host(self, host: NativeFeatureHost) -> None:
        owner = FeatureMediaIngress._owner(self)
        if type(host) is not NativeFeatureHost or host.hass is not owner.hass():
            raise Refusal("binding_denied")
        NativeFeatureHost._stable(host)

    def _guard(self, plan):
        owner = FeatureMediaIngress._owner(self)
        host = plan.host()
        if (
            owner.plans.get(plan.reference) is not plan
            or plan.closed
            or host is None
            or plan.connection.user is not plan.user
            or plan.user.is_active is not True
            or type(plan.connection) is not DirectBridgeConnection
            and (
                plan.connection.refresh_token_id != plan.refresh_token_id
                or plan.refresh_token_id not in plan.user.refresh_tokens
            )
            or plan.connection.subscriptions is not plan.subscriptions
            or plan.subscriptions.get(plan.subscription) is not plan.on_disconnect
            or not same_ports((plan.send,), (plan.connection.send_message,))
            or asyncio.get_running_loop().time() >= plan.execution_deadline
            or not plan.active
            and asyncio.get_running_loop().time() >= plan.prepare_deadline
        ):
            raise Refusal("binding_denied")
        if type(plan.connection) is DirectBridgeConnection:
            check_connection(plan.connection)
        NativeFeatureHost.check_admitted(host, plan.lease, plan.connection)
        for target in plan.targets:
            target.check()
        if not plan.active and plan.lease.message._boundary.clock().now >= aware(
            plan.lease.message.request.get("request_expires_at")
        ):
            raise Refusal("binding_denied")
        for request, claim in plan.claims.values():
            if (
                request_subject(request) is not plan.user
                or not claim.finished
                and (request.transport is None or request.transport.is_closing())
                or claim.task.get_coro() is not claim.coroutine
            ):
                raise Refusal("binding_denied")

    def _response(self, plan):
        FeatureMediaIngress._guard(self, plan)
        return {
            "schema_version": 1,
            "state": "active" if plan.job is not None else "prepared",
            "preparation_ref": plan.reference,
            "operation_ref": plan.reference_job,
            "expires_at": plan.expires_at,
            "ingress": [
                {
                    "step_id": step_id,
                    "url": (
                        DIRECT_PREFIX if type(plan.connection) is DirectBridgeConnection else PREFIX
                    )
                    + ticket,
                }
                for ticket, step_id in plan.tickets
            ],
            "replay_available": False,
        }

    async def prepare(self, host, encoded, connection, subscription, audio_subscription):
        owner = FeatureMediaIngress._owner(self)
        FeatureMediaIngress.check_host(self, host)
        lease = await NativeFeatureHost.admit_media_source(host, encoded, connection)
        FeatureMediaIngress.check_host(self, host)
        NativeFeatureHost.check_admitted(host, lease, connection)
        feature, private = lease.message.request.get("feature"), thaw(lease.private_input)
        video, audio = [], False
        if feature == "live_media":
            if lease.message.request.parameters.get("direction") != "video_only":
                raise Refusal("native_media_ingress_required")
            video.append(("live_media", lease.message.request.parameters["station_id"]))
        elif feature == "live_validation" and type(private) is dict:
            steps = private.get("steps")
            if type(steps) is not list or not 1 <= len(steps) <= 64:
                raise Refusal("invalid_fields")
            for step in steps:
                if type(step) is not dict:
                    raise Refusal("invalid_fields")
                if step.get("action") == "video":
                    video.append((step["step_id"], step["station_id"]))
                elif step.get("action") == "two_way_audio":
                    audio = True
        if (
            not 1 <= len(video) <= MAX_VIDEO_INPUTS
            or len({v[0] for v in video}) != len(video)
            or type(subscription) is not int
            or subscription <= 0
            or subscription in connection.subscriptions
            or (
                audio
                and (
                    type(audio_subscription) is not int
                    or audio_subscription <= 0
                    or audio_subscription == subscription
                    or audio_subscription in connection.subscriptions
                )
            )
            or not audio
            and audio_subscription is not None
        ):
            raise Refusal("native_media_ingress_required")
        descriptor = thaw(lease.message.request.descriptor)
        fingerprint = hashlib.sha256(
            json.dumps(
                descriptor, sort_keys=True, separators=(",", ":"), ensure_ascii=True
            ).encode()
        ).hexdigest()
        peer = lease.message.verification
        operation = peer.verified_peer_ref, lease.message.request.get("operation_id")
        old = owner.history.get(operation)
        if old is not None:
            if old[:3] != (fingerprint, id(connection), connection.user.id):
                raise Refusal("operation_conflict")
            existing = owner.plans.get(old[3])
            if existing is None:
                return {
                    "schema_version": 1,
                    "state": "retired",
                    "preparation_ref": old[3],
                    "operation_ref": old[4],
                    "expires_at": None,
                    "ingress": [],
                    "replay_available": False,
                }, lease
            return FeatureMediaIngress._response(self, existing), lease
        if (
            len(owner.plans) >= MAX_PLANS
            or len(owner.history) >= MAX_HISTORY
            or sum(len(p.video) for p in owner.plans.values()) + len(video) > MAX_TICKETS
        ):
            raise Refusal("native_media_ingress_capacity")
        now = lease.message._boundary.clock().now
        ttl = (aware(descriptor["execution_expires_at"]) - now).total_seconds()
        claim_ttl = min(
            CLAIM_SECONDS, ttl, (aware(descriptor["request_expires_at"]) - now).total_seconds()
        )
        if not 0 < ttl <= 3600 or claim_ttl <= 0:
            raise Refusal("invalid_fields")
        targets = NativeFeatureHost._targets(host, lease)
        loop = asyncio.get_running_loop()
        reference = secrets.token_hex(16)
        tickets = tuple((secrets.token_hex(24), sid) for sid, _station in video)
        plan = _Plan(
            reference,
            weakref.ref(host),
            lease,
            connection,
            connection.user,
            connection.send_message,
            connection.subscriptions,
            subscription,
            tuple(video),
            audio_subscription,
            tickets,
            fingerprint,
            operation,
            loop.time() + claim_ttl,
            loop.time() + ttl,
            (now + timedelta(seconds=claim_ttl)).isoformat(),
            targets,
            None if type(connection) is DirectBridgeConnection else connection.refresh_token_id,
            connection.user.id,
        )

        @callback
        def disconnected():
            FeatureMediaIngress._mark_closed(self, plan)
            owner.hass().async_create_task(FeatureMediaIngress._close_plan(self, plan))

        plan.on_disconnect = disconnected
        connection.subscriptions[subscription] = disconnected
        owner.plans[reference] = plan
        owner.history[operation] = fingerprint, id(connection), connection.user.id, reference, None
        for ticket, sid in tickets:
            owner.tickets[ticket] = plan, sid
        try:
            NativeFeatureHost.attach_media_ingress(host, self)
            plan.watcher = asyncio.create_task(FeatureMediaIngress._watch(self, plan))
            plan.watcher.add_done_callback(
                lambda task: task.exception() if not task.cancelled() else None
            )
            return FeatureMediaIngress._response(self, plan), lease
        except BaseException:
            FeatureMediaIngress._mark_closed(self, plan)
            await FeatureMediaIngress._close_plan(self, plan)
            raise

    @staticmethod
    def _mark_closed(view, plan):
        from .access.arx_media_execution import NativeMediaPermit

        plan.closed = True
        plan.changed.set()
        for _request, claim in plan.claims.values():
            if claim.permit is not None:
                NativeMediaPermit.stop(claim.permit)

    async def _watch(self, plan):
        try:
            while True:
                FeatureMediaIngress._guard(self, plan)
                if plan.job is not None and plan.job.task.done():
                    break
                await asyncio.sleep(0.25)
        except (Refusal, asyncio.CancelledError):
            pass
        finally:
            FeatureMediaIngress._mark_closed(self, plan)
            await FeatureMediaIngress._close_plan(self, plan)

    async def _close_plan(self, plan):
        owner = _VIEWS.get(self)
        if owner is None or owner.plans.get(plan.reference) is not plan:
            return
        FeatureMediaIngress._mark_closed(self, plan)
        if plan.closing is None:
            caller = asyncio.current_task()
            exclude = caller if any(c.task is caller for _req, c in plan.claims.values()) else None

            async def finish():
                error = None
                try:
                    if plan.job is not None and (host := plan.host()) is not None:
                        await NativeFeatureHost._stop_job(host, plan.job)
                except BaseException as failure:
                    error = failure
                tasks = [
                    claim.task
                    for _req, claim in plan.claims.values()
                    if claim.task is not exclude and not claim.task.done()
                ]
                # Request owners are cancelled only after original native media
                # cleanup. Never cancel an unrelated task or the closing caller.
                for task in tasks:
                    task.cancel()
                if tasks:
                    await asyncio.gather(*tasks, return_exceptions=True)
                if plan.subscriptions.get(plan.subscription) is plan.on_disconnect:
                    plan.subscriptions.pop(plan.subscription)
                for ticket, _sid in plan.tickets:
                    owner.tickets.pop(ticket, None)
                owner.history[plan.operation] = (
                    plan.fingerprint,
                    id(plan.connection),
                    plan.user_id,
                    plan.reference,
                    plan.reference_job,
                )
                for request, _claim in plan.claims.values():
                    _CLAIMS.pop(id(request), None)
                if error is not None:
                    raise error

            plan.closing = asyncio.create_task(finish())
        error = None
        try:
            await _join(plan.closing)
        except BaseException as failure:
            error = failure
        try:
            if plan.watcher is not None and plan.watcher is not asyncio.current_task():
                await _join(asyncio.gather(plan.watcher, return_exceptions=True))
        finally:
            owner.plans.pop(plan.reference, None)
        if error is not None:
            raise error

    def publication(self, reference, lease, host, connection):
        NativeFeatureHost.check_admitted(host, lease, connection)
        owner = FeatureMediaIngress._owner(self)
        plan = owner.plans.get(reference)
        if plan is not None:
            if plan.host() is not host or plan.connection is not connection:
                raise Refusal("binding_denied")
            return FeatureMediaIngress._response(self, plan)
        for record in owner.history.values():
            if record[3] == reference and record[1:3] == (id(connection), connection.user.id):
                return {
                    "schema_version": 1,
                    "state": "retired",
                    "preparation_ref": reference,
                    "operation_ref": record[4],
                    "expires_at": None,
                    "ingress": [],
                    "replay_available": False,
                }
        raise Refusal("binding_denied")

    async def close_host(self, host: NativeFeatureHost) -> None:
        owner = _VIEWS.get(self)
        if owner is None:
            return
        plans = tuple(p for p in owner.plans.values() if p.host() is host)
        await FeatureMediaIngress._close_many(self, plans)

    async def _close_many(self, plans):
        for plan in plans:
            FeatureMediaIngress._mark_closed(self, plan)

        async def finish():
            results = await asyncio.gather(
                *(FeatureMediaIngress._close_plan(self, plan) for plan in plans),
                return_exceptions=True,
            )
            if any(isinstance(result, BaseException) for result in results):
                raise Refusal("feature_cleanup_unknown")

        await _join(asyncio.create_task(finish()))

    async def get(self, request, ticket, *, direct=False):
        plan, claim = None, None
        try:
            owner = FeatureMediaIngress._owner(self)
            if type(request) is not HomeAssistantRequest:
                raise Refusal("Unauthorized")
            slot = owner.tickets.get(ticket)
            if slot is None:
                raise Refusal("binding_denied")
            plan, sid = slot
            execution = None
            if direct:
                if (
                    type(plan.connection) is not DirectBridgeConnection
                    or request.path != DIRECT_PREFIX + ticket
                    or request.query_string
                    or request.method != "GET"
                    or request.app.get(KEY_HASS) is not owner.hass()
                    or request.transport is None
                    or request.transport.is_closing()
                ):
                    raise Refusal("Unauthorized")
                row = check_connection(plan.connection)
                encoded = request.headers.get("X-WisKey-Bridge")
                if type(encoded) is not str or len(encoded.encode()) > 16384:
                    raise Refusal("Unauthorized")
                principal = await host_for(owner.hass()).admit(
                    plan.connection,
                    {
                        "id": plan.subscription,
                        "type": DOMAIN + "/features/media_ingress_v1",
                        "bridge": strict_json(encoded),
                    },
                    "features/media_ingress_v1",
                )
                if principal.parameters != {
                    "ticket": ticket,
                    "preparation_ref": plan.reference,
                    "connection_ref": row.challenge,
                }:
                    raise Refusal("binding_denied")
                FeatureMediaIngress._guard(self, plan)
                execution = retain_execution(
                    principal, aware(plan.lease.message.request.get("execution_expires_at"))
                )
            else:
                if type(plan.connection) is DirectBridgeConnection:
                    raise Refusal("Unauthorized")
                if request_subject(request) is not plan.user:
                    raise Refusal("Unauthorized")
                actual = await owner.get_user(plan.user_id)
                FeatureMediaIngress._guard(self, plan)
                if actual is not plan.user or request_subject(request) is not plan.user:
                    raise Refusal("Unauthorized")
            if not web.WebSocketResponse().can_prepare(request).ok:
                raise Refusal("native_media_ingress_required")
            if owner.tickets.get(ticket) != slot or sid in plan.claims:
                raise Refusal("operation_conflict")
            owner.tickets.pop(ticket)
            task = asyncio.current_task()
            claim = _Claim(
                weakref.ref(plan),
                weakref.ref(self),
                sid,
                task,
                task.get_coro(),
                execution=execution,
                transport=request.transport,
            )
            plan.claims[sid] = request, claim
            _CLAIMS[id(request)] = weakref.ref(request), claim
            FeatureMediaIngress._guard(self, plan)
            if len(plan.claims) == len(plan.video):
                mse = owner.hass().data[DOMAIN].get("mse_view")
                inputs = ()
                if plan.lease.message.request.get("feature") == "live_validation":
                    inputs = tuple(
                        ValidationMediaInput(
                            step["step_id"],
                            plan.connection,
                            request=plan.claims[step["step_id"]][0],
                            view=mse,
                        )
                        if step["action"] == "video"
                        else ValidationMediaInput(
                            step["step_id"], plan.connection, subscription=plan.audio_subscription
                        )
                        for step in thaw(plan.lease.private_input)["steps"]
                        if step["action"] in {"video", "two_way_audio"}
                    )
                host = plan.host()
                reference = await NativeFeatureHost.start_admitted(
                    host,
                    plan.lease,
                    plan.connection,
                    video=(mse, request) if not inputs else None,
                    validation_media=inputs,
                    media_preparation=plan,
                )
                FeatureMediaIngress._guard(self, plan)
                plan.reference_job = reference
                plan.job = NativeFeatureHost._job(host, reference, plan.connection)
                plan.connection.send_event(
                    plan.subscription,
                    {
                        "schema_version": 1,
                        "type": "operation_admitted",
                        "preparation_ref": plan.reference,
                        "operation_ref": reference,
                    },
                )
                plan.changed.set()
            while plan.job is None:
                await plan.changed.wait()
                FeatureMediaIngress._guard(self, plan)
            try:
                await _join(plan.job.task)
            except (Refusal, asyncio.CancelledError):
                if asyncio.current_task().cancelling():
                    raise
                if not (claim.response is not None and claim.response.prepared):
                    raise
            # Native serving code alone supplies this original prepared object.
            response = claim.response
            if type(response) is not web.WebSocketResponse or not response.prepared:
                raise Refusal("native_media_not_started")
            return response
        except Exception as error:
            raise web.HTTPForbidden(text="Native media unavailable") from error
        finally:
            if plan is not None and claim is not None:
                FeatureMediaIngress._mark_closed(self, plan)
                try:
                    if plan.job is not None and (host := plan.host()) is not None:
                        await NativeFeatureHost._stop_job(host, plan.job)
                finally:
                    if plan.closing is None:
                        await FeatureMediaIngress._close_plan(self, plan)


def request_subject(request):
    """Read an original native claim; never inject a service into hass_user."""
    record = _CLAIMS.get(id(request))
    if record is None or record[1].execution is None:
        return request.get("hass_user")
    if record[0]() is not request:
        raise Refusal("binding_denied")
    claim = record[1]
    plan, view = claim.plan(), claim.view()
    if (
        plan is None
        or view is None
        or plan.closed
        or type(claim.execution) is not BridgeExecutionBinding
    ):
        raise Refusal("binding_denied")
    owner = FeatureMediaIngress._owner(view)
    if (
        owner.plans.get(plan.reference) is not plan
        or plan.claims.get(claim.step_id) != (request, claim)
        or type(plan.connection) is not DirectBridgeConnection
        or request.transport is not claim.transport
        or claim.transport is None
        or not claim.finished
        and claim.transport.is_closing()
    ):
        raise Refusal("binding_denied")
    claim.execution.check()
    if claim.execution.owner_key[2:] != (plan.user, plan.connection):
        raise Refusal("binding_denied")
    check_connection(plan.connection)
    return plan.user


class DirectFeatureMediaIngress(HomeAssistantView):
    url = DIRECT_PREFIX + "{ticket}"
    name = "api:hikvision_intercom:arx_bridge:media"
    requires_auth = False

    def __init__(self, hass, original):
        self._creation = hass, original

    async def get(self, request, ticket):
        hass, original = self._creation
        if (
            hass.data.get(DOMAIN, {}).get(DIRECT_KEY) is not self
            or hass.data[DOMAIN].get(INGRESS_KEY) is not original
        ):
            raise web.HTTPForbidden(text="Native media unavailable")
        return await FeatureMediaIngress.get(original, request, ticket, direct=True)


def observe_native_response(request, view, runtime, response, permit):
    """Observation only, never admission; native MSE owns framing and cleanup."""
    if type(request) is not HomeAssistantRequest:
        return
    record = _CLAIMS.get(id(request))
    if record is None:
        return  # Existing native non-HTTP tests/host ingress retain their contracts.
    if record[0]() is not request:
        raise Refusal("binding_denied")
    claim = record[1]
    plan, ingress = claim.plan(), claim.view()
    if plan is None or ingress is None or claim.response is not None:
        raise Refusal("binding_denied")
    FeatureMediaIngress._guard(ingress, plan)
    permit.check_video(request, view, runtime)
    if type(response) is not web.WebSocketResponse:
        raise Refusal("binding_denied")
    claim.response, claim.permit = response, permit


def observe_native_finished(request, permit):
    """Only native MSE's completed original upstream/downstream exit retires input."""
    record = _CLAIMS.get(id(request))
    if record is None:
        return
    claim = record[1]
    if record[0]() is not request or claim.permit is not permit or claim.response is None:
        raise Refusal("binding_denied")
    claim.finished = True


def check_prepared_start(
    plan: _Plan, host: NativeFeatureHost, lease: FeatureLease, connection: Any
) -> None:
    if (
        type(plan) is not _Plan
        or plan.host() is not host
        or plan.lease is not lease
        or plan.connection is not connection
    ):
        raise Refusal("binding_denied")
    claims = tuple(plan.claims.values())
    if not claims or len(claims) != len(plan.video):
        raise Refusal("binding_denied")
    ingress = claims[0][1].view()
    if ingress is None:
        raise Refusal("binding_denied")
    FeatureMediaIngress._guard(ingress, plan)


def prepared_started(plan: _Plan) -> None:
    plan.active = True


@callback
def register_feature_media_ingress(hass):
    namespace = hass.data[DOMAIN]
    if namespace.get(INGRESS_KEY) is not None:
        view = namespace[INGRESS_KEY]
        if type(view) is not FeatureMediaIngress:
            raise Refusal("native_media_ingress_unavailable")
        FeatureMediaIngress._owner(view)
        return view
    view = FeatureMediaIngress(hass)
    namespace[INGRESS_KEY] = view
    hass.http.register_view(view)
    direct = DirectFeatureMediaIngress(hass, view)
    namespace[DIRECT_KEY] = direct
    hass.http.register_view(direct)

    async def stop(_event):
        owner = _VIEWS.get(view)
        if owner is not None:
            try:
                await FeatureMediaIngress._close_many(view, tuple(owner.plans.values()))
            finally:
                owner.history.clear()
                owner.closed = True
                _VIEWS.pop(view, None)
                if hass.data.get(DOMAIN, {}).get(INGRESS_KEY) is view:
                    hass.data[DOMAIN].pop(INGRESS_KEY)

    hass.bus.async_listen_once(EVENT_HOMEASSISTANT_STOP, stop)
    return view
