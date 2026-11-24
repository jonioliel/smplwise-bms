"""MFA-SECFIX-2500: the fixes of the security review of the second-factor train (docs/changes/MFA-SECFIX-2500.md; the review:
docs/changes/MFA-SECREVIEW-2500.md, whose own tests live in tests/test_mfa_secreview_2500.py and pass now). One regression test (or
more) per fix, beyond the review's own:

* SR-2  the administrator's factor reset removes every factor kind, answers what it removed and says so in the user's notice;
* SR-3  a FIRST factor needs a recent sign-in (TOTP, phone key; passkey in the review file); a new factor is announced to the user;
* SR-4 / W-1  a recovery code is a window proof only: refused (and not spent) for a once-action, never mints codes after a
        recovery-code sign-in, still good for an ordinary change;
* SR-5  the marks run on a monotonic clock; a negative age (a local sign-in "in the future") never counts;
* SR-6  a restore keeps the passkeys as they are now (a passkey added after the backup stays);
* W-2   a phone-key-only administrator gets a once-proof for a once-action;
* the generic device route asks `alarm.bypass` for arming with a bypass (slice 3 finding 3, HA_IDENTITY_RBAC_HE.md).

Fakes only (the fake HA core of tests/test_remote_access.py); no lab, no Home Assistant, no network."""
from __future__ import annotations

import time
import types
from dataclasses import replace

import pytest
from fastapi.testclient import TestClient

from smplwise.services import local_passwords as lp
from smplwise.services import notify_policy
from smplwise.services import step_up
from test_mfa_secreview_2500 import _age_remote_sessions
from test_mfa_stepup_2490 import Clock, clock, title  # noqa: F401 - `clock` is a fixture
from test_second_factor import HEADER, arx, bump_step, code_now, enrol, fresh_login  # noqa: F401 - `arx` is the fixture

API = "/arx/api/v1"
ENROLL = f"{API}/auth/second-factor/enroll"
VERIFY = f"{API}/auth/step-up/verify"
CODES = f"{API}/auth/recovery-codes"
RESET_VIEWER = f"{API}/auth/second-factor/users/u-viewer"


@pytest.fixture()
def cheap_hashes():
    lp._profile_override = lp.Profile(7, 10, 8, 1)  # cheap hashing for recovery codes, as slice 7's own tests
    try:
        yield
    finally:
        lp._profile_override = None


def _notices(arx, source: str, user_id: str) -> int:
    with arx.db.connection(mode="read") as conn:
        return len(conn.execute("SELECT n.id FROM notifications n JOIN notification_recipients r ON r.notification_id = n.id "
                                "WHERE n.source = ? AND r.user_id = ?", (source, user_id)).fetchall())


# ---------------------------------------------------------------- SR-2

def test_sr2_the_reset_removes_every_factor_kind_and_says_so(arx, cheap_hashes):
    import test_mfa_devicekey_2490 as tdk
    import test_mfa_passkeys_2490 as tp
    import test_mfa_recovery_codes_2490 as tr
    from smplwise.services import device_keys as dk

    tp.configure(arx)
    tr.enrol_with_codes(arx, arx.viewer)  # the authenticator code and ten recovery codes
    bump_step(arx, "u-viewer")
    assert arx.client.post(VERIFY, json={"code": code_now(arx, "u-viewer")}).status_code == 200  # a proof, so the next two are allowed
    tp.add_passkey(arx, arx.viewer, login=False)
    assert tdk.register(arx, tdk.Phone()).status_code == 200
    with arx.db.connection(mode="read") as conn:
        assert step_up.methods_of(conn, "u-viewer") == ["totp", "passkey", "device_key"]
    admin = TestClient(arx.app)  # the local developer identity, system_admin (Ingress: no step-up of its own needed)
    r = admin.delete("/api/v1/auth/second-factor/users/u-viewer")
    assert r.status_code == 200, r.text
    body = r.json()
    assert body == {"user_id": "u-viewer", "removed": True, "totp": True, "passkeys": 1, "device_keys": 1, "recovery_codes": 10}
    with arx.db.connection(mode="read") as conn:
        assert step_up.methods_of(conn, "u-viewer") == [] and not dk.has_active(conn, "u-viewer")
        assert conn.execute("SELECT COUNT(*) FROM auth_recovery_codes WHERE user_id = 'u-viewer'").fetchone()[0] == 0
        assert conn.execute("SELECT revoked_reason FROM auth_device_keys WHERE user_id = 'u-viewer'").fetchone()[0] == "admin_reset"
    row = arx.audit("auth.second_factor.reset")[-1]
    assert '"passkeys_removed": 1' in row["details_json"] and '"device_keys_revoked": 1' in row["details_json"]
    assert _notices(arx, "security.second_factor_reset", "u-viewer") == 1
    text = {s.key: s for s in notify_policy.SOURCES}["security.second_factor_reset"]
    assert all(w in str(text) for w in ("אפליקציית האימות", "מפתחות הגישה", "מפתחות הטלפון", "קודי השחזור"))


