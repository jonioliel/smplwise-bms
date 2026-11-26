"""WISKEY-BRIDGE-KEYSET-2520 (bridge 0.10.9): `custom_components/smplwise_bridge/native_keyset.py`, the key-set binding WisKey rc19's
direct transport v2 imports (`verify` -> binding `check()` / `sign_reply()`, `Unavailable`, `legacy_allowed`, `source_fingerprint`,
`attach`), and the Persister additions it relies on (`saved_through`, `control`, one save at a time).

Cross tests against Arx's own v2 signer and reply verifier (row R7, `services/wiskey_media_bridge.py`): Arx signs -> the bridge
verifies; the bridge signs a reply -> R7's `open_reply` accepts it. The WisKey side is reproduced only where it calls this module
(`existing_bridge_auth.verify` / `direct_bridge_origin.send_message` at rc19 3e7bfc58, read, not run): the reply bytes are built
exactly as `send_message` builds them. Synthetic keys and fake Home Assistant objects only; nothing contacts a bridge, Home Assistant
or WisKey."""
from __future__ import annotations

import asyncio
import base64
import hashlib
import json
import re
import secrets
import sys
from enum import Enum
from pathlib import Path
from types import SimpleNamespace
from typing import Any

import pytest

sys.path.insert(0, str(Path(__file__).resolve().parent))
import bridge_loader  # noqa: E402

from smplwise.services import bridge_keys as bk  # noqa: E402
from smplwise.services import ha_bridge  # noqa: E402
from smplwise.services import wiskey_media_bridge as wmb  # noqa: E402

nks = bridge_loader.load_private("native_keyset", "nks2520")
ksm = sys.modules[nks.__name__.rsplit(".", 1)[0] + ".keyset"]
SRC, MIRROR = bridge_loader.SRC, bridge_loader.MIRROR

SECRET = "synthetic-native-keyset-pairing-0001"
KID = "g1-01234567"
KID2 = "g2-89abcdef"
SALT = bytes(range(32))
SALT2 = bytes(reversed(range(32)))
CHALLENGE = "0123456789abcdef0123456789abcdef"


class State(Enum):  # Home Assistant's ConfigEntryState is read by value
    LOADED = "loaded"
    NOT_LOADED = "not_loaded"


class Entry:
    def __init__(self, entry_id: str, code: str) -> None:
        self.entry_id, self.data, self.state = entry_id, {"pairing_code": code}, State.LOADED


class Entries:
    def __init__(self) -> None:
        self.held: dict[str, Entry] = {}

    def async_get_entry(self, entry_id: str) -> Entry | None:
        return self.held.get(entry_id)


class Store:
    def __init__(self) -> None:
        self.saved: list[dict[str, Any]] = []
        self.fail = 0
        self.gate: asyncio.Event | None = None
        self.entered: asyncio.Event | None = None

    async def save(self, state: dict[str, Any]) -> None:
        if self.gate is not None:
            gate, self.gate = self.gate, None
            assert self.entered is not None
            self.entered.set()
            await gate.wait()
        if self.fail:
            self.fail -= 1
            raise OSError("synthetic store failure")
        self.saved.append(json.loads(json.dumps(state)))


class World:
    """One Home Assistant with one (or more) bridge entries, each with its own KeySet + Persister attached like __init__ does."""

    def __init__(self) -> None:
        self.hass = SimpleNamespace(data={}, config_entries=Entries())
        self.clock = [1_790_000_000.0]
        self.rows: dict[str, Any] = {}

    def now(self) -> float:
        return self.clock[0]

    def add(self, entry_id: str = "entry-1", code: str = SECRET, state: dict[str, Any] | None = None) -> SimpleNamespace:
        entry = Entry(entry_id, code)
        self.hass.config_entries.held[entry_id] = entry
        keyset = ksm.KeySet(code, state, now=self.now, mono=self.now)
        store = Store()

        def wipe() -> None:
            entry.data = {**entry.data, "pairing_code": ""}

        saver = ksm.Persister(keyset, store.save, lambda: entry.data.get("pairing_code") or "", wipe, lambda c: c.close())
        detach = nks.attach(self.hass, entry, keyset, saver)
        row = SimpleNamespace(entry=entry, keyset=keyset, saver=saver, store=store, detach=detach, code=code)
        self.rows[entry_id] = row
        return row


def run(coro: Any) -> Any:
    return asyncio.run(coro)


