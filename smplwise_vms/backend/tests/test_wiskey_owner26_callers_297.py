"""WISKEY-OWNER26-297 (owner26 Q2): the original Arx callers auto / program / template / card on WisKey's existing Native APIs. FAKES ONLY.

- auto (W-018): `door_automation._fire_door` -> `LiveSender` -> `wiskey_auto_door.NativeDoorSender` -> `features/start` `door_automations`
  with the ORIGINAL automation actor and the current policy of its creator + approver; completion read of the Native pulse receipt.
- program (W-023): `door_windows_engine.WiskeyProgramEngine` -> `wiskey_program_direct` -> `stations/technical_program_list|save|action`.
- template (W-013): route -> `wa_template_send` -> `TRANSPORT_V2_PROVIDER` -> `DirectJoin.template_v2_or_none` (pinned, unchanged).
- card (W-005): `lease_events.TRANSPORT` (the join's SelectingLeaseTransport) -> CAPMAP DTO9 pre-flight -> `DirectLeaseTransport`.

Every shipped go-live / activation constant stays as it was; tests patch them inside the test only. Nothing contacts WisKey, Home Assistant,
a station, a reader or a door: the wire is FakeDirectPort / a recording port."""
from __future__ import annotations

import json
import uuid
from datetime import timedelta
from typing import Any, Mapping

import pytest
from test_capmap_295 import ROWS, RecordingPort, _kind
from test_door_automation_295 import ENTRY, _armed, _clean, audit_rows, fire, live, world  # noqa: F401 - fixtures / helpers
from wkcap_fakes import FakeDirectPort

from smplwise.services import capture_lease, door_automation, door_windows_engine as dwe
from smplwise.services import wiskey_auto_door as wad
from smplwise.services import wiskey_capture_direct as cd
from smplwise.services import wiskey_capture_map as cm
from smplwise.services import wiskey_direct_join as wdj
from smplwise.services import wiskey_feature_exec as fx
from smplwise.services import wiskey_program_direct as wpd
from smplwise.services.wiskey_capture_port import PortError
from smplwise.services.wiskey_feature_direct import DirectFeatureClient, FeatureAdapters


def test_no_activation_constant_is_flipped_by_this_adoption():
    assert door_automation.GO_LIVE_PERMITTED is False
    assert dwe.LIVE_ENGINE_BUILT is False and dwe.GO_LIVE_PERMITTED is True and dwe.live_ready() is False
    assert cm.MAPPING_ENABLED is False and capture_lease.GO_LIVE_PERMITTED is False
    from smplwise.services import intercom_messaging_adapter as ima

    assert ima.TEMPLATE_SEND_SUPPORTED is False
    assert isinstance(dwe.window_engine(None), dwe.PreparedEngine), "tier D until the owner activates the program engine"


# ======================================================================================================================================
# program (W-023)
# ======================================================================================================================================

class ProgramPort:
    def __init__(self, answers: dict[str, Any] | None = None) -> None:
        self.calls: list[tuple[str, dict[str, Any]]] = []
        self.answers = answers or {}

    def call(self, command: str, parameters: Mapping[str, Any], *, timeout_s: float) -> Mapping[str, Any]:
        self.calls.append((command, dict(parameters)))
        a = self.answers.get(command)
        if isinstance(a, BaseException):
            raise a
        return a if a is not None else {"programs": []}


class StubJoin:
    def __init__(self, port: Any, selected: set[str] | None = None) -> None:
        self.capture_port = port
        self._selected = set(wpd.COMMANDS) if selected is None else selected

    def selected(self, command: str | None = None) -> bool:
        return command in self._selected


def _program(door: int, revision: int, status: str = "idle", name: str = "Arx lobby", enabled: bool = True) -> dict[str, Any]:
    return {"door": door, "revision": revision, "enabled": enabled, "removing": False, "policy": {"schedule": {"name": name}},
            "execution": {"owned": False, "attempted": None, "status": status}, "error": None, "checked_at": None}


def _engine(port: Any, selected: set[str] | None = None) -> wpd.DirectProgramEngine:
    return wpd.DirectProgramEngine(wpd.DirectProgramPort(lambda: StubJoin(port, selected)))


