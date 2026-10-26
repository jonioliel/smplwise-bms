"""WKCLOSE-295: the Arx half of the shared-Home-Assistant completion question (WMR6-HA-01 / W-002) on the REAL `HaWsConnection`.
FAKES ONLY: a scripted `ha_client.ws_session` stands for Home Assistant and routes every socket to the fake WisKey (`w10_fake_station`);
nothing here reaches a network, Home Assistant, a station, a door, a microphone, a speaker or a provider.

What these tests pin (docs/changes/WKCLOSE-295-CLOSEOUT.md section B):
- SOCKET OWNERSHIP on the HA path of this candidate: `WiskeyBridgeTalkChannel.open` calls `media.connect(PURPOSE_TALK)` and the HA
  transport (`SignedBridgeTransport` over `ha_connector`) opens ONE NEW Home Assistant socket per call (`HaWsConnection.open` ->
  `ha_client.ws_session`). A talk's socket is therefore dedicated to that talk and owned by Arx; no other talk, video link or owner uses it.
- the GAP as delivered (pairing revoke with the socket still open: WisKey ends the talk and swallows `media/talk_closed`): nothing ends the
  original waiter except Arx's own bound (the router's session deadline); the close then touches ONLY that talk's own socket.
- the ONLY terminal Arx can consume on that path needs NO Arx change and NO new wire field: the existing `media/talk_closed` event on the
  talk's own subscription. Whether WisKey may send it for a revoked pairing is the open Mac decision (not decided here)."""
from __future__ import annotations

import asyncio
import base64
import time
from types import SimpleNamespace
from typing import Any

import pytest
from test_wkf01f02_295 import OPTS, ListeningStation, SocketDouble, gset, listen_schema, session, settle  # noqa: F401 - fixtures
from w10_fake_station import SECRET, FakeConn

from smplwise.routers import intercom_media as router_im
from smplwise.services import ha_client
from smplwise.services import intercom_media as im
from smplwise.services import wiskey_media_bridge as bridge
from smplwise.services import wiskey_media_contract as w10

SIX = {w10.DESCRIBE, w10.STREAM_LEASE, w10.TALK_OPEN, w10.TALK_FRAME, w10.TALK_FLOOR, w10.TALK_CLOSE}
PACKET = bytes([0x55]) * 800


class HaSocket:
    """One Home Assistant WebSocket as the fake core sees it: its `ActiveConnection` is the fake WisKey connection."""

    def __init__(self, conn: FakeConn, stop: asyncio.Event) -> None:
        self.conn, self.stop = conn, stop

    @property
    def open(self) -> bool:
        return not self.conn.closed and not self.stop.is_set()


class HaCore:
    """A fake Home Assistant core. Every `ha_client.ws_session` call is ONE socket (one `ActiveConnection`); it never reuses one."""

    def __init__(self, station: ListeningStation) -> None:
        self.station = station
        self.sockets: list[HaSocket] = []

    def install(self, monkeypatch: pytest.MonkeyPatch) -> None:
        core = self

        async def fake_ws_session(settings, on_ready, on_event, stop, on_message=None, *, url=None, token=None, internal_tls=False):
            conn = core.station.connect()
            sock = HaSocket(conn, stop)
            core.sockets.append(sock)
            # an integration event reaches the client as `{id, type: "event", event: {...}}` on the subscription of the talk_open request
            conn.event_handler = lambda event: on_message({"id": 1, "type": "event", "event": event}) if on_message is not None else None

            async def call(msg_type: str, **kw: Any) -> dict[str, Any]:
                if msg_type == "auth/current_user":
                    return {"id": 1, "type": "result", "success": True, "result": {"id": conn.user_id, "name": "service"}}
                if conn.closed:
                    raise ConnectionError("closed")
                conn.sent += 1
                return await core.station.handle(conn, {"id": conn.sent, "type": msg_type, **kw})

            try:
                await on_ready(call)
                await stop.wait()
            finally:
                conn.drop()  # the socket ends: WisKey cancels the talk of THIS connection (and only of it)

        monkeypatch.setattr(ha_client, "ws_session", fake_ws_session)

    def socket_of(self, ref: str) -> HaSocket:
        owners = [s for s in self.sockets if s.conn.talk is not None and s.conn.talk.ref == ref]
        assert len(owners) == 1, "exactly one socket carries a talk"
        return owners[0]


