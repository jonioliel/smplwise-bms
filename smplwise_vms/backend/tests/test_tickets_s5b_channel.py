"""CR-038 slice 5b - the ticket message channel over the REAL store (migration 0081) with a fake ha-whatsapp (no network, no Home
Assistant, no phone, no SMTP): assignment -> outbox -> worker -> WhatsApp, the send hours and "send now" (D4 / D29), the account
mapping (9.9.4), outcomes and "send again" (9.2 / 9.4), the fallbacks of D13 (e-mail with the redeem link, nobody -> the manager),
the D6 code rule, the D14 timeline rows, the inbound matcher (status, note, late, ambiguous with claim-before-reveal, the account
filter, a LID sender with a nonce), message templates per language (D26), the test send, the notices, the lock order, restart
recovery and log / row hygiene. Every number, name and address is invented."""
from __future__ import annotations

import datetime as dt
import json
import logging
import threading
import time

import pytest

from fake_ha_whatsapp import FakeHaWhatsapp, PairedAccount
from smplwise.db import Database, now_iso
from smplwise.services import ha_client
from smplwise.services import messaging_runtime as mr
from smplwise.services.tickets import messaging, outbox_store as obs
from smplwise.services.tickets.outbox import OutboxRow
from tickets_s4_world import BASE_URL, Clock, PHONE_A_E164, build_s4, crid

API = "/api/v1"
ENTRY_A, ENTRY_B = "01JFAKEENTRYA", "01JFAKEENTRYB"
KEY_A, KEY_B = f"entry:{ENTRY_A}", f"entry:{ENTRY_B}"
DAY = dt.datetime(2026, 10, 14, 8, 0, tzinfo=dt.timezone.utc)  # 11:00 in Jerusalem: inside 07:00-21:00
NIGHT = dt.datetime(2026, 10, 14, 20, 30, tzinfo=dt.timezone.utc)  # 23:30 in Jerusalem: outside


class FakeClock:
    def __init__(self, t: dt.datetime) -> None:
        self.t = t

    def __call__(self) -> dt.datetime:
        return self.t

    def advance(self, **kw: float) -> dt.datetime:
        self.t = self.t + dt.timedelta(**kw)
        return self.t


def _mirror(db: Database, fake: FakeHaWhatsapp) -> None:
    now = now_iso()
    with db.connection() as conn:
        for r in fake.mirror_rows():
            conn.execute(
                "INSERT INTO ha_entities(entity_id, unique_id, platform, config_entry_id, domain, device_class, state, available, disabled, name, first_seen_at, updated_at) "
                "VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, '', ?, ?) ON CONFLICT(entity_id) DO UPDATE SET state = excluded.state, available = excluded.available",
                (r.entity_id, r.unique_id, r.platform, r.config_entry_id, r.domain, r.device_class, r.state, int(r.available), int(r.disabled), now, now))


class Env:
    def __init__(self, s4, fake: FakeHaWhatsapp, clock: FakeClock, mails: list) -> None:
        self.s4, self.fake, self.clock, self.mails = s4, fake, clock, mails
        self.rt = messaging.RUNTIME

    @property
    def c(self):
        return self.s4.c

    def h(self, user: str) -> dict[str, str]:
        return self.s4.h(user)

    def tick(self, **advance: float) -> int:
        if advance:
            self.clock.advance(**advance)
        return self.rt.run_once(self.clock(), force=True)

    def rows(self, ticket_id: str | None = None) -> list[OutboxRow]:
        with self.s4.db.connection(mode="read") as conn:
            if ticket_id:
                return list(reversed(obs.rows_of_ticket(conn, ticket_id)))
            return [obs.from_db(r) for r in conn.execute("SELECT * FROM ticket_outbox ORDER BY created_at, id").fetchall()]

    def events(self, ticket_id: str) -> list[dict]:
        return self.s4.w.detail(ticket_id)["events"]

    def channel(self, **body):
        rev = self.c.get(f"{API}/tickets/channel").json()["revision"]
        r = self.c.put(f"{API}/tickets/channel", json={"revision": rev, **body})
        assert r.status_code == 200, r.text
        return r.json()

    def mapping(self, uses: dict, accounts: list | None = None):
        doc = self.c.get(f"{API}/messaging/whatsapp").json()
        r = self.c.put(f"{API}/messaging/whatsapp", json={"revision": doc["revision"], "accounts": accounts or [], "uses": uses, "confirm_queued": True})
        assert r.status_code == 200, r.text

    def set_connected(self, connected: bool) -> None:
        for a in self.fake.accounts:
            a.connected = connected
        _mirror(self.s4.db, self.fake)

    def smtp(self) -> None:
        with self.s4.db.connection() as conn:
            conn.execute("INSERT OR IGNORE INTO notify_settings(id, quiet_json, pass_json, escalation_json) VALUES (1, '{}', '{}', '{}')")
            conn.execute("UPDATE notify_settings SET email_json = ? WHERE id = 1",
                         (json.dumps({"host": "smtp.example.test", "port": 587, "security": "starttls", "user": "", "from": "arx@example.test",
                                      "recipients": []}),))

    def inbound(self, event: dict) -> None:
        assert messaging.submit_inbound(event)
        self.tick()


