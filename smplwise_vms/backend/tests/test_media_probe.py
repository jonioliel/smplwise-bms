"""CR-015 phase 0: scripts/media_probe.py is read-only by construction (an allow-list of WebSocket message types, refused
before anything is sent), prints and writes STRUCTURE only (counts, key sets, value types, closed enumerations: no name, entity
id, device id, MAC, address, identifier, URL, token or host), reads its variables by NAME from an env file, writes only under
private-evidence/ and only summary.json, and aborts instead of writing anything that looks sensitive. Everything here runs
against the synthetic world of frontend/tests/fixtures/media_fake_ha.py and a fake connection: no network, no real system."""
from __future__ import annotations

import asyncio
import copy
import datetime as dt
import importlib.util
import json
import re
import sys
from pathlib import Path

import pytest

ROOT = Path(__file__).resolve().parents[3]
sys.path.insert(0, str(ROOT / "scripts"))
import media_probe as probe  # noqa: E402


def _load_fixture():
    spec = importlib.util.spec_from_file_location("media_fake_ha_for_probe", ROOT / "frontend" / "tests" / "fixtures" / "media_fake_ha.py")
    mod = importlib.util.module_from_spec(spec)
    sys.modules[spec.name] = mod
    spec.loader.exec_module(mod)
    return mod


fx = _load_fixture()
TOKEN = "TOKEN-SENTINEL-9f3a17"
HOST = "http://ha-sentinel.example.test:8123"
SENTINELS = [TOKEN, "ha-sentinel", "SECRETNAME", "SECRETAREA", "SECRETUID", "SECRETDEV", "SECRETMAKER", "SECRETSOURCE", "SECRETATTR", "secret_custom", "secretname", "SECRETMODEL"]

SERVICES = {
    "media_player": {"play_media": {"fields": {"entity_id": {}, "media_content_id": {}, "media_content_type": {}, "SECRETATTR": {}}}, "select_source": {"fields": {"source": {}}}, "turn_on": {"fields": {}}},
    "remote": {"send_command": {"fields": {"command": {}, "num_repeats": {}}}, "turn_on": {"fields": {"activity": {}}}},
    "webostv": {"button": {"fields": {"entity_id": {}, "button": {"selector": {"select": {"options": ["UP", "DOWN", "ENTER", "POWER", "NETFLIX", "SECRET NAME"]}}}}}, "command": {"fields": {"command": {}, "payload": {}}},
                "select_sound_output": {"fields": {"sound_output": {"selector": {"select": {"options": [{"value": "tv_speaker", "label": "TV"}, {"value": "external_arc", "label": "ARC"}]}}}}}},
    "samsungtv_smart": {"set_art_mode": {"fields": {}}, "select_picture_mode": {"fields": {}}},
    "script": {"secretname_night": {"fields": {}}},
    "secret_custom": {"do_secret": {"fields": {}}},
}


def world_frames(world=None):
    w = world or fx.build_world()
    states = [{"entity_id": e["entity_id"], "state": e["state"], "attributes": copy.deepcopy(e["attributes"])} for e in w["entities"]]
    ents, devs = fx.registry_rows(w)
    return states, ents, devs


class FakeConn:
    """A scripted Home Assistant WebSocket: answers by message type, records everything sent."""

    def __init__(self, *, token_ok=True, admin=True, states=None, ents=None, devs=None, services=None):
        s, e, d = world_frames()
        self.queue: list[dict] = [{"type": "auth_required", "ha_version": "2026.9.4"}]
        self.sent: list[dict] = []
        self.token_ok, self.admin = token_ok, admin
        self.states, self.ents, self.devs = (states if states is not None else s), (ents if ents is not None else e), (devs if devs is not None else d)
        self.services = SERVICES if services is None else services
        self.closed = False

    async def send(self, obj):
        self.sent.append(obj)
        t, mid = obj["type"], obj.get("id")
        if t == "auth":
            self.queue.append({"type": "auth_ok"} if self.token_ok and obj.get("access_token") else {"type": "auth_invalid"})
            return
        ok = lambda result: self.queue.append({"id": mid, "type": "result", "success": True, "result": result})  # noqa: E731
        no = lambda code: self.queue.append({"id": mid, "type": "result", "success": False, "error": {"code": code, "message": "SECRETNAME must not be echoed"}})  # noqa: E731
        if t in ("config/entity_registry/list", "config/device_registry/list") and not self.admin:
            return no("unauthorized")
        if t == "get_states":
            ok(copy.deepcopy(self.states))
        elif t == "config/entity_registry/list":
            ok(copy.deepcopy(self.ents))
        elif t == "config/device_registry/list":
            ok(copy.deepcopy(self.devs))
        elif t == "get_services":
            ok(copy.deepcopy(self.services))
        else:  # pragma: no cover - the allow-list makes this unreachable; a test proves it
            raise AssertionError(f"unexpected message type {t}")

    async def recv(self, timeout=None):
        return self.queue.pop(0) if self.queue else None

    async def close(self):
        self.closed = True


