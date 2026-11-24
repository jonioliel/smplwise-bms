"""MFA-RECOVERY-CODES-2490 (MFA-STEPUP-TRAIN-2490 slice 7; owner decision Q49: 10 recovery codes per user, each usable once).

Covered: the code format and its tolerant reading, only hashes stored (never a code in the database, an answer after the first or the
audit), the first batch at enrolment, the remote sign-in with a recovery code in place of the authenticator code, a used code refused
the second time, a new batch only after a fresh step-up (and the old batch dead after it), a recovery code as a step-up proof, the
shared lockout of wrong codes, the audit rows, the factor's removal with a recovery code (the lost-phone path) and the codes going
with the factor (own removal, an administrator's reset), the low-count warning, the Arx-only sign-in's second step, and the backup /
privacy plumbing. Fakes only (the fake HA core of tests/test_remote_access.py)."""
from __future__ import annotations

import json

import pytest

from smplwise.services import local_passwords as lp
from smplwise.services import recovery_codes as rc
from smplwise.services import step_up
from test_second_factor import HEADER, arx, bump_step, code_now, fresh_login  # noqa: F401 - `arx` is the fixture

CONFIRM = "/arx/api/v1/auth/second-factor/confirm"
ENROLL = "/arx/api/v1/auth/second-factor/enroll"
DISABLE = "/arx/api/v1/auth/second-factor/disable"
CODES = "/arx/api/v1/auth/recovery-codes"
VERIFY = "/arx/api/v1/auth/step-up/verify"
SETTINGS = "/arx/api/v1/settings"


@pytest.fixture(autouse=True)
def _cheap_hashing():
    lp._profile_override = lp.Profile(7, 10, 8, 1)  # production uses RECOVERY_PROFILE (scrypt N=2^14)
    yield
    lp._profile_override = None


class Clock:
    def __init__(self, monkeypatch):
        self.t = step_up._now()
        monkeypatch.setattr(step_up, "_now", lambda: self.t)

    def advance(self, minutes: float) -> None:
        self.t += minutes * 60


@pytest.fixture()
def clock(monkeypatch):
    return Clock(monkeypatch)


def enrol_with_codes(arx, user) -> list[str]:
    """Sign in, enrol and confirm over the remote channel; returns the first batch of recovery codes from the confirm answer."""
    assert fresh_login(arx, user).status_code == 200
    assert arx.client.post(ENROLL).status_code == 200
    r = arx.client.post(CONFIRM, json={"code": code_now(arx, user.id)})
    assert r.status_code == 200, r.text
    body = r.json()
    assert body["enabled"] is True
    return body["recovery_codes"]


def rows(arx, sql: str, args=()) -> list[dict]:
    with arx.db.connection(mode="read") as conn:
        return [dict(r) for r in conn.execute(sql, args).fetchall()]


def dump_db(arx) -> str:
    """Every value of every table, as text: the place a recovery code must never be."""
    out = []
    with arx.db.connection(mode="read") as conn:
        for (name,) in conn.execute("SELECT name FROM sqlite_master WHERE type = 'table'").fetchall():
            out.extend(json.dumps([str(v) for v in tuple(r)], ensure_ascii=False) for r in conn.execute(f'SELECT * FROM "{name}"').fetchall())
    return "\n".join(out)


def audit_rows(arx, action: str) -> list[dict]:
    """The audit rows of one action in insertion order (rowid: several rows can share one `at` second)."""
    return rows(arx, "SELECT * FROM audit_log WHERE action = ? ORDER BY rowid", (action,))


def details(row: dict) -> dict:
    return json.loads(row["details_json"] or "{}")


def title(arx, value: str):
    return arx.client.patch(SETTINGS, json={"home.title": value})


# ---------------------------------------------------------------- the format

def test_codes_are_crockford_base32_and_typing_slips_are_tolerated():
    assert rc.canonical("abcd-efgh") == "ABCDEFGH" and rc.canonical(" ABCD EFGH ") == "ABCDEFGH"
    assert rc.canonical("0OI1-L234") == "00111234"  # O -> 0, I / L -> 1
    assert rc.canonical("123456") is None  # a 6-digit authenticator code is never read as a recovery code
    assert rc.canonical("ABCD-EFGU") is None and rc.canonical("ABCD-EFG") is None and rc.canonical("ABCD-EFGHJ") is None
    assert rc.canonical(None) is None and rc.canonical("x" * 40) is None
    assert rc.display("ABCDEFGH") == "ABCD-EFGH"


