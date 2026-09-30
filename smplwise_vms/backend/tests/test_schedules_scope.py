"""CR-014 schedules - who sees and who may change what (docs/architecture/SCHEDULER_API.md §4, §5.6): visibility by ACTION
entities only (an invisible schedule is absent everywhere), floor-scoped editing that needs every action entity in scope,
a plain schedule.manage holder seeing sensitive schedules read-only, the control / door / alarm rules, lowering, the
creator's own alarm code verified and discarded, the remote channel, and the classes setting. Roles are custom roles
(the documented recipe: `schedule.view` + sensitive `schedule.manage`) bound with a scope."""
from __future__ import annotations

import json
import logging

from schedules_fixture import *  # noqa: F401,F403
from schedules_fixture import sched_app  # noqa: F401
from schedules_fixture import grant, place
from smplwise.auth import current_principal
from smplwise.rbac import Principal

API = "/api/v1"
PIN = "58302719"
OMER = {"X-SW-Dev-User": "omer"}


def _by_name(c, name, headers=None):
    r = c.get(f"{API}/schedules", params={"limit": 500}, headers=headers or {})
    assert r.status_code == 200, r.text
    return next(s for s in r.json()["items"] if s["name"] == name)


def _names(c, headers=None, **q):
    r = c.get(f"{API}/schedules", params={"limit": 500, **q}, headers=headers or {})
    assert r.status_code == 200, r.text
    return sorted(s["name"] or "" for s in r.json()["items"])


_place, _grant = place, grant


READ = ["schedule.view", "devices.read", "entity.state.read"]


def _boss(c, s):
    bind(c, s, "boss", "system_admin", "installation", "*")


# ---------------------------------------------------------------- permissions registered

def test_permissions_and_default_roles():
    from smplwise.rbac import ROLES
    from smplwise.routers.access import PERMISSION_LABELS, SENSITIVE
    from pathlib import Path

    assert PERMISSION_LABELS["schedule.view"] == "צפייה בתזמונים"
    assert PERMISSION_LABELS["schedule.manage"] == "ניהול תזמונים: יצירה, עריכה, הפעלה והשבתה, הרצה מיידית, מחיקה ושחזור"
    assert PERMISSION_LABELS["schedule.sensitive"] == "תזמון פעולות רגישות: אזעקה, מנעולים, דלתות ושערים"
    expect = {"viewer": set(), "editor": set(), "kiosk": set(), "operator": set(), "site_admin": {"schedule.view", "schedule.manage"}, "system_admin": {"schedule.view", "schedule.manage", "schedule.sensitive"}}
    for role_id, perms in expect.items():
        assert {p for p in ROLES[role_id] if p.startswith("schedule.")} == perms, role_id
    assert "schedule.manage" in SENSITIVE and "schedule.sensitive" in SENSITIVE and "schedule.view" not in SENSITIVE
    contract = json.loads((Path(__file__).resolve().parents[3] / "contracts" / "examples" / "role-catalog.design.json").read_text(encoding="utf-8"))
    for r in contract["roles"]:
        assert {p for p in r["permissions"] if p.startswith("schedule.")} == expect[r["id"]], r["id"]
    assert {"schedule.manage", "schedule.sensitive"} <= set(contract["sensitive_permissions_not_implied"])


def test_a_user_without_any_schedule_permission_gets_the_audited_403_but_status_never(sched_app):
    app, s, c, fake, tr = sched_app
    bind(c, s, "vera", "viewer", "installation", "*")
    v = {"X-SW-Dev-User": "vera"}
    st = c.get(f"{API}/schedules/status", headers=v).json()
    assert st["can"] == {"view": False, "manage": False, "sensitive": False, "configure": False} and st["counts"]["visible"] == 0 and st["counts"]["hidden"] is None and "admin" not in st
    for path in ("/schedules", "/schedules/trash", "/schedules/runs", "/schedules/tags", "/schedules/organisation"):
        r = c.get(f"{API}{path}", headers=v)
        assert r.status_code == 403 and r.json()["code"] == "forbidden", path
    assert c.get(f"{API}/schedules/catalog", headers=v).status_code == 403
    r = c.post(f"{API}/schedules", json={"draft": draft_of("x"), "enabled": True, "client_request_id": rid()}, headers=v)
    assert r.status_code == 403 and r.json()["user_message"] == "אין הרשאה לפעולה זו בהיקף המבוקש."
    with app.state.db.connection() as conn:
        assert conn.execute("SELECT COUNT(*) FROM audit_log WHERE actor_user_id = 'dev-vera' AND decision = 'denied' AND action = 'schedule.manage'").fetchone()[0] >= 1
    assert not fake.bridge_calls


