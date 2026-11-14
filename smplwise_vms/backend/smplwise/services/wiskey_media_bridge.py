"""W10CLIENT-295 / WKDIRECT-295: the transport of WisKey's W10 station media - signed bridge commands, behind an interface.

Owner decision 24.10: Arx gets no new Home Assistant user for W10 and talks to WisKey through a direct API. WisKey published it
(DIRECT_API_V1.md): an anonymous WebSocket authenticated by the pairing key, whose every server frame is MAC-wrapped. Every one of the
six `hikvision_intercom/media/*` commands (the `talk_frame` batches too) travels as `{id, type, bridge}` with a closed `bridge` object
signed by the pairing key, on either transport. The media code (services/intercom_media.py) knows only these two interfaces:

    MediaTransport.connect(purpose) -> MediaLink        one connection per purpose ("video": shared; "talk": one per talk)
    MediaLink.call(command, parameters, timeout=) -> result dict   one request, one answer, never retried here

Implementations:
- `SignedBridgeTransport` + `SignedBridgeLink`: the signed bridge over a `RawConnection` (`HaWsConnection` is the real one, a thin
  adapter over `ha_client.ws_session`; tests use scripted fakes). Signing is the EXISTING pairing recipe (`ha_bridge.sign`),
  byte for byte; nothing here invents a second one.
- `DirectApiTransport` + `DirectLink` (WKDIRECT-295): the direct API - hello, signed `direct/connect` over the challenge, the
  server-issued service subject (`arx-service:<entry>`, never a Home Assistant user) as `query_owner_id`, every reply's MAC and
  connection_ref verified before it is read, results correlated by id, `talk_closed` only on the id of its `talk_open`.
- `AutoTransport`: `auto` picks the direct API when the key signs and the direct socket authenticates, else the signed bridge over
  the Home Assistant WebSocket (selection rule in its docstring). Neither path is unsigned.

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
import hashlib
import hmac
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
# WKINT-295: the one generic command connection of services/wiskey_direct_join.py (people writes, capture lease, features, templates).
# Only DirectApiTransport accepts it; the media code never asks for it.
PURPOSE_COMMAND = "command"
PEER_QUERY_KIND = "wiskey-peer-query.v1"  # DIRECT_API_V1.md: peer query commands keep the existing signed peer-query envelope
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

    def ready(self) -> bool:
        """Whether a command could be signed now (a key that is present, readable and not rotated). Sends nothing."""
        try:
            self._key()
        except MediaBridgeError:
            return False
        return True

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


    def command_proof(self, command: str, query_owner_id: str, parameters: dict[str, Any], *,
                      kind: str = KIND, window_s: int = WINDOW_S) -> dict[str, Any]:
        """Original generic command encoder, shared by direct and Native metadata reads."""
        from . import ha_bridge
        if (kind not in (KIND, PEER_QUERY_KIND) or not isinstance(command, str)
                or command.startswith(TYPE_PREFIX) or not _PRINTABLE_RE.fullmatch(command)
                or not isinstance(query_owner_id, str) or not 1 <= len(query_owner_id) <= 128
                or type(window_s) is not int or not 0 < window_s <= MAX_WINDOW_S
                or not isinstance(parameters, dict)):
            raise MediaBridgeError("proof_invalid", "not_sent")
        _strict_ns(parameters)
        now = int(self._clock())
        body = {"kind": kind, "command": command, "query_owner_id": query_owner_id,
                "issued_at": _iso(now), "expires_at": _iso(now + window_s), "parameters": parameters}
        try:
            return ha_bridge.sign(self._key(), body, ts=now)
        except MediaBridgeError as exc:
            raise MediaBridgeError(exc.code, "not_sent") from None


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


def _strict_ns(value: Any) -> None:
    """`_strict` for a generic command: a value WisKey's canonical body refuses is refused here, before anything is written."""
    try:
        _strict(value)
    except MediaBridgeError as exc:
        raise MediaBridgeError(exc.code, "not_sent") from None


def verify_command_result(message: Any, kind: str = KIND) -> dict[str, Any]:
    """WKINT-295: the answer to one generic command (an already MAC-verified, id-correlated frame) -> its `result`. A verified
    `{success: false, error: {code}}` is `refused` with WisKey's code (a code outside the closed alphabet is `provider_error`); any
    other shape - and a `bridge_schema` naming another envelope than the one sent - is `invalid_response`, outcome `unknown`."""
    if not isinstance(message, dict) or message.get("type") != "result" or not isinstance(message.get("success"), bool):
        raise MediaBridgeError("invalid_response", "unknown")
    if message["success"] is False:
        error = message.get("error")
        code = error.get("code") if isinstance(error, dict) else None
        raise MediaBridgeError(code if isinstance(code, str) and ERROR_CODE_RE.fullmatch(code) else "provider_error", "refused")
    schema = message.get("bridge_schema")
    if schema is not None and schema != kind:
        raise MediaBridgeError("invalid_response", "unknown")
    result = message.get("result")
    if not isinstance(result, dict):
        raise MediaBridgeError("invalid_response", "unknown")
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
        channel = getattr(raw, "media_channel", None)
        self.raw = channel() if channel is not None else raw
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


