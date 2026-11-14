"""CR-036 S7: the messaging half of the fake WisKey (tests/fake_wiskey.py `_whatsapp`) - the stand-in the people screen's message
dialog is designed against while the real WisKey side (ask W11) is not delivered. Nothing is sent anywhere: the fake only counts.

What these tests pin: the frames the Arx adapter will send are valid against the pinned catalog (strict request checks), the
send needs a fresh single-use preview token bound to the person, the quota and the provider refusals come back as the codes the
catalog lists, and the approved templates carry no credential placeholder (the screen's rule: a message never contains a PIN)."""
from __future__ import annotations

import re
from typing import Any

from fake_wiskey import PREFIX, FakeWiskey, HA_ERROR_CODES, all_error_codes, fixture

ACCOUNT = "wa-1"


def call(fake: FakeWiskey, command: str, **kw: Any) -> dict[str, Any]:
    return fake.respond({"id": 5, "type": PREFIX + command, **kw})[0]


def code(frame: dict[str, Any]) -> str:
    return "ok" if frame["success"] else frame["error"]["code"]


def preview(fake: FakeWiskey, user: str = "u1") -> dict[str, Any]:
    frame = call(fake, "whatsapp/preview", user_id=user, account=ACCOUNT, language="he")
    assert frame["success"], frame
    return frame["result"]


def send(fake: FakeWiskey, token: str, text: str = "שלום", user: str = "u1", confirmed: bool = True) -> dict[str, Any]:
    return call(fake, "whatsapp/send", user_id=user, account=ACCOUNT, token=token, message=text, confirmed=confirmed)


def test_the_frames_the_adapter_will_send_pass_the_pinned_catalog():
    fake = FakeWiskey().use_directory()
    assert code(call(fake, "whatsapp/status")) == "ok" and code(call(fake, "whatsapp/templates_get")) == "ok"
    assert code(call(fake, "whatsapp/history", user_id="u1", account=ACCOUNT)) == "ok"
    assert code(call(fake, "whatsapp/send", user_id="u1", account=ACCOUNT, message="x", confirmed=True)) == "invalid_format", "the token is required"
    assert code(call(fake, "whatsapp/preview", user_id="u1", account=ACCOUNT)) == "invalid_format", "the language is required"
    assert code(call(fake, "whatsapp/send", user_id="u1", account=ACCOUNT, token="t", message="x", confirmed=True, extra=1)) == "invalid_format"


def test_status_says_whether_the_service_is_connected():
    fake = FakeWiskey().use_directory()
    ok = call(fake, "whatsapp/status")["result"]
    assert ok["available"] is True and ok["accounts"] == [{"id": ACCOUNT, "name": "Office line"}]
    fake.wa_available = False
    down = call(fake, "whatsapp/status")["result"]
    assert down["available"] is False and down["accounts"] == []
    assert code(call(fake, "whatsapp/preview", user_id="u1", account=ACCOUNT, language="he")) == "whatsapp_unavailable"


def test_a_send_needs_a_fresh_single_use_token_bound_to_the_person():
    fake = FakeWiskey().use_directory()
    first = preview(fake)
    assert first["recipient"] == "+972500000000" and first["message"] and first["warnings"] == [] and first["consent"] == "granted"
    assert code(send(fake, "no-such-token")) == "whatsapp_preview_expired"
    assert code(send(fake, first["token"], user="u2")) == "whatsapp_preview_expired", "a token is bound to the person it was issued for"
    again = preview(fake)
    assert code(send(fake, again["token"], text="  ")) == "invalid_fields"
    third = preview(fake)
    assert code(send(fake, third["token"], confirmed=False)) == "invalid_fields", "unconfirmed"
    fourth = preview(fake)
    assert code(send(fake, fourth["token"], text="x" * 12001)) == "invalid_fields"
    fifth = preview(fake)
    assert code(send(fake, fifth["token"])) == "ok"
    assert code(send(fake, fifth["token"])) == "whatsapp_preview_expired", "a token is used once"


def test_the_quota_and_the_provider_refusals_come_back_as_catalog_codes():
    fake = FakeWiskey().use_directory()
    fake.wa_quota = {"limit": 2, "used": 0}
    assert preview(fake)["quota"] == {"limit": 2, "used": 0}
    assert code(send(fake, preview(fake)["token"])) == "ok" and code(send(fake, preview(fake)["token"])) == "ok"
    assert code(send(fake, preview(fake)["token"])) == "rate_limited", "past the hourly quota"
    assert fake.wa_quota["used"] == 2, "a refused send is not counted"
    fake.wa_quota = None
    fake.wa_unregistered = {"+972500000000"}
    assert code(send(fake, preview(fake)["token"])) == "whatsapp_invalid_phone", "a number the provider does not know"
    person = next(p for p in fake.directory if p["id"] == "u2")
    person["phone"] = ""
    assert code(call(fake, "whatsapp/preview", user_id="u2", account=ACCOUNT, language="he")) == "whatsapp_invalid_phone", "no phone"
    assert code(call(fake, "whatsapp/preview", user_id="nobody", account=ACCOUNT, language="he")) == "user_not_found"


def test_consent_is_the_fakes_own_model_of_something_w11_has_not_defined():
    fake = FakeWiskey().use_directory()
    next(p for p in fake.directory if p["id"] == "u1")["whatsapp_consent"] = "declined"
    assert preview(fake)["consent"] == "declined"
    assert preview(fake, "u2")["consent"] == "granted"


def test_the_approved_templates_carry_no_credential_placeholder():
    fake = FakeWiskey().use_directory()
    catalogue = call(fake, "whatsapp/templates_get")["result"]
    assert set(catalogue["placeholders"]) == {"name", "organization"}
    for template in catalogue["templates"]:
        assert not (set(re.findall(r"\{(\w+)\}", template["body"])) - {"name", "organization"}), template["id"]
    assert fixture("whatsapp_templates_get.json") == catalogue
    text = preview(fake)["message"]
    for forbidden in ("PIN", "pin", "קוד גישה", "📟"):
        assert forbidden not in text
    assert "{" not in text, "every placeholder is resolved"


def test_every_error_code_of_the_messaging_fake_is_in_the_catalog():
    fake = FakeWiskey()
    for name in ("whatsapp_unavailable", "whatsapp_invalid_phone", "whatsapp_preview_expired", "rate_limited", "invalid_fields", "user_not_found"):
        assert name in all_error_codes(fake) and (name in fake.errors or name in HA_ERROR_CODES), name
