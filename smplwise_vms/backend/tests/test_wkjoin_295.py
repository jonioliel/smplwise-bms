"""WKINT-295 (FAKES ONLY): the join of WisKey's direct transport (WKDIRECT-295) with the command port of the native people writes
(WKWRITE-295) and the synchronous direct port of capture / features / templates (WKCAP-295), and the selection rule that installs them.

The WisKey here is the in-memory fake direct server of tests/w10_fake_direct.py (hello, signed direct/connect, the `arx-service:`
subject, every reply MAC-wrapped), extended below with an INDEPENDENT check of the generic signed envelope and a scripted answer per
command; the native people write is served by tests/wkwrite_fake.FakeWisKey behind that same socket. Nothing here contacts a network,
Home Assistant, a station or WisKey; nothing is installed or switched on anywhere."""
from __future__ import annotations

import asyncio
import hashlib
import hmac
import json
import re
import sqlite3
import uuid
from datetime import datetime, timedelta, timezone
from pathlib import Path
from types import SimpleNamespace
from typing import Any

import pytest
from w10_fake_direct import DOMAIN, FakeDirectServer, Refusal, canonical
from w10_fake_station import SECRET, FakeStation
from wkwrite_fake import FakeWisKey

from smplwise.services import intercom_client, intercom_sync, lease_events
from smplwise.services import wa_template_send as wts
from smplwise.services import wiskey_capture_direct as wcd
from smplwise.services import wiskey_command_port as cp
from smplwise.services import wiskey_direct_join as join
from smplwise.services import wiskey_media_bridge as bridge
from smplwise.services import wiskey_native_write as nw
from smplwise.services import wiskey_template_direct as wtd
from smplwise.services import wiskey_write_lineage as wl
from smplwise.services.wiskey_capture_port import PortError, WiskeyDirectPort

BRIDGE_FIELDS = {"kind", "command", "query_owner_id", "issued_at", "expires_at", "parameters", "ts", "nonce", "sig"}
PIN_MARK = "MRKPIN-JOIN-4471"


