/**
 * CR-INTAKE99 / TENANTINTAKE098-295 (owner answers 143-156): the operator side of the free-text request intake.
 *   GET  tickets/intake/summary                       {open, can, enabled, list}  (never an error for someone who may not handle drafts)
 *   GET  tickets/intake/drafts?state=&limit=&offset=  the queue (urgent first, then oldest)
 *   GET  tickets/intake/drafts/{id}                   one draft with the suggestion, the evidence offsets and possible duplicates
 *   PUT  tickets/intake/drafts/{id}                   {revision, values}
 *   POST tickets/intake/drafts/{id}/approve|merge|reject
 *   GET|POST tickets/intake/known, DELETE tickets/intake/known/{id}?revision=   the managed list of numbers (masked, never the full number)
 * Without a backend (static preview): empty answers.
 */
import { del, get, post, put } from './client';
import { isApi } from './session';

export type IntakeUrgency = 'urgent' | 'high' | 'normal' | 'low';
export type IntakeConfidence = 'high' | 'medium' | 'low' | 'none';
export type RejectReason = 'not_a_request' | 'duplicate' | 'spam' | 'abusive' | 'out_of_scope' | 'test';

export interface IntakeSummary { open: number; can: boolean; enabled: boolean; list?: boolean }
export interface IntakeDraftRow {
  id: string; state: 'open' | 'approved' | 'merged' | 'rejected' | 'expired'; revision: number; received_at: string; last_message_at: string;
  message_count: number; urgency: IntakeUrgency; flags: string[]; first_line: string; ticket_id: string | null; reject_reason: RejectReason | null;
  requester: { name: string; org: string; phone_masked: string } | null; department_id: string | null; category_id: string | null;
}
/** [start, end, rule id] offsets into the ORIGINAL text of the draft */
export type Evidence = [number, number, string];
export interface IntakeSuggestion {
  department_id: string | null;
  category: { value: string | null; confidence: IntakeConfidence; evidence: Evidence[]; candidates: string[] };
  location: { value: string | null; confidence: IntakeConfidence; evidence: Evidence[] };
  place: { text: string; confidence: IntakeConfidence; evidence: Evidence[] };
  urgency: { value: IntakeUrgency; confidence: IntakeConfidence; evidence: Evidence[] };
  title: string; flags: string[];
}
export interface IntakeDraft extends IntakeDraftRow {
  text: string; suggestion: IntakeSuggestion; edited: Partial<Record<IntakeEditKey, string | null>>;
  duplicates: { drafts: string[]; ticket_numbers: number[] };
}
export type IntakeEditKey = 'department_id' | 'category_id' | 'priority_key' | 'location_id' | 'place_other' | 'title' | 'description';
export interface KnownNumber { id: string; display_name: string; org: string; phone_masked: string; lang: string; active: boolean; revision: number; created_at: string }

const T = 'tickets/intake';
const enc = encodeURIComponent;
const EMPTY_SUMMARY: IntakeSummary = { open: 0, can: false, enabled: false };

export const intakeApi = {
  summary: (): Promise<IntakeSummary> => (isApi() ? get<IntakeSummary>(`${T}/summary`) : Promise.resolve(EMPTY_SUMMARY)),
  drafts: (offset = 0, limit = 5): Promise<{ drafts: IntakeDraftRow[]; total: number; enabled: boolean }> =>
    (isApi() ? get(`${T}/drafts?state=open&limit=${limit}&offset=${offset}`) : Promise.resolve({ drafts: [], total: 0, enabled: false })),
  draft: (id: string): Promise<IntakeDraft> => get(`${T}/drafts/${enc(id)}`),
  edit: (d: { id: string; revision: number }, values: Partial<Record<IntakeEditKey, string | null>>): Promise<IntakeDraft> =>
    put(`${T}/drafts/${enc(d.id)}`, { revision: d.revision, values }),
  approve: (d: { id: string; revision: number }): Promise<{ ticket_id: string; number: number; reply_queued: boolean }> =>
    post(`${T}/drafts/${enc(d.id)}/approve`, { revision: d.revision }),
  merge: (d: { id: string; revision: number }, number: number): Promise<{ ticket_id: string }> =>
    post(`${T}/drafts/${enc(d.id)}/merge`, { revision: d.revision, number }),
  reject: (d: { id: string; revision: number }, reason: RejectReason, block: boolean): Promise<{ ok: boolean; blocked: boolean }> =>
    post(`${T}/drafts/${enc(d.id)}/reject`, { revision: d.revision, reason, block }),
  known: (): Promise<{ known: KnownNumber[] }> => (isApi() ? get(`${T}/known`) : Promise.resolve({ known: [] })),
  addKnown: (body: { display_name: string; phone: string; org: string }): Promise<KnownNumber> => post(`${T}/known`, body),
  removeKnown: (k: KnownNumber): Promise<void> => del(`${T}/known/${enc(k.id)}?revision=${k.revision}`),
};
