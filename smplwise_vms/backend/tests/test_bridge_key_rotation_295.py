"""CR-WISKEY-HMAC-ROTATION-295: the bridge HMAC key set, signature v2 with key ids, the staged rotation engine and its admin API -
against the fake peer only (tests/fake_bridge_rotation_peer.py). Synthetic keys only; nothing contacts a bridge, WisKey or HA.

Adversarial coverage: replay (same key and across keys), wrong / unknown / pending / retired kid, expired overlap window, stale,
kid-less downgrade, partial rollout (the peer holds `next`, Arx crashed), the commit's outcome lost, peer rejection at every step,
a dead peer past the cap, unsigned / foreign-key / unbound peer answers, budget exhaustion, restore, RBAC, and a secret scan of
audit rows, logs and API answers."""
from __future__ import annotations

import base64
import json
import logging
import time
from pathlib import Path

import pytest
from conftest import as_user, bind
from fake_bridge_rotation_peer import FakePeer
from fastapi.testclient import TestClient

from smplwise.db import Database, now_iso, set_setting
from smplwise.main import create_app
from smplwise.services import access_grants, backup, bridge_keys as bk, bridge_rotation as br, bridge_rotation_peer as peers, capture_lease
from smplwise.services.connection_store import SecretError, open_bridge_key, seal_bridge_key

API = "/api/v1/system/bridge-key"
LEGACY = "synthetic-legacy-pairing-secret-0001"  # a synthetic test value, never a real pairing secret


class Clock:
    def __init__(self) -> None:
        self.t = time.time()

    def __call__(self) -> float:
        return self.t

    def advance(self, s: float) -> None:
        self.t += s


@pytest.fixture()
def world(settings, monkeypatch):
    bk.reset_for_tests()
    app = create_app(settings)
    c = TestClient(app)
    c.get("/api/v1/me")
    db = Database(settings.db_path)
    with db.connection() as conn:
        set_setting(conn, "bridge.secret", LEGACY)
        set_setting(conn, br.FLAG_KEY, "on")
    monkeypatch.setattr(br, "GO_LIVE_PERMITTED", True)
    clock = Clock()
    peer = FakePeer(LEGACY, clock)
    peers.set_peer_for_tests(peer)
    br._RESTORE_SEEN.clear()
    yield {"c": c, "db": db, "settings": settings, "clock": clock, "peer": peer, "engine": br.Engine(db, settings.data_dir, peer, now=clock)}
    peers.set_peer_for_tests(None)
    bk.reset_for_tests()


def _keys(db: Database) -> dict[str, dict]:
    with db.connection(mode="read") as conn:
        return {r["kid"]: dict(r) for r in conn.execute("SELECT * FROM bridge_keys")}


def _current(db: Database, data_dir: Path) -> bk.Key:
    with db.connection(mode="read") as conn:
        return bk.current(conn, data_dir)


def _verify(w, msg, now=None) -> str:
    with w["db"].connection(mode="read") as conn:
        return bk.verify(conn, w["settings"].data_dir, msg, now=now if now is not None else w["clock"]())


def _code(w, msg, now=None) -> str:
    with pytest.raises(bk.VerifyError) as exc:
        _verify(w, msg, now)
    return exc.value.code


def _refusal(w, msg, now=None) -> tuple[str, str]:
    with pytest.raises(bk.VerifyError) as exc:
        _verify(w, msg, now)
    return exc.value.code, exc.value.detail


def _k1(db: Database) -> None:
    """Invariant K1: exactly one current key, with material; wiped rows carry no material."""
    ks = _keys(db).values()
    cur = [k for k in ks if k["state"] == "current"]
    assert len(cur) == 1 and cur[0]["value_enc"]
    assert all((k["value_enc"] is None) == (k["state"] in ("retired", "discarded")) for k in ks)


def _probe(w, kid: str) -> bool:
    """Does the PEER accept a message signed with Arx's key `kid` right now?"""
    with w["db"].connection(mode="read") as conn:
        key = bk.load(conn, w["settings"].data_dir, kid)
    msg = bk.sign_with(kid, key.material, {"protocol": br.PROTOCOL, "op": "probe", "rotation_id": "x"}, ts=int(w["clock"]()))
    return w["peer"].call("probe", msg)["ok"] is True


# ================================================================ signature v2 and the key set

def test_v2_signature_binds_the_kid_and_the_body():
    m = bk.sign_with("g1-0000abcd", "k-one", {"a": 1}, ts=100, nonce="a" * 32)
    m2 = bk.sign_with("g2-0000abcd", "k-one", {"a": 1}, ts=100, nonce="a" * 32)
    assert m["sig"] != m2["sig"]  # same key, same body, other kid: other signature
    assert bk.sign_with("g1-0000abcd", "k-one", {"a": 2}, ts=100, nonce="a" * 32)["sig"] != m["sig"]
    with pytest.raises(ValueError):
        bk.sign_with("g1-0000abcd", "k", {"kid": "x"})
    with pytest.raises(ValueError):
        bk.sign_with("G1-bad", "k", {})


