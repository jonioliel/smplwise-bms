"""CR-FLEET215: the fleet report's administrator routes (Settings only; nothing here is an operator screen).

- GET  /fleet/report             the two keys (the switch and whether the add-on option is usable - never its value), the last attempt
- PUT  /fleet/report             `{enabled: bool}` - the customer's consent switch (OFF by default); audited before / after
- GET  /fleet/report/enrollment  the public enrollment facts the installer copies into the receiver (creates the fleet key on first use)
- GET  /fleet/report/preview     exactly what WOULD be sent now (validated; nothing is signed, sent, numbered or created)
- GET  /fleet/report/log         what WAS sent: the exact bodies of the last attempts
- POST /fleet/report/send        send one report now (refused while either key is off); audited

Every route needs `system.configure` at the installation AND a system administrator (the precedent of /wiskey/switches). Refusals after the
permission check are audited with a closed reason; nothing a caller typed is echoed into an audit row."""
from __future__ import annotations

import datetime as dt
import sqlite3
from typing import Any

from fastapi import APIRouter, Depends, Request
from pydantic import BaseModel, ConfigDict
from starlette.concurrency import run_in_threadpool

from ..audit import audit
from ..auth import current_principal_ro, get_read_conn, settings_of
from ..errors import ApiError
from ..rbac import INSTALLATION, Principal, is_system_admin, require
from ..services import fleet_keys
from ..services import fleet_report as fr

router = APIRouter()
BASE = "/fleet/report"
RES = "fleet.report"
_TEXT = {
    "not_system_admin": "רק מנהל מערכת יכול לראות או לשנות את דיווח הבריאות.",
    "fleet_report_off": "דיווח הבריאות כבוי. הפעילו אותו קודם.",
    "receiver_not_configured": "כתובת השרת המקבל לא הוגדרה בהתקנה. פנו למתקין.",
    "receiver_url_invalid": "כתובת השרת המקבל שהוגדרה בהתקנה אינה תקינה. פנו למתקין.",
    "schema_refused": "הדוח לא עבר את בדיקת התוכן שלו ולא נשלח.",
    "nothing_to_change": "לא נשלח שינוי.",
    "silent_after_out_of_range": "מספר השעות מחוץ לטווח המותר.",
}


def _rid(request: Request) -> str | None:
    return getattr(request.state, "correlation_id", None)


class SwitchIn(BaseModel):
    """`enabled`: the consent switch. `silent_after_h`: hours without a report after which the receiver shows "not reporting"
    (SILENT_MIN_H..SILENT_MAX_H). Either or both; at least one."""
    model_config = ConfigDict(extra="forbid")
    enabled: bool | None = None
    silent_after_h: int | None = None


def _admin_or_403(conn: sqlite3.Connection, principal: Principal, request: Request, action: str) -> None:
    require(conn, principal, "system.configure", INSTALLATION)
    if not is_system_admin(conn, principal.user_id):
        audit(conn, actor=principal, action=action, decision="denied", resource_type="installation", resource_id=RES,
              reason="not_system_admin", request_id=_rid(request))
        raise ApiError(403, "not_system_admin", _TEXT["not_system_admin"])


@router.get(BASE)
def get_fleet_report(request: Request, principal: Principal = Depends(current_principal_ro), conn: sqlite3.Connection = Depends(get_read_conn)) -> dict[str, Any]:
    """CR-FLEET215: the fleet report's switch, whether the receiver option is usable (never its value) and the last attempt (system administrator)."""
    _admin_or_403(conn, principal, request, "settings.read")
    return fr.status(settings_of(request), conn)


@router.put(BASE)
def put_fleet_report(body: SwitchIn, request: Request, principal: Principal = Depends(current_principal_ro)) -> dict[str, Any]:
    """CR-FLEET215: turn the daily fleet report on or off - the customer's consent (OFF by default); audited (system administrator)."""
    settings = settings_of(request)
    db = request.app.state.db
    stopping = False
    with db.connection(label="fleet.report.switch") as conn:
        _admin_or_403(conn, principal, request, "settings.changed")
        if body.enabled is None and body.silent_after_h is None:
            raise ApiError(422, "nothing_to_change", _TEXT["nothing_to_change"])
        if body.silent_after_h is not None:
            if not fr.SILENT_MIN_H <= body.silent_after_h <= fr.SILENT_MAX_H:
                raise ApiError(422, "silent_after_out_of_range", _TEXT["silent_after_out_of_range"])
            old = fr.silent_after_h(conn)
            conn.execute("INSERT INTO settings(key, value) VALUES(?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value",
                         (fr.SILENT_KEY, str(body.silent_after_h)))
            audit(conn, actor=principal, action="settings.changed", decision="allowed", resource_type="installation", resource_id=RES,
                  request_id=_rid(request), details={"key": fr.SILENT_KEY, "before": old, "after": body.silent_after_h})
        if body.enabled is not None:
            was_on = fr.switch_on(conn)
            before = "on" if was_on else "off"
            after = "on" if body.enabled else "off"
            conn.execute("INSERT INTO settings(key, value) VALUES(?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value",
                         (fr.SWITCH, "true" if body.enabled else "false"))
            audit(conn, actor=principal, action="settings.changed", decision="allowed", resource_type="installation", resource_id=RES,
                  request_id=_rid(request), details={"key": fr.SWITCH, "before": before, "after": after})
            if body.enabled:
                fleet_keys.ensure(settings)  # the id and key exist from the moment of consent (files only)
            stopping = was_on and not body.enabled
    if stopping:  # outside the write connection: one signed "reporting stopped" message, best effort (never blocks the switch)
        fr.send_stop(db, settings, actor=principal.user_id)
    with db.connection(mode="read") as conn:
        return fr.status(settings, conn)


