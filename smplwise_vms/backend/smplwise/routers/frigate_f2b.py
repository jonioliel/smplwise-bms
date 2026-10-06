"""The Frigate F2b API (NN5, docs/changes/CR-029-FRIGATE-PROVIDER.md section 11): automatic profile switching on an alarm change, Frigate-native
exports and cases, manual events. Clean APIs only - the operator screens come later; the rules of a write (permission, class approval,
first supervised write, read back, change log, undo) live in `services/frigate_native_svc.py` and `services/frigate_auto_profile.py`.

Every write route takes `supervised` (bool, default false): the first write of each kind toward a recorder is refused until a system
administrator sends it with `supervised: true` (the wire shapes are unverified against a real Frigate). Nothing here is reachable while its
write class is off (the default)."""
from __future__ import annotations

import sqlite3
from typing import Any

from fastapi import APIRouter, Depends, Request
from pydantic import BaseModel, ConfigDict, Field

from ..auth import current_principal, current_principal_ro, get_conn, get_read_conn
from ..errors import ApiError
from ..rbac import INSTALLATION, Principal, permissions_anywhere, require
from ..services import frigate_auto_profile as auto
from ..services import frigate_control_svc as svc
from ..services import frigate_native_svc as native
from ..services.recorders import frigate_control as fc
from .frigate import _camera_row
from .frigate_control import _adapter, _may_see, _rq
from .recorders import PERMISSION

router = APIRouter()


class _In(BaseModel):
    model_config = ConfigDict(extra="forbid")


class AutoSettingIn(_In):
    mode: str | None = Field(default=None, max_length=10)
    auto_apply_consent: bool | None = None


class ApplyIn(_In):
    confirm: bool = False
    supervised: bool = False


class ExportIn(_In):
    camera_id: str = Field(min_length=1, max_length=64)
    start: float = Field(gt=0)
    end: float = Field(gt=0)
    name: str = Field(min_length=1, max_length=fc.NAME_MAX)
    supervised: bool = False


class RenameIn(_In):
    name: str = Field(min_length=1, max_length=fc.NAME_MAX)
    supervised: bool = False


class DeleteIn(_In):
    confirm: bool = False
    supervised: bool = False


class CaseIn(_In):
    name: str = Field(min_length=1, max_length=fc.NAME_MAX)
    description: str | None = Field(default=None, max_length=200)
    supervised: bool = False


class EventIn(_In):
    label: str = Field(min_length=1, max_length=40)
    duration_s: int | None = Field(default=30, ge=1, le=fc.EVENT_MAX_S)   # null = stays open until it is ended
    sub_label: str | None = Field(default=None, max_length=fc.SUB_LABEL_MAX)
    supervised: bool = False


class EndEventIn(_In):
    supervised: bool = False


def _see_native(conn: sqlite3.Connection, principal: Principal, *perms: str) -> None:
    have = set(permissions_anywhere(conn, principal))
    if PERMISSION in have or have & set(perms):
        return
    require(conn, principal, PERMISSION, INSTALLATION)  # the audited 403


# ---------------------------------------------------------------------------------------------- the first supervised write

@router.get("/frigate/{recorder_id}/control/first-writes")
def first_writes(recorder_id: str, request: Request, principal: Principal = Depends(current_principal_ro), conn: sqlite3.Connection = Depends(get_read_conn)) -> dict[str, Any]:
    """Which write kinds already had their first supervised write on this recorder (the wire shapes are unverified until then)."""
    _adapter(conn, request, recorder_id)
    _may_see(conn, principal)
    return {"recorder_id": recorder_id, **native.supervised_view(conn, principal, recorder_id)}


# ---------------------------------------------------------------------------------------------- automatic profile on an alarm change

@router.get("/frigate/{recorder_id}/profile-auto")
def profile_auto(recorder_id: str, request: Request, principal: Principal = Depends(current_principal_ro), conn: sqlite3.Connection = Depends(get_read_conn)) -> dict[str, Any]:
    """The recorder's automatic-profile setting and the recent alarm-change rows (open suggestions have status `suggested`)."""
    _adapter(conn, request, recorder_id)
    _may_see(conn, principal)
    return {"recorder_id": recorder_id, "setting": auto.get_setting(conn, recorder_id), "items": auto.items(conn, recorder_id), "modes": list(auto.MODES)}


