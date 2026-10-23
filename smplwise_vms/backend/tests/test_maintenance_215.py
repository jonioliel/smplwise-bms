"""CR-MAINT215 slice 1 (docs/changes/CR-MAINT215.md): the maintenance module's backend - NEGATIVE FIRST: the module switch, the
permissions (default deny, audited refusals), isolation between scopes (floor / building / installation, deny wins), validation;
then the expiry maths with an injected clock (no sleeps), the reminder pass (once per level, resolved on completion, recipients by
scope), service requests on schedule through the tickets module (only while it is on), rounds, tags and the card read helpers.

Cast (tests/tickets_world.py, tickets module ON): joni system_admin; mona operator + tickets_manage, MANAGER of maintenance; tom
operator (installation); fred operator on floor 2 only; gil operator on floor 3 only; vic viewer. Added here: sara site_admin on
floor 2 only (maintenance.manage there and nowhere else). FAKES ONLY: no device, no Home Assistant, nothing outside the database."""
from __future__ import annotations

import datetime as dt
import json

import pytest
from conftest import bind
from tickets_world import API, MAINT, build

from smplwise.db import Database, new_id
from smplwise.rbac import ROLES
from smplwise.services.maintenance import access as maccess
from smplwise.services.maintenance import model
from smplwise.services.maintenance import reminders
from smplwise.services.maintenance import service as msvc

M = f"{API}/maintenance"
NOW = dt.datetime(2027, 1, 15, 10, 0, tzinfo=dt.timezone.utc)  # 12:00 local (Asia/Jerusalem, UTC+2 in January) -> local date 2027-01-15


def at(y: int, m: int, d: int) -> dt.datetime:
    return dt.datetime(y, m, d, 10, 0, tzinfo=dt.timezone.utc)


class MW:
    def __init__(self, settings) -> None:
        self.w = build(settings)
        self.c = self.w.c
        self.settings = settings
        self.db = Database(settings.db_path)
        self.floors = self.w.floors
        self.clock = NOW
        maccess.set_clock(lambda: self.clock)
        reminders.reset_for_tests()
        bind(self.c, settings, "sara", "site_admin", "floor", self.floors["floor2"])

    def h(self, user: str) -> dict[str, str]:
        return self.w.h(user)

    def on(self) -> "MW":
        r = self.c.patch(f"{API}/settings", json={"maintenance.enabled": "true"})
        assert r.status_code == 200, r.text
        return self

    def task(self, user: str = "joni", *, expect: int = 201, **body):
        payload = {"kind": "certificate", "title": "בדיקת מעלית שנתית", "due_date": "2027-02-14", **body}
        r = self.c.post(f"{M}/tasks", json=payload, headers=self.h(user))
        assert r.status_code == expect, r.text
        return r.json()

    def floor(self, key: str) -> dict:
        return {"kind": "floor", "id": self.floors[key]}

    def vendor(self, name: str = "בודק מוסמך בע\"מ") -> str:
        vid = new_id()
        with self.db.connection() as conn:
            conn.execute("INSERT INTO ticket_contacts(id, kind, display_name, created_by, created_at, updated_at) VALUES (?, 'vendor', ?, 'test', 't', 't')",
                         (vid, name))
        return vid

    def tick(self, when: dt.datetime) -> dict:
        self.clock = when
        with self.db.connection() as conn:
            return reminders.tick(conn, when)

    def rows(self, sql: str, args: tuple = ()) -> list:
        with self.db.connection(mode="read") as conn:
            return conn.execute(sql, args).fetchall()

    def audits(self, action: str, decision: str | None = None) -> list:
        sql = "SELECT * FROM audit_log WHERE action = ?" + (" AND decision = ?" if decision else "")
        return self.rows(sql, (action, decision) if decision else (action,))


@pytest.fixture()
def mw(settings):
    world = MW(settings)
    yield world
    maccess.set_clock(None)
    reminders.reset_for_tests()


# ================================================================ NEGATIVE: the module switch

ROUTES = [("GET", "/tasks"), ("POST", "/tasks"), ("GET", "/tasks/x1"), ("PATCH", "/tasks/x1"), ("DELETE", "/tasks/x1"), ("POST", "/tasks/x1/complete"),
          ("GET", "/tasks/x1/records"), ("POST", "/tasks/x1/runs"), ("GET", "/runs/r1"), ("PUT", "/runs/r1/answers"), ("POST", "/runs/r1/finish"),
          ("POST", "/runs/r1/cancel"), ("POST", "/runs/r1/items/k1/request"), ("GET", "/by-subject/elevator/e1"), ("GET", "/vendors/v1/documents"),
          ("GET", "/tags"), ("POST", "/tags"), ("DELETE", "/tags/t1"), ("GET", "/scan/" + "A" * 22)]


def test_switch_is_off_by_default_and_every_route_answers_the_uniform_404(mw):
    assert mw.c.get(f"{API}/settings").json()["settings"]["maintenance.enabled"] == "false"
    assert mw.c.get(f"{M}/module").json() == {"enabled": False, "can": {"view": False, "perform": False, "manage": False, "open_request": False}, "tickets_on": True}
    for method, path in ROUTES:
        r = mw.c.request(method, M + path, json={} if method in ("POST", "PUT", "PATCH") else None)
        assert r.status_code == 404 and r.json()["code"] == "feature_disabled", (method, path, r.status_code, r.text)
    with mw.db.connection() as conn:
        assert reminders.tick(conn, NOW) == {"tasks": 0, "soon": 0, "overdue": 0, "tickets": 0, "ticket_errors": 0}


def test_switching_the_module_needs_system_configure_and_is_audited(mw):
    assert mw.c.patch(f"{API}/settings", json={"maintenance.enabled": "true"}, headers=mw.h("tom")).status_code == 403
    assert mw.c.patch(f"{API}/settings", json={"maintenance.enabled": "maybe"}).status_code == 422
    mw.on()
    assert len(mw.audits("maintenance.module.enable", "allowed")) == 1
    mw.on()  # unchanged: no second row
    assert len(mw.audits("maintenance.module.enable", "allowed")) == 1
    assert mw.c.patch(f"{API}/settings", json={"maintenance.enabled": "false"}).status_code == 200
    assert len(mw.audits("maintenance.module.disable", "allowed")) == 1


def test_data_is_kept_while_off_and_reappears_when_on(mw):
    mw.on()
    t = mw.task()
    assert mw.c.patch(f"{API}/settings", json={"maintenance.enabled": "false"}).status_code == 200
    assert mw.c.get(f"{M}/tasks/{t['id']}").status_code == 404
    mw.on()
    assert mw.c.get(f"{M}/tasks/{t['id']}").json()["title"] == t["title"]


# ================================================================ NEGATIVE: permissions (default deny)

