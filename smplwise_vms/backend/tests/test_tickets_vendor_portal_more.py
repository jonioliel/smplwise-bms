"""VPORTALRFQ (owner 2026-10-17: "possible in future", approved to build, OFF by default): two sections INSIDE the signed-in vendor
portal (services/tickets/portal_more.py, the routes in public_portal.py, the edge rules in public_http.py; docs/changes/CR-VENDOR-PORTAL.md
section 12) - the vendor's OPEN requests for quotation (each opening his existing RFQ page) and "company technician requests" (add /
replace a technician, approved by a directory editor). A PUBLIC SURFACE.

NEGATIVE CASES FIRST: both sections OFF by default (the uniform 404, nothing written); unauthenticated / tampered / expired sessions are
the uniform 404 BEFORE the body is read; the switch off ends them; another vendor's invitation is never listed and its id never opens;
ids are per session; a code-protected RFQ link discloses nothing more in the list than the link does before its code; a closed /
past-deadline / removed invitation is not listed; a person (not a company) cannot send technician requests; a foreign company /
technician id; text hygiene of the name; the number is never echoed in full and never says whether it is known; per-company caps; the
edge's rate kind; no number or name in logs / audit rows. Then the happy paths and the editor's approve / reject. Fake ha-whatsapp only;
every name and number is invented (the 050-000-xxxx block)."""
from __future__ import annotations

import itertools
import logging
import time

import pytest

from smplwise.services.tickets import portal_more, ratelimit
from smplwise.services.tickets.public_http import PORTAL_COOKIE, PORTAL_COOKIE_SETTERS, PORTAL_SESSION_ROUTES
from test_tickets_s5b_channel import env  # noqa: F401 - the slice 5b environment (fake ha-whatsapp, mapped account, WhatsApp on)
from test_tickets_vendor_portal import (API, assigned, back, confirm, jar, portal_on, public, settings_put, signed_in, start,
                                        uniform_404, verify, code_of)
from tickets_s4_world import PHONE_A, PHONE_B, Clock, crid

PHONE_B_E164 = "972500000032"
NEW_TECH = "050-000-0077"
NEW_TECH_E164 = "972500000077"
TECH_PHONE = "050-000-0055"
QUOTE = [{"kind": "labor", "hours": "2", "rate": "150"}]
NEW_ROUTES_GET = ("/t/api/portal/rfqs", "/t/api/portal/techs")
NEW_ROUTES_POST = {"/t/api/portal/rfqs/open": {"item": "a" * 24},
                   "/t/api/portal/techs": {"company": "a" * 24, "action": "add", "name": "יוסי כהן", "phone": NEW_TECH},
                   "/t/api/portal/techs/cancel": {"item": "a" * 24}}


# ---------------------------------------------------------------- helpers


def on(env, *, rfqs: bool = False, techs: bool = False, **extra) -> None:
    portal_on(env, True, rfqs=rfqs, technician_requests=techs, **extra)


def _at(days: float) -> str:
    import datetime as dt

    return (dt.datetime.now(dt.timezone.utc) + dt.timedelta(days=days)).replace(microsecond=0).strftime("%Y-%m-%dT%H:%M:%SZ")


def rfq_detail(env, rid: str) -> dict:
    r = env.c.get(f"{API}/tickets/rfqs/{rid}")
    assert r.status_code == 200, r.text
    return r.json()


def sent_rfq(env, contact_ids: list[str], title: str = "החלפת מזגן בחדר הישיבות", due_days: float = 3) -> dict:
    payload = {"department_id": "dept-maintenance", "title": title, "description": "היחידה דולפת", "place_text": "קומה 3",
               "due_at": _at(due_days), "vendors": [{"contact_id": c} for c in contact_ids], "client_request_id": crid()}
    r = env.c.post(f"{API}/tickets/rfqs", json=payload)
    assert r.status_code == 201, r.text
    d = r.json()
    r = env.c.post(f"{API}/tickets/rfqs/{d['id']}/send", json={"revision": d["revision"], "channel": "auto", "client_request_id": crid()})
    assert r.status_code == 200, r.text
    return rfq_detail(env, d["id"])


def rv(d: dict, contact_id: str) -> str:
    return next(v["id"] for v in d["vendors"] if v["contact"]["id"] == contact_id)


def vendor_signed_in(env, c) -> str:
    """The vendor company B (s4.vendor) - its number proved by code - signed in."""
    confirm(env, env.s4.vendor["id"])
    return signed_in(env, c, PHONE_B, PHONE_B_E164)


