"""CR-038 9.2 / 9.5 / 9.9.4: the outbox with a fake clock and a fake ha-whatsapp - states, idempotency, supersede, send hours,
holds, retries, `unknown` never re-sent, fallbacks (e-mail with the redeem link, nobody -> manager), D6 code rule, account moves
and disconnects, module off, restart recovery, pacing, and a property test over random operation sequences."""
from __future__ import annotations

from smplwise.services.tickets import naming  # slice 5b: the module's default name is read, never written
import dataclasses
import datetime as dt
import random

import pytest
from fake_ha_whatsapp import PairedAccount
from tickets_msg_fakes import (ENTRY_A, ENTRY_B, KEY_A, KEY_B, PHONE_VENDOR, T0, TZ, assign, default_doc, make_env)

from smplwise.services import messaging_accounts as ma
from smplwise.services.tickets import outbox as ob

UTC = dt.timezone.utc


def night(env):  # 23:00 local of the start day
    env.clock.t = dt.datetime(2026, 10, 13, 23, 0, tzinfo=TZ).astimezone(UTC)


class Recorder:
    """Wraps the WhatsApp channel to record which outbox row each provider call belonged to."""

    def __init__(self, inner):
        self.inner, self.ids = inner, []

    def __getattr__(self, name):
        return getattr(self.inner, name)

    def send(self, msg):
        self.ids.append(msg.outbox_id)
        return self.inner.send(msg)


def recorded(env) -> Recorder:
    rec = Recorder(env.whatsapp)
    env.outbox.p.channels = {**env.outbox.p.channels, "whatsapp": rec}
    return rec


# ---------------------------------------------------------------- the happy path and the model

def test_assign_is_written_then_sent_from_the_account_resolved_at_claim():
    env = make_env()
    row = assign(env)
    assert row.state == "queued" and row.account_key is None and row.priority == 1 and row.reply_nonce
    assert "link" not in row.params and env.hooks.kinds(row.id) == ["queued"]
    assert env.tick() == 1
    done = env.row(row.id)
    assert done.state == "sent" and done.account_key == KEY_A and done.attempts == 1 and done.provider_message_id
    [call] = env.fake.calls
    assert call["data"]["account"] == ENTRY_A and call["data"]["target"] == PHONE_VENDOR
    assert env.links.url("L1") in call["data"]["message"] and f"{naming.DEFAULTS['he']['one']} 1042 (אחזקה)" in call["data"]["message"]
    assert env.links.notes == [("L1", "whatsapp", "assign")]
    assert ("outcome", row.id, ("sent", None, KEY_A, "שירות ····0001")) in env.hooks.events
    assert len(env.ledger.rows) == 1 and env.ledger.rows[0][3] == "message" and PHONE_VENDOR not in str(env.ledger.rows)


def test_enqueue_validation():
    env = make_env()
    env.links.mint("L1")
    env.directory.add("c1")
    with pytest.raises(ob.OutboxError, match="link_required"):
        env.outbox.enqueue(purpose="assign", now=T0, contact_id="c1")
    with pytest.raises(ob.OutboxError, match="param_not_allowed"):
        env.outbox.enqueue(purpose="assign", now=T0, contact_id="c1", link_id="L1", params={"link": "x"})
    with pytest.raises(ob.OutboxError, match="code_invalid"):
        env.outbox.enqueue(purpose="code", now=T0, contact_id="c1", link_id="L1", code="12345")
    with pytest.raises(ob.OutboxError, match="purpose_unknown"):
        env.outbox.enqueue(purpose="escalation", now=T0, contact_id="c1")
    with pytest.raises(ob.OutboxError, match="contact_required"):
        env.outbox.enqueue(purpose="closed", now=T0)
    with pytest.raises(ob.OutboxError, match="channel_unknown"):
        env.outbox.enqueue(purpose="closed", now=T0, contact_id="c1", channel="sms")


def test_idempotency_key_returns_the_first_row():
    env = make_env()
    first = assign(env, idempotency_key="req-1")
    again = assign(env, idempotency_key="req-1")
    assert again.id == first.id and len(env.store.rows) == 1
    env.drain()
    assert len(env.fake.calls) == 1


