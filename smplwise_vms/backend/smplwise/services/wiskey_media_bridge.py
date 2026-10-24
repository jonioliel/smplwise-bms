"""W10CLIENT-295: the transport of WisKey's W10 station media - signed bridge commands over a Home Assistant WebSocket, behind an interface.

Owner decision 24.10: Arx gets no new Home Assistant user for W10 and, in the end, talks to WisKey through a direct API of its own.
Until that API is published the only shape WisKey has is its signed bridge: every one of the six `hikvision_intercom/media/*`
commands (the `talk_frame` batches too) travels as `{id, type, bridge}` with a closed `bridge` object signed by the pairing key. So
the client is built behind two small interfaces and the media code (services/intercom_media.py) knows only these:

    MediaTransport.connect(purpose) -> MediaLink        one connection per purpose ("video": shared; "talk": one per talk)
    MediaLink.call(command, parameters, timeout=) -> result dict   one request, one answer, never retried here

Implementations:
- `SignedBridgeTransport` + `SignedBridgeLink`: the signed bridge over a `RawConnection` (`HaWsConnection` is the real one, a thin
  adapter over `ha_client.ws_session`; tests use scripted fakes). Signing is the EXISTING pairing recipe (`ha_bridge.sign`),
  byte for byte; nothing here invents a second one.
- `DirectApiTransport`: a placeholder for the direct API WisKey will publish. It carries NO wire: `connect` refuses with
  `direct_api_not_published`. When the API exists, only this class changes.

Why one connection per purpose (WisKey's code, read - not run): a descriptor is owned by the connection it was read on, and its lease
and talk must come from the same connection and the same actor; a talk is cancelled with its connection and a second talk on a
connection is refused (`audio_busy`). Hence: ONE shared "video" connection (descriptor + lease, actor `Arx`) and ONE dedicated
connection per talk (descriptor, `talk_open`, floor, frames, close - one actor, the operator).

Rules: a reply is untrusted input (`verify_result` is total and never carries the offending value), a failed or doubtful request is
never retried (a signed request spends a single-use nonce; a batch of audio must never replay), the pairing key and the lease
`source` are never logged, repr'd or put into an error.
"""
from __future__ import annotations

import asyncio
import json
import logging
import re
import threading
import time
from collections.abc import Awaitable, Callable
from datetime import datetime, timezone
from typing import Any, Protocol

from . import wiskey_media_contract as w10

log = logging.getLogger("smplwise.intercom.media.bridge")

KIND = "wiskey-bridge-command.v1"
TYPE_PREFIX = "hikvision_intercom/"
WINDOW_S = 10  # a command is valid for this many seconds (WisKey accepts 0 < window <= 15)
MAX_WINDOW_S = 15
MAX_SIGNED_BYTES = 1_048_576  # WisKey's canonical-body ceiling
MAX_RESULT_BYTES = 256 * 1024
PURPOSE_VIDEO = "video"
PURPOSE_TALK = "talk"
ERROR_CODE_RE = re.compile(r"^[A-Za-z][A-Za-z0-9_]{0,63}$")


class MediaBridgeError(Exception):
    """A request that did not succeed. `code` is WisKey's error code (or a local rule code), safe to log and serve; no value, no
    message text of the other side. `outcome`: `refused` (WisKey answered no), `unknown` (no answer in time: the effect is unknown,
    nothing is retried) or `closed` (the connection is gone)."""

    def __init__(self, code: str, outcome: str = "refused") -> None:
        super().__init__(code)
        self.code = code
        self.outcome = outcome


# ---------------------------------------------------------------- signing

def _strict(value: Any, depth: int = 0) -> None:
    """The types WisKey's canonical body accepts: str / bool / int / None, lists and string-keyed dicts - no float, no NaN."""
    if depth > 8:
        raise MediaBridgeError("proof_invalid")
    if value is None or type(value) in (str, bool, int):
        return
    if type(value) is list:
        for item in value:
            _strict(item, depth + 1)
        return
    if type(value) is dict and all(type(k) is str for k in value):
        for item in value.values():
            _strict(item, depth + 1)
        return
    raise MediaBridgeError("proof_invalid")