def tech(env, name: str = "דני לוי", phone: str = TECH_PHONE) -> dict:
    r = env.s4.add_contact(kind="person", display_name=name, phone=phone, vendor_id=env.s4.vendor["id"])
    assert r.status_code == 201, r.text
    return r.json()


def techs(c, cookie: str) -> dict:
    r = c.get("/t/api/portal/techs", headers=jar(cookie))
    assert r.status_code == 200, r.text
    return r.json()


_NETS = itertools.count(1)


def fresh(env, clock: Clock | None = None):
    """A client on a network of its own (the portal's per-network windows are per /24): the session is not bound to a network."""
    c, _ = public(env, clock, peer=f"198.18.{next(_NETS)}.1")
    return c


def ask(env, cookie: str, **body):
    return fresh(env).post("/t/api/portal/techs", json=body, headers=jar(cookie))


def requests_of(env, state: str = "all", user: str = "joni"):
    return env.c.get(f"{API}/tickets/portal-requests", params={"state": state}, headers=env.h(user))


# ---------------------------------------------------------------- 1. OFF by default


def test_both_sections_are_off_by_default_every_new_route_is_the_uniform_404_and_nothing_is_written(env):
    doc = env.c.get(f"{API}/tickets/settings").json()["vendor_portal"]
    assert doc["rfqs"] is False and doc["technician_requests"] is False
    portal_on(env)
    assigned(env)
    c, _ = public(env)
    cookie = signed_in(env, c)
    assert c.get("/t/api/portal/items", headers=jar(cookie)).json()["features"] == {"rfqs": False, "techs": False}
    for path in NEW_ROUTES_GET:
        uniform_404(c.get(path, headers=jar(cookie)))
    for path, body in NEW_ROUTES_POST.items():
        uniform_404(c.post(path, json=body, headers=jar(cookie)))
    with env.s4.db.connection(mode="read") as conn:
        assert conn.execute("SELECT COUNT(*) FROM ticket_portal_tech_requests").fetchone()[0] == 0


def test_with_the_portal_itself_off_the_section_switches_open_nothing(env):
    settings_put(env, vendor_portal={"rfqs": True, "technician_requests": True})
    c, _ = public(env)
    for path in NEW_ROUTES_GET:
        uniform_404(c.get(path))
    for path, body in NEW_ROUTES_POST.items():
        uniform_404(c.post(path, json=body))


def test_the_switches_are_validated_and_need_system_configure(env):
    for bad in ({"rfqs": "yes"}, {"technician_requests": 1}):
        assert settings_put(env, vendor_portal=bad).status_code == 422, bad
    rev = env.c.get(f"{API}/tickets/settings").json()["revision"]
    r = env.c.put(f"{API}/tickets/settings", json={"revision": rev, "vendor_portal": {"rfqs": True}}, headers=env.h("tom"))
    assert r.status_code == 403


# ---------------------------------------------------------------- 2. no session, a dead session, the switch off


def test_without_a_live_session_every_new_route_is_the_uniform_404_before_the_body_is_read(env):
    on(env, rfqs=True, techs=True)
    assigned(env)
    clock = Clock(time.time())
    c, _ = public(env, clock)
    cookie = signed_in(env, c)
    bad = {"cookie": f"{PORTAL_COOKIE}={'A' * 43}"}
    doubled = {"cookie": f"{PORTAL_COOKIE}={cookie}; {PORTAL_COOKIE}={cookie}"}
    for headers in ({}, bad, doubled, {"cookie": f"other={cookie}"}):
        c = fresh(env, clock)
        for path in NEW_ROUTES_GET:
            uniform_404(c.get(path, headers=headers))
        for path, body in NEW_ROUTES_POST.items():
            uniform_404(c.post(path, json=body, headers=headers))
            uniform_404(c.post(path, json={"junk": 1}, headers=headers))  # a malformed body without a session: the same 404, never a 422
    clock.advance(31 * 60)  # 30 minutes, absolute, never extended
    for path in NEW_ROUTES_GET:
        uniform_404(c.get(path, headers=jar(cookie)))


def test_switching_a_section_off_ends_it_for_a_live_session(env):
    on(env, rfqs=True, techs=True)
    assigned(env)
    c, _ = public(env)
    cookie = signed_in(env, c)
    assert c.get("/t/api/portal/rfqs", headers=jar(cookie)).status_code == 200
    settings_put(env, vendor_portal={"rfqs": False, "technician_requests": False})
    for path in NEW_ROUTES_GET:
        uniform_404(c.get(path, headers=jar(cookie)))
    settings_put(env, vendor_portal={"rfqs": True, "enabled": False})
    uniform_404(c.get("/t/api/portal/rfqs", headers=jar(cookie)))


