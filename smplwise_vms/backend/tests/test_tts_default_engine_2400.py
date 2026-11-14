"""TTS-DEFAULT-ENGINE-2400 (owner 04.11, answer 1א): the installation's fixed announcement engine and language.

- The setting `access.tts_engine` / `access.tts_language` ("" = the system default / automatic, the behaviour before it): plain ids only,
  WisKey's own bounds, `system.configure` only, audited as every product setting, readable by every user (the dialogs preselect it).
- The engine list (`GET intercom/tts/engines`) is readable by the system administrator who sets it, as well as by `access.call`.
- An announcement still speaks exactly the engine the request names: the server never substitutes the fixed engine, and the audit row
  says how the engine relates to the fixed one (`fixed` / `override` / `no_fixed`), never the text.
All against fakes (FakeHa as WisKey); no WisKey, Home Assistant or station contact."""
from __future__ import annotations

import copy
import json
from typing import Any

from conftest import as_user, bind
from fastapi.testclient import TestClient
from test_intercom import TTS_ENGINES, actions_feed, audit_rows, env, feed, ok, sent  # noqa: F401 - `feed` is a fixture

from smplwise.db import Database
from smplwise.main import create_app
from smplwise.routers import settings as settings_router

ENGINE = "access.tts_engine"
LANGUAGE = "access.tts_language"


def answer(msg: dict[str, Any]) -> list[Any] | None:
    if msg["type"] == "hikvision_intercom/tts/engines":
        return [ok(msg, copy.deepcopy(TTS_ENGINES))]
    if msg["type"] == "hikvision_intercom/tts/start":
        return [ok(msg), {"id": msg["id"], "type": "event", "event": {"state": "completed", "physical_result": "unverified"}}]
    return None


def test_the_setting_defaults_to_the_system_default_and_is_read_by_everyone(settings):
    assert settings_router.DEFAULTS[ENGINE] == "" and settings_router.DEFAULTS[LANGUAGE] == ""
    with TestClient(create_app(settings)) as c:
        bind(c, settings, "vera", "viewer", "installation", "*")
        for who in ({}, as_user("vera")):
            got = c.get("/api/v1/settings", headers=who).json()["settings"]
            assert got[ENGINE] == "" and got[LANGUAGE] == "", "every announcing user reads the fixed choice through GET /settings"


def test_the_setting_is_validated_as_plain_ids_within_wiskeys_bounds(settings):
    with TestClient(create_app(settings)) as c:
        bad_engines = (" tts.piper", "tts piper", "tts.piper\n", "<b>x</b>", "x" * 129, "-tts", "tts.piper;rm", "טטס", 5)
        for bad in bad_engines:
            r = c.patch("/api/v1/settings", json={ENGINE: bad})
            assert r.status_code == 422, (bad, r.text)
        for bad in ("he ", "1he", "en--US", "x" * 65, "he\n", "e n", "he;", 1):
            r = c.patch("/api/v1/settings", json={LANGUAGE: bad})
            assert r.status_code == 422, (bad, r.text)
        assert c.get("/api/v1/settings").json()["settings"][ENGINE] == "", "nothing of a refused PATCH is stored"
        for engine, language in (("tts.piper", "he"), ("google_translate", "en-US"), ("tts.google_translate_en_com", "zh_Hans"), ("e" * 128, "x" * 8)):
            got = c.patch("/api/v1/settings", json={ENGINE: engine, LANGUAGE: language}).json()["settings"]
            assert (got[ENGINE], got[LANGUAGE]) == (engine, language)
        got = c.patch("/api/v1/settings", json={ENGINE: "", LANGUAGE: ""}).json()["settings"]
        assert (got[ENGINE], got[LANGUAGE]) == ("", ""), "the empty value returns to the system default / automatic language"


def test_only_the_system_administrator_changes_it_and_every_change_is_audited(settings):
    with TestClient(create_app(settings)) as c:
        bind(c, settings, "sam", "site_admin", "installation", "*")
        bind(c, settings, "oli", "operator", "installation", "*")
        bind(c, settings, "ada", "system_admin", "installation", "*")
        for user in ("sam", "oli"):
            assert c.patch("/api/v1/settings", json={ENGINE: "tts.piper"}, headers=as_user(user)).status_code == 403, user
        assert c.get("/api/v1/settings").json()["settings"][ENGINE] == ""
        r = c.patch("/api/v1/settings", json={ENGINE: "tts.piper", LANGUAGE: "he"}, headers=as_user("ada"))
        assert r.status_code == 200, r.text
        with Database(settings.db_path).connection() as conn:
            rows = conn.execute("SELECT actor_username, decision, details_json FROM audit_log WHERE action = 'settings.update' ORDER BY rowid").fetchall()
        allowed = [(r["actor_username"], json.loads(r["details_json"] or "{}")) for r in rows if r["decision"] == "allowed"]
        assert ("ada", {ENGINE: "tts.piper", LANGUAGE: "he"}) in allowed
        with Database(settings.db_path).connection() as conn:
            denied = conn.execute("SELECT actor_username FROM audit_log WHERE action = 'system.configure' AND decision = 'denied'").fetchall()
        assert {r["actor_username"] for r in denied} >= {"sam", "oli"}, "the refused attempts are on the record"


