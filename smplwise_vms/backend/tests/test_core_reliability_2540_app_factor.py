"""CORE-RELIABILITY-2540, deep review SEC-4: once a policy required a second factor, the phone app's web session (exchange and
redeem) refused every Home Assistant user whose factor was not the authenticator code - a phone key (owner Q51: "password + phone
key = two-factor"), a passkey with `security.passkey_remote_factor` on, HA's own MFA under the enforced sign-in factor policy. The
app signed in, minted its saved sign-in, and then the web view never opened ("enrol a factor" for a user who has one).

Now the web session asks the remote sign-in's own rule (ha_user_auth.factor_owed). Still fail closed: no factor, an administrator's
reset, a family without an HA MFA record, and any unknown answer refuse. Fakes only: no Home Assistant, no phone."""
# the shared fixture imported from its module is the test functions' argument (pytest injects it):
# ruff: noqa: F811
from __future__ import annotations

import os

import pytest
from test_app_refresh_295 import family_row, rx  # noqa: F401 - rx is the shared fixture
from test_app_session_295 import exchange, redeem, sproof, started, webview

from smplwise.db import new_id, now_iso
from smplwise.services import app_session as xs
from smplwise.services import ha_user_auth as hua
from smplwise.services import second_factor as sf


def _admins_policy(rx) -> None:
    rx.arx.setting(sf.POLICY_KEY, "admins")


def _phone_key(rx, user_id: str) -> None:
    """An active phone key (MFA-DEVICEKEY-2490) of the user - the row the enrolment flow writes."""
    with rx.db.connection() as conn:
        conn.execute("INSERT INTO auth_device_keys(id, user_id, label, spki, fp, alg, auth_kind, platform, created_at) VALUES (?, ?, 'phone', ?, ?, 'ES256', 'biometric', 'android', ?)",
                     (new_id(), user_id, os.urandom(32), new_id(), now_iso()))


def _exchange(rx, dev, out, key):
    return exchange(rx, out["access_token"], dev["device_id"], sproof(rx, key, dev["device_id"], out["access_token"]))


def test_sec4_an_administrator_whose_only_factor_is_the_phone_key_opens_the_web_view(rx):
    dev, out, key = started(rx, "joni")  # the administrator's phone: signed in, saved sign-in minted, exchange on
    uid = family_row(rx, out["family_id"])["user_id"]
    _admins_policy(rx)
    # no factor at all: refused (fail closed, unchanged)
    r = _exchange(rx, dev, out, key)
    assert r.status_code == 403 and r.json()["code"] == "second_factor_enrollment_required"
    _phone_key(rx, uid)
    r = _exchange(rx, dev, out, key)
    # before the fix: 403 second_factor_enrollment_required - the phone key did not count here
    assert r.status_code == 200, r.text
    rr = redeem(rx, r.json()["code"], webview(rx))
    assert rr.status_code == 303 and rr.headers["location"] == "/arx/", rr.headers


def test_sec4_an_authenticator_code_user_still_passes_and_a_user_without_policy_too(rx):
    dev, out, key = started(rx, "dana")  # a viewer: the admins policy does not apply to her
    _admins_policy(rx)
    assert _exchange(rx, dev, out, key).status_code == 200


@pytest.mark.parametrize("owed, ha_mfa, refused", [
    ("none", None, False),
    ("code", None, False),            # an authenticator code, a counting passkey, an active phone key
    ("ha_mfa", 1, False),             # the enforced factor policy alone, and the minting sign-in had HA MFA
    ("ha_mfa", 0, True),
    ("ha_mfa", None, True),           # an older family: no record - fail closed
    ("enroll", 1, True),              # a legacy rule (user / role / admins): HA MFA does not satisfy it
    (hua.FACTOR_ENROLL_AFTER_RESET, 1, True),
    ("something_new", 1, True),       # an answer this check does not know: fail closed
])
def test_sec4_the_web_session_follows_the_shared_rule(monkeypatch, owed, ha_mfa, refused):
    monkeypatch.setattr(hua, "factor_owed", lambda conn, principal, passkey=False: owed)
    assert xs._enrol_refused(None, {"user_id": "u-owner", "ha_mfa": ha_mfa}) is refused  # type: ignore[arg-type]


def test_sec4_an_arx_only_identity_is_never_refused_here(monkeypatch):
    monkeypatch.setattr(hua, "factor_owed", lambda *a, **k: "enroll")
    assert xs._enrol_refused(None, {"user_id": xs.LOCAL_ID_PREFIX + "x", "ha_mfa": None}) is False  # type: ignore[arg-type]


def test_sec4_the_remote_sign_in_and_the_web_session_use_one_rule():
    import inspect

    assert "factor_owed(" in inspect.getsource(hua.second_factor_need)
    assert "factor_owed(" in inspect.getsource(xs._enrol_refused)
    assert "is_enrolled" not in inspect.getsource(xs._enrol_refused)
