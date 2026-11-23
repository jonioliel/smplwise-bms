/**
 * UI2122: closed API error codes that need an actionable sentence of their own, in the document's language. `describeError` (client.ts)
 * consults this first, so every Frigate / NVR screen that already shows `describeError(err)` says the same thing without a code.
 * Hebrew first (the product language); English follows the document language.
 * I18N-EN-2490: a catalogue (he / en, `api/closed-errors`) - the English is in the language pack (src/i18n/lang/en/api/closed-errors.ts).
 */
import { docLang, registerCatalogue } from '../i18n/core';
import { packTable } from '../i18n/lang-packs';

type Lang = 'he' | 'en';

const he = {
  // HEALTH-GO2RTC-2430: the video service is down / not set (playback session create, snapshots, stream sync) - one wording, no component name
  media_unavailable: 'שירות הווידאו לא זמין. ננסה שוב אוטומטית; אם זה נמשך, פנו למנהל המערכת.',
  media_not_configured: 'שירות הווידאו לא הוגדר. פנו למנהל המערכת.',
  // 409 from the Frigate routes: a recorder added after the add-on started is stored but not yet running (every recorder change waits for a restart)
  recorder_pending_restart: 'המקליט נשמר וממתין להפעלה מחדש של התוסף. הפעילו מחדש את התוסף (הגדרות מערכת) ורעננו את המסך.',
};
type Code = keyof typeof he;
const en: Partial<Record<Code, string>> = packTable<typeof import('../i18n/lang/en/api/closed-errors').en>('en', 'api/closed-errors', 'en');
const TABLES: Record<Lang, Partial<Record<Code, string>>> = { he, en };
registerCatalogue('api/closed-errors', { he, en });

/** The sentence for a closed code, or null when the code has none (the caller keeps the server's own words). */
export function closedErrorText(code: string, l: Lang = docLang(['en'])): string | null {
  if (!Object.prototype.hasOwnProperty.call(he, code)) return null;
  return TABLES[l][code as Code] ?? he[code as Code];
}

/** True for the 409 `recorder_pending_restart` answer (`details.restart_required`). */
export function isPendingRestart(e: unknown): boolean {
  return typeof e === 'object' && e !== null && (e as { code?: unknown }).code === 'recorder_pending_restart';
}
