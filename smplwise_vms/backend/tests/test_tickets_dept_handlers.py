"""CR-DEPT-MANAGER-HANDLERS (owner 2026-10-17): a department manager manages the handlers and vendors of HIS departments.

Negative first: the permission matrix (no capability -> 403 that names no department; a foreign or unknown department -> the same
404), cross-department writes refused, other departments' and global directory rows untouched, no leak of other departments
(names, counts, existence), phones masked by default and the system_admin setting that unmasks his own departments' rows only,
audit rows with ids only, idempotence, injection / length. Then the allowed paths.

Cast (tests/tickets_world.py): mona = manager of maintenance (operator + tickets_manage), cleo = manager of cleaning, tom = member of
maintenance, nora = operator in no department, alda = tickets_all_departments (manages nothing), vic = viewer, joni = system_admin.
`tickets_handlers` is bound per test where the capability is wanted."""
from __future__ import annotations

import json

import pytest

from conftest import bind
from smplwise.rbac import ROLES
from smplwise.routers.access import DEFAULT_DELEGABLE, PERMISSION_LABELS, SENSITIVE
from tickets_s4_world import API, build_s4
from tickets_world import MAINT

H = f"{API}/tickets/dept-handlers"


@pytest.fixture()
def s4(settings, monkeypatch):
    return build_s4(settings, monkeypatch)


def grant(s4, user: str = "mona") -> None:
    bind(s4.c, s4.w.settings, user, "tickets_handlers", "installation", "*")


def audits(s4, like: str = "ticket.%") -> list[dict]:
    with s4.db.connection(mode="read") as conn:
        return [dict(r) for r in conn.execute("SELECT * FROM audit_log WHERE action LIKE ? ORDER BY rowid", (like,)).fetchall()]


def mk(s4, user: str = "mona", dept: str = MAINT, **body):
    payload = {"kind": "vendor", "display_name": "חשמל בע\"מ", "phone": "050-000-0051", **body}
    return s4.c.post(f"{H}/{dept}/contacts", json=payload, headers=s4.h(user))


def rev(s4, cid: str) -> int:
    return s4.contact_rev(cid)


# ---------------------------------------------------------------- the catalogue


def test_the_permission_is_catalogued_sensitive_not_delegable_and_on_system_admin_only():
    assert ROLES["tickets_handlers"] == ["tickets.handlers"]
    assert "tickets.handlers" in SENSITIVE and "tickets_handlers" not in DEFAULT_DELEGABLE
    assert "{module}" in PERMISSION_LABELS["tickets.handlers"]
    assert sorted(r for r, perms in ROLES.items() if "tickets.handlers" in perms) == ["system_admin", "tickets_handlers"]


# ---------------------------------------------------------------- the matrix (negative first)


@pytest.mark.parametrize("user", ["mona", "cleo", "tom", "nora", "alda", "vic"])
def test_without_the_capability_every_write_is_403_and_names_no_department(s4, user):
    cid = s4.contact["id"]
    calls = [
        s4.c.put(f"{H}/{MAINT}/members/dev-nora", headers=s4.h(user)),
        s4.c.delete(f"{H}/{MAINT}/members/dev-tom", headers=s4.h(user)),
        mk(s4, user=user),
        s4.c.put(f"{H}/{MAINT}/contacts/{cid}", headers=s4.h(user)),
        s4.c.delete(f"{H}/{MAINT}/contacts/{cid}", headers=s4.h(user)),
        s4.c.patch(f"{H}/{MAINT}/contacts/{cid}", json={"display_name": "x", "revision": 1}, headers=s4.h(user)),
        s4.c.post(f"{H}/{MAINT}/contacts/{cid}/erase", json={"confirm": True}, headers=s4.h(user)),
        s4.c.put(f"{H}/no-such-dept/members/dev-nora", headers=s4.h(user)),
    ]
    for r in calls:
        assert r.status_code == 403, (user, r.request.method, r.request.url, r.text)
        assert r.json()["details"] == {"permission": "tickets.handlers"}
    denied = [a for a in audits(s4) if a["decision"] == "denied" and a["reason"] == "no_permission"]
    assert len(denied) >= len(calls) - 2  # the two create calls / pydantic paths aside, every refusal is audited
    with s4.db.connection(mode="read") as conn:
        assert conn.execute("SELECT member_role FROM ticket_department_members WHERE subject_id = 'dev-tom'").fetchone()[0] == "member"
        assert conn.execute("SELECT COUNT(*) FROM ticket_department_members WHERE subject_id = 'dev-nora'").fetchone()[0] == 0