def test_the_edge_passes_the_session_cookie_to_the_new_routes_and_never_lets_them_set_it():
    assert {"/t/api/portal/rfqs", "/t/api/portal/rfqs/open", "/t/api/portal/techs", "/t/api/portal/techs/cancel"} <= PORTAL_SESSION_ROUTES
    assert PORTAL_COOKIE_SETTERS == {"/t/api/portal/verify", "/t/api/portal/logout"}


def test_the_write_kind_is_limited_per_network_even_without_a_session(env):
    on(env, techs=True)
    c, _ = public(env, peer="203.0.113.21")
    answers = [c.post("/t/api/portal/techs", json=NEW_ROUTES_POST["/t/api/portal/techs"]).status_code for _ in range(12)]
    assert answers[:10] == [404] * 10 and answers[10:] == [429, 429]
    gate = ratelimit.PublicLimits()
    assert gate.portal_write_per_network == ((600.0, 10), (3600.0, 20)) and gate.portal_write_global == ((3600.0, 200),)


# ---------------------------------------------------------------- 3. requests for quotation: scope first


def test_another_vendors_invitation_is_never_listed_and_its_id_never_opens(env):
    on(env, rfqs=True)
    assigned(env)  # contact A has a service request (something to show)
    d = sent_rfq(env, [env.s4.vendor["id"]])  # addressed to vendor B only
    c, _ = public(env)
    a_cookie = signed_in(env, c)
    assert c.get("/t/api/portal/rfqs", headers=jar(a_cookie)).json() == {"items": []}
    b_cookie = vendor_signed_in(env, c)
    items = c.get("/t/api/portal/rfqs", headers=jar(b_cookie)).json()["items"]
    assert [i["ref"] for i in items] == [f"RFQ-{d['number']:02d}"]
    # B's item id means nothing in A's session (per-session ids), and a guessed id nothing anywhere
    for cookie, item in ((a_cookie, items[0]["id"]), (b_cookie, "b" * 24), (b_cookie, items[0]["id"][:-1] + "x"), (b_cookie, 7)):
        r = c.post("/t/api/portal/rfqs/open", json={"item": item}, headers=jar(cookie))
        assert r.status_code in (404, 422)
        if r.status_code == 404:
            uniform_404(r)


def test_an_open_invitation_alone_lets_the_vendor_sign_in_only_while_the_rfq_section_is_on(env):
    portal_on(env)
    sent_rfq(env, [env.s4.vendor["id"]])
    confirm(env, env.s4.vendor["id"])
    c, _ = public(env)
    assert start(c, PHONE_B).status_code == 202
    with env.s4.db.connection(mode="read") as conn:
        assert conn.execute("SELECT contact_id FROM ticket_portal_codes ORDER BY created_at DESC LIMIT 1").fetchone()[0] is None, \
            "with the section off an invitation is not something to show: no code was sent"
    back(env)
    settings_put(env, vendor_portal={"rfqs": True})
    c2, _ = public(env, peer="198.51.100.80")
    assert start(c2, PHONE_B).status_code == 202
    assert verify(c2, code_of(env, PHONE_B_E164), PHONE_B).status_code == 200


def test_a_code_protected_link_shows_no_more_in_the_list_than_before_its_code(env):
    on(env, rfqs=True)
    d = sent_rfq(env, [env.s4.vendor["id"]], title="כותרת מוגנת")
    v = rv(d, env.s4.vendor["id"])
    r = env.c.post(f"{API}/tickets/rfqs/{d['id']}/vendors/{v}/options", json={"revision": rfq_detail(env, d["id"])["revision"], "require_code": True})
    assert r.status_code == 200, r.text
    c, _ = public(env)
    cookie = vendor_signed_in(env, c)
    res = c.get("/t/api/portal/rfqs", headers=jar(cookie))
    item = res.json()["items"][0]
    assert item["code_first"] is True and item["title"] is None and item["quote"] is None
    assert "כותרת מוגנת" not in res.text
    tok = c.post("/t/api/portal/rfqs/open", json={"item": item["id"]}, headers=jar(cookie)).json()["token"]
    page = c.get("/t/api/rfq", headers={"x-ticket-token": tok}).json()
    assert page["code_required"] is True and "rfq" not in page, "the RFQ page keeps its own code gate (nothing widened)"


