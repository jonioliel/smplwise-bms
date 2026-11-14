"""CR-014 schedules API: every route of docs/architecture/SCHEDULER_API.md §3 against the FAKE component and bridge - no Home
Assistant is contacted. Status and read model, list filters, detail, catalogue, condition candidates, preview, create /
update / enable / run / split / delete / copy, the error codes with their Hebrew texts, idempotency, the 409 conflict, bulk,
rate limits, and that the product never calls `enable_all` / `disable_all` / `reload_storage`."""
from __future__ import annotations

import json

import pytest
from smplwise.services import schedules
from schedules_fixture import *  # noqa: F401,F403
from schedules_fixture import sched_app  # noqa: F401  (the fixture itself)

API = "/api/v1"


def _list(c, **q):
    r = c.get(f"{API}/schedules", params=q)
    assert r.status_code == 200, r.text
    return r.json()


def _by_name(c, name: str) -> dict:
    items = [s for s in _list(c, limit=500)["items"] if s["name"] == name]
    assert items, name
    return items[0]


def test_status_when_feature_is_off_and_on(sched_app):
    app, s, c, fake, tr = sched_app
    st = c.get(f"{API}/schedules/status").json()
    assert st["available"] == "ok" and st["feature_enabled"] is True and st["writable"] is True and st["write_block"] is None
    assert st["capabilities"] == {"tags": True, "negative_sun_offset": True}
    assert st["can"] == {"view": True, "manage": True, "sensitive": True, "configure": True, "acknowledge": True}
    assert st["counts"]["visible"] == 12 and st["counts"]["hidden"] == 0
    assert st["settings"]["shabbat_sensor"]["entity_id"] == SHABBAT and st["settings"]["classes"] == ["light", "switch", "cover", "climate", "fan", "alarm", "lock", "door", "script", "scene", "helper", "humidifier", "vacuum", "siren", "media", "number", "select"]
    assert st["admin"]["bridge_required"] == "0.3.0" and st["admin"]["component"] == "found"
    assert c.patch(f"{API}/settings", json={"schedules.enabled": "false"}).status_code == 200
    off = c.get(f"{API}/schedules/status").json()
    assert off["available"] == "feature_disabled" and off["write_block"] == "feature_disabled" and off["writable"] is False and off["counts"]["visible"] == 0


def test_the_feature_is_off_by_default(settings):
    from fastapi.testclient import TestClient
    from smplwise.main import create_app

    c = TestClient(create_app(settings))
    assert c.get(f"{API}/settings").json()["settings"]["schedules.enabled"] == "false"
    st = c.get(f"{API}/schedules/status").json()
    assert st["available"] == "feature_disabled" and st["feature_enabled"] is False


def test_read_model_of_a_v_live_shaped_schedule(sched_app):
    app, s, c, fake, tr = sched_app
    s1 = _by_name(c, "Living room cooling on rest days")
    assert s1["days"] == {"tokens": ["daily"], "kind": "daily", "days": ["sun", "mon", "tue", "wed", "thu", "fri", "sat"]}
    assert len(s1["slots"]) == 5 and s1["slots"][0]["start"] == {"kind": "fixed", "time": "00:00", "raw": "00:00:00"}
    assert s1["slots"][-1]["stop"]["raw"] == "00:00:00"
    a0 = s1["slots"][0]["actions"][0]
    assert a0["service"] == "climate.set_temperature" and a0["data"] == {"hvac_mode": "cool", "temperature": 25} and a0["class"] == "climate" and a0["supported"] is True and a0["sensitive"] is False
    assert s1["conditions"]["items"][0]["entity_id"] == SHABBAT and s1["conditions"]["items"][0]["readable"] is True and s1["conditions"]["items"][0]["state"] == "off"
    assert s1["conditions"]["summary"] == "רק בשבת ובחג" and s1["conditions"]["preset"] == "only_holy_days" and s1["conditions"]["uniform"] is True
    assert s1["next_run"]["source"] == "component" and s1["next_run"]["conditional"] is True and s1["source"] == "external" and s1["owner"] is None
    assert s1["can"] == {"edit": True, "toggle": True, "run": True, "delete": True, "copy": True} and s1["read_only"] is None
    assert s1["state"] == "on" and s1["enabled"] is True and s1["tags"] == ["shabbat"] and len(s1["revision"]) == 16 and "raw" not in s1
    assert s1["entities"][0]["entity_id"] == "climate.living_room" and s1["entities"][0]["area_name"] == "Living room" and s1["entities"][0]["floor_name"] == "Ground floor"
    # float temperature, disabled, contiguous
    s2 = _by_name(c, "Bedroom 1 cooling on rest days")
    assert s2["enabled"] is False and s2["state"] == "off" and s2["slots"][0]["actions"][0]["data"]["temperature"] == 25.5
    # the "not on rest days" preset
    s11 = _by_name(c, "Not on rest days")
    assert s11["conditions"]["preset"] == "not_holy_days" and s11["conditions"]["summary"] == "לא בשבת ובחג"
    # a sun time and a season
    s8 = _by_name(c, "Yard light in season")
    assert s8["slots"][0]["start"] == {"kind": "sun", "event": "sunset", "offset_min": 30, "raw": "sunset+00:30:00"} and s8["start_date"] == "2026-10-31" and s8["end_date"] == "2027-03-31"
    assert _by_name(c, "One shot watering")["repeat"] == "pause"
    # a point action has no stop
    assert _by_name(c, "Arm the home panel")["slots"][0]["stop"] is None


