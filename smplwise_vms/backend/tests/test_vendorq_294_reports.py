"""CR-VENDORQ-294 (docs/changes/CR-VENDORQ-294-DESIGN.md section 4): a module's report to an EXTERNAL contact through the tickets message
queue - over the REAL store (migration 0128) with the fake ha-whatsapp of slice 5b (no network, no Home Assistant, no phone):
off by default, queue -> outbox row (no text, no number) -> worker -> `send_message` with the provider's text built at send time, the send
hours, the account mapping, the outcome back to the module, `unknown` final, the refusal codes, no e-mail fallback, the document line with
a live document, and row / log hygiene. A fake module (`fakemod`) stands in for the temperature report. Every name and number is invented."""
from __future__ import annotations

import datetime as dt
import json
import logging

import pytest

from smplwise.services.tickets import contact_reports as CR
from smplwise.services.tickets import messaging, out_documents, settings_doc
from smplwise.services.tickets.outbox import OutboxError
from test_tickets_s5b_channel import DAY, ENTRY_A, KEY_A, NIGHT, env  # noqa: F401 - `env` is the fixture of slice 5b
from tickets_s4_world import BASE_URL, PHONE_A_E164

TEXT = "Cold room 2: min 1.8 / max 4.6 / avg 3.1 C, 0 min out of range, 0 alerts (01/10-07/10)."


class FakeModule:
    def __init__(self) -> None:
        self.text: str | None = TEXT
        self.document_id: str | None = None
        self.outcomes: list[tuple[str, str, str | None]] = []
        self.relevant = True
        self.langs: list[str] = []

    def body(self, conn, row, lang):
        self.langs.append(lang)
        return None if self.text is None else CR.ReportBody(self.text, self.document_id)

    def outcome(self, conn, row):
        self.outcomes.append((row.source_id, row.state, row.outcome_code))

    def still_relevant(self, conn, row):
        return self.relevant


@pytest.fixture
def mod():
    m = FakeModule()
    CR.register("fakemod", m)
    yield m
    CR.unregister("fakemod")


def _switch(env, **reports):
    with env.s4.db.connection() as conn:
        settings_doc.apply_patch(conn, {"reports": reports})


def _queue(env, source_id="s1", contact_id=None, **kw):
    with env.s4.db.connection() as conn:
        return CR.queue(conn, module="fakemod", source_id=source_id, contact_id=contact_id or env.s4.contact["id"], requested_by="u-joni", **kw)


def _reports(env):
    return [r for r in env.rows() if r.purpose == "report"]


def test_reports_to_contacts_are_off_by_default(env, mod):
    with env.s4.db.connection(mode="read") as conn:
        assert settings_doc.read(conn)["reports"] == {"to_contacts": False, "documents": False, "email": False, "document_hours": 72, "document_max_opens": 5}
    with pytest.raises(CR.ReportRefused) as exc:
        _queue(env)
    assert exc.value.code == "reports_to_contacts_off"
    assert _reports(env) == []


def test_a_report_leaves_by_whatsapp_with_the_text_built_at_send_time(env, mod, caplog):
    caplog.set_level(logging.DEBUG)
    _switch(env, to_contacts=True)
    row = _queue(env, idempotency_key="fakemod:s1")
    assert (row.purpose, row.state, row.source_module, row.source_id, row.channel) == ("report", "queued", "fakemod", "s1", "whatsapp")
    with env.s4.db.connection(mode="read") as conn:
        stored = dict(conn.execute("SELECT * FROM ticket_outbox WHERE id = ?", (row.id,)).fetchone())
    assert stored["params_json"] == "{}" and stored["template_id"] is None and stored["reply_nonce"] is None
    assert TEXT not in json.dumps(stored, ensure_ascii=False) and PHONE_A_E164 not in json.dumps(stored)
    assert env.fake.calls == [], "nothing is sent inline - the worker sends"
    mod.text = TEXT + " (rebuilt)"  # the text is built when the row leaves, not when it was queued
    assert env.tick() == 1
    call = env.fake.calls[0]
    assert (call["service"], call["data"]["account"], call["data"]["target"]) == ("send_message", ENTRY_A, PHONE_A_E164)
    assert call["data"]["message"] == "מגדלי הדר\n" + TEXT + " (rebuilt)"
    assert "buttons" not in call["data"]
    done = next(r for r in env.rows() if r.id == row.id)
    assert (done.state, done.account_key) == ("sent", KEY_A)
    assert mod.outcomes == [("s1", "sent", None)] and mod.langs == ["he"]
    with env.s4.db.connection(mode="read") as conn:
        a = conn.execute("SELECT resource_type, resource_id, details_json FROM audit_log WHERE action = 'ticket.message.send' ORDER BY id DESC LIMIT 1").fetchone()
    assert (a[0], a[1]) == ("contact_report", "s1") and json.loads(a[2])["module"] == "fakemod"
    assert TEXT not in caplog.text and PHONE_A_E164 not in caplog.text
    assert _queue(env, idempotency_key="fakemod:s1").id == row.id, "the same idempotency key never makes a second message"


