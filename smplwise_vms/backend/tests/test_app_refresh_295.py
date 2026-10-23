"""APPREFRESH-295 slice 1 (docs/changes/CR-APPREFRESH295.md): the phone app's persistent sign-in - rotating single-use refresh tokens with
reuse detection that revokes the family, hashed at rest, short-lived access tokens, the binding to the device registration and its
install_id, absolute / idle / administrative expiry, every revocation path, the rate limits, the settings and their channel rule, and
that no token material reaches the database in clear, the audit log or the log. Fakes only: no Home Assistant, no phone."""
from __future__ import annotations

import json
import logging
import types

import pytest
from conftest import as_user
from fastapi.testclient import TestClient
from fake_ha_core import FakeUser
from test_remote_access import ORIGIN, Arx

from smplwise.routers import app_refresh as router_mod
from smplwise.services import app_refresh as svc
from smplwise.services import backup
from smplwise.services import ha_user_auth as hua
from smplwise.services import presence

API = "/api/v1"
ARX = "/arx/api/v1"
INSTALL = "11111111-2222-3333-4444-555555555555"
DAY = 86400.0


class Clock:
    def __init__(self, start: float) -> None:
        self.t = start

    def __call__(self) -> float:
        return self.t

    def advance(self, seconds: float) -> None:
        self.t += seconds


USERS = {"dana": "u-viewer", "joni": "u-owner", "vera": "u-vera"}  # the fake HA directory (test_remote_access.Arx) plus vera


class Rx:
    """A remote-enabled app with a fake HA core (test_remote_access.Arx): each user signs in on the remote channel with their own client
    (the phone's web view: cookie + Origin); `c` is a plain client - the app's own refresh calls (no cookie) on `/arx` and the developer
    administrator (dev-joni, the bootstrap system administrator) on the local channel."""

    def __init__(self, settings, tmp_path, monkeypatch) -> None:
        self.arx = Arx(settings, tmp_path, monkeypatch)
        self.app, self.s, self.db = self.arx.app, self.arx.settings, self.arx.db
        self.c = TestClient(self.app)
        self.c.get(f"{API}/me")  # dev-joni: the bootstrap system administrator (local channel)
        self.arx.core.add_user(FakeUser("u-vera", "vera", "pw-vera", "ורה"))
        with self.db.connection() as conn:
            conn.execute("INSERT INTO ha_users(id, name, username, is_active, is_admin, synced_at) VALUES ('u-vera', 'ורה', 'vera', 1, 0, '2026-10-23T00:00:00Z')")
        for name in ("dana", "vera"):
            self.arx.flag(USERS[name])
            self.arx.bind(USERS[name], "viewer")
        self.arx.bind("u-owner", "system_admin")  # admitted remotely by the administrator default
        self._clients: dict[str, TestClient] = {}
        self.seen: list[str] = []

    def user(self, name: str, fresh: bool = False) -> TestClient:
        """`name`'s signed-in remote client (a fresh HA sign-in when asked, or when there is none yet)."""
        if fresh or name not in self._clients:
            cl = TestClient(self.app, headers=ORIGIN)
            token = self.arx.core.issue(USERS[name])["access_token"]
            r = cl.post(f"{ARX}/auth/session", headers={"Authorization": f"Bearer {token}"})
            assert r.status_code == 200, r.text
            self._clients[name] = cl
        return self._clients[name]

    def bind(self, name: str, role: str) -> None:
        self.arx.bind(USERS[name], role)


@pytest.fixture()
def rx(settings, tmp_path, monkeypatch):
    svc.reset_limits()
    r = Rx(settings, tmp_path, monkeypatch)
    r.clock = Clock(1_900_000_000.0)
    monkeypatch.setattr(svc, "_now", r.clock)
    frozen = presence._now()
    monkeypatch.setattr(presence, "_now", lambda: frozen)  # the limiters never refill mid-test
    yield r
    svc.reset_limits()
    hua.reset_for_tests()


def switch(rx, **values) -> dict:
    r = rx.c.put(f"{API}/auth/app/settings", json=values)
    assert r.status_code == 200, r.text
    return r.json()


def on(rx, **more) -> None:
    switch(rx, **{"security.app_refresh": "on", **more})


def register(rx, user: str = "dana", install_id: str = INSTALL, name: str = "הנייד של דנה") -> dict:
    body = {"name": name, "platform": "ios", "install_id": install_id, "app_version": "1.0.0"}
    r = rx.user(user).post(f"{ARX}/presence/devices", json=body)
    if r.status_code == 401:  # the sign-in was ended by the test (a revoke): sign in again, as the phone would
        r = rx.user(user, fresh=True).post(f"{ARX}/presence/devices", json=body)
    assert r.status_code in (200, 201), r.text
    rx.seen.append(r.json()["device_token"])
    return r.json()


def issue(rx, device_id: str, user: str = "dana", install_id: str = INSTALL):
    body = {"device_id": device_id, "install_id": install_id}
    r = rx.user(user).post(f"{ARX}/auth/app/refresh-tokens", json=body)
    if r.status_code == 401:
        r = rx.user(user, fresh=True).post(f"{ARX}/auth/app/refresh-tokens", json=body)
    if r.status_code == 201:
        rx.seen += [r.json()["refresh_token"], r.json()["access_token"]]
    return r


