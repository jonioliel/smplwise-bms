"""WKR5-295 unit A (FAKES ONLY): WisKey's round-5 command catalog as Arx reads it, the direct discovery reader
(`direct/capabilities` + `direct/time`) and how it feeds the join's transport choice.

The WisKey here is the in-memory fake direct server of tests/test_wkjoin_295.py (JoinServer: an independent envelope check, the two
discovery reads in WisKey's shapes). Nothing contacts a network, Home Assistant, a station or WisKey; nothing is installed."""
from __future__ import annotations

import asyncio
import json
from datetime import datetime, timezone
from pathlib import Path
from types import SimpleNamespace
from typing import Any

import pytest
from test_wkjoin_295 import JoinServer, _settings
from w10_fake_station import SECRET

from smplwise.services import lease_events
from smplwise.services import wa_template_send as wts
from smplwise.services import wiskey_command_port as cp
from smplwise.services import wiskey_direct_catalog as wdc
from smplwise.services import wiskey_direct_discovery as dd
from smplwise.services import wiskey_direct_join as join
from smplwise.services import wiskey_media_bridge as bridge
from smplwise.services.wiskey_capture_port import PortError

# WISKEY-MAC-ADOPT-298 item E: the FINAL Mac catalog of 27.10 (04_vectors_catalog/catalog/COMMAND_CATALOG.jsonl) replaces the R5 one
ORIGINAL_CATALOG_SHA256 = "dd55f9df3bc0480729fc9336d066ab741811cfbfe6806df90620166669937293"  # final COMMAND_CATALOG.jsonl bytes
CODE = "d5a3ab862fab45537cde2f30358e0e9d1f3f9c8b"


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
    j = join.DirectJoin(session, provider_ok=lambda: True, key_ok=lambda: True)
    yield SimpleNamespace(server=server, session=session, join=j, cmd=j.command_port, cap=j.capture_port)
    try:
        session.run_sync(server.stop(), 5)
    except Exception:  # noqa: BLE001
        pass
    session.close()


def sent(server: JoinServer) -> list[str]:
    return [c for c, _k, _p in server.received]


# ================================================================ the catalog (W5-CATALOG-01, W5-API-01)

def test_catalog_counts_names_not_lines_and_skips_provenance() -> None:
    c = wdc.load()
    lines = [json.loads(x) for x in wdc.CATALOG_PATH.read_text(encoding="utf-8").splitlines() if x.strip()]
    assert len(lines) == 280 and lines[0]["kind"] == "CATALOG_PROVENANCE"
    assert c.command_count == 279 and c.registered_count == 276 and c.discovered_count == 272
    assert len(c.families) == 43 and "direct" in c.families
    assert c.code == CODE and c.source_sha256 == ORIGINAL_CATALOG_SHA256
    direct_only = sorted(e.command for e in c.entries() if e.row_kind == "DIRECT_ONLY_COMMAND")
    assert direct_only == ["direct/capabilities", "direct/time", "peer_identity/get"]


def test_envelope_is_decided_per_command_from_the_catalog_row() -> None:
    c = wdc.load()
    peer = {e.command for e in c.entries() if e.envelope == bridge.PEER_QUERY_KIND}
    assert peer == set(cp.PEER_QUERY_COMMANDS)  # the WKINT rule and the catalog agree
    ha_body = sorted(e.command for e in c.entries() if e.envelope is None)
    assert ha_body == ["audio/diagnostics", "audio/mute", "audio/receive", "audio/send", "audio/start"]
    for name in ("direct/capabilities", "direct/time", "peer_identity/get", "users/create", "capture/lease_event"):
        assert wdc.envelope_for(name) == bridge.KIND
    assert all(e.envelope != bridge.DIRECT_PROTOCOL for e in c.entries())  # the transport protocol is never a bridge.kind
    assert wdc.direct_refusal("audio/start") == "not_a_direct_command"
    assert wdc.direct_refusal("jobs/approval_decide") == wdc.direct_refusal("jobs/approval_request") == "owner_excluded"
    assert wdc.direct_refusal("jobs/list") is None and wdc.direct_refusal("jobs/approval_review") is None  # reads stay available


@pytest.mark.parametrize("mutate,code", [
    (lambda rows: rows[1:], "provenance_missing"),
    (lambda rows: rows + [rows[0]], "duplicate_provenance"),
    (lambda rows: rows + [{"kind": "SOMETHING", "command": "x/y"}], "unknown_row_kind"),
    (lambda rows: rows + [rows[5]], "duplicate_command"),
    (lambda rows: rows[:-1], "count_mismatch"),
    (lambda rows: [rows[0], {**rows[1], "wire_schema": "other"}, *rows[2:]], "unknown_wire_schema"),
    (lambda rows: [*rows[:-1], {**rows[-1], "registered_in_HA_WebSocket_table": True}], "invalid_direct_only_row"),
])
def test_a_malformed_catalog_is_refused_whole(mutate: Any, code: str) -> None:
    rows = [json.loads(x) for x in wdc.CATALOG_PATH.read_text(encoding="utf-8").splitlines() if x.strip()]
    with pytest.raises(wdc.CatalogError) as exc:
        wdc.parse("\n".join(json.dumps(r) for r in mutate(rows)))
    assert str(exc.value) == code


