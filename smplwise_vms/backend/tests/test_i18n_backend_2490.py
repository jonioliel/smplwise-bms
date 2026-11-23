"""I18N-BACKEND-2490: the texts the server builds for a screen - the setup wizard, the readiness report and the error envelope's
`user_message` - follow the requesting user's interface language (`ui.lang`); no stored value, no user or a background reader = Hebrew,
byte for byte the text written before the change. A text is a `Msg` (smplwise/i18n.py): a catalogue key + params whose str value is the
Hebrew, rendered in the user's language only at the edge that answers the request."""
from __future__ import annotations

import copy
import dataclasses
import json
import pickle
import re
import sys
from pathlib import Path

import pytest
from conftest import as_user, bind
from fastapi.testclient import TestClient

from smplwise import errors
from smplwise.db import Database
from smplwise.errors import ApiError
from smplwise.i18n import CATALOGUE, LANGS, Msg, localize, t
from smplwise.main import create_app
from smplwise.routers import readiness as readiness_router
from smplwise.services import autosync, bridge_install, events_ingest, ha_sync, readiness, user_prefs
from smplwise.services import setup_wizard as wizard

sys.path.insert(0, str(Path(__file__).resolve().parent / "fixtures"))
from fake_devices import GO2RTC_HOST, HA_HOST, NVR_HOST, FakeDevices  # noqa: E402

API = "/api/v1"
HEB = re.compile("[֐-׿]")
SLOT = re.compile(r"\{(\w+)\}")


def hebrew(value) -> bool:
    return bool(HEB.search(json.dumps(value, ensure_ascii=False)))


def texts_of(value) -> list[str]:
    """Every user-visible string of a wizard / readiness answer (labels, values, summaries, messages, actions, link labels)."""
    out: list[str] = []
    if isinstance(value, dict):
        for k, v in value.items():
            if k in ("evidence", "capabilities", "history", "settings", "href", "id", "code", "status", "tone", "source", "group", "mode"):
                continue
            out.extend(texts_of(v))
    elif isinstance(value, list):
        for v in value:
            out.extend(texts_of(v))
    elif isinstance(value, str):
        out.append(value)
    return out


def english(c: TestClient, user: str | None = None) -> None:
    headers = as_user(user) if user else {}
    r = c.put(f"{API}/me/prefs", json={"ui.lang": "en"}, headers=headers)
    assert r.status_code == 200 and r.json()["prefs"]["ui.lang"] == "en", r.text


@pytest.fixture(autouse=True)
def clean_process_state(monkeypatch):
    wizard.reset()
    monkeypatch.setattr(wizard, "CHECK_EVERY_S", 0.0)
    for k in list(autosync.STATE):
        monkeypatch.setitem(autosync.STATE, k, None)
    for k in ("connected", "last_error", "ha_version"):
        monkeypatch.setattr(ha_sync.STATE, k, False if k == "connected" else None)
    monkeypatch.setattr(ha_sync.STATE, "entities", 0)
    monkeypatch.setattr(events_ingest.STATE, "connected", True)
    for k in list(bridge_install.STATE):
        monkeypatch.setitem(bridge_install.STATE, k, None)
    readiness_router._last_check.clear()
    yield
    wizard.reset()
    readiness_router._last_check.clear()


@pytest.fixture()
def fake(monkeypatch) -> FakeDevices:
    f = FakeDevices()
    f.install(monkeypatch)
    return f


def devices(settings):
    return dataclasses.replace(settings, nvr_host=NVR_HOST, nvr_user="wizard", nvr_password="fake-password", go2rtc_url=f"http://{GO2RTC_HOST}:1984",
                               ha_url=f"http://{HA_HOST}:8123", ha_token="fake-token")


# ---------------------------------------------------------------- the catalogue and the Msg type


def test_every_key_has_hebrew_and_handwritten_english_with_the_same_slots():
    assert LANGS == user_prefs.UI_LANGS
    namespaces = {k.split(".", 1)[0] for k in CATALOGUE}
    assert {"wizard", "readiness", "error", "capability"} <= namespaces
    for key, entry in CATALOGUE.items():
        assert set(entry) == {"he", "en"} and entry["he"] and entry["en"], key
        assert not HEB.search(entry["en"]), f"{key}: English without Hebrew letters"
        assert set(SLOT.findall(entry["en"])) == set(SLOT.findall(entry["he"])), f"{key}: the same slots in both languages"


