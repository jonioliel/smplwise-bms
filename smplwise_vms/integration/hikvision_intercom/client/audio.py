"""Bounded G.711 audio sessions; ISAPI guide sections 10.1 and 13.7.1.

A session never changes channel configuration or sends a call/door command.
HTTP upload uses the documented persistent, unframed binary body (no HTTP
chunk markers). Device session identifiers and Digest headers stay in memory.
"""

from __future__ import annotations

import asyncio
import contextlib
import re
import socket
import ssl
import time
import weakref
from collections.abc import Awaitable, Callable
from contextlib import nullcontext
from dataclasses import astuple, dataclass
from typing import Any
from urllib.parse import quote

import httpx

from ..exceptions import HikvisionError
from ..trusted_actions.source_bindings import same_ports
from .client import HikvisionClient
from .effect_scope import RequestRule, native_effect_scope
from .parser import parse_payload
from .transport import LimitedTransport

CHANNEL = "/ISAPI/System/TwoWayAudio/channels/1"
SAMPLE_RATE = 8000
FRAME_BYTES = 160
PACKET_BYTES = 800
MAX_PACKET_AGE = 0.3
WRITE_TIMEOUT = 0.5
RECEIVE_TIMEOUT = 5.0
SILENCE = b"\xff" * FRAME_BYTES


class AudioError(HikvisionError):
    """Only an allowlisted code, never remote text or a credential, reaches HA."""

    def __init__(self, code: str) -> None:
        super().__init__("Audio session could not complete")
        self.code = code


def validate_channel(payload: dict[str, Any], capabilities: dict[str, Any]) -> None:
    """Support the observed channel and documented 8 kHz mu-law framing only."""
    channel = payload.get("TwoWayAudioChannel")
    caps = capabilities.get("TwoWayAudioChannel")
    if not isinstance(channel, dict) or not isinstance(caps, dict):
        raise AudioError("audio_unsupported")
    codec = caps.get("audioCompressionType")
    options = codec.get("@opt", "") if isinstance(codec, dict) else ""
    if (
        channel.get("id") != "1"
        or caps.get("id") != "1"
        or not isinstance(options, str)
        or "G.711ulaw" not in options.split(",")
        or channel.get("audioCompressionType") != "G.711ulaw"
        or channel.get("audioInboundCompressionType", "G.711ulaw") != "G.711ulaw"
        or channel.get("audioSamplingRate", "8") not in ("8", "8.0", "8.00", 8)
        or channel.get("audioBitRate", "64") not in ("64", 64)
        or channel.get("lineOutForbidden", "false") not in ("false", False)
        or channel.get("micInForbidden", "false") not in ("false", False)
    ):
        raise AudioError("audio_unsupported")
    # Firmware 3.9.0 reports false while closed and true after a successful open.
    # No PUT to the channel configuration is necessary or performed.


@dataclass(frozen=True)
class _FeatureAudio:
    origin: tuple
    label: object
    guard_refs: tuple
    upload: list
    session_id: list
    tasks: list
    closed: list
    lock: object
    stream_control: object


_FEATURE_AUDIO = weakref.WeakKeyDictionary()
_NATIVE_AUDIO_STATE = weakref.WeakKeyDictionary()
_RECEIVE_IDLE = weakref.WeakKeyDictionary()


def native_receive_idle(session):
    """Only a verified open stream's packet watchdog can record quiet input."""
    return type(session) is AudioSession and _RECEIVE_IDLE.get(session) is True


def native_cleanup_observation(session):
    state = _NATIVE_AUDIO_STATE.get(session) if type(session) is AudioSession else None
    if state is None:
        return None
    return {"open_attempted": state[0], "close_confirmed": state[1]}


def _guard_ref(port):
    return (
        weakref.WeakMethod(port)
        if getattr(port, "__self__", None) is not None
        else weakref.ref(port)
    )


