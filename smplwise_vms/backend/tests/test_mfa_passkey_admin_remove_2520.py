"""MFA-PASSKEY-ADMIN-REMOVE-2520 (review docs/security/MFA-REVIEW-2520.md, finding N-2, the rest of it): an administrator's removal of
an Arx-only identity's passkey (`DELETE identity/local-users/{id}/passkeys/{pk}`) meets the factor reset's rules through the reset's
own code paths (services/factor_reset.py, MFA-RESET-HARDENING-2510):

* the typed username (`{"confirm"}`): required, compared like the reset (case, blanks, NFC), checked before the administrator's proof;
* one 3-per-hour budget with the reset (a removal counts as a reset, a reset counts against removals; refusals do not count);
* the managers are told (`security.second_factor_reset_by_admin`, content-free), the user too (N-6, unchanged);
* `must_enroll` when the removed passkey was the user's LAST sign-in factor (not when another passkey or the code stays);
* the last-administrator rule when it is the last factor (structurally unreachable today - an Arx-only identity is never a system
  administrator - so it is checked with the rule forced on);
* the preflight `GET .../passkeys/{pk}/remove-check` answers the same refusals in the same order.

The channel setting and the fresh sign-in from outside stay covered by tests/test_mfa_review_docs_2520.py and
tests/test_mfa_factor_harden_2520.py. Software authenticator (tests/webauthn_fake.py); no lab, no Home Assistant, no network."""
# ruff: noqa: F811 - the fixtures are imported by name and used as test parameters
from __future__ import annotations

import json

from webauthn_fake import FakeAuthenticator
from smplwise.audit import audit
from smplwise.rbac import Principal
from smplwise.services import factor_reset as fr
from test_local_passkeys import Px, _remote_admin, _with_passkey, px  # noqa: F401 - `px` is a fixture
from test_mfa_reset_hardening_2510 import enrol_directly
from test_mfa_secreview_2500 import _age_remote_sessions
from test_second_factor import HEADER, code_now

LOCAL = "/api/v1/identity/local-users/{uid}/passkeys"
REMOTE = "/arx/api/v1/identity/local-users/{uid}/passkeys"
MANAGERS = "security.second_factor_reset_by_admin"


def _ids(px: Px, uid: str) -> list[str]:
    return [p["id"] for p in px.admin.get(LOCAL.format(uid=uid)).json()["credentials"]]


def _remove(client, uid: str, pk: str, *, confirm: str | None = "maria", remote: bool = False, **headers):
    body = {} if confirm is None else {"confirm": confirm}
    return client.request("DELETE", f"{(REMOTE if remote else LOCAL).format(uid=uid)}/{pk}", json=body, headers=headers or None)


def _check(client, uid: str, pk: str, *, remote: bool = False):
    return client.get(f"{(REMOTE if remote else LOCAL).format(uid=uid)}/{pk}/remove-check")


def _denied(px: Px, reason: str) -> list[dict]:
    return [a for a in px.audit(fr.PASSKEY_ACTION) if a["decision"] == "denied" and a["reason"] == reason]


def _more_passkeys(px: Px, c, n: int) -> None:
    for _ in range(n):
        r = px.register(c, FakeAuthenticator())
        assert r.status_code == 201, r.text


def _must_enroll_flag(px: Px, uid: str) -> bool:
    rows = px.rows("SELECT must_enroll FROM auth_factor_resets WHERE user_id = ?", (uid,))
    return bool(rows and rows[0]["must_enroll"])


def _manager_notices(px: Px) -> list[dict]:
    return px.rows("SELECT * FROM notifications WHERE source = ?", (MANAGERS,))


# ---------------------------------------------------------------- the typed username

def test_the_typed_username_is_required_and_audited_and_nothing_is_removed(px: Px):
    px.configure()
    uid, _c, _auth = _with_passkey(px)
    pk = _ids(px, uid)[0]
    r = _remove(px.admin, uid, pk, confirm=None)
    assert r.status_code == 422 and r.json()["code"] == "factor_reset_confirm_required", r.text
    assert r.json()["details"] == {"field": "confirm"}
    r = _remove(px.admin, uid, pk, confirm="   ")
    assert r.status_code == 422 and r.json()["code"] == "factor_reset_confirm_required"
    r = px.admin.delete(f"{LOCAL.format(uid=uid)}/{pk}")  # no body at all (the old client)
    assert r.status_code == 422 and r.json()["code"] == "factor_reset_confirm_required"
    assert _ids(px, uid) == [pk]
    assert len(_denied(px, "confirm_required")) == 3
    assert not [a for a in px.audit(fr.PASSKEY_ACTION) if a["decision"] == "allowed"]
    assert _manager_notices(px) == []


