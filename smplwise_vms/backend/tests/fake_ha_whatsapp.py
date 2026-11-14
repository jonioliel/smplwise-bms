"""A fake `ha-whatsapp` (FaserF) for the CR-038 message-channel tests. No network, no Home Assistant, no phone.

- `FakeHaWhatsapp.call(...)` implements `channel_whatsapp.ServiceTransport`: it records every service call (domain, service, a copy
  of the data incl. `account`) and answers from a script of named outcomes (or the default `ok`). With `check_account` on, an
  `account` value that names no paired entry answers like HA core does for a ServiceValidationError (400) - UNVERIFIED shape.
- `mirror_rows()` gives the entity-mirror rows of the paired accounts (one config entry per number: a connectivity binary sensor
  `<entry_id>_connection`, a messages-sent sensor, a last-message sensor) - the `[WA-SRC]` shape, UNVERIFIED on a real install.
- `received(...)` / `button(...)` build HA events (`whatsapp_message_received` / `whatsapp_button_pressed`) with or without
  `entry_id`, as an HA administrator's `fire_event` could too.
"""
from __future__ import annotations

import copy
import datetime as dt
from collections import deque
from dataclasses import dataclass
from typing import Any

from smplwise.services.messaging_accounts import MirrorRow
from smplwise.services.tickets.channel_whatsapp import TransportReply

OUTCOMES = ("ok", "refused", "connect", "timeout", "http500", "http502", "http404", "http401", "http403", "http408", "http429",
            "http302", "unknown_account", "multiple_accounts", "bad_request", "malformed", "no_response_support", "ok_no_id")


@dataclass
class PairedAccount:
    entry_id: str
    phone: str  # the paired number (fake)
    connected: bool = True
    with_connection_entity: bool = True
    entity_disabled: bool = False
    available: bool = True


