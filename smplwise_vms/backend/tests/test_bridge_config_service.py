"""CR-017 / bridge 0.6.0: the `smplwise_bridge.config_item` service (config_service.py with its real policy and file store) against the fake Home Assistant of
tests/fake_ha_config.py: the order of the checks, the delegation switch (the owner-approved design change of 2026-10-01: off -> a non-administrator is refused; on
-> builder content only), compare-and-set, one reload of only the changed item and the wait for it, rollback of a create that never loads, deletes, the runtime ops
with the caller's own context, and that nothing is ever called, written or logged that should not be. Synthetic data only."""
from __future__ import annotations

import asyncio
import copy
import json
import logging

import pytest
import yaml

from bridge_loader import load
from fake_ha_config import FakeHaConfig, FakeUser
from smplwise.services import automation_model as am

signing = load("signing")
policy = load("config_policy")
service = load("config_service")
store_mod = load("config_store")

SECRET = "pairing-secret-for-tests"
SECRET_VALUE = "test-key-not-real"
HALL = "1727700000002"
NEWID = "1727790000001"


@pytest.fixture()
def fake():
    return FakeHaConfig.seed_probe_like()


def new_auto(i=NEWID, **kw):
    c = {"id": i, "alias": "בדיקה", "description": "", "triggers": [{"trigger": "time", "at": "20:00:00"}], "conditions": [],
         "actions": [{"action": "light.turn_on", "target": {"entity_id": ["light.hall"]}}], "mode": "single"}
    c.update(kw)
    return c


def send(fake, op="upsert", *, secret=SECRET, delegated=False, is_admin=True, allowed=None, uid="u1", **fields):
    body = {"user_id": uid, "op": op, "request_id": "op-1"}
    if op in ("upsert", "delete", "enable", "disable", "trigger", "run_script", "stop_script"):
        body.setdefault("kind", "automation")
    body.update(fields)
    return fake.bridge_config_item(signing.sign(SECRET, body), secret, delegated=delegated, is_admin=is_admin, allowed=allowed)


def upsert(fake, config, *, kind="automation", item_id=None, base=None, profile="builder", preserved=(), sensitive=False, **kw):
    item_id = item_id or config.get("id") or "x"
    return send(fake, "upsert", kind=kind, item_id=item_id, base_revision=base, profile=profile, config=config, preserved=list(preserved), sensitive=sensitive, **kw)


def hall(fake):
    return fake.file_item("automation", HALL)


def reloads(fake):
    return [(c["domain"], c["service"], c["data"]) for c in fake.bridge_hass().calls if c["service"] == "reload"]


def files_text(fake):
    d = fake.bridge_hass().config.config_dir
    return {k: (open(f"{d}/{k}.yaml", encoding="utf-8").read()) for k in ("automations", "scripts", "scenes")}


# ---------------------------------------------------------------- the happy paths

def test_an_edit_writes_the_file_reloads_only_that_automation_and_waits_for_it(fake):
    cfg = hall(fake)
    rev = am.revision_of(cfg)
    cfg["actions"][0]["data"]["brightness_pct"] = 55
    out = upsert(fake, cfg, base=rev)
    assert out == {"ok": True, "request_id": "op-1", "context_id": None, "revision_before": rev, "revision_after": am.revision_of(cfg), "entity_id": "automation.hall_motion", "loaded": True,
                   "rolled_back": False, "ha_validation": "ok"}
    assert reloads(fake) == [("automation", "reload", {"id": HALL})]  # ONE reload, of this item only
    assert yaml.safe_load(files_text(fake)["automations"])[1]["actions"][0]["data"]["brightness_pct"] == 55  # in place, second in the file
    assert json.dumps(fake.file_item("automation", HALL), ensure_ascii=False) == json.dumps(cfg, ensure_ascii=False)
    assert fake.states["automation.hall_motion"]["attributes"]["friendly_name"] == cfg["alias"]
    assert len(fake.bridge_hass().calls) == 1  # nothing else was called


