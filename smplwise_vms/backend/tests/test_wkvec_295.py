"""WKVEC-295: Mac's signed vectors and simulator checked against OUR code. FAKES ONLY.

Sources (WisKey delivery `wiskey_inbox_2026-10-24`, see tests/fixtures/wiskey_vectors/README.md): the 8 two-layer capture vectors (DTO9),
the 47 family vectors (43 families) of `wiskey_native_family_vectors_v1.json`, and `wiskey_direct_simulator.py`. Every key used here is
a public test key shipped inside those files. Nothing leaves the loopback interface of this test process; no HA, station, door, NVR or
real key is involved.

Layers checked with our code
- bridge side  : `custom_components/smplwise_bridge/lease_contract.validate` + `keyset.KeySet` (LeaseDTO, DTO9 shape, stages 1-8)
- Arx signer   : `services/ha_bridge.sign` / `verify` (outer + family envelopes), `trusted_caller.sign` is covered by test_wkcapwire_295
- Arx transport: `DirectLeaseTransport` -> `DirectCapturePort` -> `DirectCommandSession` -> `DirectApiTransport` over a real loopback
                 WebSocket against Mac's `SyntheticDirectServer`, whose lease commands are answered by OUR bridge validator.

Per-vector results are the parametrised test ids (`pytest -v`, or `--junitxml`)."""
from __future__ import annotations

import asyncio
import hashlib
import hmac
import importlib.util
import json
import sys
import threading
from pathlib import Path
from typing import Any

import pytest

sys.path.insert(0, str(Path(__file__).resolve().parent))
import bridge_loader  # noqa: E402

from smplwise.errors import ApiError  # noqa: E402
from smplwise.services import ha_bridge  # noqa: E402
from smplwise.services import wiskey_capture_direct as cd  # noqa: E402
from smplwise.services import wiskey_direct_join as join  # noqa: E402
from smplwise.services import wiskey_media_bridge as bridge  # noqa: E402

FIX = Path(__file__).resolve().parent / "fixtures" / "wiskey_vectors"
SHA = {
    "wiskey_native_family_vectors_v1.json": "4cf8ff6b12ace8478e6759e2b7eb4d9375b40e6ec67e066b36a547be8213c448",
    "wiskey_direct_simulator.py": "fb552ccc3b1622fe6af78914b6c4640aaf453f56a6d277cf346b622a6832b2d2",
}

keyset = bridge_loader.load("keyset")
lc = bridge_loader.load("lease_contract")
ls = bridge_loader.load("lease_service")


def _load(name: str) -> Any:
    return json.loads((FIX / name).read_text(encoding="utf-8"))


def _canon(value: Any) -> bytes:
    return json.dumps(value, ensure_ascii=False, sort_keys=True, separators=(",", ":"), allow_nan=False).encode("utf-8")


def _sim_module():
    spec = importlib.util.spec_from_file_location("wkvec_wiskey_direct_simulator", FIX / "wiskey_direct_simulator.py")
    mod = importlib.util.module_from_spec(spec)
    sys.modules[spec.name] = mod
    spec.loader.exec_module(mod)
    return mod


CAP = _load("wiskey_capture_two_layer_vectors_v1.json")
CAP_ROWS = CAP["vectors"]
CAP_KEY = CAP["public_test_key"]
CAP_IDS = [r["id"] for r in CAP_ROWS]
FAM = _load("wiskey_native_family_vectors_v1.json")
FAM_ROWS = FAM["vectors"]
FAM_KEY = FAM["public_test_key"]
FAM_IDS = [r["id"] for r in FAM_ROWS]
KIND = {"event": lc.KIND_EVENT, "request": lc.KIND_REQUEST}


# ---------------------------------------------------------------- provenance

@pytest.mark.parametrize("name", sorted(SHA))
def test_new_fixture_files_are_the_recorded_copies(name):
    assert hashlib.sha256((FIX / name).read_bytes()).hexdigest() == SHA[name]


def test_the_public_test_keys_are_the_only_keys_in_play():
    assert FAM["key_class"] == CAP["key_class"] == "PUBLIC_TEST_KEY_NEVER_PRODUCTION"
    assert FAM_KEY == "synthetic-round4-direct-pairing"
    assert CAP_KEY == "public-synthetic-capture-vector-key-never-production"
    assert all(r.get("synthetic_only") is True for r in FAM_ROWS + CAP_ROWS)