# ---------------------------------------------------------------- the direct API (WKDIRECT-295, WisKey DIRECT_API_V1.md)
#
# `GET /api/hikvision_intercom/arx_bridge/v1/ws` upgrades to a WebSocket with NO Home Assistant token, user, admin or panel. The
# server greets with `{type: "hello", protocol: "wiskey-direct-ws.v1", challenge: <32 hex>}`; within 10 s Arx sends
# `{id: 1, type: "hikvision_intercom/direct/connect", bridge: <wiskey-direct-connect.v1 body, query_owner_id "pairing",
# parameters {challenge}, signed with the pairing key by the existing recipe>}`. Every frame the server sends after the hello is
# `{kind: "wiskey-direct-reply.v1", connection_ref, frame, sig}`, sig = HMAC-SHA256(pairing, "wiskey-direct-reply.v1." +
# canonical({connection_ref, frame})); connection_ref is the server's challenge. The connect result names the server-issued service
# subject (`arx-service:<entry>`, never a Home Assistant user), `principal_kind: "pairing_service"`, the connection_ref, the protocol
# and the repository id. Every later command is the existing signed `wiskey-bridge-command.v1` envelope with that query_owner_id.

DIRECT_PATH = "/api/hikvision_intercom/arx_bridge/v1/ws"
DIRECT_PROTOCOL = "wiskey-direct-ws.v1"
DIRECT_CONNECT_KIND = "wiskey-direct-connect.v1"
DIRECT_CONNECT_COMMAND = "direct/connect"
DIRECT_CONNECT_OWNER = "pairing"
DIRECT_REPLY_KIND = "wiskey-direct-reply.v1"
DIRECT_PRINCIPAL_KIND = "pairing_service"
DIRECT_SERVICE_PREFIX = "arx-service:"
DIRECT_MAX_FRAME_BYTES = 1_048_576  # WisKey's input-frame maximum (and what Arx accepts back)
DIRECT_MAX_CONNECT_BYTES = 65_536
DIRECT_MAX_PENDING = 64  # WisKey's pending outgoing frames per connection: Arx never has more requests in flight
DIRECT_MAX_ID = 2**53 - 1
CHALLENGE_RE = re.compile(r"^[0-9a-f]{32}$")
SIG_RE = re.compile(r"^[0-9a-f]{64}$")
_PRINTABLE_RE = re.compile(r"^[^\x00-\x1f\x7f]{1,128}$")


def canonical_json(value: Any) -> bytes:
    """WisKey's canonical JSON: sorted keys, compact separators, UTF-8, `ensure_ascii=False`, no NaN/Infinity. Used for the signed command
    bodies (through `ha_bridge.sign`, after `_strict` refused floats) and for the reply MAC (whose frames may carry finite floats, as
    WisKey's own wire codec keeps them: the parsed tree keeps Python's int/float types, so its re-encoding is WisKey's spelling)."""
    return json.dumps(value, sort_keys=True, separators=(",", ":"), ensure_ascii=False, allow_nan=False).encode("utf-8")


def _key_text(key: Any) -> str:
    """The pairing material of a signing key (a plain secret or a legacy `BridgeKey`); a rotated key never signs here."""
    from . import bridge_keys as bk
    from . import ha_bridge

    if not key:
        raise MediaBridgeError("bridge_not_paired")
    if isinstance(key, ha_bridge.BridgeKey) and key.kid != bk.LEGACY_KID:
        raise MediaBridgeError("bridge_key_rotated")
    return str(key)


def connect_body(challenge: str, now: int, *, window_s: int = WINDOW_S) -> dict[str, Any]:
    """The exact six-field `direct/connect` body (before ts/nonce/sig)."""
    if not isinstance(challenge, str) or not CHALLENGE_RE.fullmatch(challenge) or not 0 < window_s <= MAX_WINDOW_S:
        raise MediaBridgeError("proof_invalid")
    return {"kind": DIRECT_CONNECT_KIND, "command": DIRECT_CONNECT_COMMAND, "query_owner_id": DIRECT_CONNECT_OWNER,
            "issued_at": _iso(now), "expires_at": _iso(now + window_s), "parameters": {"challenge": challenge}}


def sign_connect(key: Any, challenge: str, *, now: int, nonce: str | None = None, window_s: int = WINDOW_S) -> dict[str, Any]:
    """The signed `bridge` object of `direct/connect` - the existing recipe (`ha_bridge.sign`), nothing new: HMAC-SHA256 with the UTF-8
    pairing code over UTF-8 `ts.nonce.sha256(canonical(body)).hexdigest()`."""
    from . import ha_bridge

    body = connect_body(challenge, int(now), window_s=window_s)
    _strict(body)
    return ha_bridge.sign(_key_text(key), body, ts=int(now), nonce=nonce)


def reply_mac(key: Any, connection_ref: str, frame: Any) -> str:
    """WisKey's reply signature: HMAC-SHA256(pairing, UTF-8 "wiskey-direct-reply.v1." + canonical({connection_ref, frame}))."""
    payload = DIRECT_REPLY_KIND.encode("utf-8") + b"." + canonical_json({"connection_ref": connection_ref, "frame": frame})
    return hmac.new(_key_text(key).encode("utf-8"), payload, hashlib.sha256).hexdigest()


