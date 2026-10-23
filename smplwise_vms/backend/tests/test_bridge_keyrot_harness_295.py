"""KEYROT-HARNESS-295: the bridge key rotation proven end to end in-process - Arx's engine, key set, production peer (HaServicePeer ->
ha_client.call_service -> HA REST) against the REAL bridge integration (custom_components/smplwise_bridge: async_setup_entry, the
`rotate` handler, keyset.KeySet / Persister), unmodified. See tests/keyrot_harness.py for the stubs and the fault points.

Covers the lab run plan (docs/release/KEY_ROTATION_LAB_RUN_PLAN.md) steps 0-10 and failure cases F1-F7 without any live system:
first rotation (legacy g0 adoption), second rotation, overlap and the door-pause window, retire / verify, restarts of both sides,
R1 / R2 / R3 injections, needs_repair + resume, re-pair, and a secret scan. Tests marked xfail(strict) are FINDINGS: they assert the
behaviour the plan / guide expects and fail today (a fix turns them red as XPASS, so the marker must then be removed)."""
from __future__ import annotations

import base64
import json
import logging
import time
from pathlib import Path
from typing import Any

import pytest
from fastapi.testclient import TestClient

import keyrot_harness as kh
from fake_bridge_rotation_peer import FakePeer
from smplwise.db import Database
from smplwise.main import create_app
from smplwise.services import bridge_install, bridge_keys as bk, bridge_rotation as br, bridge_rotation_peer as peers, ha_bridge, ha_client

API = "/api/v1"
KEY_API = f"{API}/system/bridge-key"


class Lab:
    """Arx (app + database) and Home Assistant with the real bridge, one clock, one wire."""

    def __init__(self, settings: Any, monkeypatch: Any, clock: kh.Clock, rest: kh.HaRest) -> None:
        self.settings, self.monkeypatch, self.clock, self.rest = settings, monkeypatch, clock, rest
        self.boot_arx()
        r = self.c.get(f"{API}/ha/bridge/pairing")
        assert r.status_code == 200, r.text
        self.code = r.json()["pairing_code"]
        assert self.code and r.json()["key_set"] is False
        self.side = kh.BridgeSide(lambda: self.c, self.code, clock)
        rest.side = self.side
        # the config flow's pairing ping (signing.sign with the typed code), then the first directory push announces rotation_v1
        assert self.c.post(f"{API}/ha/bridge/ping", json=self.side.ping_message(self.code)).status_code == 200
        self.side.sync()
        self.paused_at: list[tuple[str, bool]] = []
        rest.before.append(self._note_pause)

    def boot_arx(self) -> None:
        """Arx starts (or restarts): a new app on the same data directory; the process-local nonce cache and boot high-water are gone."""
        bk.reset_for_tests()
        self.app = create_app(self.settings)
        self.c = TestClient(self.app)
        self.c.get(f"{API}/me")
        self.db = Database(self.settings.db_path)
        self.peer = peers.HaServicePeer(self.db, kh.ha_settings(self.settings))  # the production peer and transport
        peers.set_peer_for_tests(self.peer)

    def _note_pause(self, op: str, data: dict[str, Any]) -> None:
        if op:
            with self.db.connection(mode="read") as conn:
                self.paused_at.append((op, br.door_commands_paused(conn)))

    # ------------------------------------------------------------ helpers
    def view(self) -> dict[str, Any]:
        r = self.c.get(KEY_API)
        assert r.status_code == 200, r.text
        return r.json()

    def start(self, mode: str = "routine") -> Any:
        return self.c.post(f"{KEY_API}/rotations", json={"mode": mode, "confirm": True})

    def engine(self) -> Any:
        return br.Engine(self.db, self.settings.data_dir, self.peer)

    def paused(self) -> bool:
        with self.db.connection(mode="read") as conn:
            return br.door_commands_paused(conn)

    def keys(self) -> dict[str, dict[str, Any]]:
        with self.db.connection(mode="read") as conn:
            return {r["kid"]: dict(r) for r in conn.execute("SELECT kid, generation, state, value_enc, verify_until FROM bridge_keys")}

    def current(self) -> bk.Key:
        with self.db.connection(mode="read") as conn:
            return bk.current(conn, self.settings.data_dir)

    def audit(self, prefix: str = "bridge.") -> list[dict[str, Any]]:
        with self.db.connection(mode="read") as conn:
            return [dict(r) for r in conn.execute("SELECT action, decision, reason, details_json FROM audit_log WHERE action LIKE ? ORDER BY rowid", (prefix + "%",))]

    def actions(self, prefix: str = "bridge.") -> list[str]:
        return [a["action"] for a in self.audit(prefix)]

    def push_ok(self) -> bool:
        """The bridge's own signed directory push verifies at Arx (the real route)."""
        n = len(self.side.pushes)
        self.side.sync()
        return self.side.pushes[n]["status"] == 200

    def arx_message_verifies_at_bridge(self, kid: str | None = None, material: str | None = None) -> str | None:
        """An Arx-signed ordinary message (ha_bridge.sign with the current key, or an explicit key) -> the bridge key set's verdict."""
        if kid is None:
            with self.db.connection(mode="read") as conn:
                msg = ha_bridge.sign(ha_bridge.signing_key(conn), {"op": "x", "users": []})
        else:
            msg = bk.sign_with(kid, material, {"op": "x"})
        return self.side.ks.verify(dict(msg))

    def secret_setting(self) -> int:
        with self.db.connection(mode="read") as conn:
            return conn.execute("SELECT COUNT(*) FROM settings WHERE key = 'bridge.secret'").fetchone()[0]


@pytest.fixture()
def lab(settings, monkeypatch):
    attempts = kh.install_no_network(monkeypatch)
    clock = kh.Clock()
    monkeypatch.setattr(time, "time", clock)  # one wall clock for Arx's verifier, its signer and the bridge
    monkeypatch.setattr(br, "Engine", kh.clocked_engine(br, clock))
    br._RESTORE_SEEN.clear()
    rest = kh.HaRest()
    kh.install_rest(monkeypatch, rest)
    lab = Lab(settings, monkeypatch, clock, rest)
    yield lab
    lab.side.stop()
    peers.set_peer_for_tests(None)
    bk.reset_for_tests()
    assert attempts == [], "the harness never touches the network"