def test_permission_catalogue_defaults_labels_and_contract(mw):
    from pathlib import Path

    from smplwise.routers.access import PERMISSION_LABELS, SENSITIVE

    expect = {"maintenance.view": {"operator", "site_admin", "system_admin"}, "maintenance.perform": {"operator", "site_admin", "system_admin"},
              "maintenance.manage": {"site_admin", "system_admin"}}
    for perm, holders in expect.items():
        assert {r for r, perms in ROLES.items() if perm in perms} == holders, perm
        assert PERMISSION_LABELS[perm] and perm not in SENSITIVE
    assert not [p for p in ROLES["viewer"] + ROLES["kiosk"] + ROLES["editor"] if p.startswith("maintenance.")], "default deny for the other roles"
    contract = json.loads((Path(__file__).resolve().parents[3] / "contracts" / "examples" / "role-catalog.design.json").read_text(encoding="utf-8"))
    for role in contract["roles"]:
        assert {p for p in role["permissions"] if p.startswith("maintenance.")} == {p for p in ROLES[role["id"]] if p.startswith("maintenance.")}, role["id"]


def test_a_caller_without_the_permission_is_refused_and_audited(mw):
    mw.on()
    t = mw.task()
    r = mw.c.get(f"{M}/tasks", headers=mw.h("vic"))
    assert r.status_code == 403 and r.json()["details"]["permission"] == "maintenance.view"
    assert any(a["actor_user_id"] == "dev-vic" for a in mw.audits("maintenance.view", "denied"))
    assert mw.c.get(f"{M}/tasks/{t['id']}", headers=mw.h("vic")).status_code == 404, "an invisible task is the same 404 as an unknown one"
    assert mw.c.get(f"{M}/module", headers=mw.h("vic")).json()["can"] == {"view": False, "perform": False, "manage": False, "open_request": False}
    # an operator sees and performs but never manages
    r = mw.c.post(f"{M}/tasks", json={"kind": "certificate", "title": "x", "due_date": "2027-03-01"}, headers=mw.h("tom"))
    assert r.status_code == 403
    assert mw.c.patch(f"{M}/tasks/{t['id']}", json={"title": "שונה"}, headers=mw.h("tom")).status_code == 403
    assert mw.c.delete(f"{M}/tasks/{t['id']}", headers=mw.h("tom")).status_code == 403
    assert mw.c.post(f"{M}/tags", json={"target_kind": "task", "target_id": t["id"]}, headers=mw.h("tom")).status_code == 403
    assert len(mw.rows("SELECT id FROM maint_tasks")) == 1, "nothing written by a refused call"
    assert mw.c.get(f"{M}/tasks/{t['id']}", headers=mw.h("tom")).json()["can"] == {"edit": False, "complete": False, "start_round": False, "open_request": True}


def test_isolation_between_scopes(mw):
    mw.on()
    f2 = mw.task(title="מטף קומה 2", place=mw.floor("floor2"))
    f3 = mw.task(title="מטף קומה 3", place=mw.floor("floor3"))
    whole = mw.task(title="ספרינקלרים - כל המבנה")
    bld = mw.task(title="מנדף המטבח", place={"kind": "building", "id": mw.floors["building"]})
    # fred: operator on floor 2 only - floor 2 and the placeless task (owner answer 24.10 q15: like a placeless ticket, any scope),
    # never floor 3 or the building
    listed = {i["id"] for i in mw.c.get(f"{M}/tasks", headers=mw.h("fred")).json()["items"]}
    assert listed == {f2["id"], whole["id"]}
    for other in (f3, bld):
        r = mw.c.get(f"{M}/tasks/{other['id']}", headers=mw.h("fred"))
        assert r.status_code == 404 and r.json()["code"] == "maint_task_not_found"
    # sara: site_admin on floor 2 only - manages floor 2, nothing else
    mine = mw.task("sara", title="גלאי עשן קומה 2", place=mw.floor("floor2"))
    assert mine["place"]["kind"] == "floor"
    r = mw.c.post(f"{M}/tasks", json={"kind": "certificate", "title": "x", "due_date": "2027-03-01", "place": mw.floor("floor3")}, headers=mw.h("sara"))
    assert r.status_code == 403
    r = mw.c.post(f"{M}/tasks", json={"kind": "certificate", "title": "x", "due_date": "2027-03-01"}, headers=mw.h("sara"))
    assert r.status_code == 201, "a placeless task needs maintenance.manage at any scope (owner answer 24.10 q15)"
    assert mw.c.post(f"{M}/tasks", json={"kind": "certificate", "title": "x", "due_date": "2027-03-01"}, headers=mw.h("fred")).status_code == 403, "an operator never manages"
    assert any(a["resource_id"] == mw.floors["floor3"] for a in mw.audits("maintenance.task.create", "denied"))
    r = mw.c.patch(f"{M}/tasks/{mine['id']}", json={"place": mw.floor("floor3")}, headers=mw.h("sara"))
    assert r.status_code == 403, "moving a task needs manage on the new place too"
    assert mw.c.delete(f"{M}/tasks/{f3['id']}", headers=mw.h("sara")).status_code == 404
    assert mw.c.get(f"{M}/tasks/{f3['id']}").status_code == 200, "untouched"


def test_an_explicit_deny_on_the_chain_wins(mw):
    mw.on()
    f3 = mw.task(title="משאבה קומה 3", place=mw.floor("floor3"))
    assert mw.c.get(f"{M}/tasks/{f3['id']}", headers=mw.h("gil")).status_code == 200
    mw.w.deny("gil", "operator", "building", mw.floors["building"])
    assert mw.c.get(f"{M}/tasks/{f3['id']}", headers=mw.h("gil")).status_code == 404


