"""CR-DEPT-MANAGER-HANDLERS - the owner's answers to the CR's open questions (2026-10-17), on pilot/DEPTMGR2.

1. `tickets.handlers` stays department managers only, granted manually (no default role, not delegable) - pinned here again;
2. a vendor / contact a manager creates is HIS department's only by default (`shared: true` opts in);
3. an EXACT-phone lookup to attach an existing vendor: exact match only (no prefix / partial match, no listing), rate limited, the number
   masked in the answer, the number in the body (never the URL) and never in an audit row; attaching needs the same number again;
4. a manager edits a PLAIN member's mobile and language - also of one who manages another department (second answer to 3) - never
   the all-departments ("super") manager's or a system administrator's, never the WhatsApp / verification switches;
5. the creating department is stored on the row (`created_department_id`, migration 0113) and shown in the directory list - by name
   only to a configurer and to a manager of that department; anyone else reads "another department".

Negative first in every group. Cast as in test_tickets_dept_handlers.py (mona manages maintenance, cleo cleaning, tom is a plain member
of maintenance, nora is in no department, joni is system_admin)."""
from __future__ import annotations

import json

import pytest

from conftest import bind
from smplwise import db as dbmod
from smplwise.rbac import ROLES
from smplwise.routers.access import DEFAULT_DELEGABLE
from smplwise.services.tickets import dept_handlers
from tickets_s4_world import API, build_s4
from tickets_world import MAINT

H = f"{API}/tickets/dept-handlers"
CLEAN_PHONE = "050-000-0060"
CLEAN_E164 = "972500000060"


@pytest.fixture()
def s4(settings, monkeypatch):
    dept_handlers._LOOKUP_HITS.clear()
    yield build_s4(settings, monkeypatch)
    dept_handlers._LOOKUP_HITS.clear()


def grant(s4, user: str = "mona") -> None:
    bind(s4.c, s4.w.settings, user, "tickets_handlers", "installation", "*")


def audits(s4, like: str) -> list[dict]:
    with s4.db.connection(mode="read") as conn:
        return [dict(r) for r in conn.execute("SELECT * FROM audit_log WHERE action LIKE ? ORDER BY rowid", (like,)).fetchall()]


def mk(s4, user: str = "mona", dept: str = MAINT, **body):
    payload = {"kind": "vendor", "display_name": "חשמל בע\"מ", "phone": "050-000-0051", **body}
    return s4.c.post(f"{H}/{dept}/contacts", json=payload, headers=s4.h(user))


def cleaning_vendor(s4, phone: str = CLEAN_PHONE) -> str:
    r = s4.add_contact(kind="vendor", display_name="ספק ניקיון", phone=phone, departments=[s4.w.cleaning])
    assert r.status_code == 201, r.text
    return r.json()["id"]


def lookup(s4, phone, user: str = "mona", dept: str = MAINT):
    return s4.c.post(f"{H}/{dept}/contacts/lookup", json={"phone": phone}, headers=s4.h(user))


def attach(s4, cid: str, phone, user: str = "mona", dept: str = MAINT):
    return s4.c.post(f"{H}/{dept}/contacts/attach-by-phone", json={"contact_id": cid, "phone": phone}, headers=s4.h(user))


def contact_depts(s4, cid: str) -> list[str]:
    with s4.db.connection(mode="read") as conn:
        return sorted(r[0] for r in conn.execute("SELECT department_id FROM ticket_contact_departments WHERE contact_id = ?", (cid,)))


# ---------------------------------------------------------------- 1. the grant stays manual


def test_the_capability_is_granted_manually_only():
    assert sorted(r for r, perms in ROLES.items() if "tickets.handlers" in perms) == ["system_admin", "tickets_handlers"]
    assert "tickets.handlers" not in ROLES["site_admin"] and "tickets_handlers" not in DEFAULT_DELEGABLE


# ---------------------------------------------------------------- 2. his department only by default


def test_a_new_vendor_or_contact_is_his_department_only_by_default(s4):
    grant(s4)
    v = mk(s4)
    p = mk(s4, kind="person", display_name="איש קשר", phone="050-000-0052")
    assert v.status_code == p.status_code == 201, (v.text, p.text)
    assert v.json()["departments"] == [MAINT] and p.json()["departments"] == [MAINT]
    cleo_rows = {c["id"] for c in s4.c.get(f"{API}/tickets/contacts", headers=s4.h("cleo")).json()["contacts"]}
    assert v.json()["id"] not in cleo_rows and p.json()["id"] not in cleo_rows, "another department never sees it"
    created = [json.loads(a["details_json"]) for a in audits(s4, "ticket.contact.create") if a["resource_id"] in (v.json()["id"], p.json()["id"])]
    assert [c["shared"] for c in created] == [False, False]
    shared = mk(s4, display_name="משותף", phone="050-000-0053", shared=True)
    assert shared.status_code == 201 and shared.json()["departments"] == [], "sharing is an explicit choice"


