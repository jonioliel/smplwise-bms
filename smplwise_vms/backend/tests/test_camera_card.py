"""The camera card of the area screens (owner 2026-09-30): the layout schema for `camera:<slug>` items, the conservative
mapping of Home Assistant camera entities to NVR channels, what a card's source resolves to for each caller (video.live
with the camera scope, audited refusals, nothing named to someone who may not watch), the picker's list, and the still
picture of a standalone Home Assistant camera (cached, never for an NVR channel, no token anywhere in a reply)."""
from __future__ import annotations

import json

import pytest
from conftest import as_user, bind
from fastapi.testclient import TestClient
from test_devices import dev_app  # noqa: F401 - the HA structure fixture (floors, areas, entities)

from smplwise.db import new_id, now_iso, permission_revision
from smplwise.routers import device_cameras as cams_mod
from smplwise.errors import ApiError
from smplwise.routers import device_layouts as mod
from smplwise.services import camera_cards as cc
from smplwise.services import ha_client

LAYOUT = "/api/v1/devices/layouts"
CARD = "/api/v1/devices/camera-card"
MODEL = "DS-7616NXI-K2/D"
NVR_ENTITY = "camera.ds_7616nxi_k2_d_lobby_101"  # channel 1, main
NVR_ENTITY_SUB = "camera.ds_7616nxi_k2_d_lobby_102"  # channel 1, sub
NVR_ENTITY_2 = "camera.ds_7616nxi_k2_d_yard_201"  # channel 2, main
JPEG = bytes([0xFF, 0xD8, 0xFF, 0xE0]) + b"still-picture"


def _seed_entity(app, entity_id: str, *, platform: str | None = "hikvision", device_id: str | None = "dev-nvr", name: str = "", area: str | None = "lobby", disabled: int = 0) -> None:
    with app.state.db.connection() as conn:
        conn.execute("DELETE FROM ha_entities WHERE entity_id = ?", (entity_id,))
        conn.execute(
            "INSERT INTO ha_entities(entity_id, platform, device_id, area_id, area_name, name, domain, disabled, state, available, first_seen_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, 'camera', ?, 'idle', 1, ?, ?)",
            (entity_id, platform, device_id, area, "לובי" if area else None, name or entity_id, disabled, now_iso(), now_iso()),
        )


@pytest.fixture()
def cam_app(dev_app):  # noqa: F811
    """dev_app + an NVR with the model the integration names its entities after, channels 1-3, and the camera entities."""
    app, s = dev_app
    c = TestClient(app)
    ids = {}
    for ch, alias in ((1, "כניסה"), (2, "חצר"), (3, "חניה")):
        r = c.post("/api/v1/cameras", json={"channel": ch, "alias": alias})
        assert r.status_code == 201
        ids[ch] = r.json()["id"]
    with app.state.db.connection() as conn:
        conn.execute("UPDATE recorders SET model = ? WHERE id = 'nvr-1'", (MODEL,))
    for eid in (NVR_ENTITY, NVR_ENTITY_SUB, NVR_ENTITY_2):
        _seed_entity(app, eid, name=eid.rsplit("_", 2)[-2])
    return app, s, c, ids


def _deny(app, username: str, role: str, scope_type: str, scope_id: str) -> None:
    with app.state.db.connection() as conn:
        conn.execute(
            "INSERT INTO bindings(id, subject_kind, subject_id, role_id, scope_type, scope_id, effect, permission_revision, assigned_by, created_at) VALUES (?, 'user', ?, ?, ?, ?, 'deny', ?, 'test', ?)",
            (new_id(), f"dev-{username}", role, scope_type, scope_id, permission_revision(conn), now_iso()),
        )


def _audit(app, action: str) -> list[dict]:
    with app.state.db.connection() as conn:
        return [dict(r) for r in conn.execute("SELECT * FROM audit_log WHERE action = ? ORDER BY rowid", (action,)).fetchall()]


# ------------------------------------------------------------------ the layout schema

def _put(c, area, layout, revision=0, variant="desktop"):
    return c.put(f"{LAYOUT}/area/{area}", json={"variant": variant, "revision": revision, "layout": layout})


def _layout(items: dict, v: int = 2) -> dict:
    return {"v": v, "cols": 12, "items": items}


