"""DOOR-BRIDGE-BLOCK-2404 (CR-033 slice D5a, WXD5A; gate row T24 bridge side, WXD11): bridge 0.10.5 refuses `execute` door services on
WisKey doors unless the administrator setting allows it.

Fakes only - no Home Assistant, no WisKey, no door. Three layers:
1. the rule module itself (custom_components/smplwise_bridge/wiskey_door_block.py, loaded from the canonical source);
2. the REAL bridge (`async_setup_entry`, the `execute` handler, the options listener, the directory push) under the key-rotation
   harness (tests/keyrot_harness.py) with a fake entity registry, states, services and event bus - T24 as CR-033 11.3 defines it:
   refused under `blocked`, allowed under `allowed`, an unknown registry entry refused, the policy changed without an entry reload;
3. the add-on: a tile command the add-on's own guard lets through (its mirror is stale) is refused by the REAL bridge and recorded as a
   failed action; the bridge's reported policy is recorded and audited; the options form offers the setting with `blocked` first.
"""
from __future__ import annotations

import ast
import asyncio
import json
import logging
import uuid
from types import SimpleNamespace
from typing import Any

import pytest
from fastapi.testclient import TestClient

import bridge_loader
import keyrot_harness as kh
from smplwise.db import Database, get_setting, set_setting
from smplwise.main import create_app
from smplwise.services import backup, door_execute_guard, ha_bridge, ha_client

REPO = bridge_loader.REPO
SRC, MIRROR = bridge_loader.SRC, bridge_loader.MIRROR
BLOCK = bridge_loader.load("wiskey_door_block")
CODE = "wiskey_door_execute_blocked"
UID = "a" * 32  # a synthetic Home Assistant user id
PAIRING = "synthetic-pairing-code-2404"


# ================================================================ fakes

class Reg:
    """Home Assistant's entity registry as the bridge reads it: `async_get(entity_id)` and `entities` (a mapping)."""

    def __init__(self, rows: dict[str, str]) -> None:
        self.entities = {eid: SimpleNamespace(entity_id=eid, platform=platform, unique_id="u-" + eid) for eid, platform in rows.items()}

    def async_get(self, entity_id: str) -> Any:
        return self.entities.get(entity_id)


WORLD = {
    "lock.entrance": "hikvision_intercom",
    "lock.side": "smplwise_intercom",
    "button.entrance_open": "hikvision_intercom",
    "lock.office": "nuki",
    "lock.all_doors": "group",
    "lock.ordinary_group": "group",
    "light.hall": "hue",
}
GROUPS = {"lock.all_doors": ["lock.office", "lock.entrance"], "lock.ordinary_group": ["lock.office"]}


def state_of(groups: dict[str, Any]):
    def get(entity_id: str) -> Any:
        if entity_id in groups:
            return SimpleNamespace(state="locked", attributes={"entity_id": groups[entity_id]})
        return SimpleNamespace(state="locked", attributes={})
    return get


def refuse(domain: str, target: Any, rows: dict[str, str] | None = None, groups: dict[str, Any] | None = None, policy: str = "blocked") -> str | None:
    reg = Reg(WORLD if rows is None else rows)
    return BLOCK.refusal(domain, {"entity_id": target}, lambda: reg, state_of(GROUPS if groups is None else groups), policy)


# ================================================================ 1. the rule

def test_policy_is_blocked_unless_it_says_exactly_allowed():
    assert BLOCK.DEFAULT_POLICY == "blocked" and BLOCK.POLICIES == ("blocked", "allowed")
    assert BLOCK.policy({}) == "blocked" and BLOCK.policy(None) == "blocked" and BLOCK.policy("allowed") == "blocked"
    for value in ("Allowed", "ALLOWED", True, 1, "yes", "", None, ["allowed"], "allowed "):
        assert BLOCK.policy({"wiskey_execute_policy": value}) == "blocked", value
    assert BLOCK.policy({"wiskey_execute_policy": "allowed"}) == "allowed"
    assert BLOCK.CONF_WISKEY_EXECUTE_POLICY == "wiskey_execute_policy" == bridge_loader.load("const").CONF_WISKEY_EXECUTE_POLICY


