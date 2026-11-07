"""WXH-LEFTOVERS-2405: the Arx side of the key-rotation leftovers (CR-034 slices H3 remainder, H5 watchdog, H6 hand-over).

- owner contacts (`security.owner_contacts`): active system administrators only, system administrator only, audited, never from an archive;
- the bridge-key notices: one pipeline, the `bridge_key_owner` recipients rule (contacts + every system administrator), queued under a
  savepoint (a failing notice never undoes the caller's work), audited; the emergency notice exists for WXH4 and no route sends it;
- the Settings banner while no owner contact is set and a notice is open;
- the watchdog: reports `overlap_overdue` / `needs_repair` / `verify_failed` / `generation_mismatch` once, clears them, and never starts,
  resumes or drives a rotation, never calls the bridge, never names a door primitive (SR-1);
- the capability status hand-over: a signed key-status record in every directory answer (generations, last rotation, anchor eligibility -
  never key material), the bridge's reported generation recorded, the ping refusing an Arx-signed `purpose` message;
- the 2.39.1 WisKey block is untouched: nothing here starts a rotation.

Fakes and synthetic data only; nothing contacts a bridge, WisKey or Home Assistant."""
from __future__ import annotations

import ast
import importlib.util
import json
import sys
import time
from pathlib import Path

import pytest
from conftest import as_user, bind
from fastapi.testclient import TestClient

from smplwise.db import Database, get_setting, now_iso, set_setting
from smplwise.main import create_app
from smplwise.services import backup
from smplwise.services import bridge_key_notice as bkn
from smplwise.services import bridge_key_watchdog as wd
from smplwise.services import bridge_keys as bk
from smplwise.services import bridge_rotation as br
from smplwise.services import bridge_rotation_peer as peers
from smplwise.services import notify

ROOT = Path(__file__).resolve().parents[3]
BACKEND = Path(__file__).resolve().parents[1]
BRIDGE = ROOT / "custom_components" / "smplwise_bridge"
LEGACY = "synthetic-legacy-pairing-secret-2405"
API = "/api/v1"


def _load(name: str):
    spec = importlib.util.spec_from_file_location(f"_sw_bridge_wxh_{name}", BRIDGE / f"{name}.py")
    mod = importlib.util.module_from_spec(spec)
    sys.modules[spec.name] = mod
    spec.loader.exec_module(mod)
    return mod


keyset_mod = _load("keyset")
signing_mod = _load("signing")


class CountingPeer:
    """A peer that records every call: the watchdog must never make one."""

    def __init__(self) -> None:
        self.calls: list[str] = []

    def capabilities(self):
        return {"rotation": peers.CAPABILITY}

    def call(self, op, msg):
        self.calls.append(op)
        raise peers.PeerUnreachable()


@pytest.fixture()
def world(settings, monkeypatch):
    bk.reset_for_tests()
    app = create_app(settings)
    c = TestClient(app)
    c.get(f"{API}/me")
    c.get(f"{API}/me", headers=as_user("dana"))  # an operator (no system administrator)
    db = Database(settings.db_path)
    with db.connection() as conn:
        set_setting(conn, "bridge.secret", LEGACY)
        set_setting(conn, "bridge.paired_at", "2026-11-01T00:00:00Z")
    monkeypatch.setattr(br, "wiskey_present", lambda: False)
    peers.set_peer_for_tests(None)
    yield {"c": c, "db": db, "settings": settings}
    peers.set_peer_for_tests(None)
    bk.reset_for_tests()


def _admin_id(w) -> str:
    with w["db"].connection(mode="read") as conn:
        return bkn.system_admins(conn)[0]


def _user_id(w, username: str) -> str:
    with w["db"].connection(mode="read") as conn:
        return conn.execute("SELECT id FROM users WHERE username = ?", (username,)).fetchone()["id"]


