/**
 * POLISH-295 (owner approval 2026-10-25): the words of the polished home screen, the schedules and automations lists (rows, pages) and
 * their settings. Hebrew first; English, Arabic and Russian follow the document language. The Arabic and Russian columns are an INITIAL
 * translation and need a native review.
 */
const he = {
  prev: 'הקודם',
  next: 'הבא',
  pageOf: 'עמוד {n} מתוך {m}',
  pages: 'דפדוף',
  rows: 'שורות',
  review: 'לבדיקה',
  select: 'בחירה מרובה',
  selectDone: 'סיום בחירה',
  candles: 'כניסת שבת',
  havdalah: 'צאת שבת',
  alarm: 'אזעקה',
  listsHeading: 'תצוגת הרשימה',
  defaultView: 'תצוגת ברירת מחדל',
  perPageWide: 'פריטים בעמוד · מחשב',
  perPagePhone: 'פריטים בעמוד · טלפון',
  infoHeading: 'שעון, מזג אוויר ושבת',
  infoBar: 'שורה דקה',
  infoCards: 'ווידג׳טים',
  saved: 'נשמר',
  readOnly: 'שינוי ההגדרות דורש הרשאת מנהל מערכת.',
  lastRun: 'ריצה אחרונה',
  nextRun: 'הרצה הבאה',
};
type Key = keyof typeof he;

const en: Record<Key, string> = {
  prev: 'Previous',
  next: 'Next',
  pageOf: 'Page {n} of {m}',
  pages: 'Pages',
  rows: 'Rows',
  review: 'To review',
  select: 'Select several',
  selectDone: 'Done selecting',
  candles: 'Shabbat begins',
  havdalah: 'Shabbat ends',
  alarm: 'Alarm',
  listsHeading: 'List display',
  defaultView: 'Default view',
  perPageWide: 'Items per page · desktop',
  perPagePhone: 'Items per page · phone',
  infoHeading: 'Clock, weather and Shabbat',
  infoBar: 'Thin row',
  infoCards: 'Widgets',
  saved: 'Saved',
  readOnly: 'Changing these settings needs a system administrator.',
  lastRun: 'Last run',
  nextRun: 'Next run',
};

const ar: Record<Key, string> = {
  prev: 'السابق',
  next: 'التالي',
  pageOf: 'صفحة {n} من {m}',
  pages: 'الصفحات',
  rows: 'صفوف',
  review: 'للمراجعة',
  select: 'تحديد متعدد',
  selectDone: 'إنهاء التحديد',
  candles: 'دخول السبت',
  havdalah: 'خروج السبت',
  alarm: 'الإنذار',
  listsHeading: 'عرض القائمة',
  defaultView: 'العرض الافتراضي',
  perPageWide: 'عناصر في الصفحة · حاسوب',
  perPagePhone: 'عناصر في الصفحة · هاتف',
  infoHeading: 'الساعة والطقس والسبت',
  infoBar: 'صف رفيع',
  infoCards: 'ودجات',
  saved: 'تم الحفظ',
  readOnly: 'تغيير هذه الإعدادات يتطلب مدير النظام.',
  lastRun: 'آخر تشغيل',
  nextRun: 'التشغيل التالي',
};

const ru: Record<Key, string> = {
  prev: 'Назад',
  next: 'Вперёд',
  pageOf: 'Страница {n} из {m}',
  pages: 'Страницы',
  rows: 'Строки',
  review: 'На проверку',
  select: 'Выбрать несколько',
  selectDone: 'Готово',
  candles: 'Начало шаббата',
  havdalah: 'Конец шаббата',
  alarm: 'Сигнализация',
  listsHeading: 'Вид списка',
  defaultView: 'Вид по умолчанию',
  perPageWide: 'Элементов на странице · компьютер',
  perPagePhone: 'Элементов на странице · телефон',
  infoHeading: 'Часы, погода и шаббат',
  infoBar: 'Тонкая строка',
  infoCards: 'Виджеты',
  saved: 'Сохранено',
  readOnly: 'Изменение настроек требует администратора системы.',
  lastRun: 'Последний запуск',
  nextRun: 'Следующий запуск',
};

export type PlLang = 'he' | 'en' | 'ar' | 'ru';

export function plLang(): PlLang {
  const l = typeof document !== 'undefined' ? (document.documentElement.lang || '').toLowerCase() : '';
  return l.startsWith('en') ? 'en' : l.startsWith('ar') ? 'ar' : l.startsWith('ru') ? 'ru' : 'he';
}

const TABLES: Record<PlLang, Record<Key, string>> = { he, en, ar, ru };
/** The columns that are an initial, unreviewed translation. */
export const PL_DEV_MARKED: readonly PlLang[] = ['ar', 'ru'];

/** One phrase; `{n}`-style holes are filled from `vars`. */
export function pl(key: Key, vars: Record<string, string | number> = {}, lang: PlLang = plLang()): string {
  let s = TABLES[lang][key] ?? he[key];
  for (const [k, v] of Object.entries(vars)) s = s.replace(`{${k}}`, String(v));
  return s;
}

export const PL_KEYS = Object.keys(he) as Key[];
export const PL_TABLES = TABLES;
