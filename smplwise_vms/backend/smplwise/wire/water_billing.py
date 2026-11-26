"""Response models of the water billing API (routers/water_billing.py, `/api/v1/infra/water/...`; CR-WATER78 section 16). Money and m3
are decimal strings; dates are local `YYYY-MM-DD`. Money (prices, amounts, open balances) and the customers' contact fields need
water.bills: those fields carry a default and are absent without it (`exclude_unset`), never null. The customer card, the formula, the
periods and the shared settings are the electricity billing's (smplwise/wire/energy_billing.py). Field order is the services' order."""
from __future__ import annotations

from typing import Any, Literal

from pydantic import Field

from . import WireModel
from .energy_billing import (AutoMode, BillState, EnergyAccountRef, EnergyAutoSettings, EnergyBillActor, EnergyBillCounts, EnergyCustomerRef,
                             EnergyDraftsRecomputed, EnergyFormula, EnergyNumbering, EnergyPaymentTerms, EnergyPeriod, PriceMode)


class WaterVatRate(WireModel):
    effective_from: str
    rate_percent: str


class WaterVat(WireModel):
    current: WaterVatRate | None
    items: list[WaterVatRate]


class WaterBusinessRef(WireModel):
    name: str
    registration_no: str


class WaterRetention(WireModel):
    draft_days: int
    bill_years: int


class WaterSharedSettings(WireModel):
    """What water billing reads from the electricity billing settings (edited there only)."""
    vat: WaterVat
    payment_terms: EnergyPaymentTerms
    numbering: EnergyNumbering
    default_price_mode: PriceMode
    auto: EnergyAutoSettings
    business: WaterBusinessRef
    retention: WaterRetention
    edit_link: str
    can_edit: bool


class WaterBillSummary(WireModel):
    """A water bill in a list; `total` only for water.bills holders."""
    id: str
    account_id: str
    account_name: str
    customer: EnergyCustomerRef
    number: str | None
    revision: int
    state: BillState
    origin: Literal["manual", "auto"]
    period: EnergyPeriod
    issue_date: str | None
    due_date: str | None
    m3: str
    replaces_bill_id: str | None
    replaced_by_bill_id: str | None
    row_version: int
    created_at: str
    updated_at: str
    total: str = None


class WaterCustomer(WireModel):
    """The shared customer card as the water screens show it: contact fields and the open water balance with water.bills only;
    `accounts` (the WATER accounts) and `bills` only on GET /customers/{id}."""
    id: str
    customer_number: str
    name: str
    revision: int
    created_at: str
    updated_at: str
    address: str = None
    phone: str = None
    email: str = None
    tax_id: str = None
    notes: str = None
    energy_account_count: int
    account_count: int
    open_balance: str = None
    accounts: list[EnergyAccountRef] = None
    bills: list[WaterBillSummary] = None


class WaterCustomerList(WireModel):
    items: list[WaterCustomer]
    total: int
    shared_with: Literal["electricity"]


# ---------------------------------------------------------------- tariffs

class WaterTariffVersion(WireModel):
    """A price version (water + sewage per m3); `locked` = an issued bill used it (correct it by adding a later version)."""
    id: str
    effective_from: str
    water_price: str
    sewage_price: str
    price_mode: PriceMode
    price_inc_vat: str | None
    locked: bool


class WaterTariff(WireModel):
    """A tariff; `drafts` after a version is added or corrected (the drafts on the tariff were recalculated)."""
    id: str
    name: str
    currency: str
    versions: list[WaterTariffVersion]
    current: WaterTariffVersion | None
    used_by: int
    vat_rate_percent: str | None
    drafts: EnergyDraftsRecomputed = None


class WaterTariffList(WireModel):
    items: list[WaterTariff]


# ---------------------------------------------------------------- accounts

class WaterAccountCustomer(EnergyCustomerRef):
    address: str


