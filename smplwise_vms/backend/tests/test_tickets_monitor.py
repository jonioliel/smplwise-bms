"""CR-038 slice 6 - the SLA monitor and the CR-018 bridge, end to end on the real database with a fake clock:

- the monitor's look: the 'stuck' / 'reminder' / 'manager_alerted' timeline rows, the bookkeeping columns, no revision move;
- the notifications: `ticket.new_unassigned` to the notify_new manager, `ticket.assigned` to the assignee (resolved when acknowledged),
  `ticket.reminder`, `ticket.stuck` to the department's managers, `ticket.returned`, `ticket.done`; every row reaches only users who may
  SEE the ticket (access.visible through notify_visibility), and the texts carry the configured module name (D33), never the title;
- D28: an urgent ticket is `critical` by default, capped at `alert` by the installation setting or a department override;
- progress resolves the stuck alert; closing resolves everything; D10 automatic close after N days (and not after a manager's reopen);
- the tick: module off = idle, a changed ticket is looked at again, throttling;
- the bypass guard: only the monitor and the bridge read ticket rows as the system."""
from __future__ import annotations

import datetime as dt
import re
from pathlib import Path

import pytest

from smplwise.db import Database
from smplwise.services import notify_policy
from smplwise.services.tickets import monitor, notify_bridge, stuck
from tickets_world import API, MAINT, build

SMPLWISE = Path(__file__).resolve().parents[1] / "smplwise"


@pytest.fixture()
def w(settings):
    return build(settings)


def db(w) -> Database:
    return Database(w.settings.db_path)


def now_of(ticket: dict, minutes: float) -> dt.datetime:
    return (stuck.parse(ticket["created_at"]) or dt.datetime.now(dt.timezone.utc)) + dt.timedelta(minutes=minutes)


def look(w, tid: str, at: dt.datetime) -> stuck.Plan | None:
    with db(w).connection() as conn:
        return monitor.look(conn, tid, at)


def notes(w, source: str | None = None, tid: str | None = None) -> list[dict]:
    with db(w).connection() as conn:
        sql = "SELECT * FROM notifications WHERE 1 = 1"
        args: list = []
        if source:
            sql += " AND source = ?"
            args.append(source)
        if tid:
            sql += " AND subject_id = ?"
            args.append(tid)
        rows = [dict(r) for r in conn.execute(sql + " ORDER BY created_at, id", args).fetchall()]
        for r in rows:
            r["to"] = sorted(x[0] for x in conn.execute("SELECT user_id FROM notification_recipients WHERE notification_id = ?", (r["id"],)).fetchall())
        return rows


def events(w, tid: str, kind: str) -> list[dict]:
    with db(w).connection() as conn:
        return [dict(r) for r in conn.execute("SELECT * FROM ticket_events WHERE ticket_id = ? AND kind = ? ORDER BY id", (tid, kind)).fetchall()]


def priority(w, key: str) -> str:
    with db(w).connection() as conn:
        return conn.execute("SELECT id FROM ticket_priorities WHERE department_id = ? AND key = ?", (MAINT, key)).fetchone()[0]


# ---------------------------------------------------------------- the bridge's hooks

def test_a_new_unassigned_ticket_tells_the_notify_new_manager_only(w):
    t = w.create("nora", "שקע שרוף")
    rows = notes(w, "ticket.new_unassigned", t["id"])
    assert len(rows) == 1
    n = rows[0]
    assert n["to"] == ["dev-mona"], "mona is the first (notify_new) manager of maintenance"
    assert n["category"] == "tickets" and n["subject_kind"] == "ticket" and n["link"] == f"#/tickets/{t['id']}"
    assert f"#{t['number']}" in n["title"] and "שקע" not in n["title"] + n["body"], "number and place only, never the typed title"


def test_assignment_notifies_the_assignee_and_acknowledge_resolves_it(w):
    t = w.create("mona", "מזגן")
    assert w.assign("mona", t["id"], "tom").status_code == 200
    rows = notes(w, "ticket.assigned", t["id"])
    assert len(rows) == 1 and rows[0]["to"] == ["dev-tom"] and rows[0]["state"] == "open"
    assert notes(w, "ticket.new_unassigned", t["id"])[0]["state"] == "resolved", "the managers' 'unassigned' row is over"
    assert w.status("tom", t["id"], "acknowledged").status_code == 200
    assert notes(w, "ticket.assigned", t["id"])[0]["state"] == "resolved"


