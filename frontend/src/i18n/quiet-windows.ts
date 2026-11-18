/**
 * CR-QUIET103 + APP-SERVER-LEFTOVERS-2380: the words of the quiet-window settings card (הגדרות › התראות › חלון שקט). Hebrew first; English
 * follows the document language (a missing key falls back to the Hebrew). `{x}` placeholders are filled by `qwt(key, { x })`.
 */
import { docLang, fill, registerCatalogue } from './core';
import { packTable } from './lang-packs';
const he = {
  title: 'חלון שקט לקומה או לאזור',
  sub: 'כפתור אחד בכותרת הקומה או האזור משהה התראות מידע לזמן קצוב. התראות קריטיות ובטיחות לא מושהות לעולם.',
  enabled: 'חלון שקט',
  enabledHint: 'כבוי כברירת מחדל. כיבוי מסיים מיד כל חלון פתוח.',
  off: 'כבוי',
  on: 'פעיל',
  defaultMinutes: 'משך ברירת מחדל (דקות)',
  maxMinutes: 'משך מרבי (דקות)',
  minutesHint: 'בין {lo} ל־{hi} דקות',
  muteAlerts: 'להשהות גם התראות חשובות',
  muteAlertsHint: 'כבוי: רק התראות מידע מושהות',
  channels: 'ערוצים שהחלון משהה',
  channelsHint: 'פוש בלבד: הדחיפה לטלפון ולדפדפן מושהית; דוא"ל, WhatsApp והכרזות נשלחים כרגיל. מרכז ההתראות שומר הכל בכל מקרה.',
  ch_push: 'פוש בלבד',
  ch_all: 'כל הערוצים',
  save: 'שמור',
  saved: 'ההגדרות נשמרו',
  readOnly: 'שינוי ההגדרות דורש הרשאת מנהל מערכת.',
  demo: 'נתוני הדגמה: ההגדרות נשמרות רק מול השרת.',
  errRange: 'משך בין {lo} ל־{hi} דקות',
  errOverMax: 'משך ברירת המחדל גדול מהמשך המרבי',
  confirmTitle: 'לשמור את הגדרות חלון השקט?',
  confirmBody: 'השינוי חל מיד על כל הקומות והאזורים.',
  confirmEnds: 'כיבוי החלון מסיים עכשיו כל חלון שקט פתוח.',
  confirmGo: 'שמור',
  cancel: 'ביטול',
  loadError: 'הגדרות חלון השקט לא נטענו',
};
type Key = keyof typeof he;

const en: Partial<Record<Key, string>> = packTable<typeof import('./lang/en/i18n/quiet-windows').en>('en', 'i18n/quiet-windows', 'en');

const TABLES: Record<'he' | 'en', Partial<Record<Key, string>>> = { he, en };

function qwtLang(): 'he' | 'en' {
  return docLang(['en']);
}

export function qwt(key: Key, vars?: Record<string, string | number>, lang: 'he' | 'en' = qwtLang()): string {
  const raw = TABLES[lang][key] ?? he[key] ?? key;
  return fill(raw, vars);
}

export const QWT_KEYS = Object.keys(he) as Key[];
export const QWT_TABLES = TABLES;

registerCatalogue('i18n/quiet-windows', { he, en });
