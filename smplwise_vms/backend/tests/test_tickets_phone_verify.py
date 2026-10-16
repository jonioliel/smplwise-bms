"""TKNOTIFOTP (owner decision 2026-10-16): OPTIONAL verification of number ownership by a one-time WhatsApp code - OFF by default,
never mandatory (services/tickets/phone_verify.py). Negative cases first: a wrong, malformed, expired, exhausted or replayed code, a
code of another row or of an earlier number, a staff member's number from the admin side, the resend cooldown and the caps - each
answers the SAME refusal; then the positive paths and the gates (links, link codes, staff links, NOTIFWA notifications) and the
hygiene (no code or number in the outbox row, the audit rows or the log). Fake ha-whatsapp only; every name and number is invented
(the 050-000-xxxx block)."""
from __future__ import annotations

import json
import logging
import re

from smplwise.services import notify_whatsapp as wa
from smplwise.services.tickets import codes as codes_mod, phone_verify
from smplwise.services.tickets.keyring import KEYS
from test_tickets_s5b_channel import env  # noqa: F401 - the slice 5b environment (fake ha-whatsapp, mapped account, WhatsApp on)
from test_tickets_staff_links import TOM_PHONE, audits, mine, set_mobile
from tickets_s4_world import PHONE_A_E164

API = "/api/v1"
CONTACTS = f"{API}/tickets/contacts"


# ---------------------------------------------------------------- helpers


def contact(env, cid: str | None = None) -> dict:
    r = env.c.get(f"{CONTACTS}/{cid or env.s4.contact['id']}")
    assert r.status_code == 200, r.text
    return r.json()


def patch(env, cid: str, **body) -> dict:
    r = env.c.patch(f"{CONTACTS}/{cid}", json={"revision": contact(env, cid)["revision"], **body})
    assert r.status_code == 200, r.text
    return r.json()


def require_installation(env, on: bool = True) -> None:
    body = env.channel(phone_verify={"required": on})
    assert body["phone_verify"]["required"] is on


def send(env, cid: str | None = None, user: str = "joni"):
    return env.c.post(f"{CONTACTS}/{cid or env.s4.contact['id']}/phone-verify/send", headers=env.h(user))


def check(env, code, cid: str | None = None, user: str = "joni"):
    return env.c.post(f"{CONTACTS}/{cid or env.s4.contact['id']}/phone-verify/check", json={"code": code}, headers=env.h(user))


def latest(env, cid: str) -> dict:
    with env.s4.db.connection(mode="read") as conn:
        return dict(conn.execute("SELECT * FROM ticket_phone_verifications WHERE contact_id = ? ORDER BY created_at DESC, rowid DESC LIMIT 1",
                                 (cid,)).fetchone())


def code_of(env, cid: str) -> str:
    """The six digits of the row's live code - derived from the verification row id like the outbox worker does (W9)."""
    row = latest(env, cid)
    return codes_mod.derive_code(KEYS.get(row["key_id"]), row["id"])


def other(code: str) -> str:
    return f"{(int(code) + 1) % 10 ** 6:06d}"


def uniform(r) -> None:
    assert r.status_code == 422 and r.json()["code"] == "code_invalid", r.text


def cooled(env) -> None:
    """Step past the 60 s resend cooldown (the rows' send times move back; the clock of the module is the wall clock)."""
    import datetime as dt

    from smplwise.services.tickets import handler_links

    back = handler_links.iso(handler_links.now_utc() - dt.timedelta(minutes=2))  # inside the day window, outside the cooldown
    with env.s4.db.connection() as conn:
        conn.execute("UPDATE ticket_phone_verifications SET created_at = ? WHERE created_at > ?", (back, back))


# ---------------------------------------------------------------- the default: off, nothing changes


def test_the_switches_are_off_by_default_and_a_link_leaves_by_whatsapp_as_before(env):
    assert env.c.get(f"{API}/tickets/channel").json()["phone_verify"] == {"required": False}
    c = contact(env)
    assert (c["phone_verify"], c["phone_verify_required"], c["phone_confirmed"]) == (False, False, False)
    t = env.s4.ticket()
    r = env.s4.assign_contact(t["id"])
    assert r.status_code == 200 and r.json()["messages"][0]["channel"] == "whatsapp", r.text