def test_unsupported_content_is_shown_read_only_and_never_rewritten(sched_app):
    app, s, c, fake, tr = sched_app
    # 2026-10-04: the live pattern "a script called as its own service, no entity" is a SCRIPT action now (its script is gone here: the action
    # is shown, editable and marked as not runnable) - the read-only "original platform" mode is for content Arx truly cannot model
    seven = next(i for i, it in fake.items.items() if it["name"] == "")
    d7 = c.get(f"{API}/schedules/{seven}").json()
    assert d7["read_only"] is None and d7["slots"][0]["actions"][0]["entity_id"] == "script.missing_script" and d7["slots"][0]["actions"][0]["invalid"]["code"] == "entity_missing"
    assert d7["can"]["edit"] is True and d7["can"]["run"] is False
    sid = fake._add({"name": "", "weekdays": ["daily"], "repeat_type": "repeat", "timeslots": [
        {"start": "05:30:00", "stop": None, "conditions": [], "condition_type": None, "track_conditions": False, "actions": [{"service": "notify.notify", "entity_id": None, "service_data": {"message": "hi"}}]}]})
    schedules.MIRROR.pull(None, "t")
    d = c.get(f"{API}/schedules/{sid}").json()
    assert d["display_name"] == "תזמון ללא שם" and d["can"]["edit"] is False and d["can"]["run"] is False
    assert d["slots"][0]["supported"] is False and d["slots"][0]["unsupported"][0]["code"] == "action_without_entity"
    assert d["slots"][0]["actions"][0]["entity_id"] is None and d["slots"][0]["actions"][0]["class"] is None
    assert [r["code"] for r in d["read_only"]["reasons"]] == ["unsupported_content"]
    assert d["raw"]["timeslots"][0]["actions"][0]["service"] == "notify.notify"
    # an edit attempt is refused, and nothing reaches the bridge
    before = len(fake.bridge_calls)
    r = put_draft(c, sid, draft_of("x"), d["revision"])
    assert r.status_code == 422 and r.json()["code"] == "unsupported_content"
    assert len(fake.bridge_calls) == before
    # the safety valve: an installation-wide manager may still disable (it is enabled) it
    r = post_json(c, f"/schedules/{sid}/disable", {"client_request_id": rid()})
    assert r.status_code == 200 and r.json()["changed"] is True and fake.items[sid]["enabled"] is False


def test_detail_has_raw_and_unknown_is_404(sched_app):
    app, s, c, fake, tr = sched_app
    sid = _by_name(c, "Hall lights on rest days")["id"]
    d = c.get(f"{API}/schedules/{sid}").json()
    assert d["raw"]["schedule_id"] == sid and d["raw"]["timeslots"][0]["conditions"][0]["entity_id"] == SHABBAT
    r = c.get(f"{API}/schedules/ffffff")
    assert r.status_code == 404 and r.json()["code"] == "schedule_not_found" and r.json()["user_message"] == "התזמון לא נמצא."


def test_list_filters_sort_and_pagination(sched_app):
    app, s, c, fake, tr = sched_app
    body = _list(c, limit=500)
    assert body["total"] == 12 and body["status"]["available"] == "ok" and body["status"]["stale"] is False
    assert {s["name"] for s in _list(c, tag="shabbat")["items"]} == {"Living room cooling on rest days", "Bedroom 1 cooling on rest days", "Hall lights on rest days", "All bedrooms off"}
    assert _list(c, preset="only_holy_days")["total"] == 4 and _list(c, preset="not_holy_days")["total"] == 1
    assert _list(c, has_conditions="true")["total"] == 5 and _list(c, has_conditions="false")["total"] == 7
    assert _list(c, state="disabled")["total"] == 2 and _list(c, state="enabled")["total"] == 10
    assert _list(c, condition=SHABBAT)["total"] == 5 and _list(c, entity="light.office")["total"] == 2
    assert {s["name"] for s in _list(c, q="gym")["items"]} == {"Gym shutter"}  # entity name / schedule name
    assert {s["name"] for s in _list(c, area="sch_bedrooms")["items"]} >= {"Bedroom 1 cooling on rest days", "All bedrooms off"}
    assert _list(c, floor="sch_upper")["total"] >= 2 and _list(c, day="sat")["total"] == 11
    assert _list(c, sensitive="true")["total"] == 2 and _list(c, editable="false")["total"] == 0 and _list(c, source="arx")["total"] == 0  # 2026-10-04: the script pattern is editable
    names = [s["display_name"] for s in _list(c, sort="name", limit=500)["items"]]
    assert names == sorted(names, key=str.casefold)
    page = _list(c, sort="name", limit=5, offset=5)
    assert page["total"] == 12 and len(page["items"]) == 5 and page["offset"] == 5 and page["limit"] == 5
    # next_run order: soonest first, schedules without a run last
    nxt = [s["next_run"]["at"] for s in _list(c, limit=500)["items"] if s["next_run"]]
    assert nxt == sorted(nxt)
    assert c.get(f"{API}/schedules", params={"limit": 0}).status_code == 422


def test_tags_endpoint(sched_app):
    app, s, c, fake, tr = sched_app
    tags = {t["name"]: t["count"] for t in c.get(f"{API}/schedules/tags").json()["tags"]}
    assert tags == {"shabbat": 4, "offices": 2, "outdoor": 2}


