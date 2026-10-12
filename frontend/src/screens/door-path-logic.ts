/**
 * Pure helpers of CR-033 D6 / D8 (no DOM, unit-tested in Node: tests/unit-door-path.spec.ts). Hebrew copy lives here so the
 * lock-all dialog, the door Settings card and the spec read the same words.
 *
 * D6: WisKey does not support lock. "Lock all" never sends lock.lock to a WisKey door; the dialog skips those doors and says so.
 * D8: the administrator setting that blocks adding new WisKey door steps in the editors, and the scheduled lock jobs that will
 *     never work.
 */
import type { DoorSettings } from '../api/doors';

export interface LockRowLike {
  entity_id: string;
  locked?: boolean;
  wiskey_door?: boolean;
}

export const LOCK_ALL_SKIPPED_WORD = 'לא רלוונטי';
export const EDITOR_BLOCK_REFUSAL = 'לא ניתן להוסיף כאן פתיחת דלת אינטרקום. פתיחה נעשית מכפתור הדלת או מתוכנית החזקה פתוחה.';
export const NEVER_WORKS = 'לא יעבוד לעולם - מנעול של אינטרקום אינו תומך בנעילה';

/** The rows "lock all" may send to (not locked, not a WisKey door) and the WisKey doors it skips. */
export function splitLockAll<T extends LockRowLike>(rows: T[]): { sendable: T[]; skipped: T[] } {
  return { sendable: rows.filter((r) => !r.wiskey_door && !r.locked), skipped: rows.filter((r) => r.wiskey_door) };
}

/** The sentence the dialog shows about the skipped doors (empty when none). Never says they were locked. */
export function skippedText(count: number): string {
  if (count <= 0) return '';
  return count === 1
    ? `${LOCK_ALL_SKIPPED_WORD}: דלת אינטרקום אחת אינה תומכת בנעילה, ולא נשלחה אליה פקודה.`
    : `${LOCK_ALL_SKIPPED_WORD}: ${count} דלתות אינטרקום אינן תומכות בנעילה, ולא נשלחה אליהן פקודה.`;
}

/** The dialog's question: only what is really sent is counted. */
export function lockAllQuestion(sendable: number, skipped: number): string {
  if (sendable === 0) return skipped > 0 ? 'אין מנעולים לנעילה' : 'כל המנעולים נעולים';
  return sendable === 1 ? 'לנעול מנעול אחד?' : `לנעול ${sendable} מנעולים?`;
}

/** The editor-block row of the door Settings card. */
export function editorBlockLabel(mode: DoorSettings['editor_block']): string {
  return mode === 'allowed' ? 'מותר להוסיף פתיחת דלת בעורכים' : 'חסום: אי אפשר להוסיף פתיחת דלת אינטרקום בעורכים';
}

export function editorBlockHint(s: Pick<DoorSettings, 'editor_block' | 'editor_allowed_available'>): string {
  const base = 'חל על אוטומציות, סקריפטים, סצנות ותזמונים חדשים; פריטים קיימים לא משתנים. פתיחה נעשית מכפתור הדלת או מתוכנית החזקה פתוחה.';
  return s.editor_allowed_available ? base : `${base} האפשרות "מותר" תיפתח לאחר השלמת הסבת הפריטים.`;
}

export function editorBlockQuestion(next: DoorSettings['editor_block']): string {
  return next === 'blocked' ? 'לחסום הוספת פתיחת דלת אינטרקום בעורכים?' : 'להתיר הוספת פתיחת דלת אינטרקום בעורכים?';
}

/** One line per scheduled lock job that will never work. */
export function lockJobLine(job: { name: string; locks: string[] }): string {
  const name = job.name || 'תזמון ללא שם';
  return `${name} · ${job.locks.join(', ')} · ${NEVER_WORKS}`;
}
