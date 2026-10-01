"""CR-017 x CR-018: the automations' side of the notification center (docs/changes/CR-018-NOTIFICATIONS.md section 15). A run that ends in an error is announced ONCE
(`automation.failed`, audience by the setting `notify.failures_audience`), an approved `notify` step that the trace shows executed is announced (`automation.notify`), and
both reach only the callers who may SEE that automation (`automation_scope`: the view permission and the entities of its action targets within their floors).
Everything runs against FakeHaConfig (traces in HA's shape) - no network."""
from __future__ import annotations

import json

from automations_fixture import *  # noqa: F401,F403
from automations_fixture import autos_app  # noqa: F401
from automations_fixture import API, OMER, create_item, draft_of, item_by_name, place, svc_block
from automations_fixture import grant as _raw_grant
from conftest import as_user, seed_tree
from smplwise.routers.access import SENSITIVE as _SENSITIVE
from smplwise.services import automations, notify

READ = ["devices.read", "entity.state.read"]
EDIT = ["automation.manage", "devices.control"] + READ


def grant(c, user, name, permissions, sensitive, scope_type, scope_id):
    both = list(dict.fromkeys(list(permissions) + list(sensitive)))
    return _raw_grant(c, user, name, [p for p in both if p not in _SENSITIVE], [p for p in both if p in _SENSITIVE], scope_type, scope_id)


def _file(fake, item_id):
    return next(i for i in fake.automations if str(i.get("id")) == item_id)


def _rows(app, source):
    with app.state.db.connection(mode="read") as conn:
        return [dict(r) for r in conn.execute("SELECT * FROM notifications WHERE source = ? ORDER BY first_at, id", (source,)).fetchall()]


def _inbox(c, user="joni"):
    r = c.get(f"{API}/notifications", headers=as_user(user))
    assert r.status_code == 200, r.text
    return r.json()["notifications"]


# ================================================================ a failed run is announced once

def test_a_failed_run_is_announced_once_with_the_step_and_a_deep_link_to_its_trace(autos_app):
    app, s, c, fake, tr = autos_app
    it = item_by_name(c, "תאורה בפרוזדור בתנועה")
    run = fake.add_run("automation", it["id"], _file(fake, it["id"]), minutes_ago=2, fail_step="action/1")
    assert c.get(f"{API}/automations/automation/{it['id']}/runs").status_code == 200
    rows = _rows(app, "automation.failed")
    assert len(rows) == 1
    n = rows[0]
    assert (n["subject_kind"], n["subject_id"], n["category"], n["severity"]) == ("automation", it["id"], "automations", "alert")
    assert n["count"] == 1 and n["link"] == f"#/devices/automations/{it['id']}?view=trace&run={run['run_id']}"
    assert "תאורה בפרוזדור בתנועה" in n["body"] and "לא הושלם" in n["body"]
    origin = json.loads(n["origin_json"])
    assert origin["run_id"] == run["run_id"] and "light.office" in origin["entity_ids"]
    # the same traces read again, by anyone: silent (a folded signal would have made the count 2)
    c.get(f"{API}/automations/automation/{it['id']}/runs")
    c.get(f"{API}/automations/automation/{it['id']}/runs")
    assert _rows(app, "automation.failed")[0]["count"] == 1
    # the administrator sees it in the inbox
    assert [x["source"] for x in _inbox(c) if x["source"].startswith("automation.")] == ["automation.failed"]


def test_a_run_that_ended_well_or_whose_conditions_failed_announces_nothing(autos_app):
    app, s, c, fake, tr = autos_app
    it = item_by_name(c, "תאורה בפרוזדור בתנועה")
    cfg = _file(fake, it["id"])
    fake.add_run("automation", it["id"], cfg, minutes_ago=3)
    fake.add_run("automation", it["id"], cfg, minutes_ago=2, conditions_pass=False)
    assert c.get(f"{API}/automations/automation/{it['id']}/runs").status_code == 200
    assert _rows(app, "automation.failed") == [] and _rows(app, "automation.notify") == []


def test_an_old_failure_is_history_not_news(autos_app):
    app, s, c, fake, tr = autos_app
    it = item_by_name(c, "תאורה בפרוזדור בתנועה")
    fake.add_run("automation", it["id"], _file(fake, it["id"]), minutes_ago=90, fail_step="action/0")
    assert c.get(f"{API}/automations/automation/{it['id']}/runs").status_code == 200
    assert _rows(app, "automation.failed") == []