def test_t24_wiskey_locks_and_buttons_are_refused_whatever_the_service():
    assert refuse("lock", "lock.entrance") == "wiskey_platform"
    assert refuse("lock", "lock.side") == "wiskey_platform", "both WisKey platforms"
    assert refuse("button", "button.entrance_open") == "wiskey_platform"
    assert refuse("lock", ["lock.office", "lock.entrance"]) == "wiskey_platform", "one WisKey door among the targets refuses the call"
    assert refuse("lock", "lock.office, lock.side") == "wiskey_platform"
    assert refuse("lock", "lock.office") is None, "an ordinary lock is unchanged"


def test_t24_a_group_with_a_wiskey_member_is_refused_an_ordinary_group_is_not():
    assert refuse("lock", "lock.all_doors") == "wiskey_group_member"
    assert refuse("lock", "lock.ordinary_group") is None
    nested = {"lock.outer": ["lock.inner"], "lock.inner": ["lock.side"]}
    assert refuse("lock", "lock.outer", rows={**WORLD, "lock.outer": "group", "lock.inner": "group"}, groups=nested) == "wiskey_group_member"
    deep = {f"lock.g{i}": [f"lock.g{i + 1}"] for i in range(6)}
    assert refuse("lock", "lock.g0", rows={**WORLD, **{f"lock.g{i}": "group" for i in range(7)}}, groups=deep) == "group_unverifiable"
    assert refuse("lock", "lock.bad_group", rows={**WORLD, "lock.bad_group": "group"}, groups={"lock.bad_group": {"x": 1}}) == "group_unverifiable"
    cyc = {"lock.a": ["lock.b"], "lock.b": ["lock.a"]}
    assert refuse("lock", "lock.a", rows={**WORLD, "lock.a": "group", "lock.b": "group"}, groups=cyc) is None, "a cycle without a door ends"


def test_t24_an_unknown_lock_is_refused_only_where_wiskey_exists():
    assert refuse("lock", "lock.yaml_only") == "unknown_lock"
    assert refuse("lock", "lock.ordinary_group", groups={"lock.ordinary_group": ["lock.yaml_only"]}) == "unknown_lock"
    plain = {"lock.office": "nuki", "lock.ordinary_group": "group"}
    assert refuse("lock", "lock.yaml_only", rows=plain) is None, "no WisKey entity at all: an unregistered lock is left to Home Assistant"
    assert refuse("lock", "lock.bad_group", rows={**plain, "lock.bad_group": "group"}, groups={"lock.bad_group": 5}) is None
    assert refuse("button", "button.unregistered") is None, "an unknown button is not a lock"


def test_t24_allowed_lets_every_door_through_and_other_domains_are_never_judged():
    for target in ("lock.entrance", "lock.all_doors", "lock.yaml_only"):
        assert refuse("lock", target, policy="allowed") is None
    assert refuse("button", "button.entrance_open", policy="allowed") is None

    def broken() -> Any:
        raise RuntimeError("registry not loaded")

    for domain in ("light", "switch", "cover", "script", "scene", "alarm_control_panel", "media_player"):
        assert BLOCK.refusal(domain, {"entity_id": "lock.entrance"}, broken, state_of({}), "blocked") is None, domain
    assert BLOCK.refusal("lock", {"entity_id": "lock.office"}, broken, state_of({}), "blocked") == "registry_unavailable", "fail closed"

    def bad_state(_eid: str) -> Any:
        raise RuntimeError("state machine")

    assert BLOCK.refusal("lock", {"entity_id": "lock.office"}, lambda: Reg(WORLD), bad_state, "blocked") == "registry_unavailable"
    assert BLOCK.refusal("lock", {}, lambda: Reg(WORLD), state_of({}), "blocked") is None, "no target: entity_required answers first"


def test_the_answer_and_the_event_carry_names_and_fixed_tokens_only():
    assert BLOCK.answer("r-1", "wiskey_platform") == {"ok": False, "request_id": "r-1", "error": CODE, "reason": "wiskey_platform"}
    ev = BLOCK.event_data("r-1", "lock", "unlock", {"entity_id": "lock.entrance", "code": "1234"}, "wiskey_platform", "blocked")
    assert ev == {"request_id": "r-1", "domain": "lock", "service": "unlock", "entity_ids": ["lock.entrance"], "reason": "wiskey_platform", "code": CODE, "policy": "blocked"}
    assert "1234" not in json.dumps(ev), "service data (an alarm / lock code) never reaches the event"


