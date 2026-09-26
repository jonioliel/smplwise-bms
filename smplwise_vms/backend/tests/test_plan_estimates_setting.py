"""Plan Studio (T084, owner decision 2026-09-23): the setting plan.estimates says whether the editor shows estimated
metres ("≈") before a plan is calibrated (default) or hides them until calibration."""
from __future__ import annotations

from conftest import as_user, bind
from fastapi.testclient import TestClient

from smplwise.main import create_app


def test_plan_estimates_setting_defaults_to_true_and_accepts_only_booleans(settings):
    c = TestClient(create_app(settings))
    assert c.get("/api/v1/settings").json()["settings"]["plan.estimates"] == "true"
    assert c.patch("/api/v1/settings", json={"plan.estimates": "false"}).json()["settings"]["plan.estimates"] == "false"
    assert c.get("/api/v1/settings").json()["settings"]["plan.estimates"] == "false"
    assert c.patch("/api/v1/settings", json={"plan.estimates": "maybe"}).status_code == 422
    bind(c, settings, "dana", "viewer", "installation", "*")
    assert c.patch("/api/v1/settings", json={"plan.estimates": "true"}, headers=as_user("dana")).status_code == 403


def test_plan_levels_setting_defaults_to_all_patches_to_default_and_audits(settings):
    """0.1.89 (owner decision 2026-09-26): plan.levels chooses the default levels view on every map: all levels
    together (default) or the floor's default level only."""
    app = create_app(settings)
    c = TestClient(app)
    assert c.get("/api/v1/settings").json()["settings"]["plan.levels"] == "all"
    r = c.patch("/api/v1/settings", json={"plan.levels": "default"})
    assert r.status_code == 200 and r.json()["settings"]["plan.levels"] == "default"
    assert c.get("/api/v1/settings").json()["settings"]["plan.levels"] == "default"
    with app.state.db.connection() as conn:
        row = conn.execute("SELECT details_json FROM audit_log WHERE action = 'settings.update' ORDER BY rowid DESC LIMIT 1").fetchone()
        assert row is not None and '"plan.levels": "default"' in row[0]
    assert c.patch("/api/v1/settings", json={"plan.levels": "sometimes"}).status_code == 422
