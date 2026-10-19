/**
 * NEEDSREVIEW (2.8.0): the "needs review" privacy report (דוח דורש בחינה) on "מטפלים וספקים" › דורש בחינה (tickets.configure).
 *   GET  tickets/contacts-review                          the two sections (pending technicians, idle people) and the thresholds
 *   POST access-grants/pending-contacts/{id}/reject       a pending row: the existing "reject and delete"
 *   POST tickets/contacts-review/{id}/delete {confirm}    an idle row: "delete now" (the directory erase, Arx-side only)
 * Nothing here reaches the door system; a row linked to a door-system person keeps that person until a separate manual removal.
 * Without a backend (static preview): an empty report.
 */
import { get, post } from './client';
import { isApi } from './session';

export interface ReviewRow {
  contact_id: string;
  name: string;
  vendor: string | null;
  /** masked: the last four digits */
  phone: string | null;
  section: 'pending' | 'idle';
  /** pending: since when; idle: the last activity Arx knows (UTC ISO) */
  since: string;
  days?: number;
  months?: number;
  door_system_linked: boolean;
  door_system_created: boolean;
  action: 'reject' | 'erase';
}

export interface ReviewReport {
  pending_days: number;
  idle_months: number;
  pending: ReviewRow[];
  idle: ReviewRow[];
  at: string;
}

const enc = encodeURIComponent;
const EMPTY: ReviewReport = { pending_days: 30, idle_months: 12, pending: [], idle: [], at: '' };

export const needsReviewApi = {
  report: (): Promise<ReviewReport> => (isApi() ? get<ReviewReport>('tickets/contacts-review') : Promise.resolve(EMPTY)),
  reject: (id: string): Promise<{ contact_id: string; rejected: boolean; deleted: boolean }> => post(`access-grants/pending-contacts/${enc(id)}/reject`),
  erase: (id: string): Promise<{ contact_id: string; deleted: boolean; door_system_linked: boolean }> =>
    post(`tickets/contacts-review/${enc(id)}/delete`, { confirm: true }),
};
