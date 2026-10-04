"""CR-023 P2: the electricity billing API (/api/v1/energy/...): customers, accounts, the formula, tariffs and VAT, billing
settings and the logo, bills and their PDF, the automatic-generation runs. docs/architecture/ELECTRICITY_BILLING_API.md is the
contract.

The permission comes before the body (auth.read_gate: the audited 403 is decided on the read connection, the write lock is
opened only after the body has arrived); JSON only; closed bodies. Money (prices, amounts, totals) and customer contact
fields are dropped server-side for a caller without energy.bills. The bill computation reads the readings store on a read
connection, then a short write transaction re-checks the row version and stores the result."""
from __future__ import annotations

import datetime as dt
import hashlib
import json
import sqlite3
from typing import Any, Literal

from fastapi import APIRouter, Depends, Query, Request, Response
from fastapi.responses import JSONResponse
from pydantic import BaseModel, ConfigDict, Field, ValidationError

from ..auth import current_principal_ro, get_conn, get_read_conn, read_gate, settings_of
from ..audit import audit
from ..errors import ApiError
from ..rbac import INSTALLATION, Principal, authorize, require
from ..services import energy_billing as eb
from ..services import energy_billing_pdf as pdfseam
from ..services import energy_formula as fx
from ..services import energy_periods as per
from ..services import energy_pricing as px
from ..services.energy_billing_provider import get_provider
from ..services.energy_consumption import meter_window

router = APIRouter()

VIEW, MANAGE, BILLS = "energy.view", "energy.manage", "energy.bills"
RID = Field(min_length=8, max_length=80)


# ---------------------------------------------------------------- bodies

class _Body(BaseModel):
    model_config = ConfigDict(extra="forbid", populate_by_name=True)


class PeriodIn(_Body):
    from_: dt.date = Field(alias="from")
    to: dt.date


class FormulaIn(_Body):
    text: str | None = Field(default=None, max_length=fx.MAX_TEXT)
    ast: dict[str, Any] | None = None


class CustomerCreate(_Body):
    name: str = Field(min_length=1, max_length=200)
    customer_number: str | None = Field(default=None, max_length=12)
    address: str | None = Field(default=None, max_length=300)
    phone: str | None = Field(default=None, max_length=40)
    email: str | None = Field(default=None, max_length=200)
    tax_id: str | None = Field(default=None, max_length=20)
    notes: str | None = Field(default=None, max_length=1000)


class CustomerPatch(CustomerCreate):
    name: str | None = Field(default=None, min_length=1, max_length=200)  # type: ignore[assignment]
    base_revision: int


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


class FormulaCheck(_Body):
    formula: FormulaIn
    period: PeriodIn | None = None
    timezone: str | None = Field(default=None, max_length=64)


class PresetIn(_Body):
    preset: Literal["sum", "main_minus_subs", "share"]
    meter_ids: list[str] = Field(min_length=1, max_length=fx.MAX_METERS)
    main_meter_id: str | None = Field(default=None, max_length=64)
    percent: str | None = Field(default=None, max_length=12)


class TariffCreate(_Body):
    name: str = Field(min_length=1, max_length=120)
    price: str | int | float
    price_mode: Literal["ex_vat", "inc_vat"] | None = None
    effective_from: dt.date


class TariffPatch(_Body):
    name: str = Field(min_length=1, max_length=120)


class VersionBase(_Body):
    effective_from: dt.date
    price: str | int | float
    price_mode: Literal["ex_vat", "inc_vat"]


class VersionCreate(_Body):
    effective_from: dt.date
    price: str | int | float
    price_mode: Literal["ex_vat", "inc_vat"] | None = None
    replace_version_id: str | None = Field(default=None, max_length=64)  # a correction of this version (the date may change)
    base: VersionBase | None = None  # the values the editor saw; a mismatch means someone changed them meanwhile
    confirm: bool = False


class VatCreate(_Body):
    effective_from: dt.date
    rate_percent: str | int | float


class TermsIn(_Body):
    mode: Literal["net_days", "day_of_month"] | None = None
    days: int | None = Field(default=None, ge=0, le=120)
    day_of_month: int | None = Field(default=None, ge=1, le=31)


class BusinessIn(_Body):
    name: str | None = Field(default=None, max_length=200)
    registration_no: str | None = Field(default=None, max_length=30)
    address: str | None = Field(default=None, max_length=300)
    phone: str | None = Field(default=None, max_length=40)
    email: str | None = Field(default=None, max_length=200)
    accent_color: str | None = Field(default=None, max_length=7)
    footer_note: str | None = Field(default=None, max_length=500)


class NumberingIn(_Body):
    customer_digits: int = Field(ge=4, le=9)


class AutoIn(_Body):
    delay_hours: int = Field(ge=0, le=72)


class SettingsPut(_Body):
    base_revision: int | None = None
    default_price_mode: Literal["ex_vat", "inc_vat"] | None = None
    payment_terms: TermsIn | None = None
    business: BusinessIn | None = None
    numbering: NumberingIn | None = None
    auto: AutoIn | None = None


class BillCreate(_Body):
    period: PeriodIn | None = None
    client_request_id: str = RID


class RowVersionIn(_Body):
    row_version: int


class IssueIn(_Body):
    row_version: int
    client_request_id: str = RID
    issue_date: dt.date | None = None


class SentIn(_Body):
    at: dt.date | None = None
    how: Literal["email", "hand", "other"]
    note: str = Field(default="", max_length=300)
    row_version: int | None = None


class PaidIn(_Body):
    at: dt.date | None = None
    reference: str = Field(default="", max_length=100)
    row_version: int | None = None


class CorrectIn(_Body):
    client_request_id: str = RID


class VoidIn(_Body):
    reason: str = Field(default="", max_length=300)
    row_version: int | None = None


# ---------------------------------------------------------------- plumbing

def _is_json(content_type: str | None) -> bool:
    media = (content_type or "").split(";", 1)[0].strip().lower()
    return media == "application/json" or (media.startswith("application/") and media.endswith("+json"))


async def _raw_body(request: Request) -> bytes:
    return await request.body()