def refresh(rx, token: str, device_id: str, install_id: str = INSTALL, prefix: str = ARX):
    r = rx.c.post(f"{prefix}/auth/app/refresh", json={"refresh_token": token, "device_id": device_id, "install_id": install_id})
    if r.status_code == 200:
        rx.seen += [r.json()["refresh_token"], r.json()["access_token"]]
    return r


def whoami(rx, access: str):
    return rx.c.get(f"{ARX}/auth/app/whoami", headers={"Authorization": f"Bearer {access}"})

def started(rx, user: str = "dana") -> tuple[dict, dict]:
    on(rx)
    dev = register(rx, user)
    r = issue(rx, dev["device_id"], user)
    assert r.status_code == 201, r.text
    return dev, r.json()


def family_row(rx, family_id: str):
    with rx.db.connection(mode="read") as conn:
        return conn.execute("SELECT * FROM app_refresh_families WHERE family_id = ?", (family_id,)).fetchone()


def audit_rows(rx, action_like: str = "auth.app_refresh.%") -> list[dict]:
    with rx.db.connection(mode="read") as conn:
        return [dict(r) for r in conn.execute("SELECT * FROM audit_log WHERE action LIKE ? ORDER BY id", (action_like,)).fetchall()]


def assert_no_material(rx) -> None:
    """No token this test saw is anywhere in the database in clear (every table, every column), nor in the audit log."""
    assert rx.seen
    with rx.db.connection(mode="read") as conn:
        tables = [r[0] for r in conn.execute("SELECT name FROM sqlite_master WHERE type = 'table'").fetchall()]
        blob = []
        for t in tables:
            for row in conn.execute(f'SELECT * FROM "{t}"').fetchall():
                blob.append(json.dumps([str(v) for v in tuple(row)], ensure_ascii=False))
    text = "\n".join(blob)
    for tok in rx.seen:
        assert tok not in text
    assert "arxr_" not in text and "arxa_" not in text


# ---------------------------------------------------------------- the switch: off by default, absent while off

def test_off_by_default_every_route_answers_as_absent(rx):
    dev = register(rx)
    assert issue(rx, dev["device_id"]).status_code == 404
    good = {"refresh_token": "arxr_" + "a" * 43, "device_id": dev["device_id"], "install_id": INSTALL}
    answers = set()
    for body in (json.dumps(good).encode(), b"{not json", b"[]", b"{}", b'{"unexpected": 1}'):
        r = rx.c.post(f"{ARX}/auth/app/refresh", content=body, headers={"content-type": "application/json"})
        d = r.json()
        d.pop("correlation_id", None)
        answers.add((r.status_code, json.dumps(d, sort_keys=True)))
    assert len(answers) == 1 and next(iter(answers))[0] == 404  # the same 404 whatever the body (guard first)
    assert rx.c.post(f"{ARX}/auth/app/sign-out", content=b"{bad", headers={"content-type": "application/json"}).status_code == 404
    assert whoami(rx, "arxa_" + "a" * 43).status_code == 404
    assert rx.c.get(f"{API}/auth/app/settings").json()["settings"]["security.app_refresh"] == "off"


def test_public_routes_are_absent_on_the_local_channel_even_when_on(rx):
    dev, out = started(rx)
    r = refresh(rx, out["refresh_token"], dev["device_id"], prefix=API)
    assert r.status_code == 404
    assert rx.c.get(f"{API}/auth/app/whoami", headers={"Authorization": f"Bearer {out['access_token']}"}).status_code == 404
    assert refresh(rx, out["refresh_token"], dev["device_id"]).status_code == 200  # the token was not consumed by the 404


# ---------------------------------------------------------------- issue

def test_issue_shows_the_tokens_once_and_keeps_only_hashes(rx):
    dev, out = started(rx)
    assert out["refresh_token"].startswith("arxr_") and len(out["refresh_token"]) == 48
    assert out["access_token"].startswith("arxa_") and out["token_type"] == "Bearer" and out["family_id"].startswith("arf_")
    assert 0 < out["expires_in"] <= 600
    fam = family_row(rx, out["family_id"])
    assert fam["user_id"] == "u-viewer" and fam["device_id"] == dev["device_id"] and fam["install_hash"] == svc.install_hash(INSTALL)
    assert fam["anchor_kind"] == "ha" and len(fam["anchor_hash"]) == 64 and fam["channel"] == "remote" and fam["generation"] == 1 and not fam["admin_capped"]
    assert svc.epoch(fam["absolute_expires_at"]) - rx.clock() == pytest.approx(90 * DAY, abs=2)
    assert svc.epoch(fam["idle_expires_at"]) - rx.clock() == pytest.approx(30 * DAY, abs=2)
    with rx.db.connection(mode="read") as conn:
        assert conn.execute("SELECT state FROM app_refresh_tokens WHERE token_hash = ?", (svc.token_hash(out["refresh_token"]),)).fetchone()["state"] == "live"
        assert conn.execute("SELECT 1 FROM app_access_tokens WHERE token_hash = ?", (svc.token_hash(out["access_token"]),)).fetchone()
    issued = audit_rows(rx, "auth.app_refresh.issued")
    assert len(issued) == 1 and json.loads(issued[0]["details_json"])["family"] == out["family_id"]
    # the family list never carries a token or a hash
    listed = rx.user("dana").get(f"{ARX}/auth/app/families").json()["families"]
    assert [f["family_id"] for f in listed] == [out["family_id"]] and listed[0]["device_name"] == "הנייד של דנה"
    assert "token" not in json.dumps(listed) and fam["install_hash"] not in json.dumps(listed)
    assert_no_material(rx)