def test_a_newer_message_supersedes_a_queued_one_of_the_same_purpose():
    env = make_env()
    night(env)
    old = assign(env, purpose="reminder")
    env.tick()
    assert env.row(old.id).state == "held"
    new = assign(env, purpose="reminder")
    assert env.row(old.id).state == "superseded" and env.row(new.id).state == "queued"
    assert ("cancelled", old.id, "superseded") in env.hooks.events
    other = env.outbox.enqueue(purpose="closed", now=env.clock.now(), contact_id="c1", ticket_id="T1", assignment_id="A1")
    assert env.row(new.id).state == "queued" and other.link_id is None  # another purpose: no supersede


def test_a_revoked_link_cancels_its_open_messages():
    env = make_env()
    night(env)
    row = assign(env, purpose="reminder")
    env.tick()
    env.links.revoked.add("L1")
    env.clock.t = dt.datetime(2026, 10, 14, 7, 0, tzinfo=TZ).astimezone(UTC)
    env.tick()
    assert env.row(row.id).state == "cancelled" and env.row(row.id).outcome_code == "link_not_live" and env.fake.calls == []
    row2 = assign(env, link="L2", assignment="A2", purpose="reminder")
    assert [r.id for r in env.outbox.cancel_where("link_revoked", env.clock.now(), link_id="L2")] == [row2.id]
    with pytest.raises(ob.OutboxError):
        env.outbox.cancel_where("x", env.clock.now())


# ---------------------------------------------------------------- send hours (D4, D29)

def test_messages_wait_for_the_morning_codes_do_not():
    env = make_env()
    night(env)
    reminder = assign(env, purpose="reminder")
    a = assign(env, link="L2", assignment="A2")
    code = env.outbox.enqueue(purpose="code", now=env.clock.now(), contact_id="c1", link_id="L1", assignment_id="A1", ticket_id="T1",
                              department_id="D1", code="482913")
    env.tick()
    morning = dt.datetime(2026, 10, 14, 7, 0, tzinfo=TZ).astimezone(UTC)
    assert env.row(code.id).state == "sent" and "482913" in env.fake.calls[0]["data"]["message"]
    assert "https://" not in env.fake.calls[0]["data"]["message"] and "מזגן" not in env.fake.calls[0]["data"]["message"]
    for r in (reminder, a):
        assert env.row(r.id).state == "held" and env.row(r.id).held_reason == "send_hours" and env.row(r.id).not_before == morning
    env.tick(hours=1)
    assert len(env.fake.calls) == 1
    env.clock.t = morning
    env.drain()
    assert env.row(reminder.id).state == "sent" and env.row(a.id).state == "sent"


def test_assign_with_send_now_leaves_at_night_and_send_now_releases_a_held_row():
    env = make_env()
    night(env)
    urgent = assign(env, send_now=True)
    env.tick()
    assert env.row(urgent.id).state == "sent"
    held = assign(env, link="L2", assignment="A2", purpose="reminder")
    env.tick(seconds=30)
    assert env.row(held.id).state == "held"
    env.outbox.send_now(held.id, env.clock.now())
    env.tick(seconds=30)
    assert env.row(held.id).state == "sent"
    with pytest.raises(ob.OutboxError, match="not_held_by_hours"):
        env.outbox.send_now(held.id, env.clock.now())


def test_send_now_is_refused_for_other_hold_reasons():
    env = make_env(doc=ma.MappingDoc(1, (), {}))
    row = assign(env)
    env.tick()
    assert env.row(row.id).held_reason == "account_unmapped"
    with pytest.raises(ob.OutboxError):
        env.outbox.send_now(row.id, env.clock.now())


def test_department_send_window_override():
    env = make_env()
    env.ctx.dept_windows["D1"] = {"from": "12:00", "to": "13:00"}
    row = assign(env)  # 11:00 local
    env.tick()
    assert env.row(row.id).held_reason == "send_hours"
    assert env.row(row.id).not_before == dt.datetime(2026, 10, 13, 12, 0, tzinfo=TZ).astimezone(UTC)


# ---------------------------------------------------------------- unknown, retries, refusals

def test_unknown_is_final_never_retried_never_falls_back():
    env = make_env()
    env.directory.add("c1", email="vendor@example.test")
    env.fake.queue("timeout")
    row = assign(env)
    env.tick()
    assert env.row(row.id).state == "unknown" and env.row(row.id).outcome_code == "timeout"
    for _ in range(50):
        env.tick(minutes=10)
    assert len(env.fake.calls) == 1 and env.email.sent == [] and len(env.store.rows) == 1
    assert len(env.ledger.rows) == 1  # it may have left: it counts against the budget
    assert env.links.via["L1"] == "whatsapp"  # the D6 rule assumes it arrived
    again = env.outbox.resend(row.id, requested_by="u-manager", now=env.clock.now())
    assert again.resend_of == row.id and again.reply_nonce != row.reply_nonce
    env.tick(seconds=30)
    assert env.row(row.id).state == "unknown" and env.row(again.id).state == "sent"


