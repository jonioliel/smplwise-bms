"""CR-ORG-LOCATIONS (owner request 2026-10-17, docs/changes/CR-ORG-LOCATIONS.md) - the organisation's locations over the REAL store:
migration 0101 (provisional number), the Settings API (tickets.configure edits, request creators / viewers read active ones), the picker
on ticket and RFQ creation with the reference + snapshot, and the vendor side (only the request that names a location shows it; the
map link only when switched on for that request).

Negative cases first: permissions, uniqueness, length limits, URL / control characters, SQL and HTML text kept literal, delete vs
referenced, an inactive or unknown location refused, snapshot immutability, no address in another request / public route.
Every name and address here is invented."""
from __future__ import annotations

import json
import time

import pytest
from conftest import bind

from smplwise.services.tickets import messaging, org_locations, rfq as rfq_mod, rfq_links, store, store_links, store_rfq
from smplwise.services.tickets.public_http import UNIFORM_404
from tickets_s4_world import API, Clock, build_s4, crid

HQ = {"name": "מטה ראשי", "street": "הרצל 5", "city": "תל אביב", "details": "בניין B, קומה 3, כניסה מהחניון"}
DAY = 86400.0


@pytest.fixture()
def s4(settings, monkeypatch):
    world = build_s4(settings, monkeypatch)
    bind(world.c, settings, "mona", "tickets_external", "installation", "*")
    rev = world.c.get(f"{API}/tickets/channel").json()["revision"]
    assert world.c.put(f"{API}/tickets/channel", json={"revision": rev, "whatsapp": {"enabled": True}}).status_code == 200
    monkeypatch.setattr(rfq_mod, "VENDOR_PAGE", True)
    return world


def add_loc(s4, user: str = "joni", **body):
    return s4.c.post(f"{API}/tickets/admin/locations", json={**HQ, **body}, headers=s4.h(user))


def loc_id(s4, **body) -> str:
    r = add_loc(s4, **body)
    assert r.status_code == 201, r.text
    return r.json()["id"]


def admin(s4) -> dict:
    r = s4.c.get(f"{API}/tickets/admin/locations")
    assert r.status_code == 200, r.text
    return r.json()


def one(s4, lid: str) -> dict:
    return next(x for x in admin(s4)["locations"] if x["id"] == lid)


def patch(s4, lid: str, user: str = "joni", **body):
    return s4.c.patch(f"{API}/tickets/admin/locations/{lid}", json=body, headers=s4.h(user))


def rfq(s4, user: str = "mona", **body) -> dict:
    payload = {"department_id": "dept-maintenance", "title": "החלפת מזגן", "vendors": [{"contact_id": s4.vendor["id"]}],
               "client_request_id": crid(), **body}
    r = s4.c.post(f"{API}/tickets/rfqs", json=payload, headers=s4.h(user))
    assert r.status_code == 201, r.text
    return r.json()


def send(s4, d: dict, **extra):
    r = s4.c.post(f"{API}/tickets/rfqs/{d['id']}/send", json={"revision": d["revision"], "channel": "auto", "client_request_id": crid(), **extra},
                  headers=s4.h("mona"))
    assert r.status_code == 200, r.text
    return r.json()


def invite_params(s4, rfq_id: str) -> list[dict]:
    with s4.db.connection(mode="read") as conn:
        rows = conn.execute("SELECT params_json FROM ticket_outbox WHERE rfq_id = ? AND purpose = 'rfq_invite'", (rfq_id,)).fetchall()
    return [json.loads(r["params_json"]) for r in rows]


def vendor_token(s4, d: dict) -> str:
    vid = next(v["id"] for v in d["vendors"] if v["contact"]["id"] == s4.vendor["id"])
    with s4.db.connection(mode="read") as conn:
        row = store_rfq.link_of_vendor(conn, vid)
    return rfq_links.token_of(row)


def vendor_view(s4, tok: str) -> dict:
    c, _app = s4.public(Clock(time.time()))
    r = c.get("/t/api/rfq", headers={"x-ticket-token": tok})
    assert r.status_code == 200, r.text
    return r.json()


# ---------------------------------------------------------------- permissions

def test_only_tickets_configure_edits_and_nobody_without_a_ticket_permission_reads(s4):
    lid = loc_id(s4)
    for user in ("mona", "tom", "alda"):  # a department manager, a member, an all-departments viewer: none holds tickets.configure
        assert add_loc(s4, user, name=f"x-{user}").status_code == 403
        assert patch(s4, lid, user, name="שונה").status_code == 403
        assert s4.c.delete(f"{API}/tickets/admin/locations/{lid}", headers=s4.h(user)).status_code == 403
        assert s4.c.get(f"{API}/tickets/admin/locations", headers=s4.h(user)).status_code == 403
        assert s4.c.put(f"{API}/tickets/admin/departments/dept-maintenance/location", json={"location_id": lid}, headers=s4.h(user)).status_code == 403
    # a person with no ticket permission at all (a plain viewer, an unbound user): no list either
    for user in ("vic", "zed"):
        assert s4.c.get(f"{API}/tickets/locations", headers=s4.h(user)).status_code == 403
    assert one(s4, lid)["name"] == HQ["name"], "nothing changed"
    # whoever may see / create requests reads the ACTIVE ones - names and address, never the coordinates
    patch(s4, lid, lat=32.0853, lng=34.7818)
    for user in ("tom", "alda", "mona"):
        r = s4.c.get(f"{API}/tickets/locations", headers=s4.h(user))
        assert r.status_code == 200, r.text
        item = r.json()["locations"][0]
        assert item["name"] == HQ["name"] and item["street"] == HQ["street"] and "lat" not in item and "lng" not in item
        assert "references" not in item and "nav_url" not in item
        assert item["map_url"] == "https://maps.google.com/?q=32.08530,34.78180" and item["has_coordinates"] is True


