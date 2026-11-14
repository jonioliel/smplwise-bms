"""Connection-owned administrator audio bridge; no recording or device secrets."""

from __future__ import annotations

import asyncio
import base64
import binascii
import weakref
from dataclasses import dataclass, field
from functools import partial
from types import MethodType
from typing import Any
from uuid import uuid4

import voluptuous as vol
from homeassistant.components import websocket_api
from homeassistant.core import HomeAssistant, callback

from .client.audio import PACKET_BYTES, AudioError, AudioSession, native_cleanup_observation
from .const import DOMAIN, MAX_AUDIO_SESSIONS
from .exceptions import HikvisionError
from .media_lifetime import close_owned, is_closing_owner
from .media_lifetime import join_owned as _join_owned
from .panel_permissions import area_allowed, station_allowed
from .trusted_actions.source_bindings import same_ports

MAX_SECONDS = 180
IDLE_SECONDS = 12


def _audio_journal(hass):
    from .station_media_runtime import StationMediaHost

    host = hass.data.get(DOMAIN, {}).get("station_media")
    return StationMediaHost._owner(host).journal if type(host) is StationMediaHost else None


def _audio_cleanup_proven(session, observation, *, attempted):
    if session is None or not attempted:
        return True
    original = observation(session)
    if original is not None:
        return original["open_attempted"] is False or original["close_confirmed"] is True
    # Explicit trusted factory substitutions remain local fixture mechanics.
    # Native sessions always take the module-owned observation above; a public
    # close_confirmed label cannot replace their original effect evidence.
    return getattr(session, "close_confirmed", None) is True


def _security_owner(hass: HomeAssistant) -> Any:
    from .panel_security import get_security

    return get_security(hass)


def _screen_open(hass: HomeAssistant, connection: Any) -> bool:
    from .panel_security import get_security

    security = get_security(hass)
    return not security or not security.public(connection)["locked"]


def _authorized(hass: HomeAssistant, user: Any, station_id: str | None = None) -> bool:
    permissions = hass.data[DOMAIN].get("panel_permissions")
    return (station_id is None or station_allowed(permissions, user, station_id)) and (
        area_allowed(permissions, user, "overview", "manage")
        or area_allowed(permissions, user, "stations", "manage")
    )


def _feature_bridge_authorized(owner):
    from .access.arx_media_execution import NativeMediaPermit

    if type(owner.feature_permit) is not NativeMediaPermit:
        return False
    try:
        return NativeMediaPermit.bridge_authorized(
            owner.feature_permit,
            user=owner.user,
            station_id=owner.station_id,
        )
    except Exception:
        return False


@dataclass(frozen=True, repr=False)
class _AudioOwner:
    hass: Any
    connection: Any
    user: Any
    user_id: Any
    security: Any
    runtime: Any
    client: Any
    client_ports: tuple
    station_id: str
    subscription: int
    subscriptions: dict
    token: str
    factory: Any
    resource: list
    task: list
    sessions: list
    results: dict
    life: list
    joining: list
    feature_permit: Any
    journal: Any
    observation: Any
    cleanup: list
    attempted: list
    data_ports: list


_FEATURE_BRIDGES = weakref.WeakKeyDictionary()


def _audio_owner(bridge):
    if bridge in _FEATURE_BRIDGES:
        original = _FEATURE_BRIDGES[bridge]()
        if original is None:
            raise AudioError("audio_source_changed")
        return original
    return bridge._creation


