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
import { ApiError, api, del, get, patch, post, put, resourceUrl, upload } from './client';
import { isApi } from './session';
import type { LineInput, LineKind, StoredLine, VatMode } from './tickets-costs';
import { mockRfq } from './tickets-rfq-mock';
import type { RequestLocation } from './tickets-locations';

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

/** RFQQUESTIONS (contract section 21): unanswered vendor questions - `unread` = no RFQ manager opened them yet. Zero once the request is no
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
  /** RFQPAY2 (20.15): `resend_order` - the date-change editor may offer "send the updated work order" */
  can?: { order: boolean; send_order: boolean; resend_order?: boolean };
  /** CR-RFQ-PAYMENT-SCHEDULE (contract 20.7): the approved schedule and the vendor's arrival confirmation (null while the switch is off) */
  terms?: RfqAwardTerms | null;
  /** CR-AWARD-NOTICE (contract 20.16): the "approved and binding" notice to the vendor (absent on older servers) */
  notice?: RfqAwardNotice | null;
  /** CR-AWARD-NOTICE (contract 20.17): the vendor's postponement notices given through his link (null = none) */
  postponement?: RfqPostponementBlock | null;
}

/** CR-RFQ-PAYMENT-SCHEDULE: one instalment (amounts null without tickets.costs.view; the final one is the remainder). */
export interface RfqInstalment { index: number; kind: 'advance' | 'progress' | 'final'; amount_minor: number | null; percent_bp: number | null;
  due: 'date' | 'completion' | 'after_completion'; date: string | null; days: number | null;
  /** RFQPAY2 (20.13): the day agreed at the award when a manager moved it since (null = never moved) */
  agreed_date?: string | null; date_changed_at?: string | null;
  /** RFQPAY2: the resolved due day (null while it depends on a completion that did not happen) and whether it passed unpaid */
  due_date?: string | null; overdue?: boolean;
  /** RFQPAY2 (20.11): the instalment's payment demand (the amount null without tickets.costs.view) */
  demand?: RfqInstalmentDemand | null }
/** RFQPAY2: one payment demand per approved instalment - made by a manager from the schedule row; paid = recorded, never executed. */
export interface RfqInstalmentDemand { id: string; status: 'open' | 'paid' | 'cancelled'; amount_minor: number | null; currency: string;
  due_date: string | null; created_at: string; paid_at: string | null; cancelled_at: string | null; revision: number }
export type RfqDemandAction = 'create' | 'paid' | 'cancel';
export interface RfqDemandAnswer { rfq: RfqDetail; demand: RfqInstalmentDemand | null; created: boolean }
/** CR-RFQ-PAYMENT-SCHEDULE: the vendor's proposal as he sent it (percent text or a fixed amount in minor units). */
export interface RfqPaymentProposal { items: { kind: 'advance' | 'progress' | 'final'; due: string; date: string | null; days: number | null; percent: string | null;
  amount_minor: number | null }[] }
export interface RfqAwardTerms {
  schedule: { currency: string; total_minor: number | null; rounding: string; items: RfqInstalment[]; source: 'vendor' | 'manager' | 'default' };
  proposal: RfqPaymentProposal | null;
  arrival: { state: 'awaiting' | 'proposed' | 'confirmed'; planned_from: string | null; planned_to: string | null; proposed_from: string | null;
    proposed_to: string | null; rejected_at: string | null; confirmed_at: string | null; confirmed_by: 'vendor' | 'manager' | null;
    acknowledged_at: string | null; requested_at: string | null; reminders: number;
    /** not confirmed after the last reminder: the RFQ managers were notified (the work order is not blocked) */
    escalated_at?: string | null;
    /** RFQPAY2 (20.14): a manager moved the window after the award */
    changed_at?: string | null };
  revision: number;
  /** review F7: after a rejected date, the editable notice for the vendor (managers only; sent only by the manager's explicit click) */
  draft?: RfqMessageDraft | null;
  /** RFQPAY2 (20.13 / 20.14): the preview texts of the optional vendor notice of a moved date (the vendor's language; default off) */
  notice?: RfqChangeNotice | null;
  can: { decide_arrival: boolean; reschedule?: boolean; demand?: boolean; reschedule_arrival?: boolean; notify_vendor?: boolean };
}
export interface RfqChangeNotice { lang: string; instalment: string; arrival: string; notify_default: boolean }
/** RFQPAY2: the optional vendor notice sent with a moved date (the thread + the templated notice; never free text outside). */
export interface RfqMoveNotice { notify: boolean; message?: string; reason?: string; resendOrder?: boolean }

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

