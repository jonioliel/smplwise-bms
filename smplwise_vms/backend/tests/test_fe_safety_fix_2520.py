"""FE-SAFETY-FIX-2520 (deep review 2520 frontend core, finding FC-02): a browser's Web Push subscription no longer survives the end of
the sign-in it was registered through.

- POST push/subscriptions records the remote sign-in of the request as its public id (a hash; never the cookie value), NULL inside
  Home Assistant (Ingress).
- A sign-out (DELETE auth/session), one sign-in revoked from the sessions list, and the other sign-ins ended after a first second factor
  remove the rows of THOSE sign-ins only (another browser of the same user, another user: untouched).
- "Sign out everywhere" (own / an administrator's), removing the remote access, an Arx-only user disabled: every row of the user goes,
  also a row that names no sign-in (written before migration 0226, or through Ingress).
- Local (Arx-only) sign-ins: a sign-out and one sign-in revoked from the list remove that chain's rows.
- Each removal is audited `push.subscriptions.ended` (hosts only, never an endpoint); a sign-out never fails because of it.
Fakes only: no Home Assistant, no push service."""
from __future__ import annotations

import pytest
from fastapi.testclient import TestClient
from test_app_refresh_295 import API, ARX, USERS, Rx
from test_local_identity import Lx
from test_push import Browser

from smplwise.db import new_id, now_iso
from smplwise.services import app_refresh
from smplwise.services import ha_user_auth as hua
from smplwise.services import presence
from smplwise.services import push as svc


@pytest.fixture()
def rx(settings, tmp_path, monkeypatch):
    app_refresh.reset_limits()
    r = Rx(settings, tmp_path, monkeypatch)
    yield r
    app_refresh.reset_limits()
    hua.reset_for_tests()


def _subscribe(cl: TestClient, name: str, base: str = ARX) -> Browser:
    b = Browser(name)
    r = cl.post(f"{base}/push/subscriptions", json={**b.body(), "user_agent": "Mozilla/5.0 (X11; Linux x86_64) test"})
    assert r.status_code == 201, r.text
    return b


def _endpoints(db) -> set[str]:
    with db.connection(mode="read") as conn:
        return {r[0] for r in conn.execute("SELECT endpoint FROM push_subscriptions").fetchall()}


def _legacy_row(db, user_id: str, name: str) -> Browser:
    """A row that names no sign-in: written through Ingress, or before migration 0226."""
    b = Browser(name)
    with db.connection() as conn:
        conn.execute("INSERT INTO push_subscriptions(id, user_id, endpoint, p256dh, auth, user_agent, channel, created_at, last_seen_at)"
                     " VALUES (?,?,?,?,?,?,?,?,?)", (new_id(), user_id, b.endpoint, b.p256dh, "AAAAAAAAAAAAAAAAAAAAAA", None, "ingress", now_iso(), now_iso()))
    return b


def _ended_audit(db) -> list[dict]:
    with db.connection(mode="read") as conn:
        return [dict(r) for r in conn.execute("SELECT actor_user_id, resource_id, reason, details_json FROM audit_log"
                                              " WHERE action = 'push.subscriptions.ended' ORDER BY rowid").fetchall()]


def _sign_in_of(cl: TestClient) -> str:
    """The public id of the client's current sign-in (the sessions list's `current` row)."""
    rows = cl.get(f"{ARX}/auth/sessions").json()["sessions"]
    mine = [s for s in rows if s.get("current")]
    assert len(mine) == 1, rows
    return mine[0]["id"]


# ---------------------------------------------------------------- what a row records

def test_a_row_records_the_sign_in_as_its_public_id_never_the_cookie(rx):
    cl = rx.user("dana")
    b = _subscribe(cl, "dana-laptop")
    with rx.db.connection(mode="read") as conn:
        row = conn.execute("SELECT sign_in, channel FROM push_subscriptions WHERE endpoint = ?", (b.endpoint,)).fetchone()
    assert row["sign_in"] == _sign_in_of(cl)
    cookie = next(v for k, v in cl.cookies.items() if k in (hua.COOKIE_SECURE, hua.COOKIE_PLAIN))
    assert cookie not in row["sign_in"] and len(row["sign_in"]) == 20
    assert svc.sign_in_ref(None) is None and svc.sign_in_ref("") is None