def _iso(epoch: int) -> str:
    return datetime.fromtimestamp(epoch, timezone.utc).isoformat(timespec="seconds")


class BridgeSigner:
    """Builds the closed `bridge` object of one command and signs it with the pairing key (`ha_bridge.sign`, the existing recipe:
    canonical JSON of the body, HMAC-SHA256 over `ts.nonce.sha256(body)`). `key_provider()` returns the key at the moment of signing
    (a plain secret or `ha_bridge.BridgeKey`); it is never stored, logged or repr'd here.

    A rotated key (a `BridgeKey` whose kid is not the legacy one) is REFUSED, not signed: it would add a `kid` to the wire, which
    WisKey's closed key set rejects (decision pending on WisKey's side)."""

    def __init__(self, key_provider: Callable[[], Any], *, clock: Callable[[], float] = time.time) -> None:
        self._key_provider = key_provider
        self._clock = clock

    def __repr__(self) -> str:
        return "BridgeSigner()"

    def _key(self) -> str:
        from . import bridge_keys as bk
        from . import ha_bridge

        try:
            key = self._key_provider()
        except Exception:  # noqa: BLE001 - an unreadable key set is "not paired"
            key = None
        if not key:
            raise MediaBridgeError("bridge_not_paired")
        if isinstance(key, ha_bridge.BridgeKey) and key.kid != bk.LEGACY_KID:
            raise MediaBridgeError("bridge_key_rotated")
        return str(key)

    def proof(self, command: str, query_owner_id: str, parameters: dict[str, Any], *, window_s: int = WINDOW_S, nonce: str | None = None) -> dict[str, Any]:
        """The `bridge` object: kind, command, query_owner_id, issued_at, expires_at, parameters, ts, nonce, sig."""
        from . import ha_bridge

        if command not in w10.COMMANDS:
            raise MediaBridgeError("unknown_command")
        if not isinstance(query_owner_id, str) or not 1 <= len(query_owner_id) <= 128:
            raise MediaBridgeError("proof_invalid")
        if not 0 < window_s <= MAX_WINDOW_S:
            raise MediaBridgeError("proof_invalid")
        try:
            w10.validate_parameters(command, parameters)
        except w10.ContractError as exc:
            raise MediaBridgeError(exc.code) from None
        _strict(parameters)
        now = int(self._clock())
        body = {"kind": KIND, "command": command, "query_owner_id": query_owner_id, "issued_at": _iso(now),
                "expires_at": _iso(now + window_s), "parameters": parameters}
        signed = ha_bridge.sign(self._key(), body, ts=now, nonce=nonce)
        if len(json.dumps(signed, separators=(",", ":"), ensure_ascii=False).encode("utf-8")) > MAX_SIGNED_BYTES:
            raise MediaBridgeError("proof_invalid")
        return signed


def verify_result(message: Any) -> dict[str, Any]:
    """The answer to one command, total: `{id, type: "result", success: true, [bridge_schema], result: {...}}` -> `result`.
    A refusal `{success: false, error: {code, ...}}` -> `MediaBridgeError(code)` (WisKey's text is dropped). Any other shape is
    `invalid_response`. `bridge_schema`, when present, must be the bridge kind (its presence is not proven)."""
    if not isinstance(message, dict) or message.get("type") != "result" or not isinstance(message.get("success"), bool):
        raise MediaBridgeError("invalid_response")
    if message["success"] is False:
        error = message.get("error")
        code = error.get("code") if isinstance(error, dict) else None
        raise MediaBridgeError(code if isinstance(code, str) and ERROR_CODE_RE.fullmatch(code) else "provider_error")
    schema = message.get("bridge_schema")
    if schema is not None and schema != KIND:
        raise MediaBridgeError("invalid_response")
    result = message.get("result")
    if not isinstance(result, dict):
        raise MediaBridgeError("invalid_response")
    try:
        if len(json.dumps(result, separators=(",", ":"))) > MAX_RESULT_BYTES:
            raise MediaBridgeError("invalid_response")
    except (TypeError, ValueError):
        raise MediaBridgeError("invalid_response") from None
    return result


# ---------------------------------------------------------------- the interfaces