def test_validation_problems_are_422_and_write_nothing(mw):
    mw.on()
    vid = mw.vendor()
    bad = [
        {"kind": "vendor_document", "title": "ביטוח", "doc_type": "insurance", "due_date": "2027-03-01"},  # no supplier
        {"kind": "vendor_document", "title": "ביטוח", "vendor_id": vid, "due_date": "2027-03-01"},  # no document type
        {"kind": "vendor_document", "title": "ביטוח", "vendor_id": vid, "doc_type": "insurance"},  # no valid-until date
        {"kind": "vendor_document", "title": "ביטוח", "vendor_id": vid, "doc_type": "insurance", "due_date": "2027-03-01", "place": mw.floor("floor2")},
        {"kind": "certificate", "title": "x", "doc_type": "insurance"},
        {"kind": "certificate", "title": "x", "vendor_id": "no-such-vendor"},
        {"kind": "certificate", "title": "x", "elevator_id": "no-such-elevator"},
        {"kind": "certificate", "title": "x", "generator_id": "no-such-generator"},
        {"kind": "certificate", "title": "x", "entity_id": "sensor.not_catalogued"},
        {"kind": "certificate", "title": "x", "place": {"kind": "floor", "id": "nope"}},
        {"kind": "certificate", "title": "x", "due_date": "2027-02-30"},
        {"kind": "certificate", "title": "שורה‮הפוכה"},
        {"kind": "certificate", "title": "   "},
        {"kind": "certificate", "title": "x", "category": "rockets"},
        {"kind": "certificate", "title": "x", "lead_days": 400},
        {"kind": "preventive", "title": "ניקוי מסננים", "anchor_date": "2027-02-01"},  # no interval
        {"kind": "preventive", "title": "ניקוי מסננים", "interval": {"unit": "month", "count": 1}},  # no first date
        {"kind": "preventive", "title": "ניקוי", "interval": {"unit": "fortnight", "count": 1}, "anchor_date": "2027-02-01"},
        {"kind": "round", "title": "סבב", "interval": {"unit": "day", "count": 1}, "anchor_date": "2027-02-01",
         "checklist": [{"key": "a", "label": "א"}, {"key": "a", "label": "ב"}]},
        {"kind": "round", "title": "סבב", "interval": {"unit": "day", "count": 1}, "anchor_date": "2027-02-01",
         "checklist": [{"key": "a", "label": "א", "kind": "check", "min": 1}]},
        {"kind": "preventive", "title": "x", "interval": {"unit": "month", "count": 1}, "anchor_date": "2027-02-01", "auto_ticket": True},  # no department
        {"kind": "preventive", "title": "x", "interval": {"unit": "month", "count": 1}, "anchor_date": "2027-02-01", "department_id": "no-such-dept"},
    ]
    for body in bad:
        r = mw.c.post(f"{M}/tasks", json=body)
        assert r.status_code == 422, (body, r.text)
    assert mw.c.post(f"{M}/tasks", json={"kind": "certificate", "title": "x", "unexpected": 1}).status_code == 422
    assert mw.rows("SELECT COUNT(*) FROM maint_tasks")[0][0] == 0
    t = mw.task()
    assert mw.c.patch(f"{M}/tasks/{t['id']}", json={"kind": "round"}).status_code == 422, "the kind never changes"


def test_revision_guards_a_concurrent_edit(mw):
    mw.on()
    t = mw.task()
    assert mw.c.patch(f"{M}/tasks/{t['id']}", json={"title": "חדש", "revision": t["revision"]}).status_code == 200
    r = mw.c.patch(f"{M}/tasks/{t['id']}", json={"title": "ישן", "revision": t["revision"]})
    assert r.status_code == 409 and r.json()["code"] == "revision_conflict"


# ================================================================ expiry maths (injected clock, no sleeps)

def test_month_and_year_arithmetic_clamps_from_the_anchor():
    a = dt.date(2027, 1, 31)
    assert [model.occurrence(a, "month", 1, k) for k in range(4)] == [dt.date(2027, 1, 31), dt.date(2027, 2, 28), dt.date(2027, 3, 31), dt.date(2027, 4, 30)]
    assert model.next_after(dt.date(2028, 2, 29), "year", 1, dt.date(2028, 2, 29)) == dt.date(2029, 2, 28)
    assert model.next_after(dt.date(2028, 2, 29), "year", 4, dt.date(2028, 3, 1)) == dt.date(2032, 2, 29)
    assert model.next_after(dt.date(2027, 1, 1), "week", 2, dt.date(2027, 1, 1)) == dt.date(2027, 1, 15)
    assert model.next_after(dt.date(2027, 3, 1), "day", 1, dt.date(2027, 1, 1)) == dt.date(2027, 3, 1), "an anchor in the future is the next date"


def test_completion_moves_to_the_next_occurrence_never_skips_never_backfills():
    anchor, due = dt.date(2027, 1, 10), dt.date(2027, 1, 10)
    assert model.advance(anchor, "month", 1, due, dt.date(2027, 1, 5)) == dt.date(2027, 2, 10), "early: the next cycle, not the one after"
    assert model.advance(anchor, "month", 1, due, dt.date(2027, 1, 25)) == dt.date(2027, 2, 10), "late: the next date after the work"
    assert model.advance(anchor, "month", 1, due, dt.date(2027, 2, 12)) == dt.date(2027, 3, 10), "very late: the missed cycle is not asked for"
    assert model.advance(None, None, None, due, dt.date(2027, 1, 5)) is None


@pytest.mark.parametrize(("today", "state", "left"), [
    (dt.date(2027, 1, 14), "ok", 31), (dt.date(2027, 1, 15), "due_soon", 30), (dt.date(2027, 2, 14), "due_soon", 0),
    (dt.date(2027, 2, 15), "overdue", -1), (dt.date(2028, 2, 15), "overdue", -366),
])
def test_due_state_boundaries(today, state, left):
    d = model.due_state(dt.date(2027, 2, 14), 30, today)
    assert (d.state, d.days_left) == (state, left)
    assert model.due_state(dt.date(2027, 2, 14), 30, today, active=False).state == "none"
    assert model.due_state(None, 30, today).state == "none"


def test_the_local_date_follows_the_installation_zone_not_utc(mw):
    mw.on()
    t = mw.task(due_date="2027-01-15", lead_days=0)
    mw.clock = dt.datetime(2027, 1, 15, 21, 59, tzinfo=dt.timezone.utc)  # 23:59 local
    assert mw.c.get(f"{M}/tasks/{t['id']}").json()["state"] == "due_soon"
    mw.clock = dt.datetime(2027, 1, 15, 22, 0, tzinfo=dt.timezone.utc)  # 00:00 local on the 16th
    assert mw.c.get(f"{M}/tasks/{t['id']}").json()["state"] == "overdue"


def test_the_ledger_states_follow_the_clock_through_the_api(mw):
    mw.on()
    t = mw.task()  # valid until 2027-02-14, lead 30 (the certificate default)
    for when, state, left in ((at(2027, 1, 14), "ok", 31), (at(2027, 1, 15), "due_soon", 30), (at(2027, 2, 15), "overdue", -1)):
        mw.clock = when
        body = mw.c.get(f"{M}/tasks").json()
        row = next(i for i in body["items"] if i["id"] == t["id"])
        assert (row["state"], row["days_left"]) == (state, left)
        assert body["counts"][state] == 1
    assert [i["id"] for i in mw.c.get(f"{M}/tasks?state=overdue").json()["items"]] == [t["id"]]
    assert mw.c.get(f"{M}/tasks?state=ok").json()["items"] == []


# ================================================================ reminders (the worker pass)

def _notes(mw, task_id: str) -> list:
    return mw.rows("SELECT * FROM notifications WHERE subject_kind = 'maintenance' AND subject_id = ? ORDER BY created_at, id", (task_id,))


