"""CR-014 schedules - the 30-day trash and restore, the derived runs, the administrator's review list and the janitor
(docs/architecture/SCHEDULER_API.md §3.13, §3.16, §3.17, §5.10, §6.6). Runs are DERIVED: a slot skipped by its conditions
produces no `triggered` state and therefore no row; a `triggered` switch starts a pending row that is settled 20 s later
with the product's confirmation logic; a sensitive schedule also writes the system audit row `schedule.executed`."""
from __future__ import annotations

import datetime as dt
import json

from schedules_fixture import *  # noqa: F401,F403
from schedules_fixture import grant as _grant, sched_app  # noqa: F401
from smplwise.services import ha_sync, schedules

API = "/api/v1"
OMER = {"X-SW-Dev-User": "omer"}


def _by_name(c, name, headers=None):
    return next(s for s in c.get(f"{API}/schedules", params={"limit": 500}, headers=headers or {}).json()["items"] if s["name"] == name)


def _runs(c, headers=None, **q):
    r = c.get(f"{API}/schedules/runs", params=q, headers=headers or {})
    assert r.status_code == 200, r.text
    return r.json()["items"]


def _delete(c, sch, **kw):
    r = post_json(c, f"/schedules/{sch['id']}/delete", {"base_revision": sch["revision"], "confirm": True, "client_request_id": rid(), **kw})
    assert r.status_code == 200, r.text
    return r.json()


def _set_state(app, entity_id, state, **attrs):
    with app.state.db.connection() as conn:
        row = conn.execute("SELECT attributes_json FROM ha_entities WHERE entity_id = ?", (entity_id,)).fetchone()
        old = json.loads(row["attributes_json"] or "{}") if row else {}
        ha_sync.upsert_state(conn, {"entity_id": entity_id, "state": state, "attributes": {**old, **attrs}, "last_changed": "2026-09-30T10:05:00+00:00", "last_updated": "2026-09-30T10:05:00+00:00"})


def _trigger(app, fake, sid, old_state="on"):
    """Feed the switch's `triggered` state through the product's own state path."""
    st = fake.states[sid]
    assert st["state"] == "triggered", st
    new = {"entity_id": st["entity_id"], "state": "triggered", "attributes": dict(st["attributes"]), "last_changed": f"{fake.now().isoformat()}", "last_updated": f"{fake.now().isoformat()}"}
    ha_sync.handle_state_event(app.state.db, {"entity_id": st["entity_id"], "new_state": new, "old_state": {"entity_id": st["entity_id"], "state": old_state, "attributes": {}}})


def _settle(app, fake, seconds=25):
    with app.state.db.connection() as conn:
        return schedules.settle_runs(conn, fake.now() + dt.timedelta(seconds=seconds))


# ---------------------------------------------------------------- trash and restore

def test_the_trash_lists_restores_and_expires(sched_app):
    app, s, c, fake, tr = sched_app
    sch = _by_name(c, "Hall lights on rest days")
    org = c.put(f"{API}/schedules/organisation", json={"folders": [{"id": "lights", "name": "Lights", "position": 0}], "items": [{"schedule_id": sch["id"], "folder_id": "lights", "order": 4, "pinned": True}]})
    assert org.status_code == 200
    out = _delete(c, sch)
    trash = c.get(f"{API}/schedules/trash").json()["items"]
    assert [t["trash_id"] for t in trash] == [out["trash_id"]] and trash[0]["deleted_by"] == {"username": "joni", "display_name": "joni"} and trash[0]["sensitive"] is False
    expires = dt.datetime.fromisoformat(out["expires_at"].replace("Z", "+00:00"))
    assert expires - fake.now() == dt.timedelta(days=30)
    n = len(fake.items)
    r = post_json(c, f"/schedules/trash/{out['trash_id']}/restore", {"client_request_id": rid()})
    assert r.status_code == 201, r.text
    back = r.json()["schedule"]
    assert back["id"] != sch["id"] and back["name"] == "Hall lights on rest days" and back["source"] == "arx" and len(fake.items) == n + 1
    assert [x["service"] for sl in back["slots"] for x in sl["actions"]] == [x["service"] for sl in sch["slots"] for x in sl["actions"]]
    assert back["conditions"]["items"][0]["entity_id"] == SHABBAT and back["tags"] == []  # tags are not written until verified (P0-3)
    assert (back["folder_id"], back["order"], back["pinned"]) == ("lights", 4, True)  # the meta moves with it
    assert c.get(f"{API}/schedules/trash").json()["items"] == []
    r = post_json(c, f"/schedules/trash/{out['trash_id']}/restore", {"client_request_id": rid()})
    assert r.status_code == 404 and r.json()["code"] == "trash_not_found" and r.json()["user_message"] == "הפריט אינו בסל המחזור (ייתכן שפג תוקפו)."
    with app.state.db.connection(mode="read") as conn:
        a = conn.execute("SELECT * FROM audit_log WHERE action = 'schedule.restore' AND decision = 'allowed'").fetchone()
        assert json.loads(a["details_json"])["restored_schedule_id"] == back["id"]


