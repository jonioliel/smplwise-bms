"""WXH4-EMERGENCY-REVOKE-2407: the emergency revocation of the bridge key and the re-pair with a fresh pairing code (CR-034 section 8),
built on the owner's answers of 07.11:

1. the new code reaches the bridge through the EXISTING re-pair path (Arx's discovery message; the bridge checks it with a signed ping
   before it takes it); the manual entry in the bridge (bridge 0.10.6 "Reconfigure") is the fallback; nothing relies on the old key;
2. any system administrator may reveal the new code after a fresh re-authentication (their own authenticator code); every reveal and
   every refused attempt is audited;
3. allowed while WisKey is installed, after the dialog's warning was acknowledged;
4. the notice NAMES the administrator; the audit keeps the name and the time;
5. an administrator may switch the bridge-key notices off like any other source (the revocation still happens, the audit says so);
6. never blocked for want of an owner contact (the notice reaches every system administrator).
State machine: revoked -> every bridge operation blocked (outbound signing, inbound messages, rotations, the old code routes) -> re-paired
when the bridge proves the new code.

Fakes and synthetic data only; nothing contacts a bridge, WisKey, a Supervisor or Home Assistant."""
from __future__ import annotations

import asyncio
import base64
import json
import sys
import time
from pathlib import Path
from typing import Any

import pytest
from conftest import as_user, bind
from fastapi.testclient import TestClient

from smplwise.db import Database, get_setting, set_setting
from smplwise.errors import ApiError
from smplwise.main import create_app
from smplwise.services import backup, bridge_install
from smplwise.services import bridge_key_notice as bkn
from smplwise.services import bridge_key_revocation as bkr
from smplwise.services import bridge_keys as bk
from smplwise.services import bridge_rotation as br
from smplwise.services import bridge_rotation_peer as peers
from smplwise.services import ha_bridge
from smplwise.services import second_factor as sf

sys.path.insert(0, str(Path(__file__).resolve().parent))
import test_bridge_stale_discovery_2383 as h  # noqa: E402 - the bridge's REAL config flow under the minimal Home Assistant stub

ROOT = Path(__file__).resolve().parents[3]
BACKEND = Path(__file__).resolve().parents[1]
LEGACY = "synthetic-legacy-pairing-code-wxh4-2407"
API = "/api/v1"
REVOKE = f"{API}/system/bridge-key/revoke"
REVEAL = f"{API}/system/bridge-key/revoke/reveal"


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
    announced: list[int] = []

    def fake_announce(db_, settings_, conn=None):
        announced.append(1)
        return False  # the automatic path closed (no Supervisor in tests) unless a test says otherwise

    monkeypatch.setattr(bridge_install, "announce_discovery", fake_announce)
    peers.set_peer_for_tests(None)
    yield {"c": c, "db": db, "settings": settings, "announced": announced}
    peers.set_peer_for_tests(None)
    bk.reset_for_tests()


def _uid(w, username: str) -> str:
    with w["db"].connection(mode="read") as conn:
        return conn.execute("SELECT id FROM users WHERE username = ?", (username,)).fetchone()["id"]


def _admin(w) -> str:
    with w["db"].connection(mode="read") as conn:
        return bkn.system_admins(conn)[0]


def _audits(w, action: str) -> list:
    with w["db"].connection(mode="read") as conn:
        return conn.execute("SELECT * FROM audit_log WHERE action = ? ORDER BY rowid", (action,)).fetchall()


def _details(row) -> dict[str, Any]:
    return json.loads(row["details_json"] or "{}")


def _setting(w, key: str) -> str | None:
    with w["db"].connection(mode="read") as conn:
        return get_setting(conn, key)


def _revoke(w, headers: dict[str, str] | None = None, **body: Any):
    return w["c"].post(REVOKE, json={"confirm": True, **body}, headers=headers or {})


def _enrol(w, user_id: str) -> bytes:
    """An active authenticator for `user_id` (the step-up of the reveal). Returns its secret for computing codes."""
    with w["db"].connection() as conn:
        out = sf.begin_enrolment(conn, w["settings"], user_id, "t")
        secret = base64.b32decode(out["secret"] + "=" * (-len(out["secret"]) % 8))
        sf.confirm(conn, w["settings"], user_id, sf.hotp(secret, sf.step_of()))
        conn.execute("UPDATE auth_totp SET last_step = last_step - 100 WHERE user_id = ?", (user_id,))  # the same 30 s step may be used again
    return secret