def test_derivation_and_proof_are_bound_to_kid_generation_salt_and_rotation():
    salt = b"\x01" * 32
    a = bk.derive_next("k-cur", salt, "g1-0000abcd", 1)
    assert a == bk.derive_next("k-cur", salt, "g1-0000abcd", 1)
    assert len({a, bk.derive_next("k-cur", salt, "g1-0000abce", 1), bk.derive_next("k-cur", salt, "g1-0000abcd", 2),
                bk.derive_next("k-cur", b"\x02" * 32, "g1-0000abcd", 1), bk.derive_next("k-cur2", salt, "g1-0000abcd", 1)}) == 5
    assert bk.proof(a, "r1") != bk.proof(a, "r2")
    with pytest.raises(ValueError):
        bk.derive_next("k-cur", b"short", "g1-0000abcd", 1)


def test_verify_refusals_wrong_unknown_pending_kid_stale_replay_and_cross_key_replay(world):
    w = world
    with w["db"].write_aside() as conn:
        bk.adopt_legacy(conn, w["settings"].data_dir)
        bk.insert(conn, w["settings"].data_dir, kid="g1-0000abcd", generation=1, state="pending", material="k-pending", rotation_id=None)
        bk.insert(conn, w["settings"].data_dir, kid="g2-0000abcd", generation=2, state="next", material="k-next", rotation_id=None)
    now = int(w["clock"]())
    good = bk.sign_with("g0-legacy", LEGACY, {"x": 1}, ts=now)
    assert _verify(w, good) == "g0-legacy"
    assert _code(w, good) == "replay"
    # the same nonce under ANOTHER key is still a replay (one cache for every key)
    assert _code(w, bk.sign_with("g2-0000abcd", "k-next", {"x": 1}, ts=now, nonce=good["nonce"])) == "replay"
    # wrong kid: signed with the legacy key but labelled with the next key's id
    forged = bk.sign_with("g0-legacy", LEGACY, {"x": 2}, ts=now)
    forged["kid"] = "g2-0000abcd"
    assert _code(w, forged) == "bad_signature"
    assert _refusal(w, bk.sign_with("g7-deadbeef", LEGACY, {"x": 3}, ts=now)) == ("bad_signature", "key_unknown")  # H-02
    assert _code(w, bk.sign_with("g1-0000abcd", "k-pending", {"x": 4}, ts=now)) == "key_not_active"
    assert _code(w, bk.sign_with("g0-legacy", LEGACY, {"x": 5}, ts=now - 61)) == "stale"
    assert _code(w, {**bk.sign_with("g0-legacy", LEGACY, {"x": 6}, ts=now), "nonce": "short"}) == "bad_format"
    assert _code(w, "not a message") == "bad_format"
    assert _code(w, {**bk.sign_with("g0-legacy", LEGACY, {"x": 7}, ts=now), "ts": True}) == "bad_format"


def test_h02_every_refusal_before_the_mac_answers_one_wire_code(world):
    """FABLEFIX-295 H-02 (Fable review 2026-10-21): a sender without the key cannot tell an unknown kid from a pending, retired,
    expired or unreadable one, nor a stale message from a forged one - the MAC is checked first and every unauthenticated refusal
    is `bad_signature` on the wire; the precise reason is kept in `detail` and the process-local counter only."""
    w = world
    bk.REFUSALS.clear()
    with w["db"].write_aside() as conn:
        bk.adopt_legacy(conn, w["settings"].data_dir)
        bk.insert(conn, w["settings"].data_dir, kid="g1-0000abcd", generation=1, state="pending", material="k-pending", rotation_id=None)
        bk.insert(conn, w["settings"].data_dir, kid="g2-0000abcd", generation=2, state="next", material="k-next", rotation_id=None)
        bk.insert(conn, w["settings"].data_dir, kid="g3-0000abcd", generation=3, state="retiring", material="k-old", rotation_id=None)
        bk.set_state(conn, "g3-0000abcd", "retiring", verify_until=bk.iso_at(w["clock"]() - 3600))
        bk.insert(conn, w["settings"].data_dir, kid="g4-0000abcd", generation=4, state="next", material="k-gone", rotation_id=None)
        bk.set_state(conn, "g4-0000abcd", "retired")
    now = int(w["clock"]())
    wrong = "not-the-key"
    forged = {
        "unknown": bk.sign_with("g7-deadbeef", wrong, {"x": 1}, ts=now),
        "pending": bk.sign_with("g1-0000abcd", wrong, {"x": 2}, ts=now),
        "next": bk.sign_with("g2-0000abcd", wrong, {"x": 3}, ts=now),
        "expired": bk.sign_with("g3-0000abcd", wrong, {"x": 4}, ts=now),
        "retired": bk.sign_with("g4-0000abcd", wrong, {"x": 5}, ts=now),
        "stale": bk.sign_with("g0-legacy", wrong, {"x": 6}, ts=now - 3600),
    }
    codes = {name: _code(w, msg) for name, msg in forged.items()}
    assert set(codes.values()) == {"bad_signature"}, codes
    seen = bk.REFUSALS.snapshot()
    assert seen.get("key_unknown") == 1 and seen.get("key_retired") == 1 and seen.get("bad_signature") == 4
    # a retired key's real material no longer verifies either - and still says nothing more than a forgery
    assert _code(w, bk.sign_with("g4-0000abcd", "k-gone", {"x": 7}, ts=now)) == "bad_signature"
    # once the MAC proves the sender holds the key, the precise reason is answered
    assert _code(w, bk.sign_with("g1-0000abcd", "k-pending", {"x": 8}, ts=now)) == "key_not_active"
    assert _code(w, bk.sign_with("g3-0000abcd", "k-old", {"x": 9}, ts=now)) == "key_expired"
    assert _code(w, bk.sign_with("g0-legacy", LEGACY, {"x": 10}, ts=now - 3600)) == "stale"
    assert all(isinstance(v, int) for v in bk.REFUSALS.snapshot().values())  # counts only: no input text, no material