def test_returned_and_done_reach_the_managers(w):
    t = w.create("mona", "דלת")
    w.assign("mona", t["id"], "tom")
    rev = w.detail(t["id"])["revision"]
    r = w.c.post(f"{API}/tickets/{t['id']}/return", json={"kind": "not_mine", "reason": "סוד פרטי", "revision": rev}, headers=w.h("tom"))
    assert r.status_code == 200, r.text
    rows = notes(w, "ticket.returned", t["id"])
    assert len(rows) == 1 and rows[0]["to"] == ["dev-mona"] and "לא שלי" in rows[0]["body"] and "סוד" not in rows[0]["body"]
    w.assign("mona", t["id"], "tom")
    assert notes(w, "ticket.returned", t["id"])[0]["state"] == "resolved"
    w.status("tom", t["id"], "in_progress")
    w.status("tom", t["id"], "done")
    done = notes(w, "ticket.done", t["id"])
    assert len(done) == 1 and done[0]["to"] == ["dev-mona"] and done[0]["severity"] == "info"
    assert w.status("mona", t["id"], "closed").status_code == 200
    assert all(n["state"] == "resolved" for n in notes(w, tid=t["id"])), "closing resolves every row of the ticket"


def test_notifications_reach_only_users_who_may_see_the_ticket(w):
    """A department manager whose tickets.view is denied gets nothing, even as a manager member (visibility is the ceiling)."""
    w.member(MAINT, "dina", "manager")
    with db(w).connection() as conn:
        conn.execute("UPDATE ticket_department_members SET notify_new = 1 WHERE department_id = ?", (MAINT,))
    t = w.create("mona", "תאורה")
    rows = notes(w, "ticket.new_unassigned", t["id"])
    assert rows and "dev-dina" not in rows[0]["to"] and "dev-mona" in rows[0]["to"]
    with db(w).connection() as conn:
        from smplwise.services.notify_visibility import Reach, principal_of

        n = conn.execute("SELECT * FROM notifications WHERE id = ?", (rows[0]["id"],)).fetchone()
        assert Reach(conn, principal_of(conn, "dev-mona")).can_see(dict(n))
        assert not Reach(conn, principal_of(conn, "dev-cleo")).can_see(dict(n)), "a manager of another department"
        assert not Reach(conn, principal_of(conn, "dev-dina")).can_see(dict(n)), "a deny binding"


def test_the_names_follow_a_rename(w):
    name = {"he": {"one": "פנייה", "many": "פניות", "gender": "f"}, "revision": 0}
    assert w.c.put(f"{API}/tickets/name", json=name).status_code == 200
    t = w.create("nora", "x")
    n = notes(w, "ticket.new_unassigned", t["id"])[0]
    assert n["title"].startswith("פנייה חדשה"), n["title"]


def test_d28_urgent_is_critical_by_default_and_capped_by_the_settings(w):
    t = w.create("nora", "הצפה", priority_id=priority(w, "urgent"))
    assert notes(w, "ticket.new_unassigned", t["id"])[0]["severity"] == "critical"
    rev = w.c.get(f"{API}/tickets/settings").json()["revision"]
    r = w.c.put(f"{API}/tickets/settings", json={"revision": rev, "urgent_is_critical": False})
    assert r.status_code == 200 and r.json()["urgent_is_critical"] is False
    t2 = w.create("nora", "הצפה 2", priority_id=priority(w, "urgent"))
    assert notes(w, "ticket.new_unassigned", t2["id"])[0]["severity"] == "alert"
    with db(w).connection() as conn:
        conn.execute("UPDATE ticket_departments SET urgent_is_critical = 1 WHERE id = ?", (MAINT,))
    t3 = w.create("nora", "הצפה 3", priority_id=priority(w, "urgent"))
    assert notes(w, "ticket.new_unassigned", t3["id"])[0]["severity"] == "critical", "the department override wins"


def test_the_policy_matrix_lists_the_ticket_sources_only_while_the_module_is_on(w):
    keys = {p["source"] for p in w.c.get(f"{API}/notify/policies").json()["policies"]}
    assert {"ticket.stuck", "ticket.reminder", "ticket.channel_down"} <= keys
    w.c.patch(f"{API}/settings", json={"tickets.enabled": "false"})
    keys = {p["source"] for p in w.c.get(f"{API}/notify/policies").json()["policies"]}
    assert not any(k.startswith("ticket.") for k in keys)
    assert "tickets" in notify_policy.CATEGORIES and "ticket" in notify_policy.SUBJECT_KINDS