NVR_CARD = {"x": 0, "y": 0, "w": 6, "h": 30, "title": "כניסה", "camera": {"kind": "nvr", "recorder_id": "nvr-1", "channel": 1}}
HA_CARD = {"x": 6, "y": 0, "w": 6, "h": 30, "camera": {"kind": "ha", "entity_id": NVR_ENTITY_2}}


def test_camera_cards_are_stored_and_returned_beside_the_domain_cards(dev_app):  # noqa: F811
    app, _ = dev_app
    c = TestClient(app)
    items = {"camera:c1": NVR_CARD, "camera:c2": HA_CARD, "card:lighting": {"x": 0, "y": 32, "w": 12, "h": 20}}
    r = _put(c, "lobby", _layout(items))
    assert r.status_code == 200, r.text
    got = c.get(f"{LAYOUT}/area/lobby").json()["desktop"]["layout"]["items"]
    assert got["camera:c1"]["camera"] == {"kind": "nvr", "recorder_id": "nvr-1", "channel": 1} and got["camera:c1"]["title"] == "כניסה"
    assert got["camera:c2"]["camera"] == {"kind": "ha", "entity_id": NVR_ENTITY_2}
    assert "camera" not in got["card:lighting"]  # a domain card stays exactly what it was
    # the phone variant takes them too
    phone = {"v": 2, "cols": 4, "items": {"camera:c1": {"x": 0, "y": 0, "w": 4, "h": 20, "camera": NVR_CARD["camera"]}}}
    assert _put(c, "lobby", phone, variant="phone").status_code == 200
    with app.state.db.connection() as conn:
        stored = json.loads(conn.execute("SELECT layout_json FROM device_layouts WHERE scope = 'area' AND scope_id = 'lobby' AND variant = 'desktop'").fetchone()["layout_json"])
    assert "camera" not in stored["items"]["card:lighting"]


@pytest.mark.parametrize(
    "items, v, needle",
    [
        ({"camera:c1": NVR_CARD}, 1, "layout v 2"),
        ({"camera:c1": {"x": 0, "y": 0, "w": 6, "h": 30}}, 2, "needs its source"),
        ({"card:lighting": {"x": 0, "y": 0, "w": 6, "h": 30, "camera": NVR_CARD["camera"]}}, 2, "only a camera:<id> card"),
        ({"camera:c1": {**NVR_CARD, "camera": {"kind": "rtsp", "url": "rtsp://u:p@h/1"}}}, 2, "layout.items.camera:c1.camera"),
        ({"camera:c1": {**NVR_CARD, "camera": {"kind": "nvr", "recorder_id": "nvr-1", "channel": 0}}}, 2, "camera"),
        ({"camera:c1": {**NVR_CARD, "camera": {"kind": "nvr", "recorder_id": "nvr 1/../x", "channel": 1}}}, 2, "camera"),
        ({"camera:c1": {**NVR_CARD, "camera": {"kind": "nvr", "recorder_id": "nvr-1", "channel": 1, "token": "x"}}}, 2, "camera"),
        ({"camera:c1": {**NVR_CARD, "camera": {"kind": "ha", "entity_id": "light.lobby"}}}, 2, "camera"),
        ({"camera:c1": {**NVR_CARD, "camera": {"kind": "ha", "entity_id": "camera.x", "extra": 1}}}, 2, "camera"),
        ({"camera:c1": {**NVR_CARD, "tiles": {"camera.x": {"order": 0}}}}, 2, "no device tiles"),
        ({"camera:c1": {**NVR_CARD, "hidden_entities": ["camera.x"]}}, 2, "no device tiles"),
        ({"camera:bad key!": NVR_CARD}, 2, "camera cards"),
        ({"camera:c1": NVR_CARD, "camera:c2": {**HA_CARD, "x": 3}}, 2, "layout_overlap"),  # overlap on the one grid
    ],
)
def test_camera_card_validation_refuses(dev_app, items, v, needle):  # noqa: F811
    app, _ = dev_app
    c = TestClient(app)
    r = _put(c, "lobby", _layout(items, v))
    assert r.status_code == 422, r.text
    assert needle in r.text or needle in json.dumps(r.json(), ensure_ascii=False), r.text
    assert c.get(f"{LAYOUT}/area/lobby").json()["desktop"] is None  # nothing was written