def test_issue_refuses_another_users_device_and_a_wrong_install_id(rx):
    on(rx)
    dana = register(rx, "dana")
    assert issue(rx, dana["device_id"], user="vera").status_code == 404
    r = issue(rx, dana["device_id"], install_id="99999999-2222-3333-4444-555555555555")
    assert r.status_code == 409 and r.json()["code"] == "binding_mismatch"
    reasons = [a["reason"] for a in audit_rows(rx, "auth.app_refresh.issue")]
    assert reasons == ["not_own_device", "binding_mismatch"]
    assert issue(rx, "dev_missing00000000").status_code == 404


def test_a_new_family_replaces_the_previous_one_of_the_device(rx):
    dev, first = started(rx)
    second = issue(rx, dev["device_id"]).json()
    assert family_row(rx, first["family_id"])["revoked_reason"] == "replaced"
    assert refresh(rx, first["refresh_token"], dev["device_id"]).status_code == 401
    assert refresh(rx, second["refresh_token"], dev["device_id"]).status_code == 200


# ---------------------------------------------------------------- rotation and reuse

def test_rotation_is_single_use_and_the_access_token_works(rx):
    dev, out = started(rx)
    me = whoami(rx, out["access_token"])
    assert me.status_code == 200 and me.json() == {"user_id": "u-viewer", "device_id": dev["device_id"], "family_id": out["family_id"], "expires_at": me.json()["expires_at"]}
    rx.clock.advance(60)
    r = refresh(rx, out["refresh_token"], dev["device_id"])
    assert r.status_code == 200, r.text
    nxt = r.json()
    assert nxt["refresh_token"] != out["refresh_token"] and nxt["access_token"] != out["access_token"] and nxt["family_id"] == out["family_id"]
    fam = family_row(rx, out["family_id"])
    assert fam["generation"] == 2 and fam["revoked_at"] is None
    assert svc.epoch(fam["idle_expires_at"]) - rx.clock() == pytest.approx(30 * DAY, abs=2)  # the idle window slides
    assert whoami(rx, nxt["access_token"]).status_code == 200
    with rx.db.connection(mode="read") as conn:
        states = {r["generation"]: r["state"] for r in conn.execute("SELECT generation, state FROM app_refresh_tokens WHERE family_id = ?", (out["family_id"],))}
    assert states == {1: "used", 2: "live"}
    # the access token expires by itself
    rx.clock.advance(11 * 60)
    assert whoami(rx, nxt["access_token"]).status_code == 401
    assert_no_material(rx)


def test_reuse_outside_the_grace_revokes_the_whole_family(rx):
    dev, out = started(rx)
    t2 = refresh(rx, out["refresh_token"], dev["device_id"]).json()
    rx.clock.advance(svc.RETRY_GRACE_S + 1)
    r = refresh(rx, out["refresh_token"], dev["device_id"])  # the thief (or the phone) presents the used token again
    assert r.status_code == 401 and r.json()["code"] == "app_refresh_invalid"
    fam = family_row(rx, out["family_id"])
    assert fam["revoked_reason"] == "reuse"
    assert refresh(rx, t2["refresh_token"], dev["device_id"]).status_code == 401  # the live token of the family died with it
    assert whoami(rx, t2["access_token"]).status_code == 401
    reuse = audit_rows(rx, "auth.app_refresh.reuse_detected")
    assert len(reuse) == 1 and reuse[0]["decision"] == "denied" and reuse[0]["resource_id"] == dev["device_id"]
    assert_no_material(rx)


def test_a_lost_answer_may_be_retried_inside_the_grace_and_the_loser_is_caught(rx):
    dev, out = started(rx)  # default grace 20 s
    lost = refresh(rx, out["refresh_token"], dev["device_id"]).json()  # the answer never reached the phone
    rx.clock.advance(5)
    retry = refresh(rx, out["refresh_token"], dev["device_id"])
    assert retry.status_code == 200
    kept = retry.json()
    assert whoami(rx, lost["access_token"]).status_code == 401  # superseded with its child
    # whoever holds the superseded child is caught: the family ends
    r = refresh(rx, lost["refresh_token"], dev["device_id"])
    assert r.status_code == 401 and family_row(rx, out["family_id"])["revoked_reason"] == "reuse"
    assert refresh(rx, kept["refresh_token"], dev["device_id"]).status_code == 401


