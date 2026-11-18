/**
 * WISKEY-WA-QUEUE-2400: the words of the installed-client messaging card (Settings > access control > messages). Hebrew first; English,
 * Arabic and Russian follow the document language. Every key exists in all four tables (unit-wa-installed.spec.ts holds the parity);
 * the Arabic and Russian columns are an INITIAL translation that needs a native review (dev-marked). No platform name appears (the page's copy-hygiene
 * check): the provider is "שירות ההודעות" (UI_COPY_RULES). `{name}` placeholders are filled by `wi(key, { name })`.
 */
import { docLang, fill, registerCatalogue } from './core';
import { packTable } from './lang-packs';
type Lang = 'he' | 'en' | 'ar' | 'ru';

const he = {
  title: 'תבניות ותור שליחה',
  sub: 'רשימת התבניות של שירות ההודעות, תור השליחה ומצב כל הודעה. היסטוריית השיחות נשארת בשירות ההודעות.',
  loadError: 'לא ניתן לטעון את מצב התבניות',
  retry: 'נסו שוב',
  blocked: 'שליחת תבנית אינה זמינה כרגע',
  blk_messaging_off: 'שליחת הודעות כבויה',
  blk_template_switch_off: 'שליחת תבניות כבויה',
  blk_permit_closed: 'טרם אושרה שליחה מול עמדה אמיתית',
  blk_queue_unavailable: 'החיבור הישיר לשירות ההודעות אינו זמין',
  ready: 'שליחת תבנית זמינה',
  commands: 'מה שירות ההודעות מאפשר עכשיו',
  cmd_registry: 'רשימת תבניות',
  cmd_queue: 'תור שליחה',
  cmd_job: 'מצב משימה',
  cmd_cancel: 'ביטול משימה',
  cmd_now: 'שליחה מיידית',
  cmd_paced: 'שליחה בקצב של השירות',
  on: 'זמין',
  off: 'לא זמין',
  registry: 'תבניות',
  fromWiskey: 'מהשירות: {n}',
  fromArx: 'שהוגדרו כאן: {n}',
  nativeLocked: 'תבניות השירות נשלחות רק כשההתקנה האוטומטית פעילה',
  sync: 'רענון מהשירות',
  syncing: 'מרענן...',
  lastSync: 'רענון אחרון: {time}',
  neverSynced: 'עוד לא רועננה',
  sync_synced: 'הרשימה רועננה',
  sync_not_sent: 'לא נשלחה בקשה',
  sync_refused: 'השירות סירב',
  sync_invalid: 'התשובה לא תקינה - הרשימה נשמרה',
  sync_unknown: 'לא התקבלה תשובה',
  noTemplates: 'אין תבניות',
  src_wiskey: 'מהשירות',
  src_arx: 'כאן',
  unbound: 'לא מקושרת',
  jobs: 'משימות אחרונות',
  noJobs: 'אין משימות בתור',
  job_pending: 'ממתינה בתור',
  job_sent: 'התקבלה אצל ספק ההודעות',
  job_cancelled: 'בוטלה - לא נשלחה',
  job_paced: 'עוכבה בקצב של השירות - לא נשלחה',
  job_expired: 'פג תוקפה בתור - לא נשלחה',
  job_not_sent: 'לא נשלחה',
  job_unknown: 'לא ידוע אם נשלחה',
  delivery: 'השירות אינו מדווח על מסירה - ידוע רק שהספק קיבל את ההודעה',
  ttl: 'הודעה ממתינה בתור עד {n} שניות',
  paced: 'הודעה חופשית בקצב של השירות',
  pacedOn: 'מופעל - כל הודעה שנשלחה תוצג כ"לא ידוע" עד שהשירות ידווח קבלה',
  pacedOff: 'כבוי',
  pacedUnlisted: 'השירות אינו מציע זאת כרגע',
  saved: 'נשמר',
  history: 'היסטוריית השיחות נשארת בשירות ההודעות ואינה נשמרת כאן',
};
type Key = keyof typeof he;

const en: Record<Key, string> = packTable<typeof import('./lang/en/i18n/wa-installed').en>('en', 'i18n/wa-installed', 'en');

const ar: Record<Key, string> = packTable<typeof import('./lang/ar/i18n/wa-installed').ar>('ar', 'i18n/wa-installed', 'ar');

const ru: Record<Key, string> = packTable<typeof import('./lang/ru/i18n/wa-installed').ru>('ru', 'i18n/wa-installed', 'ru');

export type WiKey = Key;
export const WI_TABLES: Record<Lang, Record<Key, string>> = { he, en, ar, ru };
/** The columns that are an initial, unreviewed translation. */
export const WI_DEV_MARKED: readonly Lang[] = ['ar', 'ru'];
export const WI_KEYS = Object.keys(he) as Key[];

function wiLang(): Lang {
  return docLang(['en', 'ar', 'ru']);
}

export function wi(key: Key, vars?: Record<string, string | number>, lang: Lang = wiLang()): string {
  const raw = WI_TABLES[lang][key] ?? he[key] ?? key;
  return fill(raw, vars);
}

registerCatalogue('i18n/wa-installed', { he, en, ar, ru }, WI_DEV_MARKED);
