"""CR-015: every route of the multimedia API against its permission and scope (MEDIA_API.md section 3): status, list, detail, profiles, the
remote configuration, artwork, the administration, the personal layout, the feature switch, the catalogue of permissions and the migrations
on a 0.1.148 database. (Commands: test_media_commands.py; layout: test_media_layout.py; bulk: test_media_bulk.py.)"""
from __future__ import annotations

import json
import shutil
from typing import Any

import media_seed as seed
import pytest
from conftest import as_user, bind, png_bytes, seed_tree
from fastapi.testclient import TestClient

from smplwise import db as dbmod
from smplwise.main import create_app
from smplwise.rbac import ROLES
from smplwise.routers.access import PERMISSION_LABELS, SENSITIVE
from smplwise.services import ha_client, media_layout

ITEM_KEYS = {"key", "name", "kind", "profile", "floor_id", "floor_name", "area_id", "area_name", "public", "live", "caps", "audio_link", "can"}
LIVE_KEYS = {"power", "play", "confirmed", "since", "now", "volume", "sound_output"}
NOW_KEYS = {"kind", "label", "app_id", "source_id", "title", "channel", "position_s", "duration_s", "position_at", "artwork", "glyph", "hue"}
CAPS_KEYS = {"power_on", "power_on_reason", "power_off", "volume_set", "volume_step", "mute", "sources", "apps", "sound_outputs", "transport", "keys", "text", "touchpad", "art_mode"}


@pytest.fixture()
def m(settings, monkeypatch):
    app = create_app(settings)
    c = TestClient(app)
    seed.install(c)
    seed.approve_all(c)
    calls = seed.pair(c, monkeypatch)
    keys = {n: seed.key_of(c, e) for n, e in {"samsung": "media_player.tv_living", "kitchen": "media_player.tv_kitchen", "lg": "media_player.lg_office", "lg_off": "media_player.lg_storage",
                                               "android": "media_player.tv_bedroom", "generic": "media_player.generic_tv"}.items()}
    return app, c, calls, keys, settings


def role(c, settings, name: str, role_id: str, scope=("installation", "*")) -> dict[str, str]:
    bind(c, settings, name, role_id, scope[0], scope[1])
    return as_user(name)


# ------------------------------------------------------------------------------------------------ status, list, detail


def test_status_shape_counts_and_what_the_caller_may_do(m):
    app, c, calls, keys, settings = m
    s = c.get("/api/v1/multimedia/status").json()
    assert s["enabled"] is True and s["bridge"] == {"paired": True, "version": "0.4.0", "media_ready": True, "players_ready": False} and s["profiles_version"] == 1
    assert s["can"] == {"read": True, "control": True, "power": True, "public": True, "bulk": True, "layout": True, "group": True, "queue": True, "browse": True, "configure": True, "personalize": True}
    assert s["counts"] == {"screens": 6, "on": 4, "pending_approval": 0, "players": 0, "playing": 0, "groups": 0, "unplaced": 0, "suggestions": 0}, "samsung, lg, android, generic on; the kitchen is off and the second LG unavailable"
    assert s["floors"] is True and s["library"] == {"provider": "ma", "state": "ready"}, "CR-016: the seed has a Music Assistant copy of the living-room TV"
    viewer = role(c, settings, "vera", "viewer")
    v = c.get("/api/v1/multimedia/status", headers=viewer).json()
    assert v["can"] == {"read": True, "control": False, "power": False, "public": False, "bulk": False, "layout": False, "group": False, "queue": False, "browse": False, "configure": False, "personalize": False}
    assert v["counts"] == {"screens": 6, "on": 4, "pending_approval": None, "players": 0, "playing": 0, "groups": 0, "unplaced": 0, "suggestions": None}, "the pending number is for system.configure only"
    nobody = c.get("/api/v1/multimedia/status", headers=as_user("nobody")).json()
    assert nobody["can"]["read"] is False and nobody["counts"]["screens"] == 0 and nobody["enabled"] is True


def test_list_shape_sorting_filters_and_no_private_fields(m):
    app, c, calls, keys, settings = m
    devices = c.get("/api/v1/multimedia/devices").json()["devices"]
    assert len(devices) == 6 and [d["name"] for d in devices] == sorted((d["name"] for d in devices), key=str.casefold)
    for d in devices:
        assert set(d) == ITEM_KEYS and set(d["live"]) == LIVE_KEYS and set(d["live"]["now"]) == NOW_KEYS and set(d["caps"]) == CAPS_KEYS
        assert d["kind"] == "screen" and len(d["key"]) == 32 and set(d["can"]) == {"control", "power", "public_ok", "bulk"}
    by = {d["key"]: d for d in devices}
    sam = by[keys["samsung"]]
    assert (sam["name"], sam["profile"], sam["area_id"], sam["area_name"], sam["floor_id"], sam["floor_name"]) == ("טלוויזיה סלון", "samsung_smart", "living", "סלון", "ground", "קומת קרקע")
    assert sam["live"]["power"] == "on" and sam["live"]["play"] == "playing" and sam["live"]["now"]["label"] == "Netflix" and sam["live"]["now"]["glyph"] == "film"
    assert sam["live"]["volume"] == {"level": 30, "muted": False, "target": "screen", "step_only": False}
    assert by[keys["kitchen"]]["live"]["power"] == "off" and by[keys["lg_off"]]["live"]["power"] == "unavailable" and by[keys["lg_off"]]["live"]["since"]
    assert {d["area_id"] for d in c.get("/api/v1/multimedia/devices?floor=upper").json()["devices"]} == {"office", "bedroom"}
    assert [d["key"] for d in c.get("/api/v1/multimedia/devices?area=kitchen").json()["devices"]] == sorted([keys["kitchen"], keys["generic"]], key=lambda k: by[k]["name"].casefold())
    assert [d["key"] for d in c.get("/api/v1/multimedia/devices?q=סלון").json()["devices"]] == [keys["samsung"]]
    assert {d["key"] for d in c.get("/api/v1/multimedia/devices?q=חדר עבודה").json()["devices"]} == {keys["lg"], keys["lg_off"]}, "the area name matches too"
    assert c.get("/api/v1/multimedia/devices?kind=receiver").json() == {"devices": []}, "0.1.149 lists screens only"
    assert c.get("/api/v1/multimedia/devices?kind=tablet").status_code == 422


def test_can_flags_follow_the_callers_permissions_per_device(m):
    app, c, calls, keys, settings = m
    assert c.put(f"/api/v1/multimedia/admin/devices/{keys['kitchen']}", json={"public": True}).status_code == 200
    by = lambda h: {d["key"]: d["can"] for d in c.get("/api/v1/multimedia/devices", headers=h).json()["devices"]}  # noqa: E731
    assert by({})[keys["kitchen"]] == {"control": True, "power": True, "public_ok": True, "bulk": True}
    viewer = by(role(c, settings, "vera", "viewer"))
    assert viewer[keys["samsung"]] == {"control": False, "power": False, "public_ok": True, "bulk": False}
    assert viewer[keys["kitchen"]]["public_ok"] is False, "a public screen: the caller lacks media.public"
    operator = by(role(c, settings, "olga", "operator"))
    assert operator[keys["samsung"]] == {"control": True, "power": True, "public_ok": True, "bulk": False} and operator[keys["kitchen"]]["public_ok"] is False


