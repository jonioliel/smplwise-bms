"""WISKEY-INSTALLER-NATIVE-2400 phase 2 (plan 2026-11-03 row 47; CR-036 row 34): a station's technical settings from Arx.

WisKey rc.10 (`technical_api.dispatch_technical`, `client/technical.py`; registrations in `websocket.py` COMMANDS):

| op         | WisKey command              | keys                                                  | what WisKey does |
|------------|-----------------------------|-------------------------------------------------------|------------------|
| `read`     | `stations/technical_get`    | `station_id`                                          | confirms the device identity, reads the AccessControl / VideoIntercom capability flags (booleans only), the privilege-password PRESENCE (booleans only), and both doors' `DoorParam` (`doorName`, `openDuration`, `relayReverseEnabled`) with the bounds the device advertises; plus the station's confirmed relay selection |
| `update`   | `stations/technical_update` | `station_id`, `door`, `expected`, `changes`, `confirmed` | only for a door of the station's confirmed relay mapping; re-reads the door, refuses when `expected` differs ("reload before saving") or a change is outside the advertised bounds, PUTs ONLY the changed nodes, reads back and refuses when the readback differs |

Neither is a WisKey READ command, so `api_contract` goes on both frames; `stations: view` / `stations: manage` in WisKey (Arx's
service identity is an administrator there). Both hold a device for up to 75 s / 40 s, at most three stations at once, and refuse while
a station lifecycle job holds the lock (`device_busy`).

WisKey answers every device-side failure of the update - the pre-write "changed, reload" check AND the post-write readback mismatch - as
the same `device_unavailable` (websocket.py's HikvisionError branch), so Arx cannot tell "not written" from "written but not
confirmed": that code is read as an UNKNOWN outcome (reload and check), never as "nothing changed". Recorded as a WisKey gap.

Danger: `relayReverseEnabled` inverts the lock relay (a door that should be locked can stay open) - a change that touches it needs the
typed station name; a name or an open-time change needs the confirmation only. The values themselves are configuration, not secrets;
the audit row keeps the changed field names and values (a door name and two numbers)."""
from __future__ import annotations

import re
from typing import Any

from . import intercom_adapter as ad
from .wiskey_installer import DEVICE_TIMEOUT_S, WRITE_TIMEOUT_S, Op

FIELDS = ("doorName", "openDuration", "relayReverseEnabled")
DANGEROUS_FIELDS = frozenset({"relayReverseEnabled"})
FEATURE = re.compile(r"isSupport[A-Za-z0-9]{1,60}")
FAMILIES = frozenset({"AccessControl", "VideoIntercom"})
PASSWORD_KEYS = ("engineeringConfigured", "setupAlarmConfigured", "householderUnlockConfigured", "antiHijackingConfigured",
                 *(f"public{i}Configured" for i in range(1, 17)), "sendCardConfigured")
PIN_STATES = frozenset({"configured", "absent", "unknown"})


def _values(raw: Any) -> dict[str, Any]:
    v = raw if isinstance(raw, dict) else {}
    out: dict[str, Any] = {}
    if isinstance(v.get("doorName"), str) and ad._text(v["doorName"], 64) is not None:
        out["doorName"] = v["doorName"]
    if ad._int(v.get("openDuration")) is not None:
        out["openDuration"] = v["openDuration"]
    if ad._bool(v.get("relayReverseEnabled")) is not None:
        out["relayReverseEnabled"] = v["relayReverseEnabled"]
    return out


def _constraints(raw: Any) -> dict[str, Any]:
    c = raw if isinstance(raw, dict) else {}
    out: dict[str, Any] = {}
    for field in FIELDS:
        item = c.get(field)
        if not isinstance(item, dict):
            continue
        kind = item.get("type")
        if kind == "boolean":
            out[field] = {"type": "boolean"}
        elif kind in ("text", "integer") and ad._int(item.get("min")) is not None and ad._int(item.get("max")) is not None:
            out[field] = {"type": kind, "min": item["min"], "max": item["max"]}
    return out


def project_door(raw: Any) -> dict[str, Any]:
    d = raw if isinstance(raw, dict) else {}
    door = ad._int(d.get("door"))
    if "error" in d:
        return {"door": door, "values": None, "constraints": None, "error": ad._code(d.get("error"))}
    return {"door": door, "values": _values(d.get("values")), "constraints": _constraints(d.get("constraints")), "error": None}


