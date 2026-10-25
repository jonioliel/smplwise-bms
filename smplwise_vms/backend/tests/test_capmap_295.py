"""CAPMAP-295: the disabled Arx-side DTO9 map of the card-capture lease (services/wiskey_capture_map.py). FAKES ONLY - WisKey's synthetic
two-layer vectors with their PUBLIC test key, the real bridge receiver modules loaded without Home Assistant (bridge_loader), a recording
port. Nothing reaches a network, WisKey, Home Assistant, a station, a reader or a door."""
from __future__ import annotations

import hashlib
import json
import sys
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Mapping

import pytest

sys.path.insert(0, str(Path(__file__).resolve().parent))
import bridge_loader  # noqa: E402

from smplwise.errors import ApiError  # noqa: E402
from smplwise.routers import access_control  # noqa: E402
from smplwise.services import capture_lease as cl  # noqa: E402
from smplwise.services import lease_events as le  # noqa: E402
from smplwise.services import wiskey_capture_direct as cd  # noqa: E402
from smplwise.services import wiskey_capture_map as cm  # noqa: E402
from smplwise.services.wiskey_capture_port import PortError  # noqa: E402

FIX = Path(__file__).resolve().parent / "fixtures" / "wiskey_vectors"
CAP = json.loads((FIX / "wiskey_capture_two_layer_vectors_v1.json").read_text(encoding="utf-8"))
ROWS = CAP["vectors"]
IDS = [str(r["id"]) for r in ROWS]
KEY = CAP["public_test_key"]
REPO = bridge_loader.REPO

bconst = bridge_loader.load("const")
bkeyset = bridge_loader.load("keyset")
blc = bridge_loader.load("lease_contract")

ANNOUNCED = frozenset({cd.EVENT_COMMAND, cd.REQUEST_COMMAND, "cards/capture_start"})


class RecordingPort:
    def __init__(self, answer: Mapping[str, Any] | None = None, error: PortError | None = None) -> None:
        self.calls: list[tuple[str, dict[str, Any], float]] = []
        self.answer = dict(answer or {"result": "host-answer"})
        self.error = error

    def call(self, command: str, parameters: Mapping[str, Any], *, timeout_s: float) -> Mapping[str, Any]:
        self.calls.append((command, dict(parameters), timeout_s))
        if self.error:
            raise self.error
        return self.answer


def _kind(row: dict[str, Any]) -> str:
    return cm.KIND_EVENT if row["service_kind"] == "event" else cm.KIND_REQUEST


def _mapped(port: RecordingPort, announced: Any = ANNOUNCED, on: bool = True) -> cm.MappedLeaseTransport:
    return cm.MappedLeaseTransport(cd.DirectLeaseTransport(port), lambda: announced, is_enabled=lambda: on)


def _send(t: cm.MappedLeaseTransport, row: dict[str, Any]) -> Any:
    text = row["signed_message_json"]
    if row["service_kind"] == "event":
        return t.event(None, text)
    return t.request(None, json.loads(text)["action"], text)


def _epoch(s: str) -> int:
    return int(datetime.strptime(s, "%Y-%m-%dT%H:%M:%SZ").replace(tzinfo=timezone.utc).timestamp())


# ---------------------------------------------------------------- the flag and the honest state

def test_the_mapping_flag_is_off_in_this_build_and_cannot_be_on_without_macs_table():
    assert cm.MAPPING_ENABLED is False and cm.enabled() is False
    assert cm.confirmed() is False, "no Mac symbol is in the table yet"
    assert not cm.MAPPING_ENABLED or cm.confirmed(), "the flag may only be flipped together with Mac's reviewed table"


def test_the_go_live_permit_and_the_lease_route_are_untouched():
    assert cl.GO_LIVE_PERMITTED is False and cl.MIN_BRIDGE_FOR_CAPTURE_LEASE is None
    src = (REPO / "smplwise_vms" / "backend" / "smplwise" / "services" / "wiskey_direct_join.py").read_text(encoding="utf-8")
    assert "wiskey_capture_map" not in src, "the map is not wired into the direct join in this build"


def test_state_is_honest():
    s = cm.state(ANNOUNCED)
    assert s == {"state": "disabled", "receiver_symbol": cm.RECEIVER_SYMBOL, "mac_mapping": "PENDING_MAC",
                 "installation": "NOT_PERFORMED", "live": "NOT_MEASURED"}


def test_state_when_enabled_is_unsupported_without_the_announcement_and_unverified_with_it(monkeypatch):
    monkeypatch.setattr(cm, "MAPPING_ENABLED", True)
    assert cm.state(None)["state"] == "unsupported"
    assert cm.state({cd.EVENT_COMMAND})["state"] == "unsupported"
    assert cm.state(ANNOUNCED)["state"] == "mapped_unverified", "never 'mapped' while Mac's column is empty"


# ---------------------------------------------------------------- the table