# ---------------------------------------------------------------- capture vectors (DTO9) through OUR bridge validator

def _validate(row: dict[str, Any], *, key: str = CAP_KEY, kind: str | None = None, text: str | None = None, now: int | None = None, ks: Any = None):
    ts = json.loads(row["signed_message_json"])["ts"]
    at = ts if now is None else now
    ks = ks or keyset.KeySet(key, now=lambda: float(at))
    return lc.validate(kind or KIND[row["service_kind"]], {"signed_message_json": text or row["signed_message_json"]}, ks, at)


@pytest.mark.parametrize("row", CAP_ROWS, ids=CAP_IDS)
def test_our_bridge_accepts_every_capture_vector_and_builds_exactly_the_original_dto9(row):
    dto = _validate(row)
    assert dto.as_json() == row["original_dto9"], "our LeaseDTO differs from WisKey's original_dto9"
    assert dto.body_sha256 == row["canonical_body_sha256"] == row["original_dto9"]["body_sha256"]
    assert dto.intact() is True and dto.kind == KIND[row["service_kind"]] and repr(dto) == f"LeaseDTO({row['action']})"
    assert set(dto.as_json()) == {"action", "actor", "station", "params", "request_id", "nonce", "issued_at", "expires_at", "body_sha256"}


@pytest.mark.parametrize("row", CAP_ROWS, ids=CAP_IDS)
def test_our_bridge_refuses_a_replayed_wrong_keyed_tampered_or_misrouted_capture_vector(row):
    ts = json.loads(row["signed_message_json"])["ts"]
    ks = keyset.KeySet(CAP_KEY, now=lambda: float(ts))
    _validate(row, ks=ks)
    with pytest.raises(lc.Reject) as replay:
        _validate(row, ks=ks)
    assert (replay.value.stage, replay.value.code) == ("state", "replay")
    with pytest.raises(lc.Reject) as wrong_key:
        _validate(row, key="a-different-public-test-key")
    assert (wrong_key.value.stage, wrong_key.value.code) == ("signature", "bad_signature")
    wire = json.loads(row["signed_message_json"])
    wire["request_id"] = "00000000-0000-0000-0000-0000000000ff"
    with pytest.raises(lc.Reject) as tampered:
        _validate(row, text=json.dumps(wire, separators=(",", ":"), ensure_ascii=False))
    assert (tampered.value.stage, tampered.value.code) == ("signature", "bad_signature")
    other = lc.KIND_REQUEST if row["service_kind"] == "event" else lc.KIND_EVENT
    with pytest.raises(lc.Reject) as misrouted:
        _validate(row, kind=other)
    assert (misrouted.value.stage, misrouted.value.code) == ("binding", "action_service_mismatch")


@pytest.mark.parametrize("row", CAP_ROWS, ids=CAP_IDS)
def test_our_bridge_applies_the_time_stage_to_every_capture_vector(row):
    wire = json.loads(row["signed_message_json"])
    ts = wire["ts"]
    with pytest.raises(lc.Reject) as late:
        _validate(row, now=ts + 15)
    assert (late.value.stage, late.value.code) == ("time", "expired")
    with pytest.raises(lc.Reject) as early:
        _validate(row, now=ts - 1)
    assert (early.value.stage, early.value.code) == ("time", "not_yet_valid")
    assert _validate(row, now=ts + 14).as_json() == row["original_dto9"]


@pytest.mark.parametrize("row", CAP_ROWS, ids=CAP_IDS)
def test_our_bridge_keyset_and_arx_signer_reproduce_both_layers_of_every_capture_vector(row):
    wire = json.loads(row["signed_message_json"])
    inner = {k: v for k, v in wire.items() if k not in {"ts", "nonce", "sig"}}
    assert keyset.v1_sig(CAP_KEY, inner, wire["ts"], wire["nonce"]) == wire["sig"]
    assert ha_bridge.sign(CAP_KEY, inner, ts=wire["ts"], nonce=wire["nonce"]) == wire
    assert keyset.KeySet(CAP_KEY).verify(wire, float(wire["ts"])) is None
    outer = row["direct_request"]["bridge"]
    obody = {k: v for k, v in outer.items() if k not in {"ts", "nonce", "sig"}}
    assert ha_bridge.sign(CAP_KEY, obody, ts=outer["ts"], nonce=outer["nonce"]) == outer, "our outer (pairing) signer differs"
    assert hashlib.sha256(_canon(obody)).hexdigest() == row["outer_body_sha256"]
    assert outer["kind"] == join.envelope_kind(outer["command"]) == "wiskey-bridge-command.v1"
    assert outer["command"] in (cd.EVENT_COMMAND, cd.REQUEST_COMMAND)
    assert outer["command"] == (cd.EVENT_COMMAND if row["service_kind"] == "event" else cd.REQUEST_COMMAND)