class AudioSession:
    """Own one station's control, receive and transmit lifetimes independently."""

    def __init__(
        self,
        client: HikvisionClient,
        *,
        source_guard: Callable[[str], None] | None = None,
        owned_guard: Callable[[], None] | None = None,
    ) -> None:
        self.control = HikvisionClient(
            client._session, client.settings, expected_identity=client._expected_identity
        )
        settings = client.settings
        self.http = httpx.AsyncClient(
            transport=LimitedTransport(
                httpx.AsyncHTTPTransport(
                    verify=settings.verify_ssl,
                    trust_env=False,
                    retries=0,
                    limits=httpx.Limits(max_connections=2, max_keepalive_connections=1),
                ),
                8192,
                stream_path=CHANNEL + "/audioData",
            ),
            trust_env=False,
            follow_redirects=False,
        )
        # Internal opt-in extra refusal fences, never public request fields or
        # local authority. Ordinary native sessions retain their existing path.
        self._feature_guards = source_guard, owned_guard
        self._feature_origin = (
            (
                client,
                client._session,
                client.settings,
                astuple(client.settings),
                client._expected_identity,
                self.control,
                self.http,
                self.http._transport,
                self._feature_guards,
                client._session._transport,
                (self.control.async_confirm_identity, self.control._get, self.control._request),
            )
            if source_guard is not None
            else None
        )
        self._owned_upload = [None, None]
        self._owned_session_id = None
        self._stream_control = (
            HikvisionClient(self.http, client.settings, expected_identity=client._expected_identity)
            if source_guard is not None
            else None
        )
        self.tls: ssl.SSLContext | None = None
        if settings.scheme == "https":
            self.tls = ssl.create_default_context()
            if not settings.verify_ssl:
                self.tls.check_hostname = False
                self.tls.verify_mode = ssl.CERT_NONE
        self.session_id: str | None = None
        self.failure: str | None = None
        self.close_confirmed: bool | None = None
        self.incoming: asyncio.Queue[tuple[float, bytes]] = asyncio.Queue(maxsize=3)
        self.outgoing: asyncio.Queue[tuple[float, bytes]] = asyncio.Queue(maxsize=3)
        self._tasks: list[asyncio.Task[None]] = []
        self._writer: asyncio.StreamWriter | None = None
        self._closed = False
        self._close_lock = asyncio.Lock()
        self._mute_epoch = 0
        self._last_send = 0.0
        self._credit = 2.0
        self.upload_http_status: int | None = None
        self.received_bytes = 0
        self.received_signal_bytes = 0
        self.sent_bytes = 0
        self.microphone_bytes = 0
        self.microphone_signal_bytes = 0
        self.dropped_packets = 0
        _NATIVE_AUDIO_STATE[self] = [False, None]
        _RECEIVE_IDLE[self] = False
        if source_guard is not None:
            origin = self._feature_origin
            self._feature_origin = object()
            # Module-owned records contain weak guard ports. A bound bridge
            # guard must not create a global record -> bridge -> session cycle.
            captured = (*origin[:8], None, *origin[9:])
            _FEATURE_AUDIO[self] = _FeatureAudio(
                captured,
                self._feature_origin,
                (_guard_ref(source_guard), _guard_ref(owned_guard)),
                [None, None],
                [None],
                [],
                [False, None, False, False],
                self._close_lock,
                self._stream_control,
            )

    @staticmethod
    def feature_observation(session):
        feature = _FEATURE_AUDIO.get(session) if type(session) is AudioSession else None
        if feature is None:
            return {"started": False, "close_confirmed": None}
        return {"started": feature.closed[2], "close_confirmed": feature.closed[1]}

    @staticmethod
    def feature_open_attempted(session):
        """Original effect boundary, distinct from successful native startup."""
        observed = native_cleanup_observation(session)
        return observed["open_attempted"] if observed is not None else None

    def _check_source(self, track: str = "session", *, cleanup=False) -> None:
        feature = _FEATURE_AUDIO.get(self)
        if feature is None:
            return
        (
            client,
            session,
            settings,
            scalars,
            identity,
            control,
            http,
            transport,
            _unused,
            control_transport,
            ports,
        ) = feature.origin

        def stable():
            # Cleanup follows original module-owned resources even if labels
            # were grafted. It still refuses a rebound actual device/transport.
            if (
                client._session is not session
                or client.settings is not settings
                or astuple(settings) != scalars
                or client._expected_identity != identity
                or control._session is not session
                or control.settings is not settings
                or control._expected_identity != identity
                or session._transport is not control_transport
                or not same_ports(
                    ports, (control.async_confirm_identity, control._get, control._request)
                )
                or type(control_transport) is not LimitedTransport
                or type(transport) is not LimitedTransport
                or http._transport is not transport
                or feature.stream_control._session is not http
                or feature.stream_control.settings is not settings
                or feature.stream_control._expected_identity != identity
            ):
                raise AudioError("audio_source_changed")
            if not cleanup and (
                feature.closed[0]
                or self._feature_origin is not feature.label
                or self.control is not control
                or self.http is not http
                or self._stream_control is not feature.stream_control
                or not same_ports(tuple(ref() for ref in feature.guard_refs), self._feature_guards)
                or self.session_id != feature.session_id[0]
                or (
                    feature.upload[0] is not None
                    and (
                        self._reader is not feature.upload[0]
                        or self._writer is not feature.upload[1]
                    )
                )
            ):
                raise AudioError("audio_source_changed")

        stable()
        guard = feature.guard_refs[1 if cleanup else 0]()
        if guard is None or (guard() if cleanup else guard(track)) is not None:
            raise AudioError("audio_source_changed")
        stable()

    def _scope(self, client, rules, track="session", *, cleanup=False):
        if self not in _FEATURE_AUDIO:
            return nullcontext()
        self._check_source(track, cleanup=cleanup)
        return native_effect_scope(
            client, lambda: self._check_source(track, cleanup=cleanup), tuple(rules)
        )

    def _rule(self, client, method, path):
        return RequestRule(method, httpx.URL(client.settings.base_url + path))

    def _path(self, operation: str) -> str:
        if self.session_id is None:
            raise AudioError("audio_not_started")
        return CHANNEL + "/" + operation + "?sessionId=" + quote(self.session_id, safe="")

    async def start(self) -> None:
        if self._closed or self.session_id is not None:
            raise AudioError("audio_not_started")
        if self.control._expected_identity is None:
            raise AudioError("audio_identity_required")
        self._check_source()
        async with asyncio.timeout(20):
            rules = (
                self._rule(self.control, "GET", "/ISAPI/System/deviceInfo"),
                self._rule(self.control, "GET", CHANNEL),
                self._rule(self.control, "GET", CHANNEL + "/capabilities"),
                self._rule(self.control, "PUT", CHANNEL + "/open"),
            )
            with self._scope(self.control, rules):
                await self.control.async_confirm_identity()
                self._check_source()
                channel = await self.control._get(CHANNEL)
                self._check_source()
                capabilities = await self.control._get(CHANNEL + "/capabilities")
                self._check_source()
                validate_channel(channel, capabilities)
                _NATIVE_AUDIO_STATE[self][0] = True
                if feature := _FEATURE_AUDIO.get(self):
                    feature.closed[3] = True
                payload = parse_payload(await self.control._request("PUT", CHANNEL + "/open")).data
            root = payload.get("TwoWayAudioSession")
            value = root.get("sessionId") if isinstance(root, dict) else None
            if not isinstance(value, str) or not re.fullmatch(r"[A-Za-z0-9_-]{1,64}", value):
                # An ambiguous open is not retried or followed by an unowned close.
                raise AudioError("audio_open_unconfirmed")
            self.session_id = value
            self._owned_session_id = value
            if feature := _FEATURE_AUDIO.get(self):
                feature.session_id[0] = value
            self._check_source()
            await self._connect_upload()
            self._check_source()
        self._tasks = [
            asyncio.create_task(self._guard(self._receive)),
            asyncio.create_task(self._guard(self._transmit)),
            asyncio.create_task(self._guard(self._upload_response)),
        ]
        if feature := _FEATURE_AUDIO.get(self):
            feature.tasks[:] = self._tasks
            feature.closed[2] = True

    async def _connect_upload(self) -> None:
        """Obtain a fresh PUT challenge before consuming any microphone frames."""
        settings = self.control.settings
        path = self._path("audioData")
        request = self.http.build_request(
            "PUT",
            settings.base_url + path,
            content=b"",
            headers={"Accept-Encoding": "identity", "Content-Type": "application/octet-stream"},
        )
        flow = httpx.DigestAuth(settings.username, settings.password).auth_flow(request)
        self._check_source("microphone_send")
        try:
            with (
                self._scope(
                    self._stream_control,
                    (self._rule(self._stream_control, "PUT", path),),
                    "microphone_send",
                )
                if self in _FEATURE_AUDIO
                else nullcontext()
            ):
                challenge = await self.http.send(next(flow), stream=True)
            try:
                self._check_source("microphone_send")
                if challenge.status_code != 401:
                    raise AudioError("audio_auth_failed")
                # Bounded transport also limits bodies drained during authentication.
                # The challenge body can itself await several network chunks.
                # Keep its original HTTP scope alive for every bounded chunk.
                with (
                    self._scope(
                        self._stream_control,
                        (self._rule(self._stream_control, "PUT", path),),
                        "microphone_send",
                    )
                    if self in _FEATURE_AUDIO
                    else nullcontext()
                ):
                    await challenge.aread()
                self._check_source("microphone_send")
                authenticated = flow.send(challenge)
                authorization = authenticated.headers.get("Authorization", "")
            finally:
                await challenge.aclose()
        except (StopIteration, httpx.HTTPError, NotImplementedError, KeyError, ValueError):
            raise AudioError("audio_auth_failed") from None
        finally:
            flow.close()
        if (
            not authorization.startswith("Digest ")
            or "\r" in authorization
            or "\n" in authorization
        ):
            raise AudioError("audio_auth_failed")
        self._check_source("microphone_send")
        async with asyncio.timeout(5):
            self._reader, self._writer = await asyncio.open_connection(
                settings.host,
                settings.port,
                ssl=self.tls,
                server_hostname=settings.host if self.tls else None,
                limit=8192,
            )
            self._owned_upload[:] = [self._reader, self._writer]
            if feature := _FEATURE_AUDIO.get(self):
                feature.upload[:] = [self._reader, self._writer]
            self._check_source("microphone_send")
            # Bound user-space buffering and request a small kernel send buffer.
            # OS minimums/TCP buffering vary: this is not an end-to-end latency guarantee.
            self._writer.transport.set_write_buffer_limits(high=1600, low=800)
            sock = self._writer.get_extra_info("socket")
            if sock is not None:
                sock.setsockopt(socket.SOL_SOCKET, socket.SO_SNDBUF, 1600)
            # ISAPI 10.1: persistent binary upload, without Content-Length.
            # HTTP chunk framing would insert non-audio bytes in this firmware's stream.
            authority = httpx.URL(settings.base_url).netloc.decode("ascii")
            header = (
                f"PUT {path} HTTP/1.1\r\nHost: {authority}\r\n"
                f"Authorization: {authorization}\r\n"
                "Connection: keep-alive\r\nContent-Type: application/octet-stream\r\n"
                "Accept-Encoding: identity\r\n\r\n"
            )
            self._check_source("microphone_send")
            self._writer.write(header.encode("ascii"))
            await self._writer.drain()
            self._check_source("microphone_send")

    async def _guard(self, operation: Callable[[], Awaitable[None]]) -> None:
        try:
            await operation()
        except asyncio.CancelledError:
            raise
        except Exception:
            self.failure = "audio_connection_lost"
        else:
            if not self._closed:
                self.failure = "audio_connection_lost"

    async def _upload_response(self) -> None:
        # Observed firmware acknowledges PUT with HTTP 200, then keeps it open.
        # Retain only the numeric status; it confirms transport, not speaker playback.
        # A rejected request or peer closure ends the session without replay.
        self._check_source("microphone_send")
        line = await self._reader.readline()
        self._check_source("microphone_send")
        if line:
            status = re.fullmatch(rb"HTTP/1\.[01] ([1-5][0-9]{2}) [^\r\n]*\r\n", line)
            if status:
                self.upload_http_status = int(status.group(1))
            if self.upload_http_status != 200:
                raise AudioError("audio_connection_lost")
            headers = await self._reader.readuntil(b"\r\n\r\n")
            self._check_source("microphone_send")
            if len(headers) > 8192:
                raise AudioError("audio_connection_lost")
            await self._reader.read(1)
            self._check_source("microphone_send")

    async def _receive(self) -> None:
        settings = self.control.settings
        self._check_source("audio_receive")
        with (
            self._scope(
                self._stream_control,
                (self._rule(self._stream_control, "GET", self._path("audioData")),),
                "audio_receive",
            )
            if self in _FEATURE_AUDIO
            else nullcontext()
        ):
            await self._receive_stream(settings)

    async def _receive_stream(self, settings) -> None:
        async with self.http.stream(
            "GET",
            settings.base_url + self._path("audioData"),
            auth=httpx.DigestAuth(settings.username, settings.password),
            headers={"Accept-Encoding": "identity", "Content-Type": "application/octet-stream"},
            timeout=httpx.Timeout(5, connect=4),
        ) as response:
            self._check_source("audio_receive")
            kind = response.headers.get("content-type", "").split(";")[0].strip().lower()
            # The misspelled content type is captured from firmware 3.9.0 build 260115.
            if response.status_code != 200 or kind not in {
                "application/octet-stream",
                "application/octem-strem",
            }:
                raise AudioError("audio_connection_lost")
            # Limit time to a complete packet, including a peer trickling bytes.
            try:
                async with asyncio.timeout(RECEIVE_TIMEOUT) as watchdog:
                    async for packet in response.aiter_bytes(PACKET_BYTES):
                        self._check_source("audio_receive")
                        if len(packet) != PACKET_BYTES:
                            raise AudioError("audio_connection_lost")
                        self.received_bytes += len(packet)
                        self.received_signal_bytes += sum(
                            byte not in (0x7F, 0xFF) for byte in packet
                        )
                        if self.incoming.full():
                            self.incoming.get_nowait()
                            self.dropped_packets += 1
                        self.incoming.put_nowait((time.monotonic(), packet))
                        watchdog.reschedule(asyncio.get_running_loop().time() + RECEIVE_TIMEOUT)
            except (TimeoutError, httpx.ReadTimeout):
                # Preserve the bounded engine and its legacy failure code.
                # Distinguish complete-packet inactivity from EOF, malformed
                # audio, authentication and upload failure for bridge terminal.
                _RECEIVE_IDLE[self] = True
                raise

    async def _transmit(self) -> None:
        pending = b""
        expires = 0.0
        mute_epoch = self._mute_epoch
        deadline = time.monotonic()
        while True:
            self._check_source("microphone_send")
            now = time.monotonic()
            if now > expires or mute_epoch != self._mute_epoch:
                pending = b""
                mute_epoch = self._mute_epoch
            if not pending:
                while not self.outgoing.empty():
                    received, packet = self.outgoing.get_nowait()
                    if now - received <= 0.25:
                        pending, expires = packet, received + 0.25
                        break
            from_microphone = bool(pending)
            frame = pending[:FRAME_BYTES] if pending else SILENCE
            pending = pending[FRAME_BYTES:]
            if self._writer is None:
                raise AudioError("audio_connection_lost")
            async with asyncio.timeout(WRITE_TIMEOUT):
                self._check_source("microphone_send")
                self._writer.write(frame)
                await self._writer.drain()
                self._check_source("microphone_send")
            self.sent_bytes += len(frame)
            if from_microphone:
                self.microphone_bytes += len(frame)
                self.microphone_signal_bytes += sum(byte not in (0x7F, 0xFF) for byte in frame)
            deadline += 0.02
            now = time.monotonic()
            if now - deadline > 0.1:
                deadline = now
                pending = b""
            await asyncio.sleep(max(0, deadline - now))

    def send(self, packet: bytes) -> None:
        self._check_source("microphone_send")
        if self._closed or self.failure or self.session_id is None:
            raise AudioError("audio_connection_lost")
        if not isinstance(packet, bytes) or len(packet) != PACKET_BYTES:
            raise AudioError("audio_invalid_packet")
        now = time.monotonic()
        self._credit = min(2.0, self._credit + (now - self._last_send) * 10)
        self._last_send = now
        if self._credit < 1 or self.outgoing.full():
            raise AudioError("audio_backpressure")
        self._credit -= 1
        self.outgoing.put_nowait((now, packet))

    async def receive(self) -> bytes:
        self._check_source("audio_receive")
        if self._closed or self.failure:
            raise AudioError("audio_connection_lost")
        try:
            async with asyncio.timeout(2):
                while True:
                    received, packet = await self.incoming.get()
                    self._check_source("audio_receive")
                    if self._closed or self.failure:
                        raise AudioError("audio_connection_lost")
                    if time.monotonic() - received <= MAX_PACKET_AGE:
                        return packet
                    self.dropped_packets += 1
        except TimeoutError:
            return b""

    def mute(self) -> None:
        self._mute_epoch += 1
        while not self.outgoing.empty():
            self.outgoing.get_nowait()
        # The next 20 ms frame observes the new mute epoch.

    async def close(self) -> None:
        feature = _FEATURE_AUDIO.get(self)
        lock = feature.lock if feature is not None else self._close_lock
        async with lock:
            if feature.closed[0] if feature is not None else self._closed:
                return
            self._closed = True
            if feature is not None:
                feature.closed[0] = True
            tasks = tuple(feature.tasks if feature is not None else self._tasks)
            for task in tasks:
                task.cancel()
            await asyncio.gather(*tasks, return_exceptions=True)
            writer = feature.upload[1] if feature is not None else self._writer
            if writer:
                # Stop drops queued microphone frames instead of flushing old speech.
                # Bytes already accepted by the peer cannot be recalled.
                writer.transport.abort()
                with contextlib.suppress(Exception):
                    async with asyncio.timeout(2):
                        await writer.wait_closed()
            http = feature.origin[6] if feature is not None else self.http
            control = feature.origin[5] if feature is not None else self.control
            session_id = feature.session_id[0] if feature is not None else self.session_id
            await http.aclose()
            if session_id is not None:
                try:
                    # A replaced device must never receive a stale session's close.
                    self._check_source(cleanup=True)
                    path = CHANNEL + "/close?sessionId=" + quote(session_id, safe="")
                    rules = (
                        self._rule(control, "GET", "/ISAPI/System/deviceInfo"),
                        self._rule(control, "PUT", path),
                    )
                    with self._scope(control, rules, cleanup=True):
                        async with asyncio.timeout(8):
                            await control.async_confirm_identity()
                            self._check_source(cleanup=True)
                            payload = parse_payload(
                                await control._request("PUT", path, deadline=5)
                            ).data
                    root = payload.get("ResponseStatus", {})
                    self.close_confirmed = isinstance(root, dict) and root.get("statusCode") in (
                        "0",
                        "1",
                        0,
                        1,
                    )
                except Exception:
                    self.close_confirmed = False
                if feature is not None:
                    feature.closed[1] = self.close_confirmed
                _NATIVE_AUDIO_STATE[self][1] = self.close_confirmed
            self.mute()
            while not self.incoming.empty():
                self.incoming.get_nowait()