def _parse(request: Request, raw: bytes, model: type[BaseModel]) -> Any:
    if not _is_json(request.headers.get("content-type")):
        raise ApiError(415, "unsupported_media_type", "הבקשה חייבת להישלח כ־JSON (Content-Type: application/json).")
    try:
        data = json.loads(raw) if raw.strip() else {}
    except (ValueError, RecursionError):
        raise ApiError(422, "validation", "גוף הבקשה אינו JSON תקין.", details={"fields": ["body"]}) from None
    if not isinstance(data, dict):
        raise ApiError(422, "validation", "גוף הבקשה חייב להיות אובייקט JSON.", details={"fields": ["body"]})
    try:
        return model.model_validate(data)
    except ValidationError as exc:
        fields = sorted({".".join(str(p) for p in err["loc"]) or "body" for err in exc.errors()})
        raise ApiError(422, "validation", "הבקשה אינה תקינה: " + ", ".join(fields), details={"fields": fields}) from None


def _rid(request: Request) -> str | None:
    return getattr(request.state, "correlation_id", None)


def _has(conn: sqlite3.Connection, principal: Principal, perm: str) -> bool:
    return authorize(conn, principal, perm, INSTALLATION).allowed


def _need_any(*perms: str):
    def check(conn: sqlite3.Connection, principal: Principal) -> None:
        if not any(_has(conn, principal, p) for p in perms):
            require(conn, principal, perms[0], INSTALLATION)  # the audited 403 (names the first permission)

    return check


_view = read_gate(_need_any(VIEW, MANAGE, BILLS))
_view_or_manage = read_gate(_need_any(VIEW, MANAGE))
_customers_read = read_gate(_need_any(VIEW, MANAGE, BILLS))
_manage = read_gate(_need_any(MANAGE))
_money_read = read_gate(_need_any(MANAGE, BILLS))
_bills = read_gate(_need_any(BILLS))


def _db(request: Request):
    return request.app.state.db


def _tz(conn: sqlite3.Connection) -> str:
    from .settings import read_settings

    return read_settings(conn)["time.zone"]


def _today(tz: str) -> dt.date:
    return per.local_date(eb.now_utc(), tz)


def _p(principal: Principal) -> Principal:
    return principal


# ====================================================================== customers

@router.get("/energy/customers")
def list_customers(principal: Principal = Depends(_customers_read), conn: sqlite3.Connection = Depends(get_read_conn),
                   q: str | None = Query(None, max_length=80), limit: int = Query(200, ge=1, le=500), offset: int = Query(0, ge=0)) -> dict[str, Any]:
    contact = _has(conn, principal, BILLS) or _has(conn, principal, MANAGE)
    sql = "SELECT * FROM energy_customers WHERE deleted_at IS NULL"
    args: list[Any] = []
    if q:
        sql += " AND (name LIKE ? OR customer_number LIKE ?)"
        args += [f"%{q}%", f"%{q}%"]
    total = conn.execute(f"SELECT COUNT(*) FROM ({sql})", args).fetchone()[0]
    rows = conn.execute(sql + " ORDER BY customer_number LIMIT ? OFFSET ?", (*args, limit, offset)).fetchall()
    return {"items": [eb.customer_dict(conn, r, contact) for r in rows], "total": total}


@router.get("/energy/customers/next-number")
def next_number(principal: Principal = Depends(_manage), conn: sqlite3.Connection = Depends(get_read_conn)) -> dict[str, Any]:
    return {"customer_number": eb.next_customer_number(conn)}


@router.post("/energy/customers", status_code=201)
def create_customer(request: Request, principal: Principal = Depends(_manage), raw: bytes = Depends(_raw_body), conn: sqlite3.Connection = Depends(get_conn)) -> dict[str, Any]:
    body = _parse(request, raw, CustomerCreate)
    cid = eb.create_customer(conn, principal.user_id, body.model_dump())
    audit(conn, actor=principal, action="energy.customer.create", decision="allowed", resource_type="energy_customer", resource_id=cid, request_id=_rid(request))
    return eb.customer_dict(conn, eb.get_customer(conn, cid), True)


@router.get("/energy/customers/{cid}")
def get_customer(cid: str, principal: Principal = Depends(_customers_read), conn: sqlite3.Connection = Depends(get_read_conn)) -> dict[str, Any]:
    bills = _has(conn, principal, BILLS)
    contact = bills or _has(conn, principal, MANAGE)
    row = eb.get_customer(conn, cid)
    out = eb.customer_dict(conn, row, contact)
    out["accounts"] = [{"id": a["id"], "name": a["name"], "status": a["status"]}
                       for a in conn.execute("SELECT id, name, status FROM energy_accounts WHERE customer_id = ? AND deleted_at IS NULL ORDER BY name", (cid,)).fetchall()]
    if bills:
        out["bills"] = [eb.bill_summary(conn, b) for b in conn.execute("SELECT * FROM energy_bills WHERE customer_id = ? ORDER BY period_end DESC, revision DESC LIMIT 24", (cid,)).fetchall()]
    return out


@router.patch("/energy/customers/{cid}")
def patch_customer(cid: str, request: Request, principal: Principal = Depends(_manage), raw: bytes = Depends(_raw_body), conn: sqlite3.Connection = Depends(get_conn)) -> dict[str, Any]:
    body = _parse(request, raw, CustomerPatch)
    changed = eb.update_customer(conn, cid, body.model_dump(exclude_unset=True))
    audit(conn, actor=principal, action="energy.customer.update", decision="allowed", resource_type="energy_customer", resource_id=cid, request_id=_rid(request), details={"fields": changed})
    return eb.customer_dict(conn, eb.get_customer(conn, cid), True)


@router.delete("/energy/customers/{cid}", status_code=204)
def delete_customer(cid: str, request: Request, base_revision: int = Query(...), principal: Principal = Depends(_manage), conn: sqlite3.Connection = Depends(get_conn)) -> Response:
    eb.delete_customer(conn, cid, base_revision)
    audit(conn, actor=principal, action="energy.customer.delete", decision="allowed", resource_type="energy_customer", resource_id=cid, request_id=_rid(request))
    return Response(status_code=204)


# ====================================================================== accounts

@router.get("/energy/accounts")
def list_accounts(request: Request, principal: Principal = Depends(_view), conn: sqlite3.Connection = Depends(get_read_conn), customer_id: str | None = Query(None, max_length=64),
                  q: str | None = Query(None, max_length=80), status: Literal["active", "paused"] | None = None) -> dict[str, Any]:
    money = _has(conn, principal, BILLS)
    sql = "SELECT * FROM energy_accounts WHERE deleted_at IS NULL"
    args: list[Any] = []
    if customer_id:
        sql += " AND customer_id = ?"
        args.append(customer_id)
    if q:
        sql += " AND name LIKE ?"
        args.append(f"%{q}%")
    if status:
        sql += " AND status = ?"
        args.append(status)
    provider = get_provider(conn, settings_of(request))
    return {"items": [eb.account_dict(conn, provider, r, money) for r in conn.execute(sql + " ORDER BY name", args).fetchall()]}


