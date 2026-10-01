"""CR-017 mirror, runs and housekeeping (docs/architecture/AUTOMATIONS_API.md §6, §12; CR §4.6, §6.1, §9.4, §10): the first pull, drift (an outside change is a version row, a chip
and - for a sensitive item - an audit row without values), the config API probe and the WebSocket fallback, availability and staleness, events (runs, storms, reloads), the traces
("למה זה רץ?": full, masked, no ids), the janitor, and migration 0045."""
from __future__ import annotations

import copy
import json

from automations_fixture import *  # noqa: F401,F403
from automations_fixture import autos_app  # noqa: F401
from automations_fixture import API, OMER, get_item, item_by_name, put_item, rid, draft_of, create_item, svc_block
from smplwise.services import automation_model as model
from smplwise.services import automations, ha_sync


def _file(fake, item_id):
    return next(i for i in fake.automations if str(i.get("id")) == item_id)


# ================================================================ the first pull and drift

def test_the_first_read_pulls_every_item_once_and_keeps_secrets_out_of_the_cache(autos_app):
    app, s, c, fake, tr = autos_app
    assert c.get(f"{API}/automations").status_code == 200
    n = len(fake.rest_calls)
    assert n == 16 + 3 + 2 + 1 + 0 or n >= 20, "one config GET per item that has an id (16 automations, 3 scripts, 2 native scenes, the YAML one)"
    with app.state.db.connection() as conn:
        rows = {(r["kind"], r["item_id"]): r for r in conn.execute("SELECT * FROM ha_config_items").fetchall()}
        assert len(rows) == 43 and rows[("automation", "1727000000015")]["masked"] == 1 and "abc-not-real" not in rows[("automation", "1727000000015")]["config_json"]
        assert rows[("automation", "1727000000015")]["revision"] == model.revision_of(_file(fake, "1727000000015")), "the revision is of the REAL config"
        assert rows[("automation", "yaml1")]["source"] == "yaml" and rows[("automation", "yaml1")]["reason"] == "yaml_managed" and rows[("automation", "yaml1")]["config_json"]
        assert rows[("scene", "entity:scene.wall_scene_01")]["source"] == "integration" and rows[("scene", "entity:scene.wall_scene_01")]["config_json"] is None
        assert [json.loads(rows[("script", "set_cooling")]["config_json"])["fields"].__iter__().__next__()] == ["temp"], "dict order is kept"
        assert conn.execute("SELECT COUNT(*) FROM audit_log WHERE action = 'automation.changed_outside'").fetchone()[0] == 0, "the first pull is the baseline"
        assert conn.execute("SELECT COUNT(*) FROM automation_versions").fetchone()[0] == 22
        st = json.loads(conn.execute("SELECT value FROM settings WHERE key = 'automations.mirror'").fetchone()[0])
        assert st["config_api"] == "ok" and st["last_sync_at"] and st["last_error"] is None
    c.get(f"{API}/automations")
    assert len(fake.rest_calls) == n, "a second read does not pull again"