def test_program_read_save_pause_use_the_native_shapes():
    port = ProgramPort({wpd.LIST: {"programs": [_program(2, 7)], "saved": [], "timezone": "Asia/Jerusalem", "native_supported": False},
                        wpd.SAVE: {"programs": [_program(1, 4, status="opening")]},
                        wpd.ACTION: {"programs": [_program(1, 5, enabled=False)]}})
    eng = _engine(port)
    st = eng.read("entry-1", 2)
    assert st.exists and st.revision == 7 and st.idle and st.arx
    assert eng.read("entry-1", 1) == dwe.ProgramState(False), "no program for the door is no evidence either way"
    saved = eng.save("entry-1", 1, 3, {"schedule": {"name": "Arx lobby"}}, True)
    assert saved.revision == 4 and saved.status == "opening"
    paused = eng.pause("entry-1", 1, 4)
    assert paused.revision == 5 and paused.enabled is False
    assert port.calls == [
        (wpd.LIST, {"station_id": "entry-1"}), (wpd.LIST, {"station_id": "entry-1"}),
        (wpd.SAVE, {"station_id": "entry-1", "door": 1, "revision": 3, "policy": {"schedule": {"name": "Arx lobby"}}, "enabled": True}),
        (wpd.ACTION, {"station_id": "entry-1", "door": 1, "revision": 4, "action": "pause"})]


def test_program_without_a_selected_connection_sends_nothing():
    port = ProgramPort()
    with pytest.raises(dwe.EngineError) as e:
        _engine(port, selected=set()).read("entry-1", 1)
    assert e.value.kind == "not_sent" and e.value.code == "transport_not_selected" and port.calls == []
    with pytest.raises(dwe.EngineError) as e:
        wpd.DirectProgramEngine(wpd.DirectProgramPort(lambda: None)).read("entry-1", 1)
    assert e.value.kind == "not_sent"


@pytest.mark.parametrize("error, kind", [(PortError("revision_conflict", "refused"), "revision_conflict"), (PortError("station_unloaded", "refused"), "refused"),
                                         (PortError("timeout", "unknown"), "unknown"), (PortError("wiskey_direct_not_connected", "not_sent"), "not_sent")])
def test_program_errors_map_to_the_engine_kinds(error, kind):
    with pytest.raises(dwe.EngineError) as e:
        _engine(ProgramPort({wpd.SAVE: error})).save("entry-1", 1, 0, {}, True)
    assert e.value.kind == kind


def test_program_write_without_the_door_in_the_answer_is_unknown_and_bad_input_is_not_sent():
    port = ProgramPort({wpd.SAVE: {"programs": []}, wpd.LIST: "garbage"})
    with pytest.raises(dwe.EngineError) as e:
        _engine(port).save("entry-1", 1, 0, {}, False)
    assert e.value.kind == "unknown"
    with pytest.raises(dwe.EngineError) as e:
        _engine(port).read("entry-1", 1)
    assert e.value.kind == "unknown"
    n = len(port.calls)
    for bad in (("entry-1", 3), ("", 1), ("entry-1", True)):
        with pytest.raises(dwe.EngineError) as e:
            _engine(port).read(*bad)
        assert e.value.kind == "not_sent"
    assert len(port.calls) == n


def test_the_live_program_engine_delegates_to_the_native_commands_through_the_installed_join(monkeypatch):
    port = ProgramPort({wpd.LIST: {"programs": [_program(1, 2)]}})
    monkeypatch.setattr(wdj, "JOIN", StubJoin(port))
    assert dwe.WiskeyProgramEngine(None).read("entry-1", 1).revision == 2
    assert port.calls == [(wpd.LIST, {"station_id": "entry-1"})]
    monkeypatch.setattr(dwe, "GO_LIVE_PERMITTED", False)
    with pytest.raises(dwe.EngineError) as e:
        dwe.WiskeyProgramEngine(None).read("entry-1", 1)
    assert e.value.kind == "not_permitted" and len(port.calls) == 1
    monkeypatch.setattr(dwe, "GO_LIVE_PERMITTED", True)
    monkeypatch.setattr(dwe, "LIVE_ENGINE_BUILT", True)  # inside this test only
    assert isinstance(dwe.window_engine(None), dwe.WiskeyProgramEngine)


# ======================================================================================================================================
# auto (W-018)
# ======================================================================================================================================

