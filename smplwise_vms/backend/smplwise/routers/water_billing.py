"""CR-WATER78 slice 3 (section 16, mockup v4 APPROVED 24.10): the water billing API (`/api/v1/infra/water/...`): customers (the shared card),
water + sewage tariffs, accounts (signed meter formula), bills and tenant chargeback, and a read of the SHARED billing settings.

Module switch: every route answers `module_off` (404) while `water.enabled` is off - before any permission check.
Permissions (installation scope, as the electricity billing): `water.view` - accounts and consumption WITHOUT money; `water.manage` - accounts,
tariffs and customers (create / edit); `water.bills` (sensitive, never implied; site / system administrators) - money (prices, amounts, open
balances), the bills and every bill action, the customers' contact fields. Money and contact fields are dropped server-side without it.
VAT, the business details, the payment terms, the numbering and the retention are the electricity billing settings: read here, edited only
in the electricity settings (owner correction 24.10). The permission is decided on a read connection before the body (auth.read_gate)."""
from __future__ import annotations

import datetime as dt
import json
import sqlite3
from typing import Any, Literal

from fastapi import APIRouter, Depends, Query, Request, Response
from fastapi.responses import JSONResponse
from pydantic import Field

from ..audit import audit
from ..auth import get_conn, get_read_conn, read_gate, settings_of
from ..errors import ApiError
from ..rbac import INSTALLATION, Principal, authorize, require
from ..services import energy_billing as eb
from ..services import energy_formula as fx
from ..services import energy_periods as per
from ..services import energy_pricing as px
from ..services import water_billing as wb
from ..services import water_settings as ws
from .energy_billing import CustomerCreate, CustomerPatch, FormulaIn, PaidIn, PeriodIn, PresetIn, RowVersionIn, SentIn, VoidIn, _Body, _parse, _raw_body
from .water import module_off

router = APIRouter()
API = "/infra/water"
VIEW, MANAGE, BILLS = wb.VIEW, wb.MANAGE, wb.BILLS
RID = Field(min_length=8, max_length=80)


# ---------------------------------------------------------------- bodies (the electricity bodies where they are the same)

class AccountCreate(_Body):
    name: str = Field(min_length=1, max_length=200)
    customer_id: str = Field(min_length=1, max_length=64)
    formula: FormulaIn
    tariff_id: str = Field(min_length=1, max_length=64)
    period_months: Literal[1, 2] = 1
    period_anchor_day: int = Field(default=1, ge=1, le=31)
    period_anchor_month: int = Field(default=1, ge=1, le=12)
    first_period_start: dt.date
    timezone: str | None = Field(default=None, max_length=64)
    auto_mode: Literal["off", "draft", "issue"] = "draft"


class AccountPatch(_Body):
    base_revision: int
    name: str | None = Field(default=None, min_length=1, max_length=200)
    customer_id: str | None = Field(default=None, max_length=64)
    formula: FormulaIn | None = None
    tariff_id: str | None = Field(default=None, max_length=64)
    period_months: Literal[1, 2] | None = None
    period_anchor_day: int | None = Field(default=None, ge=1, le=31)
    period_anchor_month: int | None = Field(default=None, ge=1, le=12)
    first_period_start: dt.date | None = None
    timezone: str | None = Field(default=None, max_length=64)
    auto_mode: Literal["off", "draft", "issue"] | None = None
    status: Literal["active", "paused"] | None = None


class TariffCreate(_Body):
    name: str = Field(min_length=1, max_length=120)
    water_price: str | int | float
    sewage_price: str | int | float = "0"
    price_mode: Literal["ex_vat", "inc_vat"] | None = None
    effective_from: dt.date


class TariffPatch(_Body):
    name: str = Field(min_length=1, max_length=120)


class VersionIn(_Body):
    effective_from: dt.date
    water_price: str | int | float
    sewage_price: str | int | float = "0"
    price_mode: Literal["ex_vat", "inc_vat"] | None = None


class BillCreate(_Body):
    period: PeriodIn | None = None
    client_request_id: str = RID


class IssueIn(_Body):
    row_version: int
    client_request_id: str = RID
    issue_date: dt.date | None = None


class CorrectIn(_Body):
    client_request_id: str = RID


# ---------------------------------------------------------------- plumbing

def _rid(request: Request) -> str | None:
    return getattr(request.state, "correlation_id", None)


