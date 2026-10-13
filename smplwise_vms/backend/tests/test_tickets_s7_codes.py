"""CR-038 slice 7 - option B verification codes over the REAL store (spec 10.5, D2, D6; code review V8 / W7 / W8 / W9): the
contact flag and the per-assignment flag, the D6 code-channel rule at assignment, at "new link" and at code/send, the code's
way out through the dispatcher (the six digits in memory only), verification with its access rows / timeline / sliding expiry,
the lock (the ticket waits for the manager) and the manager's one-tap new link. The message channel is a FAKE dispatcher
(external.DISPATCH) - no outbox, no WhatsApp, no network; every number and name is invented."""
from __future__ import annotations

import logging
import time
from typing import Any

import pytest

from smplwise.services.tickets import external, store_links
from smplwise.services.tickets.public_http import UNIFORM_404
from tickets_s4_world import API, Clock, build_s4, crid

DAY = 86400.0


class FakeDispatch:
    """The slice-5b seam on fakes. `link_channel`: how a link message would leave; `wa_codes` / `email_codes`: what code_ready
    answers. Codes are kept in memory exactly like the msg-core outbox keeps them (TransientSecrets) - the test reads them
    here the way the worker would render them."""

    def __init__(self, link_channel: str = "whatsapp", wa_codes: bool = True, email_codes: bool = False) -> None:
        self.link_channel = link_channel
        self.wa_codes = wa_codes
        self.email_codes = email_codes
        self.queued: list[dict[str, Any]] = []
        self.codes: list[dict[str, Any]] = []
        self.n = 0

    def channel(self, conn, contact):
        return self.link_channel

    def queue(self, conn, *, purpose, ticket, assignment_id, link, contact, send_now, requested_by):
        self.queued.append({"purpose": purpose, "link_id": link["id"], "generation": int(link["generation"])})
        store_links.update_link(conn, link["id"], {"sent_via": self.link_channel})  # as if the outbox sent it (note_sent)
        return {"queued": True, "channel": self.link_channel}

    def code_ready(self, conn, contact):
        return self.wa_codes, self.email_codes

    def queue_code(self, conn, *, ticket, link, contact, code, code_id, channel, requested_by):
        self.n += 1
        self.codes.append({"code": code, "code_id": code_id, "channel": channel, "link_id": link["id"], "requested_by": requested_by})
        return {"queued": True, "outbox_id": f"ob{self.n:014d}"}

    @property
    def last_code(self) -> str:
        return self.codes[-1]["code"]


@pytest.fixture()
def s4(settings, monkeypatch):
    return build_s4(settings, monkeypatch)


@pytest.fixture()
def fake(monkeypatch):
    d = FakeDispatch()
    monkeypatch.setattr(external, "DISPATCH", d)
    return d


def hdr(token: str, session: str | None = None) -> dict[str, str]:
    h = {"x-ticket-token": token}
    if session:
        h["x-ticket-session"] = session
    return h


def wrong(code: str) -> str:
    return f"{(int(code) + 1) % 10 ** 6:06d}"


def require_contact_code(s4, contact_id: str | None = None) -> None:
    cid = contact_id or s4.contact["id"]
    r = s4.c.patch(f"{API}/tickets/contacts/{cid}", json={"require_code": True, "revision": s4.contact_rev(cid)})
    assert r.status_code == 200, r.text


def all_text(db) -> str:
    """Every text value of the tables a code could leak into (the code tables, the timeline, the audit log, the requests)."""
    out = []
    with db.connection(mode="read") as conn:
        for table in ("ticket_link_codes", "ticket_events", "audit_log", "ticket_requests", "ticket_link_access", "ticket_links"):
            try:
                rows = conn.execute(f"SELECT * FROM {table}").fetchall()
            except Exception:  # noqa: BLE001 - a table name that differs in this schema
                continue
            out.extend(str(tuple(r)) for r in rows)
    return "\n".join(out)


# ---------------------------------------------------------------- the flags and D6 at assignment