# ---------------------------------------------------------------- the monitor

def test_unassigned_ticket_alerts_all_managers_after_the_threshold(w):
    t = w.create("nora", "x")  # normal priority: unassigned after 4 h
    assert look(w, t["id"], now_of(t, 239)).actions == []
    p = look(w, t["id"], now_of(t, 241))
    assert p.actions == ["started", "alert"]
    rows = notes(w, "ticket.stuck", t["id"])
    assert len(rows) == 1 and rows[0]["to"] == ["dev-mona"] and "אין מטפל" in rows[0]["body"]
    d = w.detail(t["id"], "mona")
    assert d["revision"] == t["revision"], "the monitor never moves the revision"
    assert [e["data"]["kind"] for e in [x for x in d["events"] if x["kind"] == "stuck"]] == ["unassigned"]
    assert look(w, t["id"], now_of(t, 300)).actions == [], "idempotent"
    assert len(events(w, t["id"], "manager_alerted")) == 1


def test_internal_assignee_ladder_reminds_then_alerts_and_progress_resolves(w):
    t = w.create("mona", "y")
    w.assign("mona", t["id"], "tom")
    w.status("tom", t["id"], "acknowledged")
    start = stuck.parse(w.detail(t["id"])["last_activity_at"])
    day = 24 * 60
    # normal: stuck after 3 days, remind every 1 day, 2 reminders, managers after 1 step
    p = look(w, t["id"], start + dt.timedelta(minutes=3 * day + 1))
    assert p.actions == ["started", "remind"]
    rem = notes(w, "ticket.reminder", t["id"])
    assert len(rem) == 1 and rem[0]["to"] == ["dev-tom"]
    p = look(w, t["id"], start + dt.timedelta(minutes=4 * day + 2))
    assert p.actions == ["remind", "alert"]
    stuck_rows = notes(w, "ticket.stuck", t["id"])
    assert len(stuck_rows) == 1 and stuck_rows[0]["to"] == ["dev-mona"]
    with db(w).connection() as conn:
        r = conn.execute("SELECT stuck_kind, stuck_level, reminders_sent, next_check_at FROM tickets WHERE id = ?", (t["id"],)).fetchone()
        assert (r["stuck_kind"], r["stuck_level"], r["reminders_sent"]) == ("stuck", 2, 2) and r["next_check_at"]
    assert w.c.post(f"{API}/tickets/{t['id']}/notes", json={"text": "בדרך"}, headers=w.h("tom")).status_code == 201
    noted = stuck.parse(w.detail(t["id"])["last_activity_at"])
    p = look(w, t["id"], noted + dt.timedelta(minutes=5))  # progress: "stuck" now counts from the note
    assert p.ended_kind == "stuck"
    assert all(n["state"] == "resolved" for n in notes(w, "ticket.stuck", t["id"]) + notes(w, "ticket.reminder", t["id"]))


def test_auto_close_after_n_days_and_a_reopen_cancels_it(w):
    with db(w).connection() as conn:
        conn.execute("UPDATE ticket_departments SET auto_close_after_days = 2 WHERE id = ?", (MAINT,))
    t = w.create("mona", "z")
    w.assign("mona", t["id"], "tom")
    w.status("tom", t["id"], "in_progress")
    w.status("tom", t["id"], "done")
    done_at = stuck.parse(w.detail(t["id"])["last_activity_at"])
    with db(w).connection() as conn:
        assert not monitor.auto_close(conn, t["id"], done_at + dt.timedelta(days=1))
    with db(w).connection() as conn:
        assert monitor.auto_close(conn, t["id"], done_at + dt.timedelta(days=2, minutes=1))
    d = w.detail(t["id"])
    assert d["status"] == "closed" and any(e["kind"] == "auto_closed" and e["actor"]["kind"] == "system" for e in d["events"])
    assert notes(w, "ticket.done", t["id"])[0]["state"] == "resolved"
    t2 = w.create("mona", "z2")
    w.assign("mona", t2["id"], "tom")
    w.status("tom", t2["id"], "in_progress")
    w.status("tom", t2["id"], "done")
    w.status("mona", t2["id"], "in_progress", note="לא גמור")
    with db(w).connection() as conn:
        assert not monitor.auto_close(conn, t2["id"], dt.datetime.now(dt.timezone.utc) + dt.timedelta(days=5))
    assert w.detail(t2["id"])["status"] == "in_progress"


