"""CR-014 phase 0: scripts/scheduler_phase0_probe.py is read-only by construction (an allow-list of WebSocket message
types, refused before anything is sent), prints structure only (no token, host, name, entity id or tag), reads its
variables by NAME from an env file, records a non-admin token's access when one is named, and writes raw answers only
inside private-evidence/. Everything here runs against synthetic frames and a fake connection: no network."""
from __future__ import annotations

import argparse
import ast
import asyncio
import copy
import json
import sys
from pathlib import Path

import pytest

ROOT = Path(__file__).resolve().parents[3]
sys.path.insert(0, str(ROOT / "scripts"))
import scheduler_phase0_probe as probe  # noqa: E402

TOKEN = "TOKEN-SENTINEL-9f3a17"
GUEST = "GUEST-SENTINEL-77c2e0"
HOST = "http://ha-sentinel.example.test:8123"
SECRETS = [TOKEN, GUEST, "ha-sentinel", "SECRETNAME", "secretname", "SECRETTAG", "secret_shabbat", "secret_night_script", "SECRETAREA"]


def act(service, entity, data=None):
    return {"service": service, "entity_id": entity, "service_data": data if data is not None else {}}


def slot(start, stop, actions, conds=True):
    c = [{"entity_id": "binary_sensor.secret_shabbat", "attribute": "state", "value": "on", "match_type": "is"}] if conds else []
    return {"start": start, "stop": stop, "conditions": c, "condition_type": "or" if conds else None, "track_conditions": False, "actions": actions}


ITEMS = [
    {"schedule_id": "a1b2c3", "entity_id": "switch.schedule_secretname_alpha", "name": "SECRETNAME alpha", "enabled": True, "weekdays": ["daily"], "start_date": None, "end_date": None, "repeat_type": "repeat",
     "tags": ["SECRETTAG"], "timeslots": [slot("00:00:00", "06:00:00", [act("climate.set_temperature", "climate.secretname_ac", {"hvac_mode": "cool", "temperature": 25.5})]),
                                          slot("06:00:00", "00:00:00", [act("climate.turn_off", "climate.secretname_ac")])],
     "timestamps": ["2026-10-03T00:00:00+03:00", "2026-10-03T06:00:00+03:00"], "next_entries": [0, 1]},
    {"schedule_id": "d4e5f6", "entity_id": "switch.schedule_d4e5f6", "name": "", "enabled": False, "weekdays": ["mon", "tue", "workday"], "start_date": "2026-10-31", "end_date": "2027-03-31", "repeat_type": "pause",
     "tags": [], "timeslots": [slot("sunset+00:30:00", None, [act("script.secret_night_script", None, {"secretvar": 1})], conds=False), slot("sunrise-00:10:00", "07:00:00", [act("light.turn_on", "light.hall", {"brightness": 51})], conds=False)],
     "timestamps": ["2026-10-03T17:30:00+03:00", "2026-10-03T06:00:00+03:00"], "next_entries": [1, 0]},
]
SWITCHES = [
    {"entity_id": "switch.schedule_secretname_alpha", "state": "on", "attributes": {"friendly_name": "Scheduler SECRETNAME", "icon": "mdi:calendar-clock", "current_slot": None, "next_slot": 0, "next_trigger": "2026-10-03T00:00:00+03:00",
                                                                                        "actions": [{"service": "climate.set_temperature", "data": {}}], "entities": ["climate.secretname_ac"], "tags": ["SECRETTAG"], "weekdays": ["daily"],
                                                                                        "timeslots": ["00:00:00 - 06:00:00", "06:00:00 - 00:00:00"]}},
    {"entity_id": "switch.schedule_d4e5f6", "state": "off", "attributes": {"friendly_name": "Scheduler d4e5f6", "timeslots": ["sunset+00:30:00", "sunrise-00:10:00 - 07:00:00"]}},
]
REGISTRY = [
    {"entity_id": "switch.schedule_secretname_alpha", "platform": "scheduler", "unique_id": "a1b2c3", "device_id": "dev1", "area_id": None, "config_entry_id": "ce1", "name": "SECRETAREA"},
    {"entity_id": "switch.schedule_d4e5f6", "platform": "scheduler", "unique_id": "d4e5f6", "device_id": "dev1", "area_id": None, "config_entry_id": "ce1"},
    {"entity_id": "light.hall", "platform": "hue", "unique_id": "x", "device_id": None, "area_id": "SECRETAREA"},
]
SERVICES = {"scheduler": {n: {"fields": {"entity_id": {}, "name": {}} if n in ("edit", "copy") else {}} for n in ("add", "edit", "remove", "copy", "run_action", "enable_all", "disable_all")}}


