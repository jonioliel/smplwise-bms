"""Closed server-filled template v2 using the existing bound native send host.

No provider, queue, template registry or account is created by this route. A
missing original composition remains explicitly not installed. Errors do not
prove not_sent or permit retry of a possibly older dispatched operation.
"""

from __future__ import annotations

import weakref

import voluptuous as vol
from homeassistant.components import websocket_api

from .access.models import AccessError
from .bridge_command_auth import host_for, send_bridge_result
from .const import DOMAIN
from .trusted_actions.validation import Refusal, reference
from .whatsapp_template_api_v1 import _host
from .whatsapp_template_runtime_v1 import (
    NativeTemplateSendHostV1,
    _encoded,
    _person_snapshot,
    descriptor,
)

COMMAND = "whatsapp/template_send_v2"
FIELDS = frozenset(
    {
        "schema_version",
        "request_id",
        "operation_id",
        "recipient_ref",
        "expected_person_revision",
        "account",
        "template_name",
        "language",
        "template_ref",
        "expected_template_revision",
    }
)
_REGISTERED = weakref.WeakKeyDictionary()


def descriptor_v2(value):
    if (
        type(value) is not dict
        or set(value) != FIELDS
        or type(value["schema_version"]) is not int
        or value["schema_version"] != 2
    ):
        raise Refusal("invalid_fields")
    for name in ("expected_person_revision", "expected_template_revision"):
        if type(value[name]) is not int or not 1 <= value[name] <= 2**53 - 1:
            raise Refusal("invalid_fields")
    for name in ("template_ref", "request_id", "operation_id", "recipient_ref", "account"):
        reference(value[name])
        if len(value[name].encode("utf-8")) > 128:
            raise Refusal("invalid_fields")
    original = {
        key: value[key]
        for key in (
            "request_id",
            "operation_id",
            "recipient_ref",
            "account",
            "template_name",
            "language",
        )
    }
    descriptor({"schema_version": 1, **original, "parameters": []})
    if len(_encoded(value)) > 32768:
        raise Refusal("request_too_large")
    return dict(value)


async def send_v2(hass, connection, principal, value):
    request = descriptor_v2(value)
    host = _host(hass)
    NativeTemplateSendHostV1.stable(host)
    if principal.repository is not host.manager.repository:
        raise Refusal("Unauthorized")
    template = next(
        (
            t
            for t in host.templates
            if (
                t.reference == request["template_ref"]
                and t.revision == request["expected_template_revision"]
                and (t.account, t.name, t.language)
                == (request["account"], request["template_name"], request["language"])
            )
        ),
        None,
    )
    if template is None:
        raise Refusal("template_revision_conflict")
    person = host.manager.repository.get(request["recipient_ref"])
    if person.revision != request["expected_person_revision"]:
        raise Refusal("revision_conflict")
    snapshot = _person_snapshot(person, template)
    values = dict(
        zip(
            ("display_name", "employee_no", "pin", "valid_from", "valid_until"),
            snapshot[3:],
            strict=True,
        )
    )
    native = descriptor(
        {
            "schema_version": 1,
            **{
                key: request[key]
                for key in (
                    "request_id",
                    "operation_id",
                    "recipient_ref",
                    "account",
                    "template_name",
                    "language",
                )
            },
            "parameters": [values[field] for field in template.parameter_fields],
        }
    )

    def current():
        principal.check()
        if _host(hass) is not host:
            raise Refusal("template_source_not_installed")
        NativeTemplateSendHostV1.stable(host)
        if (
            not any(original is template for original in host.templates)
            or _person_snapshot(host.manager.repository.get(person.id), template) != snapshot
        ):
            raise Refusal("template_source_unavailable")

    current()
    result = await NativeTemplateSendHostV1.send_bridge(
        host, connection, native, principal, current, request_identity=_encoded(request)
    )
    current()
    return {**result, "schema_version": 2}


@websocket_api.websocket_command(
    vol.All(vol.Schema({"type": DOMAIN + "/" + COMMAND}, extra=vol.ALLOW_EXTRA))
)
@websocket_api.async_response
async def _handle(hass, connection, message):
    try:
        principal = await host_for(hass).admit(connection, message, COMMAND)
        result = await send_v2(hass, connection, principal, principal.parameters)
        principal.check()
        send_bridge_result(connection, message["id"], result)
    except (Refusal, AccessError) as error:
        connection.send_error(message["id"], error.code, "Template v2 request refused")
    except Exception:
        connection.send_error(
            message["id"], "template_outcome_unknown", "Template result unavailable"
        )


def register_template_api_v2(hass):
    websocket_api.async_register_command(hass, _handle)
    _REGISTERED[hass] = hass.data[websocket_api.DOMAIN][DOMAIN + "/" + COMMAND]


def registered_template_commands_v2(hass):
    original = _REGISTERED.get(hass)
    if (
        original is not None
        and hass.data.get(websocket_api.DOMAIN, {}).get(DOMAIN + "/" + COMMAND) is original
    ):
        return (COMMAND,)
    return ()


async def send_v3(hass, connection, principal, value):
    """Companion wire version; unchanged strict v2 response remains available."""
    if (
        type(value) is not dict
        or set(value) != {"schema_version", "template"}
        or type(value["schema_version"]) is not int
        or value["schema_version"] != 3
    ):
        raise Refusal("invalid_fields")
    request = descriptor_v2(value["template"])
    result = await send_v2(hass, connection, principal, request)
    host = _host(hass)
    owner = NativeTemplateSendHostV1.stable(host)
    pacing = owner.pacing_results.get(request["request_id"])
    return {
        "contract": "wiskey-template-outcome.v3",
        "schema_version": 3,
        "template_result": result,
        "pacing_outcome": dict(pacing) if pacing else None,
        "replay_available": False,
    }