def test_no_media_read_anywhere_is_an_audited_403_and_an_unapproved_device_is_404(m):
    app, c, calls, keys, settings = m
    for url in ("/api/v1/multimedia/devices", f"/api/v1/multimedia/devices/{keys['samsung']}", "/api/v1/multimedia/layout", "/api/v1/multimedia/profiles", "/api/v1/multimedia/remote-default"):
        r = c.get(url, headers=as_user("nobody"))
        assert (r.status_code, r.json()["code"]) == (403, "forbidden"), url
    kiosk = role(c, settings, "kay", "kiosk")
    assert c.get("/api/v1/multimedia/devices", headers=kiosk).status_code == 403, "kiosk holds no media.read"
    with app.state.db.connection(mode="read") as conn:
        denied = conn.execute("SELECT COUNT(*) FROM audit_log WHERE action = 'media.read' AND decision = 'denied'").fetchone()[0]
    assert denied >= 6
    assert c.get("/api/v1/multimedia/devices/" + "f" * 32).status_code == 404
    assert c.put(f"/api/v1/multimedia/admin/devices/{keys['generic']}", json={"approved": False}).status_code == 200
    r = c.get(f"/api/v1/multimedia/devices/{keys['generic']}")
    assert (r.status_code, r.json()["code"]) == (404, "not_found"), "an unapproved device is invisible to everyone but the administration"
    assert keys["generic"] not in {d["key"] for d in c.get("/api/v1/multimedia/devices").json()["devices"]}


def test_a_floor_scoped_viewer_sees_only_screens_anchored_on_their_floors(m):
    app, c, calls, keys, settings = m
    ids = seed_tree(c)
    for fid in (ids["floor2"], ids["floor3"]):
        asset = c.post(f"/api/v1/floors/{fid}/plan-assets", files={"file": ("p.png", png_bytes(), "image/png")}).json()
        v = c.post(f"/api/v1/floors/{fid}/plan-versions", json={"asset_id": asset["id"]}).json()
        c.post(f"/api/v1/plan-versions/{v['id']}/publish")
    place = lambda fid, eid: c.post(f"/api/v1/floors/{fid}/anchors", json={"resource_type": "ha_entity", "resource_id": eid, "x": 0.2, "y": 0.2}).status_code  # noqa: E731
    assert place(ids["floor2"], "media_player.tv_living") == 201 and place(ids["floor3"], "media_player.lg_office") == 201
    # the HA area / floor names are not a scope: media_player.tv_kitchen is in the HA "ground" floor but is placed nowhere
    ron = role(c, settings, "ron", "operator", ("floor", ids["floor2"]))
    seen = c.get("/api/v1/multimedia/devices", headers=ron).json()["devices"]
    assert [d["key"] for d in seen] == [keys["samsung"]]
    assert c.get(f"/api/v1/multimedia/devices/{keys['samsung']}", headers=ron).status_code == 200
    for other in ("lg", "kitchen"):
        assert c.get(f"/api/v1/multimedia/devices/{keys[other]}", headers=ron).status_code == 404, other
        assert seed.send(c, keys[other], "key", headers=ron, key="up").status_code == 404
    assert seed.send(c, keys["samsung"], "key", headers=ron, key="up").status_code == 202
    assert c.get("/api/v1/multimedia/status", headers=ron).json()["counts"]["screens"] == 1
    assert c.put(f"/api/v1/multimedia/devices/{keys['samsung']}/remote", json={"remote": None}, headers=ron).status_code == 403


def test_detail_carries_sources_apps_recent_remote_and_model_keys(m):
    app, c, calls, keys, settings = m
    d = c.get(f"/api/v1/multimedia/devices/{keys['samsung']}").json()
    assert set(d) == ITEM_KEYS | {"sources", "apps", "recent", "remote", "model_keys"}
    assert [s["id"] for s in d["sources"]] == ["TV", "HDMI1", "HDMI2"] and [a["id"] for a in d["apps"]] == ["Netflix", "YouTube", "ספורט"]
    assert d["sources"][0] == {"id": "TV", "label": "טלוויזיה", "kind": "source", "glyph": "antenna", "hue": None}
    assert d["apps"][0]["kind"] == "app" and d["apps"][0]["glyph"] == "film" and d["apps"][0]["hue"] == 265
    assert d["recent"] == [] and d["model_keys"] == []
    assert d["remote"] == {"sections": [{"id": s, "on": s != "touch"} for s in media_layout.REMOTE_SECTIONS], "more": ["nums", "colors", "text", "xtra"], "scope": "default"}
    android = c.get(f"/api/v1/multimedia/devices/{keys['android']}").json()
    assert android["sources"] == [] and [a["id"] for a in android["apps"]] == seed.ACTIVITIES and android["caps"]["sources"] is False


def test_profiles_route(m):
    app, c, *_ = m
    body = c.get("/api/v1/multimedia/profiles").json()
    assert body["version"] == 1 and [p["id"] for p in body["profiles"]] == ["samsung_smart", "lg_webos", "android_tv", "generic"]
    assert body["profiles"][3]["keys"] == [] and "up" in body["profiles"][0]["keys"]


def test_feature_switch_hides_everything_but_the_status_and_the_administration(m):
    app, c, calls, keys, settings = m
    assert c.patch("/api/v1/settings", json={"multimedia.enabled": "false"}).status_code == 200
    assert c.get("/api/v1/settings").json()["settings"]["multimedia.enabled"] == "false"
    for method, url in (("get", "/api/v1/multimedia/devices"), ("get", f"/api/v1/multimedia/devices/{keys['samsung']}"), ("get", "/api/v1/multimedia/layout"), ("get", "/api/v1/multimedia/profiles"),
                        ("get", "/api/v1/multimedia/remote-default"), ("get", "/api/v1/multimedia/actions/preview?scope=floor&id=ground")):
        r = getattr(c, method)(url)
        assert (r.status_code, r.json()["code"]) == (404, "feature_disabled"), url
    assert seed.send(c, keys["samsung"], "key", key="up").status_code == 404
    assert c.put("/api/v1/multimedia/layout", json={"layout": {}, "base_revision": 0}).json()["code"] == "feature_disabled"
    st = c.get("/api/v1/multimedia/status").json()
    assert st["enabled"] is False and st["counts"]["screens"] == 0
    assert c.get("/api/v1/multimedia/admin/devices").status_code == 200
    assert c.post("/api/v1/multimedia/admin/approve", json={}).status_code == 200
    c.patch("/api/v1/settings", json={"multimedia.enabled": "true"})
    assert c.get("/api/v1/multimedia/devices").status_code == 200


# ------------------------------------------------------------------------------------------------ remote configuration


def sections(on: dict[str, bool] | None = None, order: list[str] | None = None) -> list[dict[str, Any]]:
    ids = order or list(media_layout.REMOTE_SECTIONS)
    return [{"id": s, "on": (on or {}).get(s, s != "touch")} for s in ids]


