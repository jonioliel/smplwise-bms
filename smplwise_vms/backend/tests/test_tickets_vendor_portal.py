"""VPORTAL (owner-approved design 2026-10-16): the vendor portal - a NEW PUBLIC AUTHENTICATION SURFACE on the public listener
(services/tickets/vendor_portal.py, public_portal.py, the edge's cookie exception in public_http.py, the any-case root in
public_prefix.py; docs/changes/CR-VENDOR-PORTAL.md).

NEGATIVE CASES FIRST: the switch off (default) answers the uniform 404 everywhere and changes nothing; no enumeration (a known and an
unknown number get byte-identical answers, the lookup runs after the answer, a code row exists for both, every failed verification
is the same 422); brute force (5 guesses, expiry, single use, per-number caps that never answer differently); scope (a session sees
only its number, item ids are per session, tampered / doubled / expired cookies are the uniform 404, no renewal); fail closed (staff,
erased, inactive, unverified numbers, a changed number); no sensitive data (allow-listed keys, never a payment reference); the cookie's
attributes and the edge never passing it elsewhere. Then the happy path, the window setting, the logo. Fake ha-whatsapp only; every
name and number is invented (the 050-000-xxxx block)."""
from __future__ import annotations

import io
import json
import logging
import re
import time
import uuid

import pytest
from PIL import Image

from smplwise.services.tickets import codes as codes_mod, handler_links, vendor_portal
from smplwise.services.tickets.keyring import KEYS
from smplwise.services.tickets.public_http import PORTAL_COOKIE, UNIFORM_404
from test_tickets_s5b_channel import env  # noqa: F401 - the slice 5b environment (fake ha-whatsapp, mapped account, WhatsApp on)
from tickets_s4_world import PHONE_A, PHONE_A_E164, Clock

API = "/api/v1"
UNKNOWN = "050-000-0099"
PORTAL = ("/t/api/portal/config", "/t/api/portal/items")
PORTAL_POST = {"/t/api/portal/start": {"phone": PHONE_A}, "/t/api/portal/verify": {"phone": PHONE_A, "code": "123456"},
               "/t/api/portal/open": {"item": "a" * 24}, "/t/api/portal/logout": {}}


# ---------------------------------------------------------------- helpers


def settings_put(env, **body):
    rev = env.c.get(f"{API}/tickets/settings").json()["revision"]
    return env.c.put(f"{API}/tickets/settings", json={"revision": rev, **body})


def portal_on(env, on: bool = True, **extra) -> dict:
    r = settings_put(env, vendor_portal={"enabled": on, **extra})
    assert r.status_code == 200, r.text
    return r.json()


def public(env, clock: Clock | None = None, peer: str = "198.51.100.7"):
    c, app = env.s4.public(clock or Clock(time.time()), peer=peer)
    return c, app


def confirm(env, contact_id: str | None = None, via: str | None = "code") -> None:
    """How the row's CURRENT number was confirmed (0091): 'code' / 'user' / 'manager', or None = never confirmed."""
    at = handler_links.iso(handler_links.now_utc()) if via else None
    with env.s4.db.connection() as conn:
        conn.execute("UPDATE ticket_contacts SET phone_confirmed_at = ?, phone_confirmed_via = ? WHERE id = ?",
                     (at, via, contact_id or env.s4.contact["id"]))


def assigned(env, contact_id: str | None = None, title: str = "מזגן לא מקרר", confirmed: str | None = "code"):
    """A request assigned to the contact; its number confirmed by code by default (review F1: the portal serves only a number its
    owner proved, whatever the installation's number-verification switch says)."""
    t = env.s4.ticket(title=title)
    r = env.s4.assign_contact(t["id"], contact_id=contact_id)
    assert r.status_code == 200, r.text
    confirm(env, contact_id, confirmed)
    return t


def rows(env, digits: str = PHONE_A_E164) -> list[dict]:
    pk = vendor_portal.number_key(digits)
    assert pk is not None
    with env.s4.db.connection(mode="read") as conn:
        return [dict(r) for r in conn.execute("SELECT * FROM ticket_portal_codes WHERE phone_key = ? ORDER BY created_at, rowid", (pk[0],))]


def code_of(env, digits: str = PHONE_A_E164) -> str:
    row = rows(env, digits)[-1]
    return codes_mod.derive_code(KEYS.get(row["key_id"]), row["id"])


def other(code: str) -> str:
    return f"{(int(code) + 1) % 10 ** 6:06d}"


def portal_msgs(env) -> list:
    return [r for r in env.rows() if r.purpose == "phone_verify"]


def start(c, phone: str = PHONE_A):
    return c.post("/t/api/portal/start", json={"phone": phone})


def verify(c, code: str, phone: str = PHONE_A):
    r = c.post("/t/api/portal/verify", json={"phone": phone, "code": code})
    c.cookies.clear()  # the tests send the cookie themselves (httpx would keep a Secure cookie for an http test host)
    return r


def session_of(r) -> str:
    m = re.search(rf"{re.escape(PORTAL_COOKIE)}=([A-Za-z0-9_-]+);", r.headers.get("set-cookie", ""))
    assert m, r.headers
    return m.group(1)


def jar(value: str) -> dict[str, str]:
    return {"cookie": f"{PORTAL_COOKIE}={value}"}