class JoinServer(FakeDirectServer):
    """The fake direct server plus generic commands: each request's envelope is checked by this file's OWN code (closed key set,
    the expected kind, the server-issued subject, 0 < TTL <= 15 s, a fresh nonce, the HMAC recipe) before it is answered from
    `script` (`{"result": ...}` | `{"error": code}` | "drop" | "close" | "badmac") or by `people` (a FakeWisKey)."""

    def __init__(self, **kw: Any) -> None:
        super().__init__(FakeStation(), entry_id="entry-1", **kw)
        self.script: dict[str, Any] = {}
        self.received: list[tuple[str, str, dict[str, Any]]] = []
        self.people: FakeWisKey | None = None
        # WKR5-295: the two discovery reads are answered from WisKey's shapes (direct_bridge_discovery.py): the discovered command names
        # of the round-5 catalog (or `discovered` when a test sets it) and this process's clock shifted by `clock_offset_s`.
        self.discovered: set[str] | None = None
        self.clock_offset_s = 0.0

    def capabilities_doc(self) -> dict[str, Any]:
        from smplwise.services import wiskey_direct_catalog as wdc

        names = sorted(self.discovered if self.discovered is not None else {e.command for e in wdc.load().entries() if e.discovered})
        return {"schema_version": 1, "protocol": "wiskey-direct-ws.v1", "families": sorted({n.split("/")[0] for n in names}),
                "commands": [{"name": n, "envelope": "wiskey-direct-ws.v1", "api_contract": None, "explicit_parameter_version": None} for n in names],
                "limits": {"max_connections_including_preparing": 32, "max_audio_sessions_including_legacy_and_TTS": 3, "nonce_capacity": 65536,
                           "nonce_window_seconds": 120, "talk_batch_sizes": [5, 10], "max_command_ttl_seconds": 15, "hello_timeout_seconds": 10},
                "station_media_contract": "wiskey-station-media.v1", "stations": [], "resources": {"features": None, "template_host_bound": False},
                "lifecycle": {"pairing_rotation": "old_connection_invalidated_reconnect_required", "kid_in_v1": False,
                              "event_cursor_resume": False, "reconnect_adopts_old_resources": False},
                "physical_result": "unproven"}

    def time_doc(self) -> dict[str, Any]:
        now = datetime.now(timezone.utc) + timedelta(seconds=self.clock_offset_s)
        return {"schema_version": 1, "server_utc": now.isoformat(), "max_ts_skew_seconds": 60, "max_issued_future_seconds": 2,
                "max_command_ttl_seconds": 15}

    def _check(self, dc: Any, message: dict[str, Any]) -> tuple[str, str, dict[str, Any]]:
        b = message.get("bridge")
        if set(message) != {"id", "type", "bridge"} or not isinstance(b, dict) or set(b) != BRIDGE_FIELDS:
            raise Refusal("invalid_fields")
        command = message["type"].removeprefix(DOMAIN + "/")
        body = {k: v for k, v in b.items() if k not in ("ts", "nonce", "sig")}
        digest = hashlib.sha256(canonical(body)).hexdigest()
        want = hmac.new(self.secret.encode("utf-8"), f"{b['ts']}.{b['nonce']}.{digest}".encode("utf-8"), hashlib.sha256).hexdigest()
        if not hmac.compare_digest(want, b["sig"]) or b["nonce"] in self.nonces or re.fullmatch(r"[0-9a-f]{16,32}", b["nonce"]) is None:
            raise Refusal("Unauthorized")
        self.nonces.add(b["nonce"])
        expected_kind = "wiskey-peer-query.v1" if command in cp.PEER_QUERY_COMMANDS else "wiskey-bridge-command.v1"
        issued = datetime.fromisoformat(b["issued_at"])
        expires = datetime.fromisoformat(b["expires_at"])
        if (b["kind"] != expected_kind or b["command"] != command or b["query_owner_id"] != self.subject or dc.subject != self.subject
                or not timedelta(0) < expires - issued <= timedelta(seconds=15)):
            raise Refusal("Unauthorized")
        return command, b["kind"], b["parameters"]

    async def _dispatch(self, dc: Any, message: dict[str, Any]) -> None:
        if message["type"].startswith(DOMAIN + "/media/"):
            return await super()._dispatch(dc, message)
        command, kind, params = self._check(dc, message)
        self.received.append((command, kind, params))
        mid = message["id"]
        act = self.script.get(command)
        if act is None and command in ("direct/capabilities", "direct/time"):
            if params != {}:  # WisKey: exactly empty signed parameters
                await dc.send_frame({"id": mid, "type": "result", "success": False, "error": {"code": "invalid_fields", "message": "x"}})
                return
            doc = self.capabilities_doc() if command == "direct/capabilities" else self.time_doc()
            await dc.send_frame({"id": mid, "type": "result", "success": True, "result": doc})
            return
        if act == "drop":
            return
        if act == "close":
            await dc.sock.close()
            return
        if act is None and self.people is not None:
            try:
                result = await self.people.send_signed(command, params, operation_id=None)
            except cp.WiskeyCommandError as exc:
                if exc.outcome == cp.REFUSED:
                    await dc.send_frame({"id": mid, "type": "result", "success": False, "error": {"code": exc.code, "message": "x"}})
                return  # a fault the fake calls unknown: no answer
            await dc.send_frame({"id": mid, "type": "result", "success": True, "result": result})
            return
        if act == "badmac":
            saved = self.tamper
            self.tamper = lambda m: {**m, "sig": "0" * 64}
            await dc.send_frame({"id": mid, "type": "result", "success": True, "result": {"ok": True}})
            self.tamper = saved
            return
        if isinstance(act, dict) and "error" in act:
            await dc.send_frame({"id": mid, "type": "result", "success": False, "error": {"code": act["error"], "message": "refused"}})
            return
        result = act["result"] if isinstance(act, dict) else {"echo": command}
        await dc.send_frame({"id": mid, "type": "result", "success": True, "result": result})


@pytest.fixture(autouse=True)
def _restore_process_state() -> Any:
    saved = (lease_events.TRANSPORT, wts.TRANSPORT_PROVIDER, join.JOIN)
    yield
    lease_events.TRANSPORT, wts.TRANSPORT_PROVIDER, join.JOIN = saved


@pytest.fixture()
def env() -> Any:
    server = JoinServer()
    transport = bridge.DirectApiTransport(server.opener, lambda: SECRET)
    session = join.DirectCommandSession(transport)
    yield SimpleNamespace(server=server, session=session, cmd=join.DirectCommandPort(session, timeout_s=2.0),
                          cap=join.DirectCapturePort(session))
    try:
        session.run_sync(server.stop(), 5)
    except Exception:  # noqa: BLE001
        pass
    session.close()


