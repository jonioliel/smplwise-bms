"""BUSTIMES-295 - הגדרות › תחבורה ציבורית: the installation's bus-times settings (module switch, up to 4 stops, general rules), the stop search
over the LOCAL catalogue, the catalogue status / manual refresh and the source health.

Permissions follow the notice board's settings: reading needs `system.configure` or `notices.boards` at installation scope (a board manager picks
among the configured stops for his screens); every write needs `system.configure`. A screen's own choices (show / which stops / layout / window /
rows / grouping / refresh / distance) are part of the board's display settings and are saved through `PATCH /notices/boards/{id}` (`notices.boards`). The routes
answer while the notice board module is off (the tab is configured first); the TV digest itself needs the board module (routers/notices.py)."""
from __future__ import annotations

import datetime as dt
import json
import sqlite3
import threading
from typing import Any

from fastapi import APIRouter, Depends, Query, Request
from pydantic import BaseModel, ConfigDict, Field

from ..audit import audit
from ..auth import current_principal, current_principal_ro, get_conn, get_read_conn
from ..db import get_setting, set_setting
from ..errors import ApiError
from ..rbac import INSTALLATION, Principal, authorize, require
from ..services.transit import catalogue, health, model, poller, stride

router = APIRouter()
NO_RIGHT = "אין הרשאה להגדרות תחבורה ציבורית."


def _rid(request: Request) -> str | None:
    return getattr(request.state, "correlation_id", None)


def _read(conn: sqlite3.Connection, principal: Principal) -> dict[str, bool]:
    can = {"configure": authorize(conn, principal, "system.configure", INSTALLATION).allowed,
           "boards": authorize(conn, principal, "notices.boards", INSTALLATION).allowed}
    if not (can["configure"] or can["boards"]):
        require(conn, principal, "system.configure", INSTALLATION)  # the audited 403
    return can


def _config(conn: sqlite3.Connection) -> dict[str, Any]:
    return model.load_config(get_setting(conn, model.CONFIG_KEY, ""))


def _fetch(request: Request) -> stride.Fetch:
    return getattr(request.app.state, "transit_fetch", None) or stride.http_fetch


def _limits() -> dict[str, Any]:
    return {"max_stops": model.MAX_STOPS, "windows": list(model.WINDOW_CHOICES), "window_range": list(model.WINDOW_RANGE), "rows_range": list(model.ROWS_RANGE),
            "dwell_range": list(model.DWELL_RANGE), "clock_after_range": list(model.CLOCK_AFTER_RANGE), "grace_range": list(model.GRACE_RANGE),
            "walk_range": list(model.WALK_RANGE), "outage_warn_range": list(model.OUTAGE_WARN_RANGE),
            "poll_range": list(model.POLL_RANGE), "poll_floor_s": model.POLL_FLOOR_S, "refresh_range": list(model.REFRESH_RANGE),
            "position_fresh_range": list(model.POSITION_FRESH_RANGE), "layouts": list(model.LAYOUTS), "groups": list(model.GROUPS)}


def _doc(conn: sqlite3.Connection, can: dict[str, bool]) -> dict[str, Any]:
    cfg = _config(conn)
    known = {s["code"]: catalogue.get(conn, s["code"]) for s in cfg["stops"]}
    stops = [{**s, "catalogue_name": (known[s["code"]] or {}).get("name"), "city": (known[s["code"]] or {}).get("city", "")} for s in cfg["stops"]]
    return {"config": {**cfg, "stops": stops}, "catalogue": catalogue.status(conn), "health": health.view(conn, dt.datetime.now(dt.timezone.utc)),
            "limits": _limits(), "can": can}


@router.get("/transit/settings")
def get_settings(principal: Principal = Depends(current_principal_ro), conn: sqlite3.Connection = Depends(get_read_conn)) -> dict[str, Any]:
    return _doc(conn, _read(conn, principal))


class StopIn(BaseModel):
    model_config = ConfigDict(extra="forbid")
    code: int = Field(ge=1, le=99_999_999)
    name: str = Field(default="", max_length=model.STOP_NAME_MAX)


class ConfigIn(BaseModel):
    model_config = ConfigDict(extra="forbid")
    enabled: bool | None = None
    stops: list[StopIn] | None = Field(default=None, max_length=model.MAX_STOPS)
    clock_after_min: int | None = None
    stale_grace_min: int | None = None
    hide_closer_min: int | None = None
    poll_s: int | None = None  # seconds between two polls of the public source (15-300; below 30 needs poll_floor_ack)
    poll_floor_ack: bool | None = None
    refresh_s: int | None = None  # the installation's default for how often a screen fetches the digest (10-120)
    position_fresh_min: int | None = None
    outage_warn_h: int | None = None  # BUSSTATUS-297: hours of a provider outage before the system health warns (1-72, default 6)
    show_distance: bool | None = None


