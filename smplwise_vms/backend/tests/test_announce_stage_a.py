"""ANNOUNCE-295 (stage A, speakers only): the dedicated `announcer` role and its permission, the ready-made templates (routine / emergency; he / en / ru),
several languages in one announcement, the whole-building scope, the quiet-hours options (suppress | lower | queue | allow; critical and emergency exempt),
the one-click emergency announcement and its audit row (who, when, text, languages, targets - never audio), the engine selector (local by default, the
cloud engine OFF by default, behind a fake) and the cloud key's handling (secrets store only, never visible anywhere).
Every speak call, synthesis, delivery and player call goes to a fake: no real speaker, engine, cloud service or Home Assistant is contacted, and no test
waits for real time."""
from __future__ import annotations

import datetime as dt
import json

import media_seed_audio as aseed
import pytest
from conftest import as_user, bind
from fastapi.testclient import TestClient

from smplwise.main import create_app
from smplwise.rbac import ROLES
from smplwise.routers.access import DEFAULT_DELEGABLE
from smplwise.services import announce_engine as eng
from smplwise.services import announce_templates as tpl
from smplwise.services import announcements as ann
from smplwise.services import notify

pytestmark = pytest.mark.usefixtures("daytime_clock")
API = "/api/v1/announcements"
DAY = dt.datetime(2026, 10, 1, 9, 0, tzinfo=dt.timezone.utc)  # 12:00 local
NIGHT = dt.datetime(2026, 10, 1, 20, 0, tzinfo=dt.timezone.utc)  # 23:00 local, inside the default 22:00-07:00 window
MORNING = dt.datetime(2026, 10, 2, 4, 30, tzinfo=dt.timezone.utc)  # 07:30 local the next day, the window has ended


class Speaker:
    def __init__(self) -> None:
        self.calls: list[tuple[str, list[str], str, str]] = []
        self.error: Exception | None = None

    def __call__(self, _settings, engine, entity_ids, message, language) -> None:
        self.calls.append((engine, list(entity_ids), message, language))
        if self.error:
            raise self.error


@pytest.fixture()
def world(settings, monkeypatch):
    fake = Speaker()
    monkeypatch.setattr(ann, "SPEAK", fake)
    monkeypatch.setattr(ann, "PLAYER_STATE", lambda _s, _e: None)  # an unreadable player: never waited for
    monkeypatch.setattr(ann, "PLAYER_CALL", lambda *_a, **_k: (_ for _ in ()).throw(AssertionError("no player action is expected")))
    monkeypatch.setattr(ann, "SLEEP", lambda _s: None)
    clock = {"now": DAY}
    monkeypatch.setattr(notify, "now_utc", lambda: clock["now"])
    monkeypatch.setenv("SW_ANNOUNCE_CLOUD_KEY", "x")
    monkeypatch.delenv("SW_ANNOUNCE_CLOUD_KEY")  # the secrets store mirrors the key into this variable when it is saved; the undo removes it again
    app = create_app(settings)
    c = TestClient(app)
    aseed.install(c, "ma")
    aseed.approve_players(c)
    keys = {n: aseed.key_with(c, e) for n, e in {"a": "media_player.wiim_a", "b": "media_player.wiim_b"}.items()}

    class W:
        pass

    w = W()
    w.app, w.c, w.speaker, w.keys, w.settings, w.clock = app, c, fake, keys, settings, clock
    w.db = app.state.db
    return w


def enable(w, devices=("a", "b"), **extra):
    r = w.c.put(f"{API}/config", json={"enabled": True, "engine": "tts.fake_engine", "devices": sorted(w.keys[d] for d in devices), **extra})
    assert r.status_code == 200, r.text
    return r.json()


def advance(w, minutes=2):
    w.clock["now"] += dt.timedelta(minutes=minutes)


def rows(w, sql="SELECT * FROM announcements ORDER BY rowid"):
    with w.db.connection(mode="read") as conn:
        return [dict(r) for r in conn.execute(sql).fetchall()]


def audits(w, action="media.announce"):
    with w.db.connection(mode="read") as conn:
        out = []
        for r in conn.execute("SELECT * FROM audit_log WHERE action = ? ORDER BY id", (action,)).fetchall():
            d = dict(r)
            d["details"] = json.loads(d.pop("details_json") or "{}")
            out.append(d)
        return out


def whole_building(w, text="שלום", **extra):
    advance(w)
    return w.c.post(API, json={"scope": "all", "ref": "*", "text": text, **extra})