def test_the_capability_without_a_manager_membership_or_without_manage_does_nothing(s4):
    for user in ("tom", "nora", "alda"):  # a member, nobody, all-departments without membership
        grant(s4, user)
        assert s4.c.put(f"{H}/{MAINT}/members/dev-nora", headers=s4.h(user)).status_code == 403, user
        assert s4.c.get(H, headers=s4.h(user)).status_code == 403, user


def test_a_foreign_department_and_an_unknown_one_are_the_same_404(s4):
    grant(s4)
    foreign = s4.c.put(f"{H}/{s4.w.cleaning}/members/dev-nora", headers=s4.h("mona"))
    unknown = s4.c.put(f"{H}/dept-nope-123/members/dev-nora", headers=s4.h("mona"))
    assert foreign.status_code == unknown.status_code == 404
    assert foreign.json()["code"] == unknown.json()["code"] == "not_found"
    assert foreign.json()["user_message"] == unknown.json()["user_message"]
    for path in (f"{H}/{s4.w.cleaning}/contacts/{s4.contact['id']}", f"{H}/{s4.w.cleaning}/members/dev-cleo"):
        assert s4.c.delete(path, headers=s4.h("mona")).status_code == 404
    assert mk(s4, dept=s4.w.cleaning).status_code == 404
    with s4.db.connection(mode="read") as conn:
        assert conn.execute("SELECT COUNT(*) FROM ticket_department_members WHERE department_id = ?", (s4.w.cleaning,)).fetchone()[0] == 1
    assert any(a["reason"] == "not_manager_of_department" for a in audits(s4, "ticket.%"))


def test_manager_rows_are_never_created_changed_or_removed_here(s4):
    grant(s4)
    s4.w.member(MAINT, "nora", "manager")
    assert s4.c.put(f"{H}/{MAINT}/members/dev-nora", headers=s4.h("mona")).json()["code"] == "manager_row"
    assert s4.c.delete(f"{H}/{MAINT}/members/dev-nora", headers=s4.h("mona")).status_code == 403
    assert s4.c.delete(f"{H}/{MAINT}/members/dev-mona", headers=s4.h("mona")).status_code == 403, "not even himself"
    with s4.db.connection(mode="read") as conn:
        assert conn.execute("SELECT member_role FROM ticket_department_members WHERE department_id = ? AND subject_id = 'dev-nora'", (MAINT,)).fetchone()[0] == "manager"


def test_a_directory_row_of_another_department_is_invisible_and_untouchable(s4):
    grant(s4)
    r = s4.add_contact(kind="vendor", display_name="ספק ניקיון", phone="050-000-0060", departments=[s4.w.cleaning])
    assert r.status_code == 201, r.text
    cid = r.json()["id"]
    before = rev(s4, cid)
    for call in (
        s4.c.put(f"{H}/{MAINT}/contacts/{cid}", headers=s4.h("mona")),  # attach a row he cannot read
        s4.c.delete(f"{H}/{MAINT}/contacts/{cid}", headers=s4.h("mona")),
        s4.c.patch(f"{H}/{MAINT}/contacts/{cid}", json={"display_name": "x", "revision": before}, headers=s4.h("mona")),
        s4.c.post(f"{H}/{MAINT}/contacts/{cid}/erase", json={"confirm": True}, headers=s4.h("mona")),
    ):
        assert call.status_code == 404 and call.json()["code"] == "contact_not_found", call.text
    assert rev(s4, cid) == before
    with s4.db.connection(mode="read") as conn:
        assert [r[0] for r in conn.execute("SELECT department_id FROM ticket_contact_departments WHERE contact_id = ?", (cid,))] == [s4.w.cleaning]