@pytest.fixture
def env(settings, monkeypatch):
    s4 = build_s4(settings, monkeypatch)
    fake = FakeHaWhatsapp([PairedAccount(ENTRY_A, "15555550191"), PairedAccount(ENTRY_B, "15555550192")])
    _mirror(s4.db, fake)
    monkeypatch.setattr(mr, "ws_connected", lambda: True)
    monkeypatch.setattr(ha_client, "get_state", lambda _s, eid: fake.get_state(eid))
    mr.TRACKER.__init__()
    clock = FakeClock(DAY)
    rt = messaging.RUNTIME
    monkeypatch.setattr(rt, "clock", clock)
    rt.set_transport(fake)
    mails: list = []
    monkeypatch.setattr(rt, "email_sender", lambda cfg, to, rendered: mails.append((to, rendered)))
    e = Env(s4, fake, clock, mails)
    e.mapping({"tickets.messages": KEY_A})
    e.channel(whatsapp={"enabled": True})
    yield e
    mr.TRACKER.__init__()


def _sent_ticket(e: Env, **extra):
    t = e.s4.ticket()
    r = e.s4.assign_contact(t["id"], **extra)
    assert r.status_code == 200, r.text
    return t, r.json()


# ---------------------------------------------------------------- assignment -> outbox -> WhatsApp (9.2, 9.3, D14)

def test_an_assignment_to_a_contact_leaves_by_whatsapp_through_the_mapped_account(env):
    t, d = _sent_ticket(env)
    assert [m["state"] for m in d["messages"]] == ["queued"] and d["messages"][0]["channel"] == "whatsapp"
    assert env.fake.calls == [], "nothing is sent inline - the worker sends"
    assert env.tick() == 1
    call = env.fake.calls[0]
    assert (call["domain"], call["service"], call["data"]["account"], call["data"]["target"]) == ("whatsapp", "send_message", ENTRY_A, PHONE_A_E164)
    text = call["data"]["message"]
    assert f"{BASE_URL}/t/#" in text and str(t["number"]) in text and "מזגן לא מקרר" in text
    row = env.rows(t["id"])[0]
    assert (row.state, row.account_key, row.provider_message_id is not None) == ("sent", KEY_A, True)
    ev = [e for e in env.events(t["id"]) if e["kind"] == "link_sent"]
    assert len(ev) == 1 and ev[0]["via"] == "whatsapp" and ev[0]["data"]["state"] == "sent" and ev[0]["data"]["account"]
    assert env.s4.link_row(t["id"])["sent_via"] == "whatsapp"
    assert env.tick() == 0 and len(env.fake.calls) == 1, "sent once"


def test_the_preview_shows_the_exact_text_the_account_and_the_send_hours(env):
    t = env.s4.ticket()
    r = env.c.post(f"{API}/tickets/{t['id']}/assign/preview", json={"contact_id": env.s4.contact["id"]})
    assert r.status_code == 200, r.text
    p = r.json()
    assert p["channel"] == "whatsapp" and "[קישור]" in p["text"] and "https://" not in p["text"]
    assert p["account"]["key"] == KEY_A and p["account"]["state"] == "connected" and p["account"]["sendable"] is True
    assert p["send_hours"]["open_now"] is True and p["send_hours"]["window"] == {"from": "07:00", "to": "21:00"}
    assert env.rows() == [], "a preview writes nothing"
    env.set_connected(False)  # the dialog warns: the message would wait, then fall back (no e-mail here: the manager copies the link)
    p = env.c.post(f"{API}/tickets/{t['id']}/assign/preview", json={"contact_id": env.s4.contact["id"]}).json()
    assert p["account"]["sendable"] is False and p["fallback"] == "manual"


