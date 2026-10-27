"""POLISH-SKINS-297 (owner 2026-10-27): the skins' options (`ui.skin_options`) - {"<skin>.<option>": "<choice>"}, e.g. Arx Soft's lamp
glow and switch colour. Per installation, system.configure (the settings write gate), shape-validated here (the frontend registry knows
the options and reads an unknown one as its default), stored as JSON, read back as an object, a corrupt stored value reads as {}."""
from __future__ import annotations

import pytest
from fastapi.testclient import TestClient

from smplwise.db import set_setting
from smplwise.main import create_app
from smplwise.routers.settings import SKIN_OPTIONS_MAX_ENTRIES, normalize_skin_options, stored_skin_options


def test_normalize_shape_and_refusals():
    assert normalize_skin_options({}) == {}
    assert normalize_skin_options({"soft.glow": "strong", "soft.switch": "indigo"}) == {"soft.glow": "strong", "soft.switch": "indigo"}
    for bad in (
        [],
        "soft.glow=strong",
        {"nosuch.glow": "strong"},  # not a skin
        {"soft": "strong"},  # no option part
        {"soft.Glow": "strong"},  # upper case
        {"soft.glow": "Strong"},
        {"soft.glow": "x" * 25},
        {"soft.glow": 3},
        {"soft.glow": "a;b"},
        {f"soft.o{i}": "a" for i in range(SKIN_OPTIONS_MAX_ENTRIES + 1)},
    ):
        with pytest.raises(ValueError):
            normalize_skin_options(bad)
    assert stored_skin_options("{not json") == {} and stored_skin_options('{"soft.glow": "<b>"}') == {} and stored_skin_options(None) == {}


def test_default_write_read_back_and_refusal(settings):
    app = create_app(settings)
    with TestClient(app) as c:
        assert c.get("/api/v1/settings").json()["settings"]["ui.skin_options"] == {}
        r = c.patch("/api/v1/settings", json={"ui.skin_options": {"soft.glow": "strong", "soft.switch": "graphite"}})
        assert r.status_code == 200, r.text
        assert r.json()["settings"]["ui.skin_options"] == {"soft.glow": "strong", "soft.switch": "graphite"}
        assert c.get("/api/v1/settings").json()["settings"]["ui.skin_options"] == {"soft.glow": "strong", "soft.switch": "graphite"}
        for bad in ({"soft.glow": "Strong"}, {"x.glow": "soft"}, "soft.glow", [1]):
            assert c.patch("/api/v1/settings", json={"ui.skin_options": bad}).status_code == 422, bad
        assert c.get("/api/v1/settings").json()["settings"]["ui.skin_options"] == {"soft.glow": "strong", "soft.switch": "graphite"}, "a refused value changes nothing"
        # back to every option's default
        assert c.patch("/api/v1/settings", json={"ui.skin_options": {}}).json()["settings"]["ui.skin_options"] == {}
        # a corrupt stored row reads as no choices, never reaches the page
        with app.state.db.connection() as conn:
            set_setting(conn, "ui.skin_options", '{"soft.glow": "url(x)"}')
        assert c.get("/api/v1/settings").json()["settings"]["ui.skin_options"] == {}
