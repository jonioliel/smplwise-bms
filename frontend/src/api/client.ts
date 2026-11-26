/**
 * Minimal API client. All URLs are relative to the page (`api/v1/...`) so the same build works under
 * the HA Ingress prefix and on the dev server. Errors follow the server's error model.
 */
import { closedErrorText } from './closed-errors';
import { tr } from '../i18n/msg/api-core';
import type { ErrorEnvelope, FieldProblem } from './generated/wire-errors';
import { noteDateHeader } from './server-clock';

/** ADR-019 Step 0: the server's five-key error envelope, typed from the backend model (smplwise/wire/errors.py, generated). */
export type ApiErrorBody = ErrorEnvelope;
export type { FieldProblem };
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

/**
 * CLIENT-RESILIENCE-2540 (review FC-05, FC-03): a request that got no usable answer - its deadline passed (a half-open connection after
 * a phone slept or changed network never fails by itself), or the remote channel's sign-in service could not be reached to renew the
 * session after a 401. A TypeError like the browser's own network failure, so every screen's "no connection" state and
 * `describeError` treat it the same way; `reason` tells the two apart for whoever needs it.
 */
export class ApiUnreachable extends TypeError {
  constructor(public reason: 'timeout' | 'signin_unreachable') {
    super(reason === 'timeout' ? 'the request got no answer in time' : 'the sign-in service could not be reached');
    this.name = 'ApiUnreachable';
  }
}

/** CLIENT-RESILIENCE-2540 (FC-05): the default deadline of a plain read (`GET` / `HEAD` through `api()`, the answer read to its end).
 * Writes, uploads, binary reads (`apiBlob`) and raw answers (`apiResponse`) keep no default deadline: a write that the server finishes
 * after the page gave up would be reported as failed, and a large export may take long. A call opts out (or sets its own) with
 * `timeoutMs` (0 = none). */
export const GET_DEADLINE_MS = 60_000;
let getDeadlineMs = GET_DEADLINE_MS;
/** Tests only: another default deadline for plain reads (0 = none). */
export function setGetDeadline(ms: number): void {
  getDeadlineMs = ms;
}

/** CR-008 remote channel: on a 401 the Arx sign-in refreshes its HA token and re-exchanges the session cookie; true = retry the
 * request once, false = the sign-in has ended (the 401 reaches the caller). Unset under Ingress (a 401 there is final).
 * CLIENT-RESILIENCE-2540 (FC-03): `'unreachable'` = the sign-in service did not answer (no connection, or "try again"); the sign-in is
 * kept and the request fails like an offline request (ApiUnreachable), never as "signed out". */
type UnauthorizedAnswer = boolean | 'unreachable';
let onUnauthorized: (() => Promise<UnauthorizedAnswer>) | null = null;
export function setUnauthorizedHandler(fn: (() => Promise<UnauthorizedAnswer>) | null): void {
  onUnauthorized = fn;
}

/** CLIENT-RESILIENCE-2540 (review SCR-23): the physical-safety actions of the server's step-up gate (services/step_up.py
 * PHYSICAL_ACTIONS). A refused one of these is re-sent after the confirmation only while the refusal is recent: a door that was asked
 * to open, then left alone, never opens when somebody types a code minutes later. The shell's dialog closes itself well before
 * (components/sw-step-up-dialog.ts STEP_UP_DIALOG_MS); this is the client's own backstop for any handler. */
export const PHYSICAL_STEP_UP_ACTIONS: readonly string[] = ['alarm.disarm', 'alarm.bypass', 'door.open'];
export const STEP_UP_REPLAY_MS = 120_000;

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
  /** MFA-STEPUP-GATES-2490 / MFA-SCREENS-2510: a once-action (a proof for exactly one call) - a recovery code is never offered for it. */
  once?: boolean;
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

/** CLIENT-RESILIENCE-2540 (FC-05): the deadline of ONE attempt of a request - an abort signal that fires after `ms` (and follows the
 * caller's own signal), and whether it was the deadline that fired. */
interface Deadline {
  signal: AbortSignal;
  fired(): boolean;
  clear(): void;
}

function deadline(ms: number, outer: AbortSignal | null | undefined): Deadline | null {
  if (!(ms > 0)) return null;
  const ctl = new AbortController();
  let fired = false;
  const timer = setTimeout(() => {
    fired = true;
    ctl.abort();
  }, ms);
  const follow = () => ctl.abort(outer?.reason);
  if (outer?.aborted) follow();
  else outer?.addEventListener('abort', follow, { once: true });
  return {
    signal: ctl.signal,
    fired: () => fired,
    clear: () => {
      clearTimeout(timer);
      outer?.removeEventListener('abort', follow);
    },
  };
}

