"""CR-028 (prep): which media devices could receive a cast of our video, read from the registry data already mirrored (services/media_model.py
`cast_capability`, exposed on `GET /multimedia/admin/devices` as `cast`). Pure rules first, then the route over the synthetic installation of
media_seed. Every id, MAC, UUID and model is invented. Nothing here casts anything: the field only informs the settings screen."""
from __future__ import annotations

import itertools
from typing import Any

import media_seed as seed
import pytest
from fastapi.testclient import TestClient

from smplwise.main import create_app
from smplwise.services import media_model as mm

PLAY_MEDIA, TURN_ON, TURN_OFF, VOLUME_SET = 512, 128, 256, 4
TV = TURN_ON | TURN_OFF | VOLUME_SET


def ent(entity_id: str, platform: str, device_id: str | None = None, *, state: str = "on", features: int = TV, device_class: str | None = None, **attrs: Any) -> dict[str, Any]:
    return {"entity_id": entity_id, "domain": entity_id.split(".", 1)[0], "platform": platform, "device_id": device_id, "unique_id": f"u-{entity_id}",
            "device_class": device_class, "name": entity_id, "original_name": None, "area_id": None, "state": state, "available": state != "unavailable",
            "supported_features": features, "attributes": dict(attrs), "last_changed": "2026-10-05T10:00:00+00:00", "last_updated": "2026-10-05T10:00:00+00:00"}


def dev(device_id: str, manufacturer: str | None = None, model: str | None = None) -> dict[str, Any]:
    return {"device_id": device_id, "name": None, "name_by_user": None, "area_id": None, "connections": [], "identifiers": [], "manufacturer": manufacturer, "model": model}


def model_of(entities: list[dict[str, Any]], devices: list[dict[str, Any]] = ()) -> tuple[mm.DeviceModel, dict[str, dict[str, Any]], dict[str, dict[str, Any]]]:
    """One built device (the ladder merges by HA device id) with its entity dicts and the manufacturer / model map the store passes."""
    n = itertools.count(1)
    m = mm.build(list(entities), list(devices), [], new_key=lambda: f"k{next(n):031d}")
    (d,) = m.devices.values()
    meta = {x["device_id"]: {"manufacturer": x.get("manufacturer"), "model": x.get("model")} for x in devices}
    return d, {e["entity_id"]: e for e in entities}, meta


def cap(entities, devices=(), profile="generic") -> dict[str, Any]:
    d, ents, meta = model_of(entities, list(devices))
    return mm.cast_capability(d, ents, meta, profile)


# ------------------------------------------------------------------------------------------------ the pure rules


def test_a_cast_endpoint_with_device_class_tv_is_a_confirmed_video_receiver():
    c = cap([ent("media_player.tv", "samsungtv_smart", "d1", device_class="tv"), ent("media_player.tv_cast", "cast", "d1", device_class="tv", features=PLAY_MEDIA | TV)],
            [dev("d1", "Samsung", "QE55")])
    assert c == {"method": "cast_hls", "confidence": "confirmed", "via": "ha:media_player.tv_cast", "reason": "cast_video"}


@pytest.mark.parametrize("model", ["Chromecast", "Chromecast with Google TV", "Google Nest Hub", "SHIELD Android TV", "Sony BRAVIA 4K"])
def test_a_google_video_model_is_confirmed_whatever_the_device_class_says(model):
    c = cap([ent("media_player.box", "cast", "d1", features=PLAY_MEDIA | TV)], [dev("d1", "Google Inc.", model)])
    assert (c["method"], c["confidence"], c["reason"]) == ("cast_hls", "confirmed", "cast_video")


def test_a_cast_endpoint_without_a_class_on_a_screen_is_confirmed_elsewhere_likely():
    # system-V: the LG-class TVs are reachable only through Cast, no device class, a model string that reads as a TV (kind = screen)
    c = cap([ent("media_player.tv_cast", "cast", "d1", features=PLAY_MEDIA | TV)], [dev("d1", "LG", "OLED55C")])
    assert (c["method"], c["confidence"], c["reason"]) == ("cast_hls", "confirmed", "cast_screen")
    # a player whose model says nothing: the receiver answered on the LAN, but not every Cast receiver shows a picture
    c = cap([ent("media_player.thing", "cast", "d1", features=PLAY_MEDIA | TV)], [dev("d1", "Acme", "ZX-1")])
    assert (c["method"], c["confidence"], c["reason"]) == ("cast_hls", "likely", "cast_unknown_model")


