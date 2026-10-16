/**
 * TKRFQ2 (release 2.6.1, RFQ stage C2 - the manager UI): the ONLY module of the frontend that talks to the request-for-quotation routes
 * of smplwise_vms/backend/smplwise/routers/tickets_rfq.py (docs/tickets/RFQ_BACKEND_CONTRACT.md v0.9, sections 9-11). The shapes below
 * follow the presenters of services/tickets/rfq.py on pilot/TKRFQ1-core (`summary`, `detail`, `comparison`, `meta`, `present_award`,
 * `award_draft`, `present_message`). Without a backend (static preview, design review) every call is answered by the demo store in
 * ./tickets-rfq-mock.ts, which follows the same rules.
 *
 * An RFQ ("בקשת הצעת מחיר") asks SEVERAL vendors for a price with no commitment to award; it is neither a vendor's quote on an
 * assigned item ("הצעת מחיר") nor the payment demand after the work ("דרישת תשלום").
 *
 * MONEY: every amount is an INTEGER in minor units as the server sends it; amounts the client sends (a quote entered on the vendor's
 * behalf) are DECIMAL STRINGS - the server recomputes every figure. Amounts are never added across currencies.
 *
 * Optional fields marked "C2 gap" are NOT in contract v0.9: the screens read them when present and otherwise hide the part they drive
 * (attachments, per-vendor channel / code choice at invite time, the invitation preview, the created order's link).
 */
import { ApiError, del, get, patch, post, put } from './client';
import { isApi } from './session';
import type { LineInput, LineKind, StoredLine, VatMode } from './tickets-costs';
import { mockRfq } from './tickets-rfq-mock';

export type RfqState = 'draft' | 'sent' | 'collecting' | 'due_passed' | 'awarded' | 'ordered' | 'closed' | 'cancelled';
export type RfqFilter = 'open' | 'all' | RfqState;
export type RfqVendorState = 'draft' | 'sent' | 'opened' | 'quoted' | 'declined' | 'expired' | 'withdrawn' | 'awarded' | 'not_awarded' | 'removed';
export type RfqChannel = 'whatsapp' | 'email' | 'manual';
export type RfqQuoteState = 'submitted' | 'superseded' | 'withdrawn' | 'approved' | 'partially_approved' | 'not_awarded';
export type RfqAwardState = 'pending_second' | 'approved' | 'declined';
export type RfqLinkState = 'live' | 'grace' | 'expired' | 'revoked' | 'none';

export const RFQ_FILTERS: readonly RfqFilter[] = ['open', 'draft', 'collecting', 'due_passed', 'awarded', 'closed', 'cancelled', 'all'];
/** The states the server calls open (an award or a close is still possible). */
export const RFQ_OPEN: readonly RfqState[] = ['sent', 'collecting', 'due_passed'];
export const RFQ_ENDED: readonly RfqState[] = ['closed', 'cancelled'];

export interface RfqKpis {
  invited: number;
  sent: number;
  opened: number;
  quoted: number;
  declined: number;
  no_response: number;
  /** null without tickets.costs.view */
  lowest_total_minor: number | null;
  currency: string | null;
}

export interface RfqPerson { id: string | null; name: string; active?: boolean }

/** RFQQUESTIONS (contract section 19): unanswered vendor questions - `unread` = no RFQ manager opened them yet. Zero once the request is no
 * longer open (sent / collecting / due_passed). Absent from servers before 2.6.5: the screens then show no badge. */
export interface RfqQuestionCounts { pending: number; unread: number }

/** One pending question in the detail's "שאלות ממתינות" section. */
export interface RfqQuestion {
  id: string;
  vendor_id: string;
  vendor: { name: string; company: string };
  text: string;
  at: string;
  read: boolean;
  /** `whatsapp` = a WhatsApp reply matched to the request: an unverified sender */
  via: 'page' | 'whatsapp';
  unverified: boolean;
  /** the quote the vendor sent the question with (the quote form's own question field) */
  quote: { id: string; version: number } | null;
  age_h: number;
}