@pytest.fixture()
def evidence(tmp_path, monkeypatch):
    """private-evidence/ redirected into tmp: the tests never touch the real folder."""
    root = tmp_path / "repo"
    monkeypatch.setattr(probe, "REPO", root)
    monkeypatch.setattr(probe, "PRIVATE_EVIDENCE", root / "private-evidence")
    (root / "private-evidence").mkdir(parents=True)
    return root


def env_file(tmp_path, **extra):
    p = tmp_path / "probe.env"
    lines = [f"SW_PROBE_HA_URL={HOST}", f'SW_PROBE_HA_TOKEN="{TOKEN}"', "# a comment", "export UNUSED=1"] + [f"{k}={v}" for k, v in extra.items()]
    p.write_text("\n".join(lines) + "\n", encoding="utf-8")
    return p


def run(argv, conns, today=dt.date(2026, 10, 1)):
    """Run main_async with a queue of fake connections; returns (exit code, printed text)."""
    args = probe.build_parser().parse_args(argv)
    lines: list[str] = []
    pool = list(conns)

    async def opener(url):
        assert url == HOST
        c = pool.pop(0)
        if isinstance(c, Exception):
            raise c
        return c

    code = asyncio.run(probe.main_async(args, opener, lines.append, today))
    return code, "\n".join(lines)


def summary_of(text):
    return json.loads(text[text.index("{") : text.rindex("}") + 1])


def assert_clean(text):
    for s in SENTINELS:
        assert s not in text, f"{s!r} leaked into the output"
    assert not re.search(r"(?i)(?:[0-9a-f]{2}[:\-]){5}[0-9a-f]{2}", text), "a MAC leaked"
    assert not re.search(r"\b192\.0\.2\.\d+\b", text), "an address leaked"
    assert not re.search(r"(?i)[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}", text), "a UUID leaked"
    assert not re.search(r"\b(?:media_player|remote|webostv)\.cr015_", text), "an entity id leaked"
    assert "cr015_" not in text, "an id of the synthetic house leaked"
    assert not re.search(r"[֐-׿]", text), "a Hebrew name leaked (the synthetic house's names are Hebrew)"


# ---------------------------------------------------------------- read-only by construction


def test_the_allow_list_is_exactly_the_brief_and_refuses_everything_else():
    assert probe.ALLOWED_WS_TYPES == {"auth", "get_states", "config/entity_registry/list", "config/device_registry/list", "get_services"}
    for bad in ("call_service", "subscribe_events", "subscribe_entities", "config/entity_registry/update", "config/entity_registry/remove", "config/device_registry/update", "config_entries/flow/init",
                "supervisor/api", "hassio/addon/restart", "config/area_registry/list", "get_config", "manifest/get", "media_player/browse_media", "auth/delete_all_refresh_tokens", "", "get_states "):
        with pytest.raises(probe.ProbeRefused):
            probe.guard(bad)


def test_a_refused_type_is_never_sent():
    conn = FakeConn()
    session = probe.Session(conn)
    assert asyncio.run(session.authenticate(TOKEN)) is True
    sent_before = len(conn.sent)
    for bad in ("call_service", "config/entity_registry/remove", "subscribe_events"):
        with pytest.raises(probe.ProbeRefused):
            asyncio.run(session.call(bad, domain="media_player", service="turn_off"))
    assert len(conn.sent) == sent_before, "nothing was put on the wire"


def test_the_full_run_sends_only_the_five_reads_and_closes(tmp_path, evidence):
    conn = FakeConn()
    code, text = run([str(env_file(tmp_path))], [conn])
    assert code == 0, text
    assert [m["type"] for m in conn.sent] == ["auth", "get_states", "config/entity_registry/list", "config/device_registry/list", "get_services"]
    assert {m["type"] for m in conn.sent} <= probe.ALLOWED_WS_TYPES and conn.closed
    assert_clean(text)