def _retire(lab: Lab, extra: float = 1.0) -> dict[str, Any]:
    """Let the overlap pass, then one status read (which ticks the engine, exactly as the card's GET does)."""
    with lab.db.connection(mode="read") as conn:
        rot = br.active_row(conn)
        until = bk.epoch_of(conn.execute("SELECT verify_until FROM bridge_keys WHERE kid = ?", (rot["kid_from"],)).fetchone()[0])
    lab.clock.advance(until - lab.clock() + extra)
    return lab.view()


# ====================================================================== the harness itself

def test_the_bridge_under_test_is_the_repository_code_unmodified():
    mod = kh.load_bridge()
    ks = kh.bridge_submodule("keyset")
    assert Path(mod.__file__).resolve() == (kh.BRIDGE_DIR / "__init__.py").resolve()
    assert Path(ks.__file__).resolve() == (kh.BRIDGE_DIR / "keyset.py").resolve()
    mirror = kh.ROOT / "smplwise_vms" / "integration" / "smplwise_bridge"
    for name in ("__init__.py", "keyset.py", "signing.py", "config_flow.py"):
        assert (mirror / name).read_bytes() == (kh.BRIDGE_DIR / name).read_bytes(), name
    import sys

    assert not any(n == "homeassistant" or n.startswith("homeassistant.") for n in sys.modules), "the HA stubs do not outlive the import"
    assert mod.SERVICE_ROTATE == "rotate" and mod.ROTATE_SCHEMA is not None


def test_step0_baseline_paired_announced_awaiting_click(lab):
    v = lab.view()
    assert (v["adopted"], v["peer_available"], v["automatic"], v["can_start"], v["blocked_by"], v["history"]) == (False, True, "awaiting_click", True, None, [])
    assert lab.side.ks.signing == bk.LEGACY_KID and lab.side.ks.rotation is None
    assert lab.side.pushes[-1]["status"] == 200 and lab.side.pushes[-1]["kid"] is None, "kid-less push while on the pairing secret"
    assert lab.secret_setting() == 1 and not lab.paused()
    assert lab.arx_message_verifies_at_bridge() is None


# ====================================================================== steps 2-8: two routine rotations through the admin route

def test_two_routine_rotations_end_to_end(lab):
    side, clock = lab.side, lab.clock
    t_click = clock()
    r = lab.start()
    assert r.status_code == 200, r.text
    rot = r.json()["rotation"]
    t_switched = clock()
    # step 2: g0-legacy -> g1, switched, every step ok
    assert (rot["state"], rot["kid_from"], rot["gen_from"], rot["gen_to"]) == ("switched", bk.LEGACY_KID, 0, 1), (rot, lab.rest.wire)
    assert rot["kid_to"].startswith("g1-") and [s["step"] for s in rot["steps"]] == ["prepare", "publish_sent", "publish", "confirm", "commit_sent", "switch"]
    assert lab.rest.ops() == ["begin", "probe", "probe", "commit", "probe"]
    assert all(rec["http"] == 200 and rec["ok"] is True and rec["signed"] for rec in lab.rest.wire if rec["service"] == "rotate")
    assert lab.actions("bridge.rotation") == ["bridge.rotation.requested", "bridge.rotation.prepared", "bridge.rotation.published",
                                              "bridge.rotation.confirmed", "bridge.rotation.switched"]
    assert lab.actions("bridge.key.adopted") == ["bridge.key.adopted"]
    assert lab.secret_setting() == 0, "the pairing secret left the settings"
    pairing = lab.c.get(f"{API}/ha/bridge/pairing").json()
    assert pairing["pairing_code"] is None and pairing["key_set"] is True
    # the bridge really switched, the old key still verifies (overlap)
    assert side.ks.signing == rot["kid_to"] and side.ks.old == bk.LEGACY_KID and side.ks.legacy is not None and side.entry_code == lab.code
    stored = side.stored_state()
    assert stored["signing"] == rot["kid_to"] and stored["rotation"]["committed"] is True, "write-ahead: saved before the answer"
    keys = lab.keys()
    assert keys[bk.LEGACY_KID]["state"] == "retiring" and keys[rot["kid_to"]]["state"] == "current"
    until = bk.epoch_of(keys[bk.LEGACY_KID]["verify_until"])
    assert 85 <= until - t_switched <= 92
    # step 3: the door pause covered every bridge call of the rotation and is still on in the overlap
    assert lab.paused_at and all(p for _op, p in lab.paused_at), lab.paused_at
    assert lab.paused()
    # step 4: overlap traffic - the bridge's push is v2 under g1, Arx signs v2 under g1, the old key and the kid-less recipe still verify
    assert lab.push_ok() and side.pushes[-1]["kid"] == rot["kid_to"]
    assert lab.arx_message_verifies_at_bridge() is None
    assert lab.arx_message_verifies_at_bridge(bk.LEGACY_KID, lab.code) is None
    old_recipe = side.signing.sign(lab.code, {"users": [], "version": side.mod.VERSION, "rotation": "rotation_v1"})
    assert lab.c.post(f"{API}/ha/bridge/directory", json=old_recipe).status_code == 200, "kid-less inside the retiring window"
    # a status read inside the window changes nothing
    assert lab.view()["rotation"]["state"] == "switched"
    # step 5: retire + verify, driven by the status read's tick after verify_until
    v = _retire(lab)
    last = v["last"]
    assert v["rotation"] is None and last["state"] == "verified" and last["peer_retire_ok"] == 1 and last["anchor_eligible"] is False, last
    assert lab.rest.ops()[-3:] == ["retire", "probe", "status"]
    assert lab.actions("bridge.rotation")[-2:] == ["bridge.rotation.retired", "bridge.rotation.verified"]
    assert lab.keys()[bk.LEGACY_KID]["state"] == "retired" and lab.keys()[bk.LEGACY_KID]["value_enc"] is None
    assert side.ks.old is None and side.ks.legacy is None and side.ks.legacy_retired
    assert side.entry_code == "", "HA-06: the config entry's copy of the pairing code is blanked after the save"
    assert side.stored_state()["legacy_retired"] is True and bk.LEGACY_KID not in side.stored_state()["keys"]
    # step 6: doors work again; the downgrade guard holds on both sides
    assert not lab.paused() and v["blocked_by"] is None and v["automatic"] == "idle"
    assert lab.push_ok()
    assert lab.arx_message_verifies_at_bridge(bk.LEGACY_KID, lab.code) == "bad_signature"
    assert lab.c.post(f"{API}/ha/bridge/directory", json=side.signing.sign(lab.code, {"users": []})).status_code == 401
    assert side.ks.verify(dict(side.signing.sign(lab.code, {"a": 1}))) == "bad_signature"
    # step 8: the second rotation g1 -> g2, no second adoption
    first_kid = rot["kid_to"]
    r2 = lab.start()
    assert r2.status_code == 200, r2.text
    rot2 = r2.json()["rotation"]
    assert (rot2["state"], rot2["kid_from"], rot2["gen_to"]) == ("switched", first_kid, 2) and rot2["kid_to"].startswith("g2-")
    assert side.ks.signing == rot2["kid_to"] and side.ks.old == first_kid
    v2 = _retire(lab)
    assert v2["last"]["state"] == "verified" and v2["last"]["id"] == rot2["id"], v2["last"]
    assert lab.actions("bridge.key.adopted") == ["bridge.key.adopted"], "the adoption happens once"
    assert lab.current().kid == rot2["kid_to"] and side.ks.signing == rot2["kid_to"] and side.ks.old is None
    assert sorted(lab.keys()[k]["state"] for k in lab.keys()) == ["current", "retired", "retired"]
    assert lab.push_ok() and lab.arx_message_verifies_at_bridge() is None
    assert first_kid not in side.ks.keys and lab.arx_message_verifies_at_bridge(first_kid, "x") == "bad_signature"
    assert clock() - t_click < 400