# ---------------------------------------------------------------- negative first: every failed check is the same answer


def test_a_wrong_or_malformed_code_is_the_uniform_refusal_and_does_not_confirm(env):
    cid = env.s4.contact["id"]
    assert send(env).status_code == 200
    code = code_of(env, cid)
    r1, r2, r3 = check(env, other(code)), check(env, "12ab56"), check(env, "1234567")
    for r in (r1, r2, r3):
        uniform(r)
    assert r1.json()["user_message"] == r2.json()["user_message"] == r3.json()["user_message"]
    assert latest(env, cid)["attempts"] == 1, "a malformed value is not a guess; a wrong code is counted (and committed with the 422)"
    assert contact(env)["phone_confirmed"] is False


def test_an_expired_code_is_the_uniform_refusal(env):
    cid = env.s4.contact["id"]
    assert send(env).status_code == 200
    code = code_of(env, cid)
    with env.s4.db.connection() as conn:
        conn.execute("UPDATE ticket_phone_verifications SET expires_at = '2000-01-01T00:00:00Z' WHERE contact_id = ?", (cid,))
    uniform(check(env, code))
    assert contact(env)["phone_confirmed"] is False


def test_five_wrong_codes_end_the_code_even_the_right_one_is_refused_after(env):
    cid = env.s4.contact["id"]
    assert send(env).status_code == 200
    code = code_of(env, cid)
    for _ in range(phone_verify.MAX_ATTEMPTS):
        uniform(check(env, other(code)))
    uniform(check(env, code))
    row = latest(env, cid)
    assert row["attempts"] == phone_verify.MAX_ATTEMPTS and row["invalidated_at"] and contact(env)["phone_confirmed"] is False


def test_a_spent_code_cannot_be_replayed(env):
    cid = env.s4.contact["id"]
    assert send(env).status_code == 200
    code = code_of(env, cid)
    assert check(env, code).status_code == 200
    uniform(check(env, code))


def test_a_code_of_another_contact_never_confirms_this_one(env):
    vendor = env.s4.vendor["id"]
    assert send(env, vendor).status_code == 200
    uniform(check(env, code_of(env, vendor)))  # typed on the person's page: no live code there
    assert contact(env)["phone_confirmed"] is False and contact(env, vendor)["phone_confirmed"] is False


def test_a_code_sent_to_the_previous_number_confirms_nothing(env):
    cid = env.s4.contact["id"]
    assert send(env).status_code == 200
    code = code_of(env, cid)
    patch(env, cid, phone="050-000-0039")
    uniform(check(env, code))
    assert latest(env, cid)["invalidated_at"], "a number change kills the live code"
    assert contact(env)["phone_confirmed"] is False


def test_the_admin_side_can_never_verify_a_staff_members_number(env):
    assert set_mobile(env, "tom", TOM_PHONE).status_code == 200
    tom_cid = mine_row(env, "dev-tom")["id"]
    r = send(env, tom_cid)
    assert r.status_code == 409 and r.json()["code"] == "user_only", r.text
    r = check(env, "123456", tom_cid)
    assert r.status_code == 409 and r.json()["code"] == "user_only", r.text
    with env.s4.db.connection(mode="read") as conn:
        assert conn.execute("SELECT COUNT(*) FROM ticket_phone_verifications").fetchone()[0] == 0


def test_only_a_configurer_may_send_or_check_a_contacts_code(env):
    assert send(env, user="mona").status_code == 403
    assert check(env, "123456", user="mona").status_code == 403


def test_the_resend_cooldown_and_the_caps_are_one_uniform_refusal(env):
    cid = env.s4.contact["id"]
    assert send(env).status_code == 200
    r = send(env)
    assert r.status_code == 429 and r.json()["code"] == "code_rate_limited", r.text
    cooldown_message = r.json()["user_message"]
    for _ in range(phone_verify.PER_ROW_DAY - 1):
        cooled(env)
        assert send(env).status_code == 200
    cooled(env)
    r = send(env)
    assert r.status_code == 429 and r.json()["user_message"] == cooldown_message, "the per-day cap answers exactly like the cooldown"
    assert sum(1 for a in audits(env, "ticket.contact.phone_verify_send") if a["decision"] == "denied") == 2


