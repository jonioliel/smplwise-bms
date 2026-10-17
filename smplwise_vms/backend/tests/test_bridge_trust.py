"""CR-040 (WXROT), bridge 0.9.1: the bridge's trust core (custom_components/smplwise_bridge/trust.py, loaded without Home Assistant) and
its Home Assistant glue (trust_service.py, with Home Assistant stubbed). Synthetic test keys only; nothing here reaches a bridge.

Proven here: the stage order and the closed refusals; ONE valid key at every instant (before a rotation only the current key verifies,
after it only the next - for the trust services AND for every other signed service through the shared Verifier); persist-then-switch
(a failed write switches nothing); the fence; replays (same message, same nonce, a fenced id, a cross-key nonce); concurrent rotations
(exactly one applies); the ledger never shrinks and the nonce cache is never cleared by a rotation; the start-up reconcile matrix; HKDF
against RFC 5869 and the `cryptography` library; no proof / key / salt / nonce / signature in what may be logged; 0.9.1 everywhere."""
from __future__ import annotations

import asyncio
import copy
import hashlib
import hmac
import json
import random
import sys
import types
import uuid
from datetime import datetime, timedelta, timezone
from pathlib import Path
from typing import Any

import pytest
from bridge_loader import MIRROR, SRC, init_tree, load

trust = load("trust")
signing = load("signing")

KEY = "TEST-ONLY-bridge-trust-key-0001-NOT-A-REAL-SECRET"
OTHER = "TEST-ONLY-some-other-key-NOT-A-REAL-SECRET"
T0 = 1791028800  # 2026-10-03T12:00:00Z
ACTOR = {"id": "dev-joni", "display_name": "יוני"}


def rid() -> str:
    return str(uuid.uuid4())