def test_closed_past_deadline_and_removed_invitations_are_not_listed(env):
    on(env, rfqs=True)
    assigned(env, env.s4.vendor["id"])  # B also has a service request, so it can sign in whatever happens to the invitations
    cancelled = sent_rfq(env, [env.s4.vendor["id"]], title="בוטלה")
    removed = sent_rfq(env, [env.s4.vendor["id"], env.s4.contact["id"]], title="הוסר")
    late = sent_rfq(env, [env.s4.vendor["id"]], title="מאוחרת", due_days=0.01)
    live = sent_rfq(env, [env.s4.vendor["id"]], title="פתוחה")
    assert env.c.post(f"{API}/tickets/rfqs/{cancelled['id']}/cancel",
                      json={"revision": rfq_detail(env, cancelled["id"])["revision"], "reason": "x", "notify": False}).status_code == 200
    assert env.c.post(f"{API}/tickets/rfqs/{removed['id']}/vendors/{rv(removed, env.s4.vendor['id'])}/remove",
                      json={"revision": rfq_detail(env, removed["id"])["revision"]}).status_code == 200
    clock = Clock(time.time() + 3600)  # the 15-minute deadline passed; the 3-day ones did not
    c, _ = public(env, clock)
    cookie = vendor_signed_in(env, c)
    res = c.get("/t/api/portal/rfqs", headers=jar(cookie))
    assert [i["title"] for i in res.json()["items"]] == ["פתוחה"], res.text
    assert late["id"] and live["id"]


def test_the_list_carries_only_allow_listed_keys_and_never_another_vendors_quote(env):
    on(env, rfqs=True)
    d = sent_rfq(env, [env.s4.vendor["id"], env.s4.contact["id"]])
    c, _ = public(env)
    from smplwise.services.tickets import rfq_links, store_rfq

    def link_token(contact_id: str) -> str:
        with env.s4.db.connection(mode="read") as conn:
            return rfq_links.token_of(store_rfq.link_of_vendor(conn, rv(d, contact_id)))

    other = c.post("/t/api/rfq/quote", json={"lines": [{"kind": "labor", "hours": "3", "rate": "333"}], "base_version": None,
                                             "client_request_id": crid()}, headers={"x-ticket-token": link_token(env.s4.contact["id"])})
    assert other.status_code == 201, other.text
    mine = c.post("/t/api/rfq/quote", json={"lines": QUOTE, "base_version": None, "client_request_id": crid()},
                  headers={"x-ticket-token": link_token(env.s4.vendor["id"])})
    assert mine.status_code == 201, mine.text
    cookie = vendor_signed_in(env, c)
    res = c.get("/t/api/portal/rfqs", headers=jar(cookie))
    (item,) = res.json()["items"]
    assert set(res.json()) == {"items"} and portal_more.sanitized_rfq(item) and set(item) == portal_more.RFQ_ITEM_KEYS
    assert item["quote"]["state"] == "submitted" and item["quote"]["currency"] == "ILS" and item["code_first"] is False
    for secret in ("999", "99900", "משה אברהם", env.s4.contact["id"], "קומה 3", "היחידה דולפת", PHONE_B_E164):
        assert secret not in res.text, secret


def test_open_hands_over_his_own_rfq_link_and_the_rfq_page_accepts_it(env, caplog):
    on(env, rfqs=True)
    d = sent_rfq(env, [env.s4.vendor["id"]])
    c, _ = public(env)
    cookie = vendor_signed_in(env, c)
    (item,) = c.get("/t/api/portal/rfqs", headers=jar(cookie)).json()["items"]
    with caplog.at_level(logging.DEBUG):
        r = c.post("/t/api/portal/rfqs/open", json={"item": item["id"]}, headers=jar(cookie))
    assert r.status_code == 200 and set(r.json()) == {"token", "kind", "ref"} and r.json()["kind"] == "rfq"
    tok = r.json()["token"]
    page = c.get("/t/api/rfq", headers={"x-ticket-token": tok})
    assert page.status_code == 200 and page.json()["rfq"]["title"] == d["title"]
    assert tok not in caplog.text
    with env.s4.db.connection(mode="read") as conn:
        row = conn.execute("SELECT details_json FROM audit_log WHERE action = 'ticket.portal.rfq_open'").fetchone()
    assert row is not None and tok not in row[0]


# ---------------------------------------------------------------- 4. technician requests: scope and hygiene first


def test_a_person_session_has_no_company_and_cannot_send_technician_requests(env):
    on(env, techs=True)
    assigned(env)  # contact A is a person, not a vendor company
    c, _ = public(env)
    cookie = signed_in(env, c)
    assert c.get("/t/api/portal/items", headers=jar(cookie)).json()["features"]["techs"] is False
    assert techs(c, cookie) == {"companies": [], "limits": {"name": 80, "pending": 5}}
    uniform_404(ask(env, cookie, company="a" * 24, action="add", name="יוסי כהן", phone=NEW_TECH))


