"""MFA-RESET-HARDENING-2510 (second-factor train slice 10; owner decision Q53 of 2026-11-22: an administrator resets another user's
authentication methods from any channel, with the administrator's own approval - NOT the recommendation, risk in
docs/changes/MFA-RESET-HARDENING-2510.md). services/factor_reset.py and routers/second_factor.admin_reset:

* never oneself; the typed username (`confirm`), checked before the administrator's proof is read; the channel setting
  `security.factor_reset_channel` (any | local, default any; widening back to `any` only from the local channel); 3 resets per
  administrator per hour (audited refusal); the last system administrator who can sign in remotely is never reset away;
* after a reset: every sign-in and device credential of the user ends, the user and the managers are told, `must_enroll` sends the
  next remote sign-in to enrolment when the policy requires a factor (never after a recovery-code sign-in: owner Q14);
* the preflight `GET auth/second-factor/users/{id}/reset-check` for the screens;
* the extra once-actions (design 4.2; owner Q5): a role change to system administrator and a backup restore need a once-proof ONLY
  while step-up applies - nothing with step-up off.

Fakes only (the fake HA core of tests/test_remote_access.py); no lab, no Home Assistant, no network."""
# ruff: noqa: F811 - the `arx` / `clock` fixtures are imported by name and used as test parameters
from __future__ import annotations

import json

from fastapi.testclient import TestClient

from smplwise.services import factor_reset as fr
from smplwise.services import second_factor as sf
from smplwise.services import step_up
from test_mfa_stepup_2490 import Clock, clock, verify  # noqa: F401 - `clock` is a fixture
from test_second_factor import HEADER, arx, bump_step, code_now, enrol, fresh_login  # noqa: F401 - `arx` is the fixture

API = "/arx/api/v1"
LOCAL = "/api/v1"
RESET = "/auth/second-factor/users/{}"
CHECK = "/auth/second-factor/users/{}/reset-check"
BINDINGS = "/access/bindings"
NAMES = {"u-viewer": "dana", "u-owner": "joni", "u-mfa": "avi"}


def admin(arx) -> TestClient:
    return TestClient(arx.app)  # the local developer identity dev-joni, system_admin, on the local channel (Ingress)


def reset(client: TestClient, user_id: str, *, local: bool = True, confirm: str | None = "", **extra):
    body = {"confirm": NAMES.get(user_id, user_id) if confirm == "" else confirm, **extra}
    if confirm is None:
        body.pop("confirm")
    return client.request("DELETE", (LOCAL if local else API) + RESET.format(user_id), json=body)


def enrol_directly(arx, user_id: str) -> None:
    with arx.db.connection() as conn:
        sf.begin_enrolment(conn, arx.settings, user_id, user_id)
    with arx.db.connection() as conn:
        sf.confirm(conn, arx.settings, user_id, code_now(arx, user_id))
    bump_step(arx, user_id)


def denied(arx, reason: str) -> list[dict]:
    return [a for a in arx.audit(fr.ACTION) if a["decision"] == "denied" and a["reason"] == reason]


def enrolled(arx, user_id: str) -> bool:
    with arx.db.connection(mode="read") as conn:
        return sf.is_enrolled(conn, user_id)


def recipients(arx, source: str) -> list[str]:
    with arx.db.connection(mode="read") as conn:
        return [r[0] for r in conn.execute("SELECT r.user_id FROM notifications n JOIN notification_recipients r ON r.notification_id = n.id "
                                           "WHERE n.source = ?", (source,)).fetchall()]


# ---------------------------------------------------------------- registry, defaults, restore

def test_defaults_channel_any_and_nothing_travels_in_a_backup(arx):
    from smplwise.services import backup, local_privacy
    from smplwise.services.settings_store import DEFAULTS

    assert DEFAULTS[fr.CHANNEL_KEY] == "any" and fr.DEFAULT_CHANNEL == "any"  # owner Q53
    assert fr.CHANNEL_KEY in backup.SETTINGS_KEEP and "auth_factor_resets" in backup.NEVER_EXPORTED_TABLES
    assert ("auth_factor_resets", "user_id") in local_privacy.DELETE_ROWS
    assert (fr.RATE_MAX, fr.RATE_WINDOW_S) == (3, 3600)
    assert admin(arx).get(f"{LOCAL}/settings").json()["settings"][fr.CHANNEL_KEY] == "any"
    assert step_up.STEP_UP_ONCE_ACTIONS == {"rbac.system_admin.assign", "backup.restore"}
    assert step_up.STEP_UP_ONCE_ACTIONS <= step_up.NO_RECOVERY_ACTIONS  # a recovery code is never their proof


