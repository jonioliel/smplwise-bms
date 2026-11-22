"""Response models of the internal cost-claim API (routers/tickets_costs.py, `/api/v1/tickets/costs/...` and
`/api/v1/tickets/{id}/costs...`; CR-038 slice 9, TK257 / TK258, TKDETAILBE, HARDEN271 / COSTINST). Field order is the order the router's
`_answer` and services/tickets (`costs.present_claim` / `present_revision`, `present.cost_block`, `quotes.answer` / `present_quote` /
`demand_view`, `rfq_terms.ticket_demands`, `costs_report.report` / `claim_rows`, `quotes.draft_message`) build their dicts in.

MONEY is an integer in minor units throughout. Passed through as built (documents other services own, or stored JSON): a revision's
lines and exceptional lines (stored with the revision), a quote's lines (stored with the quote), the claim's `basis` /
`schedule_check` / `quote_check` (services/tickets/claim_prefill, rfq_terms) and the per-kind deltas."""
from __future__ import annotations

from typing import Any

from . import WireModel

# routes without a JSON body: the CSV export, a cost file download, the assembled PDF of a document
NO_JSON = frozenset({
    "GET /tickets/costs/export.csv",
    "GET /tickets/{ticket_id}/costs/files/{file_id}",
    "GET /tickets/{ticket_id}/costs/{claim_id}/documents/{revision_id}/{doc}",
})


# ---------------------------------------------------------------- one ticket's costs (GET /tickets/{id}/costs and every cost write)

class TicketCostBlock(WireModel):
    """services/tickets/present.cost_block: the status chip for everyone who sees the ticket; the rest with tickets.costs.view only."""
    status: str
    can_view: bool
    total_minor: int | None = None
    currency: str | None = None
    can_decide: bool = False
    can_set_requirement: bool = False


class CostPage(WireModel):
    """One file (page) of a revision's document."""
    id: str
    kind: str
    bytes: int
    name: str
    width: int | None
    height: int | None


class CostDocument(WireModel):
    no: int
    kind: str
    pages: list[CostPage]


class CostRevision(WireModel):
    """services/tickets/costs.present_revision (the manager's view)."""
    id: str
    seq: int
    source: str
    kind: str
    based_on: str | None
    no_charge: bool
    lines: list[dict[str, Any]]
    """Stored with the revision: [{kind, description, total_minor, hours + rate_minor | quantity + unit_minor | amount_minor}]."""
    labor_minor: int
    parts_minor: int
    travel_minor: int
    other_minor: int
    subtotal_minor: int
    vat_mode: str
    vat_rate_bp: int
    vat_minor: int
    total_minor: int
    net_minor: int
    currency: str
    vendor_ref: str | None
    notes: str | None
    created_at: str
    documents: list[CostDocument]
    exceptional: list[dict[str, Any]]
    """TKDETAILBE (5.2): stored {index, kind, description, total_minor, reason} plus the review state of this claim."""
    basis: dict[str, Any] | None
    """CR-CLAIM-PREFILL (services/tickets/claim_prefill.present): what the demand was compared with, the vendor's reason."""
    reason: str | None = None
    """Only on a manager's revision."""
    created_by_kind: str
    created_by_name: str


class CostDecision(WireModel):
    id: str
    action: str
    revision_id: str | None
    reason: str | None
    internal_note: str | None
    amount_minor: int | None
    payment_ref: str | None
    by: str
    """The deciding user's name ('' for a vendor's own supersede)."""
    at: str


class ClaimBaseline(WireModel):
    """services/tickets/quotes.baseline_info: the approved quote a payment demand is validated against."""
    quote_id: str
    version: int
    state: str
    total_minor: int | None
    subtotal_minor: int | None
    currency: str
    line_kinds: list[str]


