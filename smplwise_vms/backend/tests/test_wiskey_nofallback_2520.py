"""WISKEY-NOFALLBACK-FIX-2520 (FAKES ONLY): deep review 2.52 findings WB-01 and WB-03.

WB-01: with a rotated (v2) key, a v2 refusal at CONNECT or DISCOVERY time (key, reply, pairing, discovery refusal or failure, an unknown
connect) made the people write "not selected", so the same write went out on the classic Home Assistant channel, audited only as
"classic, not connected". Now the write is refused `not_sent` with the v2 code, audited on the direct path, and the classic send is never
called. A v1 key (WisKey rc10, the lab) keeps "not selected -> the existing path" exactly.

WB-03: one failed discovery read latched the direct path off for the socket's life. Now the connection is asked again after a bounded
back-off (30 s doubling to 600 s), and a successful re-read selects it again.

WisKey here is the in-memory v2 fake of tests/test_wiskey_direct_v2_2520.py and the v1 fake of tests/test_wkjoin_295.py. Nothing contacts
a network, Home Assistant, a station or WisKey."""
from __future__ import annotations

import asyncio
from datetime import datetime, timedelta, timezone
from types import SimpleNamespace
from typing import Any

import pytest
from test_wiskey_direct_v2_2520 import KEY, NeverOpener, V2Server, pairing_doc
from test_wkjoin_295 import JoinServer
from w10_fake_station import SECRET

from smplwise.services import intercom_sync
from smplwise.services import wiskey_direct_discovery as dd
from smplwise.services import wiskey_direct_join as join
from smplwise.services import wiskey_media_bridge as bridge

PRINCIPAL = SimpleNamespace(user_id="arx-user-1", display_name="Operator One", username="op1", source="ingress")
BUSINESS = {"user_id": "u-9", "revision": 3, "data": {"display_name": "X"}}
V2_CONNECT_REFUSED = "direct_v2_refused:direct_connect_refused"


class Mono:
    def __init__(self) -> None:
        self.t = 1000.0

    def __call__(self) -> float:
        return self.t


class Lineage:
    """people_send only needs a lineage to exist; the refused write never reaches it."""
    status = "ok"

    def writable(self) -> bool:
        return True


class Classic:
    def __init__(self) -> None:
        self.calls = 0

    async def __call__(self, call: Any) -> Any:  # the route's Home Assistant send
        self.calls += 1
        return {"via": "classic"}


def _make(server_opener: Any, *, v1_opener: Any = None, key: Any = KEY, mono: Mono | None = None) -> Any:
    transport = bridge.DirectApiTransport(v1_opener or NeverOpener(), lambda: key, opener_v2=server_opener)
    session = join.DirectCommandSession(transport)
    if mono is not None:
        session.discovery = dd.DirectDiscovery(mono=mono)
    j = join.DirectJoin(session, provider_ok=lambda: True, key_ok=lambda: True, lineage=Lineage())
    return session, j


@pytest.fixture()
def v2(monkeypatch: Any) -> Any:
    server = V2Server()
    mono = Mono()
    session, j = _make(server.opener, mono=mono)
    monkeypatch.setattr(join, "JOIN", j)
    yield SimpleNamespace(server=server, session=session, join=j, mono=mono)
    try:
        session.run_sync(server.stop(), 5)
    except Exception:  # noqa: BLE001
        pass
    session.close()


def send_for(command: str = "users/update", business: dict[str, Any] | None = None) -> tuple[Any, dict[str, Any], Classic]:
    rec: dict[str, Any] = {}
    classic = Classic()
    send = join.people_send(None, PRINCIPAL, command, business or BUSINESS, targets=[("installation", "*")], fallback=classic,
                            record=rec.update)
    return send, rec, classic


