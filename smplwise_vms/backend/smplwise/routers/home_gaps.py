"""HOME-V3-GAPS-2436: the home interface v3 mockup's remaining gaps that need the server.

* `GET /home/alarm-log`  the alarm's arm / disarm changes of the last 7 days for the home diary's "אזעקה" filter (mockup v3
                         `S.events`, kind `alarm`): only actions the panel CONFIRMED (`ha_actions.status = 'confirmed'`), only panels
                         the caller may view (`alarm.view` with the alarm router's own entity reach rule), newest first, at most 60.
                         Read only. A home-only person whose administrator hid the house log or the security category gets
                         403 `home_module_off`. Never a code, an argument or a request id - only when, which panel, which change, who.

An arm / disarm done at the panel's own keypad never passes through Arx and is therefore not listed (the screen says "מהמערכת").
"""
from __future__ import annotations

import datetime as dt
import sqlite3
from typing import Any

from fastapi import APIRouter, Depends

from ..auth import current_principal_ro, get_read_conn
from ..rbac import INSTALLATION, Principal, require
from ..services import home_interface as hi
from ..services.alarm import ACTIONS

router = APIRouter()

DAYS = 7
LIMIT = 60
# action id -> the mode word the screen shows (services.alarm.ACTIONS, inverted)
MODE_OF: dict[str, str] = {v: k for k, v in ACTIONS.items()}


def _iso(t: dt.datetime) -> str:
    return t.astimezone(dt.timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")


def _modules_on(conn: sqlite3.Connection, principal: Principal) -> None:
    """The person's home categories: the alarm changes belong to the house log AND the alarm (security) category."""
    mods = hi.effective(conn, principal.user_id)["modules"]
    if mods is not None and not ("log" in mods and "security" in mods):
        raise hi.HomeInterfaceError(403, "home_module_off", "המסך הזה לא הופעל עבורך.")


def alarm_log(conn: sqlite3.Connection, principal: Principal, now: dt.datetime | None = None) -> list[dict[str, Any]]:
    from .alarm import VIEW, _Scope  # the alarm router's own reach rule (placement + floor scope), not a copy of it

    scope = _Scope(conn, principal)
    if not scope.any_view():
        require(conn, principal, VIEW, INSTALLATION)  # the audited 403
    since = _iso((now or dt.datetime.now(dt.timezone.utc)) - dt.timedelta(days=DAYS))
    rows = conn.execute(
        "SELECT a.entity_id, a.action_id, a.requested_at, a.confirmed_at, a.principal_user_id, u.display_name, u.username "
        "FROM ha_actions a LEFT JOIN users u ON u.id = a.principal_user_id "
        "WHERE a.action_id LIKE 'alarm_control_panel.alarm_%' AND a.status = 'confirmed' AND a.requested_at >= ? "
        "ORDER BY a.requested_at DESC LIMIT 400",
        (since,),
    ).fetchall()
    out: list[dict[str, Any]] = []
    for r in rows:
        mode = MODE_OF.get(r["action_id"])
        if mode is None or not scope.allowed(VIEW, r["entity_id"]):
            continue
        out.append({
            "at": r["confirmed_at"] or r["requested_at"],
            "panel": r["entity_id"],
            "action": mode,
            "by": (r["display_name"] or r["username"] or None),
            "me": r["principal_user_id"] == principal.user_id,
        })
        if len(out) >= LIMIT:
            break
    return out


@router.get("/home/alarm-log")
def get_alarm_log(principal: Principal = Depends(current_principal_ro), conn: sqlite3.Connection = Depends(get_read_conn)) -> dict[str, Any]:
    _modules_on(conn, principal)
    return {"items": alarm_log(conn, principal), "days": DAYS}