def _has(conn: sqlite3.Connection, principal: Principal, perm: str) -> bool:
    return authorize(conn, principal, perm, INSTALLATION).allowed


def _gate(*perms: str):
    def check(conn: sqlite3.Connection, principal: Principal) -> None:
        if not ws.enabled(conn):
            raise module_off()
        if not any(_has(conn, principal, p) for p in perms):
            require(conn, principal, perms[0], INSTALLATION)  # the audited 403

    return read_gate(check)


_view = _gate(VIEW, MANAGE, BILLS)
_manage = _gate(MANAGE)
_customers_read = _gate(BILLS, MANAGE)
_money_read = _gate(MANAGE, BILLS)
_bills = _gate(BILLS)


def _db(request: Request):
    return request.app.state.db


def _tz(conn: sqlite3.Connection) -> str:
    from .settings import read_settings

    return read_settings(conn)["time.zone"]


def _today(tz: str) -> dt.date:
    return per.local_date(wb.now_utc(), tz)


def _provider(conn: sqlite3.Connection, request: Request) -> wb.WaterReadings:
    return wb.provider_for(conn, settings_of(request))


def _a(conn: sqlite3.Connection, principal: Principal, action: str, rtype: str, rid: str, request: Request, details: dict[str, Any] | None = None) -> None:
    audit(conn, actor=principal, action=f"infra.water.{action}", decision="allowed", resource_type=rtype, resource_id=rid, request_id=_rid(request), details=details)


# ====================================================================== the shared billing settings (read only here)

@router.get(f"{API}/billing/shared")
def shared_settings(principal: Principal = Depends(_money_read), conn: sqlite3.Connection = Depends(get_read_conn)) -> dict[str, Any]:
    """What water billing takes from the electricity billing settings as it is (no copy): the VAT in force and its history, the payment
    terms, the numbering, the business name, the default price entry mode, the retention keys, and where they are edited."""
    s = eb.read_settings(conn)
    today = _today(_tz(conn))
    rates = eb.vat_rates(conn)
    cur = px.in_force(rates, today)
    return {"vat": {"current": {"effective_from": cur.effective_from.isoformat(), "rate_percent": px.pct_str(cur.rate)} if cur else None,
                    "items": [{"effective_from": r.effective_from.isoformat(), "rate_percent": px.pct_str(r.rate)} for r in rates]},
            "payment_terms": s["payment_terms"], "numbering": s["numbering"], "default_price_mode": s["default_price_mode"], "auto": s["auto"],
            "business": {"name": s["business"]["name"], "registration_no": s["business"]["registration_no"]},
            "retention": {"draft_days": eb._int_setting(conn, "energy.draft_retention_days", 30, 7, 365),
                          "bill_years": eb._int_setting(conn, "energy.bill_retention_years", 7, 1, 15)},
            "edit_link": "#/system/infra", "can_edit": _has(conn, principal, "energy.manage")}


# ====================================================================== customers (the shared card)

@router.get(f"{API}/customers")
def list_customers(principal: Principal = Depends(_customers_read), conn: sqlite3.Connection = Depends(get_read_conn),
                   q: str | None = Query(None, max_length=80), limit: int = Query(200, ge=1, le=500), offset: int = Query(0, ge=0)) -> dict[str, Any]:
    money = _has(conn, principal, BILLS)
    sql = "SELECT * FROM energy_customers WHERE deleted_at IS NULL"
    args: list[Any] = []
    if q:
        sql += " AND (name LIKE ? OR customer_number LIKE ?)"
        args += [f"%{q}%", f"%{q}%"]
    total = conn.execute(f"SELECT COUNT(*) FROM ({sql})", args).fetchone()[0]
    rows = conn.execute(sql + " ORDER BY customer_number LIMIT ? OFFSET ?", (*args, limit, offset)).fetchall()
    return {"items": [wb.customer_dict(conn, r, money, money) for r in rows], "total": total, "shared_with": "electricity"}


@router.get(f"{API}/customers/next-number")
def next_number(principal: Principal = Depends(_manage), conn: sqlite3.Connection = Depends(get_read_conn)) -> dict[str, Any]:
    return {"customer_number": eb.next_customer_number(conn)}


