"""CR-ARX-WISKEY-SHARED-IDENTITY section 5 (negative-first, FAKES ONLY): the arrival step on an RFQ work order's handler page.

The public app is the real one (public_runtime.build_app, driven through an ASGI test client - no socket); the access engine and the
message transport are fakes (tests/fake_wiskey.py). What is proven: the step is invisible while switched off or on a ticket that is
not an RFQ order; a request creates ONLY a `requested` grant and sends nothing; a forwarded link can at most name one of the
vendor's own persons, whose code goes only to that person's verified number after a human approval; a technician the vendor adds
is pending until a manager accepts him and confirms his own number (owner answer 7); the notice acknowledgement is stored (owner
answer 9); replays are idempotent."""
from __future__ import annotations

import datetime as dt
import time
import uuid

import pytest
from fake_wiskey import FakeAccessEngine, FakeCodeTransport
from tickets_s4_world import API, Clock, build_s4

from smplwise.db import new_id, set_setting
from smplwise.services import access_grants as ag
from smplwise.services.tickets.public_http import UNIFORM_404

TECH_PHONE = "972500000051"


def crid() -> str:
    return str(uuid.uuid4())


class Arrival:
    def __init__(self, settings, monkeypatch, *, enable: bool = True, rfq: bool = True) -> None:
        self.s4 = build_s4(settings, monkeypatch)
        self.db = self.s4.db
        monkeypatch.setattr(ag, "GO_LIVE_PERMITTED", True)
        self.engine, self.transport = FakeAccessEngine(), FakeCodeTransport()
        monkeypatch.setattr(ag, "ENGINE_FACTORY", lambda db: self.engine)
        monkeypatch.setattr(ag, "TRANSPORT", self.transport)
        vendor = self.s4.vendor["id"]
        t = self.s4.ticket(title="תיקון שער חניון")
        r = self.s4.assign_contact(t["id"], contact_id=vendor)
        assert r.status_code == 200, r.text
        self.ticket_id = t["id"]
        self.token = self.s4.token_of(t["id"])
        now = ag.iso(ag.now())
        with self.db.connection() as conn:
            if enable:
                set_setting(conn, ag.FLAG_KEY, "on")
            self.assignment = conn.execute("SELECT id FROM ticket_assignments WHERE ticket_id = ? ORDER BY assigned_at DESC LIMIT 1", (t["id"],)).fetchone()[0]
            building = conn.execute("SELECT id FROM buildings LIMIT 1").fetchone()[0]
            conn.execute("UPDATE tickets SET building_id = ? WHERE id = ?", (building, t["id"]))
            conn.execute("INSERT INTO intercom_station_placement(config_entry_id, building_id, assigned_at) VALUES ('st-a', ?, ?)", (building, now))
            if rfq:
                conn.execute("""INSERT INTO ticket_quotes(id, ticket_id, assignment_id, contact_id, version, source, state, currency, vat_mode, vat_rate_bp, lines_json,
                                labor_minor, parts_minor, travel_minor, other_minor, subtotal_minor, vat_minor, total_minor, created_by_kind, created_by, created_at, updated_at)
                                VALUES (?, ?, ?, ?, 1, 'vendor', 'approved', 'ILS', 'included', 1700, '[]', 0, 0, 0, 0, 0, 0, 0, 'contact', ?, ?, ?)""",
                             (new_id(), t["id"], self.assignment, vendor, vendor, now, now))
            self.tech = new_id()
            conn.execute("""INSERT INTO ticket_contacts(id, kind, vendor_id, display_name, phone_e164, lang, active, created_by, created_at, updated_at,
                            phone_confirmed_at, phone_confirmed_via) VALUES (?, 'person', ?, 'רון חשמלאי', ?, 'he', 1, 'test', ?, ?, ?, 'code')""",
                         (self.tech, vendor, TECH_PHONE, now, now, now))
            self.stranger = new_id()  # a person of ANOTHER vendor
            conn.execute("""INSERT INTO ticket_contacts(id, kind, display_name, phone_e164, lang, active, created_by, created_at, updated_at)
                            VALUES (?, 'person', 'זר', '972500000059', 'he', 1, 'test', ?, ?)""", (self.stranger, now, now))
        self.client, _ = self.s4.public(Clock(time.time()))

    def day(self, plus: int) -> str:
        """A plain day N days from today IN THE INSTALLATION'S ZONE (the product's rule, access_grants.zone_of). TKGATEFIX8: the
        fallback used the MACHINE's date (`ag.zone_of_default` does not exist), the previous day on the Etc/UTC runner after the
        installation's midnight."""
        with self.db.connection(mode="read") as conn:
            zone = ag.zone_of(conn)
        return (dt.datetime.now(zone).date() + dt.timedelta(days=plus)).isoformat()

    def body(self, **over) -> dict:
        b = {"person_id": self.tech, "date_from": self.day(3), "date_to": self.day(3), "hours": "08:00-17:00", "notice_ack": True,
             "notice_version": ag.NOTICE_VERSION, "client_request_id": crid()}
        b.update(over)
        return {k: v for k, v in b.items() if v is not None or k == "person_id"}

    def post(self, **over):
        return self.client.post("/t/api/arrival", headers={"x-ticket-token": self.token}, json=self.body(**over))

    def grants(self) -> list[dict]:
        with self.db.connection(mode="read") as conn:
            return [dict(r) for r in conn.execute("SELECT * FROM access_grants ORDER BY created_at").fetchall()]