def test_the_api_never_returns_the_sign_in(rx):
    cl = rx.user("dana")
    _subscribe(cl, "dana-laptop")
    rows = cl.get(f"{ARX}/push/subscriptions").json()["subscriptions"]
    assert rows and all("sign_in" not in r for r in rows)


# ---------------------------------------------------------------- one sign-in ends: only its rows

def test_a_sign_out_removes_this_browsers_subscription_and_nothing_else(rx):
    laptop, phone = rx.user("dana"), rx.user("dana", fresh=True)  # two sign-ins of the same user
    a, b = _subscribe(laptop, "dana-laptop"), _subscribe(phone, "dana-phone")
    v = _subscribe(rx.user("vera"), "vera-laptop")
    assert laptop.delete(f"{ARX}/auth/session").status_code == 204
    assert _endpoints(rx.db) == {b.endpoint, v.endpoint}
    rows = _ended_audit(rx.db)
    assert len(rows) == 1 and rows[0]["resource_id"] == USERS["dana"] and rows[0]["reason"] == "logout"
    assert a.endpoint not in rows[0]["details_json"] and "fcm.googleapis.com" in rows[0]["details_json"]


def test_ending_one_sign_in_from_the_list_removes_its_subscription(rx):
    laptop, phone = rx.user("dana"), rx.user("dana", fresh=True)
    _subscribe(laptop, "dana-laptop")
    b = _subscribe(phone, "dana-phone")
    target = _sign_in_of(laptop)
    r = phone.delete(f"{ARX}/auth/sessions/{target}")  # the user ends the laptop's sign-in from the phone
    assert r.status_code == 200, r.text
    assert _endpoints(rx.db) == {b.endpoint}
    assert _ended_audit(rx.db)[-1]["reason"] == "revoked_by_user"


def test_an_administrator_ending_one_sign_in_removes_its_subscription(rx):
    laptop, phone = rx.user("dana"), rx.user("dana", fresh=True)
    a = _subscribe(laptop, "dana-laptop")
    _subscribe(phone, "dana-phone")
    r = rx.c.delete(f"{API}/auth/sessions/{_sign_in_of(phone)}")
    assert r.status_code == 200, r.text
    assert _endpoints(rx.db) == {a.endpoint}
    assert _ended_audit(rx.db)[-1]["reason"] == "revoked_by_admin"


def test_a_row_that_moved_to_a_new_sign_in_ends_with_the_new_one(rx):
    first = rx.user("dana")
    b = _subscribe(first, "dana-laptop")
    second = rx.user("dana", fresh=True)
    r = second.post(f"{ARX}/push/subscriptions", json={**b.body(), "user_agent": "x"})  # the same browser, signed in again: the row follows
    assert r.status_code == 201
    assert first.delete(f"{ARX}/auth/session").status_code == 204
    assert _endpoints(rx.db) == {b.endpoint}  # the old sign-in no longer owns it
    assert second.delete(f"{ARX}/auth/session").status_code == 204
    assert _endpoints(rx.db) == set()


# ---------------------------------------------------------------- every sign-in ends: every row of the user

def test_sign_out_everywhere_removes_every_subscription_of_the_user(rx):
    laptop, phone = rx.user("dana"), rx.user("dana", fresh=True)
    _subscribe(laptop, "dana-laptop")
    _subscribe(phone, "dana-phone")
    _legacy_row(rx.db, USERS["dana"], "dana-ingress")
    v = _subscribe(rx.user("vera"), "vera-laptop")
    assert laptop.delete(f"{ARX}/auth/sessions").status_code == 200
    assert _endpoints(rx.db) == {v.endpoint}
    assert _ended_audit(rx.db)[-1]["reason"] == "signed_out_everywhere"


def test_an_administrator_ending_every_sign_in_removes_every_subscription(rx):
    _subscribe(rx.user("dana"), "dana-laptop")
    _legacy_row(rx.db, USERS["dana"], "dana-ingress")
    v = _subscribe(rx.user("vera"), "vera-laptop")
    r = rx.c.delete(f"{API}/auth/sessions", params={"user_id": USERS["dana"]})
    assert r.status_code == 200, r.text
    assert _endpoints(rx.db) == {v.endpoint}
    assert _ended_audit(rx.db)[-1]["reason"] == "revoked_all_by_admin"


