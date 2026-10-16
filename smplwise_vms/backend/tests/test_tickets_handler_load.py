"""HANDLERLOAD (owner 2026-10-17): GET /tickets/handler-load?days=1|7|30 - the "handled" count per handler on the handler cards, and the
installation default `ui.handled_days`. Negative first: the allow-list, the gate, the visibility (a department manager never counts
another department's requests), then the definition (services/tickets/handler_load.py): done/closed requests whose completion time
`done_at` is in the period, counted for the assignee they had AT that moment, in the installation's time zone."""
from __future__ import annotations

import datetime as dt
import json
from zoneinfo import ZoneInfo

import pytest

from smplwise.db import Database
from smplwise.services.tickets import handler_load
from tickets_world import API, build


@pytest.fixture()
def w(settings):
    return build(settings)


def load(w, user: str, **q):
    return w.c.get(f"{API}/tickets/handler-load", params=q, headers=w.h(user))


def iso(v: dt.datetime) -> str:
    return v.astimezone(dt.timezone.utc).replace(microsecond=0).isoformat().replace("+00:00", "Z")


def done_by(w, ticket: dict, handler: str = "tom", manager: str = "mona") -> dict:
    """Assign the ticket and run it to `done` as the handler."""
    assert w.assign(manager, ticket["id"], handler).status_code == 200
    assert w.status(handler, ticket["id"], "in_progress").status_code == 200
    r = w.status(handler, ticket["id"], "done")
    assert r.status_code == 200, r.text
    return ticket


def set_done_at(w, ticket_id: str, at: dt.datetime) -> None:
    with Database(w.settings.db_path).connection() as conn:
        conn.execute("UPDATE tickets SET done_at = ? WHERE id = ?", (iso(at), ticket_id))
        # the work was assigned before it was finished: move the assignment back with the completion
        conn.execute("UPDATE ticket_assignments SET assigned_at = ? WHERE ticket_id = ? AND assigned_at > ?",
                     (iso(at - dt.timedelta(hours=1)), ticket_id, iso(at)))


def set_zone(w, name: str) -> None:
    assert w.c.patch(f"{API}/settings", json={"time.zone": name}).status_code == 200


def handled(w, user: str = "mona", **q) -> dict:
    r = load(w, user, **q)
    assert r.status_code == 200, r.text
    return r.json()["handled"]


# ---------------------------------------------------------------- the allow-list and the gate

@pytest.mark.parametrize("days", ["0", "2", "8", "31", "-1", "7.0", "all", "7 ", "1;7", "true", "07"])
def test_period_outside_the_allow_list_is_refused(w, days):
    assert load(w, "mona", days=days).status_code == 422


@pytest.mark.parametrize("user,code", [("tom", 403), ("nora", 403), ("alda", 403), ("vic", 403), ("mona", 200), ("cleo", 200), ("joni", 200)])
def test_only_managers_get_the_numbers(w, user, code):
    assert load(w, user).status_code == code


def test_module_off_is_the_uniform_404(w):
    w.c.patch(f"{API}/settings", json={"tickets.enabled": "false"})
    r = load(w, "mona")
    assert r.status_code == 404 and r.json()["code"] == "feature_disabled"


def test_the_route_is_not_swallowed_by_the_ticket_id_route(w):
    assert load(w, "mona").json()["days"] == 7


def test_the_answer_is_counts_only(w):
    t = done_by(w, w.create("mona", "סיסמה סודית בכותרת"))
    body = load(w, "mona", days="30").json()
    assert set(body) == {"days", "since", "now", "handled", "truncated", "default_days"}
    assert "סודית" not in json.dumps(body, ensure_ascii=False) and t["id"] not in json.dumps(body)
    assert all(isinstance(v, int) for v in body["handled"].values())


# ---------------------------------------------------------------- visibility

def test_a_department_manager_counts_only_his_departments(w):
    done_by(w, w.create("mona", "מזגן"))
    w.member(w.cleaning, "nora", "member")
    c = w.create("cleo", "רצפה", dept=w.cleaning)
    assert w.assign("cleo", c["id"], "nora").status_code == 200
    assert w.status("nora", c["id"], "in_progress").status_code == 200
    assert w.status("nora", c["id"], "done").status_code == 200
    assert handled(w, "mona") == {"user:dev-tom": 1}, "no leak of the cleaning department"
    assert handled(w, "cleo") == {"user:dev-nora": 1}, "no leak of the maintenance department"
    assert handled(w, "joni") == {"user:dev-tom": 1, "user:dev-nora": 1}, "all departments"


# ---------------------------------------------------------------- the definition

