"""CR-038 slice 4 - the contact / vendor directory (spec 7.2, 8, 15.2; D15, D25; review T19): the permission matrix, phone
numbers (E.164 digits stored, keyed index, full number only for its holders), validation, the vendor / person model, the phone
change that revokes live links, the internal user's row that never gets a token link, erase and export."""
from __future__ import annotations

import pytest

from conftest import bind
from smplwise.services.tickets import contacts, links
from smplwise.services.tickets.keyring import KEYS
from tickets_s4_world import API, PHONE_A_E164, build_s4


@pytest.fixture()
def s4(settings, monkeypatch):
    return build_s4(settings, monkeypatch)


def listing(s4, user: str, **q):
    return s4.c.get(f"{API}/tickets/contacts", params=q, headers=s4.h(user))


# ---------------------------------------------------------------- values


@pytest.mark.parametrize("raw,digits", [
    ("050-000-0031", "972500000031"), ("+972 50 000 0031", "972500000031"), ("00972500000031", "972500000031"),
    ("(050) 000.0031", "972500000031"), ("+1 202 555 0100", "12025550100"), ("", None), ("  ", None), (None, None),
])
def test_phone_numbers_become_e164_digits(raw, digits):
    assert contacts.normalize_phone(raw) == digits


@pytest.mark.parametrize("raw", ["050-ABC", "+0123456789", "1234567", "+12345678901234567", "٠٥٠٠٠٠٠٠٣١", "050‮0000031", 123])
def test_phone_numbers_that_are_not_numbers_are_refused(raw):
    with pytest.raises(contacts.ContactInvalid):
        contacts.normalize_phone(raw)


def test_masking_and_display():
    assert contacts.mask_phone("972500000031") == "•••• 0031"
    assert contacts.display_phone("972500000031") == "050-000-0031"
    assert contacts.display_phone("12025550100") == "+12025550100"


# ---------------------------------------------------------------- the matrix


def test_only_the_configure_permission_writes_the_directory(s4):
    for user in ("mona", "tom", "nora", "vic", "alda"):
        r = s4.add_contact(user=user, display_name="ניסיון")
        assert r.status_code == 403, (user, r.text)
    cid = s4.contact["id"]
    rev = s4.contact_rev(cid)
    assert s4.c.patch(f"{API}/tickets/contacts/{cid}", json={"display_name": "x", "revision": rev}, headers=s4.h("mona")).status_code == 403
    assert s4.c.post(f"{API}/tickets/contacts/{cid}/erase", json={"confirm": True}, headers=s4.h("mona")).status_code == 403
    assert s4.c.get(f"{API}/tickets/contacts/{cid}/export", headers=s4.h("mona")).status_code == 403
    with s4.db.connection(mode="read") as conn:
        denied = conn.execute("SELECT COUNT(*) FROM audit_log WHERE decision = 'denied' AND action = 'tickets.configure'").fetchone()[0]
    assert denied >= 5, "every refused write is audited (rbac.require)"


def test_managers_read_their_departments_contacts_with_masked_phones(s4):
    r = listing(s4, "mona")
    assert r.status_code == 200 and r.json()["can_edit"] is False
    rows = {c["id"]: c for c in r.json()["contacts"]}
    assert s4.contact["id"] in rows, "a contact with no department rows is allowed everywhere"
    assert rows[s4.contact["id"]]["phone"] == "•••• 0031" and rows[s4.contact["id"]]["phone_full"] is False
    assert rows[s4.contact["id"]]["notes"] == "" and rows[s4.vendor["id"]]["email"].startswith("•••@")
    assert listing(s4, "tom").status_code == 403, "a member is not a manager"
    assert listing(s4, "vic").status_code == 403


def test_a_contact_restricted_to_another_department_is_invisible_to_this_manager(s4):
    r = s4.add_contact(display_name="ספק ניקיון", phone="050-000-0040", departments=[s4.w.cleaning])
    assert r.status_code == 201, r.text
    cid = r.json()["id"]
    assert cid not in {c["id"] for c in listing(s4, "mona").json()["contacts"]}
    assert cid in {c["id"] for c in listing(s4, "cleo").json()["contacts"]}
    assert s4.c.get(f"{API}/tickets/contacts/{cid}", headers=s4.h("mona")).status_code == 404


