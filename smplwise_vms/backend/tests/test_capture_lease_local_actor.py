"""integ/264 risk 8 (CR-WISKEY-LEASE-REVOCATION-EVENT x CR-USR2): a capture lease held by an Arx-only (local, USR2) actor is revoked
by every USR2 path that ends or narrows that actor's authority - strict (owner decision 2026-10-16): the change revokes at once, no
re-check. Negative first: each test issues a local actor's lease, fires the REAL site (service function or HTTP route) and checks the
revoke's scope / reason on the fake host and ledger; before the wiring every one of these left the lease `active`. Then the issue
gate: a local principal gets a lease only while its account and a session chain are live (the window between authentication and
the gate's mark), and only principal sources whose triggers are wired reach the signer. Fakes only - no HA, bridge, WisKey, reader."""
from __future__ import annotations

import time
import types

import pytest

from lease_fixtures import lease_world  # noqa: F401  (fixture)
from test_local_identity import GOOD, Lx
from test_local_passkeys import Px
from webauthn_fake import FakeAuthenticator

from smplwise.db import now_iso, set_setting
from smplwise.errors import ApiError
from smplwise.services import capture_lease as cl
from smplwise.services import ha_user_auth as hua
from smplwise.services import local_identity as li
from smplwise.services import local_passkeys as lpk

LA = "l_01JLOCALACTORA000000000000"
LB = "l_01JLOCALACTORB000000000000"


def _local(w, uid: str, *, chains: int = 1, active: int = 1, deleted: bool = False, switch: str = "on") -> list[str]:
    """A local user written straight into the database (no hashing, no HTTP) with `chains` live session chains. Returns the cookies."""
    cookies = []
    now = time.time()
    with w.db.connection(label="test.local") as conn:
        set_setting(conn, li.FEATURE_KEY, switch)
        conn.execute("""INSERT INTO users(id, username, display_name, source, active, first_seen_at, last_seen_at, deleted_at)
                        VALUES (?, ?, ?, 'local', ?, ?, ?, ?)""", (uid, uid.lower()[-8:], uid, active, now_iso(), now_iso(), now_iso() if deleted else None))
        conn.execute("INSERT INTO auth_local_credentials(user_id, updated_at) VALUES (?, ?)", (uid, now_iso()))
        for n in range(chains):
            cookie = f"{li.COOKIE_PREFIX}test-{uid}-{n}"
            cookies.append(cookie)
            conn.execute("""INSERT INTO auth_local_sessions(sid_hash, user_id, kind, created_at, chain_started_at, last_used_at, expires_at, idle_expires_at, chain_id)
                            VALUES (?, ?, 'browser', ?, ?, ?, ?, ?, ?)""",
                         (li.sid_hash_of(cookie), uid, li.iso(now), li.iso(now), li.iso(now), li.iso(now + 3600), li.iso(now + 1800), f"chain-{uid}-{n}"))
    li.flag_changed()
    return cookies


def _issue_local(w, uid: str, station: str = "entry-a", person: str = "u1") -> cl.Lease:
    return w.issue(actor=uid, station=station, person=person, source="local")


def _revokes(w) -> list[tuple[str, str]]:
    return [(e["params"]["scope"], e["params"]["reason"]) for e in w.events("lease_revoke")]


def _admin(uid: str = "dev-joni"):
    return li._internal(uid)  # noqa: SLF001 - an administrator principal for the audit row


# ---------------------------------------------------------------- the issue gate (fail closed)

@pytest.mark.parametrize("case", ["no_session", "revoked_session", "expired_session", "disabled", "deleted", "switch_off", "local_source_ha_id", "ha_source_local_id"])
def test_a_local_actor_without_live_authority_never_gets_a_lease(lease_world, case):
    w = lease_world
    uid = LA
    source = "local"
    if case == "no_session":
        _local(w, uid, chains=0)
    elif case == "revoked_session":
        _local(w, uid)
        with w.db.connection() as conn:
            conn.execute("UPDATE auth_local_sessions SET revoked_at = ?, revoked_reason = 'admin' WHERE user_id = ?", (now_iso(), uid))
    elif case == "expired_session":
        _local(w, uid)
        with w.db.connection() as conn:
            conn.execute("UPDATE auth_local_sessions SET idle_expires_at = ? WHERE user_id = ?", (li.iso(time.time() - 5), uid))
    elif case == "disabled":
        _local(w, uid, active=0)
    elif case == "deleted":
        _local(w, uid, deleted=True)
    elif case == "switch_off":
        _local(w, uid, switch="off")
    elif case == "local_source_ha_id":
        uid = "dev-sam"  # a `local` principal must carry a local id
    else:
        _local(w, uid)
        source = "ingress"  # a local id under another source: refused (its triggers are the local ones)
    with pytest.raises(ApiError) as e:
        w.issue(actor=uid, source=source, activate=False)
    assert e.value.status == 403 and e.value.details.get("outcome") == "not_sent"
    assert not w.rows() and not cl.live_refs()


