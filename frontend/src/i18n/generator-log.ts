/**
 * GENLOG092-295: the words of the generator run log (Infrastructure > Generator > run log) and of its settings section. Hebrew first; the
 * English column follows the document language; Arabic and Russian are an INITIAL translation of the main words (dev-marked) - a missing key
 * falls back to the Hebrew. `{n}` style placeholders are filled by `glt(key, vars)`. Operator words only: the home platform is never named.
 */
const he = {
  page: 'יומן הפעלות',
  title: 'יומן הפעלות הגנרטור',
  sub: 'כל הפעלה של המנוע, נגזרת מקריאות הבקר. צפייה בלבד.',
  r7d: '7 ימים',
  r30d: '30 יום',
  r90d: '90 יום',
  r365d: 'שנה',
  kindAll: 'כל הסוגים',
  kind_test: 'מבחן',
  kind_mains_failure: 'הפסקת רשת',
  kind_manual: 'ידני',
  kind_other: 'אחר',
  kpiRuns: 'הפעלות',
  kpiHours: 'שעות עבודה',
  kpiFuel: 'דלק שנצרך',
  kpiRefills: 'מילויי דלק',
  kpiLastTest: 'מבחן אחרון',
  kpiCounter: 'מונה שעות הבקר',
  byKind: '{t} מבחנים · {m} הפסקות רשת · {o} אחרות',
  noTest: 'לא נרשם מבחן',
  testOverdue: 'מבחן באיחור',
  testDue: 'הבא עד {t}',
  runningNow: 'הגנרטור פועל עכשיו · {kind} · {d}',
  colStart: 'התחלה',
  colKind: 'סוג',
  colDur: 'משך',
  colHours: 'שעות',
  colFuel: 'דלק',
  colLoad: 'עומס',
  colEnd: 'סיום',
  open: 'פועל',
  noLoad: 'ללא עומס',
  loadPeak: 'שיא {n}%',
  loaded: 'בעומס',
  short: 'מבחן קצר',
  noData: 'נסגר ללא נתונים',
  empty: 'לא נרשמו הפעלות בטווח',
  emptyBody: 'היומן מתמלא אוטומטית מרגע שהגנרטור פועל.',
  page_of: 'עמוד {p} מתוך {n}',
  prev: 'הקודם',
  next: 'הבא',
  fuelTitle: 'אירועי דלק',
  fuelRefill: 'מילוי {a}% ← {b}%',
  fuelDrop: 'ירידה במנוחה {a}% ← {b}%',
  fuelNone: 'אין אירועי דלק בטווח',
  min: 'דק׳',
  h: 'ש׳',
  why_mode_test: 'הבקר במצב מבחן',
  why_start_reason: 'לפי סיבת ההתנעה בבקר',
  why_mains_lost: 'הרשת נפלה',
  why_mode_manual: 'הבקר במצב ידני',
  why_unloaded: 'ריצה ללא עומס כשהרשת תקינה',
  why_none: 'ללא סימן מזהה',
  loadError: 'לא ניתן לטעון את יומן ההפעלות',
  off: 'יומן ההפעלות כבוי',
  // settings (Settings > Infrastructure > Generator > run log)
  setSub: 'יומן הפעלות',
  setIntro: 'יומן ההפעלות נגזר מקריאות הבקר ואינו שולח דבר לבקר. כל הספים והחלונות כאן.',
  setEnabled: 'הצגת יומן ההפעלות במסך הגנרטור',
  set_min_run_s: 'ריצה קצרה מזה אינה נרשמת (שניות)',
  set_mains_lookback_s: 'הרשת נפלה עד כך לפני ההתנעה = הפסקת רשת (שניות)',
  set_test_min_minutes: 'מבחן קצר מזה מסומן "מבחן קצר" (דקות)',
  set_test_max_minutes: 'ריצה ללא עומס ארוכה מזה אינה מבחן (דקות)',
  set_classify_unloaded_as_test: 'ריצה ללא עומס כשהרשת תקינה נחשבת מבחן',
  set_test_interval_days: 'מרווח המבחנים הצפוי (ימים, 0 = ללא מעקב)',
  set_no_data_close_min: 'ריצה ללא קריאות נסגרת אחרי (דקות)',
  set_refill_min_pct: 'עלייה במפלס שנחשבת מילוי (%)',
  set_refill_settle_min: 'המילוי נסגר אחרי שהמפלס יציב (דקות)',
  set_drop_min_pct: 'ירידה במנוחה שנרשמת לבדיקה (%)',
  set_fuel_window_h: 'חלון ההשוואה של מפלס הדלק (שעות)',
  set_retention_days: 'שמירת היומן (ימים)',
};

type Key = keyof typeof he;

