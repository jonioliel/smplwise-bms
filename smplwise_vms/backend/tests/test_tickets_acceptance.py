"""CR-ACCEPT102 slice 1 - smart acceptance of vendor work (temperature unit back in range), on the real database with an injected clock:

- default off (switch) and opt-in per category; no device link -> not eligible; module off -> idle;
- the hold lasts exactly the configured time (not a minute less), then the system closes the ticket (`auto_closed`, data.by = acceptance);
- a breach (high / low / offline alert row) fails per the rule: flag (ticket stays done, managers alerted, automatic close blocked), reopen
  (done -> in_progress by the system), restart (the clock restarts, bounded);
- an unhealthy unit at the start waits, and times out after the grace; the clock is stored in the row (a new Database object = a restart);
- a person's confirm / reopen always wins."""
from __future__ import annotations

import datetime as dt

import pytest

from smplwise.db import Database
from smplwise.services.tickets import acceptance, monitor, stuck
from tickets_world import API, MAINT, build

UNIT = "unit-fridge-1"
CAT = "cat-fridge"
H = dt.timedelta(hours=1)
M = dt.timedelta(minutes=1)


@pytest.fixture()
def w(settings):
    world = build(settings)
    with db(world).connection() as conn:
        conn.execute("INSERT INTO infra_temp_units(id, name, name_key, temp_entity_id, low, high, created_at, updated_at) VALUES (?,?,?,?,?,?,?,?)",
                     (UNIT, "מקרר 1", "מקרר 1", "sensor.fridge_1", 2.0, 8.0, "2026-01-01T00:00:00Z", "2026-01-01T00:00:00Z"))
        conn.execute("INSERT INTO ticket_categories(id, department_id, name) VALUES (?,?,?)", (CAT, MAINT, "קירור"))
    return world


def db(w) -> Database:
    return Database(w.settings.db_path)


def configure(w, **kw) -> None:
    cols = {"enabled": 1, "categories_json": f'["{CAT}"]', **kw}
    with db(w).connection() as conn:
        conn.execute("UPDATE ticket_acceptance_settings SET " + ", ".join(f"{k} = ?" for k in cols) + " WHERE id = 1", list(cols.values()))


def done_ticket(w, *, link: bool = True, category: str | None = CAT) -> tuple[str, dt.datetime]:
    t = w.create("mona", "מקרר לא מקרר")
    w.assign("mona", t["id"], "tom")
    assert w.status("tom", t["id"], "in_progress").status_code == 200
    assert w.status("tom", t["id"], "done").status_code == 200
    with db(w).connection() as conn:
        if category:
            conn.execute("UPDATE tickets SET category_id = ? WHERE id = ?", (category, t["id"]))
        if link:
            conn.execute("INSERT INTO infra_temp_tickets(ticket_id, unit_id, created_at) VALUES (?,?,?)", (t["id"], UNIT, "2026-01-01T00:00:00Z"))
        done_at = stuck.parse(conn.execute("SELECT done_at FROM tickets WHERE id = ?", (t["id"],)).fetchone()[0])
    assert done_at is not None
    return t["id"], done_at


def sample(w, at: dt.datetime) -> None:
    with db(w).connection() as conn:
        conn.execute("INSERT OR REPLACE INTO infra_temp_samples(unit_id, ts, v) VALUES (?,?,?)", (UNIT, int(at.timestamp()), 4.0))


def event(w, kind: str, started: dt.datetime, ended: dt.datetime | None = None, eid: str | None = None) -> str:
    eid = eid or f"ev-{kind}-{int(started.timestamp())}"
    with db(w).connection() as conn:
        conn.execute("INSERT INTO infra_temp_events(id, unit_id, kind, severity, started_at, ended_at) VALUES (?,?,?,?,?,?)",
                     (eid, UNIT, kind, "warning", stuck.iso(started), stuck.iso(ended) if ended else None))
    return eid


def run(w, at: dt.datetime, *, fresh: bool = True) -> dict:
    if fresh:
        sample(w, at)  # the unit reports every minute while it is alive
    return acceptance.run(db(w), at)


