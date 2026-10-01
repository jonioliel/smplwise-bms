"""CR-015: the media device model (services/media_model.py) - pure functions, no database. The dedupe ladder rungs 1-6 (including the
two-Samsung guard), kinds, roles, primaries per control, the capability matrix and the live state. Every id, MAC and UUID is invented."""
from __future__ import annotations

import itertools
from typing import Any

import pytest

from smplwise.services import media_model as mm

PAUSE, SEEK, VOLUME_SET, VOLUME_MUTE, PREVIOUS, NEXT = 1, 2, 4, 8, 16, 32
TURN_ON, TURN_OFF, PLAY_MEDIA, VOLUME_STEP, SELECT_SOURCE, STOP, PLAY = 128, 256, 512, 1024, 2048, 4096, 16384
ALL = PAUSE | VOLUME_SET | VOLUME_MUTE | PREVIOUS | NEXT | TURN_ON | TURN_OFF | PLAY_MEDIA | VOLUME_STEP | SELECT_SOURCE | STOP | PLAY


def ent(entity_id: str, platform: str, device_id: str | None = None, *, state: str = "on", features: int = ALL, unique_id: str | None = None,
        device_class: str | None = None, area: str | None = None, name: str | None = None, **attrs: Any) -> dict[str, Any]:
    return {"entity_id": entity_id, "domain": entity_id.split(".", 1)[0], "platform": platform, "device_id": device_id, "unique_id": unique_id or f"u-{entity_id}",
            "device_class": device_class, "name": name or entity_id.split(".", 1)[1].replace("_", " "), "original_name": None, "area_id": area, "state": state,
            "available": state != "unavailable", "supported_features": features, "attributes": dict(attrs), "last_changed": "2026-09-30T10:00:00+00:00", "last_updated": "2026-09-30T10:00:00+00:00"}


def dev(device_id: str, *, macs: list[str] = (), idents: list[tuple[str, str]] = (), conns: list[tuple[str, str]] = (), name: str | None = None, area: str | None = None) -> dict[str, Any]:
    return {"device_id": device_id, "name": name, "name_by_user": None, "area_id": area,
            "connections": mm.normalise_connections([("mac", m) for m in macs] + list(conns)), "identifiers": mm.normalise_identifiers(idents)}


def counter() -> Any:
    n = itertools.count(1)
    return lambda: f"k{next(n):031d}"


def build(entities, devices=(), rules=(), **kw):
    return mm.build(list(entities), list(devices), list(rules), new_key=kw.pop("new_key", counter()), **kw)


def groups(model: mm.Model) -> list[set[str]]:
    return sorted(({e.ref for e in d.endpoints} for d in model.devices.values()), key=lambda s: sorted(s))


# ------------------------------------------------------------------------------------------------ normalisation


def test_normalisation_of_private_values():
    assert mm.normalise_mac("AA:BB:CC:00:00:01") == mm.normalise_mac("aa-bb-cc-00-00-01") == mm.normalise_mac("aabb.cc00.0001") == "aabbcc000001"
    assert mm.normalise_mac("not a mac") is None and mm.normalise_mac("aa:bb") is None
    assert mm.normalise_identifier("uuid:AAAAAAAA-1111-2222-3333-444444444444") == "aaaaaaaa111122223333444444444444"
    assert mm.normalise_identifier("1234") is None  # too short to be an identity
    assert mm.normalise_connections([("mac", "AA:BB:CC:00:00:01"), ("mac", "aa-bb-cc-00-00-01"), ("upnp", "UUID:X"), ("mac", "junk"), "bad"]) == [["mac", "aabbcc000001"], ["upnp", "uuid:x"]]


# ------------------------------------------------------------------------------------------------ the ladder


def test_rung_1_the_same_ha_device_merges_exact():
    m = build([ent("media_player.tv", "samsungtv_smart", "d1"), ent("remote.tv", "samsungtv_smart", "d1")], [dev("d1")])
    (d,) = m.devices.values()
    assert {e.ref for e in d.endpoints} == {"media_player.tv", "remote.tv"} and d.confidence == "exact"
    assert {e.rule for e in d.endpoints} == {"device"}