def test_the_mirror_settles_a_run_nobody_has_open_and_looks_again_while_it_is_running(autos_app):
    app, s, c, fake, tr = autos_app
    it = item_by_name(c, "מזגן סלון בבוקר")
    c.get(f"{API}/automations")  # the first pull
    entity = fake.states and next(e for e, st in fake.states.items() if st["attributes"].get("id") == it["id"] and e.startswith("automation."))
    fake.add_run("automation", it["id"], _file(fake, it["id"]), minutes_ago=0.2, fail_step="action/0")
    # an `automation_triggered` event queues the check (nothing talks to HA from the event handler); the flush runs it
    automations.MIRROR.on_ha_event({"event": {"event_type": "automation_triggered", "data": {"entity_id": entity}, "time_fired": automations.MIRROR.stamp()}})
    assert _rows(app, "automation.failed") == []
    automations.MIRROR.flush()
    rows = _rows(app, "automation.failed")
    assert len(rows) == 1 and rows[0]["subject_id"] == it["id"]
    automations.MIRROR.flush()
    assert _rows(app, "automation.failed")[0]["count"] == 1, "one failed run, one announcement"
    # a run still running is reported as such (the timer looks again later); it is not announced until it is over
    run = fake.add_run("automation", it["id"], _file(fake, it["id"]), minutes_ago=0.1)
    run["state"], run["script_execution"], run["timestamp"]["finish"] = "running", None, None
    assert automations_check(app, it["id"]) == "running"
    assert len(_rows(app, "automation.failed")) == 1


def automations_check(app, item_id):
    from smplwise.services import automation_runs

    return automation_runs.check_item(app.state.db, "automation", item_id)


# ================================================================ the audience

def test_the_default_audience_is_the_administrators_and_the_setting_widens_it_to_everyone_who_sees_the_automation(autos_app):
    app, s, c, fake, tr = autos_app
    ids = seed_tree(c)
    place(c, ids["floor2"], "light.office", "climate.living_room", "switch.hall_lights", "binary_sensor.motion_hall")
    grant(c, "omer", "עורך בקומה 2", EDIT, ["automation.manage"], "floor", ids["floor2"])
    grant(c, "vera", "עורך בקומה אחרת", EDIT, ["automation.manage"], "floor", ids["floor3"])
    grant(c, "runner", "מפעיל סקריפטים", ["script.run", "devices.control"] + READ, [], "installation", "*")  # may run scripts: NOT an audience of an automation's news
    it = item_by_name(c, "מזגן סלון בבוקר")  # climate.living_room: on floor 2
    fake.add_run("automation", it["id"], _file(fake, it["id"]), minutes_ago=1, fail_step="action/0")
    c.get(f"{API}/automations/automation/{it['id']}/runs")
    n = _rows(app, "automation.failed")[0]
    with app.state.db.connection(mode="read") as conn:
        got = {r[0].removeprefix("dev-") for r in conn.execute("SELECT user_id FROM notification_recipients WHERE notification_id = ?", (n["id"],)).fetchall()}
    assert "omer" not in got and "vera" not in got, "the administrators only, by default"
    # `visible`: everyone who may see the automation - omer (floor 2) yes, vera (floor 3) no
    assert c.put(f"{API}/notify/settings", json={"failures_audience": "visible"}).status_code == 200
    fake.add_run("automation", it["id"], _file(fake, it["id"]), minutes_ago=0.5, fail_step="action/0")
    with app.state.db.connection() as conn:
        conn.execute("DELETE FROM automation_runs WHERE source = 'trace'")
        conn.execute("DELETE FROM notifications")
    c.get(f"{API}/automations/automation/{it['id']}/runs")
    n = _rows(app, "automation.failed")[0]
    with app.state.db.connection(mode="read") as conn:
        got = {r[0].removeprefix("dev-") for r in conn.execute("SELECT user_id FROM notification_recipients WHERE notification_id = ?", (n["id"],)).fetchall()}
        assert "omer" in got and "vera" not in got and "runner" not in got
        # the inbox applies the rule again at read time: a revoked or foreign scope sees nothing
        assert [x["id"] for x in _inbox(c, "omer")] == [n["id"]] and _inbox(c, "vera") == [] and _inbox(c, "runner") == []
    # an automation vera may not see, whatever she is told: the same function decides
    other = item_by_name(c, "כבוי כשאף אחד לא בבית")  # bedroom climates: on no floor
    with app.state.db.connection(mode="read") as conn:
        from smplwise.services.notify_visibility import Reach, principal_of

        reach = Reach(conn, principal_of(conn, "dev-omer"))
        assert reach.can_see({"subject_kind": "automation", "subject_id": other["id"], "origin": {}}) is False
        assert reach.can_see({"subject_kind": "automation", "subject_id": it["id"], "origin": {}}) is True
        assert reach.can_see({"subject_kind": "automation", "subject_id": "deleted-item", "origin": {"owner_user_id": "dev-omer"}}) is False, "a gone item: only installation-wide managers hear (a scoped editor has no floor to judge by)"
        assert Reach(conn, principal_of(conn, "dev-joni")).can_see({"subject_kind": "automation", "subject_id": "deleted-item", "origin": {}}) is True
        assert Reach(conn, principal_of(conn, "dev-runner")).can_see({"subject_kind": "automation", "subject_id": it["id"], "origin": {}}) is False, "script.run is not automation.manage"


