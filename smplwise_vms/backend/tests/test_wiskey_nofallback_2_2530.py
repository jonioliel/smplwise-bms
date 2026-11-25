"""WISKEY-NOFALLBACK-2-2530 (FAKES ONLY): deep review 2.52 WB-01, the two other selectors with the same root.

WISKEY-NOFALLBACK-FIX-2520 made a v2 refusal at connect / discovery time final for the people routes (`DirectJoin.v2_refusal`). The same
"not selected -> the other transport" shape lived in two more places, both dormant in this build:

- the capture lease (`wiskey_direct_join.SelectingLeaseTransport._pick`) handed the lease message to the bridge transport;
- the grant engine (`access_service_writer.select_path`) chose the local service channel.

Both now ask the same one helper (`wiskey_direct_join.v2_refusal_of`): after a refused / unknown v2 attempt the message or write is refused
`not_sent` with the v2 code and recorded; the other transport is never called. A v1 key (WisKey rc10, the lab), an unreachable v2 socket
and the join set to `local` keep the existing transport exactly.

WisKey here is the in-memory v2 fake of tests/test_wiskey_direct_v2_2520.py and the v1 fake of tests/test_wkjoin_295.py; the service
channel and the bridge transport are recording stand-ins. Nothing contacts a network, Home Assistant, a station or WisKey."""
from __future__ import annotations

from types import SimpleNamespace
from typing import Any

import pytest
from test_wiskey_direct_v2_2520 import V2Server, pairing_doc
from test_wiskey_nofallback_2520 import V2_CONNECT_REFUSED, Lineage, Mono, _make
from test_wkjoin_295 import JoinServer

from smplwise.errors import ApiError
from smplwise.routers import access_control
from smplwise.services import access_grants as ag
from smplwise.services import access_service_writer as asw
from smplwise.services import intercom_sync
from smplwise.services import capture_lease
from smplwise.services import wiskey_capture_direct as cd
from smplwise.services import wiskey_direct_join as join
from smplwise.services import wiskey_media_bridge as bridge
from smplwise.services.access_grant_engine import EngineError, WiskeyServiceEngine

DISCOVERY_REFUSED = "direct_v2_refused:discovery_refused:command_unavailable"


class RecordingLease:
    """A `lease_events.LeaseTransport` stand-in (the bridge transport or the direct one): records every call, answers a fixed object."""

    def __init__(self, name: str) -> None:
        self.name = name
        self.calls: list[tuple[str, str]] = []

    def event(self, settings: Any, text: str) -> Any:
        self.calls.append(("event", text))
        return {"via": self.name}

    def request(self, settings: Any, action: str, text: str) -> Any:
        self.calls.append((action, text))
        return {"via": self.name}


def lease_for(j: Any) -> tuple[join.SelectingLeaseTransport, RecordingLease, RecordingLease]:
    direct, bridge_transport = RecordingLease("direct"), RecordingLease("bridge")
    return join.SelectingLeaseTransport(j, direct, bridge_transport), direct, bridge_transport


def assert_lease_refused(call: Any, code: str) -> ApiError:
    with pytest.raises(ApiError) as exc:
        call()
    err = exc.value
    assert (err.status, err.code, err.details) == (503, join.V2_REFUSED_LEASE_CODE, {"outcome": "not_sent", "error": code})
    assert err.code in access_control._NOT_SENT_CODES, "the capture routes must read it as 'nothing was sent', never as unknown"
    return err


def _v1_join(server: JoinServer, key: str) -> tuple[Any, Any]:
    session = join.DirectCommandSession(bridge.DirectApiTransport(server.opener, lambda: key))
    return session, join.DirectJoin(session, provider_ok=lambda: True, key_ok=lambda: True, lineage=Lineage())


def _close(session: Any, server: Any) -> None:
    try:
        session.run_sync(server.stop(), 5)
    except Exception:  # noqa: BLE001
        pass
    session.close()


@pytest.fixture()
def v2(monkeypatch: Any) -> Any:
    """A real `DirectJoin` with a rotated (v2) key against the in-memory v2 WisKey (as tests/test_wiskey_nofallback_2520.py), installed."""
    server = V2Server()
    mono = Mono()
    session, j = _make(server.opener, mono=mono)
    monkeypatch.setattr(join, "JOIN", j)
    yield SimpleNamespace(server=server, session=session, join=j, mono=mono)
    _close(session, server)


# ================================================================ the capture lease: SelectingLeaseTransport._pick