def test_the_list_route_is_gated_by_the_module_switch(s4):
    assert s4.c.patch(f"{API}/settings", json={"tickets.enabled": "false"}).status_code == 200
    for path in ("/tickets/locations", "/tickets/admin/locations"):
        r = s4.c.get(API + path)
        assert r.status_code == 404 and r.json()["code"] == "feature_disabled"


# ---------------------------------------------------------------- validation

def test_names_are_unique_case_insensitively_including_inactive_ones(s4):
    a = loc_id(s4, name="Main Office")
    assert patch(s4, a, active=False).status_code == 200
    r = add_loc(s4, name="main office")
    assert r.status_code == 409 and r.json()["code"] == "location_name_taken"
    b = loc_id(s4, name="מחסן")
    r = patch(s4, b, name="MAIN OFFICE")
    assert r.status_code == 409 and r.json()["code"] == "location_name_taken"
    assert patch(s4, b, name="מחסן").status_code == 200, "its own name is not a duplicate"


@pytest.mark.parametrize(("body", "field", "code"), [
    ({"name": ""}, "name", "required"),
    ({"name": "   "}, "name", "required"),
    ({"name": "א" * 41}, "name", "too_long"),
    ({"street": "ר" * 61}, "street", "too_long"),
    ({"city": "ע" * 31}, "city", "too_long"),
    ({"details": "פ" * 201}, "details", "too_long"),
    ({"street": "", "city": ""}, "street", "required"),
    ({"lat": 91, "lng": 34}, "lat", "range"),
    ({"lat": 32, "lng": -181}, "lng", "range"),
    ({"lat": 32}, "lng", "pair"),
    ({"details": "פרטים ב-https://evil.example.test/x"}, "details", "url_not_allowed"),
    ({"details": "evil.example/x"}, "details", "url_not_allowed"),
    ({"name": "www.example.test"}, "name", "url_not_allowed"),
    ({"sort_order": 10000}, "sort_order", "range"),
])
def test_bad_fields_are_refused_by_name(s4, body, field, code):
    r = add_loc(s4, **body)
    assert r.status_code == 422, r.text
    assert r.json()["details"]["fields"] == [{"field": field, "code": code}]
    assert admin(s4)["locations"] == []


def test_sql_and_html_in_the_text_are_kept_literal_and_controls_are_stripped(s4):
    sql = "x'); DROP TABLE tickets;--"
    html = '<img src=x onerror="alert(1)">'
    lid = loc_id(s4, name=sql, details=html, city="חיפה‮​")
    got = one(s4, lid)
    assert got["name"] == sql and got["details"] == html and got["city"] == "חיפה"
    t = s4.ticket(location_id=lid)  # the tickets table is still there and takes the reference
    assert t["location"]["name"] == sql and html in t["location"]["text"]


def test_the_api_body_limit_refuses_huge_text_before_the_service(s4):
    r = add_loc(s4, name="א" * 401)
    assert r.status_code == 422


# ---------------------------------------------------------------- defaults

def test_one_organisation_default_an_inactive_one_cannot_be_default_and_department_defaults_are_optional(s4):
    a = loc_id(s4, name="א", is_default=True)
    b = loc_id(s4, name="ב", is_default=True)
    data = admin(s4)
    assert data["default_id"] == b and [x["is_default"] for x in data["locations"] if x["id"] == a] == [False]
    r = patch(s4, a, active=False, is_default=True)
    assert r.status_code == 422 and r.json()["details"]["fields"] == [{"field": "is_default", "code": "inactive"}]
    assert patch(s4, b, is_default=False).status_code == 200
    assert admin(s4)["default_id"] is None, "the organisation default is optional"
    # the department default: an active location, or none; an inactive / unknown one is refused
    url = f"{API}/tickets/admin/departments/dept-maintenance/location"
    assert patch(s4, a, active=False).status_code == 200
    r = s4.c.put(url, json={"location_id": a})
    assert r.status_code == 422 and r.json()["details"]["fields"] == [{"field": "location_id", "code": "unknown"}]
    assert s4.c.put(url, json={"location_id": "nope00000000"}).status_code == 422
    assert s4.c.put(url, json={"location_id": b}).status_code == 200
    reader = s4.c.get(f"{API}/tickets/locations", headers=s4.h("tom")).json()
    assert reader["department_defaults"] == {"dept-maintenance": b} and reader["default_id"] is None
    assert [x["id"] for x in reader["locations"]] == [b], "inactive locations are not offered"
    # deactivating a location clears the department defaults that pointed at it
    assert patch(s4, b, active=False).status_code == 200
    assert admin(s4)["department_defaults"] == {}
    assert s4.c.put(url, json={"location_id": None}).status_code == 200