def test_a_msg_is_its_hebrew_string_and_keeps_its_key_through_copies():
    m = t("wizard.rate_limited", wait=4)
    assert m == "השלב נבדק לפני רגע; אפשר לבדוק שוב בעוד 4 שניות." and isinstance(m, str)
    assert json.dumps(m, ensure_ascii=False) == '"השלב נבדק לפני רגע; אפשר לבדוק שוב בעוד 4 שניות."'
    assert m.render("en") == "The step was checked a moment ago; you can check again in 4 seconds."
    assert m.render("ar") == m, "a language without a text answers the Hebrew"
    for clone in (copy.deepcopy(m), pickle.loads(pickle.dumps(m))):
        assert isinstance(clone, Msg) and clone.key == m.key and clone.render("en") == m.render("en")
    nested = t("wizard.nvr.unavailable_action", link=t("wizard.link.connections"))
    assert nested.render("en").endswith("to fix the address: Settings › Connections."), "a param that is a Msg follows the sentence"
    assert t("wizard.floor.draft", name="{n} קומה").render("en") == 'The floor "{n} קומה" has a draft plan that is not published yet.', "one pass"
    cached = {"a": [m, {"b": m}], "n": 3}
    out = localize(cached, "en")
    assert out == {"a": [m.render("en"), {"b": m.render("en")}], "n": 3}
    assert cached["a"][0] is m, "localize copies; the cached answer is never changed in place"
    he = localize(cached, "he")
    assert type(he["a"][0]) is str and he["a"][0] == m


def test_the_hebrew_tables_other_modules_read_are_unchanged():
    # tests/test_nvr_connection.py and the health report read these as plain strings
    assert wizard.NVR_ERRORS["source_unavailable"] == ("ה־NVR לא ענה.", "ודאו שה־NVR דולק ומחובר לרשת, ושהכתובת ופורט ה־HTTP נכונים; לתיקון הכתובת: הגדרות › חיבורים.")
    assert wizard.NVR_ERRORS["source_forbidden"][1] == "בדקו את המשתמש והסיסמה (מומלץ משתמש ייעודי עם הרשאות צפייה והקלטות בלבד) ועדכנו אותם בהגדרות › חיבורים."
    assert wizard.TITLES == {"install": "התקנת ה־Add-on", "nvr": "חיבור ל־NVR", "ha": "Home Assistant והגשר", "go2rtc": "go2rtc (וידאו חי)",
                             "floor": "קומה ותוכנית", "camera": "מצלמה על המפה"}
    assert readiness.LEVEL_TEXT == {"building": "בהקמה", "almost": "כמעט מוכן למסירה", "ready": "מוכן למסירה"}
    from smplwise import capabilities

    assert capabilities.UNSUPPORTED_MESSAGES[capabilities.NVR_WITHOUT_GO2RTC] + " x" == "התקנה עם NVR אינה נתמכת בלי שרת המדיה (go2rtc): בלעדיו אין וידאו חי ואין ניגון הקלטות. x"


# ---------------------------------------------------------------- the setup wizard


def test_wizard_hebrew_is_unchanged_and_english_follows_the_user(settings):
    c = TestClient(create_app(settings))
    he = c.get(f"{API}/setup/state").json()
    st = {s["id"]: s for s in he["steps"]}
    assert st["nvr"]["title"] == "חיבור ל־NVR" and st["nvr"]["problem"]["message"] == "פרטי ה־NVR לא הוגדרו."
    assert st["nvr"]["problem"]["action"] == "בחרו את סוג ה־NVR והזינו כתובת, משתמש וסיסמה בהגדרות › חיבורים."
    assert st["floor"]["problem"]["message"] == "עדיין אין אתר ומבנה במערכת."
    assert st["install"]["facts"][1] == {"label": "מסד נתונים", "value": "תקין", "tone": "ok"}
    assert st["camera"]["problem"]["action"] == "השלימו את שלב ה־NVR; המצלמות מתגלות ממנו לבד תוך דקה."

    english(c)
    en = c.get(f"{API}/setup/state").json()
    st = {s["id"]: s for s in en["steps"]}
    assert [s["title"] for s in en["steps"]] == ["Add-on installation", "NVR connection", "Home Assistant and the bridge", "go2rtc (live video)",
                                                 "Floor and plan", "Camera on the map"]
    assert st["nvr"]["problem"]["message"] == "The NVR details are not set."
    assert st["nvr"]["problem"]["action"] == "Choose the NVR type and enter an address, a user and a password in Settings › Connections."
    assert st["nvr"]["problem"]["link"]["label"] == "Settings › Connections"
    assert st["install"]["facts"][1] == {"label": "Database", "value": "OK", "tone": "ok"}
    assert [x for x in texts_of(en["steps"]) if HEB.search(x)] == [], "every wizard text is English for an English user"
    # the machine fields do not move with the language
    def machine(body: dict) -> list[dict]:
        return [{"id": s["id"], "status": s["status"], "href": s["settings_link"]["href"], "code": (s["problem"] or {}).get("code"),
                 "evidence": {k: v for k, v in s["evidence"].items() if k not in ("free_bytes", "total_bytes")}} for s in body["steps"]]

    assert machine(en) == machine(he)


