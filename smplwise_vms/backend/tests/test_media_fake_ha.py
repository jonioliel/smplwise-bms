"""CR-015 (S4): frontend/tests/fixtures/media_fake_ha.py - the fake Home Assistant of the live multimedia specs - is itself
under test, so the live specs can trust it: the synthetic house is consistent, private material is absent, the dedupe
ladder of CR section 3.3 (rungs 1-4 and the two-Samsung guard) resolves the world to exactly the intended physical devices
(an INDEPENDENT implementation here, to cross-check the backend's services/media_model.py once it lands), the feature
bits reproduce the integrations' documented shapes, the key tables hold the exact codes of the research notes without any
power key, and the fake bridge / control server behave as their docstring says. No network: the add-on side is a stub."""
from __future__ import annotations

import importlib.util
import json
import re
import sys
import threading
import time
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path

import httpx
import pytest

ROOT = Path(__file__).resolve().parents[3]
FIXTURE = ROOT / "frontend" / "tests" / "fixtures" / "media_fake_ha.py"


def _load():
    spec = importlib.util.spec_from_file_location("media_fake_ha_under_test", FIXTURE)
    mod = importlib.util.module_from_spec(spec)
    sys.modules[spec.name] = mod
    spec.loader.exec_module(mod)  # no side effect on import: everything process-wide happens in install()
    return mod


fx = _load()
MEDIA_ALLOWED = {
    ("media_player", s) for s in ("turn_on", "turn_off", "volume_set", "volume_mute", "volume_up", "volume_down", "media_play", "media_pause", "media_stop", "media_play_pause",
                                  "media_next_track", "media_previous_track", "select_source", "play_media")
} | {("remote", "send_command"), ("remote", "turn_on"), ("webostv", "button"), ("webostv", "select_sound_output")}


@pytest.fixture()
def world():
    return fx.build_world()


@pytest.fixture()
def bridge(monkeypatch, world):
    """The fake bridge with the bridge 0.4.0 media allow-list, effects applied at once into a recorder instead of the add-on."""
    pushed: list[list[str]] = []
    monkeypatch.setattr(fx, "_push", lambda ids: (pushed.append(list(ids)), _done()))
    monkeypatch.setattr(fx.MODEL, "effect_delay", 0.0)
    monkeypatch.setattr(fx.MODEL, "allowed", MEDIA_ALLOWED | {("light", "turn_on")})
    monkeypatch.setattr(fx.MODEL, "refuse", None)
    fx.MODEL.pending = 0
    fx.MODEL.load(world)
    return pushed


def _done() -> None:
    with fx.MODEL.lock:
        fx.MODEL.pending = max(0, fx.MODEL.pending - 1)


def call(domain, service, **data):
    return fx.execute({"domain": domain, "service": service, "data": data})


def last():
    return fx.MODEL.log[-1]


def settle():
    deadline = time.time() + 2
    while fx.MODEL.pending and time.time() < deadline:
        time.sleep(0.01)


# ------------------------------------------------------------------------------------------------ the synthetic house


def test_import_has_no_side_effects_and_refuses_the_addon(monkeypatch):
    # nothing was patched by the import above: the real transport and the real websockets.connect are intact
    import websockets

    assert httpx.HTTPTransport.handle_request.__module__.startswith("httpx")
    assert not getattr(websockets.connect, "__module__", "").startswith("media_fake_ha")
    monkeypatch.setenv("SUPERVISOR_TOKEN", "x")
    with pytest.raises(SystemExit):
        fx.install()


def test_world_counts_and_identity(world):
    assert world["expect"] == {"screens": 7, "entities": 19, "devices": 15}
    ids = [e["entity_id"] for e in world["entities"]]
    assert len(ids) == len(set(ids)) == 19
    assert len({e["id"] for e in world["entities"]}) == 19  # registry ids are unique
    assert len({d["id"] for d in world["devices"]}) == 15
    dev_ids = {d["id"] for d in world["devices"]}
    areas = {a["area_id"] for a in world["areas"]}
    floors = {f["floor_id"] for f in world["floors"]}
    assert all(e["device_id"] in dev_ids for e in world["entities"])
    assert all(d["area_id"] is None or d["area_id"] in areas for d in world["devices"])
    assert all(a["floor_id"] in floors for a in world["areas"])
    for e in world["entities"]:
        assert re.fullmatch(r"[a-z_]+\.[a-z0-9_]+", e["entity_id"])  # the dev states route's pattern
        assert e["entity_id"].split(".", 1)[1].startswith("cr015_")
    for key, s in world["screens"].items():
        assert s["vendor"] in ids and (s["remote"] is None or s["remote"] in ids) and all(d in ids for d in s["duplicates"]), key
        assert s["area_id"] in areas and s["floor_id"] in floors
    assert sum(1 for s in world["screens"].values() if s.get("stuck")) == 1
    assert [k for k, s in world["screens"].items() if s.get("stuck")] == ["lounge"]
    assert all("_stuck" in e for e in (world["screens"]["lounge"]["vendor"], world["screens"]["lounge"]["remote"]))
    assert sum("_stuck" in i for i in ids) == 2  # only the lounge TV's own two entities


def test_everything_is_synthetic(world):
    blob = json.dumps(world, ensure_ascii=False)
    macs = set(re.findall(r"(?i)\b(?:[0-9a-f]{2}:){5}[0-9a-f]{2}\b", blob))
    assert macs and all(m.lower().replace("-", ":").startswith("02:00:00:c0:15:") for m in macs)  # locally administered, obviously fake
    ips = set(re.findall(r"\b\d{1,3}(?:\.\d{1,3}){3}\b", blob))
    assert ips and all(i.startswith("192.0.2.") for i in ips)  # RFC 5737 documentation range
    uuids = set(re.findall(r"(?i)[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}", blob))
    assert uuids and all(u.lower().startswith("00000000-0000-4000-8000-") for u in uuids)
    assert "Bearer" not in blob and "password" not in blob.lower()


def test_private_attributes_are_present_in_the_model_so_the_backend_must_drop_them(world):
    attrs = {e["entity_id"]: e["attributes"] for e in world["entities"]}
    assert attrs["media_player.cr015_living_tv"]["ip_address"].startswith("192.0.2.")
    assert "token=" in attrs["media_player.cr015_living_tv_cast"]["entity_picture"]
    assert attrs["remote.cr015_office_tv"]["activity_list"]


# ------------------------------------------------------------------------------------------------ an independent dedupe ladder


def _norm_mac(v: str) -> str:
    return re.sub(r"[^0-9a-f]", "", v.lower())


def _norm_id(v: str) -> str:
    return v.lower().removeprefix("uuid:").replace("-", "")


def ladder(world):
    """CR section 3.3 rungs 1-4 + the same-platform guard, over media_player / remote entities. Returns clusters as frozensets
    of entity ids. (Rungs 5-6 never merge automatically / are manual.)"""
    eps = [e for e in world["entities"] if e["entity_id"].split(".", 1)[0] in ("media_player", "remote")]
    parent = {e["entity_id"]: e["entity_id"] for e in eps}
    by_id = {e["entity_id"]: e for e in eps}
    dev = {d["id"]: d for d in world["devices"]}

    def find(x):
        while parent[x] != x:
            parent[x] = parent[parent[x]]
            x = parent[x]
        return x

    def union(a, b):
        parent[find(a)] = find(b)

    # rung 1: same device
    for a in eps:
        for b in eps:
            if a["device_id"] == b["device_id"]:
                union(a["entity_id"], b["entity_id"])
    # rung 2: a Music Assistant export whose unique id / device identifier is the player id (an HA entity id)
    for a in eps:
        if a["platform"] != "music_assistant":
            continue
        player = a["unique_id"]
        ident = [i for i in dev[a["device_id"]]["identifiers"] if i[0] == "music_assistant"]
        if player in by_id and ident and ident[0][1] == player:
            union(a["entity_id"], player)
    # rungs 3 and 4 across devices (strong): never two endpoints of the same platform on different devices
    def cross(a, b):
        return a["device_id"] != b["device_id"] and a["platform"] != b["platform"]

    for a in eps:
        for b in eps:
            if not cross(a, b) or a["platform"] == "music_assistant" or b["platform"] == "music_assistant":
                continue
            da, db = dev[a["device_id"]], dev[b["device_id"]]
            macs_a, macs_b = {_norm_mac(c[1]) for c in da["connections"] if c[0] == "mac"}, {_norm_mac(c[1]) for c in db["connections"] if c[0] == "mac"}
            ids_a, ids_b = {_norm_id(i[1]) for i in da["identifiers"]}, {_norm_id(i[1]) for i in db["identifiers"]}
            if (macs_a & macs_b) or (ids_a & ids_b):
                union(a["entity_id"], b["entity_id"])
    clusters: dict[str, set[str]] = {}
    for eid in parent:
        clusters.setdefault(find(eid), set()).add(eid)
    return {frozenset(c) for c in clusters.values()}


def test_ladder_resolves_the_house_to_the_intended_physical_devices(world):
    clusters = ladder(world)
    s = world["screens"]
    expected = {
        frozenset({s["living"]["vendor"], s["living"]["remote"], *s["living"]["duplicates"]}),
        frozenset({s["kitchen"]["vendor"], s["kitchen"]["remote"]}),
        frozenset({s["bedroom"]["vendor"]}),
        frozenset({s["hall"]["vendor"]}),
        frozenset({s["office"]["vendor"], s["office"]["remote"], *s["office"]["duplicates"]}),
        frozenset({s["lobby"]["vendor"]}),
        frozenset({s["lounge"]["vendor"], s["lounge"]["remote"]}),
        frozenset({world["receivers"]["avr_living"]["vendor"], *world["receivers"]["avr_living"]["duplicates"]}),
        frozenset({world["speakers"]["kitchen"]["entity"]}),
    }
    assert clusters == expected
    assert len(clusters) == 9  # 7 screens + 1 receiver + 1 speaker


def test_each_rung_is_exercised_by_a_different_duplicate(world):
    by = {e["entity_id"]: e for e in world["entities"]}
    dev = {d["id"]: d for d in world["devices"]}
    vendor_dev = dev[by["media_player.cr015_living_tv"]["device_id"]]
    vmac = {_norm_mac(c[1]) for c in vendor_dev["connections"]}
    mac = lambda eid: {_norm_mac(c[1]) for c in dev[by[eid]["device_id"]]["connections"]}  # noqa: E731
    assert mac("media_player.cr015_living_tv_st") & vmac and mac("media_player.cr015_living_tv_dlna") & vmac  # rung 3
    raw = lambda eid: {c[1] for c in dev[by[eid]["device_id"]]["connections"]}  # noqa: E731
    assert raw("media_player.cr015_living_tv_st") == {"02-00-00-C0-15-01"} and raw("media_player.cr015_living_tv_dlna") == {"02:00:00:c0:15:01"}  # written differently: the backend must normalise
    cast = dev[by["media_player.cr015_living_tv_cast"]["device_id"]]
    assert not cast["connections"]  # rung 4 only: no MAC ...
    cast_id, vendor_id = cast["identifiers"][0][1], vendor_dev["identifiers"][0][1]
    assert cast_id != vendor_id and _norm_id(cast_id) == _norm_id(vendor_id)  # ... equal UUID written differently
    ma = by["media_player.cr015_living_tv_ma"]
    assert ma["unique_id"] == "media_player.cr015_living_tv" and dev[ma["device_id"]]["identifiers"] == [["music_assistant", "media_player.cr015_living_tv"]]  # rung 2
    assert not dev[ma["device_id"]]["connections"]  # MA sets no MAC (MA notes 1.5)


