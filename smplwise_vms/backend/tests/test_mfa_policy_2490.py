"""MFA-POLICY-2490 slice 5 of the second-factor train: the sign-in factor policy (services/factor_policy.py), HA MFA provenance
(services/mfa_provenance.py) and the compliance view (routers/factor_policy.py).

Owner answer for this slice (built to the recommendation): a user without a factor stays ALLOWED until the policy is switched on - the
defaults (`security.factor_policy = optional`, `security.factor_policy_mode = report`) change nothing on upgrade. Owner decision Q48:
`security.remote_long_lived_tokens` stays `allow`.

Covered: the policy matrix (4 policies x overrides incl. `exempt` x wall-panel users x the service identity), report vs enforce, never
weaker than the legacy rules, provenance on fake `auth/refresh_tokens` shapes (normal / long-lived / other client / older than MFA seen /
shape drift ...), the sign-in paths (cookie exchange and bearer) with HA MFA, fail-closed when HA is away, the long-lived-token rule,
`auth_mfa_seen` bookkeeping, the compliance route and the override route (mirrored both ways), settings / restore plumbing and the
migration's seed from the legacy table. Fakes only: no Home Assistant, nothing written to HA."""
from __future__ import annotations

import asyncio
import datetime as dt
import json
import sqlite3
import time
from pathlib import Path

import pytest
from fastapi.testclient import TestClient

from fake_ha_core import make_jwt
from smplwise.db import now_iso
from smplwise.rbac import Principal
from smplwise.services import factor_policy as fp
from smplwise.services import ha_user_auth as hua
from smplwise.services import mfa_provenance as prov
from smplwise.services import second_factor as sf
from test_remote_admins_default import bind_raw
from test_second_factor import arx, enrol, fresh_login  # noqa: F401 - `arx` is the fixture

POLICY = "/api/v1/security/factor-policy"
CLIENT_ID = "http://testserver/arx/"
SEEN = "2026-11-01T10:00:00+00:00"
AFTER = "2026-11-02T10:00:00.250000+00:00"
BEFORE = "2026-10-30T10:00:00+00:00"


def who(user_id: str) -> Principal:
    return Principal(user_id=user_id, username="", display_name="", source="internal")


def set_many(arx, **values: str) -> None:
    for key, value in values.items():
        arx.setting(key.replace("__", "."), value)


def policy_settings(arx, policy: str, mode: str = "enforce") -> None:
    arx.setting(fp.POLICY_KEY, policy)
    arx.setting(fp.MODE_KEY, mode)


def resolve(arx, user_id: str, candidate: str | None = None) -> tuple[str, str]:
    with arx.db.connection(mode="read") as conn:
        r = fp.resolve(conn, who(user_id), candidate)
    return r.sign_in, r.source


def entry(iss: str, **over) -> dict:
    """One `auth/refresh_tokens` item in HA core's shape (auth/__init__.py websocket_refresh_tokens)."""
    base = {"id": iss, "client_id": CLIENT_ID, "client_name": None, "client_icon": None, "type": "normal", "created_at": AFTER,
            "is_current": True, "last_used_at": None, "last_used_ip": None, "auth_provider_type": "homeassistant", "expire_at": None}
    base.update(over)
    return base


@pytest.fixture(autouse=True)
def _fresh_observations():
    prov.reset_for_tests()
    yield
    prov.reset_for_tests()


@pytest.fixture()
def mfa_user(arx):
    """u-mfa (HA reports an enabled MFA module) may use the remote channel with a plain role."""
    arx.flag("u-mfa")
    arx.bind("u-mfa", "viewer")
    return arx.mfa


@pytest.fixture()
def listing(monkeypatch):
    """Replace the HA read with a controlled answer: `state["make"](iss)` builds the listing; `state["calls"]` counts the reads."""
    state: dict = {"make": lambda iss: [entry(iss)], "calls": 0, "error": None}

    async def fake_read(settings, token):
        state["calls"] += 1
        if state["error"] is not None:
            raise state["error"]
        return state["make"](hua.jwt_iss(token))

    monkeypatch.setattr(prov, "read_refresh_tokens", fake_read)
    return state


