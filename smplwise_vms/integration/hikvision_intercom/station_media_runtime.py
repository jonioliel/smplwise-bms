"""Original bridge-owned W10 resources, sharing the native station audio lock.

Descriptor metadata never contains a transport source. Only the explicit private
stream lease returns the configured source to the authenticated backend socket.
No recording, credentials, session IDs or audio bytes enter events or errors.
"""

from __future__ import annotations

import asyncio
import base64
import re
import weakref
from dataclasses import dataclass, field
from datetime import UTC, datetime, timedelta
from functools import partial
from uuid import uuid4

from homeassistant.components.websocket_api.connection import ActiveConnection
from homeassistant.const import EVENT_HOMEASSISTANT_CLOSE, EVENT_HOMEASSISTANT_STOP
from homeassistant.core import callback

from .bridge_command_auth import (
    BridgeExecutionBinding,
    VerifiedBridgePrincipal,
    retain_execution,
)
from .client.audio import PACKET_BYTES, AudioError, AudioSession
from .const import DOMAIN, MAX_AUDIO_SESSIONS
from .media_lifetime import close_owned, is_closing_owner, join_owned
from .station_audio_journal import NativeAudioAttemptJournal, restore_audio_quarantines
from .station_media_frames import BridgeFrameIngress, MediaFrameError
from .station_media_settings import DEFAULT_SECONDS, SETTING, talk_seconds
from .trusted_actions.direct_bridge_origin import DirectBridgeConnection
from .trusted_actions.source_bindings import same_ports
from .trusted_actions.validation import Refusal, aware

SCHEMA = "arx.station_media.v1.1"
LISTEN_TRANSPORT = "signed_ws_pcmu_v1"
LISTEN_SCHEMA = "arx.station_talk_audio.v1"
TERMINAL_SUBSCRIPTION_CODE = "media_subscription_closed"
IDLE_SECONDS = 12
CALLER_REASONS = frozenset({"stopped", "ended", "expired", "access_lost", "upstream_closed"})
_HOSTS = weakref.WeakKeyDictionary()
_TALKS = weakref.WeakKeyDictionary()


def _now():
    return datetime.now(UTC)


def _identity(left, right):
    return (
        len(left) == len(right) == 4
        and left[0] is right[0]
        and left[1] == right[1]
        and left[2] is right[2]
        and left[3] is right[3]
    )


def _text(value, maximum=128):
    if (
        type(value) is not str
        or not 1 <= len(value) <= maximum
        or any(ord(c) < 32 or ord(c) == 127 for c in value)
    ):
        raise Refusal("invalid_fields")
    return value


def _reference(value):
    if type(value) is not str or re.fullmatch(r"[A-Za-z0-9_-]{16,128}", value) is None:
        raise Refusal("invalid_fields")
    return value


def _actor(principal, parameters):
    actor = parameters.get("actor")
    if (
        type(actor) is not dict
        or set(actor) != {"id", "display_name"}
        or type(actor["display_name"]) is not str
        or len(actor["display_name"]) > 256
    ):
        raise Refusal("invalid_fields")
    _text(actor["id"])
    return principal.actor_id


@dataclass(frozen=True, repr=False)
class _Descriptor:
    host: object
    entry: object
    runtime: object
    client: object
    settings: object
    profile: object
    owner: tuple
    actor: str
    request: str
    reference: str
    revision: int
    issued: datetime
    expires: datetime
    max_talk_seconds: int


@dataclass(frozen=True, repr=False)
class _Host:
    hass: object
    namespace: dict
    data: object
    sessions: dict
    tts: dict
    journal: object
    descriptors: dict = field(default_factory=dict)
    talks: dict = field(default_factory=dict)
    revision: list = field(default_factory=lambda: [0])
    stopping: list = field(default_factory=lambda: [False])