def test_a_v2_connect_refusal_refuses_the_lease_message_and_never_uses_the_bridge(v2: Any) -> None:
    v2.server.material = "another-pairing-material"  # WisKey refuses the key (revoked / re-paired)
    lease, direct, bridge_transport = lease_for(v2.join)
    assert_lease_refused(lambda: lease.event(None, "{}"), V2_CONNECT_REFUSED)
    assert_lease_refused(lambda: lease.request(None, "capture_start", "{}"), V2_CONNECT_REFUSED)
    assert bridge_transport.calls == [] and direct.calls == [], "no lease message on any transport"
    assert lease.refusals == 2 and lease.last_refusal is not None
    assert (lease.last_refusal["command"], lease.last_refusal["code"]) == ("capture/lease_request", V2_CONNECT_REFUSED)
    assert v2.server.opened == 1 and v2.server.received == [], "one refused connect; the 60 s back-off holds for the second message"


def test_a_v2_discovery_refusal_refuses_the_lease_message(v2: Any) -> None:
    v2.server.script["direct/capabilities_v3"] = {"error": "command_unavailable"}
    lease, direct, bridge_transport = lease_for(v2.join)
    assert_lease_refused(lambda: lease.request(None, "capture_cancel", "{}"), DISCOVERY_REFUSED)
    assert bridge_transport.calls == [] and direct.calls == []


def test_a_v2_pairing_refusal_refuses_the_lease_message(v2: Any) -> None:
    v2.server.pairing = pairing_doc(kid="g9-00000000")
    lease, direct, bridge_transport = lease_for(v2.join)
    assert_lease_refused(lambda: lease.event(None, "{}"), "pairing_mismatch")
    assert bridge_transport.calls == [] and direct.calls == []


def test_the_v2_lease_refusal_keeps_the_existing_user_text_and_its_english() -> None:
    err = join.v2_refused_lease_error(V2_CONNECT_REFUSED)
    assert err.user_message == capture_lease.UNAVAILABLE_TEXT and err.retryable is False
    assert err.message_in("en") != capture_lease.UNAVAILABLE_TEXT, "the existing text already has its English (error_text_en.json)"
    assert join.V2_REFUSED_LEASE_CODE not in cd.NOT_SENT_CODES, "wiskey_capture_direct (the receiver chain WisKey mapped) is unchanged"


def test_a_v2_key_whose_socket_is_unreachable_keeps_the_bridge_transport(monkeypatch: Any) -> None:
    async def unreachable() -> Any:
        raise OSError("no route")

    session, j = _make(unreachable)
    try:
        lease, direct, bridge_transport = lease_for(j)
        assert lease.event(None, "{}") == {"via": "bridge"} and lease.refusals == 0
        assert direct.calls == [] and bridge_transport.calls == [("event", "{}")]
    finally:
        session.close()


def test_a_v1_connect_refusal_keeps_the_bridge_transport_unchanged() -> None:
    """rc10 / the lab: a v1 key's "not selected" is the existing transport, byte for byte."""
    server = JoinServer()
    session, j = _v1_join(server, "not-the-pairing-secret")
    try:
        lease, direct, bridge_transport = lease_for(j)
        assert lease.request(None, "capture_start", "{}") == {"via": "bridge"}
        assert bridge_transport.calls == [("capture_start", "{}")] and direct.calls == [] and lease.refusals == 0
        assert j.v2_key() is False and join.v2_refusal_of(j, "capture/lease_request") is None
    finally:
        _close(session, server)


def test_a_join_set_to_local_never_refuses_the_lease_on_the_v2_rule(v2: Any) -> None:
    v2.server.material = "another-pairing-material"
    v2.join._provider_ok = lambda: False
    lease, _direct, bridge_transport = lease_for(v2.join)
    assert lease.event(None, "{}") == {"via": "bridge"} and v2.server.opened == 0 and lease.refusals == 0


# ================================================================ the grant engine: access_service_writer.select_path

@pytest.fixture()
def channel(monkeypatch: Any):
    """The local service channel stand-in: records every people write that reaches it."""
    calls: list[str] = []

    def action(settings, key, send, project, who, lane=None, target=None):
        calls.append(key)
        return {"person": {"id": "p1", "revision": 2, "display_name": "x", "employee_no": "1", "active": False, "assignments": {},
                           "permission_overrides": {}, "group_ids": [], "pin_configured": False, "access_category": "contractor"}}

    monkeypatch.setattr(intercom_sync.SYNC, "action", action)
    monkeypatch.setattr(intercom_sync.SYNC, "write_gate", lambda target: None)
    monkeypatch.setattr(ag, "GO_LIVE_PERMITTED", True)
    asw.reset_for_tests()
    yield calls
    asw.reset_for_tests()