def test_sr2_the_reset_ends_the_targets_proofs(arx, clock):
    enrol(arx, arx.viewer)  # the enrolment's first code is a fresh proof of the viewer's session
    assert any(m.user_id == "u-viewer" for m in step_up._MARKS.values())
    assert TestClient(arx.app).delete("/api/v1/auth/second-factor/users/u-viewer").status_code == 200
    assert not any(m.user_id == "u-viewer" for m in step_up._MARKS.values())


# ---------------------------------------------------------------- SR-3

def test_sr3_a_fresh_sign_in_enrols_and_the_user_is_told(arx):
    enrol(arx, arx.viewer)  # sign-in moments ago: allowed
    assert _notices(arx, "security.second_factor_added", "u-viewer") == 1


def test_sr3_a_stale_session_cannot_enrol_the_authenticator_and_it_is_audited(arx, clock):
    assert fresh_login(arx, arx.viewer).status_code == 200
    _age_remote_sessions(6 * 60)  # just past the 5-minute rule
    r = arx.client.post(ENROLL)
    assert r.status_code == 403 and r.json()["code"] == "reauth_required", r.text
    row = arx.audit("auth.second_factor.failed")[-1]
    assert row["decision"] == "denied" and row["reason"] == "reauth_required"
    assert fresh_login(arx, arx.viewer).status_code == 200  # signing in again is the way
    assert arx.client.post(ENROLL).status_code == 200


def test_sr3_a_stale_session_cannot_register_a_first_phone_key(arx):
    import test_mfa_devicekey_2490 as tdk

    assert fresh_login(arx, arx.viewer).status_code == 200
    _age_remote_sessions(3600)
    r = tdk.register(arx, tdk.Phone())
    assert r.status_code == 403 and r.json()["code"] == "reauth_required", r.text
    assert arx.audit("auth.device_key.refused")[-1]["reason"] == "reauth_required"


def test_sr3_the_local_channel_is_not_limited(arx):
    local = TestClient(arx.app)  # Ingress: the break-glass path
    assert local.post("/api/v1/auth/second-factor/enroll").status_code == 200


def test_sr3_a_passkey_is_announced_too(arx):
    import test_mfa_passkeys_2490 as tp

    tp.configure(arx)
    tp.add_passkey(arx, arx.viewer)
    assert _notices(arx, "security.second_factor_added", "u-viewer") == 1


# ---------------------------------------------------------------- SR-4 / W-1

def test_w1_a_recovery_code_is_refused_for_a_once_action_and_not_spent(arx, clock, cheap_hashes):
    import test_mfa_recovery_codes_2490 as tr

    codes = tr.enrol_with_codes(arx, arx.owner)
    clock.advance(6)
    for action in sorted(step_up.NO_RECOVERY_ACTIONS):
        r = arx.client.post(VERIFY, json={"method": "recovery_code", "code": codes[0], "action": action})
        assert r.status_code == 409 and r.json()["code"] == "step_up_method_refused", (action, r.text)
    assert arx.client.delete(RESET_VIEWER).status_code == 403  # no once-proof came of it
    # the code was not spent: it still makes an ordinary window proof
    assert arx.client.post(VERIFY, json={"method": "recovery_code", "code": codes[0]}).status_code == 200
    assert title(arx, "x").status_code == 200
    assert arx.client.post(VERIFY, json={"method": "recovery_code", "code": codes[0]}).status_code == 400  # now it is spent


def test_sr4_a_recovery_code_sign_in_never_mints_codes_but_counts_for_the_window(arx, cheap_hashes):
    import test_mfa_recovery_codes_2490 as tr

    codes = tr.enrol_with_codes(arx, arx.owner)
    assert fresh_login(arx, arx.owner, codes[0]).status_code == 200  # the remote sign-in answered with a recovery code
    assert title(arx, "x").status_code == 200  # an ordinary change in the window
    r = arx.client.post(CODES)
    assert r.status_code == 403 and r.json()["code"] == "step_up_required"
    bump_step(arx, "u-owner")
    assert arx.client.post(CODES, json={"code": code_now(arx, "u-owner")}).status_code == 200  # the live code still does