class FakeConn:
    """A scripted Home Assistant WebSocket: answers by message type, records everything sent."""

    def __init__(self, *, token_ok=True, admin=True, items=None, events=(), scheduler_installed=True, services=None):
        self.queue: list[dict] = [{"type": "auth_required", "ha_version": "2026.9.4"}]
        self.sent: list[dict] = []
        self.token_ok, self.admin, self.events, self.installed = token_ok, admin, list(events), scheduler_installed
        self.items = copy.deepcopy(ITEMS if items is None else items)
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
        if t.startswith("scheduler") and (not self.installed):
            return no("unknown_command")
        if t in ("scheduler", "scheduler/tags", "scheduler/item") and not self.admin:
            return no("unauthorized")
        if t == "scheduler":
            ok(copy.deepcopy(self.items))
        elif t == "scheduler/item":
            found = next((i for i in self.items if i["schedule_id"] == obj["schedule_id"]), None)
            ok(copy.deepcopy(found)) if found else no("not_found")
        elif t == "scheduler/tags":
            ok([{"name": "SECRETTAG", "schedules": ["a1b2c3"]}])
        elif t == "get_services":
            ok(self.services)
        elif t == "get_states":
            ok(SWITCHES + [{"entity_id": "light.hall", "state": "on", "attributes": {}}])
        elif t == "config/entity_registry/list":
            ok(REGISTRY)
        elif t == "manifest/get":
            ok({"domain": "scheduler", "version": "3.3.8"}) if self.installed else no("not_found")
        elif t == "scheduler_updated":
            ok(None)
            self.queue.extend({**e, "id": mid} for e in self.events)
        else:  # pragma: no cover - the allow-list makes this unreachable; a test proves it
            raise AssertionError(f"unexpected message type {t}")

    async def recv(self, timeout=None):
        return self.queue.pop(0) if self.queue else None

    async def close(self):
        self.closed = True


def env_file(tmp_path, **extra):
    p = tmp_path / "probe.env"
    lines = [f"SW_PROBE_HA_URL={HOST}", f'SW_PROBE_HA_TOKEN="{TOKEN}"', f"GUEST_TOKEN={GUEST}", "# a comment", "export UNUSED=1"]
    lines += [f"{k}={v}" for k, v in extra.items()]
    p.write_text("\n".join(lines) + "\n", encoding="utf-8")
    return p


def run(argv, conns, capsys=None):
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

    code = asyncio.run(probe.main_async(args, opener, lines.append))
    text = "\n".join(lines)
    if capsys is not None:
        text += capsys.readouterr().out
    return code, text


def assert_clean(text):
    for s in SECRETS:
        assert s not in text, f"{s!r} leaked into the output"


# ---------------------------------------------------------------- read-only by construction


def test_the_allow_list_is_exactly_the_contract_and_refuses_everything_else():
    assert probe.ALLOWED_WS_TYPES == {"auth", "get_services", "get_states", "config/entity_registry/list", "manifest/get", "scheduler", "scheduler/item", "scheduler/tags", "scheduler_updated"}
    for bad in ("call_service", "subscribe_events", "subscribe_entities", "config/entity_registry/update", "config/entity_registry/remove", "config_entries/flow/init", "supervisor/api",
                "hassio/addon/restart", "scheduler/add", "scheduler/remove", "auth/delete_all_refresh_tokens", "persistent_notification/dismiss", "", "get_config "):
        with pytest.raises(probe.ProbeRefused):
            probe.guard(bad)


def test_a_refused_type_is_never_sent():
    conn = FakeConn()
    session = probe.Session(conn)
    assert asyncio.run(session.authenticate(TOKEN)) is True
    sent_before = len(conn.sent)
    for bad in ("call_service", "scheduler/remove"):
        with pytest.raises(probe.ProbeRefused):
            asyncio.run(session.call(bad, domain="scheduler", service="disable_all"))
    with pytest.raises(probe.ProbeRefused):
        asyncio.run(session.subscribe("subscribe_events"))
    assert len(conn.sent) == sent_before, "nothing was put on the wire"