# ---------------------------------------------------------------- visibility: action entities only

def test_visibility_is_decided_by_action_entities_only(sched_app):
    app, s, c, fake, tr = sched_app
    ids = seed_tree(c)
    _place(c, ids["floor2"], "light.office", "climate.living_room", "switch.hall_lights")
    _place(c, ids["floor3"], "cover.driveway_gate")
    # an editor bound to floor 2 (view + read on floor 2, sensitive manage on floor 2)
    _grant(c, "omer", "עורך תזמונים", READ + ["devices.control"], ["schedule.manage"], "floor", ids["floor2"])
    got = _names(c, OMER)
    # the office light, the living room cooling, the hall lights, the season yard light (light.office): all their action entities are on floor 2
    assert got == sorted(["Living room cooling on rest days", "Office light on weekdays", "Hall lights on rest days", "Yard light in season", "One shot watering", "Not on rest days"])
    # invisible = absent from the list, the count, the tags, the detail and the runs
    hidden = _by_name(c, "Gym shutter")
    assert c.get(f"{API}/schedules/{hidden['id']}", headers=OMER).status_code == 404
    st = c.get(f"{API}/schedules/status", headers=OMER).json()
    assert st["counts"]["visible"] == 6 and st["counts"]["hidden"] is None and st["can"] == {"view": True, "manage": True, "sensitive": False, "configure": False}
    assert {t["name"]: t["count"] for t in c.get(f"{API}/schedules/tags", headers=OMER).json()["tags"]} == {"shabbat": 2, "offices": 2, "outdoor": 1}
    # the administrator sees the difference
    adm = c.get(f"{API}/schedules/status").json()
    assert adm["counts"]["visible"] == 12 and adm["counts"]["hidden"] == 0
    # a schedule with NO action entity (an unsupported script) is for installation-wide viewers only
    assert "" not in _names(c, OMER) and "" in _names(c)
    # one action entity outside the scope hides the whole schedule (a schedule of two lights, one placed elsewhere)
    r = c.post(f"{API}/schedules", json={"draft": draft_of("Two rooms", [slot("08:00:00", None, act("light.turn_off", "light.office"), act("climate.turn_off", "climate.bedroom_1"))]), "enabled": True, "client_request_id": rid()})
    assert r.status_code == 201
    assert "Two rooms" not in _names(c, OMER) and "Two rooms" in _names(c)
    # runs of an invisible schedule are absent too
    with app.state.db.connection() as conn:
        conn.execute("INSERT INTO schedule_runs(id, schedule_id, slot_index, started_at, result) VALUES ('rx1', ?, 0, '2026-09-30T08:00:00Z', 'confirmed')", (hidden["id"],))
    assert c.get(f"{API}/schedules/runs", headers=OMER).json()["items"] == []
    assert [x["id"] for x in c.get(f"{API}/schedules/runs").json()["items"]] == ["rx1"]


def test_the_alarm_panel_needs_alarm_view_at_its_own_placement(sched_app):
    app, s, c, fake, tr = sched_app
    ids = seed_tree(c)
    _place(c, ids["floor2"], "alarm_control_panel.home_panel")
    _grant(c, "omer", "צופה בתזמונים", READ, [], "floor", ids["floor2"])
    assert "Arm the home panel" not in _names(c, OMER)  # placed, readable, but no alarm.view
    _grant(c, "omer", "צופה באזעקה", ["alarm.view"], [], "floor", ids["floor2"])
    assert "Arm the home panel" in _names(c, OMER)
    d = _by_name(c, "Arm the home panel", OMER)
    assert d["can"]["edit"] is False and d["sensitive"] is True  # visible, read-only: no manage