def test_a_different_username_is_refused_and_the_typed_text_is_never_audited(px: Px):
    px.configure()
    uid, _c, _auth = _with_passkey(px)
    _created, _b = px.ready("boris")
    pk = _ids(px, uid)[0]
    for typed in ("boris", "mari", uid + "x"):
        r = _remove(px.admin, uid, pk, confirm=typed)
        assert r.status_code == 422 and r.json()["code"] == "factor_reset_confirm_mismatch", r.text
    assert _ids(px, uid) == [pk]
    rows = _denied(px, "confirm_mismatch")
    assert len(rows) == 3 and not any("boris" in json.dumps(a, ensure_ascii=False) for a in rows)


def test_the_typed_username_is_compared_like_the_reset(px: Px):
    px.configure()
    uid, _c, _auth = _with_passkey(px)
    pk = _ids(px, uid)[0]
    r = _remove(px.admin, uid, pk, confirm="  MARIA ")
    assert r.status_code == 200, r.text
    assert _ids(px, uid) == []


def test_the_body_still_refuses_unknown_fields(px: Px):
    px.configure()
    uid, _c, _auth = _with_passkey(px)
    pk = _ids(px, uid)[0]
    r = px.admin.request("DELETE", f"{LOCAL.format(uid=uid)}/{pk}", json={"confirm": "maria", "force": True})
    assert r.status_code == 422 and _ids(px, uid) == [pk]


def test_the_confirmation_is_checked_before_the_administrators_own_code(px: Px):
    px.configure()
    uid, _c, _auth = _with_passkey(px)
    pk = _ids(px, uid)[0]
    enrol_directly(px, "dev-joni")  # the administrator has the authenticator code: the once-action asks for it
    r = _remove(px.admin, uid, pk, confirm="wrong", **{HEADER: "000000"})
    assert r.status_code == 422 and r.json()["code"] == "factor_reset_confirm_mismatch"  # no code was checked (no failed-code row)
    assert not [a for a in px.audit(fr.PASSKEY_ONCE_ACTION) if a["decision"] == "denied"]
    r = _remove(px.admin, uid, pk)
    assert r.status_code == 403 and r.json()["code"] == "second_factor_step_up_required", r.text
    assert r.json()["details"]["action"] == fr.PASSKEY_ONCE_ACTION
    r = _remove(px.admin, uid, pk, **{HEADER: code_now(px, "dev-joni")})
    assert r.status_code == 200, r.text
    assert json.loads(px.audit(fr.PASSKEY_ACTION)[-1]["details_json"])["step_up"] is True


# ---------------------------------------------------------------- one 3-per-hour budget with the reset

def test_three_removals_per_administrator_per_hour_then_an_audited_refusal(px: Px):
    px.configure()
    uid, c, _auth = _with_passkey(px)
    _more_passkeys(px, c, 3)
    ids = _ids(px, uid)
    assert len(ids) == 4
    lefts = []
    for pk in ids[:3]:
        r = _remove(px.admin, uid, pk)
        assert r.status_code == 200, r.text
        lefts.append(r.json()["resets_left"])
    assert lefts == [2, 1, 0]
    assert _check(px.admin, uid, ids[3]).json()["reason"] == "rate_limited"
    r = _remove(px.admin, uid, ids[3])
    assert r.status_code == 429 and r.json()["code"] == "factor_reset_rate_limited", r.text
    assert r.json()["details"] == {"limit": 3, "window_s": 3600}
    assert _ids(px, uid) == [ids[3]]
    assert len(_denied(px, "rate_limited")) == 1
    # the reset's own preflight sees the same budget: the removals spent it
    assert px.admin.get("/api/v1/auth/second-factor/users/u-owner/reset-check").json()["resets_left"] == 0


