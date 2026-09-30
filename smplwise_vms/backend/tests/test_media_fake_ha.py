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
    assert macs and all(m.lower().startswith("02:00:00:c0:15:") for m in macs)  # locally administered, obviously fake
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
            macs_a, macs_b = {c[1].lower().replace(":", "") for c in da["connections"] if c[0] == "mac"}, {c[1].lower().replace(":", "") for c in db["connections"] if c[0] == "mac"}
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
    vmac = {c[1] for c in vendor_dev["connections"]}
    mac = lambda eid: {c[1] for c in dev[by[eid]["device_id"]]["connections"]}  # noqa: E731
    assert mac("media_player.cr015_living_tv_st") & vmac and mac("media_player.cr015_living_tv_dlna") & vmac  # rung 3
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