def test_kidless_v1_messages_verify_only_under_the_legacy_key_and_never_after_it_retires(world):
    from smplwise.services import ha_bridge

    w = world
    with w["db"].write_aside() as conn:
        bk.adopt_legacy(conn, w["settings"].data_dir)
    v1 = ha_bridge.sign(LEGACY, {"op": "x"}, ts=int(w["clock"]()))
    assert _verify(w, v1) == "g0-legacy"
    w["engine"].start(None, "hard_cut")
    v1b = ha_bridge.sign(LEGACY, {"op": "y"}, ts=int(w["clock"]()))
    assert _refusal(w, v1b) == ("bad_signature", "kidless_refused")  # downgrade guard: no key a kid-less message could use (H-02 wire code)


def test_sealing_is_bound_to_the_kid_and_the_install_key(world, tmp_path):
    w = world
    d = w["settings"].data_dir
    blob = seal_bridge_key(d, "g1-0000abcd", "k-secret")
    assert "k-secret" not in blob and open_bridge_key(d, "g1-0000abcd", blob) == "k-secret"
    with pytest.raises(SecretError):
        open_bridge_key(d, "g1-0000abce", blob)  # copied to another kid
    other = tmp_path / "other-install"
    other.mkdir()
    with pytest.raises(SecretError):
        open_bridge_key(other, "g1-0000abcd", blob)  # another installation's key file
    with pytest.raises(SecretError):
        seal_bridge_key(d, "../evil", "x")


def test_a_database_moved_to_another_machine_fails_closed(world, tmp_path):
    w = world
    with w["db"].write_aside() as conn:
        bk.adopt_legacy(conn, w["settings"].data_dir)
    other = tmp_path / "moved"
    other.mkdir()
    with w["db"].connection(mode="read") as conn:
        with pytest.raises(bk.KeySetError) as exc:
            bk.current(conn, other)
        assert exc.value.code == "key_unreadable"
        with pytest.raises(bk.VerifyError) as vexc:
            bk.verify(conn, other, bk.sign_with("g0-legacy", LEGACY, {"x": 1}, ts=int(time.time())))
        assert vexc.value.code == "bad_signature" and vexc.value.detail == "key_unreadable"  # H-02: one wire code
        assert bk.status(conn, other)["current"]["readable"] is False


def test_key_repr_never_shows_material():
    assert "zzz-material" not in repr(bk.Key("g1-0000abcd", 1, "current", "zzz-material"))


# ================================================================ the engine: happy paths

def test_routine_rotation_overlaps_then_retires_and_verifies(world):
    w = world
    rot = w["engine"].start(None, "routine")
    assert rot["state"] == "switched" and rot["mode"] == "routine"
    _k1(w["db"])
    cur = _current(w["db"], w["settings"].data_dir)
    assert cur.kid == rot["kid_to"] and cur.generation == 1 and cur.material == w["peer"].material(rot["kid_to"])
    # overlap: Arx verifies peer messages under BOTH keys, the peer accepts both
    assert _verify(w, w["peer"].sign({"m": 1}, kid=rot["kid_to"])) == rot["kid_to"]
    assert _verify(w, w["peer"].sign({"m": 2}, kid="g0-legacy")) == "g0-legacy"
    assert _probe(w, rot["kid_to"])
    # not yet due: tick leaves it
    assert w["engine"].tick()["state"] == "switched"
    w["clock"].advance(91)
    rot = w["engine"].tick()
    assert rot["state"] == "verified" and rot["peer_retire_ok"] == 1 and not rot["anchor_eligible"]
    ks = _keys(w["db"])
    assert ks["g0-legacy"]["state"] == "retired" and ks["g0-legacy"]["value_enc"] is None
    assert w["peer"].accepted() == {rot["kid_to"]}
    _k1(w["db"])
    # after retire: the old key is refused by Arx (by state, before any time stage)
    assert _refusal(w, w["peer"].sign({"m": 3}, kid=rot["kid_to"]) | {"kid": "g0-legacy"}) == ("bad_signature", "key_retired")  # H-02