# ---------------------------------------------------------------- never oneself

def test_an_administrator_never_resets_their_own_factors_and_the_refusal_is_audited(arx):
    enrol_directly(arx, "dev-joni")
    r = reset(admin(arx), "dev-joni", confirm="joni")
    assert r.status_code == 409 and r.json()["code"] == "second_factor_self_reset"
    assert denied(arx, "self") and enrolled(arx, "dev-joni")
    assert admin(arx).get(LOCAL + CHECK.format("dev-joni")).json()["reason"] == "self"


# ---------------------------------------------------------------- the typed confirmation

def test_the_typed_username_is_required_and_must_match(arx):
    enrol(arx, arx.viewer)
    a = admin(arx)
    r = reset(a, "u-viewer", confirm=None)
    assert r.status_code == 422 and r.json()["code"] == "factor_reset_confirm_required" and r.json()["details"]["field"] == "confirm"
    r = reset(a, "u-viewer", confirm="dan")
    assert r.status_code == 422 and r.json()["code"] == "factor_reset_confirm_mismatch"
    assert reset(a, "u-viewer", confirm="joni").json()["code"] == "factor_reset_confirm_mismatch"  # another account's name
    assert denied(arx, "confirm_required") and len(denied(arx, "confirm_mismatch")) == 2
    assert enrolled(arx, "u-viewer")  # nothing was removed
    assert "dan" not in json.dumps([a["details_json"] for a in arx.audit(fr.ACTION)])  # the typed value is never audited
    r = reset(a, "u-viewer", confirm="  DANA ")  # case and surrounding blanks do not matter
    assert r.status_code == 200 and r.json()["removed"] is True


def test_the_confirmation_is_checked_before_the_administrators_proof_is_spent(arx, clock):
    enrol(arx, arx.viewer)
    enrol(arx, arx.owner)  # the administrator, signed in remotely with a factor of their own
    clock.advance(6)
    assert verify(arx, "u-owner", action=step_up.ONCE_RESET).status_code == 200  # a once-proof for the reset
    assert reset(arx.client, "u-viewer", local=False, confirm="wrong").json()["code"] == "factor_reset_confirm_mismatch"
    r = reset(arx.client, "u-viewer", local=False)  # the once-proof is still there
    assert r.status_code == 200, r.text
    again = reset(arx.client, "u-viewer", local=False)
    assert again.status_code == 403 and again.json()["code"] == "second_factor_step_up_required"  # and now it is spent


def test_an_unknown_user_is_404(arx):
    r = reset(admin(arx), "u-nobody", confirm="x")
    assert r.status_code == 404 and r.json()["code"] == "user_unknown"
    assert admin(arx).get(LOCAL + CHECK.format("u-nobody")).json()["reason"] == "user_unknown"


# ---------------------------------------------------------------- the channel setting

def test_the_channel_setting_local_refuses_a_remote_reset_and_the_local_channel_still_works(arx):
    enrol(arx, arx.viewer)
    assert fresh_login(arx, arx.owner).status_code == 200  # the administrator, remote, no factor of their own
    arx.setting(fr.CHANNEL_KEY, "local")
    r = reset(arx.client, "u-viewer", local=False)
    assert r.status_code == 403 and r.json()["code"] == "factor_reset_local_only"
    assert denied(arx, "local_only") and enrolled(arx, "u-viewer")
    chk = arx.client.get(API + CHECK.format("u-viewer")).json()
    assert chk["allowed"] is False and chk["reason"] == "local_only" and chk["channel"] == "local" and chk["remote"] is True
    assert reset(admin(arx), "u-viewer").status_code == 200  # Ingress: allowed
    arx.setting(fr.CHANNEL_KEY, "any")
    enrol(arx, arx.viewer)
    assert fresh_login(arx, arx.owner).status_code == 200
    assert reset(arx.client, "u-viewer", local=False).status_code == 200  # any (owner Q53): from outside too
    row = arx.audit(fr.ACTION)[-1]
    assert row["decision"] == "allowed" and json.loads(row["details_json"])["channel"] == "remote"


