"""TKSTAFF2 (owner 2026-10-16): a staff member created in "ללא חשבון" (an employee without an account - 0084) is a HANDLER like an
account holder (services/tickets/assignees.py): listed in the one picker list `handlers` of GET /tickets/assignees, assigned by a
department manager without `tickets.external` (from the dialog, at creation, in bulk), shown on the board / table / timeline, sent the
SAME handler link and assignment message as every contact - and gets no login. Outside contacts keep every rule of slice 4. Erasing
or deactivating the row never orphans the history. Every name and number is invented (the 050-000-xxxx block)."""
from __future__ import annotations

import pytest

from tickets_s4_world import API, build_s4, crid

MAINT = "dept-maintenance"


@pytest.fixture()
def s4(settings, monkeypatch):
    return build_s4(settings, monkeypatch)


def employee(s4, **body):
    payload = {"kind": "employee", "display_name": "יוסי טכנאי", "phone": "050-000-0077", "lang": "he", **body}
    r = s4.c.post(f"{API}/tickets/contacts", json=payload)
    assert r.status_code == 201, r.text
    return r.json()


def picker(s4, ticket_id: str | None = None, user: str = "joni", dept: str = MAINT):
    params = {"department_id": dept, **({"ticket_id": ticket_id} if ticket_id else {})}
    r = s4.c.get(f"{API}/tickets/assignees", params=params, headers=s4.h(user))
    assert r.status_code == 200, r.text
    return r.json()


def audit_details(s4, action: str) -> list[str]:
    with s4.db.connection(mode="read") as conn:
        return [r[0] or "" for r in conn.execute("SELECT details_json FROM audit_log WHERE action = ?", (action,)).fetchall()]


# ---------------------------------------------------------------- the picker: one list, both kinds


def test_handlers_lists_account_holders_and_staff_contacts_in_one_shape(s4):
    e = employee(s4, departments=[MAINT])
    t = s4.ticket()
    x = picker(s4, t["id"])
    keys = [h["key"] for h in x["handlers"]]
    assert f"contact:{e['id']}" in keys and "user:dev-mona" in keys
    staff = next(h for h in x["handlers"] if h["id"] == e["id"])
    assert staff == {"key": f"contact:{e['id']}", "kind": "contact", "id": e["id"], "name": "יוסי טכנאי", "account": False, "member_role": None,
                     "phone": "050-000-0077", "has_phone": True, "preferred_channel": "whatsapp"}
    users = [h for h in x["handlers"] if h["account"]]
    assert users and all(h["kind"] == "user" and h["key"] == f"user:{h['id']}" for h in users)
    assert keys.index(f"contact:{e['id']}") > max(keys.index(h["key"]) for h in users), "account holders first, then staff"
    assert e["id"] not in {c["id"] for c in x["contacts"]}, "`contacts` holds the outside contacts only"
    assert {c["id"] for c in x["contacts"]} == {s4.contact["id"], s4.vendor["id"]}


def test_a_manager_without_the_outside_permission_sees_staff_with_a_masked_phone_and_no_outside_contacts(s4):
    e = employee(s4)
    t = s4.ticket()
    x = picker(s4, t["id"], user="mona")
    staff = next(h for h in x["handlers"] if h["id"] == e["id"])
    assert staff["phone"] == "•••• 0077" and staff["account"] is False
    assert x["contacts"] == [] and x["external"] is False


def test_inactive_erased_and_other_department_staff_are_not_offered(s4):
    other = employee(s4, display_name="רק ניקיון", phone="050-000-0078", departments=[s4.w.cleaning])
    off = employee(s4, display_name="לא פעיל", phone="050-000-0079")
    s4.c.patch(f"{API}/tickets/contacts/{off['id']}", json={"active": False, "revision": off["revision"]})
    gone = employee(s4, display_name="נמחק", phone="050-000-0081")
    s4.c.post(f"{API}/tickets/contacts/{gone['id']}/erase", json={"confirm": True})
    ids = {h["id"] for h in picker(s4)["handlers"]}
    assert not ids & {other["id"], off["id"], gone["id"]}
    assert other["id"] in {h["id"] for h in picker(s4, dept=s4.w.cleaning)["handlers"]}


# ---------------------------------------------------------------- assigning: as an account holder, through the contact link path


def test_a_department_manager_assigns_staff_without_the_outside_permission_and_it_shows_everywhere(s4):
    e = employee(s4)
    t = s4.ticket()
    r = s4.assign_contact(t["id"], e["id"], user="mona")
    assert r.status_code == 200, r.text
    d = r.json()
    assert d["assignee"]["kind"] == "contact" and d["assignee"]["id"] == e["id"] and d["assignee"]["name"] == "יוסי טכנאי"
    assert s4.link_row(t["id"])["contact_id"] == e["id"], "the same scoped handler link as every contact"
    ev = next(x for x in d["events"] if x["kind"] == "assigned")
    assert ev["data"]["assignee"] == "יוסי טכנאי" and ev["data"]["contact_kind"] == "employee"
    assert d["link"]["can"]["copy"] is True, "the manager handles the staff link like the assignment"
    assert s4.copy(t["id"], user="mona").status_code == 200
    # board and table: the card names them, the assignee filter finds them
    board = s4.c.get(f"{API}/tickets/board", params={"assignee": f"contact:{e['id']}"}, headers=s4.h("mona")).json()
    assert [i["id"] for i in board["items"]] == [t["id"]] and board["items"][0]["assignee"]["name"] == "יוסי טכנאי"
    assert any(h["key"] == f"contact:{e['id']}" and h["name"] == "יוסי טכנאי" for h in board["handling"])
    table = s4.c.get(f"{API}/tickets/table", params={"assignee": f"contact:{e['id']}"}, headers=s4.h("mona")).json()
    assert [i["id"] for i in table["items"]] == [t["id"]]
    # the audit rows name ids and flags - never the phone or the name
    for details in audit_details(s4, "ticket.assign") + audit_details(s4, "ticket.link.copy"):
        assert "0077" not in details and "יוסי" not in details


