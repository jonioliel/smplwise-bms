"""MGRDASH phase 5 (docs/design/MANAGER_DASHBOARD_SPEC_HE.md sections 9, 10): the manager overview's alerts - the morning summary
(`ticket.dash_digest`) and the busy department (`ticket.dash_busy_department`), raised by the janitor step
services/tickets/dashboard_alerts.managers_tick, and their two settings (`ui.dash_digest_hour`, `ui.dash_dept_stuck`).

Negative first: both are off by default (nothing is raised); a bad setting is refused; then: the summary reaches each manager with HIS
numbers only (another department's manager, a handler and a manager with nothing to report get nothing), once per day, only on a
working day inside its hour window; the busy department reaches only that department's managers, once, and is resolved when the number
drops. Every name and number here is invented."""
from __future__ import annotations

import datetime as dt
from zoneinfo import ZoneInfo

import pytest
from conftest import bind

from smplwise.db import Database
from smplwise.services import notify_policy
from smplwise.services.tickets import dashboard_alerts
from smplwise.services.tickets.messaging import DEFAULT_TZ
from tickets_s4_world import API, build_s4

SUNDAY_0830 = dt.datetime(2026, 10, 18, 8, 30, tzinfo=ZoneInfo(DEFAULT_TZ))


@pytest.fixture()
def s4(settings, monkeypatch):
    world = build_s4(settings, monkeypatch)
    bind(world.c, settings, "mona", "tickets_external", "installation", "*")
    return world


def _enable(s4, *sources: str) -> None:
    with Database(s4.w.settings.db_path).connection() as conn:
        notify_policy.ensure_defaults(conn)
        for src in sources:
            conn.execute("UPDATE notify_policies SET enabled = 1 WHERE source = ?", (src,))


def _tick(s4, at: dt.datetime = SUNDAY_0830) -> dict:
    with Database(s4.w.settings.db_path).connection() as conn:
        return dashboard_alerts.managers_tick(conn, at.astimezone(dt.timezone.utc))


def _rows(s4, source: str) -> list[dict]:
    with s4.db.connection(mode="read") as conn:
        out = []
        for r in conn.execute("SELECT * FROM notifications WHERE source = ? ORDER BY created_at", (source,)).fetchall():
            d = dict(r)
            d["to"] = sorted(x[0] for x in conn.execute("SELECT user_id FROM notification_recipients WHERE notification_id = ?", (r["id"],)))
            out.append(d)
        return out


def _stuck(s4, user: str, n: int, dept: str | None = None) -> list[str]:
    ids = []
    for i in range(n):
        t = s4.ticket(user, f"תקועה {i}", **({"dept": dept} if dept else {}))
        ids.append(t["id"])
    with Database(s4.w.settings.db_path).connection() as conn:
        conn.executemany("UPDATE tickets SET stuck_kind = 'stuck' WHERE id = ?", [(i,) for i in ids])
    return ids


def _ui(s4, **ui):
    rev = s4.c.get(f"{API}/tickets/settings").json()["revision"]
    return s4.c.put(f"{API}/tickets/settings", json={"revision": rev, "ui": ui})


# ---------------------------------------------------------------- negative first

def test_both_alerts_are_off_by_default(s4):
    _stuck(s4, "mona", 12)
    out = _tick(s4)
    assert out == {"digests": 0, "busy_raised": 0, "busy_resolved": 0}
    assert _rows(s4, "ticket.dash_digest") == [] and _rows(s4, "ticket.dash_busy_department") == []
    with s4.db.connection(mode="read") as conn:
        pol = {p["source"]: p for p in notify_policy.list_policies(conn)}
    assert pol["ticket.dash_digest"]["enabled"] is False and pol["ticket.dash_busy_department"]["enabled"] is False
    assert pol["rfq.instalment_due_tomorrow"]["enabled"] is False


@pytest.mark.parametrize("body", [{"dash_digest_hour": 24}, {"dash_digest_hour": -1}, {"dash_digest_hour": "8"}, {"dash_dept_stuck": 0},
                                  {"dash_dept_stuck": 1000}, {"dash_digest_hour": True}])
def test_bad_settings_are_refused(s4, body):
    assert _ui(s4, **body).status_code == 422


