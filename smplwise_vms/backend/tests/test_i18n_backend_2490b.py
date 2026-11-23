"""I18N-BACKEND-2490, second pass: the next user-visible producers of Hebrew answer in the requesting user's interface language
(`ui.lang`) - the RBAC administration (permission labels, scope names, refusals), the notification policy labels and refusals, the
automation sentences, the health report and its top-bar summary, and the stream-codec hint. Hebrew stays byte for byte what the code
wrote before: every new text is a `Msg` (smplwise/i18n.py) whose string value IS the old Hebrew; only the edge that answers one request
renders it. Whatever is stored, compared or sent (notification titles and bodies, the severity words, a camera's fallback name written to
the NVR) stays plain Hebrew."""
from __future__ import annotations

import copy
import json
import pickle
import re

from automations_fixture import *  # noqa: F401,F403
from automations_fixture import autos_app  # noqa: F401
from automations_fixture import draft_of
from conftest import as_user
from fastapi.testclient import TestClient

from smplwise.i18n import CATALOGUE, Cat, Msg, cat, join, localize, t
from smplwise.services import automation_text as at
from smplwise.services import automation_text_i18n as words
from smplwise.services import building_presence_blocks as bpb
from smplwise.services import health_report, notify_policy, rbac_admin, stream_codecs

API = "/api/v1"
HEB = re.compile("[֐-׿]")


def english(c: TestClient, user: str | None = None) -> None:
    r = c.put(f"{API}/me/prefs", json={"ui.lang": "en"}, headers=as_user(user) if user else {})
    assert r.status_code == 200 and r.json()["prefs"]["ui.lang"] == "en", r.text


def strings(value) -> list[str]:
    out: list[str] = []
    if isinstance(value, dict):
        for v in value.values():
            out.extend(strings(v))
    elif isinstance(value, list):
        for v in value:
            out.extend(strings(v))
    elif isinstance(value, str):
        out.append(value)
    return out


# ---------------------------------------------------------------- the mechanism: a sentence made of parts


def test_the_new_namespaces_are_registered_and_cat_join_keep_the_hebrew():
    namespaces = {k.split(".", 1)[0] for k in CATALOGUE}
    assert {"perm", "rbac", "notify", "auto", "health", "codec"} <= namespaces
    m = cat(t("auto.st.opens"), " · ", 5)
    assert isinstance(m, Cat) and m == "נפתח/ת · 5" and m.render("en") == "opens · 5"
    assert cat("a", "b") == "ab" and type(cat("a", "b")) is str, "data only: no wrapper"
    j = join(t("auto.or"), ["x", t("auto.st.opens")])
    assert j == "x או נפתח/ת" and localize(j, "en") == "x or opens"
    assert join(", ", []) == "" and join(", ", ["only"]) == "only"
    for clone in (copy.deepcopy(m), pickle.loads(pickle.dumps(m))):
        assert isinstance(clone, Cat) and clone == m and clone.render("en") == "opens · 5"
    assert json.dumps({"s": m}, ensure_ascii=False) == '{"s": "נפתח/ת · 5"}'


# ---------------------------------------------------------------- stream codecs (the wizard's and the camera's hint)


def test_the_codec_hint_is_the_old_hebrew_and_reads_in_english():
    enc = {"webrtc": "no", "reason": "b_frames", "codec": "H.264", "svc": False}
    hint = stream_codecs.main_hint("מצלמת לובי", 2, enc, "DS-7608NI")
    assert hint == ("הזרם הראשי של מצלמת לובי מקודד H.264 עם B-frames - לא יתנגן ב-WebRTC; לשינוי: NVR DS-7608NI → Configuration → Video/Audio → Video → "
                    "Camera 2 → Main Stream (Continuous) → Video Encoding: B-frames off")
    assert hint.render("en") == ("The main stream of מצלמת לובי is encoded in H.264 with B-frames - it will not play over WebRTC; to change it: NVR DS-7608NI → "
                                 "Configuration → Video/Audio → Video → Camera 2 → Main Stream (Continuous) → Video Encoding: B-frames off"), "the camera name is data"
    other = stream_codecs.main_hint("Cam", 1, {"webrtc": "no", "reason": "x", "codec": None}, None)
    assert other == "הזרם הראשי של Cam מקודד ? - לא יתנגן ב-WebRTC; לשינוי: NVR → Encoding → Main stream → H.264, B-frames off"
    assert other.render("en").startswith("The main stream of Cam is encoded in ? - ")
    assert stream_codecs.main_hint("Cam", 1, {"webrtc": "ok"}, None) is None


# ---------------------------------------------------------------- the health report and the top-bar summary