@router.post(f"{API}/customers", status_code=201)
def create_customer(request: Request, principal: Principal = Depends(_manage), raw: bytes = Depends(_raw_body), conn: sqlite3.Connection = Depends(get_conn)) -> dict[str, Any]:
    body = _parse(request, raw, CustomerCreate)
    cid = eb.create_customer(conn, principal.user_id, body.model_dump())
    _a(conn, principal, "customer.create", "energy_customer", cid, request)
    return wb.customer_dict(conn, eb.get_customer(conn, cid), True, _has(conn, principal, BILLS))


@router.get(f"{API}/customers/{{cid}}")
def get_customer(cid: str, principal: Principal = Depends(_customers_read), conn: sqlite3.Connection = Depends(get_read_conn)) -> dict[str, Any]:
    money = _has(conn, principal, BILLS)
    out = wb.customer_dict(conn, eb.get_customer(conn, cid), money, money)  # contact fields and money: water.bills only (section 16)
    out["accounts"] = [{"id": a["id"], "name": a["name"], "status": a["status"]} for a in wb.water_accounts_of(conn, cid)]
    if money:
        out["bills"] = [wb.bill_summary(conn, b) for b in conn.execute("SELECT * FROM water_bills WHERE customer_id = ? ORDER BY period_end DESC, revision DESC LIMIT 24", (cid,)).fetchall()]
    return out


@router.patch(f"{API}/customers/{{cid}}")
def patch_customer(cid: str, request: Request, principal: Principal = Depends(_manage), raw: bytes = Depends(_raw_body), conn: sqlite3.Connection = Depends(get_conn)) -> dict[str, Any]:
    body = _parse(request, raw, CustomerPatch)
    changed = eb.update_customer(conn, cid, body.model_dump(exclude_unset=True))
    _a(conn, principal, "customer.update", "energy_customer", cid, request, {"fields": changed})
    return wb.customer_dict(conn, eb.get_customer(conn, cid), True, _has(conn, principal, BILLS))


@router.delete(f"{API}/customers/{{cid}}", status_code=204)
def delete_customer(cid: str, request: Request, base_revision: int = Query(...), principal: Principal = Depends(_manage), conn: sqlite3.Connection = Depends(get_conn)) -> Response:
    wb.delete_customer(conn, cid, base_revision)
    _a(conn, principal, "customer.delete", "energy_customer", cid, request)
    return Response(status_code=204)


# ====================================================================== tariffs (water + sewage per m3)

def _prices(water: Any, sewage: Any) -> tuple[px.Decimal, px.Decimal]:
    return wb.parse_component(water, "water_price", allow_zero=False), wb.parse_component(sewage, "sewage_price", allow_zero=True)


@router.get(f"{API}/tariffs")
def list_tariffs(principal: Principal = Depends(_money_read), conn: sqlite3.Connection = Depends(get_read_conn)) -> dict[str, Any]:
    today = _today(_tz(conn))
    return {"items": [wb.tariff_dict(conn, r, today) for r in conn.execute("SELECT * FROM water_tariffs WHERE deleted_at IS NULL ORDER BY name").fetchall()]}


@router.post(f"{API}/tariffs", status_code=201)
def create_tariff(request: Request, principal: Principal = Depends(_manage), raw: bytes = Depends(_raw_body), conn: sqlite3.Connection = Depends(get_conn)) -> dict[str, Any]:
    body = _parse(request, raw, TariffCreate)
    water, sewage = _prices(body.water_price, body.sewage_price)
    mode = body.price_mode or eb.read_settings(conn)["default_price_mode"]  # the SHARED default price entry mode
    tid = wb.create_tariff(conn, principal.user_id, body.name, body.effective_from, water, sewage, mode)
    _a(conn, principal, "tariff.create", "water_tariff", tid, request)
    return wb.tariff_dict(conn, wb.get_tariff(conn, tid), _today(_tz(conn)))


@router.patch(f"{API}/tariffs/{{tid}}")
def patch_tariff(tid: str, request: Request, principal: Principal = Depends(_manage), raw: bytes = Depends(_raw_body), conn: sqlite3.Connection = Depends(get_conn)) -> dict[str, Any]:
    body = _parse(request, raw, TariffPatch)
    wb.get_tariff(conn, tid)
    conn.execute("UPDATE water_tariffs SET name = ?, updated_at = ? WHERE id = ?", (body.name.strip(), wb.now_iso(), tid))
    _a(conn, principal, "tariff.update", "water_tariff", tid, request)
    return wb.tariff_dict(conn, wb.get_tariff(conn, tid), _today(_tz(conn)))