def received(server: JoinServer, command: str) -> list[dict[str, Any]]:
    return [p for c, _k, p in server.received if c == command]


# ================================================================ the two ports, a signed round trip

def test_both_adapters_satisfy_their_ports(env: Any) -> None:
    assert isinstance(env.cmd, cp.WiskeyCommandPort)
    for name in ("identity", "call", "media_ingress_header", "open_media"):
        assert callable(getattr(env.cap, name))
    _typed: WiskeyDirectPort = env.cap  # structural (Protocol) typing
    assert "SECRET" not in repr(env.cmd) + repr(env.cap) + repr(env.session) and SECRET not in repr(env.session)


def test_async_port_signed_round_trip_from_a_foreign_loop(env: Any) -> None:
    env.server.script["users/get_thing"] = {"result": {"n": 7, "ratio": 1.5}}

    async def main() -> Any:
        return await env.cmd.send_signed("users/get_thing", {"user_id": "u-1"}, operation_id="op-1")

    result = asyncio.run(main())  # a loop that is NOT the session's: bridged, never blocked
    assert result == {"n": 7, "ratio": 1.5} and type(result["n"]) is int  # JSON number types kept
    assert env.server.received == [("users/get_thing", "wiskey-bridge-command.v1", {"user_id": "u-1"})]
    assert env.server.opened == 1


def test_peer_query_commands_ride_the_peer_query_envelope(env: Any) -> None:
    for command in sorted(cp.PEER_QUERY_COMMANDS):
        asyncio.run(env.cmd.send_signed(command, {"x": 1}, operation_id=None))
    kinds = {c: k for c, k, _p in env.server.received}
    assert kinds == {c: "wiskey-peer-query.v1" for c in cp.PEER_QUERY_COMMANDS}
    asyncio.run(env.cmd.send_signed("users/create", {"data": {}}, operation_id="op-2"))
    assert env.server.received[-1][1] == "wiskey-bridge-command.v1"


def test_command_names_never_carry_the_domain_prefix(env: Any) -> None:
    with pytest.raises(cp.WiskeyCommandError) as exc:
        asyncio.run(env.cmd.send_signed("hikvision_intercom/users/create", {}, operation_id=None))
    assert exc.value.outcome == cp.NOT_SENT and env.server.received == []


def test_sync_port_round_trip_identity_and_media_header(env: Any) -> None:
    text = '{"signed":"inner"}'
    out = env.cap.call(wcd.EVENT_COMMAND, {wcd.DATA_KEY: text}, timeout_s=2.0)
    assert out == {"echo": "capture/lease_event"}
    assert received(env.server, "capture/lease_event") == [{"signed_message_json": text}]  # the inner text exactly
    ident = env.cap.identity()
    dc = env.server.connections[0]
    assert ident.query_owner_id == "arx-service:entry-1" and ident.entry_id == "entry-1"
    assert ident.connection_ref == dc.challenge and ident.repository_id == "repo-fixture-1"
    header = json.loads(env.cap.media_ingress_header(ticket="t-1", preparation_ref="prep-1"))
    assert set(header) == BRIDGE_FIELDS and header["command"] == "features/media_ingress_v1"
    assert header["parameters"] == {"ticket": "t-1", "preparation_ref": "prep-1", "connection_ref": dc.challenge}
    assert header["query_owner_id"] == "arx-service:entry-1" and header["kind"] == "wiskey-bridge-command.v1"
    body = {k: v for k, v in header.items() if k not in ("ts", "nonce", "sig")}
    want = hmac.new(SECRET.encode(), f"{header['ts']}.{header['nonce']}.{hashlib.sha256(canonical(body)).hexdigest()}".encode(), hashlib.sha256).hexdigest()
    assert header["sig"] == want


def test_lease_and_template_transports_run_over_the_join(env: Any) -> None:
    lease = wcd.DirectLeaseTransport(env.cap)
    env.server.script["capture/lease_request"] = {"result": {"state": "accepted"}}
    assert lease.request(None, "capture_start", '{"m":1}') == {"state": "accepted"}
    env.server.script["capture/lease_event"] = {"error": "capture_source_unavailable"}
    with pytest.raises(Exception) as exc:
        lease.event(None, '{"m":2}')
    assert exc.value.details["outcome"] == "not_sent"  # the WKCAP mapping of that verified refusal
    env.server.script[wtd.V1_COMMAND] = {"result": wts.closed_result(1, "accepted", "provider_accepted", True)}
    req = SimpleNamespace(wire=lambda: {"schema_version": 1, "request_id": "r-1"})
    assert wtd.DirectTemplateTransport(env.cap).send_template(req)["state"] == "accepted"


