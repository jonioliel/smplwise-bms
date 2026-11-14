"""WISKEY-LIVE-VALIDATION-2390 (WisKey plan T16): the API of the station acceptance tool, הגדרות › "בדיקת קבלה לעמדות"
(services/wiskey_live_validation.py decides and runs everything; this file gates, validates and audits).

- GET  /wiskey-validation                         the stations the caller may validate, the checks, the recent runs, the active run, rights
- POST /wiskey-validation/runs                    {station_id} or {all: true}: start ONE read-only run (202); refused while a run is active
- GET  /wiskey-validation/runs/{run_id}           a run with its per-station checks, progress and pulses (the screen polls it)
- POST /wiskey-validation/runs/{run_id}/cancel    stop between checks; the rest is `not_run` (cancelled)
- GET  /wiskey-validation/runs/{run_id}/export.csv  the installer's acceptance record (audited)
- POST /wiskey-validation/pulse                   {station_id, door, confirm_text, witness_name, parent_run_id}: ONE door pulse
- POST /wiskey-validation/pulse/{run_id}/witness  {verdict: opened | not_opened | unsure}

Gate of every endpoint: `access.stations.manage` somewhere a station can be (an audited 403 otherwise); a station counts only with
`access.read` AND `access.stations.manage` on its chain. The pulse is a PHYSICAL action: a system administrator, on a local session
(never through the remote tunnel), with `access.doors.open` on the station, after typing the station's name, with a witness's name, at
most once per station per check run, never part of "run all". Every run, cancel, export, pulse, verdict and refusal is audited.
Nothing runs by itself: there is no timer and no start-up hook (a run cut by a restart is closed as `interrupted`, never resumed)."""
from __future__ import annotations

import sqlite3
from typing import Any

from fastapi import APIRouter, Depends, Path, Request
from fastapi.responses import Response
from pydantic import BaseModel, ConfigDict, Field

from ..audit import audit
from ..auth import current_principal_ro, get_read_conn, settings_of
from ..errors import ApiError, forbidden
from ..rbac import Principal, is_system_admin
from ..services import intercom_authority as ia
from ..services import wiskey_live_validation as lv

router = APIRouter()
RUN_ID = r"^lv_[0-9a-f]{32}$"
STATION_ID = r"^[A-Za-z0-9][A-Za-z0-9_.:-]{0,127}$"
REMOTE_SOURCES = ("remote", "local")  # the remote channel (an Arx session or an Arx-only identity): no physical action from there


def _rid(request: Request) -> str | None:
    return getattr(request.state, "correlation_id", None)


def _gate(request: Request, principal: Principal = Depends(current_principal_ro), conn: sqlite3.Connection = Depends(get_read_conn)) -> ia.Authority:
    return ia.require_anywhere(conn, principal, ia.STATIONS_MANAGE, _rid(request))


def _may(auth: ia.Authority, station_id: str) -> bool:
    return auth.station(ia.READ, station_id) and auth.station(ia.STATIONS_MANAGE, station_id)


def _served(request: Request) -> tuple[str, list[dict[str, Any]]]:
    from ..services import intercom_sync

    state, overview = intercom_sync.SYNC.served(settings_of(request))
    return state, list((overview or {}).get("stations") or [])


def _error(exc: lv.ValidationError) -> ApiError:
    text = {"run_in_progress": "בדיקה אחרת רצה כרגע. המתינו לסיומה.", "no_stations": "אין עמדות לבדיקה.", "not_found": "הבדיקה לא נמצאה.",
            "witness_not_expected": "אין פתיחת דלת שממתינה לאישור עד.", "invalid_verdict": "תשובת העד אינה תקינה."}.get(exc.code, exc.text or exc.code)
    return ApiError(exc.status, exc.code, text)


def _db(request: Request) -> Any:
    return request.app.state.db


# ---------------------------------------------------------------- the page

@router.get("/wiskey-validation")
def overview(request: Request, auth: ia.Authority = Depends(_gate)) -> dict[str, Any]:
    conn = auth.conn
    lv.reconcile_db(_db(request))
    feed_state, served = _served(request)
    admin = is_system_admin(conn, auth.principal.user_id)
    local = auth.principal.source not in REMOTE_SOURCES
    stations = []
    for s in served:
        sid = str(s.get("id") or "")
        if not sid or not _may(auth, sid):
            continue
        names = {int(lock["physical_index"]): lock.get("name") for lock in s.get("locks") or [] if isinstance(lock, dict) and isinstance(lock.get("physical_index"), int)}
        doors = [{"door": d.physical_relay, "name": names.get(d.physical_relay)} for d in lv.mapped_doors(conn, sid)]
        stations.append({"id": sid, "name": s.get("name") or "", "online": bool(s.get("online")), "doors": doors,
                         "can_pulse": admin and local and bool(doors) and auth.station(ia.DOORS_OPEN, sid)})
    return {
        "feed_state": feed_state,
        "stations": stations,
        "checks": [{"key": c, "label": lv.CHECK_TEXT[c]} for c in lv.CHECKS],
        "runs": lv.list_runs(conn),
        "active_run_id": lv.active_run(),
        "rights": {"run": True, "pulse": admin, "pulse_local": local},
    }


