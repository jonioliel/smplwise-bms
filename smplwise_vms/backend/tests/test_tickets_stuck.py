"""CR-038 slice 6 - the pure SLA logic (services/tickets/stuck.py) with a fake clock, row by row: every threshold of section 13.1 incl.
"link not opened", the precedence of the reason the manager sees, ETA suppression, the waiting-for-a-part clock, an empty cell = off,
the reminder / escalation ladder (cadence, max reminders, manager_alert_after_steps incl. 0, unassigned at once, an assignee that cannot be
reminded), idempotency, the vendor send window (D4: the reminder waits, the managers do not; DST) and the board's SLA cell."""
from __future__ import annotations

import datetime as dt

import pytest

from smplwise.services.tickets import stuck

T0 = dt.datetime(2026, 10, 13, 8, 0, tzinfo=dt.timezone.utc)
RULE = {"unassigned_after_min": 15, "link_unopened_min": 1440, "ack_within_min": 30, "stuck_after_min": 60, "stuck_waiting_min": 1440,
        "resolve_within_min": 480, "remind_every_min": 30, "max_reminders": 2, "manager_alert_after_steps": 1}


def z(t: dt.datetime) -> str:
    return stuck.iso(t) or ""


def row(status: str = "assigned", *, created: dt.datetime = T0, last: dt.datetime | None = None, kind: str | None = "user",
        asg_at: dt.datetime | None = T0, eta: dt.datetime | None = None) -> dict:
    held = status not in ("new", "returned") and kind is not None
    return {"id": "t1", "status": status, "created_at": z(created), "last_activity_at": z(last or created), "eta_at": z(eta) if eta else None,
            "current_assignment_id": "a1" if held else None, "asg_kind": kind if held else None, "asg_at": z(asg_at) if held and asg_at else None,
            "asg_ended_at": None}


def m(n: float) -> dt.timedelta:
    return dt.timedelta(minutes=n)


# ---------------------------------------------------------------- thresholds

def test_unassigned_crosses_after_its_minutes_from_unassigned_since():
    r = row("new")
    assert stuck.evaluate(r, RULE, T0 + m(14)).crossed is None
    ev = stuck.evaluate(r, RULE, T0 + m(15))
    assert ev.crossed == stuck.Crossing("unassigned", T0 + m(15))
    returned_at = T0 + m(100)
    ev = stuck.evaluate(row("returned"), RULE, T0 + m(110), unassigned_since=z(returned_at))
    assert ev.crossed is None and ev.dues["unassigned"] == returned_at + m(15)


def test_ack_stuck_waiting_and_overdue():
    assert stuck.evaluate(row("assigned"), RULE, T0 + m(31)).crossed.kind == "ack"
    r = row("in_progress", last=T0 + m(10))
    assert stuck.evaluate(r, RULE, T0 + m(69)).crossed is None
    assert stuck.evaluate(r, RULE, T0 + m(70)).crossed == stuck.Crossing("stuck", T0 + m(70))
    w = row("waiting_part", last=T0)
    assert stuck.evaluate(w, RULE, T0 + m(200)).crossed is None, "waiting for a part has its own, longer clock"
    assert stuck.evaluate(w, RULE, T0 + m(479)).crossed is None
    assert stuck.evaluate(w, RULE, T0 + m(480)).crossed.kind == "overdue", "the resolve window outranks the per-step reasons"


def test_overdue_outranks_stuck_but_unassigned_outranks_overdue():
    assert stuck.evaluate(row("in_progress"), RULE, T0 + m(600)).crossed.kind == "overdue"
    assert stuck.evaluate(row("new"), RULE, T0 + m(600)).crossed.kind == "unassigned"


def test_done_and_final_states_are_never_stuck():
    assert stuck.evaluate(row("done"), RULE, T0 + m(10_000)).crossed is None
    assert stuck.evaluate(row("closed"), RULE, T0 + m(10_000)).dues == {}


def test_an_eta_in_the_future_suppresses_stuck_not_overdue():
    eta = T0 + m(300)
    r = row("in_progress", eta=eta)
    assert stuck.evaluate(r, RULE, T0 + m(120)).crossed is None, "ETA promised: not stuck"
    assert stuck.evaluate(r, RULE, T0 + m(300)).crossed.kind == "stuck", "the ETA passed"
    r = row("in_progress", eta=T0 + m(2000))
    assert stuck.evaluate(r, RULE, T0 + m(480)).crossed.kind == "overdue"


def test_link_not_opened_only_for_an_external_assignment_with_a_live_unopened_link():
    rule = {**RULE, "ack_within_min": None, "resolve_within_min": None}
    link = stuck.LinkInfo(sent_at=z(T0), first_opened_at=None)
    r = row("assigned", kind="contact")
    assert stuck.evaluate(r, rule, T0 + m(1439), link=link).crossed is None
    assert stuck.evaluate(r, rule, T0 + m(1440), link=link).crossed.kind == "unopened"
    opened = stuck.LinkInfo(sent_at=z(T0), first_opened_at=z(T0 + m(5)))
    assert "unopened" not in stuck.evaluate(r, rule, T0 + m(2000), link=opened).dues
    assert "unopened" not in stuck.evaluate(row("assigned", kind="user"), rule, T0 + m(2000), link=link).dues
    revoked = stuck.LinkInfo(sent_at=z(T0), first_opened_at=None, revoked=True)
    assert "unopened" not in stuck.evaluate(r, rule, T0 + m(2000), link=revoked).dues


