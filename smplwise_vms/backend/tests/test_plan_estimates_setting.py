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