def test_the_installation_default_remote_and_the_per_screen_override(m):
    app, c, calls, keys, settings = m
    new = {"sections": sections({"ch": False, "touch": True}, ["nav", "recent", "dpad", "touch", "vol", "ch", "pbk", "nums", "colors", "text", "xtra"]), "more": ["colors", "text", "nums"]}
    r = c.put("/api/v1/multimedia/remote-default", json=new)
    assert r.status_code == 200 and r.json() == {**new, "scope": "default"}
    assert c.get("/api/v1/multimedia/remote-default").json() == {**new, "scope": "default"}
    assert c.get("/api/v1/settings").json()["settings"]["multimedia.remote_default"] == new
    d = c.get(f"/api/v1/multimedia/devices/{keys['samsung']}").json()
    assert d["remote"] == {**new, "scope": "default"}
    # a per-screen override wins, and null returns the screen to the default
    own = {"sections": sections(order=["dpad", "nav", "recent", "vol", "ch", "pbk", "nums", "colors", "text", "xtra", "touch"]), "more": []}
    r = c.put(f"/api/v1/multimedia/devices/{keys['samsung']}/remote", json={"remote": own})
    assert r.status_code == 200 and r.json()["remote"] == {**own, "scope": "device"} and r.json()["key"] == keys["samsung"]
    assert c.get(f"/api/v1/multimedia/devices/{keys['kitchen']}").json()["remote"]["scope"] == "default"
    assert c.put(f"/api/v1/multimedia/devices/{keys['samsung']}/remote", json={"remote": None}).json()["remote"]["scope"] == "default"
    rows = [json.loads(r["details_json"]) for r in audit(app, "media.remote.update")]
    assert {"scope": "default"} in rows and any(x.get("scope") == "device" for x in rows)


def audit(app, action: str) -> list[dict[str, Any]]:
    with app.state.db.connection(mode="read") as conn:
        return [dict(r) for r in conn.execute("SELECT * FROM audit_log WHERE action = ? ORDER BY id", (action,)).fetchall()]


@pytest.mark.parametrize("bad", [
    {"sections": sections()[:10], "more": []},  # a section missing
    {"sections": sections() + [{"id": "nav", "on": True}], "more": []},  # twice
    {"sections": [*sections()[:10], {"id": "nope", "on": True}], "more": []},
    {"sections": sections(), "more": ["nums", "elsewhere"]},
    {"sections": [{"id": s, "on": "yes"} for s in media_layout.REMOTE_SECTIONS], "more": []},
    {"sections": sections()},
    {"sections": sections(), "more": [], "scope": "device"},
])
def test_the_remote_default_is_validated_in_full(m, bad):
    app, c, *_ = m
    assert c.put("/api/v1/multimedia/remote-default", json=bad).status_code == 422
    assert c.get("/api/v1/multimedia/remote-default").json()["scope"] == "default"


def test_remote_editing_needs_media_layout(m):
    app, c, calls, keys, settings = m
    operator = role(c, settings, "olga", "operator")
    assert c.put("/api/v1/multimedia/remote-default", json={"sections": sections(), "more": []}, headers=operator).status_code == 403
    r = c.put(f"/api/v1/multimedia/devices/{keys['samsung']}/remote", json={"remote": None}, headers=operator)
    assert (r.status_code, r.json()["code"]) == (403, "forbidden")
    assert c.get("/api/v1/multimedia/remote-default", headers=operator).status_code == 200
    site = role(c, settings, "sam", "site_admin")
    assert c.put(f"/api/v1/multimedia/devices/{keys['samsung']}/remote", json={"remote": None}, headers=site).status_code == 200
    assert c.put("/api/v1/multimedia/remote-default", json={"sections": sections(), "more": ["text"]}, headers=site).status_code == 200
    assert c.put(f"/api/v1/multimedia/devices/{'e' * 32}/remote", json={"remote": None}).status_code == 404


def test_source_and_app_curation_order_hide_rename_and_kind(m):
    app, c, calls, keys, settings = m
    body = {"remote": None,
            "sources": [{"id": "HDMI2", "label": "HDMI 2 · ממיר", "hidden": False, "kind": "source", "glyph": "gamepad"}, {"id": "TV", "label": None, "hidden": False}, {"id": "HDMI1", "label": None, "hidden": True},
                        {"id": "ספורט", "label": "ספורט חי", "hidden": False, "kind": "app", "glyph": None}],
            "apps": [{"id": "YouTube", "label": "יוטיוב", "hidden": False, "glyph": "playRect"}, {"id": "Netflix", "label": None, "hidden": True, "glyph": None}]}
    r = c.put(f"/api/v1/multimedia/devices/{keys['samsung']}/remote", json=body)
    assert r.status_code == 200, r.text
    d = r.json()
    assert [s["id"] for s in d["sources"]] == ["HDMI2", "TV"] and d["sources"][0]["label"] == "HDMI 2 · ממיר" and d["sources"][0]["glyph"] == "gamepad", "hidden items are omitted for everyone"
    assert [a["id"] for a in d["apps"]] == ["YouTube", "ספורט"] and d["apps"][0]["label"] == "יוטיוב" and d["apps"][1]["label"] == "ספורט חי", "moved from the sources to the apps"
    assert d["caps"]["sources"] is True
    for bad in ({"sources": [{"id": "x", "label": "y" * 41, "hidden": False}]}, {"sources": [{"id": "x", "hidden": False, "glyph": "logo"}]}, {"sources": [{"id": "x", "hidden": False, "kind": "brand"}]},
                {"sources": [{"id": "x", "hidden": False}, {"id": "x", "hidden": True}]}, {"apps": [{"id": "x", "hidden": False, "kind": "source"}]}, {"sources": [{"hidden": False}]},
                {"sources": [{"id": "x", "hidden": False, "url": "http://x"}]}):
        assert c.put(f"/api/v1/multimedia/devices/{keys['samsung']}/remote", json={"remote": None, **bad}).status_code == 422, bad
    assert c.put(f"/api/v1/multimedia/devices/{keys['samsung']}/remote", json={"remote": None, "surprise": 1}).status_code == 422


def test_the_curation_read_shows_hidden_items_and_default_names_only_to_media_layout(m):
    """The remote editor needs the hidden items and each item's own name: without them a re-save would un-hide everything and drop
    the custom names. `?curation=1` is honoured for media.layout only; everyone else gets the ordinary detail."""
    app, c, calls, keys, settings = m
    body = {"remote": None,
            "sources": [{"id": "HDMI1", "label": "ממיר", "hidden": False, "kind": "source"}, {"id": "HDMI2", "label": None, "hidden": True, "kind": "source"}],
            "apps": [{"id": "Netflix", "label": None, "hidden": True}]}
    assert c.put(f"/api/v1/multimedia/devices/{keys['samsung']}/remote", json=body).status_code == 200
    url = f"/api/v1/multimedia/devices/{keys['samsung']}"
    plain = c.get(url).json()
    assert "HDMI2" not in [s["id"] for s in plain["sources"]] and "Netflix" not in [a["id"] for a in plain["apps"]], "hidden items are omitted for everyone"
    assert all("hidden" not in s and "default_label" not in s for s in plain["sources"] + plain["apps"])
    full = c.get(url + "?curation=1").json()
    by = {s["id"]: s for s in full["sources"] + full["apps"]}
    assert by["HDMI2"]["hidden"] is True and by["Netflix"]["hidden"] is True and by["HDMI1"]["hidden"] is False
    assert by["HDMI1"]["label"] == "ממיר" and by["HDMI1"]["default_label"] == "HDMI 1", "the custom name and the TV's own name are both there"
    assert [s["id"] for s in full["sources"]][:2] == ["HDMI1", "HDMI2"]
    # saving the editor's own list back changes nothing: hidden stays hidden, the custom name stays
    back = {"remote": None, "sources": [{"id": s["id"], "label": None if s["label"] == s["default_label"] else s["label"], "hidden": s["hidden"], "kind": s["kind"], "glyph": s["glyph"]} for s in full["sources"]],
            "apps": [{"id": a["id"], "label": None if a["label"] == a["default_label"] else a["label"], "hidden": a["hidden"], "glyph": a["glyph"]} for a in full["apps"]]}
    assert c.put(url + "/remote", json=back).status_code == 200
    again = c.get(url + "?curation=1").json()
    assert {s["id"]: (s["label"], s["hidden"]) for s in again["sources"] + again["apps"]} == {s["id"]: (s["label"], s["hidden"]) for s in full["sources"] + full["apps"]}
    # an operator (no media.layout) asking for it gets the ordinary answer
    operator = role(c, settings, "olga", "operator")
    ops = c.get(url + "?curation=1", headers=operator).json()
    assert all("hidden" not in s for s in ops["sources"] + ops["apps"]) and "HDMI2" not in [s["id"] for s in ops["sources"]]