@pytest.mark.parametrize("field,status", [("unassigned_after_min", "new"), ("ack_within_min", "assigned"), ("stuck_after_min", "in_progress"),
                                          ("stuck_waiting_min", "waiting_part"), ("resolve_within_min", "in_progress")])
def test_every_threshold_is_off_when_its_cell_is_empty(field, status):
    rule = {**RULE, field: None}
    ev = stuck.evaluate(row(status), rule, T0 + m(100_000))
    gone = {"unassigned_after_min": "unassigned", "ack_within_min": "ack", "stuck_after_min": "stuck", "stuck_waiting_min": "waiting",
            "resolve_within_min": "overdue"}[field]
    assert gone not in ev.dues


def test_no_rule_at_all_means_no_threshold():
    assert stuck.evaluate(row("new"), None, T0 + m(100_000)).dues == {}


# ---------------------------------------------------------------- the ladder

def run(r: dict, rule: dict, times: list[float], **kw) -> list[stuck.Plan]:
    """Look at the ticket at each minute offset, carrying the ladder state like the monitor does."""
    state = stuck.LadderState()
    plans = []
    for t in times:
        now = T0 + m(t)
        p = stuck.plan(state, stuck.evaluate(r, rule, now), rule, now, assignee=kw.get("assignee", "user"), can_remind=kw.get("can_remind", True),
                       window_open=kw.get("window_open", True), next_window=kw.get("next_window"))
        state = p.state
        plans.append(p)
    return plans


def test_the_ladder_reminds_then_alerts_the_managers_then_stops():
    rule = {**RULE, "resolve_within_min": None}
    r = row("in_progress")
    p = run(r, rule, [59, 60, 61, 90, 91, 120, 500])
    assert p[0].actions == [] and p[0].next_check == T0 + m(60), "nothing before the crossing; the next look is the crossing"
    assert p[1].actions == ["started", "remind"] and p[1].state.level == 1 and p[1].state.reminders == 1
    assert p[2].actions == [], "idempotent: the same crossing is not acted on twice"
    assert p[3].actions == ["remind", "alert"] and p[3].state.level == 2 and p[3].state.reminders == 2, "one unanswered reminder -> managers"
    assert p[4].actions == [] and p[5].actions == [] and p[6].actions == [], "max_reminders reached: nothing more"
    assert p[6].state.kind == "stuck", "it stays stuck on the board until someone acts"


def test_manager_alert_after_zero_steps_is_at_the_crossing():
    rule = {**RULE, "manager_alert_after_steps": 0, "resolve_within_min": None}
    p = run(row("in_progress"), rule, [60])
    assert p[0].actions == ["started", "remind", "alert"]


def test_unassigned_alerts_the_managers_at_once_and_reminds_nobody():
    p = run(row("new"), RULE, [15], assignee=None)
    assert p[0].actions == ["started", "alert"] and p[0].state.reminders == 0 and p[0].state.level == 2


def test_an_assignee_that_cannot_be_reminded_escalates_at_the_crossing():
    p = run(row("assigned", kind="contact"), {**RULE, "resolve_within_min": None}, [30], assignee="contact", can_remind=False)
    assert p[0].actions == ["started", "alert"]


def test_progress_ends_the_crossing_and_a_new_crossing_starts_from_zero():
    rule = {**RULE, "resolve_within_min": None}
    plans = run(row("in_progress"), rule, [60, 90])
    state = plans[-1].state
    later = row("in_progress", last=T0 + m(100))  # a note at +100
    now = T0 + m(101)
    p = stuck.plan(state, stuck.evaluate(later, rule, now), rule, now, assignee="user")
    assert p.ended_kind == "stuck" and p.actions == ["resolved"] and p.state == stuck.LadderState() and p.next_check == T0 + m(160)
    now = T0 + m(160)
    p = stuck.plan(p.state, stuck.evaluate(later, rule, now), rule, now, assignee="user")
    assert p.actions == ["started", "remind"] and p.state.reminders == 1


def test_a_changed_crossing_restarts_the_ladder_and_ends_the_old_kind():
    rule = {**RULE, "resolve_within_min": 120}
    plans = run(row("in_progress"), rule, [60, 120])
    assert plans[1].actions[:1] == ["started"] and plans[1].ended_kind == "stuck" and plans[1].state.kind == "overdue"


def test_no_cadence_means_one_reminder_and_the_alert_with_it():
    rule = {**RULE, "remind_every_min": None, "resolve_within_min": None}
    p = run(row("in_progress"), rule, [60, 600])
    assert p[0].actions == ["started", "remind", "alert"] and p[1].actions == []