def test_sr1_the_block_module_opens_nothing_and_is_not_timer_shaped():
    text = (SRC / "wiskey_door_block.py").read_text(encoding="utf-8")
    tree = ast.parse(text)
    assert "SR-1 review" in ast.get_docstring(tree)
    names = {n.id for n in ast.walk(tree) if isinstance(n, ast.Name)} | {n.attr for n in ast.walk(tree) if isinstance(n, ast.Attribute)}
    assert not names & {"async_call", "async_track_time_interval", "async_call_later", "async_track_point_in_time", "sleep", "create_task"}
    assert not any(w in "wiskey_door_block" for w in ("watch", "scheduler", "tick", "jobs", "timer"))
    imports = [n for n in ast.walk(tree) if isinstance(n, (ast.Import, ast.ImportFrom))]
    assert all(isinstance(n, ast.ImportFrom) and (n.module in ("__future__", "collections.abc", "typing") or (n.level == 1 and n.module == "const")) for n in imports)


# ================================================================ static pins of the bridge

def _setup_and_execute() -> tuple[str, str]:
    tree = bridge_loader.init_tree()
    setup = next(n for n in ast.walk(tree) if isinstance(n, ast.AsyncFunctionDef) and n.name == "async_setup_entry")
    execute = next(n for n in ast.walk(setup) if isinstance(n, ast.AsyncFunctionDef) and n.name == "execute")
    return ast.unparse(setup), ast.unparse(execute)


def test_the_execute_handler_judges_the_door_block_before_anything_is_called():
    setup, text = _setup_and_execute()
    block = text.index("wiskey_door_block.refusal(domain, data")
    assert text.index("execute_refusal(hass, data)") < block < text.index("media_policy.is_media(domain, service)") < text.index("hass.services.async_call(domain, service, data")
    assert block < text.index("if on_behalf:"), "an Arx-only person's message is judged too"
    assert text.count("hass.services.async_call(") == 1
    assert "wiskey_door_block.policy(entry.options)" in setup, "read live from the options, never cached at setup"
    assert "'wiskey_execute_policy': door_policy()" in setup, "the directory push reports the policy"


def test_bridge_version_0_10_5_and_the_bundled_copy_is_identical():
    import importlib.util

    spec = importlib.util.spec_from_file_location("_sync_integration_2404", REPO / "scripts" / "sync_integration.py")
    sync = importlib.util.module_from_spec(spec)
    assert spec.loader is not None
    spec.loader.exec_module(sync)
    assert sync.differences() == [], "run python scripts/sync_integration.py"
    for root in (SRC, MIRROR):
        assert json.loads((root / "manifest.json").read_text(encoding="utf-8"))["version"] == "0.10.5", root
        const = (root / "const.py").read_text(encoding="utf-8")
        assert 'VERSION = "0.10.5"' in const and "DOOR-BRIDGE-BLOCK-2404" in const.split('VERSION = "0.10.5"', 1)[1].split("# 0.10.4", 1)[0]
        assert "Needs one Home Assistant restart (by the owner)" in const.split('VERSION = "0.10.5"', 1)[1].split("# 0.10.4", 1)[0]
        assert "const VERSION = '0.10.5';" in (root / "www" / "smplwise-card.js").read_text(encoding="utf-8")
        assert (root / "wiskey_door_block.py").read_bytes() == (SRC / "wiskey_door_block.py").read_bytes()


def test_the_options_form_texts_name_the_setting_in_every_language():
    for name in ("strings.json", "translations/en.json", "translations/he.json"):
        d = json.loads((SRC / name).read_text(encoding="utf-8"))
        assert d["options"]["step"]["init"]["data"]["wiskey_execute_policy"], name
        assert set(d["selector"]["wiskey_execute_policy"]["options"]) == {"blocked", "allowed"}, name
    assert json.loads((SRC / "strings.json").read_text(encoding="utf-8")) == json.loads((SRC / "translations" / "en.json").read_text(encoding="utf-8"))
    he = json.loads((SRC / "translations" / "he.json").read_text(encoding="utf-8"))
    assert he["selector"]["wiskey_execute_policy"]["options"]["blocked"] == "חסום (ברירת מחדל)"