def test_global_rows_of_others_keep_their_details_only_the_attachment_is_his(s4):
    grant(s4)
    cid = s4.vendor["id"]  # created by joni, shared with every department
    r = s4.c.patch(f"{H}/{MAINT}/contacts/{cid}", json={"phone": "050-000-0099", "revision": rev(s4, cid)}, headers=s4.h("mona"))
    assert r.status_code == 403 and r.json()["code"] == "attachment_only"
    assert s4.c.post(f"{H}/{MAINT}/contacts/{cid}/erase", json={"confirm": True}, headers=s4.h("mona")).json()["code"] == "attachment_only"
    assert s4.c.put(f"{H}/{MAINT}/contacts/{cid}", headers=s4.h("mona")).json()["code"] == "shared_entry", "attaching would narrow it for everyone"
    assert s4.c.delete(f"{H}/{MAINT}/contacts/{cid}", headers=s4.h("mona")).json()["code"] == "shared_entry"
    with s4.db.connection(mode="read") as conn:
        row = conn.execute("SELECT phone_e164, erased_at FROM ticket_contacts WHERE id = ?", (cid,)).fetchone()
        assert row["erased_at"] is None and row["phone_e164"] != "972500000099"
        assert conn.execute("SELECT COUNT(*) FROM ticket_contact_departments WHERE contact_id = ?", (cid,)).fetchone()[0] == 0


def test_a_row_attached_to_his_department_by_someone_else_detaches_but_never_edits(s4):
    grant(s4)
    cid = s4.add_contact(kind="vendor", display_name="מעליות", phone="050-000-0061", departments=[MAINT, s4.w.cleaning]).json()["id"]
    assert s4.c.patch(f"{H}/{MAINT}/contacts/{cid}", json={"display_name": "x", "revision": rev(s4, cid)}, headers=s4.h("mona")).status_code == 403
    r = s4.c.delete(f"{H}/{MAINT}/contacts/{cid}", headers=s4.h("mona"))
    assert r.status_code == 200 and r.json() == {"id": cid, "department_id": MAINT, "detached": True}
    with s4.db.connection(mode="read") as conn:
        assert [x[0] for x in conn.execute("SELECT department_id FROM ticket_contact_departments WHERE contact_id = ?", (cid,))] == [s4.w.cleaning]
    assert s4.c.delete(f"{H}/{MAINT}/contacts/{cid}", headers=s4.h("mona")).status_code == 404, "now another department's row"


def test_the_last_department_is_never_detached(s4):
    grant(s4)
    cid = mk(s4, kind="employee", display_name="דני טכנאי").json()["id"]
    r = s4.c.delete(f"{H}/{MAINT}/contacts/{cid}", headers=s4.h("mona"))
    assert r.status_code == 409 and r.json()["code"] == "last_department", "no department rows would mean every department"


def test_his_own_row_used_by_another_department_is_attachment_only(s4):
    grant(s4)
    cid = mk(s4, display_name="אינסטלציה").json()["id"]  # shared with every department
    # another department uses it: cleo's ticket is sent to it
    t = s4.w.create("joni", "נזילה", dept=s4.w.cleaning)
    assert s4.assign_contact(t["id"], cid).status_code == 200
    r = s4.c.patch(f"{H}/{MAINT}/contacts/{cid}", json={"phone": "050-000-0098", "revision": rev(s4, cid)}, headers=s4.h("mona"))
    assert r.status_code == 403 and r.json()["code"] == "attachment_only"
    assert "cleaning" not in r.text and "ניקיון" not in r.text and s4.w.cleaning not in r.text, "no name, id or count of the other department"
    assert s4.c.post(f"{H}/{MAINT}/contacts/{cid}/erase", json={"confirm": True}, headers=s4.h("mona")).status_code == 403
    row = next(c for c in s4.c.get(f"{API}/tickets/contacts", headers=s4.h("mona")).json()["contacts"] if c["id"] == cid)
    assert row["manager_editable"] is False


