"""Original HA-owned request/socket identities for the installed pairing.

Supervisor's existing Unix transport has no refresh token. Only a real HA HTTP
request on that original socket, carrying the existing Supervisor system user,
may use that identity. No user or ActiveConnection is constructed here.
"""

from __future__ import annotations

import re
import weakref

from homeassistant.auth import AuthManager
from homeassistant.auth.auth_store import AuthStore
from homeassistant.auth.models import User
from homeassistant.components.http import HomeAssistantRequest
from homeassistant.components.http.const import KEY_HASS, KEY_HASS_REFRESH_TOKEN_ID, KEY_HASS_USER
from homeassistant.components.websocket_api.connection import ActiveConnection

try:
    from homeassistant.components.http.const import DATA_SUPERVISOR_USER as SUPERVISOR_USER_KEY
except ImportError:  # HA 2026.9; the owner moved to http.const in 2026.10.
    from homeassistant.components.hassio.const import (
        DATA_HASSIO_SUPERVISOR_USER as SUPERVISOR_USER_KEY,
    )

from .source_bindings import same_ports
from .validation import Refusal

_ORIGINS = weakref.WeakKeyDictionary()
HTTP_QUERY_PATH = "/api/hikvision_intercom/peer_query"


class BridgeTransportOrigin:
    __slots__ = ("__weakref__",)


def bind_origin(hass, connection):
    if type(connection) is ActiveConnection:
        if connection.hass is not hass:
            raise Refusal("Unauthorized")
        user, refresh = connection.user, connection.refresh_token_id
        detail = (
            "ha_websocket",
            (
                connection.send_message,
                connection.send_result,
                connection.send_event,
                connection.send_error,
            ),
            connection.handlers,
        )
    elif type(connection) is HomeAssistantRequest:
        if (
            connection.app.get(KEY_HASS) is not hass
            or connection.method != "POST"
            or connection.path != HTTP_QUERY_PATH
            or connection.query_string
        ):
            raise Refusal("Unauthorized")
        user = connection.get(KEY_HASS_USER)
        refresh = connection.get(KEY_HASS_REFRESH_TOKEN_ID)
        transport = connection.transport
        if transport is None or transport.is_closing():
            raise Refusal("Unauthorized")
        if refresh is not None:
            detail = ("ha_http", transport, hass.http, None)
        else:
            http = hass.http
            path = getattr(http, "supervisor_unix_socket_path", None)
            if (
                path is None
                or type(user) is not User
                or user.system_generated is not True
                or hass.data.get(SUPERVISOR_USER_KEY) is not user
                or transport.get_extra_info("sockname") != str(path)
            ):
                raise Refusal("Unauthorized")
            detail = ("supervisor_http", transport, http, path)
    else:
        raise Refusal("Unauthorized")
    if (
        type(user) is not User
        or user.is_active is not True
        or type(user.id) is not str
        or re.fullmatch("[0-9a-f]{32}", user.id) is None
        or detail[0] != "supervisor_http"
        and (type(refresh) is not str or refresh not in user.refresh_tokens)
    ):
        raise Refusal("Unauthorized")
    # Supervisor has no refresh token to invalidate when its user is removed.
    # Pin the already loaded native membership table as well. This is a read
    # fence, never an auth dispatch or an account provisioning path. An unknown
    # HA auth layout refuses rather than accepting a stale authenticated alias.
    auth = hass.auth
    store = getattr(auth, "_store", None)
    users = getattr(store, "_users", None)
    if (
        type(auth) is not AuthManager
        or type(store) is not AuthStore
        or type(users) is not dict
        or users.get(user.id) is not user
    ):
        raise Refusal("Unauthorized")
    origin = BridgeTransportOrigin()
    _ORIGINS[origin] = (hass, connection, user, user.id, refresh, detail, auth, store, users)
    check_origin(origin)
    return origin


def check_origin(origin):
    from .direct_bridge_origin import DirectBridgeOrigin, check_direct_origin

    if type(origin) is DirectBridgeOrigin:
        return check_direct_origin(origin)
    record = _ORIGINS.get(origin) if type(origin) is BridgeTransportOrigin else None
    if record is None:
        raise Refusal("Unauthorized")
    hass, connection, user, identity, refresh, detail, auth, store, users = record
    if (
        type(user) is not User
        or user.id != identity
        or user.is_active is not True
        or hass.auth is not auth
        or getattr(auth, "_store", None) is not store
        or getattr(store, "_users", None) is not users
        or users.get(identity) is not user
    ):
        raise Refusal("Unauthorized")
    kind = detail[0]
    if kind == "ha_websocket":
        if (
            type(connection) is not ActiveConnection
            or connection.hass is not hass
            or connection.user is not user
            or connection.refresh_token_id != refresh
            or refresh not in user.refresh_tokens
            or not same_ports(
                detail[1],
                (
                    connection.send_message,
                    connection.send_result,
                    connection.send_event,
                    connection.send_error,
                ),
            )
            or connection.handlers is not detail[2]
        ):
            raise Refusal("Unauthorized")
    elif kind in {"ha_http", "supervisor_http"}:
        if (
            type(connection) is not HomeAssistantRequest
            or connection.app.get(KEY_HASS) is not hass
            or connection.get(KEY_HASS_USER) is not user
            or connection.get(KEY_HASS_REFRESH_TOKEN_ID) != refresh
            or connection.method != "POST"
            or connection.path != HTTP_QUERY_PATH
            or connection.query_string
            or connection.transport is not detail[1]
            or detail[1].is_closing()
            or hass.http is not detail[2]
        ):
            raise Refusal("Unauthorized")
        if kind == "ha_http":
            if type(refresh) is not str or refresh not in user.refresh_tokens:
                raise Refusal("Unauthorized")
        elif (
            user.system_generated is not True
            or hass.data.get(SUPERVISOR_USER_KEY) is not user
            or getattr(hass.http, "supervisor_unix_socket_path", None) is not detail[3]
            or detail[1].get_extra_info("sockname") != str(detail[3])
        ):
            raise Refusal("Unauthorized")
    else:
        raise Refusal("Unauthorized")
    return user, identity, refresh, kind