# ====================================================================== step 7 / F2 / F3: restarts and persistence

def test_restarts_of_both_sides_keep_the_key_set_and_the_replay_marks(lab):
    side = lab.side
    rot = lab.start().json()["rotation"]
    with lab.db.connection(mode="read") as conn:
        old_blob = conn.execute("SELECT value_enc FROM bridge_keys WHERE kid = ?", (bk.LEGACY_KID,)).fetchone()[0]
    assert _retire(lab)["last"]["state"] == "verified"
    g1 = rot["kid_to"]
    # H-07 on the real path: neither the retired sealed blob nor the plaintext pairing secret is in the database or its WAL
    data = b"".join(p.read_bytes() for p in (lab.settings.db_path, Path(str(lab.settings.db_path) + "-wal")) if p.exists())
    assert old_blob.encode() not in data and lab.code.encode() not in data and side.ks.keys[g1].encode() not in data
    # captured traffic before the restarts
    push = side.ks.sign({"users": [], "version": side.mod.VERSION, "rotation": "rotation_v1"})
    assert lab.c.post(f"{API}/ha/bridge/directory", json=push).status_code == 200
    with lab.db.connection(mode="read") as conn:
        arx_msg = ha_bridge.sign(ha_bridge.signing_key(conn), {"op": "x"})
    assert side.ks.verify(dict(arx_msg)) is None
    side.housekeeping()  # the bridge saves its new high-water mark (30 s timer)
    # Home Assistant restarts: the key set is reloaded from .storage alone (a restart takes longer than the 1 s ts resolution)
    side.restart()
    lab.clock.advance(2)
    assert side.ks.signing == g1 and side.ks.legacy is None and side.ks.old is None and side.entry_code == ""
    assert side.ks.verify(dict(arx_msg)) == "replay", "H-04: the persisted high-water refuses a pre-restart message"
    assert lab.push_ok() and lab.arx_message_verifies_at_bridge() is None
    # Arx restarts: the sealed key opens from the key file, the replay mark survives in bridge_keys.hw_ts
    lab.boot_arx()
    v = lab.view()
    assert v["key"]["kid"] == g1 and v["key"]["readable"] is True and v["blocked_by"] is None
    r = lab.c.post(f"{API}/ha/bridge/directory", json=push)
    assert r.status_code == 401 and r.json()["code"] == "bridge_replay", r.text
    assert lab.push_ok() and lab.arx_message_verifies_at_bridge() is None
    # and the next rotation works on top of both reloaded states
    rot2 = lab.start().json()["rotation"]
    assert rot2["state"] == "switched" and rot2["kid_from"] == g1
    assert _retire(lab)["last"]["state"] == "verified"


def test_f3_home_assistant_restarts_in_the_overlap_even_after_a_host_reboot(lab):
    side = lab.side
    rot = lab.start().json()["rotation"]
    assert rot["state"] == "switched"
    lab.clock.advance(30)
    lab.clock.reboot_host()  # the monotonic clock starts over: the bridge re-derives its cap from the saved wall-clock t0
    side.restart()
    assert side.ks.signing == rot["kid_to"] and side.ks.old == bk.LEGACY_KID and side.ks.legacy is not None
    assert lab.push_ok()
    v = _retire(lab)
    assert v["last"]["state"] == "verified" and side.ks.old is None and side.entry_code == ""


def test_f3_bridge_cap_drops_the_old_key_after_a_restart_past_180s(lab):
    side = lab.side
    rot = lab.start().json()["rotation"]
    side.stop()  # Home Assistant is down through the rest of the window
    lab.clock.advance(200)
    lab.clock.reboot_host()
    side.start()
    assert side.ks.old is None and side.ks.legacy is None, "the 180 s cap holds across a reboot (wall-clock t0 in the saved state)"
    assert side.ks.rotation["closed"] is True
    lab.side.sync()  # keep the announcement fresh
    v = lab.view()  # Arx retires (the peer's retire still answers ok: committed and signed by the current key) and verifies
    assert v["last"]["state"] == "verified" and v["last"]["peer_retire_ok"] == 1, v["last"]
    assert lab.current().kid == rot["kid_to"]


def test_f2_arx_restart_while_switched_the_worker_finishes(lab):
    rot = lab.start().json()["rotation"]
    lab.boot_arx()
    lab.clock.advance(95)
    done = br.worker_pass(lab.db, lab.settings, lab.peer, now=lab.clock)
    assert done["id"] == rot["id"] and done["state"] == "verified", done
    assert not lab.paused()


class _Crash(BaseException):
    """The add-on process dies in the middle of a call (not an Exception: nothing on the way catches it)."""