def test_two_samsungs_share_nothing_and_are_not_merged(world):
    by = {e["entity_id"]: e for e in world["entities"]}
    dev = {d["id"]: d for d in world["devices"]}
    a, b = by["media_player.cr015_living_tv"], by["media_player.cr015_kitchen_tv"]
    assert a["platform"] == b["platform"] == "samsungtv_smart" and a["device_id"] != b["device_id"]
    da, db = dev[a["device_id"]], dev[b["device_id"]]
    assert da["model"] == db["model"] and da["manufacturer"] == db["manufacturer"]
    assert not ({c[1] for c in da["connections"]} & {c[1] for c in db["connections"]})
    assert not ({_norm_id(i[1]) for i in da["identifiers"]} & {_norm_id(i[1]) for i in db["identifiers"]})


# ------------------------------------------------------------------------------------------------ the integrations' shapes


def feat(world, eid):
    return next(e for e in world["entities"] if e["entity_id"] == eid)["attributes"]["supported_features"]


def test_feature_bits_follow_the_research_notes(world):
    hall, bed = feat(world, "media_player.cr015_hall_tv"), feat(world, "media_player.cr015_bedroom_tv")
    assert not hall & fx.TURN_ON and not hall & fx.VOLUME_SET and hall & fx.VOLUME_STEP and hall & fx.SELECT_SOURCE  # LG: no wake automation, external speaker
    assert bed & fx.TURN_ON and bed & fx.VOLUME_SET and bed & fx.TURN_OFF
    android = feat(world, "media_player.cr015_office_tv")
    assert not android & fx.VOLUME_SET and not android & fx.SELECT_SOURCE and android & fx.VOLUME_STEP and android & fx.TURN_ON
    ssv = feat(world, "media_player.cr015_living_tv")
    assert ssv & fx.VOLUME_SET and ssv & fx.SELECT_SOURCE and ssv & fx.PLAY_MEDIA
    cast = feat(world, "media_player.cr015_office_tv_cast")
    assert cast & fx.SEEK and cast & fx.VOLUME_SET
    attrs = {e["entity_id"]: e["attributes"] for e in world["entities"]}
    assert attrs["media_player.cr015_hall_tv"]["sound_output"].startswith("external")
    assert attrs["media_player.cr015_bedroom_tv"]["sound_output"] == "tv_speaker"
    assert attrs["remote.cr015_office_tv"]["current_activity"] in attrs["remote.cr015_office_tv"]["activity_list"]
    assert attrs["media_player.cr015_living_tv"]["source"] in attrs["media_player.cr015_living_tv"]["source_list"]


# ------------------------------------------------------------------------------------------------ the key tables


def test_key_tables_exact_codes_and_no_power_key():
    s, lg, a = fx.SAMSUNG_KEYS, fx.LG_KEYS, fx.ANDROID_KEYS
    assert (s["ok"], s["back"], s["home"], s["menu"], s["volup"], s["chup"], s["n5"], s["red"], s["play"], s["rew"]) == ("KEY_ENTER", "KEY_RETURN", "KEY_HOME", "KEY_MENU", "KEY_VOLUP", "KEY_CHUP", "KEY_5", "KEY_RED", "KEY_PLAY", "KEY_REWIND")
    assert (lg["ok"], lg["back"], lg["volup"], lg["chup"], lg["n5"], lg["blue"], lg["play"]) == ("ENTER", "BACK", "VOLUMEUP", "CHANNELUP", "5", "BLUE", "PLAY")
    assert (a["ok"], a["up"], a["volup"], a["chup"], a["n5"], a["red"], a["play"], a["source"]) == ("DPAD_CENTER", "DPAD_UP", "VOLUME_UP", "CHANNEL_UP", "5", "PROG_RED", "MEDIA_PLAY", "TV_INPUT")
    assert "blue" not in s and "rew" not in lg and "ff" not in lg  # UNVERIFIED keys stay off (CR section 4)
    for table in (s, lg, a):
        assert not any(fx.POWER_CODE.search(v) for v in table.values())
        assert all(k in ("up", "down", "left", "right", "ok", "back", "home", "menu", "exit", "info", "guide", "source", "tools", "settings", "chlist", "prech", "volup", "voldown", "mute", "chup", "chdown",
                         "red", "green", "yellow", "blue", "play", "pause", "stop", "rew", "ff") or re.fullmatch(r"n[0-9]", k) for k in table)
    assert all(re.fullmatch(r"KEY_[A-Z0-9_]{1,24}", v) for v in s.values())


# ------------------------------------------------------------------------------------------------ the bridge allow-list reader


def test_parse_allowed_reads_the_real_bridge_and_groups():
    allowed = fx.parse_allowed(fx.BRIDGE_INIT.read_text(encoding="utf-8"))
    assert ("media_player", "turn_on") in allowed and ("light", "turn_on") in allowed
    assert ("alarm_control_panel", "alarm_trigger") not in allowed
    src = 'BASE = {("a", "x"), ("b", "y")}\nMEDIA = frozenset({("media_player", "select_source")})\nALLOWED_SERVICES = BASE | MEDIA | {("remote", "send_command")}\nOTHER = compute()\n'
    assert fx.parse_allowed(src) == {("a", "x"), ("b", "y"), ("media_player", "select_source"), ("remote", "send_command")}
    assert fx.parse_allowed('ALLOWED_SERVICES: set = {("a", "x")}') == {("a", "x")}
    with pytest.raises(SystemExit):
        fx.parse_allowed("X = 1")


# ------------------------------------------------------------------------------------------------ the fake bridge


def test_drift_the_bridge_without_media_services_refuses_them(monkeypatch, world):
    monkeypatch.setattr(fx.MODEL, "allowed", fx.parse_allowed('ALLOWED_SERVICES = {("media_player", "turn_on")}'))
    fx.MODEL.load(world)
    assert call("media_player", "select_source", entity_id="media_player.cr015_living_tv", source="HDMI 1") == {"ok": False, "error": "service_not_allowed"}
    assert last()["result"] == "service_not_allowed" and last()["effect"] is False


def test_keys_are_logged_with_their_exact_codes(bridge):
    assert call("media_player", "play_media", entity_id="media_player.cr015_living_tv", media_content_type="send_key", media_content_id="KEY_ENTER")["ok"]
    assert (last()["kind"], last()["code"], last()["effect"]) == ("key", "KEY_ENTER", False)
    assert call("webostv", "button", entity_id="media_player.cr015_bedroom_tv", button="VOLUMEUP")["ok"] and last()["code"] == "VOLUMEUP"
    assert call("remote", "send_command", entity_id="remote.cr015_office_tv", command="DPAD_CENTER")["ok"] and last()["code"] == "DPAD_CENTER"
    assert call("remote", "send_command", entity_id="remote.cr015_office_tv", command="text:שלום")["ok"]
    assert (last()["kind"], last()["text"]) == ("text", "שלום")
    assert call("media_player", "play_media", entity_id="media_player.cr015_living_tv", media_content_type="send_text", media_content_id="abc")["ok"] and last()["text"] == "abc"
    assert bridge == []  # nothing observable: no state was pushed


@pytest.mark.parametrize("call_args", [
    ("media_player", "play_media", dict(entity_id="media_player.cr015_living_tv", media_content_type="send_key", media_content_id="KEY_POWER")),
    ("media_player", "play_media", dict(entity_id="media_player.cr015_living_tv", media_content_type="send_key", media_content_id="KEY_POWEROFF")),
    ("webostv", "button", dict(entity_id="media_player.cr015_bedroom_tv", button="POWER")),
    ("remote", "send_command", dict(entity_id="remote.cr015_office_tv", command="POWER")),
    ("remote", "send_command", dict(entity_id="remote.cr015_office_tv", command="KEYCODE_POWER")),
])
def test_no_power_key_passes_in_any_transport(bridge, call_args):
    domain, service, data = call_args
    res = call(domain, service, **data)
    assert res["ok"] is False and res["error"] == "media_power_key" and last()["effect"] is False


def test_policy_refusals(bridge):
    living = "media_player.cr015_living_tv"
    cases = [
        (("media_player", "play_media", dict(entity_id=living, media_content_type="send_key", media_content_id="KEY_CYAN")), "media_key_not_allowed"),  # Samsung blue is UNVERIFIED
        (("media_player", "play_media", dict(entity_id=living, media_content_type="send_key", media_content_id="key_enter")), "media_key_invalid"),
        (("media_player", "play_media", dict(entity_id=living, media_content_type="channel", media_content_id="7")), "media_type_not_allowed"),
        (("media_player", "play_media", dict(entity_id=living, media_content_type="send_text", media_content_id="x" * 201)), "media_text_invalid"),
        (("media_player", "play_media", dict(entity_id=living, media_content_type="send_text", media_content_id="a\x07b")), "media_text_invalid"),
        (("webostv", "button", dict(entity_id="media_player.cr015_bedroom_tv", button="NETFLIX")), "media_key_not_allowed"),
        (("webostv", "button", dict(entity_id=living, button="UP")), "media_key_not_allowed"),  # an LG code sent to a Samsung
        (("remote", "send_command", dict(entity_id="remote.cr015_office_tv", command="KEY_ENTER")), "media_key_not_allowed"),
        (("remote", "turn_on", dict(entity_id="remote.cr015_office_tv")), "media_activity_required"),
        (("remote", "turn_on", dict(entity_id="remote.cr015_office_tv", activity="https://example.invalid")), "media_activity_unknown"),
        (("media_player", "select_source", dict(entity_id=living, source="HDMI 9")), "media_source_unknown"),
    ]
    for (domain, service, data), code in cases:
        assert call(domain, service, **data) == {"ok": False, "error": code}, (service, data)
    assert bridge == []


def test_a_service_outside_the_allow_list_and_a_missing_entity(bridge):
    assert call("light", "turn_off", entity_id="light.x") == {"ok": False, "error": "service_not_allowed"}
    assert call("media_player", "turn_on") == {"ok": False, "error": "entity_required"}
    assert call("media_player", "turn_on", entity_id="media_player.cr015_nope") == {"ok": False, "error": "entity_not_found"}


def test_power_effects_and_confirmation_shapes(bridge):
    tv = "media_player.cr015_bedroom_tv"
    assert call("media_player", "turn_off", entity_id=tv)["ok"]
    settle()
    assert last()["effect"] is True and fx.MODEL.payload(tv)["state"] == "off" and bridge[-1] == [tv]
    assert call("media_player", "turn_on", entity_id=tv)["ok"]
    settle()
    assert fx.MODEL.payload(tv)["state"] == "on"


def test_unsupported_services_fail_like_home_assistant(bridge):
    hall = "media_player.cr015_hall_tv"
    assert call("media_player", "turn_on", entity_id=hall) == {"ok": False, "error": "HomeAssistantError"}  # LG without a turn-on automation
    assert call("media_player", "volume_set", entity_id=hall, volume_level=0.3) == {"ok": False, "error": "HomeAssistantError"}  # external speaker
    assert call("media_player", "volume_set", entity_id="media_player.cr015_office_tv", volume_level=0.3) == {"ok": False, "error": "HomeAssistantError"}  # Android: no VOLUME_SET
    assert call("media_player", "select_source", entity_id="media_player.cr015_office_tv", source="HDMI 1")["error"] == "media_source_unknown"
    assert call("media_player", "volume_up", entity_id=hall)["ok"]  # LG steps
    settle()
    assert fx.MODEL.payload(hall)["attributes"]["volume_level"] == 0.52


def test_sound_output_toggles_volume_set_like_an_lg(bridge):
    tv = "media_player.cr015_bedroom_tv"
    assert call("webostv", "select_sound_output", entity_id=tv, sound_output="external_arc")["ok"]
    settle()
    p = fx.MODEL.payload(tv)["attributes"]
    assert p["sound_output"] == "external_arc" and not p["supported_features"] & fx.VOLUME_SET
    assert call("webostv", "select_sound_output", entity_id=tv, sound_output="tv_speaker")["ok"]
    settle()
    assert fx.MODEL.payload(tv)["attributes"]["supported_features"] & fx.VOLUME_SET


