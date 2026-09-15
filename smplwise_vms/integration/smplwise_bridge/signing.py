"""Signature helpers shared with the add-on (smplwise_vms/backend/smplwise/services/ha_bridge.py): canonical JSON of the
message body, HMAC-SHA256 over "ts.nonce.sha256(body)" with the pairing secret. Kept dependency-free so the same
functions run inside Home Assistant Core and in plain unit tests."""
from __future__ import annotations

import hashlib
import hmac
import json
import secrets
import time
from typing import Any

SIGNATURE_WINDOW_S = 60


def sign(secret: str, body: dict[str, Any], ts: int | None = None, nonce: str | None = None) -> dict[str, Any]:
    ts = ts or int(time.time())
    nonce = nonce or secrets.token_hex(8)
    canonical = json.dumps(body, sort_keys=True, separators=(",", ":"), ensure_ascii=False)
    digest = hmac.new(secret.encode(), f"{ts}.{nonce}.{hashlib.sha256(canonical.encode()).hexdigest()}".encode(), hashlib.sha256).hexdigest()
    return {**body, "ts": ts, "nonce": nonce, "sig": digest}


class Verifier:
    """Verifies signed messages and rejects stale timestamps and replayed nonces."""

    def __init__(self, secret: str, window_s: int = SIGNATURE_WINDOW_S) -> None:
        self.secret = secret
        self.window_s = window_s
        self._seen: dict[str, float] = {}

    def verify(self, message: dict[str, Any], now: float | None = None) -> str | None:
        """Returns None when valid, else a short reason."""
        now = now or time.time()
        try:
            ts, nonce, sig = int(message.get("ts", 0)), str(message.get("nonce", "")), str(message.get("sig", ""))
        except (TypeError, ValueError):
            return "bad_signature"
        if not nonce or abs(now - ts) > self.window_s:
            return "stale"
        body = {k: v for k, v in message.items() if k not in ("ts", "nonce", "sig")}
        expected = sign(self.secret, body, ts, nonce)["sig"]
        if not hmac.compare_digest(expected, sig):
            return "bad_signature"
        for n, t in list(self._seen.items()):
            if now - t > self.window_s * 2:
                self._seen.pop(n, None)
        if nonce in self._seen:
            return "replay"
        self._seen[nonce] = now
        return None
