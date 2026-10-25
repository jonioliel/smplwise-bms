"""CR-038 section 8 - THE visibility rule, the permission matrix and the holes of the independent review (TICKETS_SPEC_REVIEW
2026-10-13, C7 / T18 / T19), proven through the API:

- the matrix: system admin / department manager / member / non-member creator / floor-scoped creator / manager of another department /
  all-departments viewer / member with a deny / viewer / module off - who sees a ticket, fully or limited, who may manage it;
- C7 / T18-1: a floor-scoped user keeps the placeless tickets they created ("any held scope");
- T18-2: internal notes and photos never reach a creator or assignee who is not a member;
- placed tickets: the place target decides (a floor-scoped member does not see another floor's ticket; a deny on the chain removes it);
- T18-5: the assignee picker names the department's eligible members only;
- the route enumeration: EVERY route that takes a ticket id answers the same 404 `ticket_not_found` for a ticket the caller may not see
  (a route added by a later slice must be added to BODIES below, or this test fails), and lists never carry an invisible ticket;
- the bypass guard: only services/tickets/access.py reads ticket rows unchecked."""
from __future__ import annotations

import io
import re
from pathlib import Path

import pytest
from fastapi.routing import APIRoute
from PIL import Image

from smplwise.routers import tickets as tickets_router, tickets_admin
from tickets_world import API, MAINT, build

SMPLWISE = Path(__file__).resolve().parents[1] / "smplwise"


@pytest.fixture()
def w(settings):
    return build(settings)


def _jpeg() -> bytes:
    buf = io.BytesIO()
    Image.new("RGB", (64, 48), (200, 120, 40)).save(buf, format="JPEG")
    return buf.getvalue()


# ---------------------------------------------------------------- the matrix

EXPECT_T1 = {  # a placeless ticket of maintenance, opened by nora (not a member), unassigned
    "joni": ("full", True), "mona": ("full", True), "tom": ("full", False), "nora": ("limited", False), "gil": ("full", False),
    "alda": ("full", False), "fred": None, "cleo": None, "dina": None, "vic": None,
}


def test_the_permission_matrix_on_a_placeless_ticket(w):
    t1 = w.create("nora", "שקע חשמל שרוף")
    for user, expected in EXPECT_T1.items():
        r = w.get(user, t1["id"])
        if expected is None:
            assert r.status_code == 404 and r.json()["code"] == "ticket_not_found", (user, r.status_code, r.text)
            continue
        assert r.status_code == 200, (user, r.text)
        view, manager = expected
        assert r.json()["view"] == view and r.json()["can"]["manage"] is manager, (user, r.json()["view"], r.json()["can"])
    w.c.patch(f"{API}/settings", json={"tickets.enabled": "false"})
    for user in EXPECT_T1:
        assert w.get(user, t1["id"]).json()["code"] == "feature_disabled", user


def test_who_may_create_where(w):
    # an operator creates in a department open to all; a viewer, a denied member and a caller without tickets.create cannot
    assert w.create("tom")["status"] == "new"
    assert w.create("fred")["view"] == "limited", "a floor-scoped creator sees the placeless ticket they opened (C7 / T18-1)"
    for user, code in (("vic", 403), ("alda", 403)):
        r = w.c.post(f"{API}/tickets", json={"department_id": MAINT, "title": "x", "client_request_id": "req-cannot-01"}, headers=w.h(user))
        assert r.status_code == code, (user, r.text)
    # a department closed to outsiders: members only
    rev = w.c.get(f"{API}/tickets/admin/departments").json()["departments"]
    clean = next(d for d in rev if d["id"] == w.cleaning)
    assert w.c.patch(f"{API}/tickets/admin/departments/{w.cleaning}", json={"open_to_all": False, "revision": clean["revision"]}).status_code == 200
    r = w.c.post(f"{API}/tickets", json={"department_id": w.cleaning, "title": "x", "client_request_id": "req-closed-001"}, headers=w.h("tom"))
    assert r.status_code == 403
    assert w.create("cleo", dept=w.cleaning)["view"] == "full"


def test_the_floor_scoped_creator_keeps_their_placeless_tickets_in_lists_too(w):
    mine = w.create("fred", "נזילה בקומה 2")
    other = w.create("nora")
    items = w.c.get(f"{API}/tickets", headers=w.h("fred")).json()["items"]
    assert [i["id"] for i in items] == [mine["id"]] and items[0]["view"] == "limited"
    assert other["id"] not in [i["id"] for i in w.c.get(f"{API}/tickets?scope=mine", headers=w.h("fred")).json()["items"]]


