"""The Frigate control API, phase F2 "control and act" (NN5, docs/changes/CR-029-FRIGATE-PROVIDER.md). The only routes that WRITE to Frigate.

Everything is under `/frigate/{recorder_id}` like the F1 routes and answers only for a recorder whose vendor is `frigate`. The model of
a write (permission, class approval, per-action confirmation, read before, one write, read after, change-log row, undo) lives in
`services/frigate_control_svc.py`; this module is the HTTP skin and the permission map:

- camera switches: analytics (`analytics.control`) and recording (`analytics.record_control`, per-action confirmation) on ONE camera;
- profile switch (`analytics.profile`, per-action confirmation) and the alarm-state -> profile mapping (system.configure, a mapping only);
- event actions: retain flag and sub-label correction (`analytics.events`, row-scoped by the event's camera);
- PTZ step (`camera.ptz`, per-action, a lease, released by a code flag that is OFF);
- the class policy (system.configure) and the change log with undo.
Marking a review item reviewed is in `routers/frigate.py` (Arx first, then the optional mirror)."""
from __future__ import annotations

import sqlite3
from typing import Any

from fastapi import APIRouter, Depends, Query, Request
from pydantic import BaseModel, ConfigDict, Field

from ..auth import current_principal, current_principal_ro, get_conn, get_read_conn, settings_of
from ..errors import ApiError
from ..rbac import INSTALLATION, Principal, authorize, permissions_anywhere, require
from ..services import frigate_control_svc as svc
from ..services.access import camera_allowed, require_camera
from ..services.recorders import frigate_control as fc
from ..services.recorders import frigate_io
from ..services.recorders.frigate import FrigateAdapter
from .frigate import _camera_row
from .recorders import PERMISSION

router = APIRouter()


def _adapter(conn: sqlite3.Connection, request: Request, rid: str) -> FrigateAdapter:
    return frigate_io.adapter_for(conn, settings_of(request), rid)


def _rq(request: Request) -> str | None:
    return getattr(request.state, "correlation_id", None)


def _may_see(conn: sqlite3.Connection, principal: Principal) -> None:
    """The control screens' read gate: the recorder administrator, or anyone holding one of the control permissions somewhere."""
    have = set(permissions_anywhere(conn, principal))
    if PERMISSION in have or have & svc.CONTROL_PERMISSIONS:
        return
    require(conn, principal, PERMISSION, INSTALLATION)  # the audited 403


class SwitchIn(BaseModel):
    model_config = ConfigDict(extra="forbid")
    value: bool
    confirm: bool = False


class PolicyIn(BaseModel):
    model_config = ConfigDict(extra="forbid")
    classes: dict[str, bool] = Field(min_length=1, max_length=len(svc.CLASSES))


class ProfileIn(BaseModel):
    model_config = ConfigDict(extra="forbid")
    profile: str | None = Field(default=None, max_length=40)
    confirm: bool = False


class RulesIn(BaseModel):
    model_config = ConfigDict(extra="forbid")
    rules: dict[str, str | None] = Field(max_length=len(svc.ALARM_STATES))


class RetainIn(BaseModel):
    model_config = ConfigDict(extra="forbid")
    retain: bool


class SubLabelIn(BaseModel):
    model_config = ConfigDict(extra="forbid")
    sub_label: str | None = Field(default=None, max_length=fc.SUB_LABEL_MAX)


class PtzIn(BaseModel):
    model_config = ConfigDict(extra="forbid")
    command: str = Field(min_length=1, max_length=48)
    confirm: bool = False


class RevertIn(BaseModel):
    model_config = ConfigDict(extra="forbid")
    confirm: bool = False
    supervised: bool = False   # F2b: the first undo of a new kind is a first write of that kind


# ---------------------------------------------------------------------------------------------- class policy