@pytest.fixture()
def arr(settings, monkeypatch):
    a = Arrival(settings, monkeypatch)
    yield a
    ag.reset_for_tests()


def test_the_step_is_invisible_while_switched_off(settings, monkeypatch):
    a = Arrival(settings, monkeypatch, enable=False)
    try:
        r = a.client.get("/t/api/arrival", headers={"x-ticket-token": a.token})
        assert r.status_code == 404 and r.content == UNIFORM_404
        assert a.post().status_code == 404 and a.grants() == []
    finally:
        ag.reset_for_tests()


def test_the_step_is_invisible_on_a_ticket_that_is_not_an_rfq_order(settings, monkeypatch):
    a = Arrival(settings, monkeypatch, rfq=False)
    try:
        assert a.client.get("/t/api/arrival", headers={"x-ticket-token": a.token}).content == UNIFORM_404
        assert a.post().status_code == 404 and a.grants() == []
    finally:
        ag.reset_for_tests()


def test_no_token_or_a_wrong_token_is_the_uniform_404(arr):
    assert arr.client.get("/t/api/arrival").content == UNIFORM_404
    assert arr.client.get("/t/api/arrival", headers={"x-ticket-token": "x" * 43}).content == UNIFORM_404


def test_the_view_lists_only_the_vendors_persons_masked_and_the_notice(arr):
    r = arr.client.get("/t/api/arrival", headers={"x-ticket-token": arr.token})
    assert r.status_code == 200, r.text
    v = r.json()
    assert [p["label"] for p in v["persons"]] == ["רון ····51"] and v["can_add"] is True
    assert v["notice"]["version"] == ag.NOTICE_VERSION and v["notice"]["text"] and v["max_days"] == 14
    assert TECH_PHONE not in r.text and "st-a" not in r.text and "dev-joni" not in r.text
    assert r.headers["cache-control"].startswith("private") or "no-store" in r.headers["cache-control"]


def test_an_arrival_creates_only_a_requested_grant_and_sends_nothing(arr):
    r = arr.post()
    assert r.status_code == 200, r.text
    assert r.json()["state"] == "waiting" and r.json()["outcome"] == "created"
    (g,) = arr.grants()
    assert g["state"] == "requested" and g["subject_id"] == arr.tech and g["source_kind"] == "rfq_order" and g["requested_by"].startswith("contact:")
    assert g["doors_json"] == '{"st-a": [1]}', "doors suggested from the ticket's building"
    assert arr.engine.calls == [] and arr.transport.sent == [], "no WisKey, no message"
    with arr.db.connection(mode="read") as conn:
        assert conn.execute("SELECT via FROM access_grant_notices WHERE grant_id = ?", (g["id"],)).fetchone()[0] == "page"
        assert conn.execute("SELECT COUNT(*) FROM ticket_events WHERE ticket_id = ? AND kind = 'access_request'", (arr.ticket_id,)).fetchone()[0] == 1
        assert conn.execute("SELECT COUNT(*) FROM notifications WHERE source = 'access.grant_request'").fetchone()[0] == 1