def assert_refused(send: Any, rec: dict[str, Any], classic: Classic, code: str) -> None:
    assert send is not None, "a v2 refusal never hands the write back to the route's classic send"
    with pytest.raises(intercom_sync.NotSent) as exc:
        asyncio.run(send(None))
    assert exc.value.code == code
    assert classic.calls == 0
    assert rec == {"transport": join.PATH_DIRECT, "transport_reason": code, "direct_state": "not_sent", "direct_code": code}


def commands(server: V2Server) -> list[str]:
    return [c for c, _k, _p in server.received]


# ================================================================ WB-01: refusal at connect time

def test_a_v2_connect_refusal_refuses_the_write_and_never_goes_classic(v2: Any) -> None:
    v2.server.material = "another-pairing-material"  # WisKey refuses the key (revoked / re-paired): closes without a word
    send, rec, classic = send_for()
    assert_refused(send, rec, classic, V2_CONNECT_REFUSED)
    assert v2.server.opened == 1 and v2.server.received == []  # nothing admitted, no people command on any channel
    assert join.people_path("users/update") == {"path": "refused", "reason": V2_CONNECT_REFUSED}


def test_during_the_back_off_after_a_v2_refusal_every_write_is_refused_without_a_new_attempt(v2: Any) -> None:
    v2.server.material = "another-pairing-material"
    for command, business in (("users/update", BUSINESS), ("users/create", {"data": {"display_name": "Y"}}),
                              ("users/delete", {"user_id": "u-9", "revision": 3})):
        send, rec, classic = send_for(command, business)
        assert_refused(send, rec, classic, V2_CONNECT_REFUSED)
    assert v2.server.opened == 1, "the 60 s back-off holds: no socket per write, and still no classic write"


@pytest.mark.parametrize("case,code", [
    ("v1_hello", "direct_v2_refused:direct_hello_invalid"),
    ("identity_kid", "direct_v2_refused:direct_kid_mismatch"),
    ("tampered_reply", "direct_v2_refused:reply_unauthenticated"),
])
def test_every_v2_connect_refusal_code_is_final_for_the_people_write(v2: Any, case: str, code: str) -> None:
    if case == "v1_hello":
        v2.server.hello_protocol = "wiskey-direct-ws.v1"
    elif case == "identity_kid":
        v2.server.identity_override = {"kid": "g2-89abcdef"}
    else:
        v2.server.tamper = lambda m: {**m, "sig": "0" * 64}
    send, rec, classic = send_for()
    assert_refused(send, rec, classic, code)


def test_a_v2_connect_with_an_unknown_outcome_is_kept_as_a_v2_code(monkeypatch: Any) -> None:
    async def hangs() -> Any:
        await asyncio.sleep(3600)

    session, j = _make(hangs)
    monkeypatch.setattr(join, "RUN_MARGIN_S", 0.1)
    try:
        assert session.connect_ready(timeout=0.2) is False
        assert session.last_error == "direct_v2_refused:connect_unknown"
        assert j.v2_refusal("users/update") == "direct_v2_refused:connect_unknown"
    finally:
        session.close()


# ================================================================ WB-01: refusal / failure at discovery time

def test_a_v2_discovery_refusal_refuses_the_write(v2: Any) -> None:
    v2.server.script["direct/capabilities_v3"] = {"error": "command_unavailable"}
    send, rec, classic = send_for()
    code = "direct_v2_refused:discovery_refused:command_unavailable"
    assert_refused(send, rec, classic, code)
    assert commands(v2.server) == ["direct/capabilities_v3"]  # one discovery read; no people command
    assert join.people_path("users/update") == {"path": "refused", "reason": code}


def test_a_v2_pairing_refusal_refuses_the_write(v2: Any) -> None:
    v2.server.pairing = pairing_doc(kid="g9-00000000")
    send, rec, classic = send_for()
    assert_refused(send, rec, classic, "pairing_mismatch")
    assert "users/update" not in commands(v2.server)


