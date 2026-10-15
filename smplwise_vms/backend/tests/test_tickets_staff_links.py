"""TKSTAFF1 (owner 2026-10-16): an internal employee WITH an account who is assigned a ticket gets a WhatsApp message with a
personal, scoped no-login link - the SAME handler link a vendor gets, built as the external-handler scope over ONE assignment
(private/planning/TKSTAFF1_LINK_SECURITY_DESIGN_2026-10-16.md, requirements R1..R12, the negative tests of its section 6).

The staff link (`ticket_links.kind = 'staff'`) never acts as the user: the page is handler_actions.view() unchanged, writes are
`actor_kind = 'contact'`, `via = 'link'`, audit actor `contact:<id>`; it never reaches the cost-claim surface; a code is required by
default; it lives 3 days sliding / 14 days at most / 1 hour of grace (settings `staff_links.*`); it dies when the user is deactivated,
leaves the department, the directory row is deactivated or the mobile changes (queued messages of the old link are cancelled).
Every name and number is invented (the 050-000-xxxx block); fake ha-whatsapp only (no network, no Home Assistant, no phone)."""
from __future__ import annotations

import datetime as dt
import json
import logging
import time

import pytest

from fake_ha_whatsapp import FakeHaWhatsapp
from smplwise.services.tickets import codes as codes_mod, handler_links, message_templates as mt, staff_links, store_links
from smplwise.services.tickets.keyring import KEYS
from smplwise.services.tickets.public_http import UNIFORM_404
from test_tickets_s5b_channel import ENTRY_A, NIGHT, env  # noqa: F401 - the slice 5b environment (fake ha-whatsapp, mapped account)
from tickets_s4_world import Clock, crid

API = "/api/v1"
TOM_PHONE, TOM_E164 = "050-000-0091", "972500000091"
MONA_PHONE, MONA_E164 = "050-000-0092", "972500000092"
NEW_PHONE_E164 = "972500000093"


def hdr(token: str, session: str | None = None) -> dict[str, str]:
    h = {"x-ticket-token": token}
    if session:
        h["x-ticket-session"] = session
    return h


def set_mobile(env, user: str, phone: str | None, *, caller: str = "joni", **extra):
    return env.c.put(f"{API}/tickets/admin/staff/dev-{user}", json={"phone": phone, **extra}, headers=env.h(caller))


def staff_ticket(env, user: str = "tom", phone: str = TOM_PHONE, **extra):
    """A ticket assigned to an internal user who has a mobile: (ticket, detail after the assignment)."""
    r = set_mobile(env, user, phone, lang="he")
    assert r.status_code == 200, r.text
    t = env.s4.ticket(**extra)
    r = env.s4.w.assign("joni", t["id"], user)
    assert r.status_code == 200, r.text
    return t, r.json()


def staff_row(env, ticket_id: str) -> dict:
    return env.s4.link_row(ticket_id)


def audits(env, action: str) -> list[dict]:
    with env.s4.db.connection(mode="read") as conn:
        return [dict(r) for r in conn.execute("SELECT * FROM audit_log WHERE action = ? ORDER BY rowid", (action,)).fetchall()]


def no_code(env) -> None:
    """The owner may turn the staff code default off (settings `staff_links.require_code`); used where a test needs a code-free link."""
    rev = env.c.get(f"{API}/tickets/settings").json()["revision"]
    r = env.c.put(f"{API}/tickets/settings", json={"revision": rev, "staff_links": {"require_code": False}})
    assert r.status_code == 200, r.text


def code_session(env, client, token: str, link: dict) -> str:
    """Ask a code on the page and verify it (the digits are derived from the code row like the worker does - W9)."""
    r = client.post("/t/api/code/send", headers=hdr(token), json={})
    assert r.status_code == 200, r.text
    with env.s4.db.connection(mode="read") as conn:
        code_id = conn.execute("SELECT id FROM ticket_link_codes WHERE link_id = ? ORDER BY created_at DESC, rowid DESC LIMIT 1",
                               (link["id"],)).fetchone()[0]
    digits = codes_mod.derive_code(KEYS.get(link["key_id"]), code_id)
    r = client.post("/t/api/code/verify", headers=hdr(token), json={"code": digits})
    assert r.status_code == 200, r.text
    return r.json()["session"]