# ---------------------------------------------------------------- no leak


def test_the_overview_lists_only_his_departments_and_their_members(s4):
    r = s4.c.get(H, headers=s4.h("mona"))
    assert r.status_code == 200, r.text
    body = r.json()
    assert [d["id"] for d in body["departments"]] == [MAINT]
    assert body["can_manage"] is False and body["departments"][0]["can_manage"] is False, "reading needs no capability, writing does"
    raw = json.dumps(body, ensure_ascii=False)
    assert s4.w.cleaning not in raw and "ניקיון" not in raw and "dev-cleo" not in raw
    assert {m["id"] for m in body["departments"][0]["members"]} >= {"dev-mona", "dev-tom"}
    grant(s4)
    assert s4.c.get(H, headers=s4.h("mona")).json()["can_manage"] is True
    for user in ("tom", "nora", "vic", "alda"):
        assert s4.c.get(H, headers=s4.h(user)).status_code == 403, user


def test_meta_says_where_the_caller_manages_handlers(s4):
    meta = s4.c.get(f"{API}/tickets/meta", headers=s4.h("mona")).json()
    assert meta["can"]["handlers"] is False
    grant(s4)
    meta = s4.c.get(f"{API}/tickets/meta", headers=s4.h("mona")).json()
    assert meta["can"]["handlers"] is True
    assert {d["id"]: d["can_handlers"] for d in meta["departments"]}.get(MAINT) is True


def test_the_people_picker_is_names_only_and_needs_the_capability(s4):
    assert s4.c.get(f"{H}/people", headers=s4.h("mona")).status_code == 403
    grant(s4)
    r = s4.c.get(f"{H}/people", params={"q": "nor"}, headers=s4.h("mona"))
    assert r.status_code == 200 and all(set(u) == {"id", "name"} for u in r.json()["users"])
    assert "groups" not in r.json()


# ---------------------------------------------------------------- phones


def test_phones_are_masked_for_managers_and_the_setting_unmasks_his_departments_rows_only(s4):
    grant(s4)
    own = mk(s4, kind="employee", display_name="עובד אחזקה", phone="050-000-0071").json()["id"]
    foreign_shared = s4.contact["id"]
    s4.w.c.put(f"{API}/tickets/admin/staff/dev-tom", json={"phone": "050-000-0072"})
    rows = {c["id"]: c for c in s4.c.get(f"{API}/tickets/contacts", headers=s4.h("mona")).json()["contacts"]}
    assert rows[own]["phone"] == "•••• 0071" and rows[own]["phone_full"] is False
    tom = next(m for m in s4.c.get(H, headers=s4.h("mona")).json()["departments"][0]["members"] if m["id"] == "dev-tom")
    assert tom["mobile"] == "•••• 0072" and tom["mobile_full"] is False
    # only system.configure (system_admin) turns the setting on; a manager cannot
    doc = s4.c.get(f"{API}/tickets/settings").json()
    assert s4.c.put(f"{API}/tickets/settings", json={"revision": doc["revision"], "directory": {"managers_full_phones": True}}, headers=s4.h("mona")).status_code == 403
    assert doc["directory"]["managers_full_phones"] is False, "off by default"
    r = s4.c.put(f"{API}/tickets/settings", json={"revision": doc["revision"], "directory": {"managers_full_phones": True}})
    assert r.status_code == 200, r.text
    assert "directory.managers_full_phones" in audits(s4, "tickets.settings.update")[-1]["details_json"]
    rows = {c["id"]: c for c in s4.c.get(f"{API}/tickets/contacts", headers=s4.h("mona")).json()["contacts"]}
    assert rows[own]["phone"] == "050-000-0071" and rows[own]["phone_full"] is True
    assert rows[foreign_shared]["phone_full"] is False, "a row shared with every department is not his department's row"
    tom = next(m for m in s4.c.get(H, headers=s4.h("mona")).json()["departments"][0]["members"] if m["id"] == "dev-tom")
    assert tom["mobile"] == "050-000-0072" and tom["mobile_full"] is True
    # cleo (another manager) never sees mona's department row at all
    assert own not in {c["id"] for c in s4.c.get(f"{API}/tickets/contacts", headers=s4.h("cleo")).json()["contacts"]}
    assert s4.c.put(f"{API}/tickets/settings", json={"revision": r.json()["revision"], "directory": {"managers_full_phones": "yes"}}).status_code == 422


