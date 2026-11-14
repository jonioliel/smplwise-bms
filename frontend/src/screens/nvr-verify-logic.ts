/**
 * CAM-H264-VERIFY-2361: the words and the pure decisions of the verification report of a bulk encoding change (the H.264 preset and every
 * encoding batch, and their undo). The server checks every stream read-only - the NVR read-back, what the camera really sends (go2rtc's
 * stream probe) and whether a restart is needed - and keeps the report with the batch; the report dialog (nvr-verify-report) shows it,
 * lists the cameras that did not change and offers a read-only re-check. Labels come from the server; the fallbacks here only cover an
 * item without one. Device strings are rendered as text only.
 */
import type { Batch, BatchItem, BatchVerify, ItemVerify, RefusalPolicy, VerifyOutcome } from '../api/nvr-batch';
import { tr } from '../i18n/msg/media';

export const OUTCOME_HE: Record<VerifyOutcome, string> = {
  confirmed: tr('המצלמה אישרה'),
  nvr_accepted: tr('המקליט קיבל'),
  still_old: tr('עדיין בקידוד הקודם'),
  restart_needed: tr('צריך אתחול'),
  failed: tr('נכשל'),
  unchanged: tr('כבר מוגדר'),
};

export type VerifyTone = 'ok' | 'info' | 'warn' | 'bad' | 'muted';

export const OUTCOME_TONE: Record<VerifyOutcome, VerifyTone> = {
  confirmed: 'ok',
  nvr_accepted: 'info',
  still_old: 'warn',
  restart_needed: 'warn',
  failed: 'bad',
  unchanged: 'muted',
};

/** "מצלמות שלא השתנו": still the old codec, waiting for a restart, or not done at all (a skipped one too). */
export const WORKLIST: readonly VerifyOutcome[] = ['still_old', 'restart_needed', 'failed'];

const isOutcome = (v: unknown): v is VerifyOutcome => typeof v === 'string' && v in OUTCOME_HE;

/** The chip of a row: the server's label ("המצלמה אישרה (H.264)", "עדיין H.265", "נכשל: ..."), else ours. */
export function outcomeLabel(v: ItemVerify | null | undefined): string {
  if (!v || !isOutcome(v.outcome)) return '';
  if (v.label) return v.label;
  switch (v.outcome) {
    case 'confirmed':
      return v.expected ? tr('המצלמה אישרה ({expected})', { expected: v.expected }) : OUTCOME_HE.confirmed;
    case 'still_old':
      return v.media_codec ? tr('עדיין {media_codec}', { media_codec: v.media_codec }) : OUTCOME_HE.still_old;
    case 'failed':
      return tr('נכשל: {reason}', { reason: v.reason ?? tr('השינוי לא בוצע') });
    default:
      return OUTCOME_HE[v.outcome];
  }
}

export const outcomeTone = (v: ItemVerify | null | undefined): VerifyTone => (v && isOutcome(v.outcome) ? OUTCOME_TONE[v.outcome] : 'muted');

// ------------------------------------------------------------------------------------------------ the refusal policy

export const REFUSAL_LABEL = tr('אם ה־NVR מסרב לשנות מצלמה');

export const REFUSAL_ITEMS: readonly { id: RefusalPolicy; label: string }[] = [
  { id: 'skip', label: tr('לדלג ולהמשיך') },
  { id: 'stop', label: tr('לעצור את כל ההמרה') },
];

export const REFUSAL_HINT: Record<RefusalPolicy, string> = {
  skip: tr('המצלמה נשארת כמו שהיא ונרשמת בדוח, וההמרה ממשיכה לשאר המצלמות.'),
  stop: tr('ההמרה נעצרת במצלמה הראשונה שה־NVR מסרב לשנות; מה שכבר השתנה נשאר, ואפשר להחזיר אותו.'),
};

/** A stored / answered value; anything else reads as the default (`skip`, owner 2026-11-02). An older server that names none stops (`fallback`). */
export const normalizeRefusal = (v: unknown, fallback: RefusalPolicy = 'skip'): RefusalPolicy => (v === 'skip' || v === 'stop' ? v : fallback);

const VERIFY_NOTE = tr('בסוף תוצג בדיקה של מה שכל מצלמה שולחת בפועל.');

/** The lead of the ONE confirmation of an encoding change, by policy. */
export function encodingLead(policy: RefusalPolicy): string {
  return policy === 'skip'
    ? tr('השידור של כל מצלמה ייקטע לכמה שניות. השינוי יתבצע מצלמה אחרי מצלמה; מצלמה שה־NVR מסרב לשנות תדולג וההמרה תמשיך. {VERIFY_NOTE}', { VERIFY_NOTE })
    : tr('השידור של כל מצלמה ייקטע לכמה שניות. השינוי יתבצע מצלמה אחרי מצלמה ויעצור בשגיאה הראשונה. {VERIFY_NOTE}', { VERIFY_NOTE });
}

/** The lead of the undo of an encoding change, by policy. */
export function encodingUndoLead(policy: RefusalPolicy): string {
  return policy === 'skip'
    ? tr('השידור של כל מצלמה ייקטע לכמה שניות. ההחזרה תתבצע מצלמה אחרי מצלמה; מצלמה שה־NVR מסרב להחזיר תדולג, ואפשר לנסות אותה שוב.')
    : tr('השידור של כל מצלמה ייקטע לכמה שניות. ההחזרה תתבצע מצלמה אחרי מצלמה ותעצור בשגיאה הראשונה.');
}

