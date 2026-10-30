"""AREAEDIT-2290: saving what the area quick-control pop-up shows (services/popup_layout.py), stored in `home.screen.popup`.

PUT /devices/areas/{area_id}/popup-layout   the layout of one area (null = back to the site default)
PUT /devices/popup-layout                   the site default (null = back to today's fixed layout); may also set `popup_alert`

Permission: `system.configure` - the permission that already changes the home screen's options - checked on the area's floor (so a
manager whose role is bound to a building or floor edits only the areas under it) and, for the site default, on the installation.
Presentation only: nothing here grants anything. A stale `version` is refused (409 `version_conflict`) unless `force` is sent. Every save
is audited with the actor, the scope and what changed. Reading needs nothing special: the layout travels with `GET /settings` home.screen.
"""
from __future__ import annotations

import json
import sqlite3
from typing import Any

from fastapi import APIRouter, Depends
from pydantic import BaseModel, ConfigDict

from ..audit import audit
from ..auth import current_principal, get_conn
from ..db import get_setting, set_setting
from ..errors import ApiError
from ..rbac import INSTALLATION, Principal, require
from ..services import home_screen_options, popup_layout

router = APIRouter()


class LayoutBody(BaseModel):
    model_config = ConfigDict(extra="forbid")
    version: int
    layout: dict[str, Any] | None = None
    force: bool = False
    popup_alert: str | None = None


def _save(conn: sqlite3.Connection, principal: Principal, body: LayoutBody, area_id: str | None) -> dict[str, Any]:
    opts = home_screen_options.stored(get_setting(conn, "home.screen", ""))
    before = opts["popup"]
    try:
        after = popup_layout.save(before, area_id=area_id, layout=body.layout, version=body.version, force=body.force)
        alert = opts["popup_alert"]
        if body.popup_alert is not None:
            alert = home_screen_options.normalize({"popup_alert": body.popup_alert}, opts)["popup_alert"]
    except popup_layout.Conflict:
        raise ApiError(409, "version_conflict", "מישהו אחר שינה את החלון. לטעון מחדש או לדרוס?", details={"version": before["version"]})
    except ValueError as exc:
        raise ApiError(422, "validation", "תצוגת חלון האזור: ערך לא תקין.", details={"popup": str(exc)})
    opts["popup"], opts["popup_alert"] = after, alert
    set_setting(conn, "home.screen", json.dumps(opts, ensure_ascii=False, separators=(",", ":")))
    key = after["site"] if area_id is None else after["areas"].get(area_id)
    old = before["site"] if area_id is None else before["areas"].get(area_id)
    audit(conn, actor=principal, action="devices.popup_layout.save", decision="allowed", resource_type="area" if area_id else "installation",
          resource_id=area_id or "*", details={"scope": "area" if area_id else "site", "reset": key is None, "forced": body.force and body.version != before["version"],
                                              "hidden_sections": (key or {}).get("hidden", []), "hidden_items": sum(len(v["hidden"]) for v in (key or {}).get("items", {}).values()),
                                              "was_set": old is not None, "version": after["version"], "popup_alert": alert})
    return {"popup": after, "popup_alert": alert}


@router.put("/devices/popup-layout")
def put_site_layout(body: LayoutBody, principal: Principal = Depends(current_principal), conn: sqlite3.Connection = Depends(get_conn)) -> dict[str, Any]:
    require(conn, principal, "system.configure", INSTALLATION)
    out = _save(conn, principal, body, None)
    out["affected_areas"] = popup_layout.affected_areas(conn, out["popup"])
    return out


@router.put("/devices/areas/{area_id}/popup-layout")
def put_area_layout(area_id: str, body: LayoutBody, principal: Principal = Depends(current_principal), conn: sqlite3.Connection = Depends(get_conn)) -> dict[str, Any]:
    row = conn.execute("SELECT floor_id FROM ha_areas WHERE area_id = ?", (area_id,)).fetchone()
    if row is None:
        raise ApiError(404, "not_found", "האזור לא נמצא.")
    require(conn, principal, "system.configure", ("floor", row["floor_id"]) if row["floor_id"] else INSTALLATION)
    if body.popup_alert is not None:  # the alert switch is an installation choice: not through an area save
        require(conn, principal, "system.configure", INSTALLATION)
    return _save(conn, principal, body, area_id)