# ---------------------------------------------------------------- the allowed paths, audit, idempotence


def test_add_and_remove_a_plain_member_idempotent_and_audited_with_ids_only(s4):
    grant(s4)
    r1 = s4.c.put(f"{H}/{MAINT}/members/dev-nora", headers=s4.h("mona"))
    r2 = s4.c.put(f"{H}/{MAINT}/members/dev-nora", headers=s4.h("mona"))
    assert r1.status_code == r2.status_code == 200 and r1.json() == r2.json()
    nora = next(m for m in r1.json()["members"] if m["id"] == "dev-nora")
    assert nora["role"] == "member"
    adds = [a for a in audits(s4, "ticket.member.add") if "dev-nora" in (a["details_json"] or "")]
    assert len(adds) == 1, "the second PUT writes nothing"
    d = json.loads(adds[0]["details_json"])
    assert d == {"subject_kind": "user", "subject_id": "dev-nora", "role": "member", "before": None, "via": "department_manager"}
    assert s4.c.delete(f"{H}/{MAINT}/members/dev-nora", headers=s4.h("mona")).status_code == 200
    assert s4.c.delete(f"{H}/{MAINT}/members/dev-nora", headers=s4.h("mona")).status_code == 404
    assert s4.c.put(f"{H}/{MAINT}/members/dev-ghost", headers=s4.h("mona")).json()["code"] == "user_unknown"


def test_create_a_vendor_shared_and_an_employee_attached_recording_creator_and_department(s4):
    grant(s4)
    r = mk(s4, display_name="גנרטורים בע\"מ", email="g@gen.example.test")
    assert r.status_code == 201, r.text
    v = r.json()
    assert v["departments"] == [] and v["created_department"] == MAINT and v["manager_editable"] is True
    assert v["id"] in {c["id"] for c in s4.c.get(f"{API}/tickets/contacts", headers=s4.h("cleo")).json()["contacts"]}, \
        "a shared vendor is in the other departments' directory (existing rule: no department rows = every department)"
    e = mk(s4, kind="employee", display_name="יוסי").json()
    assert e["departments"] == [MAINT]
    assert e["id"] not in {c["id"] for c in s4.c.get(f"{API}/tickets/contacts", headers=s4.h("cleo")).json()["contacts"]}
    assert mk(s4, kind="employee", display_name="x", shared=True).status_code == 422
    with s4.db.connection(mode="read") as conn:
        assert conn.execute("SELECT created_by FROM ticket_contacts WHERE id = ?", (v["id"],)).fetchone()[0] == "dev-mona"
    rows = [json.loads(a["details_json"]) for a in audits(s4, "ticket.contact.create") if a["resource_id"] in (v["id"], e["id"])]
    assert [r["department_id"] for r in rows] == [MAINT, MAINT] and [r["shared"] for r in rows] == [True, False]
    raw = json.dumps(rows, ensure_ascii=False)
    assert "0051" not in raw and "גנרטורים" not in raw and "g@gen" not in raw, "ids, flags and counts only"


