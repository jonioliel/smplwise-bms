"""Response models of the electricity billing API (routers/energy_billing.py, `/api/v1/energy/...`; contract
docs/architecture/ELECTRICITY_BILLING_API.md). Money, kWh and prices are decimal strings; dates are local `YYYY-MM-DD`.

Money keys (`total`, a tariff's `price` / `price_mode`, `amount_so_far`) and the customers' contact fields are LEFT OUT for a caller
without the permission - those fields carry a default and are absent from the answer then (`exclude_unset`), never null.
The bill snapshot is the sealed bill document (ELECTRICITY_BILL_SNAPSHOT.md, versioned by its own `schema` key); it is passed through
as stored. Field order is the order the services build their dicts in."""
from __future__ import annotations

from typing import Any, Literal

from pydantic import Field

from . import WireModel

PriceMode = Literal["ex_vat", "inc_vat"]
BillState = Literal["draft", "issued", "sent", "paid", "void"]
AutoMode = Literal["off", "draft", "issue"]
TariffKind = Literal["fixed", "tou"]


class EnergyPeriod(WireModel):
    """A billing period: local dates, `to` inclusive."""
    from_: str = Field(alias="from")
    to: str


# ---------------------------------------------------------------- time-of-use definition (ELECTRICITY_TOU.md section 2)

class EnergyTouNamed(WireModel):
    id: str
    name_he: str
    name_en: str = None


class EnergyTouSeason(WireModel):
    id: str
    name_he: str
    name_en: str = None
    ranges: list[tuple[str, str]]


class EnergyTouDefinition(WireModel):
    """Seasons, day types, the week, the bands, the schedule and the prices per season and band (null = not typed yet)."""
    seasons: list[EnergyTouSeason]
    day_types: list[EnergyTouNamed]
    week: dict[str, str]
    holiday: str | None
    holiday_eve: str | None
    bands: list[EnergyTouNamed]
    default_band: str
    schedule: dict[str, dict[str, list[tuple[str, str, str]]]]
    prices: dict[str, dict[str, str | None]]


class EnergyTouNamesEn(WireModel):
    """The English names by list and id (an entry without one is absent)."""
    seasons: dict[str, str]
    day_types: dict[str, str]
    bands: dict[str, str]


# ---------------------------------------------------------------- customers

class EnergyCustomerRef(WireModel):
    id: str
    customer_number: str
    name: str


class EnergyAccountRef(WireModel):
    id: str
    name: str
    status: Literal["active", "paused"]


class EnergyBillSummary(WireModel):
    """A bill in a list; `total` only for energy.bills holders."""
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
    kwh: str
    replaces_bill_id: str | None
    replaced_by_bill_id: str | None
    row_version: int
    created_at: str
    updated_at: str
    total: str = None


class EnergyCustomer(WireModel):
    """A customer (the card shared with water). Contact fields only with energy.bills or energy.manage; `accounts` and `bills` only on
    GET /customers/{id} (`bills` with energy.bills)."""
    id: str
    customer_number: str
    name: str
    revision: int
    created_at: str
    updated_at: str
    account_count: int
    address: str = None
    phone: str = None
    email: str = None
    tax_id: str = None
    notes: str = None
    accounts: list[EnergyAccountRef] = None
    bills: list[EnergyBillSummary] = None


class EnergyCustomerList(WireModel):
    items: list[EnergyCustomer]
    total: int


class EnergyNextNumber(WireModel):
    customer_number: str


# ---------------------------------------------------------------- accounts

class EnergyFormula(WireModel):
    """The account formula: its AST (meter ids, numbers, + - *), the text and the Hebrew sentence with meter names."""
    ast: dict[str, Any]
    text: str
    sentence_he: str
    meter_ids: list[str]


class EnergyAccountTariff(WireModel):
    """The account's tariff; `price` / `price_mode` (the version in force; price null for time of use) only with energy.bills."""
    id: str
    name: str
    kind: TariffKind
    price: str | None = None
    price_mode: PriceMode | None = None


class EnergyAccount(WireModel):
    id: str
    name: str
    customer: EnergyCustomerRef | None
    formula: EnergyFormula
    tariff: EnergyAccountTariff
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
    last_bill: EnergyBillSummary | None


class EnergyAccountList(WireModel):
    items: list[EnergyAccount]


class EnergyAccountPeriod(WireModel):
    from_: str = Field(alias="from")
    to: str
    end_exclusive: str
    state: Literal["future", "open", "billed", "draft"]
    bill: EnergyBillSummary | None


class EnergyAccountPeriods(WireModel):
    periods: list[EnergyAccountPeriod]


class EnergyHistoryPoint(WireModel):
    """kWh of one period: from an issued bill, else from the readings; null = no data (never invented)."""
    from_: str = Field(alias="from")
    to: str
    kwh: str | None
    status: Literal["measured", "partial", "missing"]
    source: Literal["bill", "readings"] | None


class EnergyHistoryPeriod(EnergyHistoryPoint):
    bill: EnergyBillSummary | None