def test_a_retry_after_the_child_was_used_or_after_the_grace_is_reuse(rx):
    dev, out = started(rx)
    t2 = refresh(rx, out["refresh_token"], dev["device_id"]).json()
    refresh(rx, t2["refresh_token"], dev["device_id"])
    assert refresh(rx, out["refresh_token"], dev["device_id"]).status_code == 401
    assert family_row(rx, out["family_id"])["revoked_reason"] == "reuse"
    # and past the grace with an unused child
    out2 = issue(rx, dev["device_id"]).json()
    refresh(rx, out2["refresh_token"], dev["device_id"])
    rx.clock.advance(21)
    assert refresh(rx, out2["refresh_token"], dev["device_id"]).status_code == 401
    assert family_row(rx, out2["family_id"])["revoked_reason"] == "reuse"


# ---------------------------------------------------------------- binding

def test_a_valid_token_from_another_install_or_device_ends_the_family(rx):
    dev, out = started(rx)
    r = refresh(rx, out["refresh_token"], dev["device_id"], install_id="99999999-2222-3333-4444-555555555555")
    assert r.status_code == 401 and family_row(rx, out["family_id"])["revoked_reason"] == "binding_mismatch"
    assert refresh(rx, out["refresh_token"], dev["device_id"]).status_code == 401  # the right install cannot revive it
    out2 = issue(rx, dev["device_id"]).json()
    other = register(rx, "dana", install_id="22222222-2222-3333-4444-555555555555", name="טאבלט")
    r = refresh(rx, out2["refresh_token"], other["device_id"])
    assert r.status_code == 401 and family_row(rx, out2["family_id"])["revoked_reason"] == "binding_mismatch"
    refused = [a for a in audit_rows(rx, "auth.app_refresh.refused") if a["reason"] == "binding_mismatch"]
    assert len(refused) == 2


# ---------------------------------------------------------------- expiry

def test_idle_and_absolute_expiry(rx):
    dev, out = started(rx)
    rx.clock.advance(31 * DAY)
    r = refresh(rx, out["refresh_token"], dev["device_id"])
    assert r.status_code == 401 and r.json()["code"] == "app_refresh_expired" and family_row(rx, out["family_id"])["revoked_reason"] == "idle"
    switch(rx, **{"security.app_refresh_absolute_days": 2, "security.app_refresh_idle_days": 1})
    tok = issue(rx, dev["device_id"]).json()
    fid = tok["family_id"]
    for _ in range(3):  # used every 20 hours: never idle, but the absolute lifetime of 2 days still ends it
        rx.clock.advance(20 * 3600)
        r = refresh(rx, tok["refresh_token"], dev["device_id"])
        if r.status_code != 200:
            break
        tok = r.json()
    assert r.status_code == 401 and r.json()["code"] == "app_refresh_expired" and family_row(rx, fid)["revoked_reason"] == "expired"


def test_an_administrator_is_capped_also_when_the_permission_comes_later(rx):
    dev, out = started(rx, user="joni")  # the bootstrap system administrator
    fam = family_row(rx, out["family_id"])
    assert fam["admin_capped"] and svc.epoch(fam["idle_expires_at"]) - rx.clock() == pytest.approx(24 * 3600, abs=2)
    rx.clock.advance(25 * 3600)
    assert refresh(rx, out["refresh_token"], dev["device_id"]).json()["code"] == "app_refresh_expired"
    # dana is a viewer when she signs in, then becomes an administrator: her next refresh is capped from then on
    ddev = register(rx, "dana")
    dout = issue(rx, ddev["device_id"]).json()
    rx.bind("dana", "system_admin")
    rx.clock.advance(25 * 3600)
    assert refresh(rx, dout["refresh_token"], ddev["device_id"]).json()["code"] == "app_refresh_expired"


# ---------------------------------------------------------------- revocation paths

def _dead(rx, dev, out, reason: str) -> None:
    assert refresh(rx, out["refresh_token"], dev["device_id"]).status_code == 401
    assert whoami(rx, out["access_token"]).status_code == 401
    assert family_row(rx, out["family_id"])["revoked_reason"] == reason


def test_device_deleted_or_registered_again_ends_its_family(rx):
    dev, out = started(rx)
    register(rx)  # the same install registers again (a new device token)
    _dead(rx, dev, out, "device_reregistered")
    out2 = issue(rx, dev["device_id"]).json()
    assert rx.user("dana").delete(f"{ARX}/presence/devices/{dev['device_id']}").status_code == 204
    _dead(rx, dev, out2, "device_deleted")


def test_device_tokens_ended_by_a_factor_change_end_the_families(rx):
    dev, out = started(rx)
    with rx.db.connection() as conn:
        presence.revoke_tokens(conn, "u-viewer")
    _dead(rx, dev, out, "device_tokens_ended")


def test_a_disabled_user_cannot_refresh(rx):
    dev, out = started(rx)
    with rx.db.connection() as conn:
        conn.execute("UPDATE users SET active = 0 WHERE id = 'u-viewer'")
    assert whoami(rx, out["access_token"]).status_code == 401
    assert refresh(rx, out["refresh_token"], dev["device_id"]).status_code == 401
    assert family_row(rx, out["family_id"])["revoked_reason"] == "user_inactive"


