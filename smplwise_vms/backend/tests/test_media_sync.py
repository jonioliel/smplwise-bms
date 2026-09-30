"""CR-015: the media device model on the database - the `ha_devices` mirror (MACs normalised and private), the rebuild after every
registry refresh (new devices unapproved, tombstones, stable keys), `media_devices_changed` / `media_state` frames and their scope, and the
rule that `entity_picture` never reaches an attribute or an API reply."""
from __future__ import annotations

import asyncio
import json
import queue
import re
import time
from dataclasses import replace
from typing import Any

import media_seed as seed
import pytest
from conftest import as_user, bind, png_bytes, seed_tree
from fastapi.testclient import TestClient

from smplwise.main import create_app
from smplwise.services import ha_client, ha_sync, media_store

MAC_RE = re.compile(r"(?i)\b[0-9a-f]{2}([:-])[0-9a-f]{2}(\1[0-9a-f]{2}){4}\b|\b[0-9a-f]{12}\b")


@pytest.fixture()
def app_c(settings):
    app = create_app(settings)
    c = TestClient(app)
    return app, c


def rows(app, sql: str, *args: Any) -> list[dict[str, Any]]:
    with app.state.db.connection(mode="read") as conn:
        return [dict(r) for r in conn.execute(sql, args).fetchall()]


def test_migrations_create_the_tables_and_a_new_device_is_unapproved(app_c):
    app, c = app_c
    seed.install(c)
    tables = {r["name"] for r in rows(app, "SELECT name FROM sqlite_master WHERE type = 'table'")}
    assert {"ha_devices", "media_devices", "media_device_endpoints", "media_link_rules", "media_layouts", "media_commands"} <= tables
    devices = rows(app, "SELECT * FROM media_devices WHERE removed_at IS NULL")
    assert len(devices) == 7  # six screens + the receiver
    assert {d["approved"] for d in devices} == {0}, "a new device is never managed until an administrator approves it (decision 1b)"
    assert {d["kind"] for d in devices} == {"screen", "receiver"} and all(len(d["device_key"]) == 32 for d in devices)
    assert c.get("/api/v1/multimedia/devices").json() == {"devices": []}, "nothing is listed before the approval"


def test_the_device_mirror_normalises_macs_and_keeps_private_values_in_the_backend(app_c):
    app, c = app_c
    seed.install(c)
    mirrored = {r["device_id"]: r for r in rows(app, "SELECT * FROM ha_devices")}
    assert len(mirrored) == len(seed.DEVICES)
    assert json.loads(mirrored["d_sam"]["connections_json"])[0] == ["mac", "aabbcc000001"]
    assert json.loads(mirrored["d_cast"]["connections_json"])[0] == ["mac", "aabbcc000001"], "the same MAC in another spelling normalises to the same value"
    assert ["upnp", "uuid:11111111-2222-3333-4444-555555555555"] in json.loads(mirrored["d_sam"]["identifiers_json"])
    # nothing private reaches an API reply: every media route's body is scanned for MACs, UUIDs and hidden endpoint ids
    seed.approve_all(c)
    key = seed.key_of(c, "media_player.tv_living")
    bodies = [c.get("/api/v1/multimedia/devices").text, c.get(f"/api/v1/multimedia/devices/{key}").text, c.get("/api/v1/multimedia/status").text, c.get("/api/v1/multimedia/layout").text,
              c.get("/api/v1/multimedia/profiles").text, c.get("/api/v1/multimedia/remote-default").text, c.get("/api/v1/multimedia/admin/devices").text]
    blob = "\n".join(bodies)
    assert not MAC_RE.search(blob.replace(key, "")), "a MAC in an API reply"
    assert "11111111" not in blob and "cast-uuid" not in blob and "ssv-entry" not in blob, "an HA identifier in an API reply"
    public = "\n".join(bodies[:2])
    for hidden in ("tv_living_cast", "tv_living_st", "tv_living_ma", "media_player.tv_living", "remote.tv_living"):
        assert hidden not in public, f"{hidden}: an entity id in a non-administrator reply"
    assert "192.0.2" not in blob and "ip_address" not in blob


def test_a_device_removed_from_ha_is_marked_removed_and_its_row_survives(app_c):
    app, c = app_c
    seed.install(c)
    assert len(rows(app, "SELECT 1 FROM ha_devices WHERE removed_at IS NULL")) == len(seed.DEVICES)
    smaller = [d for d in seed.DEVICES if d["id"] != "d_rcv"]
    assert c.post("/api/v1/ha/dev/registry", json={"entities": [e for e in seed.ENTITY_REGISTRY if e["device_id"] != "d_rcv"], "devices": smaller, "areas": seed.AREAS, "floors": seed.FLOORS}).status_code == 200
    assert len(rows(app, "SELECT 1 FROM ha_devices WHERE removed_at IS NOT NULL")) == 1