# ---------------------------------------------------------------- the mobile field (Handlers & Vendors › handlers › with an account)


def test_the_mobile_of_a_staff_member_is_e164_validated_configure_only_and_never_audited(env):
    r = set_mobile(env, "tom", "12ab")
    assert r.status_code == 422 and r.json()["details"]["fields"][0] == {"field": "phone", "code": "format"}
    r = set_mobile(env, "tom", TOM_PHONE, caller="mona")
    assert r.status_code == 403, "the directory phone is edited with tickets.configure only (contacts.py, spec 8)"
    r = set_mobile(env, "nobody", TOM_PHONE)
    assert r.status_code == 404
    r = set_mobile(env, "tom", TOM_PHONE, lang="ru")
    assert r.status_code == 200, r.text
    body = r.json()
    assert body["has_phone"] is True and body["phone"] == TOM_PHONE and body["notify_whatsapp"] is True and body["lang"] == "ru"
    dept = env.c.get(f"{API}/tickets/admin/departments").json()["departments"]
    tom = next(m for d in dept if d["id"] == "dept-maintenance" for m in d["members"] if m["id"] == "dev-tom")
    assert tom["mobile"] == TOM_PHONE and tom["notify_whatsapp"] is True and tom["lang"] == "ru"
    blob = json.dumps(audits(env, "ticket.contact.update") + audits(env, "ticket.contact.create"), ensure_ascii=False)
    assert TOM_E164 not in blob and "0091" not in blob, "content-free audit: field names only"
    fields = [json.loads(a["details_json"]).get("fields") for a in audits(env, "ticket.contact.create")]
    assert fields and "phone" in fields[-1]


def test_an_assignment_to_a_staff_member_with_a_mobile_queues_a_whatsapp_with_a_staff_link(env):
    t, d = staff_ticket(env)
    link = staff_row(env, t["id"])
    assert link["kind"] == "staff" and link["require_code"] == 1 and link["revoked_at"] is None
    rows = env.rows(t["id"])
    assert [(r.purpose, r.channel, r.link_id) for r in rows] == [("assign", "whatsapp", link["id"])]
    assert rows[0].template_id == "starter:staff_assign_code:he"
    env.tick()
    call = env.fake.calls[-1]
    assert call["data"]["target"] == TOM_E164
    text = call["data"]["message"]
    assert text.count("https://") == 1 and "/t/#" in text, "test 20: exactly one URL, the fragment form"
    assert "1 = " not in text, "no quick-reply line when the link requires a code (R11 note / checklist)"
    mint = [json.loads(a["details_json"]) for a in audits(env, "ticket.link.mint")]
    assert mint and mint[-1]["kind"] == "staff"
    assert d["assignee"]["kind"] == "user", "the assignment stays the user's (the app shows it as theirs)"


def test_no_mobile_or_opted_out_means_no_message_and_no_link(env):
    t = env.s4.ticket()
    assert env.s4.w.assign("joni", t["id"], "tom").status_code == 200
    with env.s4.db.connection(mode="read") as conn:
        assert conn.execute("SELECT COUNT(*) FROM ticket_links WHERE ticket_id = ?", (t["id"],)).fetchone()[0] == 0
    assert env.rows(t["id"]) == []
    assert set_mobile(env, "gil", "050-000-0094", notify_whatsapp=False).status_code == 200
    t2 = env.s4.ticket()
    assert env.s4.w.assign("joni", t2["id"], "gil").status_code == 200
    assert env.rows(t2["id"]) == [], "R12: the user's own opt-out"


# ---------------------------------------------------------------- section 6 test 1: exactly the handler routes