def test_the_per_number_cap_holds_across_rows(env):
    other_row = env.s4.add_contact(display_name="יעל כהן").json()  # the same invented number as the default contact
    for i in range(phone_verify.PER_NUMBER_DAY):
        cooled(env)
        assert send(env, other_row["id"] if i % 2 else None).status_code == 200
    cooled(env)
    assert send(env).status_code == 429 and send(env, other_row["id"]).status_code == 429


def test_without_a_channel_or_a_number_the_send_says_unavailable(env):
    env.channel(whatsapp={"enabled": False})
    r = send(env)
    assert r.status_code == 409 and r.json()["code"] == "verify_unavailable", r.text
    env.channel(whatsapp={"enabled": True})
    no_phone = env.s4.add_contact(display_name="בלי טלפון", phone=None, preferred_channel="manual").json()
    assert send(env, no_phone["id"]).status_code == 409


# ---------------------------------------------------------------- the manager's direct mark (verification OFF) and its refusal (ON)


def test_off_the_manager_marks_the_number_confirmed_with_an_audit_row(env):
    c = contact(env)
    token = c["phone_confirm_token"]
    assert token and len(token) == 16
    r = env.c.post(f"{CONTACTS}/{c['id']}/phone-confirm", json={"confirm": "0" * 16})
    assert r.status_code == 409 and r.json()["code"] == "number_changed"
    assert env.c.post(f"{CONTACTS}/{c['id']}/phone-confirm", json={"confirm": token}, headers=env.h("mona")).status_code == 403
    r = env.c.post(f"{CONTACTS}/{c['id']}/phone-confirm", json={"confirm": token})
    assert r.status_code == 200 and r.json()["confirmed"] is True and r.json()["confirmed_via"] == "manager", r.text
    rows = [a for a in audits(env, "ticket.contact.phone_confirm") if a["decision"] == "allowed"]
    assert len(rows) == 1 and PHONE_A_E164 not in json.dumps(rows) and "0031" not in json.dumps(rows)


def test_on_the_manager_mark_is_refused_and_an_earlier_mark_no_longer_counts(env):
    c = contact(env)
    assert env.c.post(f"{CONTACTS}/{c['id']}/phone-confirm", json={"confirm": c["phone_confirm_token"]}).status_code == 200
    patch(env, c["id"], phone_verify=True)
    c = contact(env)
    assert c["phone_verify_required"] is True and c["phone_confirmed"] is False, "a manager's mark does not count while a code is required"
    assert c["phone_confirm_token"] is None
    r = env.c.post(f"{CONTACTS}/{c['id']}/phone-confirm", json={"confirm": "a" * 16})
    assert r.status_code == 409 and r.json()["code"] == "code_required", r.text


# ---------------------------------------------------------------- ON: WhatsApp waits for the code; the code confirms


def test_on_a_link_does_not_go_to_an_unverified_number_until_the_code_is_typed_back(env, caplog):
    caplog.set_level(logging.DEBUG)
    require_installation(env)
    cid = env.s4.contact["id"]
    t = env.s4.ticket()
    r = env.s4.assign_contact(t["id"])
    assert r.status_code == 200, r.text
    assert all(m["channel"] != "whatsapp" for m in r.json()["messages"]), "no WhatsApp to a number nobody verified"
    assert send(env).status_code == 200
    calls_before = len(env.fake.calls)
    env.tick()
    assert len(env.fake.calls) == calls_before + 1
    call = env.fake.calls[-1]
    assert call["data"]["target"] == PHONE_A_E164
    text = call["data"]["message"]
    code = re.search(r"\b(\d{6})\b", text).group(1)
    assert code == code_of(env, cid)
    assert text.startswith("קוד לאימות מספר הטלפון:") and "https://" not in text and "מזגן" not in text, "the fixed text: no link, no ticket"
    with env.s4.db.connection(mode="read") as conn:
        row = dict(conn.execute("SELECT * FROM ticket_outbox WHERE purpose = 'phone_verify'").fetchone())
        pv = dict(conn.execute("SELECT * FROM ticket_phone_verifications WHERE contact_id = ?", (cid,)).fetchone())
    assert row["state"] == "sent" and row["ticket_id"] is None and row["use_key"] == "tickets.codes"
    assert code not in json.dumps(row) and code not in json.dumps(pv), "the digits are never stored"
    r = check(env, code)
    assert r.status_code == 200 and r.json()["confirmed"] is True and r.json()["confirmed_via"] == "code", r.text
    t2 = env.s4.ticket(title="נורה שרופה")
    r = env.s4.assign_contact(t2["id"])
    assert r.status_code == 200 and r.json()["messages"][0]["channel"] == "whatsapp", r.text
    blob = json.dumps(audits(env, "ticket.contact.phone_verify") + audits(env, "ticket.contact.phone_verify_send"), ensure_ascii=False)
    assert code not in blob and PHONE_A_E164 not in blob
    assert code not in caplog.text and PHONE_A_E164 not in caplog.text