# ================================================================ 2. the REAL bridge under the harness

class ArxStub:
    """The add-on as the bridge's directory push sees it: every POST is recorded and answered 200."""

    def __init__(self) -> None:
        self.posts: list[tuple[str, Any]] = []

    def post(self, path: str, json: Any = None) -> Any:  # noqa: A002 - the TestClient's own name
        self.posts.append((path, json))
        return SimpleNamespace(status_code=200, json=lambda: {"ok": True, "cast": None})


class Bridge:
    """The real bridge set up for one entry, with a fake registry / states / services / event bus patched in after setup."""

    def __init__(self, monkeypatch: Any, options: dict[str, Any] | None = None, rows: dict[str, str] | None = None, groups: dict[str, Any] | None = None) -> None:
        self.arx = ArxStub()
        self.side = kh.BridgeSide(lambda: self.arx, PAIRING, kh.Clock(), entry_id="01DOORBLOCK2404ENTRY00000A")
        self.mod = self.side.mod
        self.side.entry.options = dict(options or {})
        self.registry = Reg(WORLD if rows is None else rows)
        self.calls: list[dict[str, Any]] = []
        self.events: list[tuple[str, dict[str, Any], Any]] = []
        hass = self.side.hass
        assert hass is not None

        async def async_call(domain: str, service: str, data: dict[str, Any], blocking: bool = False, context: Any = None) -> None:
            self.calls.append({"domain": domain, "service": service, "data": dict(data), "user_id": getattr(context, "user_id", None)})

        async def get_user(uid: str) -> Any:
            return SimpleNamespace(id=uid, is_active=True, is_admin=False, system_generated=False, credentials=[], groups=[], name="dana")

        async def get_users() -> list[Any]:
            return []

        hass.services.async_call = async_call
        hass.auth = SimpleNamespace(async_get_user=get_user, async_get_users=get_users)
        hass.states = SimpleNamespace(get=state_of(GROUPS if groups is None else groups))
        hass.bus = SimpleNamespace(async_fire=lambda event, data, context=None: self.events.append((event, dict(data), getattr(context, "user_id", None))))
        monkeypatch.setattr(self.mod, "er", SimpleNamespace(async_get=lambda _hass: self.registry))
        monkeypatch.setattr(kh.bridge_submodule("schedule_service"), "_registry", lambda _hass: self.registry)

    def execute(self, domain: str, service: str, entity_id: Any, request_id: str | None = None) -> Any:
        body = {"user_id": UID, "domain": domain, "service": service, "data": {"entity_id": entity_id}, "request_id": request_id or f"r-{uuid.uuid4().hex[:8]}"}
        return self.side.call_service(self.mod.DOMAIN, self.mod.SERVICE_EXECUTE, self.side.signing.sign(PAIRING, body))

    def set_options(self, **options: Any) -> None:
        hass = self.side.hass
        assert hass is not None
        hass.config_entries.async_update_entry(self.side.entry, options={**self.side.entry.options, **options})
        self.side.settle()

    def pushed(self) -> list[dict[str, Any]]:
        return [body for path, body in self.arx.posts if path == "/api/v1/ha/bridge/directory"]

    def close(self) -> None:
        self.side.stop()


@pytest.fixture()
def bridge(monkeypatch):
    made: list[Bridge] = []

    def make(**kw: Any) -> Bridge:
        b = Bridge(monkeypatch, **kw)
        made.append(b)
        return b

    yield make
    for b in made:
        b.close()