def signed_in(env, c, phone: str = PHONE_A, digits: str = PHONE_A_E164) -> str:
    assert start(c, phone).status_code == 202
    r = verify(c, code_of(env, digits), phone)
    assert r.status_code == 200, r.text
    return session_of(r)


def back(env, minutes: int = 2) -> None:
    """Step past the 60 s cooldown: the code rows' times move back (the module's clock is the wall clock / the public app's clock)."""
    import datetime as dt

    old = handler_links.iso(handler_links.now_utc() - dt.timedelta(minutes=minutes))
    with env.s4.db.connection() as conn:
        conn.execute("UPDATE ticket_portal_codes SET created_at = ? WHERE created_at > ?", (old, old))


def uniform_404(r) -> None:
    assert r.status_code == 404 and r.content == UNIFORM_404, (r.status_code, r.text)


def code_invalid(r) -> None:
    assert r.status_code == 422 and r.json() == {"code": "code_invalid"}, r.text


# ---------------------------------------------------------------- 1. OFF by default: nothing changes


def test_the_portal_is_off_by_default_and_every_portal_route_is_the_uniform_404(env):
    doc = env.c.get(f"{API}/tickets/settings").json()
    assert doc["vendor_portal"] == {"enabled": False, "closed_months": 2, "require_confirmed_number": True,
                                    "rfqs": False, "technician_requests": False} and doc["brand"] == {"logo": ""}  # + VPORTALRFQ (OFF)
    assigned(env)
    c, _ = public(env)
    for path in PORTAL:
        uniform_404(c.get(path))
    for path, body in PORTAL_POST.items():
        uniform_404(c.post(path, json=body))
    assert portal_msgs(env) == [] and rows(env) == [], "nothing is looked up, written or sent while the switch is off"


def test_with_the_portal_off_the_bare_and_any_case_root_stay_404_as_before(env):
    c, _ = public(env)
    for path in ("/support", "/Support", "/SUPPORT/", "/t"):
        uniform_404(c.get(path))
    assert c.get("/t/").status_code == 200, "the handler page's shell is unchanged"


def test_the_switch_and_the_window_are_validated_and_need_system_configure(env):
    for bad in ({"enabled": "yes"}, {"closed_months": 0}, {"closed_months": 25}, {"closed_months": "2"}, {"other": 1}):
        assert settings_put(env, vendor_portal=bad).status_code == 422, bad
    rev = env.c.get(f"{API}/tickets/settings").json()["revision"]
    r = env.c.put(f"{API}/tickets/settings", json={"revision": rev, "vendor_portal": {"enabled": True}}, headers=env.h("tom"))
    assert r.status_code == 403
    assert settings_put(env, brand={"logo": "0" * 16}).status_code == 422, "the logo stamp is never set through the settings document"


# ---------------------------------------------------------------- 2. no enumeration


def test_a_known_and_an_unknown_number_get_byte_identical_answers(env):
    portal_on(env)
    assigned(env)
    c, _ = public(env)
    known, unknown = start(c, PHONE_A), start(c, UNKNOWN)
    assert known.status_code == unknown.status_code == 202
    assert known.content == unknown.content == b'{"code":"sent_if_registered"}'
    assert [(k, v) for k, v in known.headers.items() if k != "date"] == [(k, v) for k, v in unknown.headers.items() if k != "date"]
    assert len(portal_msgs(env)) == 1, "only the known number got a message"
    assert rows(env, "972500000099")[0]["contact_id"] is None, "a code row exists for the unknown number too (nothing sent)"


def test_the_answer_does_not_wait_for_the_lookup_a_failing_lookup_still_answers_the_same(env, monkeypatch):
    portal_on(env)
    order: list[str] = []

    def boom(conn, digits, now, **kw):
        order.append("lookup")
        raise RuntimeError("database unavailable")

    monkeypatch.setattr(vendor_portal, "request_code", boom)
    c, _ = public(env)
    r = start(c)
    assert r.status_code == 202 and r.json() == {"code": "sent_if_registered"} and order == ["lookup"], "the work ran as a background task"


def test_every_failed_verification_is_the_same_refusal_known_or_unknown(env):
    portal_on(env)
    assigned(env)
    c, _ = public(env)
    start(c, PHONE_A)
    start(c, UNKNOWN)
    answers = [verify(c, other(code_of(env)), PHONE_A), verify(c, "000000", UNKNOWN), verify(c, "123456", "050-000-0098"),
               verify(c, "12ab56", PHONE_A), verify(c, "", PHONE_A), verify(c, "123456", "not a number")]
    for r in answers:
        code_invalid(r)
    assert len({(r.status_code, r.content) for r in answers}) == 1
    assert rows(env)[-1]["attempts"] == 1 and rows(env, "972500000099")[-1]["attempts"] == 1, "the same counting for both"


def test_a_malformed_number_is_422_by_its_shape_only(env):
    portal_on(env)
    c, _ = public(env)
    for bad in ("abc", "12", "+" + "1" * 20, "050-000-00x1"):
        r = start(c, bad)
        assert r.status_code == 422 and r.json()["fields"] == [{"field": "phone", "code": "format"}], bad
    assert c.post("/t/api/portal/start", json={"phone": PHONE_A, "extra": 1}).status_code == 422
    assert c.post("/t/api/portal/start", content=b"phone=1", headers={"content-type": "application/x-www-form-urlencoded"}).status_code == 415


