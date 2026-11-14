"""Production capture composition over the original bridge and CardEnrollment.

Arx attests its current human/RBAC/scope through the original authenticated DTO
and revoke/heartbeat stream. WisKey binds that attestation to current native
person revision, receiver, runtime and collector. No HA user is synthesized.
"""

from __future__ import annotations

import asyncio
from dataclasses import dataclass
from datetime import UTC, datetime

from homeassistant.config_entries import SIGNAL_CONFIG_ENTRY_CHANGED, ConfigEntryState
from homeassistant.const import EVENT_HOMEASSISTANT_STOP
from homeassistant.core import callback
from homeassistant.helpers.dispatcher import async_dispatcher_connect

from .access.admin_audit import audit_actor
from .access.enrollment import CardEnrollment
from .access.models import AccessError, text_field
from .capture_bridge_source import NativeCaptureBridgeSource, async_bind_native_capture_lease
from .const import DOMAIN
from .trusted_actions.envelope import ClockSample, thaw
from .trusted_actions.lease_experimental import (
    LeaseAuthority,
    LeaseRejected,
    current_lease_operation,
)
from .trusted_actions.source_bindings import same_ports
from .trusted_actions.source_commit_guard import source_commit
from .trusted_actions.validation import aware

KEY = "native_capture_composition"


@dataclass(repr=False)
class _Resource:
    row: object
    birth: object
    task: object
    label: str = ""


@dataclass(repr=False)
class _Grant:
    actor: str
    station: str
    lease: dict
    entry: object
    runtime: object
    client: object
    profile: object
    start_dto: object
    confirm_dto: object = None
    confirmed_revision: int | None = None


class NativeCaptureComposition:
    def __init__(self, hass, bridge_source):
        self.hass, self.namespace, self.source = hass, hass.data[DOMAIN], bridge_source
        self.manager = self.namespace["access"]
        self.repository, self.enrollment = self.manager.repository, self.manager.enrollment
        if type(self.enrollment) is not CardEnrollment or not self.source.current():
            raise LeaseRejected("state", "unverified")
        self.ports = tuple(
            getattr(self.enrollment, name)
            for name in (
                "start",
                "status",
                "confirm",
                "_retire_birth",
                "_join_birth",
                "_owned",
            )
        )
        self.grants, self.consumer, self.installation_actor = {}, None, None

    @property
    def host(self):
        if self.consumer is None:
            raise LeaseRejected("state", "unverified")
        return self.consumer._host

    def stable(self):
        if (
            self.hass.data.get(DOMAIN) is not self.namespace
            or self.namespace.get("access") is not self.manager
            or self.manager.repository is not self.repository
            or self.manager._closed
            or self.manager.enrollment is not self.enrollment
            or not self.source.current()
            or not same_ports(
                self.ports,
                tuple(
                    getattr(self.enrollment, name)
                    for name in (
                        "start",
                        "status",
                        "confirm",
                        "_retire_birth",
                        "_join_birth",
                        "_owned",
                    )
                ),
            )
        ):
            raise LeaseRejected("state", "authority_changed")

    def clock(self):
        self.stable()
        now = datetime.now(UTC)
        return ClockSample(now, now, True)

    def current(self, message):
        self.stable()
        if not self.source.owns_dto(message.dto):
            raise LeaseRejected("state", "unverified")
        body = message.body
        now = datetime.now(UTC)
        for key, old in tuple(self.grants.items()):
            if now >= aware(old.lease["lease_expires_at"]):
                self.grants.pop(key, None)
        if body["action"] == "capture_start":
            lease = thaw(body["params"]["lease"])
            reference = lease["lease_ref"]
            grant = self.grants.get(reference)
            if grant is None:
                entry = self.hass.config_entries.async_get_entry(body["station"])
                runtime = getattr(entry, "runtime_data", None)
                from .runtime import IntercomRuntime

                if (
                    entry is None
                    or entry.domain != DOMAIN
                    or entry.state is not ConfigEntryState.LOADED
                    or type(runtime) is not IntercomRuntime
                    or runtime.is_closed
                    or len(self.grants) >= 128
                ):
                    raise LeaseRejected("state", "receiver_offline")
                grant = _Grant(
                    body["actor"]["id"],
                    body["station"],
                    lease,
                    entry,
                    runtime,
                    runtime.client,
                    runtime.profile,
                    message.dto,
                )
                self.grants[reference] = grant
            elif grant.lease != lease or grant.start_dto is not message.dto:
                raise LeaseRejected("binding", "admission_mismatch")
        else:
            reference = body["params"]["lease_ref"]
            grant = self.grants.get(reference)
        if grant is None:
            raise LeaseRejected("state", "lease_gone")
        lease = grant.lease
        person = self.repository.get(lease["person_ref"])
        own_completion = grant.confirmed_revision == person.revision == lease[
            "person_revision"
        ] + 1 and (message.dto is grant.start_dto or message.dto is grant.confirm_dto)
        if (
            body["actor"]["id"] != grant.actor
            or body["station"] != grant.station
            or self.hass.config_entries.async_get_entry(grant.station) is not grant.entry
            or grant.entry.runtime_data is not grant.runtime
            or grant.runtime.is_closed
            or grant.runtime.client is not grant.client
            or grant.runtime.profile is not grant.profile
            or person.revision != lease["person_revision"]
            and not own_completion
            or now >= aware(lease["lease_expires_at"])
            or lease["binding_revision"] is not None
        ):
            raise LeaseRejected("state", "authority_changed")
        if body["action"] == "capture_confirm" and grant.confirmed_revision is None:
            grant.confirm_dto = message.dto
        self.stable()
        return LeaseAuthority(
            grant.actor,
            grant.station,
            reference,
            person.id,
            lease["person_revision"],
            lease["permission_revision"],
            None,
            lease["receiver"]["reader_id"],
            self.enrollment,
            grant.runtime,
            True,
            "arx_human",
        )

    def actor_current(self, dto, authority):
        self.stable()
        if not self.source.owns_dto(dto):
            return False
        body = self.source.project_dto(dto)
        return (
            body["actor"]["id"] == authority.actor_id
            and body["station"] == authority.station
            and authority.receiver is self.enrollment
            and authority.principal_kind == "arx_human"
        )

    def installation_actor_current(self, dto):
        self.stable()
        if not self.source.owns_dto(dto):
            return False
        body = self.source.project_dto(dto)
        if self.installation_actor is None:
            if body["action"] != "lease_stream_reset" or body["station"] != "*":
                return False
            # The original capability issued this DTO after pairing verification.
            # Pin its installation actor once for this original source lifetime;
            # never infer Arx's installation id from a WisKey station identifier.
            self.installation_actor = body["actor"]["id"]
        return body["actor"]["id"] == self.installation_actor

    async def start(self, session):
        current_lease_operation(self.host, session)
        self.stable()
        authority = session.authority

        def authorize():
            try:
                self.stable()
                self.host._check(session)
                return True
            except Exception:
                return False

        raw = self.enrollment.start(
            authority.station,
            authority.person_ref,
            authority.person_revision,
            authority.reader_id,
            authority.actor_id,
            authorize=authorize,
        )
        row = self.enrollment.sessions[raw["session_id"]]
        return _Resource(row, self.enrollment._owned(row), row.task)

    async def status(self, session):
        current_lease_operation(self.host, session)
        raw = self.enrollment.status(session.resource.row.id, session.authority.actor_id)
        return {key: raw[key] for key in ("state", "error", "card")}

    def preflight(self, session, params):
        self.host._check(session)
        row = session.resource.row
        if row.state != "captured" or row.card is None:
            raise LeaseRejected("state", "capture_not_ready")
        try:
            session.resource.label = text_field(params["label"], 64, empty=True)
        except AccessError:
            raise LeaseRejected("state", "invalid_text") from None

    async def confirm(self, session):
        operation = current_lease_operation(self.host, session)
        self.stable()
        with (
            audit_actor(session.authority.actor_id, "cards/capture_confirm", value_free=True),
            source_commit(
                self.repository,
                operation.check,
            ),
        ):
            result = await self.enrollment.confirm(
                session.resource.row.id,
                session.authority.actor_id,
                session.resource.label,
            )
        grant = self.grants[session.authority.lease_ref]
        # Only this completed original CAS can explain its own revision advance.
        # Retain the exact original DTOs, never authorize a fresh old-lease call.
        if (
            result["id"] != session.authority.person_ref
            or result["revision"] != session.authority.person_revision + 1
        ):
            raise LeaseRejected("state", "authority_changed")
        grant.confirmed_revision = result["revision"]
        return result

    def discard(self, resource):
        self.enrollment._retire_birth(resource.row)

    async def close(self, resource):
        if resource.birth is not None:
            await self.enrollment._join_birth(resource.birth)


