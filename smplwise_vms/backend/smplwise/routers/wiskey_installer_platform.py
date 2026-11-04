"""WISKEY-INSTALLER-NATIVE-2400 phase 4: the rest of WisKey's platform (services/wiskey_installer_platform.py has the WisKey side).

Reads (no confirmation): `GET installer/platform` (configuration, capacity, integrity, maintenance queue, demo - each with its own state),
`GET installer/platform/export`, and the previews, which only make WisKey keep a one-use review token:
`POST installer/platform/{import|retention|config|maintenance}/preview`, `POST installer/platform/config/read`.

Writes (envelope + confirmation; typed phrase where named): `PUT installer/platform/stations/{id}` (metadata and maintenance window),
`PUT installer/platform/webhook`, `POST installer/platform/webhook/key` (typed; the key is returned once with `Cache-Control: no-store`
and never logged or audited), `POST installer/platform/import/apply` (typed), `POST installer/platform/retention/apply` (typed),
`POST installer/platform/config/apply` (typed; per-station receipts - a partial failure is reported station by station),
`POST installer/platform/maintenance/enqueue` (typed), `POST installer/platform/maintenance/jobs/{id}/cancel`."""
from __future__ import annotations

import json
import sqlite3
from typing import Any

from fastapi import APIRouter, Depends, Path, Request, Response
from pydantic import BaseModel, ConfigDict, Field, StrictInt, StrictStr

from ..auth import get_conn, settings_of
from ..errors import ApiError
from ..rbac import Principal
from ..services import wiskey_installer as wi
from ..services import wiskey_installer_platform as wp
from .access_control import _raw_body
from .wiskey_installer_common import Write, WriteBody, installer_gate, installer_reader, read

router = APIRouter()
ID_PATTERN = r"^[A-Za-z0-9][A-Za-z0-9_.:-]{0,127}$"
JOB_PATTERN = r"^[A-Za-z0-9-]{1,64}$"


def _part(request: Request, principal: Principal, name: str) -> dict[str, Any]:
    try:
        got = read(request, principal, wp.OPS[name])
        return {"state": "ready", "error": None, "fetched_at": got["fetched_at"], "data": got["data"]}
    except ApiError as exc:
        return {"state": "error", "error": {"code": exc.code, "wiskey_code": (exc.details or {}).get("wiskey_code"), "message": exc.user_message}, "fetched_at": None, "data": None}


@router.get("/access-control/installer/platform")
def platform_view(request: Request, principal: Principal = Depends(installer_reader)) -> dict[str, Any]:
    stations = wi.stations(settings_of(request))
    return {
        "platform": _part(request, principal, "get"),
        "capacity": _part(request, principal, "capacity"),
        "integrity": _part(request, principal, "integrity"),
        "maintenance": _part(request, principal, "maint_jobs"),
        "demo": _part(request, principal, "demo"),
        "stations": None if stations is None else [{"id": s.get("id"), "name": s.get("name"), "online": bool(s.get("online"))} for s in stations],
        "typed": {name: op.typed_word for name, op in wp.OPS.items() if op.typed_word},
    }


@router.get("/access-control/installer/platform/export")
def platform_export(request: Request, response: Response, principal: Principal = Depends(installer_reader)) -> dict[str, Any]:
    response.headers["Cache-Control"] = "no-store"
    return read(request, principal, wp.OPS["export"])


def _validation(bad: list[str]) -> ApiError:
    return ApiError(422, "validation", "הבקשה אינה תקינה: " + ", ".join(bad), details={"fields": bad})


class ImportPreview(BaseModel):
    model_config = ConfigDict(extra="forbid")
    content: StrictStr = Field(max_length=60000)
    mapping: dict[StrictStr, StrictStr]


class RetentionPreview(BaseModel):
    model_config = ConfigDict(extra="forbid")
    values: dict[str, Any]


class Targets(BaseModel):
    model_config = ConfigDict(extra="forbid")
    station_ids: list[StrictStr]
    door: StrictInt