def test_rung_2_the_music_assistant_loop_merges_exact_and_hides_the_copies():
    ents = [ent("media_player.tv", "samsungtv_smart", "d1", device_class="tv"),
            ent("media_player.tv_ma", "music_assistant", "d2", unique_id="media_player.tv", device_class="speaker"),
            ent("remote.tv_ma_aux", "music_assistant", "d2")]
    m = build(ents, [dev("d1"), dev("d2", idents=[("music_assistant", "media_player.tv")])])
    (d,) = m.devices.values()
    roles = {e.ref: e.role for e in d.endpoints}
    assert roles == {"media_player.tv": "vendor", "media_player.tv_ma": "ma_import", "remote.tv_ma_aux": "ma_import"}
    assert d.confidence == "exact" and d.kind == "screen"
    assert next(e for e in d.endpoints if e.ref == "media_player.tv_ma").hidden is True
    assert next(e for e in d.endpoints if e.ref == "media_player.tv").hidden is False


def test_a_music_assistant_player_alone_is_a_native_player_not_hidden():
    m = build([ent("media_player.kitchen_ma", "music_assistant", "d9", unique_id="ma-player-1", device_class="speaker")], [dev("d9")])
    (d,) = m.devices.values()
    assert d.kind == "speaker" and d.endpoints[0].role == "ma_native" and d.endpoints[0].hidden is False


def test_rung_3_a_shared_mac_merges_strong_whatever_the_formatting():
    ents = [ent("media_player.tv", "samsungtv_smart", "d1", device_class="tv"), ent("media_player.tv_cast", "cast", "d2", device_class="tv")]
    m = build(ents, [dev("d1", macs=["AA:BB:CC:00:00:01"]), dev("d2", macs=["aa-bb-cc-00-00-01"])])
    (d,) = m.devices.values()
    assert {e.ref for e in d.endpoints} == {"media_player.tv", "media_player.tv_cast"} and d.confidence == "strong"
    assert next(e for e in d.endpoints if e.ref == "media_player.tv_cast").rule == "mac"
    assert next(e for e in d.endpoints if e.ref == "media_player.tv_cast").hidden is True  # a duplicate of the vendor endpoint


def test_rung_4_a_shared_uuid_merges_strong_uuid_prefix_and_dashes_ignored():
    ents = [ent("media_player.tv", "samsungtv_smart", "d1"), ent("media_player.tv_st", "smartthings", "d3")]
    m = build(ents, [dev("d1", conns=[("upnp", "uuid:11111111-2222-3333-4444-555555555555")]), dev("d3", idents=[("smartthings", "11111111222233334444555555555555")])])
    (d,) = m.devices.values()
    assert d.confidence == "strong" and next(e for e in d.endpoints if e.ref == "media_player.tv_st").rule == "identifier"


def test_a_short_or_widely_shared_identifier_is_not_an_identity():
    ents = [ent(f"media_player.p{i}", "cast", f"d{i}") for i in range(1, 7)]
    same = [dev(f"d{i}", idents=[("cast", "shared-uuid-12345678")]) for i in range(1, 7)]
    assert len(build(ents, same).devices) == 6, "six devices sharing one value: a generic value, never merged"
    short = [dev("d1", idents=[("cast", "abc123")]), dev("d2", idents=[("cast", "abc123")])]
    assert len(build(ents[:2], short).devices) == 2


@pytest.mark.parametrize("shared", ["192.0.2.50", "198.51.100.7", "fe80::1", "2001:db8::7", "192.0.2.50:8001", "tv-living-room", "tv-living.local", "livingroomtv", "http://tv.local/desc.xml", "samsung-tv-02"])
def test_rung_4_never_merges_on_an_ip_or_hostname_shaped_identifier(shared):
    assert mm.normalise_identifier(shared) is None
    ents = [ent("media_player.tv_a", "samsungtv_smart", "d1", device_class="tv"), ent("media_player.tv_b", "cast", "d2", device_class="tv")]
    for kind in ("identifiers", "connections"):
        devices = [dev("d1", **{("idents" if kind == "identifiers" else "conns"): [("upnp", shared)]}), dev("d2", **{("idents" if kind == "identifiers" else "conns"): [("upnp", shared)]})]
        assert len(build(ents, devices).devices) == 2, (kind, shared)