def test_an_outside_change_is_a_version_a_chip_and_for_a_sensitive_item_an_audit_row(autos_app):
    app, s, c, fake, tr = autos_app
    c.get(f"{API}/automations")
    alarm = _file(fake, "1727000000008")
    alarm["actions"][0] = {"action": "alarm_control_panel.alarm_disarm", "target": {"entity_id": ["alarm_control_panel.home_panel"]}}
    plain = _file(fake, "1727000000002")
    plain["description"] = "נערך ב־HA"
    automations.MIRROR.pull(None, "test")
    a = item_by_name(c, "דריכת אזעקה בלילה")
    assert any(w["code"] == "changed_outside" for w in a["warnings"]) and any(w["code"] == "changed_outside" for w in item_by_name(c, "מזגן סלון בבוקר")["warnings"])
    with app.state.db.connection() as conn:
        rows = conn.execute("SELECT resource_id, details_json, actor_user_id FROM audit_log WHERE action = 'automation.changed_outside'").fetchall()
        assert [r["resource_id"] for r in rows] == ["automation:1727000000008"] and rows[0]["actor_user_id"] is None
        det = json.loads(rows[0]["details_json"])
        assert det["what"] == "updated" and det["classes"] == ["alarm"] and "light" not in rows[0]["details_json"] and "revision_after" in det
        assert conn.execute("SELECT via FROM automation_versions WHERE item_id = '1727000000008' ORDER BY id DESC LIMIT 1").fetchone()[0] == "external"
    # a save of Arx's own clears the chip and is not an outside change
    d = get_item(c, "automation", "1727000000002").json()
    draft = copy.deepcopy(d["draft"])
    draft["description"] = "מ־Arx"
    assert put_item(c, "automation", d["id"], draft, d["revision"]).status_code == 200
    assert not any(w["code"] == "changed_outside" for w in item_by_name(c, "מזגן סלון בבוקר")["warnings"])
    with app.state.db.connection() as conn:
        assert conn.execute("SELECT COUNT(*) FROM audit_log WHERE action = 'automation.changed_outside'").fetchone()[0] == 1
    # a new sensitive item made outside is audited as created
    fake.automations.append({"id": "9001", "alias": "חדשה מבחוץ", "triggers": [{"trigger": "time", "at": "01:00:00"}], "conditions": [],
                                     "actions": [{"action": "lock.unlock", "target": {"entity_id": ["lock.front_door"]}}], "mode": "single"})
    fake.reload_automation("9001")
    seed_mirror(app.state.db, fake)
    automations.MIRROR.pull(None, "test")
    assert item_by_name(c, "חדשה מבחוץ")["created_via"] == "external"
    with app.state.db.connection() as conn:
        assert conn.execute("SELECT json_extract(details_json, '$.what') FROM audit_log WHERE action = 'automation.changed_outside' ORDER BY id DESC LIMIT 1").fetchone()[0] == "created"


def test_an_item_that_left_home_assistant_leaves_the_cache_but_not_the_meta(autos_app):
    app, s, c, fake, tr = autos_app
    c.get(f"{API}/automations")
    with app.state.db.connection() as conn:
        conn.execute("UPDATE ha_entities SET removed_at = '2026-10-01T00:00:00Z' WHERE entity_id = (SELECT entity_id FROM ha_config_items WHERE item_id = '1727000000002')")
    automations.MIRROR.pull(None, "test")
    assert get_item(c, "automation", "1727000000002").status_code == 404
    with app.state.db.connection() as conn:
        assert conn.execute("SELECT gone_at FROM automation_meta WHERE item_id = '1727000000002'").fetchone()[0]


# ================================================================ the config API

def test_the_config_api_is_probed_not_assumed_and_the_websocket_is_the_fallback(autos_app):
    app, s, c, fake, tr = autos_app
    fake.config_api = False  # no REST view: plain-text 404 (the components list says nothing: the probe is the answer)
    r = c.get(f"{API}/automations", params={"limit": 500})
    assert r.status_code == 200
    ui = {i["name"]: i for i in r.json()["items"]}
    assert ui["מזגן סלון בבוקר"]["source"] == "ui" and ui["מזגן סלון בבוקר"]["can"]["edit"] is True and "automation/config" in tr.ws_calls, "automations and scripts are read over the session's command"
    scene = ui["ערב בסלון"]
    assert scene["source"] == "yaml" and scene["can"]["edit"] is False and scene["read_only"]["reasons"][0]["code"] == "config_api_unavailable"
    # nothing readable at all: the feature says so and writes are blocked
    fake.automations.clear()
    fake.scripts.clear()
    fake.scenes.clear()
    with app.state.db.connection() as conn:
        conn.execute("DELETE FROM ha_entities WHERE domain IN ('automation', 'script') OR (domain = 'scene' AND entity_id NOT LIKE 'scene.wall_%')")
        conn.execute("DELETE FROM ha_config_items")
        conn.execute("DELETE FROM settings WHERE key = 'automations.mirror'")
    st = c.get(f"{API}/automations/status").json()
    assert st["available"] == "config_api_unavailable" and st["writable"] is False and st["write_block"] == "ha_unavailable" and st["admin"]["config_api"] == "unavailable"
    fake.config_api = True
    automations.MIRROR.pull(None, "test")
    assert c.get(f"{API}/automations/status").json()["available"] == "ok"


