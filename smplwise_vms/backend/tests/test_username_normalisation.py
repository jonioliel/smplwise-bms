"""HA 2026.10 lower-cases and trims usernames: the bootstrap-admin identity comparison is normalised on both sides."""
from dataclasses import replace

import pytest
from fastapi.testclient import TestClient

from smplwise.auth import normalize_username, same_username
from smplwise.main import create_app


def test_same_username_strips_and_casefolds_both_sides():
    assert normalize_username("  JoNi ") == "joni" and normalize_username(None) == ""
    assert same_username("joni", "Joni") and same_username(" JONI", "joni ") and same_username("Straße", "strasse")
    assert not same_username("joni", "jon") and not same_username("", "") and not same_username(None, "joni")


@pytest.mark.parametrize("configured, signed_in", [("Boss", "boss"), ("boss", "  BOSS "), (" Boss ", "bOSS")])
def test_bootstrap_matches_regardless_of_case_and_padding(settings, tmp_path, configured, signed_in):
    app = create_app(replace(settings, dev_user=signed_in, bootstrap_admin_username=configured, data_dir=tmp_path / "boot"))
    me = TestClient(app).get("/api/v1/me")
    assert me.status_code == 200 and any(b["role_id"] == "system_admin" for b in me.json()["bindings"])
    with app.state.db.connection() as conn:
        assert conn.execute("SELECT COUNT(*) FROM audit_log WHERE action = 'rbac.bootstrap_admin'").fetchone()[0] == 1


def test_a_different_name_is_still_not_bootstrapped(settings, tmp_path):
    app = create_app(replace(settings, dev_user="bossy", bootstrap_admin_username="boss", data_dir=tmp_path / "boot"))
    me = TestClient(app).get("/api/v1/me")
    assert me.status_code == 200 and not any(b["role_id"] == "system_admin" for b in me.json()["bindings"])


# ---------------------------------------------------------------- HA 2026.10 adaptation plan rows 2 and 3

def test_case_only_twins_collide_and_an_inner_space_is_not_normalised_away():
    """HA 2026.10 makes "Joni" and "joni" one login name (they collide); a name with an inner space stays a different name."""
    assert same_username("Joni", "joni") and same_username("\tJONI\n", "joni"), "case / padding twins are one name"
    assert not same_username("jo ni", "joni") and not same_username("Jo Ni", "joni"), "an inner space is kept"
    assert normalize_username("Jo Ni ") == "jo ni"


def test_bootstrap_happens_once_even_for_a_case_twin(settings, tmp_path):
    """Two HA users that differ only in case: the first one to sign in is bootstrapped, the twin never (state is not pending)."""
    s = replace(settings, dev_user=None, bootstrap_admin_username="boss", data_dir=tmp_path / "twin")
    c = TestClient(create_app(replace(s, dev_user="boss")))
    assert any(b["role_id"] == "system_admin" for b in c.get("/api/v1/me", headers={"X-SW-Dev-User": "boss"}).json()["bindings"])
    twin = c.get("/api/v1/me", headers={"X-SW-Dev-User": "BOSS"})
    assert twin.status_code == 200
    with c.app.state.db.connection() as conn:
        assert conn.execute("SELECT COUNT(*) FROM audit_log WHERE action = 'rbac.bootstrap_admin'").fetchone()[0] == 1


def _audit_row(conn, username):
    conn.execute("INSERT INTO audit_log(at, actor_user_id, actor_username, action, resource_type, resource_id, decision, reason, request_id, "
                 "permission_revision, details_json) VALUES ('2026-10-08T00:00:00Z', ?, ?, 'rbac.test_row', 'test', 'r', 'allowed', NULL, NULL, 0, '{}')",
                 ("id-" + (username or "none"), username))


def test_audit_filter_by_username_is_normalised_like_ha(settings):
    app = create_app(settings)
    c = TestClient(app)
    assert c.get("/api/v1/me").status_code == 200  # joni = system administrator (bootstrap)
    with app.state.db.connection() as conn:
        for name in ("joni", "Joni", " JONI ", "jo ni", "jonathan", None):
            _audit_row(conn, name)

    def names(actor):
        rows = c.get("/api/v1/audit", params={"prefix": "rbac.test_row", "actor": actor, "limit": 50}).json()["rows"]
        return sorted(r["actor_username"] for r in rows)

    assert names("Joni") == sorted(["joni", "Joni", " JONI "]), "rows written before a rename to lower case are found"
    assert names("  joni") == names("JONI") == names("Joni")
    assert names("jo ni") == ["jo ni"] and names("jon") == [], "no prefix or inner-space widening"
    assert names("   ") == [], "an empty name matches nothing, never the rows without an actor"
    rows = c.get("/api/v1/audit", params={"prefix": "rbac.test_row", "limit": 50}).json()["rows"]
    assert len(rows) == 6, "without a filter every row is listed as before"