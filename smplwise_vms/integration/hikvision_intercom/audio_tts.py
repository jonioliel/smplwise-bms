"""Home Assistant TTS playback through the verified ISAPI talk channel."""

from __future__ import annotations

import asyncio
import weakref
from dataclasses import dataclass, field
from datetime import UTC, datetime, timedelta
from types import MethodType
from typing import Any
from uuid import uuid4

import voluptuous as vol
from homeassistant.components import websocket_api
from homeassistant.core import HomeAssistant, callback

from .audio_api import _audio_cleanup_proven, _audio_journal, _screen_open, _security_owner
from .bridge_command_auth import host_for, retain_execution, send_bridge_result
from .client.audio import AudioError, AudioSession, native_cleanup_observation
from .client.tts_audio import TtsCodecError, wav_to_mulaw_packets
from .const import DOMAIN
from .exceptions import HikvisionError
from .media_lifetime import close_owned, is_closing_owner, join_owned
from .panel_permissions import area_allowed, station_allowed
from .trusted_actions.source_bindings import same_ports
from .trusted_actions.validation import Refusal

MAX_TEXT_LENGTH = 500
SYNTHESIS_TIMEOUT = 30
MAX_CONCURRENT_AUDIO = 3
# Original synthesis is limited to30s and its codec to60s of audio. Keep a
# separate finite native execution window, without extending commandTTL15.
BRIDGE_EXECUTION_SECONDS = 120
_BRIDGE_PLAYBACKS = weakref.WeakKeyDictionary()
_REGISTERED = weakref.WeakKeyDictionary()


def _tts_component() -> Any:
    """Load HA TTS only when used so WisKey still starts without a TTS provider."""

    from homeassistant.components import tts

    return tts


class IntercomTtsError(Exception):
    """Allowlisted TTS failure safe to expose to the panel."""

    def __init__(self, code: str) -> None:
        super().__init__("Intercom TTS could not complete")
        self.code = code


def _authorized(hass: HomeAssistant, user: Any, station_id: str | None = None) -> bool:
    permissions = hass.data[DOMAIN].get("panel_permissions")
    return (station_id is None or station_allowed(permissions, user, station_id)) and (
        area_allowed(permissions, user, "overview", "manage")
        or area_allowed(permissions, user, "stations", "manage")
    )


def normalize_message(value: object) -> str:
    """Return bounded natural-language text without retaining control whitespace."""

    if not isinstance(value, str):
        raise IntercomTtsError("tts_invalid_message")
    message = " ".join(value.split())
    if not message or len(message) > MAX_TEXT_LENGTH:
        raise IntercomTtsError("tts_invalid_message")
    return message


def available_engines(hass: HomeAssistant) -> dict[str, Any]:
    """Return configured HA TTS engines without exposing provider configuration."""

    try:
        tts_component = _tts_component()
        default = tts_component.async_default_engine(hass)
    except (ImportError, KeyError, TypeError):
        return {"default": None, "engines": []}
    engine_ids = list(hass.states.async_entity_ids("tts"))
    if default and default not in engine_ids:
        engine_ids.append(default)
    engines: list[dict[str, Any]] = []
    try:
        from homeassistant.components.tts.helper import get_engine_instance
    except ImportError:
        get_engine_instance = None
    for engine_id in engine_ids:
        instance = get_engine_instance(hass, engine_id) if get_engine_instance else None
        state = hass.states.get(engine_id)
        languages = getattr(instance, "supported_languages", None)
        default_language = getattr(instance, "default_language", None)
        engines.append(
            {
                "engine_id": engine_id,
                "name": (state.attributes.get("friendly_name") if state else None) or engine_id,
                "supported_languages": sorted(languages) if languages else [],
                "default_language": default_language if isinstance(default_language, str) else None,
            }
        )
    engines.sort(key=lambda row: (row["engine_id"] != default, row["name"].casefold()))
    return {"default": default, "engines": engines}


async def synthesize(
    hass: HomeAssistant, engine: str, language: str | None, message: str
) -> tuple[list[bytes], float]:
    """Generate a preferred HA TTS stream and transcode it to the device codec."""

    try:
        tts_component = _tts_component()
        media_source_id = tts_component.generate_media_source_id(
            hass,
            message,
            engine=engine,
            language=language,
            options={
                "preferred_format": "wav",
                "preferred_sample_rate": 8000,
                "preferred_sample_channels": 1,
                "preferred_sample_bytes": 2,
            },
            cache=False,
        )
        extension, data = await asyncio.wait_for(
            tts_component.async_get_media_source_audio(hass, media_source_id),
            SYNTHESIS_TIMEOUT,
        )
    except TimeoutError:
        raise IntercomTtsError("tts_generation_timeout") from None
    except Exception:
        # Provider text, URLs, credentials and response bodies are deliberately not logged.
        raise IntercomTtsError("tts_generation_failed") from None
    if extension.lower().lstrip(".") != "wav" or not isinstance(data, bytes):
        raise IntercomTtsError("tts_audio_format")
    return await hass.async_add_executor_job(wav_to_mulaw_packets, data)


