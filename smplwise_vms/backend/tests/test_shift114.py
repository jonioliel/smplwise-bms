"""CR-SHIFT114 (r114) slice 1: the shift / 24-hour summary (route, permissions, module switches, window boundaries, Hebrew template).

Negative first: switch off = uniform 404, no reports.shift = 403, a bad window = 422. Then the sections: hidden by module and by permission,
filtered row by row by the reader's own visibility, counted on half-open window boundaries, and the exact Hebrew sentences with their plural
forms. Fakes only: no Home Assistant, device or network."""
from __future__ import annotations

import datetime as dt

import pytest
from conftest import as_user, bind
from fastapi.testclient import TestClient

from smplwise.db import Database
from smplwise.main import create_app
from smplwise.services import shift_summary as svc
from smplwise.services import shift_text as tx

API = "/api/v1"
UTC = dt.timezone.utc
NOW = dt.datetime(2026, 10, 12, 12, 0, tzinfo=UTC).timestamp()  # 15:00 in Asia/Jerusalem (UTC+3 that day)
LO = int(NOW) - 86400
HI = int(NOW)
SWITCH = "reports.shift.enabled"


def iso(ts: float) -> str:
    return dt.datetime.fromtimestamp(ts, UTC).strftime("%Y-%m-%dT%H:%M:%SZ")


@pytest.fixture()
def w(settings, monkeypatch):
    from smplwise.routers import shift_summary as router

    monkeypatch.setattr(router, "now_ts", lambda: NOW)
    c = TestClient(create_app(settings))
    c.get(f"{API}/me")  # joni bootstraps as system_admin
    return {"c": c, "db": Database(settings.db_path), "settings": settings}


def turn_on(w, on: bool = True) -> None:
    with w["db"].connection() as conn:
        conn.execute("INSERT INTO settings(key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value", (SWITCH, "true" if on else "false"))


def custom_role(c: TestClient, name: str, permissions: list[str]) -> str:
    r = c.post(f"{API}/access/roles", json={"name": name, "description": "SHIFT114 test", "permissions": permissions, "sensitive": []})
    assert r.status_code == 201, r.text
    return r.json()["id"]


def reader(w, user: str, permissions: list[str]) -> dict[str, str]:
    bind(w["c"], w["settings"], user, custom_role(w["c"], f"role-{user}", permissions), "installation", "*")
    return as_user(user)


def get(w, qs: str = "", user: str | None = None):
    return w["c"].get(f"{API}/reports/shift{qs}", headers=as_user(user) if user else {})


def note(conn, source: str, subject_kind: str, subject_id: str | None, first: float, resolved: float | None = None, *, count: int = 1, key: str | None = None) -> None:
    n = conn.execute("SELECT COUNT(*) FROM notifications").fetchone()[0]
    conn.execute(
        """INSERT INTO notifications (id, source, category, severity, subject_kind, subject_id, title, dedupe_key, count, first_at, last_at, state, resolved_at, created_at)
           VALUES (?, ?, 'alerts', 'alert', ?, ?, 't', ?, ?, ?, ?, ?, ?, ?)""",
        (f"n{n}", source, subject_kind, subject_id, key or f"{source}-{n}", count, iso(first), iso(first), "resolved" if resolved else "open", iso(resolved) if resolved else None, iso(first)))


def keys(body: dict) -> list[str]:
    return [s["key"] for s in body["sections"]]


def section(body: dict, key: str) -> dict:
    return next(s for s in body["sections"] if s["key"] == key)


def texts(body: dict, key: str) -> list[str]:
    return [x["text"] for x in section(body, key)["lines"]]


# ---------------------------------------------------------------- the gate

def test_switched_off_is_the_uniform_404(w):
    for user in (None, "nobody"):
        assert get(w, user=user).status_code == 404


def test_no_permission_is_403_and_viewer_has_none(w):
    turn_on(w)
    bind(w["c"], w["settings"], "vic", "viewer", "installation", "*")
    assert get(w, user="vic").status_code == 403


@pytest.mark.parametrize("qs", ["?range=custom", "?range=custom&from=2026-10-12T00:00:00", "?range=custom&from=garbage",
                                "?range=custom&from=2026-10-08T00:00:00Z&to=2026-10-12T11:00:00Z",  # longer than 72 hours
                                "?range=custom&from=2026-10-12T11:59:30Z&to=2026-10-12T12:00:00Z",  # shorter than one minute
                                "?range=custom&from=2026-10-12T10:00:00Z&to=2026-10-12T09:00:00Z", "?range=7d"])