class ChangePreview(Targets):
    changes: dict[str, Any]


def _parse(model: type[BaseModel], raw: bytes) -> Any:
    try:
        return model.model_validate(json.loads(raw or b"{}"))
    except Exception:  # noqa: BLE001 - pydantic's message is not shown
        raise ApiError(422, "validation", "הבקשה אינה תקינה.", details={"fields": ["body"]}) from None


@router.post("/access-control/installer/platform/import/preview")
def import_preview(request: Request, principal: Principal = Depends(installer_gate), raw: bytes = Depends(_raw_body)) -> dict[str, Any]:
    b: ImportPreview = _parse(ImportPreview, raw)
    if len(b.content.encode()) > 60000:
        raise _validation(["content"])
    return read(request, principal, wp.OPS["import_preview"], {"content": b.content, "mapping": b.mapping})


@router.post("/access-control/installer/platform/retention/preview")
def retention_preview(request: Request, principal: Principal = Depends(installer_gate), raw: bytes = Depends(_raw_body)) -> dict[str, Any]:
    b: RetentionPreview = _parse(RetentionPreview, raw)
    bad = wp.retention_errors(b.values)
    if bad:
        raise _validation(bad)
    return read(request, principal, wp.OPS["retention_preview"], {"values": b.values})


@router.post("/access-control/installer/platform/config/read")
def config_read(request: Request, principal: Principal = Depends(installer_gate), raw: bytes = Depends(_raw_body)) -> dict[str, Any]:
    b: Targets = _parse(Targets, raw)
    bad = wp.targets_errors(b.station_ids, b.door)
    if bad:
        raise _validation(bad)
    return read(request, principal, wp.OPS["config_read"], {"station_ids": b.station_ids, "door": b.door})


def _preview(request: Request, principal: Principal, raw: bytes, op: str) -> dict[str, Any]:
    b: ChangePreview = _parse(ChangePreview, raw)
    bad = wp.targets_errors(b.station_ids, b.door) + wp.change_errors(b.changes)
    if bad:
        raise _validation(bad)
    return read(request, principal, wp.OPS[op], {"station_ids": b.station_ids, "door": b.door, "changes": b.changes})


@router.post("/access-control/installer/platform/config/preview")
def config_preview(request: Request, principal: Principal = Depends(installer_gate), raw: bytes = Depends(_raw_body)) -> dict[str, Any]:
    return _preview(request, principal, raw, "config_preview")


@router.post("/access-control/installer/platform/maintenance/preview")
def maintenance_preview(request: Request, principal: Principal = Depends(installer_gate), raw: bytes = Depends(_raw_body)) -> dict[str, Any]:
    return _preview(request, principal, raw, "maint_preview")


# ---------------------------------------------------------------- writes

class StationBody(WriteBody):
    revision: StrictInt
    values: dict[str, Any]


class WebhookBody(WriteBody):
    revision: StrictInt
    values: dict[str, Any]


class ReviewBody(WriteBody):
    review_id: StrictStr = Field(min_length=1, max_length=200)


class JobBody(WriteBody):
    fingerprint: StrictStr = Field(min_length=1, max_length=128)


@router.put("/access-control/installer/platform/stations/{station_id}")
def station_save(request: Request, station_id: str = Path(min_length=1, max_length=128), principal: Principal = Depends(installer_gate), raw: bytes = Depends(_raw_body),
                 conn: sqlite3.Connection = Depends(get_conn)) -> dict[str, Any]:
    w = Write(request, conn, principal, wp.OPS["station_save"], "שמירת פרטי העמדה וחלון התחזוקה", target=station_id)
    body: StationBody = w.parse(StationBody, raw)
    bad = wp.station_values_errors(body.values)
    if bad:
        raise w.refuse(422, "validation", "השדות האלה אינם תקינים: " + ", ".join(bad), fields=bad)
    known = {s.get("id") for s in wi.stations(settings_of(request)) or []}
    if station_id not in known:
        raise w.refuse(404, "intercom_station_not_found", "העמדה לא נמצאה ב־WisKey.")
    return w.run({"collection": "stations", "record_id": station_id, "revision": body.revision, "values": body.values})