def test_a_foreign_company_or_technician_id_and_bad_values_are_refused_and_nothing_is_stored(env):
    on(env, techs=True)
    assigned(env, env.s4.vendor["id"])
    t = tech(env)
    c, _ = public(env)
    cookie = vendor_signed_in(env, c)
    comp = techs(c, cookie)["companies"][0]
    assert [x["name"] for x in comp["techs"]] == ["דני לוי"] and set(comp) == portal_more.TECH_COMPANY_KEYS
    uniform_404(ask(env, cookie, company="c" * 24, action="add", name="יוסי כהן", phone=NEW_TECH))
    r = ask(env, cookie, company=comp["id"], action="replace", replaces="d" * 24, name="יוסי כהן", phone=NEW_TECH)
    assert r.status_code == 422 and r.json()["fields"] == [{"field": "replaces", "code": "unknown"}]
    for name in ("", "  ", "x", "https://evil.example.test", "www.spam.example", "a@b.example", "<b>יוסי</b>", "יוסי 0501234567", "י" * 81):
        r = ask(env, cookie, company=comp["id"], action="add", name=name, phone=NEW_TECH)
        assert r.status_code == 422 and r.json()["fields"][0]["field"] == "name", (name, r.text)
    for phone in ("", "12", "abc", "+" + "9" * 20):
        r = ask(env, cookie, company=comp["id"], action="add", name="יוסי כהן", phone=phone)
        assert r.status_code == 422 and r.json()["fields"] == [{"field": "phone", "code": "format"}], phone
    for body in ({"company": comp["id"], "action": "add", "name": "יוסי", "phone": NEW_TECH, "extra": 1},
                 {"company": comp["id"], "action": "fire", "name": "יוסי", "phone": NEW_TECH},
                 {"company": comp["id"], "action": "add", "name": "יוסי", "phone": NEW_TECH, "replaces": "x" * 24}):
        assert c.post("/t/api/portal/techs", json=body, headers=jar(cookie)).status_code == 422, body
    with env.s4.db.connection(mode="read") as conn:
        assert conn.execute("SELECT COUNT(*) FROM ticket_portal_tech_requests").fetchone()[0] == 0
    assert t["id"]


def test_the_name_is_cleaned_and_the_number_never_comes_back_in_full_known_or_unknown(env, caplog):
    on(env, techs=True)
    assigned(env, env.s4.vendor["id"])
    c, _ = public(env)
    cookie = vendor_signed_in(env, c)
    comp = techs(c, cookie)["companies"][0]
    with caplog.at_level(logging.DEBUG):
        known = ask(env, cookie, company=comp["id"], action="add", name="‮יוסי​  כהן‬", phone=PHONE_A)  # contact A's number
        unknown = ask(env, cookie, company=comp["id"], action="add", name="רון  לוי", phone=NEW_TECH)
    assert known.status_code == unknown.status_code == 201
    k, u = known.json()["request"], unknown.json()["request"]
    assert set(k) == set(u) == portal_more.TECH_REQUEST_KEYS
    assert k["name"] == "יוסי כהן" and u["name"] == "רון לוי"
    assert k["phone"] == "•••• 0031" and u["phone"] == "•••• 0077", "the last four digits only - never whether the number is known"
    for secret in ("972500000031", "972500000077", "050-000-0077"):
        assert secret not in known.text + unknown.text and secret not in caplog.text
    with env.s4.db.connection(mode="read") as conn:
        trail = [r[0] for r in conn.execute("SELECT details_json FROM audit_log WHERE action LIKE 'ticket.portal.tech%'")]
    assert trail and all("972500000" not in t and "יוסי" not in t and "רון" not in t for t in trail)


def test_a_repeated_tap_is_one_request_and_the_company_caps_hold(env):
    on(env, techs=True)
    assigned(env, env.s4.vendor["id"])
    c, _ = public(env, peer="198.51.100.90")
    cookie = vendor_signed_in(env, c)
    comp = techs(c, cookie)["companies"][0]
    first = ask(env, cookie, company=comp["id"], action="add", name="יוסי כהן", phone=NEW_TECH)
    again = ask(env, cookie, company=comp["id"], action="add", name="יוסי כהן", phone=NEW_TECH)
    assert first.json()["request"]["id"] == again.json()["request"]["id"]
    for i in range(4):
        assert ask(env, cookie, company=comp["id"], action="add", name=f"טכנאי {'אבגד'[i]}", phone=f"050-000-016{i}").status_code == 201
    r = ask(env, cookie, company=comp["id"], action="add", name="טכנאי ה", phone="050-000-0169")
    assert r.status_code == 409 and r.json() == {"code": "tech_limit"}, "5 pending per company"
    assert len(techs(c, cookie)["companies"][0]["requests"]) == 5