def rotate(w: World, row: SimpleNamespace, *, kid: str = KID, gen: int = 1, salt: bytes = SALT, mode: str = "routine",
           signer: tuple[str, str] | None = None) -> str:
    """begin + commit through the bridge's own rotation ops (signed as the add-on signs them); returns the new key's material."""
    rid = f"synthetic-rotation-{gen}"
    begin = {"protocol": ksm.PROTOCOL, "op": "begin", "rotation_id": rid, "kid_next": kid, "gen_next": gen, "mode": mode,
             "overlap_s": 120 if mode == "routine" else 0, "salt": base64.b64encode(salt).decode()}
    ts = int(w.now())
    if signer is None:
        msg = ha_bridge.sign(row.code, begin, ts=ts)
        material_cur = row.code
    else:
        msg = bk.sign_with(signer[0], signer[1], begin, ts=ts)
        material_cur = signer[1]
    assert run(row.saver.control(msg))["ok"] is True
    material = ksm.derive_next(material_cur, salt, kid, gen)
    commit = {"protocol": ksm.PROTOCOL, "op": "commit", "rotation_id": rid}
    assert run(row.saver.control(bk.sign_with(kid, material, commit, ts=ts)))["ok"] is True
    return material


def retire(w: World, row: SimpleNamespace, kid: str, material: str, gen: int = 1) -> None:
    body = {"protocol": ksm.PROTOCOL, "op": "retire", "rotation_id": f"synthetic-rotation-{gen}"}
    assert run(row.saver.control(bk.sign_with(kid, material, body, ts=int(w.now()))))["ok"] is True


def arx_connect(material: str, kid: str, now: float, nonce: str | None = None) -> dict[str, Any]:
    """Arx's v2 connect proof (R7: wiskey_media_bridge.sign_connect(version=2))."""
    return wmb.sign_connect(ha_bridge.BridgeKey(material, kid), CHALLENGE, now=int(now), nonce=nonce, version=2)


def wiskey_reply_bytes(kid: str, frame: dict[str, Any], connection_ref: str = CHALLENGE) -> bytes:
    """Exactly what WisKey rc19 `direct_bridge_origin.send_message` hands `sign_reply` (tree() codec, then canonical dumps)."""
    frame = json.loads(json.dumps(frame, ensure_ascii=False, allow_nan=False, separators=(",", ":")))
    body = {"connection_ref": connection_ref, "frame": frame, "kid": kid}
    return json.dumps(body, sort_keys=True, separators=(",", ":"), ensure_ascii=False, allow_nan=False).encode()


def wiskey_wrapped(kid: str, frame: dict[str, Any], sig: str) -> dict[str, Any]:
    return {"kind": "wiskey-direct-reply.v2", "connection_ref": CHALLENGE, "frame": frame, "kid": kid, "sig": sig}


@pytest.fixture()
def rotated() -> tuple[World, SimpleNamespace, str]:
    w = World()
    row = w.add()
    material = rotate(w, row)
    return w, row, material


def refused(code: str, coro_or_fn: Any) -> None:
    with pytest.raises(nks.Unavailable) as exc:
        run(coro_or_fn) if asyncio.iscoroutine(coro_or_fn) else coro_or_fn()
    assert exc.value.code == code and str(exc.value) == code


# ====================================================================== the interface WisKey imports


def test_the_surface_wiskey_rc19_imports_exists_with_its_shapes():
    for name in ("Unavailable", "verify", "legacy_allowed", "source_fingerprint", "attach"):
        assert hasattr(nks, name), name
    assert issubclass(nks.Unavailable, Exception)
    assert asyncio.iscoroutinefunction(nks.verify)
    assert callable(nks.KeyBinding.check) and callable(nks.KeyBinding.sign_reply)
    assert nks.KeyBinding.__slots__ == ("__weakref__",), "a binding carries nothing (no material, no key set)"
    assert ksm.Persister.saved_through and asyncio.iscoroutinefunction(ksm.Persister.control)


# ====================================================================== cross: Arx signs -> the bridge verifies


def test_arx_v2_connect_and_command_proofs_verify_and_bind_entry_and_kid(rotated):
    w, row, material = rotated
    binding = run(nks.verify(w.hass, arx_connect(material, KID, w.now())))
    assert binding.check() == (row.entry, KID)
    signer = wmb.BridgeSigner(lambda: ha_bridge.BridgeKey(material, KID), clock=w.now, protocol_version=2)
    proof = signer.command_proof("direct/pairing_status_v2", "arx-service:entry-1", {})
    assert proof["kind"] == "wiskey-bridge-command.v2" and proof["kid"] == KID
    assert run(nks.verify(w.hass, proof)).check() == (row.entry, KID)


