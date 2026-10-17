/**
 * CR-038 slice 9 (section 11A, owner decisions D31 / D32): the ONLY module of the frontend that talks to the cost-claim routes of
 * smplwise_vms/backend/smplwise/routers/tickets_costs.py (and the `costs` block of `GET / PUT tickets/settings`, the assign preview's
 * `cost_claim`). A separate file so slice 9 never edits slice 1's api/tickets.ts beyond the few typed fields it adds there. Without a
 * backend (static preview, design review) every call is answered by the demo store in ./tickets-costs-mock.ts.
 *
 * MONEY: every amount is an INTEGER in minor units (agorot for ILS) as the server sends it; amounts the client sends are DECIMAL
 * STRINGS (`"120.50"`), never numbers - the server parses and recomputes every figure (11A.4). Display formatting lives in
 * tickets/cost-model.ts.
 */
import { ApiError, apiUrl, get, post, put, upload, type ApiErrorBody } from './client';
import { isApi } from './session';
import { mockCosts } from './tickets-costs-mock';
import type { MessageDraft, QuoteBlock } from './tickets-quotes';

export type CostMode = 'required' | 'optional' | 'off';
export type CostStatus = 'not_required' | 'awaiting' | 'submitted' | 'rejected' | 'approved' | 'paid';
export type ClaimStatus = Exclude<CostStatus, 'not_required'>;
export type LineKind = 'labor' | 'parts' | 'travel' | 'other';
export type VatMode = 'excluded' | 'included' | 'none';
export const COST_MODES: readonly CostMode[] = ['required', 'optional', 'off'];
export const LINE_KINDS: readonly LineKind[] = ['labor', 'parts', 'travel', 'other'];
/** money.CURRENCIES of the server: ISO 4217 codes with two minor digits (the only ones the input rule accepts). */
export const CURRENCIES: readonly string[] = ['ILS', 'USD', 'EUR', 'GBP', 'CHF', 'CAD', 'AUD'];

/** `GET tickets/{id}` › `cost`: the chip for everyone who sees the ticket; the rest only with tickets.costs.view on its place. */
export interface TicketCostBlock {
  status: CostStatus;
  can_view: boolean;
  total_minor?: number | null;
  currency?: string | null;
  can_decide?: boolean;
  can_set_requirement?: boolean;
}

/** A stored line of a revision (the server's `Line.as_json`). */
export interface StoredLine {
  kind: LineKind;
  description: string;
  total_minor: number;
  hours?: string;
  rate_minor?: number;
  quantity?: string;
  unit_minor?: number;
  amount_minor?: number;
}

/** A line the client sends (decimal strings only; the server computes `total_minor`). */
export type LineInput =
  | { kind: 'labor'; description?: string; hours: string; rate: string }
  | { kind: 'parts'; description: string; quantity: string; unit_price: string }
  | { kind: 'travel' | 'other'; description?: string; amount: string };

export interface CostPage { id: string; kind: 'photo' | 'pdf'; bytes: number; name: string; width?: number | null; height?: number | null }
export interface CostDocument { no: number; kind: 'photo' | 'pdf'; pages: CostPage[] }

export interface CostRevision {
  id: string;
  seq: number;
  source: 'vendor' | 'manager';
  kind: 'submission' | 'adjustment' | 'on_behalf';
  based_on: string | null;
  no_charge: boolean;
  lines: StoredLine[];
  labor_minor: number;
  parts_minor: number;
  travel_minor: number;
  other_minor: number;
  subtotal_minor: number;
  vat_mode: VatMode;
  vat_rate_bp: number;
  vat_minor: number;
  net_minor: number;
  total_minor: number;
  currency: string;
  vendor_ref: string | null;
  notes: string | null;
  reason?: string | null;
  created_at: string;
  created_by_kind?: 'contact' | 'user';
  created_by_name?: string;
  documents: CostDocument[];
  /** TKDETAILBE (contract 5.2): the lines of this revision outside the baseline (or outside the allowed kinds without one) */
  exceptional?: ExceptionalLine[];
}

/** TKDETAILBE (5.2): an exceptional line of a payment demand - `not_in_quote` against a baseline, `kind_not_allowed` without one. */
export interface ExceptionalLine {
  index: number;
  kind: LineKind;
  description: string;
  total_minor: number;
  reason: 'not_in_quote' | 'kind_not_allowed';
  review?: 'pending' | 'accepted' | 'excluded';
}

