"""TICKPERM-295 (owner 2026-10-21): the handlers' side and the directory's side of the tickets permissions are separate.

SMALL-294 gave the contact / vendor directory its own permission `tickets.directory`; DIRPERM-295 let it open the external-access
identity card. What stayed mixed: through the directory a `tickets.directory` holder could still create, read, edit, erase and export
HANDLERS' rows (an employee without an account, a row linked to a user) - rows that decide where a person's staff links go, which
the code already treats as the stricter `tickets.configure` case (phone_verify.manager_confirm, set_mobile). Now:

- vendors and outside contacts: `tickets.configure` or `tickets.directory` (unchanged);
- handlers' rows (kind employee, or `user_id` set): `tickets.configure` only; the directory-only holder neither sees nor touches them;
- department managers: their own routes (`tickets.handlers`), unchanged.
Negative first; the module switch closes every route. No new permission name, no migration."""
from __future__ import annotations

import pytest

from conftest import bind
from smplwise.rbac import ROLES
from smplwise.routers.access import PERMISSION_LABELS
from tickets_s4_world import API, build_s4

CONTACTS = f"{API}/tickets/contacts"
UNKNOWN = "0" * 32


@pytest.fixture()
def s4(settings, monkeypatch):
    return build_s4(settings, monkeypatch)


def grant_directory(s4, user: str = "nora") -> dict[str, str]:
    bind(s4.c, s4.w.settings, user, "tickets_directory", "installation", "*")
    return s4.h(user)


def staff_rows(s4) -> tuple[str, str]:
    """(an employee without an account, a row linked to the user dev-tom), both made by the configure holder."""
    s4.c.get(f"{API}/me", headers=s4.h("tom"))
    emp = s4.add_contact(kind="employee", display_name="עובד ללא חשבון", phone="050-000-0061")
    assert emp.status_code == 201, emp.text
    lnk = s4.add_contact(display_name="טום (צוות)", phone="050-000-0062", user_id="dev-tom")
    assert lnk.status_code == 201, lnk.text
    return emp.json()["id"], lnk.json()["id"]


def test_the_directory_holder_still_runs_vendors_and_outside_contacts(s4):
    h = grant_directory(s4)
    v = s4.add_contact(user="nora", kind="vendor", display_name="ספק חדש", phone="050-000-0071")
    p = s4.add_contact(user="nora", kind="person", display_name="איש קשר חדש", phone="050-000-0072")
    assert v.status_code == 201 and p.status_code == 201, (v.text, p.text)
    vid = v.json()["id"]
    assert s4.c.patch(f"{CONTACTS}/{vid}", json={"display_name": "ספק מעודכן", "revision": s4.contact_rev(vid)}, headers=h).status_code == 200
    assert s4.c.get(f"{CONTACTS}/{vid}/export", headers=h).status_code == 200
    assert s4.c.post(f"{CONTACTS}/{vid}/erase", json={"confirm": True}, headers=h).status_code == 200


def test_the_directory_holder_cannot_create_a_handlers_row(s4):
    h = grant_directory(s4)
    s4.c.get(f"{API}/me", headers=s4.h("tom"))
    for body in ({"kind": "employee", "display_name": "עובד"}, {"kind": "person", "display_name": "מקושר", "user_id": "dev-tom"}):
        r = s4.add_contact(user="nora", **body)
        assert r.status_code == 403 and r.json()["details"]["permission"] == "tickets.configure", (body, r.text)
    names = {c["display_name"] for c in s4.c.get(CONTACTS, headers=s4.h("joni")).json()["contacts"]}
    assert "עובד" not in names and "מקושר" not in names, "nothing was written"
    assert s4.c.get(CONTACTS, headers=h).json()["can_edit"] is True