class WaterAccountTariff(WireModel):
    """The account's tariff; the prices in force only with water.bills."""
    id: str
    name: str
    water_price: str | None = None
    sewage_price: str | None = None
    price_mode: PriceMode | None = None
    vat_rate_percent: str | None = None
    price_inc_vat: str | None = None


class WaterMeterRef(WireModel):
    meter_id: str
    name: str


class WaterAccount(WireModel):
    id: str
    name: str
    customer: WaterAccountCustomer | None
    formula: EnergyFormula
    tariff: WaterAccountTariff
    period_months: Literal[1, 2]
    period_anchor_day: int
    period_anchor_month: int
    first_period_start: str
    timezone: str
    auto_mode: AutoMode
    status: Literal["active", "paused"]
    revision: int
    created_at: str
    updated_at: str
    next_period: EnergyPeriod | None
    last_bill: WaterBillSummary | None
    stale_meters: list[WaterMeterRef]


class WaterAccountsSummary(WireModel):
    active: int
    drafts: int | None


class WaterAccountList(WireModel):
    """The accounts and the summary row (`drafts` null without water.bills)."""
    items: list[WaterAccount]
    summary: WaterAccountsSummary


class WaterStatusMeter(WireModel):
    meter_id: str
    name: str
    coefficient: str
    start_m3: str | None
    current_m3: str | None
    consumption_m3: str
    contribution_m3: str
    reporting: bool
    last_report_at: str | None


class WaterStaleMeter(WireModel):
    meter_id: str
    name: str
    since: str | None


class WaterAccountStatus(WireModel):
    """The open period so far; `m3_forecast` once the period has started, `amount_so_far` with water.bills and a price and VAT in force."""
    period: EnergyPeriod | None
    day_of_period: int | None
    days: int | None
    m3_so_far: str | None
    meters: list[WaterStatusMeter]
    stale: list[WaterStaleMeter]
    m3_forecast: str = None
    amount_so_far: str = None
    billing_gaps: list[EnergyPeriod] = []
    """DATA-RULES-2-2550 (additive): the days between the account's issued bills that no bill covers (`to` inclusive), oldest first."""


class WaterHistoryPeriod(WireModel):
    """m3 of one period (null = no data), from an issued bill or the readings; the open period is `open`."""
    from_: str = Field(alias="from")
    to: str
    m3: str | None
    status: Literal["measured", "partial", "missing", "open"]
    source: Literal["bill", "readings"] | None
    bill: WaterBillSummary | None


class WaterAccountHistory(WireModel):
    periods: list[WaterHistoryPeriod]


class WaterBillList(WireModel):
    items: list[WaterBillSummary]


# ---------------------------------------------------------------- bills

class WaterBillSums(WireModel):
    open: str
    paid: str


class WaterBillsPage(WireModel):
    """A page of bills, the total of the filter, the counts by state (before the state filter) and the open / paid sums."""
    items: list[WaterBillSummary]
    total: int
    counts: EnergyBillCounts
    sums: WaterBillSums


class WaterBillSent(WireModel):
    at: str
    how: Literal["email", "hand", "other"]
    note: str | None


class WaterBillPaid(WireModel):
    at: str
    reference: str | None


class WaterBillVoid(WireModel):
    at: str | None
    reason: str | None


class WaterBillPdf(WireModel):
    """The water bill has no PDF yet (stated, never a wrong document)."""
    state: Literal["unavailable"]
    error_code: Literal["pdf_later"]


class WaterBill(WaterBillSummary):
    """A water bill with its sealed document (`snapshot`, passed through as stored), the life-cycle marks and the allowed actions."""
    snapshot: dict[str, Any]
    snapshot_sha256: str | None
    sent: WaterBillSent | None
    paid: WaterBillPaid | None
    void: WaterBillVoid | None
    actions: list[Literal["recalculate", "delete", "issue", "sent", "paid", "correct", "void"]]
    pdf: WaterBillPdf


class WaterBillEvent(WireModel):
    at: str
    action: str
    actor: EnergyBillActor
    details: dict[str, Any] | None


class WaterBillEvents(WireModel):
    items: list[WaterBillEvent]
