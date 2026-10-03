"""Release 0.1.156: the colour palettes of the Bubble skin. The ten ready palettes (data in docs/design/palettes/palettes.json, copied
to frontend/src/design/palettes.json) must stay valid under the contrast rules; the palette dial of `ui.look` accepts default, the ten
ids and `custom-<slug>`; a custom palette (`ui.palettes`, per installation) is stored when it is well-formed (Hebrew 422 otherwise);
low contrast is only a WARNING (owner 2026-10-02: saving is allowed); the palette is chosen by the system administrator only, so a
user's personal override of the palette is validated and dropped."""
from __future__ import annotations

import copy
import json
from pathlib import Path

import pytest
from conftest import as_user, bind
from fastapi.testclient import TestClient

from smplwise.main import create_app
from smplwise.services import look, palettes

ROOT = Path(__file__).resolve().parents[3]
DOC = json.loads((ROOT / "docs" / "design" / "palettes" / "palettes.json").read_text(encoding="utf-8"))
FRONT = json.loads((ROOT / "frontend" / "src" / "design" / "palettes.json").read_text(encoding="utf-8"))
BACK = json.loads((ROOT / "smplwise_vms" / "backend" / "smplwise" / "palettes.json").read_text(encoding="utf-8"))


def custom(pid: str = "custom-mine", base: str = "calm-blue") -> dict:
    p = copy.deepcopy(next(x for x in DOC["palettes"] if x["id"] == base))
    p["id"] = pid
    p["name"] = {"he": "שלי", "en": "Mine"}
    return p


def test_the_ten_ids_the_frontend_copy_and_the_dial_agree():
    ids = tuple(p["id"] for p in DOC["palettes"])
    assert ids == palettes.BUILTIN_IDS and len(ids) == 10
    assert FRONT == DOC  # the app's copy is the design asset, byte for byte in content
    assert BACK == DOC  # the backend's copy (the dial's ids come from it: adding a palette is a data-only change)
    assert look.PALETTES == ("default", *ids)
    assert DOC["defaultPalette"] in ids


def test_every_ready_palette_is_well_formed_and_passes_every_pair():
    total = 0
    for p in DOC["palettes"]:
        assert palettes.schema_errors(p) == [], p["id"]
        for sc in ("light", "dark"):
            rows = palettes.check_scheme(p["schemes"][sc])
            total += len(rows)
            assert [r for r in rows if not r["ok"]] == [], (p["id"], sc)
            assert min(r["ratio"] for r in rows if r["min"] == palettes.TEXT_MIN) >= 4.5
    assert total == 1900  # the validator's published count (docs/design/palettes/README.md)
    assert len(palettes.check_scheme(DOC["palettes"][0]["schemes"]["light"])) == 97
    assert len(palettes.check_scheme(DOC["palettes"][0]["schemes"]["dark"])) == 93


@pytest.mark.parametrize("value", ["default", *palettes.BUILTIN_IDS, "custom-mine", "custom-a1-b2", "custom-x"])
def test_dial_accepts(value):
    assert palettes.valid_dial_value(value)
    assert look.normalize_partial({"palette": value}) == {"palette": value}


@pytest.mark.parametrize("value", ["", "Default", "ocean", "custom", "custom-", "custom--a", "custom-a-", "custom-A", "custom-a_b", "custom-" + "a" * 40, None, 5, ["default"], True])
def test_dial_refuses(value):
    assert not palettes.valid_dial_value(value)
    with pytest.raises(ValueError):
        look.normalize_partial({"palette": value})


def test_custom_palette_that_passes_is_accepted_and_canonical():
    out = palettes.validate_custom(custom())
    assert out["id"] == "custom-mine" and set(out) == {"id", "name", "character", "schemes"}


def _break(pal: dict, scheme: str, path: str, value) -> dict:
    node = pal["schemes"][scheme]
    keys = path.split(".")
    for k in keys[:-1]:
        node = node[k]
    node[keys[-1]] = value
    return pal