def test_01_a_staff_token_reaches_only_the_handler_routes_and_never_the_claim_surface(env):
    t, _ = staff_ticket(env)
    link = staff_row(env, t["id"])
    token = env.s4.token_of(t["id"])
    with env.s4.db.connection() as conn:  # a claim row on the staff assignment (it can never be made by the module) - still refused
        conn.execute("INSERT INTO ticket_cost_claims(id, ticket_id, department_id, assignment_id, contact_id, required, status, currency, "
                     "claim_until, snapshot_json, created_at, updated_at) VALUES ('clm-staff-1', ?, 'dept-maintenance', ?, ?, 1, 'awaiting', "
                     "'ILS', '2099-01-01T00:00:00Z', '{}', '2026-10-16T00:00:00Z', '2026-10-16T00:00:00Z')",
                     (t["id"], link["assignment_id"], link["contact_id"]))
    client, _ = env.s4.public(Clock(time.time()))
    session = code_session(env, client, token, link)
    unknown = client.get("/t/api/claim", headers=hdr("A" * 32))
    assert unknown.status_code == 404
    for method, path, kw in (("GET", "/t/api/claim", {}), ("POST", "/t/api/claim", {"json": {"client_request_id": crid()}}),
                             ("POST", "/t/api/claim/file", {"files": {"file": ("a.pdf", b"%PDF-1.4", "application/pdf")},
                                                            "data": {"client_request_id": crid()}})):
        r = client.request(method, path, headers=hdr(token, session), **kw)
        assert r.status_code == 404 and r.content == unknown.content == UNIFORM_404, (method, path, r.status_code)
    r = client.get("/t/api/ticket", headers=hdr(token, session))
    assert r.status_code == 200 and "claim" not in r.json(), "R2: the claim block is never added for a staff link"
    for path in ("/t/api/board", "/api/v1/tickets", "/t/api/assign"):
        assert client.get(path, headers=hdr(token, session)).status_code == 404


# ---------------------------------------------------------------- test 2: the external view, never the user's


def test_02_the_view_is_the_external_scope_even_for_a_department_manager(env):
    with env.s4.db.connection() as conn:
        conn.execute("UPDATE ticket_department_members SET notify_new = 0 WHERE subject_id = 'dev-mona'")
    other = env.s4.ticket(title="טיקט של מישהו אחר")
    t, _ = staff_ticket(env, user="mona", phone=MONA_PHONE)
    tid = t["id"]
    r = env.c.post(f"{API}/tickets/{tid}/notes", json={"text": "פנימי בלבד", "external": False})
    assert r.status_code in (200, 201), r.text
    r = env.c.post(f"{API}/tickets/{tid}/notes", json={"text": "למטפל", "external": True})
    assert r.status_code in (200, 201), r.text
    link = staff_row(env, tid)
    token = env.s4.token_of(tid)
    client, _ = env.s4.public(Clock(time.time()))
    before = client.get("/t/api/ticket", headers=hdr(token)).json()
    assert set(before) <= {"number", "department", "organization", "lang", "dir", "labels", "time_zone", "code_required", "code_ok",
                           "read_only", "read_only_until", "expires_at", "code_locked_s"}, "before the code: a ticket exists, nothing more"
    view = client.get("/t/api/ticket", headers=hdr(token, code_session(env, client, token, link))).json()
    blob = json.dumps(view, ensure_ascii=False)
    for never in ("dev-mona", "mona", MONA_E164, "0092", "פנימי בלבד", other["title"], "claim", "user_id", "username"):
        assert never not in blob, never
    assert "למטפל" in blob


# ---------------------------------------------------------------- test 3: writes are the link actor, never the user


