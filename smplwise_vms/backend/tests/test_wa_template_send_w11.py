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


def sender(transport=None, *, switch=True, permit=True, pacer=_DEFAULT):
    if pacer is _DEFAULT:  # F3C TP-01: the pacer is required; the default test sender carries an off-mode one
        pacer = wp.WaPacer(ma.MemorySendLedger(), wp.MemoryPacerStore(), config=lambda: wp.PacerConfig(mode="off"))
    return T.TemplateSender(transport, registry=lambda: REG, switch=lambda: switch, permit_fn=lambda: permit, pacer=pacer,
                            pacing_for=(lambda _k: ma.Pacing()) if pacer else None, clock=lambda: NOW)


def go(s, *, template="consent", consent="granted", values=VALUES, window="unknown", rid="r1", op="op1"):
    return s.send(template_id=template, consent=consent, values=values, account="acc1", account_key=ACC, person_id="p1", recipient_key="rk",
                  request_id=rid, operation_id=op, window=window)


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
    ({"values": {**VALUES, "link": "a\x01b"}}, "invalid_fields"),  # template_send_v1: no character below U+0020
    ({"values": {**VALUES, "link": "x" * 1025}}, "template_params_mismatch"),
])
def test_admission_refusals_send_nothing(kw, code):
    fake = T.FakeTemplateTransport()
    r = go(sender(fake), **kw)
    assert (r.outcome, r.code) == ("not_sent", code) and fake.requests == []


@pytest.mark.parametrize("consent", ["declined", "unknown", "granted", None])
@pytest.mark.parametrize("template,values", [("consent", VALUES), ("notice", {"name": "D"})])
def test_wkadapt_no_recipient_consent_gate_and_no_consent_on_the_wire(consent, template, values):
    """WKADAPT-295 (owner decision TP-02, WisKey template_send_v1 route policy): consent never blocks a template send and is never sent."""
    fake = T.FakeTemplateTransport()
    r = go(sender(fake), template=template, consent=consent, values=values)
    assert r.outcome == "sent" and len(fake.requests) == 1
    assert "consent" not in json.dumps(fake.requests[0]).replace("consent_req", ""), "no consent field (and no consent=true) on the wire"
    assert set(fake.requests[0]) == T.WIRE_TEMPLATE_KEYS


def test_wkadapt_the_constructor_has_no_consent_switch_any_more():
    with pytest.raises(TypeError):
        T.TemplateSender(None, registry=lambda: REG, switch=lambda: True, consent_by_link=lambda: True)


def test_inside_an_open_window_a_notice_is_not_sent_as_template():
    fake = T.FakeTemplateTransport()
    assert go(sender(fake), template="notice", values={"name": "D"}, window="open").code == "window_open" and fake.requests == []
    assert T.needs_template("unknown") and T.needs_template("closed") and not T.needs_template("open")
    assert T.NoWindowProbe().window("p") == "unknown"


# ---------------------------------------------------------------- the three answers

def test_accepted_is_sent_and_the_request_is_the_template_send_v1_shape():
    fake = T.FakeTemplateTransport()
    r = go(sender(fake), rid="abc", op="op-7")
    assert r.outcome == "sent"
    w = fake.requests[0]
    assert w == {"schema_version": 1, "request_id": "abc", "operation_id": "op-7", "recipient_ref": "p1", "account": "acc1",
                 "template_name": "consent_req", "language": "he", "parameters": ["Dana", "Org", VALUES["link"], "7"]}
    assert type(w["schema_version"]) is int
    req = T.TemplateRequest("abc", "acc1", "p1", "consent_req", "he", ("Dana",), operation_id="op-7")
    assert req.envelope(5) == {"id": 5, "type": "hikvision_intercom/whatsapp/template_send_v1", "template": req.wire()}
    for bad in (0, -1, True, "5"):
        with pytest.raises(ValueError):
            req.envelope(bad)
    assert "Dana" not in repr(T.TemplateRequest("r", "a", "p", "n", "he", ("Dana",)))  # values never in a repr/log