# ------------------------------------------------------------------------------------------------ artwork


def test_artwork_is_proxied_only_for_content_art_with_private_cache(m, monkeypatch):
    app, c, calls, keys, settings = m
    seed.set_state(c, "media_player.tv_living_cast", "playing", entity_picture="/api/media_player_proxy/media_player.tv_living_cast?token=abc", media_content_type="movie", media_title="Film",
                   supported_features=seed.PLAY | seed.PAUSE)
    fetched: list[str] = []

    def fake_art(_settings, path):
        fetched.append(path)
        return png_bytes(8, 8), "image/png"

    monkeypatch.setattr(ha_client, "media_artwork", fake_art)
    url = c.get(f"/api/v1/multimedia/devices/{keys['samsung']}").json()["live"]["now"]["artwork"]
    r = c.get("/" + url)
    assert r.status_code == 200 and r.headers["content-type"] == "image/png" and r.headers["cache-control"] == "private, max-age=60"
    assert fetched == ["/api/media_player_proxy/media_player.tv_living_cast?token=abc"]
    assert c.get(f"/api/v1/multimedia/devices/{keys['kitchen']}/artwork").status_code == 404, "no picture"
    assert c.get(f"/api/v1/multimedia/devices/{keys['samsung']}/artwork", headers=as_user("nobody")).status_code == 403


def test_the_artwork_fetch_accepts_only_ha_media_proxy_paths_and_image_bytes(settings, monkeypatch):
    from dataclasses import replace

    import httpx

    from smplwise.errors import ApiError

    s = replace(settings, ha_url="http://ha.local:8123", ha_token="t")
    for bad in ("http://evil.example/x.png", "/api/states", "/api/media_player_proxy/../config", "//evil/api/media_player_proxy/media_player.x", "/api/media_player_proxy/light.x", ""):
        with pytest.raises(ApiError) as exc:
            ha_client.media_artwork(s, bad)
        assert exc.value.status == 404, bad

    class Resp:
        def __init__(self, status, chunks):
            self.status_code, self._chunks = status, chunks

        def __enter__(self):
            return self

        def __exit__(self, *a):
            return False

        def iter_bytes(self):
            return iter(self._chunks)

    class Client:
        def __init__(self, resp):
            self.resp = resp

        def __enter__(self):
            return self

        def __exit__(self, *a):
            return False

        def stream(self, method, url, headers=None):
            assert url == "http://ha.local:8123/api/media_player_proxy/media_player.tv?token=x"
            return self.resp

    path = "/api/media_player_proxy/media_player.tv?token=x"
    jpeg = bytes([0xFF, 0xD8, 0xFF, 0xE0]) + b"0" * 10
    monkeypatch.setattr(httpx, "Client", lambda timeout=10: Client(Resp(200, [jpeg])))
    assert ha_client.media_artwork(s, path) == (jpeg, "image/jpeg")
    monkeypatch.setattr(httpx, "Client", lambda timeout=10: Client(Resp(200, [b"RIFF\x00\x00\x00\x00WEBPxxxx"])))
    assert ha_client.media_artwork(s, path)[1] == "image/webp"
    monkeypatch.setattr(httpx, "Client", lambda timeout=10: Client(Resp(200, [b"<html>not an image</html>"])))
    with pytest.raises(ApiError):
        ha_client.media_artwork(s, path)
    monkeypatch.setattr(httpx, "Client", lambda timeout=10: Client(Resp(200, [jpeg[:4] + b"0" * (512 * 1024)])))
    with pytest.raises(ApiError):
        ha_client.media_artwork(s, path)  # over 512 KB
    monkeypatch.setattr(httpx, "Client", lambda timeout=10: Client(Resp(404, [])))
    with pytest.raises(ApiError):
        ha_client.media_artwork(s, path)


# ------------------------------------------------------------------------------------------------ administration


def test_the_administration_is_system_configure_only(m):
    app, c, calls, keys, settings = m
    site = role(c, settings, "sam", "site_admin")
    for method, url, payload in (("get", "/api/v1/multimedia/admin/devices", None), ("put", f"/api/v1/multimedia/admin/devices/{keys['samsung']}", {"public": True}),
                                 ("post", "/api/v1/multimedia/admin/links", {"op": "restore", "endpoint_id": "ha:media_player.tv_living"}), ("post", "/api/v1/multimedia/admin/approve", {})):
        r = getattr(c, method)(url, headers=site, **({"json": payload} if payload is not None else {}))
        assert (r.status_code, r.json()["code"]) == (403, "forbidden"), url


def test_the_admin_list_shows_devices_endpoints_primaries_and_suggestions(m):
    app, c, calls, keys, settings = m
    body = seed.admin(c)
    assert len(body["devices"]) == 7 and body["suggestions"] == []
    sam = next(d for d in body["devices"] if d["key"] == keys["samsung"])
    assert {"key", "name", "kind", "kind_source", "approved", "public", "profile", "profile_source", "confidence", "anchor_entity_id", "floor_name", "area_name", "audio_link_key", "audio_default",
            "volume_max", "model_keys", "also_turns_on", "endpoints"} <= set(sam)
    assert sam["anchor_entity_id"] == "media_player.tv_living" and sam["confidence"] == "strong" and sam["kind_source"] == "auto" and sam["profile_source"] == "detected" and sam["approved"] is True
    eps = {e["endpoint_id"]: e for e in sam["endpoints"]}
    assert set(eps) == {"ha:media_player.tv_living", "ha:remote.tv_living", "ha:media_player.tv_living_cast", "ha:media_player.tv_living_st", "ha:media_player.tv_living_ma"}
    assert (eps["ha:media_player.tv_living_cast"]["role"], eps["ha:media_player.tv_living_cast"]["rule"], eps["ha:media_player.tv_living_cast"]["hidden"]) == ("cast", "mac", True)
    assert (eps["ha:media_player.tv_living_st"]["role"], eps["ha:media_player.tv_living_st"]["rule"]) == ("smartthings", "identifier")
    assert (eps["ha:media_player.tv_living_ma"]["role"], eps["ha:media_player.tv_living_ma"]["rule"]) == ("ma_import", "ma")
    assert set(eps["ha:media_player.tv_living"]["primary_for"]) == {"power", "keys", "sources", "apps", "volume", "mute", "now_playing"}
    assert sam["also_turns_on"] == []
    # two Samsung TVs are two devices
    assert len([d for d in body["devices"] if d["profile"] == "samsung_smart"]) == 2
    assert next(d for d in body["devices"] if d["kind"] == "receiver")["approved"] is False