class MediaLink(Protocol):
    """One connection to WisKey's media commands. Every call is one request and one answer; nothing is retried."""

    purpose: str
    generation: int

    @property
    def closed(self) -> bool: ...

    async def call(self, command: str, parameters: dict[str, Any], *, timeout: float) -> dict[str, Any]: ...

    def set_event_handler(self, handler: Callable[[dict[str, Any]], None] | None) -> None: ...

    def set_closed_handler(self, handler: Callable[[], None] | None) -> None: ...

    async def close(self) -> None: ...


class MediaTransport(Protocol):
    kind: str

    async def connect(self, purpose: str) -> MediaLink: ...


class RawConnection(Protocol):
    """A Home Assistant WebSocket the signed bridge rides on (the real one is `HaWsConnection`; tests script it)."""

    user_id: str  # the Home Assistant user of this connection: the signed `query_owner_id`

    @property
    def closed(self) -> bool: ...

    async def send(self, msg_type: str, **payload: Any) -> dict[str, Any]: ...

    def set_event_handler(self, handler: Callable[[dict[str, Any]], None] | None) -> None: ...

    def set_closed_handler(self, handler: Callable[[], None] | None) -> None: ...

    async def close(self) -> None: ...


class SignedBridgeLink:
    """`MediaLink` over a `RawConnection`: each call is signed afresh (new ts, nonce, window) and sent as `{id, type, bridge}`."""

    def __init__(self, raw: RawConnection, signer: BridgeSigner, purpose: str, generation: int) -> None:
        self.raw = raw
        self.signer = signer
        self.purpose = purpose
        self.generation = generation

    def __repr__(self) -> str:
        return f"SignedBridgeLink(purpose={self.purpose!r}, generation={self.generation}, closed={self.closed})"

    @property
    def closed(self) -> bool:
        return self.raw.closed

    async def call(self, command: str, parameters: dict[str, Any], *, timeout: float) -> dict[str, Any]:
        if self.raw.closed:
            raise MediaBridgeError("connection_closed", "closed")
        proof = self.signer.proof(command, self.raw.user_id, parameters)
        try:
            message = await asyncio.wait_for(self.raw.send(TYPE_PREFIX + command, bridge=proof), timeout)
        except asyncio.TimeoutError:
            raise MediaBridgeError("media_outcome_unknown", "unknown") from None
        except (asyncio.CancelledError, MediaBridgeError):
            raise
        except Exception as exc:  # noqa: BLE001 - a dead socket: the outcome of THIS request is unknown, the connection is gone
            log.info("station media: bridge connection failed (%s)", type(exc).__name__)
            raise MediaBridgeError("connection_closed", "closed") from None
        return verify_result(message)

    def set_event_handler(self, handler: Callable[[dict[str, Any]], None] | None) -> None:
        self.raw.set_event_handler(handler)

    def set_closed_handler(self, handler: Callable[[], None] | None) -> None:
        self.raw.set_closed_handler(handler)

    async def close(self) -> None:
        await self.raw.close()


class SignedBridgeTransport:
    """The signed-bridge implementation of `MediaTransport`. `connector(purpose)` opens a `RawConnection`."""

    kind = "signed_bridge_ws"

    def __init__(self, connector: Callable[[str], Awaitable[RawConnection]], signer: BridgeSigner) -> None:
        self._connector = connector
        self._signer = signer
        self._generation = 0
        self._lock = threading.Lock()

    async def connect(self, purpose: str) -> MediaLink:
        if purpose not in (PURPOSE_VIDEO, PURPOSE_TALK):
            raise MediaBridgeError("purpose_invalid")
        raw = await self._connector(purpose)
        with self._lock:
            self._generation += 1
            generation = self._generation
        return SignedBridgeLink(raw, self._signer, purpose, generation)


class DirectApiTransport:
    """PLACEHOLDER for the direct Arx <-> WisKey API (owner decision 24.10: no new Home Assistant user; the two systems talk through an
    API of their own). WisKey has not published it, so this class has no wire and invents none: it refuses to connect. The media code
    depends only on `MediaTransport`, so the day the contract exists this is the one class that grows an implementation."""

    kind = "direct_api"

    async def connect(self, purpose: str) -> MediaLink:
        raise MediaBridgeError("direct_api_not_published")