def row(w, tid: str) -> dict | None:
    with db(w).connection() as conn:
        r = conn.execute("SELECT * FROM ticket_acceptance WHERE ticket_id = ?", (tid,)).fetchone()
        return dict(r) if r else None


def status(w, tid: str) -> str:
    return w.detail(tid)["status"]


def kinds(w, tid: str) -> list[str]:
    with db(w).connection() as conn:
        return [r[0] for r in conn.execute("SELECT kind FROM ticket_events WHERE ticket_id = ? ORDER BY id", (tid,)).fetchall()]


def alerts(w, tid: str) -> list[dict]:
    with db(w).connection() as conn:
        return [dict(r) for r in conn.execute("SELECT * FROM notifications WHERE source = 'ticket.stuck' AND subject_id = ?", (tid,)).fetchall()]


# ---------------------------------------------------------------- gating

def test_default_is_off_and_nothing_starts(w):
    with db(w).connection() as conn:
        assert acceptance.load_settings(conn).enabled is False
    tid, d = done_ticket(w)
    assert run(w, d + M) == {}
    assert row(w, tid) is None and status(w, tid) == "done"


def test_category_must_be_opted_in(w):
    configure(w, categories_json="[]")
    tid, d = done_ticket(w)
    run(w, d + M)
    assert row(w, tid) is None
    configure(w, categories_json='["some-other-category"]')
    run(w, d + 2 * M)
    assert row(w, tid) is None


def test_ticket_without_a_device_link_is_not_eligible(w):
    configure(w)
    tid, d = done_ticket(w, link=False)
    run(w, d + M)
    run(w, d + 25 * H)
    assert row(w, tid) is None and status(w, tid) == "done"
    tid2, d2 = done_ticket(w, category=None)  # linked but no category -> not opted in
    run(w, d2 + M)
    assert row(w, tid2) is None


def test_disabled_unit_is_not_eligible(w):
    configure(w)
    tid, d = done_ticket(w)
    with db(w).connection() as conn:
        conn.execute("UPDATE infra_temp_units SET enabled = 0 WHERE id = ?", (UNIT,))
    run(w, d + M)
    assert row(w, tid) is None


def test_module_off_idles_the_whole_step(w):
    configure(w)
    tid, d = done_ticket(w)
    assert w.c.patch(f"{API}/settings", json={"tickets.enabled": "false"}).status_code == 200
    assert run(w, d + M) == {} and row(w, tid) is None
    with db(w).connection() as conn:
        assert acceptance.blocks_auto_close(conn, tid) is False


# ---------------------------------------------------------------- the hold

def test_hold_lasts_exactly_the_configured_time_then_the_system_confirms(w):
    configure(w, hold_minutes=1440)
    tid, d = done_ticket(w)
    run(w, d + M)
    r = row(w, tid)
    assert r["state"] == "holding" and r["hold_start"] == stuck.iso(d) and r["hold_until"] == stuck.iso(d + 24 * H)
    run(w, d + 24 * H - M)
    assert status(w, tid) == "done" and row(w, tid)["state"] == "holding", "one minute short: still waiting"
    out = run(w, d + 24 * H)
    assert out.get("accepted") == 1
    assert status(w, tid) == "closed" and row(w, tid)["state"] == "accepted"
    ev = [e for e in w.detail(tid)["events"] if e["kind"] == "auto_closed"]
    assert len(ev) == 1 and ev[0]["actor"]["kind"] == "system"
    assert "acceptance_started" in kinds(w, tid) and "acceptance_hold_started" in kinds(w, tid)
    run(w, d + 25 * H)  # idempotent: nothing more happens
    assert kinds(w, tid).count("auto_closed") == 1


def test_a_shorter_configured_hold_is_honoured(w):
    configure(w, hold_minutes=60)
    tid, d = done_ticket(w)
    run(w, d + M)
    run(w, d + H - M)
    assert status(w, tid) == "done"
    run(w, d + H)
    assert status(w, tid) == "closed"


def test_restart_persistence_the_clock_lives_in_the_row(w):
    configure(w, hold_minutes=120)
    tid, d = done_ticket(w)
    run(w, d + M)
    before = row(w, tid)
    for k in list(acceptance.STATS):  # a new process: no in-memory state at all
        acceptance.STATS[k] = 0
    run(w, d + 119 * M)
    assert row(w, tid)["hold_until"] == before["hold_until"] and status(w, tid) == "done"
    run(w, d + 120 * M)
    assert status(w, tid) == "closed"