def test_the_link_panel_sends_the_current_link_again_through_the_channel(env):
    t, d = _sent_ticket(env)
    assert d["link"]["can"]["resend"] is True
    env.tick()
    first = env.s4.link_row(t["id"])
    assert first["sent_via"] == "whatsapp" and first["sent_at"], "slice 4's mark_sent: how and when the generation first left"
    r = env.c.post(f"{API}/tickets/{t['id']}/link/resend")
    assert r.status_code == 200, r.text
    env.tick(seconds=30)
    assert [(x.purpose, x.state) for x in env.rows(t["id"])] == [("assign", "sent"), ("assign", "sent")] and len(env.fake.calls) == 2
    assert env.s4.link_row(t["id"])["sent_at"] == first["sent_at"], "the first send time of the generation stays"
    env.channel(whatsapp={"enabled": False})  # no channel: the panel offers copy only and the route refuses
    assert env.s4.w.detail(t["id"])["link"]["can"]["resend"] is False
    r = env.c.post(f"{API}/tickets/{t['id']}/link/resend")
    assert r.status_code == 409 and r.json()["code"] == "channel_unavailable"


def test_outside_the_send_hours_the_message_waits_and_send_now_releases_it(env):
    env.clock.t = NIGHT
    t, d = _sent_ticket(env)
    env.tick()
    row = env.rows(t["id"])[0]
    assert (row.state, row.held_reason) == ("held", "send_hours") and env.fake.calls == []
    assert row.not_before.astimezone(dt.timezone.utc) == dt.datetime(2026, 10, 15, 4, 0, tzinfo=dt.timezone.utc), "07:00 the next morning"
    msg = env.s4.w.detail(t["id"])["messages"][0]
    assert msg["can"]["send_now"] is True and msg["held_reason"] == "send_hours"
    # an operator who sees the ticket but does not hold tickets.external may not release it (D29)
    r = env.c.post(f"{API}/tickets/{t['id']}/outbox/{row.id}/send-now", headers=env.h("tom"))
    assert r.status_code == 403
    r = env.c.post(f"{API}/tickets/{t['id']}/outbox/{row.id}/send-now")
    assert r.status_code == 200, r.text
    assert env.tick() == 1 and env.rows(t["id"])[0].state == "sent"


def test_send_now_preselected_at_assignment_sends_at_night(env):
    env.clock.t = NIGHT
    t, _ = _sent_ticket(env, send_now=True)
    assert env.tick() == 1 and env.rows(t["id"])[0].state == "sent"


def test_with_the_master_switch_off_the_manager_copies_the_link(env):
    env.channel(whatsapp={"enabled": False})
    t, d = _sent_ticket(env)
    assert d["messages"] == [] and env.rows() == []
    p = env.c.post(f"{API}/tickets/{t['id']}/assign/preview", json={"contact_id": env.s4.contact["id"]}).json()
    assert p["channel"] == "manual"


def test_an_unknown_outcome_is_never_retried_and_send_again_makes_a_new_row(env):
    env.fake.queue("timeout")
    t, _ = _sent_ticket(env)
    env.tick()
    first = env.rows(t["id"])[0]
    assert (first.state, first.outcome_code) == ("unknown", "timeout")
    assert [e["kind"] for e in env.events(t["id"])].count("message_unknown") == 1
    for _ in range(3):
        env.tick(minutes=20)
    assert len(env.fake.calls) == 1, "an unknown outcome is never retried or re-routed"
    msg = env.s4.w.detail(t["id"])["messages"][0]
    assert msg["state"] == "unknown" and msg["can"]["resend"] is True
    r = env.c.post(f"{API}/tickets/{t['id']}/outbox/{first.id}/resend")
    assert r.status_code == 200, r.text
    env.tick()
    rows = env.rows(t["id"])
    assert [x.state for x in rows] == ["unknown", "sent"] and rows[1].resend_of == first.id
    assert env.s4.w.detail(t["id"])["messages"][-1]["can"]["resend"] is False, "once resent, the old row offers nothing more"