@router.post("/energy/accounts", status_code=201)
def create_account(request: Request, principal: Principal = Depends(_manage), raw: bytes = Depends(_raw_body), conn: sqlite3.Connection = Depends(get_conn)) -> dict[str, Any]:
    body = _parse(request, raw, AccountCreate)
    provider = get_provider(conn, settings_of(request))
    data = body.model_dump()
    data["formula"] = body.formula.model_dump()
    aid = eb.create_account(conn, provider, principal.user_id, data, _tz(conn))
    audit(conn, actor=principal, action="energy.account.create", decision="allowed", resource_type="energy_account", resource_id=aid, request_id=_rid(request),
          details={"meters": eb.fx.meter_ids(json.loads(eb.get_account(conn, aid)["formula_json"]))})
    return eb.account_dict(conn, provider, eb.get_account(conn, aid), _has(conn, principal, BILLS))


@router.get("/energy/accounts/{aid}")
def get_account(aid: str, request: Request, principal: Principal = Depends(_view), conn: sqlite3.Connection = Depends(get_read_conn)) -> dict[str, Any]:
    return eb.account_dict(conn, get_provider(conn, settings_of(request)), eb.get_account(conn, aid), _has(conn, principal, BILLS))


@router.patch("/energy/accounts/{aid}")
def patch_account(aid: str, request: Request, principal: Principal = Depends(_manage), raw: bytes = Depends(_raw_body), conn: sqlite3.Connection = Depends(get_conn)) -> dict[str, Any]:
    body = _parse(request, raw, AccountPatch)
    data = body.model_dump(exclude_unset=True)
    if body.formula is not None:
        data["formula"] = body.formula.model_dump()
    before = eb.get_account(conn, aid)
    provider = get_provider(conn, settings_of(request))
    changed = eb.update_account(conn, provider, aid, data, _tz(conn))
    details: dict[str, Any] = {"fields": changed}
    if "formula_json" in changed:
        details["meters_before"] = fx.meter_ids(json.loads(before["formula_json"]))
        details["meters_after"] = fx.meter_ids(json.loads(eb.get_account(conn, aid)["formula_json"]))
    audit(conn, actor=principal, action="energy.account.update", decision="allowed", resource_type="energy_account", resource_id=aid, request_id=_rid(request), details=details)
    return eb.account_dict(conn, provider, eb.get_account(conn, aid), _has(conn, principal, BILLS))


@router.delete("/energy/accounts/{aid}", status_code=204)
def delete_account(aid: str, request: Request, base_revision: int = Query(...), principal: Principal = Depends(_manage), conn: sqlite3.Connection = Depends(get_conn)) -> Response:
    drafts = eb.delete_account(conn, aid, base_revision)
    audit(conn, actor=principal, action="energy.account.delete", decision="allowed", resource_type="energy_account", resource_id=aid, request_id=_rid(request), details={"drafts_deleted": drafts})
    return Response(status_code=204)


@router.get("/energy/accounts/{aid}/periods")
def account_periods(aid: str, principal: Principal = Depends(_view), conn: sqlite3.Connection = Depends(get_read_conn),
                    past: int = Query(6, ge=0, le=24), future: int = Query(1, ge=0, le=6)) -> dict[str, Any]:
    acc = eb.get_account(conn, aid)
    money = _has(conn, principal, BILLS)
    today = _today(acc["timezone"])
    out = []
    for p in per.periods_between(eb.cycle_of(acc), today, past, future, today):
        b = conn.execute("SELECT * FROM energy_bills WHERE account_id = ? AND period_start = ? AND period_end = ? AND state != 'void' ORDER BY revision DESC LIMIT 1",
                         (aid, p.start.isoformat(), p.end.isoformat())).fetchone()
        state = "future" if p.start > today else ("open" if p.end > today else ("billed" if b is not None and b["state"] != "draft" else ("draft" if b is not None else "open")))
        out.append({**p.as_api(), "end_exclusive": p.end.isoformat(), "state": state, "bill": eb.bill_summary(conn, b, money) if b is not None else None})
    return {"periods": out}


@router.get("/energy/accounts/{aid}/history")
def account_history(aid: str, request: Request, principal: Principal = Depends(_view), conn: sqlite3.Connection = Depends(get_read_conn),
                    past: int = Query(12, ge=1, le=24)) -> dict[str, Any]:
    """Consumption per billing period, also for periods without a bill (from the readings with the account formula), and the
    chart comparison of the latest ended period (previous periods, same period last year). energy.view; money only with energy.bills."""
    acc = eb.get_account(conn, aid)
    return eb.account_history(conn, get_provider(conn, settings_of(request)), acc, past, _has(conn, principal, BILLS))


@router.get("/energy/accounts/{aid}/status")
def account_status(aid: str, request: Request, principal: Principal = Depends(_view), conn: sqlite3.Connection = Depends(get_read_conn)) -> dict[str, Any]:
    acc = eb.get_account(conn, aid)
    provider = get_provider(conn, settings_of(request))
    today = _today(acc["timezone"])
    p = per.period_containing(eb.cycle_of(acc), max(today, eb.cycle_of(acc).first_start))
    out: dict[str, Any] = {"period": p.as_api() if p else None, "kwh_so_far": None, "meters": [], "notes": []}
    if p is None:
        return out
    try:
        comp = eb.compute(conn, provider, acc, p)
    except ApiError as e:
        out["error_code"] = e.code
        return out
    snap = comp.snapshot
    out["kwh_so_far"] = snap["totals"]["kwh"]
    out["meters"] = [{"meter_id": m["meter_id"], "name": m["name"], "kwh": m["consumption_kwh"], "last_report_at": m["last_report_at"],
                      "reporting": m["reported_to_end"] or (m["last_report_at"] is not None and m["last_report_at"] >= eb._iso(eb.now_utc() - eb.stale_after(conn)))} for m in snap["meters"]]
    out["notes"] = [n for n in snap["notes"] if n["code"] != "meter_not_reporting"]
    if _has(conn, principal, BILLS):
        out["amount_so_far"] = snap["totals"]["total"]
    return out