def test_full_run_prints_structure_only(tmp_path, capsys):
    conn = FakeConn(events=[{"type": "event", "event": {"event": "item_updated", "schedule_id": "a1b2c3"}}])
    guest = FakeConn(admin=False)
    code, text = run([str(env_file(tmp_path)), "--non-admin-token-var", "GUEST_TOKEN", "--listen", "0.2"], [conn, guest], capsys)
    assert code == 0, text
    for c in (conn, guest):
        assert {m["type"] for m in c.sent} <= probe.ALLOWED_WS_TYPES
        assert not any(m["type"] in ("call_service", "supervisor/api") for m in c.sent) and c.closed
    assert {m["type"] for m in conn.sent} == {"auth", "get_services", "manifest/get", "scheduler", "scheduler/item", "scheduler/tags", "get_states", "config/entity_registry/list", "scheduler_updated"}
    assert_clean(text)
    summary = json.loads(text[text.index("{"):text.rindex("}") + 1])
    assert summary["ha_version"] == "2026.9.4" and summary["manifest"] == {"error": None, "ok": True, "version": "3.3.8"}
    s = summary["services"]
    assert s["registered"] is True and s["reload_storage_registered"] is False and s["missing_from_the_contract_list"] == [] and s["unknown_to_the_contract"] == []
    assert s["services"]["edit"] == ["entity_id", "name"]
    sch = summary["scheduler"]
    assert sch["ok"] and sch["count"] == 2 and sch["list_matches_item_by_item"] is True
    assert sch["weekdays"] == {"daily": 1, "mon,tue,workday": 1}
    assert sch["repeat_type"] == {"pause": 1, "repeat": 1} and sch["enabled"] == {"False": 1, "True": 1}
    assert sch["time_kinds"]["start:HH:MM:SS"] == 2 and sch["time_kinds"]["start:sunset+HH:MM:SS"] == 1 and sch["time_kinds"]["start:sunrise-HH:MM:SS"] == 1 and sch["time_kinds"]["stop:null"] == 1
    assert sch["sun_offset_signs"] == {"plus": 1, "minus": 1}, "P0-7: a negative sun offset is detected"
    assert sch["condition"]["match_type"] == {"is": 2} and sch["condition"]["attribute"] == {"state": 2} and sch["condition_type"] == {"null": 2, "or": 2}
    assert sch["conditions_uniform_across_slots"] == {"schedules": 2, "of": 2}
    assert sch["action"]["services"] == {"climate.set_temperature": 1, "climate.turn_off": 1, "light.turn_on": 1, "script.*": 1} and sch["action"]["entity_id_null"] == 1
    assert sch["action"]["service_data_keys"] == ["brightness", "hvac_mode", "temperature"], "a script's variable names are not listed"
    assert sch["unnamed"] == 1 and sch["with_dates"] == 1 and sch["with_tags"] == 1 and sch["timestamps_and_next_entries_aligned"] == 2
    assert summary["tags"] == {"count": 1, "keys": {"always": ["name", "schedules"], "keys": ["name", "schedules"], "sometimes": []}, "ok": True, "types": {"name": ["str"], "schedules": ["list"]}}
    sw = summary["switches"]
    assert sw["count"] == 2 and sw["state"] == {"off": 1, "on": 1} and sw["matched_to_an_item_by_entity_id"] == 2
    assert sw["timeslots_attribute_forms"] == {"HH:MM:SS - HH:MM:SS": 2, "<str>": 2}, "sun-form strings are recorded as unrecognised, not echoed"
    assert summary["first_item"]["keys"]["timeslots"] == "list" and summary["first_item"]["switch_attributes"]["next_trigger"] == "str"
    reg = summary["registry"]
    assert reg["scheduler_rows"] == 2 and reg["unique_id_equals_a_schedule_id"] == 2 and reg["with_area_id"] == 0 and reg["with_device_id"] == 2 and reg["domains"] == {"switch": 2}
    ev = summary["scheduler_updated"]
    assert ev["subscription"] == "success" and ev["events"] == 1 and ev["shapes"][0]["event"]["event"] == "item_updated" and ev["shapes"][0]["_count"] == 1
    assert summary["non_admin"] == {"scheduler": "unauthorized", "scheduler/tags": "unauthorized", "scheduler/item": "unauthorized", "get_services": "success", "get_states": "success", "config/entity_registry/list": "success"}
    assert guest.sent[0]["access_token"] == GUEST and conn.sent[0]["access_token"] == TOKEN, "each connection uses its own token"


