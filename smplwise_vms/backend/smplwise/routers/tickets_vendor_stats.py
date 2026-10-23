"""CR-SVC215 slice 1 (docs/changes/CR-SVC215.md sections 2 and 7; owner answers 2026-10-24 items 28 and 30): the computed vendor card.

    GET /tickets/contacts/{id}/stats?months=3|12|36

Who (owner answer 30, editable in Settings): the card is opened by the holders of `vendor_stats.card_permission` (default tickets.manage,
the site manager) or of tickets.directory; the money number (quote adherence) only for `vendor_stats.money_permission` (default
tickets.costs.view) - absent from the answer otherwise, never null. Each open is audited (`tickets.stats.view`, the contact id and the
window only: a reputation read is a read about a business's people, section 10). An unknown, erased, employee or Arx-user contact is the
uniform 404 of the directory. Behind the module switch and `vendor_stats.enabled` (404 `feature_disabled`). Never on the public page.
Slice 2: GET /tickets/contacts/{id}/stats/tickets?metric=...&months=3|12|36 - the requests behind one number of the card, filtered by the
usual ticket visibility (a request the caller may not see is not listed and not counted in `total`), cut at `vendor_stats.list_limit`;
the money metrics (kept, overshoot) need the money permission (403, audited); a number the settings hide is `metric_hidden` (404).
Mounted BEFORE routers/tickets_contacts.py's `/tickets/contacts/{id}` would not catch it anyway (one more path segment), and before
routers/tickets.py."""
from __future__ import annotations

import datetime as dt
import sqlite3
from typing import Any, Literal

from fastapi import APIRouter, Depends, Path, Query, Request

from ..audit import audit
from ..auth import current_principal, get_conn
from ..errors import ApiError
from ..rbac import Principal
from ..services.tickets import access, present, vendor_stats
from ..services.tickets.access import Viewer, text
from .tickets import ID, module_gate

router = APIRouter(dependencies=[Depends(module_gate)])


def _rid(request: Request) -> str | None:
    return getattr(request.state, "correlation_id", None)


@router.get("/tickets/contacts/{contact_id}/stats")
def contact_stats(request: Request, contact_id: str = Path(..., pattern=ID), months: int | None = Query(None),
                  principal: Principal = Depends(current_principal), conn: sqlite3.Connection = Depends(get_conn)) -> dict[str, Any]:
    viewer = Viewer(conn, principal)
    rid = _rid(request)
    c = vendor_stats.cfg(conn)
    if not access.module_on(conn) or not c["enabled"]:
        raise ApiError(404, "feature_disabled", text(conn, "נתוני ספקים כבויים בהגדרות {the_tickets}."))
    perm = c["card_permission"]
    if perm not in viewer.anywhere and access.DIRECTORY not in viewer.anywhere:
        audit(conn, actor=principal, action="tickets.stats.view", decision="denied", resource_type="ticket_contact", resource_id=contact_id,
              reason="permission_missing", request_id=rid, details={"permission": perm})
        raise ApiError(403, "forbidden", text(conn, "אין הרשאה לפעולה הזו."), details={"permission": perm})
    m = months if months is not None else int(c["default_months"])
    if m not in vendor_stats.MONTHS:
        raise ApiError(422, "validation", text(conn, "ערך לא תקין."), details={"fields": [{"field": "months", "code": "invalid"}]})
    money = c["money_permission"] in viewer.anywhere
    try:
        out = vendor_stats.compute(conn, contact_id, months=m, now=dt.datetime.now(dt.timezone.utc).replace(microsecond=0), money=money)
    except vendor_stats.NoCard:
        raise ApiError(404, "contact_not_found", text(conn, "איש הקשר לא נמצא.")) from None
    audit(conn, actor=principal, action="tickets.stats.view", decision="allowed", resource_type="ticket_contact", resource_id=contact_id,
          request_id=rid, details={"unit_id": out["unit_id"], "months": m, "money": money})
    out["money"] = money
    out["months_choices"] = list(vendor_stats.MONTHS)
    return out


@router.get("/tickets/contacts/{contact_id}/stats/tickets")
def contact_stats_tickets(
        request: Request, contact_id: str = Path(..., pattern=ID),
        metric: Literal["response", "on_time", "late", "missed", "repeat", "kept", "overshoot", "returned", "done", "open"] = Query(...),
        months: int | None = Query(None), principal: Principal = Depends(current_principal), conn: sqlite3.Connection = Depends(get_conn)) -> dict[str, Any]:
    viewer = Viewer(conn, principal)
    rid = _rid(request)
    c = vendor_stats.cfg(conn)
    if not access.module_on(conn) or not c["enabled"]:
        raise ApiError(404, "feature_disabled", text(conn, "נתוני ספקים כבויים בהגדרות {the_tickets}."))
    perm = c["card_permission"]
    if perm not in viewer.anywhere and access.DIRECTORY not in viewer.anywhere:
        audit(conn, actor=principal, action="tickets.stats.list", decision="denied", resource_type="ticket_contact", resource_id=contact_id,
              reason="permission_missing", request_id=rid, details={"permission": perm, "metric": metric})
        raise ApiError(403, "forbidden", text(conn, "אין הרשאה לפעולה הזו."), details={"permission": perm})
    m = months if months is not None else int(c["default_months"])
    if m not in vendor_stats.MONTHS:
        raise ApiError(422, "validation", text(conn, "ערך לא תקין."), details={"fields": [{"field": "months", "code": "invalid"}]})
    money = c["money_permission"] in viewer.anywhere
    try:
        rows = vendor_stats.tickets_behind(conn, contact_id, metric, months=m, now=dt.datetime.now(dt.timezone.utc).replace(microsecond=0), money=money)
    except vendor_stats.NoCard:
        raise ApiError(404, "contact_not_found", text(conn, "איש הקשר לא נמצא.")) from None
    except vendor_stats.MoneyNeeded:
        audit(conn, actor=principal, action="tickets.stats.list", decision="denied", resource_type="ticket_contact", resource_id=contact_id,
              reason="money_permission_missing", request_id=rid, details={"permission": c["money_permission"], "metric": metric})
        raise ApiError(403, "forbidden", text(conn, "אין הרשאה לפעולה הזו."), details={"permission": c["money_permission"]}) from None
    except vendor_stats.MetricHidden:
        raise ApiError(404, "metric_hidden", text(conn, "המספר הזה כבוי בהגדרות.")) from None
    seen = access.visible_by_ids(viewer, [r["ticket_id"] for r in rows])
    visible = [r for r in rows if r["ticket_id"] in seen]
    limit = int(c["list_limit"])
    lk = present.Lookups(conn)
    items = [{**present.ticket_item(conn, seen[r["ticket_id"]], lk), "at": r["at"], "detail": r["detail"]} for r in visible[:limit]]
    audit(conn, actor=principal, action="tickets.stats.list", decision="allowed", resource_type="ticket_contact", resource_id=contact_id,
          request_id=rid, details={"metric": metric, "months": m, "listed": len(items), "total": len(visible)})
    return {"contact_id": contact_id, "metric": metric, "number": vendor_stats.METRICS[metric][0], "months": m, "money": money,
            "total": len(visible), "limit": limit, "truncated": len(visible) > limit, "items": items}