def open_reply(key: Any, connection_ref: str, message: Any) -> dict[str, Any]:
    """The `frame` of one `wiskey-direct-reply.v1` message, ONLY after its MAC and its connection_ref are verified; nothing of the frame
    is read before. Any other shape, a foreign connection_ref or a wrong MAC is `reply_unauthenticated` (a marker alone proves nothing)."""
    if (not isinstance(message, dict) or set(message) != {"kind", "connection_ref", "frame", "sig"} or message["kind"] != DIRECT_REPLY_KIND
            or not isinstance(message["connection_ref"], str) or not isinstance(message["sig"], str) or not SIG_RE.fullmatch(message["sig"])):
        raise MediaBridgeError("reply_unauthenticated")
    if not hmac.compare_digest(message["connection_ref"].encode("utf-8"), connection_ref.encode("utf-8")):
        raise MediaBridgeError("reply_unauthenticated")
    try:
        expected = reply_mac(key, connection_ref, message["frame"])
    except (TypeError, ValueError):
        raise MediaBridgeError("reply_unauthenticated") from None
    if not hmac.compare_digest(expected, message["sig"]):
        raise MediaBridgeError("reply_unauthenticated")
    frame = message["frame"]
    if not isinstance(frame, dict) or type(frame.get("id")) is not int or frame.get("type") not in ("result", "event"):
        raise MediaBridgeError("invalid_response")
    return frame


def read_identity(result: dict[str, Any], challenge: str) -> dict[str, Any]:
    """The connect result: exactly protocol, query_owner_id (`arx-service:<entry>`), principal_kind `pairing_service`, connection_ref (=
    the challenge) and repository_id (a string, or null when WisKey has no peer registry). Anything else refuses the connection."""
    if set(result) != {"protocol", "query_owner_id", "principal_kind", "connection_ref", "repository_id"}:
        raise MediaBridgeError("direct_identity_invalid")
    owner, repo = result["query_owner_id"], result["repository_id"]
    if (result["protocol"] != DIRECT_PROTOCOL or result["principal_kind"] != DIRECT_PRINCIPAL_KIND or result["connection_ref"] != challenge
            or not isinstance(owner, str) or not owner.startswith(DIRECT_SERVICE_PREFIX) or not _PRINTABLE_RE.fullmatch(owner)
            or len(owner) <= len(DIRECT_SERVICE_PREFIX) or not (repo is None or (isinstance(repo, str) and _PRINTABLE_RE.fullmatch(repo)))):
        raise MediaBridgeError("direct_identity_invalid")
    return {"query_owner_id": owner, "repository_id": repo, "connection_ref": challenge, "principal_kind": DIRECT_PRINCIPAL_KIND}


class DirectSocket(Protocol):
    """One text WebSocket (the real one is `websockets`' client connection; tests use an in-memory pair)."""

    async def recv(self) -> str | bytes: ...

    async def send(self, text: str) -> None: ...

    async def close(self) -> None: ...


def _load(raw: Any, limit: int) -> Any:
    if isinstance(raw, bytes):  # the direct socket is a text protocol: a binary frame is not a WisKey frame
        raise MediaBridgeError("invalid_response")
    if not isinstance(raw, str) or len(raw.encode("utf-8")) > limit:
        raise MediaBridgeError("invalid_response")
    try:
        return json.loads(raw)
    except ValueError:
        raise MediaBridgeError("invalid_response") from None


