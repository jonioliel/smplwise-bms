"""WKDIRECT-295: a FAKE of WisKey's direct pairing socket (DIRECT_API_V1.md), for tests only.

Written from WisKey's published contract (reference/DIRECT_API_V1.md of the round-4 intake, 3707f97fb) and the behaviour that contract
describes - NOT run against WisKey. It serves the six W10 commands through the existing `FakeStation` (tests/w10_fake_station.py), so the
command rules (connection-owned descriptors, one actor, floor first, batches of 5 or 10 from seq 0, the credit bucket, one request at a
time) are the same fake's. What this file adds is the direct transport:

- an in-memory socket pair (`MemorySocket`), no network;
- the hello `{type: "hello", protocol: "wiskey-direct-ws.v1", challenge: <32 hex>}` and the `direct/connect` check (exact envelope, exact
  six-field body, query_owner_id "pairing", parameters {challenge}, 0 < TTL <= 15 s, issued_at at most 2 s ahead, fresh nonce, HMAC by
  this file's OWN implementation of the recipe); a refused connect closes the socket without a word, as WisKey does;
- the server-issued service subject `arx-service:<entry>` as the only query_owner_id later commands may carry;
- every server frame after the hello wrapped as `{kind: "wiskey-direct-reply.v1", connection_ref, frame, sig}` with
  sig = HMAC-SHA256(pairing, "wiskey-direct-reply.v1." + canonical({connection_ref, frame}));
- ids strictly increasing per connection, serial dispatch, `talk_closed` on the id of its `talk_open`;
- the no-traffic lifetime rules WisKey measured (CURRENT_STATUS.json `W10_no_traffic`): a talk's principal expires with the window of the
  last signed request (closed `access_lost`, NO event), and a talk idle for `idle_s` ends `idle_timeout` with a signed event. Time can be
  scaled (`scale`) so a test runs the 10 s / 12 s / 15 s rules in a fraction of a second.

Nothing here talks to a network, Home Assistant, a station or WisKey. It proves nothing about the real WisKey."""
from __future__ import annotations

import asyncio
import hashlib
import hmac
import json
import re
import time
import uuid
from collections.abc import Callable
from datetime import datetime, timedelta, timezone
from typing import Any

from w10_fake_station import SECRET, FakeConn, FakeStation

PROTOCOL = "wiskey-direct-ws.v1"
CONNECT_KIND = "wiskey-direct-connect.v1"
REPLY_KIND = "wiskey-direct-reply.v1"
DOMAIN = "hikvision_intercom"


def canonical(value: Any) -> bytes:
    return json.dumps(value, sort_keys=True, separators=(",", ":"), ensure_ascii=False, allow_nan=False).encode("utf-8")


def mac(secret: str, connection_ref: str, frame: Any) -> str:
    return hmac.new(secret.encode("utf-8"), (REPLY_KIND + ".").encode("utf-8") + canonical({"connection_ref": connection_ref, "frame": frame}),
                    hashlib.sha256).hexdigest()


class Closed(ConnectionError):
    pass


class MemorySocket:
    """One end of an in-memory text socket pair."""

    def __init__(self) -> None:
        self.inbox: asyncio.Queue[str | None] = asyncio.Queue()
        self.peer: MemorySocket | None = None
        self.closed = False
        self.sent: list[str] = []

    @staticmethod
    def pair() -> tuple["MemorySocket", "MemorySocket"]:
        a, b = MemorySocket(), MemorySocket()
        a.peer, b.peer = b, a
        return a, b

    async def recv(self) -> str:
        if self.closed and self.inbox.empty():
            raise Closed("closed")
        item = await self.inbox.get()
        if item is None:
            self.closed = True
            raise Closed("closed")
        return item

    async def send(self, text: str) -> None:
        if self.closed or self.peer is None or self.peer.closed:
            raise Closed("closed")
        self.sent.append(text)
        await self.peer.inbox.put(text)

    async def close(self) -> None:
        if self.closed:
            return
        self.closed = True
        self.inbox.put_nowait(None)
        if self.peer is not None and not self.peer.closed:
            self.peer.inbox.put_nowait(None)


class Refusal(Exception):
    pass


def _aware(value: Any) -> datetime:
    if not isinstance(value, str):
        raise Refusal("Unauthorized")
    return datetime.fromisoformat(value.replace("Z", "+00:00")).astimezone(timezone.utc)