def test_a_create_adds_a_new_entity_and_a_script_and_a_scene_reload_their_own_domain_only(fake):
    out = upsert(fake, new_auto())
    assert out["ok"] and out["revision_before"] is None and out["entity_id"].startswith("automation.") and out["loaded"] is True
    assert fake.states[out["entity_id"]]["attributes"]["id"] == NEWID and fake.entity_registry_entry(out["entity_id"])["unique_id"] == NEWID
    assert reloads(fake) == [("automation", "reload", {"id": NEWID})]
    fake.bridge_hass().calls.clear()
    script = {"alias": "סקריפט חדש", "mode": "single", "sequence": [{"action": "light.turn_off", "target": {"entity_id": ["light.hall"]}}]}
    out = upsert(fake, script, kind="script", item_id="arx_1727790000002")
    assert out["ok"] and out["entity_id"] == "script.arx_1727790000002" and reloads(fake) == [("script", "reload", {})]
    assert "arx_1727790000002" in yaml.safe_load(files_text(fake)["scripts"])
    fake.bridge_hass().calls.clear()
    scene = {"id": "1727790000003", "name": "סצנה חדשה", "entities": {"light.hall": {"state": "on", "brightness": 100}}}
    out = upsert(fake, scene, kind="scene", item_id="1727790000003")
    assert out["ok"] and out["entity_id"].startswith("scene.") and reloads(fake) == [("scene", "reload", {})]


def test_a_delete_removes_the_file_entry_and_the_registry_entity_and_reloads_nothing(fake):
    cfg = hall(fake)
    fake.bridge_hass().calls.clear()
    out = send(fake, "delete", item_id=HALL, base_revision=am.revision_of(cfg), profile="builder")
    assert out["ok"] and out["revision_after"] is None and out["entity_id"] == "automation.hall_motion" and out["revision_before"] == am.revision_of(cfg)
    assert HALL not in files_text(fake)["automations"] and "automation.hall_motion" not in fake.states and fake.entity_registry_entry("automation.hall_motion") is None
    assert fake.bridge_hass().calls == []  # the registry removal is what Home Assistant's own DELETE does; no reload
    out = send(fake, "delete", kind="script", item_id="shutters", base_revision=am.revision_of(fake.file_item("script", "shutters")), profile="builder")
    assert out["ok"] and "script.shutters" not in fake.states and "shutters" not in yaml.safe_load(files_text(fake)["scripts"])
    assert send(fake, "delete", item_id=HALL, base_revision="0123456789abcdef")["error"] == "not_found"


def test_a_previous_file_goes_to_the_backup_ring_before_every_write(fake):
    cfg = hall(fake)
    before = files_text(fake)["automations"]
    cfg["alias"] = "שונה"
    assert upsert(fake, cfg, base=am.revision_of(hall(fake)))["ok"]
    d = fake.bridge_hass().config.config_dir
    backups = sorted((__import__("pathlib").Path(d) / "smplwise_bridge_backups").glob("automations.yaml.*.bak"))
    assert len(backups) == 1 and backups[0].read_text(encoding="utf-8") == before


# ---------------------------------------------------------------- compare-and-set and "never reload without a write"

def test_refusals_before_the_write_change_nothing_and_never_reload(fake):
    cfg = hall(fake)
    before = files_text(fake)
    stale = upsert(fake, {**cfg, "alias": "x"}, base="0123456789abcdef")
    assert stale["ok"] is False and stale["error"] == "stale" and stale["revision_current"] == am.revision_of(cfg)  # the add-on tells this CAS `stale` from an expired signature by revision_current
    assert upsert(fake, {**new_auto(HALL)}, base=None)["error"] == "exists"
    assert upsert(fake, new_auto("1727790000009"), base="0123456789abcdef")["error"] == "not_found"
    assert send(fake, "delete", item_id="1727790000009", base_revision="0123456789abcdef", profile="builder")["error"] == "not_found"
    bad = upsert(fake, new_auto(actions=[{"action": "shell_command.blink"}]))
    assert bad["ok"] is False and bad["error"] == "preserved_mismatch" and bad["path"] == "actions[0]"
    assert files_text(fake) == before and fake.bridge_hass().calls == [] and fake.events == []


