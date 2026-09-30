"""Synthetic media installation for the CR-015 tests: Home Assistant registries and states with one of every kind of screen the
multimedia area has to tell apart. Every name, id, MAC and UUID is invented (nothing comes from a real system).

Screens (by the `key` of SCREENS):
  samsung  - a Samsung (ssv) TV in the living room: vendor media_player + remote, a Cast copy (shares a MAC), a SmartThings copy (shares a
             UUID) and a Music Assistant copy (its player id is the vendor entity id) - ONE device with five endpoints; linked to a receiver
  samsung2 - a second Samsung in the kitchen: same platform, another HA device - never merged with the first, even when a MAC is shared
  lg       - an LG TV in the office (webostv), sound going to an external output unless a test changes it
  lg_off   - an LG without a turn-on trigger (no TURN_ON bit, unavailable when off)
  android  - an Android TV in the bedroom: androidtv_remote media_player (no VOLUME_SET, no SELECT_SOURCE) + remote + a Cast copy (shares a MAC)
  generic  - a screen of an unknown brand (device class tv, platform `generic`)
  receiver - an AV receiver (device class receiver)

`install(client)` posts the states and the registries through the developer routes (`/ha/dev/states`, `/ha/dev/registry`), the same
mapping the sync's registry refresh uses."""
from __future__ import annotations

from typing import Any

from fastapi.testclient import TestClient

# MediaPlayerEntityFeature bits
PAUSE, SEEK, VOLUME_SET, VOLUME_MUTE, PREVIOUS, NEXT = 1, 2, 4, 8, 16, 32
TURN_ON, TURN_OFF, PLAY_MEDIA, VOLUME_STEP, SELECT_SOURCE, STOP, PLAY = 128, 256, 512, 1024, 2048, 4096, 16384
ALL = PAUSE | VOLUME_SET | VOLUME_MUTE | PREVIOUS | NEXT | TURN_ON | TURN_OFF | PLAY_MEDIA | VOLUME_STEP | SELECT_SOURCE | STOP | PLAY

NOW = "2026-09-30T10:00:00+00:00"

FLOORS = [{"floor_id": "ground", "name": "קומת קרקע", "level": 0}, {"floor_id": "upper", "name": "קומה 1", "level": 1}]
AREAS = [
    {"area_id": "living", "name": "סלון", "floor_id": "ground"},
    {"area_id": "kitchen", "name": "מטבח", "floor_id": "ground"},
    {"area_id": "office", "name": "חדר עבודה", "floor_id": "upper"},
    {"area_id": "bedroom", "name": "חדר שינה", "floor_id": "upper"},
]

MAC_SAMSUNG = "AA:BB:CC:00:00:01"
MAC_SAMSUNG2 = "AA:BB:CC:00:00:02"
MAC_ANDROID = "AA:BB:CC:00:00:03"
UUID_SAMSUNG = "uuid:11111111-2222-3333-4444-555555555555"

DEVICES = [
    {"id": "d_sam", "name": "Samsung living", "name_by_user": "טלוויזיה סלון", "manufacturer": "Samsung", "model": "QE55", "area_id": "living",
     "connections": [["mac", MAC_SAMSUNG]], "identifiers": [["samsungtv_smart", "ssv-entry-1"], ["upnp", UUID_SAMSUNG]]},
    {"id": "d_cast", "name": "Living room TV", "manufacturer": "Samsung", "model": "QE55", "area_id": "living",
     "connections": [["mac", MAC_SAMSUNG.lower().replace(":", "-")]], "identifiers": [["cast", "cast-uuid-0001"]]},
    {"id": "d_st", "name": "Samsung TV (SmartThings)", "manufacturer": "Samsung", "area_id": None,
     "connections": [], "identifiers": [["smartthings", "11111111-2222-3333-4444-555555555555"]]},
    {"id": "d_ma", "name": "Living room TV MA", "manufacturer": "Music Assistant", "area_id": None,
     "connections": [], "identifiers": [["music_assistant", "media_player.tv_living"]]},
    {"id": "d_sam2", "name": "Samsung kitchen", "name_by_user": "טלוויזיה מטבח", "manufacturer": "Samsung", "area_id": "kitchen",
     "connections": [["mac", MAC_SAMSUNG2]], "identifiers": [["samsungtv_smart", "ssv-entry-2"]]},
    {"id": "d_lg", "name": "LG office", "name_by_user": "מסך חדר עבודה", "manufacturer": "LG", "area_id": "office",
     "connections": [["mac", "AA:BB:CC:00:00:04"]], "identifiers": [["webostv", "lg-entry-1"]]},
    {"id": "d_lgoff", "name": "LG storage", "name_by_user": "מסך מחסן", "manufacturer": "LG", "area_id": "office",
     "connections": [["mac", "AA:BB:CC:00:00:05"]], "identifiers": [["webostv", "lg-entry-2"]]},
    {"id": "d_atv", "name": "Android bedroom", "name_by_user": "טלוויזיה חדר שינה", "manufacturer": "Sony", "area_id": "bedroom",
     "connections": [["mac", MAC_ANDROID]], "identifiers": [["androidtv_remote", "atv-entry-1"]]},
    {"id": "d_atvcast", "name": "Bedroom Android TV", "manufacturer": "Sony", "area_id": "bedroom",
     "connections": [["mac", MAC_ANDROID.lower()]], "identifiers": [["cast", "cast-uuid-0002"]]},
    {"id": "d_gen", "name": "Generic screen", "name_by_user": "מסך כללי", "manufacturer": "Acme", "area_id": "kitchen",
     "connections": [["mac", "AA:BB:CC:00:00:06"]], "identifiers": [["generic", "gen-entry-1"]]},
    {"id": "d_rcv", "name": "AV receiver", "name_by_user": "מגבר סלון", "manufacturer": "Denon", "area_id": "living",
     "connections": [["mac", "AA:BB:CC:00:00:07"]], "identifiers": [["denonavr", "rcv-entry-1"]]},
]