def test_rung_4_still_merges_on_uuid_serial_and_mac_shaped_identifiers():
    ents = [ent("media_player.tv_a", "samsungtv_smart", "d1", device_class="tv"), ent("media_player.tv_b", "cast", "d2", device_class="tv")]
    for value in ("uuid:11111111-2222-3333-4444-555555555555", "11111111222233334444555555555555", "0AB12CD3EF4567", "AA:BB:CC:00:00:77"):
        m = build(ents, [dev("d1", idents=[("upnp", value)]), dev("d2", idents=[("cast", value)])])
        assert len(m.devices) == 1, value
    assert mm.normalise_identifier("uuid:AAAAAAAA-1111-2222-3333-444444444444") == "aaaaaaaa111122223333444444444444"
    assert mm.normalise_identifier("AA:BB:CC:00:00:77") == "aabbcc000077"


def test_two_tvs_sharing_an_ip_like_identifier_with_the_same_platform_stay_two_screens():
    ents = [ent("media_player.tv_a", "samsungtv_smart", "d1", device_class="tv"), ent("media_player.tv_b", "samsungtv_smart", "d2", device_class="tv")]
    devices = [dev("d1", idents=[("samsungtv_smart", "192.0.2.50")], conns=[("ip", "192.0.2.50")]), dev("d2", idents=[("samsungtv_smart", "192.0.2.50")], conns=[("ip", "192.0.2.50")])]
    assert len(build(ents, devices).devices) == 2


def test_the_two_samsung_guard_never_merges_two_devices_of_one_platform_even_on_a_shared_mac():
    ents = [ent("media_player.tv_a", "samsungtv_smart", "d1", device_class="tv"), ent("media_player.tv_b", "samsungtv_smart", "d2", device_class="tv")]
    m = build(ents, [dev("d1", macs=["AA:BB:CC:00:00:09"]), dev("d2", macs=["AA:BB:CC:00:00:09"])])
    assert len(m.devices) == 2, "same platform on different HA devices: never one screen"
    # the same shared MAC still merges a Cast copy into one of them - but only one, and never both at once
    ents.append(ent("media_player.cast_a", "cast", "d3"))
    m = build(ents, [dev("d1", macs=["AA:BB:CC:00:00:09"]), dev("d2", macs=["AA:BB:CC:00:00:10"]), dev("d3", macs=["AA:BB:CC:00:00:09"])])
    assert len(m.devices) == 2 and {"media_player.tv_a", "media_player.cast_a"} in groups(m)


def test_ip_is_never_a_join_key():
    ents = [ent("media_player.a", "samsungtv_smart", "d1", ip_address="192.0.2.10"), ent("media_player.b", "cast", "d2", ip_address="192.0.2.10")]
    assert len(build(ents, [dev("d1"), dev("d2")]).devices) == 2


def test_rung_5_same_area_and_name_is_a_suggestion_never_a_merge():
    ents = [ent("media_player.living_tv", "samsungtv_smart", "d1", area="living", name="Living Room TV", device_class="tv"),
            ent("media_player.living_cast", "cast", "d2", area="living", name="Living Room Cast", device_class="tv"),
            ent("media_player.office_cast", "cast", "d3", area="office", name="Living Room Cast", device_class="tv")]
    m = build(ents, [dev("d1", name="Living Room TV"), dev("d2", name="Living Room Cast"), dev("d3", name="Living Room Cast")])
    assert len(m.devices) == 3, "weak: listed as a suggestion only"
    assert [(s.endpoint_id, s.rule) for s in m.suggestions] == [("ha:media_player.living_cast", "weak")]
    assert m.suggestions[0].device_key == next(d.key for d in m.devices.values() if d.anchor == "media_player.living_tv")
    # a weak rung never merges across areas: the office cast is not suggested for the living room
    assert all(s.endpoint_id != "ha:media_player.office_cast" for s in m.suggestions)


def test_a_suggestion_is_not_made_where_the_guard_forbids_the_merge():
    ents = [ent("media_player.a", "samsungtv_smart", "d1", area="living", name="Living TV"), ent("media_player.b", "samsungtv_smart", "d2", area="living", name="Living TV")]
    assert build(ents, [dev("d1"), dev("d2")]).suggestions == []


