"""WISKEY-INSTALLER-NATIVE-2400 phase 3: add, re-onboard, remove and replace stations (services/wiskey_installer_lifecycle.py has the
WisKey / flow side).

Onboarding (WisKey's config-entry flow through Home Assistant's flow API; credentials pass through to WisKey and are never stored,
logged or audited here):
- `POST /access-control/installer/onboarding` `{kind: add | reconfigure, entry_id?}` - starts a flow (confirmation).
- `POST /access-control/installer/onboarding/{flow_id}/steps/{step_id}` `{input}` - answers the step the flow waits on, with that step's
  closed key set; the `mapping` step (WisKey pulses the door relay) needs the typed phrase "פתיחת דלת לבדיקה".
- `POST /access-control/installer/onboarding/{flow_id}/abort` - ends a flow Arx started.

Removal / replacement (WisKey `platform/lifecycle_*`):
- `GET  /access-control/installer/lifecycle` - the jobs (their state is the progress of a long removal).
- `GET  /access-control/installer/lifecycle/review?source_id=&target_id=` - the read-only impact (counts and blockers only).
- `POST /access-control/installer/lifecycle/prepare` `{source_id, target_id?}` - confirmation; WisKey refuses while a blocker stands.
- `GET  /access-control/installer/lifecycle/jobs/{job_id}/plan?fingerprint=` - the job's current plan.
- `POST /access-control/installer/lifecycle/jobs/{job_id}/{apply|verify|remove}` `{fingerprint}` - apply and remove need the typed name of
  the station being removed; verify the confirmation."""
from __future__ import annotations

import re
import sqlite3
import time
from typing import Any

from fastapi import APIRouter, Depends, Path, Query, Request
from pydantic import ConfigDict, Field, StrictStr

from ..auth import get_conn, settings_of
from ..errors import ApiError
from ..rbac import Principal
from ..services import wiskey_installer as wi
from ..services import wiskey_installer_lifecycle as wl
from ._common import raw_body as _raw_body
from .wiskey_installer_common import STATION_TYPE, Write, WriteBody, installer_gate, installer_reader, read

router = APIRouter()
ID_PATTERN = r"^[A-Za-z0-9][A-Za-z0-9_.:-]{0,127}$"
JOB_PATTERN = r"^[A-Za-z0-9][A-Za-z0-9_.:-]{0,127}$"


# ---------------------------------------------------------------- onboarding

class StartBody(WriteBody):
    kind: str = Field(pattern=r"^(add|reconfigure)$")
    entry_id: StrictStr | None = Field(default=None, pattern=ID_PATTERN)


class StepBody(WriteBody):
    model_config = ConfigDict(extra="forbid")
    input: dict[str, Any] = Field(default_factory=dict)


def _flow_error(what: str):
    def classify(exc: Exception) -> ApiError | None:
        if isinstance(exc, wl.FlowError):
            return wl.flow_error(what, exc)
        if isinstance(exc, ValueError):  # an answer the projection does not accept: sent, unclear
            return ApiError(504, "installer_outcome_unknown", f"{what} נשלח, אך התשובה אינה בפורמט המוכר. בדקו את רשימת העמדות.",
                            details={"outcome": "unknown", "wiskey_code": "invalid_response"})
        return None

    return classify


@router.post("/access-control/installer/onboarding")
def onboarding_start(request: Request, principal: Principal = Depends(installer_gate), raw: bytes = Depends(_raw_body),
                     conn: sqlite3.Connection = Depends(get_conn)) -> dict[str, Any]:
    w = Write(request, conn, principal, wl.OPS["onboarding_start"], "פתיחת אשף העמדה")
    body: StartBody = w.parse(StartBody, raw)
    w.act.details.update(kind=body.kind, entry_id=body.entry_id)
    if body.kind == "reconfigure":
        if not body.entry_id:
            raise w.refuse(422, "validation", "יש לבחור עמדה להתחברות מחדש.", fields=["entry_id"])
        known = {s.get("id") for s in wi.stations(settings_of(request)) or []}
        if body.entry_id not in known:
            raise w.refuse(404, "intercom_station_not_found", "העמדה לא נמצאה ב־WisKey.")
    if not wl.FLOWS.room():
        raise w.refuse(429, "installer_busy", "כבר פתוחים שני אשפים. סיימו או בטלו אחד מהם לפני שפותחים עוד.")
    settings = settings_of(request)

    def call() -> dict[str, Any]:
        data = wl.project_flow(wl.transport().start(settings, body.entry_id if body.kind == "reconfigure" else None))
        if data["type"] == "form":
            wl.FLOWS.put(wl.Flow(data["flow_id"], principal.user_id, body.kind, body.entry_id, data["step_id"], time.monotonic()))
        return data

    return w.run_call(call, wl.flow_summary, _flow_error(w.what))


