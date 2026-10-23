/**
 * CR-038 slice 4 (spec 10.2 / 10.3): the handler page's calls. The token travels ONLY in the `X-Ticket-Token` header (it came in
 * the URL fragment, which no request line, Referer or proxy log ever sees); the code session in `X-Ticket-Session`. No cookie is
 * ever sent or accepted (`credentials: 'omit'`), nothing is cached, a redirect is an error. Every answer is JSON shaped
 * `{code, ...}` when it is not a success; the page maps the codes to its own words (strings.ts).
 */

import { withBase } from './base';

export interface ApiFailure {
  status: number;
  code: string;
  retryAfter: number;
  attemptsLeft: number | null;
  /** the request never reached the server (no reception): the page keeps the draft and retries with the same request id */
  offline: boolean;
  /** TKRFQVP: a 422's field problems (`{field, code}`), when the answer names them */
  fields?: { field: string; code: string }[];
  /** TKRFQVP: 409 quote_changed - the current live version of the vendor's quote */
  version?: number | null;
}

export type Result<T> = { ok: true; data: T } | { ok: false; error: ApiFailure };

export interface Credentials {
  token: string | null;
  session: string | null;
}

function failure(status: number, body: unknown, offline = false): ApiFailure {
  const b = (body && typeof body === 'object' ? body : {}) as Record<string, unknown>;
  const out: ApiFailure = {
    status,
    code: typeof b.code === 'string' ? b.code : offline ? 'offline' : status === 404 ? 'link_unavailable' : 'error',
    retryAfter: typeof b.retry_after_s === 'number' ? b.retry_after_s : 0,
    attemptsLeft: typeof b.attempts_left === 'number' ? b.attempts_left : null,
    offline,
  };
  // the RFQ refusals carry extras at the top level or under `details` (the contract does not pin the place): read both
  const d = (b.details && typeof b.details === 'object' ? b.details : {}) as Record<string, unknown>;
  const fields = Array.isArray(b.fields) ? b.fields : Array.isArray(d.fields) ? d.fields : null;
  if (fields) out.fields = fields.filter((f): f is { field: string; code: string } => !!f && typeof f === 'object' && typeof f.field === 'string' && typeof f.code === 'string');
  const version = 'version' in b ? b.version : d.version;
  if (typeof version === 'number' || version === null) out.version = version;
  return out;
}

async function call<T>(creds: Credentials, method: 'GET' | 'POST', path: string, body?: unknown, form?: FormData): Promise<Result<T>> {
  const headers: Record<string, string> = { Accept: 'application/json' };
  if (creds.token) headers['X-Ticket-Token'] = creds.token;
  if (creds.session) headers['X-Ticket-Session'] = creds.session;
  let payload: BodyInit | undefined;
  if (form) payload = form;
  else if (body !== undefined) {
    headers['Content-Type'] = 'application/json';
    payload = JSON.stringify(body);
  }
  let res: Response;
  try {
    res = await fetch(withBase(path), { method, headers, body: payload, credentials: 'omit', cache: 'no-store', redirect: 'error', referrerPolicy: 'no-referrer' });
  } catch {
    return { ok: false, error: failure(0, null, true) };
  }
  let data: unknown = null;
  try {
    data = await res.json();
  } catch {
    data = null;
  }
  if (!res.ok) return { ok: false, error: failure(res.status, data) };
  return { ok: true, data: data as T };
}

/** A picture of the link as a blob (shown through a blob: URL): the link's credentials, never a cookie, never cached; `type` - the
 * answer's content type must start with it. Null on any failure. */
async function blobOf(path: string, c: Credentials, type?: string): Promise<Blob | null> {
  try {
    const res = await fetch(withBase(path), {
      headers: { 'X-Ticket-Token': c.token ?? '', ...(c.session ? { 'X-Ticket-Session': c.session } : {}) },
      credentials: 'omit', cache: 'no-store', redirect: 'error', referrerPolicy: 'no-referrer',
    });
    return res.ok && (!type || (res.headers.get('content-type') ?? '').startsWith(type)) ? await res.blob() : null;
  } catch {
    return null;
  }
}

export interface TimelineItem {
  id: number;
  at: string;
  kind: string;
  mine: boolean;
  name: string;
  /** CR-038 18A: the handler's own note was a question for the manager */
  question?: boolean;
  from: string | null;
  to: string | null;
  body: string | null;
  photo_id?: string;
  eta_at?: string | null;
  return_kind?: string | null;
}