/** TKDETAILBE (5.2): the approved quote a payment demand was validated against. */
export interface ClaimBaseline { quote_id: string; version: number; total_minor: number | null; currency: string; state?: string; subtotal_minor?: number | null; line_kinds?: LineKind[] }

export type DecisionAction = 'approve' | 'adjust' | 'reject' | 'mark_paid' | 'unmark_paid' | 'reopen_window' | 'override_close' | 'superseded' | 'requirement';
export interface CostDecision {
  id: string;
  action: DecisionAction;
  revision_id: string | null;
  reason: string | null;
  amount_minor: number | null;
  payment_ref: string | null;
  /** the deciding user's name ('' for a vendor's own supersede) */
  by: string;
  at: string;
}

/** One claim (one per external assignment). Without tickets.costs.view only the first block of fields arrives. */
export interface CostClaim {
  id: string;
  assignment_id: string;
  status: ClaimStatus;
  required: boolean;
  claim_until: string | null;
  window_open: boolean;
  missing: boolean;
  revision?: number;
  currency?: string;
  no_charge?: boolean;
  current_revision_id?: string | null;
  approved_revision_id?: string | null;
  approved_total_minor?: number | null;
  approved_at?: string | null;
  approved_by?: string | null;
  paid_at?: string | null;
  payment_ref?: string | null;
  payment_date?: string | null;
  /** the approved total once approved / paid, else the current revision's */
  total_minor?: number | null;
  high_amount?: boolean;
  vendor?: string;
  contact_name?: string;
  labor_rate_minor?: number | null;
  rate_currency?: string | null;
  vat_exempt?: boolean;
  reopen_used?: boolean;
  revisions?: CostRevision[];
  decisions?: CostDecision[];
  /** TKDETAILBE (5.2, full view): the baseline, the difference from it (same currency only) and whether exceptional lines wait */
  baseline?: ClaimBaseline | null;
  delta_minor?: number | null;
  kind_deltas?: Record<LineKind, number> | null;
  needs_review?: boolean;
  /** CR-CLAIM-PREFILL (full view): the demand against the approved quote or the instalment it named - flags only, never a refusal */
  quote_check?: QuoteCheck | null;
  /** CR-CLAIM-PREFILL (0116): the instalment this claim demands (one claim per instalment), else null */
  instalment_index?: number | null;
}

export type QuoteCheckFlag = 'above_quote' | 'below_quote' | 'lines_differ' | 'currency';
export interface QuoteCheck {
  status: 'same' | 'differs';
  flags: QuoteCheckFlag[];
  basis: 'total' | 'instalment';
  instalment_index: number | null;
  basis_minor: number;
  demand_minor: number;
  delta_minor: number | null;
  currency: string;
  quote_version: number;
  /** the vendor's short reason for a demand above the approved amount */
  above_reason: string | null;
}

export interface CostSettingsBrief { currencies: string[]; vat_rate_bp: number; review_flag_above_minor: number; max_claim_total_minor: number; require_invoice: boolean }
export interface ExternalAssignment {
  id: string;
  name: string;
  assigned_at: string;
  ended_at: string | null;
  cost_claim: CostMode | null;
  /** TKDETAILBE: the quote requirement of the assignment (null on an older server = optional) */
  quote_mode?: CostMode | null;
  /** TKUI3: false for a staff contact without an account - no quote, no payment demand, no requirement (undefined on an older server) */
  quote_capable?: boolean;
}

/** `GET tickets/{id}/costs` (and the answer of every cost write). */
export interface TicketCosts {
  ticket_id: string;
  number: number;
  cost: TicketCostBlock;
  claims: CostClaim[];
  settings?: CostSettingsBrief;
  external_assignments?: ExternalAssignment[];
}

/** TKDETAILBE (contract 4.4): `GET tickets/{id}/costs` also carries the quotes block (amounts only with tickets.costs.view). */
export type TicketCostsFull = TicketCosts & Partial<QuoteBlock>;
/** The answer of a claim decision: the costs answer plus the editable vendor message draft (contract 5.3 / 7) - nothing is sent. */
export type DecisionAnswer = TicketCostsFull & { message_draft?: MessageDraft };

