"""CR-017 phase 0: scripts/automations_probe.py is READ-ONLY by default (an allow-list of WebSocket message types and of REST GETs, refused before anything is
sent), prints structure only (no token, host, alias, entity id, template or secret), reads its variables by NAME from an env file, writes raw answers only inside
private-evidence/, and its one write path (`--write-check --confirm-throwaway-write`) touches `arx_probe_` items only and always deletes what it created.
Everything runs against the fake Home Assistant of tests/fake_ha_config.py: no network."""
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
import automations_probe as probe  # noqa: E402

from fake_ha_config import FakeHaConfig  # noqa: E402

TOKEN = "TOKEN-SENTINEL-9f3a17"
GUEST = "GUEST-SENTINEL-77c2e0"
HOST = "http://ha-sentinel.example.test:8123"
SCENE_ENTITY = "light.sentinel_scene_member"
# nothing from the system may appear in the printed output: tokens, host, aliases, entity ids, a template, a stored secret, an area
SECRETS = [TOKEN, GUEST, "ha-sentinel", "sentinel_scene_member", "test-key-not-real", "תנועה בפרוזדור", "תאורה בכניסה", "hall_motion", "light.hall", "alarm_control_panel.home", "person.yoni",
           "trigger.to_state", "states('sensor.lux')", "mobile_app_yoni", "שקיעה", "דלת"]


class FakeConn:
    """A scripted Home Assistant WebSocket over the FakeHaConfig: answers by message type, records everything sent."""

    def __init__(self, fake: FakeHaConfig, *, admin: bool = True, token_ok: bool = True, user_id: str | None = None) -> None:
        self.fake, self.admin, self.token_ok, self.user_id = fake, admin, token_ok, user_id
        self.sent: list[dict] = []
        self.queue: list[dict] = [{"type": "auth_required", "ha_version": fake.ha_version}]
        self.closed = False

    async def send(self, obj):
        self.sent.append(copy.deepcopy(obj))
        if obj.get("type") == "auth":
            self.queue.append({"type": "auth_ok" if self.token_ok else "auth_invalid"})
            return
        frame = self.fake.ws({**obj, "_user_id": self.user_id}, admin=self.admin)
        self.queue.append({"id": obj["id"], "type": "result", **frame})

    async def recv(self, timeout=None):
        return self.queue.pop(0) if self.queue else None

    async def close(self):
        self.closed = True


class FakeRest:
    def __init__(self, fake: FakeHaConfig, admin: bool = True) -> None:
        self.fake, self.admin = fake, admin
        self.calls: list[tuple[str, str]] = []

    def request(self, method, path, body=None):
        self.calls.append((method, path))
        return self.fake.rest(method, path, body, admin=self.admin)


def run(coro):
    return asyncio.run(coro)


async def session_for(fake, **kw):
    conn = FakeConn(fake, **{k: v for k, v in kw.items() if k in ("admin", "token_ok", "user_id")})
    s = probe.Session(conn, write_ok=kw.get("write_ok", False))
    assert await s.authenticate(TOKEN)
    return s, conn


@pytest.fixture()
def fake():
    return FakeHaConfig.seed_probe_like()


# ---------------------------------------------------------------- read-only by construction