def test_hard_cut_has_no_instant_with_two_keys_and_is_anchor_eligible(world):
    w = world
    seen_two = []
    w["peer"].on_call = lambda op: seen_two.append(len(w["peer"].accepted() - ({w["peer"].next} if w["peer"].next else set())) > 1)
    rot = w["engine"].start(None, "hard_cut")
    assert rot["state"] == "verified" and rot["anchor_eligible"] == 1 and rot["overlap_s"] == 0
    assert not any(seen_two)
    assert _keys(w["db"])["g0-legacy"]["state"] == "retired"
    assert w["peer"].accepted() == {rot["kid_to"]}
    _k1(w["db"])


def test_two_rotations_in_a_row_and_generations_grow(world):
    w = world
    r1 = w["engine"].start(None, "hard_cut")
    r2 = w["engine"].start(None, "hard_cut")
    assert (r1["gen_to"], r2["gen_from"], r2["gen_to"]) == (1, 1, 2) and r2["state"] == "verified"
    assert _current(w["db"], w["settings"].data_dir).kid == r2["kid_to"]
    _k1(w["db"])


# ================================================================ rollback (R1) at every step before the switch

@pytest.mark.parametrize("op,mode,code", [
    ("begin", "reject", "peer_refused"),
    ("begin", "drop", "peer_unreachable"),
    ("begin", "bad_proof", "derivation_mismatch"),
    ("begin", "unsigned", "peer_bad_answer"),
    ("begin", "wrong_reply", "peer_bad_answer"),
    ("begin", "foreign_key", "peer_bad_answer"),
    ("commit", "reject", "commit_rejected:peer_refused"),
])
def test_peer_rejection_rolls_back_and_the_current_key_never_stops_working(world, op, mode, code):
    w = world
    w["peer"].fail[op] = mode
    rot = w["engine"].start(None, "routine")
    assert rot["state"] == "rolled_back" and rot["result_code"] == code
    ks = _keys(w["db"])
    assert ks["g0-legacy"]["state"] == "current" and ks[rot["kid_to"]]["state"] == "discarded" and ks[rot["kid_to"]]["value_enc"] is None
    _k1(w["db"])
    w["peer"].fail.clear()
    assert _probe(w, "g0-legacy")  # the peer still accepts the key Arx signs with
    assert w["peer"].next is None or w["peer"].rotation.get("closed")


@pytest.mark.parametrize("which", ["next", "current"])
def test_confirm_probe_failure_rolls_back(world, which):
    w = world
    w["peer"].reject_probe = (lambda kid: kid != "g0-legacy") if which == "next" else (lambda kid: kid == "g0-legacy")
    rot = w["engine"].start(None, "routine")
    assert rot["state"] == "rolled_back" and rot["result_code"].startswith(f"probe_{which}_failed")
    w["peer"].reject_probe = None
    assert _current(w["db"], w["settings"].data_dir).kid == "g0-legacy" and _probe(w, "g0-legacy")
    _k1(w["db"])


def test_budget_exhausted_before_commit_rolls_back(world):
    w = world
    w["peer"].on_call = lambda op: w["clock"].advance(45) if op == "probe" else None  # two probes eat 90 s of the 180 s budget
    rot = w["engine"].start(None, "routine")
    assert rot["state"] == "rolled_back" and rot["result_code"] == "budget_exceeded"
    assert "commit" not in w["peer"].calls
    _k1(w["db"])


def test_capability_missing_or_switch_off_refuses_before_anything_is_written(world, monkeypatch):
    w = world
    w["peer"].capability = None
    with pytest.raises(br.RotationRefused) as exc:
        w["engine"].start(None, "routine")
    assert exc.value.code == "peer_unavailable" and _keys(w["db"]) == {}
    w["peer"].capability = peers.CAPABILITY
    monkeypatch.setattr(br, "GO_LIVE_PERMITTED", False)
    with pytest.raises(br.RotationRefused) as exc:
        w["engine"].start(None, "routine")
    assert exc.value.code == "rotation_not_permitted"
    monkeypatch.setattr(br, "GO_LIVE_PERMITTED", True)
    with w["db"].connection() as conn:
        set_setting(conn, br.FLAG_KEY, "off")
    with pytest.raises(br.RotationRefused) as exc:
        w["engine"].start(None, "routine")
    assert exc.value.code == "rotation_off" and not w["peer"].calls


