"""BRIDGE-REPAIR-LEGACY-2520 (deep review 2.52 WISKEY-BRIDGE, WB-02 high + WB-07 low; bridge 0.10.9).

WB-02: a bridge whose first key rotation was saved by Arx 2.11.0 - 2.14.0 holds a key store WITHOUT the one-way tag of its retired pairing
code (`legacy_fp`, written only since 2.15.0, KEYROT-FIX-295). On such a bridge a re-pair was undone: the new setup did not recognise the
new code as a new pairing (no tag to compare with), `Persister.clean_entry()` blanked it, and the old rotated key verified again - through
the key set and through `native_keyset.verify` (WisKey's v2). The same blanking also undid a re-pair on a TAGGED store whenever a save (the
delayed high-water save, the unload's flush) ran between the re-pair's entry write and the reload.

WB-07: the bridge's own signed services (execute & co. through `service_identity.screen`, the cast origin, the lease services, `rotate`)
verified with the key set directly, so between the re-pair's entry write and the reload the old pairing still operated them.

The store fixture below is EXACTLY what the old bridges wrote: produced by running the two released `keyset.py` blobs of that range
(2.11.0 - 2.12.1 and 2.12.2 - 2.14.0; `git log -S legacy_fp` names 1213e264b / v2.15.0 as the first with the tag) through a real
begin / commit (/ retire) with synthetic keys; `test_the_fixture_is_what_2_11_0_to_2_14_0_wrote` re-runs those blobs from git and compares.
Synthetic keys and fake Home Assistant objects only; nothing contacts a bridge, Home Assistant or WisKey."""
from __future__ import annotations

import base64
import copy
import hashlib
import importlib
import json
import secrets
import subprocess
import sys
import time
import types
from pathlib import Path
from types import SimpleNamespace
from typing import Any

import pytest
from fastapi.testclient import TestClient

sys.path.insert(0, str(Path(__file__).resolve().parent))
import keyrot_harness as kh  # noqa: E402
import test_bridge_native_keyset_2520 as nkt  # noqa: E402 - the WisKey v2 fakes and the private bridge copy of that file

from smplwise.main import create_app  # noqa: E402
from smplwise.services import bridge_keys as bk  # noqa: E402
from smplwise.services import ha_bridge  # noqa: E402

nks, ksm = nkt.nks, nkt.ksm
lease_contract = importlib.import_module(nks.__name__.rsplit(".", 1)[0] + ".lease_contract")  # the same private bridge copy
REPO = Path(__file__).resolve().parents[3]
API = "/api/v1"

# ====================================================================== the store as Arx 2.11.0 - 2.14.0 wrote it

LEGACY_BLOBS = {  # git blob of custom_components/smplwise_bridge/keyset.py -> the releases that shipped it (rotation live, no tag)
    "d09a74be5b01e728e5b21a6c2a5df89e7ddae9a9": "v2.11.0, v2.11.1, v2.12.0, v2.12.1",
    "01bc6c381d35d984bae97d59c74e4a412b6f0de0": "v2.12.2, v2.12.3, v2.12.4, v2.14.0",
}
OLD_CODE = "synthetic-legacy-pairing-code-2110"  # the pairing code the old bridge rotated away (retired, not in the store)
NEW_CODE = "synthetic-legacy-repair-code-2520"  # the code a re-pair writes into the same entry
LEGACY_KID = "g1-0a1b2c3d"
LEGACY_SALT = bytes(range(32))
LEGACY_T = 1_760_000_000
LEGACY_MATERIAL = "8SR5h4AT1iO-aukxPWqofeAGoAGXSQx83MeWJGbpaCI"  # = keyset.derive_next(OLD_CODE, LEGACY_SALT, LEGACY_KID, 1)
LEGACY_ROTATION_ID = "synthetic-legacy-rotation-1"
LEGACY_STATES: dict[str, dict[str, Any]] = {  # `Store.async_load()` of `smplwise_bridge_keys_<entry_id>` (the file's "data")
    "routine": {"v": 1, "signing": LEGACY_KID, "keys": {LEGACY_KID: LEGACY_MATERIAL}, "old": None, "next": None, "legacy_retired": True,
                "rotation": {"id": LEGACY_ROTATION_ID, "t0_wall": 1760000000.0, "committed": True, "closed": True, "mode": "routine",
                             "overlap_s": 120},
                "hw": {"g0-legacy": 1760000000, LEGACY_KID: 1760000000}},
    "hard_cut": {"v": 1, "signing": LEGACY_KID, "keys": {LEGACY_KID: LEGACY_MATERIAL}, "old": None, "next": None, "legacy_retired": True,
                 "rotation": {"id": LEGACY_ROTATION_ID, "t0_wall": 1760000000.0, "committed": True, "closed": False, "mode": "hard_cut",
                              "overlap_s": 0},
                 "hw": {"g0-legacy": 1760000000, LEGACY_KID: 1760000000}},
}


