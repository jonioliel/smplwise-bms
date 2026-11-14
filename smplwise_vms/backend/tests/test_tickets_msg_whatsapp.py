"""CR-038 9.3 / 9.4: the WhatsApp adapter - the service calls it builds, the outcome classification (incl. the connect-vs-transfer
split on a real httpx stack with a MockTransport), buttons, reach, and log hygiene. Fakes only: no Home Assistant, no WhatsApp."""
from __future__ import annotations

import logging
from types import SimpleNamespace

import httpx
import pytest
from fake_ha_whatsapp import FakeHaWhatsapp, PairedAccount
from tickets_msg_fakes import ENTRY_A, KEY_A, PHONE_VENDOR, default_doc

from smplwise.errors import ApiError
from smplwise.services import messaging_accounts as ma
from smplwise.services.tickets import channel_whatsapp as cw
from smplwise.services.tickets.channel import AccountRef, Button, OutboundMessage, Recipient, TicketChannel

TEXT = "שלום דני, בקשת שירות 1042: https://t-demo.example.test/t/#SECRETTOKEN0123456789abcdefghijk"


def accounts(fake: FakeHaWhatsapp) -> ma.AccountsService:
    from fake_ha_whatsapp import FakeMirror

    return ma.AccountsService(load_doc=default_doc, reader=FakeMirror(fake), registry=ma.UseRegistry(ma.tickets_uses(lambda: True)))


def msg(**kw) -> OutboundMessage:
    base = dict(outbox_id="ob1", channel="whatsapp", purpose="assign", recipient=Recipient("c1", "דני", phone=PHONE_VENDOR),
                text=TEXT, account=AccountRef(KEY_A, ENTRY_A, "שירות"))
    base.update(kw)
    return OutboundMessage(**base)


def channel(fake=None, buttons=False) -> tuple[cw.WhatsAppChannel, FakeHaWhatsapp]:
    fake = fake or FakeHaWhatsapp([PairedAccount(ENTRY_A, "15555550191")])
    return cw.WhatsAppChannel(fake, accounts(fake), use_buttons=lambda: buttons), fake


def test_it_is_a_ticket_channel():
    ch, _ = channel()
    assert isinstance(ch, TicketChannel) and ch.key == "whatsapp" and not ch.supports_buttons()


def test_send_message_always_names_the_account():
    ch, fake = channel()
    result = ch.send(msg())
    assert result.outcome == "sent" and result.provider_message_id.startswith("3EB0FAKE")
    [call] = fake.calls
    assert call["domain"] == "whatsapp" and call["service"] == "send_message" and call["return_response"] is True
    assert call["data"] == {"account": ENTRY_A, "target": PHONE_VENDOR, "message": TEXT}
    assert call["timeout"] == 15.0


def test_buttons_only_when_switched_on():
    b = (Button("t:0123456789abcdef:ack", "התקבל"), Button("t:0123456789abcdef:wip", "בטיפול"))
    ch, fake = channel()
    ch.send(msg(buttons=b, footer="בקשת שירות 1042"))
    assert fake.calls[-1]["service"] == "send_message" and "buttons" not in fake.calls[-1]["data"]
    ch, fake = channel(buttons=True)
    ch.send(msg(buttons=b, footer="בקשת שירות 1042"))
    data = fake.calls[-1]["data"]
    assert fake.calls[-1]["service"] == "send_buttons"
    assert data["buttons"] == [{"id": "t:0123456789abcdef:ack", "displayText": "התקבל"}, {"id": "t:0123456789abcdef:wip", "displayText": "בטיפול"}]
    assert data["footer"] == "בקשת שירות 1042"


@pytest.mark.parametrize("kw,code", [
    ({"account": None}, "account_unmapped"), ({"account": AccountRef(KEY_A, "", "")}, "account_unmapped"),
    ({"recipient": Recipient("c1", phone=None)}, "no_phone"), ({"recipient": Recipient("c1", phone="123@lid")}, "no_phone"),
    ({"text": "   "}, "empty")])