def test_sr4_a_recovery_proof_never_adds_a_phone_key(arx, clock, cheap_hashes):
    import test_mfa_devicekey_2490 as tdk
    import test_mfa_recovery_codes_2490 as tr

    codes = tr.enrol_with_codes(arx, arx.owner)
    clock.advance(6)
    assert arx.client.post(VERIFY, json={"method": "recovery_code", "code": codes[1]}).status_code == 200
    r = tdk.register(arx, tdk.Phone())
    assert r.status_code == 403 and r.json()["code"] == "step_up_required", r.text


# ---------------------------------------------------------------- SR-5

def test_sr5_marks_run_on_the_monotonic_clock():
    assert abs(step_up._now() - time.monotonic()) < 1.0
    assert abs(step_up._wall() - time.time()) < 1.0


def test_sr5_a_local_sign_in_in_the_future_never_counts(monkeypatch):
    step_up.reset_for_tests()
    monkeypatch.setattr(step_up, "minutes", lambda conn: 5)
    who = types.SimpleNamespace(user_id="u-owner")
    monkeypatch.setattr(step_up, "_local_sign_in_factor_at", lambda *a: step_up._wall() + 600)  # a clock that was ahead, then stepped back
    assert not step_up._satisfied(None, None, who, "remote:l:x")
    monkeypatch.setattr(step_up, "_local_sign_in_factor_at", lambda *a: step_up._wall() - 60)
    assert step_up._satisfied(None, None, who, "remote:l:x")
    assert step_up._fresh(0.0, 1.0) and not step_up._fresh(-0.001, 1.0) and not step_up._fresh(1.001, 1.0)


# ---------------------------------------------------------------- SR-6

def test_sr6_a_restore_keeps_the_passkeys_as_they_are_now(arx):
    import test_mfa_passkeys_2490 as tp
    from smplwise.services import backup

    tp.configure(arx)
    assert fresh_login(arx, arx.viewer).status_code == 200  # the user exists in the archive's directory
    with arx.db.connection() as conn:
        made = backup.create(arx.settings, conn)
    path = backup.backups_dir(arx.settings) / made["name"]
    tp.add_passkey(arx, arx.viewer)  # added AFTER the backup
    with arx.db.connection() as conn:
        out = backup.restore(arx.settings, conn, path, mode="replace", scope="project+access", actor_user_id="dev-joni")
    assert "auth_webauthn_credentials" in out["kept_current"]
    with arx.db.connection(mode="read") as conn:
        assert conn.execute("SELECT COUNT(*) FROM auth_webauthn_credentials WHERE user_id = 'u-viewer'").fetchone()[0] == 1


# ---------------------------------------------------------------- W-2

def test_w2_a_phone_key_only_administrator_does_a_once_action(arx, clock):
    import test_mfa_devicekey_2490 as tdk

    enrol(arx, arx.viewer)
    assert fresh_login(arx, arx.owner).status_code == 200
    phone = tdk.Phone()
    assert tdk.register(arx, phone).status_code == 200  # the administrator's only factor
    clock.advance(6)
    assert arx.client.delete(RESET_VIEWER).status_code == 403  # a once-action needs its once-proof
    tdk.prove(arx, phone, "system.configure")  # a window proof never counts for a once-action
    assert arx.client.delete(RESET_VIEWER).status_code == 403
    c = tdk.step_up_challenge(arx, phone, step_up.ONCE_RESET)
    v = tdk.verify(arx, phone, c, action=step_up.ONCE_RESET)
    assert v.status_code == 200 and v.json()["minutes"] == 0, v.text
    row = arx.audit("auth.step_up.ok")[-1]
    assert '"once": true' in row["details_json"] and '"device_key"' in row["details_json"]
    r = arx.client.delete(RESET_VIEWER)
    assert r.status_code == 200 and r.json()["removed"] is True, r.text
    assert arx.client.delete(RESET_VIEWER).status_code == 403  # used once


# ---------------------------------------------------------------- alarm.bypass on the generic device route

PANEL = {"entity_id": "alarm_control_panel.house", "state": "disarmed", "attributes": {"friendly_name": "House", "supported_features": 63},
         "last_changed": "2026-09-15T10:00:00+00:00", "last_updated": "2026-09-15T10:00:00+00:00"}