# ---------------------------------------------------------------- family vectors: our signer and our envelope rules

def test_the_family_corpus_has_the_announced_shape():
    assert len(FAM_ROWS) == 47 and len(set(FAM_IDS)) == 47
    assert len(FAM["catalog_families"]) == 43 and {r["family"] for r in FAM_ROWS} == set(FAM["catalog_families"])
    assert sum(1 for r in FAM_ROWS if r["expected"]["success"]) == 42 and sum(1 for r in FAM_ROWS if not r["expected"]["success"]) == 5
    assert {"peer_identity/get", "direct/capabilities", "direct/time"} <= {r["command"] for r in FAM_ROWS}


@pytest.mark.parametrize("row", FAM_ROWS, ids=FAM_IDS)
def test_our_signer_reproduces_every_family_vector_and_our_verifier_accepts_it(row):
    wire = row["request"]["bridge"]
    body = {k: v for k, v in wire.items() if k not in {"ts", "nonce", "sig"}}
    digest = hashlib.sha256(_canon(body)).hexdigest()
    assert digest == row["canonical_body_sha256"]
    assert hashlib.sha256(_canon(body["parameters"])).hexdigest() == row["parameters_sha256"]
    assert hashlib.sha256(_canon(row["parameters_schema"])).hexdigest() == row["schema_sha256"]
    assert hmac.compare_digest(hmac.new(FAM_KEY.encode(), f"{wire['ts']}.{wire['nonce']}.{digest}".encode(), hashlib.sha256).hexdigest(), wire["sig"])
    assert ha_bridge.sign(FAM_KEY, body, ts=wire["ts"], nonce=wire["nonce"]) == wire, "Arx signer (ha_bridge.sign) differs from Mac's vector"
    assert keyset.v1_sig(FAM_KEY, body, wire["ts"], wire["nonce"]) == wire["sig"]
    ha_bridge.verify(FAM_KEY, wire, now=float(wire["ts"]))  # raises ApiError on a bad / stale / replayed signature
    assert row["request"]["type"] == bridge.TYPE_PREFIX + row["command"] and body["command"] == row["command"]


@pytest.mark.parametrize("row", FAM_ROWS, ids=FAM_IDS)
def test_our_envelope_rules_agree_with_every_family_vector(row):
    wire = row["request"]["bridge"]
    assert wire["kind"] == join.envelope_kind(row["command"]), "envelope kind (bridge command / peer query) differs from ours"
    assert wire["query_owner_id"].startswith(bridge.DIRECT_SERVICE_PREFIX)
    issued, expires = (_ts(wire[k]) for k in ("issued_at", "expires_at"))
    assert 0 < expires - issued <= bridge.MAX_WINDOW_S
    assert not bridge.TYPE_PREFIX or not row["command"].startswith(bridge.TYPE_PREFIX)
    assert row["family"] == row["command"].split("/")[0]
    exp, obs = row["expected"], row["native_validator"]
    assert obs["matches_expected"] is True and exp["success"] == obs["observed_success"]
    assert (obs["observed_error_code"] is None) if exp["success"] else (obs["observed_error_code"] in exp["error_codes"])


def _ts(text: str) -> int:
    from datetime import datetime

    return int(datetime.fromisoformat(text.replace("Z", "+00:00")).timestamp())


# ---------------------------------------------------------------- Mac's simulator against our transport, on loopback