def test_the_table_covers_the_seven_actions_on_the_existing_commands_and_services():
    assert [r.action for r in cm.MAP] == list(le.ALL_ACTIONS)
    assert len(cm.MAP) == 7
    for r in cm.MAP:
        if r.action in le.EVENT_ACTIONS:
            assert (r.kind, r.direct_command, r.bridge_service) == ("event", cd.EVENT_COMMAND, "smplwise_bridge." + bconst.SERVICE_LEASE_EVENT)
        else:
            assert (r.kind, r.direct_command, r.bridge_service) == ("request", cd.REQUEST_COMMAND, "smplwise_bridge." + bconst.SERVICE_LEASE_REQUEST)
        assert r.receiver_symbol == cm.RECEIVER_SYMBOL
        assert r.mac_symbol is None and r.mac_sha256 is None
        assert blc.KIND_OF[r.action] == r.kind, "the receiver's own kind table agrees"


def test_the_receiver_symbol_exists_and_its_dto_has_exactly_the_nine_keys():
    path, symbol = cm.RECEIVER_SYMBOL.split(":")
    assert (REPO / path).is_file() and hasattr(blc, symbol)
    names = [s for s in blc.LeaseDTO.__slots__ if s != "__weakref__"]
    assert len(names) == 10  # actor id + display name collapse into one `actor` key in as_json()
    assert set(cm.DTO9_KEYS) == {"action", "actor", "station", "params", "request_id", "nonce", "issued_at", "expires_at", "body_sha256"}
    assert cm.WIRE_KEYS == blc.WIRE_KEYS


def test_the_receiver_source_is_the_one_the_vectors_were_made_from():
    for rel, want in CAP["source_files"].items():
        assert hashlib.sha256((REPO / rel).read_bytes()).hexdigest() == want, f"{rel} drifted from the vectors' provenance"


# ---------------------------------------------------------------- the projection equals the original DTO9 and the real receiver's DTO

@pytest.mark.parametrize("row", ROWS, ids=IDS)
def test_the_projection_reproduces_the_vectors_original_dto9(row):
    assert cm.project_dto9(row["signed_message_json"], _kind(row)) == row["original_dto9"]


@pytest.mark.parametrize("row", ROWS, ids=IDS)
def test_the_projection_equals_what_the_real_receiver_hands_on(row):
    """The bridge's own `lease_contract.validate` with its own KeySet on the PUBLIC test key, at the message's issue second."""
    text = row["signed_message_json"]
    issued = _epoch(json.loads(text)["issued_at"])
    ks = bkeyset.KeySet(KEY, now=lambda: float(issued))
    dto = blc.validate(_kind(row), {"signed_message_json": text}, ks, issued)
    assert dto.intact()
    assert dto.as_json() == cm.project_dto9(text, _kind(row)) == row["original_dto9"]


# ---------------------------------------------------------------- pre-flight refusals never reach the port

def test_disabled_mapping_is_unsupported_and_sends_nothing():
    port = RecordingPort()
    t = cm.MappedLeaseTransport(cd.DirectLeaseTransport(port), lambda: ANNOUNCED)  # the build default
    for row in ROWS:
        with pytest.raises(cm.CaptureUnsupported) as exc:
            _send(t, row)
        assert exc.value.reason == "mapping_disabled"
        assert exc.value.status == 503 and exc.value.code == cm.UNSUPPORTED_CODE
        assert exc.value.details == {"outcome": "not_sent", "state": "unsupported", "reason": "mapping_disabled"}
    assert port.calls == []


@pytest.mark.parametrize("announced", [None, "capture/lease_event", 42])
def test_an_unknown_announcement_is_unsupported(announced):
    port = RecordingPort()
    with pytest.raises(cm.CaptureUnsupported) as exc:
        _send(_mapped(port, announced), ROWS[0])
    assert exc.value.reason == "capabilities_unknown" and port.calls == []


def test_an_announcement_reader_that_fails_is_unsupported():
    port = RecordingPort()

    def boom() -> Any:
        raise RuntimeError("socket")

    t = cm.MappedLeaseTransport(cd.DirectLeaseTransport(port), boom, is_enabled=lambda: True)
    with pytest.raises(cm.CaptureUnsupported) as exc:
        _send(t, ROWS[0])
    assert exc.value.reason == "capabilities_unknown" and port.calls == []


@pytest.mark.parametrize("row", ROWS, ids=IDS)
def test_a_peer_that_does_not_announce_the_command_is_unsupported(row):
    port = RecordingPort()
    other = cd.REQUEST_COMMAND if row["service_kind"] == "event" else cd.EVENT_COMMAND
    with pytest.raises(cm.CaptureUnsupported) as exc:
        _send(_mapped(port, {other, "cards/capture_start"}), row)
    assert exc.value.reason == "command_not_announced" and port.calls == []


def _mutate(text: str, **change: Any) -> str:
    m = json.loads(text)
    for k, v in change.items():
        if v is None:
            m.pop(k, None)
        else:
            m[k] = v
    return json.dumps(m, separators=(",", ":"), ensure_ascii=False)