def test_the_anchor_sign_in_revoked_ends_the_family(rx):
    dev, out = started(rx)
    with rx.db.connection() as conn:
        conn.execute("UPDATE app_refresh_families SET anchor_kind = 'ha', anchor_hash = ? WHERE family_id = ?", ("a" * 64, out["family_id"]))
        conn.execute("INSERT INTO remote_revoked_chains(iss_hash, user_id, revoked_at, revoked_by, reason) VALUES (?, 'u-viewer', '2026-10-23T00:00:00Z', 'x', 'test')", ("a" * 64,))
    _dead(rx, dev, out, "sign_in_revoked")


def test_the_revocation_hooks_of_the_other_sign_in_paths(rx):
    from smplwise.rbac import Principal
    from smplwise.services import ha_user_auth as hua
    from smplwise.services import local_identity

    dev, out = started(rx)
    with rx.db.connection() as conn:  # an HA user's other sign-ins ended (a factor enrolled, an administrator's revoke)
        hua.revoke_user_sign_ins(conn, "u-viewer", actor=Principal("dev-joni", "joni", "joni", "dev"), reason="second_factor_enabled")
    _dead(rx, dev, out, "second_factor_enabled")
    out = issue(rx, dev["device_id"]).json()
    with rx.db.connection() as conn:  # an Arx-only identity's password change / reset / disable path
        local_identity.revoke_user_sessions(conn, "u-viewer", "password_changed")
    _dead(rx, dev, out, "password_changed")
    out = issue(rx, dev["device_id"]).json()
    with rx.db.connection() as conn:  # one local sign-in revoked: only the families minted from it
        conn.execute("UPDATE app_refresh_families SET anchor_kind = 'local', anchor_hash = ? WHERE family_id = ?", (svc.local_anchor("c" * 32), out["family_id"]))
        local_identity.revoke_chain(conn, "c" * 32, "logout")
    _dead(rx, dev, out, "logout")


def test_sign_out_everywhere_is_the_lost_phone_kill_switch(rx):
    dev, out = started(rx)
    # the existing remote kill switch: an administrator ends every remote sign-in of the user - the phone's family goes with it
    r = rx.c.delete(f"{API}/auth/sessions", params={"user_id": "u-viewer"})
    assert r.status_code == 200, r.text
    _dead(rx, dev, out, "revoked_all_by_admin")
    # and the app-family routes: the owner ends one, a non-administrator cannot end another user's, an administrator ends them all
    out = issue(rx, dev["device_id"]).json()
    assert rx.user("vera").delete(f"{ARX}/auth/app/families/{out['family_id']}").status_code == 403
    assert rx.user("vera").delete(f"{ARX}/auth/app/families", params={"user_id": "u-viewer"}).status_code == 403
    assert rx.user("dana").delete(f"{ARX}/auth/app/families/{out['family_id']}").status_code == 204
    _dead(rx, dev, out, "revoked_by_user")
    out = issue(rx, dev["device_id"]).json()
    r = rx.c.delete(f"{API}/auth/app/families", params={"user_id": "u-viewer"})
    assert r.json() == {"families_ended": 1}
    _dead(rx, dev, out, "revoked_all_by_admin")
    revoked = audit_rows(rx, "auth.app_refresh.revoked")
    assert revoked and all(a["decision"] == "allowed" for a in revoked)
    assert_no_material(rx)


def test_the_app_signs_itself_out(rx):
    dev, out = started(rx)
    r = rx.c.post(f"{ARX}/auth/app/sign-out", json={"refresh_token": out["refresh_token"]})
    assert r.status_code == 204
    _dead(rx, dev, out, "app_sign_out")
    assert rx.c.post(f"{ARX}/auth/app/sign-out", json={"refresh_token": "arxr_" + "z" * 43}).status_code == 204  # unknown: the same answer


def test_switching_off_ends_every_family_and_on_again_revives_none(rx):
    dev, out = started(rx)
    body = switch(rx, **{"security.app_refresh": "off"})
    assert body["families_ended"] == 1
    on(rx)
    _dead(rx, dev, out, "feature_off")
    assert [a["action"] for a in audit_rows(rx, "auth.app_refresh.feature_%")] == ["auth.app_refresh.feature_enabled", "auth.app_refresh.feature_disabled", "auth.app_refresh.feature_enabled"]


# ---------------------------------------------------------------- rate limits

def test_unknown_tokens_are_rate_limited_per_client(rx):
    dev, out = started(rx)
    for i in range(svc.FAILURES_PER_MIN):
        r = refresh(rx, "arxr_" + f"{i:043d}", dev["device_id"])
        assert r.status_code == 401
    r = refresh(rx, out["refresh_token"], dev["device_id"])
    assert r.status_code == 429 and r.json()["details"]["retry_after_s"] == 60
    assert whoami(rx, out["access_token"]).status_code == 429
    svc.reset_limits()
    assert refresh(rx, out["refresh_token"], dev["device_id"]).status_code == 200


