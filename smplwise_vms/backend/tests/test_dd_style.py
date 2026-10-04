"""Release 0.1.157: the look of a dropdown (`ui.dd_style`, `ui.dd_style_groups`). Installation default via PATCH /settings, a user's own
choice via PUT /me/prefs (null = follow the installation), one validator (services/dd_style.py). Default `auto` = today's look."""
from __future__ import annotations

import pytest
from conftest import as_user, bind
from fastapi.testclient import TestClient

from smplwise.main import create_app
from smplwise.services import dd_style

BAD_STYLES = ["", "Pill", "chip", "tabs", 1, True, ["pill"], {"a": 1}]
BAD_GROUPS = ["pill", ["home"], {"nav": "pill"}, {"home": "list"}, {"home": 1}, {"home": None}, {"area": "tonal", "bottom": "pill"}]


def test_normalize_styles_and_groups():
    assert dd_style.STYLES == ("auto", "pill", "field", "underline", "text", "prefix", "tonal", "capsule")
    for s in dd_style.STYLES:
        assert dd_style.normalize_style(s) == s
    assert dd_style.normalize_groups({}) == {}
    assert dd_style.normalize_groups({"settings": "text", "home": "field"}) == {"home": "field", "settings": "text"}
    for bad in BAD_STYLES:
        with pytest.raises(ValueError):
            dd_style.normalize_style(bad)
    for bad in BAD_GROUPS:
        with pytest.raises(ValueError):
            dd_style.normalize_groups(bad)


PROBES = [*dd_style.STYLES, " pill", "pill ", " tonal ", "pill\n", "\ttext", "PILL", "Pill", "pill,", "p", "auto|pill", ".*", ""]


def test_the_settings_route_and_the_validator_accept_exactly_the_same_strings(settings):
    """No silent trimming differences: what PATCH /settings accepts is what normalize_style accepts (and what /me/prefs accepts)."""
    c = TestClient(create_app(settings))
    c.get("/api/v1/me")
    for probe in PROBES:
        try:
            dd_style.normalize_style(probe)
            valid = True
        except ValueError:
            valid = False
        assert valid == (probe in dd_style.STYLES), repr(probe)
        r = c.patch("/api/v1/settings", json={"ui.dd_style": probe})
        assert (r.status_code == 200) == valid, (probe, r.status_code)
        if valid:
            assert c.get("/api/v1/settings").json()["settings"]["ui.dd_style"] == probe
        assert (c.put("/api/v1/me/prefs", json={"ui.dd_style": probe}).status_code == 200) == valid, probe


def test_stored_values_that_are_corrupt_read_as_the_defaults():
    assert dd_style.stored_style("nonsense") == "auto"
    assert dd_style.stored_groups("{not json") == {}
    assert dd_style.stored_groups('{"home":"pill","ghost":"pill"}') == {}


def test_installation_default_is_auto_round_trips_and_refuses_unknown_values(settings):
    with TestClient(create_app(settings)) as c:
        s = c.get("/api/v1/settings").json()["settings"]
        assert s["ui.dd_style"] == "auto" and s["ui.dd_style_groups"] == {}
        r = c.patch("/api/v1/settings", json={"ui.dd_style": "underline", "ui.dd_style_groups": {"security": "prefix", "area": "auto"}})
        assert r.status_code == 200, r.text
        s = c.get("/api/v1/settings").json()["settings"]
        assert s["ui.dd_style"] == "underline" and s["ui.dd_style_groups"] == {"area": "auto", "security": "prefix"}
        for bad in ("list", "", "PILL", 3):
            assert c.patch("/api/v1/settings", json={"ui.dd_style": bad}).status_code == 422, bad
        for bad in BAD_GROUPS:
            assert c.patch("/api/v1/settings", json={"ui.dd_style_groups": bad}).status_code == 422, bad
        s = c.get("/api/v1/settings").json()["settings"]
        assert s["ui.dd_style"] == "underline" and s["ui.dd_style_groups"] == {"area": "auto", "security": "prefix"}
        assert c.patch("/api/v1/settings", json={"ui.dd_style_groups": {}}).status_code == 200
        assert c.get("/api/v1/settings").json()["settings"]["ui.dd_style_groups"] == {}