def seen_row(arx, user_id: str, first_seen: str = SEEN) -> None:
    with arx.db.connection() as conn:
        conn.execute("INSERT OR REPLACE INTO auth_mfa_seen(user_id, first_seen_at, last_seen_at, modules_json) VALUES (?, ?, ?, '[\"totp\"]')",
                     (user_id, first_seen, first_seen))
    prov.reset_for_tests()


def refused(arx, action: str = "auth.remote_session.rejected") -> list[dict]:
    return [{**r, "details": json.loads(r["details_json"] or "{}")} for r in arx.audit(action)]


# ================================================================ provenance verdicts on fake auth/refresh_tokens shapes (pure)

@pytest.mark.parametrize("name,listing_,first_seen,ha_mfa,expected", [
    ("normal sign-in after MFA seen", [entry("R1")], SEEN, True, (True, prov.OK)),
    ("normal, same second as seen", [entry("R1", created_at=SEEN)], SEEN, True, (True, prov.OK)),
    ("long-lived token", [entry("R1", type="long_lived_access_token", client_id=None)], SEEN, True, (False, prov.LONG_LIVED)),
    ("system token", [entry("R1", type="system")], SEEN, True, (False, prov.NOT_NORMAL)),
    ("another client (Companion app)", [entry("R1", client_id="https://home-assistant.io/android")], SEEN, True, (False, prov.OTHER_CLIENT)),
    ("HA's own UI", [entry("R1", client_id="http://testserver/")], SEEN, True, (False, prov.OTHER_CLIENT)),
    ("another auth provider", [entry("R1", auth_provider_type="trusted_networks")], SEEN, True, (False, prov.OTHER_PROVIDER)),
    ("older than MFA seen", [entry("R1", created_at=BEFORE)], SEEN, True, (False, prov.BEFORE_MFA_SEEN)),
    ("MFA never seen", [entry("R1")], None, True, (False, prov.NO_MFA_SEEN)),
    ("HA reports no MFA now", [entry("R1")], SEEN, False, (False, prov.NO_HA_MFA)),
    ("not in the listing", [entry("R2")], SEEN, True, (False, prov.NOT_FOUND)),
    ("empty listing", [], SEEN, True, (False, prov.NOT_FOUND)),
    ("drift: not a list", {"refresh_tokens": [entry("R1")]}, SEEN, True, (False, prov.SHAPE_UNKNOWN)),
    ("drift: items not objects", ["R1"], SEEN, True, (False, prov.SHAPE_UNKNOWN)),
    ("drift: no type", [{k: v for k, v in entry("R1").items() if k != "type"}], SEEN, True, (False, prov.SHAPE_UNKNOWN)),
    ("drift: no provider field", [{k: v for k, v in entry("R1").items() if k != "auth_provider_type"}], SEEN, True, (False, prov.SHAPE_UNKNOWN)),
    ("drift: no created_at", [{k: v for k, v in entry("R1").items() if k != "created_at"}], SEEN, True, (False, prov.SHAPE_UNKNOWN)),
    ("drift: created_at not a date", [entry("R1", created_at="yesterday")], SEEN, True, (False, prov.SHAPE_UNKNOWN)),
    ("drift: created_at without a zone", [entry("R1", created_at="2026-11-02T10:00:00")], SEEN, True, (False, prov.SHAPE_UNKNOWN)),
    ("drift: created_at a number", [entry("R1", created_at=1790000000)], SEEN, True, (False, prov.SHAPE_UNKNOWN)),
    ("drift: the id twice", [entry("R1"), entry("R1")], SEEN, True, (False, prov.SHAPE_UNKNOWN)),
    ("Arx's own Z timestamps", [entry("R1", created_at="2026-11-02T10:00:00Z")], "2026-11-01T10:00:00Z", True, (True, prov.OK)),
])
def test_provenance_verdict_matrix(name, listing_, first_seen, ha_mfa, expected):
    v = prov.evaluate(listing_, iss="R1", client_id=CLIENT_ID, first_seen_at=first_seen, ha_mfa=ha_mfa)
    assert (v.ok, v.reason) == expected, name


def test_provenance_needs_an_iss_and_a_client_id():
    assert prov.evaluate([entry("R1")], iss=None, client_id=CLIENT_ID, first_seen_at=SEEN).reason == prov.NO_ISS
    assert prov.evaluate([entry("R1")], iss="R1", client_id="", first_seen_at=SEEN).reason == prov.OTHER_CLIENT


