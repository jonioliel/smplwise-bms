"""Additive authenticated history/unsupported secure contracts; never native I/O."""

from .access.arx_emergency_event_ledger import EmergencyEventLedger
from .access.arx_feature_host import NativeFeatureHost
from .bridge_command_auth import VerifiedBridgePrincipal
from .trusted_actions.validation import Refusal, reference

READ = "features/emergency_event_status_v1"
SECURE = "features/emergency_secure_v1"
COMMANDS = (READ, SECURE)


def project(hass, principal, command):
    from .arx_feature_api import _host
    from .const import DOMAIN

    if type(principal) is not VerifiedBridgePrincipal or principal.command != command:
        raise Refusal("Unauthorized")
    principal.check()
    params = principal.parameters
    expected = {"event_ref", "station_id", "door", "mapping_revision"}
    if command == SECURE:
        expected |= {"command"}
    if set(params) != expected:
        raise Refusal("invalid_fields")
    reference(params["event_ref"])
    reference(params["station_id"])
    if (
        type(params["door"]) is not int
        or params["door"] not in {1, 2}
        or type(params["mapping_revision"]) is not int
        or not 1 <= params["mapping_revision"] < 2**53
    ):
        raise Refusal("invalid_fields")
    if command == SECURE:
        if params["command"] != "lock_secure":
            raise Refusal("invalid_fields")
        # No command alias, fallback PUT or fabricated capability. The existing
        # v2 event contract stays closed and still rejects lock_secure.
        return {
            "contract": "wiskey-emergency-secure.v1",
            "schema_version": 1,
            "state": "not_implemented",
            "code": "secure_capability_not_proven",
            "capability_version": 1,
            "supported": False,
            "physical_result": "unproven",
            "replay_available": False,
        }
    host = _host(hass)
    NativeFeatureHost._stable(host)
    if principal.repository is not host.manager.repository:
        raise Refusal("Unauthorized")
    entry = hass.config_entries.async_get_entry(params["station_id"])
    runtime = getattr(entry, "runtime_data", None) if entry and entry.domain == DOMAIN else None
    if runtime is None or runtime.is_closed:
        raise Refusal("station_unloaded")
    lock = next((lock for lock in runtime.locks if lock.physical_index == params["door"]), None)
    if lock is None:
        raise Refusal("emergency_event_target_changed")
    # Read canonical current mapping from the existing native owner. Do not
    # provision a registry/lease merely to read historical records.
    from .native_emergency_recovery_host import read_emergency_mapping

    mapping = read_emergency_mapping(hass, host.journal)
    matches = [
        row for row in mapping if row[0] == entry.entry_id
        and row[2] == params["door"] and row[3] == params["mapping_revision"]
    ]
    if len(matches) != 1:
        raise Refusal("emergency_event_target_changed")
    selected = matches[0]
    _epoch, entry_id, user, _connection = principal.owner_key
    target = {
        "station_id": entry.entry_id,
        "api_relay": selected[1],
        "physical_relay": selected[2],
        "mapping_revision": selected[3],
        "identity": runtime.client._expected_identity,
    }
    result = EmergencyEventLedger(host.journal).project(
        repository_id=host.journal.repository_id,
        verified_peer_ref="arx-bridge:" + entry_id,
        query_owner_id=user.id,
        event_ref=params["event_ref"],
        targets=[target],
    )
    from . import LOADED_BOOT_ID, LOADED_PROCESS_ID

    result["reader_boot_id"] = LOADED_BOOT_ID
    result["reader_process_id"] = LOADED_PROCESS_ID
    principal.check()
    NativeFeatureHost._stable(host)
    return result


def handler(command):
    import voluptuous as vol
    from homeassistant.components import websocket_api

    from .arx_feature_api import _user
    from .bridge_command_auth import host_for, send_bridge_result
    from .const import DOMAIN

    @websocket_api.websocket_command(
        vol.All(vol.Schema({"type": DOMAIN + "/" + command}, extra=vol.ALLOW_EXTRA))
    )
    @websocket_api.async_response
    async def handle(hass, connection, msg):
        try:
            if "bridge" not in msg:
                raise Refusal("Unauthorized")
            principal = await host_for(hass).admit(connection, msg, command)
            user = await _user(hass, connection)
            result = project(hass, principal, command)
            if await _user(hass, connection) is not user:
                raise Refusal("Unauthorized")
            # Synchronous current-source/mapping/auth checks after final await.
            result = project(hass, principal, command)
        except Refusal as error:
            connection.send_error(msg["id"], error.code, "Emergency read unavailable")
        else:
            send_bridge_result(connection, msg["id"], result)

    return handle