@router.post("/access-control/installer/onboarding/{flow_id}/steps/{step_id}")
def onboarding_step(request: Request, flow_id: str, step_id: str, principal: Principal = Depends(installer_gate), raw: bytes = Depends(_raw_body),
                    conn: sqlite3.Connection = Depends(get_conn)) -> dict[str, Any]:
    pulse = step_id == "mapping"
    w = Write(request, conn, principal, wl.OPS["onboarding_pulse" if pulse else "onboarding_step"], "שלב באשף העמדה")
    w.act.details["step_id"] = step_id if step_id in wl.STEPS else "other"
    body: StepBody = w.parse(StepBody, raw)
    flow = wl.FLOWS.get(flow_id) if wl.FLOW_ID.fullmatch(flow_id) else None
    if flow is None or flow.owner != principal.user_id:
        raise w.refuse(404, "onboarding_flow_not_found", "האשף הזה אינו פתוח (או שפג תוקפו). פתחו אותו מחדש.")
    if step_id != flow.step_id:
        raise w.refuse(409, "onboarding_step_mismatch", "האשף ממתין לשלב אחר. טענו אותו מחדש.", waiting=flow.step_id)
    data, bad = wl.check_input(step_id, body.input)
    if bad:
        raise w.refuse(422, "validation", "השדות האלה חסרים או אינם תקינים: " + ", ".join(bad), fields=bad)
    if pulse:
        w.typed(body, wl.PULSE_PHRASE)
    w.act.details["kind"] = flow.kind  # never the input: credentials, a host or a door choice stay out of the audit row
    settings = settings_of(request)

    def call() -> dict[str, Any]:
        out = wl.project_flow(wl.transport().step(settings, flow_id, data))
        if out["type"] == "form":
            wl.FLOWS.advance(flow_id, out["step_id"])
        else:
            wl.FLOWS.drop(flow_id)
        return out

    return w.run_call(call, wl.flow_summary, _flow_error(w.what))


@router.post("/access-control/installer/onboarding/{flow_id}/abort")
def onboarding_abort(request: Request, flow_id: str, principal: Principal = Depends(installer_gate), raw: bytes = Depends(_raw_body),
                     conn: sqlite3.Connection = Depends(get_conn)) -> dict[str, Any]:
    w = Write(request, conn, principal, wl.OPS["onboarding_abort"], "ביטול אשף העמדה")
    w.parse(WriteBody, raw)
    flow = wl.FLOWS.get(flow_id) if wl.FLOW_ID.fullmatch(flow_id) else None
    if flow is None or flow.owner != principal.user_id:
        raise w.refuse(404, "onboarding_flow_not_found", "האשף הזה אינו פתוח.")
    settings = settings_of(request)

    def call() -> dict[str, Any]:
        try:
            wl.transport().abort(settings, flow_id)
        finally:
            wl.FLOWS.drop(flow_id)
        return {"flow_id": flow_id, "type": "aborted"}

    return w.run_call(call, lambda d: {"type": "aborted"}, _flow_error(w.what))


# ---------------------------------------------------------------- removal / replacement

@router.get("/access-control/installer/lifecycle")
def lifecycle_jobs(request: Request, principal: Principal = Depends(installer_reader)) -> dict[str, Any]:
    got = read(request, principal, wl.OPS["jobs"])
    stations = wi.stations(settings_of(request))
    return {"records": got["data"]["records"], "fetched_at": got["fetched_at"],
            "stations": None if stations is None else [{"id": s.get("id"), "name": s.get("name"), "online": bool(s.get("online"))} for s in stations],
            "open_flows": wl.FLOWS.room() is False}


@router.get("/access-control/installer/lifecycle/review")
def lifecycle_review(request: Request, principal: Principal = Depends(installer_reader), source_id: str = Query(min_length=1, max_length=128, pattern=ID_PATTERN),
                     target_id: str = Query(default="", max_length=128)) -> dict[str, Any]:
    if target_id and not re.fullmatch(ID_PATTERN.strip("^$"), target_id):
        raise ApiError(422, "validation", "מזהה עמדת היעד אינו תקין.", details={"fields": ["target_id"]})
    got = read(request, principal, wl.OPS["review"], {"source_id": source_id, "target_id": target_id})
    return {"review": got["data"], "fetched_at": got["fetched_at"]}


