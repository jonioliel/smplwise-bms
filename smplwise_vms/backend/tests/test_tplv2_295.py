"""TPLV2-295: WhatsApp template send v2 - the Arx side (contract module, flow, routes) against a FAKE station only.

Nothing here contacts WisKey, a phone, a station or Home Assistant for a template send. The messaging fake (tests/fake_wiskey_messaging.py)
only serves the people directory and the connected-service state; the v2 hand-over goes to `FakeV2Station` below. The permit
`TEMPLATE_SEND_SUPPORTED` is opened INSIDE a test only."""
from __future__ import annotations

import json
import uuid
from typing import Any

import pytest
from intercom_station_scope import station_scope  # noqa: F401 - a fixture
from test_intercom_messaging import API, audits, details, enable, mc, messages, req, rows  # noqa: F401 - `mc` is a fixture

from smplwise.services import intercom_messaging_adapter as adapter
from smplwise.services import wa_template_send as wts
from smplwise.services import wa_template_v2_contract as contract
from smplwise.services import wa_template_v2_flow as flow

REF = {"id": "access", "name": "synthetic_access", "language": "he", "params": ["name"], "purpose": "notice",
       "template_ref": "synthetic-template", "template_revision": 3}
PHONE_FRAGMENT = "+97250"


class FakeV2Station:
    """The v2 transport of a fake station: records each wire object; `answers` are consumed in order, then `default`."""

    def __init__(self, *answers: Any, default: Any = None) -> None:
        self.answers = list(answers)
        self.default = default if default is not None else wts.closed_result(2, "accepted", "provider_accepted", True)
        self.wires: list[dict[str, Any]] = []

    def send_v2(self, wire: dict[str, Any]) -> Any:
        self.wires.append(dict(wire))
        nxt = self.answers.pop(0) if self.answers else self.default
        if isinstance(nxt, BaseException):
            raise nxt
        return nxt


@pytest.fixture()
def v2(mc, monkeypatch):  # noqa: F811
    """The messaging app with messaging ENABLED, the template switch still OFF and the permit CLOSED, plus a fake station installed as
    the v2 transport. `open_v2()` turns the switch on and opens the permit (in this test only)."""
    fake, c, s = mc
    enable(c)
    station = FakeV2Station()
    monkeypatch.setattr(wts, "TRANSPORT_V2_PROVIDER", lambda: station)

    def open_v2(templates: list[dict[str, Any]] | None = None) -> None:
        monkeypatch.setattr(adapter, "TEMPLATE_SEND_SUPPORTED", True)
        r = req(c, "PUT", "/messaging/template-send", json={"enabled": True, "templates": [REF] if templates is None else templates})
        assert r.status_code == 200, r.text

    return c, s, station, open_v2


def preview(c: Any, person: str = "u1", user: str = "root", template: str = "access") -> Any:
    return req(c, "POST", f"/people/{person}/messages/template-v2/preview", user, json={"template_id": template})


def send(c: Any, token: str | None, person: str = "u1", user: str = "root", **over: Any) -> Any:
    body = {"client_request_id": uuid.uuid4().hex, "confirmed": True, "template_id": "access", "preview_token": token or "x" * 16, **over}
    return req(c, "POST", f"/people/{person}/messages/template-v2", user, json=body)


def token_of(c: Any, person: str = "u1") -> str:
    r = preview(c, person)
    assert r.status_code == 200, r.text
    return r.json()["preview"]["token"]


# ---------------------------------------------------------------- the contract module (one place for WisKey-defined names)

def test_contract_module_names_every_wiskey_defined_item_and_marks_the_unconfirmed():
    names = {i["item"]: i["status"] for i in contract.items()}
    assert names["command_name"] == contract.ADOPTED and contract.COMMAND == "whatsapp/template_send_v2"
    # WISKEY-MAC-ADOPT-298: WisKey's seven template answers confirmed the person revision (2), retry_after (4) and the open window (5);
    # the pacing budget (3, partial) and the live queue (6, installation NOT_PERFORMED) stay unconfirmed
    assert {"pacing_schema_version", "queue_and_execution_source"} == set(contract.unconfirmed())
    assert {names[k] for k in ("person_revision_source", "retry_after_on_not_sent", "conversation_window_signal")} == {contract.ADOPTED_MAC}
    assert contract.DIRECT_STATION_VERIFIED is False and contract.public_state()["station_verified"] is False
    assert contract.SCHEMA_VERSION == 2 and len(contract.REQUEST_KEYS) == 10 and "consent" not in contract.REQUEST_KEYS
    assert set(contract.WISKEY_NOT_SENT_CODES) == {"template_mismatch", "source_or_admission_refused"}


