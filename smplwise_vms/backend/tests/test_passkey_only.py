"""usr2-passkeys-only-mode: the optional per-user "passkeys only" sign-in mode of Arx-only identities (migration 0130, built as provisional 0140).

Fake authenticator only (tests/webauthn_fake.py): no real device. Covered: default off, the owner switch and a working passkey are
required, self and administrator switches, the password refused with the uniform 401 (and never counted towards a lock) while a
passkey signs in, the last usable passkey cannot be removed, the administrator recovery (switch off), the never-a-lock-out gates
(owner switch off, public address changed), the administrative user's recovery-path rule, passkey-first cannot be switched off under
the mode, and the audit trail."""
from __future__ import annotations


from test_local_identity import GOOD, _cookie
from test_local_passkeys import PL, PL_OPTS, _with_passkey, px  # noqa: F401 - px is the fixture
from webauthn_fake import FakeAuthenticator

ONLY = "/arx/api/v1/auth/passkeys/only"
OWN = "/arx/api/v1/auth/passkeys"


def _admin_only(px_, uid, on):
    return px_.admin.put(f"/api/v1/identity/local-users/{uid}/passkey-only", json={"on": on})


def _pk_sign_in(px_, auth):
    c = px_.remote()
    return c, c.post(PL, json={"credential": auth.get(c.post(PL_OPTS).json())})



def test_default_off_for_every_user(px):
    px.configure(first=True)
    uid, c, _auth = _with_passkey(px)
    s = c.get(OWN).json()
    assert s["only_on"] is False and s["only_effective"] is False
    assert px.admin.get(f"/api/v1/identity/local-users/{uid}").json()["passkey_only"] is False
    assert px.rows("SELECT passkey_only FROM auth_local_credentials WHERE user_id = ?", (uid,)) == [{"passkey_only": 0}]
    assert px.sign_in(px.remote(), "maria").status_code == 202  # password + the passkey as second factor: unchanged


def test_needs_the_owner_switch_and_a_working_passkey(px):
    px.configure(first=False)
    uid, c, _auth = _with_passkey(px)
    r = c.put(ONLY, json={"on": True})
    assert r.status_code == 409 and r.json()["code"] == "passkey_first_off"
    assert _admin_only(px, uid, True).json()["code"] == "passkey_first_off"
    px.admin.patch("/api/v1/settings", json={"security.local_passkey_first": "on"})
    _created, c2 = px.ready("boris")  # no passkey at all
    r = c2.put(ONLY, json={"on": True})
    assert r.status_code == 409 and r.json()["code"] == "no_passkey"
    boris = _created["user"]["id"]
    assert _admin_only(px, boris, True).json()["code"] == "no_passkey"
    assert px.rows("SELECT passkey_only FROM auth_local_credentials WHERE passkey_only = 1") == []


def test_self_needs_a_fresh_sign_in(px):
    px.configure(first=True)
    uid, c, _auth = _with_passkey(px)
    px.age_sessions(uid)
    r = c.put(ONLY, json={"on": True})
    assert r.status_code == 403 and r.json()["code"] == "reauth_required"


def test_on_refuses_the_password_uniformly_and_only_a_passkey_signs_in(px):
    px.configure(first=True)
    uid, c, auth = _with_passkey(px)
    r = c.put(ONLY, json={"on": True})
    assert r.status_code == 200 and r.json()["only_on"] is True and r.json()["only_effective"] is True and r.json()["first_on"] is True
    good = px.sign_in(px.remote(), "maria", GOOD)
    assert px.audit("auth.local.sign_in.failed")[-1]["reason"] == "passkey_only"
    bad = px.sign_in(px.remote(), "maria", "not the right password at all")
    assert good.status_code == 401 and bad.status_code == 401
    strip = lambda r_: {k: v for k, v in r_.json().items() if k != "correlation_id"}  # noqa: E731
    assert strip(good) == strip(bad) and "arx_session" not in _cookie(good)
    assert px.audit("auth.local.sign_in.failed")[-1]["reason"] == "password"
    # a correct password is never counted towards a lock
    for _ in range(12):
        assert px.sign_in(px.remote(), "maria", GOOD).status_code == 401
    assert px.rows("SELECT failed_count, delay_until FROM auth_local_credentials WHERE user_id = ?", (uid,)) == [{"failed_count": 1, "delay_until": None}]  # only the one deliberate wrong password counted
    c2, r = _pk_sign_in(px, auth)
    assert r.status_code == 200 and "arx_session=l." in _cookie(r)
    assert c2.get("/arx/api/v1/me").json()["user"]["id"] == uid
    # no other user is affected
    _created, _cb = px.ready("boris")
    assert px.sign_in(px.remote(), "boris").status_code == 200


def test_the_last_usable_passkey_cannot_be_removed_while_the_mode_is_on(px):
    px.configure(first=True)
    uid, c, auth = _with_passkey(px)
    assert c.put(ONLY, json={"on": True}).status_code == 200
    pk = c.get(OWN).json()["credentials"][0]["id"]
    r = c.delete(f"{OWN}/{pk}")
    assert r.status_code == 409 and r.json()["code"] == "passkey_only_last"
    r = px.admin.delete(f"/api/v1/identity/local-users/{uid}/passkeys/{pk}")
    assert r.status_code == 409 and r.json()["code"] == "passkey_only_last"
    assert len(px.rows("SELECT id FROM auth_webauthn_credentials WHERE user_id = ?", (uid,))) == 1
    # a second passkey: one may go, the other then stays
    r = px.register(c, FakeAuthenticator())
    assert r.status_code == 201, r.text
    ids = [x["id"] for x in c.get(OWN).json()["credentials"]]
    assert c.delete(f"{OWN}/{ids[0]}").status_code == 200
    assert c.delete(f"{OWN}/{ids[1]}").json()["code"] == "passkey_only_last"
    # passkey-first cannot be switched off under the mode (self and administrator)
    assert c.put(f"{OWN}/first", json={"on": False}).json()["code"] == "passkey_only_on"
    assert px.admin.patch(f"/api/v1/identity/local-users/{uid}", json={"passkey_first": False}).json()["code"] == "passkey_only_on"