class StationMediaHost:
    def __init__(self, hass, journal):
        namespace = hass.data[DOMAIN]
        if (
            namespace.get("station_media") is not None
            or type(journal) is not NativeAudioAttemptJournal
            or journal._owner().hass is not hass
        ):
            raise ValueError("Original station media owner already installed")
        _HOSTS[self] = _Host(
            hass,
            namespace,
            hass.data,
            namespace.setdefault("audio_sessions", {}),
            namespace.setdefault("tts_audio_sessions", {}),
            journal,
        )
        namespace["station_media"] = self
        o = _HOSTS[self]
        restore_audio_quarantines(journal, o.sessions, o.tts)
        hass.bus.async_listen_once(EVENT_HOMEASSISTANT_STOP, self.stop)
        hass.bus.async_listen_once(EVENT_HOMEASSISTANT_CLOSE, self.retire)

    async def stop(self, _event):
        o = _HOSTS.get(self)
        if o is None:
            return
        o.stopping[0] = True
        talks = tuple(o.talks.values())
        await join_owned(
            asyncio.gather(
                *(BridgeTalkSession.async_close(talk) for talk in talks), return_exceptions=True
            )
        )

    @callback
    def retire(self, _event):
        o = _HOSTS.get(self)
        if o is None:
            return
        if any(
            _TALKS[talk].task[0] is not None and not _TALKS[talk].task[0].done()
            for talk in o.talks.values()
            if talk in _TALKS
        ):
            return  # Keep unresolved original ownership; never abandon a Task.
        for talk in o.talks.values():
            _TALKS.pop(talk, None)
        o.journal.retire()
        _HOSTS.pop(self, None)

    def _owner(self):
        o = _HOSTS.get(self)
        if (
            o is None
            or o.stopping[0]
            or o.hass.data is not o.data
            or o.data.get(DOMAIN) is not o.namespace
            or o.namespace.get("station_media") is not self
            or o.namespace.get("audio_sessions") is not o.sessions
            or o.namespace.get("tts_audio_sessions") is not o.tts
        ):
            raise Refusal("source_changed")
        return o

    def descriptor(self, principal, parameters):
        from .runtime import IntercomRuntime

        o = StationMediaHost._owner(self)
        if type(principal) is not VerifiedBridgePrincipal:
            raise Refusal("Unauthorized")
        principal.check()
        if set(parameters) != {"station_id", "actor", "request_id"}:
            raise Refusal("invalid_fields")
        actor = _actor(principal, parameters)
        station = _text(parameters["station_id"])
        request = _text(parameters["request_id"])
        entry = o.hass.config_entries.async_get_entry(station)
        if entry is None or entry.domain != DOMAIN:
            raise Refusal("station_not_found")
        runtime = getattr(entry, "runtime_data", None)
        if type(runtime) is not IntercomRuntime or runtime.is_closed:
            raise Refusal("station_offline")
        now = _now()
        for key, row in tuple(o.descriptors.items()):
            if row.expires <= now:
                o.descriptors.pop(key, None)
        if len(o.descriptors) >= 128:
            raise Refusal("rate_limited")
        o.revision[0] += 1
        try:
            duration = talk_seconds(entry.options.get(SETTING, DEFAULT_SECONDS))
        except ValueError:
            raise Refusal("media_settings_invalid") from None
        row = _Descriptor(
            self,
            entry,
            runtime,
            runtime.client,
            runtime.client.settings,
            runtime.profile,
            principal.owner_key,
            actor,
            request,
            uuid4().hex,
            o.revision[0],
            now,
            now + timedelta(seconds=max(300, duration)),
            duration,
        )
        o.descriptors[row.reference] = row
        StationMediaHost._check(self, row, principal)
        # Discovery currently retains stream availability, not codec/dimensions
        # or viewer capacity. v1.1 explicitly represents those as unknown.
        return {
            "schema": SCHEMA,
            "station_id": station,
            "session": row.reference,
            "revision": row.revision,
            "issued_at": now.isoformat(),
            "expires_at": row.expires.isoformat(),
            "video": {
                "profiles": (
                    [
                        {
                            "id": "main",
                            "codec": None,
                            "width": None,
                            "height": None,
                            "fps": None,
                            "transports": ["private_rtsp_source"],
                        }
                    ]
                    if row.profile.stream
                    else []
                )
            },
            "audio": {
                "listen": None,
                "talk": None,
                "duplex": None,
                "codec": None,
                "talk_transports": ["signed_ws_batch_v1"],
                "max_talk_seconds": row.max_talk_seconds,
                "listen_transports": [LISTEN_TRANSPORT],
            },
            "limits": {"max_viewers": None, "max_talkers": 1},
        }

    def _check(self, row, principal):
        StationMediaHost._owner(self)
        if type(principal) is not VerifiedBridgePrincipal:
            raise Refusal("Unauthorized")
        principal.check()
        if not _identity(principal.owner_key, row.owner):
            raise Refusal("Unauthorized")
        StationMediaHost._check_source(self, row)

    def _check_talk(self, row, execution):
        if type(execution) is not BridgeExecutionBinding:
            raise Refusal("Unauthorized")
        execution.check()
        if not _identity(execution.owner_key, row.owner):
            raise Refusal("Unauthorized")
        StationMediaHost._check_source(self, row)

    def _check_source(self, row):
        if _now() >= row.expires:
            raise Refusal("session_expired")
        StationMediaHost._check_source_identity(self, row)

    def _check_source_identity(self, row):
        o = StationMediaHost._owner(self)
        if (
            row.host is not self
            or o.descriptors.get(row.reference) is not row
            or o.hass.config_entries.async_get_entry(row.entry.entry_id) is not row.entry
            or getattr(row.entry, "runtime_data", None) is not row.runtime
            or row.runtime.is_closed
            or row.runtime.client is not row.client
            or row.runtime.profile is not row.profile
            or row.client.settings is not row.settings
        ):
            raise Refusal("source_changed")

    def resolve(self, principal, parameters):
        o = StationMediaHost._owner(self)
        reference = _reference(parameters.get("session"))
        row = o.descriptors.get(reference)
        if row is None:
            raise Refusal("session_expired")
        StationMediaHost._check(self, row, principal)
        if _actor(principal, parameters) != row.actor:
            raise Refusal("Unauthorized")
        _text(parameters.get("request_id"))
        return row

    def stream(self, principal, parameters):
        if set(parameters) != {"session", "profile", "actor", "request_id"}:
            raise Refusal("invalid_fields")
        row = StationMediaHost.resolve(self, principal, parameters)
        if parameters["profile"] != "main" or row.profile.stream is not True:
            raise Refusal("media_not_supported")
        # The source is an original configured backend credential. Expiry is
        # the Arx in-memory registration lease, not device credential rotation.
        source = row.settings.rtsp_source()
        StationMediaHost._check(self, row, principal)
        return {
            "source": source,
            "expires_at": min(row.expires, _now() + timedelta(seconds=15)).isoformat(),
        }

    async def open(self, principal, parameters, connection, subscription):
        o = StationMediaHost._owner(self)
        if (
            set(parameters) - {"listen"} != {"session", "actor", "request_id", "expires_at"}
            or type(parameters.get("listen", False)) is not bool
        ):
            raise Refusal("invalid_fields")
        row = StationMediaHost.resolve(self, principal, parameters)
        try:
            expiry = aware(parameters["expires_at"])
        except Refusal:
            raise Refusal("invalid_fields") from None
        now = _now()
        if not now < expiry <= min(row.expires, now + timedelta(seconds=row.max_talk_seconds)):
            raise Refusal("invalid_fields")
        fleet = (*o.sessions.values(), *o.tts.values())
        if (
            row.runtime.station_id in o.sessions
            or row.runtime.station_id in o.tts
            or len(fleet) >= MAX_AUDIO_SESSIONS
            or any(item.connection is connection for item in fleet)
        ):
            raise Refusal("audio_busy")
        if subscription in connection.subscriptions:
            raise Refusal("invalid_fields")
        # Closed references remain idempotently queryable until their descriptor
        # expires. Never evict an unresolved/cleanup_failed original owner.
        for key, talk in tuple(o.talks.items()):
            root = _TALKS[talk]
            if root.joined[0] and root.descriptor.expires <= now:
                o.talks.pop(key, None)
        if len(o.talks) >= 128:
            raise Refusal("rate_limited")
        talk = BridgeTalkSession(
            self,
            row,
            principal,
            parameters["request_id"],
            connection,
            subscription,
            expiry,
            listen=parameters.get("listen", False),
        )
        root = _TALKS[talk]
        o.sessions[row.runtime.station_id] = talk
        o.talks[root.reference] = talk
        connection.subscriptions[subscription] = talk.cancel
        root.task[0] = o.hass.async_create_background_task(
            talk.run(), f"{DOMAIN} original bridge talk"
        )

        def never_started(_task):
            if not root.life[0]:
                root.life[1] = root.joined[0] = True
                root.result[:] = ["closed", "stopped"]
                root.ingress.close()
                if o.sessions.get(row.runtime.station_id) is talk:
                    o.sessions.pop(row.runtime.station_id, None)
                if connection.subscriptions.get(subscription) == talk.cancel:
                    connection.subscriptions.pop(subscription, None)
                root.ready.set()

        root.task[0].add_done_callback(never_started)
        row.runtime._track_media_task(talk)
        try:
            await root.ready.wait()
            principal.check()
            if root.result[0] != "running":
                raise Refusal(
                    "cleanup_failed"
                    if root.result[0] == "cleanup_failed"
                    else "media_not_supported"
                    if root.result[1] == "media_not_supported"
                    else "media_outcome_unknown"
                )
            talk._guard("admission")
            result = {"talk_ref": root.reference, "codec": "pcmu", "frame_ms": 20}
            if root.listen:
                result["listen"] = {
                    "transport": LISTEN_TRANSPORT,
                    "schema": LISTEN_SCHEMA,
                    "sample_rate": 8000,
                    "channels": 1,
                    "packet_bytes": PACKET_BYTES,
                }
            return talk, result
        except BaseException:
            await talk.async_close()
            raise

    def talk(self, principal, reference):
        o = StationMediaHost._owner(self)
        _reference(reference)
        talk = o.talks.get(reference)
        if talk is None:
            raise Refusal("session_expired")
        root = _TALKS[talk]
        principal.check()
        if not _identity(principal.owner_key, root.descriptor.owner):
            raise Refusal("Unauthorized")
        # The authenticated transport may query its own retired cleanup result.
        # A fresh proof cannot revive its descriptor or original resource.
        root.principal[0] = principal
        return talk


