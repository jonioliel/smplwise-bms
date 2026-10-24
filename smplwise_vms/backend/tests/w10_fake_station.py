"""W10CLIENT-295: a FAKE of WisKey's side of the six W10 commands, for tests only.

It is written from WisKey's published schemas (tests/fixtures/wiskey_w10/w10_parameters_schemas.json) and from the rules the
reply describes (connection-owned descriptors, one actor per session, one talk per station / connection, sequence from 0, floor
before frames, a 5 or 10 frame batch, a credit bucket, an idle limit, one request at a time per talk) - NOT from WisKey's code. It
verifies the signed envelope with its OWN implementation of the recipe (canonical JSON, HMAC-SHA256 over `ts.nonce.sha256(body)`),
so a test that passes proves Arx's signer matches the recipe as written down, not just itself.

Nothing here talks to a network, Home Assistant, a station or WisKey. It proves nothing about the real WisKey."""
from __future__ import annotations

import asyncio
import base64
import hashlib
import hmac
import json
import re
import secrets
import time
from collections.abc import Callable
from datetime import datetime, timedelta, timezone
from pathlib import Path
from typing import Any

FIX = Path(__file__).parent / "fixtures" / "wiskey_w10"
SCHEMAS = json.loads((FIX / "w10_parameters_schemas.json").read_text(encoding="utf-8"))["commands"]
KIND = "wiskey-bridge-command.v1"
SECRET = "fake-pairing-secret-for-unit-tests-only"


# ---------------------------------------------------------------- a small JSON-schema checker (the subset the W10 schemas use)

def check_schema(value: Any, schema: dict[str, Any]) -> bool:
    if "const" in schema and value != schema["const"]:
        return False
    if "enum" in schema and value not in schema["enum"]:
        return False
    kind = schema.get("type")
    if kind == "object":
        if not isinstance(value, dict):
            return False
        props = schema.get("properties", {})
        if any(k not in value for k in schema.get("required", [])):
            return False
        if schema.get("additionalProperties") is False and set(value) - set(props):
            return False
        return all(check_schema(v, props[k]) for k, v in value.items() if k in props)
    if kind == "array":
        if not isinstance(value, list):
            return False
        if "oneOf" in schema and sum(_len_ok(len(value), o) for o in schema["oneOf"]) != 1:
            return False
        return all(check_schema(v, schema["items"]) for v in value)
    if kind == "string":
        if not isinstance(value, str):
            return False
        if len(value) < schema.get("minLength", 0) or len(value) > schema.get("maxLength", 10**9):
            return False
        if "pattern" in schema and re.search(schema["pattern"], value) is None:
            return False
        if schema.get("contentEncoding") == "base64":
            try:
                base64.b64decode(value, validate=True)
            except ValueError:
                return False
        return True
    if kind == "integer":
        return (isinstance(value, int) and not isinstance(value, bool) and schema.get("minimum", -(10**30)) <= value <= schema.get("maximum", 10**30))
    if kind == "boolean":
        return isinstance(value, bool)
    return True


def _len_ok(n: int, rule: dict[str, Any]) -> bool:
    return rule.get("minItems", 0) <= n <= rule.get("maxItems", 10**9)


# ---------------------------------------------------------------- the station

class Refused(Exception):
    def __init__(self, code: str) -> None:
        super().__init__(code)
        self.code = code


def _aware(value: str) -> datetime:
    return datetime.fromisoformat(value.replace("Z", "+00:00")).astimezone(timezone.utc)


class Talk:
    def __init__(self, ref: str, conn: "FakeConn", station: str, actor: str, expires: datetime, now: float) -> None:
        self.ref, self.conn, self.station, self.actor, self.expires = ref, conn, station, actor, expires
        self.held = False
        self.seq = 0
        self.pushing = False
        self.credit = 2.0
        self.last_credit_at: float | None = None
        self.touched = now
        self.in_flight = 0
        self.max_in_flight = 0
        self.closed = False