def test_two_saves_from_the_same_revision_one_wins_and_the_other_is_stale(fake):
    cfg = hall(fake)
    rev = am.revision_of(cfg)

    async def both():
        a = copy.deepcopy(cfg)
        a["alias"] = "אחד"
        b = copy.deepcopy(cfg)
        b["alias"] = "שניים"
        mk = lambda c, rid: signing.sign(SECRET, {"user_id": "u1", "op": "upsert", "request_id": rid, "kind": "automation", "item_id": HALL, "base_revision": rev, "profile": "builder", "config": c,  # noqa: E731
                                                  "preserved": [], "sensitive": False})
        return await asyncio.gather(fake.bridge_config_item_async(mk(a, "r1"), SECRET), fake.bridge_config_item_async(mk(b, "r2"), SECRET))

    first, second = asyncio.run(both())
    assert sorted([first["ok"], second["ok"]]) == [False, True]
    loser = first if not first["ok"] else second
    assert loser["error"] == "stale" and hall(fake)["alias"] in ("אחד", "שניים")


def test_a_hand_edit_in_ha_between_the_add_ons_read_and_the_save_is_stale_not_overwritten(fake):
    cfg = hall(fake)
    rev = am.revision_of(cfg)
    edited = copy.deepcopy(cfg)
    edited["alias"] = "נערך ב־HA"
    hass = fake.bridge_hass()
    store = store_mod.ConfigStore(hass.config.config_dir)
    store.upsert("automation", HALL, edited, rev)
    mine = copy.deepcopy(cfg)
    mine["alias"] = "שלי"
    out = upsert(fake, mine, base=rev)
    assert out["error"] == "stale" and store.get("automation", HALL)["alias"] == "נערך ב־HA"


# ---------------------------------------------------------------- who may write: the owner-approved delegation switch

def test_delegation_off_refuses_every_non_administrator_write_and_nothing_is_touched(fake):
    cfg = hall(fake)
    before = files_text(fake)
    cfg["alias"] = "x"
    for fn in (lambda: upsert(fake, cfg, base=am.revision_of(hall(fake)), is_admin=False, delegated=False),
               lambda: upsert(fake, new_auto(), is_admin=False, delegated=False),
               lambda: send(fake, "delete", item_id=HALL, base_revision=am.revision_of(hall(fake)), profile="builder", is_admin=False, delegated=False)):
        out = fn()
        assert out["ok"] is False and out["error"] == "delegation_off"
    assert files_text(fake) == before and fake.bridge_hass().calls == []


def test_delegation_on_lets_a_non_administrator_save_simple_builder_content_and_audits_nothing_extra_in_the_answer(fake):
    cfg = hall(fake)
    rev = am.revision_of(cfg)
    cfg["actions"][0]["data"]["brightness_pct"] = 20
    out = upsert(fake, cfg, base=rev, is_admin=False, delegated=True)
    assert out["ok"] is True and out["loaded"] is True
    assert hall(fake)["actions"][0]["data"]["brightness_pct"] == 20
    assert upsert(fake, new_auto("1727790000011"), is_admin=False, delegated=True)["ok"] is True
    out = send(fake, "delete", item_id="1727790000011", base_revision=am.revision_of(fake.file_item("automation", "1727790000011")), profile="builder", is_admin=False, delegated=True)
    assert out["ok"] is True


def test_the_code_profile_always_needs_an_ha_administrator_even_with_the_switch_on(fake):
    tpl = new_auto(triggers=[{"trigger": "template", "value_template": "{{ states('sensor.lux') | int < 20 }}"}])
    out = upsert(fake, tpl, profile="code", is_admin=False, delegated=True)
    assert out["ok"] is False and out["error"] == "not_ha_admin"
    assert upsert(fake, tpl, profile="code", is_admin=True, delegated=False)["ok"] is True  # an administrator authors a template
    # a delegated user claims the builder profile for content that is not builder content: refused by the policy, not trusted
    tpl2 = new_auto("1727790000012", triggers=[{"trigger": "template", "value_template": "{{ states('sensor.lux') | int < 20 }}"}])
    out = upsert(fake, tpl2, profile="builder", preserved=[policy.fingerprint_of(tpl2["triggers"][0])], is_admin=False, delegated=True)
    assert out["ok"] is False and out["error"] == "preserved_mismatch" and out["path"] == "triggers[0]"
    assert fake.file_item("automation", "1727790000012") is None


