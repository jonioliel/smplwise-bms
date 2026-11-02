/**
 * CR-QUIET103 + APP-SERVER-LEFTOVERS-2380: the words of the quiet-window settings card (הגדרות › התראות › חלון שקט). Hebrew first; English
 * follows the document language (a missing key falls back to the Hebrew). `{x}` placeholders are filled by `qwt(key, { x })`.
 */
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

const en: Partial<Record<Key, string>> = {
  title: 'Quiet window for a floor or an area',
  sub: 'One button on the floor or area header holds informational notifications for a while. Critical and safety notifications are never held.',
  enabled: 'Quiet window', enabledHint: 'Off by default. Switching it off ends every open window at once.', off: 'Off', on: 'On',
  defaultMinutes: 'Default length (minutes)', maxMinutes: 'Longest length (minutes)', minutesHint: '{lo} to {hi} minutes',
  muteAlerts: 'Also hold important notifications', muteAlertsHint: 'Off: only informational notifications are held',
  channels: 'Channels the window holds',
  channelsHint: 'Push only: the push to the phone and the browser is held; email, WhatsApp and announcements are sent as usual. The notification centre keeps everything either way.',
  ch_push: 'Push only', ch_all: 'All channels', save: 'Save', saved: 'Settings saved', readOnly: 'Changing these settings needs a system administrator.',
  demo: 'Demo data: the settings are saved against a server only.', errRange: 'A length from {lo} to {hi} minutes',
  errOverMax: 'The default length is longer than the longest length', confirmTitle: 'Save the quiet window settings?',
  confirmBody: 'The change applies at once to every floor and area.', confirmEnds: 'Switching it off ends every open quiet window now.',
  confirmGo: 'Save', cancel: 'Cancel', loadError: 'The quiet window settings could not be loaded',
};

export type QwtKey = Key;
const TABLES: Record<'he' | 'en', Partial<Record<Key, string>>> = { he, en };

export function qwtLang(): 'he' | 'en' {
  const l = typeof document !== 'undefined' ? (document.documentElement.lang || '').toLowerCase() : '';
  return l.startsWith('en') ? 'en' : 'he';
}

export function qwt(key: Key, vars?: Record<string, string | number>, lang: 'he' | 'en' = qwtLang()): string {
  const raw = TABLES[lang][key] ?? he[key] ?? key;
  return vars ? raw.replace(/\{(\w+)\}/g, (m, k: string) => (k in vars ? String(vars[k]) : m)) : raw;
}

export const QWT_KEYS = Object.keys(he) as Key[];
export const QWT_TABLES = TABLES;