def test_the_sync_port_refuses_on_the_session_loop_instead_of_dead_locking(env: Any) -> None:
    async def inside() -> Any:
        try:
            env.cap.call("x/y", {}, timeout_s=1.0)
        except PortError as exc:
            return exc.outcome, exc.code
        return None

    assert env.session.run_sync(inside(), 5) == ("not_sent", "wrong_thread")
    assert env.server.received == []


# ================================================================ outcome mapping: not_sent / refused / unknown, never retried

def test_refused_only_for_a_verified_error_frame(env: Any) -> None:
    env.server.script["users/update"] = {"error": "revision_conflict"}
    with pytest.raises(cp.WiskeyCommandError) as exc:
        asyncio.run(env.cmd.send_signed("users/update", {"user_id": "u", "revision": 1, "data": {}}, operation_id="op"))
    assert (exc.value.outcome, exc.value.code) == (cp.REFUSED, "revision_conflict")
    with pytest.raises(PortError) as pexc:
        env.cap.call("users/update", {"user_id": "u"}, timeout_s=2.0)
    assert (pexc.value.outcome, pexc.value.code) == ("refused", "revision_conflict")


def test_not_sent_only_when_no_byte_was_written(env: Any) -> None:
    env.server.refuse_open = True  # the socket never opens: nothing could have been written
    with pytest.raises(cp.WiskeyCommandError) as exc:
        asyncio.run(env.cmd.send_signed("users/create", {"data": {}}, operation_id="op"))
    assert exc.value.outcome == cp.NOT_SENT
    with pytest.raises(PortError) as pexc:  # the 60 s back-off: still not_sent, no new socket attempt
        env.cap.call("users/create", {"data": {}}, timeout_s=1.0)
    assert pexc.value.outcome == "not_sent" and env.server.opened == 0 and env.server.received == []


def test_unknown_when_the_answer_does_not_come_and_nothing_is_retried(env: Any) -> None:
    env.server.script["users/delete"] = "drop"
    port = join.DirectCommandPort(env.session, timeout_s=0.3)
    with pytest.raises(cp.WiskeyCommandError) as exc:
        asyncio.run(port.send_signed("users/delete", {"user_id": "u", "revision": 2}, operation_id="op-d"))
    assert exc.value.outcome == cp.UNKNOWN
    assert len(received(env.server, "users/delete")) == 1  # sent once; the transport never re-sends


def test_unknown_when_the_connection_dies_and_the_next_request_uses_a_new_socket(env: Any) -> None:
    env.server.script["users/archive"] = "close"
    with pytest.raises(cp.WiskeyCommandError) as exc:
        asyncio.run(env.cmd.send_signed("users/archive", {"user_id": "u", "revision": 2, "confirmed": True}, operation_id="op-a"))
    assert exc.value.outcome == cp.UNKNOWN
    asyncio.run(env.cmd.send_signed("users/other", {}, operation_id=None))
    assert env.server.opened == 2  # a new socket + challenge, between requests only
    assert len(received(env.server, "users/archive")) == 1  # the doubtful command was NOT carried to the new connection


def test_unknown_for_a_reply_whose_mac_fails(env: Any) -> None:
    env.server.script["users/set_active"] = "badmac"
    with pytest.raises(cp.WiskeyCommandError) as exc:
        asyncio.run(env.cmd.send_signed("users/set_active", {"user_id": "u", "revision": 1, "active": True}, operation_id="op"))
    assert exc.value.outcome == cp.UNKNOWN
    assert env.session.connected is False  # the reader closed the connection on the unauthenticated frame


def test_unsignable_parameters_are_not_sent(env: Any) -> None:
    with pytest.raises(cp.WiskeyCommandError) as exc:
        asyncio.run(env.cmd.send_signed("users/update", {"bad": 1.5}, operation_id="op"))  # WisKey's canonical body has no float
    assert exc.value.outcome == cp.NOT_SENT and env.server.received == []


# ================================================================ the native people write over the join