@router.delete(f"{API}/tariffs/{{tid}}", status_code=204)
def delete_tariff(tid: str, request: Request, principal: Principal = Depends(_manage), conn: sqlite3.Connection = Depends(get_conn)) -> Response:
    wb.delete_tariff(conn, tid)
    _a(conn, principal, "tariff.delete", "water_tariff", tid, request)
    return Response(status_code=204)


@router.post(f"{API}/tariffs/{{tid}}/versions", status_code=201)
def add_version(tid: str, request: Request, principal: Principal = Depends(_manage), raw: bytes = Depends(_raw_body), conn: sqlite3.Connection = Depends(get_conn)) -> dict[str, Any]:
    body = _parse(request, raw, VersionIn)
    wb.get_tariff(conn, tid)
    water, sewage = _prices(body.water_price, body.sewage_price)
    vid = wb.add_version(conn, tid, principal.user_id, body.effective_from, water, sewage, body.price_mode or eb.read_settings(conn)["default_price_mode"])
    _a(conn, principal, "tariff.version.create", "water_tariff", tid, request, {"version_id": vid, "effective_from": body.effective_from.isoformat()})
    out = wb.tariff_dict(conn, wb.get_tariff(conn, tid), _today(_tz(conn)))
    out["drafts"] = wb.recompute_drafts(conn, _provider(conn, request), tid, principal, _rid(request))
    return out


@router.patch(f"{API}/tariffs/{{tid}}/versions/{{vid}}")
def patch_version(tid: str, vid: str, request: Request, principal: Principal = Depends(_manage), raw: bytes = Depends(_raw_body), conn: sqlite3.Connection = Depends(get_conn)) -> dict[str, Any]:
    """Correct a price version that no issued bill used (a used one is locked: add a later version). The drafts on the tariff are recalculated."""
    body = _parse(request, raw, VersionIn)
    wb.get_tariff(conn, tid)
    water, sewage = _prices(body.water_price, body.sewage_price)
    wb.update_version(conn, tid, vid, body.effective_from, water, sewage, body.price_mode or eb.read_settings(conn)["default_price_mode"])
    _a(conn, principal, "tariff.version.correct", "water_tariff", tid, request, {"version_id": vid})
    out = wb.tariff_dict(conn, wb.get_tariff(conn, tid), _today(_tz(conn)))
    out["drafts"] = wb.recompute_drafts(conn, _provider(conn, request), tid, principal, _rid(request))
    return out


@router.delete(f"{API}/tariffs/{{tid}}/versions/{{vid}}", status_code=204)
def delete_version(tid: str, vid: str, request: Request, principal: Principal = Depends(_manage), conn: sqlite3.Connection = Depends(get_conn)) -> Response:
    wb.delete_version(conn, tid, vid)
    _a(conn, principal, "tariff.version.delete", "water_tariff", tid, request, {"version_id": vid})
    return Response(status_code=204)


# ====================================================================== accounts

@router.get(f"{API}/accounts")
def list_accounts(request: Request, principal: Principal = Depends(_view), conn: sqlite3.Connection = Depends(get_read_conn), customer_id: str | None = Query(None, max_length=64),
                  q: str | None = Query(None, max_length=80), status: Literal["active", "paused"] | None = None) -> dict[str, Any]:
    money = _has(conn, principal, BILLS)
    sql, args = "SELECT * FROM water_accounts WHERE deleted_at IS NULL", []
    if customer_id:
        sql += " AND customer_id = ?"
        args.append(customer_id)
    if q:
        sql += " AND (name LIKE ? OR customer_id IN (SELECT id FROM energy_customers WHERE name LIKE ?))"
        args += [f"%{q}%", f"%{q}%"]
    if status:
        sql += " AND status = ?"
        args.append(status)
    provider = _provider(conn, request)
    items = [wb.account_dict(conn, provider, r, money) for r in conn.execute(sql + " ORDER BY name", args).fetchall()]
    drafts = conn.execute("SELECT COUNT(*) FROM water_bills WHERE state = 'draft'").fetchone()[0] if money else None
    return {"items": items, "summary": {"active": sum(1 for a in items if a["status"] == "active"), "drafts": drafts}}