def _recipients(mw, nid: str) -> set[str]:
    return {r[0] for r in mw.rows("SELECT user_id FROM notification_recipients WHERE notification_id = ?", (nid,))}


def test_reminders_once_per_level_resolved_by_the_renewal(mw):
    mw.on()
    t = mw.task(place=mw.floor("floor2"))
    assert mw.tick(at(2027, 1, 14))["soon"] == 0 and _notes(mw, t["id"]) == []
    assert mw.tick(at(2027, 1, 15))["soon"] == 1
    assert mw.tick(at(2027, 1, 16))["soon"] == 0, "once per level for a due date"
    rows = _notes(mw, t["id"])
    assert len(rows) == 1 and rows[0]["source"] == "maintenance.due_soon" and rows[0]["state"] != "resolved"
    assert "14.02.2027" in rows[0]["body"] and "בדיקת מעלית" in rows[0]["body"]
    who = _recipients(mw, rows[0]["id"])
    assert {"dev-joni", "dev-sara"} <= who, "the maintenance managers of the place"
    assert not who & {"dev-fred", "dev-tom", "dev-vic", "dev-gil"}, "viewers of the task are not managers; others cannot see it"
    assert mw.tick(at(2027, 2, 15))["overdue"] == 1
    assert mw.tick(at(2027, 2, 20))["overdue"] == 0
    rows = {r["source"]: r for r in _notes(mw, t["id"])}
    assert rows["maintenance.due_soon"]["state"] == "resolved" and rows["maintenance.overdue"]["state"] != "resolved"
    # the renewal (a certificate: maintenance.manage) closes the reminder and moves the date
    r = mw.c.post(f"{M}/tasks/{t['id']}/complete", json={"performed_on": "2027-02-18", "valid_until": "2028-02-14", "note": "אושר"})
    assert r.status_code == 200, r.text
    assert r.json()["task"]["due_date"] == "2028-02-14" and r.json()["task"]["state"] == "ok"
    assert r.json()["record"]["due_before"] == "2027-02-14" and r.json()["record"]["valid_until"] == "2028-02-14"
    assert all(n["state"] == "resolved" for n in _notes(mw, t["id"]))
    assert mw.tick(at(2027, 2, 21)) == {"tasks": 1, "soon": 0, "overdue": 0, "tickets": 0, "ticket_errors": 0}


def test_the_responsible_person_is_told_only_when_they_may_see_the_task(mw):
    mw.on()
    t3 = mw.task(place=mw.floor("floor3"), owner_user_id="dev-fred")  # fred cannot see floor 3
    t2 = mw.task(place=mw.floor("floor2"), owner_user_id="dev-fred")
    mw.tick(at(2027, 1, 15))
    assert "dev-fred" not in _recipients(mw, _notes(mw, t3["id"])[0]["id"])
    assert "dev-sara" not in _recipients(mw, _notes(mw, t3["id"])[0]["id"]), "sara manages floor 2, not floor 3"
    assert "dev-fred" in _recipients(mw, _notes(mw, t2["id"])[0]["id"])


def test_a_notification_is_visible_exactly_like_its_task(mw):
    from smplwise.services.notify_visibility import Reach, principal_of

    mw.on()
    t = mw.task(place=mw.floor("floor2"))
    mw.tick(at(2027, 1, 15))
    n = dict(_notes(mw, t["id"])[0])
    with mw.db.connection(mode="read") as conn:
        assert Reach(conn, principal_of(conn, "dev-fred")).can_see(n)
        assert not Reach(conn, principal_of(conn, "dev-gil")).can_see(n)
        assert not Reach(conn, principal_of(conn, "dev-vic")).can_see(n)
    assert mw.c.patch(f"{API}/settings", json={"maintenance.enabled": "false"}).status_code == 200
    with mw.db.connection(mode="read") as conn:
        assert not Reach(conn, principal_of(conn, "dev-fred")).can_see(n), "module off: nobody"


def test_paused_rescheduled_and_deleted_tasks_stop_reminding(mw):
    mw.on()
    a, b, c = mw.task(title="א"), mw.task(title="ב"), mw.task(title="ג")
    mw.tick(at(2027, 1, 15))
    assert mw.c.patch(f"{M}/tasks/{a['id']}", json={"active": False}).status_code == 200
    assert mw.c.patch(f"{M}/tasks/{b['id']}", json={"due_date": "2027-12-31"}).status_code == 200
    assert mw.c.delete(f"{M}/tasks/{c['id']}").status_code == 200
    for t in (a, b, c):
        assert all(n["state"] == "resolved" for n in _notes(mw, t["id"])), t["title"]
    assert mw.tick(at(2027, 2, 20)) == {"tasks": 1, "soon": 0, "overdue": 0, "tickets": 0, "ticket_errors": 0}, "only b is active, and it is far"
    assert mw.c.get(f"{M}/tasks/{c['id']}").status_code == 404


def test_the_janitor_hook_runs_the_pass_and_is_throttled(mw):
    mw.on()
    t = mw.task()
    reminders.janitor(mw.db)
    assert len(_notes(mw, t["id"])) == 1
    mw.clock = at(2027, 2, 20)
    reminders.janitor(mw.db)
    assert len(_notes(mw, t["id"])) == 1, "the second call inside 15 minutes does nothing"
    reminders.reset_for_tests()
    reminders.janitor(mw.db)
    assert len(_notes(mw, t["id"])) == 2


def test_the_sources_are_catalogued_and_hidden_while_the_module_is_off(mw):
    from smplwise.services import notify_policy as p

    assert {"maintenance.due_soon", "maintenance.overdue"} <= set(p.BY_KEY) and "maintenance" in p.SUBJECT_KINDS and "maintenance" in p.RECIPIENT_RULES
    for key in ("maintenance.due_soon", "maintenance.overdue"):
        assert p.BY_KEY[key].push is False and p.BY_KEY[key].email is False, "in the app only by default"
    with mw.db.connection() as conn:
        assert not [x for x in p.list_policies(conn) if x["source"].startswith("maintenance.")]
    mw.on()
    with mw.db.connection() as conn:
        assert {x["source"] for x in p.list_policies(conn) if x["source"].startswith("maintenance.")} == {"maintenance.due_soon", "maintenance.overdue"}


# ================================================================ service requests on schedule

def _plan(mw, user: str = "joni", **extra) -> dict:
    body = {"kind": "preventive", "title": "ניקוי מסנני מזגנים", "interval": {"unit": "month", "count": 1}, "anchor_date": "2027-01-20", "due_date": None,
            "checklist": [{"key": "filters", "label": "ניקוי מסננים"}, {"key": "drain", "label": "בדיקת ניקוז"}], "auto_ticket": True, "department_id": MAINT, **extra}
    return mw.task(user, **body)