def test_the_vendor_withdraws_only_its_own_pending_request(env):
    on(env, techs=True)
    assigned(env, env.s4.vendor["id"])
    assigned(env)
    c, _ = public(env)
    cookie = vendor_signed_in(env, c)
    comp = techs(c, cookie)["companies"][0]
    req = ask(env, cookie, company=comp["id"], action="add", name="יוסי כהן", phone=NEW_TECH).json()["request"]
    a_cookie = signed_in(env, c)
    uniform_404(c.post("/t/api/portal/techs/cancel", json={"item": req["id"]}, headers=jar(a_cookie)))
    assert c.post("/t/api/portal/techs/cancel", json={"item": req["id"]}, headers=jar(cookie)).json() == {"ok": True}
    uniform_404(c.post("/t/api/portal/techs/cancel", json={"item": req["id"]}, headers=jar(cookie)))  # no longer pending
    assert techs(c, cookie)["companies"][0]["requests"][0]["state"] == "cancelled"


# ---------------------------------------------------------------- 5. the editor's side


def test_only_a_directory_editor_sees_and_decides_the_requests(env):
    on(env, techs=True)
    assigned(env, env.s4.vendor["id"])
    c, _ = public(env)
    cookie = vendor_signed_in(env, c)
    comp = techs(c, cookie)["companies"][0]
    ask(env, cookie, company=comp["id"], action="add", name="יוסי כהן", phone=NEW_TECH)
    for user in ("tom", "mona", "vic"):
        assert requests_of(env, user=user).status_code == 403, user
    (req,) = requests_of(env, "pending").json()["requests"]
    for user in ("tom", "mona"):
        assert env.c.post(f"{API}/tickets/portal-requests/{req['id']}/approve", json={"revision": req["revision"]}, headers=env.h(user)).status_code == 403
    assert req["phone"] == "050-000-0077" and req["phone_known"] is False and req["vendor"]["id"] == env.s4.vendor["id"]


def test_approve_creates_the_technician_through_the_directory_and_a_replacement_deactivates_the_old_row(env):
    on(env, techs=True)
    assigned(env, env.s4.vendor["id"])
    old = tech(env)
    c, _ = public(env)
    cookie = vendor_signed_in(env, c)
    comp = techs(c, cookie)["companies"][0]
    ask(env, cookie, company=comp["id"], action="replace", replaces=comp["techs"][0]["id"], name="יוסי כהן", phone=NEW_TECH)
    (req,) = requests_of(env, "pending").json()["requests"]
    assert req["replaces"] == {"id": old["id"], "name": "דני לוי"}
    stale = env.c.post(f"{API}/tickets/portal-requests/{req['id']}/approve", json={"revision": req["revision"] + 1})
    assert stale.status_code == 409 and stale.json()["code"] == "tech_request_stale"
    r = env.c.post(f"{API}/tickets/portal-requests/{req['id']}/approve", json={"revision": req["revision"]})
    assert r.status_code == 200, r.text
    new = env.c.get(f"{API}/tickets/contacts/{r.json()['contact_id']}").json()
    assert (new["kind"], new["vendor_id"], new["display_name"], new["phone"], new["active"]) == ("person", env.s4.vendor["id"], "יוסי כהן", "050-000-0077", True)
    assert new["phone_confirmed"] is False, "the editor confirms the number with the existing code flow"
    assert env.c.get(f"{API}/tickets/contacts/{old['id']}").json()["active"] is False
    again = env.c.post(f"{API}/tickets/portal-requests/{req['id']}/approve", json={"revision": req["revision"] + 1})
    assert again.status_code == 409 and again.json()["code"] == "tech_request_decided"
    comp = techs(c, cookie)["companies"][0]
    assert [t["name"] for t in comp["techs"]] == ["יוסי כהן"] and comp["requests"][0]["state"] == "approved"


