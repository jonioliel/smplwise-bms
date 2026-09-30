"""Owner request 2026-09-30 (the area layout editor's card library): layout schema v 3 - custom cards (`card:c-<id>` with
`custom` = {type, entities}) and deleted built-in cards (`removed`). Validated by the server, older layouts unchanged,
tiles allowed on a custom card, "העתק לכל האזורים" keeps only the built-in cards. Permission is unchanged (system.configure,
checked before the body - tests/test_device_layouts.py)."""
from __future__ import annotations

import re
from pathlib import Path

from fastapi.testclient import TestClient
from test_devices import dev_app  # noqa: F401 - the HA structure fixture (floors, areas, entities)

from smplwise.routers import device_layouts as mod

ROOT = Path(__file__).resolve().parents[3]
URL = "/api/v1/devices/layouts"


def _put(c, scope, sid, variant, revision, layout, headers=None):
    return c.put(f"{URL}/{scope}/{sid}", json={"variant": variant, "revision": revision, "layout": layout}, headers=headers)


def _v3(**items) -> dict:
    base = {"card:lighting": {"x": 0, "y": 0, "w": 6, "h": 30}}
    return {"v": 3, "cols": 12, "items": {**base, **items}}


def _custom(x, y, w, h, type_="sensors", entities=(), **over) -> dict:
    return {"x": x, "y": y, "w": w, "h": h, "custom": {"type": type_, "entities": list(entities)}, **over}


def test_custom_cards_and_removed_cards_round_trip_and_older_layouts_stay_unchanged(dev_app):  # noqa: F811
    app, _ = dev_app
    c = TestClient(app)
    layout = _v3(**{
        "card:c-abc12345": _custom(6, 0, 6, 20, "sensors", ["sensor.lobby_temp", "binary_sensor.front_contact", "sensor.lobby_temp"], title="חיישני כניסה", bg="warm"),
        "card:c-zz99yy88": _custom(0, 32, 12, 10, "free", []),
        "card:climate": {"x": 0, "y": 44, "w": 12, "h": 6, "removed": True},
    })
    r = _put(c, "area", "lobby", "desktop", 0, layout)
    assert r.status_code == 200, r.text
    got = r.json()["desktop"]["layout"]
    assert got["v"] == 3
    assert got["items"]["card:c-abc12345"]["custom"] == {"type": "sensors", "entities": ["binary_sensor.front_contact", "sensor.lobby_temp"]}  # sorted, deduplicated
    assert got["items"]["card:c-abc12345"]["title"] == "חיישני כניסה"
    assert got["items"]["card:climate"]["removed"] is True
    # a built-in item without the v 3 fields stores none of them
    assert "custom" not in got["items"]["card:lighting"] and "removed" not in got["items"]["card:lighting"]
    # a v 1 layout still saves exactly as before: none of the new keys appear
    v1 = {"v": 1, "cols": 12, "items": {"card:climate": {"x": 8, "y": 0, "w": 4, "h": 20}}}
    r1 = _put(c, "area", "office", "desktop", 0, v1)
    assert r1.status_code == 200 and all("custom" not in it and "removed" not in it for it in r1.json()["desktop"]["layout"]["items"].values())
    # everyone who reads the screens reads the cards (the viewer sees the same layout)
    assert c.get(f"{URL}/area/lobby").json()["desktop"]["layout"]["items"]["card:c-zz99yy88"]["custom"]["type"] == "free"