@router.get("/energy/accounts/{aid}/bills")
def account_bills(aid: str, principal: Principal = Depends(_bills), conn: sqlite3.Connection = Depends(get_read_conn)) -> dict[str, Any]:
    eb.get_account(conn, aid)
    rows = conn.execute("SELECT * FROM energy_bills WHERE account_id = ? ORDER BY period_end DESC, revision DESC", (aid,)).fetchall()
    return {"items": [eb.bill_summary(conn, r) for r in rows]}


# ====================================================================== formula

def _last_full_month(tz: str) -> per.Period:
    today = _today(tz)
    first = today.replace(day=1)
    prev = (first - dt.timedelta(days=1)).replace(day=1)
    return per.Period(prev, first)


@router.post("/energy/formula/check")
def formula_check(request: Request, principal: Principal = Depends(_view_or_manage), raw: bytes = Depends(_raw_body), conn: sqlite3.Connection = Depends(get_read_conn)) -> dict[str, Any]:
    body = _parse(request, raw, FormulaCheck)
    provider = get_provider(conn, settings_of(request))
    out: dict[str, Any] = {"ok": False, "ast": None, "text": None, "sentence_he": None, "meter_ids": [], "coefficients": {}, "errors": [], "warnings": [], "preview": None}
    try:
        comp = eb.formula_from_input(provider, body.formula.model_dump())
    except fx.FormulaError as e:
        out["errors"] = [e.as_dict()]
        return out
    api = eb.formula_api(provider, comp.ast)
    out.update({"ok": True, **api, "coefficients": {m: fx._dec_str(c) for m, c in comp.coefficients.items()}, "warnings": comp.warnings})
    tz = body.timezone if body.timezone and per.valid_zone(body.timezone) else _tz(conn)
    p = per.Period(body.period.from_, body.period.to + dt.timedelta(days=1)) if body.period else _last_full_month(tz)
    if p.end <= p.start or p.days > per.MAX_PERIOD_DAYS:
        out["errors"].append({"code": "period", "message": "התקופה אינה תקינה.", "pos": None})
        out["ok"] = False
        return out
    a, b = per.utc_window(p, tz)
    names = eb.meter_names(provider, comp.meter_ids)
    values = {}
    meters = []
    for mid in comp.meter_ids:
        w = meter_window(provider, mid, [a, b])
        values[mid] = w.wh
        meters.append({"meter_id": mid, "name": names.get(mid, mid), "kwh": px.s2(w.wh / 1000)})
        last = provider.last_report_at(mid)
        if last is None or last < eb.now_utc() - eb.stale_after(conn):
            out["warnings"].append({"code": "meter_not_reporting", "message": "המונה לא מדווח כרגע.", "meter_id": mid})
    result = px.r2(comp.evaluate(values) / 1000)
    out["preview"] = {"period": p.as_api(), "meters": meters, "result_kwh": str(result), "negative": result < 0}
    if result < 0:
        out["ok"] = False
        out["errors"].append({"code": "negative", "message": "התוצאה שלילית בתקופה שנבדקה. יש לבדוק את הנוסחה.", "pos": None})
    return out


@router.post("/energy/formula/preset")
def formula_preset(request: Request, principal: Principal = Depends(_view_or_manage), raw: bytes = Depends(_raw_body), conn: sqlite3.Connection = Depends(get_read_conn)) -> dict[str, Any]:
    body = _parse(request, raw, PresetIn)
    try:
        ast = fx.preset(body.preset, body.meter_ids, body.main_meter_id, body.percent)
    except fx.FormulaError as e:
        raise eb.formula_error(e) from None
    api = eb.formula_api(get_provider(conn, settings_of(request)), ast)
    return {"ast": ast, "text": api["text"], "sentence_he": api["sentence_he"]}


# ====================================================================== tariffs and VAT

def _price(v: Any) -> px.Decimal:
    try:
        return px.parse_price(v)
    except ValueError:
        raise ApiError(422, "validation", "המחיר חייב להיות מספר חיובי עם עד 4 ספרות אחרי הנקודה.", details={"fields": ["price"]}) from None


@router.get("/energy/tariffs")
def list_tariffs(principal: Principal = Depends(_money_read), conn: sqlite3.Connection = Depends(get_read_conn)) -> dict[str, Any]:
    today = _today(_tz(conn))
    return {"items": [eb.tariff_dict(conn, r, today) for r in conn.execute("SELECT * FROM energy_tariffs WHERE deleted_at IS NULL ORDER BY name").fetchall()]}


@router.post("/energy/tariffs", status_code=201)
def create_tariff(request: Request, principal: Principal = Depends(_manage), raw: bytes = Depends(_raw_body), conn: sqlite3.Connection = Depends(get_conn)) -> dict[str, Any]:
    body = _parse(request, raw, TariffCreate)
    price = _price(body.price)
    mode = body.price_mode or eb.read_settings(conn)["default_price_mode"]
    tid = eb.new_id()
    now = eb.now_iso()
    conn.execute("INSERT INTO energy_tariffs(id, name, created_by, created_at, updated_at) VALUES (?, ?, ?, ?, ?)", (tid, body.name.strip(), principal.user_id, now, now))
    eb.add_tariff_version(conn, tid, principal.user_id, body.effective_from, price, mode)
    audit(conn, actor=principal, action="energy.tariff.create", decision="allowed", resource_type="energy_tariff", resource_id=tid, request_id=_rid(request))
    return eb.tariff_dict(conn, eb.get_tariff(conn, tid), _today(_tz(conn)))


@router.patch("/energy/tariffs/{tid}")
def patch_tariff(tid: str, request: Request, principal: Principal = Depends(_manage), raw: bytes = Depends(_raw_body), conn: sqlite3.Connection = Depends(get_conn)) -> dict[str, Any]:
    body = _parse(request, raw, TariffPatch)
    eb.get_tariff(conn, tid)
    conn.execute("UPDATE energy_tariffs SET name = ?, updated_at = ? WHERE id = ?", (body.name.strip(), eb.now_iso(), tid))
    audit(conn, actor=principal, action="energy.tariff.update", decision="allowed", resource_type="energy_tariff", resource_id=tid, request_id=_rid(request))
    return eb.tariff_dict(conn, eb.get_tariff(conn, tid), _today(_tz(conn)))


@router.delete("/energy/tariffs/{tid}", status_code=204)
def delete_tariff(tid: str, request: Request, principal: Principal = Depends(_manage), conn: sqlite3.Connection = Depends(get_conn)) -> Response:
    eb.delete_tariff(conn, tid)
    audit(conn, actor=principal, action="energy.tariff.delete", decision="allowed", resource_type="energy_tariff", resource_id=tid, request_id=_rid(request))
    return Response(status_code=204)


