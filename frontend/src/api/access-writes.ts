/**
 * CR-036 S11: the person writes the native people screen adds to the editor's - archive / restore, switch on / off, end a visitor's
 * or a contractor's access, one card by number in or out, the photo (routers/access_control_writes.py). The browser never talks to
 * the integration: every call is one typed Arx endpoint, which checks Arx RBAC on the person's stations, audits the write under the
 * real operator and sends it ONCE. Nothing here retries: an answer that is not a clear success is the caller's to show
 * (api/intercom.ts `actionOutcome`), never to send again.
 *
 * Each call carries a fresh command envelope (`client_request_id` + `expires_at` on the server's clock): one per deliberate action,
 * never reused - the server refuses a duplicate.
 */
import { post, put } from './client';
import { commandId } from './request-id';
import { serverNow, type IntercomEditorPerson, type WriteEffect } from './intercom';

/** A command not sent within this long is refused by the server rather than carried out late (MASTER_SPEC §15). */
const COMMAND_TTL_MS = 15_000;

/** A fresh command id and expiry for ONE deliberate action. */
export function writeEnvelope(): { client_request_id: string; expires_at: string } {
  return { client_request_id: commandId(), expires_at: new Date(serverNow() + COMMAND_TTL_MS).toISOString().replace(/\.\d{3}Z$/, 'Z') };
}

/** A write's reply: the saved record in the editor projection at the caller's field level, and the effect class. */
export type PersonWriteReply = {
  state: string;
  configured: boolean;
  last_error: string | null;
  fetched_at: string | null;
  person: IntercomEditorPerson | null;
  command_id: string;
} & WriteEffect;

export type TemporaryCancelReason = 'visit_cancelled' | 'visit_completed' | 'access_no_longer_needed';
export const TEMPORARY_CANCEL_REASONS: readonly TemporaryCancelReason[] = ['visit_completed', 'visit_cancelled', 'access_no_longer_needed'];

const person = (id: string) => `intercom/people/${encodeURIComponent(id)}`;

/** `confirmed` is sent only from the confirmation step: the server refuses the action without it. */
export const archivePerson = (id: string, revision: number) => post<PersonWriteReply>(`${person(id)}/archive`, { revision, confirmed: true, ...writeEnvelope() });
export const unarchivePerson = (id: string, revision: number) => post<PersonWriteReply>(`${person(id)}/unarchive`, { revision, confirmed: true, ...writeEnvelope() });
export const setPersonActive = (id: string, revision: number, active: boolean) => post<PersonWriteReply>(`${person(id)}/active`, { active, revision, ...writeEnvelope() });
export const cancelTemporaryAccess = (id: string, revision: number, reason: TemporaryCancelReason) =>
  post<PersonWriteReply>(`${person(id)}/temporary-cancel`, { reason_code: reason, revision, confirmed: true, ...writeEnvelope() });
/** One card typed by number: the number travels in this request only; the reply carries it masked. */
export const addPersonCard = (id: string, revision: number, card: { card_no: string; label: string; enabled: boolean }) =>
  post<PersonWriteReply>(`${person(id)}/cards`, { ...card, revision, ...writeEnvelope() });
export const removePersonCard = (id: string, revision: number, cardId: string) =>
  post<PersonWriteReply>(`${person(id)}/cards/${encodeURIComponent(cardId)}/remove`, { revision, confirmed: true, ...writeEnvelope() });
/** A JPEG data URL (at most 512 x 512, 32 KB - api/access-writes callers prepare it), or null to remove the photo. */
export const setPersonPhoto = (id: string, revision: number, photo: string | null, syncNow = true) =>
  put<PersonWriteReply>(`${person(id)}/photo`, { photo, revision, sync_now: syncNow, ...writeEnvelope() });
