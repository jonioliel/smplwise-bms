"""MOBILE-CONTRACT-V22 (contract v2.2, docs/api/mobile-presence-contract.md section 4.1): the per-sensor `value` shapes of a `sensor`
event, and the server's optional check of them.

Up to contract v2.1 the server checked only the envelope of a sensor value (a flat object, <= 20 keys, strings <= 128 characters,
<= 1 KiB) and stored whatever passed. v2.2 fixes ONE shape per sensor (the MOBILE214 proposal plus the owner's answers of 2026-10-24:
one shape for both platforms, `unavailable` next to `on` / `off`) and gives the administrator a setting, `presence.value_check`:

- `off` (the default - the 2.1 behaviour, so the 2.1.x apps in the field keep working unchanged): the envelope only; stored as sent;
- `normalize`: never refuses; keeps only the v2.2 keys whose values are valid, drops every other key (data minimisation: a key the
  contract does not name is personal data nobody asked for), maps the one legacy spelling (`network.type` -> `network.network`);
- `strict`: refuses the whole batch on the first non-conforming value - `400 invalid_event` with `details.field = "value.<key>"` and
  `details.reason` = `unknown_key` | `invalid_value` | `missing_key` - for apps that implement v2.2.

The envelope rules stay where they were (services/presence.py `_validate_event`); this module never touches location events (`fix` /
`enter` / `exit`), the status object or the Wi-Fi verdict (`_resolve_wifi` runs after it, on the checked value). Pure functions, no I/O."""
from __future__ import annotations

import datetime as dt
import math
import re
from collections.abc import Callable
from typing import Any

CONTRACT_VERSION = "2.2"

VALUE_CHECK_MODES = ("off", "normalize", "strict")
VALUE_CHECK_DEFAULT = "off"

ACTIVITY_STATES = ("stationary", "walking", "running", "cycling", "automotive", "unknown")
CONFIDENCE = ("high", "medium", "low", "unknown")
CHARGING_STATES = ("charging", "full", "unplugged", "unknown")
NETWORK_TYPES = ("wifi", "cellular", "none", "other")
BEACON_PROXIMITY = ("immediate", "near", "far", "unknown")  # `unknown` is stored but never places anyone (presence_people._proximity_ok)
APP_STATES = ("foreground", "background")

# The sensors' reporting cadence in seconds when nothing changes (contract v2.2 section 2: every sensor but `location`, whose cadence is
# `interval_s` + `distance_filter_m`). A CHANGE of state is reported in the next batch whatever the interval (it may be coalesced with
# others, never dropped). The administrator overrides any of them (30..86400) in הגדרות › אפליקציה לנייד.
DEFAULT_INTERVALS: dict[str, int] = {"activity": 300, "steps": 300, "altitude": 300, "battery": 900, "network": 60, "beacon": 60, "app_state": 300}

LEGACY_ALIASES: dict[str, dict[str, str]] = {"network": {"type": "network"}}  # contract v2.1's table spelled the network kind `type`

UNKNOWN_KEY, INVALID_VALUE, MISSING_KEY = "unknown_key", "invalid_value", "missing_key"

_ID_RE = re.compile(r"^[A-Za-z0-9_.:-]{1,64}$")
_UUID_RE = re.compile(r"^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$")
_HEX64_RE = re.compile(r"^[0-9a-fA-F]{64}$")
_INSTANT_RE = re.compile(r"^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d(\.\d{1,6})?Z$")


# ---------------------------------------------------------------- value kinds

def _enum(values: tuple[str, ...]) -> Callable[[Any], bool]:
    return lambda v: isinstance(v, str) and v in values


def _int(lo: int, hi: int, *, nullable: bool = False) -> Callable[[Any], bool]:
    def ok(v: Any) -> bool:
        if v is None:
            return nullable
        return isinstance(v, int) and not isinstance(v, bool) and lo <= v <= hi
    return ok


def _number(lo: float, hi: float, *, nullable: bool = False) -> Callable[[Any], bool]:
    def ok(v: Any) -> bool:
        if v is None:
            return nullable
        return isinstance(v, (int, float)) and not isinstance(v, bool) and math.isfinite(v) and lo <= v <= hi
    return ok


def _bool(*, nullable: bool = False) -> Callable[[Any], bool]:
    return lambda v: isinstance(v, bool) or (nullable and v is None)


def _regex(rx: re.Pattern[str]) -> Callable[[Any], bool]:
    return lambda v: isinstance(v, str) and rx.fullmatch(v) is not None


def _instant(v: Any) -> bool:
    if not isinstance(v, str) or not _INSTANT_RE.fullmatch(v):
        return False
    try:
        dt.datetime.fromisoformat(v.replace("Z", "+00:00"))
    except ValueError:
        return False
    return True


# ---------------------------------------------------------------- the shapes (contract v2.2 section 4.1 - keep the two in step)