@router.post("/energy/tariffs/{tid}/versions", status_code=201)
def add_version(tid: str, request: Request, principal: Principal = Depends(_manage), raw: bytes = Depends(_raw_body), conn: sqlite3.Connection = Depends(get_conn)):
    body = _parse(request, raw, VersionCreate)
    eb.get_tariff(conn, tid)
    price = _price(body.price)
    mode = body.price_mode or eb.read_settings(conn)["default_price_mode"]
    today = _today(_tz(conn))
    if body.replace_version_id:
        target = conn.execute("SELECT * FROM energy_tariff_versions WHERE id = ? AND tariff_id = ?", (body.replace_version_id, tid)).fetchone()
        if not target:
            raise ApiError(404, "not_found", "גרסת המחיר לא נמצאה.")
    else:
        target = conn.execute("SELECT * FROM energy_tariff_versions WHERE tariff_id = ? AND effective_from = ?", (tid, body.effective_from.isoformat())).fetchone()
    if not target:
        vid = eb.add_tariff_version(conn, tid, principal.user_id, body.effective_from, price, mode)
        audit(conn, actor=principal, action="energy.tariff.version.create", decision="allowed", resource_type="energy_tariff", resource_id=tid, request_id=_rid(request),
              details={"version_id": vid, "effective_from": body.effective_from.isoformat()})
        return eb.tariff_dict(conn, eb.get_tariff(conn, tid), today)
    if body.base and (body.base.effective_from.isoformat() != target["effective_from"] or px.parse_price(body.base.price) != px.Decimal(target["price"]) or body.base.price_mode != target["price_mode"]):
        raise ApiError(409, "revision_conflict", "המחיר שונה בינתיים. יש לרענן ולנסות שוב.")
    plan = eb.plan_version_change(conn, tid, target, body.effective_from, price, mode)
    if not body.confirm:
        return JSONResponse({"applied": False, "plan": plan}, status_code=200)
    vid = eb.apply_version_change(conn, tid, principal.user_id, target, plan)
    audit(conn, actor=principal, action="energy.tariff.version.correct", decision="allowed", resource_type="energy_tariff", resource_id=tid, request_id=_rid(request),
          details={"version_id": vid, "corrected_version_id": target["id"], "kind": plan["kind"], "applies_from": plan["applies_from"], "old": plan["old"], "new": plan["new"]})
    return JSONResponse({**eb.tariff_dict(conn, eb.get_tariff(conn, tid), today), "applied": True, "plan": plan}, status_code=200)


@router.delete("/energy/tariffs/{tid}/versions/{vid}", status_code=204)
def delete_version(tid: str, vid: str, request: Request, principal: Principal = Depends(_manage), conn: sqlite3.Connection = Depends(get_conn)) -> Response:
    eb.delete_tariff_version(conn, tid, vid)
    audit(conn, actor=principal, action="energy.tariff.version.delete", decision="allowed", resource_type="energy_tariff", resource_id=tid, request_id=_rid(request), details={"version_id": vid})
    return Response(status_code=204)


def _vat_list(conn: sqlite3.Connection) -> dict[str, Any]:
    today = _today(_tz(conn)).isoformat()
    items = [{"id": r["id"], "effective_from": r["effective_from"], "rate_percent": r["rate_percent"]} for r in conn.execute("SELECT * FROM energy_vat_rates ORDER BY effective_from").fetchall()]
    cur = None
    for it in items:
        if it["effective_from"] <= today:
            cur = it
    return {"items": items, "current": cur}


@router.get("/energy/vat-rates")
def list_vat(principal: Principal = Depends(_money_read), conn: sqlite3.Connection = Depends(get_read_conn)) -> dict[str, Any]:
    return _vat_list(conn)


@router.post("/energy/vat-rates", status_code=201)
def create_vat(request: Request, principal: Principal = Depends(_manage), raw: bytes = Depends(_raw_body), conn: sqlite3.Connection = Depends(get_conn)) -> dict[str, Any]:
    body = _parse(request, raw, VatCreate)
    try:
        rate = px.parse_rate(body.rate_percent)
    except ValueError:
        raise ApiError(422, "validation", "שיעור המע״מ הוא 0 עד 50 עם עד 2 ספרות אחרי הנקודה.", details={"fields": ["rate_percent"]}) from None
    vid = eb.add_vat(conn, principal.user_id, body.effective_from, rate)
    audit(conn, actor=principal, action="energy.vat.create", decision="allowed", resource_type="energy_vat", resource_id=vid, request_id=_rid(request),
          details={"effective_from": body.effective_from.isoformat(), "rate_percent": px.pct_str(rate)})
    return _vat_list(conn)


@router.delete("/energy/vat-rates/{vid}", status_code=204)
def delete_vat(vid: str, request: Request, principal: Principal = Depends(_manage), conn: sqlite3.Connection = Depends(get_conn)) -> Response:
    eb.delete_vat(conn, vid)
    audit(conn, actor=principal, action="energy.vat.delete", decision="allowed", resource_type="energy_vat", resource_id=vid, request_id=_rid(request))
    return Response(status_code=204)


# ====================================================================== billing settings and logo

@router.get("/energy/billing-settings")
def get_settings(principal: Principal = Depends(_money_read), conn: sqlite3.Connection = Depends(get_read_conn)) -> dict[str, Any]:
    # pdf_engine: which PDF engine this installation really renders with (start-up self-check; a silent fallback is visible)
    return {**eb.read_settings(conn), "pdf_engine": pdfseam.engine_status()}


@router.put("/energy/billing-settings")
def put_settings(request: Request, principal: Principal = Depends(_manage), raw: bytes = Depends(_raw_body), conn: sqlite3.Connection = Depends(get_conn)) -> dict[str, Any]:
    body = _parse(request, raw, SettingsPut)
    patch = body.model_dump(exclude_unset=True, exclude_none=True)
    base = patch.pop("base_revision", None)
    out, changed = eb.update_settings(conn, patch, base)
    audit(conn, actor=principal, action="energy.billing_settings.update", decision="allowed", resource_type="energy_settings", resource_id="billing", request_id=_rid(request), details={"sections": changed})
    return out