def test_a_forwarded_link_cannot_name_a_stranger_and_the_code_goes_only_to_the_named_persons_number(arr):
    r = arr.post(person_id=arr.stranger)
    assert r.status_code == 422 and arr.grants() == []
    assert arr.post().status_code == 200
    (g,) = arr.grants()
    rev = g["revision"]
    assert arr.s4.c.post(f"{API}/access-grants/{g['id']}/approve", json={"revision": rev}).status_code == 200, "the page notice counts (owner answer 9)"
    ag.WORKER.run_once(arr.db)
    with arr.db.connection() as conn:
        conn.execute("UPDATE access_grants SET code_due_at = ? WHERE id = ?", (ag.iso(ag.now()), g["id"]))
    ag.WORKER.run_once(arr.db)
    assert [n for n, _t in arr.transport.sent] == [TECH_PHONE]


def test_a_new_technician_is_pending_until_a_manager_accepts_him_and_he_confirms_his_number(arr):
    r = arr.post(person_id=None, new_person={"name": "אבי חדש", "phone": "050-000-0057"})
    assert r.status_code == 200, r.text
    (g,) = arr.grants()
    new = g["subject_id"]
    with arr.db.connection(mode="read") as conn:
        row = conn.execute("SELECT active, vendor_id, phone_confirmed_at FROM ticket_contacts WHERE id = ?", (new,)).fetchone()
        assert (row["active"], row["vendor_id"], row["phone_confirmed_at"]) == (0, arr.s4.vendor["id"], None)
    c = arr.s4.c
    r = c.post(f"{API}/access-grants/{g['id']}/approve", json={"revision": g["revision"]})
    assert r.status_code == 409 and r.json()["details"]["reason"] == "contact_pending"
    assert c.post(f"{API}/access-grants/pending-contacts/{new}/accept").status_code == 200
    rev = arr.grants()[0]["revision"]
    r = c.post(f"{API}/access-grants/{g['id']}/approve", json={"revision": rev})
    assert r.status_code == 409 and r.json()["details"]["reason"] == "phone_not_verified", "he confirms his own number first"
    with arr.db.connection() as conn:
        conn.execute("UPDATE ticket_contacts SET phone_confirmed_at = ?, phone_confirmed_via = 'code' WHERE id = ?", (ag.iso(ag.now()), new))
    assert c.post(f"{API}/access-grants/{g['id']}/approve", json={"revision": rev}).status_code == 200


def _pending(arr):
    r = arr.post(person_id=None, new_person={"name": "אבי חדש", "phone": "050-000-0057"})
    assert r.status_code == 200, r.text
    (g,) = arr.grants()
    return g, g["subject_id"]


def test_reject_and_delete_erases_the_pending_technician_and_ends_his_request(arr):
    """Lead decision 6 (2026-10-18): a manager rejects a technician nobody accepted; the vendor-typed name and phone go."""
    g, new = _pending(arr)
    r = arr.s4.c.post(f"{API}/access-grants/pending-contacts/{new}/reject")
    assert r.status_code == 200 and r.json() == {"contact_id": new, "rejected": True, "deleted": True, "requests_ended": 1}, r.text
    with arr.db.connection(mode="read") as conn:
        c = conn.execute("SELECT display_name, phone_e164, phone_key, active, erased_at FROM ticket_contacts WHERE id = ?", (new,)).fetchone()
        assert c["phone_e164"] is None and c["phone_key"] is None and c["active"] == 0 and c["erased_at"] and "אבי" not in c["display_name"]
        assert conn.execute("SELECT rejected_at FROM access_pending_contacts WHERE contact_id = ?", (new,)).fetchone()[0]
        st = conn.execute("SELECT state FROM access_grants WHERE id = ?", (g["id"],)).fetchone()[0]
        assert st == "revoked"
        audit = conn.execute("SELECT details_json FROM audit_log WHERE action = 'access.pending_contact.reject'").fetchall()
        assert len(audit) == 1 and "אבי" not in str(audit[0][0]) and "0057" not in str(audit[0][0])


def test_reject_is_refused_for_a_second_time_an_accepted_or_an_unknown_technician(arr):
    _g, new = _pending(arr)
    c = arr.s4.c
    assert c.post(f"{API}/access-grants/pending-contacts/{new}/reject").status_code == 200
    assert c.post(f"{API}/access-grants/pending-contacts/{new}/reject").status_code == 404, "already rejected"
    assert c.post(f"{API}/access-grants/pending-contacts/{new}/accept").status_code == 404, "and cannot be accepted afterwards"
    assert c.post(f"{API}/access-grants/pending-contacts/{arr.tech}/reject").status_code == 404, "an established technician is not pending"
    with arr.db.connection(mode="read") as conn:
        assert conn.execute("SELECT erased_at FROM ticket_contacts WHERE id = ?", (arr.tech,)).fetchone()[0] is None