def test_bad_window_is_422(w, qs):
    turn_on(w)
    assert get(w, qs).status_code == 422


def test_switch_route_needs_system_configure_and_is_audited(w):
    c = w["c"]
    bind(c, w["settings"], "otto", "operator", "installation", "*")
    assert c.put(f"{API}/reports/shift/status", json={"enabled": True}, headers=as_user("otto")).status_code == 403
    st = c.get(f"{API}/reports/shift/status").json()
    assert st == {"enabled": False, "available": False, "can_switch": True}
    assert c.put(f"{API}/reports/shift/status", json={"enabled": True}).json() == {"enabled": True}
    assert c.get(f"{API}/reports/shift/status").json()["available"] is True
    assert c.get(f"{API}/reports/shift/status", headers=as_user("otto")).json() == {"enabled": True, "available": True, "can_switch": False}
    with w["db"].connection(mode="read") as conn:
        assert conn.execute("SELECT COUNT(*) FROM audit_log WHERE action = 'reports.shift.switch'").fetchone()[0] == 1


# ---------------------------------------------------------------- an empty building, the window

def test_empty_building_is_quiet_and_names_only_the_sections_that_exist(w):
    turn_on(w)
    body = get(w).json()
    # tickets module off; no elevators, temperature units or generator defined: those sections do not appear at all
    assert keys(body) == ["alarms", "doors", "devices"]
    assert body["quiet"] is True and body["lang"] == "he" and body["truncated"] is False
    assert texts(body, "alarms") == ["לא הופעלו אזעקות."]
    assert texts(body, "doors") == ["לא היו אירועי דלתות חריגים."]
    assert texts(body, "devices") == ["לא נרשמו ניתוקי התקנים.", "אין כרגע התקנים שאינם זמינים."]
    assert body["window"]["from"] == iso(LO) and body["window"]["to"] == iso(HI) and body["window"]["minutes"] == 1440
    assert body["text"].startswith("סיכום משמרת: מה קרה בבניין\nהתקופה: 11.10 15:00 עד 12.10 15:00 (24 שעות)\n\nבתקופה זו לא אירע דבר חריג.\n")
    assert "•" in body["text"]


def test_presets_and_a_custom_window(w):
    turn_on(w)
    assert get(w, "?range=8h").json()["window"]["minutes"] == 480
    assert get(w, "?range=12h").json()["window"]["minutes"] == 720
    body = get(w, "?range=custom&from=2026-10-12T06:00:00%2B03:00&to=2026-10-12T09:30:00Z").json()
    assert body["window"]["minutes"] == 390 and body["window"]["duration_text"] == "6 שעות ו־30 דקות"
    # `to` in the future is cut to now; `to` missing means now
    body = get(w, "?range=custom&from=2026-10-12T10:00:00Z&to=2026-10-13T10:00:00Z").json()
    assert body["window"]["to"] == iso(HI) and body["window"]["minutes"] == 120


def test_the_read_is_audited_with_counts_never_sentences(w):
    turn_on(w)
    get(w)
    with w["db"].connection(mode="read") as conn:
        row = conn.execute("SELECT details_json FROM audit_log WHERE action = 'reports.shift.read'").fetchone()
    assert row is not None and "אזעקות" not in row["details_json"] and '"minutes": 1440' in row["details_json"]


# ---------------------------------------------------------------- permissions hide sections

def test_a_reader_with_no_section_right_gets_nothing_to_show(w):
    turn_on(w)
    headers = reader(w, "lone", ["reports.shift"])
    body = w["c"].get(f"{API}/reports/shift", headers=headers).json()
    assert body["sections"] == [] and body["quiet"] is False and body["text"].rstrip().endswith("אין נתונים להצגה לפי ההרשאות שלך.")


