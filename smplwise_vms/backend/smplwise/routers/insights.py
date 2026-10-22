"""CR-INSIGHT215 (2.15.0 "insights and reports", docs/changes/CR-INSIGHT215.md) - read-only insights and the monthly building report.

Routes (all under /api/v1; every part ships OFF - a switched-off part answers the uniform 404 to everyone, before any permission check, so it
says nothing):
* `GET /insights/settings`, `PUT /insights/settings` - the thresholds and the door pairs (`insights.manage`, installation); turning a switch on
  or off needs `system.configure` as well. Audited.
* `GET /insights/doors` - door openings without a matching entry event (`insights.read`, scoped per door by its contact sensor). Audited.
* `GET /insights/waste` - lights / air conditioning on in empty rooms or at night, and night consumption anomalies (`insights.read`, scoped
  per device / meter). Audited.
* `GET /reports/building/preview`, `GET /reports/building.pdf` - the monthly building report (`reports.building`, installation); each section
  also needs its own module's read permission (section 6 of the CR) and is otherwise omitted. The PDF is audited.

Nothing here sends anything to a device or to Home Assistant; answers carry friendly names and opaque keys, never entity ids (the settings
route, for its managers, is the one exception: the door pairs are entity ids by nature)."""
from __future__ import annotations

import sqlite3
import time
from pathlib import Path
from typing import Any, Literal

from fastapi import APIRouter, Depends, Query, Request
from fastapi.responses import Response
from pydantic import BaseModel, ConfigDict, Field

from ..audit import audit
from ..auth import current_principal, current_principal_ro, get_conn, get_read_conn, settings_of
from ..errors import ApiError, not_found
from ..rbac import INSTALLATION, Principal, authorize, permissions_anywhere, require
from ..services import insights_common as ic

router = APIRouter()


def now_ts() -> float:
    """The clock of the routes (tests replace it)."""
    return time.time()


def _store(request: Request) -> Any:
    """The electricity store when this installation has one; never created here (a read must not make a file)."""
    from ..services import energy_store as st

    settings = settings_of(request)
    if not (Path(settings.data_dir) / st.FILE_NAME).exists():
        return None
    return st.store_for(settings)


def _off(conn: sqlite3.Connection, key: str) -> None:
    if not ic.switch_on(conn, key):
        raise not_found("הפריט לא נמצא.")


def _range(rng: str, start: str | None, end: str | None) -> tuple[int, int]:
    try:
        return ic.parse_range(rng, start, end, now_ts())
    except ValueError as e:
        raise ApiError(422, "validation", ic.MESSAGES["range"]["he"], details={"fields": [str(e)], "message_en": ic.MESSAGES["range"]["en"]}) from None


# ---------------------------------------------------------------- settings

class SettingsIn(BaseModel):
    model_config = ConfigDict(extra="forbid")
    settings: dict[str, Any] | None = None
    switches: dict[str, bool] | None = Field(default=None, max_length=len(ic.SWITCHES))


def _settings_out(conn: sqlite3.Connection, principal: Principal) -> dict[str, Any]:
    return {"settings": ic.load(conn), "switches": ic.switches(conn), "can_switch": authorize(conn, principal, ic.CONFIGURE, INSTALLATION).allowed,
            "sections": list(ic.SECTIONS), "domains": list(ic.WASTE_DOMAINS)}


@router.get("/insights/settings")
def get_settings(principal: Principal = Depends(current_principal_ro), conn: sqlite3.Connection = Depends(get_read_conn)) -> dict[str, Any]:
    """The insight thresholds, the door pairs and the switches (insights.manage)."""
    require(conn, principal, ic.MANAGE, INSTALLATION)
    return _settings_out(conn, principal)