def test_scheduling_requests_into_a_department_needs_its_manager(mw):
    mw.on()
    r = mw.c.post(f"{M}/tasks", json={"kind": "preventive", "title": "x", "interval": {"unit": "month", "count": 1}, "anchor_date": "2027-02-01",
                                       "place": mw.floor("floor2"), "auto_ticket": True, "department_id": MAINT}, headers=mw.h("sara"))
    assert r.status_code == 403 and r.json()["details"]["reason"] == "not_department_manager"
    assert mw.audits("maintenance.task.department", "denied")
    bind(mw.c, mw.settings, "mona", "site_admin", "floor", mw.floors["floor2"])  # mona manages the maintenance department
    t = _plan(mw, "mona", place=mw.floor("floor2"))
    assert t["auto_ticket"] is True and t["due_date"] == "2027-01-20"


def test_a_plan_opens_one_request_per_due_date_through_the_tickets_module(mw):
    mw.on()
    t = _plan(mw, lead_days=7)
    assert mw.tick(at(2027, 1, 12))["tickets"] == 0
    assert mw.tick(at(2027, 1, 13))["tickets"] == 1
    assert mw.tick(at(2027, 1, 14))["tickets"] == 0, "one request per due date"
    tickets = mw.rows("SELECT * FROM tickets WHERE rule_ref = ?", (f"maint:{t['id']}",))
    assert len(tickets) == 1
    tk = tickets[0]
    assert (tk["origin"], tk["created_by"], tk["dedupe_key"], tk["department_id"], tk["status"]) == ("rule", "system", f"maint:{t['id']}:2027-01-20", MAINT, "new")
    assert "ניקוי מסננים" in tk["description"] and "20.01.2027" in tk["description"]
    assert tk["floor_id"] is None and tk["current_assignment_id"] is None, "placeless and unassigned (the system path)"
    assert mw.c.get(f"{M}/tasks/{t['id']}").json()["ticket_id"] == tk["id"]
    assert mw.audits("maintenance.ticket.open", "allowed")
    # carried out (an operator may) -> the next cycle opens its own request
    mw.clock = at(2027, 1, 21)
    r = mw.c.post(f"{M}/tasks/{t['id']}/complete", json={}, headers=mw.h("tom"))
    assert r.status_code == 200 and r.json()["task"]["due_date"] == "2027-02-20"
    assert mw.tick(at(2027, 2, 13))["tickets"] == 1
    assert len(mw.rows("SELECT id FROM tickets WHERE rule_ref = ?", (f"maint:{t['id']}",))) == 2


def test_no_request_while_the_tickets_module_is_off_and_no_request_action_anywhere(mw):
    mw.on()
    t = _plan(mw)
    assert mw.c.patch(f"{API}/settings", json={"tickets.enabled": "false"}).status_code == 200
    s = mw.tick(at(2027, 1, 15))
    assert s["tickets"] == 0 and s["ticket_errors"] == 1
    assert mw.rows("SELECT COUNT(*) FROM tickets")[0][0] == 0
    detail = mw.c.get(f"{M}/tasks/{t['id']}").json()
    assert detail["ticket_error"] == "tickets_off" and detail["can"]["open_request"] is False
    assert mw.c.get(f"{M}/module").json()["can"]["open_request"] is False
    rnd = _round(mw)
    run = mw.c.post(f"{M}/tasks/{rnd['id']}/runs").json()
    r = mw.c.post(f"{M}/runs/{run['id']}/items/pump/request", json={"department_id": MAINT})
    assert r.status_code == 404 and r.json()["code"] == "feature_disabled"
    assert run["can"]["open_request"] is False


def test_a_vanished_department_is_recorded_not_retried_into_a_crash(mw):
    mw.on()
    t = _plan(mw)
    with mw.db.connection() as conn:
        conn.execute("UPDATE ticket_departments SET active = 0 WHERE id = ?", (MAINT,))
    s = mw.tick(at(2027, 1, 15))
    assert s["tickets"] == 0 and s["ticket_errors"] == 1 and s["soon"] == 1, "the reminder still goes out"
    assert mw.c.get(f"{M}/tasks/{t['id']}").json()["ticket_error"] == "department_unavailable"
    assert mw.rows("SELECT COUNT(*) FROM tickets")[0][0] == 0, "nothing half-made"


# ================================================================ completion rules

def test_completion_permissions_and_checks(mw):
    mw.on()
    cert = mw.task()
    r = mw.c.post(f"{M}/tasks/{cert['id']}/complete", json={"valid_until": "2028-02-14"}, headers=mw.h("tom"))
    assert r.status_code == 403, "renewing a certificate is a manager's act"
    plan = _plan(mw, auto_ticket=False, department_id=None)
    assert mw.c.post(f"{M}/tasks/{plan['id']}/complete", json={"next_due": "2027-06-01"}, headers=mw.h("tom")).status_code == 403
    assert mw.c.post(f"{M}/tasks/{plan['id']}/complete", json={"performed_on": "2027-01-16"}).status_code == 422, "not in the future"
    assert mw.c.post(f"{M}/tasks/{cert['id']}/complete", json={"performed_on": "2027-01-10", "valid_until": "2027-01-09"}).status_code == 422
    assert mw.c.post(f"{M}/tasks/{cert['id']}/complete", json={}).status_code == 422, "a certificate without an interval needs its new date"
    assert mw.c.post(f"{M}/tasks/{cert['id']}/complete", json={"valid_until": "2028-01-01"}, headers=mw.h("vic")).status_code == 404
    yearly = mw.task(title="בדיקת גנרטור", interval={"unit": "year", "count": 1})
    r = mw.c.post(f"{M}/tasks/{yearly['id']}/complete", json={"performed_on": "2027-01-10"})
    assert r.status_code == 200 and r.json()["task"]["due_date"] == "2028-01-10", "with an interval the new date is suggested"
    r = mw.c.post(f"{M}/tasks/{plan['id']}/complete", json={"next_due": "2027-01-15"})
    assert r.status_code == 422, "an override must lie after the work"
    hist = mw.c.get(f"{M}/tasks/{yearly['id']}/records").json()["items"]
    assert len(hist) == 1 and hist[0]["kind"] == "completion" and hist[0]["performed_on"] == "2027-01-10"


# ================================================================ rounds

def _round(mw, place: dict | None = None) -> dict:
    return mw.task(kind="round", title="סבב בוקר - חדר משאבות", interval={"unit": "day", "count": 1}, anchor_date="2027-01-15", due_date=None,
                   place=place, checklist=[{"key": "pump", "label": "משאבה פועלת"},
                                           {"key": "pressure", "label": "לחץ (בר)", "kind": "number", "min": 2, "max": 6},
                                           {"key": "remark", "label": "הערה", "kind": "text", "required": False}])


