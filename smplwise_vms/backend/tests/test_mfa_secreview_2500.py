"""MFA-SECREVIEW-2500: the failing tests of the adversarial review of the second-factor train (docs/changes/MFA-SECREVIEW-2500.md).

Every test here proved one CONFIRMED finding against the slice that had it. MFA-SECFIX-2500 fixed them all on the train
(pilot/MFA-TRAIN-2500); the xfail markers are gone, so each test is now a regression guard. A test whose code
lives in a slice that is not merged into the branch running it is skipped (importorskip), so the file runs on every slice and on the
train. Fakes only (the fake HA core of tests/test_remote_access.py); no lab, no Home Assistant, no network."""
from __future__ import annotations

import types

import pytest
from fastapi.testclient import TestClient

from smplwise.services import ha_user_auth as hua
from smplwise.services import local_passwords as lp
from smplwise.services import step_up
from test_mfa_stepup_2490 import Clock, clock, title  # noqa: F401 - `clock` is a fixture
from test_second_factor import arx, enrol, fresh_login  # noqa: F401 - `arx` is the fixture

ENROLL = "/arx/api/v1/auth/second-factor/enroll"
RESET_VIEWER = "/arx/api/v1/auth/second-factor/users/u-viewer"
PK_REG_OPTS = "/arx/api/v1/auth/passkeys/register/options"


def _age_remote_sessions(seconds: float) -> None:
    """Make every live remote session look like a sign-in from `seconds` ago (a cookie stolen long after its sign-in)."""
    for s in list(hua.STORE._sessions.values()):
        s.created_at -= seconds
        s.chain_started = (s.chain_started or s.created_at) - seconds


def _passkeys():
    """The passkeys slice (pilot/MFA-PASSKEYS-2490) and its test helpers, or skip."""
    pytest.importorskip("smplwise.services.user_passkeys")
    import test_mfa_passkeys_2490 as tp

    return tp


# ---------------------------------------------------------------- SR-1 (high): a passkey-only administrator strips factors with no step-up

# SR-1: fixed by MFA-SECFIX-2500 (docs/changes/MFA-SECFIX-2500.md) - a plain regression test now
def test_sr1_a_passkey_only_administrator_resets_another_users_factor_without_any_step_up(arx, clock):
    tp = _passkeys()
    enrol(arx, arx.viewer)  # the victim has the authenticator code
    tp.configure(arx)
    tp.add_passkey(arx, arx.owner)  # the system administrator's only factor is a passkey
    clock.advance(6)  # the registration's own proof ran out: a stolen session of the administrator from now on
    assert title(arx, "x").status_code == 403  # an ordinary settings change IS gated for this administrator
    r = arx.client.request("DELETE", RESET_VIEWER, json={"confirm": "dana"})
    assert r.status_code == 403, f"the factor of another user was removed with no proof at all: {r.status_code} {r.text}"


# ---------------------------------------------------------------- SR-2 (medium): the factor reset leaves passkeys and phone keys

# SR-2: fixed by MFA-SECFIX-2500 (docs/changes/MFA-SECFIX-2500.md) - a plain regression test now
def test_sr2_an_administrators_factor_reset_leaves_the_users_passkey_as_a_factor(arx):
    tp = _passkeys()
    tp.configure(arx)
    tp.add_passkey(arx, arx.viewer)
    admin = TestClient(arx.app)  # the local developer identity, system_admin
    assert admin.request("DELETE", "/api/v1/auth/second-factor/users/u-viewer", json={"confirm": "dana"}).status_code == 200
    with arx.db.connection(mode="read") as conn:
        left = step_up.methods_of(conn, "u-viewer")
    assert left == [], f"after 'reset the second factor' the account still has the step-up methods {left}"


# SR-2: fixed by MFA-SECFIX-2500 (docs/changes/MFA-SECFIX-2500.md) - a plain regression test now
def test_sr2_an_administrators_factor_reset_leaves_the_users_phone_key_active(arx):
    dk = pytest.importorskip("smplwise.services.device_keys")
    with arx.db.connection() as conn:
        conn.execute("INSERT INTO auth_device_keys(id, user_id, label, spki, fp, auth_kind, created_at) VALUES (?, ?, '', ?, ?, ?, ?)",
                     ("dk_" + "0" * 24, "u-viewer", b"\x00", "f" * 64, "biometric", "2026-11-24T00:00:00Z"))
    admin = TestClient(arx.app)
    assert admin.request("DELETE", "/api/v1/auth/second-factor/users/u-viewer", json={"confirm": "dana"}).status_code == 200
    with arx.db.connection(mode="read") as conn:
        assert not dk.has_active(conn, "u-viewer"), "the phone key survives the reset and still answers sign-in and step-up"


# ---------------------------------------------------------------- SR-3 (medium): a first factor enrolled from a stolen session