def test_installation_default_needs_system_configure(settings):
    c = TestClient(create_app(settings))
    c.get("/api/v1/me")
    bind(c, settings, "dana", "viewer", "installation", "*")
    assert c.patch("/api/v1/settings", headers=as_user("dana"), json={"ui.dd_style": "pill"}).status_code == 403
    assert c.get("/api/v1/settings").json()["settings"]["ui.dd_style"] == "auto"


def test_user_preference_is_per_user_validated_and_clearable(settings):
    c = TestClient(create_app(settings))
    c.get("/api/v1/me")
    bind(c, settings, "dana", "viewer", "installation", "*")
    body = c.get("/api/v1/me/prefs").json()
    assert body["prefs"]["ui.dd_style"] is None and body["prefs"]["ui.dd_style_groups"] is None
    assert "ui.dd_style" not in body["stored"]
    r = c.put("/api/v1/me/prefs", json={"ui.dd_style": "tonal", "ui.dd_style_groups": {"multimedia": "text"}})
    assert r.status_code == 200, r.text
    assert r.json()["prefs"]["ui.dd_style"] == "tonal" and r.json()["prefs"]["ui.dd_style_groups"] == {"multimedia": "text"}
    assert {"ui.dd_style", "ui.dd_style_groups"} <= set(r.json()["stored"])
    assert "ui.dd_style" not in c.get("/api/v1/me/prefs", headers=as_user("dana")).json()["stored"]
    assert c.put("/api/v1/me/prefs", headers=as_user("dana"), json={"ui.dd_style": "field"}).status_code == 200
    assert c.get("/api/v1/me/prefs").json()["prefs"]["ui.dd_style"] == "tonal"
    for bad in ("list", "", "Pill", 7):
        assert c.put("/api/v1/me/prefs", json={"ui.dd_style": bad}).status_code == 422, bad
    for bad in BAD_GROUPS:
        assert c.put("/api/v1/me/prefs", json={"ui.dd_style_groups": bad}).status_code == 422, bad
    assert c.get("/api/v1/me/prefs").json()["prefs"]["ui.dd_style"] == "tonal"
    r = c.put("/api/v1/me/prefs", json={"ui.dd_style": None, "ui.dd_style_groups": None})
    assert r.status_code == 200 and not {"ui.dd_style", "ui.dd_style_groups"} & set(r.json()["stored"])


# ---- owner 2026-10-03: how a dropdown opens on a phone (`ui.dd_phone`: sheet | list) -------------------------------------------------

BAD_PHONE = ["", "Sheet", "LIST", " sheet", "list ", "pop", "auto", "bottom", 1, True, ["sheet"], {"a": 1}]


def test_phone_mode_validator_and_stored_reading():
    assert dd_style.PHONE_MODES == ("sheet", "list") and dd_style.DEFAULT_PHONE == "sheet"
    for m in dd_style.PHONE_MODES:
        assert dd_style.normalize_phone(m) == m
    for bad in BAD_PHONE:
        with pytest.raises(ValueError):
            dd_style.normalize_phone(bad)
    assert dd_style.stored_phone("nonsense") == "sheet" and dd_style.stored_phone(None) == "sheet" and dd_style.stored_phone("list") == "list"