def test_refreshes_are_rate_limited_per_family_and_issues_per_user(rx):
    dev, out = started(rx)
    tok = out
    for _ in range(svc.RATE_REFRESH[0]):
        r = refresh(rx, tok["refresh_token"], dev["device_id"])
        assert r.status_code == 200
        tok = r.json()
    r = refresh(rx, tok["refresh_token"], dev["device_id"])
    assert r.status_code == 429
    assert family_row(rx, out["family_id"])["revoked_at"] is None  # a throttled refresh consumed nothing
    svc.reset_limits()
    for _ in range(svc.RATE_ISSUE[0]):
        assert issue(rx, dev["device_id"]).status_code == 201
    assert issue(rx, dev["device_id"]).status_code == 429


# ---------------------------------------------------------------- settings

def test_settings_need_a_system_administrator_and_valid_values(rx):
    assert rx.c.get(f"{API}/auth/app/settings", headers=as_user("dana")).status_code == 403
    assert rx.c.put(f"{API}/auth/app/settings", json={"security.app_refresh": "on"}, headers=as_user("dana")).status_code == 403
    for bad in ({"security.app_refresh": "yes"}, {"security.app_refresh_idle_days": 0}, {"security.app_refresh_admin_absolute_days": 8},
                {"security.app_refresh_retry_grace_s": 0}, {"security.app_refresh_access_minutes": True}, {"other": 1}):
        assert rx.c.put(f"{API}/auth/app/settings", json=bad).status_code == 422, bad
    st = switch(rx, **{"security.app_refresh_idle_days": 14})["settings"]
    assert st["security.app_refresh_idle_days"] == 14 and st["security.app_refresh"] == "off"
    denied = [a for a in audit_rows(rx, "auth.app_refresh.settings") if a["decision"] == "denied"]
    assert len(denied) == 2


def test_lifetime_settings_defaults_bounds_and_idle_never_above_absolute(rx):
    st = rx.c.get(f"{API}/auth/app/settings").json()["settings"]
    assert (st[svc.ABSOLUTE_KEY], st[svc.IDLE_KEY], st[svc.ACCESS_KEY]) == (90, 30, 10)
    assert "security.app_refresh_retry_grace_s" not in st and svc.RETRY_GRACE_S == 20  # a constant, not a setting
    for key, lo, hi in ((svc.ABSOLUTE_KEY, 1, 365), (svc.IDLE_KEY, 1, 90), (svc.ACCESS_KEY, 1, 60)):
        for bad in (lo - 1, hi + 1, "10", 1.5, None):
            assert rx.c.put(f"{API}/auth/app/settings", json={key: bad}).status_code == 422, (key, bad)
    switch(rx, **{svc.ACCESS_KEY: 1})
    switch(rx, **{svc.ACCESS_KEY: 60})
    # idle never above absolute: in one write, and against the stored absolute
    r = rx.c.put(f"{API}/auth/app/settings", json={svc.ABSOLUTE_KEY: 10, svc.IDLE_KEY: 11})
    assert r.status_code == 422 and r.json()["details"]["field"] == svc.IDLE_KEY
    switch(rx, **{svc.ABSOLUTE_KEY: 10, svc.IDLE_KEY: 10})
    assert rx.c.put(f"{API}/auth/app/settings", json={svc.IDLE_KEY: 11}).status_code == 422
    assert rx.c.put(f"{API}/auth/app/settings", json={svc.ABSOLUTE_KEY: 9}).status_code == 422  # would put idle (10) above it
    st = switch(rx, **{svc.ABSOLUTE_KEY: 365, svc.IDLE_KEY: 90})["settings"]
    assert (st[svc.ABSOLUTE_KEY], st[svc.IDLE_KEY]) == (365, 90)
    with rx.db.connection() as conn:  # a hand-edited row above the absolute is clamped on read
        conn.execute("UPDATE settings SET value = '5' WHERE key = ?", (svc.ABSOLUTE_KEY,))
    assert rx.c.get(f"{API}/auth/app/settings").json()["settings"][svc.IDLE_KEY] == 5
    assert {svc.ABSOLUTE_KEY, svc.IDLE_KEY, svc.ACCESS_KEY} <= backup.SETTINGS_KEEP


