/**
 * CR-008 SmplWise Arx: sign-in against Home Assistant's own auth endpoints on the same origin, exactly as HA's login
 * page does (src/data/auth.ts): `/auth/providers` → `/auth/login_flow` (PKCE S256 when HA accepts it) →
 * `/auth/login_flow/<id>` (username and password, then the MFA code when HA asks) → `/auth/token`. The password goes
 * to HA only, never to the add-on.
 *
 * Tokens are kept under our own key `arx.auth.v1` (localStorage, or sessionStorage in the `browser_session` mode) and
 * seeded into HA's `hassTokens` (hass-tokens.ts). The access token is exchanged for the Arx session cookie
 * (`POST api/v1/auth/session`) after sign-in and after every refresh (5 minutes before expiry, or on a 401).
 */
import { clientId, redirectUri } from './channel';
import { clearHassTokens, readHassTokens, seedHassTokens } from './hass-tokens';

export const TOKENS_KEY = 'arx.auth.v1';

/** Why the Arx sign-in ended (the sign-in page says so once). CR-008 P2: `everywhere` = the user's "sign out everywhere",
 * `revoked` = this sign-in was ended from the sessions list (by the user elsewhere or by an administrator). */
export type SignOutReason = 'expired' | 'idle' | 'logout' | 'everywhere' | 'revoked';
const ACTIVITY_KEY = 'arx.activity.v1';
const REFRESH_BEFORE_MS = 5 * 60_000;

export type SessionMode = 'rolling_90d' | 'browser_session' | 'rolling_90d_idle_lock';

export interface RemoteConfig {
  path: string;
  session: SessionMode;
  idle_lock_minutes: number;
}

export interface ArxTokens {
  hassUrl: string;
  clientId: string;
  access_token: string;
  refresh_token: string;
  expires: number;
  expires_in: number;
  user_id?: string;
}

export class ArxAuthError extends Error {
  constructor(public code: string, message: string, public status = 0) {
    super(message);
  }
}

// ---------------------------------------------------------------- remote config

let config: RemoteConfig = { path: '/arx/', session: 'rolling_90d', idle_lock_minutes: 720 };

export async function loadRemoteConfig(): Promise<RemoteConfig> {
  try {
    const res = await fetch('api/v1/auth/remote-config', { credentials: 'same-origin' });
    if (res.ok) config = (await res.json()) as RemoteConfig;
  } catch {
    /* keep the defaults: the sign-in still works */
  }
  return config;
}

export const remoteConfig = () => config;

// ---------------------------------------------------------------- token store

function store(): Storage {
  return config.session === 'browser_session' ? window.sessionStorage : window.localStorage;
}

export function loadTokens(): ArxTokens | null {
  try {
    const raw = store().getItem(TOKENS_KEY);
    const t = raw ? (JSON.parse(raw) as ArxTokens) : null;
    return t && t.clientId === clientId() && t.refresh_token ? t : null;
  } catch {
    return null;
  }
}

function saveTokens(t: ArxTokens): void {
  try {
    store().setItem(TOKENS_KEY, JSON.stringify(t));
    // the other storage never keeps a stale copy (a mode switch in the settings)
    (store() === window.localStorage ? window.sessionStorage : window.localStorage).removeItem(TOKENS_KEY);
  } catch {
    /* private mode: the session lasts as long as this page */
  }
  memory = t;
}

let memory: ArxTokens | null = null;
export const currentTokens = () => memory ?? loadTokens();

function clearTokens(): void {
  memory = null;
  for (const s of [window.localStorage, window.sessionStorage]) {
    try {
      s.removeItem(TOKENS_KEY);
    } catch {
      /* ignore */
    }
  }
}

/** `browser_session`: HA's seed lives in localStorage and would outlive the browser session - a start without our own
 * (session) tokens removes it. */
export function dropOrphanSeed(): void {
  if (config.session === 'browser_session' && !loadTokens()) clearHassTokens(clientId());
}

// ---------------------------------------------------------------- PKCE + HA's endpoints

function b64url(bytes: Uint8Array): string {
  let s = '';
  bytes.forEach((b) => (s += String.fromCharCode(b)));
  return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

async function pkcePair(): Promise<{ verifier: string; challenge: string }> {
  const verifier = b64url(crypto.getRandomValues(new Uint8Array(32)));
  const digest = new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(verifier)));
  return { verifier, challenge: b64url(digest) };
}