def test_internal_notes_and_photos_never_reach_a_non_member_creator(w):
    t = w.create("nora")
    internal = w.c.post(f"{API}/tickets/{t['id']}/notes", json={"text": "פנימי: הדייר מסרב לפתוח", "external": False}, headers=w.h("mona"))
    shared = w.c.post(f"{API}/tickets/{t['id']}/notes", json={"text": "נגיע מחר בבוקר", "external": True}, headers=w.h("mona"))
    assert internal.status_code == 201 and shared.status_code == 201
    own = w.c.post(f"{API}/tickets/{t['id']}/notes", json={"text": "תודה"}, headers=w.h("nora"))
    assert own.status_code == 201
    w.c.post(f"{API}/tickets/{t['id']}/attachments", files={"file": ("a.jpg", _jpeg(), "image/jpeg")}, data={"external": "false"}, headers=w.h("mona"))
    w.c.post(f"{API}/tickets/{t['id']}/attachments", files={"file": ("b.jpg", _jpeg(), "image/jpeg")}, data={"external": "true"}, headers=w.h("mona"))
    limited = w.detail(t["id"], "nora")
    bodies = [e["body"] for e in limited["events"] if e["kind"] == "note"]
    assert bodies == ["נגיע מחר בבוקר", "תודה"], bodies
    assert [a["external"] for a in limited["attachments"]] == [True]
    assert limited["assignments"] == [] and limited["close_note"] is None
    full = w.detail(t["id"], "tom")
    assert [e["body"] for e in full["events"] if e["kind"] == "note"] == ["פנימי: הדייר מסרב לפתוח", "נגיע מחר בבוקר", "תודה"]
    assert len(full["attachments"]) == 2
    internal_photo = next(a for a in full["attachments"] if not a["external"])
    assert w.c.get(f"{API}/{internal_photo['url']}", headers=w.h("nora")).status_code == 404, "the internal photo is not served to her either"
    assert w.c.get(f"{API}/{internal_photo['url']}", headers=w.h("tom")).status_code == 200
    # a non-manager cannot mark a note or a photo for the handler
    assert w.c.post(f"{API}/tickets/{t['id']}/notes", json={"text": "x", "external": True}, headers=w.h("tom")).status_code == 403


def test_placed_tickets_follow_the_place_target_and_its_denies(w):
    t = w.create("tom", "דלת חירום תקועה")
    w.place(t["id"], "floor2")
    assert w.get("tom", t["id"]).status_code == 200, "installation-wide member"
    assert w.get("gil", t["id"]).status_code == 404, "a member scoped to floor 3 does not see a floor-2 ticket"
    assert w.get("fred", t["id"]).status_code == 404, "floor 2 but no reason (not a member, not the creator)"
    assert w.get("alda", t["id"]).status_code == 200
    w.deny("tom", "tickets_view", "floor", w.floors["floor2"])
    assert w.get("tom", t["id"]).status_code == 404, "a deny on the place chain beats every allow"
    assert w.get("tom", w.create("tom")["id"]).status_code == 200, "the deny is on floor 2 only: placeless tickets stay"


def test_list_scopes_carry_only_visible_tickets(w):
    a = w.create("nora", "א")
    b = w.create("cleo", "ב", dept=w.cleaning)
    c = w.create("tom", "ג")
    ids = lambda user, q="": [i["id"] for i in w.c.get(f"{API}/tickets{q}", headers=w.h(user)).json()["items"]]  # noqa: E731
    assert set(ids("joni")) == {a["id"], b["id"], c["id"]}
    assert set(ids("mona")) == {a["id"], c["id"]}
    assert set(ids("cleo")) == {b["id"]}
    assert set(ids("nora")) == {a["id"]}
    assert w.c.get(f"{API}/tickets", headers=w.h("vic")).status_code == 403
    assert set(ids("mona", "?scope=department")) == {a["id"], c["id"]}
    assert ids("nora", "?scope=department") == []
    assert set(ids("tom", "?scope=mine")) == {c["id"]}
    assert w.c.get(f"{API}/tickets?scope=all", headers=w.h("mona")).status_code == 403
    assert set(ids("alda", "?scope=all")) == {a["id"], b["id"], c["id"]}


