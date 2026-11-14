"""The WisKey door transport (CR-033 slice D4, DR-2): how an opening that the door authority allowed leaves Arx.

Two modes, chosen by the system setting `doors.trusted_path` (default `off`):

- `off` - the INTERIM mode (CR-033 5.5), until the bridge's signed `door_open` exists and WisKey's consumer side is
  confirmed: every Arx entry point (devices tile, map / home cards, WisKey screen, notification deep link) uses today's
  station-release path, the WS `stations/test_unlock` with the add-on's token (services/intercom_client.release_door),
  after the one door authority. WisKey sees the infrastructure user, Arx's audit holds the person. A WisKey door is
  NEVER sent through the bridge's `execute` / `lock.unlock` in either mode, so bridge 0.8.1 (which refuses `execute` for
  WisKey locks) cannot break the tiles; the add-on release that carries this ships first.
- `on` - signed `smplwise_bridge.door_open` only (DTO `wiskey-trusted-door-v1`, docs/contracts/wiskey-trusted-caller/
  DTO_DRAFT_v3.md), with the real Arx principal as actor; no other transport, no fallback. The flag cannot be switched on
  until a bridge that offers `door_open` is known (MIN_BRIDGE_FOR_TRUSTED_PATH is None in this release): turning it on is
  a separate, owner-approved step after the gate.

Audit (owner decision 21): the door's rows carry `transport`, `mode`, `entry_point`, `door_request_id` and - in the signed
mode only - `body_sha256`, the lower-case SHA-256 of the exact `signed_message_json` bytes sent, computed after signing.
Never the signature, the key, the nonce or the body itself. The signed format is not changed.

Answers map to a closed outcome set: `acknowledged` -> `sent` (never "opened": decision 22), `rejected` -> `refused`
(nothing happened), a timeout or transport error after a possible delivery -> `unknown` (the relay stays held),
`stored_result` -> its stored outcome. Never retried, never queued; an unknown outcome is resolved only by the read-only
`door_open_status`, never by signing the open again (DR-11)."""
from __future__ import annotations

import re
import sqlite3
import threading
import time
import uuid
from datetime import datetime
from typing import Any

from ..config import Settings
from ..db import get_setting
from ..errors import ApiError
from . import ha_client, trusted_caller

FLAG_KEY = "doors.trusted_path"
FLAG_VALUES = ("off", "on")
PROTOCOL = "wiskey-trusted-door-v1"
MAX_MESSAGE_BYTES = 8192
LIFETIME_S = 30  # DTO: 0 < expires_at - issued_at <= 30 s
TRANSPORT = "trusted_door"
# The first bridge version that offers door_open / door_open_status (slice D5b, bridge 0.9.x). None: no bridge does yet,
# so the flag cannot be switched on in this release (fail closed).
MIN_BRIDGE_FOR_TRUSTED_PATH: str | None = None
ENTRY_POINTS = ("devices_tile", "map_card", "wiskey_screen", "notification", "run", "door_job")
_UUID = trusted_caller.UUID_RE


def mode(conn: sqlite3.Connection) -> str:
    """`on` only when the setting says exactly `on`; anything else (absent, garbage, a restored looser value) is `off`."""
    return "on" if (get_setting(conn, FLAG_KEY) or "off") == "on" else "off"


def _version_tuple(v: str) -> tuple[int, ...]:
    out = []
    for part in v.split("."):
        digits = re.match(r"\d+", part)
        out.append(int(digits.group(0)) if digits else 0)
    return tuple(out)


def trusted_path_available(conn: sqlite3.Connection) -> bool:
    """Whether the signed path can exist at all: a known bridge version that offers door_open."""
    if MIN_BRIDGE_FOR_TRUSTED_PATH is None:
        return False
    seen = get_setting(conn, "bridge.integration_version") or ""
    return bool(seen) and _version_tuple(seen) >= _version_tuple(MIN_BRIDGE_FOR_TRUSTED_PATH)


def new_request_id() -> str:
    return str(uuid.uuid4())


# ---------------------------------------------------------------- the signed message (mode `on`)

def _iso(at: datetime) -> str:
    return trusted_caller.iso(at)


def _text_ok(value: str) -> bool:
    """1..128 characters, no C0 / C1 control and (SEC-WXD I8) no Unicode format character - the bidi embeddings, overrides
    and isolates (U+202A-E, U+2066-9), the marks U+200E / U+200F and every other category Cf character - so an actor name
    signed into a door command cannot re-order or hide text in WisKey's audit display. (The one rule lives in
    services/trusted_caller.py since the capture-lease slice L3; this name stays for the door path and its tests.)"""
    return trusted_caller.text_ok(value)


def actor_name(principal: Any) -> str:
    """The `actor.display_name` signed into a door command: the first of the principal's display name, user name and id
    that `_text_ok` accepts (a name with a format character is never signed - review I8 - and never silently altered:
    the next field is used instead). The id itself always passes the identity checks upstream."""
    for candidate in (getattr(principal, "display_name", None), getattr(principal, "username", None), getattr(principal, "user_id", None)):
        if isinstance(candidate, str) and _text_ok(candidate):
            return candidate
    return str(getattr(principal, "user_id", ""))


