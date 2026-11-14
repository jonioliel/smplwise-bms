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
    ("philips_js", None, "screen"), ("cast", None, "speaker"), ("music_assistant", None, "speaker"), ("unknownbrand", None, "player"),  # CR-016 5.1: cast without a TV sibling and MA are speaker platforms
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


# ================================================================================================ CR-016: players, speakers, receivers, groups
# Every id, MAC and uuid below is invented. The feature masks are the real shapes of the three probes (MA full / degraded, Sonos, HEOS, WiiM, Cast, SmartThings).

VOLUME_SET_, MUTE_, STEP_ = 4, 8, 1024
MA_FULL = 8322623  # MA live player: volume, mute, transport, play_media, enqueue, shuffle, repeat, browse, search, announce, grouping, source
MA_DEGRADED = 7795251  # an unavailable / restored MA player: no VOLUME_SET, no GROUPING
SONOS_MASK = 8321599  # the full rich shape natively, no on/off
HEOS_MASK = VOLUME_SET | VOLUME_MUTE | VOLUME_STEP | PAUSE | PLAY | STOP | NEXT | PREVIOUS | PLAY_MEDIA | SELECT_SOURCE | mm.F_BROWSE_MEDIA | mm.F_SHUFFLE_SET | mm.F_REPEAT_SET | mm.F_MEDIA_ENQUEUE | mm.F_GROUPING
WIIM_MASK = VOLUME_SET | VOLUME_MUTE | PAUSE | PLAY | STOP | NEXT | PREVIOUS | SELECT_SOURCE | PLAY_MEDIA | mm.F_BROWSE_MEDIA | mm.F_GROUPING
CAST_MASK = VOLUME_SET | VOLUME_MUTE | PAUSE | PLAY | STOP | TURN_ON | TURN_OFF | PLAY_MEDIA | mm.F_BROWSE_MEDIA
ST_SPEAKER = 21517  # the cloud twin of a Sonos: volume, mute, pause / play / stop only
DENON_MAIN = VOLUME_SET | VOLUME_MUTE | VOLUME_STEP | TURN_ON | TURN_OFF | SELECT_SOURCE | mm.F_SELECT_SOUND_MODE | PLAY | PAUSE | STOP | PLAY_MEDIA
DENON_ZONE2 = VOLUME_SET | VOLUME_MUTE | VOLUME_STEP | TURN_ON | TURN_OFF | SELECT_SOURCE | mm.F_SELECT_SOUND_MODE


def mdev(device_id: str, maker: str | None = None, model: str | None = None, **kw: Any) -> dict[str, Any]:
    d = dev(device_id, **kw)
    d["manufacturer"], d["model"] = maker, model
    return d


def helper_group(entity_id: str, device_id: str, members: list[str], **kw: Any) -> dict[str, Any]:
    """An HA `group` helper media_player: its members are in the `entity_id` ATTRIBUTE (the `ent()` helper's own first argument has that name)."""
    e = ent(entity_id, "group", device_id, **kw)
    e["attributes"]["entity_id"] = members
    return e


def kinds_of(model: mm.Model) -> dict[str, str]:
    return {d.anchor: d.kind for d in model.devices.values()}


def only(model: mm.Model, ref: str) -> mm.DeviceModel:
    return next(d for d in model.devices.values() if any(e.ref == ref for e in d.endpoints))


def roles_of(d: mm.DeviceModel) -> dict[str, str]:
    return {e.ref: e.role for e in d.endpoints}


def test_audio_kinds_and_the_three_non_physical_kinds():
    ents = [ent("media_player.wiim", "wiim", "d1", features=WIIM_MASK, state="idle"),
            ent("media_player.denon", "denonavr", "d2", features=DENON_MAIN, device_class="receiver"),
            ent("media_player.ma_group", "music_assistant", "d3", features=MA_FULL, state="idle", mass_player_type="group"),
            ent("media_player.session", "jellyfin", "d4", state="unavailable"),
            helper_group("media_player.helper", "d5", ["media_player.a"], state="off"),
            ent("media_player.spot", "spotify", "d6", state="unavailable", features=2048),
            ent("media_player.sonos", "sonos", "d7", features=SONOS_MASK, state="idle"),
            ent("media_player.yam", "yamaha_musiccast", "d8", features=WIIM_MASK, device_class="receiver"),
            ent("media_player.unknown", "weirdbrand", "d9", features=PLAY)]
    m = build(ents, [dev(f"d{i}") for i in range(1, 10)])
    assert kinds_of(m) == {"media_player.wiim": "speaker", "media_player.denon": "receiver", "media_player.ma_group": "group", "media_player.session": "session",
                           "media_player.helper": "virtual_group", "media_player.spot": "service", "media_player.sonos": "speaker", "media_player.yam": "receiver",
                           "media_player.unknown": "player"}


def test_a_heos_next_to_a_denon_is_one_receiver_and_a_heos_alone_is_a_speaker():
    ents = [ent("media_player.denon", "denonavr", "d1", features=DENON_MAIN), ent("media_player.heos", "heos", "d2", features=HEOS_MASK, state="idle")]
    m = build(ents, [mdev("d1", "Denon", "AVR-X1700H"), mdev("d2", "Denon", "AVR-X1700H")])
    (d,) = m.devices.values()
    assert d.kind == "receiver" and {e.rule for e in d.endpoints} == {"3b", "single"} or d.kind == "receiver"
    (alone,) = build([ent("media_player.heos", "heos", "d2", features=HEOS_MASK, state="idle")], [dev("d2")]).devices.values()
    assert alone.kind == "speaker"


