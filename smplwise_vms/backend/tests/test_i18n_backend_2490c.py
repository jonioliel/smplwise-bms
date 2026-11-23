"""I18N-BACKEND-2490, third pass: the next producers answer in the requesting user's interface language (`ui.lang`) - the built-in role
names and the scope names (rbac.py), the generator routing's role labels, the tickets matrix's source labels, the automation run
summaries and traces, the editors' extension (conflicts, warnings, a schedule's test steps), the automation / schedule refusals that
quote a permission label, and the building-presence block problems. Hebrew stays byte for byte what the code wrote before: every new
text is a `Msg` (smplwise/i18n.py) whose string value IS the old Hebrew; only the edge that answers one request renders it. Whatever is
stored or sent (the tickets digest's title and body, a door emergency's notification params) stays plain Hebrew."""
from __future__ import annotations

import copy
import datetime as dt
import json
import pickle
import re
from pathlib import Path

from automations_fixture import *  # noqa: F401,F403
from automations_fixture import autos_app  # noqa: F401
from automations_fixture import API, OMER
from fastapi.testclient import TestClient
from schedules_fixture import sched_app  # noqa: F401

import schedules_fixture as sf

from smplwise import rbac
from smplwise.i18n import CATALOGUE, Lit, Msg, localize, t
from smplwise.services import automation_ext as ext
from smplwise.services import automation_scope as ascope
from smplwise.services import automation_trace as trace
from smplwise.services import building_presence_blocks as bpb
from smplwise.services import ha_bridge, rbac_admin, schedule_view

HEB = re.compile("[֐-׿]")
UTC = dt.timezone.utc


def english(c: TestClient, headers: dict[str, str] | None = None) -> None:
    r = c.put(f"{API}/me/prefs", json={"ui.lang": "en"}, headers=headers or {})
    assert r.status_code == 200 and r.json()["prefs"]["ui.lang"] == "en", r.text


def strings(value) -> list[str]:
    if isinstance(value, dict):
        return [s for v in value.values() for s in strings(v)]
    if isinstance(value, list):
        return [s for v in value for s in strings(v)]
    return [value] if isinstance(value, str) else []


# ---------------------------------------------------------------- the catalogues


def test_the_third_pass_namespaces_are_registered_with_english_and_the_same_slots():
    import smplwise.routers.generator  # noqa: F401 - registers `generator.role.*` (the route owns its three labels)

    namespaces = {k.split(".", 1)[0] for k in CATALOGUE}
    assert {"role", "scope", "generator", "trace", "ext", "action", "ascope", "sched"} <= namespaces
    slot = re.compile(r"\{(\w+)\}")
    for key, entry in CATALOGUE.items():
        if key.split(".", 1)[0] not in ("role", "scope", "generator", "trace", "ext", "action", "ascope", "sched"):
            continue
        assert entry["en"] and not HEB.search(entry["en"]), key
        assert sorted(slot.findall(entry["he"])) == sorted(slot.findall(entry["en"])), key


def test_lit_keeps_the_hebrew_and_renders_its_own_words():
    m = Lit({"he": "צפייה בבקשות שירות", "en": "View Tickets"})
    assert m == "צפייה בבקשות שירות" and isinstance(m, Msg) and m.render("en") == "View Tickets" and m.render("he") == "צפייה בבקשות שירות"
    assert Lit({"he": "x"}).render("en") == "x", "no English: the Hebrew"
    for clone in (copy.deepcopy(m), pickle.loads(pickle.dumps(m))):
        assert isinstance(clone, Lit) and clone == m and clone.render("en") == "View Tickets"
    assert json.dumps({"n": m}, ensure_ascii=False) == '{"n": "צפייה בבקשות שירות"}'
    assert localize({"a": [m]}, "en") == {"a": ["View Tickets"]}


# ---------------------------------------------------------------- rbac: role names and scope names


def test_every_built_in_role_name_is_a_msg_with_roles_json_hebrew():
    doc = json.loads((Path(rbac.__file__).parent / "roles.json").read_text(encoding="utf-8"))
    for role in doc["roles"]:
        name = rbac.ROLE_NAMES_HE[role["id"]]
        assert isinstance(name, Msg) and name.key == f"role.{role['id']}" and name == role["name_he"], role["id"]
        assert ("{tickets}" in name) == ("{tickets}" in name.render("en")), role["id"]