def test_edit_and_erase_his_own_unused_row(s4):
    grant(s4)
    cid = mk(s4, kind="employee", display_name="משה").json()["id"]
    r = s4.c.patch(f"{H}/{MAINT}/contacts/{cid}", json={"display_name": "משה כהן", "active": False, "revision": rev(s4, cid)}, headers=s4.h("mona"))
    assert r.status_code == 200 and r.json()["display_name"] == "משה כהן" and r.json()["active"] is False
    stale = s4.c.patch(f"{H}/{MAINT}/contacts/{cid}", json={"display_name": "x", "revision": 1}, headers=s4.h("mona"))
    assert stale.status_code == 409
    up = json.loads(audits(s4, "ticket.contact.update")[-1]["details_json"])
    assert up["fields"] == ["active", "display_name"] and up["department_id"] == MAINT and "משה" not in json.dumps(up, ensure_ascii=False)
    r = s4.c.post(f"{H}/{MAINT}/contacts/{cid}/erase", json={"confirm": True}, headers=s4.h("mona"))
    assert r.status_code == 200 and r.json()["erased"] is True
    assert s4.c.post(f"{H}/{MAINT}/contacts/{cid}/erase", json={"confirm": True}, headers=s4.h("mona")).status_code == 404


def test_cleo_cannot_touch_monas_row_even_when_shared(s4):
    grant(s4)
    grant(s4, "cleo")
    cid = mk(s4, display_name="שליחויות").json()["id"]
    r = s4.c.patch(f"{H}/{s4.w.cleaning}/contacts/{cid}", json={"display_name": "x", "revision": rev(s4, cid)}, headers=s4.h("cleo"))
    assert r.status_code == 403 and r.json()["code"] == "attachment_only"
    assert s4.c.post(f"{H}/{s4.w.cleaning}/contacts/{cid}/erase", json={"confirm": True}, headers=s4.h("cleo")).status_code == 403


def test_attach_to_a_second_managed_department_is_idempotent(s4):
    grant(s4)
    s4.w.member(s4.w.cleaning, "mona", "manager")
    cid = mk(s4, kind="employee", display_name="רינה").json()["id"]
    a = s4.c.put(f"{H}/{s4.w.cleaning}/contacts/{cid}", headers=s4.h("mona"))
    b = s4.c.put(f"{H}/{s4.w.cleaning}/contacts/{cid}", headers=s4.h("mona"))
    assert a.status_code == b.status_code == 200 and sorted(a.json()["departments"]) == sorted([MAINT, s4.w.cleaning])
    assert len([x for x in audits(s4, "ticket.contact.attach") if x["resource_id"] == cid]) == 1


# ---------------------------------------------------------------- injection / length


@pytest.mark.parametrize("body,status", [
    ({"display_name": "א" * 81}, 422),
    ({"display_name": "x" * 401}, 422),
    ({"display_name": "<script>alert(1)</script>'; DROP TABLE ticket_contacts;--", "phone": "050' OR '1'='1"}, 422),
    ({"notes": "internal"}, 422),  # not a manager's field
    ({"user_id": "dev-tom"}, 422),  # never links a user
    ({"departments": ["dept-maintenance"]}, 422),  # the attachment has its own routes
    ({"kind": "admin"}, 422),
    ({"vendor_id": "nope", "kind": "person"}, 422),
])
def test_invalid_bodies_are_refused(s4, body, status):
    grant(s4)
    assert mk(s4, **body).status_code == status


def test_a_sql_looking_name_is_stored_as_text_and_ids_are_validated(s4):
    grant(s4)
    r = mk(s4, display_name="'; DROP TABLE ticket_contacts;--", phone=None)
    assert r.status_code == 201 and r.json()["display_name"] == "'; DROP TABLE ticket_contacts;--"
    assert s4.c.put(f"{H}/{MAINT}/members/x%27%20OR%201%3D1", headers=s4.h("mona")).status_code == 422
    assert s4.c.put(f"{H}/{MAINT}/members/{'a' * 201}", headers=s4.h("mona")).status_code == 422
    assert s4.c.put(f"{H}/..%2F..%2Fadmin/members/dev-nora", headers=s4.h("mona")).status_code in (404, 422)