def test_without_the_optional_parts_they_are_skipped(tmp_path, capsys):
    conn = FakeConn()
    code, text = run([str(env_file(tmp_path))], [conn], capsys)
    assert code == 0 and "scheduler_updated" not in {m["type"] for m in conn.sent}
    summary = json.loads(text[text.index("{"):text.rindex("}") + 1])
    assert summary["scheduler_updated"] == {"skipped": True} and summary["non_admin"] == {"skipped": True}
    assert_clean(text)
    # a named variable that is not set: skipped, and said so by NAME only
    conn2 = FakeConn()
    code, text = run([str(env_file(tmp_path)), "--non-admin-token-var", "NOT_SET_ANYWHERE"], [conn2], capsys)
    assert code == 0 and "NOT_SET_ANYWHERE" in text and "skipped" in text
    assert len(conn2.sent) == 1 + 8, "one connection only: auth plus the eight reads"
    assert_clean(text)


def test_component_missing_and_empty_installations_are_reported_not_crashed(tmp_path, capsys):
    conn = FakeConn(scheduler_installed=False, services={"other": {}})
    code, text = run([str(env_file(tmp_path))], [conn], capsys)
    summary = json.loads(text[text.index("{"):text.rindex("}") + 1])
    assert code == 0 and summary["scheduler"] == {"ok": False, "error": "unknown_command"} and summary["services"] == {"registered": False}
    assert summary["manifest"]["ok"] is False and summary["switches"]["count"] == 2  # states are read whatever the component says
    empty = FakeConn(items=[])
    code, text = run([str(env_file(tmp_path))], [empty], capsys)
    summary = json.loads(text[text.index("{"):text.rindex("}") + 1])
    assert code == 0 and summary["scheduler"]["count"] == 0 and "first_item" not in summary


# ---------------------------------------------------------------- failures never echo secrets


def test_refused_auth_and_broken_connections_print_neither_token_nor_host(tmp_path, capsys):
    code, text = run([str(env_file(tmp_path))], [FakeConn(token_ok=False)], capsys)
    assert code == 2 and "auth: refused" in text
    assert_clean(text)
    code, text = run([str(env_file(tmp_path))], [RuntimeError(f"cannot reach {HOST} with {TOKEN}")], capsys)
    assert code == 2 and "RuntimeError" in text
    assert_clean(text)
    # a missing env file, a missing token, a URL that is not http(s)
    code, text = run([str(tmp_path / "nope.env")], [], capsys)
    assert code == 2
    bare = tmp_path / "bare.env"
    bare.write_text("SW_PROBE_HA_URL=" + HOST + "\n", encoding="utf-8")
    code, text = run([str(bare)], [], capsys)
    assert code == 2 and "variable is missing" in text
    assert_clean(text)
    weird = tmp_path / "weird.env"
    weird.write_text("SW_PROBE_HA_URL=ftp://ha-sentinel.example.test\nSW_PROBE_HA_TOKEN=" + TOKEN + "\n", encoding="utf-8")
    code, text = run([str(weird)], [], capsys)
    assert code == 2 and "http" in text
    assert_clean(text)


def test_variable_names_can_be_chosen_and_values_come_from_the_file_or_the_environment(tmp_path, monkeypatch):
    p = tmp_path / "custom.env"
    p.write_text("MY_URL=" + HOST + "\nMY_TOKEN='" + TOKEN + "'\n", encoding="utf-8")
    env = probe.read_env_file(p)
    assert env == {"MY_URL": HOST, "MY_TOKEN": TOKEN}
    monkeypatch.setenv("ONLY_IN_PROCESS_ENV", "from-process")
    assert probe.pick(env, ["MISSING", "MY_URL"]) == HOST and probe.pick(env, ["ONLY_IN_PROCESS_ENV"]) == "from-process" and probe.pick(env, ["NOPE"]) is None
    conn = FakeConn()
    code, _ = run([str(p), "--url-var", "MY_URL", "--token-var", "MY_TOKEN"], [conn])
    assert code == 0 and conn.sent[0]["access_token"] == TOKEN


# ---------------------------------------------------------------- raw output only inside private-evidence/