def test_rung_6_manual_rules_override_the_ladder():
    ents = [ent("media_player.tv", "samsungtv_smart", "d1", device_class="tv"), ent("remote.tv", "samsungtv_smart", "d1"), ent("media_player.tv_cast", "cast", "d2", device_class="tv")]
    devices = [dev("d1"), dev("d2")]
    base = build(ents, devices)
    assert len(base.devices) == 2
    tv_key = next(d.key for d in base.devices.values() if d.anchor == "media_player.tv")
    # link: the Cast copy joins the TV
    m = build(ents, devices, [{"endpoint_id": "ha:media_player.tv_cast", "rule": "link", "device_key": tv_key}], existing_keys={e.endpoint_id: d.key for d in base.devices.values() for e in d.endpoints})
    assert groups(m) == [{"media_player.tv", "media_player.tv_cast", "remote.tv"}]
    (d,) = m.devices.values()
    assert d.key == tv_key and d.confidence == "manual" and next(e for e in d.endpoints if e.ref == "media_player.tv_cast").link_source == "manual"
    # unlink: the remote leaves its own device's cluster and stays apart (rung 1 would have joined it)
    m = build(ents, devices, [{"endpoint_id": "ha:remote.tv", "rule": "unlink", "device_key": None}])
    assert {"remote.tv"} not in groups(m)  # a remote alone is not a media device: no media_player in its cluster
    assert {"media_player.tv"} in groups(m)
    # ignore: the endpoint is in no device at all
    m = build(ents, devices, [{"endpoint_id": "ha:media_player.tv_cast", "rule": "ignore", "device_key": None}])
    assert all("media_player.tv_cast" not in g for g in groups(m))


def test_a_cluster_without_a_media_player_is_not_a_media_device():
    assert build([ent("remote.hub_activity", "harmony", "d1")], [dev("d1")]).devices == {}


def test_keys_stay_stable_while_endpoints_come_and_go():
    ents = [ent("media_player.tv", "samsungtv_smart", "d1", device_class="tv"), ent("media_player.tv_cast", "cast", "d2", device_class="tv")]
    first = build(ents, [dev("d1", macs=["AA:BB:CC:00:00:01"]), dev("d2", macs=["AA:BB:CC:00:00:01"])])
    (key,) = first.devices
    existing = first.by_endpoint
    # the Cast copy vanishes: the device keeps its key
    second = build(ents[:1], [dev("d1")], existing_keys={k: v for k, v in existing.items()})
    assert list(second.devices) == [key]
    # the Cast copy comes back unlinked (its MAC changed): it becomes a NEW device, the TV keeps the key
    third = build(ents, [dev("d1", macs=["AA:BB:CC:00:00:01"]), dev("d2", macs=["AA:BB:CC:00:00:99"])], existing_keys=existing)
    assert key in third.devices and len(third.devices) == 2
    # the anchor is kept while it is still a member
    assert build(ents, [dev("d1", macs=["AA:BB:CC:00:00:01"]), dev("d2", macs=["AA:BB:CC:00:00:01"])], existing_keys=existing, existing_anchors={key: "media_player.tv_cast"}).devices[key].anchor == "media_player.tv_cast"


# ------------------------------------------------------------------------------------------------ kinds, roles, profiles


@pytest.mark.parametrize("platform,device_class,expect", [
    ("generic", "tv", "screen"), ("generic", "projector", "screen"), ("denonavr", "receiver", "receiver"), ("sonos", "speaker", "speaker"),
    ("webostv", None, "screen"), ("samsungtv_smart", None, "screen"), ("androidtv_remote", None, "screen"), ("braviatv", None, "screen"),
    ("philips_js", None, "screen"), ("cast", None, "player"), ("music_assistant", None, "player"), ("unknownbrand", None, "player"),
])
def test_kind_by_device_class_and_vendor_platform(platform, device_class, expect):
    (d,) = build([ent("media_player.x", platform, "d1", device_class=device_class)], [dev("d1")]).devices.values()
    assert d.kind == expect


def test_profile_detection_uses_the_platforms_of_the_endpoints():
    (d,) = build([ent("media_player.tv", "androidtv_remote", "d1"), ent("remote.tv", "androidtv_remote", "d1"), ent("media_player.c", "cast", "d2")], [dev("d1", macs=["AA:BB:CC:00:00:03"]), dev("d2", macs=["aa:bb:cc:00:00:03"])]).devices.values()
    assert d.profile == "android_tv" and {e.role for e in d.endpoints} == {"vendor", "remote", "cast"}


# ------------------------------------------------------------------------------------------------ primaries, caps, live