def test_a_v2_discovery_timeout_refuses_the_write(v2: Any, monkeypatch: Any) -> None:
    monkeypatch.setattr(join, "DISCOVERY_TIMEOUT_S", 0.3)
    v2.server.script["direct/time"] = "silent"
    send, rec, classic = send_for()
    assert send is not None
    with pytest.raises(intercom_sync.NotSent) as exc:
        asyncio.run(send(None))
    assert exc.value.code.startswith("direct_v2_refused:discovery_unknown:"), exc.value.code
    assert classic.calls == 0 and rec["transport"] == join.PATH_DIRECT and rec["direct_code"] == exc.value.code
    assert "users/update" not in commands(v2.server)


# ================================================================ what is NOT a v2 refusal keeps the existing path

def test_a_v2_key_whose_socket_is_unreachable_keeps_the_existing_path(monkeypatch: Any) -> None:
    async def unreachable() -> Any:
        raise OSError("no route")

    session, j = _make(unreachable)
    monkeypatch.setattr(join, "JOIN", j)
    try:
        assert send_for()[0] is None  # not a refusal of a v2 attempt: the route keeps its own send, as before
        assert session.last_error == "direct_unreachable" and j.v2_refusal("users/update") is None
        assert join.people_path("users/update")["path"] == "classic"
    finally:
        session.close()


def test_a_command_the_v2_discovery_does_not_list_keeps_the_existing_path(v2: Any) -> None:
    assert send_for("users/archive", {"user_id": "u-9", "revision": 3, "confirmed": True})[0] is None
    assert v2.session.transport_refusal("users/archive") == "command_not_discovered"


def test_a_v1_connect_refusal_keeps_the_classic_path_unchanged(monkeypatch: Any) -> None:
    """rc10 / the lab: a v1 key's "not selected" is the existing path, byte for byte (no new code, no refused send)."""
    server = JoinServer()
    transport = bridge.DirectApiTransport(server.opener, lambda: "not-the-pairing-secret")
    session = join.DirectCommandSession(transport)
    j = join.DirectJoin(session, provider_ok=lambda: True, key_ok=lambda: True, lineage=Lineage())
    monkeypatch.setattr(join, "JOIN", j)
    try:
        assert send_for()[0] is None
        assert session.last_error is not None and not session.last_error.startswith(join.V2_REFUSED_PREFIX)
        assert j.v2_key() is False and j.v2_refusal("users/update") is None
        assert join.people_path("users/update") == {"path": "classic", "reason": "wiskey_direct_not_connected"}
    finally:
        try:
            session.run_sync(server.stop(), 5)
        except Exception:  # noqa: BLE001
            pass
        session.close()


def test_a_v1_discovery_refusal_keeps_the_classic_path_unchanged(monkeypatch: Any) -> None:
    server = JoinServer()
    server.script["direct/capabilities"] = {"error": "command_unavailable"}
    session = join.DirectCommandSession(bridge.DirectApiTransport(server.opener, lambda: SECRET))
    j = join.DirectJoin(session, provider_ok=lambda: True, key_ok=lambda: True, lineage=Lineage())
    monkeypatch.setattr(join, "JOIN", j)
    try:
        assert send_for()[0] is None
        assert join.people_path("users/update") == {"path": "classic", "reason": "discovery_refused:command_unavailable"}
    finally:
        try:
            session.run_sync(server.stop(), 5)
        except Exception:  # noqa: BLE001
            pass
        session.close()


def test_a_join_set_to_local_never_refuses_on_the_v2_rule(v2: Any) -> None:
    v2.server.material = "another-pairing-material"
    v2.join._provider_ok = lambda: False  # the owner chose `local`: the join is not used at all
    assert send_for()[0] is None and v2.server.opened == 0


# ================================================================ the emergency engine and the door automation sender