def test_updating_a_device_validates_every_field_and_audits(m):
    app, c, calls, keys, settings = m
    k = keys["samsung"]
    rcv = seed.key_of(c, "media_player.receiver_living")
    r = c.put(f"/api/v1/multimedia/admin/devices/{k}", json={"display_name": "  סלון ראשי  ", "kind": "screen", "public": True, "profile": "lg_webos", "audio_link_key": rcv, "audio_default": "linked",
                                                             "volume_max": 60, "model_keys": [], "primary": {"volume": "ha:media_player.tv_living_cast"}})
    assert r.status_code == 200, r.text
    row = r.json()
    assert (row["name"], row["kind_source"], row["public"], row["profile"], row["profile_source"], row["audio_link_key"], row["audio_default"], row["volume_max"]) == ("סלון ראשי", "manual", True, "lg_webos", "pinned", rcv, "linked", 60)
    assert next(e for e in row["endpoints"] if e["endpoint_id"] == "ha:media_player.tv_living_cast")["primary_for"] == ["volume"]
    listed = c.get(f"/api/v1/multimedia/devices/{k}").json()
    assert listed["name"] == "סלון ראשי" and listed["profile"] == "lg_webos" and listed["public"] is True
    # null resets
    row = c.put(f"/api/v1/multimedia/admin/devices/{k}", json={"display_name": None, "kind": None, "profile": None, "audio_link_key": None, "volume_max": None, "primary": {"volume": None}}).json()
    assert (row["name"], row["kind_source"], row["profile"], row["profile_source"], row["audio_link_key"], row["audio_default"], row["volume_max"]) == ("טלוויזיה סלון", "auto", "samsung_smart", "detected", None, "screen", None)
    bads = [{"display_name": "x" * 81}, {"display_name": "a\nb"}, {"kind": "group"}, {"kind": "tablet"}, {"profile": "sony"}, {"audio_link_key": k}, {"audio_link_key": "0" * 32}, {"audio_link_key": keys["kitchen"]},
            {"audio_default": "linked"}, {"audio_default": "both"}, {"volume_max": 101}, {"volume_max": -1}, {"volume_max": True}, {"model_keys": ["up"]}, {"model_keys": "blue"},
            {"primary": {"volume": "ha:media_player.lg_office"}}, {"primary": {"teleport": "ha:media_player.tv_living"}}, {"primary": []}, {"surprise": 1}]
    for bad in bads:
        assert c.put(f"/api/v1/multimedia/admin/devices/{k}", json=bad).status_code == 422, bad
    assert c.put(f"/api/v1/multimedia/admin/devices/{'d' * 32}", json={"public": True}).status_code == 404
    assert c.put(f"/api/v1/multimedia/admin/devices/{k}", json={"model_keys": ["blue"]}).json()["model_keys"] == ["blue"]
    fields = [json.loads(r["details_json"])["fields"] for r in audit(app, "media.device.update")]
    assert {"display_name", "kind", "kind_source", "is_public", "profile", "audio_link_key", "audio_default", "volume_max", "primary_json"} <= set(fields[0])
    blob = json.dumps([dict(r) for r in audit(app, "media.device.update")])
    assert "aa:bb" not in blob.lower()


def test_a_receiver_cannot_link_back_to_a_screen_that_links_to_it(m):
    app, c, calls, keys, settings = m
    rcv = seed.key_of(c, "media_player.receiver_living")
    assert c.put(f"/api/v1/multimedia/admin/devices/{keys['samsung']}", json={"audio_link_key": rcv}).status_code == 200
    assert c.put(f"/api/v1/multimedia/admin/devices/{rcv}", json={"audio_link_key": keys["samsung"]}).status_code == 422, "no cycle (and a screen is not an audio target)"


def test_link_unlink_ignore_and_restore_rebuild_the_model(m):
    app, c, calls, keys, settings = m
    link = lambda op, ep, dk=None: c.post("/api/v1/multimedia/admin/links", json={"op": op, "endpoint_id": ep, **({"device_key": dk} if dk else {})})  # noqa: E731
    before = {d["key"]: {e["endpoint_id"] for e in d["endpoints"]} for d in seed.admin(c)["devices"]}
    assert link("unlink", "ha:media_player.tv_living_cast").status_code == 200
    after = {d["key"]: {e["endpoint_id"] for e in d["endpoints"]} for d in seed.admin(c)["devices"]}
    assert "ha:media_player.tv_living_cast" not in after[keys["samsung"]]
    cast_key = next(k for k, eps in after.items() if eps == {"ha:media_player.tv_living_cast"})
    assert cast_key not in before and keys["samsung"] in after, "the TV keeps its key"
    # link it (and the kitchen's second Samsung is never offered the merge by the guard: link is explicit and manual)
    r = link("link", "ha:media_player.tv_living_cast", keys["samsung"])
    devices = {d["key"]: d for d in r.json()["devices"]}
    assert cast_key not in devices and "ha:media_player.tv_living_cast" in {e["endpoint_id"] for e in devices[keys["samsung"]]["endpoints"]}
    ep = next(e for e in devices[keys["samsung"]]["endpoints"] if e["endpoint_id"] == "ha:media_player.tv_living_cast")
    assert (ep["rule"], ep["link_source"]) == ("manual", "manual") and devices[keys["samsung"]]["confidence"] == "manual"
    # ignore: in no device at all; restore puts the automatic ladder back
    assert "ha:media_player.tv_living_st" not in {e["endpoint_id"] for d in link("ignore", "ha:media_player.tv_living_st").json()["devices"] for e in d["endpoints"]}
    for ep_id in ("ha:media_player.tv_living_cast", "ha:media_player.tv_living_st"):
        assert link("restore", ep_id).status_code == 200
    final = {d["key"]: {e["endpoint_id"] for e in d["endpoints"]} for d in seed.admin(c)["devices"]}
    assert final == before
    for bad in (("link", "ha:media_player.tv_living_cast", None), ("link", "ha:media_player.tv_living_cast", "0" * 32), ("ignore", "media_player.x", None), ("ignore", "ha:light.x", None)):
        assert link(*bad).status_code == 422, bad
    assert c.post("/api/v1/multimedia/admin/links", json={"op": "merge", "endpoint_id": "ha:media_player.x"}).status_code == 422
    assert [json.loads(r["details_json"])["op"] for r in audit(app, "media.link")][:2] == ["unlink", "link"]