def test_t24_blocked_by_default_refuses_every_wiskey_door_and_calls_nothing(bridge, caplog):
    caplog.set_level(logging.DEBUG)
    b = bridge()
    for domain, service, target, reason in (("lock", "unlock", "lock.entrance", "wiskey_platform"), ("lock", "lock", "lock.side", "wiskey_platform"),
                                            ("button", "press", "button.entrance_open", "wiskey_platform"), ("lock", "unlock", "lock.all_doors", "wiskey_group_member"),
                                            ("lock", "unlock", "lock.yaml_only", "unknown_lock")):
        rid = f"r-{domain}-{service}-{target}"
        out = b.execute(domain, service, target, rid)
        assert out == {"ok": False, "request_id": rid, "error": CODE, "reason": reason}, (target, out)
    assert b.calls == [], "nothing reached Home Assistant"
    assert [(e[0], e[1]["reason"], e[1]["policy"], e[2]) for e in b.events] == [
        ("smplwise_bridge_door_execute_refused", r, "blocked", UID) for r in ("wiskey_platform", "wiskey_platform", "wiskey_platform", "wiskey_group_member", "unknown_lock")]
    logged = [r.getMessage() for r in caplog.records if CODE in r.getMessage()]
    assert len(logged) == 5 and all("policy blocked" in m for m in logged)
    text = caplog.text + json.dumps([e[1] for e in b.events])
    assert PAIRING not in text and '"sig"' not in text and "nonce" not in text
    # an ordinary lock and every other domain are unchanged
    assert b.execute("lock", "unlock", "lock.office")["ok"] is True
    assert b.execute("light", "turn_on", "light.hall")["ok"] is True
    assert [(c["domain"], c["service"], c["data"]["entity_id"], c["user_id"]) for c in b.calls] == [("lock", "unlock", "lock.office", UID), ("light", "turn_on", "light.hall", UID)]


def test_t24_allowed_lets_the_door_through_and_the_change_needs_no_reload(bridge):
    b = bridge()
    hass = b.side.hass
    assert b.execute("lock", "unlock", "lock.entrance")["error"] == CODE
    b.set_options(wiskey_execute_policy="allowed")
    assert hass.config_entries.reloads == [], "the options change reloads nothing (a reload would revoke the WisKey capability)"
    assert b.pushed()[-1]["wiskey_execute_policy"] == "allowed", "the add-on hears the new policy at once"
    out = b.execute("lock", "unlock", "lock.entrance", "r-allowed")
    assert out["ok"] is True and out["request_id"] == "r-allowed"
    assert [(c["domain"], c["service"], c["data"]["entity_id"]) for c in b.calls] == [("lock", "unlock", "lock.entrance")]
    b.set_options(wiskey_execute_policy="Allowed")  # not exactly `allowed`: blocked again
    assert b.execute("lock", "unlock", "lock.entrance")["error"] == CODE and len(b.calls) == 1
    assert b.pushed()[-1]["wiskey_execute_policy"] == "blocked"
    b.set_options(wiskey_execute_policy="allowed")
    b.set_options(wiskey_execute_policy="blocked")
    assert b.execute("button", "press", "button.entrance_open")["error"] == CODE and len(b.calls) == 1
    assert hass.config_entries.reloads == []


def test_t24_the_first_push_reports_blocked_and_a_fresh_entry_starts_blocked(bridge):
    b = bridge()
    assert b.pushed() and b.pushed()[0]["wiskey_execute_policy"] == "blocked"
    assert "wiskey_execute_policy" not in b.side.entry.options


def test_t24_without_any_wiskey_entity_an_unregistered_lock_is_left_to_home_assistant(bridge):
    b = bridge(rows={"lock.office": "nuki"}, groups={})
    assert b.execute("lock", "unlock", "lock.yaml_only")["ok"] is True
    assert [c["data"]["entity_id"] for c in b.calls] == ["lock.yaml_only"]


def test_t24_a_registry_that_cannot_be_read_refuses_doors_only(bridge, monkeypatch):
    b = bridge()

    def boom(_hass: Any) -> Any:
        raise RuntimeError("registry not loaded")

    monkeypatch.setattr(b.mod, "er", SimpleNamespace(async_get=boom))
    out = b.execute("lock", "unlock", "lock.office")
    assert out["error"] == CODE and out["reason"] == "registry_unavailable" and b.calls == []


def test_t24_a_failing_event_bus_never_lifts_the_refusal(bridge):
    b = bridge()

    def fail(*_a: Any, **_k: Any) -> None:
        raise RuntimeError("bus closed")

    b.side.hass.bus = SimpleNamespace(async_fire=fail)
    assert b.execute("lock", "unlock", "lock.entrance")["error"] == CODE and b.calls == []


def test_t24_a_signature_failure_is_answered_before_the_block(bridge):
    b = bridge()
    body = {"user_id": UID, "domain": "lock", "service": "unlock", "data": {"entity_id": "lock.entrance"}, "request_id": "r-bad"}
    out = b.side.call_service(b.mod.DOMAIN, b.mod.SERVICE_EXECUTE, b.side.signing.sign("not-the-pairing-code", body))
    assert out["ok"] is False and out["error"] == "bad_signature" and b.events == [] and b.calls == []