def test_long_lived_detection_uses_ha_type_then_the_token_lifetime():
    short = make_jwt(time.time() + 1800)
    long_ = make_jwt(time.time() + 10 * 365 * 86400)
    assert fp.is_long_lived(short, "long_lived_access_token") and not fp.is_long_lived(long_, "normal")
    assert fp.is_long_lived(long_, "") and not fp.is_long_lived(short, "")  # the listing silent / changed: the token's own lifetime
    assert prov.token_type_of([entry("R1", type="long_lived_access_token")], "R1") == "long_lived_access_token"
    assert prov.token_type_of([entry("R1"), entry("R1")], "R1") == ""


def test_read_refresh_tokens_is_one_read_only_call_against_the_fake_core(arx):
    tok = arx.core.issue("u-mfa")["access_token"]
    got = asyncio.run(prov.read_refresh_tokens(arx.settings, tok))
    mine = [t for t in got if t["id"] == hua.jwt_iss(tok)]
    assert len(mine) == 1 and mine[0]["type"] == "normal" and mine[0]["client_id"] == CLIENT_ID
    assert arx.core.deleted_refresh == []  # never a write to HA


def test_read_refresh_tokens_with_a_refused_token_is_ha_unavailable(arx):
    with pytest.raises(hua.HaUnavailable):
        asyncio.run(prov.read_refresh_tokens(arx.settings, make_jwt(time.time() + 600)))


# ================================================================ the policy matrix

def test_defaults_change_nothing_on_upgrade(arx):
    local = TestClient(arx.app)
    s = local.get("/api/v1/settings").json()["settings"]
    assert (s["security.factor_policy"], s["security.factor_policy_mode"], s["security.factor_wall_exempt"],
            s["security.remote_long_lived_tokens"]) == ("optional", "report", "on", "allow")
    with arx.db.connection(mode="read") as conn:
        assert not fp.enforced(conn)
        for uid in ("u-owner", "u-viewer", "dev-joni"):
            assert sf.effective_policy(conn, who(uid), hua.ADMIN_PERMISSIONS) == sf.legacy_policy(conn, who(uid), hua.ADMIN_PERMISSIONS)


@pytest.mark.parametrize("policy,owner,viewer,opener", [
    ("optional", "optional", "optional", "optional"),
    ("admins", "required", "optional", "optional"),
    ("sensitive", "required", "optional", "required"),  # the door permission is sensitive, the viewer's reads are not
    ("all", "required", "required", "required"),
])
def test_global_policy_matrix(arx, policy, owner, viewer, opener):
    arx.bind("u-mfa", "door_opener")
    arx.setting(fp.POLICY_KEY, policy)
    assert resolve(arx, "u-owner")[0] == owner
    assert resolve(arx, "u-viewer")[0] == viewer
    assert resolve(arx, "u-mfa")[0] == opener


def test_candidate_previews_another_policy_without_storing_it(arx):
    assert resolve(arx, "u-viewer", "all") == ("required", "global")
    assert resolve(arx, "u-viewer") == ("optional", "global")


def test_override_precedence_user_then_role_required_then_wall_then_role(arx):
    with arx.db.connection() as conn:
        fp.set_override(conn, "role", "viewer", "exempt", "test")
    arx.setting(fp.POLICY_KEY, "all")
    assert resolve(arx, "u-viewer") == ("exempt", "role")
    with arx.db.connection() as conn:
        fp.set_override(conn, "user", "u-viewer", "required", "test")
    assert resolve(arx, "u-viewer") == ("required", "user")
    with arx.db.connection() as conn:
        fp.set_override(conn, "user", "u-viewer", "inherit", "test")
        fp.set_override(conn, "role", "viewer", "required", "test")
        fp.set_override(conn, "role", "system_admin", "optional", "test")
    bind_raw(arx, "u-viewer", "system_admin")
    assert resolve(arx, "u-viewer") == ("required", "role")  # any role `required` wins over another role's `optional`
    assert resolve(arx, "u-owner") == ("optional", "role")


def _wall(arx, user_id: str, enabled: int = 1) -> None:
    with arx.db.connection() as conn:
        conn.execute("INSERT OR REPLACE INTO wall_profiles(user_id, title, enabled, remote_allowed, config_json, created_at, created_by, updated_at, updated_by) "
                     "VALUES (?, 'lobby', ?, 1, '{}', ?, 'test', ?, 'test')", (user_id, enabled, now_iso(), now_iso()))


