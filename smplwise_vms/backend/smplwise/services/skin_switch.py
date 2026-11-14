"""DOMUS-DEFAULT-2439 (owner round 33, Q-DES-20 option a): an installation whose saved look says "classic" moves ONCE to Domus.

The default skin became domus at read time (routers/settings.py DEFAULTS["ui.skin"]). That alone left every installation that had
ever saved the look card on classic, because the card stores the skin together with its other choices. This is the one move:

* a stored `ui.skin` of exactly "classic" becomes "domus";
* nothing else is touched - any other stored skin (tesla, crystal, infra, soft, the frozen bubble), the light / dark choice, the
  motion, the selected-chip look, the glass style of the device screens (`devices.style`), and an installation with no stored skin
  (it already reads domus);
* it runs once per installation: the first start of a version that has it writes the marker `ui.skin.domus_switch`, and every later
  start returns at the marker. Classic stays selectable, and an administrator who chooses it afterwards keeps it.

A guarded start-up step with a done-marker, not a numbered migration: the branch that carries it and the branches around it are
not merged yet, and a migration number taken here would leave a gap in the sequence until they are (the suite checks the sequence).

The marker is a row of the settings table but not a setting of the product: not in DEFAULTS, not served, not patchable. Its value
says what happened - "moved:classic" (the skin was moved; rollback = set `ui.skin` back to classic) or "kept" (nothing to move).
The move and the marker are written in one transaction.
"""
from __future__ import annotations

import sqlite3

from ..db import get_setting, set_setting

MARKER = "ui.skin.domus_switch"
FROM_SKIN = "classic"
TO_SKIN = "domus"


def run_once(conn: sqlite3.Connection) -> str | None:
    """Move a stored classic skin to domus unless this installation was already handled. Returns "moved" / "kept" on the run that
    handled it and None on every later one. The caller commits."""
    if get_setting(conn, MARKER) is not None:
        return None
    if get_setting(conn, "ui.skin") == FROM_SKIN:
        set_setting(conn, "ui.skin", TO_SKIN)
        set_setting(conn, MARKER, f"moved:{FROM_SKIN}")
        return "moved"
    set_setting(conn, MARKER, "kept")
    return "kept"