class DirectLink:
    """`MediaLink` over one authenticated direct socket. One reader task verifies EVERY frame (`open_reply`) before anything reads it:
    a result is handed to the request whose id it names (ids strictly increasing from 2 on this connection; an id nobody waits for is
    dropped), an event is delivered only when its id is a `talk_open` this connection opened (WisKey's `talk_closed` reuses that id). A
    frame that fails verification closes the connection: requests in flight end `reply_unauthenticated` with outcome `unknown` (they
    were sent; nothing is retried). The pairing key lives in this object for the MAC only, never in repr, a log or an error."""

    def __init__(self, socket: DirectSocket, key: Any, identity: dict[str, Any], purpose: str, generation: int, *,
                 clock: Callable[[], float] = time.time, window_s: int = WINDOW_S) -> None:
        self._socket = socket
        self._window_s = window_s
        self._key = key
        self.signer = BridgeSigner(lambda: key, clock=clock)
        self.query_owner_id: str = identity["query_owner_id"]
        self.repository_id: str | None = identity["repository_id"]
        self.connection_ref: str = identity["connection_ref"]
        self.principal_kind: str = identity["principal_kind"]
        self.purpose = purpose
        self.generation = generation
        self._next_id = 2  # 1 was `direct/connect`
        self._pending: dict[int, tuple[str, asyncio.Future[dict[str, Any]]]] = {}
        self._event_ids: set[int] = set()
        self._active_media_id: int | None = None
        self._send_lock = asyncio.Lock()
        self._closed = False
        self._event_handler: Callable[[dict[str, Any]], None] | None = None
        self._closed_handler: Callable[[], None] | None = None
        self._reader: asyncio.Task[None] | None = None
        self.close_code: str | None = None
        self.dropped_frames = 0  # verified frames nobody waited for (counters only, never content)

    def __repr__(self) -> str:  # never the key, the connection_ref or the service subject
        return f"DirectLink(purpose={self.purpose!r}, generation={self.generation}, closed={self._closed})"

    @property
    def closed(self) -> bool:
        return self._closed

    @property
    def event_ids(self) -> frozenset[int]:
        return frozenset(self._event_ids)

    def start(self) -> None:
        self._reader = asyncio.get_running_loop().create_task(self._read())

    async def _read(self) -> None:
        code = "connection_closed"
        try:
            while not self._closed:
                raw = await self._socket.recv()
                frame = open_reply(self._key, self.connection_ref, _load(raw, DIRECT_MAX_FRAME_BYTES))
                self._dispatch(frame)
        except asyncio.CancelledError:
            raise
        except MediaBridgeError as exc:
            code = exc.code
            log.warning("station media: direct connection refused a frame (%s); closing it", exc.code)
        except Exception as exc:  # noqa: BLE001 - the socket ended (the reason is the type only)
            log.info("station media: direct connection ended (%s)", type(exc).__name__)
        finally:
            if not self._closed:
                await self._shutdown(code)

    def _dispatch(self, frame: dict[str, Any]) -> None:
        mid = frame["id"]
        if frame["type"] == "result":
            entry = self._pending.pop(mid, None)
            if entry is None or entry[1].done():
                if (mid == self._active_media_id and frame.get("success") is False
                        and isinstance(frame.get("error"), dict)
                        and frame["error"].get("code") == "media_subscription_closed"):
                    self._event_ids.discard(mid)
                    self._active_media_id = None
                    handler = self._closed_handler
                    if handler is not None:
                        try:
                            handler()
                        except Exception:
                            log.warning("station media: a scoped direct close handler failed")
                    return  # no socket shutdown or failure of other commands
                self.dropped_frames += 1  # a late answer to an abandoned request, or an id never asked: never re-attributed
                return
            command, fut = entry
            if command == w10.TALK_OPEN and frame.get("success") is True:
                self._active_media_id = mid
                self._event_ids.add(mid)  # `talk_closed` for this talk arrives on this id (registered before the next frame is read)
            fut.set_result(frame)
            return
        event = frame.get("event")
        handler = self._event_handler
        if mid not in self._event_ids or not isinstance(event, dict):
            self.dropped_frames += 1
            return
        if event.get("type") == "media/talk_closed" and mid == self._active_media_id:
            self._event_ids.discard(mid)
            self._active_media_id = None
        if handler is not None:
            try:
                handler(event)
            except Exception:  # noqa: BLE001 - an event handler never breaks the reader
                log.warning("station media: an event handler failed")

    async def _shutdown(self, code: str) -> None:
        self._closed = True
        self.close_code = code
        outcome = "unknown" if code == "reply_unauthenticated" else "closed"
        pending, self._pending = self._pending, {}
        for _command, fut in pending.values():
            if not fut.done():
                fut.set_exception(MediaBridgeError(code if outcome == "unknown" else "connection_closed", outcome))
        try:
            await self._socket.close()
        except Exception:  # noqa: BLE001
            pass
        handler, self._closed_handler = self._closed_handler, None
        if handler is not None:
            try:
                handler()
            except Exception:  # noqa: BLE001
                log.warning("station media: a close handler failed")

    async def call(self, command: str, parameters: dict[str, Any], *, timeout: float) -> dict[str, Any]:
        if self._closed:
            raise MediaBridgeError("connection_closed", "closed")
        if len(self._pending) >= DIRECT_MAX_PENDING:
            raise MediaBridgeError("direct_output_capacity")  # refused before anything is signed or sent
        if self._next_id > DIRECT_MAX_ID:
            raise MediaBridgeError("connection_exhausted", "closed")
        proof = self.signer.proof(command, self.query_owner_id, parameters, window_s=self._window_s)
        mid = self._next_id
        self._next_id += 1
        fut: asyncio.Future[dict[str, Any]] = asyncio.get_running_loop().create_future()
        self._pending[mid] = (command, fut)
        text = json.dumps({"id": mid, "type": TYPE_PREFIX + command, "bridge": proof}, separators=(",", ":"), ensure_ascii=False)
        try:
            async with self._send_lock:
                await self._socket.send(text)
        except Exception as exc:  # noqa: BLE001 - a dead socket: the outcome of THIS request is unknown, the connection is gone
            self._pending.pop(mid, None)
            log.info("station media: direct send failed (%s)", type(exc).__name__)
            if not self._closed:
                await self._shutdown("connection_closed")
            raise MediaBridgeError("connection_closed", "closed") from None
        try:
            frame = await asyncio.wait_for(asyncio.shield(fut), timeout)
        except asyncio.TimeoutError:
            self._pending.pop(mid, None)  # a late answer is dropped by the reader, never re-attributed
            raise MediaBridgeError("media_outcome_unknown", "unknown") from None
        except asyncio.CancelledError:
            self._pending.pop(mid, None)
            raise
        if frame.get("id") != mid:  # the reader correlates by id; checked again here (defence in depth)
            raise MediaBridgeError("invalid_response", "unknown")
        return verify_result(frame)

    # -- WKINT-295: one generic signed command on this connection (services/wiskey_direct_join.py) -------------------------------------
    def signed_body(self, command: str, parameters: dict[str, Any], *, kind: str = KIND) -> dict[str, Any]:
        """The closed signed `bridge` object of ANY public command (not only the six W10 ones): kind (`wiskey-bridge-command.v1`, or
        `wiskey-peer-query.v1` for the peer reads), the command WITHOUT the `hikvision_intercom/` prefix, this connection's service
        query_owner_id, issued_at / expires_at (this link's window), the parameters unchanged, ts / nonce / sig by the existing recipe
        (`ha_bridge.sign`). Raises MediaBridgeError (outcome `not_sent`) when it cannot be built - nothing is written then."""
        return self.signer.command_proof(command, self.query_owner_id, parameters,
            kind=kind, window_s=self._window_s)

    async def call_command(self, command: str, parameters: dict[str, Any], *, kind: str = KIND, timeout: float) -> dict[str, Any]:
        """One signed request of any public command; the `result` of its reply once the reply's MAC + connection_ref (reader) and its
        id (here) are verified. Failure: MediaBridgeError whose `outcome` is exactly one of
          `not_sent` - proven: no byte of THIS frame was handed to the socket (closed link, full queue, unsignable, oversize);
          `refused` - a verified error frame for this id (`code` = WisKey's code);
          `unknown` - anything once the write may have begun (send failure, timeout, connection lost, unverifiable frame).
        Never retried, never re-sent on another connection."""
        if self._closed:
            raise MediaBridgeError("connection_closed", "not_sent")
        if len(self._pending) >= DIRECT_MAX_PENDING:
            raise MediaBridgeError("direct_output_capacity", "not_sent")
        if self._next_id > DIRECT_MAX_ID:
            raise MediaBridgeError("connection_exhausted", "not_sent")
        proof = self.signed_body(command, parameters, kind=kind)
        mid = self._next_id
        text = json.dumps({"id": mid, "type": TYPE_PREFIX + command, "bridge": proof}, separators=(",", ":"), ensure_ascii=False)
        if len(text.encode("utf-8")) > DIRECT_MAX_FRAME_BYTES:
            raise MediaBridgeError("request_too_large", "not_sent")
        self._next_id += 1
        fut: asyncio.Future[dict[str, Any]] = asyncio.get_running_loop().create_future()
        self._pending[mid] = (command, fut)
        started = False
        try:
            async with self._send_lock:
                if self._closed:
                    raise MediaBridgeError("connection_closed", "not_sent")
                started = True  # from here a byte of the frame may have reached the socket
                await self._socket.send(text)
        except MediaBridgeError:
            self._pending.pop(mid, None)
            raise
        except asyncio.CancelledError:
            self._pending.pop(mid, None)
            raise
        except Exception as exc:  # noqa: BLE001 - a dead socket during the write: this request's outcome is unknown
            self._pending.pop(mid, None)
            log.info("wiskey direct: send failed (%s)", type(exc).__name__)
            if not self._closed:
                await self._shutdown("connection_closed")
            raise MediaBridgeError("connection_closed", "unknown" if started else "not_sent") from None
        try:
            frame = await asyncio.wait_for(asyncio.shield(fut), timeout)
        except asyncio.TimeoutError:
            self._pending.pop(mid, None)  # a late answer is dropped by the reader, never re-attributed
            raise MediaBridgeError("outcome_unknown", "unknown") from None
        except MediaBridgeError as exc:  # the connection ended (or a frame failed its MAC) while this request was out
            raise MediaBridgeError(exc.code, "unknown") from None
        except asyncio.CancelledError:
            self._pending.pop(mid, None)
            raise
        if frame.get("id") != mid:
            raise MediaBridgeError("invalid_response", "unknown")
        return verify_command_result(frame, kind)

    def set_event_handler(self, handler: Callable[[dict[str, Any]], None] | None) -> None:
        self._event_handler = handler

    def set_closed_handler(self, handler: Callable[[], None] | None) -> None:
        self._closed_handler = handler
        if handler is not None and self._closed:
            self._closed_handler = None
            handler()

    async def close(self) -> None:
        reader = self._reader
        if not self._closed:
            await self._shutdown("connection_closed")
        if reader is not None and not reader.done() and reader is not asyncio.current_task():
            reader.cancel()
            try:
                await reader
            except BaseException:  # noqa: BLE001
                pass