def test_the_production_permit_is_closed_and_the_switch_is_off_by_default():
    assert adapter.TEMPLATE_SEND_SUPPORTED is False and wts.permit() is False


# ---------------------------------------------------------------- the flow's pure parts

def _tpl(**kw: Any) -> wts.TemplateRef:
    return wts.TemplateRef("access", "synthetic_access", "he", ("name",), "notice", **{"wiskey_ref": "r", "wiskey_revision": 3, **kw})


def test_the_binding_token_follows_every_fact_the_preview_showed():
    base = flow.binding_token(tpl=_tpl(), person_id="p", person_revision=7, account="a")
    assert base == flow.binding_token(tpl=_tpl(), person_id="p", person_revision=7, account="a")
    for other in (flow.binding_token(tpl=_tpl(wiskey_revision=4), person_id="p", person_revision=7, account="a"),
                  flow.binding_token(tpl=_tpl(wiskey_ref="r2"), person_id="p", person_revision=7, account="a"),
                  flow.binding_token(tpl=_tpl(), person_id="p", person_revision=8, account="a"),
                  flow.binding_token(tpl=_tpl(), person_id="q", person_revision=7, account="a"),
                  flow.binding_token(tpl=_tpl(), person_id="p", person_revision=None, account="a")):
        assert other != base


def test_blockers_name_what_is_unknown_instead_of_guessing():
    assert flow.blockers(switch=True, permit=True, tpl=_tpl(), person_revision=1, account="a") == []
    got = flow.blockers(switch=False, permit=False, tpl=_tpl(wiskey_ref=None, wiskey_revision=None), person_revision=None, account=None)
    assert got == ["template_send_off", "template_unsupported", "template_v2_unbound", "person_revision_unknown", "account_unavailable"]
    assert "template_not_found" in flow.blockers(switch=True, permit=True, tpl=None, person_revision=1, account="a")


@pytest.mark.parametrize(("result", "outcome"), [
    (wts.TemplateResult("sent", result_version=2), "sent"),
    (wts.TemplateResult("unknown", code="provider_outcome_unknown", result_version=2), "unknown"),
    (wts.TemplateResult("unknown", code="invalid_response"), "unknown"),  # no usable answer: still unknown, never not_sent
    (wts.TemplateResult("not_sent", code="template_mismatch", result_version=2), "refused"),  # WisKey answered with a closed refusal
    (wts.TemplateResult("not_sent", code="paced", reason="paced", retry_after_s=30), "not_sent"),  # decided locally
    (wts.TemplateResult("not_sent", code="template_unsupported", reason="template_unsupported"), "not_sent"),
])
def test_verdicts_never_turn_unknown_into_false(result, outcome):
    assert flow.verdict_of(result).outcome == outcome


def test_request_ids_derive_from_the_one_attempt_id():
    rid, op = flow.request_ids("abcdef0123456789")
    assert rid == "abcdef0123456789" and op == "tplv2-abcdef0123456789" and wts.WIRE_ID_RE.fullmatch(op)


# ---------------------------------------------------------------- settings: OFF by default, per-role permission, validated

def test_settings_default_off_and_only_a_configurer_may_read_or_change_them(v2):
    c, s, station, open_v2 = v2
    r = req(c, "GET", "/messaging/template-send")
    assert r.status_code == 200 and r.json()["enabled"] is False and r.json()["permit"] is False and r.json()["templates"] == []
    assert r.json()["contract"]["station_verified"] is False and "pacing_schema_version" in r.json()["contract"]["unconfirmed"]
    for user in ("vera", "otto"):
        assert req(c, "GET", "/messaging/template-send", user).status_code == 403
        assert req(c, "PUT", "/messaging/template-send", user, json={"enabled": True}).status_code == 403
    assert req(c, "GET", "/messaging/template-send").json()["enabled"] is False


@pytest.mark.parametrize(("body", "path"), [
    ({"enabled": "yes"}, "enabled"), ({"enabled": 1}, "enabled"),
    ({"templates": [{**REF, "template_revision": None}]}, "templates.0"),  # half of the WisKey pair
    ({"templates": [{**REF, "name": "Bad Name"}]}, "templates.0"),
    ({"templates": [REF, REF]}, "templates.1"),
    ({"templates": "nope"}, "templates"),
])
def test_settings_are_validated_and_nothing_is_stored_on_a_problem(v2, body, path):
    c, s, station, open_v2 = v2
    r = req(c, "PUT", "/messaging/template-send", json=body)
    assert r.status_code == 422 and r.json()["code"] == "template_send_invalid", r.text
    assert path in json.dumps(r.json())
    assert req(c, "GET", "/messaging/template-send").json()["templates"] == []