def test_the_settings_are_saved_and_read_back(s4):
    r = _ui(s4, dash_digest_hour=7, dash_dept_stuck=4)
    assert r.status_code == 200, r.text
    ui = s4.c.get(f"{API}/tickets/settings").json()["ui"]
    assert (ui["dash_digest_hour"], ui["dash_dept_stuck"]) == (7, 4)


# ---------------------------------------------------------------- the morning summary

def test_the_summary_reaches_each_manager_with_his_own_numbers_once_a_day(s4):
    _enable(s4, "ticket.dash_digest")
    _stuck(s4, "mona", 2)
    assert _tick(s4)["digests"] == 2  # the maintenance manager and the all-departments manager
    assert _tick(s4)["digests"] == 0, "once per manager and day"
    rows = {r["to"][0]: r for r in _rows(s4, "ticket.dash_digest")}
    assert set(rows) == {"dev-mona", "dev-joni"} and all(len(r["to"]) == 1 for r in rows.values()), \
        "each row to its manager only; cleo (nothing in her department) and tom (a handler) get nothing"
    mona = rows["dev-mona"]
    assert mona["body"].startswith("2 ") and "לאישורך" in mona["body"] and mona["link"] == "#/tickets/overview"
    assert "mona" not in mona["body"].lower(), "no person in the text"
    _stuck(s4, "cleo", 1, dept=s4.w.cleaning)
    assert _tick(s4)["digests"] == 1  # cleo now has one; mona already had hers today
    cleo = [r for r in _rows(s4, "ticket.dash_digest") if r["to"] == ["dev-cleo"]]
    assert len(cleo) == 1 and cleo[0]["body"].startswith("1 "), "the cleaning manager counts the cleaning request only"


@pytest.mark.parametrize("at", [SUNDAY_0830.replace(hour=7, minute=59), SUNDAY_0830.replace(hour=11, minute=0),
                                SUNDAY_0830 - dt.timedelta(days=1)])  # before the hour, after its window, a Saturday
def test_the_summary_waits_for_a_working_day_and_its_hour(s4, at):
    _enable(s4, "ticket.dash_digest")
    _stuck(s4, "mona", 1)
    assert _tick(s4, at)["digests"] == 0


def test_the_summary_hour_follows_the_setting(s4):
    _enable(s4, "ticket.dash_digest")
    _stuck(s4, "mona", 1)
    assert _ui(s4, dash_digest_hour=6).status_code == 200
    assert _tick(s4, SUNDAY_0830.replace(hour=6, minute=5))["digests"] == 2  # mona and the all-departments manager


# ---------------------------------------------------------------- the busy department

def test_a_busy_department_alerts_its_managers_once_and_ends_below_the_threshold(s4):
    _enable(s4, "ticket.dash_busy_department")
    assert _ui(s4, dash_dept_stuck=3).status_code == 200
    ids = _stuck(s4, "mona", 3)
    _stuck(s4, "cleo", 1, dept=s4.w.cleaning)
    assert _tick(s4)["busy_raised"] == 1
    assert _tick(s4)["busy_raised"] == 0, "once, until the number drops"
    rows = _rows(s4, "ticket.dash_busy_department")
    assert len(rows) == 1 and rows[0]["to"] == ["dev-mona"] and rows[0]["count"] == 1
    assert rows[0]["link"].endswith("dept=dept-maintenance") and "3" in rows[0]["body"]
    with Database(s4.w.settings.db_path).connection() as conn:
        conn.execute("UPDATE tickets SET stuck_kind = NULL WHERE id = ?", (ids[0],))
    assert _tick(s4)["busy_resolved"] == 1
    assert _rows(s4, "ticket.dash_busy_department")[0]["state"] == "resolved"


def test_switching_the_busy_alert_off_resolves_what_it_raised(s4):
    _enable(s4, "ticket.dash_busy_department")
    assert _ui(s4, dash_dept_stuck=1).status_code == 200
    _stuck(s4, "mona", 1)
    assert _tick(s4)["busy_raised"] == 1
    with Database(s4.w.settings.db_path).connection() as conn:
        conn.execute("UPDATE notify_policies SET enabled = 0 WHERE source = 'ticket.dash_busy_department'")
    assert _tick(s4)["busy_resolved"] == 1