def test_wall_panel_users_are_exempt_by_default_and_the_switch_turns_it_off(arx):
    arx.setting(fp.POLICY_KEY, "all")
    _wall(arx, "u-viewer")
    assert resolve(arx, "u-viewer") == ("exempt", "wall")
    arx.setting(fp.WALL_KEY, "off")
    assert resolve(arx, "u-viewer") == ("required", "global")
    arx.setting(fp.WALL_KEY, "on")
    _wall(arx, "u-viewer", enabled=0)  # a disabled profile is a plain user again
    assert resolve(arx, "u-viewer") == ("required", "global")


def test_a_role_required_beats_the_wall_exemption_and_a_user_override_beats_both(arx):
    arx.setting(fp.POLICY_KEY, "all")
    _wall(arx, "u-viewer")
    with arx.db.connection() as conn:
        fp.set_override(conn, "role", "viewer", "required", "test")
    assert resolve(arx, "u-viewer") == ("required", "role")
    with arx.db.connection() as conn:
        fp.set_override(conn, "user", "u-viewer", "exempt", "test")
    assert resolve(arx, "u-viewer") == ("exempt", "user")


def test_the_service_identity_is_always_exempt(arx):
    arx.setting(fp.POLICY_KEY, "all")
    arx.setting("identity.service_user_id", "u-viewer")
    with arx.db.connection() as conn:
        fp.set_override(conn, "user", "u-viewer", "required", "test")
    assert resolve(arx, "u-viewer") == ("exempt", "service")


def test_report_mode_never_adds_a_requirement_enforce_does(arx):
    policy_settings(arx, "all", "report")
    with arx.db.connection(mode="read") as conn:
        assert sf.effective_policy(conn, who("u-viewer"), hua.ADMIN_PERMISSIONS) == ("optional", "global")
    arx.setting(fp.MODE_KEY, "enforce")
    with arx.db.connection(mode="read") as conn:
        assert sf.effective_policy(conn, who("u-viewer"), hua.ADMIN_PERMISSIONS) == ("required", "policy")


def test_never_weaker_than_the_legacy_rules(arx):
    arx.setting("security.second_factor_policy", "admins")
    policy_settings(arx, "optional", "enforce")
    with arx.db.connection(mode="read") as conn:
        assert sf.effective_policy(conn, who("u-owner"), hua.ADMIN_PERMISSIONS) == ("required", "global")  # the legacy rule stands
    _wall(arx, "u-owner")  # the wall exemption is this policy's only: the legacy `admins` rule still applies
    with arx.db.connection(mode="read") as conn:
        assert sf.effective_policy(conn, who("u-owner"), hua.ADMIN_PERMISSIONS)[0] == "required"


def test_enforced_policy_applies_to_local_identities_too(arx):
    from smplwise.services import local_identity as li

    policy_settings(arx, "all", "report")
    with arx.db.connection(mode="read") as conn:
        assert not li.factor_policy_required(conn, "l_01HZZZZZZZZZZZZZZZZZZZZZZZ")
    arx.setting(fp.MODE_KEY, "enforce")
    with arx.db.connection(mode="read") as conn:
        assert li.factor_policy_required(conn, "l_01HZZZZZZZZZZZZZZZZZZZZZZZ")


# ================================================================ the remote sign-in (cookie exchange)

def test_report_mode_lets_a_user_without_a_factor_in(arx):
    policy_settings(arx, "all", "report")
    assert fresh_login(arx, arx.viewer).status_code == 200


def test_enforced_policy_refuses_a_user_without_any_factor(arx, listing):
    policy_settings(arx, "all")
    r = fresh_login(arx, arx.viewer)
    assert r.status_code == 403 and r.json()["code"] == "second_factor_enrollment_required" and "set-cookie" not in r.headers
    assert r.json()["details"]["provenance"] == prov.NO_HA_MFA
    assert listing["calls"] == 0  # HA reports no MFA: nothing to read at HA
    row = refused(arx)[-1]
    assert row["reason"] == "second_factor_enrollment_required" and row["details"]["provenance"] == prov.NO_HA_MFA


