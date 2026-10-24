"""KAV079-295 over the API (the CR-017 test world): the extension is OFF by default and changes nothing then; with its switches on - the pre-save
checks in the preview and the list summary, wall-button triggers (picker, buttons, detect by pressing, a press already used: warning / error), the
on-device test plan and its restore plan (owner answer 360: the item's editor and runner only), the critical sound (owner 363: safety events
enabled in Settings › Notifications only) and the "who is in the building" condition."""
from __future__ import annotations

from automations_fixture import *  # noqa: F401,F403
from automations_fixture import autos_app  # noqa: F401
from automations_fixture import API, NOTIFY, OMER, create_item, draft_of, get_item, item_by_name, svc_block

from smplwise.services import automation_ext as ext
from smplwise.services import ha_bridge, ha_sync

AC = "climate.living_room"
DEV = "dev_living_switch"
ZHA_TRIGGERS = [
    {"platform": "device", "device_id": DEV, "domain": "zha", "type": "remote_button_short_press", "subtype": "button_1"},
    {"platform": "device", "device_id": DEV, "domain": "zha", "type": "remote_button_double_press", "subtype": "button_1"},
    {"platform": "device", "device_id": DEV, "domain": "zha", "type": "remote_button_long_press", "subtype": "button_1"},
    {"platform": "device", "device_id": DEV, "domain": "zha", "type": "remote_button_short_press", "subtype": "button_2"},
]


def bridge_at(c, version: str) -> None:
    secret = c.get(f"{API}/ha/bridge/pairing").json()["pairing_code"]
    assert c.post(f"{API}/ha/bridge/ping", json=ha_bridge.sign(secret, {"version": version})).status_code == 200


def settings(c, **kv):
    r = c.patch(f"{API}/settings", json={f"automations.{k}": v for k, v in kv.items()})
    assert r.status_code == 200, r.text
    return r.json()


def pv(c, draft, item_id=None):
    r = c.post(f"{API}/automations/preview", json={"kind": "automation", "id": item_id, "draft": draft})
    assert r.status_code == 200, r.text
    return r.json()


def time_trigger(at: str, uid: str = "t1") -> dict:
    return {"uid": uid, "kind": "typed", "type": "time", "at": at, "raw": None, "sentence": ""}


def button_trigger(button: int = 1, press: str = "double", uid: str = "b1") -> dict:
    return {"uid": uid, "kind": "typed", "type": "button", "device_id": DEV, "domain": "zha", "ha_type": "remote_button_short_press", "ha_subtype": "button_1",
            "button": button, "press": press, "extra": {}, "raw": None, "sentence": ""}


def with_wall_switch(app, tr) -> None:
    with app.state.db.connection() as conn:
        conn.execute("INSERT INTO ha_devices(device_id, name, updated_at) VALUES (?, 'מפסק סלון', 't')", (DEV,))
        ha_sync.upsert_state(conn, {"entity_id": "event.living_switch_button_1", "state": "unknown", "attributes": {"device_class": "button", "friendly_name": "כפתור 1"}})
        conn.execute("UPDATE ha_entities SET device_id = ? WHERE entity_id = 'event.living_switch_button_1'", (DEV,))
    orig = tr.ws
    tr.ws = lambda t, **kw: {"success": True, "result": ZHA_TRIGGERS} if t == "device_automation/trigger/list" else orig(t, **kw)


def test_everything_is_off_by_default_and_changes_nothing(autos_app):
    app, s, c, fake, tr = autos_app
    cfg = c.get(f"{API}/settings").json()["settings"]
    assert cfg["automations.wall_buttons_editable"] == "false" and cfg["automations.precheck_enabled"] == "false" and cfg["automations.device_test_enabled"] == "false"
    assert cfg["automations.conflict_window_min"] == 10 and cfg["automations.button_reuse"] == "warn" and cfg["automations.device_test_end"] == "ask" and cfg["automations.presence_entity"] == ""
    st = c.get(f"{API}/automations/status").json()
    assert st["ui"]["ext"]["precheck"] is False and st["ui"]["ext"]["wall_buttons"] is False and st["ui"]["ext"]["device_test"] is False
    assert c.get(f"{API}/automations/catalog").json()["extension"]["wall_timing"] == {"double_ms": 400, "long_ms": 800, "debounce_ms": 50, "listen_s": 30}
    out = pv(c, draft_of("x", triggers=[time_trigger("07:05")], actions=[svc_block("climate.turn_off", [AC])]))
    assert not [w for w in out["warnings"] if w["code"] in ("conflict", "device_unavailable", "button_in_use")]
    assert c.get(f"{API}/automations-ext/conflicts").json() == {"enabled": False, "window_min": None, "items": []}
    assert c.get(f"{API}/automations-ext/wall-buttons").status_code == 409
    d = get_item(c, "automation", item_by_name(c, "כפתור קיר – תרחיש")["id"]).json()
    assert d["draft"]["triggers"][0]["kind"] == "locked" and d["draft"]["triggers"][0]["reason"] == "device", "device triggers stay locked while the switch is off"
    settings(c, wall_buttons_editable="true")
    d = get_item(c, "automation", item_by_name(c, "כפתור קיר – תרחיש")["id"]).json()
    t = d["draft"]["triggers"][0]
    assert t["kind"] == "typed" and t["type"] == "button" and t["button"] == 1 and t["press"] == "short", "a ZHA press is the typed block once the switch is on"
    out = pv(c, d["draft"], d["id"])
    assert out["requires"]["code_view"] is False, "an unchanged stored button trigger is a builder save"


