/** USR2 phase 4: passkeys of an Arx-only (local) identity (routers/local_passkeys.py). Lists never carry a credential id or a key. */
import { STEP_UP_INLINE, api, get, patch, put } from './client';
import type * as PkWire from './generated/wire-local-passkeys';

/* The shapes are the backend's response models (smplwise_vms/backend/smplwise/wire/local_passkeys.py, generated into
 * ./generated/wire-local-passkeys.ts; code review 07:F8 step 2). */
export type PasskeyView = PkWire.Passkey;

/** A user's passkeys and modes; the caller's own answer (`ownPasskeys`) adds whether the session is a fresh sign-in and whether TOTP is
 * enrolled - optional here so one state type serves both screens. MFA-PASSKEYS-2490: `user_kind` (`local` = an Arx-only identity,
 * `user` = any other user, passkeys for all users). */
export type PasskeySummary = PkWire.PasskeySummary & Partial<Pick<PkWire.OwnPasskeys, 'recent_auth' | 'recent_auth_left_s' | 'totp' | 'user_kind'>>;

export const ownPasskeys = () => get<PkWire.OwnPasskeys>('auth/passkeys');
/** MFA-TRAIN-2500: the own factor changes (add, remove) confirm a step-up in place (components/sw-passkeys.ts offers the passkey and the
 * code next to the change), so their 403 `step_up_required` is left to that screen, not the shell dialog (api/client.ts STEP_UP_INLINE). */
const INLINE = { [STEP_UP_INLINE]: '1' };
export const registrationOptions = () => api<PkWire.RegistrationOptions>('auth/passkeys/register/options', { method: 'POST', headers: INLINE });
export const registerPasskey = (credential: Record<string, unknown>, label?: string) =>
  api<PkWire.PasskeyRegistered>('auth/passkeys/register', { method: 'POST', headers: INLINE, body: JSON.stringify({ credential, ...(label ? { label } : {}) }) });
// CR-FE-DEAD-CODE-2442 (O15 a): no caller yet - kept; built ahead by USR2 phase 4 (passkeys).
export const renamePasskey = (id: string, label: string) => patch<PasskeySummary>(`auth/passkeys/${encodeURIComponent(id)}`, { label });
export const removePasskey = (id: string, code?: string) =>
  api<PkWire.PasskeyRemoved>(`auth/passkeys/${encodeURIComponent(id)}`, { method: 'DELETE', headers: INLINE, ...(code ? { body: JSON.stringify({ code }) } : {}) });
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