def test_removing_the_remote_access_removes_every_subscription(rx):
    _subscribe(rx.user("dana"), "dana-laptop")
    v = _subscribe(rx.user("vera"), "vera-laptop")
    r = rx.c.put(f"{API}/access/users/{USERS['dana']}/remote-access", json={"enabled": False})
    assert r.status_code == 200, r.text
    assert _endpoints(rx.db) == {v.endpoint}
    assert _ended_audit(rx.db)[-1]["reason"] == "remote_access_removed"


def test_the_other_sign_ins_ended_by_the_service_keep_the_kept_one(rx):
    laptop, phone = rx.user("dana"), rx.user("dana", fresh=True)
    a = _subscribe(laptop, "dana-laptop")
    _subscribe(phone, "dana-phone")
    kept = hua.STORE.get(next(v for k, v in laptop.cookies.items() if k in (hua.COOKIE_SECURE, hua.COOKIE_PLAIN)))
    assert kept is not None
    with rx.db.connection() as conn:  # e.g. a first second factor: every other sign-in ends, the caller's stays
        assert hua.revoke_user_sign_ins(conn, USERS["dana"], actor=kept.principal, reason="second_factor_enrolled", keep=kept) == 1
    assert _endpoints(rx.db) == {a.endpoint}
    assert _ended_audit(rx.db)[-1]["reason"] == "second_factor_enrolled"


# ---------------------------------------------------------------- the helper itself

def test_the_helper_never_raises_and_ignores_empty_input(rx):
    with rx.db.connection() as conn:
        assert svc.end_for_sign_ins(conn, [], "logout") == 0
        assert svc.end_for_sign_ins(conn, [None, ""], "logout") == 0
        assert svc.end_for_user(conn, "", "logout") == 0
        assert presence.end_on_sign_out(conn, USERS["dana"], "logout", sign_ins=("i:unknown",)) == 0  # still counts devices only


def test_a_desktop_sign_out_without_a_sign_in_ends_no_other_browser(rx):
    _subscribe(rx.user("dana"), "dana-laptop")
    with rx.db.connection() as conn:  # the phone-app rule: a desktop user agent, no sign-in named -> nothing ends
        presence.end_on_sign_out(conn, USERS["dana"], "logout", user_agents=("Mozilla/5.0 (X11; Linux x86_64)",))
    assert len(_endpoints(rx.db)) == 1


# ---------------------------------------------------------------- local (Arx-only) sign-ins

@pytest.fixture()
def lx(settings, tmp_path, monkeypatch):
    a = Lx(settings, tmp_path, monkeypatch)
    yield a
    hua.reset_for_tests()


def test_a_local_sign_out_removes_that_browsers_subscription(lx):
    lx.enable()
    _created, c = lx.ready("maria")
    other = lx.remote()
    assert lx.sign_in(other, "maria").status_code == 200  # a second browser of the same local user
    _subscribe(c, "maria-laptop")
    b = _subscribe(other, "maria-tablet")
    assert c.delete(f"{ARX}/auth/session").status_code == 204
    assert _endpoints(lx.db) == {b.endpoint}
    assert _ended_audit(lx.db)[-1]["reason"] == "logout"


def test_a_local_sign_in_ended_from_the_list_removes_its_subscription(lx):
    lx.enable()
    _created, c = lx.ready("maria")
    other = lx.remote()
    assert lx.sign_in(other, "maria").status_code == 200
    a = _subscribe(c, "maria-laptop")
    _subscribe(other, "maria-tablet")
    r = c.delete(f"{ARX}/auth/sessions/{_sign_in_of(other)}")
    assert r.status_code == 200, r.text
    assert _endpoints(lx.db) == {a.endpoint}


def test_disabling_a_local_user_removes_every_subscription(lx):
    lx.enable()
    created, c = lx.ready("maria")
    _subscribe(c, "maria-laptop")
    _legacy_row(lx.db, created["user"]["id"], "maria-old")
    r = lx.admin.patch(f"/api/v1/identity/local-users/{created['user']['id']}", json={"active": False})
    assert r.status_code == 200, r.text
    assert _endpoints(lx.db) == set()