# ---------------------------------------------------------------- what it reports about the synthetic house


def test_the_ladder_preview_on_the_synthetic_house(tmp_path, evidence):
    code, text = run([str(env_file(tmp_path)), "--no-write"], [FakeConn()])
    assert code == 0, text
    s = summary_of(text)
    assert s["ha_version"] == "2026.9.4" and s["probe_version"] == 1
    assert s["states"] == {"listing": "success", "total": 19, "media_player": 15, "remote": 4, "by_platform": s["states"]["by_platform"]}
    lad = s["registry"]["structure"]["ladder"]
    assert lad["endpoints"] == 19 and lad["physical_devices"] == 9  # 7 screens + the receiver + the speaker
    assert lad["merged_by_rung"] == {"1": 4, "2": 1, "3": 4, "4": 1}, "remote+media_player of four devices; the MA export; ST + DLNA + two Cast by MAC; the living room Cast by UUID"
    assert lad["blocked_by_same_platform_guard"] == {}, "the two Samsungs share nothing, so nothing was blocked"
    assert lad["cluster_sizes"] == {"1": 4, "2": 3, "3": 1, "6": 1}
    assert lad["music_assistant"] == {"exports_joined": 1, "entity_id_shaped_unique_id_unmatched": 0}
    mixes = lad["cluster_platform_mixes"]
    assert any("smartthings/media_player" in k and "dlna_dmr/media_player" in k and "music_assistant/media_player" in k and "cast/media_player" in k for k in mixes)
    assert lad["weak_name_suggestions"] == 0


def test_how_integrations_register_devices(tmp_path, evidence):
    _code, text = run([str(env_file(tmp_path)), "--no-write"], [FakeConn()])
    reg = summary_of(text)["registry"]["structure"]
    assert reg["media_entities"] == 19 and reg["platforms"]["samsungtv_smart"] == 6 and reg["platforms"]["cast"] == 5 and reg["platforms"]["music_assistant"] == 1
    ssv = reg["by_platform"]["samsungtv_smart"]
    assert ssv["devices"] == 3 and ssv["devices_with_mac"] == 3 and ssv["devices_with_several_media_entities"] == 3
    assert ssv["connection_types"] == {"mac": 3} and ssv["mac_format"] == {"lower_colon": 3}
    assert ssv["identifier_shape"] == {"samsungtv_smart:uuid_prefixed": 3}
    cast = reg["by_platform"]["cast"]
    assert cast["devices_with_mac"] == 4 and cast["identifier_shape"] == {"cast:uuid": 5} and cast["devices"] == 5
    st = reg["by_platform"]["smartthings"]
    assert st["devices_with_mac"] == 1 and st["mac_format"] == {"other_format": 1}, "the probe tells how each integration writes its MAC"
    ma = reg["by_platform"]["music_assistant"]
    assert ma["unique_id_shape"] == {"entity_id": 1} and ma["identifier_domains"] == {"music_assistant": 1} and ma["devices_with_mac"] == 0
    assert reg["by_platform"]["webostv"]["manufacturer"] == {"lg": 2}


def test_how_the_integrations_report_their_state(tmp_path, evidence):
    _code, text = run([str(env_file(tmp_path)), "--no-write"], [FakeConn()])
    bp = summary_of(text)["states"]["by_platform"]
    lg = bp["webostv"]["media_player"]
    assert lg["turn_on_bit_by_state"] == {"turn_on=False|state=on": 1, "turn_on=True|state=on": 1}, "the LG with and without a turn-on automation"
    assert lg["sound_output"] == {"external_arc": 1, "tv_speaker": 1}
    assert lg["features"]["VOLUME_STEP"] == 2 and lg["features"]["VOLUME_SET"] == 1 and lg["features"]["TURN_ON"] == 1
    assert lg["source_list"]["present"] == 2 and lg["source_list"]["item_kind_heuristic"] == {"input": 6, "other": 6}  # Live TV, HDMI 1, HDMI 2 | Netflix, YouTube, Web Browser
    ssv = bp["samsungtv_smart"]
    assert ssv["by_domain"] == {"media_player": 3, "remote": 3} and ssv["states"] == {"on": 6}
    assert ssv["media_player"]["source_list"]["current_source_in_list"] == {"yes": 3}
    assert ssv["media_player"]["source_list"]["item_kind_heuristic"] == {"input": 12, "other": 12}
    assert "ip_address" in ssv["media_player"]["attribute_keys"]["keys"], "the attribute NAME is reported, never its value"
    android = bp["androidtv_remote"]
    assert android["remote"]["features"] == {"ACTIVITY": 1} and android["remote"]["activity_list_length"] == {"1-5": 1} and android["remote"]["current_activity_in_list"] == {"yes": 1}
    assert android["media_player"]["features"].get("VOLUME_SET") is None and android["media_player"]["features"]["VOLUME_STEP"] == 1
    ma = bp["music_assistant"]["media_player"]
    assert ma["mass_player_type"] == {"player": 1} and ma["device_class"] == {"speaker": 1}
    cast = bp["cast"]["media_player"]
    assert cast["with_entity_picture"] == 2 and cast["media_content_type"] == {"video": 2, "tvshow": 1}