def _receipt(op: str, phase: str = "acknowledged") -> dict[str, Any]:
    return {"schema_version": 1, "operation_ref": op, "state": "finished", "replay_available": False,
            "receipt": {"original": {}, "phase": phase, "physical_result": "unknown", "replay_available": False}}


@pytest.fixture()
def native(live, monkeypatch):
    port = FakeDirectPort()
    adapters = FeatureAdapters(DirectFeatureClient(port), port)
    selected = {"on": True}
    monkeypatch.setattr(wad, "FEATURES_PROVIDER", lambda: adapters if selected["on"] else None)
    monkeypatch.setattr(door_automation, "SENDER", None)  # the shipped sender: LiveSender -> NativeDoorSender
    with live["db"].connection() as conn:
        fx.set_relay_map(conn, station_id=ENTRY, api_relay=1, physical_relay=1, confirmed_by="dev-joni", expected_revision=0)
    return {**live, "port": port, "selected": selected}


def test_a_fire_reaches_the_native_door_automations_feature_with_the_original_actor(native):
    w, port = native, native["port"]
    da = _armed(w["c"])
    port.queue["features/result"] = [_receipt("op-1")]
    out = fire(w)
    assert [(o["outcome"], o["code"]) for o in out] == [("sent", "acknowledged")], out
    starts = port.sent("features/start")
    assert len(starts) == 1
    req, snap = starts[0]["request"], starts[0]["policy_snapshot"]
    assert req["feature"] == "door_automations" and req["request_id"] == out[0]["door_request_id"]
    assert req["actor"] == {"kind": "automation", "automation_id": da["id"], "run_id": out[0]["door_request_id"], "trigger_id": req["actor"]["trigger_id"],
                            "creator_user_id": "dev-joni", "approver_user_id": "dev-joni", "grant_revision": 1}
    assert req["actor"]["trigger_id"] != req["actor"]["run_id"], "the matched last_triggered stamp of the run"
    assert req["authority_revision"] == 1 and req["authority_ref"] == f"door-automation:{da['id']}"
    assert req["params"] == {"station_id": ENTRY, "relay": 1, "mapping_revision": 1, "automation_ref": da["id"], "expiry": req["execution_expires_at"]}
    assert "door/pulse" in snap["permissions"] and snap["stations"][0]["station_id"] == ENTRY
    assert [c for c, _ in port.calls] == ["features/start", "features/result"], "one start, one completion read, no retry"
    with w["db"].connection(mode="read") as conn:
        assert fx.intent_state(conn, req["request_id"]) == "accepted"
    rows = audit_rows(w["db"], "intercom.release")
    assert rows[-1]["details"]["outcome"] == "sent" and rows[-1]["details"]["code"] == "acknowledged"


def test_a_second_event_of_the_same_run_is_not_a_second_start(native):
    w, port = native, native["port"]
    _armed(w["c"])
    port.queue["features/result"] = [_receipt("op-1")]
    fire(w)
    door_automation.handle_trigger(w["db"], w["settings"], __import__("test_door_automation_295").frame())  # the same run again, no new stamp
    assert len(port.sent("features/start")) == 1


@pytest.mark.parametrize("phase", ["unknown", "attempted"])
def test_a_receipt_that_is_not_acknowledged_is_unknown(native, phase):
    w, port = native, native["port"]
    _armed(w["c"])
    port.queue["features/result"] = [_receipt("op-1", phase)]
    out = fire(w)
    assert out[0]["outcome"] == "unknown"


def test_nothing_is_sent_without_a_selected_connection_or_a_relay_map(native):
    w, port = native, native["port"]
    _armed(w["c"])
    native["selected"]["on"] = False
    out = fire(w)
    assert (out[0]["outcome"], out[0]["code"]) == ("not_sent", "transport_not_selected") and port.calls == []
    native["selected"]["on"] = True
    with w["db"].connection() as conn:
        conn.execute("UPDATE wiskey_relay_map SET active = 0")
    w["clock"].advance(seconds=30)
    out = fire(w)
    assert (out[0]["outcome"], out[0]["code"]) == ("not_sent", "relay_map_missing") and port.calls == []


def test_a_host_refusal_is_refused_and_never_retried(native):
    w, port = native, native["port"]
    _armed(w["c"])
    port.start_script = ["refuse:binding_denied"]
    out = fire(w)
    assert (out[0]["outcome"], out[0]["code"]) == ("refused", "binding_denied") and len(port.sent("features/start")) == 1