# ---------------------------------------------------------------- requests: reference + snapshot

def test_a_ticket_keeps_its_snapshot_when_the_location_is_edited_or_deactivated(s4):
    lid = loc_id(s4)
    t = s4.ticket(location_id=lid)
    assert t["location"]["id"] == lid and t["location"]["address"] == "הרצל 5, תל אביב"
    assert patch(s4, lid, name="מטה חדש", street="ויצמן 1", city="רחובות", details="").status_code == 200
    assert patch(s4, lid, active=False).status_code == 200
    again = s4.w.detail(t["id"])
    assert again["location"] == t["location"], "a later edit never rewrites a request"
    assert again["location"]["text"] == "מטה ראשי · הרצל 5, תל אביב · בניין B, קומה 3, כניסה מהחניון"


def test_an_inactive_or_unknown_location_is_refused_at_creation_and_free_text_still_works(s4):
    lid = loc_id(s4)
    assert patch(s4, lid, active=False).status_code == 200
    for bad in (lid, "unknown00000"):
        r = s4.c.post(f"{API}/tickets", json={"department_id": "dept-maintenance", "title": "נזילה", "client_request_id": crid(), "location_id": bad})
        assert r.status_code == 422 and {"field": "location_id", "code": "unknown"} in r.json()["details"]["fields"], r.text
    t = s4.ticket(place_text="  חדר ישיבות קטן ")  # "other (free text)" - nothing regresses
    assert t["place_text"] == "חדר ישיבות קטן" and t["location"] is None
    r = s4.c.post(f"{API}/tickets", json={"department_id": "dept-maintenance", "title": "נזילה", "client_request_id": crid(), "place_text": "ח" * 201})
    assert r.status_code == 422


def test_a_referenced_location_is_never_hard_deleted(s4):
    used, free = loc_id(s4), loc_id(s4, name="מחסן")
    s4.ticket(location_id=used)
    r = s4.c.delete(f"{API}/tickets/admin/locations/{used}")
    assert r.status_code == 409 and r.json()["code"] == "location_in_use" and r.json()["details"]["tickets"] == 1
    assert one(s4, used)["references"] == 1
    url = f"{API}/tickets/admin/departments/dept-maintenance/location"
    assert s4.c.put(url, json={"location_id": free}).status_code == 200
    r = s4.c.delete(f"{API}/tickets/admin/locations/{free}")
    assert r.status_code == 200 and [x["id"] for x in r.json()["locations"]] == [used]
    assert r.json()["department_defaults"] == {}, "the department default pointing at it was cleared"
    with s4.db.connection(mode="read") as conn:
        audit = [dict(x) for x in conn.execute("SELECT decision, reason FROM audit_log WHERE action = 'ticket.location.delete' ORDER BY rowid")]
    assert [a["decision"] for a in audit] == ["denied", "allowed"] and audit[0]["reason"] == "location_in_use"


def test_the_rfq_snapshot_is_frozen_after_the_draft_and_its_location_is_locked_once_sent(s4):
    lid = loc_id(s4)
    d = rfq(s4, location_id=lid)
    assert d["location"]["name"] == HQ["name"] and d["location_nav"] is False
    sent = send(s4, d)
    assert patch(s4, lid, street="ויצמן 1").status_code == 200
    assert s4.c.get(f"{API}/tickets/rfqs/{d['id']}").json()["location"]["address"] == "הרצל 5, תל אביב"
    r = s4.c.patch(f"{API}/tickets/rfqs/{d['id']}", json={"revision": sent["revision"], "location_id": None}, headers=s4.h("mona"))
    assert r.status_code == 409 and r.json()["code"] == "rfq_field_locked"


def test_a_draft_editor_can_switch_between_a_location_free_text_and_none(s4):
    """TICKETS-POLISH-282: the RFQ board's draft editor sends exactly these bodies (null clears the reference, '' clears the free text)."""
    lid = loc_id(s4)
    d = rfq(s4, place_text="חדר שרתים")
    url = f"{API}/tickets/rfqs/{d['id']}"
    r = s4.c.patch(url, json={"revision": d["revision"], "location_id": lid, "place_text": "", "location_nav": False}, headers=s4.h("mona"))
    assert r.status_code == 200, r.text
    got = r.json()
    assert got["location"]["name"] == HQ["name"] and not got["place"]["text"]
    r = s4.c.patch(url, json={"revision": got["revision"], "location_id": None, "place_text": "מחסן", "location_nav": False}, headers=s4.h("mona"))
    assert r.status_code == 200, r.text
    got = r.json()
    assert got["location"] is None and got["place"]["text"] == "מחסן"
    r = s4.c.patch(url, json={"revision": got["revision"], "location_id": None, "place_text": ""}, headers=s4.h("mona"))
    assert r.status_code == 200 and r.json()["location"] is None and not r.json()["place"]["text"]