def test_the_rebuild_is_stable_and_reports_what_changed(app_c):
    app, c = app_c
    seed.install(c)
    before = {r["device_key"]: r["anchor_entity_id"] for r in rows(app, "SELECT device_key, anchor_entity_id FROM media_devices")}
    q = ha_sync.subscribe()
    try:
        seed.install(c)  # the same registry again
        again = {r["device_key"]: r["anchor_entity_id"] for r in rows(app, "SELECT device_key, anchor_entity_id FROM media_devices")}
        assert again == before, "keys survive a refresh"
        frames = []
        while True:
            try:
                frames.append(q.get_nowait())
            except queue.Empty:
                break
        assert not [f for f in frames if f.get("type") == "media_devices_changed"], "nothing moved: no refetch notice"
        # a new screen appears in HA: one notice, one new unapproved device, the others keep their keys
        seed.install(c, extra_states=[])
        new_entity = {"entity_id": "media_player.tv_guest", "id": "reg-guest", "platform": "webostv", "device_id": "d_guest", "unique_id": "u-guest"}
        seed.set_state(c, "media_player.tv_guest", "on", friendly_name="Guest", device_class="tv", supported_features=seed.TURN_ON | seed.TURN_OFF)
        assert c.post("/api/v1/ha/dev/registry", json={"entities": [*seed.ENTITY_REGISTRY, new_entity], "devices": [*seed.DEVICES, {"id": "d_guest", "name": "Guest TV", "connections": [], "identifiers": []}], "areas": seed.AREAS, "floors": seed.FLOORS}).status_code == 200
        frames = []
        while True:
            try:
                frames.append(q.get_nowait())
            except queue.Empty:
                break
        assert [f["reason"] for f in frames if f.get("type") == "media_devices_changed"] == ["registry"]
    finally:
        ha_sync.unsubscribe(q)
    now = {r["device_key"]: r for r in rows(app, "SELECT * FROM media_devices")}
    assert set(before) < set(now) and all(now[k]["anchor_entity_id"] == a for k, a in before.items())
    guest = next(r for r in now.values() if r["anchor_entity_id"] == "media_player.tv_guest")
    assert guest["approved"] == 0 and guest["kind"] == "screen"


def test_a_vanished_device_keeps_its_curation_and_its_key_when_it_comes_back(app_c):
    app, c = app_c
    seed.install(c)
    seed.approve_all(c)
    key = seed.key_of(c, "media_player.lg_office")
    assert c.put(f"/api/v1/multimedia/admin/devices/{key}", json={"display_name": "מסך מיוחד", "public": True, "volume_max": 40}).status_code == 200
    gone = [e for e in seed.ENTITY_REGISTRY if e["device_id"] != "d_lg"]
    with app.state.db.connection() as conn:  # what the sync's tombstone pass does for an entity HA no longer has
        conn.execute("UPDATE ha_entities SET removed_at = '2026-09-30T10:00:00Z' WHERE entity_id = 'media_player.lg_office'")
    assert c.post("/api/v1/ha/dev/registry", json={"entities": gone, "devices": [d for d in seed.DEVICES if d["id"] != "d_lg"], "areas": seed.AREAS, "floors": seed.FLOORS}).status_code == 200
    row = rows(app, "SELECT * FROM media_devices WHERE device_key = ?", key)[0]
    assert row["removed_at"] is not None and row["display_name"] == "מסך מיוחד", "tombstoned, curation kept"
    assert key not in {d["key"] for d in c.get("/api/v1/multimedia/devices").json()["devices"]}
    seed.install(c)  # it comes back
    back = rows(app, "SELECT * FROM media_devices WHERE device_key = ?", key)[0]
    assert back["removed_at"] is None and back["approved"] == 1 and back["is_public"] == 1 and back["volume_max"] == 40


def test_the_janitor_deletes_a_tombstone_after_thirty_days_and_prunes_the_layout(app_c):
    app, c = app_c
    seed.install(c)
    key = seed.key_of(c, "media_player.generic_tv")
    assert c.put("/api/v1/multimedia/layout", json={"layout": {"version": 1, "order": [key], "pinned": [key], "cards": {key: {"on": False, "size": "l"}}}, "base_revision": 0}).status_code == 200
    with app.state.db.connection() as conn:
        conn.execute("UPDATE media_devices SET removed_at = '2020-01-01T00:00:00Z' WHERE device_key = ?", (key,))
        conn.execute("INSERT INTO media_commands(id, device_key, principal_user_id, client_request_id, command, status, created_ms, created_at) VALUES ('c1', ?, 'u', 'r1', 'key', 'sent', 1, '2020-01-01T00:00:00Z')", (key,))
    done = media_store.janitor(app.state.db)
    assert done == {"devices": 1, "commands": 1}
    assert rows(app, "SELECT 1 FROM media_devices WHERE device_key = ?", key) == [] and rows(app, "SELECT 1 FROM media_device_endpoints WHERE device_key = ?", key) == []
    layout = c.get("/api/v1/multimedia/layout").json()
    assert layout["installation"]["order"] == [] and layout["installation"]["pinned"] == [] and layout["installation"]["cards"] == {} and layout["revision"] == 2


