"""Optional60-second name carrier, alongside ordinary authenticated raw writes.

The name is volatile private memory until the native person commit. There is
no recover-by-hash path and no reconstruction after reload. Consumed/uncertain
carriers cannot be retried, even when saving or publication was interrupted.
"""

from __future__ import annotations

import weakref
from dataclasses import dataclass, field
from datetime import UTC, datetime, timedelta
from uuid import uuid4

import voluptuous as vol
from homeassistant.components import websocket_api
from homeassistant.const import EVENT_HOMEASSISTANT_STOP

from .access.admin_audit import audit_actor
from .access.models import AccessError, build_user, text_field, utc_now
from .access.name_reference_receipts import SCHEMA
from .bridge_command_auth import VerifiedBridgePrincipal, host_for, send_bridge_result
from .const import DOMAIN
from .trusted_actions.source_commit_guard import source_commit
from .trusted_actions.validation import Refusal

COMMANDS = ("users/name_ref_prepare_v1", "users/name_ref_apply_v1")
_HOSTS = weakref.WeakKeyDictionary()
_REGISTERED = weakref.WeakKeyDictionary()
_BASE = frozenset({"person_ref", "expected_person_revision", "request_id", "operation_id"})


def _now():
    return datetime.now(UTC)


@dataclass(repr=False)
class _Carrier:
    principal_owner: tuple
    actor: str
    bindings: dict
    value: str | None
    expires: datetime
    state: str = "prepared"
    timer: object = None


@dataclass(frozen=True, repr=False)
class _Host:
    hass: object
    namespace: dict
    bridge: object
    manager: object
    repository: object
    epoch: str = field(default_factory=lambda: uuid4().hex)
    carriers: dict = field(default_factory=dict)