def test_the_pre_save_checks_warn_about_a_conflict_and_an_unavailable_device(autos_app):
    app, s, c, fake, tr = autos_app
    settings(c, precheck_enabled="true")
    out = pv(c, draft_of("כיבוי מזגן", triggers=[time_trigger("07:05")], actions=[svc_block("climate.turn_off", [AC])]))
    conf = [w for w in out["warnings"] if w["code"] == "conflict"]
    assert len(conf) == 1 and out["valid"] is True, "a warning, never an error"
    w = conf[0]
    assert w["message"] == "התנגשות עם האוטומציה ״מזגן סלון בבוקר״" and w["path"] == "actions.0" and w["other"]["name"] == "מזגן סלון בבוקר" and w["delta_min"] == 5
    assert "האוטומציה מדליקה את" in w["detail"] and "ב־07:00, וכאן הוא נכבה ב־07:05" in w["detail"] and "חלון של 10 דקות" in w["detail"]
    settings(c, conflict_window_min=4)
    assert not [w for w in pv(c, draft_of("כיבוי מזגן", triggers=[time_trigger("07:05")], actions=[svc_block("climate.turn_off", [AC])]))["warnings"] if w["code"] == "conflict"]
    with app.state.db.connection() as conn:
        ha_sync.upsert_state(conn, {"entity_id": "light.office", "state": "unavailable", "attributes": {"friendly_name": "Office light"}})
    out = pv(c, draft_of("x"))
    assert [w["message"] for w in out["warnings"] if w["code"] == "device_unavailable"] == ["Office light לא זמין כרגע"]


def test_the_conflict_routes_serve_the_list_and_the_schedule_editor(autos_app):
    app, s, c, fake, tr = autos_app
    settings(c, precheck_enabled="true")
    assert create_item(c, "automation", draft_of("כיבוי מזגן", triggers=[time_trigger("07:04")], actions=[svc_block("climate.turn_off", [AC])])).status_code in (200, 201)
    summary = c.get(f"{API}/automations-ext/conflicts").json()
    assert summary["enabled"] is True and summary["window_min"] == 10
    counts = {i["id"]: i["count"] for i in summary["items"]}
    assert counts[item_by_name(c, "מזגן סלון בבוקר")["id"]] == 1 and counts[item_by_name(c, "כיבוי מזגן")["id"]] == 1
    sched = {"weekdays": ["daily"], "slots": [{"start": "07:08:00", "stop": None, "actions": [{"service": "climate.set_hvac_mode", "entity_id": AC, "data": {"hvac_mode": "off"}}]}]}
    r = c.post(f"{API}/automations-ext/conflicts", json={"source": "schedule", "id": None, "draft": sched})
    assert r.status_code == 200, r.text
    rows = r.json()["conflicts"]
    assert [x["other"]["name"] for x in rows] == ["מזגן סלון בבוקר"] and rows[0]["title"] == "התנגשות עם האוטומציה ״מזגן סלון בבוקר״" and rows[0]["delta_min"] == 8
    assert c.post(f"{API}/automations-ext/conflicts", json={"source": "schedule", "draft": sched}, headers=OMER).status_code == 403, "no schedules permission"
    assert c.post(f"{API}/automations-ext/conflicts", json={"source": "widget", "draft": sched}).status_code == 422