def test_the_row_switch_alone_holds_back_only_that_row(env):
    patch(env, env.s4.contact["id"], phone_verify=True)
    t = env.s4.ticket()
    r = env.s4.assign_contact(t["id"])
    assert all(m["channel"] != "whatsapp" for m in r.json()["messages"])
    t2 = env.s4.ticket(title="דלת תקועה")
    r = env.s4.assign_contact(t2["id"], env.s4.vendor["id"])
    assert r.status_code == 200 and r.json()["messages"][0]["channel"] == "whatsapp", "another row is unaffected"


def test_a_number_change_after_the_code_needs_a_new_code(env):
    require_installation(env)
    cid = env.s4.contact["id"]
    assert send(env).status_code == 200
    assert check(env, code_of(env, cid)).status_code == 200
    patch(env, cid, phone="050-000-0038")
    assert contact(env)["phone_confirmed"] is False


def test_a_stored_message_template_can_never_replace_the_fixed_text(env):
    r = env.c.post(f"{API}/tickets/admin/message-templates", json={"purpose": "phone_verify", "lang": "he", "body": "קוד {code} http://x"})
    assert r.status_code == 422, r.text


# ---------------------------------------------------------------- staff members verify their own number in "החשבון שלי"


def mine_row(env, user_id: str) -> dict:
    with env.s4.db.connection(mode="read") as conn:
        return dict(conn.execute("SELECT * FROM ticket_contacts WHERE user_id = ? AND erased_at IS NULL", (user_id,)).fetchone())


def test_a_staff_member_with_verification_on_types_the_code_the_one_tap_confirm_is_refused(env):
    assert set_mobile(env, "tom", TOM_PHONE, phone_verify=True).status_code == 200
    me = mine(env, "tom")
    assert me["verify_required"] is True and me["confirm"] is None and me["confirmed"] is False
    r = env.c.put(f"{API}/tickets/me/staff-mobile", json={"confirm": "a" * 16}, headers=env.h("tom"))
    assert r.status_code == 409 and r.json()["code"] == "code_required", r.text
    r = env.c.post(f"{API}/tickets/me/phone-verify/send", headers=env.h("tom"))
    assert r.status_code == 200, r.text
    code = code_of(env, mine_row(env, "dev-tom")["id"])
    uniform(env.c.post(f"{API}/tickets/me/phone-verify/check", json={"code": other(code)}, headers=env.h("tom")))
    uniform(env.c.post(f"{API}/tickets/me/phone-verify/check", json={"code": code}, headers=env.h("gil")))  # gil has no row: no code
    r = env.c.post(f"{API}/tickets/me/phone-verify/check", json={"code": code}, headers=env.h("tom"))
    assert r.status_code == 200 and r.json()["confirmed"] is True and r.json()["confirmed_via"] == "code", r.text


def test_a_user_without_a_number_cannot_ask_for_a_code(env):
    r = env.c.post(f"{API}/tickets/me/phone-verify/send", headers=env.h("gil"))
    assert r.status_code == 409 and r.json()["code"] == "verify_unavailable"