def test_phone_installation_default_round_trips_and_refuses_unknown_values(settings):
    with TestClient(create_app(settings)) as c:
        assert c.get("/api/v1/settings").json()["settings"]["ui.dd_phone"] == "sheet"
        assert c.patch("/api/v1/settings", json={"ui.dd_phone": "list"}).status_code == 200
        assert c.get("/api/v1/settings").json()["settings"]["ui.dd_phone"] == "list"
        for bad in BAD_PHONE:
            assert c.patch("/api/v1/settings", json={"ui.dd_phone": bad}).status_code == 422, bad
        assert c.get("/api/v1/settings").json()["settings"]["ui.dd_phone"] == "list"
        assert c.patch("/api/v1/settings", json={"ui.dd_phone": "sheet"}).status_code == 200
        assert c.get("/api/v1/settings").json()["settings"]["ui.dd_phone"] == "sheet"


def test_phone_installation_default_needs_system_configure(settings):
    c = TestClient(create_app(settings))
    c.get("/api/v1/me")
    bind(c, settings, "dana", "viewer", "installation", "*")
    assert c.patch("/api/v1/settings", headers=as_user("dana"), json={"ui.dd_phone": "list"}).status_code == 403
    assert c.get("/api/v1/settings").json()["settings"]["ui.dd_phone"] == "sheet"


def test_phone_user_preference_is_per_user_validated_and_clearable(settings):
    c = TestClient(create_app(settings))
    c.get("/api/v1/me")
    bind(c, settings, "dana", "viewer", "installation", "*")
    body = c.get("/api/v1/me/prefs").json()
    assert body["prefs"]["ui.dd_phone"] is None and "ui.dd_phone" not in body["stored"]
    r = c.put("/api/v1/me/prefs", json={"ui.dd_phone": "list"})
    assert r.status_code == 200, r.text
    assert r.json()["prefs"]["ui.dd_phone"] == "list" and "ui.dd_phone" in r.json()["stored"]
    assert "ui.dd_phone" not in c.get("/api/v1/me/prefs", headers=as_user("dana")).json()["stored"]
    for bad in BAD_PHONE:
        assert c.put("/api/v1/me/prefs", json={"ui.dd_phone": bad}).status_code == 422, bad
    assert c.get("/api/v1/me/prefs").json()["prefs"]["ui.dd_phone"] == "list"
    r = c.put("/api/v1/me/prefs", json={"ui.dd_phone": None})
    assert r.status_code == 200 and "ui.dd_phone" not in r.json()["stored"] and r.json()["prefs"]["ui.dd_phone"] is None


def test_phone_a_database_without_the_key_needs_no_migration(settings):
    """A database written before this key existed has no row: the installation reads `sheet`, a user reads null (follow). No migration."""
    with TestClient(create_app(settings)) as c:
        assert c.get("/api/v1/settings").json()["settings"]["ui.dd_phone"] == "sheet"
        assert c.get("/api/v1/me/prefs").json()["prefs"]["ui.dd_phone"] is None


# ---- Unreleased (owner 2026-10-04): the SIZE of a dropdown (`ui.dd_size`: sm | md | lg, `ui.dd_size_groups`) and the `capsule` style ----

BAD_SIZES = ["", "SM", "Md", " md", "lg ", "small", "large", "xl", "auto", 1, True, ["md"], {"a": 1}]
BAD_SIZE_GROUPS = ["md", ["home"], {"nav": "md"}, {"home": "xl"}, {"home": 1}, {"home": None}, {"area": "lg", "bottom": "sm"}]


def test_the_capsule_style_is_accepted_everywhere(settings):
    assert "capsule" in dd_style.STYLES and dd_style.normalize_style("capsule") == "capsule"
    with TestClient(create_app(settings)) as c:
        assert c.patch("/api/v1/settings", json={"ui.dd_style": "capsule", "ui.dd_style_groups": {"home": "capsule", "settings": "pill"}}).status_code == 200
        s = c.get("/api/v1/settings").json()["settings"]
        assert s["ui.dd_style"] == "capsule" and s["ui.dd_style_groups"] == {"home": "capsule", "settings": "pill"}
        assert c.put("/api/v1/me/prefs", json={"ui.dd_style": "capsule"}).status_code == 200