def test_reject_changes_nothing_in_the_directory_and_the_vendor_sees_the_state(env):
    on(env, techs=True)
    assigned(env, env.s4.vendor["id"])
    c, _ = public(env)
    cookie = vendor_signed_in(env, c)
    comp = techs(c, cookie)["companies"][0]
    ask(env, cookie, company=comp["id"], action="add", name="יוסי כהן", phone=PHONE_A)
    (req,) = requests_of(env, "pending").json()["requests"]
    assert req["phone_known"] is True, "only the editor learns that the number is already in the directory"
    before = len(env.c.get(f"{API}/tickets/contacts").json()["contacts"])
    r = env.c.post(f"{API}/tickets/portal-requests/{req['id']}/reject", json={"revision": req["revision"]})
    assert r.status_code == 200, r.text
    assert len(env.c.get(f"{API}/tickets/contacts").json()["contacts"]) == before
    assert techs(c, cookie)["companies"][0]["requests"][0]["state"] == "rejected"


def test_erase_of_the_company_deletes_its_requests(env):
    on(env, techs=True)
    assigned(env, env.s4.vendor["id"])
    c, _ = public(env)
    cookie = vendor_signed_in(env, c)
    comp = techs(c, cookie)["companies"][0]
    ask(env, cookie, company=comp["id"], action="add", name="יוסי כהן", phone=NEW_TECH)
    with env.s4.db.connection() as conn:
        portal_more.forget_contact(conn, env.s4.vendor["id"])
        assert conn.execute("SELECT COUNT(*) FROM ticket_portal_tech_requests").fetchone()[0] == 0


@pytest.mark.parametrize("module", ["portal_more"])
def test_the_new_module_never_collects_bank_details(module):
    import pathlib
    import re

    src = (pathlib.Path(portal_more.__file__)).read_text(encoding="utf-8")
    assert not re.search(r"\b(iban|bank_account|account_number|swift|routing_number|bank_branch)\b", src, re.I)


# ---------------------------------------------------------------- 6. tickets.technician_requests (owner 2026-10-17): a grantable,
# department-scoped approval permission; tickets.configure keeps approving every request


TECH_PERM = "tickets.technician_requests"


def raw_request(env, vendor_id: str, name: str = "יוסי כהן", phone: str = NEW_TECH_E164) -> str:
    """A pending request of a vendor, written directly (the portal side is covered above): the approver's scope is under test."""
    import uuid

    rid = uuid.uuid4().hex
    with env.s4.db.connection() as conn:
        conn.execute("INSERT INTO ticket_portal_tech_requests(id, vendor_id, sender_contact_id, action, display_name, phone_e164, state, created_at) "
                     "VALUES (?,?,?, 'add', ?,?, 'pending', '2026-10-17T08:00:00Z')", (rid, vendor_id, vendor_id, name, phone))
    return rid


def set_departments(env, contact_id: str, depts: list[str]) -> None:
    r = env.c.patch(f"{API}/tickets/contacts/{contact_id}", json={"departments": depts, "revision": env.s4.contact_rev(contact_id)})
    assert r.status_code == 200, r.text


def grant(env, user: str, scope_type: str = "installation", scope_id: str = "*") -> str:
    """Through the normal roles / permissions API (the system administrator grants the single-permission role)."""
    env.c.get(f"{API}/me", headers=env.h(user))
    r = env.c.post(f"{API}/access/bindings", json={"subject_kind": "user", "subject_id": f"dev-{user}", "role_id": "tickets_technician_requests",
                                                   "scope_type": scope_type, "scope_id": scope_id})
    assert r.status_code == 201, r.text
    return r.json()["id"]


def decide(env, rid: str, user: str, verb: str = "approve"):
    rows = requests_of(env, "all").json()["requests"]  # joni (system_admin) reads the revision
    rev = next(x["revision"] for x in rows if x["id"] == rid)
    return env.c.post(f"{API}/tickets/portal-requests/{rid}/{verb}", json={"revision": rev}, headers=env.h(user))


def two_departments(env) -> tuple[str, str]:
    """Vendor B in maintenance (mona manages it), vendor C in cleaning (cleo manages it); one pending request each."""
    set_departments(env, env.s4.vendor["id"], ["dept-maintenance"])
    c = env.s4.add_contact(kind="vendor", display_name="ניקיון-פרו", phone="050-000-0044", departments=[env.s4.w.cleaning])
    assert c.status_code == 201, c.text
    return raw_request(env, env.s4.vendor["id"]), raw_request(env, c.json()["id"], name="רון לוי", phone="972500000088")