def test_a_cast_entity_without_a_device_class_whose_model_reads_as_a_tv_is_a_screen():
    ents = [ent("media_player.cast_tv", "cast", "d1", features=CAST_MASK, state="off"), ent("media_player.cast_spk", "cast", "d2", features=CAST_MASK, state="off", device_class="speaker"),
            ent("media_player.cast_nest", "cast", "d3", features=CAST_MASK, state="off"), ent("media_player.cast_soundbar", "cast", "d4", features=CAST_MASK, state="off")]
    m = build(ents, [mdev("d1", "LG Electronics", "OLED55C1PSB"), mdev("d2", "Google", "Chromecast Audio"), mdev("d3", "Google", "Nest Mini"), mdev("d4", "LG Electronics", "LG Soundbar SN5Y")])
    assert kinds_of(m) == {"media_player.cast_tv": "screen", "media_player.cast_spk": "speaker", "media_player.cast_nest": "speaker", "media_player.cast_soundbar": "speaker"}


def test_non_physical_kinds_are_never_suggested_and_never_merged():
    """System-K: eight Jellyfin sessions share one generic name; one of them has an area: still no suggestion, and a session never joins a speaker's cluster."""
    ents = [ent(f"media_player.session_{i}", "jellyfin", f"j{i}", state="unavailable", name="Generic DLNA Client", area="living" if i == 0 else None) for i in range(8)]
    ents += [ent("media_player.sonos_a", "sonos", "s1", features=SONOS_MASK, state="idle", name="Generic DLNA Client", area="kitchen")]
    m = build(ents, [dev(f"j{i}") for i in range(8)] + [dev("s1")])
    assert sum(1 for d in m.devices.values() if d.kind == "session") == 8
    assert m.suggestions == [], "sessions, helper groups and Spotify lists are never suggested - nor is a speaker paired with them"
    assert [d.kind for d in m.devices.values() if d.anchor == "media_player.sonos_a"] == ["speaker"]


def test_rung_2b_an_ma_id_equal_to_a_vendor_id_merges_strong_the_heos_pair():
    ents = [ent("media_player.heos", "heos", "d1", features=HEOS_MASK, state="idle"), ent("media_player.ma_heos", "music_assistant", "d2", features=MA_FULL, state="idle", unique_id="-1884291837")]
    m = build(ents, [dev("d1", idents=[("heos", "-1884291837")]), dev("d2", idents=[("music_assistant", "-1884291837")])])
    (d,) = m.devices.values()
    assert d.confidence == "strong" and next(e for e in d.endpoints if e.ref == "media_player.ma_heos").rule == "2b"
    assert roles_of(d) == {"media_player.heos": "vendor", "media_player.ma_heos": "music"}


@pytest.mark.parametrize("shared", ["192.0.2.50", "2001:db8::7", "tv-living-room", "livingroomtv", "http://tv.local/desc.xml", "abc123", "12345"])
def test_rungs_2b_2c_never_merge_on_an_ip_or_hostname_shaped_or_short_id(shared):
    ents = [ent("media_player.vendor", "heos", "d1", features=HEOS_MASK, state="idle"), ent("media_player.ma", "music_assistant", "d2", features=MA_FULL, state="idle", unique_id=shared)]
    m = build(ents, [dev("d1", idents=[("heos", shared)]), dev("d2", idents=[("music_assistant", shared)])])
    assert len(m.devices) == 2, shared
    embeds = [ent("media_player.vendor", "wiim", "d1", features=WIIM_MASK, state="idle"), ent("media_player.ma", "music_assistant", "d2", features=MA_FULL, state="idle", unique_id=f"prefix_{shared}")]
    assert len(build(embeds, [dev("d1", idents=[("wiim", shared)]), dev("d2")]).devices) == 2, shared


def test_rung_2c_an_ma_id_that_embeds_a_vendor_id_merges_and_two_wiims_stay_two():
    a, b = "uuid:aaaaaaaa-1111-2222-3333-000000000001", "uuid:bbbbbbbb-1111-2222-3333-000000000002"
    ents = [ent("media_player.wiim_a", "wiim", "da", features=WIIM_MASK, state="idle"), ent("media_player.wiim_b", "wiim", "db", features=WIIM_MASK, state="idle"),
            ent("media_player.ma_a", "music_assistant", "ma", features=MA_FULL, state="idle", unique_id="up2date_aaaaaaaa111122223333000000000001"),
            ent("media_player.ma_b", "music_assistant", "mb", features=MA_FULL, state="idle", unique_id="up2date_bbbbbbbb111122223333000000000002")]
    m = build(ents, [dev("da", idents=[("wiim", a)]), dev("db", idents=[("wiim", b)]), dev("ma"), dev("mb")])
    assert groups(m) == [{"media_player.ma_a", "media_player.wiim_a"}, {"media_player.ma_b", "media_player.wiim_b"}]
    assert all(d.confidence == "strong" for d in m.devices.values())
    assert only(m, "media_player.ma_a").endpoints[0].rule in ("2c", "single") and roles_of(only(m, "media_player.wiim_a"))["media_player.ma_a"] == "music"