def test_enforced_policy_accepts_ha_mfa_with_provenance(arx, mfa_user, listing):
    policy_settings(arx, "all")
    seen_row(arx, "u-mfa")
    r = fresh_login(arx, mfa_user)
    assert r.status_code == 200, r.text
    assert listing["calls"] == 1
    created = [json.loads(x["details_json"]) for x in arx.audit("auth.remote_session.created") if x["actor_user_id"] == "u-mfa"][-1]
    assert created["second_factor"] == "ha_mfa" and created["provenance"] == prov.OK


@pytest.mark.parametrize("make,reason", [
    (lambda iss: [entry(iss, created_at=BEFORE)], prov.BEFORE_MFA_SEEN),
    (lambda iss: [entry(iss, client_id="https://home-assistant.io/iOS")], prov.OTHER_CLIENT),
    (lambda iss: [entry(iss, type="long_lived_access_token", client_id=None)], prov.LONG_LIVED),
    (lambda iss: {"unexpected": True}, prov.SHAPE_UNKNOWN),
    (lambda iss: [], prov.NOT_FOUND),
])
def test_enforced_policy_refuses_ha_mfa_without_provenance(arx, mfa_user, listing, make, reason):
    policy_settings(arx, "all")
    seen_row(arx, "u-mfa")
    listing["make"] = make
    r = fresh_login(arx, mfa_user)
    assert r.status_code == 403 and r.json()["code"] == "second_factor_enrollment_required"
    assert r.json()["details"]["provenance"] == reason
    if reason == prov.BEFORE_MFA_SEEN:
        assert r.json()["user_message"] == fp.SIGN_IN_AGAIN_HE  # the next sign-in passes: tell the user to sign in again
    assert refused(arx)[-1]["details"]["provenance"] == reason


def test_ha_away_during_the_provenance_check_fails_closed(arx, mfa_user, listing):
    policy_settings(arx, "all")
    seen_row(arx, "u-mfa")
    listing["error"] = hua.HaUnavailable("down")
    r = fresh_login(arx, mfa_user)
    assert r.status_code == 503 and r.json()["code"] == "ha_unavailable"


def test_an_enrolled_user_still_shows_the_arx_code_and_no_ha_read_is_made(arx, listing):
    enrol(arx, arx.viewer)
    policy_settings(arx, "all")
    r = fresh_login(arx, arx.viewer)
    assert r.status_code == 401 and r.json()["code"] == "second_factor_required"
    assert listing["calls"] == 0


def test_an_exempt_or_uncovered_user_needs_nothing_and_no_ha_read_is_made(arx, listing):
    policy_settings(arx, "admins")
    assert fresh_login(arx, arx.viewer).status_code == 200
    with arx.db.connection() as conn:
        fp.set_override(conn, "user", "u-owner", "exempt", "test")
    assert fresh_login(arx, arx.owner).status_code == 200
    assert listing["calls"] == 0


def test_the_legacy_admins_rule_is_not_satisfied_by_ha_mfa(arx, listing):
    """The legacy rules keep their meaning: `security.second_factor_policy = admins` asks for the Arx factor (no HA read)."""
    arx.setting("security.second_factor_policy", "admins")
    policy_settings(arx, "admins")
    r = fresh_login(arx, arx.owner)
    assert r.status_code == 403 and r.json()["code"] == "second_factor_enrollment_required"
    assert not (r.json().get("details") or {}).get("provenance")
    assert listing["calls"] == 0


# ================================================================ the bearer path

def test_bearer_sign_in_under_the_enforced_policy(arx, mfa_user, listing):
    policy_settings(arx, "all")
    seen_row(arx, "u-mfa")
    tok = arx.token(mfa_user)
    r = TestClient(arx.app).get("/arx/api/v1/me", headers={"Authorization": f"Bearer {tok}"})
    assert r.status_code == 200, r.text
    assert listing["calls"] == 1
    listing["make"] = lambda iss: [entry(iss, created_at=BEFORE)]
    r = TestClient(arx.app).get("/arx/api/v1/me", headers={"Authorization": f"Bearer {arx.token(arx.viewer)}"})
    assert r.status_code == 403 and r.json()["code"] == "second_factor_enrollment_required"


# ================================================================ long-lived tokens (owner Q48: allow)

