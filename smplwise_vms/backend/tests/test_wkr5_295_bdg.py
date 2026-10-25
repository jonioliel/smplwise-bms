"""WKR5-295 units B, D and G (FAKES ONLY) on the combined join: the six features and the emergency v2 engine built on the direct port
(registered, not installed), the WhatsApp v2 autofill send through WisKey's existing caller with its own version reader, and the v1
pairing lifecycle (no kid, a rotated key never signs, a reconnect is a new owner). WisKey is the fake direct server of
tests/test_wkjoin_295.py; nothing reaches a network, Home Assistant, a station, a door or a provider."""
from __future__ import annotations

import datetime as dt
from types import SimpleNamespace
from typing import Any

import pytest
from test_wkjoin_295 import JoinServer
from w10_fake_station import SECRET

from smplwise.services import door_windows_engine as dwe
from smplwise.services import ha_bridge, lease_events
from smplwise.services import messaging_accounts as ma
from smplwise.services import wa_pacing as wp
from smplwise.services import wa_template_send as T
from smplwise.services import wiskey_direct_join as join
from smplwise.services import wiskey_emergency_direct as ed
from smplwise.services import wiskey_feature_direct as fd
from smplwise.services import wiskey_media_bridge as bridge
from smplwise.services import wiskey_template_direct as wtd

NOW = dt.datetime(2026, 10, 24, 9, 0, 0, tzinfo=dt.timezone.utc)
REG = [T.TemplateRef("notice", "visit_notice", "en_US", ("name",), "notice")]
PIN_MARK = "MRKPIN-WKR5-D-5521"


@pytest.fixture(autouse=True)
def _restore_process_state() -> Any:
    saved = (lease_events.TRANSPORT, T.TRANSPORT_PROVIDER, T.TRANSPORT_V2_PROVIDER, join.JOIN, dwe.EMERGENCY_ENGINE_FACTORY)
    yield
    lease_events.TRANSPORT, T.TRANSPORT_PROVIDER, T.TRANSPORT_V2_PROVIDER, join.JOIN, dwe.EMERGENCY_ENGINE_FACTORY = saved


@pytest.fixture()
def env() -> Any:
    server = JoinServer()
    key = {"k": SECRET}
    session = join.DirectCommandSession(bridge.DirectApiTransport(server.opener, lambda: key["k"]))
    j = join.DirectJoin(session, provider_ok=lambda: True, key_ok=lambda: True)
    j.template_transport = wtd.DirectTemplateTransport(j.capture_port, timeout_s=2.0)
    yield SimpleNamespace(server=server, session=session, join=j, key=key)
    try:
        session.run_sync(server.stop(), 5)
    except Exception:  # noqa: BLE001
        pass
    session.close()


def sent(server: JoinServer, command: str) -> list[dict[str, Any]]:
    return [p for c, _k, p in server.received if c == command]


# ================================================================ unit B: features + emergency engine built, not installed

def test_features_are_built_on_the_direct_port_only_while_features_start_is_discovered(env: Any) -> None:
    ad = env.join.features_or_none()
    assert isinstance(ad, fd.FeatureAdapters) and ad.port is env.join.capture_port and env.join.features_or_none() is ad
    env.server.discovered = {"users/create"}  # a WisKey whose discovery does not list the feature commands
    env.session.discovery.forget()
    env.join._features = None
    assert env.join.features_or_none() is None


def test_the_emergency_v2_engine_is_built_but_never_installed_by_the_join(env: Any) -> None:
    before = dwe.EMERGENCY_ENGINE_FACTORY
    engine = env.join.emergency_engine(lambda: None)
    assert isinstance(engine, ed.DirectEmergencyEngine) and engine.new_request_per_attempt is True
    assert dwe.EMERGENCY_ENGINE_FACTORY is before and dwe.LIVE_ENGINE_BUILT is False  # installing is the owner's separate decision
    assert sent(env.server, "features/start") == []


# ================================================================ unit D: the v2 autofill template send

def _sender() -> T.TemplateSender:
    pacer = wp.WaPacer(ma.MemorySendLedger(), wp.MemoryPacerStore(), config=lambda: wp.PacerConfig(mode="off"))
    return T.TemplateSender(None, registry=lambda: REG, switch=lambda: True, permit_fn=lambda: True, pacer=pacer,
                            pacing_for=lambda _k: ma.Pacing(), clock=lambda: NOW)