# SR-3: fixed by MFA-SECFIX-2500 (docs/changes/MFA-SECFIX-2500.md) - a plain regression test now
def test_sr3_a_session_long_after_its_sign_in_enrols_the_authenticator_code(arx, clock):
    assert fresh_login(arx, arx.viewer).status_code == 200
    _age_remote_sessions(3600)  # the cookie is used an hour after its sign-in (stolen); no step-up proof is held
    clock.advance(60)
    r = arx.client.post(ENROLL)
    assert r.status_code == 403, f"a stale session starts the enrolment of its own authenticator: {r.status_code}"


# SR-3: fixed by MFA-SECFIX-2500 (docs/changes/MFA-SECFIX-2500.md) - a plain regression test now
def test_sr3_a_session_long_after_its_sign_in_registers_a_first_passkey(arx, clock):
    tp = _passkeys()
    tp.configure(arx)
    assert fresh_login(arx, arx.viewer).status_code == 200
    _age_remote_sessions(3600)
    clock.advance(60)
    r = arx.client.post(PK_REG_OPTS)
    assert r.status_code == 403, f"a stale session starts the registration of its own passkey: {r.status_code}"


# ---------------------------------------------------------------- SR-4 (low): one recovery code becomes a fresh batch of ten

# SR-4: fixed by MFA-SECFIX-2500 (docs/changes/MFA-SECFIX-2500.md) - a plain regression test now
def test_sr4_a_recovery_code_spent_on_step_up_mints_a_new_batch(arx, clock):
    pytest.importorskip("smplwise.services.recovery_codes")
    import test_mfa_recovery_codes_2490 as tr

    lp._profile_override = lp.Profile(7, 10, 8, 1)  # cheap hashing, as the slice's own tests
    try:
        codes = tr.enrol_with_codes(arx, arx.owner)
        clock.advance(6)
        assert arx.client.post(tr.CODES, json={"code": codes[0]}).status_code == 400  # the direct path refuses a recovery code ...
        assert arx.client.post(tr.VERIFY, json={"method": "recovery_code", "code": codes[1]}).status_code == 200
        r = arx.client.post(tr.CODES)  # ... the proof that a recovery code made is accepted
        assert r.status_code == 403, "a single recovery code (plus the session) minted ten new codes and voided the owner's"
    finally:
        lp._profile_override = None


# ---------------------------------------------------------------- SR-5 (low): the proof window follows the wall clock

# SR-5: fixed by MFA-SECFIX-2500 (docs/changes/MFA-SECFIX-2500.md) - a plain regression test now
def test_sr5_a_backward_clock_step_keeps_a_proof_alive_past_its_window(monkeypatch):
    step_up.reset_for_tests()
    t = [1_000_000.0]
    monkeypatch.setattr(step_up, "_now", lambda: t[0])
    monkeypatch.setattr(step_up, "minutes", lambda conn: 5)
    monkeypatch.setattr(step_up, "_local_sign_in_factor_at", lambda *a: None)
    who = types.SimpleNamespace(user_id="u-owner")
    step_up._put("remote:i:x", step_up.Mark(user_id="u-owner", at=t[0], method="totp"))
    t[0] -= 3600  # NTP steps the clock back one hour right after the proof
    t[0] += 6 * 60  # six real minutes later - past the 5-minute window
    try:
        assert not step_up._satisfied(None, None, who, "remote:i:x"), "the 5-minute proof still counts 6 minutes later"
    finally:
        step_up.reset_for_tests()


# ---------------------------------------------------------------- SR-6 (low): a restore revives a removed passkey

# SR-6: fixed by MFA-SECFIX-2500 (docs/changes/MFA-SECFIX-2500.md) - a plain regression test now
def test_sr6_a_restore_brings_back_a_passkey_removed_after_the_backup(arx):
    tp = _passkeys()
    from smplwise.services import backup

    tp.configure(arx)
    tp.add_passkey(arx, arx.viewer)
    with arx.db.connection() as conn:
        made = backup.create(arx.settings, conn)
    path = backup.backups_dir(arx.settings) / made["name"]
    with arx.db.connection() as conn:  # the user removes the passkey of a lost phone
        conn.execute("DELETE FROM auth_webauthn_credentials WHERE user_id = 'u-viewer'")
    with arx.db.connection() as conn:  # later an administrator restores the project with its access part
        backup.restore(arx.settings, conn, path, mode="replace", scope="project+access", actor_user_id="dev-joni")
    with arx.db.connection(mode="read") as conn:
        back = conn.execute("SELECT COUNT(*) FROM auth_webauthn_credentials WHERE user_id = 'u-viewer'").fetchone()[0]
        methods = step_up.methods_of(conn, "u-viewer")
    assert back == 0, f"the lost phone's passkey is back and counts as a step-up method again: {methods}"