class DirectApiTransport:
    """The direct Arx <-> WisKey API (DIRECT_API_V1.md; owner decision 24.10: no new Home Assistant user, no admin, no panel). Each
    `connect` opens a NEW socket, authenticates it with a fresh challenge and returns a `DirectLink` that owns nothing of an earlier
    connection (no session, talk, job or carrier is adopted: those belong to the socket that made them). Nothing is sent before the key
    is known to sign (`bridge_not_paired` / `bridge_key_rotated` open no socket)."""

    kind = "direct_api"
    HELLO_TIMEOUT_S = 10.0
    CONNECT_TIMEOUT_S = 10.0

    def __init__(self, opener: Callable[[], Awaitable[DirectSocket]], key_provider: Callable[[], Any], *,
                 clock: Callable[[], float] = time.time, window_s: int = WINDOW_S) -> None:
        if not 0 < window_s <= MAX_WINDOW_S:
            raise ValueError("window_s")
        self._window_s = window_s  # each command's validity window (WisKey: 0 < TTL <= 15 s); its principal expires with it
        self._opener = opener
        self._key_provider = key_provider
        self._clock = clock
        self._generation = 0
        self._lock = threading.Lock()
        self.last_identity: dict[str, Any] | None = None  # public facts of the latest connection (no key, no challenge)

    def __repr__(self) -> str:
        return "DirectApiTransport()"

    def _key(self) -> Any:
        try:
            key = self._key_provider()
        except Exception:  # noqa: BLE001 - an unreadable key set is "not paired"
            key = None
        _key_text(key)  # raises bridge_not_paired / bridge_key_rotated
        return key

    async def connect(self, purpose: str) -> MediaLink:
        if purpose not in (PURPOSE_VIDEO, PURPOSE_TALK, PURPOSE_COMMAND):
            raise MediaBridgeError("purpose_invalid")
        key = self._key()
        try:
            socket = await self._opener()
        except MediaBridgeError:
            raise
        except Exception as exc:  # noqa: BLE001 - unreachable, refused upgrade, TLS: the type only
            log.info("station media: direct socket not opened (%s)", type(exc).__name__)
            raise MediaBridgeError("direct_unreachable", "closed") from None
        try:
            identity = await self._authenticate(socket, key)
        except BaseException as exc:
            try:
                await socket.close()
            except Exception:  # noqa: BLE001
                pass
            if isinstance(exc, (asyncio.CancelledError, MediaBridgeError)):
                raise
            log.info("station media: direct connect failed (%s)", type(exc).__name__)
            raise MediaBridgeError("direct_connect_failed", "closed") from None
        with self._lock:
            self._generation += 1
            generation = self._generation
        link = DirectLink(socket, key, identity, purpose, generation, clock=self._clock, window_s=self._window_s)
        link.start()
        self.last_identity = {"query_owner_id": identity["query_owner_id"], "repository_id": identity["repository_id"],
                              "principal_kind": identity["principal_kind"]}
        return link

    async def _authenticate(self, socket: DirectSocket, key: Any) -> dict[str, Any]:
        try:
            hello = _load(await asyncio.wait_for(socket.recv(), self.HELLO_TIMEOUT_S), DIRECT_MAX_CONNECT_BYTES)
        except asyncio.TimeoutError:
            raise MediaBridgeError("direct_hello_timeout", "closed") from None
        if (not isinstance(hello, dict) or set(hello) != {"type", "protocol", "challenge"} or hello["type"] != "hello"
                or hello["protocol"] != DIRECT_PROTOCOL or not isinstance(hello["challenge"], str) or not CHALLENGE_RE.fullmatch(hello["challenge"])):
            raise MediaBridgeError("direct_hello_invalid", "closed")
        challenge = hello["challenge"]
        proof = sign_connect(key, challenge, now=int(self._clock()))
        await socket.send(json.dumps({"id": 1, "type": TYPE_PREFIX + DIRECT_CONNECT_COMMAND, "bridge": proof}, separators=(",", ":"), ensure_ascii=False))
        try:
            raw = await asyncio.wait_for(socket.recv(), self.CONNECT_TIMEOUT_S)
        except asyncio.TimeoutError:
            raise MediaBridgeError("direct_connect_timeout", "closed") from None
        except Exception:  # noqa: BLE001 - WisKey closes a refused connect without a word (it never echoes unauthenticated input)
            raise MediaBridgeError("direct_connect_refused", "closed") from None
        frame = open_reply(key, challenge, _load(raw, DIRECT_MAX_CONNECT_BYTES))
        if frame["id"] != 1 or frame["type"] != "result":
            raise MediaBridgeError("direct_connect_refused", "closed")
        try:
            result = verify_result(frame)
        except MediaBridgeError as exc:
            raise MediaBridgeError(exc.code, "closed") from None
        return read_identity(result, challenge)