def _legacy_rotation(m: types.ModuleType, mode: str) -> dict[str, Any]:
    """Drive an OLD keyset module the way the add-on drove it: begin (kid-less, pairing code), commit and (routine) retire with the new key."""
    clock = lambda: float(LEGACY_T)  # noqa: E731
    ks = m.KeySet(OLD_CODE, None, now=clock, mono=clock)

    def v1(body: dict[str, Any], nonce: str) -> dict[str, Any]:
        return {**body, "ts": LEGACY_T, "nonce": nonce, "sig": m.v1_sig(OLD_CODE, body, LEGACY_T, nonce)}

    def v2(body: dict[str, Any], nonce: str) -> dict[str, Any]:
        return {**body, "kid": LEGACY_KID, "ts": LEGACY_T, "nonce": nonce, "sig": m.v2_sig(LEGACY_MATERIAL, LEGACY_KID, body, LEGACY_T, nonce)}

    begin = {"protocol": m.PROTOCOL, "op": "begin", "rotation_id": LEGACY_ROTATION_ID, "kid_next": LEGACY_KID, "gen_next": 1, "mode": mode,
             "overlap_s": 120 if mode == "routine" else 0, "salt": base64.b64encode(LEGACY_SALT).decode()}
    assert ks.handle_control(v1(begin, "00" * 8))["ok"] is True
    assert ks.handle_control(v2({"protocol": m.PROTOCOL, "op": "commit", "rotation_id": LEGACY_ROTATION_ID}, "11" * 16))["ok"] is True
    if mode == "routine":
        assert ks.handle_control(v2({"protocol": m.PROTOCOL, "op": "retire", "rotation_id": LEGACY_ROTATION_ID}, "22" * 16))["ok"] is True
    assert ks.legacy_retired and ks.legacy_wiped, "the old bridge retired the pairing code (and blanked the entry's copy next)"
    return json.loads(json.dumps(ks.state()))  # the Store writes JSON


@pytest.mark.parametrize("blob", sorted(LEGACY_BLOBS), ids=["2110-2121", "2122-2140"])
def test_the_fixture_is_what_2_11_0_to_2_14_0_wrote(blob: str):
    try:
        src = subprocess.run(["git", "-C", str(REPO), "cat-file", "-p", blob], capture_output=True, check=True, timeout=60).stdout.decode("utf-8")
    except (OSError, subprocess.SubprocessError):
        pytest.skip("git or the historical blob is not available in this checkout")
    assert "legacy_fp" not in src and "legacy_fingerprint" not in src, "a pre-tag release"
    m = types.ModuleType(f"keyset_legacy_{blob[:9]}")
    sys.modules[m.__name__] = m
    try:
        exec(compile(src, m.__name__, "exec"), m.__dict__)  # noqa: S102 - the repository's own released source, by blob id
        assert ksm.derive_next(OLD_CODE, LEGACY_SALT, LEGACY_KID, 1) == LEGACY_MATERIAL == m.derive_next(OLD_CODE, LEGACY_SALT, LEGACY_KID, 1)
        for mode, want in LEGACY_STATES.items():
            got = _legacy_rotation(m, mode)
            assert got == want and list(got) == list(want), mode
            assert "legacy_fp" not in got
    finally:
        sys.modules.pop(m.__name__, None)


# ====================================================================== the bridge's setup, as __init__.async_setup_entry runs it


def _setup(w: nkt.World, entry: nkt.Entry, stored: dict[str, Any] | None, store: nkt.Store | None = None) -> SimpleNamespace:
    """KeySet(entry code, stored) -> Persister -> native attach -> clean_entry() -> (re-pair) save; the fence of the services (WB-07)."""
    w.hass.config_entries.held[entry.entry_id] = entry
    keyset = ksm.KeySet(entry.data.get("pairing_code") or "", copy.deepcopy(stored), now=w.now, mono=w.now)
    store = store or nkt.Store()

    def wipe() -> None:
        entry.data = {**entry.data, "pairing_code": ""}

    saver = ksm.Persister(keyset, store.save, lambda: entry.data.get("pairing_code") or "", wipe, lambda c: c.close())
    detach = nks.attach(w.hass, entry, keyset, saver)
    blanked = saver.clean_entry()
    if keyset.repaired:
        nkt.run(saver.persist())  # __init__: save_soon(); here at once
    fence = ksm.PairingFence(keyset, lambda: nks._same_pairing(entry, keyset))
    return SimpleNamespace(entry=entry, keyset=keyset, saver=saver, store=store, detach=detach, fence=fence, blanked=blanked)