# ================================================================ the notify action

def test_an_approved_notify_step_that_ran_is_announced_and_one_that_did_not_is_not(autos_app):
    app, s, c, fake, tr = autos_app
    it = item_by_name(c, "התראה לטלפון")
    cfg = _file(fake, it["id"])
    run = fake.add_run("automation", it["id"], cfg, minutes_ago=1)
    c.get(f"{API}/automations/automation/{it['id']}/runs")
    rows = _rows(app, "automation.notify")
    assert len(rows) == 1 and rows[0]["subject_id"] == it["id"] and rows[0]["dedupe_key"].endswith(":actions.0")
    assert rows[0]["link"] == f"#/devices/automations/{it['id']}" and "התראה לטלפון" in rows[0]["body"]
    assert "תנועה בפרוזדור" not in rows[0]["body"], "the message of the step is the phone's, never the center's text (a template id + place only)"
    # the conditions of a run failed -> the step never ran -> nothing
    app_rows = len(_rows(app, "automation.notify"))
    cfg2 = dict(cfg, conditions=[{"condition": "state", "entity_id": ["binary_sensor.motion_hall"], "state": "off"}])
    fake.add_run("automation", it["id"], cfg2, minutes_ago=0.5, conditions_pass=False)
    c.get(f"{API}/automations/automation/{it['id']}/runs")
    assert len(_rows(app, "automation.notify")) == app_rows
    # a target the administrator has not approved is not announced
    assert c.patch(f"{API}/settings", json={"automations.notify_targets": []}).status_code == 200
    with app.state.db.connection() as conn:
        conn.execute("DELETE FROM notifications")
        conn.execute("DELETE FROM automation_runs WHERE source = 'trace'")
    c.get(f"{API}/automations/automation/{it['id']}/runs")
    assert _rows(app, "automation.notify") == []


def test_a_notify_step_in_a_failed_run_announces_both(autos_app):
    app, s, c, fake, tr = autos_app
    d = draft_of("הודעה ואז כשל", actions=[svc_block(NOTIFY, [], {"message": "שלום"}, uid="n2", role_="notify"), svc_block("light.turn_on", ["light.office"], uid="n3")])
    r = create_item(c, "automation", d, enabled=True)
    assert r.status_code == 201, r.text
    item = r.json()["item"]
    run = fake.add_run("automation", item["config_id"], _file(fake, item["config_id"]), minutes_ago=1, fail_step="action/1")
    c.get(f"{API}/automations/automation/{item['id']}/runs")
    assert len(_rows(app, "automation.failed")) == 1 and len(_rows(app, "automation.notify")) == 1
    assert _rows(app, "automation.failed")[0]["body"].count("לא הושלם") == 1 and run["run_id"] in _rows(app, "automation.failed")[0]["link"]


def test_the_notification_center_names_the_automation_kind_in_its_catalogue(autos_app):
    app, s, c, fake, tr = autos_app
    with app.state.db.connection(mode="read") as conn:
        from smplwise.services import notify_policy

        pols = {p["source"]: p for p in notify_policy.list_policies(conn)}
    assert pols["automation.failed"]["enabled"] and pols["automation.notify"]["enabled"]
    assert notify.dedupe_key_of(notify.Signal("automation.notify", "automation", "x", dedupe_key="automation.notify:automation:x:actions.0")).endswith(":actions.0")
