"""WISKEY-RC5-2310 (round 3): the relay of an Arx door is WisKey's `physical_index`; the WisKey station grant names it as `physical_relay`.

Arx keys every door by (station config entry id, physical_index) (`door_windows._sync_doors`, `door_automation` door list). The relay map
(`wiskey_relay_map`, PK station + api_relay) is the only place that pairs WisKey's `api_relay` with that physical relay. WisKey Native
(2.0.1-rc.5, product bc2d8574, unchanged since rc.4) binds every station-scoped request by

    params.station_id == grant.station_id and params.relay == grant.physical_relay and params.mapping_revision == grant.mapping_revision

(`access/arx_door_execution.py` `_primary`, `access/arx_emergency_execution.py` / `access/arx_emergency_event_execution.py` primary target),
requires the grant to be one row of its startup mapping (`native_emergency_recovery_host.require_native_emergency_recovery`), and reads the
C07 history by the PHYSICAL door (`emergency_status_api.project`: `lock.physical_index == door`, mapping row `[2] == door`).

So the Arx callers must find the map row by the door's physical relay and send its api_relay as the grant's target. With a crossed map
(api 1 -> physical 2, api 2 -> physical 1) the previous lookup by api relay named the OTHER door. FAKES ONLY: nothing reaches WisKey,
Home Assistant, a station or a door; no switch is changed."""
from __future__ import annotations

import uuid
from datetime import timedelta
from typing import Any

import pytest
from test_door_automation_295 import ENTRY, _armed, _clean, fire, live, world  # noqa: F401 - fixtures / helpers
from test_wkcap_295 import NOW, Env, engine_for, intents
from wkcap_fakes import FakeDirectPort

from smplwise.services import door_automation
from smplwise.services import wiskey_auto_door as wad
from smplwise.services import wiskey_emergency_direct as ed
from smplwise.services import wiskey_feature_direct as fd
from smplwise.services import wiskey_feature_exec as fx

ST = "st-x"


def _crossed(conn: Any, station_id: str, by: str) -> None:
    """The wiring the map exists for: WisKey's api relay 1 drives physical relay 2 and api relay 2 drives physical relay 1."""
    fx.set_relay_map(conn, station_id=station_id, api_relay=1, physical_relay=2, confirmed_by=by, expected_revision=0)
    fx.set_relay_map(conn, station_id=station_id, api_relay=2, physical_relay=1, confirmed_by=by, expected_revision=0)


@pytest.fixture()
def env(settings):
    e = Env(settings)
    e.admin = e.principal("joni")
    with e.db.connection() as conn:
        _crossed(conn, ST, e.admin.user_id)
    return e


def _grants(sent: dict[str, Any]) -> list[tuple[str, int, int, int]]:
    return [(s["station_id"], s["api_relay"], s["physical_relay"], s["mapping_revision"]) for s in sent["policy_snapshot"]["stations"]]


# ================================================================ the lookup

def test_the_map_row_of_a_door_is_found_by_its_physical_relay(env):
    with env.db.connection() as conn:
        assert fx.relay_row_for_door(conn, ST, 1) == fx.RelayRow(ST, 2, 1, 1)
        assert fx.relay_row_for_door(conn, ST, 2) == fx.RelayRow(ST, 1, 2, 1)
        assert fx.relay_row_for_door(conn, "st-none", 1) is None
        fx.set_relay_map(conn, station_id=ST, api_relay=2, physical_relay=1, confirmed_by=env.admin.user_id, expected_revision=1, active=False)
        assert fx.relay_row_for_door(conn, ST, 1) is None, "an inactive row maps nothing"


def test_two_active_rows_on_one_physical_relay_map_nothing(env):
    with env.db.connection() as conn:
        fx.set_relay_map(conn, station_id="st-dup", api_relay=1, physical_relay=1, confirmed_by=env.admin.user_id, expected_revision=0)
        fx.set_relay_map(conn, station_id="st-dup", api_relay=2, physical_relay=1, confirmed_by=env.admin.user_id, expected_revision=0)
        assert fx.relay_row_for_door(conn, "st-dup", 1) is None, "ambiguous: WisKey refuses a duplicate physical relay too"