# SEC-WXD I7: the status read signs and calls the bridge, so it is rate limited per person (a status is a read; a person
# checking one unknown open needs a handful, never a stream)
STATUS_PER_MIN = 6
_STATUS_HITS: dict[str, list[float]] = {}
_STATUS_LOCK = threading.Lock()


def status_rate(user_id: str) -> None:
    """Raise 429 `rate_limited` when `user_id` asked for more than STATUS_PER_MIN status reads in the last minute."""
    now = time.monotonic()
    with _STATUS_LOCK:
        hits = [t for t in _STATUS_HITS.get(user_id, []) if now - t < 60.0]
        if len(hits) >= STATUS_PER_MIN:
            _STATUS_HITS[user_id] = hits
            raise ApiError(429, "rate_limited", "יותר מדי בדיקות מצב ברצף; נסו שוב בעוד רגע.", retryable=True)
        hits.append(now)
        _STATUS_HITS[user_id] = hits


def reset_status_rate() -> None:
    with _STATUS_LOCK:
        _STATUS_HITS.clear()


Signed = trusted_caller.Signed


def sign_message(secret: str, action: str, actor_id: str, display_name: str, station: str, params: dict[str, Any], request_id: str, now: datetime | None = None) -> Signed:
    """Build and sign one DTO wire message (section 2/3 of the DTO): explicit 32-hex nonce, `ts = epoch(issued_at)`,
    lifetime LIFETIME_S, values sent exactly as stored (no trim, no case change). Refuses locally what the bridge would
    refuse at the schema stage, so a malformed message is never sent. The signer itself is services/trusted_caller.py
    (capture-lease slice L3: the same bytes, the protocol and lifetime as parameters)."""
    if action not in ("door_open", "door_open_status"):
        raise ValueError("action")
    try:
        return trusted_caller.sign(secret, protocol=PROTOCOL, actions=("door_open", "door_open_status"), action=action, actor_id=actor_id,
                                   display_name=display_name, station=station, params=params, request_id=request_id, lifetime_s=LIFETIME_S,
                                   max_lifetime_s=LIFETIME_S, max_bytes=MAX_MESSAGE_BYTES, now=now)
    except trusted_caller.MessageInvalid:
        raise ApiError(422, "door_message_invalid", "לא ניתן לבנות את פקודת הפתיחה.", details={"outcome": "not_sent"}) from None


def call_bridge(settings: Settings, service: str, text: str) -> Any:
    """One `smplwise_bridge.<service>` call with `return_response`; the service data is exactly {signed_message_json}."""
    return ha_client.call_service(settings, "smplwise_bridge", service, {"signed_message_json": text}, return_response=True)


def _response_of(answer: Any) -> dict[str, Any] | None:
    """HA's return_response envelope -> the bridge's own answer object (None when it is not one)."""
    return trusted_caller.response_of(answer)


# The closed outcome set (CR-033 5.1 step 4, F1..F13). `code` is for audit and engineers; screens map it to Hebrew.
def classify(answer: Any, request_id: str) -> tuple[str, str | None]:
    """(outcome, code) for one door_open / door_open_status answer: `sent`, `refused` or `unknown`. An answer that is not
    one of the DTO's closed shapes, or names another request, is `unknown` - the command may have been delivered."""
    r = _response_of(answer)
    if r is None:
        return "unknown", "invalid_response"
    result = r.get("result")
    rid = r.get("request_id")
    if result == "rejected":
        stage, code = r.get("stage"), r.get("code")
        if rid not in (None, request_id):
            return "unknown", "invalid_response"
        return "refused", f"{stage}/{code}" if isinstance(stage, str) and isinstance(code, str) else "rejected"
    if rid != request_id:
        return "unknown", "invalid_response"
    if result == "acknowledged":
        return "sent", None
    if result == "unknown":
        reason = r.get("reason")
        return "unknown", f"unknown/{reason}" if isinstance(reason, str) else "unknown"
    if result == "stored_result":
        outcome = r.get("outcome") if isinstance(r.get("outcome"), dict) else {}
        if outcome.get("result") == "acknowledged":
            return "sent", "stored_result"
        reason = outcome.get("reason")
        return "unknown", f"stored_result/{reason}" if isinstance(reason, str) else "stored_result"
    return "unknown", "invalid_response"


# Operator texts (CR-033 section 8). Never the code, never input.
REFUSAL_TEXT = {
    "time/clock_invalid": "שעון המערכת לא אמין. פתיחה מרחוק מושבתת",
    "time/expired": "הבקשה פגה לפני שנשלחה.",
    "time/not_yet_valid": "שעון המערכת לא אמין. פתיחה מרחוק מושבתת",
}
OUTCOME_TEXT = {
    "sent": "נשלח",
    "unknown": "לא ידוע אם נשלח",
    "refused": "הפקודה נדחתה ולא בוצעה.",
}


def refusal_text(code: str | None) -> str:
    return REFUSAL_TEXT.get(code or "", OUTCOME_TEXT["refused"])
