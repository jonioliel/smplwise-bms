"""SMALLFIXA-295 (Fable review 3 G-01 / G-03 follow-up): the ONE writer of the `wiskey.acr5_*` installation switches.

Since F3A-295 the four switches really gate the WisKey person readback (services/wiskey_readback.py), but nothing could set them:
G-03 found no route. This module is what `routers/wiskey_switches.py` calls - nothing else writes these keys.

Rules
- A closed list: exactly the four `wiskey_acr5.FLAGS` settings, values `off | on`. Any other key is refused (`unknown_switch`), a key
  that names a go-live permit (`go_live`, `permit`) is refused by name (`permit_not_writable`): a go-live permit is a build constant
  that only the owner's reviewed commit changes, never a setting, so no request can flip one here.
- `on` is refused while the consumer's go-live permit (`wiskey_acr5.GO_LIVE_PERMITTED`: True since 2026-10-21, the owner's kill switch,
  O9 a) is False: 409 `wiskey_not_permitted`.
- All or nothing: every key and value is checked before the first write.
- Every switch still defaults OFF (a key never written reads `off`); this module never writes on its own.
- Out of scope on purpose: `wiskey.peer_receipt` and `wiskey.peer_pin` (the peer seam is not wired - test-enforced - and the pin is
  the owner's alone); both are `unknown_switch` here.

WISKEY-RC7-ADOPT-2331 S1 (WisKey M12 policy B, owner 02.11): the owner's switch of the automatic WisKey installation
(`wiskey.auto_install`, wiskey_auto_install.SWITCH_KEY) is a SEPARATE closed entry on this same writer - the one and only writer of that
key (no `SettingsPatch` field, no installer / start-up / reconcile write; test-enforced). Values `off | on`; it is not an acr5 read
switch and not under the acr5 go-live rule: `on` is refused 409 `auto_install_not_permitted` while the build constant
`wiskey_auto_install.OWNER_ON_PERMITTED` is False (owner default D1=b). `off` is always allowed."""
from __future__ import annotations

import re
import sqlite3
from typing import Any

from ..db import get_setting, set_setting
from . import wiskey_acr5 as a5
from . import wiskey_auto_install as wai

VALUES = ("off", "on")
SWITCHES: tuple[str, ...] = tuple(a5.FLAGS.values())  # the four acr5 read switches (the acr5 go-live rule)
INSTALL_SWITCH = wai.SWITCH_KEY  # S1: the owner's automatic-installation switch (its own build constant, OWNER_ON_PERMITTED)
ALL_SWITCHES: tuple[str, ...] = (*SWITCHES, INSTALL_SWITCH)
MAX_CHANGES = len(ALL_SWITCHES)
PERMIT_RE = re.compile(r"go[_.\-]?live|permit", re.IGNORECASE)

if (any(PERMIT_RE.search(k) for k in ALL_SWITCHES) or not all(k.startswith("wiskey.acr5_") for k in SWITCHES)
        or INSTALL_SWITCH != "wiskey.auto_install" or len(set(ALL_SWITCHES)) != len(ALL_SWITCHES)):
    raise RuntimeError("wiskey_switches: a writable switch must be a wiskey.acr5_* key or wiskey.auto_install and never name a permit")


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
    return {"switches": {key: mode(conn, key) for key in ALL_SWITCHES}, "go_live_permitted": a5.go_live_permitted(),
            "auto_install_permitted": wai.owner_on_permitted()}


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
        if key not in ALL_SWITCHES:
            raise SwitchRefused("unknown_switch", 422)
        if value not in VALUES:  # a null / missing / any other value is never ON
            raise SwitchRefused("validation", 422)
    if any(changes.get(k) == "on" for k in SWITCHES) and not a5.go_live_permitted():
        raise SwitchRefused("wiskey_not_permitted", 409)
    if changes.get(INSTALL_SWITCH) == "on" and not wai.owner_on_permitted():
        raise SwitchRefused("auto_install_not_permitted", 409)


def apply(conn: sqlite3.Connection, changes: dict[str, str]) -> list[tuple[str, str, str]]:
    """check() then write every switch; returns (key, before, after) per key. Never touches a key outside ALL_SWITCHES. The only
    production write of `wiskey.auto_install` (test-enforced)."""
    check(changes)
    out: list[tuple[str, str, str]] = []
    for key in ALL_SWITCHES:  # the closed list drives the writes, never the caller's keys
        if key not in changes:
            continue
        before = mode(conn, key)
        set_setting(conn, key, changes[key])
        out.append((key, before, changes[key]))
    return out