def test_each_section_needs_its_own_right(w):
    turn_on(w)
    with w["db"].connection() as conn:
        conn.execute("INSERT INTO generator_devices (id, name, source_kind, source_device_ref, status, detected_at) VALUES ('g1', 'Gen', 'manual', 'ref1', 'detected', ?)", (iso(LO),))
        conn.execute("INSERT INTO generator_alerts (id, device_id, alert_key, severity, raised_at, last_at) VALUES ('a1', 'g1', 'low_fuel', 'critical', ?, ?)", (iso(HI - 600), iso(HI - 600)))
    only_gen = w["c"].get(f"{API}/reports/shift", headers=reader(w, "genie", ["reports.shift", "generator.view"])).json()
    assert keys(only_gen) == ["generator"]
    assert texts(only_gen, "generator") == ["הייתה התראה אחת מהגנרטור.", "מהן אחת קריטית.", "מתוכן אחת עדיין פעילה."]
    no_gen = w["c"].get(f"{API}/reports/shift", headers=reader(w, "devo", ["reports.shift", "devices.read"])).json()
    assert "generator" not in keys(no_gen) and "tickets" not in keys(no_gen)
    assert {"alarms", "doors", "devices"} <= set(keys(no_gen))
    admin = get(w).json()
    assert keys(admin) == ["alarms", "doors", "devices", "generator"]


def test_a_module_that_is_off_or_unconfigured_is_not_offered_even_to_the_admin(w):
    turn_on(w)
    admin = get(w).json()
    assert not {"tickets", "temperature", "elevators", "generator"} & set(keys(admin))
    with w["db"].connection() as conn:
        conn.execute("INSERT INTO infra_elevators (id, name, name_key, created_at, updated_at) VALUES ('e1', 'Lift', 'lift', ?, ?)", (iso(LO), iso(LO)))
        conn.execute("INSERT INTO infra_temp_units (id, name, name_key, temp_entity_id, low, high, created_at, updated_at) VALUES ('u1', 'Fridge', 'fridge', 'sensor.f', 2, 8, ?, ?)", (iso(LO), iso(LO)))
    assert {"temperature", "elevators"} <= set(keys(get(w).json()))
    with w["db"].connection() as conn:
        conn.execute("UPDATE infra_elevators SET enabled = 0")
    assert "elevators" not in keys(get(w).json())


# ---------------------------------------------------------------- rows are filtered by the reader's own visibility

def test_notification_rows_follow_the_inbox_rule(w):
    turn_on(w)
    with w["db"].connection() as conn:
        note(conn, "alarm.triggered", "alarm_panel", "alarm_control_panel.home", HI - 3600)
        note(conn, "door.emergency.started", "door", "station-1", HI - 1800)
        note(conn, "camera.offline", "camera", "cam-x", HI - 900)
    admin = get(w).json()
    assert texts(admin, "alarms")[:2] == ["הופעלה אזעקה אחת.", "אזעקה אחת עדיין פעילה."]
    assert texts(admin, "doors")[0] == "הופעל מצב חירום בדלתות פעם אחת."
    assert admin["quiet"] is False
    # a reader with devices.read only: the section is offered, but the alarm panel, the door and the camera are not his to see
    dev = w["c"].get(f"{API}/reports/shift", headers=reader(w, "devo", ["reports.shift", "devices.read"])).json()
    assert texts(dev, "alarms") == ["לא הופעלו אזעקות."]
    assert texts(dev, "doors") == ["לא היו אירועי דלתות חריגים."]
    assert dev["quiet"] is True


def test_floor_scoped_reader_does_not_count_an_unplaced_panel(w):
    turn_on(w)
    from conftest import seed_tree

    floors = seed_tree(w["c"])
    bind(w["c"], w["settings"], "fred", "operator", "floor", floors["floor2"])
    with w["db"].connection() as conn:
        note(conn, "alarm.triggered", "alarm_panel", "alarm_control_panel.home", HI - 3600)
    assert texts(get(w).json(), "alarms")[0] == "הופעלה אזעקה אחת."
    fred = get(w, user="fred")
    assert fred.status_code == 200, fred.text
    assert texts(fred.json(), "alarms") == ["לא הופעלו אזעקות."]


# ---------------------------------------------------------------- window boundaries are half open