# ---------------------------------------------------------------------------------------------------- the role and its permission

def test_announcer_is_a_built_in_role_holding_only_the_announce_permission(world):
    assert ROLES["announcer"] == ["devices.read", "media.announce"]
    assert "announcer" in DEFAULT_DELEGABLE, "owner 2026-10-25: easy to hand out"
    assert "devices.read" in ROLES["announcer"], "the base read permission that lets the announcer reach the home area's tabs"
    holders = sorted(r for r, p in ROLES.items() if "media.announce" in p)
    assert holders == ["announcer", "site_admin", "system_admin"]
    roles = {r["id"]: r for r in world.c.get("/api/v1/access/roles").json()["roles"]}
    assert roles["announcer"]["name"] and not roles["announcer"]["custom"]


def test_an_announcer_announces_and_uses_the_emergency_button_but_configures_nothing(world):
    w = world
    enable(w)
    bind(w.c, w.settings, "anna", "announcer", "installation", "*")
    bind(w.c, w.settings, "vera", "viewer", "installation", "*")
    h = as_user("anna")
    assert w.c.get(f"{API}/areas", headers=h).status_code == 200
    assert w.c.get(f"{API}/templates", headers=h).status_code == 200
    advance(w)
    assert w.c.post(API, json={"scope": "all", "ref": "*", "text": "שלום"}, headers=h).status_code == 200
    assert w.c.post(f"{API}/emergency", json={"template_id": "evacuate"}, headers=h).status_code == 200
    for method, path, body in (("get", "config", None), ("put", "config", {"enabled": False}), ("get", "history", None), ("put", "templates", {"templates": []}),
                               ("post", "test", {"scope": "all", "ref": "*"})):
        r = getattr(w.c, method)(f"{API}/{path}", headers=h, **({"json": body} if body is not None else {}))
        assert r.status_code == 403, (path, r.status_code)
    v = as_user("vera")  # a viewer holds nothing of this
    for r in (w.c.get(f"{API}/areas", headers=v), w.c.get(f"{API}/templates", headers=v), w.c.post(f"{API}/emergency", json={"template_id": "evacuate"}, headers=v),
              w.c.post(API, json={"scope": "all", "ref": "*", "text": "x"}, headers=v)):
        assert r.status_code == 403


def test_the_permission_is_editable_per_role_through_a_custom_role(world):
    w = world
    enable(w)
    made = w.c.post("/api/v1/access/roles", json={"name": "דובר בניין", "permissions": ["map.read"], "sensitive": ["media.announce"]})
    assert made.status_code in (200, 201), made.text
    bind(w.c, w.settings, "dov", made.json()["id"], "installation", "*")
    advance(w)
    assert w.c.post(API, json={"scope": "all", "ref": "*", "text": "שלום"}, headers=as_user("dov")).status_code == 200
    # the same person without the grant: a role without it announces nothing
    bind(w.c, w.settings, "eli", "viewer", "installation", "*")
    assert w.c.post(API, json={"scope": "all", "ref": "*", "text": "שלום"}, headers=as_user("eli")).status_code == 403


# ---------------------------------------------------------------------------------------------------- templates

def test_default_templates_are_served_in_three_languages_and_both_kinds(world):
    w = world
    got = w.c.get(f"{API}/templates").json()
    assert got["languages"] == ["he", "en", "ru", "ar"]
    kinds = {t["kind"] for t in got["templates"]}
    assert kinds == {"routine", "emergency"}
    for t in got["templates"]:
        assert set(t["name"]) == {"he", "en", "ru", "ar"} and set(t["text"]) == {"he", "en", "ru", "ar"}, t["id"]
    assert [t["id"] for t in got["templates"] if t["kind"] == "emergency"] == ["evacuate", "shelter"]
    assert w.c.get(f"{API}/config").json()["templates"] == got["templates"]