def test_bridge_reply_signature_is_accepted_by_r7_open_reply(rotated):
    w, row, material = rotated
    binding = run(nks.verify(w.hass, arx_connect(material, KID, w.now())))
    key = ha_bridge.BridgeKey(material, KID)
    # Hebrew text, a nested list and a finite float: WisKey's codec keeps them, the canonical bytes must match on both sides
    frame = {"id": 2, "type": "result", "success": True, "result": {"name": "דלת ראשית", "level": 0.25, "ids": [3, 1, 2]}}
    sig = binding.sign_reply(wiskey_reply_bytes(KID, frame))
    assert re.fullmatch("[0-9a-f]{64}", sig)
    assert sig == wmb.reply_mac(key, CHALLENGE, frame, version=2), "the one Arx-defined v2 reply recipe"
    assert wmb.open_reply(key, CHALLENGE, wiskey_wrapped(KID, frame, sig), version=2) == frame


def test_the_reply_recipe_is_exactly_the_documented_one(rotated):
    import hmac

    w, row, material = rotated
    binding = run(nks.verify(w.hass, arx_connect(material, KID, w.now())))
    encoded = wiskey_reply_bytes(KID, {"id": 9, "type": "event", "event": {}})
    want = hmac.new(material.encode(), b"wiskey-direct-reply.v2." + encoded, hashlib.sha256).hexdigest()
    assert binding.sign_reply(encoded) == want


# ====================================================================== negative cases


def test_wrong_kid_is_refused(rotated):
    w, row, material = rotated
    refused("bridge_key_unknown", nks.verify(w.hass, arx_connect(material, "g7-0badc0de", w.now())))
    # a valid kid of this key set, but the material of another key: the MAC refuses it
    other = ksm.derive_next(SECRET, SALT2, KID, 1)
    refused("bridge_bad_signature", nks.verify(w.hass, arx_connect(other, KID, w.now())))


def test_tampered_frame_is_refused_both_ways(rotated):
    w, row, material = rotated
    proof = arx_connect(material, KID, w.now())
    proof["parameters"] = {"challenge": "f" * 32}
    refused("bridge_bad_signature", nks.verify(w.hass, proof))
    binding = run(nks.verify(w.hass, arx_connect(material, KID, w.now())))
    frame = {"id": 2, "type": "result", "success": True, "result": {"ok": True}}
    wrapped = wiskey_wrapped(KID, frame, binding.sign_reply(wiskey_reply_bytes(KID, frame)))
    wrapped["frame"] = {**frame, "result": {"ok": False}}
    with pytest.raises(wmb.MediaBridgeError):
        wmb.open_reply(ha_bridge.BridgeKey(material, KID), CHALLENGE, wrapped, version=2)


def test_wrong_recipe_prefix_is_refused(rotated):
    import hmac

    w, row, material = rotated
    key = ha_bridge.BridgeKey(material, KID)
    frame = {"id": 2, "type": "result", "success": True, "result": {}}
    encoded = wiskey_reply_bytes(KID, frame)
    for prefix in (b"wiskey-direct-reply.v1.", b"wiskey-direct-reply.v2", b""):
        wrong = hmac.new(material.encode(), prefix + encoded, hashlib.sha256).hexdigest()
        with pytest.raises(wmb.MediaBridgeError):
            wmb.open_reply(key, CHALLENGE, wiskey_wrapped(KID, frame, wrong), version=2)
    # a request signed with the kid-less v1 recipe but carrying the kid: never verified as v2
    body = wmb.connect_body(CHALLENGE, int(w.now()), version=2)
    v1 = ha_bridge.sign(material, body, ts=int(w.now()), nonce="a" * 32)
    refused("bridge_bad_signature", nks.verify(w.hass, {**v1, "kid": KID}))


def test_a_message_without_kid_is_never_verified_here_no_v1_fallback(rotated):
    w, row, _material = rotated
    v1 = ha_bridge.sign(SECRET, wmb.connect_body(CHALLENGE, int(w.now()), version=1), ts=int(w.now()))
    assert row.keyset.verify(dict(v1)) is None, "the pairing secret still verifies v1 at the key set (old key of the open rotation)"
    refused("bridge_protocol_unsupported", nks.verify(w.hass, ha_bridge.sign(SECRET, {"x": 1}, ts=int(w.now()))))
    refused("bridge_protocol_unsupported", nks.verify(w.hass, "not a message"))


def test_the_pairing_secrets_own_kid_is_refused_on_v2():
    w = World()
    w.add()
    msg = bk.sign_with("g0-legacy", SECRET, wmb.connect_body(CHALLENGE, int(w.now()), version=2), ts=int(w.now()))
    refused("bridge_key_unversioned", nks.verify(w.hass, msg))


