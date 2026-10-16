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
}

export type Result<T> = { ok: true; data: T } | { ok: false; error: ApiFailure };

export interface Credentials {
  token: string | null;
  session: string | null;
}

function failure(status: number, body: unknown, offline = false): ApiFailure {
  const b = (body && typeof body === 'object' ? body : {}) as Record<string, unknown>;
  return {
    status,
    code: typeof b.code === 'string' ? b.code : offline ? 'offline' : status === 404 ? 'link_unavailable' : 'error',
    retryAfter: typeof b.retry_after_s === 'number' ? b.retry_after_s : 0,
    attemptsLeft: typeof b.attempts_left === 'number' ? b.attempts_left : null,
    offline,
  };
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

export interface TimelineItem {
  id: number;
  at: string;
  kind: string;
  mine: boolean;
  name: string;
  from: string | null;
  to: string | null;
  body: string | null;
  photo_id?: string;
  eta_at?: string | null;
  return_kind?: string | null;
}

export interface TicketView {
  number: number;
  department: string;
  organization: string;
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
  history?: { at: string; from: string | null; to: string | null; actor: string }[] | null;
  limits?: { note_max: number; reason_max: number; photo_max_bytes: number; photos_left: number };
}

export const api = {
  ticket: (c: Credentials) => call<TicketView>(c, 'GET', '/t/api/ticket'),
  status: (c: Credentials, status: string, note: string | null, crid: string) =>
    call<{ ok: boolean; status: string }>(c, 'POST', '/t/api/status', note ? { status, note, client_request_id: crid } : { status, client_request_id: crid }),
  note: (c: Credentials, text: string, crid: string) => call<{ ok: boolean }>(c, 'POST', '/t/api/note', { text, client_request_id: crid }),
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
  photoBlob: async (c: Credentials, id: string): Promise<Blob | null> => {
    try {
      const res = await fetch(withBase(`/t/api/photo/${encodeURIComponent(id)}`), {
        headers: { 'X-Ticket-Token': c.token ?? '', ...(c.session ? { 'X-Ticket-Session': c.session } : {}) },
        credentials: 'omit', cache: 'no-store', redirect: 'error', referrerPolicy: 'no-referrer',
      });
      return res.ok ? await res.blob() : null;
    } catch {
      return null;
    }
  },
  codeSend: (c: Credentials) => call<{ sent: boolean; channel: string; expires_in_s: number }>(c, 'POST', '/t/api/code/send', {}),
  codeVerify: (c: Credentials, code: string) => call<{ session: string; expires_in_s: number }>(c, 'POST', '/t/api/code/verify', { code }),
  redeem: (rid: string) => call<{ token: string }>({ token: null, session: null }, 'POST', '/t/api/redeem', { rid }),
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