def _v2(sender: T.TemplateSender) -> T.TemplateResult:
    return sender.send_v2(template_id="notice", account="acc-1", account_key="entry:acc1", person_id="person-1", expected_person_revision=3,
                          recipient_key="r-1", template_ref="tpl-ref-1", expected_template_revision=2, request_id="req-v2-1", operation_id="op-v2-1")


def test_v2_send_carries_ids_only_and_reads_the_answer_with_the_v2_reader(env: Any) -> None:
    T.TRANSPORT_V2_PROVIDER = env.join.template_v2_or_none
    env.server.script[wtd.V2_COMMAND] = {"result": T.closed_result(2, "accepted", "provider_accepted", True)}
    out = _v2(_sender())
    assert (out.outcome, out.result_version) == ("sent", 2)  # accepted = the provider's ACK; delivery stays unknown
    (params,) = sent(env.server, wtd.V2_COMMAND)
    assert set(params) == wtd.V2_FIELDS and params["schema_version"] == 2
    assert PIN_MARK not in str(params) and "parameters" not in params  # WisKey autofills; Arx sends no name / PIN / card value
    assert sent(env.server, wtd.V1_COMMAND) == []


@pytest.mark.parametrize("answer", [T.closed_result(1, "accepted", "provider_accepted", True), {"state": "accepted"}, {"echo": 1}])
def test_a_v2_answer_that_is_not_a_closed_v2_result_is_unknown_never_not_sent(env: Any, answer: Any) -> None:
    T.TRANSPORT_V2_PROVIDER = env.join.template_v2_or_none
    env.server.script[wtd.V2_COMMAND] = {"result": answer}
    out = _v2(_sender())
    assert out.outcome == "unknown"


def test_a_lost_v2_answer_is_unknown_and_not_retried(env: Any) -> None:
    T.TRANSPORT_V2_PROVIDER = env.join.template_v2_or_none
    env.join.template_transport = wtd.DirectTemplateTransport(env.join.capture_port, timeout_s=0.3)
    env.server.script[wtd.V2_COMMAND] = "drop"
    assert _v2(_sender()).outcome == "unknown"
    assert len(sent(env.server, wtd.V2_COMMAND)) == 1


def test_v2_is_refused_before_any_hand_over_when_not_discovered_or_not_installed(env: Any) -> None:
    T.TRANSPORT_V2_PROVIDER = None
    assert (_v2(_sender()).outcome, _v2(_sender()).code) == ("not_sent", "template_unsupported")
    T.TRANSPORT_V2_PROVIDER = env.join.template_v2_or_none
    env.server.discovered = {wtd.V1_COMMAND}
    out = _v2(_sender())
    assert (out.outcome, out.code) == ("not_sent", "template_unsupported") and sent(env.server, wtd.V2_COMMAND) == []


# ================================================================ unit G: the v1 pairing lifecycle

def test_a_rotated_key_never_signs_and_nothing_is_written(env: Any) -> None:
    env.key["k"] = ha_bridge.BridgeKey("y" * 32, "k-2")  # a non-legacy keyset: WKDIRECT refuses it (no kid on the v1 / capture wire)
    with pytest.raises(Exception) as exc:
        env.join.capture_port.call("users/get", {"user_id": "u"}, timeout_s=1.0)
    assert getattr(exc.value, "outcome", None) == "not_sent" and env.server.opened == 0
    assert env.server.received == []


def test_after_a_pairing_replacement_the_reconnect_is_a_new_owner_and_adopts_nothing(env: Any) -> None:
    assert env.join.selected("users/create")
    old = env.session._link
    old_ref = old.connection_ref
    env.server.secret = env.key["k"] = "z" * 32  # WisKey replaced the pairing; the old connection is invalidated
    env.session.run_sync(env.server.connections[0].sock.close(), 5)
    deadline = dt.datetime.now() + dt.timedelta(seconds=3)
    while not old.closed and dt.datetime.now() < deadline:
        pass
    assert env.join.selected("users/create")
    new = env.session._link
    assert new is not old and new.connection_ref != old_ref and new.event_ids == frozenset()
    assert env.session.discovery.capabilities.connection_ref == new.connection_ref  # discovery re-read on the new owner
    assert env.server.opened == 2
