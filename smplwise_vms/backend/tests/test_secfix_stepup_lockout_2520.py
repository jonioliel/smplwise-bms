"""SEC-FIX-2520 SEC-1 (docs/review/DEEP-REVIEW-2520-SECURITY.md): with step-up on, a wrong code typed inline
(`X-Arx-Second-Factor`) on a conditional once-action - a binding of the system-administrator role, a backup restore - was
counted on the request's transaction and then rolled back by the step-up refusal, so the wrong-code lockout never engaged
(unlimited guessing). The count must survive the refusal: the same FAILURES limits, lockout and audit as every other
wrong-code path.

Fakes only (the fake HA core of tests/test_remote_access.py); no lab, no Home Assistant, no network."""
# ruff: noqa: F811 - the `arx` / `clock` fixtures are imported by name and used as test parameters
from __future__ import annotations

import json

from smplwise.services import second_factor as sf
from smplwise.services import step_up
from test_mfa_stepup_2490 import clock  # noqa: F401 - `clock` is a fixture
from test_second_factor import HEADER, arx, bump_step, code_now, enrol  # noqa: F401 - `arx` is the fixture

API = "/arx/api/v1"
BINDINGS = "/access/bindings"
SYSADMIN = {"subject_kind": "user", "subject_id": "u-viewer", "role_id": "system_admin", "scope_type": "installation", "scope_id": "*",
            "effect": "allow"}
WRONG = ["000000", "111111", "222222", "333333", "444444", "555555", "666666", "777777"]


def _owner_remote_with_a_factor(arx, clock) -> None:
    enrol(arx, arx.owner)
    clock.advance(6)  # the enrolment's own proof ran out


def _failure_row(arx, user_id: str):
    with arx.db.connection(mode="read") as conn:
        return conn.execute("SELECT attempts_json, locked_until FROM auth_totp_failures WHERE user_id = ?", (user_id,)).fetchone()


def _guess_until_locked(arx, send) -> list[tuple[int, str]]:
    out = []
    for code in WRONG[: sf.FAIL_MAX + 1]:
        r = send(code)
        out.append((r.status_code, r.json().get("code")))
    return out


def _expected() -> list[tuple[int, str]]:
    return [(400, "second_factor_invalid")] * (sf.FAIL_MAX - 1) + [(429, "second_factor_locked")] * 2


def test_wrong_inline_codes_on_a_system_admin_binding_lock_the_user_out(arx, clock):
    _owner_remote_with_a_factor(arx, clock)
    answers = _guess_until_locked(arx, lambda code: arx.client.post(API + BINDINGS, json=SYSADMIN, headers={HEADER: code}))
    assert answers == _expected(), answers
    row = _failure_row(arx, "u-owner")
    assert row is not None and row["locked_until"] is not None  # the lockout is stored (survives the refusal's rollback)
    reasons = [a["reason"] for a in arx.audit("auth.step_up.failed")]
    assert reasons == ["step_up_invalid"] * (sf.FAIL_MAX - 1) + ["step_up_locked"] * 2, reasons
    # the right code is refused too while the lockout runs, and nothing was granted
    bump_step(arx, "u-owner")
    r = arx.client.post(API + BINDINGS, json=SYSADMIN, headers={HEADER: code_now(arx, "u-owner")})
    assert r.status_code == 429 and r.json()["code"] == "second_factor_locked", r.text
    with arx.db.connection(mode="read") as conn:
        n = conn.execute("SELECT COUNT(*) FROM bindings WHERE subject_id = 'u-viewer' AND role_id = 'system_admin'").fetchone()[0]
    assert n == 0
    # the lockout is the same one every other path reads: the step-up verify route refuses as well
    r = arx.client.post(f"{API}/auth/step-up/verify", json={"method": "totp", "code": code_now(arx, "u-owner"),
                                                             "action": step_up.ONCE_ADMIN_ROLE})
    assert r.status_code == 429, r.text


def test_wrong_inline_codes_on_a_restore_lock_the_user_out(arx, clock):
    _owner_remote_with_a_factor(arx, clock)
    answers = _guess_until_locked(arx, lambda code: arx.client.post(f"{API}/backups/nope.tar.gz/restore", json={"confirm": "no"},
                                                                     headers={HEADER: code}))
    assert answers == _expected(), answers
    assert _failure_row(arx, "u-owner")["locked_until"] is not None
    assert [a["resource_id"] for a in arx.audit("auth.step_up.failed")] == [step_up.ONCE_RESTORE] * (sf.FAIL_MAX + 1)


def test_wrong_inline_codes_are_counted_together_with_the_verify_route(arx, clock):
    _owner_remote_with_a_factor(arx, clock)
    for code in WRONG[: sf.FAIL_MAX - 1]:  # four wrong codes on the once-actions ...
        assert arx.client.post(API + BINDINGS, json=SYSADMIN, headers={HEADER: code}).status_code == 400
    row = _failure_row(arx, "u-owner")
    assert row is not None and row["locked_until"] is None and len(json.loads(row["attempts_json"])) == sf.FAIL_MAX - 1
    r = arx.client.post(f"{API}/auth/step-up/verify", json={"method": "totp", "code": "999999"})  # ... and the fifth anywhere else
    assert r.status_code == 429, r.text