def test_conditions_never_hide_a_schedule_and_locked_conditions_stay_put(sched_app):
    app, s, c, fake, tr = sched_app
    ids = seed_tree(c)
    _place(c, ids["floor2"], "light.office", "climate.living_room", "switch.hall_lights")
    # a schedule on floor 2 whose condition is a motion sensor that is NOT on floor 2
    motion = cond("on", "binary_sensor.motion_hall")
    made = c.post(f"{API}/schedules", json={"draft": draft_of("Lights when moving", conditions=[motion]), "enabled": True, "client_request_id": rid()}).json()["schedule"]
    _grant(c, "omer", "עורך תזמונים", READ + ["devices.control"], ["schedule.manage"], "floor", ids["floor2"])
    mine = _by_name(c, "Lights when moving", OMER)
    item = mine["conditions"]["items"][0]
    assert item["readable"] is False and item["locked"] is True and item["state"] is None and item["name"] == "Hall motion" and item["available"] is None
    assert mine["conditions"]["summary"] == "בתנאי: Hall motion פעיל" and mine["can"]["edit"] is True
    # the configured Shabbat sensor is a calendar fact: readable to every schedule viewer
    shab = _by_name(c, "Living room cooling on rest days", OMER)["conditions"]["items"][0]
    assert shab["readable"] is True and shab["locked"] is False and shab["state"] == "off"

    def draft_now():
        cur = c.get(f"{API}/schedules/{made['id']}", headers=OMER).json()
        return cur, {"name": cur["name"], "weekdays": ["daily"], "start_date": None, "end_date": None, "repeat": "repeat", "tags": [], "conditions": {"items": [motion], "type": "or", "track": False},
                     "slots": [{"start": x["start"]["raw"], "stop": x["stop"]["raw"] if x["stop"] else None, "actions": [{"service": a["service"], "entity_id": a["entity_id"], "data": a["data"]} for a in x["actions"]]} for x in cur["slots"]]}

    cur, d = draft_now()
    d["slots"][0]["start"] = "17:30:00"  # times and actions: fine
    d["slots"][0]["actions"][0]["data"] = {"brightness": 40}
    r = put_draft(c, made["id"], d, cur["revision"], OMER)
    assert r.status_code == 200, r.text
    assert fake.bridge_calls[-1]["payload"]["timeslots"][0]["conditions"] == [{"entity_id": "binary_sensor.motion_hall", "attribute": "state", "value": "on", "match_type": "is"}]
    cur, d = draft_now()
    d["conditions"] = {"items": [], "type": None, "track": False}  # removing the locked condition
    r = put_draft(c, made["id"], d, cur["revision"], OMER)
    assert r.status_code == 403 and r.json()["code"] == "condition_locked" and r.json()["user_message"] == "התנאי \"Hall motion\" מחוץ להרשאתך ואי אפשר לשנות או להסיר אותו."
    cur, d = draft_now()
    d["conditions"] = {"items": [{**motion, "value": "off"}], "type": "or", "track": False}  # changing it
    assert put_draft(c, made["id"], d, cur["revision"], OMER).json()["code"] == "condition_locked"
    cur, d = draft_now()
    d["conditions"]["track"] = True  # its track / type flags go with it
    assert put_draft(c, made["id"], d, cur["revision"], OMER).json()["code"] == "condition_locked"
    cur, d = draft_now()
    d["conditions"]["items"].append(cond("on", "sensor.outdoor_temperature"))  # adding one the editor cannot read
    r = put_draft(c, made["id"], d, cur["revision"], OMER)
    assert r.status_code == 403 and r.json()["code"] == "condition_locked"  # beside a locked condition, "any of them" is refused (review L7)
    # a new schedule may not be conditioned on an entity the caller cannot read either
    r = c.post(f"{API}/schedules", json={"draft": draft_of("Nope", [slot("08:00:00", None, act("light.turn_off", "light.office"))], conditions=[motion]), "enabled": True, "client_request_id": rid()}, headers=OMER)
    assert r.status_code == 422 and r.json()["details"]["errors"][0]["code"] == "entity_unknown"  # unreadable: unknown to the caller


# ---------------------------------------------------------------- change rights

def test_a_floor_scoped_editor_edits_only_where_every_action_entity_is_in_scope(sched_app):
    app, s, c, fake, tr = sched_app
    ids = seed_tree(c)
    _place(c, ids["floor2"], "light.office")
    _grant(c, "omer", "עורך תזמונים", READ + ["devices.control"], ["schedule.manage"], "floor", ids["floor2"])
    r = c.post(f"{API}/schedules", json={"draft": draft_of("Mine"), "enabled": True, "client_request_id": rid()}, headers=OMER)
    assert r.status_code == 201, r.text
    sch = r.json()["schedule"]
    assert sch["owner"]["username"] == "omer" and sch["can"]["edit"] is True
    # an entity the caller cannot read at all is unknown to them (review L5 / L10): no 403 that confirms it exists
    r = c.post(f"{API}/schedules", json={"draft": draft_of("Other", [slot("08:00:00", None, act("climate.turn_off", "climate.living_room"))]), "enabled": True, "client_request_id": rid()}, headers=OMER)
    assert r.status_code == 422 and r.json()["code"] == "validation" and r.json()["details"]["errors"][0]["code"] == "entity_unknown"
    _grant(c, "omer", "קורא הכול", ["entity.state.read", "devices.read"], [], "installation", "*")  # now readable, but managed only on floor 2
    r = c.post(f"{API}/schedules", json={"draft": draft_of("Other", [slot("08:00:00", None, act("climate.turn_off", "climate.living_room"))]), "enabled": True, "client_request_id": rid()}, headers=OMER)
    assert r.status_code == 403 and r.json()["code"] == "forbidden"
    # an existing schedule can be edited only when NEW content stays inside the scope too
    d = draft_of("Mine", [slot("08:00:00", None, act("light.turn_off", "light.office"), act("climate.turn_off", "climate.living_room"))])
    assert put_draft(c, sch["id"], d, sch["revision"], OMER).status_code == 403
    assert not any(x["op"] == "edit" for x in fake.bridge_calls)