@router.put("/energy/billing-settings/logo")
def put_logo(request: Request, principal: Principal = Depends(_manage), raw: bytes = Depends(_raw_body), conn: sqlite3.Connection = Depends(get_conn)) -> dict[str, Any]:
    media = (request.headers.get("content-type") or "").split(";", 1)[0].strip().lower()
    if media not in ("image/png", "image/jpeg"):
        raise ApiError(415, "unsupported_media_type", "הלוגו חייב להישלח כ-image/png או image/jpeg.")
    logo = eb.store_logo(conn, settings_of(request).data_dir, raw)
    audit(conn, actor=principal, action="energy.billing_settings.logo", decision="allowed", resource_type="energy_settings", resource_id="logo", request_id=_rid(request), details={"sha256": logo["sha256"][:12]})
    return {"logo": logo}


@router.delete("/energy/billing-settings/logo", status_code=204)
def delete_logo(request: Request, principal: Principal = Depends(_manage), conn: sqlite3.Connection = Depends(get_conn)) -> Response:
    eb.clear_logo(conn)
    audit(conn, actor=principal, action="energy.billing_settings.logo", decision="allowed", resource_type="energy_settings", resource_id="logo", request_id=_rid(request), details={"removed": True})
    return Response(status_code=204)


@router.get("/energy/billing-settings/logo")
def get_logo(request: Request, principal: Principal = Depends(_money_read), conn: sqlite3.Connection = Depends(get_read_conn)) -> Response:
    s = eb.read_settings(conn)
    data = eb.logo_bytes(conn, settings_of(request).data_dir, (s.get("logo") or {}).get("sha256"))
    if data is None:
        raise ApiError(404, "not_found", "אין לוגו.")
    return Response(content=data, media_type="image/png", headers={"Cache-Control": "private, max-age=300"})


# ====================================================================== bills

@router.get("/energy/bills")
def list_bills(principal: Principal = Depends(_bills), conn: sqlite3.Connection = Depends(get_read_conn), account_id: str | None = Query(None, max_length=64),
               customer_id: str | None = Query(None, max_length=64), state: Literal["draft", "issued", "sent", "paid", "void"] | None = None,
               from_: dt.date | None = Query(None, alias="from"), to: dt.date | None = None, q: str | None = Query(None, max_length=80),
               limit: int = Query(200, ge=1, le=500), offset: int = Query(0, ge=0)) -> dict[str, Any]:
    where = ["1=1"]
    args: list[Any] = []
    if account_id:
        where.append("b.account_id = ?")
        args.append(account_id)
    if customer_id:
        where.append("b.customer_id = ?")
        args.append(customer_id)
    if from_:
        where.append("b.period_end > ?")
        args.append(from_.isoformat())
    if to:
        where.append("b.period_start <= ?")
        args.append(to.isoformat())
    if q:
        where.append("(b.number LIKE ? OR a.name LIKE ? OR c.name LIKE ? OR c.customer_number LIKE ?)")
        args += [f"%{q}%"] * 4
    base = f"FROM energy_bills b LEFT JOIN energy_accounts a ON a.id = b.account_id LEFT JOIN energy_customers c ON c.id = b.customer_id WHERE {' AND '.join(where)}"
    counts = {s: 0 for s in ("draft", "issued", "sent", "paid", "void")}
    for r in conn.execute(f"SELECT b.state, COUNT(*) {base} GROUP BY b.state", args).fetchall():
        counts[r[0]] = r[1]
    if state:
        base += " AND b.state = ?"
        args.append(state)
    total = conn.execute(f"SELECT COUNT(*) {base}", args).fetchone()[0]
    rows = conn.execute(f"SELECT b.* {base} ORDER BY b.period_end DESC, b.created_at DESC LIMIT ? OFFSET ?", (*args, limit, offset)).fetchall()
    return {"items": [eb.bill_summary(conn, r) for r in rows], "total": total, "counts": counts}


@router.post("/energy/accounts/{aid}/bills", status_code=201)
def create_bill(aid: str, request: Request, principal: Principal = Depends(_bills), raw: bytes = Depends(_raw_body), rconn: sqlite3.Connection = Depends(get_read_conn)) -> JSONResponse:
    body = _parse(request, raw, BillCreate)
    existing = eb.by_create_request(rconn, body.client_request_id)
    if existing is not None:
        return _same_request(rconn, existing, aid)
    acc = eb.get_account(rconn, aid)
    p = eb.resolve_period(acc, {"from": body.period.from_, "to": body.period.to} if body.period else None, eb.now_utc())
    hit = eb._overlapping(rconn, aid, p)
    if hit is not None:
        raise eb._overlap_error(hit)
    comp = eb.compute(rconn, get_provider(rconn, settings_of(request)), acc, p)
    with _db(request).connection(label="energy.bill.create") as w:
        again = eb.by_create_request(w, body.client_request_id)
        if again is not None:
            return _same_request(w, again, aid)
        cur = eb.get_account(w, aid)
        if cur["revision"] != acc["revision"]:
            raise ApiError(409, "revision_conflict", "החשבון שונה בזמן החישוב. יש לנסות שוב.", details={"current_revision": cur["revision"]})
        bid = eb.insert_draft(w, cur, p, comp, actor=principal, origin="manual", request_id=_rid(request), client_request_id=body.client_request_id)
        return JSONResponse(status_code=201, content=eb.bill_dict(w, eb.get_bill(w, bid)))


def _same_request(conn: sqlite3.Connection, row: sqlite3.Row, aid: str) -> JSONResponse:
    if row["account_id"] != aid:
        raise ApiError(409, "request_reused", "מזהה הבקשה כבר שימש לחשבון אחר.")
    return JSONResponse(status_code=200, content=eb.bill_dict(conn, row))


@router.get("/energy/bills/{bid}")
def get_bill(bid: str, principal: Principal = Depends(_bills), conn: sqlite3.Connection = Depends(get_read_conn)) -> dict[str, Any]:
    return eb.bill_dict(conn, eb.get_bill(conn, bid))


@router.get("/energy/bills/{bid}/events")
def bill_events(bid: str, principal: Principal = Depends(_bills), conn: sqlite3.Connection = Depends(get_read_conn)) -> dict[str, Any]:
    eb.get_bill(conn, bid)
    rows = conn.execute("SELECT * FROM energy_bill_events WHERE bill_id = ? ORDER BY at, rowid", (bid,)).fetchall()
    return {"items": [{"at": r["at"], "action": r["action"], "actor": {"kind": r["actor_kind"], "display_name": r["actor_name"]},
                       "details": json.loads(r["details_json"]) if r["details_json"] else None} for r in rows]}