def test_templates_are_edited_as_a_whole_validated_and_audited(world):
    w = world
    mine = [{"id": "visit", "kind": "routine", "name": {"he": "ביקור", "en": "Visit"}, "text": {"he": "<b>אורחים</b> מגיעים", "en": "Guests are coming"}},
            {"id": "alarm", "kind": "emergency", "name": {"he": "אזעקה"}, "text": {"he": "אזעקה בבניין", "ru": "Тревога в здании"}}]
    out = w.c.put(f"{API}/templates", json={"templates": mine})
    assert out.status_code == 200, out.text
    saved = out.json()["templates"]
    assert saved[0]["text"]["he"] == "אורחים מגיעים", "markup is removed like in a typed text"
    assert w.c.get(f"{API}/templates").json()["templates"] == saved
    a = [x for x in audits(w, "media.announce.config") if x["details"].get("changed") == ["templates"]]
    assert len(a) == 1 and a[0]["details"]["added"] == ["alarm", "visit"] and "evacuate" in a[0]["details"]["removed"]
    assert a[0]["actor_username"], "who changed it"
    assert json.dumps(a[0]["details"], ensure_ascii=False).find("אזעקה בבניין") == -1, "the audit names the templates, it does not copy their texts"
    bad = [
        [{"id": "Bad Id", "kind": "routine", "name": {"he": "א"}, "text": {"he": "ב"}}],
        [{"id": "x", "kind": "routine", "name": {"he": "א"}, "text": {"he": "ב"}}, {"id": "x", "kind": "routine", "name": {"he": "א"}, "text": {"he": "ב"}}],
        [{"id": "x", "kind": "routine", "name": {"en": "A"}, "text": {"en": "B"}}],
        [{"id": "x", "kind": "loud", "name": {"he": "א"}, "text": {"he": "ב"}}],
        [{"id": "x", "kind": "routine", "name": {"he": "א"}, "text": {"he": "ב" * 201}}],
        [{"id": "x", "kind": "routine", "name": {"he": "א"}, "text": {"he": "ב", "fr": "c"}}],
        [{"id": "x", "kind": "routine", "name": {"he": "א"}, "text": {"he": "ב\u0007"}}],
        [{"id": f"t{i}", "kind": "routine", "name": {"he": "א"}, "text": {"he": "ב"}} for i in range(31)],
    ]
    for body in bad:
        assert w.c.put(f"{API}/templates", json={"templates": body}).status_code == 422, body[0] if body else body
    assert w.c.get(f"{API}/templates").json()["templates"] == saved, "a refused list changes nothing"
    # an unchanged save writes no second audit row
    w.c.put(f"{API}/templates", json={"templates": saved})
    assert len([x for x in audits(w, "media.announce.config") if x["details"].get("changed") == ["templates"]]) == 1


# ---------------------------------------------------------------------------------------------------- languages and scopes

def test_several_languages_are_spoken_one_after_the_other_and_recorded(world):
    w = world
    enable(w)
    advance(w)
    r = w.c.post(API, json={"scope": "all", "ref": "*", "template_id": "water_off",
                            "texts": [{"language": "en", "text": "Water off"}, {"language": "he", "text": "מים"}, {"language": "ru", "text": "Вода"}]})
    assert r.status_code == 200 and r.json()["targets"] == 2, r.text
    assert [(c[2], c[3]) for c in w.speaker.calls] == [("Water off", "en"), ("מים", "he"), ("Вода", "ru")], "in the order given"
    assert all(len(c[1]) == 2 and c[0] == "tts.fake_engine" for c in w.speaker.calls), "both speakers of the building, the local engine"
    row = rows(w)[-1]
    assert row["scope"] == "all" and row["scope_ref"] == "*" and json.loads(row["languages_json"]) == ["en", "he", "ru"] and row["template_id"] == "water_off" and row["status"] == "sent"
    d = audits(w)[-1]["details"]
    assert d["languages"] == ["en", "he", "ru"] and d["template_id"] == "water_off" and d["scope"] == "all"


def test_one_language_a_room_and_the_refusals(world):
    w = world
    enable(w)
    advance(w)
    assert w.c.post(API, json={"scope": "device", "ref": w.keys["a"], "text": "Привет", "language": "ru"}).status_code == 200
    assert w.speaker.calls[-1][2:] == ("Привет", "ru")
    advance(w)
    assert w.c.post(API, json={"scope": "all", "ref": "*", "text": "שלום"}).status_code == 200
    assert w.speaker.calls[-1][3] == "he", "the configured language when none is given"
    for body in ({"scope": "all", "ref": "*"},  # neither text nor texts
                 {"scope": "all", "ref": "*", "text": "x", "texts": [{"language": "he", "text": "x"}]},
                 {"scope": "all", "ref": "*", "text": "x", "language": "fr"},
                 {"scope": "all", "ref": "*", "texts": [{"language": "fr", "text": "x"}]},
                 {"scope": "all", "ref": "room", "text": "x"},
                 {"scope": "area", "ref": "*", "text": "x"}):
        advance(w)
        assert w.c.post(API, json=body).status_code in (404, 422), body
    advance(w)
    r = w.c.post(API, json={"scope": "all", "ref": "*", "texts": [{"language": "he", "text": "א"}, {"language": "he", "text": "ב"}]})
    assert r.status_code == 422 and r.json()["code"] == "language_invalid", "a language once"