/** CR-API-BLOB-2436: the one place a request leaves - same-origin credentials, the JSON content type for a non-form body, and the
 * remote channel's 401 refresh-and-retry (once). `path` is API-relative (`tickets/x`) or an absolute address built by `apiUrl`.
 * CLIENT-RESILIENCE-2540 (FC-05): `ms` > 0 gives every attempt its own deadline (the wait for a confirmation or a token refresh
 * between two attempts never counts); a deadline that passes rejects with ApiUnreachable('timeout'). Without `hold` the deadline
 * covers the answer's headers; with it, the caller receives the current attempt's deadline and ends it after reading the body. */
async function fetchApi(path: string, init: RequestInit, ms = 0, hold?: (d: Deadline | null) => void): Promise<Response> {
  const headers = new Headers(init.headers);
  if (init.body && !(init.body instanceof FormData) && !headers.has('Content-Type')) headers.set('Content-Type', 'application/json');
  const inline = headers.has(STEP_UP_INLINE); // MFA-TRAIN-2500: the screen confirms this one itself
  headers.delete(STEP_UP_INLINE);
  let last: Deadline | null = null;
  const attempt = async (): Promise<Response> => {
    const d = deadline(ms, init.signal);
    last = d;
    hold?.(d);
    const sentAt = Date.now();
    let r: Response;
    try {
      r = await fetch(apiUrl(path), { ...init, headers, credentials: 'same-origin', ...(d ? { signal: d.signal } : {}) });
      if (!hold) d?.clear();
    } catch (err) {
      d?.clear();
      if (d?.fired()) throw new ApiUnreachable('timeout');
      throw err;
    }
    // SCR-13: every answer's Date header keeps the server's time line (server-clock.ts) for the commands' expires_at
    try {
      noteDateHeader(r.headers.get('date'), sentAt, Date.now());
    } catch {
      /* a response without readable headers (a test double) teaches nothing */
    }
    return r;
  };
  // the wait for a token refresh or a confirmation is not the request's: its deadline stops there (the refusal's small body stays readable)
  const pause = () => (last as Deadline | null)?.clear();
  let res = await attempt();
  if (res.status === 401 && onUnauthorized) {
    pause();
    const again = await onUnauthorized();
    if (again === 'unreachable') throw new ApiUnreachable('signin_unreachable'); // FC-03: kept signed in, failed like an offline request
    if (again) res = await attempt();
  }
  if (res.status === 403 && onStepUp && !inline) {
    const details = await stepUpRefusal(res);
    if (details) pause();
    const refusedAt = Date.now();
    // the user confirmed (a current code or a passkey): the same request once more (never queued, never retried again - a second refusal is final)
    // SCR-23: a physical action (a door, the alarm) only while the refusal is recent - never replayed after the confirmation expired
    if (details && (await onStepUp(details)) && replayAllowed(details, Date.now() - refusedAt)) res = await attempt();
  }
  return res;
}

/** SCR-23: may the request refused for `details` be re-sent `waitedMs` after its refusal? */
function replayAllowed(details: StepUpDetails, waitedMs: number): boolean {
  return !PHYSICAL_STEP_UP_ACTIONS.includes(details.action ?? '') || waitedMs <= STEP_UP_REPLAY_MS;
}