def test_f2_arx_crash_before_the_switch_is_rolled_back_on_both_sides(lab):
    side = lab.side

    def crash(op, data):
        raise _Crash()

    lab.rest.fault("probe", crash)
    with pytest.raises(_Crash):
        lab.engine().start(None, "routine")
    with lab.db.connection(mode="read") as conn:
        assert br.active_row(conn)["state"] == "published"
    assert side.ks.next is not None, "the bridge holds K_next"
    assert lab.paused()
    lab.boot_arx()
    v = lab.view()  # the status read ticks: R1 `interrupted`
    assert v["last"]["state"] == "rolled_back" and v["last"]["result_code"] == "interrupted", v["last"]
    assert side.ks.next is None and side.ks.rotation["closed"] is True and side.ks.signing == bk.LEGACY_KID
    assert not lab.paused() and lab.push_ok() and lab.arx_message_verifies_at_bridge() is None


# ====================================================================== R1: failures before the switch

def test_f1_peer_unreachable_at_begin_rolls_back_and_a_retry_works(lab):
    side = lab.side
    lab.rest.fault("begin", "unreachable")
    r = lab.start()
    rot = r.json()["rotation"]
    assert rot["state"] == "rolled_back" and rot["result_code"] == "peer_unreachable", rot
    assert lab.rest.ops() == ["begin", "abort"] and lab.rest.wire[1]["code"] == "unknown_rotation"
    assert side.ks.rotation is None and side.ks.signing == bk.LEGACY_KID
    assert lab.current().kid == bk.LEGACY_KID and lab.keys()[rot["kid_to"]]["state"] == "discarded"
    assert not lab.paused() and lab.arx_message_verifies_at_bridge() is None and lab.push_ok()
    # observed: a FAILED first rotation already adopted the pairing secret - the code is gone from the settings and the pairing screen
    assert lab.secret_setting() == 0 and lab.c.get(f"{API}/ha/bridge/pairing").json()["pairing_code"] is None
    # no back-off for the administrator's click
    again = lab.start().json()["rotation"]
    assert again["state"] == "switched", again
    assert _retire(lab)["last"]["state"] == "verified"


def test_r1_tampered_begin_answer_is_a_bad_answer_and_the_bridge_drops_next(lab):
    side = lab.side
    lab.rest.fault("begin", "tamper")
    rot = lab.start().json()["rotation"]
    assert rot["state"] == "rolled_back" and rot["result_code"] == "peer_bad_answer", rot
    assert lab.rest.wire[1]["op"] == "abort" and lab.rest.wire[1]["ok"] is True, "abort under K_cur was accepted"
    assert side.ks.next is None and side.ks.rotation["closed"] is True and rot["kid_to"] not in side.ks.keys
    assert not lab.paused() and lab.push_ok()


def test_r1_bridge_save_fails_at_begin_the_bridge_reverts_and_arx_rolls_back(lab):
    side = lab.side
    lab.rest.fault("begin", "save_fails")
    rot = lab.start().json()["rotation"]
    assert lab.rest.wire[0]["http"] == 500
    assert rot["state"] == "rolled_back" and rot["result_code"] == "peer_unreachable", rot
    assert side.ks.next is None and side.ks.rotation is None, "__init__.rotate reloaded the saved state (begin replaces the rotation dict)"
    # observed (part of K-05): the "saved" snapshot shares the live `hw` dict, so the reload keeps the high-water of the message whose save
    # failed as the boot mark; Arx's best-effort abort, signed in the same second, is refused as a replay (unsigned)
    assert (lab.rest.wire[1]["op"], lab.rest.wire[1]["code"], lab.rest.wire[1]["signed"]) == ("abort", "replay", False)
    lab.clock.advance(2)
    assert lab.arx_message_verifies_at_bridge() is None and not lab.paused()


def test_r1_bridge_loses_its_state_before_the_probe(lab):
    """HA restored / the key save lost between `begin` and the first probe. The real bridge answers the K_next probe UNSIGNED
    (HA-01) -> `probe_next_failed:peer_bad_answer`; the fake peer would answer a SIGNED `key_unknown` (divergence D1)."""
    side = lab.side
    snapshot = dict(side.disk)

    def lose_state(op, data):
        side.restore_storage(snapshot)

    lab.rest.fault("probe", lose_state)
    rot = lab.start().json()["rotation"]
    assert rot["state"] == "rolled_back" and rot["result_code"] == "probe_next_failed:peer_bad_answer", rot
    probe = [w for w in lab.rest.wire if w["op"] == "probe"][0]
    assert probe["ok"] is False and probe["code"] == "bad_signature" and probe["signed"] is False
    assert side.ks.rotation is None and side.ks.signing == bk.LEGACY_KID
    assert not lab.paused() and lab.push_ok()


def test_r1_budget_exceeded_before_the_commit(lab):
    side, clock = lab.side, lab.clock

    def slow(op, data):
        clock.advance(45)  # each probe takes 45 s: 90 s of the 180 s budget used before the commit (needs >= 100 s left)

    lab.rest.fault("probe", slow, slow)
    rot = lab.start().json()["rotation"]
    assert rot["state"] == "rolled_back" and rot["result_code"] == "budget_exceeded", rot
    assert "commit" not in lab.rest.ops() and lab.rest.ops()[-1] == "abort"
    assert side.ks.next is None and side.ks.signing == bk.LEGACY_KID
    assert not lab.paused() and lab.push_ok()


# ====================================================================== R2: the commit's outcome unknown

def test_r2_commit_applied_but_answer_lost_is_recovered_by_status(lab):
    side = lab.side
    lab.rest.fault("commit", "lost_after")
    rot = lab.start().json()["rotation"]
    assert rot["state"] == "switched", rot
    assert lab.rest.ops() == ["begin", "probe", "probe", "commit", "status", "probe"]
    assert "bridge.rotation.recovered" in lab.actions()
    assert side.ks.signing == rot["kid_to"]
    assert _retire(lab)["last"]["state"] == "verified"


@pytest.mark.xfail(strict=True, reason="FINDING K-05: keyset.state() returns the LIVE `rotation` and `hw` dicts (keyset.py L134-L137), so "
                                       "`saved = keyset.state()` in __init__.rotate (L596) is no snapshot; _op_commit mutates the rotation "
                                       "in place (L302) and the reload after a failed save (L601) keeps committed=True with signing=K_cur")
def test_r2_commit_reverted_by_a_failed_bridge_save_rolls_back(lab):
    """The designed outcome (__init__.rotate docstring, plan section 3): a failed save reloads the OLD state and raises - Arx sees no
    answer, asks `status`, hears `not_committed` under K_cur and rolls back (R1 `commit_not_applied`)."""
    side = lab.side
    lab.rest.fault("commit", "save_fails")
    rot = lab.start().json()["rotation"]
    assert rot["state"] == "rolled_back" and rot["result_code"] == "commit_not_applied", rot
    assert side.ks.signing == bk.LEGACY_KID and side.ks.next is None and lab.current().kid == bk.LEGACY_KID


