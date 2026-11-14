"""Keep administrator write payloads out of HA's raw WebSocket debug logging."""

import logging
import re
from typing import Any

_CREDENTIAL_KEY = re.compile(r'"(?:access_token|refresh_token|client_secret)"\s*:')
_CREDENTIAL_KEY_BYTES = re.compile(rb'"(?:access_token|refresh_token|client_secret)"\s*:')
_CREDENTIAL_FIELDS = frozenset({"access_token", "refresh_token", "client_secret"})


class AccessWebSocketFilter(logging.Filter):
    @staticmethod
    def _redact(value: Any) -> Any:
        # HA logs its native auth frame before integration command dispatch.
        # Filter that original frame too; never change the actual wire payload.
        if (
            isinstance(value, str)
            and _CREDENTIAL_KEY.search(value)
            or isinstance(value, bytes)
            and _CREDENTIAL_KEY_BYTES.search(value)
            or isinstance(value, dict)
            and _CREDENTIAL_FIELDS.intersection(value)
        ):
            return "WebSocket credentials REDACTED"
        # HA 2026.9 logs outgoing websocket messages as already serialized bytes.
        if (isinstance(value, bytes) and b"hikvision_intercom.audio" in value) or (
            isinstance(value, str) and "hikvision_intercom.audio" in value
        ):
            return "Hikvision audio payload REDACTED"
        if (isinstance(value, bytes) and b"wiskey-bridge-command.v1" in value) or (
            isinstance(value, str) and "wiskey-bridge-command.v1" in value
        ):
            return "Hikvision bridge payload REDACTED"
        if isinstance(value, dict) and value.get("bridge_schema") == "wiskey-bridge-command.v1":
            return {"id": value.get("id"), "type": value.get("type"), "payload": "REDACTED"}
        if (
            isinstance(value, dict)
            and isinstance(value.get("type"), str)
            and value["type"].startswith("hikvision_intercom/")
        ):
            return {"id": value.get("id"), "type": value["type"], "payload": "REDACTED"}
        if isinstance(value, dict) and any(
            isinstance(value.get(key), dict)
            and value[key].get("format") == "hikvision_intercom.audio"
            for key in ("event", "result")
        ):
            return {"id": value.get("id"), "type": value.get("type"), "payload": "REDACTED"}
        if isinstance(value, list):
            return [AccessWebSocketFilter._redact(item) for item in value]
        if isinstance(value, dict):
            return {key: AccessWebSocketFilter._redact(item) for key, item in value.items()}
        return value

    def filter(self, record: logging.LogRecord) -> bool:
        message = self._redact(record.msg)
        if message is not record.msg:
            record.msg, record.args = message, ()
            return True
        if isinstance(record.args, tuple):
            record.args = tuple(self._redact(arg) for arg in record.args)
        elif isinstance(record.args, dict):
            record.args = self._redact(record.args)
        return True


class TtsPrivateDetailsFilter(logging.Filter):
    """Native HA TTS logs message prefixes and provider errors with input text.

    Keep level/logger/time, excluding both text and provider exception bodies.
    This deliberately covers this logger for every HA caller while installed.
    """

    def filter(self, record: logging.LogRecord) -> bool:
        record.msg = "HA TTS details REDACTED"
        record.args = ()
        record.exc_info = record.exc_text = record.stack_info = None
        return True


def install_tts_filter() -> None:
    logger = logging.getLogger("homeassistant.components.tts")
    if not any(isinstance(item, TtsPrivateDetailsFilter) for item in logger.filters):
        logger.addFilter(TtsPrivateDetailsFilter())


def install_filter() -> None:
    # Exact logger used by HA 2026.9.1's WebSocketAdapter for inbound command dictionaries.
    logger = logging.getLogger("homeassistant.components.websocket_api.http.connection")
    if not any(isinstance(item, AccessWebSocketFilter) for item in logger.filters):
        logger.addFilter(AccessWebSocketFilter())
    install_tts_filter()