@router.post(f"{API}/accounts", status_code=201)
def create_account(request: Request, principal: Principal = Depends(_manage), raw: bytes = Depends(_raw_body), conn: sqlite3.Connection = Depends(get_conn)) -> dict[str, Any]:
    body = _parse(request, raw, AccountCreate)
    provider = _provider(conn, request)
    data = body.model_dump()
    data["formula"] = body.formula.model_dump()
    aid = wb.create_account(conn, provider, principal.user_id, data, _tz(conn))
    _a(conn, principal, "account.create", "water_account", aid, request, {"meters": fx.meter_ids(json.loads(wb.get_account(conn, aid)["formula_json"]))})
    return wb.account_dict(conn, provider, wb.get_account(conn, aid), _has(conn, principal, BILLS))


@router.get(f"{API}/accounts/{{aid}}")
def get_account(aid: str, request: Request, principal: Principal = Depends(_view), conn: sqlite3.Connection = Depends(get_read_conn)) -> dict[str, Any]:
    return wb.account_dict(conn, _provider(conn, request), wb.get_account(conn, aid), _has(conn, principal, BILLS))


@router.patch(f"{API}/accounts/{{aid}}")
def patch_account(aid: str, request: Request, principal: Principal = Depends(_manage), raw: bytes = Depends(_raw_body), conn: sqlite3.Connection = Depends(get_conn)) -> dict[str, Any]:
    body = _parse(request, raw, AccountPatch)
    data = body.model_dump(exclude_unset=True)
    if body.formula is not None:
        data["formula"] = body.formula.model_dump()
    provider = _provider(conn, request)
    changed = wb.update_account(conn, provider, aid, data, _tz(conn))
    _a(conn, principal, "account.update", "water_account", aid, request, {"fields": changed})
    return wb.account_dict(conn, provider, wb.get_account(conn, aid), _has(conn, principal, BILLS))


@router.delete(f"{API}/accounts/{{aid}}", status_code=204)
def delete_account(aid: str, request: Request, base_revision: int = Query(...), principal: Principal = Depends(_manage), conn: sqlite3.Connection = Depends(get_conn)) -> Response:
    drafts = wb.delete_account(conn, aid, base_revision)
    _a(conn, principal, "account.delete", "water_account", aid, request, {"drafts_deleted": drafts})
    return Response(status_code=204)


@router.get(f"{API}/accounts/{{aid}}/status")
def account_status(aid: str, request: Request, principal: Principal = Depends(_view), conn: sqlite3.Connection = Depends(get_read_conn)) -> dict[str, Any]:
    """The open period so far: the meters of the formula with opening / current reading and consumption; stale meters named."""
    return wb.account_status(conn, _provider(conn, request), wb.get_account(conn, aid), _has(conn, principal, BILLS))


@router.get(f"{API}/accounts/{{aid}}/history")
def account_history(aid: str, request: Request, principal: Principal = Depends(_view), conn: sqlite3.Connection = Depends(get_read_conn),
                    past: int = Query(12, ge=1, le=24)) -> dict[str, Any]:
    return wb.account_history(conn, _provider(conn, request), wb.get_account(conn, aid), past, _has(conn, principal, BILLS))


@router.get(f"{API}/accounts/{{aid}}/bills")
def account_bills(aid: str, principal: Principal = Depends(_bills), conn: sqlite3.Connection = Depends(get_read_conn)) -> dict[str, Any]:
    wb.get_account(conn, aid)
    return {"items": [wb.bill_summary(conn, r) for r in conn.execute("SELECT * FROM water_bills WHERE account_id = ? ORDER BY period_end DESC, revision DESC", (aid,)).fetchall()]}


@router.post(f"{API}/formula/preset")
def formula_preset(request: Request, principal: Principal = Depends(_view), raw: bytes = Depends(_raw_body), conn: sqlite3.Connection = Depends(get_read_conn)) -> dict[str, Any]:
    """The formula presets of electricity over water meters: sum, main minus the sub-meters (the losses account), share."""
    body = _parse(request, raw, PresetIn)
    try:
        ast = fx.preset(body.preset, body.meter_ids, body.main_meter_id, body.percent)
    except fx.FormulaError as e:
        raise eb.formula_error(e) from None
    api = eb.formula_api(_provider(conn, request), ast)
    return {"ast": ast, "text": api["text"], "sentence_he": api["sentence_he"]}


# ====================================================================== bills