def test_a_report_waits_for_the_send_hours(env, mod):
    _switch(env, to_contacts=True)
    env.clock.t = NIGHT
    row = _queue(env)
    assert env.tick() == 0
    held = next(r for r in env.rows() if r.id == row.id)
    assert (held.state, held.held_reason) == ("held", "send_hours") and env.fake.calls == []
    env.clock.t = DAY + dt.timedelta(days=1)
    assert env.tick() == 1 and next(r for r in env.rows() if r.id == row.id).state == "sent"


def test_an_unmapped_account_holds_the_report(env, mod):
    _switch(env, to_contacts=True)
    env.mapping({"tickets.messages": None})
    row = _queue(env)
    env.tick()
    held = next(r for r in env.rows() if r.id == row.id)
    assert (held.state, held.held_reason) == ("held", "account_unmapped") and env.fake.calls == []


def test_an_unknown_outcome_is_final_and_never_retried(env, mod):
    _switch(env, to_contacts=True)
    row = _queue(env)
    env.fake.queue("timeout")
    assert env.tick() == 1
    assert next(r for r in env.rows() if r.id == row.id).state == "unknown"
    assert env.tick(minutes=30) == 0 and len(env.fake.calls) == 1
    assert mod.outcomes == [("s1", "unknown", "timeout")]


def test_queue_refusals_name_the_reason(env, mod):
    _switch(env, to_contacts=True)
    with env.s4.db.connection() as conn:
        for kw, code in (({"module": "nomod"}, "report_module"), ({"source_id": "bad id!"}, "report_source"),
                         ({"contact_id": "no-such-contact"}, "no_contact")):
            args = {"module": "fakemod", "source_id": "s1", "contact_id": env.s4.contact["id"], "requested_by": "u", **kw}
            with pytest.raises(CR.ReportRefused) as exc:
                CR.queue(conn, **args)
            assert exc.value.code == code
    # a contact WhatsApp cannot carry (the master switch off)
    env.channel(whatsapp={"enabled": False})
    with pytest.raises(CR.ReportRefused) as exc:
        _queue(env)
    assert exc.value.code == "no_whatsapp"
    assert _reports(env) == []


def test_the_outbox_keeps_report_fields_to_report_rows(env, mod):
    with env.s4.db.connection() as conn:
        with pytest.raises(OutboxError) as exc:
            messaging.RUNTIME.enqueue(conn, purpose="report", contact_id=env.s4.contact["id"], channel="whatsapp")
        assert exc.value.code == "report_invalid"
        with pytest.raises(OutboxError) as exc:
            messaging.RUNTIME.enqueue(conn, purpose="report", contact_id=env.s4.contact["id"], channel="email")
        assert exc.value.code == "report_invalid", "a report row always names its source (the e-mail channel is allowed: VENDORQ2-295)"
        with pytest.raises(OutboxError) as exc:
            messaging.RUNTIME.enqueue(conn, purpose="report", contact_id=env.s4.contact["id"], channel="sms", source_module="fakemod", source_id="s1")
        assert exc.value.code == "channel_unknown"
        with pytest.raises(OutboxError) as exc:
            messaging.RUNTIME.enqueue(conn, purpose="closed", contact_id=env.s4.contact["id"], channel="whatsapp", source_module="fakemod", source_id="s1")
        assert exc.value.code == "source_not_allowed"