def test_not_paired_is_refused(world):
    w = world
    with w["db"].connection() as conn:
        conn.execute("DELETE FROM settings WHERE key = 'bridge.secret'")
    with pytest.raises(br.RotationRefused) as exc:
        w["engine"].start(None, "routine")
    assert exc.value.code == "not_paired"


def test_one_rotation_at_a_time(world):
    w = world
    w["engine"].start(None, "routine")  # left in `switched` (overlap running)
    with pytest.raises(br.RotationRefused) as exc:
        w["engine"].start(None, "routine")
    assert exc.value.code == "rotation_in_progress"


# ================================================================ the commit's outcome lost (R2), dead peer, after-switch rejection (R3)

def test_commit_landed_but_answer_lost_recovers_forward(world):
    w = world
    w["peer"].fail["commit"] = "drop_after"
    rot = w["engine"].start(None, "routine")
    assert rot["state"] == "switched"  # the status call said `committed`
    assert _current(w["db"], w["settings"].data_dir).kid == rot["kid_to"] == w["peer"].signing
    _k1(w["db"])


def test_commit_lost_before_it_landed_rolls_back(world):
    w = world
    w["peer"].fail["commit"] = "drop"
    rot = w["engine"].start(None, "routine")
    assert rot["state"] == "rolled_back" and rot["result_code"] == "commit_not_applied"
    assert w["peer"].signing == "g0-legacy" and _current(w["db"], w["settings"].data_dir).kid == "g0-legacy"
    _k1(w["db"])


def test_dead_peer_after_commit_goes_needs_repair_past_the_cap_then_repairs(world):
    w = world
    w["peer"].fail["commit"] = "drop_after"
    w["peer"].fail["status"] = "drop"
    rot = w["engine"].start(None, "routine")
    assert rot["state"] == "switching"  # outcome unknown; Arx still signs with the old key, both keys stay sealed
    assert _current(w["db"], w["settings"].data_dir).kid == "g0-legacy"
    ks = _keys(w["db"])
    assert ks[rot["kid_to"]]["value_enc"] and ks["g0-legacy"]["value_enc"]
    w["clock"].advance(181)
    rot = w["engine"].tick()
    assert rot["state"] == "needs_repair" and rot["result_code"] == "commit_outcome_unknown"
    with pytest.raises(br.RotationRefused) as exc:
        w["engine"].start(None, "routine")
    assert exc.value.code == "repair_required"
    # the peer is back. It signs with next only (its cap kept `next`); Arx still signs with the old key, which the peer no longer
    # accepts - the repair asks under Arx's current key, gets nothing it can verify, and the rotation stays needs_repair (re-pair)
    w["peer"].fail.clear()
    assert w["engine"].resume(rot["id"])["state"] == "needs_repair"
    _k1(w["db"])


def test_needs_repair_aligns_when_the_peer_still_answers_under_the_old_key(world):
    w = world
    w["peer"].fail["commit"] = "drop"  # never landed
    w["peer"].fail["status"] = "drop"
    rot = w["engine"].start(None, "routine")
    assert rot["state"] == "switching"
    w["clock"].advance(181)
    assert w["engine"].tick()["state"] == "needs_repair"
    w["peer"].fail.clear()
    rot = w["engine"].resume(rot["id"])
    assert rot["state"] == "rolled_back" and rot["result_code"] == "aligned_to_current"
    assert _keys(w["db"])[rot["kid_to"]]["state"] == "discarded"
    _k1(w["db"])


def test_peer_rejects_the_new_key_after_the_switch_switches_back(world):
    w = world
    state = {"committed": False}
    orig = w["peer"]._op_commit

    def commit(kid, msg):
        state["committed"] = True
        return orig(kid, msg)

    w["peer"]._op_commit = commit
    w["peer"].reject_probe = lambda kid: state["committed"] and kid != "g0-legacy"
    rot = w["engine"].start(None, "routine")
    assert rot["state"] == "rolled_back" and rot["result_code"].startswith("post_switch_probe_failed")
    assert _current(w["db"], w["settings"].data_dir).kid == "g0-legacy" == w["peer"].signing
    assert _keys(w["db"])[rot["kid_to"]]["state"] == "discarded"
    _k1(w["db"])


def test_hard_cut_rejected_after_switch_cannot_go_back_and_needs_repair(world):
    w = world
    state = {"committed": False}
    orig = w["peer"]._op_commit

    def commit(kid, msg):
        state["committed"] = True
        return orig(kid, msg)

    w["peer"]._op_commit = commit
    w["peer"].reject_probe = lambda kid: state["committed"]
    rot = w["engine"].start(None, "hard_cut")
    assert rot["state"] == "needs_repair"
    _k1(w["db"])


