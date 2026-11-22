"""I18N-EN-2490 (owner answer N53 / Q15 = b, "translate at creation"): a default name the server writes into stored data is made in the
interface language (`ui.lang`) of the user whose request creates it; no stored value, no user, or a background pass = Hebrew, exactly the
text written before the change. Stored names are never rewritten later (services/default_names.py)."""
from __future__ import annotations

import pytest
from conftest import as_user
from test_liveevent_100 import API, World

from smplwise.services import automation_blueprints as bps
from smplwise.services import default_names as dn
from smplwise.services import generator_core as core
from smplwise.services import incidents as incidents_svc
from smplwise.services import schedule_ops
from smplwise.services import user_prefs
from smplwise.services.tickets import intake

# ---------------------------------------------------------------- the catalogue


def test_every_entry_has_hebrew_and_english_and_the_hebrew_is_the_old_text():
    assert dn.LANGS == user_prefs.UI_LANGS, "the languages a name is made in are the interface languages offered"
    for key, entry in dn.TEXTS.items():
        assert set(entry) == {"he", "en"} and all(entry.values()), key
        assert not any("֐" <= ch <= "׿" for ch in entry["en"]), f"{key}: English without Hebrew letters"
    # the Hebrew is what the code wrote before the change (a Hebrew user's names are unchanged)
    assert dn.name("zone.room", "he", n=3) == "חדר 3"
    assert dn.name("incident.manual", "he") == "אירוע ידני"
    assert dn.name("incident.burglary_at", "he", name="חניון") == "אזעקת פריצה · חניון"
    assert dn.name("case.imported", "he") == "תיק מיובא"
    assert dn.name("generator", "he") == "גנרטור"
    assert dn.name("door_window", "he") == "חלון פתיחה"
    assert dn.name("nvr.channel", "he", n=4) == "ערוץ 4"
    assert dn.DAY_SHORT["he"] == schedule_ops.DAY_SHORT
    assert set(dn.EVENT_TYPE_EN) == set(incidents_svc.EVENT_TYPE_HE)
    assert set(dn.BLUEPRINT_TITLE_EN) == {bp["id"] for bp in bps.LIBRARY}


def test_fill_is_one_pass_and_an_unknown_language_is_hebrew():
    assert dn.name("incident.manual_at", "en", name="{name} {n}") == "Manual incident · {name} {n}", "a value holding braces is not a slot"
    assert dn.name("zone.room", "ar", n=2) == "חדר 2"
    assert dn.day_short("fri", "en") == "Fri" and dn.day_short("fri", "ru") == "ו׳"
    assert dn.event_type("field", "חדירה לאזור", "en") == "Intrusion" and dn.event_type("field", "חדירה לאזור", "he") == "חדירה לאזור"


def test_blueprint_default_alias_follows_the_language():
    bp = next(b for b in bps.LIBRARY if b["id"] == "water_leak_notify")
    values = {p["key"]: p.get("default") for p in bp["parameters"]}
    assert bps.build_config(bp, values)["alias"] == "התראת נזילת מים"
    assert bps.build_config(bp, values, lang="en")["alias"] == "Water leak alert"
    assert bps.build_config(bp, values, "My leak", lang="en")["alias"] == "My leak", "a name the user gave is kept as given"


# ---------------------------------------------------------------- the caller's language, through the API


@pytest.fixture()
def w(settings) -> World:
    world = World(settings)
    world.enable(**{"incident.merge_window_s": 0})
    r = world.c.put(f"{API}/me/prefs", json={"ui.lang": "en"}, headers=as_user("dana"))
    assert r.status_code == 200 and r.json()["prefs"]["ui.lang"] == "en", r.text
    return world


def _uid(w: World, user: str | None = None) -> str:
    return w.c.get(f"{API}/me", headers=as_user(user) if user else None).json()["user"]["id"]


def test_lang_of_reads_the_users_own_preference(w):
    with w.app.state.db.connection() as conn:
        assert dn.lang_of_user(conn, _uid(w, "dana")) == "en"
        assert dn.lang_of_user(conn, _uid(w)) == "he", "no stored value = Hebrew"
        assert dn.lang_of_user(conn, None) == "he" and dn.lang_of(conn, None) == "he"
        conn.execute("UPDATE user_prefs SET value_json = '\"xx\"' WHERE key = 'ui.lang'")
        assert dn.lang_of_user(conn, _uid(w, "dana")) == "he", "a value that is not offered = Hebrew"