class FakeConn:
    """One WebSocket connection (a `RawConnection` for Arx's SignedBridgeLink)."""

    def __init__(self, station: "FakeStation", number: int, user_id: str) -> None:
        self.station, self.number, self.user_id = station, number, user_id
        self._closed = False
        self.event_handler: Callable[[dict[str, Any]], None] | None = None
        self.closed_handler: Callable[[], None] | None = None
        self.sent = 0
        self.talk: Talk | None = None

    @property
    def closed(self) -> bool:
        return self._closed

    async def send(self, msg_type: str, **payload: Any) -> dict[str, Any]:
        if self._closed:
            raise ConnectionError("closed")
        self.sent += 1
        return await self.station.handle(self, {"id": self.sent, "type": msg_type, **payload})

    def set_event_handler(self, handler: Callable[[dict[str, Any]], None] | None) -> None:
        self.event_handler = handler

    def set_closed_handler(self, handler: Callable[[], None] | None) -> None:
        self.closed_handler = handler

    async def close(self) -> None:
        self.drop()

    def drop(self) -> None:
        """The socket goes away (either side): the talk of this connection is cancelled, as WisKey does."""
        if self._closed:
            return
        self._closed = True
        talk = self.talk
        if talk is not None and not talk.closed:
            self.station.end_talk(talk)
        handler, self.closed_handler = self.closed_handler, None
        if handler is not None:
            handler()


class Req:
    def __init__(self, conn: int, command: str, at: float, params: dict[str, Any]) -> None:
        self.conn, self.command, self.at, self.params = conn, command, at, params