def test_source_app_and_activity_effects(bridge):
    living, office_remote, office = "media_player.cr015_living_tv", "remote.cr015_office_tv", "media_player.cr015_office_tv"
    assert call("media_player", "select_source", entity_id=living, source="YouTube")["ok"]
    assert call("remote", "turn_on", entity_id=office_remote, activity="netflix://")["ok"]
    settle()
    assert fx.MODEL.payload(living)["attributes"]["source"] == "YouTube" and fx.MODEL.payload(living)["attributes"]["app_id"].startswith("synthetic.")
    assert fx.MODEL.payload(office_remote)["attributes"]["current_activity"] == "netflix://"
    assert fx.MODEL.payload(office)["attributes"]["app_id"] == "netflix://"  # the sibling media_player follows
    assert sorted(bridge[-1]) == sorted([office_remote, office]) or bridge[-1] == [office_remote, office]


def test_transport_volume_and_mute(bridge):
    cast = "media_player.cr015_office_tv_cast"
    assert call("media_player", "media_pause", entity_id=cast)["ok"]
    settle()
    assert fx.MODEL.payload(cast)["state"] == "paused"
    assert call("media_player", "media_play_pause", entity_id=cast)["ok"]
    settle()
    assert fx.MODEL.payload(cast)["state"] == "playing"
    assert call("media_player", "volume_mute", entity_id=cast, is_volume_muted=True)["ok"]
    assert call("media_player", "volume_set", entity_id=cast, volume_level=0.75)["ok"] and last()["volume_level"] == 0.75
    settle()
    a = fx.MODEL.payload(cast)["attributes"]
    assert a["is_volume_muted"] is True and a["volume_level"] == 0.75


def test_a_stuck_tv_accepts_and_reports_nothing(bridge):
    stuck = "media_player.cr015_lounge_stuck"
    assert call("media_player", "turn_off", entity_id=stuck) == {"ok": True, "context_id": "fake-context"}
    assert (last()["result"], last()["effect"]) == ("ok", False)
    time.sleep(0.05)
    assert fx.MODEL.payload(stuck)["state"] == "on" and bridge == []
    # ... but the policy still applies to it (a stuck TV is not a hole in the bridge)
    assert call("media_player", "play_media", entity_id=stuck, media_content_type="send_key", media_content_id="KEY_POWER")["error"] == "media_power_key"
    assert call("media_player", "play_media", entity_id=stuck, media_content_type="send_key", media_content_id="KEY_ENTER")["ok"] and last()["code"] == "KEY_ENTER"


def test_unavailable_entities_refuse_and_report_only_capability_attributes(bridge):
    hall = "media_player.cr015_hall_tv"
    fx.MODEL.ents[hall]["state"] = "unavailable"
    p = fx.MODEL.payload(hall)
    assert p["state"] == "unavailable" and set(p["attributes"]) == {"friendly_name", "device_class", "supported_features"}
    assert call("media_player", "volume_up", entity_id=hall) == {"ok": False, "error": "HomeAssistantError"}
    fx.MODEL.ents[hall]["state"] = "on"
    assert "source_list" in fx.MODEL.payload(hall)["attributes"]  # back again: the full set


def test_refuse_mode_answers_everything_with_its_code(bridge):
    fx.MODEL.refuse = "unauthorized"
    assert call("media_player", "turn_off", entity_id="media_player.cr015_bedroom_tv") == {"ok": False, "error": "unauthorized"}
    assert last()["result"] == "unauthorized"


def test_payload_hides_nothing_the_backend_must_drop_and_drops_none_values(bridge):
    p = fx.MODEL.payload("media_player.cr015_living_tv")["attributes"]
    assert p["ip_address"].startswith("192.0.2.") and "app_id" in p  # Netflix: has an app id
    k = fx.MODEL.payload("media_player.cr015_kitchen_tv")["attributes"]
    assert "app_id" not in k and "media_content_type" not in k  # None values are not sent (the dev route would keep a null)


# ------------------------------------------------------------------------------------------------ the control server against a stub add-on


class _Stub(BaseHTTPRequestHandler):
    seen: list[tuple[str, dict]] = []

    def log_message(self, *_a):
        return

    def do_POST(self):  # noqa: N802
        body = json.loads(self.rfile.read(int(self.headers.get("Content-Length") or 0)) or b"{}")
        type(self).seen.append((self.path, body))
        raw = b"{}"
        self.send_response(200)
        self.send_header("Content-Length", str(len(raw)))
        self.end_headers()
        self.wfile.write(raw)


@pytest.fixture()
def control(monkeypatch, bridge):
    stub = ThreadingHTTPServer(("127.0.0.1", 0), _Stub)
    _Stub.seen = []
    threading.Thread(target=stub.serve_forever, daemon=True).start()
    monkeypatch.setattr(fx, "BASE", f"http://127.0.0.1:{stub.server_address[1]}/api/v1")
    srv = ThreadingHTTPServer(("127.0.0.1", 0), fx._Control)
    threading.Thread(target=srv.serve_forever, daemon=True).start()
    base = f"http://127.0.0.1:{srv.server_address[1]}"
    yield base
    srv.shutdown()
    stub.shutdown()


def test_control_seed_log_set_and_config(control):
    r = httpx.post(f"{control}/seed-media", json={}).json()
    assert r["registry_ok"] and r["states_ok"] and r["expect"]["screens"] == 7 and r["keys"]["lg_webos"]["ok"] == "ENTER"
    paths = [p for p, _b in _Stub.seen]
    assert paths[0].endswith("/ha/dev/registry") and all(p.endswith("/ha/dev/states") for p in paths[1:])
    body = _Stub.seen[0][1]
    assert len(body["entities"]) == 19 and len(body["devices"]) == 15 and len(body["areas"]) == 7 and len(body["floors"]) == 2
    assert all("state" not in e and "attributes" not in e for e in body["entities"])  # the registry rows carry no states
    posted_states = [s for p, b in _Stub.seen if p.endswith("/ha/dev/states") for s in b["states"]]
    assert len(posted_states) == 19 and all(len(s["entity_id"]) and "state" in s for s in posted_states)
    assert httpx.get(f"{control}/world").json()["screens"]["hall"]["turn_on"] is False
    # the log
    call("media_player", "play_media", entity_id="media_player.cr015_living_tv", media_content_type="send_key", media_content_id="KEY_UP")
    call("media_player", "play_media", entity_id="media_player.cr015_living_tv", media_content_type="send_key", media_content_id="KEY_DOWN")
    log = httpx.get(f"{control}/media-log").json()
    assert [e["code"] for e in log["entries"]] == ["KEY_UP", "KEY_DOWN"] and log["pending"] == 0
    assert [e["code"] for e in httpx.get(f"{control}/media-log", params={"since": log["entries"][0]["n"]}).json()["entries"]] == ["KEY_DOWN"]
    assert httpx.post(f"{control}/media-log/reset", json={}).json()["ok"] and httpx.get(f"{control}/media-log").json()["entries"] == []
    # a device changes on its own
    _Stub.seen.clear()
    r = httpx.post(f"{control}/media-set", json={"entity_id": "media_player.cr015_office_tv", "state": "off"}).json()
    assert r == {"ok": True, "state": "off"} and _Stub.seen[0][1]["states"][0]["state"] == "off"
    r = httpx.post(f"{control}/media-set", json={"entity_id": "media_player.cr015_hall_tv", "state": "unavailable"}).json()
    assert set(_Stub.seen[-1][1]["states"][0]["attributes"]) == {"friendly_name", "device_class", "supported_features"}
    assert httpx.post(f"{control}/media-set", json={"entity_id": "media_player.nope"}).status_code == 404
    # config
    cfg = httpx.post(f"{control}/media-config", json={"effect_delay": 1.5, "refuse": "unauthorized"}).json()
    assert cfg["effect_delay"] == 1.5 and cfg["refuse"] == "unauthorized" and cfg["ping"] is None
    assert httpx.post(f"{control}/media-config", json={"refuse": None}).json()["refuse"] is None
    assert httpx.get(f"{control}/status").json()["entities"] == 19
    assert httpx.post(f"{control}/nope", json={}).status_code == 404


def test_artwork_bytes_are_an_image():
    raw, ctype = fx.artwork_bytes("media_player.cr015_office_tv_cast")
    assert ctype in ("image/jpeg", "image/png") and len(raw) > 50


# ================================================================================================ CR-016 (S4): the two audio houses
#
# frontend/tests/fixtures/media_fake_ha.py grew two more houses (the Music Assistant house of probes H + V, the no-MA house of probe K),
# a fake bridge media_query and the bridge 0.5.0 services. Everything below runs without a backend: the add-on side is a stub.

HOUSES = ("ma", "sonos")
BRIDGE_050 = {("media_player", s) for s in ("media_seek", "shuffle_set", "repeat_set", "join", "unjoin", "select_sound_mode")} | {("music_assistant", "play_media"), ("music_assistant", "transfer_queue")}
NO_ID_LEAK = re.compile(r"192\.0\.2\.|imageproxy|library://|\.invalid|provider_mappings|queue_item_id|stream_details|spotify--|cr016_(?:dev|reg|ce)_")
NON_PHYSICAL = fx.NON_PHYSICAL_PLATFORMS


@pytest.fixture(params=HOUSES)
def house(request):
    return request.param, fx.build_world(request.param)


def audio_bridge(monkeypatch, house_name):
    """The fake bridge over an audio house with the bridge 0.5.0 allow-list; effects are applied at once into a recorder."""
    pushed: list[list[str]] = []
    world = fx.build_world(house_name)
    monkeypatch.setattr(fx, "_push", lambda ids: (pushed.append(list(ids)), _done()))
    monkeypatch.setattr(fx.MODEL, "effect_delay", 0.0)
    monkeypatch.setattr(fx.MODEL, "allowed", MEDIA_ALLOWED | BRIDGE_050)
    monkeypatch.setattr(fx.MODEL, "refuse", None)
    monkeypatch.setattr(fx.MODEL, "bridge_version", "0.5.0")
    fx.MODEL.pending = 0
    fx.MODEL.load(world)
    return world, pushed


@pytest.fixture()
def ma(monkeypatch):
    return audio_bridge(monkeypatch, "ma")


@pytest.fixture()
def sonos(monkeypatch):
    return audio_bridge(monkeypatch, "sonos")


def attrs_of(world, eid):
    return next(e for e in world["entities"] if e["entity_id"] == eid)["attributes"]


def live(eid):
    return fx.MODEL.ents[eid]["attrs"]


# ---------------------------------------------------------------- the registries and the declared expectations


def test_audio_houses_counts(house):
    name, w = house
    expected = {
        "ma": {"entities": 35, "enabled": 35, "devices": 33, "players": 16, "clusters": 19, "suggestions": 4, "unplaced": 9, "floors": 2, "areas": 6},
        "sonos": {"entities": 34, "enabled": 31, "devices": 31, "players": 8, "clusters": 27, "suggestions": 5, "unplaced": 1, "floors": 0, "areas": 7},
    }[name]
    assert {k: w["expect"][k] for k in expected} == expected
    assert w["house"] == name