def test_low_contrast_is_a_warning_not_a_refusal():
    pal = _break(custom(), "light", "textMuted", "#c8cfdc")  # light grey on light surfaces
    out = palettes.validate_custom(pal)  # accepted: no ValueError
    assert out["schemes"] == pal["schemes"]
    rows = palettes.failing_pairs(pal)
    assert rows
    msg = palettes.describe_failures(rows)  # the Hebrew warning the editor shows lists the worst pairs
    assert msg.startswith("אזהרה: ניגודיות נמוכה מדי")
    assert "בהיר" in msg and "טקסט משני" in msg and ":1 (נדרש 4.5:1)" in msg


def test_low_contrast_in_the_dark_scheme_and_non_text_pairs_are_accepted_with_a_warning():
    dark = _break(custom(), "dark", "text", "#4a4f5c")
    assert palettes.validate_custom(dark)["id"] == "custom-mine"
    assert "כהה" in palettes.describe_failures(palettes.failing_pairs(dark))
    light = _break(custom(), "light", "state.danger", custom()["schemes"]["light"]["bg"])
    assert palettes.validate_custom(light)["id"] == "custom-mine"
    assert "נדרש 3:1" in palettes.describe_failures(palettes.failing_pairs(light))


def test_malformed_palettes_are_refused():
    bad = [
        "x", [], {}, {**custom(), "id": "mine"}, {**custom(), "id": "custom-Mine"}, {**custom(), "name": {"he": "x"}},
        {**custom(), "extra": 1}, {**custom(), "schemes": {"light": custom()["schemes"]["light"]}},
        _break(custom(), "light", "bg", "red"), _break(custom(), "light", "bg", "#fff"), _break(custom(), "dark", "glass.opacity.min", 0),
        _break(custom(), "dark", "glass.opacity.max", 0.1), _break(custom(), "light", "glass.blurPx", 99), _break(custom(), "light", "wallpaper.stops", ["#ffffff"]),
        _break(custom(), "light", "gradient.pairs", [["#ffffff", "#000000"]]), _break(custom(), "dark", "slider.edge", 5),
    ]
    for pal in bad:
        with pytest.raises(ValueError):
            palettes.validate_custom(pal)
    extra = copy.deepcopy(custom())
    extra["schemes"]["light"]["unknownToken"] = "#000000"
    assert any("unknown token" in e for e in palettes.schema_errors(extra))
    missing = copy.deepcopy(custom())
    del missing["schemes"]["dark"]["accent"]
    assert any("accent missing" in e for e in palettes.schema_errors(missing))


def test_a_ready_palette_id_cannot_be_reused_as_custom():
    with pytest.raises(ValueError):
        palettes.validate_custom(custom("calm-blue"))


def test_list_rules_and_stored():
    assert palettes.normalize_customs([]) == []
    assert [p["id"] for p in palettes.normalize_customs([custom("custom-a"), custom("custom-b")])] == ["custom-a", "custom-b"]
    for bad in ("x", {}, [custom("custom-a"), custom("custom-a")], [custom(f"custom-p{i}") for i in range(palettes.MAX_CUSTOM + 1)]):
        with pytest.raises(ValueError):
            palettes.normalize_customs(bad)
    assert palettes.stored(None) == [] and palettes.stored("not json") == [] and palettes.stored("{}") == []
    good = custom("custom-a")
    low = _break(custom("custom-b"), "light", "text", "#dddddd")  # low contrast: kept (it was saved with a warning)
    assert [p["id"] for p in palettes.stored(json.dumps([good, low, "x"]))] == ["custom-a", "custom-b"]
    structural = custom("custom-c")
    del structural["schemes"]["light"]["accent"]
    assert [p["id"] for p in palettes.stored(json.dumps([good, structural]))] == ["custom-a"]  # a structurally invalid one is never served