def test_not_sent_is_retried_then_succeeds():
    env = make_env()
    env.fake.queue("connect", "connect")
    row = assign(env)
    env.tick()
    assert env.row(row.id).state == "queued" and env.row(row.id).attempts == 1
    env.tick(minutes=1)
    assert len(env.fake.calls) == 1  # waits 2 minutes
    env.tick(minutes=1, seconds=1)
    env.tick(minutes=8)
    assert env.row(row.id).state == "sent" and env.row(row.id).attempts == 3


def test_not_sent_after_the_retries_falls_back_to_e_mail_with_the_redeem_link():
    env = make_env()
    env.directory.add("c1", email="vendor@example.test")
    env.fake.default = "connect"
    row = assign(env)
    env.drain(step_s=60)
    final = env.row(row.id)
    assert final.state == "not_sent" and final.attempts == ob.MAX_ATTEMPTS and len(env.fake.calls) == ob.MAX_ATTEMPTS
    [mail] = env.email.sent
    assert "/t/r/" in mail.text and "/t/#" not in mail.text and env.links.tokens["L1"] not in mail.text
    fb = [r for r in env.store.rows.values() if r.fallback_of == row.id]
    assert len(fb) == 1 and fb[0].channel == "email" and fb[0].state == "sent" and fb[0].reply_nonce is None
    assert ("send_failed", row.id, "T1") in env.hooks.events
    assert ("fallback", row.id, ("email", fb[0].id)) in env.hooks.events


def test_refused_falls_back_at_once_and_nobody_reachable_goes_to_the_manager():
    env = make_env()
    env.fake.queue("refused")
    row = assign(env)  # the contact has no e-mail
    env.tick()
    assert env.row(row.id).state == "refused" and len(env.fake.calls) == 1
    assert ("fallback", row.id, ("nobody", None)) in env.hooks.events and env.email.sent == []


def test_a_contact_without_a_phone_goes_straight_to_e_mail():
    env = make_env()
    env.directory.add("c1", phone=None, email="vendor@example.test")
    row = assign(env)
    env.drain()
    assert env.row(row.id).outcome_code == "no_phone" and env.fake.calls == [] and len(env.email.sent) == 1


def test_e_mail_fallback_switch_and_smtp():
    for kw in ({"email_on": False}, {"smtp": False}):
        env = make_env()
        for k, v in kw.items():
            setattr(env.ctx, k, v)
        env.directory.add("c1", email="vendor@example.test")
        env.fake.queue("refused")
        row = assign(env)
        env.tick()
        assert ("fallback", row.id, ("nobody", None)) in env.hooks.events and env.email.sent == []


def test_e_mail_is_capped_per_hour():
    env = make_env()
    for i in range(12):
        env.directory.add(f"c{i}", phone=None, email=f"v{i}@example.test")
        assign(env, contact=f"c{i}", link=f"L{i}", assignment=f"A{i}")
    for _ in range(40):
        env.tick(seconds=30)
    assert len(env.email.sent) == ob.EMAIL_PER_HOUR
    env.tick(hours=1)
    env.drain()
    assert len(env.email.sent) == 12


# ---------------------------------------------------------------- accounts: unmapped, down, moved (9.9.4)

def test_unmapped_use_holds_then_falls_back():
    env = make_env(doc=ma.MappingDoc(1, (), {"tickets.messages": None}))
    env.directory.add("c1", email="vendor@example.test")
    row = assign(env)
    env.tick()
    assert env.row(row.id).held_reason == "account_unmapped"
    env.tick(minutes=14)
    assert env.row(row.id).state == "held"
    env.tick(minutes=1)
    assert env.row(row.id).state == "not_sent" and env.row(row.id).outcome_code == "account_unmapped"
    env.drain()
    assert len(env.email.sent) == 1 and env.fake.calls == []