def test_audio_houses_registry_is_consistent(house):
    name, w = house
    ids = [e["entity_id"] for e in w["entities"]]
    assert len(ids) == len(set(ids)) and len({e["id"] for e in w["entities"]}) == len(ids)
    dev_ids = {d["id"] for d in w["devices"]}
    areas, floors = {a["area_id"] for a in w["areas"]}, {f["floor_id"] for f in w["floors"]}
    assert len(dev_ids) == len(w["devices"])
    assert all(e["device_id"] is None or e["device_id"] in dev_ids for e in w["entities"])
    assert all(d["area_id"] is None or d["area_id"] in areas for d in w["devices"])
    assert all(a["floor_id"] is None or a["floor_id"] in floors for a in w["areas"])
    for e in w["entities"]:
        assert re.fullmatch(r"[a-z_]+\.[a-z0-9_]+", e["entity_id"]) and e["entity_id"].split(".", 1)[1].startswith("cr016_")  # the dev states route's pattern
    # every entity the expectations name exists
    allowed = set(ids)
    for p in w["players"].values():
        assert set(p["entities"]) <= allowed and set(p.get("hidden", [])) <= allowed and set(p.get("zones", [])) <= allowed
    for s in w["suggestions"]:
        assert set(s["a"]) | set(s["b"]) <= allowed
    assert {e for c in w["clusters"] for e in c} == {e["entity_id"] for e in w["entities"] if not e["disabled_by"] and e["entity_id"].split(".", 1)[0] in ("media_player", "remote")}
    assert sum(len(c) for c in w["clusters"]) == len({e for c in w["clusters"] for e in c})  # a cluster partition: no entity twice


def test_audio_houses_are_synthetic(house):
    _name, w = house
    blob = json.dumps({k: w[k] for k in ("devices", "entities", "areas", "floors", "players", "model")}, ensure_ascii=False)
    macs = set(re.findall(r"(?i)\b(?:[0-9a-f]{2}:){5}[0-9a-f]{2}\b", blob))
    assert all(m.lower().startswith("02:00:00:c0:15:") for m in macs)
    ips = set(re.findall(r"\b\d{1,3}(?:\.\d{1,3}){3}\b", blob))
    assert all(i.startswith("192.0.2.") for i in ips)  # RFC 5737
    uuids = set(re.findall(r"(?i)[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}", blob))
    assert all(u.lower().startswith("00000000-0000-4000-8000-c016") for u in uuids)
    assert "Bearer" not in blob and "password" not in blob.lower() and "token=" not in blob.replace("token=SYNTHETIC", "")


def test_model_number_names_normalise_to_nothing():
    w = fx.build_world("ma")
    names = {e["entity_id"]: e["attributes"]["friendly_name"] for e in w["entities"]}
    for n in ("1", "2", "3"):
        assert _norm_name(names[f"media_player.cr016_tv{n}_cast"]) == "" and _norm_name(names[f"media_player.cr016_tv{n}_ma"]) == ""
    assert _norm_name("רמקול סלון") == "רמקול סלון" and _norm_name("WiiM Amp-4F2A") == "amp"


# ---------------------------------------------------------------- an independent ladder for the audio houses (CR-016 5.1: rungs 1-4, 2b, 2c, 3b, 5, 5b)


BRANDS = {"samsung", "lg", "sonos", "wiim", "denon", "cast", "google", "synth", "spotify", "jellyfin"}


def _norm_name(n: str) -> str:
    toks = [t for t in re.findall(r"[^\W_]+", n.lower()) if t not in BRANDS and not re.search(r"\d", t)]  # a model number normalises to nothing
    return " ".join(toks)


def ladder2(world):
    """(clusters as frozensets, suggestions as {(rule, frozenset({clusterA, clusterB}))}) of an audio house - an INDEPENDENT implementation."""
    eps = [e for e in world["entities"] if e["entity_id"].split(".", 1)[0] in ("media_player", "remote") and not e.get("disabled_by")]
    dev = {d["id"]: d for d in world["devices"]}
    parent = {e["entity_id"]: e["entity_id"] for e in eps}

    def find(x):
        while parent[x] != x:
            parent[x] = parent[parent[x]]
            x = parent[x]
        return x

    def union(a, b):
        parent[find(a)] = find(b)

    for a in eps:  # rung 1: the same HA device
        for b in eps:
            if a["device_id"] and a["device_id"] == b["device_id"]:
                union(a["entity_id"], b["entity_id"])
    for a in eps:  # rungs 2b / 2c: an MA player id that EQUALS / EMBEDS another platform's identifier
        if a["platform"] != "music_assistant":
            continue
        pid = a["unique_id"]
        stripped = re.sub(r"^[a-z]+_", "", pid, count=1)
        for b in eps:
            if b["platform"] == "music_assistant" or not b["device_id"]:
                continue
            for _dom, vid in dev[b["device_id"]]["identifiers"]:
                if len(vid) >= 8 and (pid == vid or stripped == vid or vid in stripped):
                    union(a["entity_id"], b["entity_id"])
    for a in eps:  # rungs 3 / 4: a shared MAC or identifier between two platforms
        for b in eps:
            if not a["device_id"] or not b["device_id"] or a["device_id"] == b["device_id"] or a["platform"] == b["platform"] or "music_assistant" in (a["platform"], b["platform"]):
                continue
            da, db = dev[a["device_id"]], dev[b["device_id"]]
            if ({_norm_mac(c[1]) for c in da["connections"]} & {_norm_mac(c[1]) for c in db["connections"]}) or ({_norm_id(i[1]) for i in da["identifiers"]} & {_norm_id(i[1]) for i in db["identifiers"]}):
                union(a["entity_id"], b["entity_id"])

    def groups():
        out: dict[str, set[str]] = {}
        for e in parent:
            out.setdefault(find(e), set()).add(e)
        return list(out.values())

    by_id = {e["entity_id"]: e for e in eps}

    def info(cluster):
        plats = {by_id[e]["platform"] for e in cluster}
        models = [(dev[by_id[e]["device_id"]]["manufacturer"], dev[by_id[e]["device_id"]]["model"], by_id[e]["platform"]) for e in cluster
                  if by_id[e]["device_id"] and dev[by_id[e]["device_id"]]["manufacturer"] and dev[by_id[e]["device_id"]]["model"]]
        return plats, {(m.lower(), mo.lower(), p) for m, mo, p in models}

    def compat(x, y):
        px, mx = info(x)
        py, my = info(y)
        if px & py or (px | py) & NON_PHYSICAL or not mx or not my:
            return False
        for (m_a, mo_a, pa) in mx:
            for (m_b, mo_b, pb) in my:
                if m_a != m_b:
                    continue
                if mo_a == mo_b or (pa == "cast" and mo_b.startswith(mo_a)) or (pb == "cast" and mo_a.startswith(mo_b)):
                    return True
        return False

    suggestions: set[tuple[str, frozenset]] = set()
    cl = [frozenset(c) for c in groups()]
    adj = {c: [d for d in cl if d != c and compat(c, d)] for c in cl}  # rung 3b: manufacturer + model - a unique pair merges, an ambiguous set only suggests
    seen: set[frozenset] = set()
    for c in cl:
        if c in seen or not adj[c]:
            continue
        comp, stack = {c}, [c]
        while stack:
            for d in adj[stack.pop()]:
                if d not in comp:
                    comp.add(d)
                    stack.append(d)
        seen |= comp
        if len(comp) == 2:
            x, y = sorted(comp, key=min)
            union(next(iter(x)), next(iter(y)))
        else:
            for x in comp:
                for y in adj[x]:
                    if min(x) < min(y):
                        suggestions.add(("3b", frozenset({x, y})))
    done = {(frozenset(c)) for c in groups()}
    cl = list(done)

    def names(c):
        return {_norm_name(dev[by_id[e]["device_id"]]["name"]) for e in c if by_id[e]["device_id"]} - {""}

    def area(c):
        return next((dev[by_id[e]["device_id"]]["area_id"] for e in c if by_id[e]["device_id"] and dev[by_id[e]["device_id"]]["area_id"]), None)

    old_pairs = {pair for _r, pair in suggestions}
    for i, x in enumerate(cl):  # rungs 5 / 5b: an equal normalised name (never empty), an area on at least one side
        for y in cl[i + 1:]:
            px, py = info(x)[0], info(y)[0]
            if px & py or (px | py) & NON_PHYSICAL or not (names(x) & names(y)) or frozenset({x, y}) in old_pairs:
                continue
            ax, ay = area(x), area(y)
            if ax and ay and ax == ay:
                suggestions.add(("5", frozenset({x, y})))
            elif (ax or ay) and not (ax and ay):
                suggestions.add(("5b", frozenset({x, y})))
    return {frozenset(c) for c in groups()}, suggestions


def test_ladder_resolves_each_audio_house_to_the_declared_clusters_and_suggestions(house):
    _name, w = house
    clusters, suggestions = ladder2(w)
    assert clusters == {frozenset(c) for c in w["clusters"]}
    home = {e: c for c in clusters for e in c}
    declared = {(s["rule"], frozenset({home[s["a"][0]], home[s["b"][0]]})) for s in w["suggestions"]}
    assert suggestions == declared and len(declared) == len(w["suggestions"])


def test_ma_house_ladder_facts():
    w = fx.build_world("ma")
    clusters, suggestions = ladder2(w)
    home = {e: c for c in clusters for e in c}
    # a WiiM: wiim + cast + MA are ONE cluster, though only the manufacturer + model and an embedded id link them
    assert home["media_player.cr016_wiim_living"] == {"media_player.cr016_wiim_living", "media_player.cr016_wiim_living_cast", "media_player.cr016_wiim_living_ma"}
    # the Denon: Main + Zone2 (rung 1) + HEOS + MA (the MA id equals the HEOS id) - receiver A is one cluster, receiver B two (HEOS B has another model string)
    assert len(home["media_player.cr016_denon_a"]) == 4
    assert home["media_player.cr016_denon_b"] == {"media_player.cr016_denon_b", "media_player.cr016_denon_b_zone2"}
    assert home["media_player.cr016_denon_b_heos"] == {"media_player.cr016_denon_b_heos", "media_player.cr016_denon_b_ma"}
    pids = {e["unique_id"] for e in w["entities"] if e["entity_id"] in ("media_player.cr016_denon_a_heos", "media_player.cr016_denon_a_ma")}
    assert len(pids) == 1  # the MA id EQUALS the HEOS player id
    # the TV that is unique merges; the two TVs of one model only get suggestions
    assert home["media_player.cr016_tv3_cast"] == {"media_player.cr016_tv3_cast", "media_player.cr016_tv3_ma"}
    assert {s[0] for s in suggestions} == {"3b"} and len(suggestions) == 4
    assert home["media_player.cr016_tv1_cast"] != home["media_player.cr016_tv1_ma"]
    # the Google-style pair: the Cast model is a PREFIX of the MA model
    assert home["media_player.cr016_mini_cast"] == {"media_player.cr016_mini_cast", "media_player.cr016_mini_ma"}
    # 35 entities -> 19 clusters -> 16 physical devices once the owner makes the one manual link and takes the two suggestions
    assert len(clusters) == 19 and w["expect"]["players"] == 16


def test_sonos_house_ladder_facts():
    w = fx.build_world("sonos")
    clusters, suggestions = ladder2(w)
    home = {e: c for c in clusters for e in c}
    assert home["media_player.cr016_tv_living"] == {"media_player.cr016_tv_living", "remote.cr016_tv_living", "media_player.cr016_st_tv_living"}
    assert sorted(r for r, _p in suggestions) == ["5", "5", "5", "5", "5b"]  # four twins share the area, one has it on the Sonos side only
    spare = {"media_player.cr016_sonos_spare", "media_player.cr016_st_spare"}
    assert not any(spare & set().union(*pair) for _r, pair in suggestions)  # the sixth pair has no area anywhere: NO suggestion, a manual link
    # the Sonos and its SmartThings twin share nothing but the name: no MAC, no identifier, no manufacturer, no model
    st = next(d for d in w["devices"] if d["id"] == "cr016_dev_st_living")
    assert st["manufacturer"] is None and st["model"] is None and not st["connections"] and st["via_device_id"] == "cr016_dev_st_hub"
    assert next(d for d in w["devices"] if d["id"] == "cr016_dev_sonos_living")["name"] == st["name"]


