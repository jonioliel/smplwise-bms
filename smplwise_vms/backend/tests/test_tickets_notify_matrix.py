"""TKNOTIFMATRIX - the per-department notification matrix and the daily digest (settings `notify.*`, services/tickets/notify_matrix.py):

- default = today's behaviour: with the matrix off a new ticket notifies exactly as before, whatever the stored cells say;
- a matrix cell "off" silences one source for one department only, "*" is the fallback, a department's own cell wins;
- "digest" holds events (nothing is created) until the DEPARTMENT's digest time (2.9.1: per department, default the installation's),
  then ONE `ticket.digest` per recipient and department: counts and the department name in the title / body (never a typed title); the
  ticket list is rendered for the reader only, filtered by what he may see; an event held after the slot waits for tomorrow;
- 2.9.1 recipients per department (managers by default, plus named users / roles, each only for tickets he may see);
- 2.9.1 an assignee's event may be digested: it reaches its assignee's own digest;
- 2.9.1 urgent events (high / urgent priority, SLA crossings) go at once by default; per SLA policy that can be overridden;
- 2.9.1 nothing is lost: a failed digest sends its events at once; turning the digest off releases what is held;
- 2.9.1 a department's channel override (only while the matrix is on);
- validation (422), permission (system.configure) and the audit row of the settings route.

The clock is the notification engine's (`notify.now_utc`), replaced per test - no real waiting."""
from __future__ import annotations

import datetime as dt

import pytest

from smplwise.db import Database
from smplwise.rbac import Principal
from smplwise.services import notify
from smplwise.services.tickets import notify_bridge, notify_matrix
from tickets_world import API, MAINT, build

URGENT = "prio-maintenance-urgent"


@pytest.fixture()
def w(settings):
    return build(settings)


class Clock:
    def __init__(self, monkeypatch, start: dt.datetime) -> None:
        self.now = start
        monkeypatch.setattr(notify, "now_utc", lambda: self.now)

    def local(self, w, day: int, hh: int, mm: int) -> None:
        """Set the clock to day `day` of January 2030, hh:mm in the installation's time zone."""
        from smplwise.services.tickets.messaging import time_zone

        with db(w).connection() as conn:
            tz = time_zone(conn)
        self.now = dt.datetime(2030, 1, day, hh, mm, tzinfo=tz).astimezone(dt.timezone.utc)


@pytest.fixture()
def clock(monkeypatch):
    return Clock(monkeypatch, dt.datetime(2030, 1, 1, 0, 0, tzinfo=dt.timezone.utc))


def db(w) -> Database:
    return Database(w.settings.db_path)


def put(w, patch: dict, user: str = "joni"):
    rev = w.c.get(f"{API}/tickets/settings", headers=w.h("joni")).json()["revision"]
    return w.c.put(f"{API}/tickets/settings", json={"revision": rev, **patch}, headers=w.h(user))


def notes(w, source: str) -> list[dict]:
    with db(w).connection() as conn:
        rows = [dict(r) for r in conn.execute("SELECT * FROM notifications WHERE source = ? ORDER BY created_at, id", (source,)).fetchall()]
        for r in rows:
            r["to"] = sorted(x[0] for x in conn.execute("SELECT user_id FROM notification_recipients WHERE notification_id = ?", (r["id"],)).fetchall())
        return rows


def tick(w) -> int:
    return notify_matrix.tick(db(w), force=True)


def digest_on(w, matrix: dict, **extra) -> None:
    r = put(w, {"notify": {"matrix_enabled": True, "digest_enabled": True, "digest_time": "08:00", "matrix": matrix, **extra}})
    assert r.status_code == 200, r.text


def test_defaults_change_nothing(w):
    doc = w.c.get(f"{API}/tickets/settings", headers=w.h("joni")).json()["notify"]
    assert doc == {"matrix_enabled": False, "matrix": {}, "digest_enabled": False, "digest_time": "08:00", "departments": {},
                   "urgent_immediate": True, "sla_urgent": {}}
    t = w.create("nora", "שקע")
    assert [n["to"] for n in notes(w, "ticket.new_unassigned")] == [["dev-mona"]]
    assert t["id"]


def test_cells_are_ignored_while_the_matrix_is_off(w):
    r = put(w, {"notify": {"matrix": {"*": {"ticket.new_unassigned": "off"}}}})
    assert r.status_code == 200, r.text
    w.create("nora", "שקע")
    assert len(notes(w, "ticket.new_unassigned")) == 1