def _rotation(w, state: str, *, rid: str = "rot-wxh-1", age_s: float = 0.0, mode: str = "routine", anchor: int = 0, t0: bool = True) -> None:
    at = time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime(time.time() - age_s))
    with w["db"].connection() as conn:
        conn.execute("DELETE FROM bridge_rotations")
        conn.execute("INSERT INTO bridge_rotations(id, mode, state, kid_from, kid_to, gen_from, gen_to, overlap_s, started_at, t0_at, ended_at, anchor_eligible) "
                     "VALUES (?,?,?,?,?,?,?,?,?,?,?,?)",
                     (rid, mode, state, "g0-legacy", "g1-aaaaaaaa", 0, 1, 90, at, at if t0 else None,
                      None if state in br.ACTIVE else at, anchor))


def _audits(w, action: str) -> list:
    with w["db"].connection(mode="read") as conn:
        return conn.execute("SELECT * FROM audit_log WHERE action = ? ORDER BY rowid", (action,)).fetchall()


def _notices(w, state: str | None = None) -> list:
    with w["db"].connection(mode="read") as conn:
        q = f"SELECT * FROM notifications WHERE source IN ({','.join('?' * len(bkn.SOURCES))})"
        args: list = list(bkn.SOURCES)
        if state:
            q += " AND state = ?"
            args.append(state)
        return conn.execute(q, args).fetchall()


# ================================================================ owner contacts

def test_owner_contacts_accept_only_active_system_admins_and_are_audited(world):
    w = world
    admin = _admin_id(w)
    dana = _user_id(w, "dana")
    r = w["c"].put(f"{API}/system/bridge-key/owner-contacts", json={"user_ids": [admin]})
    assert r.status_code == 200, r.text
    oc = r.json()["owner_contacts"]
    assert oc["ids"] == [admin] and oc["set"] is True and oc["users"][0]["valid"] is True and oc["max"] == bkn.MAX_CONTACTS
    assert {c["id"] for c in oc["candidates"]} == {admin}
    rows = [a for a in _audits(w, "settings.changed") if json.loads(a["details_json"] or "{}").get("key") == bkn.CONTACTS_KEY]
    assert rows and rows[-1]["decision"] == "allowed" and json.loads(rows[-1]["details_json"])["after"] == [admin]
    # an operator is refused as a contact (422, audited), the list is unchanged
    r = w["c"].put(f"{API}/system/bridge-key/owner-contacts", json={"user_ids": [admin, dana]})
    assert r.status_code == 422 and r.json()["code"] == "contact_not_admin"
    with w["db"].connection(mode="read") as conn:
        assert bkn.stored_contacts(conn) == [admin]
    # malformed: duplicates, too many, extra fields
    assert w["c"].put(f"{API}/system/bridge-key/owner-contacts", json={"user_ids": [admin, admin]}).status_code == 422
    assert w["c"].put(f"{API}/system/bridge-key/owner-contacts", json={"user_ids": [admin] * 6}).status_code == 422
    assert w["c"].put(f"{API}/system/bridge-key/owner-contacts", json={"user_ids": [admin], "x": 1}).status_code == 422
    # clearing
    r = w["c"].put(f"{API}/system/bridge-key/owner-contacts", json={"user_ids": []})
    assert r.status_code == 200 and r.json()["owner_contacts"]["set"] is False


def test_owner_contacts_need_a_system_administrator(world):
    w = world
    r = w["c"].put(f"{API}/system/bridge-key/owner-contacts", json={"user_ids": []}, headers=as_user("dana"))
    assert r.status_code == 403
    bind(w["c"], w["settings"], "cfg", "site_admin", "installation", "*")
    r = w["c"].put(f"{API}/system/bridge-key/owner-contacts", json={"user_ids": []}, headers=as_user("cfg"))
    assert r.status_code == 403
    assert w["c"].get(f"{API}/system/bridge-key/notice", headers=as_user("dana")).status_code == 403


def test_a_demoted_contact_drops_out_without_an_error(world):
    w = world
    bind(w["c"], w["settings"], "rina", "system_admin", "installation", "*")
    rina = _user_id(w, "rina")
    admin = _admin_id(w)
    assert w["c"].put(f"{API}/system/bridge-key/owner-contacts", json={"user_ids": [rina]}).status_code == 200
    with w["db"].connection() as conn:
        assert bkn.valid_contacts(conn) == [rina]
        conn.execute("UPDATE bindings SET revoked_at = ? WHERE subject_id = ? AND role_id = 'system_admin'", (now_iso(), rina))
        assert bkn.stored_contacts(conn) == [rina] and bkn.valid_contacts(conn) == []
        assert bkn.recipient_users(conn) == [admin]
        assert bkn.view(conn)["users"] == [{"id": rina, "name": bkn._name(conn, rina), "valid": False}]