def test_a_failed_send_is_retried_then_falls_back_to_email_with_the_redeem_link(env):
    env.smtp()
    contact = env.s4.add_contact(display_name="רינה כהן", phone="050-000-0041", email="rina@vendor.example.test").json()
    env.fake.default = "connect"
    t, _ = _sent_ticket(env, contact_id=contact["id"])
    for _ in range(6):
        env.tick(minutes=10)
    rows = env.rows(t["id"])
    assert rows[0].state == "not_sent" and rows[0].attempts == 4, "first try + 3 retries within 30 minutes"
    assert rows[1].channel == "email" and rows[1].fallback_of == rows[0].id and rows[1].state == "sent"
    to, rendered = env.mails[0]
    assert to == "rina@vendor.example.test" and f"{BASE_URL}/t/r/" in rendered.text and "/t/#" not in rendered.text
    kinds = [e["kind"] for e in env.events(t["id"])]
    assert "message_failed" in kinds and "message_fallback" in kinds and "link_sent" in kinds
    assert env.s4.link_row(t["id"])["sent_via"] == "email"


def test_a_disconnected_account_holds_the_message_then_nobody_can_be_reached(env):
    env.set_connected(False)
    t, _ = _sent_ticket(env)
    env.tick()
    row = env.rows(t["id"])[0]
    assert (row.state, row.held_reason) == ("held", "channel_down") and env.fake.calls == []
    env.tick(minutes=16)
    row = env.rows(t["id"])[0]
    assert (row.state, row.outcome_code) == ("not_sent", "channel_down")
    d = env.s4.w.detail(t["id"])
    assert (d["waiting_on"], d["waiting_reason"]) == ("manager", "send_failed")
    fb = [e for e in d["events"] if e["kind"] == "message_fallback"]
    assert fb and fb[0]["data"]["step"] == "nobody"
    # the account comes back: nothing is re-sent on WhatsApp by itself; a manager's "send again" is a new row
    env.set_connected(True)
    env.tick(minutes=5)
    assert env.fake.calls == []
    r = env.c.post(f"{API}/tickets/{t['id']}/outbox/{row.id}/resend")
    assert r.status_code == 200, r.text
    env.tick()
    d = env.s4.w.detail(t["id"])
    assert env.rows(t["id"])[-1].state == "sent" and d["waiting_reason"] != "send_failed"


def test_an_unmapped_use_holds_the_message_and_a_moved_use_sends_from_the_new_account(env):
    env.mapping({"tickets.messages": None})
    t, _ = _sent_ticket(env)
    env.tick()
    assert env.rows(t["id"])[0].held_reason == "account_unmapped"
    env.mapping({"tickets.messages": KEY_B})  # D27: a queued / held message leaves from the NEW account
    env.tick()
    assert env.fake.calls[0]["data"]["account"] == ENTRY_B and env.rows(t["id"])[0].account_key == KEY_B


def test_turning_the_switch_off_stops_whatsapp_for_messages_already_queued(env):
    t, _ = _sent_ticket(env)
    env.channel(whatsapp={"enabled": False})
    env.tick()
    assert env.rows(t["id"])[0].held_reason == "account_unmapped" and env.fake.calls == []
    env.tick(minutes=16)
    assert env.rows(t["id"])[0].state == "not_sent" and env.fake.calls == [], "nothing leaves on WhatsApp while the switch is off"


def test_a_reassignment_tells_the_previous_contact_and_sends_the_new_one(env):
    t, _ = _sent_ticket(env)
    env.tick()
    other = env.s4.add_contact(display_name="יוסי לוי", phone="050-000-0061").json()
    r = env.s4.assign_contact(t["id"], contact_id=other["id"])
    assert r.status_code == 200, r.text
    env.tick(seconds=30)
    env.tick(seconds=30)
    purposes = {(x.purpose, x.contact_id, x.state) for x in env.rows(t["id"])}
    assert ("reassigned", env.s4.contact["id"], "sent") in purposes and ("assign", other["id"], "sent") in purposes
    targets = [c["data"]["target"] for c in env.fake.calls]
    assert targets.count(PHONE_A_E164) == 2 and targets.count("972500000061") == 1


def test_the_d6_rule_refuses_a_code_protected_assignment_without_a_code_channel(env):
    env.channel(whatsapp={"enabled": False})
    t = env.s4.ticket()
    r = env.s4.assign_contact(t["id"], require_code=True)
    assert r.status_code == 409 and r.json()["code"] == "code_channel_unavailable"
    env.channel(whatsapp={"enabled": True})
    r = env.s4.assign_contact(t["id"], require_code=True)
    assert r.status_code == 200, r.text


