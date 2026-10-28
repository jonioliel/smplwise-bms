"""HMACACT-295: the activation slice of the bridge HMAC key rotation - the key set wired into ha_bridge.sign/verify, the real bridge-side key set
(custom_components/smplwise_bridge/keyset.py) driven by the real engine, both upgrade orders, the automatic start, and one regression test per
Fable finding (H-02, H-03 text, H-04, H-05, H-07, H-09). Synthetic keys only; nothing contacts a bridge or Home Assistant."""
from __future__ import annotations

import importlib.util
import json
import re
import sys
import time
from pathlib import Path

import pytest
from fake_bridge_rotation_peer import FakePeer
from fastapi.testclient import TestClient

from smplwise.db import Database, set_setting
from smplwise.errors import ApiError
from smplwise.main import create_app
from smplwise.services import bridge_keys as bk, bridge_rotation as br, bridge_rotation_peer as peers, ha_bridge

ROOT = Path(__file__).resolve().parents[3]
BRIDGE = ROOT / "custom_components" / "smplwise_bridge"
LEGACY = "synthetic-legacy-pairing-secret-0002"


def _load(name: str):
    spec = importlib.util.spec_from_file_location(f"_sw_bridge_{name}", BRIDGE / f"{name}.py")
    mod = importlib.util.module_from_spec(spec)
    sys.modules[spec.name] = mod
    spec.loader.exec_module(mod)
    return mod


keyset_mod = _load("keyset")
signing_mod = _load("signing")  # the 0.9.4 verifier, byte for byte what an OLD bridge runs


class Clock:
    def __init__(self) -> None:
        self.t = time.time()

    def __call__(self) -> float:
        return self.t

    def advance(self, s: float) -> None:
        self.t += s


class KeySetPeer:
    """The real bridge-side key set behind the Peer interface (a JSON round trip, as the HA service call is)."""

    def __init__(self, ks) -> None:
        self.ks = ks
        self.calls: list[str] = []

    def capabilities(self):
        return self.ks.capabilities()

    def call(self, op, msg):
        self.calls.append(op)
        return json.loads(json.dumps(self.ks.handle_control(json.loads(json.dumps(msg)))))


@pytest.fixture()
def world(settings):
    bk.reset_for_tests()
    app = create_app(settings)
    c = TestClient(app)
    c.get("/api/v1/me")
    db = Database(settings.db_path)
    with db.connection() as conn:
        set_setting(conn, "bridge.secret", LEGACY)
        set_setting(conn, "bridge.paired_at", "2026-10-21T00:00:00Z")
    clock = Clock()
    ks = keyset_mod.KeySet(LEGACY, None, now=clock, mono=clock)
    peers.set_peer_for_tests(None)
    yield {"c": c, "db": db, "settings": settings, "clock": clock, "ks": ks}
    peers.set_peer_for_tests(None)
    bk.reset_for_tests()


def _engine(w, peer=None):
    return br.Engine(w["db"], w["settings"].data_dir, peer or KeySetPeer(w["ks"]), now=w["clock"], settings=w["settings"])


def _announce(w, rotation="rotation_v1"):
    body = {"users": [], "version": "0.9.5"}
    if rotation:
        body["rotation"] = rotation
    r = w["c"].post("/api/v1/ha/bridge/directory", json=w["ks"].sign(body, ts=int(time.time())))
    assert r.status_code == 200, r.text
    return r


def _bridge_peer(w):
    """The production peer class, its HA service call routed to the real key set."""
    ksp = KeySetPeer(w["ks"])
    return peers.HaServicePeer(w["db"], w["settings"], call_service=lambda settings, domain, service, data, return_response=False, timeout=0: ksp.call(data["op"], data))


def _raw_message_ok(w, msg) -> bool:
    with w["db"].connection() as conn:
        try:
            ha_bridge.verify_message(conn, msg)
            return True
        except ApiError:
            return False


# ================================================================ wiring: sign / verify / pairing

def test_unadopted_set_keeps_the_old_recipe_exactly(world):
    w = world
    with w["db"].connection() as conn:
        key = ha_bridge.signing_key(conn)
    assert key == LEGACY and not isinstance(key, ha_bridge.BridgeKey)
    msg = ha_bridge.sign(key, {"a": 1})
    assert "kid" not in msg and signing_mod.Verifier(LEGACY).verify(dict(msg)) is None
    assert _raw_message_ok(w, signing_mod.sign(LEGACY, {"x": 1}))