def _code_now(secret: bytes) -> str:
    return sf.hotp(secret, sf.step_of())


def _forget_step(w, user_id: str) -> None:
    with w["db"].connection() as conn:
        conn.execute("UPDATE auth_totp SET last_step = last_step - 100 WHERE user_id = ?", (user_id,))


# ================================================================ the revocation

def test_revoke_wipes_the_key_makes_a_new_code_and_is_audited_with_name_and_time(world):
    w = world
    with w["db"].connection() as conn:
        bk.adopt_legacy(conn, w["settings"].data_dir)  # a key set exists (as after the first rotation)
        assert bk.adopted(conn)
    r = _revoke(w)
    assert r.status_code == 200, r.text
    out = r.json()
    assert out["revoked"] is True and out["revocation_id"].startswith("rev-") and out["announced"] is False and w["announced"] == [1]
    assert out["status"]["revocation"]["state"] == "revoked" and out["status"]["blocked_by"] == "bridge_revoked"
    with w["db"].connection(mode="read") as conn:
        live = conn.execute("SELECT COUNT(*) FROM bridge_keys WHERE state IN ('pending','next','current','retiring')").fetchone()[0]
        blobs = conn.execute("SELECT COUNT(*) FROM bridge_keys WHERE value_enc IS NOT NULL").fetchone()[0]
        new = get_setting(conn, "bridge.secret")
        assert live == 0 and blobs == 0, "every key of the set is wiped"
        assert new and new != LEGACY and get_setting(conn, "bridge.paired_at") == ""
        assert bkr.is_revoked(conn)
    rows = _audits(w, "bridge.key.revoked")
    assert len(rows) == 1 and rows[0]["decision"] == "allowed" and rows[0]["actor_user_id"] == _admin(w)
    d = _details(rows[0])
    assert d["revocation_id"] == out["revocation_id"] and d["actor_name"] and d["at"] and d["keys_wiped"] == 1
    assert LEGACY not in json.dumps(out) and new not in json.dumps(out) and new not in rows[0]["details_json"], "the code never leaves in an answer or audit"


def test_revoke_needs_a_system_administrator_and_a_confirmation(world):
    w = world
    r = _revoke(w, headers=as_user("dana"))
    assert r.status_code == 403
    bind(w["c"], w["settings"], "cfg", "site_admin", "installation", "*")
    assert _revoke(w, headers=as_user("cfg")).status_code == 403
    assert w["c"].post(REVOKE, json={"confirm": False}).status_code == 422
    assert w["c"].post(REVOKE, json={"confirm": True, "x": 1}).status_code == 422
    assert _setting(w, "bridge.secret") == LEGACY and _setting(w, bkr.STATE_KEY) is None, "nothing happened"


def test_the_notice_names_the_administrator_and_reaches_every_admin_without_an_owner_contact(world):
    """Decisions 4 and 6: the button is not blocked without an owner contact; the notice names who revoked, to every system administrator."""
    w = world
    bind(w["c"], w["settings"], "rina", "system_admin", "installation", "*")
    admin, rina, dana = _admin(w), _uid(w, "rina"), _uid(w, "dana")
    with w["db"].connection(mode="read") as conn:
        assert bkn.valid_contacts(conn) == []
        name = bkr.actor_name(conn, type("P", (), {"user_id": admin})())
    r = _revoke(w)
    assert r.status_code == 200 and r.json()["notice"] == "created"
    with w["db"].connection(mode="read") as conn:
        n = conn.execute("SELECT * FROM notifications WHERE source = ?", (bkn.SOURCE_REVOKED,)).fetchone()
        got = {x["user_id"] for x in conn.execute("SELECT user_id FROM notification_recipients WHERE notification_id = ?", (n["id"],)).fetchall()}
    assert n["severity"] == "critical" and name and n["body"].startswith(name), n["body"]
    assert got == {admin, rina} and dana not in got
    sent = _audits(w, "bridge.rotation.notice_sent")
    assert _details(sent[-1])["code"] == "emergency_revocation" and _details(sent[-1])["recipients"] == 2