def _replaces(conn: sqlite3.Connection, bill: sqlite3.Row) -> sqlite3.Row | None:
    return eb.get_bill(conn, bill["replaces_bill_id"]) if bill["replaces_bill_id"] else None


@router.post("/energy/bills/{bid}/recalculate")
def recalculate(bid: str, request: Request, principal: Principal = Depends(_bills), raw: bytes = Depends(_raw_body), rconn: sqlite3.Connection = Depends(get_read_conn)) -> dict[str, Any]:
    body = _parse(request, raw, RowVersionIn)
    bill = eb.get_bill(rconn, bid)
    if bill["state"] != "draft":
        raise ApiError(409, "bill_not_draft", "החיוב אינו טיוטה.", details={"state": bill["state"]})
    acc = eb.get_account(rconn, bill["account_id"])
    p = per.Period(eb._date(bill["period_start"]), eb._date(bill["period_end"]))
    comp = eb.compute(rconn, get_provider(rconn, settings_of(request)), acc, p, origin=bill["origin"], replaces=_replaces(rconn, bill), bill_id=bid)
    with _db(request).connection(label="energy.bill.recalculate") as w:
        eb.store_recalculated(w, bill, comp, principal, _rid(request), body.row_version)
        return eb.bill_dict(w, eb.get_bill(w, bid))


@router.delete("/energy/bills/{bid}", status_code=204)
def delete_bill(bid: str, request: Request, row_version: int = Query(...), principal: Principal = Depends(_bills), conn: sqlite3.Connection = Depends(get_conn)) -> Response:
    eb.delete_draft(conn, bid, row_version, principal, _rid(request))
    return Response(status_code=204)


@router.post("/energy/bills/{bid}/issue")
def issue(bid: str, request: Request, principal: Principal = Depends(_bills), raw: bytes = Depends(_raw_body), rconn: sqlite3.Connection = Depends(get_read_conn)) -> dict[str, Any]:
    body = _parse(request, raw, IssueIn)
    bill = eb.get_bill(rconn, bid)
    if bill["state"] != "draft":
        if bill["issue_request_id"] and bill["issue_request_id"] == body.client_request_id:
            return eb.bill_dict(rconn, bill)  # a double click: the same issued bill
        raise ApiError(409, "bill_not_draft", "החיוב כבר הונפק.", details={"state": bill["state"], "number": bill["number"]})
    if bill["row_version"] != body.row_version:
        raise ApiError(409, "revision_conflict", "החיוב שונה בינתיים. יש לרענן ולנסות שוב.", details={"current_revision": bill["row_version"]})
    acc = eb.get_account(rconn, bill["account_id"])
    p = per.Period(eb._date(bill["period_start"]), eb._date(bill["period_end"]))
    today = _today(acc["timezone"])
    if today < p.end:
        raise ApiError(422, "period_invalid", "התקופה עוד לא הסתיימה; אפשר להנפיק רק אחרי סופה.")
    issue_date = body.issue_date or today
    if issue_date > today or issue_date < p.end:
        raise ApiError(422, "validation", "תאריך ההנפקה חייב להיות אחרי סוף התקופה ולא בעתיד.", details={"fields": ["issue_date"]})
    comp = eb.compute(rconn, get_provider(rconn, settings_of(request)), acc, p, origin=bill["origin"], replaces=_replaces(rconn, bill), bill_id=bid)
    stale = comp.total != bill["total"] or comp.kwh != bill["kwh"]
    with _db(request).connection(label="energy.bill.issue") as w:
        cur = eb.get_bill(w, bid)
        if cur["state"] != "draft":
            if cur["issue_request_id"] and cur["issue_request_id"] == body.client_request_id:
                return eb.bill_dict(w, cur)
            raise ApiError(409, "bill_not_draft", "החיוב כבר הונפק.", details={"state": cur["state"], "number": cur["number"]})
        if cur["row_version"] != body.row_version:
            raise ApiError(409, "revision_conflict", "החיוב שונה בינתיים. יש לרענן ולנסות שוב.", details={"current_revision": cur["row_version"]})
        if stale:
            # the numbers moved since the draft was shown (a late reading): store the fresh draft and ask to review it
            eb.store_recalculated(w, cur, comp, principal, _rid(request), body.row_version)
            fresh = eb.get_bill(w, bid)
            raise ApiError(409, "draft_stale", "הנתונים התעדכנו מאז שהטיוטה הוצגה. יש לעיין בטיוטה המעודכנת ולהנפיק שוב.",
                           details={"old_total": bill["total"], "new_total": comp.total, "old_kwh": bill["kwh"], "new_kwh": comp.kwh, "row_version": fresh["row_version"]})
        eb.seal(w, cur, comp, actor=principal, issue_date=issue_date, request_id=_rid(request), client_request_id=body.client_request_id)
        return eb.bill_dict(w, eb.get_bill(w, bid))


@router.post("/energy/bills/{bid}/sent")
def mark_sent(bid: str, request: Request, principal: Principal = Depends(_bills), raw: bytes = Depends(_raw_body), conn: sqlite3.Connection = Depends(get_conn)) -> dict[str, Any]:
    body = _parse(request, raw, SentIn)
    bill = eb.get_bill(conn, bid)
    at = (body.at or _today(eb.get_account_any(conn, bill["account_id"])["timezone"])).isoformat()
    eb.mark_sent(conn, bid, at, body.how, body.note, principal, _rid(request), body.row_version)
    return eb.bill_dict(conn, eb.get_bill(conn, bid))


@router.post("/energy/bills/{bid}/paid")
def mark_paid(bid: str, request: Request, principal: Principal = Depends(_bills), raw: bytes = Depends(_raw_body), conn: sqlite3.Connection = Depends(get_conn)) -> dict[str, Any]:
    body = _parse(request, raw, PaidIn)
    bill = eb.get_bill(conn, bid)
    at = (body.at or _today(eb.get_account_any(conn, bill["account_id"])["timezone"])).isoformat()
    eb.mark_paid(conn, bid, at, body.reference, principal, _rid(request), body.row_version)
    return eb.bill_dict(conn, eb.get_bill(conn, bid))


@router.post("/energy/bills/{bid}/void")
def void(bid: str, request: Request, principal: Principal = Depends(_bills), raw: bytes = Depends(_raw_body), conn: sqlite3.Connection = Depends(get_conn)) -> dict[str, Any]:
    body = _parse(request, raw, VoidIn)
    eb.void_bill(conn, bid, body.reason, principal, _rid(request), body.row_version)
    return eb.bill_dict(conn, eb.get_bill(conn, bid))