def test_entity_picture_is_kept_in_memory_only_never_in_attributes_or_an_api_reply(app_c):
    app, c = app_c
    seed.install(c)
    seed.approve_all(c)
    secret_path = "/api/media_player_proxy/media_player.tv_living_cast?token=abcdef0123456789&cache=1"
    seed.set_state(c, "media_player.tv_living_cast", "playing", entity_picture=secret_path, media_content_type="movie", media_title="Film", supported_features=seed.PLAY | seed.PAUSE)
    stored = rows(app, "SELECT attributes_json FROM ha_entities WHERE entity_id = 'media_player.tv_living_cast'")[0]["attributes_json"]
    assert "entity_picture" not in stored and "abcdef0123456789" not in stored
    assert "entity_picture" not in ha_sync.ATTR_ALLOW and "ip_address" not in ha_sync.ATTR_ALLOW
    key = seed.key_of(c, "media_player.tv_living")
    for url in ("/api/v1/multimedia/devices", f"/api/v1/multimedia/devices/{key}", "/api/v1/ha/entities/media_player.tv_living_cast"):
        assert "abcdef0123456789" not in c.get(url).text and "media_player_proxy" not in c.get(url).text, url
    now = c.get(f"/api/v1/multimedia/devices/{key}").json()["live"]["now"]
    assert now["artwork"].startswith(f"api/v1/multimedia/devices/{key}/artwork?v=") and "token" not in now["artwork"]
    # an app or channel logo is not content art
    seed.set_state(c, "media_player.tv_living_cast", "playing", entity_picture=secret_path, media_content_type="app", media_title="Film")
    assert c.get(f"/api/v1/multimedia/devices/{key}").json()["live"]["now"]["artwork"] is None
    assert c.get(f"/api/v1/multimedia/devices/{key}/artwork").status_code == 404


def test_the_attribute_allow_list_and_the_size_of_a_tv_source_list(app_c):
    app, c = app_c
    for name in ("source_list", "app_id", "app_name", "media_content_type", "media_channel", "media_duration", "media_position", "media_position_updated_at", "sound_output", "sound_mode",
                 "art_mode_status", "activity_list", "current_activity", "group_members", "mass_player_type", "active_queue"):
        assert name in ha_sync.ATTR_ALLOW, name
    big = [f"Source number {i:03d} " + "x" * 50 for i in range(150)]  # 150 items: only 100 are kept, none is cut
    kept = json.loads(ha_sync.trim_attributes({"friendly_name": "TV", "source_list": big + ["y" * 200], "activity_list": ["netflix://"] * 3 + ["a" * 300], "ip_address": "192.0.2.1"}))
    assert len(kept["source_list"]) == 100 and kept["source_list"][0] == big[0] and all(len(s) <= 80 for s in kept["source_list"])
    assert kept["activity_list"] == ["netflix://"] and "ip_address" not in kept
    # a list that long never corrupts the JSON of the other attributes
    assert kept["friendly_name"] == "TV"