@dataclass(frozen=True, repr=False)
class _Talk:
    host: object
    descriptor: _Descriptor
    runtime: object
    client: object
    connection: object
    user: object
    subscriptions: dict
    subscription: int
    actor: str
    request: str
    reference: str
    expires: datetime
    factory: object
    observe: object
    open_attempted: object
    sessions: dict
    principal: list
    ingress: object
    listen: bool
    execution: object
    terminal_ports: tuple
    task: list = field(default_factory=lambda: [None])
    life: list = field(default_factory=lambda: [False, False])
    resource: list = field(default_factory=lambda: [None, None, None, None])
    ready: object = field(default_factory=asyncio.Event)
    touched: list = field(default_factory=list)
    attempted: list = field(default_factory=lambda: [False])
    joined: list = field(default_factory=lambda: [False])
    result: list = field(default_factory=lambda: ["pending", "stopped"])
    admitted: list = field(default_factory=lambda: [False])
    joining: list = field(default_factory=lambda: [None])


class BridgeTalkSession:
    """An actual backend socket owner, independent of the panel audio lease."""

    def __init__(
        self,
        host,
        descriptor,
        principal,
        request,
        connection,
        subscription,
        expires,
        *,
        listen=False,
    ):
        o = StationMediaHost._owner(host)
        root = _Talk(
            host,
            descriptor,
            descriptor.runtime,
            descriptor.client,
            connection,
            connection.user,
            connection.subscriptions,
            subscription,
            descriptor.actor,
            request,
            uuid4().hex,
            expires,
            AudioSession,
            AudioSession.feature_observation,
            AudioSession.feature_open_attempted,
            o.sessions,
            [principal],
            BridgeFrameIngress(),
            listen,
            retain_execution(principal, expires),
            (connection.send_event, connection.send_message, connection.send_error),
            touched=[o.hass.loop.time()],
        )
        _TALKS[self] = root
        self._creation = root
        self.connection = connection  # Existing fleet lock checks actual transport identity.
        root.runtime._own_media(self)

    def _owned(self):
        o = _TALKS[self]
        if (
            self._creation is not o
            or o.runtime.client is not o.client
            or o.client.settings is not o.descriptor.settings
        ):
            raise AudioError("audio_source_changed")
        return o

    def _guard(self, _track):
        o = self._owned()
        if _now() >= o.expires:
            raise Refusal("session_expired")
        StationMediaHost._check_talk(o.host, o.descriptor, o.execution)
        if (
            o.life[1]
            or o.connection.user is not o.user
            or o.connection.subscriptions is not o.subscriptions
            or o.subscriptions.get(o.subscription) != self.cancel
            or o.sessions.get(o.runtime.station_id) is not self
        ):
            raise AudioError("audio_source_changed")
        if o.result[0] == "running" and o.runtime.hass.loop.time() - o.touched[0] >= IDLE_SECONDS:
            raise AudioError("idle_timeout")

    def floor(self, held):
        o = _TALKS[self]
        self._guard("floor")
        o.ingress.floor(held)
        if not held:
            o.resource[3]()
        o.touched[0] = o.runtime.hass.loop.time()
        return {"held": held, "next_seq": o.ingress.next_sequence}

    def frames(self, frames):
        o = _TALKS[self]
        self._guard("frames")
        try:
            result = o.ingress.push(frames, send=o.resource[2], guard=lambda: self._guard("send"))
        except MediaFrameError as error:
            if error.code == "media_outcome_unknown":
                self.cancel()
            raise
        o.touched[0] = o.runtime.hass.loop.time()
        return result

    def admitted(self):
        _TALKS[self].admitted[0] = True

    def cancel(self):
        o = _TALKS[self]
        if not o.life[1]:
            o.life[1] = True
            o.ingress.close()
            if o.task[0] is not None:
                o.task[0].cancel()
        if (
            o.joining[0] is None
            and o.task[0] is not None
            and not o.task[0].done()
            and not is_closing_owner(o)
        ):

            async def finish():
                await join_owned(asyncio.gather(o.task[0], return_exceptions=True))

            o.joining[0] = o.runtime.hass.async_create_task(
                finish(), f"{DOMAIN} original bridge talk cleanup", eager_start=False
            )

    async def async_close(self):
        o = _TALKS[self]
        self.cancel()
        if (
            o.task[0] is not None
            and o.task[0] is not asyncio.current_task()
            and not is_closing_owner(o)
        ):
            _, cancelled = await join_owned(asyncio.gather(o.task[0], return_exceptions=True))
            if cancelled:
                raise asyncio.CancelledError
        if o.result[0] == "cleanup_failed":
            raise Refusal("cleanup_failed")
        return {"state": o.result[0], "cleanup_joined": o.joined[0], "no_effect": None}

    async def close(self, reason):
        if type(reason) is not str or reason not in CALLER_REASONS:
            raise Refusal("invalid_fields")
        _TALKS[self].result[1] = reason
        return await self.async_close()

    async def run(self):
        o = _TALKS[self]
        o.life[0] = True
        reason = "stopped"
        try:
            self._guard("allocate")
            host_owner = StationMediaHost._owner(o.host)
            await host_owner.journal.reserve(
                o.runtime.station_id, o.reference, lambda: self._guard("journal")
            )
            self._guard("allocate")
            session, cancelled = await join_owned(
                o.runtime.hass.async_add_executor_job(
                    partial(
                        o.factory,
                        o.client,
                        source_guard=self._guard,
                        owned_guard=self._owned_guard,
                    )
                )
            )
            o.resource[:] = [session, session.close, session.send, session.mute]
            if cancelled:
                raise asyncio.CancelledError
            self._guard("start")
            o.attempted[0] = True
            await session.start()
            self._guard("ready")
            if o.observe(session)["started"] is not True:
                raise Refusal("media_outcome_unknown")
            o.result[0] = "running"
            o.ready.set()
            receive_sequence = 0
            while True:
                self._guard("current")
                if o.runtime.hass.loop.time() - o.touched[0] >= IDLE_SECONDS:
                    reason = "idle_timeout"
                    break
                if session.failure:
                    from .client.audio import native_receive_idle

                    reason = "idle_timeout" if native_receive_idle(session) else "upstream_closed"
                    break
                if not o.listen or not o.admitted[0]:
                    await asyncio.sleep(0.1)
                    continue
                # The original engine bounds packet age and its incoming queue.
                # A real, current packet is caller activity. It never renews
                # the descriptor, signed authority, or absolute talk expiry.
                try:
                    async with asyncio.timeout(0.1):
                        packet = await session.receive()
                except TimeoutError:
                    continue
                self._guard("audio_receive")
                if not packet:
                    continue
                if type(packet) is not bytes or len(packet) != PACKET_BYTES:
                    raise AudioError("audio_invalid_packet")
                o.connection.send_event(
                    o.subscription,
                    {
                        "type": "media/talk_audio",
                        "schema": LISTEN_SCHEMA,
                        "talk_ref": o.reference,
                        "seq": receive_sequence,
                        "codec": "pcmu",
                        "sample_rate": 8000,
                        "channels": 1,
                        "data": base64.b64encode(packet).decode("ascii"),
                    },
                )
                self._guard("audio_published")
                o.touched[0] = o.runtime.hass.loop.time()
                receive_sequence += 1
        except asyncio.CancelledError:
            reason = o.result[1]
        except Refusal as error:
            reason = (
                "expired"
                if error.code == "session_expired"
                else "source_changed"
                if error.code == "source_changed"
                else "access_lost"
            )
        except AudioError as error:
            from .client.audio import native_receive_idle

            reason = (
                "idle_timeout"
                if error.code == "idle_timeout" or native_receive_idle(o.resource[0])
                else "media_not_supported"
                if error.code == "audio_unsupported"
                else "upstream_closed"
            )
        except Exception:
            reason = "upstream_closed"
        finally:
            o.life[1] = True
            o.ingress.close()
            session = o.resource[0]
            cleanup = not o.attempted[0]
            try:
                if session is not None:
                    await close_owned(o, o.resource[1]())
                    cleanup = (
                        not o.attempted[0]
                        or o.open_attempted(session) is False
                        or o.observe(session)["close_confirmed"] is True
                    )
            except (Exception, asyncio.CancelledError):
                cleanup = False
            if cleanup:
                try:
                    # Original host lookup remains available while stopping;
                    # cleanup never needs or renews expired execution authority.
                    host_owner = _HOSTS.get(o.host)
                    if host_owner is None:
                        raise Refusal("cleanup_failed")
                    pending = host_owner.journal.pending().get(o.runtime.station_id)
                    if pending == o.reference:
                        await close_owned(
                            o, host_owner.journal.clear_joined(o.runtime.station_id, o.reference)
                        )
                    elif pending is not None:
                        raise Refusal("cleanup_failed")
                except (Exception, asyncio.CancelledError):
                    cleanup = False
            o.joined[0] = cleanup
            o.result[:] = ["closed" if cleanup else "cleanup_failed", reason]
            # A failed or ambiguous native close keeps this exact station lock.
            if cleanup and o.sessions.get(o.runtime.station_id) is self:
                o.sessions.pop(o.runtime.station_id, None)
            if o.subscriptions.get(o.subscription) == self.cancel:
                try:
                    # This is the terminal control of the already-admitted
                    # subscription, including pairing/source revocation. It
                    # reports only that original operation's cleanup and never
                    # calls execution.check(), revives its proof, or permits
                    # media. The exact native connection, user, subscription
                    # callback and publication ports must still own it.
                    if not (
                        self._creation is o
                        and type(o.connection) in {ActiveConnection, DirectBridgeConnection}
                        and o.admitted[0]
                        and o.connection.user is o.user
                        and o.connection.subscriptions is o.subscriptions
                        and same_ports(
                            o.terminal_ports,
                            (
                                o.connection.send_event,
                                o.connection.send_message,
                                o.connection.send_error,
                            ),
                        )
                    ):
                        raise Refusal("Unauthorized")
                    o.connection.send_event(
                        o.subscription,
                        {
                            "type": "media/talk_closed",
                            "talk_ref": o.reference,
                            "reason": reason,
                            "cleanup_joined": cleanup,
                        },
                    )
                except Exception:
                    # A replaced transport identity receives no talk reference,
                    # reason, cleanup claim or media. Its original subscription
                    # can still be retired with fixed id-only control. Closing
                    # the shared HA socket would affect other owners.
                    if (
                        self._creation is o
                        and o.admitted[0]
                        and type(o.connection) in {ActiveConnection, DirectBridgeConnection}
                        and o.connection.subscriptions is o.subscriptions
                        and o.subscriptions.get(o.subscription) == self.cancel
                        and same_ports(
                            o.terminal_ports,
                            (
                                o.connection.send_event,
                                o.connection.send_message,
                                o.connection.send_error,
                            ),
                        )
                    ):
                        try:
                            o.connection.send_error(
                                o.subscription,
                                TERMINAL_SUBSCRIPTION_CODE,
                                "Media subscription ended",
                            )
                        except Exception:
                            pass  # The original socket may already be gone.
                finally:
                    if o.subscriptions.get(o.subscription) == self.cancel:
                        o.subscriptions.pop(o.subscription, None)
            o.ready.set()

    def _owned_guard(self):
        self._owned()
