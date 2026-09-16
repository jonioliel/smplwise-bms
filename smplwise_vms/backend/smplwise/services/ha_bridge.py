"""The thin HA bridge protocol (ADR-012): a pairing secret shared once between the add-on and the
`smplwise_bridge` custom integration, then per-message HMAC (timestamp + nonce + body hash).

- Actions: the add-on signs `{user_id, domain, service, data, request_id}` and calls the integration's
  `execute` service; the integration verifies the signature and re-issues the HA service call with
  `Context(user_id=…)`, so HA's own per-user entity permissions apply. The add-on token alone never acts
  as a user (chapter 8).
- Directory: the integration pushes the HA user list to the add-on (`POST /api/v1/ha/bridge/directory`),
  signed the same way, for the user/role screens.

Allow-listed actions are the only writes the product knows; arguments are validated here. An action with a
`grant` (lock.unlock -> door.unlock) needs that separate permission on top of ha.entity.control (T079)."""
from __future__ import annotations

import hashlib
import hmac
import json
import secrets
import sqlite3
import time
from typing import Any

from ..db import get_setting, set_setting
from ..errors import ApiError

SIGNATURE_WINDOW_S = 60
_recent_nonces: dict[str, float] = {}


def signing_key(conn: sqlite3.Connection) -> str | None:
    return get_setting(conn, "bridge.secret")


def ensure_pairing(conn: sqlite3.Connection, regenerate: bool = False) -> str:
    """Create (once) the pairing secret the admin types into the integration's config flow."""
    secret = get_setting(conn, "bridge.secret")
    if not secret or regenerate:
        secret = secrets.token_urlsafe(24)
        set_setting(conn, "bridge.secret", secret)
        set_setting(conn, "bridge.paired_at", "")
    return secret


def sign(secret: str, body: dict[str, Any], ts: int | None = None, nonce: str | None = None) -> dict[str, Any]:
    """Canonical JSON of `body` + ts + nonce, HMAC-SHA256 with the pairing secret."""
    ts = ts or int(time.time())
    nonce = nonce or secrets.token_hex(8)
    canonical = json.dumps(body, sort_keys=True, separators=(",", ":"), ensure_ascii=False)
    digest = hmac.new(secret.encode(), f"{ts}.{nonce}.{hashlib.sha256(canonical.encode()).hexdigest()}".encode(), hashlib.sha256).hexdigest()
    return {**body, "ts": ts, "nonce": nonce, "sig": digest}


def verify(secret: str | None, message: dict[str, Any], now: float | None = None) -> None:
    """Raises ApiError(401) unless the signature is valid, recent and unseen."""
    if not secret:
        raise ApiError(401, "bridge_not_paired", "הגשר לא צומד עדיין.")
    try:
        ts, nonce, sig = int(message.get("ts", 0)), str(message.get("nonce", "")), str(message.get("sig", ""))
    except (TypeError, ValueError):
        raise ApiError(401, "bridge_bad_signature", "חתימה לא תקינה.")
    now = now or time.time()
    if abs(now - ts) > SIGNATURE_WINDOW_S or not nonce:
        raise ApiError(401, "bridge_stale", "ההודעה מהגשר ישנה מדי.")
    body = {k: v for k, v in message.items() if k not in ("ts", "nonce", "sig")}
    expected = sign(secret, body, ts, nonce)["sig"]
    if not hmac.compare_digest(expected, sig):
        raise ApiError(401, "bridge_bad_signature", "חתימת הגשר לא תואמת.")
    # replay protection within the window
    for n, t in list(_recent_nonces.items()):
        if now - t > SIGNATURE_WINDOW_S * 2:
            _recent_nonces.pop(n, None)
    if nonce in _recent_nonces:
        raise ApiError(401, "bridge_replay", "הודעה חוזרת.")
    _recent_nonces[nonce] = now


# ---------------------------------------------------------------- allow-listed actions

