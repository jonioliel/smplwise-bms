/**
 * RFQQUESTIONS (docs/tickets/RFQ_BACKEND_CONTRACT.md section 19): the pure rules of a vendor's question on the manager screens - the badge
 * a list row / a vendor row / a comparison column shows, the award confirmation's warning, the age line and the answer form's checks.
 * Kept free of Lit so the unit spec reads it directly. A server older than 2.6.5 sends no `questions` field: every helper then answers
 * "no badge" (never a guess).
 */
import type { RfqAnswerBody, RfqDetail, RfqQuestion, RfqQuestionCounts } from '../api/tickets-rfq';

export const ANSWER_MAX = 2000;
export const QUESTION_SHOWN_MAX = 1000;

export interface QuestionBadge { n: number; fresh: boolean }

/** The badge of a row / column: the number of pending questions, `fresh` while one of them was not opened by a manager yet. */
export function questionBadge(c: RfqQuestionCounts | null | undefined): QuestionBadge | null {
  const n = Math.max(0, Math.floor(Number(c?.pending ?? 0)) || 0);
  if (!n) return null;
  return { n, fresh: Math.max(0, Number(c?.unread ?? 0) || 0) > 0 };
}

/** The pending questions of the detail, oldest first (the server's order; a missing field is none). */
export function pendingQuestions(d: Pick<RfqDetail, 'questions'> | null | undefined): RfqQuestion[] {
  return [...(d?.questions?.items ?? [])];
}

/**
 * The award confirmation's warning (owner 2026-10-17): approving while a vendor question is unanswered. `vendors` = the names of the
 * selected vendors that themselves have a pending question; `total` = every pending question of the request (another vendor's
 * clarification can matter too). Null when nothing is pending.
 */
export function awardQuestionWarning(d: Pick<RfqDetail, 'questions' | 'vendors'> | null | undefined, selectedVendorIds: readonly string[]): { total: number; vendors: string[] } | null {
  const total = Math.max(0, Number(d?.questions?.pending ?? 0) || 0);
  if (!d || !total) return null;
  const vendors = d.vendors.filter((v) => selectedVendorIds.includes(v.id) && (v.questions?.pending ?? 0) > 0).map((v) => v.contact.company || v.contact.name);
  return { total, vendors };
}

/** Whether the answer form may go to the preview: an answer within its limit and, for "every vendor", the question as shown. */
export function answerProblems(body: RfqAnswerBody, original: string): string[] {
  const out: string[] = [];
  const text = body.text.trim();
  if (!text) out.push('text_required');
  else if (text.length > ANSWER_MAX) out.push('text_too_long');
  if (body.scope === 'all') {
    const shown = (body.question_text ?? original).trim();
    if (!shown) out.push('question_required');
    else if (shown.length > QUESTION_SHOWN_MAX) out.push('question_too_long');
  }
  return out;
}

/** The body the preview and the send carry: vendor-only by default; the shown question only for "every vendor". */
export function answerBody(text: string, scope: 'vendor' | 'all', shown: string, nameAsker: boolean, notify: boolean): RfqAnswerBody {
  return scope === 'all' ? { text: text.trim(), scope, question_text: shown.trim(), name_asker: nameAsker, notify } : { text: text.trim(), scope, notify };
}

/** The total of the navigation badge (0 = none); a failed or absent summary is none. */
export function navCount(summary: { pending?: number } | null | undefined): number {
  return Math.max(0, Math.floor(Number(summary?.pending ?? 0)) || 0);
}