def test_size_validator_and_stored_reading():
    assert dd_style.SIZES == ("sm", "md", "lg") and dd_style.DEFAULT_SIZE == "md"
    for s in dd_style.SIZES:
        assert dd_style.normalize_size(s) == s
    assert dd_style.normalize_size_groups({}) == {}
    assert dd_style.normalize_size_groups({"settings": "lg", "home": "sm"}) == {"home": "sm", "settings": "lg"}
    for bad in BAD_SIZES:
        with pytest.raises(ValueError):
            dd_style.normalize_size(bad)
    for bad in BAD_SIZE_GROUPS:
        with pytest.raises(ValueError):
            dd_style.normalize_size_groups(bad)
    assert dd_style.stored_size("nonsense") == "md" and dd_style.stored_size(None) == "md" and dd_style.stored_size("lg") == "lg"
    assert dd_style.stored_size_groups("{not json") == {}
    assert dd_style.stored_size_groups('{"home":"sm","ghost":"sm"}') == {}
    assert dd_style.stored_size_groups('{"home":"sm"}') == {"home": "sm"}


def test_the_settings_route_and_the_validator_accept_exactly_the_same_size_strings(settings):
    c = TestClient(create_app(settings))
    c.get("/api/v1/me")
    for probe in [*dd_style.SIZES, *BAD_SIZES, "sm\n", "md|lg", ".*"]:
        try:
            dd_style.normalize_size(probe)
            valid = True
        except ValueError:
            valid = False
        assert valid == (probe in dd_style.SIZES), repr(probe)
        assert (c.patch("/api/v1/settings", json={"ui.dd_size": probe}).status_code == 200) == valid, probe
        assert (c.put("/api/v1/me/prefs", json={"ui.dd_size": probe}).status_code == 200) == valid, probe


def test_size_installation_default_round_trips_and_refuses_unknown_values(settings):
    with TestClient(create_app(settings)) as c:
        s = c.get("/api/v1/settings").json()["settings"]
        assert s["ui.dd_size"] == "md" and s["ui.dd_size_groups"] == {}
        r = c.patch("/api/v1/settings", json={"ui.dd_size": "lg", "ui.dd_size_groups": {"security": "sm", "area": "md"}})
        assert r.status_code == 200, r.text
        s = c.get("/api/v1/settings").json()["settings"]
        assert s["ui.dd_size"] == "lg" and s["ui.dd_size_groups"] == {"area": "md", "security": "sm"}
        for bad in BAD_SIZES:
            assert c.patch("/api/v1/settings", json={"ui.dd_size": bad}).status_code == 422, bad
        for bad in BAD_SIZE_GROUPS:
            assert c.patch("/api/v1/settings", json={"ui.dd_size_groups": bad}).status_code == 422, bad
        s = c.get("/api/v1/settings").json()["settings"]
        assert s["ui.dd_size"] == "lg" and s["ui.dd_size_groups"] == {"area": "md", "security": "sm"}
        assert c.patch("/api/v1/settings", json={"ui.dd_size_groups": {}}).status_code == 200
        assert c.get("/api/v1/settings").json()["settings"]["ui.dd_size_groups"] == {}


def test_size_installation_default_needs_system_configure(settings):
    c = TestClient(create_app(settings))
    c.get("/api/v1/me")
    bind(c, settings, "dana", "viewer", "installation", "*")
    assert c.patch("/api/v1/settings", headers=as_user("dana"), json={"ui.dd_size": "lg"}).status_code == 403
    assert c.get("/api/v1/settings").json()["settings"]["ui.dd_size"] == "md"


