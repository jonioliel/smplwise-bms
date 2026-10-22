/**
 * UI2122: closed API error codes that need an actionable sentence of their own, in the document's language. `describeError` (client.ts)
 * consults this first, so every Frigate / NVR screen that already shows `describeError(err)` says the same thing without a code.
 * Hebrew first (the product language); English follows the document language.
 */
type Lang = 'he' | 'en';

const CLOSED: Record<string, Record<Lang, string>> = {
  // 409 from the Frigate routes: a recorder added after the add-on started is stored but not yet running (every recorder change waits for a restart)
  recorder_pending_restart: {
    he: 'המקליט נשמר וממתין להפעלה מחדש של התוסף. הפעילו מחדש את התוסף (הגדרות מערכת) ורעננו את המסך.',
    en: 'The recorder is saved and is waiting for the add-on to restart. Restart the add-on (System settings), then refresh the screen.',
  },
};

function lang(): Lang {
  return typeof document !== 'undefined' && (document.documentElement.lang || '').toLowerCase().startsWith('en') ? 'en' : 'he';
}

/** The sentence for a closed code, or null when the code has none (the caller keeps the server's own words). */
export function closedErrorText(code: string, l: Lang = lang()): string | null {
  return CLOSED[code]?.[l] ?? null;
}

/** True for the 409 `recorder_pending_restart` answer (`details.restart_required`). */
export function isPendingRestart(e: unknown): boolean {
  return typeof e === 'object' && e !== null && (e as { code?: unknown }).code === 'recorder_pending_restart';
}