def test_notification_boundaries(w):
    turn_on(w)
    with w["db"].connection() as conn:
        note(conn, "alarm.triggered", "alarm_panel", "p1", LO)                        # begins exactly at the start: raised
        note(conn, "alarm.triggered", "alarm_panel", "p2", HI)                        # begins exactly at the end: not in the window
        note(conn, "alarm.triggered", "alarm_panel", "p3", LO - 100, LO - 1)          # resolved before the start: not overlapping
        note(conn, "alarm.triggered", "alarm_panel", "p4", LO - 100, LO)              # resolved exactly at the start: overlaps, not raised, not active
        note(conn, "alarm.triggered", "alarm_panel", "p5", LO - 100)                  # began before, still open: active, not raised
        note(conn, "alarm.triggered", "alarm_panel", "p6", HI - 60, HI)               # resolved exactly at the end: still open when the window ended
    body = get(w).json()
    assert section(body, "alarms")["counts"] == {"raised": 2, "active": 3, "safety": 0, "safety_active": 0}
    assert texts(body, "alarms") == ["הופעלו שתי אזעקות.", "3 אזעקות עדיין פעילות."]


def test_ticket_boundaries_and_exact_sentences(settings, monkeypatch):
    from smplwise.routers import shift_summary as router
    from tickets_world import build

    monkeypatch.setattr(router, "now_ts", lambda: NOW)
    world = build(settings)
    db = Database(settings.db_path)
    with db.connection() as conn:
        conn.execute("INSERT INTO settings(key, value) VALUES (?, 'true') ON CONFLICT(key) DO UPDATE SET value = 'true'", (SWITCH,))
    ids = {k: world.create("tom", title=k)["id"] for k in "ABCDEF"}
    with db.connection() as conn:
        conn.execute("UPDATE tickets SET resolve_due_at = NULL, closed_at = NULL")

        def put(key: str, created: float, status: str = "new", closed: float | None = None, due: float | None = None) -> None:
            conn.execute("UPDATE tickets SET created_at = ?, status = ?, closed_at = ?, resolve_due_at = ? WHERE id = ?",
                         (iso(created), status, iso(closed) if closed else None, iso(due) if due else None, ids[key]))

        put("A", LO)                                    # created exactly at the start: opened, open
        put("B", LO - 1, due=HI - 3600)                 # before the window, still open, past its due time: open + overdue
        put("C", HI - 1)                                # created in the last second: opened, open
        put("D", HI)                                    # created exactly at the end: not in the window at all
        put("E", LO - 5000, "closed", closed=LO)        # closed exactly at the start: closed
        put("F", LO - 5000, "closed", closed=HI)        # closed exactly at the end: not closed in the window, was open when it ended
    body = world.c.get(f"{API}/reports/shift", headers=as_user("tom")).json()
    assert section(body, "tickets")["counts"] == {"opened": 2, "closed": 1, "open": 4, "overdue": 1}
    assert texts(body, "tickets") == ["נפתחו שתי בקשות שירות.", "נסגרה בקשת שירות אחת.", "כרגע פתוחות 4 בקשות שירות.", "מהן אחת באיחור."]
    assert set(section(body, "tickets")) == {"key", "title", "lines", "attention", "truncated", "counts"}  # counts only: no ticket title, number or person
    # a member who was denied tickets.view gets no tickets section at all; the module off hides it from everyone
    dina = world.c.get(f"{API}/reports/shift", headers=as_user("dina")).json()
    assert "tickets" not in keys(dina)
    assert world.c.patch(f"{API}/settings", json={"tickets.enabled": "false"}).status_code == 200
    assert "tickets" not in keys(world.c.get(f"{API}/reports/shift", headers=as_user("tom")).json())


