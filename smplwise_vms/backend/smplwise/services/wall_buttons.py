"""KAV079-295: the vocabulary of wall-button / switch device triggers (pure: no I/O).

Home Assistant describes a press of a wall button as a DEVICE trigger: `{trigger: device, device_id, domain, type, subtype}`, where
`type` names the press and `subtype` names the button. The words differ per integration, so the builder never invents them: a typed
`button` block keeps the stored `type` / `subtype` as its vocabulary (`ha_type`, `ha_subtype`) and changes only the press word of the
same family and the button number inside the subtype. A trigger whose words are not one of the families below stays a locked block.

Families (press -> the integration's word):
  ZHA / deCONZ style  remote_button_short_press / remote_button_double_press / remote_button_long_press
  Shelly style        single / double / long          (and single_push / double_push / long_push)
  generic             short_press / double_press / long_press,  button_short_press / button_double_press / button_long_press
Button: the trailing number of the subtype (`button_1`, `button1`, `1`); a subtype without one (`turn_on`, `dim_up`) is not a numbered
button and stays locked.
"""
from __future__ import annotations

import re
from typing import Any, Mapping

PRESSES = ("short", "double", "long")
FAMILIES: tuple[dict[str, str], ...] = (
    {"short": "remote_button_short_press", "double": "remote_button_double_press", "long": "remote_button_long_press"},
    {"short": "single", "double": "double", "long": "long"},
    {"short": "single_push", "double": "double_push", "long": "long_push"},
    {"short": "short_press", "double": "double_press", "long": "long_press"},
    {"short": "button_short_press", "double": "button_double_press", "long": "button_long_press"},
)
_PRESS_OF = {word: press for fam in FAMILIES for press, word in fam.items()}
_BUTTON_RE = re.compile(r"^(.*?)(\d{1,2})$")
# keys a typed button trigger may carry besides its own (everything else keeps the trigger locked)
TRIGGER_KEYS = frozenset({"trigger", "platform", "device_id", "domain", "type", "subtype", "id", "discovery_id", "metadata", "alias"})
CARRIED = ("discovery_id",)  # kept verbatim in the block's `extra` and written back (`metadata` / `alias` are carried by the model itself)
BUTTONS_MAX = 12


def press_of(ha_type: Any) -> str | None:
    return _PRESS_OF.get(ha_type) if isinstance(ha_type, str) else None


def button_of(ha_subtype: Any) -> int | None:
    if not isinstance(ha_subtype, str):
        return None
    m = _BUTTON_RE.match(ha_subtype)
    if not m:
        return None
    n = int(m.group(2))
    return n if 1 <= n <= BUTTONS_MAX else None


def type_for(ha_type: str, press: str) -> str | None:
    """The word of `press` in the family `ha_type` belongs to (None: not a known family / press)."""
    for fam in FAMILIES:
        if ha_type in fam.values():
            return fam.get(press)
    return None


def subtype_for(ha_subtype: str, button: int) -> str | None:
    m = _BUTTON_RE.match(ha_subtype)
    if not m or not 1 <= int(button) <= BUTTONS_MAX:
        return None
    return f"{m.group(1)}{int(button)}"


def is_button_trigger(raw: Mapping[str, Any]) -> bool:
    """A stored device trigger the typed `button` block can hold exactly."""
    typ = raw.get("trigger") if raw.get("trigger") is not None else raw.get("platform")
    if typ != "device" or not all(k in TRIGGER_KEYS for k in raw):
        return False
    if not isinstance(raw.get("device_id"), str) or not raw["device_id"] or not isinstance(raw.get("domain"), str) or not raw["domain"]:
        return False
    if "id" in raw and not isinstance(raw["id"], str):
        return False
    if "discovery_id" in raw and not isinstance(raw["discovery_id"], str):
        return False
    return press_of(raw.get("type")) is not None and button_of(raw.get("subtype")) is not None


def key_of(device_id: str, ha_subtype: str, ha_type: str) -> str:
    """The identity of one press of one button (what "already used by another item" compares)."""
    return f"{device_id}|{ha_subtype}|{ha_type}"


def buttons_from_triggers(triggers: list[Any]) -> list[dict[str, Any]]:
    """The numbered buttons of one device from Home Assistant's trigger list (`device_automation/trigger/list`): per button the presses it
    offers with their exact words. Triggers that are not button presses (a battery level, a dim step) are ignored."""
    by: dict[int, dict[str, Any]] = {}
    for t in triggers:
        if not isinstance(t, dict) or not is_button_trigger({k: v for k, v in t.items() if k in TRIGGER_KEYS} | {"trigger": "device"}):
            continue
        n = button_of(t["subtype"])
        press = press_of(t["type"])
        if n is None or press is None:
            continue
        b = by.setdefault(n, {"button": n, "presses": {}})
        entry = {"press": press, "ha_type": t["type"], "ha_subtype": t["subtype"], "domain": t["domain"]}
        if isinstance(t.get("discovery_id"), str):
            entry["discovery_id"] = t["discovery_id"]
        b["presses"].setdefault(press, entry)
    out = []
    for n in sorted(by):
        presses = [by[n]["presses"][p] for p in PRESSES if p in by[n]["presses"]]
        out.append({"button": n, "presses": presses})
    return out
