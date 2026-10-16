/**
 * USR2: the sign-in of an Arx-only (local) identity on the remote channel. The password goes to the add-on over TLS
 * (`POST api/v1/auth/local/sign-in`), the add-on answers with its own opaque session cookie (HttpOnly - this page never sees it)
 * or asks for the TOTP code (`202` + a pending cookie, then `POST api/v1/auth/local/sign-in/second-factor`). Nothing is kept in
 * localStorage: the cookie IS the session, so resuming is a `GET api/v1/me`. The welcome page redeems a first-login / reset link
 * (`POST api/v1/auth/local/set-password`); the token comes from the URL fragment and never reaches a log. Phase 2: the
 * self-service reset by a WhatsApp code (`POST api/v1/auth/local/reset/request`, then `.../reset/confirm`).
 */
import { ArxAuthError } from './auth';
import { lit } from '../i18n/local-identity';
import { getPasskey, type RequestOptionsJSON } from './webauthn';

export interface LocalSignIn {
  second_factor: 'none' | 'required' | 'enroll_required';
  must_change_password?: boolean;
  user?: { id: string; username: string; display_name: string; source: string };
  /** USR2 phase 4: present on the pending step when a passkey can answer it (`['totp', 'passkey']` or `['passkey']`). */
  methods?: ('totp' | 'passkey')[];
}

export interface LocalMe {
  user: { id: string; source: string };
  local_identity?: { gate: string | null; admin_permissions_blocked: boolean; must_change_password: boolean };
}

async function call<T>(path: string, init: RequestInit): Promise<{ status: number; data: T }> {
  let res: Response;
  try {
    res = await fetch(path, { ...init, credentials: 'same-origin', cache: 'no-store', headers: { 'Content-Type': 'application/json', ...(init.headers ?? {}) } });
  } catch {
    throw new ArxAuthError('network', lit('network'));
  }
  const data = (await res.json().catch(() => null)) as (T & { code?: string; user_message?: string }) | null;
  if (!res.ok && res.status !== 202) {
    throw new ArxAuthError(data?.code ?? `http_${res.status}`, data?.user_message || lit('unexpected'), res.status);
  }
  return { status: res.status, data: data as T };
}

export async function localSignIn(username: string, password: string): Promise<LocalSignIn> {
  const r = await call<LocalSignIn>('api/v1/auth/local/sign-in', { method: 'POST', body: JSON.stringify({ username, password }) });
  return r.status === 202 ? { second_factor: 'required', ...(r.data?.methods ? { methods: r.data.methods } : {}) } : r.data;
}

/** USR2 phase 4: answer the pending second step with a passkey (options bound to the pending cookie, then the assertion). */
export async function localPasskeySecondFactor(): Promise<LocalSignIn> {
  const opts = await call<{ publicKey: RequestOptionsJSON }>('api/v1/auth/local/sign-in/passkey/options', { method: 'POST', body: '{}' });
  const credential = await getPasskey(opts.data.publicKey);
  return (await call<LocalSignIn>('api/v1/auth/local/sign-in/passkey', { method: 'POST', body: JSON.stringify({ credential }) })).data;
}

/** USR2 phase 4: passkey first - a discoverable passkey with on-device verification, no username, no password. */
export async function localPasskeySignIn(): Promise<LocalSignIn> {
  const opts = await call<{ publicKey: RequestOptionsJSON }>('api/v1/auth/local/passkey/options', { method: 'POST', body: '{}' });
  const credential = await getPasskey(opts.data.publicKey);
  return (await call<LocalSignIn>('api/v1/auth/local/passkey', { method: 'POST', body: JSON.stringify({ credential }) })).data;
}

export async function localSecondFactor(code: string): Promise<LocalSignIn> {
  return (await call<LocalSignIn>('api/v1/auth/local/sign-in/second-factor', { method: 'POST', body: JSON.stringify({ code: code.replace(/\s+/g, '') }) })).data;
}

export async function setPassword(token: string, password: string): Promise<{ must_enrol: boolean }> {
  return (await call<{ must_enrol: boolean }>('api/v1/auth/local/set-password', { method: 'POST', body: JSON.stringify({ token, password }) })).data;
}

/** USR2 phase 2: ask for a self-service reset code. The answer is the same whatever the account (no "this user exists" signal). */
export async function requestReset(username: string): Promise<void> {
  await call('api/v1/auth/local/reset/request', { method: 'POST', body: JSON.stringify({ username }) });
}

/** USR2 phase 2: the code from WhatsApp + the new password. No session is created: the page signs in normally afterwards. */
export async function confirmReset(username: string, code: string, password: string): Promise<{ must_enrol: boolean }> {
  return (await call<{ must_enrol: boolean }>('api/v1/auth/local/reset/confirm', {
    method: 'POST',
    body: JSON.stringify({ username, code: code.replace(/[\s-]+/g, ''), password }),
  })).data;
}

export async function changePassword(current: string, next: string, code?: string): Promise<void> {
  await call('api/v1/auth/local/password', { method: 'PUT', body: JSON.stringify({ current_password: current, new_password: next, ...(code ? { code } : {}) }) });
}

/** The local session this browser holds, or null (no cookie, ended, or not a local identity). */
export async function localMe(): Promise<LocalMe | null> {
  try {
    const res = await fetch('api/v1/me', { credentials: 'same-origin', cache: 'no-store' });
    if (!res.ok) return null;
    const me = (await res.json()) as LocalMe;
    return me?.user?.source === 'local' ? me : null;
  } catch {
    return null;
  }
}

/** The token of a welcome link (`#/welcome?t=<token>`), or null. */
export function welcomeToken(hash: string = window.location.hash): string | null {
  const m = /^#\/welcome\?(?:.*&)?t=([A-Za-z0-9_-]{20,128})(?:&|$)/.exec(hash);
  return m ? m[1] : null;
}

/** Take the token out of the address bar (it is single use; nothing should keep it in the history). */
export function forgetWelcomeToken(): void {
  try {
    window.history.replaceState(null, '', window.location.pathname + window.location.search);
  } catch {
    /* ignore */
  }
}