def test_media_frames_follow_media_read_not_entity_state_read(app_c):
    app, c = app_c
    ids = seed_tree(c)
    seed.install(c)
    seed.approve_all(c)
    for fid in (ids["floor2"], ids["floor3"]):
        asset = c.post(f"/api/v1/floors/{fid}/plan-assets", files={"file": ("p.png", png_bytes(), "image/png")}).json()
        v = c.post(f"/api/v1/floors/{fid}/plan-versions", json={"asset_id": asset["id"]}).json()
        c.post(f"/api/v1/plan-versions/{v['id']}/publish")
    assert c.post(f"/api/v1/floors/{ids['floor2']}/anchors", json={"resource_type": "ha_entity", "resource_id": "media_player.tv_living", "x": 0.2, "y": 0.2}).status_code == 201
    assert c.post(f"/api/v1/floors/{ids['floor3']}/anchors", json={"resource_type": "ha_entity", "resource_id": "media_player.lg_office", "x": 0.3, "y": 0.3}).status_code == 201
    bind(c, app.state.settings, "ron", "viewer", "floor", ids["floor2"])
    living = seed.key_of(c, "media_player.tv_living")
    office = seed.key_of(c, "media_player.lg_office")
    media_store.INDEX.last_sent.clear()
    subscribers = len(ha_sync._subscribers)
    with c.websocket_connect("/api/v1/ha/ws", headers=as_user("ron")) as ws:
        for _ in range(200):  # the socket subscribes to the bus just after it accepts
            if len(ha_sync._subscribers) > subscribers:
                break
            time.sleep(0.01)
        seed.set_state(c, "media_player.lg_office", "off")  # floor3: invisible to ron
        seed.set_state(c, "media_player.tv_living", "paused")  # floor2
        got: list[dict[str, Any]] = []
        while len(got) < 1:
            msg = json.loads(ws.receive_text())
            if msg["type"] == "media_state":
                got.append(msg)
        frame = got[0]
        assert frame["payload"]["device_key"] == living and frame["payload"]["entity_id"] == "media_player.tv_living"
        assert frame["payload"]["live"]["play"] == "paused" and "type" not in frame["payload"]
        assert office != frame["payload"]["device_key"]


def test_media_state_is_throttled_per_device_and_never_raises(app_c, monkeypatch):
    app, c = app_c
    seed.install(c)
    seed.approve_all(c)
    media_store.INDEX.last_sent.clear()
    q = ha_sync.subscribe()
    try:
        for state in ("paused", "playing", "paused", "playing"):
            seed.set_state(c, "media_player.tv_living", state)
        frames = []
        while True:
            try:
                frames.append(q.get_nowait())
            except queue.Empty:
                break
        assert len([f for f in frames if f.get("type") == "media_state"]) == 1, "four events inside 250 ms: one frame"
        # a failure inside the hook never reaches the state feed
        monkeypatch.setattr(media_store, "load_catalog", lambda *a, **k: (_ for _ in ()).throw(RuntimeError("boom")))
        media_store.INDEX.last_sent.clear()
        seed.set_state(c, "media_player.tv_living", "idle")
    finally:
        ha_sync.unsubscribe(q)


def test_an_unapproved_screen_sends_no_media_state(app_c):
    app, c = app_c
    seed.install(c)  # not approved
    media_store.INDEX.last_sent.clear()
    q = ha_sync.subscribe()
    try:
        seed.set_state(c, "media_player.tv_living", "paused")
        frames = []
        while True:
            try:
                frames.append(q.get_nowait())
            except queue.Empty:
                break
        assert [f for f in frames if f.get("type") == "media_state"] == []
    finally:
        ha_sync.unsubscribe(q)


# ------------------------------------------------------------------------------------------------ the real session refresh


class FakeHa:
    def __init__(self) -> None:
        self.calls: list[str] = []

    async def call(self, msg_type: str, **kw: Any) -> dict[str, Any]:
        self.calls.append(msg_type)
        ok = lambda r: {"type": "result", "success": True, "result": r}  # noqa: E731
        if msg_type == "get_config":
            return ok({"version": "2026.9.0"})
        if msg_type == "get_states":
            return ok(seed.states())
        if msg_type == "subscribe_events":
            return ok(None)
        listing = {"config/entity_registry/list": seed.ENTITY_REGISTRY, "config/device_registry/list": seed.DEVICES, "config/area_registry/list": seed.AREAS, "config/floor_registry/list": seed.FLOORS}.get(msg_type)
        return ok(listing) if listing is not None else {"type": "result", "success": False}


def test_the_sync_sessions_registry_refresh_fills_the_mirror_and_the_model(settings, monkeypatch):
    s = replace(settings, ha_url="http://ha.local:8123", ha_token="secret-token-value")
    app = create_app(s)
    fake = FakeHa()

    async def ws_session(_settings, on_ready, on_event, stop, on_message=None):
        await on_ready(fake.call)

    monkeypatch.setattr(ha_client, "ws_session", ws_session)
    sync = ha_sync.HaSync()
    sync.db, sync.settings = app.state.db, s
    q = ha_sync.subscribe()
    try:
        asyncio.run(sync._session(asyncio.Event()))
    finally:
        ha_sync.unsubscribe(q)
        ha_sync.STATE.connected = False
    assert len(rows(app, "SELECT 1 FROM ha_devices WHERE removed_at IS NULL")) == len(seed.DEVICES)
    assert len(rows(app, "SELECT 1 FROM media_devices WHERE removed_at IS NULL")) == 7
    assert rows(app, "SELECT role FROM media_device_endpoints WHERE endpoint_id = 'ha:media_player.tv_living_ma'")[0]["role"] == "ma_import"