def test_resets_count_against_removals_and_refusals_count_for_nothing(px: Px):
    px.configure()
    uid, _c, _auth = _with_passkey(px)
    pk = _ids(px, uid)[0]
    for _ in range(4):  # refusals of either route never spend the budget
        assert _remove(px.admin, uid, pk, confirm="nobody").status_code == 422
    assert _check(px.admin, uid, pk).json()["resets_left"] == 3
    joni = Principal(user_id="dev-joni", username="joni", display_name="Joni", source="internal")
    with px.db.connection() as conn:  # three factor resets by the same administrator within the hour
        for target in ("u-a", "u-b", "u-c"):
            audit(conn, actor=joni, action=fr.ACTION, decision="allowed", resource_type="user", resource_id=target, details={})
    check = _check(px.admin, uid, pk).json()
    assert check["resets_left"] == 0 and check["reason"] == "rate_limited" and check["allowed"] is False
    r = _remove(px.admin, uid, pk)
    assert r.status_code == 429 and r.json()["code"] == "factor_reset_rate_limited"
    # another administrator's budget is untouched
    with px.db.connection(mode="read") as conn:
        assert fr.resets_left(conn, "u-owner") == 3 and fr.resets_left(conn, "dev-joni") == 0


# ---------------------------------------------------------------- the notices, must_enroll

def test_the_managers_are_told_content_free_and_the_user_too(px: Px):
    px.configure()
    uid, _c, _auth = _with_passkey(px)
    pk = _ids(px, uid)[0]
    assert _remove(px.admin, uid, pk).status_code == 200
    notes = _manager_notices(px)
    assert len(notes) == 1
    text = json.dumps(notes[0], ensure_ascii=False)
    assert "maria" not in text.lower() and uid not in text and pk not in text and "dev-joni" not in text  # content-free
    managers = [r["user_id"] for r in px.rows("SELECT r.user_id FROM notification_recipients r JOIN notifications n ON n.id = r.notification_id "
                                              "WHERE n.source = ?", (MANAGERS,))]
    assert managers and uid not in managers
    users = px.rows("SELECT r.user_id FROM notification_recipients r JOIN notifications n ON n.id = r.notification_id WHERE n.source = ?",
                    ("security.second_factor_changed",))
    assert [r["user_id"] for r in users] == [uid]
    d = json.loads([a for a in px.audit(fr.PASSKEY_ACTION) if a["decision"] == "allowed"][-1]["details_json"])
    assert d["managers_notified"] is True and d["reset_channel"] == "any" and d["resets_left"] == 2 and d["passkey"] == pk


def test_must_enroll_only_when_the_last_sign_in_factor_goes(px: Px):
    px.configure()
    uid, c, _auth = _with_passkey(px)
    _more_passkeys(px, c, 1)
    first, second = _ids(px, uid)
    r = _remove(px.admin, uid, first)  # another usable passkey stays
    assert r.status_code == 200 and r.json()["must_enroll"] is False
    assert not _must_enroll_flag(px, uid)
    r = _remove(px.admin, uid, second)  # the last one
    assert r.status_code == 200 and r.json()["must_enroll"] is True, r.text
    assert _must_enroll_flag(px, uid)
    assert json.loads(px.audit(fr.PASSKEY_ACTION)[-1]["details_json"])["must_enroll"] is True
    # the next factor the user enrols ends it (services/local_passkeys.register -> factor_reset.enrolled)
    c2 = px.remote()
    assert px.sign_in(c2, "maria").status_code == 200  # no factor left: the password alone (policy optional)
    _more_passkeys(px, c2, 1)
    assert not _must_enroll_flag(px, uid)


def test_must_enroll_not_while_the_authenticator_code_stays(px: Px):
    px.configure()
    uid, _c, _auth = _with_passkey(px)
    enrol_directly(px, uid)  # the Arx-only identity also has the authenticator code
    pk = _ids(px, uid)[0]
    with px.db.connection(mode="read") as conn:
        assert fr.passkey_removal_leaves_no_factor(conn, uid, pk) is False
    r = _remove(px.admin, uid, pk)
    assert r.status_code == 200 and r.json()["must_enroll"] is False
    assert not _must_enroll_flag(px, uid)


def test_the_preflight_names_what_goes_and_whether_the_user_enrols_again(px: Px):
    px.configure()
    uid, c, _auth = _with_passkey(px)
    _more_passkeys(px, c, 1)
    first, second = _ids(px, uid)
    check = _check(px.admin, uid, first).json()
    assert check["allowed"] is True and check["reason"] is None and check["confirm_text"] == "maria"
    assert check["factors"] == {"totp": False, "passkeys": 1, "device_keys": 0, "recovery_codes": 0}
    assert check["must_enroll_after"] is False and check["remote"] is False and check["channel"] == "any"
    assert check["resets_left"] == 3 and check["rate_max"] == 3 and check["step_up"]["action"] == fr.PASSKEY_ONCE_ACTION
    # a factor policy that requires a factor of this user, and the last passkey: the user would enrol again
    assert px.admin.put(f"/api/v1/auth/second-factor/overrides/user/{uid}", json={"policy": "required"}).status_code == 200
    assert _check(px.admin, uid, first).json()["must_enroll_after"] is False  # the second passkey stays
    assert _remove(px.admin, uid, first).status_code == 200
    assert _check(px.admin, uid, second).json()["must_enroll_after"] is True
    # nothing was spent by the preflight
    assert _check(px.admin, uid, second).json()["resets_left"] == 2


