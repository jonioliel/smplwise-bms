"""SCHEDIMPACT-295 (Fable security review 4 of 2026-10-21, finding V-02), the ADD-ON side: what an Arx-only (local) person may put into - or
set going in - a schedule (services/schedule_identity.py, called by services/schedule_ops.py) - negative cases first.

Before the fix a local person with the `schedules` feature could schedule `script.turn_on` of any script the schedule view classes as
ordinary (a relay, a template switch) under the service user, with neither the runnable allowlist nor the impact check. Now:
- basic mode (the only mode this build can run - EXTENDED_GO_LIVE_PERMITTED is False): a script, a scene, a door unlock or arming with the
  bypass set in a local person's schedule is refused (audited), whether it is created, edited, copied, split, restored, enabled or run;
- extended mode (the future, with the permit patched on for the test only): such an item needs both allowlists, the bridge's extended copy
  and a bridge that announced its schedule fences (which then runs the impact check itself - test_schedimpact_295_bridge.py);
- a Home Assistant user's schedules, and a local person's plain schedules and stopping ops, are unchanged.
Fakes only: the FakeScheduler component and bridge (tests/fake_scheduler.py); no Home Assistant, no device, no lab secrets."""
from __future__ import annotations

import json

import pytest

from schedules_fixture import act, draft_of, rid, slot
from schedules_fixture import sched_app  # noqa: F401 (fixture)
from smplwise.auth import current_principal, current_principal_ro
from smplwise.db import get_setting, set_setting
from smplwise.services import backup, ha_client, ha_sync
from smplwise.services import schedule_identity as sch
from smplwise.services import service_identity as si
from test_service_identity import LID, SID, _local, _seed

API = "/api/v1"

EXTRA = {
    "script.relay": ("Gate relay", "sch_living", "off", {}),
    "script.lights": ("Evening lights", "sch_living", "off", {}),
    "scene.movie": ("Movie scene", "sch_living", "2026-09-30T09:00:00+00:00", {}),
}
SCRIPT_CONFIGS = {
    "script.relay": {"alias": "Gate relay", "sequence": [{"action": "switch.turn_on", "target": {"entity_id": "switch.gate_relay"}}]},  # "ordinary" (V-02)
    "script.lights": {"alias": "Evening lights", "sequence": [{"action": "light.turn_on", "target": {"entity_id": "light.office"}}]},
}


def _extra(app, fake) -> None:
    states, reg = [], []
    for eid, (name, area, st, attrs) in EXTRA.items():
        state = {"entity_id": eid, "state": st, "attributes": {"friendly_name": name, **attrs}, "last_changed": "2026-09-30T10:00:00+00:00", "last_updated": "2026-09-30T10:00:00+00:00"}
        states.append(state)
        fake.world[eid] = state
        reg.append({"id": f"reg-{eid}", "entity_id": eid, "unique_id": f"u-{eid}", "platform": "generic", "config_entry_id": "ce-generic", "device_id": None, "area_id": area,
                    "entity_category": None, "original_name": name, "name": None, "disabled_by": None, "hidden_by": None})
    import fake_scheduler

    with app.state.db.connection() as conn:
        for st in states:
            ha_sync.upsert_state(conn, st)
        ha_sync.apply_registry(conn, ha_client.registry_maps(reg, [], fake_scheduler.AREAS, fake_scheduler.FLOORS))
        for eid, cfg in SCRIPT_CONFIGS.items():
            conn.execute("INSERT INTO ha_config_items(kind, item_id, config_id, entity_id, source, revision, config_json, masked, reason, seen_at, changed_at) "
                         "VALUES ('script', ?, ?, ?, 'ui', 'r1', ?, 0, NULL, ?, ?)", (eid.split(".", 1)[1], eid.split(".", 1)[1], eid, json.dumps(cfg), "2026-09-30T10:00:00Z", "2026-09-30T10:00:00Z"))