def test_an_expired_trash_item_is_gone_and_the_janitor_purges_it(sched_app):
    app, s, c, fake, tr = sched_app
    out = _delete(c, _by_name(c, "Gym shutter"))
    fake._t += dt.timedelta(days=31)
    assert c.get(f"{API}/schedules/trash").json()["items"] == []
    r = post_json(c, f"/schedules/trash/{out['trash_id']}/restore", {"client_request_id": rid()})
    assert r.status_code == 404 and r.json()["code"] == "trash_not_found"
    with app.state.db.connection(mode="read") as conn:
        assert conn.execute("SELECT COUNT(*) FROM schedule_trash").fetchone()[0] == 1
    res = schedules.janitor(app.state.db, {"schedules.runs_retention_days": 90})
    assert res["trash"] == 1
    with app.state.db.connection(mode="read") as conn:
        assert conn.execute("SELECT COUNT(*) FROM schedule_trash").fetchone()[0] == 0


def test_purge_is_installation_wide_and_touches_arx_data_only(sched_app):
    app, s, c, fake, tr = sched_app
    ids = seed_tree(c)
    out = _delete(c, _by_name(c, "Gym shutter"))
    n = len(fake.bridge_calls)
    r = post_json(c, f"/schedules/trash/{out['trash_id']}/purge", {"confirm": False})
    assert r.status_code == 409 and r.json()["code"] == "confirmation_required"
    from schedules_fixture import place

    place(c, ids["floor2"], "cover.gym_shutter")
    _grant(c, "omer", "עורך תזמונים", ["schedule.view", "devices.read", "entity.state.read", "devices.control"], ["schedule.manage"], "floor", ids["floor2"])
    r = post_json(c, f"/schedules/trash/{out['trash_id']}/purge", {"confirm": True}, OMER)
    assert r.status_code == 403 and r.json()["code"] == "forbidden"  # a floor-scoped editor cannot purge
    r = post_json(c, f"/schedules/trash/{out['trash_id']}/purge", {"confirm": True})
    assert r.status_code == 200 and r.json() == {"ok": True} and len(fake.bridge_calls) == n  # nothing reaches the component
    assert c.get(f"{API}/schedules/trash").json()["items"] == []
    assert post_json(c, f"/schedules/trash/{out['trash_id']}/purge", {"confirm": True}).status_code == 404