def test_a_settings_save_is_audited_with_names_and_counts_only(v2):
    c, s, station, open_v2 = v2
    open_v2()
    a = rows(s, "SELECT * FROM audit_log WHERE action = ?", "intercom.messaging.template_send_settings")
    assert len(a) == 1 and details(a[0])["changed"] == ["enabled", "templates"] and details(a[0])["templates"] == 1
    assert "synthetic-template" not in json.dumps(a)


# ---------------------------------------------------------------- the send: off, closed, bound, confirmed

def test_off_by_default_the_preview_says_why_and_a_send_hands_nothing_on(v2):
    c, s, station, open_v2 = v2
    p = preview(c)
    assert p.status_code == 422 and "template_not_found" in p.text  # no reference stored yet
    r = req(c, "PUT", "/messaging/template-send", json={"templates": [REF]})  # references saved, switch still off
    assert r.status_code == 200 and r.json()["enabled"] is False
    p = preview(c).json()
    assert p["can_send"] is False and {"template_send_off", "template_unsupported"} <= set(p["blockers"])
    r = send(c, p["preview"]["token"])
    assert r.status_code == 409 and station.wires == [] and messages(s) == []


def test_with_the_switch_on_but_the_permit_closed_nothing_leaves(v2):
    c, s, station, open_v2 = v2
    req(c, "PUT", "/messaging/template-send", json={"enabled": True, "templates": [REF]})
    p = preview(c).json()
    assert p["blockers"] == ["template_unsupported"] and p["can_send"] is False
    r = send(c, p["preview"]["token"])
    assert r.status_code == 409 and station.wires == [] and messages(s) == []


def test_the_preview_shows_what_arx_knows_and_says_it_cannot_show_the_text(v2):
    c, s, station, open_v2 = v2
    open_v2()
    p = preview(c)
    assert p.status_code == 200, p.text
    j = p.json()
    assert j["can_send"] is True and j["blockers"] == []
    pv = j["preview"]
    assert pv["content_shown"] is False and pv["fills_from"] == "wiskey" and pv["window"] == "unknown"
    assert pv["template"] == {"id": "access", "name": "synthetic_access", "language": "he", "purpose": "notice", "revision": 3}
    assert pv["recipient"]["id"] == "u1" and isinstance(pv["recipient"]["revision"], int)
    assert PHONE_FRAGMENT not in p.text and "synthetic-template" not in p.text
    assert station.wires == [] and messages(s) == []  # a preview sends and records nothing


def test_a_confirmed_send_reaches_the_fake_once_with_the_ten_closed_keys_and_no_consent(v2):
    c, s, station, open_v2 = v2
    open_v2()
    tok = token_of(c)
    r = send(c, tok)
    assert r.status_code == 200, r.text
    assert r.json()["message"]["outcome"] == "sent" and r.json()["message"]["delivery"] == "unknown"
    (w,) = station.wires
    assert set(w) == contract.REQUEST_KEYS and w["schema_version"] == 2 and w["template_ref"] == "synthetic-template"
    assert w["expected_template_revision"] == 3 and w["recipient_ref"] == "u1" and w["template_name"] == "synthetic_access"
    assert isinstance(w["expected_person_revision"], int) and w["operation_id"] == "tplv2-" + w["request_id"]
    assert not any("consent" in k or "phone" in k or "param" in k or "pin" in k for k in w)
    (m,) = messages(s)
    assert (m["kind"], m["template_id"], m["outcome"], m["person_id"], m["template_revision"]) == ("template", "access", "sent", "u1", 3)
    a1, a2 = audits(s)[-2:]
    assert [details(a1)["phase"], details(a2)["phase"]] == ["attempt", "outcome"] and details(a2)["outcome"] == "sent"
    blob = json.dumps({"a": rows(s, "SELECT * FROM audit_log"), "m": messages(s)}, ensure_ascii=False)
    assert PHONE_FRAGMENT not in blob and "synthetic-template" not in blob and tok not in blob


def test_a_missing_or_wrong_confirmation_sends_nothing(v2):
    c, s, station, open_v2 = v2
    open_v2()
    tok = token_of(c)
    for bad in (False, "true", None, 1):
        r = send(c, tok, confirmed=bad)
        assert r.status_code == 409 and r.json()["code"] == "confirmation_required", r.text
    assert station.wires == [] and messages(s) == []


