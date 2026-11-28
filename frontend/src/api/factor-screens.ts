/**
 * MFA-SCREENS-2510 (slice 11 of the second-factor train): the reads and writes the factor screens use that had no client yet.
 * - the caller's own phone keys (routers/device_keys.py, slice 8): the list and a revoke (the revoke needs a fresh step-up proof: the
 *   server answers 403 `step_up_required` and the shell's dialog asks for it, api/client.ts);
 * - the sign-in factor policy with its compliance view (routers/factor_policy.py, slice 5) - `policy` previews another global value;
 * - one user's factors for the user drawer (routers/user_factors.py, this slice).
 * - FIX-PHONEKEY-2570 (second deep review SA2-01 / SA2-02): the registration of the Android app's phone key (registerDeviceKey) and the
 *   rule that the phone is told the signed payload's own words (signPayload, api/device-key-prompt.ts).
 * Shapes: generated from the backend's response models (smplwise/wire/device_keys.py, factor_policy.py, user_factors.py).
 */
import { api, get, post } from './client';
import { signedPromptText } from './device-key-prompt';
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
  status(): Promise<{ available?: boolean; exists?: boolean; keyId?: string | null; authKind?: string }>;
  /** FIX-PHONEKEY-2570 (SA2-02): an app with `signedPrompt` builds its prompt from the signed payload and ignores the second argument. */
  sign(payload: string, text?: string): Promise<{ signature?: string }>;
  /** MFA-DEVICEKEY-2490: a new key for this server (a tap is needed); `payload` = the register payload (the attestation challenge). */
  create?(o: { authKind: string; payload: string }): Promise<{ publicKey?: string; authKind?: string; attestation?: string[] }>;
  setKeyId?(keyId: string): Promise<unknown>;
  /** FIX-PHONEKEY-2570: true in an app whose prompt shows the signed payload's own words (DeviceKeyPolicy.promptOf). */
  readonly signedPrompt?: boolean;
}

export function deviceKeyBridge(): DeviceKeyBridge | null {
  if (typeof window === 'undefined' || window.top !== window) return null;
  const d = (window as unknown as { ArxApp?: { deviceKey?: Partial<DeviceKeyBridge> } }).ArxApp?.deviceKey;
  return d && typeof d.status === 'function' && typeof d.sign === 'function' ? (d as DeviceKeyBridge) : null;
}

/** FIX-PHONEKEY-2570 (SA2-01): the first Android app version that registers a phone key from the page and shows the signed action on
 * the phone's own prompt (mobile/android-shell gradle.properties arxVersionName). Shown to the person; the check itself is by capability. */
export const PHONE_KEY_APP_VERSION = '2.1.0';

/**
 * FIX-PHONEKEY-2570 (SA2-01): can THIS page register a phone key?
 * - `ready`: inside the Android app whose bridge creates a key and whose prompt shows the signed action (`signedPrompt`);
 * - `update`: inside an older app (its prompt would show the page's text - SA2-02 - or it cannot create a key): update the app first;
 * - `no_app`: a browser (or a frame): a phone key is added in the Android app only.
 */
export type DeviceKeyEnrolment = 'ready' | 'update' | 'no_app';
export function deviceKeyEnrolment(): DeviceKeyEnrolment {
  const b = deviceKeyBridge();
  if (!b) return 'no_app';
  return typeof b.create === 'function' && typeof b.setKeyId === 'function' && b.signedPrompt === true ? 'ready' : 'update';
}

/** What the app says about its own key for this server: `keyId` null = no key, or a key the server never confirmed. */
export interface AppDeviceKey {
  available: boolean;
  exists: boolean;
  keyId: string | null;
}
export async function appDeviceKey(): Promise<AppDeviceKey | null> {
  const b = deviceKeyBridge();
  if (!b) return null;
  try {
    const st = await b.status();
    return { available: st.available !== false, exists: !!st.exists, keyId: st.exists && typeof st.keyId === 'string' && st.keyId ? st.keyId : null };
  } catch {
    return null;
  }
}

/** This app's phone key id when the app holds a key (else null): the dialog offers the phone key only then. */
export async function appDeviceKeyId(): Promise<string | null> {
  return (await appDeviceKey())?.keyId ?? null;
}

/** The phone's prompt was cancelled or failed (the app's own reason) - never a server answer. */
export class DeviceKeyCancelled extends Error {}

/** FIX-PHONEKEY-2570 (SA2-02): the signature of `payload` by the app's key. The phone is told the payload's own words
 * (signedPromptText) - never a text the caller chose. */