@dataclass(eq=False)
class AudioBridge:
    hass: HomeAssistant
    connection: websocket_api.ActiveConnection
    runtime: Any
    subscription: int
    token: str = field(default_factory=lambda: uuid4().hex)
    session: AudioSession | None = None
    task: asyncio.Task[None] | None = None
    touched: float = 0
    receiving: bool = False
    sequence: int = 0
    stopped: bool = False
    entered: bool = False
    _creation: _AudioOwner = field(init=False, repr=False)
    feature_permit: Any = field(default=None, repr=False)

    def __post_init__(self) -> None:
        client = self.runtime.client
        self._creation = _AudioOwner(
            self.hass,
            self.connection,
            self.connection.user,
            getattr(self.connection.user, "id", None),
            _security_owner(self.hass),
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
            AudioSession,
            [None, None],
            [None],
            [None],
            self.hass.data[DOMAIN].setdefault("audio_results", {}),
            [False, False],
            [None],
            self.feature_permit,
            _audio_journal(self.hass),
            native_cleanup_observation,
            [False],
            [False],
            [None],
        )
        if self.feature_permit is not None:
            from .access.arx_media_execution import NativeMediaPermit

            if type(self.feature_permit) is not NativeMediaPermit:
                raise AudioError("unauthorized")
            self.feature_permit.check()
            _FEATURE_BRIDGES[self] = weakref.ref(self._creation)
        self.runtime._own_media(self)

    def _bind_sessions(self, sessions: dict) -> None:
        owner = _audio_owner(self)
        if (
            owner.sessions[0] is None
            and type(sessions) is dict
            and sessions.get(owner.station_id) is self
        ):
            owner.sessions[0] = sessions

    def _origin_current(self) -> bool:
        o = _audio_owner(self)
        return bool(
            self._creation is o
            and self.hass is o.hass
            and self.connection is o.connection
            and self.runtime is o.runtime
            and o.connection.user is o.user
            and getattr(o.user, "id", None) == o.user_id
            and _security_owner(o.hass) is o.security
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
        )

    def _owns_subscription(self) -> bool:
        o = _audio_owner(self)
        callback = o.subscriptions.get(o.subscription)
        return (
            type(callback) is MethodType
            and callback.__self__ is self
            and callback.__func__ is AudioBridge.cancel
        )

    def _detach(self, reason: str, session: Any) -> None:
        o = _audio_owner(self)
        sessions = o.sessions[0]
        if (
            sessions is not None
            and sessions.get(o.station_id) is self
            and (o.cleanup[0] or not o.life[0])
        ):
            sessions.pop(o.station_id, None)
        if self._owns_subscription():
            o.subscriptions.pop(o.subscription, None)
            if (
                self._origin_current()
                and (_feature_bridge_authorized(o) or _authorized(o.hass, o.user))
                and self._origin_current()
            ):
                o.connection.send_event(
                    o.subscription,
                    {
                        "format": "hikvision_intercom.audio",
                        "state": "closed",
                        "reason": reason,
                        "close_confirmed": session.close_confirmed if session else None,
                        "cleanup_joined": o.cleanup[0],
                    },
                )

    def valid(self) -> bool:
        o = _audio_owner(self)
        feature_bridge = False
        if self.feature_permit is not o.feature_permit:
            return False
        if o.feature_permit is not None:
            try:
                o.feature_permit.check_bridge(self)
                from .access.arx_media_execution import NativeMediaPermit

                feature_bridge = NativeMediaPermit.bridge_origin(
                    o.feature_permit,
                    user=o.user,
                    station_id=o.station_id,
                )
            except Exception:
                return False
        if not self._origin_current() or type(o.user_id) is not str or not o.user_id:
            return False
        entry = o.hass.config_entries.async_get_entry(o.station_id)
        sessions = o.sessions[0]
        return bool(
            type(self.stopped) is bool
            and not self.stopped
            and not o.life[1]
            and self.entered is o.life[0]
            and self.session is o.resource[0]
            and (
                self.session is None
                or same_ports(
                    o.data_ports[0],
                    tuple(
                        getattr(self.session, port, None)
                        for port in (
                            "start",
                            "send",
                            "receive",
                            "mute",
                            "close",
                        )
                    ),
                )
            )
            and (o.task[0] is None or self.task is o.task[0])
            and (
                feature_bridge
                or (
                    _screen_open(o.hass, o.connection) and _authorized(o.hass, o.user, o.station_id)
                )
            )
            and entry
            and getattr(entry, "runtime_data", None) is o.runtime
            and not o.runtime.is_closed
            and sessions is not None
            and o.hass.data[DOMAIN].get("audio_sessions") is sessions
            and sessions.get(o.station_id) is self
            and self._owns_subscription()
            and self._origin_current()
        )

    def _source_guard(self, track: str) -> None:
        o = _audio_owner(self)
        if not self.valid() or o.feature_permit is None:
            raise AudioError("audio_source_changed")
        o.feature_permit.check_bridge(self, track)
        if not self.valid():
            raise AudioError("audio_source_changed")

    def _owned_guard(self) -> None:
        o = _audio_owner(self)
        if o.feature_permit is None:
            raise AudioError("audio_source_changed")
        o.feature_permit.check_owned()
        # Source/gate/consent may have expired. The original resource and native
        # client must still be owned; cleanup never uses a rebound public label.
        if o.runtime.client is not o.client:
            raise AudioError("audio_source_changed")

    @callback
    def cancel(self) -> None:
        o = _audio_owner(self)
        if o.life[1]:
            AudioBridge._track_cleanup(o)
            return
        o.life[1] = self.stopped = True
        if not o.life[0]:
            self._bind_sessions(o.hass.data.get(DOMAIN, {}).get("audio_sessions", {}))
            # Preserve explicit direct pre-start assembly used by native tests.
            if o.task[0] is None and isinstance(self.task, asyncio.Task):
                o.task[0] = self.task
            o.runtime._track_media_task(self)
            self._detach("audio_stopped", None)
        if o.task[0] is not None:
            o.task[0].cancel()
        AudioBridge._track_cleanup(o)

    @staticmethod
    def _track_cleanup(o: _AudioOwner) -> None:
        task = o.task[0]
        if (
            task is None
            or task.done()
            or o.joining[0] is not None
            or task is asyncio.current_task()
            or is_closing_owner(o)
        ):
            return

        async def finish() -> None:
            # Keep the reservation until the original worker closes. HA excludes
            # long-lived background media from async_block_till_done; track this
            # finite join, including a disconnect after natural failure began
            # closing. Never cancel the original cleanup again in that case.
            _result, cancelled = await _join_owned(asyncio.gather(task, return_exceptions=True))
            if cancelled:
                raise asyncio.CancelledError

        o.joining[0] = o.hass.async_create_task(
            finish(), f"{DOMAIN} audio cleanup", eager_start=False
        )

    async def async_close(self) -> None:
        """Join this bridge's task, including when its public label changed."""
        AudioBridge.cancel(self)
        owner = _audio_owner(self)
        if is_closing_owner(owner):
            return
        task = owner.task[0]
        if task is not None and task is not asyncio.current_task():
            _result, cancelled = await _join_owned(asyncio.gather(task, return_exceptions=True))
            if cancelled:
                raise asyncio.CancelledError
        if owner.life[0] and not owner.cleanup[0]:
            raise AudioError("cleanup_failed")

    def _journal_guard(self):
        if not self.valid():
            raise AudioError("audio_source_changed")

    async def run(self) -> None:
        o = _audio_owner(self)
        o.life[0] = self.entered = True
        task = asyncio.current_task()
        if o.task[0] is None:
            o.task[0] = task
        if self.task is None:
            self.task = task
        o.runtime._track_media_task(self)
        self._bind_sessions(o.hass.data.get(DOMAIN, {}).get("audio_sessions", {}))
        session = None
        reason = "audio_stopped"
        try:
            if not self.valid():
                return
            if o.journal is None:
                raise AudioError("audio_journal_unavailable")
            await o.journal.reserve(o.station_id, o.token, self._journal_guard)
            self._journal_guard()
            allocate = partial(o.factory, o.client)
            if o.feature_permit is not None:
                allocate = partial(
                    o.factory,
                    o.client,
                    source_guard=self._source_guard,
                    owned_guard=self._owned_guard,
                )
            session, cancelled = await _join_owned(o.hass.async_add_executor_job(allocate))
            o.resource[:] = [session, session.close]
            o.data_ports[0] = tuple(
                getattr(session, port, None)
                for port in (
                    "start",
                    "send",
                    "receive",
                    "mute",
                    "close",
                )
            )
            if self.session is None:
                self.session = session
            if cancelled:
                raise asyncio.CancelledError
            if not self.valid():
                return
            o.attempted[0] = True
            await o.data_ports[0][0]()
            if not self.valid():
                return
            if o.feature_permit is not None:
                o.feature_permit.started_audio(self)
            started = o.hass.loop.time()
            self.touched = started
            if not self.valid():
                return
            o.connection.send_event(
                o.subscription,
                {
                    "format": "hikvision_intercom.audio",
                    "state": "ready",
                    "token": o.token,
                    "sample_rate": 8000,
                    "packet_bytes": PACKET_BYTES,
                    "max_seconds": MAX_SECONDS,
                },
            )
            while self.valid():
                now = o.hass.loop.time()
                if now - started >= MAX_SECONDS:
                    reason = "audio_expired"
                    break
                if now - self.touched >= IDLE_SECONDS:
                    reason = "audio_idle_timeout"
                    break
                if session.failure:
                    reason = session.failure
                    break
                await asyncio.sleep(0.2)
        except asyncio.CancelledError:
            pass
        except AudioError as err:
            reason = err.code
        except (HikvisionError, TimeoutError, OSError):
            reason = "audio_connection_lost"
        except Exception:
            # Do not log protocol headers, microphone packets or session identifiers.
            reason = "audio_connection_lost"
        finally:
            o.life[1] = self.stopped = True
            cleanup = True
            try:
                if session:
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
                sessions = o.sessions[0]
                publish = (
                    sessions is not None
                    and sessions.get(o.station_id) is self
                    and o.hass.data.get(DOMAIN, {}).get("audio_sessions") is sessions
                    and o.hass.data.get(DOMAIN, {}).get("audio_results") is o.results
                )
                result = (
                    o.runtime,
                    {
                        "reason": reason,
                        "close_confirmed": session.close_confirmed if session else None,
                        "cleanup_joined": cleanup,
                        "received_bytes": session.received_bytes if session else 0,
                        "received_signal_bytes": getattr(session, "received_signal_bytes", 0)
                        if session
                        else 0,
                        "sent_bytes": session.sent_bytes if session else 0,
                        "microphone_packets_accepted": self.sequence,
                        "microphone_bytes_written": session.microphone_bytes if session else 0,
                        "microphone_signal_bytes_written": getattr(
                            session, "microphone_signal_bytes", 0
                        )
                        if session
                        else 0,
                        "upload_http_status": session.upload_http_status if session else None,
                        "physical_result": "unverified",
                    },
                )
                if publish:
                    o.results[o.station_id] = result
            finally:
                self._detach(reason, session)