/** RFQATT (contract 19): what a file on a request is - by its CONTENT (a picture is always a re-encoded JPEG). */
export type RfqFileKind = 'image' | 'pdf' | 'docx' | 'xlsx';

/** RFQATT: one file of a request (`detail.attachments[]`). `thumb` = a 480 px picture exists; `removed` (managers only) = removed after
 * a quote arrived - kept for the record, no vendor sees it. */
export interface RfqFile {
  id: string;
  name: string;
  caption: string;
  kind: RfqFileKind;
  mime?: string;
  bytes: number;
  width?: number | null;
  height?: number | null;
  thumb: boolean;
  visible_vendors: boolean;
  created_at?: string;
  removed?: boolean;
  removed_at?: string;
}

/** RFQATT: `meta.attachment_limits` - the form checks these before a byte leaves the browser; the server enforces them anyway. */
export interface RfqAttachmentLimits { files: number; image_bytes: number; document_bytes: number; total_bytes: number; caption: number; types: string[]; office?: boolean }

/** RFQATT: the per-file options sent with an upload or a change. */
export interface RfqFileOptions { caption?: string; visible_vendors?: boolean }

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
  /** CR-ORG-LOCATIONS: the organisation location named at creation (its snapshot) and the navigation-link switch of its messages */
  location?: RequestLocation | null;
  location_nav?: boolean;
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
  /** RFQATT (contract 19.3): the request's files (managers also see the removed ones, marked) */
  attachments?: RfqFile[];
  /** RFQQUESTIONS: the counts and every pending question (oldest first) */
  questions?: RfqQuestionCounts & { items: RfqQuestion[] };
  can: { answer?: boolean; edit: boolean; add_vendor: boolean; send: boolean; remind: boolean; cancel: boolean; close: boolean; award: boolean; see_amounts: boolean; delete: boolean;
    /** TKRFQ4: an award waits for its work order / an order waits for its message (absent from older servers) */
    order?: boolean; send_order?: boolean;
    /** RFQATT: an RFQ manager while the request is a draft or open */
    attach?: boolean };
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
  /** CR-RFQ-PAYMENT-SCHEDULE: the vendor's proposed instalments (null = none) */
  payment_proposal?: RfqPaymentProposal | null;
  /** RFQ-VENDOR-UPLOAD (contract 19.10): the files THIS vendor attached to his quote (removed ones marked); absent on older servers */
  vendor_files?: RfqVendorFile[];
  can: { award: boolean };
}

/** RFQ-VENDOR-UPLOAD: one file a vendor uploaded - read through `vendorFileUrl` (always a download; costs.view, like the comparison). */
export interface RfqVendorFile {
  id: string;
  name: string;
  kind: RfqFileKind;
  mime: string;
  bytes: number;
  width: number | null;
  height: number | null;
  thumb: boolean;
  quote_id: string | null;
  /** the question it was attached to (null for a quote file) */
  message_id?: string | null;
  quote_version: number | null;
  created_at: string;
  removed: boolean;
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
  /** RFQATT: files on a request (absent / false = the attachments field is hidden) */
  attachments?: boolean;
  attachment_limits?: RfqAttachmentLimits;
  /** C2 gap: a channel and a code choice per invited vendor (absent = the directory's values, read-only) */
  vendor_options?: boolean;
  /** CR-RFQ-PAYMENT-SCHEDULE: the installation offers the payment schedule + arrival confirmation (the award dialog's fields) */
  schedule_arrival?: boolean;
  /** RFQ-VENDOR-UPLOAD: vendors may attach files to their quotes (installation switch, OFF by default) */
  vendor_uploads?: boolean;
  /** CR-AWARD-NOTICE: the award notice setting (absent on older servers = no notice block) */
  award_notice?: RfqAwardNoticeMode;
}