def test_catch_up_after_downtime_sends_one_reminder_per_look():
    rule = {**RULE, "max_reminders": 3, "manager_alert_after_steps": 3, "resolve_within_min": None}
    p = run(row("in_progress"), rule, [500, 501])
    assert p[0].actions == ["started", "remind", "alert"], "nominally the managers were due long ago; one reminder now, not three"
    assert p[1].actions == [], "the next reminder waits one cadence from the last one"
    assert p[1].next_check == T0 + m(530)


def test_vendor_reminder_waits_for_the_send_window_but_the_managers_do_not():
    rule = {**RULE, "resolve_within_min": None, "ack_within_min": 30}
    opening = T0 + m(300)
    p = run(row("assigned", kind="contact"), rule, [30, 60], assignee="contact", window_open=False, next_window=opening)
    assert p[0].actions == ["started"] and p[0].remind_held_until == opening and p[0].state.reminders == 0
    assert p[1].actions == ["alert"], "the manager alert at its nominal time is not delayed by the send window"
    now = opening
    q = stuck.plan(p[1].state, stuck.evaluate(row("assigned", kind="contact"), rule, now), rule, now, assignee="contact", window_open=True)
    assert q.actions == ["remind"] and q.state.reminders == 1


def test_window_state_in_the_installation_zone_including_dst():
    jlm = "Asia/Jerusalem"
    inside, nxt = stuck.window_state(dt.datetime(2026, 7, 1, 10, 0, tzinfo=dt.timezone.utc), ("07:00", "21:00"), jlm)
    assert inside and nxt == dt.datetime(2026, 7, 1, 10, 0, tzinfo=dt.timezone.utc)
    inside, nxt = stuck.window_state(dt.datetime(2026, 7, 1, 23, 0, tzinfo=dt.timezone.utc), ("07:00", "21:00"), jlm)  # 02:00 local (IDT +3)
    assert not inside and nxt == dt.datetime(2026, 7, 2, 4, 0, tzinfo=dt.timezone.utc)
    inside, nxt = stuck.window_state(dt.datetime(2026, 12, 1, 3, 0, tzinfo=dt.timezone.utc), ("07:00", "21:00"), jlm)  # 05:00 local (IST +2)
    assert not inside and nxt == dt.datetime(2026, 12, 1, 5, 0, tzinfo=dt.timezone.utc)
    # the autumn change (2026-10-25 02:00 IDT -> 01:00 IST): the opening of that day is 07:00 IST = 05:00 UTC
    inside, nxt = stuck.window_state(dt.datetime(2026, 10, 24, 20, 0, tzinfo=dt.timezone.utc), ("07:00", "21:00"), jlm)
    assert not inside and nxt == dt.datetime(2026, 10, 25, 5, 0, tzinfo=dt.timezone.utc)


def test_send_window_resolution_department_then_installation_then_default():
    assert stuck.send_window(None, None) == ("07:00", "21:00")
    assert stuck.send_window({"from": "08:00", "to": "20:00"}, None) == ("08:00", "20:00")
    assert stuck.send_window({"from": "08:00", "to": "20:00"}, '{"from":"09:00","to":"18:00"}') == ("09:00", "18:00")
    assert stuck.send_window({"from": "22:00", "to": "06:00"}, None) == ("07:00", "21:00"), "across midnight is refused at save time -> ignored"
    assert stuck.send_window("garbage", "{bad") == ("07:00", "21:00")


@pytest.mark.parametrize("status", ["new", "returned", "assigned", "acknowledged", "in_progress", "waiting_part", "done"])
def test_the_monitor_and_slice_2s_stored_dues_agree(status):
    """stuck.evaluate (the monitor) and sla.compute (slice 2's stored ack / stuck / resolve dues) are the same formulas."""
    from smplwise.services.tickets import sla

    r = row(status, last=T0 + m(7), eta=T0 + m(500) if status == "in_progress" else None)
    since = z(T0 + m(3))
    ev = stuck.evaluate(r, RULE, T0, unassigned_since=since)
    d = sla.compute(status=status, created_at=r["created_at"], last_activity_at=r["last_activity_at"], unassigned_since=since,
                    assigned_at=r["asg_at"], eta_at=r["eta_at"], done_at=None, rule=RULE, auto_close_after_days=None)
    first = ev.dues.get("unassigned") or ev.dues.get("ack")
    assert (z(first) if first else None) == d.ack_due_at
    nxt = ev.dues.get("stuck") or ev.dues.get("waiting")
    assert (z(nxt) if nxt else None) == d.stuck_due_at
    assert (z(ev.dues["overdue"]) if "overdue" in ev.dues else None) == d.resolve_due_at


def test_nearest_due_for_the_board():
    r = row("assigned")
    cell = stuck.nearest_due(stuck.evaluate(r, RULE, T0 + m(10)), T0 + m(10))
    assert cell == {"kind": "ack", "at": z(T0 + m(30)), "over": False}
    cell = stuck.nearest_due(stuck.evaluate(r, RULE, T0 + m(40)), T0 + m(40))
    assert cell == {"kind": "ack", "at": z(T0 + m(30)), "over": True}
