/**
 * DOORWIN2-295: the words of the doors HOME widget (door windows and the emergency entry). Hebrew first; English, Arabic and Russian columns follow
 * the document language (a missing key falls back to the Hebrew). The Arabic and Russian columns are an INITIAL translation and need a native
 * review (dev-marked). `{n}`, `{name}`, `{t}` placeholders are filled by `dwwt(key, { ... })`. Operator words only: the home platform and the
 * intercom platform are never named, and no sentence explains anything (a clean operator card).
 */
const he = {
  title: 'דלתות',
  emergency: 'חירום',
  emergencyAria: 'פתיחת לחצני החירום',
  incident: 'מצב חירום',
  drill: 'תרגיל חירום',
  unconfirmed: 'חזרה למצב רגיל לא אושרה: {n}',
  notStarted: 'חלון לא התחיל: {n}',
  foreign: 'תוכנית שהושהתה: {n}',
  openNow: 'פתוחות כעת: {n}',
  openUntil: '{name} · עד {t}',
  next: 'הבא: {name} · {t}',
  none: 'אין חלונות מתוכננים',
  rowUnconfirmed: '{name} · לא אושר',
  rowNotStarted: '{name} · לא התחיל',
  rowForeign: '{name} · הושהתה',
  rowActive: '{name} · עד {t}',
  rowNext: '{name} · {t}',
};
type Key = keyof typeof he;

const en: Partial<Record<Key, string>> = {
  title: 'Doors',
  emergency: 'Emergency',
  emergencyAria: 'Open the emergency controls',
  incident: 'Emergency in effect',
  drill: 'Emergency drill',
  unconfirmed: 'Relock not confirmed: {n}',
  notStarted: 'Window did not start: {n}',
  foreign: 'Program paused: {n}',
  openNow: 'Open now: {n}',
  openUntil: '{name} · until {t}',
  next: 'Next: {name} · {t}',
  none: 'No windows planned',
  rowUnconfirmed: '{name} · not confirmed',
  rowNotStarted: '{name} · did not start',
  rowForeign: '{name} · paused',
  rowActive: '{name} · until {t}',
  rowNext: '{name} · {t}',
};

// initial translation - needs a native review (dev-marked)
const ar: Partial<Record<Key, string>> = {
  title: 'الأبواب',
  emergency: 'طوارئ',
  emergencyAria: 'فتح أزرار الطوارئ',
  incident: 'حالة طوارئ قائمة',
  drill: 'تدريب طوارئ',
  unconfirmed: 'لم تتم تأكيد العودة إلى الوضع العادي: {n}',
  notStarted: 'لم تبدأ النافذة: {n}',
  foreign: 'برنامج متوقف مؤقتًا: {n}',
  openNow: 'مفتوحة الآن: {n}',
  openUntil: '{name} · حتى {t}',
  next: 'التالي: {name} · {t}',
  none: 'لا توجد نوافذ مخططة',
  rowUnconfirmed: '{name} · غير مؤكد',
  rowNotStarted: '{name} · لم تبدأ',
  rowForeign: '{name} · متوقف مؤقتًا',
  rowActive: '{name} · حتى {t}',
  rowNext: '{name} · {t}',
};

// initial translation - needs a native review (dev-marked)
const ru: Partial<Record<Key, string>> = {
  title: 'Двери',
  emergency: 'Аварийный режим',
  emergencyAria: 'Открыть аварийные кнопки',
  incident: 'Аварийный режим включён',
  drill: 'Учебная тревога',
  unconfirmed: 'Возврат в обычный режим не подтверждён: {n}',
  notStarted: 'Окно не началось: {n}',
  foreign: 'Программа приостановлена: {n}',
  openNow: 'Открыты сейчас: {n}',
  openUntil: '{name} · до {t}',
  next: 'Далее: {name} · {t}',
  none: 'Окон не запланировано',
  rowUnconfirmed: '{name} · не подтверждено',
  rowNotStarted: '{name} · не началось',
  rowForeign: '{name} · приостановлено',
  rowActive: '{name} · до {t}',
  rowNext: '{name} · {t}',
};

export type DwwtKey = Key;
export type DwwtLang = 'he' | 'en' | 'ar' | 'ru';

export function dwwtLang(): DwwtLang {
  const l = typeof document !== 'undefined' ? (document.documentElement.lang || '').toLowerCase() : '';
  return l.startsWith('en') ? 'en' : l.startsWith('ar') ? 'ar' : l.startsWith('ru') ? 'ru' : 'he';
}

const TABLES: Record<DwwtLang, Partial<Record<Key, string>>> = { he, en, ar, ru };
/** The columns that are an initial, unreviewed translation. */
export const DWWT_DEV_MARKED: readonly DwwtLang[] = ['ar', 'ru'];

export function dwwt(key: Key, vars: Record<string, string | number> = {}, lang: DwwtLang = dwwtLang()): string {
  const text = TABLES[lang][key] ?? he[key];
  return text.replace(/\{(\w+)\}/g, (_m, k: string) => String(vars[k] ?? ''));
}

export const DWWT_KEYS = Object.keys(he) as Key[];
export const DWWT_TABLES = TABLES;