def test_the_assignee_picker_names_eligible_members_only(w):
    t = w.create("nora")
    r = w.c.get(f"{API}/tickets/assignees?department_id={MAINT}&ticket_id={t['id']}", headers=w.h("mona"))
    assert r.status_code == 200, r.text
    names = {u["id"]: u["member_role"] for u in r.json()["users"]}
    # gil holds tickets.view on floor 3 only - "anywhere" for a placeless ticket - so he is eligible; dina is denied
    assert names == {"dev-mona": "manager", "dev-tom": "member", "dev-gil": "member"}, names
    assert set(r.json()["users"][0]) == {"kind", "id", "name", "member_role"}, "names only, no bindings"
    assert w.c.get(f"{API}/tickets/assignees?department_id={MAINT}", headers=w.h("cleo")).status_code == 403
    assert w.c.get(f"{API}/tickets/assignees?department_id={MAINT}", headers=w.h("tom")).status_code == 403
    w.place(t["id"], "floor2")
    names = {u["id"] for u in w.c.get(f"{API}/tickets/assignees?department_id={MAINT}&ticket_id={t['id']}", headers=w.h("mona")).json()["users"]}
    assert names == {"dev-mona", "dev-tom"}, "on a floor-2 ticket the floor-3 member is not eligible"


# ---------------------------------------------------------------- every route that takes a ticket id

def _route_requests(t_id: str, att_id: str) -> dict[tuple[str, str], dict]:
    """A VALID request for every route with a ticket id (an invalid one would be refused before the visibility check)."""
    return {
        ("GET", "/tickets/{ticket_id}"): {},
        ("PATCH", "/tickets/{ticket_id}"): {"json": {"title": "x", "revision": 1}},
        ("POST", "/tickets/{ticket_id}/status"): {"json": {"to": "cancelled", "note": "x", "revision": 1}},
        ("POST", "/tickets/{ticket_id}/assign"): {"json": {"assignee": {"kind": "user", "id": "dev-tom"}, "revision": 1}},
        ("POST", "/tickets/{ticket_id}/return"): {"json": {"kind": "not_mine", "reason": "x", "revision": 1}},
        ("POST", "/tickets/{ticket_id}/notes"): {"json": {"text": "x"}},
        ("POST", "/tickets/{ticket_id}/eta"): {"json": {"eta_at": None}},
        ("POST", "/tickets/{ticket_id}/attachments"): {"files": {"file": ("a.jpg", _jpeg(), "image/jpeg")}},
        ("GET", "/tickets/{ticket_id}/attachments/{attachment_id}"): {},
        ("DELETE", "/tickets/{ticket_id}/attachments/{attachment_id}"): {},
        # owner 14.10: full deletion (the visibility check comes before the permission, the number and the reason)
        ("POST", "/tickets/{ticket_id}/delete"): {"json": {"reason": "x", "confirm_number": 1001, "client_request_id": "vis-delete-0001"}},
        # PHYSENTRY070-295: "entry required" on the current outside assignment (the visibility check comes before the assignment check)
        ("POST", "/tickets/{ticket_id}/access-needed"): {"json": {"value": True, "revision": 1}},
    }


def test_every_route_with_a_ticket_id_answers_the_uniform_404_for_an_invisible_ticket(w):
    t = w.create("tom")
    att = w.c.post(f"{API}/tickets/{t['id']}/attachments", files={"file": ("a.jpg", _jpeg(), "image/jpeg")}, headers=w.h("tom")).json()["attachments"][0]
    requests = _route_requests(t["id"], att["id"])
    routes = {(m, r.path) for router in (tickets_router.router, tickets_admin.router) for r in router.routes if isinstance(r, APIRoute)
              for m in r.methods if "{ticket_id}" in r.path}
    assert routes == set(requests), f"a route with a ticket id is missing from this test (add a valid request for it): {routes ^ set(requests)}"
    for (method, template), kwargs in requests.items():
        path = API + template.replace("{ticket_id}", t["id"]).replace("{attachment_id}", att["id"])
        for user in ("cleo", "fred", "dina"):
            r = w.c.request(method, path, headers=w.h(user), **kwargs)
            assert r.status_code == 404 and r.json()["code"] == "ticket_not_found", (user, method, template, r.status_code, r.text)
        unknown = API + template.replace("{ticket_id}", "f00df00df00df00d").replace("{attachment_id}", att["id"])
        assert w.c.request(method, unknown, **kwargs).json()["code"] == "ticket_not_found", "an unknown id: the same answer"
    # nothing was changed by the refused calls
    assert w.detail(t["id"])["status"] == "new" and len(w.detail(t["id"])["attachments"]) == 1