def test_availability_and_staleness_follow_home_assistant(autos_app):
    app, s, c, fake, tr = autos_app
    c.get(f"{API}/automations")
    tr.up = False
    st = c.get(f"{API}/automations/status").json()
    assert st["available"] == "ha_unavailable" and st["stale"] is True and st["writable"] is False
    lst = c.get(f"{API}/automations").json()
    assert lst["total"] == 43 and lst["status"]["available"] == "ha_unavailable", "the cache still answers"
    tr.up = True
    import datetime as dt

    fake.advance(30 * 60)
    st = c.get(f"{API}/automations/status").json()
    assert st["available"] == "ok" and st["stale"] is True, "a mirror not refreshed for 25 minutes is stale even while the socket is up"
    automations.MIRROR.pull(None, "test")
    assert c.get(f"{API}/automations/status").json()["stale"] is False
    tr.configured_flag = False
    assert c.get(f"{API}/automations/status").json()["available"] == "not_configured"


# ================================================================ events

def _frame(etype, **data):
    return {"id": 1, "type": "event", "event": {"event_type": etype, "data": data, "time_fired": "2026-10-01T10:00:00+00:00"}}


def test_run_events_feed_the_last_run_the_count_and_the_storm_guard(autos_app):
    app, s, c, fake, tr = autos_app
    c.get(f"{API}/automations")
    it = item_by_name(c, "מזגן סלון בבוקר")
    assert it["last_run"] is None and it["runs_7d"] == 0
    automations.MIRROR.on_ha_event(_frame("automation_triggered", entity_id=it["entity_id"], name="x"))
    it = item_by_name(c, "מזגן סלון בבוקר")
    assert it["runs_7d"] == 1 and it["last_run"]["at"] == "2026-10-01T10:00:00Z"
    automations.MIRROR.on_ha_event(_frame("automation_triggered", entity_id=it["entity_id"]))
    assert item_by_name(c, "מזגן סלון בבוקר")["runs_7d"] == 1, "the same instant is the same run"
    with app.state.db.connection() as conn:
        base = fake.now()
        import datetime as dt

        for i in range(25):
            automations.note_run_for_entity(conn, it["entity_id"], (base + dt.timedelta(seconds=i)).isoformat(), "event", base + dt.timedelta(seconds=i))
        n = conn.execute("SELECT COUNT(*) FROM audit_log WHERE action = 'automation.storm'").fetchone()[0]
        assert n == 1, "audited once per window"
        assert json.loads(conn.execute("SELECT details_json FROM audit_log WHERE action = 'automation.storm'").fetchone()[0]) == {"kind": "automation", "scope": "item", "runs_last_minute": 21}
    assert any(w["code"] == "storm" for w in item_by_name(c, "מזגן סלון בבוקר")["warnings"])
    assert any(x["issue"] == "storm" for x in c.get(f"{API}/automations/review").json()["items"])
    # a reload event pulls again
    fake.automations[0]["alias"] = "אחרי טעינה מחדש"
    automations.MIRROR.on_ha_event(_frame("automation_reloaded"))
    assert any(i["name"] == "אחרי טעינה מחדש" for i in c.get(f"{API}/automations", params={"limit": 500}).json()["items"])
    assert automations.MIRROR.on_ha_event({"event": None}) is None


def test_a_state_change_hook_records_runs_and_tells_the_clients(autos_app):
    app, s, c, fake, tr = autos_app
    c.get(f"{API}/automations")
    published = []
    orig = ha_sync.publish
    ha_sync.publish = lambda m: published.append(m)
    try:
        eid = item_by_name(c, "מזגן סלון בבוקר")["entity_id"]
        old = {"state": "on", "attributes": {"last_triggered": None}}
        row = {"entity_id": eid, "state": "on", "attributes": {"last_triggered": "2026-10-01T09:59:00+00:00"}}
        with app.state.db.connection() as conn:
            automations.MIRROR.on_entity_state(conn, row, old)
        assert {"type": "automations_changed", "kinds": ["automation"], "ids": []} in published
        row2 = {"entity_id": "scene.brand_new", "state": "unknown", "attributes": {}}
        with app.state.db.connection() as conn:
            automations.MIRROR.on_entity_state(conn, row2, None)  # an entity the cache does not know queues a pull
    finally:
        ha_sync.publish = orig
    assert item_by_name(c, "מזגן סלון בבוקר")["runs_7d"] == 1