# ---------------------------------------------------------------- vendors

def test_the_invitation_names_the_location_and_the_map_link_only_when_switched_on(s4):
    lid = loc_id(s4, lat=32.0853, lng=34.7818)
    d = send(s4, rfq(s4, location_id=lid))
    [params] = invite_params(s4, d["id"])
    assert params["place"] == params["location"] == "מטה ראשי · הרצל 5, תל אביב"
    assert "maps" not in json.dumps(params) and "32.08" not in json.dumps(params), "coordinates are off by default"
    assert "details" not in params and "קומה 3" not in params["location"], "the access details stay on the request's page"
    d2 = send(s4, rfq(s4, location_id=lid), location_nav=True)
    [p2] = invite_params(s4, d2["id"])
    assert p2["location"] == "מטה ראשי · הרצל 5, תל אביב · https://maps.google.com/?q=32.08530,34.78180"
    assert len(p2["location"]) <= 200


def test_a_vendor_page_shows_only_its_own_requests_location(s4):
    lid = loc_id(s4, lat=32.0853, lng=34.7818)
    with_loc = send(s4, rfq(s4, location_id=lid))
    without = send(s4, rfq(s4, place_text="חדר שרתים"))
    v1 = vendor_view(s4, vendor_token(s4, with_loc))
    assert v1["rfq"]["location"] == {"text": "מטה ראשי · הרצל 5, תל אביב · בניין B, קומה 3, כניסה מהחניון", "map_url": ""}
    v2 = vendor_view(s4, vendor_token(s4, without))
    assert v2["rfq"]["location"] is None and "הרצל" not in json.dumps(v2, ensure_ascii=False), "nothing of another request's address"
    on = send(s4, rfq(s4, location_id=lid), location_nav=True)
    assert vendor_view(s4, vendor_token(s4, on))["rfq"]["location"]["map_url"] == "https://maps.google.com/?q=32.08530,34.78180"


def test_a_code_protected_link_shows_no_location_before_the_code(s4):
    lid = loc_id(s4)
    d = send(s4, rfq(s4, location_id=lid))
    tok = vendor_token(s4, d)
    assert vendor_view(s4, tok)["rfq"]["location"]["text"].startswith(HQ["name"])
    a = next(v["id"] for v in d["vendors"] if v["contact"]["id"] == s4.vendor["id"])
    r = s4.c.post(f"{API}/tickets/rfqs/{d['id']}/vendors/{a}/options", json={"revision": d["revision"], "require_code": True}, headers=s4.h("mona"))
    assert r.status_code == 200, r.text
    v = vendor_view(s4, tok)
    assert v["code_required"] is True and "rfq" not in v
    assert "הרצל" not in json.dumps(v, ensure_ascii=False) and HQ["name"] not in json.dumps(v, ensure_ascii=False)


def test_no_public_route_lists_locations(s4):
    loc_id(s4)
    c, _app = s4.public(Clock(time.time()))
    for path in ("/t/api/locations", "/t/api/rfq/locations", "/t/locations", "/t/api/ticket/locations"):
        r = c.get(path)
        assert r.status_code == 404 and r.content == UNIFORM_404, path


def test_the_handler_page_of_an_assigned_request_carries_its_location_text(s4):
    lid = loc_id(s4)
    t = s4.ticket(location_id=lid)
    assert s4.assign_contact(t["id"]).status_code == 200
    c, _app = s4.public(Clock(time.time()))
    r = c.get("/t/api/ticket", headers={"x-ticket-token": s4.token_of(t["id"])})
    assert r.status_code == 200, r.text
    assert r.json()["location_text"].startswith("מטה ראשי · הרצל 5")
    other, _tok = s4.sent(title="אחר")
    r2 = c.get("/t/api/ticket", headers={"x-ticket-token": s4.token_of(other["id"])})
    assert r2.json()["location_text"] == "", "a request without a location shows none"


def test_the_assign_message_carries_the_location_as_the_place(s4):
    lid = loc_id(s4)
    t = s4.ticket(location_id=lid)
    assert s4.assign_contact(t["id"]).status_code == 200
    with s4.db.connection(mode="read") as conn:
        rows = conn.execute("SELECT params_json FROM ticket_outbox WHERE ticket_id = ? AND purpose = 'assign'", (t["id"],)).fetchall()
    assert rows, "the assignment queued its message"
    params = json.loads(rows[0]["params_json"])
    assert params["place"] == params["location"] == "מטה ראשי · הרצל 5, תל אביב"


# ---------------------------------------------------------------- the ticket assign dialog's navigation-link switch (owner 2026-10-17)

MAP = "https://maps.google.com/?q=32.08530,34.78180"