def _reload(w: nkt.World, row: SimpleNamespace) -> SimpleNamespace:
    """The update listener's reload: unload (flush a dirty set), detach, set up again from the store."""
    nkt.run(row.saver.persist())
    row.detach()
    return _setup(w, row.entry, row.store.saved[-1] if row.store.saved else row.stored, row.store)


def _legacy_row(w: nkt.World, code: str, mode: str = "routine") -> SimpleNamespace:
    row = _setup(w, nkt.Entry("entry-1", code), LEGACY_STATES[mode])
    row.stored = LEGACY_STATES[mode]
    return row


def _old_key_msg(w: nkt.World, body: dict[str, Any] | None = None) -> dict[str, Any]:
    w.clock[0] += 1
    return bk.sign_with(LEGACY_KID, LEGACY_MATERIAL, body or {"op": "probe"}, ts=int(w.now()))


def _assert_old_pairing_dead(w: nkt.World, row: SimpleNamespace) -> None:
    """The old rotated key verifies nowhere: the key set, the services' fence, the rotation service, WisKey's v2 (native_keyset)."""
    assert LEGACY_KID not in row.keyset.keys and LEGACY_KID not in row.keyset.verifiable() and LEGACY_KID not in row.fence.verifiable()
    assert row.keyset.verify(_old_key_msg(w)) == "bad_signature"
    assert row.fence.verify(_old_key_msg(w)) == "bad_signature"
    status = {"protocol": ksm.PROTOCOL, "op": "status", "rotation_id": LEGACY_ROTATION_ID}
    assert row.keyset.handle_control(_old_key_msg(w, status)) == {"ok": False, "code": "bad_signature"}
    w.clock[0] += 1
    nkt.refused("bridge_key_unknown", nks.verify(w.hass, nkt.arx_connect(LEGACY_MATERIAL, LEGACY_KID, w.now())))


def _assert_new_pairing_live(w: nkt.World, row: SimpleNamespace) -> None:
    assert row.entry.data["pairing_code"] == NEW_CODE, "the new pairing code stays in the entry"
    w.clock[0] += 1
    assert row.fence.verify(ha_bridge.sign(NEW_CODE, {"op": "probe"}, ts=int(w.now()))) is None, "the new code is the key"
    assert nks.legacy_allowed(w.hass, row.entry) is True
    tag = ksm.legacy_fingerprint(NEW_CODE)
    assert nks.source_fingerprint(w.hass, row.entry) == hashlib.sha256(f"{nks.SOURCE_LABEL}entry-1|{tag}".encode()).hexdigest()


@pytest.mark.parametrize("mode", sorted(LEGACY_STATES))
def test_a_legacy_store_with_a_new_code_in_the_entry_is_a_re_pair(mode: str):
    """The review's probe, setup side: tag-less retired store + a new code in the entry -> repaired (was False), nothing blanked (was:
    clean_entry() True and the entry code ''), the old key dead everywhere, the new pairing live; the fresh set is saved in today's
    format and a restart keeps it."""
    w = nkt.World()
    row = _legacy_row(w, NEW_CODE, mode)
    assert row.keyset.repaired and not row.blanked and not row.keyset.legacy_retired
    _assert_old_pairing_dead(w, row)
    _assert_new_pairing_live(w, row)
    saved = row.store.saved[-1]
    assert saved["legacy_retired"] is False and saved["keys"] == {} and "legacy_fp" in saved and LEGACY_MATERIAL not in json.dumps(saved)
    again = _reload(w, row)
    assert not again.keyset.repaired and not again.blanked
    _assert_old_pairing_dead(w, again)
    _assert_new_pairing_live(w, again)