def test_a_delegated_user_keeps_and_moves_a_stored_locked_block_but_never_authors_one(fake):
    stored = fake.file_item("automation", "1727700000006")  # two device triggers (locked) and a choose
    rev = am.revision_of(stored)
    mine = copy.deepcopy(stored)
    mine["triggers"].reverse()
    keep = [policy.fingerprint_of(t) for t in stored["triggers"]]
    assert upsert(fake, mine, base=rev, preserved=keep, is_admin=False, delegated=True)["ok"] is True
    stored = fake.file_item("automation", "1727700000006")
    forged = copy.deepcopy(stored)
    forged["triggers"][0] = {"trigger": "device", "domain": "wall_switch", "device_id": "evil", "type": "x", "id": "short"}
    out = upsert(fake, forged, base=am.revision_of(stored), preserved=keep + [policy.fingerprint_of(forged["triggers"][0])], is_admin=False, delegated=True)
    assert out["error"] == "preserved_mismatch" and out["path"] == "triggers[0]"
    # the block of another item, claimed as preserved here
    other = fake.file_item("automation", "1727700000007")["triggers"][0]
    smuggled = copy.deepcopy(stored)
    smuggled["triggers"].append(other)
    assert upsert(fake, smuggled, base=am.revision_of(stored), preserved=keep + [policy.fingerprint_of(other)], is_admin=False, delegated=True)["error"] == "preserved_mismatch"


def test_a_non_administrator_must_hold_control_of_every_entity_the_item_drives_new_and_old(fake):
    cfg = hall(fake)
    rev = am.revision_of(cfg)
    cfg["actions"][0]["data"]["brightness_pct"] = 10
    out = upsert(fake, cfg, base=rev, is_admin=False, delegated=True, allowed={"switch.irrigation"})
    assert out["ok"] is False and out["error"] == "unauthorized" and hall(fake)["actions"][0]["data"]["brightness_pct"] == 40
    assert upsert(fake, cfg, base=rev, is_admin=False, delegated=True, allowed={"light.hall"})["ok"] is True
    # an item that drives an entity the person may not control cannot be deleted by him either (the OLD content counts)
    allowed_only_new = {"light.hall"}
    full = fake.file_item("automation", "1727700000003")  # drives lights, climate and the alarm
    out = send(fake, "delete", item_id="1727700000003", base_revision=am.revision_of(full), profile="builder", is_admin=False, delegated=True, allowed=allowed_only_new)
    assert out["error"] == "unauthorized" and fake.file_item("automation", "1727700000003") is not None
    u = fake.bridge_hass().users["u1"]
    assert all(key == "control" for _eid, key in u.checked)  # the question asked is Home Assistant's own CONTROL policy


def test_a_user_whose_permission_api_is_missing_is_refused_closed(fake):
    hass = fake.bridge_hass()
    hass.users["u9"] = FakeUser("u9", admin=False, api=False)
    body = {"user_id": "u9", "op": "upsert", "request_id": "r", "kind": "automation", "item_id": NEWID, "base_revision": None, "profile": "builder", "config": new_auto(), "preserved": [], "sensitive": False}
    # (the helper recreates the user per call, so drive the handler directly)
    from fake_ha_config import _bridge_deps

    out = asyncio.run(service.async_handle_config_item(hass, signing.Verifier(SECRET), signing.sign(SECRET, body), delegated=lambda: True, deps=_bridge_deps(hass)))
    assert out["error"] == "permission_check_unavailable" and fake.file_item("automation", NEWID) is None


# ---------------------------------------------------------------- the sensitive flag, secrets, Home Assistant's own validation