REQ = next(r for r in ROWS if r["service_kind"] == "request")
EVT = next(r for r in ROWS if r["service_kind"] == "event")


@pytest.mark.parametrize("text,reason", [
    ("", "not_text"),
    ("x" * (le.MAX_MESSAGE_BYTES + 1), "message_too_large"),
    ("{not json", "invalid_json"),
    ('{"a":1,"a":2}', "duplicate_key"),
    ('{"a":NaN}', "invalid_json"),
    ('{"a":1.5}', "invalid_json"),
    ("[1,2]", "not_an_object"),
    (_mutate(REQ["signed_message_json"], kid="k1"), "unknown_field"),
    (_mutate(REQ["signed_message_json"], sig=None), "missing_field"),
    (_mutate(REQ["signed_message_json"], protocol="wiskey-capture-lease-v2"), "wrong_protocol"),
    (_mutate(REQ["signed_message_json"], action="door_open"), "wrong_action"),
    (_mutate(REQ["signed_message_json"], actor="someone"), "wrong_type"),
])
def test_a_text_that_cannot_become_dto9_never_leaves(text, reason):
    port = RecordingPort()
    with pytest.raises(cm.CaptureProjectionError) as exc:
        _mapped(port).request(None, json.loads(REQ["signed_message_json"])["action"], text)
    assert exc.value.reason == reason and exc.value.details["outcome"] == "not_sent"
    assert port.calls == []


def test_an_event_text_on_the_request_command_and_vice_versa_is_refused():
    port = RecordingPort()
    with pytest.raises(cm.CaptureProjectionError) as exc:
        _mapped(port).event(None, REQ["signed_message_json"])
    assert exc.value.reason == "kind_mismatch"
    action = json.loads(REQ["signed_message_json"])["action"]
    with pytest.raises(cm.CaptureProjectionError) as exc:
        _mapped(port).request(None, action, EVT["signed_message_json"])
    assert exc.value.reason == "kind_mismatch"
    assert port.calls == []


def test_a_request_whose_text_names_another_action_is_refused():
    port = RecordingPort()
    wire_action = json.loads(REQ["signed_message_json"])["action"]
    other = next(a for a in cl.LEASE_ACTIONS if a != wire_action)
    with pytest.raises(cm.CaptureProjectionError) as exc:
        _mapped(port).request(None, other, REQ["signed_message_json"])
    assert exc.value.reason == "action_mismatch" and port.calls == []


def test_an_event_action_never_goes_through_the_request_method():
    port = RecordingPort()
    with pytest.raises(ValueError):
        _mapped(port).request(None, "lease_heartbeat", EVT["signed_message_json"])
    assert port.calls == []


# ---------------------------------------------------------------- enabled + announced: the SAME text through the existing transport

@pytest.mark.parametrize("row", ROWS, ids=IDS)
def test_when_enabled_and_announced_the_original_text_goes_on_its_own_command_once(row):
    port = RecordingPort({"state": "echo"})
    answer = _send(_mapped(port), row)
    assert answer == {"state": "echo"}, "the host's answer is returned as it came - the map never builds one"
    assert port.calls == [(row["direct_request"]["bridge"]["command"], {"signed_message_json": row["signed_message_json"]}, cd.TIMEOUT_S)]


@pytest.mark.parametrize("code,outcome,status,cls", [
    ("capture_source_unavailable", "refused", 503, "not_sent"),
    ("wiskey_direct_not_connected", "not_sent", 503, "not_sent"),
    ("capture_outcome_unknown", "unknown", 504, "unknown"),
    ("capture_session_gone", "refused", 502, "refused"),
])
def test_host_and_transport_errors_keep_their_meaning_and_are_never_resent(code, outcome, status, cls):
    port = RecordingPort(error=PortError(code, outcome))
    with pytest.raises(ApiError) as exc:
        _send(_mapped(port), REQ)
    assert not isinstance(exc.value, cm.CaptureMapError)
    assert exc.value.status == status and exc.value.details["outcome"] == cls
    assert len(port.calls) == 1


# ---------------------------------------------------------------- the routes read the refusals as not_sent

def test_the_capture_routes_treat_both_map_codes_as_not_sent():
    assert {cm.UNSUPPORTED_CODE, cm.PROJECTION_CODE} <= access_control._NOT_SENT_CODES
    assert set(cd.NOT_SENT_CODES) <= access_control._NOT_SENT_CODES


def test_a_refusal_carries_no_message_text():
    port = RecordingPort()
    secret_label = "PRIVATE-LABEL-1234"
    text = _mutate(REQ["signed_message_json"], kid=secret_label)
    with pytest.raises(cm.CaptureProjectionError) as exc:
        _mapped(port).request(None, json.loads(REQ["signed_message_json"])["action"], text)
    assert secret_label not in json.dumps(exc.value.payload("cid"), ensure_ascii=False)
    assert secret_label not in str(exc.value)