/** One row of `GET tickets/rfqs` (rfq.summary). */
export interface RfqSummary {
  id: string;
  number: number;
  ref: string;
  state: RfqState;
  title: string;
  department: { id: string; name: string };
  place_text: string | null;
  due_at: string | null;
  work_from: string | null;
  work_to: string | null;
  created_at: string;
  updated_at: string;
  internal_owner: RfqPerson;
  kpis: RfqKpis;
  /** RFQQUESTIONS */
  questions?: RfqQuestionCounts;
}

export interface RfqListPage { items: RfqSummary[]; next_cursor: string | null }
export interface RfqListQuery { state?: RfqFilter; department_id?: string; q?: string; limit?: number; cursor?: string | null }

export interface RfqContact { id: string; name: string; company: string; kind?: string | null; lang?: string | null; erased?: boolean }

export interface RfqQuoteSummary {
  id: string;
  version: number;
  state: RfqQuoteState;
  created_at: string;
  /** the rest only with tickets.costs.view */
  total_minor?: number;
  subtotal_minor?: number;
  currency?: string;
  work_from?: string | null;
  work_to?: string | null;
  revision?: number;
  /** RFQQUESTIONS (costs.view only): the vendor wrote a note on this quote (the text is the comparison's) */
  has_note?: boolean;
}

export interface RfqVendor {
  id: string;
  contact: RfqContact;
  channel: RfqChannel;
  state: RfqVendorState;
  invited_at: string;
  sent_at: string | null;
  first_opened_at: string | null;
  open_count: number;
  quoted_at: string | null;
  declined_at: string | null;
  /** RFQ managers only */
  decline_reason: string | null;
  link: { state: RfqLinkState; expires_at?: string | null; sent_via?: string | null } | null;
  delivery?: { state: string; channel?: string } | null;
  quote: RfqQuoteSummary | null;
  messages: number;
  /** RFQQUESTIONS */
  questions?: RfqQuestionCounts;
  revision: number;
  /** contract 15.2 / 15.6: whether the vendor page asks this vendor for a verification code (the directory's demand cannot be lowered) */
  require_code?: boolean;
  /** contract 15.6 (managers only): the channel chosen for this vendor's messages */
  channel_choice?: 'auto' | RfqChannel;
  can: { remove: boolean; remind: boolean; quote_on_behalf: boolean; decline_on_behalf: boolean; message: boolean };
}

export interface RfqAward {
  id: string;
  vendor_id: string;
  quote_id: string;
  state: RfqAwardState;
  line_indexes: number[];
  finalize: boolean;
  first_by: string;
  first_at: string;
  second_required: boolean;
  second_by: string | null;
  second_at: string | null;
  revision: number;
  currency: string;
  subtotal_minor: number | null;
  vat_minor: number | null;
  total_minor: number | null;
  threshold_minor?: number | null;
  decline_reason?: string | null;
  /** TKRFQ4 (contract 18.4): the service request the order opened (`id` null when the viewer may not open it) */
  ticket?: RfqOrderTicket | null;
  /** TKRFQ4: the work order of this award - null until the manager opens it */
  order?: RfqOrder | null;
  /** TKRFQ4: what was agreed - the whole quote, the lines of some kinds, or chosen lines */
  scope?: RfqScope | null;
  /** TKRFQ4: the order form's dates (the quote's work window, else the request's) - while no order exists, for a viewer who may order */
  order_defaults?: { work_from: string | null; work_to: string | null } | null;
  can?: { order: boolean; send_order: boolean };
}

export interface RfqOrderTicket { id: string | null; number: number; status?: string | null }
export interface RfqScope { kind: 'all' | 'kinds' | 'lines'; kinds: LineKind[]; lines: number }