def test_the_channel_setting_is_system_admin_only_and_widens_only_locally(arx):
    assert fresh_login(arx, arx.owner).status_code == 200  # system_admin, remote, no factor (step-up does not apply: no method)
    assert arx.client.patch(f"{API}/settings", json={fr.CHANNEL_KEY: "nowhere"}).status_code == 422
    assert arx.client.patch(f"{API}/settings", json={fr.CHANNEL_KEY: "local"}).status_code == 200  # narrowing: from anywhere
    r = arx.client.patch(f"{API}/settings", json={fr.CHANNEL_KEY: "any"})
    assert r.status_code == 403 and r.json()["code"] == "local_only"  # widening from outside: refused
    assert admin(arx).patch(f"{LOCAL}/settings", json={fr.CHANNEL_KEY: "any"}).status_code == 200
    rows = arx.audit("security.factor_reset_channel")
    assert [(x["decision"], x["reason"]) for x in rows] == [("allowed", None), ("denied", "remote_channel"), ("allowed", None)]
    assert fresh_login(arx, arx.viewer).status_code == 200  # a viewer: no system.configure at all
    assert arx.client.patch(f"{API}/settings", json={fr.CHANNEL_KEY: "local"}).status_code == 403


# ---------------------------------------------------------------- the rate limit

def test_three_resets_per_administrator_per_hour_then_an_audited_refusal(arx):
    a = admin(arx)
    for uid in ("u-viewer", "u-mfa", "u-owner"):
        r = reset(a, uid)
        assert r.status_code == 200, (uid, r.text)
    assert r.json()["resets_left"] == 0
    chk = a.get(LOCAL + CHECK.format("u-viewer")).json()
    assert chk["allowed"] is False and chk["reason"] == "rate_limited" and chk["resets_left"] == 0
    r = reset(a, "u-viewer")
    assert r.status_code == 429 and r.json()["code"] == "factor_reset_rate_limited" and r.json()["details"] == {"limit": 3, "window_s": 3600}
    assert len(denied(arx, "rate_limited")) == 1
    # an hour later the budget is back (the count is the administrator's own allowed reset rows of the last hour)
    with arx.db.connection() as conn:
        conn.execute("UPDATE audit_log SET at = '2000-01-01T00:00:00Z' WHERE action = ? AND decision = 'allowed'", (fr.ACTION,))
    assert reset(a, "u-viewer").status_code == 200


def test_the_rate_limit_is_per_administrator_and_refusals_do_not_count(arx):
    a = admin(arx)
    for _ in range(5):
        assert reset(a, "u-viewer", confirm="nope").status_code == 422  # refused attempts are not resets
    for uid in ("u-viewer", "u-mfa", "u-owner"):
        assert reset(a, uid).status_code == 200
    assert fresh_login(arx, arx.owner).status_code == 200  # another administrator still has their own three
    assert reset(arx.client, "u-viewer", local=False).status_code == 200


# ---------------------------------------------------------------- the last administrator

def test_the_last_administrator_who_can_sign_in_remotely_is_never_reset_away(arx):
    arx.setting("security.second_factor_policy", "admins")  # an administrator must show a factor at a remote sign-in
    enrol_directly(arx, "u-owner")  # the one administrator who can sign in from outside
    a = admin(arx)  # dev-joni: an administrator too, but with no factor - under `admins` it cannot sign in remotely
    with arx.db.connection(mode="read") as conn:
        assert fr.signs_in_remotely(conn, "u-owner", remote_on=True)
        assert not fr.signs_in_remotely(conn, "u-owner", remote_on=True, after_reset=True)
        assert not fr.signs_in_remotely(conn, "dev-joni", remote_on=True)
        assert fr.last_admin_blocks(conn, "u-owner", remote_on=True)
        assert not fr.last_admin_blocks(conn, "u-owner", remote_on=False)  # no remote channel: the reset changes nothing remote
        assert not fr.last_admin_blocks(conn, "u-viewer", remote_on=True)  # not an administrator
    assert a.get(LOCAL + CHECK.format("u-owner")).json()["reason"] == "last_admin"
    r = reset(a, "u-owner")
    assert r.status_code == 409 and r.json()["code"] == "factor_reset_last_admin"
    assert denied(arx, "last_admin") and enrolled(arx, "u-owner")
    # a second administrator who can sign in remotely: the reset may go ahead (dev-joni now has a factor, so it shows its own code)
    enrol_directly(arx, "dev-joni")
    r = a.request("DELETE", LOCAL + RESET.format("u-owner"), json={"confirm": "joni"}, headers={HEADER: code_now(arx, "dev-joni")})
    assert r.status_code == 200, r.text
    assert not enrolled(arx, "u-owner")