def test_a_sensitive_step_needs_the_flag_and_a_code_or_secret_is_never_written(fake):
    baseline = sum(t.count(SECRET_VALUE) for t in files_text(fake).values())
    disarm = new_auto(actions=[{"action": "alarm_control_panel.alarm_disarm", "target": {"entity_id": ["alarm_control_panel.home"]}}])
    assert upsert(fake, disarm, sensitive=False)["error"] == "sensitive_flag_mismatch"
    assert upsert(fake, disarm, sensitive=True)["ok"] is True
    coded = new_auto("1727790000020", actions=[{"action": "alarm_control_panel.alarm_disarm", "target": {"entity_id": ["alarm_control_panel.home"]}, "data": {"code": "1234"}}])
    for profile in ("builder", "code"):
        out = upsert(fake, coded, sensitive=True, profile=profile)
        assert out["ok"] is False and out["error"] in ("code_not_allowed", "preserved_mismatch")
    secret = new_auto("1727790000021", actions=[{"action": "notify.pushover", "data": {"message": "m", "api_key": SECRET_VALUE}}])
    assert upsert(fake, secret, profile="code")["error"] == "secret_not_allowed"
    assert sum(t.count(SECRET_VALUE) for t in files_text(fake).values()) == baseline  # the seed has one stored (a locked block); nothing new was written


def test_home_assistants_own_validation_is_the_last_word_before_the_write(fake):
    nonsense = new_auto(triggers=[{"trigger": "nonsense_platform"}])
    out = upsert(fake, nonsense, profile="code")
    assert out["ok"] is False and out["error"] == "ha_invalid" and "Invalid trigger" in out["path"]
    assert fake.file_item("automation", NEWID) is None and fake.bridge_hass().calls == []


def test_a_secret_is_never_logged_nor_returned(fake, caplog):
    caplog.set_level(logging.DEBUG)
    secret = new_auto(actions=[{"action": "notify.pushover", "data": {"message": "m", "api_key": SECRET_VALUE}}])
    out = upsert(fake, secret, profile="code")
    out2 = upsert(fake, new_auto("1727790000022", variables={"api_key": SECRET_VALUE}), profile="code")
    assert out["ok"] is False and out2["ok"] is False
    assert SECRET_VALUE not in json.dumps(out) + json.dumps(out2) and SECRET_VALUE not in caplog.text


# ---------------------------------------------------------------- an item that never loads

def test_a_new_item_that_never_appears_is_rolled_back_and_reported_not_loaded():
    f = FakeHaConfig.seed_probe_like(include_loaded=False)  # the include line of automations.yaml is missing (U-5)
    out = upsert(f, new_auto())
    assert out["ok"] is True and out["loaded"] is False and out["rolled_back"] is True and out["entity_id"] is None and out["revision_after"] is None
    assert NEWID not in files_text(f)["automations"] and store_mod.ConfigStore(f.bridge_hass().config.config_dir).get("automation", NEWID) is None  # no orphan left in the file
    # an EXISTING item stays: only a create is rolled back
    cfg = f.file_item("automation", HALL)
    cfg["alias"] = "x"
    out = upsert(f, cfg, base=am.revision_of(f.file_item("automation", HALL)))
    assert out["ok"] is True and out["rolled_back"] is False and out["revision_after"] == am.revision_of(cfg)


def test_a_missing_reload_service_is_reported_not_loaded(fake, monkeypatch):
    hass = fake.bridge_hass()
    monkeypatch.setattr(hass.services, "has_service", lambda d, s: False)
    out = upsert(fake, new_auto())
    assert out["ok"] is True and out["loaded"] is False and out["rolled_back"] is True


# ---------------------------------------------------------------- runtime ops

def test_enable_disable_trigger_run_stop_and_apply_use_the_callers_own_context(fake):
    hass = fake.bridge_hass()
    out = send(fake, "disable", item_id=HALL)
    assert out["ok"] and out["entity_id"] == "automation.hall_motion" and fake.states["automation.hall_motion"]["state"] == "off"
    last = hass.calls[-1]
    assert (last["domain"], last["service"], last["data"]) == ("automation", "turn_off", {"entity_id": "automation.hall_motion"}) and last["context"].user_id == "u1" and out["context_id"] == last["context"].id
    assert send(fake, "enable", item_id=HALL)["ok"] and fake.states["automation.hall_motion"]["state"] == "on"
    out = send(fake, "trigger", item_id=HALL, skip_condition=False, variables={"who": "yoni"})
    assert out["ok"] and hass.calls[-1]["data"] == {"entity_id": "automation.hall_motion", "skip_condition": False, "variables": {"who": "yoni"}} and hass.calls[-1]["service"] == "trigger"
    assert send(fake, "trigger", item_id=HALL)["ok"] and hass.calls[-1]["data"] == {"entity_id": "automation.hall_motion"}  # HA's own default for skip_condition stays
    assert fake.drain_events("automation_triggered")
    out = send(fake, "run_script", kind="script", item_id="good_morning", variables={"x": 1})
    assert out["ok"] and out["entity_id"] == "script.good_morning" and (hass.calls[-1]["domain"], hass.calls[-1]["service"]) == ("script", "turn_on")
    assert send(fake, "stop_script", kind="script", item_id="good_morning")["ok"] and hass.calls[-1]["service"] == "turn_off"
    out = send(fake, "apply_scene", entity_id="scene.arx_welcome")
    assert out["ok"] and out["entity_id"] == "scene.arx_welcome" and hass.calls[-1]["data"] == {"entity_id": "scene.arx_welcome"} and fake.states["light.entry"]["attributes"]["brightness"] == 204
    assert send(fake, "apply_scene", entity_id="scene.wall_3")["ok"]  # an integration scene
    assert all(c["context"].user_id == "u1" for c in hass.calls)