@pytest.mark.parametrize("cls,model", [("speaker", "Google Home Mini"), ("speaker", "WiiM Mini"), (None, "Chromecast Audio"), (None, "Nest Audio")])
def test_an_audio_only_cast_receiver_can_never_show_a_picture(cls, model):
    c = cap([ent("media_player.spk", "cast", "d1", device_class=cls, features=PLAY_MEDIA | VOLUME_SET)], [dev("d1", "Google Inc.", model)])
    assert c == {"method": "none", "confidence": "confirmed", "via": "ha:media_player.spk", "reason": "cast_audio_only"}


def test_a_nest_hub_is_a_speaker_with_a_screen():
    c = cap([ent("media_player.hub", "cast", "d1", device_class="speaker", features=PLAY_MEDIA | VOLUME_SET)], [dev("d1", "Google Inc.", "Google Nest Hub")])
    assert (c["method"], c["confidence"]) == ("cast_hls", "confirmed")


def test_two_cast_endpoints_the_audio_one_does_not_hide_the_video_one():
    ents = [ent("media_player.a", "cast", "d1", device_class="speaker", features=PLAY_MEDIA), ent("media_player.b", "cast", "d1", device_class="tv", features=PLAY_MEDIA)]
    c = cap(ents, [dev("d1", "Vendor", "Thing")])
    assert (c["method"], c["via"]) == ("cast_hls", "ha:media_player.b")


def test_an_android_tv_without_its_cast_twin_is_likely_through_the_built_in_receiver():
    c = cap([ent("media_player.atv", "androidtv_remote", "d1", device_class="tv", features=TURN_ON | TURN_OFF), ent("remote.atv", "androidtv_remote", "d1")], [dev("d1", "Sony", "KD-55")], profile="android_tv")
    assert c == {"method": "cast_hls", "confidence": "likely", "via": None, "reason": "android_tv_builtin"}


def test_apple_tv_is_airplay_likely():
    c = cap([ent("media_player.apple", "apple_tv", "d1", device_class="tv", features=PLAY_MEDIA | TV)], [dev("d1", "Apple", "Apple TV 4K")])
    assert (c["method"], c["confidence"], c["reason"]) == ("airplay", "likely", "apple_tv")


def test_a_dlna_renderer_is_likely_while_it_advertises_play_media_and_unknown_while_its_mask_is_empty():
    c = cap([ent("media_player.dlna", "dlna_dmr", "d1", device_class="tv", features=PLAY_MEDIA | VOLUME_SET)], [dev("d1", "Samsung", "UE40")])
    assert (c["method"], c["confidence"], c["reason"]) == ("dlna", "likely", "dlna_renderer")
    # the three probed systems: every dlna_dmr entity was unavailable with mask 0 at the snapshot
    c = cap([ent("media_player.dlna", "dlna_dmr", "d1", device_class="tv", state="unavailable", features=0)], [dev("d1", "Samsung", "UE40")])
    assert (c["method"], c["confidence"], c["reason"]) == ("dlna", "unknown", "dlna_unavailable")


def test_a_samsung_tv_without_cast_or_dlna_is_a_browser_candidate_unknown_until_verified():
    c = cap([ent("media_player.tv", "samsungtv_smart", "d1", device_class="tv", features=PLAY_MEDIA | TV)], [dev("d1", "Samsung", "QE55")])
    assert (c["method"], c["confidence"], c["reason"]) == ("browser_url", "unknown", "samsung_browser")
    # ... but a Cast endpoint on the same device wins
    c = cap([ent("media_player.tv", "samsungtv_smart", "d1", device_class="tv", features=PLAY_MEDIA | TV), ent("media_player.tv_cast", "cast", "d1", device_class="tv", features=PLAY_MEDIA)], [dev("d1", "Samsung", "QE55")])
    assert c["method"] == "cast_hls"


def test_an_lg_or_smartthings_only_screen_has_no_known_path():
    c = cap([ent("media_player.lg", "webostv", "d1", device_class="tv", features=TV)], [dev("d1", "LG", "OLED")])
    assert c == {"method": "none", "confidence": "unknown", "via": None, "reason": "no_path"}