# ---------------------------------------------------------------- read-only runs

class RunBody(BaseModel):
    model_config = ConfigDict(extra="forbid")
    station_id: str | None = Field(None, pattern=STATION_ID)
    all: bool = False


@router.post("/wiskey-validation/runs", status_code=202)
def start(request: Request, body: RunBody, auth: ia.Authority = Depends(_gate)) -> dict[str, Any]:
    if body.all == (body.station_id is not None):
        raise ApiError(422, "validation", "בחרו עמדה אחת או את כל העמדות.", details={"fields": ["station_id", "all"]})
    feed_state, served = _served(request)
    visible = [s for s in served if s.get("id") and _may(auth, str(s["id"]))]
    if body.station_id is not None:
        visible = [s for s in visible if str(s["id"]) == body.station_id]
        if not visible:
            raise ApiError(404, "intercom_station_not_found", "העמדה לא נמצאה.")
    if not visible:
        raise ApiError(409, "no_stations", "אין עמדות לבדיקה." if feed_state == "ready" else "נתוני העמדות אינם זמינים כרגע.", details={"feed_state": feed_state})
    db = _db(request)
    lv.reconcile_db(db)
    try:
        run_id = lv.start_run(db, settings_of(request), auth.principal, visible, scope="all" if body.all else "one")
    except lv.ValidationError as exc:
        audit(auth.conn, actor=auth.principal, action="wiskey.validation.run", decision="denied", resource_type="wiskey_validation_run",
              resource_id=body.station_id or "*", reason=exc.code, request_id=_rid(request))
        raise _error(exc) from None
    audit(auth.conn, actor=auth.principal, action="wiskey.validation.run", decision="allowed", resource_type="wiskey_validation_run", resource_id=run_id,
          request_id=_rid(request), details={"scope": "all" if body.all else "one", "stations": [str(s["id"]) for s in visible][:64]})
    return {"run_id": run_id}


def _view(auth: ia.Authority, run_id: str) -> dict[str, Any]:
    view = lv.run_view(auth.conn, run_id, visible=lambda sid: _may(auth, sid))
    if view is None or view["kind"] != "checks" or (not view["stations"] and view["station_count"]):
        raise ApiError(404, "not_found", "הבדיקה לא נמצאה.")
    return view


@router.get("/wiskey-validation/runs/{run_id}")
def run(request: Request, auth: ia.Authority = Depends(_gate), run_id: str = Path(pattern=RUN_ID)) -> dict[str, Any]:
    lv.reconcile_db(_db(request))
    return _view(auth, run_id)


@router.post("/wiskey-validation/runs/{run_id}/cancel")
def cancel(request: Request, auth: ia.Authority = Depends(_gate), run_id: str = Path(pattern=RUN_ID)) -> dict[str, Any]:
    _view(auth, run_id)
    with _db(request).connection(label="wiskey validation cancel") as conn:
        ok = lv.request_cancel(conn, run_id)
    audit(auth.conn, actor=auth.principal, action="wiskey.validation.cancel", decision="allowed" if ok else "denied", resource_type="wiskey_validation_run",
          resource_id=run_id, reason=None if ok else "not_running", request_id=_rid(request))
    return {"run_id": run_id, "cancel_requested": ok}


@router.get("/wiskey-validation/runs/{run_id}/export.csv")
def export(request: Request, auth: ia.Authority = Depends(_gate), run_id: str = Path(pattern=RUN_ID)) -> Response:
    view = _view(auth, run_id)
    audit(auth.conn, actor=auth.principal, action="wiskey.validation.export", decision="allowed", resource_type="wiskey_validation_run", resource_id=run_id,
          request_id=_rid(request), details={"format": "csv", "stations": len(view["stations"])})
    return Response(lv.export_csv(view), media_type="text/csv; charset=utf-8",
                    headers={"Content-Disposition": f'attachment; filename="arx-station-acceptance-{run_id[-8:]}.csv"', "Cache-Control": "private, no-store"})


# ---------------------------------------------------------------- the door pulse (physical)

class PulseBody(BaseModel):
    model_config = ConfigDict(extra="forbid")
    station_id: str = Field(pattern=STATION_ID)
    door: int = Field(ge=1, le=2)
    confirm_text: str = Field(min_length=1, max_length=200)
    witness_name: str = Field(min_length=2, max_length=80)
    parent_run_id: str | None = Field(None, pattern=RUN_ID)


def _refuse(auth: ia.Authority, request: Request, station_id: str, reason: str, status: int, code: str, text: str) -> ApiError:
    audit(auth.conn, actor=auth.principal, action="wiskey.validation.pulse", decision="denied", resource_type="intercom_station", resource_id=station_id,
          reason=reason, request_id=_rid(request))
    return ApiError(status, code, text)