class EnergyCurrentPeriod(WireModel):
    from_: str = Field(alias="from")
    to: str
    kwh: str | None


class EnergyComparison(WireModel):
    """The chart comparison of a period: the previous periods and the same period last year (absent data stays absent)."""
    current: EnergyCurrentPeriod
    previous: list[EnergyHistoryPoint]
    same_period_last_year: EnergyHistoryPoint | None


class EnergyAccountHistory(WireModel):
    """The ended periods, oldest first, and the comparison of the latest one."""
    periods: list[EnergyHistoryPeriod]
    comparison: EnergyComparison | None


class EnergyNote(WireModel):
    """A note of a computation (a meter that did not report, an opening reading ...); the extra keys depend on the code."""
    code: str
    text_he: str


class EnergyStatusMeter(WireModel):
    meter_id: str
    name: str
    kwh: str
    last_report_at: str | None
    reporting: bool


class EnergyAccountStatus(WireModel):
    """The open period so far; `error_code` when the computation was refused, `amount_so_far` only with energy.bills."""
    period: EnergyPeriod | None
    kwh_so_far: str | None
    meters: list[EnergyStatusMeter]
    notes: list[EnergyNote]
    error_code: str = None
    amount_so_far: str = None


class EnergyBillList(WireModel):
    items: list[EnergyBillSummary]


# ---------------------------------------------------------------- formula

class EnergyFormulaMessage(WireModel):
    """An error or a warning of the formula check (`pos` = the place in the text, `meter_id` = the meter it names)."""
    code: str
    message: str
    pos: int | None = None
    meter_id: str = None


class EnergyPreviewMeter(WireModel):
    meter_id: str
    name: str
    kwh: str


class EnergyFormulaPreview(WireModel):
    period: EnergyPeriod
    meters: list[EnergyPreviewMeter]
    result_kwh: str
    negative: bool


class EnergyFormulaCheck(WireModel):
    ok: bool
    ast: dict[str, Any] | None
    text: str | None
    sentence_he: str | None
    meter_ids: list[str]
    coefficients: dict[str, str]
    errors: list[EnergyFormulaMessage]
    warnings: list[EnergyFormulaMessage]
    preview: EnergyFormulaPreview | None


class EnergyFormulaPreset(WireModel):
    ast: dict[str, Any]
    text: str
    sentence_he: str


# ---------------------------------------------------------------- tariffs and VAT

class EnergyTariffVersion(WireModel):
    """A price version; a time-of-use version has no flat price and carries its definition."""
    id: str
    effective_from: str
    price: str | None
    price_mode: PriceMode
    created_at: str
    definition: EnergyTouDefinition = None
    definition_sha256: str = None
    names_en: EnergyTouNamesEn = None


class EnergyTariff(WireModel):
    id: str
    name: str
    currency: str
    kind: TariffKind
    versions: list[EnergyTariffVersion]
    current: EnergyTariffVersion | None
    used_by: int


class EnergyTariffList(WireModel):
    items: list[EnergyTariff]


class EnergyPlanSide(WireModel):
    effective_from: str
    price: str | None
    price_mode: PriceMode
    definition: EnergyTouDefinition = None
    definition_sha256: str = None


class EnergyVersionPlan(WireModel):
    """What saving a corrected price does: `later_only` = sealed bills keep the old price, the new one starts at `applies_from`."""
    kind: Literal["in_place", "later_only"]
    applies_from: str
    old: EnergyPlanSide
    new: EnergyPlanSide
    drafts: int
    range_to: str | None
    message_he: str


class EnergyPlanPreview(WireModel):
    """A correction not confirmed yet: the plan only (nothing saved)."""
    applied: Literal[False]
    plan: EnergyVersionPlan


class EnergyDraftFailure(WireModel):
    bill_id: str
    reason: str


class EnergyDraftsRecomputed(WireModel):
    recomputed: int
    failed: list[EnergyDraftFailure]


class EnergyTariffCorrected(EnergyTariff):
    """A confirmed correction: the tariff, the plan that was applied and the drafts recalculated."""
    applied: Literal[True]
    plan: EnergyVersionPlan
    drafts: EnergyDraftsRecomputed


class EnergyTouTemplate(WireModel):
    id: str
    name_he: str
    name_en: str
    source_he: str
    source_en: str
    definition: EnergyTouDefinition


class EnergyTouTemplates(WireModel):
    items: list[EnergyTouTemplate]


class EnergyTouError(WireModel):
    code: str
    path: str
    message: str


class EnergyTouGridCell(WireModel):
    from_: str = Field(alias="from")
    to: str
    band: str


class EnergyTouCheck(WireModel):
    """A checked definition (normalised) with the day grid per season and day type, or the first error; the grid also when only prices
    are missing. `names_en` only when the definition is valid."""
    ok: bool
    errors: list[EnergyTouError]
    definition: EnergyTouDefinition | None
    definition_sha256: str | None
    grid: dict[str, dict[str, list[EnergyTouGridCell]]] | None
    names_en: EnergyTouNamesEn = None