def test_restore_is_judged_under_the_current_rules(sched_app):
    app, s, c, fake, tr = sched_app
    gate = _by_name(c, "Gate")
    out = _delete(c, gate)
    tr_item = c.get(f"{API}/schedules/trash").json()["items"][0]
    assert tr_item["sensitive"] is True and tr_item["entities"][0]["class"] == "door"
    # a lowering schedule needs the confirmation again
    r = post_json(c, f"/schedules/trash/{out['trash_id']}/restore", {"client_request_id": rid()})
    assert r.status_code == 409 and r.json()["code"] == "lowering_confirmation_required"
    # a class switched off since
    assert c.patch(f"{API}/settings", json={"schedules.classes": ["light", "switch", "cover", "climate", "fan", "alarm", "lock"]}).status_code == 200
    r = post_json(c, f"/schedules/trash/{out['trash_id']}/restore", {"client_request_id": rid(), "confirm_lowering": True})
    assert r.status_code == 422 and r.json()["code"] == "class_not_allowed"
    assert c.get(f"{API}/schedules/trash").json()["items"][0]["can_restore"] is False  # restore is judged under the current rules, classes included
    assert c.patch(f"{API}/settings", json={"schedules.classes": ["light", "switch", "cover", "climate", "fan", "alarm", "lock", "door"]}).status_code == 200
    # a plain manager may not restore a sensitive schedule; nor see it restorable
    _grant(c, "omer", "מנהל תזמונים", ["schedule.view", "devices.read", "entity.state.read", "devices.control"], ["schedule.manage", "ha.entity.control"], "installation", "*")
    assert c.get(f"{API}/schedules/trash", headers=OMER).json()["items"][0]["can_restore"] is False
    r = post_json(c, f"/schedules/trash/{out['trash_id']}/restore", {"client_request_id": rid(), "confirm_lowering": True}, OMER)
    assert r.status_code == 403 and r.json()["code"] == "sensitive_permission_required"
    r = post_json(c, f"/schedules/trash/{out['trash_id']}/restore", {"client_request_id": rid(), "confirm_lowering": True})
    assert r.status_code == 201 and r.json()["schedule"]["enabled"] is False  # it was disabled when deleted, so it comes back disabled
    assert r.json()["schedule"]["lowering"] is True


def test_an_unsupported_schedule_cannot_be_restored_through_arx(sched_app):
    app, s, c, fake, tr = sched_app
    unnamed = next(s_ for s_ in c.get(f"{API}/schedules", params={"limit": 500}).json()["items"] if s_["name"] is None or s_["name"] == "")
    out = _delete(c, unnamed)  # the safety valve: an installation-wide manager may delete it
    r = post_json(c, f"/schedules/trash/{out['trash_id']}/restore", {"client_request_id": rid()})
    assert r.status_code == 422 and r.json()["code"] == "unsupported_content"
    assert c.get(f"{API}/schedules/trash").json()["items"][0]["can_restore"] is False


def test_trash_visibility_follows_the_action_entities(sched_app):
    app, s, c, fake, tr = sched_app
    ids = seed_tree(c)
    from schedules_fixture import place

    place(c, ids["floor2"], "cover.gym_shutter")
    _delete(c, _by_name(c, "Gym shutter"))
    _delete(c, _by_name(c, "Hall lights on rest days"))
    _grant(c, "omer", "עורך תזמונים", ["schedule.view", "devices.read", "entity.state.read", "devices.control"], ["schedule.manage"], "floor", ids["floor2"])
    assert [t["name"] for t in c.get(f"{API}/schedules/trash", headers=OMER).json()["items"]] == ["Gym shutter"]
    assert sorted(t["name"] for t in c.get(f"{API}/schedules/trash").json()["items"]) == ["Gym shutter", "Hall lights on rest days"]


# ---------------------------------------------------------------- runs

def test_a_slot_skipped_by_its_conditions_produces_no_run(sched_app):
    app, s, c, fake, tr = sched_app
    fake.world[SHABBAT]["state"] = "off"
    sid = next(i for i, it in fake.items.items() if it["name"] == "Hall lights on rest days")
    assert c.get(f"{API}/schedules").status_code == 200
    fake.tick(6 * 3600)  # the slot at 18:00 (local) passes
    assert [f for f in fake.actions_fired if f["schedule_id"] == sid] == [] and fake.states[sid]["state"] == "on"  # never `triggered`: nothing for the mirror to see
    assert _runs(c) == []