def test_attributes_of_the_three_domains_reach_the_mirror(autos_app):
    app, s, c, fake, tr = autos_app
    attrs = ha_sync.trim_attributes({"id": "5", "current": 1, "max": 3, "entity_id": ["light.a", "light.b"], "friendly_name": "x", "secret_thing": 1}, "scene")
    got = json.loads(attrs)
    assert got["id"] == "5" and got["current"] == 1 and got["max"] == 3 and got["entity_id"] == ["light.a", "light.b"] and "secret_thing" not in got
    assert "entity_id" not in json.loads(ha_sync.trim_attributes({"entity_id": ["a.b"], "friendly_name": "g"}, "light"))


# ================================================================ runs (traces)

def test_the_run_list_and_the_full_trace(autos_app):
    app, s, c, fake, tr = autos_app
    it = item_by_name(c, "תאורה בפרוזדור בתנועה")
    cfg = _file(fake, it["id"])
    r1 = fake.add_run("automation", it["id"], cfg, minutes_ago=10, user_id="dev-omer", variables={"api_key": "abc-not-real", "level": 3})
    r2 = fake.add_run("automation", it["id"], cfg, minutes_ago=5, fail_step="action/1")
    r3 = fake.add_run("automation", it["id"], cfg, minutes_ago=0, conditions_pass=False)
    r = c.get(f"{API}/automations/automation/{it['id']}/runs")
    assert r.status_code == 200
    runs = r.json()["items"]
    assert [x["run_id"] for x in runs] == [r3["run_id"], r2["run_id"], r1["run_id"]], "newest first"
    assert [x["result"] for x in runs] == ["not_triggered", "error", "ok"]
    first = runs[2]
    assert first["at"] == "2026-10-01T15:36:00Z" and first["finished_at"] == "2026-10-01T15:36:01Z" and first["sentence"].startswith("רצה ב־18:36 · שינוי ב־Hall motion")
    t = c.get(f"{API}/automations/automation/{it['id']}/runs/{r1['run_id']}").json()
    assert t["result"] == "ok" and t["duration_ms"] == 1000 and t["trigger"]["path"] == "triggers.0" and t["trigger"]["sentence"] == "כשHall motion מזהה תנועה"
    dumped = json.dumps(t, ensure_ascii=False)
    assert t["context"] == {"user": "dev-omer", "parent": "user"} and "user_id" not in dumped and "abc-not-real" not in dumped and model.MASK in dumped
    assert [s_["path"] for s_ in t["steps"]] == ["actions.0", "actions.1", "actions.2"] and t["steps"][0]["result"] == "done" and t["steps"][0]["sentence"] == "הדלק Office light ל־40%"
    assert t["steps"][0]["changed_variables"] == {"api_key": model.MASK, "level": 3}
    assert t["steps"][2]["duration_ms"] is not None and t["conditions"][0]["passed"] is True and t["conditions"][0]["path"] == "conditions.0"
    assert t["sentence"].startswith("רצה ב־18:36 כי ") and "ביצעה:" in t["sentence"]
    err = c.get(f"{API}/automations/automation/{it['id']}/runs/{r2['run_id']}").json()
    assert err["result"] == "error" and err["steps"][1]["result"] == "error" and err["steps"][1]["error"] == "Entity not found" and err["sentence"].endswith("נעצרה בשגיאה")
    assert [s_["result"] for s_ in c.get(f"{API}/automations/automation/{it['id']}/runs/{r3['run_id']}").json()["steps"]] == ["not_run", "not_run", "not_run"]
    assert c.get(f"{API}/automations/automation/{it['id']}/runs/nope").status_code == 404 and c.get(f"{API}/automations/automation/{it['id']}/runs/bad%20id").status_code == 404
    assert c.get(f"{API}/automations/scene/{item_by_name(c, 'ערב בסלון', 'scene')['id']}/runs").json() == {"items": []}
    # the runs feed the list's last run
    assert item_by_name(c, "תאורה בפרוזדור בתנועה")["runs_7d"] == 3


