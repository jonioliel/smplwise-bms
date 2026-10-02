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
