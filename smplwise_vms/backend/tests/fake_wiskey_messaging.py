"""CR-036 WA: the messaging half of the fake WisKey, extended for the people screen's message routes (tests/test_intercom_messaging.py).

tests/fake_wiskey.py (S7) already answers `whatsapp/status | preview | send | templates_* | history` with the response keys rc.37's
whatsapp_api.py shows. This subclass adds the states the Arx-side adapter has to survive and S7's fake could not produce - every one of
them a SWITCH, so a test can walk the contract state by state (the contract itself: services/intercom_messaging_adapter.py):

- `wa_available` (S7)        the messaging service is not connected -> `status.available` false, preview / send `whatsapp_unavailable`
- `wa_quota` (S7)            WisKey's own allowance `{limit, used}` -> the send past it is `rate_limited`
- `wa_unregistered` (S7)     numbers the provider refuses -> `whatsapp_invalid_phone` at the send
- `wa_accounts`              several messaging accounts (a list of `{id, name}`; None = the one account of the base fake)
- `wa_preview_pin`           the PIN rc.37's `preview` puts into the message it builds (the add-on must never read, keep or forward it)
- `wa_uncertain`             person ids whose send ends in `whatsapp_send_uncertain` (rc.37 turns EVERY provider exception into it)
- a person's `phone` ("" = no phone -> `whatsapp_invalid_phone`) and `whatsapp_consent` (granted | declined | unknown: the consent field
  Arx PROPOSES to W11, carried by `users/get`)
- `errors_once` / `slow` / `set_forbidden` / `unlist` (the base fake's) for the one-off codes, a timeout, a refusal of the identity,
  a WisKey that does not list the commands.

`wa_sent` records what the "provider" received (user, account, text, uncertain): the text a real recipient would have read.
"""
from __future__ import annotations

from typing import Any

from fake_wiskey import FakeWiskey, fail, ok


class MessagingWiskey(FakeWiskey):
    def __init__(self, *args: Any, **kwargs: Any) -> None:
        super().__init__(*args, **kwargs)
        self.wa_accounts: list[dict[str, str]] | None = None
        self.wa_preview_pin: str | None = None
        self.wa_uncertain: set[str] = set()
        self.wa_sent: list[dict[str, Any]] = []

    def _accounts(self) -> list[dict[str, str]]:
        return [dict(a) for a in (self.wa_accounts if self.wa_accounts is not None else [self.WA_ACCOUNT])]

    def _whatsapp(self, command: str, msg: dict[str, Any]) -> list[Any]:
        if command in ("whatsapp/templates_get", "whatsapp/templates_update", "whatsapp/history"):
            return super()._whatsapp(command, msg)
        if command == "whatsapp/status":
            return [ok(msg, {"available": self.wa_available, "history": self.wa_available, "accounts": self._accounts() if self.wa_available else [],
                             "quota": dict(self.wa_quota) if self.wa_quota else None})]
        if not self.wa_available or msg.get("account") not in {a["id"] for a in self._accounts()}:
            return [fail(msg, "whatsapp_unavailable")]
        person = self._person(msg.get("user_id"))
        if person is None:
            return [fail(msg, "user_not_found")]
        number = str(person.get("phone") or "").strip()
        if not number:
            return [fail(msg, "whatsapp_invalid_phone")]
        bound = {"user": person["id"], "revision": person.get("revision"), "phone": number, "account": msg["account"]}
        if command == "whatsapp/preview":
            token = f"wa-token-{len(self._wa_tokens) + 1}"
            self._wa_tokens[token] = bound
            # rc.37 builds the renewal message with the person's PIN in it - and hands it to whoever asked for the preview
            text = f"שלום {person.get('display_name', '')}\nקוד הגישה האישי שלך:\n📟 {self.wa_preview_pin} 📟" if self.wa_preview_pin else "תצוגה מקדימה"
            return [ok(msg, {"token": token, "recipient": number, "message": text, "warnings": ["draft"], "consent": person.get("whatsapp_consent", "unknown"),
                             "quota": dict(self.wa_quota) if self.wa_quota else None})]
        if command == "whatsapp/send":
            text = msg.get("message")
            if msg.get("confirmed") is not True or not isinstance(text, str) or not text.strip() or len(text) > self.WA_TEXT_MAX:
                return [fail(msg, "invalid_fields")]
            if self._wa_tokens.pop(msg.get("token"), None) != bound:
                return [fail(msg, "whatsapp_preview_expired")]
            if self.wa_quota is not None and self.wa_quota["used"] >= self.wa_quota["limit"]:
                return [fail(msg, "rate_limited")]
            if number in self.wa_unregistered:
                return [fail(msg, "whatsapp_invalid_phone")]
            if person["id"] in self.wa_uncertain:
                self.wa_sent.append({"user": person["id"], "account": msg["account"], "text": text, "uncertain": True})
                return [fail(msg, "whatsapp_send_uncertain")]
            if self.wa_quota is not None:
                self.wa_quota["used"] += 1
            self.wa_sent.append({"user": person["id"], "account": msg["account"], "text": text, "uncertain": False})
            return [ok(msg, {"accepted": True})]
        return [fail(msg, "unknown_command")]