def test_the_new_settings_never_come_from_an_archive():
    for key in ("security.owner_contacts", "bridge.watchdog", "bridge.peer_key_generation", "bridge.peer_key_generation_at"):
        assert backup._kept_setting(key), key


# ================================================================ notices

def test_a_notice_reaches_the_contacts_and_every_system_administrator(world):
    w = world
    bind(w["c"], w["settings"], "rina", "system_admin", "installation", "*")
    rina, admin, dana = _user_id(w, "rina"), _admin_id(w), _user_id(w, "dana")
    with w["db"].connection() as conn:
        bkn.set_contacts(conn, [rina], actor=None)
        assert bkn.recipient_users(conn) == [rina, admin]  # the contact first, then the other administrators
        out = bkn.queue(conn, bkn.SOURCE_ATTENTION, "test:1", severity="critical", detail="בדיקה", code="test")
    assert out == "created"
    row = _notices(w)[0]
    with w["db"].connection(mode="read") as conn:
        got = {r["user_id"] for r in conn.execute("SELECT user_id FROM notification_recipients WHERE notification_id = ?", (row["id"],)).fetchall()}
    assert got == {rina, admin} and dana not in got
    assert row["severity"] == "critical" and row["subject_kind"] == "system" and row["category"] == "security"
    sent = _audits(w, "bridge.rotation.notice_sent")
    assert sent and json.loads(sent[-1]["details_json"]) == {"source": bkn.SOURCE_ATTENTION, "code": "test", "outcome": "created", "recipients": 2}


def test_a_failing_notice_never_undoes_the_callers_work(world, monkeypatch):
    w = world

    def boom(conn, signal):
        conn.execute("INSERT INTO settings(key, value) VALUES ('wxh.half_written', 'x')")  # written inside the savepoint, then rolled back
        raise RuntimeError("synthetic failure")

    monkeypatch.setattr(notify, "emit_full", boom)
    with w["db"].connection() as conn:
        set_setting(conn, "wxh.caller_work", "done")
        assert bkn.queue(conn, bkn.SOURCE_REVOKED, "x:1", code="emergency_revocation") == "failed"
    with w["db"].connection(mode="read") as conn:
        assert get_setting(conn, "wxh.caller_work") == "done"
        assert get_setting(conn, "wxh.half_written") is None
    sent = _audits(w, "bridge.rotation.notice_sent")
    assert sent[-1]["decision"] == "denied" and sent[-1]["reason"] == "failed"


def test_the_emergency_notice_is_one_row_per_revocation_and_only_the_revocation_sends_it(world):
    w = world
    with w["db"].connection() as conn:
        assert bkn.emergency(conn, actor=None, revocation_id="rev-1") == "created"
        assert bkn.emergency(conn, actor=None, revocation_id="rev-2") == "created"
    rows = _notices(w)
    assert len(rows) == 2 and {r["severity"] for r in rows} == {"critical"} and {r["source"] for r in rows} == {bkn.SOURCE_REVOKED}
    assert all("מפתח" in r["title"] for r in rows)
    # WXH4-EMERGENCY-REVOKE-2407: the revocation service is the one caller of the notice (no router calls it directly)
    callers = []
    for path in (BACKEND / "smplwise").rglob("*.py"):
        text = path.read_text(encoding="utf-8")
        if "bkn.emergency(" in text or "bridge_key_notice.emergency(" in text:
            callers.append(path.relative_to(BACKEND).as_posix())
    assert callers == ["smplwise/services/bridge_key_revocation.py"]


