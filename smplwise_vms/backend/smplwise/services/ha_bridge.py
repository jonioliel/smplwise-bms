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

# Risk classes (T040): "routine" runs at once; "attention" needs an explicit confirmation (side effects the VMS
# cannot see: scripts, scenes, buttons, sirens, arming, covers); "sensitive" needs its own grant on top of entity
# control (never implied by a role) and a confirmation. `sensitive` (bool) stays for the older clients: it is
# True for attention and sensitive alike.
RISK_LABEL = {"routine": "שגרתית", "attention": "דורשת אישור", "sensitive": "רגישה — הרשאה נפרדת"}
HVAC_MODES = ["off", "heat", "cool", "heat_cool", "auto", "dry", "fan_only"]


def _a(domain: str, service: str, label: str, *, args: dict[str, Any] | None = None, expect: str | None = None, risk: str = "routine", grant: str | None = None, expect_from: str | None = None) -> dict[str, Any]:
    d: dict[str, Any] = {"domain": domain, "service": service, "args": args or {}, "expect": expect, "sensitive": risk != "routine", "risk": risk, "label": label}
    if grant:
        d["grant"] = grant
    if expect_from:
        d["expect_from"] = expect_from
    return d


ACTIONS: dict[str, dict[str, Any]] = {
    # id: domain, service, argument schema {name: (type, lo, hi) | ("enum", choices) | ("str", min_len, max_len)},
    # expected state after success (or the argument it comes from), risk class, extra grant
    "light.turn_on": _a("light", "turn_on", "הדלקה", args={"brightness_pct": ("int", 1, 100)}, expect="on"),
    "light.turn_off": _a("light", "turn_off", "כיבוי", expect="off"),
    "switch.turn_on": _a("switch", "turn_on", "הדלקה", expect="on"),
    "switch.turn_off": _a("switch", "turn_off", "כיבוי", expect="off"),
    "fan.turn_on": _a("fan", "turn_on", "הפעלה", args={"percentage": ("int", 1, 100)}, expect="on"),
    "fan.turn_off": _a("fan", "turn_off", "כיבוי", expect="off"),
    "cover.open_cover": _a("cover", "open_cover", "פתיחה", expect="open", risk="attention"),
    "cover.close_cover": _a("cover", "close_cover", "סגירה", expect="closed", risk="attention"),
    "cover.stop_cover": _a("cover", "stop_cover", "עצירה"),
    "lock.lock": _a("lock", "lock", "נעילה", expect="locked"),
    "lock.unlock": _a("lock", "unlock", "פתיחה", expect="unlocked", risk="sensitive", grant="door.unlock"),
    "button.press": _a("button", "press", "לחיצה", risk="attention"),
    "script.turn_on": _a("script", "turn_on", "הפעלת סקריפט", risk="attention"),
    "scene.turn_on": _a("scene", "turn_on", "הפעלת סצנה", risk="attention"),
    # T040: more adapters
    "climate.set_hvac_mode": _a("climate", "set_hvac_mode", "מצב פעולה", args={"hvac_mode": ("enum", HVAC_MODES)}, expect_from="hvac_mode"),
    "climate.set_temperature": _a("climate", "set_temperature", "טמפרטורת יעד", args={"temperature": ("float", 5, 35)}),
    "media_player.media_play": _a("media_player", "media_play", "נגן", expect="playing"),
    "media_player.media_pause": _a("media_player", "media_pause", "השהה", expect="paused"),
    "media_player.media_stop": _a("media_player", "media_stop", "עצור"),
    "media_player.volume_set": _a("media_player", "volume_set", "עוצמת שמע", args={"volume_level": ("float", 0, 1)}),
    "number.set_value": _a("number", "set_value", "קביעת ערך", args={"value": ("float", -1e9, 1e9)}, expect_from="value"),
    "input_number.set_value": _a("input_number", "set_value", "קביעת ערך", args={"value": ("float", -1e9, 1e9)}, expect_from="value"),
    "select.select_option": _a("select", "select_option", "בחירה", args={"option": ("str", 1, 80)}, expect_from="option"),
    "input_select.select_option": _a("input_select", "select_option", "בחירה", args={"option": ("str", 1, 80)}, expect_from="option"),
    "input_boolean.turn_on": _a("input_boolean", "turn_on", "הפעלה", expect="on"),
    "input_boolean.turn_off": _a("input_boolean", "turn_off", "כיבוי", expect="off"),
    "vacuum.start": _a("vacuum", "start", "התחל ניקוי", expect="cleaning"),
    "vacuum.return_to_base": _a("vacuum", "return_to_base", "חזרה לעמדה", expect="returning"),
    "siren.turn_on": _a("siren", "turn_on", "הפעלת צופר", expect="on", risk="attention"),
    "siren.turn_off": _a("siren", "turn_off", "כיבוי צופר", expect="off"),
    "alarm_control_panel.alarm_arm_home": _a("alarm_control_panel", "alarm_arm_home", "דריכה בבית", expect="armed_home", risk="attention"),
    "alarm_control_panel.alarm_arm_away": _a("alarm_control_panel", "alarm_arm_away", "דריכה מלאה", expect="armed_away", risk="attention"),
    "alarm_control_panel.alarm_disarm": _a("alarm_control_panel", "alarm_disarm", "נטרול", expect="disarmed", risk="sensitive", grant="alarm.disarm"),
}