@websocket_api.websocket_command(
    vol.All(vol.Schema({"type": f"{DOMAIN}/audio/start"}, extra=vol.ALLOW_EXTRA))
)
@callback
def start(
    hass: HomeAssistant, connection: websocket_api.ActiveConnection, msg: dict[str, Any]
) -> None:
    if not _screen_open(hass, connection) or not _authorized(hass, connection.user):
        connection.send_error(msg["id"], "unauthorized", "WisKey control access is not granted")
        return
    station = msg.get("station_id")
    if (
        set(msg) != {"id", "type", "station_id"}
        or not isinstance(station, str)
        or len(station) > 128
    ):
        connection.send_error(msg["id"], "invalid_fields", "Invalid audio request")
        return
    entry = hass.config_entries.async_get_entry(station)
    if not _screen_open(hass, connection) or not _authorized(hass, connection.user, station):
        connection.send_error(msg["id"], "unauthorized", "WisKey control access is not granted")
        return
    runtime = getattr(entry, "runtime_data", None) if entry and entry.domain == DOMAIN else None
    if runtime is None or runtime.is_closed:
        connection.send_error(msg["id"], "station_unloaded", "Station unavailable")
        return
    sessions = hass.data[DOMAIN].setdefault("audio_sessions", {})
    tts_sessions = hass.data[DOMAIN].setdefault("tts_audio_sessions", {})
    all_sessions = [*sessions.values(), *tts_sessions.values()]
    if (
        station in sessions
        or station in tts_sessions
        or len(all_sessions) >= MAX_AUDIO_SESSIONS
        or any(item.connection is connection for item in all_sessions)
    ):
        connection.send_error(msg["id"], "audio_busy", "Audio is already in use")
        return
    bridge = AudioBridge(hass, connection, runtime, msg["id"])
    sessions[station] = bridge
    bridge._bind_sessions(sessions)
    connection.subscriptions[msg["id"]] = bridge.cancel
    connection.send_result(msg["id"])
    bridge.task = hass.async_create_background_task(bridge.run(), f"{DOMAIN} audio")
    if bridge._creation.task[0] is None:
        bridge._creation.task[0] = bridge.task
    runtime._track_media_task(bridge)