def test_wall_buttons_picker_buttons_detect_and_a_saved_trigger(autos_app):
    app, s, c, fake, tr = autos_app
    with_wall_switch(app, tr)
    settings(c, wall_buttons_editable="true", precheck_enabled="true")
    devs = c.get(f"{API}/automations-ext/wall-buttons").json()
    assert [d["device_id"] for d in devs["devices"]] == [DEV] and devs["devices"][0]["name"] == "מפסק סלון" and devs["timing"]["double_ms"] == 400
    btn = c.get(f"{API}/automations-ext/wall-buttons/{DEV}").json()
    assert btn["source"] == "platform" and [b["button"] for b in btn["buttons"]] == [1, 2] and [p["press"] for p in btn["buttons"][0]["presses"]] == ["short", "double", "long"]
    assert c.get(f"{API}/automations-ext/wall-buttons/nope").status_code == 404
    r = create_item(c, "automation", draft_of("כפתורי מפסק סלון", triggers=[button_trigger(1, "double")]))
    assert r.status_code == 422 and "bridge_too_old" in r.text, "the paired bridge (0.6.0) would refuse the new press: said before anything is sent"
    bridge_at(c, ext.BRIDGE_KAV_REQUIRED)
    r = create_item(c, "automation", draft_of("כפתורי מפסק סלון", triggers=[button_trigger(1, "double")]))
    assert r.status_code in (200, 201), r.text
    stored = r.json()["item"]
    cfg = fake.automations[[a.get("alias") for a in fake.automations].index("כפתורי מפסק סלון")]
    assert cfg["triggers"][0] == {"trigger": "device", "device_id": DEV, "domain": "zha", "type": "remote_button_double_press", "subtype": "button_1"}
    assert get_item(c, "automation", stored["id"]).json()["draft"]["triggers"][0]["type"] == "button"
    btn = c.get(f"{API}/automations-ext/wall-buttons/{DEV}").json()
    assert btn["buttons"][0]["used"] is True and btn["buttons"][0]["presses"][1]["used_by"][0]["name"] == "כפתורי מפסק סלון" and btn["buttons"][1]["used"] is False
    out = pv(c, draft_of("עוד אחד", triggers=[button_trigger(1, "double")]))
    assert [w["message"] for w in out["warnings"] if w["code"] == "button_in_use"] == ["הכפתור והלחיצה כבר מפעילים את ״כפתורי מפסק סלון״"] and out["valid"] is True
    settings(c, button_reuse="error")
    out = pv(c, draft_of("עוד אחד", triggers=[button_trigger(1, "double")]))
    assert out["valid"] is False and out["errors"][0]["code"] == "button_in_use"
    r = create_item(c, "automation", draft_of("עוד אחד", triggers=[button_trigger(1, "double")]))
    assert r.status_code == 422 and "button_in_use" in r.text, "the error setting blocks the save"
    assert create_item(c, "automation", draft_of("קצרה על 2", triggers=[button_trigger(2, "short")])).status_code in (200, 201)

    class Fake(ext.Listener):
        def listen(self, triggers, timeout_s):
            assert timeout_s == 30 and len(triggers) == 4
            return triggers[2]

    ext.set_listener(Fake())
    try:
        hit = c.post(f"{API}/automations-ext/wall-buttons/{DEV}/detect", json={}).json()
    finally:
        ext.set_listener(None)
    assert hit == {"detected": True, "button": 1, "press": "long", "ha_type": "remote_button_long_press", "ha_subtype": "button_1", "domain": "zha", "listen_s": 30}


def test_a_button_on_a_device_outside_the_callers_reach_is_refused(autos_app):
    app, s, c, fake, tr = autos_app
    with_wall_switch(app, tr)
    settings(c, wall_buttons_editable="true")
    with app.state.db.connection() as conn:
        assert ext.device_reachable(type("C", (), {"conn": conn, "access": type("A", (), {"wide": lambda self, p: False, "allowed": lambda self, p, e: False})()})(), DEV) is False


def test_the_on_device_test_plan_and_restore(autos_app):
    app, s, c, fake, tr = autos_app
    iid = item_by_name(c, "מזגן סלון בבוקר")["id"]
    assert c.post(f"{API}/automations-ext/automation/{iid}/device-test", json={}).status_code == 409, "off by default"
    settings(c, device_test_enabled="true")
    plan = c.post(f"{API}/automations-ext/automation/{iid}/device-test", json={}).json()
    assert [(st["action"], st["entity_ids"]) for st in plan["steps"]] == [("climate.set_temperature", [AC])] and plan["end"] == "ask"
    assert plan["snapshot"][0]["entity_id"] == AC
    assert c.post(f"{API}/automations-ext/automation/{iid}/device-test", json={}, headers=OMER).status_code == 403
    assert c.post(f"{API}/automations-ext/automation/nope/device-test", json={}).status_code == 404
    snap = [{"entity_id": AC, "state": "off", "attributes": {}}]
    r = c.post(f"{API}/automations-ext/device-test/restore", json={"snapshot": snap})
    assert r.status_code == 200
    acts = r.json()["actions"]
    now = c.get(f"{API}/automations/catalog").json()
    st = next(e for e in now["entities"] if e["entity_id"] == AC)["state"]
    assert acts == ([] if st == "off" else [{"entity_id": AC, "action": "climate.set_hvac_mode", "arguments": {"hvac_mode": "off"}, "sensitive": False}])
    assert not tr.bridge_calls, "the plan and the restore plan never send anything"