def test_the_directory_holder_neither_sees_nor_touches_a_handlers_row(s4):
    h = grant_directory(s4)
    emp, lnk = staff_rows(s4)
    page = s4.c.get(CONTACTS, headers=h).json()
    ids = {c["id"] for c in page["contacts"]}
    assert emp not in ids and lnk not in ids and s4.contact["id"] in ids
    assert page["can_edit"] is True and page["can_edit_staff"] is False
    for cid in (emp, lnk):
        assert s4.c.get(f"{CONTACTS}/{cid}", headers=h).status_code == 404
        assert s4.c.patch(f"{CONTACTS}/{cid}", json={"display_name": "x", "revision": s4.contact_rev(cid)}, headers=h).status_code == 404
        assert s4.c.post(f"{CONTACTS}/{cid}/erase", json={"confirm": True}, headers=h).status_code == 404
        assert s4.c.get(f"{CONTACTS}/{cid}/export", headers=h).status_code == 404
        assert s4.c.post(f"{CONTACTS}/{cid}/phone-verify/send", headers=h).status_code == 403
    # a handler's row answers like an unknown id
    assert s4.c.get(f"{CONTACTS}/{UNKNOWN}", headers=h).json()["code"] == s4.c.get(f"{CONTACTS}/{emp}", headers=h).json()["code"]
    assert s4.c.get(f"{CONTACTS}/{emp}", headers=s4.h("joni")).json()["display_name"] == "עובד ללא חשבון", "untouched"


def test_the_directory_holder_cannot_turn_a_vendor_into_a_handlers_row(s4):
    h = grant_directory(s4)
    cid = s4.contact["id"]
    s4.c.get(f"{API}/me", headers=s4.h("tom"))
    for body in ({"kind": "employee"}, {"user_id": "dev-tom"}):
        r = s4.c.patch(f"{CONTACTS}/{cid}", json={**body, "revision": s4.contact_rev(cid)}, headers=h)
        assert r.status_code == 403 and r.json()["details"]["permission"] == "tickets.configure", (body, r.text)
    row = s4.c.get(f"{CONTACTS}/{cid}", headers=s4.h("joni")).json()
    assert row["kind"] != "employee" and not row.get("user_linked")


def test_the_directory_holder_verifies_a_vendor_number_but_not_a_handlers(s4):
    h = grant_directory(s4)
    ok = s4.c.post(f"{CONTACTS}/{s4.contact['id']}/phone-verify/send", headers=h)
    assert ok.status_code not in (403, 404), ok.text  # the directory's own row: the gate is open (the send itself may answer 409)
    for user in ("vic", "alda"):  # no directory permission: refused, naming the settings permission
        r = s4.c.post(f"{CONTACTS}/{s4.contact['id']}/phone-verify/send", headers=s4.h(user))
        assert r.status_code == 403 and r.json()["details"]["permission"] == "tickets.configure", user


def test_configure_keeps_every_row_and_the_handlers_flag(s4):
    emp, lnk = staff_rows(s4)
    bind(s4.c, s4.w.settings, "nora", "tickets_configure", "installation", "*")
    h = s4.h("nora")
    page = s4.c.get(CONTACTS, headers=h).json()
    assert {emp, lnk} <= {c["id"] for c in page["contacts"]} and page["can_edit_staff"] is True
    assert s4.c.get(f"{CONTACTS}/{emp}/export", headers=h).status_code == 200
    assert s4.c.patch(f"{CONTACTS}/{emp}", json={"display_name": "עובד ב", "revision": s4.contact_rev(emp)}, headers=h).status_code == 200


def test_without_any_ticket_permission_no_handlers_row_can_be_made(s4):
    for user in ("vic", "alda"):
        assert s4.add_contact(user=user, kind="employee", display_name="נסיון").status_code == 403, user


def test_the_module_off_closes_the_directory_for_its_holder_too(s4):
    h = grant_directory(s4)
    assert s4.c.patch(f"{API}/settings", json={"tickets.enabled": "false"}).status_code == 200
    assert s4.c.get(CONTACTS, headers=h).status_code == 404
    r = s4.add_contact(user="nora", kind="vendor", display_name="ספק")
    assert r.status_code == 404 and r.json()["code"] == "feature_disabled"
    assert s4.c.post(f"{CONTACTS}/{s4.contact['id']}/phone-verify/send", headers=h).status_code == 404


def test_the_catalogue_names_and_roles_stay():
    assert ROLES["tickets_directory"] == ["tickets.directory"]
    assert "{module}" in PERMISSION_LABELS["tickets.directory"] and "{module}" in PERMISSION_LABELS["tickets.handlers"]
    assert sorted(r for r, perms in ROLES.items() if "tickets.directory" in perms) == ["system_admin", "tickets_directory"]