def test_size_user_preference_is_per_user_validated_and_clearable(settings):
    c = TestClient(create_app(settings))
    c.get("/api/v1/me")
    bind(c, settings, "dana", "viewer", "installation", "*")
    body = c.get("/api/v1/me/prefs").json()
    assert body["prefs"]["ui.dd_size"] is None and body["prefs"]["ui.dd_size_groups"] is None
    assert "ui.dd_size" not in body["stored"]
    r = c.put("/api/v1/me/prefs", json={"ui.dd_size": "sm", "ui.dd_size_groups": {"multimedia": "lg"}})
    assert r.status_code == 200, r.text
    assert r.json()["prefs"]["ui.dd_size"] == "sm" and r.json()["prefs"]["ui.dd_size_groups"] == {"multimedia": "lg"}
    assert {"ui.dd_size", "ui.dd_size_groups"} <= set(r.json()["stored"])
    assert "ui.dd_size" not in c.get("/api/v1/me/prefs", headers=as_user("dana")).json()["stored"]
    for bad in BAD_SIZES:
        assert c.put("/api/v1/me/prefs", json={"ui.dd_size": bad}).status_code == 422, bad
    for bad in BAD_SIZE_GROUPS:
        assert c.put("/api/v1/me/prefs", json={"ui.dd_size_groups": bad}).status_code == 422, bad
    assert c.get("/api/v1/me/prefs").json()["prefs"]["ui.dd_size"] == "sm"
    r = c.put("/api/v1/me/prefs", json={"ui.dd_size": None, "ui.dd_size_groups": None})
    assert r.status_code == 200 and not {"ui.dd_size", "ui.dd_size_groups"} & set(r.json()["stored"])


def test_size_a_database_without_the_key_needs_no_migration(settings):
    """A database written before these keys existed has no row: the installation reads `md`, a user reads null (follow). No migration."""
    with TestClient(create_app(settings)) as c:
        s = c.get("/api/v1/settings").json()["settings"]
        assert s["ui.dd_size"] == "md" and s["ui.dd_size_groups"] == {}
        assert c.get("/api/v1/me/prefs").json()["prefs"]["ui.dd_size"] is None



BAD_RINGS = ["", "2.0", "01", " 2", 2, 1.5, True, ["2"], "1|3", ".*", "2\n"]
BAD_PANELS = ["", "Button", "320", 240, True, ["240"], "240\n", ".*", "button|300"]
RING_PANEL = {
    "ring": (dd_style.RINGS, "2", dd_style.normalize_ring, dd_style.normalize_ring_groups, dd_style.stored_ring, dd_style.stored_ring_groups, BAD_RINGS),
    "panel": (dd_style.PANELS, "240", dd_style.normalize_panel, dd_style.normalize_panel_groups, dd_style.stored_panel, dd_style.stored_panel_groups, BAD_PANELS),
}


@pytest.mark.parametrize("kind", ["ring", "panel"])
def test_ring_and_panel_validators_and_stored_reading(kind):
    allowed, default, norm, norm_groups, stored, stored_groups, bad_values = RING_PANEL[kind]
    for v in allowed:
        assert norm(v) == v
    assert norm_groups({}) == {}
    assert norm_groups({"settings": allowed[-1], "home": allowed[0]}) == {"home": allowed[0], "settings": allowed[-1]}
    for bad in bad_values:
        with pytest.raises(ValueError):
            norm(bad)
    for bad in [allowed[0], ["home"], {"nav": allowed[0]}, {"home": "huge"}, {"home": 1}, {"home": None}]:
        with pytest.raises(ValueError):
            norm_groups(bad)
    assert stored("nonsense") == default and stored(None) == default and stored(allowed[0]) == allowed[0]
    assert stored_groups("{not json") == {}
    assert stored_groups('{"home":"%s","ghost":"%s"}' % (allowed[0], allowed[0])) == {}
    assert stored_groups('{"home":"%s"}' % allowed[0]) == {"home": allowed[0]}
    assert dd_style.DEFAULT_RING == "2" and dd_style.DEFAULT_PANEL == "240"