/** TKRFQ4 (contract 18): the work order of one award - no table of its own (the award + the quote's request + two timeline rows). */
export interface RfqOrder {
  ticket: RfqOrderTicket;
  work_from: string | null;
  work_to: string | null;
  created_at: string | null;
  created_by: string | null;
  /** null until the manager's explicit send */
  sent: { at: string; channel: string | null; by: string | null } | null;
}

/** `POST tickets/rfqs/{id}/awards/{award_id}/order` - opens the vendor's service request; sends nothing. */
export interface RfqOrderBody { work_from?: string; work_to?: string; documents?: string; request_key: string }
export interface RfqOrderAnswer { rfq: RfqDetail; award: RfqAward | null; ticket?: { id: string; number: number }; replayed?: boolean;
  notified?: { queued: boolean; channel: string | null; outbox_id?: string | null; already?: boolean } }
/** `GET .../order/preview`: the exact text of the order message (the link as a placeholder), its channel and the refusals. */
export interface RfqOrderPreview { award_id: string; text: string; lang: string; channel: string; refusals: string[]; sent: boolean; sent_at: string | null }

export interface RfqEvent {
  id: number | string;
  kind: string;
  at: string;
  vendor_id: string | null;
  actor: { kind: string; name: string };
  data: Record<string, unknown>;
}

export interface RfqFile { id: string; name: string; kind: 'photo' | 'pdf'; bytes: number }

/** `GET tickets/rfqs/{id}` (rfq.detail). */
export interface RfqDetail {
  id: string;
  number: number;
  ref: string;
  state: RfqState;
  title: string;
  description: string;
  department: { id: string; name: string };
  place: { site_id: string | null; building_id: string | null; floor_id: string | null; text: string | null };
  source_ticket: { id: string; number: number } | null;
  due_at: string | null;
  work_from: string | null;
  work_to: string | null;
  allowed_line_kinds: LineKind[];
  internal_owner: RfqPerson;
  created_by: { id: string; name: string };
  created_at: string;
  updated_at: string;
  sent_at: string | null;
  awarded_at: string | null;
  closed_at: string | null;
  cancelled_at: string | null;
  cancel_reason: string | null;
  revision: number;
  kpis: RfqKpis;
  vendors: RfqVendor[];
  awards: RfqAward[];
  second_approval: { threshold_minor: number | null; enabled: boolean };
  timeline: RfqEvent[];
  vendor_page: boolean;
  /** C2 gap: the request's files */
  files?: RfqFile[];
  /** RFQQUESTIONS: the counts and every pending question (oldest first) */
  questions?: RfqQuestionCounts & { items: RfqQuestion[] };
  can: { answer?: boolean; edit: boolean; add_vendor: boolean; send: boolean; remind: boolean; cancel: boolean; close: boolean; award: boolean; see_amounts: boolean; delete: boolean;
    /** TKRFQ4: an award waits for its work order / an order waits for its message (absent from older servers) */
    order?: boolean; send_order?: boolean };
}

export interface RfqLine extends StoredLine { index: number }

/** One quote column of `GET tickets/rfqs/{id}/comparison`. */
export interface RfqCompareQuote {
  vendor_id: string;
  vendor: RfqContact;
  quote_id: string;
  version: number;
  state: RfqQuoteState;
  source: string;
  submitted_at: string;
  late: boolean;
  currency: string;
  vat_mode: VatMode;
  vat_rate_bp: number;
  lines: RfqLine[];
  by_kind: Record<LineKind, number>;
  subtotal_minor: number;
  vat_minor: number;
  total_minor: number;
  net_minor: number;
  work_from: string | null;
  work_to: string | null;
  in_window: boolean | null;
  note: string | null;
  vendor_ref: string | null;
  messages: number;
  /** RFQQUESTIONS */
  questions?: RfqQuestionCounts;
  lowest: boolean;
  earliest: boolean;
  award: { id: string; state: RfqAwardState; line_indexes: number[] } | null;
  revision: number;
  /** C2 gap: the date the vendor's price holds until */
  valid_until?: string | null;
  can: { award: boolean };
}