def test_a_view_only_holder_sees_everything_it_may_and_changes_nothing(sched_app):
    app, s, c, fake, tr = sched_app
    _grant(c, "omer", "צופה בלבד", READ, [], "installation", "*")
    sch = _by_name(c, "Hall lights on rest days", OMER)
    assert sch["can"] == {"edit": False, "toggle": False, "run": False, "delete": False, "copy": False} and sch["read_only"]["reasons"][0]["code"] == "no_manage_permission"
    st = c.get(f"{API}/schedules/status", headers=OMER).json()
    assert st["can"] == {"view": True, "manage": False, "sensitive": False, "configure": False} and st["writable"] is True
    for method, path, body in (("post", f"/schedules/{sch['id']}/disable", {"client_request_id": rid()}), ("post", "/schedules", {"draft": draft_of("x"), "enabled": True, "client_request_id": rid()}),
                               ("post", f"/schedules/{sch['id']}/run", {"slot_index": 0, "confirm": True, "client_request_id": rid()})):
        r = getattr(c, method)(f"{API}{path}", json=body, headers=OMER)
        assert r.status_code == 403 and r.json()["code"] == "forbidden", path
    assert c.get(f"{API}/schedules/review", headers=OMER).status_code == 403
    r = post_json(c, "/schedules/preview", {"draft": draft_of("p")}, OMER)
    assert r.status_code == 200 and r.json()["valid"] is True  # a viewer may preview
    assert not fake.bridge_calls
    assert c.get(f"{API}/schedules/catalog", headers=OMER).status_code == 403  # the picker is for managers


def test_a_plain_manager_sees_sensitive_schedules_read_only_and_cannot_create_them(sched_app):
    app, s, c, fake, tr = sched_app
    _grant(c, "omer", "מנהל תזמונים", READ + ["devices.control"], ["schedule.manage", "ha.entity.control"], "installation", "*")
    gate = _by_name(c, "Gate", OMER)
    assert gate["sensitive"] is True and gate["can"]["edit"] is False and gate["can"]["toggle"] is False and gate["can"]["delete"] is False
    assert [r["code"] for r in gate["read_only"]["reasons"]] == ["sensitive_permission_required"]
    assert gate["read_only"]["reasons"][0]["entity_id"] == "cover.driveway_gate"
    assert _by_name(c, "Hall lights on rest days", OMER)["can"]["edit"] is True
    d = draft_of("Gate", [slot("07:00:00", None, act("cover.open_cover", "cover.driveway_gate"))])
    r = c.post(f"{API}/schedules", json={"draft": d, "enabled": True, "client_request_id": rid(), "confirm_lowering": True}, headers=OMER)
    assert r.status_code == 403 and r.json()["code"] == "sensitive_permission_required"
    assert r.json()["user_message"] == "תזמון של אזעקה, מנעולים, דלתות ושערים דורש הרשאה לתזמון פעולות רגישות."
    assert post_json(c, f"/schedules/{gate['id']}/enable", {"client_request_id": rid(), "confirm_lowering": True}, OMER).status_code == 403
    _grant(c, "omer", "רגיש", ["map.read"], ["schedule.sensitive"], "installation", "*")
    assert c.post(f"{API}/schedules", json={"draft": d, "enabled": True, "client_request_id": rid(), "confirm_lowering": True}, headers=OMER).status_code == 201