const en: Partial<Record<Key, string>> = {
  page: 'Run log',
  title: 'Generator run log',
  sub: 'Every engine run, derived from the controller readings. View only.',
  r7d: '7 days',
  r30d: '30 days',
  r90d: '90 days',
  r365d: 'Year',
  kindAll: 'All kinds',
  kind_test: 'Test',
  kind_mains_failure: 'Mains failure',
  kind_manual: 'Manual',
  kind_other: 'Other',
  kpiRuns: 'Runs',
  kpiHours: 'Run hours',
  kpiFuel: 'Fuel used',
  kpiRefills: 'Refills',
  kpiLastTest: 'Last test',
  kpiCounter: 'Controller hour meter',
  byKind: '{t} tests · {m} mains failures · {o} other',
  noTest: 'No test recorded',
  testOverdue: 'Test overdue',
  testDue: 'Next by {t}',
  runningNow: 'The generator is running now · {kind} · {d}',
  colStart: 'Start',
  colKind: 'Kind',
  colDur: 'Duration',
  colHours: 'Hours',
  colFuel: 'Fuel',
  colLoad: 'Load',
  colEnd: 'End',
  open: 'Running',
  noLoad: 'No load',
  loadPeak: 'Peak {n}%',
  loaded: 'On load',
  short: 'Short test',
  noData: 'Closed without data',
  empty: 'No runs in this range',
  emptyBody: 'The log fills itself as soon as the generator runs.',
  page_of: 'Page {p} of {n}',
  prev: 'Previous',
  next: 'Next',
  fuelTitle: 'Fuel events',
  fuelRefill: 'Refill {a}% → {b}%',
  fuelDrop: 'Drop at rest {a}% → {b}%',
  fuelNone: 'No fuel events in this range',
  min: 'min',
  h: 'h',
  why_mode_test: 'Controller in test mode',
  why_start_reason: 'From the controller start reason',
  why_mains_lost: 'Mains lost',
  why_mode_manual: 'Controller in manual mode',
  why_unloaded: 'Unloaded run with the mains present',
  why_none: 'No identifying signal',
  loadError: 'The run log could not be loaded',
  off: 'The run log is off',
  setSub: 'Run log',
  setIntro: 'The run log is derived from the controller readings and never sends anything to the controller. Every threshold and window is here.',
  setEnabled: 'Show the run log on the generator screen',
  set_min_run_s: 'A run shorter than this is not logged (seconds)',
  set_mains_lookback_s: 'Mains lost this long before the start = mains failure (seconds)',
  set_test_min_minutes: 'A test shorter than this is marked "short test" (minutes)',
  set_test_max_minutes: 'An unloaded run longer than this is not a test (minutes)',
  set_classify_unloaded_as_test: 'An unloaded run with the mains present counts as a test',
  set_test_interval_days: 'Expected test interval (days, 0 = not tracked)',
  set_no_data_close_min: 'A run without readings closes after (minutes)',
  set_refill_min_pct: 'A level rise that counts as a refill (%)',
  set_refill_settle_min: 'A refill closes once the level is stable (minutes)',
  set_drop_min_pct: 'A drop at rest logged for a check (%)',
  set_fuel_window_h: 'Fuel level comparison window (hours)',
  set_retention_days: 'Keep the log (days)',
};

// initial translation - needs a native review (dev-marked)
const ar: Partial<Record<Key, string>> = {
  page: 'سجل التشغيل',
  title: 'سجل تشغيل المولد',
  kind_test: 'اختبار',
  kind_mains_failure: 'انقطاع الشبكة',
  kind_manual: 'يدوي',
  kind_other: 'آخر',
  kpiRuns: 'مرات التشغيل',
  kpiHours: 'ساعات العمل',
  kpiFuel: 'الوقود المستهلك',
  empty: 'لا توجد مرات تشغيل في النطاق',
  prev: 'السابق',
  next: 'التالي',
};

// initial translation - needs a native review (dev-marked)
const ru: Partial<Record<Key, string>> = {
  page: 'Журнал запусков',
  title: 'Журнал запусков генератора',
  kind_test: 'Тест',
  kind_mains_failure: 'Отключение сети',
  kind_manual: 'Вручную',
  kind_other: 'Другое',
  kpiRuns: 'Запуски',
  kpiHours: 'Моточасы',
  kpiFuel: 'Израсходовано топлива',
  empty: 'Нет запусков в диапазоне',
  prev: 'Назад',
  next: 'Далее',
};

export type GltKey = Key;
export type GltLang = 'he' | 'en' | 'ar' | 'ru';

export function gltLang(): GltLang {
  const l = typeof document !== 'undefined' ? (document.documentElement.lang || '').toLowerCase() : '';
  return l.startsWith('en') ? 'en' : l.startsWith('ar') ? 'ar' : l.startsWith('ru') ? 'ru' : 'he';
}

const TABLES: Record<GltLang, Partial<Record<Key, string>>> = { he, en, ar, ru };
/** The columns that are an initial, unreviewed translation. */
export const GLT_DEV_MARKED: readonly GltLang[] = ['ar', 'ru'];

export function glt(key: Key, vars?: Record<string, string | number>, lang: GltLang = gltLang()): string {
  const raw = TABLES[lang][key] ?? he[key] ?? key;
  return vars ? raw.replace(/\{(\w+)\}/g, (m, k: string) => (k in vars ? String(vars[k]) : m)) : raw;
}

export const GLT_KEYS = Object.keys(he) as Key[];
export const GLT_TABLES = TABLES;