def test_k05_a_failed_commit_save_leaves_a_half_committed_bridge_that_blocks_every_later_rotation(lab):
    """K-05 pinned: what actually happens today, end to end."""
    side, clock = lab.side, lab.clock
    lab.rest.fault("commit", "save_fails")
    rot = lab.start().json()["rotation"]
    assert lab.rest.wire[3]["op"] == "commit" and lab.rest.wire[3]["http"] == 500
    # the reverted bridge state is inconsistent: still signing with K_cur, K_next kept as `next`, the rotation marked committed
    assert (side.ks.signing, side.ks.next, side.ks.rotation["committed"]) == (bk.LEGACY_KID, rot["kid_to"], True)
    # the immediate `status` is refused as a replay when it is signed in the commit's second (the kept high-water), and later ones say
    # "committed" signed under K_cur - H-09 refuses to believe either, so Arx stays `switching` (doors paused)
    status = [w for w in lab.rest.wire if w["op"] == "status"][0]
    assert status["code"] == "replay" or (status["ok"] is True and status["signed"]), status
    assert rot["state"] == "switching" and lab.paused(), rot
    clock.advance(30)
    assert lab.view()["rotation"]["state"] == "switching"
    later_status = [w for w in lab.rest.wire if w["op"] == "status"][-1]
    assert later_status["ok"] is True and later_status["signed"] is True, later_status
    clock.advance(155)
    side.sync()
    assert lab.view()["last"]["state"] == "needs_repair"
    done = lab.c.post(f"{KEY_API}/rotations/{rot['id']}/resume").json()["rotation"]
    assert done["state"] == "rolled_back" and done["result_code"] == "aligned_to_current", done
    assert not lab.paused() and lab.arx_message_verifies_at_bridge() is None and lab.push_ok()
    # but the bridge never lets go of `next` (its cap drops `old` for a "committed" rotation): every later begin is refused
    side.housekeeping()
    assert side.ks.next == rot["kid_to"] and side.ks.rotation["closed"] is True
    later = lab.start().json()["rotation"]
    assert later["state"] == "rolled_back" and later["result_code"] == "not_allowed", later


def test_r2_status_silent_then_answers_inside_the_budget(lab):
    lab.rest.fault("commit", "lost_after")
    lab.rest.fault("status", "unreachable")
    rot = lab.start().json()["rotation"]
    assert rot["state"] == "switching" and lab.paused()
    with lab.db.connection(mode="read") as conn:
        assert bk.current(conn, lab.settings.data_dir).kid == bk.LEGACY_KID, "Arx keeps signing with K_cur"
    lab.clock.advance(20)
    v = lab.view()  # the tick asks again, the bridge answers `committed` (signed by K_next)
    assert v["rotation"]["state"] == "switched", v["rotation"]
    assert _retire(lab)["last"]["state"] == "verified"


def _needs_repair_past_the_cap(lab) -> dict[str, Any]:
    lab.rest.fault("commit", "lost_after")
    lab.rest.fault("status", "unreachable", "unreachable")
    rot = lab.start().json()["rotation"]
    assert rot["state"] == "switching"
    lab.clock.advance(185)  # past t0 + 180 s
    lab.side.sync()
    v = lab.view()
    assert v["last"]["state"] == "needs_repair" and v["last"]["result_code"] == "commit_outcome_unknown", v["last"]
    return v["last"]


def test_r2_silent_past_the_budget_needs_repair_and_resume_cannot_align_with_the_real_bridge(lab):
    """FINDING K-03 (pinned behaviour). `needs_repair: commit_outcome_unknown` is only reached once t0 + 180 s has passed
    (bridge_rotation.py L487-L491). By then the real bridge's own cap has dropped K_cur (keyset.py L160-L173), and `_repair` asks
    `status` signed with Arx's current key = K_cur only (bridge_rotation.py L562-L567): the bridge answers an UNSIGNED refusal, so
    resume never aligns - even with a healthy bridge. test_bridge_key_activation_295.test_h05 reaches needs_repair by an SQL update
    without passing the cap, which hides this. Meanwhile the channel is split: the bridge signs with K_next (Arx still accepts it as
    `next`), Arx signs with K_cur (the bridge refuses it)."""
    side = lab.side
    last = _needs_repair_past_the_cap(lab)
    assert lab.paused() and lab.view()["blocked_by"] == "repair_required"
    assert side.ks.signing == last["kid_to"] and side.ks.old is None and side.ks.legacy is None, "the bridge committed and capped"
    r = lab.c.post(f"{KEY_API}/rotations/{last['id']}/resume")
    assert r.status_code == 200 and r.json()["rotation"]["state"] == "needs_repair", r.text
    assert lab.rest.wire[-1]["op"] == "status" and lab.rest.wire[-1]["signed"] is False and lab.rest.wire[-1]["code"] == "bad_signature"
    assert lab.push_ok(), "bridge -> Arx still verifies (K_next is `next` at Arx)"
    assert lab.arx_message_verifies_at_bridge() == "bad_signature", "Arx -> bridge is broken until a re-pair"
    assert lab.paused()


@pytest.mark.xfail(strict=True, reason="FINDING K-04: a re-pair does not close a needs_repair rotation (bridge_keys.reset_set L326-L327 "
                                       "lists only the active states), so doors stay paused and every start answers repair_required")
def test_repair_after_needs_repair_lifts_the_pause_and_allows_a_new_first_rotation(lab):
    _needs_repair_past_the_cap(lab)
    r = lab.c.get(f"{API}/ha/bridge/pairing", params={"regenerate": "true"})
    assert r.status_code == 200
    new = r.json()["pairing_code"]
    lab.side.replace_entry("01KEYROTHARNESSENTRY0000B2", new)
    assert lab.c.post(f"{API}/ha/bridge/ping", json=lab.side.ping_message(new)).status_code == 200
    lab.side.sync()
    assert lab.push_ok() and lab.arx_message_verifies_at_bridge() is None, "the new pairing works"
    v = lab.view()
    assert not lab.paused() and v["blocked_by"] is None and v["automatic"] == "awaiting_click", (v["blocked_by"], v["last"]["state"])


# ====================================================================== R3: the peer rejects K_next after the switch