def test_changed_lifetimes_apply_to_new_tokens_and_existing_families_are_re_evaluated(rx):
    dev, old = started(rx)  # issued with 90 / 30 / 10
    switch(rx, **{svc.ABSOLUTE_KEY: 20, svc.IDLE_KEY: 5, svc.ACCESS_KEY: 2})
    other = register(rx, "vera", install_id="33333333-2222-3333-4444-555555555555", name="הנייד של ורה")
    new = issue(rx, other["device_id"], user="vera").json()
    assert new["expires_in"] == 120
    fam = family_row(rx, new["family_id"])
    assert svc.epoch(fam["absolute_expires_at"]) - rx.clock() == pytest.approx(20 * DAY, abs=2)
    assert svc.epoch(fam["idle_expires_at"]) - rx.clock() == pytest.approx(5 * DAY, abs=2)
    # the family issued before the change: a shortened idle lifetime applies at once (re-evaluated at refresh)
    rx.clock.advance(6 * DAY)
    r = refresh(rx, old["refresh_token"], dev["device_id"])
    assert r.status_code == 401 and r.json()["code"] == "app_refresh_expired" and family_row(rx, old["family_id"])["revoked_reason"] == "idle"
    # a lengthened absolute lifetime never extends what a family was issued with
    out = issue(rx, dev["device_id"]).json()  # issued under 20 days absolute
    switch(rx, **{svc.ABSOLUTE_KEY: 365, svc.IDLE_KEY: 90})
    for _ in range(5):  # used every 4.5 days: never idle; dies at its issued 20 days
        rx.clock.advance(4.5 * DAY)
        r = refresh(rx, out["refresh_token"], dev["device_id"])
        if r.status_code != 200:
            break
        out = r.json()
        assert svc.epoch(out["absolute_expires_at"]) <= svc.epoch(family_row(rx, out["family_id"])["created_at"]) + 20 * DAY
    assert r.status_code == 401 and r.json()["code"] == "app_refresh_expired"
    # a lowered absolute lifetime ends an existing family at its next refresh
    out = issue(rx, dev["device_id"]).json()
    rx.clock.advance(3 * DAY)
    switch(rx, **{svc.ABSOLUTE_KEY: 2, svc.IDLE_KEY: 2})
    r = refresh(rx, out["refresh_token"], dev["device_id"])
    assert r.status_code == 401 and family_row(rx, out["family_id"])["revoked_reason"] == "expired"


def test_backup_never_carries_the_tables_or_the_switch():
    assert {"app_refresh_families", "app_refresh_tokens", "app_access_tokens"} <= backup.NEVER_EXPORTED_TABLES
    assert set(svc.SETTING_KEYS) <= backup.SETTINGS_KEEP


# ---------------------------------------------------------------- the freshness rule and the anchor (units)

def test_anchor_of_the_minting_session():
    import time

    from smplwise.rbac import Principal

    def req(state):
        return types.SimpleNamespace(scope={"state": state})

    now = time.time()
    ha = types.SimpleNamespace(iss_hash="b" * 64, chain_started=now - 60, created_at=now - 60)
    kind, anchor, age = router_mod._anchor(req({"sw_remote_session": ha}), router_mod.Caller(Principal("u", "u", "u", "remote")))
    assert (kind, anchor) == ("ha", "b" * 64) and 55 < age < 120
    loc = types.SimpleNamespace(chain_id="c" * 32, chain_started_at=now - 3600)
    kind, anchor, age = router_mod._anchor(req({"sw_remote_session": loc}), router_mod.Caller(Principal("l_x", "x", "x", "local")))
    assert kind == "local" and anchor == svc.local_anchor("c" * 32) and anchor != "c" * 32 and age > svc.FRESH_SIGN_IN_S
    assert router_mod._anchor(req({}), router_mod.Caller(Principal("u", "u", "u", "remote")))[0] == "none"
    assert router_mod._anchor(req({}), router_mod.Caller(Principal("dev-x", "x", "x", "dev")))[:2] == ("dev", "")


# ---------------------------------------------------------------- retention and the log

def test_janitor_ends_expired_families_and_drops_old_ended_ones(rx):
    dev, out = started(rx)
    rx.clock.advance(31 * DAY)
    assert svc.janitor(rx.db)["expired"] == 1 and family_row(rx, out["family_id"])["revoked_reason"] == "expired"
    rx.clock.advance(svc.KEEP_ENDED_DAYS * DAY + 60)
    assert svc.janitor(rx.db)["deleted"] == 1 and family_row(rx, out["family_id"]) is None
    with rx.db.connection(mode="read") as conn:
        assert conn.execute("SELECT COUNT(*) FROM app_refresh_tokens").fetchone()[0] == 0
        assert conn.execute("SELECT COUNT(*) FROM app_access_tokens").fetchone()[0] == 0


def test_no_token_reaches_the_log(rx, caplog):
    caplog.set_level(logging.DEBUG)
    dev, out = started(rx)
    t2 = refresh(rx, out["refresh_token"], dev["device_id"]).json()
    refresh(rx, out["refresh_token"], dev["device_id"], install_id="99999999-2222-3333-4444-555555555555")
    whoami(rx, t2["access_token"])
    text = caplog.text
    for tok in rx.seen:
        assert tok not in text
    assert_no_material(rx)


# ---------------------------------------------------------------- security review 2026-10-23 (F-01 .. F-07)

def test_f01_removing_the_remote_access_flag_ends_the_families(rx):
    dev, out = started(rx)
    r = rx.c.put(f"{API}/access/users/u-viewer/remote-access", json={"enabled": False})
    assert r.status_code == 200, r.text
    _dead(rx, dev, out, "remote_access_removed")