def iso(ts: int) -> str:
    return datetime.fromtimestamp(ts, tz=timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")


def message(key: str, action: str, params: dict[str, Any], *, request_id: str | None = None, issued: int = T0, lifetime: int = 30, nonce: str | None = None,
            extra: dict[str, Any] | None = None, actor: dict[str, Any] | None = None, ts: int | None = None, drop: str | None = None) -> str:
    body: dict[str, Any] = {"protocol": trust.PROTOCOL, "action": action, "actor": actor or dict(ACTOR), "params": params,
                            "request_id": request_id or rid(), "issued_at": iso(issued), "expires_at": iso(issued + lifetime), **(extra or {})}
    if drop:
        body.pop(drop)
    wire = signing.sign(key, body, issued if ts is None else ts, nonce or uuid.uuid4().hex)
    return json.dumps(wire, ensure_ascii=False, separators=(",", ":"))


def rotate_text(key: str, epoch_from: int = 1, **kw: Any) -> str:
    return message(key, trust.SERVICE_ROTATE, {"epoch_from": epoch_from, "salt": kw.pop("salt", "ab" * 32)}, **kw)


def status_text(key: str, target: str, **kw: Any) -> str:
    return message(key, trust.SERVICE_STATUS, {"target_request_id": target}, **kw)


def data(text: str) -> dict[str, str]:
    return {"signed_message_json": text}


class Bridge:
    """The real runtime with an in-memory durable store (the fake bridge of the add-on's tests uses the same pieces)."""

    def __init__(self, key: str = KEY, now: int = T0 + 1) -> None:
        self.verifier = signing.Verifier(key)
        self.saved: list[dict[str, Any]] = []
        self.fail_next = False
        self.now = now
        self.runtime = trust.TrustRuntime(self.verifier, trust.new_state("entry-1", "legacy"), self._save, clock=lambda: self.now)

    async def _save(self, state: dict[str, Any]) -> None:
        if self.fail_next:
            self.fail_next = False
            raise OSError("disk full (test)")
        self.saved.append(copy.deepcopy(state))

    def call(self, service: str, text_or_data: Any) -> dict[str, Any]:
        payload = data(text_or_data) if isinstance(text_or_data, str) else text_or_data
        return asyncio.run(self.runtime.handle(service, payload))


def run_process(text_or_data: Any, service: str = trust.SERVICE_ROTATE, *, state: dict[str, Any] | None = None, key: str = KEY, now: int = T0 + 1, seen: set[str] | None = None) -> Any:
    seen = set() if seen is None else seen

    def check(nonce: str, _now: float) -> bool:
        if nonce in seen:
            return False
        seen.add(nonce)
        return True

    payload = data(text_or_data) if isinstance(text_or_data, str) else text_or_data
    return trust.process(service, payload, state or trust.new_state("entry-1", "legacy"), key, now, check)


# ---------------------------------------------------------------- derivation

def test_hkdf_matches_rfc5869_test_case_1():
    ikm, salt, info = bytes([0x0B] * 22), bytes(range(0x00, 0x0D)), bytes(range(0xF0, 0xFA))
    okm = trust.hkdf_sha256(ikm, salt, info, 42)
    assert okm.hex() == "3cb25f25faacd57a90434f64d0362f2a2d2d0a90cf1a5a4c5db02d56ecc4c5bf34007208d5b887185865"


def test_hkdf_matches_the_cryptography_library():
    from cryptography.hazmat.primitives import hashes
    from cryptography.hazmat.primitives.kdf.hkdf import HKDF

    rnd = random.Random(40)
    for _ in range(25):
        ikm, salt, info = rnd.randbytes(rnd.randint(1, 80)), rnd.randbytes(32), rnd.randbytes(rnd.randint(0, 60))
        assert trust.hkdf_sha256(ikm, salt, info, 32) == HKDF(algorithm=hashes.SHA256(), length=32, salt=salt, info=info).derive(ikm)


def test_the_next_key_is_bound_to_key_salt_epoch_and_request():
    r = rid()
    k = trust.derive_next_key(KEY, "ab" * 32, 2, r)
    assert k == trust.derive_next_key(KEY, "ab" * 32, 2, r), "deterministic: both sides derive the same key"
    assert len(k) == 43 and set(k) <= set("ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_")
    assert len({k, trust.derive_next_key(OTHER, "ab" * 32, 2, r), trust.derive_next_key(KEY, "cd" * 32, 2, r), trust.derive_next_key(KEY, "ab" * 32, 3, r),
                trust.derive_next_key(KEY, "ab" * 32, 2, rid())}) == 5
    assert KEY not in k and k != KEY


def test_proofs_are_domain_separated_from_message_signatures():
    p = trust.proof(KEY, "rotated", "id", 2)
    assert p == hmac.new(KEY.encode(), f"{trust.PROTOCOL}|rotated|id|2".encode(), hashlib.sha256).hexdigest()
    assert p != trust.proof(OTHER, "rotated", "id", 2) and p != trust.proof(KEY, "status", "id", 2)


# ---------------------------------------------------------------- the stage order and the closed refusals

def _stage(text_or_data: Any, service: str = trust.SERVICE_ROTATE, **kw: Any) -> tuple[str, str, bool]:
    out = run_process(text_or_data, service, **kw)
    a = out.answer
    assert a["result"] == "rejected" and out.state is None and out.key is None, a
    assert set(a) <= {"result", "stage", "code", "request_id"}
    return a["stage"], a["code"], "request_id" in a


def test_each_stage_refuses_its_own_defect_in_order():
    r = rid()
    cases = [
        ({"signed_message_json": rotate_text(KEY), "x": 1}, ("transport", "transport_shape", False)),
        ({"signed_message_json": 5}, ("transport", "transport_shape", False)),
        ("[" + "1," * 3000 + "1]", ("encoding", "message_too_large", False)),
        ('{"a": 1, "a": 2}', ("parse", "duplicate_key", False)),
        ('{"a": NaN}', ("parse", "non_json_constant", False)),
        ('{"a": 1.5}', ("parse", "non_integer_number", False)),
        ('{"a": 9007199254740993}', ("parse", "integer_out_of_range", False)),
        ("[1]", ("parse", "not_an_object", False)),
        ("{", ("parse", "invalid_json", False)),
        (rotate_text(KEY, extra={"more": 1}), ("schema", "unknown_field", False)),
        (rotate_text(KEY, drop="actor"), ("schema", "missing_field", False)),
        (rotate_text(KEY, epoch_from=True), ("schema", "wrong_type", False)),
        (rotate_text(KEY, epoch_from=0), ("schema", "bad_value", False)),
        (rotate_text(KEY, salt="AB" * 32), ("schema", "bad_format", False)),
        (rotate_text(KEY, actor={"id": "x‮y", "display_name": "n"}), ("schema", "bad_value", False)),
        (rotate_text(KEY, request_id="NOT-A-UUID"), ("schema", "bad_format", False)),
        (rotate_text(KEY, ts=T0 + 1), ("binding", "ts_mismatch", True)),
        (rotate_text(OTHER), ("signature", "bad_signature", True)),
        (rotate_text(KEY, lifetime=31), ("time", "lifetime_invalid", True)),
        (rotate_text(KEY, lifetime=0), ("time", "lifetime_invalid", True)),
        (rotate_text(KEY, issued=T0 + 5), ("time", "not_yet_valid", True)),
        (rotate_text(KEY, issued=T0 - 40), ("time", "expired", True)),
        (rotate_text(KEY, epoch_from=2), ("state", "epoch_mismatch", True)),
    ]
    for given, expected in cases:
        assert _stage(given) == expected, (given if isinstance(given, str) else "data", expected)
    # binding: the action names the service; a status query never asks about itself
    assert _stage(rotate_text(KEY), trust.SERVICE_STATUS) == ("binding", "action_service_mismatch", True)
    assert _stage(status_text(KEY, r, request_id=r), trust.SERVICE_STATUS) == ("binding", "target_is_self", True)
    # a clock below 2026 is not trusted
    assert _stage(rotate_text(KEY, issued=1700000000), now=1700000001) == ("time", "clock_invalid", True)


def test_a_lone_surrogate_is_refused_at_encoding_or_parse():
    assert _stage(data("{\"a\": \"\ud800\"}"))[:2] == ("encoding", "lone_surrogate")
    assert _stage('{"a": "\\ud800"}')[:2] == ("parse", "lone_surrogate")


def test_a_refusal_never_echoes_input():
    text = rotate_text(OTHER, actor={"id": "attacker-input-7731", "display_name": "x"})
    a = run_process(text).answer
    assert "attacker-input-7731" not in json.dumps(a) and set(a) == {"result", "stage", "code", "request_id"}


# ---------------------------------------------------------------- one key at every instant

def test_rotation_applies_persists_then_switches_and_proves_the_new_key():
    b = Bridge()
    r = rid()
    a = b.call(trust.SERVICE_ROTATE, rotate_text(KEY, request_id=r))
    nxt = trust.derive_next_key(KEY, "ab" * 32, 2, r)
    assert a == {"result": "rotated", "request_id": r, "epoch": 2, "proof": trust.proof(nxt, "rotated", r, 2)}
    assert b.verifier.secret == nxt and b.runtime.epoch == 2
    assert b.saved[-1]["key"] == nxt and b.saved[-1]["epoch"] == 2 and b.saved[-1]["ledger"][r]["outcome"] == "applied"


def test_exactly_one_key_verifies_before_and_after_for_every_signed_service():
    b = Bridge()
    old_cmd = signing.sign(KEY, {"user_id": "u", "domain": "light", "service": "turn_on", "data": {"entity_id": "light.x"}, "request_id": "a1"}, T0 + 1)
    assert b.verifier.verify(dict(old_cmd), now=T0 + 1) is None, "the current key works before the rotation"
    r = rid()
    nxt = trust.derive_next_key(KEY, "ab" * 32, 2, r)
    early = signing.sign(nxt, {"user_id": "u", "domain": "light", "service": "turn_on", "data": {"entity_id": "light.x"}, "request_id": "a2"}, T0 + 1)
    assert b.verifier.verify(dict(early), now=T0 + 1) == "bad_signature", "the next key is not valid before the switch"
    b.call(trust.SERVICE_ROTATE, rotate_text(KEY, request_id=r))
    replayed_old = signing.sign(KEY, {"user_id": "u", "domain": "light", "service": "turn_on", "data": {"entity_id": "light.x"}, "request_id": "a3"}, T0 + 1)
    assert b.verifier.verify(dict(replayed_old), now=T0 + 1) == "bad_signature", "the old key is refused at once after the switch"
    fresh = signing.sign(nxt, {"user_id": "u", "domain": "light", "service": "turn_on", "data": {"entity_id": "light.x"}, "request_id": "a4"}, T0 + 1)
    assert b.verifier.verify(dict(fresh), now=T0 + 1) is None
    # the trust services agree: a status query under the old key is refused at the signature stage, under the new key answered
    assert b.call(trust.SERVICE_STATUS, status_text(KEY, r, issued=T0 + 1))["code"] == "bad_signature"
    assert b.call(trust.SERVICE_STATUS, status_text(nxt, r, issued=T0 + 1))["target"] == "applied"


def test_a_failed_durable_write_switches_nothing_and_claims_nothing():
    b = Bridge()
    b.fail_next = True
    r = rid()
    a = b.call(trust.SERVICE_ROTATE, rotate_text(KEY, request_id=r))
    assert a == {"result": "rejected", "stage": "state", "code": "storage_unavailable", "request_id": r}
    assert b.verifier.secret == KEY and b.runtime.epoch == 1 and r not in b.runtime.state["ledger"]
    # nothing is stuck: the next request (a new id) rotates
    assert b.call(trust.SERVICE_ROTATE, rotate_text(KEY))["result"] == "rotated"


def test_an_unusable_store_refuses_every_trust_operation():
    b = Bridge()
    b.runtime.usable = False
    assert b.call(trust.SERVICE_ROTATE, rotate_text(KEY))["code"] == "storage_unavailable"
    assert b.call(trust.SERVICE_STATUS, status_text(KEY, rid()))["code"] == "storage_unavailable"
    assert b.verifier.secret == KEY and not b.saved


def test_concurrent_rotations_apply_exactly_once():
    b = Bridge()

    async def both() -> list[dict[str, Any]]:
        return list(await asyncio.gather(b.runtime.handle(trust.SERVICE_ROTATE, data(rotate_text(KEY))), b.runtime.handle(trust.SERVICE_ROTATE, data(rotate_text(KEY)))))

    answers = asyncio.run(both())
    assert sorted(a["result"] for a in answers) == ["rejected", "rotated"]
    assert next(a for a in answers if a["result"] == "rejected")["code"] == "bad_signature", "the second was signed with a key that is no longer valid"
    assert b.runtime.epoch == 2 and len([e for e in b.runtime.state["ledger"].values() if e["outcome"] == "applied"]) == 1


# ---------------------------------------------------------------- the fence and the replays

def test_status_fences_an_unknown_request_so_it_can_never_apply():
    b = Bridge()
    r = rid()
    a = b.call(trust.SERVICE_STATUS, status_text(KEY, r))
    assert a["result"] == "status" and a["target"] == "not_applied" and a["epoch"] == 1
    assert a["proof"] == trust.proof(KEY, "status", a["request_id"], r, "not_applied", 1)
    assert b.saved[-1]["ledger"][r]["outcome"] == "fenced", "the fence is written durably before the answer"
    late = b.call(trust.SERVICE_ROTATE, rotate_text(KEY, request_id=r))  # the original message arrives late
    assert late == {"result": "rejected", "stage": "state", "code": "request_seen", "request_id": r}
    assert b.verifier.secret == KEY and b.runtime.epoch == 1
    again = b.call(trust.SERVICE_STATUS, status_text(KEY, r))
    assert again["target"] == "not_applied" and len(b.saved) == 1, "an existing fence is answered without another write"


def test_a_fence_that_cannot_be_written_is_not_answered():
    b = Bridge()
    b.fail_next = True
    a = b.call(trust.SERVICE_STATUS, status_text(KEY, rid()))
    assert a["result"] == "rejected" and a["code"] == "storage_unavailable"


def test_replays_are_refused():
    b = Bridge()
    r = rid()
    text = rotate_text(KEY, request_id=r)
    assert b.call(trust.SERVICE_ROTATE, text)["result"] == "rotated"
    assert b.call(trust.SERVICE_ROTATE, text)["code"] == "bad_signature", "the same message again: its key is gone"
    nxt = b.verifier.secret
    st = status_text(nxt, r, issued=T0 + 1)
    assert b.call(trust.SERVICE_STATUS, st)["target"] == "applied"
    assert b.call(trust.SERVICE_STATUS, st) == {"result": "rejected", "stage": "state", "code": "replay", "request_id": json.loads(st)["request_id"]}


def test_a_nonce_seen_under_the_old_key_is_a_replay_under_the_new_one():
    b = Bridge()
    nonce = uuid.uuid4().hex
    assert b.call(trust.SERVICE_STATUS, status_text(KEY, rid(), nonce=nonce))["result"] == "status"
    b.call(trust.SERVICE_ROTATE, rotate_text(KEY))
    assert nonce in b.verifier._seen, "a rotation never clears the nonce cache"
    assert b.call(trust.SERVICE_STATUS, status_text(b.verifier.secret, rid(), nonce=nonce))["code"] == "replay"


def test_the_ledger_never_shrinks_over_random_operations():
    rnd = random.Random(7)
    b = Bridge()
    known: list[str] = []
    before = 0
    for _ in range(120):
        roll = rnd.random()
        key = b.verifier.secret if rnd.random() < 0.8 else KEY
        if roll < 0.3:
            text = rotate_text(key, epoch_from=b.runtime.epoch if rnd.random() < 0.8 else b.runtime.epoch + 1, issued=T0 + 1)
        elif roll < 0.8:
            target = rnd.choice(known) if known and rnd.random() < 0.5 else rid()
            known.append(target)
            text = status_text(key, target, issued=T0 + 1)
        else:
            text = rnd.choice(['{"x": 1}', "nonsense", rotate_text(OTHER, issued=T0 + 1)])
        b.fail_next = rnd.random() < 0.1
        b.call(trust.SERVICE_ROTATE if '"trust_rotate"' in text else trust.SERVICE_STATUS, text)
        b.fail_next = False
        ledger = b.runtime.state["ledger"]
        assert len(ledger) >= before
        before = len(ledger)
        for snapshot in b.saved:
            assert set(snapshot["ledger"]) <= set(ledger), "nothing once recorded is ever dropped"
    assert before > 10


# ---------------------------------------------------------------- start-up reconcile

def test_reconcile_matrix():
    rotated = {**trust.new_state("e1", "p1", 4, {"r1": {"outcome": "applied"}}), "key": "rotated-key"}
    s = trust.reconcile(rotated, "e1", "p1", 1)
    assert (s["key"], s["epoch"]) == ("rotated-key", 4), "the store wins for the same entry and pairing (also when the mirror was lost)"
    assert trust.current_key(s, "entry-code") == "rotated-key"
    s = trust.reconcile(rotated, "e1", "p2", 1)
    assert (s["key"], s["epoch"], set(s["ledger"])) == (None, 1, {"r1"}), "a re-pair starts at the entry's code, epoch 1, ledger kept"
    assert trust.current_key(s, "entry-code") == "entry-code"
    s = trust.reconcile(rotated, "e2", "p1", None)
    assert (s["key"], s["epoch"], set(s["ledger"])) == (None, 1, {"r1"}), "a new config entry: same rule"
    s = trust.reconcile(None, "e1", "legacy", None)
    assert s == trust.new_state("e1", "legacy"), "a 0.8.0 entry without a store: epoch 1, no key of its own"
    s = trust.reconcile(None, "e1", "p1", 7)
    assert s["epoch"] == 7 and s["key"] is None, "a lost store falls back to the mirrored epoch and the mirrored key"
    assert trust.reconcile({"garbage": True}, "e1", "p1", "x")["epoch"] == 1


# ---------------------------------------------------------------- what may be logged

def test_log_fields_carry_no_secret_material():
    b = Bridge()
    r = rid()
    texts, answers = [], []
    for service, text in ((trust.SERVICE_ROTATE, rotate_text(KEY, request_id=r)), (trust.SERVICE_STATUS, status_text(KEY, r)), (trust.SERVICE_STATUS, None), (trust.SERVICE_ROTATE, rotate_text(OTHER))):
        if text is None:
            text = status_text(b.verifier.secret, r, issued=T0 + 1)
        texts.append(json.loads(text))
        answers.append((service, b.call(service, text)))
    logged = json.dumps([trust.log_fields(s, a) for s, a in answers])
    secrets_ = {KEY, b.verifier.secret, "ab" * 32} | {t["nonce"] for t in texts} | {t["sig"] for t in texts} | {a.get("proof") for _, a in answers if a.get("proof")}
    assert not [s for s in secrets_ if s and s in logged]
    assert all("proof" not in trust.log_fields(s, a) for s, a in answers)


def test_the_trust_modules_touch_no_capability_mapping_or_anchor():
    """D7 / D9: a rotation is not a re-anchor, and nothing about a capability or a mapping is derived from or tied to the key."""
    for name in ("trust.py", "trust_service.py"):
        code = "\n".join(line for line in (SRC / name).read_text(encoding="utf-8").splitlines() if not line.lstrip().startswith("#"))
        body = code.split('"""', 2)[2] if code.lstrip().startswith('"""') else code
        for word in ("capabilit", "mapping", "anchor", "high_water", "highwater"):
            assert word not in body.lower(), (name, word)


# ---------------------------------------------------------------- the Home Assistant glue with Home Assistant stubbed

class FakeStore:
    def __init__(self, hass: Any, version: int, key: str, *, private: bool = False, atomic_writes: bool = False) -> None:
        assert private and atomic_writes, "the trust store is private and written atomically"
        self.key = key
        FakeStore.instances.append(self)

    instances: list["FakeStore"] = []
    disk: dict[str, Any] = {}
    unreadable = False
    fail_writes = False
    writes = 0

    async def async_load(self) -> Any:
        if FakeStore.unreadable:
            raise ValueError("corrupt json (test)")
        return copy.deepcopy(FakeStore.disk.get(self.key))

    async def async_save(self, data_: Any) -> None:
        if FakeStore.fail_writes:
            raise OSError("disk full (test)")
        FakeStore.disk[self.key] = copy.deepcopy(data_)
        FakeStore.writes += 1


class FakeEntry:
    def __init__(self, data_: dict[str, Any], entry_id: str = "entry-1") -> None:
        self.data = dict(data_)
        self.entry_id = entry_id
        self.options: dict[str, Any] = {}


class FakeHass:
    def __init__(self) -> None:
        self.data: dict[str, Any] = {}
        self.registered: dict[str, Any] = {}
        self.updates: list[dict[str, Any]] = []
        hass = self

        class _Services:
            def async_register(self, domain: str, service: str, handler: Any, schema: Any = None, supports_response: Any = None) -> None:
                hass.registered[f"{domain}.{service}"] = (handler, schema, supports_response)

            def async_remove(self, domain: str, service: str) -> None:
                hass.registered.pop(f"{domain}.{service}", None)

        class _Entries:
            def async_update_entry(self, entry: FakeEntry, data: dict[str, Any]) -> bool:
                hass.updates.append(dict(data))
                entry.data = dict(data)
                return True

        self.services = _Services()
        self.config_entries = _Entries()


class FakeCall:
    def __init__(self, service: str, data_: dict[str, Any]) -> None:
        self.service = service
        self.data = data_


@pytest.fixture()
def glue(monkeypatch):
    """trust_service.py imported against stub Home Assistant / voluptuous modules (removed again afterwards)."""
    vol = types.ModuleType("voluptuous")
    vol.ALLOW_EXTRA = "allow_extra"
    vol.Schema = lambda schema, extra=None: ("schema", schema, extra)
    ha = types.ModuleType("homeassistant")
    ce = types.ModuleType("homeassistant.config_entries")
    ce.ConfigEntry = FakeEntry
    core = types.ModuleType("homeassistant.core")
    core.HomeAssistant, core.ServiceCall, core.ServiceResponse = FakeHass, FakeCall, dict
    core.SupportsResponse = types.SimpleNamespace(ONLY="only")
    helpers = types.ModuleType("homeassistant.helpers")
    storage = types.ModuleType("homeassistant.helpers.storage")
    storage.Store = FakeStore
    for name, mod in (("voluptuous", vol), ("homeassistant", ha), ("homeassistant.config_entries", ce), ("homeassistant.core", core),
                      ("homeassistant.helpers", helpers), ("homeassistant.helpers.storage", storage)):
        monkeypatch.setitem(sys.modules, name, mod)
    FakeStore.instances, FakeStore.disk, FakeStore.unreadable, FakeStore.fail_writes, FakeStore.writes = [], {}, False, False, 0
    mod = load("trust_service")
    yield mod
    sys.modules.pop(f"{mod.__name__}", None)


def _setup(glue: Any, entry: FakeEntry, hass: FakeHass | None = None) -> tuple[FakeHass, Any, Any]:
    hass = hass or FakeHass()
    verifier = signing.Verifier(entry.data["pairing_code"])
    runtime = asyncio.run(glue.async_setup_trust(hass, entry, verifier))
    return hass, verifier, runtime


def test_glue_registers_both_services_without_a_schema_of_its_own(glue):
    hass, verifier, runtime = _setup(glue, FakeEntry({"addon_url": "http://addon.test:8099", "pairing_code": KEY}))
    assert set(hass.registered) == {"smplwise_bridge.trust_rotate", "smplwise_bridge.trust_status"}
    for handler, schema, supports in hass.registered.values():
        assert schema == ("schema", {}, "allow_extra") and supports == "only"
    assert verifier.secret == KEY and runtime.epoch == 1 and hass.data["smplwise_bridge"]["entry-1"] is runtime
    assert glue.current_key_of(hass) == KEY
    assert FakeStore.disk["smplwise_bridge.trust"] == trust.new_state("entry-1", "legacy"), "a 0.8.0 entry gets its store at the first start"
    glue.async_unload_trust(hass, FakeEntry({}, "entry-1"))
    assert not hass.registered and "entry-1" not in hass.data["smplwise_bridge"]


def test_glue_rotation_survives_a_restart_and_mirrors_the_entry(glue):
    entry = FakeEntry({"addon_url": "http://addon.test:8099", "pairing_code": KEY, "pairing_id": "p1", "trust_epoch": 1})
    hass, verifier, runtime = _setup(glue, entry)
    handler = hass.registered["smplwise_bridge.trust_rotate"][0]
    r = rid()
    runtime._clock = lambda: T0 + 1
    answer = asyncio.run(handler(FakeCall("trust_rotate", data(rotate_text(KEY, request_id=r)))))
    nxt = trust.derive_next_key(KEY, "ab" * 32, 2, r)
    assert answer["result"] == "rotated" and verifier.secret == nxt
    assert entry.data["pairing_code"] == nxt and entry.data["trust_epoch"] == 2, "the config entry mirrors the switch"
    # a restart where the mirror was lost (Home Assistant writes config entries with a delay): the store wins
    stale = FakeEntry({"addon_url": "http://addon.test:8099", "pairing_code": KEY, "pairing_id": "p1", "trust_epoch": 1})
    hass2, verifier2, runtime2 = _setup(glue, stale)
    assert verifier2.secret == nxt and runtime2.epoch == 2 and stale.data["pairing_code"] == nxt, "the store wins and the mirror is repaired"
    # a re-pair (the config flow wrote a new pairing id with the new code): epoch 1, the new code, the ledger kept
    repaired = FakeEntry({"addon_url": "http://addon.test:8099", "pairing_code": OTHER, "pairing_id": "p2", "trust_epoch": 1})
    _h3, verifier3, runtime3 = _setup(glue, repaired)
    assert verifier3.secret == OTHER and runtime3.epoch == 1 and r in runtime3.state["ledger"]


def test_glue_never_overwrites_an_unreadable_store(glue):
    FakeStore.disk["smplwise_bridge.trust"] = {"precious": "ledger"}
    FakeStore.unreadable = True
    entry = FakeEntry({"addon_url": "http://addon.test:8099", "pairing_code": KEY, "pairing_id": "p1", "trust_epoch": 3})
    hass, verifier, runtime = _setup(glue, entry)
    assert verifier.secret == KEY and runtime.usable is False and FakeStore.writes == 0
    runtime._clock = lambda: T0 + 1
    handler = hass.registered["smplwise_bridge.trust_status"][0]
    a = asyncio.run(handler(FakeCall("trust_status", data(status_text(KEY, rid(), issued=T0 + 1)))))
    assert a["code"] == "storage_unavailable" and FakeStore.disk["smplwise_bridge.trust"] == {"precious": "ledger"}


def test_glue_logs_no_secret_material(glue, caplog):
    import logging

    caplog.set_level(logging.DEBUG)
    entry = FakeEntry({"addon_url": "http://addon.test:8099", "pairing_code": KEY, "pairing_id": "p1", "trust_epoch": 1})
    hass, verifier, runtime = _setup(glue, entry)
    runtime._clock = lambda: T0 + 1
    texts = [rotate_text(KEY), rotate_text(OTHER), status_text(KEY, rid())]
    for t in texts:
        service = "trust_rotate" if '"trust_rotate"' in t else "trust_status"
        asyncio.run(hass.registered[f"smplwise_bridge.{service}"][0](FakeCall(service, data(t))))
    logged = caplog.text
    assert "trust_rotate" in logged
    for secret in [KEY, verifier.secret, "ab" * 32] + [json.loads(t)["nonce"] for t in texts] + [json.loads(t)["sig"] for t in texts]:
        assert secret not in logged


# ---------------------------------------------------------------- the integration files

def test_init_wires_the_trust_runtime_into_setup_push_and_unload():
    src = (SRC / "__init__.py").read_text(encoding="utf-8")
    assert "trust_runtime = await async_setup_trust(hass, entry, verifier)" in src
    assert "sign(verifier.secret, body)" in src and '"trust_epoch": trust_runtime.epoch, "trust_rotation": 1' in src
    assert "async_unload_trust(hass, entry)" in src
    names = {n.id for n in __import__("ast").walk(init_tree()) if isinstance(n, __import__("ast").Name)}
    assert "secret" not in names, "no service or push keeps a copy of the key taken at setup"


def test_config_flow_re_pairs_only_on_a_different_code():
    src = (SRC / "config_flow.py").read_text(encoding="utf-8")
    assert "data={CONF_ADDON_URL: url, **new_pairing(code)}" in src
    assert "if not same_pairing(code, existing.data.get(CONF_PAIRING_CODE), current_key_of(self.hass)):" in src
    assert "updates.update(new_pairing(code))" in src
    assert "hmac.compare_digest" in src and "secrets.token_hex(8)" in src


def test_version_is_081_everywhere_and_the_services_are_described():
    for root in (SRC, MIRROR):
        assert json.loads((root / "manifest.json").read_text(encoding="utf-8"))["version"] == "0.9.1"
        assert 'VERSION = "0.9.1"' in (root / "const.py").read_text(encoding="utf-8")
        assert "const VERSION = '0.9.1'" in (root / "www" / "smplwise-card.js").read_text(encoding="utf-8")
        services = (root / "services.yaml").read_text(encoding="utf-8")
        assert "\ntrust_rotate:\n" in services and "\ntrust_status:\n" in services
        for name in ("strings.json", "translations/en.json", "translations/he.json"):
            assert {"trust_rotate", "trust_status"} <= set(json.loads((root / name).read_text(encoding="utf-8"))["services"]), (root, name)
    for rel in ("trust.py", "trust_service.py", "signing.py", "__init__.py", "config_flow.py", "const.py"):
        assert (SRC / rel).read_bytes() == (MIRROR / rel).read_bytes(), rel


def test_the_trust_core_stays_free_of_home_assistant():
    src = (SRC / "trust.py").read_text(encoding="utf-8")
    assert "homeassistant" not in src.split('"""', 2)[2] and "voluptuous" not in src
    assert Path(SRC / "trust.py").stat().st_size < 40_000