def test_an_administrator_may_switch_the_notice_off_and_the_revocation_still_happens(world):
    """Decision 5: the bridge-key notices are ordinary sources."""
    w = world
    for src in bkn.SOURCES:
        r = w["c"].put(f"{API}/notify/policies/{src}", json={"enabled": False})
        assert r.status_code == 200 and r.json()["enabled"] is False, r.text
    r = _revoke(w)
    assert r.status_code == 200 and r.json()["notice"] == "disabled"
    with w["db"].connection(mode="read") as conn:
        assert conn.execute("SELECT COUNT(*) FROM notifications WHERE source = ?", (bkn.SOURCE_REVOKED,)).fetchone()[0] == 0
        assert bkr.is_revoked(conn)
    sent = _audits(w, "bridge.rotation.notice_sent")[-1]
    assert sent["decision"] == "denied" and sent["reason"] == "disabled"


def test_a_failing_notice_never_blocks_the_revocation(world, monkeypatch):
    w = world
    from smplwise.services import notify

    def boom(conn, signal):
        raise RuntimeError("synthetic failure")

    monkeypatch.setattr(notify, "emit_full", boom)
    r = _revoke(w)
    assert r.status_code == 200 and r.json()["notice"] == "failed"
    with w["db"].connection(mode="read") as conn:
        assert bkr.is_revoked(conn) and get_setting(conn, "bridge.secret") != LEGACY


def test_revoke_is_allowed_with_wiskey_installed_only_after_the_warning_is_acknowledged(world, monkeypatch):
    """Decision 3."""
    w = world
    monkeypatch.setattr(br, "wiskey_present", lambda: True)
    assert w["c"].get(f"{API}/system/bridge-key").json()["revocation"]["wiskey_present"] is True
    r = _revoke(w)
    assert r.status_code == 409 and r.json()["code"] == "wiskey_ack_required"
    assert _audits(w, "bridge.key.revoked")[-1]["reason"] == "wiskey_ack_required"
    assert _setting(w, "bridge.secret") == LEGACY
    r = _revoke(w, wiskey_acknowledged=True)
    assert r.status_code == 200, r.text
    assert _details(_audits(w, "bridge.key.revoked")[-1])["wiskey_present"] is True


def test_revoke_closes_an_unfinished_rotation_and_waits_for_a_running_step(world, monkeypatch):
    w = world
    at = time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime())
    with w["db"].connection() as conn:
        conn.execute("INSERT INTO bridge_rotations(id, mode, state, kid_from, kid_to, gen_from, gen_to, overlap_s, started_at, t0_at, ended_at, anchor_eligible) "
                     "VALUES ('rot-x', 'routine', 'needs_repair', 'g0-legacy', 'g1-aaaaaaaa', 0, 1, 90, ?, ?, NULL, 0)", (at, at))
    monkeypatch.setattr(bkr, "LOCK_WAIT_S", 0.05)
    assert br._LOCK.acquire(blocking=False)
    try:
        r = _revoke(w)
        assert r.status_code == 409 and r.json()["code"] == "revoke_busy", "a rotation step holds the lock: nothing interleaves"
    finally:
        br._LOCK.release()
    assert _revoke(w).status_code == 200
    with w["db"].connection(mode="read") as conn:
        row = conn.execute("SELECT state, result_code FROM bridge_rotations WHERE id = 'rot-x'").fetchone()
    assert row["state"] == "rolled_back" and row["result_code"] == "repaired"


# ================================================================ while revoked: every bridge operation is blocked