/** CR-AWARD-NOTICE: the setting `rfq.award_notice` - confirm (default) | auto | off. */
export type RfqAwardNoticeMode = 'confirm' | 'auto' | 'off';
/** `awards[].notice` (contract 20.16). */
export interface RfqAwardNotice {
  mode: RfqAwardNoticeMode;
  /** queued = the notice went to the outbox; not_sent = tried, the vendor could not be reached (`reason`); pending = a second approval waits */
  state: 'queued' | 'not_sent' | 'pending' | 'none';
  at: string | null; by: string | null; channel: string | null; reason: string | null;
  /** a pending award: the first approver's tick (the second approver's default) */
  requested: boolean | null;
  can: { send: boolean };
}
/** `GET tickets/rfqs/{id}/vendors/{rv}/award-notice` - the exact text before the award (no side effect). */
export interface RfqAwardNoticePreview {
  mode: RfqAwardNoticeMode; text: string; lang: string; channel: string;
  /** why it cannot go now: vendor | page | link | channel */
  refusals: string[]; notify_default: boolean; sent: boolean;
}
export interface RfqAwardNoticeResult { queued: boolean; already: boolean; channel: string | null; outbox_id: string | null; reason: string | null }
/** One postponement notice of the awarded vendor (contract 20.17) - the lead time is stored as given, no judgement. */
export interface RfqPostponement {
  id: string; proposed_from: string; proposed_to: string | null; reason: string; scheduled_from: string | null; lead_seconds: number | null;
  /** owner decision 2026-10-17: given after the scheduled start or less than `rfq.postpone_late_hours` before it - a tag, never a block */
  late: boolean;
  at: string; state: 'open' | 'acknowledged' | 'rescheduled' | 'ended'; resolved_at: string | null; resolved_by: string | null;
}
export interface RfqPostponementBlock { open: RfqPostponement | null; items: RfqPostponement[]; count: number; can: { acknowledge: boolean } }

export interface RfqVendorRef { contact_id: string; channel?: RfqChannel; require_code?: boolean }