def test_off_silences_one_department_and_star_is_the_fallback(w):
    assert put(w, {"notify": {"matrix_enabled": True, "matrix": {MAINT: {"ticket.new_unassigned": "off"}}}}).status_code == 200
    w.create("nora", "שקע")
    assert notes(w, "ticket.new_unassigned") == []
    with db(w).connection() as conn:
        assert notify_matrix.decide(conn, MAINT, "ticket.new_unassigned") == "off"
        assert notify_matrix.decide(conn, "other", "ticket.new_unassigned") == "now"
        assert notify_matrix.decide(conn, MAINT, "ticket.done") == "now"
    assert put(w, {"notify": {"matrix": {"*": {"ticket.new_unassigned": "off", "ticket.done": "off"},
                                        MAINT: {"ticket.done": "digest"}}}}).status_code == 200
    with db(w).connection() as conn:
        assert notify_matrix.decide(conn, "other", "ticket.new_unassigned") == "off"
        assert notify_matrix.decide(conn, MAINT, "ticket.done") == "now", "digest needs digest_enabled: otherwise it goes now"


def test_digest_holds_then_sends_one_notification_per_recipient(w, clock):
    digest_on(w, {MAINT: {"ticket.new_unassigned": "digest"}})
    clock.local(w, 1, 6, 0)
    t1 = w.create("nora", "סוד ראשון")
    t2 = w.create("nora", "סוד שני")
    t3 = w.create("nora", "סוד שלישי")
    assert notes(w, "ticket.new_unassigned") == [], "held, nothing created yet"
    meta = w.c.get(f"{API}/tickets/settings/notify-matrix", headers=w.h("joni")).json()
    assert meta["pending"] == 3 and next(d for d in meta["departments"] if d["id"] == MAINT)["pending"] == 3
    with db(w).connection() as conn:  # closes before the digest
        conn.execute("UPDATE tickets SET status = 'cancelled' WHERE id = ?", (t3["id"],))
    clock.local(w, 1, 7, 59)
    assert tick(w) == 0 and notes(w, "ticket.digest") == []
    clock.local(w, 1, 8, 1)
    assert tick(w) == 1
    rows = notes(w, "ticket.digest")
    assert len(rows) == 1 and rows[0]["to"] == ["dev-mona"] and rows[0]["category"] == "tickets"
    text = rows[0]["title"] + rows[0]["body"]
    assert "2" in rows[0]["title"] and "סוד" not in text and "אחזקה" in rows[0]["body"], "counts and the department, never a typed title"
    assert "סוד" not in rows[0]["params_json"], "the ticket list is not stored, only ids"
    assert rows[0]["link"] == "#/tickets"
    # the detail: rendered for the reader, with the titles he may see
    item = w.c.get(f"{API}/notifications/{rows[0]['id']}", headers=w.h("mona")).json()
    assert {i["ticket_id"] for i in item["digest"]["items"]} == {t1["id"], t2["id"]}
    assert {i["title"] for i in item["digest"]["items"]} == {"סוד ראשון", "סוד שני"} and item["digest"]["hidden"] == 0
    with db(w).connection() as conn:
        vic = Principal(user_id="dev-vic", username="vic", display_name="vic", source="push")
        hidden = notify_matrix.detail_for(conn, vic, {"items": [{"t": t1["id"], "s": "ticket.new_unassigned"}], "total": 1})
        assert hidden["items"] == [] and hidden["hidden"] == 1, "a reader who may not see the ticket gets no line of it"
        assert notify_matrix.pending(conn) == 0
    assert tick(w) == 0, "nothing more today"


def test_each_department_has_its_own_time_and_late_events_wait_for_tomorrow(w, clock):
    digest_on(w, {"*": {"ticket.new_unassigned": "digest"}}, departments={MAINT: {"digest_time": "09:00"}})
    clock.local(w, 1, 6, 0)
    w.create("nora", "א")
    w.create("cleo", "ב", dept=w.cleaning)
    clock.local(w, 1, 8, 30)
    assert tick(w) == 1, "cleaning (installation default 08:00) only"
    assert [r["to"] for r in notes(w, "ticket.digest")] == [["dev-cleo"]]
    clock.local(w, 1, 9, 5)
    w.create("nora", "ג")  # held AFTER maintenance's slot: tomorrow's digest
    assert tick(w) == 1
    rows = notes(w, "ticket.digest")
    assert [r["to"] for r in rows] == [["dev-cleo"], ["dev-mona"]] and "1" in rows[1]["title"]
    with db(w).connection() as conn:
        assert notify_matrix.pending(conn) == 1
    clock.local(w, 2, 8, 59)
    assert tick(w) == 0
    clock.local(w, 2, 9, 0)
    assert tick(w) == 1
    rows = notes(w, "ticket.digest")
    assert len(rows) == 3 and rows[1]["state"] == "resolved", "one live digest per department and recipient"