# ---------------------------------------------------------------- the real Home Assistant connection

class HaWsConnection:
    """A `RawConnection` over `ha_client.ws_session` (the service channel by default; `url`/`token` for another identity, which this
    module never chooses - the identity decision is the owner's). Frames: `send` returns the whole `result` message; the integration's
    events are handed to the event handler. The connection's Home Assistant user comes from the standard `auth/current_user` command.
    NOT exercised against a real Home Assistant yet (tests script `ws_session`)."""

    CURRENT_USER = "auth/current_user"

    def __init__(self) -> None:
        self.user_id = ""
        self._call: Callable[..., Awaitable[dict[str, Any]]] | None = None
        self._stop = asyncio.Event()
        self._task: asyncio.Task[None] | None = None
        self._closed = False
        self._event_handler: Callable[[dict[str, Any]], None] | None = None
        self._closed_handler: Callable[[], None] | None = None

    @property
    def closed(self) -> bool:
        return self._closed

    def __repr__(self) -> str:  # never a token, a url or a user id
        return f"HaWsConnection(closed={self._closed})"

    @classmethod
    async def open(cls, settings: Any, *, url: str | None = None, token: str | None = None, internal_tls: bool = False, connect_timeout: float = 15.0) -> "HaWsConnection":
        from . import ha_client

        self = cls()
        ready: asyncio.Future[None] = asyncio.get_running_loop().create_future()

        async def on_ready(call: Callable[..., Awaitable[dict[str, Any]]]) -> None:
            self._call = call
            if not ready.done():
                ready.set_result(None)

        async def run() -> None:
            try:
                await ha_client.ws_session(settings, on_ready, lambda _data: None, self._stop, self._on_frame, url=url, token=token, internal_tls=internal_tls)
            except asyncio.CancelledError:
                raise
            except Exception as exc:  # noqa: BLE001 - the reason is the exception type only (the url and the token never)
                log.info("station media: Home Assistant socket ended (%s)", type(exc).__name__)
                if not ready.done():
                    ready.set_exception(MediaBridgeError("connection_failed", "closed"))
            finally:
                self._mark_closed()
                if not ready.done():
                    ready.set_exception(MediaBridgeError("connection_failed", "closed"))

        self._task = asyncio.get_running_loop().create_task(run())
        try:
            await asyncio.wait_for(asyncio.shield(ready), connect_timeout)
            reply = await asyncio.wait_for(self._call(cls.CURRENT_USER), 10)  # type: ignore[misc]
            user = (reply.get("result") if isinstance(reply, dict) else None) or {}
            user_id = user.get("id") if isinstance(user, dict) else None
            if not isinstance(user_id, str) or not 1 <= len(user_id) <= 128:
                raise MediaBridgeError("connection_failed", "closed")
            self.user_id = user_id
        except BaseException as exc:
            await self.close()
            if isinstance(exc, (asyncio.CancelledError, MediaBridgeError)):
                raise
            raise MediaBridgeError("connection_failed", "closed") from None
        return self

    def _on_frame(self, frame: dict[str, Any]) -> None:
        handler = self._event_handler
        event = frame.get("event") if isinstance(frame, dict) else None
        if handler is not None and isinstance(event, dict):
            try:
                handler(event)
            except Exception:  # noqa: BLE001 - an event handler never breaks the socket's reader
                log.warning("station media: an event handler failed")

    def _mark_closed(self) -> None:
        if self._closed:
            return
        self._closed = True
        handler, self._closed_handler = self._closed_handler, None
        if handler is not None:
            try:
                handler()
            except Exception:  # noqa: BLE001
                log.warning("station media: a close handler failed")

    async def send(self, msg_type: str, **payload: Any) -> dict[str, Any]:
        if self._closed or self._call is None:
            raise ConnectionError("closed")
        return await self._call(msg_type, **payload)

    def set_event_handler(self, handler: Callable[[dict[str, Any]], None] | None) -> None:
        self._event_handler = handler

    def set_closed_handler(self, handler: Callable[[], None] | None) -> None:
        self._closed_handler = handler
        if handler is not None and self._closed:
            self._closed_handler = None
            handler()

    async def close(self) -> None:
        self._stop.set()
        task = self._task
        if task is not None and not task.done():
            try:
                await asyncio.wait_for(asyncio.shield(task), 3)
            except (asyncio.TimeoutError, asyncio.CancelledError, Exception):  # noqa: BLE001
                task.cancel()
        self._mark_closed()