def test_the_last_administrator_may_be_reset_when_the_policy_does_not_require_a_factor(arx):
    enrol_directly(arx, "u-owner")  # optional policy: after the reset the owner still signs in remotely (without a factor)
    assert reset(admin(arx), "u-owner").status_code == 200


# ---------------------------------------------------------------- after the reset: revoke-all, notices

def _phone(arx, user_id: str) -> None:
    with arx.db.connection() as conn:
        conn.execute("INSERT INTO mobile_devices(id, user_id, name, platform, install_id, token_hash, token_rotated_at, created_at, last_seen_at, "
                     "push_relay_token, push_platform) VALUES ('dev_p1', ?, 'phone', 'android', 'i1', 'h1', '2026-11-24T00:00:00Z', "
                     "'2026-11-24T00:00:00Z', '2026-11-24T00:00:00Z', 'relay-token', 'android')", (user_id,))


def test_a_reset_ends_every_sign_in_and_device_credential_and_tells_the_user_and_the_managers(arx):
    enrol(arx, arx.viewer)
    viewer = arx.client
    assert viewer.get(f"{API}/me").status_code == 200
    _phone(arx, "u-viewer")
    r = reset(admin(arx), "u-viewer")
    assert r.status_code == 200, r.text
    body = r.json()
    assert body["sign_ins_ended"] >= 1 and body["device_credentials_ended"] == 1 and body["must_enroll"] is True and body["resets_left"] == 2
    assert viewer.get(f"{API}/me").status_code == 401
    with arx.db.connection(mode="read") as conn:
        dev = conn.execute("SELECT token_hash, push_relay_token FROM mobile_devices WHERE id = 'dev_p1'").fetchone()
    assert dev["token_hash"].startswith("revoked:") and dev["push_relay_token"] is None  # the phone's token AND its push end
    assert arx.audit("presence.device.credentials_ended")[-1]["reason"] == "second_factor_reset"
    assert recipients(arx, "security.second_factor_reset") == ["u-viewer"]
    managers = recipients(arx, "security.second_factor_reset_by_admin")
    assert managers and "u-viewer" not in managers
    with arx.db.connection(mode="read") as conn:
        note = dict(conn.execute("SELECT * FROM notifications WHERE source = 'security.second_factor_reset_by_admin'").fetchone())
    assert "dana" not in json.dumps(note, ensure_ascii=False) and "u-viewer" not in json.dumps(note)  # content-free
    d = json.loads(arx.audit(fr.ACTION)[-1]["details_json"])
    assert d["managers_notified"] is True and d["must_enroll"] is True and d["device_credentials_ended"] == 1 and d["reset_channel"] == "any"


# ---------------------------------------------------------------- must_enroll

def test_must_enroll_is_shown_and_ends_with_the_next_enrolment(arx):
    enrol(arx, arx.viewer)
    assert reset(admin(arx), "u-viewer").status_code == 200
    assert admin(arx).get(f"{LOCAL}/auth/second-factor/users").json()["must_enroll"] == ["u-viewer"]
    assert fresh_login(arx, arx.viewer).status_code == 200  # optional policy: the sign-in is not refused ...
    own = arx.client.get(f"{API}/auth/second-factor").json()
    assert own["must_enroll"] is True and own["must_enroll_enforced"] is False  # ... the account screen asks to enrol again
    assert arx.client.post(f"{API}/auth/second-factor/enroll").status_code == 200
    assert arx.client.post(f"{API}/auth/second-factor/confirm", json={"code": code_now(arx, "u-viewer")}).status_code == 200
    with arx.db.connection(mode="read") as conn:
        assert not fr.must_enroll_flag(conn, "u-viewer")
    assert arx.client.get(f"{API}/auth/second-factor").json()["must_enroll"] is False
    assert admin(arx).get(f"{LOCAL}/auth/second-factor/users").json()["must_enroll"] == []