def test_the_tick_idles_while_the_module_is_off_and_looks_at_new_tickets(w, monkeypatch):
    t = w.create("nora", "q")
    later = now_of(t, 10)
    monkeypatch.setattr(monitor, "utcnow", lambda: later)
    w.c.patch(f"{API}/settings", json={"tickets.enabled": "false"})
    assert monitor.tick(db(w), force=True) == 0
    w.c.patch(f"{API}/settings", json={"tickets.enabled": "true"})
    assert monitor.tick(db(w), force=True) >= 1
    with db(w).connection() as conn:
        nxt = conn.execute("SELECT next_check_at FROM tickets WHERE id = ?", (t["id"],)).fetchone()[0]
    assert nxt == stuck.iso(stuck.parse(t["created_at"]) + dt.timedelta(minutes=240)), "the next look is the unassigned threshold"
    assert monitor.tick(db(w)) == 0, "throttled to once a minute"


def test_an_external_assignee_without_a_message_channel_escalates_at_the_crossing(w, monkeypatch):
    t = w.create("mona", "ספק")
    with db(w).connection() as conn:
        aid = "asg-ext-1"
        conn.execute("INSERT INTO ticket_assignments(id, ticket_id, assignee_kind, contact_id, assignee_name, channel, assigned_by, assigned_at) "
                     "VALUES (?, ?, 'contact', 'c1', 'ספק', 'manual', 'dev-mona', ?)", (aid, t["id"], t["created_at"]))
        conn.execute("UPDATE tickets SET status = 'assigned', current_assignment_id = ?, waiting_on = 'assignee', waiting_reason = NULL WHERE id = ?", (aid, t["id"]))
    monkeypatch.setattr(monitor, "EXTERNAL_REMINDER", None)
    p = look(w, t["id"], now_of(t, 24 * 60 + 1))  # normal: acknowledge within 1 day
    assert p.actions == ["started", "alert"] and not p.remind
    calls: list = []
    monkeypatch.setattr(monitor, "EXTERNAL_REMINDER", lambda conn, row, n, now: calls.append((row["id"], n)) or True)
    t2 = w.create("mona", "ספק 2")
    with db(w).connection() as conn:
        conn.execute("INSERT INTO ticket_assignments(id, ticket_id, assignee_kind, contact_id, assignee_name, channel, assigned_by, assigned_at) "
                     "VALUES ('asg-ext-2', ?, 'contact', 'c1', 'ספק', 'manual', 'dev-mona', ?)", (t2["id"], t2["created_at"]))
        conn.execute("UPDATE tickets SET status = 'assigned', current_assignment_id = 'asg-ext-2' WHERE id = ?", (t2["id"],))
        conn.execute("INSERT OR REPLACE INTO settings(key, value) VALUES ('time.zone', 'UTC')")
        conn.execute("UPDATE ticket_departments SET send_hours_json = ? WHERE id = ?", ('{"from":"00:00","to":"23:59"}', MAINT))
    p = look(w, t2["id"], now_of(t2, 24 * 60 + 1))
    assert p.remind and calls == [(t2["id"], 1)]


# ---------------------------------------------------------------- guards

def test_only_the_monitor_and_the_bridge_read_tickets_as_the_system():
    allowed = {"services/tickets/store.py", "services/tickets/monitor.py", "services/tickets/notify_bridge.py"}
    offenders = []
    for path in SMPLWISE.rglob("*.py"):
        rel = path.relative_to(SMPLWISE).as_posix()
        if rel in allowed:
            continue
        if re.search(r"\b(ticket_row_system|monitor_rows_system|done_rows_system)\b", path.read_text(encoding="utf-8")):
            offenders.append(rel)
    assert offenders == []


def test_bridge_source_of_key_covers_every_resolvable_prefix():
    for part, src in (("unassigned", "ticket.new_unassigned"), ("assign:a", "ticket.assigned"), ("remind:1", "ticket.reminder"),
                      ("stuck:ack", "ticket.stuck"), ("returned", "ticket.returned"), ("done", "ticket.done"), ("send", "ticket.send_failed"),
                      ("contact", "ticket.contact_changed")):
        assert notify_bridge.source_of_key(f"ticket:t1:{part}") == src
        assert src in notify_policy.BY_KEY