@router.get("/access-control/installer/lifecycle/jobs/{job_id}/plan")
def lifecycle_plan(request: Request, principal: Principal = Depends(installer_reader), job_id: str = Path(pattern=JOB_PATTERN),
                   fingerprint: str = Query(min_length=1, max_length=128)) -> dict[str, Any]:
    got = read(request, principal, wl.OPS["plan"], {"job_id": job_id, "fingerprint": fingerprint})
    return {**got["data"], "fetched_at": got["fetched_at"]}


class PrepareBody(WriteBody):
    source_id: StrictStr = Field(pattern=ID_PATTERN)
    target_id: StrictStr | None = Field(default=None, pattern=ID_PATTERN)


class JobBody(WriteBody):
    fingerprint: StrictStr = Field(min_length=1, max_length=128)


def _station_named(w: Write, station_id: str | None) -> dict[str, Any]:
    found = next((s for s in wi.stations(settings_of(w.act.request)) or [] if s.get("id") == station_id), None)
    if found is None:
        raise w.refuse(404, "intercom_station_not_found", "העמדה לא נמצאה ב־WisKey.")
    return found


@router.post("/access-control/installer/lifecycle/prepare")
def lifecycle_prepare(request: Request, principal: Principal = Depends(installer_gate), raw: bytes = Depends(_raw_body),
                      conn: sqlite3.Connection = Depends(get_conn)) -> dict[str, Any]:
    w = Write(request, conn, principal, wl.OPS["prepare"], "הכנת הסרת העמדה")
    body: PrepareBody = w.parse(PrepareBody, raw)
    w.target = body.source_id
    w.act.resource_id = body.source_id
    w.act.details.update(source_id=body.source_id, target_id=body.target_id)
    if body.target_id == body.source_id:
        raise w.refuse(422, "validation", "עמדת היעד חייבת להיות שונה מהעמדה המוסרת.", fields=["target_id"])
    _station_named(w, body.source_id)
    if body.target_id:
        _station_named(w, body.target_id)
    return w.run({"source_id": body.source_id, "target_id": body.target_id or ""})


def _job_write(request: Request, principal: Principal, conn: sqlite3.Connection, raw: bytes, job_id: str, action: str) -> dict[str, Any]:
    op = wl.OPS[action]
    what = {"apply": "העברת האנשים והסרתם מהעמדה", "verify": "בדיקת הניקוי של העמדה", "remove": "הסרת העמדה מהמערכת"}[action]
    w = Write(request, conn, principal, op, what, target=job_id)
    w.act.resource_type = STATION_TYPE
    body: JobBody = w.parse(JobBody, raw)
    w.act.details["job_id"] = job_id
    if not re.fullmatch(JOB_PATTERN.strip("^$"), job_id):
        raise w.refuse(422, "validation", "מזהה המשימה אינו תקין.", fields=["job_id"])
    if op.danger == "typed":
        # the typed phrase is the name of the station being removed, read from WisKey's own job (never from the browser)
        try:
            jobs = wi.run_read(settings_of(request), wl.OPS["jobs"], {}, principal.user_id)["data"]["records"]
        except ApiError as exc:
            raise w.act.refuse(exc) from None
        job = next((j for j in jobs if j.get("id") == job_id), None)
        if job is None:
            raise w.refuse(404, "lifecycle_not_found", "המשימה לא נמצאה ב־WisKey.")
        w.act.resource_id = job.get("source_id") or job_id
        w.typed(body, str(job.get("source_name") or job.get("source_id") or ""))
    return w.run({"job_id": job_id, "fingerprint": body.fingerprint, "confirmed": True})


@router.post("/access-control/installer/lifecycle/jobs/{job_id}/apply")
def lifecycle_apply(request: Request, job_id: str, principal: Principal = Depends(installer_gate), raw: bytes = Depends(_raw_body),
                    conn: sqlite3.Connection = Depends(get_conn)) -> dict[str, Any]:
    return _job_write(request, principal, conn, raw, job_id, "apply")


@router.post("/access-control/installer/lifecycle/jobs/{job_id}/verify")
def lifecycle_verify(request: Request, job_id: str, principal: Principal = Depends(installer_gate), raw: bytes = Depends(_raw_body),
                     conn: sqlite3.Connection = Depends(get_conn)) -> dict[str, Any]:
    return _job_write(request, principal, conn, raw, job_id, "verify")


@router.post("/access-control/installer/lifecycle/jobs/{job_id}/remove")
def lifecycle_remove(request: Request, job_id: str, principal: Principal = Depends(installer_gate), raw: bytes = Depends(_raw_body),
                     conn: sqlite3.Connection = Depends(get_conn)) -> dict[str, Any]:
    return _job_write(request, principal, conn, raw, job_id, "remove")


def reset() -> None:
    wl.FLOWS.reset()