def test_retire_refused_by_the_peer_is_reported_and_verification_fails_honestly(world):
    w = world
    w["peer"].fail["retire"] = "reject"
    rot = w["engine"].start(None, "routine")
    w["clock"].advance(91)
    rot = w["engine"].tick()
    assert rot["peer_retire_ok"] == 0 and rot["state"] == "verify_failed" and rot["result_code"] == "old_key_not_rejected"
    assert _keys(w["db"])["g0-legacy"]["state"] == "retired"  # Arx wiped it anyway at the deadline
    _k1(w["db"])


# ================================================================ expired window, crash recovery, partial rollout, restore

def test_expired_overlap_window_is_refused_even_before_the_retire_step(world):
    w = world
    rot = w["engine"].start(None, "routine")
    old_msg = w["peer"].sign({"m": 1}, kid="g0-legacy")
    w["clock"].advance(91)  # no tick: the retire step has not run
    assert _keys(w["db"])["g0-legacy"]["state"] == "retiring"
    # H-02: a re-timed old message no longer authenticates - one wire code; a message really signed now with the old key is expired
    assert _code(w, old_msg | {"ts": int(w["clock"]())}) == "bad_signature"
    assert _code(w, bk.sign_with("g0-legacy", LEGACY, {"m": 2}, ts=int(w["clock"]()))) == "key_expired"
    assert rot["state"] == "switched"


@pytest.mark.parametrize("crash_in", ["_confirm", "_switch"])
def test_crash_mid_rotation_partial_rollout_is_rolled_back_by_the_next_round(world, monkeypatch, crash_in):
    w = world

    def boom(self, rot):
        raise RuntimeError("simulated crash")

    monkeypatch.setattr(br.Engine, crash_in, boom)
    with pytest.raises(RuntimeError):
        w["engine"].start(None, "routine")
    monkeypatch.undo()
    monkeypatch.setattr(br, "GO_LIVE_PERMITTED", True)
    assert w["peer"].next is not None  # partial rollout: the peer holds next, Arx crashed
    rot = w["engine"].tick()
    assert rot["state"] == "rolled_back" and rot["result_code"] == "interrupted"
    assert w["peer"].next is None and w["peer"].signing == "g0-legacy"
    _k1(w["db"])


def test_crash_after_the_switch_finishes_on_the_next_round(world, monkeypatch):
    w = world
    monkeypatch.setattr(br.Engine, "_after_switch", lambda self, rot: rot)
    rot = w["engine"].start(None, "routine")
    assert rot["state"] == "switched"
    w["clock"].advance(91)
    assert w["engine"].tick()["state"] == "verified"


def test_restore_keeps_the_live_keys_and_rolls_back_a_rotation_in_flight(world, monkeypatch):
    w = world
    w["engine"].start(None, "hard_cut")
    gen1 = _current(w["db"], w["settings"].data_dir)
    with w["db"].connection() as conn:
        entry = backup.create(w["settings"], conn, "manual", include_access=False)
    w["engine"].start(None, "hard_cut")
    gen2 = _current(w["db"], w["settings"].data_dir)
    monkeypatch.setattr(br.Engine, "_confirm", lambda self, rot: (_ for _ in ()).throw(RuntimeError("crash")))
    with pytest.raises(RuntimeError):
        w["engine"].start(None, "routine")
    monkeypatch.undo()
    monkeypatch.setattr(br, "GO_LIVE_PERMITTED", True)
    path = backup.backups_dir(w["settings"]) / entry["name"]
    import zipfile

    with zipfile.ZipFile(path) as z:
        names = z.namelist()
        assert not any("bridge_keys" in n or "bridge_rotations" in n for n in names)
        settings_rows = json.loads(z.read("data/settings.json").decode("utf-8"))
        assert not {r["key"] for r in settings_rows} & {"bridge.secret", br.FLAG_KEY, br.REMINDER_KEY}
    with w["db"].connection() as conn:
        backup.restore(w["settings"], conn, path, mode="replace", scope="project")
    assert _current(w["db"], w["settings"].data_dir).kid == gen2.kid != gen1.kid  # never an older generation back
    rot = w["engine"].tick()
    assert rot["state"] == "rolled_back" and rot["result_code"] == "restore"
    with w["db"].connection(mode="read") as conn:
        assert br.mode(conn) == "on"
    assert {"bridge_keys", "bridge_rotations"} <= backup.NEVER_EXPORTED_TABLES and {br.FLAG_KEY, br.REMINDER_KEY} <= backup.SETTINGS_KEEP