def test_role_name_fills_the_tickets_token_per_language(client: TestClient, settings):
    from smplwise.db import Database
    from smplwise.services.tickets import naming

    client.get(f"{API}/me")
    with Database(settings.db_path).connection() as conn:
        view = rbac.role_name(conn, "tickets_view")
        assert view == naming.render_for(conn, "צפייה ב{tickets}", "he") == "צפייה בבקשות שירות", "the Hebrew as before"
        assert isinstance(view, Lit) and view.render("en") == "View Tickets"
        admin = rbac.role_name(conn, "system_admin")
        assert admin == "מנהל מערכת" and admin.render("en") == "System administrator"
        assert rbac.role_name(conn, "custom-nope") == "custom-nope"


def test_scope_names_keep_the_old_hebrew(client: TestClient, settings):
    from smplwise.db import Database
    from smplwise.services import intercom_sync

    client.get(f"{API}/me")
    with Database(settings.db_path).connection() as conn:
        inst = rbac.scope_name(conn, "installation", "*")
        assert inst == "כל ההתקנה" and inst.render("en") == "The whole installation"
        row =conn.execute("SELECT id, alias, name_source, channel FROM cameras LIMIT 1").fetchone()
        if row is not None:
            got = rbac.scope_name(conn, "camera", row["id"])
            old = f"מצלמה · {row['alias'] or row['name_source'] or 'ערוץ ' + str(row['channel'])}"
            assert got == old and got.render("en").startswith("Camera · ")
        assert rbac.scope_name(conn, "camera", "nope") == "nope"
        st = rbac.scope_name(conn, rbac.STATION, "no-such-station")
        assert st == "עמדת אינטרקום (לא זמינה כרגע)" and st.render("en") == "Intercom station (not available right now)"
    channel = t("scope.camera", name=t("scope.channel", n=3))
    assert channel == "מצלמה · " + "ערוץ " + str(3) and channel.render("en") == "Camera · Channel 3"
    assert t("scope.station", name="לובי") == "עמדה · לובי" and t("scope.station", name="לובי").render("en") == "Station · לובי", "the name is data"
    assert intercom_sync  # the station source the scope name reads


def test_the_role_screens_show_role_and_scope_names_per_user(client: TestClient):
    c = client
    c.get(f"{API}/me")
    he_me = c.get(f"{API}/me").json()
    assert ("מנהל מערכת", "כל ההתקנה") in {(b["role_name"], b["scope_name"]) for b in he_me["bindings"]}
    he_roles = {r["id"]: r["name"] for r in c.get(f"{API}/access/roles").json()["roles"]}
    assert he_roles["viewer"] == "צופה" and he_roles["tickets_view"] == "צפייה בבקשות שירות"
    he_bind = c.get(f"{API}/access/bindings").json()["bindings"]

    english(c)
    en_me = c.get(f"{API}/me").json()
    assert ("System administrator", "The whole installation") in {(b["role_name"], b["scope_name"]) for b in en_me["bindings"]}
    assert [b["id"] for b in en_me["bindings"]] == [b["id"] for b in he_me["bindings"]]
    en_roles = {r["id"]: r["name"] for r in c.get(f"{API}/access/roles").json()["roles"]}
    assert en_roles["viewer"] == "Viewer" and en_roles["tickets_view"] == "View Tickets" and en_roles["door_opener"] == "Door opener"
    assert set(en_roles) == set(he_roles) and not [n for rid, n in en_roles.items() if rid in rbac.ROLES and HEB.search(n)]
    en_bind = c.get(f"{API}/access/bindings").json()["bindings"]
    assert [(b["id"], b["role_id"]) for b in en_bind] == [(b["id"], b["role_id"]) for b in he_bind]
    assert all(not HEB.search(b["role_name"]) for b in en_bind if b["role_id"] in rbac.ROLES)
    assert all(not HEB.search(b["scope_name"]) for b in en_bind if b["scope_type"] == "installation")
    users = c.get(f"{API}/identity/users").json()["users"]
    inst = [b for u in users for b in u["bindings"] if b["scope_type"] == "installation"]
    assert inst and all(b["scope_name"] == "The whole installation" for b in inst)
    roles = c.get(f"{API}/notices/audience/options").json().get("roles")
    if roles is not None:
        assert {r["id"]: r["name"] for r in roles}.get("operator") == "Operator"