@pytest.mark.parametrize("typed", ["050-000-0031", "0500000031", "+972 50 000 0031", "+972-50-0000031", "00972500000031", "972500000031",
                                   "+972 050 000 0031", "(050) 000-0031", "٠٥٠٠٠٠٠٠٣١"])
def test_israeli_formats_normalise_to_one_canonical_number(typed):
    assert vendor_portal.canonical_phone(typed) == PHONE_A_E164


# ---------------------------------------------------------------- 3. brute force and code rules


def test_five_wrong_codes_end_the_code_and_the_right_one_is_refused_after(env):
    portal_on(env)
    assigned(env)
    c, _ = public(env)
    start(c)
    code = code_of(env)
    for _ in range(vendor_portal.MAX_ATTEMPTS):
        code_invalid(verify(c, other(code)))
    code_invalid(verify(c, code))
    row = rows(env)[-1]
    assert row["attempts"] == vendor_portal.MAX_ATTEMPTS and row["invalidated_at"] and row["consumed_at"] is None


def test_a_malformed_code_is_not_a_guess(env):
    portal_on(env)
    assigned(env)
    c, _ = public(env)
    start(c)
    for bad in ("12ab56", "1234567", "", "12 34 5"):
        code_invalid(verify(c, bad))
    assert rows(env)[-1]["attempts"] == 0
    assert verify(c, code_of(env)).status_code == 200


def test_an_expired_or_spent_code_is_refused(env):
    portal_on(env)
    assigned(env)
    c, _ = public(env)
    start(c)
    code = code_of(env)
    with env.s4.db.connection() as conn:
        conn.execute("UPDATE ticket_portal_codes SET expires_at = '2000-01-01T00:00:00Z'")
    code_invalid(verify(c, code))
    back(env)
    start(c)
    code = code_of(env)
    assert verify(c, code).status_code == 200
    code_invalid(verify(c, code))


def test_a_new_code_ends_the_older_one(env):
    portal_on(env)
    assigned(env)
    c, _ = public(env)
    start(c)
    first = code_of(env)
    back(env)
    start(c)
    code_invalid(verify(c, first))
    assert verify(c, code_of(env)).status_code == 200


def test_the_per_number_caps_answer_the_same_and_send_nothing_more(env):
    portal_on(env)
    assigned(env)
    c, _ = public(env)
    start(c)
    again = start(c)  # inside the 60 s cooldown
    assert again.status_code == 202 and again.json() == {"code": "sent_if_registered"}
    assert len(rows(env)) == 1 and len(portal_msgs(env)) == 1
    for _ in range(vendor_portal.PER_NUMBER_HOUR + 2):
        back(env)
        assert start(c).status_code == 202
    assert len(rows(env)) == vendor_portal.PER_NUMBER_HOUR and len(portal_msgs(env)) == vendor_portal.PER_NUMBER_HOUR


def test_the_client_network_is_rate_limited_before_anything_is_read(env):
    portal_on(env)
    c, _ = public(env, peer="203.0.113.9")
    answers = [start(c, f"050-000-01{i:02d}").status_code for i in range(12)]
    assert answers[:10] == [202] * 10 and answers[10:] == [429, 429]
    assert c.post("/t/api/portal/start", json={"phone": PHONE_A}).headers.get("retry-after")


def test_the_installation_daily_message_cap_holds_whoever_asks(env, monkeypatch):
    portal_on(env)
    assigned(env)
    monkeypatch.setattr(vendor_portal, "SENT_PER_DAY", 0)
    c, _ = public(env)
    assert start(c).status_code == 202
    assert portal_msgs(env) == [] and rows(env)[-1]["contact_id"] is None


# ---------------------------------------------------------------- 4. who may receive a code (fail closed)


def test_a_number_with_nothing_to_show_receives_nothing(env):
    portal_on(env)
    c, _ = public(env)
    assert start(c).status_code == 202
    assert portal_msgs(env) == [], "the contact exists but has no request: no code (cost and exposure)"


def test_an_inactive_or_erased_row_receives_nothing(env):
    portal_on(env)
    assigned(env)
    with env.s4.db.connection() as conn:
        conn.execute("UPDATE ticket_contacts SET active = 0 WHERE id = ?", (env.s4.contact["id"],))
    c, _ = public(env)
    start(c)
    assert portal_msgs(env) == []


def test_a_staff_row_linked_to_a_user_never_uses_the_portal(env):
    portal_on(env)
    assigned(env)
    with env.s4.db.connection() as conn:
        conn.execute("UPDATE ticket_contacts SET user_id = 'dev-tom' WHERE id = ?", (env.s4.contact["id"],))
    c, _ = public(env)
    start(c)
    assert portal_msgs(env) == []


def test_while_number_verification_is_required_an_unverified_number_receives_nothing(env):
    portal_on(env)
    assigned(env, confirmed="manager")  # a manager's mark never counts while verification is required
    env.channel(phone_verify={"required": True})
    c, _ = public(env)
    start(c)
    assert portal_msgs(env) == [] and rows(env)[-1]["contact_id"] is None


