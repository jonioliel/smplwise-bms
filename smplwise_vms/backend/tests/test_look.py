"""Bubble foundation (owner 2026-10-02): the look dials. The installation default (`ui.look` in PATCH /settings, every dial
required) and a user's own partial override (`ui.look` in PUT /me/prefs, any subset; null = follow the installation) share
one shape and one validator (services/look.py): unknown dials, unknown values and out-of-range numbers are a 422 and store
nothing; nothing is clamped silently. The frontend keeps the same lists (design/look.ts)."""
from __future__ import annotations

import json
import re
from pathlib import Path

import pytest
from conftest import as_user, bind
from fastapi.testclient import TestClient

from smplwise.main import create_app
from smplwise.services import look

FULL = {"density": "compact", "surface": "glass", "popup": "centred", "radius": "soft", "transparency": 60, "scale": 110, "touch": 32, "performance": "lite", "palette": "default"}

BAD_FULL = [
    "compact",
    [],
    {**FULL, "density": "huge"},
    {**FULL, "surface": "Glass"},
    {**FULL, "popup": "drawer"},
    {**FULL, "radius": "round"},
    {**FULL, "transparency": 39},
    {**FULL, "transparency": 101},
    {**FULL, "transparency": 72.5},
    {**FULL, "transparency": "72"},
    {**FULL, "transparency": True},
    {**FULL, "scale": 79},
    {**FULL, "scale": 131},
    {**FULL, "touch": 40},
    {**FULL, "touch": "44"},
    {**FULL, "performance": "fast"},
    {**FULL, "performance": "LITE"},
    {**FULL, "performance": True},
    {**FULL, "performance": None},
    {**FULL, "palette": "ocean"},
    {**FULL, "palette": "Calm-Blue"},
    {**FULL, "palette": "custom-"},
    {**FULL, "palette": "custom--x"},
    {**FULL, "palette": "custom-X"},
    {**FULL, "palette": "custom-" + "a" * 40},
    {**FULL, "palette": None},
    {**FULL, "palette": 3},
    {**FULL, "accent": "#ff0000"},  # unknown dial
    {k: v for k, v in FULL.items() if k != "radius"},  # the installation default needs every dial
]


def test_defaults_and_the_frontend_lists_agree():
    assert look.normalize(look.DEFAULT) == look.DEFAULT
    assert look.stored(json.dumps(look.DEFAULT)) == look.DEFAULT
    front = (Path(__file__).resolve().parents[3] / "frontend" / "src" / "design" / "look.ts").read_text(encoding="utf-8")
    for key, allowed in look.CHOICES.items():
        if key == "palette":
            continue  # generated from palettes.json on both sides (test_palettes.py compares the ids)
        m = re.search(rf"{key}:\s*\{{[^}}]*values:\s*\[([^\]]*)\]", front, re.S)
        assert m, f"{key} values not found in design/look.ts"
        assert tuple(re.findall(r"'([a-z-]+)'", m.group(1))) == allowed, key
    assert re.search(r"transparency:\s*\{[^}]*range:\s*\[40,\s*100\]", front, re.S)
    assert re.search(r"scale:\s*\{[^}]*range:\s*\[80,\s*130\]", front, re.S)
    assert re.search(r"touch:\s*\{[^}]*values:\s*\[32,\s*44\]", front, re.S)
    assert look.PERFORMANCES == ("auto", "full", "lite") and look.DEFAULT["performance"] == "auto"  # the performance tier: auto is the default


@pytest.mark.parametrize("value", [FULL, look.DEFAULT, {**FULL, "transparency": 40, "scale": 80}, {**FULL, "transparency": 100, "scale": 130, "touch": 44}])
def test_normalize_accepts_the_allowed_shapes(value):
    assert look.normalize(value) == {k: value[k] for k in look.KEYS}


@pytest.mark.parametrize("value", BAD_FULL)
def test_normalize_refuses_everything_else(value):
    with pytest.raises(ValueError):
        look.normalize(value)