def test_adopting_clears_the_setting_and_keeps_signing_kidless_for_the_legacy_key(world):
    w = world
    with w["db"].write_aside() as conn:
        bk.adopt_legacy(conn, w["settings"].data_dir)
    with w["db"].connection(mode="read") as conn:
        assert conn.execute("SELECT COUNT(*) FROM settings WHERE key = 'bridge.secret'").fetchone()[0] == 0
        key = ha_bridge.signing_key(conn)
        assert ha_bridge.is_paired_secret(conn) and bk.paired_secret(conn)
    assert isinstance(key, ha_bridge.BridgeKey) and key.kid == bk.LEGACY_KID and "BridgeKey(kid=" in repr(key) and LEGACY not in repr(key)
    msg = ha_bridge.sign(key, {"a": 1})
    assert "kid" not in msg and signing_mod.Verifier(LEGACY).verify(dict(msg)) is None  # an OLD bridge still verifies it
    assert _raw_message_ok(w, signing_mod.sign(LEGACY, {"x": 1}))  # and an old bridge's message still verifies at Arx
    # pairing endpoint after adoption: the code is not shown again, a regenerate starts over
    with w["db"].write_aside() as conn:
        assert ha_bridge.ensure_pairing(conn) is None
        new = ha_bridge.ensure_pairing(conn, regenerate=True)
        assert new and new != LEGACY and not bk.adopted(conn)
        assert ha_bridge.signing_key(conn) == new
        bk.adopt_legacy(conn, w["settings"].data_dir)  # the fixed kid is free again after a re-pair
        assert bk.current(conn, w["settings"].data_dir).material == new


# ================================================================ the real bridge key set against the real engine

def test_full_rotation_real_keyset_both_directions(world):
    w, ks = world, world["ks"]
    eng = _engine(w)
    with w["db"].connection() as conn:
        set_setting(conn, br.FLAG_KEY, "on")
    rot = eng.start(None, "hard_cut")
    assert rot["state"] == "verified" and bool(rot["anchor_eligible"]) is True, rot
    assert ks.signing == rot["kid_to"] and ks.legacy is None and ks.legacy_retired and ks.legacy_wiped
    with w["db"].connection(mode="read") as conn:
        key = ha_bridge.signing_key(conn)
        assert isinstance(key, ha_bridge.BridgeKey) and key.kid == rot["kid_to"]
        assert conn.execute("SELECT COUNT(*) FROM settings WHERE key = 'bridge.secret'").fetchone()[0] == 0
    # Arx -> bridge: v2 with the kid, the bridge verifies it
    out = ha_bridge.sign(key, {"op": "x"})
    assert out["kid"] == key.kid and len(out["nonce"]) == 32 and ks.verify(dict(out)) is None
    # bridge -> Arx: v2 as well
    assert _raw_message_ok(w, ks.sign({"op": "y"}, ts=int(time.time())) | {}) is True
    # the downgrade guard holds on both sides: no kid-less message verifies any more
    old = signing_mod.sign(LEGACY, {"op": "z"})
    assert ks.verify(dict(old)) == "bad_signature" and not _raw_message_ok(w, old)


def _age_current_key(w, days: int) -> None:
    """Make the current key `days` old (the database timestamps are real time; the tests' clock only drives the engine)."""
    from datetime import datetime, timedelta, timezone

    old = (datetime.now(timezone.utc) - timedelta(days=days)).strftime("%Y-%m-%dT%H:%M:%S.%fZ")
    with w["db"].connection() as conn:
        conn.execute("UPDATE bridge_keys SET activated_at = ? WHERE state = 'current'", (old,))


def test_first_rotation_waits_for_the_click_and_later_ones_start_by_themselves(world):
    w, ks, clock = world, world["ks"], world["clock"]
    _announce(w)
    peer = _bridge_peer(w)
    # owner decision 2026-10-21 (option A): the bridge announced support, the switch is on - and still nothing starts without the click
    assert br.worker_pass(w["db"], w["settings"], peer, now=clock) is None
    assert ks.rotation is None and ks.signing == bk.LEGACY_KID
    with w["db"].connection(mode="read") as conn:
        assert conn.execute("SELECT COUNT(*) FROM bridge_keys").fetchone()[0] == 0 and ha_bridge.signing_key(conn) == LEGACY
    view = w["c"].get("/api/v1/system/bridge-key").json()
    assert view["peer_available"] is True and view["automatic"] == "awaiting_click" and view["can_start"] is True
    # the click: a system administrator starts the first rotation (the existing manual start; the worker then retires the old key)
    first = _engine(w, peer).start(None, "routine")
    assert first["state"] == "switched", first
    assert ks.old == bk.LEGACY_KID and ks.legacy is not None  # the overlap: both keys on the bridge
    clock.advance(95)
    done = br.worker_pass(w["db"], w["settings"], peer, now=clock)
    assert done["state"] == "verified", done
    assert ks.old is None and ks.legacy is None
    # nothing further while no reminder interval is configured
    assert br.worker_pass(w["db"], w["settings"], peer, now=clock) is None
    # later rotations are automatic: the interval passes -> the worker starts one by itself (audited as automatic)
    with w["db"].connection() as conn:
        set_setting(conn, br.REMINDER_KEY, "30")
    assert br.worker_pass(w["db"], w["settings"], peer, now=clock) is None  # not yet due
    _age_current_key(w, 31)
    second = br.worker_pass(w["db"], w["settings"], peer, now=clock)
    assert second and second["state"] == "switched" and second["gen_to"] == 2, second
    with w["db"].connection(mode="read") as conn:
        assert conn.execute("SELECT COUNT(*) FROM audit_log WHERE action = 'bridge.rotation.requested' AND reason = 'automatic'").fetchone()[0] == 1