def test_catalog_selectability_and_reasons(sched_app):
    app, s, c, fake, tr = sched_app
    cat = c.get(f"{API}/schedules/catalog").json()
    by = {e["entity_id"]: e for e in cat["entities"]}
    assert by["light.office"]["selectable"] is True and by["light.office"]["class"] == "light" and by["light.office"]["sensitive"] is False
    assert {a["service"] for a in by["light.office"]["actions"]} == {"light.turn_on", "light.turn_off"}
    turn_on = next(a for a in by["light.office"]["actions"] if a["service"] == "light.turn_on")
    assert {x["name"] for x in turn_on["args"]} == {"brightness", "brightness_pct"} and all(not x["required"] for x in turn_on["args"])
    clim = {a["service"]: a for a in by["climate.living_room"]["actions"]}
    temp = next(x for x in clim["climate.set_temperature"]["args"] if x["name"] == "temperature")
    assert (temp["min"], temp["max"], temp["required"]) == (16, 30, True)
    assert next(x for x in clim["climate.set_hvac_mode"]["args"])["choices"] == ["off", "cool", "heat", "auto"]
    assert by["switch.garden_pump"]["selectable"] is True and by["switch.garden_pump"]["class"] == "switch" and by["switch.garden_pump"]["reason"] is None and by["switch.garden_pump"]["actions"]  # CR-019: no mark gates a schedule
    assert by["switch.hall_lights"]["selectable"] is True
    assert by["cover.driveway_gate"]["class"] == "door" and by["cover.driveway_gate"]["sensitive"] is True
    assert next(a for a in by["cover.driveway_gate"]["actions"] if a["service"] == "cover.open_cover")["lowering"] is True
    assert by["cover.gym_shutter"]["class"] == "cover"
    # an alarm panel that needs a code to disarm offers arming only; a lock that needs a code offers nothing
    panel = {a["service"] for a in by["alarm_control_panel.home_panel"]["actions"]}
    assert "alarm_control_panel.alarm_arm_home" in panel and "alarm_control_panel.alarm_disarm" not in panel
    assert "alarm_control_panel.alarm_disarm" in {a["service"] for a in by["alarm_control_panel.shed_panel"]["actions"]}  # owner decision 2026-10-04: allowed by default
    assert by["lock.side_door"]["selectable"] is False and by["lock.side_door"]["reason"]["code"] == "lock_code_needed"
    # the schedules' own switches never appear
    assert not any(e["entity_id"].startswith("switch.schedule_") for e in cat["entities"]) and cat["truncated"] is False
    assert {e["entity_id"] for e in c.get(f"{API}/schedules/catalog", params={"class": "climate"}).json()["entities"]} == {"climate.living_room", "climate.bedroom_1", "climate.bedroom_2", "climate.study"}
    assert [e["entity_id"] for e in c.get(f"{API}/schedules/catalog", params={"q": "gym"}).json()["entities"]] == ["cover.gym_shutter"]


def test_condition_candidates(sched_app):
    app, s, c, fake, tr = sched_app
    cands = c.get(f"{API}/schedules/condition-candidates").json()["entities"]
    ids = [e["entity_id"] for e in cands]
    assert SHABBAT in ids and all(e["suggested_shabbat"] is False for e in cands)  # the fixture id has no calendar marker
    assert {"sensor.outdoor_temperature", "binary_sensor.motion_hall", "sun.sun"} <= set(ids) and "light.office" not in ids
    temp = next(e for e in cands if e["entity_id"] == "sensor.outdoor_temperature")
    assert temp["numeric"] is True and temp["unit"] == "°C" and temp["domain"] == "sensor"
    assert [e["entity_id"] for e in c.get(f"{API}/schedules/condition-candidates", params={"domain": "sun"}).json()["entities"]] == ["sun.sun"]


# ---------------------------------------------------------------- preview

def test_preview_returns_problems_as_data(sched_app):
    app, s, c, fake, tr = sched_app
    d = draft_of("p", [slot("18:00:00", "19:00:00", act("climate.set_temperature", "climate.living_room", temperature=40))])
    r = post_json(c, "/schedules/preview", {"draft": d})
    assert r.status_code == 200
    body = r.json()
    assert body["valid"] is False and body["errors"][0]["path"] == "slots[0].actions[0].data.temperature" and body["errors"][0]["code"] == "out_of_range"
    assert body["errors"][0]["message"] == "טמפרטורה מחוץ לטווח 16–30."
    ok = post_json(c, "/schedules/preview", {"draft": draft_of("p", conditions=[cond()]), "count": 3}).json()
    assert ok["valid"] is True and ok["conditional"] is True and ok["sensitive"] is False and ok["lowering"] is False
    assert len(ok["upcoming"]) == 3 and ok["upcoming"][0]["summary"] == "הדלקה · Office light"
    assert ok["requires"] == {"sensitive_permission": False, "confirm_lowering": False, "alarm_code": False}
    gate = post_json(c, "/schedules/preview", {"draft": draft_of("g", [slot("07:00:00", None, act("cover.open_cover", "cover.driveway_gate"))])}).json()
    assert gate["sensitive"] is True and gate["lowering"] is True and gate["requires"]["sensitive_permission"] and gate["requires"]["confirm_lowering"]
    r = post_json(c, "/schedules/preview", {"draft": {"name": "x", "bogus": 1}})
    assert r.status_code == 422 and r.json()["code"] == "validation"


# ---------------------------------------------------------------- create

