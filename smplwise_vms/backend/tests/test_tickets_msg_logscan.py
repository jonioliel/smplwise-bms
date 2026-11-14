"""CR-038 17 / 19 (log hygiene): run the send and inbound flows of the message core end to end on fakes - success, unknown,
retries, fallback to e-mail, a code, a test send, text and button replies, an ambiguous reply - with a capturing handler on the
root logger at DEBUG, and assert that no phone number, link token, redeem id, code or message text appears in any log record, in
any outbox hook record (the timeline / audit envelope of the wiring) or in any inbound audit envelope."""
from __future__ import annotations

import dataclasses
import datetime as dt
import logging

from fake_ha_whatsapp import FakeHaWhatsapp
from tickets_msg_fakes import ENTRY_A, PHONE_OTHER, PHONE_VENDOR, TICKETS_KEY, assign, make_env

from smplwise.services.tickets import inbound as ib
from smplwise.services.tickets.channel import keyed_hash

CODE = "583920"
TEST_TARGET = "15555550177"


class Capture(logging.Handler):
    def __init__(self) -> None:
        super().__init__(logging.DEBUG)
        self.lines: list[str] = []

    def emit(self, record: logging.LogRecord) -> None:
        self.lines.append(f"{record.name} {record.getMessage()} {record.args!r} {record.exc_text or ''}")


def test_no_secret_reaches_a_log_or_an_audit_envelope():
    cap = Capture()
    root = logging.getLogger()
    old_level = root.level
    root.addHandler(cap)
    root.setLevel(logging.DEBUG)
    for name in ("uvicorn.error", "uvicorn.access", "smplwise", "smplwise.tickets", "httpx"):
        logging.getLogger(name).setLevel(logging.DEBUG)
    try:
        env = make_env(use_buttons=True)
        env.directory.add("c1", email="vendor@example.test")
        env.directory.add("c2", phone=PHONE_OTHER, email="other@example.test")
        env.fake.queue("ok", "timeout", "connect", "connect", "connect", "connect")
        a = assign(env)
        b = assign(env, contact="c2", link="L2", assignment="A2")
        c = assign(env, link="L3", assignment="A3")
        env.directory.add("c3", phone=None, email="third@example.test")
        assign(env, contact="c3", link="L4", assignment="A4")  # no phone: straight to the e-mail fallback (redeem link)
        env.outbox.enqueue(purpose="code", now=env.clock.now(), contact_id="c1", link_id="L1", assignment_id="A1", code=CODE)
        env.outbox.enqueue(purpose="test", now=env.clock.now(), test_target=TEST_TARGET, test_account_key=f"entry:{ENTRY_A}")
        env.drain(step_s=60)
        env.outbox.resend(b.id, requested_by="u", now=env.clock.now()) if env.row(b.id).state == "unknown" else None
        env.drain(step_s=60)
        sent_texts = env.fake.sent_texts() + [m.text for m in env.email.sent]
        assert any(CODE in t for t in sent_texts) and any("/t/r/" in t for t in sent_texts)

        p = ib.InboundProcessor(key=TICKETS_KEY, directory=_Matches(env, a.reply_nonce), dedupe=ib.MemoryDedupe())
        now = env.clock.now()
        decisions = [
            p.process(FakeHaWhatsapp.received(PHONE_VENDOR, "׳׳’׳™׳¢ ׳׳—׳¨ ׳¢׳ ׳”׳˜׳›׳ ׳׳™ ׳©׳׳™", at=now), now),
            p.process(FakeHaWhatsapp.button(PHONE_VENDOR, f"t:{a.reply_nonce}:ack", at=now), now),
            p.process(FakeHaWhatsapp.received(PHONE_OTHER, "׳׳™ ׳–׳”? 0501234567", at=now), now),
            p.process(FakeHaWhatsapp.received("", "1", at=now, sender="123456789012345@lid"), now),
        ]
    finally:
        root.removeHandler(cap)
        root.setLevel(old_level)

    secrets = [PHONE_VENDOR, PHONE_OTHER, TEST_TARGET, CODE, "vendor@example.test", "other@example.test", "third@example.test",
               "׳׳’׳™׳¢ ׳׳—׳¨", "0501234567", "׳©׳׳•׳ ׳“׳ ׳™", "׳׳–׳’׳ ׳׳ ׳׳§׳¨׳¨", "123456789012345"]
    secrets += list(env.links.tokens.values())
    secrets += [t.split("/t/r/")[1] for t in sent_texts if "/t/r/" in t]
    logs = "\n".join(cap.lines)
    assert "outbox final" in logs and "inbound result=" in logs  # the capture really saw the flows
    hooks = repr(env.hooks.events)
    audits = repr([d.audit() for d in decisions]) + repr(decisions)
    rows = repr([dataclasses.asdict(r) for r in env.store.rows.values()])
    ledger = repr(env.ledger.rows)
    for s in secrets:
        assert s not in logs, f"log carries {s!r}"
        assert s not in hooks, f"hook record carries {s!r}"
        assert s not in audits, f"inbound envelope carries {s!r}"
        assert s not in ledger
        if s not in ("׳׳–׳’׳ ׳׳ ׳׳§׳¨׳¨", "׳©׳׳•׳ ׳“׳ ׳™"):  # the title is a template param (it is the ticket's own content)
            assert s not in rows, f"outbox row carries {s!r}"


class _Matches:
    def __init__(self, env, nonce: str) -> None:
        self.env, self.nonce = env, nonce

    def by_nonce(self, nonce: str):
        if nonce != self.nonce:
            return None
        return ib.NonceTarget("x", "T1", 1042, "D1", "A1", "c1", keyed_hash(TICKETS_KEY, PHONE_VENDOR), None, True, True, False, "assigned")

    def candidates(self, sender_key: str, *, since: dt.datetime, account_key: str | None):
        if sender_key != keyed_hash(TICKETS_KEY, PHONE_VENDOR):
            return []
        return [ib.Candidate("T1", 1042, "D1", "A1", "c1", "x", since + dt.timedelta(hours=1), None, "acknowledged", False)]