def test_automatic_start_needs_the_peer_announcement_and_the_switch(world):
    w, clock = world, world["clock"]
    called: list = []
    peer = peers.HaServicePeer(w["db"], w["settings"], call_service=lambda *a, **k: called.append(a) or (_ for _ in ()).throw(RuntimeError()))
    # an old bridge: it never announces -> nothing starts, nothing is written, the channel keeps working on the legacy secret
    assert br.worker_pass(w["db"], w["settings"], peer, now=clock) is None
    with w["db"].connection(mode="read") as conn:
        assert conn.execute("SELECT COUNT(*) FROM bridge_keys").fetchone()[0] == 0 and ha_bridge.signing_key(conn) == LEGACY
    _announce(w, rotation=None)  # a verified push without the field (a 0.9.4 bridge)
    assert br.worker_pass(w["db"], w["settings"], peer, now=clock) is None
    # the switch off: never, even with the announcement
    _announce(w)
    with w["db"].connection() as conn:
        set_setting(conn, br.FLAG_KEY, "off")
    assert br.worker_pass(w["db"], w["settings"], _bridge_peer(w), now=clock) is None
    assert not called
    # the click is refused while the switch is off, and without a fresh announcement
    with pytest.raises(br.RotationRefused) as exc:
        _engine(w, _bridge_peer(w)).start(None, "routine")
    assert exc.value.code == "rotation_off"
    with w["db"].connection() as conn:
        set_setting(conn, br.FLAG_KEY, "on")
        set_setting(conn, peers.SETTING_CAP_AT, "2026-01-01T00:00:00Z")  # a stale announcement is not believed
        assert peers.announced_capability(conn) is None
    with pytest.raises(br.RotationRefused) as exc:
        _engine(w, _bridge_peer(w)).start(None, "routine")
    assert exc.value.code == "peer_unavailable"


def test_failed_automatic_attempt_backs_off(world):
    w, clock = world, world["clock"]
    _announce(w)
    fake = FakePeer(LEGACY, clock)
    p = peers.HaServicePeer(w["db"], w["settings"], call_service=lambda s, d, sv, data, return_response=False, timeout=0: fake.call(data["op"], data))
    assert _engine(w, p).start(None, "hard_cut")["state"] == "verified"  # the first rotation: the administrator's click
    with w["db"].connection() as conn:
        set_setting(conn, br.REMINDER_KEY, "30")
    _age_current_key(w, 31)
    fake.fail["begin"] = "reject"
    r = br.worker_pass(w["db"], w["settings"], p, now=clock)
    assert r and r["state"] == "rolled_back"
    fake.fail.clear()
    assert br.worker_pass(w["db"], w["settings"], p, now=clock) is None  # inside the first hour
    clock.advance(br.AUTO_RETRY_S * 2)  # real-time stamps in the database, a fake clock for the engine: leave generous slack
    r2 = br.worker_pass(w["db"], w["settings"], p, now=clock)
    assert r2 and r2["state"] == "switched"
    with w["db"].connection(mode="read") as conn:
        assert conn.execute("SELECT COUNT(*) FROM audit_log WHERE action = 'bridge.rotation.requested' AND reason = 'automatic'").fetchone()[0] == 2


def test_default_switch_is_on_and_off_is_honoured(world):
    w = world
    with w["db"].connection() as conn:
        assert br.mode(conn) == "on"
        set_setting(conn, br.FLAG_KEY, "off")
        assert br.mode(conn) == "off"
    v = w["c"].get("/api/v1/system/bridge-key").json()
    assert v["enabled"] is False and v["go_live_permitted"] is True and v["automatic"] == "off"


# ================================================================ upgrade order (the bridge and Arx updated at different times)