# ---------------------------------------------------------------------------------------------------- quiet hours

def test_quiet_mode_is_a_setting_with_four_options_suppress_by_default(world):
    w = world
    assert w.c.get(f"{API}/config").json()["config"]["quiet"]["mode"] == "suppress"
    for mode in ("queue", "allow", "lower", "suppress"):
        out = w.c.put(f"{API}/config", json={"quiet": {"enabled": True, "from": "21:00", "to": "06:30", "mode": mode}}).json()
        assert out["config"]["quiet"]["mode"] == mode and out["config"]["quiet"]["from"] == "21:00" and out["config"]["quiet"]["to"] == "06:30"
    assert w.c.put(f"{API}/config", json={"quiet": {"mode": "loud"}}).status_code == 422
    changes = [a for a in audits(w, "media.announce.config") if "quiet" in a["details"]]
    assert changes and changes[-1]["details"]["quiet"]["mode"] == "suppress"


def test_quiet_hours_suppress_refuses_a_routine_announcement(world):
    w = world
    enable(w, quiet={"enabled": True, "mode": "suppress"})
    w.clock["now"] = NIGHT
    r = w.c.post(API, json={"scope": "all", "ref": "*", "text": "בלילה"})
    assert r.status_code == 409 and r.json()["code"] == "quiet_hours" and w.speaker.calls == []
    assert rows(w)[-1]["status"] == "refused" and rows(w)[-1]["error"] == "quiet_hours"


def test_quiet_hours_allow_speaks_as_usual_and_says_so_on_the_row(world):
    w = world
    enable(w, quiet={"enabled": True, "mode": "allow"})
    w.clock["now"] = NIGHT
    assert whole_building(w).status_code == 200 and len(w.speaker.calls) == 1
    assert "quiet_allowed" in json.loads(rows(w)[-1]["notes_json"])


def test_quiet_hours_queue_holds_until_the_window_ends_then_speaks_the_same_row(world):
    w = world
    enable(w, quiet={"enabled": True, "mode": "queue"})
    bind(w.c, w.settings, "anna", "announcer", "installation", "*")
    w.clock["now"] = NIGHT
    advance(w, 0)
    r = w.c.post(API, json={"scope": "all", "ref": "*", "texts": [{"language": "he", "text": "מאוחר"}, {"language": "en", "text": "Late"}], "template_id": "visitors"}, headers=as_user("anna"))
    assert r.status_code == 200 and r.json()["status"] == "queued" and w.speaker.calls == []
    queued = rows(w)[-1]
    assert queued["status"] == "queued" and queued["release_at"] == "2026-10-02T04:00:00Z" and queued["user_id"], "held until 07:00 local, with its author"
    assert audits(w)[-1]["details"]["status"] == "queued"
    # still inside the window: nothing is spoken
    w.clock["now"] = NIGHT + dt.timedelta(hours=3)
    assert ann.release_queued(w.db, w.settings) == 0 and w.speaker.calls == []
    # the window ended
    w.clock["now"] = MORNING
    assert ann.release_queued(w.db, w.settings) == 1
    assert [(c[2], c[3]) for c in w.speaker.calls] == [("מאוחר", "he"), ("Late", "en")]
    after = rows(w)
    assert len(after) == 1 and after[0]["id"] == queued["id"] and after[0]["status"] == "sent", "the held row itself became the spoken one"
    assert ann.release_queued(w.db, w.settings) == 0 and len(w.speaker.calls) == 2, "spoken once"