@router.put("/transit/settings")
def put_settings(body: ConfigIn, request: Request, principal: Principal = Depends(current_principal), conn: sqlite3.Connection = Depends(get_conn)) -> dict[str, Any]:
    require(conn, principal, "system.configure", INSTALLATION)
    old = _config(conn)
    patch = body.model_dump(exclude_none=True)
    try:
        new = model.normalize_config({**old, **patch}, strict=True)
    except model.Invalid as exc:
        raise ApiError(422, "validation", str(exc), details={"field": exc.field})
    have = conn.execute("SELECT COUNT(*) FROM transit_stops").fetchone()[0] > 0
    for s in new["stops"]:  # a stop must exist in the local catalogue once there is one; its catalogue name is the default display name
        row = catalogue.get(conn, s["code"]) if have else None
        if have and row is None:
            raise ApiError(422, "validation", "קוד תחנה לא נמצא בקטלוג התחנות.", details={"field": "stops", "code": s["code"]})
        if not s["name"] and row:
            s["name"] = row["name"][: model.STOP_NAME_MAX]
    if new != old:
        set_setting(conn, model.CONFIG_KEY, json.dumps(new, ensure_ascii=False, separators=(",", ":")))
        changed = sorted(k for k in new if new[k] != old[k])
        action = "transit.module.enable" if new["enabled"] and not old["enabled"] else "transit.module.disable" if old["enabled"] and not new["enabled"] else "transit.settings.update"
        audit(conn, actor=principal, action=action, decision="allowed", resource_type="installation", resource_id="transit", request_id=_rid(request),
              details={"keys": changed, "stops": [s["code"] for s in new["stops"]]})
        poller.POLLER.kick()
    return _doc(conn, {"configure": True, "boards": authorize(conn, principal, "notices.boards", INSTALLATION).allowed})


@router.get("/transit/cities")
def get_cities(principal: Principal = Depends(current_principal_ro), conn: sqlite3.Connection = Depends(get_read_conn)) -> dict[str, Any]:
    _read(conn, principal)
    return {"cities": catalogue.cities(conn)}


@router.get("/transit/stops")
def search_stops(city: str = Query(default="", max_length=80), q: str = Query(default="", max_length=60), limit: int = Query(default=catalogue.SEARCH_MAX, ge=1, le=100),
                 principal: Principal = Depends(current_principal_ro), conn: sqlite3.Connection = Depends(get_read_conn)) -> dict[str, Any]:
    """The search runs on the LOCAL catalogue (city exact, name words, or a code) - no third-party call."""
    _read(conn, principal)
    return {"stops": catalogue.search(conn, city=city.strip(), q=q, limit=limit), "catalogue": catalogue.status(conn)}


@router.get("/transit/status")
def get_status(principal: Principal = Depends(current_principal_ro), conn: sqlite3.Connection = Depends(get_read_conn)) -> dict[str, Any]:
    _read(conn, principal)
    return {"health": health.view(conn, dt.datetime.now(dt.timezone.utc)), "catalogue": catalogue.status(conn)}


_REFRESH: dict[str, threading.Thread | None] = {"t": None}


@router.post("/transit/catalogue/refresh")
def refresh_catalogue(request: Request, principal: Principal = Depends(current_principal), conn: sqlite3.Connection = Depends(get_conn)) -> dict[str, Any]:
    """Download the catalogue now (the nightly job does it by itself). It runs in the background (about 6 MB); poll `/transit/status`."""
    require(conn, principal, "system.configure", INSTALLATION)
    t = _REFRESH["t"]
    if t is not None and t.is_alive():
        return {"started": False, "running": True}
    db = request.app.state.db
    fetch = _fetch(request)
    audit(conn, actor=principal, action="transit.catalogue.refresh", decision="allowed", resource_type="installation", resource_id="transit", request_id=_rid(request))
    t = threading.Thread(target=lambda: poller.catalogue_pass(db, fetch, dt.datetime.now(dt.timezone.utc), force=True), name="transit-catalogue", daemon=True)
    _REFRESH["t"] = t
    t.start()
    return {"started": True, "running": True}