def test_critical_sound_only_with_an_enabled_safety_trigger(autos_app):
    app, s, c, fake, tr = autos_app
    note = {"uid": "n2", "kind": "typed", "type": "service", "action": NOTIFY, "entity_ids": [], "data": {"message": "זוהתה הצפה בחדר כביסה"}, "role": "notify", "critical": True,
            "raw": None, "sentence": ""}
    r = create_item(c, "automation", draft_of("הצפה", actions=[note]))
    assert r.status_code == 422 and "critical_not_allowed" in r.text, "a motion trigger is no safety event"
    with app.state.db.connection() as conn:
        ha_sync.upsert_state(conn, {"entity_id": "binary_sensor.laundry_leak", "state": "off", "attributes": {"device_class": "moisture", "friendly_name": "חיישן הצפה"}})
    trig = {"uid": "n1", "kind": "typed", "type": "state", "entity_ids": ["binary_sensor.laundry_leak"], "to": "on", "raw": None, "sentence": ""}
    bridge_at(c, ext.BRIDGE_KAV_REQUIRED)
    out = pv(c, draft_of("הצפה", triggers=[trig], actions=[note]))
    assert out["valid"] is True and out["extension"]["critical"] == {"allowed": True, "sources": ["sensor.leak"]}
    r = create_item(c, "automation", draft_of("הצפה", triggers=[trig], actions=[note]))
    assert r.status_code in (200, 201), r.text
    cfg = fake.automations[[a.get("alias") for a in fake.automations].index("הצפה")]
    assert cfg["actions"][0]["data"]["data"]["push"]["sound"]["critical"] == 1
    with app.state.db.connection() as conn:
        conn.execute("UPDATE notify_policies SET enabled = 0 WHERE source = 'sensor.leak'")
        if not conn.execute("SELECT 1 FROM notify_policies WHERE source = 'sensor.leak'").fetchone():
            conn.execute("INSERT INTO notify_policies(source, enabled, severity, category, after_s, dedupe_window_s, resolve_notice, recipients_json, channels_json, revision, updated_at) "
                         "VALUES ('sensor.leak', 0, 'critical', 'safety', 0, 0, 1, '{}', '{}', 1, 't')")
    out = pv(c, draft_of("הצפה 2", triggers=[trig], actions=[note]))
    assert out["valid"] is False and out["errors"][0]["code"] == "critical_not_allowed"


def test_who_is_in_the_building_condition(autos_app):
    app, s, c, fake, tr = autos_app
    pres = {"uid": "p1", "kind": "typed", "type": "presence", "mode": "nobody", "where": "building", "raw": None, "sentence": ""}
    out = pv(c, draft_of("אין אף אחד", conditions=[pres]))
    assert out["valid"] is False and out["errors"][0]["code"] == "presence_entity_missing"
    settings(c, presence_entity="binary_sensor.anyone_in_building")
    assert c.get(f"{API}/automations/catalog").json()["extension"]["presence_sources"] == {"enabled": False, "geofence": False, "beacon": False, "wifi": False, "wifi_mode": "phone"}
    out = pv(c, draft_of("אין אף אחד", conditions=[pres]))
    assert out["valid"] is True and out["block_sentences"]["p1"] == "אין אף אחד במבנה"
    r = create_item(c, "automation", draft_of("אין אף אחד", conditions=[pres]))
    assert r.status_code in (200, 201), r.text
    cfg = fake.automations[[a.get("alias") for a in fake.automations].index("אין אף אחד")]
    assert cfg["conditions"] == [{"condition": "state", "entity_id": ["binary_sensor.anyone_in_building"], "state": "off"}]
    assert get_item(c, "automation", r.json()["item"]["id"]).json()["draft"]["conditions"][0]["type"] == "presence"
    assert c.patch(f"{API}/settings", json={"automations.presence_entity": "light.x"}).status_code == 422
