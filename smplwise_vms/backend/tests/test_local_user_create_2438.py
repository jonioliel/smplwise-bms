"""CR-LOCAL-USER-CREATE-2438 (owner 18.11): an administrator sets an Arx user's password - at creation and later - and no refusal of
the create route is silent.

Creation with a password: the same policy as the set-password page (`security.local_password_min`, the common / contextual / repeated
checks), hashed by `local_passwords`, `must_change` on unless the administrator turns it off, no first-login link. The sign-in honours
`must_change` (the session reaches only the change route until the user chose their own password). `PUT identity/local-users/{id}/password`
does the same for an existing user and ends the user's sessions, links and reset codes. Administrative targets stay local-channel only.
Audit: `identity.local.password.set_by_admin` (never the secret) and `identity.local.user.create_refused` with the refusal's code.
Fakes only: no Home Assistant, no device."""
from __future__ import annotations

import json
import logging
import sqlite3

from test_local_identity import GOOD, GOOD2, Lx, _remote_admin, lx  # noqa: F401 - `lx` is the fixture

ADMIN_PW = "seven green boats 91"
URL = "/api/v1/identity/local-users"


def _audits(lx: Lx, action: str) -> list[dict]:
    rows = lx.rows("SELECT action, decision, reason, resource_id, details_json FROM audit_log WHERE action = ? ORDER BY rowid", (action,))
    return [{**r, "details": json.loads(r["details_json"] or "{}")} for r in rows]


def _post(lx: Lx, **body):
    return lx.admin.post(URL, json={"username": "maria", "display_name": "מריה לוי", "role_id": "viewer", **body})


# ---------------------------------------------------------------- creation with a password

def test_create_with_a_password_signs_in_and_must_change_by_default(lx):
    lx.enable()
    r = _post(lx, password=ADMIN_PW)
    assert r.status_code == 201, r.text
    out = r.json()
    assert out["link"] is None and out["password_set"] is True  # the password IS the way in: no first-login link is minted
    assert out["user"]["status"] == "active" and out["user"]["must_change_password"] is True
    uid = out["user"]["id"]
    assert lx.rows("SELECT COUNT(*) AS n FROM auth_local_links WHERE user_id = ?", (uid,))[0]["n"] == 0
    cred = lx.rows("SELECT password_hash, set_by, must_change FROM auth_local_credentials WHERE user_id = ?", (uid,))[0]
    assert cred["password_hash"].startswith("$") and ADMIN_PW not in cred["password_hash"] and cred["set_by"] == "admin" and cred["must_change"] == 1

    c = lx.remote()
    r = lx.sign_in(c, "maria", ADMIN_PW)
    assert r.status_code == 200 and r.json()["must_change_password"] is True
    # must_change is honoured: the session reaches nothing but the way out of that state
    assert c.get("/arx/api/v1/me").status_code == 200
    r = c.get("/arx/api/v1/sites")
    assert r.status_code == 403 and r.json()["code"] == "password_change_required"
    r = c.put("/arx/api/v1/auth/local/password", json={"current_password": ADMIN_PW, "new_password": GOOD})
    assert r.status_code == 200, r.text
    assert c.get("/arx/api/v1/sites").status_code == 200
    assert lx.rows("SELECT must_change, set_by FROM auth_local_credentials WHERE user_id = ?", (uid,)) == [{"must_change": 0, "set_by": "self"}]

    set_rows = _audits(lx, "identity.local.password.set_by_admin")
    assert len(set_rows) == 1 and set_rows[0]["decision"] == "allowed" and set_rows[0]["resource_id"] == uid
    assert set_rows[0]["details"] == {"at": "create", "must_change": True, "channel": "local", "admin_target": False}
    created = _audits(lx, "identity.local.user.created")
    assert created[0]["details"]["password_set"] is True and created[0]["details"]["must_change"] is True
    assert _audits(lx, "auth.local.link.issued") == []


def test_must_change_is_the_administrators_choice(lx):
    lx.enable()
    r = _post(lx, password=ADMIN_PW, must_change=False)
    assert r.status_code == 201 and r.json()["user"]["must_change_password"] is False
    c = lx.remote()
    r = lx.sign_in(c, "maria", ADMIN_PW)
    assert r.status_code == 200 and r.json()["must_change_password"] is False
    assert c.get("/arx/api/v1/sites").status_code == 200


def test_create_without_a_password_still_returns_the_first_login_link(lx):
    lx.enable()
    out = lx.create("maria")
    assert out["link"]["purpose"] == "first_login" and out["password_set"] is False and out["user"]["status"] == "pending_first_login"
    assert lx.set_password(lx.link_token(out)).status_code == 200
    assert _audits(lx, "identity.local.password.set_by_admin") == []