def test_arx_updated_first_old_bridge_keeps_working_and_nothing_rotates(world):
    w = world
    old_bridge_verifier = signing_mod.Verifier(LEGACY)
    # an old bridge signs kid-less, announces nothing
    r = w["c"].post("/api/v1/ha/bridge/directory", json=signing_mod.sign(LEGACY, {"users": [], "version": "0.9.4"}))
    assert r.status_code == 200
    answer = r.json()["cast"]  # Arx's reply to the push is verified by the old bridge's Verifier
    assert old_bridge_verifier.verify(dict(answer)) is None
    with w["db"].connection(mode="read") as conn:
        assert peers.announced_capability(conn) is None
    view = w["c"].get("/api/v1/system/bridge-key").json()
    assert view["peer_available"] is False and view["blocked_by"] == "peer_unavailable" and view["automatic"] == "waiting_for_bridge"
    r = w["c"].post("/api/v1/system/bridge-key/rotations", json={"mode": "routine", "confirm": True})
    assert r.status_code == 409 and r.json()["code"] == "peer_unavailable"
    with w["db"].connection(mode="read") as conn:
        assert conn.execute("SELECT COUNT(*) FROM bridge_keys").fetchone()[0] == 0  # nothing adopted, nothing wiped


def test_bridge_updated_first_old_arx_keeps_working(world):
    w, ks = world, world["ks"]
    # the new bridge signs kid-less while its signing key is the pairing secret, with the extra `rotation` field: the OLD Arx function accepts it
    msg = ks.sign({"users": [], "version": "0.9.5", "rotation": "rotation_v1"}, ts=int(time.time()))
    assert "kid" not in msg
    ha_bridge.verify(LEGACY, dict(msg))
    # and the new bridge verifies what the OLD Arx signs
    assert ks.verify(ha_bridge.sign(LEGACY, {"op": "x"})) is None
    # the new bridge does not rotate by itself and the (new) Arx has not been told anything: no `begin` came, state is untouched
    assert ks.rotation is None and ks.signing == bk.LEGACY_KID


def test_both_updated_in_the_middle_of_a_restart_the_bridge_state_survives(world):
    w, clock = world, world["clock"]
    ks = w["ks"]
    eng = _engine(w)
    rot = eng.start(None, "routine")
    assert rot["state"] == "switched"
    saved = json.loads(json.dumps(ks.state()))
    ks2 = keyset_mod.KeySet(LEGACY, saved, now=clock, mono=clock)  # the bridge restarted
    assert ks2.signing == rot["kid_to"] and ks2.old == bk.LEGACY_KID
    clock.advance(95)
    w["ks"] = ks2
    done = _engine(w).tick()
    assert done["state"] == "verified" and ks2.old is None


# ================================================================ the bridge side on its own

def test_hkdf_matches_the_add_on_and_the_bridge_files_are_mirrored():
    salt = bytes(range(32))
    assert keyset_mod.derive_next("k-cur", salt, "g1-0000abcd", 1) == bk.derive_next("k-cur", salt, "g1-0000abcd", 1)
    mirror = ROOT / "smplwise_vms" / "integration" / "smplwise_bridge"
    assert (mirror / "keyset.py").read_bytes() == (BRIDGE / "keyset.py").read_bytes()
    assert json.loads((BRIDGE / "manifest.json").read_text())["version"] == "0.10.1"


def test_bridge_cap_hard_cut_and_restart_cap():
    clock = Clock()
    ks = keyset_mod.KeySet("L", None, now=clock, mono=clock)
    fake_arx_kid = "g1-0badc0de"
    salt = b"\x07" * 32
    body = {"protocol": keyset_mod.PROTOCOL, "op": "begin", "rotation_id": "r1", "kid_next": fake_arx_kid, "gen_next": 1,
            "salt": __import__("base64").b64encode(salt).decode(), "overlap_s": 90, "mode": "routine"}
    ans = ks.handle_control(bk.sign_with("g0-legacy", "L", body, ts=int(clock())))
    assert ans["ok"] is True and ks.next == fake_arx_kid
    saved = json.loads(json.dumps(ks.state()))
    clock.advance(100)
    restarted = keyset_mod.KeySet("L", saved, now=clock, mono=clock)  # the cap survives a restart through the wall clock
    assert restarted.next == fake_arx_kid
    clock.advance(100)
    after = keyset_mod.KeySet("L", saved, now=clock, mono=clock)
    assert after.next is None and fake_arx_kid not in after.keys  # 200 s since begin: `next` is gone