def test_approval_is_one_tap_for_every_detected_screen_or_per_device_and_changes_what_is_listed(settings, monkeypatch):
    app = create_app(settings)
    c = TestClient(app)
    seed.install(c)
    st = c.get("/api/v1/multimedia/status").json()
    assert st["counts"] == {"screens": 0, "on": 0, "pending_approval": 6, "players": 0, "playing": 0, "groups": 0, "unplaced": 0, "suggestions": 0}
    r = c.post("/api/v1/multimedia/admin/approve", json={"device_keys": [seed.key_of(c, "media_player.tv_living")]})
    assert r.json() == {"requested": 1, "changed": 1, "approved": 1, "pending_approval": 5}
    assert len(c.get("/api/v1/multimedia/devices").json()["devices"]) == 1
    r = c.post("/api/v1/multimedia/admin/approve", json={})
    assert r.json() == {"requested": 6, "changed": 5, "approved": 6, "pending_approval": 0}, "every detected screen - never the receiver"
    assert [d["approved"] for d in seed.admin(c)["devices"] if d["kind"] == "receiver"] == [False]
    assert c.post("/api/v1/multimedia/admin/approve", json={"approved": False, "device_keys": []}).json()["changed"] == 0
    assert c.post("/api/v1/multimedia/admin/approve", json={"approved": False}).json()["approved"] == 0
    assert c.get("/api/v1/multimedia/devices").json() == {"devices": []}
    rows = [json.loads(r["details_json"]) for r in audit(app, "media.approve")]
    assert rows[1]["all_screens"] is True and rows[0]["all_screens"] is False


# ------------------------------------------------------------------------------------------------ the permission catalogue


MEDIA = ("media.read", "media.control", "media.power", "media.public", "media.bulk", "media.layout")


def test_permissions_are_registered_with_hebrew_labels_and_the_default_roles():
    assert all(PERMISSION_LABELS[p] for p in MEDIA)
    assert PERMISSION_LABELS["media.read"] == "צפייה במסכים ובמולטימדיה" and PERMISSION_LABELS["media.bulk"] == "כיבוי מרוכז של מסכים בקומה או באזור"
    expect = {"viewer": {"media.read"}, "operator": {"media.read", "media.control", "media.power"}, "editor": {"media.read"}, "site_admin": set(MEDIA), "system_admin": set(MEDIA), "kiosk": set()}
    for role_id, want in expect.items():
        assert {p for p in MEDIA if p in ROLES[role_id]} == want, role_id
    assert {"media.public", "media.bulk"} <= set(SENSITIVE) and not ({"media.read", "media.control", "media.power", "media.layout"} & set(SENSITIVE))
    from pathlib import Path

    contract = json.loads((Path(__file__).resolve().parents[3] / "contracts" / "examples" / "role-catalog.design.json").read_text(encoding="utf-8"))
    for role in contract["roles"]:
        assert {p for p in MEDIA if p in role["permissions"]} == expect[role["id"]], role["id"]
    assert {"media.public", "media.bulk"} <= set(contract["sensitive_permissions_not_implied"])


def test_a_custom_role_gets_the_sensitive_media_permissions_only_by_naming_them(m):
    app, c, calls, keys, settings = m
    r = c.post("/api/v1/access/roles", json={"name": "מסכים", "permissions": ["media.read", "media.bulk"]})
    assert r.status_code == 422 and r.json()["code"] == "sensitive_in_permissions"
    ok = c.post("/api/v1/access/roles", json={"name": "מסכים ציבוריים", "permissions": ["media.read", "media.control"], "sensitive": ["media.public"]})
    assert ok.status_code in (200, 201), ok.text
    role_id = ok.json()["id"]
    bind(c, settings, "pat", role_id, "installation", "*")
    st = c.get("/api/v1/multimedia/status", headers=as_user("pat")).json()["can"]
    assert (st["read"], st["control"], st["power"], st["public"], st["bulk"]) == (True, True, False, True, False)


# ------------------------------------------------------------------------------------------------ the personal layout (3.15) and the navigation


def test_multimedia_is_a_navigation_tab_between_the_map_and_wiskey():
    from smplwise.services import user_prefs

    assert user_prefs.NAV_TAB_IDS == ("devices", "security", "explore", "multimedia", "wiskey", "infra")  # CR-023 adds the infrastructure area last
    assert user_prefs.normalize_nav_order(["wiskey", "devices"]) == ["wiskey", "devices", "security", "explore", "multimedia", "infra"]


def test_the_personal_layout_needs_screen_personalize_on_write_and_read(m):
    app, c, calls, keys, settings = m
    personal = {"group_by": "area", "order": [keys["samsung"], keys["lg"]], "cards": {keys["samsung"]: {"on": False, "size": "l"}}}
    viewer = role(c, settings, "vera", "viewer")
    r = c.put("/api/v1/me/prefs", json={"multimedia.personal": personal}, headers=viewer)
    assert (r.status_code, r.json()["code"]) == (403, "personalize_required")
    assert c.put("/api/v1/me/prefs", json={"multimedia.personal": None}, headers=viewer).status_code == 200, "clearing is always allowed"
    assert c.get("/api/v1/multimedia/layout", headers=viewer).json()["personal"] is None and c.get("/api/v1/multimedia/layout", headers=viewer).json()["can_personalize"] is False
    # the administrator holds screen.personalize
    saved = c.put("/api/v1/me/prefs", json={"multimedia.personal": personal})
    assert saved.status_code == 200 and saved.json()["prefs"]["multimedia.personal"] == {**personal, "cards": {keys["samsung"]: {"on": False, "size": "l"}}}
    lay = c.get("/api/v1/multimedia/layout").json()
    assert lay["personal"] == personal and lay["can_personalize"] is True and lay["can_edit"] is True
    assert lay["installation"] == media_layout.default_layout(), "the personal override never touches the installation layout"
    for bad in ({"group_by": "street"}, {"order": ["x"]}, {"cards": {"x": {"on": True}}}, {"cards": {keys["lg"]: {"phone_on": True}}}, {"surprise": 1}, {"order": [keys["lg"]] * 301}):
        assert c.put("/api/v1/me/prefs", json={"multimedia.personal": bad}).status_code == 422, bad
    # a user who lost the permission: the stored value is ignored on read
    custom = c.post("/api/v1/access/roles", json={"name": "צפייה", "permissions": ["media.read", "screen.personalize"]}).json()["id"]
    bind(c, settings, "pia", custom, "installation", "*")
    pia = as_user("pia")
    assert c.put("/api/v1/me/prefs", json={"multimedia.personal": personal}, headers=pia).status_code == 200
    assert c.get("/api/v1/multimedia/layout", headers=pia).json()["personal"] == personal
    with app.state.db.connection() as conn:
        conn.execute("UPDATE bindings SET revoked_at = '2026-09-30T00:00:00Z' WHERE subject_id = 'dev-pia'")
        dbmod.bump_permission_revision(conn)
    bind(c, settings, "pia", "viewer", "installation", "*")
    assert c.get("/api/v1/multimedia/layout", headers=pia).json()["personal"] is None
    assert c.get("/api/v1/me/prefs", headers=pia).json()["prefs"]["multimedia.personal"] is None and "multimedia.personal" not in c.get("/api/v1/me/prefs", headers=pia).json()["stored"]


# ------------------------------------------------------------------------------------------------ migrations