def test_a_check_cached_for_a_hebrew_admin_reads_in_english_for_an_english_one(settings, fake):
    c = TestClient(create_app(devices(settings)))
    bind(c, settings, "dana", "system_admin", "installation", "*")
    english(c, "dana")
    he = c.post(f"{API}/setup/check/nvr").json()
    nvr = next(s for s in he["steps"] if s["id"] == "nvr")
    assert nvr["status"] == "done" and HEB.search(nvr["summary"]) and "קושחה" in nvr["summary"]
    en = c.get(f"{API}/setup/state", headers=as_user("dana")).json()  # the same cached probe result
    nvr_en = next(s for s in en["steps"] if s["id"] == "nvr")
    assert nvr_en["source"] == "live" and nvr_en["checked_at"] == nvr["checked_at"], "the one cached check"
    assert "firmware" in nvr_en["summary"] and not HEB.search(nvr_en["summary"])
    assert {f["label"] for f in nvr_en["facts"]} >= {"Model · firmware", "Channels", "Channels with a main and a sub stream", "NVR clock vs the system"}
    assert [x for x in texts_of(en["steps"]) if HEB.search(x)] == []
    # and the Hebrew admin still reads it in Hebrew
    again = c.get(f"{API}/setup/state").json()
    assert next(s for s in again["steps"] if s["id"] == "nvr")["summary"] == nvr["summary"]


def test_wizard_errors_follow_the_language(settings, fake, monkeypatch):
    c = TestClient(create_app(devices(settings)))
    r = c.post(f"{API}/setup/check/firmware")
    assert r.status_code == 404 and r.json()["user_message"] == "שלב האשף לא נמצא."
    english(c)
    r = c.post(f"{API}/setup/check/firmware")
    assert r.status_code == 404 and r.json() | {"correlation_id": ""} == {"code": "not_found", "user_message": "The wizard step was not found.",
                                                                          "retryable": False, "correlation_id": "", "details": {}}
    monkeypatch.setattr(wizard, "CHECK_EVERY_S", 5.0)
    assert c.post(f"{API}/setup/check/nvr").status_code == 200
    r = c.post(f"{API}/setup/check/nvr")
    assert r.status_code == 429 and r.json()["code"] == "check_rate_limited"
    assert re.fullmatch(r"The step was checked a moment ago; you can check again in \d+ seconds\.", r.json()["user_message"]), r.json()


# ---------------------------------------------------------------- the readiness report


def test_readiness_hebrew_is_unchanged_and_english_follows_the_user(client: TestClient, settings):
    c = client
    c.get(f"{API}/me")
    he = c.get(f"{API}/readiness").json()
    checks = {x["id"]: x for x in he["checks"]}
    assert he["level_text"] == "בהקמה"
    assert checks["cameras_connected"]["title"] == "מצלמות מחוברות" and checks["cameras_connected"]["summary"] == "לא נמצאו מצלמות פעילות."
    assert checks["handover"]["summary"] == "המסירה ללקוח עדיין לא נרשמה."
    assert checks["backup"]["facts"][1] == {"label": "גיבוי עם סיסמת גיבוי", "value": "לא", "ok": False}

    english(c)
    en = c.get(f"{API}/readiness").json()
    checks = {x["id"]: x for x in en["checks"]}
    assert en["level_text"] == "Being set up"
    assert checks["cameras_connected"]["title"] == "Connected cameras" and checks["cameras_connected"]["summary"] == "No active cameras were found."
    assert checks["handover"]["summary"] == "The handover to the customer is not recorded yet."
    assert checks["backup"]["facts"][1] == {"label": "Backup with a backup password", "value": "No", "ok": False}
    assert en["next_steps"] and not any(HEB.search(s["title"] + s["label"]) for s in en["next_steps"])
    # every readiness text except the health report's own labels (another module, docs/changes/I18N-BACKEND-2490.md section 2)
    leftovers = [x for x in texts_of([{k: v for k, v in ch.items() if k != "facts" or ch["id"] != "integrations"} for ch in en["checks"]]) if HEB.search(x)]
    assert leftovers == []
    assert [(x["id"], x["status"], x["fraction"], x["weight"]) for x in en["checks"]] == [(x["id"], x["status"], x["fraction"], x["weight"]) for x in he["checks"]]
    assert en["score"] == he["score"] and en["level"] == he["level"]


