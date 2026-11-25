"""WISKEY-MEDIA-V2-2530 (FAKES ONLY): station media (video, talk, listen) over WisKey's signed direct transport v2 - the opt-in
`access.station_media_direct_v2` (default off; on needs bridge 0.10.9+), services/wiskey_media_v2.py.

WisKey here is an in-memory v2 fake written in THIS file: the v2 hello / `direct/connect` check / identity / Arx-defined v2 reply wrapper
of tests/test_wiskey_direct_v2_2520.py (R7's helpers, imported), with the six W10 commands served by the fake station of
tests/w10_fake_station.py behind an independent v2 request check. Every talk, floor and frame here goes to that fake: nothing is
actuated, nothing contacts a network, Home Assistant, a station, go2rtc or WisKey. It proves nothing about the real WisKey."""
from __future__ import annotations

import asyncio
import hashlib
import hmac
import json
import logging
import re
import sqlite3
import time
import uuid
from dataclasses import replace
from datetime import datetime, timedelta, timezone
from typing import Any

import pytest
from fastapi.testclient import TestClient
from test_wkdirect_295 import overview as fixture_overview
from test_wiskey_direct_v2_2520 import KEY, KID, MATERIAL, REPO, cap_v3, pairing_doc, v2_reply, v2_sig
from w10_fake_direct import Closed, FakeDirectServer, MemorySocket
from w10_fake_station import SCHEMAS, SECRET, FakeConn, FakeStation, Refused, check_schema

from smplwise.errors import ApiError
from smplwise.services import go2rtc as g2
from smplwise.services import ha_bridge, intercom_sync
from smplwise.services import intercom_media as im
from smplwise.services import wiskey_media_bridge as bridge
from smplwise.services import wiskey_media_caps as caps
from smplwise.services import wiskey_media_contract as w10
from smplwise.services import wiskey_media_v2 as media_v2

DOMAIN = "hikvision_intercom"
STATION = {"id": "entry-a", "online": True, "camera_entity": "camera.entry_a"}
FRAME = bytes(range(160))
OPTS = {"frame_s": 0.01, "heartbeat_s": 0.2, "frame_timeout_s": 0.4, "floor_timeout_s": 1.0}
OTHER_KID = "g2-89abcdef"
DISCOVERY = ("direct/capabilities_v3", "direct/time", "direct/pairing_status_v2")


def run(coro: Any) -> Any:
    return asyncio.run(coro)


async def until(predicate: Any, timeout: float = 3.0) -> None:
    end = time.monotonic() + timeout
    while not predicate():
        if time.monotonic() > end:
            raise AssertionError("condition not reached in time")
        await asyncio.sleep(0.005)


def _check_v2(material: str, kid: str, nonces: set[str], b: Any, *, kind: str, command: str, owner: str) -> dict[str, Any]:
    """An independent check of a v2 signed request (the KeySet v2 recipe): exact fields, kid, signature, window, fresh nonce."""
    fields = {"kind", "command", "query_owner_id", "issued_at", "expires_at", "parameters", "kid", "ts", "nonce", "sig"}
    if not isinstance(b, dict) or set(b) != fields or b["kid"] != kid or re.fullmatch(r"[0-9a-f]{32}", b["nonce"] or "") is None:
        raise Refused("Unauthorized")
    body = {k: v for k, v in b.items() if k not in ("kid", "ts", "nonce", "sig")}
    now = datetime.now(timezone.utc)
    if (not hmac.compare_digest(v2_sig(material, b["kid"], b["ts"], b["nonce"], body), b["sig"]) or abs(now.timestamp() - b["ts"]) > 60
            or b["nonce"] in nonces):
        raise Refused("Unauthorized")
    issued, expires = datetime.fromisoformat(b["issued_at"]), datetime.fromisoformat(b["expires_at"])
    if not timedelta(0) < expires - issued <= timedelta(seconds=15) or now >= expires:
        raise Refused("Unauthorized")
    if body["kind"] != kind or body["command"] != command or body["query_owner_id"] != owner:
        raise Refused("Unauthorized")
    nonces.add(b["nonce"])
    return body


