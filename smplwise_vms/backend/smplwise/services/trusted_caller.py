"""The signed trusted-caller message, generalized (CR-WISKEY-LEASE-REVOCATION-EVENT slice L3).

One signer for every protocol that rides the bridge's trusted-caller transport (DTO v3, docs/contracts/wiskey-trusted-caller/
DTO_DRAFT_v3.md): the WisKey door (its protocol constant lives only in services/trusted_door.py; behaviour and golden vectors
unchanged) and the capture lease (`wiskey-capture-lease-v1`, services/lease_events.py). The protocol, the allowed actions,
the message lifetime and the size cap are parameters; the body shape, the canonical JSON, the HMAC recipe
(`ha_bridge.sign`), the explicit 32-hex nonce and `ts == epoch(issued_at)` are the same for all of them.

Nothing here talks to the bridge or to a database; a malformed message raises before anything could be sent."""
from __future__ import annotations

import hashlib
import json
import re
import secrets
import unicodedata
from dataclasses import dataclass
from datetime import datetime, timedelta, timezone
from typing import Any, Iterable

from . import ha_bridge

UUID_RE = re.compile(r"^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$")
HEX32_RE = re.compile(r"^[0-9a-f]{32}$")
_CTRL = re.compile(r"[\x00-\x1f\x7f-\x9f]")


class MessageInvalid(ValueError):
    """The message would be refused at the bridge's schema or time stage: it is never sent. Carries no input text."""


def iso(at: datetime) -> str:
    """UTC, whole seconds, `Z` (the DTO's only time format)."""
    return at.astimezone(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")


def text_ok(value: Any) -> bool:
    """1..128 characters, no C0 / C1 control and (SEC-WXD I8) no Unicode format character (category Cf: bidi embeddings,
    overrides, isolates, marks), so a signed text cannot re-order or hide text in WisKey's audit display."""
    return isinstance(value, str) and 1 <= len(value) <= 128 and not _CTRL.search(value) and not any(unicodedata.category(ch) == "Cf" for ch in value)


@dataclass(frozen=True)
class Signed:
    request_id: str
    text: str  # signed_message_json, exactly as sent
    body_sha256: str  # sha256 of the exact UTF-8 bytes of `text` (audit only)
    issued_at: str = ""
    expires_at: str = ""


def sign(secret: str, *, protocol: str, actions: Iterable[str], action: str, actor_id: str, display_name: str, station: str,
         params: dict[str, Any], request_id: str, lifetime_s: int, max_lifetime_s: int, max_bytes: int,
         now: datetime | None = None, nonce: str | None = None, kid_on_wire: bool = True) -> Signed:
    """Build and sign one wire message. `now` and `nonce` are injectable for golden vectors and fake clocks only; production
    passes neither (the host clock, a fresh `secrets.token_hex(16)`). Raises MessageInvalid / ValueError locally for
    anything the bridge would refuse at its schema or time stage.

    `kid_on_wire=False` (the capture lease, whose v1 wire is closed): a key of the key set still signs v2 (its key id is bound into the
    MAC), but the `kid` field is dropped from the wire - the verifier names the key by trying the key ids its key set accepts."""
    if action not in tuple(actions):
        raise ValueError("action")
    if not (text_ok(actor_id) and text_ok(display_name) and text_ok(station) and isinstance(request_id, str) and UUID_RE.fullmatch(request_id)):
        raise MessageInvalid("field")
    if not (isinstance(lifetime_s, int) and 0 < lifetime_s <= max_lifetime_s):
        raise MessageInvalid("lifetime")
    nonce = secrets.token_hex(16) if nonce is None else nonce
    if not HEX32_RE.fullmatch(nonce):
        raise MessageInvalid("nonce")
    issued = (now or datetime.now(timezone.utc)).replace(microsecond=0)
    body = {
        "protocol": protocol,
        "actor": {"id": actor_id, "display_name": display_name},
        "action": action,
        "station": station,
        "params": params,
        "request_id": request_id,
        "issued_at": iso(issued),
        "expires_at": iso(issued + timedelta(seconds=lifetime_s)),
    }
    wire = ha_bridge.sign(secret, body, ts=int(issued.timestamp()), nonce=nonce)
    if not kid_on_wire:
        wire.pop("kid", None)
    text = json.dumps(wire, ensure_ascii=False, separators=(",", ":"))
    data = text.encode("utf-8")
    if len(data) > max_bytes:
        raise MessageInvalid("size")
    return Signed(request_id, text, hashlib.sha256(data).hexdigest(), body["issued_at"], body["expires_at"])


def response_of(answer: Any) -> dict[str, Any] | None:
    """HA's return_response envelope -> the bridge's own answer object (None when it is not one)."""
    if isinstance(answer, dict) and isinstance(answer.get("service_response"), dict):
        answer = answer["service_response"]
    return answer if isinstance(answer, dict) else None
