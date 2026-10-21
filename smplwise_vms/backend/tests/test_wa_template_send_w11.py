"""CR-W11TPL-295: the Arx side of a WhatsApp template send outside the 24-hour window (services/wa_template_send.py). Fakes only: a
fake transport records the proposed request and answers from a script; no WisKey, no number, no message. NEGATIVE CASES FIRST: the
switch off, the permit False (production), the unwired transport, declined consent, an unknown reference, wrong parameters, the
budget; then the three answer states, the idempotent request, and the pacing class."""
from __future__ import annotations

import datetime as dt
import json
import sqlite3

import pytest

from smplwise.services import intercom_messaging_adapter as adapter
from smplwise.services import messaging_accounts as ma
from smplwise.services import wa_pacing as wp
from smplwise.services import wa_template_send as T

UTC = dt.timezone.utc
NOW = dt.datetime(2026, 10, 21, 9, 0, 0, tzinfo=UTC)
ACC = "entry:acc1"
VALUES = {"name": "Dana", "organization": "Org", "link": "https://x.example.test/#c.tok", "days": "7"}
REG = [T.TemplateRef("consent", "consent_req", "he", ("name", "organization", "link", "days"), "consent_request"),
       T.TemplateRef("notice", "visit_notice", "en_US", ("name",), "notice")]


_DEFAULT = object()


def sender(transport=None, *, switch=True, permit=True, by_link=False, pacer=_DEFAULT):
    if pacer is _DEFAULT:  # F3C TP-01: the pacer is required; the default test sender carries an off-mode one
        pacer = wp.WaPacer(ma.MemorySendLedger(), wp.MemoryPacerStore(), config=lambda: wp.PacerConfig(mode="off"))
    return T.TemplateSender(transport, registry=lambda: REG, switch=lambda: switch, permit_fn=lambda: permit, pacer=pacer,
                            pacing_for=(lambda _k: ma.Pacing()) if pacer else None, consent_by_link=lambda: by_link, clock=lambda: NOW)


def go(s, *, template="consent", consent="granted", values=VALUES, window="unknown", rid="r1"):
    return s.send(template_id=template, consent=consent, values=values, account="acc1", account_key=ACC, person_id="p1", recipient_key="rk", request_id=rid, window=window)


def conn():
    c = sqlite3.connect(":memory:")
    c.execute("CREATE TABLE settings(key TEXT PRIMARY KEY, value TEXT)")
    return c


# ---------------------------------------------------------------- negative first

def test_permit_is_false_and_production_sends_nothing():
    assert adapter.TEMPLATE_SEND_SUPPORTED is False and T.permit() is False
    fake = T.FakeTemplateTransport()
    s = T.TemplateSender(fake, registry=lambda: REG, switch=lambda: True)  # real permit
    r = go(s)
    assert (r.outcome, r.code) == ("not_sent", "template_unsupported") and fake.requests == []


def test_switch_defaults_off_and_unreadable_is_off():
    c = conn()
    assert T.switch_on(c) is False
    c.execute("INSERT INTO settings VALUES(?, ?)", (T.SWITCH_KEY, "{broken"))
    assert T.switch_on(c) is False
    T.store_switch(c, True)
    assert T.switch_on(c) is True


def test_switch_off_sends_nothing():
    fake = T.FakeTemplateTransport()
    assert go(sender(fake, switch=False)).code == "template_unsupported" and fake.requests == []


def test_unwired_transport_refuses_and_nothing_leaves():
    r = go(sender(None))
    assert (r.outcome, r.code) == ("not_sent", "template_unsupported")


@pytest.mark.parametrize("kw,code", [
    ({"template": "nope"}, "template_not_found"),
    ({"values": {"name": "Dana"}}, "template_params_mismatch"),
    ({"values": {**VALUES, "link": ""}}, "template_params_mismatch"),
    ({"consent": "declined"}, "no_consent"),
    ({"consent": "declined", "template": "notice", "values": {"name": "D"}}, "no_consent"),
])
def test_admission_refusals_send_nothing(kw, code):
    fake = T.FakeTemplateTransport()
    r = go(sender(fake), **kw)
    assert (r.outcome, r.code) == ("not_sent", code) and fake.requests == []


def test_unknown_consent_rules():
    fake = T.FakeTemplateTransport()
    assert go(sender(fake, by_link=True), template="notice", consent="unknown", values={"name": "D"}).code == "consent_required"
    assert go(sender(fake, by_link=True), consent="unknown").outcome == "sent"  # the consent request itself
    assert go(sender(fake, by_link=False), template="notice", consent="unknown", values={"name": "D"}).outcome == "sent"  # existing rule
    assert len(fake.requests) == 2


def test_inside_an_open_window_a_notice_is_not_sent_as_template():
    fake = T.FakeTemplateTransport()
    assert go(sender(fake), template="notice", values={"name": "D"}, window="open").code == "window_open" and fake.requests == []
    assert T.needs_template("unknown") and T.needs_template("closed") and not T.needs_template("open")
    assert T.NoWindowProbe().window("p") == "unknown"


# ---------------------------------------------------------------- the three answers

def test_accepted_is_sent_and_the_request_is_the_proposal_shape():
    fake = T.FakeTemplateTransport({"state": "accepted"})
    r = go(sender(fake), rid="abc")
    assert r.outcome == "sent"
    w = fake.requests[0]
    assert w["schema"] == T.PROPOSAL and w["request_id"] == "abc" and w["account"] == "acc1" and w["user_id"] == "p1"
    assert w["template"] == {"name": "consent_req", "language": "he"} and w["params"] == ["Dana", "Org", VALUES["link"], "7"]
    assert w["deadline"] == "2026-10-21T09:00:15Z"
    assert "Dana" not in repr(T.TemplateRequest("r", "a", "p", "n", "he", ("Dana",)))  # values never in a repr/log