def view_of(entities: list[dict[str, Any]], devices: list[dict[str, Any]] | None = None, *, profile: str | None = None, override: dict | None = None, **kw: Any) -> mm.DeviceView:
    model = build(entities, devices or [dev(e["device_id"]) for e in entities if e["device_id"]][:0] or [dev(d) for d in sorted({e["device_id"] for e in entities if e["device_id"]})])
    (d,) = model.devices.values() if len(model.devices) == 1 else (max(model.devices.values(), key=lambda x: len(x.endpoints)),)
    ents = {e["entity_id"]: e for e in entities}
    prof = profile or d.profile
    return mm.DeviceView(dev=d, ents=ents, profile=prof, prim=mm.primaries(d, ents, prof, override), **kw)


def test_power_never_goes_through_cast_or_music_assistant():
    v = view_of([ent("media_player.c", "cast", "d1", device_class="tv")])
    assert v.prim["power"] is None  # a Cast-only screen has no power endpoint: its "on" launches an app
    caps = mm.caps(v)
    assert caps["power_on"] is False and caps["power_off"] is False and caps["power_on_reason"] == "no_remote_wake"
    v = view_of([ent("media_player.tv", "samsungtv_smart", "d1"), ent("media_player.c", "cast", "d1")])
    assert v.prim["power"] == "media_player.tv"


def test_the_android_pair_volume_set_comes_from_cast_and_keys_from_the_remote():
    android = ent("media_player.tv", "androidtv_remote", "d1", features=PAUSE | VOLUME_MUTE | TURN_ON | TURN_OFF | VOLUME_STEP | PLAY_MEDIA | PLAY | STOP, volume_level=0.3)
    cast = ent("media_player.tv_cast", "cast", "d2", features=VOLUME_SET | VOLUME_MUTE | PLAY_MEDIA | PLAY | PAUSE | STOP | SEEK, volume_level=0.3, device_class="tv")
    remote = ent("remote.tv", "androidtv_remote", "d1", activity_list=["https://www.youtube.com", "netflix://"], current_activity="netflix://")
    v = view_of([android, remote, cast], [dev("d1", macs=["AA:BB:CC:00:00:03"]), dev("d2", macs=["aa:bb:cc:00:00:03"])])
    assert v.profile == "android_tv"
    assert v.prim["keys"] == "remote.tv" and v.prim["apps"] == "remote.tv" and v.prim["volume"] == "media_player.tv_cast" and v.prim["mute"] == "media_player.tv"
    c = mm.caps(v)
    assert c["volume_set"] is True and c["volume_step"] is True and c["sources"] is False and c["apps"] is True and c["text"] is True and c["touchpad"] is True
    assert "up" in c["keys"] and "exit" not in c["keys"] and "settings" in c["keys"]
    sources, apps = mm.view_lists(v)
    assert sources == [] and [a["id"] for a in apps] == ["https://www.youtube.com", "netflix://"]
    assert [a["label"] for a in apps] == ["Youtube", "Netflix"], "a readable default name, editable by the administrator"
    lv = mm.live(v)
    assert lv["now"]["kind"] == "app" and lv["now"]["app_id"] == "netflix://" and lv["volume"] == {"level": 30, "muted": None, "target": "screen", "step_only": False}


def test_a_receivers_own_integration_outranks_its_cast_copy_for_volume():
    """An amplifier has no TV-brand integration: its native one (role "other") is its vendor - it steps the volume, the Cast copy may not.
    A TV keeps the old order (the Android pair's Cast copy still owns volume_set)."""
    avr = ent("media_player.avr", "denonavr", "d1", device_class="receiver", features=TURN_ON | TURN_OFF | VOLUME_SET | VOLUME_STEP | VOLUME_MUTE | SELECT_SOURCE | PLAY | PAUSE | STOP)
    cast = ent("media_player.avr_cast", "cast", "d2", features=VOLUME_SET | VOLUME_MUTE | PLAY_MEDIA | PLAY | PAUSE | STOP, volume_level=0.4)
    v = view_of([avr, cast], [dev("d1", macs=["AA:BB:CC:00:00:08"]), dev("d2", macs=["aa:bb:cc:00:00:08"])])
    assert v.dev.kind == "receiver"
    assert v.prim["volume"] == "media_player.avr" and v.prim["mute"] == "media_player.avr"
    assert mm.step_endpoint(v.dev, v.ents, v.prim) == "media_player.avr"
    assert mm.caps(v)["volume_step"] is True