class CostClaim(WireModel):
    """services/tickets/costs.present_claim: without tickets.costs.view only the first seven fields."""
    id: str
    assignment_id: str
    status: str
    required: bool
    claim_until: str | None
    window_open: bool
    missing: bool
    instalment_index: int | None = None
    revision: int = 0
    currency: str = ""
    no_charge: bool = False
    current_revision_id: str | None = None
    approved_revision_id: str | None = None
    approved_total_minor: int | None = None
    approved_at: str | None = None
    approved_by: str | None = None
    paid_at: str | None = None
    payment_ref: str | None = None
    payment_date: str | None = None
    total_minor: int | None = None
    """The approved total once approved / paid, else the current revision's."""
    high_amount: bool = False
    vendor: str = ""
    contact_name: str = ""
    labor_rate_minor: int | None = None
    rate_currency: str | None = None
    vat_exempt: bool = False
    revisions: list[CostRevision] = []
    decisions: list[CostDecision] = []
    reopen_used: bool = False
    baseline: ClaimBaseline | None = None
    delta_minor: int | None = None
    kind_deltas: dict[str, int] | None = None
    needs_review: bool = False
    schedule_check: dict[str, Any] | None = None
    """CR-RFQ-PAYMENT-SCHEDULE (services/tickets/rfq_terms.check_demand): the demand against the approved payment schedule."""
    quote_check: dict[str, Any] | None = None
    """CR-CLAIM-PREFILL (services/tickets/claim_prefill.check): the demand against the approved quote or instalment."""


class CostSettingsBrief(WireModel):
    currencies: list[str]
    vat_rate_bp: int
    review_flag_above_minor: int
    max_claim_total_minor: int
    require_invoice: bool


class CostExternalAssignment(WireModel):
    id: str
    name: str
    assigned_at: str
    ended_at: str | None
    cost_claim: str | None
    quote_mode: str | None
    """TKUI3: null for a staff contact without an account (no money surface)."""
    quote_capable: bool


class QuoteFlow(WireModel):
    """services/tickets/quotes.flow: where the quote / payment pipeline of the ticket's external assignment stands."""
    stage: str
    sub_state: str | None
    assignment_id: str | None
    quote_mode: str | None


class AllowedLineKinds(WireModel):
    kinds: list[str]
    level: str


class QuoteApproved(WireModel):
    line_indexes: list[int]
    subtotal_minor: int | None
    vat_minor: int | None
    total_minor: int | None


class QuoteDecisionInfo(WireModel):
    by: str
    at: str | None
    reason: str | None
    internal_note: str | None


class QuoteCan(WireModel):
    decide: bool
    reject: bool


class CostQuote(WireModel):
    """services/tickets/quotes.present_quote (the manager's view): amounts and lines with tickets.costs.view only."""
    id: str
    version: int
    state: str
    source: str
    created_at: str
    assignment_id: str | None
    currency: str = ""
    vat_mode: str = ""
    vat_rate_bp: int = 0
    lines: list[dict[str, Any]] = []
    """Stored with the quote, plus `index` and (approved quotes) `approved`."""
    labor_minor: int = 0
    parts_minor: int = 0
    travel_minor: int = 0
    other_minor: int = 0
    subtotal_minor: int = 0
    vat_minor: int = 0
    total_minor: int = 0
    net_minor: int = 0
    work_from: str | None = None
    work_to: str | None = None
    valid_until: str | None = None
    note: str | None = None
    vendor_ref: str | None = None
    approved: QuoteApproved | None = None
    vendor: str = ""
    revision: int = 0
    created_by_name: str = ""
    decision: QuoteDecisionInfo | None = None
    can: QuoteCan | None = None


class InstalmentDemandRow(WireModel):
    """HARDEN271 + COSTINST (services/tickets/rfq_terms.ticket_demands): one instalment of the award's payment schedule; the amount
    only with tickets.costs.view."""
    id: str
    index: int
    kind: str
    status: str
    amount_minor: int | None
    currency: str | None
    due_date: str | None
    created_at: str | None
    paid_at: str | None
    cancelled_at: str | None
    award_id: str | None
    rfq_id: str | None
    moved: bool
    can_pay: bool
    timing: str


class MessageDraftSource(WireModel):
    kind: str
    id: str | None