def test_retired_key_is_refused_and_its_bindings_stop(rotated):
    w, row, material = rotated
    binding = run(nks.verify(w.hass, arx_connect(material, KID, w.now())))
    # finish the routine rotation, then a hard cut to the next key: KID is gone at once
    retire(w, row, KID, material)
    material2 = rotate(w, row, kid=KID2, gen=2, salt=SALT2, mode="hard_cut", signer=(KID, material))
    refused("bridge_key_retired", binding.check)
    frame = {"id": 3, "type": "result", "success": True, "result": {}}
    refused("bridge_key_retired", lambda: binding.sign_reply(wiskey_reply_bytes(KID, frame)))
    refused("bridge_key_unknown", nks.verify(w.hass, arx_connect(material, KID, w.now())))
    assert run(nks.verify(w.hass, arx_connect(material2, KID2, w.now()))).check() == (row.entry, KID2)


def test_the_180_s_cap_retires_the_old_key_too(rotated):
    w, row, material = rotated
    v1_old = run(nks.verify(w.hass, arx_connect(material, KID, w.now())))
    assert nks.legacy_allowed(w.hass, row.entry) is True, "the pairing secret is the open rotation's old key"
    w.clock[0] += ksm.CAP_S + 1
    assert nks.legacy_allowed(w.hass, row.entry) is False
    assert v1_old.check() == (row.entry, KID), "the committed key stays"


def test_replay_and_stale_are_refused(rotated):
    w, row, material = rotated
    msg = arx_connect(material, KID, w.now())
    run(nks.verify(w.hass, dict(msg)))
    refused("bridge_replay", nks.verify(w.hass, dict(msg)))
    refused("bridge_stale", nks.verify(w.hass, arx_connect(material, KID, w.now() - 61)))


def test_sign_reply_signs_only_the_canonical_reply_of_its_own_kid(rotated):
    w, row, material = rotated
    binding = run(nks.verify(w.hass, arx_connect(material, KID, w.now())))
    frame = {"id": 2, "type": "result", "success": True, "result": {}}
    good = wiskey_reply_bytes(KID, frame)
    bad = [
        wiskey_reply_bytes(KID2, frame),  # another kid
        json.dumps({"connection_ref": CHALLENGE, "frame": frame, "kid": KID}).encode(),  # not canonical (spaces)
        wiskey_reply_bytes(KID, frame).replace(b'"kid"', b'"kid","x":1,"kid"', 1),  # duplicate key / extra field
        json.dumps({"connection_ref": CHALLENGE, "frame": frame, "kid": KID, "x": 1}, sort_keys=True, separators=(",", ":")).encode(),
        wiskey_reply_bytes(KID, frame, connection_ref="not-a-challenge"),
        json.dumps({"connection_ref": CHALLENGE, "frame": [1], "kid": KID}, sort_keys=True, separators=(",", ":")).encode(),
        b'{"connection_ref":"' + CHALLENGE.encode() + b'","frame":{"x":NaN},"kid":"' + KID.encode() + b'"}',
        good.decode(),  # a str, not bytes
        b"",
        b"\xff\xfe",
    ]
    for raw in bad:
        refused("bridge_reply_invalid", lambda raw=raw: binding.sign_reply(raw))
    assert re.fullmatch("[0-9a-f]{64}", binding.sign_reply(good))


def test_two_entries_holding_the_same_kid_are_ambiguous():
    w = World()
    a = w.add("entry-a")
    b = w.add("entry-b")
    material = rotate(w, a)
    rotate(w, b)  # the same pairing code and salt: the same kid and material on a second entry
    refused("bridge_key_ambiguous", nks.verify(w.hass, arx_connect(material, KID, w.now())))
    b.entry.state = State.NOT_LOADED
    assert run(nks.verify(w.hass, arx_connect(material, KID, w.now()))).check() == (a.entry, KID)


def test_reload_unload_and_removal_stop_old_bindings(rotated):
    w, row, material = rotated
    binding = run(nks.verify(w.hass, arx_connect(material, KID, w.now())))
    row.entry.state = State.NOT_LOADED
    refused("bridge_source_changed", binding.check)
    row.entry.state = State.LOADED
    assert binding.check() == (row.entry, KID)
    # a reload: a new setup attaches its own key set for the same entry
    fresh = ksm.KeySet(SECRET, row.keyset.state(), now=w.now, mono=w.now)
    nks.attach(w.hass, row.entry, fresh, ksm.Persister(fresh, row.store.save, lambda: SECRET, lambda: None, lambda c: c.close()))
    refused("bridge_source_changed", binding.check)
    row.detach()  # the OLD setup's detach must not remove the new attachment
    assert nks.DATA_KEY in w.hass.data and row.entry.entry_id in w.hass.data[nks.DATA_KEY]
    del w.hass.config_entries.held[row.entry.entry_id]
    refused("bridge_key_unknown", nks.verify(w.hass, arx_connect(material, KID, w.now())))
    refused("bridge_binding_unknown", lambda: nks.KeyBinding().check())