class DirectConnection:
    """The server side of one direct socket."""

    def __init__(self, server: "FakeDirectServer", sock: MemorySocket, challenge: str) -> None:
        self.server, self.sock, self.challenge = server, sock, challenge
        self.conn: FakeConn | None = None
        self.subject: str | None = None
        self.connect_message: dict[str, Any] | None = None
        self.messages: list[dict[str, Any]] = []
        self.talk_ids: dict[str, int] = {}
        self.principal_until: float | None = None
        self.opened_at: float | None = None
        self.closures: list[dict[str, Any]] = []
        self.events_sent: list[dict[str, Any]] = []

    async def send_frame(self, frame: dict[str, Any]) -> None:
        message = {"kind": REPLY_KIND, "connection_ref": self.challenge, "frame": frame, "sig": mac(self.server.secret, self.challenge, frame)}
        if self.server.tamper is not None:
            message = self.server.tamper(message)
            if message is None:
                return
        await self.sock.send(json.dumps(message, ensure_ascii=True))

    def on_event(self, event: dict[str, Any]) -> None:
        mid = self.talk_ids.get(event.get("talk_ref", ""))
        if mid is None:
            return
        self.events_sent.append(event)
        self.closures.append({"reason": event.get("reason"), "elapsed": self.server.clock() - (self.opened_at or 0), "event": True})
        asyncio.get_running_loop().create_task(self.send_frame({"id": mid, "type": "event", "event": event}))


