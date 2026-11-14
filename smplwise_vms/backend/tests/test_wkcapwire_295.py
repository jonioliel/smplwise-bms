"""WKCAPWIRE-295: WisKey's three delivered synthetic vectors consumed in our CI. FAKES ONLY - public test keys, a recording port, nothing on a network,
a station, HA or a door. Fixtures and provenance: tests/fixtures/wiskey_vectors/README.md. The all-families / DIRECT_ONLY corpus is NOT_PRODUCED by WisKey."""
from __future__ import annotations

import hashlib
import hmac
import json
import re
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Mapping

import pytest

from smplwise.errors import ApiError
from smplwise.services import capture_lease as cl
from smplwise.services import lease_events as le
from smplwise.services import trusted_caller
from smplwise.services import wiskey_capture_direct as cd
from smplwise.services import wiskey_media_bridge as mb
from smplwise.services.wiskey_capture_port import PortError

FIX = Path(__file__).resolve().parent / "fixtures" / "wiskey_vectors"
SHA = {
    "DIRECT_SIGNING_TEST_VECTOR.json": "7310ded1071c4529a115443ff460401e06fccdb3423eaaae4bd5bec3cfe2f53e",
    "wiskey_capture_two_layer_vectors_v1.json": "6591d731fe6988b4aa89b1c0ba9dba120aa57cf9cd4b7bfc5a8f316d5d3baec7",
    "wiskey_direct_simulator_profile_v1.json": "6a84a9602454db6671e51af7644338d370386946b3f575c44de0f48d94d95839",
}


def _load(name: str) -> Any:
    return json.loads((FIX / name).read_text(encoding="utf-8"))


def _canon(value: Any) -> bytes:
    return json.dumps(value, ensure_ascii=False, sort_keys=True, separators=(",", ":"), allow_nan=False).encode("utf-8")


class RecordingPort:
    """Records every call; answers with a fixed closed object or raises the given PortError. Never reaches anything."""

    def __init__(self, answer: Mapping[str, Any] | None = None, error: PortError | None = None) -> None:
        self.calls: list[tuple[str, dict[str, Any], float]] = []
        self.answer = dict(answer or {"ok": True})
        self.error = error

    def call(self, command: str, parameters: Mapping[str, Any], *, timeout_s: float) -> Mapping[str, Any]:
        self.calls.append((command, dict(parameters), timeout_s))
        if self.error:
            raise self.error
        return self.answer


CAP = _load("wiskey_capture_two_layer_vectors_v1.json")
ROWS = CAP["vectors"]
KEY = CAP["public_test_key"]
IDS = [str(r["id"]) for r in ROWS]


# ---------------------------------------------------------------- the fixtures are the recorded copies

@pytest.mark.parametrize("name", sorted(SHA))
def test_the_fixture_files_are_the_recorded_copies(name):
    assert hashlib.sha256((FIX / name).read_bytes()).hexdigest() == SHA[name]


def test_the_vectors_are_synthetic_only_and_carry_no_private_value():
    assert CAP["kind"] == "SYNTHETIC_CAPTURE_TWO_LAYER_VECTORS_V1" and CAP["key_class"] == "PUBLIC_TEST_KEY_NEVER_PRODUCTION"
    assert CAP["not_a_live_request"] is True
    text = "".join((FIX / n).read_text(encoding="utf-8") for n in SHA)
    assert not re.search(r"\b(?:\d{1,3}\.){3}\d{1,3}\b", text), "an address literal in a fixture"
    assert "01M5PXZTFFXS4DR609RN1MRJ6K" not in text, "the lab station id leaked back in"
    assert _load("wiskey_direct_simulator_profile_v1.json")["private_source_or_audio_exported"] is False


# ---------------------------------------------------------------- direct/connect: our signer reproduces WisKey's vector