def test_a_queued_announcement_is_dropped_when_it_expired_or_its_author_lost_the_permission_or_the_mode_changed(world):
    w = world
    enable(w, quiet={"enabled": True, "mode": "queue"})
    bind(w.c, w.settings, "anna", "announcer", "installation", "*")
    w.clock["now"] = NIGHT

    def hold(text):
        r = w.c.post(API, json={"scope": "all", "ref": "*", "text": text}, headers=as_user("anna"))
        assert r.json()["status"] == "queued", r.text
        advance(w, 1)

    hold("one")
    w.clock["now"] = NIGHT + dt.timedelta(hours=26)
    assert ann.release_queued(w.db, w.settings) == 0
    assert [(r["status"], r["error"]) for r in rows(w)] == [("cancelled", "expired")]
    # the author is demoted before the release
    w.c.put(f"{API}/config", json={"quiet": {"mode": "queue"}})
    w.clock["now"] = NIGHT
    hold("two")
    with w.db.connection() as conn:
        from smplwise.db import bump_permission_revision

        conn.execute("UPDATE bindings SET revoked_at = '2026-10-01T10:00:00Z' WHERE subject_id = 'dev-anna'")
        bump_permission_revision(conn)
    w.clock["now"] = MORNING
    assert ann.release_queued(w.db, w.settings) == 0 and w.speaker.calls == []
    assert rows(w)[-1]["status"] == "cancelled" and rows(w)[-1]["error"] == "not_permitted"
    # the administrator extended the window to 09:00 while it waited: it stays held (mode queue), and is dropped once the mode is suppress
    bind(w.c, w.settings, "anna", "announcer", "installation", "*")
    w.clock["now"] = NIGHT + dt.timedelta(days=1)
    hold("three")
    w.c.put(f"{API}/config", json={"quiet": {"to": "09:00"}})
    w.clock["now"] = dt.datetime(2026, 10, 3, 4, 30, tzinfo=dt.timezone.utc)  # 07:30 local: due, but the window runs to 09:00
    assert ann.release_queued(w.db, w.settings) == 0 and rows(w)[-1]["status"] == "queued"
    w.c.put(f"{API}/config", json={"quiet": {"mode": "suppress"}})
    assert ann.release_queued(w.db, w.settings) == 0
    assert w.speaker.calls == [] and (rows(w)[-1]["status"], rows(w)[-1]["error"]) == ("cancelled", "quiet_hours")


def test_the_queue_is_bounded(world, monkeypatch):
    w = world
    monkeypatch.setattr(ann, "QUEUE_MAX", 2)
    enable(w, quiet={"enabled": True, "mode": "queue"})
    w.clock["now"] = NIGHT
    for i in range(2):
        assert w.c.post(API, json={"scope": "all", "ref": "*", "text": f"t{i}"}).json()["status"] == "queued"
        advance(w, 1)
    r = w.c.post(API, json={"scope": "all", "ref": "*", "text": "t3"})
    assert r.status_code == 409 and r.json()["code"] == "queue_full"


def test_the_janitor_releases_the_queue(world):
    from smplwise.main import janitor_tick

    w = world
    enable(w, quiet={"enabled": True, "mode": "queue"})
    w.clock["now"] = NIGHT
    assert w.c.post(API, json={"scope": "all", "ref": "*", "text": "בוקר"}).json()["status"] == "queued"
    w.clock["now"] = MORNING
    janitor_tick(w.db, w.settings)
    assert [c[2] for c in w.speaker.calls] == ["בוקר"] and rows(w)[-1]["status"] == "sent"


def test_a_critical_announcement_is_exempt_in_every_mode(world):
    w = world
    w.clock["now"] = NIGHT
    for mode in ("suppress", "lower", "queue", "allow"):
        enable(w, quiet={"enabled": True, "mode": mode})
        r = whole_building(w, "דחוף", critical=True)
        assert r.status_code == 200 and r.json()["status"] == "sent", mode
    assert len(w.speaker.calls) == 4


# ---------------------------------------------------------------------------------------------------- the emergency announcement

def test_one_click_emergency_speaks_every_language_to_every_speaker_and_audits_who_what_where_never_audio(world):
    w = world
    enable(w, quiet={"enabled": True, "mode": "suppress"}, max_per_minute=1)
    w.clock["now"] = NIGHT
    bind(w.c, w.settings, "anna", "announcer", "installation", "*")
    r = w.c.post(f"{API}/emergency", json={"template_id": "evacuate"}, headers=as_user("anna"))  # ONE request: there is no confirmation step to call
    assert r.status_code == 200 and r.json() == {"id": r.json()["id"], "status": "sent", "targets": 2}, r.text
    got = [(c[3], c[2]) for c in w.speaker.calls]
    assert [g[0] for g in got] == ["he", "en", "ru", "ar"] and all(len(c[1]) == 2 for c in w.speaker.calls)
    texts = {t["id"]: t["text"] for t in tpl.DEFAULTS}["evacuate"]
    assert [g[1] for g in got] == [texts["he"], texts["en"], texts["ru"], texts["ar"]]
    a = audits(w, "media.announce.emergency")
    assert len(a) == 1 and a[0]["decision"] == "allowed" and a[0]["actor_username"] == "anna" and a[0]["at"], "who and when"
    d = a[0]["details"]
    assert d["languages"] == ["he", "en", "ru", "ar"] and d["text"] == [texts["he"], texts["en"], texts["ru"], texts["ar"]] and d["scope"] == "all" and d["source"] == "emergency"
    assert d["template_id"] == "evacuate" and len(d["target_keys"]) == 2 and d["targets"] == 2 and d["critical"] is True
    blob = json.dumps(a[0]).lower()
    assert "audio" not in blob and "mp3" not in blob and "bytes" not in blob, "no audio is ever part of the audit"
    row = rows(w)[-1]
    assert row["source"] == "emergency" and row["scope"] == "all" and row["critical"] == 1 and row["status"] == "sent" and json.loads(row["languages_json"]) == ["he", "en", "ru", "ar"]


