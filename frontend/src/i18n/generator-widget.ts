/**
 * GENWIDGET 2.9.3: the words of the generator HOME widget. Hebrew first; English, Arabic and Russian columns follow the document language
 * (a missing key falls back to the Hebrew). The Arabic and Russian columns are an INITIAL translation and need a native review (dev-marked).
 * `{n}` placeholders are filled by `gwt(key, { n })`. Operator words only: the home platform is never named.
 */
const he = {
  title: 'גנרטור',
  stateStandby: 'בהמתנה',
  stateRunning: 'פועל',
  stateStarting: 'מתניע',
  stateCooling: 'בקירור',
  stateAlarm: 'התראה',
  stateFault: 'תקלה',
  stateUnknown: 'לא ידוע',
  supplyMains: 'על רשת החשמל',
  supplyGenerator: 'על גנרטור',
  supplyNone: 'אין חשמל רשת',
  supplyUnknown: 'מצב אספקה לא ידוע',
  summary: '{n} גנרטורים',
  summaryRunning: '{n} פועלים',
  summaryFault: '{n} בתקלה',
  fuel: 'דלק {n}%',
  load: 'עומס {n}%',
};
type Key = keyof typeof he;

const en: Partial<Record<Key, string>> = {
  title: 'Generator',
  stateStandby: 'Standby',
  stateRunning: 'Running',
  stateStarting: 'Starting',
  stateCooling: 'Cooling down',
  stateAlarm: 'Alert',
  stateFault: 'Fault',
  stateUnknown: 'Unknown',
  supplyMains: 'On mains',
  supplyGenerator: 'On generator',
  supplyNone: 'No mains power',
  supplyUnknown: 'Supply unknown',
  summary: '{n} generators',
  summaryRunning: '{n} running',
  summaryFault: '{n} in fault',
  fuel: 'Fuel {n}%',
  load: 'Load {n}%',
};

// initial translation - needs a native review (dev-marked)
const ar: Partial<Record<Key, string>> = {
  title: 'المولد',
  stateStandby: 'في وضع الاستعداد',
  stateRunning: 'يعمل',
  stateStarting: 'يبدأ التشغيل',
  stateCooling: 'يبرد',
  stateAlarm: 'تنبيه',
  stateFault: 'عطل',
  stateUnknown: 'غير معروف',
  supplyMains: 'على الشبكة',
  supplyGenerator: 'على المولد',
  supplyNone: 'لا توجد كهرباء الشبكة',
  supplyUnknown: 'مصدر التغذية غير معروف',
  summary: '{n} مولدات',
  summaryRunning: '{n} تعمل',
  summaryFault: '{n} معطلة',
  fuel: 'الوقود {n}%',
  load: 'الحمل {n}%',
};

// initial translation - needs a native review (dev-marked)
const ru: Partial<Record<Key, string>> = {
  title: 'Генератор',
  stateStandby: 'Ожидание',
  stateRunning: 'Работает',
  stateStarting: 'Запуск',
  stateCooling: 'Охлаждение',
  stateAlarm: 'Тревога',
  stateFault: 'Неисправность',
  stateUnknown: 'Неизвестно',
  supplyMains: 'От сети',
  supplyGenerator: 'От генератора',
  supplyNone: 'Нет сетевого питания',
  supplyUnknown: 'Питание неизвестно',
  summary: 'Генераторов: {n}',
  summaryRunning: 'Работают: {n}',
  summaryFault: 'Неисправны: {n}',
  fuel: 'Топливо {n}%',
  load: 'Нагрузка {n}%',
};

export type GwtKey = Key;
export type GwtLang = 'he' | 'en' | 'ar' | 'ru';

export function gwtLang(): GwtLang {
  const l = typeof document !== 'undefined' ? (document.documentElement.lang || '').toLowerCase() : '';
  return l.startsWith('en') ? 'en' : l.startsWith('ar') ? 'ar' : l.startsWith('ru') ? 'ru' : 'he';
}

const TABLES: Record<GwtLang, Partial<Record<Key, string>>> = { he, en, ar, ru };
/** The columns that are an initial, unreviewed translation. */
export const GWT_DEV_MARKED: readonly GwtLang[] = ['ar', 'ru'];

export function gwt(key: Key, vars?: Record<string, string | number>, lang: GwtLang = gwtLang()): string {
  const raw = TABLES[lang][key] ?? he[key] ?? key;
  return vars ? raw.replace(/\{(\w+)\}/g, (m, k: string) => (k in vars ? String(vars[k]) : m)) : raw;
}

export const GWT_KEYS = Object.keys(he) as Key[];
export const GWT_TABLES = TABLES;