def test_the_administrator_switches_it_on_and_off_and_off_is_the_recovery(px):
    px.configure(first=True)
    uid, c, auth = _with_passkey(px)
    r = _admin_only(px, uid, True)
    assert r.status_code == 200 and r.json()["only_on"] is True
    assert px.admin.get(f"/api/v1/identity/local-users/{uid}").json()["passkey_only"] is True
    assert px.sign_in(px.remote(), "maria").status_code == 401
    # a viewer cannot
    px.admin.get("/api/v1/me", headers={"X-SW-Dev-User": "dana"})
    px.bind("dev-dana", "viewer")
    r = px.admin.put(f"/api/v1/identity/local-users/{uid}/passkey-only", json={"on": False}, headers={"X-SW-Dev-User": "dana"})
    assert r.status_code == 403
    # recovery: the passkey is lost - the administrator switches the mode off, the password works again, then the passkey may go
    r = _admin_only(px, uid, False)
    assert r.status_code == 200 and r.json()["only_on"] is False
    assert px.sign_in(px.remote(), "maria").status_code == 202  # password + the passkey as the second step
    pk = c.get(OWN).json()["credentials"][0]["id"]
    assert px.admin.delete(f"/api/v1/identity/local-users/{uid}/passkeys/{pk}").status_code == 200
    assert px.sign_in(px.remote(), "maria").status_code == 200
    # audit of every change, both trails
    assert [a["reason"] for a in px.audit("auth.local.passkey.only_enabled")] == ["admin"]
    assert [a["reason"] for a in px.audit("auth.local.passkey.only_disabled")] == ["admin"]
    assert len(px.audit("identity.local.user.passkey_only_enabled")) == 1 and len(px.audit("identity.local.user.passkey_only_disabled")) == 1
    assert all(a["resource_id"] == uid for a in px.audit("auth.local.passkey.only_enabled"))
    # switching to the state it already has writes nothing more
    assert _admin_only(px, uid, False).status_code == 200
    assert len(px.audit("auth.local.passkey.only_disabled")) == 1


def test_self_switch_off_is_audited(px):
    px.configure(first=True)
    uid, c, _auth = _with_passkey(px)
    assert c.put(ONLY, json={"on": True}).status_code == 200
    r = c.put(ONLY, json={"on": False})
    assert r.status_code == 200 and r.json()["only_on"] is False
    assert [a["reason"] for a in px.audit("auth.local.passkey.only_disabled")] == ["self"]
    assert px.sign_in(px.remote(), "maria").status_code == 202


def test_never_a_lock_out_when_the_owner_switch_or_the_address_goes(px):
    px.configure(first=True)
    uid, c, auth = _with_passkey(px)
    assert c.put(ONLY, json={"on": True}).status_code == 200
    assert px.sign_in(px.remote(), "maria").status_code == 401
    # the owner switch off: the passkey route is gone, so the password works again (the flag stays)
    assert px.admin.patch("/api/v1/settings", json={"security.local_passkey_first": "off"}).status_code == 200
    assert px.sign_in(px.remote(), "maria").status_code == 202
    assert px.rows("SELECT passkey_only FROM auth_local_credentials WHERE user_id = ?", (uid,)) == [{"passkey_only": 1}]
    assert px.admin.patch("/api/v1/settings", json={"security.local_passkey_first": "on"}).status_code == 200
    assert px.sign_in(px.remote(), "maria").status_code == 401
    # the public address changed: the passkey is not usable any more, so the password works again
    assert px.admin.patch("/api/v1/settings", json={"security.local_public_url": "https://other.example.com"}).status_code == 200
    assert px.sign_in(px.remote(), "maria").status_code == 200


def test_an_administrative_user_needs_another_way_back_in(px):
    px.configure(first=True)
    created = px.create("sitey", "site_admin")
    uid = created["user"]["id"]
    assert px.set_password(px.link_token(created)).status_code == 200
    c = px.remote()
    assert px.sign_in(c, "sitey").status_code == 200
    assert px.register(c, FakeAuthenticator()).status_code == 201
    # the only other administrator (the developer identity) is gone: refused, with the reason in plain text
    with px.db.connection() as conn:
        conn.execute("UPDATE users SET active = 0 WHERE id = 'dev-joni'")
    r = c.put(ONLY, json={"on": True})
    assert r.status_code == 409 and r.json()["code"] == "no_recovery_path" and r.json()["user_message"]
    assert px.audit("auth.local.passkey.only_refused")[-1]["reason"] == "no_recovery_path"
    assert px.rows("SELECT passkey_only FROM auth_local_credentials WHERE user_id = ?", (uid,)) == [{"passkey_only": 0}]
    with px.db.connection() as conn:
        conn.execute("UPDATE users SET active = 1 WHERE id = 'dev-joni'")
    r = c.put(ONLY, json={"on": True})
    assert r.status_code == 200 and r.json()["only_on"] is True


def test_infrastructure_accounts_are_untouched(px):
    px.configure(first=True)
    r = px.admin.put("/api/v1/identity/local-users/dev-joni/passkey-only", json={"on": True})
    assert r.status_code == 404  # not a local identity: it keeps its own sign-in, nothing to switch
    assert px.admin.put(f"/api/v1/identity/local-users/{'l_' + 'x' * 8}/passkey-only", json={"on": True}).status_code == 404