ACTIONS: dict[str, dict[str, Any]] = {
    # id: domain, service, argument schema {name: (type, min, max)}, expected state after success, sensitive
    "light.turn_on": {"domain": "light", "service": "turn_on", "args": {"brightness_pct": ("int", 1, 100)}, "expect": "on", "sensitive": False, "label": "הדלקה"},
    "light.turn_off": {"domain": "light", "service": "turn_off", "args": {}, "expect": "off", "sensitive": False, "label": "כיבוי"},
    "switch.turn_on": {"domain": "switch", "service": "turn_on", "args": {}, "expect": "on", "sensitive": False, "label": "הדלקה"},
    "switch.turn_off": {"domain": "switch", "service": "turn_off", "args": {}, "expect": "off", "sensitive": False, "label": "כיבוי"},
    "fan.turn_on": {"domain": "fan", "service": "turn_on", "args": {"percentage": ("int", 1, 100)}, "expect": "on", "sensitive": False, "label": "הפעלה"},
    "fan.turn_off": {"domain": "fan", "service": "turn_off", "args": {}, "expect": "off", "sensitive": False, "label": "כיבוי"},
    "cover.open_cover": {"domain": "cover", "service": "open_cover", "args": {}, "expect": "open", "sensitive": True, "label": "פתיחה"},
    "cover.close_cover": {"domain": "cover", "service": "close_cover", "args": {}, "expect": "closed", "sensitive": True, "label": "סגירה"},
    "cover.stop_cover": {"domain": "cover", "service": "stop_cover", "args": {}, "expect": None, "sensitive": False, "label": "עצירה"},
    "lock.lock": {"domain": "lock", "service": "lock", "args": {}, "expect": "locked", "sensitive": False, "label": "נעילה"},
    "lock.unlock": {"domain": "lock", "service": "unlock", "args": {}, "expect": "unlocked", "sensitive": True, "label": "פתיחה", "grant": "door.unlock"},
    "button.press": {"domain": "button", "service": "press", "args": {}, "expect": None, "sensitive": True, "label": "לחיצה"},
    "script.turn_on": {"domain": "script", "service": "turn_on", "args": {}, "expect": None, "sensitive": True, "label": "הפעלת סקריפט"},
    "scene.turn_on": {"domain": "scene", "service": "turn_on", "args": {}, "expect": None, "sensitive": True, "label": "הפעלת סצנה"},
}


def actions_for(domain: str) -> list[dict[str, Any]]:
    return [{"id": aid, "label": a["label"], "sensitive": a["sensitive"], "arguments": list(a["args"]), "grant": a.get("grant")} for aid, a in ACTIONS.items() if a["domain"] == domain]


def validate_action(action_id: str, entity_id: str, arguments: dict[str, Any]) -> tuple[dict[str, Any], dict[str, Any]]:
    """Returns (action definition, cleaned service data) or raises 422."""
    spec = ACTIONS.get(action_id)
    if not spec:
        raise ApiError(422, "action_not_allowed", "פעולה זו אינה ברשימת הפעולות המאושרות.", details={"action": action_id})
    if entity_id.split(".", 1)[0] != spec["domain"]:
        raise ApiError(422, "action_domain_mismatch", "הפעולה אינה מתאימה לסוג הישות.", details={"action": action_id, "entity": entity_id})
    data: dict[str, Any] = {"entity_id": entity_id}
    for name, value in (arguments or {}).items():
        if name not in spec["args"]:
            raise ApiError(422, "argument_not_allowed", f"ארגומנט לא מאושר: {name}", details={"argument": name})
        typ, lo, hi = spec["args"][name]
        if typ == "int":
            try:
                iv = int(value)
            except (TypeError, ValueError):
                raise ApiError(422, "validation", f"{name} חייב להיות מספר.")
            if not lo <= iv <= hi:
                raise ApiError(422, "validation", f"{name} מחוץ לטווח {lo}–{hi}.")
            data[name] = iv
    return spec, data