class FakeStation:
    MAX_NONCES = 4096

    def __init__(self, *, secret: str = SECRET, user_id: str = "ha-user-1", clock: Callable[[], float] = time.monotonic) -> None:
        self.secret, self.user_id, self.clock = secret, user_id, clock
        self.max_talk_s: int | None = 180  # the descriptor's limit (None = none)
        self.idle_s = 12.0
        self.credit_per_s = 10.0
        self.ack_delay = 0.0
        self.delays: dict[str, float] = {}
        self.errors: dict[str, str] = {}  # command -> an error code answered for it
        self.errors_once: dict[str, str] = {}
        self.cleanup_fails = False
        self.talk_profile_stream = True
        self.conns: list[FakeConn] = []
        self.descriptors: dict[str, dict[str, Any]] = {}
        self.talks: dict[str, Talk] = {}
        self.station_talk: dict[str, Talk] = {}
        self.requests: list[Req] = []
        self.frames_sink: list[bytes] = []
        self.batches: list[tuple[float, int, int]] = []  # (arrived, first_seq, count)
        self.nonces: set[str] = set()
        self.fleet_extra = 0
        self.now_override: datetime | None = None
        self.revision = 0

    # -- connections
    def connect(self, user_id: str | None = None) -> FakeConn:
        conn = FakeConn(self, len(self.conns) + 1, user_id or self.user_id)
        self.conns.append(conn)
        return conn

    def utcnow(self) -> datetime:
        return self.now_override or datetime.now(timezone.utc)

    def by_command(self, command: str) -> list[Req]:
        return [r for r in self.requests if r.command == command]

    # -- the signed envelope, verified with this file's own implementation of the recipe
    def admit(self, conn: FakeConn, message: dict[str, Any], command: str) -> dict[str, Any]:
        if set(message) != {"id", "type", "bridge"} or not isinstance(message["id"], int) or message["type"] != f"hikvision_intercom/{command}":
            raise Refused("invalid_fields")
        bridge = message["bridge"]
        if not isinstance(bridge, dict) or set(bridge) != {"kind", "command", "query_owner_id", "issued_at", "expires_at", "parameters", "ts", "nonce", "sig"}:
            raise Refused("Unauthorized")
        ts, nonce, sig = bridge["ts"], bridge["nonce"], bridge["sig"]
        if (type(ts) is not int or type(nonce) is not str or re.fullmatch(r"(?:[0-9a-f]{16}|[0-9a-f]{32})", nonce) is None
                or type(sig) is not str or re.fullmatch(r"[0-9a-f]{64}", sig) is None):
            raise Refused("Unauthorized")
        body = {k: v for k, v in bridge.items() if k not in ("ts", "nonce", "sig")}
        canonical = json.dumps(body, sort_keys=True, separators=(",", ":"), ensure_ascii=False, allow_nan=False).encode("utf-8")
        expected = hmac.new(self.secret.encode(), f"{ts}.{nonce}.{hashlib.sha256(canonical).hexdigest()}".encode(), hashlib.sha256).hexdigest()
        if not hmac.compare_digest(expected, sig) or abs(self.utcnow().timestamp() - ts) > 60:
            raise Refused("Unauthorized")
        if nonce in self.nonces or len(self.nonces) >= self.MAX_NONCES:
            raise Refused("Unauthorized")
        self.nonces.add(nonce)
        if body["kind"] != KIND or body["command"] != command or body["query_owner_id"] != conn.user_id:
            raise Refused("Unauthorized")
        issued, expires = _aware(body["issued_at"]), _aware(body["expires_at"])
        if not timedelta(0) < expires - issued <= timedelta(seconds=15) or self.utcnow() >= expires:
            raise Refused("Unauthorized")
        schema = SCHEMAS[f"media/{command.split('/')[-1]}"]["parameters_schema"]
        if not check_schema(body["parameters"], schema):
            raise Refused("invalid_fields")
        return body["parameters"]

    # -- the six commands
    async def handle(self, conn: FakeConn, message: dict[str, Any]) -> dict[str, Any]:
        command = message["type"].removeprefix("hikvision_intercom/") if isinstance(message.get("type"), str) else ""
        try:
            if command not in ("media/station_descriptor", "media/stream_lease", "media/talk_open", "media/talk_frame", "media/talk_floor", "media/talk_close"):
                return {"id": message["id"], "type": "result", "success": False, "error": {"code": "unknown_command", "message": "x"}}
            params = self.admit(conn, message, command)
            self.requests.append(Req(conn.number, command, self.clock(), params))
            if command in self.errors:
                raise Refused(self.errors[command])
            if command in self.errors_once:
                raise Refused(self.errors_once.pop(command))
            await asyncio.sleep(self.delays.get(command, self.ack_delay))
            result = getattr(self, "_" + command.split("/")[1])(conn, params)
            if asyncio.iscoroutine(result):
                result = await result
            return {"id": message["id"], "type": "result", "success": True, "bridge_schema": KIND, "result": result}
        except Refused as error:
            return {"id": message["id"], "type": "result", "success": False, "error": {"code": error.code, "message": "refused"}}

    def _station_descriptor(self, conn: FakeConn, p: dict[str, Any]) -> dict[str, Any]:
        if p["station_id"] in ("missing",):
            raise Refused("station_not_found")
        if p["station_id"] in ("offline",):
            raise Refused("station_offline")
        now = self.utcnow()
        self.revision += 1
        ref = secrets.token_hex(16)
        self.descriptors[ref] = {"conn": conn, "actor": p["actor"]["id"], "station": p["station_id"], "expires": now + timedelta(seconds=300)}
        return {"schema": "arx.station_media.v1.1", "station_id": p["station_id"], "session": ref, "revision": self.revision,
                "issued_at": now.isoformat(), "expires_at": (now + timedelta(seconds=300)).isoformat(),
                "video": {"profiles": ([{"id": "main", "codec": None, "width": None, "height": None, "fps": None, "transports": ["private_rtsp_source"]}]
                                       if self.talk_profile_stream else [])},
                "audio": {"listen": None, "talk": None, "duplex": None, "codec": None, "talk_transports": ["signed_ws_batch_v1"],
                          "max_talk_seconds": self.max_talk_s},
                "limits": {"max_viewers": None, "max_talkers": 1}}

    def _resolve(self, conn: FakeConn, p: dict[str, Any]) -> dict[str, Any]:
        row = self.descriptors.get(p["session"])
        if row is None:
            raise Refused("session_expired")
        if row["conn"] is not conn:
            raise Refused("Unauthorized")  # a descriptor belongs to the connection that read it
        if self.utcnow() >= row["expires"]:
            raise Refused("session_expired")
        if p["actor"]["id"] != row["actor"]:
            raise Refused("Unauthorized")
        return row

    def _stream_lease(self, conn: FakeConn, p: dict[str, Any]) -> dict[str, Any]:
        row = self._resolve(conn, p)
        if p["profile"] != "main" or not self.talk_profile_stream:
            raise Refused("media_not_supported")
        row_station = row["station"]
        assert row_station
        return {"source": "rtsp://fixture-user:fixture-pass@station-a.invalid:554/stream/main",
                "expires_at": (self.utcnow() + timedelta(seconds=15)).isoformat()}

    def _talk_open(self, conn: FakeConn, p: dict[str, Any]) -> dict[str, Any]:
        row = self._resolve(conn, p)
        expiry = _aware(p["expires_at"])
        now = self.utcnow()
        limit = now + timedelta(seconds=self.max_talk_s) if self.max_talk_s is not None else row["expires"]
        if not now < expiry <= min(row["expires"], limit):
            raise Refused("invalid_fields")
        if row["station"] in self.station_talk or conn.talk is not None or len(self.station_talk) + self.fleet_extra >= 3:
            raise Refused("audio_busy")
        talk = Talk(secrets.token_hex(16), conn, row["station"], row["actor"], expiry, self.clock())
        self.talks[talk.ref] = talk
        self.station_talk[row["station"]] = talk
        conn.talk = talk
        return {"talk_ref": talk.ref, "codec": "pcmu", "frame_ms": 20}

    def _talk(self, conn: FakeConn, p: dict[str, Any]) -> Talk:
        talk = self.talks.get(p["talk_ref"])
        if talk is None:
            raise Refused("session_expired")
        if talk.conn is not conn:
            raise Refused("Unauthorized")
        return talk

    async def _guarded(self, talk: Talk, work: Callable[[], dict[str, Any]]) -> dict[str, Any]:
        talk.in_flight += 1
        talk.max_in_flight = max(talk.max_in_flight, talk.in_flight)
        try:
            if talk.in_flight > 1:
                raise Refused("source_changed")  # WisKey refuses a floor / push while another is being pushed
            await asyncio.sleep(0)
            return work()
        finally:
            talk.in_flight -= 1

    async def _talk_floor(self, conn: FakeConn, p: dict[str, Any]) -> dict[str, Any]:
        talk = self._talk(conn, p)

        def work() -> dict[str, Any]:
            if talk.closed:
                raise Refused("source_changed")
            talk.held = p["held"]
            talk.touched = self.clock()
            return {"held": talk.held, "next_seq": talk.seq}

        return await self._guarded(talk, work)

    async def _talk_frame(self, conn: FakeConn, p: dict[str, Any]) -> dict[str, Any]:
        talk = self._talk(conn, p)

        def work() -> dict[str, Any]:
            if talk.closed:
                raise Refused("source_changed")
            if not talk.held:
                raise Refused("floor_not_held")
            frames = p["frames"]
            for i, frame in enumerate(frames):
                if frame["seq"] != talk.seq + i:
                    raise Refused("sequence_invalid")
                if len(base64.b64decode(frame["data"])) != 160:
                    raise Refused("invalid_fields")
            now = self.clock()
            credit = talk.credit if talk.last_credit_at is None else min(2.0, talk.credit + (now - talk.last_credit_at) * self.credit_per_s)
            packets = len(frames) // 5
            if credit + 1e-9 < packets:
                raise Refused("rate_limited")
            talk.seq += len(frames)  # consumed before the sink: never replayed
            talk.last_credit_at, talk.credit = now, max(0.0, credit - packets)
            talk.touched = now
            self.batches.append((now, frames[0]["seq"], len(frames)))
            self.frames_sink.extend(base64.b64decode(f["data"]) for f in frames)
            return {"next_seq": talk.seq, "accepted_frames": len(frames), "retry_permitted": False}

        return await self._guarded(talk, work)

    async def _talk_close(self, conn: FakeConn, p: dict[str, Any]) -> dict[str, Any]:
        talk = self._talk(conn, p)
        if self.cleanup_fails:
            raise Refused("cleanup_failed")
        self.end_talk(talk)
        return {"state": "closed", "cleanup_joined": True, "no_effect": None}

    # -- talk life
    def end_talk(self, talk: Talk) -> None:
        talk.closed = True
        self.talks.pop(talk.ref, None)
        if self.station_talk.get(talk.station) is talk:
            self.station_talk.pop(talk.station, None)
        if talk.conn.talk is talk:
            talk.conn.talk = None

    def emit_closed(self, talk: Talk, reason: str) -> None:
        """WisKey ends a talk by itself: the event goes out on the talk_open request's subscription."""
        handler = talk.conn.event_handler
        self.end_talk(talk)
        if handler is not None:
            handler({"type": "media/talk_closed", "talk_ref": talk.ref, "reason": reason, "cleanup_joined": True})

    def watchdog(self) -> None:
        """The idle rule: a talk with no signed request for `idle_s` ends with `idle_timeout`."""
        now = self.clock()
        for talk in list(self.talks.values()):
            if now - talk.touched >= self.idle_s:
                self.emit_closed(talk, "idle_timeout")

    async def run_watchdog(self, every: float = 0.01) -> None:
        while True:
            await asyncio.sleep(every)
            self.watchdog()