# ================================================================ emergency v2 (features/start emergency_buttons)

def test_an_emergency_hold_on_a_crossed_map_names_the_physical_door_and_its_api_grant(env):
    port = FakeDirectPort()
    eng = engine_for(env, port)
    assert eng.apply("open", ST, 1, f"req-1:{ST}:1", "").state == "acknowledged"
    (sent,) = port.sent("features/start")
    assert sent["request"]["params"]["relay"] == 1 and sent["request"]["params"]["mapping_revision"] == 1
    assert _grants(sent) == [(ST, 2, 1, 1)], "the grant of physical relay 1 is api relay 2"


def test_an_emergency_on_a_door_without_a_row_for_its_physical_relay_sends_nothing(env):
    with env.db.connection() as conn:
        fx.set_relay_map(conn, station_id="st-half", api_relay=1, physical_relay=2, confirmed_by=env.admin.user_id, expected_revision=0)
    port = FakeDirectPort()
    eng = engine_for(env, port)
    assert eng.apply("open", "st-half", 1, "req-h:st-half:1", "").state == "refused"
    assert port.calls == [] and intents(env) == []


def test_the_durable_read_names_the_physical_door_and_matches_the_api_grant(env):
    port = FakeDirectPort()
    port.result_mode = "running"
    eng = engine_for(env, port)
    assert eng.apply("open", ST, 1, f"req-d:{ST}:1", "").state == "unknown"
    (sent,) = port.sent("features/start")
    req = sent["request"]
    event_ref = sent["policy_snapshot"]["private_input"]["event_ref"]
    target = {"station_id": ST, "api_relay": 2, "physical_relay": 1, "mapping_revision": 1, "recorded_phase": "acknowledged", "outcome": "acknowledged",
              "duplicate": False, "prior_operation": None, "recovery_obligation": False, "release_recorded": False, "release_outcome": None}
    port.queue["features/emergency_event_status_v1"] = [{
        "contract": "wiskey-emergency-event-status.v1", "schema_version": 1, "event_ref": event_ref, "state": "found",
        "records": [{"operation_id": req["operation_id"], "request_id": req["request_id"], "revision": 1, "descriptor_epoch": "epoch-1",
                     "kind": "wiskey-emergency-event.v2", "command": "hold_open", "trigger": "manual", "retry_of": None, "targets": [target]}],
        "physical_result": "unknown", "observed_device": None, "replay_available": False, "absence_is_never_sent_proof": False,
        "reader_boot_id": None, "reader_process_id": 4242}]
    eng.apply("open", ST, 1, f"req-d:{ST}:1", "")
    (read,) = port.sent("features/emergency_event_status_v1")
    assert read == {"event_ref": event_ref, "station_id": ST, "door": 1, "mapping_revision": 1}, "WisKey reads the history by the physical door"
    with env.db.connection(mode="read") as conn:
        assert fx.intent_state(conn, req["request_id"]) == "accepted"


def test_a_history_record_of_the_other_api_relay_settles_nothing(env):
    port = FakeDirectPort()
    port.result_mode = "running"
    eng = engine_for(env, port)
    assert eng.apply("open", ST, 1, f"req-o:{ST}:1", "").state == "unknown"
    (sent,) = port.sent("features/start")
    req = sent["request"]
    event_ref = sent["policy_snapshot"]["private_input"]["event_ref"]
    target = {"station_id": ST, "api_relay": 1, "physical_relay": 1, "mapping_revision": 1, "recorded_phase": "acknowledged", "outcome": "acknowledged",
              "duplicate": False, "prior_operation": None, "recovery_obligation": False, "release_recorded": False, "release_outcome": None}
    port.queue["features/emergency_event_status_v1"] = [{
        "contract": "wiskey-emergency-event-status.v1", "schema_version": 1, "event_ref": event_ref, "state": "found",
        "records": [{"operation_id": req["operation_id"], "request_id": req["request_id"], "revision": 1, "descriptor_epoch": "epoch-1",
                     "kind": "wiskey-emergency-event.v2", "command": "hold_open", "trigger": "manual", "retry_of": None, "targets": [target]}],
        "physical_result": "unknown", "observed_device": None, "replay_available": False, "absence_is_never_sent_proof": False,
        "reader_boot_id": None, "reader_process_id": 4242}]
    eng.apply("open", ST, 1, f"req-o:{ST}:1", "")
    assert len(port.sent("features/emergency_event_status_v1")) == 1
    with env.db.connection(mode="read") as conn:
        assert fx.intent_state(conn, req["request_id"]) == "sent", "a target that is not this door's grant (api 2 -> physical 1) is not this attempt's answer"