@pytest.mark.parametrize("text,code", [("See https://evil.example/x for details", "report_unsafe"), ("visit evil.example/login", "report_unsafe"),
                                       ("‮​", "report_unsafe"), (None, "report_unavailable")])
def test_an_unusable_text_ends_not_sent_without_retry_or_email(env, mod, text, code):
    _switch(env, to_contacts=True)
    env.smtp()
    with env.s4.db.connection() as conn:
        conn.execute("UPDATE ticket_contacts SET email = 'dana@example.test' WHERE id = ?", (env.s4.contact["id"],))
    env.channel(email_fallback=True)
    row = _queue(env)
    mod.text = text
    assert env.tick() == 0
    done = next(r for r in env.rows() if r.id == row.id)
    assert (done.state, done.outcome_code) == ("not_sent", code)
    assert env.fake.calls == [] and env.mails == [] and len(_reports(env)) == 1, "no retry, no e-mail fallback"
    assert mod.outcomes == [("s1", "not_sent", code)]
    assert env.tick(minutes=10) == 0


def test_a_module_that_left_cannot_send(env, mod):
    _switch(env, to_contacts=True)
    row = _queue(env)
    CR.unregister("fakemod")
    env.tick()
    assert next(r for r in env.rows() if r.id == row.id).outcome_code == "report_unavailable"


def test_the_provider_text_is_cleaned_and_capped():
    assert CR.clean("a​ b‮\n\n\n c " + "x" * 900).startswith("a b\nc ")
    assert len(CR.clean("y" * 2000)) == CR.TEXT_MAX
    assert CR.clean("1.5/2 and 2.5.6/ב are numbers") is not None
    assert CR.clean("www.example.test") is None and CR.clean("") is None and CR.clean(5) is None


# ---------------------------------------------------------------- with a document (the temporary link line)

def _doc(env, monkeypatch, contact_id=None):
    monkeypatch.setattr(out_documents, "PAGE_READY", True)
    with env.s4.db.connection() as conn:
        return out_documents.mint(conn, module="fakemod", source_id="s1", recipient_kind="contact", recipient_id=contact_id or env.s4.contact["id"],
                                  media_type="application/pdf", filename="haccp-2026-09.pdf", content=b"%PDF-1.7\n%fake\n", created_by="u-joni",
                                  now=env.clock())


def test_a_report_with_a_live_document_carries_its_temporary_link(env, mod, monkeypatch):
    _switch(env, to_contacts=True, documents=True)
    doc = _doc(env, monkeypatch)
    row = _queue(env, document_id=doc["id"])
    with env.s4.db.connection(mode="read") as conn:
        stored = json.dumps(dict(conn.execute("SELECT * FROM ticket_outbox WHERE id = ?", (row.id,)).fetchone()))
        token = out_documents.token_of(out_documents.row(conn, doc["id"]))
    assert token not in stored and stored.count(doc["id"]) == 1, "the row names the document, never its token"
    assert env.tick() == 1
    text = env.fake.calls[0]["data"]["message"]
    assert text.startswith("מגדלי הדר\n" + TEXT + "\nהדוח המלא (זמין עד ")
    assert text.endswith(f"{BASE_URL}/support/#d.{token}")


def test_a_document_of_another_contact_is_refused(env, mod, monkeypatch):
    _switch(env, to_contacts=True, documents=True)
    doc = _doc(env, monkeypatch, contact_id=env.s4.vendor["id"])
    with pytest.raises(CR.ReportRefused) as exc:
        _queue(env, document_id=doc["id"])
    assert exc.value.code == "document_unknown"