def test_the_caller_map_covers_every_catalog_family() -> None:
    path = Path(__file__).resolve().parents[3] / "docs" / "integrations" / "wiskey" / "r5" / "CALLER_MAP.json"
    m = json.loads(path.read_text(encoding="utf-8"))
    assert m["catalog_source_sha256"] == ORIGINAL_CATALOG_SHA256 and m["family_count"] == 43 and m["command_count"] == 279
    assert set(m["families"]) == set(wdc.load().families)
    assert sum(len(f["commands"]) for f in m["families"].values()) == 279


# ================================================================ the discovery reader

def _cap(server: JoinServer | None = None, **over: Any) -> dict[str, Any]:
    doc = (server or JoinServer()).capabilities_doc()
    doc.update(over)
    return doc


def test_capabilities_reader_is_closed_and_never_takes_envelope_as_kind() -> None:
    cap = dd.read_capabilities(_cap(), "ref-1")
    assert cap.lists("users/create") and not cap.lists("audio/start") and not cap.lists("jobs/approval_decide")
    bad = _cap()
    bad["commands"] = [{**bad["commands"][0], "envelope": "wiskey-bridge-command.v1"}, *bad["commands"][1:]]
    with pytest.raises(dd.DiscoveryError) as exc:
        dd.read_capabilities(bad, "ref-1")  # a bridge.kind in `envelope` is not the transport protocol: refused, never adopted
    assert exc.value.code == "capabilities_invalid"
    with pytest.raises(dd.DiscoveryError):
        dd.read_capabilities({**_cap(), "extra": 1}, "ref-1")
    with pytest.raises(dd.DiscoveryError):
        dd.read_capabilities(_cap(families=["users"]), "ref-1")  # families must be exactly the names' prefixes
    with pytest.raises(dd.DiscoveryError):
        dd.read_capabilities(_cap(physical_result="confirmed"), "ref-1")


@pytest.mark.parametrize("flag", ["kid_in_v1", "event_cursor_resume", "reconnect_adopts_old_resources"])
def test_a_lifecycle_this_v1_client_does_not_implement_is_not_selected(flag: str) -> None:
    doc = _cap()
    doc["lifecycle"] = {**doc["lifecycle"], flag: True}
    with pytest.raises(dd.DiscoveryError) as exc:
        dd.read_capabilities(doc, "ref-1")
    assert exc.value.code == "lifecycle_unsupported"


def _time(offset_s: float, **over: Any) -> dd.TimeObservation:
    now = datetime.now(timezone.utc).timestamp()
    raw = {"schema_version": 1, "server_utc": datetime.fromtimestamp(now + offset_s, timezone.utc).isoformat(), "max_ts_skew_seconds": 60,
           "max_issued_future_seconds": 2, "max_command_ttl_seconds": 15, **over}
    return dd.read_time(raw, "ref-1", sent_wall=now, received_wall=now, observed_at=0.0)


@pytest.mark.parametrize("offset,ok", [(0.0, True), (1.0, True), (-1.0, True), (5.0, True), (-1.6, False), (-3.0, False), (8.5, False),
                                       (70.0, False)])
def test_time_observation_admits_only_a_window_arx_can_sign_into(offset: float, ok: bool) -> None:
    assert (_time(offset).admits(bridge.WINDOW_S) is None) is ok


def test_time_reader_is_closed_and_a_short_server_ttl_refuses() -> None:
    assert _time(0.0, max_command_ttl_seconds=5).admits(bridge.WINDOW_S) == "ttl_exceeds_server_max"
    with pytest.raises(dd.DiscoveryError):
        _time(0.0, server_utc="2026-10-24T10:00:00")  # naive time
    with pytest.raises(dd.DiscoveryError):
        _time(0.0, max_ts_skew_seconds=True)


# ================================================================ discovery feeds the transport choice

def test_discovery_runs_once_per_connection_with_empty_signed_parameters(env: Any) -> None:
    assert env.join.selected("users/create")
    assert env.join.selected("capture/lease_event")
    assert sent(env.server) == ["direct/capabilities", "direct/time"]
    assert [(k, p) for c, k, p in env.server.received] == [("wiskey-bridge-command.v1", {}), ("wiskey-bridge-command.v1", {})]
    assert env.session.discovery.capabilities.connection_ref == env.server.connections[0].challenge


def test_a_command_missing_from_discovery_keeps_the_existing_path_and_is_never_written(env: Any) -> None:
    env.server.discovered = {"users/create", "peer_writes/source_v1"}
    assert env.join.selected("users/create") and not env.join.selected("capture/lease_event")
    before = len(env.server.received)
    with pytest.raises(PortError) as exc:
        env.cap.call("capture/lease_event", {"signed_message_json": "{}"}, timeout_s=2.0)
    assert (exc.value.outcome, exc.value.code) == ("not_sent", "command_not_discovered") and len(env.server.received) == before