def test_a_triggered_switch_starts_a_run_that_is_settled_by_what_the_devices_report(sched_app):
    app, s, c, fake, tr = sched_app
    fake.world[SHABBAT]["state"] = "on"
    sid = next(i for i, it in fake.items.items() if it["name"] == "Living room cooling on rest days")
    assert c.get(f"{API}/schedules").status_code == 200
    fake.tick(3 * 3600 + 60)  # 16:00 local: the slot starting at 16:00 fires (set temperature 25 - slot index 3? see below)
    assert fake.states[sid]["state"] == "triggered"
    slot_index = fake.states[sid]["attributes"]["current_slot"]
    _trigger(app, fake, sid)
    runs = _runs(c)
    assert len(runs) == 1 and runs[0]["schedule_id"] == sid and runs[0]["result"] == "pending" and runs[0]["via"] == "component" and runs[0]["slot_index"] == slot_index and runs[0]["sensitive"] is False
    assert runs[0]["schedule_name"] == "Living room cooling on rest days" and runs[0]["settled_at"] is None
    # the same `triggered` frame again does not make a second row
    _trigger(app, fake, sid, old_state="on")
    assert len(_runs(c)) == 1
    assert _settle(app, fake, 5) == 0  # not due yet: 20 s
    entity = fake.items[sid]["timeslots"][slot_index]["actions"][0]
    if entity["service"] == "climate.turn_off":
        _set_state(app, "climate.living_room", "off")
    else:
        _set_state(app, "climate.living_room", "cool", temperature=25)
    assert _settle(app, fake) == 1
    done = _runs(c)[0]
    assert done["result"] == "confirmed" and done["settled_at"] and done["detail"]["entities"][0]["entity_id"] == "climate.living_room" and done["detail"]["entities"][0]["result"] == "confirmed"


def test_run_results_not_confirmed_skipped_and_unknown(sched_app):
    app, s, c, fake, tr = sched_app
    fake.world[SHABBAT]["state"] = "on"
    sid = next(i for i, it in fake.items.items() if it["name"] == "Hall lights on rest days")
    assert c.get(f"{API}/schedules").status_code == 200
    fake.tick(5 * 3600 + 60)  # 18:00 local: switch.turn_on
    _trigger(app, fake, sid)
    _set_state(app, "switch.hall_lights", "off")
    assert _settle(app, fake) == 1
    r = _runs(c)[0]
    assert r["result"] == "not_confirmed" and r["detail"]["entities"] == [{"entity_id": "switch.hall_lights", "expected": "on", "observed": "off", "result": "not_confirmed"}]
    # an unavailable device: skipped, never "failed"
    with app.state.db.connection() as conn:
        conn.execute("DELETE FROM schedule_runs")
    fake._triggered_until.clear()
    fake._sync_state(sid)
    fake.states[sid]["state"] = "triggered"
    fake.states[sid]["attributes"]["current_slot"] = 1
    _set_state(app, "switch.hall_lights", "unavailable")
    _trigger(app, fake, sid, old_state="on")
    assert _settle(app, fake) == 1 and _runs(c)[0]["result"] == "skipped"
    # a service nothing observable confirms (a cover stop) is "unknown"
    with app.state.db.connection() as conn:
        conn.execute("DELETE FROM schedule_runs")
        conn.execute("INSERT INTO schedule_runs(id, schedule_id, slot_index, started_at, result, sensitive, via) VALUES ('rz', ?, 0, ?, 'pending', 0, 'component')", (sid, fake.now().isoformat().replace("+00:00", "Z")))
    fake.items[sid]["timeslots"][0]["actions"] = [{"service": "cover.stop_cover", "entity_id": "cover.gym_shutter", "service_data": {}}]
    schedules.MIRROR.pull(None, "t")
    assert _settle(app, fake) == 1 and _runs(c)[0]["result"] == "unknown"


def test_a_sensitive_run_writes_the_system_audit_row(sched_app):
    app, s, c, fake, tr = sched_app
    sid = next(i for i, it in fake.items.items() if it["name"] == "Arm the home panel")
    assert c.get(f"{API}/schedules").status_code == 200  # the first read pulls: the mirror knows what the schedule does
    fake.tick(13 * 3600)  # 23:30 local
    assert fake.states[sid]["state"] == "triggered"
    _trigger(app, fake, sid)
    r = _runs(c)[0]
    assert r["sensitive"] is True
    with app.state.db.connection(mode="read") as conn:
        a = conn.execute("SELECT * FROM audit_log WHERE action = 'schedule.executed'").fetchall()
        assert len(a) == 1 and a[0]["actor_user_id"] is None and a[0]["resource_id"] == sid and json.loads(a[0]["details_json"])["slot_index"] == 0
    _set_state(app, "alarm_control_panel.home_panel", "armed_home")
    _settle(app, fake)
    assert _runs(c)[0]["result"] == "confirmed"