def test_control_door_and_alarm_rules(sched_app):
    app, s, c, fake, tr = sched_app
    _grant(c, "omer", "מנהל בלי שליטה", READ, ["schedule.manage", "schedule.sensitive"], "installation", "*")
    light = draft_of("L", [slot("08:00:00", None, act("light.turn_off", "light.office"))])
    r = c.post(f"{API}/schedules", json={"draft": light, "enabled": True, "client_request_id": rid()}, headers=OMER)
    assert r.status_code == 403 and r.json()["code"] == "entity_not_controllable" and r.json()["user_message"] == "אין לך הרשאת שליטה ב־Office light."
    assert _by_name(c, "Office light on weekdays", OMER)["read_only"]["reasons"][0]["code"] == "entity_not_controllable"
    # devices.control reaches the everyday classes only
    _grant(c, "omer", "שליטה", ["devices.control"], [], "installation", "*")
    assert c.post(f"{API}/schedules", json={"draft": light, "enabled": True, "client_request_id": rid()}, headers=OMER).status_code == 201
    lock = draft_of("K", [slot("22:00:00", None, act("lock.lock", "lock.front_door"))])
    r = c.post(f"{API}/schedules", json={"draft": lock, "enabled": True, "client_request_id": rid()}, headers=OMER)
    assert r.status_code == 403 and r.json()["code"] == "entity_not_controllable"  # a lock needs ha.entity.control
    gate = draft_of("G", [slot("07:00:00", None, act("cover.close_cover", "cover.driveway_gate"))])
    assert c.post(f"{API}/schedules", json={"draft": gate, "enabled": True, "client_request_id": rid()}, headers=OMER).status_code == 403  # devices.control never reaches a gate
    _grant(c, "omer", "שליטה רחבה", ["map.read"], ["ha.entity.control"], "installation", "*")
    assert c.post(f"{API}/schedules", json={"draft": lock, "enabled": True, "client_request_id": rid()}, headers=OMER).status_code == 201
    assert c.post(f"{API}/schedules", json={"draft": gate, "enabled": True, "client_request_id": rid()}, headers=OMER).status_code == 201
    unlock = draft_of("U", [slot("06:00:00", None, act("lock.unlock", "lock.front_door"))])
    r = c.post(f"{API}/schedules", json={"draft": unlock, "enabled": True, "client_request_id": rid(), "confirm_lowering": True}, headers=OMER)
    assert r.status_code == 403 and r.json()["code"] == "grant_required" and r.json()["user_message"] == "הפעולה דורשת הרשאה נפרדת (פתיחת דלת)."
    _grant(c, "omer", "פותח דלתות", ["map.read"], ["door.unlock"], "installation", "*")
    assert c.post(f"{API}/schedules", json={"draft": unlock, "enabled": True, "client_request_id": rid(), "confirm_lowering": True}, headers=OMER).status_code == 201
    # the alarm: the alarm section's own authority, not control_allowed
    arm = draft_of("A", [slot("23:00:00", None, act("alarm_control_panel.alarm_arm_away", "alarm_control_panel.shed_panel"))])
    r = c.post(f"{API}/schedules", json={"draft": arm, "enabled": True, "client_request_id": rid()}, headers=OMER)
    assert r.status_code == 422 and r.json()["details"]["errors"][0]["code"] == "entity_unknown"  # without alarm.view the panel does not exist for them
    _grant(c, "omer", "צפייה באזעקה", ["alarm.view"], [], "installation", "*")
    r = c.post(f"{API}/schedules", json={"draft": arm, "enabled": True, "client_request_id": rid()}, headers=OMER)
    assert r.status_code == 403 and r.json()["code"] == "grant_required" and "דריכת אזעקה" in r.json()["user_message"]
    _grant(c, "omer", "אזעקה", ["alarm.arm"], [], "installation", "*")
    assert c.put(f"{API}/alarm/users/dev-omer/policy", json={"arm_policy": "no_code", "disarm_policy": "no_code"}).status_code == 200  # no code to verify: this test is about the rights
    assert c.post(f"{API}/schedules", json={"draft": arm, "enabled": True, "client_request_id": rid()}, headers=OMER).status_code == 201
    disarm = draft_of("D", [slot("06:00:00", None, act("alarm_control_panel.alarm_disarm", "alarm_control_panel.shed_panel"))])
    r = c.post(f"{API}/schedules", json={"draft": disarm, "enabled": True, "client_request_id": rid(), "confirm_lowering": True}, headers=OMER)
    assert r.status_code == 403 and r.json()["code"] == "grant_required" and "ניטרול אזעקה" in r.json()["user_message"]


def test_an_alarm_managed_control_is_never_schedulable(sched_app):
    app, s, c, fake, tr = sched_app
    r = c.post(f"{API}/schedules", json={"draft": draft_of("Z", [slot("08:00:00", None, act("switch.turn_on", "switch.zone_9_bypassed"))]), "enabled": True, "client_request_id": rid()})
    assert r.status_code == 422 and r.json()["code"] == "alarm_managed_control" and r.json()["user_message"] == "רכיב זה נשלט ממסך האזעקה ואינו נכנס לתזמון."
    assert "switch.zone_9_bypassed" not in {e["entity_id"] for e in c.get(f"{API}/schedules/catalog").json()["entities"]}