async function haJson(path: string, init: RequestInit): Promise<{ status: number; data: Record<string, unknown> | null }> {
  let res: Response;
  try {
    res = await fetch(path, { ...init, credentials: 'same-origin', cache: 'no-store' });
  } catch {
    throw new ArxAuthError('network', 'אין חיבור לתשתית המערכת. בדוק את החיבור ונסה שוב.');
  }
  let data: Record<string, unknown> | null = null;
  try {
    data = (await res.json()) as Record<string, unknown>;
  } catch {
    data = null;
  }
  return { status: res.status, data };
}

/** HA's own error texts (frontend translations ui.panel.page-authorize.form.providers.homeassistant.*), in Hebrew. */
const HA_ERRORS: Record<string, string> = {
  invalid_auth: 'שם משתמש או סיסמה לא תקינים',
  invalid_code: 'קוד אימות לא תקין',
  too_many_retry: 'יותר מדי ניסיונות שגויים. התחל את הכניסה מחדש.',
  login_expired: 'פג תוקף הכניסה, התחל מחדש.',
  no_mfa_module: 'מודול האימות הדו־שלבי אינו זמין.',
  invalid_flow: 'תהליך הכניסה פג. התחל מחדש.',
  unknown_error: 'שגיאה לא צפויה.',
};

export function haErrorText(code: string, fallback?: string): string {
  return HA_ERRORS[code] ?? fallback ?? HA_ERRORS.unknown_error;
}

export type FlowStep =
  | { kind: 'form'; flowId: string; step: 'init' | 'mfa' | string; error: string | null; mfaName?: string }
  | { kind: 'done'; code: string };

export interface LoginFlow {
  /** The PKCE verifier, or null when this HA does not accept PKCE (the token request then omits `code_verifier`). */
  verifier: string | null;
  flowId: string;
  handler: [string, string | null];
}

/** Whether this HA accepts PKCE on `/auth/login_flow`: unknown until the first start, then remembered for this page
 * (memory only). PKCE S256 arrived in HA core with home-assistant/core#181957 (merged to dev 2026-09-26, so 2026.10);
 * every release up to 2026.9.x rejects the extra keys with a 400 (see isPkceRejection). */
let pkceSupported: boolean | null = null;

/** HA's answer when its `/auth/login_flow` schema has no PKCE keys (http/data_validator.py: `json_message(f"Message
 * format incorrect: {err}", 400)`): 2026.9 (probatio) says "Message format incorrect: not a valid option at
 * 'code_challenge'", up to 2026.8 (voluptuous) "Message format incorrect: extra keys not allowed @ data['code_challenge']".
 * Any other 400 on the first start is treated the same way (one retry without PKCE; a second 400 is shown as it is). */
function pkceRejection(status: number, data: Record<string, unknown> | null): 'pkce_keys' | 'first_400' | null {
  if (status !== 400) return null;
  const msg = typeof data?.message === 'string' ? data.message : '';
  if (msg.includes('code_challenge') && (msg.includes('not a valid option') || msg.includes('extra keys not allowed'))) return 'pkce_keys';
  return 'first_400';
}