def test_partial_and_stored():
    assert look.normalize_partial({}) == {}
    assert look.normalize_partial({"performance": "lite"}) == {"performance": "lite"}
    for bad in ("fast", "Auto", 1, None, ["lite"]):
        with pytest.raises(ValueError):
            look.normalize_partial({"performance": bad})
    # a default stored before the performance dial existed reads as "auto" for that dial
    assert look.stored(json.dumps({k: v for k, v in FULL.items() if k != "performance"}))["performance"] == "auto"
    assert look.normalize_partial({"density": "row"}) == {"density": "row"}
    with pytest.raises(ValueError):
        look.normalize_partial({"density": "row", "x": 1})
    with pytest.raises(ValueError):
        look.normalize_partial({"scale": 200})
    # an older stored default that lacks a dial added later keeps what it has and takes the default for the rest
    assert look.stored('{"density":"compact"}') == {**look.DEFAULT, "density": "compact"}
    assert look.stored("not json") == look.DEFAULT
    assert look.stored('{"density":"huge"}') == look.DEFAULT
    assert look.stored(None) == look.DEFAULT


def test_installation_default_round_trip_validation_audit_and_permission(settings):
    app = create_app(settings)
    with TestClient(app) as c:
        assert c.get("/api/v1/settings").json()["settings"]["ui.look"] == look.DEFAULT
        r = c.patch("/api/v1/settings", json={"ui.look": FULL})
        assert r.status_code == 200, r.text
        assert r.json()["settings"]["ui.look"] == FULL
        assert c.get("/api/v1/settings").json()["settings"]["ui.look"] == FULL
        for bad in BAD_FULL:
            assert c.patch("/api/v1/settings", json={"ui.look": bad}).status_code == 422, bad
        assert c.get("/api/v1/settings").json()["settings"]["ui.look"] == FULL  # refused values stored nothing
        with app.state.db.connection() as conn:
            rows = [json.loads(r[0] or "{}") for r in conn.execute("SELECT details_json FROM audit_log WHERE action = 'settings.update' AND decision = 'allowed' ORDER BY rowid").fetchall()]
        assert {"ui.look": FULL} in rows
        bind(c, settings, "dana", "viewer", "installation", "*")
        assert c.get("/api/v1/settings", headers=as_user("dana")).json()["settings"]["ui.look"] == FULL  # readable by everyone
        assert c.patch("/api/v1/settings", headers=as_user("dana"), json={"ui.look": look.DEFAULT}).status_code == 403
        assert c.get("/api/v1/settings").json()["settings"]["ui.look"] == FULL


def test_user_override_is_partial_per_user_validated_and_clearable(settings):
    c = TestClient(create_app(settings))
    c.get("/api/v1/me")
    bind(c, settings, "dana", "viewer", "installation", "*")
    body = c.get("/api/v1/me/prefs").json()
    assert body["prefs"]["ui.look"] is None and "ui.look" not in body["stored"]
    # a subset of the dials: only what the user set is stored, the rest follows the installation
    r = c.put("/api/v1/me/prefs", json={"ui.look": {"density": "row", "touch": 32}})
    assert r.status_code == 200, r.text
    assert r.json()["prefs"]["ui.look"] == {"density": "row", "touch": 32} and "ui.look" in r.json()["stored"]
    # an empty override is a stored "nothing overridden"
    assert c.put("/api/v1/me/prefs", headers=as_user("dana"), json={"ui.look": {}}).json()["prefs"]["ui.look"] == {}
    assert c.get("/api/v1/me/prefs").json()["prefs"]["ui.look"] == {"density": "row", "touch": 32}  # another user is untouched
    for bad in ({"density": "huge"}, {"transparency": 30}, {"scale": "100"}, {"touch": 36}, {"performance": "turbo"}, {"palette": "x"}, {"colour": "red"}, "compact", []):
        assert c.put("/api/v1/me/prefs", json={"ui.look": bad}).status_code == 422, bad
    assert c.get("/api/v1/me/prefs").json()["prefs"]["ui.look"] == {"density": "row", "touch": 32}
    # a full object is fine too (the palette is the installation administrator's alone, so it is dropped), and null = "לפי ההתקנה": the key is gone again
    assert c.put("/api/v1/me/prefs", json={"ui.look": FULL}).json()["prefs"]["ui.look"] == {k: v for k, v in FULL.items() if k != "palette"}
    r = c.put("/api/v1/me/prefs", json={"ui.look": None})
    assert r.status_code == 200 and "ui.look" not in r.json()["stored"] and r.json()["prefs"]["ui.look"] is None