def test_the_password_policy_refuses_and_nothing_is_created(lx):
    lx.enable()
    lx.admin.patch("/api/v1/settings", json={"security.local_password_min": 14})
    for bad, reason in (("short pw 12", "too_short"), ("thirteen char", "too_short"), ("maria maria maria", "contextual"), ("aaaaaaaaaaaaaaaa", "repeated")):
        r = _post(lx, password=bad)
        assert r.status_code == 400 and r.json()["code"] == "password_policy", (bad, r.text)
        assert r.json()["details"]["reason"] == reason and r.json()["details"]["min_length"] == 14, bad
    assert lx.rows("SELECT COUNT(*) AS n FROM users WHERE source = 'local'")[0]["n"] == 0
    refused = _audits(lx, "identity.local.user.create_refused")
    assert [x["reason"] for x in refused] == ["password_policy"] * 4 and all(x["decision"] == "denied" for x in refused)
    assert refused[0]["details"]["policy"] == "too_short"
    r = _post(lx, password="fourteen chars ok 7")
    assert r.status_code == 201, r.text


# ---------------------------------------------------------------- no silent refusal of the create route

def test_every_refusal_of_the_create_route_is_audited_with_its_reason(lx):
    lx.enable()
    lx.create("taken")
    cases = [
        ({"username": "דנה"}, 422, "validation"),               # Hebrew
        ({"username": "has space"}, 422, "validation"),
        ({"username": "ab"}, 422, "validation"),
        ({"username": "x" * 33}, 422, "validation"),
        ({"display_name": "   "}, 422, "validation"),
        ({"email": "not-an-address"}, 422, "validation"),
        ({"role_id": "no_such_role"}, 422, "role_unknown"),
        ({"role_id": "system_admin"}, 422, "role_not_allowed_for_local_user"),
        ({"scope_type": "site", "scope_id": "no-such-site"}, 422, "scope_unknown"),
        ({"role_id": "site_admin", "reset_mode": "self_service"}, 422, "self_service_not_for_admins"),
        ({"username": "Taken"}, 409, "username_taken"),
    ]
    for body, status, code in cases:
        r = _post(lx, **body)
        assert (r.status_code, r.json()["code"]) == (status, code), (body, r.text)
        assert r.json()["user_message"], body  # the screen shows the server's own sentence
    refused = _audits(lx, "identity.local.user.create_refused")
    assert [x["reason"] for x in refused] == [c[2] for c in cases]
    assert refused[0]["details"]["field"] == "username" and refused[0]["details"]["status"] == 422
    # the typed name is not copied into the audit (a mistyped secret in the wrong field must not be kept)
    assert "has space" not in json.dumps(refused) and "דנה" not in json.dumps(refused, ensure_ascii=False)
    # capitals are fine: the name is kept lower-case
    r = _post(lx, username="Dana.K")
    assert r.status_code == 201 and r.json()["user"]["username"] == "dana.k"


def test_a_refusal_while_the_feature_is_off_and_on_the_remote_channel_is_audited(lx):
    r = _post(lx)
    assert r.status_code == 409 and r.json()["code"] == "local_identity_off"
    lx.enable()
    remote = _remote_admin(lx)
    r = remote.post("/arx" + URL, json={"username": "boss", "display_name": "Boss", "role_id": "site_admin", "password": ADMIN_PW})
    assert r.status_code == 404  # an administrative target is created on the local channel only (unchanged)
    refused = _audits(lx, "identity.local.user.create_refused")
    assert [x["reason"] for x in refused] == ["local_identity_off", "admin_target_remote"]
    assert refused[1]["details"]["channel"] == "remote"
    # a non-administrative user IS created through the remote channel, with a password
    r = remote.post("/arx" + URL, json={"username": "guard", "display_name": "שומר", "role_id": "viewer", "password": ADMIN_PW})
    assert r.status_code == 201, r.text
    assert _audits(lx, "identity.local.password.set_by_admin")[-1]["details"]["channel"] == "remote"


# ---------------------------------------------------------------- set-password on an existing user