export type DecisionKind = 'approve' | 'adjust' | 'reject' | 'mark-paid' | 'unmark-paid' | 'reopen-window';
export interface DecisionBody {
  /** the claim's optimistic revision (409 claim_stale when it moved) */
  revision: number;
  /** the claim's current_revision_id - approve / adjust / reject */
  revision_id?: string;
  reason?: string;
  lines?: LineInput[];
  payment_ref?: string;
  /** YYYY-MM-DD */
  payment_date?: string;
  /** TKDETAILBE (5.3): approve with or without the exceptional lines (approve only; omitted = include) */
  exceptional?: 'include' | 'exclude';
  /** TKFIX260: approve / adjust / reject - the manager's internal note, stored apart from `reason`; never shown to the vendor */
  internal_note?: string;
}

export interface OnBehalfBody {
  assignment_id?: string;
  lines: LineInput[];
  currency?: string;
  amounts_include_vat?: boolean;
  vendor_ref?: string;
  notes?: string;
  no_charge?: boolean;
  documents: { file_ids: string[] }[];
}
export interface PendingFile { id: string; kind: 'photo' | 'pdf'; bytes: number; width: number | null; height: number | null }

// ---------------------------------------------------------------- the report (11A.9)

export type ReportGroupBy = 'vendor' | 'department' | 'device' | 'room' | 'month';
export type ReportStatus = 'submitted' | 'approved' | 'paid';
export const REPORT_GROUPS: readonly ReportGroupBy[] = ['vendor', 'department', 'device', 'room', 'month'];
export const REPORT_STATUSES: readonly ReportStatus[] = ['submitted', 'approved', 'paid'];
/** `vendor` (the vendor grouping's key) and `department` (an id): TK258's filters, also taken by the report and the export. */
export interface ReportQuery { group_by: ReportGroupBy; from?: string; to?: string; status?: ReportStatus[]; currency?: string; vendor?: string; department?: string }
export interface ReportGroupRow {
  key: string;
  label: string;
  currency: string;
  approved_minor: number;
  pending_minor: number;
  claims: number;
  tickets: number;
  labor_minor: number;
  parts_minor: number;
  travel_minor: number;
  other_minor: number;
}
export interface ReportTotal { currency: string; approved_minor: number; pending_minor: number; claims: number; tickets: number }
export interface CostReport { group_by: ReportGroupBy; groups: ReportGroupRow[]; totals: ReportTotal[]; claims: number }

// ---------------------------------------------------------------- TK258: the vendors account ("חשבון ספקים")

/** One claim of `GET tickets/costs/claims`: the counted amount in ITS currency (approved total once approved / paid). */
export interface AccountClaim {
  claim_id: string;
  ticket_id: string | null;
  number: number | null;
  title: string;
  department_id: string;
  department: string;
  vendor_key: string;
  vendor: string;
  status: ReportStatus;
  currency: string;
  amount_minor: number;
  /** the claim's optimistic revision (sent back with "mark as paid") */
  revision: number;
  submitted_at: string | null;
  approved_at: string | null;
  paid_at: string | null;
  payment_date: string | null;
  payment_ref: string | null;
  period_at: string | null;
  can_mark_paid: boolean;
}
export interface AccountClaims {
  rows: AccountClaim[];
  truncated: boolean;
  vendors: { key: string; label: string }[];
  departments: { id: string; name: string }[];
  /** tickets.costs anywhere (the bulk action is offered at all) */
  can_mark_paid: boolean;
}
export type AccountQuery = Omit<ReportQuery, 'group_by'>;
export interface BulkPaidItem { ticket_id: string; claim_id: string; revision?: number }
export type BulkPaidResult = 'paid' | 'already_paid' | 'not_found' | 'forbidden' | 'not_approved' | 'stale';
export interface BulkPaidAnswer {
  results: { ticket_id: string; claim_id: string; number?: number; result: BulkPaidResult; revision?: number }[];
  paid: number;
  already_paid: number;
  failed: number;
}

// ---------------------------------------------------------------- settings (11A.14) and department defaults (11A.1)