def test_raw_answers_go_only_inside_private_evidence(tmp_path, monkeypatch, capsys):
    monkeypatch.setattr(probe, "PRIVATE_EVIDENCE", tmp_path / "private-evidence")
    outside = tmp_path / "elsewhere"
    conn = FakeConn()
    code, text = run([str(env_file(tmp_path)), "--out", str(outside)], [conn], capsys)
    assert code == 2 and "private-evidence" in text and not outside.exists() and conn.sent == [], "refused before connecting"
    target = tmp_path / "private-evidence" / "scheduler-probe-test"
    code, text = run([str(env_file(tmp_path)), "--out", str(target)], [FakeConn()], capsys)
    assert code == 0
    assert sorted(p.name for p in target.iterdir()) == sorted(["services.json", "schedules.json", "items.json", "tags.json", "switch_states.json", "registry.json", "events.json", "summary.json"])
    assert "SECRETNAME" in (target / "items.json").read_text(encoding="utf-8"), "the raw dump does hold the names (that is why it stays private)"
    summary_file = (target / "summary.json").read_text(encoding="utf-8")
    assert_clean(summary_file)
    assert_clean(text)
    traversal = tmp_path / "private-evidence" / ".." / "elsewhere2"
    code, text = run([str(env_file(tmp_path)), "--out", str(traversal)], [FakeConn()], capsys)
    assert code == 2 and not (tmp_path / "elsewhere2").exists()


def test_the_real_private_evidence_folder_is_the_git_ignored_one():
    assert probe.PRIVATE_EVIDENCE == ROOT / "private-evidence"
    ignore = (ROOT / ".gitignore").read_text(encoding="utf-8")
    assert "private-evidence" in ignore


# ---------------------------------------------------------------- structure helpers on odd shapes


def test_summaries_survive_odd_shapes_and_never_echo_values():
    weird = [{"schedule_id": "zz", "weekdays": "daily", "timeslots": [{"start": 5, "stop": "later", "conditions": [{"match_type": "SECRETNAME", "value": "SECRETNAME", "attribute": "SECRETNAME"}],
                                                                        "condition_type": "SECRETNAME", "actions": [{"service": "SECRETNAME", "entity_id": 7, "service_data": {"SECRETNAME": 1}}]}], "repeat_type": "SECRETNAME"}]
    out = json.dumps(probe.summarize_items(weird))
    assert "SECRETNAME" not in out and "<str>" in out and "<int>" in out
    assert probe.summarize_items([])["count"] == 0
    assert probe.summarize_switches([{"entity_id": "switch.schedule_x", "state": "SECRETNAME", "attributes": None}], [])["state"] == {"<str>": 1}
    assert "SECRETNAME" not in json.dumps(probe.frame_shape({"id": 1, "type": "event", "event": {"event": "SECRETNAME", "schedule_id": "SECRETNAME", "nested": [{"a": "SECRETNAME"}]}}))
    assert probe.time_kind("sunset+00:30:00") == "sunset+HH:MM:SS" and probe.time_kind("sunrise-01:00:00") == "sunrise-HH:MM:SS" and probe.time_kind(None) == "null" and probe.time_kind("6:00") == "<str>"
    assert probe.service_label("script.mine") == "script.*" and probe.service_label("custom.thing") == "other.*" and probe.service_label("light.turn_on") == "light.turn_on" and probe.service_label(None) == "<null>"


def test_the_script_source_has_no_write_capable_message_type_or_secret_printing():
    tree = ast.parse((ROOT / "scripts" / "scheduler_phase0_probe.py").read_text(encoding="utf-8"))
    forbidden = {"call_service", "subscribe_events", "subscribe_entities", "supervisor/api", "config/entity_registry/update", "config/entity_registry/remove", "hassio", "fire_event", "render_template"}
    strings = {n.value for n in ast.walk(tree) if isinstance(n, ast.Constant) and isinstance(n.value, str)}
    assert not (strings & forbidden), strings & forbidden
    # every conn.send in the script sits behind guard(): the only send sites are Session.authenticate / call / subscribe
    sites = []
    for fn in [n for n in ast.walk(tree) if isinstance(n, (ast.AsyncFunctionDef, ast.FunctionDef))]:
        for c in ast.walk(fn):
            if isinstance(c, ast.Call) and isinstance(c.func, ast.Attribute) and c.func.attr == "send" and "conn" in ast.unparse(c.func.value):
                sites.append(fn.name)
    assert sorted(set(sites)) == ["authenticate", "call", "subscribe"], sites
    for name in ("authenticate", "call", "subscribe"):
        fn = next(n for n in ast.walk(tree) if isinstance(n, ast.AsyncFunctionDef) and n.name == name)
        assert any(isinstance(c, ast.Call) and ast.unparse(c.func) == "guard" for c in ast.walk(fn)), f"{name} must call guard() before sending"
