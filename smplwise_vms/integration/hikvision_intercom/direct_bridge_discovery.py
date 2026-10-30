"""Read-only discovery of actual direct routes, native resources and limits."""

import re

from homeassistant.config_entries import ConfigEntryState

from .api_contract import API_VERSION
from .bridge_command_auth import BridgeCommandHost, host_for
from .const import DOMAIN, MAX_AUDIO_SESSIONS
from .station_media_frames import FRAME_BYTES, FRAMES_PER_PACKET, MAX_BATCH_FRAMES
from .station_media_runtime import IDLE_SECONDS, LISTEN_SCHEMA, LISTEN_TRANSPORT, SCHEMA
from .station_media_settings import DEFAULT_SECONDS, SETTING, talk_seconds
from .trusted_actions.direct_bridge_origin import PROTOCOL, command_names
from .trusted_actions.existing_bridge_auth import (
    MAX_NONCES,
    MAX_TS_SKEW_SECONDS,
    NONCE_WINDOW_SECONDS,
)


def server_time(hass):
    """Observation only; this never changes the verifier's clock or deadlines."""
    owner = BridgeCommandHost._owner(host_for(hass))
    return {
        "schema_version": 1,
        "server_utc": owner.auth.clock().now.isoformat(),
        "max_ts_skew_seconds": MAX_TS_SKEW_SECONDS,
        "max_issued_future_seconds": 2,
        "max_command_ttl_seconds": 15,
    }


def capabilities(hass, connection, *, version=1):
    from .access.arx_emergency_event_contract import KIND_V2 as EMERGENCY_CONTRACT
    from .access.arx_feature_execution_contract import CONTRACT as FEATURE_CONTRACT
    from .access.arx_feature_host import feature_host_status
    from .direct_bridge_api import MAX_CONNECTIONS, MAX_FRAME_BYTES
    from .runtime import IntercomRuntime
    from .websocket import COMMANDS

    names = command_names(connection.user)
    commands = []
    for name in names:
        parameter_version = re.search(r"_v([1-9][0-9]*)$", name)
        commands.append(
            {
                "name": name,
                "envelope": PROTOCOL,
                "api_contract": API_VERSION if name in COMMANDS else None,
                "explicit_parameter_version": int(parameter_version[1])
                if parameter_version
                else None,
            }
        )
    stations = []
    for entry in hass.config_entries.async_entries(DOMAIN):
        runtime = getattr(entry, "runtime_data", None)
        if (
            entry.state is not ConfigEntryState.LOADED
            or type(runtime) is not IntercomRuntime
            or runtime.is_closed
        ):
            continue
        try:
            duration = talk_seconds(entry.options.get(SETTING, DEFAULT_SECONDS))
        except ValueError:
            duration = None
        stations.append(
            {
                "station_id": entry.entry_id,
                "max_talk_seconds": duration,
                "video_main_available": runtime.profile.stream is True,
                "setting_valid": duration is not None,
            }
        )
    namespace = hass.data[DOMAIN]
    from .native_service_write_api import ACTIONS, CONTRACT
    from .native_template_installation import KEY as INSTALLATION_KEY
    from .native_template_installation import NativeTemplateInstallation

    installation = namespace.get(INSTALLATION_KEY)
    result = {
        "schema_version": version,
        "protocol": PROTOCOL,
        "families": sorted({name.split("/")[0] for name in names}),
        "commands": commands,
        "limits": {
            "max_frame_bytes": MAX_FRAME_BYTES,
            "max_connect_bytes": 65536,
            "max_connections_including_preparing": MAX_CONNECTIONS,
            "max_audio_sessions_including_legacy_and_TTS": MAX_AUDIO_SESSIONS,
            "nonce_capacity": MAX_NONCES,
            "nonce_window_seconds": NONCE_WINDOW_SECONDS,
            "nonce_scope": "authenticator_shared_HA_and_direct_all_connections",
            "nonce_expiry": "age_strictly_greater_than_window",
            "talk_batch_sizes": [FRAMES_PER_PACKET, MAX_BATCH_FRAMES],
            "audio_frame_bytes": FRAME_BYTES,
            "talk_idle_seconds": IDLE_SECONDS,
            "max_command_ttl_seconds": 15,
            "hello_timeout_seconds": 10,
        },
        "station_media_contract": SCHEMA,
        "business_contracts": {
            "features/start": {
                "contract": FEATURE_CONTRACT,
                "emergency_private_input_contract": EMERGENCY_CONTRACT,
            },
            "stations/technical_program_*": {"api_contract": API_VERSION},
            "peer_query": {"contract": "wiskey-peer-query.v1"},
            "whatsapp/template_send_v2": {"schema_version": 2, "contract_revision": 2},
            "whatsapp/template_send_v3": {"contract": "wiskey-template-outcome.v3"},
            "whatsapp/template_enqueue_v1": {"contract": "wiskey-template-jobs.v1"},
            "events/resume_v1": {"contract": "wiskey-event-cursor.v1"},
        },
        "native_service_write": {
            "contract": CONTRACT,
            "schema_version": 1,
            "commands": sorted(ACTIONS),
            "metadata_parameter": "service_write",
            "grant_source": "owner pairing options.native_service_grants_v1",
            "installation_contract": "wiskey-native-service-write.v2",
            "default_authority": "denied_without_current_native_owner_grant",
        },
        "station_talk_audio": {
            "schema": LISTEN_SCHEMA,
            "transport": LISTEN_TRANSPORT,
            "opt_in": "media/talk_open.parameters.listen",
            "default": False,
        },
        "stations": stations,
        "resources": {
            "template_installation": installation.status()
            if type(installation) is NativeTemplateInstallation
            else None,
            "features": feature_host_status(hass),
            "template_host_bound": namespace.get("arx_template_send_v1") is not None,
            "template_cleanup_blocker": namespace.get("arx_template_send_v1_blocker"),
            "native_peer_registry_present": namespace.get("native_peer_registry") is not None,
        },
        "lifecycle": {
            "pairing_rotation": "old_connection_invalidated_reconnect_required",
            "kid_in_v1": False,
            "event_cursor_resume": version == 2,
            "reconnect_adopts_old_resources": False,
        },
        "physical_result": "unproven",
    }

    if version == 2:
        from .native_auto_installation import KEY as AUTO_KEY
        from .native_auto_installation import SERVICE_CONTRACT
        from .trusted_actions.direct_bridge_origin import check_connection

        row = check_connection(connection)
        installer = namespace.get(AUTO_KEY)
        result["native_installation"] = {
            "schema_version": 1,
            "contract": SERVICE_CONTRACT,
            "authority_mode": "permanent_full_installation",
            "grant_ref": installer.grant(row.entry) if installer is not None else None,
            "source": "WisKey original automatic installation",
            "expires_at": None,
        }
    return result