def test_disconnected_account_holds_reconnect_sends_no_automatic_switch():
    env = make_env(accounts=[PairedAccount(ENTRY_A, "1", connected=False), PairedAccount(ENTRY_B, "2")])
    row = assign(env)
    env.tick()
    assert env.row(row.id).held_reason == "channel_down" and env.fake.calls == []  # account B is up, but never used silently
    env.fake.accounts[0].connected = True
    env.tick(minutes=5)
    assert env.row(row.id).state == "sent" and env.fake.accounts_used() == [ENTRY_A]


def test_a_row_that_fell_back_is_not_sent_again_when_the_account_returns():
    env = make_env(accounts=[PairedAccount(ENTRY_A, "1", connected=False)])
    env.directory.add("c1", email="vendor@example.test")
    row = assign(env)
    env.tick()
    env.tick(minutes=16)
    env.drain()
    assert env.row(row.id).state == "not_sent" and len(env.email.sent) == 1
    env.fake.accounts[0].connected = True
    for _ in range(20):
        env.tick(minutes=5)
    assert env.fake.calls == []


def test_queued_rows_leave_from_the_new_account_after_a_move():
    env = make_env()
    night(env)
    held = assign(env)
    env.tick()
    assert env.outbox.open_count("tickets.messages") == 1
    env.doc[0] = default_doc(**{"tickets.messages": KEY_B})
    env.clock.t = dt.datetime(2026, 10, 14, 7, 0, tzinfo=TZ).astimezone(UTC)
    env.tick()
    assert env.row(held.id).state == "sent" and env.row(held.id).account_key == KEY_B and env.fake.accounts_used() == [ENTRY_B]
    label = [e for e in env.hooks.events if e[0] == "outcome"][0][2][3]
    assert label == "שני ····0002"  # the timeline names the account it left from


def test_an_in_flight_row_finishes_on_the_account_it_was_claimed_with():
    env = make_env()
    row = assign(env)
    original = env.fake.call

    def move_during_call(*a, **k):
        env.doc[0] = default_doc(**{"tickets.messages": KEY_B})
        return original(*a, **k)

    env.fake.call = move_during_call
    env.tick()
    assert env.row(row.id).account_key == KEY_A and env.fake.accounts_used() == [ENTRY_A]


def test_department_override_and_one_in_flight_per_account():
    env = make_env(doc=default_doc(**{"tickets.messages__D2": KEY_B}))
    env.directory.add("c2")
    a = assign(env)
    b = assign(env, contact="c2", link="L2", assignment="A2", dept="D2")
    c = assign(env, contact="c2", link="L3", assignment="A3", dept="D1")
    assert env.tick() == 2  # A and B in parallel, the second row of A waits
    assert env.row(a.id).account_key == KEY_A and env.row(b.id).account_key == KEY_B and env.row(c.id).state == "queued"
    env.tick(seconds=1)
    assert env.row(c.id).state == "queued" and env.row(c.id).not_before > env.clock.now()  # the minimum gap
    env.tick(seconds=30)
    assert env.row(c.id).state == "sent"


def test_per_recipient_cap_holds_the_fifth_message_codes_excluded():
    env = make_env()
    rows = [assign(env, link=f"L{i}", assignment=f"A{i}") for i in range(5)]
    for _ in range(10):
        env.tick(seconds=30)
    states = [env.row(r.id).state for r in rows]
    assert states.count("sent") == 4 and env.row(rows[4].id).state == "queued"
    code = env.outbox.enqueue(purpose="code", now=env.clock.now(), contact_id="c1", link_id="L0", assignment_id="A0", code="000111")
    env.tick(seconds=30)
    assert env.row(code.id).state == "sent"  # a code is not stopped by the recipient cap
    env.tick(hours=1)
    assert env.row(rows[4].id).state == "sent"


# ---------------------------------------------------------------- codes and the D6 rule

def test_code_falls_back_to_e_mail_only_when_its_link_did_not_go_by_e_mail():
    for via, expect in (("whatsapp", "email"), ("email", "code_unavailable")):
        env = make_env(accounts=[PairedAccount(ENTRY_A, "1", connected=False)])
        env.directory.add("c1", email="vendor@example.test")
        env.links.mint("L1", requires_code=True)
        env.links.via["L1"] = via
        row = env.outbox.enqueue(purpose="code", now=env.clock.now(), contact_id="c1", link_id="L1", assignment_id="A1", code="314159")
        env.tick()
        env.tick(minutes=ob.CODE_HOLD_MIN)
        assert env.row(row.id).state == "not_sent"
        steps = [e[2][0] for e in env.hooks.events if e[0] == "fallback"]
        assert steps == [expect]
        env.drain()
        if expect == "email":
            assert "314159" in env.email.sent[0].text and "/t/" not in env.email.sent[0].text
        else:
            assert env.email.sent == []