def test_speakers_receivers_and_groups_say_so():
    c = cap([ent("media_player.sonos", "sonos", "d1", device_class="speaker", features=PLAY_MEDIA | VOLUME_SET)], [dev("d1", "Sonos", "One")])
    assert c == {"method": "none", "confidence": "confirmed", "via": None, "reason": "no_screen"}
    c = cap([ent("media_player.amp", "denonavr", "d1", device_class="receiver", features=PLAY_MEDIA | TV)], [dev("d1", "Denon", "AVR-X")])
    assert c == {"method": "none", "confidence": "confirmed", "via": None, "reason": "kind"}


def test_a_mirror_endpoint_never_answers():
    d, ents, meta = model_of([ent("media_player.tv", "webostv", "d1", device_class="tv", features=TV), ent("media_player.tv_cast", "cast", "d1", device_class="tv", features=PLAY_MEDIA)], [dev("d1", "LG", "OLED")])
    for e in d.endpoints:
        if e.platform == "cast":
            e.role = "mirror"
    assert mm.cast_capability(d, ents, meta)["method"] == "none"


def test_the_reply_never_carries_private_registry_values():
    c = cap([ent("media_player.tv_cast", "cast", "d1", device_class="tv", features=PLAY_MEDIA)], [{**dev("d1", "Samsung", "QE55"), "connections": [("mac", "aabbcc000001")], "identifiers": [("cast", "cast-uuid-0001")]}])
    text = repr(c)
    assert "aabbcc" not in text and "uuid" not in text and set(c) == {"method", "confidence", "via", "reason"}


# ------------------------------------------------------------------------------------------------ the route


@pytest.fixture()
def m(settings):
    c = TestClient(create_app(settings))
    seed.install(c)
    return c


def test_admin_rows_carry_the_cast_capability_of_every_device(m):
    rows = {d["anchor_entity_id"]: d for d in seed.admin(m)["devices"]}
    for d in rows.values():
        assert set(d["cast"]) == {"method", "confidence", "via", "reason"}
        assert d["cast"]["method"] in mm.CAST_METHODS and d["cast"]["confidence"] in mm.CAST_CONFIDENCE
    # the Samsung with its Cast copy (device class tv on the copy): confirmed, through the Cast endpoint
    assert rows["media_player.tv_living"]["cast"] == {"method": "cast_hls", "confidence": "confirmed", "via": "ha:media_player.tv_living_cast", "reason": "cast_video"}
    # the Android TV with its Cast copy: confirmed the same way
    assert rows["media_player.tv_bedroom"]["cast"]["method"] == "cast_hls" and rows["media_player.tv_bedroom"]["cast"]["confidence"] == "confirmed"
    # the second Samsung has no Cast copy: only its browser, unverified
    assert rows["media_player.tv_kitchen"]["cast"] == {"method": "browser_url", "confidence": "unknown", "via": "ha:media_player.tv_kitchen", "reason": "samsung_browser"}
    # LG and the generic screen: no known path
    assert rows["media_player.lg_office"]["cast"]["method"] == "none" and rows["media_player.lg_office"]["cast"]["confidence"] == "unknown"
    assert rows["media_player.generic_tv"]["cast"]["reason"] == "no_path"
    # the receiver: not a thing that shows a picture
    assert rows["media_player.receiver_living"]["cast"] == {"method": "none", "confidence": "confirmed", "via": None, "reason": "kind"}


def test_the_capability_is_read_only_and_survives_a_registry_refresh(m):
    before = {d["anchor_entity_id"]: d["cast"] for d in seed.admin(m)["devices"]}
    assert m.post("/api/v1/ha/dev/registry", json={"entities": seed.ENTITY_REGISTRY, "devices": seed.DEVICES, "areas": seed.AREAS, "floors": seed.FLOORS}).status_code == 200
    after = {d["anchor_entity_id"]: d["cast"] for d in seed.admin(m)["devices"]}
    assert before == after
    # no route accepts a cast command yet: the prep adds nothing writable
    key = seed.key_of(m, "media_player.tv_living")
    assert m.post(f"/api/v1/multimedia/devices/{key}/commands", json=seed.body("cast", camera_id="x")).status_code in (403, 404, 409, 422)