def test_readiness_history_and_background_readers_stay_hebrew(client: TestClient, settings):
    c = client
    c.get(f"{API}/me")
    english(c)
    assert c.post(f"{API}/readiness/check").status_code == 200
    with Database(settings.db_path).connection() as conn:
        report = readiness.evaluate(conn, settings)  # a background reader (the fleet report): no user
        rows = conn.execute("SELECT checks_json, blockers_json FROM readiness_history").fetchall()
    assert report["level_text"] == "בהקמה" and report["checks"][0]["title"] == "מצלמות מחוברות"
    assert rows and not any(hebrew(r[0]) or "Connected" in r[0] for r in rows), "the history row holds statuses, never words"
    r = c.post(f"{API}/readiness/check")
    assert r.status_code == 429 and r.json()["user_message"] == "The check just ran. Try again in a moment."
    r = c.put(f"{API}/readiness/settings", json={"changes": {"readiness.advice_score": "abc"}, "confirmed": True})
    assert r.status_code == 422 and r.json()["user_message"] == "Invalid value for the setting."


# ---------------------------------------------------------------- the error envelope


def test_the_permission_refusal_follows_the_language(client: TestClient, settings):
    c = client
    c.get(f"{API}/me")
    bind(c, settings, "ron", "viewer", "installation", "*")
    r = c.get(f"{API}/readiness", headers=as_user("ron"))
    assert r.status_code == 403 and r.json()["user_message"] == "אין הרשאה לפעולה זו בהיקף המבוקש."
    english(c, "ron")
    r = c.get(f"{API}/readiness", headers=as_user("ron"))
    assert r.status_code == 403 and r.json()["code"] == "forbidden"
    assert r.json()["user_message"] == "You do not have permission for this action in the requested scope."
    assert r.json()["details"]["permission"] == "system.configure", "details are not translated"


def test_a_refused_body_names_its_fields_in_the_users_language(client: TestClient):
    c = client
    c.get(f"{API}/me")
    r = c.put(f"{API}/readiness/attest/handover", json={"done": "maybe"})
    assert r.status_code == 422 and r.json()["user_message"] == "ערך לא תקין — done: חייב להיות כן/לא"
    english(c)
    r = c.put(f"{API}/readiness/attest/handover", json={"done": "maybe"})
    assert r.status_code == 422 and r.json()["user_message"] == "Invalid value — done: Must be yes or no"
    assert r.json()["details"]["errors"][0]["type"] == "bool_parsing"


def test_validation_payload_tables_and_the_default_language():
    raw = [{"loc": ("body", "name"), "type": "string_too_long", "msg": "x", "ctx": {"max_length": 5}}, {"loc": ("body", "n"), "type": "odd", "msg": ""}]
    he = errors.validation_payload(raw, "cid")
    assert he["user_message"] == "ערך לא תקין — name: ארוך מדי (עד 5 תווים) · n: ערך לא תקין"
    assert errors.validation_payload(raw, "cid", lang="en")["user_message"] == "Invalid value — name: Too long (up to 5 characters) · n: Invalid value"
    assert set(errors._CONSTRAINT_EN) == set(errors._CONSTRAINT_HE)


def test_api_error_words_by_language():
    plain = ApiError(409, "x", "הודעה")
    assert not plain.translatable() and plain.payload("c")["user_message"] == "הודעה" and plain.payload("c", lang="en")["user_message"] == "הודעה"
    with_en = ApiError(422, "validation", "יש לתת שם.", details={"message_en": "A name is required."})
    assert with_en.translatable() and with_en.payload("c")["user_message"] == "יש לתת שם."
    assert with_en.payload("c", lang="en")["user_message"] == "A name is required."
    msg = errors.not_found()
    assert msg.payload("c")["user_message"] == "המשאב לא נמצא." and type(msg.payload("c")["user_message"]) is str
    assert msg.payload("c", lang="en")["user_message"] == "The resource was not found."
    assert errors.forbidden(permission="p").payload("c", lang="en")["details"] == {"permission": "p"}


def test_an_error_before_sign_in_is_hebrew(settings):
    c = TestClient(create_app(dataclasses.replace(settings, dev_user=None)), raise_server_exceptions=False)
    r = c.get(f"{API}/setup/state")
    assert r.status_code in (401, 403) and HEB.search(r.json()["user_message"]), r.json()


def test_the_unexpected_error_follows_the_language(client: TestClient, monkeypatch):
    c = TestClient(client.app, raise_server_exceptions=False)
    c.get(f"{API}/me")
    english(c)

    def boom(*a, **k):
        raise RuntimeError("synthetic")

    monkeypatch.setattr(readiness, "evaluate", boom)
    r = c.get(f"{API}/readiness")
    assert r.status_code == 500 and r.json()["code"] == "internal_error"
    assert r.json()["user_message"] == "An unexpected error occurred. Try again; if it happens again, contact support with the request ID."