def test_an_android_remote_without_a_cast_copy_is_steps_only():
    v = view_of([ent("media_player.tv", "androidtv_remote", "d1", features=VOLUME_STEP | VOLUME_MUTE | TURN_ON | TURN_OFF, volume_level=0.5), ent("remote.tv", "androidtv_remote", "d1")])
    c = mm.caps(v)
    assert c["volume_set"] is False and c["volume_step"] is True and mm.live(v)["volume"]["step_only"] is True


def test_the_administrators_primary_override_is_honoured_only_for_endpoints_of_the_device():
    ents = [ent("media_player.tv", "samsungtv_smart", "d1"), ent("media_player.tv_cast", "cast", "d2", features=VOLUME_SET | PLAY | PAUSE | STOP | TURN_ON | TURN_OFF)]
    devices = [dev("d1", macs=["AA:BB:CC:00:00:01"]), dev("d2", macs=["aa:bb:cc:00:00:01"])]
    assert view_of(ents, devices, override={"volume": "media_player.tv_cast"}).prim["volume"] == "media_player.tv_cast"
    assert view_of(ents, devices, override={"volume": "media_player.someone_else", "nonsense": "media_player.tv"}).prim["volume"] == "media_player.tv"


def test_now_playing_prefers_a_cast_that_reports_metadata():
    ents = [ent("media_player.tv", "samsungtv_smart", "d1", state="on"),
            ent("media_player.tv_cast", "cast", "d2", state="playing", media_title="Film", features=PLAY | PAUSE | SEEK | PLAY_MEDIA)]
    devices = [dev("d1", macs=["AA:BB:CC:00:00:01"]), dev("d2", macs=["aa:bb:cc:00:00:01"])]
    v = view_of(ents, devices)
    assert v.prim["now_playing"] == "media_player.tv_cast" and mm.caps(v)["transport"]["seek"] is True
    ents[1] = ent("media_player.tv_cast", "cast", "d2", state="idle", features=PLAY | PAUSE)
    assert view_of(ents, devices).prim["now_playing"] == "media_player.tv"


def test_lg_without_a_turn_on_trigger_has_no_remote_wake_and_external_sound_hides_the_slider():
    off = view_of([ent("media_player.lg", "webostv", "d1", state="unavailable", features=0)])
    c = mm.caps(off)
    assert c["power_on"] is False and c["power_on_reason"] == "no_remote_wake", "an LG that is off is unavailable by design"
    assert mm.live(off)["power"] == "unavailable" and mm.live(off)["since"] == "2026-09-30T10:00:00Z"
    ext = view_of([ent("media_player.lg", "webostv", "d1", features=ALL & ~VOLUME_SET, sound_output="external_arc", volume_level=0.2, source_list=["Live TV", "HDMI 1"], source="HDMI 1")])
    c = mm.caps(ext)
    assert c["volume_set"] is False and c["sound_outputs"] and "external_arc" in c["sound_outputs"]
    internal = view_of([ent("media_player.lg", "webostv", "d1", features=ALL, sound_output="tv_speaker", volume_level=0.2)])
    assert mm.caps(internal)["volume_set"] is True
    # even with a VOLUME_SET bit an external output takes the slider away
    sneaky = view_of([ent("media_player.lg", "webostv", "d1", features=ALL, sound_output="external_speaker", volume_level=0.2)])
    assert mm.caps(sneaky)["volume_set"] is False


def test_a_linked_receiver_carries_the_volume():
    tv = ent("media_player.lg", "webostv", "d1", features=ALL & ~VOLUME_SET, sound_output="external_arc", volume_level=0.2)
    rcv = ent("media_player.rcv", "denonavr", "d2", features=TURN_ON | TURN_OFF | VOLUME_SET | VOLUME_MUTE | VOLUME_STEP, volume_level=0.45, is_volume_muted=True, device_class="receiver")
    ents = {e["entity_id"]: e for e in (tv, rcv)}
    m = build([tv, rcv], [dev("d1"), dev("d2")])
    tv_dev = next(d for d in m.devices.values() if d.kind == "screen")
    rcv_dev = next(d for d in m.devices.values() if d.kind == "receiver")
    tv_view = mm.DeviceView(dev=tv_dev, ents=ents, profile="lg_webos", prim=mm.primaries(tv_dev, ents, "lg_webos"), audio_default="screen")
    rcv_view = mm.DeviceView(dev=rcv_dev, ents=ents, profile="generic", prim=mm.primaries(rcv_dev, ents, "generic"))
    # LG sound on an external output and a receiver linked: the receiver owns the volume even when the default says "screen"
    c = mm.caps(tv_view, rcv_view)
    assert c["volume_set"] is True and c["mute"] is True
    lv = mm.live(tv_view, rcv_view)
    assert lv["volume"] == {"level": 45, "muted": True, "target": "linked", "step_only": False}
    # the administrator's default "linked" does the same for a TV on its own speakers
    tv_view.ents = {**ents, "media_player.lg": ent("media_player.lg", "webostv", "d1", features=ALL, sound_output="tv_speaker", volume_level=0.2)}
    tv_view.audio_default = "linked"
    assert mm.live(tv_view, rcv_view)["volume"]["target"] == "linked"
    tv_view.audio_default = "screen"
    assert mm.live(tv_view, rcv_view)["volume"]["target"] == "screen"