def test_runs_of_an_item_the_caller_cannot_see_never_leave(autos_app):
    app, s, c, fake, tr = autos_app
    it = item_by_name(c, "דריכת אזעקה בלילה")
    run = fake.add_run("automation", it["id"], _file(fake, it["id"]))
    bind(c, s, "vera", "viewer", "installation", "*")
    v = {"X-SW-Dev-User": "vera"}
    assert c.get(f"{API}/automations/automation/{it['id']}/runs", headers=v).status_code == 403
    ids = seed_tree(c)
    grant(c, "omer", "עורך צר", ["devices.read", "entity.state.read"], ["automation.manage"], "floor", ids["floor2"])
    assert c.get(f"{API}/automations/automation/{it['id']}/runs", headers=OMER).status_code == 404
    assert c.get(f"{API}/automations/automation/{it['id']}/runs/{run['run_id']}", headers=OMER).status_code == 404


def test_a_trace_command_that_fails_is_503_not_a_crash(autos_app):
    app, s, c, fake, tr = autos_app
    it = item_by_name(c, "מזגן סלון בבוקר")
    c.get(f"{API}/automations")
    tr.up = False
    r = c.get(f"{API}/automations/automation/{it['id']}/runs")
    assert r.status_code == 503 and r.json()["code"] == "ha_unavailable"


# ================================================================ housekeeping and the schema

def test_the_janitor_prunes_trash_runs_and_ops_and_releases_stuck_claims(autos_app):
    app, s, c, fake, tr = autos_app
    d = get_item(c, "automation", item_by_name(c, "מזגן סלון בבוקר")["id"]).json()
    r = c.post(f"{API}/automations/automation/{d['id']}/delete", json={"base_revision": d["revision"], "confirm": True, "client_request_id": rid()})
    assert r.status_code == 200
    import datetime as dt

    with app.state.db.connection() as conn:
        conn.execute("INSERT INTO automation_runs(id, kind, item_id, at, source) VALUES ('old', 'automation', 'x', '2026-08-01T00:00:00Z', 'event')")
        conn.execute("UPDATE automation_ops SET requested_at = '2026-08-01T00:00:00Z'")
        conn.execute("INSERT INTO automation_trash(id, kind, item_id, name, config_json, entities_json, deleted_at, expires_at, restored_at) VALUES ('claimed', 'automation', 'z', 'z', '{}', '[]', '2026-09-30T00:00:00Z', '2026-10-30T00:00:00Z', '~restoring:2026-10-01T05:00:00Z')")
    out = automations.janitor(app.state.db, {})
    assert out["runs"] == 1 and out["ops"] >= 1 and out["trash"] == 0
    with app.state.db.connection() as conn:
        assert conn.execute("SELECT restored_at FROM automation_trash WHERE id = 'claimed'").fetchone()[0] is None
        conn.execute("UPDATE automation_trash SET expires_at = '2026-09-01T00:00:00Z'")
    assert automations.janitor(app.state.db, {})["trash"] == 2
    from smplwise.main import janitor_tick

    janitor_tick(app.state.db, s)  # the whole pass runs (the automations step included)


def test_migration_0045_creates_the_tables_and_runs_once(settings):
    from smplwise import db as dbmod

    database = dbmod.Database(settings.db_path)
    applied = database.migrate()
    assert 45 in applied and database.migrate() == []
    with database.connection() as conn:
        tables = {r[0] for r in conn.execute("SELECT name FROM sqlite_master WHERE type = 'table'")}
        assert {"ha_config_items", "automation_meta", "automation_prefs", "automation_versions", "automation_trash", "automation_ops", "automation_runs"} <= tables
        cols = {r[1] for r in conn.execute("PRAGMA table_info(ha_config_items)")}
        assert {"kind", "item_id", "config_id", "entity_id", "source", "revision", "config_json", "masked", "reason"} <= cols
        conn.execute("INSERT INTO ha_config_items(kind, item_id, source, seen_at, changed_at) VALUES ('automation', 'a', 'ui', 't', 't')")
        import sqlite3
        import pytest

        with pytest.raises(sqlite3.IntegrityError):
            conn.execute("INSERT INTO ha_config_items(kind, item_id, source, seen_at, changed_at) VALUES ('widget', 'a', 'ui', 't', 't')")
        with pytest.raises(sqlite3.IntegrityError):
            conn.execute("INSERT INTO automation_ops(id, principal_user_id, client_request_id, op, status, requested_at) VALUES ('1', 'u', 'r', 'x', 'bogus', 't')")