def test_the_migrations_apply_on_a_0_1_148_database_and_give_custom_roles_the_media_grants(settings, tmp_path, monkeypatch):
    real = dbmod.MIGRATIONS_DIR
    older = tmp_path / "older"
    older.mkdir()
    for f in real.glob("*.sql"):
        if int(f.name.split("_", 1)[0]) <= 39:
            shutil.copy(f, older / f.name)
    monkeypatch.setattr(dbmod, "MIGRATIONS_DIR", older)
    database = dbmod.Database(settings.db_path)
    applied = database.migrate()
    assert max(applied) == 39 and 41 not in applied, "a 0.1.148 database"
    now = "2026-09-30T00:00:00Z"
    with database.connection() as conn:
        conn.execute("INSERT INTO ha_entities(entity_id, domain, state, state_seen_at, first_seen_at, updated_at) VALUES ('media_player.old', 'media_player', 'on', ?, ?, ?)", (now, now, now))
        conn.execute("INSERT INTO device_bulk_actions(id, scope, scope_id, kind, principal_user_id, client_request_id, entity_count, status, requested_at, not_after) VALUES ('b1', 'floor', 'f', 'screens_off', 'u', 'r', 1, 'done', ?, ?)", (now, now))
        for rid, perms, sens in (("r-read", ["devices.read", "map.read"], []), ("r-ctl", ["devices.read", "devices.control", "video.live"], []), ("r-none", ["map.read"], []), ("r-already", ["devices.read", "media.read"], []),
                                 ("r-sens", ["devices.read", "devices.control"], ["devices.control_bulk"]), ("r-ctl-only", ["devices.control", "map.read"], []), ("r-pow-only", ["media.power"], [])):
            conn.execute("INSERT INTO custom_roles(id, name_he, permissions_json, sensitive_json, created_at, updated_at) VALUES (?,?,?,?,?,?)", (rid, rid, json.dumps(perms), json.dumps(sens), now, now))
        rev = dbmod.permission_revision(conn)
    monkeypatch.setattr(dbmod, "MIGRATIONS_DIR", real)
    assert database.migrate() == [40, 41, 42, 43, 44, 45, 46, 47, 48, 49, 54, 55], "0054-0055 (CR-023 meters, billing), 0040 (climate), 0043 (camera wall), 0044 (CR-016 players), 0045-0047 (CR-018 notifications), 0048 (CR-017 automations) and 0049 (switch protection) are in the real set too"
    with database.connection() as conn:
        roles = {r["id"]: (json.loads(r["permissions_json"]), json.loads(r["sensitive_json"])) for r in conn.execute("SELECT * FROM custom_roles")}
        assert roles["r-read"][0] == ["devices.read", "map.read", "media.read"]
        assert roles["r-ctl"][0] == ["devices.read", "devices.control", "video.live", "media.read", "media.control", "media.power"]
        assert roles["r-none"][0] == ["map.read"] and roles["r-already"][0] == ["devices.read", "media.read"]
        # review L10: a grant must be usable - a role that gains control / power gains media.read even without devices.read
        assert roles["r-ctl-only"][0] == ["devices.control", "map.read", "media.control", "media.power", "media.read"]
        assert roles["r-pow-only"][0] == ["media.power", "media.read"]
        revisions = {r["id"]: r["revision"] for r in conn.execute("SELECT id, revision FROM custom_roles")}
        assert revisions == {"r-read": 2, "r-ctl": 2, "r-none": 1, "r-already": 1, "r-sens": 2, "r-ctl-only": 2, "r-pow-only": 2}, "only the roles the migration touched move their revision"
        assert roles["r-sens"][1] == ["devices.control_bulk"], "the sensitive permissions are never granted by the migration"
        assert not any(p in ("media.public", "media.bulk", "media.layout") for perms, _s in roles.values() for p in perms)
        assert dbmod.permission_revision(conn) == rev + 1
        assert conn.execute("SELECT origin FROM device_bulk_actions WHERE id = 'b1'").fetchone()[0] == "devices", "existing bulks keep their origin"
        assert conn.execute("SELECT entity_id FROM ha_entities").fetchone()[0] == "media_player.old", "existing rows untouched"
        tables = {r[0] for r in conn.execute("SELECT name FROM sqlite_master WHERE type = 'table'")}
        assert {"ha_devices", "media_devices", "media_device_endpoints", "media_link_rules", "media_layouts", "media_commands"} <= tables
    # idempotent: running the data migration's statements again adds nothing
    import sqlite3

    sql = (real / "0042_media_role_grants.sql").read_text(encoding="utf-8")
    raw = sqlite3.connect(settings.db_path)
    snapshot = "SELECT permissions_json, revision, updated_at FROM custom_roles ORDER BY id"
    before = [tuple(r) for r in raw.execute(snapshot)]
    rev_before = raw.execute("SELECT value FROM settings WHERE key = 'permission_revision'").fetchone()[0]
    raw.executescript(sql)
    assert [tuple(r) for r in raw.execute(snapshot)] == before, "a second run adds nothing and moves no revision"
    assert raw.execute("SELECT value FROM settings WHERE key = 'permission_revision'").fetchone()[0] == rev_before
    assert raw.execute("SELECT name FROM sqlite_temp_master WHERE name = 'media_grants_before'").fetchone() is None, "the working table does not outlive the script"
    raw.close()


def test_the_migration_numbers_are_unique_and_0041_0042_are_ours():
    names = sorted(f.name for f in dbmod.MIGRATIONS_DIR.glob("004*.sql"))
    assert names == ["0040_climate_kind.sql", "0041_media_devices.sql", "0042_media_role_grants.sql", "0043_camera_wall_hidden.sql", "0044_media_players.sql", "0045_notifications.sql", "0046_notify_settings.sql", "0047_notify_policies.sql", "0048_automations.sql", "0049_switch_protection.sql"], "the real contiguous 0040-0049 set"
    numbers = [int(n.split("_", 1)[0]) for n in names]
    assert numbers == list(range(40, 50)) and len(set(numbers)) == len(numbers)


# ------------------------------------------------------------------------------------------------ settings


def test_the_settings_keys_default_validate_and_need_system_configure(m):
    app, c, calls, keys, settings = m
    got = c.get("/api/v1/settings").json()["settings"]
    assert got["multimedia.enabled"] == "true" and got["multimedia.remote_default"] == media_layout.default_remote()
    assert c.patch("/api/v1/settings", json={"multimedia.enabled": "maybe"}).status_code == 422
    assert c.patch("/api/v1/settings", json={"multimedia.remote_default": {"sections": [], "more": []}}).status_code == 422
    good = {"sections": sections({"nums": False}), "more": ["colors"]}
    assert c.patch("/api/v1/settings", json={"multimedia.remote_default": good}).json()["settings"]["multimedia.remote_default"] == good
    assert c.get("/api/v1/multimedia/remote-default").json() == {**good, "scope": "default"}
    viewer = role(c, settings, "vera", "viewer")
    assert c.patch("/api/v1/settings", json={"multimedia.enabled": "false"}, headers=viewer).status_code == 403
    assert c.get("/api/v1/settings", headers=viewer).json()["settings"]["multimedia.remote_default"] == good, "everyone reads the default; only system.configure changes it"
    changes = [json.loads(r["details_json"]) for r in audit(app, "settings.update")]
    assert any("multimedia.remote_default" in x for x in changes)