def test_health_report_and_summary_in_hebrew_and_english(client: TestClient):
    c = client
    c.get(f"{API}/me")
    he = c.get(f"{API}/health/report").json()
    by_id = {x["id"]: x for x in he["checks"]}
    assert by_id["db"]["label"] == "מסד נתונים" and by_id["db"]["detail"].startswith("תקין · WAL · ")
    assert by_id["backups"]["label"] == "גיבויים" and by_id["backups"]["detail"] == "0 גיבויים · אחרון אין עדיין"
    assert by_id["ha_sync"]["label"] == "סנכרון Home Assistant"
    he_sum = c.get(f"{API}/health/summary").json()
    assert {"id": "backups", "status": "warn", "label": "אין עדיין גיבוי של הפרויקט"} in he_sum["items"]

    english(c)
    en = c.get(f"{API}/health/report").json()
    by_id_en = {x["id"]: x for x in en["checks"]}
    assert by_id_en["db"]["label"] == "Database" and by_id_en["db"]["detail"].startswith("OK · WAL · ") and "schema" in by_id_en["db"]["detail"]
    assert by_id_en["backups"]["detail"] == "0 backups · last none yet"
    assert by_id_en["storage"]["label"] == "Add-on storage (/data)"
    leftovers = [s for x in en["checks"] for s in (x["label"], x["detail"]) if HEB.search(s)]
    assert leftovers == [], leftovers
    assert [(x["id"], x["status"]) for x in en["checks"]] == [(x["id"], x["status"]) for x in he["checks"]], "the machine fields do not move"
    en_sum = c.get(f"{API}/health/summary").json()
    assert {"id": "backups", "status": "warn", "label": "There is no backup of the project yet"} in en_sum["items"]
    assert not [i for i in en_sum["items"] if HEB.search(i["label"])]
    # the readiness report quotes the health labels in its "connections" check: now in English too
    ready = c.get(f"{API}/readiness").json()
    integ = next(x for x in ready["checks"] if x["id"] == "integrations")
    assert not [s for s in strings(integ) if HEB.search(s)], integ


def test_health_background_readers_stay_hebrew(client: TestClient, settings):
    from smplwise.db import Database

    client.get(f"{API}/me")
    english(client)  # an English administrator exists; a reader without a user still gets Hebrew
    with Database(settings.db_path).connection() as conn:
        report = health_report.build(settings, conn, probe=False)  # the fleet report and the readiness check read it without a user
        summary = health_report.summary(settings, conn)  # the notification monitor (notify_sources.health_tick) stores these labels
    db = next(x for x in report["checks"] if x["id"] == "db")
    assert db["label"] == "מסד נתונים" and isinstance(db["label"], str)
    assert json.dumps(report, ensure_ascii=False).count("Database") == 0
    assert any(i["label"] == "אין עדיין גיבוי של הפרויקט" for i in summary["items"])


def test_health_clock_and_restart_texts_render_both_ways():
    basis = t("health.clock.israel")
    m = t("health.clock.differs", basis=basis, when=t("health.clock.periods"))
    assert m == "לפי שעון ישראל · שעון המכשיר שונה משעון ישראל בחלק מהשנה (מעבר שעון); זמני החיפוש והניגון מומרים לפי שעון ישראל"
    assert m.render("en") == ("By Israel time · the device clock differs from Israel time for part of the year (clock change); search and playback times "
                              "are converted by Israel time")
    from smplwise import mode

    assert CATALOGUE["health.nvr.ha_only"]["he"].startswith(mode.NVR_LESS_LABEL + " (Home Assistant בלבד)")


# ---------------------------------------------------------------- notification policies


def test_every_source_label_is_a_msg_with_its_old_hebrew():
    for s in notify_policy.SOURCES:
        assert isinstance(s.label, Msg) and s.label.key == f"notify.label.{s.key}", s.key
        assert not HEB.search(s.label.render("en")), s.key
    assert notify_policy.BY_KEY["sensor.leak"].label == "דליפת מים"
    gen = next(s for s in notify_policy.SOURCES if s.key.startswith("generator."))
    assert gen.label.startswith("גנרטור: ") and gen.label.render("en").startswith("Generator: ")
    # stored and sent: title, body, resolve text and the severity words stay plain Hebrew
    assert notify_policy.render("sensor.leak", {"name": "חיישן מטבח"}) == ("דליפת מים", "חיישן מטבח דיווח על מים.")
    assert notify_policy.SEVERITY_LABEL_HE == {"info": "מידע", "alert": "התראה", "critical": "קריטי"}
    assert all(type(v) is str for v in notify_policy.SEVERITY_LABEL_HE.values())