def test_the_classes_setting_gates_new_and_existing_schedules(sched_app):
    app, s, c, fake, tr = sched_app
    assert c.patch(f"{API}/settings", json={"schedules.classes": ["light", "switch", "cover", "fan", "alarm", "lock", "door"]}).status_code == 200
    assert c.get(f"{API}/settings").json()["settings"]["schedules.classes"] == ["light", "switch", "cover", "fan", "alarm", "lock", "door"]  # read back as an array
    sch = _by_name(c, "Living room cooling on rest days")
    assert sch["can"]["edit"] is False and sch["can"]["run"] is False and sch["can"]["delete"] is True and sch["can"]["toggle"] is True  # enabled: it may still be disabled
    assert [r["code"] for r in sch["read_only"]["reasons"]] == ["class_disabled"]
    off = _by_name(c, "Bedroom 1 cooling on rest days")
    assert off["can"]["toggle"] is False  # a disabled one may not be enabled
    assert post_json(c, f"/schedules/{off['id']}/enable", {"client_request_id": rid()}).json()["code"] == "class_not_allowed"
    assert post_json(c, f"/schedules/{sch['id']}/disable", {"client_request_id": rid()}).status_code == 200
    r = post_json(c, f"/schedules/{sch['id']}/run", {"slot_index": 0, "confirm": True, "client_request_id": rid()})
    assert r.status_code == 422 and r.json()["code"] == "class_not_allowed"
    assert "climate" not in {e["class"] for e in c.get(f"{API}/schedules/catalog").json()["entities"]}
    assert c.patch(f"{API}/settings", json={"schedules.classes": ["light", "spaceship"]}).status_code == 422
    assert c.patch(f"{API}/settings", json={"schedules.classes": []}).status_code == 200 and c.get(f"{API}/settings").json()["settings"]["schedules.classes"] == []


# ---------------------------------------------------------------- the creator's own alarm code (§5.6)

def _set_pin(c, user="joni"):
    r = c.put(f"{API}/alarm/users/dev-{user}/pin", json={"pin": PIN}, headers=BOSS)
    assert r.status_code == 200, r.text


def _arm_draft(name="Arm"):
    return draft_of(name, [slot("23:00:00", None, act("alarm_control_panel.alarm_arm_home", "alarm_control_panel.home_panel"))])


def test_creating_an_alarm_schedule_verifies_the_creators_own_code_and_discards_it(sched_app, caplog):
    app, s, c, fake, tr = sched_app
    caplog.set_level(logging.DEBUG)
    _boss(c, s)
    body = lambda **kw: {"draft": _arm_draft(), "enabled": True, "client_request_id": rid(), **kw}  # noqa: E731
    # the default policy is code_required and joni has no PIN yet
    r = c.post(f"{API}/schedules", json=body())
    assert r.status_code == 409 and r.json()["code"] == "pin_not_set"
    assert post_json(c, "/schedules/preview", {"draft": _arm_draft()}).json()["requires"]["alarm_code"] is True
    _set_pin(c)
    r = c.post(f"{API}/schedules", json=body())
    assert r.status_code == 409 and r.json()["code"] == "code_required" and r.json()["details"]["prompt"] == "pin" and r.json()["user_message"] == "נדרש קוד."
    r = c.post(f"{API}/schedules", json=body(alarm_code="00000000"))
    assert r.status_code == 403 and r.json()["code"] == "wrong_code" and r.json()["user_message"] == "קוד שגוי."
    assert not fake.bridge_calls
    r = c.post(f"{API}/schedules", json=body(alarm_code=PIN))
    assert r.status_code == 201, r.text
    # nothing of the code anywhere: not the answer, not the bridge payload, not the audit rows, not the logs, not the tables
    assert PIN not in r.text and PIN not in json.dumps(fake.bridge_calls) and PIN not in caplog.text
    assert "alarm_code" not in json.dumps(fake.bridge_calls) and "code" not in json.dumps([sl["actions"] for sl in fake.bridge_calls[-1]["payload"]["timeslots"]])
    with app.state.db.connection() as conn:
        for table in ("audit_log", "schedule_ops", "schedule_cache", "schedule_trash", "schedule_meta"):
            assert PIN not in json.dumps([list(map(str, row)) for row in conn.execute(f"SELECT * FROM {table}").fetchall()]), table
    # a policy that asks for no code needs none
    assert c.put(f"{API}/alarm/users/dev-joni/policy", json={"arm_policy": "no_code", "current_pin": PIN}).status_code == 200
    assert post_json(c, "/schedules/preview", {"draft": _arm_draft("Arm 2")}).json()["requires"]["alarm_code"] is False
    assert c.post(f"{API}/schedules", json=body(draft=_arm_draft("Arm 2"))).status_code == 201