def test_select_path_after_a_v2_connect_refusal_is_refused_not_the_service_channel(v2: Any) -> None:
    v2.server.material = "another-pairing-material"
    for action in ("users/update", "users/create"):
        choice = asw.select_path(action, v2.join)
        assert (choice.path, choice.reason, choice.code, choice.writer) == (asw.PATH_REFUSED, "direct_v2_refused", V2_CONNECT_REFUSED, None)
    assert "direct_v2_refused" in asw.PATH_REASONS


def test_a_grant_engine_write_after_a_v2_refusal_is_not_sent_and_never_on_the_service_channel(v2: Any, channel: list) -> None:
    v2.server.material = "another-pairing-material"
    eng = WiskeyServiceEngine(None)
    with pytest.raises(EngineError) as exc:
        eng.strip("p1", 1)  # a revoke (users/update)
    assert (exc.value.kind, exc.value.code) == ("not_sent", V2_CONNECT_REFUSED)
    with pytest.raises(EngineError) as exc:
        eng.create_person(display_name="Visitor ab", category="visitor", responsible_person="host", access_purpose="x")
    assert (exc.value.kind, exc.value.code) == ("not_sent", V2_CONNECT_REFUSED)
    assert channel == [], "no write on the local service channel after a v2 refusal"
    assert v2.server.received == [], "and nothing on the direct path either"
    last = asw.last_path()
    assert (last["refusals"], last["refused_code"]) == (2, V2_CONNECT_REFUSED) and last["refused_at"]
    assert (last["path"], last["writes"], last["fallbacks"]) == (None, 0, 0), "a refused write is not a write (readiness unchanged)"


def test_a_grant_engine_write_after_a_v2_discovery_refusal_is_not_sent(v2: Any, channel: list) -> None:
    v2.server.script["direct/capabilities_v3"] = {"error": "command_unavailable"}
    with pytest.raises(EngineError) as exc:
        WiskeyServiceEngine(None).apply("p1", 2, doors={"st-a": [1]}, valid_from="2026-11-25T08:00:00Z", valid_until="2026-11-25T18:00:00Z",
                                        timing=None, active=True)
    assert (exc.value.kind, exc.value.code) == ("not_sent", DISCOVERY_REFUSED)
    assert channel == [] and asw.last_path()["refused_code"] == DISCOVERY_REFUSED


def test_a_card_write_after_a_v2_refusal_keeps_the_service_channel(v2: Any, channel: list) -> None:
    """Cards and deletion are never carried by the direct path in any contract version: there is no transport to switch away from."""
    v2.server.material = "another-pairing-material"
    WiskeyServiceEngine(None).card_remove("p1", 2, "card-1")
    assert channel == ["person"]
    last = asw.last_path()
    assert (last["path"], last["reason"], last["refusals"]) == ("service_channel", "direct_not_selected", 0)


def test_a_v2_key_whose_socket_is_unreachable_keeps_the_service_channel(monkeypatch: Any, channel: list) -> None:
    async def unreachable() -> Any:
        raise OSError("no route")

    session, j = _make(unreachable)
    monkeypatch.setattr(join, "JOIN", j)
    try:
        WiskeyServiceEngine(None).strip("p1", 1)
        assert channel == ["person"] and asw.last_path()["reason"] == "direct_not_selected" and asw.last_path()["refusals"] == 0
    finally:
        session.close()


def test_a_v1_connect_refusal_keeps_the_service_channel_unchanged(monkeypatch: Any, channel: list) -> None:
    server = JoinServer()
    session, j = _v1_join(server, "not-the-pairing-secret")
    monkeypatch.setattr(join, "JOIN", j)
    try:
        assert asw.select_path("users/update", j) == asw.PathChoice(asw.PATH_SERVICE_CHANNEL, "direct_not_selected")
        WiskeyServiceEngine(None).strip("p1", 1)
        assert channel == ["person"] and asw.last_path()["refusals"] == 0
    finally:
        _close(session, server)


def test_a_join_without_the_v2_rule_keeps_the_existing_choice() -> None:
    """A join object that has no `v2_refusal` (the older fakes, anything else installed) is read exactly as before."""
    fake = SimpleNamespace(selected=lambda command=None: False)
    assert asw.select_path("users/update", fake) == asw.PathChoice(asw.PATH_SERVICE_CHANNEL, "direct_not_selected")