def preview(s4, tid: str, user: str = "joni", **extra):
    return s4.c.post(f"{API}/tickets/{tid}/assign/preview", json={"contact_id": s4.contact["id"], **extra}, headers=s4.h(user))


def assign_params(s4, tid: str) -> list[dict]:
    with s4.db.connection(mode="read") as conn:
        rows = conn.execute("SELECT params_json FROM ticket_outbox WHERE ticket_id = ? AND purpose = 'assign' ORDER BY rowid", (tid,)).fetchall()
    return [json.loads(r["params_json"]) for r in rows]


def test_nav_flag_on_a_request_without_coordinates_is_refused_with_422_and_nothing_is_written(s4):
    no_loc = s4.ticket()
    no_coords = s4.ticket(location_id=loc_id(s4))
    for t in (no_loc, no_coords):
        r = s4.assign_contact(t["id"], location_nav=True)
        assert r.status_code == 422 and r.json()["details"]["fields"] == [{"field": "location_nav", "code": "no_coordinates"}], r.text
        p = preview(s4, t["id"], location_nav=True)
        assert p.status_code == 422 and p.json()["details"]["fields"] == [{"field": "location_nav", "code": "no_coordinates"}]
        assert s4.w.detail(t["id"])["status"] == "new", "the refused assignment changed nothing"
        assert assign_params(s4, t["id"]) == []
        assert preview(s4, t["id"]).json()["location_nav"] == {"available": False, "on": False}
    # a located request with the flag off keeps working
    assert s4.assign_contact(no_coords["id"]).status_code == 200


def test_nav_flag_for_an_inside_assignee_is_refused_and_a_non_manager_gets_the_permission_refusal(s4):
    t = s4.ticket(location_id=loc_id(s4, lat=32.0853, lng=34.7818))
    rev = s4.w.detail(t["id"])["revision"]
    body = {"assignee": {"kind": "user", "id": "tom"}, "revision": rev, "location_nav": True}
    r = s4.c.post(f"{API}/tickets/{t['id']}/assign", json=body, headers=s4.h("joni"))
    assert r.status_code == 422 and r.json()["details"]["fields"] == [{"field": "location_nav", "code": "not_allowed"}], r.text
    r2 = s4.c.post(f"{API}/tickets/{t['id']}/assign", json=body, headers=s4.h("tom"))
    assert r2.status_code in (403, 404), "an unauthorised caller gets the permission refusal, not a validation hint"


def test_nav_flag_by_a_caller_who_may_not_manage_the_request_is_refused_before_the_flag_is_looked_at(s4):
    t = s4.ticket(location_id=loc_id(s4, lat=32.0853, lng=34.7818))
    for user in ("tom", "vic"):  # a department member without manage; a viewer
        for r in (s4.assign_contact(t["id"], user=user, location_nav=True), preview(s4, t["id"], user, location_nav=True)):
            assert r.status_code in (403, 404), (user, r.status_code, r.text)
    assert assign_params(s4, t["id"]) == [] and s4.w.detail(t["id"])["status"] == "new"


def test_default_off_the_message_has_no_link_and_the_preview_equals_what_is_sent(s4):
    t = s4.ticket(location_id=loc_id(s4, lat=32.0853, lng=34.7818))
    p = preview(s4, t["id"])
    assert p.status_code == 200 and p.json()["location_nav"] == {"available": True, "on": False}
    assert "maps.google" not in p.json()["text"] and "32.08" not in p.json()["text"]
    assert "מטה ראשי · הרצל 5, תל אביב" in p.json()["text"]
    assert s4.assign_contact(t["id"]).status_code == 200
    [params] = assign_params(s4, t["id"])
    assert params["place"] == params["location"] == "מטה ראשי · הרצל 5, תל אביב"
    with s4.db.connection(mode="read") as conn:
        assert conn.execute("SELECT location_nav FROM ticket_assignments WHERE ticket_id = ?", (t["id"],)).fetchone()[0] == 0


def test_switched_on_the_link_is_in_the_preview_the_sent_params_and_stays_for_reminders_and_resend(s4):
    t = s4.ticket(location_id=loc_id(s4, lat=32.0853, lng=34.7818))
    p = preview(s4, t["id"], location_nav=True).json()
    assert p["location_nav"] == {"available": True, "on": True} and MAP in p["text"]
    off = preview(s4, t["id"], location_nav=False).json()["text"]
    assert p["text"].replace(" · " + MAP, "") == off, "the switch changes the location line only"
    assert s4.assign_contact(t["id"], location_nav=True).status_code == 200
    [params] = assign_params(s4, t["id"])
    assert params["place"] == params["location"] == f"מטה ראשי · הרצל 5, תל אביב · {MAP}"
    assert params["location"] in p["text"], "the preview shows exactly the location text that is sent"
    with s4.db.connection(mode="read") as conn:
        row = store.ticket_row_system(conn, t["id"])
        contact = store_links.contact(conn, s4.contact["id"])
        asg = row["current_assignment_id"]
        assert conn.execute("SELECT location_nav FROM ticket_assignments WHERE id = ?", (asg,)).fetchone()[0] == 1
        # a reminder / a notice of THIS assignment render the same text; the access details stay out
        assert messaging.message_params(conn, row, contact)["location"] == params["location"]
        assert messaging.message_params(conn, row, contact, assignment_id=asg)["place"] == params["place"]
        assert "קומה 3" not in messaging.message_params(conn, row, contact)["location"]
    assert MAP in s4.copy(t["id"]).json()["text"], "the manual copy-link text carries the same choice"
    assert s4.c.post(f"{API}/tickets/{t['id']}/link/new", headers=s4.h("joni")).status_code == 200
    assert all(MAP in q["location"] for q in assign_params(s4, t["id"])), "a new link keeps the assignment's choice"