def test_attach_refuses_a_saver_of_another_key_set():
    w = World()
    row = w.add()
    other = ksm.KeySet(SECRET)
    with pytest.raises(ValueError):
        nks.attach(w.hass, row.entry, other, row.saver)


# ====================================================================== replay across a restart: the high-water mark is saved first


def test_the_mark_is_saved_before_admission_and_a_restart_refuses_the_replay(rotated):
    w, row, material = rotated
    before = len(row.store.saved)
    msg = arx_connect(material, KID, w.now() + 1)
    run(nks.verify(w.hass, dict(msg)))
    assert len(row.store.saved) == before + 1 and row.store.saved[-1]["hw"][KID] == msg["ts"]
    assert row.saver.saved_through(KID, msg["ts"])
    run(nks.verify(w.hass, arx_connect(material, KID, w.now() + 1)))
    assert len(row.store.saved) == before + 1, "a second message in an already saved second needs no write"
    restarted = ksm.KeySet(SECRET, row.store.saved[-1], now=w.now, mono=w.now)
    assert restarted.verify(dict(msg)) == "replay"


def test_a_failed_save_refuses_admission():
    w = World()
    row = w.add()
    material = rotate(w, row)
    row.store.fail = 1
    refused("bridge_highwater_not_persisted", nks.verify(w.hass, arx_connect(material, KID, w.now() + 1)))
    assert row.keyset.dirty, "stays dirty: the housekeeping retries the save"


def test_a_rolled_back_rotation_save_cannot_admit_an_unsaved_mark():
    """WisKey's own regression (test_m15_direct_v2::test_rotation_save_rollback_cannot_admit_unpersisted_native_highwater), on fakes:
    a rotation save is in flight and fails; a v2 message verified meanwhile must not be admitted on a mark that was rolled back."""
    w = World()
    row = w.add()
    material = rotate(w, row)
    entered, release = asyncio.Event(), asyncio.Event()
    first = [True]

    async def failing_once(state: dict[str, Any]) -> None:
        if first[0]:
            first[0] = False
            entered.set()
            await release.wait()
            raise OSError("synthetic store failure before commit")
        row.store.saved.append(json.loads(json.dumps(state)))

    row.saver._save = failing_once  # noqa: SLF001 - the fault point, as WisKey's test patches it

    async def scenario() -> dict[str, Any]:
        future = row.keyset.hw[KID] + 1
        status = bk.sign_with(KID, material, {"protocol": ksm.PROTOCOL, "op": "status", "rotation_id": "synthetic-rotation-1"}, ts=future)
        control = asyncio.create_task(row.saver.control(status))
        await asyncio.wait_for(entered.wait(), 5)
        proof = arx_connect(material, KID, future + 1)
        admission = asyncio.create_task(nks.verify(w.hass, proof))
        await asyncio.sleep(0)
        release.set()
        with pytest.raises(OSError):
            await control
        with pytest.raises(nks.Unavailable, match="bridge_highwater_not_persisted"):
            await admission
        return proof

    w.clock[0] += 1
    proof = run(scenario())
    assert not row.saver.saved_through(KID, proof["ts"])


def test_one_save_at_a_time():
    w = World()
    row = w.add()
    order: list[str] = []

    async def slow(state: dict[str, Any]) -> None:
        order.append("start")
        await asyncio.sleep(0)
        await asyncio.sleep(0)
        order.append("end")
        row.store.saved.append(state)

    row.saver._save = slow  # noqa: SLF001

    async def two() -> None:
        row.keyset.dirty = True
        first = asyncio.create_task(row.saver.persist())
        await asyncio.sleep(0)
        row.keyset.hw["g0-legacy"] = 5
        row.keyset.dirty = True
        await asyncio.gather(first, row.saver.persist())

    run(two())
    assert order == ["start", "end", "start", "end"], "the second save waited for the first and then saved the newer state"
    assert row.saver.saved_through("g0-legacy", 5) and not row.saver.saved_through("g0-legacy", 6)
    assert not row.saver.saved_through("g0-legacy", True), "a bool is not a timestamp"


def test_control_rolls_back_a_failed_save_like_the_old_rotate_service():
    w = World()
    row = w.add()
    row.store.fail = 1
    begin = {"protocol": ksm.PROTOCOL, "op": "begin", "rotation_id": "r1", "kid_next": KID, "gen_next": 1, "mode": "routine",
             "overlap_s": 120, "salt": base64.b64encode(SALT).decode()}
    with pytest.raises(OSError):
        run(row.saver.control(ha_bridge.sign(SECRET, begin, ts=int(w.now()))))
    assert row.keyset.next is None and row.keyset.rotation is None and KID not in row.keyset.keys