# ---------------------------------------------------------------- 3. the exact-phone lookup (negative first)


@pytest.mark.parametrize("user", ["mona", "cleo", "tom", "nora", "alda", "vic"])
def test_lookup_and_attach_by_phone_need_the_capability(s4, user):
    cid = cleaning_vendor(s4)
    for r in (lookup(s4, CLEAN_PHONE, user), attach(s4, cid, CLEAN_PHONE, user)):
        assert r.status_code == 403, (user, r.text)
        assert r.json()["details"] == {"permission": "tickets.handlers"}
        assert "ספק ניקיון" not in r.text and cid not in r.text
    assert contact_depts(s4, cid) == [s4.w.cleaning]


def test_lookup_in_a_foreign_department_is_the_uniform_404(s4):
    grant(s4)
    cleaning_vendor(s4)
    foreign, unknown = lookup(s4, CLEAN_PHONE, dept=s4.w.cleaning), lookup(s4, CLEAN_PHONE, dept="dept-nope-1")
    assert foreign.status_code == unknown.status_code == 404 and foreign.json()["code"] == unknown.json()["code"] == "not_found"
    assert "ספק ניקיון" not in foreign.text


def test_the_phone_never_travels_in_the_url(s4):
    grant(s4)
    assert s4.c.get(f"{H}/{MAINT}/contacts/lookup", params={"phone": CLEAN_PHONE}, headers=s4.h("mona")).status_code in (404, 405)
    assert s4.c.post(f"{H}/{MAINT}/contacts/lookup", params={"phone": CLEAN_PHONE}, json={}, headers=s4.h("mona")).status_code == 422


@pytest.mark.parametrize("partial", ["050-000-006", "0600", "972500000", "50000006", "%", "050-000-006_", "*"])
def test_only_an_exact_number_matches_no_prefix_no_partial_no_wildcard(s4, partial):
    grant(s4)
    cleaning_vendor(s4)
    r = lookup(s4, partial)
    assert r.status_code in (200, 422), r.text
    if r.status_code == 200:
        assert r.json() == {"matches": []}


@pytest.mark.parametrize("bad", ["", "abc", "050' OR '1'='1", "0" * 41, None, 5])
def test_lookup_validates_the_number(s4, bad):
    grant(s4)
    assert lookup(s4, bad).status_code == 422


def test_lookup_is_rate_limited_and_the_refusal_is_audited(s4):
    grant(s4)
    for i in range(5):
        assert lookup(s4, f"050-000-07{i:02d}").status_code == 200
    r = lookup(s4, CLEAN_PHONE)
    assert r.status_code == 429 and r.json()["code"] == "rate_limited"
    assert attach(s4, s4.vendor["id"], "+972 50 000 0032").status_code == 429, "the attach shares the bucket"
    assert any(a["reason"] == "rate_limited" for a in audits(s4, "ticket.contact.%") if a["decision"] == "denied")
    grant(s4, "cleo")
    assert lookup(s4, CLEAN_PHONE, user="cleo", dept=s4.w.cleaning).status_code == 200, "per caller, not global"


def test_attach_by_phone_needs_the_same_exact_number(s4):
    grant(s4)
    cid = cleaning_vendor(s4)
    wrong = attach(s4, cid, "050-000-0061")
    ghost = attach(s4, "nope-123", CLEAN_PHONE)
    assert wrong.status_code == ghost.status_code == 404 and wrong.json()["code"] == ghost.json()["code"] == "contact_not_found"
    assert wrong.json()["user_message"] == ghost.json()["user_message"]
    assert s4.c.put(f"{H}/{MAINT}/contacts/{cid}", headers=s4.h("mona")).status_code == 404, "the id alone still attaches nothing"
    assert contact_depts(s4, cid) == [s4.w.cleaning]