export async function signPayload(b: Pick<DeviceKeyBridge, 'sign'>, payload: string): Promise<string> {
  let signature = '';
  try {
    signature = (await b.sign(payload, signedPromptText(payload))).signature ?? '';
  } catch (err) {
    throw new DeviceKeyCancelled(err instanceof Error ? err.message : 'failed');
  }
  if (!signature) throw new DeviceKeyCancelled('failed');
  return signature;
}

/** The phone-key step-up: a step_up challenge bound to this session, the key and the action (routers/device_keys.py), the app's
 * biometric prompt signs the server's text (the phone shows the signed action - SA2-02), then `POST auth/step-up/verify {method: device_key}`. */
export async function deviceKeyStepUp(keyId: string, action?: string): Promise<StepUpProof> {
  const b = deviceKeyBridge();
  if (!b) throw new DeviceKeyCancelled('no_app');
  const ch = await post<DeviceKeyChallenge>('auth/device-keys/challenge', { purpose: 'step_up', key_id: keyId, ...(action ? { action } : {}) });
  const signature = await signPayload(b, ch.payload);
  return post<StepUpProof>('auth/step-up/verify', { method: 'device_key', challenge_id: ch.challenge_id, key_id: keyId, signature, ...(action ? { action } : {}) });
}

/** FIX-PHONEKEY-2570 (SA2-01): a registration the server accepted, but the app did not keep the new key's id. */
export class DeviceKeyNotKept extends Error {
  constructor(readonly row: DeviceKeyRow) {
    super('not_kept');
  }
}

/** FIX-PHONEKEY-2570 (SA2-01): this app's key was added - the approval watcher (shell/push-approval-watch.ts) looks again, no reload. */
export const DEVICE_KEY_CHANGED = 'sw-device-key-changed';

/**
 * FIX-PHONEKEY-2570 (SA2-01): register THIS phone's key with the signed-in account - inside the Android app only.
 * `POST auth/device-keys/challenge {purpose: register}` -> the app creates the Keystore key (attested with the payload's hash; a tap
 * is needed) -> the new key signs the register payload (the phone's own prompt) -> `POST auth/device-keys` -> the app keeps the
 * server's key id. The server decides the rest: a user with another factor confirms first (403 `step_up_required`: the shell's
 * dialog asks and the request is sent once more, api/client.ts), a first factor needs a recent sign-in (403 `reauth_required`), the
 * auth kind and the attestation mode; it audits the registration and every refusal (`auth.device_key.registered` / `.refused`).
 * Throws DeviceKeyCancelled (the app's reason: no_app | cancelled | no_gesture | unavailable | refused | error | failed | timeout),
 * an ApiError from the server, or DeviceKeyNotKept.
 */
export async function registerDeviceKey(label: string): Promise<DeviceKeyRow> {
  const b = deviceKeyBridge();
  if (!b || deviceKeyEnrolment() !== 'ready' || !b.create || !b.setKeyId) throw new DeviceKeyCancelled('no_app');
  const ch = await post<DeviceKeyChallenge>('auth/device-keys/challenge', { purpose: 'register' });
  let made: { publicKey?: string; authKind?: string; attestation?: string[] };
  try {
    made = await b.create({ authKind: ch.auth_kind, payload: ch.payload });
  } catch (err) {
    throw new DeviceKeyCancelled(err instanceof Error ? err.message : 'failed');
  }
  if (!made?.publicKey) throw new DeviceKeyCancelled('failed');
  const signature = await signPayload(b, ch.payload);
  const attestation = Array.isArray(made.attestation) && made.attestation.length ? made.attestation : undefined;
  const row = await post<DeviceKeyRow>('auth/device-keys', {
    challenge_id: ch.challenge_id,
    public_key: made.publicKey,
    signature,
    label: label.trim().slice(0, 60),
    auth_kind: made.authKind === 'biometric' ? 'biometric' : 'biometric_or_screen_lock',
    ...(attestation ? { attestation } : {}),
  });
  try {
    await b.setKeyId(row.id);
  } catch {
    throw new DeviceKeyNotKept(row);
  }
  if (typeof window !== 'undefined') window.dispatchEvent(new CustomEvent(DEVICE_KEY_CHANGED));
  return row;
}

/** A one-time recovery code as the proof of the normal window (the server refuses it for a once-action and for adding a factor). */
export const recoveryStepUp = (code: string, action?: string) =>
  post<StepUpProof>('auth/step-up/verify', { method: 'recovery_code', code, ...(action ? { action } : {}) });

/** The actions a recovery code never confirms besides the once-actions (services/step_up.FACTOR_ADD_ACTIONS): not offered there. */
export const NO_RECOVERY_ACTIONS: readonly string[] = ['auth.second_factor.enroll', 'auth.recovery_codes.regenerate', 'auth.passkey.register', 'auth.device_key.register'];