def test_the_emergency_is_not_blocked_by_quiet_hours_or_the_rate_limit_and_obeys_the_emergency_languages(world):
    w = world
    enable(w, quiet={"enabled": True, "mode": "suppress"}, max_per_minute=1)
    w.clock["now"] = NIGHT
    for _ in range(4):  # repeated in the same minute: never limited
        assert w.c.post(f"{API}/emergency", json={"template_id": "shelter"}).status_code == 200
    assert len(w.speaker.calls) == 16
    out = w.c.put(f"{API}/config", json={"emergency_languages": ["ru", "he"]}).json()
    assert out["config"]["emergency_languages"] == ["he", "ru"]
    before = len(w.speaker.calls)
    assert w.c.post(f"{API}/emergency", json={"template_id": "shelter"}).status_code == 200
    assert [c[3] for c in w.speaker.calls[before:]] == ["he", "ru"]
    for bad in ([], ["fr"], ["he", "fr"], "he"):
        assert w.c.put(f"{API}/config", json={"emergency_languages": bad}).status_code == 422, bad


def test_the_emergency_refusals_are_audited_too(world):
    w = world
    assert w.c.post(f"{API}/emergency", json={"template_id": "evacuate"}).status_code == 404  # the feature is off
    a = audits(w, "media.announce.emergency")
    assert a and a[-1]["decision"] == "denied" and a[-1]["reason"] == "feature_disabled"
    enable(w)
    assert w.c.post(f"{API}/emergency", json={"template_id": "water_off"}).json()["code"] == "template_unknown", "a routine template is not an emergency"
    assert w.c.post(f"{API}/emergency", json={"template_id": "nope"}).json()["code"] == "template_unknown"
    assert w.speaker.calls == []
    w.speaker.error = RuntimeError("engine down")
    r = w.c.post(f"{API}/emergency", json={"template_id": "evacuate"})
    assert r.status_code == 502 and r.json()["code"] == "speak_failed"
    assert audits(w, "media.announce.emergency")[-1]["details"]["status"] == "failed"


# ---------------------------------------------------------------------------------------------------- the engine selector and the cloud key

def test_the_default_engine_is_local_and_the_cloud_is_off_and_cannot_be_selected_while_off(world):
    w = world
    cfg = w.c.get(f"{API}/config").json()["config"]
    assert cfg["engine_kind"] == "local" and cfg["cloud_enabled"] is False and cfg["cloud_key_set"] is False
    r = w.c.put(f"{API}/config", json={"engine_kind": "cloud"})
    assert r.status_code == 422 and r.json()["code"] == "cloud_off" and r.json()["details"]["message_en"]
    assert w.c.get(f"{API}/config").json()["config"]["engine_kind"] == "local"
    out = w.c.put(f"{API}/config", json={"cloud_enabled": True, "engine_kind": "cloud"}).json()
    assert out["config"]["engine_kind"] == "cloud" and out["config"]["cloud_enabled"] is True
    out = w.c.put(f"{API}/config", json={"cloud_enabled": False}).json()
    assert out["config"]["engine_kind"] == "local" and out["config"]["cloud_enabled"] is False, "switching the cloud off returns the selector to local"
    assert w.c.put(f"{API}/config", json={"engine_kind": "azure"}).status_code == 422
    a = [x for x in audits(w, "media.announce.config") if "cloud_enabled" in x["details"].get("changed", [])]
    assert len(a) == 2 and a[0]["details"]["cloud_enabled"] is True and a[1]["details"]["cloud_enabled"] is False


def test_the_local_engine_is_used_by_default(world):
    w = world
    enable(w)
    assert whole_building(w).status_code == 200
    assert w.speaker.calls and w.speaker.calls[0][0] == "tts.fake_engine"
    assert audits(w)[-1]["details"]["engine"] == "local"