@dataclass(frozen=True, repr=False)
class _TtsOwner:
    hass: Any
    connection: Any
    user: Any
    user_id: Any
    security: Any
    permissions: Any
    runtime: Any
    client: Any
    client_ports: tuple
    station_id: str
    subscription: int
    subscriptions: dict
    token: str
    sessions: dict
    inputs: list
    synthesis: Any
    factory: Any
    resource: list
    task: list
    life: list
    ports: tuple
    journal: Any
    observation: Any
    cleanup: list
    attempted: list


@dataclass(eq=False)
class TtsPlayback:
    """One connection-owned, cancellable announcement to one station."""

    hass: HomeAssistant
    connection: websocket_api.ActiveConnection
    runtime: Any
    subscription: int
    engine: str
    language: str | None
    message: str
    token: str = field(default_factory=lambda: uuid4().hex)
    session: AudioSession | None = None
    task: asyncio.Task[None] | None = None
    stopped: bool = False
    entered: bool = False
    _creation: _TtsOwner = field(init=False, repr=False)

    def __post_init__(self) -> None:
        client = self.runtime.client
        self._creation = _TtsOwner(
            self.hass,
            self.connection,
            self.connection.user,
            getattr(self.connection.user, "id", None),
            _security_owner(self.hass),
            self.hass.data[DOMAIN].get("panel_permissions"),
            self.runtime,
            client,
            tuple(
                getattr(client, name, None)
                for name in ("_session", "settings", "_expected_identity")
            ),
            self.runtime.station_id,
            self.subscription,
            self.connection.subscriptions,
            self.token,
            self.hass.data[DOMAIN].setdefault("tts_audio_sessions", {}),
            [self.engine, self.language, self.message],
            synthesize,
            AudioSession,
            [None, None, None, None],
            [None, None],
            [False, False],
            (
                self.hass.async_add_executor_job,
                self.hass.async_create_background_task,
                self.connection.send_event,
            ),
            _audio_journal(self.hass),
            native_cleanup_observation,
            [False],
            [False],
        )
        self.runtime._own_media(self)

    def _origin_current(self) -> bool:
        o = self._creation
        return bool(
            self.hass is o.hass
            and self.connection is o.connection
            and self.runtime is o.runtime
            and o.connection.user is o.user
            and type(o.user_id) is str
            and bool(o.user_id)
            and getattr(o.user, "id", None) == o.user_id
            and (
                self in _BRIDGE_PLAYBACKS
                or _security_owner(o.hass) is o.security
                and o.hass.data[DOMAIN].get("panel_permissions") is o.permissions
            )
            and o.runtime.client is o.client
            and o.runtime.station_id == o.station_id
            and all(
                old is new
                for old, new in zip(
                    o.client_ports,
                    (
                        getattr(o.client, name, None)
                        for name in ("_session", "settings", "_expected_identity")
                    ),
                    strict=True,
                )
            )
            and type(self.subscription) is int
            and self.subscription == o.subscription
            and type(self.token) is str
            and self.token == o.token
            and o.connection.subscriptions is o.subscriptions
            and o.hass.data[DOMAIN].get("tts_audio_sessions") is o.sessions
            and synthesize is o.synthesis
            and AudioSession is o.factory
            and self.engine is o.inputs[0]
            and self.language is o.inputs[1]
            and self.message is o.inputs[2]
            and same_ports(
                o.ports,
                (
                    o.hass.async_add_executor_job,
                    o.hass.async_create_background_task,
                    o.connection.send_event,
                ),
            )
        )

    def _control_current(self) -> bool:
        o = self._creation
        record = _BRIDGE_PLAYBACKS.get(self)
        if record is None:
            return _screen_open(o.hass, o.connection) and _authorized(o.hass, o.user, o.station_id)
        execution, original = record
        try:
            if original is not o:
                return False
            execution.check()
            _epoch, _entry_id, user, connection = execution.owner_key
            return user is o.user and connection is o.connection
        except Refusal:
            return False

    def _owns_subscription(self) -> bool:
        callback = self._creation.subscriptions.get(self._creation.subscription)
        return (
            type(callback) is MethodType
            and callback.__self__ is self
            and callback.__func__ is TtsPlayback.cancel
        )

    def _can_notify(self) -> bool:
        return bool(
            self._origin_current()
            and self._owns_subscription()
            and self._control_current()
            and self._origin_current()
            and self._owns_subscription()
        )

    def _detach(self, outcome: str, completed: bool, completion: dict | None = None) -> None:
        o = self._creation
        if o.sessions.get(o.station_id) is self and (o.cleanup[0] or not o.life[0]):
            o.sessions.pop(o.station_id, None)
        try:
            if completed and o.cleanup[0] and completion is not None and self._can_notify():
                o.ports[2](
                    o.subscription,
                    {"format": "hikvision_intercom.tts", **completion},
                )
            elif (not completed or not o.cleanup[0]) and self._can_notify():
                o.ports[2](
                    o.subscription,
                    {
                        "format": "hikvision_intercom.tts",
                        "state": "closed",
                        "reason": outcome if o.cleanup[0] else "cleanup_failed",
                        "cleanup_joined": o.cleanup[0],
                    },
                )
        except Exception:
            # Notification failure cannot retain owned subscriptions or text.
            pass
        finally:
            if self._owns_subscription():
                o.subscriptions.pop(o.subscription, None)
            # Drop this playback's private synthesis input after original cleanup.
            self.message = ""
            o.inputs[:] = [None, None, None]

    def _start_task(self) -> None:
        o = self._creation
        if o.task[0] is None and not o.life[1]:
            coroutine = TtsPlayback.run(self)
            # HA may enter this coroutine eagerly, before its factory returns.
            # The run entry must prove the actual Task/coroutine pair first.
            o.task[1] = coroutine
            try:
                task = o.ports[1](coroutine, f"{DOMAIN} tts")
                if (
                    not isinstance(task, asyncio.Task)
                    or asyncio.Task.get_loop(task) is not asyncio.get_running_loop()
                    or o.task[0] is not None
                    and o.task[0] is not task
                    or not (
                        asyncio.Task.get_coro(task) is coroutine
                        or o.task[0] is task
                        and o.life[0]
                        and asyncio.Task.done(task)
                    )
                ):
                    raise IntercomTtsError("tts_playback_failed")
            except BaseException as error:
                observed = o.task[0]
                o.task[1] = None
                o.life[1] = self.stopped = True
                if observed is None:
                    coroutine.close()
                else:
                    # Only run() can publish this original Task after checking
                    # its submitted coroutine. Never cancel the foreign return.
                    asyncio.Task.cancel(observed)
                try:
                    self._detach("tts_playback_failed", False)
                finally:
                    o.runtime._track_media_task(self)
                if not isinstance(error, Exception):
                    raise
                raise IntercomTtsError("tts_playback_failed") from None
            o.task[0] = self.task = task
            o.task[1] = None
            o.runtime._track_media_task(self)
            if o.life[1] and not asyncio.Task.done(task):
                asyncio.Task.cancel(task)

    def valid(self) -> bool:
        o = self._creation
        if not self._origin_current():
            return False
        entry = o.hass.config_entries.async_get_entry(o.station_id)
        session = o.resource[0]
        return bool(
            not o.life[1]
            and self.stopped is False
            and self.entered is o.life[0]
            and self.session is session
            and (o.task[0] is None or self.task is o.task[0])
            and (
                session is None
                or same_ports(tuple(o.resource[1:]), (session.close, session.start, session.send))
            )
            and self._control_current()
            and entry
            and getattr(entry, "runtime_data", None) is o.runtime
            and not o.runtime.is_closed
            and o.sessions.get(o.station_id) is self
            and self._owns_subscription()
            and self._origin_current()
        )

    def send_event(self, payload: dict[str, Any]) -> None:
        o = self._creation
        if self._can_notify():
            o.ports[2](
                o.subscription,
                {"format": "hikvision_intercom.tts", **payload},
            )

    @callback
    def cancel(self) -> None:
        o = self._creation
        if o.life[1]:
            return
        o.life[1] = self.stopped = True
        if not o.life[0]:
            o.runtime._track_media_task(self)
            self._detach("tts_cancelled", False)
        if o.task[0] is not None:
            o.task[0].cancel()

    async def async_close(self) -> None:
        TtsPlayback.cancel(self)
        owner = self._creation
        if is_closing_owner(owner):
            return
        task = owner.task[0]
        if task is not None and task is not asyncio.current_task():
            _result, cancelled = await join_owned(asyncio.gather(task, return_exceptions=True))
            if cancelled:
                raise asyncio.CancelledError
        if owner.life[0] and not owner.cleanup[0]:
            raise AudioError("cleanup_failed")

    def _journal_guard(self):
        if not self.valid():
            raise AudioError("audio_source_changed")

    async def run(self) -> None:
        o = self._creation
        caller = asyncio.current_task()
        if (
            o.life[0]
            or o.life[1]
            or not isinstance(caller, asyncio.Task)
            or o.task[0] is not None
            and o.task[0] is not caller
            or o.task[1] is not None
            and asyncio.Task.get_coro(caller) is not o.task[1]
        ):
            return
        o.life[0] = self.entered = True
        if o.task[0] is None:
            o.task[0] = caller
        if self.task is None:
            self.task = o.task[0]
        o.runtime._track_media_task(self)
        outcome = "tts_cancelled"
        completed = False
        completion = None
        session = None
        try:
            if not self.valid():
                return
            if o.journal is None:
                raise AudioError("audio_journal_unavailable")
            self.send_event({"state": "generating"})
            if not self.valid():
                return
            packets, duration = await o.synthesis(o.hass, *o.inputs)
            if not self.valid():
                return
            await o.journal.reserve(o.station_id, o.token, self._journal_guard)
            self._journal_guard()
            session, cancelled = await join_owned(o.ports[0](o.factory, o.client))
            o.resource[:] = [session, session.close, session.start, session.send]
            if self.session is None:
                self.session = session
            if cancelled:
                raise asyncio.CancelledError
            if not self.valid():
                return
            o.attempted[0] = True
            await o.resource[2]()
            if not self.valid():
                return
            self.send_event(
                {
                    "state": "speaking",
                    "duration_seconds": round(duration, 2),
                    "packet_count": len(packets),
                }
            )
            for packet in packets:
                if not self.valid():
                    return
                failure = session.failure
                if not self.valid():
                    return
                if failure:
                    raise AudioError(failure)
                o.resource[3](packet)
                if not self.valid():
                    return
                await asyncio.sleep(0.1)
            await asyncio.sleep(0.15)
            if not self.valid():
                return
            written = session.microphone_bytes
            if not self.valid():
                return
            completed = True
            outcome = "completed"
            completion = {
                "state": "completed",
                "duration_seconds": round(duration, 2),
                "bytes_written": written,
                "physical_result": "unverified",
            }
        except asyncio.CancelledError:
            pass
        except (IntercomTtsError, TtsCodecError) as err:
            outcome = err.code
        except AudioError as err:
            outcome = err.code
        except (HikvisionError, TimeoutError, OSError):
            outcome = "audio_connection_lost"
        except Exception:
            outcome = "tts_playback_failed"
        finally:
            o.life[1] = self.stopped = True
            cleanup = True
            try:
                if session is not None:
                    try:
                        await close_owned(o, o.resource[1]())
                    except Exception:
                        cleanup = False
                cleanup = cleanup and _audio_cleanup_proven(
                    session, o.observation, attempted=o.attempted[0]
                )
                if cleanup and o.journal is not None:
                    try:
                        pending = o.journal.pending().get(o.station_id)
                        if pending == o.token:
                            await close_owned(o, o.journal.clear_joined(o.station_id, o.token))
                        elif pending is not None:
                            cleanup = False
                    except (Exception, asyncio.CancelledError):
                        cleanup = False
                o.cleanup[0] = cleanup
            finally:
                try:
                    self._detach(outcome, completed, completion)
                finally:
                    if o.cleanup[0]:
                        self.session = None
                        o.resource[:] = [None, None, None, None]