def test_03_a_write_through_a_staff_link_is_the_contact_actor_never_the_users_principal(env):
    t, _ = staff_ticket(env)
    link = staff_row(env, t["id"])
    token = env.s4.token_of(t["id"])
    client, _ = env.s4.public(Clock(time.time()))
    session = code_session(env, client, token, link)
    r = client.post("/t/api/status", headers=hdr(token, session), json={"status": "in_progress", "client_request_id": crid()})
    assert r.status_code == 200, r.text
    r = client.post("/t/api/note", headers=hdr(token, session), json={"text": "בדרך", "client_request_id": crid()})
    assert r.status_code == 200, r.text
    with env.s4.db.connection(mode="read") as conn:
        rows = [dict(x) for x in conn.execute("SELECT * FROM ticket_events WHERE ticket_id = ? AND via = 'link'", (t["id"],)).fetchall()]
        user_rows = conn.execute("SELECT COUNT(*) FROM audit_log WHERE actor_user_id = 'dev-tom' AND action IN ('ticket.status', 'ticket.note')").fetchone()[0]
    assert rows and all(x["actor_kind"] == "contact" and x["actor_user_id"] is None and x["actor_contact_id"] == link["contact_id"] for x in rows)
    st = [json.loads(a["details_json"]) | {"actor": a["actor_user_id"]} for a in audits(env, "ticket.status")]
    assert st[-1]["actor"] == f"contact:{link['contact_id']}" and st[-1]["source"] == "ticket_link"
    assert user_rows == 0, "R3: a bearer link never forges the user's authenticated identity"


# ---------------------------------------------------------------- test 4: reassignment


def test_04_a_reassignment_revokes_the_staff_link_in_the_same_transaction(env):
    t, _ = staff_ticket(env)
    token = env.s4.token_of(t["id"])
    client, _ = env.s4.public(Clock(time.time()))
    assert client.get("/t/api/ticket", headers=hdr(token)).status_code == 200
    assert env.s4.w.assign("joni", t["id"], "gil").status_code == 200  # gil has no mobile: no new link
    with env.s4.db.connection(mode="read") as conn:
        old = dict(conn.execute("SELECT * FROM ticket_links WHERE ticket_id = ? AND kind = 'staff' ORDER BY created_at LIMIT 1", (t["id"],)).fetchone())
    assert old["revoked_reason"] == "reassigned"
    r = client.get("/t/api/ticket", headers=hdr(token))
    assert r.status_code == 404 and r.content == UNIFORM_404


# ---------------------------------------------------------------- test 5: the new revocation triggers (R7 a-c)


@pytest.mark.parametrize("trigger", ["user_inactive", "left_department", "contact_inactive"])
def test_05_deactivation_membership_loss_or_an_inactive_row_revokes_every_live_staff_link(env, trigger):
    t, _ = staff_ticket(env)
    link = staff_row(env, t["id"])
    token = env.s4.token_of(t["id"])
    if trigger == "user_inactive":
        with env.s4.db.connection() as conn:
            conn.execute("UPDATE users SET active = 0 WHERE id = 'dev-tom'")
            assert staff_links.recheck(conn) == 1
        reason = "user_inactive"
    elif trigger == "left_department":
        r = env.c.delete(f"{API}/tickets/admin/departments/dept-maintenance/members/user/dev-tom")
        assert r.status_code == 200, r.text
        reason = "user_inactive"
    else:
        rev = env.s4.contact_rev(link["contact_id"])
        r = env.c.patch(f"{API}/tickets/contacts/{link['contact_id']}", json={"active": False, "revision": rev})
        assert r.status_code == 200, r.text
        reason = "contact_changed"
    row = staff_row(env, t["id"])
    assert row["revoked_at"] and row["revoked_reason"] == reason
    d = env.s4.w.detail(t["id"])
    assert d["waiting_on"] == "manager" and d["waiting_reason"] == reason, "the ticket waits for the manager"
    assert [e for e in d["events"] if e["kind"] in ("user_inactive", "contact_changed")], "a system timeline row"
    client, _ = env.s4.public(Clock(time.time()))
    assert client.get("/t/api/ticket", headers=hdr(token)).status_code == 404


# ---------------------------------------------------------------- test 6: a mobile change


def test_06_a_mobile_change_revokes_cancels_the_queued_message_and_never_sends_a_dead_link(env):
    env.clock.t = NIGHT  # outside the send hours: the assignment message waits
    t, _ = staff_ticket(env)
    env.tick()
    assert [r.state for r in env.rows(t["id"])] == ["held"]
    r = set_mobile(env, "tom", "+" + NEW_PHONE_E164)
    assert r.status_code == 200, r.text
    assert staff_row(env, t["id"])["revoked_reason"] == "contact_changed"
    assert [(r.state, r.outcome_code) for r in env.rows(t["id"])] == [("cancelled", "link_revoked")]
    upd = [json.loads(a["details_json"]) for a in audits(env, "ticket.contact.update")]
    assert upd[-1]["fields"] == ["phone"] and upd[-1]["links_revoked"] == 1
    env.clock.t = NIGHT + dt.timedelta(hours=10)
    env.tick()
    assert env.fake.calls == [], "nothing leaves: the new number never receives the old (dead) link"