def test_rung_3b_a_unique_manufacturer_and_model_merges_cast_and_ma_shortened_cast_model_included():
    ents = [ent("media_player.cast", "cast", "d1", features=CAST_MASK, state="off", device_class="speaker"), ent("media_player.ma", "music_assistant", "d2", features=MA_FULL, state="idle")]
    m = build(ents, [mdev("d1", "Acme", "Mega Speaker 5"), mdev("d2", "Acme", "Mega Speaker 5 Pro")])  # Cast reports the shorter model
    (d,) = m.devices.values()
    assert d.confidence == "strong" and {e.rule for e in d.endpoints} == {"3b"} and m.suggestions == []
    other = build(ents, [mdev("d1", "Acme", "Mega Speaker 5"), mdev("d2", "Other", "Mega Speaker 5")])
    assert len(other.devices) == 2, "another manufacturer: not the same model"
    nomodel = build(ents, [mdev("d1", "Acme", None), mdev("d2", "Acme", None)])
    assert len(nomodel.devices) == 2


def test_rung_3b_the_same_model_twice_is_ambiguous_a_suggestion_and_never_a_merge():
    """System-V: two identical TVs, each a Cast entity plus an MA twin - four clusters; the model alone cannot say which pairs."""
    ents = [ent("media_player.cast_1", "cast", "c1", features=CAST_MASK, state="off", device_class="speaker"), ent("media_player.cast_2", "cast", "c2", features=CAST_MASK, state="off", device_class="speaker"),
            ent("media_player.ma_1", "music_assistant", "m1", features=MA_FULL, state="idle"), ent("media_player.ma_2", "music_assistant", "m2", features=MA_FULL, state="idle")]
    m = build(ents, [mdev("c1", "Acme", "Twin 1"), mdev("c2", "Acme", "Twin 1"), mdev("m1", "Acme", "Twin 1"), mdev("m2", "Acme", "Twin 1")])
    assert len(m.devices) == 4, "ambiguous: nothing merged"
    pairs = {(s.endpoint_id, only(m, s.endpoint_id.removeprefix("ha:")).key != s.device_key and next(d.anchor for d in m.devices.values() if d.key == s.device_key)) for s in m.suggestions}
    assert m.suggestions and all(s.rule == "3b" and s.reason == "same_model" for s in m.suggestions)
    cast_ma = {(s.endpoint_id.removeprefix("ha:"), next(d.anchor for d in m.devices.values() if d.key == s.device_key)) for s in m.suggestions}
    assert all((a.startswith("media_player.cast") != b.startswith("media_player.cast")) for a, b in cast_ma), "never two Cast entities together (the same-platform guard)"
    assert pairs


def test_rung_3b_ambiguous_twins_stop_being_a_suggestion_once_each_pair_is_linked():
    """System-V again: after the owner linked each TV's Cast entity with its Music Assistant twin, the two devices both hold a Cast and an MA entity: merging them would
    put two Cast entities in one device, so the wizard no longer offers the pair."""
    ents = [ent("media_player.cast_1", "cast", "c1", features=CAST_MASK, state="off", device_class="speaker"), ent("media_player.cast_2", "cast", "c2", features=CAST_MASK, state="off", device_class="speaker"),
            ent("media_player.ma_1", "music_assistant", "m1", features=MA_FULL, state="idle"), ent("media_player.ma_2", "music_assistant", "m2", features=MA_FULL, state="idle")]
    metas = [mdev("c1", "Acme", "Twin 1"), mdev("c2", "Acme", "Twin 1"), mdev("m1", "Acme", "Twin 1"), mdev("m2", "Acme", "Twin 1")]
    assert build(ents, metas).suggestions, "before the links: the ambiguous pairs are offered"
    base = build(ents, metas)
    k1, k2 = only(base, "media_player.cast_1").key, only(base, "media_player.cast_2").key
    rules = [{"endpoint_id": "ha:media_player.ma_1", "rule": "link", "device_key": k1}, {"endpoint_id": "ha:media_player.ma_2", "rule": "link", "device_key": k2}]
    linked = build(ents, metas, rules, existing_keys={e.endpoint_id: d.key for d in base.devices.values() for e in d.endpoints})
    assert len(linked.devices) == 2 and linked.suggestions == [], "each TV is one device now: no cross suggestion between two TVs"


def test_rung_5b_the_same_name_with_an_area_on_one_side_is_a_suggestion_and_an_empty_name_never_matches():
    ents = [ent("media_player.sonos_a", "sonos", "s1", features=SONOS_MASK, state="idle", name="Kitchen", area="kitchen"),
            ent("media_player.st_a", "smartthings", "t1", features=ST_SPEAKER, state="idle", name="Kitchen", device_class="speaker"),
            ent("media_player.model_cast", "cast", "c1", features=CAST_MASK, state="off", name="QE55Q60", area="living", device_class="speaker"),
            ent("media_player.model_ma", "music_assistant", "m1", features=MA_FULL, state="idle", name="QE55Q60")]
    m = build(ents, [dev("s1", name="Kitchen"), dev("t1", name="Kitchen"), dev("c1", name="QE55Q60"), dev("m1", name="QE55Q60")])
    assert [(s.endpoint_id, s.rule, s.reason) for s in m.suggestions] == [("ha:media_player.st_a", "5b", "same_name_area_one_side")], "model-number names normalise to nothing: no match"
    assert mm.normalised_name("QE55Q60") == ""
    # area on both sides (the same area): the shipped rung 5; two areas that differ: nothing; no area at all: nothing
    both = build([ents[0], dict(ents[1], area_id="kitchen")], [dev("s1", name="Kitchen"), dev("t1", name="Kitchen")])
    assert [(s.rule, s.reason) for s in both.suggestions] == [("weak", "same_area_and_name")]
    far = build([ents[0], dict(ents[1], area_id="office")], [dev("s1", name="Kitchen"), dev("t1", name="Kitchen")])
    assert far.suggestions == []
    none = build([dict(ents[0], area_id=None), ents[1]], [dev("s1", name="Kitchen"), dev("t1", name="Kitchen")])
    assert none.suggestions == []