@websocket_api.websocket_command(
    vol.All(vol.Schema({"type": f"{DOMAIN}/tts/engines"}, extra=vol.ALLOW_EXTRA))
)
@websocket_api.async_response
async def engines(
    hass: HomeAssistant, connection: websocket_api.ActiveConnection, msg: dict[str, Any]
) -> None:
    if "bridge" in msg:
        try:
            principal = await host_for(hass).admit(connection, msg, "tts/engines")
            if principal.parameters:
                raise Refusal("invalid_fields")
            result = available_engines(hass)
            principal.check()
            send_bridge_result(connection, msg["id"], result)
        except Refusal as error:
            connection.send_error(msg["id"], error.code, "Authenticated TTS request refused")
        return
    if not _screen_open(hass, connection) or not _authorized(hass, connection.user):
        connection.send_error(msg["id"], "unauthorized", "WisKey control access is not granted")
        return
    if set(msg) != {"id", "type"}:
        connection.send_error(msg["id"], "invalid_fields", "Invalid TTS request")
        return
    connection.send_result(msg["id"], available_engines(hass))


@websocket_api.websocket_command(
    vol.All(vol.Schema({"type": f"{DOMAIN}/tts/start"}, extra=vol.ALLOW_EXTRA))
)
@websocket_api.async_response
async def start(
    hass: HomeAssistant, connection: websocket_api.ActiveConnection, msg: dict[str, Any]
) -> None:
    principal = None
    try:
        if "bridge" in msg:
            principal = await host_for(hass).admit(connection, msg, "tts/start")
            parameters = principal.parameters
            if {"id", "type", "bridge"} & set(parameters):
                raise Refusal("invalid_fields")
            if "actor" in parameters:
                _ = principal.actor_id
                parameters.pop("actor")
            msg = {"id": msg["id"], "type": msg["type"], **parameters}
        _start(hass, connection, msg, principal)
    except Refusal as error:
        connection.send_error(msg["id"], error.code, "Authenticated TTS request refused")