# ---------------------------------------------------------------- generation at enrolment

def test_enrolment_hands_out_ten_codes_once_and_stores_only_hashes(arx):
    codes = enrol_with_codes(arx, arx.viewer)
    assert len(codes) == rc.COUNT == 10 and len(set(codes)) == 10
    assert all(len(c) == 9 and c[4] == "-" and rc.canonical(c) for c in codes)
    stored = rows(arx, "SELECT * FROM auth_recovery_codes WHERE user_id = 'u-viewer'")
    assert len(stored) == 10 and len({r["batch_id"] for r in stored}) == 1
    assert all(r["code_hash"].startswith("$scrypt$") and r["used_at"] is None for r in stored)
    db = dump_db(arx)
    assert not any(c in db or rc.canonical(c) in db for c in codes)
    st = arx.client.get(CODES).json()
    assert st == {"available": True, "remaining": 10, "total": 10, "created_at": st["created_at"], "last_used_at": None, "low": False, "low_at": 3}
    assert st["created_at"] and not any(c in json.dumps(st) for c in codes)  # the status never shows a code
    gen = audit_rows(arx, "auth.recovery_codes.generated")[-1]
    assert gen["decision"] == "allowed" and gen["actor_user_id"] == "u-viewer"
    assert {k: details(gen)[k] for k in ("reason", "count", "voided")} == {"reason": "enrolment", "count": 10, "voided": 0}


def test_a_user_without_the_factor_has_no_codes(arx):
    assert fresh_login(arx, arx.viewer).status_code == 200
    assert arx.client.get(CODES).json() | {"created_at": None} == {"available": False, "remaining": 0, "total": 0, "created_at": None,
                                                                    "last_used_at": None, "low": False, "low_at": 3}
    r = arx.client.post(CODES, json={})
    assert r.status_code == 409 and r.json()["code"] == "recovery_codes_unavailable"


# ---------------------------------------------------------------- use at sign-in, once

def test_a_recovery_code_signs_in_in_place_of_the_authenticator_code_once(arx):
    codes = enrol_with_codes(arx, arx.viewer)
    r = fresh_login(arx, arx.viewer, codes[0].lower().replace("-", " "))  # typed loosely
    assert r.status_code == 200, r.text
    used = audit_rows(arx, "auth.recovery_code.used")[-1]
    assert used["decision"] == "allowed" and used["actor_user_id"] == "u-viewer"
    assert {k: details(used)[k] for k in ("method", "used_for", "remaining", "low")} == {"method": "recovery_code", "used_for": "sign_in", "remaining": 9, "low": False}
    assert arx.client.get(CODES).json()["remaining"] == 9
    assert rows(arx, "SELECT used_for FROM auth_recovery_codes WHERE used_at IS NOT NULL") == [{"used_for": "sign_in"}]
    # the same code again: refused, audited as a failed recovery code (never the code itself)
    again = fresh_login(arx, arx.viewer, codes[0])
    assert again.status_code == 401 and again.json()["code"] == "second_factor_invalid"
    failed = audit_rows(arx, "auth.second_factor.failed")[-1]
    assert failed["decision"] == "denied" and details(failed)["method"] == "recovery_code"
    # another unused code still works; the authenticator code too
    assert fresh_login(arx, arx.viewer, codes[1]).status_code == 200
    bump_step(arx, "u-viewer")
    assert fresh_login(arx, arx.viewer, code_now(arx, "u-viewer")).status_code == 200
    audit_text = json.dumps(rows(arx, "SELECT * FROM audit_log"), ensure_ascii=False)
    assert not any(c in audit_text or rc.canonical(c) in audit_text for c in codes)


def test_codes_of_one_user_do_not_open_another(arx):
    viewer_codes = enrol_with_codes(arx, arx.viewer)
    enrol_with_codes(arx, arx.owner)
    r = fresh_login(arx, arx.owner, viewer_codes[0])
    assert r.status_code == 401 and r.json()["code"] == "second_factor_invalid"
    assert rows(arx, "SELECT COUNT(*) AS n FROM auth_recovery_codes WHERE used_at IS NOT NULL") == [{"n": 0}]


# ---------------------------------------------------------------- lockout shared with the authenticator code