def test_runtime_ops_need_no_delegation_but_honour_the_persons_own_permissions(fake):
    out = send(fake, "disable", item_id=HALL, is_admin=False, delegated=False, allowed={"automation.hall_motion"})
    assert out["ok"] is True  # a household member may switch an automation off without any switch
    out = send(fake, "enable", item_id=HALL, is_admin=False, allowed={"switch.x"})
    assert out["ok"] is False and out["error"] == "unauthorized"
    hass = fake.bridge_hass()
    hass.denied[("u1", "scene.arx_welcome")] = True
    out = send(fake, "apply_scene", entity_id="scene.arx_welcome", is_admin=False, allowed={"scene.arx_welcome"})  # the policy lets the question pass, Home Assistant refuses the call
    assert out["ok"] is False and out["error"] == "unauthorized"


def test_runtime_ops_on_unknown_things_and_the_op_set(fake):
    assert send(fake, "enable", item_id="nope")["error"] == "not_found"
    assert send(fake, "run_script", kind="script", item_id="nope")["error"] == "not_found"
    assert send(fake, "apply_scene", entity_id="scene.nope")["error"] == "not_found"
    assert send(fake, "snapshot_scene", entity_ids=["light.hall"])["error"] == "op_not_allowed"
    assert send(fake, "reload")["error"] == "op_not_allowed"
    assert fake.bridge_hass().calls == []
    # a runtime op works on any registered automation, however it is stored (a file Arx cannot write is still an automation to switch off)
    assert send(fake, "disable", item_id="yaml-shabbat-irrigation")["ok"] is True and fake.states["automation.shabbat_irrigation"]["state"] == "off"


def test_a_long_trigger_is_not_cancelled_and_a_quick_refusal_is_raised(fake, monkeypatch):
    hass = fake.bridge_hass()
    state = {"finished": False}
    real = hass.services.async_call

    async def slow(domain, service, data, blocking=False, context=None):
        if service == "trigger":
            await asyncio.sleep(0.2)  # an automation that waits
            state["finished"] = True
            return
        return await real(domain, service, data, blocking=blocking, context=context)

    monkeypatch.setattr(hass.services, "async_call", slow)
    monkeypatch.setattr(service, "TRIGGER_WAIT_S", 0.02)

    async def run():
        out = await fake.bridge_config_item_async(signing.sign(SECRET, {"user_id": "u1", "op": "trigger", "request_id": "r", "kind": "automation", "item_id": HALL}), SECRET)
        assert out["ok"] is True and state["finished"] is False
        await asyncio.sleep(0.4)
        assert state["finished"] is True  # the run continued after the answer

    asyncio.run(run())


# ---------------------------------------------------------------- signature, user, the closed shape