def test_a_duplicate_link_names_only_an_original_the_caller_may_see(w):
    original = w.create("cleo", "חלון שבור", dept=w.cleaning)
    dup = w.create("tom", "חלון שבור")
    r = w.status("joni", dup["id"], "cancelled", note="כפולה", duplicate_of=original["id"])
    assert r.status_code == 200, r.text
    assert r.json()["duplicate_of"] == {"id": original["id"], "number": original["number"]}
    assert w.detail(dup["id"], "mona")["duplicate_of"] is None, "mona cannot see the cleaning department's original"
    # and a duplicate target the caller cannot see is refused like an unknown one
    third = w.create("tom", "עוד אחד")
    r = w.status("mona", third["id"], "cancelled", note="כפולה", duplicate_of=original["id"])
    assert r.status_code == 422 and r.json()["details"]["fields"][0]["field"] == "duplicate_of"


# ---------------------------------------------------------------- the bypass guard

def test_only_the_access_module_reads_ticket_rows_unchecked():
    offenders = []
    for path in SMPLWISE.rglob("*.py"):
        rel = path.relative_to(SMPLWISE).as_posix()
        if rel in ("services/tickets/access.py", "services/tickets/store.py"):
            continue
        text = path.read_text(encoding="utf-8")
        if re.search(r"\b(ticket_row_unchecked|ticket_rows_unchecked|ticket_by_number_unchecked|open_by_dedupe_key_unchecked|candidate_rows|entity_ticket_rows_unchecked)\b", text):
            offenders.append(rel)
    assert offenders == [], f"a ticket row read around access.visible(): {offenders}"


def test_ticket_sql_lives_in_the_store():
    offenders = []
    routers = [SMPLWISE / "routers" / n for n in ("tickets.py", "tickets_admin.py", "tickets_contacts.py", "tickets_links.py", "tickets_messages.py",
                                                  "tickets_detail.py", "tickets_rfq.py")]
    for path in list((SMPLWISE / "services" / "tickets").glob("*.py")) + [r for r in routers if r.is_file()]:
        # the storage layer: core (0079), directory and links (0080, slice 4), outbox and inbound (0081, slice 5b), cost claims (0083, slice 9),
        # quotes, owner history, allowed kinds (0087 TKDETAILBE; it replaced the 0085 TK257 quote table), requests for quotation (0089 TKRFQ1), organisation locations (0101, CR-ORG-LOCATIONS)
        # integ/263: map_element.py (TKMAP1, its own table ticket_map_elements) and phone_verify.py (TKNOTIFOTP, ticket_phone_verifications
        # and the contact verification columns) were merged with their SQL in place - recorded exceptions, a follow-up may move them
        if path.name in ("store.py", "store_links.py", "outbox_store.py", "store_costs.py", "store_quotes.py", "store_rfq.py", "store_locations.py",
                         "map_element.py", "phone_verify.py", "vendor_portal.py",  # + VPORTAL (its own 0105 tables), same recorded exception
                         "dept_handlers.py", "handler_load.py",  # integ/264: DEPTMGR / HANDLERLOAD read-only queries in place - recorded, a follow-up may move them
                         "portal_more.py", "rfq_vendor_files.py",  # integ/270: VPORTALRFQ (0112) / RFQ-VENDOR-UPLOAD (0109) SQL in place - recorded exceptions
                         "store_dash.py",  # MGRDASH phase 2: the summary route's read-only SQL (a store module of its own)
                         "store_dash_extra.py",  # MGRDASH phases 4-5: the payments board and the alerts (read-only, a store module of its own)
                         "store_rules.py",  # TKRULES-291: the rule engine's fires (0123) and its read of the open alerts (a store module of its own)
                         "store_acceptance.py",  # CR-ACCEPT102: the smart acceptance's rows (0151) and its ticket reads (a store module of its own)
                         "store_visits.py", "store_budgets.py", "store_vendor_stats.py",  # CR-SVC215 (0156): visits, budgets, the vendor card (store modules of their own)
                         # 2.16.0 integration (TENANTINTAKE098, migration 0170): intake.py reads / writes its own ticket_intake_* tables and the one
                         # ticket_inbound link column in messaging.py (an inbound row's draft id); recorded exceptions, a follow-up may move them into a store
                         "intake.py", "messaging.py"):
            continue
        if re.search(r"\b(FROM|INTO|UPDATE)\s+ticket", path.read_text(encoding="utf-8")):
            offenders.append(path.name)
    assert offenders == [], f"all SQL of the tickets module lives in services/tickets/store.py: {offenders}"