class V2Station(FakeStation):
    """The fake station of tests/w10_fake_station.py, its signed envelope checked by the v2 recipe (kid on the wire, v2 kind)."""

    def __init__(self, *, material: str = MATERIAL, kid: str = KID) -> None:
        super().__init__()
        self.material, self.kid = material, kid
        self.kinds: list[str] = []

    def admit(self, conn: FakeConn, message: dict[str, Any], command: str) -> dict[str, Any]:
        if set(message) != {"id", "type", "bridge"} or not isinstance(message["id"], int) or message["type"] != f"{DOMAIN}/{command}":
            raise Refused("invalid_fields")
        body = _check_v2(self.material, self.kid, self.nonces, message["bridge"], kind="wiskey-bridge-command.v2", command=command,
                         owner=conn.user_id)
        self.kinds.append(body["kind"])
        if not check_schema(body["parameters"], SCHEMAS[f"media/{command.split('/')[-1]}"]["parameters_schema"]):
            raise Refused("invalid_fields")
        return body["parameters"]


class V2MediaServer:
    """WisKey's v2 direct socket for station media: hello v2, the signed v2 connect, a v2 identity, every later frame wrapped by the
    Arx-defined v2 reply; W10 commands go to `V2Station`, the three v2 discovery reads are answered here. A refused connect closes
    without a word; `script[command] = "silent"` never answers that command (an unknown outcome)."""

    def __init__(self, station: V2Station, *, material: str = MATERIAL, kid: str = KID) -> None:
        self.station, self.material, self.kid = station, material, kid
        self.opened = 0
        self.nonces: set[str] = set()
        self.commands: list[tuple[str, str, Any]] = []  # (command, kind, parameters) of every command frame that arrived
        self.script: dict[str, str] = {}
        self.pairing: dict[str, Any] | None = None
        self.names: tuple[str, ...] = tuple(w10.COMMANDS)
        self.tasks: list[asyncio.Task[Any]] = []

    async def opener(self) -> MemorySocket:
        self.opened += 1
        client, server = MemorySocket.pair()
        self.tasks.append(asyncio.get_running_loop().create_task(self._serve(server)))
        return client

    async def _serve(self, sock: MemorySocket) -> None:
        challenge = uuid.uuid4().hex
        subject = "arx-service:fixture-entry-1"
        conn: FakeConn | None = None
        talk_ids: dict[str, int] = {}

        async def send(frame: dict[str, Any]) -> None:
            await sock.send(json.dumps(v2_reply(self.material, self.kid, challenge, frame)))

        def on_event(event: dict[str, Any]) -> None:
            mid = talk_ids.get(event.get("talk_ref", ""))
            if mid is not None:
                asyncio.get_running_loop().create_task(send({"id": mid, "type": "event", "event": event}))

        try:
            await sock.send(json.dumps({"type": "hello", "protocol": "wiskey-direct-ws.v2", "challenge": challenge}))
            first = json.loads(await sock.recv())
            try:
                if set(first) != {"id", "type", "bridge"} or first["id"] != 1 or first["type"] != DOMAIN + "/direct/connect":
                    raise Refused("Unauthorized")
                body = _check_v2(self.material, self.kid, self.nonces, first["bridge"], kind="wiskey-direct-connect.v2", command="direct/connect",
                                 owner="pairing")
                if body["parameters"] != {"challenge": challenge}:
                    raise Refused("Unauthorized")
            except Refused:
                await sock.close()  # WisKey never echoes unauthenticated input
                return
            conn = self.station.connect(user_id=subject)
            conn.set_event_handler(on_event)
            await send({"id": 1, "type": "result", "success": True, "result": {
                "protocol": "wiskey-direct-ws.v2", "query_owner_id": subject, "principal_kind": "pairing_service", "connection_ref": challenge,
                "repository_id": REPO, "kid": self.kid}})
            last = 1
            while True:
                message = json.loads(await sock.recv())
                mid = message.get("id")
                if type(mid) is not int or mid <= last:
                    return
                last = mid
                command = message["type"].removeprefix(DOMAIN + "/")
                b = message.get("bridge") if isinstance(message.get("bridge"), dict) else {}
                self.commands.append((command, b.get("kind"), b.get("parameters")))
                if self.script.get(command) == "silent":
                    continue
                if command in DISCOVERY:
                    try:
                        _check_v2(self.material, self.kid, self.nonces, b, kind="wiskey-bridge-command.v2", command=command, owner=subject)
                    except Refused as exc:
                        await send({"id": mid, "type": "result", "success": False, "error": {"code": exc.code, "message": "refused"}})
                        continue
                    if command == "direct/capabilities_v3":
                        result: Any = cap_v3(self.kid, names=self.names)
                    elif command == "direct/time":
                        result = {"schema_version": 1, "server_utc": datetime.now(timezone.utc).isoformat(), "max_ts_skew_seconds": 60,
                                  "max_issued_future_seconds": 2, "max_command_ttl_seconds": 15}
                    else:
                        result = self.pairing if self.pairing is not None else pairing_doc(self.kid)
                    await send({"id": mid, "type": "result", "success": True, "result": result})
                    continue
                reply = await self.station.handle(conn, message)
                frame: dict[str, Any] = {"id": mid, "type": "result", "success": bool(reply.get("success"))}
                if reply.get("success"):
                    frame["result"] = reply["result"]
                    if command == w10.TALK_OPEN:
                        talk_ids[reply["result"]["talk_ref"]] = mid
                else:
                    frame["error"] = {"code": reply["error"]["code"], "message": "refused"}
                await send(frame)
        except (Closed, ConnectionError, json.JSONDecodeError, KeyError, TypeError, ValueError):
            return
        finally:
            if conn is not None:
                conn.drop()
            await sock.close()

    def media_commands(self) -> list[tuple[str, str]]:
        return [(c, k) for c, k, _p in self.commands if c not in DISCOVERY]