def test_the_emergency_engine_after_a_v2_refusal_is_not_sent_and_has_no_other_path(v2: Any) -> None:
    """Documented behaviour (unchanged): the live emergency engine has no classic path; without a selected connection it answers
    `not_sent transport_not_selected` and sends nothing anywhere."""
    from smplwise.services import door_engine_live as live
    from smplwise.services import door_windows_engine as dwe

    v2.server.material = "another-pairing-material"
    eng = live.LiveEmergencyEngine(object(), join=lambda: v2.join)
    with pytest.raises(dwe.EngineError) as exc:
        eng.apply("open", "st", 1, "r:st:1", "")
    assert (exc.value.kind, exc.value.code) == ("not_sent", "transport_not_selected")
    assert v2.server.received == [] and eng.open_supported is True  # the control stays offered; the attempt itself is refused


def test_the_door_automation_sender_after_a_v2_refusal_is_not_sent(v2: Any) -> None:
    from smplwise.services import door_automation
    from smplwise.services import wiskey_auto_door as wad

    v2.server.material = "another-pairing-material"
    sender = wad.NativeDoorSender(object(), features=v2.join.features_or_none)
    out = sender.open(operator=door_automation.operator_of("blk-1", "Night"), station_id="st", relay=1, request_id="r-1",
                      not_after=datetime.now(timezone.utc) + timedelta(seconds=5))
    assert out == ("not_sent", "transport_not_selected") and v2.server.received == []


# ================================================================ WB-03: a failed discovery is asked again (bounded back-off)

def test_the_discovery_back_off_is_bounded_and_doubles() -> None:
    mono = Mono()
    d = dd.DirectDiscovery(mono=mono)
    calls: list[str] = []

    async def refused(command: str, parameters: Any) -> Any:
        calls.append(command)
        raise bridge.MediaBridgeError("command_unavailable", "refused")

    waits = []
    for _ in range(7):
        asyncio.run(d.refresh("ref-1", refused))
        waits.append(d.retry_after_s())
        before = len(calls)
        asyncio.run(d.refresh("ref-1", refused))  # within the back-off: nothing is asked
        assert len(calls) == before and not d.retry_due("ref-1")
        mono.t += d.retry_after_s()
        assert d.retry_due("ref-1")
    assert waits == [30.0, 60.0, 120.0, 240.0, 480.0, 600.0, 600.0]
    assert d.retry_due("ref-2"), "a new connection is asked at once"


def test_a_v2_discovery_failure_is_re_read_after_the_back_off_and_selects_again(v2: Any, monkeypatch: Any) -> None:
    monkeypatch.setattr(join, "DISCOVERY_TIMEOUT_S", 0.3)
    v2.server.script["direct/time"] = "silent"
    assert not v2.join.selected("users/create")
    assert v2.session.discovery.failed_ref is not None and not v2.session.discovery_due()
    del v2.server.script["direct/time"]
    v2.mono.t += dd.FAILED_RETRY_MIN_S
    assert v2.session.discovery_due()
    assert v2.join.selected("users/create"), "the same connection is usable again: not latched for the socket's life"
    assert v2.server.opened == 1 and v2.session.discovery.failed_ref is None and v2.session.discovery.failures == 0
    assert join.people_path("users/create") == {"path": "direct", "reason": None}


def test_a_v1_discovery_failure_is_re_read_after_the_back_off_and_selects_again() -> None:
    server = JoinServer()
    server.script["direct/capabilities"] = {"error": "command_unavailable"}
    mono = Mono()
    session = join.DirectCommandSession(bridge.DirectApiTransport(server.opener, lambda: SECRET))
    session.discovery = dd.DirectDiscovery(mono=mono)
    j = join.DirectJoin(session, provider_ok=lambda: True, key_ok=lambda: True)
    try:
        assert not j.selected("users/create") and not j.selected("users/create")
        assert [c for c, _k, _p in server.received] == ["direct/capabilities"]  # asked once within the back-off
        del server.script["direct/capabilities"]
        mono.t += dd.FAILED_RETRY_MIN_S
        assert j.selected("users/create")
        assert [c for c, _k, _p in server.received] == ["direct/capabilities", "direct/capabilities", "direct/time"]
        assert server.opened == 1  # the same socket
    finally:
        try:
            session.run_sync(server.stop(), 5)
        except Exception:  # noqa: BLE001
            pass
        session.close()