def test_custom_card_validation(dev_app):  # noqa: F811
    app, _ = dev_app
    c = TestClient(app)
    ok = _custom(6, 0, 6, 20, "media", ["media_player.lobby_tv"])
    cases = {
        "needs v 3": {"v": 2, "cols": 12, "items": {"card:c-abc12345": ok}},
        "unknown type": _v3(**{"card:c-abc12345": _custom(6, 0, 6, 20, "toaster")}),
        "bad entity id": _v3(**{"card:c-abc12345": _custom(6, 0, 6, 20, "media", ["not an id"])}),
        "custom key without custom": _v3(**{"card:c-abc12345": {"x": 6, "y": 0, "w": 6, "h": 20}}),
        "custom on a built-in key": _v3(**{"card:sensors": _custom(6, 0, 6, 20)}),
        "a removed custom card": _v3(**{"card:c-abc12345": {"x": 6, "y": 0, "w": 6, "h": 20, "removed": True, "custom": {"type": "free", "entities": []}}}),
        "a bad key": _v3(**{"card:c-A": ok}),
        "removed needs v 3": {"v": 2, "cols": 12, "items": {"card:climate": {"x": 0, "y": 0, "w": 4, "h": 4, "removed": True}}},
        "removed on an unknown key": _v3(**{"card:nothing": {"x": 6, "y": 0, "w": 6, "h": 20, "removed": True}}),
    }
    for name, layout in cases.items():
        assert _put(c, "area", "lobby", "desktop", 0, layout).status_code == 422, name
    too_many = _v3(**{f"card:c-abcd{n:04d}": _custom(0, 40 + n * 12, 12, 10) for n in range(mod.MAX_CUSTOM_CARDS + 1)})
    assert _put(c, "area", "lobby", "desktop", 0, too_many).status_code == 422
    # the building screen never takes them
    assert _put(c, "building", "main", "desktop", 0, {"v": 3, "cols": 12, "items": {"card:c-abc12345": ok}}).status_code == 422
    # several cards of one type, each with its own devices, are fine; a deleted card leaves no slot behind
    two = _v3(**{
        "card:c-aaaaaa11": _custom(6, 0, 6, 10, "sensors", ["sensor.lobby_temp"]),
        "card:c-bbbbbb22": _custom(0, 32, 6, 10, "sensors", ["sensor.lobby_rssi"]),
        "card:sensors": {"x": 0, "y": 0, "w": 6, "h": 30, "removed": True},
    })
    assert _put(c, "area", "lobby", "desktop", 0, two).status_code == 200
    overlap = _v3(**{"card:c-aaaaaa11": _custom(0, 0, 6, 10, "sensors")})  # the same slot as the lighting card
    assert _put(c, "area", "lobby", "desktop", 1, overlap).status_code == 422


def test_tiles_on_a_custom_card_and_copy_to_all_areas_keeps_only_the_built_in_cards(dev_app):  # noqa: F811
    app, _ = dev_app
    c = TestClient(app)
    tile = {"order": 0, "span": 2, "size": "m", "hidden": False, "title": None}
    layout = _v3(**{
        "card:c-abc12345": {**_custom(6, 0, 6, 20, "sensors", ["sensor.lobby_temp"]), "tiles": {"sensor.lobby_temp": tile}},
        "card:climate": {"x": 0, "y": 32, "w": 12, "h": 6, "removed": True},
    })
    assert _put(c, "area", "lobby", "desktop", 0, layout).status_code == 200
    bad = _v3(**{"card:c-abc12345": {**_custom(6, 0, 6, 20, "sensors"), "tiles": {"sensor.lobby_temp": {**tile, "span": 3}}}})
    assert _put(c, "area", "office", "desktop", 0, bad).status_code == 422  # beyond the card's two tile columns
    r = c.post(f"{URL}/area/lobby/copy-to-all-areas", json={"revision": 1})
    assert r.status_code == 200, r.text
    other = c.get(f"{URL}/area/office").json()["desktop"]["layout"]
    assert "card:c-abc12345" not in other["items"]  # a custom card lists THIS area's devices: it stays here
    assert other["items"]["card:climate"]["removed"] is True and other["items"]["card:lighting"]["w"] == 6
    assert "card:c-abc12345" in c.get(f"{URL}/area/lobby").json()["desktop"]["layout"]["items"]


def test_a_viewer_cannot_write_custom_cards(dev_app):  # noqa: F811
    from conftest import as_user, bind

    app, s = dev_app
    c = TestClient(app)
    bind(c, s, "vera", "viewer", "installation", "*")
    r = _put(c, "area", "lobby", "desktop", 0, _v3(**{"card:c-abc12345": _custom(6, 0, 6, 20)}), headers=as_user("vera"))
    assert r.status_code == 403
    assert c.get(f"{URL}/area/lobby").json()["desktop"] is None


def test_card_types_match_the_frontend_library():
    src = (ROOT / "frontend" / "src" / "screens" / "devices-layout-cards.ts").read_text(encoding="utf-8")
    m = re.search(r"export const CARD_TYPE_IDS = \[([^\]]*)\]", src)
    assert m, "CARD_TYPE_IDS not found in devices-layout-cards.ts"
    assert tuple(re.findall(r"'([a-z]+)'", m.group(1))) == mod.CUSTOM_TYPES
    assert re.search(rf"export const CARDS_VERSION = {mod.CARDS_VERSION};", src)