def direct_ws_url(settings: Any) -> str:
    """The direct socket on Home Assistant core itself (the Supervisor proxy carries no anonymous upgrade): the same core address the
    other core sockets use (`ha_user_auth.core_ws_url`), with WisKey's path instead of `/api/websocket`."""
    from .ha_user_auth import core_ws_url

    base = core_ws_url(settings)
    return base[: -len("/api/websocket")] + DIRECT_PATH if base.endswith("/api/websocket") else base.rstrip("/") + DIRECT_PATH


def websocket_opener(settings: Any) -> Callable[[], Awaitable[DirectSocket]]:
    """Opens the direct socket with `websockets` on the existing private network: no Authorization header, no token, no query string.
    HA's TLS on the internal network is accepted without a name check, exactly as Arx's other core sockets do (ha_user_auth._dial).
    NOT exercised against a real Home Assistant (tests use in-memory sockets)."""

    async def open_socket() -> DirectSocket:
        import websockets

        url = await asyncio.to_thread(direct_ws_url, settings)
        kw: dict[str, Any] = {"open_timeout": 10, "close_timeout": 2, "max_size": DIRECT_MAX_FRAME_BYTES}
        if url.startswith("wss://"):
            import ssl

            ctx = ssl.create_default_context()
            ctx.check_hostname = False
            ctx.verify_mode = ssl.CERT_NONE
            kw["ssl"] = ctx
        return await websockets.connect(url, **kw)

    return open_socket