def _reg(entity_id: str, platform: str, device_id: str | None, unique_id: str | None = None, area: str | None = None) -> dict[str, Any]:
    return {"entity_id": entity_id, "id": f"reg-{entity_id}", "platform": platform, "device_id": device_id, "unique_id": unique_id or f"uid-{entity_id}", "area_id": area}


ENTITY_REGISTRY = [
    _reg("media_player.tv_living", "samsungtv_smart", "d_sam"),
    _reg("remote.tv_living", "samsungtv_smart", "d_sam"),
    _reg("media_player.tv_living_cast", "cast", "d_cast"),
    _reg("media_player.tv_living_st", "smartthings", "d_st"),
    _reg("media_player.tv_living_ma", "music_assistant", "d_ma", unique_id="media_player.tv_living"),
    _reg("media_player.tv_kitchen", "samsungtv_smart", "d_sam2"),
    _reg("remote.tv_kitchen", "samsungtv_smart", "d_sam2"),
    _reg("media_player.lg_office", "webostv", "d_lg"),
    _reg("media_player.lg_storage", "webostv", "d_lgoff"),
    _reg("media_player.tv_bedroom", "androidtv_remote", "d_atv"),
    _reg("remote.tv_bedroom", "androidtv_remote", "d_atv"),
    _reg("media_player.tv_bedroom_cast", "cast", "d_atvcast"),
    _reg("media_player.generic_tv", "generic", "d_gen"),
    _reg("media_player.receiver_living", "denonavr", "d_rcv"),
]


def _st(entity_id: str, state: str, **attrs: Any) -> dict[str, Any]:
    return {"entity_id": entity_id, "state": state, "attributes": attrs}


SOURCES_SAMSUNG = ["TV", "HDMI1", "HDMI2", "Netflix", "YouTube", "ספורט"]
SOURCES_LG = ["Live TV", "HDMI 1", "HDMI 2", "YouTube", "Netflix"]
ACTIVITIES = ["https://www.youtube.com", "netflix://", "com.plexapp.android"]


def states() -> list[dict[str, Any]]:
    return [
        _st("media_player.tv_living", "playing", friendly_name="Samsung living", device_class="tv", supported_features=ALL, source="Netflix", source_list=SOURCES_SAMSUNG,
            app_id="Netflix", media_title="סדרה · עונה 2", media_duration=3120, media_position=1520, media_position_updated_at="2026-09-30T09:59:00+00:00",
            volume_level=0.3, is_volume_muted=False),
        _st("remote.tv_living", "on", friendly_name="Samsung living remote"),
        _st("media_player.tv_living_cast", "idle", friendly_name="Living room TV", device_class="tv", supported_features=PLAY_MEDIA | TURN_ON | TURN_OFF | VOLUME_SET | VOLUME_MUTE | PLAY | PAUSE | STOP | SEEK),
        _st("media_player.tv_living_st", "on", friendly_name="Samsung TV (SmartThings)", device_class="tv", supported_features=TURN_ON | TURN_OFF | VOLUME_SET | SELECT_SOURCE),
        _st("media_player.tv_living_ma", "idle", friendly_name="Living room TV MA", device_class="speaker", supported_features=PLAY | PAUSE | STOP | NEXT | PREVIOUS | PLAY_MEDIA),
        _st("media_player.tv_kitchen", "off", friendly_name="Samsung kitchen", device_class="tv", supported_features=ALL, source_list=SOURCES_SAMSUNG),
        _st("remote.tv_kitchen", "on", friendly_name="Samsung kitchen remote"),
        _st("media_player.lg_office", "on", friendly_name="LG office", device_class="tv", supported_features=ALL & ~VOLUME_SET & ~SEEK, source="HDMI 1", source_list=SOURCES_LG,
            sound_output="external_arc", volume_level=0.2, is_volume_muted=False),
        _st("media_player.lg_storage", "unavailable", friendly_name="LG storage"),
        _st("media_player.tv_bedroom", "on", friendly_name="Android bedroom", device_class="tv", supported_features=PAUSE | VOLUME_MUTE | PREVIOUS | NEXT | TURN_ON | TURN_OFF | PLAY_MEDIA | VOLUME_STEP | STOP | PLAY,
            app_id="com.netflix.ninja", app_name="Netflix", volume_level=0.12),
        _st("remote.tv_bedroom", "on", friendly_name="Android bedroom remote", activity_list=ACTIVITIES, current_activity="netflix://"),
        _st("media_player.tv_bedroom_cast", "idle", friendly_name="Bedroom Android TV", device_class="tv", supported_features=PLAY_MEDIA | TURN_ON | TURN_OFF | VOLUME_SET | VOLUME_MUTE | PLAY | PAUSE | STOP | SEEK, volume_level=0.12),
        _st("media_player.generic_tv", "on", friendly_name="Generic screen", device_class="tv", supported_features=TURN_ON | TURN_OFF | VOLUME_SET | VOLUME_MUTE | SELECT_SOURCE | PLAY | PAUSE, source="HDMI 1",
            source_list=["HDMI 1", "HDMI 2", "USB"], volume_level=0.2),
        _st("media_player.receiver_living", "on", friendly_name="AV receiver", device_class="receiver", supported_features=TURN_ON | TURN_OFF | VOLUME_SET | VOLUME_MUTE | VOLUME_STEP | SELECT_SOURCE, volume_level=0.4, is_volume_muted=False),
    ]