def test_the_banner_shows_an_open_notice_while_no_contact_is_set(world):
    w = world
    assert w["c"].get(f"{API}/system/bridge-key/notice").json()["show"] is False
    with w["db"].connection() as conn:
        bkn.queue(conn, bkn.SOURCE_ATTENTION, "banner:1", detail="בדיקה", code="test")
    b = w["c"].get(f"{API}/system/bridge-key/notice").json()
    assert b == {"show": True, "open": 1, "contacts_set": False}
    assert w["c"].get(f"{API}/system/bridge-key").json()["notice_banner"]["show"] is True
    # a contact set: the banner goes (the notice itself stays in the center)
    w["c"].put(f"{API}/system/bridge-key/owner-contacts", json={"user_ids": [_admin_id(w)]})
    assert w["c"].get(f"{API}/system/bridge-key/notice").json()["show"] is False
    w["c"].put(f"{API}/system/bridge-key/owner-contacts", json={"user_ids": []})
    assert w["c"].get(f"{API}/system/bridge-key/notice").json()["show"] is True
    # acknowledged in the notification center: the banner goes
    nid = _notices(w)[0]["id"]
    assert w["c"].post(f"{API}/notifications/{nid}/ack").status_code in (200, 204)
    assert w["c"].get(f"{API}/system/bridge-key/notice").json()["show"] is False


# ================================================================ watchdog

def test_overlap_overdue_is_reported_once_and_cleared(world):
    w = world
    _rotation(w, "switched", age_s=br.CAP_S + wd.GRACE_S - 30)
    assert wd.check(w["db"]) == []
    _rotation(w, "switched", age_s=br.CAP_S + wd.GRACE_S + 30)
    assert wd.check(w["db"]) == ["overlap_overdue"]
    assert wd.check(w["db"]) == ["overlap_overdue"]  # not reported twice
    rows = _audits(w, "bridge.rotation.overlap_overdue")
    assert len(rows) == 1 and rows[0]["resource_id"] == "rot-wxh-1" and rows[0]["reason"] == "overlap_overdue"
    open_ = _notices(w, "open")
    assert len(open_) == 1 and open_[0]["severity"] == "critical"
    with w["db"].connection(mode="read") as conn:
        assert "overlap_overdue:rot-wxh-1" in wd.reported(conn)
    # the rotation finished: the notice resolves, the clearing is audited
    with w["db"].connection() as conn:
        conn.execute("UPDATE bridge_rotations SET state = 'verified', ended_at = ?", (now_iso(),))
    assert wd.check(w["db"]) == []
    assert not _notices(w, "open") and len(_notices(w, "resolved")) == 1
    assert [json.loads(a["details_json"])["code"] for a in _audits(w, "bridge.key.watchdog") if a["reason"] == "cleared"] == ["overlap_overdue"]
    with w["db"].connection(mode="read") as conn:
        assert wd.reported(conn) == {}


def test_a_rotation_without_t0_counts_from_its_start(world):
    _rotation(world, "prepared", age_s=br.CAP_S + wd.GRACE_S + 5, t0=False)
    assert wd.check(world["db"]) == ["overlap_overdue"]


@pytest.mark.parametrize("state", ["needs_repair", "verify_failed"])
def test_a_stuck_or_unverified_rotation_is_reported(world, state):
    _rotation(world, state, age_s=5)
    assert wd.check(world["db"]) == [state]
    rows = [a for a in _audits(world, "bridge.key.watchdog") if a["reason"] == state]
    assert len(rows) == 1
    assert _notices(world, "open")[0]["severity"] == wd.SEVERITY[state]


@pytest.mark.parametrize("state", ["verified", "rolled_back", "retired"])
def test_a_finished_rotation_is_not_reported(world, state):
    _rotation(world, state, age_s=10_000)
    assert wd.check(world["db"]) == []
    assert not _notices(world)