def test_the_guards_refuse_everything_outside_the_read_only_surface():
    for t in ("call_service", "subscribe_events", "automation/trigger", "config/automation/config/x", "execute_script", "supervisor/api", "persistent_notification/dismiss", "config/entity_registry/update"):
        with pytest.raises(probe.ProbeRefused):
            probe.guard_ws(t)
    probe.guard_ws("trace/get")
    with pytest.raises(probe.ProbeRefused):
        probe.guard_ws("subscribe_events", write_ok=True)  # even a write check cannot subscribe or execute scripts
    probe.guard_ws("call_service", write_ok=True)
    probe.guard_rest("GET", "/api/config/automation/config/1727700000002")
    probe.guard_rest("GET", "/api/config/script/config/good_morning")
    for method, path in (("POST", "/api/config/automation/config/arx_probe_1"), ("DELETE", "/api/config/automation/config/arx_probe_1"), ("GET", "/api/states"), ("GET", "/api/config/core/config"),
                         ("GET", "/api/config/automation/config/../x"), ("PUT", "/api/config/automation/config/x"), ("GET", "/api/services/light/turn_on")):
        with pytest.raises(probe.ProbeRefused):
            probe.guard_rest(method, path)
    probe.guard_rest("POST", "/api/config/automation/config/arx_probe_1", write_ok=True)
    probe.guard_rest("DELETE", "/api/config/script/config/arx_probe_9", write_ok=True)
    for method, path in (("POST", "/api/config/automation/config/1727700000002"), ("DELETE", "/api/config/script/config/good_morning"), ("POST", "/api/config/scene/config/x")):
        with pytest.raises(probe.ProbeRefused):
            probe.guard_rest(method, path, write_ok=True)  # a write names a throwaway id or is refused
    # service calls: never without --write-check, only the listed ones, only on throwaway items
    with pytest.raises(probe.ProbeRefused):
        probe.guard_call("automation", "turn_off", {"entity_id": "automation.arx_probe_x"}, write_ok=False)
    for dom, svc, data in (("light", "turn_on", {"entity_id": "light.arx_probe_x"}), ("homeassistant", "restart", {}), ("automation", "turn_off", {"entity_id": "automation.hall_motion"}),
                           ("automation", "trigger", {}), ("script", "turn_on", {"entity_id": ["script.arx_probe_a", "script.good_morning"]}), ("automation", "reload", {"id": "1727700000002"}), ("automation", "reload", {})):
        with pytest.raises(probe.ProbeRefused):
            probe.guard_call(dom, svc, data, write_ok=True)
    probe.guard_call("automation", "turn_off", {"entity_id": "automation.arx_probe_throwaway"}, write_ok=True)
    probe.guard_call("automation", "reload", {"id": "arx_probe_1"}, write_ok=True)
    probe.guard_call("script", "reload", {}, write_ok=True)


def test_a_session_refuses_a_forbidden_message_before_it_is_sent(fake):
    async def go():
        s, conn = await session_for(fake)
        before = len(conn.sent)
        with pytest.raises(probe.ProbeRefused):
            await s.call("call_service", domain="automation", service="turn_off", service_data={"entity_id": "automation.hall_motion"})
        with pytest.raises(probe.ProbeRefused):
            await s.call("subscribe_events", event_type="state_changed")
        assert len(conn.sent) == before  # nothing went out

        w, wconn = await session_for(fake, write_ok=True)
        with pytest.raises(probe.ProbeRefused):
            await w.call("call_service", domain="automation", service="turn_off", service_data={"entity_id": "automation.hall_motion"})  # a real item, even in write mode

    run(go())


def test_the_read_only_probe_sends_only_allow_listed_types_and_only_get_requests(fake):
    async def go():
        s, conn = await session_for(fake)
        rest = FakeRest(fake)
        result = await probe.run_probe(s, rest)
        return s, conn, rest, result

    s, conn, rest, result = run(go())
    assert set(s.sent_types) <= probe.ALLOWED_WS_TYPES and "call_service" not in s.sent_types
    assert {m["type"] for m in conn.sent} <= probe.ALLOWED_WS_TYPES
    assert rest.calls and {m for m, _p in rest.calls} == {"GET"}
    assert fake.calls == [] and fake.events == [] and len(fake.automations) == 44  # nothing was called, nothing changed
    assert all(p.startswith("/api/config/") for _m, p in rest.calls)


# ---------------------------------------------------------------- what it reports

@pytest.fixture()
def report(fake):
    async def go():
        s, _conn = await session_for(fake)
        return await probe.run_probe(s, FakeRest(fake))

    return run(go())["summary"]