def test_create_reaches_the_bridge_and_records_the_owner(sched_app):
    app, s, c, fake, tr = sched_app
    body = {"draft": draft_of("Evening office", conditions=[cond("off")]), "enabled": True, "client_request_id": rid(), "confirm_lowering": False}
    r = c.post(f"{API}/schedules", json=body)
    assert r.status_code == 201, r.text
    out = r.json()
    sch = out["schedule"]
    assert out["op_id"].startswith("op") and sch["name"] == "Evening office" and sch["source"] == "arx" and sch["owner"]["username"] == "joni" and sch["can"]["edit"] is True
    assert sch["conditions"]["preset"] == "not_holy_days" and len(sch["slots"]) == 2
    call = fake.bridge_calls[-1]
    assert call["op"] == "add" and call["user_id"] == "dev-joni" and call["sensitive"] is False and call["request_id"] == out["op_id"]
    # the schedule's conditions are copied into EVERY slot, in the stored form
    slots = call["payload"]["timeslots"]
    assert all(sl["conditions"] == [{"entity_id": SHABBAT, "attribute": "state", "value": "off", "match_type": "is"}] and sl["condition_type"] == "or" and sl["track_conditions"] is False for sl in slots)
    assert call["payload"]["repeat_type"] == "repeat" and "tags" not in call["payload"]
    with app.state.db.connection() as conn:
        assert conn.execute("SELECT created_via, created_by FROM schedule_meta WHERE schedule_id = ?", (sch["id"],)).fetchone()[:] == ("arx", "dev-joni")
        a = conn.execute("SELECT * FROM audit_log WHERE action = 'schedule.create' AND decision = 'allowed'").fetchone()
        d = json.loads(a["details_json"])
        assert a["resource_id"] == sch["id"] and d["entities"] == ["light.office"] and d["classes"] == ["light"] and d["conditions"] == [SHABBAT] and d["sensitive"] is False and d["revision_after"] == sch["revision"]
        assert "brightness" not in a["details_json"]  # never a value of service data


def test_create_disabled_is_two_bridge_calls_one_op(sched_app):
    app, s, c, fake, tr = sched_app
    n = len(fake.bridge_calls)
    r = c.post(f"{API}/schedules", json={"draft": draft_of("Off at first"), "enabled": False, "client_request_id": rid()})
    assert r.status_code == 201 and r.json()["schedule"]["enabled"] is False
    assert [x["op"] for x in fake.bridge_calls[n:]] == ["add", "disable"] and len({x["request_id"] for x in fake.bridge_calls[n:]}) == 1


def test_create_is_idempotent_per_client_request_id(sched_app):
    app, s, c, fake, tr = sched_app
    body = {"draft": draft_of("Once"), "enabled": True, "client_request_id": rid()}
    first = c.post(f"{API}/schedules", json=body)
    n = len(fake.bridge_calls)
    again = c.post(f"{API}/schedules", json=body)
    assert first.status_code == 201 and again.status_code == 201 and len(fake.bridge_calls) == n
    assert again.json()["schedule"]["id"] == first.json()["schedule"]["id"] and again.json()["op_id"] == first.json()["op_id"]
    assert sum(1 for i in fake.items.values() if i["name"] == "Once") == 1


def test_create_id_unknown_is_202_and_never_resent(sched_app, monkeypatch):
    app, s, c, fake, tr = sched_app
    fake.hide_new_id = True
    from smplwise.services import schedule_ops

    monkeypatch.setattr(schedule_ops, "_learn_by_diff", lambda w, expected, before: None)  # the diff finds nothing either
    body = {"draft": draft_of("Lost id"), "enabled": True, "client_request_id": rid()}
    r = c.post(f"{API}/schedules", json=body)
    assert r.status_code == 202 and r.json()["status"] == "unknown" and r.json()["message"] == "התזמון נשלח; יופיע ברשימה לאחר אישור."
    n = len(fake.bridge_calls)
    assert c.post(f"{API}/schedules", json=body).status_code == 202 and len(fake.bridge_calls) == n
    # the next pull adopts it: same name -> an Arx schedule of the caller
    from smplwise.services import schedules

    schedules.MIRROR.pull(None, "test")
    adopted = _by_name(c, "Lost id")
    assert adopted["source"] == "arx" and adopted["owner"]["username"] == "joni"


def test_create_validation_errors_use_the_contract_codes(sched_app):
    app, s, c, fake, tr = sched_app

    def create(d, **kw):
        return c.post(f"{API}/schedules", json={"draft": d, "enabled": True, "client_request_id": rid(), **kw})

    def code(r):
        return r.status_code, r.json()["code"]

    assert code(create(draft_of("x", [slot("18:00:00", "19:00:00", act("light.turn_on", "light.office", code="1234"))]))) == (422, "code_not_allowed")
    assert code(create(draft_of("x", [slot("18:00:00", "19:00:00", act("light.turn_on", "light.office"), act("script.turn_on", "script.thing"))]))) == (422, "validation")  # unknown entity
    assert code(create(draft_of("x", [slot("18:00:00", "19:00:00", act("scene.turn_on", "light.office"))]))) == (422, "action_not_allowed")
    assert code(create(draft_of("x", [slot("18:00:00", "19:00:00", act("light.turn_on", "light.office")), slot("18:30:00", "19:30:00", act("light.turn_off", "light.office"))]))) == (422, "slots_overlap")
    assert create(draft_of("x", [slot("18:00:00", "19:00:00", act("light.turn_on", "light.office")), slot("18:30:00", "19:30:00", act("light.turn_off", "light.office"))])).json()["user_message"] == "משבצות חופפות באותו תזמון."
    assert code(create(draft_of("x", conditions=[cond(entity="light.office")]))) == (422, "condition_domain_not_allowed")
    restrict_disarm(c)  # owner decision 2026-10-04: allowed by default; a system administrator may restrict it
    assert code(create(draft_of("x", [slot("18:00:00", "19:00:00", act("alarm_control_panel.alarm_disarm", "alarm_control_panel.home_panel"))]))) == (422, "disarm_not_allowed")
    allow_disarm(c)
    assert code(create(draft_of("x", [slot("18:00:00", "19:00:00", act("alarm_control_panel.alarm_disarm", "alarm_control_panel.home_panel"))]))) == (422, "alarm_code_needed")
    assert code(create(draft_of("x", [slot("18:00:00", None, act("lock.unlock", "lock.side_door"))]))) == (422, "lock_code_needed")
    assert code(create(draft_of("x", [slot("18:00:00", None, act("alarm_control_panel.alarm_arm_vacation", "alarm_control_panel.shed_panel"))]))) == (422, "arm_mode_not_supported")
    assert code(create(draft_of(""))) == (422, "validation")
    assert code(create(draft_of("x", [slot("18:00:00", "17:00:00", act("light.turn_on", "light.office"))]))) == (422, "validation")
    assert not any(i["name"] == "x" for i in fake.items.values())
    assert create(draft_of("pump-ok", [slot("18:00:00", "19:00:00", act("switch.turn_on", "switch.garden_pump"))])).status_code in (200, 201)  # CR-019: an unmarked switch is schedulable
    # a class an administrator switched off
    assert c.patch(f"{API}/settings", json={"schedules.classes": ["light", "switch", "cover", "fan", "alarm", "lock", "door"]}).status_code == 200
    r = create(draft_of("x", [slot("18:00:00", "19:00:00", act("climate.turn_off", "climate.living_room"))]))
    assert code(r) == (422, "class_not_allowed") and r.json()["user_message"] == "סוג ההתקן אינו מותר בתזמונים (הגדרות › תזמונים)."