def test_camera_card_stream_profile_is_stored_and_an_older_layout_loads_as_auto(dev_app):  # noqa: F811
    app, _ = dev_app
    c = TestClient(app)
    items = {"camera:c1": {**NVR_CARD, "profile": "main"}, "camera:c2": {**HA_CARD, "profile": "sub"}, "camera:c3": {"x": 0, "y": 40, "w": 6, "h": 30, "camera": NVR_CARD["camera"], "profile": "auto"}}
    assert _put(c, "lobby", _layout(items)).status_code == 200
    got = c.get(f"{LAYOUT}/area/lobby").json()["desktop"]["layout"]["items"]
    assert (got["camera:c1"]["profile"], got["camera:c2"]["profile"], got["camera:c3"]["profile"]) == ("main", "sub", "auto")
    # a layout saved before the choice has no `profile` at all: nothing is stored for it, and it reads as auto
    old = {"camera:c1": NVR_CARD}
    assert _put(c, "lobby", _layout(old), revision=c.get(f"{LAYOUT}/area/lobby").json()["desktop"]["revision"]).status_code == 200
    with app.state.db.connection() as conn:
        stored = json.loads(conn.execute("SELECT layout_json FROM device_layouts WHERE scope = 'area' AND scope_id = 'lobby' AND variant = 'desktop'").fetchone()["layout_json"])
    assert "profile" not in stored["items"]["camera:c1"]


@pytest.mark.parametrize(
    "items, needle",
    [
        ({"camera:c1": {**NVR_CARD, "profile": "ultra"}}, "profile"),
        ({"camera:c1": {**NVR_CARD, "profile": 1}}, "profile"),
        ({"card:lighting": {"x": 0, "y": 0, "w": 6, "h": 30, "profile": "main"}}, "only a camera card"),
    ],
)
def test_camera_card_stream_profile_validation_refuses(dev_app, items, needle):  # noqa: F811
    app, _ = dev_app
    c = TestClient(app)
    r = _put(c, "lobby", _layout(items))
    assert r.status_code == 422, r.text
    assert needle in json.dumps(r.json(), ensure_ascii=False), r.text
    assert c.get(f"{LAYOUT}/area/lobby").json()["desktop"] is None