async def ha_talk(core: HaCore, settings: Any, station_id: str, request: str) -> im.WiskeyBridgeTalkChannel:
    """A talk channel whose transport is the signed bridge over the REAL `HaWsConnection` (no direct API in this build of the test)."""
    async def connector(_purpose: str) -> Any:
        return await bridge.HaWsConnection.open(object())

    media = bridge.SignedBridgeTransport(connector, bridge.BridgeSigner(lambda: SECRET))
    api = {"commands": [w10.DESCRIBE, w10.STREAM_LEASE, w10.TALK_OPEN, w10.TALK_FRAME, w10.TALK_FLOOR, w10.TALK_CLOSE]}
    provider = im.WiskeyBridgeProvider(media, discovery=lambda _s: api, pump_options=dict(OPTS))
    link = await media.connect(bridge.PURPOSE_VIDEO)
    try:
        raw = await link.call(w10.DESCRIBE, w10.descriptor_params(station_id, w10.SYSTEM_ACTOR, "arx-d-" + request), timeout=2)
    finally:
        await link.close()
    d = im.parse_descriptor(w10.project_descriptor(raw), station_id=station_id, provider=provider.name)
    return im.WiskeyBridgeTalkChannel(provider, settings, d, w10.Actor("op-" + request, "Dana Operator"), "req-" + request, time.time() + 60)


def _signed(station: ListeningStation, *commands: str) -> int:
    return sum(len(station.by_command(c)) for c in commands)


def test_the_ha_path_gives_every_talk_its_own_socket_and_a_close_touches_only_that_socket(monkeypatch, gset, listen_schema):
    """Socket ownership on the HA path: two talks (two stations) = two distinct Home Assistant sockets; ending one closes that socket
    only. The other owner's talk, socket and waiter are untouched; nothing closes a general or shared connection."""
    station = ListeningStation()
    core = HaCore(station)
    core.install(monkeypatch)

    async def scenario() -> None:
        first = await ha_talk(core, gset, "entry-a", "a")
        second = await ha_talk(core, gset, "entry-b", "b")
        await first.open()
        await second.open()
        s1, s2 = core.socket_of(first.ref), core.socket_of(second.ref)
        assert s1 is not s2 and s1.conn is not s2.conn and s1.open and s2.open, "one dedicated socket per talk"
        assert first.link.raw is not second.link.raw and isinstance(first.link.raw, bridge.HaWsConnection)
        await first.close("ended")
        assert not s1.open and s1.stop.is_set(), "the closed talk's own socket is closed"
        assert s2.open and second.ref in station.talks and not second._future().done(), "the other owner is untouched"
        assert _signed(station, w10.TALK_CLOSE) == 1, "one talk_close, for the closed talk only"
        await second.close("ended")
        assert not s2.open
        assert {r.command for r in station.requests} <= SIX, "no command outside the six; no new wire field (the fake verifies every envelope)"

    asyncio.run(scenario())