def test_policy_labels_and_refusals_follow_the_language(client: TestClient):
    c = client
    c.get(f"{API}/me")
    he = c.get(f"{API}/notify/policies")
    assert he.status_code == 200, he.text
    labels_he = {p["source"]: p["label"] for p in he.json()["policies"]}
    assert labels_he["sensor.leak"] == "דליפת מים" and labels_he["camera.offline"] == "מצלמה לא זמינה"
    r = c.put(f"{API}/notify/policies/sensor.leak", json={"severity": "loud"})
    assert r.status_code == 422 and r.json()["user_message"] == "חומרה לא מוכרת."

    english(c)
    en = c.get(f"{API}/notify/policies").json()
    labels_en = {p["source"]: p["label"] for p in en["policies"]}
    assert labels_en["sensor.leak"] == "Water leak" and labels_en["camera.offline"] == "Camera unavailable"
    assert not [v for v in labels_en.values() if HEB.search(v)]
    assert [p["source"] for p in en["policies"]] == [p["source"] for p in he.json()["policies"]]
    one = c.get(f"{API}/notify/policies/rule.alert").json()
    assert one["label"] == "Alerts from rules"
    r = c.put(f"{API}/notify/policies/sensor.leak", json={"severity": "loud"})
    assert r.status_code == 422 and r.json()["code"] == "validation" and r.json()["user_message"] == "Unknown severity."
    r = c.get(f"{API}/notify/policies/nope.nothing")
    assert r.status_code == 404 and r.json()["user_message"] == "The notification source was not found."


# ---------------------------------------------------------------- RBAC administration


def test_every_permission_label_is_a_msg_with_its_old_hebrew():
    for k, v in rbac_admin.PERMISSION_LABELS.items():
        assert isinstance(v, Msg) and v.key == f"perm.{k}", k
        assert not HEB.search(v.render("en")), k
        assert ("{module}" in v) == ("{module}" in v.render("en")), k
    assert rbac_admin.PERMISSION_LABELS["script.run"] == "הפעלת סקריפטים"
    assert f"אין לך הרשאה ל{rbac_admin.PERMISSION_LABELS['script.run']}." == "אין לך הרשאה להפעלת סקריפטים.", "other modules' f-strings read the Hebrew"


def test_role_screens_scopes_and_refusals_follow_the_language(client: TestClient):
    c = client
    c.get(f"{API}/me")
    he = c.get(f"{API}/access/roles").json()
    assert he["labels"]["map.read"] == "צפייה במפה" and he["labels"]["tickets.view"] == "ניהול השירות: צפייה"
    scopes_he = c.get(f"{API}/identity/users").json()["assign_scopes"]
    assert scopes_he[0] == {"type": "installation", "id": "*", "name": "כל ההתקנה"}
    r = c.post(f"{API}/access/bindings", json={"subject_kind": "user", "subject_id": "joni", "role_id": "no_such_role", "scope_type": "installation", "scope_id": "*"})
    assert r.status_code == 422 and r.json()["user_message"] == "תפקיד לא מוכר."

    english(c)
    en = c.get(f"{API}/access/roles").json()
    assert en["labels"]["map.read"] == "View the map" and en["labels"]["tickets.view"] == "Tickets: view", "the module's English name fills {module}"
    assert set(en["labels"]) == set(he["labels"]) and not [v for v in en["labels"].values() if HEB.search(v)]
    assert [r["id"] for r in en["roles"]] == [r["id"] for r in he["roles"]]
    scopes_en = c.get(f"{API}/identity/users").json()["assign_scopes"]
    assert scopes_en[0] == {"type": "installation", "id": "*", "name": "The whole installation"}
    r = c.post(f"{API}/access/bindings", json={"subject_kind": "user", "subject_id": "joni", "role_id": "no_such_role", "scope_type": "installation", "scope_id": "*"})
    assert r.status_code == 422 and r.json()["code"] == "role_unknown" and r.json()["user_message"] == "Unknown role."


# ---------------------------------------------------------------- automation sentences


def test_the_verbs_and_the_english_table_cover_the_same_services():
    assert set(words.VERBS_EN) == set(at.ACTION_VERBS)
    for action, he in at.ACTION_VERBS.items():
        assert CATALOGUE[f"auto.word.{action}"]["he"] == he
        assert at.action_label(action) == he.replace("{n}", "").rstrip("־").strip()
    assert at.action_label("media_player.media_play").render("en") == "Play on"
    assert at.action_label("vacuum.start") == "vacuum.start"