def start_feature_audio(hass, connection, runtime, subscription: int, permit) -> AudioBridge:
    """Internal source-authenticated entry; existing public schemas stay closed."""
    from .access.arx_media_execution import NativeMediaPermit

    if type(permit) is not NativeMediaPermit:
        raise AudioError("unauthorized")
    permit.check()
    delegated = NativeMediaPermit.bridge_authorized(
        permit,
        user=connection.user,
        station_id=runtime.station_id,
    )
    if (
        not delegated
        and (
            not _screen_open(hass, connection)
            or not _authorized(hass, connection.user, runtime.station_id)
        )
        or type(subscription) is not int
        or subscription <= 0
        or subscription in connection.subscriptions
    ):
        raise AudioError("unauthorized")
    sessions = hass.data[DOMAIN].setdefault("audio_sessions", {})
    tts = hass.data[DOMAIN].setdefault("tts_audio_sessions", {})
    fleet = (*sessions.values(), *tts.values())
    if (
        runtime.station_id in sessions
        or runtime.station_id in tts
        or len(fleet) >= MAX_AUDIO_SESSIONS
        or any(item.connection is connection for item in fleet)
    ):
        raise AudioError("audio_busy")
    bridge = AudioBridge(hass, connection, runtime, subscription, feature_permit=permit)
    try:
        permit.bind_bridge(bridge)
        sessions[runtime.station_id] = bridge
        bridge._bind_sessions(sessions)
        connection.subscriptions[subscription] = bridge.cancel
        if not bridge.valid():
            raise AudioError("unauthorized")
        bridge.task = hass.async_create_background_task(bridge.run(), f"{DOMAIN} feature audio")
        bridge._creation.task[0] = bridge.task
        runtime._track_media_task(bridge)
        return bridge
    except BaseException:
        # Retire even a refused admission between native allocation and Task
        # registration. No source refusal may leave a phantom runtime child.
        AudioBridge.cancel(bridge)
        raise