def test_a_dead_document_stops_the_message_and_a_failed_report_revokes_its_document(env, mod, monkeypatch):
    _switch(env, to_contacts=True, documents=True)
    doc = _doc(env, monkeypatch)
    row = _queue(env, document_id=doc["id"])
    with env.s4.db.connection() as conn:
        assert out_documents.revoke(conn, doc["id"], "manual", env.clock())
    env.tick()
    assert next(r for r in env.rows() if r.id == row.id).outcome_code == "document_not_live" and env.fake.calls == []
    doc2 = _doc(env, monkeypatch)
    row2 = _queue(env, source_id="s2", document_id=doc2["id"])
    mod.text = "bad https://x.example/y"
    env.tick()
    assert next(r for r in env.rows() if r.id == row2.id).outcome_code == "report_unsafe"
    with env.s4.db.connection(mode="read") as conn:
        assert out_documents.row(conn, doc2["id"])["revoked_reason"] == "send_failed", "a document whose report never left dies with it"


# ---------------------------------------------------------------- VENDORQ2-295: e-mail as the second delivery channel

MAIL = "dana@example.test"


def _mail_ready(env, email=True):
    env.smtp()
    if email:
        with env.s4.db.connection() as conn:
            conn.execute("UPDATE ticket_contacts SET email = ? WHERE id = ?", (MAIL, env.s4.contact["id"]))


def test_the_email_channel_is_off_by_default_and_needs_its_own_switch(env, mod):
    _mail_ready(env)
    _switch(env, to_contacts=True)
    with pytest.raises(CR.ReportRefused) as exc:
        _queue(env, channel="email")
    assert exc.value.code == "reports_email_off"
    with pytest.raises(CR.ReportRefused) as exc:
        _queue(env, channel="pigeon")
    assert exc.value.code == "report_channel"
    _switch(env, to_contacts=False, email=True)
    with pytest.raises(CR.ReportRefused) as exc:
        _queue(env, channel="email")
    assert exc.value.code == "reports_to_contacts_off", "the e-mail switch never opens the master switch"
    assert _reports(env) == []


def test_email_refusals_name_the_reason(env, mod):
    _switch(env, to_contacts=True, email=True)
    with pytest.raises(CR.ReportRefused) as exc:
        _queue(env, channel="email")  # no SMTP, no address
    assert exc.value.code == "no_email"
    env.smtp()
    with pytest.raises(CR.ReportRefused) as exc:
        _queue(env, channel="email")  # SMTP but the contact has no address
    assert exc.value.code == "no_email"
    with env.s4.db.connection(mode="read") as conn:
        assert CR.reach(conn, "no-such-contact", "email") == "no_contact"
    assert _reports(env) == []


def test_a_report_leaves_by_email_with_the_text_built_at_send_time(env, mod, caplog):
    caplog.set_level(logging.DEBUG)
    _mail_ready(env)
    _switch(env, to_contacts=True, email=True)
    row = _queue(env, channel="email", idempotency_key="fakemod:s1:mail")
    assert (row.purpose, row.channel, row.use_key, row.state) == ("report", "email", "email", "queued")
    with env.s4.db.connection(mode="read") as conn:
        stored = json.dumps(dict(conn.execute("SELECT * FROM ticket_outbox WHERE id = ?", (row.id,)).fetchone()), ensure_ascii=False)
    assert TEXT not in stored and MAIL not in stored and PHONE_A_E164 not in stored
    mod.text = TEXT + " (rebuilt)"
    assert env.tick() == 1
    assert env.fake.calls == [], "e-mail never touches WhatsApp"
    to, rendered = env.mails[0]
    assert to == MAIL and rendered.subject == "דוח"
    assert rendered.text == "מגדלי הדר\n" + TEXT + " (rebuilt)"
    done = next(r for r in env.rows() if r.id == row.id)
    assert (done.state, done.channel) == ("sent", "email")
    assert mod.outcomes == [("s1", "sent", None)]
    assert TEXT not in caplog.text and MAIL not in caplog.text and PHONE_A_E164 not in caplog.text
    assert _queue(env, channel="email", idempotency_key="fakemod:s1:mail").id == row.id