def test_a_code_request_on_the_page_queues_the_code_row_id_never_the_digits(env):
    t, _ = _sent_ticket(env, require_code=True)
    env.tick()
    token = env.s4.token_of(t["id"])
    client, _app = env.s4.public(Clock(time.time()))
    r = client.post("/t/api/code/send", headers={"X-Ticket-Token": token, "Content-Type": "application/json"}, json={})
    assert r.status_code == 200, r.text
    code_row = [x for x in env.rows(t["id"]) if x.purpose == "code"][0]
    assert code_row.code_id and code_row.priority == 0 and code_row.state == "queued"
    with env.s4.db.connection(mode="read") as conn:
        raw = dict(conn.execute("SELECT * FROM ticket_outbox WHERE id = ?", (code_row.id,)).fetchone())
    env.tick(seconds=30)  # the account's minimum gap after the assignment message
    assert len(env.fake.calls) == 2
    sent = env.fake.calls[-1]["data"]["message"]
    digits = [w for w in sent.replace("\n", " ").split() if w.isdigit() and len(w) == 6]
    assert len(digits) == 1 and digits[0] not in json.dumps(raw), "the digits never reach the row"
    assert "/t/#" not in sent and "מזגן" not in sent, "the code message carries no link and no title"


# ---------------------------------------------------------------- inbound (9.6)

def test_a_reply_1_acknowledges_and_a_free_text_reply_is_an_unverified_note(env):
    t, _ = _sent_ticket(env)
    env.tick()
    env.inbound(FakeHaWhatsapp.received(PHONE_A_E164, "1", at=env.clock(), entry_id=ENTRY_A))
    d = env.s4.w.detail(t["id"])
    assert d["status"] == "acknowledged"
    st = [e for e in d["events"] if e["kind"] == "status" and e["actor"]["kind"] == "inbound"]
    assert st and st[0]["via"] == "whatsapp" and st[0]["data"]["unverified"] is True
    env.clock.advance(seconds=30)
    env.inbound(FakeHaWhatsapp.received(PHONE_A_E164, "אגיע מחר בבוקר", at=env.clock(), entry_id=ENTRY_A))
    d = env.s4.w.detail(t["id"])
    notes = [e for e in d["events"] if e["kind"] == "inbound"]
    assert d["status"] == "acknowledged" and notes and notes[0]["body"] == "אגיע מחר בבוקר"
    env.clock.advance(seconds=30)
    env.inbound(FakeHaWhatsapp.received(PHONE_A_E164, "בוצע", at=env.clock(), entry_id=ENTRY_A))
    assert env.s4.w.detail(t["id"])["status"] == "acknowledged", "a reply never sets done"


def test_a_late_reply_is_a_flagged_note_and_waits_for_the_manager(env):
    t, _ = _sent_ticket(env)
    env.tick()
    env.clock.advance(minutes=40)
    env.inbound(FakeHaWhatsapp.received(PHONE_A_E164, "1", at=env.clock() - dt.timedelta(minutes=30), entry_id=ENTRY_A))
    d = env.s4.w.detail(t["id"])
    assert d["status"] == "assigned" and (d["waiting_on"], d["waiting_reason"]) == ("manager", "late_reply")
    assert [e["kind"] for e in d["events"]].count("late_reply") == 1