@router.put("/frigate/{recorder_id}/profile-auto/setting")
def put_profile_auto(recorder_id: str, body: AutoSettingIn, request: Request, principal: Principal = Depends(current_principal), conn: sqlite3.Connection = Depends(get_conn)) -> dict[str, Any]:
    """off | suggest | apply, and the explicit auto-apply consent (system.configure). Default off; `apply` needs the consent."""
    require(conn, principal, PERMISSION, INSTALLATION)
    _adapter(conn, request, recorder_id)
    return {"recorder_id": recorder_id, "setting": auto.set_setting(conn, principal, recorder_id, body.mode, body.auto_apply_consent, _rq(request))}


@router.post("/frigate/{recorder_id}/profile-auto/{item_id}/apply")
def profile_auto_apply(recorder_id: str, item_id: str, body: ApplyIn, request: Request, principal: Principal = Depends(current_principal), conn: sqlite3.Connection = Depends(get_conn)) -> dict[str, Any]:
    """Apply an open suggestion with the normal confirmed profile write (`confirm: true`)."""
    a = _adapter(conn, request, recorder_id)
    return {"recorder_id": recorder_id, **auto.apply_suggestion(conn, principal, a, item_id, confirm=body.confirm, supervised=body.supervised, request_id=_rq(request))}


@router.post("/frigate/{recorder_id}/profile-auto/{item_id}/dismiss")
def profile_auto_dismiss(recorder_id: str, item_id: str, request: Request, principal: Principal = Depends(current_principal), conn: sqlite3.Connection = Depends(get_conn)) -> dict[str, Any]:
    _adapter(conn, request, recorder_id)
    return {"recorder_id": recorder_id, **auto.dismiss(conn, principal, recorder_id, item_id, _rq(request))}


# ---------------------------------------------------------------------------------------------- exports

@router.get("/frigate/{recorder_id}/exports")
def exports(recorder_id: str, request: Request, principal: Principal = Depends(current_principal_ro), conn: sqlite3.Connection = Depends(get_read_conn)) -> dict[str, Any]:
    """Frigate's exports for the cameras the caller may export; `arx_created` = Arx may rename / delete it."""
    a = _adapter(conn, request, recorder_id)
    _see_native(conn, principal, svc.PERMISSION["exports"])
    pol = svc.policy(conn, recorder_id)
    return {"recorder_id": recorder_id, "exports": native.list_exports(conn, principal, a), "enabled": pol["exports"]}


@router.post("/frigate/{recorder_id}/exports")
def export_create(recorder_id: str, body: ExportIn, request: Request, principal: Principal = Depends(current_principal), conn: sqlite3.Connection = Depends(get_conn)) -> dict[str, Any]:
    """Create a Frigate export of ONE camera and a bounded time range (at most two hours)."""
    cam = _camera_row(conn, principal, recorder_id, body.camera_id, svc.PERMISSION["exports"])
    a = _adapter(conn, request, recorder_id)
    return {"recorder_id": recorder_id, "camera_id": body.camera_id,
            **native.create_export(conn, principal, a, cam, body.start, body.end, body.name, supervised=body.supervised, request_id=_rq(request))}


@router.patch("/frigate/{recorder_id}/exports/{export_id}")
def export_rename(recorder_id: str, export_id: str, body: RenameIn, request: Request, principal: Principal = Depends(current_principal), conn: sqlite3.Connection = Depends(get_conn)) -> dict[str, Any]:
    a = _adapter(conn, request, recorder_id)
    return {"recorder_id": recorder_id, **native.rename_export(conn, principal, a, export_id, body.name, supervised=body.supervised, request_id=_rq(request))}