def test_a_round_is_walked_marked_and_finished(mw):
    mw.on()
    rnd = _round(mw, mw.floor("floor2"))
    assert rnd["due_date"] == "2027-01-15"
    assert mw.c.post(f"{M}/tasks/{rnd['id']}/runs", headers=mw.h("vic")).status_code == 404
    assert mw.c.post(f"{M}/tasks/{rnd['id']}/runs", headers=mw.h("gil")).status_code == 404, "floor 3 operator: not his place"
    run = mw.c.post(f"{M}/tasks/{rnd['id']}/runs", headers=mw.h("fred"))
    assert run.status_code == 201, run.text
    run = run.json()
    assert run["status"] == "open" and [i["key"] for i in run["checklist"]] == ["pump", "pressure", "remark"]
    again = mw.c.post(f"{M}/tasks/{rnd['id']}/runs", headers=mw.h("tom"))
    assert again.status_code == 409 and again.json()["details"]["run_id"] == run["id"]
    assert mw.c.put(f"{M}/runs/{run['id']}/answers", json={"answers": {"pump": {"ok": True}}}, headers=mw.h("tom")).status_code == 403, "not his run"
    r = mw.c.put(f"{M}/runs/{run['id']}/answers", json={"answers": {"pump": {"ok": True}}}, headers=mw.h("fred"))
    assert r.status_code == 200 and r.json()["answers"]["pump"]["ok"] is True and "at" in r.json()["answers"]["pump"]
    r = mw.c.post(f"{M}/runs/{run['id']}/finish", headers=mw.h("fred"))
    assert r.status_code == 409 and r.json()["details"]["missing"] == ["pressure"]
    for bad in ({"nope": {"ok": True}}, {"pressure": {"value": "high"}}, {"pump": {"ok": "yes"}}, {"pump": {"ok": True, "gps": [1, 2]}}):
        assert mw.c.put(f"{M}/runs/{run['id']}/answers", json={"answers": bad}, headers=mw.h("fred")).status_code == 422, bad
    r = mw.c.put(f"{M}/runs/{run['id']}/answers", json={"answers": {"pressure": {"value": 7.5, "note": "גבוה"}}}, headers=mw.h("fred"))
    assert r.json()["answers"]["pressure"]["ok"] is False, "outside its range"
    r = mw.c.post(f"{M}/runs/{run['id']}/finish", json={"note": "נמצאה חריגה"}, headers=mw.h("fred"))
    assert r.status_code == 200, r.text
    assert (r.json()["status"], r.json()["result"], r.json()["due_after"]) == ("done", "issues", "2027-01-16")
    assert mw.c.get(f"{M}/tasks/{rnd['id']}").json()["due_date"] == "2027-01-16"
    assert mw.c.put(f"{M}/runs/{run['id']}/answers", json={"answers": {"pump": {"ok": False}}}, headers=mw.h("fred")).status_code == 409
    stored = mw.rows("SELECT answers_json FROM maint_records WHERE id = ?", (run["id"],))[0][0]
    assert "lat" not in stored and "gps" not in stored, "the time of each mark only - never a position"
    # a manager may cancel someone else's run; a round is not "completed" through the plan route
    run2 = mw.c.post(f"{M}/tasks/{rnd['id']}/runs", headers=mw.h("fred")).json()
    assert mw.c.post(f"{M}/runs/{run2['id']}/cancel", headers=mw.h("tom")).status_code == 403
    assert mw.c.post(f"{M}/runs/{run2['id']}/cancel", headers=mw.h("sara")).json()["status"] == "cancelled"
    assert mw.c.post(f"{M}/tasks/{rnd['id']}/complete", json={}).status_code == 409
    assert mw.c.get(f"{M}/runs/{run['id']}", headers=mw.h("gil")).status_code == 404


def test_a_checkpoint_opens_a_service_request_as_the_person(mw):
    mw.on()
    rnd = _round(mw, mw.floor("floor2"))
    run = mw.c.post(f"{M}/tasks/{rnd['id']}/runs", headers=mw.h("fred")).json()
    mw.c.put(f"{M}/runs/{run['id']}/answers", json={"answers": {"pump": {"ok": False, "note": "רעש חריג"}}}, headers=mw.h("fred"))
    assert mw.c.post(f"{M}/runs/{run['id']}/items/nope/request", json={"department_id": MAINT}, headers=mw.h("fred")).status_code == 404
    r = mw.c.post(f"{M}/runs/{run['id']}/items/pump/request", json={"department_id": MAINT}, headers=mw.h("fred"))
    assert r.status_code == 201, r.text
    tid = r.json()["ticket_id"]
    tk = mw.rows("SELECT * FROM tickets WHERE id = ?", (tid,))[0]
    assert tk["created_by"] == "dev-fred" and tk["origin"] == "manual" and "משאבה פועלת" in tk["title"] and "רעש חריג" in tk["description"]
    assert mw.c.get(f"{API}/tickets/{tid}", headers=mw.h("fred")).status_code == 200, "the creator sees his request"
    again = mw.c.post(f"{M}/runs/{run['id']}/items/pump/request", json={"department_id": MAINT}, headers=mw.h("fred"))
    assert again.status_code == 409 and again.json()["code"] == "request_exists"
    assert mw.c.get(f"{M}/runs/{run['id']}").json()["ticket_ids"] == [tid]
    r = mw.c.post(f"{M}/runs/{run['id']}/items/pressure/request", json={"department_id": MAINT}, headers=mw.h("vic"))
    assert r.status_code == 404, "vic cannot see the run"


# ================================================================ QR / NFC tags

def test_tags_resolve_only_for_people_who_may_see_their_target(mw):
    mw.on()
    rnd = _round(mw, mw.floor("floor2"))
    tag = mw.c.post(f"{M}/tags", json={"target_kind": "task", "target_id": rnd["id"], "label": "חדר משאבות"})
    assert tag.status_code == 201, tag.text
    tag = tag.json()
    assert len(tag["token"]) >= 20 and tag["path"] == f"#/m/{tag['token']}"
    assert all(tag["token"] not in (a["details_json"] or "") for a in mw.audits("maintenance.tag.create")), "the token is never in the audit"
    r = mw.c.get(f"{M}/scan/{tag['token']}", headers=mw.h("fred"))
    assert r.status_code == 200 and r.json()["kind"] == "task" and r.json()["task"]["can"]["start_round"] is True
    for user in ("gil", "vic"):
        assert mw.c.get(f"{M}/scan/{tag['token']}", headers=mw.h(user)).status_code in (403, 404), user
    assert mw.c.get(f"{M}/scan/{tag['token']}", headers=mw.h("gil")).json()["code"] == "maint_tag_not_found"
    assert mw.c.get(f"{M}/scan/{'B' * 22}").status_code == 404
    assert mw.c.post(f"{M}/tags", json={"target_kind": "entity", "target_id": "sensor.hidden_pump"}).status_code == 422, "an unreadable device is unknown"
    assert mw.c.post(f"{M}/tags", json={"target_kind": "task", "target_id": rnd["id"]}, headers=mw.h("fred")).status_code == 403
    assert {t["id"] for t in mw.c.get(f"{M}/tags", headers=mw.h("sara")).json()["items"]} == {tag["id"]}
    assert mw.c.delete(f"{M}/tags/{tag['id']}", headers=mw.h("tom")).status_code == 403
    assert mw.c.delete(f"{M}/tags/{tag['id']}", headers=mw.h("sara")).json()["revoked_at"]
    assert mw.c.get(f"{M}/scan/{tag['token']}", headers=mw.h("fred")).status_code == 404
    other = mw.c.post(f"{M}/tags", json={"target_kind": "task", "target_id": rnd["id"]}).json()
    mw.c.delete(f"{M}/tasks/{rnd['id']}")
    assert mw.c.get(f"{M}/scan/{other['token']}").status_code == 404, "deleting the task revokes its tags"