def test_without_a_whatsapp_channel_nothing_is_sent_and_the_answer_is_the_same(env):
    portal_on(env)
    assigned(env)
    env.channel(whatsapp={"enabled": False})
    c, _ = public(env)
    r = start(c)
    assert r.status_code == 202 and r.json() == {"code": "sent_if_registered"} and portal_msgs(env) == []


def test_a_code_sent_to_an_old_number_signs_nobody_in(env):
    portal_on(env)
    assigned(env)
    c, _ = public(env)
    start(c)
    code = code_of(env)
    r = env.c.patch(f"{API}/tickets/contacts/{env.s4.contact['id']}", json={"revision": env.s4.contact_rev(env.s4.contact["id"]), "phone": "050-000-0077"})
    assert r.status_code == 200, r.text
    code_invalid(verify(c, code))


# ---------------------------------------------------------------- 4b. the 2.6.4 review (private RELEASE_264_REVIEW_VPORTAL F1-F7)


def test_f1_an_unconfirmed_number_receives_no_code_even_while_number_verification_is_off(env):
    portal_on(env)
    assigned(env, confirmed=None)
    assert env.c.get(f"{API}/tickets/settings").json()["phone_verify"]["required"] is False
    c, _ = public(env)
    known, unknown = start(c, PHONE_A), start(c, UNKNOWN)
    assert known.content == unknown.content and known.status_code == unknown.status_code == 202
    assert [(k, v) for k, v in known.headers.items() if k != "date"] == [(k, v) for k, v in unknown.headers.items() if k != "date"]
    assert portal_msgs(env) == [], "a number nobody proved is treated exactly like an unknown number"
    assert rows(env)[-1]["contact_id"] is None and rows(env, "972500000099")[-1]["contact_id"] is None
    code_invalid(verify(c, code_of(env)))


def test_f1_a_managers_mark_is_not_enough_a_code_or_the_person_themself_is(env):
    portal_on(env)
    assigned(env, confirmed="manager")
    c, _ = public(env)
    start(c)
    assert portal_msgs(env) == []
    for via in ("user", "code"):
        confirm(env, via=via)
        back(env)
        start(c)
    assert len(portal_msgs(env)) == 2


def test_f1_the_rule_is_on_by_default_system_configure_audited_and_switchable_from_a_remote_session(env, monkeypatch):
    from smplwise.routers import tickets_admin

    assert settings_put(env, vendor_portal={"require_confirmed_number": "no"}).status_code == 422
    rev = env.c.get(f"{API}/tickets/settings").json()["revision"]
    r = env.c.put(f"{API}/tickets/settings", json={"revision": rev, "vendor_portal": {"require_confirmed_number": False}}, headers=env.h("tom"))
    assert r.status_code == 403
    monkeypatch.setattr(tickets_admin, "is_remote", lambda request: True)  # owner 2026-10-17: the portal keys are NOT local-only
    doc = portal_on(env, require_confirmed_number=False)
    assert doc["vendor_portal"] == {"enabled": True, "closed_months": 2, "require_confirmed_number": False, "rfqs": False,
                                    "technician_requests": False}  # + VPORTALRFQ (OFF)
    with env.s4.db.connection(mode="read") as conn:
        details = [json.loads(x[0]) for x in conn.execute("SELECT details_json FROM audit_log WHERE action = 'tickets.settings.update'")]
    assert any("vendor_portal.require_confirmed_number" in d.get("changed", []) for d in details)
    assigned(env, confirmed=None)
    c, _ = public(env)
    start(c)
    assert len(portal_msgs(env)) == 1, "switched off by the owner: an unconfirmed number is served as before"


def test_f2_the_sign_in_code_names_the_organisation_and_the_purpose_and_says_we_never_ask_for_it(env):
    portal_on(env)
    assigned(env)
    c, _ = public(env)
    start(c)
    code = code_of(env)
    env.tick()
    [call] = [x for x in env.fake.calls if code in x["data"]["message"]]
    text = call["data"]["message"]
    for part in ("מגדלי הדר", "אזור הספקים", "10 דקות", "לעולם לא נבקש"):
        assert part in text, part
    assert "לאימות מספר הטלפון" not in text, "not the generic number-verification text"


def test_f3_the_number_dependent_lookup_runs_on_a_read_connection_before_the_write_lock(env, monkeypatch):
    portal_on(env)
    assigned(env)
    seen: list[int] = []
    real = vendor_portal.contacts_of

    def spy(conn, phone_key):
        seen.append(conn.execute("PRAGMA query_only").fetchone()[0])
        return real(conn, phone_key)

    monkeypatch.setattr(vendor_portal, "contacts_of", spy)
    c, _ = public(env)
    start(c)
    assert seen == [1] and len(portal_msgs(env)) == 1, "who the number belongs to is read outside the write transaction"