def project_report(raw: Any) -> dict[str, Any]:
    if not isinstance(raw, dict) or not isinstance(raw.get("doors"), list):
        raise ValueError("unexpected technical report")
    pw = raw.get("passwords") if isinstance(raw.get("passwords"), dict) else None
    states = (pw or {}).get("states") if isinstance((pw or {}).get("states"), dict) else {}
    features = [
        {"family": f["family"], "name": f["name"], "supported": f["supported"]}
        for f in (raw.get("features") if isinstance(raw.get("features"), list) else [])[:400]
        if isinstance(f, dict) and f.get("family") in FAMILIES and isinstance(f.get("name"), str) and FEATURE.fullmatch(f["name"]) and isinstance(f.get("supported"), bool)
    ]
    relays = [
        {"physical_index": r.get("physical_index"), "api_id": r.get("api_id"), "confirmed": r.get("confirmed") is True, "name": ad._text(r.get("name"), 64)}
        for r in (raw.get("relay_selection") if isinstance(raw.get("relay_selection"), list) else [])[:8]
        if isinstance(r, dict) and ad._int(r.get("physical_index")) is not None and ad._int(r.get("api_id")) is not None
    ]
    return {
        "checked_at": ad._iso(raw.get("checked_at")),
        "doors": [project_door(d) for d in raw["doors"][:4]],
        "passwords": None if pw is None else {
            "states": {k: ad._bool(states.get(k)) for k in PASSWORD_KEYS},
            "public_pin_state": ad._enum(pw.get("public_pin_state"), PIN_STATES),
        },
        "password_error": ad._code(raw.get("password_error")),
        "features": features,
        "relay_selection": relays,
    }


def editable_doors(report: dict[str, Any]) -> list[int]:
    """WisKey's rule: only a door of the station's confirmed relay mapping (its `api_id`) can be written."""
    return sorted({r["api_id"] for r in report.get("relay_selection") or [] if r.get("api_id") in (1, 2)})


def invalid_changes(changes: dict[str, Any], constraints: dict[str, Any] | None = None) -> list[str]:
    """The fields WisKey would refuse: unknown keys, wrong types, and - when the advertised bounds are known - values outside them
    (client/technical.validate_changes)."""
    bad = [k for k in changes if k not in FIELDS]
    for key, value in changes.items():
        if key not in FIELDS:
            continue
        if key == "relayReverseEnabled":
            ok = type(value) is bool
        elif key == "openDuration":
            ok = type(value) is int and 0 <= value <= 255
        else:
            ok = isinstance(value, str) and 1 <= len(value) <= 64 and not any(ord(c) < 32 for c in value)
        cap = (constraints or {}).get(key)
        if ok and cap and cap.get("type") == "integer":
            ok = cap["min"] <= value <= cap["max"]
        if ok and cap and cap.get("type") == "text":
            ok = cap["min"] <= len(value) <= cap["max"]
        if not ok:
            bad.append(key)
    return sorted(set(bad))


def _sum_update(p: dict[str, Any]) -> dict[str, Any]:
    return {"door": p.get("door"), "values": p.get("values")}


OPS: dict[str, Op] = {
    "read": Op("read", "stations/technical_get", "read", "intercom.installer.technical_read", ("station_id",), scope="station",
               timeout_s=WRITE_TIMEOUT_S, project=project_report),
    "update": Op("update", "stations/technical_update", "write", "intercom.installer.technical_update", ("station_id", "door", "expected", "changes", "confirmed"),
                 danger="confirm", scope="station", timeout_s=DEVICE_TIMEOUT_S, cooldown_s=10.0, project=project_door, summary=_sum_update),
    "update_relay": Op("update_relay", "stations/technical_update", "write", "intercom.installer.technical_update", ("station_id", "door", "expected", "changes", "confirmed"),
                       danger="typed", scope="station", timeout_s=DEVICE_TIMEOUT_S, cooldown_s=10.0, project=project_door, summary=_sum_update),
}
COMMANDS = frozenset(op.command for op in OPS.values())
