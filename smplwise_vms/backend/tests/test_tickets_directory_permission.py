"""SMALL-294 (CR-038 section 18A, D15 trade-off "separate handler and directory permissions"): the contact / vendor directory has its
own permission `tickets.directory`, so a person can keep the directory (create, edit, erase, export, the full phone number) without
`tickets.configure` (departments, members, categories, settings). `tickets.configure` still covers the directory: no existing grant
loses anything and nothing in the data changes. The handler side is `tickets.handlers` (CR-DEPT-MANAGER-HANDLERS), unchanged.

Negative first: the permission is sensitive, not delegable and on system_admin only; holding it opens no configure route."""
from __future__ import annotations

import pytest

from conftest import bind
from smplwise.rbac import ROLES
from smplwise.routers.access import DEFAULT_DELEGABLE, PERMISSION_LABELS, SENSITIVE
from tickets_s4_world import API, build_s4


@pytest.fixture()
def s4(settings, monkeypatch):
    return build_s4(settings, monkeypatch)


def grant(s4, user: str = "nora") -> None:
    bind(s4.c, s4.w.settings, user, "tickets_directory", "installation", "*")


def test_the_permission_is_catalogued_sensitive_not_delegable_and_on_system_admin_only():
    assert ROLES["tickets_directory"] == ["tickets.directory"]
    assert "tickets.directory" in SENSITIVE and "tickets_directory" not in DEFAULT_DELEGABLE
    assert "{module}" in PERMISSION_LABELS["tickets.directory"]
    assert sorted(r for r, perms in ROLES.items() if "tickets.directory" in perms) == ["system_admin", "tickets_directory"]


def test_without_it_the_directory_stays_closed(s4):
    for user in ("mona", "nora", "vic", "alda"):
        assert s4.add_contact(user=user, display_name="ניסיון").status_code == 403, user


def test_it_opens_the_directory_and_nothing_of_the_settings(s4):
    grant(s4)
    h = s4.h("nora")
    made = s4.add_contact(user="nora", display_name="ספק חדש")
    assert made.status_code == 201, made.text
    cid = made.json()["id"]
    rev = s4.contact_rev(cid)
    assert s4.c.patch(f"{API}/tickets/contacts/{cid}", json={"display_name": "ספק מעודכן", "revision": rev}, headers=h).status_code == 200
    assert s4.c.get(f"{API}/tickets/contacts/{cid}/export", headers=h).status_code == 200
    rows = {c["id"]: c for c in s4.c.get(f"{API}/tickets/contacts", headers=h).json()["contacts"]}
    assert cid in rows and s4.contact["id"] in rows, "every row, not only a department's"
    assert s4.c.get(f"{API}/tickets/contacts", headers=h).json()["can_edit"] is True
    assert s4.c.post(f"{API}/tickets/contacts/{cid}/erase", json={"confirm": True}, headers=h).status_code == 200
    # the settings side stays with tickets.configure: the departments admin refuses
    refused = s4.c.get(f"{API}/tickets/admin/departments", headers=h)
    assert refused.status_code == 403 and refused.json()["details"]["permission"] == "tickets.configure"
    meta = s4.c.get(f"{API}/tickets/meta", headers=h).json()["can"]
    assert meta["directory"] is True and meta["configure"] is False


def test_the_full_phone_follows_the_directory_permission(s4):
    grant(s4)
    full = {c["id"]: c for c in s4.c.get(f"{API}/tickets/contacts", headers=s4.h("nora")).json()["contacts"]}[s4.contact["id"]]
    masked = {c["id"]: c for c in s4.c.get(f"{API}/tickets/contacts", headers=s4.h("mona")).json()["contacts"]}[s4.contact["id"]]
    assert full["phone"] != masked["phone"] and "•" in masked["phone"] and "•" not in full["phone"]


def test_a_refusal_still_names_configure(s4):
    r = s4.add_contact(user="vic")
    assert r.status_code == 403 and r.json()["details"]["permission"] == "tickets.configure"


def test_configure_alone_still_covers_the_directory(s4):
    bind(s4.c, s4.w.settings, "nora", "tickets_configure", "installation", "*")
    assert s4.add_contact(user="nora", display_name="מההגדרות").status_code == 201
    assert s4.c.get(f"{API}/tickets/meta", headers=s4.h("nora")).json()["can"]["directory"] is True
