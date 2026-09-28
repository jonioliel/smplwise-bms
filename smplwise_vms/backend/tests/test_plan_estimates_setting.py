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


def test_plan_quality_setting_defaults_to_2_accepts_1_or_2_and_audits(settings):
    """CR-006 slice 1a: plan.quality is the 3D quality level a browser opens with (2 = shadows, materials and the
    cutaway; 1 = the schematic level, also the automatic fallback of a slow device). A browser may override it."""
    app = create_app(settings)
    c = TestClient(app)
    assert c.get("/api/v1/settings").json()["settings"]["plan.quality"] == "2"
    r = c.patch("/api/v1/settings", json={"plan.quality": "1"})
    assert r.status_code == 200 and r.json()["settings"]["plan.quality"] == "1"
    assert c.get("/api/v1/settings").json()["settings"]["plan.quality"] == "1"
    with app.state.db.connection() as conn:
        row = conn.execute("SELECT details_json FROM audit_log WHERE action = 'settings.update' ORDER BY rowid DESC LIMIT 1").fetchone()
        assert row is not None and '"plan.quality": "1"' in row[0]
    assert c.patch("/api/v1/settings", json={"plan.quality": "3"}).status_code == 422
    assert c.patch("/api/v1/settings", json={"plan.quality": "high"}).status_code == 422
    bind(c, settings, "dana", "viewer", "installation", "*")
    assert c.patch("/api/v1/settings", json={"plan.quality": "2"}, headers=as_user("dana")).status_code == 403


def test_plan_presence_fade_setting_defaults_to_3_minutes_accepts_off_or_1_to_120_and_audits(settings):
    """CR-006 slice 1b (owner decision 2026-09-28): plan.presence_fade is the presence tint's fade window on the floor
    map - "off" (the blue tint only while a sensor is on) or 1-120 minutes, per installation; default 3 minutes."""
    app = create_app(settings)
    c = TestClient(app)
    assert c.get("/api/v1/settings").json()["settings"]["plan.presence_fade"] == "3"
    r = c.patch("/api/v1/settings", json={"plan.presence_fade": "off"})
    assert r.status_code == 200 and r.json()["settings"]["plan.presence_fade"] == "off"
    assert c.patch("/api/v1/settings", json={"plan.presence_fade": "120"}).json()["settings"]["plan.presence_fade"] == "120"
    assert c.patch("/api/v1/settings", json={"plan.presence_fade": "10"}).json()["settings"]["plan.presence_fade"] == "10"
    assert c.get("/api/v1/settings").json()["settings"]["plan.presence_fade"] == "10"
    with app.state.db.connection() as conn:
        row = conn.execute("SELECT details_json FROM audit_log WHERE action = 'settings.update' ORDER BY rowid DESC LIMIT 1").fetchone()
        assert row is not None and '"plan.presence_fade": "10"' in row[0]
    for bad in ("0", "121", "3.5", "on", "-1", ""):
        assert c.patch("/api/v1/settings", json={"plan.presence_fade": bad}).status_code == 422, bad
    bind(c, settings, "dana", "viewer", "installation", "*")
    assert c.patch("/api/v1/settings", json={"plan.presence_fade": "5"}, headers=as_user("dana")).status_code == 403