def test_generation_mismatch_from_a_verified_push(world):
    w = world
    ks = keyset_mod.KeySet(LEGACY, None)

    def push(gen=None):
        body = {"users": [], "version": "0.10.5"}
        if gen is not None:
            body["key_generation"] = gen
        r = w["c"].post(f"{API}/ha/bridge/directory", json=ks.sign(body, ts=int(time.time())))
        assert r.status_code == 200, r.text
        return r.json()

    with w["db"].write_aside() as conn:
        bk.adopt_legacy(conn, w["settings"].data_dir)  # generation 0
    push()  # an older bridge reports nothing: never a mismatch
    assert wd.check(w["db"]) == []
    push(0)
    assert wd.check(w["db"]) == []
    push(3)
    with w["db"].connection(mode="read") as conn:
        assert peers.reported_key_generation(conn)["generation"] == 3
    assert wd.check(w["db"]) == ["generation_mismatch"]
    assert w["c"].get(f"{API}/system/bridge-key").json()["watchdog"][0]["code"] == "generation_mismatch"
    # a running rotation is never a mismatch (the generations differ by design during the overlap)
    _rotation(w, "switched", age_s=5)
    assert "generation_mismatch" not in wd.check(w["db"])
    with w["db"].connection() as conn:
        conn.execute("DELETE FROM bridge_rotations")
    push(0)
    assert wd.check(w["db"]) == []
    # junk is ignored
    for junk in (True, -1, "3", 10**9):
        with w["db"].connection() as conn:
            peers.note_key_generation(conn, junk)
            assert peers.reported_key_generation(conn)["generation"] == 0


def test_the_watchdog_never_drives_a_rotation_or_calls_the_bridge(world):
    w = world
    peer = CountingPeer()
    peers.set_peer_for_tests(peer)
    _rotation(w, "switching", age_s=br.CAP_S + wd.GRACE_S + 30)
    with w["db"].connection(mode="read") as conn:
        before = dict(conn.execute("SELECT * FROM bridge_rotations").fetchone())
    assert wd.check(w["db"]) == ["overlap_overdue"]
    with w["db"].connection(mode="read") as conn:
        after = dict(conn.execute("SELECT * FROM bridge_rotations").fetchone())
        assert conn.execute("SELECT COUNT(*) FROM bridge_rotations").fetchone()[0] == 1
    assert before == after and peer.calls == []


def test_the_watchdog_module_names_no_engine_peer_or_door_call():
    src = (BACKEND / "smplwise" / "services" / "bridge_key_watchdog.py").read_text(encoding="utf-8")
    tree = ast.parse(src)
    called = {(n.func.attr if isinstance(n.func, ast.Attribute) else getattr(n.func, "id", None)) for n in ast.walk(tree) if isinstance(n, ast.Call)}
    forbidden = {"Engine", "start", "resume", "tick", "worker_pass", "call", "set_state", "reset_set", "adopt_legacy", "open_door", "release_door",
                 "hold_command", "door_commands_paused", "sign", "sign_with"}
    assert not (called & forbidden), called & forbidden
    from test_fake_doorwin_closed_rule_sr1 import TIMER_SHAPED, scan

    assert TIMER_SHAPED.search("bridge_key_watchdog"), "the watchdog stays under SR-1's timer-shaped rule"
    opens, locks, writes = scan()
    assert not {m for m, _ in opens | locks | writes if m.endswith("bridge_key_watchdog.py")}


def test_worker_pass_runs_the_watchdog_and_still_starts_nothing_while_wiskey_is_present(world, monkeypatch):
    w = world
    monkeypatch.setattr(br, "wiskey_present", lambda: True)
    peer = CountingPeer()
    with w["db"].write_aside() as conn:
        bk.adopt_legacy(conn, w["settings"].data_dir)
        conn.execute("UPDATE bridge_keys SET activated_at = '2020-01-01T00:00:00Z', created_at = '2020-01-01T00:00:00Z' WHERE state = 'current'")
        conn.execute("UPDATE bridge_keys SET kid = 'g1-bbbbbbbb', generation = 1 WHERE state = 'current'")  # not the legacy key: a LATER rotation
        set_setting(conn, br.REMINDER_KEY, "30")
    with w["db"].connection(mode="read") as conn:
        assert br.reminder_due(conn) is True and br.auto_due(conn, peer, time.time()) is False  # the WisKey block holds
    _rotation(w, "needs_repair", age_s=5)
    assert br.worker_pass(w["db"], w["settings"], peer) is None
    with w["db"].connection(mode="read") as conn:
        assert conn.execute("SELECT COUNT(*) FROM bridge_rotations").fetchone()[0] == 1
        assert "needs_repair:rot-wxh-1" in wd.reported(conn)
        v = br.view(conn, w["settings"].data_dir, peer)
    assert v["blocked_by"] == "wiskey_present" and v["can_start"] is False and v["automatic"] == "off"
    assert peer.calls == []


# ================================================================ capability status hand-over