def test_r3_post_switch_probe_fails_and_the_real_bridge_switches_back(lab):
    side = lab.side
    lab.rest.fault("probe", None, None, "unreachable")
    rot = lab.start().json()["rotation"]
    assert rot["state"] == "rolled_back" and rot["result_code"] == "post_switch_probe_failed:peer_unreachable", rot
    abort = lab.rest.wire[-1]
    assert abort["op"] == "abort" and abort["ok"] is True, "the bridge accepted the switch back under K_cur (still its `old`)"
    assert side.ks.signing == bk.LEGACY_KID and side.ks.old is None and side.ks.next is None and rot["kid_to"] not in side.ks.keys
    assert side.ks.legacy is not None and side.entry_code == lab.code
    assert lab.current().kid == bk.LEGACY_KID and lab.keys()[rot["kid_to"]]["state"] == "discarded"
    assert not lab.paused() and lab.push_ok() and lab.arx_message_verifies_at_bridge() is None


def test_r3_needs_repair_then_resume_aligns_to_next(lab):
    side, clock = lab.side, lab.clock
    lab.rest.fault("probe", None, None, "unreachable")
    lab.rest.fault("abort", "unreachable")
    rot = lab.start().json()["rotation"]
    assert rot["state"] == "needs_repair" and rot["result_code"].startswith("post_switch_probe_failed"), rot
    assert lab.paused() and lab.view()["blocked_by"] == "repair_required"
    assert lab.c.post(f"{KEY_API}/rotations", json={"mode": "routine", "confirm": True}).json()["code"] == "repair_required"
    r = lab.c.post(f"{KEY_API}/rotations/{rot['id']}/resume")
    assert r.status_code == 200, r.text
    done = r.json()["rotation"]
    assert done["state"] == "retired" and done["result_code"] == "aligned_to_next", done
    assert "bridge.rotation.recovered" in lab.actions()
    assert not lab.paused() and lab.current().kid == rot["kid_to"] and lab.keys()[bk.LEGACY_KID]["state"] == "retired"
    assert lab.push_ok() and lab.arx_message_verifies_at_bridge() is None
    # observed: the bridge was never told `retire`; its rotation stays open (old key held) until its own 180 s cap, and a new
    # rotation started inside that window is refused by the bridge (`not_allowed`) and rolled back
    assert side.ks.old == bk.LEGACY_KID and not side.ks.rotation["closed"]
    early = lab.start().json()["rotation"]
    assert early["state"] == "rolled_back" and early["result_code"] == "not_allowed", early
    clock.advance(185)
    side.housekeeping()
    assert side.ks.old is None and side.ks.legacy is None and side.entry_code == ""
    side.sync()
    later = lab.start().json()["rotation"]
    assert later["state"] == "switched", later
    assert _retire(lab)["last"]["state"] == "verified"


# ====================================================================== F7: the switch turned off mid-rotation

def test_f7_switch_off_in_the_overlap_lifts_the_pause_and_on_again_finishes(lab):
    side, clock = lab.side, lab.clock
    rot = lab.start().json()["rotation"]
    assert lab.paused()
    assert lab.c.put(f"{KEY_API}/settings", json={"enabled": False}).status_code == 200
    assert not lab.paused()
    clock.advance(200)
    assert lab.view()["rotation"]["state"] == "switched", "nothing drives the rotation while the switch is off"
    side.housekeeping()
    assert side.ks.old is None, "the bridge's own cap ended the overlap"
    side.sync()
    assert lab.c.put(f"{KEY_API}/settings", json={"enabled": True}).status_code == 200
    v = lab.view()
    assert v["last"]["state"] == "verified" and v["last"]["id"] == rot["id"], v["last"]


# ====================================================================== F6: re-pair

def test_f6_repair_by_removing_and_re_adding_the_integration(lab):
    side = lab.side
    rot = lab.start().json()["rotation"]
    assert _retire(lab)["last"]["state"] == "verified"
    old_store = f"smplwise_bridge_keys_{side.entry.entry_id}"
    r = lab.c.get(f"{API}/ha/bridge/pairing", params={"regenerate": "true"})
    new = r.json()["pairing_code"]
    assert new and new != lab.code and r.json()["key_set"] is False
    assert all(k["state"] in ("retired", "discarded") for k in lab.keys().values())
    assert lab.view()["peer_available"] is False, "the bridge must announce again"
    side.replace_entry("01KEYROTHARNESSENTRY0000B2", new)
    assert lab.c.post(f"{API}/ha/bridge/ping", json=side.ping_message(new)).status_code == 200
    side.sync()
    v = lab.view()
    assert (v["adopted"], v["automatic"], v["can_start"]) == (False, "awaiting_click", True)
    assert lab.push_ok() and lab.arx_message_verifies_at_bridge() is None
    again = lab.start().json()["rotation"]
    assert again["kid_from"] == bk.LEGACY_KID and again["state"] == "switched", again
    assert _retire(lab)["last"]["state"] == "verified"
    # observed (FINDING K-06, low): the removed entry's key store stays in Home Assistant's .storage with its key in clear
    # (__init__.py has no async_remove_entry); HA backups taken later still carry it
    assert old_store in side.disk and rot["kid_to"] in json.loads(side.disk[old_store])["keys"]


def test_f6_repair_during_a_rotation_closes_it_and_lifts_the_pause(lab):
    lab.start()
    assert lab.paused()
    lab.c.get(f"{API}/ha/bridge/pairing", params={"regenerate": "true"})
    with lab.db.connection(mode="read") as conn:
        last = conn.execute("SELECT state, result_code FROM bridge_rotations ORDER BY started_at DESC, rowid DESC LIMIT 1").fetchone()
    assert (last["state"], last["result_code"]) == ("rolled_back", "repaired") and not lab.paused()


@pytest.mark.xfail(strict=True, reason="FINDING K-02: a re-pair delivered through Supervisor discovery updates the SAME config entry "
                                       "(config_flow.py L68); its stored key set has legacy_retired, so KeySet ignores the new code "
                                       "(keyset.py L102-L103) and Persister.clean_entry blanks it (keyset.py L364-L370)")