def test_while_revoked_nothing_is_signed_or_accepted_and_no_rotation_runs(world, monkeypatch):
    w = world
    monkeypatch.setattr(br, "peer_available", lambda peer=None: True)
    assert _revoke(w).status_code == 200
    new = _setting(w, "bridge.secret")
    with w["db"].connection(mode="read") as conn:
        assert ha_bridge.signing_key(conn) is None, "outbound: nothing is signed (doors, devices, casts, leases, WisKey)"
        for code in (LEGACY, new):
            with pytest.raises(ApiError) as exc:
                ha_bridge.verify_message(conn, ha_bridge.sign(code, {"users": []}))
            assert exc.value.status == 401 and exc.value.code == "bridge_revoked"
        assert br.auto_due(conn, peers.get_peer(w["db"], w["settings"]), time.time()) is False
    # inbound pushes refused, with the old code and even with the new one (only the pairing ping may use it)
    for code in (LEGACY, new):
        r = w["c"].post(f"{API}/ha/bridge/directory", json=ha_bridge.sign(code, {"users": [], "version": "0.10.6"}))
        assert r.status_code == 401 and r.json()["code"] == "bridge_revoked"
    # rotations neither start nor resume
    w["c"].put(f"{API}/system/bridge-key/settings", json={"enabled": True})
    r = w["c"].post(f"{API}/system/bridge-key/rotations", json={"mode": "routine", "confirm": True})
    assert r.status_code == 409 and r.json()["code"] == "bridge_revoked"
    r = w["c"].post(f"{API}/system/bridge-key/rotations/rot-none/resume")
    assert r.status_code == 409 and r.json()["code"] == "bridge_revoked"
    v = w["c"].get(f"{API}/system/bridge-key").json()
    assert v["can_start"] is False and v["blocked_by"] == "bridge_revoked"


def test_while_revoked_the_old_code_routes_never_hand_out_the_new_code(world):
    w = world
    assert _revoke(w).status_code == 200
    new = _setting(w, "bridge.secret")
    r = w["c"].get(f"{API}/ha/bridge/pairing")
    assert r.status_code == 200 and r.json()["pairing_code"] is None and r.json()["revoked"] is True and new not in r.text
    r = w["c"].get(f"{API}/ha/bridge/pairing", params={"regenerate": "true"})
    assert r.status_code == 409 and r.json()["code"] == "bridge_revoked"
    assert _setting(w, "bridge.secret") == new, "the regenerate did nothing"
    r = w["c"].post(f"{API}/system/wiskey-pairing/repair", json={"confirm": True})
    assert r.status_code == 409 and r.json()["code"] == "bridge_revoked" and new not in r.text


# ================================================================ the re-pair

def test_the_old_code_never_re_pairs_and_the_new_code_does(world):
    w = world
    rid = _revoke(w).json()["revocation_id"]
    new = _setting(w, "bridge.secret")
    r = w["c"].post(f"{API}/ha/bridge/ping", json=ha_bridge.sign(LEGACY, {"version": "0.10.6"}))
    assert r.status_code == 401
    with w["db"].connection(mode="read") as conn:
        assert bkr.is_revoked(conn)
    r = w["c"].post(f"{API}/ha/bridge/ping", json=ha_bridge.sign(new, {"version": "0.10.6"}))
    assert r.status_code == 200, r.text
    with w["db"].connection(mode="read") as conn:
        s = bkr.state(conn)
        assert s["state"] == "repaired" and s["repaired_at"] and s["id"] == rid
        assert ha_bridge.signing_key(conn) == new, "signing works again - with the NEW code only"
    rep = _audits(w, "bridge.key.repaired")
    assert len(rep) == 1 and _details(rep[0])["revocation_id"] == rid
    # the old code stays dead after the re-pair; the new code's pushes are accepted again
    assert w["c"].post(f"{API}/ha/bridge/directory", json=ha_bridge.sign(LEGACY, {"users": [], "version": "0.10.6"})).status_code == 401
    assert w["c"].post(f"{API}/ha/bridge/directory", json=ha_bridge.sign(new, {"users": [], "version": "0.10.6"})).status_code == 200
    v = w["c"].get(f"{API}/system/bridge-key").json()
    assert v["revocation"]["state"] == "repaired" and v["blocked_by"] != "bridge_revoked"


def test_a_second_revocation_replaces_the_code_and_the_first_one_dies(world):
    w = world
    first = _revoke(w).json()["revocation_id"]
    code1 = _setting(w, "bridge.secret")
    second = _revoke(w).json()["revocation_id"]
    code2 = _setting(w, "bridge.secret")
    assert first != second and code1 != code2
    assert _details(_audits(w, "bridge.key.revoked")[-1])["replaces"] == first
    assert w["c"].post(f"{API}/ha/bridge/ping", json=ha_bridge.sign(code1, {"version": "0.10.6"})).status_code == 401
    assert w["c"].post(f"{API}/ha/bridge/ping", json=ha_bridge.sign(code2, {"version": "0.10.6"})).status_code == 200