@router.get(f"{API}/bills")
def list_bills(principal: Principal = Depends(_bills), conn: sqlite3.Connection = Depends(get_read_conn), account_id: str | None = Query(None, max_length=64),
               customer_id: str | None = Query(None, max_length=64), state: Literal["draft", "issued", "sent", "paid", "void"] | None = None,
               q: str | None = Query(None, max_length=80), limit: int = Query(200, ge=1, le=500), offset: int = Query(0, ge=0)) -> dict[str, Any]:
    where, args = ["1=1"], []
    if account_id:
        where.append("b.account_id = ?")
        args.append(account_id)
    if customer_id:
        where.append("b.customer_id = ?")
        args.append(customer_id)
    if q:
        where.append("(b.number LIKE ? OR a.name LIKE ? OR c.name LIKE ? OR c.customer_number LIKE ?)")
        args += [f"%{q}%"] * 4
    base = f"FROM water_bills b LEFT JOIN water_accounts a ON a.id = b.account_id LEFT JOIN energy_customers c ON c.id = b.customer_id WHERE {' AND '.join(where)}"
    counts = {s: 0 for s in ("draft", "issued", "sent", "paid", "void")}
    sums = {"open": px.Decimal("0.00"), "paid": px.Decimal("0.00")}
    for r in conn.execute(f"SELECT b.state, COUNT(*) {base} GROUP BY b.state", args).fetchall():
        counts[r[0]] = r[1]
    for r in conn.execute(f"SELECT b.state, b.total {base} AND b.state IN ('issued','sent','paid')", args).fetchall():
        sums["paid" if r[0] == "paid" else "open"] += px.Decimal(r[1] or "0")
    if state:
        base += " AND b.state = ?"
        args.append(state)
    total = conn.execute(f"SELECT COUNT(*) {base}", args).fetchone()[0]
    rows = conn.execute(f"SELECT b.* {base} ORDER BY b.period_end DESC, b.created_at DESC LIMIT ? OFFSET ?", (*args, limit, offset)).fetchall()
    return {"items": [wb.bill_summary(conn, r) for r in rows], "total": total, "counts": counts, "sums": {k: str(px.r2(v)) for k, v in sums.items()}}


def _same_request(conn: sqlite3.Connection, row: sqlite3.Row, aid: str) -> JSONResponse:
    if row["account_id"] != aid:
        raise ApiError(409, "request_reused", "מזהה הבקשה כבר שימש לחשבון אחר.")
    return JSONResponse(status_code=200, content=wb.bill_dict(conn, row))


@router.post(f"{API}/accounts/{{aid}}/bills", status_code=201)
def create_bill(aid: str, request: Request, principal: Principal = Depends(_bills), raw: bytes = Depends(_raw_body), rconn: sqlite3.Connection = Depends(get_read_conn)) -> JSONResponse:
    body = _parse(request, raw, BillCreate)
    existing = wb.by_create_request(rconn, body.client_request_id)
    if existing is not None:
        return _same_request(rconn, existing, aid)
    acc = wb.get_account(rconn, aid)
    p = wb.resolve_period(acc, {"from": body.period.from_, "to": body.period.to} if body.period else None, wb.now_utc())
    hit = wb.overlapping(rconn, aid, p)
    if hit is not None:
        raise wb.overlap_error(hit)
    comp = wb.compute(rconn, _provider(rconn, request), acc, p)
    with _db(request).connection(label="water.bill.create") as w:
        again = wb.by_create_request(w, body.client_request_id)
        if again is not None:
            return _same_request(w, again, aid)
        cur = wb.get_account(w, aid)
        if cur["revision"] != acc["revision"]:
            raise ApiError(409, "revision_conflict", "החשבון שונה בזמן החישוב. יש לנסות שוב.", details={"current_revision": cur["revision"]})
        bid = wb.insert_draft(w, cur, p, comp, actor=principal, origin="manual", request_id=_rid(request), client_request_id=body.client_request_id)
        return JSONResponse(status_code=201, content=wb.bill_dict(w, wb.get_bill(w, bid)))


@router.get(f"{API}/bills/{{bid}}")
def get_bill(bid: str, principal: Principal = Depends(_bills), conn: sqlite3.Connection = Depends(get_read_conn)) -> dict[str, Any]:
    return wb.bill_dict(conn, wb.get_bill(conn, bid))


@router.get(f"{API}/bills/{{bid}}/events")
def bill_events(bid: str, principal: Principal = Depends(_bills), conn: sqlite3.Connection = Depends(get_read_conn)) -> dict[str, Any]:
    wb.get_bill(conn, bid)
    rows = conn.execute("SELECT * FROM water_bill_events WHERE bill_id = ? ORDER BY at, rowid", (bid,)).fetchall()
    return {"items": [{"at": r["at"], "action": r["action"], "actor": {"kind": r["actor_kind"], "display_name": r["actor_name"]},
                       "details": json.loads(r["details_json"]) if r["details_json"] else None} for r in rows]}