export interface RfqCreateBody {
  department_id: string;
  title: string;
  description?: string;
  place_text?: string;
  /** CR-ORG-LOCATIONS: an active organisation location (reference + snapshot); `place_text` stays the "other (free text)" */
  location_id?: string;
  location_nav?: boolean;
  source_ticket_id?: string;
  due_at?: string;
  work_from?: string;
  work_to?: string;
  allowed_line_kinds?: LineKind[];
  vendors: RfqVendorRef[];
  client_request_id: string;
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

export interface RfqAwardBody { quote_id: string; revision: number; line_indexes?: number[]; kinds?: LineKind[]; finalize: boolean;
  /** CR-RFQ-PAYMENT-SCHEDULE (20.3): the manager's plan, or the explicit choice (`vendor` = the proposal as is, `default` = one final
   * instalment) - one of the two is REQUIRED when the vendor proposed a schedule (review F1) - and the planned arrival */
  payment?: { items: Record<string, unknown>[] }; payment_source?: 'vendor' | 'default'; arrival?: { work_from: string; work_to?: string };
  /** CR-AWARD-NOTICE (20.16): the dialog's "send the approval notice" tick (sent only when the server's meta has `award_notice`) */
  award_notice?: boolean }

/** The editable notice of an award (rfq.award_draft) - never sent by the system. */
export interface RfqMessageDraft {
  text: string;
  lang: string;
  notify_default: boolean;
  send: { route: string; source: { kind: 'award'; id: string } };
}

export interface RfqAwardAnswer { rfq: RfqDetail; award: RfqAward; message_draft: RfqMessageDraft | null; award_notice?: RfqAwardNoticeResult | null }

export interface RfqMessage { id: string; direction: 'in' | 'out'; text: string; at: string; by: string; source: { kind: string; id: string | null } | null; notified: boolean;
  /** TKRFQ5: a vendor's WhatsApp reply matched to the thread - an unverified sender (the vendor page never shows it). */
  via?: 'whatsapp' | null; unverified?: boolean;
  /** RFQQUESTIONS: an inbound message is a question with a state */
  question?: { state: 'pending' | 'answered'; read: boolean; answered_at: string | null; answer_id: string | null; quote_id: string | null };
  /** RFQQUESTIONS: an outbound message that answers a question / one copy of an answer to every vendor */
  answers_id?: string | null; to_all?: boolean;
  /** RFQ-VENDOR-UPLOAD (contract 19.10): the files the vendor attached to this question (inbound only; absent on older servers) */
  files?: RfqVendorFile[] }
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
  /** `locationNav` (CR-ORG-LOCATIONS): the preview dialog's "add the navigation link" switch for this request's messages (default off) */
  send(id: string, revision: number, channel: 'auto' | 'manual', clientRequestId: string, locationNav?: boolean): Promise<RfqSendAnswer>;
  remind(id: string, vendorIds?: string[]): Promise<RfqDetail>;
  quoteOnBehalf(id: string, vendorId: string, body: RfqQuoteBody): Promise<RfqDetail>;
  withdrawQuote(id: string, vendorId: string, quoteId: string, revision: number): Promise<RfqDetail>;
  declineOnBehalf(id: string, vendorId: string, reason?: string): Promise<RfqDetail>;
  comparison(id: string): Promise<RfqComparison>;
  award(id: string, body: RfqAwardBody): Promise<RfqAwardAnswer>;
  confirmAward(id: string, awardId: string, revision: number, awardNotice?: boolean): Promise<RfqAwardAnswer>;
  declineAward(id: string, awardId: string, revision: number, reason: string): Promise<RfqDetail>;
  cancel(id: string, revision: number, reason: string | undefined, notify: boolean): Promise<RfqDetail>;
  close(id: string, revision: number): Promise<RfqDetail>;
  messages(id: string, vendorId: string): Promise<{ items: RfqMessage[] }>;
  writeMessage(id: string, vendorId: string, text: string, notify: boolean, source?: { kind: 'award'; id: string }): Promise<RfqMessageAnswer>;
  setThreshold(departmentId: string, minor: number | null): Promise<{ department_id: string; second_approval_minor: number | null }>;
  /** TKRFQ4 (contract 18.2): open the awarded vendor's service request (idempotent by request_key; nothing is sent) */
  createOrder(id: string, awardId: string, body: RfqOrderBody): Promise<RfqOrderAnswer>;
  /** TKRFQ4: the exact order message before the explicit send */
  /** RFQPAY2 (20.15): `window` renders the text with dates about to be saved (no side effect) */
  orderPreview(id: string, awardId: string, window?: { work_from: string; work_to?: string | null }): Promise<RfqOrderPreview>;
  /** TKRFQ4: the manager's explicit send of the order message (a repeat answers the first send) */
  sendOrder(id: string, awardId: string): Promise<RfqOrderAnswer>;
  /** RFQATT (contract 19.3): one file onto a draft / open request (multipart); answers the detail + the new row */
  uploadAttachment(id: string, file: File, options?: RfqFileOptions): Promise<RfqDetail & { attachment: RfqFile | null }>;
  /** RFQATT: the caption / "visible to vendors" of one file */
  editAttachment(id: string, attachmentId: string, options: RfqFileOptions): Promise<RfqDetail>;
  /** RFQATT: remove one file (only marked once a quote arrived) */
  removeAttachment(id: string, attachmentId: string): Promise<RfqDetail>;
  /** RFQATT: where the file (or its thumbnail) is read - same-origin, the session's own authorisation */
  attachmentUrl(id: string, attachmentId: string, thumb?: boolean): string;
  /** RFQ-VENDOR-UPLOAD: where a vendor's own file (or its thumbnail) is read - same-origin, always a download (the demo store has none) */
  vendorFileUrl?(id: string, fileId: string, thumb?: boolean): string;
  /** CR-RFQ-PAYMENT-SCHEDULE (20.6): accept / reject the arrival date the vendor proposed (the demo store has no terms) */
  decideArrival?(id: string, awardId: string, action: 'accept' | 'reject', revision: number): Promise<RfqDetail>;
  /** RFQPAY2 (20.13): move a dated instalment's planned day (tickets.costs + view; reason optional; nothing is sent) */
  moveInstalment?(id: string, awardId: string, index: number, date: string, revision: number, opts?: RfqMoveNotice): Promise<RfqDetail>;
  /** RFQPAY2 (20.14): move the planned arrival window after the award (tickets.costs + view; optional vendor notice) */
  moveArrival?(id: string, awardId: string, workFrom: string, workTo: string | null, revision: number, opts?: RfqMoveNotice): Promise<RfqDetail>;
  /** RFQPAY2 (20.11): the instalment's payment demand - create (idempotent) / mark paid / cancel */
  instalmentDemand?(id: string, awardId: string, index: number, action: RfqDemandAction): Promise<RfqDemandAnswer>;
  /** CR-AWARD-NOTICE (20.16): the exact award notice for one vendor, its channel and why it cannot go now (no side effect) */
  awardNoticePreview?(id: string, vendorId: string): Promise<RfqAwardNoticePreview>;
  /** CR-AWARD-NOTICE: send the notice of a final award that did not go with it (once per award) */
  sendAwardNotice?(id: string, awardId: string): Promise<{ rfq: RfqDetail; award_notice: RfqAwardNoticeResult }>;
  /** CR-AWARD-NOTICE (20.17): an RFQ manager acknowledges the vendor's open postponement notice (the date does not move) */
  ackPostponement?(id: string, awardId: string, postponementId: string): Promise<RfqDetail>;
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
 * sent only when the server's meta says it takes them, never silently dropped by the server with a 422. Files are uploaded one by one
 * onto the created draft (RFQATT: `uploadAttachment`), never part of this body.
 */
export function createWireBody(body: RfqCreateBody, meta: Pick<RfqMeta, 'vendor_options' | 'attachments'> | null): Record<string, unknown> {
  const out: Record<string, unknown> = { ...body };
  out.vendors = body.vendors.map((v) => (meta?.vendor_options ? { ...v } : { contact_id: v.contact_id }));
  for (const k of Object.keys(out)) if (out[k] === undefined || out[k] === '') delete out[k];
  return out;
}

/** RFQPAY2: the optional fields of a date move - the reason, and the vendor notice only when ticked (never a text without the tick). */
export function moveExtras(opts?: RfqMoveNotice): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  if (opts?.reason?.trim()) out.reason = opts.reason.trim();
  if (opts?.resendOrder) out.resend_order = true; // RFQPAY2 20.15: re-send the already-sent work order (default off)
  if (opts?.notify) {
    out.notify_vendor = true;
    out.message = (opts.message ?? '').trim();
  }
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
  send: (id, revision, channel, clientRequestId, locationNav) => post<RfqSendAnswer>(`${R}/${enc(id)}/send`,
    { revision, channel, client_request_id: clientRequestId, ...(locationNav === undefined ? {} : { location_nav: locationNav }) }),
  remind: (id, vendorIds) => post<RfqDetail>(`${R}/${enc(id)}/remind`, vendorIds?.length ? { vendor_ids: vendorIds } : {}),
  quoteOnBehalf: (id, vendorId, body) => post<RfqDetail>(`${R}/${enc(id)}/vendors/${enc(vendorId)}/quotes`, body),
  withdrawQuote: (id, vendorId, quoteId, revision) => post<RfqDetail>(`${R}/${enc(id)}/vendors/${enc(vendorId)}/quotes/${enc(quoteId)}/withdraw`, { revision }),
  declineOnBehalf: (id, vendorId, reason) => post<RfqDetail>(`${R}/${enc(id)}/vendors/${enc(vendorId)}/decline`, reason ? { reason } : {}),
  comparison: (id) => get<RfqComparison>(`${R}/${enc(id)}/comparison`),
  award: (id, body) => post<RfqAwardAnswer>(`${R}/${enc(id)}/awards`, body),
  confirmAward: (id, awardId, revision, awardNotice) => post<RfqAwardAnswer>(`${R}/${enc(id)}/awards/${enc(awardId)}/confirm`,
    { revision, ...(awardNotice === undefined ? {} : { award_notice: awardNotice }) }),
  declineAward: (id, awardId, revision, reason) => post<RfqDetail>(`${R}/${enc(id)}/awards/${enc(awardId)}/decline`, { revision, reason }),
  cancel: (id, revision, reason, notify) => post<RfqDetail>(`${R}/${enc(id)}/cancel`, { revision, notify, ...(reason ? { reason } : {}) }),
  close: (id, revision) => post<RfqDetail>(`${R}/${enc(id)}/close`, { revision }),
  messages: (id, vendorId) => get<{ items: RfqMessage[] }>(`${R}/${enc(id)}/vendors/${enc(vendorId)}/messages`),
  writeMessage: (id, vendorId, text, notify, source) => post<RfqMessageAnswer>(`${R}/${enc(id)}/vendors/${enc(vendorId)}/messages`, { text, notify, ...(source ? { source } : {}) }),
  setThreshold: (departmentId, minor) => put(`${R}/departments/${enc(departmentId)}`, { second_approval_minor: minor }),
  createOrder: (id, awardId, body) => post<RfqOrderAnswer>(`${R}/${enc(id)}/awards/${enc(awardId)}/order`, body),
  orderPreview: (id, awardId, window) => get<RfqOrderPreview>(`${R}/${enc(id)}/awards/${enc(awardId)}/order/preview${window?.work_from
    ? `?${new URLSearchParams({ work_from: window.work_from, ...(window.work_to ? { work_to: window.work_to } : {}) }).toString()}` : ''}`),
  sendOrder: (id, awardId) => post<RfqOrderAnswer>(`${R}/${enc(id)}/awards/${enc(awardId)}/order/send`),
  uploadAttachment: (id, file, options = {}) => {
    const form = new FormData();
    form.append('file', file, file.name);
    if (options.caption) form.append('caption', options.caption);
    if (options.visible_vendors !== undefined) form.append('visible_vendors', String(options.visible_vendors));
    return upload<RfqDetail & { attachment: RfqFile | null }>(`${R}/${enc(id)}/attachments`, form);
  },
  editAttachment: (id, attachmentId, options) => patch<RfqDetail>(`${R}/${enc(id)}/attachments/${enc(attachmentId)}`, options),
  removeAttachment: (id, attachmentId) => api<RfqDetail>(`${R}/${enc(id)}/attachments/${enc(attachmentId)}`, { method: 'DELETE' }),
  attachmentUrl: (id, attachmentId, thumb = false) => resourceUrl(`api/v1/${R}/${enc(id)}/attachments/${enc(attachmentId)}${thumb ? '/thumb' : ''}`),
  vendorFileUrl: (id, fileId, thumb = false) => resourceUrl(`api/v1/${R}/${enc(id)}/vendor-files/${enc(fileId)}${thumb ? '/thumb' : ''}`),
  decideArrival: (id, awardId, action, revision) => post<RfqDetail>(`${R}/${enc(id)}/awards/${enc(awardId)}/arrival`, { action, revision }),
  moveInstalment: (id, awardId, index, date, revision, opts) => post<RfqDetail>(`${R}/${enc(id)}/awards/${enc(awardId)}/instalments/${index}/date`,
    { date, revision, ...moveExtras(opts) }),
  moveArrival: (id, awardId, workFrom, workTo, revision, opts) => post<RfqDetail>(`${R}/${enc(id)}/awards/${enc(awardId)}/arrival/date`,
    { work_from: workFrom, ...(workTo ? { work_to: workTo } : {}), revision, ...moveExtras(opts) }),
  instalmentDemand: (id, awardId, index, action) => post<RfqDemandAnswer>(`${R}/${enc(id)}/awards/${enc(awardId)}/instalments/${index}/demand`, { action }),
  awardNoticePreview: (id, vendorId) => get<RfqAwardNoticePreview>(`${R}/${enc(id)}/vendors/${enc(vendorId)}/award-notice`),
  sendAwardNotice: (id, awardId) => post<{ rfq: RfqDetail; award_notice: RfqAwardNoticeResult }>(`${R}/${enc(id)}/awards/${enc(awardId)}/notice`),
  ackPostponement: (id, awardId, postponementId) => post<RfqDetail>(`${R}/${enc(id)}/awards/${enc(awardId)}/postponement/ack`, { postponement_id: postponementId }),
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