def test_a_strictly_poorer_smartthings_twin_is_a_mirror_never_a_primary_and_hidden():
    ents = [ent("media_player.sonos", "sonos", "s1", features=SONOS_MASK, state="idle", name="Kitchen", device_class="speaker", area="kitchen"),
            ent("media_player.st", "smartthings", "t1", features=ST_SPEAKER, state="idle", name="Kitchen", device_class="speaker")]
    base = build(ents, [dev("s1"), dev("t1")])
    key = next(d.key for d in base.devices.values() if d.anchor == "media_player.sonos")
    m = build(ents, [dev("s1"), dev("t1")], [{"endpoint_id": "ha:media_player.st", "rule": "link", "device_key": key}], existing_keys=base.by_endpoint)
    (d,) = m.devices.values()
    assert roles_of(d) == {"media_player.sonos": "vendor", "media_player.st": "mirror"}
    assert next(e for e in d.endpoints if e.ref == "media_player.st").hidden is True and d.music_provider == "sonos"
    states = {e["entity_id"]: e for e in ents}
    prim = mm.primaries(d, states, "generic")
    assert "media_player.st" not in prim.values(), "a mirror is never the primary of any control"
    assert prim["music"] == "media_player.sonos" and prim["volume"] == "media_player.sonos" and prim["group"] == "media_player.sonos"


def test_screens_keep_their_cr015_roles_a_smartthings_tv_twin_is_not_a_mirror():
    ents = [ent("media_player.tv", "samsungtv_smart", "d1", device_class="tv"), ent("media_player.tv_st", "smartthings", "d2", device_class="tv", features=VOLUME_SET)]
    (d,) = build(ents, [dev("d1", macs=["AA:BB:CC:00:00:01"]), dev("d2", macs=["AA:BB:CC:00:00:01"])]).devices.values()
    assert roles_of(d)["media_player.tv_st"] == "smartthings"


def test_user_hidden_entities_stay_in_the_model_as_hidden_endpoints_and_disabled_ones_never_enter():
    ents = [ent("media_player.cast", "cast", "d1", features=CAST_MASK, state="off", device_class="speaker", name="Pergola"),
            dict(ent("media_player.ma", "music_assistant", "d2", features=MA_FULL, state="idle", name="Pergola"), hidden=True),
            dict(ent("media_player.old", "linkplay", "d3", features=WIIM_MASK, state="off", name="Pergola"), disabled=True)]
    m = build(ents, [dev("d1"), dev("d2"), dev("d3")], [{"endpoint_id": "ha:media_player.ma", "rule": "link", "device_key": "x"}])
    refs = {e.ref for d in m.devices.values() for e in d.endpoints}
    assert "media_player.old" not in refs
    cluster = [d for d in m.devices.values() if any(e.ref == "media_player.ma" for e in d.endpoints)][0]
    assert next(e for e in cluster.endpoints if e.ref == "media_player.ma").hidden is True or len(cluster.endpoints) == 1


def test_the_music_layer_is_chosen_by_flags_ma_sonos_heos_and_the_tie_goes_to_ma():
    wiim_ma = build([ent("media_player.wiim", "wiim", "d1", features=WIIM_MASK, state="idle"), ent("media_player.cast", "cast", "d3", features=CAST_MASK, state="off"),
                     ent("media_player.ma", "music_assistant", "d2", features=MA_FULL, state="idle", unique_id="p_aaaaaaaa111122223333000000000001")],
                    [dev("d1", idents=[("wiim", "uuid:aaaaaaaa-1111-2222-3333-000000000001")], macs=["AA:BB:CC:00:00:01"]), dev("d2"), dev("d3", macs=["AA:BB:CC:00:00:01"])])
    (d,) = wiim_ma.devices.values()
    ents = {e.ref: {"entity_id": e.ref, "state": "idle", "available": True, "attributes": {}, "supported_features": {"media_player.wiim": WIIM_MASK, "media_player.cast": CAST_MASK, "media_player.ma": MA_FULL}[e.ref]} for e in d.endpoints}
    assert mm.music_endpoint(d, ents).ref == "media_player.ma" and mm.music_provider_of(d, ents) == "ma"
    # a vendor-only speaker (WiiM + Cast, no MA): no music layer, the provider is the vendor
    d2 = mm.DeviceModel("k", [mm.Endpoint("ha:media_player.wiim", "media_player.wiim", "media_player", "wiim", "d1", "vendor")], "speaker", "exact", "media_player.wiim", "generic")
    assert mm.music_endpoint(d2, ents) is None and mm.music_provider_of(d2, ents) == "vendor"
    # system-V: HEOS and MA both carry the full mask: MA wins the tie
    heos = {"media_player.heos": {"entity_id": "media_player.heos", "state": "idle", "available": True, "attributes": {}, "supported_features": HEOS_MASK},
            "media_player.ma": {"entity_id": "media_player.ma", "state": "idle", "available": True, "attributes": {}, "supported_features": MA_FULL}}
    d3 = mm.DeviceModel("k", [mm.Endpoint("ha:media_player.heos", "media_player.heos", "media_player", "heos", "d1", "vendor"), mm.Endpoint("ha:media_player.ma", "media_player.ma", "media_player", "music_assistant", "d2", "music")], "receiver", "exact", "media_player.heos", "generic")
    assert mm.music_endpoint(d3, heos).ref == "media_player.ma"
    # without MA the Sonos entity is the layer; with only HEOS: HEOS
    heos_only = mm.DeviceModel("k", [d3.endpoints[0]], "speaker", "exact", "media_player.heos", "generic")
    assert mm.music_provider_of(heos_only, heos) == "heos"