def _arg_spec(name: str, schema: tuple[Any, ...]) -> dict[str, Any]:
    typ = schema[0]
    if typ == "enum":
        return {"name": name, "type": "enum", "choices": list(schema[1])}
    if typ == "str":
        return {"name": name, "type": "str", "min_len": schema[1], "max_len": schema[2]}
    return {"name": name, "type": typ, "min": schema[1], "max": schema[2]}


def actions_for(domain: str) -> list[dict[str, Any]]:
    return [
        {"id": aid, "label": a["label"], "sensitive": a["sensitive"], "risk": a["risk"], "risk_label": RISK_LABEL[a["risk"]], "arguments": list(a["args"]),
         "argument_specs": [_arg_spec(n, sc) for n, sc in a["args"].items()], "grant": a.get("grant")}
        for aid, a in ACTIONS.items() if a["domain"] == domain
    ]


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
        schema = spec["args"][name]
        typ = schema[0]
        if typ in ("int", "float"):
            lo, hi = schema[1], schema[2]
            try:
                num = int(value) if typ == "int" else float(value)
            except (TypeError, ValueError):
                raise ApiError(422, "validation", f"{name} חייב להיות מספר.")
            if isinstance(value, bool) or num != num:  # bools and NaN never pass as numbers
                raise ApiError(422, "validation", f"{name} חייב להיות מספר.")
            if not lo <= num <= hi:
                raise ApiError(422, "validation", f"{name} מחוץ לטווח {lo}–{hi}.")
            data[name] = num
        elif typ == "enum":
            if not isinstance(value, str) or value not in schema[1]:
                raise ApiError(422, "validation", f"{name}: ערך לא מוכר.", details={"choices": list(schema[1])})
            data[name] = value
        elif typ == "str":
            if not isinstance(value, str) or not schema[1] <= len(value.strip()) <= schema[2]:
                raise ApiError(422, "validation", f"{name}: טקסט באורך {schema[1]}–{schema[2]} תווים.")
            data[name] = value.strip()
    missing = [n for n in spec["args"] if n not in data and spec.get("expect_from") == n]
    if missing:
        raise ApiError(422, "validation", f"חסר ארגומנט: {missing[0]}", details={"argument": missing[0]})
    if spec.get("expect_from") and spec["expect_from"] in data:
        # the state Home Assistant reports after success is the value we asked for (a mode, an option, a number)
        v = data[spec["expect_from"]]
        spec = {**spec, "expect": (str(int(v)) if isinstance(v, float) and v.is_integer() else str(v))}
    return spec, data