class EnergyCalendarEntry(WireModel):
    date: str
    kind: Literal["holiday", "holiday_eve", "regular"]
    kind_he: str
    name_he: str
    source: Literal["generated", "manual"]


class EnergyCalendarDay(EnergyCalendarEntry):
    """A special day; `generated` = the computed entry a manual one replaces."""
    generated: EnergyCalendarEntry | None


class EnergyCalendarYear(WireModel):
    """The special days of a year; `drafts_to_recalculate` after a day change (time-of-use drafts whose period holds the day)."""
    year: int
    revision: int
    generator: Literal["israel", "none"]
    days: list[EnergyCalendarDay]
    note_he: str
    drafts_to_recalculate: int = None


class EnergyVatRate(WireModel):
    id: str
    effective_from: str
    rate_percent: str


class EnergyVatRates(WireModel):
    items: list[EnergyVatRate]
    current: EnergyVatRate | None


# ---------------------------------------------------------------- billing settings and logo

class EnergyPaymentTerms(WireModel):
    mode: Literal["net_days", "day_of_month"]
    days: int
    day_of_month: int


class EnergyBusiness(WireModel):
    name: str
    registration_no: str
    address: str
    phone: str
    email: str
    accent_color: str
    footer_note: str


class EnergyNumbering(WireModel):
    customer_digits: int
    format: str


class EnergyAutoSettings(WireModel):
    delay_hours: int


class EnergyLogo(WireModel):
    sha256: str
    mime: str
    width: int
    height: int


class EnergyPdfEngine(WireModel):
    """The PDF engine this installation renders with (start-up self-check; a silent fallback is visible)."""
    configured: str
    active: str | None
    checked: bool
    detail: str
    last_render_engine: str | None
    slow_fallbacks: int
    crash_fallbacks: int
    fallback_after_s: int | float


class EnergyBillingSettings(WireModel):
    """The billing settings (shared with water); `pdf_engine` on GET only (null while a test renderer is registered)."""
    revision: int
    default_price_mode: PriceMode
    payment_terms: EnergyPaymentTerms
    business: EnergyBusiness
    numbering: EnergyNumbering
    auto: EnergyAutoSettings
    logo: EnergyLogo | None
    pdf_engine: EnergyPdfEngine | None = None


class EnergyLogoSaved(WireModel):
    logo: EnergyLogo


# ---------------------------------------------------------------- bills

class EnergyBillSent(WireModel):
    at: str
    how: Literal["email", "hand", "other"]
    note: str | None


class EnergyBillPaid(WireModel):
    at: str
    reference: str | None


class EnergyBillVoid(WireModel):
    at: str | None
    reason: str | None


class EnergyBillPdf(WireModel):
    """stored = the issued bill's PDF is saved; ready = produced on request; failed = the last attempt failed; unavailable = no engine."""
    state: Literal["stored", "ready", "failed", "unavailable"]
    error_code: str | None
    failed_at: str | None
    engine: str | None


class EnergyBill(EnergyBillSummary):
    """A bill with its sealed document (`snapshot`, ELECTRICITY_BILL_SNAPSHOT.md), the life-cycle marks, the allowed actions and the PDF."""
    snapshot: dict[str, Any]
    snapshot_sha256: str | None
    sent: EnergyBillSent | None
    paid: EnergyBillPaid | None
    void: EnergyBillVoid | None
    actions: list[Literal["recalculate", "delete", "issue", "pdf", "sent", "paid", "correct", "void"]]
    pdf: EnergyBillPdf


class EnergyBillCounts(WireModel):
    draft: int
    issued: int
    sent: int
    paid: int
    void: int


class EnergyBillsPage(WireModel):
    """A page of bills, the total of the filter, the counts by state (before the state filter) and the live-state revision."""
    items: list[EnergyBillSummary]
    total: int
    counts: EnergyBillCounts
    revision: str


class EnergyAutoRunCounts(WireModel):
    created: int
    issued: int
    skipped: int
    failed: int


class EnergyAutoState(WireModel):
    runs: EnergyAutoRunCounts
    last_run_at: str | None
    failed_waiting_retry: int


class EnergyBillsState(WireModel):
    """The bills screen's live state for polling (also the ETag); money-free."""
    counts: EnergyBillCounts
    bills_changed_at: str | None
    auto: EnergyAutoState
    revision: str


class EnergyBillActor(WireModel):
    kind: Literal["user", "system"]
    display_name: str | None


class EnergyBillEvent(WireModel):
    at: str
    action: str
    actor: EnergyBillActor
    details: dict[str, Any] | None


class EnergyBillEvents(WireModel):
    items: list[EnergyBillEvent]


class EnergyAutoRun(WireModel):
    account_id: str
    period: EnergyPeriod
    status: Literal["created", "issued", "skipped", "failed"]
    bill_id: str | None
    error_code: str | None
    attempts: int
    updated_at: str


class EnergyAutoRuns(WireModel):
    items: list[EnergyAutoRun]