def test_the_automatic_path_announces_the_new_code(world, monkeypatch):
    """Decision 1: the new code goes out through the existing re-pair path (Arx's own discovery message) when it is open."""
    w = world
    seen: list[str | None] = []

    def announce(db_, settings_, conn=None):
        with db_.connection(mode="read") as c:
            seen.append(get_setting(c, "bridge.secret"))
        return True

    monkeypatch.setattr(bridge_install, "announce_discovery", announce)
    r = _revoke(w)
    assert r.status_code == 200 and r.json()["announced"] is True
    assert seen == [_setting(w, "bridge.secret")] and seen[0] != LEGACY, "announced after the commit, with the NEW code"


# ================================================================ the reveal (decision 2)

def test_reveal_needs_a_revocation_and_the_callers_own_fresh_authenticator_code(world):
    w = world
    admin = _admin(w)
    r = w["c"].post(REVEAL, json={"code": "123456"})
    assert r.status_code == 409 and r.json()["code"] == "not_revoked"
    assert _revoke(w).status_code == 200
    new = _setting(w, "bridge.secret")
    # no authenticator of their own -> no reveal (the card says how to enable one)
    v = w["c"].get(f"{API}/system/bridge-key").json()["revocation"]
    assert v["step_up_ready"] is False
    r = w["c"].post(REVEAL, json={})
    assert r.status_code == 403 and r.json()["code"] == "step_up_unavailable" and new not in r.text
    secret = _enrol(w, admin)
    assert w["c"].get(f"{API}/system/bridge-key").json()["revocation"]["step_up_ready"] is True
    r = w["c"].post(REVEAL, json={})
    assert r.status_code == 403 and r.json()["code"] == "step_up_required"
    wrong = "000000" if _code_now(secret) != "000000" else "111111"
    r = w["c"].post(REVEAL, json={"code": wrong})
    assert r.status_code == 403 and r.json()["code"] == "second_factor_invalid" and new not in r.text
    r = w["c"].post(REVEAL, json={"code": _code_now(secret)})
    assert r.status_code == 200, r.text
    assert r.json()["pairing_code"] == new and r.json()["addon_url"]
    rows = _audits(w, "bridge.key.code_revealed")
    reasons = [x["reason"] for x in rows if x["decision"] == "denied"]
    assert reasons == ["not_revoked", "step_up_unavailable", "step_up_required", "step_up_invalid"]
    ok = [x for x in rows if x["decision"] == "allowed"]
    assert len(ok) == 1 and _details(ok[0])["actor_name"] and _details(ok[0])["at"] and ok[0]["actor_user_id"] == admin
    assert all(new not in (x["details_json"] or "") for x in rows), "the code is never audited"
    # the same code twice inside one step is a replay
    r = w["c"].post(REVEAL, json={"code": _code_now(secret)})
    assert r.status_code == 403 and r.json()["code"] == "second_factor_invalid"
    with w["db"].connection(mode="read") as conn:
        assert bkr.state(conn)["reveals"] == 1


def test_any_system_administrator_may_reveal_but_nobody_else(world):
    w = world
    bind(w["c"], w["settings"], "rina", "system_admin", "installation", "*")
    bind(w["c"], w["settings"], "cfg", "site_admin", "installation", "*")
    rina = _uid(w, "rina")
    assert _revoke(w).status_code == 200
    secret = _enrol(w, rina)
    r = w["c"].post(REVEAL, json={"code": _code_now(secret)}, headers=as_user("rina"))
    assert r.status_code == 200 and r.json()["pairing_code"] == _setting(w, "bridge.secret")
    assert _audits(w, "bridge.key.code_revealed")[-1]["actor_user_id"] == rina
    _forget_step(w, rina)
    for who in ("dana", "cfg"):
        assert w["c"].post(REVEAL, json={"code": _code_now(secret)}, headers=as_user(who)).status_code == 403