@pytest.mark.parametrize("source", ["internal", "background", "system", "push", ""])
def test_only_principal_sources_with_wired_triggers_reach_the_signer(lease_world, source):
    w = lease_world
    with pytest.raises(ApiError) as e:
        w.issue(actor="dev-x", source=source, activate=False)
    assert e.value.status == 403
    assert not w.rows()


def test_a_live_local_actor_gets_a_lease_recorded_as_local(lease_world):
    w = lease_world
    _local(w, LA)
    lease = _issue_local(w, LA)
    assert w.row(lease.lease_ref)["actor_source"] == "local" and cl.usable(lease.lease_ref)


def test_race_a_session_revoked_after_authentication_but_before_the_gate_mark_is_refused(lease_world):
    """The window the epochs cannot see: the revoke moves the actor's epoch BEFORE the gate takes its mark, so the mark is already
    the moved one - only the issue's own liveness read (inside the write transaction) refuses it."""
    w = lease_world
    _local(w, LA)
    with w.db.connection() as conn:
        li.revoke_user_sessions(conn, LA, "admin")  # the request was authenticated a moment before this
    with pytest.raises(ApiError) as e:
        _issue_local(w, LA)  # the mark (snapshot) is taken now, after the move
    assert e.value.status == 403 and not w.rows()


def test_race_a_session_revoked_between_the_gate_mark_and_the_insert_is_stale(lease_world):
    w = lease_world
    _local(w, LA, chains=2)
    snap = cl.REG.snapshot(LA, "entry-a", "u1")  # the gate's mark
    with w.db.connection() as conn:
        li.revoke_chain(conn, f"chain-{LA}-0", "logout")  # one chain ends; another is still live, so only the epoch tells
    with w.db.connection() as conn:
        with pytest.raises(ApiError) as e:
            cl.issue(conn, principal=types.SimpleNamespace(user_id=LA, source="local"), station_id="entry-a", reader_id=0, person_id="u1", person_revision=4,
                     binding_revision=None, decision_revision=cl.permission_revision(conn), start_request_id="r-race", snap=snap)
    assert e.value.status == 409 and e.value.code == "capture_lease_stale"
    assert not w.rows()


# ---------------------------------------------------------------- T4: session ends (service sites)

def test_t4_revoke_user_sessions_revokes_only_that_local_actor(lease_world):
    """Administrator revoke, sign out everywhere, disable / delete (`_end_access`), password reset by link / self-service code."""
    w = lease_world
    _local(w, LA)
    _local(w, LB)
    a = _issue_local(w, LA, station="entry-a")
    b = _issue_local(w, LB, station="entry-b")
    with w.db.connection() as conn:
        li.revoke_user_sessions(conn, LA, "admin")
    w.step(0.25)
    assert _revokes(w) == [("actor", "session_ended")]
    assert w.row(a.lease_ref)["reason"] == "session_ended" and w.row(b.lease_ref)["state"] == "active" and cl.usable(b.lease_ref)


def test_t4_a_password_change_from_the_only_session_still_revokes(lease_world):
    """`change_password` keeps the caller's chain: no other chain is ended (0), and the lease goes all the same (strict)."""
    w = lease_world
    _local(w, LA)
    a = _issue_local(w, LA)
    with w.db.connection() as conn:
        assert li.revoke_user_sessions(conn, LA, "password_changed", keep_chain=f"chain-{LA}-0") == 0
    w.step(0.25)
    assert w.row(a.lease_ref)["reason"] == "session_ended"


def test_t4_logout_of_one_chain_revokes(lease_world):
    w = lease_world
    _local(w, LA, chains=2)
    a = _issue_local(w, LA)
    with w.db.connection() as conn:
        li.revoke_chain(conn, f"chain-{LA}-1", "logout")
    w.step(0.25)
    assert w.row(a.lease_ref)["reason"] == "session_ended"