// ------------------------------------------------------------------------------------------------ the report

export const isVerifyActive = (v: BatchVerify | null | undefined): boolean => v?.state === 'running' || v?.state === 'pending';

const n = (x: number | undefined): number => (typeof x === 'number' && x > 0 ? x : 0);
const join = (parts: (string | false | '')[]): string => parts.filter(Boolean).join(' · ');
const streams = (k: number): string => (k === 1 ? tr('זרם אחד') : tr('{k} זרמים', { k }));

/** One line over the list. */
export function verifySummary(v: BatchVerify | null | undefined): string {
  if (!v || v.state === 'none') return '';
  if (v.state === 'pending') return tr('הבדיקה תתחיל בסיום השינוי.');
  if (v.state === 'running') return tr('בודק מה כל מצלמה שולחת בפועל…');
  const c = v.counts ?? ({} as Record<VerifyOutcome, number>);
  const line = join([
    n(c.confirmed) > 0 && tr('המצלמה אישרה: {streams}', { streams: streams(n(c.confirmed)) }),
    n(c.nvr_accepted) > 0 && tr('המקליט קיבל (לא נבדק במצלמה): {streams}', { streams: streams(n(c.nvr_accepted)) }),
    n(c.still_old) > 0 && tr('עדיין בקידוד הקודם: {streams}', { streams: streams(n(c.still_old)) }),
    n(c.restart_needed) > 0 && tr('צריך אתחול: {streams}', { streams: streams(n(c.restart_needed)) }),
    n(c.failed) > 0 && tr('נכשל: {streams}', { streams: streams(n(c.failed)) }),
    (v.skipped?.length ?? 0) > 0 && tr('דולגו: {streams}', { streams: streams(v.skipped.length) }),
    n(c.unchanged) > 0 && tr('כבר מוגדר: {streams}', { streams: streams(n(c.unchanged)) }),
  ]);
  return v.state === 'interrupted' ? join([tr('הבדיקה נקטעה; אפשר לבדוק שוב'), line]) : line || tr('אין זרמים בדוח.');
}

export type VerifyTab = 'all' | 'worklist' | 'skipped';

/** The rows of a tab: every stream / the cameras that did not change / the ones the batch stepped over. */
export function verifyRows(b: Batch, tab: VerifyTab): BatchItem[] {
  const items = b.items ?? [];
  if (tab === 'worklist') return items.filter((i) => !!i.verify && WORKLIST.includes(i.verify.outcome));
  if (tab === 'skipped') return items.filter((i) => i.skipped === true);
  return items;
}

export function verifyTabs(b: Batch): { id: VerifyTab; label: string; count: number }[] {
  const all = verifyRows(b, 'all').length;
  const work = verifyRows(b, 'worklist').length;
  const skip = verifyRows(b, 'skipped').length;
  return [
    { id: 'all' as VerifyTab, label: tr('כל הזרמים'), count: all },
    { id: 'worklist' as VerifyTab, label: tr('מצלמות שלא השתנו'), count: work },
    { id: 'skipped' as VerifyTab, label: tr('דולגו'), count: skip },
  ].filter((t) => t.id !== 'skipped' || t.count > 0);
}

export function reportTitle(b: Pick<Batch, 'kind'>): string {
  return b.kind === 'rollback' ? tr('דוח בדיקה · החזרה לערכים הקודמים') : tr('דוח בדיקה · שינוי קידוד');
}

/** The line shown when the re-check was refused. */
export function recheckErrorLine(e: { status: number; code: string; user_message?: string }): string {
  switch (e.code) {
    case 'verify_too_soon':
      return tr('בדיקה חוזרת אפשרית בעוד כמה שניות.');
    case 'verify_in_progress':
      return tr('הבדיקה עדיין מתבצעת.');
    case 'nothing_to_verify':
      return tr('אין מצלמות לבדיקה חוזרת.');
    case 'verify_not_available':
      return tr('בדיקה חוזרת קיימת רק לשינוי קידוד.');
    case 'network':
      return tr('אין חיבור לשרת.');
    default:
      return e.status === 403 ? tr('אין הרשאה לפעולה הזו.') : e.user_message || tr('הבדיקה לא התחילה.');
  }
}

export const RECHECK_HINT = tr('בדיקה חוזרת קוראת בלבד: רשימת הזרמים מה־NVR ומה שהמצלמות שולחות. שום הגדרה לא משתנה.');

/** The encoding batches whose report can be opened again, newest first. */
export function recentReports(list: Batch[]): Batch[] {
  return list.filter((b) => b.mode === 'encoding').sort((a, b) => String(b.created_at ?? '').localeCompare(String(a.created_at ?? '')));
}

/** "02.11 14:05" in the browser's zone (an unreadable value: empty). */
export function whenLabel(iso: string | null | undefined): string {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  const p = (x: number) => String(x).padStart(2, '0');
  return `${p(d.getDate())}.${p(d.getMonth() + 1)} ${p(d.getHours())}:${p(d.getMinutes())}`;
}

export function recentLabel(b: Batch): string {
  const what = b.kind === 'rollback' ? tr('החזרה לערכים הקודמים') : b.settings?.codec ? tr('המרה ל־{codec}', { codec: b.settings.codec }) : tr('שינוי קידוד');
  return join([what, whenLabel(b.created_at)]);
}
