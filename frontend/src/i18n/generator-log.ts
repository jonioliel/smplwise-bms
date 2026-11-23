/**
 * GENLOG092-295: the words of the generator run log (Infrastructure > Generator > run log) and of its settings section. Hebrew first; the
 * English column follows the document language; Arabic and Russian are an INITIAL translation of the main words (dev-marked) - a missing key
 * falls back to the Hebrew. `{n}` style placeholders are filled by `glt(key, vars)`. Operator words only: the home platform is never named.
 */
import { docLang, fill, registerCatalogue } from './core';
import { packTable } from './lang-packs';
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
  set_min_run_s: 'ריצה קצרה מזה אינה נרשמת',
  set_mains_lookback_s: 'הרשת נפלה עד כך לפני ההתנעה = הפסקת רשת',
  set_test_min_minutes: 'מבחן קצר מזה מסומן "מבחן קצר"',
  set_test_max_minutes: 'ריצה ללא עומס ארוכה מזה אינה מבחן',
  set_classify_unloaded_as_test: 'ריצה ללא עומס כשהרשת תקינה נחשבת מבחן',
  set_test_interval_days: 'מרווח המבחנים הצפוי (0 = ללא מעקב)',
  set_no_data_close_min: 'ריצה ללא קריאות נסגרת אחרי',
  set_refill_min_pct: 'עלייה במפלס שנחשבת מילוי',
  set_refill_settle_min: 'המילוי נסגר אחרי שהמפלס יציב',
  set_drop_min_pct: 'ירידה במנוחה שנרשמת לבדיקה',
  set_fuel_window_h: 'חלון ההשוואה של מפלס הדלק',
  set_retention_days: 'שמירת היומן',
};

type Key = keyof typeof he;

const en: Partial<Record<Key, string>> = packTable<typeof import('./lang/en/i18n/generator-log').en>('en', 'i18n/generator-log', 'en');

// initial translation - needs a native review (dev-marked)
const ar: Partial<Record<Key, string>> = packTable<typeof import('./lang/ar/i18n/generator-log').ar>('ar', 'i18n/generator-log', 'ar');

// initial translation - needs a native review (dev-marked)
const ru: Partial<Record<Key, string>> = packTable<typeof import('./lang/ru/i18n/generator-log').ru>('ru', 'i18n/generator-log', 'ru');

export type GltKey = Key;
type GltLang = 'he' | 'en' | 'ar' | 'ru';

function gltLang(): GltLang {
  return docLang(['en', 'ar', 'ru']);
}

const TABLES: Record<GltLang, Partial<Record<Key, string>>> = { he, en, ar, ru };
/** The columns that are an initial, unreviewed translation. */
export const GLT_DEV_MARKED: readonly GltLang[] = ['ar', 'ru'];

export function glt(key: Key, vars?: Record<string, string | number>, lang: GltLang = gltLang()): string {
  const raw = TABLES[lang][key] ?? he[key] ?? key;
  return fill(raw, vars);
}

export const GLT_KEYS = Object.keys(he) as Key[];
export const GLT_TABLES = TABLES;

registerCatalogue('i18n/generator-log', { he, en, ar, ru }, GLT_DEV_MARKED);