def test_create_needs_a_lowering_confirmation(sched_app):
    app, s, c, fake, tr = sched_app
    d = draft_of("Gate at seven", [slot("07:00:00", "08:00:00", act("cover.open_cover", "cover.driveway_gate")), slot("08:00:00", "00:00:00", act("cover.close_cover", "cover.driveway_gate"))])
    r = c.post(f"{API}/schedules", json={"draft": d, "enabled": True, "client_request_id": rid()})
    assert r.status_code == 409 and r.json()["code"] == "lowering_confirmation_required"
    assert r.json()["user_message"] == "תזמון שמנטרל אזעקה, פותח נעילה, דלת או שער דורש אישור מפורש."
    r = c.post(f"{API}/schedules", json={"draft": d, "enabled": True, "client_request_id": rid(), "confirm_lowering": True})
    assert r.status_code == 201 and r.json()["schedule"]["lowering"] is True and r.json()["schedule"]["sensitive_classes"] == ["door"]
    assert fake.bridge_calls[-1]["sensitive"] is True


def test_bridge_refusal_timeout_and_errors(sched_app):
    app, s, c, fake, tr = sched_app
    fake.fail_next["add"] = "service_not_allowed"
    r = c.post(f"{API}/schedules", json={"draft": draft_of("Refused"), "enabled": True, "client_request_id": rid()})
    assert r.status_code == 502 and r.json()["code"] == "scheduler_refused" and r.json()["details"]["error"] == "service_not_allowed"
    assert r.json()["user_message"] == "רכיב התזמונים דחה את השינוי."
    fake.timeout_next.add("add")
    r = c.post(f"{API}/schedules", json={"draft": draft_of("Timed out"), "enabled": True, "client_request_id": rid()})
    assert r.status_code == 504 and r.json()["code"] == "scheduler_timeout"
    assert r.json()["user_message"] == "רכיב התזמונים לא ענה בזמן; ייתכן שהשינוי נשמר. רעננו לפני ניסיון נוסף."
    with app.state.db.connection() as conn:
        assert conn.execute("SELECT status FROM schedule_ops WHERE op = 'create' ORDER BY rowid DESC LIMIT 1").fetchone()[0] == "unknown"
    tr.up = False
    r = c.post(f"{API}/schedules", json={"draft": draft_of("Down"), "enabled": True, "client_request_id": rid()})
    assert r.status_code == 503 and r.json()["code"] == "ha_unavailable"
    tr.up = True


# ---------------------------------------------------------------- update

def test_update_sends_only_changed_fields_and_untouched_slots_verbatim(sched_app):
    app, s, c, fake, tr = sched_app
    sch = _by_name(c, "Living room cooling on rest days")
    sid = sch["id"]
    original = json.loads(json.dumps(fake.items[sid]["timeslots"]))
    draft = {"name": sch["name"], "weekdays": ["daily"], "start_date": None, "end_date": None, "repeat": "repeat", "tags": ["shabbat"],
             "conditions": {"items": [cond("on")], "type": "or", "track": False},
             "slots": [{"start": x["start"]["raw"], "stop": x["stop"]["raw"] if x["stop"] else None,
                        "actions": [{"service": a["service"], "entity_id": a["entity_id"], "data": a["data"]} for a in x["actions"]]} for x in sch["slots"]]}
    draft["slots"][0]["actions"][0]["data"]["temperature"] = 24
    r = put_draft(c, sid, draft, sch["revision"])
    assert r.status_code == 200, r.text
    call = fake.bridge_calls[-1]
    assert call["op"] == "edit" and set(call["payload"]) == {"timeslots", "start_date", "end_date"}
    assert call["payload"]["timeslots"][0]["actions"][0]["service_data"]["temperature"] == 24
    from smplwise.services.schedule_model import component_slot

    assert call["payload"]["timeslots"][1:] == [component_slot(t) for t in original[1:]]  # untouched slots re-sent in their equivalent write form
    out = r.json()["schedule"]
    assert out["revision"] != sch["revision"] and out["owner"]["username"] == "joni" and out["slots"][0]["actions"][0]["data"]["temperature"] == 24
    # an edit that changes nothing sends nothing
    n = len(fake.bridge_calls)
    same = put_draft(c, sid, draft, out["revision"])
    assert same.status_code == 200 and len(fake.bridge_calls) == n


