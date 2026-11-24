/**
 * MFA-SCREENS-2510 (slice 11 of the second-factor train): the reads and writes the factor screens use that had no client yet.
 * - the caller's own phone keys (routers/device_keys.py, slice 8): the list and a revoke (the revoke needs a fresh step-up proof: the
 *   server answers 403 `step_up_required` and the shell's dialog asks for it, api/client.ts);
 * - the sign-in factor policy with its compliance view (routers/factor_policy.py, slice 5) - `policy` previews another global value;
 * - one user's factors for the user drawer (routers/user_factors.py, this slice).
 * Shapes: generated from the backend's response models (smplwise/wire/device_keys.py, factor_policy.py, user_factors.py).
 */
import { api, get } from './client';
import type { DeviceKeyList, DeviceKeyRevoked, DeviceKeyRow } from './generated/wire-device-keys';
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