export interface RfqComparison {
  rfq_id: string;
  ref: string;
  state: RfqState;
  currency: string;
  quotes: RfqCompareQuote[];
  lowest_quote_id: string | null;
  earliest_quote_id: string | null;
  filters: { all: number; in_window: number };
}

export interface RfqMetaDepartment { id: string; name: string; can_create: boolean; second_approval_minor: number | null; second_approval_enabled: boolean }

/** `GET tickets/rfqs/meta`. */
export interface RfqMeta {
  vendor_page: boolean;
  settings: { default_due_days: number; grace_hours?: number; link_keep_days?: number; retention_months?: number; reminder_hours?: number };
  departments: RfqMetaDepartment[];
  line_kinds: LineKind[];
  currencies: string[];
  /** C2 gap: files on a request (absent = the attachments field is hidden) */
  attachments?: boolean;
  /** C2 gap: a channel and a code choice per invited vendor (absent = the directory's values, read-only) */
  vendor_options?: boolean;
}

export interface RfqVendorRef { contact_id: string; channel?: RfqChannel; require_code?: boolean }

export interface RfqCreateBody {
  department_id: string;
  title: string;
  description?: string;
  place_text?: string;
  source_ticket_id?: string;
  due_at?: string;
  work_from?: string;
  work_to?: string;
  allowed_line_kinds?: LineKind[];
  vendors: RfqVendorRef[];
  client_request_id: string;
  /** C2 gap: ids of files uploaded for the request */
  file_ids?: string[];
}

export interface RfqEditBody {
  revision: number;
  title?: string;
  description?: string;
  place_text?: string;
  due_at?: string;
  work_from?: string;
  work_to?: string;
  allowed_line_kinds?: LineKind[];
}

export interface RfqQuoteBody {
  lines: LineInput[];
  currency?: string;
  amounts_include_vat?: boolean;
  work_from?: string;
  work_to?: string;
  note?: string;
  vendor_ref?: string;
}

/** contract 15.6: `POST tickets/rfqs/{id}/vendors/{rv_id}/options` - `require_code` until the vendor is awarded / removed, `channel` for a draft vendor only. */
export interface RfqVendorOptionsBody { revision: number; require_code?: boolean; channel?: 'auto' | RfqChannel }

export interface RfqAwardBody { quote_id: string; revision: number; line_indexes?: number[]; kinds?: LineKind[]; finalize: boolean }

/** The editable notice of an award (rfq.award_draft) - never sent by the system. */
export interface RfqMessageDraft {
  text: string;
  lang: string;
  notify_default: boolean;
  send: { route: string; source: { kind: 'award'; id: string } };
}

export interface RfqAwardAnswer { rfq: RfqDetail; award: RfqAward; message_draft: RfqMessageDraft | null }

export interface RfqMessage { id: string; direction: 'in' | 'out'; text: string; at: string; by: string; source: { kind: string; id: string | null } | null; notified: boolean;
  /** TKRFQ5: a vendor's WhatsApp reply matched to the thread - an unverified sender (the vendor page never shows it). */
  via?: 'whatsapp' | null; unverified?: boolean;
  /** RFQQUESTIONS: an inbound message is a question with a state */
  question?: { state: 'pending' | 'answered'; read: boolean; answered_at: string | null; answer_id: string | null; quote_id: string | null };
  /** RFQQUESTIONS: an outbound message that answers a question / one copy of an answer to every vendor */
  answers_id?: string | null; to_all?: boolean }
export interface RfqMessageAnswer { item: RfqMessage; notified: { queued: boolean; channel: string | null } }

export interface RfqSendAnswer extends RfqDetail { sent?: Record<string, unknown> }