@pytest.mark.parametrize("mode", sorted(LEGACY_STATES))
def test_the_review_probe_end_to_end_re_pair_of_a_legacy_bridge_holds(mode: str):
    """The state such a bridge is in today (legacy store, the entry's copy blanked long ago) keeps working; a re-pair written into the entry
    voids the old setup at once, a save before the reload does not blank the new code, and the reloaded setup is the new pairing."""
    w = nkt.World()
    row = _legacy_row(w, "", mode)
    assert not row.keyset.repaired and not row.blanked and row.keyset.legacy_retired
    w.clock[0] += 1
    binding = nkt.run(nks.verify(w.hass, nkt.arx_connect(LEGACY_MATERIAL, LEGACY_KID, w.now())))
    assert binding.check() == (row.entry, LEGACY_KID) and row.fence.verify(_old_key_msg(w)) is None, "today: the rotated key is the key"
    nkt.refused("bridge_pairing_unknown", lambda: nks.source_fingerprint(w.hass, row.entry))  # a retired code from before the tag
    # the re-pair (Supervisor discovery / the owner) writes the new code; the old setup is still attached
    row.entry.data = {"pairing_code": NEW_CODE}
    hw = dict(row.keyset.hw)
    assert row.fence.verify(_old_key_msg(w)) == ksm.PAIRING_CHANGED and row.fence.verifiable() == set() and row.keyset.hw == hw
    nkt.refused("bridge_pairing_changed", binding.check)
    w.clock[0] += 1
    nkt.refused("bridge_pairing_changed", nks.verify(w.hass, nkt.arx_connect(LEGACY_MATERIAL, LEGACY_KID, w.now())))
    row.keyset.dirty = True  # a pending high-water save runs before the reload
    nkt.run(row.saver.persist())
    assert row.entry.data["pairing_code"] == NEW_CODE, "the save does not blank the re-pair's code (it used to)"
    again = _reload(w, row)
    assert again.keyset.repaired and not again.blanked
    _assert_old_pairing_dead(w, again)
    _assert_new_pairing_live(w, again)
    nkt.refused("bridge_source_changed", binding.check)


def test_a_tagged_store_re_pair_survives_a_save_between_the_entry_write_and_the_reload():
    """The same blanking on today's format: routine rotation + retire (the tag is kept, the entry blanked, HA-06), then a re-pair and a
    save (the delayed high-water save or the unload's flush) before the reload. The reloaded setup must be the new pairing."""
    w = nkt.World()
    entry = nkt.Entry("entry-1", nkt.SECRET)
    row = _setup(w, entry, None)
    row.stored = None
    row.code = nkt.SECRET
    material = nkt.rotate(w, row)
    nkt.retire(w, row, nkt.KID, material)
    retired_state = copy.deepcopy(row.store.saved[-1])
    assert retired_state["legacy_retired"] is True and retired_state["legacy_fp"] == ksm.legacy_fingerprint(nkt.SECRET)
    assert entry.data["pairing_code"] == "" and row.keyset.legacy_fp == ksm.legacy_fingerprint(nkt.SECRET)
    w.clock[0] += 1
    assert row.fence.verify(bk.sign_with(nkt.KID, material, {"op": "probe"}, ts=int(w.now()))) is None and row.keyset.dirty
    entry.data = {"pairing_code": NEW_CODE}
    w.clock[0] += 1
    assert row.fence.verify(bk.sign_with(nkt.KID, material, {"op": "probe"}, ts=int(w.now()))) == ksm.PAIRING_CHANGED
    nkt.run(row.saver.persist())
    assert entry.data["pairing_code"] == NEW_CODE
    again = _reload(w, row)
    assert again.keyset.repaired and nkt.KID not in again.keyset.verifiable()
    w.clock[0] += 1
    assert again.fence.verify(bk.sign_with(nkt.KID, material, {"op": "probe"}, ts=int(w.now()))) == "bad_signature"
    _assert_new_pairing_live(w, again)
    # HA-06 itself is unchanged: the RETIRED code left in the entry is recognised by its tag and blanked
    w2 = nkt.World()
    left = _setup(w2, nkt.Entry("entry-1", nkt.SECRET), retired_state)
    assert left.keyset.legacy_retired and left.blanked and left.entry.data["pairing_code"] == "" and not left.keyset.repaired