def test_after_the_re_pair_the_code_is_no_longer_revealed(world):
    w = world
    secret = _enrol(w, _admin(w))
    assert _revoke(w).status_code == 200
    new = _setting(w, "bridge.secret")
    assert w["c"].post(f"{API}/ha/bridge/ping", json=ha_bridge.sign(new, {"version": "0.10.6"})).status_code == 200
    r = w["c"].post(REVEAL, json={"code": _code_now(secret)})
    assert r.status_code == 409 and r.json()["code"] == "not_revoked"


def test_reveal_and_revoke_are_local_only():
    from smplwise import remote_channel

    assert any(REVOKE.startswith(p) and REVEAL.startswith(p) for p in remote_channel.BLOCKED_ON_REMOTE)


def test_the_revocation_never_comes_from_an_archive():
    assert backup._kept_setting(bkr.STATE_KEY)


# ================================================================ the bridge: the manual re-pair (0.10.6 Reconfigure)

class _Entries:
    def __init__(self, hass) -> None:
        self.hass = hass
        self.scheduled: list[str] = []

    def async_get_entry(self, entry_id):
        return next((e for e in self.hass.entries.values() if e.entry_id == entry_id), None)

    def async_update_entry(self, entry, *, data):
        if data != entry.data:
            entry.data = dict(data)
            for listener in list(entry.update_listeners):
                out = listener(self.hass, entry)
                if out is not None:
                    self.hass.pending.append(out)

    def async_schedule_reload(self, entry_id):
        self.scheduled.append(entry_id)


def _reconfigure(hass, entry, user_input=None) -> dict[str, Any]:
    flow_mod = h._load("config_flow")
    flow = flow_mod.SmplwiseBridgeConfigFlow()
    flow.hass, flow.context, flow.unique_id = hass, {"source": "reconfigure", "entry_id": entry.entry_id if entry else "nope"}, None
    try:
        return asyncio.run(flow.async_step_reconfigure(user_input))
    except h.AbortFlow as exc:
        return {"type": "abort", "reason": exc.reason}


def _hass(arx) -> Any:
    hass = h.FakeHass(arx)
    hass.config_entries = _Entries(hass)
    return hass


def test_bridge_reconfigure_takes_a_new_code_only_when_arx_accepts_it():
    old, new = h._code(), h._code()
    arx = {"code": new}
    hass = _hass(h.arx_verifier(arx))
    entry = h.FakeEntry({"addon_url": h.URL, "pairing_code": old})
    listened: list[dict] = []
    entry.update_listeners.append(lambda _h, e: listened.append(dict(e.data)))
    hass.entries["smplwise_bridge"] = entry
    form = _reconfigure(hass, entry)
    assert form["type"] == "form" and form["step_id"] == "reconfigure" and hass.session.calls == []
    # a refused code changes nothing and says why
    out = _reconfigure(hass, entry, {"addon_url": h.URL, "pairing_code": h._code()})
    assert out["type"] == "form" and out["errors"] == {"base": "invalid_auth"} and entry.data["pairing_code"] == old and not listened
    out = _reconfigure(hass, entry, {"addon_url": h.URL, "pairing_code": "  "})
    assert out["errors"] == {"base": "invalid_auth"} and len(hass.session.calls) == 1, "an empty code is never sent"
    hass.session.unreachable = True
    assert _reconfigure(hass, entry, {"addon_url": h.URL, "pairing_code": new})["errors"] == {"base": "cannot_connect"}
    hass.session.unreachable = False
    # the accepted code: the entry is updated, its listener (the loaded bridge) reloads it - never a flow reload
    out = _reconfigure(hass, entry, {"addon_url": h.URL + "/", "pairing_code": f" {new} "})
    assert out == {"type": "abort", "reason": "reconfigure_successful"}
    assert entry.data["pairing_code"] == new and entry.data["addon_url"] == h.URL and listened and hass.config_entries.scheduled == []