export interface CostsSettings {
  mode: CostMode;
  currencies: string[];
  vat_rate_bp: number;
  claim_window_days: number;
  require_invoice: boolean;
  max_claim_total_minor: number;
  review_flag_above_minor: number;
  retention_days: number;
  /** TKDETAILBE: the installation default of the allowed cost line kinds (labor is always one of them) */
  allowed_line_kinds?: LineKind[];
}
export interface CostsSettingsDoc { revision: number; costs: CostsSettings }
export interface DepartmentCosts {
  id: string;
  key: string;
  name: string;
  active: boolean;
  cost_claim: CostMode | null;
  claim_window_days: number | null;
  /** TKDETAILBE: the department's allowed cost line kinds; null = the installation default */
  allowed_line_kinds?: LineKind[] | null;
}
export interface DepartmentCostsAnswer { departments: DepartmentCosts[]; installation: { mode: CostMode; claim_window_days: number; allowed_line_kinds?: LineKind[] } }
/** `PUT tickets/costs/departments/{id}`: the requirement and window are always written (null = the installation's); the kinds only when sent. */
export interface DepartmentCostsBody { cost_claim: CostMode | null; claim_window_days: number | null; allowed_line_kinds?: LineKind[] | null }

/** `POST tickets/{id}/assign/preview` (slice 4) - only the part slice 9 reads; the rest belongs to slice 4's assign dialog. */
export interface CostClaimOption { default: CostMode; from: 'contact' | 'vendor' | 'department' | 'installation'; choices: CostMode[] }
export interface AssignPreview { channel?: string; text?: string; require_code?: boolean; refusals?: string[]; cost_claim: CostClaimOption; [k: string]: unknown }

export interface CostsBackend {
  get(ticketId: string): Promise<TicketCostsFull>;
  decide(ticketId: string, claimId: string, action: DecisionKind, body: DecisionBody): Promise<DecisionAnswer>;
  setRequirement(ticketId: string, assignmentId: string, mode: CostMode): Promise<TicketCosts>;
  uploadFile(ticketId: string, file: File): Promise<PendingFile>;
  onBehalf(ticketId: string, body: OnBehalfBody): Promise<TicketCosts>;
  /** an invoice page as an inline image (`<img src>`) */
  pageUrl(ticketId: string, fileId: string): string;
  /** a PDF file (attachment) - a download, never shown inline (11A.6) */
  downloadFile(ticketId: string, fileId: string): Promise<void>;
  /** "הורדה כ-PDF": the photographed pages of one document assembled on the server (11A.6A) */
  downloadDocument(ticketId: string, claimId: string, revisionId: string, docNo: number): Promise<void>;
  report(q: ReportQuery): Promise<CostReport>;
  exportCsv(q: ReportQuery, rows: 'claim' | 'line'): Promise<void>;
  /** TK258: the claims of the filters, one per row */
  accountClaims(q: AccountQuery): Promise<AccountClaims>;
  /** TK258: "סימון כשולם" for several approved claims (a result per item) */
  markPaidBulk(items: BulkPaidItem[], paymentRef: string, paymentDate: string): Promise<BulkPaidAnswer>;
  departments(): Promise<DepartmentCostsAnswer>;
  saveDepartment(id: string, body: DepartmentCostsBody): Promise<DepartmentCostsAnswer>;
  settings(): Promise<CostsSettingsDoc>;
  saveSettings(revision: number, costs: Partial<CostsSettings>): Promise<CostsSettingsDoc>;
  assignPreview(ticketId: string, contactId: string, requireCode?: boolean): Promise<AssignPreview>;
}

const T = 'tickets';
const enc = encodeURIComponent;

/** The report / export query string (only what is set; the statuses comma-joined as the server reads them). */
export function reportQs(q: ReportQuery | AccountQuery, extra: Record<string, string> = {}): string {
  const p = new URLSearchParams();
  if ('group_by' in q && q.group_by) p.set('group_by', q.group_by);
  if (q.from) p.set('from', q.from);
  if (q.to) p.set('to', q.to);
  if (q.status?.length) p.set('status', q.status.join(','));
  if (q.currency) p.set('currency', q.currency);
  if (q.vendor) p.set('vendor', q.vendor);
  if (q.department) p.set('department', q.department);
  for (const [k, v] of Object.entries(extra)) p.set(k, v);
  const s = p.toString();
  return s ? `?${s}` : '';
}