def test_samsung_frame_art_mode_is_power_art_and_carries_no_now_playing():
    v = view_of([ent("media_player.frame", "samsungtv_smart", "d1", state="on", art_mode_status="on", source_list=["TV", "HDMI1"])])
    lv = mm.live(v)
    assert lv["power"] == "art" and lv["now"]["kind"] == "art" and lv["now"]["label"] == mm.ART_LABEL and lv["play"] is None
    assert mm.caps(v)["art_mode"] is True
    v = view_of([ent("media_player.frame", "samsungtv_smart", "d1", state="on", art_mode_status="off", source_list=["TV"])])
    assert mm.live(v)["power"] == "on" and mm.caps(v)["art_mode"] is True


@pytest.mark.parametrize("state,power", [("on", "on"), ("playing", "on"), ("paused", "on"), ("idle", "on"), ("off", "off"), ("standby", "standby"), ("unavailable", "unavailable"), ("unknown", "unknown")])
def test_power_states(state, power):
    v = view_of([ent("media_player.tv", "samsungtv_smart", "d1", state=state)])
    lv = mm.live(v)
    assert lv["power"] == power and lv["confirmed"] is (power not in ("unavailable", "unknown"))
    assert (lv["since"] is not None) is (power == "unavailable")


def test_a_missing_power_endpoint_is_unknown_never_off():
    v = view_of([ent("media_player.c", "cast", "d1", state="off", device_class="tv")])
    assert mm.live(v)["power"] == "unknown"


def test_a_power_command_in_flight_keeps_the_state_unconfirmed_until_it_moves():
    v = view_of([ent("media_player.tv", "samsungtv_smart", "d1", state="on")])
    at = mm._epoch_ms("2026-09-30T10:00:00+00:00")
    assert mm.live(v, pending_power_ms=at - 1000)["confirmed"] is True  # the entity reported after the command
    assert mm.live(v, pending_power_ms=at + 5000)["confirmed"] is False


def test_the_split_of_a_merged_source_list_and_the_curation():
    sources = ["TV", "HDMI1", "HDMI 2", "USB", "Netflix", "YouTube", "ספורט", "Live TV"]
    v = view_of([ent("media_player.tv", "samsungtv_smart", "d1", source_list=sources, source="HDMI1")])
    src, apps = mm.view_lists(v)
    assert [s["id"] for s in src] == ["TV", "HDMI1", "HDMI 2", "USB", "Live TV"] and [a["id"] for a in apps] == ["Netflix", "YouTube", "ספורט"]
    assert [s["label"] for s in src][:3] == ["טלוויזיה", "HDMI 1", "HDMI 2"] and src[3]["glyph"] == "image" and src[0]["glyph"] == "antenna"
    assert all(a["glyph"] in mm.GLYPHS and a["hue"] is not None for a in apps), "neutral glyphs and our own hues"
    # curation: order, hide, rename, re-class, glyph; the id (the TV's own string) never changes
    v.sources_json = [{"id": "HDMI1", "label": "HDMI 1 · ממיר", "hidden": False, "kind": "source", "glyph": "gamepad"}, {"id": "TV", "hidden": True}, {"id": "Gone", "hidden": False}]
    v.apps_json = [{"id": "Live TV", "label": "טלוויזיה חיה", "hidden": False, "kind": "app"}]
    src, apps = mm.view_lists(v)
    assert [s["id"] for s in src][:2] == ["HDMI1", "TV"] and src[0]["label"] == "HDMI 1 · ממיר" and src[0]["glyph"] == "gamepad" and src[1]["hidden"] is True
    assert "Gone" not in [s["id"] for s in src], "an entry the TV no longer lists is dropped"
    assert "Live TV" in [a["id"] for a in apps] and "Live TV" not in [s["id"] for s in src], "moved to apps by the curation"
    assert mm.caps(v)["sources"] is True
    v.sources_json = [{"id": i, "hidden": True} for i in ["TV", "HDMI1", "HDMI 2", "USB"]]
    assert mm.caps(v)["sources"] is False, "nothing visible, nothing offered"