def test_a_code_protected_link_goes_by_e_mail_only_if_the_code_can_still_go_by_whatsapp():
    env = make_env(accounts=[PairedAccount(ENTRY_A, "1", connected=False), PairedAccount(ENTRY_B, "2")],
                   doc=default_doc(**{"tickets.codes": KEY_B}))
    env.directory.add("c1", email="vendor@example.test")
    env.links.mint("L1", requires_code=True)
    row = assign(env)
    env.tick()
    env.tick(minutes=16)
    assert [e[2][0] for e in env.hooks.events if e[0] == "fallback"] == ["email"]  # the codes account (B) is up
    env2 = make_env(accounts=[PairedAccount(ENTRY_A, "1", connected=False)])
    env2.directory.add("c1", email="vendor@example.test")
    env2.links.mint("L1", requires_code=True)
    row2 = assign(env2)
    env2.tick()
    env2.tick(minutes=16)
    assert [e[2][0] for e in env2.hooks.events if e[0] == "fallback"] == ["nobody"]
    assert row.id and row2.id


@pytest.mark.parametrize("wa,codes_wa,email,ok", [(True, True, True, True), (True, False, True, True), (False, False, True, False),
                                                   (False, True, True, True), (False, False, False, False), (True, False, False, False)])
def test_assignment_code_check(wa, codes_wa, email, ok):
    assert ob.assignment_code_check(whatsapp_ok=wa, codes_whatsapp_ok=codes_wa, email_ok=email) is ok


def test_code_route():
    assert ob.code_route(link_sent_via="email", whatsapp_ok=True, email_ok=True) == "whatsapp"
    assert ob.code_route(link_sent_via="manual", whatsapp_ok=False, email_ok=True) == "email"
    assert ob.code_route(link_sent_via="email", whatsapp_ok=False, email_ok=True) is None


def test_the_code_is_never_written_to_the_row():
    env = make_env()
    env.links.mint("L1")
    env.directory.add("c1")
    row = env.outbox.enqueue(purpose="code", now=env.clock.now(), contact_id="c1", link_id="L1", code="271828")
    assert "271828" not in repr(row) and "271828" not in str(dataclasses.asdict(row))
    env.tick()
    assert env.outbox.p.secrets.code(row.id) is None  # dropped once final


def test_a_code_lost_in_a_restart_is_not_sent():
    env = make_env()
    env.links.mint("L1")
    env.directory.add("c1")
    row = env.outbox.enqueue(purpose="code", now=env.clock.now(), contact_id="c1", link_id="L1", code="271828")
    env.outbox.p.secrets.drop(row.id)  # what a restart does
    env.tick()
    assert env.row(row.id).outcome_code == "code_lost" and env.fake.calls == []


# ---------------------------------------------------------------- module off, restart, test sends, languages

def test_module_off_holds_and_reenable_drops_stale_rows():
    env = make_env()
    env.ctx.on = False
    keep = assign(env)
    stale = assign(env, link="L2", assignment="A2", purpose="reminder")
    env.tick()
    assert {env.row(keep.id).held_reason, env.row(stale.id).held_reason} == {"module_off"} and env.fake.calls == []
    env.ctx.on = True
    env.hooks.relevant = lambda row: row.purpose != "reminder"
    env.drain()
    assert env.row(keep.id).state == "sent" and env.row(stale.id).state == "cancelled"


def test_a_row_left_sending_by_a_crash_becomes_unknown():
    env = make_env()
    row = assign(env)
    claimed = env.outbox._claim(row, env.clock.now(), KEY_A)  # the process died inside the provider call
    assert claimed.state == "sending"
    [rec] = env.outbox.recover_after_restart(env.clock.now())
    assert rec.state == "unknown" and rec.outcome_code == "interrupted" and len(env.ledger.rows) == 1
    env.drain()
    assert env.fake.calls == []