def _long_lived(arx, user) -> str:
    return arx.core.issue(user.id, client_id=None, token_type="long_lived_access_token")["access_token"]


def test_long_lived_tokens_are_allowed_by_default_with_no_extra_ha_call(arx):
    tok = _long_lived(arx, arx.viewer)
    dials = len(arx.core.dials)
    r = arx.client.post("/arx/api/v1/auth/session", headers={"Authorization": f"Bearer {tok}"})
    assert r.status_code == 200
    assert len(arx.core.dials) - dials == 1  # the validation only; auth/refresh_tokens is not asked


def test_refuse_mode_refuses_a_long_lived_token_and_audits_it(arx):
    arx.setting(fp.LLAT_KEY, "refuse")
    r = arx.client.post("/arx/api/v1/auth/session", headers={"Authorization": f"Bearer {_long_lived(arx, arx.viewer)}"})
    assert r.status_code == 403 and r.json()["code"] == "long_lived_token_refused"
    assert refused(arx)[-1]["reason"] == "long_lived_token"
    assert fresh_login(arx, arx.viewer).status_code == 200  # a normal sign-in still works
    assert arx.core.deleted_refresh == []  # Arx never touches the HA token


def test_refuse_under_policy_only_refuses_users_the_enforced_policy_covers(arx):
    arx.setting(fp.LLAT_KEY, "refuse_under_policy")
    policy_settings(arx, "admins")
    assert arx.client.post("/arx/api/v1/auth/session", headers={"Authorization": f"Bearer {_long_lived(arx, arx.viewer)}"}).status_code == 200
    arx.client.cookies.clear()
    r = arx.client.post("/arx/api/v1/auth/session", headers={"Authorization": f"Bearer {_long_lived(arx, arx.owner)}"})
    assert r.status_code == 403 and r.json()["code"] == "long_lived_token_refused"
    arx.setting(fp.MODE_KEY, "report")  # report mode covers nobody for enforcement
    arx.client.cookies.clear()
    assert arx.client.post("/arx/api/v1/auth/session", headers={"Authorization": f"Bearer {_long_lived(arx, arx.owner)}"}).status_code == 200


def test_refuse_mode_on_the_bearer_path(arx):
    arx.setting(fp.LLAT_KEY, "refuse")
    r = TestClient(arx.app).get("/arx/api/v1/me", headers={"Authorization": f"Bearer {_long_lived(arx, arx.viewer)}"})
    assert r.status_code == 403 and r.json()["code"] == "long_lived_token_refused"


def test_long_lived_rule_falls_back_to_the_token_lifetime_when_the_listing_drifts(arx, listing):
    arx.setting(fp.LLAT_KEY, "refuse")
    listing["make"] = lambda iss: {"changed": True}
    # MFA-SECFIX-2500 (merge with MFA-TOKENS-2490): the fake core now gives a long-lived token HA's real lifespan (years), so with HA's
    # type unknown the token's own lifetime decides both ways: years -> refused; a normal sign-in's 30-minute token -> allowed
    r = arx.client.post("/arx/api/v1/auth/session", headers={"Authorization": f"Bearer {_long_lived(arx, arx.viewer)}"})
    assert r.status_code == 403 and r.json()["code"] == "long_lived_token_refused"
    arx.client.cookies.clear()
    normal = arx.core.issue(arx.viewer.id, client_id=None)["access_token"]
    assert arx.client.post("/arx/api/v1/auth/session", headers={"Authorization": f"Bearer {normal}"}).status_code == 200


# ================================================================ auth_mfa_seen

def _seen(arx, user_id: str):
    with arx.db.connection(mode="read") as conn:
        return prov.seen(conn, user_id)


def test_sign_in_records_ha_mfa_and_its_disappearance(arx, mfa_user):
    assert fresh_login(arx, mfa_user).status_code == 200
    row = _seen(arx, "u-mfa")
    assert row is not None and json.loads(row["modules_json"]) == ["totp"]
    first = row["first_seen_at"]
    assert prov.parse_instant(first) is not None
    assert _seen(arx, "u-viewer") is None  # no MFA, no row
    prov.reset_for_tests()
    assert fresh_login(arx, mfa_user).status_code == 200
    assert _seen(arx, "u-mfa")["first_seen_at"] == first  # kept while MFA stays on
    arx.core.users["u-mfa"].mfa_code = None  # the user switched HA MFA off
    prov.reset_for_tests()
    assert fresh_login(arx, mfa_user).status_code == 200
    assert _seen(arx, "u-mfa") is None  # a later re-enable starts a fresh first_seen_at