def test_a_running_operation_at_the_deadline_is_unknown(native):
    w, port = native, native["port"]
    da = _armed(w["c"])
    port.result_mode = "running"
    ticks = iter(range(0, 1000, 5))
    sender = wad.NativeDoorSender(w["db"], sleep=lambda _s: None, monotonic=lambda: float(next(ticks)))
    at = door_automation.now()
    out = sender.open(operator=door_automation.operator_of(da["id"], da["name"]), station_id=ENTRY, relay=1, request_id=str(uuid.uuid4()),
                      not_after=at + timedelta(seconds=15))
    assert out == ("unknown", "running")
    assert 1 <= len(port.sent("features/result")) <= 4 and len(port.sent("features/start")) == 1


def test_a_creator_without_the_door_permission_sends_nothing(native):
    w, port = native, native["port"]
    da = _armed(w["c"])
    with w["db"].connection() as conn:
        conn.execute("INSERT OR IGNORE INTO users(id, username, display_name, source, active, first_seen_at, last_seen_at) VALUES ('dev-nobody','nobody','nobody','dev',1,'x','x')")
        conn.execute("UPDATE door_automations SET created_by = 'dev-nobody' WHERE id = ?", (da["id"],))
    out = wad.NativeDoorSender(w["db"]).open(operator=door_automation.operator_of(da["id"], da["name"]), station_id=ENTRY, relay=1,
                                             request_id=str(uuid.uuid4()), not_after=door_automation.now() + timedelta(seconds=15))
    assert out[0] == "not_sent" and out[1] in ("policy_incomplete", "permission_missing") and port.calls == []


# ======================================================================================================================================
# card (W-005) and template (W-013)
# ======================================================================================================================================

def _valid_row() -> tuple[dict[str, Any], str]:
    for row in ROWS:
        try:
            cm.project_dto9(row["signed_message_json"], _kind(row))
        except Exception:  # noqa: BLE001
            continue
        return row, _kind(row)
    raise AssertionError("no projectable capture vector")


def _send(t: Any, row: dict[str, Any]) -> Any:
    text = row["signed_message_json"]
    if row["service_kind"] == "event":
        return t.event(None, text)
    return t.request(None, json.loads(text)["action"], text)


def test_the_card_caller_goes_through_the_dto9_preflight_on_the_direct_path(monkeypatch):
    row, kind = _valid_row()
    port = RecordingPort()
    join = StubJoin(port, selected={cd.EVENT_COMMAND, cd.REQUEST_COMMAND})
    t = wdj.mapped_card_transport(join, cd.DirectLeaseTransport(port))
    assert isinstance(t, cm.MappedLeaseTransport)
    with pytest.raises(cm.CaptureMapError) as e:  # the build default: mapping disabled -> nothing leaves Arx
        _send(t, row)
    assert e.value.reason == "mapping_disabled" and port.calls == []
    monkeypatch.setattr(cm, "MAPPING_ENABLED", True)  # inside this test only
    _send(t, row)
    assert len(port.calls) == 1 and port.calls[0][0] == cm.COMMAND_OF_KIND[kind]
    assert port.calls[0][1] == {"signed_message_json": row["signed_message_json"]}, "the same signed text, byte for byte"
    join._selected = set()
    with pytest.raises(cm.CaptureMapError) as e:
        _send(t, row)
    assert e.value.reason == "command_not_announced" and len(port.calls) == 1


def test_the_installed_join_wraps_its_direct_lease_transport():
    src = (wdj.__file__)
    text = open(src, encoding="utf-8").read()
    assert "SelectingLeaseTransport(join, mapped_card_transport(join, wiskey_capture_direct.DirectLeaseTransport(join.capture_port))," in text


def test_the_template_caller_is_the_installed_v2_provider():
    """W-013: already wired before this task (TPLV2-295); pinned so it cannot silently drift. The permit stays the owner's."""
    text = open(wdj.__file__, encoding="utf-8").read()
    assert "wts.TRANSPORT_V2_PROVIDER = join.template_v2_or_none" in text
    from smplwise.routers import access_control_template_v2 as route

    assert "sender.send_v2(" in open(route.__file__, encoding="utf-8").read()
