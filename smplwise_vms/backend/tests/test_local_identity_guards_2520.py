"""SCREENS-FIX-A-2520 (SCR-07, deep screens review): deleting and disabling an Arx-only (local) identity refuse - audited, before any
write, in Hebrew with its English - the actor's own identity, an administrative identity on the remote channel, and the last
administrator. The HA-users routes refused `self_target` / `last_admin` already; these two local routes did not.
Fakes only: no Home Assistant, no device."""
from __future__ import annotations

import pytest

from test_local_identity import Lx, _remote_admin
from smplwise import error_text
from smplwise.auth import current_principal
from smplwise.rbac import Principal
from smplwise.routers import local_identity as router
from smplwise.services import ha_user_auth as hua


@pytest.fixture()
def lx(settings, tmp_path, monkeypatch):
    a = Lx(settings, tmp_path, monkeypatch)
    yield a
    a.app.dependency_overrides.clear()
    hua.reset_for_tests()


def _denied(lx: Lx, action: str) -> list[str]:
    return [a["reason"] for a in lx.audit(action) if a["decision"] == "denied"]


def test_own_identity_is_never_deleted_or_disabled(lx, monkeypatch):
    """Defence in depth: today no role a local identity may hold carries identity.local.manage, so the actor is the target only if a
    binding was written behind the routes' back - the guard refuses it anyway, before any write of the request."""
    lx.enable()
    created = lx.create("maria")
    uid = created["user"]["id"]
    me = Principal(user_id=uid, username="maria", display_name="Maria", source="local", factor_ok=True)
    lx.app.dependency_overrides[current_principal] = lambda: me
    monkeypatch.setattr(router, "_manage", lambda conn, principal: None)  # stands for such a binding
    r = lx.admin.patch(f"/api/v1/identity/local-users/{uid}", json={"active": False, "display_name": "Changed"})
    assert r.status_code == 409 and r.json()["code"] == "self_target", r.text
    assert r.json()["user_message"] == router.SELF_DISABLE_HE
    r = lx.admin.delete(f"/api/v1/identity/local-users/{uid}")
    assert r.status_code == 409 and r.json()["code"] == "self_target", r.text
    assert r.json()["user_message"] == router.SELF_DELETE_HE
    lx.app.dependency_overrides.clear()
    row = lx.rows("SELECT active, deleted_at, display_name FROM users WHERE id = ?", (uid,))[0]
    assert row == {"active": 1, "deleted_at": None, "display_name": "Maria"}  # nothing of either request was written
    assert _denied(lx, "identity.local.user.disabled") == ["self_target"]
    assert _denied(lx, "identity.local.user.deleted") == ["self_target"]
    assert lx.rows("SELECT COUNT(*) AS n FROM bindings WHERE subject_id = ? AND revoked_at IS NULL", (uid,)) == [{"n": 1}]


def test_the_last_administrator_is_kept(lx, monkeypatch):
    """With no active system administrator counted (rbac.admin_count; Arx-only identities are never counted there), the last
    administrative Arx-only identity is neither disabled nor deleted; one of two may go, a plain user always may."""
    lx.enable()
    a = lx.create("sitea", "site_admin")["user"]["id"]
    b = lx.create("siteb", "site_admin")["user"]["id"]
    plain = lx.create("plain")["user"]["id"]
    from smplwise import rbac

    monkeypatch.setattr(rbac, "admin_count", lambda conn: 0)
    assert lx.admin.delete(f"/api/v1/identity/local-users/{a}").status_code == 200  # siteb remains
    r = lx.admin.patch(f"/api/v1/identity/local-users/{b}", json={"active": False})
    assert r.status_code == 409 and r.json()["code"] == "last_admin", r.text
    assert r.json()["user_message"] == router.LAST_ADMIN_DISABLE_HE
    r = lx.admin.delete(f"/api/v1/identity/local-users/{b}")
    assert r.status_code == 409 and r.json()["code"] == "last_admin", r.text
    assert r.json()["user_message"] == router.LAST_ADMIN_DELETE_HE
    assert lx.rows("SELECT active, deleted_at FROM users WHERE id = ?", (b,)) == [{"active": 1, "deleted_at": None}]
    assert _denied(lx, "identity.local.user.disabled") == ["last_admin"]
    assert _denied(lx, "identity.local.user.deleted") == ["last_admin"]
    assert lx.admin.delete(f"/api/v1/identity/local-users/{plain}").status_code == 200  # not an administrator: no guard


def test_the_administrator_check_fails_closed(lx, monkeypatch):
    lx.enable()
    b = lx.create("siteb", "site_admin")["user"]["id"]

    def broken(conn, user_id):
        raise RuntimeError("cannot decide")

    monkeypatch.setattr(router, "_last_admin", broken)
    r = lx.admin.delete(f"/api/v1/identity/local-users/{b}")
    assert r.status_code == 409 and r.json()["code"] == "last_admin"
    assert _denied(lx, "identity.local.user.deleted") == ["admin_check_failed"]
    assert lx.rows("SELECT deleted_at FROM users WHERE id = ?", (b,)) == [{"deleted_at": None}]


def test_an_administrative_identity_is_not_removed_from_the_remote_channel(lx):
    """Owner answer Q3 applied to delete / disable (role, link and password were already local-channel only): the refusal has the
    shape of a route that does not exist there; a plain identity is still managed remotely."""
    lx.enable()
    lx.admin.get("/api/v1/sites")
    aid = lx.create("sitey", "site_admin")["user"]["id"]
    plain = lx.create("plain")["user"]["id"]
    remote_admin = _remote_admin(lx)
    r = remote_admin.patch(f"/arx/api/v1/identity/local-users/{aid}", json={"active": False})
    assert r.status_code == 404 and r.json()["code"] == "not_found"
    r = remote_admin.delete(f"/arx/api/v1/identity/local-users/{aid}")
    assert r.status_code == 404 and r.json()["code"] == "not_found"
    assert lx.rows("SELECT active, deleted_at FROM users WHERE id = ?", (aid,)) == [{"active": 1, "deleted_at": None}]
    assert set(_denied(lx, "identity.local.user.deleted")) == {"local_admin_target_remote"}
    assert remote_admin.patch(f"/arx/api/v1/identity/local-users/{plain}", json={"active": False}).status_code == 200
    assert remote_admin.delete(f"/arx/api/v1/identity/local-users/{plain}").status_code == 200
    # from the local channel the administrative identity can be disabled (an active system administrator remains)
    assert lx.admin.patch(f"/api/v1/identity/local-users/{aid}", json={"active": False}).status_code == 200


def test_the_refusals_have_their_english():
    table = error_text.table()
    for he in (router.SELF_DELETE_HE, router.SELF_DISABLE_HE, router.LAST_ADMIN_DELETE_HE, router.LAST_ADMIN_DISABLE_HE):
        assert table.get(he), he