# ================================================================ cards: elevator / generator / supplier

def test_the_elevator_card_and_the_supplier_documents(mw):
    mw.on()
    eid = new_id()
    with mw.db.connection() as conn:
        conn.execute("INSERT INTO infra_elevators(id, name, name_key, created_at, updated_at) VALUES (?, 'מעלית צפונית', 'מעלית צפונית', 't', 't')", (eid,))
    vid = mw.vendor()
    cert = mw.task(elevator_id=eid, vendor_id=vid)
    body = mw.c.get(f"{M}/by-subject/elevator/{eid}").json()
    assert body["state"] == "due_soon" and [i["id"] for i in body["items"]] == [cert["id"]] and body["items"][0]["elevator_name"] == "מעלית צפונית"
    assert mw.c.get(f"{M}/by-subject/elevator/nope").status_code == 404
    assert mw.c.get(f"{M}/by-subject/generator/nope").status_code == 404
    assert mw.c.get(f"{M}/by-subject/elevator/{eid}", headers=mw.h("vic")).status_code == 403
    ins = mw.task(kind="vendor_document", title="ביטוח צד ג'", vendor_id=vid, doc_type="insurance", due_date="2027-01-10")
    mw.task(kind="vendor_document", title="אישור עבודה בגובה", vendor_id=vid, doc_type="work_at_height", due_date="2027-02-01")
    docs = mw.c.get(f"{M}/vendors/{vid}/documents").json()
    assert docs["state"] == "expired" and {d["doc_type"] for d in docs["documents"]} == {"insurance", "work_at_height"}
    assert mw.c.get(f"{M}/vendors/{vid}/documents", headers=mw.h("fred")).json()["state"] == "expired", "supplier documents: view at any scope (q15)"
    assert mw.c.get(f"{M}/vendors/{vid}/documents", headers=mw.h("vic")).status_code == 403
    with mw.db.connection(mode="read") as conn:
        st = msvc.vendor_status(conn, [vid, "unknown"], dt.date(2027, 1, 15))
    assert st[vid]["state"] == "expired" and st[vid]["expired"] == [{"doc_type": "insurance", "valid_until": "2027-01-10"}]
    assert st[vid]["expiring"] == [{"doc_type": "work_at_height", "valid_until": "2027-02-01"}] and "unknown" not in st
    mw.c.post(f"{M}/tasks/{ins['id']}/complete", json={"valid_until": "2028-01-10"})
    with mw.db.connection(mode="read") as conn:
        assert msvc.vendor_status(conn, [vid], dt.date(2027, 1, 15))[vid]["state"] == "expiring"
    assert mw.c.patch(f"{API}/settings", json={"maintenance.enabled": "false"}).status_code == 200
    with mw.db.connection(mode="read") as conn:
        assert msvc.vendor_status(conn, [vid], dt.date(2027, 1, 15)) == {}, "module off: no mark anywhere"


# ================================================================ slice 2 (owner answers 24.10 q13-q20)

def test_the_default_lead_per_kind_is_a_setting(mw):
    mw.on()
    assert mw.task()["lead_days"] == 30, "built-in default"
    assert mw.c.patch(f"{API}/settings", json={"maintenance.lead_days.certificate": "60", "maintenance.lead_days.preventive": "3"}).status_code == 200
    assert mw.task()["lead_days"] == 60
    assert mw.task(lead_days=5)["lead_days"] == 5, "a task's own value wins"
    assert _plan(mw, auto_ticket=False, department_id=None)["lead_days"] == 3
    for bad in ("366", "-1", "abc", "1.5"):
        assert mw.c.patch(f"{API}/settings", json={"maintenance.lead_days.round": bad}).status_code == 422, bad
    assert mw.c.patch(f"{API}/settings", json={"maintenance.lead_days.round": "2"}, headers=mw.h("tom")).status_code == 403
    assert mw.c.patch(f"{API}/settings", json={"maintenance.tag_base_url": "javascript:alert(1)"}).status_code == 422
    assert mw.c.patch(f"{API}/settings", json={"maintenance.tag_base_url": "https://arx.example.test"}).status_code == 200
    opts = mw.c.get(f"{M}/options").json()
    assert opts["defaults"] == {"lead_days": {"certificate": 60, "preventive": 3, "round": 0, "vendor_document": 30}, "tag_base_url": "https://arx.example.test"}
    assert mw.c.get(f"{M}/tags").json()["base_url"] == "https://arx.example.test"


def test_form_options_are_for_managers_and_list_only_their_places(mw):
    mw.on()
    vid = mw.vendor("חשמל השרון")
    assert mw.c.get(f"{M}/options", headers=mw.h("tom")).status_code == 403, "an operator never gets the form"
    mine = mw.c.get(f"{M}/options", headers=mw.h("sara")).json()
    assert {(p["kind"], p["id"]) for p in mine["places"]} == {("floor", mw.floors["floor2"])}, "sara manages floor 2 only"
    assert mine["placeless"] is True and mine["tickets_on"] is True
    full = mw.c.get(f"{M}/options").json()
    assert {"floor", "building"} <= {p["kind"] for p in full["places"]}
    assert vid in {v["id"] for v in full["vendors"]} and MAINT in {d["id"] for d in full["departments"]}
    assert "dev-fred" in {p["id"] for p in full["people"]} and "fire" in full["categories"] and "insurance" in full["doc_types"]
    mw.task(kind="vendor_document", title="ביטוח", vendor_id=vid, doc_type="insurance", due_date="2027-01-10")
    vs = {v["id"]: v for v in mw.c.get(f"{M}/vendors", headers=mw.h("fred")).json()["items"]}
    assert vs[vid]["state"] == "expired" and vs[vid]["expired"] == [{"doc_type": "insurance", "valid_until": "2027-01-10"}]
    assert mw.c.get(f"{M}/vendors", headers=mw.h("vic")).status_code == 403
    card = mw.c.get(f"{M}/vendors/{vid}/documents").json()
    assert card["name"] == "חשמל השרון" and card["tasks"] == []


