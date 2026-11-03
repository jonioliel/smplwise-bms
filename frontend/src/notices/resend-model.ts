/**
 * BOARD-MGMT-2381 (owner 03.11, answer 6A): the manual "שלח שוב" of a published notice - pure rules, shared by the notice list's row
 * action and the compose dialog. Nothing is re-sent automatically after an edit; the server (`POST notices/{id}/resend`) decides again
 * (notices.manage on the audience + notices.push, a live published notice, once a minute, someone to send to) and audits every send.
 */
import type { Audience, Notice } from '../api/notices';
import type { Draft } from './model';

/** A notice with nobody to send to: shown on TV boards only. */
export function tvOnly(a: Audience | undefined): boolean {
  return !a || (!a.everyone && !a.floors?.length && !a.areas?.length && !a.groups?.length && !a.roles?.length);
}

/** The row action: a published notice that is still on (active or scheduled), with recipients, for a writer who holds notices.push. */
export function canResend(n: Pick<Notice, 'status' | 'state' | 'audience'>, canPush: boolean): boolean {
  return canPush && n.status === 'published' && (n.state === 'active' || n.state === 'scheduled') && !tvOnly(n.audience);
}

/** The compose dialog's "שמירה ושליחה שוב": the same rule on the draft being edited (its end time decides whether it is still on). */
export function canResendDraft(d: Pick<Draft, 'status' | 'aud' | 'to' | 'untilArchived'>, canPush: boolean, now: Date = new Date()): boolean {
  if (!canPush || d.status !== 'published' || d.aud === 'tv') return false;
  if (d.untilArchived || !d.to) return true;
  const end = new Date(d.to);
  return Number.isNaN(end.getTime()) || end.getTime() > now.getTime();
}

export interface ResendResult {
  requested: boolean;
  sent: boolean;
  recipients: number;
  generation?: number;
  error?: string;
}

/** The toast after a re-send: the count when the pipeline took it, the failure line otherwise. */
export function resendOutcome(r: ResendResult | undefined): { key: 'resendDone' | 'resendFailed'; n: number } {
  return r?.sent ? { key: 'resendDone', n: r.recipients } : { key: 'resendFailed', n: 0 };
}