def test_bridge_reconfigure_reloads_an_entry_without_a_listener_and_keeps_the_options():
    new = h._code()
    hass = _hass(h.arx_verifier({"code": new}))
    entry = h.FakeEntry({"addon_url": h.URL, "pairing_code": "", "wiskey_auto_install": True})
    entry.options = {"wiskey_execute_policy": "blocked"}
    hass.entries["smplwise_bridge"] = entry
    out = _reconfigure(hass, entry, {"addon_url": h.URL, "pairing_code": new})
    assert out["reason"] == "reconfigure_successful" and hass.config_entries.scheduled == [entry.entry_id]
    assert entry.data == {"addon_url": h.URL, "pairing_code": new, "wiskey_auto_install": True} and entry.options == {"wiskey_execute_policy": "blocked"}
    assert _reconfigure(hass, None)["reason"] == "reconfigure_missing"


def test_end_to_end_revoke_then_manual_re_pair_through_the_bridge(world):
    """The fallback path end to end: Arx revokes (discovery closed), an administrator reveals the code with the step-up, the bridge's REAL
    Reconfigure step pings the REAL Arx app with it, and the revocation ends."""
    w = world
    secret = _enrol(w, _admin(w))
    assert _revoke(w).json()["announced"] is False

    def arx(path: str, body: Any) -> int:
        return w["c"].post(path, json=body).status_code

    hass = _hass(arx)
    entry = h.FakeEntry({"addon_url": h.URL, "pairing_code": LEGACY})
    hass.entries["smplwise_bridge"] = entry
    assert _reconfigure(hass, entry, {"addon_url": h.URL, "pairing_code": LEGACY})["errors"] == {"base": "invalid_auth"}, "the old code is dead"
    code = w["c"].post(REVEAL, json={"code": _code_now(secret)}).json()["pairing_code"]
    assert _reconfigure(hass, entry, {"addon_url": h.URL, "pairing_code": code})["reason"] == "reconfigure_successful"
    with w["db"].connection(mode="read") as conn:
        assert bkr.state(conn)["state"] == "repaired" and ha_bridge.signing_key(conn) == code


def test_end_to_end_the_discovery_re_pair_path_ends_the_revocation(world):
    """Decision 1: the existing path (bridge 0.10.3+): the discovered code is pinged first; only Arx's new code is taken."""
    w = world
    assert _revoke(w).status_code == 200
    new = _setting(w, "bridge.secret")

    def arx(path: str, body: Any) -> int:
        return w["c"].post(path, json=body).status_code

    hass = h.FakeHass(arx)
    entry = h.FakeEntry({"addon_url": h.URL, "pairing_code": LEGACY})
    hass.entries["smplwise_bridge"] = entry
    assert h.discover(hass, {"addon_url": h.URL, "pairing_code": LEGACY})["reason"] == "already_configured"
    with w["db"].connection(mode="read") as conn:
        assert bkr.is_revoked(conn)
    h.discover(hass, {"addon_url": h.URL, "pairing_code": new})
    assert entry.data["pairing_code"] == new
    with w["db"].connection(mode="read") as conn:
        assert bkr.state(conn)["state"] == "repaired"


def test_bridge_version_is_0_10_6_in_both_copies_with_reconfigure():
    const = h._load("const")
    assert const.VERSION == "0.10.7"
    assert "WXH4-EMERGENCY-REVOKE-2407" in Path(BACKEND.parent.parent / "custom_components" / "smplwise_bridge" / "const.py").read_text(encoding="utf-8").split("# 0.10.5", 1)[0]
    for root in (ROOT / "custom_components" / "smplwise_bridge", ROOT / "smplwise_vms" / "integration" / "smplwise_bridge"):
        assert json.loads((root / "manifest.json").read_text(encoding="utf-8"))["version"] == "0.10.7"
        assert "async_step_reconfigure" in (root / "config_flow.py").read_text(encoding="utf-8")
        for name in ("strings.json", "translations/en.json", "translations/he.json"):
            cfg = json.loads((root / name).read_text(encoding="utf-8"))["config"]
            assert set(cfg["step"]["reconfigure"]["data"]) == {"addon_url", "pairing_code"}, name
            assert {"reconfigure_successful", "reconfigure_missing"} <= set(cfg["abort"]), name
    a, b = ROOT / "custom_components" / "smplwise_bridge", ROOT / "smplwise_vms" / "integration" / "smplwise_bridge"
    for f in a.rglob("*"):
        if f.is_file() and "__pycache__" not in f.parts:
            assert (b / f.relative_to(a)).read_bytes() == f.read_bytes(), f"mirror differs: {f.relative_to(a)}"