def test_the_choice_belongs_to_one_assignment_and_never_leaks_to_other_requests_or_public_routes(s4):
    lid = loc_id(s4, lat=32.0853, lng=34.7818)
    on = s4.ticket(location_id=lid)
    other = s4.ticket(location_id=lid, title="אחר")
    assert s4.assign_contact(on["id"], location_nav=True).status_code == 200
    assert s4.assign_contact(other["id"]).status_code == 200
    [p_other] = assign_params(s4, other["id"])
    assert MAP not in json.dumps(p_other, ensure_ascii=False), "another request of the same location carries no link"
    with s4.db.connection(mode="read") as conn:
        row = store.ticket_row_system(conn, other["id"])
        assert MAP not in messaging.message_params(conn, row, store_links.contact(conn, s4.contact["id"]))["location"]
    c, _app = s4.public(Clock(time.time()))
    page = c.get("/t/api/ticket", headers={"x-ticket-token": s4.token_of(on["id"])})
    assert page.status_code == 200 and "32.08" not in page.text and "maps.google" not in page.text


def test_a_located_request_manual_copy_text_carries_the_location_and_no_link_by_default(s4):
    t = s4.ticket(location_id=loc_id(s4, lat=32.0853, lng=34.7818))
    assert s4.assign_contact(t["id"]).status_code == 200
    text = s4.copy(t["id"]).json()["text"]
    assert "מטה ראשי · הרצל 5, תל אביב" in text and "maps.google" not in text


# ---------------------------------------------------------------- pure helpers

def test_message_text_fits_the_placeholder_cap_at_the_field_limits():
    snap = {"name": "א" * org_locations.NAME_MAX, "street": "ב" * org_locations.STREET_MAX, "city": "ג" * org_locations.CITY_MAX,
            "details": "ד" * 200, "lat": -89.123456, "lng": -179.123456}
    assert len(org_locations.message_text(snap, nav=True)) <= 200
    assert org_locations.message_text(None) == "" and org_locations.display_text(None) == ""
    assert org_locations.parse_snapshot("not json") is None and org_locations.parse_snapshot('{"name": ""}') is None


# ---------------------------------------------------------------- ORGPLAN-291: the optional link to a plan area (room)
# `plan_zone_id` is the column reserved by migration 0101 (no new migration). Display-only: it never changes who sees a request.

SQUARE = [{"x": 0.1, "y": 0.1}, {"x": 0.4, "y": 0.1}, {"x": 0.4, "y": 0.4}, {"x": 0.1, "y": 0.4}]


def room(s4, floor: str = "floor2", name: str = "חדר שרתים") -> str:
    r = s4.c.post(f"{API}/floors/{s4.w.floors[floor]}/zones", json={"name": name, "polygon": SQUARE}, headers=s4.h("joni"))
    assert r.status_code == 201, r.text
    return r.json()["id"]


def detail_location(s4, tid: str, user: str) -> dict:
    r = s4.w.get(user, tid)
    assert r.status_code == 200, (user, r.text)
    return r.json()["location"]


def test_a_location_may_link_one_live_room_and_the_link_can_be_cleared(s4):
    z = room(s4)
    lid = loc_id(s4, plan_zone_id=z)
    assert one(s4, lid)["plan_zone_id"] == z
    assert patch(s4, lid, plan_zone_id=None).status_code == 200
    assert one(s4, lid)["plan_zone_id"] is None
    assert patch(s4, lid, plan_zone_id=z).status_code == 200 and one(s4, lid)["plan_zone_id"] == z
    assert patch(s4, lid, city="חיפה").status_code == 200 and one(s4, lid)["plan_zone_id"] == z  # an unrelated edit keeps the link
    areas = s4.c.get(f"{API}/tickets/admin/locations/plan-areas").json()["areas"]
    assert {"zone_id": z, "name": "חדר שרתים", "floor_id": s4.w.floors["floor2"], "floor_name": "קומה 2"} in areas


