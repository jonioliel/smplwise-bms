"""TKNOTIFMATRIX - the per-department notification matrix and the daily digest (settings `notify.*`, services/tickets/notify_matrix.py):

- default = today's behaviour: with the matrix off a new ticket notifies exactly as before, whatever the stored cells say;
- a matrix cell "off" silences one source for one department only, "*" is the fallback, a department's own cell wins;
- "digest" holds events (nothing is created) until the digest time, then ONE `ticket.digest` per department reaches its managers with
  counts only (never a typed title); a ticket that closed meanwhile is dropped; the digest runs once per local day;
- "digest" is refused for an assignee source and without a switch it behaves as "now" (an event is never held for a digest not sent);
- validation (422), permission (system.configure) and the audit row of the settings route."""
from __future__ import annotations

import datetime as dt

import pytest

from smplwise.db import Database
from smplwise.services.tickets import notify_matrix
from tickets_world import API, MAINT, build


@pytest.fixture()
def w(settings):
    return build(settings)


def db(w) -> Database:
    return Database(w.settings.db_path)


def put(w, patch: dict, user: str = "joni"):
    rev = w.c.get(f"{API}/tickets/settings", headers=w.h(user)).json()["revision"] if user == "joni" else 0
    return w.c.put(f"{API}/tickets/settings", json={"revision": rev, **patch}, headers=w.h(user))


def notes(w, source: str) -> list[dict]:
    with db(w).connection() as conn:
        rows = [dict(r) for r in conn.execute("SELECT * FROM notifications WHERE source = ? ORDER BY created_at, id", (source,)).fetchall()]
        for r in rows:
            r["to"] = sorted(x[0] for x in conn.execute("SELECT user_id FROM notification_recipients WHERE notification_id = ?", (r["id"],)).fetchall())
        return rows


def test_defaults_change_nothing(w):
    doc = w.c.get(f"{API}/tickets/settings", headers=w.h("joni")).json()["notify"]
    assert doc == {"matrix_enabled": False, "matrix": {}, "digest_enabled": False, "digest_time": "08:00"}
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


def test_digest_holds_then_sends_one_grouped_notification(w):
    assert put(w, {"notify": {"matrix_enabled": True, "digest_enabled": True, "digest_time": "08:00",
                              "matrix": {MAINT: {"ticket.new_unassigned": "digest"}}}}).status_code == 200
    t1 = w.create("nora", "סוד ראשון")
    t2 = w.create("nora", "סוד שני")
    t3 = w.create("nora", "סוד שלישי")
    assert notes(w, "ticket.new_unassigned") == [], "held, nothing created yet"
    assert w.c.get(f"{API}/tickets/settings/notify-matrix", headers=w.h("joni")).json()["pending"] == 3
    with db(w).connection() as conn:  # closes before the digest
        conn.execute("UPDATE tickets SET status = 'cancelled' WHERE id = ?", (t3["id"],))
    now = dt.datetime(2030, 1, 1, 6, 30, tzinfo=dt.timezone.utc)
    with db(w).connection() as conn:
        from smplwise.services.tickets.messaging import time_zone

        local = now.astimezone(time_zone(conn))
    early = notify_matrix.tick(db(w), force=True, now=(local.replace(hour=7, minute=59)).astimezone(dt.timezone.utc))
    assert early == 0 and notes(w, "ticket.digest") == []
    at = local.replace(hour=8, minute=1).astimezone(dt.timezone.utc)
    assert notify_matrix.tick(db(w), force=True, now=at) == 1
    rows = notes(w, "ticket.digest")
    assert len(rows) == 1 and rows[0]["to"] == ["dev-mona"] and rows[0]["category"] == "tickets"
    text = rows[0]["title"] + rows[0]["body"]
    assert "2" in rows[0]["title"] and "סוד" not in text, "counts only, never a typed title"
    assert rows[0]["link"] == "#/tickets"
    assert notify_matrix.tick(db(w), force=True, now=at + dt.timedelta(hours=1)) == 0, "once per local day"
    with db(w).connection() as conn:
        assert notify_matrix.pending(conn) == 0
    assert t1["id"] and t2["id"]


def test_validation_and_permission(w):
    bad = [{"notify": {"matrix": {MAINT: {"ticket.assigned": "digest"}}}},      # an assignee source cannot be digested
           {"notify": {"matrix": {MAINT: {"ticket.nope": "off"}}}},
           {"notify": {"matrix": {MAINT: {"ticket.done": "later"}}}},
           {"notify": {"matrix": {"bad id!": {"ticket.done": "off"}}}},
           {"notify": {"matrix": {MAINT: {"ticket.channel_down": "off"}}}},
           {"notify": {"digest_time": "25:00"}}, {"notify": {"digest_time": "8am"}}, {"notify": {"matrix_enabled": "yes"}},
           {"notify": {"extra": 1}}]
    for patch in bad:
        r = put(w, patch)
        assert r.status_code in (400, 422), (patch, r.status_code)
    r = put(w, {"notify": {"matrix": {MAINT: {"ticket.assigned": "off", "ticket.done": "now"}}}})
    assert r.status_code == 200 and r.json()["notify"]["matrix"] == {MAINT: {"ticket.assigned": "off", "ticket.done": "now"}}
    r = put(w, {"notify": {"matrix": {"*": {"ticket.done": "now"}}}})
    assert r.status_code == 200 and r.json()["notify"]["matrix"] == {}, "under '*' 'now' is the default and is not stored"
    assert put(w, {"notify": {"matrix_enabled": True}}, user="nora").status_code in (401, 403)
    assert w.c.get(f"{API}/tickets/settings/notify-matrix", headers=w.h("nora")).status_code in (401, 403)
    with db(w).connection() as conn:
        a = conn.execute("SELECT details_json FROM audit_log WHERE action = 'tickets.settings.update' ORDER BY rowid DESC LIMIT 1").fetchone()
    assert a is not None and "notify.matrix" in a[0]


def test_source_catalogue():
    assert "ticket.new_unassigned" in notify_matrix.MATRIX_SOURCES and "ticket.channel_down" not in notify_matrix.MATRIX_SOURCES
    assert "ticket.assigned" not in notify_matrix.DIGESTABLE and "ticket.stuck" in notify_matrix.DIGESTABLE
    assert not any(k.startswith("rfq.") for k in notify_matrix.MATRIX_SOURCES)