def test_recipients_per_department_respect_visibility(w, clock):
    digest_on(w, {MAINT: {"ticket.new_unassigned": "digest"}},
              departments={MAINT: {"recipients": {"managers": False, "users": ["dev-alda", "dev-vic"], "roles": ["tickets_manage"]}}})
    clock.local(w, 1, 6, 0)
    w.create("nora", "א")
    clock.local(w, 1, 8, 0)
    tick(w)
    to = sorted(r["to"][0] for r in notes(w, "ticket.digest"))
    assert "dev-alda" in to, "a named user who sees the ticket"
    assert "dev-vic" not in to, "a named user who may not see the ticket gets nothing"
    assert "dev-mona" in to, "mona holds the named role (and manages the department)"
    assert all(len(r["to"]) == 1 for r in notes(w, "ticket.digest"))


def test_an_assignee_event_reaches_the_assignees_own_digest(w, clock):
    digest_on(w, {MAINT: {"ticket.assigned": "digest"}})
    clock.local(w, 1, 6, 0)
    t = w.create("nora", "א")
    assert w.assign("mona", t["id"], "tom").status_code == 200
    assert notes(w, "ticket.assigned") == []
    clock.local(w, 1, 8, 0)
    assert tick(w) == 1
    assert [r["to"] for r in notes(w, "ticket.digest")] == [["dev-tom"]]


def test_urgent_events_go_at_once_unless_the_sla_policy_says_otherwise(w):
    assert put(w, {"notify": {"matrix_enabled": True, "matrix": {MAINT: {"ticket.new_unassigned": "off", "ticket.stuck": "off"}}}}).status_code == 200
    w.create("nora", "רגיל")
    assert notes(w, "ticket.new_unassigned") == []
    w.create("nora", "דחוף", priority_id=URGENT)
    assert len(notes(w, "ticket.new_unassigned")) == 1, "an urgent ticket passes the matrix (installation default)"
    with db(w).connection() as conn:
        row = {"department_id": MAINT, "priority_id": "prio-maintenance-normal"}
        assert notify_matrix.decide(conn, row, "ticket.stuck") == "now", "an SLA crossing is urgent"
        assert notify_matrix.decide(conn, row, "ticket.new_unassigned") == "off"
    assert put(w, {"notify": {"sla_urgent": {f"{MAINT}/{URGENT}": "matrix"}}}).status_code == 200
    w.create("nora", "דחוף 2", priority_id=URGENT)
    assert len(notes(w, "ticket.new_unassigned")) == 1, "this SLA policy follows the matrix"
    assert put(w, {"notify": {"urgent_immediate": False, "sla_urgent": {f"{MAINT}/prio-maintenance-normal": "immediate"}}}).status_code == 200
    with db(w).connection() as conn:
        assert notify_matrix.decide(conn, {"department_id": MAINT, "priority_id": "prio-maintenance-normal"}, "ticket.stuck") == "now"
        assert notify_matrix.decide(conn, {"department_id": MAINT, "priority_id": "prio-maintenance-low"}, "ticket.stuck") == "off"


def test_a_failed_digest_sends_its_events_at_once(w, clock, monkeypatch):
    digest_on(w, {MAINT: {"ticket.new_unassigned": "digest"}})
    clock.local(w, 1, 6, 0)
    w.create("nora", "א")
    monkeypatch.setattr(notify_matrix, "_emit_digest", lambda *a, **k: False)
    clock.local(w, 1, 8, 0)
    assert tick(w) == 0
    assert [n["to"] for n in notes(w, "ticket.new_unassigned")] == [["dev-mona"]], "nothing lost: the original event went at once"
    with db(w).connection() as conn:
        assert notify_matrix.pending(conn) == 0


def test_turning_the_digest_off_releases_what_is_held(w, clock):
    digest_on(w, {MAINT: {"ticket.new_unassigned": "digest"}})
    clock.local(w, 1, 6, 0)
    w.create("nora", "א")
    assert put(w, {"notify": {"digest_enabled": False}}).status_code == 200
    clock.local(w, 1, 6, 1)
    assert tick(w) == 1, "released at the next step, not at 08:00"
    with db(w).connection() as conn:
        assert notify_matrix.pending(conn) == 0


def test_a_full_queue_sends_at_once(w, monkeypatch):
    digest_on(w, {MAINT: {"ticket.new_unassigned": "digest"}})
    monkeypatch.setattr(notify_matrix, "QUEUE_MAX", 1)
    w.create("nora", "א")
    w.create("nora", "ב")
    assert len(notes(w, "ticket.new_unassigned")) == 1