def test_unsendable_messages_never_reach_the_transport(kw, code):
    ch, fake = channel()
    result = ch.send(msg(**kw))
    assert (result.outcome, result.outcome_code) == ("not_sent", code) and fake.calls == []


@pytest.mark.parametrize("outcome,expected", [
    ("ok", ("sent", None)), ("ok_no_id", ("sent", None)), ("refused", ("refused", "provider_refused")),
    ("connect", ("not_sent", "ha_unavailable")), ("timeout", ("unknown", "timeout")), ("http500", ("unknown", "ha_error")),
    ("http502", ("unknown", "ha_error")), ("http408", ("unknown", "ha_error")), ("http302", ("unknown", "ha_error")),
    ("http404", ("not_sent", "service_not_found")), ("http401", ("not_sent", "ha_forbidden")), ("http403", ("not_sent", "ha_forbidden")),
    ("http429", ("not_sent", "rate_limited")), ("unknown_account", ("not_sent", "account_not_found")),
    ("multiple_accounts", ("not_sent", "account_not_found")), ("bad_request", ("not_sent", "bad_request")),
    ("malformed", ("unknown", "malformed"))])
def test_outcome_classification(outcome, expected):
    ch, fake = channel()
    fake.queue(outcome)
    r = ch.send(msg())
    assert (r.outcome, r.outcome_code) == expected


def test_an_account_the_integration_does_not_know_is_not_sent():
    ch, fake = channel()
    r = ch.send(msg(account=AccountRef("manual:abcd", "15555550199", "x")))
    assert (r.outcome, r.outcome_code) == ("not_sent", "account_not_found")


def test_a_version_without_return_values_is_retried_without_asking_for_one():
    ch, fake = channel()
    fake.supports_response = False
    first = ch.send(msg())
    assert (first.outcome, first.outcome_code) == ("not_sent", "response_unsupported")
    second = ch.send(msg())
    assert second.outcome == "sent" and fake.calls[-1]["return_response"] is False


def test_an_exception_inside_the_transport_is_unknown():
    class Boom:
        def call(self, *a, **k):
            raise RuntimeError("unexpected")

    ch = cw.WhatsAppChannel(Boom(), accounts(FakeHaWhatsapp()))
    assert ch.send(msg()).outcome == "unknown"


def test_message_id_shape_is_checked():
    reply = cw.TransportReply("response", 200, {"service_response": {"success": True, "message_id": "<script>" * 30}}, True)
    assert cw.classify(reply).provider_message_id is None


@pytest.mark.parametrize("code,expected", [("ha_not_configured", "not_sent"), ("service_not_found", "not_sent"),
                                           ("ha_forbidden", "not_sent"), ("ha_unavailable", "unknown"), ("ha_error", "unknown"),
                                           ("whatever", "unknown")])
def test_api_error_mapping_is_conservative(code, expected):
    assert cw.outcome_from_api_error(ApiError(503, code, "x")).outcome == expected


def test_reach():
    fake = FakeHaWhatsapp([PairedAccount(ENTRY_A, "1", connected=False)])
    ch = cw.WhatsAppChannel(fake, accounts(fake))
    ref = AccountRef(KEY_A, ENTRY_A)
    assert ch.can_reach(Recipient("c1", phone=PHONE_VENDOR), ref) == "channel_down"
    assert ch.can_reach(Recipient("c1", phone=None), ref) == "no_address"
    assert ch.can_reach(Recipient("c1", phone=PHONE_VENDOR, opted_out=True), ref) == "opted_out"
    up, _ = channel()
    assert up.can_reach(Recipient("c1", phone=PHONE_VENDOR), ref) == "ok"
    assert up.status(ref).state == "connected" and up.status(None).state == "not_configured"