@pytest.mark.parametrize("kw,problem", [
    ({"template_name": "1abc"}, "template"), ({"template_name": "_abc"}, "template"), ({"language": "hebrew"}, "template"),
    ({"operation_id": ""}, "operation_id"), ({"operation_id": "o\x7f"}, "operation_id"), ({"request_id": "r" * 129}, "request_id"),
    ({"params": tuple("p" for _ in range(21))}, "parameters"), ({"params": ("",)}, "parameters"), ({"params": ("a\nb",)}, "parameters"),
    ({"params": tuple("x" * 1024 for _ in range(20)), "language": "he"}, None),
    ({"params": tuple("א" * 1024 for _ in range(20))}, "too_large"),  # ASCII-escaped: 6 bytes per character
])
def test_wire_problem_follows_the_v1_bounds(kw, problem):
    base = dict(request_id="r1", account="acc1", person_id="p1", template_name="consent_req", language="he", params=("a",), operation_id="op1")
    assert T.wire_problem(T.TemplateRequest(**{**base, **kw})) == problem


def test_operation_id_is_required_and_a_closed_string():
    fake = T.FakeTemplateTransport()
    assert go(sender(fake), op="o p").code == "invalid_reference" and fake.requests == []
    with pytest.raises(TypeError):
        sender(fake).send(template_id="consent", values=VALUES, account="acc1", account_key=ACC, person_id="p1", recipient_key="rk", request_id="r1")


@pytest.mark.parametrize("result,outcome,code", [
    ({"schema_version": 1, "state": "accepted", "code": "provider_accepted", "provider_accepted": True, "delivery": "unknown", "retry_permitted": False}, "sent", None),
    ({"schema_version": 1, "state": "not_sent", "code": "template_mismatch", "provider_accepted": False, "delivery": "unknown", "retry_permitted": False}, "not_sent", "template_mismatch"),
    ({"schema_version": 1, "state": "not_sent", "code": "source_or_admission_refused", "provider_accepted": False, "delivery": "unknown", "retry_permitted": False}, "not_sent", "source_or_admission_refused"),
    ({"schema_version": 1, "state": "unknown", "code": "operation_pending_or_unknown", "provider_accepted": None, "delivery": "unknown", "retry_permitted": False}, "unknown", "operation_pending_or_unknown"),
    ({"schema_version": 1, "state": "unknown", "code": "provider_outcome_unknown", "provider_accepted": None, "delivery": "unknown", "retry_permitted": False}, "unknown", "provider_outcome_unknown"),
    # anything outside the five closed combinations is unknown
    ({"schema_version": 1, "state": "accepted", "code": "provider_accepted", "provider_accepted": 1, "delivery": "unknown", "retry_permitted": False}, "unknown", "invalid_response"),
    ({"schema_version": 1, "state": "not_sent", "code": "template_mismatch", "provider_accepted": 0, "delivery": "unknown", "retry_permitted": False}, "unknown", "invalid_response"),
    ({"schema_version": 1, "state": "not_sent", "code": "template_mismatch", "provider_accepted": True, "delivery": "unknown", "retry_permitted": False}, "unknown", "invalid_response"),
    ({"schema_version": 1, "state": "accepted", "code": "provider_accepted", "provider_accepted": True, "delivery": "delivered", "retry_permitted": False}, "unknown", "invalid_response"),
    ({"schema_version": 1, "state": "not_sent", "code": "template_mismatch", "provider_accepted": False, "delivery": "unknown", "retry_permitted": True}, "unknown", "invalid_response"),
    ({"schema_version": True, "state": "accepted", "code": "provider_accepted", "provider_accepted": True, "delivery": "unknown", "retry_permitted": False}, "unknown", "invalid_response"),
    ({"schema_version": 1, "state": "accepted", "code": "provider_accepted", "provider_accepted": True, "delivery": "unknown", "retry_permitted": False, "extra": 1}, "unknown", "invalid_response"),
    ({"schema_version": 1, "state": "not_sent", "code": "rate_limited", "provider_accepted": False, "delivery": "unknown", "retry_permitted": False}, "unknown", "invalid_response"),
])
def test_a_v1_result_is_read_strictly(result, outcome, code):
    fake = T.FakeTemplateTransport(result)
    r = go(sender(fake))
    assert (r.outcome, r.code) == (outcome, code) and len(fake.requests) == 1