/** RFQATT (contract 19.4): one file of a request as a vendor sees it (no author, no flags, no hash, no path). */
export interface RfqFileRef { id: string; name: string; caption?: string; kind: 'image' | 'pdf' | 'docx' | 'xlsx'; bytes: number; width?: number | null; height?: number | null; thumb?: boolean }

export interface TicketView {
  number: number;
  department: string;
  organization: string;
  /** VPORTAL: the organisation's logo file (`<stamp>.jpg`), or null - brand.ts */
  logo?: string | null;
  lang: string;
  dir: 'rtl' | 'ltr';
  labels: { one: string; many: string; gender: string };
  time_zone: string;
  code_required: boolean;
  code_ok: boolean;
  read_only: boolean;
  /** TK259: the installation's choice for the page's look (public.theme) */
  theme?: 'light' | 'dark' | 'auto';
  /** the end of the read-only grace after close (D5), when read_only */
  read_only_until?: string | null;
  expires_at: string;
  code_locked_s?: number;
  title?: string;
  description?: string;
  priority?: { key: string; name: string } | null;
  place_text?: string;
  /** CR-ORG-LOCATIONS: the organisation location this request names (name · address · details), '' without one */
  location_text?: string;
  device_name?: string;
  status?: string;
  eta_at?: string | null;
  assigned_by?: string;
  assigned_at?: string | null;
  created_at?: string;
  actions?: { statuses: string[]; note: boolean; eta: boolean; photo: boolean; return: boolean };
  /** slice 9 (11A.2 / 11A.5): the vendor's cost claim of this assignment, and the claim mode of a link whose page no longer serves */
  claim?: { status: string; required: boolean; writable: boolean; claim_until: string | null } | null;
  claim_mode?: boolean;
  /** TKUI3: the link's kind, sent after the code gate only (handler_actions.view); absent on the code screen and on an older server */
  kind?: 'vendor' | 'staff';
  timeline?: TimelineItem[];
  photos?: { id: string; at: string; width: number; height: number; mine: boolean }[];
  /** RFQATT (contract 19.6): the request-for-quotation files a work order referenced (absent when none) */
  rfq_files?: RfqFileRef[];
  history?: { at: string; from: string | null; to: string | null; actor: string }[] | null;
  limits?: { note_max: number; reason_max: number; photo_max_bytes: number; photos_left: number };
  /** TKMAP1: the request's map element - the stored text and whether the server can draw its picture (never an id or plan data) */
  map_element?: { name: string; floor: string; room: string; image: boolean } | null;
  /** GRANTS3-295: the arrival step ("who arrives, when") is available - the page fetches its lazy chunk only then */
  arrival?: boolean;
  /** VENDORARRIVAL126-295: the one-tap "I have arrived" card (present only while the installation switch is on, on a vendor link, work open) */
  vendor_arrival?: { state: 'open' | 'expected' | 'late' | 'arrived'; window_from?: string; window_to?: string; arrived_at?: string; offer_access?: boolean };
}

export const api = {
  ticket: (c: Credentials) => call<TicketView>(c, 'GET', '/t/api/ticket'),
  status: (c: Credentials, status: string, note: string | null, crid: string) =>
    call<{ ok: boolean; status: string }>(c, 'POST', '/t/api/status', note ? { status, note, client_request_id: crid } : { status, client_request_id: crid }),
  note: (c: Credentials, text: string, crid: string, ask = false) => call<{ ok: boolean }>(c, 'POST', '/t/api/note', ask ? { text, ask: true, client_request_id: crid } : { text, client_request_id: crid }),
  eta: (c: Credentials, etaAt: string | null, crid: string) => call<{ ok: boolean }>(c, 'POST', '/t/api/eta', { eta_at: etaAt, client_request_id: crid }),
  giveBack: (c: Credentials, kind: 'not_mine' | 'cannot_handle', reason: string, crid: string) =>
    call<{ ok: boolean; status: string; kind: string; number: number }>(c, 'POST', '/t/api/return', { kind, reason, client_request_id: crid }),
  photo: (c: Credentials, file: Blob, crid: string) => {
    const form = new FormData();
    form.append('file', file, 'photo.jpg');
    form.append('client_request_id', crid);
    return call<{ id: string; width: number; height: number }>(c, 'POST', '/t/api/photo', undefined, form);
  },
  /** a photo of the ticket as a blob (shown through a blob: URL - the CSP allows `img-src 'self' blob:` only) */
  photoBlob: (c: Credentials, id: string): Promise<Blob | null> => blobOf(`/t/api/photo/${encodeURIComponent(id)}`, c),
  /** TKMAP1: the server-drawn 2D picture of the map element (image/svg+xml), shown through a blob: URL like the photos */
  mapBlob: (c: Credentials): Promise<Blob | null> => blobOf('/t/api/map-image', c, 'image/svg+xml'),
  codeSend: (c: Credentials) => call<{ sent: boolean; channel: string; expires_in_s: number }>(c, 'POST', '/t/api/code/send', {}),
  codeVerify: (c: Credentials, code: string) => call<{ session: string; expires_in_s: number }>(c, 'POST', '/t/api/code/verify', { code }),
  /** TKRFQVP (contract 15.1): an RFQ link's e-mail form answers `{token, kind: "rfq"}`; a ticket's stays `{token}` */
  redeem: (rid: string) => call<{ token: string; kind?: string }>({ token: null, session: null }, 'POST', '/t/api/redeem', { rid }),
};