@router.post("/frigate/{recorder_id}/exports/{export_id}/delete")
def export_delete(recorder_id: str, export_id: str, body: DeleteIn, request: Request, principal: Principal = Depends(current_principal), conn: sqlite3.Connection = Depends(get_conn)) -> dict[str, Any]:
    """Delete an export Arx created (needs `confirm: true`; an export Frigate or someone else made is 409 `frigate_object_not_arx`)."""
    a = _adapter(conn, request, recorder_id)
    return {"recorder_id": recorder_id, **native.delete_export(conn, principal, a, export_id, confirm=body.confirm, supervised=body.supervised, request_id=_rq(request))}


# ---------------------------------------------------------------------------------------------- cases

@router.get("/frigate/{recorder_id}/cases")
def cases(recorder_id: str, request: Request, principal: Principal = Depends(current_principal_ro), conn: sqlite3.Connection = Depends(get_read_conn)) -> dict[str, Any]:
    a = _adapter(conn, request, recorder_id)
    _see_native(conn, principal, svc.PERMISSION["cases"])
    pol = svc.policy(conn, recorder_id)
    return {"recorder_id": recorder_id, "cases": native.list_cases(conn, principal, a), "enabled": pol["cases"]}


@router.post("/frigate/{recorder_id}/cases")
def case_create(recorder_id: str, body: CaseIn, request: Request, principal: Principal = Depends(current_principal), conn: sqlite3.Connection = Depends(get_conn)) -> dict[str, Any]:
    a = _adapter(conn, request, recorder_id)
    return {"recorder_id": recorder_id, **native.create_case(conn, principal, a, body.name, body.description, supervised=body.supervised, request_id=_rq(request))}


@router.patch("/frigate/{recorder_id}/cases/{case_id}")
def case_rename(recorder_id: str, case_id: str, body: RenameIn, request: Request, principal: Principal = Depends(current_principal), conn: sqlite3.Connection = Depends(get_conn)) -> dict[str, Any]:
    a = _adapter(conn, request, recorder_id)
    return {"recorder_id": recorder_id, **native.rename_case(conn, principal, a, case_id, body.name, supervised=body.supervised, request_id=_rq(request))}


@router.post("/frigate/{recorder_id}/cases/{case_id}/delete")
def case_delete(recorder_id: str, case_id: str, body: DeleteIn, request: Request, principal: Principal = Depends(current_principal), conn: sqlite3.Connection = Depends(get_conn)) -> dict[str, Any]:
    a = _adapter(conn, request, recorder_id)
    return {"recorder_id": recorder_id, **native.delete_case(conn, principal, a, case_id, confirm=body.confirm, supervised=body.supervised, request_id=_rq(request))}


# ---------------------------------------------------------------------------------------------- manual events

@router.post("/frigate/{recorder_id}/cameras/{camera_id}/events/manual")
def event_create(recorder_id: str, camera_id: str, body: EventIn, request: Request, principal: Principal = Depends(current_principal), conn: sqlite3.Connection = Depends(get_conn)) -> dict[str, Any]:
    """Create a manual event on ONE camera (a label; a duration up to ten minutes, or `duration_s: null` to keep it open until ended)."""
    cam = _camera_row(conn, principal, recorder_id, camera_id, svc.PERMISSION["events"])
    a = _adapter(conn, request, recorder_id)
    return {"recorder_id": recorder_id, "camera_id": camera_id,
            **native.create_event(conn, principal, a, cam, body.label, duration_s=body.duration_s, sub_label=body.sub_label, supervised=body.supervised, request_id=_rq(request))}


@router.post("/frigate/{recorder_id}/events/{event_id}/end")
def event_end(recorder_id: str, event_id: str, body: EndEventIn, request: Request, principal: Principal = Depends(current_principal), conn: sqlite3.Connection = Depends(get_conn)) -> dict[str, Any]:
    """End a manual event Arx created (any other event is 409 `frigate_object_not_arx`)."""
    a = _adapter(conn, request, recorder_id)
    if not fc.EVENT_ID.fullmatch(event_id):
        raise ApiError(422, "frigate_event_invalid", "מזהה אירוע לא תקין.")
    return {"recorder_id": recorder_id, **native.end_event(conn, principal, a, event_id, supervised=body.supervised, request_id=_rq(request))}