def test_services_and_the_closed_lists(tmp_path, evidence):
    _code, text = run([str(env_file(tmp_path)), "--no-write"], [FakeConn()])
    svc = summary_of(text)["services"]
    assert svc["services"]["webostv"] == ["button", "command", "select_sound_output"]
    assert svc["services"]["media_player"] == ["play_media", "select_source", "turn_on"] and "script" not in svc["services"]
    assert svc["fields"]["webostv"]["button"] == ["button", "entity_id"]
    assert svc["closed_lists"]["webostv"]["button"]["button"] == ["DOWN", "ENTER", "NETFLIX", "POWER", "UP"], "a value that is not a plain token is left out"
    assert svc["closed_lists"]["webostv"]["select_sound_output"]["sound_output"] == ["external_arc", "tv_speaker"]
    assert svc["other_known_domains_present"] == []


def test_the_ladder_guard_and_the_weak_rung_count_only():
    eps = [
        {"entity_id": "media_player.a", "domain": "media_player", "platform": "samsungtv_smart", "device_id": "d1", "unique_id": "u1", "area_id": "x", "name": "Samsung Room TV"},
        {"entity_id": "media_player.b", "domain": "media_player", "platform": "samsungtv_smart", "device_id": "d2", "unique_id": "u2", "area_id": "y", "name": "Other"},
        {"entity_id": "media_player.c", "domain": "media_player", "platform": "cast", "device_id": "d3", "unique_id": "u3", "area_id": "x", "name": "Room Cast"},
    ]
    devs = {"d1": {"connections": [["mac", "AA-BB-CC-00-00-01"]], "identifiers": []}, "d2": {"connections": [["mac", "aa:bb:cc:00:00:01"]], "identifiers": []}, "d3": {"connections": [], "identifiers": [["cast", "zz"]]}}
    lad = probe.ladder_preview(eps, devs)
    assert lad["physical_devices"] == 3, "two Samsungs sharing a MAC are never merged, and the weak rung never merges"
    assert lad["blocked_by_same_platform_guard"] == {"rung3": 1}
    assert lad["weak_name_suggestions"] == 1, "same area and same normalised name in different clusters is only a suggestion"
    assert lad["merged_by_rung"] == {}


def test_an_ma_import_loop_is_joined_by_its_player_id():
    eps = [
        {"entity_id": "media_player.tv", "domain": "media_player", "platform": "webostv", "device_id": "d1", "unique_id": "lg1", "area_id": None, "name": None},
        {"entity_id": "media_player.tv_ma", "domain": "media_player", "platform": "music_assistant", "device_id": "d2", "unique_id": "media_player.tv", "area_id": None, "name": None},
        {"entity_id": "media_player.orphan_ma", "domain": "media_player", "platform": "music_assistant", "device_id": "d3", "unique_id": "media_player.gone", "area_id": None, "name": None},
    ]
    devs = {"d1": {"connections": [], "identifiers": []}, "d2": {"connections": [], "identifiers": [["music_assistant", "media_player.tv"]]}, "d3": {"connections": [], "identifiers": []}}
    lad = probe.ladder_preview(eps, devs)
    assert lad["physical_devices"] == 2 and lad["merged_by_rung"] == {"2": 1}
    assert lad["music_assistant"] == {"exports_joined": 1, "entity_id_shaped_unique_id_unmatched": 1}


# ---------------------------------------------------------------- nothing private leaves the probe