def test_reminder_is_passive_and_off_by_default(world):
    w = world
    w["engine"].start(None, "hard_cut")
    with w["db"].connection() as conn:
        assert br.reminder_days(conn) == 0 and br.reminder_due(conn) is False
        set_setting(conn, br.REMINDER_KEY, "30")
        assert br.reminder_due(conn) is False
        assert br.reminder_due(conn, now=time.time() + 31 * 86400) is True
        set_setting(conn, br.REMINDER_KEY, "7")  # not an allowed value
        assert br.reminder_days(conn) == 0
    n = len(w["peer"].calls)
    assert w["engine"].tick() is None and len(w["peer"].calls) == n  # nothing starts a rotation by itself


# ================================================================ admin API and RBAC

def test_api_rbac_system_administrator_only(world, settings):
    w = world
    c = w["c"]
    with w["db"].connection() as conn:
        conn.execute("INSERT INTO custom_roles(id, name_he, permissions_json, created_at, updated_at) VALUES ('cfg_x', 'cfg_x', ?, ?, ?)",
                     (json.dumps(["system.configure"]), now_iso(), now_iso()))
    c.get("/api/v1/me", headers=as_user("cfgu"))
    bind(c, settings, "cfgu", "cfg_x", "installation", "*")
    c.get("/api/v1/me", headers=as_user("vera"))
    bind(c, settings, "vera", "viewer", "installation", "*")
    for method, path, body in (("GET", API, None), ("PUT", f"{API}/settings", {"reminder_days": 30})):
        r = c.request(method, path, json=body, headers=as_user("cfgu"))
        assert r.status_code == 403 and r.json()["code"] == "not_system_admin", r.text
        r = c.request(method, path, json=body, headers=as_user("vera"))
        assert r.status_code == 403, r.text
    # HMACACT2-295: starting / resuming needs the dedicated permission, which system.configure does not carry
    for method, path, body in (("POST", f"{API}/rotations", {"mode": "routine", "confirm": True}), ("POST", f"{API}/rotations/x/resume", None)):
        for user in ("cfgu", "vera"):
            r = c.request(method, path, json=body, headers=as_user(user))
            assert r.status_code == 403 and r.json()["details"]["permission"] == "bridge.key.rotate", r.text
    with w["db"].connection(mode="read") as conn:
        assert conn.execute("SELECT COUNT(*) FROM audit_log WHERE decision = 'denied' AND reason = 'not_system_admin' AND actor_username = 'cfgu'").fetchone()[0] == 2
        assert conn.execute("SELECT COUNT(*) FROM audit_log WHERE decision = 'denied' AND action = 'bridge.key.rotate' AND actor_username IN ('cfgu', 'vera')").fetchone()[0] == 4
    assert not w["peer"].calls and _keys(w["db"]) == {}


def test_rotate_permission_is_registered_like_the_other_system_permissions(world):
    """HMACACT2-295 (CR-034 section 7): `bridge.key.rotate` is sensitive, installation scope, held by the built-in system_admin and by no
    other built-in role, a SYSTEM permission (never in a custom role, never delegable) and gated by the second factor for a local identity."""
    from smplwise.rbac import LOCAL_ADMIN_PERMISSIONS, ROLES
    from smplwise.routers.access import PERMISSION_LABELS, SENSITIVE, SYSTEM_PERMISSIONS

    perm = "bridge.key.rotate"
    assert [r for r, perms in ROLES.items() if perm in perms] == ["system_admin"]
    assert perm in SENSITIVE and perm in SYSTEM_PERMISSIONS and perm in LOCAL_ADMIN_PERMISSIONS and PERMISSION_LABELS[perm]
    for body in ({"permissions": ["map.read", perm]}, {"permissions": ["map.read"], "sensitive": [perm]}):  # neither list can carry it
        r = world["c"].post("/api/v1/access/roles", json={"name": "מחליף מפתח", **body})
        assert r.status_code == 422 and r.json()["code"] in ("sensitive_in_permissions", "system_permission_not_allowed"), r.text
    r = world["c"].post("/api/v1/access/roles", json={"name": "מחליף מפתח", "permissions": ["map.read"], "sensitive": [perm]})
    assert r.json()["code"] == "system_permission_not_allowed", r.text


def test_api_switch_is_refused_without_the_go_live_permit(world, monkeypatch):
    w = world
    c = w["c"]
    monkeypatch.setattr(br, "GO_LIVE_PERMITTED", False)
    with w["db"].connection() as conn:
        set_setting(conn, br.FLAG_KEY, "off")
    r = c.put(f"{API}/settings", json={"enabled": True})
    assert r.status_code == 409 and r.json()["code"] == "rotation_not_permitted"
    r = c.get(API)
    assert r.status_code == 200 and r.json()["enabled"] is False and r.json()["blocked_by"] == "rotation_off" and r.json()["go_live_permitted"] is False
    r = c.post(f"{API}/rotations", json={"mode": "routine", "confirm": True})
    assert r.status_code == 409 and r.json()["code"] == "rotation_off"
    assert c.put(f"{API}/settings", json={"enabled": False, "reminder_days": 90}).json()["reminder_days"] == 90
    r = c.put(f"{API}/settings", json={"reminder_days": 7})
    assert r.status_code == 422