def test_the_departments_own_auto_close_waits_for_the_hold(w):
    configure(w, hold_minutes=3000)  # longer than the department's 1 day
    with db(w).connection() as conn:
        conn.execute("UPDATE ticket_departments SET auto_close_after_days = 1 WHERE id = ?", (MAINT,))
    tid, d = done_ticket(w)
    run(w, d + M)
    with db(w).connection() as conn:
        assert monitor.auto_close(conn, tid, d + 2 * dt.timedelta(days=1)) is False
    assert status(w, tid) == "done"


# ---------------------------------------------------------------- breach

def test_breach_flags_by_default_and_keeps_the_ticket_done_for_a_person(w):
    configure(w)
    tid, d = done_ticket(w)
    run(w, d + M)
    eid = event(w, "high", d + 2 * H)
    out = run(w, d + 3 * H)
    assert out.get("flagged") == 1
    r = row(w, tid)
    assert r["state"] == "flagged" and r["outcome"] == "breach" and r["breach_event_id"] == eid
    assert status(w, tid) == "done" and "acceptance_flagged" in kinds(w, tid)
    assert any(n["state"] != "resolved" for n in alerts(w, tid)), "the department managers are alerted"
    with db(w).connection() as conn:
        conn.execute("UPDATE ticket_departments SET auto_close_after_days = 1 WHERE id = ?", (MAINT,))
        assert acceptance.blocks_auto_close(conn, tid) is True
        assert monitor.auto_close(conn, tid, d + dt.timedelta(days=9)) is False
    run(w, d + 30 * H)
    assert status(w, tid) == "done" and row(w, tid)["state"] == "flagged", "a flag waits for a person, it never closes by itself"


def test_a_breach_that_already_ended_still_fails_the_hold(w):
    configure(w)
    tid, d = done_ticket(w)
    run(w, d + M)
    event(w, "low", d + 2 * H, d + 2 * H + 10 * M)
    run(w, d + 3 * H)
    assert row(w, tid)["state"] == "flagged"


def test_breach_reopens_when_the_rule_says_so(w):
    configure(w, on_breach="reopen")
    tid, d = done_ticket(w)
    run(w, d + M)
    event(w, "offline", d + 5 * H)
    out = run(w, d + 6 * H)
    assert out.get("reopened") == 1
    assert status(w, tid) == "in_progress" and row(w, tid)["state"] == "reopened"
    with db(w).connection() as conn:
        t = dict(conn.execute("SELECT done_at, waiting_on FROM tickets WHERE id = ?", (tid,)).fetchone())
    assert t["done_at"] is None and t["waiting_on"] == "assignee"
    assert any(e["kind"] == "status" and e["actor"]["kind"] == "system" for e in w.detail(tid)["events"])


def test_reopen_without_an_assignee_falls_back_to_a_flag(w):
    configure(w, on_breach="reopen")
    tid, d = done_ticket(w)
    with db(w).connection() as conn:
        conn.execute("UPDATE ticket_assignments SET ended_at = ? WHERE id = (SELECT current_assignment_id FROM tickets WHERE id = ?)", (stuck.iso(d), tid))
    run(w, d + M)
    event(w, "high", d + 2 * H)
    run(w, d + 3 * H)
    assert row(w, tid)["state"] == "flagged" and status(w, tid) == "done"


def test_restart_resets_the_clock_after_the_unit_recovers_and_is_bounded(w):
    configure(w, on_breach="restart", hold_minutes=600, max_restarts=1)
    tid, d = done_ticket(w)
    run(w, d + M)
    event(w, "high", d + 2 * H, d + 3 * H)
    run(w, d + 150 * M)  # 2.5 h: breach seen -> back to pending
    r = row(w, tid)
    assert r["state"] == "pending" and r["restarts"] == 1
    run(w, d + 210 * M)  # 3.5 h: healthy again; the new hold starts when the alert row ENDED (3 h), never earlier
    r = row(w, tid)
    assert r["state"] == "holding" and r["hold_start"] == stuck.iso(d + 3 * H) and r["hold_until"] == stuck.iso(d + 13 * H)
    run(w, d + 13 * H - M)
    assert status(w, tid) == "done"
    event(w, "low", d + 14 * H - 5 * M)  # a second breach, but restarts are exhausted (max 1)
    run(w, d + 14 * H)
    assert row(w, tid)["state"] == "flagged" and status(w, tid) == "done"