@router.put("/insights/settings")
def put_settings(body: SettingsIn, principal: Principal = Depends(current_principal), conn: sqlite3.Connection = Depends(get_conn)) -> dict[str, Any]:
    """Save the thresholds / door pairs (insights.manage) and the switches (also system.configure). The document is validated whole."""
    require(conn, principal, ic.MANAGE, INSTALLATION)
    changed: dict[str, Any] = {}
    if body.switches:
        unknown = [k for k in body.switches if k not in ic.SWITCHES]
        if unknown:
            raise ApiError(422, "validation", ic.MESSAGES["validation"]["he"], details={"fields": [f"switches.{k}"[:80] for k in unknown], "message_en": ic.MESSAGES["validation"]["en"]})
        require(conn, principal, ic.CONFIGURE, INSTALLATION)
    if body.settings is not None:
        try:
            doc = ic.validate(body.settings, conn)
        except ic.Invalid as e:
            raise ApiError(422, "validation", ic.MESSAGES["validation"]["he"], details={"fields": e.fields[:40], "message_en": ic.MESSAGES["validation"]["en"]}) from None
        ic.save(conn, doc)
        changed["settings"] = {"pairs": len(doc["doors"]["pairs"]), "sections": len(doc["report"]["sections"])}
    if body.switches:
        from ..db import set_setting

        before = ic.switches(conn)
        for k, v in body.switches.items():
            set_setting(conn, k, "true" if v else "false")
        changed["switches"] = {k: v for k, v in body.switches.items() if before.get(k) != v}
    audit(conn, actor=principal, action="insights.settings.update", decision="allowed", resource_type="insights_settings", resource_id="settings", details=changed)
    return _settings_out(conn, principal)


@router.get("/insights/status")
def status(principal: Principal = Depends(current_principal_ro), conn: sqlite3.Connection = Depends(get_read_conn)) -> dict[str, bool]:
    """Which parts the caller may open right now (switch on AND the permission held): drives the navigation only. Computes nothing, writes
    nothing, no audit row; a caller who holds none of the three permissions anywhere gets the audited 403."""
    anywhere = set(permissions_anywhere(conn, principal))
    if not anywhere & {ic.READ, ic.MANAGE, ic.REPORT}:
        require(conn, principal, ic.READ, INSTALLATION)
    sw = ic.switches(conn)
    return {"doors": sw[ic.SW_DOORS] and ic.READ in anywhere, "waste": sw[ic.SW_WASTE] and ic.READ in anywhere,
            "report": sw[ic.SW_REPORT] and authorize(conn, principal, ic.REPORT, INSTALLATION).allowed}


# ---------------------------------------------------------------- the insights

@router.get("/insights/doors")
def doors(range: str = Query("7d", max_length=8), start: str | None = Query(None, alias="from", max_length=40), end: str | None = Query(None, alias="to", max_length=40),  # noqa: A002
          principal: Principal = Depends(current_principal_ro), conn: sqlite3.Connection = Depends(get_read_conn)) -> dict[str, Any]:
    """Door openings without a matching entry event, per door the caller sees (insights.read; door and time only)."""
    from ..services import insights_doors

    _off(conn, ic.SW_DOORS)
    scope = ic.Scope(conn, principal, ic.READ)
    lo, hi = _range(range, start, end)
    out = insights_doors.report(conn, scope, lo, hi)
    audit(conn, actor=principal, action="insights.doors.read", decision="allowed", resource_type="insights", resource_id="doors",
          details={"doors": len(out["doors"]), "unexplained": out["total"]["unexplained"], "range_s": hi - lo})
    return out


@router.get("/insights/waste")
def waste(request: Request, range: str = Query("7d", max_length=8), start: str | None = Query(None, alias="from", max_length=40),  # noqa: A002
          end: str | None = Query(None, alias="to", max_length=40), principal: Principal = Depends(current_principal_ro),
          conn: sqlite3.Connection = Depends(get_read_conn)) -> dict[str, Any]:
    """Lights / air conditioning on in empty rooms or at night, and night consumption anomalies (insights.read; room level only)."""
    from ..services import insights_waste

    _off(conn, ic.SW_WASTE)
    scope = ic.Scope(conn, principal, ic.READ)
    lo, hi = _range(range, start, end)
    out = insights_waste.report(conn, _store(request), scope, lo, hi)
    audit(conn, actor=principal, action="insights.waste.read", decision="allowed", resource_type="insights", resource_id="waste",
          details={"items": len(out["devices"]["items"]), "anomalies": len(out["energy"]["items"]), "range_s": hi - lo})
    return out


# ---------------------------------------------------------------- the monthly building report