def test_t4_the_local_switch_off_revokes_every_lease(lease_world):
    w = lease_world
    _local(w, LA)
    a = _issue_local(w, LA, station="entry-a")
    h = w.issue(actor="dev-b", station="entry-b")  # an HA actor too: installation scope is the safe side
    with w.db.connection() as conn:
        li.revoke_all(conn, "feature_off")
    w.step(0.25)
    assert _revokes(w) == [("all", "session_ended")]
    assert w.row(a.lease_ref)["state"] == w.row(h.lease_ref)["state"] == "revoked"


@pytest.mark.parametrize("change", ["expired", "idle", "disabled_behind_the_routes", "deleted_behind_the_routes"])
def test_t4_a_session_found_unusable_on_its_next_use_revokes(lease_world, change):
    w = lease_world
    cookie = _local(w, LA)[0]
    a = _issue_local(w, LA)
    with w.db.connection() as conn:
        if change == "expired":
            conn.execute("UPDATE auth_local_sessions SET expires_at = ? WHERE user_id = ?", (li.iso(time.time() - 1), LA))
        elif change == "idle":
            conn.execute("UPDATE auth_local_sessions SET idle_expires_at = ? WHERE user_id = ?", (li.iso(time.time() - 1), LA))
        elif change == "disabled_behind_the_routes":
            conn.execute("UPDATE users SET active = 0 WHERE id = ?", (LA,))
        else:
            conn.execute("UPDATE users SET deleted_at = ? WHERE id = ?", (now_iso(), LA))
    li.CACHE.clear()
    assert li.resolve(w.db, w.settings, types.SimpleNamespace(headers={}, scope={}), cookie) is None
    w.step(0.25)
    assert w.row(a.lease_ref)["reason"] == "session_ended"


def test_t4_a_still_live_session_on_its_next_use_does_not_revoke(lease_world):
    w = lease_world
    cookie = _local(w, LA)[0]
    a = _issue_local(w, LA)
    li.CACHE.clear()
    li.resolve(w.db, w.settings, types.SimpleNamespace(headers={}, scope={}), cookie, rotate=False)  # a cache fill, nothing ended
    w.step(0.25)
    assert w.row(a.lease_ref)["state"] == "active" and not w.events("lease_revoke")


# ---------------------------------------------------------------- T6: factor changes (service sites)

def _passkey_row(w, uid: str, pk: str = "pk_0123456789abcdef0123") -> str:
    with w.db.connection() as conn:
        conn.execute("""INSERT INTO auth_webauthn_credentials(id, user_id, credential_id, public_key, alg, rp_id, created_at)
                        VALUES (?, ?, ?, 'cHVi', -7, 'arx.example.test', ?)""", (pk, uid, "cred-" + pk, now_iso()))
    return pk


def test_t6_removing_a_passkey_revokes_with_second_factor_changed(lease_world):
    w = lease_world
    _local(w, LA)
    _local(w, LB)
    pk = _passkey_row(w, LA)
    a = _issue_local(w, LA, station="entry-a")
    b = _issue_local(w, LB, station="entry-b")
    with w.db.connection() as conn:
        lpk.remove(conn, LA, pk, actor=_admin(), by="admin", keep_chain=None, request_id=None)
    w.step(0.25)
    assert _revokes(w)[0] == ("actor", "second_factor_changed")
    assert w.row(a.lease_ref)["reason"] == "second_factor_changed" and w.row(b.lease_ref)["state"] == "active"


def test_t6_a_factor_removed_while_another_is_left_still_revokes(lease_world):
    """on_factor_removed (TOTP disable, passkey removal): strict - also when a factor remains (the factor flag itself is kept)."""
    w = lease_world
    _local(w, LA)
    _passkey_row(w, LA)
    a = _issue_local(w, LA)
    with w.db.connection() as conn:
        li.on_factor_removed(conn, LA)
    w.step(0.25)
    assert w.row(a.lease_ref)["reason"] == "second_factor_changed"


def test_t6_an_administrators_factor_reset_revokes(lease_world):
    w = lease_world
    _local(w, LA)
    a = _issue_local(w, LA)
    with w.db.connection() as conn:
        li.on_factor_reset(conn, LA)
    w.step(0.25)
    assert w.row(a.lease_ref)["reason"] == "second_factor_changed"