def install(client: TestClient, *, device_updates: dict[str, dict[str, Any]] | None = None, extra_states: list[dict[str, Any]] | None = None) -> None:
    """Post the states and the registries (the dev routes are open to the bootstrap administrator)."""
    devices = [{**d, **(device_updates or {}).get(d["id"], {})} for d in DEVICES]
    st = client.post("/api/v1/ha/dev/states", json={"states": [*states(), *(extra_states or [])]})
    assert st.status_code == 200, st.text
    reg = client.post("/api/v1/ha/dev/registry", json={"entities": ENTITY_REGISTRY, "devices": devices, "areas": AREAS, "floors": FLOORS})
    assert reg.status_code == 200, reg.text


def set_state(client: TestClient, entity_id: str, state: str, **attrs: Any) -> None:
    """Change one entity the way a state push would (keeps its other attributes unless given)."""
    current = next((s for s in states() if s["entity_id"] == entity_id), _st(entity_id, state))
    merged = {**current["attributes"], **attrs}
    r = client.post("/api/v1/ha/dev/states", json={"states": [{"entity_id": entity_id, "state": state, "attributes": merged}]})
    assert r.status_code == 200, r.text


def admin(client: TestClient) -> dict[str, Any]:
    r = client.get("/api/v1/multimedia/admin/devices")
    assert r.status_code == 200, r.text
    return r.json()


def key_of(client: TestClient, anchor_entity_id: str) -> str:
    """The device key whose anchor is `anchor_entity_id` (administrator view)."""
    for d in admin(client)["devices"]:
        if d["anchor_entity_id"] == anchor_entity_id:
            return d["key"]
    raise AssertionError(f"no device anchored on {anchor_entity_id}")


def approve_all(client: TestClient) -> dict[str, Any]:
    r = client.post("/api/v1/multimedia/admin/approve", json={})
    assert r.status_code == 200, r.text
    return r.json()


# ------------------------------------------------------------------------------------------------ the bridge and the commands

import datetime as _dt
import uuid as _uuid

from smplwise.services import ha_bridge, ha_client


def pair(c: TestClient, monkeypatch, *, version: str | None = "0.4.0", result: Any = None) -> list[dict[str, Any]]:
    """Pair the bridge (announcing `version`; None = never pinged) and replace the one write path to HA with a recorder: every signed call
    is verified and appended to the returned list; `result` is the bridge's answer (a dict, or a function of the payload)."""
    secret = c.get("/api/v1/ha/bridge/pairing").json()["pairing_code"]
    if version is not None:
        r = c.post("/api/v1/ha/bridge/ping", json=ha_bridge.sign(secret, {"version": version}))
        assert r.status_code == 200, r.text
    calls: list[dict[str, Any]] = []

    def fake(_settings, payload, timeout=15.0):
        ha_bridge.verify(secret, payload)
        calls.append(payload)
        answer = result(payload) if callable(result) else result
        return answer if answer is not None else {"ok": True, "context_id": "ctx"}

    monkeypatch.setattr(ha_client, "call_bridge_execute", fake)
    return calls


def body(command: str, **fields: Any) -> dict[str, Any]:
    """A command body with a fresh request id and an expiry 30 s ahead."""
    expires = (_dt.datetime.now(_dt.timezone.utc) + _dt.timedelta(seconds=30)).strftime("%Y-%m-%dT%H:%M:%SZ")
    return {"command": command, "client_request_id": fields.pop("client_request_id", _uuid.uuid4().hex), "expires_at": fields.pop("expires_at", expires), **fields}


def send(c: TestClient, device_key: str, command: str, headers: dict[str, str] | None = None, **fields: Any):
    return c.post(f"/api/v1/multimedia/devices/{device_key}/commands", json=body(command, **fields), headers=headers or {})


def service_of(payload: dict[str, Any]) -> tuple[str, str, dict[str, Any]]:
    return payload["domain"], payload["service"], payload["data"]