def test_the_summary_answers_u1_to_u9(report, fake):
    c = report["counts"]
    assert c["automation"]["entities"] == 46 and c["script"]["entities"] == 9 and c["scene"]["entities"] == 21
    assert c["automation"]["without_id_attribute"] == 1 and c["scene"]["without_id_attribute"] == 20
    assert c["registry"]["automation"]["platform"] == {"automation": 45, "<none>": 1}
    assert c["registry"]["scene"]["platform"] == {"<integration>": 20, "homeassistant": 1}
    api = report["u1_u2_config_api"]
    assert api["automation"]["read"] == 44 and api["automation"]["get_status"] == {"200": 44, "404": 1}  # the YAML-managed one answers 404
    assert api["automation"]["first_key"] == {"id": 44} and api["automation"]["with_id_key"] == 44
    assert api["script"]["read"] == 9 and api["script"]["first_key"] == {"alias": 9} and api["script"]["with_id_key"] == 0  # a script's config has no id
    assert api["script"]["field_selector_kinds"] == {"boolean": 1, "entity": 1, "number": 1, "select": 1}
    assert api["scene"]["read"] == 1 and api["scene"]["first_key"] == {"id": 1}
    assert api["automation"]["schema"]["old_keys"] == 2 and api["automation"]["schema"]["new_keys"] == 42 and api["automation"]["schema"]["mixed"] == 0
    assert api["automation"]["extra_top_level_keys"] == ["initial_state", "note", "trace", "trigger_variables", "variables"]
    assert api["unmanaged_by_ui"]["automation"] == 1 and api["files"]["status"] == "NOT_OBSERVABLE"
    assert report["u2_ws_vs_rest"] == {"automation": "equal", "script": "equal"}
    assert report["config"]["sub_components_listed"] == {"config.automation": False, "config.script": False, "config.scene": False}  # the probe's finding: never gate on the components list
    v = report["u3_validation"]
    assert v["valid_request"]["triggers"] == {"valid": True, "error": None} and v["invalid_request"]["triggers"] == {"valid": False, "error_kind": "Invalid trigger … specified"}
    assert report["u4_secrets"]["items_with_secret_like_keys"] == 1 and report["u4_secrets"]["strings_that_look_like_an_unresolved_tag"] == 0
    assert report["u5_include_line"]["status"] == "NOT_OBSERVABLE" and report["u6_render_template"]["command"] == "success"
    tr = report["u7_traces"]["automation"]
    assert tr["runs_listed"] > 0 and tr["get"]["path_patterns"]["trigger/N"] >= 1 and tr["get"]["path_patterns"]["action/N"] >= 1 and tr["get"]["context"] == {"id": "str", "parent_id": "null", "user_id": "null"}
    assert tr["get"]["result_keys"] and "changed_variables_names" in tr["get"] and tr["get"]["step"]["unknown_keys"] == []
    s8 = report["u8_services"]
    assert s8["automation_reload_takes_id"] is False or s8["registered"]  # the fake's get_services has no field detail; the flags are booleans
    assert s8["services"]["scene.create"] is not None and s8["admin_status"].startswith("NOT_OBSERVABLE")
    u9 = report["u9_purpose_specific_triggers"]
    assert u9["count"] == 1 and u9["triggers"] == {"switch.turned_on": 1} and u9["options_keys"] == ["behavior"] and u9["target_forms"] == {"dict": 1}
    assert report["u10_non_admin_call"]["status"] == "NOT_TESTABLE_READ_ONLY"
    assert report["registries"]["labels"]["count"] == 1 and report["registries"]["floors"]["count"] == 3


def test_the_printed_summary_contains_structure_only(fake, env_file):
    lines: list[str] = []
    args = _args(env_file=env_file)
    assert run(probe.main_async(args, open_connection=_opener(fake), make_rest=lambda u, t: FakeRest(fake), log=lines.append)) == 0
    out = "\n".join(lines)
    for s in SECRETS:
        assert s not in out, s
    assert "auth: ok (read-only probe)" in out and '"u9_purpose_specific_triggers"' in out


def _args(**kw):
    ns = argparse.Namespace(env_file=str(kw.pop("env_file")) if "env_file" in kw else None, url_var=None, token_var=None, non_admin_token_var=None, rest_prefix="/api", ws_path="/api/websocket", max_items=200,
                            out=None, write_check=False, confirm_throwaway_write=False, scene_entity_var=None)
    for k, v in kw.items():
        setattr(ns, k, v)
    return ns


def _opener(fake, guest_fake=None):
    conns = []

    async def open_connection(url):
        # the first connection is the administrator's, a second one (when asked for) the non-administrator's
        c = FakeConn(fake, admin=not conns, user_id=None if not conns else "u-guest")
        conns.append(c)
        return c

    open_connection.conns = conns  # type: ignore[attr-defined]
    return open_connection


@pytest.fixture()
def env_file(tmp_path):
    p = tmp_path / "probe.env"
    p.write_text(f"SW_PROBE_HA_URL={HOST}\nSW_PROBE_HA_TOKEN={TOKEN}\nGUEST_TOKEN={GUEST}\nSCENE_MEMBER={SCENE_ENTITY}\n", encoding="utf-8")
    return p