class FakeHaWhatsapp:
    def __init__(self, accounts: list[PairedAccount] | None = None, *, check_account: bool = True) -> None:
        self.accounts = accounts if accounts is not None else [PairedAccount("01JFAKEENTRYA", "15555550191")]
        self.check_account = check_account
        self.calls: list[dict[str, Any]] = []
        self.script: deque[str] = deque()
        self.default = "ok"
        self.supports_response = True
        self._n = 0

    # ---------------------------------------------------------- the transport
    def queue(self, *outcomes: str) -> None:
        for o in outcomes:
            assert o in OUTCOMES, o
            self.script.append(o)

    def call(self, domain: str, service: str, data: dict[str, Any], *, return_response: bool, timeout: float) -> TransportReply:
        self.calls.append({"domain": domain, "service": service, "data": copy.deepcopy(data), "return_response": return_response,
                           "timeout": timeout})
        outcome = self.script.popleft() if self.script else self.default
        if return_response and not self.supports_response:
            outcome = "no_response_support"
        if outcome == "ok" and self.check_account and data.get("account") not in {a.entry_id for a in self.accounts}:
            outcome = "unknown_account"
        return self._reply(outcome, return_response)

    def _reply(self, outcome: str, return_response: bool) -> TransportReply:
        self._n += 1
        if outcome in ("ok", "ok_no_id"):
            if not return_response:
                return TransportReply("response", 200, [], True)
            response: dict[str, Any] = {"success": True}
            if outcome == "ok":
                response["message_id"] = f"3EB0FAKE{self._n:08d}"
            return TransportReply("response", 200, {"changed_states": [], "service_response": response}, True)
        if outcome == "refused":
            return TransportReply("response", 200, {"changed_states": [], "service_response": {"success": False}}, True)
        if outcome == "connect":
            return TransportReply("connect_error")
        if outcome == "timeout":
            return TransportReply("transfer_error")
        if outcome == "malformed":
            return TransportReply("response", 200, None, False)
        if outcome == "unknown_account":
            return TransportReply("response", 400, None, False, "400: Bad Request - WhatsApp account 'x' not found")
        if outcome == "multiple_accounts":
            return TransportReply("response", 400, {"message": "Multiple WhatsApp accounts found, specify one"}, True)
        if outcome == "no_response_support":
            return TransportReply("response", 400, None, False, "Service does not support responses. Remove return_response from request.")
        if outcome == "bad_request":
            return TransportReply("response", 400, None, False, "400: Bad Request")
        status = int(outcome[4:])
        return TransportReply("response", status, None, False)

    # ---------------------------------------------------------- what was sent
    def sent_texts(self) -> list[str]:
        return [c["data"].get("message", "") for c in self.calls]

    def accounts_used(self) -> list[str]:
        return [c["data"].get("account") for c in self.calls]

    # ---------------------------------------------------------- the entity mirror
    def mirror_rows(self) -> list[MirrorRow]:
        rows = []
        for a in self.accounts:
            if a.with_connection_entity:
                rows.append(MirrorRow(f"binary_sensor.whatsapp_{a.entry_id.lower()}_connected", "binary_sensor", "whatsapp",
                                      f"{a.entry_id}_connection", a.entry_id, "connectivity", "on" if a.connected else "off",
                                      a.available, a.entity_disabled))
            rows.append(MirrorRow(f"sensor.whatsapp_{a.entry_id.lower()}_messages_sent", "sensor", "whatsapp",
                                  f"{a.entry_id}_messages_sent", a.entry_id, None, "12"))
            rows.append(MirrorRow(f"sensor.whatsapp_{a.entry_id.lower()}_last_message", "sensor", "whatsapp",
                                  f"{a.entry_id}_last_message", a.entry_id, None, "unknown"))
        return rows

    def get_state(self, entity_id: str) -> dict[str, Any] | None:
        """ha_client.get_state stand-in for the on-demand label read (attributes incl. `phone_number`)."""
        for a in self.accounts:
            if entity_id == f"binary_sensor.whatsapp_{a.entry_id.lower()}_connected":
                return {"entity_id": entity_id, "state": "on" if a.connected else "off",
                        "attributes": {"phone_number": a.phone, "connection_state": "connected" if a.connected else "disconnected"}}
        return None

    # ---------------------------------------------------------- events
    @staticmethod
    def received(sender_number: str | None, content: str, *, at: dt.datetime | None, entry_id: str | None = None,
                 msg_type: str = "chat", selected_id: str | None = None, sender: str | None = None, sender_name: str = "ספק",
                 media_url: str | None = None, timestamp_format: str = "epoch") -> dict[str, Any]:
        data: dict[str, Any] = {"type": msg_type, "sender": sender if sender is not None else (f"{sender_number}@s.whatsapp.net" if sender_number else ""),
                                "sender_number": sender_number or "", "sender_name": sender_name, "content": content}
        if at is not None:
            data["timestamp"] = int(at.timestamp()) if timestamp_format == "epoch" else (
                int(at.timestamp() * 1000) if timestamp_format == "ms" else at.isoformat())
        if selected_id is not None:
            data["selected_id"] = selected_id
        if media_url is not None:
            data["media_url"] = media_url
        if entry_id is not None:
            data["entry_id"] = entry_id
            data["session_id"] = f"session-{entry_id}"
        return {"event_type": "whatsapp_message_received", "data": data, "time_fired": (at or dt.datetime.now(dt.timezone.utc)).isoformat()}

    @staticmethod
    def button(sender_number: str | None, button_id: str, *, at: dt.datetime | None, entry_id: str | None = None,
               button_text: str = "התקבל", message_id: str | None = None, sender_name: str = "ספק") -> dict[str, Any]:
        data: dict[str, Any] = {"sender": f"{sender_number}@s.whatsapp.net" if sender_number else "", "sender_number": sender_number or "",
                                "sender_name": sender_name, "button_id": button_id, "button_text": button_text}
        if message_id is not None:
            data["message_id"] = message_id
        if at is not None:
            data["timestamp"] = int(at.timestamp())
        if entry_id is not None:
            data["entry_id"] = entry_id
        return {"type": "event", "event": {"event_type": "whatsapp_button_pressed", "data": data}}


class FakeMirror:
    """`messaging_accounts.LinkedAccountsReader` over a FakeHaWhatsapp (plus extra entity states for manual status entities)."""

    def __init__(self, fake: FakeHaWhatsapp, *, ws: bool = True, extra_states: dict[str, str] | None = None) -> None:
        self.fake = fake
        self.ws = ws
        self.extra_states = extra_states or {}

    def whatsapp_rows(self) -> list[MirrorRow]:
        return self.fake.mirror_rows()

    def entity_state(self, entity_id: str) -> str | None:
        return self.extra_states.get(entity_id)

    def ws_connected(self) -> bool:
        return self.ws