def test_f6_repair_through_discovery_into_the_existing_entry(lab, monkeypatch):
    side = lab.side
    lab.start()
    assert _retire(lab)["last"]["state"] == "verified"
    new = lab.c.get(f"{API}/ha/bridge/pairing", params={"regenerate": "true"}).json()["pairing_code"]
    posted: list[dict[str, Any]] = []
    monkeypatch.setenv("SUPERVISOR_TOKEN", "synthetic-harness-token")
    monkeypatch.setattr(ha_client, "post_discovery", lambda settings, service, config: posted.append(config) or {})
    assert bridge_install.announce_discovery(lab.db, lab.settings) is True and posted[-1]["pairing_code"] == new
    side.discovery_update(posted[-1]["pairing_code"])  # HA: abort_if_unique_id_configured(updates=...) + reload
    side.sync()
    assert lab.push_ok(), "bridge -> Arx after the re-pair"
    assert lab.arx_message_verifies_at_bridge() is None, "Arx -> bridge after the re-pair"


# ====================================================================== the discovery announcement after a rotation

@pytest.mark.xfail(strict=True, reason="FINDING K-01: bridge_install.announce_discovery (L114-L125, every add-on start) posts "
                                       "ha_bridge.signing_key(conn) as `pairing_code`; after a rotation that is the CURRENT key material "
                                       "(a BridgeKey str), which the hassio flow writes into the config entry (config_flow.py L68)")
def test_k01_discovery_never_carries_rotated_key_material(lab, monkeypatch):
    lab.start()
    posted: list[dict[str, Any]] = []
    monkeypatch.setenv("SUPERVISOR_TOKEN", "synthetic-harness-token")
    monkeypatch.setattr(ha_client, "post_discovery", lambda settings, service, config: posted.append(config) or {})
    assert bridge_install.announce_discovery(lab.db, lab.settings) is True
    material = lab.current().material
    assert material and lab.current().kid != bk.LEGACY_KID
    assert (posted[-1]["pairing_code"] == material) is False, "the discovery carries the current key (value not printed)"


def test_k01_what_the_bridge_does_with_the_posted_key(lab, monkeypatch):
    """The functional side of K-01 (pinned): the entry takes the key, reloads, KeySet ignores it (legacy retired) and clean_entry blanks
    it again - the channel survives, but the key passed through the Supervisor's discovery store and HA's config-entry file."""
    side = lab.side
    lab.start()
    assert _retire(lab)["last"]["state"] == "verified"
    posted: list[dict[str, Any]] = []
    monkeypatch.setenv("SUPERVISOR_TOKEN", "synthetic-harness-token")
    monkeypatch.setattr(ha_client, "post_discovery", lambda settings, service, config: posted.append(config) or {})
    bridge_install.announce_discovery(lab.db, lab.settings)
    assert posted[-1]["pairing_code"] == side.ks.keys[side.ks.signing], "the current key itself"
    side.discovery_update(posted[-1]["pairing_code"])
    assert side.entry_code == "" and side.ks.legacy is None
    assert lab.push_ok() and lab.arx_message_verifies_at_bridge() is None


# ====================================================================== P10: the key file

def test_p10_losing_the_key_file_blocks_and_restoring_it_recovers(lab):
    lab.start()
    assert _retire(lab)["last"]["state"] == "verified"
    key_file = lab.settings.data_dir / "keys" / "connections.key"
    backup = key_file.read_bytes()
    key_file.unlink()
    lab.boot_arx()
    v = lab.view()
    assert v["key"]["readable"] is False and v["blocked_by"] == "key_unreadable"
    assert lab.start().json()["code"] == "key_unreadable"
    assert not lab.push_ok(), "fail closed: Arx cannot verify the bridge"
    key_file.write_bytes(backup)  # the owner's backup of the data folder WITH the key file (P10)
    lab.boot_arx()
    assert lab.view()["blocked_by"] is None and lab.push_ok() and lab.arx_message_verifies_at_bridge() is None


# ====================================================================== step 10: secret scan of a full run

def test_step10_no_key_material_in_audit_logs_api_answers_or_settings(lab, caplog):
    caplog.set_level(logging.DEBUG)
    side = lab.side
    materials: set[str] = {lab.code}

    def collect(op, data):
        for ks in side.keysets:
            materials.update(ks.keys.values())

    lab.rest.before.append(collect)
    answers: list[str] = []

    def keep(r):
        answers.append(r.text)
        return r

    lab.rest.fault("commit", "lost_after")
    answers.append(keep(lab.start()).text)
    answers.append(lab.c.get(KEY_API).text)
    lab.clock.advance(95)
    answers.append(lab.c.get(KEY_API).text)
    lab.rest.fault("begin", "tamper")
    answers.append(lab.start().text)
    answers.append(lab.start().text)
    lab.clock.advance(95)
    answers.append(lab.c.get(KEY_API).text)
    answers.append(lab.c.get(f"{API}/ha/bridge/pairing").text)
    side.restart()
    side.sync()
    collect(None, {})
    with lab.db.connection(mode="read") as conn:
        for r in conn.execute("SELECT kid FROM bridge_keys WHERE value_enc IS NOT NULL"):
            materials.add(bk.load(conn, lab.settings.data_dir, r["kid"]).material)
        tables = {t: [dict(r) for r in conn.execute(f"SELECT * FROM {t}")] for t in ("audit_log", "bridge_rotations", "settings")}
        tables["bridge_keys"] = [{k: v for k, v in dict(r).items() if k != "value_enc"} for r in conn.execute("SELECT * FROM bridge_keys")]
    assert len([m for m in materials if m]) >= 4, materials.__len__()
    forms: set[str] = set()
    for m in materials:
        if m:
            forms |= {m, m.encode().hex(), base64.b64encode(m.encode()).decode()}
    for ex in lab.rest.raw:
        req, ans = ex["request"], ex["answer"]
        forms |= {req.get("nonce"), req.get("sig"), ans.get("nonce"), ans.get("sig"), ans.get("proof")}
        if req.get("salt"):
            forms |= {req["salt"], base64.b64decode(req["salt"]).hex()}
    forms.discard(None)
    assert any(ex["request"].get("salt") for ex in lab.rest.raw) and any(ex["answer"].get("proof") for ex in lab.rest.raw)
    haystack = json.dumps(tables, ensure_ascii=False, default=str) + caplog.text + "".join(answers) + json.dumps(lab.rest.wire, default=str)
    haystack += json.dumps(side.entry.data) + json.dumps(side.entry.options)
    leaked = sorted({f[:6] + "..." for f in forms if f and f in haystack})
    assert leaked == [], leaked
    assert "bridge.rotation.verified" in haystack and "bridge.rotation.rolled_back" in haystack and "bridge.rotation.recovered" in haystack