@router.put("/access-control/installer/platform/webhook")
def webhook_save(request: Request, principal: Principal = Depends(installer_gate), raw: bytes = Depends(_raw_body), conn: sqlite3.Connection = Depends(get_conn)) -> dict[str, Any]:
    w = Write(request, conn, principal, wp.OPS["webhook_save"], "שמירת ה־webhook")
    body: WebhookBody = w.parse(WebhookBody, raw)
    bad = wp.webhook_errors(body.values)
    if bad:
        raise w.refuse(422, "validation", "השדות האלה אינם תקינים: " + ", ".join(bad), fields=bad)
    return w.run({"revision": body.revision, "values": body.values, "confirmed": True})


@router.post("/access-control/installer/platform/webhook/key")
def webhook_key(request: Request, response: Response, principal: Principal = Depends(installer_gate), raw: bytes = Depends(_raw_body),
                conn: sqlite3.Connection = Depends(get_conn)) -> dict[str, Any]:
    response.headers["Cache-Control"] = "no-store"
    w = Write(request, conn, principal, wp.OPS["webhook_key"], "הצגת מפתח החתימה של ה־webhook")
    body: WriteBody = w.parse(WriteBody, raw)
    w.typed(body, w.op.typed_word)
    return w.run({"confirmed": True})


def _review_write(request: Request, principal: Principal, conn: sqlite3.Connection, raw: bytes, op: str, what: str) -> dict[str, Any]:
    w = Write(request, conn, principal, wp.OPS[op], what)
    body: ReviewBody = w.parse(ReviewBody, raw)
    w.typed(body, w.op.typed_word)
    return w.run({"review_id": body.review_id, "confirmed": True})


@router.post("/access-control/installer/platform/import/apply")
def import_apply(request: Request, principal: Principal = Depends(installer_gate), raw: bytes = Depends(_raw_body), conn: sqlite3.Connection = Depends(get_conn)) -> dict[str, Any]:
    return _review_write(request, principal, conn, raw, "import_apply", "ייבוא התצורה")


@router.post("/access-control/installer/platform/retention/apply")
def retention_apply(request: Request, principal: Principal = Depends(installer_gate), raw: bytes = Depends(_raw_body), conn: sqlite3.Connection = Depends(get_conn)) -> dict[str, Any]:
    return _review_write(request, principal, conn, raw, "retention_apply", "החלת מדיניות שמירת האירועים")


@router.post("/access-control/installer/platform/config/apply")
def config_apply(request: Request, principal: Principal = Depends(installer_gate), raw: bytes = Depends(_raw_body), conn: sqlite3.Connection = Depends(get_conn)) -> dict[str, Any]:
    return _review_write(request, principal, conn, raw, "config_apply", "החלת השינוי על העמדות")


@router.post("/access-control/installer/platform/maintenance/enqueue")
def maintenance_enqueue(request: Request, principal: Principal = Depends(installer_gate), raw: bytes = Depends(_raw_body),
                        conn: sqlite3.Connection = Depends(get_conn)) -> dict[str, Any]:
    return _review_write(request, principal, conn, raw, "maint_enqueue", "תזמון התחזוקה")


@router.post("/access-control/installer/platform/maintenance/jobs/{job_id}/cancel")
def maintenance_cancel(request: Request, job_id: str = Path(pattern=JOB_PATTERN), principal: Principal = Depends(installer_gate), raw: bytes = Depends(_raw_body),
                       conn: sqlite3.Connection = Depends(get_conn)) -> dict[str, Any]:
    w = Write(request, conn, principal, wp.OPS["maint_cancel"], "ביטול משימת התחזוקה", target=job_id)
    body: JobBody = w.parse(JobBody, raw)
    w.act.details["job_id"] = job_id
    return w.run({"job_id": job_id, "fingerprint": body.fingerprint, "confirmed": True})


def reset() -> None:
    return None