/** RFQQUESTIONS: an answer to one question - to the asking vendor only (the default) or to every invited vendor. */
export interface RfqAnswerBody { text: string; scope: 'vendor' | 'all'; question_text?: string; name_asker?: boolean; notify: boolean }
/** The exact text each recipient would get (no side effect) - the "לשלוח הודעה לספק?" step. */
export interface RfqAnswerPreview {
  question_id: string;
  scope: 'vendor' | 'all';
  name_asker: boolean;
  recipients: { vendor_id: string; vendor: { name: string; company: string }; asker: boolean; text: string; lang: string; notify_channel: string | null }[];
}
export interface RfqAnswerAnswer {
  rfq: RfqDetail;
  answer: { question_id: string; scope: 'vendor' | 'all'; items: { vendor_id: string; message_id: string; notified: boolean }[]; notified: number; broadcast_id: string | null };
  replayed: boolean;
}
export interface RfqQuestionsSummary { pending: number; unread: number; requests: number }

export interface RfqBackend {
  meta(): Promise<RfqMeta>;
  list(q?: RfqListQuery): Promise<RfqListPage>;
  get(id: string): Promise<RfqDetail>;
  create(body: RfqCreateBody): Promise<RfqDetail>;
  edit(id: string, body: RfqEditBody): Promise<RfqDetail>;
  remove(id: string): Promise<void>;
  addVendor(id: string, contactId: string, revision: number): Promise<RfqDetail>;
  removeVendor(id: string, vendorId: string, revision: number): Promise<RfqDetail>;
  /** TKRFQVP (contract 15.6): the per-vendor options; lowering a code the directory demands is 409 `vendor_code_locked` */
  vendorOptions(id: string, vendorId: string, body: RfqVendorOptionsBody): Promise<RfqDetail>;
  revokeLink(id: string, vendorId: string): Promise<RfqDetail>;
  send(id: string, revision: number, channel: 'auto' | 'manual', clientRequestId: string): Promise<RfqSendAnswer>;
  remind(id: string, vendorIds?: string[]): Promise<RfqDetail>;
  quoteOnBehalf(id: string, vendorId: string, body: RfqQuoteBody): Promise<RfqDetail>;
  withdrawQuote(id: string, vendorId: string, quoteId: string, revision: number): Promise<RfqDetail>;
  declineOnBehalf(id: string, vendorId: string, reason?: string): Promise<RfqDetail>;
  comparison(id: string): Promise<RfqComparison>;
  award(id: string, body: RfqAwardBody): Promise<RfqAwardAnswer>;
  confirmAward(id: string, awardId: string, revision: number): Promise<RfqAwardAnswer>;
  declineAward(id: string, awardId: string, revision: number, reason: string): Promise<RfqDetail>;
  cancel(id: string, revision: number, reason: string | undefined, notify: boolean): Promise<RfqDetail>;
  close(id: string, revision: number): Promise<RfqDetail>;
  messages(id: string, vendorId: string): Promise<{ items: RfqMessage[] }>;
  writeMessage(id: string, vendorId: string, text: string, notify: boolean, source?: { kind: 'award'; id: string }): Promise<RfqMessageAnswer>;
  setThreshold(departmentId: string, minor: number | null): Promise<{ department_id: string; second_approval_minor: number | null }>;
  /** TKRFQ4 (contract 18.2): open the awarded vendor's service request (idempotent by request_key; nothing is sent) */
  createOrder(id: string, awardId: string, body: RfqOrderBody): Promise<RfqOrderAnswer>;
  /** TKRFQ4: the exact order message before the explicit send */
  orderPreview(id: string, awardId: string): Promise<RfqOrderPreview>;
  /** TKRFQ4: the manager's explicit send of the order message (a repeat answers the first send) */
  sendOrder(id: string, awardId: string): Promise<RfqOrderAnswer>;
  /** C2 gap: upload one file for a request that is being created (returns its id) */
  uploadFile?(file: File): Promise<RfqFile>;
  /** RFQQUESTIONS: the navigation badge (the open requests the caller manages) */
  questionsSummary(): Promise<RfqQuestionsSummary>;
  /** RFQQUESTIONS: an RFQ manager opened the vendor's thread (his questions are no longer new) */
  markRead(id: string, vendorId: string): Promise<{ read: number }>;
  answerPreview(id: string, questionId: string, body: RfqAnswerBody): Promise<RfqAnswerPreview>;
  /** the explicit send (idempotent by client_request_id) */
  answer(id: string, questionId: string, body: RfqAnswerBody, clientRequestId: string): Promise<RfqAnswerAnswer>;
  /** handled without a reply (answered by phone) - nothing is sent */
  resolveQuestion(id: string, questionId: string): Promise<RfqDetail>;
}