@pytest.fixture()
def lapp(sched_app):
    """(app, client, fake, set_local, set_ha): the schedules app with the extra items, a local person (site administrator role) configured
    for the service identity, a bridge at 0.9.2; `set_local()` / `set_ha()` switch the caller."""
    app, _s, c, fake, _tr = sched_app
    _extra(app, fake)
    _seed(app.state.db, role="site_admin", bridge="0.9.2")
    local = _local()

    def set_local():
        app.dependency_overrides[current_principal] = lambda: local
        app.dependency_overrides[current_principal_ro] = lambda: local

    def set_ha():
        app.dependency_overrides.clear()

    yield app, c, fake, set_local, set_ha
    app.dependency_overrides.clear()


def _one(service: str, entity: str, name: str = "One", **data) -> dict:
    return draft_of(name, [slot("06:15:00", None, act(service, entity, **data))])


def _create(c, d: dict, *, enabled: bool = True, **extra):
    return c.post(f"{API}/schedules", json={"draft": d, "enabled": enabled, "client_request_id": rid(), **extra})


def _refused_rows(app) -> list[dict]:
    with app.state.db.connection(mode="read") as conn:
        return [dict(r) for r in conn.execute("SELECT actor_user_id, reason, details_json FROM audit_log WHERE action = 'identity.service_identity.refused' ORDER BY rowid")]


def _extended(app, monkeypatch, *, addon=("script.relay", "scene.movie"), bridge=("script.relay", "scene.movie"), fences=True, bridge_ext=True):
    monkeypatch.setattr(si, "EXTENDED_GO_LIVE_PERMITTED", True)  # the FUTURE enabled behaviour, for the test only
    with app.state.db.connection() as conn:
        set_setting(conn, si.EXTENDED_SETTING, "on")
        set_setting(conn, si.BRIDGE_EXTENDED, "true" if bridge_ext else "false")
        set_setting(conn, si.RUNNABLE_SETTING, json.dumps(list(addon)))
        set_setting(conn, si.BRIDGE_RUNNABLE, json.dumps(list(bridge)))
        set_setting(conn, sch.CAPABILITY_SETTING, "true" if fences else "false")


# ---------------------------------------------------------------- 1. basic mode: refused before anything is recorded or sent

@pytest.mark.parametrize("service,entity,reason", [
    ("script.turn_on", "script.relay", "schedule_never_local"),  # the V-02 case: an "ordinary" relay script
    ("script.turn_on", "script.lights", "schedule_never_local"),
    ("scene.turn_on", "scene.movie", "schedule_never_local"),
])
def test_basic_mode_refuses_a_local_persons_script_scene_or_door_schedule(lapp, service, entity, reason):
    app, c, fake, set_local, _ = lapp
    set_local()
    n = len(fake.bridge_calls)
    r = _create(c, _one(service, entity), confirm_lowering=True)
    assert r.status_code == 403 and r.json()["code"] == "service_identity_refused", r.text
    assert len(fake.bridge_calls) == n, "nothing reached the bridge"
    row = _refused_rows(app)[-1]
    assert row["actor_user_id"] == LID and row["reason"] == reason and json.loads(row["details_json"])["feature"] == "schedules"


@pytest.mark.parametrize("service,entity", [("lock.unlock", "lock.front_door"), ("lock.open", "lock.front_door"),
                                            ("alarm_control_panel.alarm_arm_custom_bypass", "alarm_control_panel.house")])