@router.get(BASE + "/enrollment")
def get_enrollment(request: Request, principal: Principal = Depends(current_principal_ro), conn: sqlite3.Connection = Depends(get_read_conn)) -> dict[str, Any]:
    """CR-FLEET215: the public enrollment facts (installation id, key id, public key, one-line code) for the receiver (system administrator)."""
    _admin_or_403(conn, principal, request, "settings.read")
    facts = fleet_keys.ensure(settings_of(request))
    audit(conn, actor=principal, action="fleet.enrollment.read", decision="allowed", resource_type="installation", resource_id=RES,
          request_id=_rid(request), details={"kid": facts["kid"]})
    return {"installation_id": facts["installation_id"], "kid": facts["kid"], "alg": facts["alg"], "public_key": facts["public_key"],
            "code": fleet_keys.enrollment_code(facts)}


@router.get(BASE + "/preview")
def get_preview(request: Request, principal: Principal = Depends(current_principal_ro), conn: sqlite3.Connection = Depends(get_read_conn)) -> dict[str, Any]:
    """CR-FLEET215: exactly what would be sent now - validated, but not signed, numbered, sent or stored (system administrator)."""
    _admin_or_403(conn, principal, request, "settings.read")
    settings = settings_of(request)
    facts = fleet_keys.peek(settings)  # never creates the id or the key
    body = fr.build_body(settings, conn, probe=True)
    try:
        payload = fr.assemble(body, installation_id=facts["installation_id"] or "0" * 32, seq=facts["seq"] + 1, now=dt.datetime.now(dt.timezone.utc))
    except fr.FleetSchemaError:
        raise ApiError(500, "schema_refused", _TEXT["schema_refused"]) from None
    return {"preview": True, "id_assigned": facts["installation_id"] is not None, "bytes": len(fr.canonical(payload)), "payload": payload}


@router.get(BASE + "/log")
def get_log(request: Request, limit: int = 30, principal: Principal = Depends(current_principal_ro), conn: sqlite3.Connection = Depends(get_read_conn)) -> dict[str, Any]:
    """CR-FLEET215: the exact bodies of the last fleet report attempts, newest first (system administrator)."""
    _admin_or_403(conn, principal, request, "settings.read")
    return {"items": fr.log_rows(conn, limit)}


@router.post(BASE + "/send")
async def post_send(request: Request, principal: Principal = Depends(current_principal_ro)) -> dict[str, Any]:
    """CR-FLEET215: send one fleet report now; refused while the switch or the receiver option is off; audited (system administrator)."""
    settings = settings_of(request)
    db = request.app.state.db

    def _gate() -> None:
        with db.connection(label="fleet.report.send") as conn:
            _admin_or_403(conn, principal, request, "fleet.report.send")
            why = None if fr.switch_on(conn) else "fleet_report_off"
            if why is None:
                why = fr.receiver_url()[1]
            if why:
                audit(conn, actor=principal, action="fleet.report.send", decision="denied", resource_type="installation", resource_id=RES,
                      reason=why, request_id=_rid(request))
                raise ApiError(409, why, _TEXT[why])

    await run_in_threadpool(_gate)
    out = await run_in_threadpool(lambda: fr.send_once(db, settings, trigger="manual", actor=principal.user_id))

    def _done() -> None:
        with db.connection(label="fleet.report.send") as conn:
            audit(conn, actor=principal, action="fleet.report.send", decision="allowed", resource_type="installation", resource_id=RES,
                  request_id=_rid(request), details={"result": out.get("result"), "seq": out.get("seq"), "http_status": out.get("http_status")})

    await run_in_threadpool(_done)
    return out