class AutoTransport:
    """`access.station_media_provider = auto`: the transport is chosen per connection, at runtime.

    Rule: the direct API when the pairing key can sign AND the direct socket opens and authenticates (hello, signed connect, verified
    reply, service identity); otherwise the existing signed bridge over the Home Assistant WebSocket. Without a usable key neither is
    tried (both sign with it) and the refusal stands - there is no unsigned path. After a direct failure the direct API is retried for
    the next connection only after `RETRY_DIRECT_S` (no hammering, no flapping inside one talk); a connection, once open, stays on its
    transport for its whole life (a talk never moves between transports)."""

    kind = "auto"
    RETRY_DIRECT_S = 60.0
    NO_FALLBACK = frozenset({"bridge_not_paired", "bridge_key_rotated", "purpose_invalid"})

    def __init__(self, direct: MediaTransport, fallback: MediaTransport, *, clock: Callable[[], float] = time.monotonic) -> None:
        self.direct = direct
        self.fallback = fallback
        self._clock = clock
        self._direct_down_until = 0.0
        self.last_kind: str | None = None
        self.last_direct_error: str | None = None

    async def connect(self, purpose: str) -> MediaLink:
        if self._clock() >= self._direct_down_until:
            try:
                link = await self.direct.connect(purpose)
            except MediaBridgeError as exc:
                if exc.code in self.NO_FALLBACK:
                    raise
                self.last_direct_error = exc.code
                self._direct_down_until = self._clock() + self.RETRY_DIRECT_S
                log.info("station media: direct API unavailable (%s); using the signed Home Assistant path", exc.code)
            else:
                self.last_kind = self.direct.kind
                self.last_direct_error = None
                return link
        link = await self.fallback.connect(purpose)
        self.last_kind = self.fallback.kind
        return link


# ---------------------------------------------------------------- the real Home Assistant connection