def test_camera_cards_belong_to_the_area_screen_and_are_capped(dev_app):  # noqa: F811
    app, _ = dev_app
    c = TestClient(app)
    r = c.put(f"{LAYOUT}/building/main", json={"variant": "desktop", "revision": 0, "layout": _layout({"camera:c1": NVR_CARD})})
    assert r.status_code == 422
    too_many = {f"camera:c{i}": {"x": (i % 6) * 2, "y": (i // 6) * 32, "w": 2, "h": 30, "camera": NVR_CARD["camera"]} for i in range(mod.MAX_CAMERA_CARDS + 1)}
    r = _put(c, "lobby", _layout(too_many))
    assert r.status_code == 422 and "at most" in r.text
    ok = {k: v for k, v in list(too_many.items())[: mod.MAX_CAMERA_CARDS]}
    assert _put(c, "lobby", _layout(ok)).status_code == 200


def test_camera_cards_stay_in_their_area_on_copy_to_all_areas_and_the_write_is_audited_without_the_layout(dev_app):  # noqa: F811
    app, _ = dev_app
    c = TestClient(app)
    assert _put(c, "lobby", _layout({"camera:c1": NVR_CARD})).status_code == 200
    r = c.post(f"{LAYOUT}/area/lobby/copy-to-all-areas", json={"revision": 1})
    assert r.status_code == 200
    # a camera is area-specific (owner request 2026-09-30, card library): "העתק לכל האזורים" copies the other cards, never a camera card
    assert "camera:c1" not in c.get(f"{LAYOUT}/area/office").json()["desktop"]["layout"]["items"]
    assert "camera:c1" in c.get(f"{LAYOUT}/area/lobby").json()["desktop"]["layout"]["items"]
    rows = _audit(app, "devices.layout.update")
    assert rows and "camera" not in (rows[-1]["details_json"] or "") and "nvr-1" not in (rows[-1]["details_json"] or "")


# ------------------------------------------------------------------ the mapping

def test_channel_suffix_rule():
    assert cc.channel_of("camera.x_101") == (1, "main")
    assert cc.channel_of("camera.x_102") == (1, "sub")
    assert cc.channel_of("camera.x_1601") == (16, "main")
    assert cc.channel_of("camera.x_1002") == (10, "sub")
    assert cc.channel_of("camera.x_25601") == (256, "main")
    for bad in ("camera.x_103", "camera.x_01", "camera.x_1", "camera.front_door", "camera.x_101_extra", "camera.x_0001", "camera.x_00001"):
        assert cc.channel_of(bad) is None, bad


def test_nvr_channels_are_linked_to_their_catalogue_camera(cam_app):
    app, _s, _c, ids = cam_app
    with app.state.db.connection() as conn:
        link = cc.link_ha_cameras(conn)
    assert link[NVR_ENTITY] == {"recorder_id": "nvr-1", "channel": 1, "camera_id": ids[1], "profile": "main"}
    assert link[NVR_ENTITY_SUB]["camera_id"] == ids[1] and link[NVR_ENTITY_SUB]["profile"] == "sub"
    assert link[NVR_ENTITY_2]["camera_id"] == ids[2]


def test_the_mapping_is_conservative(cam_app):
    app, _s, c, ids = cam_app

    def linked() -> dict:
        with app.state.db.connection() as conn:
            return cc.link_ha_cameras(conn)

    # not the Hikvision integration / registry not known: never linked
    _seed_entity(app, "camera.ds_7616nxi_k2_d_odd_301", platform="generic")
    _seed_entity(app, "camera.ds_7616nxi_k2_d_nop_301", platform=None)
    assert "camera.ds_7616nxi_k2_d_odd_301" not in linked() and "camera.ds_7616nxi_k2_d_nop_301" not in linked()
    # a standalone Hikvision camera of the same integration does not carry the recorder's model
    _seed_entity(app, "camera.front_door_101", device_id="dev-door")
    assert "camera.front_door_101" not in linked()
    # the channel must be in the catalogue (and enabled)
    _seed_entity(app, "camera.ds_7616nxi_k2_d_ghost_901")
    assert "camera.ds_7616nxi_k2_d_ghost_901" not in linked()
    assert c.patch(f"/api/v1/cameras/{ids[2]}", json={"enabled": False}).status_code == 200
    assert NVR_ENTITY_2 not in linked() and NVR_ENTITY in linked()
    assert c.patch(f"/api/v1/cameras/{ids[2]}", json={"enabled": True}).status_code == 200
    # a removed entity is not linked
    with app.state.db.connection() as conn:
        conn.execute("UPDATE ha_entities SET removed_at = ? WHERE entity_id = ?", (now_iso(), NVR_ENTITY_2))
    assert NVR_ENTITY_2 not in linked()
    with app.state.db.connection() as conn:
        conn.execute("UPDATE ha_entities SET removed_at = NULL WHERE entity_id = ?", (NVR_ENTITY_2,))
    assert NVR_ENTITY_2 in linked()
    # entities of the model on TWO registry devices (two recorders of one model): none of them is linked
    _seed_entity(app, "camera.ds_7616nxi_k2_d_other_101", device_id="dev-other-nvr")
    assert linked() == {}
    with app.state.db.connection() as conn:
        conn.execute("DELETE FROM ha_entities WHERE entity_id = 'camera.ds_7616nxi_k2_d_other_101'")
    assert NVR_ENTITY in linked()
    # a recorder whose model the discovery has not stored: nothing is linked
    with app.state.db.connection() as conn:
        conn.execute("UPDATE recorders SET model = NULL")
    assert linked() == {}


# ------------------------------------------------------------------ resolve

def _resolve(c, headers=None, **q):
    return c.get(f"{CARD}/resolve", params=q, headers=headers)


def test_resolve_an_nvr_source(cam_app):
    app, _s, c, ids = cam_app
    r = _resolve(c, kind="nvr", recorder_id="nvr-1", channel=2).json()
    assert r["state"] == "live" and r["kind"] == "nvr" and r["camera_id"] == ids[2] and r["name"] == "חצר" and r["channel"] == 2 and r["recorder_id"] == "nvr-1"
    assert "encoding" in r and r["status"] in ("online", "offline", "unknown")
    assert _resolve(c, kind="nvr", recorder_id="nvr-1", channel=9).json() == {"state": "missing"}
    assert c.patch(f"/api/v1/cameras/{ids[3]}", json={"enabled": False}).status_code == 200
    assert _resolve(c, kind="nvr", recorder_id="nvr-1", channel=3).json() == {"state": "disabled", "kind": "nvr"}
    assert _resolve(c, kind="nvr", recorder_id="nvr-1").status_code == 422  # channel missing
    assert _resolve(c, kind="ha").status_code == 422
    assert _resolve(c, kind="ha", entity_id="light.lobby").status_code == 422  # a camera entity id only
    assert _resolve(c, kind="rtsp").status_code == 422


def test_resolve_an_nvr_channel_through_its_home_assistant_entity(cam_app):
    _app, _s, c, ids = cam_app
    main = _resolve(c, kind="ha", entity_id=NVR_ENTITY).json()
    assert main["state"] == "live" and main["kind"] == "ha" and main["camera_id"] == ids[1] and main["entity_id"] == NVR_ENTITY and main["profile_hint"] == "main"
    sub = _resolve(c, kind="ha", entity_id=NVR_ENTITY_SUB).json()
    assert sub["camera_id"] == ids[1] and sub["profile_hint"] == "sub"
    assert _resolve(c, kind="ha", entity_id="camera.nowhere").json() == {"state": "missing"}


def test_resolve_a_standalone_home_assistant_camera_is_still_only(cam_app):
    app, _s, c, _ids = cam_app
    _seed_entity(app, "camera.garden_cam", platform="generic", device_id="dev-garden", name="מצלמת גינה")
    r = _resolve(c, kind="ha", entity_id="camera.garden_cam").json()
    assert r == {"state": "still_only", "kind": "ha", "entity_id": "camera.garden_cam", "name": "מצלמת גינה", "status": "online"}
    assert "camera_id" not in r


def test_resolve_needs_devices_read_and_names_nothing_to_someone_who_may_not_watch(cam_app):
    app, s, c, ids = cam_app
    bind(c, s, "vera", "viewer", "installation", "*")
    bind(c, s, "kim", "kiosk", "installation", "*")  # video.live but no devices.read
    _deny(app, "vera", "viewer", "camera", ids[2])
    v = as_user("vera")
    ok = _resolve(c, v, kind="nvr", recorder_id="nvr-1", channel=1).json()
    assert ok["state"] == "live" and ok["camera_id"] == ids[1]
    # a denied camera: forbidden, nothing about it - by channel and through its entity - and audited like a refused live view
    assert _resolve(c, v, kind="nvr", recorder_id="nvr-1", channel=2).json() == {"state": "forbidden"}
    assert _resolve(c, v, kind="ha", entity_id=NVR_ENTITY_2).json() == {"state": "forbidden"}
    denied = [r for r in _audit(app, "video.live") if r["decision"] == "denied" and r["resource_id"] == ids[2]]
    assert len(denied) == 2
    # the same caller's standalone HA camera: they hold video.live installation-wide, so it resolves to a still
    _seed_entity(app, "camera.garden_cam", platform="generic", device_id="dev-garden")
    assert _resolve(c, v, kind="ha", entity_id="camera.garden_cam").json()["state"] == "still_only"
    # no devices.read anywhere: the audited 403 of the device screens, not a resolved card
    assert _resolve(c, as_user("kim"), kind="nvr", recorder_id="nvr-1", channel=1).status_code == 403
    assert c.get(f"{CARD}/sources", headers=as_user("kim")).status_code == 403
    assert c.get(f"{CARD}/still", params={"entity_id": "camera.garden_cam"}, headers=as_user("kim")).status_code == 403
    assert c.get(f"{CARD}/sources", headers=as_user("nobody")).status_code == 403


def test_a_camera_scoped_viewer_is_offered_and_resolves_only_their_cameras(cam_app):
    app, s, c, ids = cam_app
    # devices.read at the floor (the device screens) + video.live only on camera 1 (the camera scope of services/access.py)
    bind(c, s, "flo", "viewer", "installation", "*")
    for ch in (2, 3):
        _deny(app, "flo", "viewer", "camera", ids[ch])
    v = as_user("flo")
    src = c.get(f"{CARD}/sources", headers=v).json()
    assert [cam["channel"] for g in src["recorders"] for cam in g["cameras"]] == [1]
    assert [h["entity_id"] for h in src["ha_cameras"] if h["mode"] == "live"] == [NVR_ENTITY, NVR_ENTITY_SUB]
    assert _resolve(c, v, kind="nvr", recorder_id="nvr-1", channel=3).json()["state"] == "forbidden"
    # the administrator sees every channel
    admin = c.get(f"{CARD}/sources").json()
    assert [cam["channel"] for cam in admin["recorders"][0]["cameras"]] == [1, 2, 3] and admin["recorders"][0]["recorder_id"] == "nvr-1"


def test_the_picker_lists_channels_by_recorder_and_the_cameras_that_are_not_channels(cam_app):
    app, _s, c, ids = cam_app
    _seed_entity(app, "camera.garden_cam", platform="generic", device_id="dev-garden", name="מצלמת גינה", area=None)
    _seed_entity(app, "camera.off_cam", platform="generic", device_id="dev-off", disabled=1)
    body = c.get(f"{CARD}/sources").json()
    group = body["recorders"][0]
    assert group["recorder_id"] == "nvr-1" and [x["camera_id"] for x in group["cameras"]] == [ids[1], ids[2], ids[3]]
    assert group["cameras"][0]["entity_id"] == NVR_ENTITY  # the entity of the main stream names the channel
    by_id = {h["entity_id"]: h for h in body["ha_cameras"]}
    assert by_id[NVR_ENTITY]["mode"] == "live" and by_id[NVR_ENTITY]["channel"] == 1 and by_id[NVR_ENTITY]["recorder_id"] == "nvr-1"
    assert by_id["camera.garden_cam"]["mode"] == "still_only" and by_id["camera.garden_cam"]["recorder_id"] is None
    assert "camera.off_cam" not in by_id  # a disabled entity is not offered
    text = json.dumps(body)
    for secret in ("secret-token-value", "rtsp://", "password"):
        assert secret not in text


# ------------------------------------------------------------------ the still picture

def test_a_standalone_camera_still_is_cached_and_never_serves_an_nvr_channel(cam_app, monkeypatch):
    app, _s, c, _ids = cam_app
    _seed_entity(app, "camera.garden_cam", platform="generic", device_id="dev-garden")
    calls: list[str] = []

    def fake(_settings, entity_id):
        calls.append(entity_id)
        return JPEG, "image/jpeg"

    monkeypatch.setattr(ha_client, "camera_image", fake)
    r = c.get(f"{CARD}/still", params={"entity_id": "camera.garden_cam"})
    assert r.status_code == 200 and r.content == JPEG and r.headers["content-type"] == "image/jpeg"
    assert "secret-token-value" not in json.dumps(dict(r.headers))
    c.get(f"{CARD}/still", params={"entity_id": "camera.garden_cam"})
    assert calls == ["camera.garden_cam"]  # the second look inside the window is the cached picture
    # an NVR channel is served by its own snapshot route under the camera scope, never here
    assert c.get(f"{CARD}/still", params={"entity_id": NVR_ENTITY}).status_code == 409
    assert c.get(f"{CARD}/still", params={"entity_id": "camera.nowhere"}).status_code == 404
    assert c.get(f"{CARD}/still", params={"entity_id": "light.lobby"}).status_code == 422


def test_still_refresh_window_stale_copy_and_failure(cam_app, monkeypatch):
    import os
    import time

    app, s, c, _ids = cam_app
    _seed_entity(app, "camera.garden_cam", platform="generic", device_id="dev-garden")
    state = {"fail": False, "n": 0}

    def fake(_settings, entity_id):
        state["n"] += 1
        if state["fail"]:
            raise ApiError(503, "ha_unavailable", "x", retryable=True)
        return JPEG + bytes([state["n"]]), "image/jpeg"

    monkeypatch.setattr(ha_client, "camera_image", fake)
    # nothing cached and Home Assistant down: the error, not an empty picture
    state["fail"] = True
    assert c.get(f"{CARD}/still", params={"entity_id": "camera.garden_cam"}).status_code == 503
    state["fail"] = False
    first = c.get(f"{CARD}/still", params={"entity_id": "camera.garden_cam"})
    assert first.status_code == 200 and state["n"] == 2
    # older than the window: refreshed; Home Assistant down again: the stale copy is served and marked
    folder = s.data_dir / "snapshots"
    (path,) = folder.glob("ha-*.img")
    old = time.time() - 3600
    os.utime(path, (old, old))
    state["fail"] = True
    stale = c.get(f"{CARD}/still", params={"entity_id": "camera.garden_cam"})
    assert stale.status_code == 200 and stale.headers["X-Snapshot-Stale"] == "true" and stale.content == first.content
    state["fail"] = False
    fresh = c.get(f"{CARD}/still", params={"entity_id": "camera.garden_cam"})
    assert fresh.status_code == 200 and "X-Snapshot-Stale" not in fresh.headers and fresh.content != first.content
    assert cams_mod.STILL_MIN_AGE_S >= 10


def test_still_needs_video_live_installation_wide(cam_app, monkeypatch):
    app, s, c, ids = cam_app
    _seed_entity(app, "camera.garden_cam", platform="generic", device_id="dev-garden")
    monkeypatch.setattr(ha_client, "camera_image", lambda _s, _e: (JPEG, "image/jpeg"))
    bind(c, s, "vera", "viewer", "installation", "*")
    _deny(app, "vera", "viewer", "camera", ids[1])  # a deny on any camera does not make a standalone picture unreachable...
    assert c.get(f"{CARD}/still", params={"entity_id": "camera.garden_cam"}, headers=as_user("vera")).status_code == 200
    bind(c, s, "cara", "viewer", "camera", ids[1])  # ...but video.live on one camera alone does not reach it
    assert c.get(f"{CARD}/still", params={"entity_id": "camera.garden_cam"}, headers=as_user("cara")).status_code == 403


def test_camera_image_helper_refuses_what_is_not_a_picture(settings, monkeypatch):
    from dataclasses import replace

    import httpx

    s = replace(settings, ha_url="http://ha.local:8123", ha_token="tok")
    seen = {}

    def handler(request: httpx.Request) -> httpx.Response:
        seen["url"] = str(request.url)
        seen["auth"] = request.headers.get("authorization")
        return httpx.Response(200, content=b"<html>login</html>")

    real = httpx.Client
    monkeypatch.setattr(ha_client.httpx, "Client", lambda **kw: real(transport=httpx.MockTransport(handler), **kw))
    with pytest.raises(ApiError) as e:
        ha_client.camera_image(s, "camera.garden_cam")
    assert e.value.code == "snapshot_unavailable"
    assert seen["url"] == "http://ha.local:8123/api/camera_proxy/camera.garden_cam" and seen["auth"] == "Bearer tok"
    with pytest.raises(ValueError):
        ha_client.camera_image(s, "camera.x/../../states")
    with pytest.raises(ValueError):
        ha_client.camera_image(s, "light.lobby")
    monkeypatch.setattr(ha_client.httpx, "Client", lambda **kw: real(transport=httpx.MockTransport(lambda r: httpx.Response(200, content=JPEG)), **kw))
    assert ha_client.camera_image(s, "camera.garden_cam") == (JPEG, "image/jpeg")
    monkeypatch.setattr(ha_client.httpx, "Client", lambda **kw: real(transport=httpx.MockTransport(lambda r: httpx.Response(200, content=JPEG + b"x" * ha_client.CAMERA_IMAGE_MAX)), **kw))
    with pytest.raises(ApiError) as e2:
        ha_client.camera_image(s, "camera.garden_cam")
    assert e2.value.details.get("reason") == "too_large"
    monkeypatch.setattr(ha_client.httpx, "Client", lambda **kw: real(transport=httpx.MockTransport(lambda r: httpx.Response(401)), **kw))
    with pytest.raises(ApiError) as e3:
        ha_client.camera_image(s, "camera.garden_cam")
    assert e3.value.code == "ha_forbidden"