def test_reject_needs_the_same_authority_as_accept(arr):
    from conftest import as_user

    _g, new = _pending(arr)
    r = arr.s4.c.post(f"{API}/access-grants/pending-contacts/{new}/reject", headers=as_user("otto"))
    assert r.status_code == 403, r.text
    with arr.db.connection(mode="read") as conn:
        assert conn.execute("SELECT erased_at FROM ticket_contacts WHERE id = ?", (new,)).fetchone()[0] is None


def test_an_accepted_technician_cannot_be_rejected(arr):
    _g, new = _pending(arr)
    c = arr.s4.c
    assert c.post(f"{API}/access-grants/pending-contacts/{new}/accept").status_code == 200
    assert c.post(f"{API}/access-grants/pending-contacts/{new}/reject").status_code == 404


def test_validation_of_the_page_body(arr):
    assert arr.post(notice_ack=False).status_code == 422, "the notice must be acknowledged"
    assert arr.post(hours="06:00-23:00").status_code == 422, "hours from the fixed list only"
    assert arr.post(date_from=arr.day(3), date_to=arr.day(20)).status_code == 422, "more than 14 days"
    assert arr.post(date_from=arr.day(-1), date_to=arr.day(1)).status_code == 422, "not in the past"
    assert arr.post(new_person={"name": "שניים", "phone": "0500000058"}).status_code == 422, "exactly one of person / new person"
    assert arr.grants() == []


def test_a_replay_is_idempotent_and_a_second_request_for_the_same_person_merges(arr):
    body = arr.body()
    first = arr.client.post("/t/api/arrival", headers={"x-ticket-token": arr.token}, json=body)
    again = arr.client.post("/t/api/arrival", headers={"x-ticket-token": arr.token}, json=body)
    assert first.status_code == again.status_code == 200 and first.json() == again.json()
    assert len(arr.grants()) == 1
    r = arr.post(date_from=arr.day(4), date_to=arr.day(4))
    assert r.status_code == 200 and r.json()["outcome"] == "replaced" and len(arr.grants()) == 1


def test_returning_the_ticket_ends_the_request(arr):
    assert arr.post().status_code == 200
    r = arr.client.post("/t/api/return", headers={"x-ticket-token": arr.token},
                        json={"kind": "cannot_handle", "reason": "אין חלק", "client_request_id": crid()})
    assert r.status_code == 200, r.text
    (g,) = arr.grants()
    assert (g["state"], g["end_reason"]) == ("revoked", "ticket_reassigned")


# ---- n2 privacy notice (technician privacy pack, 2026-10-18)
def _view(a):
    r = a.client.get("/t/api/arrival", headers={"x-ticket-token": a.token})
    assert r.status_code == 200, r.text
    return r.json()["notice"]


def _set_lang(a, lang):
    with a.db.connection() as conn:
        conn.execute("UPDATE ticket_contacts SET lang = ? WHERE id IN (SELECT contact_id FROM ticket_assignments WHERE id = ?)", (lang, a.assignment))


@pytest.mark.parametrize("lang", ["he", "en", "ar", "ru"])
def test_the_notice_is_served_in_the_vendors_language(arr, lang):
    _set_lang(arr, lang)
    n = _view(arr)
    assert n == {"version": "n2", "text": ag.NOTICE_TEXT[lang], "attest": ag.NOTICE_ATTEST[lang], "lang": lang}


def test_an_arabic_vendor_no_longer_gets_hebrew(arr):
    import re
    _set_lang(arr, "ar")
    text = _view(arr)["text"]
    assert re.search("[֐-׿]", text) is None and re.search("[؀-ۿ]", text)


def test_a_stale_n1_acknowledgement_is_refused(arr):
    r = arr.post(notice_version="n1")
    assert r.status_code == 422 and "notice_ack" in r.text
    assert arr.grants() == []
    with arr.db.connection(mode="read") as conn:
        assert conn.execute("SELECT COUNT(*) FROM access_grant_notices").fetchone()[0] == 0