@pytest.fixture()
def lineage(tmp_path: Path) -> Any:
    main = tmp_path / "smplwise.db"
    c = sqlite3.connect(main)
    c.execute("CREATE TABLE settings(key TEXT PRIMARY KEY, value TEXT)")
    c.commit()
    c.close()
    lin = wl.open_lineage(tmp_path, wl.SettingsAnchor(main), holder="holder-join")
    yield lin
    lin.close()


def _writer_join(env: Any, lin: Any) -> join.DirectJoin:
    j = join.DirectJoin(env.session, provider_ok=lambda: True, key_ok=lambda: True, lineage=lin)
    env.server.people = FakeWisKey()
    env.server.people.s["entry"] = "entry-1"
    return j


def _decision() -> nw.ArxDecision:
    return nw.ArxDecision(decision_id=str(uuid.uuid4()), grant_id="grant-1", grant_revision=3, permission_revision=3,
                          decided_at=datetime.now(timezone.utc))


ACTOR = nw.WriteActor(user_id="arx-user-1", display_name="Operator One", session_active=True)


def test_a_native_people_write_commits_over_the_direct_socket(env: Any, lineage: Any) -> None:
    j = _writer_join(env, lineage)
    outcome, raw = asyncio.run(j.native_write("users/create", {"data": {"display_name": "New", "pin": PIN_MARK}, "sync_now": True},
                                              actor=ACTOR, decision=_decision(), create_origin_ref="arx-create:c-1"))
    assert outcome.state == "committed" and raw == {"id": outcome.user_id, "revision": 1}
    commands = [c for c, _k, _p in env.server.received]
    # WKR5-295: the connection's discovery first (once), then the source read for the once-per-process recovery of the scope, the
    # writer's own source read, then the ONE write
    assert commands == ["direct/capabilities", "direct/time", "peer_writes/source_v1", "peer_writes/source_v1", "users/create"]
    assert lineage.get(outcome.operation_id).state == "committed"
    assert PIN_MARK not in json.dumps(lineage.handoff_export())  # the raw value only ever travelled inside the signed command


def test_a_lost_native_answer_stays_unknown_and_is_never_resent(env: Any, lineage: Any) -> None:
    j = _writer_join(env, lineage)
    env.server.people.faults["users/create"] = ["commit_then_lose_ack"]  # WisKey commits, the answer never comes
    j.command_port.timeout_s = 0.5
    outcome, _raw = asyncio.run(j.native_write("users/create", {"data": {"display_name": "New"}}, actor=ACTOR, decision=_decision(),
                                               create_origin_ref="arx-create:c-2"))
    assert outcome.state == "unknown" and not outcome.replay_permitted
    assert len(received(env.server, "users/create")) == 1


def test_people_send_maps_native_outcomes_onto_the_feed_contract(env: Any, lineage: Any, monkeypatch: Any) -> None:
    j = _writer_join(env, lineage)
    monkeypatch.setattr(join, "JOIN", j)
    monkeypatch.setattr(nw, "arx_decision", lambda *a, **k: _decision())
    principal = SimpleNamespace(user_id="arx-user-1", display_name="Operator One", username="op1", source="ingress")
    send = join.people_send(None, principal, "users/update", {"user_id": "u-9", "revision": 3, "data": {"display_name": "X"}},
                            targets=[("installation", "*")])
    assert send is not None
    env.server.people.seed_user("u-9", revision=3)
    assert asyncio.run(send(None)) == {"id": "u-9", "revision": 4}  # committed: the ACK's result, projected by the route as before
    env.server.people.seed_user("u-8", revision=5)
    stale = join.people_send(None, principal, "users/update", {"user_id": "u-8", "revision": 4, "data": {}}, targets=[("installation", "*")])
    with pytest.raises(intercom_client.IntercomError) as exc:  # a pre-effect verified refusal
        asyncio.run(stale(None))
    assert exc.value.code == "revision_conflict"
    bearer = SimpleNamespace(user_id="arx-user-1", display_name="Script", username="s", source="remote", via="bearer")
    refused_locally = join.people_send(None, bearer, "users/update", {"user_id": "u-9", "revision": 4, "data": {}}, targets=[("installation", "*")])
    before = len(env.server.received)
    with pytest.raises(intercom_sync.NotSent) as ns:
        asyncio.run(refused_locally(None))
    assert ns.value.code == "actor_session_inactive" and len(env.server.received) == before  # nothing sent


# ================================================================ the selection rule: nothing is installed without a usable key