def test_signature_replay_window_unknown_user_and_shape_come_first(fake):
    body = {"user_id": "u1", "op": "disable", "request_id": "r", "kind": "automation", "item_id": HALL}
    out = fake.bridge_config_item(signing.sign("another-secret", body), SECRET)  # signed with a secret that is not the pairing secret
    assert out["error"] == "bad_signature"
    signed = signing.sign(SECRET, body)
    first = fake.bridge_config_item(signed, SECRET)
    replay = fake.bridge_config_item(dict(signed), SECRET)
    assert first["ok"] is True and replay["error"] == "replay"
    old = signing.sign(SECRET, {**body, "request_id": "r2"}, ts=1)
    assert fake.bridge_config_item(old, SECRET)["error"] == "stale"
    tampered = signing.sign(SECRET, {**body, "request_id": "r3"})
    tampered["item_id"] = "other"
    assert fake.bridge_config_item(tampered, SECRET)["error"] == "bad_signature"
    ghost = {"user_id": "ghost", "op": "disable", "request_id": "r", "kind": "automation", "item_id": HALL}
    hass = fake.bridge_hass()
    from fake_ha_config import _bridge_deps

    assert asyncio.run(service.async_handle_config_item(hass, signing.Verifier(SECRET), signing.sign(SECRET, ghost), delegated=lambda: True, deps=_bridge_deps(hass)))["error"] == "unknown_user"
    hass.users["off"] = FakeUser("off", active=False)
    inactive = {**ghost, "user_id": "off"}
    assert asyncio.run(service.async_handle_config_item(hass, signing.Verifier(SECRET), signing.sign(SECRET, inactive), delegated=lambda: True, deps=_bridge_deps(hass)))["error"] == "unknown_user"
    extra = signing.sign(SECRET, {**body, "request_id": "r4", "config": {}})
    out = fake.bridge_config_item(extra, SECRET)
    assert out["error"] == "invalid_payload" and out["path"] == "config"


def test_the_only_services_ever_called_are_the_reload_of_the_written_item_and_the_runtime_ops(fake):
    upsert(fake, new_auto())
    cfg = hall(fake)
    cfg["alias"] = "y"
    upsert(fake, cfg, base=am.revision_of(hall(fake)))
    upsert(fake, {"alias": "s", "sequence": [{"action": "light.turn_off", "target": {"entity_id": ["light.hall"]}}]}, kind="script", item_id="arx_1")
    called = {(c["domain"], c["service"]) for c in fake.bridge_hass().calls}
    assert called <= {("automation", "reload"), ("script", "reload"), ("scene", "reload")}
    forbidden = {("homeassistant", "restart"), ("homeassistant", "reload_all"), ("automation", "turn_off"), ("shell_command", "blink")}
    assert called.isdisjoint(forbidden)


def test_a_file_with_yaml_tags_cannot_be_written_through_the_bridge(fake):
    hass = fake.bridge_hass()
    p = __import__("pathlib").Path(hass.config.config_dir) / "automations.yaml"
    p.write_text("- id: '5'\n  alias: x\n  actions:\n  - action: notify.x\n    data:\n      message: !secret hello\n", encoding="utf-8")
    out = upsert(fake, new_auto())
    assert out["ok"] is False and out["error"] == "yaml_tags_present" and "!secret hello" in p.read_text(encoding="utf-8")


def test_the_validation_detail_handed_back_never_quotes_a_value_a_template_or_an_entity():
    assert service._safe_detail("Invalid trigger 'nonsense' specified @ data['triggers'][0]") == "Invalid trigger … specified @ data['triggers'][0]"
    detail = service._safe_detail("invalid template (TemplateSyntaxError: " + SECRET_VALUE + " {{ x }}) for dictionary value @ data['actions'][0]['value_template']")
    assert SECRET_VALUE not in detail and "{{" not in detail and detail.endswith("@ data['actions'][0]['value_template']")
    assert service._safe_detail(None) == "invalid" and len(service._safe_detail("x" * 500)) <= 100


def test_a_document_too_deep_to_serialise_is_refused_not_a_crash(fake):
    deep: object = "x"
    for _ in range(3000):
        deep = [deep]
    out = fake.bridge_config_item({"user_id": "u1", "op": "upsert", "request_id": "r", "kind": "automation", "item_id": NEWID, "base_revision": None, "profile": "builder",
                                   "config": {"id": NEWID, "variables": deep}, "preserved": [], "sensitive": False, "ts": int(__import__("time").time()), "nonce": "n", "sig": "s"}, SECRET)
    assert out["ok"] is False and out["error"] == "bad_signature" and fake.file_item("automation", NEWID) is None