def test_breach_that_ended_exactly_when_the_hold_started_does_not_count(w):
    configure(w, hold_minutes=60)
    tid, d = done_ticket(w)
    event(w, "high", d - H, d + 5 * M)  # the fix: the alert row ends 5 minutes after "done"
    run(w, d + 6 * M)
    assert row(w, tid)["hold_start"] == stuck.iso(d + 5 * M)
    run(w, d + 65 * M)
    assert status(w, tid) == "closed"


# ---------------------------------------------------------------- start

def test_unhealthy_unit_at_the_start_waits_then_times_out(w):
    configure(w, start_grace_minutes=240)
    tid, d = done_ticket(w)
    event(w, "high", d - H)  # still open: the "fix" did not bring it back
    run(w, d + 10 * M)
    assert row(w, tid)["state"] == "pending"
    run(w, d + 239 * M)
    assert row(w, tid)["state"] == "pending"
    run(w, d + 240 * M)
    r = row(w, tid)
    assert r["state"] == "flagged" and r["outcome"] == "start_timeout" and status(w, tid) == "done"


def test_a_unit_that_does_not_report_cannot_be_verified(w):
    configure(w, start_grace_minutes=60)
    tid, d = done_ticket(w)
    run(w, d + 10 * M, fresh=False)
    assert row(w, tid)["state"] == "pending"
    run(w, d + 60 * M, fresh=False)
    assert row(w, tid)["state"] == "flagged"


# ---------------------------------------------------------------- the human wins

def test_manager_confirm_during_the_hold_wins(w):
    configure(w)
    tid, d = done_ticket(w)
    run(w, d + M)
    assert w.status("mona", tid, "closed").status_code == 200
    run(w, d + 25 * H)
    r = row(w, tid)
    assert r["state"] == "overridden" and r["outcome"] == "status_changed:closed"
    assert status(w, tid) == "closed" and kinds(w, tid).count("auto_closed") == 0
    assert "acceptance_overridden" in kinds(w, tid)


def test_manager_reopen_during_the_hold_wins_and_a_new_done_starts_a_new_verification(w):
    configure(w)
    tid, d = done_ticket(w)
    run(w, d + M)
    assert w.status("mona", tid, "in_progress", note="לא תוקן").status_code == 200
    run(w, d + 2 * M)
    assert row(w, tid)["state"] == "overridden" and status(w, tid) == "in_progress"
    assert w.status("tom", tid, "done").status_code == 200
    with db(w).connection() as conn:
        d2 = stuck.parse(conn.execute("SELECT done_at FROM tickets WHERE id = ?", (tid,)).fetchone()[0])
    run(w, d2 + M)
    r = row(w, tid)
    assert r["state"] == "holding" and r["done_at"] == stuck.iso(d2) and r["restarts"] == 0


def test_manager_decision_after_a_flag_is_recorded_as_override(w):
    configure(w)
    tid, d = done_ticket(w)
    run(w, d + M)
    event(w, "high", d + 2 * H)
    run(w, d + 3 * H)
    assert row(w, tid)["state"] == "flagged"
    assert w.status("mona", tid, "closed").status_code == 200
    run(w, d + 4 * H)
    assert row(w, tid)["state"] == "overridden"


def test_a_pending_cost_claim_keeps_the_ticket_open_after_the_hold(w, monkeypatch):
    from smplwise.services.tickets import costs

    configure(w, hold_minutes=60)
    tid, d = done_ticket(w)
    run(w, d + M)
    monkeypatch.setattr(costs, "blocks_close", lambda conn, ticket_id: True)
    run(w, d + 2 * H)
    assert status(w, tid) == "done" and row(w, tid)["state"] == "holding"
    monkeypatch.undo()
    run(w, d + 3 * H)
    assert status(w, tid) == "closed"