def _settings(tmp_path: Path) -> Any:
    main = tmp_path / "smplwise.db"
    c = sqlite3.connect(main)
    c.execute("CREATE TABLE IF NOT EXISTS settings(key TEXT PRIMARY KEY, value TEXT)")
    c.commit()
    c.close()
    return SimpleNamespace(data_dir=tmp_path, db_path=main)


@pytest.mark.parametrize("provider,key", [(True, None), (True, ""), (False, SECRET), (False, None)])
def test_without_auto_and_a_signing_key_nothing_is_installed(tmp_path: Path, provider: bool, key: Any) -> None:
    before_lease, before_tpl = lease_events.TRANSPORT, wts.TRANSPORT_PROVIDER
    out = join.startup(None, _settings(tmp_path), provider_reader=lambda: provider, key_reader=lambda: key)
    assert out is None and join.installed() is None
    assert lease_events.TRANSPORT is before_lease and isinstance(lease_events.TRANSPORT, lease_events.BridgeLeaseTransport)
    assert wts.TRANSPORT_PROVIDER is before_tpl is None
    assert isinstance(wts.installed_transport(), wts.UnwiredTransport)
    assert not wl.lineage_path(tmp_path).exists()  # no lineage file, no anchor row
    c = sqlite3.connect(tmp_path / "smplwise.db")
    assert c.execute("SELECT COUNT(*) FROM settings").fetchone()[0] == 0
    c.close()


def test_a_rotated_key_installs_nothing(tmp_path: Path) -> None:
    from smplwise.services import ha_bridge

    rotated = ha_bridge.BridgeKey("x" * 32, "k-2")  # a rotated key never signs on the direct path (WKDIRECT rule)
    assert join.startup(None, _settings(tmp_path), provider_reader=lambda: True, key_reader=lambda: rotated) is None


def test_installed_join_selects_direct_only_while_the_socket_authenticates(tmp_path: Path, monkeypatch: Any) -> None:
    server = JoinServer()
    fallback_calls: list[str] = []

    class Fallback:
        def event(self, settings: Any, text: str) -> Any:
            fallback_calls.append("event")
            return {"via": "ha"}

        def request(self, settings: Any, action: str, text: str) -> Any:
            fallback_calls.append(action)
            return {"via": "ha"}

    monkeypatch.setattr(lease_events, "BridgeLeaseTransport", Fallback)
    provider = {"auto": True}
    j = join.startup(None, _settings(tmp_path), opener=server.opener, provider_reader=lambda: provider["auto"], key_reader=lambda: SECRET)
    try:
        assert j is not None and join.installed() is j
        assert isinstance(lease_events.TRANSPORT, join.SelectingLeaseTransport)
        assert wl.lineage_path(tmp_path).exists()  # one lineage for the process
        assert lease_events.TRANSPORT.event(None, '{"m":1}') == {"echo": "capture/lease_event"}  # direct
        assert isinstance(wts.installed_transport(), wtd.DirectTemplateTransport)
        assert fallback_calls == []
        j._provider_ok = lambda: False  # the installation goes back to `local`: the existing path at once
        assert lease_events.TRANSPORT.event(None, '{"m":2}') == {"via": "ha"}
        assert isinstance(wts.installed_transport(), wts.UnwiredTransport)
        assert join.people_send(None, SimpleNamespace(user_id="u"), "users/delete", {"user_id": "u", "revision": 1}, targets=[]) is None
        assert fallback_calls == ["event"] and len(received(server, "capture/lease_event")) == 1
    finally:
        try:
            j.session.run_sync(server.stop(), 5)
        except Exception:  # noqa: BLE001
            pass
        join.shutdown()
    assert join.installed() is None and wts.TRANSPORT_PROVIDER is None
    assert isinstance(lease_events.TRANSPORT, Fallback)  # set_transport(None) restores the existing transport


def test_an_installed_join_whose_socket_never_authenticates_keeps_the_existing_path(tmp_path: Path, monkeypatch: Any) -> None:
    server = JoinServer()
    server.refuse_open = True
    j = join.startup(None, _settings(tmp_path), opener=server.opener, provider_reader=lambda: True, key_reader=lambda: SECRET)
    try:
        assert j is not None and not j.selected()
        assert isinstance(wts.installed_transport(), wts.UnwiredTransport)
        assert j.recover_now(timeout=2) is None  # recovery deferred, nothing sent
        assert server.received == []
    finally:
        join.shutdown()
