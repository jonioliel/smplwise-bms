"""CR-038 owner request 2026-10-14 (he deleted his only department by mistake and could not create a new one): a new department needs a
name only (the identifier is made from it - Hebrew transliterated, a fallback, unique among live departments; an explicit key is still
accepted), a soft-deleted department is listed and restored with everything under it (tickets.configure, audited; its identifier must
be free), and a department with open tickets still cannot be deleted (the confirm dialog says why)."""
from __future__ import annotations

import re

import pytest

from smplwise.routers.tickets_admin import KEY, slug_key
from tickets_s4_world import API, build_s4


@pytest.fixture()
def s4(settings, monkeypatch):
    return build_s4(settings, monkeypatch)


def depts(s4):
    r = s4.c.get(f"{API}/tickets/admin/departments")
    assert r.status_code == 200, r.text
    return r.json()


@pytest.mark.parametrize("name,key", [("אחזקה", "achzkh"), ("Front Desk 2", "front-desk-2"), ("IT", "it"), ("ניקיון", "nykyvn")])
def test_a_key_is_made_from_the_name(name, key):
    assert slug_key(name) == key and re.fullmatch(KEY, key)


@pytest.mark.parametrize("name", ["123", "!!", "", "א"])
def test_a_name_without_a_usable_slug_gives_nothing(name):
    assert slug_key(name) == ""


def test_a_department_is_created_with_a_name_only_and_keys_stay_unique(s4):
    a = s4.c.post(f"{API}/tickets/admin/departments", json={"name": "ביטחון"})
    assert a.status_code == 201, a.text
    b = s4.c.post(f"{API}/tickets/admin/departments", json={"name": "ביטחון"})
    assert b.status_code == 201, b.text
    assert a.json()["key"] == "bytchvn" and b.json()["key"] == "bytchvn-2"
    c = s4.c.post(f"{API}/tickets/admin/departments", json={"name": "123"})
    assert c.status_code == 201 and re.fullmatch(r"dept-[0-9a-f]{6}", c.json()["key"])
    d = s4.c.post(f"{API}/tickets/admin/departments", json={"name": "Lobby", "key": "lobby"})
    assert d.status_code == 201 and d.json()["key"] == "lobby", "an explicit key is still accepted"
    assert s4.c.post(f"{API}/tickets/admin/departments", json={"name": "x", "key": "lobby"}).status_code == 409


def test_a_deleted_department_is_listed_and_restored_with_everything_under_it(s4):
    d = s4.c.post(f"{API}/tickets/admin/departments", json={"name": "חניון"}).json()
    s4.c.post(f"{API}/tickets/admin/departments/{d['id']}/categories", json={"name": "מחסום"})
    s4.c.put(f"{API}/tickets/admin/departments/{d['id']}/members/user/dev-mona", json={"role": "manager"})
    before = next(x for x in depts(s4)["departments"] if x["id"] == d["id"])
    assert s4.c.delete(f"{API}/tickets/admin/departments/{d['id']}").status_code == 200
    listing = depts(s4)
    assert d["id"] not in {x["id"] for x in listing["departments"]}
    gone = {x["id"]: x for x in listing["deleted"]}
    assert gone[d["id"]]["name"] == "חניון" and gone[d["id"]]["deleted_at"]
    assert s4.c.post(f"{API}/tickets/admin/departments/{d['id']}/restore", headers=s4.h("mona")).status_code == 403
    r = s4.c.post(f"{API}/tickets/admin/departments/{d['id']}/restore")
    assert r.status_code == 200, r.text
    back = r.json()
    assert back["active"] is True and back["key"] == before["key"] and back["key_changed"] is False
    assert [c["name"] for c in back["categories"]] == [c["name"] for c in before["categories"]]
    assert [(m["id"], m["role"]) for m in back["members"]] == [(m["id"], m["role"]) for m in before["members"]]
    assert len(back["priorities"]) == 4 and back["sla"] == before["sla"]
    assert d["id"] not in {x["id"] for x in depts(s4)["deleted"]}
    with s4.db.connection(mode="read") as conn:
        assert conn.execute("SELECT COUNT(*) FROM audit_log WHERE action = 'ticket.department.restore' AND resource_id = ?", (d["id"],)).fetchone()[0] == 1
    assert s4.c.post(f"{API}/tickets/admin/departments/{d['id']}/restore").status_code == 404, "only a deleted department is restored"


def test_a_restore_whose_key_was_reused_gets_a_free_one(s4):
    d = s4.c.post(f"{API}/tickets/admin/departments", json={"name": "גינון"}).json()
    s4.c.delete(f"{API}/tickets/admin/departments/{d['id']}")
    other = s4.c.post(f"{API}/tickets/admin/departments", json={"name": "גינון"}).json()
    assert other["key"] == d["key"], "the identifier of a deleted department is free again"
    assert s4.c.post(f"{API}/tickets/admin/departments/{d['id']}/restore", json={"key": d["key"]}).status_code == 409
    r = s4.c.post(f"{API}/tickets/admin/departments/{d['id']}/restore")
    assert r.status_code == 200 and r.json()["key_changed"] is True and r.json()["key"] == f"{d['key']}-2"


def test_a_department_with_open_tickets_is_not_deleted(s4):
    s4.ticket()  # filed in maintenance
    r = s4.c.delete(f"{API}/tickets/admin/departments/dept-maintenance")
    assert r.status_code == 409 and r.json()["code"] == "department_in_use" and r.json()["details"]["open_tickets"] >= 1