class Cloud:
    def __init__(self) -> None:
        self.synth: list[tuple[str, str, str]] = []
        self.delivered: list[tuple[list[str], eng.Audio]] = []
        self.error: eng.EngineError | None = None

    def synthesize(self, key, text, language):
        self.synth.append((key, text, language))
        if self.error:
            raise self.error
        return eng.Audio(data=b"FAKE-AUDIO-BYTES", mime="audio/mpeg")

    def deliver(self, _settings, entity_ids, audio):
        self.delivered.append((list(entity_ids), audio))


@pytest.fixture()
def cloud(world, monkeypatch):
    c = Cloud()
    monkeypatch.setattr(eng, "SYNTHESIZE", c.synthesize)
    monkeypatch.setattr(eng, "DELIVER", c.deliver)
    return c


KEY = "sk-test-SECRET-0123456789"


def put_key(w):
    r = w.c.put("/api/v1/system/secrets/announce_cloud_key", json={"value": KEY})
    assert r.status_code == 200, r.text


def test_the_cloud_engine_speaks_through_the_fake_with_the_key_from_the_secrets_store(world, cloud):
    w = world
    enable(w)
    put_key(w)
    assert w.c.get(f"{API}/config").json()["config"]["cloud_key_set"] is True
    assert w.c.put(f"{API}/config", json={"cloud_enabled": True, "engine_kind": "cloud"}).status_code == 200
    advance(w)
    r = w.c.post(API, json={"scope": "all", "ref": "*", "texts": [{"language": "he", "text": "שלום"}, {"language": "ru", "text": "Привет"}]})
    assert r.status_code == 200, r.text
    assert cloud.synth == [(KEY, "שלום", "he"), (KEY, "Привет", "ru")]
    assert len(cloud.delivered) == 2 and all(len(e) == 2 for e, _a in cloud.delivered), "delivered to both speakers"
    assert w.speaker.calls == [], "the local engine is not used while the cloud one is selected"
    assert audits(w)[-1]["details"]["engine"] == "cloud"


def test_the_cloud_engine_refuses_without_its_switch_or_its_key_and_reports_failures_by_code(world, cloud):
    w = world
    enable(w)
    w.c.put(f"{API}/config", json={"cloud_enabled": True, "engine_kind": "cloud"})
    r = whole_building(w)
    assert r.status_code == 409 and r.json()["code"] == "not_configured" and cloud.synth == [], "no key: nothing leaves the building"
    put_key(w)
    advance(w)
    cloud.error = eng.EngineError("cloud_unreachable")
    r = w.c.post(API, json={"scope": "all", "ref": "*", "text": "שלום"})
    assert r.status_code == 502 and r.json()["details"]["error"] == "cloud_unreachable" and KEY not in r.text
    cloud.error = None
    cloud.synth.clear()
    # the switch off beats a selector left on `cloud` (a stale row): refused, the text is not sent
    with w.db.connection() as conn:
        from smplwise.db import set_setting

        set_setting(conn, "announce.cloud_enabled", "false")
    advance(w)
    r = w.c.post(API, json={"scope": "all", "ref": "*", "text": "שלום"})
    assert r.status_code == 409 and r.json()["code"] == "cloud_off" and cloud.synth == []


def test_the_default_cloud_delivery_is_not_wired_in_stage_a_and_says_so(world, monkeypatch):
    w = world
    monkeypatch.setattr(eng, "SYNTHESIZE", lambda key, text, language: eng.Audio(data=b"x"))
    enable(w)
    put_key(w)
    w.c.put(f"{API}/config", json={"cloud_enabled": True, "engine_kind": "cloud"})
    r = whole_building(w)
    assert r.status_code == 502 and r.json()["details"]["error"] == "cloud_delivery_unavailable"