def test_wrong_recovery_codes_share_the_factor_lockout(arx):
    codes = enrol_with_codes(arx, arx.viewer)
    for i in range(4):
        r = fresh_login(arx, arx.viewer, f"ZZZZ-ZZZ{i}")
        assert r.status_code == 401 and r.json()["code"] == "second_factor_invalid"
    fifth = fresh_login(arx, arx.viewer, "ZZZZ-ZZZ9")
    assert fifth.status_code == 429 and fifth.json()["code"] == "second_factor_locked"
    # locked: neither a valid recovery code nor the authenticator code gets in, and the valid code is NOT spent
    assert fresh_login(arx, arx.viewer, codes[0]).status_code == 429
    bump_step(arx, "u-viewer")
    assert fresh_login(arx, arx.viewer, code_now(arx, "u-viewer")).status_code == 429
    assert rows(arx, "SELECT COUNT(*) AS n FROM auth_recovery_codes WHERE used_at IS NOT NULL") == [{"n": 0}]
    reasons = [r["reason"] for r in audit_rows(arx, "auth.second_factor.failed")]
    assert reasons.count("second_factor_invalid") == 4 and "second_factor_locked" in reasons


# ---------------------------------------------------------------- regenerate: fresh step-up, old batch dead

def test_regenerating_needs_a_fresh_step_up_and_voids_the_old_batch(arx, clock):
    old = enrol_with_codes(arx, arx.owner)
    clock.advance(6)  # the enrolment's own proof ran out
    r = arx.client.post(CODES, json={})
    assert r.status_code == 403 and r.json()["code"] == "step_up_required"
    assert r.json()["details"]["action"] == "auth.recovery_codes.regenerate" and r.json()["details"]["methods"] == ["totp"]
    denied = audit_rows(arx, "auth.recovery_codes.generated")[-1]
    assert denied["decision"] == "denied" and denied["reason"] == "step_up_required"
    assert arx.client.get(CODES).json()["remaining"] == 10  # nothing changed
    # a recovery code is NOT accepted to mint new codes (only the live authenticator code)
    r = arx.client.post(CODES, json={"code": old[0]})
    assert r.status_code == 400 and r.json()["code"] == "second_factor_invalid"
    # the current authenticator code in the body
    bump_step(arx, "u-owner")
    r = arx.client.post(CODES, json={"code": code_now(arx, "u-owner")})
    assert r.status_code == 200, r.text
    new = r.json()["codes"]
    assert len(new) == 10 and not set(new) & set(old) and r.json()["remaining"] == 10 and r.json()["total"] == 10
    gen = audit_rows(arx, "auth.recovery_codes.generated")[-1]
    assert gen["decision"] == "allowed" and details(gen)["reason"] == "regenerate" and details(gen)["voided"] == 10
    assert len(rows(arx, "SELECT batch_id FROM auth_recovery_codes WHERE user_id = 'u-owner' GROUP BY batch_id")) == 1
    # the old batch no longer works; the new one does
    assert fresh_login(arx, arx.owner, old[1]).status_code == 401
    assert fresh_login(arx, arx.owner, new[0]).status_code == 200


def test_a_step_up_proof_on_the_session_is_enough_to_regenerate(arx, clock):
    enrol_with_codes(arx, arx.owner)
    clock.advance(6)
    bump_step(arx, "u-owner")
    assert arx.client.post(VERIFY, json={"method": "totp", "code": code_now(arx, "u-owner")}).status_code == 200
    r = arx.client.post(CODES)
    assert r.status_code == 200 and len(r.json()["codes"]) == 10
    # MFA-SECFIX-2500 (owner Q2 = b): with the switch OFF nothing is asked - a new batch is made with no proof
    clock.advance(6)
    assert arx.client.post(CODES).status_code == 403  # switch on, the proof ran out
    arx.setting("security.step_up", "off")
    assert arx.client.post(CODES).status_code == 200


def test_right_after_enrolment_the_enrolment_proof_counts(arx):
    enrol_with_codes(arx, arx.viewer)
    r = arx.client.post(CODES)
    assert r.status_code == 200 and r.json()["remaining"] == 10


# ---------------------------------------------------------------- a recovery code as a step-up proof