async function postStart(handler: [string, string | null], challenge: string | null) {
  const body: Record<string, unknown> = { client_id: clientId(), handler, redirect_uri: redirectUri() };
  if (challenge) Object.assign(body, { code_challenge: challenge, code_challenge_method: 'S256' });
  return haJson('/auth/login_flow', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
}

function httpError(status: number, data: Record<string, unknown> | null): ArxAuthError {
  const msg = typeof data?.message === 'string' ? data.message : '';
  if (status === 403 || status === 429) return new ArxAuthError('banned', 'תשתית המערכת חסמה את הכתובת שממנה ניסית להתחבר (יותר מדי ניסיונות כושלים). פנה למנהל המערכת.', status);
  if (status === 404) return new ArxAuthError('invalid_flow', haErrorText('invalid_flow'), status);
  if (status >= 500) return new ArxAuthError('ha_unavailable', 'תשתית המערכת אינה זמינה כרגע. נסה שוב בעוד רגע.', status);
  return new ArxAuthError('ha_error', msg ? `שגיאה: ${msg}` : haErrorText('unknown_error'), status);
}

function stepOf(data: Record<string, unknown>): FlowStep {
  if (data.type === 'create_entry') return { kind: 'done', code: String(data.result ?? '') };
  if (data.type === 'abort') {
    const reason = String(data.reason ?? 'unknown_error');
    throw new ArxAuthError(reason, haErrorText(reason));
  }
  const errors = (data.errors ?? {}) as Record<string, string>;
  const base = errors.base ?? Object.values(errors)[0] ?? null;
  const placeholders = (data.description_placeholders ?? {}) as Record<string, string>;
  return { kind: 'form', flowId: String(data.flow_id ?? ''), step: String(data.step_id ?? 'init'), error: base ? haErrorText(base) : null, mfaName: placeholders.mfa_module_name };
}

/** Start HA's login flow for its user store (`homeassistant` provider), with PKCE when this HA accepts it. */
export async function startFlow(): Promise<{ flow: LoginFlow; step: FlowStep }> {
  const providers = await haJson('/auth/providers', { method: 'GET' });
  if (providers.status !== 200 || !providers.data) throw httpError(providers.status, providers.data);
  const list = (Array.isArray(providers.data) ? providers.data : (providers.data.providers as unknown[])) as { type: string; id: string | null }[];
  const local = (list ?? []).find((p) => p.type === 'homeassistant');
  if (!local) throw new ArxAuthError('no_provider', 'ספק הכניסה (משתמשים וסיסמאות) אינו פעיל.');
  const handler: [string, string | null] = [local.type, local.id ?? null];
  let verifier: string | null = null;
  let r: Awaited<ReturnType<typeof haJson>>;
  if (pkceSupported !== false) {
    const pair = await pkcePair();
    r = await postStart(handler, pair.challenge);
    const rejected = pkceSupported === null ? pkceRejection(r.status, r.data) : null;
    if (rejected) {
      // an HA release without PKCE: exactly one retry without it, remembered for this page (never a loop)
      console.info(`Arx: Home Assistant refused PKCE on /auth/login_flow (${rejected}); signing in without it`);
      pkceSupported = false;
      r = await postStart(handler, null);
    } else {
      verifier = pair.verifier;
      if (r.status === 200) pkceSupported = true;
    }
  } else {
    r = await postStart(handler, null);
  }
  if (r.status !== 200 || !r.data) throw httpError(r.status, r.data);
  const step = stepOf(r.data);
  if (step.kind !== 'form') throw new ArxAuthError('unknown_error', haErrorText('unknown_error'));
  return { flow: { verifier, flowId: step.flowId, handler }, step };
}

/** Submit one step (`{username, password}` or `{code}`). */
export async function submitStep(flow: LoginFlow, values: Record<string, string>): Promise<FlowStep> {
  const r = await haJson(`/auth/login_flow/${encodeURIComponent(flow.flowId)}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ client_id: clientId(), ...values }),
  });
  if (r.status !== 200 || !r.data) throw httpError(r.status, r.data);
  const step = stepOf(r.data);
  if (step.kind === 'form' && step.flowId) flow.flowId = step.flowId;
  return step;
}

async function tokenRequest(form: Record<string, string>): Promise<Record<string, unknown>> {
  const r = await haJson('/auth/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ client_id: clientId(), ...form }).toString(),
  });
  if (r.status !== 200 || !r.data) {
    const err = String((r.data as Record<string, unknown> | null)?.error ?? '');
    throw new ArxAuthError(err === 'invalid_grant' ? 'invalid_grant' : 'token_failed', 'הכניסה פגה. יש להיכנס מחדש.', r.status);
  }
  return r.data;
}

function tokensFrom(data: Record<string, unknown>, refreshToken?: string): ArxTokens {
  const expiresIn = Number(data.expires_in ?? 1800);
  return {
    hassUrl: `${window.location.protocol}//${window.location.host}`,
    clientId: clientId(),
    access_token: String(data.access_token),
    refresh_token: String(refreshToken ?? data.refresh_token),
    expires: Date.now() + expiresIn * 1000,
    expires_in: expiresIn,
  };
}

// ---------------------------------------------------------------- the Arx session (cookie)

export interface ExchangeResult {
  user: { id: string; username: string; display_name: string };
  session_expires_in: number;
}

async function exchange(t: ArxTokens, secondFactor?: string): Promise<ExchangeResult> {
  let res: Response;
  const headers: Record<string, string> = { Authorization: `Bearer ${t.access_token}` };
  if (secondFactor) headers['X-Arx-Second-Factor'] = secondFactor;
  try {
    res = await fetch('api/v1/auth/session', { method: 'POST', headers, credentials: 'same-origin', cache: 'no-store' });
  } catch {
    throw new ArxAuthError('network', 'אין חיבור לשרת.');
  }
  const data = (await res.json().catch(() => null)) as { code?: string; user_message?: string } & Partial<ExchangeResult> | null;
  if (!res.ok) throw new ArxAuthError(data?.code ?? `http_${res.status}`, data?.user_message || 'השרת דחה את הכניסה.', res.status);
  return data as ExchangeResult;
}

/** K11: a sign-in that HA accepted and Arx holds back until the user types the code of their authenticator app (the
 * optional second factor). The tokens wait here, in memory; abandoning the step revokes them. */
let pendingFactor: ArxTokens | null = null;
export const hasPendingSecondFactor = () => pendingFactor !== null;

export async function abandonSecondFactor(): Promise<void> {
  const t = pendingFactor;
  pendingFactor = null;
  if (t) {
    clearTokens();
    await revoke(t.refresh_token);
  }
}

/** The second step of a sign-in: the 6-digit code. A wrong code keeps the step open; a lockout or any other refusal ends it. */
export async function completeSecondFactor(code: string): Promise<ExchangeResult> {
  const t = pendingFactor;
  if (!t) throw new ArxAuthError('second_factor_required', 'ההתחברות פגה. יש להיכנס מחדש.');
  try {
    const r = await exchange(t, code.replace(/\s+/g, ''));
    pendingFactor = null;
    t.user_id = r.user.id;
    saveTokens(t);
    seedHassTokens(t);
    markActivity();
    return r;
  } catch (err) {
    if (!(err instanceof ArxAuthError) || !['second_factor_invalid', 'network', 'ha_unavailable'].includes(err.code)) {
      pendingFactor = null;
      clearTokens();
      await revoke(t.refresh_token);
    }
    throw err;
  }
}

/** Sign-in finished at HA (an authorization code): tokens, the HA seed, the Arx session. */
export async function completeSignIn(flow: LoginFlow, code: string): Promise<ExchangeResult> {
  const grant: Record<string, string> = { grant_type: 'authorization_code', code };
  if (flow.verifier) grant.code_verifier = flow.verifier; // HA with PKCE refuses a verifier for a flow without a challenge
  const t = tokensFrom(await tokenRequest(grant));
  try {
    const r = await exchange(t);
    t.user_id = r.user.id;
    saveTokens(t);
    seedHassTokens(t); // D6: the WisKey frame opens signed in
    markActivity();
    return r;
  } catch (err) {
    if (err instanceof ArxAuthError && err.code === 'second_factor_required') {
      pendingFactor = t; // K11: HA's part is done; the code of the authenticator app is the second step
      throw err;
    }
    // refused by Arx (no remote access, inactive, MFA required): do not leave a valid HA sign-in behind
    await revoke(t.refresh_token);
    throw err;
  }
}

// ---------------------------------------------------------------- refresh loop

let refreshTimer = 0;
let refreshing: Promise<boolean> | null = null;

/** Refresh the HA access token (our client id), re-seed HA's entry when it is still ours, re-exchange the cookie. */
export function refreshNow(): Promise<boolean> {
  if (refreshing) return refreshing;
  refreshing = (async () => {
    const t = currentTokens();
    if (!t) return false;
    try {
      const fresh = tokensFrom(await tokenRequest({ grant_type: 'refresh_token', refresh_token: t.refresh_token }), t.refresh_token);
      fresh.user_id = t.user_id;
      try {
        await exchange(fresh);
      } catch (e) {
        if (e instanceof ArxAuthError && e.code === 'second_factor_required') {
          // K11: the Arx session is gone (expired cookie) and this user has a second factor: keep the HA sign-in, ask for the code
          pendingFactor = fresh;
          saveTokens(fresh);
          onSignedOut?.('expired');
          return false;
        }
        throw e;
      }
      saveTokens(fresh);
      seedHassTokens(fresh, true);
      schedule();
      return true;
    } catch (err) {
      // no connection, or the server says "try again" (5xx - e.g. 503 remote_unavailable / ha_unavailable): keep the
      // sign-in and retry; only an explicit refusal ends it (CR-008 P2 review follow-up)
      if (err instanceof ArxAuthError && (err.code === 'network' || (err.status ?? 0) >= 500)) {
        window.clearTimeout(refreshTimer);
        refreshTimer = window.setTimeout(() => void refreshNow(), 30_000);
        return false;
      }
      if (err instanceof ArxAuthError && err.status === 403) await revoke(t.refresh_token); // the policy refused this user
      if (err instanceof ArxAuthError && err.code === 'remote_session_revoked') {
        // CR-008 P2: this sign-in was ended from the sessions list - end it at HA too (the seed of this browser included)
        await revoke(t.refresh_token);
        try {
          window.sessionStorage.setItem('arx.signout', 'revoked');
        } catch {
          /* ignore */
        }
      }
      clearTokens();
      clearHassTokens(clientId(), t.refresh_token);
      return false;
    } finally {
      refreshing = null;
    }
  })();
  return refreshing;
}

function schedule(): void {
  const t = currentTokens();
  window.clearTimeout(refreshTimer);
  if (!t) return;
  const wait = Math.max(10_000, t.expires - Date.now() - REFRESH_BEFORE_MS);
  refreshTimer = window.setTimeout(() => {
    void refreshNow().then((ok) => {
      if (!ok && !currentTokens()) onSignedOut?.('expired');
    });
  }, wait);
}

let onSignedOut: ((reason: SignOutReason) => void) | null = null;

/** Resume a stored sign-in: refresh when the access token is near its end, then (re-)exchange the cookie. False = show
 * the sign-in page; an ArxAuthError = show it with that message (the policy refused this user). */
export async function resume(): Promise<boolean> {
  const t = loadTokens();
  if (!t) return false;
  memory = t;
  if (idleExpired()) {
    await logout('idle');
    return false;
  }
  if (t.expires - Date.now() < REFRESH_BEFORE_MS) return refreshNow();
  try {
    await exchange(t);
    seedHassTokens(t, true);
    schedule();
    return true;
  } catch (err) {
    if (err instanceof ArxAuthError && err.status === 403) {
      await logout('logout'); // no remote access (any more): the stored sign-in is revoked
      throw err;
    }
    if (err instanceof ArxAuthError && err.code === 'second_factor_required') {
      pendingFactor = t;
      throw err;
    }
    if (err instanceof ArxAuthError && err.status === 401) return refreshNow();
    throw err;
  }
}

/** Once the app runs: the refresh loop, the idle lock, and what to do when the sign-in ends. */
export function startBackground(signedOut: (reason: SignOutReason) => void): void {
  onSignedOut = signedOut;
  if (config.session === 'browser_session') {
    // security review M1: HA reads its seed only from localStorage, which outlives the browser session - so in this
    // mode the seed exists only while an Arx page is open (resume() writes it again on the next load of this tab)
    window.addEventListener('pagehide', () => clearHassTokens(clientId(), currentTokens()?.refresh_token));
    window.addEventListener('pageshow', (e) => {
      const t = currentTokens();
      if (e.persisted && t) seedHassTokens(t, true); // back from the back/forward cache: this page is open again
    });
  }
  schedule();
  startIdleWatch();
}

// ---------------------------------------------------------------- idle lock (rolling_90d_idle_lock)

let lastMark = 0;

function markActivity(): void {
  const now = Date.now();
  if (now - lastMark < 30_000) return;
  lastMark = now;
  try {
    window.localStorage.setItem(ACTIVITY_KEY, String(now));
  } catch {
    /* ignore */
  }
}

function idleExpired(): boolean {
  if (config.session !== 'rolling_90d_idle_lock') return false;
  const last = Number(window.localStorage.getItem(ACTIVITY_KEY) ?? '0');
  return last > 0 && Date.now() - last > Math.max(5, config.idle_lock_minutes) * 60_000;
}

let idleTimer = 0;

function startIdleWatch(): void {
  if (config.session !== 'rolling_90d_idle_lock' || idleTimer) return;
  for (const ev of ['pointerdown', 'keydown', 'wheel', 'touchstart']) window.addEventListener(ev, markActivity, { passive: true, capture: true });
  markActivity();
  idleTimer = window.setInterval(() => {
    if (idleExpired()) void logout('idle');
  }, 60_000);
}

// ---------------------------------------------------------------- sign-out

async function revoke(refreshToken: string): Promise<void> {
  try {
    await fetch('/auth/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({ action: 'revoke', token: refreshToken }).toString(),
      credentials: 'same-origin',
    });
  } catch {
    /* HA unreachable: the token still dies with its 90 days, and the user can delete it in the HA profile */
  }
}

/** Revoke the refresh token at HA, end the Arx session, clear both storages (ours and HA's seed when it is ours). */
export async function logout(reason: SignOutReason = 'logout'): Promise<void> {
  const t = currentTokens();
  window.clearTimeout(refreshTimer);
  window.clearInterval(idleTimer);
  idleTimer = 0;
  if (t) await revoke(t.refresh_token);
  try {
    await fetch('api/v1/auth/session', { method: 'DELETE', credentials: 'same-origin' });
  } catch {
    /* the cookie ends with its access token anyway */
  }
  clearTokens();
  clearHassTokens(clientId(), t?.refresh_token);
  try {
    window.localStorage.removeItem(ACTIVITY_KEY);
    window.sessionStorage.setItem('arx.signout', reason);
  } catch {
    /* ignore */
  }
  onSignedOut?.(reason);
}

/** The reason of the last sign-out (shown once on the sign-in page). */
export function takeSignOutReason(): string | null {
  try {
    const r = window.sessionStorage.getItem('arx.signout');
    window.sessionStorage.removeItem('arx.signout');
    return r;
  } catch {
    return null;
  }
}

export { readHassTokens };
