"""A user's own interface preferences (CR-013, migration 0037): a closed list of keys, each with its own validator, stored
per user so the preference follows the user to every device. Nothing here is a permission: the navigation a user may
see is decided by their bindings; `nav.order` only orders the tabs the shell already decided to show."""
from __future__ import annotations

import json
import sqlite3
from typing import Any, Callable

from ..db import now_iso
from . import area_row, home_config, look, media_layout, nav_size

# The navigation tabs of the app shell in their default order (frontend/src/shell/nav.ts, NAV_A): ראשי (the device
# overview), אבטחה, מפה, WisKey. The user avatar is always last and is not a tab. A new tab is appended to every stored
# order at its default place by normalize_nav_order, so an older stored order never hides it.
NAV_TAB_IDS: tuple[str, ...] = ("devices", "security", "explore", "multimedia", "wiskey")
MAX_LIST = 32
MAX_ID = 32


def normalize_nav_order(value: Any) -> list[str]:
    """Known ids in the stored order (unknown ids and duplicates dropped), then the missing ones in the default order."""
    if not isinstance(value, list) or len(value) > MAX_LIST:
        raise ValueError("nav.order must be a list of tab ids")
    seen: list[str] = []
    for item in value:
        if not isinstance(item, str) or len(item) > MAX_ID:
            raise ValueError("nav.order items must be short strings")
        if item in NAV_TAB_IDS and item not in seen:
            seen.append(item)
    return seen + [t for t in NAV_TAB_IDS if t not in seen]


# `ui.nav_size` (UI round 1): the size of the rail / bottom bar for this user; when unset (not in `stored`) the installation's
# `ui.nav_size` setting applies (services/nav_size.py holds the shape and ranges)
VALIDATORS: dict[str, Callable[[Any], Any]] = {"nav.order": normalize_nav_order, "ui.nav_size": nav_size.normalize}
DEFAULTS: dict[str, Any] = {"nav.order": list(NAV_TAB_IDS), "ui.nav_size": dict(nav_size.DEFAULT)}
# `ui.look` (Bubble foundation, owner 2026-10-02): the user's own look dials - a PARTIAL object, only the dials they set; each
# follows the installation's `ui.look` otherwise (services/look.py). No stored value (null) = follow it entirely. Presentation only.
VALIDATORS["ui.look"] = look.normalize_partial
DEFAULTS["ui.look"] = None


def _choice(name: str, allowed: tuple[str, ...]) -> Callable[[Any], str]:
    """A validator for a small closed set of values, given as a string or a whole number ("12" and 12 are the same)."""

    def validate(value: Any) -> str:
        if isinstance(value, bool) or not isinstance(value, (int, str)):
            raise ValueError(f"{name} must be one of {', '.join(allowed)}")
        text = str(value).strip()
        if text not in allowed:
            raise ValueError(f"{name} must be one of {', '.join(allowed)}")
        return text

    return validate


# WisKey (the embedded intercom panel) start choices, WisKey rc.37: the overview's card count and the camera wall's stream
# budget. They only become the `density` / `wall` query parameters of the panel's address (frontend/src/wiskey/), so
# WisKey stores nothing itself. No stored value (null) = follow the installation's default (`ui.wiskey_density` /
# `ui.wiskey_wall`); "auto" for the density is an explicit "let WisKey size the overview by itself".
WISKEY_DENSITIES: tuple[str, ...] = ("auto", "4", "6", "8", "9", "12")
WISKEY_WALLS: tuple[str, ...] = ("4", "9", "12")
VALIDATORS["wiskey.density"] = _choice("wiskey.density", WISKEY_DENSITIES)
VALIDATORS["wiskey.wall"] = _choice("wiskey.wall", WISKEY_WALLS)
DEFAULTS["wiskey.density"] = None
DEFAULTS["wiskey.wall"] = None