def test_main_reads_variables_by_name_prints_no_secret_and_refuses_bad_input(fake, env_file, tmp_path):
    lines: list[str] = []
    assert run(probe.main_async(_args(env_file=env_file), open_connection=_opener(fake), make_rest=lambda u, t: FakeRest(fake), log=lines.append)) == 0
    assert all(s not in "\n".join(lines) for s in (TOKEN, HOST, "ha-sentinel"))
    assert run(probe.main_async(_args(env_file=tmp_path / "nope.env"), open_connection=_opener(fake), log=lines.append)) == 2
    bad = tmp_path / "bad.env"
    bad.write_text("SW_PROBE_HA_URL=ftp://x\nSW_PROBE_HA_TOKEN=t\n", encoding="utf-8")
    assert run(probe.main_async(_args(env_file=bad), open_connection=_opener(fake), log=lines.append)) == 2
    missing = tmp_path / "missing.env"
    missing.write_text("SW_PROBE_HA_URL=http://x\n", encoding="utf-8")
    assert run(probe.main_async(_args(env_file=missing), open_connection=_opener(fake), log=lines.append)) == 2
    # --out only inside private-evidence/
    assert run(probe.main_async(_args(env_file=env_file, out=str(tmp_path / "elsewhere")), open_connection=_opener(fake), log=lines.append)) == 2
    # a refused token
    refusing = FakeConn(fake, token_ok=False)

    async def opener(url):
        return refusing

    assert run(probe.main_async(_args(env_file=env_file), open_connection=opener, make_rest=lambda u, t: FakeRest(fake), log=lines.append)) == 2
    # a failure is reported by class name only
    class Boom(Exception):
        pass

    async def explode(url):
        raise Boom(f"cannot reach {HOST} with {TOKEN}")

    lines.clear()
    assert run(probe.main_async(_args(env_file=env_file), open_connection=explode, log=lines.append)) == 2
    assert lines[-1] == "probe failed: Boom" and TOKEN not in "\n".join(lines)


def test_raw_answers_are_written_only_inside_private_evidence(fake, env_file, monkeypatch, tmp_path):
    root = tmp_path / "private-evidence"
    monkeypatch.setattr(probe, "PRIVATE_EVIDENCE", root)
    out = root / "automations-probe"
    lines: list[str] = []
    assert run(probe.main_async(_args(env_file=env_file, out=str(out)), open_connection=_opener(fake), make_rest=lambda u, t: FakeRest(fake), log=lines.append)) == 0
    assert (out / "summary.json").is_file() and (out / "configs.json").is_file() and (out / "states.json").is_file()
    assert "תנועה בפרוזדור" in (out / "configs.json").read_text(encoding="utf-8")  # the raw files hold names: that is why they live in the git-ignored folder
    assert "תנועה בפרוזדור" not in (out / "summary.json").read_text(encoding="utf-8") and "hall_motion" not in (out / "summary.json").read_text(encoding="utf-8")
    assert probe.safe_out_dir(str(out)) == out.resolve()
    with pytest.raises(probe.ProbeError):
        probe.safe_out_dir(str(tmp_path / "x"))


def test_the_non_admin_read_half_records_only_success_or_a_short_code(fake, env_file):
    lines: list[str] = []
    opener = _opener(fake)
    args = _args(env_file=env_file, non_admin_token_var="GUEST_TOKEN")
    assert run(probe.main_async(args, open_connection=opener, make_rest=lambda u, t: FakeRest(fake), log=lines.append)) == 0
    out = "\n".join(lines)
    assert GUEST not in out and len(opener.conns) == 2
    summary = json.loads(out[out.index("{"):])
    reads = summary["u10_non_admin_reads"]
    assert reads["get_states"] == "success" and reads["render_template"] == "success" and reads["trace/list"] == "unauthorized" and reads["validate_config"] == "unauthorized"
    assert set(reads) == {t for t, _f in probe.READ_TRIES_NON_ADMIN}


# ---------------------------------------------------------------- the opt-in write check

def test_write_check_needs_both_flags_and_the_read_only_run_never_writes(fake, env_file):
    lines: list[str] = []
    assert run(probe.main_async(_args(env_file=env_file, write_check=True), open_connection=_opener(fake), make_rest=lambda u, t: FakeRest(fake), log=lines.append)) == 2
    assert "--confirm-throwaway-write" in lines[-1]
    assert fake.rest_calls == [] and fake.calls == []