def test_api_full_rotation_against_the_fake_peer(world, monkeypatch):
    w = world
    c = w["c"]
    # the router builds its own engine with the real clock and the installed peer
    w["peer"].clock = time.time
    r = c.post(f"{API}/rotations", json={"mode": "routine", "confirm": False})
    assert r.status_code == 422
    r = c.post(f"{API}/rotations", json={"mode": "hard_cut", "confirm": True})
    assert r.status_code == 200, r.text
    rot = r.json()["rotation"]
    assert rot["state"] == "verified" and rot["anchor_eligible"] is True
    v = c.get(API).json()
    assert v["key"]["kid"] == rot["kid_to"] and v["key"]["generation"] == 1 and v["key"]["readable"] is True
    assert v["last"]["id"] == rot["id"] and v["can_start"] is True
    r = c.post(f"{API}/rotations/{rot['id']}/resume")
    assert r.status_code == 200 and r.json()["rotation"]["state"] == "verified"
    assert c.post(f"{API}/rotations/nope/resume").status_code == 404


def test_api_peer_unavailable_in_this_build(world):
    w = world
    peers.set_peer_for_tests(None)  # the production peer: UnavailablePeer
    r = w["c"].post(f"{API}/rotations", json={"mode": "routine", "confirm": True})
    assert r.status_code == 409 and r.json()["code"] == "peer_unavailable"
    assert w["c"].get(API).json()["blocked_by"] == "peer_unavailable"


# ================================================================ no key material anywhere

def test_no_key_material_in_audit_logs_or_answers(world, caplog):
    w = world
    caplog.set_level(logging.DEBUG)
    answers = []
    w["peer"].clock = time.time
    answers.append(w["c"].post(f"{API}/rotations", json={"mode": "hard_cut", "confirm": True}).text)
    w["peer"].fail["begin"] = "bad_proof"
    answers.append(w["c"].post(f"{API}/rotations", json={"mode": "routine", "confirm": True}).text)
    w["peer"].fail.clear()
    answers.append(w["c"].post(f"{API}/rotations", json={"mode": "routine", "confirm": True}).text)
    answers.append(w["c"].get(API).text)
    secrets_ = set(w["peer"].keys.values()) | {LEGACY}
    with w["db"].connection(mode="read") as conn:
        for r in conn.execute("SELECT kid FROM bridge_keys WHERE value_enc IS NOT NULL"):
            secrets_.add(bk.load(conn, w["settings"].data_dir, r["kid"]).material)
        audit_text = json.dumps([dict(r) for r in conn.execute("SELECT * FROM audit_log")], ensure_ascii=False)
        rot_text = json.dumps([dict(r) for r in conn.execute("SELECT * FROM bridge_rotations")], ensure_ascii=False)
    forms = set()
    for s in secrets_:
        forms |= {s, s.encode().hex()}
    for salt in w["peer"].salts:
        forms |= {salt.hex(), base64.b64encode(salt).decode()}
    for m in w["peer"].received:
        forms |= {m["sig"], m["nonce"]}
        if "proof" in m:
            forms.add(m["proof"])
    haystack = audit_text + rot_text + caplog.text + "".join(answers)
    leaked = [f for f in forms if f and f in haystack]
    assert leaked == []
    assert "bridge.rotation.verified" in audit_text and "bridge.rotation.rolled_back" in audit_text


def test_go_live_permits_in_the_build():
    # HMACACT-295: the bridge-key permit is True (owner decision 2026-10-21, same commit as the wiring). ECCACT-295: the WisKey permits
    # were opened by the owner decision of 2026-10-21 (option A); every installation switch still defaults OFF. (integ/2111 merge.)
    assert "\nGO_LIVE_PERMITTED = True\n" in Path(br.__file__).read_text(encoding="utf-8")
    assert "\nGO_LIVE_PERMITTED = True" in Path(access_grants.__file__).read_text(encoding="utf-8")
    # Fable review 2 NO-GO: capture lease stays closed (ECCACT-295 3322ba37b).
    assert "\nGO_LIVE_PERMITTED = False" in Path(capture_lease.__file__).read_text(encoding="utf-8")
    assert isinstance(peers.UnavailablePeer().capabilities(), dict) and peers.UnavailablePeer().capabilities()["rotation"] is None


def test_only_the_worker_starts_a_rotation_by_itself():
    src = Path(br.__file__).read_text(encoding="utf-8")
    assert "threading.Timer" not in src and "Thread(" not in src
    assert src.count("engine.start(None") == 1 and "def worker_pass" in src and "auto_due(conn" in src