@pytest.mark.parametrize("kind", ["ring", "panel"])
def test_ring_and_panel_settings_route_and_prefs_accept_exactly_the_validator_strings(settings, kind):
    allowed, default, norm, norm_groups, stored, stored_groups, bad_values = RING_PANEL[kind]
    key = f"ui.dd_{kind}"
    c = TestClient(create_app(settings))
    c.get("/api/v1/me")
    for probe in [*allowed, *bad_values]:
        try:
            norm(probe)
            valid = True
        except ValueError:
            valid = False
        assert valid == (isinstance(probe, str) and probe in allowed), repr(probe)
        assert (c.patch("/api/v1/settings", json={key: probe}).status_code == 200) == valid, probe
        assert (c.put("/api/v1/me/prefs", json={key: probe}).status_code == 200) == valid, probe


@pytest.mark.parametrize("kind", ["ring", "panel"])
def test_ring_and_panel_installation_default_round_trips_and_refuses_unknown_values(settings, kind):
    allowed, default, norm, norm_groups, stored, stored_groups, bad_values = RING_PANEL[kind]
    key = f"ui.dd_{kind}"
    with TestClient(create_app(settings)) as c:
        s = c.get("/api/v1/settings").json()["settings"]
        assert s[key] == default and s[key + "_groups"] == {}
        r = c.patch("/api/v1/settings", json={key: allowed[-1], key + "_groups": {"security": allowed[0], "area": default}})
        assert r.status_code == 200, r.text
        s = c.get("/api/v1/settings").json()["settings"]
        assert s[key] == allowed[-1] and s[key + "_groups"] == {"area": default, "security": allowed[0]}
        for bad in bad_values:
            assert c.patch("/api/v1/settings", json={key: bad}).status_code == 422, bad
        for bad in [allowed[0], {"nav": allowed[0]}, {"home": "huge"}, {"home": 1}]:
            assert c.patch("/api/v1/settings", json={key + "_groups": bad}).status_code == 422, bad
        s = c.get("/api/v1/settings").json()["settings"]
        assert s[key] == allowed[-1] and s[key + "_groups"] == {"area": default, "security": allowed[0]}
        assert c.patch("/api/v1/settings", json={key + "_groups": {}}).status_code == 200
        assert c.get("/api/v1/settings").json()["settings"][key + "_groups"] == {}


@pytest.mark.parametrize("kind", ["ring", "panel"])
def test_ring_and_panel_need_system_configure_and_user_pref_is_per_user_and_clearable(settings, kind):
    allowed, default, norm, norm_groups, stored, stored_groups, bad_values = RING_PANEL[kind]
    key = f"ui.dd_{kind}"
    c = TestClient(create_app(settings))
    c.get("/api/v1/me")
    bind(c, settings, "dana", "viewer", "installation", "*")
    assert c.patch("/api/v1/settings", headers=as_user("dana"), json={key: allowed[0]}).status_code == 403
    assert c.get("/api/v1/settings").json()["settings"][key] == default
    body = c.get("/api/v1/me/prefs").json()
    assert body["prefs"][key] is None and body["prefs"][key + "_groups"] is None and key not in body["stored"]
    r = c.put("/api/v1/me/prefs", json={key: allowed[0], key + "_groups": {"multimedia": allowed[-1]}})
    assert r.status_code == 200, r.text
    assert r.json()["prefs"][key] == allowed[0] and r.json()["prefs"][key + "_groups"] == {"multimedia": allowed[-1]}
    assert key not in c.get("/api/v1/me/prefs", headers=as_user("dana")).json()["stored"]
    for bad in bad_values:
        assert c.put("/api/v1/me/prefs", json={key: bad}).status_code == 422, bad
    assert c.put("/api/v1/me/prefs", json={key + "_groups": {"ghost": allowed[0]}}).status_code == 422
    assert c.get("/api/v1/me/prefs").json()["prefs"][key] == allowed[0]
    r = c.put("/api/v1/me/prefs", json={key: None, key + "_groups": None})
    assert r.status_code == 200 and not {key, key + "_groups"} & set(r.json()["stored"])