def test_nothing_done_counts_nothing(w):
    w.create("mona", "פתוחה")
    t = w.create("mona", "בטיפול")
    w.assign("mona", t["id"], "tom")
    assert handled(w) == {}


def test_done_and_then_closed_count_once_for_the_handler(w):
    t = done_by(w, w.create("mona"))
    assert handled(w) == {"user:dev-tom": 1}
    assert w.status("mona", t["id"], "closed").status_code == 200
    assert handled(w) == {"user:dev-tom": 1}, "the manager's closing changes neither the number nor the person"


def test_cancelled_and_closed_without_done_are_not_handled(w):
    a = w.create("mona", "כפולה")
    assert w.status("mona", a["id"], "closed", note="כפול").status_code == 200
    b = w.create("mona", "בטעות")
    assert w.status("mona", b["id"], "cancelled", note="בטעות").status_code == 200
    c = done_by(w, w.create("mona", "הושלמה ואז בוטלה"))
    assert w.status("mona", c["id"], "cancelled", note="בטעות").status_code == 200
    assert handled(w) == {}


def test_a_reopened_request_counts_on_its_latest_completion_and_assignee(w):
    t = done_by(w, w.create("mona"))
    assert handled(w) == {"user:dev-tom": 1}
    assert w.status("mona", t["id"], "in_progress", note="לא תוקן").status_code == 200  # done -> handling: done_at cleared
    assert handled(w) == {}
    w.member("dept-maintenance", "gil", "member")
    assert w.assign("mona", t["id"], "gil").status_code == 200
    assert w.status("gil", t["id"], "in_progress").status_code == 200
    assert w.status("gil", t["id"], "done").status_code == 200
    assert handled(w) == {"user:dev-gil": 1}, "only the last assignee, once"


def test_reassigned_before_done_counts_for_the_last_assignee(w):
    t = w.create("mona")
    w.assign("mona", t["id"], "tom")
    w.member("dept-maintenance", "gil", "member")
    assert w.assign("mona", t["id"], "gil").status_code == 200
    assert w.status("gil", t["id"], "in_progress").status_code == 200
    assert w.status("gil", t["id"], "done").status_code == 200
    assert handled(w) == {"user:dev-gil": 1}


def test_a_manager_marking_done_on_behalf_counts_for_the_assignee(w):
    t = w.create("mona")
    w.assign("mona", t["id"], "tom")
    assert w.status("mona", t["id"], "in_progress").status_code == 200
    assert w.status("mona", t["id"], "done").status_code == 200
    assert handled(w) == {"user:dev-tom": 1}


def test_the_assignee_at_the_time_of_done_not_a_later_row(w):
    t = done_by(w, w.create("mona"))
    with Database(w.settings.db_path).connection() as conn:
        done_at = conn.execute("SELECT done_at FROM tickets WHERE id = ?", (t["id"],)).fetchone()[0]
        later = iso(dt.datetime.fromisoformat(done_at.replace("Z", "+00:00")) + dt.timedelta(seconds=30))
        conn.execute("UPDATE ticket_assignments SET ended_at = ?, end_reason = 'reassigned' WHERE ticket_id = ?", (later, t["id"]))
        conn.execute("INSERT INTO ticket_assignments(id, ticket_id, assignee_kind, user_id, assignee_name, channel, assigned_by, assigned_at) "
                     "VALUES ('x1', ?, 'user', 'dev-gil', 'gil', 'inapp', 'dev-mona', ?)", (t["id"], later))
    assert handled(w) == {"user:dev-tom": 1}


def test_a_contact_assignee_key(w):
    t = done_by(w, w.create("mona"))
    with Database(w.settings.db_path).connection() as conn:
        conn.execute("UPDATE ticket_assignments SET assignee_kind = 'contact', user_id = NULL, contact_id = 'c0001' WHERE ticket_id = ?", (t["id"],))
    assert handled(w) == {"contact:c0001": 1}


# ---------------------------------------------------------------- the periods and the time zone