def test_only_live_vendors_are_found_or_attached(s4):
    grant(s4)
    person = s4.add_contact(kind="person", display_name="אדם", phone="050-000-0062", departments=[s4.w.cleaning]).json()["id"]
    employee = s4.add_contact(kind="employee", display_name="עובד", phone="050-000-0063", departments=[s4.w.cleaning]).json()["id"]
    assert lookup(s4, "050-000-0062").json() == {"matches": []} and lookup(s4, "050-000-0063").json() == {"matches": []}
    assert attach(s4, person, "050-000-0062").status_code == 404 and attach(s4, employee, "050-000-0063").status_code == 404
    gone = cleaning_vendor(s4, "050-000-0064")
    assert s4.c.post(f"{API}/tickets/contacts/{gone}/erase", json={"confirm": True, "history": False}).status_code == 200
    dept_handlers._LOOKUP_HITS.clear()  # four calls above; the per-minute limit is test_lookup_is_rate_limited_...
    assert lookup(s4, "050-000-0064").json() == {"matches": []} and attach(s4, gone, "050-000-0064").status_code == 404


def test_lookup_finds_the_exact_vendor_masked_and_names_no_other_department(s4):
    grant(s4)
    cid = cleaning_vendor(s4)
    r = lookup(s4, "+972 (50) 000-0060")
    assert r.status_code == 200, r.text
    [m] = r.json()["matches"]
    assert m["id"] == cid and m["display_name"] == "ספק ניקיון" and m["phone"] == "•••• 0060"
    assert m["shared"] is False and m["attached"] is False and set(m) == {"id", "kind", "display_name", "company", "phone", "active", "shared", "attached"}
    raw = r.text
    assert CLEAN_E164 not in raw and "000-0060" not in raw and s4.w.cleaning not in raw and "ניקיון" not in raw.replace("ספק ניקיון", "")
    [a] = audits(s4, "ticket.contact.lookup")
    assert json.loads(a["details_json"]) == {"department_id": MAINT, "via": "department_manager", "matches": 1}
    assert "0060" not in json.dumps(a, ensure_ascii=False)


def test_attach_by_phone_attaches_idempotently_and_keeps_the_details_his_peers(s4):
    grant(s4)
    cid = cleaning_vendor(s4)
    a1, a2 = attach(s4, cid, CLEAN_PHONE), attach(s4, cid, "0500000060")
    assert a1.status_code == a2.status_code == 200, a1.text
    assert contact_depts(s4, cid) == sorted([MAINT, s4.w.cleaning])
    assert a1.json()["manager_editable"] is False, "attached, not his: only the attachment is his"
    assert cid in {c["id"] for c in s4.c.get(f"{API}/tickets/contacts", headers=s4.h("mona")).json()["contacts"]}
    rows = [x for x in audits(s4, "ticket.contact.attach") if x["resource_id"] == cid]
    assert len(rows) == 1 and json.loads(rows[0]["details_json"]) == {"department_id": MAINT, "via": "department_manager", "by": "phone"}
    assert lookup(s4, CLEAN_PHONE).json()["matches"][0]["attached"] is True
    assert s4.c.patch(f"{H}/{MAINT}/contacts/{cid}", json={"display_name": "x", "revision": s4.contact_rev(cid)}, headers=s4.h("mona")).status_code == 403


def test_a_shared_vendor_is_found_but_not_narrowed(s4):
    grant(s4)
    [m] = lookup(s4, "+972 50 000 0032").json()["matches"]
    assert m["id"] == s4.vendor["id"] and m["shared"] is True
    r = attach(s4, s4.vendor["id"], "+972 50 000 0032")
    assert r.status_code == 409 and r.json()["code"] == "shared_entry"
    assert contact_depts(s4, s4.vendor["id"]) == []


# ---------------------------------------------------------------- 4. a plain member's mobile and language (negative first)


def mobile(s4, user_id: str, body, user: str = "mona", dept: str = MAINT):
    return s4.c.put(f"{H}/{dept}/members/{user_id}/mobile", json=body, headers=s4.h(user))


def staff_row(s4, uid: str) -> dict | None:
    with s4.db.connection(mode="read") as conn:
        r = conn.execute("SELECT phone_e164, lang FROM ticket_contacts WHERE user_id = ? AND erased_at IS NULL", (uid,)).fetchone()
        return dict(r) if r else None


@pytest.mark.parametrize("user", ["mona", "cleo", "tom", "nora", "alda", "vic"])
def test_member_mobile_needs_the_capability(s4, user):
    r = mobile(s4, "dev-tom", {"phone": "050-000-0073"}, user)
    assert r.status_code == 403 and r.json()["details"] == {"permission": "tickets.handlers"}
    assert staff_row(s4, "dev-tom") is None