def _replaces(conn: sqlite3.Connection, bill: sqlite3.Row) -> sqlite3.Row | None:
    return wb.get_bill(conn, bill["replaces_bill_id"]) if bill["replaces_bill_id"] else None


def _period(bill: sqlite3.Row) -> per.Period:
    return per.Period(wb._date(bill["period_start"]), wb._date(bill["period_end"]))


@router.post(f"{API}/bills/{{bid}}/recalculate")
def recalculate(bid: str, request: Request, principal: Principal = Depends(_bills), raw: bytes = Depends(_raw_body), rconn: sqlite3.Connection = Depends(get_read_conn)) -> dict[str, Any]:
    body = _parse(request, raw, RowVersionIn)
    bill = wb.get_bill(rconn, bid)
    if bill["state"] != "draft":
        raise ApiError(409, "bill_not_draft", "החיוב אינו טיוטה.", details={"state": bill["state"]})
    acc = wb.get_account(rconn, bill["account_id"])
    comp = wb.compute(rconn, _provider(rconn, request), acc, _period(bill), origin=bill["origin"], replaces=_replaces(rconn, bill), bill_id=bid)
    with _db(request).connection(label="water.bill.recalculate") as w:
        wb.store_recalculated(w, bill, comp, principal, _rid(request), body.row_version)
        return wb.bill_dict(w, wb.get_bill(w, bid))


@router.delete(f"{API}/bills/{{bid}}", status_code=204)
def delete_bill(bid: str, request: Request, row_version: int = Query(...), principal: Principal = Depends(_bills), conn: sqlite3.Connection = Depends(get_conn)) -> Response:
    wb.delete_draft(conn, bid, row_version, principal, _rid(request))
    return Response(status_code=204)


@router.post(f"{API}/bills/{{bid}}/issue")
def issue(bid: str, request: Request, principal: Principal = Depends(_bills), raw: bytes = Depends(_raw_body), rconn: sqlite3.Connection = Depends(get_read_conn)) -> dict[str, Any]:
    body = _parse(request, raw, IssueIn)
    bill = wb.get_bill(rconn, bid)
    if bill["state"] != "draft":
        if bill["issue_request_id"] and bill["issue_request_id"] == body.client_request_id:
            return wb.bill_dict(rconn, bill)
        raise ApiError(409, "bill_not_draft", "החיוב כבר הונפק.", details={"state": bill["state"], "number": bill["number"]})
    if bill["row_version"] != body.row_version:
        raise ApiError(409, "revision_conflict", "החיוב שונה בינתיים. יש לרענן ולנסות שוב.", details={"current_revision": bill["row_version"]})
    acc = wb.get_account_any(rconn, bill["account_id"])
    p = _period(bill)
    today = _today(acc["timezone"])
    if today < p.end:
        raise ApiError(422, "period_invalid", "התקופה עוד לא הסתיימה; אפשר להנפיק רק אחרי סופה.")
    issue_date = body.issue_date or today
    if issue_date > today or issue_date < p.end:
        raise ApiError(422, "validation", "תאריך ההנפקה חייב להיות אחרי סוף התקופה ולא בעתיד.", details={"fields": ["issue_date"]})
    comp = wb.compute(rconn, _provider(rconn, request), acc, p, origin=bill["origin"], replaces=_replaces(rconn, bill), bill_id=bid)
    stale = comp.total != bill["total"] or comp.m3 != bill["m3"]
    with _db(request).connection(label="water.bill.issue") as w:
        cur = wb.get_bill(w, bid)
        if cur["state"] != "draft":
            if cur["issue_request_id"] and cur["issue_request_id"] == body.client_request_id:
                return wb.bill_dict(w, cur)
            raise ApiError(409, "bill_not_draft", "החיוב כבר הונפק.", details={"state": cur["state"], "number": cur["number"]})
        if cur["row_version"] != body.row_version:
            raise ApiError(409, "revision_conflict", "החיוב שונה בינתיים. יש לרענן ולנסות שוב.", details={"current_revision": cur["row_version"]})
        if stale:
            wb.store_recalculated(w, cur, comp, principal, _rid(request), body.row_version)
            fresh = wb.get_bill(w, bid)
            raise ApiError(409, "draft_stale", "הנתונים התעדכנו מאז שהטיוטה הוצגה. יש לעיין בטיוטה המעודכנת ולהנפיק שוב.",
                           details={"old_total": bill["total"], "new_total": comp.total, "old_m3": bill["m3"], "new_m3": comp.m3, "row_version": fresh["row_version"]})
        wb.seal(w, cur, comp, actor=principal, issue_date=issue_date, request_id=_rid(request), client_request_id=body.client_request_id)
        return wb.bill_dict(w, wb.get_bill(w, bid))