def db(*, gate: str | None = "on", bridge_version: str | None = "0.10.9", provider: str = "auto") -> sqlite3.Connection:
    conn = sqlite3.connect(":memory:", check_same_thread=False)
    conn.execute("CREATE TABLE settings(key TEXT PRIMARY KEY, value TEXT)")
    rows = {im.PROVIDER_KEY: provider, media_v2.SETTING_KEY: gate, media_v2.BRIDGE_VERSION_KEY: bridge_version}
    for key, value in rows.items():
        if value is not None:
            conn.execute("INSERT INTO settings(key, value) VALUES (?, ?)", (key, value))
    return conn


def set_row(conn: sqlite3.Connection, key: str, value: str) -> None:
    conn.execute("INSERT OR REPLACE INTO settings(key, value) VALUES (?, ?)", (key, value))


def overview(*, with_w10: bool = True) -> dict[str, Any]:
    """The feed's `overview.api` (the W10 fixture), or the same list without the six W10 commands."""
    doc = fixture_overview()
    if not with_w10:
        doc["commands"] = [c for c in doc["commands"] if c not in w10.COMMANDS and c.removeprefix(DOMAIN + "/") not in w10.COMMANDS]
    return doc


@pytest.fixture()
def media_settings(settings):
    return replace(settings, go2rtc_url="http://go2rtc.invalid:1984")


@pytest.fixture()
def registered(monkeypatch):
    calls: list[tuple[str, str]] = []

    def frame_jpeg(self, name: str, src: str) -> bytes:
        calls.append((name, src))
        with g2._REGISTERED_LOCK:
            g2._REGISTERED[name] = hashlib.sha256(src.encode()).hexdigest()
        return b"\xff\xd8\xff"

    monkeypatch.setattr(g2.Go2rtc, "frame_jpeg", frame_jpeg)
    yield calls
    with g2._REGISTERED_LOCK:
        for name in [n for n in g2._REGISTERED if n.startswith("smplwise_wiskey_entry-a")]:
            g2._REGISTERED.pop(name)


class World:
    """The process's real `bridge_provider` built against fakes: v1 direct socket, v2 direct socket (V2MediaServer) and the signed Home
    Assistant path - each counted, so a test proves which path a request took and which it never touched."""

    def __init__(self, monkeypatch: Any) -> None:
        self.station = V2Station()
        self.v2 = V2MediaServer(self.station)
        self.v1_station = FakeStation()
        self.v1 = FakeDirectServer(self.v1_station)
        self.ha_calls: list[str] = []
        self.key: Any = KEY
        self.opened_v1 = 0

        async def v1_opener() -> Any:
            self.opened_v1 += 1
            return await self.v1.opener()

        async def ha(purpose: str) -> Any:
            self.ha_calls.append(purpose)
            return self.v1_station.connect()

        self.v1_opener = v1_opener
        monkeypatch.setattr(bridge, "websocket_opener", lambda settings, *, version=1: self.v2.opener if version == 2 else v1_opener)
        monkeypatch.setattr(bridge, "ha_connector", lambda settings, **_kw: ha)
        monkeypatch.setattr(im._CachedKey, "__call__", lambda _self: self.key)
        monkeypatch.setattr(ha_bridge, "signing_key", lambda _conn: self.key)
        monkeypatch.setattr(intercom_sync.SYNC, "api_facts", lambda _s: overview())
        monkeypatch.setattr(intercom_sync.SYNC, "served", lambda _s: ("ready", {}))
        monkeypatch.delenv(im.FAKE_ENV, raising=False)
        im.set_provider(None)
        im._bridge, im._bridge_for = None, None

    def provider(self, settings: Any, conn: Any) -> im.WiskeyBridgeProvider:
        p = im.bridge_provider(settings, conn)
        p.pump_options = dict(OPTS)
        return p

    def close(self) -> None:
        if im._bridge is not None:
            im._bridge.video.close()
        im._bridge, im._bridge_for = None, None
        im.set_provider(None)
        im.MEDIA.reset()
        caps.set_opener_for_tests(None)
        caps.invalidate()