def test_the_adapter_logs_no_number_and_no_text(caplog):
    caplog.set_level(logging.DEBUG)
    ch, fake = channel()
    for outcome in ("ok", "timeout", "unknown_account", "http500"):
        fake.queue(outcome)
        ch.send(msg())
    assert "outbox=ob1" in caplog.text
    for secret in (PHONE_VENDOR, "SECRETTOKEN", "שלום דני", ENTRY_A[:0] + "15555550191"):
        assert secret not in caplog.text


def test_parse_inbound_delegates_to_the_normaliser():
    ch, _ = channel()
    m = ch.parse_inbound(FakeHaWhatsapp.received(PHONE_VENDOR, "1", at=None))
    assert m is not None and m.sender_digits == PHONE_VENDOR and m.content == "1"
    assert ch.parse_inbound({"event_type": "state_changed", "data": {}}) is None


# ---------------------------------------------------------------- the real transport on httpx (MockTransport: no network)

SETTINGS = SimpleNamespace(ha_url="http://ha.invalid/core", ha_token="supervisor-token-test")


def transport(handler) -> cw.HaServiceTransport:
    return cw.HaServiceTransport(SETTINGS, client_factory=lambda timeout: httpx.Client(transport=httpx.MockTransport(handler), timeout=timeout))


def test_http_transport_request_and_success():
    seen = {}

    def handler(request: httpx.Request) -> httpx.Response:
        seen["url"], seen["auth"], seen["body"] = str(request.url), request.headers["authorization"], request.content
        return httpx.Response(200, json={"changed_states": [], "service_response": {"success": True, "message_id": "ABC"}})

    reply = transport(handler).call("whatsapp", "send_message", {"account": ENTRY_A, "target": PHONE_VENDOR, "message": "x"},
                                    return_response=True, timeout=15)
    assert seen["url"] == "http://ha.invalid/core/api/services/whatsapp/send_message?return_response"
    assert seen["auth"] == "Bearer supervisor-token-test"
    assert cw.classify(reply).provider_message_id == "ABC"


@pytest.mark.parametrize("exc,kind,outcome", [
    (httpx.ConnectError("refused"), "connect_error", "not_sent"), (httpx.ConnectTimeout("slow"), "connect_error", "not_sent"),
    (httpx.PoolTimeout("pool"), "connect_error", "not_sent"), (httpx.ReadTimeout("read"), "transfer_error", "unknown"),
    (httpx.WriteTimeout("write"), "transfer_error", "unknown"), (httpx.RemoteProtocolError("dropped"), "transfer_error", "unknown"),
    (httpx.ReadError("reset"), "transfer_error", "unknown")])
def test_http_transport_splits_connect_from_transfer_failures(exc, kind, outcome):
    def handler(request):
        raise exc

    reply = transport(handler).call("whatsapp", "send_message", {}, return_response=True, timeout=1)
    assert reply.kind == kind and cw.classify(reply).outcome == outcome


def test_http_transport_statuses_and_bodies():
    def handler(request):
        return httpx.Response(400, text="WhatsApp account 'x' not found")

    assert cw.classify(transport(handler).call("whatsapp", "send_message", {}, return_response=True, timeout=1)).outcome_code == "account_not_found"

    def handler500(request):
        return httpx.Response(500, text="Internal Server Error")

    assert cw.classify(transport(handler500).call("whatsapp", "send_message", {}, return_response=True, timeout=1)).outcome == "unknown"

    def not_json(request):
        return httpx.Response(200, text="<html>")

    assert cw.classify(transport(not_json).call("whatsapp", "send_message", {}, return_response=True, timeout=1)).outcome_code == "malformed"


def test_http_transport_without_configuration():
    t = cw.HaServiceTransport(SimpleNamespace(ha_url="", ha_token=""))
    assert cw.classify(t.call("whatsapp", "send_message", {}, return_response=True, timeout=1)).outcome_code == "ha_not_configured"