def test_must_enroll_sends_the_next_remote_sign_in_to_enrolment_when_the_policy_requires_a_factor(arx):
    enrol(arx, arx.viewer)
    assert reset(admin(arx), "u-viewer").status_code == 200
    # the enforced sign-in policy would normally accept Home Assistant's own MFA (`ha_mfa`); after an administrator's reset it does
    # not: the user enrols an Arx factor again - and no Home Assistant call is made for it
    arx.setting("security.factor_policy", "all")
    arx.setting("security.factor_policy_mode", "enforce")
    r = fresh_login(arx, arx.viewer)
    assert r.status_code == 403 and r.json()["code"] == "second_factor_enrollment_required", r.text
    assert r.json()["details"] == {"must_enroll": True, "reason": "admin_reset"}
    enrol_directly(arx, "u-viewer")  # enrolled again (the local channel): the flag no longer counts, the code is asked as usual
    assert fresh_login(arx, arx.viewer).json()["code"] == "second_factor_required"


def test_must_enroll_on_the_legacy_required_policy_keeps_the_plain_refusal(arx):
    enrol(arx, arx.viewer)
    with arx.db.connection() as conn:
        sf.set_override(conn, "user", "u-viewer", "required", None)
    assert reset(admin(arx), "u-viewer").status_code == 200
    r = fresh_login(arx, arx.viewer)
    assert r.status_code == 403 and r.json()["code"] == "second_factor_enrollment_required"
    assert r.json()["details"] == {"must_enroll": True, "reason": "admin_reset"}
    with arx.db.connection(mode="read") as conn:
        assert fr.enforced(conn, "u-viewer")


def test_a_recovery_code_sign_in_never_sets_must_enroll(arx):
    """Owner Q14: no forced re-enrolment after a recovery-code sign-in - only an administrator's reset sets the flag."""
    from smplwise.services import local_passwords as lp
    import test_mfa_recovery_codes_2490 as tr

    lp._profile_override = lp.Profile(7, 10, 8, 1)
    try:
        codes = tr.enrol_with_codes(arx, arx.viewer)
        assert fresh_login(arx, arx.viewer, codes[0]).status_code == 200
    finally:
        lp._profile_override = None
    with arx.db.connection(mode="read") as conn:
        assert not fr.must_enroll_flag(conn, "u-viewer") and not fr.must_enroll(conn, "u-viewer")
    assert arx.client.get(f"{API}/auth/second-factor").json()["must_enroll"] is False


# ---------------------------------------------------------------- the preflight

def test_the_reset_check_answers_what_the_dialog_needs_and_spends_nothing(arx):
    enrol(arx, arx.viewer)
    chk = admin(arx).get(LOCAL + CHECK.format("u-viewer"))
    assert chk.status_code == 200, chk.text
    c = chk.json()
    assert c["allowed"] is True and c["reason"] is None and c["confirm_text"] == "dana" and c["channel"] == "any" and c["remote"] is False
    assert c["resets_left"] == 3 and c["rate_max"] == 3 and c["must_enroll_after"] is False
    assert c["factors"] == {"totp": True, "passkeys": 0, "device_keys": 0, "recovery_codes": 10}
    assert c["step_up"]["action"] == step_up.ONCE_RESET and c["step_up"]["once"] is True and c["step_up"]["minutes"] == 0
    assert enrolled(arx, "u-viewer") and arx.audit(fr.ACTION) == []
    bump_step(arx, "u-viewer")
    assert fresh_login(arx, arx.viewer, code_now(arx, "u-viewer")).status_code == 200
    assert arx.client.get(API + CHECK.format("u-owner")).status_code == 403  # system.configure only


# ---------------------------------------------------------------- the extra once-actions (step-up ON only)

SYSADMIN = {"subject_kind": "user", "subject_id": "u-viewer", "role_id": "system_admin", "scope_type": "installation", "scope_id": "*", "effect": "allow"}


def _owner_remote_with_a_factor(arx, clock) -> None:
    enrol(arx, arx.owner)
    clock.advance(6)  # the enrolment's own proof ran out


def test_with_step_up_off_a_role_change_to_system_administrator_and_a_restore_ask_nothing(arx, clock):
    _owner_remote_with_a_factor(arx, clock)
    arx.setting("security.step_up", "off")  # the owner's default (Q2 = b): "never ask unless I switched it on" (Q5)
    r = arx.client.post(API + BINDINGS, json=SYSADMIN)
    assert r.status_code == 201, r.text
    r = arx.client.post(f"{API}/backups/nope.tar.gz/restore", json={"confirm": "no"})
    assert r.status_code == 422 and r.json()["code"] == "confirm_required"  # past the gate: the route's own checks answer
    assert arx.audit("auth.step_up.required") == []