def tainted_world():
    w = fx.build_world()
    for e in w["entities"]:
        e["attributes"]["friendly_name"] = "SECRETNAME " + e["entity_id"]
        e["original_name"] = "SECRETNAME"
        e["unique_id"] = e["unique_id"] if e["platform"] == "music_assistant" else "SECRETUID-" + e["unique_id"]
        if isinstance(e["attributes"].get("source_list"), list):
            e["attributes"]["source_list"] = e["attributes"]["source_list"] + ["SECRETSOURCE"]
    for d in w["devices"]:
        d["name"], d["model"], d["manufacturer"] = "SECRETDEV", "SECRETMODEL", "SECRETMAKER"
        d["area_id"] = "SECRETAREA"
    # an entity of a custom integration carrying private attribute names and values
    w["entities"].append({"entity_id": "media_player.secretname_box", "id": "x", "unique_id": "SECRETUID-x", "platform": "secret_custom", "device_id": None, "area_id": "SECRETAREA", "config_entry_id": "c", "name": "SECRETNAME", "original_name": None,
                          "disabled_by": None, "hidden_by": None, "entity_category": None, "state": "SECRETNAME", "attributes": {"friendly_name": "SECRETNAME", "SECRETATTR": "v", "secretattr_name": "v", "supported_features": 0, "device_class": "SECRETNAME", "sound_output": "SECRETNAME"}})
    return w


def test_no_name_id_mac_address_uuid_or_token_reaches_the_output_or_the_file(tmp_path, evidence):
    states, ents, devs = world_frames(tainted_world())
    code, text = run([str(env_file(tmp_path)), "--label", "home"], [FakeConn(states=states, ents=ents, devs=devs)])
    assert code == 0, text
    assert_clean(text)
    out = evidence / "private-evidence" / "media-probe-2026-10-01-home"
    assert sorted(p.name for p in out.iterdir()) == ["summary.json"], "no raw dump: the summary is the only file"
    written = (out / "summary.json").read_text(encoding="utf-8")
    assert_clean(written)
    s = json.loads(written)
    assert s["states"]["by_platform"]["other"]["entities"] == 1, "a custom integration is counted, never described"
    assert set(s["states"]["by_platform"]["other"]) == {"entities", "by_domain", "states"}
    assert s["states"]["by_platform"]["other"]["states"] == {"<str>": 1}, "an unknown state value is reported as its type"
    assert json.loads(text[text.index("{") : text.rindex("}") + 1]) == s, "what is printed is what is written"
    other = s["registry"]["structure"]["by_platform"]["other"]
    assert (other["devices"], other["manufacturer"], other["without_device"]) == (0, {}, 1), "a custom integration without a device contributes counts only"


def test_the_sanity_net_aborts_instead_of_writing(tmp_path):
    for bad in ({"a": "media_player.secret"}, {"a": ["02:00:00:c0:15:01"]}, {"a": {"b": "192.0.2.1"}}, {"a": "http://x"}, {"a": "00000000-0000-4000-8000-c01500000001"}, {"light.secret": 1}, {"a": "AA-BB-CC-00-00-01"}):
        with pytest.raises(probe.ProbeError):
            probe.ensure_clean(bad)
    probe.ensure_clean({"ha_version": "2026.9.4.1", "by_domain": {"media_player": 3}, "features": {"TURN_ON": 1}, "k": "turn_on=True|state=on", "m": "cast/media_player+dlna_dmr/media_player"})
    with pytest.raises(probe.ProbeError):
        probe.write_summary(tmp_path / "out", {"x": "remote.cr015_thing"})
    assert not (tmp_path / "out").exists(), "nothing was created before the check"


def test_a_failing_connection_reports_the_class_only(tmp_path, evidence):
    code, text = run([str(env_file(tmp_path))], [OSError(f"cannot reach {HOST} with {TOKEN}")])
    assert code == 2 and "OSError" in text
    assert_clean(text)
    code, text = run([str(env_file(tmp_path))], [FakeConn(token_ok=False)])
    assert code == 2 and "auth: refused" in text and TOKEN not in text


def test_a_non_administrator_token_gets_the_state_based_part_only(tmp_path, evidence):
    code, text = run([str(env_file(tmp_path)), "--no-write"], [FakeConn(admin=False)])
    assert code == 0, text
    assert_clean(text)
    s = summary_of(text)
    assert s["registry"]["entity_registry"] == "unauthorized" and s["registry"]["device_registry"] == "unauthorized"
    assert s["registry"]["structure"] == {"skipped": "the registry listings need an administrator's token"}
    assert s["states"]["total"] == 19 and set(s["states"]["by_platform"]) == {"registry_unavailable"}
    assert "administrator" in text