// ---------------------------------------------------------------- TKRFQVP: the request-for-quotation mode (contract section 15)

export type RfqPageState = 'open' | 'due_passed' | 'declined' | 'awarded' | 'closed' | 'cancelled';
export type RfqKind = 'labor' | 'parts' | 'travel' | 'other';

export interface RfqQuoteLine {
  index: number;
  kind: RfqKind;
  description: string | null;
  total_minor: number;
  hours?: string;
  rate_minor?: number;
  quantity?: string;
  unit_minor?: number;
  amount_minor?: number;
}

export interface RfqQuote {
  id: string;
  version: number;
  state: 'submitted' | 'withdrawn' | 'awarded' | 'partially_awarded';
  lines: RfqQuoteLine[];
  currency: string;
  vat_mode: 'excluded' | 'included' | 'none';
  vat_rate_bp: number;
  subtotal_minor: number;
  vat_minor: number;
  total_minor: number;
  net_minor: number;
  work_from: string | null;
  work_to: string | null;
  in_window: boolean | null;
  valid_until: string | null;
  note: string | null;
  vendor_ref: string | null;
  submitted_at: string;
  approved: null | { line_indexes: number[]; subtotal_minor: number; vat_minor: number; total_minor: number };
  /** CR-RFQ-PAYMENT-SCHEDULE: his own proposed instalments (percent text or a fixed amount; the final one is the remainder) */
  payment?: null | { items: { kind: 'advance' | 'progress' | 'final'; due: string; date: string | null; days: number | null; percent: string | null; amount_minor: number | null }[] };
}

/** CR-RFQ-PAYMENT-SCHEDULE (contract 20.4): HIS approved schedule and arrival confirmation - only on his own approved award. */
export interface RfqTerms {
  schedule: { currency: string; total_minor: number; items: { kind: 'advance' | 'progress' | 'final'; amount_minor: number; due: 'date' | 'completion' | 'after_completion'; date: string | null; days: number | null;
    /** RFQPAY2 (20.13): a manager moved this date after the award */
    date_changed?: boolean }[] };
  arrival: { state: 'awaiting' | 'proposed' | 'confirmed'; planned_from: string | null; planned_to: string | null; proposed_from: string | null; proposed_to: string | null;
    rejected: boolean; confirmed_at: string | null; acknowledged_at: string | null;
    /** RFQPAY2 (20.14): a manager moved the window after the award */
    changed?: boolean };
  can: { confirm: boolean; propose: boolean };
}

/** CR-AWARD-NOTICE (contract 20.17): HIS award is binding - the scheduled window, his latest postponement notice, whether he may give one. */
export interface RfqBinding {
  /** the binding / advance-notice sentence in his language (server-owned, the same words as the WhatsApp award notice) */
  text: string;
  scheduled_from: string | null;
  scheduled_to: string | null;
  postponement: { proposed_from: string; proposed_to: string | null; at: string; state: 'open' | 'acknowledged' | 'rescheduled' | 'ended' } | null;
  can: { postpone: boolean };
}