@pytest.fixture()
def world(monkeypatch):
    w = World(monkeypatch)
    yield w
    w.close()


def talk_channel(provider: im.WiskeyBridgeProvider, settings: Any, **kw: Any) -> im.WiskeyBridgeTalkChannel:
    d = provider.describe(None, settings, STATION)
    assert d.provider == "wiskey"
    channel = provider.talk_open(settings, "entry-a", d, actor_id="op-1", actor_name="Dana Operator", request_id="req-2530",
                                 expires_at=time.time() + 120)
    assert isinstance(channel, im.WiskeyBridgeTalkChannel)
    return channel


# ================================================================ the gate (pure)

@pytest.mark.parametrize("gate,version,on", [
    (None, None, False), (None, "0.10.9", False), ("off", "0.10.9", False), ("on", None, False), ("on", "", False), ("on", "0.10.8", False),
    ("on", "0.9.99", False), ("on", "0.10.9", True), ("on", "0.10.10", True), ("on", "0.11.0", True), ("on", "1.0.0", True),
    ("yes", "0.10.9", False), ("ON", "0.10.9", False),
])
def test_the_gate_is_the_switch_and_bridge_0_10_9_or_newer_and_nothing_else(gate, version, on):
    conn = db(gate=gate, bridge_version=version)
    assert media_v2.enabled(conn) is on
    assert media_v2.setting(conn) == (gate if gate in ("off", "on") else "off")
    assert media_v2.enabled(None) is False and media_v2.setting(None) == "off"
    state = media_v2.state(conn)
    assert state["enabled"] is on and state["bridge_required"] == "0.10.9" and "material" not in json.dumps(state)


def test_the_setting_ships_off_and_an_unreadable_database_is_off():
    from smplwise.services.settings_store import DEFAULTS

    assert DEFAULTS[media_v2.SETTING_KEY] == "off"
    broken = sqlite3.connect(":memory:")  # no settings table at all
    assert media_v2.setting(broken) == "off" and media_v2.bridge_ok(broken) is False and media_v2.enabled(broken) is False


def test_the_key_rule_while_enabled_signs_v1_keys_as_before_and_a_rotated_key_on_v2():
    legacy = ha_bridge.BridgeKey("legacy-material", "g0-legacy")
    assert media_v2.key_problem(SECRET) is None and media_v2.key_problem(legacy) is None
    assert media_v2.key_problem(KEY) is None, "a rotated KeySet key with a valid kid signs v2"
    assert media_v2.key_problem(None) == media_v2.key_problem("") == "not_paired"
    assert media_v2.key_problem(ha_bridge.BridgeKey("x", "not a kid")) == "key_rotated", "a rotated key with no valid kid signs nothing"
    assert media_v2.is_rotated(KEY) and media_v2.is_rotated(ha_bridge.BridgeKey("x", "not a kid"))
    assert not media_v2.is_rotated(SECRET) and not media_v2.is_rotated(legacy) and not media_v2.is_rotated(None)


# ================================================================ off: today's media path, unchanged

@pytest.mark.parametrize("gate,version", [(None, None), ("off", "0.10.9"), ("on", "0.10.8"), ("on", None)])
def test_off_or_an_older_bridge_builds_todays_provider_and_a_rotated_key_stays_refused(world, settings, gate, version):
    conn = db(gate=gate, bridge_version=version)
    p = world.provider(settings, conn)
    assert isinstance(p.media.direct, bridge.DirectApiTransport) and p.media.direct.v2_enabled is False
    assert type(p.media.fallback) is bridge.SignedBridgeTransport, "the Home Assistant path itself, unwrapped"
    assert im._bridge_for == (id(settings), id(im.database_of(conn))), "today's marker"
    world.key = KEY
    assert im.provider_for(settings, conn).name == "local", "a rotated key cannot sign: Arx's own source, as before"
    assert im.signing_problem(conn) == "key_rotated"
    assert "pairing_key_rotated" in im.readiness(settings, conn, read=False)["missing"]
    with pytest.raises(bridge.MediaBridgeError) as exc:
        run(p.media.connect(bridge.PURPOSE_TALK))
    assert exc.value.code == "bridge_key_rotated"
    assert world.v2.opened == 0 and world.opened_v1 == 0 and world.ha_calls == [], "nothing opened for a rotated key"
    assert caps.key_fingerprint(KEY) is None and im.listing(settings, conn, api_reader=lambda _s: overview(with_w10=False)).signed is None