def test_f4_a_live_portal_code_and_session_keep_their_module_key(env):
    from smplwise.services.tickets import store_links

    portal_on(env)
    now = handler_links.now_utc()
    import datetime as dt

    later = handler_links.iso(now + dt.timedelta(minutes=10))
    with env.s4.db.connection() as conn:
        conn.execute("INSERT INTO ticket_portal_codes(id, phone_key, key_id, code_hash, created_at, expires_at) VALUES ('c1', 'pk', 'old-code-key', 'h', ?, ?)",
                     (handler_links.iso(now), later))
        conn.execute("INSERT INTO ticket_portal_sessions(id_hash, phone_key, key_id, created_at, expires_at) VALUES ('s1', 'pk', 'old-session-key', ?, ?)",
                     (handler_links.iso(now), later))
        conn.execute("INSERT INTO ticket_portal_codes(id, phone_key, key_id, code_hash, created_at, expires_at, consumed_at) VALUES ('c2', 'pk', 'spent-key', 'h', ?, ?, ?)",
                     (handler_links.iso(now), later, handler_links.iso(now)))
        in_use = store_links.key_ids_in_use(conn)
    assert {"old-code-key", "old-session-key"} <= in_use and "spent-key" not in in_use


def test_f5_open_checks_the_session_before_the_body_and_logout_answers_alike(env):
    portal_on(env)
    assigned(env)
    c, _ = public(env)
    for body in ({"item": 5}, {"nope": 1}, {}):
        uniform_404(c.post("/t/api/portal/open", json=body))
    value = signed_in(env, c)
    assert c.post("/t/api/portal/open", json={"nope": 1}, headers=jar(value)).status_code == 422, "with a session the body is judged"
    answers = [c.post("/t/api/portal/logout", json={}, headers=h) for h in ({}, jar("x" * 43), jar(value), jar(value))]
    assert len({(r.status_code, r.content, r.headers.get("set-cookie")) for r in answers}) == 1
    assert answers[0].status_code == 200


def test_f6_a_stranger_on_another_network_cannot_burn_the_vendors_code(env):
    portal_on(env)
    assigned(env)
    c, _ = public(env)
    stranger, _ = public(env, peer="203.0.113.9")
    start(c)
    code = code_of(env)
    for _ in range(vendor_portal.MAX_ATTEMPTS + 2):
        code_invalid(verify(stranger, other(code)))
    code_invalid(verify(stranger, code))  # the right code from another network signs nobody in either
    assert rows(env)[-1]["attempts"] == 0 and rows(env)[-1]["invalidated_at"] is None
    assert verify(c, code).status_code == 200, "the vendor on the requesting network still signs in"


def test_f6_wrong_guesses_from_the_requesting_network_still_end_the_code(env):
    portal_on(env)
    assigned(env)
    c, _ = public(env)
    start(c)
    code = code_of(env)
    for _ in range(vendor_portal.MAX_ATTEMPTS):
        code_invalid(verify(c, other(code)))
    code_invalid(verify(c, code))


@pytest.mark.parametrize("typed,digits", [("+972 050 000 0031", "972500000031"), ("+972-0-50-0000031", "972500000031"),
                                          ("009720500000031", "972500000031"), ("+972 03 123 4567", "97231234567")])
def test_f7_the_directory_itself_drops_the_trunk_zero_after_the_country_code(typed, digits):
    from smplwise.services.tickets import contacts

    assert contacts.normalize_phone(typed) == digits
    assert vendor_portal.canonical_phone(typed) == digits


def test_f7_a_contact_saved_with_the_slip_is_reachable_through_the_portal(env):
    portal_on(env)
    r = env.c.patch(f"{API}/tickets/contacts/{env.s4.contact['id']}", json={"revision": env.s4.contact_rev(env.s4.contact["id"]), "phone": "+972 050 000 0031"})
    assert r.status_code == 200, r.text
    assigned(env)
    c, _ = public(env)
    start(c, "050-000-0031")
    assert len(portal_msgs(env)) == 1


# ---------------------------------------------------------------- 5. the session: scope, cookie, expiry


def test_the_cookie_is_secure_httponly_samesite_strict_scoped_to_the_portal_api(env):
    portal_on(env)
    assigned(env)
    c, _ = public(env)
    start(c)
    r = verify(c, code_of(env))
    sc = r.headers["set-cookie"]
    assert sc.startswith(f"{PORTAL_COOKIE}=")
    for part in ("Path=/t/api/portal", "Max-Age=1800", "Secure", "HttpOnly", "SameSite=Strict"):
        assert part in sc, part
    assert "Domain" not in sc and r.json() == {"ok": True, "expires_in_s": 1800}
    value = session_of(r)
    with env.s4.db.connection(mode="read") as conn:
        stored = [x[0] for x in conn.execute("SELECT id_hash FROM ticket_portal_sessions")]
    assert value not in stored and len(stored) == 1, "only the hash of the session value is stored"


def test_without_a_valid_cookie_everything_is_the_uniform_404(env):
    portal_on(env)
    assigned(env)
    c, _ = public(env)
    value = signed_in(env, c)
    tampered = value[:-1] + ("A" if value[-1] != "A" else "B")
    for headers in ({}, jar(tampered), jar("x" * 43), {"cookie": f"{PORTAL_COOKIE}={value}; {PORTAL_COOKIE}={tampered}"},
                    {"cookie": f"other={value}"}, {"x-ticket-session": value}, {"cookie": f"{PORTAL_COOKIE.lower()}={value}"}):
        uniform_404(c.get("/t/api/portal/items", headers=headers))
    assert c.get("/t/api/portal/items", headers=jar(value)).status_code == 200