def test_t6_a_factor_enrolled_revokes_even_from_the_only_session(lease_world):
    w = lease_world
    _local(w, LA)
    a = _issue_local(w, LA)
    with w.db.connection() as conn:
        li.on_factor_enabled(conn, w.settings, types.SimpleNamespace(headers={}, scope={}), types.SimpleNamespace(user_id=LA))
    w.step(0.25)
    assert w.row(a.lease_ref)["reason"] == "second_factor_changed"


@pytest.mark.parametrize("on", [True, False])
def test_t6_the_passkey_first_mode_changed_revokes(lease_world, on):
    w = lease_world
    _local(w, LA)
    a = _issue_local(w, LA)
    with w.db.connection() as conn:
        lpk._set_first(conn, LA, on)  # noqa: SLF001 - the one writer of the mode (self service, last passkey removed)
    w.step(0.25)
    assert w.row(a.lease_ref)["reason"] == "second_factor_changed"


# ---------------------------------------------------------------- the real routes (HTTP, the USR2 test app on the same database)

@pytest.fixture()
def lx_lease(lease_world, settings, tmp_path, monkeypatch):
    a = Lx(settings, tmp_path, monkeypatch)
    a.enable()
    lease_world.step(0.25)  # the bootstrap / settings revisions are behind us before any lease exists
    yield lease_world, a
    hua.reset_for_tests()


def _ready_with_lease(w, lx, username: str = "maria", role: str = "viewer"):
    created, c = lx.ready(username, role)
    uid = created["user"]["id"]
    w.step(0.25)
    lease = _issue_local(w, uid)
    return uid, c, lease


def test_http_administrator_disable_revokes_actor_disabled_first(lx_lease):
    w, lx = lx_lease
    uid, _c, lease = _ready_with_lease(w, lx)
    assert lx.admin.patch(f"/api/v1/identity/local-users/{uid}", json={"active": False}).status_code == 200
    w.step(0.25)
    assert _revokes(w)[0] == ("actor", "actor_disabled") and w.row(lease.lease_ref)["reason"] == "actor_disabled"


def test_http_administrator_delete_revokes_actor_removed_first(lx_lease):
    w, lx = lx_lease
    uid, _c, lease = _ready_with_lease(w, lx)
    assert lx.admin.delete(f"/api/v1/identity/local-users/{uid}").status_code == 200
    w.step(0.25)
    assert _revokes(w)[0] == ("actor", "actor_removed") and w.row(lease.lease_ref)["reason"] == "actor_removed"


def test_http_role_change_is_covered_by_the_existing_t1_t3_hooks(lx_lease):
    """Verified, not assumed: PUT .../role revokes / inserts bindings (bump_permission_revision -> T1, all) and marks the user (T3)."""
    w, lx = lx_lease
    uid, _c, lease = _ready_with_lease(w, lx)
    assert lx.admin.put(f"/api/v1/identity/local-users/{uid}/role", json={"role_id": "operator"}).status_code == 200
    w.step(0.25)
    assert w.row(lease.lease_ref)["state"] == "revoked"
    assert {("all", "permission_revision"), ("actor", "access_changed")} & set(_revokes(w))


def test_http_administrator_revokes_the_users_sessions(lx_lease):
    w, lx = lx_lease
    uid, _c, lease = _ready_with_lease(w, lx)
    assert lx.admin.post(f"/api/v1/identity/local-users/{uid}/sessions/revoke").json()["sessions_ended"] == 1
    w.step(0.25)
    assert _revokes(w) == [("actor", "session_ended")]


@pytest.mark.parametrize("how", ["logout", "sign_out_everywhere"])
def test_http_the_users_own_sign_out_revokes(lx_lease, how):
    w, lx = lx_lease
    _uid, c, lease = _ready_with_lease(w, lx)
    r = c.delete("/arx/api/v1/auth/session") if how == "logout" else c.delete("/arx/api/v1/auth/sessions")
    assert r.status_code in (200, 204), r.text
    w.step(0.25)
    assert w.row(lease.lease_ref)["reason"] == "session_ended"


def test_http_password_change_revokes(lx_lease):
    w, lx = lx_lease
    _uid, c, lease = _ready_with_lease(w, lx)
    r = c.put("/arx/api/v1/auth/local/password", json={"current_password": GOOD, "new_password": "quiet harbour under seven moons"})
    assert r.status_code == 200, r.text
    w.step(0.25)
    assert w.row(lease.lease_ref)["reason"] == "session_ended"