def test_the_list_carries_the_place_chain_and_the_round_summary(mw):
    mw.on()
    rnd = _round(mw, mw.floor("floor2"))
    row = next(i for i in mw.c.get(f"{M}/tasks").json()["items"] if i["id"] == rnd["id"])
    assert [p["kind"] for p in row["place_path"]] == ["site", "building", "floor"][-len(row["place_path"]):] and row["place_path"][-1]["id"] == mw.floors["floor2"]
    assert row["checklist_count"] == 3 and row["open_run"] is None and row["last_run"] is None
    run = mw.c.post(f"{M}/tasks/{rnd['id']}/runs", headers=mw.h("fred")).json()
    mw.c.put(f"{M}/runs/{run['id']}/answers", json={"answers": {"pump": {"ok": False}}}, headers=mw.h("fred"))
    row = next(i for i in mw.c.get(f"{M}/tasks").json()["items"] if i["id"] == rnd["id"])
    assert row["open_run"]["answered"] == 1 and row["open_run"]["total"] == 3 and row["open_run"]["id"] == run["id"]
    mw.c.put(f"{M}/runs/{run['id']}/answers", json={"answers": {"pressure": {"value": 4}}}, headers=mw.h("fred"))
    mw.c.post(f"{M}/runs/{run['id']}/finish", headers=mw.h("fred"))
    row = next(i for i in mw.c.get(f"{M}/tasks").json()["items"] if i["id"] == rnd["id"])
    assert row["open_run"] is None and row["last_run"]["issues"] == 1 and row["last_run"]["result"] == "issues"
    assert mw.task(title="ללא מקום")["place_path"] == []


def test_closing_the_request_a_plan_opened_marks_the_plan_done_with_the_closer(mw):
    mw.on()
    t = _plan(mw, lead_days=7)
    mw.tick(at(2027, 1, 14))
    tid = mw.c.get(f"{M}/tasks/{t['id']}").json()["ticket_id"]
    assert tid
    mw.clock = at(2027, 1, 16)
    tk = mw.c.get(f"{API}/tickets/{tid}").json()
    r = mw.c.post(f"{API}/tickets/{tid}/status", json={"to": "closed", "note": "בוצע", "revision": tk["revision"]})
    assert r.status_code == 200, r.text
    after = mw.c.get(f"{M}/tasks/{t['id']}").json()
    assert after["due_date"] == "2027-02-20", "the plan moved to its next occurrence"
    rec = mw.c.get(f"{M}/tasks/{t['id']}/records").json()["items"][0]
    assert rec["kind"] == "completion" and rec["started_by_name"] and rec["ticket_ids"] == [tid] and rec["performed_on"] == "2027-01-16"
    assert any(a["resource_id"] == t["id"] and "ticket_closed" in (a["details_json"] or "") for a in mw.audits("maintenance.task.complete", "allowed"))
    # a request of a cycle that is already done changes nothing (no second record)
    with mw.db.connection() as conn:
        assert msvc.on_ticket_closed(conn, {"id": tid}, "dev-joni", "2027-01-16T10:00:00Z") is None
    assert len(mw.c.get(f"{M}/tasks/{t['id']}/records").json()["items"]) == 1


def test_a_tag_keeps_its_medium_and_the_time_of_the_last_scan_only(mw):
    mw.on()
    rnd = _round(mw, mw.floor("floor2"))
    tag = mw.c.post(f"{M}/tags", json={"target_kind": "task", "target_id": rnd["id"], "label": "חדר משאבות", "medium": "nfc"}).json()
    assert tag["medium"] == "nfc" and tag["last_scan_at"] is None and tag["target_name"] == rnd["title"] and tag["target_task_kind"] == "round"
    assert mw.c.post(f"{M}/tags", json={"target_kind": "task", "target_id": rnd["id"], "medium": "rfid"}).status_code == 422
    scan = mw.c.get(f"{M}/scan/{tag['token']}", headers=mw.h("fred")).json()
    assert scan["route"] == f"#/tickets/maintenance?task={rnd['id']}"
    listed = mw.c.get(f"{M}/tags").json()["items"][0]
    assert listed["last_scan_at"] and set(listed) >= {"medium", "target_name"}
    assert "dev-fred" not in json.dumps(listed), "never who scanned"


def test_maintenance_tables_travel_in_the_project_backup_restore_drill(mw, settings, tmp_path):
    from dataclasses import replace

    from fastapi.testclient import TestClient

    from smplwise.main import create_app
    from smplwise.services import backup as bsvc

    assert bsvc.MAINTENANCE_TABLES == ["maint_tasks", "maint_records", "maint_tags"] and set(bsvc.MAINTENANCE_TABLES) <= set(bsvc.PROJECT_TABLES)
    assert set(bsvc.MAINTENANCE_TABLES) <= bsvc.KEEP_WHEN_ABSENT
    mw.on()
    rnd = _round(mw)
    cert = mw.task(interval={"unit": "year", "count": 1})
    mw.c.post(f"{M}/tasks/{cert['id']}/complete", json={"performed_on": "2027-01-10"})
    tag = mw.c.post(f"{M}/tags", json={"target_kind": "task", "target_id": rnd["id"]}).json()
    e = mw.c.post(f"{API}/backups", json={}).json()
    assert e["tables"]["maint_tasks"] == 2 and e["tables"]["maint_records"] == 1 and e["tables"]["maint_tags"] == 1
    raw = mw.c.get(f"{API}/backups/{e['name']}/download").content
    # restore drill: a fresh installation gets the ledger back, ids, dates and the tag token included
    c2 = TestClient(create_app(replace(settings, data_dir=tmp_path / "data2")))
    up = c2.post(f"{API}/backups/upload", files={"file": ("m.zip", raw, "application/zip")})
    res = c2.post(f"{API}/backups/{up.json()['name']}/restore", json={"mode": "replace", "scope": "project", "confirm": "RESTORE"})
    assert res.status_code == 200, res.text
    assert res.json()["tables"]["maint_tasks"] == 2 and res.json()["tables"]["maint_records"] == 1
    db2 = Database(replace(settings, data_dir=tmp_path / "data2").db_path)
    with db2.connection(mode="read") as conn:
        assert {r["id"]: r["due_date"] for r in conn.execute("SELECT id, due_date FROM maint_tasks")} == {rnd["id"]: rnd["due_date"], cert["id"]: "2028-01-10"}
        assert conn.execute("SELECT token FROM maint_tags").fetchone()[0] == tag["token"]