def test_now_showing_source_channel_and_title():
    v = view_of([ent("media_player.tv", "webostv", "d1", source="Live TV", source_list=["Live TV", "HDMI 1", "YouTube"], media_channel="12", media_title="Live TV")])
    now = mm.live(v)["now"]
    assert now["kind"] == "source" and now["label"] == "טלוויזיה" and now["source_id"] == "Live TV" and now["channel"] == "12" and now["title"] is None
    v = view_of([ent("media_player.tv", "samsungtv_smart", "d1", state="playing", source="Netflix", app_id="Netflix", source_list=["HDMI1", "Netflix"], media_title="Series",
                     media_duration=3000, media_position=100, media_position_updated_at="2026-09-30T09:59:00Z")])
    now = mm.live(v)["now"]
    assert now["kind"] == "app" and now["label"] == "Netflix" and now["app_id"] == "Netflix" and now["title"] == "Series"
    assert (now["position_s"], now["duration_s"], now["position_at"]) == (100, 3000, "2026-09-30T09:59:00Z") and now["artwork"] is None
    assert mm.live(v)["play"] == "playing"


def test_android_home_and_screensaver():
    home = view_of([ent("media_player.tv", "androidtv_remote", "d1", app_id="com.google.android.tvlauncher"), ent("remote.tv", "androidtv_remote", "d1", activity_list=["netflix://"])])
    assert mm.live(home)["now"]["kind"] == "home" and mm.live(home)["now"]["label"] == ""
    saver = view_of([ent("media_player.tv", "androidtv_remote", "d1", app_id="com.google.android.backdrop"), ent("remote.tv", "androidtv_remote", "d1")])
    assert mm.live(saver)["now"]["kind"] == "saver" and mm.live(saver)["now"]["label"] == mm.SAVER_LABEL


def test_the_generic_profile_has_no_keys_and_a_key_endpoint_that_is_down_falls_back_to_the_generic_surface():
    v = view_of([ent("media_player.tv", "generic", "d1", device_class="tv")])
    c = mm.caps(v)
    assert c["keys"] == [] and c["text"] is False and c["touchpad"] is False and c["power_on"] is True
    android = [ent("media_player.tv", "androidtv_remote", "d1", state="on"), ent("remote.tv", "androidtv_remote", "d1", state="unavailable")]
    assert mm.caps(view_of(android))["keys"] == [] , "the remote entity is down while the media_player is up: generic surface"
    both_down = [ent("media_player.tv", "androidtv_remote", "d1", state="unavailable"), ent("remote.tv", "androidtv_remote", "d1", state="unavailable")]
    assert mm.caps(view_of(both_down))["keys"] != [], "a screen that is off stays itself (the server refuses the keys by state)"


def test_model_keys_extend_a_profile_only_with_the_options_it_has():
    v = view_of([ent("media_player.tv", "samsungtv_smart", "d1")], model_keys=["blue", "up"])
    c = mm.caps(v)
    assert "blue" in c["keys"] and c["keys"].count("up") == 1
    v = view_of([ent("media_player.tv", "webostv", "d1")], model_keys=["blue"])
    assert "blue" in mm.caps(v)["keys"], "blue is in the LG vocabulary by default"
    v = view_of([ent("media_player.tv", "webostv", "d1")], model_keys=["rew"])
    assert "rew" not in mm.caps(v)["keys"], "an LG has no option for rewind: never guessed"


def test_recent_items_keep_only_what_the_tv_still_lists():
    v = view_of([ent("media_player.tv", "samsungtv_smart", "d1", source_list=["HDMI1", "Netflix"])])
    v.recent_json = [{"kind": "app", "id": "Netflix"}, {"kind": "app", "id": "Removed"}, {"kind": "source", "id": "HDMI1"}]
    assert [(r["kind"], r["id"]) for r in mm.recent_items(v)] == [("app", "Netflix"), ("source", "HDMI1")]