def ha_connector(settings: Any, *, url: str | None = None, token: str | None = None, internal_tls: bool = False) -> Callable[[str], Awaitable[RawConnection]]:
    async def connect(_purpose: str) -> RawConnection:
        return await HaWsConnection.open(settings, url=url, token=token, internal_tls=internal_tls)

    return connect


# ---------------------------------------------------------------- a loop thread for the synchronous callers (video)

class LoopThread:
    """A private event loop on a daemon thread: the synchronous provider calls (`describe`, `video_stream`) run their coroutines here,
    so the shared video connection lives on one loop whatever thread asks. Started on first use; `stop()` ends it."""

    def __init__(self) -> None:
        self._lock = threading.Lock()
        self._loop: asyncio.AbstractEventLoop | None = None
        self._thread: threading.Thread | None = None

    def _ensure(self) -> asyncio.AbstractEventLoop:
        with self._lock:
            if self._loop is None or self._loop.is_closed():
                loop = asyncio.new_event_loop()
                thread = threading.Thread(target=loop.run_forever, name="wiskey-media-bridge", daemon=True)
                thread.start()
                self._loop, self._thread = loop, thread
            return self._loop

    def run(self, coro: Awaitable[Any], timeout: float) -> Any:
        future = asyncio.run_coroutine_threadsafe(coro, self._ensure())  # type: ignore[arg-type]
        try:
            return future.result(timeout)
        except TimeoutError:
            future.cancel()
            raise MediaBridgeError("media_outcome_unknown", "unknown") from None

    def stop(self) -> None:
        with self._lock:
            loop, thread = self._loop, self._thread
            self._loop = self._thread = None
        if loop is not None:
            loop.call_soon_threadsafe(loop.stop)
            if thread is not None:
                thread.join(timeout=5)
            loop.close()


class VideoChannel:
    """The shared "video" connection: the descriptor and the lease, both as the same actor (`Arx`), on the same connection. It is
    opened on first use and reopened after it dropped. A descriptor read on an earlier connection is no longer valid on a new one:
    the lease then fails with `Unauthorized` or `session_expired` and the caller asks for a fresh descriptor (once)."""

    CALL_TIMEOUT_S = 10.0

    def __init__(self, transport: MediaTransport, runner: LoopThread | None = None) -> None:
        self.transport = transport
        self.runner = runner or LoopThread()
        self._link: MediaLink | None = None
        self._connect_lock: asyncio.Lock | None = None

    async def _get(self) -> MediaLink:
        if self._connect_lock is None:
            self._connect_lock = asyncio.Lock()
        async with self._connect_lock:
            link = self._link
            if link is None or link.closed:
                self._link = link = await self.transport.connect(PURPOSE_VIDEO)
            return link

    async def _call(self, command: str, parameters: dict[str, Any]) -> dict[str, Any]:
        link = await self._get()
        try:
            return await link.call(command, parameters, timeout=self.CALL_TIMEOUT_S)
        except MediaBridgeError as exc:
            if exc.outcome == "closed" and self._link is link:
                self._link = None  # the next call opens a new connection; nothing is retried here
            raise

    def describe(self, station_id: str, actor: w10.Actor, request_id: str) -> dict[str, Any]:
        return self.runner.run(self._call(w10.DESCRIBE, w10.descriptor_params(station_id, actor, request_id)), self.CALL_TIMEOUT_S + 15)

    def lease(self, session: str, actor: w10.Actor, request_id: str) -> dict[str, Any]:
        return self.runner.run(self._call(w10.STREAM_LEASE, w10.lease_params(session, actor, request_id)), self.CALL_TIMEOUT_S + 15)

    def close(self) -> None:
        link, self._link = self._link, None
        if link is not None:
            try:
                self.runner.run(link.close(), 10)
            except Exception:  # noqa: BLE001
                pass
        self.runner.stop()