@router.post("/energy/bills/{bid}/correct", status_code=201)
def correct(bid: str, request: Request, principal: Principal = Depends(_bills), raw: bytes = Depends(_raw_body), rconn: sqlite3.Connection = Depends(get_read_conn)) -> JSONResponse:
    body = _parse(request, raw, CorrectIn)
    existing = eb.by_create_request(rconn, body.client_request_id)
    if existing is not None and existing["replaces_bill_id"] == bid:
        return JSONResponse(status_code=200, content=eb.bill_dict(rconn, existing))
    orig = eb.get_bill(rconn, bid)
    eb.check_correctable(rconn, orig)
    acc = eb.get_account_any(rconn, orig["account_id"])
    p = per.Period(eb._date(orig["period_start"]), eb._date(orig["period_end"]))
    comp = eb.compute(rconn, get_provider(rconn, settings_of(request)), acc, p, origin="manual", replaces=orig)
    with _db(request).connection(label="energy.bill.correct") as w:
        again = eb.by_create_request(w, body.client_request_id)
        if again is not None and again["replaces_bill_id"] == bid:
            return JSONResponse(status_code=200, content=eb.bill_dict(w, again))
        cur = eb.get_bill(w, bid)
        eb.check_correctable(w, cur)
        nid = eb.insert_draft(w, acc, p, comp, actor=principal, origin="manual", request_id=_rid(request), client_request_id=body.client_request_id, replaces=cur)
        return JSONResponse(status_code=201, content=eb.bill_dict(w, eb.get_bill(w, nid)))


PDF_ERROR_HE = {
    "pdf_render_failed": "הפקת ה-PDF נכשלה. אפשר לנסות שוב.",
    "pdf_timeout": "הפקת ה-PDF ארכה זמן רב מדי. אפשר לנסות שוב.",
    "pdf_page_limit": "החיוב ארוך מדי לקובץ PDF (יותר מ-40 עמודים).",
    "pdf_too_large": "קובץ ה-PDF גדול מדי.",
}


def _pdf_failed(request: Request, bid: str, code: str) -> None:
    """Owner round 6: a PDF failure is visible on the bill (Bill.pdf.state = failed) - recorded as a bill event."""
    try:
        with _db(request).write_aside(label="energy.bill.pdf.failed") as w:
            eb.pdf_event(w, bid, "pdf_failed", None, {"code": code, "engine": eb.pdf_engine_name()})
    except Exception:  # noqa: BLE001 - the failure answer itself must never be lost over the bookkeeping
        pass


@router.get("/energy/bills/{bid}/pdf")
def bill_pdf(bid: str, request: Request, copy: bool = False, principal: Principal = Depends(_bills), conn: sqlite3.Connection = Depends(get_read_conn)) -> Response:
    bill = eb.get_bill(conn, bid)
    data_dir = settings_of(request).data_dir
    snap = json.loads(bill["snapshot_json"])
    watermark = "draft" if bill["state"] == "draft" else ("void" if bill["state"] == "void" else ("copy" if copy else None))
    content: bytes | None = None
    if watermark is None and bill["pdf_path"] and bill["pdf_sha256"]:
        try:
            stored = (data_dir / bill["pdf_path"]).read_bytes()
            if hashlib.sha256(stored).hexdigest() == bill["pdf_sha256"]:
                content = stored
        except OSError:
            content = None
    if content is None:
        logo = eb.logo_bytes(conn, data_dir, ((snap.get("business") or {}).get("logo") or {}).get("sha256"))
        try:
            content = pdfseam.render(snap, logo=logo, watermark=watermark)
        except pdfseam.PdfUnavailable:
            _pdf_failed(request, bid, "pdf_unavailable")
            raise ApiError(503, "pdf_unavailable", "הפקת PDF אינה זמינה בגרסה זו.") from None
        except pdfseam.PdfFailed as exc:
            _pdf_failed(request, bid, exc.code)
            raise ApiError(exc.status, exc.code, PDF_ERROR_HE.get(exc.code, PDF_ERROR_HE["pdf_render_failed"]), retryable=exc.retryable) from None
        if watermark is None and bill["state"] in eb.ISSUED_STATES and not bill["pdf_path"]:
            rel = eb.pdf_rel_path(bill)
            path = data_dir / rel
            path.parent.mkdir(parents=True, exist_ok=True)
            tmp = path.with_suffix(".tmp")
            tmp.write_bytes(content)
            try:
                tmp.chmod(0o600)
            except OSError:
                pass
            tmp.replace(path)
            with _db(request).write_aside(label="energy.bill.pdf.store") as w:
                cur = w.execute("UPDATE energy_bills SET pdf_path = ?, pdf_sha256 = ? WHERE id = ? AND pdf_path IS NULL", (rel, hashlib.sha256(content).hexdigest(), bid))
                if cur.rowcount:
                    eb.pdf_event(w, bid, "pdf", None, {"engine": eb.pdf_engine_name()})
    audit(conn, actor=principal, action="energy.bill.pdf", decision="allowed", resource_type="energy_bill", resource_id=bid, request_id=_rid(request), details={"watermark": watermark})
    name = (bill["number"] or f"draft-{bid}").replace("/", "_")
    return Response(content=content, media_type="application/pdf", headers={"Content-Disposition": f'attachment; filename="{name}.pdf"', "Cache-Control": "private, no-store"})


@router.get("/energy/auto-runs")
def auto_runs(principal: Principal = Depends(_bills), conn: sqlite3.Connection = Depends(get_read_conn), account_id: str | None = Query(None, max_length=64),
              limit: int = Query(100, ge=1, le=500)) -> dict[str, Any]:
    sql = "SELECT * FROM energy_auto_runs"
    args: list[Any] = []
    if account_id:
        sql += " WHERE account_id = ?"
        args.append(account_id)
    rows = conn.execute(sql + " ORDER BY updated_at DESC LIMIT ?", (*args, limit)).fetchall()
    return {"items": [{"account_id": r["account_id"], "period": {"from": r["period_start"], "to": (eb._date(r["period_end"]) - dt.timedelta(days=1)).isoformat()},
                       "status": r["status"], "bill_id": r["bill_id"], "error_code": r["error_code"], "attempts": r["attempts"], "updated_at": r["updated_at"]} for r in rows]}
