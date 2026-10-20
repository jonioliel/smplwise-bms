/**
 * GENALERT-295: the words added to Settings > Infrastructure > Generator > alert routing - the default recipients per severity, the first-run
 * "nobody is set" state and the one-line notes next to the critical row. Hebrew first; English, Arabic and Russian columns follow the document
 * language (a missing key falls back to the Hebrew). The Arabic and Russian columns are an INITIAL translation and need a native review (dev-marked).
 * `{n}` placeholders are filled by `grt(key, { n })`. Operator words only: the home platform is never named.
 */
const he = {
  emptyTitle: 'לא נבחרו נמענים להתראות הגנרטור',
  emptyCritical: 'רק התראה קריטית שלא אושרה מגיעה למנהלי המערכת, אחרי {n} דקות',
  defaultsTitle: 'ברירת מחדל לפי חומרה',
  defaultsSub: 'סוג התראה ללא נמענים משלו מקבל את בחירת החומרה שלו',
  criticalNote: 'התראה קריטית תמיד מסלימה למנהלי המערכת אחרי {n} דקות, גם כשההסלמה כבויה',
  criticalQuiet: 'התראה קריטית אינה נעצרת בשעות שקט',
  criticalDelay: 'דקות עד הסלמה של התראה קריטית',
  editDefault: 'ברירת מחדל: {name}',
  inheritedFrom: 'מהחומרה',
  colEscalate: 'הסלמה',
  always: 'תמיד',
  saved: 'נשמר',
};
type Key = keyof typeof he;

const en: Partial<Record<Key, string>> = {
  emptyTitle: 'No one is set to receive generator alerts',
  emptyCritical: 'Only an unacknowledged critical alert reaches the system administrators, after {n} min',
  defaultsTitle: 'Default by severity',
  defaultsSub: 'An alert type with no recipients of its own uses the choice for its severity',
  criticalNote: 'A critical alert always escalates to the system administrators after {n} min, even when escalation is off',
  criticalQuiet: 'A critical alert is never held by quiet hours',
  criticalDelay: 'Minutes until a critical alert escalates',
  editDefault: 'Default: {name}',
  inheritedFrom: 'from severity',
  colEscalate: 'Escalation',
  always: 'Always',
  saved: 'Saved',
};

// initial translation - needs a native review (dev-marked)
const ar: Partial<Record<Key, string>> = {
  emptyTitle: 'لم يتم تحديد مستلمين لتنبيهات المولد',
  emptyCritical: 'التنبيه الحرج غير المؤكَّد فقط يصل إلى مديري النظام بعد {n} دقيقة',
  defaultsTitle: 'الإعداد الافتراضي حسب الخطورة',
  defaultsSub: 'نوع التنبيه بدون مستلمين خاصين يستخدم اختيار خطورته',
  criticalNote: 'التنبيه الحرج يُصعَّد دائمًا إلى مديري النظام بعد {n} دقيقة، حتى عند إيقاف التصعيد',
  criticalQuiet: 'التنبيه الحرج لا يتوقف في ساعات الهدوء',
  criticalDelay: 'دقائق حتى تصعيد التنبيه الحرج',
  editDefault: 'افتراضي: {name}',
  inheritedFrom: 'من الخطورة',
  colEscalate: 'التصعيد',
  always: 'دائمًا',
  saved: 'تم الحفظ',
};

// initial translation - needs a native review (dev-marked)
const ru: Partial<Record<Key, string>> = {
  emptyTitle: 'Получатели оповещений генератора не выбраны',
  emptyCritical: 'Только неподтверждённое критическое оповещение доходит до администраторов системы, через {n} мин',
  defaultsTitle: 'По умолчанию по важности',
  defaultsSub: 'Тип оповещения без своих получателей использует выбор для своей важности',
  criticalNote: 'Критическое оповещение всегда передаётся администраторам системы через {n} мин, даже при выключенной эскалации',
  criticalQuiet: 'Критическое оповещение не задерживается в тихие часы',
  criticalDelay: 'Минут до эскалации критического оповещения',
  editDefault: 'По умолчанию: {name}',
  inheritedFrom: 'по важности',
  colEscalate: 'Эскалация',
  always: 'Всегда',
  saved: 'Сохранено',
};

export type GrtKey = Key;
export type GrtLang = 'he' | 'en' | 'ar' | 'ru';

export function grtLang(): GrtLang {
  const l = typeof document !== 'undefined' ? (document.documentElement.lang || '').toLowerCase() : '';
  return l.startsWith('en') ? 'en' : l.startsWith('ar') ? 'ar' : l.startsWith('ru') ? 'ru' : 'he';
}

const TABLES: Record<GrtLang, Partial<Record<Key, string>>> = { he, en, ar, ru };
/** The columns that are an initial, unreviewed translation. */
export const GRT_DEV_MARKED: readonly GrtLang[] = ['ar', 'ru'];

export function grt(key: Key, vars?: Record<string, string | number>, lang: GrtLang = grtLang()): string {
  const raw = TABLES[lang][key] ?? he[key] ?? key;
  return vars ? raw.replace(/\{(\w+)\}/g, (m, k: string) => (k in vars ? String(vars[k]) : m)) : raw;
}

export const GRT_KEYS = Object.keys(he) as Key[];
export const GRT_TABLES = TABLES;