# ---------------------------------------------------------------- test 7: code default


def test_07_a_staff_link_requires_a_code_by_default_and_the_vendor_default_is_unchanged(env):
    t, _ = staff_ticket(env)
    assert staff_row(env, t["id"])["require_code"] == 1
    r = env.c.post(f"{API}/tickets/{t['id']}/link/new")
    assert r.status_code == 200, r.text
    assert staff_row(env, t["id"])["require_code"] == 1, "a new generation never lowers it"
    v, _ = env.s4.sent()
    assert env.s4.link_row(v["id"])["require_code"] == 0 and env.s4.link_row(v["id"])["kind"] == "external"
    no_code(env)
    rev = env.s4.contact_rev(staff_row(env, t["id"])["contact_id"])
    env.c.patch(f"{API}/tickets/contacts/{staff_row(env, t['id'])['contact_id']}", json={"require_code": True, "revision": rev})
    t2 = env.s4.ticket()
    assert env.s4.w.assign("joni", t2["id"], "tom").status_code == 200
    assert staff_row(env, t2["id"])["require_code"] == 1, "raise only: the row's own flag still wins over the setting"


# ---------------------------------------------------------------- test 8: durations


def test_08_staff_durations_and_a_lower_staff_cap_pulls_in_staff_links_only(env):
    t, _ = staff_ticket(env)
    row = staff_row(env, t["id"])
    created = handler_links.parse(row["created_at"])
    assert handler_links.parse(row["cap_at"]) - created == dt.timedelta(days=14)
    # the first expiry is 3 days, or the priority's resolve window + 1 day when that is longer (review C10)
    assert handler_links.parse(row["expires_at"]) - created >= dt.timedelta(days=3)
    v, _ = env.s4.sent()
    vendor_cap = env.s4.link_row(v["id"])["cap_at"]
    rev = env.c.get(f"{API}/tickets/settings").json()["revision"]
    r = env.c.put(f"{API}/tickets/settings", json={"revision": rev, "staff_links": {"cap_days": 7}})
    assert r.status_code == 200, r.text
    assert handler_links.parse(staff_row(env, t["id"])["cap_at"]) - created == dt.timedelta(days=7)
    assert env.s4.link_row(v["id"])["cap_at"] == vendor_cap, "a lower STAFF cap never touches vendor links"
    inst = env.c.get(f"{API}/tickets/settings").json()
    assert inst["staff_links"] == {"sliding_days": 3, "cap_days": 7, "grace_hours": 1, "require_code": True}
    assert inst["links"]["sliding_days"] == 14 and inst["links"]["cap_days"] == 90, "vendor defaults unchanged"


# ---------------------------------------------------------------- test 9: generations (codes, B3 button nonce)


def test_09_an_old_message_button_is_ignored_after_a_new_link(env):
    no_code(env)
    env.channel(whatsapp={"use_buttons": True})
    t, _ = staff_ticket(env)
    env.tick()
    old_button = env.fake.calls[-1]["data"]["buttons"][1]["id"]  # t:<nonce>:wip of generation 1
    r = env.c.post(f"{API}/tickets/{t['id']}/link/new")
    assert r.status_code == 200, r.text
    env.inbound(FakeHaWhatsapp.button(TOM_E164, old_button, at=env.clock(), entry_id=ENTRY_A, button_text="בטיפול"))
    assert env.s4.w.detail(t["id"])["status"] == "assigned", "B3: the old message's button no longer acts"
    with env.s4.db.connection(mode="read") as conn:
        last = conn.execute("SELECT result, reason FROM ticket_inbound ORDER BY received_at DESC, rowid DESC LIMIT 1").fetchone()
    assert (last["result"], last["reason"]) == ("ignored", "link_superseded")