def test_a_hebrew_reader_is_unchanged_while_another_user_reads_english(client: TestClient):
    c = client
    c.get(f"{API}/me")
    english(c, OMER)  # omer's choice changes nothing for joni
    me = c.get(f"{API}/me").json()
    assert ("מנהל מערכת", "כל ההתקנה") in {(b["role_name"], b["scope_name"]) for b in me["bindings"]}


# ---------------------------------------------------------------- the generator routing's role labels


def test_the_generator_role_labels_per_user(settings):
    from conftest import bind  # noqa: F401
    from generator_world import make_generator

    from smplwise.db import Database
    from smplwise.main import create_app
    from smplwise.services import generator_alerts, generator_core, generator_runtime, ha_sync

    ha_sync.STATE.connected = False
    generator_alerts.reset()
    generator_runtime.reset()
    c = TestClient(create_app(settings))
    c.get(f"{API}/me")
    db = Database(settings.db_path)
    make_generator(db, "full", model="DSE7320")
    with db.connection() as conn:
        generator_core.detect(conn)
    with db.connection(mode="read") as conn:
        g = conn.execute("SELECT id FROM generator_devices WHERE status <> 'removed'").fetchone()["id"]
    he = c.get(f"{API}/generator/devices/{g}/policies").json()
    assert he["roles"] == [{"id": "operator", "label": "מפעילים"}, {"id": "site_admin", "label": "מנהלי אתר"}, {"id": "system_admin", "label": "מנהלי מערכת"}]
    english(c)
    en = c.get(f"{API}/generator/devices/{g}/policies").json()
    assert en["roles"] == [{"id": "operator", "label": "Operators"}, {"id": "site_admin", "label": "Site administrators"},
                           {"id": "system_admin", "label": "System administrators"}]
    assert {k: v for k, v in en.items() if k != "roles"} == {k: v for k, v in he.items() if k != "roles"}


# ---------------------------------------------------------------- the tickets matrix and digest


def test_the_matrix_labels_are_msgs_and_the_stored_digest_stays_hebrew():
    from smplwise.services.tickets import notify_matrix
    from smplwise.services.tickets.notify_sources import SOURCE_DEFS

    for d in SOURCE_DEFS:
        lab = notify_matrix.LABELS[d["key"]]
        assert lab == d["label"] and isinstance(lab, Msg) and not HEB.search(lab.render("en")), d["key"]
    assert notify_matrix.LABELS["ticket.done"].render("en") == "Handling finished - waiting to be closed"
    parts = [f"{n} {notify_matrix.LABELS.get(s, s)}" for s, n in (("ticket.done", 2),)]
    assert parts == ["2 טיפול הסתיים - ממתין לסגירה"] and type(parts[0]) is str, "the digest body (stored, sent) is a plain Hebrew string"


def test_the_matrix_screen_per_user(settings):
    from tickets_world import build

    w = build(settings)
    he = w.c.get(f"{API}/tickets/settings/notify-matrix", headers=w.h("joni")).json()
    he_labels = {s["key"]: s["label"] for s in he["sources"]}
    assert he_labels["ticket.new_unassigned"] == "חדש וממתין למטפל"
    english(w.c, w.h("joni"))
    en = w.c.get(f"{API}/tickets/settings/notify-matrix", headers=w.h("joni")).json()
    en_labels = {s["key"]: s["label"] for s in en["sources"]}
    assert en_labels["ticket.new_unassigned"] == "New and waiting for a handler" and set(en_labels) == set(he_labels)
    assert not [v for v in en_labels.values() if HEB.search(v)]
    he_roles = {r["id"]: r["name"] for r in he["roles"]}
    en_roles = {r["id"]: r["name"] for r in en["roles"]}
    assert he_roles["tickets_view"] == "צפייה ב{tickets}" and en_roles["tickets_view"] == "View {tickets}", "the token as before, in each language"
    assert en_roles["operator"] == "Operator"


# ---------------------------------------------------------------- the automation run summary and trace


def _names(e: str) -> str:
    return {"binary_sensor.door": "Front door", "light.hall": "Hall"}.get(e, e)