# sensor -> key -> (validator, required). `location` has no sensor event: it is reported as fix / enter / exit, so no key is valid.
SHAPES: dict[str, dict[str, tuple[Callable[[Any], bool], bool]]] = {
    "location": {},
    "activity": {"state": (_enum(ACTIVITY_STATES), True), "confidence": (_enum(CONFIDENCE), False)},
    "steps": {"steps_delta": (_int(0, 1_000_000), True), "floors_up": (_int(0, 10_000), False), "floors_down": (_int(0, 10_000), False)},
    "altitude": {"relative_change_m": (_number(-10_000, 10_000), True)},
    "battery": {"level_percent": (_number(0, 100, nullable=True), True), "charging_state": (_enum(CHARGING_STATES), False),
                "low_power_mode": (_bool(nullable=True), False)},
    "network": {"network": (_enum(NETWORK_TYPES), True), "wifi_match": (_bool(), False), "wifi_site_id": (_regex(_ID_RE), False),
                "ssid_hash": (_regex(_HEX64_RE), False)},
    "beacon": {"beacon_id": (_regex(_ID_RE), False), "uuid": (_regex(_UUID_RE), False), "major": (_int(0, 65535, nullable=True), False),
               "minor": (_int(0, 65535, nullable=True), False), "site_id": (_regex(_ID_RE), False), "proximity": (_enum(BEACON_PROXIMITY), True)},
    "app_state": {"state": (_enum(APP_STATES), True), "last_seen": (_instant, False)},
}
WIFI_ONLY_KEYS = ("wifi_match", "wifi_site_id", "ssid_hash")


def _aliased(sensor: str, value: dict[str, Any]) -> dict[str, Any]:
    out = dict(value)
    for old, new in LEGACY_ALIASES.get(sensor, {}).items():
        if old in out and new not in out:
            out[new] = out.pop(old)
    return out


def problems(sensor: str, value: dict[str, Any]) -> list[tuple[str, str]]:
    """Every way `value` departs from the v2.2 shape of `sensor`, in a stable order: [(key, reason)]. Empty = conforming. No aliases
    here: a v2.2 app sends the v2.2 spellings."""
    shape = SHAPES.get(sensor)
    if shape is None:
        return [("", INVALID_VALUE)]
    out: list[tuple[str, str]] = [(k, UNKNOWN_KEY) for k in sorted(value) if k not in shape]
    out += [(k, INVALID_VALUE) for k in sorted(value) if k in shape and not shape[k][0](value[k])]
    out += [(k, MISSING_KEY) for k, (_, required) in shape.items() if required and k not in value]
    # the cross-field rules
    if sensor == "network" and value.get("network") != "wifi":
        out += [(k, INVALID_VALUE) for k in WIFI_ONLY_KEYS if k in value]
    if sensor == "network" and "wifi_site_id" in value and value.get("wifi_match") is not True:
        out.append(("wifi_site_id", INVALID_VALUE))
    if sensor == "beacon":
        if "beacon_id" not in value and "uuid" not in value:
            out.append(("beacon_id", MISSING_KEY))
        out += [(k, INVALID_VALUE) for k in ("major", "minor") if k in value and "uuid" not in value]
    return list(dict.fromkeys(out))  # each (key, reason) once, first occurrence wins


def normalize(sensor: str, value: dict[str, Any]) -> dict[str, Any]:
    """The v2.2 part of `value`: legacy spellings mapped, then only known keys with valid values kept. Never raises, never refuses (a
    missing required key stays missing). The cross-field rules drop what would contradict the rest of the value."""
    shape = SHAPES.get(sensor, {})
    v = _aliased(sensor, value)
    out = {k: x for k, x in v.items() if k in shape and shape[k][0](x)}
    if sensor == "network":
        if "network" in out and out["network"] != "wifi":  # an absent kind keeps the Wi-Fi keys: an older app may omit it
            for k in WIFI_ONLY_KEYS:
                out.pop(k, None)
        if "wifi_site_id" in out and out.get("wifi_match") is not True:
            out.pop("wifi_site_id")
    if sensor == "beacon" and "uuid" not in out:
        out.pop("major", None)
        out.pop("minor", None)
    return out


def conforms(sensor: str, value: dict[str, Any]) -> bool:
    return not problems(sensor, value)


__all__ = ["ACTIVITY_STATES", "APP_STATES", "BEACON_PROXIMITY", "CHARGING_STATES", "CONFIDENCE", "CONTRACT_VERSION", "DEFAULT_INTERVALS",
           "INVALID_VALUE", "LEGACY_ALIASES", "MISSING_KEY", "NETWORK_TYPES", "SHAPES", "UNKNOWN_KEY", "VALUE_CHECK_DEFAULT", "VALUE_CHECK_MODES",
           "WIFI_ONLY_KEYS", "conforms", "normalize", "problems"]