def test_test_send_uses_the_named_account_and_is_never_held():
    env = make_env()
    night(env)
    row = env.outbox.enqueue(purpose="test", now=env.clock.now(), test_target="+1 555 555 0177", test_account_key=KEY_B)
    assert "5550177" not in str(dataclasses.asdict(row))
    env.tick()
    assert env.row(row.id).state == "sent" and env.fake.calls[0]["data"]["target"] == "15555550177"
    assert env.fake.accounts_used() == [ENTRY_B] and env.ledger.rows[0][3] == "test"
    down = make_env(accounts=[PairedAccount(ENTRY_A, "1", connected=False)])
    r2 = down.outbox.enqueue(purpose="test", now=down.clock.now(), test_target="15555550177", test_account_key=KEY_A)
    down.tick()
    assert down.row(r2.id).state == "not_sent" and down.fake.calls == [] and not [e for e in down.hooks.events if e[0] == "fallback"]
    with pytest.raises(ob.OutboxError):
        env.outbox.enqueue(purpose="test", now=env.clock.now(), test_target="123", test_account_key=KEY_A)


def test_contact_language_and_buttons():
    env = make_env(use_buttons=True)
    env.directory.add("c1", lang="ar")
    row = assign(env)
    env.tick()
    call = env.fake.calls[0]
    assert call["service"] == "send_buttons" and "مرحبًا" in call["data"]["message"]
    assert call["data"]["buttons"][0] == {"id": f"t:{row.reply_nonce}:ack", "displayText": "تم الاستلام"}
    assert call["data"]["footer"] == f"{naming.DEFAULTS['ar']['one']} 1042"


def test_a_contact_template_in_the_department_is_used():
    from smplwise.services.tickets.message_templates import TemplateText

    env = make_env()
    env.tpl.items.append(TemplateText("tp1", "assign", "he", "בקשה דחופה {number}: {link}", department_id="D1", revision=3))
    assign(env)
    env.tick()
    assert env.fake.calls[0]["data"]["message"].startswith("בקשה דחופה 1042: https://")


# ---------------------------------------------------------------- property: random operations keep the invariants

def test_property_random_operations_keep_the_invariants():
    for seed in range(12):
        rng = random.Random(seed)
        env = make_env(seed=seed)
        rec = recorded(env)
        env.directory.add("c2", email="v2@example.test")
        env.fake.default = "ok"
        history: dict[str, list[str]] = {}
        made = []
        for step in range(160):
            op = rng.random()
            now = env.clock.now()
            if op < 0.25:
                i = rng.randint(0, 5)
                made.append(assign(env, contact=rng.choice(["c1", "c2"]), link=f"L{i}", assignment=f"A{i}",
                                   purpose=rng.choice(["assign", "reminder", "update"]), dept=rng.choice(["D1", "D2"])))
            elif op < 0.3:
                env.links.revoked.add(f"L{rng.randint(0, 5)}")
            elif op < 0.35:
                env.fake.accounts[rng.randint(0, 1)].connected = rng.random() < 0.7
            elif op < 0.4:
                env.doc[0] = default_doc(**{"tickets.messages": rng.choice([KEY_A, KEY_B, None])})
            elif op < 0.45 and made:
                r = env.store.get(rng.choice(made).id)
                if r.state in ("unknown", "not_sent", "refused") and r.purpose != "code":
                    made.append(env.outbox.resend(r.id, requested_by="u", now=now))
            elif op < 0.5:
                env.ctx.on = rng.random() < 0.8
            env.fake.queue(rng.choice(["ok", "ok", "ok", "timeout", "connect", "refused", "http500", "unknown_account"]))
            env.tick(seconds=rng.choice([1, 20, 60, 600, 3600]))
            for r in env.store.rows.values():
                history.setdefault(r.id, [])
                if not history[r.id] or history[r.id][-1] != r.state:
                    history[r.id].append(r.state)
        env.fake.script.clear()
        for r_id, states in history.items():
            # final states never change
            for a, b in zip(states, states[1:]):
                assert a not in ob.TERMINAL_STATES, (seed, r_id, states)
            row = env.store.get(r_id)
            calls = rec.ids.count(r_id)
            assert calls <= ob.MAX_ATTEMPTS
            if row.state == "unknown":
                # never re-sent and never fallen back: no row names it as its fallback source
                assert not any(x.fallback_of == r_id for x in env.store.rows.values())
            if row.fallback_of:
                assert env.store.get(row.fallback_of).state in ("not_sent", "refused")
                assert row.channel == "email" and rec.ids.count(r_id) == 0
            if row.state == "sent" and row.channel == "whatsapp":
                assert row.account_key in (KEY_A, KEY_B)