@router.get("/frigate/{recorder_id}/control/policy")
def get_policy(recorder_id: str, request: Request, principal: Principal = Depends(current_principal_ro), conn: sqlite3.Connection = Depends(get_read_conn)) -> dict[str, Any]:
    """Which write classes are on for this recorder, which need a confirmation per action, and whether PTZ is released."""
    _adapter(conn, request, recorder_id)
    _may_see(conn, principal)
    pol = svc.policy(conn, recorder_id)
    return {"recorder_id": recorder_id, "classes": [{"class": c, "enabled": pol[c], "per_action": c in svc.PER_ACTION, "permission": svc.PERMISSION[c],
                                                   "available": c != "ptz" or svc.PTZ_RELEASED,
                                                   "confirm_actions": ["delete"] if c in ("exports", "cases") else []} for c in svc.CLASSES],
            "ptz_released": svc.PTZ_RELEASED}


@router.put("/frigate/{recorder_id}/control/policy")
def put_policy(recorder_id: str, body: PolicyIn, request: Request, principal: Principal = Depends(current_principal), conn: sqlite3.Connection = Depends(get_conn)) -> dict[str, Any]:
    """Switch write classes on or off for the recorder (system.configure). All off by default; `ptz` cannot be switched on while unreleased."""
    require(conn, principal, PERMISSION, INSTALLATION)
    _adapter(conn, request, recorder_id)
    after = svc.set_policy(conn, principal, recorder_id, body.classes, _rq(request))
    return {"recorder_id": recorder_id, "policy": after}


# ---------------------------------------------------------------------------------------------- camera switches

def _writable(conn: sqlite3.Connection, principal: Principal, rid: str, camera_id: str) -> dict[str, bool]:
    pol = svc.policy(conn, rid)
    return {c: bool(pol[c] and camera_allowed(conn, principal, camera_id, svc.PERMISSION[c]) and (c != "ptz" or svc.PTZ_RELEASED)) for c in ("analytics", "record", "ptz")}


@router.get("/frigate/{recorder_id}/cameras/{camera_id}/control")
def camera_control(recorder_id: str, camera_id: str, request: Request, principal: Principal = Depends(current_principal_ro), conn: sqlite3.Connection = Depends(get_read_conn)) -> dict[str, Any]:
    """The camera's runtime switches as Frigate shows them now, grouped (`analytics` / `record`), and which groups THIS caller may change
    now (permission on the camera AND the class switched on). A read: nothing is written to Frigate."""
    cam = _camera_row(conn, principal, recorder_id, camera_id, "video.live")
    a = _adapter(conn, request, recorder_id)
    state = svc.camera_state(a, cam["source_ref"])
    return {"recorder_id": recorder_id, "camera_id": camera_id,
            "features": [{"feature": f, "class": fc.FEATURE_CLASS[f], "value": state.get(f)} for f in list(fc.FEATURE_CLASS)],
            "writable": _writable(conn, principal, recorder_id, camera_id)}


@router.put("/frigate/{recorder_id}/cameras/{camera_id}/control/{feature}")
def set_feature(recorder_id: str, camera_id: str, feature: str, body: SwitchIn, request: Request, principal: Principal = Depends(current_principal),
                conn: sqlite3.Connection = Depends(get_conn)) -> dict[str, Any]:
    """Switch ONE feature of ONE camera (never all cameras). Recording-affecting features (`enabled`, `recordings`, `snapshots`) need
    `confirm: true`; footage is not kept while recording is off."""
    fc.feature_class(feature)
    row = conn.execute("SELECT * FROM cameras WHERE id = ? AND recorder_id = ?", (camera_id, recorder_id)).fetchone()
    cls = fc.feature_class(feature)
    require_camera(conn, principal, camera_id, svc.PERMISSION[cls])  # 403 before 404
    if row is None:
        raise ApiError(404, "not_found", "המצלמה לא נמצאה.")
    if not row["source_ref"]:
        raise ApiError(409, "camera_not_mapped", "למצלמה אין מפתח ב־Frigate; הריצו גילוי מחדש.")
    a = _adapter(conn, request, recorder_id)
    out = svc.set_feature(conn, principal, a, row, feature, body.value, confirm=body.confirm, request_id=_rq(request))
    return {"recorder_id": recorder_id, "camera_id": camera_id, **out}


# ---------------------------------------------------------------------------------------------- profiles