# ================================================================ the options flow (Home Assistant administrator only)

def _flow_module(monkeypatch: Any) -> Any:
    import test_bridge_stale_discovery_2383 as s2383

    flow = s2383._load("config_flow")
    seen: dict[str, Any] = {}

    def select(config: Any) -> Any:
        seen["select"] = config
        return ("select", config)

    monkeypatch.setattr(flow, "selector", SimpleNamespace(EntitySelector=lambda c: ("entity", c), EntitySelectorConfig=lambda **k: k, SelectSelector=select,
                                                          SelectSelectorConfig=lambda **k: k, SelectSelectorMode=SimpleNamespace(DROPDOWN="dropdown")))
    monkeypatch.setattr(flow, "vol", SimpleNamespace(Schema=lambda d: d, Optional=lambda key, default=None, description=None: (key, default)))
    return flow, seen


def _flow(flow: Any, options: dict[str, Any]) -> Any:
    class Flow(flow.SmplwiseBridgeOptionsFlow):
        def async_show_form(self, **kw: Any) -> dict[str, Any]:
            return {"type": "form", **kw}

        def async_create_entry(self, *, title: str, data: dict[str, Any]) -> dict[str, Any]:
            return {"type": "create_entry", "data": data}

    f = Flow(SimpleNamespace(options=dict(options)))
    f.hass = SimpleNamespace(auth=SimpleNamespace(async_get_user=None))
    return f


def test_the_options_form_offers_the_policy_blocked_by_default_and_stores_it(monkeypatch):
    flow, seen = _flow_module(monkeypatch)
    form = asyncio.run(_flow(flow, {}).async_step_init())
    assert form["type"] == "form" and ("wiskey_execute_policy", "blocked") in form["data_schema"]
    assert seen["select"] == {"options": ["blocked", "allowed"], "translation_key": "wiskey_execute_policy", "mode": "dropdown"}
    form = asyncio.run(_flow(flow, {"wiskey_execute_policy": "allowed"}).async_step_init())
    assert ("wiskey_execute_policy", "allowed") in form["data_schema"]
    for typed, stored in (("allowed", "allowed"), ("blocked", "blocked"), ("open", "blocked")):
        out = asyncio.run(_flow(flow, {"delegated_authoring": False}).async_step_init({"wiskey_execute_policy": typed}))
        assert out["type"] == "create_entry" and out["data"]["wiskey_execute_policy"] == stored, typed
    out = asyncio.run(_flow(flow, {"wiskey_execute_policy": "allowed"}).async_step_init({}))
    assert out["data"]["wiskey_execute_policy"] == "allowed", "a form submitted without the field keeps the stored choice"


# ================================================================ 3. the add-on side

def _paired(settings: Any) -> tuple[TestClient, str, Database]:
    c = TestClient(create_app(settings))
    secret = c.get("/api/v1/ha/bridge/pairing").json()["pairing_code"]
    assert c.post("/api/v1/ha/bridge/ping", json=ha_bridge.sign(secret, {"version": "0.10.5"})).status_code == 200
    return c, secret, Database(settings.db_path)


def _audits(db: Database) -> list[dict[str, Any]]:
    with db.connection(mode="read") as conn:
        return [json.loads(r[0]) for r in conn.execute("SELECT details_json FROM audit_log WHERE action = 'bridge.wiskey_execute_policy_seen' ORDER BY id").fetchall()]


def test_the_add_on_records_and_audits_the_reported_policy(settings):
    c, secret, db = _paired(settings)

    def push(**extra: Any) -> None:
        r = c.post("/api/v1/ha/bridge/directory", json=ha_bridge.sign(secret, {"users": [], "version": "0.10.5", **extra}))
        assert r.status_code == 200, r.text

    push()  # an older bridge: nothing recorded
    with db.connection(mode="read") as conn:
        assert (get_setting(conn, door_execute_guard.BRIDGE_POLICY_KEY) or "") == ""
    push(wiskey_execute_policy="blocked")
    push(wiskey_execute_policy="blocked")
    push(wiskey_execute_policy="allowed")
    push(wiskey_execute_policy="something")
    assert _audits(db) == [{"policy": "blocked", "previous": None}, {"policy": "allowed", "previous": "blocked"}, {"policy": "blocked", "previous": "allowed"}]
    with db.connection(mode="read") as conn:
        assert get_setting(conn, door_execute_guard.BRIDGE_POLICY_KEY) == "blocked"
    assert door_execute_guard.BRIDGE_POLICY_KEY in backup.SETTINGS_KEEP, "runtime state: never taken from an archive"