# ================================================================ the adapter: nothing leaves that WisKey's `_primary` would refuse

def test_a_request_whose_relay_is_not_the_grants_physical_relay_is_refused_before_anything_is_stored(env):
    port = FakeDirectPort()
    ad = fd.FeatureAdapters(fd.DirectFeatureClient(port), port)
    private = {"kind": ed.KIND_V2, "event_ref": "e-1", "command": "hold_open", "trigger": "manual", "retry_of": None}
    with env.db.connection() as conn:
        with pytest.raises(fd.FeatureWireError) as exc:
            ad.prepare(conn, feature="emergency_buttons", actor=fx.human_actor(env.admin.user_id), principals=[env.admin], authority_ref="auth-1",
                       authority_revision=5, scope_ref="scope-1", parameter_reference="pref-1",
                       params={"station_id": ST, "relay": 2, "mapping_revision": 1, "policy_ref": "pol-1"}, now=NOW, source_epoch="epoch-5",
                       actor_session_active=True, targets=[(ST, 2)], private_input=private, execution_expires_at=NOW + timedelta(hours=1))
    assert (exc.value.code, exc.value.outcome) == ("binding_denied", "not_sent")
    assert port.calls == [] and intents(env) == []


def test_without_explicit_targets_the_target_is_the_api_relay_of_the_physical_door(env):
    port = FakeDirectPort()
    ad = fd.FeatureAdapters(fd.DirectFeatureClient(port), port)
    with env.db.connection() as conn:
        _body, snap = ad.prepare(conn, feature="door_windows", actor=fx.human_actor(env.admin.user_id), principals=[env.admin], authority_ref="auth-1",
                                 authority_revision=5, scope_ref="scope-1", parameter_reference="pref-1",
                                 params={"station_id": ST, "relay": 1, "mapping_revision": 1, "start": NOW.isoformat(),
                                         "end": (NOW + timedelta(hours=1)).isoformat(), "timezone": "Asia/Jerusalem"},
                                 now=NOW, source_epoch="epoch-5", actor_session_active=True)
    assert [(s["api_relay"], s["physical_relay"]) for s in snap["stations"]] == [(2, 1)]


# ================================================================ door automations (features/start door_automations)

@pytest.fixture()
def native(live, monkeypatch):
    port = FakeDirectPort()
    adapters = fd.FeatureAdapters(fd.DirectFeatureClient(port), port)
    monkeypatch.setattr(wad, "FEATURES_PROVIDER", lambda: adapters)
    monkeypatch.setattr(door_automation, "SENDER", None)
    with live["db"].connection() as conn:
        _crossed(conn, ENTRY, "dev-joni")
    return {**live, "port": port}


def test_a_door_automation_on_a_crossed_map_pulses_the_same_physical_door(native):
    w, port = native, native["port"]
    _armed(w["c"])
    port.queue["features/result"] = [{"schema_version": 1, "operation_ref": "op-1", "state": "finished", "replay_available": False,
                                      "receipt": {"original": {}, "phase": "acknowledged", "physical_result": "unknown", "replay_available": False}}]
    out = fire(w)
    assert out and out[0]["outcome"] == "sent", out
    (sent,) = port.sent("features/start")
    door = sent["request"]["params"]["relay"]
    assert door == 1, "the armed door is physical relay 1; the previous lookup sent physical relay 2 (the other door)"
    assert _grants(sent) == [(ENTRY, 2, 1, 1)]
    assert uuid.UUID(sent["request"]["request_id"])
