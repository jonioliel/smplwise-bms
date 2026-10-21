"""F3C-295 TP-01 / TP-03 / TP-04 on the template sender (fakes only, nothing sent)."""
from __future__ import annotations

import pytest

from smplwise.services import messaging_accounts as ma
from smplwise.services import wa_pacing as wp
from smplwise.services import wa_template_send as T

from test_wa_template_send_w11 import NOW, REG, VALUES, go, sender


def test_tp01_a_sender_without_a_pacer_refuses_and_sends_nothing():
    fake = T.FakeTemplateTransport()
    s = T.TemplateSender(fake, registry=lambda: REG, switch=lambda: True, permit_fn=lambda: True, clock=lambda: NOW)
    r = go(s)
    assert (r.outcome, r.code) == ("not_sent", "paced_unavailable") and fake.requests == []


def test_tp01_a_pacer_without_a_pacing_source_also_refuses():
    fake = T.FakeTemplateTransport()
    p = wp.WaPacer(ma.MemorySendLedger(), wp.MemoryPacerStore(), config=lambda: wp.PacerConfig(mode="off"))
    s = T.TemplateSender(fake, registry=lambda: REG, switch=lambda: True, permit_fn=lambda: True, pacer=p, clock=lambda: NOW)
    assert go(s).code == "paced_unavailable" and fake.requests == []


def test_tp01_the_earlier_refusals_keep_their_codes():
    fake = T.FakeTemplateTransport()
    s = T.TemplateSender(fake, registry=lambda: REG, switch=lambda: False, permit_fn=lambda: True, clock=lambda: NOW)
    assert go(s).code == "template_unsupported"
    s = T.TemplateSender(fake, registry=lambda: REG, switch=lambda: True, permit_fn=lambda: True, clock=lambda: NOW)
    assert go(s, template="nope").code == "template_not_found"
    assert go(s, consent="declined").code == "no_consent" and fake.requests == []


@pytest.mark.parametrize("field,bad", [("person_id", "p 1"), ("person_id", ""), ("person_id", "p\n1"), ("person_id", "x" * 129),
                                       ("account", "acc/1"), ("account", "+972500000000 "), ("request_id", "r\x001"), ("request_id", "")])
def test_tp03_ids_on_the_wire_are_closed_strings(field, bad):
    fake = T.FakeTemplateTransport()
    kw = dict(template_id="consent", consent="granted", values=VALUES, account="acc1", account_key="entry:acc1", person_id="p1", recipient_key="rk", request_id="r1")
    kw[field] = bad
    r = sender(fake).send(**kw)
    assert (r.outcome, r.code) == ("not_sent", "invalid_reference") and fake.requests == []


def test_tp03_non_strings_are_refused_and_a_normal_id_passes():
    fake = T.FakeTemplateTransport()
    kw = dict(template_id="consent", consent="granted", values=VALUES, account="acc1", account_key="entry:acc1", person_id=17, recipient_key="rk", request_id="r1")
    assert sender(fake).send(**kw).code == "invalid_reference"
    kw["person_id"] = "person:7f-ab_1"
    assert sender(fake).send(**kw).outcome == "sent" and len(fake.requests) == 1


def test_tp04_send_decides_the_window_through_needs_template(monkeypatch):
    fake = T.FakeTemplateTransport()
    seen = []
    monkeypatch.setattr(T, "needs_template", lambda w: (seen.append(w), w != "open")[1])
    assert go(sender(fake), template="notice", values={"name": "D"}, window="open").code == "window_open"
    assert go(sender(fake), template="notice", values={"name": "D"}, window="closed", rid="r2").outcome == "sent"
    assert go(sender(fake), window="open", rid="r3").outcome == "sent"  # a consent request is the exception
    assert seen == ["open", "closed", "open"]