def test_the_contact_flag_makes_every_assignment_code_protected_and_locks_the_choice(s4, fake):
    require_contact_code(s4)
    t = s4.ticket()
    p = s4.c.post(f"{API}/tickets/{t['id']}/assign/preview", json={"contact_id": s4.contact["id"], "require_code": False})
    assert p.status_code == 200, p.text
    assert p.json()["require_code"] is True and p.json()["require_code_locked"] is True and p.json()["refusals"] == []
    r = s4.assign_contact(t["id"], require_code=False)  # a manager can never lower the contact's requirement
    assert r.status_code == 200, r.text
    assert s4.link_row(t["id"])["require_code"] == 1


def test_the_per_assignment_flag_raises_one_assignment_only(s4, fake):
    t1, t2 = s4.ticket(), s4.ticket(title="נזילה בלובי")
    assert s4.assign_contact(t1["id"], require_code=True).status_code == 200
    assert s4.assign_contact(t2["id"]).status_code == 200
    assert s4.link_row(t1["id"])["require_code"] == 1 and s4.link_row(t2["id"])["require_code"] == 0
    p = s4.c.post(f"{API}/tickets/{t2['id']}/assign/preview", json={"contact_id": s4.contact["id"], "require_code": True}).json()
    assert p["require_code"] is True and p["require_code_locked"] is False


@pytest.mark.parametrize("link_channel,wa_codes,email_codes,with_email,ok", [
    ("whatsapp", True, False, False, True),    # the normal case: link and code by WhatsApp (separate messages)
    ("email", True, False, True, True),        # link by the e-mail fallback -> the code must (and can) go by WhatsApp
    ("email", False, True, True, False),       # D6: link by e-mail and WhatsApp cannot carry the code -> refused
    ("whatsapp", False, True, True, True),     # WhatsApp link, codes account down -> the code may go by e-mail
    ("whatsapp", False, True, False, False),   # ... but not to a contact without an address
    ("manual", False, True, True, True),       # a copied link: e-mail is a different channel
    ("manual", False, False, True, False),     # nothing can carry a code
])
def test_d6_at_assignment(s4, fake, link_channel, wa_codes, email_codes, with_email, ok):
    fake.link_channel, fake.wa_codes, fake.email_codes = link_channel, wa_codes, email_codes
    cid = s4.contact["id"]
    if with_email:
        r = s4.add_contact(display_name="דנה כהן", phone="050-000-0041", email="dana@clima.example.test")
        assert r.status_code == 201, r.text
        cid = r.json()["id"]
    t = s4.ticket()
    r = s4.assign_contact(t["id"], contact_id=cid, require_code=True)
    if ok:
        assert r.status_code == 200, r.text
    else:
        assert r.status_code == 409 and r.json()["code"] == "code_channel_unavailable", r.text
        assert s4.w.detail(t["id"])["status"] == "new", "nothing was written"
        p = s4.c.post(f"{API}/tickets/{t['id']}/assign/preview", json={"contact_id": cid, "require_code": True}).json()
        assert "code_channel_unavailable" in p["refusals"]
        # only the assignment asked for the code: dropping it lets the assignment through
        assert s4.assign_contact(t["id"], contact_id=cid, require_code=False).status_code == 200


# ---------------------------------------------------------------- send, verify, the session


