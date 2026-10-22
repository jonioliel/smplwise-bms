"""SMALLFIXA-295 (Fable review 3 G-01 / G-03 follow-up): the ONE writer of the `wiskey.acr5_*` installation switches.

Since F3A-295 the four switches really gate the WisKey person readback (services/wiskey_readback.py), but nothing could set them:
G-03 found no route. This module is what `routers/wiskey_switches.py` calls - nothing else writes these keys.

Rules
- A closed list: exactly the four `wiskey_acr5.FLAGS` settings, values `off | on`. Any other key is refused (`unknown_switch`), a key
  that names a go-live permit (`go_live`, `permit`) is refused by name (`permit_not_writable`): a go-live permit is a build constant
  that only the owner's reviewed commit changes, never a setting, so no request can flip one here.
- `on` is refused while the build carries no go-live permit for the consumer (`wiskey_acr5.GO_LIVE_PERMITTED`): 409 `wiskey_not_permitted`.
- All or nothing: every key and value is checked before the first write.
- Every switch still defaults OFF (a key never written reads `off`); this module never writes on its own.
- Out of scope on purpose: `wiskey.peer_receipt` and `wiskey.peer_pin` (the peer seam is not wired - test-enforced - and the pin is
  the owner's alone); both are `unknown_switch` here."""
from __future__ import annotations

import re
import sqlite3
from typing import Any

from ..db import get_setting, set_setting
from . import wiskey_acr5 as a5

VALUES = ("off", "on")
SWITCHES: tuple[str, ...] = tuple(a5.FLAGS.values())
MAX_CHANGES = len(SWITCHES)
PERMIT_RE = re.compile(r"go[_.\-]?live|permit", re.IGNORECASE)

if any(PERMIT_RE.search(k) for k in SWITCHES) or not all(k.startswith("wiskey.acr5_") for k in SWITCHES):
    raise RuntimeError("wiskey_switches: a writable switch must be a wiskey.acr5_* key and never name a permit")


class SwitchRefused(Exception):
    """A closed refusal code; never echoes the caller's key or value."""

    def __init__(self, code: str, status: int) -> None:
        super().__init__(code)
        self.code = code
        self.status = status


def mode(conn: sqlite3.Connection, key: str) -> str:
    try:
        return "on" if (get_setting(conn, key) or "off") == "on" else "off"
    except sqlite3.Error:
        return "off"


def view(conn: sqlite3.Connection) -> dict[str, Any]:
    return {"switches": {key: mode(conn, key) for key in SWITCHES}, "go_live_permitted": a5.go_live_permitted()}


def check(changes: dict[str, Any]) -> None:
    """Raises SwitchRefused for the first problem; the permit name is checked before the closed list."""
    if not changes:
        raise SwitchRefused("validation", 422)
    if len(changes) > MAX_CHANGES:
        raise SwitchRefused("validation", 422)
    for key in changes:
        if not isinstance(key, str) or PERMIT_RE.search(key):
            raise SwitchRefused("permit_not_writable", 422)
    for key, value in changes.items():
        if key not in SWITCHES:
            raise SwitchRefused("unknown_switch", 422)
        if value not in VALUES:
            raise SwitchRefused("validation", 422)
    if any(v == "on" for v in changes.values()) and not a5.go_live_permitted():
        raise SwitchRefused("wiskey_not_permitted", 409)


def apply(conn: sqlite3.Connection, changes: dict[str, str]) -> list[tuple[str, str, str]]:
    """check() then write every switch; returns (key, before, after) per key. Never touches a key outside SWITCHES."""
    check(changes)
    out: list[tuple[str, str, str]] = []
    for key in SWITCHES:  # the closed list drives the writes, never the caller's keys
        if key not in changes:
            continue
        before = mode(conn, key)
        set_setting(conn, key, changes[key])
        out.append((key, before, changes[key]))
    return out
