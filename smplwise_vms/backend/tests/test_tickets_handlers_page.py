"""CR-038 owner request 2026-10-14 ("מטפלים וספקים"): an employee WITHOUT an Arx account is a directory row of the kind "employee"
(migration 0084: a person row with employee = 1). It is created / edited / erased / exported like any contact (tickets.configure),
listed by its own kind filter, never names an internal user or a vendor, and is assigned through the same handler-link path as a
contact (the assign dialog's `contacts` carry it as `contact_kind: "employee"`)."""
from __future__ import annotations

import pytest

from smplwise import db as dbmod
from tickets_s4_world import API, build_s4


@pytest.fixture()
def s4(settings, monkeypatch):
    return build_s4(settings, monkeypatch)


def employee(s4, **body):
    payload = {"kind": "employee", "display_name": "יוסי טכנאי", "phone": "050-000-0077", "lang": "he", **body}
    return s4.c.post(f"{API}/tickets/contacts", json=payload)


def test_0084_adds_the_employee_flag_with_a_check():
    sql = (dbmod.MIGRATIONS_DIR / "0084_ticket_contact_employee.sql").read_text(encoding="utf-8")
    assert "ALTER TABLE ticket_contacts ADD COLUMN employee" in sql and "CHECK (employee IN (0, 1))" in sql
    assert "DROP TABLE" not in sql.upper(), "no rebuild of a parent table inside the migration's transaction"


def test_an_employee_is_created_listed_by_its_kind_and_stored_as_a_flagged_person(s4):
    r = employee(s4, departments=["dept-maintenance"])
    assert r.status_code == 201, r.text
    e = r.json()
    assert e["kind"] == "employee" and e["user_linked"] is False and e["departments"] == ["dept-maintenance"]
    with s4.db.connection(mode="read") as conn:
        row = dict(conn.execute("SELECT kind, employee, vendor_id, user_id FROM ticket_contacts WHERE id = ?", (e["id"],)).fetchone())
    assert row == {"kind": "person", "employee": 1, "vendor_id": None, "user_id": None}
    only = s4.c.get(f"{API}/tickets/contacts", params={"kind": "employee"}).json()["contacts"]
    assert [c["id"] for c in only] == [e["id"]]
    persons = s4.c.get(f"{API}/tickets/contacts", params={"kind": "person"}).json()["contacts"]
    assert e["id"] not in {c["id"] for c in persons} and s4.contact["id"] in {c["id"] for c in persons}
    assert all(c["kind"] == "vendor" for c in s4.c.get(f"{API}/tickets/contacts", params={"kind": "vendor"}).json()["contacts"])


def test_an_employee_never_names_a_user_or_a_vendor(s4):
    r = employee(s4, user_id="dev-joni")
    assert r.status_code == 422 and r.json()["details"]["fields"][0] == {"field": "user_id", "code": "employee"}
    r = employee(s4, vendor_id=s4.vendor["id"])
    assert r.status_code == 422 and r.json()["details"]["fields"][0]["field"] == "vendor_id"


def test_a_person_of_a_vendor_turned_employee_leaves_the_vendor(s4):
    p = s4.add_contact(display_name="דני", phone="050-000-0078", vendor_id=s4.vendor["id"]).json()
    r = s4.c.patch(f"{API}/tickets/contacts/{p['id']}", json={"kind": "employee", "revision": p["revision"]})
    assert r.status_code == 200, r.text
    assert r.json()["kind"] == "employee" and r.json()["vendor_id"] is None
    back = s4.c.patch(f"{API}/tickets/contacts/{p['id']}", json={"kind": "person", "revision": r.json()["revision"]})
    assert back.status_code == 200 and back.json()["kind"] == "person"


def test_only_the_configure_permission_creates_an_employee_and_managers_see_masked_phones(s4):
    assert s4.c.post(f"{API}/tickets/contacts", json={"kind": "employee", "display_name": "x"}, headers=s4.h("mona")).status_code == 403
    e = employee(s4).json()
    rows = {c["id"]: c for c in s4.c.get(f"{API}/tickets/contacts", params={"kind": "employee"}, headers=s4.h("mona")).json()["contacts"]}
    assert rows[e["id"]]["phone"] == "•••• 0077" and rows[e["id"]]["phone_full"] is False


def test_an_employee_is_offered_in_the_assign_dialog_and_assigned_through_a_handler_link(s4):
    e = employee(s4, departments=["dept-maintenance"]).json()
    t = s4.ticket()
    r = s4.c.get(f"{API}/tickets/assignees", params={"department_id": "dept-maintenance", "ticket_id": t["id"]})
    kinds = [(c["contact_kind"], c["id"]) for c in r.json()["contacts"]]
    assert kinds[0] == ("employee", e["id"]), "employees first, then vendors, then contacts"
    res = s4.assign_contact(t["id"], e["id"])
    assert res.status_code == 200, res.text
    assert res.json()["assignee"]["kind"] == "contact" and s4.link_row(t["id"])["contact_id"] == e["id"]


def test_export_and_erase_of_an_employee(s4):
    e = employee(s4).json()
    x = s4.c.get(f"{API}/tickets/contacts/{e['id']}/export")
    assert x.status_code == 200 and x.json()["contact"]["kind"] == "employee"
    r = s4.c.post(f"{API}/tickets/contacts/{e['id']}/erase", json={"confirm": True})
    assert r.status_code == 200 and r.json()["erased"] is True
