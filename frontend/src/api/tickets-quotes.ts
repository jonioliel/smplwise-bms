/**
 * TKUI3 (release 2.6.0): the ONLY module of the frontend that talks to the quote routes of the detail backend (contract v1.3 §3, §4.4,
 * docs/tickets/DETAIL_BACKEND_CONTRACT.md; smplwise_vms/backend/smplwise/routers/tickets_detail.py):
 *   - `GET  tickets/{id}/quotes`                              the flow, the allowed line kinds, the quote mode, the quotes, the baseline;
 *   - `POST tickets/{id}/quotes`                              a quote entered on the vendor's behalf;
 *   - `POST tickets/{id}/quotes/{quote_id}/approve`           {revision, line_indexes?} - all lines, or a subset = a partial approval;
 *   - `POST tickets/{id}/quotes/{quote_id}/request-fix`       {revision, reason};
 *   - `POST tickets/{id}/quotes/{quote_id}/reject`            {revision, reason};
 *   - `POST tickets/{id}/quotes/requirement`                  {assignment_id, mode} (a manager of the request);
 *   - `PUT  tickets/{id}/allowed-line-kinds`                  {kinds | null} (null = back to the department / installation default).
 * Every decision answers the quotes block plus `message_draft` - an editable text for the vendor. NOTHING is sent by a decision: the
 * screen asks "לשלוח הודעה לספק?" and only the manager's explicit send (tickets-conversation.ts `vendorMessage`) writes to the vendor.
 * The same block arrives inside `GET tickets/{id}/costs` (tickets-costs.ts `TicketCostsFull`), which is what the Costs tab reads.
 * Without a backend the demo store in ./tickets-costs-mock.ts answers.
 *
 * MONEY: integers in minor units as the server sends them; amounts sent are decimal strings (tickets-costs.ts `LineInput`).
 */
import { post, put } from './client';
import { isApi } from './session';
import type { CostMode, LineInput, LineKind, StoredLine, VatMode } from './tickets-costs';
import { mockQuotes } from './tickets-costs-mock';

export type QuoteState = 'submitted' | 'fix_requested' | 'approved' | 'partially_approved' | 'rejected' | 'superseded' | 'withdrawn' | 'not_awarded';
export type QuoteAction = 'approve' | 'request-fix' | 'reject';
/** contract 4.3: the stage indicator of the current (else the latest) external assignment */
export type FlowStage =
  | 'none' | 'quote_optional' | 'quote_requested' | 'quote_submitted' | 'quote_fix_requested' | 'quote_rejected' | 'quote_approved' | 'work'
  | 'demand_awaiting' | 'demand_submitted' | 'demand_rejected' | 'demand_approved' | 'paid';

export interface CostFlow { stage: FlowStage; sub_state: 'waiting_part' | null; assignment_id: string | null; quote_mode: CostMode | null }

export interface QuoteLine extends StoredLine {
  index: number;
  /** present once the quote is approved / partially approved */
  approved?: boolean;
}

/** One quote. Without tickets.costs.view only `id`, `version`, `state`, `source`, `created_at`, `assignment_id` arrive. */
export interface Quote {
  id: string;
  version: number;
  state: QuoteState;
  source: 'vendor' | 'manager';
  created_at: string;
  assignment_id: string | null;
  currency?: string;
  vat_mode?: VatMode;
  vat_rate_bp?: number;
  lines?: QuoteLine[];
  labor_minor?: number;
  parts_minor?: number;
  travel_minor?: number;
  other_minor?: number;
  subtotal_minor?: number;
  vat_minor?: number;
  total_minor?: number;
  net_minor?: number;
  work_from?: string | null;
  work_to?: string | null;
  /** TKQVALID: the quote's validity (an instant, the end of the chosen day); full view only */
  valid_until?: string | null;
  note?: string | null;
  vendor_ref?: string | null;
  approved?: { line_indexes: number[]; subtotal_minor: number | null; vat_minor: number | null; total_minor: number | null } | null;
  vendor?: string;
  revision?: number;
  created_by_name?: string;
  decision?: { by: string; at: string | null; reason: string | null } | null;
  can?: { decide: boolean; reject?: boolean };
}

export interface QuoteBaseline { quote_id: string; version: number; state?: QuoteState; total_minor: number | null; subtotal_minor?: number | null; currency: string; line_kinds: LineKind[] }

export interface QuoteBlock {
  flow: CostFlow;
  allowed_line_kinds: { kinds: LineKind[]; level: 'request' | 'department' | 'installation' };
  quote_mode: CostMode | null;
  quotes: Quote[];
  /** full view only */
  baseline?: QuoteBaseline | null;
}

/** contract 7: the editable text of a decision message, in the vendor's language - never an amount. */
export interface MessageDraft {
  text: string;
  lang: string;
  notify_default: boolean;
  send: { route: string; source: { kind: 'quote' | 'claim'; id: string } };
}

export type QuotesAnswer = QuoteBlock & { message_draft?: MessageDraft };

/** `reason` is shown to the vendor (request-fix / reject); `internal_note` (TKFIX260) never is - not on the page, not in the draft. */
export interface QuoteDecisionBody { revision: number; line_indexes?: number[]; reason?: string; internal_note?: string; /** TKQVALID: needed to approve a quote past its valid-until (409 `quote_expired` without it) */ confirm_expired?: boolean }
export interface QuoteOnBehalfBody {
  assignment_id?: string;
  lines: LineInput[];
  currency?: string;
  amounts_include_vat?: boolean;
  work_from?: string;
  work_to?: string;
  valid_until?: string;
  note?: string;
  vendor_ref?: string;
}

export interface QuotesBackend {
  decide(ticketId: string, quoteId: string, action: QuoteAction, body: QuoteDecisionBody): Promise<QuotesAnswer>;
  onBehalf(ticketId: string, body: QuoteOnBehalfBody): Promise<QuotesAnswer>;
  setMode(ticketId: string, assignmentId: string, mode: CostMode): Promise<QuotesAnswer>;
  setKinds(ticketId: string, kinds: LineKind[] | null): Promise<QuotesAnswer>;
}

const enc = encodeURIComponent;

const rest: QuotesBackend = {
  decide: (id, quoteId, action, body) => post<QuotesAnswer>(`tickets/${enc(id)}/quotes/${enc(quoteId)}/${action}`, body),
  onBehalf: (id, body) => post<QuotesAnswer>(`tickets/${enc(id)}/quotes`, body),
  setMode: (id, assignmentId, mode) => post<QuotesAnswer>(`tickets/${enc(id)}/quotes/requirement`, { assignment_id: assignmentId, mode }),
  setKinds: (id, kinds) => put<QuotesAnswer>(`tickets/${enc(id)}/allowed-line-kinds`, { kinds }),
};

/** The backend in force: REST with a server, the demo store without one. */
export function ticketQuotesApi(): QuotesBackend {
  return isApi() ? rest : mockQuotes;
}