@router.get("/frigate/{recorder_id}/profiles")
def profiles(recorder_id: str, request: Request, principal: Principal = Depends(current_principal_ro), conn: sqlite3.Connection = Depends(get_read_conn)) -> dict[str, Any]:
    _adapter(conn, request, recorder_id)
    _may_see(conn, principal)
    a = _adapter(conn, request, recorder_id)
    state = svc.profile_view(a)
    pol = svc.policy(conn, recorder_id)
    return {"recorder_id": recorder_id, **state, "rules": svc.rules(conn, recorder_id), "alarm_states": list(svc.ALARM_STATES),
            "can_switch": bool(pol["profile"] and authorize(conn, principal, svc.PERMISSION["profile"], INSTALLATION).allowed)}


@router.put("/frigate/{recorder_id}/profile")
def put_profile(recorder_id: str, body: ProfileIn, request: Request, principal: Principal = Depends(current_principal), conn: sqlite3.Connection = Depends(get_conn)) -> dict[str, Any]:
    """Switch Frigate's active profile (per-action: `confirm: true`; Frigate clears its runtime toggles on a switch). `profile: null` = none."""
    a = _adapter(conn, request, recorder_id)
    require(conn, principal, svc.PERMISSION["profile"], INSTALLATION)
    return {"recorder_id": recorder_id, **svc.set_profile(conn, principal, a, body.profile, confirm=body.confirm, request_id=_rq(request))}


@router.put("/frigate/{recorder_id}/profile-rules")
def put_rules(recorder_id: str, body: RulesIn, request: Request, principal: Principal = Depends(current_principal), conn: sqlite3.Connection = Depends(get_conn)) -> dict[str, Any]:
    """Which profile an alarm state suggests (system.configure). A mapping only: nothing is switched by it."""
    require(conn, principal, PERMISSION, INSTALLATION)
    _adapter(conn, request, recorder_id)
    return {"recorder_id": recorder_id, "rules": svc.set_rules(conn, principal, recorder_id, body.rules, _rq(request))}


@router.get("/frigate/{recorder_id}/profile-suggestion")
def profile_suggestion(recorder_id: str, request: Request, alarm_state: str = Query(..., max_length=30), principal: Principal = Depends(current_principal_ro),
                       conn: sqlite3.Connection = Depends(get_read_conn)) -> dict[str, Any]:
    """The profile the stored mapping suggests for an alarm state (null when none). Read only: applying it is `PUT .../profile`."""
    _adapter(conn, request, recorder_id)
    _may_see(conn, principal)
    return {"recorder_id": recorder_id, "alarm_state": alarm_state, "profile": svc.rules(conn, recorder_id).get(alarm_state)}


# ---------------------------------------------------------------------------------------------- event actions

@router.get("/frigate/{recorder_id}/events/{event_id}/control")
def event_control(recorder_id: str, event_id: str, request: Request, principal: Principal = Depends(current_principal_ro), conn: sqlite3.Connection = Depends(get_read_conn)) -> dict[str, Any]:
    """What the review screen needs to draw the event controls: whether THIS caller may change the event now (permission on its camera
    AND the `events` class switched on) and, only then, the event's current retain flag and sub-label as Frigate shows them. A read:
    nothing is written to Frigate; a caller who may not change anything gets `writable: false` and no Frigate call is made."""
    a = _adapter(conn, request, recorder_id)
    scope = svc._event_scope(conn, principal, recorder_id, event_id)
    perm = svc.PERMISSION["events"]
    allowed = camera_allowed(conn, principal, scope["camera_id"], perm) if scope["camera_id"] else authorize(conn, principal, perm, INSTALLATION).allowed
    if not (allowed and svc.policy(conn, recorder_id)["events"]):
        return {"recorder_id": recorder_id, "event_id": event_id, "writable": False}
    return {"recorder_id": recorder_id, "event_id": event_id, "writable": True, **{k: v for k, v in fc.FrigateControl(a).event(event_id).items() if k != "id"}}