def test_a_changed_template_or_a_wrong_token_is_stale_and_sends_nothing(v2):
    c, s, station, open_v2 = v2
    open_v2()
    tok = token_of(c)
    r = req(c, "PUT", "/messaging/template-send", json={"templates": [{**REF, "template_revision": 4}]})
    assert r.status_code == 200
    r = send(c, tok)
    assert r.status_code == 409 and "template_v2_preview_stale" in r.text
    assert send(c, "0" * 32).status_code == 409
    assert station.wires == [] and messages(s) == []
    assert send(c, token_of(c)).status_code == 200 and station.wires[0]["expected_template_revision"] == 4


def test_an_unbound_template_cannot_be_sent(v2):
    c, s, station, open_v2 = v2
    open_v2([{k: v for k, v in REF.items() if k not in ("template_ref", "template_revision")}])
    p = preview(c).json()
    assert p["blockers"] == ["template_v2_unbound"]
    r = send(c, p["preview"]["token"])
    assert r.status_code == 422 and station.wires == [] and messages(s) == []


def test_a_viewer_and_a_person_who_opted_out_cannot_be_messaged(v2):
    c, s, station, open_v2 = v2
    open_v2()
    tok = token_of(c)
    assert req(c, "POST", "/people/u1/messages/template-v2/preview", "vera", json={"template_id": "access"}).status_code == 403
    assert send(c, tok, user="vera").status_code == 403
    r = req(c, "PUT", "/people/u1/messages/optout", json={"opted_out": True})
    assert r.status_code == 200, r.text
    r = send(c, tok)
    assert r.status_code == 409 and "message_no_consent" in r.text
    assert station.wires == [] and messages(s) == []


def test_messaging_off_or_a_repeated_attempt_id_sends_nothing(v2):
    c, s, station, open_v2 = v2
    open_v2()
    tok = token_of(c)
    cid = uuid.uuid4().hex
    assert send(c, tok, client_request_id=cid).status_code == 200
    r = send(c, tok, client_request_id=cid)
    assert r.status_code == 409 and "message_duplicate" in r.text
    assert len(station.wires) == 1 and len(messages(s)) == 1


# ---------------------------------------------------------------- honest outcomes

def test_a_closed_wiskey_refusal_is_refused_not_unknown_and_not_retried(v2):
    c, s, station, open_v2 = v2
    open_v2()
    station.answers.append(wts.closed_result(2, "not_sent", "template_mismatch", False))
    r = send(c, token_of(c))
    assert r.status_code == 502 and "template_v2_refused" in r.text and '"outcome":"refused"' in r.text.replace(" ", "")
    assert len(station.wires) == 1
    (m,) = messages(s)
    assert m["outcome"] == "refused" and m["reason"] == "template_mismatch"


@pytest.mark.parametrize("answer", [
    {"state": "accepted"},                                              # not a closed result
    wts.closed_result(1, "accepted", "provider_accepted", True),        # a v1 result is never read as v2
    wts.closed_result(2, "unknown", "provider_outcome_unknown", None),  # WisKey itself says unknown
    {"schema_version": 2, "state": "accepted", "code": "provider_accepted", "provider_accepted": True, "delivery": "delivered", "retry_permitted": False},
    None, "ok", [],
    RuntimeError("socket closed after the hand-over"),
], ids=["not_closed", "v1_result", "wiskey_unknown", "delivery_claimed", "none", "string", "list", "exception"])
def test_anything_unproven_is_unknown_504_recorded_unknown_and_never_retried(v2, answer):
    c, s, station, open_v2 = v2
    open_v2()
    station.answers.append(answer)
    r = send(c, token_of(c))
    assert r.status_code == 504 and "message_uncertain" in r.text, r.text
    assert len(station.wires) == 1
    (m,) = messages(s)
    assert m["outcome"] == "unknown"
    assert details(audits(s)[-1])["outcome"] == "unknown"


def test_no_v2_transport_installed_refuses_before_any_hand_over(v2, monkeypatch):
    c, s, station, open_v2 = v2
    open_v2()
    tok = token_of(c)
    monkeypatch.setattr(wts, "TRANSPORT_V2_PROVIDER", lambda: None)  # the direct path is not selected
    r = send(c, tok)
    assert r.status_code == 409 and "template_v2_unavailable" in r.text
    assert station.wires == [] and messages(s) == []  # the attempt record of a send that never left is removed