def test_an_ambiguous_reply_is_revealed_only_to_the_manager_who_claims_it(env):
    t1, _ = _sent_ticket(env)
    t2, _ = _sent_ticket(env)
    env.tick()
    env.tick(seconds=30)
    assert len(env.fake.calls) == 2
    env.inbound(FakeHaWhatsapp.received(PHONE_A_E164, "1", at=env.clock(), entry_id=ENTRY_A))
    assert env.s4.w.detail(t1["id"])["status"] == "assigned" and env.s4.w.detail(t2["id"])["status"] == "assigned"
    items = env.c.get(f"{API}/tickets/inbound", headers=env.h("mona")).json()["items"]
    assert len(items) == 1 and items[0]["text"] is None and items[0]["sender"] == env.s4.contact["display_name"]
    assert env.c.get(f"{API}/tickets/inbound", headers=env.h("cleo")).json()["items"] == [], "another department's manager"
    assert env.c.get(f"{API}/tickets/inbound", headers=env.h("tom")).json()["items"] == [], "a member who does not manage"
    iid = items[0]["id"]
    claimed = env.c.post(f"{API}/tickets/inbound/{iid}/claim", headers=env.h("mona"))
    assert claimed.status_code == 200 and claimed.json()["text"] == "1"
    assert env.c.post(f"{API}/tickets/inbound/{iid}/claim", headers=env.h("joni")).status_code == 409
    other = env.c.get(f"{API}/tickets/inbound", headers=env.h("joni")).json()["items"][0]
    assert other["text"] is None and other["claimed"] is True
    r = env.c.post(f"{API}/tickets/inbound/{iid}/attach", json={"ticket_id": t2["id"]}, headers=env.h("mona"))
    assert r.status_code == 200, r.text
    assert any(e["kind"] == "inbound" and e["body"] == "1" for e in r.json()["events"])
    assert env.c.get(f"{API}/tickets/inbound", headers=env.h("mona")).json()["items"] == []
    with env.s4.db.connection(mode="read") as conn:
        assert conn.execute("SELECT content FROM ticket_inbound WHERE id = ?", (iid,)).fetchone()[0] is None, "the text left the table"


def test_the_account_filter_drops_events_of_other_accounts_before_any_row(env):
    t, _ = _sent_ticket(env)
    env.tick()
    env.inbound(FakeHaWhatsapp.received(PHONE_A_E164, "1", at=env.clock(), entry_id="01JSOMEOTHERNUMBER"))
    with env.s4.db.connection(mode="read") as conn:
        assert conn.execute("SELECT COUNT(*) FROM ticket_inbound").fetchone()[0] == 0
    assert env.s4.w.detail(t["id"])["status"] == "assigned"
    env.inbound(FakeHaWhatsapp.received(PHONE_A_E164, "1", at=env.clock()))  # no entry_id: processed as in r1
    assert env.s4.w.detail(t["id"])["status"] == "acknowledged"


def test_a_button_tap_from_a_lid_sender_is_decided_by_the_nonce_alone(env):
    env.channel(whatsapp={"use_buttons": True})
    t, _ = _sent_ticket(env)
    env.tick()
    call = env.fake.calls[0]
    assert call["service"] == "send_buttons"
    button_id = call["data"]["buttons"][1]["id"]  # t:<nonce>:wip
    event = {"event_type": "whatsapp_button_pressed", "data": {"sender": "123456789012345@lid", "sender_number": "", "button_id": button_id,
                                                                "button_text": "בטיפול", "timestamp": int(env.clock().timestamp()), "entry_id": ENTRY_A}}
    env.inbound(event)
    assert env.s4.w.detail(t["id"])["status"] == "in_progress"


def test_a_reply_without_the_switch_or_subscription_is_not_taken(env):
    env.channel(whatsapp={"enabled": False})
    assert messaging.submit_inbound(FakeHaWhatsapp.received(PHONE_A_E164, "1", at=env.clock())) is False


def test_the_reply_subscription_follows_the_mapping_changed_on_another_screen(env, monkeypatch):
    from smplwise.services import ha_sync

    told: list = []
    monkeypatch.setattr(ha_sync.SYNC, "tickets_inbound_switched", lambda want: told.append(want))
    env.rt._sub_want = None
    env.mapping({"tickets.messages": None})  # Settings › ערוץ ההודעות: no account for the ticket messages any more
    env.tick()
    assert told == [False] and messaging.submit_inbound(FakeHaWhatsapp.received(PHONE_A_E164, "1", at=env.clock())) is False
    env.mapping({"tickets.messages": KEY_A})  # mapped again: the worker's watch subscribes without a restart
    env.tick()
    env.tick()
    assert told == [False, True], "told once per change"
    env.channel(whatsapp={"enabled": False})
    assert told == [False, True, False]


# ---------------------------------------------------------------- message templates (D26) and the update / notices