def test_an_unknown_or_deleted_room_is_refused_and_a_location_without_a_link_is_unchanged(s4):
    r = add_loc(s4, plan_zone_id="nope00000000")
    assert r.status_code == 422 and r.json()["details"]["fields"] == [{"field": "plan_zone_id", "code": "unknown"}]
    assert add_loc(s4, plan_zone_id="x" * 80).status_code == 422  # over the id length
    z = room(s4)
    assert s4.c.delete(f"{API}/zones/{z}", headers=s4.h("joni")).status_code == 204
    r = add_loc(s4, plan_zone_id=z)
    assert r.status_code == 422 and r.json()["details"]["fields"] == [{"field": "plan_zone_id", "code": "unknown"}]
    assert one(s4, loc_id(s4, name="ללא קישור"))["plan_zone_id"] is None


def test_the_editor_cannot_link_a_room_of_a_floor_they_may_not_read(s4):
    bind(s4.c, s4.w.settings, "ori", "tickets_configure", "installation", "*")
    bind(s4.c, s4.w.settings, "ori", "operator", "floor", s4.w.floors["floor3"])
    z2 = room(s4, "floor2")
    z3 = room(s4, "floor3", "מחסן")
    r = add_loc(s4, "ori", name="שלישית", plan_zone_id=z3)
    assert r.status_code == 201, r.text
    r = add_loc(s4, "ori", name="שנייה", plan_zone_id=z2)  # same answer as an unknown room: the field cannot probe the plan
    assert r.status_code == 422 and r.json()["details"]["fields"] == [{"field": "plan_zone_id", "code": "unknown"}]
    areas = s4.c.get(f"{API}/tickets/admin/locations/plan-areas", headers=s4.h("ori")).json()["areas"]
    assert [a["zone_id"] for a in areas] == [z3]


def test_deleting_the_room_clears_the_link_and_the_ticket_shows_no_map_link(s4):
    z = room(s4)
    lid = loc_id(s4, plan_zone_id=z)
    t = s4.ticket(user="mona", location_id=lid)
    assert detail_location(s4, t["id"], "mona")["plan_area"]["zone_id"] == z
    assert s4.c.delete(f"{API}/zones/{z}", headers=s4.h("joni")).status_code == 204
    assert one(s4, lid)["plan_zone_id"] is None
    assert detail_location(s4, t["id"], "mona")["plan_area"] is None
    assert detail_location(s4, t["id"], "mona")["name"] == HQ["name"]  # the snapshot is untouched


def test_a_dangling_link_reads_as_no_link(s4):
    z = room(s4)
    lid = loc_id(s4, plan_zone_id=z)
    t = s4.ticket(user="mona", location_id=lid)
    with s4.db.connection() as conn:  # a room removed behind the route's back (restore, hand edit)
        conn.execute("UPDATE spatial_zones SET deleted_at = '2026-01-01T00:00:00Z' WHERE id = ?", (z,))
    assert detail_location(s4, t["id"], "mona")["plan_area"] is None


def test_the_map_link_is_shown_only_to_a_viewer_who_may_read_that_floor_and_never_changes_who_sees_the_request(s4):
    z = room(s4, "floor2")
    lid = loc_id(s4, plan_zone_id=z)
    t = s4.ticket(user="mona", location_id=lid)
    area = detail_location(s4, t["id"], "mona")["plan_area"]
    assert area == {"zone_id": z, "floor_id": s4.w.floors["floor2"], "name": "חדר שרתים", "floor_name": "קומה 2"}
    assert detail_location(s4, t["id"], "joni")["plan_area"]["zone_id"] == z
    # gil is on the maintenance team but reads only floor 3 on the map: the request is the same, the link is gone, no hint of it
    gil = detail_location(s4, t["id"], "gil")
    assert gil["name"] == HQ["name"] and gil["plan_area"] is None
    assert "plan_zone_id" not in gil and z not in json.dumps(gil)
    # a viewer who may not see the request still may not, whatever the link says
    assert s4.w.get("dina", t["id"]).status_code in (403, 404)
    # the list the creation forms read never carries the link
    assert "plan_zone_id" not in json.dumps(s4.c.get(f"{API}/tickets/locations", headers=s4.h("mona")).json())
    # a ticket whose location has no link: plan_area is null
    t2 = s4.ticket(user="mona", location_id=loc_id(s4, name="אחר"))
    assert detail_location(s4, t2["id"], "mona")["plan_area"] is None


def rfq_detail(s4, rid: str, user: str) -> dict:
    r = s4.c.get(f"{API}/tickets/rfqs/{rid}", headers=s4.h(user))
    assert r.status_code == 200, (user, r.text)
    return r.json()


def rfq_row(s4, rid: str, user: str) -> dict:
    r = s4.c.get(f"{API}/tickets/rfqs", headers=s4.h(user))
    assert r.status_code == 200, (user, r.text)
    return next(x for x in r.json()["items"] if x["id"] == rid)


def both(s4, rid: str, user: str) -> list:
    return [rfq_detail(s4, rid, user)["plan_area"], rfq_row(s4, rid, user)["plan_area"]]