def test_off_a_v1_key_takes_the_v1_direct_socket_exactly_as_before(world, media_settings, registered):
    conn = db(gate="off")
    world.key = SECRET
    p = world.provider(media_settings, conn)
    name = p.video_stream(None, media_settings, STATION, "main")
    assert name.startswith("smplwise_wiskey_entry-a.w10.")
    assert world.opened_v1 == 1 and world.v2.opened == 0 and world.ha_calls == []
    kinds = {m["bridge"]["kind"] for dc in world.v1.connections for m in dc.messages}
    assert kinds == {"wiskey-bridge-command.v1"} and all("kid" not in m["bridge"] for dc in world.v1.connections for m in dc.messages)


# ================================================================ on: the selection follows the key

def test_on_with_bridge_0_10_9_a_rotated_key_selects_wiskey_on_v2(world, settings):
    conn = db()
    world.key = KEY
    chosen = im.provider_for(settings, conn)
    assert isinstance(chosen, im.WiskeyBridgeProvider), "the rotated key signs on v2"
    assert chosen.media.direct.v2_enabled is True and isinstance(chosen.media.fallback, im._V1OnlyFallback)
    assert im._bridge_for == (id(settings), id(im.database_of(conn)), "direct_v2")
    assert im.signing_problem(conn) is None
    r = im.readiness(settings, conn, read=False)
    assert "pairing_key_rotated" not in r["missing"] and "pairing_missing" not in r["missing"] and r["wiskey"]["signing"] is True
    world.key = ha_bridge.BridgeKey("x-material", "not a kid")
    assert im.signing_problem(conn) == "key_rotated" and im.provider_for(settings, conn).name == "local"
    world.key = None
    assert im.signing_problem(conn) == "not_paired" and im.provider_for(settings, conn).name == "local"
    assert MATERIAL not in repr(chosen) + repr(chosen.media.direct) + repr(chosen.media.fallback)


def test_switching_the_gate_replaces_the_provider_and_closes_the_earlier_one(world, settings):
    conn = db(gate="off")
    first = world.provider(settings, conn)
    assert world.provider(settings, conn) is first
    set_row(conn, media_v2.SETTING_KEY, "on")
    second = world.provider(settings, conn)
    assert second is not first and first.video.closed and second.media.direct.v2_enabled
    set_row(conn, media_v2.BRIDGE_VERSION_KEY, "0.10.8")  # the bridge went back: the gate closes by itself
    third = world.provider(settings, conn)
    assert third is not second and second.video.closed and third.media.direct.v2_enabled is False


def test_on_a_v1_key_still_takes_the_v1_socket(world, media_settings, registered):
    conn = db()
    world.key = SECRET
    p = world.provider(media_settings, conn)
    p.video_stream(None, media_settings, STATION, "main")
    assert world.opened_v1 == 1 and world.v2.opened == 0 and world.ha_calls == []
    assert {m["bridge"]["kind"] for dc in world.v1.connections for m in dc.messages} == {"wiskey-bridge-command.v1"}


# ================================================================ on: video and talk on the signed v2 connection

def test_video_reads_descriptor_and_lease_as_arx_on_one_v2_connection(world, media_settings, registered, caplog):
    conn = db()
    p = world.provider(media_settings, conn)
    with caplog.at_level(logging.DEBUG):
        name = p.video_stream(None, media_settings, STATION, "main", actor=w10.Actor("someone-else", "Someone Else"))
    assert name.startswith("smplwise_wiskey_entry-a.w10.") and len(registered) == 1
    assert world.v2.opened == 1 and world.opened_v1 == 0 and world.ha_calls == [], "v2 only: no v1 socket, no Home Assistant path"
    assert world.v2.media_commands() == [(w10.DESCRIBE, "wiskey-bridge-command.v2"), (w10.STREAM_LEASE, "wiskey-bridge-command.v2")]
    describe, lease = world.station.by_command(w10.DESCRIBE)[0], world.station.by_command(w10.STREAM_LEASE)[0]
    assert describe.conn == lease.conn and describe.params["actor"] == {"id": "arx", "display_name": "Arx"}
    assert p.media.last_kind == "direct_api" and p.media.direct.last_attempt_version == 2
    assert p.media.direct.last_identity["kid"] == KID and p.media.direct.last_identity["protocol_version"] == 2
    assert MATERIAL not in caplog.text and MATERIAL not in name and "fixture-pass" not in caplog.text