def test_run_now_makes_its_own_row_and_the_component_s_triggered_frame_does_not_duplicate_it(sched_app):
    app, s, c, fake, tr = sched_app
    sch = _by_name(c, "Office light on weekdays")
    r = post_json(c, f"/schedules/{sch['id']}/run", {"slot_index": 0, "client_request_id": rid()})
    assert r.status_code == 202
    runs = _runs(c)
    assert len(runs) == 1 and runs[0]["via"] == "run_now" and runs[0]["id"] == r.json()["run_id"] and runs[0]["slot_index"] == 0
    assert fake.states[sch["id"]]["state"] == "triggered"  # the fake's run_action (conditions passed: none) entered `triggered`
    _trigger(app, fake, sch["id"])
    assert len(_runs(c)) == 1
    _set_state(app, "light.office", "on", brightness=51)
    assert _settle(app, fake) == 1 and _runs(c)[0]["result"] == "confirmed"
    assert c.get(f"{API}/schedules/{sch['id']}").json()["last_run"]["result"] == "confirmed"


def test_runs_filters_and_visibility(sched_app):
    app, s, c, fake, tr = sched_app
    a, b = _by_name(c, "Office light on weekdays")["id"], _by_name(c, "Gym shutter")["id"]
    with app.state.db.connection() as conn:
        for rid_, sid, at, result in (("r1", a, "2026-09-29T08:00:00Z", "confirmed"), ("r2", a, "2026-09-30T08:00:00Z", "not_confirmed"), ("r3", b, "2026-09-30T09:00:00Z", "skipped"), ("r4", "gone00", "2026-09-30T09:30:00Z", "confirmed")):
            conn.execute("INSERT INTO schedule_runs(id, schedule_id, slot_index, started_at, settled_at, result, sensitive, via) VALUES (?,?,0,?,?,?,0,'component')", (rid_, sid, at, at, result))
    assert [r["id"] for r in _runs(c)] == ["r3", "r2", "r1"]  # newest first, a schedule the caller cannot see (or that is gone) never appears
    assert [r["id"] for r in _runs(c, schedule_id=a)] == ["r2", "r1"] and [r["id"] for r in _runs(c, result="skipped")] == ["r3"]
    assert [r["id"] for r in _runs(c, since="2026-09-30T00:00:00Z")] == ["r3", "r2"] and len(_runs(c, limit=1)) == 1
    assert c.get(f"{API}/schedules/runs", params={"result": "failed"}).status_code == 422  # wording is never "failed"
    assert c.get(f"{API}/schedules/runs", params={"limit": 500}).status_code == 422


def test_the_janitor_prunes_old_runs_and_settled_ops(sched_app):
    app, s, c, fake, tr = sched_app
    sid = next(iter(fake.items))
    with app.state.db.connection() as conn:
        conn.execute("INSERT INTO schedule_runs(id, schedule_id, slot_index, started_at, result) VALUES ('old', ?, 0, '2026-01-01T00:00:00Z', 'confirmed')", (sid,))
        conn.execute("INSERT INTO schedule_runs(id, schedule_id, slot_index, started_at, result) VALUES ('old_pending', ?, 0, '2026-01-01T00:00:00Z', 'pending')", (sid,))
        conn.execute("INSERT INTO schedule_runs(id, schedule_id, slot_index, started_at, result) VALUES ('new', ?, 0, '2026-09-29T00:00:00Z', 'confirmed')", (sid,))
        conn.execute("INSERT INTO schedule_ops(id, principal_user_id, client_request_id, op, status, requested_at) VALUES ('o1', 'u', 'c1', 'create', 'ok', '2026-01-01T00:00:00Z')")
        conn.execute("INSERT INTO schedule_ops(id, principal_user_id, client_request_id, op, status, requested_at) VALUES ('o2', 'u', 'c2', 'create', 'pending', '2026-01-01T00:00:00Z')")
    res = schedules.janitor(app.state.db, {"schedules.runs_retention_days": 90})
    assert res["runs"] == 1 and res["ops"] == 1 and res["settled"] == 1  # the old pending run is settled (unknown), not pruned in the same pass
    with app.state.db.connection(mode="read") as conn:
        assert {r[0] for r in conn.execute("SELECT id FROM schedule_runs").fetchall()} == {"old_pending", "new"}
        assert {r[0] for r in conn.execute("SELECT id FROM schedule_ops").fetchall()} == {"o2"}
    from smplwise.main import janitor_tick

    janitor_tick(app.state.db, s)  # the whole pass, end to end


