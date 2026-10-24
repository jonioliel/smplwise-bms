"""WKCAP-295 items 13-14 (Q05): the transport hook of the WhatsApp template send on the direct transport - and nothing else.

`DirectTemplateTransport.send_template(request)` is the structural `wa_template_send.TemplateTransport` (a Protocol with one method). It sends the CLOSED template object that
`TemplateRequest.wire()` builds as the parameters of the ordinary pairing-signed command `whatsapp/template_send_v1` and returns the host's `result` object UNCHANGED, for the
reader `wa_template_send.read_answer` (the version-specific closed readers live on `pilot/WKB3-295`; this branch does not copy or merge them).

What this hook does NOT do - on purpose
- no queue, pacing, accounting or provider: WisKey's PacingQueue / NativeWhatsAppAccounting / CloudTemplateProvider stay the only sender (see the change note for where they live);
- no consent: `recipient_ref` is whatever the request carries; Arx adds no consent flag (the route policy of WisKey is the owner directive, WKADAPT-295 TP-02);
- no interpretation: `accepted` is the provider's ACK (a closed result of the sent version), `delivery` stays unknown; ANY error frame, timeout, closed socket or MAC failure
  RAISES (`PortError`) and the sender treats a raise as UNKNOWN - never `not_sent`, never a retry, never a refund. Only a closed `not_sent` RESULT of the same version says not sent;
- no PIN value is read here: the PIN path is `template_send_v2` (WisKey autofill), `send_v2` below passes the closed v2 object through and nothing else."""
from __future__ import annotations

from typing import Any, Mapping

from .wiskey_capture_port import WiskeyDirectPort

V1_COMMAND = "whatsapp/template_send_v1"
V2_COMMAND = "whatsapp/template_send_v2"
V2_FIELDS = frozenset({"schema_version", "request_id", "operation_id", "recipient_ref", "expected_person_revision", "account", "template_name", "language",
                       "template_ref", "expected_template_revision"})
TIMEOUT_S = 20.0  # WisKey's own pacing wait is inside the command; the sender's `deadline` (request.deadline) bounds the caller above this


class DirectTemplateTransport:
    def __init__(self, port: WiskeyDirectPort, *, timeout_s: float = TIMEOUT_S) -> None:
        self.port = port
        self.timeout_s = timeout_s

    def send_template(self, request: Any) -> Any:
        return self.port.call(V1_COMMAND, request.wire(), timeout_s=self.timeout_s)

    def send_v2(self, parameters: Mapping[str, Any]) -> Any:
        """The closed v2 object exactly (no raw name / PIN / card: WisKey fills them from its own native source)."""
        if not isinstance(parameters, Mapping) or set(parameters) != V2_FIELDS or parameters.get("schema_version") != 2:
            raise ValueError("template_send_v2 fields")
        return self.port.call(V2_COMMAND, dict(parameters), timeout_s=self.timeout_s)