def test_bridge_kidless_downgrade_guard_and_unknown_kid_collapse():
    clock = Clock()
    ks = keyset_mod.KeySet("L", {"v": 1, "signing": "g1-0badc0de", "keys": {"g1-0badc0de": "K1"}, "old": "g0-legacy", "next": None, "legacy_retired": False,
                                 "rotation": {"id": "r", "t0_wall": clock(), "committed": True, "closed": False, "mode": "routine", "overlap_s": 90}, "hw": {}},
                          now=clock, mono=clock)
    ok = signing_mod.sign("L", {"a": 1}, ts=int(clock()), nonce="n1")
    assert ks.verify(dict(ok)) is None  # the overlap: still accepted
    clock.advance(200)
    assert ks.verify(signing_mod.sign("L", {"a": 2}, ts=int(clock()), nonce="n2")) == "bad_signature"
    for kid in ("g7-deadbeef", "g1-0badc0de"):  # unknown kid / right kid, wrong key: the same code
        m = bk.sign_with(kid, "wrong", {"a": 1}, ts=int(clock()))
        assert ks.verify(m) == "bad_signature"


def test_bridge_highwater_survives_a_restart():
    clock = Clock()
    ks = keyset_mod.KeySet("L", None, now=clock, mono=clock)
    m = signing_mod.sign("L", {"a": 1}, ts=int(clock()), nonce="abc")
    assert ks.verify(dict(m)) is None and ks.dirty
    again = keyset_mod.KeySet("L", json.loads(json.dumps(ks.state())), now=clock, mono=clock)
    assert again.verify(dict(m)) == "replay"  # nonce cache is empty after the restart; the persisted high-water refuses it
    clock.advance(5)
    assert again.verify(signing_mod.sign("L", {"a": 1}, ts=int(clock()), nonce="abd")) is None


def test_policies_accept_a_kid_on_the_wire():
    for name in ("cast_policy", "stream_source_service", "media_query_service", "config_policy", "schedule_policy"):
        src = (BRIDGE / f"{name}.py").read_text(encoding="utf-8")
        assert '"kid"' in src, name
    assert src.count('"kid"') >= 1
    assert (BRIDGE / "__init__.py").read_text(encoding="utf-8").count('vol.Optional("kid")') == 7


# ================================================================ H-02 .. H-09 regressions

def test_h02_every_refusal_before_the_mac_is_one_wire_code_and_stale_comes_after_the_mac(world):
    w = world
    with w["db"].write_aside() as conn:
        bk.adopt_legacy(conn, w["settings"].data_dir)
        bk.insert(conn, w["settings"].data_dir, kid="g1-0000abcd", generation=1, state="pending", material="k-p", rotation_id=None)
        bk.insert(conn, w["settings"].data_dir, kid="g2-0000abcd", generation=2, state="retiring", material="k-r", rotation_id=None)
        bk.set_state(conn, "g2-0000abcd", "retiring", verify_until="2000-01-01T00:00:00.000000Z")
    now = int(w["clock"]())
    wire = set()
    for kid, material in (("g9-12345678", "x"), ("g1-0000abcd", "wrong"), ("g2-0000abcd", "wrong"), ("g0-legacy", "wrong")):
        for ts in (now, now - 3600):  # a stale timestamp under a wrong key must NOT reveal "stale"
            with w["db"].connection(mode="read") as conn:
                with pytest.raises(bk.VerifyError) as exc:
                    bk.verify(conn, w["settings"].data_dir, bk.sign_with(kid, material, {"a": 1}, ts=ts), now=now)
            wire.add(exc.value.code)
    assert wire == {"bad_signature"}
    # and over HTTP the route answers one code for all of them
    r = w["c"].post("/api/v1/ha/bridge/directory", json=bk.sign_with("g9-12345678", "x", {"users": []}))
    assert r.status_code == 401 and r.json()["code"] == "bridge_bad_signature"
    # only a message that proved the key may hear "stale"
    with w["db"].connection(mode="read") as conn:
        with pytest.raises(bk.VerifyError) as exc:
            bk.verify(conn, w["settings"].data_dir, bk.sign_with("g0-legacy", LEGACY, {"a": 1}, ts=now - 3600), now=now)
    assert exc.value.code == "stale"


def test_h03_the_hygiene_not_recovery_text_is_in_the_card_the_cr_and_the_guide():
    root = ROOT
    assert "re-pair" in (root / "docs/changes/CR-WISKEY-HMAC-ROTATION-295.md").read_text(encoding="utf-8")
    fe = (root / "frontend/src/i18n/bridge-key.ts").read_text(encoding="utf-8")
    assert fe.count("hygiene") >= 1 and fe.count("hygieneNote") >= 4
    guides = list((root / "docs/user-guide").rglob("*bridge-key*")) + list((root / "docs/user-guide").rglob("*BRIDGE_KEY*"))
    assert guides and all("re-pair" in g.read_text(encoding="utf-8").lower() or "צימוד מחדש" in g.read_text(encoding="utf-8") for g in guides)