def test_the_external_permission_unmasks_phones_for_the_managers_departments(s4):
    bind(s4.c, s4.w.settings, "mona", "tickets_external", "installation", "*")
    rows = {c["id"]: c for c in listing(s4, "mona").json()["contacts"]}
    assert rows[s4.contact["id"]]["phone"] == "050-000-0031" and rows[s4.contact["id"]]["phone_full"] is True
    full = {c["id"]: c for c in listing(s4, "joni").json()["contacts"]}
    assert full[s4.contact["id"]]["phone_full"] is True and full[s4.contact["id"]]["notes"] == ""


def test_the_phone_is_stored_as_digits_with_a_keyed_index(s4):
    with s4.db.connection(mode="read") as conn:
        row = dict(conn.execute("SELECT * FROM ticket_contacts WHERE id = ?", (s4.contact["id"],)).fetchone())
    assert row["phone_e164"] == PHONE_A_E164
    assert row["phone_key"] == links.phone_key(KEYS.get(row["phone_key_id"]), PHONE_A_E164) and row["phone_key_id"]
    with s4.db.connection(mode="read") as conn:
        audits = " ".join(r[0] or "" for r in conn.execute("SELECT details_json FROM audit_log WHERE action LIKE 'ticket.contact.%'"))
    assert PHONE_A_E164 not in audits and "0031" not in audits, "a number never reaches an audit row"


@pytest.mark.parametrize("body,field", [
    ({"display_name": ""}, "display_name"),
    ({"display_name": "א" * 81}, "display_name"),
    ({"phone": "abc"}, "phone"),
    ({"email": "no-at-sign"}, "email"),
    ({"email": "a@b"}, "email"),
    ({"departments": ["no-such-dept"]}, "departments"),
    ({"vendor_id": "nope"}, "vendor_id"),
    ({"user_id": "dev-ghost"}, "user_id"),
])
def test_invalid_rows_are_422_with_the_field(s4, body, field):
    r = s4.add_contact(**body)
    assert r.status_code == 422 and r.json()["details"]["fields"][0]["field"] == field, r.text


def test_a_vendor_and_its_person(s4):
    r = s4.add_contact(display_name="אלון", vendor_id=s4.vendor["id"], phone="050-000-0033")
    assert r.status_code == 201, r.text
    person = r.json()
    assert person["vendor_id"] == s4.vendor["id"] and person["vendor_name"] == "קליימה-טק מיזוג אוויר"
    v = s4.c.get(f"{API}/tickets/contacts/{s4.vendor['id']}").json()
    assert [p["id"] for p in v["persons"]] == [person["id"]]
    r = s4.add_contact(kind="vendor", display_name="ספק משנה", vendor_id=s4.vendor["id"])
    assert r.status_code == 422, "a vendor never belongs to a vendor"
    assert s4.c.post(f"{API}/tickets/contacts/{s4.vendor['id']}/erase", json={"confirm": True}).status_code == 409, "persons first"


def test_a_stale_revision_is_409(s4):
    cid = s4.contact["id"]
    rev = s4.contact_rev(cid)
    assert s4.c.patch(f"{API}/tickets/contacts/{cid}", json={"company": "א", "revision": rev}).status_code == 200
    r = s4.c.patch(f"{API}/tickets/contacts/{cid}", json={"company": "ב", "revision": rev})
    assert r.status_code == 409 and r.json()["code"] == "contact_stale"


# ---------------------------------------------------------------- links follow the directory


def test_a_phone_change_revokes_live_links_and_waits_for_the_manager(s4):
    t, _token = s4.sent()
    cid = s4.contact["id"]
    r = s4.c.patch(f"{API}/tickets/contacts/{cid}", json={"phone": "050-000-0099", "revision": s4.contact_rev(cid)})
    assert r.status_code == 200, r.text
    assert s4.link_row(t["id"])["revoked_reason"] == "contact_changed"
    d = s4.w.detail(t["id"])
    assert d["waiting_on"] == "manager" and d["waiting_reason"] == "contact_changed"
    assert any(e["kind"] == "contact_changed" for e in d["events"])
    with s4.db.connection(mode="read") as conn:
        a = conn.execute("SELECT details_json FROM audit_log WHERE action = 'ticket.contact.update' ORDER BY id DESC").fetchone()[0]
    assert '"links_revoked": 1' in a and "0099" not in a