def test_the_full_code_flow_over_the_real_store(s4, fake, caplog):
    caplog.set_level(logging.DEBUG)
    t, token = s4.sent(require_code=True)
    assert fake.queued and fake.queued[-1]["purpose"] == "assign"
    clock = Clock(time.time())
    client, _ = s4.public(clock)
    v = client.get("/t/api/ticket", headers=hdr(token)).json()
    assert v["code_required"] is True and v["code_ok"] is False and "title" not in v

    r = client.post("/t/api/code/send", headers=hdr(token), json={})
    assert r.status_code == 200, r.text
    assert r.json()["channel"] == "whatsapp" and 590 <= r.json()["expires_in_s"] <= 600
    code = fake.last_code
    assert len(code) == 6 and code.isdigit() and fake.codes[-1]["requested_by"].startswith("contact:")
    with s4.db.connection(mode="read") as conn:
        row = dict(conn.execute("SELECT * FROM ticket_link_codes").fetchone())
    assert row["outbox_id"] == "ob00000000000001" and row["generation"] == 1 and row["channel"] == "whatsapp"
    assert code not in row["code_hash"] and row["id"] == fake.codes[-1]["code_id"]

    r = client.post("/t/api/code/verify", headers=hdr(token), json={"code": code})
    assert r.status_code == 200, r.text
    session = r.json()["session"]
    v = client.get("/t/api/ticket", headers=hdr(token, session)).json()
    assert v["code_ok"] is True and v["title"] == "מזגן לא מקרר"
    assert client.post("/t/api/note", headers=hdr(token, session), json={"text": "בדרך", "client_request_id": crid()}).status_code == 200

    d = s4.w.detail(t["id"])
    assert [e for e in d["events"] if e["kind"] == "code_verified"], "the manager's timeline shows the verification"
    with s4.db.connection(mode="read") as conn:
        kinds = [r[0] for r in conn.execute("SELECT kind FROM ticket_link_access ORDER BY id").fetchall()]
    assert "code_ok" in kinds
    assert code not in all_text(s4.db), "the six digits are never stored"
    assert code not in caplog.text and session not in caplog.text, "nor logged"


def test_a_verified_code_extends_the_sliding_expiry(s4, fake):
    t, token = s4.sent(require_code=True)
    before = s4.link_row(t["id"])["expires_at"]
    clock = Clock(time.time() + 5 * DAY)
    client, _ = s4.public(clock)
    assert client.post("/t/api/code/send", headers=hdr(token), json={}).status_code == 200
    assert client.post("/t/api/code/verify", headers=hdr(token), json={"code": fake.last_code}).status_code == 200
    assert s4.link_row(t["id"])["expires_at"] > before


def test_d6_at_send_follows_how_the_link_left(s4, fake):
    r = s4.add_contact(display_name="דנה כהן", phone="050-000-0041", email="dana@clima.example.test")
    cid = r.json()["id"]
    fake.link_channel = "email"  # the link left by the e-mail fallback
    t = s4.ticket()
    assert s4.assign_contact(t["id"], contact_id=cid, require_code=True).status_code == 200
    token = s4.token_of(t["id"])
    assert s4.link_row(t["id"])["sent_via"] == "email"
    client, _ = s4.public(Clock(time.time()))
    fake.wa_codes, fake.email_codes = False, True  # WhatsApp went down after the assignment
    r = client.post("/t/api/code/send", headers=hdr(token), json={})
    assert r.status_code == 503 and r.json()["code"] == "code_unavailable", "never the code on the link's own channel"
    with s4.db.connection(mode="read") as conn:
        assert conn.execute("SELECT COUNT(*) FROM ticket_link_codes").fetchone()[0] == 0 and not fake.codes
    with s4.db.connection() as conn:  # the manager copied the link afterwards: e-mail is now a different channel
        conn.execute("UPDATE ticket_links SET sent_via = 'manual' WHERE ticket_id = ?", (t["id"],))
    client, _ = s4.public(Clock(time.time()))
    r = client.post("/t/api/code/send", headers=hdr(token), json={})
    assert r.status_code == 200 and r.json()["channel"] == "email", r.text


def test_a_dispatcher_that_cannot_queue_withdraws_the_code(s4, fake, monkeypatch):
    _t, token = s4.sent(require_code=True)
    monkeypatch.setattr(fake, "queue_code", lambda conn, **kw: {"queued": False})
    client, _ = s4.public(Clock(time.time()))
    r = client.post("/t/api/code/send", headers=hdr(token), json={})
    assert r.status_code == 503 and r.json()["code"] == "code_unavailable"
    with s4.db.connection(mode="read") as conn:
        row = conn.execute("SELECT expires_at, created_at FROM ticket_link_codes").fetchone()
    assert row is not None and row[0] <= row[1], "the withdrawn code is dead at once (it still counts against the caps)"