# ====================================================================== divergences: the fake peer vs the real key set

def _pair(clock: kh.Clock):
    ksm = kh.bridge_submodule("keyset")
    legacy = "synthetic-divergence-legacy-0001"
    return FakePeer(legacy, clock), ksm.KeySet(legacy, None, now=clock, mono=clock.mono), legacy, ksm


def _begin_body(rid: str = "r1", salt: bytes = b"\x07" * 32, kid_next: str = "g1-0badc0de", gen: int = 1) -> dict[str, Any]:
    return {"protocol": br.PROTOCOL, "op": "begin", "rotation_id": rid, "kid_next": kid_next, "gen_next": gen,
            "salt": base64.b64encode(salt).decode(), "overlap_s": 90, "mode": "routine"}


def _fake(fake: FakePeer, op: str, msg: dict[str, Any]) -> Any:
    try:
        return fake.call(op, json.loads(json.dumps(msg)))
    except Exception as exc:  # noqa: BLE001
        return {"raised": type(exc).__name__}


def test_divergences_between_the_fake_peer_and_the_real_key_set():
    """Each row: the same signed message to tests/fake_bridge_rotation_peer.FakePeer and to the real keyset.KeySet. Pinned so a change
    to either side shows up here; the list is the D-table of the KEYROT-HARNESS report."""
    clock = kh.Clock()
    fake, real, legacy, ksm = _pair(clock)
    now = int(clock())
    rows: dict[str, tuple[Any, Any]] = {}
    # D1 + D2: an unverifiable probe (a kid nobody holds) - fake: a SIGNED refusal naming the reason; real: UNSIGNED bad_signature (HA-01, H-02)
    m = bk.sign_with("g7-deadbeef", "nobody", {"protocol": br.PROTOCOL, "op": "probe", "rotation_id": "r0"}, ts=now)
    rows["D1_unverified_probe"] = (_fake(fake, "probe", m), real.handle_control(json.loads(json.dumps(m))))
    assert rows["D1_unverified_probe"][0]["code"] == "key_unknown" and "sig" in rows["D1_unverified_probe"][0]
    assert rows["D1_unverified_probe"][1] == {"ok": False, "code": "bad_signature"}
    # D2: a stale message under the right key - fake: `stale` before the MAC; real: after the MAC (same code here, signed by real)
    m = bk.sign_with(bk.LEGACY_KID, "wrong-key", {"protocol": br.PROTOCOL, "op": "probe", "rotation_id": "r0"}, ts=now - 3600)
    f, r = _fake(fake, "probe", m), real.handle_control(json.loads(json.dumps(m)))
    assert f["code"] == "stale" and r == {"ok": False, "code": "bad_signature"}, (f, r)
    # D3: the kid-less legacy recipe - fake: bad_format; real: verifies under g0-legacy
    v1 = kh.bridge_submodule("signing").sign(legacy, {"protocol": br.PROTOCOL, "op": "status", "rotation_id": "r0"})
    f, r = _fake(fake, "status", v1), real.handle_control(json.loads(json.dumps(v1)))
    assert f["code"] == "bad_format" and r["ok"] is True, (f, r)
    # D6: begin with a 16-byte salt and a gen that does not match the kid - fake derives; real refuses bad_request
    m = bk.sign_with(bk.LEGACY_KID, legacy, _begin_body(salt=b"\x01" * 16, kid_next="g3-0badc0de", gen=1), ts=now)
    f, r = _fake(fake, "begin", m), real.handle_control(json.loads(json.dumps(m)))
    assert f["ok"] is True and r["ok"] is False and r["code"] == "bad_request", (f, r)
    # D7: an oversized rotation id - fake processes it; real refuses unsigned bad_format before the MAC (HA-05)
    fake2, real2, _l, _k = _pair(clock)
    m = bk.sign_with(bk.LEGACY_KID, legacy, {"protocol": br.PROTOCOL, "op": "status", "rotation_id": "r" * 65}, ts=now)
    f, r = _fake(fake2, "status", m), real2.handle_control(json.loads(json.dumps(m)))
    assert f["ok"] is True and r == {"ok": False, "code": "bad_format"}, (f, r)
    # D11: an unknown op - fake raises; real answers a signed bad_request
    m = bk.sign_with(bk.LEGACY_KID, legacy, {"protocol": br.PROTOCOL, "op": "rekey", "rotation_id": "r9"}, ts=now)
    f, r = _fake(fake2, "rekey", m), real2.handle_control(json.loads(json.dumps(m)))
    assert f == {"raised": "AttributeError"} and r["code"] == "bad_request" and "sig" in r, (f, r)
    # D9: abort before the commit signed with K_next - fake accepts; real requires the signing key
    fake3, real3, _l, _k = _pair(clock)
    begin = bk.sign_with(bk.LEGACY_KID, legacy, _begin_body(rid="r3"), ts=now)
    assert _fake(fake3, "begin", begin)["ok"] is True and real3.handle_control(json.loads(json.dumps(begin)))["ok"] is True
    k_next = real3.keys["g1-0badc0de"]
    m = bk.sign_with("g1-0badc0de", k_next, {"protocol": br.PROTOCOL, "op": "abort", "rotation_id": "r3"}, ts=now)
    f, r = _fake(fake3, "abort", m), real3.handle_control(json.loads(json.dumps(m)))
    assert f["ok"] is True and r["ok"] is False and r["code"] == "not_allowed", (f, r)
    # D4 / D5 / D8 / D13: what only the real side has - a persisted state (high-water, rotation, cap t0 on the wall clock), the
    # write-ahead save in the service handler, the legacy-retired flag that blanks the config entry's pairing code
    assert not hasattr(fake, "state") and not hasattr(fake, "reload") and not hasattr(fake, "legacy_retired")
    assert {"hw", "rotation", "legacy_retired", "signing"} <= set(real.state())
    replay = bk.sign_with(bk.LEGACY_KID, legacy, {"protocol": br.PROTOCOL, "op": "probe", "rotation_id": "r5"}, ts=now + 1)
    assert real.handle_control(json.loads(json.dumps(replay)))["ok"] is True
    reloaded = ksm.KeySet(legacy, json.loads(json.dumps(real.state())), now=clock, mono=clock.mono)
    assert reloaded.handle_control(json.loads(json.dumps(replay))) == {"ok": False, "code": "replay"}