def v1(state, code, pa):
    return T.closed_result(1, state, code, pa)


def v2(state, code, pa):
    return T.closed_result(2, state, code, pa)


@pytest.mark.parametrize("answer", [
    # the former legacy shapes (no schema_version) are unknown now, even the ones that used to count as sent / not_sent
    {"state": "accepted"},
    {"state": "not_sent", "code": "template_not_approved"},
    {"state": "not_sent", "code": "rate_limited", "retry_after_s": 7, "scope": "burst"},
    {"state": "not_sent", "code": "pair_rate_limited", "retry_after_s": 300, "scope": "pair"},
    {"state": "not_sent", "code": "unauthorized"},
    {"state": "not_sent", "code": "whatsapp_send_uncertain"},  # not proven pre-send
    {"state": "not_sent"},  # no code
    {"state": "unknown", "code": "status_unknown"},
    # an HA error code, a bridge_schema marker alone, the operation / source errors: never not_sent
    {"code": "operation_conflict"}, {"code": "template_source_unavailable"}, {"code": "invalid_fields"}, {"code": "unauthorized"},
    {"bridge_schema": "wiskey-bridge-command.v1"}, {"bridge_schema": "wiskey-bridge-command.v1", "state": "not_sent", "code": "template_mismatch"},
    {"success": False, "error": {"code": "operation_conflict"}},
    {"state": "accepted-ish"}, "ok", None, [], {},
    TimeoutError("late"), ConnectionError("disconnected"), RuntimeError("dropped"),
])
def test_everything_unproven_is_unknown_and_never_retried(answer):
    fake = T.FakeTemplateTransport(answer)
    r = go(sender(fake))
    assert r.outcome == "unknown" and len(fake.requests) == 1  # handed over once, never retried
    assert r.as_send_result().code == "uncertain" and r.as_send_result().outcome == "unknown"


@pytest.mark.parametrize("answer", [v2("accepted", "provider_accepted", True), v2("not_sent", "template_mismatch", False),
                                    v2("unknown", "provider_outcome_unknown", None)])
def test_a_v2_result_is_never_read_as_v1(answer):
    assert T.read_answer(answer) == T.TransportAnswer("unknown", "invalid_response")  # the default (v1) reader refuses a v2 result
    assert T.read_v1(answer) == T.TransportAnswer("unknown", "invalid_response")
    r = go(sender(T.FakeTemplateTransport(answer)))  # a v1 request answered by a v2 result: unknown, not sent, not not_sent
    assert (r.outcome, r.code, r.result_version) == ("unknown", "invalid_response", None)


def test_the_v1_reader_keeps_the_version_and_accepts_only_the_provider_ack():
    got = T.read_answer(v1("accepted", "provider_accepted", True))
    assert (got.state, got.code, got.version) == ("accepted", None, 1)
    for pa, code in ((False, "template_mismatch"), (False, "source_or_admission_refused")):
        assert T.read_v1(v1("not_sent", code, pa)) == T.TransportAnswer("not_sent", code, version=1)
    r = go(sender(T.FakeTemplateTransport(v1("accepted", "provider_accepted", True))))
    assert (r.outcome, r.result_version) == ("sent", 1)