def test_update_conflict_is_409_with_the_current_version(sched_app):
    app, s, c, fake, tr = sched_app
    sch = _by_name(c, "Hall lights on rest days")
    sid = sch["id"]
    d = draft_of(sch["name"], [slot("06:00:00", "07:00:00", act("switch.turn_on", "switch.hall_lights"))])
    fake.call_service("scheduler", "edit", {"entity_id": fake.items[sid]["entity_id"], "name": "Renamed in the card"})  # someone else edits it
    r = put_draft(c, sid, d, sch["revision"])
    assert r.status_code == 409 and r.json()["code"] == "schedule_changed"
    det = r.json()["details"]
    assert det["base_revision"] == sch["revision"] and det["current"]["name"] == "Renamed in the card" and det["current_revision"] == det["current"]["revision"] != sch["revision"]
    assert r.json()["user_message"] == "התזמון שונה במקום אחר. טענו את הגרסה העדכנית והחליטו מה לשמור."
    with app.state.db.connection() as conn:
        a = conn.execute("SELECT decision, reason FROM audit_log WHERE action = 'schedule.update' ORDER BY id DESC LIMIT 1").fetchone()
        assert (a["decision"], a["reason"]) == ("denied", "schedule_changed")


# ---------------------------------------------------------------- enable, disable, run

def test_enable_disable_and_already_in_state(sched_app):
    app, s, c, fake, tr = sched_app
    sid = _by_name(c, "Bedroom 1 cooling on rest days")["id"]
    r = post_json(c, f"/schedules/{sid}/enable", {"client_request_id": rid()})
    assert r.status_code == 200 and r.json()["changed"] is True and r.json()["schedule"]["enabled"] is True and fake.items[sid]["enabled"] is True
    assert [x["op"] for x in fake.bridge_calls][-1] == "enable"
    n = len(fake.bridge_calls)
    r = post_json(c, f"/schedules/{sid}/enable", {"client_request_id": rid()})
    assert r.status_code == 200 and r.json()["changed"] is False and len(fake.bridge_calls) == n
    r = post_json(c, f"/schedules/{sid}/disable", {"client_request_id": rid()})
    assert r.json()["changed"] is True and fake.items[sid]["enabled"] is False
    assert not [call for call in fake.calls if call["service"] in ("enable_all", "disable_all", "reload_storage")]


def test_enabling_a_lowering_schedule_needs_confirmation(sched_app):
    app, s, c, fake, tr = sched_app
    sid = _by_name(c, "Gate")["id"]
    r = post_json(c, f"/schedules/{sid}/enable", {"client_request_id": rid()})
    assert r.status_code == 409 and r.json()["code"] == "lowering_confirmation_required"
    r = post_json(c, f"/schedules/{sid}/enable", {"client_request_id": rid(), "confirm_lowering": True})
    assert r.status_code == 200 and r.json()["changed"] is True


def test_run_now_rules(sched_app):
    app, s, c, fake, tr = sched_app
    multi = _by_name(c, "Hall lights on rest days")["id"]
    r = post_json(c, f"/schedules/{multi}/run", {"slot_index": None, "confirm": True, "client_request_id": rid()})
    assert r.status_code == 422 and r.json()["code"] == "slot_required" and r.json()["user_message"] == "בחרו איזו משבצת להריץ."
    lights = _by_name(c, "Office light on weekdays")["id"]
    r = post_json(c, f"/schedules/{lights}/run", {"slot_index": 0, "confirm": False, "client_request_id": rid()})
    assert r.status_code == 202, r.text  # a routine light needs no confirmation
    call = fake.bridge_calls[-1]
    assert call["op"] == "run" and call["time"] == "08:00:00" and call["skip_conditions"] is False
    assert r.json()["note"] == "הבקשה נשלחה; התוצאה תופיע בהרצות." and r.json()["run_id"]
    r = post_json(c, f"/schedules/{lights}/run", {"slot_index": 0, "client_request_id": rid()})
    assert r.status_code == 429 and r.json()["code"] == "run_too_soon" and r.json()["user_message"] == "התזמון הורץ ממש עכשיו; נסו שוב בעוד כמה שניות."
    shutter = _by_name(c, "Gym shutter")["id"]  # covers carry the attention risk: confirmation is required
    r = post_json(c, f"/schedules/{shutter}/run", {"slot_index": 1, "client_request_id": rid()})
    assert r.status_code == 409 and r.json()["code"] == "confirmation_required" and r.json()["user_message"] == "פעולה זו דורשת אישור מפורש."
    assert post_json(c, f"/schedules/{shutter}/run", {"slot_index": 1, "confirm": True, "client_request_id": rid()}).status_code == 202
    assert post_json(c, f"/schedules/{lights}/run", {"slot_index": 9, "client_request_id": rid()}).status_code in (422, 429)


# ---------------------------------------------------------------- split

def test_split_a_day_out_of_a_daily_schedule(sched_app):
    app, s, c, fake, tr = sched_app
    sch = _by_name(c, "Office light on weekdays")
    sid = sch["id"]
    n = len(fake.bridge_calls)
    r = post_json(c, f"/schedules/{sid}/split", {"base_revision": sch["revision"], "days": ["tue"], "name": None, "confirm": True, "client_request_id": rid()})
    assert r.status_code == 200, r.text
    orig, new = r.json()["original"], r.json()["created"]
    assert orig["days"]["days"] == ["sun", "mon", "wed", "thu"] and new["days"]["days"] == ["tue"] and new["name"] == "Office light on weekdays · ג׳" and new["source"] == "arx"
    assert [x["op"] for x in fake.bridge_calls[n:]] == ["add", "edit"]
    from smplwise.services.schedule_model import component_slot

    assert fake.bridge_calls[n]["payload"]["timeslots"] == [component_slot(t) for t in fake.items[new["id"]]["timeslots"]]  # the slots move (in write form)
    assert fake.bridge_calls[n + 1]["payload"] == {"weekdays": ["sun", "mon", "wed", "thu"], "start_date": None, "end_date": None}  # the original keeps its dates
    assert len(new["slots"]) == len(orig["slots"]) == 2 and new["revision"] != orig["revision"]


