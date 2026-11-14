"""CR-SHIFT114 (r114, docs/changes/CR-SHIFT114.md) slice 1: the shift / 24-hour summary of the building, read-only.

* `GET /reports/shift` - the summary of a window as structured data plus the rendered Hebrew text. Needs `reports.shift`; every section inside
  also needs its own module's right and every counted row is filtered by the reader's own visibility (services/shift_summary.py). The part
  ships OFF: while `reports.shift.enabled` is not "true" the route answers the uniform 404 to everyone, before any permission check.
* `GET /reports/shift/status` - whether the part is on and the caller may open it (drives navigation only; computes nothing, no audit row).
* `PUT /reports/shift/status` - turn the part on or off (`system.configure`; audited).

Nothing here sends anything anywhere: delivery (a scheduled push or WhatsApp text) is a later slice."""
from __future__ import annotations

import sqlite3
import time
from typing import Any, Literal

from fastapi import APIRouter, Depends, Query
from pydantic import BaseModel, ConfigDict

from ..audit import audit
from ..auth import current_principal, current_principal_ro, get_conn, get_read_conn
from ..db import get_setting, set_setting
from ..errors import ApiError, not_found
from ..rbac import INSTALLATION, Principal, authorize, permissions_anywhere, require
from ..services import shift_summary as svc

router = APIRouter()

PERMISSION = "reports.shift"
CONFIGURE = "system.configure"
SWITCH = "reports.shift.enabled"
MESSAGE = {"he": "טווח לא תקין.", "en": "Invalid range."}


def now_ts() -> float:
    """The clock of the routes (tests replace it)."""
    return time.time()


def switch_on(conn: sqlite3.Connection) -> bool:
    """On only when the row says exactly "true"; missing, unreadable or anything else is OFF."""
    try:
        return (get_setting(conn, SWITCH, "false") or "false") == "true"
    except sqlite3.Error:
        return False


@router.get("/reports/shift/status")
def status(principal: Principal = Depends(current_principal_ro), conn: sqlite3.Connection = Depends(get_read_conn)) -> dict[str, Any]:
    on = switch_on(conn)
    return {"enabled": on, "available": on and PERMISSION in set(permissions_anywhere(conn, principal)),
            "can_switch": authorize(conn, principal, CONFIGURE, INSTALLATION).allowed}


class StatusIn(BaseModel):
    model_config = ConfigDict(extra="forbid")
    enabled: bool


@router.put("/reports/shift/status")
def put_status(body: StatusIn, principal: Principal = Depends(current_principal), conn: sqlite3.Connection = Depends(get_conn)) -> dict[str, Any]:
    """Turn the shift summary on or off (system.configure, installation)."""
    require(conn, principal, CONFIGURE, INSTALLATION)
    before = switch_on(conn)
    set_setting(conn, SWITCH, "true" if body.enabled else "false")
    audit(conn, actor=principal, action="reports.shift.switch", decision="allowed", resource_type="shift_summary", resource_id="switch",
          details={"from": before, "to": body.enabled})
    return {"enabled": body.enabled}


@router.get("/reports/shift")
def shift(range: Literal["8h", "12h", "24h", "custom"] = "24h", start: str | None = Query(None, alias="from", max_length=40),  # noqa: A002
          end: str | None = Query(None, alias="to", max_length=40), principal: Principal = Depends(current_principal_ro),
          conn: sqlite3.Connection = Depends(get_read_conn)) -> dict[str, Any]:
    """What happened in the building in the window (reports.shift; sections by the reader's rights; counts only)."""
    if not switch_on(conn):
        raise not_found("הפריט לא נמצא.")
    if PERMISSION not in set(permissions_anywhere(conn, principal)):
        require(conn, principal, PERMISSION, INSTALLATION)  # the audited 403
    try:
        lo, hi = svc.parse_window(range, start, end, now_ts())
    except svc.WindowError as e:
        raise ApiError(422, "validation", MESSAGE["he"], details={"fields": [str(e)], "message_en": MESSAGE["en"]}) from None
    model = svc.build(conn, principal, lo, hi)
    audit(conn, actor=principal, action="reports.shift.read", decision="allowed", resource_type="shift_summary", resource_id=range,
          details=svc.audit_details(model))
    return model