# ====================================================================== legacy_allowed and source_fingerprint


def test_legacy_allowed_follows_the_key_set_not_the_entry_copy():
    w = World()
    row = w.add()
    assert nks.legacy_allowed(w.hass, row.entry) is True, "unrotated: the pairing secret is the signing key"
    material = rotate(w, row)
    assert nks.legacy_allowed(w.hass, row.entry) is True, "the old key of the open rotation"
    retire(w, row, KID, material)
    assert row.keyset.legacy is None
    row.entry.data = {"pairing_code": SECRET}  # retired before the entry's copy was blanked
    assert nks.legacy_allowed(w.hass, row.entry) is False
    row.entry.state = State.NOT_LOADED
    assert nks.legacy_allowed(w.hass, row.entry) is False


def test_legacy_allowed_is_false_when_unattached_unloaded_or_the_code_differs():
    w = World()
    row = w.add()
    row.entry.data = {"pairing_code": "a-different-code"}
    assert nks.legacy_allowed(w.hass, row.entry) is False
    row.entry.data = {"pairing_code": SECRET}
    row.entry.state = State.NOT_LOADED
    assert nks.legacy_allowed(w.hass, row.entry) is False
    row.entry.state = State.LOADED
    row.detach()
    assert nks.legacy_allowed(w.hass, row.entry) is False
    assert nks.legacy_allowed(SimpleNamespace(data=None), row.entry) is False


def test_source_fingerprint_is_stable_across_rotation_and_new_after_a_re_pair():
    w = World()
    row = w.add()
    first = nks.source_fingerprint(w.hass, row.entry)
    assert re.fullmatch("[0-9a-f]{64}", first)
    assert SECRET not in first and ksm.legacy_fingerprint(SECRET) != first
    material = rotate(w, row)
    assert nks.source_fingerprint(w.hass, row.entry) == first
    retire(w, row, KID, material)
    assert row.keyset.legacy is None and nks.source_fingerprint(w.hass, row.entry) == first, "from the retired code's saved tag"
    # a re-pair: a new code in the same entry (K-02) -> a fresh key set -> a new fingerprint
    w2 = World()
    again = w2.add(code="synthetic-native-keyset-pairing-0002")
    assert nks.source_fingerprint(w2.hass, again.entry) != first
    row.detach()
    refused("bridge_source_changed", lambda: nks.source_fingerprint(w.hass, row.entry))


def test_source_fingerprint_without_a_pairing_tag_is_unavailable():
    w = World()
    state = ksm.KeySet(SECRET).state()
    state.update(legacy_retired=True, legacy_fp=None, signing=KID, keys={KID: "synthetic-material"})
    row = w.add(code="", state=state)
    refused("bridge_pairing_unknown", lambda: nks.source_fingerprint(w.hass, row.entry))


# ====================================================================== a re-pair before detach / reload (WisKey acceptance, ported)
#
# WisKey's acceptance run FINAL-ARX-REPAIR (handoff 57e4615e, PRODUCT rc20 dcebb9f3, `tests/ha/test_arx_pairing_gap.py`) FAILED twice
# on 8e412b0c0: with the WisKey fixture's key set (a routine rotation begun and committed, not retired) the entry's pairing code is
# changed by `async_update_entry` and NOTHING is detached or reloaded; then (a) `source_fingerprint` must raise `Unavailable` and (b)
# the OLD key must not open a NEW v2 socket. Ported here on this file's fakes; the v2 socket is a fake WisKey whose connect calls
# `native_keyset.verify` (as `existing_bridge_auth.verify` does) and signs its identity reply with `binding.sign_reply`
# (as `direct_bridge_origin.send_message` does), driven by Arx's own R7 `DirectApiTransport`.

REPAIRED_CODE = "synthetic-repaired-new-code"
REPO = "00000000-0000-4000-8000-0000000000a7"