def test_wrong_codes_count_toward_the_alarm_lockout(sched_app):
    app, s, c, fake, tr = sched_app
    _boss(c, s)
    _set_pin(c)
    codes_ = [c.post(f"{API}/schedules", json={"draft": _arm_draft(f"A{i}"), "enabled": True, "client_request_id": rid(), "alarm_code": "11111111"}).json()["code"] for i in range(6)]
    assert codes_[:5] == ["wrong_code"] * 5 and codes_[5] == "code_locked"
    r = c.post(f"{API}/schedules", json={"draft": _arm_draft("Late"), "enabled": True, "client_request_id": rid(), "alarm_code": PIN})
    assert r.status_code == 429 and r.json()["code"] == "code_locked"
    assert not fake.bridge_calls


def test_enable_and_run_of_an_alarm_schedule_need_the_code_too(sched_app):
    app, s, c, fake, tr = sched_app
    _boss(c, s)
    _set_pin(c)
    sch = _by_name(c, "Arm the home panel")
    assert post_json(c, f"/schedules/{sch['id']}/disable", {"client_request_id": rid()}).status_code == 200  # disabling raises nothing: no code
    r = post_json(c, f"/schedules/{sch['id']}/enable", {"client_request_id": rid()})
    assert r.status_code == 409 and r.json()["code"] == "code_required"
    assert post_json(c, f"/schedules/{sch['id']}/enable", {"client_request_id": rid(), "alarm_code": PIN}).status_code == 200
    r = post_json(c, f"/schedules/{sch['id']}/run", {"slot_index": 0, "confirm": True, "client_request_id": rid()})
    assert r.status_code == 409 and r.json()["code"] == "code_required"
    n = len(fake.bridge_calls)
    r = post_json(c, f"/schedules/{sch['id']}/run", {"slot_index": 0, "client_request_id": rid(), "alarm_code": PIN})
    assert r.status_code == 409 and r.json()["code"] == "confirmation_required" and len(fake.bridge_calls) == n  # arming is an attention-risk action: explicit confirmation
    r = post_json(c, f"/schedules/{sch['id']}/run", {"slot_index": 0, "confirm": True, "client_request_id": rid(), "alarm_code": PIN})
    assert r.status_code == 202 and fake.bridge_calls[-1]["op"] == "run" and fake.bridge_calls[-1]["sensitive"] is True and PIN not in json.dumps(fake.bridge_calls)


def test_an_unchanged_existing_arm_action_is_kept_while_a_new_one_on_a_coded_panel_is_refused(sched_app):
    app, s, c, fake, tr = sched_app
    sid = next(i for i, it in fake.items.items() if it["name"] == "Arm the home panel")
    # the panel now says arming needs a code: the existing action is kept with a warning, listed in the review
    fake.world["alarm_control_panel.home_panel"]["attributes"]["code_arm_required"] = True
    with app.state.db.connection() as conn:
        conn.execute("UPDATE ha_entities SET attributes_json = ? WHERE entity_id = 'alarm_control_panel.home_panel'", (json.dumps({"code_format": "number", "code_arm_required": True, "supported_features": 7}),))
    _boss_headers = None
    d = c.get(f"{API}/schedules/{sid}").json()
    assert [w["code"] for w in d["warnings"]] == ["alarm_may_need_code"]
    assert "alarm_may_need_code" in next(i["issues"] for i in c.get(f"{API}/schedules/review").json()["items"] if i["schedule"]["id"] == sid)
    c.put(f"{API}/alarm/users/dev-joni/policy", json={"arm_policy": "no_code", "disarm_policy": "no_code", "current_pin": "x"})  # (own policy: not needed for an admin without a PIN)
    draft = {"name": d["name"], "weekdays": ["daily"], "start_date": None, "end_date": None, "repeat": "repeat", "tags": [], "conditions": {"items": [], "type": None, "track": False},
             "slots": [{"start": "23:30:00", "stop": None, "actions": [{"service": "alarm_control_panel.alarm_arm_home", "entity_id": "alarm_control_panel.home_panel", "data": {}}]}]}
    r = put_draft(c, sid, draft, d["revision"], **{"alarm_code": None})
    assert r.status_code in (200, 409), r.text  # times may change; the arm action itself is unchanged (a 409 is only the creator's own code)
    draft["slots"][0]["actions"][0]["service"] = "alarm_control_panel.alarm_arm_away"
    cur = c.get(f"{API}/schedules/{sid}").json()
    r = put_draft(c, sid, draft, cur["revision"])
    assert r.status_code == 422 and r.json()["code"] == "alarm_code_needed"