@router.post(f"{API}/bills/{{bid}}/sent")
def mark_sent(bid: str, request: Request, principal: Principal = Depends(_bills), raw: bytes = Depends(_raw_body), conn: sqlite3.Connection = Depends(get_conn)) -> dict[str, Any]:
    body = _parse(request, raw, SentIn)
    bill = wb.get_bill(conn, bid)
    at = (body.at or _today(wb.get_account_any(conn, bill["account_id"])["timezone"])).isoformat()
    wb.mark_sent(conn, bid, at, body.how, body.note, principal, _rid(request), body.row_version)
    return wb.bill_dict(conn, wb.get_bill(conn, bid))


@router.post(f"{API}/bills/{{bid}}/paid")
def mark_paid(bid: str, request: Request, principal: Principal = Depends(_bills), raw: bytes = Depends(_raw_body), conn: sqlite3.Connection = Depends(get_conn)) -> dict[str, Any]:
    body = _parse(request, raw, PaidIn)
    bill = wb.get_bill(conn, bid)
    at = (body.at or _today(wb.get_account_any(conn, bill["account_id"])["timezone"])).isoformat()
    wb.mark_paid(conn, bid, at, body.reference, principal, _rid(request), body.row_version)
    return wb.bill_dict(conn, wb.get_bill(conn, bid))


@router.post(f"{API}/bills/{{bid}}/void")
def void(bid: str, request: Request, principal: Principal = Depends(_bills), raw: bytes = Depends(_raw_body), conn: sqlite3.Connection = Depends(get_conn)) -> dict[str, Any]:
    body = _parse(request, raw, VoidIn)
    wb.void_bill(conn, bid, body.reason, principal, _rid(request), body.row_version)
    return wb.bill_dict(conn, wb.get_bill(conn, bid))


@router.post(f"{API}/bills/{{bid}}/correct", status_code=201)
def correct(bid: str, request: Request, principal: Principal = Depends(_bills), raw: bytes = Depends(_raw_body), rconn: sqlite3.Connection = Depends(get_read_conn)) -> JSONResponse:
    body = _parse(request, raw, CorrectIn)
    existing = wb.by_create_request(rconn, body.client_request_id)
    if existing is not None and existing["replaces_bill_id"] == bid:
        return JSONResponse(status_code=200, content=wb.bill_dict(rconn, existing))
    orig = wb.get_bill(rconn, bid)
    wb.check_correctable(rconn, orig)
    acc = wb.get_account_any(rconn, orig["account_id"])
    p = _period(orig)
    comp = wb.compute(rconn, _provider(rconn, request), acc, p, origin="manual", replaces=orig)
    with _db(request).connection(label="water.bill.correct") as w:
        again = wb.by_create_request(w, body.client_request_id)
        if again is not None and again["replaces_bill_id"] == bid:
            return JSONResponse(status_code=200, content=wb.bill_dict(w, again))
        cur = wb.get_bill(w, bid)
        wb.check_correctable(w, cur)
        nid = wb.insert_draft(w, acc, p, comp, actor=principal, origin="manual", request_id=_rid(request), client_request_id=body.client_request_id, replaces=cur)
        return JSONResponse(status_code=201, content=wb.bill_dict(w, wb.get_bill(w, nid)))


@router.get(f"{API}/bills/{{bid}}/pdf")
def bill_pdf(bid: str, principal: Principal = Depends(_bills), conn: sqlite3.Connection = Depends(get_read_conn)) -> Response:
    """Not in this slice: the PDF model is the electricity snapshot's (kWh lines). Stated, never a wrong document."""
    wb.get_bill(conn, bid)
    raise ApiError(503, "pdf_unavailable", "הפקת PDF לחיוב מים תתווסף בהמשך.", details={"message_en": "The PDF of a water bill is not available yet.", "reason": "pdf_later"})