class NativeV2Socket:
    """WisKey's v2 direct socket, only as far as it touches the bridge: hello -> connect proof -> `native_keyset.verify` -> on success
    the identity reply signed by the binding; a refusal closes without a word (WisKey never echoes unauthenticated input)."""

    def __init__(self, hass: Any, entry_id: str = "entry-1") -> None:
        self.hass, self.subject = hass, "arx-service:" + entry_id
        self.opened = 0
        self.bindings: list[Any] = []
        self.refusals: list[str] = []
        self.tasks: list[asyncio.Task[Any]] = []
        self.sockets: list[Any] = []

    async def opener(self) -> Any:
        from w10_fake_direct import MemorySocket

        self.opened += 1
        client, server = MemorySocket.pair()
        self.sockets.append(server)
        self.tasks.append(asyncio.get_running_loop().create_task(self._serve(server)))
        return client

    async def _serve(self, sock: Any) -> None:
        from w10_fake_direct import Closed

        challenge = secrets.token_hex(16)
        try:
            await sock.send(json.dumps({"type": "hello", "protocol": "wiskey-direct-ws.v2", "challenge": challenge}))
            message = json.loads(await sock.recv())
            try:
                binding = await nks.verify(self.hass, message["bridge"])
                _entry, kid = binding.check()
            except nks.Unavailable as exc:
                self.refusals.append(exc.code)
                await sock.close()
                return
            self.bindings.append(binding)
            identity = {"protocol": "wiskey-direct-ws.v2", "query_owner_id": self.subject, "principal_kind": "pairing_service",
                        "connection_ref": challenge, "repository_id": REPO, "kid": kid}
            frame = {"id": 1, "type": "result", "success": True, "result": identity}
            sig = binding.sign_reply(wiskey_reply_bytes(kid, frame, challenge))
            await sock.send(json.dumps({"kind": "wiskey-direct-reply.v2", "connection_ref": challenge, "frame": frame, "kid": kid, "sig": sig}))
            while True:
                await sock.recv()
        except Closed:
            return

    async def stop(self) -> None:
        for s in self.sockets:
            await s.close()
        for t in self.tasks:
            t.cancel()
        await asyncio.gather(*self.tasks, return_exceptions=True)


class NoV1:
    async def __call__(self) -> Any:
        raise AssertionError("v1 fallback attempted")


def test_wiskey_acceptance_a_a_re_pair_before_reload_voids_the_previous_pairing_fingerprint(rotated):
    """FINAL-ARX-REPAIR `test_repairing_cannot_keep_previous_pairing_fingerprint` (FAILED on 8e412b0c0: DID NOT RAISE)."""
    w, row, _material = rotated
    before = nks.source_fingerprint(w.hass, row.entry)
    assert nks.legacy_allowed(w.hass, row.entry) is True
    row.entry.data = {"pairing_code": REPAIRED_CODE}  # WisKey: async_update_entry(entry, data=...) - no detach, no reload
    refused("bridge_pairing_changed", lambda: nks.source_fingerprint(w.hass, row.entry))
    assert nks.legacy_allowed(w.hass, row.entry) is False
    assert w.hass.data[nks.DATA_KEY]["entry-1"] is not None, "still attached: the refusal does not wait for detach or reload"
    assert ksm.legacy_fingerprint(REPAIRED_CODE) != ksm.legacy_fingerprint(SECRET) and before


def test_wiskey_acceptance_b_the_old_key_cannot_open_a_new_v2_socket_during_a_re_pair(rotated):
    """FINAL-ARX-REPAIR `test_old_key_cannot_open_new_v2_socket_during_repair` (FAILED on 8e412b0c0: DID NOT RAISE MediaBridgeError).
    A positive control first (the same transport and fake connect before the re-pair), so the refusal is not the fake's."""
    w, row, material = rotated

    async def scenario() -> tuple[Any, list[str], int]:
        server = NativeV2Socket(w.hass)
        transport = wmb.DirectApiTransport(NoV1(), lambda: ha_bridge.BridgeKey(material, KID), clock=w.now, opener_v2=server.opener)
        try:
            link = await transport.connect(wmb.PURPOSE_COMMAND)  # before the re-pair: accepted
            assert (link.protocol_version, link.kid) == (2, KID)
            await link.close()
            open_binding = server.bindings[0]
            saves = len(row.store.saved)
            row.entry.data = {"pairing_code": REPAIRED_CODE}  # the re-pair, before any detach / reload
            w.clock[0] += 1
            link = None
            try:
                with pytest.raises(wmb.MediaBridgeError):
                    link = await transport.connect(wmb.PURPOSE_COMMAND)
            finally:
                if link is not None:
                    await link.close()
            assert len(row.store.saved) == saves, "refused before the key set's check: no high-water write for a voided pairing"
            return open_binding, server.refusals, server.opened
        finally:
            await server.stop()

    open_binding, refusals, opened = run(scenario())
    assert opened == 2 and refusals == ["bridge_pairing_changed"]
    # the socket opened before the re-pair: WisKey's 0.25 s `check()` and its reply signing stop at once
    refused("bridge_pairing_changed", open_binding.check)
    refused("bridge_pairing_changed", lambda: open_binding.sign_reply(wiskey_reply_bytes(KID, {"id": 2, "type": "result"})))
    refused("bridge_pairing_changed", nks.verify(w.hass, arx_connect(material, KID, w.now() + 2)))