def _start(hass, connection, msg, principal):
    if principal is not None:
        principal.check()
    elif not _screen_open(hass, connection) or not _authorized(hass, connection.user):
        connection.send_error(msg["id"], "unauthorized", "WisKey control access is not granted")
        return
    allowed = {"id", "type", "station_id", "engine_id", "language", "message"}
    station = msg.get("station_id")
    engine = msg.get("engine_id")
    language = msg.get("language")
    try:
        message = normalize_message(msg.get("message"))
    except IntercomTtsError as err:
        connection.send_error(msg["id"], err.code, "Invalid TTS message")
        return
    if (
        set(msg) != allowed
        or not isinstance(station, str)
        or not 1 <= len(station) <= 128
        or not isinstance(engine, str)
        or not 1 <= len(engine) <= 128
        or (language is not None and (not isinstance(language, str) or len(language) > 64))
    ):
        connection.send_error(msg["id"], "invalid_fields", "Invalid TTS request")
        return
    configured = available_engines(hass)
    if principal is not None:
        principal.check()
    elif not _screen_open(hass, connection) or not _authorized(hass, connection.user, station):
        connection.send_error(msg["id"], "unauthorized", "WisKey control access is not granted")
        return
    if engine not in {row["engine_id"] for row in configured["engines"]}:
        connection.send_error(msg["id"], "tts_engine_unavailable", "TTS engine unavailable")
        return
    entry = hass.config_entries.async_get_entry(station)
    runtime = getattr(entry, "runtime_data", None) if entry and entry.domain == DOMAIN else None
    if runtime is None or runtime.is_closed:
        connection.send_error(msg["id"], "station_unloaded", "Station unavailable")
        return
    audio_sessions = hass.data[DOMAIN].setdefault("audio_sessions", {})
    tts_sessions = hass.data[DOMAIN].setdefault("tts_audio_sessions", {})
    all_sessions = [*audio_sessions.values(), *tts_sessions.values()]
    if (
        station in audio_sessions
        or station in tts_sessions
        or len(all_sessions) >= MAX_CONCURRENT_AUDIO
        or any(item.connection is connection for item in all_sessions)
    ):
        connection.send_error(msg["id"], "audio_busy", "Audio is already in use")
        return
    playback = TtsPlayback(
        hass,
        connection,
        runtime,
        msg["id"],
        engine,
        language or None,
        message,
    )
    if principal is not None:
        execution = retain_execution(
            principal, datetime.now(UTC) + timedelta(seconds=BRIDGE_EXECUTION_SECONDS)
        )
        _BRIDGE_PLAYBACKS[playback] = (execution, playback._creation)
        principal.check()
    tts_sessions[station] = playback
    connection.subscriptions[msg["id"]] = playback.cancel
    if principal is None:
        connection.send_result(msg["id"])
    else:
        send_bridge_result(connection, msg["id"], None)
    playback._start_task()


@callback
def register_tts_audio(hass: HomeAssistant) -> None:
    websocket_api.async_register_command(hass, engines)
    websocket_api.async_register_command(hass, start)
    table = hass.data[websocket_api.DOMAIN]
    _REGISTERED[hass] = tuple(
        (name, table[DOMAIN + "/" + name]) for name in ("tts/engines", "tts/start")
    )


def registered_tts_commands(hass):
    table = hass.data.get(websocket_api.DOMAIN, {})
    return [
        name
        for name, original in _REGISTERED.get(hass, ())
        if table.get(DOMAIN + "/" + name) is original
    ]