# ---------------------------------------------------------------- the remote channel (§4.5)

def test_the_remote_channel_follows_the_alarm_settings(sched_app):
    app, s, c, fake, tr = sched_app
    _boss(c, s)
    assert c.put(f"{API}/alarm/users/dev-joni/policy", json={"arm_policy": "no_code", "disarm_policy": "no_code", "current_pin": None}, headers=BOSS).status_code == 200
    app.dependency_overrides[current_principal] = lambda: Principal(user_id="dev-joni", username="joni", display_name="joni", source="remote", via="cookie")
    try:
        assert c.patch(f"{API}/settings", json={"alarm.remote_control": "false"}, headers=BOSS).status_code in (200, 403)
        app.dependency_overrides.pop(current_principal)
        assert c.patch(f"{API}/settings", json={"alarm.remote_control": "false"}).status_code == 200
        app.dependency_overrides[current_principal] = lambda: Principal(user_id="dev-joni", username="joni", display_name="joni", source="remote", via="cookie")
        r = c.post(f"{API}/schedules", json={"draft": _arm_draft("Remote arm"), "enabled": True, "client_request_id": rid()})
        assert r.status_code == 403 and r.json()["code"] == "remote_control_disabled"
        ok = c.post(f"{API}/schedules", json={"draft": draft_of("Remote light"), "enabled": True, "client_request_id": rid()})
        assert ok.status_code == 201  # everything but alarm actions is identical to the local channel
        gate = _by_name(c, "Arm the home panel")
        assert gate["can"]["edit"] is False and gate["read_only"]["reasons"][0]["code"] == "entity_not_controllable"
        app.dependency_overrides.pop(current_principal)
        assert c.patch(f"{API}/settings", json={"alarm.remote_control": "true", "alarm.remote_disarm": "false"}).status_code == 200
        app.dependency_overrides[current_principal] = lambda: Principal(user_id="dev-joni", username="joni", display_name="joni", source="remote", via="cookie")
        assert c.post(f"{API}/schedules", json={"draft": _arm_draft("Remote arm"), "enabled": True, "client_request_id": rid()}).status_code == 201
        disarm = draft_of("Remote disarm", [slot("06:00:00", None, act("alarm_control_panel.alarm_disarm", "alarm_control_panel.shed_panel"))])
        r = c.post(f"{API}/schedules", json={"draft": disarm, "enabled": True, "client_request_id": rid(), "confirm_lowering": True})
        assert r.status_code == 403 and r.json()["code"] == "remote_disarm_disabled"
    finally:
        app.dependency_overrides.pop(current_principal, None)


# ---------------------------------------------------------------- grants are recorded

def test_denials_and_grants_are_audited_with_the_scope(sched_app):
    app, s, c, fake, tr = sched_app
    ids = seed_tree(c)
    _place(c, ids["floor2"], "light.office")
    _grant(c, "omer", "עורך תזמונים", READ + ["devices.control"], ["schedule.manage"], "floor", ids["floor2"])
    assert c.post(f"{API}/schedules", json={"draft": draft_of("Mine"), "enabled": True, "client_request_id": rid()}, headers=OMER).status_code == 201
    _grant(c, "omer", "קורא הכול", ["entity.state.read", "devices.read"], [], "installation", "*")
    bad = c.post(f"{API}/schedules", json={"draft": draft_of("Other", [slot("08:00:00", None, act("climate.turn_off", "climate.living_room"))]), "enabled": True, "client_request_id": rid()}, headers=OMER)
    assert bad.status_code == 403
    with app.state.db.connection() as conn:
        ok = conn.execute("SELECT * FROM audit_log WHERE action = 'schedule.create' AND decision = 'allowed' AND actor_username = 'omer'").fetchone()
        assert ok["scope_type"] == "floor" and ok["scope_id"] == ids["floor2"]
        denied = conn.execute("SELECT * FROM audit_log WHERE action = 'schedule.create' AND decision = 'denied' AND actor_username = 'omer'").fetchone()
        assert denied["reason"] == "forbidden" and json.loads(denied["details_json"])["status"] == 403