def test_receiver_zones_one_device_main_first_and_the_zone_endpoint():
    ents = [ent("media_player.avr_main", "denonavr", "d1", features=DENON_MAIN, device_class="receiver", name="AVR Main", volume_level=0.3, source="TV"),
            ent("media_player.avr_zone2", "denonavr", "d1", features=DENON_ZONE2, device_class="receiver", name="AVR Zone2", volume_level=0.2, source="Radio", state="off"),
            ent("media_player.heos_avr", "heos", "d2", features=HEOS_MASK, state="idle"),
            ent("media_player.ma_avr", "music_assistant", "d3", features=MA_FULL, state="idle", unique_id="-99887766")]
    m = build(ents, [mdev("d1", "Denon", "AVR-X1700H"), mdev("d2", "Denon", "AVR-X1700H", idents=[("heos", "-99887766")]), mdev("d3")])
    (d,) = m.devices.values()
    assert d.kind == "receiver" and [z["id"] for z in d.zones] == ["main", "zone2"] and d.zones[0]["endpoint_id"] == "ha:media_player.avr_main"
    states = {e["entity_id"]: e for e in ents}
    prim = mm.primaries(d, states, "generic")
    assert prim["power"] == "media_player.avr_main" and prim["sources"] == "media_player.avr_main" and prim["sound_mode"] == "media_player.avr_main", "power / source / sound mode answer on the main zone's denonavr entity"
    assert prim["music"] == "media_player.ma_avr" and prim["group"] == "media_player.ma_avr", "rich music and grouping through MA, never the denonavr entity"
    assert mm.zone_endpoint(d, "zone2").ref == "media_player.avr_zone2" and mm.zone_endpoint(d, None).ref == "media_player.avr_main" and mm.zone_endpoint(d, "zone9") is None
    zs = mm.zone_states(d, states)
    assert [(z["id"], z["power"], z["volume"], z["source_id"]) for z in zs] == [("main", "on", 30, "TV"), ("zone2", "off", 20, "Radio")]
    single = build([ent("media_player.onkyo", "onkyo", "d1", features=DENON_ZONE2, device_class="receiver")], [dev("d1")])
    (s,) = single.devices.values()
    assert s.kind == "receiver" and s.zones is None


def test_primaries_of_a_wiim_with_its_ma_and_cast_copies():
    a = "uuid:aaaaaaaa-1111-2222-3333-000000000001"
    ents = [ent("media_player.wiim", "wiim", "d1", features=WIIM_MASK, state="idle", volume_level=0.4, source="WiFi", source_list=["WiFi", "Line-in"]),
            ent("media_player.cast", "cast", "d3", features=CAST_MASK, state="off", device_class="speaker"),
            ent("media_player.ma", "music_assistant", "d2", features=MA_FULL, state="idle", unique_id="x_aaaaaaaa111122223333000000000001", active_queue=None, source_list=["External"])]
    m = build(ents, [dev("d1", idents=[("wiim", a)]), dev("d2"), dev("d3", macs=["AA:BB:CC:00:00:01"])], [{"endpoint_id": "ha:media_player.cast", "rule": "link", "device_key": "z" * 32}])
    d = only(m, "media_player.wiim")
    states = {e["entity_id"]: e for e in ents}
    prim = mm.primaries(d, states, "generic")
    assert prim["power"] is None, "no vendor power, and never Cast (its 'on' launches an app) nor MA"
    assert prim["volume"] == "media_player.wiim" and prim["mute"] == "media_player.wiim"
    assert prim["sources"] == "media_player.wiim", "the WiiM inputs - never MA's 'External'"
    assert prim["music"] == "media_player.ma" and prim["group"] == "media_player.ma" and prim["now_playing"] == "media_player.wiim"
    # MA plays and owns the playback (a queue): transport and now playing answer there
    states["media_player.ma"] = dict(states["media_player.ma"], state="playing", attributes={"active_queue": "queue-1", "media_title": "Song"})
    assert mm.primaries(d, states, "generic")["now_playing"] == "media_player.ma"


def test_the_administrators_primary_override_holds_for_audio_controls_too():
    ents = [ent("media_player.wiim", "wiim", "d1", features=WIIM_MASK, state="idle"), ent("media_player.cast", "cast", "d2", features=CAST_MASK, state="off", device_class="speaker")]
    base = build(ents, [dev("d1", macs=["AA:BB:CC:00:00:01"]), dev("d2", macs=["AA:BB:CC:00:00:01"])])
    (d,) = base.devices.values()
    states = {e["entity_id"]: e for e in ents}
    assert mm.primaries(d, states, "generic")["volume"] == "media_player.wiim"
    assert mm.primaries(d, states, "generic", {"volume": "media_player.cast", "music": "media_player.nope"})["volume"] == "media_player.cast"