# `home.personal` (home redesign, owner 2026-09-30): the user's own home-screen direction and widget on / off / size / order
# (services/home_config.py). The keys are stored for everyone who sends them past the permission check, but the value only
# EXISTS for a holder of `screen.personalize`: routers/me.py refuses a write without it and hides the stored value on a read,
# and services/home_screen.py ignores it when the tree is built (a user who lost the permission gets the installation's screen).
PERSONAL_HOME_KEY = "home.personal"
VALIDATORS[PERSONAL_HOME_KEY] = home_config.normalise_personal
DEFAULTS[PERSONAL_HOME_KEY] = None

# `devices.area_row` (release 0.1.149): what the user wants next to an area's name and in a floor's header, over the installation's
# `devices.area_row` / `devices.floor_row` (services/area_row.py). Same rule as `home.personal`: the value exists only for a holder of
# `screen.personalize`.
PERSONAL_AREA_ROW_KEY = "devices.area_row"
VALIDATORS[PERSONAL_AREA_ROW_KEY] = area_row.normalise_personal
DEFAULTS[PERSONAL_AREA_ROW_KEY] = None
# `multimedia.personal` (CR-015, MEDIA_API.md 3.15): the same rule for the screens page - the user's own group / order / per card on and
# size, only for a holder of `screen.personalize` (403 personalize_required on a write without it, hidden on a read; services/media_layout.py).
PERSONAL_MEDIA_KEY = "multimedia.personal"
VALIDATORS[PERSONAL_MEDIA_KEY] = media_layout.normalise_personal
DEFAULTS[PERSONAL_MEDIA_KEY] = None
# every personal key: hidden on a read and refused on a write without screen.personalize (routers/me.py)
PERSONAL_KEYS: tuple[str, ...] = (PERSONAL_HOME_KEY, PERSONAL_AREA_ROW_KEY, PERSONAL_MEDIA_KEY)


def get_prefs(conn: sqlite3.Connection, user_id: str, hide: tuple[str, ...] = ()) -> dict[str, Any]:
    """Every known key, the stored value (re-normalized: the known ids may have grown since) or the default. A key in `hide` is
    read as if it were not stored at all - neither its value, nor `stored`, nor `updated_at` shows it (a personal value the caller
    may no longer have: routers/me.py)."""
    rows = {r["key"]: r for r in conn.execute("SELECT key, value_json, updated_at FROM user_prefs WHERE user_id = ?", (user_id,)).fetchall()}
    prefs: dict[str, Any] = {}
    stored: list[str] = []
    updated: str | None = None
    for key, default in DEFAULTS.items():
        row = None if key in hide else rows.get(key)
        value = default
        if row is not None:
            try:
                value = VALIDATORS[key](json.loads(row["value_json"]))
                stored.append(key)
                updated = max(updated or "", row["updated_at"])
            except (ValueError, TypeError, json.JSONDecodeError):
                value = default  # an unreadable row is the default, never an error for the shell
        prefs[key] = value
    return {"prefs": prefs, "stored": stored, "updated_at": updated}


def set_prefs(conn: sqlite3.Connection, user_id: str, patch: dict[str, Any]) -> dict[str, Any]:
    """Apply a partial update: a validated value replaces the key, null deletes it (back to the default)."""
    now = now_iso()
    # every value is validated BEFORE anything is written: one bad key refuses the whole update and nothing of it commits
    values = {key: (None if raw is None else VALIDATORS[key](raw)) for key, raw in patch.items()}
    for key, value in values.items():
        if value is None:
            conn.execute("DELETE FROM user_prefs WHERE user_id = ? AND key = ?", (user_id, key))
            continue
        conn.execute(
            "INSERT INTO user_prefs(user_id, key, value_json, updated_at) VALUES (?,?,?,?) "
            "ON CONFLICT(user_id, key) DO UPDATE SET value_json = excluded.value_json, updated_at = excluded.updated_at",
            (user_id, key, json.dumps(value, ensure_ascii=False), now),
        )
    return get_prefs(conn, user_id)