def test_http_the_local_switch_off_revokes(lx_lease):
    w, lx = lx_lease
    _uid, _c, lease = _ready_with_lease(w, lx)
    lx.enable(False)
    w.step(0.25)
    assert w.row(lease.lease_ref)["state"] == "revoked" and ("all", "session_ended") in _revokes(w)


def test_http_a_privilege_change_behind_the_routes_rotates_the_session_and_revokes(lx_lease):
    """A binding written without a revision bump (no T1): the next request rotates the chain for `permissions` - the CR's
    'rotated for a privilege change' T4 case. An age rotation alone is not an end (covered by the HA-side T4 test)."""
    w, lx = lx_lease
    uid, c, lease = _ready_with_lease(w, lx)
    lx.bind(uid, "operator")
    li.CACHE.clear()
    assert c.get("/arx/api/v1/me").status_code == 200
    w.step(0.25)
    assert _revokes(w) == [("actor", "session_ended")] and w.row(lease.lease_ref)["reason"] == "session_ended"


# ---------------------------------------------------------------- passkeys over HTTP

@pytest.fixture()
def px_lease(lease_world, settings, tmp_path, monkeypatch):
    a = Px(settings, tmp_path, monkeypatch)
    lease_world.step(0.25)
    yield lease_world, a
    hua.reset_for_tests()


def test_http_a_second_passkey_registered_revokes(px_lease):
    w, px = px_lease
    px.configure()
    created, c = px.ready("maria")
    uid = created["user"]["id"]
    assert px.register(c, FakeAuthenticator()).status_code == 201  # the first one (an enrolment: T6 + T4)
    w.step(0.25)
    lease = _issue_local(w, uid)
    assert px.register(c, FakeAuthenticator()).status_code == 201  # not an enrolment: only the strict T6 hook in register
    w.step(0.25)
    assert _revokes(w) == [("actor", "second_factor_changed")] and w.row(lease.lease_ref)["reason"] == "second_factor_changed"


def test_http_passkey_first_on_off_and_the_administrators_off_revoke(px_lease):
    w, px = px_lease
    px.configure(first=True)
    created, c = px.ready("maria")
    uid = created["user"]["id"]
    assert px.register(c, FakeAuthenticator()).status_code == 201
    w.step(0.25)
    lease = _issue_local(w, uid)
    assert c.put("/arx/api/v1/auth/passkeys/first", json={"on": True}).status_code == 200
    w.step(0.25)
    assert w.row(lease.lease_ref)["reason"] == "second_factor_changed"
    lease2 = _issue_local(w, uid, station="entry-b")
    r = px.admin.patch(f"/api/v1/identity/local-users/{uid}", json={"passkey_first": False})
    assert r.status_code == 200, r.text
    w.step(0.25)
    assert w.row(lease2.lease_ref)["reason"] == "second_factor_changed"


def test_every_usr2_authority_site_calls_the_lease_hook():
    """A source guard in the style of the T6 / T12 counts: the sites stay wired."""
    from pathlib import Path

    backend = Path(__file__).resolve().parents[1] / "smplwise"
    li_src = (backend / "services" / "local_identity.py").read_text(encoding="utf-8")
    for fn in ("def revoke_user_sessions", "def revoke_chain", "def revoke_all", "def on_factor_enabled", "def on_factor_removed", "def on_factor_reset"):
        body = li_src.split(fn, 1)[1].split("\ndef ", 1)[0]
        assert "lease_hook(" in body, fn
    assert li_src.split("def resolve(", 1)[1].split("\ndef ", 1)[0].count("lease_hook(") == 5
    pk_src = (backend / "services" / "local_passkeys.py").read_text(encoding="utf-8")
    # PASSKEYONLY-295: switching the passkeys-only sign-in mode is a fourth site (it changes the sign-in factor set too)
    assert pk_src.count('li.lease_hook("second_factor_changed"') == 4, "register, _set_first, remove, the passkeys-only switch"
    router = (backend / "routers" / "local_identity.py").read_text(encoding="utf-8")
    assert 'li.lease_hook("actor_disabled"' in router and 'li.lease_hook("actor_removed"' in router and 'li.lease_hook("second_factor_changed"' in router
    assert set(cl.TRIGGER_WIRED_SOURCES) == {"ingress", "remote", "local"}
    for reason in ("session_ended", "second_factor_changed", "actor_disabled", "actor_removed"):
        assert reason in cl.REVOKE_REASONS