def test_member_mobile_in_a_foreign_department_or_of_a_non_member_is_refused(s4):
    grant(s4)
    assert mobile(s4, "dev-cleo", {"phone": "050-000-0074"}, dept=s4.w.cleaning).json()["code"] == "not_found"
    assert mobile(s4, "dev-nora", {"phone": "050-000-0074"}).status_code == 404, "not a member of his department"
    assert mobile(s4, "dev-ghost", {"phone": "050-000-0074"}).status_code == 404
    assert staff_row(s4, "dev-cleo") is None and staff_row(s4, "dev-nora") is None


def test_the_super_manager_and_a_system_administrator_are_refused(s4):
    """Owner 2026-10-17, second answer to question 3: only the all-departments ("super") manager and system administrators stay
    refused (403 manager_row), even as plain members of his department; and a manager row of THIS department is never his."""
    grant(s4)
    s4.w.member(MAINT, "alda", "member")  # alda holds tickets.all_departments
    s4.w.member(MAINT, "joni", "member")  # joni is a system administrator
    for uid in ("dev-alda", "dev-joni"):
        r = mobile(s4, uid, {"phone": "050-000-0075"})
        assert r.status_code == 403 and r.json()["code"] == "manager_row", (uid, r.text)
        assert mobile(s4, uid, {"lang": "en"}).status_code == 403, "the language too"
        assert staff_row(s4, uid) is None
    flags = {m["id"]: m["mobile_editable"] for m in s4.c.get(H, headers=s4.h("mona")).json()["departments"][0]["members"] if m["kind"] == "user"}
    assert flags["dev-alda"] is False and flags["dev-joni"] is False
    s4.w.member(MAINT, "nora", "manager")
    assert mobile(s4, "dev-nora", {"phone": "050-000-0075"}).json()["code"] == "manager_row", "a manager row of this department"
    assert mobile(s4, "dev-mona", {"phone": "050-000-0075"}).json()["code"] == "manager_row", "not even his own here"
    assert staff_row(s4, "dev-nora") is None
    denied = [a for a in audits(s4, "ticket.contact.update") if a["decision"] == "denied" and a["reason"] == "manager_row"]
    assert len(denied) >= 6 and all("0075" not in (a["details_json"] or "") for a in denied)


def test_a_member_who_manages_another_department_is_allowed(s4):
    grant(s4)
    s4.w.member(MAINT, "cleo", "member")  # cleo manages cleaning, and is a plain member of maintenance
    flags = {m["id"]: m["mobile_editable"] for m in s4.c.get(H, headers=s4.h("mona")).json()["departments"][0]["members"] if m["kind"] == "user"}
    assert flags["dev-cleo"] is True and flags["dev-tom"] is True
    r = mobile(s4, "dev-cleo", {"phone": "050-000-0077", "lang": "en"})
    assert r.status_code == 200, r.text
    assert staff_row(s4, "dev-cleo") == {"phone_e164": "972500000077", "lang": "en"}
    s4.w.member(s4.w.cleaning, "tom", "manager")  # tom: a plain member here, now a manager elsewhere
    assert mobile(s4, "dev-tom", {"phone": "050-000-0078"}).status_code == 200
    assert staff_row(s4, "dev-tom")["phone_e164"] == "972500000078"
    # outside his own department: still the uniform 404 (cleo's own department is not mona's)
    assert mobile(s4, "dev-cleo", {"phone": "050-000-0079"}, dept=s4.w.cleaning).json()["code"] == "not_found"
    assert staff_row(s4, "dev-cleo")["phone_e164"] == "972500000077"


@pytest.mark.parametrize("body", [{"notify_whatsapp": True}, {"phone_verify": False}, {"phone": "050-000-0076", "user_id": "dev-nora"},
                                  {}, {"phone": "abc"}, {"lang": "fr"}, {"phone": "0" * 41}])
def test_member_mobile_takes_the_number_and_the_language_only(s4, body):
    grant(s4)
    assert mobile(s4, "dev-tom", body).status_code == 422
    assert staff_row(s4, "dev-tom") is None


def test_a_manager_sets_a_plain_members_mobile_and_language(s4):
    grant(s4)
    view = s4.c.get(H, headers=s4.h("mona")).json()["departments"][0]["members"]
    flags = {m["id"]: m.get("mobile_editable") for m in view}
    assert flags["dev-tom"] is True and flags["dev-mona"] is False
    r = mobile(s4, "dev-tom", {"phone": "050-000-0073", "lang": "ar"})
    assert r.status_code == 200, r.text
    tom = next(m for m in r.json()["members"] if m["id"] == "dev-tom")
    assert tom["mobile"] == "•••• 0073" and tom["mobile_full"] is False and tom["lang"] == "ar" and tom["mobile_confirmed"] is False
    assert staff_row(s4, "dev-tom") == {"phone_e164": "972500000073", "lang": "ar"}
    r = mobile(s4, "dev-tom", {"lang": "ru"})
    assert r.status_code == 200 and staff_row(s4, "dev-tom")["lang"] == "ru"
    rows = [json.loads(a["details_json"]) for a in audits(s4, "ticket.contact.%") if a["decision"] == "allowed" and "dev-tom" in (a["details_json"] or "")]
    assert rows and all(x["department_id"] == MAINT and x["via"] == "department_manager" for x in rows)
    assert "0073" not in json.dumps(rows), "field names and ids only"