def test_a_talk_runs_whole_on_its_own_v2_connection_and_only_on_the_fake(world, media_settings):
    conn = db()
    p = world.provider(media_settings, conn)

    async def scenario() -> None:
        channel = talk_channel(p, media_settings)
        await channel.open()
        assert channel.link.protocol_version == 2 and channel.link.kid == KID
        await channel.floor(True)
        for _ in range(12):
            await channel.send_frame(FRAME)
            await asyncio.sleep(0.01)
        await until(lambda: sum(c for _t, _f, c in world.station.batches) >= 10)
        await channel.floor(False)
        await channel.close("stopped")
        assert await channel.wait_closed() in ("stopped", "upstream_closed")

    run(scenario())
    media = world.v2.media_commands()
    talk = [c for c, _k in media]
    assert {k for _c, k in media} == {"wiskey-bridge-command.v2"}, "every media command is signed v2"
    assert w10.TALK_OPEN in talk and w10.TALK_FLOOR in talk and w10.TALK_FRAME in talk and talk[-1] == w10.TALK_CLOSE
    assert world.v2.opened == 2, "one shared video connection (the descriptor) and one dedicated talk connection"
    assert world.opened_v1 == 0 and world.ha_calls == []
    assert not world.station.talks and not world.station.station_talk, "the fake station's lock is released"


def test_wiskeys_signed_talk_closed_on_v2_ends_the_talk_without_a_close(world, media_settings):
    p = world.provider(media_settings, db())

    async def scenario() -> str:
        channel = talk_channel(p, media_settings)
        await channel.open()
        world.station.emit_closed(world.station.talks[channel.ref], "source_changed")
        reason = await asyncio.wait_for(channel.wait_closed(), 2)
        await channel.close(reason)
        return reason

    assert run(scenario()) == "upstream_closed"
    assert world.station.by_command(w10.TALK_CLOSE) == []


# ================================================================ on: refusals and unknown outcomes never fall back

def test_a_refused_v2_connect_ends_the_talk_open_with_no_v1_and_no_home_assistant_path(world, media_settings):
    p = world.provider(media_settings, db())
    d = p.describe(None, media_settings, STATION)  # the descriptor read while WisKey still accepts the key
    world.v2.material = "another-pairing-material-not-ours"  # WisKey's bridge no longer verifies Arx's v2 key

    async def scenario() -> ApiError:
        channel = p.talk_open(media_settings, "entry-a", d, actor_id="op-1", actor_name="Dana Operator", request_id="req-1",
                              expires_at=time.time() + 60)
        with pytest.raises(ApiError) as exc:
            await channel.open()
        return exc.value

    err = run(scenario())
    assert err.status == 503 and err.details == {"reason": "provider_forbidden"}
    assert world.opened_v1 == 0 and world.ha_calls == [], "no v1 socket and no Home Assistant path after a v2 refusal"
    assert p.media.last_direct_error is None and p.media._direct_down_until == 0.0, "no fallback window was opened either"
    opened = world.v2.opened
    run(scenario())
    assert world.v2.opened == opened + 1, "the next request is a new v2 attempt (new socket, new nonce); nothing is retried inside one"


def test_a_refused_v2_video_read_is_never_retried_on_v1(world, media_settings):
    p = world.provider(media_settings, db())
    world.v2.material = "another-pairing-material-not-ours"
    with pytest.raises(bridge.MediaBridgeError) as exc:
        p.video.describe("entry-a", w10.SYSTEM_ACTOR, "arx-req-1")
    assert exc.value.code == "direct_connect_refused"
    assert world.v2.opened == 1 and world.opened_v1 == 0 and world.ha_calls == []


def test_a_command_refusal_on_v2_stands_and_is_sent_once(world, media_settings):
    p = world.provider(media_settings, db())
    world.station.errors[w10.TALK_OPEN] = "Unauthorized"

    async def scenario() -> ApiError:
        channel = talk_channel(p, media_settings)
        with pytest.raises(ApiError) as exc:
            await channel.open()
        return exc.value

    err = run(scenario())
    assert err.status == 503 and err.details == {"reason": "provider_forbidden"}
    assert [c for c, _k in world.v2.media_commands()].count(w10.TALK_OPEN) == 1
    assert world.opened_v1 == 0 and world.ha_calls == []


