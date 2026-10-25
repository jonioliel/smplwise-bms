"""Synthetic stdlib-only direct WebSocket fixture server for Arx CI.

Never imports HA, grants real authority, touches devices or sends messages.
Profile comes from an actual source-bound HA registry/descriptor observation.
Non-media business replies are explicit caller-supplied synthetic fixtures.
WebSocket framing: RFC6455 https://www.rfc-editor.org/rfc/rfc6455.html
"""

from __future__ import annotations

import argparse
import asyncio
import base64
import copy
import hashlib
import hmac
import json
import os
import struct
import time
from collections import deque
from datetime import UTC, datetime
from pathlib import Path
from uuid import uuid4

PROTOCOL = "wiskey-direct-ws.v1"
REPLY_KIND = "wiskey-direct-reply.v1"
PATH = "/api/hikvision_intercom/arx_bridge/v1/ws"
SYNTHETIC_KEY = "public-synthetic-direct-simulator-key-never-production"
PREFIX = "hikvision_intercom/"
PEER_QUERY_COMMANDS = {
    "peer_bindings/get",
    "peer_bindings/history",
    "peer_protocol/get",
    "peer_receipts/resolve",
}


def pairs(items):
    value = {}
    for key, item in items:
        if key in value:
            raise ValueError("invalid_fields")
        value[key] = item
    return value


def canonical(value: object) -> bytes:
    return json.dumps(
        value, sort_keys=True, separators=(",", ":"), ensure_ascii=False, allow_nan=False
    ).encode()


def strict(value, depth=0):
    if depth > 32:
        raise ValueError("invalid_fields")
    if value is None or type(value) in (str, int, bool):
        return
    if type(value) is list:
        for item in value:
            strict(item, depth + 1)
        return
    if type(value) is dict and all(type(key) is str for key in value):
        for item in value.values():
            strict(item, depth + 1)
        return
    raise ValueError("invalid_fields")


def timestamp(value):
    if type(value) is not str:
        raise ValueError("invalid_fields")
    moment = datetime.fromisoformat(value.replace("Z", "+00:00"))
    if moment.utcoffset() is None:
        raise ValueError("invalid_fields")
    return moment.timestamp()


def iso(value):
    return datetime.fromtimestamp(value, UTC).isoformat()


class ManualClock:
    def __init__(self, now):
        self.value = float(now)

    def __call__(self):
        return self.value

    def advance(self, seconds):
        self.value += seconds


class _Socket:
    def __init__(self, reader, writer, maximum):
        self.reader, self.writer, self.maximum = reader, writer, maximum
        self.lock = asyncio.Lock()

    async def packet(self, opcode, data):
        head = bytes([0x80 | opcode])
        if len(data) < 126:
            head += bytes([len(data)])
        elif len(data) <= 65535:
            head += b"\x7e" + struct.pack("!H", len(data))
        else:
            head += b"\x7f" + struct.pack("!Q", len(data))
        async with self.lock:
            self.writer.write(head + data)
            await self.writer.drain()

    async def send(self, value):
        await self.packet(1, canonical(value))

    async def receive(self):
        fragments, total, initial = [], 0, None
        while True:
            first, second = await self.reader.readexactly(2)
            final, opcode = bool(first & 128), first & 15
            if first & 112 or not second & 128:
                raise ValueError("invalid_fields")
            size = second & 127
            if size == 126:
                size = struct.unpack("!H", await self.reader.readexactly(2))[0]
            elif size == 127:
                size = struct.unpack("!Q", await self.reader.readexactly(8))[0]
            if size > self.maximum or opcode >= 8 and (not final or size > 125):
                raise ValueError("request_too_large")
            mask = await self.reader.readexactly(4)
            raw = await self.reader.readexactly(size)
            data = bytes(byte ^ mask[index % 4] for index, byte in enumerate(raw))
            if opcode == 8:
                await self.packet(8, data[:125])
                raise EOFError
            if opcode == 9:
                await self.packet(10, data)
                continue
            if opcode == 10:
                continue
            if opcode == 1 and initial is None:
                initial = opcode
            elif opcode != 0 or initial != 1:
                raise ValueError("invalid_fields")
            fragments.append(data)
            total += len(data)
            if total > self.maximum:
                raise ValueError("request_too_large")
            if final:
                return json.loads(b"".join(fragments).decode("utf-8"), object_pairs_hook=pairs)