def test_pairing_revoke_on_an_open_ha_socket_leaves_the_waiter_to_arxs_own_bound_and_touches_no_other_socket(monkeypatch, gset, listen_schema):
    """WMR6-HA-01 AS DELIVERED, on the real HaWsConnection: WisKey ends the talk (the pairing is gone) and swallows `media/talk_closed`;
    the socket stays open. Nothing ends the original waiter by an event: it ends at Arx's own session deadline (the router's watch), with
    ONE talk_close for the original ref (refused: session_expired), no replay of the open, no late audio and no renewal. The bystander
    owner's socket and talk are never touched. This bounds the gap; it is not the completion contract."""
    station = ListeningStation()
    core = HaCore(station)
    core.install(monkeypatch)

    async def scenario() -> None:
        victim = await ha_talk(core, gset, "entry-a", "a")
        bystander = await ha_talk(core, gset, "entry-b", "b")
        await victim.open()
        await bystander.open()
        sv, sb = core.socket_of(victim.ref), core.socket_of(bystander.ref)
        t = session(0.4)
        victim.expires_at = t.expires_at
        ws = SocketDouble()
        task = asyncio.create_task(router_im._pump(ws, t, victim, SimpleNamespace(should_stop=lambda: False)))
        station.end_talk(sv.conn.talk)  # the pairing was revoked: the native resource is gone, NO event reaches the subscription
        assert sv.open, "the HA socket is still open (WisKey did not close it)"
        with pytest.raises(asyncio.TimeoutError):
            await asyncio.wait_for(asyncio.shield(victim.wait_closed()), 0.25)  # nothing ends the original waiter
        assert not task.done()
        outcome = await asyncio.wait_for(task, 3)
        assert outcome == "expired", "only Arx's own deadline ends it"
        await victim.close(outcome)
        assert not sv.open and ws.sent_bytes == []
        assert _signed(station, w10.TALK_OPEN) == 2, "one open per talk (victim + bystander), never replayed"
        assert _signed(station, w10.TALK_CLOSE) == 1, "one close for the original ref (answered session_expired), never repeated"
        assert _signed(station, w10.TALK_FLOOR, w10.TALK_FRAME) == 0, "no authority renewal, no keepalive"
        assert sb.open and bystander.ref in station.talks and not bystander._future().done(), "the other owner is untouched"
        await bystander.close("ended")

    asyncio.run(scenario())


@pytest.mark.parametrize("reason", ["access_lost", "idle_timeout", "expired"])
def test_the_existing_talk_closed_event_on_the_original_ha_subscription_ends_the_waiter_with_no_arx_change(monkeypatch, gset, listen_schema, reason):
    """The ONLY terminal the HA path can carry without a new wire field or an Arx change: WisKey's existing `media/talk_closed` on the talk's
    own subscription (the request the talk was opened on), as `HaWsConnection._on_frame` -> `_on_event` -> `TalkPump.remote_closed` already
    consume it. The original waiter ends, Arx signs nothing more for that ref, closes only its own socket, and a late audio event after the
    end is never served. Whether WisKey MAY send it for a revoked pairing is the open Mac decision; this test does not decide it."""
    station = ListeningStation()
    core = HaCore(station)
    core.install(monkeypatch)

    async def scenario() -> None:
        victim = await ha_talk(core, gset, "entry-a", "a")
        bystander = await ha_talk(core, gset, "entry-b", "b")
        await victim.open()
        await bystander.open()
        sv, sb = core.socket_of(victim.ref), core.socket_of(bystander.ref)
        talk = sv.conn.talk
        station.emit_closed(talk, reason)  # one `media/talk_closed` frame on the original subscription
        assert await asyncio.wait_for(victim.wait_closed(), 1) == "upstream_closed"
        assert victim.pump.closed_by_wiskey and sv.open, "ended by the event; the socket itself is Arx's to close"
        victim._on_event({"type": "media/talk_audio", "schema": "arx.station_talk_audio.v1", "talk_ref": victim.ref, "seq": 0, "codec": "pcmu",
                          "sample_rate": 8000, "channels": 1, "data": base64.b64encode(PACKET).decode()})  # a late packet
        with pytest.raises(bridge.MediaBridgeError):
            await asyncio.wait_for(victim.receive_audio(), 1)
        await victim.close("upstream_closed")
        assert _signed(station, w10.TALK_CLOSE) == 0, "WisKey closed it: Arx signs nothing more for the ref"
        assert _signed(station, w10.TALK_FLOOR, w10.TALK_FRAME) == 0 and _signed(station, w10.TALK_OPEN) == 2
        assert not sv.open and sb.open and bystander.ref in station.talks, "only the talk's own socket closed"
        await bystander.close("ended")

    asyncio.run(scenario())
