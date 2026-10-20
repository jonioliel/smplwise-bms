/** USR2 phase 4: passkeys of an Arx-only (local) identity (routers/local_passkeys.py). Lists never carry a credential id or a key. */
import { api, get, patch, post, put } from './client';
import type { CreationOptionsJSON } from '../arx/webauthn';

export interface PasskeyView {
  id: string;
  label: string | null;
  created_at: string;
  last_used_at: string | null;
  synced: boolean;
  backed_up: boolean;
  transports: string[];
  usable: boolean;
  user_verifying: boolean;
}

export interface PasskeySummary {
  available: boolean;
  rp_id: string | null;
  origin: string | null;
  first_allowed: boolean;
  first_on: boolean;
  only_on?: boolean;
  only_effective?: boolean;
  credentials: PasskeyView[];
  recent_auth?: boolean;
  recent_auth_left_s?: number;
  totp?: boolean;
}

export const ownPasskeys = () => get<PasskeySummary>('auth/passkeys');
export const registrationOptions = () => post<{ publicKey: CreationOptionsJSON; user_verification_required: boolean }>('auth/passkeys/register/options');
export const registerPasskey = (credential: Record<string, unknown>, label?: string) =>
  post<{ passkey: PasskeyView; first_factor: boolean }>('auth/passkeys/register', { credential, ...(label ? { label } : {}) });
export const renamePasskey = (id: string, label: string) => patch<PasskeySummary>(`auth/passkeys/${encodeURIComponent(id)}`, { label });
export const removePasskey = (id: string, code?: string) =>
  api<PasskeySummary & { removed: string }>(`auth/passkeys/${encodeURIComponent(id)}`, { method: 'DELETE', ...(code ? { body: JSON.stringify({ code }) } : {}) });
export const setPasskeyFirst = (on: boolean) => put<PasskeySummary>('auth/passkeys/first', { on });

/** Administration: identity.directory.read to list, identity.local.manage to remove (with the administrator's own TOTP code when enrolled). */
export const userPasskeys = (userId: string) => get<PasskeySummary & { user_id: string }>(`identity/local-users/${encodeURIComponent(userId)}/passkeys`);
export const adminRemovePasskey = (userId: string, id: string, ownCode?: string) =>
  api<PasskeySummary>(`identity/local-users/${encodeURIComponent(userId)}/passkeys/${encodeURIComponent(id)}`, {
    method: 'DELETE',
    ...(ownCode ? { headers: { 'X-Arx-Second-Factor': ownCode } } : {}),
  });

/** usr2-passkeys-only-mode: password sign-in refused for the user. Self: a working passkey + a fresh sign-in; administrator: identity.local.manage (off = the recovery). */
export const setPasskeyOnly = (on: boolean) => put<PasskeySummary>('auth/passkeys/only', { on });
export const adminSetPasskeyOnly = (userId: string, on: boolean) =>
  put<PasskeySummary & { user_id: string }>(`identity/local-users/${encodeURIComponent(userId)}/passkey-only`, { on });
