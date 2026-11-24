/**
 * Minimal API client. All URLs are relative to the page (`api/v1/...`) so the same build works under
 * the HA Ingress prefix and on the dev server. Errors follow the server's error model.
 */
import { closedErrorText } from './closed-errors';
import { tr } from '../i18n/msg/api-core';

export interface ApiErrorBody {
  code: string;
  user_message: string;
  retryable: boolean;
  correlation_id: string;
  details: Record<string, unknown>;
}

export class ApiError extends Error {
  constructor(public status: number, public body: ApiErrorBody) {
    super(body.user_message || body.code);
  }
  get code() {
    return this.body.code;
  }
}

/** Base for API calls: `<page dir>/api/v1/`. Under Ingress the page dir is `/api/hassio_ingress/<token>/`. */
function apiBase(): URL {
  return new URL('api/v1/', document.baseURI);
}

export function apiUrl(path: string): string {
  return new URL(path.replace(/^\/+/, ''), apiBase()).toString();
}

/** A value `path` / `query` put into an address. */
type PathValue = string | number | boolean;

/**
 * CR-API-PATHS-2439 (review 07:F15): an API path whose every interpolated value is ONE encoded segment.
 *
 *     get(path`cases/${id}/items/${itemId}`)          // cases/0f3a.../items/9b1c...
 *
 * `new URL()` normalises `..` and a slash splits a segment, so a raw `${id}` holding `../x` or `a/b` would address another route; here
 * it stays inside its segment (`..%2Fx`, `a%2Fb`). A server-issued id (hex, `[A-Za-z0-9_.-]`) comes out byte-identical. Only the
 * interpolated values are encoded - the literal parts are the route, written as they are. Never interpolate a sub-path or a query
 * string into it (build the query with `query()` and append it).
 */
export function path(strings: TemplateStringsArray, ...values: PathValue[]): string {
  let out = strings[0];
  for (let i = 0; i < values.length; i++) out += encodeURIComponent(String(values[i])) + strings[i + 1];
  return out;
}

/**
 * CR-API-PATHS-2439 (review 07:F15): `?a=1&b=x` from an object, in its key order, every key and value encoded (the same bytes as
 * `encodeURIComponent`, not `URLSearchParams`, which writes a space as `+`). `undefined`, `null` and `''` are left out; `false` and `0`
 * are values (`check=false`, `offset=0`). Nothing to send = `''`.
 *
 *     del(path`floors/${id}` + query({ force: force || undefined }))   // floors/x  or  floors/x?force=true
 */
export function query(params: Record<string, PathValue | null | undefined>): string {
  const parts: string[] = [];
  for (const [k, v] of Object.entries(params)) {
    if (v === undefined || v === null || v === '') continue;
    parts.push(`${encodeURIComponent(k)}=${encodeURIComponent(String(v))}`);
  }
  return parts.length ? `?${parts.join('&')}` : '';
}

/** Turn a server-relative resource path (e.g. `api/v1/plan-versions/x/image.png`) into an absolute URL. */
export function resourceUrl(path: string): string {
  return new URL(path.replace(/^\/+/, ''), document.baseURI).toString();
}

/** CR-008 remote channel: on a 401 the Arx sign-in refreshes its HA token and re-exchanges the session cookie; true =
 * retry the request once. Unset under Ingress (a 401 there is final). */
let onUnauthorized: (() => Promise<boolean>) | null = null;
export function setUnauthorizedHandler(fn: (() => Promise<boolean>) | null): void {
  onUnauthorized = fn;
}

/** MFA-STEPUP-TRAIN-2490: what the server's central step-up gate says with its 403 `step_up_required` (services/step_up.py). Only an
 * answer that names `verify_path` comes from that gate; the bridge-key reveal's own 403 of the same code asks for its code itself. */
export interface StepUpDetails {
  action?: string;
  methods?: string[];
  minutes?: number;
  verify_path?: string;
  /** MFA-PASSKEYS-2490: where a passkey challenge is asked (`auth/step-up/challenge`); the dialog offers the passkey when `methods`
   * lists it. */
  challenge_path?: string;
}