def test_manual_incident_title_is_made_in_the_callers_language(w):
    he = w.c.post(f"{API}/incidents", json={"floor_id": w.f2, "x": 0.3, "y": 0.25})
    en = w.c.post(f"{API}/incidents", json={"floor_id": w.f2, "x": 0.7, "y": 0.25}, headers=as_user("dana"))
    assert he.status_code == 201 and en.status_code == 201, (he.text, en.text)
    assert he.json()["incident"]["title"] == "אירוע ידני"
    assert en.json()["incident"]["title"] == "Manual incident"
    # a title the user typed is stored as typed, in any language
    typed = w.c.post(f"{API}/incidents", json={"floor_id": w.f2, "x": 0.5, "y": 0.6, "title": "פריצה · חניון"}, headers=as_user("dana"))
    assert typed.json()["incident"]["title"] == "פריצה · חניון"
    # stored, not translated on read: the Hebrew user still reads the English title dana's request wrote
    got = w.c.get(f"{API}/incidents/{en.json()['incident']['id']}").json()
    assert (got.get("incident") or got)["title"] == "Manual incident"


def test_incident_from_the_map_marker_and_from_an_event(w):
    anchor = w.rows("SELECT id FROM map_anchors WHERE resource_id = ? AND effective_to IS NULL", (w.cam["A"],))[0]["id"]
    r = w.c.post(f"{API}/incidents", json={"anchor_id": anchor}, headers=as_user("dana"))
    assert r.status_code == 201 and r.json()["incident"]["title"] == "Manual incident · חניון מזרח", r.text  # the camera's own name is data
    eid = w.event("A")
    r = w.c.post(f"{API}/incidents", json={"event_id": eid}, headers=as_user("dana"))
    assert r.status_code == 201, r.text
    inc = r.json()["incident"]
    assert inc["title"] == "Intrusion · חניון מזרח" and inc["event_label"] == "Intrusion"


def test_alarm_screen_button_title_follows_the_caller_and_the_hook_stays_hebrew(w):
    r = w.c.post(f"{API}/incidents", json={"alarm_panel": "alarm_control_panel.home"})
    assert r.status_code == 201 and r.json()["incident"]["title"] == "אזעקת פריצה · אזעקה" and r.json()["incident"]["event_label"] == "אזעקת פריצה"
    with w.app.state.db.connection() as conn:
        _anchor, title = incidents_svc.alarm_location(conn, "alarm_control_panel.home", lang="en")
        assert title == "Burglary alarm · אזעקה"
        assert incidents_svc.alarm_location(conn, "alarm_control_panel.home")[1] == "אזעקת פריצה · אזעקה", "no caller (the automatic hook) = Hebrew"


def test_unnamed_accepted_room_and_no_rewrite_of_stored_names(w):
    box = [{"x": 0.1, "y": 0.6}, {"x": 0.3, "y": 0.6}, {"x": 0.3, "y": 0.8}, {"x": 0.1, "y": 0.8}]
    r = w.c.post(f"{API}/floors/{w.f3}/zones/accept", json={"candidates": [{"polygon": box}]})
    assert r.status_code == 201, r.text
    first = r.json()["created"][0]
    assert w.c.put(f"{API}/me/prefs", json={"ui.lang": "en"}).status_code == 200  # joni switches to English
    r = w.c.post(f"{API}/floors/{w.f3}/zones/accept", json={"candidates": [{"polygon": box}, {"polygon": box, "name": "לובי"}]})
    assert r.status_code == 201, r.text
    names = {z["id"]: z["name"] for z in r.json()["zones"]}
    assert names[first] == "חדר 1", "a name stored before is never rewritten"
    assert [names[i] for i in r.json()["created"]] == ["Room 1", "לובי"]


def test_generator_without_a_device_name(w):
    with w.app.state.db.connection() as conn:
        for did in ("dev_gen_he", "dev_gen_en"):
            conn.execute("INSERT INTO ha_devices(device_id, name, updated_at) VALUES (?, '', '2026-11-22T00:00:00Z')", (did,))
        he = core.add_manual(conn, "dev_gen_he", None)
        en = core.add_manual(conn, "dev_gen_en", None, lang="en")
        named = core.add_manual(conn, "dev_gen_en", "x", lang="en")  # already registered: the existing one, unchanged
        names = {r["id"]: r["name"] for r in conn.execute("SELECT id, name FROM generator_devices").fetchall()}
    assert names[he] == "גנרטור" and names[en] == "Generator" and named == en


def test_intake_title_without_a_subject_names_the_module_in_english(w):
    class _Viewer:
        def __init__(self, uid: str) -> None:
            self.principal = type("P", (), {"user_id": uid})()

    with w.app.state.db.connection() as conn:
        dana, joni = _Viewer(_uid(w, "dana")), _Viewer(_uid(w))
        assert intake._default_title(conn, joni, "ticket.no_subject") == "פנייה ללא נושא"
        assert intake._default_title(conn, joni, "ticket.from_place", place="לובי") == "פנייה - לובי"
        assert intake._default_title(conn, dana, "ticket.no_subject") == "Ticket without a subject"
        assert intake._default_title(conn, dana, "ticket.from_place", place="{ticket} lobby") == "Ticket - {ticket} lobby", "the place is data"