def test_a_damaged_tag_is_read_as_no_tag_and_odd_entry_values_fail_closed():
    w = nkt.World()
    for bad in ("", "not-hex", "A" * 64, 12345, None):
        st = {**LEGACY_STATES["routine"], "legacy_fp": bad}
        row = _setup(nkt.World(), nkt.Entry("entry-1", NEW_CODE), st)
        assert row.keyset.repaired and not row.blanked and LEGACY_KID not in row.keyset.keys, bad
    # a value that is not a pairing code (never written by the flow): nothing is blanked and nothing of the old set verifies
    for odd in (12345, b"bytes", ["x"]):
        row = _setup(w, nkt.Entry("entry-1", odd), LEGACY_STATES["routine"])
        assert not row.keyset.repaired and not row.blanked and row.entry.data["pairing_code"] == odd
        assert row.fence.verify(_old_key_msg(w)) == ksm.PAIRING_CHANGED
        w.clock[0] += 1
        nkt.refused("bridge_pairing_changed", nks.verify(w.hass, nkt.arx_connect(LEGACY_MATERIAL, LEGACY_KID, w.now())))
        row.detach()
    # a stored key's own material in the entry is not a new pairing (K-02, unchanged) - and it is not blanked either: closed
    row = _setup(w, nkt.Entry("entry-1", LEGACY_MATERIAL), LEGACY_STATES["routine"])
    assert not row.keyset.repaired and not row.blanked and row.fence.verify(_old_key_msg(w)) == ksm.PAIRING_CHANGED


# ====================================================================== WB-07: the fence of the bridge's own services


def test_the_fence_refuses_before_the_key_set_and_is_stateless():
    w = nkt.World()
    row = _legacy_row(w, "")
    msg = _old_key_msg(w)
    assert row.fence.verify(dict(msg)) is None
    row.entry.data = {"pairing_code": NEW_CODE}
    seen, hw, dirty = dict(row.keyset._seen), dict(row.keyset.hw), row.keyset.dirty
    fresh = _old_key_msg(w)
    assert row.fence.verify(dict(fresh)) == ksm.PAIRING_CHANGED and row.fence.verifiable() == set()
    assert row.keyset._seen == seen and row.keyset.hw == hw and row.keyset.dirty == dirty, "no nonce, no high-water mark, no save"
    # the lease contract's verdict for a kid-less lease message: the fence's code, which its signature stage refuses as bad_signature
    assert lease_contract._verify(row.fence, {k: v for k, v in fresh.items() if k != "kid"}, int(w.now())) == ksm.PAIRING_CHANGED
    row.entry.data = {"pairing_code": ""}  # the same pairing written back: current again (not a latch)
    assert row.fence.verify(dict(fresh)) is None
    broken = ksm.PairingFence(row.keyset, lambda: 1 / 0)
    assert broken.verify(_old_key_msg(w)) == ksm.PAIRING_CHANGED and broken.verifiable() == set() and not broken.current()
    assert repr(row.fence) == "<keyset pairing fence>" and LEGACY_MATERIAL not in repr(row.fence)


def test_init_wires_every_signed_service_through_the_fence():
    import ast

    for root in (nkt.SRC, nkt.MIRROR):
        text = (root / "__init__.py").read_text(encoding="utf-8")
        setup = ast.unparse(next(n for n in ast.walk(ast.parse(text)) if isinstance(n, ast.AsyncFunctionDef) and n.name == "async_setup_entry"))
        assert "verifier = PairingFence(keyset, lambda: native_keyset._same_pairing(entry, keyset))" in setup
        assert "service_identity.screen(hass, verifier," in setup and "note_origin(verifier," in setup
        assert "lease_service.async_handle(hass, service_name, kind, dict(call.data), verifier)" in setup
        rot = setup.split("async def rotate(", 1)[1].split("hass.services.async_register", 1)[0]
        assert "if not verifier.current():" in rot and "return {'ok': False, 'code': PAIRING_CHANGED}" in rot
        assert rot.index("verifier.current()") < rot.index("saver.control(")
        # nothing inbound is judged by the bare key set any more (outbound signing and the cap housekeeping stay on it)
        assert "keyset.verify(" not in setup and "keyset.handle_control(" not in setup and ", keyset)" not in setup.split("def lease(", 1)[1]


# ====================================================================== the REAL async_setup_entry (key-rotation harness)


@pytest.fixture()
def side(settings, monkeypatch):
    kh.install_no_network(monkeypatch)
    clock = kh.Clock()
    monkeypatch.setattr(time, "time", clock)
    bk.reset_for_tests()
    c = TestClient(create_app(settings))
    c.get(f"{API}/me")
    r = c.get(f"{API}/ha/bridge/pairing")
    assert r.status_code == 200, r.text
    s = kh.BridgeSide(lambda: c, r.json()["pairing_code"], clock)
    yield s
    s.stop()