class FakeDirectServer:
    def __init__(self, station: FakeStation, *, secret: str = SECRET, entry_id: str = "fixture-entry-1", repository_id: str | None = "repo-fixture-1",
                 clock: Callable[[], float] = time.monotonic, scale: float = 1.0) -> None:
        self.station, self.secret, self.entry_id, self.repository_id, self.clock, self.scale = station, secret, entry_id, repository_id, clock, scale
        self.connections: list[DirectConnection] = []
        self.opened = 0
        self.nonces: set[str] = set()
        self.hello_override: Any = None
        self.hello_delay = 0.0
        self.identity_override: dict[str, Any] | None = None
        self.tamper: Callable[[dict[str, Any]], dict[str, Any] | None] | None = None
        self.refuse_open = False
        self.lifetime_rules = False  # principal expiry + idle (WisKey's no-traffic measurements)
        self.tasks: list[asyncio.Task[Any]] = []

    @property
    def subject(self) -> str:
        return "arx-service:" + self.entry_id

    async def opener(self) -> MemorySocket:
        if self.refuse_open:
            raise OSError("connection refused")
        self.opened += 1
        client, server = MemorySocket.pair()
        challenge = uuid.uuid4().hex
        dc = DirectConnection(self, server, challenge)
        self.connections.append(dc)
        self.tasks.append(asyncio.get_running_loop().create_task(self._serve(dc)))
        return client

    # -- the connect check (an independent implementation of DIRECT_API_V1.md "Connection and authentication")
    def _verify_connect(self, dc: DirectConnection, message: Any) -> None:
        if (not isinstance(message, dict) or set(message) != {"id", "type", "bridge"} or type(message["id"]) is not int or message["id"] != 1
                or message["type"] != DOMAIN + "/direct/connect"):
            raise Refusal("invalid_fields")
        bridge = message["bridge"]
        if not isinstance(bridge, dict) or set(bridge) != {"kind", "command", "query_owner_id", "issued_at", "expires_at", "parameters", "ts", "nonce", "sig"}:
            raise Refusal("Unauthorized")
        ts, nonce, sig = bridge["ts"], bridge["nonce"], bridge["sig"]
        if (type(ts) is not int or type(nonce) is not str or re.fullmatch(r"(?:[0-9a-f]{16}|[0-9a-f]{32})", nonce) is None
                or type(sig) is not str or re.fullmatch(r"[0-9a-f]{64}", sig) is None):
            raise Refusal("Unauthorized")
        body = {k: v for k, v in bridge.items() if k not in ("ts", "nonce", "sig")}
        digest = hashlib.sha256(canonical(body)).hexdigest()
        expected = hmac.new(self.secret.encode("utf-8"), f"{ts}.{nonce}.{digest}".encode("utf-8"), hashlib.sha256).hexdigest()
        now = datetime.now(timezone.utc)
        if not hmac.compare_digest(expected, sig) or abs(now.timestamp() - ts) > 60 or nonce in self.nonces:
            raise Refusal("Unauthorized")
        if (body["kind"] != CONNECT_KIND or body["command"] != "direct/connect" or body["query_owner_id"] != "pairing"
                or body["parameters"] != {"challenge": dc.challenge}):
            raise Refusal("Unauthorized")
        issued, expires = _aware(body["issued_at"]), _aware(body["expires_at"])
        if not timedelta(0) < expires - issued <= timedelta(seconds=15) or issued > now + timedelta(seconds=2) or now >= expires:
            raise Refusal("Unauthorized")
        self.nonces.add(nonce)

    def identity(self, dc: DirectConnection) -> dict[str, Any]:
        out = {"protocol": PROTOCOL, "query_owner_id": self.subject, "principal_kind": "pairing_service", "connection_ref": dc.challenge,
               "repository_id": self.repository_id}
        if self.identity_override is not None:
            out = {**out, **self.identity_override}
        return out

    async def _serve(self, dc: DirectConnection) -> None:
        watcher: asyncio.Task[None] | None = None
        try:
            if self.hello_delay:
                await asyncio.sleep(self.hello_delay)
            hello = self.hello_override if self.hello_override is not None else {"type": "hello", "protocol": PROTOCOL, "challenge": dc.challenge}
            await dc.sock.send(hello if isinstance(hello, str) else json.dumps(hello))
            first = json.loads(await asyncio.wait_for(dc.sock.recv(), 10))
            dc.connect_message = first
            self._verify_connect(dc, first)
            dc.subject = self.subject
            dc.conn = self.station.connect(user_id=self.subject)
            dc.conn.set_event_handler(dc.on_event)
            await dc.send_frame({"id": 1, "type": "result", "success": True, "result": self.identity(dc)})
            if self.lifetime_rules:
                watcher = asyncio.get_running_loop().create_task(self._watch(dc))
            last_id = 1
            while True:
                message = json.loads(await dc.sock.recv())
                mid = message.get("id") if isinstance(message, dict) else None
                if type(mid) is not int or not last_id < mid <= 2**53 - 1:
                    raise Refusal("invalid_fields")
                last_id = mid
                dc.messages.append(message)
                await self._dispatch(dc, message)
        except (Refusal, Closed, asyncio.TimeoutError, ValueError, KeyError, TypeError):
            pass  # never echo unauthenticated input: the socket just closes
        finally:
            if watcher is not None:
                watcher.cancel()
            if dc.conn is not None:
                dc.conn.drop()  # the talk of this connection is cancelled with it, as WisKey does
            await dc.sock.close()

    async def _dispatch(self, dc: DirectConnection, message: dict[str, Any]) -> None:
        assert dc.conn is not None
        bridge = message.get("bridge") if isinstance(message.get("bridge"), dict) else {}
        reply = await self.station.handle(dc.conn, message)
        frame: dict[str, Any] = {"id": message["id"], "type": "result", "success": bool(reply.get("success"))}
        if reply.get("success"):
            frame["result"] = reply["result"]
            command = message["type"].removeprefix(DOMAIN + "/")
            if command == "media/talk_open":
                dc.talk_ids[reply["result"]["talk_ref"]] = message["id"]
                dc.opened_at = self.clock()
            if command in ("media/talk_open", "media/talk_frame", "media/talk_floor"):
                try:
                    window = (_aware(bridge["expires_at"]) - _aware(bridge["issued_at"])).total_seconds()
                except (Refusal, KeyError, ValueError):
                    window = 0.0
                dc.principal_until = self.clock() + window * self.scale  # the talk's principal is the last signed request's
        else:
            frame["error"] = {"code": reply["error"]["code"], "message": "Direct bridge request refused"}
        await dc.send_frame(frame)

    async def _watch(self, dc: DirectConnection, every: float = 0.002) -> None:
        """WisKey's no-traffic rules on this connection's talk: principal expiry first (access_lost, no event), else idle (event)."""
        while True:
            await asyncio.sleep(every)
            conn = dc.conn
            talk = conn.talk if conn is not None else None
            if talk is None or talk.closed:
                continue
            now = self.clock()
            if dc.principal_until is not None and now >= dc.principal_until:
                dc.closures.append({"reason": "access_lost", "elapsed": now - (dc.opened_at or now), "event": False})
                self.station.end_talk(talk)  # closed with its lock and journal; no event after the principal expired
            elif now - talk.touched >= self.station.idle_s:
                self.station.emit_closed(talk, "idle_timeout")  # the signed event goes out on the talk_open id (DirectConnection.on_event)

    async def stop(self) -> None:
        for dc in self.connections:
            await dc.sock.close()
        for task in self.tasks:
            task.cancel()
        await asyncio.gather(*self.tasks, return_exceptions=True)