/** The file name of a `Content-Disposition` answer (or the fallback). */
export function dispositionName(header: string | null, fallback: string): string {
  const m = /filename\*?=(?:UTF-8'')?"?([^";]+)"?/i.exec(header ?? '');
  try {
    return m ? decodeURIComponent(m[1]) : fallback;
  } catch {
    return m ? m[1] : fallback;
  }
}

/** Save a blob under a name through a temporary link (the browser's own download; nothing is rendered by the app). */
export function saveBlob(blob: Blob, name: string): void {
  const href = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = href;
  a.download = name;
  a.rel = 'noopener';
  a.style.display = 'none';
  document.body.appendChild(a);
  a.click();
  a.remove();
  window.setTimeout(() => URL.revokeObjectURL(href), 30_000);
}

/** GET a file route and save it; a refusal (429 export_rate, 413, 404, 403) is the usual ApiError with the server's message. */
async function download(path: string, fallback: string): Promise<void> {
  const res = await fetch(apiUrl(path), { credentials: 'same-origin' });
  if (!res.ok) {
    let body: ApiErrorBody | null = null;
    try {
      body = (await res.json()) as ApiErrorBody;
    } catch {
      body = null;
    }
    throw new ApiError(res.status, body ?? { code: `http_${res.status}`, user_message: res.statusText, retryable: false, correlation_id: '', details: {} });
  }
  saveBlob(await res.blob(), dispositionName(res.headers.get('Content-Disposition'), fallback));
}

const rest: CostsBackend = {
  get: (id) => get<TicketCostsFull>(`${T}/${enc(id)}/costs`),
  decide: (id, claimId, action, body) => post<DecisionAnswer>(`${T}/${enc(id)}/costs/${enc(claimId)}/${action}`, body),
  setRequirement: (id, assignmentId, mode) => post<TicketCosts>(`${T}/${enc(id)}/costs/requirement`, { assignment_id: assignmentId, mode }),
  uploadFile: (id, file) => {
    const form = new FormData();
    form.append('file', file, file.name || (file.type === 'application/pdf' ? 'invoice.pdf' : 'page.jpg'));
    return upload<PendingFile>(`${T}/${enc(id)}/costs/files`, form);
  },
  onBehalf: (id, body) => post<TicketCosts>(`${T}/${enc(id)}/costs`, body),
  pageUrl: (id, fileId) => apiUrl(`${T}/${enc(id)}/costs/files/${enc(fileId)}`),
  downloadFile: (id, fileId) => download(`${T}/${enc(id)}/costs/files/${enc(fileId)}`, 'invoice.pdf'),
  downloadDocument: (id, claimId, revisionId, docNo) => download(`${T}/${enc(id)}/costs/${enc(claimId)}/documents/${enc(revisionId)}/${docNo}.pdf`, `invoice-${docNo}.pdf`),
  report: (q) => get<CostReport>(`${T}/costs/report${reportQs(q)}`),
  exportCsv: (q, rows) => download(`${T}/costs/export.csv${reportQs(q, { rows })}`, 'costs.csv'),
  accountClaims: (q) => get<AccountClaims>(`${T}/costs/claims${reportQs(q)}`),
  markPaidBulk: (items, paymentRef, paymentDate) => post<BulkPaidAnswer>(`${T}/costs/mark-paid`, { items, payment_ref: paymentRef, payment_date: paymentDate }),
  departments: () => get<DepartmentCostsAnswer>(`${T}/costs/departments`),
  saveDepartment: (id, body) => put<DepartmentCostsAnswer>(`${T}/costs/departments/${enc(id)}`, body),
  settings: async () => {
    const doc = await get<{ revision: number; costs: CostsSettings }>(`${T}/settings`);
    return { revision: doc.revision, costs: doc.costs };
  },
  saveSettings: async (revision, costs) => {
    const doc = await put<{ revision: number; costs: CostsSettings }>(`${T}/settings`, { revision, costs });
    return { revision: doc.revision, costs: doc.costs };
  },
  assignPreview: (id, contactId, requireCode) => post<AssignPreview>(`${T}/${enc(id)}/assign/preview`, { contact_id: contactId, ...(requireCode === undefined ? {} : { require_code: requireCode }) }),
};

/** The backend in force: REST with a server, the demo store without one. */
export function ticketCostsApi(): CostsBackend {
  return isApi() ? rest : mockCosts;
}