# ---------------------------------------------------------------- threads

def test_enqueue_does_not_wait_for_a_slow_provider_call():
    import threading

    env = make_env()
    row = assign(env)
    entered, release = threading.Event(), threading.Event()
    original = env.fake.call

    def slow(*a, **k):
        entered.set()
        assert release.wait(5)
        return original(*a, **k)

    env.fake.call = slow
    worker = threading.Thread(target=env.tick)
    worker.start()
    assert entered.wait(5)
    other = {}
    t = threading.Thread(target=lambda: other.setdefault("row", assign(env, link="L2", assignment="A2")))
    t.start()
    t.join(2)
    assert "row" in other, "enqueue blocked behind the provider call"
    assert env.row(row.id).state == "sending"
    release.set()
    worker.join(5)
    assert env.row(row.id).state == "sent" and env.row(other["row"].id).state == "queued"


def test_outbox_thread_recovers_drains_and_ticks():
    env = make_env()
    row = assign(env)
    env.outbox._claim(row, env.clock.now(), KEY_A)
    drained = []
    th = ob.OutboxThread(env.outbox, clock=env.clock.now, interval_s=0.01, drain_inbound=lambda now: drained.append(now))
    th.start()
    try:
        assert env.row(row.id).state == "unknown"  # recovered before the first tick
        fresh = assign(env, link="L2", assignment="A2")
        th.run_once()
        assert env.row(fresh.id).state == "queued"  # the recovered `unknown` counts: the minimum gap applies
        env.clock.advance(seconds=30)
        th.run_once()
        assert drained and env.row(fresh.id).state == "sent"
    finally:
        th.stop()

def test_codes_jump_the_queue():
    env = make_env()
    for c in ("c1", "c2", "c3"):
        env.directory.add(c)
    reminder = assign(env, contact="c2", link="L2", assignment="A2", purpose="reminder")
    a = assign(env, contact="c3", link="L3", assignment="A3")
    code = env.outbox.enqueue(purpose="code", now=env.clock.now(), contact_id="c1", link_id="L2", code="909090")
    rec = recorded(env)
    env.drain()
    assert rec.ids == [code.id, a.id, reminder.id]


def test_two_threads_ticking_never_put_two_messages_in_flight_on_one_account():
    import threading

    env = make_env()
    for i in range(3):
        env.directory.add(f"c{i}")
        assign(env, contact=f"c{i}", link=f"L{i}", assignment=f"A{i}")
    inflight, peak = [0], [0]
    original = env.fake.call
    gate = threading.Lock()

    def counting(*a, **k):
        with gate:
            inflight[0] += 1
            peak[0] = max(peak[0], inflight[0])
        threading.Event().wait(0.05)
        with gate:
            inflight[0] -= 1
        return original(*a, **k)

    env.fake.call = counting
    threads = [threading.Thread(target=env.tick) for _ in range(4)]
    for t in threads:
        t.start()
    for t in threads:
        t.join(5)
    assert peak[0] == 1 and len(env.fake.calls) == 1


@pytest.mark.parametrize("ago_s,count,ok,reason", [
    ([], 0, True, None), ([30], 1, False, "code_wait"), ([90], 1, True, None), ([90, 600, 1200], 3, False, "code_hour"),
    ([4000, 8000, 12000, 16000, 20000, 24000], 6, False, "code_day"), ([4000, 8000, 12000, 16000, 20000], 5, True, None)])
def test_code_request_limits_per_link(ago_s, count, ok, reason):
    now = T0
    got = ob.code_request_check([now - dt.timedelta(seconds=s) for s in ago_s], now)
    assert got[0] is ok and got[2] == reason and len(ago_s) == count
    if not ok:
        assert got[1] >= 1


def test_timeline_kinds():
    env = make_env()
    row = assign(env)
    env.tick()
    assert ob.timeline_kind(env.row(row.id)) == "link_sent"
    assert ob.timeline_kind(dataclasses.replace(env.row(row.id), state="unknown")) == "message_unknown"
    assert ob.timeline_kind(dataclasses.replace(env.row(row.id), state="refused")) == "message_failed"
    assert ob.timeline_kind(dataclasses.replace(env.row(row.id), purpose="code")) == "code_sent"
    assert ob.timeline_kind(env.row(row.id), fallback_step="email") == "message_fallback"
    assert ob.timeline_kind(dataclasses.replace(env.row(row.id), ticket_id=None)) is None