async function send(path: string, init: RequestInit, ms = 0): Promise<RawReply> {
  if (!(ms > 0)) {
    const res = await fetchApi(path, init);
    return { status: res.status, ok: res.ok, statusText: res.statusText, text: res.status === 204 ? '' : await res.text() };
  }
  // FC-05: the deadline covers the body too - a connection that stalls half-way through the answer fails like one that never answered
  let held: Deadline | null = null;
  try {
    const res = await fetchApi(path, init, ms, (d) => {
      held?.clear();
      held = d;
    });
    return { status: res.status, ok: res.ok, statusText: res.statusText, text: res.status === 204 ? '' : await res.text() };
  } catch (err) {
    if (!(err instanceof ApiUnreachable) && (held as Deadline | null)?.fired()) throw new ApiUnreachable('timeout');
    throw err;
  } finally {
    (held as Deadline | null)?.clear();
  }
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

/** CLIENT-RESILIENCE-2540 (FC-05): the deadline of a request through `api()` - the call's own, else GET_DEADLINE_MS for a plain read
 * (GET / HEAD without a body) that brings no abort signal of its own (whoever passes a signal owns the request's lifetime), else none. */
function deadlineOf(init: RequestInit, timeoutMs: number | undefined): number {
  if (timeoutMs !== undefined) return timeoutMs;
  if (init.signal) return 0;
  const method = (init.method ?? 'GET').toUpperCase();
  return (method === 'GET' || method === 'HEAD') && !init.body ? getDeadlineMs : 0;
}

/** `timeoutMs`: CLIENT-RESILIENCE-2540 - this call's deadline (0 = none); a GET with its own deadline is never shared. A shared GET has
 * the default deadline, so a hung request settles (ApiUnreachable) and the next caller asks the server again - never one pending
 * promise for ever. */
export async function api<T>(path: string, init: RequestInit = {}, timeoutMs?: number): Promise<T> {
  let res: RawReply;
  const ms = deadlineOf(init, timeoutMs);
  if (shareable(init) && timeoutMs === undefined) {
    const key = apiUrl(path);
    let pending = inflightGets.get(key);
    if (!pending) {
      pending = send(path, init, ms).finally(() => inflightGets.delete(key));
      inflightGets.set(key, pending);
    }
    res = await pending;
  } else {
    res = await send(path, init, ms);
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
  /** CLIENT-RESILIENCE-2540 (FC-05): this read's own deadline in ms (0 = none; default GET_DEADLINE_MS). */
  timeoutMs?: number;
}
const withSignal = (init: RequestInit, opts?: CallOptions): RequestInit => (opts?.signal ? { ...init, signal: opts.signal } : init);

export const get = <T>(path: string, opts?: CallOptions) => api<T>(path, withSignal({}, opts), opts?.timeoutMs);
export const post = <T>(path: string, body?: unknown, opts?: CallOptions) =>
  api<T>(path, withSignal({ method: 'POST', body: body === undefined ? undefined : JSON.stringify(body) }, opts));
export const patch = <T>(path: string, body: unknown, opts?: CallOptions) => api<T>(path, withSignal({ method: 'PATCH', body: JSON.stringify(body) }, opts));
export const put = <T>(path: string, body: unknown, opts?: CallOptions) => api<T>(path, withSignal({ method: 'PUT', body: JSON.stringify(body) }, opts));
export const del = (path: string, opts?: CallOptions) => api<void>(path, withSignal({ method: 'DELETE' }, opts));
export const upload = <T>(path: string, form: FormData) => api<T>(path, { method: 'POST', body: form });

/** LOWS-FRONTEND-2550 (review FC-08): the browsers' own wording of a `fetch` that got no answer (Chrome / Edge "Failed to fetch",
 * Firefox "NetworkError when attempting to fetch resource.", Safari "Load failed", Node "fetch failed") - and the plain words tests
 * and older callers use for it. */
const FETCH_FAILURE = /fetch|network|load failed|offline/i;

/** FC-08: a request that got no answer - not every TypeError (`undefined.x` inside a screen's load is a TypeError too). */
export function isNoConnection(err: unknown): boolean {
  return err instanceof ApiUnreachable || (err instanceof TypeError && FETCH_FAILURE.test(err.message));
}

export function describeError(err: unknown): string {
  if (err instanceof ApiError) {
    // FC-08: an answer without the server's error model (a proxy's 502 page, an empty body) carries `http_<status>` and the HTTP status
    // text (empty over HTTP/2, English over HTTP/1.1) - the translated sentence with the status, never the raw code
    const bare = err.body.code.startsWith('http_');
    return closedErrorText(err.body.code) ?? ((!bare && (err.body.user_message || err.body.code)) || tr('השרת דחה את הבקשה ({status})', { status: err.status }));
  }
  if (isNoConnection(err)) return tr('אין חיבור לשרת.');
  return err instanceof Error ? err.message : String(err);
}

// ---------------------------------------------------------------- ADR-019: the one field-error reader

type Bag = Record<string, unknown>;
const isBag = (v: unknown): v is Bag => !!v && typeof v === 'object' && !Array.isArray(v);
const str = (v: unknown): string | null => (typeof v === 'string' && v ? v : null);
const uniq = (xs: string[]): string[] => [...new Set(xs)];

/** The `details` of an ApiError; {} for anything else. */
function detailsOf(err: unknown): Bag {
  return err instanceof ApiError && isBag(err.body.details) ? err.body.details : {};
}

/** A path as one dotted string: `a.b` as is, `['doors', 'pairs', 0]` -> `doors.pairs.0` (the global handler's `loc`). */
function pathOf(v: unknown): string | null {
  if (typeof v === 'string') return v || null;
  if (Array.isArray(v) && v.length && v.every((p) => typeof p === 'string' || typeof p === 'number')) return v.join('.');
  return null;
}

/** One `{field, code, message?}` from the canonical entry or a legacy issue (`{field, code}`, `{path, code, message}`, `{loc, type, msg}`). */
function problemOf(v: unknown): FieldProblem | null {
  if (!isBag(v)) return null;
  const field = str(v.field) ?? pathOf(v.path) ?? pathOf(v.loc);
  if (!field) return null;
  const code = str(v.code) ?? str(v.type) ?? 'invalid';
  const message = str(v.message) ?? str(v.msg);
  return message ? { field, code, message } : { field, code };
}

/** The canonical `details.problems`. */
function canonicalProblems(d: Bag): FieldProblem[] {
  return Array.isArray(d.problems) ? d.problems.map(problemOf).filter((p): p is FieldProblem => !!p) : [];
}

/** The legacy issue lists: `fields` as objects or as a map field -> message, a domain `errors` list with `path` or `loc`. */
function legacyProblems(d: Bag): FieldProblem[] {
  const out: FieldProblem[] = [];
  if (Array.isArray(d.fields)) out.push(...d.fields.filter(isBag).map(problemOf).filter((p): p is FieldProblem => !!p));
  else if (isBag(d.fields)) {
    for (const [field, m] of Object.entries(d.fields)) out.push(str(m) ? { field, code: 'invalid', message: m as string } : { field, code: 'invalid' });
  }
  if (Array.isArray(d.errors)) out.push(...d.errors.map(problemOf).filter((p): p is FieldProblem => !!p));
  return out;
}

/**
 * ADR-019 Step 0: the fields an error names - the canonical `details.fields` (names) and the fields of `details.problems` first; when
 * the answer has neither, every legacy form (`details.field`, `details.key`, `fields` as objects or as a map, an `errors` list with
 * `path` or `loc`). Each name once, in the server's order; [] for an error that names no field and for anything not an ApiError.
 * Screens read field errors through this (and `problemsOf`) instead of their own `details.*` reads.
 */
export function fieldsOf(err: unknown): string[] {
  const d = detailsOf(err);
  const canonical = [
    ...(Array.isArray(d.fields) ? d.fields.filter((f): f is string => typeof f === 'string' && !!f) : []),
    ...canonicalProblems(d).map((p) => p.field),
  ];
  if (canonical.length) return uniq(canonical);
  const legacy = [str(d.field), str(d.key), ...legacyProblems(d).map((p) => p.field)].filter((f): f is string => !!f);
  return uniq(legacy);
}

/**
 * ADR-019 Step 0: the per-field reasons of an error - the canonical `details.problems` first; without them the legacy issue lists
 * (`fields` as objects `{field, code}`, `fields` as a map field -> message (code `invalid`), `errors` with `path` or `loc`). A form
 * that only names fields (`fields` as names, `field`, `key`) has no reason: [] (read the names with `fieldsOf`).
 */
export function problemsOf(err: unknown): FieldProblem[] {
  const d = detailsOf(err);
  const canonical = canonicalProblems(d);
  return canonical.length ? canonical : legacyProblems(d);
}

/** ADR019-FAMILY678-2520: the field of a problem about the submitted item as a whole (an issue list's empty `path`; server `errors.WHOLE_BODY`). */
const WHOLE_BODY = 'body';

/** One issue of a domain issue list as the editors show it: `path` relative to the item ('' = the item as a whole), its code and text. */
interface PathIssue { path: string; code: string; message: string }

/**
 * ADR019-FAMILY678-2520: the issue list of a refused automation / schedule / scenario (and the like) - the canonical `details.problems`
 * first (`body` back to the empty path, a missing message as ''), else the legacy `details.errors` list as it was (its empty paths
 * kept). [] for an error without either.
 */
export function issuesOf(err: unknown): PathIssue[] {
  const d = detailsOf(err);
  const canonical = canonicalProblems(d);
  if (canonical.length) return canonical.map((p) => ({ path: p.field === WHOLE_BODY ? '' : p.field, code: p.code, message: p.message ?? '' }));
  if (!Array.isArray(d.errors)) return [];
  return d.errors.filter(isBag).filter((v) => typeof v.path === 'string')
    .map((v) => ({ path: v.path as string, code: str(v.code) ?? 'invalid', message: typeof v.message === 'string' ? v.message : '' }));
}

/** ADR019-FAMILY678-2520: the canonical keys a server sends beside an issue list (`errors.issue_problems`), for the demo stores. */
export function issueDetails(issues: readonly { path?: string; code: string; message?: string }[]): { fields: string[]; problems: FieldProblem[] } {
  const problems = issues.map((i) => ({ field: i.path || WHOLE_BODY, code: i.code || 'invalid', ...(i.message ? { message: i.message } : {}) }));
  return { fields: uniq(problems.map((p) => p.field)), problems };
}
