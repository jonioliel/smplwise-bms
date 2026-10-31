"""WISKEY-RELAYMAP-2310: the WisKey relay map approval (Settings › הגדרת מערכת › WisKey, next to "שיוך דלתות").

- `GET /wiskey/relay-map` - every station of the served WisKey copy (and any station that already has map rows) with its relays,
  its api relay -> physical relay rows, the station revision, who approved it last and when, and the physical relays a door
  automation names. System administrator (`system.configure`) may edit; `access.admin.read` sees the same page read-only
  (`can_edit: false`). Installation scope: the map is installation-wide configuration, like the door map (routers/doors.py).
- `PUT /wiskey/relay-map/{station_id}` - approve one station's full map, `system.configure` at installation scope, an explicit
  `confirmed: true`, CAS on `expected_revision` (stale -> 409 `revision_conflict`, nothing written), a typed `confirm_text` when a
  change touches a door with a door automation (422 `confirm_required`), audited `wiskey.relay_map.approved` (station, before / after,
  revisions, affected doors).

Nothing here is sent to WisKey, a station or a door: the map is the information WisKey grants are built from
(services/wiskey_feature_exec.py `relay_row`, `relay_row_for_door`)."""
from __future__ import annotations

import sqlite3
from typing import Any

from fastapi import APIRouter, Depends, Path, Request
from pydantic import BaseModel, Field, StrictInt

from ..audit import audit
from ..auth import current_principal, get_conn, settings_of
from ..errors import ApiError
from ..rbac import INSTALLATION, STATION, Principal, authorize, require
from ..services import intercom_doors, intercom_sync
from ..services import wiskey_relay_map as rm

router = APIRouter()

CONFIGURE = "system.configure"
READ = "access.admin.read"
MAX_ID = 128

MESSAGES = {
    "revision_conflict": (409, "המיפוי השתנה בינתיים. יש לרענן ולאשר מחדש."),
    "relay_map_invalid": (422, "המיפוי אינו תקין."),
    "relay_map_unknown_relay": (422, "לתחנה אין ממסר כזה."),
    "relay_map_duplicate_physical": (422, "כל ממסר פיזי יכול להיות משויך לממסר API אחד בלבד."),
    "relay_map_unchanged": (422, "לא היה שינוי במיפוי."),
    "confirm_required": (422, f"השינוי משפיע על דלת שיש לה אוטומציה. כדי לאשר יש להקליד \"{rm.CONFIRM_WORD}\"."),
}


def _rid(request: Request) -> str | None:
    return getattr(request.state, "correlation_id", None)


def _user_name(conn: sqlite3.Connection, user_id: str | None) -> str | None:
    if not user_id:
        return None
    r = conn.execute("SELECT display_name, username FROM users WHERE id = ?", (user_id,)).fetchone()
    return (r["display_name"] or r["username"]) if r else None


def _station_view(conn: sqlite3.Connection, station_id: str, s: dict[str, Any] | None) -> dict[str, Any]:
    current = rm.map_rows(conn, station_id)
    st = rm.station_state(conn, station_id)
    relays = [{"physical_index": int(lk["physical_index"]), "name": lk.get("name")} for lk in (s.get("locks") or [])] if s and s.get("lock_enabled") else []
    return {
        "id": station_id,
        "name": (s.get("name") if s else None) or "",
        "in_copy": s is not None,
        "online": bool(s.get("online")) if s else False,
        "relays": [r for r in relays if r["physical_index"] in rm.PHYSICAL_RELAYS],
        "revision": st["revision"],
        "approved_by": _user_name(conn, st["approved_by"]),
        "approved_at": st["approved_at"],
        "rows": [{"api_relay": a, "physical_relay": current[a].physical_relay if a in current and current[a].active else None,
                  "active": bool(a in current and current[a].active), "row_revision": current[a].revision if a in current else None,
                  "updated_at": current[a].updated_at if a in current else None} for a in rm.API_RELAYS],
        "automated_relays": rm.automated_doors(conn, station_id),
    }


@router.get("/wiskey/relay-map")
def relay_map(request: Request, principal: Principal = Depends(current_principal), conn: sqlite3.Connection = Depends(get_conn)) -> dict[str, Any]:
    """The WisKey relay map per station, with its revision and who approved it; read-only without system.configure."""
    can_edit = authorize(conn, principal, CONFIGURE, INSTALLATION).allowed
    if not can_edit:
        require(conn, principal, READ, INSTALLATION)
    state, overview = intercom_sync.SYNC.served(settings_of(request))
    stations = {s["id"]: s for s in intercom_sync.SYNC.stations()}
    ids = list(stations) + [sid for sid in rm.mapped_station_ids(conn) if sid not in stations]
    return {"state": state, "has_copy": overview is not None, "can_edit": can_edit, "confirm_word": rm.CONFIRM_WORD,
            "stations": [_station_view(conn, sid, stations.get(sid)) for sid in ids]}


class RowBody(BaseModel):
    api_relay: StrictInt
    physical_relay: StrictInt | None = None


class SaveBody(BaseModel):
    expected_revision: StrictInt = Field(ge=0)
    rows: list[RowBody] = Field(max_length=8)
    confirmed: Any = None
    confirm_text: str | None = Field(default=None, max_length=32)


@router.put("/wiskey/relay-map/{station_id}")
def approve_relay_map(body: SaveBody, request: Request, station_id: str = Path(min_length=1, max_length=MAX_ID), principal: Principal = Depends(current_principal),
                      conn: sqlite3.Connection = Depends(get_conn)) -> dict[str, Any]:
    """Approve one station's api relay -> physical relay map (CAS on the station revision; nothing is sent to a device)."""
    require(conn, principal, CONFIGURE, INSTALLATION)
    if body.confirmed is not True:
        raise ApiError(409, "confirmation_required", "השינוי דורש אישור מפורש.")
    if not intercom_sync.SYNC.has_copy():
        raise ApiError(503, "intercom_unavailable", "אין כרגע נתונים עדכניים ממערכת האינטרקום.")
    s = intercom_sync.SYNC.station(station_id)
    if s is None:
        raise ApiError(404, "intercom_station_not_found", "העמדה לא נמצאה.")
    wanted: dict[int, int | None] = {}
    for r in body.rows:
        if r.api_relay in wanted:
            raise ApiError(422, "relay_map_invalid", MESSAGES["relay_map_invalid"][1], details={"fields": ["rows"]})
        wanted[r.api_relay] = r.physical_relay
    try:
        res = rm.save(conn, station_id=station_id, rows=wanted, expected_revision=body.expected_revision, by=principal.user_id,
                      known_relays=intercom_doors.station_relays(s), confirm_text=body.confirm_text)
    except rm.RelayMapError as e:
        status, msg = MESSAGES.get(e.code, (422, "המיפוי אינו תקין."))
        audit(conn, actor=principal, action="wiskey.relay_map.approved", decision="denied", resource_type=STATION, resource_id=station_id,
              reason=e.code, request_id=_rid(request))
        raise ApiError(status, e.code, msg, details=e.details) from None
    audit(conn, actor=principal, action="wiskey.relay_map.approved", decision="allowed", resource_type=STATION, resource_id=station_id, request_id=_rid(request),
          details={"revision_before": res.revision_before, "revision": res.revision, "before": rm.as_list(res.before), "after": rm.as_list(res.after),
                   "affected_doors": res.affected, "automated_doors": res.automated})
    return {"revision": res.revision, "station": _station_view(conn, station_id, s)}