def test_run_summaries_keep_the_hebrew_and_read_in_english():
    tz = UTC
    entry = {"run_id": "r1", "timestamp": {"start": "2026-11-23T10:05:00Z", "finish": "2026-11-23T10:05:01Z"}, "trigger": "state of binary_sensor.door",
             "script_execution": "error"}
    s = trace.summary(entry, _names, tz)
    assert s["sentence"] == "רצה ב־10:05 · שינוי ב־Front door · נעצרה בשגיאה"
    assert localize(s, "en")["sentence"] == "Ran at 10:05 · Change in Front door · stopped with an error"
    s2 = trace.summary({"run_id": "r2", "timestamp": {}, "trigger": "time pattern", "script_execution": "failed_conditions"}, _names, tz)
    assert s2["sentence"] == "רצה · שעה קבועה · התנאים לא התקיימו", "the word table's order as before ('time' first)"
    assert localize(s2, "en")["sentence"] == "Ran · Set time · the conditions were not met"
    for desc, he, en in (("", "הפעלה", "Trigger"), ("numeric state of sensor.t", "שינוי ערך ב־sensor.t", "Value change in sensor.t"),
                         ("template", "תבנית", "Template"), ("homeassistant start", "הפעלת המערכת", "System start"),
                         ("webhook", "קריאה חיצונית", "External call"), ("something new", "something new", "something new")):
        got = trace.describe_trigger(desc, _names)
        assert got == he and localize(got, "en") == en, desc


def test_a_run_trace_keeps_the_hebrew_and_reads_in_english():
    entry = {"run_id": "r9", "timestamp": {"start": "2026-11-23T08:00:00Z", "finish": "2026-11-23T08:00:02Z"}, "script_execution": "error",
             "trace": {"trigger/0": [{"timestamp": "2026-11-23T08:00:00Z", "changed_variables": {"trigger": {"description": "state of binary_sensor.door"}}}],
                       "condition/0": [{"timestamp": "2026-11-23T08:00:00.1Z", "result": {"result": True}}],
                       "action/0": [{"timestamp": "2026-11-23T08:00:00.2Z"}],
                       "action/1": [{"timestamp": "2026-11-23T08:00:01Z", "error": "boom"}]}}
    sentences = {"conditions.0": t("auto.st.on"), "actions.0": "Hall"}
    d = trace.detail(entry, step_paths=["actions.0", "actions.1"], sentences=sentences, name_of=_names, tz=UTC, user_name=lambda u: None)
    assert d["sentence"] == "רצה ב־08:00 כי שינוי ב־Front door; התנאי 'מופעל' עבר; ביצעה: Hall; נעצרה בשגיאה"
    en = localize(d, "en")
    assert en["sentence"] == "Ran at 08:00 because Change in Front door; The condition 'is on' passed; Did: Hall; Stopped with an error"
    assert en["trigger"]["sentence"] == "Change in Front door" and en["conditions"][0]["sentence"] == "is on"
    assert {k: v for k, v in en.items() if k not in ("sentence", "trigger", "conditions")} == \
        {k: v for k, v in localize(d, "he").items() if k not in ("sentence", "trigger", "conditions")}
    plain = trace.detail({**entry, "trace": {"condition/0": [{"result": {"result": False}}]}, "script_execution": "finished"},
                         step_paths=[], sentences={}, name_of=_names, tz=UTC, user_name=lambda u: None)
    assert plain["conditions"][0]["sentence"] == "תנאי" and localize(plain, "en")["conditions"][0]["sentence"] == "Condition"
    assert "התנאי 'תנאי' לא עבר" in plain["sentence"] and "The condition 'Condition' did not pass" in localize(plain, "en")["sentence"]


# ---------------------------------------------------------------- the editors' extension