def test_h04_replay_after_a_restart_is_refused_by_the_persisted_highwater(world):
    w = world
    with w["db"].write_aside() as conn:
        bk.adopt_legacy(conn, w["settings"].data_dir)
    now = int(time.time())
    m = bk.sign_with("g0-legacy", LEGACY, {"a": 1}, ts=now)
    with w["db"].write_aside() as conn:
        assert bk.verify(conn, w["settings"].data_dir, m, now=now) == "g0-legacy"
    with w["db"].connection(mode="read") as conn:
        assert conn.execute("SELECT hw_ts FROM bridge_keys WHERE kid = 'g0-legacy'").fetchone()[0] == now
    bk.reset_for_tests()  # a restart: empty nonce cache, no boot marks
    with w["db"].write_aside() as conn:
        with pytest.raises(bk.VerifyError) as exc:
            bk.verify(conn, w["settings"].data_dir, m, now=now)
    assert exc.value.code == "replay" and exc.value.detail == "replay_highwater"
    with w["db"].write_aside() as conn:  # a fresh message after the restart is fine
        assert bk.verify(conn, w["settings"].data_dir, bk.sign_with("g0-legacy", LEGACY, {"a": 2}, ts=now + 2), now=now + 2) == "g0-legacy"


class _LyingCommitPeer(FakePeer):
    """Never switches, but answers `commit` ok and claims `committed` in `status` - necessarily signed under the OLD key (H-09)."""

    def _op_commit(self, kid, msg):
        return self._answer("commit", msg, True)

    def _op_status(self, kid, msg):
        return self._answer("status", msg, True, rotation="committed", active_kid=self.signing, old_key_present=False)


def test_h09_commit_answer_signed_under_the_old_key_is_not_believed(world):
    w, clock = world, world["clock"]
    rot = _engine(w, _LyingCommitPeer(LEGACY, clock)).start(None, "routine")
    assert rot["state"] == "switching", rot  # no answer is trusted: the outcome stays unknown, Arx keeps signing with K_cur
    with w["db"].connection(mode="read") as conn:
        assert bk.current(conn, w["settings"].data_dir).kid == bk.LEGACY_KID
        assert conn.execute("SELECT state FROM bridge_keys WHERE kid = ?", (rot["kid_to"],)).fetchone()[0] == "next"


def test_h09_probe_answers_must_come_from_the_expected_key(world):
    w, clock = world, world["clock"]

    class WrongProbe(FakePeer):
        def _answer(self, op, msg, ok, **fields):
            if op == "probe" and self.next and self.signing == "g0-legacy" and msg.get("kid") != "g0-legacy":
                body = {"protocol": "smplwise-bridge-rotation-v1", "op": op, "rotation_id": msg.get("rotation_id"), "reply_to": msg.get("nonce"), "ok": ok, **fields}
                return self.sign(body, kid=self.next)  # a pre-switch answer under K_next: not what a peer on K_cur does
            return super()._answer(op, msg, ok, **fields)

    rot = _engine(w, WrongProbe(LEGACY, clock)).start(None, "routine")
    assert rot["state"] == "rolled_back" and rot["result_code"].startswith("probe_next_failed:peer_bad_answer"), rot


def test_h05_repair_does_not_retire_k_cur_on_the_peers_word_alone(world):
    w, clock = world, world["clock"]
    peer = FakePeer(LEGACY, clock)
    eng = _engine(w, peer)
    peer.fail["commit"] = "drop_after"
    peer.fail["status"] = "drop"
    rot = eng.start(None, "routine")
    assert rot["state"] == "switching"
    # make the rotation need repair, with a peer that now CLAIMS to be on K_next but cannot answer a probe under it
    with w["db"].write_aside() as conn:
        conn.execute("UPDATE bridge_rotations SET state = 'needs_repair' WHERE id = ?", (rot["id"],))
    peer.fail.clear()
    peer.reject_probe = lambda kid: kid == rot["kid_to"]
    out = eng.resume(rot["id"])
    assert out["state"] == "needs_repair"
    with w["db"].connection(mode="read") as conn:
        states = {r["kid"]: r["state"] for r in conn.execute("SELECT kid, state FROM bridge_keys")}
    assert states[bk.LEGACY_KID] == "current" and states[rot["kid_to"]] == "next"  # K_cur untouched, K_next kept
    peer.reject_probe = None
    out = eng.resume(rot["id"])
    assert out["state"] == "retired" and out["result_code"] == "aligned_to_next"


def test_h07_a_retired_keys_sealed_blob_is_not_left_in_the_database_or_the_wal(world):
    w, clock = world, world["clock"]
    eng = _engine(w)
    first = eng.start(None, "routine")
    with w["db"].connection(mode="read") as conn:
        blob = conn.execute("SELECT value_enc FROM bridge_keys WHERE kid = ?", (first["kid_from"],)).fetchone()[0]
    assert blob and len(blob) > 20
    clock.advance(95)
    assert eng.tick()["state"] == "verified"
    data = b"".join(p.read_bytes() for p in (w["settings"].db_path, Path(str(w["settings"].db_path) + "-wal")) if p.exists())
    assert blob.encode() not in data
    assert LEGACY.encode() not in data  # the plaintext secret was never written, and the setting is gone