def test_observations_are_throttled(arx, mfa_user):
    with arx.db.connection() as conn:
        conn.execute("DELETE FROM auth_mfa_seen")
    prov.reset_for_tests()
    user = hua.HaUser(id="u-mfa", name="", is_owner=False, is_admin=False, mfa=True, mfa_modules=("totp",))
    prov.observe(arx.db, user)
    with arx.db.connection() as conn:
        conn.execute("DELETE FROM auth_mfa_seen")
    prov.observe(arx.db, user)  # same state within the hour: not written again
    assert _seen(arx, "u-mfa") is None
    prov.observe(arx.db, hua.HaUser(id="u-mfa", name="", is_owner=False, is_admin=False, mfa=False))  # a change is written at once
    assert _seen(arx, "u-mfa") is None


def test_first_seen_is_compared_with_microseconds():
    v = prov.evaluate([entry("R1", created_at="2026-11-01T10:00:00.100000+00:00")], iss="R1", client_id=CLIENT_ID,
                      first_seen_at="2026-11-01T10:00:00.200000+00:00")
    assert v.reason == prov.BEFORE_MFA_SEEN


# ================================================================ the compliance view and the override route

def test_compliance_view_counts_missing_and_exempt(arx, mfa_user):
    enrol(arx, arx.viewer)
    seen_row(arx, "u-mfa")
    _wall(arx, "u-mfa")
    local = TestClient(arx.app)
    body = local.get(POLICY, params={"policy": "all"}).json()
    assert body["policy"] == "optional" and body["mode"] == "report" and body["enforced"] is False
    assert body["long_lived_tokens"] == "allow" and body["legacy"] == {"second_factor_policy": "optional", "require_mfa_admin": False}
    c = body["compliance"]
    assert c["policy"] == "all"
    missing = {p["user_id"]: p for p in c["missing"]}
    exempt = {p["user_id"]: p for p in c["exempt"]}
    assert "u-owner" in missing and missing["u-owner"]["reason"] == "global" and missing["u-owner"]["factor"] is None
    assert "u-viewer" not in missing  # enrolled TOTP
    assert exempt["u-mfa"]["reason"] == "wall" and exempt["u-mfa"]["factor"] == "ha_mfa"
    assert c["covered"] == c["enrolled"] + c["missing_count"] and c["users_total"] >= 3 and c["ha_mfa_seen"] == 1
    stored = local.get(POLICY).json()["compliance"]
    assert stored["policy"] == "optional" and stored["covered"] == 0 and stored["missing"] == []
    assert local.get(POLICY, params={"policy": "everyone"}).status_code == 422


def test_compliance_view_needs_rbac_assign_or_system_configure(arx):
    assert fresh_login(arx, arx.viewer).status_code == 200
    assert arx.client.get("/arx" + POLICY).status_code == 403
    assert fresh_login(arx, arx.owner).status_code == 200
    assert arx.client.get("/arx" + POLICY).status_code == 200


def test_override_route_validates_audits_and_mirrors_into_the_legacy_table(arx):
    assert fresh_login(arx, arx.viewer).status_code == 200  # the user is in Arx's directory once signed in
    local = TestClient(arx.app)
    r = local.put(POLICY + "/overrides/user/u-viewer", json={"sign_in": "exempt"})
    assert r.status_code == 200 and r.json()["overrides"]["user"] == {"u-viewer": "exempt"}
    with arx.db.connection(mode="read") as conn:
        assert sf.overrides(conn)["user"] == {"u-viewer": "optional"}  # the legacy layer reads `exempt` as `optional`
    row = arx.audit("auth.factor_policy.changed")[-1]
    assert row["resource_id"] == "u-viewer" and json.loads(row["details_json"]) == {"before": "inherit", "after": "exempt", "mode": "report"}
    assert local.put(POLICY + "/overrides/user/u-viewer", json={"sign_in": "inherit"}).json()["overrides"]["user"] == {}
    with arx.db.connection(mode="read") as conn:
        assert sf.overrides(conn)["user"] == {}
    assert local.put(POLICY + "/overrides/user/u-viewer", json={"sign_in": "maybe"}).status_code == 422
    assert local.put(POLICY + "/overrides/group/x", json={"sign_in": "required"}).status_code == 404
    assert local.put(POLICY + "/overrides/user/nobody", json={"sign_in": "required"}).status_code == 404
    assert local.put(POLICY + "/overrides/role/no-such-role", json={"sign_in": "required"}).status_code == 404