def test_our_direct_connect_signer_reproduces_the_delivered_vector():
    v = _load("DIRECT_SIGNING_TEST_VECTOR.json")
    b = v["bridge"]
    body = mb.connect_body(b["parameters"]["challenge"], b["ts"], window_s=15)
    assert _canon(body).decode("utf-8") == v["canonical_utf8"]
    assert hashlib.sha256(_canon(body)).hexdigest() == v["canonical_sha256"]
    assert f"{b['ts']}.{b['nonce']}.{v['canonical_sha256']}" == v["signing_preimage"]
    signed = mb.sign_connect(v["synthetic_test_key_only"], b["parameters"]["challenge"], now=b["ts"], nonce=b["nonce"], window_s=15)
    assert signed == b, "our direct/connect envelope differs from WisKey's vector"


# ---------------------------------------------------------------- capture: the two layers

@pytest.mark.parametrize("row", ROWS, ids=IDS)
def test_both_hmac_layers_of_every_vector_verify_with_the_public_test_key(row):
    text = row["signed_message_json"]
    wire = json.loads(text)
    assert len(text.encode("utf-8")) == row["signed_message_utf8_bytes"] <= le.MAX_MESSAGE_BYTES
    assert hashlib.sha256(text.encode("utf-8")).hexdigest() == row["signed_message_text_sha256"]
    inner_body = {k: v for k, v in wire.items() if k not in {"ts", "nonce", "sig"}}
    digest = hashlib.sha256(_canon(inner_body)).hexdigest()
    assert digest == row["canonical_body_sha256"] == row["original_dto9"]["body_sha256"]
    assert hmac.compare_digest(hmac.new(KEY.encode(), f"{wire['ts']}.{wire['nonce']}.{digest}".encode(), hashlib.sha256).hexdigest(), wire["sig"])
    outer = row["direct_request"]["bridge"]
    assert outer["parameters"] == {"signed_message_json": text}
    obody = {k: v for k, v in outer.items() if k not in {"ts", "nonce", "sig"}}
    odigest = hashlib.sha256(_canon(obody)).hexdigest()
    assert odigest == row["outer_body_sha256"]
    assert hmac.compare_digest(hmac.new(KEY.encode(), f"{outer['ts']}.{outer['nonce']}.{odigest}".encode(), hashlib.sha256).hexdigest(), outer["sig"])


@pytest.mark.parametrize("row", ROWS, ids=IDS)
def test_our_lease_signer_reproduces_every_inner_message_byte_for_byte(row):
    wire = json.loads(row["signed_message_json"])
    issued = datetime.fromisoformat(wire["issued_at"].replace("Z", "+00:00")).astimezone(timezone.utc)
    expires = datetime.fromisoformat(wire["expires_at"].replace("Z", "+00:00")).astimezone(timezone.utc)
    signed = trusted_caller.sign(KEY, protocol=cl.PROTOCOL, actions=le.ALL_ACTIONS, action=wire["action"], actor_id=wire["actor"]["id"],
                                 display_name=wire["actor"]["display_name"], station=wire["station"], params=wire["params"], request_id=wire["request_id"],
                                 lifetime_s=int((expires - issued).total_seconds()), max_lifetime_s=le.MESSAGE_LIFETIME_S, max_bytes=le.MAX_MESSAGE_BYTES,
                                 now=issued, nonce=wire["nonce"], kid_on_wire=False)
    assert signed.text == row["signed_message_json"], "our lease wire differs from WisKey's original-Arx vector"


def test_the_vectors_cover_the_seven_actions_and_revoke_in_two_scopes():
    msgs = [json.loads(r["signed_message_json"]) for r in ROWS]
    assert {m["action"] for m in msgs} == {"lease_revoke", "lease_heartbeat", "lease_stream_reset", "capture_start", "capture_status", "capture_confirm", "capture_cancel"}
    assert {m["action"] for m in msgs} <= set(le.ALL_ACTIONS)
    assert len({m["params"].get("scope") for m in msgs if m["action"] == "lease_revoke"}) == 2


# ---------------------------------------------------------------- the direct transport sends exactly the vectors' text on exactly their command