def test_write_check_creates_throwaway_items_checks_the_stored_form_and_always_cleans_up(fake, env_file):
    before_auto, before_scripts = len(fake.automations), set(fake.scripts)
    lines: list[str] = []
    opener = _opener(fake)
    args = _args(env_file=env_file, write_check=True, confirm_throwaway_write=True, scene_entity_var="SCENE_MEMBER", non_admin_token_var="GUEST_TOKEN")
    rest = FakeRest(fake)
    assert run(probe.main_async(args, open_connection=opener, make_rest=lambda u, t: rest, log=lines.append)) == 0
    out = "\n".join(lines)
    summary = json.loads(out[out.index("{"):])
    w = summary["write_check"]
    assert w["w1_automation"]["post_status"] == "200" and w["w1_automation"]["get_status"] == "200" and w["w1_automation"]["entity_after_reload"] is True
    assert w["w1_automation"]["stored_form"] == {"same_content": True, "key_order_kept": True, "id_first": True, "added_keys": [], "dropped_keys": []}
    assert w["w1_automation"]["equals_what_the_bridge_writer_emits"] is True and w["w1_automation"]["attribute_id_equals_config_id"] is True
    assert w["w1_automation"]["update_status"] == "200" and w["w1_automation"]["entity_same_after_update"] is True
    assert w["w2_script"]["entity_after_reload"] is True and w["w2_script"]["stored_form"]["same_content"] is True and w["w2_scene"]["entity_after_reload"] is True
    assert w["error_shapes"] == {"get_unknown": "404", "delete_unknown": "400"}
    assert w["u10_non_admin_call"]["automation.turn_off"] == "success" and w["u10_non_admin_call"]["automation.trigger"] == "success"
    assert w["cleanup"]["left_behind"] == 0 and w["cleanup"]["delete_automation"] == "200"
    # nothing of the throwaway survives, and nothing else changed
    assert len(fake.automations) == before_auto and set(fake.scripts) == before_scripts and not any("arx_probe_" in str(r["unique_id"]) for r in fake.registry)
    assert not any(c["data"].get("entity_id") and "arx_probe_" not in str(c["data"]["entity_id"]) for c in fake.calls if c["service"] not in ("reload",))
    assert all(("arx_probe_" in p) for m, p in rest.calls if m in ("POST", "DELETE"))
    assert TOKEN not in out and GUEST not in out and SCENE_ENTITY not in out


def test_write_check_deletes_what_it_created_even_when_a_step_fails(fake):
    async def go():
        s, _c = await session_for(fake, write_ok=True)
        rest = FakeRest(fake)
        orig = fake.ws

        def broken(msg, admin=True):  # the reload call fails midway
            if msg.get("type") == "call_service":
                raise RuntimeError("boom")
            return orig(msg, admin=admin)

        fake.ws = broken  # type: ignore[method-assign]
        with pytest.raises(RuntimeError):
            await probe.run_write_check(s, rest)
        fake.ws = orig  # type: ignore[method-assign]
        return rest

    rest = run(go())
    assert not any(a.get("id", "").startswith("arx_probe_") for a in fake.automations)  # the finally block deleted the throwaway automation
    assert any(m == "DELETE" for m, _p in rest.calls)


def test_a_write_check_cannot_reach_a_real_item_by_any_path(fake):
    async def go():
        s, _c = await session_for(fake, write_ok=True)
        rest = FakeRest(fake)
        guarded = probe.GuardedRest(rest, write_ok=True)
        # every REST request of both runs goes through this wrapper: a POST / DELETE of a real id never reaches the transport
        for method, path in (("POST", "/api/config/automation/config/1727700000002"), ("DELETE", "/api/config/automation/config/1727700000002"), ("DELETE", "/api/config/script/config/good_morning")):
            with pytest.raises(probe.ProbeRefused):
                guarded.request(method, path, {})
        assert rest.calls == [] and len(fake.automations) == 44
        with pytest.raises(probe.ProbeRefused):
            probe.GuardedRest(rest, write_ok=False).request("POST", "/api/config/automation/config/arx_probe_1", {})  # a read-only run cannot even write a throwaway
        assert guarded.request("GET", "/api/config/automation/config/1727700000002")[0] == 200
        return rest

    run(go())


def test_the_script_is_standard_library_only_and_names_no_service_but_the_throwaway_ones():
    text = (ROOT / "scripts" / "automations_probe.py").read_text(encoding="utf-8")
    tree = ast.parse(text)
    imports = {n.names[0].name.split(".")[0] for n in ast.walk(tree) if isinstance(n, ast.Import)} | {n.module.split(".")[0] for n in ast.walk(tree) if isinstance(n, ast.ImportFrom) and n.module}
    assert imports <= {"__future__", "argparse", "asyncio", "collections", "json", "os", "re", "sys", "time", "urllib", "pathlib", "typing", "websockets"}, imports  # no `requests`, no project import
    assert probe.THROWAWAY_CALLS == {("automation", "reload"), ("script", "reload"), ("scene", "reload"), ("automation", "turn_on"), ("automation", "turn_off"), ("automation", "trigger"),
                                     ("script", "turn_on"), ("script", "turn_off")}
    assert "homeassistant.restart" not in text and "hassio" not in text and "execute_script" not in text
    assert probe.WRITE_WS_TYPES == {"call_service"} and "call_service" not in probe.ALLOWED_WS_TYPES