def test_department_channel_override(w):
    base = {"webpush": True, "email": False, "app": True, "whatsapp": False}
    n = {"source": "ticket.done", "origin": {"department_id": MAINT}}
    avail = frozenset({"webpush", "email", "app"})
    assert put(w, {"notify": {"departments": {"*": {"channels": {"push": "off"}}, MAINT: {"channels": {"email": "on", "whatsapp": "on"}}}}}).status_code == 200
    with db(w).connection() as conn:
        assert notify_matrix.channels_for(conn, n, base, avail) == base, "the matrix is off: unchanged"
    assert put(w, {"notify": {"matrix_enabled": True}}).status_code == 200
    with db(w).connection() as conn:
        out = notify_matrix.channels_for(conn, n, base, avail)
        assert out == {"webpush": False, "email": True, "app": False, "whatsapp": False}, "push off from '*', e-mail on; WhatsApp not available"
        assert notify_matrix.channels_for(conn, {"source": "camera.offline", "origin": {}}, base, avail) == base


def test_validation_and_permission(w):
    bad = [{"notify": {"matrix": {MAINT: {"ticket.nope": "off"}}}},
           {"notify": {"matrix": {MAINT: {"ticket.done": "later"}}}},
           {"notify": {"matrix": {"bad id!": {"ticket.done": "off"}}}},
           {"notify": {"matrix": {MAINT: {"ticket.channel_down": "off"}}}},
           {"notify": {"digest_time": "25:00"}}, {"notify": {"digest_time": "8am"}}, {"notify": {"matrix_enabled": "yes"}},
           {"notify": {"extra": 1}},
           {"notify": {"departments": {"*": {"digest_time": "09:00"}}}},
           {"notify": {"departments": {MAINT: {"digest_time": "9"}}}},
           {"notify": {"departments": {MAINT: {"channels": {"sms": "on"}}}}},
           {"notify": {"departments": {MAINT: {"recipients": {"users": ["bad id!"]}}}}},
           {"notify": {"departments": {MAINT: {"recipients": {"managers": "yes"}}}}},
           {"notify": {"departments": {MAINT: {"other": 1}}}},
           {"notify": {"sla_urgent": {MAINT: "immediate"}}},
           {"notify": {"sla_urgent": {f"{MAINT}/{URGENT}": "always"}}},
           {"notify": {"urgent_immediate": "no"}}]
    for patch in bad:
        r = put(w, patch)
        assert r.status_code in (400, 422), (patch, r.status_code)
    r = put(w, {"notify": {"matrix": {MAINT: {"ticket.assigned": "digest", "ticket.done": "now"}}}})
    assert r.status_code == 200 and r.json()["notify"]["matrix"] == {MAINT: {"ticket.assigned": "digest", "ticket.done": "now"}}
    r = put(w, {"notify": {"matrix": {"*": {"ticket.done": "now"}}}})
    assert r.status_code == 200 and r.json()["notify"]["matrix"] == {}, "under '*' 'now' is the default and is not stored"
    r = put(w, {"notify": {"departments": {MAINT: {"digest_time": "07:30", "channels": {"push": "inherit", "email": "off"},
                                                   "recipients": {"users": ["dev-alda", "dev-alda"]}}}}})
    assert r.status_code == 200, r.text
    assert r.json()["notify"]["departments"] == {MAINT: {"digest_time": "07:30", "channels": {"email": "off"},
                                                         "recipients": {"managers": True, "users": ["dev-alda"], "roles": []}}}
    assert put(w, {"notify": {"matrix_enabled": True}}, user="nora").status_code in (401, 403)
    assert w.c.get(f"{API}/tickets/settings/notify-matrix", headers=w.h("nora")).status_code in (401, 403)
    with db(w).connection() as conn:
        a = conn.execute("SELECT details_json FROM audit_log WHERE action = 'tickets.settings.update' ORDER BY rowid DESC LIMIT 1").fetchone()
    assert a is not None and "notify.departments" in a[0]


def test_meta_lists_what_the_screen_needs(w):
    meta = w.c.get(f"{API}/tickets/settings/notify-matrix", headers=w.h("joni")).json()
    maint = next(d for d in meta["departments"] if d["id"] == MAINT)
    assert {p["id"] for p in maint["priorities"]} >= {URGENT, "prio-maintenance-normal"}
    assert any(u["id"] == "dev-mona" for u in meta["users"]) and any(r["id"] == "tickets_manage" for r in meta["roles"])
    assert "push" in meta["channels"]
    src = {s["key"]: s for s in meta["sources"]}
    assert src["ticket.assigned"]["assignee"] and src["ticket.assigned"]["digest"] and src["ticket.stuck"]["sla"]


def test_source_catalogue():
    assert "ticket.new_unassigned" in notify_matrix.MATRIX_SOURCES and "ticket.channel_down" not in notify_matrix.MATRIX_SOURCES
    assert "ticket.assigned" in notify_matrix.DIGESTABLE and "ticket.reminder" in notify_matrix.ASSIGNEE_SOURCES
    assert not any(k.startswith("rfq.") for k in notify_matrix.MATRIX_SOURCES)
    assert set(notify_matrix.MATRIX_SOURCES) <= set(notify_bridge.TEMPLATES), "every held event can be sent at once"
