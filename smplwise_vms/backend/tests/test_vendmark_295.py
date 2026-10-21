"""VENDMARK-295 (owner decision GRANTS3 Q1, 2026-10-21): the explicit "permanent vendor" marker in the directory.

One flag on the directory row of an external technician or vendor company (0136, provisional): permanent vs temporary (the default).
It is information only - no authority reads it. Permissions are the existing ones (`tickets.configure` / `tickets.directory`); a
department manager's route cannot set it. Employees and internal users never carry it. With the tickets module OFF the marker must not
bring any ticket action: the identity answer carries it without any ticket link and the directory stays closed (uniform 404)."""
from __future__ import annotations

import pytest

from conftest import bind
from tickets_s4_world import API, build_s4

MIG = "0136_vendor_permanent_marker.sql"


@pytest.fixture()
def s4(settings, monkeypatch):
    return build_s4(settings, monkeypatch)


def patch(s4, cid: str, user: str = "joni", **body):
    return s4.c.patch(f"{API}/tickets/contacts/{cid}", json={**body, "revision": s4.contact_rev(cid)}, headers=s4.h(user))


def test_migration_is_additive_with_a_temporary_default():
    from pathlib import Path

    import smplwise

    sql = (Path(smplwise.__file__).parent / "migrations" / MIG).read_text(encoding="utf-8")
    assert "PROVISIONAL number 0136" in sql.splitlines()[0]
    assert "ADD COLUMN permanent_vendor INTEGER NOT NULL DEFAULT 0" in sql and "DROP" not in sql.upper()


def test_every_row_starts_temporary_and_the_marker_is_set_and_cleared(s4):
    assert s4.vendor["permanent_vendor"] is False and s4.contact["permanent_vendor"] is False
    r = patch(s4, s4.vendor["id"], permanent_vendor=True)
    assert r.status_code == 200 and r.json()["permanent_vendor"] is True
    r = patch(s4, s4.contact["id"], permanent_vendor=True)  # an external technician (kind person)
    assert r.status_code == 200 and r.json()["permanent_vendor"] is True
    made = s4.add_contact(kind="vendor", display_name="ספק קבוע חדש", permanent_vendor=True)
    assert made.status_code == 201 and made.json()["permanent_vendor"] is True
    assert patch(s4, s4.vendor["id"], permanent_vendor=False).json()["permanent_vendor"] is False
    assert patch(s4, s4.vendor["id"], permanent_vendor="maybe").status_code in (422,)


def test_the_list_carries_the_marker_and_filters_on_it(s4):
    patch(s4, s4.vendor["id"], permanent_vendor=True)
    rows = s4.c.get(f"{API}/tickets/contacts", headers=s4.h("joni")).json()["contacts"]
    assert {c["id"]: c["permanent_vendor"] for c in rows}[s4.vendor["id"]] is True
    perm = s4.c.get(f"{API}/tickets/contacts?permanent=true", headers=s4.h("joni")).json()["contacts"]
    temp = s4.c.get(f"{API}/tickets/contacts?permanent=false", headers=s4.h("joni")).json()["contacts"]
    assert [c["id"] for c in perm] == [s4.vendor["id"]]
    assert s4.vendor["id"] not in [c["id"] for c in temp] and s4.contact["id"] in [c["id"] for c in temp]


def test_an_employee_or_an_internal_user_is_never_a_vendor(s4):
    refused = s4.add_contact(kind="employee", display_name="עובד", permanent_vendor=True)
    assert refused.status_code == 422 and refused.json()["details"]["fields"][0] == {"field": "permanent_vendor", "code": "not_external"}
    cid = s4.contact["id"]
    patch(s4, cid, permanent_vendor=True)
    to_employee = patch(s4, cid, kind="employee")
    assert to_employee.status_code == 200 and to_employee.json()["permanent_vendor"] is False, "the marker goes with the kind"


def test_it_is_in_the_export_and_cleared_by_an_erase(s4):
    cid = s4.contact["id"]
    patch(s4, cid, permanent_vendor=True)
    exp = s4.c.get(f"{API}/tickets/contacts/{cid}/export", headers=s4.h("joni")).json()
    assert exp["contact"]["permanent_vendor"] == 1
    assert s4.c.post(f"{API}/tickets/contacts/{cid}/erase", json={"confirm": True}, headers=s4.h("joni")).status_code == 200
    with s4.db.connection(mode="read") as conn:
        assert conn.execute("SELECT permanent_vendor FROM ticket_contacts WHERE id = ?", (cid,)).fetchone()[0] == 0


def test_the_existing_directory_permissions_only(s4):
    # no new permission name: tickets.directory edits it, a plain reader and a department manager cannot
    bind(s4.c, s4.w.settings, "nora", "tickets_directory", "installation", "*")
    assert patch(s4, s4.vendor["id"], user="nora", permanent_vendor=True).status_code == 200
    for user in ("mona", "vic", "alda"):
        assert patch(s4, s4.vendor["id"], user=user, permanent_vendor=False).status_code == 403, user
    from smplwise.routers.access import PERMISSION_LABELS

    assert not [k for k in PERMISSION_LABELS if "vendor_marker" in k or "permanent" in k]


def test_a_department_managers_route_cannot_set_it(s4):
    from smplwise.routers.tickets_dept_handlers import CreateBody, PatchBody  # the manager routes forbid unknown fields

    assert "permanent_vendor" not in CreateBody.model_fields and "permanent_vendor" not in PatchBody.model_fields


def test_tickets_module_off_the_identity_card_shows_the_marker_and_offers_no_ticket_action(s4):
    cid = s4.contact["id"]
    patch(s4, cid, permanent_vendor=True)
    r = s4.c.get(f"{API}/settings")
    assert s4.c.put(f"{API}/settings", json={"tickets.enabled": "false"}).status_code == 200, r.text
    # the directory belongs to the module: closed while it is off (the uniform 404), the marker adds no way around it
    assert s4.c.get(f"{API}/tickets/contacts", headers=s4.h("joni")).status_code == 404
    ident = s4.c.get(f"{API}/access-grants/contacts/{cid}/identity", headers=s4.h("joni"))
    assert ident.status_code == 200, ident.text
    body = ident.json()["identity"]
    assert body["permanent_vendor"] is True
    assert "ticket" not in " ".join(body.keys()).lower() and "href" not in str(body).lower() and "/tickets" not in str(body)