class NameReferenceHost:
    def __init__(self, hass):
        namespace = hass.data[DOMAIN]
        if namespace.get("name_references") is not None:
            raise ValueError("Original name reference owner already installed")
        manager = namespace["access"]
        _HOSTS[self] = _Host(hass, namespace, host_for(hass), manager, manager.repository)
        namespace["name_references"] = self
        hass.bus.async_listen_once(EVENT_HOMEASSISTANT_STOP, lambda _event: self.close())

    def close(self):
        o = _HOSTS[self]
        for row in o.carriers.values():
            row.value = None
            if row.timer is not None:
                row.timer.cancel()
        o.carriers.clear()

    def _check(self, principal):
        o = _HOSTS[self]
        if type(principal) is not VerifiedBridgePrincipal:
            raise Refusal("Unauthorized")
        principal.check()
        if (
            o.hass.data.get(DOMAIN) is not o.namespace
            or o.namespace.get("name_references") is not self
            or host_for(o.hass) is not o.bridge
            or o.namespace.get("access") is not o.manager
            or o.manager.repository is not o.repository
            or o.manager._closed
        ):
            raise Refusal("source_changed")
        return o

    def _bindings(self, parameters):
        for name in ("person_ref", "request_id", "operation_id"):
            text_field(parameters.get(name), 128)
        revision = parameters.get("expected_person_revision")
        if type(revision) is not int or not 1 <= revision < 2**53 - 1:
            raise Refusal("invalid_fields")
        return {key: parameters[key] for key in _BASE}

    def prepare(self, principal, parameters):
        o = self._check(principal)
        if set(parameters) != _BASE | {"display_name"}:
            raise Refusal("invalid_fields")
        bindings = self._bindings(parameters)
        value = text_field(parameters["display_name"], 32)
        person = o.repository.get(bindings["person_ref"])
        if person.revision != bindings["expected_person_revision"]:
            raise AccessError("revision_conflict")
        o.manager._validate(build_user(
            {"display_name": value}, employee_no=person.employee_no, now=utc_now(), previous=person
        ))
        now = _now()
        for key, record in tuple(o.carriers.items()):
            if record.expires <= now:
                record.value = None
                if record.timer is not None:
                    record.timer.cancel()
                o.carriers.pop(key, None)
        if bindings["operation_id"] in o.repository._state["operation_receipts"]:
            raise Refusal("name_ref_consumed")
        if any(record.bindings["operation_id"] == bindings["operation_id"]
               for record in o.carriers.values()):
            raise Refusal("name_ref_conflict")
        if len(o.carriers) >= 128:
            raise Refusal("request_too_large")
        reference = uuid4().hex
        expiry = now + timedelta(seconds=60)
        self._check(principal)
        carrier = _Carrier(
            principal.owner_key, principal.actor_id, bindings, value, expiry
        )
        o.carriers[reference] = carrier

        def expire():
            carrier.value = None
            carrier.state = "expired"
            if o.carriers.get(reference) is carrier:
                o.carriers.pop(reference, None)

        carrier.timer = o.hass.loop.call_later(60, expire)
        return {"name_ref": reference, "expires_at": expiry.isoformat()}

    async def apply(self, principal, parameters):
        o = self._check(principal)
        if set(parameters) != _BASE | {"name_ref"}:
            raise Refusal("invalid_fields")
        bindings = self._bindings(parameters)
        reference = text_field(parameters["name_ref"], 128)
        row = o.carriers.get(reference)
        if row is None:
            raise Refusal("name_ref_unknown")
        if row.expires <= _now():
            row.value = None
            raise Refusal("name_ref_expired")
        actual = principal.owner_key
        expected = row.principal_owner
        if (
            actual[0] is not expected[0] or actual[1] != expected[1]
            or actual[2] is not expected[2] or actual[3] is not expected[3]
            or bindings != row.bindings or principal.actor_id != row.actor
        ):
            raise Refusal("Unauthorized")
        if row.state != "prepared":
            raise Refusal("name_ref_consumed")
        # Consume before yielding. The durable receipt is in the same native
        # commit as the CAS update. Any uncertain save leaves this carrier dead.
        row.state = "applying"
        value, row.value = row.value, None
        receipt = {
            "schema": SCHEMA, **bindings, "name_ref": reference, "actor": row.actor,
            "source_epoch": o.epoch, "saved_at": utc_now(), "action": COMMANDS[1],
        }

        def current():
            self._check(principal)
            if _now() >= row.expires or row.state != "applying":
                raise Refusal("name_ref_expired")

        try:
            with audit_actor(row.actor, COMMANDS[1], value_free=True), source_commit(
                o.repository, current
            ):
                result = await o.repository.async_apply_name_reference(
                    receipt, value, validate=o.manager._validate
                )
            current()
            row.state = "committed"
            o.manager.request_user(bindings["person_ref"])
            o.manager._changed()
            self._check(principal)
            return result
        except BaseException:
            row.state = "unknown"
            raise


def _handler(command):
    @websocket_api.websocket_command(
        vol.All(vol.Schema({"type": DOMAIN + "/" + command}, extra=vol.ALLOW_EXTRA))
    )
    @websocket_api.async_response
    async def handle(hass, connection, message):
        try:
            principal = await host_for(hass).admit(connection, message, command)
            host = hass.data[DOMAIN].get("name_references")
            if type(host) is not NameReferenceHost:
                raise Refusal("source_changed")
            result = (host.prepare(principal, principal.parameters) if command == COMMANDS[0]
                      else await host.apply(principal, principal.parameters))
            principal.check()
            send_bridge_result(connection, message["id"], result)
        except (Refusal, AccessError) as error:
            connection.send_error(message["id"], error.code, "Name reference refused")
        except Exception:
            connection.send_error(
                message["id"], "name_ref_outcome_unknown", "Name result unavailable"
            )

    return handle


def register_name_references(hass):
    NameReferenceHost(hass)
    table = []
    for command in COMMANDS:
        handler = _handler(command)
        websocket_api.async_register_command(hass, handler)
        table.append((command, hass.data[websocket_api.DOMAIN][DOMAIN + "/" + command]))
    _REGISTERED[hass] = tuple(table)


def registered_name_references(hass):
    table = hass.data.get(websocket_api.DOMAIN, {})
    return [name for name, original in _REGISTERED.get(hass, ())
            if table.get(DOMAIN + "/" + name) is original]