def test_the_environment_file_is_read_by_variable_name(tmp_path, evidence):
    p = tmp_path / "other.env"
    p.write_text(f"MY_URL={HOST}\nMY_TOKEN={TOKEN}\nSW_PROBE_HA_URL=http://decoy.test\n", encoding="utf-8")
    code, text = run([str(p), "--url-var", "MY_URL", "--token-var", "MY_TOKEN", "--no-write"], [FakeConn()])
    assert code == 0 and TOKEN not in text
    code, text = run([str(tmp_path / "missing.env")], [])
    assert code == 2 and "not found" in text
    q = tmp_path / "bad.env"
    q.write_text("SW_PROBE_HA_URL=ftp://x\nSW_PROBE_HA_TOKEN=t\n", encoding="utf-8")
    assert run([str(q)], [])[0] == 2
    r = tmp_path / "notoken.env"
    r.write_text(f"SW_PROBE_HA_URL={HOST}\n", encoding="utf-8")
    code, text = run([str(r)], [])
    assert code == 2 and "missing" in text


def test_output_goes_only_under_private_evidence(tmp_path, evidence):
    env = env_file(tmp_path)
    outside = tmp_path / "elsewhere"
    code, text = run([str(env), "--out", str(outside)], [FakeConn()])
    assert code == 2 and "private-evidence" in text and not outside.exists()
    code, text = run([str(env), "--label", "../x"], [FakeConn()])
    assert code == 2 and "--label" in text
    code, text = run([str(env), "--out", str(evidence / "private-evidence" / ".." / "x")], [FakeConn()])
    assert code == 2
    code, text = run([str(env), "--out", str(evidence / "private-evidence" / "mine")], [FakeConn()])
    assert code == 0 and (evidence / "private-evidence" / "mine" / "summary.json").is_file()
    code, text = run([str(env)], [FakeConn()])
    assert code == 0 and (evidence / "private-evidence" / "media-probe-2026-10-01" / "summary.json").is_file()
    assert probe.safe_out_dir(None, "office", dt.date(2026, 11, 2)).name == "media-probe-2026-11-02-office"
    # --no-write writes nothing
    before = sorted(p.name for p in (evidence / "private-evidence").iterdir())
    assert run([str(env), "--no-write", "--label", "zzz"], [FakeConn()])[0] == 0
    assert sorted(p.name for p in (evidence / "private-evidence").iterdir()) == before


def test_helpers_never_return_a_value():
    assert probe.id_shape("02:00:00:c0:15:01") == "mac" and probe.id_shape("AA-BB-CC-00-00-01") == "mac"
    assert probe.id_shape("00000000-0000-4000-8000-c01500000001") == "uuid" and probe.id_shape("uuid:00000000-0000-4000-8000-c01500000001") == "uuid_prefixed"
    assert probe.id_shape("media_player.tv") == "entity_id" and probe.id_shape("0200c0150001") == "hex12" and probe.id_shape(123) == "<int>" and probe.id_shape("some name!") == "other"
    assert probe.norm_id("UUID:0000-AB") == "0000ab" and probe.norm_mac("AA-BB:cc") == "aabbcc"
    assert probe.token_or_type("tv_speaker") == "tv_speaker" and probe.token_or_type("My Speaker") == "<str>" and probe.token_or_type("a.b") == "<str>"
    assert probe.platform_label("samsungtv_smart") == "samsungtv_smart" and probe.platform_label("custom_x") == "other" and probe.platform_label(None) == "unregistered"
    assert probe.feature_names(128 | 4, probe.PLAYER_FEATURES) == ["VOLUME_SET", "TURN_ON"]
    assert probe.key_sets([{"a": 1, "B!": 2}, {"a": 1, "c": 3}]) == {"keys": ["a", "c"], "always": ["a"], "sometimes": ["c"]}
    assert probe.source_kind("HDMI 2") == "input" and probe.source_kind("Netflix") == "other" and probe.source_kind(3) == "<int>"
    assert probe.bucket(0) == "0" and probe.bucket(7) == "6-15" and probe.bucket(500) == ">100"