class MessageDraftSend(WireModel):
    route: str
    source: MessageDraftSource


class MessageDraft(WireModel):
    """services/tickets/quotes.draft_message: the editable vendor message of a decision - nothing is sent."""
    text: str
    lang: str
    notify_default: bool
    send: MessageDraftSend


class TicketCosts(WireModel):
    """`GET /tickets/{id}/costs` and the answer of every cost write (routers/tickets_costs._answer): the settings, the external
    assignments and the baseline with tickets.costs.view only; a decision adds its `message_draft`."""
    ticket_id: str
    number: int
    cost: TicketCostBlock
    claims: list[CostClaim]
    settings: CostSettingsBrief | None = None
    external_assignments: list[CostExternalAssignment] = []
    flow: QuoteFlow
    allowed_line_kinds: AllowedLineKinds
    quote_mode: str | None
    quotes: list[CostQuote]
    baseline: ClaimBaseline | None = None
    instalment_demands: list[InstalmentDemandRow]
    message_draft: MessageDraft | None = None


class PendingCostFile(WireModel):
    """`POST /tickets/{id}/costs/files`: an invoice page or PDF waiting for its claim."""
    id: str
    kind: str
    bytes: int
    width: int | None
    height: int | None


# ---------------------------------------------------------------- the report, the vendors account, the bulk "mark as paid"

class CostReportGroup(WireModel):
    key: str
    label: str
    currency: str
    approved_minor: int
    pending_minor: int
    claims: int
    labor_minor: int
    parts_minor: int
    travel_minor: int
    other_minor: int
    tickets: int


class CostReportTotal(WireModel):
    currency: str
    approved_minor: int
    pending_minor: int
    claims: int
    tickets: int


class CostReport(WireModel):
    """`GET /tickets/costs/report` (services/tickets/costs_report.report): per group and currency, never summed across currencies."""
    group_by: str
    groups: list[CostReportGroup]
    totals: list[CostReportTotal]
    claims: int


class AccountClaim(WireModel):
    """One claim of the vendors account: the counted amount in its own currency."""
    claim_id: str
    ticket_id: str | None
    number: int | None
    title: str
    department_id: str
    department: str
    vendor_key: str
    vendor: str
    status: str
    currency: str
    amount_minor: int
    revision: int
    submitted_at: str | None
    approved_at: str | None
    paid_at: str | None
    payment_date: str | None
    payment_ref: str | None
    period_at: str | None
    can_mark_paid: bool


class AccountVendor(WireModel):
    key: str
    label: str


class AccountDepartment(WireModel):
    id: str
    name: str


class AccountClaims(WireModel):
    """`GET /tickets/costs/claims` (TK258 "vendors account")."""
    rows: list[AccountClaim]
    truncated: bool
    vendors: list[AccountVendor]
    departments: list[AccountDepartment]
    can_mark_paid: bool
    """tickets.costs anywhere: the bulk action is offered at all."""


class BulkPaidResult(WireModel):
    ticket_id: str
    claim_id: str
    number: int = 0
    """Absent for an unknown or invisible ticket."""
    result: str
    revision: int = 0
    """Absent for `not_found` / `forbidden`."""


class BulkPaidAnswer(WireModel):
    """`POST /tickets/costs/mark-paid`: a result per item, never one refusal for all."""
    results: list[BulkPaidResult]
    paid: int
    already_paid: int
    failed: int


# ---------------------------------------------------------------- department defaults (tickets.configure)

class DepartmentCosts(WireModel):
    id: str
    key: str
    name: str
    active: int
    """The stored 0 / 1."""
    cost_claim: str | None
    claim_window_days: int | None
    allowed_line_kinds: list[str] | None
    """null = the installation default."""


class DepartmentCostsInstallation(WireModel):
    mode: str
    claim_window_days: int
    allowed_line_kinds: list[str]


class DepartmentCostsAnswer(WireModel):
    """`GET / PUT /tickets/costs/departments...`."""
    departments: list[DepartmentCosts]
    installation: DepartmentCostsInstallation