def test_a_recovery_code_is_a_step_up_proof_once(arx, clock):
    codes = enrol_with_codes(arx, arx.owner)
    clock.advance(6)
    assert title(arx, "Lobby").status_code == 403
    v = arx.client.post(VERIFY, json={"method": "recovery_code", "code": codes[2], "action": "system.configure"})
    assert v.status_code == 200, v.text
    assert v.json()["method"] == "recovery_code" and v.json()["minutes"] == 5
    assert title(arx, "Lobby").status_code == 200
    ok = audit_rows(arx, "auth.step_up.ok")[-1]
    assert details(ok)["method"] == "recovery_code" and details(ok)["action"] == "system.configure"
    used = audit_rows(arx, "auth.recovery_code.used")[-1]
    assert details(used)["used_for"] == "step_up" and details(used)["remaining"] == 9
    # the same code is spent
    clock.advance(6)
    again = arx.client.post(VERIFY, json={"method": "recovery_code", "code": codes[2]})
    assert again.status_code == 400 and again.json()["code"] == "second_factor_invalid"
    failed = audit_rows(arx, "auth.step_up.failed")[-1]
    assert failed["reason"] == "step_up_invalid" and details(failed)["method"] == "recovery_code"
    # a 6-digit authenticator code sent as a recovery code is a wrong code, not a silent pass
    bump_step(arx, "u-owner")
    mixed = arx.client.post(VERIFY, json={"method": "recovery_code", "code": code_now(arx, "u-owner")})
    assert mixed.status_code == 400 and title(arx, "x").status_code == 403


def test_step_up_with_recovery_codes_shares_the_lockout(arx, clock):
    codes = enrol_with_codes(arx, arx.owner)
    clock.advance(6)
    statuses = [arx.client.post(VERIFY, json={"method": "recovery_code", "code": f"YYYY-YYY{i}"}).status_code for i in range(5)]
    assert statuses == [400, 400, 400, 400, 429]
    assert arx.client.post(VERIFY, json={"method": "recovery_code", "code": codes[0]}).status_code == 429
    assert arx.client.get(CODES).json()["remaining"] == 10


# ---------------------------------------------------------------- removal: the lost-phone path, and the codes go with the factor

def test_the_factor_can_be_removed_with_a_recovery_code_and_the_codes_go_with_it(arx):
    codes = enrol_with_codes(arx, arx.viewer)
    assert fresh_login(arx, arx.viewer, codes[0]).status_code == 200  # the phone is lost: in with a recovery code
    r = arx.client.post(DISABLE, json={"code": codes[1]})
    assert r.status_code == 200 and r.json()["enabled"] is False
    assert rows(arx, "SELECT COUNT(*) AS n FROM auth_recovery_codes WHERE user_id = 'u-viewer'") == [{"n": 0}]
    assert details(audit_rows(arx, "auth.recovery_code.used")[-1])["used_for"] == "disable"
    st = arx.client.get(CODES).json()
    assert st["available"] is False and st["remaining"] == 0
    # enrolling again hands out a fresh batch
    again = enrol_with_codes(arx, arx.viewer)
    assert len(again) == 10 and not set(again) & set(codes)


def test_an_administrators_reset_deletes_the_users_codes(arx):
    enrol_with_codes(arx, arx.viewer)
    from fastapi.testclient import TestClient

    local = TestClient(arx.app)  # the developer identity (system_admin, no factor of its own) on the local channel
    r = local.delete("/api/v1/auth/second-factor/users/u-viewer")
    assert r.status_code == 200 and r.json()["removed"] is True
    assert rows(arx, "SELECT COUNT(*) AS n FROM auth_recovery_codes WHERE user_id = 'u-viewer'") == [{"n": 0}]


def test_an_administrators_reset_does_not_take_a_recovery_code_as_the_admins_own_code(arx):
    enrol_with_codes(arx, arx.viewer)
    admin_codes = enrol_with_codes(arx, arx.owner)
    r = arx.client.request("DELETE", "/arx/api/v1/auth/second-factor/users/u-viewer", headers={HEADER: admin_codes[0]})
    assert r.status_code in (400, 403) and rows(arx, "SELECT enabled FROM auth_totp WHERE user_id = 'u-viewer'") == [{"enabled": 1}]
    assert arx.client.get(CODES).json()["remaining"] == 10  # the admin's code was not spent


# ---------------------------------------------------------------- the low-count warning

def test_few_remaining_codes_raise_the_warning(arx):
    enrol_with_codes(arx, arx.viewer)
    with arx.db.connection() as conn:
        conn.execute("UPDATE auth_recovery_codes SET used_at = '2026-11-24T00:00:00+00:00', used_for = 'sign_in' "
                     "WHERE id IN (SELECT id FROM auth_recovery_codes WHERE user_id = 'u-viewer' ORDER BY id LIMIT 7)")
    st = arx.client.get(CODES).json()
    assert st["remaining"] == 3 and st["low"] is True and st["last_used_at"]