def test_off_the_manager_may_mark_a_staff_number_and_the_user_is_told(env):
    assert set_mobile(env, "tom", TOM_PHONE).status_code == 200
    depts = env.c.get(f"{API}/tickets/admin/departments").json()["departments"]
    tom = next(m for d in depts for m in d["members"] if m["id"] == "dev-tom")
    assert tom["mobile_confirmed"] is False and tom["verify_required"] is False and tom["mobile_confirm"]
    r = env.c.post(f"{CONTACTS}/{tom['contact_id']}/phone-confirm", json={"confirm": tom["mobile_confirm"]})
    assert r.status_code == 200 and r.json()["confirmed_via"] == "manager", r.text
    assert mine(env, "tom")["confirmed"] is True
    with env.s4.db.connection(mode="read") as conn:
        told = conn.execute("SELECT COUNT(*) FROM notifications n JOIN notification_recipients r ON r.notification_id = n.id "
                            "WHERE n.source = 'ticket.staff_mobile' AND r.user_id = 'dev-tom'").fetchone()[0]
    assert told >= 1


# ---------------------------------------------------------------- NOTIFWA: notifications wait for the code too


def test_notifications_to_a_users_number_wait_for_the_code_while_verification_is_on(env):
    assert set_mobile(env, "tom", TOM_PHONE).status_code == 200
    with env.s4.db.connection() as conn:
        found = wa.raw_number(conn, "dev-tom")
        wa.set_opt_in(conn, "dev-tom", found.digits)
        assert wa.resolve_number(conn, "dev-tom").consent == "granted", "off: unchanged"
    require_installation(env)
    with env.s4.db.connection(mode="read") as conn:
        assert wa.resolve_number(conn, "dev-tom").consent == "declined"
        assert wa.my_view(conn, "dev-tom")["verify_required"] is True
    me = env.c.get(f"{API}/me/notify-whatsapp", headers=env.h("tom")).json()
    r = env.c.put(f"{API}/me/notify-whatsapp", json={"opted_in": True, "confirm": me["confirm"]}, headers=env.h("tom"))
    assert r.status_code == 409 and r.json()["code"] == "verify_required", r.text
    assert env.c.post(f"{API}/tickets/me/phone-verify/send", headers=env.h("tom")).status_code == 200
    code = code_of(env, mine_row(env, "dev-tom")["id"])
    assert env.c.post(f"{API}/tickets/me/phone-verify/check", json={"code": code}, headers=env.h("tom")).status_code == 200
    with env.s4.db.connection(mode="read") as conn:
        assert wa.resolve_number(conn, "dev-tom").consent == "granted"


# ---------------------------------------------------------------- release 2.6.3, delta review N-1 (lead decision): staff rows are stricter


def _tom_member(env) -> dict:
    depts = env.c.get(f"{API}/tickets/admin/departments").json()["departments"]
    return next(m for d in depts for m in d["members"] if m["id"] == "dev-tom")


def test_n1_a_tickets_configurer_cannot_mark_a_staff_members_number(env, settings):
    from conftest import bind

    bind(env.c, settings, "ruth", "tickets_configure", "installation", "*")
    assert set_mobile(env, "tom", TOM_PHONE).status_code == 200
    tom = _tom_member(env)
    r = env.c.post(f"{CONTACTS}/{tom['contact_id']}/phone-confirm", json={"confirm": tom["mobile_confirm"]}, headers=env.h("ruth"))
    assert r.status_code == 403, r.text
    assert mine(env, "tom")["confirmed"] is False, "the staff links still wait for the user's own confirmation"
    denied = [a for a in audits(env, "ticket.contact.phone_confirm") if a["decision"] == "denied"]
    assert denied and denied[-1]["reason"] == "staff_needs_system_configure"
    # a vendor / contact row keeps the tickets.configure mark (as built)
    c = contact(env)
    r = env.c.post(f"{CONTACTS}/{c['id']}/phone-confirm", json={"confirm": c["phone_confirm_token"]}, headers=env.h("ruth"))
    assert r.status_code == 200 and r.json()["confirmed_via"] == "manager", r.text


def test_n1_the_persons_own_switch_blocks_the_mark_even_for_a_system_administrator(env):
    require_installation(env, False)
    assert set_mobile(env, "tom", TOM_PHONE, phone_verify=True).status_code == 200
    tom = _tom_member(env)
    token = tom["mobile_confirm"] or "a" * 16
    r = env.c.post(f"{CONTACTS}/{tom['contact_id']}/phone-confirm", json={"confirm": token})
    assert r.status_code == 409 and r.json()["code"] == "code_required", r.text
    assert mine(env, "tom")["confirmed"] is False
