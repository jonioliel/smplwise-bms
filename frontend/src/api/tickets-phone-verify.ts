/**
 * TKNOTIFOTP (owner decision 2026-10-16): the OPTIONAL number verification by a one-time WhatsApp code (OFF by default).
 *   POST tickets/contacts/{id}/phone-verify/send|check   a configurer, for a vendor / contact (never a row that names a user)
 *   POST tickets/contacts/{id}/phone-confirm              "אני בטוח שזה המספר שלו" - only while verification is off for the row
 *   POST tickets/me/phone-verify/send|check               the signed-in user, for their OWN number (no id in the request)
 * No number and no code ever comes back. Without a backend (static preview) the calls answer a fixed demo result.
 */
import { post } from './client';
import { isApi } from './session';
import type { StaffMine } from './tickets';

export interface VerifyState { phone_verify: boolean; verify_required: boolean; confirmed: boolean; confirmed_via: 'user' | 'manager' | 'code' | null; code_pending: boolean }
export interface CodeSent { sent: boolean; expires_in_s: number; resend_after_s: number }

const T = 'tickets';
const enc = encodeURIComponent;
const demoSent: CodeSent = { sent: true, expires_in_s: 600, resend_after_s: 60 };
const demoState = (via: VerifyState['confirmed_via']): VerifyState => ({ phone_verify: false, verify_required: via === 'code', confirmed: true, confirmed_via: via, code_pending: false });

export const phoneVerifyApi = {
  contactSend: (id: string): Promise<CodeSent> => (isApi() ? post<CodeSent>(`${T}/contacts/${enc(id)}/phone-verify/send`, {}) : Promise.resolve(demoSent)),
  contactCheck: (id: string, code: string): Promise<VerifyState> =>
    (isApi() ? post<VerifyState>(`${T}/contacts/${enc(id)}/phone-verify/check`, { code }) : Promise.resolve(demoState('code'))),
  contactConfirm: (id: string, confirm: string): Promise<VerifyState> =>
    (isApi() ? post<VerifyState>(`${T}/contacts/${enc(id)}/phone-confirm`, { confirm }) : Promise.resolve(demoState('manager'))),
  mySend: (): Promise<CodeSent> => (isApi() ? post<CodeSent>(`${T}/me/phone-verify/send`, {}) : Promise.resolve(demoSent)),
  myCheck: (code: string): Promise<StaffMine> => post<StaffMine>(`${T}/me/phone-verify/check`, { code }),
};

/** A code as people type it: six digits, spaces / dashes between groups allowed (the server is the judge). */
export function codeLooksComplete(raw: string): boolean {
  return /^\d{6}$/.test(raw.replace(/[\s-]/g, ''));
}