# ---------------------------------------------------------------- the probes' shapes


def test_feature_masks_are_the_probes_numbers():
    assert (fx.MA_LIVE_MASK, fx.MA_LIVE_SRC_MASK, fx.MA_DEGRADED_MASK, fx.SONOS_MASK) == (8320575, 8322623, 7795251, 8321599)
    assert (fx.ST_SPEAKER_MASK, fx.ST_TV_MASK) == (21517, 23997)
    full, degraded = fx.MA_LIVE_MASK, fx.MA_DEGRADED_MASK
    assert full & fx.GROUPING and full & fx.VOLUME_SET and not degraded & fx.GROUPING and not degraded & fx.VOLUME_SET and degraded & fx.PLAY_MEDIA
    assert fx.SONOS_MASK & fx.GROUPING and fx.SONOS_MASK & fx.MEDIA_ANNOUNCE and not fx.SONOS_MASK & (fx.TURN_ON | fx.TURN_OFF)  # the full native mask, no on/off
    assert not fx.ST_SPEAKER_MASK & (fx.PLAY_MEDIA | fx.GROUPING | fx.SELECT_SOURCE | fx.PREVIOUS_TRACK)  # the poor cloud twin
    assert not fx.CAST_AUDIO_MASK & fx.GROUPING and not fx.HELPER_SPEAKERS_MASK & fx.GROUPING and fx.HEOS_MASK & fx.GROUPING and fx.HEOS_MASK & fx.MEDIA_ENQUEUE
    assert not fx.DENON_ZONE2_MASK & (fx.PLAY | fx.PAUSE | fx.PLAY_MEDIA) and fx.DENON_ZONE2_MASK & fx.TURN_ON  # Zone2 has no transport


def test_group_members_encodings_in_the_ma_house():
    w = fx.build_world("ma")
    a = lambda s: attrs_of(w, f"media_player.cr016_{s}")  # noqa: E731
    assert a("wiim_terrace_ma")["group_members"] == [] and a("mini_ma")["group_members"] == []  # MA ungrouped / a member that lists nothing
    assert a("wiim_study")["group_members"] == ["media_player.cr016_wiim_terrace", "media_player.cr016_wiim_study"]  # wiim: the group when grouped (and [self] when alone)
    assert a("denon_a_heos")["group_members"] is None and "group_members" in a("denon_a_heos")  # HEOS: the key is present with a null value
    for absent in ("wiim_living_cast", "denon_a", "denon_a_zone2", "mini_cast"):
        assert "group_members" not in a(absent), absent  # cast and denonavr never carry it
    sonos = fx.build_world("sonos")
    assert attrs_of(sonos, "media_player.cr016_sonos_living")["group_members"] == ["media_player.cr016_sonos_living"]  # Sonos: [self]


def test_the_cross_brand_sync_group_is_inconsistent_like_system_v():
    w = fx.build_world("ma")
    ids = {s: f"media_player.cr016_{s}" for s in ("denon_a_ma", "denon_b_ma", "mini_ma", "nest_ma_refuses")}
    lists = {s: attrs_of(w, e)["group_members"] for s, e in ids.items()}
    assert sorted(lists["denon_a_ma"]) == sorted(ids.values()) and lists["denon_a_ma"][0] == ids["denon_a_ma"]  # the leader lists all four ...
    assert lists["denon_b_ma"] == lists["denon_a_ma"]                                                         # ... so does one member ...
    assert lists["mini_ma"] == [] and lists["nest_ma_refuses"] == []                                          # ... and two members list NOTHING
    leader_pid = next(e["unique_id"] for e in w["entities"] if e["entity_id"] == ids["denon_a_ma"])
    assert {attrs_of(w, e)["active_queue"] for e in ids.values()} == {leader_pid}  # but every active_queue is the leader's MA player id
    assert leader_pid not in ids.values()  # the queue id is the player id (unique_id), not an entity id - like the real integration's
    assert {e["platform"] for e in w["entities"] if e["entity_id"] in ids.values()} == {"music_assistant"}


def test_wiim_pair_is_grouped_in_both_layers_and_the_other_pair_in_one():
    w = fx.build_world("ma")
    for s in ("living", "kitchen"):
        assert len(attrs_of(w, f"media_player.cr016_wiim_{s}")["group_members"]) == 2  # the wiim layer ...
        assert len(attrs_of(w, f"media_player.cr016_wiim_{s}_ma")["group_members"]) == 2  # ... and the MA layer (the MA pair: the leader and its one member list both)
    conflict = next(g for g in w["groups"] if g["id"] == "vendor_only")
    assert conflict["conflict"] and conflict["layer"] == "vendor"
    assert len(attrs_of(w, "media_player.cr016_wiim_terrace")["group_members"]) == 2 and attrs_of(w, "media_player.cr016_wiim_terrace_ma")["group_members"] == []  # vendor-only: MA says ungrouped
    g = attrs_of(w, "media_player.cr016_group_outside_ma")  # the static MA group of those two players is a device of its own
    assert g["mass_player_type"] == "group" and len(g["group_members"]) == 2


def test_unavailable_restored_and_hidden_entities_in_the_ma_house():
    w = fx.build_world("ma")
    rows = {e["entity_id"]: e for e in w["entities"]}
    unavailable = [e for e in rows.values() if e["state"] == "unavailable"]
    assert len(unavailable) == 10  # 3 Cast TVs + their 3 MA twins + 4 MA-only players: off TVs are unavailable in this house
    restored = [e for e in unavailable if e["attributes"].get("restored")]
    assert len(restored) == w["expect"]["restored"] == 4
    fx.MODEL.load(w)
    p = fx.MODEL.payload("media_player.cr016_old_a_ma")
    assert p["state"] == "unavailable" and p["attributes"]["restored"] is True and p["attributes"]["supported_features"] == fx.MA_DEGRADED_MASK
    assert set(p["attributes"]) == {"friendly_name", "device_class", "supported_features", "restored"}
    p = fx.MODEL.payload("media_player.cr016_garden_ma")  # really unavailable: not restored
    assert "restored" not in p["attributes"] and p["attributes"]["supported_features"] == fx.MA_DEGRADED_MASK
    hidden = [e for e in rows.values() if e["hidden_by"]]
    assert len(hidden) == 3 and all(e["platform"] == "cast" and e["state"] == "off" and e["hidden_by"] == "user" for e in hidden)  # hidden, enabled, live
    assert not any(e["disabled_by"] for e in rows.values())
    tv = rows["media_player.cr016_tv1_cast"]
    assert "device_class" not in tv["attributes"] and tv["state"] == "unavailable"  # no device class: the kind comes from the manufacturer / model


def test_model_numbers_manufacturers_and_areas_in_the_ma_house():
    w = fx.build_world("ma")
    dev = {d["id"]: d for d in w["devices"]}
    cast = [d for d in w["devices"] if d["id"] in ("cr016_dev_cast_tv1", "cr016_dev_cast_tv2")]
    assert cast[0]["model"] == cast[1]["model"] and cast[0]["manufacturer"] == cast[1]["manufacturer"]  # two TVs of one model
    assert dev["cr016_dev_cast_mini"]["model"] == "Home Mini" and dev["cr016_dev_ma_mini"]["model"] == "Home Mini Gen2"  # a shortened Cast model
    placed = [s for s, p in w["players"].items() if p["area_id"]]
    assert sorted(placed) == sorted(["wiim_living", "wiim_kitchen", "wiim_terrace", "mini", "nest", "denon_a", "tv3"]) and w["expect"]["unplaced"] == 9
    assert all(p["floor_id"] for p in w["players"].values() if p["area_id"])
    assert w["players"]["denon_a"]["zones"] == ["media_player.cr016_denon_a", "media_player.cr016_denon_a_zone2"]
    assert attrs_of(w, "media_player.cr016_denon_a_zone2")["supported_features"] == fx.DENON_ZONE2_MASK


def test_sonos_house_shapes():
    w = fx.build_world("sonos")
    rows = {e["entity_id"]: e for e in w["entities"]}
    assert w["floors"] == [] and all(a["floor_id"] is None for a in w["areas"])  # no floors at all
    sonos = [e for e in rows.values() if e["platform"] == "sonos"]
    st = [e for e in rows.values() if e["platform"] == "smartthings" and e["attributes"].get("device_class") == "speaker"]
    assert len(sonos) == len(st) == 6 and {e["attributes"]["supported_features"] for e in sonos} == {fx.SONOS_MASK} and {e["attributes"]["supported_features"] for e in st} == {fx.ST_SPEAKER_MASK}
    assert sorted(e["attributes"]["friendly_name"] for e in sonos) == sorted(e["attributes"]["friendly_name"] for e in st)  # IDENTICAL names
    assert all(fx.SONOS_FAVOURITES[0] in e["attributes"]["source_list"] for e in sonos)
    living = rows["media_player.cr016_sonos_living"]["attributes"]
    assert living["queue_position"] == 3 and living["queue_size"] == 12 and living["media_content_type"] == "music"
    helpers = [e for e in rows.values() if e["platform"] == "group"]
    assert len(helpers) == 2 and all(e["device_id"] is None and "group_members" not in e["attributes"] and not e["attributes"]["supported_features"] & fx.GROUPING for e in helpers)
    sonos_helper = rows["media_player.cr016_helper_sonos"]["attributes"]["entity_id"]
    assert len(sonos_helper) == 5 and all(m in rows and rows[m]["platform"] == "sonos" for m in sonos_helper)  # a 5-Sonos fan-out
    sp = rows["media_player.cr016_spotify"]
    assert sp["state"] == "unavailable" and sp["attributes"]["supported_features"] == fx.SELECT_SOURCE and sp["attributes"]["restored"]
    jf = [e for e in rows.values() if e["platform"] == "jellyfin"]
    enabled = [e for e in jf if not e["disabled_by"]]
    assert len(jf) == 13 and len(enabled) == 10 and all(e["state"] == "unavailable" for e in enabled) and sum(1 for e in enabled if e["attributes"].get("restored")) == 9
    assert sum(1 for e in enabled if e["attributes"]["friendly_name"] == "SynthClient DLNA") == 8  # eight sessions, one generic name
    assert all(e["state"] is None for e in jf if e["disabled_by"])
    fx.MODEL.load(w)
    assert len(fx.MODEL.ents) == 31 and not any("jf_d" in e for e in fx.MODEL.ents)  # the disabled ones have no state at all
    assert [m["kind"] for m in w["nonphysical"]].count("session") == 10 and {m["kind"] for m in w["nonphysical"]} == {"session", "virtual_group", "service"}
    assert not any(e["attributes"]["supported_features"] & fx.GROUPING for e in st)


# ---------------------------------------------------------------- the bridge 0.5.0 services (CR-016 6.3): policy and effects


W1, W2, W3 = "media_player.cr016_wiim_living_ma", "media_player.cr016_wiim_kitchen_ma", "media_player.cr016_wiim_terrace_ma"
DEN_A, DEN_B, MINI, NEST = "media_player.cr016_denon_a_ma", "media_player.cr016_denon_b_ma", "media_player.cr016_mini_ma", "media_player.cr016_nest_ma_refuses"


def test_the_real_bridge_does_not_know_the_050_services_until_s1_lands():
    allowed = fx.parse_allowed(fx.BRIDGE_INIT.read_text(encoding="utf-8"))
    missing = fx.BRIDGE_050_SERVICES - allowed
    assert fx.BRIDGE_050_SERVICES == BRIDGE_050  # the fixture's copy of CR-016 6.3
    # either the bridge already carries all of them (S1 merged) or none of the players' own services (this base): never half
    assert missing in (set(), fx.BRIDGE_050_SERVICES)