def test_an_email_report_waits_for_the_send_hours_like_a_whatsapp_one(env, mod):
    _mail_ready(env)
    _switch(env, to_contacts=True, email=True)
    env.clock.t = NIGHT
    row = _queue(env, channel="email")
    assert env.tick() == 0
    held = next(r for r in env.rows() if r.id == row.id)
    assert (held.state, held.held_reason) == ("held", "send_hours") and env.mails == []
    env.clock.t = DAY + dt.timedelta(days=1)
    assert env.tick() == 1 and next(r for r in env.rows() if r.id == row.id).state == "sent" and len(env.mails) == 1


@pytest.mark.parametrize("text,code", [("See https://evil.example/x", "report_unsafe"), (None, "report_unavailable")])
def test_an_unusable_text_ends_an_email_report_not_sent_and_never_switches_channel(env, mod, text, code):
    _mail_ready(env)
    _switch(env, to_contacts=True, email=True)
    row = _queue(env, channel="email")
    mod.text = text
    assert env.tick() == 0
    done = next(r for r in env.rows() if r.id == row.id)
    assert (done.state, done.outcome_code) == ("not_sent", code)
    assert env.mails == [] and env.fake.calls == [] and len(_reports(env)) == 1


def test_an_smtp_failure_after_the_handover_is_unknown_and_final(env, mod, monkeypatch):
    _mail_ready(env)
    _switch(env, to_contacts=True, email=True)
    row = _queue(env, channel="email")

    def boom(cfg, to, rendered):
        from smplwise.services import notify_email

        raise notify_email.MailError("timeout")

    monkeypatch.setattr(messaging.RUNTIME, "email_sender", boom)
    assert env.tick() == 1
    assert next(r for r in env.rows() if r.id == row.id).state == "unknown"
    assert env.tick(minutes=30) == 0 and mod.outcomes == [("s1", "unknown", "smtp_timeout")]


def test_a_contact_erased_after_queuing_gets_no_email_report(env, mod):
    _mail_ready(env)
    _switch(env, to_contacts=True, email=True)
    row = _queue(env, channel="email")
    with env.s4.db.connection() as conn:
        conn.execute("UPDATE ticket_contacts SET erased_at = ? WHERE id = ?", (env.clock().isoformat(), env.s4.contact["id"]))
    env.tick()
    done = next(r for r in env.rows() if r.id == row.id)
    assert (done.state, done.outcome_code) == ("not_sent", "contact_missing") and env.mails == []


def test_an_email_report_never_queues_a_document_link(env, mod, monkeypatch):
    """DOCLINKSEC-295 M-01: the tickets rule "e-mail never carries the fragment" (links.py, review T3-2) holds for documents too - a report
    WITH a document is refused on the e-mail channel at queue time (no row, no mail); the same report by WhatsApp still queues."""
    _mail_ready(env)
    _switch(env, to_contacts=True, documents=True, email=True)
    doc = _doc(env, monkeypatch)
    with pytest.raises(CR.ReportRefused) as exc:
        _queue(env, channel="email", document_id=doc["id"])
    assert exc.value.code == "document_channel"
    assert _reports(env) == [] and env.tick() == 0 and env.mails == []
    assert _queue(env, document_id=doc["id"]).channel == "whatsapp"


def test_an_email_report_whose_provider_names_a_document_at_send_time_never_leaves(env, mod, monkeypatch):
    """DOCLINKSEC-295 M-01: the send-time guard - a provider that names a document for an e-mail row stops the message (not_sent /
    document_channel, never retried) and no mail carries `#d.`. The document is the provider's, not the row's, so the row's not_sent hook
    does not revoke it (as for a WhatsApp report); its token never left, and it expires on its own."""
    _mail_ready(env)
    _switch(env, to_contacts=True, documents=True, email=True)
    doc = _doc(env, monkeypatch)
    row = _queue(env, channel="email")
    mod.document_id = doc["id"]
    env.tick()
    done = next(r for r in env.rows() if r.id == row.id)
    assert (done.state, done.outcome_code) == ("not_sent", "document_channel") and env.mails == []
    assert env.tick(minutes=30) == 0 and env.mails == [], "document_channel is not retryable"
    with env.s4.db.connection(mode="read") as conn:
        assert out_documents.row(conn, doc["id"])["open_count"] == 0
