/**
 * The capture-lease settings (CR-WISKEY-LEASE-REVOCATION-EVENT section 7.3): `GET|PUT /access/capture-lease/settings`, system
 * administrator only (GET too). Settings only - nothing on operator screens. The lease route itself stays OFF: it cannot be
 * switched on until a bridge offers it AND the owner's separate go-live permit is in the build (`GO_LIVE_PERMITTED`, a backend
 * code constant that is false; `capture_lease_go_live_permitted` reports it, and `on` is refused with 409
 * `capture_lease_not_permitted`). This page edits the C03 lookup scope.
 */
import { get, put } from './client';
import { CONFIRM_WORDS } from '../i18n/confirm-words';

export type LookupScope = 'holder' | 'holder_or_audit_readers';

interface CaptureLeaseSettings {
  capture_lease: 'off' | 'on';
  capture_lease_available: boolean;
  capture_lease_go_live_permitted: boolean;
  capture_lease_seconds: number;
  capture_lease_seconds_values: number[];
  lookup_scope: LookupScope;
  lookup_scope_values: LookupScope[];
  degraded: boolean;
  ledger_busy: boolean;
  clock_untrusted: boolean;
}

/** The Hebrew word of the wider lookup (i18n/confirm-words.ts `capture_lookup_wide`; the screen shows `confirmWord(...)`). */
export const LOOKUP_WIDE_WORD = CONFIRM_WORDS.capture_lookup_wide.he;

export const getCaptureLeaseSettings = () => get<CaptureLeaseSettings>('access/capture-lease/settings');
export const setLookupScope = (value: LookupScope, confirm?: string) =>
  put<CaptureLeaseSettings>('access/capture-lease/settings', { lookup_scope: value, ...(confirm ? { lookup_scope_confirm: confirm } : {}) });