def test_the_rfq_detail_and_board_card_show_the_map_link_by_the_same_rule_as_a_ticket(s4):
    """ORGPLAN2-291: an RFQ naming a location with a linked room carries `plan_area` for a viewer who may read that floor on the map,
    on the detail and on the board row; a viewer without map.read on that floor gets the same request with no hint of the link."""
    bind(s4.c, s4.w.settings, "gil", "tickets_external", "installation", "*")  # may see RFQs; his map access is floor 3 only
    z = room(s4, "floor2")
    d = rfq(s4, location_id=loc_id(s4, plan_zone_id=z))
    want = {"zone_id": z, "floor_id": s4.w.floors["floor2"], "name": "חדר שרתים", "floor_name": "קומה 2", "source": "location"}
    assert both(s4, d["id"], "mona") == [want, want]
    for got in (rfq_detail(s4, d["id"], "gil"), rfq_row(s4, d["id"], "gil")):
        assert got["plan_area"] is None and got["location"]["name"] == HQ["name"]
        assert z not in json.dumps(got) and "plan_zone_id" not in json.dumps(got)
    d2 = rfq(s4, location_id=loc_id(s4, name="אחר"))  # no link on the location
    assert both(s4, d2["id"], "mona") == [None, None]
    assert s4.c.delete(f"{API}/zones/{z}", headers=s4.h("joni")).status_code == 204  # room deleted: gone on both
    assert both(s4, d["id"], "mona") == [None, None]


def test_the_rfq_map_link_falls_back_to_the_source_ticket_location_and_stops_there(s4):
    z_own, z_tk = room(s4, "floor2", "חדר א"), room(s4, "floor2", "חדר ב")
    own = loc_id(s4, name="של הבקשה", plan_zone_id=z_own)
    linked = loc_id(s4, name="של הקריאה", plan_zone_id=z_tk)
    bare = loc_id(s4, name="בלי קישור")
    t_linked = s4.ticket(user="mona", location_id=linked)
    # 1) the RFQ's own linked room wins over the ticket's
    d = rfq(s4, location_id=own, source_ticket_id=t_linked["id"])
    assert [a["zone_id"] for a in both(s4, d["id"], "mona")] == [z_own, z_own]
    # 2) the RFQ's location has no link -> the source ticket's location's room, marked as coming from the ticket
    d = rfq(s4, location_id=bare, source_ticket_id=t_linked["id"])
    got = both(s4, d["id"], "mona")
    assert got[0] == got[1] and got[0]["zone_id"] == z_tk and got[0]["source"] == "ticket"
    # 3) no location on the RFQ at all -> still the ticket's
    d = rfq(s4, source_ticket_id=t_linked["id"])
    assert [a["zone_id"] for a in both(s4, d["id"], "mona")] == [z_tk, z_tk]
    # 4) the ticket's location is not linked either -> nothing (no site / building level exists to fall back to)
    d = rfq(s4, source_ticket_id=s4.ticket(user="mona", location_id=bare)["id"])
    assert both(s4, d["id"], "mona") == [None, None]
    assert both(s4, rfq(s4)["id"], "mona") == [None, None]


def test_the_rfq_map_link_fallback_obeys_the_floor_rule(s4):
    bind(s4.c, s4.w.settings, "gil", "tickets_external", "installation", "*")  # RFQ viewer with map access to floor 3 only
    z2, z3 = room(s4, "floor2"), room(s4, "floor3", "מחסן")
    t2 = s4.ticket(user="mona", location_id=loc_id(s4, name="קומה 2", plan_zone_id=z2))
    t3 = s4.ticket(user="mona", location_id=loc_id(s4, name="קומה 3", plan_zone_id=z3))
    d2 = rfq(s4, source_ticket_id=t2["id"])
    d3 = rfq(s4, source_ticket_id=t3["id"])
    assert both(s4, d2["id"], "gil") == [None, None]  # floor 2 via the ticket: no map.read, no hint
    assert [a["zone_id"] for a in both(s4, d3["id"], "gil")] == [z3, z3]
    assert z2 not in json.dumps([rfq_detail(s4, d2["id"], "gil"), rfq_row(s4, d2["id"], "gil")])


def test_the_page_of_rfqs_resolves_its_map_links_in_a_fixed_number_of_queries(s4):
    from smplwise.db import Database
    from smplwise.services.notify_visibility import principal_of
    from smplwise.services.tickets.access import Viewer

    z = room(s4, "floor2")

    def statements(n: int) -> int:
        ids = [rfq(s4, location_id=loc_id(s4, name=f"מיקום {n}-{k}", plan_zone_id=z), source_ticket_id=s4.ticket(user="mona")["id"])["id"] for k in range(n)]
        db = Database(s4.w.settings.db_path)
        with db.connection(mode="read") as conn:
            viewer = Viewer(conn, principal_of(conn, "dev-mona"))
            page = [x for x in rfq_mod.visible_page(viewer, state="all", limit=200)[0] if x.row["id"] in ids]
            assert len(page) == n
            seen: list[str] = []
            conn.set_trace_callback(seen.append)
            areas = rfq_mod.plan_areas(conn, viewer, page)
            conn.set_trace_callback(None)
        assert all(areas[i]["zone_id"] == z for i in ids)
        return len(seen)

    few = statements(2)
    assert statements(12) == few  # twelve more rows, the same number of reads