# ---------------------------------------------------------------- the review list (§5.10)

def test_the_review_lists_what_needs_an_administrator(sched_app):
    app, s, c, fake, tr = sched_app
    ids = seed_tree(c)
    from schedules_fixture import place

    place(c, ids["floor2"], "light.office")
    # a schedule an editor made, then lost the binding
    _grant(c, "omer", "עורך תזמונים", ["schedule.view", "devices.read", "entity.state.read", "devices.control"], ["schedule.manage"], "floor", ids["floor2"])
    mine = c.post(f"{API}/schedules", json={"draft": draft_of("Editor made"), "enabled": True, "client_request_id": rid()}, headers=OMER).json()["schedule"]
    review = {i["schedule"]["name"]: i["issues"] for i in c.get(f"{API}/schedules/review").json()["items"]}
    assert "Editor made" not in review  # still holds every right
    with app.state.db.connection() as conn:
        conn.execute("UPDATE bindings SET revoked_at = ? WHERE subject_id = 'dev-omer'", ("2026-09-30T09:00:00Z",))
    review = {i["schedule"]["name"]: i["issues"] for i in c.get(f"{API}/schedules/review").json()["items"]}
    assert review["Editor made"] == ["owner_lost_rights"]
    with app.state.db.connection() as conn:
        conn.execute("UPDATE users SET active = 0 WHERE id = 'dev-omer'")
    assert {i["schedule"]["name"]: i["issues"] for i in c.get(f"{API}/schedules/review").json()["items"]}["Editor made"] == ["owner_inactive"]
    # external + sensitive = no owner; a stored code; unsupported content; an alarm that may need a code
    review = {i["schedule"]["name"] or "": i["issues"] for i in c.get(f"{API}/schedules/review").json()["items"]}
    assert "no_owner_sensitive" in review["Gate"] and "no_owner_sensitive" in review["Arm the home panel"] and review[""] == ["unsupported_content"]
    assert "Living room cooling on rest days" not in review and "Office light on weekdays" not in review  # external but not sensitive: nothing to review
    sid = next(i for i, it in fake.items.items() if it["name"] == "Hall lights on rest days")
    fake.items[sid]["timeslots"][0]["actions"][0]["service_data"]["code"] = "8642"
    schedules.MIRROR.pull(None, "t")
    review = {i["schedule"]["name"] or "": i["issues"] for i in c.get(f"{API}/schedules/review").json()["items"]}
    assert review["Hall lights on rest days"] == ["contains_code"]
    d = c.get(f"{API}/schedules/{sid}").json()
    assert "8642" not in json.dumps(d) and d["slots"][0]["actions"][0]["data"]["code"] == "***" and d["raw"]["timeslots"][0]["actions"][0]["service_data"]["code"] == "***"  # a stored code is never shown
    assert d["can"]["edit"] is False and d["slots"][0]["unsupported"][0]["code"] == "contains_code"
    # a class switched off
    assert c.patch(f"{API}/settings", json={"schedules.classes": ["light", "switch", "cover", "fan", "alarm", "lock", "door"]}).status_code == 200
    review = {i["schedule"]["name"] or "": i["issues"] for i in c.get(f"{API}/schedules/review").json()["items"]}
    assert "class_disabled" in review["Living room cooling on rest days"]
    assert c.get(f"{API}/schedules/status").json()["counts"]["attention"] == len(c.get(f"{API}/schedules/review").json()["items"])


def test_review_needs_installation_wide_manage(sched_app):
    app, s, c, fake, tr = sched_app
    ids = seed_tree(c)
    _grant(c, "omer", "עורך תזמונים", ["schedule.view", "devices.read", "entity.state.read"], ["schedule.manage"], "floor", ids["floor2"])
    assert c.get(f"{API}/schedules/review", headers=OMER).status_code == 403
    _grant(c, "olga", "מנהלת", ["schedule.view", "devices.read", "entity.state.read"], ["schedule.manage"], "installation", "*")
    assert c.get(f"{API}/schedules/review", headers={"X-SW-Dev-User": "olga"}).status_code == 200