def test_message_templates_per_language_validate_preview_and_render(env):
    r = env.c.post(f"{API}/tickets/admin/message-templates", json={"purpose": "assign", "lang": "he", "body": "בדיקה {number}: {title}"})
    assert r.status_code == 422 and {"code": "link_required", "field": "body"} in r.json()["details"]["fields"]
    r = env.c.post(f"{API}/tickets/admin/message-templates/preview", json={"purpose": "assign", "lang": "he", "body": "{module_name} {number}: {title}\n{link}"})
    assert r.status_code == 200 and "1042" in r.json()["text"] and "[קישור]" in r.json()["text"]
    r = env.c.post(f"{API}/tickets/admin/message-templates", json={"purpose": "assign", "lang": "he", "body": "שלום {name}! מספר {number}\n{link}"})
    assert r.status_code == 201, r.text
    assert env.c.post(f"{API}/tickets/admin/message-templates", headers=env.h("mona"),
                      json={"purpose": "assign", "lang": "en", "body": "x {link}"}).status_code == 403
    t, _ = _sent_ticket(env)
    env.tick()
    assert env.fake.calls[0]["data"]["message"].startswith("שלום משה אברהם! מספר")
    en = env.s4.add_contact(display_name="John Vendor", phone="050-000-0051", lang="en").json()
    t2, _ = _sent_ticket(env, contact_id=en["id"])
    env.tick(seconds=30)
    assert env.fake.calls[1]["data"]["message"].startswith("Hello John Vendor"), "no English template: the English starter (D26)"
    listing = env.c.get(f"{API}/tickets/admin/message-templates").json()
    assert len(listing["items"]) == 1 and set(listing["langs"]) == {"he", "en", "ar", "ru"}


def test_send_update_after_an_edit_and_the_closed_notice(env):
    t, _ = _sent_ticket(env)
    env.tick()
    rev = env.s4.w.detail(t["id"])["revision"]
    assert env.c.patch(f"{API}/tickets/{t['id']}", json={"title": "מזגן מטפטף", "revision": rev}).status_code == 200
    assert env.s4.w.detail(t["id"])["external_stale"] is True
    r = env.c.post(f"{API}/tickets/{t['id']}/send-update")
    assert r.status_code == 200, r.text and r.json()["external_stale"] is False
    env.tick(seconds=30)
    assert "מזגן מטפטף" in env.fake.calls[-1]["data"]["message"]
    assert any(e["kind"] == "update_sent" for e in env.events(t["id"]))
    assert env.s4.w.status("joni", t["id"], "closed", note="טופל").status_code == 200
    env.tick(seconds=30)
    notice = [x for x in env.rows(t["id"]) if x.purpose == "closed"]
    assert notice and notice[0].state == "sent" and str(t["number"]) in env.fake.calls[-1]["data"]["message"]


def test_the_test_send_of_slice_5a_is_wired_and_the_number_is_never_stored(env, monkeypatch):
    monkeypatch.setenv(mr.TEST_SEND_ENV, "1")
    r = env.c.post(f"{API}/messaging/whatsapp/test", json={"account_key": KEY_A, "target": "15555550199"})
    assert r.status_code in (200, 201, 202), r.text
    env.tick()
    assert env.fake.calls[-1]["data"]["target"] == "15555550199" and env.fake.calls[-1]["data"]["account"] == ENTRY_A
    raw = env.s4.db.path.read_bytes()
    assert b"15555550199" not in raw


# ---------------------------------------------------------------- the channel settings, routes and guards

def test_the_channel_settings_are_system_configure_and_show_the_ticket_uses(env):
    v = env.c.get(f"{API}/tickets/channel").json()
    assert v["whatsapp"]["enabled"] is True and v["inbound"]["wanted"] is True
    assert any(u["key"] == "tickets.messages" and u["resolved"] == KEY_A for u in v["uses"])
    assert any(a["key"] == KEY_A and a["ticket"] for a in v["accounts"])
    assert env.c.get(f"{API}/tickets/channel", headers=env.h("mona")).status_code == 403
    r = env.c.put(f"{API}/tickets/channel", json={"revision": 0, "whatsapp": {"enabled": False}})
    assert r.status_code == 409 and r.json()["code"] == "settings_stale"


def test_the_ticket_routes_answer_the_uniform_404_for_an_invisible_ticket(env):
    t, _ = _sent_ticket(env)
    row = env.rows(t["id"])[0]
    for path in (f"/tickets/{t['id']}/outbox/{row.id}/send-now", f"/tickets/{t['id']}/outbox/{row.id}/resend", f"/tickets/{t['id']}/send-update"):
        for user in ("cleo", "dina"):
            r = env.c.post(API + path, headers=env.h(user))
            assert r.status_code == 404 and r.json()["code"] == "ticket_not_found", (path, user, r.text)