def test_the_permission_is_sensitive_not_delegable_labelled_and_held_only_by_system_admin_by_default():
    from smplwise.rbac import ROLES
    from smplwise.routers.access import DEFAULT_DELEGABLE, PERMISSION_LABELS, SENSITIVE

    assert ROLES["tickets_technician_requests"] == [TECH_PERM]
    assert TECH_PERM in SENSITIVE and "tickets_technician_requests" not in DEFAULT_DELEGABLE
    assert "{module}" in PERMISSION_LABELS[TECH_PERM]
    assert sorted(r for r, perms in ROLES.items() if TECH_PERM in perms) == ["system_admin", "tickets_technician_requests"], \
        "not a built-in default of department managers (site_admin / tickets_manage do not hold it)"


def test_a_department_manager_without_the_permission_is_refused_audited_and_sees_no_card(env):
    b, _c = two_departments(env)
    for user in ("mona", "cleo", "tom"):
        r = requests_of(env, user=user)
        assert r.status_code == 403 and r.json()["details"]["permission"] == TECH_PERM, (user, r.text)
        assert decide(env, b, user).status_code == 403
        assert decide(env, b, user, "reject").status_code == 403
        assert env.c.get(f"{API}/tickets/meta", headers=env.h(user)).json()["can"]["technician_requests"] is False
    with env.s4.db.connection(mode="read") as conn:
        denied = conn.execute("SELECT COUNT(*) FROM audit_log WHERE decision = 'denied' AND action = ?", (TECH_PERM,)).fetchone()[0]
    assert denied >= 3
    assert requests_of(env, "pending").json()["requests"][0]["state"] == "pending", "nothing was decided"


def test_a_department_manager_with_the_permission_decides_only_his_departments_vendors(env):
    b, c = two_departments(env)
    no_dept = raw_request(env, env.s4.contact["id"], name="דנה כץ", phone="972500000066")  # a row shared with every department
    grant(env, "mona")
    assert env.c.get(f"{API}/tickets/meta", headers=env.h("mona")).json()["can"]["technician_requests"] is True
    listed = requests_of(env, "pending", user="mona").json()["requests"]
    assert [x["id"] for x in listed] == [b], "another department's vendor and a vendor of no department are never listed"
    assert listed[0]["phone"] == "•••• 0077", "a manager without tickets.external sees the last four digits (the directory rule)"
    for rid in (c, no_dept):
        r = decide(env, rid, "mona")
        assert r.status_code == 404 and r.json()["code"] == "tech_request_not_found", "out of scope reads like an unknown id"
        assert decide(env, rid, "mona", "reject").status_code == 404
    r = decide(env, b, "mona")
    assert r.status_code == 200, r.text
    new = env.c.get(f"{API}/tickets/contacts/{r.json()['contact_id']}").json()
    assert (new["kind"], new["vendor_id"], new["departments"], new["phone_confirmed"]) == ("person", env.s4.vendor["id"], ["dept-maintenance"], False)
    with env.s4.db.connection(mode="read") as conn:
        actor = conn.execute("SELECT actor_user_id FROM audit_log WHERE action = 'ticket.contact.create' ORDER BY rowid DESC LIMIT 1").fetchone()[0]
    assert actor == "dev-mona", "the directory's own create audit names the approver"
    grant(env, "cleo")
    assert [x["id"] for x in requests_of(env, "pending", user="cleo").json()["requests"]] == [c]
    assert decide(env, c, "cleo", "reject").status_code == 200


def test_an_all_departments_holder_decides_every_vendor_and_configure_keeps_working(env):
    b, c = two_departments(env)
    no_dept = raw_request(env, env.s4.contact["id"], name="דנה כץ", phone="972500000066")
    grant(env, "alda")  # tickets_view + tickets_all_departments, no membership
    assert {x["id"] for x in requests_of(env, "pending", user="alda").json()["requests"]} == {b, c, no_dept}
    assert decide(env, c, "alda", "reject").status_code == 200
    assert {x["id"] for x in requests_of(env, "pending").json()["requests"]} == {b, no_dept}, "joni (tickets.configure) sees every one"
    assert decide(env, no_dept, "joni", "reject").status_code == 200


def test_grant_and_revoke_take_effect_at_once(env):
    b, _c = two_departments(env)
    assert requests_of(env, user="mona").status_code == 403
    binding = grant(env, "mona")
    assert requests_of(env, user="mona").status_code == 200
    r = env.c.delete(f"{API}/access/bindings/{binding}")
    assert r.status_code == 200, r.text
    assert requests_of(env, user="mona").status_code == 403
    assert decide(env, b, "mona").status_code == 403
    # a binding scoped to a site is not the installation-wide grant the approval needs
    floor_binding = grant(env, "mona", "floor", env.s4.w.floors["floor2"])
    assert floor_binding and requests_of(env, user="mona").status_code == 403