def test_faults_sections_count_in_the_window(w):
    turn_on(w)
    with w["db"].connection() as conn:
        conn.execute("INSERT INTO infra_elevators (id, name, name_key, created_at, updated_at) VALUES ('e1', 'Lift', 'lift', ?, ?)", (iso(LO), iso(LO)))
        for role in ("fault", "out_of_service", "fire_service"):
            conn.execute("INSERT INTO infra_elevator_sensors (elevator_id, role, position, entity_id) VALUES ('e1', ?, 0, ?)", (role, f"binary_sensor.l_{role}"))
        conn.execute("INSERT INTO infra_elevator_states (elevator_id, at, state) VALUES ('e1', ?, 'waiting')", (iso(LO - 3600),))
        conn.execute("INSERT INTO infra_elevator_states (elevator_id, at, state) VALUES ('e1', ?, 'fault')", (iso(HI - 5400),))   # 90 minutes down, to the end
        conn.execute("INSERT INTO infra_temp_units (id, name, name_key, temp_entity_id, low, high, created_at, updated_at) VALUES ('u1', 'Fridge', 'fridge', 'sensor.f', 2, 8, ?, ?)", (iso(LO), iso(LO)))
        conn.execute("INSERT INTO infra_temp_events (id, unit_id, kind, severity, started_at, ended_at) VALUES ('t1', 'u1', 'high', 'alarm', ?, NULL)", (iso(HI - 7200),))
        conn.execute("INSERT INTO infra_temp_events (id, unit_id, kind, severity, started_at, ended_at) VALUES ('t2', 'u1', 'low', 'warning', ?, ?)", (iso(HI - 40000), iso(HI - 39000)))
        conn.execute("INSERT INTO infra_temp_events (id, unit_id, kind, severity, started_at, ended_at) VALUES ('t3', 'u1', 'high', 'warning', ?, ?)", (iso(LO - 9000), iso(LO - 1)))  # ended before
        note(conn, "device.unavailable", "entity", "light.x", HI - 100)
    body = get(w).json()
    assert texts(body, "elevators") == ["מעלית אחת הייתה תקולה או מושבתת.", "סך זמן התקלה וההשבתה: שעה אחת ו־30 דקות.","כרגע מעלית אחת תקולה או מושבתת."]
    assert texts(body, "temperature") == ["נרשמו שתי חריגות טמפרטורה.", "מהן אחת הגיעה לרמת אזעקה.", "חריגה אחת עדיין נמשכת."]
    assert section(body, "temperature")["counts"]["excursions"] == 2
    # the entity is not catalogued, so the unavailable-device row is not visible to anyone: counted as nothing
    assert texts(body, "devices")[0] == "לא נרשמו ניתוקי התקנים."


# ---------------------------------------------------------------- the Hebrew template

@pytest.mark.parametrize("key", sorted(tx.T))
def test_every_sentence_has_a_many_form_and_formats(key):
    forms = tx.T[key]
    assert "many" in forms and set(forms) <= {"zero", "one", "two", "many"}
    for n in (0, 1, 2, 3, 11, 100):
        assert tx.say(key, n, dur="שעה אחת").strip()
        assert "{" not in tx.say(key, n, dur="שעה אחת")


def test_plural_forms_of_a_counted_sentence():
    assert [tx.say("tickets.opened", n) for n in (0, 1, 2, 3, 11)] == [
        "לא נפתחו בקשות שירות חדשות.", "נפתחה בקשת שירות אחת.", "נפתחו שתי בקשות שירות.", "נפתחו 3 בקשות שירות.", "נפתחו 11 בקשות שירות."]
    assert [tx.say("alarms.raised", n) for n in (0, 1, 2, 5)] == ["לא הופעלו אזעקות.", "הופעלה אזעקה אחת.", "הופעלו שתי אזעקות.", "הופעלו 5 אזעקות."]
    assert [tx.say("devices.now", n) for n in (0, 1, 2, 7)] == [
        "אין כרגע התקנים שאינם זמינים.", "כרגע התקן אחד אינו זמין.", "כרגע שני התקנים אינם זמינים.", "כרגע 7 התקנים אינם זמינים."]
    assert [tx.say("doors.relock", n) for n in (1, 2, 9)] == ["חזרה לנעילה שלא אושרה: פעם אחת.", "חזרה לנעילה שלא אושרה: פעמיים.", "חזרה לנעילה שלא אושרה: 9 פעמים."]


@pytest.mark.parametrize("minutes,expected", [(0, "דקה אחת"), (1, "דקה אחת"), (2, "שתי דקות"), (45, "45 דקות"), (60, "שעה אחת"), (61, "שעה אחת ודקה אחת"), (62, "שעה אחת ושתי דקות"),
                                              (120, "שעתיים"), (150, "שעתיים ו־30 דקות"), (480, "8 שעות"), (1440, "24 שעות"), (4320, "72 שעות")])
def test_duration_text(minutes, expected):
    assert tx.duration(minutes) == expected


def test_parse_window_unit():
    assert svc.parse_window("24h", None, None, NOW) == (LO, HI)
    assert svc.parse_window("custom", "2026-10-12T10:00:00Z", None, NOW) == (HI - 7200, HI)
    with pytest.raises(svc.WindowError):
        svc.parse_window("custom", None, None, NOW)
