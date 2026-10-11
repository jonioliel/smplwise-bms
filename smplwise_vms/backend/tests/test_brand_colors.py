"""2.4.4 (owner 2026-10-10): the product's accent colour and the colour of a switch that is on (`ui.accent`, `ui.toggle_on`).

"default" (the skin's own colour - today's system blue) unless an administrator picks a preset (ios_green: the earlier glass
mockup's green) or a "#rrggbb" colour. system.configure only, validated, audited, read by every user (the whole UI paints with it),
carried by the project backup (rows of `settings`) together with the glass screens' scheme choice (`devices.glass_scheme`)."""
from __future__ import annotations

import io
import json
import zipfile

import pytest
from conftest import as_user, bind
from fastapi.testclient import TestClient

from smplwise.main import create_app
from smplwise.services import brand_colors


def test_normalize_presets_hex_and_refusals():
    assert brand_colors.normalize("default") == "default"
    assert brand_colors.normalize("ios_green") == "ios_green" and brand_colors.PRESETS["ios_green"] == "#34c759"
    assert brand_colors.normalize(" #AABBCC ") == "#aabbcc"
    for bad in ("", "green", "#abc", "#gggggg", "rgb(1,2,3)", "var(--x)", "#aabbcc;x", None, 3, ["#aabbcc"]):
        with pytest.raises(ValueError):
            brand_colors.normalize(bad)
    assert brand_colors.stored("url(javascript:1)") == "default" and brand_colors.stored(None) == "default"


def test_defaults_validation_audit_and_gate(settings):
    app = create_app(settings)
    with TestClient(app) as c:
        s = c.get("/api/v1/settings").json()["settings"]
        assert (s["ui.accent"], s["ui.toggle_on"]) == ("default", "default"), "today's system blue"
        r = c.patch("/api/v1/settings", json={"ui.accent": "#7C3AED", "ui.toggle_on": "ios_green"})
        assert r.status_code == 200, r.text
        assert (r.json()["settings"]["ui.accent"], r.json()["settings"]["ui.toggle_on"]) == ("#7c3aed", "ios_green")
        for key, bad in (("ui.accent", "green"), ("ui.accent", "#12345"), ("ui.toggle_on", "red;}"), ("ui.toggle_on", ""), ("ui.accent", 7)):
            assert c.patch("/api/v1/settings", json={key: bad}).status_code == 422, (key, bad)
        s = c.get("/api/v1/settings").json()["settings"]
        assert (s["ui.accent"], s["ui.toggle_on"]) == ("#7c3aed", "ios_green"), "a refused value changes nothing"
        with app.state.db.connection() as conn:
            rows = [json.loads(r[0] or "{}") for r in conn.execute("SELECT details_json FROM audit_log WHERE action = 'settings.update' AND decision = 'allowed'").fetchall()]
        assert {"ui.accent": "#7c3aed", "ui.toggle_on": "ios_green"} in rows
        # a corrupt stored value reads as the default, never reaches the page as CSS
        with app.state.db.connection() as conn:
            conn.execute("UPDATE settings SET value = 'red;}body{x' WHERE key = 'ui.accent'")
        assert c.get("/api/v1/settings").json()["settings"]["ui.accent"] == "default"
        # read by any user; written only with system.configure
        bind(c, settings, "dana", "viewer", "installation", "*")
        bind(c, settings, "sami", "site_admin", "installation", "*")
        assert c.get("/api/v1/settings", headers=as_user("dana")).json()["settings"]["ui.toggle_on"] == "ios_green"
        for user in ("dana", "sami"):
            assert c.patch("/api/v1/settings", json={"ui.accent": "teal"}, headers=as_user(user)).status_code == 403
            assert c.patch("/api/v1/settings", json={"devices.glass_scheme": "light"}, headers=as_user(user)).status_code == 403


def test_brand_and_glass_scheme_travel_with_the_project_backup(settings):
    app = create_app(settings)
    with TestClient(app) as c:
        assert c.patch("/api/v1/settings", json={"ui.accent": "orange", "ui.toggle_on": "#123456", "devices.glass_scheme": "dark"}).status_code == 200
        e = c.post("/api/v1/backups", json={}).json()
        raw = c.get(f"/api/v1/backups/{e['name']}/download").content
        with zipfile.ZipFile(io.BytesIO(raw)) as z:
            rows = {r["key"]: r["value"] for r in json.loads(z.read("data/settings.json"))}
        assert (rows["ui.accent"], rows["ui.toggle_on"], rows["devices.glass_scheme"]) == ("orange", "#123456", "dark")
        assert c.patch("/api/v1/settings", json={"ui.accent": "default", "ui.toggle_on": "default", "devices.glass_scheme": "follow"}).status_code == 200
        up = c.post("/api/v1/backups/upload", files={"file": ("b.zip", raw, "application/zip")})
        res = c.post(f"/api/v1/backups/{up.json()['name']}/restore", json={"mode": "replace", "scope": "project", "confirm": "RESTORE"})
        assert res.status_code == 200, res.text
        s = c.get("/api/v1/settings").json()["settings"]
        assert (s["ui.accent"], s["ui.toggle_on"], s["devices.glass_scheme"]) == ("orange", "#123456", "dark")


def test_toggle_follows_accent_only_for_the_switch(settings):
    """SET-polish (owner 2026-10-11): `ui.toggle_on` may be "accent" (the switch follows the accent); `ui.accent` may not."""
    assert brand_colors.normalize("accent", "ui.toggle_on") == "accent"
    assert brand_colors.normalize(" accent ", "ui.toggle_on") == "accent"
    with pytest.raises(ValueError):
        brand_colors.normalize("accent", "ui.accent")
    with pytest.raises(ValueError):
        brand_colors.normalize("accent")
    assert brand_colors.stored("accent", "ui.toggle_on") == "accent" and brand_colors.stored("accent", "ui.accent") == "default"
    app = create_app(settings)
    with TestClient(app) as c:
        r = c.patch("/api/v1/settings", json={"ui.toggle_on": "accent"})
        assert r.status_code == 200, r.text
        assert r.json()["settings"]["ui.toggle_on"] == "accent"
        assert c.patch("/api/v1/settings", json={"ui.accent": "accent"}).status_code == 422
        assert c.get("/api/v1/settings").json()["settings"]["ui.toggle_on"] == "accent"
