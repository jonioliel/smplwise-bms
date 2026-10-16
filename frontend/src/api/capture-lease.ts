/**
 * The capture-lease settings (CR-WISKEY-LEASE-REVOCATION-EVENT section 7.3): `GET|PUT /access/capture-lease/settings`, system
 * administrator only. Settings only - nothing on operator screens. The lease route itself stays OFF (it cannot be switched on
 * until a bridge offers it and the owner approves); this page edits the C03 lookup scope.
 */
import { get, put } from './client';

export type LookupScope = 'holder' | 'holder_or_audit_readers';

export interface CaptureLeaseSettings {
  capture_lease: 'off' | 'on';
  capture_lease_available: boolean;
  capture_lease_seconds: number;
  capture_lease_seconds_values: number[];
  lookup_scope: LookupScope;
  lookup_scope_values: LookupScope[];
  degraded: boolean;
  clock_untrusted: boolean;
}

export const LOOKUP_WIDE_WORD = 'הרחב בירור';

export const getCaptureLeaseSettings = () => get<CaptureLeaseSettings>('access/capture-lease/settings');
export const setLookupScope = (value: LookupScope, confirm?: string) =>
  put<CaptureLeaseSettings>('access/capture-lease/settings', { lookup_scope: value, ...(confirm ? { lookup_scope_confirm: confirm } : {}) });