def ma_entity(entity_id: str, uid: str, **attrs: Any) -> dict[str, Any]:
    return ent(entity_id, "music_assistant", f"dev_{uid}", features=MA_FULL, state="idle", unique_id=uid, **attrs)


def group_model(entities: list[dict[str, Any]]) -> tuple[mm.Model, dict[str, dict[str, Any]], dict[str, str], dict[str, dict[str, Any]]]:
    m = build(entities, [dev(e["device_id"]) for e in entities])
    states = {e["entity_id"]: e for e in entities}
    by_entity = {ep.ref: d.key for d in m.devices.values() for ep in d.endpoints}
    return m, states, by_entity, mm.resolve_groups(m.devices, states, by_entity)


def test_a_cross_brand_ma_group_is_the_union_of_group_members_and_active_queue_leader_is_the_queue_owner():
    """System-V: four players play as one; the leader and one member list all four, the other two list nothing but follow the leader's queue."""
    lead = ma_entity("media_player.ma_living", "p-living", group_members=["media_player.ma_living", "media_player.ma_kitchen", "media_player.ma_office", "media_player.ma_den"], active_queue="p-living")
    ents = [lead,
            ma_entity("media_player.ma_kitchen", "p-kitchen", group_members=["media_player.ma_living", "media_player.ma_kitchen", "media_player.ma_office", "media_player.ma_den"], active_queue="p-living"),
            ma_entity("media_player.ma_office", "p-office", group_members=[], active_queue="p-living"),
            ma_entity("media_player.ma_den", "p-den", active_queue="p-living"),
            ma_entity("media_player.ma_alone", "p-alone", group_members=[], active_queue="p-alone")]
    m, _states, by, groups_ = group_model(ents)
    k = {ref: by[ref] for ref in by}
    leader = k["media_player.ma_living"]
    for ref in ("media_player.ma_living", "media_player.ma_kitchen", "media_player.ma_office", "media_player.ma_den"):
        g = groups_[k[ref]]
        assert g["leader_key"] == leader and g["layer"] == "ma" and g["conflict"] is False and g["member_keys"][0] == leader and len(g["member_keys"]) == 4, ref
        assert g["role"] == ("leader" if ref == "media_player.ma_living" else "member")
    assert groups_[k["media_player.ma_alone"]]["role"] == "none" and groups_[k["media_player.ma_alone"]]["member_keys"] == []


def test_the_four_ungrouped_encodings_are_all_ungrouped():
    ents = [ma_entity("media_player.ma", "p1", group_members=[]),
            ent("media_player.wiim", "wiim", "dw", features=WIIM_MASK, state="idle", group_members=["media_player.wiim"]),
            ent("media_player.heos", "heos", "dh", features=HEOS_MASK, state="idle", group_members=None),
            ent("media_player.sonos", "sonos", "ds", features=SONOS_MASK, state="idle", group_members=["media_player.sonos"]),
            ent("media_player.denon", "denonavr", "dd", features=DENON_MAIN, device_class="receiver")]
    _m, _s, _by, g = group_model(ents)
    assert {v["role"] for v in g.values()} == {"none"}


def test_sonos_groups_natively_through_the_vendor_layer_and_a_cast_never_groups():
    ents = [ent("media_player.sonos_a", "sonos", "d1", features=SONOS_MASK, state="idle", group_members=["media_player.sonos_a", "media_player.sonos_b"]),
            ent("media_player.sonos_b", "sonos", "d2", features=SONOS_MASK, state="idle", group_members=["media_player.sonos_a", "media_player.sonos_b"]),
            ent("media_player.cast", "cast", "d3", features=CAST_MASK, state="off", device_class="speaker", group_members=["media_player.sonos_a", "media_player.cast"])]
    m, states, by, g = group_model(ents)
    a, b, c = by["media_player.sonos_a"], by["media_player.sonos_b"], by["media_player.cast"]
    assert (g[a]["role"], g[a]["layer"], g[b]["role"], g[b]["leader_key"]) == ("leader", "vendor", "member", a)
    assert g[c]["role"] == "none" and g[c]["layer"] is None, "a Cast entity has no GROUPING layer: whatever its attributes say"
    assert mm.group_endpoint(m.devices[c], states) == (None, None)