# ------------------------------------------------------------------------------------------------ CR-015 review fixes (L2, L4, L7)


def _place(c, ids, placements: dict[str, str]) -> None:
    for fid in (ids["floor2"], ids["floor3"]):
        asset = c.post(f"/api/v1/floors/{fid}/plan-assets", files={"file": ("p.png", png_bytes(), "image/png")}).json()
        v = c.post(f"/api/v1/floors/{fid}/plan-versions", json={"asset_id": asset["id"]}).json()
        c.post(f"/api/v1/plan-versions/{v['id']}/publish")
    for eid, floor in placements.items():
        assert c.post(f"/api/v1/floors/{ids[floor]}/anchors", json={"resource_type": "ha_entity", "resource_id": eid, "x": 0.2, "y": 0.2}).status_code == 201


def test_the_layout_route_returns_only_the_device_keys_and_floors_the_caller_may_see(m):
    """L4: no key, floor id or card of a screen outside the caller's scope - installation and personal layouts alike."""
    app, c, calls, keys, settings = m
    ids = seed_tree(c)
    _place(c, ids, {"media_player.tv_living": "floor2", "media_player.lg_office": "floor3"})
    everything = [keys["samsung"], keys["lg"], keys["kitchen"], keys["generic"]]
    layout = {"version": 1, "group_by": "floor", "floor_order": ["upper", "ground", "elsewhere"], "pinned": [keys["lg"], keys["samsung"]], "order": everything,
              "cards": {k: {"on": True, "size": "m", "phone_on": None, "phone_size": None} for k in everything}}
    saved = c.put("/api/v1/multimedia/layout", json={"layout": layout, "base_revision": 0})
    assert saved.status_code == 200 and saved.json()["installation"]["order"] == everything, "the editor gets the whole layout back (a save replaces it)"
    assert c.get("/api/v1/multimedia/layout").json()["installation"]["cards"].keys() == set(everything)
    ron = role(c, settings, "ron", "operator", ("floor", ids["floor2"]))
    lay = c.get("/api/v1/multimedia/layout", headers=ron).json()
    assert lay["can_edit"] is False
    assert lay["installation"]["order"] == [keys["samsung"]] and lay["installation"]["pinned"] == [keys["samsung"]] and list(lay["installation"]["cards"]) == [keys["samsung"]]
    assert lay["installation"]["floor_order"] == ["ground"], "only the floors of the screens the caller sees"
    blob = json.dumps(lay)
    assert all(k not in blob for k in (keys["lg"], keys["kitchen"], keys["generic"], "elsewhere", "upper"))
    # the personal override is filtered too
    custom = c.post("/api/v1/access/roles", json={"name": "צפייה אישית", "permissions": ["media.read", "screen.personalize"]}).json()["id"]
    pia = role(c, settings, "pia", custom, ("floor", ids["floor2"]))
    mine = {"group_by": "floor", "order": [keys["lg"], keys["samsung"]], "cards": {keys["lg"]: {"on": False}, keys["samsung"]: {"size": "l"}}}
    assert c.put("/api/v1/me/prefs", json={"multimedia.personal": mine}, headers=pia).status_code == 200
    got = c.get("/api/v1/multimedia/layout", headers=pia).json()
    assert got["personal"] == {"group_by": "floor", "order": [keys["samsung"]], "cards": {keys["samsung"]: {"size": "l"}}}
    assert keys["lg"] not in json.dumps(got) and got["installation"]["order"] == [keys["samsung"]]
    # the personal layout still reads back whole for its owner where the owner sees everything
    assert c.put("/api/v1/me/prefs", json={"multimedia.personal": mine}).status_code == 200
    assert c.get("/api/v1/multimedia/layout").json()["personal"]["order"] == [keys["lg"], keys["samsung"]]


def test_a_linked_receiver_needs_its_own_scope_for_control_and_for_its_name(m):
    """L2: volume / mute routed to a linked receiver need media.control at the RECEIVER's anchor; its name shows only to a caller who may read it."""
    app, c, calls, keys, settings = m
    ids = seed_tree(c)
    _place(c, ids, {"media_player.tv_living": "floor2"})  # the receiver is placed nowhere: outside a floor-scoped caller's scope
    rcv = seed.key_of(c, "media_player.receiver_living")
    assert c.put(f"/api/v1/multimedia/admin/devices/{keys['samsung']}", json={"audio_link_key": rcv, "audio_default": "linked"}).status_code == 200
    assert c.get(f"/api/v1/multimedia/devices/{keys['samsung']}").json()["audio_link"]["name"] == "מגבר סלון"
    ron = role(c, settings, "ron", "operator", ("floor", ids["floor2"]))
    d = c.get(f"/api/v1/multimedia/devices/{keys['samsung']}", headers=ron).json()
    assert d["audio_link"] is None, "the receiver's name is not shown to a caller who may not read the receiver"
    assert "מגבר סלון" not in json.dumps(d) and rcv not in json.dumps(d)
    r = seed.send(c, keys["samsung"], "volume_set", headers=ron, level=20)  # the effective target is the linked receiver
    assert (r.status_code, r.json()["code"]) == (403, "forbidden") and r.json()["details"]["permission"] == "media.control"
    assert seed.send(c, keys["samsung"], "mute", headers=ron, muted=True).status_code == 403
    assert seed.send(c, keys["samsung"], "volume_set", headers=ron, level=20, target="screen").status_code == 202, "the screen's own speakers stay in scope"
    # the receiver on the caller's floor: name shown, control allowed
    assert c.post(f"/api/v1/floors/{ids['floor2']}/anchors", json={"resource_type": "ha_entity", "resource_id": "media_player.receiver_living", "x": 0.4, "y": 0.4}).status_code == 201
    assert c.get(f"/api/v1/multimedia/devices/{keys['samsung']}", headers=ron).json()["audio_link"]["name"] == "מגבר סלון"
    media_seed_calls = len(calls)
    assert seed.send(c, keys["samsung"], "volume_set", headers=ron, level=25).status_code == 202 and calls[media_seed_calls]["data"]["entity_id"] == "media_player.receiver_living"


def test_a_personal_layout_without_screen_personalize_is_personalize_required_not_forbidden(m):
    """L7: the dedicated refusal is reachable (the generic `forbidden` branch used to win); clearing stays allowed; audited."""
    app, c, calls, keys, settings = m
    viewer = role(c, settings, "vera", "viewer")
    r = c.put("/api/v1/me/prefs", json={"multimedia.personal": {"group_by": "area", "order": None, "cards": {}}}, headers=viewer)
    assert (r.status_code, r.json()["code"]) == (403, "personalize_required") and r.json()["details"]["permission"] == "screen.personalize"
    assert c.put("/api/v1/me/prefs", json={"multimedia.personal": None}, headers=viewer).status_code == 200
    # the other personal keys keep the generic refusal (and every one of them stays gated)
    for key in ("home.personal", "devices.area_row"):
        assert c.put("/api/v1/me/prefs", json={key: {}}, headers=viewer).status_code in (403, 422), key
    with app.state.db.connection(mode="read") as conn:
        denied = conn.execute("SELECT COUNT(*) FROM audit_log WHERE action = 'screen.personalize' AND decision = 'denied' AND actor_user_id = 'dev-vera'").fetchone()[0]
    assert denied >= 1