/** MFA-TRAIN-2500: a request that confirms its own step-up in place (My Account's passkey changes, components/sw-passkeys.ts, which
 * offers the passkey and the code next to the change) sets this header; the client takes it off before the request leaves and leaves
 * that answer's 403 `step_up_required` to the screen - never the shell dialog too (one prompt per change, the retry-once rule of the
 * screen). The header never reaches the server. */
export const STEP_UP_INLINE = 'X-Sw-Step-Up-Inline';

/** MFA-STEPUP-TRAIN-2490: on a 403 `step_up_required` from the central gate the shell asks for the authenticator code
 * (shell/step-up.ts); true = a fresh proof was recorded, retry the request ONCE. Never a second prompt for the retried request. */
let onStepUp: ((details: StepUpDetails) => Promise<boolean>) | null = null;
export function setStepUpHandler(fn: ((details: StepUpDetails) => Promise<boolean>) | null): void {
  onStepUp = fn;
}

/** The gate's details when this answer is the central step-up refusal, else null. Reads a clone: the answer stays readable. */
async function stepUpRefusal(res: Response): Promise<StepUpDetails | null> {
  if (res.status !== 403) return null;
  try {
    const b = JSON.parse(await res.clone().text()) as { code?: unknown; details?: unknown };
    if (b?.code !== 'step_up_required' || !b.details || typeof b.details !== 'object') return null;
    const d = b.details as StepUpDetails;
    return typeof d.verify_path === 'string' ? d : null;
  } catch {
    return null;
  }
}

/** One HTTP answer, read to its text (a 204 carries none). */
interface RawReply {
  status: number;
  ok: boolean;
  statusText: string;
  text: string;
}

/** CR-API-BLOB-2436: the one place a request leaves - same-origin credentials, the JSON content type for a non-form body, and the
 * remote channel's 401 refresh-and-retry (once). `path` is API-relative (`tickets/x`) or an absolute address built by `apiUrl`. */
async function fetchApi(path: string, init: RequestInit): Promise<Response> {
  const headers = new Headers(init.headers);
  if (init.body && !(init.body instanceof FormData) && !headers.has('Content-Type')) headers.set('Content-Type', 'application/json');
  const inline = headers.has(STEP_UP_INLINE); // MFA-TRAIN-2500: the screen confirms this one itself
  headers.delete(STEP_UP_INLINE);
  let res = await fetch(apiUrl(path), { ...init, headers, credentials: 'same-origin' });
  if (res.status === 401 && onUnauthorized && (await onUnauthorized())) res = await fetch(apiUrl(path), { ...init, headers, credentials: 'same-origin' });
  if (res.status === 403 && onStepUp && !inline) {
    const details = await stepUpRefusal(res);
    // the user confirmed (a current code or a passkey): the same request once more (never queued, never retried again - a second refusal is final)
    if (details && (await onStepUp(details))) res = await fetch(apiUrl(path), { ...init, headers, credentials: 'same-origin' });
  }
  return res;
}

async function send(path: string, init: RequestInit): Promise<RawReply> {
  const res = await fetchApi(path, init);
  return { status: res.status, ok: res.ok, statusText: res.statusText, text: res.status === 204 ? '' : await res.text() };
}

/** CR-API-BLOB-2436 (07:F16): the error body of a failed answer, normalised field by field. A body that carries a string `code` is
 * the server's error model (missing fields filled, extra keys kept); anything else - FastAPI's 422 `{detail}`, a proxy's HTML page,
 * an empty body - is the fallback `http_<status>` with the status text. */
function errorBody(status: number, statusText: string, text: string): ApiErrorBody {
  let data: unknown = null;
  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    data = null;
  }
  if (data && typeof data === 'object' && !Array.isArray(data) && typeof (data as { code?: unknown }).code === 'string') {
    const b = data as Partial<ApiErrorBody> & Record<string, unknown>;
    return {
      ...b,
      code: b.code as string,
      user_message: typeof b.user_message === 'string' ? b.user_message : '',
      retryable: typeof b.retryable === 'boolean' ? b.retryable : false,
      correlation_id: typeof b.correlation_id === 'string' ? b.correlation_id : '',
      details: b.details && typeof b.details === 'object' ? b.details : {},
    };
  }
  return { code: `http_${status}`, user_message: statusText, retryable: false, correlation_id: '', details: {} };
}