def _execute(side: kh.BridgeSide, kid: str, material: str) -> Any:
    """A signed `execute` for a service outside the allowlist: `service_not_allowed` = the signature verified (nothing runs)."""
    body = {"domain": "homeassistant", "service": "not_a_real_service", "user_id": "u-repair-2520", "request_id": secrets.token_hex(8),
            "data": {"entity_id": "light.x"}}
    side.clock.advance(1)
    return side.call_service(side.mod.DOMAIN, side.mod.SERVICE_EXECUTE, bk.sign_with(kid, material, body, ts=int(time.time())))


def _store_key(side: kh.BridgeSide) -> str:
    return f"smplwise_bridge_keys_{side.entry.entry_id}"


@pytest.mark.parametrize("mode", sorted(LEGACY_STATES))
def test_real_setup_a_legacy_store_and_a_re_paired_entry(side, mode):
    """Home Assistant starts the bridge with the 2.11.0 - 2.14.0 key store and the entry holding the add-on's (new) pairing code."""
    code = side.entry_code
    side.restore_storage({_store_key(side): json.dumps(LEGACY_STATES[mode])})
    side.settle()
    assert side.entry_code == code and side.ks.repaired, "the setup took the re-pair and did not blank the code"
    assert _execute(side, LEGACY_KID, LEGACY_MATERIAL)["error"] == "bad_signature", "the old rotated key is dead"
    assert _execute(side, "g0-legacy", code) == {"ok": False, "error": "service_not_allowed"}, "the new pairing verifies"
    stored = side.stored_state()
    assert stored["legacy_retired"] is False and LEGACY_KID not in stored["keys"]
    side.restart()
    assert side.entry_code == code and not side.ks.repaired
    assert _execute(side, LEGACY_KID, LEGACY_MATERIAL)["error"] == "bad_signature"


def test_real_setup_wb07_and_the_save_before_the_reload(side):
    """A rotated, retired bridge (today's tagged store); the re-pair writes the add-on's code. Before the reload: execute and rotate with
    the old key are refused (`pairing_changed`, rotate unsigned); the queued high-water save does not blank the new code; the listener
    schedules the reload, and the reloaded setup is the new pairing."""
    m = side.mod
    addon_code, material = side.entry_code, secrets.token_urlsafe(32)
    state = {"v": 1, "signing": LEGACY_KID, "keys": {LEGACY_KID: material}, "old": None, "next": None, "legacy_retired": True,
             "legacy_fp": side.keyset_mod.legacy_fingerprint(OLD_CODE), "rotation": None, "hw": {}}
    side.entry.data = {**side.entry.data, m.CONF_PAIRING_CODE: OLD_CODE}  # a restart between the key save and the entry update (HA-06)
    side.restore_storage({_store_key(side): json.dumps(state)})
    side.settle()
    assert side.entry_code == "" and not side.ks.repaired, "HA-06 unchanged: the retired code was recognised and blanked"
    assert _execute(side, LEGACY_KID, material)["error"] == "service_not_allowed" and side.ks.dirty, "a new high-water mark, save queued"
    assert side.hass is not None
    side.hass.config_entries.async_update_entry(side.entry, data={**side.entry.data, m.CONF_PAIRING_CODE: addon_code})  # the re-pair
    hw = dict(side.ks.hw)
    refusal = _execute(side, LEGACY_KID, material)
    assert refusal["ok"] is False and refusal["error"] == "pairing_changed"
    side.clock.advance(1)
    status = bk.sign_with(LEGACY_KID, material, {"protocol": side.keyset_mod.PROTOCOL, "op": "status", "rotation_id": "r-2520"}, ts=int(time.time()))
    assert side.call_service(m.DOMAIN, m.SERVICE_ROTATE, status) == {"ok": False, "code": "pairing_changed"}, "unsigned (HA-01)"
    assert side.ks.hw == hw, "refused before the key set: no high-water mark moved"
    side.settle()  # the queued delayed save, then the listener
    assert side.entry_code == addon_code, "the save did not blank the re-pair's code"
    assert side.hass.config_entries.reloads == [side.entry.entry_id]
    side.restart()  # the scheduled reload
    assert side.ks.repaired and side.entry_code == addon_code
    assert _execute(side, LEGACY_KID, material)["error"] == "bad_signature"
    assert _execute(side, "g0-legacy", addon_code)["error"] == "service_not_allowed"