def test_period_boundaries_in_the_installation_time_zone(w):
    set_zone(w, "Asia/Jerusalem")
    tz = ZoneInfo("Asia/Jerusalem")
    now = dt.datetime.now(dt.timezone.utc)
    today0 = dt.datetime.combine(now.astimezone(tz).date(), dt.time.min, tzinfo=tz)
    cases = {
        "yesterday_last_second": today0 - dt.timedelta(seconds=1),
        "d6_edge": today0 - dt.timedelta(days=6),                    # first instant of the 7-day window
        "d6_before": today0 - dt.timedelta(days=6, seconds=1),
        "d29_edge": today0 - dt.timedelta(days=29),                  # first instant of the 30-day window
        "d29_before": today0 - dt.timedelta(days=29, seconds=1),
    }
    for name, at in cases.items():
        set_done_at(w, done_by(w, w.create("mona", name))["id"], at)
    today = done_by(w, w.create("mona", "today"))
    set_done_at(w, today["id"], max(today0, now - dt.timedelta(seconds=2)))  # inside "today" at any hour
    assert handled(w, days="1") == {"user:dev-tom": 1}
    assert handled(w, days="7") == {"user:dev-tom": 3}      # today, yesterday's last second, the first instant of day 7
    assert handled(w, days="30") == {"user:dev-tom": 5}
    assert load(w, "mona", days="7").json()["since"] == iso(today0 - dt.timedelta(days=6))
    assert load(w, "mona", days="30").json()["since"] == iso(today0 - dt.timedelta(days=29))


def test_the_time_zone_moves_the_boundary(w):
    now = dt.datetime.now(dt.timezone.utc)
    t = done_by(w, w.create("mona"))
    auck = ZoneInfo("Pacific/Auckland")
    auck0 = dt.datetime.combine(now.astimezone(auck).date(), dt.time.min, tzinfo=auck)
    set_zone(w, "Pacific/Auckland")
    set_done_at(w, t["id"], auck0 - dt.timedelta(seconds=1))
    assert handled(w, days="1") == {}, "the second before the installation's local midnight is yesterday"
    set_done_at(w, t["id"], auck0)
    if auck0 <= now:
        assert handled(w, days="1") == {"user:dev-tom": 1}


def test_default_period_comes_from_the_setting_and_the_explicit_one_wins(w):
    t = done_by(w, w.create("mona"))
    set_done_at(w, t["id"], dt.datetime.now(dt.timezone.utc) - dt.timedelta(days=20))
    body = load(w, "mona").json()
    assert body["days"] == 7 and body["default_days"] == 7 and body["handled"] == {}
    doc = w.c.get(f"{API}/tickets/settings").json()
    r = w.c.put(f"{API}/tickets/settings", json={"revision": doc["revision"], "ui": {"handled_days": 30}})
    assert r.status_code == 200 and r.json()["ui"]["handled_days"] == 30
    assert w.c.get(f"{API}/tickets/module", headers=w.h("tom")).json()["ui"]["handled_days"] == 30
    body = load(w, "mona").json()
    assert body["days"] == 30 and body["handled"] == {"user:dev-tom": 1}
    assert load(w, "mona", days="7").json()["handled"] == {}


@pytest.mark.parametrize("bad", [0, 2, 14, 365, "7", True, 7.5, None])
def test_the_default_setting_is_validated(w, bad):
    doc = w.c.get(f"{API}/tickets/settings").json()
    r = w.c.put(f"{API}/tickets/settings", json={"revision": doc["revision"], "ui": {"handled_days": bad}})
    if bad is None:
        assert r.status_code == 200, "null = not sent"
    else:
        assert r.status_code == 422, (bad, r.text)
    assert w.c.get(f"{API}/tickets/settings").json()["ui"]["handled_days"] == 7


def test_the_default_setting_needs_system_configure(w):
    doc = w.c.get(f"{API}/tickets/settings").json()
    r = w.c.put(f"{API}/tickets/settings", json={"revision": doc["revision"], "ui": {"handled_days": 30}}, headers=w.h("mona"))
    assert r.status_code == 403
    assert w.c.get(f"{API}/tickets/settings").json()["ui"]["handled_days"] == 7


def test_a_corrupt_stored_default_reads_as_seven(w):
    with Database(w.settings.db_path).connection() as conn:
        conn.execute("INSERT INTO settings(key, value) VALUES('tickets.settings', ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value",
                     (json.dumps({"ui": {"handled_days": 3}, "revision": 1}),))
    assert w.c.get(f"{API}/tickets/module", headers=w.h("tom")).json()["ui"]["handled_days"] == 7


def test_period_start_follows_local_dates_across_a_dst_change():
    tz = ZoneInfo("Asia/Jerusalem")  # DST ends 2026-10-25
    now = dt.datetime(2026, 10, 27, 10, 0, tzinfo=dt.timezone.utc)
    assert handler_load.period_start(now, 7, tz).astimezone(tz).strftime("%Y-%m-%d %H:%M") == "2026-10-21 00:00"
    assert handler_load.period_start(now, 1, tz).astimezone(tz).strftime("%Y-%m-%d %H:%M") == "2026-10-27 00:00"
    assert handler_load.period_start(now, 7, tz) == dt.datetime(2026, 10, 20, 21, 0, tzinfo=dt.timezone.utc)  # +03:00 before the change