def test_admin_sets_the_password_of_an_existing_user(lx):
    lx.enable()
    created, c = lx.ready("maria")
    uid = created["user"]["id"]
    assert c.get("/arx/api/v1/sites").status_code == 200
    open_link = lx.admin.post(f"{URL}/{uid}/link", json={"purpose": "reset"}).json()["link"]["path"].split("t=", 1)[1]

    r = lx.admin.put(f"{URL}/{uid}/password", json={"password": "short"})
    assert r.status_code == 400 and r.json()["code"] == "password_policy"
    assert c.get("/arx/api/v1/sites").status_code == 200  # a refused set changes nothing

    r = lx.admin.put(f"{URL}/{uid}/password", json={"password": ADMIN_PW})
    assert r.status_code == 200, r.text
    assert r.json()["must_change_password"] is True and r.json()["sessions_ended"] == 1
    assert c.get("/arx/api/v1/me").status_code == 401                      # every session of the user ended
    assert lx.set_password(open_link, GOOD2).status_code == 401            # an open link died with the old password
    c2 = lx.remote()
    assert lx.sign_in(c2, "maria", GOOD).status_code == 401                # the old password is gone
    r = lx.sign_in(c2, "maria", ADMIN_PW)
    assert r.status_code == 200 and r.json()["must_change_password"] is True
    assert c2.get("/arx/api/v1/sites").json()["code"] == "password_change_required"

    r = lx.admin.put(f"{URL}/{uid}/password", json={"password": GOOD2, "must_change": False})
    assert r.status_code == 200 and r.json()["must_change_password"] is False
    c3 = lx.remote()
    assert lx.sign_in(c3, "maria", GOOD2).json()["must_change_password"] is False

    rows = _audits(lx, "identity.local.password.set_by_admin")
    assert [(x["decision"], x["reason"]) for x in rows] == [("denied", "password_policy"), ("allowed", None), ("allowed", None)]
    assert rows[1]["details"] == {"at": "existing", "must_change": True, "channel": "local", "admin_target": False, "sessions_ended": 1, "links_invalidated": 1}

    # a pending user (no password yet) gets one too: the first-login link is no longer the only way
    pending = lx.create("pending1")["user"]["id"]
    assert lx.admin.put(f"{URL}/{pending}/password", json={"password": ADMIN_PW}).json()["status"] == "active"


def test_set_password_rules_permission_feature_unknown_user_and_admin_targets(lx):
    lx.enable()
    viewer = lx.create("maria")["user"]["id"]
    boss = lx.create("boss", "site_admin")["user"]["id"]
    remote = _remote_admin(lx)
    # an administrative target: local channel only, the refusal is the route that does not exist (and it is audited)
    r = remote.put(f"/arx{URL}/{boss}/password", json={"password": ADMIN_PW})
    assert r.status_code == 404
    assert _audits(lx, "identity.local.password.set_by_admin")[-1]["reason"] == "admin_target_remote"
    assert lx.admin.put(f"{URL}/{boss}/password", json={"password": ADMIN_PW}).status_code == 200
    assert remote.put(f"/arx{URL}/{viewer}/password", json={"password": ADMIN_PW}).status_code == 200
    r = lx.admin.put(f"{URL}/l_01NOPE0000000000000000000/password", json={"password": ADMIN_PW})
    assert r.status_code == 404 and r.json()["code"] == "user_unknown"
    # a disabled user: refused (enable first), the feature off: refused
    lx.admin.patch(f"{URL}/{viewer}", json={"active": False})
    r = lx.admin.put(f"{URL}/{viewer}/password", json={"password": ADMIN_PW})
    assert r.status_code == 409 and r.json()["code"] == "user_disabled"
    lx.enable(False)
    r = lx.admin.put(f"{URL}/{boss}/password", json={"password": ADMIN_PW})
    assert r.status_code == 409 and r.json()["code"] == "local_identity_off"


def test_a_local_identity_without_the_permission_cannot_set_passwords(lx):
    lx.enable()
    _created, c = lx.ready("maria")
    other = lx.create("other")["user"]["id"]
    r = c.put(f"/arx{URL}/{other}/password", json={"password": ADMIN_PW})
    assert r.status_code == 403
    r = c.post("/arx" + URL, json={"username": "sneak", "display_name": "S", "role_id": "viewer", "password": ADMIN_PW})
    assert r.status_code == 403
    assert _audits(lx, "identity.local.password.set_by_admin") == []


def test_the_list_tells_the_form_the_minimum_length(lx):
    lx.enable()
    assert lx.admin.get(URL).json()["password_min"] == 12
    lx.admin.patch("/api/v1/settings", json={"security.local_password_min": 16})
    assert lx.admin.get(URL).json()["password_min"] == 16


# ---------------------------------------------------------------- the secret never leaves

def test_an_admin_set_password_is_never_in_logs_audit_answers_or_the_database(lx, caplog):
    caplog.set_level(logging.DEBUG)
    lx.enable()
    r = _post(lx, password=ADMIN_PW)
    uid = r.json()["user"]["id"]
    answers = [r.text]
    answers.append(_post(lx, username="other", password="refused pw").text)  # a refused one is not echoed either
    answers.append(lx.admin.put(f"{URL}/{uid}/password", json={"password": GOOD2}).text)
    answers.append(lx.admin.put(f"{URL}/{uid}/password", json={"password": "bad"}).text)
    answers.append(lx.admin.get(URL).text)
    audit_text = json.dumps(lx.rows("SELECT actor_username, resource_id, reason, details_json FROM audit_log"), ensure_ascii=False)
    for secret in (ADMIN_PW, GOOD2, "refused pw"):
        assert secret not in audit_text and secret not in caplog.text
        assert all(secret not in a for a in answers)
    assert all("$scrypt$" not in a and "password_hash" not in a for a in answers)
    with sqlite3.connect(lx.settings.db_path) as raw:
        dump = "\n".join(str(x) for x in raw.iterdump())
    assert ADMIN_PW not in dump and GOOD2 not in dump and "refused pw" not in dump