def test_the_v2_reader_is_explicit_and_keeps_its_version():
    assert T.READERS[1] is T.read_v1 and T.READERS[2] is T.read_v2 and T.read_v1 is not T.read_v2
    assert len(T.V2_REQUEST_KEYS) == 10 and len(T.V2_RESULT_KEYS) == 6 and "parameters" not in T.V2_REQUEST_KEYS
    assert T.read_answer(v2("accepted", "provider_accepted", True), version=2) == T.TransportAnswer("accepted", None, version=2)
    assert T.read_v2(v2("not_sent", "source_or_admission_refused", False)) == T.TransportAnswer("not_sent", "source_or_admission_refused", version=2)
    assert T.read_v2(v2("unknown", "operation_pending_or_unknown", None)).state == "unknown"
    # the other way round: a v1 result is not a v2 result
    assert T.read_answer(v1("accepted", "provider_accepted", True), version=2) == T.TransportAnswer("unknown", "invalid_response")
    assert T.read_v2(v1("not_sent", "template_mismatch", False)) == T.TransportAnswer("unknown", "invalid_response")
    # same strictness as v1: six keys, real int version, closed combinations
    bad = [dict(v2("accepted", "provider_accepted", True), extra=1), dict(v2("accepted", "provider_accepted", True), schema_version=True),
           dict(v2("accepted", "provider_accepted", True), provider_accepted=1), dict(v2("accepted", "provider_accepted", True), delivery="delivered"),
           dict(v2("not_sent", "template_mismatch", False), retry_permitted=True), v2("not_sent", "rate_limited", False)]
    assert all(T.read_v2(b).state == "unknown" for b in bad)
    # an unsupported version asks nothing of any reader
    for version in (0, 3, True, "1", None):
        assert T.read_answer(v1("accepted", "provider_accepted", True), version=version).state == "unknown"


def test_no_legacy_branch_remains():
    assert not hasattr(T, "PRE_SEND_CODES")
    assert T.read_answer({"state": "accepted"}).state == "unknown"  # used to be counted as sent without a provider ACK


def test_unwired_transport_is_refused_before_any_hand_over():
    r = go(T.TemplateSender(T.UnwiredTransport(), registry=lambda: REG, switch=lambda: True, permit_fn=lambda: True,
                            pacer=wp.WaPacer(ma.MemorySendLedger(), wp.MemoryPacerStore(), config=lambda: wp.PacerConfig(mode="off")),
                            pacing_for=lambda _k: ma.Pacing(), clock=lambda: NOW))
    assert (r.outcome, r.code) == ("not_sent", "template_unsupported")


def test_adapter_wrapper_maps_to_send_result():
    got = adapter.MessagingAdapter().send_template(sender(T.FakeTemplateTransport()), template_id="consent", consent="granted", values=VALUES, account="acc1",
                                                   account_key=ACC, person_id="p1", recipient_key="rk", request_id="r9", operation_id="op9")
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


def test_budget_free_send_passes_and_an_unknown_answer_is_counted_never_credited():
    p, store = pacer_with(0)
    fake = T.FakeTemplateTransport(TimeoutError("late"), v1("unknown", "provider_outcome_unknown", None))
    assert go(sender(fake, pacer=p)).outcome == "unknown"
    assert go(sender(fake, pacer=p), rid="r2").outcome == "unknown"  # no refund, no retry: the next send is a new request, not a replay
    assert len(fake.requests) == 2 and [w["request_id"] for w in fake.requests] == ["r1", "r2"]
    assert store.get_state(f"account:{ACC}") is None  # an unknown answer starts no backoff and credits nothing


def test_not_sent_v1_is_a_plain_refusal_with_no_backoff():
    p, store = pacer_with(0)
    fake = T.FakeTemplateTransport(v1("not_sent", "template_mismatch", False))
    r = go(sender(fake, pacer=p))
    assert (r.outcome, r.code, r.result_version) == ("not_sent", "template_mismatch", 1)
    assert store.get_state(f"account:{ACC}") is None


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