def test_without_the_services_the_fake_bridge_refuses_them_like_drift(monkeypatch):
    world, pushed = audio_bridge(monkeypatch, "ma")
    monkeypatch.setattr(fx.MODEL, "allowed", MEDIA_ALLOWED)
    assert call("media_player", "join", entity_id=W1, group_members=[W3]) == {"ok": False, "error": "service_not_allowed"}
    assert call("music_assistant", "play_media", entity_id=W1, media_type="radio", media_id="library://radio/r1") == {"ok": False, "error": "service_not_allowed"}
    assert pushed == [] and last()["effect"] is False


def test_seek_shuffle_repeat_effects_and_refusals(ma):
    world, pushed = ma
    assert call("media_player", "media_seek", entity_id=W1, seek_position=90)["ok"]
    assert call("media_player", "shuffle_set", entity_id=W1, shuffle=True)["ok"]
    assert call("media_player", "repeat_set", entity_id=W1, repeat="all")["ok"]
    settle()
    assert (live(W1)["media_position"], live(W1)["shuffle"], live(W1)["repeat"]) == (90.0, True, "all")
    assert [(e["kind"], e.get("position"), e.get("shuffle"), e.get("repeat")) for e in fx.MODEL.log] == [("seek", 90, None, None), ("shuffle", None, True, None), ("repeat", None, None, "all")]
    for service, data, code in [("media_seek", dict(seek_position=-1), "media_seek_invalid"), ("media_seek", dict(seek_position="9"), "media_seek_invalid"), ("media_seek", dict(seek_position=True), "media_seek_invalid"),
                                ("shuffle_set", dict(shuffle="yes"), "media_shuffle_invalid"), ("repeat_set", dict(repeat="forever"), "media_repeat_invalid")]:
        assert call("media_player", service, entity_id=W1, **data) == {"ok": False, "error": code}, (service, data)
    # a player without the flag fails like Home Assistant: a Cast speaker cannot shuffle or seek
    assert call("media_player", "shuffle_set", entity_id="media_player.cr016_mini_cast", shuffle=True) == {"ok": False, "error": "HomeAssistantError"}
    assert call("media_player", "media_seek", entity_id="media_player.cr016_mini_cast", seek_position=3) == {"ok": False, "error": "HomeAssistantError"}


def test_announcements_and_url_media_ids_never_pass(ma):
    world, pushed = ma
    assert call("media_player", "play_media", entity_id=W1, media_content_type="music", media_content_id="library://track/t1", announce=True) == {"ok": False, "error": "media_announce_not_allowed"}
    assert call("media_player", "play_media", entity_id=W1, media_content_type="music", media_content_id="library://track/t1") == {"ok": False, "error": "media_type_not_allowed"}  # not a key, not a text
    monkey_allowed = fx.MODEL.allowed | {("music_assistant", "play_announcement")}
    fx.MODEL.allowed = monkey_allowed
    assert call("music_assistant", "play_announcement", entity_id=W1, url="library://track/t1") == {"ok": False, "error": "media_service_not_allowed"}  # even if the allow-list slipped
    for mid in ("https://example.invalid/a.mp3", "http://192.0.2.9/a", "HTTP://x", "file:///a.mp3", "/media/a.mp3", "../etc/passwd", "library://track/../../x", "C:\\a.mp3", ""):
        assert call("music_assistant", "play_media", entity_id=W1, media_type="track", media_id=mid) == {"ok": False, "error": "media_id_not_allowed"}, mid
    assert call("music_assistant", "play_media", entity_id=W1, media_type="podcast", media_id="library://track/t1") == {"ok": False, "error": "media_type_not_allowed"}
    assert call("music_assistant", "play_media", entity_id=W1, media_type="track", media_id="library://track/t1", enqueue="now") == {"ok": False, "error": "media_enqueue_invalid"}
    assert call("music_assistant", "play_media", entity_id="media_player.cr016_wiim_living", media_type="track", media_id="library://track/t1") == {"ok": False, "error": "media_target_not_music_assistant"}
    assert call("music_assistant", "play_media", entity_id=W1, media_type="track", media_id="library://track/zzz") == {"ok": False, "error": "HomeAssistantError"}  # an id MA does not know
    assert pushed == []


def test_play_item_replaces_or_extends_the_queue_and_never_touches_volume(ma):
    world, pushed = ma
    before = live(W1)["volume_level"]
    assert call("music_assistant", "play_media", entity_id=W1, media_type="radio", media_id="library://radio/r1")["ok"]
    settle()
    a = live(W1)
    assert (a["media_title"], a["media_artist"], a["media_duration"], a["volume_level"]) == ("תחנה לדוגמה 1", None, None, before)  # a station: no artist, no duration; volume untouched
    assert fx.MODEL.ents[W1]["state"] == "playing" and fx.MODEL.queues[W1]["items"] == [["radio", "r1"]]
    assert last()["kind"] == "play_item" and (last()["media_type"], last()["media_id"], last()["enqueue"]) == ("radio", "library://radio/r1", "play")
    assert call("music_assistant", "play_media", entity_id=W1, media_type="playlist", media_id="library://playlist/p1", enqueue="replace")["ok"]
    assert fx.MODEL.queues[W1]["items"] == [["track", "t1"], ["track", "t3"], ["track", "t4"]] and live(W1)["media_title"] == "שיר לדוגמה א"
    assert call("music_assistant", "play_media", entity_id=W1, media_type="track", media_id="library://track/t2", enqueue="next")["ok"]
    assert call("music_assistant", "play_media", entity_id=W1, media_type="track", media_id="library://track/t4", enqueue="add")["ok"]
    assert fx.MODEL.queues[W1]["items"] == [["track", "t1"], ["track", "t2"], ["track", "t3"], ["track", "t4"], ["track", "t4"]] and live(W1)["media_title"] == "שיר לדוגמה א"
    # the member of a group plays the LEADER's queue: playing on the kitchen player changes the living room player's queue
    assert call("music_assistant", "play_media", entity_id=W2, media_type="album", media_id="library://album/a2")["ok"]
    assert W2 not in fx.MODEL.queues and fx.MODEL.queues[W1]["items"] == [["track", "t3"], ["track", "t4"]]
    assert live(W2)["media_title"] == live(W1)["media_title"] == "שיר לדוגמה ג"
    assert live(W1)["volume_level"] == before and not any(e.get("volume_level") for e in fx.MODEL.log)


def test_next_and_previous_follow_the_queue_and_members_follow_the_leader(ma):
    world, pushed = ma
    assert call("media_player", "media_next_track", entity_id=W1)["ok"]
    settle()
    assert live(W1)["media_title"] == "שיר לדוגמה ב" and live(W2)["media_title"] == "שיר לדוגמה ב" and live("media_player.cr016_wiim_living")["media_title"] == "שיר לדוגמה ב"  # members and the vendor twin follow
    assert call("media_player", "media_previous_track", entity_id=W1)["ok"] and live(W1)["media_title"] == "שיר לדוגמה א"
    assert call("media_player", "media_pause", entity_id=W1)["ok"]
    settle()
    assert [fx.MODEL.ents[e]["state"] for e in (W1, W2, "media_player.cr016_wiim_living", "media_player.cr016_wiim_kitchen")] == ["paused"] * 4
    assert fx.MODEL.ents["media_player.cr016_wiim_living_cast"]["state"] == "off"  # a hidden Cast entity is not a player
    assert call("media_player", "media_play", entity_id=W1)["ok"]
    assert fx.MODEL.ents[W2]["state"] == "playing"


def test_volume_and_mute_follow_the_physical_twins_but_not_other_devices(ma):
    world, pushed = ma
    assert call("media_player", "volume_set", entity_id=W1, volume_level=0.42)["ok"]
    settle()
    assert [live(e)["volume_level"] for e in (W1, "media_player.cr016_wiim_living", "media_player.cr016_wiim_living_cast")] == [0.42, 0.42, 0.42]
    assert live(W2)["volume_level"] != 0.42 and live(DEN_A)["volume_level"] != 0.42  # a group member keeps its own level: the fan-out is the add-on's
    assert sorted(pushed[-1]) == sorted([W1, "media_player.cr016_wiim_living", "media_player.cr016_wiim_living_cast"])
    assert call("media_player", "volume_mute", entity_id="media_player.cr016_denon_a_heos", is_volume_muted=True)["ok"]
    assert live(DEN_A)["is_volume_muted"] is True and live("media_player.cr016_denon_a")["is_volume_muted"] is True
    assert live("media_player.cr016_denon_a_zone2")["is_volume_muted"] is False  # Zone2 is its own output
    assert call("media_player", "volume_set", entity_id="media_player.cr016_denon_a_zone2", volume_level=0.1)["ok"] and live("media_player.cr016_denon_a")["volume_level"] == 0.35
    # an unavailable player refuses, and its MA twin is not moved by a twin that is available
    assert call("media_player", "volume_set", entity_id="media_player.cr016_tv1_ma", volume_level=0.2) == {"ok": False, "error": "HomeAssistantError"}


def test_zone2_sound_mode_and_the_receiver_zones(ma):
    world, pushed = ma
    assert call("media_player", "select_sound_mode", entity_id="media_player.cr016_denon_a", sound_mode="Movie")["ok"]
    assert live("media_player.cr016_denon_a")["sound_mode"] == "Movie" and last()["sound_mode"] == "Movie"
    assert call("media_player", "select_sound_mode", entity_id="media_player.cr016_denon_a", sound_mode="Bogus") == {"ok": False, "error": "media_sound_mode_unknown"}
    assert call("media_player", "turn_on", entity_id="media_player.cr016_denon_a_zone2")["ok"]
    settle()
    assert fx.MODEL.ents["media_player.cr016_denon_a_zone2"]["state"] == "on" and fx.MODEL.ents["media_player.cr016_denon_a"]["state"] == "on"
    assert call("media_player", "media_play", entity_id="media_player.cr016_denon_a_zone2") == {"ok": False, "error": "HomeAssistantError"}  # Zone2 has no transport


# ---------------------------------------------------------------- join / unjoin in each layer's own encoding


def test_join_in_the_ma_layer_lists_the_leader_and_the_first_member_and_moves_the_queue_ids(ma):
    world, pushed = ma
    assert call("media_player", "join", entity_id=W1, group_members=[MINI])["ok"]
    settle()
    assert live(W1)["group_members"] == [W1, W2, MINI] and live(W2)["group_members"] == [W1, W2, MINI]  # the leader and the FIRST member list everything
    assert live(MINI)["group_members"] == [] and live(MINI)["active_queue"] == fx.MODEL.ents[W1]["unique_id"]
    assert last()["members"] == [MINI] and last()["entity_id"] == W1 and {W1, W2, MINI, DEN_A} <= set(pushed[-1])  # everyone whose attributes changed is pushed (Denon A: the Mini left its group)
    # the Mini left the cross-brand group of four: its old leader's list shrank
    assert live(DEN_A)["group_members"] == [DEN_A, DEN_B, NEST]
    # the wiim layer is NOT touched by an MA join: the Mini has no vendor layer, the pair stays as it was
    assert live("media_player.cr016_wiim_living")["group_members"] == ["media_player.cr016_wiim_living", "media_player.cr016_wiim_kitchen"]