def test_the_session_ends_after_30_minutes_and_is_never_extended(env):
    portal_on(env)
    assigned(env)
    clock = Clock(time.time())
    c, _ = public(env, clock)
    value = signed_in(env, c)
    clock.advance(29 * 60)
    r = c.get("/t/api/portal/items", headers=jar(value))
    assert r.status_code == 200 and 0 < r.json()["expires_in_s"] <= 60, "use does not renew it"
    clock.advance(2 * 60)
    uniform_404(c.get("/t/api/portal/items", headers=jar(value)))


def test_logout_revokes_the_session_and_clears_the_cookie(env):
    portal_on(env)
    assigned(env)
    c, _ = public(env)
    value = signed_in(env, c)
    r = c.post("/t/api/portal/logout", json={}, headers=jar(value))
    assert r.status_code == 200 and "Max-Age=0" in r.headers["set-cookie"]
    uniform_404(c.get("/t/api/portal/items", headers=jar(value)))


def test_a_session_sees_only_its_own_number_and_item_ids_do_not_cross_sessions(env):
    portal_on(env)
    mine = assigned(env, title="נזילה בחדר 7")
    theirs = assigned(env, contact_id=env.s4.vendor["id"], title="דלת תקועה")
    c, _ = public(env)
    a = signed_in(env, c)
    back(env)
    b = signed_in(env, c, phone="+972 50 000 0032", digits="972500000032")
    ia = c.get("/t/api/portal/items", headers=jar(a)).json()["items"]
    ib = c.get("/t/api/portal/items", headers=jar(b)).json()["items"]
    assert [i["number"] for i in ia] == [mine["number"]] and [i["number"] for i in ib] == [theirs["number"]]
    uniform_404(c.post("/t/api/portal/open", json={"item": ia[0]["id"]}, headers=jar(b)))
    uniform_404(c.post("/t/api/portal/open", json={"item": "0" * 24}, headers=jar(a)))
    uniform_404(c.post("/t/api/portal/open", json={"item": "x"}, headers=jar(a)))


def test_a_changed_number_ends_what_a_live_session_shows(env):
    portal_on(env)
    assigned(env)
    c, _ = public(env)
    value = signed_in(env, c)
    assert len(c.get("/t/api/portal/items", headers=jar(value)).json()["items"]) == 1
    r = env.c.patch(f"{API}/tickets/contacts/{env.s4.contact['id']}", json={"revision": env.s4.contact_rev(env.s4.contact["id"]), "phone": "050-000-0077"})
    assert r.status_code == 200
    assert c.get("/t/api/portal/items", headers=jar(value)).json()["items"] == []


def test_the_portal_switched_off_ends_live_sessions_at_once(env):
    portal_on(env)
    assigned(env)
    c, _ = public(env)
    value = signed_in(env, c)
    portal_on(env, False)
    uniform_404(c.get("/t/api/portal/items", headers=jar(value)))


def test_the_edge_never_passes_the_cookie_elsewhere_nor_lets_another_route_set_one(env):
    portal_on(env)
    t = assigned(env)
    c, _ = public(env)
    value = signed_in(env, c)
    token = env.s4.token_of(t["id"])
    r = c.get("/t/api/ticket", headers={"x-ticket-token": token, **jar(value)})
    assert r.status_code == 200 and "set-cookie" not in r.headers
    assert "set-cookie" not in c.get("/t/api/portal/items", headers=jar(value)).headers
    assert "set-cookie" not in start(c).headers


# ---------------------------------------------------------------- 6. no sensitive data


def _money_rows(env, ticket_id: str) -> str:
    asg = env.s4.link_row(ticket_id)["assignment_id"]
    now = handler_links.iso(handler_links.now_utc())
    with env.s4.db.connection() as conn:
        dept = conn.execute("SELECT department_id FROM tickets WHERE id = ?", (ticket_id,)).fetchone()[0]
        conn.execute("INSERT INTO ticket_quotes(id, ticket_id, assignment_id, contact_id, version, source, state, currency, vat_mode, vat_rate_bp, lines_json, "
                     "labor_minor, parts_minor, travel_minor, other_minor, subtotal_minor, vat_minor, total_minor, approved_total_minor, note, vendor_ref, "
                     "decision_internal_note, created_by_kind, created_by, created_at, updated_at) "
                     "VALUES (?, ?, ?, ?, 1, 'vendor', 'approved', 'ILS', 'excluded', 1800, '[]', 10000, 0, 0, 0, 10000, 1800, 11800, 11000, "
                     "'הערה פנימית של הספק', 'Q-77', 'פנימי: לא לשתף', 'contact', ?, ?, ?)",
                     (uuid.uuid4().hex, ticket_id, asg, env.s4.contact["id"], env.s4.contact["id"], now, now))
        conn.execute("INSERT INTO ticket_cost_claims(id, ticket_id, department_id, assignment_id, contact_id, required, status, currency, approved_total_minor, "
                     "paid_at, paid_by, payment_ref, payment_date, snapshot_json, created_at, updated_at) "
                     "VALUES (?, ?, ?, ?, ?, 0, 'paid', 'ILS', 11000, ?, 'dev-joni', 'BANKREF-4455-9911', '2026-10-15', '{}', ?, ?)",
                     (uuid.uuid4().hex, ticket_id, dept, asg, env.s4.contact["id"], now, now, now))
    return asg