def test_an_unknown_v2_outcome_is_never_replayed(world, media_settings, monkeypatch):
    p = world.provider(media_settings, db())
    monkeypatch.setattr(im.WiskeyBridgeTalkChannel, "OPEN_TIMEOUT_S", 0.3)
    world.v2.script[w10.TALK_OPEN] = "silent"  # sent, never answered: its outcome is unknown

    async def scenario() -> ApiError:
        channel = talk_channel(p, media_settings)
        with pytest.raises(ApiError) as exc:
            await channel.open()
        assert channel.link is None, "the connection is dropped"
        return exc.value

    err = run(scenario())
    assert err.status == 503 and err.details == {"reason": "provider_error"}  # media_outcome_unknown
    assert [c for c, _k in world.v2.media_commands()].count(w10.TALK_OPEN) == 1, "an unknown outcome is not sent again"
    assert world.opened_v1 == 0 and world.ha_calls == []


def test_a_key_that_changes_under_an_open_v2_connection_is_never_used_on_it(world, media_settings):
    p = world.provider(media_settings, db())

    async def scenario() -> None:
        link = await p.media.connect(bridge.PURPOSE_TALK)
        sent = len(world.v2.commands)
        world.key = ha_bridge.BridgeKey("the-next-material", OTHER_KID)  # the key set moved on
        with pytest.raises(bridge.MediaBridgeError) as exc:
            await link.call(w10.DESCRIBE, w10.descriptor_params("entry-a", w10.SYSTEM_ACTOR, "arx-req-2"), timeout=5)
        assert (exc.value.code, exc.value.outcome) == ("bridge_key_changed", "not_sent") and link.closed
        assert len(world.v2.commands) == sent, "nothing was signed or sent with the old key"

    run(scenario())
    assert world.opened_v1 == 0 and world.ha_calls == []


def test_inside_autos_retry_window_a_rotated_key_never_opens_the_home_assistant_path(world, settings):
    p = world.provider(settings, db())
    p.media._direct_down_until = time.monotonic() + 60  # as after an earlier v1 direct failure
    with pytest.raises(bridge.MediaBridgeError) as exc:
        run(p.media.connect(bridge.PURPOSE_VIDEO))
    assert exc.value.code == "bridge_key_rotated" and world.ha_calls == [] and world.v2.opened == 0
    world.key = SECRET  # a v1 key: the window serves the Home Assistant path, exactly as before
    link = run(p.media.connect(bridge.PURPOSE_VIDEO))
    assert world.ha_calls == [bridge.PURPOSE_VIDEO] and p.media.last_kind == "signed_bridge_ws"
    assert link is not None


# ================================================================ the listen gate (R5) on v2

def test_a_listen_the_fresh_v2_descriptor_does_not_offer_is_refused_before_talk_open(world, media_settings):
    p = world.provider(media_settings, db())
    d = p.describe(None, media_settings, STATION)

    async def scenario() -> ApiError:
        channel = im.WiskeyBridgeTalkChannel(p, media_settings, d, w10.Actor("op-1", "Dana Operator"), "req-listen", time.time() + 60,
                                             listen_only=True)
        with pytest.raises(ApiError) as exc:
            await channel.open()
        return exc.value

    err = run(scenario())
    assert err.status == 503 and err.details == {"reason": "listen_not_offered"}
    sent = [c for c, _k in world.v2.media_commands()]
    assert w10.TALK_OPEN not in sent and sent.count(w10.DESCRIBE) == 2, "the shared descriptor, then the listen's own read-only one"
    assert not world.station.talks and world.opened_v1 == 0 and world.ha_calls == []


# ================================================================ the signed capabilities on v2

def test_on_the_signed_listing_of_a_rotated_key_is_read_on_its_v2_socket(world, settings):
    conn = db()
    caps.set_opener_for_tests(world.v1_opener, opener_v2=world.v2.opener)
    found = im.listing(settings, conn, api_reader=lambda _s: overview(with_w10=False))
    assert found.signed is not None and found.signed.ok and found.video and found.talk and found.source == "capabilities"
    assert [(c, k, p) for c, k, p in world.v2.commands] == [(c, "wiskey-bridge-command.v2", {}) for c in DISCOVERY]
    assert world.v2.opened == 1 and world.opened_v1 == 0
    assert im.listing(settings, conn, api_reader=lambda _s: overview(with_w10=False)).signed is found.signed, "cached for that key"
    world.key = ha_bridge.BridgeKey("the-next-material", OTHER_KID)
    assert caps.cached((caps.key_fingerprint(world.key, v2=True), "auto")) is None, "another kid is another entry"
    assert caps.key_fingerprint(KEY, v2=True) not in (None, caps.key_fingerprint(SECRET)), "never a v1 entry's fingerprint"