def test_sentences_keep_the_hebrew_and_read_in_english():
    ctx = at.ModelContext(names=lambda e: {"binary_sensor.front_door": "Front door", "light.hall": "Hall", "light.stairs": "Stairs"}.get(e))
    d = {"triggers": [{"kind": "typed", "type": "state", "entity_ids": ["binary_sensor.front_door"], "to": "on", "for": {"minutes": 5}},
                      {"kind": "typed", "type": "sun", "event": "sunset", "offset_min": -10}],
         "conditions": [{"kind": "typed", "type": "time", "after": "08:00:00", "before": "20:00:00", "weekday": ["sun", "mon"]},
                        {"kind": "typed", "type": "presence", "mode": "nobody"}],
         "actions": [{"kind": "typed", "type": "service", "role": "device", "action": "light.turn_on", "entity_ids": ["light.hall", "light.stairs"], "data": {"brightness_pct": 40}},
                     {"kind": "typed", "type": "delay", "delay": {"hours": 1, "minutes": 30}},
                     {"kind": "typed", "type": "if", "conditions": [{"kind": "typed", "type": "shabbat", "mode": "not_holy_days"}],
                      "then": [{"kind": "typed", "type": "service", "role": "device", "action": "alarm_control_panel.alarm_arm_away", "entity_ids": ["alarm_control_panel.home"], "data": {}}],
                      "else": [{"kind": "typed", "type": "stop"}]},
                     {"kind": "locked", "label": at.locked_label({"wait_template": "x"}, "unsupported_step", "action")}]}
    s = at.automation_sentence(d, ctx)
    assert isinstance(s, Msg)
    assert s == ("כשFront door נפתח/ת במשך 5 דקות או 10 דק׳ לפני השקיעה, אם בין 08:00 ל־20:00 בימים א׳, ב׳ ואין אף אחד במבנה – הדלק Hall וStairs ל־40%; "
                 "המתן שעה ו30 דקות; אם לא בשבת וחג – דרוך את alarm_control_panel.home (מלא), אחרת – עצור ופעולה מתקדמת")
    assert localize(s, "en") == ("When Front door opens for 5 minutes or 10 min before sunset, if between 08:00 and 20:00 on days Sun, Mon and Nobody is in the "
                                 "building – Turn on Hall and Stairs to 40%; Wait 1 hour and 30 minutes; If Not on Shabbat and holidays – Arm "
                                 "alarm_control_panel.home (away), otherwise – Stop and Advanced action")
    scene = at.scene_sentence({"members": []})
    assert scene == "סצנה ריקה" and scene.render("en") == "Empty scene"
    locked = at.locked_label({"device_id": "d1"}, "device", "trigger")
    assert locked == "כפתור · מכשיר" and locked.render("en") == "Button · Device"
    trig = bpb.trigger_sentence({"minutes": 3})
    assert trig == "כשהמבנה ריק במשך 3 דקות" and trig.render("en") == "When the building has been empty for 3 minutes"
    cond = bpb.condition_sentence({"mode": "occupied", "sensors": ["a", "b", "c", "d"]}, None, lambda e: e.upper())
    assert cond == "יש נוכחות בA · B · C ועוד 1" and cond.render("en") == "Occupied in A · B · C and 1 more"


def test_the_golden_sentences_are_unchanged_in_hebrew():
    from pathlib import Path

    gold = json.loads((Path(__file__).resolve().parent / "fixtures" / "automations" / "sentences_golden.json").read_text(encoding="utf-8"))
    assert gold, "the seed's golden sentences (tests/test_automation_text.py compares every one of them with the Msg's Hebrew)"
    # here: the result of a typed sentence is a str and equal as a str
    s = at.trigger_sentence({"kind": "typed", "type": "homeassistant"})
    assert s == "כשהמערכת עולה" and str.__str__(s) == "כשהמערכת עולה"


def test_the_preview_sentences_follow_the_users_language(autos_app):
    app, s, c, fake, tr = autos_app
    body = {"kind": "automation", "draft": draft_of("בדיקה", conditions=[{"uid": "c1", "kind": "typed", "type": "shabbat", "mode": "not_holy_days"}])}
    he = c.post(f"{API}/automations/preview", json=body).json()
    assert he["sentence"] == "כשHall motion מזהה תנועה, אם לא בשבת וחג – הדלק Office light ל־40%"
    english(c)
    en = c.post(f"{API}/automations/preview", json=body).json()
    assert en["sentence"] == "When Hall motion detects motion, if Not on Shabbat and holidays – Turn on Office light to 40%"
    assert en["block_sentences"] == {"n1": "When Hall motion detects motion", "c1": "Not on Shabbat and holidays", "n2": "Turn on Office light to 40%"}
    assert {k: v for k, v in en.items() if k not in ("sentence", "block_sentences")} == {k: v for k, v in he.items() if k not in ("sentence", "block_sentences")}