def test_items_carry_only_allow_listed_keys_amounts_and_paid_never_a_payment_reference_or_a_number(env):
    portal_on(env)
    t = assigned(env, title="החלפת מדחס")
    _money_rows(env, t["id"])
    c, _ = public(env)
    r = c.get("/t/api/portal/items", headers=jar(signed_in(env, c)))
    body = r.json()
    item = body["items"][0]
    assert all(vendor_portal.sanitized(i) for i in body["items"])
    assert set(item) == vendor_portal.ITEM_KEYS
    assert item["quote"] == {"state": "approved", "total_minor": 11000, "currency": "ILS"}
    assert item["demand"] == {"status": "paid", "total_minor": 11000, "currency": "ILS", "paid": True, "no_charge": False}
    assert item["title"] == "החלפת מדחס" and item["state"] == "open" and item["can_open"] is True
    text = r.text
    for secret in ("BANKREF", "4455", "2026-10-15", "Q-77", "פנימי", "הערה פנימית", PHONE_A_E164, "050-000", "dev-joni", env.s4.contact["id"]):
        assert secret not in text, secret
    assert set(body) == {"organization", "logo", "lang", "dir", "labels", "time_zone", "theme", "closed_months", "expires_in_s", "items",
                         "features"}  # + VPORTALRFQ: which extra sections exist (both OFF by default)
    assert body["features"] == {"rfqs": False, "techs": False}


def test_the_module_never_collects_bank_details():
    import pathlib

    root = pathlib.Path(vendor_portal.__file__).resolve().parents[2]
    pattern = re.compile(r"\b(iban|bank_account|account_number|swift|routing_number|bank_branch)\b", re.I)
    hits = [str(p) for p in (root / "migrations").glob("*.sql") if pattern.search(p.read_text(encoding="utf-8"))]
    hits += [str(p) for p in (root / "services" / "tickets").glob("*.py") if pattern.search(p.read_text(encoding="utf-8"))]
    assert hits == []


# ---------------------------------------------------------------- 7. the happy path


def test_sign_in_list_and_open_the_existing_handler_page(env, caplog):
    portal_on(env)
    t = assigned(env, title="מזגן לא מקרר - חדר 102")
    c, _ = public(env)
    caplog.set_level(logging.DEBUG)
    assert start(c).status_code == 202
    msgs = portal_msgs(env)
    assert len(msgs) == 1 and msgs[0].contact_id == env.s4.contact["id"] and msgs[0].channel == "whatsapp"
    code = code_of(env)
    env.tick()
    call = [x for x in env.fake.calls if code in x["data"]["message"]]
    assert len(call) == 1 and call[0]["data"]["target"] == PHONE_A_E164, "the fixed code message went to the number on file"
    r = verify(c, code)
    value = session_of(r)
    items = c.get("/t/api/portal/items", headers=jar(value)).json()
    assert items["organization"] == "מגדלי הדר" and items["closed_months"] == 2 and items["lang"] == "he"
    [item] = items["items"]
    assert (item["number"], item["status"], item["state"]) == (t["number"], "assigned", "open")
    o = c.post("/t/api/portal/open", json={"item": item["id"]}, headers=jar(value))
    assert o.status_code == 200 and o.json() == {"token": env.s4.token_of(t["id"]), "number": t["number"]}
    assert c.get("/t/api/ticket", headers={"x-ticket-token": o.json()["token"]}).status_code == 200, "the existing handler page, unchanged"
    logged = "\n".join(r.getMessage() for r in caplog.records)
    for secret in (code, PHONE_A_E164, value, o.json()["token"]):
        assert secret not in logged
    with env.s4.db.connection(mode="read") as conn:
        out_rows = [dict(x) for x in conn.execute("SELECT * FROM ticket_outbox WHERE purpose = 'phone_verify'")]
        audit_rows = [dict(x) for x in conn.execute("SELECT * FROM audit_log WHERE action LIKE 'ticket.portal.%'")]
    assert out_rows and code not in json.dumps(out_rows, default=str), "W9: the digits are never in the outbox row"
    assert {a["action"] for a in audit_rows} == {"ticket.portal.code_send", "ticket.portal.sign_in", "ticket.portal.open"}
    dumped = json.dumps(audit_rows, default=str, ensure_ascii=False)
    for secret in (code, PHONE_A_E164, value, o.json()["token"]):
        assert secret not in dumped


def test_a_queued_message_renders_its_code_after_the_in_memory_copy_is_lost(env):
    portal_on(env)
    assigned(env)
    c, _ = public(env)
    start(c)
    code = code_of(env)
    out = portal_msgs(env)[0]
    env.rt.outbox.p.secrets.drop(out.id)
    env.tick()
    assert any(code in x["data"]["message"] for x in env.fake.calls)


def test_an_item_without_a_live_link_is_listed_but_cannot_be_opened(env):
    portal_on(env)
    t = assigned(env)
    with env.s4.db.connection() as conn:
        conn.execute("UPDATE ticket_links SET revoked_at = '2026-01-01T00:00:00Z', revoked_reason = 'manual' WHERE ticket_id = ?", (t["id"],))
    c, _ = public(env)
    value = signed_in(env, c)
    [item] = c.get("/t/api/portal/items", headers=jar(value)).json()["items"]
    assert item["can_open"] is False
    uniform_404(c.post("/t/api/portal/open", json={"item": item["id"]}, headers=jar(value)))