def test_split_errors_and_compensation(sched_app):
    app, s, c, fake, tr = sched_app
    daily = _by_name(c, "Hall lights on rest days")
    sid = daily["id"]

    def split(days, confirm=True, rev=None, name=None):
        return post_json(c, f"/schedules/{sid}/split", {"base_revision": rev or daily["revision"], "days": days, "name": name, "confirm": confirm, "client_request_id": rid()})

    assert split(["sat"], confirm=False).json()["code"] == "confirmation_required"
    assert split(["sun", "mon", "tue", "wed", "thu", "fri", "sat"]).status_code == 422  # not a strict subset
    assert split(["sat"], rev="0000000000000000").json()["code"] == "schedule_changed"
    # the second bridge call fails: the created schedule is removed again
    n_items = len(fake.items)
    fake.fail_next["edit"] = "invalid_payload"
    r = split(["fri"])
    assert r.status_code == 502 and r.json()["code"] == "scheduler_refused" and len(fake.items) == n_items
    # both the edit and the compensation fail
    fake.fail_next["edit"] = "invalid_payload"
    fake.fail_next["remove"] = "unauthorized"
    r = split(["thu"])
    assert r.status_code == 502 and r.json()["code"] == "split_incomplete" and r.json()["details"]["original_id"] == sid and r.json()["details"]["created_id"]
    assert r.json()["user_message"] == "הפיצול לא הושלם; בדקו את שני התזמונים."
    # workday / weekend cannot be split
    wk = c.post(f"{API}/schedules", json={"draft": draft_of("Wk", weekdays=["sun", "mon"]), "enabled": True, "client_request_id": rid()}).json()["schedule"]
    fake.items[wk["id"]]["weekdays"] = ["workday"]
    schedules_mod = __import__("smplwise.services.schedules", fromlist=["MIRROR"])
    schedules_mod.MIRROR.pull(None, "t")
    cur = c.get(f"{API}/schedules/{wk['id']}").json()
    r = post_json(c, f"/schedules/{wk['id']}/split", {"base_revision": cur["revision"], "days": ["sun"], "confirm": True, "client_request_id": rid()})
    assert r.status_code == 422 and r.json()["code"] == "split_not_possible"


# ---------------------------------------------------------------- delete, copy

def test_delete_snapshots_to_the_trash_before_removing(sched_app):
    app, s, c, fake, tr = sched_app
    sch = _by_name(c, "Gym shutter")
    sid = sch["id"]
    r = post_json(c, f"/schedules/{sid}/delete", {"base_revision": sch["revision"], "confirm": False, "client_request_id": rid()})
    assert r.status_code == 409 and r.json()["code"] == "confirmation_required"
    r = post_json(c, f"/schedules/{sid}/delete", {"base_revision": "0" * 16, "confirm": True, "client_request_id": rid()})
    assert r.status_code == 409 and r.json()["code"] == "schedule_changed"
    fake.fail_next["remove"] = "unauthorized"
    r = post_json(c, f"/schedules/{sid}/delete", {"base_revision": sch["revision"], "confirm": True, "client_request_id": rid()})
    assert r.status_code == 502
    with app.state.db.connection() as conn:
        assert conn.execute("SELECT COUNT(*) FROM schedule_trash").fetchone()[0] == 0  # the snapshot goes when the bridge refuses
    r = post_json(c, f"/schedules/{sid}/delete", {"base_revision": sch["revision"], "confirm": True, "client_request_id": rid()})
    assert r.status_code == 200, r.text
    out = r.json()
    assert out["trash_id"].startswith("tr") and out["expires_at"]
    assert sid not in fake.items and c.get(f"{API}/schedules/{sid}").status_code == 404
    trash = c.get(f"{API}/schedules/trash").json()["items"]
    assert [t["schedule_id"] for t in trash] == [sid] and trash[0]["can_restore"] is True and trash[0]["name"] == "Gym shutter" and trash[0]["entities"][0]["entity_id"] == "cover.gym_shutter"
    assert not [call for call in fake.calls if call["service"] in ("enable_all", "disable_all")]


def test_copy_makes_an_arx_schedule_of_the_caller(sched_app):
    app, s, c, fake, tr = sched_app
    sch = _by_name(c, "Hall lights on rest days")
    r = post_json(c, f"/schedules/{sch['id']}/copy", {"name": "Copy of hall", "client_request_id": rid()})
    assert r.status_code == 201, r.text
    cp = r.json()["schedule"]
    assert cp["name"] == "Copy of hall" and cp["source"] == "arx" and cp["owner"]["username"] == "joni" and cp["id"] != sch["id"]
    assert fake.bridge_calls[-1]["op"] == "copy" and fake.bridge_calls[-1]["name"] == "Copy of hall"
    assert post_json(c, f"/schedules/{sch['id']}/copy", {"name": "", "client_request_id": rid()}).status_code == 422


# ---------------------------------------------------------------- bulk, organisation, rate limit, unavailability

def test_bulk_enable_and_disable(sched_app):
    app, s, c, fake, tr = sched_app
    ids = [_by_name(c, n)["id"] for n in ("Living room cooling on rest days", "Bedroom 1 cooling on rest days", "Gate")]
    assert post_json(c, "/schedules/bulk", {"op": "disable", "ids": ids, "confirm": False, "client_request_id": rid()}).json()["code"] == "confirmation_required"
    r = post_json(c, "/schedules/bulk", {"op": "disable", "ids": ids + ["ffffff"], "confirm": True, "client_request_id": rid()})
    res = {x["id"]: x for x in r.json()["results"]}
    assert res[ids[0]] == {"id": ids[0], "ok": True, "changed": True} and res[ids[1]]["changed"] is False and res[ids[2]]["changed"] is False
    assert res["ffffff"]["ok"] is False and res["ffffff"]["code"] == "schedule_not_found"
    r = post_json(c, "/schedules/bulk", {"op": "enable", "ids": [ids[0], ids[2]], "confirm": True, "client_request_id": rid()})
    res = {x["id"]: x for x in r.json()["results"]}
    assert res[ids[0]]["ok"] is True and res[ids[2]]["ok"] is False and res[ids[2]]["code"] == "lowering_confirmation_required"  # lowering schedules are refused in bulk enable
    with app.state.db.connection() as conn:
        assert conn.execute("SELECT COUNT(*) FROM audit_log WHERE action = 'schedule.bulk' AND decision = 'allowed'").fetchone()[0] == 2
    assert post_json(c, "/schedules/bulk", {"op": "enable", "ids": [], "confirm": True, "client_request_id": rid()}).status_code == 422