def test_key_status_carries_generations_and_outcomes_never_key_material(world):
    w = world
    with w["db"].connection(mode="read") as conn:
        st = br.key_status(conn)
    assert st == {"protocol": br.KEY_STATUS_PROTOCOL, "key_generation": 0, "rotation_active": False, "last_rotation": None, "anchor_decrease_available": False}
    _rotation(w, "verified", mode="hard_cut", anchor=1)
    with w["db"].connection(mode="read") as conn:
        last = br.key_status(conn)["last_rotation"]
    assert last["verified_old_rejected"] is True and last["anchor_eligible"] is True and last["mode"] == "hard_cut" and last["gen_to"] == 1
    _rotation(w, "verified", mode="routine")
    with w["db"].connection(mode="read") as conn:
        assert br.key_status(conn)["last_rotation"]["anchor_eligible"] is False
    _rotation(w, "needs_repair")
    with w["db"].connection(mode="read") as conn:
        st = br.key_status(conn)
    assert st["last_rotation"]["verified_old_rejected"] is False and st["last_rotation"]["anchor_eligible"] is False
    assert st["anchor_decrease_available"] is False  # R-25: no WisKey high-water mechanism yet
    _rotation(w, "switched")
    with w["db"].connection(mode="read") as conn:
        st = br.key_status(conn)
    assert st["rotation_active"] is True
    assert LEGACY not in json.dumps(st) and "kid" not in json.dumps(st)


def test_the_directory_answer_carries_a_signed_key_status_and_the_ping_refuses_it(world):
    w = world
    ks = keyset_mod.KeySet(LEGACY, None)
    r = w["c"].post(f"{API}/ha/bridge/directory", json=ks.sign({"users": [], "version": "0.10.5"}, ts=int(time.time())))
    assert r.status_code == 200, r.text
    ans = r.json()
    status = ans["key_status"]
    assert status["purpose"] == "key_status" and status["protocol"] == br.KEY_STATUS_PROTOCOL and status["key_generation"] == 0
    assert signing_mod.Verifier(LEGACY).verify(dict(status)) is None  # what a bridge holding the pairing code verifies today
    assert LEGACY not in json.dumps(ans)
    assert "cast" in ans  # the existing field is unchanged
    # reflected back at Arx's ping, an Arx-signed `purpose` message is refused before anything happens
    with w["db"].connection(mode="read") as conn:
        paired = get_setting(conn, "bridge.paired_at")
    p = w["c"].post(f"{API}/ha/bridge/ping", json=status)
    assert p.status_code == 422 and p.json()["code"] == "bridge_bad_request"
    with w["db"].connection(mode="read") as conn:
        assert get_setting(conn, "bridge.paired_at") == paired
    # an honest ping still pairs
    assert w["c"].post(f"{API}/ha/bridge/ping", json=signing_mod.sign(LEGACY, {"version": "0.10.5"})).status_code == 200


def test_the_card_view_carries_the_leftovers(world):
    v = world["c"].get(f"{API}/system/bridge-key").json()
    assert set(v) >= {"owner_contacts", "notice_banner", "watchdog", "hand_over"}
    assert v["hand_over"] == {"key_generation": 0, "last_rotation": None, "anchor_decrease_available": False, "bridge_generation": None}
    assert v["watchdog"] == [] and v["owner_contacts"]["set"] is False


def test_the_wiskey_block_and_its_reason_are_unchanged(world, monkeypatch):
    """2.39.1: no rotation starts while WisKey is present - by click, by the worker - whatever the new settings say."""
    w = world
    monkeypatch.setattr(br, "wiskey_present", lambda: True)
    monkeypatch.setattr(br, "peer_available", lambda peer=None: True)
    w["c"].put(f"{API}/system/bridge-key/owner-contacts", json={"user_ids": [_admin_id(w)]})
    r = w["c"].post(f"{API}/system/bridge-key/rotations", json={"mode": "routine", "confirm": True})
    assert r.status_code == 409 and r.json()["code"] == "wiskey_present"
    with w["db"].connection(mode="read") as conn:
        assert not bk.adopted(conn) and conn.execute("SELECT COUNT(*) FROM bridge_rotations").fetchone()[0] == 0