def test_09b_a_code_of_generation_n_fails_under_n_plus_1(env):
    t, _ = staff_ticket(env)
    link = staff_row(env, t["id"])
    token = env.s4.token_of(t["id"])
    client, _ = env.s4.public(Clock(time.time()))
    assert client.post("/t/api/code/send", headers=hdr(token), json={}).status_code == 200
    with env.s4.db.connection(mode="read") as conn:
        code_id = conn.execute("SELECT id FROM ticket_link_codes WHERE link_id = ? ORDER BY rowid DESC LIMIT 1", (link["id"],)).fetchone()[0]
    digits = codes_mod.derive_code(KEYS.get(link["key_id"]), code_id)
    assert env.c.post(f"{API}/tickets/{t['id']}/link/new").status_code == 200
    token2 = env.s4.token_of(t["id"])
    r = client.post("/t/api/code/verify", headers=hdr(token2), json={"code": digits})
    assert r.status_code in (400, 403, 409, 422) and r.status_code != 200
    assert client.get("/t/api/ticket", headers=hdr(token)).status_code == 404, "the old token is dead"


# ---------------------------------------------------------------- test 10: "new request" notices carry no token (R11)


def test_10_new_request_notices_to_notify_new_managers_never_carry_a_link(env):
    assert set_mobile(env, "mona", MONA_PHONE).status_code == 200  # mona manages maintenance with notify_new on
    t = env.s4.ticket()
    assert env.rows(t["id"]) == [], "a new ticket queues no ticket-outbox row for anyone (the managers are told in the app)"
    assert set_mobile(env, "tom", TOM_PHONE).status_code == 200
    assert env.s4.w.assign("joni", t["id"], "tom").status_code == 200
    rows = env.rows(t["id"])
    with env.s4.db.connection(mode="read") as conn:
        tom_contact = store_links.contact_by_user(conn, "dev-tom")
    assert [(r.purpose, r.contact_id) for r in rows if r.link_id] == [("assign", tom_contact["id"])]
    assert not [r for r in rows if r.contact_id != tom_contact["id"]], "one assignment, one link, one holder"


# ---------------------------------------------------------------- test 11: inbound


def test_11_a_text_reply_from_the_staff_phone_resolves_to_the_staff_assignment_and_is_a_note_with_a_code(env):
    t, _ = staff_ticket(env)
    env.tick()
    env.inbound(FakeHaWhatsapp.received(TOM_E164, "1", at=env.clock(), entry_id=ENTRY_A))
    d = env.s4.w.detail(t["id"])
    assert d["status"] == "assigned", "a code-protected link turns a quick reply into a note"
    notes = [e for e in d["events"] if e["kind"] == "inbound"]
    assert notes and notes[0]["body"] == "1"
    with env.s4.db.connection(mode="read") as conn:
        row = dict(conn.execute("SELECT * FROM ticket_inbound ORDER BY rowid DESC LIMIT 1").fetchone())
    assert row["ticket_id"] == t["id"] and row["reason"] == "code_protected" and row["assignment_id"] == staff_row(env, t["id"])["assignment_id"]


# ---------------------------------------------------------------- test 12: previews change nothing


def test_12_a_link_preview_fetch_changes_no_row(env):
    t, _ = staff_ticket(env)
    client, _ = env.s4.public(Clock(time.time()))
    before = staff_row(env, t["id"])
    with env.s4.db.connection(mode="read") as conn:
        n = conn.execute("SELECT COUNT(*) FROM ticket_requests").fetchone()[0]
    for path in ("/t/", "/t/r/abcdefgh"):
        client.get(path, headers={"User-Agent": "WhatsApp/2.23.20.0 A"})
    after = staff_row(env, t["id"])
    assert (after["open_count"], after["first_opened_at"]) == (before["open_count"], before["first_opened_at"])
    with env.s4.db.connection(mode="read") as conn:
        assert conn.execute("SELECT COUNT(*) FROM ticket_requests").fetchone()[0] == n


# ---------------------------------------------------------------- test 13: logs