class SyntheticDirectServer:
    """Finite owned CI service. All data/effects are synthetic memory only.

    `responses` maps original command names to explicit fixture results or callables.
    Unknown business behavior refuses instead of inventing a production engine.
    `inject(command, fault)` is a local harness API, never an extra v1 wire field.
    """

    def __init__(self, profile, *, key=SYNTHETIC_KEY, clock=time.time, responses=None):
        self.profile = copy.deepcopy(profile)
        if self.profile.get("kind") != "SYNTHETIC_SIMULATOR_PROFILE_FROM_ACTUAL_HA_REGISTRY":
            raise ValueError("source_bound_synthetic_profile_required")
        self.capabilities = self.profile["capabilities"]
        self.maximum = self.capabilities["limits"]["max_frame_bytes"]
        self.key, self.clock, self.responses = key, clock, responses or {}
        self.seen, self.faults, self.tasks, self.writers = {}, {}, set(), set()
        self.audio_owners = {}
        self.server, self.port = None, None
        self.accepted_commands, self.synthetic_effects = 0, 0
        self.last_clock = None

    def inject(self, command, fault):
        if fault not in {
            "drop_ack",
            "disconnect_before",
            "disconnect_after",
            "bad_reply_mac",
            "replay_nonce",
            "clock_skew",
            "event_after_expiry",
        }:
            raise ValueError("unknown_synthetic_fault")
        self.faults.setdefault(command, deque()).append(fault)

    async def __aenter__(self):
        self.server = await asyncio.start_server(self._accept, "127.0.0.1", 0, limit=65536)
        self.port = self.server.sockets[0].getsockname()[1]
        return self

    async def __aexit__(self, *_error):
        self.server.close()
        await self.server.wait_closed()
        for writer in tuple(self.writers):
            writer.close()
        for task in tuple(self.tasks):
            task.cancel()
        await asyncio.gather(*tuple(self.tasks), return_exceptions=True)

    def _verify(self, message, identity, challenge, connecting, fault):
        if type(message) is not dict or set(message) != {"id", "type", "bridge"}:
            raise ValueError("invalid_fields")
        proof = message["bridge"]
        fields = {
            "kind",
            "command",
            "query_owner_id",
            "issued_at",
            "expires_at",
            "parameters",
            "ts",
            "nonce",
            "sig",
        }
        if type(proof) is not dict or set(proof) != fields:
            raise ValueError("Unauthorized")
        body = {key: value for key, value in proof.items() if key not in {"ts", "nonce", "sig"}}
        strict(body)
        command, nonce, stamp = body["command"], proof["nonce"], proof["ts"]
        if (
            type(stamp) is not int
            or type(nonce) is not str
            or len(nonce) not in {16, 32}
            or any(char not in "0123456789abcdef" for char in nonce)
        ):
            raise ValueError("Unauthorized")
        expected = hmac.new(
            self.key.encode(),
            f"{stamp}.{nonce}.{hashlib.sha256(canonical(body)).hexdigest()}".encode(),
            hashlib.sha256,
        ).hexdigest()
        if type(proof["sig"]) is not str or not hmac.compare_digest(expected, proof["sig"]):
            raise ValueError("Unauthorized")
        now = self.clock() + (61 if fault == "clock_skew" else 0)
        issued, expires = timestamp(body["issued_at"]), timestamp(body["expires_at"])
        if (
            self.last_clock is not None
            and now < self.last_clock
            or abs(now - stamp) > 60
            or not 0 < expires - issued <= 15
            or issued > now + 2
            or now >= expires
        ):
            raise ValueError("Unauthorized")
        self.last_clock = now
        for old in tuple(self.seen):
            if now - self.seen[old] > 120:
                del self.seen[old]
        if fault == "replay_nonce":
            self.seen[nonce] = now
        if nonce in self.seen or len(self.seen) >= self.capabilities["limits"]["nonce_capacity"]:
            raise ValueError("Unauthorized")
        self.seen[nonce] = now
        if (
            message["type"] != PREFIX + command
            or body["query_owner_id"] != identity
            or body["kind"]
            != (
                "wiskey-direct-connect.v1"
                if connecting
                else "wiskey-peer-query.v1"
                if command in PEER_QUERY_COMMANDS
                else "wiskey-bridge-command.v1"
            )
        ):
            raise ValueError("Unauthorized")
        if connecting and (
            command != "direct/connect" or body["parameters"] != {"challenge": challenge}
        ):
            raise ValueError("Unauthorized")
        return command, body["parameters"], expires

    async def _accept(self, reader, writer):
        if len(self.writers) >= self.capabilities["limits"]["max_connections_including_preparing"]:
            writer.close()
            await writer.wait_closed()
            return
        task = asyncio.current_task()
        self.tasks.add(task)
        self.writers.add(writer)
        socket, timer = _Socket(reader, writer, self.maximum), None
        challenge, identity = uuid4().hex, "arx-service:synthetic-pairing-entry"
        sessions, talks, last_id = {}, {}, 0

        async def reply(frame, bad=False):
            body = {"connection_ref": challenge, "frame": frame}
            sig = hmac.new(
                self.key.encode(), (REPLY_KIND + ".").encode() + canonical(body), hashlib.sha256
            ).hexdigest()
            await socket.send(
                {
                    "kind": REPLY_KIND,
                    **body,
                    "sig": ("0" if sig[0] != "0" else "1") + sig[1:] if bad else sig,
                }
            )

        async def sweep():
            while True:
                await asyncio.sleep(0.05)
                now = self.clock()
                for ref, row in tuple(talks.items()):
                    reason = (
                        "access_lost"
                        if now >= row["proof_expiry"]
                        else "expired"
                        if now >= row["expires"]
                        else "idle_timeout"
                        if now - row["touched"] >= 12
                        else None
                    )
                    if reason and not row.get("closed"):
                        row["closed"] = reason
                        if self.audio_owners.get(row["station"]) == (challenge, ref):
                            self.audio_owners.pop(row["station"])
                        if now < row["proof_expiry"]:
                            await reply(
                                {
                                    "id": row["id"],
                                    "type": "event",
                                    "event": {
                                        "type": "media/talk_closed",
                                        "talk_ref": ref,
                                        "reason": reason,
                                        "cleanup_joined": True,
                                    },
                                }
                            )

        try:
            header = await asyncio.wait_for(reader.readuntil(b"\r\n\r\n"), 10)
            lines = header.decode("ascii").split("\r\n")
            if lines[0] != "GET " + PATH + " HTTP/1.1":
                return
            headers = dict(line.split(":", 1) for line in lines[1:] if ":" in line)
            headers = {key.lower(): value.strip() for key, value in headers.items()}
            key = headers.get("sec-websocket-key", "")
            if (
                len(base64.b64decode(key, validate=True)) != 16
                or headers.get("sec-websocket-version") != "13"
            ):
                return
            accept = base64.b64encode(
                hashlib.sha1((key + "258EAFA5-E914-47DA-95CA-C5AB0DC85B11").encode()).digest()
            ).decode()
            writer.write(
                (
                    "HTTP/1.1 101 Switching Protocols\r\nUpgrade: websocket\r\n"
                    "Connection: Upgrade\r\nSec-WebSocket-Accept: " + accept + "\r\n\r\n"
                ).encode()
            )
            await writer.drain()
            await socket.send({"type": "hello", "protocol": PROTOCOL, "challenge": challenge})
            hello = await asyncio.wait_for(socket.receive(), 10)
            self._verify(hello, "pairing", challenge, True, None)
            if hello["id"] != 1:
                return
            await reply(
                {
                    "id": 1,
                    "type": "result",
                    "success": True,
                    "result": {
                        "protocol": PROTOCOL,
                        "query_owner_id": identity,
                        "principal_kind": "pairing_service",
                        "connection_ref": challenge,
                        "repository_id": "synthetic-repository",
                    },
                }
            )
            last_id = 1
            timer = asyncio.create_task(sweep())
            while True:
                message = await socket.receive()
                mid = message.get("id") if type(message) is dict else None
                if type(mid) is not int or not last_id < mid <= 2**53 - 1:
                    return
                last_id = mid
                proof = message.get("bridge")
                command = proof.get("command") if type(proof) is dict else None
                fault = (
                    self.faults.get(command, deque()).popleft()
                    if self.faults.get(command)
                    else None
                )
                try:
                    command, parameters, expiry = self._verify(
                        message, identity, challenge, False, fault
                    )
                    self.accepted_commands += 1
                    if fault == "disconnect_before":
                        return
                    result = self._dispatch(
                        command, parameters, expiry, mid, sessions, talks, identity, challenge
                    )
                    if fault == "disconnect_after":
                        return
                    if fault != "drop_ack":
                        await reply(
                            {
                                "id": mid,
                                "type": "result",
                                "success": True,
                                "bridge_schema": "wiskey-bridge-command.v1",
                                "result": result,
                            },
                            fault == "bad_reply_mac",
                        )
                    if fault == "event_after_expiry" and command == "media/talk_open":
                        if not isinstance(self.clock, ManualClock):
                            await asyncio.sleep(max(0, expiry - self.clock()) + 0.001)
                        else:
                            self.clock.advance(max(0, expiry - self.clock()) + 0.001)
                        await reply(
                            {
                                "id": mid,
                                "type": "event",
                                "event": {
                                    "type": "media/talk_closed",
                                    "talk_ref": result["talk_ref"],
                                    "reason": "expired",
                                    "cleanup_joined": True,
                                },
                            }
                        )
                except (ValueError, KeyError, TypeError) as error:
                    code = str(error) if type(error) is ValueError else "invalid_fields"
                    if not code.isidentifier():
                        code = "invalid_fields"
                    await reply(
                        {"id": mid, "type": "result", "success": False, "error": {"code": code}}
                    )
        except (
            asyncio.CancelledError,
            EOFError,
            ConnectionError,
            ValueError,
            TypeError,
            KeyError,
            UnicodeError,
            asyncio.IncompleteReadError,
            asyncio.LimitOverrunError,
            TimeoutError,
        ):
            pass
        finally:
            for station, owner in tuple(self.audio_owners.items()):
                if owner[0] == challenge:
                    self.audio_owners.pop(station)
            talks.clear()
            sessions.clear()
            if timer:
                timer.cancel()
                await asyncio.gather(timer, return_exceptions=True)
            writer.close()
            try:
                await writer.wait_closed()
            except ConnectionError:
                pass
            finally:
                self.writers.discard(writer)
                self.tasks.discard(task)

    def _dispatch(self, command, parameters, expiry, mid, sessions, talks, identity, challenge):
        names = {row["name"] for row in self.capabilities["commands"]}
        if command not in names:
            raise ValueError("command_unavailable")
        if command in {"direct/capabilities", "direct/time", "peer_identity/get"} and parameters:
            raise ValueError("invalid_fields")
        if command == "direct/capabilities":
            return copy.deepcopy(self.capabilities)
        if command == "direct/time":
            return {
                "schema_version": 1,
                "server_utc": iso(self.clock()),
                "max_ts_skew_seconds": 60,
                "max_issued_future_seconds": 2,
                "max_command_ttl_seconds": 15,
            }
        if command == "peer_identity/get":
            return {
                "protocol": PROTOCOL,
                "query_owner_id": identity,
                "principal_kind": "pairing_service",
                "connection_ref": challenge,
                "repository_id": "synthetic-repository",
            }
        if command == "overview":
            return {"api": {"commands": sorted(names)}}
        if command == "media/station_descriptor":
            if set(parameters) != {"station_id", "actor", "request_id"}:
                raise ValueError("invalid_fields")
            descriptor = copy.deepcopy(self.profile["station_descriptor"])
            descriptor.update(
                station_id=parameters["station_id"],
                session=uuid4().hex,
                issued_at=iso(self.clock()),
                expires_at=iso(self.clock() + 300),
            )
            sessions[descriptor["session"]] = {
                "descriptor": descriptor,
                "actor": parameters["actor"],
            }
            return descriptor
        if command in {"media/stream_lease", "media/talk_open"}:
            row = sessions.get(parameters.get("session"))
            if row is None or timestamp(row["descriptor"]["expires_at"]) <= self.clock():
                raise ValueError("session_expired")
            if parameters.get("actor") != row["actor"]:
                raise ValueError("Unauthorized")
            if command == "media/stream_lease":
                if (
                    set(parameters) != {"session", "profile", "actor", "request_id"}
                    or parameters["profile"] != "main"
                ):
                    raise ValueError("invalid_fields")
                return {
                    "source": "rtsp://synthetic.invalid/never-opened",
                    "expires_at": iso(self.clock() + 15),
                }
            if set(parameters) != {"session", "actor", "request_id", "expires_at"}:
                raise ValueError("invalid_fields")
            station = row["descriptor"]["station_id"]
            if station in self.audio_owners or len(self.audio_owners) >= self.capabilities[
                "limits"
            ].get("max_audio_sessions_including_legacy_and_TTS", 3):
                raise ValueError("audio_busy")
            until = timestamp(parameters["expires_at"])
            maximum = row["descriptor"]["audio"]["max_talk_seconds"]
            if (
                not self.clock()
                < until
                <= min(timestamp(row["descriptor"]["expires_at"]), self.clock() + maximum)
            ):
                raise ValueError("invalid_fields")
            ref = uuid4().hex
            talks[ref] = {
                "id": mid,
                "station": station,
                "expires": until,
                "proof_expiry": expiry,
                "touched": self.clock(),
                "held": False,
                "seq": 0,
                "credit": 2.0,
                "last": self.clock(),
            }
            self.audio_owners[station] = (challenge, ref)
            return {"talk_ref": ref, "codec": "pcmu", "frame_ms": 20}
        if command.startswith("media/talk_"):
            row = talks.get(parameters.get("talk_ref"))
            if row is None:
                raise ValueError("session_expired")
            if command == "media/talk_close":
                if set(parameters) != {"talk_ref", "reason"}:
                    raise ValueError("invalid_fields")
                row["closed"] = parameters["reason"]
                if self.audio_owners.get(row["station"]) == (challenge, parameters["talk_ref"]):
                    self.audio_owners.pop(row["station"])
                return {"state": "closed", "cleanup_joined": True, "no_effect": None}
            if row.get("closed"):
                raise ValueError("session_expired")
            row["proof_expiry"], row["touched"] = expiry, self.clock()
            if command == "media/talk_floor":
                if set(parameters) != {"talk_ref", "held"} or type(parameters["held"]) is not bool:
                    raise ValueError("invalid_fields")
                row["held"] = parameters["held"]
                return {"held": row["held"], "next_seq": row["seq"]}
            if command != "media/talk_frame" or set(parameters) != {"talk_ref", "frames"}:
                raise ValueError("invalid_fields")
            if not row["held"]:
                raise ValueError("floor_not_held")
            frames = parameters["frames"]
            if type(frames) is not list or len(frames) not in {5, 10}:
                raise ValueError("invalid_fields")
            for index, frame in enumerate(frames):
                if (
                    type(frame) is not dict
                    or set(frame) != {"seq", "data"}
                    or type(frame["seq"]) is not int
                    or frame["seq"] != row["seq"] + index
                ):
                    raise ValueError("sequence_invalid")
                if len(base64.b64decode(frame["data"], validate=True)) != 160:
                    raise ValueError("invalid_fields")
            credit = min(2.0, row["credit"] + (self.clock() - row["last"]) * 10)
            if credit + 1e-9 < len(frames) / 5:
                raise ValueError("rate_limited")
            row["seq"] += len(frames)
            row["last"], row["credit"] = self.clock(), max(0.0, credit - len(frames) / 5)
            self.synthetic_effects += 1
            return {
                "next_seq": row["seq"],
                "accepted_frames": len(frames),
                "retry_permitted": False,
            }
        if command in self.responses:
            value = self.responses[command]
            if callable(value):
                return value(copy.deepcopy(parameters))
            return copy.deepcopy(value)
        raise ValueError("command_unavailable")


async def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument(
        "--profile",
        type=Path,
        default=Path(__file__).parent / "fixtures/wiskey_direct_simulator_profile_v1.json",
    )
    parser.add_argument("--scenario", type=Path)
    parser.add_argument("--duration-s", type=float, default=60)
    args = parser.parse_args()
    if not 0 < args.duration_s <= 3600:
        parser.error("duration must be finite in1..3600 seconds")
    profile = json.loads(args.profile.read_text())
    scenario = json.loads(args.scenario.read_text()) if args.scenario else {}
    async with SyntheticDirectServer(profile, responses=scenario.get("responses")) as server:
        for command, faults in scenario.get("faults", {}).items():
            for fault in faults:
                server.inject(command, fault)
        print(
            json.dumps(
                {
                    "PID": os.getpid(),
                    "kind": "SYNTHETIC_NOT_S7_OR_EQUIPMENT",
                    "port": server.port,
                    "profile_source_CODE": profile["source_CODE"],
                }
            ),
            flush=True,
        )
        await asyncio.sleep(args.duration_s)


if __name__ == "__main__":
    asyncio.run(main())
