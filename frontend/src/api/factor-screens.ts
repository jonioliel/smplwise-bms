/**
 * MFA-SCREENS-2510 (slice 11 of the second-factor train): the reads and writes the factor screens use that had no client yet.
 * - the caller's own phone keys (routers/device_keys.py, slice 8): the list and a revoke (the revoke needs a fresh step-up proof: the
 *   server answers 403 `step_up_required` and the shell's dialog asks for it, api/client.ts);
 * - the sign-in factor policy with its compliance view (routers/factor_policy.py, slice 5) - `policy` previews another global value;
 * - one user's factors for the user drawer (routers/user_factors.py, this slice).
 * Shapes: generated from the backend's response models (smplwise/wire/device_keys.py, factor_policy.py, user_factors.py).
 */
import { api, get, post } from './client';
import type { DeviceKeyChallenge, DeviceKeyList, DeviceKeyRevoked, DeviceKeyRow } from './generated/wire-device-keys';
import type { StepUpProof } from './generated/wire-second-factor';
import type { Compliance, FactorPolicy, Person } from './generated/wire-factor-policy';
import type { UserFactors } from './generated/wire-user-factors';

export type { Compliance, DeviceKeyList, DeviceKeyRow, FactorPolicy, Person, UserFactors };

export const listDeviceKeys = () => get<DeviceKeyList>('auth/device-keys');
export const revokeDeviceKey = (id: string) => api<DeviceKeyRevoked>(`auth/device-keys/${encodeURIComponent(id)}`, { method: 'DELETE' });

export type PolicyValue = FactorPolicy['policy'];
export const POLICY_VALUES: readonly PolicyValue[] = ['optional', 'admins', 'sensitive', 'all'];
/** The stored policy and its compliance view; with `preview`, the compliance view of that global value instead (nothing is saved). */
export const factorPolicy = (preview?: PolicyValue) =>
  get<FactorPolicy>(preview ? `security/factor-policy?${new URLSearchParams({ policy: preview })}` : 'security/factor-policy');

export const userFactors = (userId: string) => get<UserFactors>(`security/user-factors/${encodeURIComponent(userId)}`);

/* MFA-SCREENS-2510 (MFA-SECFIX-2500 open question 5, owner-approved): the step-up dialog's other two methods. */

/** The Android app's phone-key bridge (mobile/android-shell BridgeScript.kt `window.ArxApp.deviceKey`), only in the top-level page. */
interface DeviceKeyBridge {
  status(): Promise<{ available?: boolean; exists?: boolean; keyId?: string | null }>;
  sign(payload: string, text: string): Promise<{ signature?: string }>;
}

export function deviceKeyBridge(): DeviceKeyBridge | null {
  if (typeof window === 'undefined' || window.top !== window) return null;
  const d = (window as unknown as { ArxApp?: { deviceKey?: Partial<DeviceKeyBridge> } }).ArxApp?.deviceKey;
  return d && typeof d.status === 'function' && typeof d.sign === 'function' ? (d as DeviceKeyBridge) : null;
}

/** This app's phone key id when the app holds a key (else null): the dialog offers the phone key only then. */
export async function appDeviceKeyId(): Promise<string | null> {
  const b = deviceKeyBridge();
  if (!b) return null;
  try {
    const st = await b.status();
    return st.exists && typeof st.keyId === 'string' && st.keyId ? st.keyId : null;
  } catch {
    return null;
  }
}

/** The phone's prompt was cancelled or failed (the app's own reason) - never a server answer. */
export class DeviceKeyCancelled extends Error {}

/** The phone-key step-up: a step_up challenge bound to this session, the key and the action (routers/device_keys.py), the app's
 * biometric prompt signs the server's text (`text` is shown on the phone), then `POST auth/step-up/verify {method: device_key}`. */
export async function deviceKeyStepUp(keyId: string, text: string, action?: string): Promise<StepUpProof> {
  const b = deviceKeyBridge();
  if (!b) throw new DeviceKeyCancelled('no_app');
  const ch = await post<DeviceKeyChallenge>('auth/device-keys/challenge', { purpose: 'step_up', key_id: keyId, ...(action ? { action } : {}) });
  let signature = '';
  try {
    signature = (await b.sign(ch.payload, text)).signature ?? '';
  } catch (err) {
    throw new DeviceKeyCancelled(err instanceof Error ? err.message : 'failed');
  }
  if (!signature) throw new DeviceKeyCancelled('failed');
  return post<StepUpProof>('auth/step-up/verify', { method: 'device_key', challenge_id: ch.challenge_id, key_id: keyId, signature, ...(action ? { action } : {}) });
}

/** A one-time recovery code as the proof of the normal window (the server refuses it for a once-action and for adding a factor). */
export const recoveryStepUp = (code: string, action?: string) =>
  post<StepUpProof>('auth/step-up/verify', { method: 'recovery_code', code, ...(action ? { action } : {}) });

/** The actions a recovery code never confirms besides the once-actions (services/step_up.FACTOR_ADD_ACTIONS): not offered there. */
export const NO_RECOVERY_ACTIONS: readonly string[] = ['auth.second_factor.enroll', 'auth.recovery_codes.regenerate', 'auth.passkey.register', 'auth.device_key.register'];