def test_an_outbox_write_without_a_bound_connection_is_refused(env):
    store = obs.SqliteOutboxStore(env.s4.db)
    with pytest.raises(obs.Unbound):
        store.insert(OutboxRow(id="x1", purpose="assign", channel="whatsapp", use_key="tickets.messages", created_at=DAY, not_before=DAY))


def test_a_row_left_sending_by_a_crash_becomes_unknown_at_start(env):
    t, _ = _sent_ticket(env)
    with env.s4.db.connection() as conn:
        conn.execute("UPDATE ticket_outbox SET state = 'sending', account_key = ? WHERE ticket_id = ?", (KEY_A, t["id"]))
    env.rt.outbox.recover_after_restart(env.clock())
    row = env.rows(t["id"])[0]
    assert (row.state, row.outcome_code) == ("unknown", "interrupted")


def test_a_slow_provider_call_never_holds_the_write_lock(env):
    """The lock order (outbox_store module note): while the worker waits for WhatsApp, a request can assign - neither the database
    write gate nor the outbox lock is held across the provider call."""
    t1, _ = _sent_ticket(env)
    gate = threading.Event()
    real_call = env.fake.call

    def slow(*a, **kw):
        gate.wait(10)
        return real_call(*a, **kw)

    env.fake.call = slow  # type: ignore[method-assign]
    worker = threading.Thread(target=env.tick)
    worker.start()
    time.sleep(0.5)
    started = time.monotonic()
    t2 = env.s4.ticket()
    r = env.s4.assign_contact(t2["id"])
    took = time.monotonic() - started
    gate.set()
    worker.join(15)
    assert r.status_code == 200 and took < 8, f"the request waited {took:.1f} s for the provider call"
    assert env.rows(t1["id"])[0].state == "sent"


def test_an_idle_installation_never_takes_the_write_lock(env, monkeypatch):
    ticks: list = []
    monkeypatch.setattr(env.rt.outbox, "tick", lambda now: ticks.append(now) or 0)
    env.rt._last_full = 0.0
    assert env.rt.run_once(env.clock()) == 0 and ticks == [], "no open row: not even the minute's full tick"
    _sent_ticket(env)
    env.rt.run_once(env.clock())
    assert len(ticks) == 1, "a queued row is due: the worker ticks"


def test_logs_and_rows_never_carry_the_number_the_token_or_the_text(env, caplog):
    caplog.set_level(logging.DEBUG)
    t, _ = _sent_ticket(env)
    env.tick()
    token = env.s4.token_of(t["id"])
    env.inbound(FakeHaWhatsapp.received(PHONE_A_E164, "סודי ביותר", at=env.clock(), entry_id=ENTRY_A))
    text = caplog.text
    for secret in (PHONE_A_E164, token, "סודי ביותר", "15555550191"):
        assert secret not in text, secret
    with env.s4.db.connection(mode="read") as conn:
        outbox = json.dumps([dict(r) for r in conn.execute("SELECT * FROM ticket_outbox").fetchall()], ensure_ascii=False)
        audits = json.dumps([dict(r) for r in conn.execute("SELECT * FROM audit_log WHERE action LIKE 'ticket.%'").fetchall()], ensure_ascii=False)
        inbound = json.dumps([dict(r) for r in conn.execute("SELECT * FROM ticket_inbound").fetchall()], ensure_ascii=False)
    for blob in (outbox, audits):
        assert PHONE_A_E164 not in blob and token not in blob and "/t/#" not in blob
    assert PHONE_A_E164 not in inbound


def test_migration_0081_tables_and_indexes(env):
    with env.s4.db.connection(mode="read") as conn:
        names = {r[0] for r in conn.execute("SELECT name FROM sqlite_master").fetchall()}
        cols = {r[1] for r in conn.execute("PRAGMA table_info(ticket_outbox)").fetchall()}
    assert {"ticket_outbox", "ticket_inbound", "idx_ticket_outbox_queue", "idx_ticket_outbox_idempotency", "idx_ticket_inbound_open"} <= names
    assert {"held_since", "first_attempt_at", "resend_of", "code_id", "idempotency_key", "send_now"} <= cols
    assert not ({"phone", "phone_e164", "email", "token", "code", "text", "message"} & cols)
