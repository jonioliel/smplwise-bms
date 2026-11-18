/**
 * CR-WA-PACING-295: the words of the shared send-budget card in Settings > messaging channel. Hebrew first; English, Arabic and Russian
 * follow the document language. Every key exists in all four tables (unit-messaging-pacing.spec.ts holds the parity); the Arabic and
 * Russian columns are an INITIAL translation that needs a native review (dev-marked). A Settings page may name WhatsApp and WisKey.
 * `{name}` placeholders are filled by `mp(key, { name })`.
 */
import { docLang, fill, registerCatalogue } from './core';
import { packTable } from './lang-packs';
type Lang = 'he' | 'en' | 'ar' | 'ru';

const he = {
  title: 'קצב שליחה משותף',
  mode: 'מצב',
  mode_conservative: 'שמרני',
  mode_standard: 'רגיל',
  mode_off: 'כבוי',
  wiskey: 'WisKey שולח מאותו מספר',
  inactive: 'לא פעיל',
  limits: 'המתנה מרבית בדקות',
  perMinute: 'הודעות בדקה',
  burstLbl: 'פרץ ב-10 שניות',
  wiskeyUnknown: 'מוני WisKey לא ידועים',
  reason_unread: 'לא נקרא עדיין מ-WisKey',
  reason_stale: 'הקריאה האחרונה מ-WisKey ישנה',
  reason_unsupported: 'גרסת WisKey הזו אינה מדווחת את מוני השליחה',
  reason_error: 'הקריאה מ-WisKey נכשלה',
  reason_invalid: 'התשובה מ-WisKey לא שמישה',
  reason_truncated: 'WisKey שלח רק חלק מהשולחים שלו',
  reason_absent: 'WisKey לא כלל את השולח הזה',
  reason_unverified: 'השולח לא הותאם בוודאות לשולח של WisKey',
  reason_incomplete: 'מוני WisKey לשולח הזה חלקיים',
  reason_unreserved: 'הודעות ש-WisKey שלח בלי להזמין מקום אינן ידועות',
  reason_other: 'מוני WisKey אינם ידועים',
  err_minute: 'ערך בין 1 ל-120',
  err_burst: 'ערך בין 1 ל-60',
  cls_alert: 'התראות',
  cls_code: 'קודי אימות',
  cls_ticket: 'הודעות',
  cls_reminder: 'תזכורות',
  budget: '{n} בדקה · פרץ {b}',
  sentHour: 'נשלחו בשעה האחרונה',
  wiskeyHour: 'מהן WisKey',
  waiting: 'ממתינות',
  oldest: 'ההמתנה הארוכה ביותר',
  deferred: 'נדחו ב-24 שעות',
  slowed: 'האטות מהפלטפורמה',
  expired: 'הסתיימו בלי שליחה',
  backoffUntil: 'מואט עד {time}',
  pairs: 'נמענים מואטים: {n}',
  noAccounts: 'אין חשבונות',
  unit_s: '{n} שנ׳',
  unit_m: '{n} דק׳',
  unit_h: '{n} שע׳',
  saved: 'נשמר',
  retry: 'נסו שוב',
  err_range: 'ערך בין 1 ל-2880',
  loadError: 'לא ניתן לטעון את הקצב',
};

type Key = keyof typeof he;

const en: Record<Key, string> = packTable<typeof import('./lang/en/i18n/messaging-pacing').en>('en', 'i18n/messaging-pacing', 'en');

const ar: Record<Key, string> = packTable<typeof import('./lang/ar/i18n/messaging-pacing').ar>('ar', 'i18n/messaging-pacing', 'ar');

const ru: Record<Key, string> = packTable<typeof import('./lang/ru/i18n/messaging-pacing').ru>('ru', 'i18n/messaging-pacing', 'ru');

export type MpKey = Key;
export const MP_TABLES: Record<Lang, Record<Key, string>> = { he, en, ar, ru };
/** The columns that are an initial, unreviewed translation. */
export const MP_DEV_MARKED: readonly Lang[] = ['ar', 'ru'];
export const MP_KEYS = Object.keys(he) as Key[];

export function mpLang(): Lang {
  return docLang(['en', 'ar', 'ru']);
}

export function mp(key: Key, vars?: Record<string, string | number>, lang: Lang = mpLang()): string {
  const raw = MP_TABLES[lang][key] ?? he[key] ?? key;
  return fill(raw, vars);
}

registerCatalogue('i18n/messaging-pacing', { he, en, ar, ru }, MP_DEV_MARKED);