def test_unjoin_a_member_a_leader_and_the_last_member_dissolves_the_group(ma):
    world, pushed = ma
    assert call("media_player", "unjoin", entity_id=NEST)["ok"]
    assert live(DEN_A)["group_members"] == [DEN_A, DEN_B, MINI] and live(NEST)["group_members"] == [] and live(NEST)["active_queue"] == fx.MODEL.ents[NEST]["unique_id"]
    assert call("media_player", "unjoin", entity_id=DEN_A)["ok"]  # the leader leaves: the group lives on with a new leader (the first member)
    assert live(DEN_B)["group_members"] == [DEN_B, MINI] and live(MINI)["active_queue"] == fx.MODEL.ents[DEN_B]["unique_id"] and live(DEN_A)["group_members"] == []
    assert call("media_player", "unjoin", entity_id=MINI)["ok"]
    assert live(DEN_B)["group_members"] == [] and live(DEN_B)["active_queue"] == fx.MODEL.ents[DEN_B]["unique_id"]  # one member left: no group
    assert fx.MODEL.groups["ma"] == [{"leader": W1, "members": [W2]}]
    # leaving the vendor-layer pair leaves the MA layer alone: that is how "קיבוץ לא תואם" arises
    assert call("media_player", "unjoin", entity_id="media_player.cr016_wiim_kitchen")["ok"]
    assert live("media_player.cr016_wiim_kitchen")["group_members"] == ["media_player.cr016_wiim_kitchen"] and live(W2)["group_members"] == [W1, W2]


def test_a_member_that_refuses_is_accepted_and_not_joined(ma):
    world, pushed = ma
    assert call("media_player", "unjoin", entity_id=NEST)["ok"]
    assert call("media_player", "join", entity_id=W1, group_members=[NEST, W3])["ok"] is True  # the call is accepted ...
    settle()
    assert live(W1)["group_members"] == [W1, W2, W3] and NEST not in live(W1)["group_members"]  # ... one member did not join: the honest read-back shows it
    assert live(NEST)["group_members"] == []
    fx.MODEL.join_refuse = {W3}  # a dynamic refusal
    assert call("media_player", "unjoin", entity_id=W3)["ok"]
    assert call("media_player", "join", entity_id=W1, group_members=[W3])["ok"] and W3 not in live(W1)["group_members"]
    assert last()["effect"] is False  # nothing changed: no state was pushed for it


def test_join_failures_are_like_home_assistant(ma):
    world, pushed = ma
    for leader, members in [(W1, ["media_player.cr016_tv1_ma"]),                       # an unavailable member
                            (W1, ["media_player.cr016_mini_cast"]),                    # another platform
                            ("media_player.cr016_mini_cast", [W1]),                    # a Cast leader has no GROUPING
                            (W1, ["media_player.cr016_denon_a"]),                      # a receiver zone entity is not a member
                            ("media_player.cr016_tv1_ma", [W1])]:                      # an unavailable leader
        assert call("media_player", "join", entity_id=leader, group_members=members) == {"ok": False, "error": "HomeAssistantError"}, (leader, members)
    assert call("media_player", "join", entity_id=W1, group_members=["light.kitchen"]) == {"ok": False, "error": "media_group_invalid"}  # the bridge's own check: media_player only
    assert call("media_player", "join", entity_id=W1, group_members=[]) == {"ok": False, "error": "media_group_invalid"}
    assert call("media_player", "join", entity_id=W1, group_members=["media_player.x"] * 17) == {"ok": False, "error": "media_group_invalid"}
    assert fx.MODEL.groups["ma"][1] == {"leader": W1, "members": [W2]} and pushed == []


def test_sonos_join_lists_everyone_on_every_member_and_unjoin_goes_back_to_self(sonos):
    world, pushed = sonos
    s = lambda n: f"media_player.cr016_sonos_{n}"  # noqa: E731
    assert call("media_player", "join", entity_id=s("living"), group_members=[s("kitchen"), s("bedroom")])["ok"]
    settle()
    for n in ("living", "kitchen", "bedroom"):
        assert live(s(n))["group_members"] == [s("living"), s("kitchen"), s("bedroom")]  # Sonos: every member lists the group, the coordinator first
    assert live(s("study"))["group_members"] == [s("study")]
    assert call("media_player", "unjoin", entity_id=s("kitchen"))["ok"]
    assert live(s("kitchen"))["group_members"] == [s("kitchen")] and live(s("living"))["group_members"] == [s("living"), s("bedroom")]
    # the terrace Sonos refuses; the SmartThings twins and the helper never join
    assert call("media_player", "join", entity_id=s("living"), group_members=[s("terrace") + "_refuses"])["ok"] and "terrace" not in " ".join(live(s("living"))["group_members"])
    assert call("media_player", "join", entity_id=s("living"), group_members=["media_player.cr016_st_study"]) == {"ok": False, "error": "HomeAssistantError"}
    assert call("media_player", "join", entity_id="media_player.cr016_helper_sonos", group_members=[s("study")]) == {"ok": False, "error": "HomeAssistantError"}  # a helper is never joinable


def test_heos_layer_encoding_null_when_alone():
    w = fx.build_world("ma")
    ents = {e["entity_id"]: {"platform": e["platform"], "unique_id": e["unique_id"], "attrs": copy_attrs(e), "state": e["state"]} for e in w["entities"]}
    groups = {"heos": [{"leader": "media_player.cr016_denon_a_heos", "members": ["media_player.cr016_denon_b_heos"]}]}
    changed = fx.render_groups(ents, {"heos": groups["heos"]})
    assert "media_player.cr016_denon_a_heos" in changed and ents["media_player.cr016_denon_a_heos"]["attrs"]["group_members"] == ["media_player.cr016_denon_a_heos", "media_player.cr016_denon_b_heos"]
    assert ents["media_player.cr016_denon_b_heos"]["attrs"]["group_members"] == ents["media_player.cr016_denon_a_heos"]["attrs"]["group_members"]
    assert fx.render_groups(ents, {"heos": []}) == {"media_player.cr016_denon_a_heos", "media_player.cr016_denon_b_heos"}
    assert ents["media_player.cr016_denon_a_heos"]["attrs"]["group_members"] is None  # back to null, the key stays
    assert fx.render_groups(ents, {"heos": []}) == set()  # idempotent


def copy_attrs(e):
    import copy as _c

    return _c.deepcopy(e["attributes"])


def test_transfer_moves_the_queue_and_the_playing_state(ma):
    world, pushed = ma
    assert call("music_assistant", "transfer_queue", entity_id="media_player.cr016_garden_ma", source_player=W1, auto_play=True) == {"ok": False, "error": "HomeAssistantError"}  # unavailable target
    assert call("music_assistant", "transfer_queue", entity_id=MINI, source_player="media_player.cr016_wiim_living", auto_play=True) == {"ok": False, "error": "media_transfer_not_music_assistant"}
    assert call("music_assistant", "transfer_queue", entity_id=MINI, source_player=W3, auto_play=True) == {"ok": False, "error": "HomeAssistantError"}  # nothing to transfer
    assert call("music_assistant", "transfer_queue", entity_id=W3, source_player=W1, auto_play=True)["ok"]
    settle()
    assert last()["kind"] == "transfer" and last()["source_player"] == W1
    assert fx.MODEL.queues[W3]["items"][0] == ["track", "t1"] and W1 not in fx.MODEL.queues
    assert fx.MODEL.ents[W3]["state"] == "playing" and live(W3)["media_title"] == "שיר לדוגמה א"
    assert fx.MODEL.ents[W1]["state"] == "idle" and fx.MODEL.ents[W2]["state"] == "idle" and live(W1)["media_title"] is None  # the group of the source stops


def test_sonos_favourite_starts_playing_and_stations_have_no_source_of_their_own(sonos):
    world, pushed = sonos
    e = "media_player.cr016_sonos_bedroom"
    assert call("media_player", "select_source", entity_id=e, source="פלייליסט ערב")["ok"]
    settle()
    assert fx.MODEL.ents[e]["state"] == "playing" and live(e)["source"] == "פלייליסט ערב" and live(e)["media_title"] == "פלייליסט ערב" and live(e)["queue_size"] == 6
    assert call("media_player", "select_source", entity_id=e, source="not a favourite") == {"ok": False, "error": "media_source_unknown"}
    assert call("media_player", "select_source", entity_id="media_player.cr016_st_bedroom", source="x") == {"ok": False, "error": "media_source_unknown"}  # the cloud twin has no source list
    assert call("media_player", "join", entity_id=e, group_members=["media_player.cr016_sonos_study"])["ok"]  # grouping through the music layer itself


# ---------------------------------------------------------------- media_query: real HA shapes, then the bridge's trim


def query(**body):
    status, answer = fx.media_query({"request_id": "r-1", **body})
    assert status == 200
    return answer["service_response"]


def test_raw_get_queue_has_the_real_response_shape_and_everything_the_bridge_must_strip(ma):
    raw = fx.raw_get_queue(W1)
    assert list(raw) == [W1]
    q = raw[W1]
    assert set(q) == {"queue_id", "active", "name", "items", "shuffle_enabled", "repeat_mode", "current_index", "elapsed_time", "current_item", "next_item"}
    assert q["items"] == 4 and isinstance(q["items"], int) and q["current_index"] == 0 and q["active"] is True  # `items` is a COUNT, never the list
    assert set(q["current_item"]) == {"queue_item_id", "name", "duration", "media_item", "stream_title", "stream_details"}
    assert q["current_item"]["media_item"]["image"].startswith("http://192.0.2.50") and q["current_item"]["media_item"]["provider_mappings"][0]["url"].endswith("/t1")
    assert fx.raw_get_queue(W2)[W2]["current_item"]["name"] == q["current_item"]["name"]  # a group member reports the leader's queue
    empty = fx.raw_get_queue(W3)[W3]
    assert empty["items"] == 0 and empty["current_item"] is None and empty["current_index"] is None and empty["active"] is False


def test_raw_get_library_and_search_shapes(ma):
    lib = fx.raw_get_library({"media_type": "radio", "favorite": True, "limit": 50, "offset": 0, "order_by": "name"})
    assert set(lib) == {"items", "limit", "offset", "order_by", "media_type"} and [i["name"] for i in lib["items"]] == ["תחנה לדוגמה 1", "תחנה לדוגמה 2"]
    assert lib["items"][0]["uri"] == "library://radio/r1" and lib["items"][0]["favorite"] is True and "image" in lib["items"][0]
    assert len(fx.raw_get_library({"media_type": "radio", "favorite": False, "limit": 2, "offset": 1})["items"]) == 2  # all stations, paged
    track = fx.raw_get_library({"media_type": "track", "favorite": True})["items"][0]
    assert track["artists"][0]["name"] and track["album"]["name"] and track["duration"]
    found = fx.raw_search({"search": "לדוגמה", "limit": 10})
    assert set(found) == {"artists", "albums", "tracks", "playlists", "radio"} and len(found["tracks"]) == 4 and len(found["radio"]) == 3


def test_media_query_trims_the_queue_and_leaks_nothing(ma):
    ans = query(query="queue", entity_id=W1)
    assert ans["ok"] and ans["provider"] == "ma" and ans["query"] == "queue" and ans["request_id"] == "r-1"
    r = ans["result"]
    assert (r["count"], r["index"], r["shuffle"], r["repeat"]) == (4, 0, False, "off")
    assert r["current"] == {"name": "שיר לדוגמה א", "artist": "אמן לדוגמה", "album": "אלבום לדוגמה", "duration": 215} and r["next"]["name"] == "שיר לדוגמה ב"
    assert not NO_ID_LEAK.search(json.dumps(ans)) and "queue_item_id" not in json.dumps(ans)
    assert query(query="queue", entity_id=W2)["result"]["count"] == 4  # a member: the leader's queue
    empty = query(query="queue", entity_id=W3)["result"]
    assert (empty["count"], empty["index"], empty["current"], empty["next"]) == (0, None, None, None)  # an empty queue is NOT "unavailable"
    assert any(e["kind"] == "query" and e["query"] == "queue" and e["result"] == "ok" for e in fx.MODEL.log)


