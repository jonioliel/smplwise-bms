/** USR2 phase 4: passkeys of an Arx-only (local) identity (routers/local_passkeys.py). Lists never carry a credential id or a key. */
import { api, get, patch, post, put } from './client';
import type * as PkWire from './generated/wire-local-passkeys';

/* The shapes are the backend's response models (smplwise_vms/backend/smplwise/wire/local_passkeys.py, generated into
 * ./generated/wire-local-passkeys.ts; code review 07:F8 step 2). */
export type PasskeyView = PkWire.Passkey;

/** A user's passkeys and modes; the caller's own answer (`ownPasskeys`) adds whether the session is a fresh sign-in and whether TOTP is
 * enrolled - optional here so one state type serves both screens. */
export type PasskeySummary = PkWire.PasskeySummary & Partial<Pick<PkWire.OwnPasskeys, 'recent_auth' | 'recent_auth_left_s' | 'totp'>>;

export const ownPasskeys = () => get<PkWire.OwnPasskeys>('auth/passkeys');
export const registrationOptions = () => post<PkWire.RegistrationOptions>('auth/passkeys/register/options');
export const registerPasskey = (credential: Record<string, unknown>, label?: string) =>
  post<PkWire.PasskeyRegistered>('auth/passkeys/register', { credential, ...(label ? { label } : {}) });
// CR-FE-DEAD-CODE-2442 (O15 a): no caller yet - kept; built ahead by USR2 phase 4 (passkeys).
export const renamePasskey = (id: string, label: string) => patch<PasskeySummary>(`auth/passkeys/${encodeURIComponent(id)}`, { label });
export const removePasskey = (id: string, code?: string) =>
  api<PkWire.PasskeyRemoved>(`auth/passkeys/${encodeURIComponent(id)}`, { method: 'DELETE', ...(code ? { body: JSON.stringify({ code }) } : {}) });
export const setPasskeyFirst = (on: boolean) => put<PasskeySummary>('auth/passkeys/first', { on });

/** Administration: identity.directory.read to list, identity.local.manage to remove (with the administrator's own TOTP code when enrolled). */
export const userPasskeys = (userId: string) => get<PkWire.UserPasskeys>(`identity/local-users/${encodeURIComponent(userId)}/passkeys`);
export const adminRemovePasskey = (userId: string, id: string, ownCode?: string) =>
  api<PkWire.UserPasskeyRemoved>(`identity/local-users/${encodeURIComponent(userId)}/passkeys/${encodeURIComponent(id)}`, {
    method: 'DELETE',
    ...(ownCode ? { headers: { 'X-Arx-Second-Factor': ownCode } } : {}),
  });

/** usr2-passkeys-only-mode: password sign-in refused for the user. Self: a working passkey + a fresh sign-in; administrator: identity.local.manage (off = the recovery). */
export const setPasskeyOnly = (on: boolean) => put<PasskeySummary>('auth/passkeys/only', { on });
export const adminSetPasskeyOnly = (userId: string, on: boolean) =>
  put<PkWire.UserPasskeys>(`identity/local-users/${encodeURIComponent(userId)}/passkey-only`, { on });