@pytest.fixture()
def tile_world(settings, monkeypatch):
    """The add-on with an ordinary-looking lock whose mirror row is stale (the add-on's guard lets it through) while the REAL bridge's
    registry says it is a WisKey door: the bridge is the last line."""
    c = TestClient(create_app(settings))
    db = Database(settings.db_path)
    from smplwise.db import now_iso

    with db.connection() as conn:
        conn.execute("INSERT INTO ha_entities(entity_id, domain, name, platform, state, state_seen_at, first_seen_at, updated_at) VALUES (?,?,?,?,?,?,?,?)",
                     ("lock.stale_mirror", "lock", "stale", "nuki", "locked", now_iso(), now_iso(), now_iso()))
        set_setting(conn, "bridge.secret", PAIRING)
        set_setting(conn, "bridge.paired_at", now_iso())
    b = Bridge(monkeypatch, rows={**WORLD, "lock.stale_mirror": "hikvision_intercom"})
    sent: list[dict[str, Any]] = []

    def execute(_settings: Any, payload: dict[str, Any], *a: Any, **k: Any) -> Any:
        door_execute_guard.check_payload(_settings, payload)  # the add-on's own guard, exactly as ha_client runs it
        sent.append(payload)
        return b.side.call_service(b.mod.DOMAIN, b.mod.SERVICE_EXECUTE, payload)

    monkeypatch.setattr(ha_client, "call_bridge_execute", execute)
    yield {"c": c, "db": db, "bridge": b, "sent": sent}
    b.close()


def test_t24_end_to_end_the_bridge_refuses_what_a_stale_mirror_let_through(tile_world):
    c, db, b = tile_world["c"], tile_world["db"], tile_world["bridge"]
    r = c.post("/api/v1/ha/entities/lock.stale_mirror/actions", json={"allowed_action_id": "lock.lock", "client_request_id": str(uuid.uuid4()),
                                                                          "expires_at": "2099-01-01T00:00:00Z", "confirmation_grant": "confirmed"})
    assert r.status_code in (200, 202), r.text
    assert r.json()["status"] == "failed" and r.json()["error"] == CODE, r.json()
    assert len(tile_world["sent"]) == 1 and b.calls == [], "the add-on sent it once; the bridge called nothing"
    assert [e[1]["reason"] for e in b.events] == ["wiskey_platform"]
    with db.connection(mode="read") as conn:
        row = conn.execute("SELECT decision, reason FROM audit_log WHERE action = 'ha.action' AND resource_id = 'lock.stale_mirror' ORDER BY id DESC").fetchone()
    assert (row[0], row[1]) == ("denied", CODE), "the refusal is audited on the Arx side too"


def test_t24_end_to_end_the_add_on_guard_still_refuses_first_for_a_known_wiskey_door(tile_world):
    c, db, b = tile_world["c"], tile_world["db"], tile_world["bridge"]
    from smplwise.db import now_iso

    with db.connection() as conn:
        conn.execute("INSERT INTO ha_entities(entity_id, domain, name, platform, state, state_seen_at, first_seen_at, updated_at) VALUES (?,?,?,?,?,?,?,?)",
                     ("button.entrance_open", "button", "open", "hikvision_intercom", "unknown", now_iso(), now_iso(), now_iso()))
    r = c.post("/api/v1/ha/entities/button.entrance_open/actions", json={"allowed_action_id": "button.press", "client_request_id": str(uuid.uuid4()),
                                                                             "expires_at": "2099-01-01T00:00:00Z", "confirmation_grant": "confirmed"})
    assert r.status_code == 409 and r.json()["code"] == CODE, r.text
    assert tile_world["sent"] == [] and b.calls == [] and b.events == [], "never left the add-on"