const R = 'tickets/rfqs';
const enc = encodeURIComponent;

function qs(q: RfqListQuery): string {
  const p = new URLSearchParams();
  if (q.state) p.set('state', q.state);
  if (q.department_id) p.set('department_id', q.department_id);
  if (q.q?.trim()) p.set('q', q.q.trim());
  if (q.limit) p.set('limit', String(q.limit));
  if (q.cursor) p.set('cursor', q.cursor);
  const s = p.toString();
  return s ? `?${s}` : '';
}

/**
 * The body the REAL create route accepts (extra="forbid"): only the contract's fields - a per-vendor channel / code choice or files are
 * sent only when the server's meta says it takes them (C2 gaps), never silently dropped by the server with a 422.
 */
export function createWireBody(body: RfqCreateBody, meta: Pick<RfqMeta, 'vendor_options' | 'attachments'> | null): Record<string, unknown> {
  const out: Record<string, unknown> = { ...body };
  out.vendors = body.vendors.map((v) => (meta?.vendor_options ? { ...v } : { contact_id: v.contact_id }));
  if (!meta?.attachments || !body.file_ids?.length) delete out.file_ids;
  for (const k of Object.keys(out)) if (out[k] === undefined || out[k] === '') delete out[k];
  return out;
}

let restMeta: RfqMeta | null = null;