def test_13_the_staff_paths_log_no_token_code_phone_or_text(env, caplog):
    caplog.set_level(logging.DEBUG)
    t, _ = staff_ticket(env, title="כיור סתום בקומה 2")
    env.tick()
    link = staff_row(env, t["id"])
    token = env.s4.token_of(t["id"])
    client, _ = env.s4.public(Clock(time.time()))
    session = code_session(env, client, token, link)
    client.post("/t/api/note", headers=hdr(token, session), json={"text": "הערה סודית", "client_request_id": crid()})
    assert env.s4.w.assign("joni", t["id"], "gil").status_code == 200
    text = caplog.text
    for secret in (token, TOM_E164, "הערה סודית", "כיור סתום", session):
        assert secret not in text, secret


# ---------------------------------------------------------------- test 14 / 15: budgets and the main app


def test_14_the_rate_budgets_of_a_staff_token_are_the_vendors(env):
    """The per-token budgets (60 requests / min, 20 writes / h, 10 photos / h) are keyed by the token, never by the link's kind:
    the limiter is never told the kind (it only sees the link id), so a staff token is budgeted exactly like a vendor's."""
    import inspect

    from smplwise.services.tickets import public_store, ratelimit

    src = inspect.getsource(ratelimit)
    assert "'staff'" not in src and '"staff"' not in src and "link.kind" not in src
    t, _ = staff_ticket(env)
    v, _ = env.s4.sent()
    with env.s4.db.connection(mode="read") as conn:
        rs = public_store.fold(store_links.link_by_id_joined(conn, staff_row(env, t["id"])["id"]))
        re_ = public_store.fold(store_links.link_by_id_joined(conn, env.s4.link_row(v["id"])["id"]))
    assert rs.kind == "staff" and re_.kind == "external"


def test_15_the_main_app_serves_no_handler_route(env):
    t, _ = staff_ticket(env)
    token = env.s4.token_of(t["id"])
    for path in ("/t/", "/t/api/ticket"):
        assert env.c.get(path, headers=hdr(token)).status_code == 404


# ---------------------------------------------------------------- test 16: the migration


def test_16_migration_kind_defaults_external_and_the_reason_check_accepts_user_inactive(env):
    v, _ = env.s4.sent()
    with env.s4.db.connection() as conn:
        cols = {r[1]: r for r in conn.execute("PRAGMA table_info(ticket_links)").fetchall()}
        assert cols["kind"][4] in ("'external'", "external")
        conn.execute("UPDATE ticket_links SET revoked_reason = 'user_inactive', revoked_at = '2026-10-16T00:00:00Z' WHERE ticket_id = ?", (v["id"],))
        idx = {r[0] for r in conn.execute("SELECT name FROM sqlite_master WHERE type = 'index' AND tbl_name = 'ticket_links'").fetchall()}
        ccols = {r[1] for r in conn.execute("PRAGMA table_info(ticket_contacts)").fetchall()}
        fks = {r[2] for r in conn.execute("PRAGMA foreign_key_list(ticket_link_sessions)").fetchall()}
    assert {"idx_ticket_links_ticket", "idx_ticket_links_assignment", "idx_ticket_links_contact", "idx_ticket_links_expiry", "idx_ticket_links_key"} <= idx
    assert "notify_whatsapp" in ccols and fks == {"ticket_links"}


# ---------------------------------------------------------------- test 20 (template side) and the starters


@pytest.mark.parametrize("lang", ["he", "ar", "ru", "en"])
def test_20_the_staff_starters_carry_one_url_and_no_quick_reply_line_with_a_code(lang):
    for tid, quick in (("staff_assign_code", False), ("staff_assign", True)):
        tpl = mt.staff_starter(tid, lang)
        assert tpl is not None and tpl.id == f"starter:{tid}:{lang}"
        out = mt.render(tpl.body, {"name": "x", "number": "12", "department": "d", "title": "t"}, lang=lang,
                        secrets={"link": "https://t-demo.arx.example.test/t/#tok"})
        assert out.count("https://") == 1 and "/t/#" in out
        assert ("1 = " in out) is quick
        assert mt.problems("assign", tpl.body) == []