@router.post("/wiskey-validation/pulse")
def pulse(request: Request, body: PulseBody, auth: ia.Authority = Depends(_gate)) -> dict[str, Any]:
    sid = body.station_id
    if not is_system_admin(auth.conn, auth.principal.user_id):
        audit(auth.conn, actor=auth.principal, action="wiskey.validation.pulse", decision="denied", resource_type="intercom_station", resource_id=sid,
              reason="not_system_admin", request_id=_rid(request))
        raise forbidden("פתיחת דלת בבדיקת קבלה מותרת למנהל מערכת בלבד.", permission="system_admin", target_type="intercom_station", target_id=sid)
    if auth.principal.source in REMOTE_SOURCES:
        raise _refuse(auth, request, sid, "remote_session", 403, "local_only", "פתיחת דלת בבדיקת קבלה אפשרית רק מחיבור מקומי, לא דרך הגישה מרחוק.")
    _state, served = _served(request)
    station = next((s for s in served if str(s.get("id")) == sid), None)
    if station is None or not _may(auth, sid):
        raise ApiError(404, "intercom_station_not_found", "העמדה לא נמצאה.")
    if not auth.station(ia.DOORS_OPEN, sid):
        raise _refuse(auth, request, sid, "no_door_permission", 403, "forbidden", "אין לך הרשאה לפתוח דלתות בעמדה הזו.")
    expected = (station.get("name") or sid).strip()
    if body.confirm_text.strip() != expected:
        raise _refuse(auth, request, sid, "confirmation_mismatch", 422, "confirmation_mismatch", "שם העמדה שהוקלד אינו תואם. הקלידו את שם העמדה בדיוק כפי שהוא מופיע.")
    if not body.witness_name.strip() or any(ord(c) < 32 for c in body.witness_name):
        raise ApiError(422, "validation", "יש לרשום את שם העד.", details={"fields": ["witness_name"]})
    if body.parent_run_id is not None:
        parent = lv.run_view(auth.conn, body.parent_run_id, visible=lambda x: _may(auth, x))
        if parent is None or parent["kind"] != "checks":
            raise ApiError(404, "not_found", "הבדיקה לא נמצאה.")
        if lv.pulse_done_for(auth.conn, body.parent_run_id, sid):
            raise _refuse(auth, request, sid, "pulse_already_done", 409, "pulse_already_done", "בבדיקה הזו כבר נעשה ניסיון פתיחה לעמדה הזו. ניסיון נוסף - בבדיקה חדשה.")
    # the attempt is audited BEFORE anything is sent
    audit(auth.conn, actor=auth.principal, action="wiskey.validation.pulse", decision="allowed", resource_type="intercom_station", resource_id=sid,
          request_id=_rid(request), details={"door": body.door, "parent_run_id": body.parent_run_id, "witness": "named"})
    db = _db(request)
    try:
        run_id = lv.run_pulse(db, auth.principal, station=station, door=body.door, witness_name=body.witness_name.strip(), parent_run_id=body.parent_run_id)
    except lv.ValidationError as exc:
        raise _error(exc) from None
    with db.connection(mode="read", label="wiskey validation pulse view") as conn:
        view = lv.run_view(conn, run_id) or {}
    result = (view.get("stations") or [{}])[0].get("checks", [{}])[0] if view.get("stations") else {}
    audit(auth.conn, actor=auth.principal, action="wiskey.validation.pulse.result", decision="allowed", resource_type="wiskey_validation_run", resource_id=run_id,
          request_id=_rid(request), details={"station": sid, "door": body.door, "status": result.get("status"), "reason": result.get("reason")})
    return {"run_id": run_id, "result": result}


class WitnessBody(BaseModel):
    model_config = ConfigDict(extra="forbid")
    verdict: str = Field(pattern=r"^(opened|not_opened|unsure)$")
    witness_name: str | None = Field(None, min_length=2, max_length=80)


@router.post("/wiskey-validation/pulse/{run_id}/witness")
def witness(request: Request, body: WitnessBody, auth: ia.Authority = Depends(_gate), run_id: str = Path(pattern=RUN_ID)) -> dict[str, Any]:
    if not is_system_admin(auth.conn, auth.principal.user_id):
        raise forbidden("אישור העד נרשם על ידי מנהל מערכת.", permission="system_admin")
    view = lv.run_view(auth.conn, run_id, visible=lambda x: _may(auth, x))
    if view is None or view["kind"] != "pulse" or not view["stations"]:
        raise ApiError(404, "not_found", "הבדיקה לא נמצאה.")
    try:
        with _db(request).connection(label="wiskey validation witness") as conn:
            out = lv.record_witness(conn, run_id, body.verdict, body.witness_name)
    except lv.ValidationError as exc:
        raise _error(exc) from None
    audit(auth.conn, actor=auth.principal, action="wiskey.validation.witness", decision="allowed", resource_type="wiskey_validation_run", resource_id=run_id,
          request_id=_rid(request), details={"verdict": body.verdict, "status": out["status"]})
    return {"run_id": run_id, **out}