@router.post("/frigate/{recorder_id}/events/{event_id}/retain")
def event_retain(recorder_id: str, event_id: str, body: RetainIn, request: Request, principal: Principal = Depends(current_principal), conn: sqlite3.Connection = Depends(get_conn)) -> dict[str, Any]:
    """Keep (or stop keeping) the footage of a tracked object past the normal retention. The event must belong to a review item the caller can see."""
    a = _adapter(conn, request, recorder_id)
    return {"recorder_id": recorder_id, **svc.set_retain(conn, principal, a, event_id, body.retain, request_id=_rq(request))}


@router.post("/frigate/{recorder_id}/events/{event_id}/sub-label")
def event_sub_label(recorder_id: str, event_id: str, body: SubLabelIn, request: Request, principal: Principal = Depends(current_principal), conn: sqlite3.Connection = Depends(get_conn)) -> dict[str, Any]:
    a = _adapter(conn, request, recorder_id)
    return {"recorder_id": recorder_id, **svc.set_sub_label(conn, principal, a, event_id, body.sub_label, request_id=_rq(request))}


# ---------------------------------------------------------------------------------------------- PTZ (disabled by a code flag)

@router.get("/frigate/{recorder_id}/cameras/{camera_id}/ptz")
def ptz_get(recorder_id: str, camera_id: str, request: Request, principal: Principal = Depends(current_principal_ro), conn: sqlite3.Connection = Depends(get_read_conn)) -> dict[str, Any]:
    cam = _camera_row(conn, principal, recorder_id, camera_id, svc.PERMISSION["ptz"])
    a = _adapter(conn, request, recorder_id)
    return {"recorder_id": recorder_id, "camera_id": camera_id, **svc.ptz_status(conn, a, cam)}


@router.post("/frigate/{recorder_id}/cameras/{camera_id}/ptz")
def ptz_post(recorder_id: str, camera_id: str, body: PtzIn, request: Request, principal: Principal = Depends(current_principal), conn: sqlite3.Connection = Depends(get_conn)) -> dict[str, Any]:
    """ONE PTZ step (move, zoom, stop, or a saved position). Answers 409 `frigate_ptz_disabled` while PTZ is not released."""
    cam = _camera_row(conn, principal, recorder_id, camera_id, svc.PERMISSION["ptz"])
    a = _adapter(conn, request, recorder_id)
    return {"recorder_id": recorder_id, "camera_id": camera_id, **svc.ptz_step(conn, principal, a, cam, body.command, confirm=body.confirm, request_id=_rq(request))}


# ---------------------------------------------------------------------------------------------- the change log

@router.get("/frigate/{recorder_id}/changes")
def list_changes(recorder_id: str, request: Request, limit: int = Query(50, ge=1, le=200), principal: Principal = Depends(current_principal_ro),
                 conn: sqlite3.Connection = Depends(get_read_conn)) -> dict[str, Any]:
    """What Arx changed on this Frigate, newest first, with the state before and after. Camera rows only for cameras the caller may see."""
    _adapter(conn, request, recorder_id)
    _may_see(conn, principal)
    # security review 2.2.0 L9: the installation-wide rows (profile switches: no camera) only for the recorder
    # administrator or a holder of the profile permission - not for anyone with some control permission somewhere
    installation_ok = any(authorize(conn, principal, p, INSTALLATION).allowed for p in (PERMISSION, svc.PERMISSION["profile"]))
    rows = svc.changes(conn, recorder_id, limit=limit, camera_ok=lambda cid: camera_allowed(conn, principal, cid, "video.live"), installation_ok=installation_ok)
    return {"recorder_id": recorder_id, "changes": rows}


@router.post("/frigate/{recorder_id}/changes/{change_id}/revert")
def revert_change(recorder_id: str, change_id: str, body: RevertIn, request: Request, principal: Principal = Depends(current_principal), conn: sqlite3.Connection = Depends(get_conn)) -> dict[str, Any]:
    """Undo one logged change (same class, permission and confirmation rules as making it; 409 `frigate_change_stale` when Frigate moved since)."""
    a = _adapter(conn, request, recorder_id)
    return {"recorder_id": recorder_id, **svc.revert(conn, principal, a, change_id, confirm=body.confirm, request_id=_rq(request), supervised=body.supervised)}