def test_no_key_material_in_audit_logs_after_an_activation_run(world, caplog):
    w = world
    caplog.set_level("DEBUG")
    _engine(w).start(None, "hard_cut")
    with w["db"].connection(mode="read") as conn:
        text = json.dumps([dict(r) for r in conn.execute("SELECT * FROM audit_log")]) + json.dumps([dict(r) for r in conn.execute("SELECT * FROM bridge_rotations")])
    ks = w["ks"]
    bad = [v for v in [LEGACY, *ks.keys.values()] if v in text or v in caplog.text]
    assert bad == []
    assert re.search(r"bridge\.rotation\.verified", text)


# ================================================================ Fable review 2: HA-01

def test_ha01_the_bridge_never_signs_a_refusal_of_an_unverified_message():
    clock = Clock()
    ks = keyset_mod.KeySet("L", None, now=clock, mono=clock)
    hostile = [
        {"protocol": "smplwise-bridge-rotation-v1", "op": "status", "rotation_id": "r1", "users": [], "x": "chosen body"},
        {"protocol": "smplwise-bridge-rotation-v1", "op": "probe", "rotation_id": "r1", "kid": "g0-legacy", "ts": int(clock()), "nonce": "a" * 32, "sig": "0" * 64},
        {"protocol": "smplwise-bridge-rotation-v1", "op": "begin", "rotation_id": "r1", "kid": "g9-deadbeef", "ts": int(clock()), "nonce": "b" * 32, "sig": "1" * 64},
        "not a dict", None, {},
    ]
    for m in hostile:
        ans = ks.handle_control(m)
        assert ans["ok"] is False and ans["code"] in ("bad_signature", "bad_format")
        assert not ({"sig", "kid", "nonce", "ts"} & set(ans)), ans  # nothing signed, nothing echoed
        assert "chosen body" not in json.dumps(ans)
    # an authenticated malformed request is still answered (signed), because the sender proved the key
    good = bk.sign_with("g0-legacy", "L", {"protocol": "other", "op": "probe", "rotation_id": "r"}, ts=int(clock()))
    assert ks.handle_control(good)["code"] == "bad_request"


def test_ha01_the_directory_route_refuses_control_bodies_and_non_list_users(world):
    w = world
    c = w["c"]
    with w["db"].connection() as conn:
        conn.execute("INSERT OR IGNORE INTO users(id, username, display_name, active, source, first_seen_at, last_seen_at) VALUES ('opuser1', 'op', 'Op', 1, 'ingress', '2026-10-21T00:00:00Z', '2026-10-21T00:00:00Z')")
    for body in ({"protocol": "smplwise-bridge-rotation-v1", "op": "status", "rotation_id": "r1"},
                 {"version": "0.9.5"},  # no users list at all
                 {"users": None}, {"users": {"a": 1}}, {"users": [], "op": "probe"}):
        r = c.post("/api/v1/ha/bridge/directory", json=signing_mod.sign(LEGACY, body))
        assert r.status_code == 422 and r.json()["code"] == "bridge_bad_request", (body, r.text)
    with w["db"].connection(mode="read") as conn:
        assert conn.execute("SELECT active FROM users WHERE id = 'opuser1'").fetchone()[0] == 1  # nobody was deactivated
    assert c.post("/api/v1/ha/bridge/directory", json=signing_mod.sign(LEGACY, {"users": [], "version": "0.9.5"})).status_code == 200


def test_ha02_the_three_repair_situations_are_documented():
    guide = (ROOT / "docs/user-guide/he/84-bridge-key_HE.md").read_text(encoding="utf-8")
    cr = (ROOT / "docs/changes/CR-WISKEY-HMAC-ROTATION-295.md").read_text(encoding="utf-8")
    for needle in ("שחזור לגיבוי", "אובדן קובץ המפתחות", "החלפה שבוטלה"):
        assert needle in guide, needle
    assert "HA-02" in cr and "pre-rotation backup" in cr


# ================================================================ Fable review 2: HA-04, HA-05, HA-06

RETIRED = {"v": 1, "signing": "g1-0badc0de", "keys": {"g1-0badc0de": "K1"}, "old": None, "next": None, "legacy_retired": True, "rotation": None, "hw": {}}