def test_arming_with_a_bypass_on_the_generic_route_needs_alarm_bypass(settings, monkeypatch):
    from conftest import as_user, bind, png_bytes, seed_tree
    from test_ha import STATES
    from test_ha_authority import _body

    from smplwise.main import create_app
    from smplwise.services import alarm as alarm_svc
    from smplwise.services import ha_bridge, ha_client, ha_sync

    assert ha_bridge.ACTIONS["alarm_control_panel.alarm_arm_custom_bypass"]["grant"] == "alarm.bypass"
    s = replace(settings, ha_url="http://ha.local:8123", ha_token="t")
    monkeypatch.setattr(ha_client, "get_states", lambda _s: [*STATES, PANEL])
    monkeypatch.setattr(alarm_svc, "is_managed_control", lambda conn, entity_id: False)  # a panel the alarm screen does not manage
    app = create_app(s)
    ha_sync.STATE.connected = True
    ha_sync.snapshot(app.state.db, s)
    c = TestClient(app)
    secret = c.get("/api/v1/ha/bridge/pairing").json()["pairing_code"]
    c.post("/api/v1/ha/bridge/ping", json=ha_bridge.sign(secret, {"version": "0.1.0"}))
    calls: list[dict] = []
    monkeypatch.setattr(ha_client, "call_bridge_execute", lambda _s, payload, timeout=15.0: calls.append(payload) or {"ok": True, "context_id": "ctx"})
    ids = seed_tree(c)
    f2 = ids["floor2"]
    asset = c.post(f"/api/v1/floors/{f2}/plan-assets", files={"file": ("plan.png", png_bytes(), "image/png")}).json()
    v = c.post(f"/api/v1/floors/{f2}/plan-versions", json={"asset_id": asset["id"]}).json()
    c.post(f"/api/v1/plan-versions/{v['id']}/publish")
    assert c.post(f"/api/v1/floors/{f2}/anchors", json={"resource_type": "ha_entity", "resource_id": PANEL["entity_id"], "x": 0.5, "y": 0.5}).status_code == 201
    bind(c, s, "omer", "operator", "floor", f2)  # ha.entity.control on floor 2, no alarm.bypass
    o = as_user("omer")
    url = f"/api/v1/ha/entities/{PANEL['entity_id']}/actions"
    r = c.post(url, json=_body(allowed_action_id="alarm_control_panel.alarm_arm_custom_bypass", confirmation_grant="confirmed"), headers=o)
    assert r.status_code == 403 and r.json()["code"] == "grant_required" and r.json()["details"]["grant"] == "alarm.bypass", r.text
    assert not calls
    role = c.post("/api/v1/access/roles", json={"name": "עקיפה", "permissions": ["map.read"], "sensitive": ["alarm.bypass"]}).json()
    assert c.post("/api/v1/access/bindings", json={"subject_kind": "user", "subject_id": "dev-omer", "role_id": role["id"], "scope_type": "floor",
                                                   "scope_id": f2}).status_code == 201
    r = c.post(url, json=_body(allowed_action_id="alarm_control_panel.alarm_arm_custom_bypass", confirmation_grant="confirmed", client_request_id="r2"),
               headers=o)
    assert r.status_code == 202, r.text
    assert calls and calls[-1]["service"] == "alarm_arm_custom_bypass"


# ---------------------------------------------------------------- owner answer Q2 = b: step-up OFF by default

def test_the_switch_is_off_by_default():
    from smplwise.services.settings_store import DEFAULTS

    assert DEFAULTS["security.step_up"] == "off" and step_up.DEFAULT_ON == "off"


def test_with_step_up_off_only_what_2490_asked_is_asked(arx, clock):
    """Owner Q2 = b / Q5 ("never ask for re-confirmation unless I switched it on"): with the switch off no new proof prompt of the train
    applies - a second phone key, its revoke, a settings change, a physical action - while the once-action that always asked (another
    user's factor reset) still asks, and SR-3's recent sign-in for a FIRST factor stays (a re-sign-in, not a code prompt)."""
    import test_mfa_devicekey_2490 as tdk

    arx.setting("security.step_up", "off")
    assert fresh_login(arx, arx.viewer).status_code == 200
    _age_remote_sessions(3600)
    assert arx.client.post(ENROLL).json()["code"] == "reauth_required"  # SR-3 stays with the switch off
    enrol(arx, arx.viewer)
    assert fresh_login(arx, arx.owner).status_code == 200
    first = tdk.Phone()
    assert tdk.register(arx, first).status_code == 200
    clock.advance(6)
    second = tdk.Phone()
    assert tdk.register(arx, second).status_code == 200  # no proof for a second key while the switch is off
    assert arx.client.delete(f"{tdk.KEYS}/{second.key_id}").status_code == 200  # nor for a revoke
    assert title(arx, "free").status_code == 200
    st = arx.client.get(f"{API}/auth/step-up").json()
    assert st["applies"] is False and st["reason"] == "off"  # the physical gates (guard_action) use the same answer
    r = arx.client.delete(RESET_VIEWER)  # the once-action asks on every call, as before the train
    assert r.status_code == 403 and r.json()["code"] == "second_factor_step_up_required"
    assert arx.audit("auth.step_up.required") == []