async def async_connect_native_capture(hass):
    """Called by original config-entry state changes, independent of a panel."""
    from .capture_lease_runtime import _CONSUMERS

    namespace = hass.data[DOMAIN]
    state = namespace[KEY]
    async with state["lock"]:
        if hass.is_stopping:
            return
        previous = _CONSUMERS.get(hass)
        if previous is not None:
            try:
                previous._check()
                return
            except Exception:
                await previous.close()
                if _CONSUMERS.get(hass) is not None:
                    state["status"] = "cleanup_failed"
                    return
        bridges = [
            entry
            for entry in hass.config_entries.async_entries("smplwise_bridge")
            if entry.state is ConfigEntryState.LOADED
        ]
        stations = [
            entry
            for entry in hass.config_entries.async_entries(DOMAIN)
            if entry.state is ConfigEntryState.LOADED
            and not getattr(entry.runtime_data, "is_closed", True)
        ]
        if len(bridges) != 1 or not stations:
            state["status"] = "original_bridge_or_station_not_loaded"
            return
        source = NativeCaptureBridgeSource(hass, bridges[0])
        composition = NativeCaptureComposition(hass, source)
        consumer = await async_bind_native_capture_lease(
            hass,
            stations[0],
            bridges[0],
            installation_id=None,
            current=composition.current,
            actor_current=composition.actor_current,
            collector=composition,
            clock=composition.clock,
            bridge_source=source,
            installation_actor_current=composition.installation_actor_current,
        )
        composition.consumer = consumer
        state["composition"], state["status"] = composition, "connected"


def setup_native_capture_composition(hass):
    state = {
        "lock": asyncio.Lock(),
        "composition": None,
        "status": "original_bridge_or_station_not_loaded",
    }
    hass.data[DOMAIN][KEY] = state

    @callback
    def changed(_change, entry):
        if entry.domain not in {DOMAIN, "smplwise_bridge"} or hass.is_stopping:
            return

        async def connect():
            try:
                await async_connect_native_capture(hass)
            except Exception:
                state["status"] = "original_capture_source_unavailable"

        hass.async_create_task(connect(), "WisKey native capture composition")

    unsubscribe = async_dispatcher_connect(hass, SIGNAL_CONFIG_ENTRY_CHANGED, changed)
    listening = [True]

    @callback
    def remove():
        if listening[0]:
            listening[0] = False
            unsubscribe()

    state["remove"] = remove
    hass.bus.async_listen_once(EVENT_HOMEASSISTANT_STOP, lambda _event: state["remove"]())