def test_a_changed_mobile_is_unconfirmed_again_for_the_person(s4):
    grant(s4)
    s4.w.c.put(f"{API}/tickets/admin/staff/dev-tom", json={"phone": "050-000-0072"})
    with s4.db.connection() as conn:
        conn.execute("UPDATE ticket_contacts SET phone_confirmed_at = '2026-10-17T08:00:00Z', phone_confirmed_via = 'user' WHERE user_id = 'dev-tom'")
    tom = next(m for m in mobile(s4, "dev-tom", {"phone": "050-000-0079"}).json()["members"] if m["id"] == "dev-tom")
    assert tom["mobile_confirmed"] is False


# ---------------------------------------------------------------- 5. the creating department (0113)


def test_the_creating_department_is_stored_and_named_only_to_who_may_know_it(s4):
    grant(s4)
    own = mk(s4).json()["id"]
    shared = mk(s4, display_name="משותף", phone="050-000-0054", shared=True).json()["id"]
    with s4.db.connection(mode="read") as conn:
        assert conn.execute("SELECT created_department_id FROM ticket_contacts WHERE id = ?", (own,)).fetchone()[0] == MAINT
    admin = {c["id"]: c for c in s4.c.get(f"{API}/tickets/contacts").json()["contacts"]}
    assert admin[own]["created_department"]["id"] == MAINT and admin[own]["created_department"]["name"]
    assert admin[s4.vendor["id"]]["created_department"] is None, "created in Settings"
    mona = {c["id"]: c for c in s4.c.get(f"{API}/tickets/contacts", headers=s4.h("mona")).json()["contacts"]}
    assert mona[own]["created_department"] == admin[own]["created_department"]
    cleo = {c["id"]: c for c in s4.c.get(f"{API}/tickets/contacts", headers=s4.h("cleo")).json()["contacts"]}
    assert cleo[shared]["created_department"] == {"id": None, "name": None, "other": True}
    assert MAINT not in json.dumps(cleo[shared]) and admin[own]["created_department"]["name"] not in json.dumps(cleo[shared], ensure_ascii=False)
    one = s4.c.get(f"{API}/tickets/contacts/{shared}", headers=s4.h("cleo"))
    assert one.status_code == 200 and one.json()["created_department"]["other"] is True


def test_migration_0113_backfills_the_rows_managers_created_from_their_audit_rows(s4):
    sql = (dbmod.MIGRATIONS_DIR / "0113_ticket_contact_created_department.sql").read_text(encoding="utf-8")
    backfill = sql[sql.index("UPDATE ticket_contacts"):]
    at = "2026-10-17T08:00:00Z"
    with s4.db.connection() as conn:
        for cid in ("bf-mgr", "bf-cfg", "bf-bad"):
            conn.execute("INSERT INTO ticket_contacts(id, kind, display_name, created_by, created_at, updated_at) VALUES (?, 'vendor', 'Example', 'u', ?, ?)", (cid, at, at))
        conn.execute("INSERT INTO audit_log(at, action, resource_type, resource_id, decision, details_json) VALUES (?, 'ticket.contact.create', 'ticket_contact', 'bf-mgr', 'allowed', ?)",
                     (at, json.dumps({"department_id": MAINT, "via": "department_manager"})))
        conn.execute("INSERT INTO audit_log(at, action, resource_type, resource_id, decision, details_json) VALUES (?, 'ticket.contact.create', 'ticket_contact', 'bf-cfg', 'allowed', ?)",
                     (at, json.dumps({"kind": "vendor"})))
        conn.execute("INSERT INTO audit_log(at, action, resource_type, resource_id, decision, details_json) VALUES (?, 'ticket.contact.create', 'ticket_contact', 'bf-bad', 'allowed', 'not json')", (at,))
        conn.executescript(backfill)
        got = dict(conn.execute("SELECT id, created_department_id FROM ticket_contacts WHERE id LIKE 'bf-%'").fetchall())
    assert got == {"bf-mgr": MAINT, "bf-cfg": None, "bf-bad": None}