def test_permissions_unchanged_for_outside_contacts_and_for_non_managers(s4):
    e = employee(s4)
    t = s4.ticket()
    r = s4.assign_contact(t["id"], user="mona")  # an outside contact: still needs tickets.external
    assert r.status_code == 403 and r.json()["details"]["reason"] == "external_permission_missing"
    r = s4.assign_contact(t["id"], e["id"], user="tom")  # a member (not a manager) assigns nobody
    assert r.status_code in (403, 404)
    assert s4.c.get(f"{API}/tickets/assignees", params={"department_id": MAINT}, headers=s4.h("tom")).status_code == 403


def test_a_staff_contact_gets_no_login(s4):
    e = employee(s4)
    with s4.db.connection(mode="read") as conn:
        assert conn.execute("SELECT user_id FROM ticket_contacts WHERE id = ?", (e["id"],)).fetchone()[0] is None
        assert conn.execute("SELECT COUNT(*) FROM users WHERE display_name = ?", ("יוסי טכנאי",)).fetchone()[0] == 0


def test_staff_is_assigned_at_creation_time_and_a_refusal_writes_no_ticket(s4):
    e = employee(s4)
    body = {"department_id": MAINT, "title": "נורה שרופה", "client_request_id": crid(), "assign": {"kind": "contact", "id": e["id"]}}
    r = s4.c.post(f"{API}/tickets", json=body, headers=s4.h("mona"))
    assert r.status_code == 201, r.text
    assert r.json()["assignee"]["id"] == e["id"] and r.json()["status"] == "assigned"
    with s4.db.connection(mode="read") as conn:
        before = conn.execute("SELECT COUNT(*) FROM tickets").fetchone()[0]
    elsewhere = employee(s4, display_name="רק ניקיון", phone="050-000-0078", departments=[s4.w.cleaning])
    r = s4.c.post(f"{API}/tickets", json={**body, "client_request_id": crid(), "assign": {"kind": "contact", "id": elsewhere["id"]}}, headers=s4.h("mona"))
    assert r.status_code == 409 and r.json()["code"] == "assignee_not_allowed"
    r = s4.c.post(f"{API}/tickets", json={**body, "client_request_id": crid(), "assign": {"kind": "contact", "id": s4.vendor["id"]}})
    assert r.status_code == 409 and r.json()["code"] == "public_link_unavailable", "an outside contact at creation stays refused"
    with s4.db.connection(mode="read") as conn:
        assert conn.execute("SELECT COUNT(*) FROM tickets").fetchone()[0] == before


def test_staff_is_assigned_in_bulk(s4):
    e = employee(s4)
    a, b = s4.ticket(title="א"), s4.ticket(title="ב")
    items = [{"id": t["id"], "revision": s4.w.detail(t["id"])["revision"]} for t in (a, b)]
    r = s4.c.post(f"{API}/tickets/bulk", json={"action": "assign", "items": items, "params": {"assignee": {"kind": "contact", "id": e["id"]}},
                                               "client_request_id": crid()}, headers=s4.h("mona"))
    assert r.status_code == 200, r.text
    assert r.json()["done"] == 2, r.json()
    assert all(s4.w.detail(t["id"])["assignee"]["id"] == e["id"] for t in (a, b))


# ---------------------------------------------------------------- the history survives deactivation and erasure


def test_deactivating_or_erasing_staff_keeps_the_history(s4):
    e = employee(s4)
    t = s4.ticket()
    assert s4.assign_contact(t["id"], e["id"]).status_code == 200
    row = s4.c.get(f"{API}/tickets/contacts/{e['id']}").json()
    assert s4.c.patch(f"{API}/tickets/contacts/{e['id']}", json={"active": False, "revision": row["revision"]}).status_code == 200
    d = s4.w.detail(t["id"])
    assert d["assignee"]["name"] == "יוסי טכנאי" and any(x["kind"] == "assigned" and x["data"]["assignee"] == "יוסי טכנאי" for x in d["events"])
    assert e["id"] not in {h["id"] for h in picker(s4, t["id"])["handlers"]}, "a deactivated row is not offered again"
    assert s4.c.post(f"{API}/tickets/contacts/{e['id']}/erase", json={"confirm": True}).status_code == 200
    d = s4.w.detail(t["id"])
    assert any(a["name"] == "יוסי טכנאי" for a in d["assignments"]), "erase without 'history' keeps the frozen name"
    with s4.db.connection(mode="read") as conn:
        asg = conn.execute("SELECT contact_id FROM ticket_assignments WHERE ticket_id = ?", (t["id"],)).fetchone()
    assert asg[0] == e["id"], "the assignment still points at the (tombstoned) row - nothing orphaned"


# ---------------------------------------------------------------- the same message mechanism as every contact

from test_tickets_s5b_channel import env  # noqa: E402,F401 - the slice-5b world (fake ha-whatsapp, mapped account, switch on)


def test_a_manager_without_the_outside_permission_sends_staff_the_whatsapp_link(env):
    e = env.c.post(f"{API}/tickets/contacts", json={"kind": "employee", "display_name": "יוסי טכנאי", "phone": "050-000-0077"}).json()
    t = env.s4.ticket()
    r = env.s4.assign_contact(t["id"], e["id"], user="mona")
    assert r.status_code == 200, r.text
    assert env.tick() == 1 and env.fake.calls[0]["data"]["target"] == "972500000077"