const rest: RfqBackend = {
  meta: async () => (restMeta = await get<RfqMeta>(`${R}/meta`)),
  list: (q = {}) => get<RfqListPage>(`${R}${qs(q)}`),
  get: (id) => get<RfqDetail>(`${R}/${enc(id)}`),
  create: (body) => post<RfqDetail>(R, createWireBody(body, restMeta)),
  edit: (id, body) => patch<RfqDetail>(`${R}/${enc(id)}`, body),
  remove: (id) => del(`${R}/${enc(id)}`),
  addVendor: (id, contactId, revision) => post<RfqDetail>(`${R}/${enc(id)}/vendors`, { contact_id: contactId, revision }),
  removeVendor: (id, vendorId, revision) => post<RfqDetail>(`${R}/${enc(id)}/vendors/${enc(vendorId)}/remove`, { revision }),
  vendorOptions: (id, vendorId, body) => post<RfqDetail>(`${R}/${enc(id)}/vendors/${enc(vendorId)}/options`, body),
  revokeLink: (id, vendorId) => post<RfqDetail>(`${R}/${enc(id)}/vendors/${enc(vendorId)}/link/revoke`),
  send: (id, revision, channel, clientRequestId) => post<RfqSendAnswer>(`${R}/${enc(id)}/send`, { revision, channel, client_request_id: clientRequestId }),
  remind: (id, vendorIds) => post<RfqDetail>(`${R}/${enc(id)}/remind`, vendorIds?.length ? { vendor_ids: vendorIds } : {}),
  quoteOnBehalf: (id, vendorId, body) => post<RfqDetail>(`${R}/${enc(id)}/vendors/${enc(vendorId)}/quotes`, body),
  withdrawQuote: (id, vendorId, quoteId, revision) => post<RfqDetail>(`${R}/${enc(id)}/vendors/${enc(vendorId)}/quotes/${enc(quoteId)}/withdraw`, { revision }),
  declineOnBehalf: (id, vendorId, reason) => post<RfqDetail>(`${R}/${enc(id)}/vendors/${enc(vendorId)}/decline`, reason ? { reason } : {}),
  comparison: (id) => get<RfqComparison>(`${R}/${enc(id)}/comparison`),
  award: (id, body) => post<RfqAwardAnswer>(`${R}/${enc(id)}/awards`, body),
  confirmAward: (id, awardId, revision) => post<RfqAwardAnswer>(`${R}/${enc(id)}/awards/${enc(awardId)}/confirm`, { revision }),
  declineAward: (id, awardId, revision, reason) => post<RfqDetail>(`${R}/${enc(id)}/awards/${enc(awardId)}/decline`, { revision, reason }),
  cancel: (id, revision, reason, notify) => post<RfqDetail>(`${R}/${enc(id)}/cancel`, { revision, notify, ...(reason ? { reason } : {}) }),
  close: (id, revision) => post<RfqDetail>(`${R}/${enc(id)}/close`, { revision }),
  messages: (id, vendorId) => get<{ items: RfqMessage[] }>(`${R}/${enc(id)}/vendors/${enc(vendorId)}/messages`),
  writeMessage: (id, vendorId, text, notify, source) => post<RfqMessageAnswer>(`${R}/${enc(id)}/vendors/${enc(vendorId)}/messages`, { text, notify, ...(source ? { source } : {}) }),
  setThreshold: (departmentId, minor) => put(`${R}/departments/${enc(departmentId)}`, { second_approval_minor: minor }),
  createOrder: (id, awardId, body) => post<RfqOrderAnswer>(`${R}/${enc(id)}/awards/${enc(awardId)}/order`, body),
  orderPreview: (id, awardId) => get<RfqOrderPreview>(`${R}/${enc(id)}/awards/${enc(awardId)}/order/preview`),
  sendOrder: (id, awardId) => post<RfqOrderAnswer>(`${R}/${enc(id)}/awards/${enc(awardId)}/order/send`),
  questionsSummary: () => get<RfqQuestionsSummary>(`${R}/questions/summary`),
  markRead: (id, vendorId) => post<{ read: number }>(`${R}/${enc(id)}/vendors/${enc(vendorId)}/messages/read`),
  answerPreview: (id, qid, body) => post<RfqAnswerPreview>(`${R}/${enc(id)}/questions/${enc(qid)}/preview`, answerWire(body)),
  answer: (id, qid, body, crid) => post<RfqAnswerAnswer>(`${R}/${enc(id)}/questions/${enc(qid)}/answer`, { ...answerWire(body), client_request_id: crid }),
  resolveQuestion: (id, qid) => post<RfqDetail>(`${R}/${enc(id)}/questions/${enc(qid)}/resolve`),
};

/** The answer body the server accepts (extra = forbid): the question as the others read it only for an answer to every vendor. */
export function answerWire(body: RfqAnswerBody): Record<string, unknown> {
  const out: Record<string, unknown> = { text: body.text, scope: body.scope, notify: body.notify };
  if (body.scope === 'all') {
    if (body.question_text !== undefined) out.question_text = body.question_text;
    out.name_asker = !!body.name_asker;
  }
  return out;
}

/** The backend in force: REST with a server, the demo store without one. */
export function ticketsRfqApi(): RfqBackend {
  return isApi() ? rest : mockRfq;
}

/**
 * Whether an error means "this server has no RFQ routes yet" (before TKRFQ1 is merged the path `tickets/rfqs` falls through to the
 * item route and answers 404 / 405 / 422): the screen shows "not available" instead of an error. Read on the meta call only.
 */
export function rfqUnavailable(e: unknown): boolean {
  if (!(e instanceof ApiError)) return false;
  if (e.status === 405 || e.status === 422) return true;
  return e.status === 404 && !/^(rfq_|vendor_|quote_|award_|feature_disabled)/.test(e.code);
}