class _HaMediaChannel:
    """One media owner on a possibly shared original HA socket.

    A terminal result carries only the original subscription id and fixed code,
    never a talk reference, reason, media, cleanup claim or renewed authority.
    """

    def __init__(self, parent: "HaWsConnection") -> None:
        self.parent = parent
        self.subscription: int | None = None
        self._closed = False
        self._detached = False
        self._event_handler = None
        self._closed_handler = None

    @property
    def user_id(self) -> str:
        return self.parent.user_id

    @property
    def closed(self) -> bool:
        return self._closed or self.parent.closed

    async def send(self, msg_type: str, **payload: Any) -> dict[str, Any]:
        if self.closed:
            raise ConnectionError("closed")
        opening = msg_type == TYPE_PREFIX + w10.TALK_OPEN
        if opening and self.subscription is not None:
            raise MediaBridgeError("audio_busy", "not_sent")
        if opening:
            self.parent._opening_media += 1
        try:
            reply = await self.parent.send(msg_type, **payload)
            if opening and isinstance(reply, dict) and reply.get("success") is True:
                mid = reply.get("id")
                if type(mid) is not int or mid < 1 or mid in self.parent._media_subscriptions:
                    raise MediaBridgeError("invalid_response", "unknown")
                self.subscription = mid
                self.parent._media_subscriptions[mid] = self
                for frame in self.parent._early_media.pop(mid, []):
                    self._on_frame(frame)
                if self.parent._early_media_overflow:
                    self._mark_closed()
            return reply
        finally:
            if opening:
                self.parent._opening_media -= 1
                if not self.parent._opening_media:
                    self.parent._early_media.clear()
                    self.parent._early_media_overflow = False

    def _on_frame(self, frame: dict[str, Any]) -> None:
        if self.closed or frame.get("id") != self.subscription:
            return
        if (frame.get("type") == "result" and frame.get("success") is False
                and isinstance(frame.get("error"), dict)
                and frame["error"].get("code") == "media_subscription_closed"):
            self._mark_closed()
            return
        event = frame.get("event")
        if frame.get("type") == "event" and isinstance(event, dict) and self._event_handler is not None:
            self._event_handler(event)

    def _mark_closed(self) -> None:
        if self._closed:
            return
        self._closed = True
        handler, self._closed_handler = self._closed_handler, None
        if handler is not None:
            try:
                handler()
            except Exception:
                log.warning("station media: a scoped close handler failed")

    def set_event_handler(self, handler) -> None:
        self._event_handler = handler

    def set_closed_handler(self, handler) -> None:
        self._closed_handler = handler
        if handler is not None and self.closed:
            self._closed_handler = None
            handler()

    async def close(self) -> None:
        self._mark_closed()
        if self._detached:
            return
        self._detached = True
        if self.parent._media_subscriptions.get(self.subscription) is self:
            self.parent._media_subscriptions.pop(self.subscription)
        self.parent._media_channels.discard(self)
        if not self.parent._media_channels and self.parent._owns_media_socket:
            await self.parent.close()


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
        self._media_channels: set[_HaMediaChannel] = set()
        self._media_subscriptions: dict[int, _HaMediaChannel] = {}
        self._opening_media = 0
        self._early_media: dict[int, list[dict[str, Any]]] = {}
        self._early_media_overflow = False
        self._owns_media_socket = False

    def media_channel(self) -> _HaMediaChannel:
        channel = _HaMediaChannel(self)
        self._media_channels.add(channel)
        return channel

    @property
    def closed(self) -> bool:
        return self._closed

    def __repr__(self) -> str:  # never a token, a url or a user id
        return f"HaWsConnection(closed={self._closed})"

    @classmethod
    async def open(cls, settings: Any, *, url: str | None = None, token: str | None = None, internal_tls: bool = False, connect_timeout: float = 15.0, shared: bool = False) -> "HaWsConnection":
        from . import ha_client

        self = cls()
        self._owns_media_socket = not shared
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
        mid = frame.get("id") if isinstance(frame, dict) else None
        channel = self._media_subscriptions.get(mid) if type(mid) is int else None
        if channel is not None:
            try:
                channel._on_frame(frame)
            except Exception:
                channel._mark_closed()
            return
        event = frame.get("event") if isinstance(frame, dict) else None
        terminal = (isinstance(frame, dict) and frame.get("type") == "result"
                    and frame.get("success") is False and isinstance(frame.get("error"), dict)
                    and frame["error"].get("code") == "media_subscription_closed")
        media = isinstance(event, dict) and event.get("type") in {"media/talk_audio", "media/talk_closed"}
        if self._opening_media and type(mid) is int and (media or terminal):
            if sum(map(len, self._early_media.values())) < 8:
                self._early_media.setdefault(mid, []).append(frame)
            else:
                self._early_media_overflow = True
            return
        if media or terminal:
            return  # unknown/retired subscription, never another owner's event
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
        for channel in tuple(self._media_channels):
            channel._mark_closed()
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
        self._lock = threading.RLock()
        self._stopped = False
        self._shutdown = None
        self._loop: asyncio.AbstractEventLoop | None = None
        self._thread: threading.Thread | None = None

    def _ensure(self) -> asyncio.AbstractEventLoop:
        with self._lock:
            if self._stopped:
                raise MediaBridgeError('connection_closed', 'closed')
            if self._loop is None or self._loop.is_closed():
                loop = asyncio.new_event_loop()
                thread = threading.Thread(target=loop.run_forever, name="wiskey-media-bridge", daemon=True)
                thread.start()
                self._loop, self._thread = loop, thread
            return self._loop

    def run(self, coro: Awaitable[Any], timeout: float) -> Any:
        try:
            with self._lock:
                future = asyncio.run_coroutine_threadsafe(coro, self._ensure())
        except BaseException:
            close = getattr(coro, "close", None)
            if close is not None:
                close()
            raise
        try:
            return future.result(timeout)
        except TimeoutError:
            future.cancel()
            raise MediaBridgeError("media_outcome_unknown", "unknown") from None

    async def _finish(self) -> None:
        tasks = [t for t in asyncio.all_tasks() if t is not asyncio.current_task()]
        for task in tasks:
            task.cancel()
        if tasks:
            await asyncio.gather(*tasks, return_exceptions=True)

    def stop(self) -> None:
        with self._lock:
            self._stopped = True  # terminal even when cleanup remains unresolved
            loop, thread = self._loop, self._thread
            if loop is None:
                return
            if thread is threading.current_thread():
                raise MediaBridgeError("media_cleanup_failed", "unknown")
            if self._shutdown is None and loop.is_running():
                self._shutdown = asyncio.run_coroutine_threadsafe(self._finish(), loop)
            shutdown = self._shutdown
        if shutdown is not None:
            try:
                shutdown.result(5)
            except Exception:
                # Keep the loop/task handles; a later close can finish joining.
                raise MediaBridgeError("media_cleanup_failed", "unknown") from None
        if loop.is_running():
            loop.call_soon_threadsafe(loop.stop)
        if thread is not None:
            thread.join(5)
            if thread.is_alive():
                raise MediaBridgeError("media_cleanup_failed", "unknown")
        if not loop.is_closed():
            loop.close()
        with self._lock:
            self._loop = self._thread = None


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
        self._lifecycle_lock = threading.RLock()
        self._close_lock = threading.Lock()
        self._closed = False

    @property
    def closed(self) -> bool:
        with self._lifecycle_lock:
            return self._closed

    async def _get(self) -> MediaLink:
        if self.closed:
            raise MediaBridgeError("connection_closed", "closed")
        if self._connect_lock is None:
            self._connect_lock = asyncio.Lock()
        async with self._connect_lock:
            if self.closed:
                raise MediaBridgeError("connection_closed", "closed")
            link = self._link
            if link is None or link.closed:
                link = await self.transport.connect(PURPOSE_VIDEO)
                with self._lifecycle_lock:
                    closed = self._closed
                    if not closed:
                        self._link = link
                if closed:
                    await link.close()
                    raise MediaBridgeError("connection_closed", "closed")
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
        """Terminal owner fence precedes registry cleanup; failed DELETE retains ownership."""
        from .intercom_media import close_leased_streams

        with self._close_lock:
            with self._lifecycle_lock:
                self._closed = True
            if not close_leased_streams(self):
                raise MediaBridgeError("media_cleanup_failed", "unknown")
            link, self._link = self._link, None
            if link is not None:
                try:
                    self.runner.run(link.close(), 10)
                except Exception:
                    # stop joins pending loop tasks and reports unresolved cleanup.
                    pass
            self.runner.stop()