def test_settings_round_trip_refusal_audit_and_permission(settings):
    app = create_app(settings)
    with TestClient(app) as c:
        assert c.get("/api/v1/settings").json()["settings"]["ui.palettes"] == []
        mine = custom("custom-mine")
        r = c.patch("/api/v1/settings", json={"ui.palettes": [mine]})
        assert r.status_code == 200, r.text
        assert [p["id"] for p in r.json()["settings"]["ui.palettes"]] == ["custom-mine"]
        assert c.get("/api/v1/settings").json()["settings"]["ui.palettes"][0]["schemes"] == mine["schemes"]
        # the dial can point at it, per installation and per user
        full = {**look.DEFAULT, "palette": "custom-mine"}
        assert c.patch("/api/v1/settings", json={"ui.look": full}).json()["settings"]["ui.look"]["palette"] == "custom-mine"
        assert c.patch("/api/v1/settings", json={"ui.look": {**look.DEFAULT, "palette": "sunset"}}).status_code == 200
        # a palette that fails the contrast checks is ACCEPTED (warn-only, owner decision): no 422, it is stored
        low = _break(custom("custom-low"), "light", "textMuted", "#c8cfdc")
        r = c.patch("/api/v1/settings", json={"ui.palettes": [mine, low]})
        assert r.status_code == 200, r.text
        assert [p["id"] for p in r.json()["settings"]["ui.palettes"]] == ["custom-mine", "custom-low"]
        assert [p["id"] for p in c.get("/api/v1/settings").json()["settings"]["ui.palettes"]] == ["custom-mine", "custom-low"]
        # a structurally invalid palette is still refused (422, Hebrew) and stores nothing
        broken = custom("custom-bad")
        del broken["schemes"]["dark"]["accent"]
        r = c.patch("/api/v1/settings", json={"ui.palettes": [mine, broken]})
        assert r.status_code == 422 and "אינה תקינה" in json.dumps(r.json(), ensure_ascii=False)
        for bad in ("x", [1], [{**mine, "id": "calm-blue"}], [mine, mine], [_break(custom("custom-bad2"), "light", "bg", "red")]):
            assert c.patch("/api/v1/settings", json={"ui.palettes": bad}).status_code == 422, bad
        assert [p["id"] for p in c.get("/api/v1/settings").json()["settings"]["ui.palettes"]] == ["custom-mine", "custom-low"]
        with app.state.db.connection() as conn:
            rows = [json.loads(r[0] or "{}") for r in conn.execute("SELECT details_json FROM audit_log WHERE action = 'settings.update' AND decision = 'allowed' ORDER BY rowid").fetchall()]
        assert any("ui.palettes" in d for d in rows)
        # clearing: an empty list
        assert c.patch("/api/v1/settings", json={"ui.palettes": []}).json()["settings"]["ui.palettes"] == []
        # only a system administrator changes it; everyone reads it
        bind(c, settings, "dana", "viewer", "installation", "*")
        assert c.patch("/api/v1/settings", headers=as_user("dana"), json={"ui.palettes": [mine]}).status_code == 403
        assert c.get("/api/v1/settings", headers=as_user("dana")).json()["settings"]["ui.palettes"] == []


def test_user_override_of_the_palette_is_validated_and_ignored(settings):
    """Only the installation's system administrator chooses the palette (owner 2026-10-02): a personal palette never sticks."""
    c = TestClient(create_app(settings))
    c.get("/api/v1/me")
    bind(c, settings, "dana", "viewer", "installation", "*")
    for value in ("forest", "high-contrast", "custom-mine"):
        r = c.put("/api/v1/me/prefs", json={"ui.look": {"palette": value}})
        assert r.status_code == 200, r.text
        assert r.json()["prefs"]["ui.look"] == {}  # accepted, dropped
    r = c.put("/api/v1/me/prefs", json={"ui.look": {"palette": "forest", "density": "row"}})
    assert r.json()["prefs"]["ui.look"] == {"density": "row"}  # the other dials' personal overrides are untouched
    for bad in ("Forest", "custom-", "neon"):
        assert c.put("/api/v1/me/prefs", json={"ui.look": {"palette": bad}}).status_code == 422
    assert c.get("/api/v1/me/prefs").json()["prefs"]["ui.look"] == {"density": "row"}
    assert look.normalize_own({"palette": "sunset", "scale": 90}) == {"scale": 90}