def test_the_cloud_key_is_never_visible_anywhere(world, cloud, caplog):
    w = world
    enable(w)
    caplog.set_level("DEBUG")
    put_key(w)
    w.c.put(f"{API}/config", json={"cloud_enabled": True, "engine_kind": "cloud"})
    assert whole_building(w).status_code == 200
    cloud.error = eng.EngineError("cloud_rejected")
    advance(w)
    w.c.post(API, json={"scope": "all", "ref": "*", "text": "again"})
    listing = w.c.get("/api/v1/system/secrets").json()["secrets"]
    mine = next(s for s in listing if s["name"] == "announce_cloud_key")
    assert mine["configured"] is True and mine["state"] == "set" and "value" not in mine
    surfaces = [w.c.get(f"{API}/config").text, w.c.get(f"{API}/areas").text, w.c.get(f"{API}/history").text, json.dumps(listing)]
    with w.db.connection(mode="read") as conn:
        for table in ("settings", "audit_log", "announcements", "app_secrets"):
            surfaces.append(json.dumps([[str(v) for v in r] for r in conn.execute(f"SELECT * FROM {table}").fetchall()]))
    for text in surfaces:
        assert KEY not in text
    assert KEY not in caplog.text
    assert KEY not in repr(eng.CloudEngine(KEY)) and "FAKE-AUDIO" not in repr(eng.Audio(data=b"FAKE-AUDIO-BYTES"))
    # it lives only in the sealed store row: the stored blob is not the plain key
    with w.db.connection(mode="read") as conn:
        blob = conn.execute("SELECT value_enc FROM app_secrets WHERE name = 'announce_cloud_key'").fetchone()[0]
    assert blob and KEY not in blob
    # and no setting key can carry it
    assert w.c.put(f"{API}/config", json={"cloud_key": KEY}).status_code == 422
    assert w.c.put(f"{API}/config", json={"api_key": KEY}).status_code == 422


# ---------------------------------------------------------------------------------------------------- owner answers 2026-10-25

def test_free_text_emergency_is_the_same_one_click_flow_with_the_same_audit(world):
    w = world
    enable(w, quiet={"enabled": True, "mode": "suppress"}, max_per_minute=1)
    w.clock["now"] = NIGHT
    bind(w.c, w.settings, "anna", "announcer", "installation", "*")
    h = as_user("anna")
    r = w.c.post(f"{API}/emergency", json={"texts": [{"language": "he", "text": "אש בקומה 3"}, {"language": "ar", "text": "حريق في الطابق الثالث"}]}, headers=h)
    assert r.status_code == 200 and r.json()["targets"] == 2, r.text
    assert [(c[3], c[2]) for c in w.speaker.calls] == [("he", "אש בקומה 3"), ("ar", "حريق في الطابق الثالث")]
    assert w.c.post(f"{API}/emergency", json={"text": "fire", "language": "en"}, headers=h).status_code == 200, "not rate limited, not held by quiet hours"
    a = audits(w, "media.announce.emergency")
    assert len(a) == 2 and a[0]["actor_username"] == "anna" and a[0]["details"]["languages"] == ["he", "ar"] and a[0]["details"]["text"][0] == "אש בקומה 3"
    assert a[0]["details"]["source"] == "emergency" and len(a[0]["details"]["target_keys"]) == 2 and "audio" not in json.dumps(a[0]).lower()
    assert rows(w)[0]["source"] == "emergency" and rows(w)[0]["template_id"] is None
    for body in ({}, {"template_id": "evacuate", "text": "x"}, {"text": "x", "texts": [{"language": "he", "text": "x"}]}, {"text": "x", "language": "fr"}):
        assert w.c.post(f"{API}/emergency", json=body, headers=h).status_code == 422, body
    assert w.c.post(f"{API}/emergency", json={"text": "x"}, headers=as_user("nobody")).status_code == 403


def test_all_four_languages_are_spoken_and_the_engines_come_from_the_home_system(world):
    w = world
    enable(w)
    advance(w)
    parts = [{"language": lang, "text": t} for lang, t in (("he", "שלום"), ("ar", "مرحبا"), ("en", "Hello"), ("ru", "Привет"))]
    assert w.c.post(API, json={"scope": "all", "ref": "*", "texts": parts}).status_code == 200
    assert [c[3] for c in w.speaker.calls] == ["he", "ar", "en", "ru"]
    advance(w)
    assert w.c.post(f"{API}/test", json={"scope": "all", "ref": "*", "language": "ar"}).status_code == 200 and w.speaker.calls[-1][3] == "ar"
    now = "2026-10-01T08:00:00Z"
    with w.db.connection() as conn:
        for ent, plat in (("tts.piper", "wyoming"), ("tts.google_translate_en_com", "google_translate")):
            conn.execute("INSERT INTO ha_entities(entity_id, platform, name, domain, first_seen_at, updated_at) VALUES (?,?,?,?,?,?)", (ent, plat, ent, "tts", now, now))
    got = w.c.get(f"{API}/config").json()
    info = {i["entity_id"]: i["cloud"] for i in got["engine_info"]}
    assert info == {"tts.piper": False, "tts.google_translate_en_com": True} and set(got["engines"]) == set(info)