def test_closed_items_follow_the_window_setting(env):
    portal_on(env)
    recent, old = assigned(env, title="אחרון"), assigned(env, title="ישן")
    import datetime as dt

    def ended(ticket_id: str, days: int) -> None:
        at = handler_links.iso(handler_links.now_utc() - dt.timedelta(days=days))
        with env.s4.db.connection() as conn:
            conn.execute("UPDATE ticket_assignments SET ended_at = ?, end_reason = 'closed' WHERE ticket_id = ?", (at, ticket_id))
            conn.execute("UPDATE tickets SET status = 'closed', closed_at = ? WHERE id = ?", (at, ticket_id))

    ended(recent["id"], 20)
    ended(old["id"], 100)
    assigned(env, title="פתוח")  # keeps the number eligible
    c, _ = public(env)
    value = signed_in(env, c)
    titles = {i["title"]: i["state"] for i in c.get("/t/api/portal/items", headers=jar(value)).json()["items"]}
    assert titles == {"פתוח": "open", "אחרון": "closed"}
    portal_on(env, closed_months=4)
    titles = {i["title"] for i in c.get("/t/api/portal/items", headers=jar(value)).json()["items"]}
    assert titles == {"פתוח", "אחרון", "ישן"}


def test_with_the_portal_on_the_bare_root_is_served_in_any_letter_case_and_nothing_deeper(env):
    portal_on(env)
    c, _ = public(env)
    shell = c.get("/t/").content
    for path in ("/support", "/Support", "/SUPPORT/", "/support/"):
        r = c.get(path, follow_redirects=False)
        assert r.status_code == 200 and "location" not in r.headers and r.content.replace(b"/support/", b"/t/") == shell, path
    for path in ("/Support/api/portal/config", "/SUPPORT/r/abc", "/Support/assets/x.js", "/support/API/portal/config"):
        uniform_404(c.get(path))
    assert c.get("/support/api/portal/config").status_code == 200


# ---------------------------------------------------------------- 8. the logo


def _png(w: int = 900, h: int = 300, mode: str = "RGBA") -> bytes:
    buf = io.BytesIO()
    Image.new(mode, (w, h), (20, 90, 160, 255) if mode == "RGBA" else (20, 90, 160)).save(buf, format="PNG")
    return buf.getvalue()


def upload_logo(env, data: bytes, name: str = "logo.png", user: str = "joni"):
    return env.c.post(f"{API}/tickets/settings/logo", files={"file": (name, data, "image/png")}, headers=env.h(user))


def test_an_svg_or_any_other_type_is_refused_and_only_system_configure_may_upload(env):
    svg = b'<svg xmlns="http://www.w3.org/2000/svg"><script>alert(1)</script></svg>'
    gif = b"GIF89a" + b"\x00" * 64
    for data in (svg, gif, b"RIFF\x00\x00\x00\x00WEBPVP8 ", b"not an image", b""):
        r = upload_logo(env, data, name="x.svg")
        assert r.status_code in (415, 422), (data[:10], r.status_code)
    r = upload_logo(env, b"\x89PNG\r\n\x1a\n" + b"\x00" * (600 * 1024))
    assert r.status_code == 413
    assert upload_logo(env, _png(), user="tom").status_code == 403
    assert env.c.get(f"{API}/tickets/settings").json()["brand"] == {"logo": ""}


def test_a_logo_is_re_encoded_served_as_a_separate_image_and_named_by_its_stamp(env):
    r = upload_logo(env, _png())
    assert r.status_code == 201, r.text
    name = r.json()["logo"]
    assert re.fullmatch(r"[0-9a-f]{16}\.jpg", name)
    c, _ = public(env)
    img = c.get(f"/t/brand/{name}")
    assert img.status_code == 200 and img.headers["content-type"] == "image/jpeg" and img.content[:2] == b"\xff\xd8"
    assert img.headers["x-content-type-options"] == "nosniff" and "immutable" in img.headers["cache-control"]
    assert "default-src 'none'" in img.headers["content-security-policy"]
    with Image.open(io.BytesIO(img.content)) as im:
        assert max(im.size) <= 512 and not im.info.get("exif")
    uniform_404(c.get("/t/brand/0123456789abcdef.jpg"))
    uniform_404(c.get(f"/t/brand/{name[:-4]}.png"))
    t = assigned(env)
    assert c.get("/t/api/ticket", headers={"x-ticket-token": env.s4.token_of(t["id"])}).json()["logo"] == name
    assert env.c.delete(f"{API}/tickets/settings/logo").status_code == 200
    uniform_404(c.get(f"/t/brand/{name}"))
    assert c.get("/t/api/ticket", headers={"x-ticket-token": env.s4.token_of(t["id"])}).json()["logo"] is None


def test_the_portal_config_carries_the_name_and_the_logo_only(env):
    portal_on(env)
    upload_logo(env, _png())
    c, _ = public(env)
    body = c.get("/t/api/portal/config").json()
    assert set(body) == {"organization", "logo", "theme", "code_ttl_s", "session_ttl_s"} and body["organization"] == "מגדלי הדר"