def test_f01_the_remote_policy_is_re_evaluated_at_every_refresh_and_access_use(rx):
    dev, out = started(rx)
    dev2 = register(rx, "dana", install_id="44444444-2222-3333-4444-555555555555", name="טלפון שני")
    with rx.db.connection() as conn:  # the policy changes without any hook (a raw row, a policy switch, a restore)
        conn.execute("DELETE FROM remote_access_users WHERE user_id = 'u-viewer'")
    assert whoami(rx, out["access_token"]).status_code == 401
    r = refresh(rx, out["refresh_token"], dev["device_id"])
    assert r.status_code == 401 and family_row(rx, out["family_id"])["revoked_reason"] == "remote_not_allowed"
    # and minting is refused (audited) while the policy does not admit the user - dana's session is still live in memory
    r = rx.user("dana").post(f"{ARX}/auth/app/refresh-tokens", json={"device_id": dev2["device_id"], "install_id": "44444444-2222-3333-4444-555555555555"})
    assert r.status_code == 403 and r.json()["code"] == "remote_not_allowed"
    assert [a["reason"] for a in audit_rows(rx, "auth.app_refresh.issue")][-1] == "remote_not_allowed"


def test_f01_a_wall_user_never_refreshes(rx):
    dev, out = started(rx)
    with rx.db.connection() as conn:  # dana becomes a wall user whose profile does not travel (CR-030)
        conn.execute("INSERT INTO wall_profiles(user_id, title, enabled, remote_allowed, config_json, created_at, created_by) "
                     "VALUES ('u-viewer', 'קיר', 1, 0, '{}', '2026-10-23T00:00:00Z', 'test')")
    r = refresh(rx, out["refresh_token"], dev["device_id"])
    assert r.status_code == 401 and family_row(rx, out["family_id"])["revoked_reason"] == "wall_user_remote_not_allowed"


def test_f02_the_local_channel_never_mints(rx):
    on(rx)
    dev = register(rx)
    r = rx.c.post(f"{API}/auth/app/refresh-tokens", json={"device_id": dev["device_id"], "install_id": INSTALL}, headers=as_user("dana"))
    assert r.status_code == 404
    with rx.db.connection(mode="read") as conn:
        assert conn.execute("SELECT COUNT(*) FROM app_refresh_families").fetchone()[0] == 0
    assert issue(rx, dev["device_id"]).status_code == 201  # the remote channel does


def test_f02_a_stale_remote_sign_in_never_mints(rx, monkeypatch):
    on(rx)
    dev = register(rx)
    monkeypatch.setattr(svc, "FRESH_SIGN_IN_S", -1)  # every sign-in is now older than the rule allows
    r = rx.user("dana").post(f"{ARX}/auth/app/refresh-tokens", json={"device_id": dev["device_id"], "install_id": INSTALL})
    assert r.status_code == 403 and r.json()["code"] == "fresh_sign_in_required"
    assert [a["reason"] for a in audit_rows(rx, "auth.app_refresh.issue")] == ["sign_in_not_fresh"]


def test_f03_only_the_current_token_signs_out_an_old_one_is_reuse(rx):
    dev, out = started(rx)
    t2 = refresh(rx, out["refresh_token"], dev["device_id"]).json()
    rx.clock.advance(svc.RETRY_GRACE_S + 1)
    assert rx.c.post(f"{ARX}/auth/app/sign-out", json={"refresh_token": out["refresh_token"]}).status_code == 204
    assert family_row(rx, out["family_id"])["revoked_reason"] == "reuse"
    assert len(audit_rows(rx, "auth.app_refresh.reuse_detected")) == 1
    assert refresh(rx, t2["refresh_token"], dev["device_id"]).status_code == 401
    # inside the grace, the parent of a still-unused child is the current token (the phone that lost the answer): a real sign-out
    out = issue(rx, dev["device_id"]).json()
    refresh(rx, out["refresh_token"], dev["device_id"])
    assert rx.c.post(f"{ARX}/auth/app/sign-out", json={"refresh_token": out["refresh_token"]}).status_code == 204
    assert family_row(rx, out["family_id"])["revoked_reason"] == "app_sign_out"


def test_f04_a_mint_refused_for_an_inactive_user_is_audited(rx):
    on(rx)
    dev = register(rx)
    with rx.db.connection() as conn:
        conn.execute("UPDATE users SET active = 0 WHERE id = 'u-viewer'")
        refusal = svc._refusal(conn, "u-viewer")
        with pytest.raises(svc.Refused):
            svc.issue(conn, svc.system_principal("u-viewer"), dev["device_id"], INSTALL, anchor_kind="ha", anchor_hash="", channel="remote", request_id=None)
    assert refusal == "user_inactive"
    assert [a["reason"] for a in audit_rows(rx, "auth.app_refresh.issue")] == ["user_inactive"]


def test_f07_a_garbage_storm_never_locks_out_the_phones_of_live_families(rx, monkeypatch):
    dev, out = started(rx)
    monkeypatch.setattr(svc, "FAILURES_ALL", presence._Failures(3))  # the global tier, small for the test
    for i in range(3):
        assert refresh(rx, "arxr_" + f"{i:043d}", dev["device_id"]).status_code == 401
    assert refresh(rx, "arxr_" + "9" * 43, dev["device_id"]).status_code == 429  # unknown tokens: the global tier holds
    r = refresh(rx, out["refresh_token"], dev["device_id"])  # a live family's token: never stopped by it
    assert r.status_code == 200
    assert whoami(rx, r.json()["access_token"]).status_code == 200
    assert whoami(rx, "arxa_" + "9" * 43).status_code == 429