def _owner(
    hass: HomeAssistant, connection: websocket_api.ActiveConnection, token: object
) -> AudioBridge:
    if not isinstance(token, str) or len(token) != 32:
        raise AudioError("audio_not_started")
    for bridge in hass.data[DOMAIN].get("audio_sessions", {}).values():
        if (
            type(bridge) is AudioBridge
            and bridge.token == token
            and bridge.connection is connection
            and bridge.valid()
        ):
            if bridge.session is not None:
                return bridge
    raise AudioError("audio_not_started")


def packet_handler(operation: str) -> Any:
    @websocket_api.websocket_command(
        vol.All(vol.Schema({"type": f"{DOMAIN}/audio/{operation}"}, extra=vol.ALLOW_EXTRA))
    )
    @websocket_api.async_response
    async def handle(
        hass: HomeAssistant, connection: websocket_api.ActiveConnection, msg: dict[str, Any]
    ) -> None:
        try:
            bridge = None
            try:
                candidate = _owner(hass, connection, msg.get("token"))
                if _feature_bridge_authorized(_audio_owner(candidate)):
                    bridge = candidate
            except AudioError:
                pass
            if bridge is None and (
                not _screen_open(hass, connection) or not _authorized(hass, connection.user)
            ):
                raise AudioError("unauthorized")
            fields = {"id", "type", "token"}
            if operation == "send":
                fields.update({"sequence", "data"})
            if set(msg) != fields:
                raise AudioError("audio_invalid_packet")
            bridge = bridge or _owner(hass, connection, msg.get("token"))
            session = bridge.session
            assert session is not None
            if operation == "receive":
                if bridge.receiving:
                    raise AudioError("audio_backpressure")
                bridge.receiving = True
                try:
                    packet = await _audio_owner(bridge).data_ports[0][2]()
                    if not bridge.valid():
                        raise AudioError("audio_not_started")
                    result = {
                        "format": "hikvision_intercom.audio",
                        "data": base64.b64encode(packet).decode("ascii"),
                    }
                finally:
                    bridge.receiving = False
            elif operation == "send":
                encoded = msg["data"]
                if (
                    type(msg["sequence"]) is not int
                    or msg["sequence"] != bridge.sequence
                    or not isinstance(encoded, str)
                    or len(encoded) != 1068
                ):
                    raise AudioError("audio_invalid_packet")
                try:
                    packet = base64.b64decode(encoded, validate=True)
                except (binascii.Error, ValueError):
                    raise AudioError("audio_invalid_packet") from None
                if not bridge.valid():
                    raise AudioError("audio_not_started")
                _audio_owner(bridge).data_ports[0][1](packet)
                bridge.sequence += 1
                result = {"sequence": bridge.sequence}
            elif operation == "diagnostics":
                result = {
                    "microphone_packets_accepted": bridge.sequence,
                    "microphone_bytes_written": session.microphone_bytes,
                    "microphone_signal_bytes_written": session.microphone_signal_bytes,
                    "total_bytes_written": session.sent_bytes,
                    "received_bytes": session.received_bytes,
                    "received_signal_bytes": session.received_signal_bytes,
                    "dropped_receive_packets": session.dropped_packets,
                    "upload_http_status": session.upload_http_status,
                    "physical_result": "unverified",
                }
            else:
                if not bridge.valid():
                    raise AudioError("audio_not_started")
                _audio_owner(bridge).data_ports[0][3]()
                result = {}
            bridge.touched = hass.loop.time()
            if not bridge.valid():
                raise AudioError("audio_not_started")
            connection.send_result(msg["id"], result)
        except AudioError as err:
            connection.send_error(msg["id"], err.code, "Audio request could not complete")
        except Exception:
            connection.send_error(msg["id"], "audio_connection_lost", "Audio unavailable")

    return handle


@callback
def register_audio(hass: HomeAssistant) -> None:
    websocket_api.async_register_command(hass, start)
    for operation in ("send", "receive", "mute", "diagnostics"):
        websocket_api.async_register_command(hass, packet_handler(operation))