def test_organisation_folders_order_pins(sched_app):
    app, s, c, fake, tr = sched_app
    a, b = _by_name(c, "Gym shutter")["id"], _by_name(c, "Hall lights on rest days")["id"]
    r = c.put(f"{API}/schedules/organisation", json={"folders": [{"id": "outside", "name": "Outside", "position": 0}], "items": [
        {"schedule_id": a, "folder_id": "outside", "order": 2, "pinned": True}, {"schedule_id": b, "folder_id": None, "order": 1, "pinned": False}]})
    assert r.status_code == 200, r.text
    org = c.get(f"{API}/schedules/organisation").json()
    assert org["folders"] == [{"id": "outside", "name": "Outside", "position": 0}]
    placed = {i["schedule_id"]: i for i in org["items"]}
    assert placed[a] == {"schedule_id": a, "folder_id": "outside", "order": 2, "pinned": True} and placed[b]["order"] == 1
    got = c.get(f"{API}/schedules/{a}").json()
    assert got["folder_id"] == "outside" and got["order"] == 2 and got["pinned"] is True
    assert [s["id"] for s in _list(c, folder="outside")["items"]] == [a]
    assert _list(c, sort="order", limit=500)["items"][0]["id"] == b
    assert c.put(f"{API}/schedules/organisation", json={"folders": [{"name": ""}], "items": []}).status_code == 422
    assert c.put(f"{API}/schedules/organisation", json={"folders": [], "items": [{"schedule_id": a, "folder_id": "nope"}]}).status_code == 422
    assert c.put(f"{API}/schedules/organisation", json={"folders": [], "items": []}).status_code == 200  # folders replaced: the schedule leaves its folder
    assert c.get(f"{API}/schedules/{a}").json()["folder_id"] is None


def test_rate_limit_on_writes(sched_app):
    app, s, c, fake, tr = sched_app
    sid = _by_name(c, "Bedroom 1 cooling on rest days")["id"]
    statuses = [post_json(c, f"/schedules/{sid}/{'enable' if i % 2 == 0 else 'disable'}", {"client_request_id": rid()}).status_code for i in range(32)]
    assert statuses[:30] == [200] * 30 and statuses[30] == 429
    r = post_json(c, f"/schedules/{sid}/enable", {"client_request_id": rid()})
    assert r.status_code == 429 and r.json()["code"] == "rate_limited" and r.json()["user_message"] == "יותר מדי שינויים ברצף; נסו שוב בעוד רגע."


def test_writes_are_refused_when_the_feature_or_the_bridge_is_unavailable(sched_app):
    app, s, c, fake, tr = sched_app
    sid = _by_name(c, "Hall lights on rest days")["id"]
    fake.installed = False
    from smplwise.services import schedules

    schedules.MIRROR.pull(None, "t")  # first unknown_command
    fake._t += __import__("datetime").timedelta(minutes=6)
    schedules.MIRROR.pull(None, "t")  # second one, 5+ minutes later: the component is missing
    st = c.get(f"{API}/schedules/status").json()
    assert st["available"] == "component_missing" and st["writable"] is False and st["write_block"] == "component_missing"
    r = post_json(c, f"/schedules/{sid}/disable", {"client_request_id": rid()})
    assert r.status_code == 503 and r.json()["code"] == "scheduler_unavailable" and r.json()["user_message"] == "התזמונים אינם זמינים כרגע."
    fake.installed = True
    schedules.MIRROR.pull(None, "t")
    assert c.get(f"{API}/schedules/status").json()["available"] == "ok"
    # an old bridge
    c.post(f"{API}/ha/bridge/ping", json=ha_bridge_sign(c, {"version": "0.2.6"}))
    st = c.get(f"{API}/schedules/status").json()
    assert st["write_block"] == "bridge_too_old" and st["writable"] is False
    r = post_json(c, f"/schedules/{sid}/disable", {"client_request_id": rid()})
    assert r.status_code == 503 and r.json()["code"] == "bridge_too_old"
    d = c.get(f"{API}/schedules/{sid}").json()
    assert d["can"]["edit"] is False and d["read_only"]["reasons"][0]["code"] == "bridge_unavailable"


def ha_bridge_sign(c, body):
    from smplwise.services import ha_bridge

    return ha_bridge.sign(c.get(f"{API}/ha/bridge/pairing").json()["pairing_code"], body)


def test_json_only_and_closed_bodies(sched_app):
    app, s, c, fake, tr = sched_app
    sid = _by_name(c, "Hall lights on rest days")["id"]
    r = c.post(f"{API}/schedules/{sid}/enable", content="client_request_id=abcdefgh1", headers={"content-type": "application/x-www-form-urlencoded"})
    assert r.status_code == 415
    r = post_json(c, f"/schedules/{sid}/enable", {"client_request_id": rid(), "extra": 1})
    assert r.status_code == 422 and r.json()["code"] == "validation"
    r = post_json(c, f"/schedules/{sid}/enable", {"client_request_id": "short"})
    assert r.status_code == 422