def test_with_step_up_on_a_role_change_to_system_administrator_needs_a_once_proof(arx, clock):
    _owner_remote_with_a_factor(arx, clock)
    assert verify(arx, "u-owner").status_code == 200  # a 5-minute window proof ...
    ordinary = {**SYSADMIN, "subject_id": "u-mfa", "role_id": "viewer"}
    assert arx.client.post(API + BINDINGS, json=ordinary).status_code == 201  # ... is enough for an ordinary binding
    r = arx.client.post(API + BINDINGS, json=SYSADMIN)
    assert r.status_code == 403 and r.json()["code"] == "step_up_required", r.text  # ... but never for a new system administrator
    d = r.json()["details"]
    assert d["once"] is True and d["action"] == step_up.ONCE_ADMIN_ROLE and d["minutes"] == 0 and d["verify_path"] == "auth/step-up/verify"
    row = arx.audit("auth.step_up.required")[-1]
    assert json.loads(row["details_json"])["once"] is True and row["resource_id"] == step_up.ONCE_ADMIN_ROLE
    assert verify(arx, "u-owner", action=step_up.ONCE_ADMIN_ROLE).status_code == 200
    assert arx.client.post(API + BINDINGS, json=SYSADMIN).status_code == 201  # the once-proof, consumed
    other = {**SYSADMIN, "subject_id": "u-mfa"}
    assert arx.client.post(API + BINDINGS, json=other).status_code == 403  # never twice
    bump_step(arx, "u-owner")
    r = arx.client.post(API + BINDINGS, json=other, headers={HEADER: code_now(arx, "u-owner")})  # the own code inline works too
    assert r.status_code == 201, r.text
    r = arx.client.post(API + BINDINGS, json={**SYSADMIN, "subject_id": "u-owner"}, headers={HEADER: "000000"})
    assert r.status_code == 400 and r.json()["code"] == "second_factor_invalid"
    assert arx.audit("auth.step_up.failed")[-1]["reason"] == "step_up_invalid"


def test_with_step_up_on_a_restore_needs_a_once_proof(arx, clock):
    _owner_remote_with_a_factor(arx, clock)
    assert verify(arx, "u-owner").status_code == 200  # a window proof does not count
    r = arx.client.post(f"{API}/backups/nope.tar.gz/restore", json={"confirm": "no"})
    assert r.status_code == 403 and r.json()["code"] == "step_up_required" and r.json()["details"]["action"] == step_up.ONCE_RESTORE
    r = arx.client.post(f"{API}/backups/offbox/restore", json={"stage_id": "x" * 16, "confirm": "no"})
    assert r.status_code in (403, 422) and (r.status_code == 422 or r.json()["details"]["action"] == step_up.ONCE_RESTORE)
    assert verify(arx, "u-owner", action=step_up.ONCE_RESTORE).status_code == 200
    r = arx.client.post(f"{API}/backups/nope.tar.gz/restore", json={"confirm": "no"})
    assert r.status_code == 422 and r.json()["code"] == "confirm_required"  # past the gate


def test_the_extra_once_actions_keep_the_local_channel_and_the_no_method_rules(arx):
    a = admin(arx)  # Ingress, `security.step_up_local` off: step-up does not apply
    assert a.post(LOCAL + BINDINGS, json=SYSADMIN).status_code == 201
    assert fresh_login(arx, arx.owner).status_code == 200  # remote, but no method: step-up does not apply (today's behaviour)
    assert arx.client.post(API + BINDINGS, json={**SYSADMIN, "subject_id": "u-mfa"}).status_code == 201


def test_a_recovery_code_never_proves_the_extra_once_actions(arx, clock):
    from smplwise.services import local_passwords as lp
    import test_mfa_recovery_codes_2490 as tr

    lp._profile_override = lp.Profile(7, 10, 8, 1)
    try:
        codes = tr.enrol_with_codes(arx, arx.owner)
        clock.advance(6)
        for action in sorted(step_up.STEP_UP_ONCE_ACTIONS):
            r = arx.client.post(f"{API}/auth/step-up/verify", json={"method": "recovery_code", "code": codes[0], "action": action})
            assert r.status_code == 409 and r.json()["code"] == "step_up_method_refused", (action, r.text)
    finally:
        lp._profile_override = None