def test_the_conflict_lines_keep_the_hebrew_and_read_in_english():
    c = {"other": {"kind": "schedule", "id": "s1", "name": "חדר הורים – קירור בשבת"}, "mine_at": "22:00", "other_at": "21:55", "delta_min": 5, "theirs": "off", "mine": "on"}
    title, detail = ext.conflict_text(c, "מזגן חדר שינה", 10)
    assert title == "התנגשות עם התזמון ״חדר הורים – קירור בשבת״"
    assert detail == "התזמון מכבה את מזגן חדר שינה ב־21:55, וכאן הוא נדלק ב־22:00: פעולות הפוכות בהפרש של 5 דקות, בתוך חלון של 10 דקות."
    assert title.render("en") == 'Conflict with the schedule "חדר הורים – קירור בשבת"'
    assert detail.render("en") == ("The schedule turns off מזגן חדר שינה at 21:55, and here it turns on at 22:00: opposite actions 5 minutes apart, "
                                   "within a window of 10 minutes.")
    a = {**c, "other": {"kind": "automation", "id": "a1", "name": "X"}, "theirs": "on", "mine": "off"}
    title, detail = ext.conflict_text(a, "Y", 3)
    assert title == "התנגשות עם האוטומציה ״X״" and detail.startswith("האוטומציה מדליקה את Y ב־21:55, וכאן הוא נכבה ב־22:00")
    assert detail.render("en").startswith("The automation turns on Y at 21:55, and here it turns off at 22:00")
    assert ext.SAFETY_TRIGGER_TEXT == "צליל קריטי מותר רק לאירועי בטיחות שהופעלו בהגדרות › התראות"
    assert ext.BRIDGE_TOO_OLD_TEXT.render("en") == "The connection component must be updated to save this part"


def test_the_action_labels_follow_ha_bridge_and_the_step_sentence_keeps_its_bytes():
    for aid, spec in ha_bridge.ACTIONS.items():
        lab = ext.action_label(aid, spec["label"])
        assert isinstance(lab, Msg) and lab == spec["label"] and not HEB.search(lab.render("en")), aid
    assert set(ha_bridge.ACTIONS) == {k[len("action.label."):] for k in CATALOGUE if k.startswith("action.label.")}
    assert ext.action_label("light.turn_on", "something else") == "something else", "a label that moved stays itself"
    lab = ext.action_label("climate.set_hvac_mode", ha_bridge.ACTIONS["climate.set_hvac_mode"]["label"])
    for when, label, name in (("07:00", lab, "מזגן"), ("", lab, "מזגן"), ("07:00", lab, ""), ("07:00", "", "מזגן"), ("", "", ""), ("·07", lab, "x ")):
        got = ext._step_sentence(when, label, name)
        assert got == f"{when} · {label} · {name}".strip(" ·"), (when, label, name)
    s = ext._step_sentence("07:00", lab, "מזגן")
    assert s == "07:00 · מצב פעולה · מזגן" and localize(s, "en") == "07:00 · Operating mode · מזגן"


def test_the_schedule_test_plan_sentence_per_user(autos_app):
    app, s, c, fake, tr = autos_app
    c.patch(f"{API}/settings", json={"schedules.enabled": "true", "automations.device_test_enabled": "true"})
    item = {"schedule_id": "sch_i18n", "entity_id": "switch.schedule_i18n", "name": "בדיקה", "weekdays": ["daily"], "enabled": True,
            "timeslots": [{"start": "07:00:00", "stop": None, "actions": [{"service": "climate.set_hvac_mode", "entity_id": "climate.living_room", "service_data": {"hvac_mode": "off"}}]}]}
    with app.state.db.connection() as conn:
        conn.execute("INSERT OR REPLACE INTO schedule_cache(schedule_id, entity_id, revision, item_json, enabled, seen_at, changed_at) VALUES (?,?,?,?,?,?,?)",
                     ("sch_i18n", item["entity_id"], "rev1", json.dumps(item), 1, "2026-10-24T10:00:00Z", "2026-10-24T10:00:00Z"))
    url = f"{API}/automations-ext/schedule/sch_i18n/device-test"
    he = c.post(url, json={}).json()
    assert he["steps"][0]["sentence"].startswith("07:00 · מצב פעולה · ")
    english(c)
    en = c.post(url, json={}).json()
    assert en["steps"][0]["sentence"].startswith("07:00 · Operating mode · ")
    assert [{k: v for k, v in x.items() if k != "sentence"} for x in en["steps"]] == [{k: v for k, v in x.items() if k != "sentence"} for x in he["steps"]]


# ---------------------------------------------------------------- refusals of the automation scope and the schedules view