def test_one_group_layer_per_device_a_wiim_pair_grouped_in_both_layers_is_an_alias_and_a_disagreement_is_a_conflict():
    a, b = "uuid:aaaaaaaa-1111-2222-3333-000000000001", "uuid:bbbbbbbb-1111-2222-3333-000000000002"
    def house(vendor_members: list[str], ma_members: list[str]) -> dict[str, dict[str, Any]]:
        ents = [ent("media_player.wiim_a", "wiim", "da", features=WIIM_MASK, state="idle", group_members=vendor_members),
                ent("media_player.wiim_b", "wiim", "db", features=WIIM_MASK, state="idle", group_members=vendor_members),
                ent("media_player.ma_a", "music_assistant", "ma", features=MA_FULL, state="idle", unique_id="x_aaaaaaaa111122223333000000000001", group_members=ma_members, active_queue="x_aaaaaaaa111122223333000000000001"),
                ent("media_player.ma_b", "music_assistant", "mb", features=MA_FULL, state="idle", unique_id="x_bbbbbbbb111122223333000000000002", group_members=[], active_queue="x_aaaaaaaa111122223333000000000001" if ma_members else "x_bbbbbbbb111122223333000000000002")]
        m = build(ents, [dev("da", idents=[("wiim", a)]), dev("db", idents=[("wiim", b)]), dev("ma"), dev("mb")])
        states = {e["entity_id"]: e for e in ents}
        by = {ep.ref: d.key for d in m.devices.values() for ep in d.endpoints}
        out = mm.resolve_groups(m.devices, states, by)
        return {"a": out[by["media_player.wiim_a"]], "b": out[by["media_player.wiim_b"]], "keys": (by["media_player.wiim_a"], by["media_player.wiim_b"])}
    alias = house(["media_player.wiim_a", "media_player.wiim_b"], ["media_player.ma_a", "media_player.ma_b"])
    assert alias["a"]["layer"] == "ma" and alias["a"]["role"] == "leader" and alias["a"]["conflict"] is False and alias["b"]["role"] == "member", "the vendor group of the same members is an alias"
    conflict = house(["media_player.wiim_a", "media_player.wiim_b"], [])
    assert conflict["a"]["conflict"] is True and conflict["a"]["role"] == "none", "grouped in the vendor layer, not in MA: 'קיבוץ לא תואם'"
    native_unused = house(["media_player.wiim_a"], ["media_player.ma_a", "media_player.ma_b"])
    assert native_unused["a"]["conflict"] is False, "system-V: the WiiMs list only themselves natively while MA groups them - the native layer is simply unused"


def test_static_groups_virtual_groups_and_unknown_members():
    ents = [ma_entity("media_player.ma_a", "p-a"), ma_entity("media_player.ma_b", "p-b"),
            ent("media_player.ma_stereo", "music_assistant", "dg", features=MA_FULL, state="idle", unique_id="p-g", mass_player_type="group",
                group_members=["media_player.ma_a", "media_player.ma_b", "media_player.somebody_else"]),
            helper_group("media_player.helper", "dh", ["media_player.ma_a", "media_player.ma_b"], state="on", features=PLAY | PAUSE | VOLUME_SET)]
    m, _s, by, g = group_model(ents)
    sk = by["media_player.ma_stereo"]
    assert g[sk]["static"] is True and g[sk]["role"] == "leader" and sorted(g[sk]["member_keys"]) == sorted([by["media_player.ma_a"], by["media_player.ma_b"]]), "unknown members are not mapped"
    assert g[by["media_player.ma_a"]]["role"] == "none", "the children of a static group are not a live group"
    hk = by["media_player.helper"]
    assert g[hk] == dict(mm.NO_GROUP) and m.devices[hk].kind == "virtual_group", "a helper group is never a live group"
    assert mm.virtual_members(m.devices[hk], {e["entity_id"]: e for e in ents}, by) == [by["media_player.ma_a"], by["media_player.ma_b"]]


def test_caps_come_from_an_available_endpoint_with_the_last_good_mask_as_fallback():
    live_ma = ent("media_player.ma", "music_assistant", "d1", features=MA_FULL, state="idle", unique_id="p1", group_members=[])
    (d,) = build([live_ma], [dev("d1")]).devices.values()
    states = {"media_player.ma": live_ma}
    view = lambda e: mm.DeviceView(dev=d, ents={"media_player.ma": e}, profile="generic", prim=mm.primaries(d, {"media_player.ma": e}, "generic"))  # noqa: E731
    caps = mm.caps(view(live_ma))
    assert caps["volume_set"] and caps["group"] and caps["shuffle"] and caps["repeat"] and caps["transport"]["pause"]
    assert mm.live(view(live_ma))["caps_known"] is True
    # restored / unavailable with a DEGRADED mask and no memory: nothing is guessed - no volume, no grouping - but the device is still a device
    degraded = dict(live_ma, state="unavailable", available=False, supported_features=MA_DEGRADED)
    c2 = mm.caps(view(degraded))
    assert c2["volume_set"] is False and c2["group"] is False
    live2 = mm.live(view(degraded))
    assert live2["caps_known"] is False and live2["power"] == "unavailable"
    # the same entity with the last good mask remembered: the controls stay (greyed by caps_known false), never "a device without capabilities"
    remembered = dict(degraded, last_features=MA_FULL)
    c3 = mm.caps(view(remembered))
    assert c3["volume_set"] and c3["group"] and c3["shuffle"]
    assert mm.live(view(remembered))["caps_known"] is False
    # an AVAILABLE entity reads its live mask even when an old one is remembered
    assert mm.eff_features(dict(live_ma, last_features=MA_DEGRADED)) == MA_FULL


def test_availability_is_per_integration_a_cast_only_speaker_that_drops_off_is_asleep():
    cast = ent("media_player.cast", "cast", "d1", features=CAST_MASK, state="unavailable", device_class="speaker", available=False)
    (d,) = build([cast], [dev("d1")]).devices.values()
    v = mm.DeviceView(dev=d, ents={"media_player.cast": cast}, profile="generic", prim=mm.primaries(d, {"media_player.cast": cast}, "generic"))
    assert mm.asleep_when_unavailable(d) is True and mm.live(v)["power"] == "off" and mm.live(v)["caps_known"] is False
    wiim = ent("media_player.wiim", "wiim", "d2", features=WIIM_MASK, state="unavailable", available=False)
    (w,) = build([wiim], [dev("d2")]).devices.values()
    vw = mm.DeviceView(dev=w, ents={"media_player.wiim": wiim}, profile="generic", prim=mm.primaries(w, {"media_player.wiim": wiim}, "generic"))
    assert mm.asleep_when_unavailable(w) is False and mm.live(vw)["power"] == "unavailable"


