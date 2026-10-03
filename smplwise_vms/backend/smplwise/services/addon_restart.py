"""The "restart required" button of CR-022 section 8: restart this add-on through the infrastructure's API.

The whole outgoing surface is one call, `POST /addons/self/restart` (the add-on's default `hassio_api` role allows it; verified
in code, not on the owner's installation - AT-022-16). Nothing else can be sent from here. The token addresses the add-on as
`self`; no token, address or slug is stored or returned. Outside the add-on (a workstation, a test backend without a fake)
`configured` is False and the router answers 409 `restart_manual`: the service is restarted by hand.

CR-021's `self_update.call` is allow-listed to its own read-only S1 calls on purpose, so this module keeps its own single
allow-listed call instead of widening that list. Tests install `BASE_URL` / `TOKEN` / `TRANSPORT` (an httpx MockTransport).

The guard against a restart loop (CR-022 R10, security review F6) is the time of the last accepted restart, stored in the
`settings` table (`system.addon_restart_at`, wall-clock seconds; in backup.SETTINGS_KEEP), so it survives the restart it
guards. One restart per two minutes. A clock that went backwards never blocks: a stored time in the future is ignored.
(CR-021's platform restart has no such guard, by the owner's decision; this one is the Arx add-on restart only.)"""
from __future__ import annotations

import os
import sqlite3
import time
from collections.abc import Callable

from ..config import Settings
from ..db import get_setting, set_setting

DEFAULT_BASE = "http://supervisor"
PATH = "/addons/self/restart"
BASE_URL: str | None = None
TOKEN: str | None = None
TRANSPORT = None  # tests: an httpx.BaseTransport
TIMEOUT_S = 15.0
LAST_KEY = "system.addon_restart_at"
WINDOW_S = 120
WALL: Callable[[], float] = time.time  # tests replace it


def wait_seconds(conn: sqlite3.Connection) -> int:
    """0 when a restart may run now, else the seconds to wait (the last accepted restart is less than WINDOW_S ago)."""
    try:
        last = float(get_setting(conn, LAST_KEY) or 0)
    except (TypeError, ValueError):
        return 0
    delta = WALL() - last
    if 0 <= delta < WINDOW_S:
        return max(1, int(WINDOW_S - delta) + 1)
    return 0


def mark(conn: sqlite3.Connection) -> None:
    """Record an accepted restart in the request's transaction (committed before the call is made)."""
    set_setting(conn, LAST_KEY, f"{WALL():.3f}")


def _token() -> str | None:
    return TOKEN or os.environ.get("SUPERVISOR_TOKEN") or None


def configured(settings: Settings) -> bool:
    return bool(_token()) and (BASE_URL is not None or settings.in_addon)


def restart(settings: Settings) -> str:
    """`ok`, `forbidden`, `unreachable` or `error`. Never raises for a network or HTTP problem."""
    if not configured(settings):
        return "unreachable"
    import httpx

    try:
        with httpx.Client(transport=TRANSPORT, timeout=TIMEOUT_S, follow_redirects=False) as client:
            r = client.post((BASE_URL or DEFAULT_BASE).rstrip("/") + PATH, headers={"Authorization": f"Bearer {_token()}"})
    except httpx.HTTPError:
        return "unreachable"
    if r.status_code in (401, 403):
        return "forbidden"
    return "ok" if r.status_code < 300 else "error"