def test_media_query_library_for_ma_validates_its_arguments(ma):
    ans = query(query="library", entity_id=W1, media_type="radio", favorite=True, limit=50, offset=0, order_by="name")
    assert ans["ok"] and [i["name"] for i in ans["result"]["items"]] == ["תחנה לדוגמה 1", "תחנה לדוגמה 2"]
    assert set(ans["result"]["items"][0]) == {"uri", "media_type", "name"} and ans["result"]["items"][0]["uri"].startswith("library://radio/")  # the uri leaves the bridge: the add-on turns it into an item_ref
    assert "artist" in query(query="library", entity_id=W1, media_type="track", favorite=True)["result"]["items"][0]
    assert not re.search(r"imageproxy|192\.0\.2|\.invalid|provider_mappings", json.dumps(ans))
    for bad in (dict(media_type="podcast"), dict(media_type="radio", limit=101), dict(media_type="radio", limit=0), dict(media_type="radio", limit=True), dict(media_type="radio", offset=-1),
                dict(media_type="radio", order_by="play_count"), dict(media_type="radio", favorite="yes")):
        assert query(query="library", entity_id=W1, **bad) == {"ok": False, "error": "arguments_invalid", "request_id": "r-1", "query": "library"}, bad


def test_media_query_refusals_and_failures(ma):
    assert query(query="search", entity_id=W1, search="x")["error"] == "query_not_allowed"  # phase 2b
    assert query(query="browse", entity_id=W1)["error"] == "query_not_allowed" and query(query="get_queue", entity_id=W1)["error"] == "query_not_allowed"
    assert query(query="queue", entity_id="media_player.nope")["error"] == "entity_not_found"
    assert query(query="queue", entity_id="media_player.cr016_tv1_ma")["error"] == "entity_unavailable"
    assert query(query="queue", entity_id="media_player.cr016_wiim_living")["error"] == "no_library"  # a WiiM entity has no music layer of its own
    assert query(query="queue", entity_id="media_player.cr016_denon_a_heos")["error"] == "no_library"  # HEOS answers only through MA in 0.1.150
    fx.MODEL.ma_loaded = False  # the MA config entry is absent / not loaded
    assert query(query="library", entity_id=W1, media_type="radio")["error"] == "no_library"
    fx.MODEL.ma_loaded, fx.MODEL.query_fail = True, True
    assert query(query="queue", entity_id=W1) == {"ok": False, "error": "timeout", "request_id": "r-1", "query": "queue"}  # the panel shows "לא זמין", never "empty"
    fx.MODEL.query_fail, fx.MODEL.refuse = False, "unauthorized"
    assert query(query="queue", entity_id=W1)["error"] == "unauthorized"


def test_search_is_served_only_when_phase_2b_is_switched_on(ma):
    fx.MODEL.search_enabled = True
    ans = query(query="search", entity_id=W1, search="אלבום")
    assert ans["ok"] and set(ans["result"]) == {"artists", "albums", "tracks", "playlists", "radio"} and [i["name"] for i in ans["result"]["albums"]] == ["אלבום לדוגמה", "אלבום שני"]
    assert not re.search(r"imageproxy|\.invalid", json.dumps(ans))
    assert query(query="search", entity_id=W1)["error"] == "arguments_invalid" and query(query="search", entity_id=W1, search="x" * 81)["error"] == "arguments_invalid"


def test_media_query_older_bridge_does_not_know_the_service(monkeypatch, ma):
    monkeypatch.setattr(fx.MODEL, "bridge_version", "0.4.0")
    status, body = fx.media_query({"query": "queue", "entity_id": W1})
    assert status == 400 and "not found" in body["message"].lower()  # the add-on maps this to bridge_outdated, exactly as for stream_source


def test_sonos_without_music_assistant_answers_from_its_own_attributes(sonos):
    e = "media_player.cr016_sonos_living"
    q = query(query="queue", entity_id=e)
    assert q["ok"] and q["provider"] == "sonos" and q["result"] == {"count": 12, "index": 3, "current": None, "next": None}  # position and size only: no next item without MA
    assert query(query="queue", entity_id="media_player.cr016_sonos_study")["result"]["count"] is None  # idle: nothing known, still not an error
    fav = query(query="library", entity_id=e, media_type="track", favorite=True)
    assert fav["ok"] and fav["provider"] == "sonos" and [i["name"] for i in fav["result"]["items"]] == fx.SONOS_FAVOURITES
    assert [i["name"] for i in query(query="library", entity_id=e, media_type="radio")["result"]["items"]] == fx.SONOS_FAVOURITES[:2]
    assert query(query="library", entity_id=e, media_type="playlist")["result"]["items"] == []  # no playlists tab with the Sonos provider
    for dead in ("media_player.cr016_st_living", "media_player.cr016_helper_sonos", "media_player.cr016_tv_living", "media_player.cr016_spotify"):
        assert query(query="queue", entity_id=dead)["ok"] is False
    assert query(query="queue", entity_id="media_player.cr016_spotify")["error"] == "entity_unavailable" and query(query="queue", entity_id="media_player.cr016_st_living")["error"] == "no_library"


# ---------------------------------------------------------------- the entity registry write (place a device)


def test_entity_area_moves_the_entity_in_the_fake_registry_and_tells_the_sync(monkeypatch):
    world, pushed = audio_bridge(monkeypatch, "ma")
    events: list[tuple[str, dict]] = []
    monkeypatch.setattr(fx.WORLD, "emit", lambda et, data: (events.append((et, data)), 1)[1])
    with fx.WORLD.lock:
        fx.WORLD.entities, fx.WORLD.areas = json.loads(json.dumps(fx.registry_rows(world)[0])), json.loads(json.dumps(world["areas"]))
    ans = fx.entity_area({"entity_id": "media_player.cr016_wiim_study_ma", "area_id": "cr016_office", "request_id": "r"})
    assert ans == {"ok": True, "context_id": None, "request_id": "r"}
    assert next(e for e in fx.WORLD.entities if e["entity_id"] == "media_player.cr016_wiim_study_ma")["area_id"] == "cr016_office"
    assert events == [("entity_registry_updated", {"action": "update", "entity_id": "media_player.cr016_wiim_study_ma"})]
    assert last()["kind"] == "set_area" and last()["area_id"] == "cr016_office" and last()["result"] == "ok"
    assert fx.entity_area({"entity_id": "media_player.cr016_wiim_study_ma", "area_id": "cr016_nowhere"})["error"] == "area_not_found"
    assert fx.entity_area({"entity_id": "media_player.nope", "area_id": "cr016_office"})["error"] == "entity_not_found"
    assert len(events) == 1  # the refusals told nobody


# ---------------------------------------------------------------- the control server with an audio house


def test_control_seeds_the_audio_houses_and_drives_the_fake_bridge(control):
    r = httpx.post(f"{control}/seed-media", json={"house": "sonos"}).json()
    assert r["registry_ok"] and r["states_ok"] and r["house"] == "sonos" and r["expect"]["enabled"] == 31 and r["players"]["sonos_living"]["music_provider"] == "sonos"
    body = _Stub.seen[0][1]
    assert len(body["entities"]) == 34 and len(body["devices"]) == 31 and body["floors"] == [] and len(body["areas"]) == 7  # the registry carries the disabled ones ...
    posted = [s for p, b in _Stub.seen if p.endswith("/ha/dev/states") for s in b["states"]]
    assert len(posted) == 31 and not any("jf_d" in s["entity_id"] for s in posted)                                       # ... the states do not
    assert httpx.get(f"{control}/world").json()["house"] == "sonos" and httpx.get(f"{control}/world", params={"house": "ma"}).json()["expect"]["devices"] == 33
    assert httpx.post(f"{control}/seed-media", json={"house": "castle"}).status_code == 422
    # the MA house through the same door: HEOS reports its null group_members
    _Stub.seen.clear()
    ma = httpx.post(f"{control}/seed-media", json={"house": "ma"}).json()
    assert ma["house"] == "ma" and ma["expect"]["entities"] == 35
    states = {s["entity_id"]: s for p, b in _Stub.seen if p.endswith("/ha/dev/states") for s in b["states"]}
    assert len(states) == 35 and "group_members" in states["media_player.cr016_denon_a_heos"]["attributes"] and states["media_player.cr016_denon_a_heos"]["attributes"]["group_members"] is None
    assert "group_members" not in states["media_player.cr016_denon_a"]["attributes"] and states["media_player.cr016_wiim_terrace_ma"]["attributes"]["group_members"] == []
    assert states["media_player.cr016_old_a_ma"]["attributes"].get("restored") is True and set(states["media_player.cr016_old_a_ma"]["attributes"]) == {"friendly_name", "device_class", "supported_features", "restored"}
    # the allow-list the real bridge carries: the 0.5.0 services are missing before S1 and the status says so
    allowed_missing = httpx.get(f"{control}/status").json()["allowed_missing"]
    assert allowed_missing in ([], sorted(f"{d}.{s}" for d, s in BRIDGE_050))


def test_control_bridge_exec_query_raw_and_config(control, monkeypatch):
    monkeypatch.setattr(fx.MODEL, "allowed", MEDIA_ALLOWED)
    monkeypatch.setattr(fx.MODEL, "bridge_version", "0.5.0")
    httpx.post(f"{control}/seed-media", json={"house": "ma"})
    _Stub.seen.clear()
    r = httpx.post(f"{control}/bridge-exec", json={"domain": "media_player", "service": "join", "data": {"entity_id": W3, "group_members": []}}).json()
    assert r == {"ok": False, "error": "service_not_allowed"}  # no 0.5.0 allow-list yet
    cfg = httpx.post(f"{control}/media-config", json={"allow_extra": [["media_player", "join"], ["media_player", "unjoin"]], "join_refuse": [NEST], "search_enabled": True}).json()
    assert cfg["join_refuse"] == [NEST] and cfg["search_enabled"] is True and cfg["ping"] is None
    assert httpx.post(f"{control}/bridge-exec", json={"domain": "media_player", "service": "unjoin", "data": {"entity_id": W2}}).json()["ok"]
    entry = httpx.get(f"{control}/media-log").json()["entries"][-1]
    assert (entry["service"], entry["entity_id"], entry["result"], entry["effect"]) == ("unjoin", W2, "ok", True)  # an effect was scheduled: the changed members are pushed to the add-on
    assert httpx.get(f"{control}/status").json()["groups"]["ma"][1:] == []  # the pair is gone from the MA layer
    q = httpx.post(f"{control}/bridge-query", json={"query": "queue", "entity_id": DEN_A}).json()["service_response"]
    assert q["ok"] and q["result"]["count"] == 2 and q["result"]["current"]["name"] == "שיר לדוגמה ג"
    raw = httpx.get(f"{control}/raw", params={"service": "get_queue", "entity_id": DEN_A}).json()
    assert raw[DEN_A]["items"] == 2 and "stream_details" in raw[DEN_A]["current_item"]
    lib = httpx.get(f"{control}/raw", params={"service": "get_library", "media_type": "playlist", "favorite": "true"}).json()
    assert [i["name"] for i in lib["items"]] == ["פלייליסט בוקר", "פלייליסט ערב"]
    assert httpx.get(f"{control}/raw", params={"service": "search", "search": "אלבום"}).json()["albums"]
    assert httpx.get(f"{control}/raw", params={"service": "nope"}).status_code == 404 and httpx.get(f"{control}/raw", params={"service": "get_queue"}).status_code == 422
    flags = httpx.post(f"{control}/media-config", json={"ma_loaded": False, "query_fail": True, "allow_reset": True}).json()
    assert flags["ma_loaded"] is False and flags["query_fail"] is True
    assert httpx.get(f"{control}/status").json()["allowed_missing"] in ([], sorted(f"{d}.{s}" for d, s in BRIDGE_050))  # allow_reset: back to the real bridge's list
    assert httpx.post(f"{control}/seed-media", json={"house": "ma"}).status_code == 200 and httpx.get(f"{control}/status").json()["ma_loaded"] is True  # a seed resets the toggles