@pytest.mark.parametrize("row", ROWS, ids=IDS)
def test_the_direct_transport_sends_the_original_text_on_the_vectors_own_command(row):
    wire = json.loads(row["signed_message_json"])
    outer_command = row["direct_request"]["bridge"]["command"]
    assert row["direct_request"]["type"] == "hikvision_intercom/" + outer_command
    port = RecordingPort({"state": "echo"})
    transport = cd.DirectLeaseTransport(port)
    if row["service_kind"] == "event":
        assert wire["action"] in le.EVENT_ACTIONS
        answer = transport.event(None, row["signed_message_json"])
    else:
        assert wire["action"] in le.REQUEST_ACTIONS
        answer = transport.request(None, wire["action"], row["signed_message_json"])
    assert answer == {"state": "echo"}, "the host's answer is returned as it came"
    assert port.calls == [(outer_command, {"signed_message_json": row["signed_message_json"]}, cd.TIMEOUT_S)]


def test_an_event_action_never_goes_through_the_request_command():
    row = next(r for r in ROWS if r["service_kind"] == "event")
    port = RecordingPort()
    with pytest.raises(ValueError):
        cd.DirectLeaseTransport(port).request(None, json.loads(row["signed_message_json"])["action"], row["signed_message_json"])
    assert port.calls == []


@pytest.mark.parametrize("code,outcome,status,cls", [
    ("capture_source_unavailable", "refused", 503, "not_sent"),
    ("wiskey_direct_not_connected", "not_sent", 503, "not_sent"),
    ("capture_outcome_unknown", "unknown", 504, "unknown"),
])
def test_the_hosts_outer_codes_keep_their_meaning_for_a_vector_message(code, outcome, status, cls):
    row = next(r for r in ROWS if json.loads(r["signed_message_json"])["action"] == "capture_confirm")
    port = RecordingPort(error=PortError(code, outcome))
    with pytest.raises(ApiError) as exc:
        cd.DirectLeaseTransport(port).request(None, "capture_confirm", row["signed_message_json"])
    assert exc.value.status == status and exc.value.details["outcome"] == cls
    assert len(port.calls) == 1, "the transport never resends"


def test_a_confirm_after_the_host_closed_the_session_is_refused_and_not_resent():
    """Late confirm: the host answers with a refusal code; it is judged refused (502) and the transport makes exactly ONE call."""
    row = next(r for r in ROWS if json.loads(r["signed_message_json"])["action"] == "capture_confirm")
    port = RecordingPort(error=PortError("capture_session_gone", "refused"))
    with pytest.raises(ApiError) as exc:
        cd.DirectLeaseTransport(port).request(None, "capture_confirm", row["signed_message_json"])
    assert exc.value.status == 502 and exc.value.details["outcome"] == "refused"
    assert len(port.calls) == 1


def test_a_message_over_the_bound_never_leaves():
    port = RecordingPort()
    with pytest.raises(ApiError) as exc:
        cd.DirectLeaseTransport(port).event(None, "x" * (le.MAX_MESSAGE_BYTES + 1))
    assert exc.value.details["outcome"] == "not_sent" and port.calls == []


# ---------------------------------------------------------------- the simulator profile

def test_the_simulator_profile_is_a_closed_synthetic_snapshot():
    p = _load("wiskey_direct_simulator_profile_v1.json")
    assert p["kind"] == "SYNTHETIC_SIMULATOR_PROFILE_FROM_ACTUAL_HA_REGISTRY"
    caps = p["capabilities"]
    assert caps["protocol"] and caps["commands"] and caps["station_media_contract"]
    desc = p["station_descriptor"]
    assert desc["schema"].startswith("arx.station_media.")
    assert desc["station_id"] == "SYNTHETICSTATION000000001"
    assert desc["audio"]["talk_transports"] == ["signed_ws_batch_v1"] and desc["audio"]["max_talk_seconds"] == 300
    announced = json.dumps(caps["commands"])
    for cmd in ("media/station_descriptor", "media/stream_lease", "media/talk_open", "media/talk_frame", "media/talk_floor", "media/talk_close"):
        assert cmd in announced, cmd