/** CR-API-BLOB-2436 (07:F5): the raw answer of a request through the client (credentials, 401 retry); never throws on a status.
 * For the few reads that branch on the status themselves (202 "still being grabbed", 404 "no recording"). */
export function apiResponse(path: string, init: RequestInit = {}): Promise<Response> {
  return fetchApi(path, init);
}

interface BlobReply {
  blob: Blob;
  headers: Headers;
}

/** CR-API-BLOB-2436 (07:F5): a binary read (CSV, PDF, ZIP, picture) with the same credentials, 401 retry and error model as `api()`.
 * A failure is thrown as an ApiError built from the server's own error body. */
export async function apiBlob(path: string, init: RequestInit = {}): Promise<BlobReply> {
  const res = await fetchApi(path, init);
  if (!res.ok) throw new ApiError(res.status, errorBody(res.status, res.statusText, await res.text()));
  return { blob: await res.blob(), headers: res.headers };
}

/** PERF-HOME-DEVICES-2342: plain GETs of the same address that are in flight at the same time share ONE request (the home screen's
 * first render asked for /settings, /me and the devices tree from several components at once). Only while the request is open -
 * nothing is cached past its answer, so a later call always asks the server again - and every caller parses its own copy of the
 * body (no caller sees another's mutations). A GET with headers, a signal or any other option is never shared. */
const inflightGets = new Map<string, Promise<RawReply>>();

function shareable(init: RequestInit): boolean {
  return Object.keys(init).length === 0;
}

export function inflightGetCount(): number {
  return inflightGets.size;
}

export async function api<T>(path: string, init: RequestInit = {}): Promise<T> {
  let res: RawReply;
  if (shareable(init)) {
    const key = apiUrl(path);
    let pending = inflightGets.get(key);
    if (!pending) {
      pending = send(path, init).finally(() => inflightGets.delete(key));
      inflightGets.set(key, pending);
    }
    res = await pending;
  } else {
    res = await send(path, init);
  }
  if (res.status === 204) return undefined as T;
  if (!res.ok) throw new ApiError(res.status, errorBody(res.status, res.statusText, res.text));
  const text = res.text;
  let data: unknown = null;
  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    data = null;
  }
  return data as T;
}

/** CR-API-BLOB-2436 (07:F16): an optional abort signal for the helpers. A GET with a signal is never shared with another caller. */
interface CallOptions {
  signal?: AbortSignal;
}
const withSignal = (init: RequestInit, opts?: CallOptions): RequestInit => (opts?.signal ? { ...init, signal: opts.signal } : init);

export const get = <T>(path: string, opts?: CallOptions) => api<T>(path, withSignal({}, opts));
export const post = <T>(path: string, body?: unknown, opts?: CallOptions) =>
  api<T>(path, withSignal({ method: 'POST', body: body === undefined ? undefined : JSON.stringify(body) }, opts));
export const patch = <T>(path: string, body: unknown, opts?: CallOptions) => api<T>(path, withSignal({ method: 'PATCH', body: JSON.stringify(body) }, opts));
export const put = <T>(path: string, body: unknown, opts?: CallOptions) => api<T>(path, withSignal({ method: 'PUT', body: JSON.stringify(body) }, opts));
export const del = (path: string, opts?: CallOptions) => api<void>(path, withSignal({ method: 'DELETE' }, opts));
export const upload = <T>(path: string, form: FormData) => api<T>(path, { method: 'POST', body: form });

export function describeError(err: unknown): string {
  if (err instanceof ApiError) return closedErrorText(err.body.code) ?? (err.body.user_message || err.body.code || tr('השרת דחה את הבקשה ({status})', { status: err.status }));
  if (err instanceof TypeError) return tr('אין חיבור לשרת.');
  return err instanceof Error ? err.message : String(err);
}