def test_a_dispatcher_that_raises_is_a_clean_503(s4, fake, monkeypatch):
    _t, token = s4.sent(require_code=True)

    def boom(conn, **kw):
        raise RuntimeError("outbox down")

    monkeypatch.setattr(fake, "queue_code", boom)
    client, _ = s4.public(Clock(time.time()))
    r = client.post("/t/api/code/send", headers=hdr(token), json={})
    assert r.status_code == 503 and r.json()["code"] == "code_unavailable"


def test_codes_follow_the_code_settings(s4, fake):
    r = s4.c.get(f"{API}/tickets/settings")
    r = s4.c.put(f"{API}/tickets/settings", json={"revision": r.json()["revision"], "code": {"ttl_min": 5}})
    assert r.status_code == 200, r.text
    _t, token = s4.sent(require_code=True)
    client, _ = s4.public(Clock(time.time()))
    r = client.post("/t/api/code/send", headers=hdr(token), json={})
    assert r.status_code == 200 and 290 <= r.json()["expires_in_s"] <= 300
    r = s4.c.get(f"{API}/tickets/settings")
    bad = s4.c.put(f"{API}/tickets/settings", json={"revision": r.json()["revision"], "code": {"length": 4}})
    assert bad.status_code in (400, 409, 422), "the length is not a setting (D2)"


# ---------------------------------------------------------------- the lock and the manager's way out


def lock_out(client, token: str, code: str) -> Any:
    last = None
    for _ in range(5):
        last = client.post("/t/api/code/verify", headers=hdr(token), json={"code": wrong(code)})
    return last


def test_five_wrong_codes_lock_and_the_ticket_waits_for_the_manager(s4, fake):
    t, token = s4.sent(require_code=True)
    client, _ = s4.public(Clock(time.time()))
    assert client.post("/t/api/code/send", headers=hdr(token), json={}).status_code == 200
    r = lock_out(client, token, fake.last_code)
    assert r.status_code == 429 and r.json()["code"] == "code_locked" and r.json()["retry_after_s"] == 1800
    v = client.get("/t/api/ticket", headers=hdr(token)).json()
    assert v["code_locked_s"] > 1700 and "title" not in v
    d = s4.w.detail(t["id"])
    assert d["waiting_on"] == "manager" and d["waiting_reason"] == "code_locked"
    assert d["link"]["code_locked"] is True and d["link"]["code_locked_until"] and d["link"]["can"]["new"] is True
    locked = [e for e in d["events"] if e["kind"] == "code_locked"]
    assert len(locked) == 1 and locked[0]["actor"]["kind"] == "system", "the guesser may be a stranger"
    with s4.db.connection(mode="read") as conn:
        kinds = [r[0] for r in conn.execute("SELECT kind FROM ticket_link_access ORDER BY id").fetchall()]
    assert kinds.count("code_bad") == 5 and kinds.count("locked") == 1
    # more guesses while locked: no more rows, no second timeline line
    for _ in range(3):
        assert client.post("/t/api/code/verify", headers=hdr(token), json={"code": "123456"}).status_code == 429
    assert len([e for e in s4.w.detail(t["id"])["events"] if e["kind"] == "code_locked"]) == 1


def test_the_one_tap_new_link_after_a_lock_starts_clean_and_leaves_by_the_channel(s4, fake):
    t, token = s4.sent(require_code=True)
    client, _ = s4.public(Clock(time.time()))
    assert client.post("/t/api/code/send", headers=hdr(token), json={}).status_code == 200
    old_code = fake.last_code
    lock_out(client, token, old_code)
    sent_before = len(fake.queued)
    r = s4.c.post(f"{API}/tickets/{t['id']}/link/new")
    assert r.status_code == 200, r.text
    d = r.json()
    assert d["waiting_on"] == "assignee" and d["waiting_reason"] is None
    assert d["link"]["generation"] == 2 and d["link"]["code_locked"] is False
    assert len(fake.queued) == sent_before + 1 and fake.queued[-1]["generation"] == 2, "the new link leaves by the channel"
    assert client.get("/t/api/ticket", headers=hdr(token)).content == UNIFORM_404, "the old token is dead"
    new_token = s4.token_of(t["id"])
    v = client.get("/t/api/ticket", headers=hdr(new_token)).json()
    assert v["code_required"] is True and v["code_locked_s"] == 0
    # the old code (forwarded message) never opens the new generation (code review V8)
    r = client.post("/t/api/code/verify", headers=hdr(new_token), json={"code": old_code})
    assert r.status_code == 422 and r.json()["code"] == "code_missing"
    assert client.post("/t/api/code/send", headers=hdr(new_token), json={}).status_code == 200
    r = client.post("/t/api/code/verify", headers=hdr(new_token), json={"code": fake.last_code})
    assert r.status_code == 200, r.text