class _Entry:
    """The config entry's pairing-code copy and the Store, as the bridge's __init__ hands them to the Persister."""

    def __init__(self, code: str, fail_saves: int = 0) -> None:
        self.code, self.fail_saves, self.saved, self.wipes, self.tasks = code, fail_saves, [], 0, []

    async def save(self, state):
        if self.fail_saves:
            self.fail_saves -= 1
            raise OSError("disk full")
        self.saved.append(json.loads(json.dumps(state)))

    def wipe(self) -> None:
        self.code, self.wipes = "", self.wipes + 1

    def persister(self, ks, errors=None):
        async def no_wait(_s: float) -> None:
            return None

        return keyset_mod.Persister(ks, self.save, lambda: self.code, self.wipe, self.tasks.append, sleep=no_wait,
                                    on_error=(errors.append if errors is not None else None))

    def run_tasks(self) -> None:
        import asyncio

        while self.tasks:
            asyncio.run(self.tasks.pop(0))


def test_ha04_a_failed_delayed_save_keeps_the_set_dirty_and_is_retried():
    import asyncio

    clock = Clock()
    ks = keyset_mod.KeySet("L", None, now=clock, mono=clock)
    entry, errors = _Entry("L", fail_saves=1), []
    saver = entry.persister(ks, errors)
    assert ks.verify(bk.sign_with("g0-legacy", "L", {"op": "x"}, ts=int(clock()))) is None and ks.dirty, "a new high-water mark"
    saver.save_soon()
    saver.save_soon()
    assert len(entry.tasks) == 1, "one delayed save at a time"
    assert ks.dirty, "not marked clean before the save happened"
    entry.run_tasks()
    assert ks.dirty and entry.saved == [] and len(errors) == 1, "the save failed: still dirty, reported"
    saver.save_soon()  # the next message
    entry.run_tasks()
    assert not ks.dirty and entry.saved[-1]["hw"]["g0-legacy"] == int(clock())
    # the periodic housekeeping path (persist) is a no-op once clean
    asyncio.run(saver.persist())
    assert len(entry.saved) == 1


def test_ha04_the_bridge_init_marks_clean_only_through_the_persister():
    for root in (BRIDGE, ROOT / "smplwise_vms" / "integration" / "smplwise_bridge"):
        text = (root / "__init__.py").read_text(encoding="utf-8")
        assert "keyset.dirty = False" not in text and "async_delay_save" not in text
        # screened services, the lease services, and (KEYROT-FIX-295 K-02) the fresh key set after a re-pair through discovery
        assert text.count("saver.save_soon()") == 3 and "saver.clean_entry()" in text


def test_ha05_an_oversized_rotation_id_is_refused_before_the_signature():
    clock = Clock()
    ks = keyset_mod.KeySet("L", None, now=clock, mono=clock)
    for rid in ("r" * 65, "", None, 7):
        msg = bk.sign_with("g0-legacy", "L", {"protocol": keyset_mod.PROTOCOL, "op": "status", "rotation_id": rid}, ts=int(clock()))
        assert ks.handle_control(msg) == {"ok": False, "code": "bad_format"}, rid
    assert ks.hw == {} and not ks.dirty and ks._seen == {}, "never reached the MAC, the replay cache or the high-water mark"
    ok = bk.sign_with("g0-legacy", "L", {"protocol": keyset_mod.PROTOCOL, "op": "status", "rotation_id": "r" * 64}, ts=int(clock()))
    assert ks.handle_control(ok)["ok"] is True
    text = (BRIDGE / "__init__.py").read_text(encoding="utf-8")
    assert 'vol.Required("rotation_id"): vol.All(cv.string, vol.Length(min=1, max=64))' in text


def test_ha06_the_retired_pairing_code_is_blanked_with_the_save_and_at_setup():
    import asyncio

    clock = Clock()
    # a restart between the key save and the entry update: the saved state has retired the code, the entry still holds it
    entry = _Entry("L")
    saver = entry.persister(keyset_mod.KeySet("L", RETIRED, now=clock, mono=clock))
    assert saver.clean_entry() is True and entry.code == "" and entry.wipes == 1
    assert saver.clean_entry() is False and entry.wipes == 1, "idempotent"
    # a live retirement: never blanked before the save succeeded, blanked right after it
    ks = keyset_mod.KeySet("L", {**RETIRED, "keys": {"g1-0badc0de": "K1"}, "old": "g0-legacy", "legacy_retired": False}, now=clock, mono=clock)
    entry = _Entry("L", fail_saves=1)
    saver = entry.persister(ks)
    assert saver.clean_entry() is False, "the saved state still has the pairing secret"
    ks._drop("g0-legacy")
    with pytest.raises(OSError):
        asyncio.run(saver.persist())
    assert entry.code == "L" and ks.dirty, "the save failed: the entry keeps the code the stored state still needs"
    asyncio.run(saver.persist())
    assert entry.saved[-1]["legacy_retired"] is True and entry.code == "" and entry.wipes == 1