class _Sim:
    """Runs `SyntheticDirectServer` on its own loop in a thread. Lease commands are answered by OUR bridge validator."""

    def __init__(self) -> None:
        self.mod = _sim_module()
        self.profile = _load("wiskey_direct_simulator_profile_v1.json")
        self.seen: list[tuple[str, dict[str, Any]]] = []
        self.answers: dict[str, Any] = {}
        self.port: int | None = None
        self.server: Any = None
        self._loop: asyncio.AbstractEventLoop | None = None
        self._ready = threading.Event()
        self._stop: asyncio.Event | None = None
        self._thread = threading.Thread(target=self._run, daemon=True)

    def _answer(self, kind: str):
        def respond(parameters: dict[str, Any]) -> dict[str, Any]:
            self.seen.append((kind, parameters))
            text = parameters["signed_message_json"]
            wire = json.loads(text)
            at = wire["ts"]
            try:
                dto = lc.validate(KIND[kind], parameters, keyset.KeySet(CAP_KEY, now=lambda: float(at)), at)
            except lc.Reject as rej:
                return rej.answer()
            self.answers[wire["request_id"]] = dto.as_json()
            return {"result": "accepted", "request_id": dto.request_id, "action": dto.action}

        return respond

    def _run(self) -> None:
        async def main() -> None:
            self._stop = asyncio.Event()
            self._loop = asyncio.get_running_loop()
            responses = {"capture/lease_event": self._answer("event"), "capture/lease_request": self._answer("request")}
            async with self.mod.SyntheticDirectServer(self.profile, responses=responses) as server:
                self.server, self.port = server, server.port
                self._ready.set()
                await self._stop.wait()

        asyncio.run(main())

    def start(self) -> "_Sim":
        self._thread.start()
        assert self._ready.wait(10), "simulator did not start"
        return self

    def stop(self) -> None:
        if self._loop and self._stop:
            self._loop.call_soon_threadsafe(self._stop.set)
        self._thread.join(10)


@pytest.fixture()
def sim_env():
    import websockets

    sim = _Sim().start()
    url = f"ws://127.0.0.1:{sim.port}{sim.mod.PATH}"

    async def opener():
        return await websockets.connect(url, open_timeout=5, close_timeout=1, max_size=bridge.DIRECT_MAX_FRAME_BYTES)

    transport = bridge.DirectApiTransport(opener, lambda: sim.mod.SYNTHETIC_KEY)
    session = join.DirectCommandSession(transport)
    port = join.DirectCapturePort(session)
    try:
        yield sim, session, port, cd.DirectLeaseTransport(port, timeout_s=3.0)
    finally:
        session.close()
        sim.stop()


def test_the_simulator_authenticates_our_direct_connect_and_reports_its_service_identity(sim_env):
    sim, session, port, _lt = sim_env
    assert session.connect_ready(5.0) is True
    ident = port.identity()
    assert ident.query_owner_id == "arx-service:synthetic-pairing-entry" and ident.repository_id == "synthetic-repository"
    caps = session.run_sync(session.call("direct/capabilities", {}, timeout=3.0), 5.0)
    assert isinstance(caps, dict) and caps


@pytest.mark.parametrize("row", CAP_ROWS, ids=CAP_IDS)
def test_every_capture_vector_travels_our_direct_transport_through_the_simulator_into_our_bridge_validator(sim_env, row):
    sim, _session, _port, lt = sim_env
    text = row["signed_message_json"]
    wire = json.loads(text)
    if row["service_kind"] == "event":
        answer = lt.event(None, text)
    else:
        answer = lt.request(None, wire["action"], text)
    assert answer == {"result": "accepted", "request_id": wire["request_id"], "action": wire["action"]}, answer
    assert sim.seen == [(row["service_kind"], {"signed_message_json": text})], "the simulator did not receive the original text verbatim"
    assert sim.answers[wire["request_id"]] == row["original_dto9"]
    assert sim.server.accepted_commands >= 1


def test_the_simulator_refuses_a_missing_command_and_our_transport_classifies_the_outcomes(sim_env):
    sim, session, port, lt = sim_env
    with pytest.raises(join.bridge.MediaBridgeError) as unavailable:
        session.run_sync(session.call("acceptance/get", {"station_id": "x"}, timeout=3.0), 5.0)
    assert (unavailable.value.code, unavailable.value.outcome) == ("command_unavailable", "refused")
    row = CAP_ROWS[0]
    sim.server.inject("capture/lease_event", "drop_ack")
    with pytest.raises(ApiError) as dropped:
        lt.event(None, row["signed_message_json"])
    assert dropped.value.details["outcome"] == "unknown" and dropped.value.code == cd.UNKNOWN_CODE


def test_a_forged_reply_mac_is_never_taken_as_an_answer(sim_env):
    sim, _session, _port, lt = sim_env
    sim.server.inject("capture/lease_event", "bad_reply_mac")
    with pytest.raises(ApiError) as forged:
        lt.event(None, CAP_ROWS[0]["signed_message_json"])
    assert forged.value.details["outcome"] == "unknown"