# ---------------------------------------------------------------- the service directly: single use under a race, the hash primitive

def test_consume_is_single_use_and_uses_the_password_hash_primitive(arx, monkeypatch):
    with arx.db.connection() as conn:
        codes, voided = rc.generate(conn, "u-x")
        assert voided == 0
        checked: list[str] = []
        real = lp.verify
        monkeypatch.setattr(lp, "verify", lambda c, h: checked.append(h) or real(c, h))
        assert rc.consume(conn, "u-x", codes[3], "sign_in") is True
        assert checked and all(h.startswith("$scrypt$") for h in checked)
        assert rc.consume(conn, "u-x", codes[3], "sign_in") is False
        assert rc.consume(conn, "u-y", codes[4], "sign_in") is False
        assert rc.status(conn, "u-x")["remaining"] == 9
        # a second generation voids the 9 unused codes
        assert rc.generate(conn, "u-x")[1] == 9 and rc.consume(conn, "u-x", codes[4], "sign_in") is False


def test_production_hash_profile_is_scrypt_and_verifiable():
    lp._profile_override = None
    phc, _ = lp.hash_password("ABCDEFGH", rc.RECOVERY_PROFILE)
    assert phc.startswith("$scrypt$ln=14,r=8,p=1$") and lp.verify("ABCDEFGH", phc) and not lp.verify("ABCDEFGJ", phc)


# ---------------------------------------------------------------- the Arx-only sign-in's second step

def test_the_local_sign_in_second_step_accepts_a_recovery_code(settings, tmp_path, monkeypatch):
    import base64

    from smplwise.services import second_factor as sf
    from test_local_identity import Lx

    lx = Lx(settings, tmp_path, monkeypatch)
    lx.enable()
    created, c = lx.ready("maria")
    secret = c.post("/arx/api/v1/auth/second-factor/enroll").json()["secret"]
    code = sf.hotp(base64.b32decode(secret + "=" * (-len(secret) % 8)), sf.step_of())
    r = c.post("/arx/api/v1/auth/second-factor/confirm", json={"code": code})
    assert r.status_code == 200
    codes = r.json()["recovery_codes"]
    c2 = lx.remote()
    assert lx.sign_in(c2, "maria").status_code == 202
    r = c2.post("/arx/api/v1/auth/local/sign-in/second-factor", json={"code": codes[0]})
    assert r.status_code == 200, r.text
    signed = audit_rows(lx, "auth.local.sign_in.succeeded")[-1]
    assert details(signed)["factor"] == "recovery_code"
    assert details(audit_rows(lx, "auth.recovery_code.used")[-1])["used_for"] == "local_sign_in"
    c3 = lx.remote()
    assert lx.sign_in(c3, "maria").status_code == 202
    r = c3.post("/arx/api/v1/auth/local/sign-in/second-factor", json={"code": codes[0]})
    assert r.status_code == 401 and r.json()["code"] == "second_factor_invalid"
    from smplwise.services import ha_user_auth as hua

    hua.reset_for_tests()


# ---------------------------------------------------------------- plumbing

def test_codes_never_travel_in_a_backup_and_go_with_a_purged_user():
    from smplwise.services import backup, local_privacy

    assert "auth_recovery_codes" in backup.NEVER_EXPORTED_TABLES
    assert ("auth_recovery_codes", "user_id") in local_privacy.DELETE_ROWS


def test_the_wire_models_name_the_new_shapes():
    from smplwise.wire import second_factor as W

    assert set(W.RecoveryStatus.model_fields) == {"available", "remaining", "total", "created_at", "last_used_at", "low", "low_at"}
    assert "codes" in W.RecoveryBatch.model_fields and "recovery_codes" in W.FactorEnabled.model_fields


def test_the_verify_body_names_passkey_but_this_branch_refuses_it(arx, clock):
    """The method pattern is shared with slice 4 (MFA-PASSKEYS-2490); without its challenge and assertion a passkey proof is refused,
    never read as a code (MFA-SECFIX-2500: in the train the passkey method goes to its own verifier, which wants an assertion)."""
    enrol_with_codes(arx, arx.owner)
    clock.advance(6)
    bump_step(arx, "u-owner")
    r = arx.client.post(VERIFY, json={"method": "passkey", "code": code_now(arx, "u-owner")})
    assert r.status_code == 422 and title(arx, "x").status_code == 403
    assert arx.client.post(VERIFY, json={"method": "sms", "code": "123456"}).status_code == 422