def test_the_engine_list_is_readable_by_the_administrator_who_sets_it(feed):
    app, fakes, c = actions_feed(feed, answer)
    s = feed[1]
    # a system administrator whose call right is taken away (a deny of a role that carries it) still reads the list to choose from
    from smplwise.rbac import Principal
    from smplwise.services import intercom_authority as ia

    caller = c.post("/api/v1/access/roles", json={"name": "הכרזות", "description": "calls", "permissions": ["access.read"], "sensitive": ["access.call"]}).json()["id"]
    bind(c, s, "ada", "system_admin", "installation", "*")
    with Database(s.db_path).connection() as conn:
        conn.execute("INSERT INTO bindings(id, subject_kind, subject_id, role_id, scope_type, scope_id, effect, permission_revision, assigned_by, created_at) "
                     "VALUES ('tts-deny', 'user', 'dev-ada', ?, 'installation', '*', 'deny', 1, 'test', '2026-11-04T00:00:00Z')", (caller,))
    with Database(s.db_path).connection(mode="read") as conn:
        ada = Principal(user_id="dev-ada", username="ada", display_name="ada", source="dev")
        assert not ia.Authority(conn, ada).anywhere(ia.CALL), "the deny really takes the call right away"
    r = c.get("/api/v1/intercom/tts/engines", headers=as_user("ada"))
    assert r.status_code == 200 and r.json()["tts"]["default"] == "tts.piper", r.text
    r = c.post("/api/v1/intercom/stations/entry-a/tts", json=env(engine_id="tts.piper", language="he", message="hi"), headers=as_user("ada"))
    assert r.status_code == 403, "reading the list never lets the administrator speak without the call right"
    bind(c, s, "cal", caller, "installation", "*")
    assert c.get("/api/v1/intercom/tts/engines", headers=as_user("cal")).status_code == 200, "access.call still reads it"
    assert c.get("/api/v1/intercom/tts/engines", headers=as_user("vera")).status_code == 403, "a viewer neither calls nor configures"
    assert sent(fakes, "tts/start") == []


def test_the_server_never_substitutes_the_fixed_engine_and_audits_the_choice(feed):
    app, fakes, c = actions_feed(feed, answer)
    s = feed[1]

    def speak(engine: str, language: str | None = "he") -> None:
        r = c.post("/api/v1/intercom/stations/entry-a/tts", json=env(engine_id=engine, language=language, message="נא להמתין"), headers=as_user("sam"))
        assert r.status_code == 200, r.text

    speak("tts.piper")  # no fixed engine yet
    assert c.patch("/api/v1/settings", json={ENGINE: "tts.piper", LANGUAGE: "he"}).status_code == 200
    speak("tts.piper")
    speak("tts.google_translate_en_com", "iw")  # the sender picked another engine for this one announcement
    assert c.patch("/api/v1/settings", json={ENGINE: "tts.gone"}).status_code == 200  # a fixed engine WisKey no longer lists
    speak("tts.piper")
    starts = sent(fakes, "tts/start")
    assert [(m["engine_id"], m["language"]) for m in starts] == [("tts.piper", "he"), ("tts.piper", "he"), ("tts.google_translate_en_com", "iw"), ("tts.piper", "he")], \
        "WisKey receives exactly the engine and language of the request"
    attempts = audit_rows(s, "intercom.tts", "attempt")
    assert [r["details"]["engine_choice"] for r in attempts] == ["no_fixed", "fixed", "override", "override"]
    assert all("message" not in r["details"] for r in attempts)
    assert c.get("/api/v1/settings").json()["settings"][ENGINE] == "tts.gone", "an announcement never changes the setting"


def test_a_missing_engine_is_still_refused_before_anything_is_sent(feed):
    """The request must name its engine: an empty engine is never filled in from the setting on the server."""
    app, fakes, c = actions_feed(feed, answer)
    assert c.patch("/api/v1/settings", json={ENGINE: "tts.piper"}).status_code == 200
    for body in (env(engine_id="", message="hi"), env(message="hi")):
        r = c.post("/api/v1/intercom/stations/entry-a/tts", json=body, headers=as_user("sam"))
        assert r.status_code == 422, r.text
    assert sent(fakes, "tts/start") == []