SECTION_PERMISSION = {"energy": "energy.view", "elevators": "devices.read", "temperature": "devices.read", "generator": "generator.view",
                      "cameras": "events.read", "doors": ic.READ, "waste": ic.READ}
SECTION_SWITCH = {"doors": ic.SW_DOORS, "waste": ic.SW_WASTE}


def section_gate(conn: sqlite3.Connection, principal: Principal) -> Any:
    anywhere = set(permissions_anywhere(conn, principal))

    def allowed(section: str) -> str | None:
        if section == "tickets":
            from ..services.tickets import access as ta

            if not ta.module_on(conn):
                return "module_off"
            return None if ta.VIEW in anywhere else "not_permitted"
        if section in SECTION_SWITCH and not ic.switch_on(conn, SECTION_SWITCH[section]):
            return "switch_off"
        perm = SECTION_PERMISSION.get(section)
        if perm is None or not authorize(conn, principal, perm, INSTALLATION).allowed:
            return "not_permitted"
        return None

    return allowed


def _sections(raw: str | None, conn: sqlite3.Connection) -> list[str]:
    if not raw:
        return list(ic.load(conn)["report"]["sections"])
    got = [s.strip() for s in raw.split(",") if s.strip()]
    bad = [s for s in got if s not in ic.SECTIONS]
    if bad or not got:
        raise ApiError(422, "validation", ic.MESSAGES["validation"]["he"], details={"fields": ["sections"], "message_en": ic.MESSAGES["validation"]["en"]})
    return got


def _model(request: Request, conn: sqlite3.Connection, principal: Principal, month: str | None, sections: str | None, lang: str) -> dict[str, Any]:
    from ..services import building_report as rep

    _off(conn, ic.SW_REPORT)
    require(conn, principal, ic.REPORT, INSTALLATION)
    try:
        return rep.build(conn, principal, _sections(sections, conn), month, lang, now_ts(), allowed=section_gate(conn, principal), store=_store(request))
    except rep.MonthError:
        raise ApiError(422, "validation", ic.MESSAGES["validation"]["he"], details={"fields": ["month"], "message_en": ic.MESSAGES["validation"]["en"]}) from None


@router.get("/reports/building/preview")
def building_preview(request: Request, month: str | None = Query(None, max_length=7), sections: str | None = Query(None, max_length=200),
                     lang: Literal["he", "en"] = "he", principal: Principal = Depends(current_principal_ro), conn: sqlite3.Connection = Depends(get_read_conn)) -> dict[str, Any]:
    """The monthly building report MODEL (what the PDF is made from) - reports.building, installation."""
    from ..services import building_report as rep

    model = _model(request, conn, principal, month, sections, lang)
    return {**model, "filename": rep.filename(model)}


@router.get("/reports/building.pdf")
def building_pdf(request: Request, month: str | None = Query(None, max_length=7), sections: str | None = Query(None, max_length=200),
                 lang: Literal["he", "en"] = "he", principal: Principal = Depends(current_principal_ro), conn: sqlite3.Connection = Depends(get_read_conn)) -> Response:
    """The monthly building report as ONE PDF (Hebrew first), rendered in the isolated child of the bill PDF."""
    from ..services import building_report as rep
    from ..services import building_report_pdf

    model = _model(request, conn, principal, month, sections, lang)
    try:
        content = building_report_pdf.render(model)
    except building_report_pdf.PdfError as e:
        status = 422 if e.code in ("pdf_page_limit", "pdf_too_large") else 503
        raise ApiError(status, e.code, "לא ניתן להפיק את הדוח כרגע." if status == 503 else "הדוח גדול מדי; יש לצמצם את הסעיפים.",
                       details={"message_en": "The report cannot be produced now." if status == 503 else "The report is too large; choose fewer sections."}) from None
    audit(conn, actor=principal, action="reports.building.pdf", decision="allowed", resource_type="building_report", resource_id=model["month"],
          details={"sections": model["sections"], "omitted": [o["section"] for o in model["omitted"]], "digest": model["digest"][:16], "lang": model["lang"]})
    return Response(content=content, media_type="application/pdf",
                    headers={"Content-Disposition": f'attachment; filename="{rep.filename(model)}"', "Cache-Control": "private, no-store", "X-Report-Digest": model["digest"]})