def test_the_preflight_refusals(px: Px):
    px.configure()
    uid, _c, _auth = _with_passkey(px)
    pk = _ids(px, uid)[0]
    assert _check(px.admin, uid, "pk_nope").status_code == 404
    assert _check(px.admin, "l-nobody", pk).status_code == 404
    px.admin.get("/api/v1/me", headers={"X-SW-Dev-User": "dana"})
    px.bind("dev-dana", "viewer")
    assert px.admin.get(f"{LOCAL.format(uid=uid)}/{pk}/remove-check", headers={"X-SW-Dev-User": "dana"}).status_code == 403
    remote_admin = _remote_admin(px)
    assert px.admin.patch("/api/v1/settings", json={"security.factor_reset_channel": "local"}).status_code == 200
    assert _check(remote_admin, uid, pk, remote=True).json()["reason"] == "local_only"
    assert px.admin.patch("/api/v1/settings", json={"security.factor_reset_channel": "any"}).status_code == 200
    assert _check(remote_admin, uid, pk, remote=True).json()["reason"] is None
    _age_remote_sessions(6 * 60)
    stale = _check(remote_admin, uid, pk, remote=True).json()
    assert stale["reason"] == "reauth" and stale["remote"] is True and stale["allowed"] is False
    r = _remove(remote_admin, uid, pk, remote=True)
    assert r.status_code == 403 and r.json()["code"] == "reauth_required"
    assert r.json()["details"]["action"] == fr.PASSKEY_ONCE_ACTION
    assert _ids(px, uid) == [pk]


# ---------------------------------------------------------------- the last administrator (forced: unreachable today)

def test_the_last_administrator_rule_only_when_the_last_sign_in_factor_goes(px: Px, monkeypatch):
    px.configure()
    uid, c, _auth = _with_passkey(px)
    _more_passkeys(px, c, 1)
    first, second = _ids(px, uid)
    calls: list[str] = []

    def always(conn, target, *, remote_on):
        calls.append(target)
        return True

    monkeypatch.setattr(fr, "last_admin_blocks", always)  # as if the user were the last administrator who can sign in remotely
    assert _check(px.admin, uid, first).json()["reason"] is None  # another passkey stays: the rule is not even asked
    r = _remove(px.admin, uid, first)
    assert r.status_code == 200, r.text
    assert calls == []
    assert _check(px.admin, uid, second).json()["reason"] == "last_admin"
    r = _remove(px.admin, uid, second)
    assert r.status_code == 409 and r.json()["code"] == "factor_reset_last_admin", r.text
    assert _ids(px, uid) == [second] and len(_denied(px, "last_admin")) == 1
    assert calls == [uid, uid]


def test_an_arx_only_identity_is_never_a_system_administrator_so_the_real_rule_passes(px: Px):
    px.configure()
    uid, _c, _auth = _with_passkey(px, role="viewer")
    pk = _ids(px, uid)[0]
    with px.db.connection(mode="read") as conn:
        assert fr.passkey_removal_leaves_no_factor(conn, uid, pk) is True
        assert fr.passkey_last_admin_blocks(conn, uid, pk, remote_on=True) is False


# ---------------------------------------------------------------- unchanged: permission, unknown passkey

def test_permission_and_unknown_passkey_come_first(px: Px):
    px.configure()
    uid, _c, _auth = _with_passkey(px)
    pk = _ids(px, uid)[0]
    px.admin.get("/api/v1/me", headers={"X-SW-Dev-User": "dana"})
    px.bind("dev-dana", "viewer")
    r = px.admin.request("DELETE", f"{LOCAL.format(uid=uid)}/{pk}", json={"confirm": "maria"}, headers={"X-SW-Dev-User": "dana"})
    assert r.status_code == 403
    r = _remove(px.admin, uid, "pk_nope")
    assert r.status_code == 404 and r.json()["code"] == "passkey_not_found"
    assert px.audit(fr.PASSKEY_ACTION) == []  # neither is a reset refusal