def test_a_pairing_status_for_another_key_makes_the_v2_listing_unread_and_nothing_falls_back(world, settings):
    conn = db()
    caps.set_opener_for_tests(world.v1_opener, opener_v2=world.v2.opener)
    world.v2.pairing = pairing_doc(OTHER_KID)
    found = im.listing(settings, conn, api_reader=lambda _s: overview(with_w10=False))
    assert found.signed is not None and not found.signed.ok and found.unread and not found.video
    assert world.opened_v1 == 0 and world.ha_calls == []


def test_off_the_signed_listing_never_reads_for_a_rotated_key(world, settings):
    conn = db(gate="off")
    caps.set_opener_for_tests(world.v1_opener, opener_v2=world.v2.opener)
    found = im.listing(settings, conn, api_reader=lambda _s: overview(with_w10=False))
    assert found.signed is None and not found.video and world.v2.opened == 0 and world.opened_v1 == 0


def test_the_joins_document_counts_for_v2_only_when_it_is_v2_for_the_same_kid(monkeypatch):
    from types import SimpleNamespace

    from smplwise.services import wiskey_direct_join

    now = datetime.now(timezone.utc)

    def join_with(protocol: int, kid: str | None) -> Any:
        cap = SimpleNamespace(connection_ref="ref-1", protocol_version=protocol, kid=kid, commands=tuple(w10.COMMANDS))
        t = SimpleNamespace(admits=lambda _w: None, server=now)
        disc = SimpleNamespace(capabilities=cap, time=t, window_s=bridge.WINDOW_S)
        session = SimpleNamespace(transport_refusal=lambda _c: None, _link=SimpleNamespace(connection_ref="ref-1", kid=kid), discovery=disc)
        return SimpleNamespace(configured=lambda: True, session=session)

    marker = ("fp", "auto")
    for protocol, kid, want in ((2, KID, True), (2, OTHER_KID, False), (1, None, False)):
        monkeypatch.setattr(wiskey_direct_join, "installed", lambda j=join_with(protocol, kid): j)
        got = caps._from_join(marker, kid=KID)
        assert (got is not None and got.ok) is want, (protocol, kid)
    monkeypatch.setattr(wiskey_direct_join, "installed", lambda: join_with(1, None))
    assert caps._from_join(marker) is not None, "without a kid (a v1 key): the join's document as before"


# ================================================================ the setting (PATCH /settings)

def test_the_switch_is_a_system_administrators_needs_bridge_0_10_9_and_is_audited(settings):
    from smplwise.db import set_setting
    from smplwise.main import create_app

    app = create_app(settings)
    c = TestClient(app)
    api = "/api/v1/settings"
    assert c.get(api).json()["settings"][media_v2.SETTING_KEY] == "off"

    def rows() -> list[tuple[str, str | None]]:
        with app.state.db.connection(mode="read") as conn:
            return [(r["decision"], r["reason"]) for r in conn.execute("SELECT decision, reason FROM audit_log WHERE action = ? ORDER BY id",
                                                                       (media_v2.SETTING_KEY,))]

    r = c.patch(api, json={media_v2.SETTING_KEY: "on"})
    assert r.status_code == 409 and r.json()["code"] == "bridge_outdated" and r.json()["details"]["required"] == "0.10.9"
    with app.state.db.connection() as conn:
        set_setting(conn, media_v2.BRIDGE_VERSION_KEY, "0.10.8")
    assert c.patch(api, json={media_v2.SETTING_KEY: "on"}).status_code == 409
    with app.state.db.connection() as conn:
        set_setting(conn, media_v2.BRIDGE_VERSION_KEY, "0.10.9")
    assert c.patch(api, json={media_v2.SETTING_KEY: "on"}).status_code == 200
    assert c.get(api).json()["settings"][media_v2.SETTING_KEY] == "on"
    assert c.patch(api, json={media_v2.SETTING_KEY: "on"}).status_code == 200, "a repeated value: no change, no row"
    assert c.patch(api, json={media_v2.SETTING_KEY: "off"}).status_code == 200
    assert c.patch(api, json={media_v2.SETTING_KEY: "maybe"}).status_code == 422
    assert rows() == [("denied", "bridge_outdated"), ("denied", "bridge_outdated"), ("allowed", None), ("allowed", None)]


# ================================================================ rotation stays blocked while WisKey is installed (owner Q8)

def test_this_row_does_not_lift_the_rotation_block():
    from pathlib import Path

    src = (Path(__file__).resolve().parents[1] / "smplwise" / "services" / "bridge_rotation.py").read_text(encoding="utf-8")
    assert 'raise RotationRefused("wiskey_present")' in src, "while WisKey is installed the key is never rotated: v2 media stays dormant"