def test_the_reason_tables_are_msgs_with_their_old_hebrew():
    for table, ns in ((ascope.REASON_MESSAGES, "ascope.reason"), (schedule_view.REASON_MESSAGES, "sched.reason")):
        for code, m in table.items():
            assert isinstance(m, Msg) and m.key == f"{ns}.{code}" and not HEB.search(m.render("en")), code
    assert ascope.REASON_MESSAGES["yaml_managed"] == "מוגדרת בקובץ תצורה – לצפייה בלבד"
    assert ascope.reason("delegation_off")["message"].render("en") == "Saving needs an administrator"
    assert schedule_view.reason("feature_disabled")["message"].render("en") == "Schedules are turned off in the system settings."


def test_the_refusals_that_quote_a_permission_label_render_it_in_the_same_language():
    perm = rbac_admin.PERMISSION_LABELS["alarm.arm"]
    m = t("ascope.no_grant_at", perm=perm, name="לוח")
    assert m == f"אין לך הרשאה ל{perm} ב־לוח." == "אין לך הרשאה לדריכת אזעקה ב־לוח."
    assert m.render("en") == 'You do not have the permission "Arm the alarm" for לוח.'
    g = t("sched.needs_grant", perm=perm)
    assert g == f"הפעולה דורשת הרשאה נפרדת ({perm})." and g.render("en") == "The action needs a separate permission (Arm the alarm)."
    media = t("sched.needs_media_grant", perm="media.power")
    assert media == "הפעולה דורשת הרשאת מולטימדיה (media.power)." and media.render("en") == "The action needs a multimedia permission (media.power).", "an unlabelled id stays"
    assert t("sched.no_run_of", name="סצנה") == "אין לך הרשאה להפעיל את סצנה."
    assert t("sched.script_field_unsupported", field="x") == "לסקריפט משתנה חובה שהמערכת אינה מציגה (x); אפשר לתזמן אותו רק ברכיב המקורי."


def test_a_schedule_refusal_and_a_read_only_reason_per_user(sched_app):
    app, s, c, fake, tr = sched_app
    sf.grant(c, "omer", "מנהל בלי שליטה", ["schedule.view", "devices.read", "entity.state.read"], ["schedule.manage", "schedule.sensitive"], "installation", "*")
    light = sf.draft_of("L", [sf.slot("08:00:00", None, sf.act("light.turn_off", "light.office"))])
    r = c.post(f"{API}/schedules", json={"draft": light, "enabled": True, "client_request_id": sf.rid()}, headers=OMER)
    assert r.status_code == 403 and r.json()["user_message"] == "אין לך הרשאת שליטה ב־Office light."

    def office(headers):
        items = c.get(f"{API}/schedules", params={"limit": 500}, headers=headers).json()["items"]
        return next(x for x in items if x["name"] == "Office light on weekdays")

    he_item = office(OMER)
    assert he_item["read_only"]["reasons"][0]["message"] == "אין לך הרשאת שליטה ב־Office light."
    english(c, OMER)
    r = c.post(f"{API}/schedules", json={"draft": light, "enabled": True, "client_request_id": sf.rid()}, headers=OMER)
    assert r.status_code == 403 and r.json()["code"] == "entity_not_controllable" and r.json()["user_message"] == "You do not have permission to control Office light."
    en_item = office(OMER)
    assert en_item["read_only"]["reasons"][0] == {**he_item["read_only"]["reasons"][0], "message": "You do not have permission to control Office light."}


# ---------------------------------------------------------------- building presence block problems


def test_the_building_presence_problems_per_language():
    out = bpb.validate({"sensors": [], "minutes": 0}, "trigger", ["binary_sensor.a"], True)
    assert out == [("presence_sensors_required", "בחרו חיישני נוכחות"), ("presence_minutes_invalid", "הגדירו זמן בדקות (1 עד 1440)")]
    assert [localize(m, "en") for _c, m in out] == ["Choose presence sensors", "Set a time in minutes (1 to 1440)"]
    off = bpb.validate({}, "condition", None, False)
    assert off == [("building_presence_off", "אין חיישני נוכחות מסומנים במבנה")] and off[0][1].render("en") == "No sensors in the building are marked as presence sensors"
    untagged = bpb.validate({"sensors": ["binary_sensor.b"], "mode": "x"}, "condition", ["binary_sensor.a"], True)
    assert untagged == [("presence_sensor_untagged", "החיישן אינו מסומן כחיישן נוכחות"), ("presence_mode_invalid", "בחרו מצב")]
    assert [m.render("en") for _c, m in untagged] == ["The sensor is not marked as a presence sensor", "Choose a state"]