def test_an_unchanged_phone_spelt_differently_revokes_nothing(s4):
    t, _token = s4.sent()
    cid = s4.contact["id"]
    r = s4.c.patch(f"{API}/tickets/contacts/{cid}", json={"phone": "+972 50 000 0031", "revision": s4.contact_rev(cid)})
    assert r.status_code == 200
    assert s4.link_row(t["id"])["revoked_at"] is None


def test_raising_require_code_raises_the_live_links_at_once(s4):
    t, _token = s4.sent()
    cid = s4.contact["id"]
    assert s4.c.patch(f"{API}/tickets/contacts/{cid}", json={"require_code": True, "revision": s4.contact_rev(cid)}).status_code == 200
    assert s4.link_row(t["id"])["require_code"] == 1
    assert s4.c.patch(f"{API}/tickets/contacts/{cid}", json={"require_code": False, "revision": s4.contact_rev(cid)}).status_code == 200
    assert s4.link_row(t["id"])["require_code"] == 1, "lowering applies to new links only (spec 10.5)"


def test_an_internal_users_row_never_receives_a_token_link(s4):
    s4.c.get(f"{API}/me", headers=s4.h("tom"))
    r = s4.add_contact(display_name="טום (טלפון)", phone="050-000-0050", user_id="dev-tom")
    assert r.status_code == 201, r.text
    cid = r.json()["id"]
    assert s4.add_contact(display_name="כפול", user_id="dev-tom").status_code == 409, "one row per user"
    t = s4.ticket()
    r = s4.assign_contact(t["id"], cid)
    assert r.status_code == 409 and r.json()["code"] == "assignee_not_allowed", r.text
    with s4.db.connection(mode="read") as conn:
        assert conn.execute("SELECT COUNT(*) FROM ticket_links WHERE contact_id = ?", (cid,)).fetchone()[0] == 0


def test_linking_a_contact_to_a_user_later_revokes_its_links(s4):
    t, _token = s4.sent()
    s4.c.get(f"{API}/me", headers=s4.h("nora"))
    cid = s4.contact["id"]
    assert s4.c.patch(f"{API}/tickets/contacts/{cid}", json={"user_id": "dev-nora", "revision": s4.contact_rev(cid)}).status_code == 200
    assert s4.link_row(t["id"])["revoked_at"] is not None


def test_erase_tombstones_the_person_and_revokes_links(s4):
    t, _token = s4.sent()
    r = s4.c.post(f"{API}/tickets/contacts/{s4.contact['id']}/erase", json={"confirm": True, "history": True})
    assert r.status_code == 200 and r.json()["links_revoked"] == 1, r.text
    with s4.db.connection(mode="read") as conn:
        row = dict(conn.execute("SELECT * FROM ticket_contacts WHERE id = ?", (s4.contact["id"],)).fetchone())
        names = {r[0] for r in conn.execute("SELECT assignee_name FROM ticket_assignments WHERE contact_id = ?", (s4.contact["id"],))}
    assert row["display_name"] == contacts.TOMBSTONE and row["phone_e164"] is None and row["phone_key"] is None and row["erased_at"]
    assert names == {contacts.TOMBSTONE}
    assert s4.link_row(t["id"])["revoked_reason"] == "contact_erased"
    assert s4.c.post(f"{API}/tickets/contacts/{s4.contact['id']}/erase", json={"confirm": False}).status_code == 422, "confirm: true only"
    r = s4.assign_contact(s4.ticket()["id"], s4.contact["id"])
    assert r.status_code == 409 and r.json()["code"] == "assignee_not_allowed"


def test_export_returns_the_row_and_what_the_person_wrote(s4):
    import time
    import uuid

    from tickets_s4_world import Clock

    t, token = s4.sent()
    client, _ = s4.public(Clock(time.time()))
    assert client.post("/t/api/note", headers={"x-ticket-token": token}, json={"text": "הערה של הספק", "client_request_id": str(uuid.uuid4())}).status_code == 200
    r = s4.c.get(f"{API}/tickets/contacts/{s4.contact['id']}/export")
    assert r.status_code == 200, r.text
    e = r.json()
    assert e["contact"]["phone_e164"] == PHONE_A_E164 and "phone_key" not in e["contact"]
    assert [x["body"] for x in e["timeline"] if x["kind"] == "note"] == ["הערה של הספק"]
    assert e["assignments"][0]["ticket_number"] == t["number"]