def test_a_verified_code_after_the_lock_ended_hands_the_ticket_back_to_the_assignee(s4, fake):
    t, token = s4.sent(require_code=True)
    clock = Clock(time.time())
    client, _ = s4.public(clock)
    assert client.post("/t/api/code/send", headers=hdr(token), json={}).status_code == 200
    lock_out(client, token, fake.last_code)
    assert s4.w.detail(t["id"])["waiting_reason"] == "code_locked"
    clock.advance(1801)
    assert client.post("/t/api/code/send", headers=hdr(token), json={}).status_code == 200
    assert client.post("/t/api/code/verify", headers=hdr(token), json={"code": fake.last_code}).status_code == 200
    d = s4.w.detail(t["id"])
    assert d["waiting_on"] == "assignee" and d["waiting_reason"] is None


def test_new_link_is_refused_when_no_channel_could_carry_the_code(s4, fake):
    t, _token = s4.sent(require_code=True)
    fake.wa_codes = fake.email_codes = False
    r = s4.c.post(f"{API}/tickets/{t['id']}/link/new")
    assert r.status_code == 409 and r.json()["code"] == "code_channel_unavailable"
    assert s4.link_row(t["id"])["generation"] == 1, "refused before the generation moved"


def test_raising_the_contact_flag_raises_its_live_links_at_once_lowering_never(s4, fake):
    t, token = s4.sent()
    client, _ = s4.public(Clock(time.time()))
    assert client.get("/t/api/ticket", headers=hdr(token)).json()["code_ok"] is True
    require_contact_code(s4)
    v = client.get("/t/api/ticket", headers=hdr(token)).json()
    assert v["code_required"] is True and v["code_ok"] is False and "title" not in v
    cid = s4.contact["id"]
    r = s4.c.patch(f"{API}/tickets/contacts/{cid}", json={"require_code": False, "revision": s4.contact_rev(cid)})
    assert r.status_code == 200, r.text
    assert s4.link_row(t["id"])["require_code"] == 1, "turning the flag off applies to new links only"


def test_a_failing_event_recorder_never_changes_the_answer(s4, fake, caplog):
    _t, token = s4.sent(require_code=True)
    client, app = s4.public(Clock(time.time()))

    def boom(*a, **kw):
        raise RuntimeError("database is locked")

    app.deps.code_events.verified = boom
    app.deps.code_events.refused = boom
    assert client.post("/t/api/code/send", headers=hdr(token), json={}).status_code == 200
    r = client.post("/t/api/code/verify", headers=hdr(token), json={"code": wrong(fake.last_code)})
    assert r.status_code == 422 and r.json()["code"] == "code_invalid"
    r = client.post("/t/api/code/verify", headers=hdr(token), json={"code": fake.last_code})
    assert r.status_code == 200 and r.json()["session"]
    assert "database is locked" not in caplog.text, "the recorder's failure is logged by type only"


def test_manual_dispatch_still_refuses_code_protected_assignments(s4):
    """Without a message channel (slice 4's ManualDispatch), the D6 rule keeps refusing - never a silent code-less link."""
    t = s4.ticket()
    r = s4.assign_contact(t["id"], require_code=True)
    assert r.status_code == 409 and r.json()["code"] == "code_channel_unavailable"