def test_basic_mode_refuses_a_door_or_bypass_action_in_a_local_persons_schedule(lapp, service, entity):
    """Called directly: the route's own sensitive-schedule permission (which the test's local role lacks) would answer first."""
    from smplwise.errors import ApiError

    app, *_ = lapp
    with app.state.db.connection() as conn:
        with pytest.raises(ApiError) as e:
            sch.check(conn, _local(), _one(service, entity), op="add", request_id="t")
        assert e.value.code == "service_identity_refused" and e.value.status == 403
        sch.check(conn, _local(), _one("lock.lock", "lock.front_door"), op="add", request_id="t")  # locking stays allowed
        from smplwise.rbac import Principal

        ha = Principal(user_id="u-ha", username="dana", display_name="Dana", source="remote", via="cookie")
        sch.check(conn, ha, _one(service, entity), op="add", request_id="t")  # a Home Assistant user: never judged here
    assert _refused_rows(app)[-1]["reason"] == "schedule_never_local"


def test_a_home_assistant_users_script_schedule_is_unchanged_and_a_local_person_cannot_set_it_going(lapp):
    app, c, fake, set_local, set_ha = lapp
    set_ha()
    r = _create(c, _one("script.turn_on", "script.relay", "Relay"), enabled=False)
    assert r.status_code == 201, r.text  # a Home Assistant user: no allowlist, no impact check (unchanged)
    sid, rev = r.json()["schedule"]["id"], r.json()["schedule"]["revision"]
    lights = _create(c, _one("light.turn_on", "light.office", "Lights"))
    assert lights.status_code == 201, lights.text
    set_local()
    n = len(fake.bridge_calls)
    assert c.post(f"{API}/schedules/{sid}/enable", json={"client_request_id": rid()}).json()["code"] == "service_identity_refused"
    assert c.post(f"{API}/schedules/{sid}/run", json={"client_request_id": rid(), "confirm": True}).json()["code"] == "service_identity_refused"
    assert c.post(f"{API}/schedules/{sid}/copy", json={"name": "Mine", "client_request_id": rid()}).json()["code"] == "service_identity_refused"
    d = _one("script.turn_on", "script.relay", "Relay renamed")
    assert c.put(f"{API}/schedules/{sid}", json={"draft": d, "base_revision": rev, "client_request_id": rid()}).json()["code"] == "service_identity_refused"
    assert len(fake.bridge_calls) == n
    # stopping things and plain schedules stay available to the local person
    r = c.post(f"{API}/schedules/{lights.json()['schedule']['id']}/disable", json={"client_request_id": rid()})
    assert r.status_code == 200, r.text
    assert _create(c, _one("light.turn_off", "light.office", "Mine")).status_code == 201


# ---------------------------------------------------------------- 2. extended mode (future): both allowlists, the bridge's copy and fences

def test_extended_mode_needs_the_addon_allowlist(lapp, monkeypatch):
    app, c, fake, set_local, _ = lapp
    _extended(app, monkeypatch, addon=(), bridge=("script.relay",))
    set_local()
    r = _create(c, _one("script.turn_on", "script.relay"))
    assert r.status_code == 403 and r.json()["code"] == "service_identity_not_runnable", r.text


@pytest.mark.parametrize("kw,code", [
    ({"bridge": ()}, "service_identity_runnable_bridge_missing"),
    ({"bridge_ext": False}, "service_identity_extended_bridge_off"),
    ({"fences": False}, "service_identity_schedule_bridge_outdated"),  # a bridge without the schedule fences never gets a script schedule
])
def test_extended_mode_never_sends_a_script_schedule_the_bridge_cannot_fence(lapp, monkeypatch, kw, code):
    app, c, fake, set_local, _ = lapp
    _extended(app, monkeypatch, **kw)
    set_local()
    n = len(fake.bridge_calls)
    r = _create(c, _one("script.turn_on", "script.relay"))
    assert r.status_code == 503 and r.json()["code"] == code, r.text
    assert len(fake.bridge_calls) == n