def test_audio_and_owner_excluded_commands_are_never_written_on_the_direct_envelope(env: Any) -> None:
    for command, code in (("audio/start", "not_a_direct_command"), ("jobs/approval_decide", "owner_excluded"),
                          ("jobs/approval_request", "owner_excluded")):
        with pytest.raises(cp.WiskeyCommandError) as exc:
            asyncio.run(env.cmd.send_signed(command, {}, operation_id=None))
        assert (exc.value.outcome, exc.value.code) == (cp.NOT_SENT, code)
        assert not env.join.selected(command)
    assert command not in sent(env.server) and "audio/start" not in sent(env.server)


def test_a_reconnect_is_a_new_owner_and_discovery_runs_again(env: Any) -> None:
    assert env.join.selected("users/create")
    first = env.session.discovery.capabilities.connection_ref
    env.server.script["users/archive"] = "close"
    with pytest.raises(cp.WiskeyCommandError) as exc:
        asyncio.run(env.cmd.send_signed("users/archive", {"user_id": "u", "revision": 2, "confirmed": True}, operation_id="op-a"))
    assert exc.value.outcome == cp.UNKNOWN
    assert env.join.selected("users/create")
    assert env.server.opened == 2 and env.session.discovery.capabilities.connection_ref != first
    assert sent(env.server).count("direct/capabilities") == 2  # nothing of the old connection's document was kept
    assert sent(env.server).count("users/archive") == 1  # the doubtful command was not carried over


def test_clock_skew_keeps_the_existing_path(env: Any) -> None:
    env.server.clock_offset_s = -5.0  # Arx 5 s ahead of WisKey: its issued_at would lie in WisKey's future
    assert not env.join.selected("users/create")
    assert env.session.transport_refusal("users/create") == "clock_skew"
    with pytest.raises(cp.WiskeyCommandError) as exc:
        asyncio.run(env.cmd.send_signed("users/create", {"data": {}}, operation_id="op"))
    assert (exc.value.outcome, exc.value.code) == (cp.NOT_SENT, "clock_skew") and "users/create" not in sent(env.server)


def test_server_time_is_an_observation_and_never_moves_arx_signing_clock(env: Any) -> None:
    env.server.clock_offset_s = 5.0  # WisKey 5 s ahead: admitted (5 + margin < Arx's 10 s window)
    env.server.script["users/get"] = {"result": {"ok": True}}
    before = datetime.now(timezone.utc)
    assert env.cap.call("users/get", {"user_id": "u"}, timeout_s=2.0) == {"ok": True}
    issued = [m["bridge"]["issued_at"] for m in env.server.connections[0].messages if m["type"].endswith("/users/get")][0]
    assert abs((datetime.fromisoformat(issued) - before).total_seconds()) < 3  # Arx's own clock, not the server's
    assert env.session.discovery.time.skew_s > 4


def test_a_wiskey_without_discovery_is_not_selected_and_nothing_else_is_written(env: Any) -> None:
    env.server.script["direct/capabilities"] = {"error": "command_unavailable"}
    assert not env.join.selected("users/create") and not env.join.selected()
    assert env.session.discovery.last_error == "discovery_refused:command_unavailable"
    assert sent(env.server) == ["direct/capabilities"]  # asked once on this connection, not on every selection
    with pytest.raises(cp.WiskeyCommandError) as exc:
        asyncio.run(env.cmd.send_signed("users/create", {"data": {}}, operation_id="op"))
    assert exc.value.outcome == cp.NOT_SENT and sent(env.server) == ["direct/capabilities"]


def test_installed_join_uses_discovery_for_lease_and_template_selection(tmp_path: Path, monkeypatch: Any) -> None:
    server = JoinServer()
    server.discovered = {"capture/lease_event", "capture/lease_request"}  # no template command discovered

    class Fallback:
        def event(self, settings: Any, text: str) -> Any:
            return {"via": "ha"}

        def request(self, settings: Any, action: str, text: str) -> Any:
            return {"via": "ha"}

    monkeypatch.setattr(lease_events, "BridgeLeaseTransport", Fallback)
    j = join.startup(None, _settings(tmp_path), opener=server.opener, provider_reader=lambda: True, key_reader=lambda: SECRET)
    try:
        assert j is not None and j.session.require_discovery is True
        assert lease_events.TRANSPORT.event(None, '{"m":1}') == {"echo": "capture/lease_event"}  # discovered: direct
        assert isinstance(wts.installed_transport(), wts.UnwiredTransport)  # template command not discovered: the existing refusal
    finally:
        try:
            j.session.run_sync(server.stop(), 5)
        except Exception:  # noqa: BLE001
            pass
        join.shutdown()