def test_the_legacy_override_route_mirrors_into_the_new_table(arx):
    local = TestClient(arx.app)
    assert local.put("/api/v1/auth/second-factor/overrides/role/viewer", json={"policy": "required"}).status_code == 200
    with arx.db.connection(mode="read") as conn:
        assert fp.overrides(conn)["role"] == {"viewer": "required"}
    assert local.put("/api/v1/auth/second-factor/overrides/role/viewer", json={"policy": "inherit"}).status_code == 200
    with arx.db.connection(mode="read") as conn:
        assert fp.overrides(conn)["role"] == {}


def test_a_viewer_cannot_change_an_override(arx):
    assert fresh_login(arx, arx.viewer).status_code == 200
    assert arx.client.put("/arx" + POLICY + "/overrides/user/u-viewer", json={"sign_in": "exempt"}).status_code == 403


# ================================================================ settings, restore, migration

def test_settings_validate(arx):
    local = TestClient(arx.app)
    for key, good, bad in (("security.factor_policy", "sensitive", "everyone"), ("security.factor_policy_mode", "enforce", "on"),
                           ("security.factor_wall_exempt", "off", "no"), ("security.remote_long_lived_tokens", "refuse_under_policy", "deny")):
        assert local.patch("/api/v1/settings", json={key: bad}).status_code == 422, key
        assert local.patch("/api/v1/settings", json={key: good}).status_code == 200, key
        assert local.get("/api/v1/settings").json()["settings"][key] == good


def test_a_restore_never_changes_the_policy_settings():
    from smplwise.services import backup

    assert {fp.POLICY_KEY, fp.MODE_KEY, fp.WALL_KEY, fp.LLAT_KEY} <= backup.SETTINGS_KEEP
    for table in ("auth_factor_policy", "auth_mfa_seen"):
        assert table not in backup.PROJECT_TABLES and table not in backup.ACCESS_TABLES


def test_migration_seeds_the_overrides_from_the_legacy_table():
    sql = (Path(__file__).resolve().parents[1] / "smplwise" / "migrations" / "0221_factor_policy.sql").read_text(encoding="utf-8")
    conn = sqlite3.connect(":memory:")
    conn.execute("CREATE TABLE auth_totp_policy (subject_kind TEXT, subject_id TEXT, policy TEXT, updated_at TEXT, updated_by TEXT, PRIMARY KEY (subject_kind, subject_id))")
    conn.executemany("INSERT INTO auth_totp_policy VALUES (?,?,?,?,?)", [("user", "u1", "required", "t", "a"), ("role", "viewer", "optional", "t", None)])
    conn.executescript(sql)
    assert sorted(conn.execute("SELECT subject_kind, subject_id, sign_in FROM auth_factor_policy").fetchall()) == [("role", "viewer", "optional"), ("user", "u1", "required")]
    with pytest.raises(sqlite3.IntegrityError):
        conn.execute("INSERT INTO auth_factor_policy VALUES ('user', 'u2', 'never', 't', NULL)")


def test_nothing_secret_in_the_audit_rows(arx, mfa_user, listing):
    policy_settings(arx, "all")
    seen_row(arx, "u-mfa")
    tok = arx.token(mfa_user)
    assert arx.client.post("/arx/api/v1/auth/session", headers={"Authorization": f"Bearer {tok}"}).status_code == 200
    with arx.db.connection(mode="read") as conn:
        dump = json.dumps([dict(r) for r in conn.execute("SELECT * FROM audit_log").fetchall()])
    assert tok not in dump and hua.jwt_iss(tok) not in dump


def test_instants_parse_both_zone_spellings():
    a = prov.parse_instant("2026-11-01T10:00:00Z")
    b = prov.parse_instant("2026-11-01T10:00:00+00:00")
    assert a == b and a.tzinfo is not None and prov.parse_instant(dt.datetime(2026, 1, 1).isoformat()) is None