def test_live_audio_now_playing_station_group_queue_and_receiver_source():
    sonos = ent("media_player.sonos", "sonos", "d1", features=SONOS_MASK, state="playing", media_title="Song", media_artist="Artist", media_album_name="Album", media_duration=200, media_position=50,
                media_content_type="music", shuffle=True, repeat="all", queue_size=12, queue_position=3, volume_level=0.25, is_volume_muted=False,
                media_position_updated_at="2026-10-01T10:00:00+00:00", source_list=["Radio One", "Favourite A"])
    (d,) = build([sonos], [dev("d1")]).devices.values()
    v = mm.DeviceView(dev=d, ents={"media_player.sonos": sonos}, profile="generic", prim=mm.primaries(d, {"media_player.sonos": sonos}, "generic"))
    lv = mm.live(v, artwork="x")
    assert lv["power"] == "on" and lv["play"] == "playing" and lv["now"]["kind"] == "music" and (lv["now"]["title"], lv["now"]["artist"], lv["now"]["album"]) == ("Song", "Artist", "Album")
    assert lv["now"]["duration_s"] == 200 and lv["now"]["position_s"] == 50 and lv["now"]["artwork"] == "x" and lv["now"]["glyph"] == "music"
    assert (lv["shuffle"], lv["repeat"], lv["queue"], lv["volume"]["level"], lv["caps_known"]) == (True, "all", {"count": 12, "index": 3}, 25, True)
    assert lv["group"]["role"] == "none"
    station = dict(sonos, attributes=dict(sonos["attributes"], media_content_type="radio", media_duration=None, media_title="Radio One"))
    ls = mm.live(mm.DeviceView(dev=d, ents={"media_player.sonos": station}, profile="generic", prim=v.prim))
    assert ls["now"]["kind"] == "station" and ls["now"]["duration_s"] is None and ls["now"]["position_s"] is None
    paused_idle = dict(sonos, state="idle")
    assert mm.live(mm.DeviceView(dev=d, ents={"media_player.sonos": paused_idle}, profile="generic", prim=v.prim))["now"]["kind"] == "none"
    avr = ent("media_player.avr", "denonavr", "d2", features=DENON_MAIN, device_class="receiver", state="on", source="TV", volume_level=0.4)
    (r,) = build([avr], [dev("d2")]).devices.values()
    rl = mm.live(mm.DeviceView(dev=r, ents={"media_player.avr": avr}, profile="generic", prim=mm.primaries(r, {"media_player.avr": avr}, "generic")))
    assert rl["now"]["kind"] == "source" and rl["now"]["label"] == "TV" and rl["power"] == "on"
    off = dict(avr, state="off")
    assert mm.live(mm.DeviceView(dev=r, ents={"media_player.avr": off}, profile="generic", prim=mm.primaries(r, {"media_player.avr": off}, "generic")))["power"] == "off"


def test_caps_audio_library_and_group_flags_follow_the_provider():
    ma = ma_entity("media_player.ma", "p1", group_members=[], queue_size=None)
    (d,) = build([ma], [dev(f"dev_p1")]).devices.values()
    v = mm.DeviceView(dev=d, ents={"media_player.ma": ma}, profile="generic", prim=mm.primaries(d, {"media_player.ma": ma}, "generic"))
    c = mm.caps(v, group=dict(mm.NO_GROUP))
    assert (c["favourites"], c["stations"], c["playlists"], c["up_next"], c["transfer"], c["group"]) == (True, True, True, True, True, True)
    assert mm.caps(v, group=dict(mm.NO_GROUP), library={"kinds_on": ("stations",)})["favourites"] is False
    leader = {"role": "leader", "leader_key": d.key, "member_keys": [d.key, "x" * 32], "name": None, "static": False, "layer": "ma", "conflict": False}
    assert mm.caps(v, group=leader)["volume_group"] is True and mm.caps(v, group=dict(mm.NO_GROUP))["volume_group"] is False
    sonos = ent("media_player.sonos", "sonos", "d2", features=SONOS_MASK, state="idle", source_list=["A"], queue_size=3)
    (s,) = build([sonos], [dev("d2")]).devices.values()
    sv = mm.DeviceView(dev=s, ents={"media_player.sonos": sonos}, profile="generic", prim=mm.primaries(s, {"media_player.sonos": sonos}, "generic"))
    sc = mm.caps(sv)
    assert (sc["favourites"], sc["stations"], sc["playlists"], sc["transfer"], sc["up_next"]) == (True, True, False, False, True), "Sonos favourites and stations, no playlists, no transfer"
    cast = ent("media_player.cast", "cast", "d3", features=CAST_MASK, state="off", device_class="speaker")
    (cc,) = build([cast], [dev("d3")]).devices.values()
    cv = mm.DeviceView(dev=cc, ents={"media_player.cast": cast}, profile="generic", prim=mm.primaries(cc, {"media_player.cast": cast}, "generic"))
    ccaps = mm.caps(cv)
    assert (ccaps["group"], ccaps["favourites"], ccaps["up_next"], ccaps["transfer"], ccaps["shuffle"], ccaps["power_on"]) == (False,) * 6, "a Cast speaker offers no group section and never powers on through Cast"
