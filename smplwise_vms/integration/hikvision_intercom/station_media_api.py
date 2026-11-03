"""Six closed W10 commands on the original authenticated bridge transport."""

from __future__ import annotations

import weakref

import voluptuous as vol
from homeassistant.components import websocket_api

from .bridge_command_auth import host_for, send_bridge_result
from .client.audio import AudioError
from .const import DOMAIN
from .station_audio_journal import NativeAudioAttemptJournal
from .station_media_frames import MediaFrameError
from .station_media_runtime import StationMediaHost
from .storage import AccessStore
from .trusted_actions.validation import Refusal

COMMANDS = tuple("media/" + item for item in (
    "station_descriptor", "stream_lease", "talk_open", "talk_frame", "talk_floor", "talk_close"
))
_REGISTERED = weakref.WeakKeyDictionary()


def _handler(command):
    @websocket_api.websocket_command(
        vol.All(vol.Schema({"type": DOMAIN + "/" + command}, extra=vol.ALLOW_EXTRA))
    )
    @websocket_api.async_response
    async def handle(hass, connection, message):
        try:
            principal = await host_for(hass).admit(connection, message, command)
            parameters = principal.parameters
            host = hass.data[DOMAIN].get("station_media")
            if type(host) is not StationMediaHost:
                raise Refusal("source_changed")
            opened = None
            if command == "media/station_descriptor":
                result = host.descriptor(principal, parameters)
            elif command == "media/stream_lease":
                result = host.stream(principal, parameters)
            elif command == "media/talk_open":
                opened, result = await host.open(
                    principal, parameters, connection, message["id"]
                )
            else:
                fields = {
                    "media/talk_frame": {"talk_ref", "frames"},
                    "media/talk_floor": {"talk_ref", "held"},
                    "media/talk_close": {"talk_ref", "reason"},
                }[command]
                if set(parameters) != fields:
                    raise Refusal("invalid_fields")
                talk = host.talk(principal, parameters["talk_ref"])
                if command == "media/talk_frame":
                    result = talk.frames(parameters["frames"])
                elif command == "media/talk_floor":
                    result = talk.floor(parameters["held"])
                else:
                    result = await talk.close(parameters["reason"])
            principal.check()
            send_bridge_result(connection, message["id"], result)
            if opened is not None:
                opened.admitted()
        except (Refusal, MediaFrameError) as error:
            connection.send_error(message["id"], error.code, "Station media request refused")
        except AudioError as error:
            code = (
                "source_changed"
                if error.code == "audio_source_changed"
                else "media_outcome_unknown"
            )
            connection.send_error(message["id"], code, "Station media source unavailable")
        except Exception:
            connection.send_error(
                message["id"], "media_outcome_unknown", "Station media unavailable"
            )

    return handle


async def async_setup_station_media(hass):
    store = AccessStore(hass, key=DOMAIN + ".station_audio_attempts")
    journal = NativeAudioAttemptJournal(store, await store.async_load())
    StationMediaHost(hass, journal)
    table = []
    for command in COMMANDS:
        handler = _handler(command)
        websocket_api.async_register_command(hass, handler)
        table.append((command, hass.data[websocket_api.DOMAIN][DOMAIN + "/" + command]))
    _REGISTERED[hass] = tuple(table)


def registered_station_media(hass):
    table = hass.data.get(websocket_api.DOMAIN, {})
    return [name for name, original in _REGISTERED.get(hass, ())
            if table.get(DOMAIN + "/" + name) is original]