def test_extended_mode_sends_a_listed_script_schedule_on_behalf_and_audits_it(lapp, monkeypatch):
    app, c, fake, set_local, _ = lapp
    _extended(app, monkeypatch)
    set_local()
    r = _create(c, _one("script.turn_on", "script.relay"))
    assert r.status_code == 201, r.text
    add = next(x for x in reversed(fake.bridge_calls) if x["op"] == "add")
    assert add["user_id"] == SID and add["on_behalf_of"] == {"kind": "local", "user_id": LID, "feature": "schedules"}
    with app.state.db.connection(mode="read") as conn:
        row = conn.execute("SELECT details_json FROM audit_log WHERE action = 'identity.service_identity.extended' ORDER BY rowid DESC LIMIT 1").fetchone()
    assert json.loads(row["details_json"])["entity_ids"] == ["script.relay"]


def test_extended_mode_still_refuses_an_automation_or_a_misshapen_run_item():
    for actions in ([("automation.trigger", "automation.open_all")], [("light.turn_on", "script.relay")], [("script.turn_on", "scene.movie")],
                    [("script.turn_off", "script.relay")], [("script.relay", None)], [(None, "light.office")], [("{{ x }}", "light.office")]):
        runs, why = sch.run_items(actions, True)
        assert why in ("schedule_run_shape", "schedule_action_unknown"), actions
    assert sch.run_items([("script.turn_on", "script.relay"), ("scene.turn_on", "scene.movie"), ("light.turn_on", "light.a")], True) == (
        [("script", "script.relay"), ("scene", "scene.movie")], None)
    assert sch.run_items([("lock.unlock", "lock.front")], True) == ([], None), "doors follow the extended never-list (the door rules decide)"
    assert sch.run_items([("lock.unlock", "lock.front")], False)[1] == "schedule_never_local"


def test_a_shape_the_check_cannot_read_is_refused_for_a_local_person_only():
    assert sch.actions_of({"slots": [{"actions": "x"}]}) == [(None, None)]
    assert sch.run_items(sch.actions_of({"slots": [{"actions": "x"}]}), False)[1] == "schedule_action_unknown"
    assert sch.actions_of({"slots": []}) == [] and sch.actions_of(None) == []


# ---------------------------------------------------------------- 3. the bridge's report and the backup

def test_the_directory_push_reports_the_fences_and_a_restore_never_carries_them(lapp):
    app, *_ = lapp
    with app.state.db.connection() as conn:
        sch.note_directory_push(conn, {"users": []})  # an older bridge without the service identity block: nothing changes
        assert get_setting(conn, sch.CAPABILITY_SETTING) in (None, "")
        sch.note_directory_push(conn, {"service_identity": True, "schedule_fences": True})
        assert get_setting(conn, sch.CAPABILITY_SETTING) == "true" and sch.bridge_has_fences(conn)
        sch.note_directory_push(conn, {"service_identity": True})  # a bridge without the key: no fences
        assert get_setting(conn, sch.CAPABILITY_SETTING) == "false" and not sch.bridge_has_fences(conn)
        sch.note_directory_push(conn, {"service_identity": True, "schedule_fences": "yes"})  # only a literal true counts
        assert not sch.bridge_has_fences(conn)
    assert sch.CAPABILITY_SETTING in backup.SETTINGS_KEEP


def test_the_directory_route_records_the_fences():
    from pathlib import Path

    src = (Path(__file__).resolve().parents[1] / "smplwise" / "routers" / "ha.py").read_text(encoding="utf-8")
    assert "schedule_identity.note_directory_push(conn, message)" in src


def test_every_schedule_op_that_sets_content_going_calls_the_check():
    import inspect

    from smplwise.services import schedule_ops as ops

    for fn, op in ((ops.create, '"add"'), (ops.update, '"edit"'), (ops.split, '"add"'), (ops.copy, '"copy"'), (ops.restore, '"add"'), (ops.set_enabled, '"enable"'),
                   (ops.run, '"run"')):
        assert f"schedule_identity.check(w.conn, w.principal," in inspect.getsource(fn) and f"op={op}" in inspect.getsource(fn), fn.__name__
    for fn in (ops.delete, ops.purge):
        assert "schedule_identity.check" not in inspect.getsource(fn), fn.__name__