/** `GET /t/api/rfq` (15.3). Before the code (a code-protected link without a session) only the first block is present. */
export interface RfqView {
  kind: 'rfq';
  ref: string;
  organization: string;
  logo?: string | null; // VPORTAL: brand.ts
  department: string;
  lang: string;
  dir: 'rtl' | 'ltr';
  theme?: 'light' | 'dark' | 'auto';
  time_zone: string;
  code_required: boolean;
  code_ok: boolean;
  code_locked_s?: number;
  read_only: boolean;
  read_only_until?: string | null;
  page_state?: RfqPageState;
  rfq?: { title: string; description: string | null; place_text: string | null; due_at: string | null; work_from: string | null; work_to: string | null;
    /** CR-ORG-LOCATIONS: this request's location; `map_url` only when the manager added the navigation link */
    location?: { text: string; map_url: string } | null;
    allowed_line_kinds: RfqKind[]; attachments: RfqFileRef[] };
  quote?: RfqQuote | null;
  declined?: { at: string; reason: string | null } | null;
  messages?: { id: string; mine: boolean; text: string; at: string; answered?: boolean; /** rfq-thread-system-author: an automatic message (a reminder) */ system?: boolean }[];
  form?: { currencies: string[]; allowed_kinds: RfqKind[]; vat: { exempt: boolean; rate_bp: number; default: 'excluded' | 'included' | 'none' }; labor_rate_minor: number | null;
    limits: { lines: number; description: number; note: number; vendor_ref: number; message: number; decline_reason: number; max_total_minor: number };
    payment?: null | { max_items: number; days_max: number; horizon_days: number } };
  can?: { quote: boolean; withdraw: boolean; decline: boolean; ask: boolean };
  terms?: RfqTerms | null;
  /** CR-AWARD-NOTICE: only on his own approved award (page_state `awarded`) */
  binding?: RfqBinding | null;
  /** RFQ-VENDOR-UPLOAD (contract 19.10): HIS files on his quote; null = the installation switch is off (the page shows nothing) */
  uploads?: RfqUploads | null;
}

/** RFQ-VENDOR-UPLOAD: `GET /t/api/rfq` `uploads` - his own files (text only: there is no public read of a vendor file) and the limits. */
export interface RfqUploads {
  /** `on`: bound to his quote or to one of his questions (`message_id`) */
  files: { id: string; name: string; kind: 'image' | 'pdf' | 'docx' | 'xlsx'; bytes: number; at: string; on?: 'quote' | 'question'; message_id?: string | null }[];
  /** the administrator's limits (rfq.vendor_uploads.max_*), already clamped by the server's hard caps */
  limits: { files: number; uploads: number; image_bytes: number; document_bytes: number; total_bytes: number; types: string[] };
  quote_id: string | null;
  used_bytes: number;
  uploads_left: number;
  /** upload = onto his submitted quote; question = a question with files (no quote needed); remove = one of his files */
  can: { upload: boolean; question?: boolean; remove: boolean };
}

export const rfqApi = {
  view: (c: Credentials) => call<RfqView>(c, 'GET', '/t/api/rfq'),
  quote: (c: Credentials, body: Record<string, unknown>) => call<{ ok: boolean; quote: RfqQuote }>(c, 'POST', '/t/api/rfq/quote', body),
  withdraw: (c: Credentials, quoteId: string, crid: string) => call<{ ok: boolean }>(c, 'POST', '/t/api/rfq/withdraw', { quote_id: quoteId, client_request_id: crid }),
  decline: (c: Credentials, reason: string, crid: string) =>
    call<{ ok: boolean }>(c, 'POST', '/t/api/rfq/decline', reason ? { reason, client_request_id: crid } : { client_request_id: crid }),
  message: (c: Credentials, text: string, crid: string) => call<{ ok: boolean; message: { id: string; mine: boolean; text: string; at: string } }>(c, 'POST', '/t/api/rfq/message', { text, client_request_id: crid }),
  codeSend: (c: Credentials) => call<{ sent: boolean; channel: string; expires_in_s: number }>(c, 'POST', '/t/api/rfq/code/send', {}),
  codeVerify: (c: Credentials, code: string) => call<{ session: string; expires_in_s: number }>(c, 'POST', '/t/api/rfq/code/verify', { code }),
  arrival: (c: Credentials, body: Record<string, unknown>) => call<{ ok: boolean; terms: RfqTerms }>(c, 'POST', '/t/api/rfq/arrival', body),
};

/** Slice 9: the claim step's own I/O (claim/claim-step.ts gets these injected) - the same headers and fetch options as `call`. */
export async function rawCall(c: Credentials, method: 'GET' | 'POST', path: string, body?: unknown, form?: FormData): Promise<{ status: number; body: unknown }> {
  const r = await call<unknown>(c, method, path, body, form);
  if (r.ok) return { status: 200, body: r.data };
  return { status: r.error.offline ? 0 : r.error.status, body: { code: r.error.code, retry_after_s: r.error.retryAfter } };
}

/** A client request id (spec 10.3: a UUID; the server lower-cases it). */
export function newRequestId(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') return crypto.randomUUID();
  const b = new Uint8Array(16);
  crypto.getRandomValues(b);
  b[6] = (b[6] & 0x0f) | 0x40;
  b[8] = (b[8] & 0x3f) | 0x80;
  const h = [...b].map((x) => x.toString(16).padStart(2, '0')).join('');
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-${h.slice(12, 16)}-${h.slice(16, 20)}-${h.slice(20)}`;
}