@pytest.mark.parametrize("answer,code,retry,scope", [
    ({"state": "not_sent", "code": "template_not_approved"}, "template_not_approved", None, None),
    ({"state": "not_sent", "code": "rate_limited", "retry_after_s": 7, "scope": "burst"}, "rate_limited", 7, "burst"),
    ({"state": "not_sent", "code": "pair_rate_limited", "retry_after_s": 300, "scope": "pair"}, "pair_rate_limited", 300, "pair"),
])
def test_not_sent_needs_a_pre_send_code(answer, code, retry, scope):
    r = go(sender(T.FakeTemplateTransport(answer)))
    assert (r.outcome, r.code, r.retry_after_s, r.scope) == ("not_sent", code, retry, scope)


@pytest.mark.parametrize("answer", [
    {"state": "not_sent", "code": "whatsapp_send_uncertain"},  # not proven pre-send
    {"state": "not_sent"},  # no code
    {"state": "unknown", "code": "status_unknown"},
    {"state": "accepted-ish"}, "ok", None, [], {},
    TimeoutError("late"), RuntimeError("dropped"),
])
def test_everything_unproven_is_unknown_and_never_retried(answer):
    fake = T.FakeTemplateTransport(answer)
    r = go(sender(fake))
    assert r.outcome == "unknown" and len(fake.requests) <= 1
    assert r.as_send_result().code == "uncertain" and r.as_send_result().outcome == "unknown"


def test_adapter_wrapper_maps_to_send_result():
    got = adapter.MessagingAdapter().send_template(sender(T.FakeTemplateTransport()), template_id="consent", consent="granted", values=VALUES, account="acc1",
                                                   account_key=ACC, person_id="p1", recipient_key="rk", request_id="r9")
    assert isinstance(got, adapter.SendResult) and got.outcome == "sent"


# ---------------------------------------------------------------- pacing: a normal class, counted once

def pacer_with(n_recent: int):
    ledger, store = ma.MemorySendLedger(), wp.MemoryPacerStore()
    for i in range(n_recent):
        ledger.record(account_key=ACC, use_key="tickets.messages", recipient_key="r", kind="message", at=NOW - dt.timedelta(seconds=20 + i))
    return wp.WaPacer(ledger, store, config=lambda: wp.PacerConfig(mode="conservative")), store


def test_template_class_is_the_normal_ticket_class():
    assert T.KLASS == wp.CLASS_TICKET == wp.class_of(use_key="intercom.template") == wp.class_of(use_key="intercom.messages")
    assert wp.CLASSES.count(T.KLASS) == 1  # no class of its own


def test_budget_holds_a_template_send_like_any_other():
    p, store = pacer_with(9)  # 9 sends in the last minute: the ticket class (80 percent of 10) is spent
    fake = T.FakeTemplateTransport()
    r = go(sender(fake, pacer=p))
    assert (r.outcome, r.code) == ("not_sent", "paced") and r.wait_until is not None and r.retry_after_s >= 1 and fake.requests == []


def test_budget_free_send_passes_and_a_rate_answer_starts_the_backoff():
    p, store = pacer_with(0)
    fake = T.FakeTemplateTransport({"state": "not_sent", "code": "rate_limited"})
    assert go(sender(fake, pacer=p)).code == "rate_limited"
    assert store.get_state(f"account:{ACC}") is not None  # the platform's slow-down is learned
    assert go(sender(fake, pacer=p), rid="r2").code == "paced"  # ... and the next template waits on it
    assert len(fake.requests) == 1


def test_pacer_off_mode_admits():
    ledger, store = ma.MemorySendLedger(), wp.MemoryPacerStore()
    p = wp.WaPacer(ledger, store, config=lambda: wp.PacerConfig(mode="off"))
    assert go(sender(T.FakeTemplateTransport(), pacer=p)).outcome == "sent"


# ---------------------------------------------------------------- the registry

def test_registry_roundtrip_and_fail_closed():
    c = conn()
    assert T.load_registry(c) == []
    T.store_registry(c, REG)
    assert T.load_registry(c) == REG
    bad = [{"id": "a", "name": "Bad Name", "language": "he", "params": [], "purpose": "notice"}]
    c.execute("UPDATE settings SET value = ? WHERE key = ?", (json.dumps(bad), T.REGISTRY_KEY))
    assert T.load_registry(c) == []


@pytest.mark.parametrize("item", [
    {"id": "A", "name": "ok", "language": "he", "params": [], "purpose": "notice"},
    {"id": "a", "name": "ok", "language": "hebrew", "params": [], "purpose": "notice"},
    {"id": "a", "name": "ok", "language": "he", "params": ["pin"], "purpose": "notice"},
    {"id": "a", "name": "ok", "language": "he", "params": [], "purpose": "marketing"},
    "x", None,
])
def test_registry_rejects_bad_entries(item):
    assert T.validate_registry([item])[1] == [{"path": "templates.0", "code": "invalid"}]


def test_registry_duplicates_and_limits():
    one = {"id": "a", "name": "n", "language": "he", "params": [], "purpose": "notice"}
    assert T.validate_registry([one, {**one, "id": "b"}])[1][0]["code"] == "duplicate"
    assert T.validate_registry([one, {**one}])[1][0]["code"] == "duplicate"
    many = [{**one, "id": f"i{i}", "name": f"n{i}"} for i in range(T.REGISTRY_MAX + 1)]
    assert T.validate_registry(many)[1][0]["code"] == "too_many"
    assert T.validate_registry("nope")[1][0]["code"] == "not_a_list"