def test_the_bridges_own_pairing_states_stay_current_and_any_other_code_is_refused():
    """What counts as the SAME pairing: the entry holds the key set's pairing secret; or, once the secret is retired, the retired code
    (HA-06: a restart between the key save and the entry update) or the blank the bridge itself writes. Anything else is a re-pair."""
    w = World()
    row = w.add()
    material = rotate(w, row)
    binding = run(nks.verify(w.hass, arx_connect(material, KID, w.now())))
    first = nks.source_fingerprint(w.hass, row.entry)
    retire(w, row, KID, material)
    assert row.keyset.legacy is None and row.entry.data["pairing_code"] == "", "the bridge blanked its copy (HA-06)"
    assert binding.check() == (row.entry, KID) and nks.source_fingerprint(w.hass, row.entry) == first
    row.entry.data = {"pairing_code": SECRET}  # the retired code left in the entry by a restart between the two writes
    assert binding.check() == (row.entry, KID) and nks.source_fingerprint(w.hass, row.entry) == first
    for other in (REPAIRED_CODE, SECRET + " ", 12345, b"bytes"):  # a re-pair after the first rotation; anything that is not a code
        row.entry.data = {"pairing_code": other}
        refused("bridge_pairing_changed", binding.check)
        refused("bridge_pairing_changed", lambda: nks.source_fingerprint(w.hass, row.entry))
        w.clock[0] += 1
        refused("bridge_pairing_changed", nks.verify(w.hass, arx_connect(material, KID, w.now())))
    row.entry.data = None  # no readable entry data: closed
    refused("bridge_pairing_changed", binding.check)
    row.entry.data = {}  # the bridge reads a missing code as blank, like `__init__` does
    assert binding.check() == (row.entry, KID)
    # before the first retirement the secret IS the pairing: a blank the bridge did not write is a change too (fail closed)
    w2 = World()
    fresh = w2.add()
    material2 = rotate(w2, fresh)
    fresh.entry.data = {"pairing_code": ""}
    refused("bridge_pairing_changed", nks.verify(w2.hass, arx_connect(material2, KID, w2.now())))
    assert nks.legacy_allowed(w2.hass, fresh.entry) is False


# ====================================================================== nothing secret leaves the module


def test_no_material_in_reprs_or_refusals(rotated):
    w, row, material = rotated
    binding = run(nks.verify(w.hass, arx_connect(material, KID, w.now())))
    texts = [repr(binding), repr(w.hass.data[nks.DATA_KEY]["entry-1"])]
    for coro in (nks.verify(w.hass, arx_connect(material, "g7-0badc0de", w.now())), nks.verify(w.hass, arx_connect("x", KID, w.now()))):
        with pytest.raises(nks.Unavailable) as exc:
            run(coro)
        texts += [str(exc.value), repr(exc.value)]
    for text in texts:
        assert material not in text and SECRET not in text
    assert {n for n in dir(binding) if not n.startswith("_")} == {"check", "sign_reply"}


# ====================================================================== the bridge wiring, version and copies


def test_init_attaches_the_setups_key_set_and_rotate_uses_the_saver():
    import ast

    for root in (SRC, MIRROR):
        text = (root / "__init__.py").read_text(encoding="utf-8")
        setup = ast.unparse(next(n for n in ast.walk(ast.parse(text)) if isinstance(n, ast.AsyncFunctionDef) and n.name == "async_setup_entry"))
        assert "entry.async_on_unload(native_keyset.attach(hass, entry, keyset, saver))" in setup
        rot = setup.split("async def rotate(", 1)[1].split("hass.services.async_register", 1)[0]
        assert "return await saver.control(dict(call.data))" in rot and "keyset.handle_control" not in rot


def test_bridge_0_10_9_and_both_copies_identical():
    for root in (SRC, MIRROR):
        assert json.loads((root / "manifest.json").read_text(encoding="utf-8"))["version"] == "0.10.10"
        const = (root / "const.py").read_text(encoding="utf-8")
        assert 'VERSION = "0.10.10"' in const and "WISKEY-BRIDGE-KEYSET-2520" in const.split("# 0.10.8", 1)[0]
        assert "Needs one Home Assistant restart (by the owner)" in const.split("# 0.10.8", 1)[0]
        assert "const VERSION = '0.10.10';" in (root / "www" / "smplwise-card.js").read_text(encoding="utf-8")
    for name in ("native_keyset.py", "keyset.py", "__init__.py", "const.py", "manifest.json"):
        assert (SRC / name).read_bytes() == (MIRROR / name).read_bytes(), name


def test_the_module_stays_free_of_home_assistant_imports():
    text = (SRC / "native_keyset.py").read_text(encoding="utf-8")
    assert "homeassistant" not in text.split('"""', 2)[2]
