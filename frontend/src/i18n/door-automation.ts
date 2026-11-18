/**
 * CR-AUTODOORS-295: the words of the "open a door" block in the automation editor (Devices › Automations › an automation › "Then").
 * Hebrew first; English, Arabic and Russian follow the document language (a missing key falls back to the Hebrew). The Arabic and Russian
 * columns are an INITIAL translation and need a native review (dev-marked, like the elevators). `{x}` placeholders are filled by
 * `dat(key, { x })`. The editor is an operator screen: no platform naming, no internal codes, short safe-by-default wording.
 */
import { docLang, fill, registerCatalogue } from './core';
import { packTable } from './lang-packs';
const he = {
  title: 'פתיחת דלת',
  sub: 'Arx פותחת את הדלת כשהאוטומציה רצה, רק בתנאים שלמטה',
  stateDraft: 'טיוטה · לא פעיל',
  stateArmed: 'פעיל',
  stateDisarmed: 'כבוי',
  off: 'כבוי בגרסה הזו',
  killed: 'כל פתיחות הדלתות מאוטומציות עצורות',
  add: 'הוספת פתיחת דלת',
  name: 'שם',
  doors: 'דלתות',
  doorsEmpty: 'אין דלתות שמותר לך להוסיף',
  doorNoOpen: 'אין לך הרשאה לפתוח דלת זו',
  doorOffline: 'לא מחוברת',
  windows: 'מתי מותר',
  windowAdd: 'הוספת חלון זמן',
  anyTime: 'בכל זמן',
  windowRemove: 'הסרה',
  from: 'מ־',
  to: 'עד',
  limits: 'מגבלות',
  cooldown: 'המתנה בין פתיחות (שניות)',
  perHour: 'פתיחות לדלת בשעה',
  perDay: 'פתיחות ביום',
  armDays: 'תוקף ההפעלה (ימים)',
  save: 'שמירה',
  edit: 'עריכה',
  arm: 'הפעלה',
  disarm: 'כיבוי',
  simulate: 'בדיקה',
  remove: 'מחיקה',
  cancel: 'ביטול',
  armTitle: 'להפעיל פתיחת דלת מאוטומציה?',
  armText: 'הדלתות שנבחרו ייפתחו בלי אדם ליד, בכל פעם שהאוטומציה רצה בחלונות הזמן שנבחרו. ההפעלה נרשמת על שמך ונכבית מעצמה אחרי {days} ימים, בכל שינוי ואם תאבד הרשאה.',
  armConfirm: 'הפעלה',
  removeTitle: 'למחוק את פתיחת הדלת?',
  armedBy: 'הופעל בידי {who} · עד {until}',
  disarmedWhy: 'כבוי: {why}',
  simTitle: 'תוצאת בדיקה',
  simWould: 'הייתה נשלחת פתיחה',
  simWouldNot: 'לא הייתה נשלחת פתיחה',
  simNothing: 'שום דבר לא נשלח',
  history: 'פעולות אחרונות',
  historyEmpty: 'עדיין לא רצה',
  saved: 'נשמר',
  loadError: 'לא ניתן לטעון',
  retry: 'נסה שוב',
  needDoor: 'יש לבחור לפחות דלת אחת',
  needWindow: 'יש להגדיר לפחות חלון זמן אחד',
  badWindow: 'שעת הסיום חייבת להיות אחרי שעת ההתחלה',
  saveFirst: 'יש לשמור את האוטומציה לפני הוספת פתיחת דלת',
  d0: 'ב׳',
  d1: 'ג׳',
  d2: 'ד׳',
  d3: 'ה׳',
  d4: 'ו׳',
  d5: 'ש׳',
  d6: 'א׳',
  // gates (simulation) and reasons
  g_armed: 'מופעל',
  g_feature: 'זמין בגרסה',
  g_kill: 'לא עצור',
  g_expiry: 'בתוקף',
  g_trigger: 'הופעל מעצמו',
  g_revision: 'האוטומציה לא שונתה',
  g_window: 'בתוך חלון הזמן',
  r_not_armed: 'לא מופעל',
  r_feature_off: 'כבוי בגרסה הזו',
  r_killed: 'עצור',
  r_arm_expired: 'תוקף ההפעלה פג',
  r_manual_trigger: 'הופעל ידנית - פתיחה רק מכפתור הדלת',
  r_item_changed: 'האוטומציה שונתה',
  r_item_missing: 'האוטומציה לא נמצאה',
  r_outside_window: 'מחוץ לחלון הזמן',
  r_clock_untrusted: 'אזור הזמן של המערכת לא תקין',
  r_door_unavailable: 'הדלת לא זמינה',
  r_armer_lost_authority: 'למי שהפעיל אין עוד הרשאה',
  r_cooldown: 'פתיחה קודמת לפני זמן קצר',
  r_rate_hour: 'הגיע למכסה השעתית',
  r_rate_day: 'הגיע למכסה היומית',
  r_storm: 'נעצר אחרי ניסיונות חוזרים',
  r_edited: 'ההגדרה שונתה',
  r_manual: 'כובה ידנית',
  r_deleted: 'נמחק',
  r_loop_risk: 'האוטומציה מופעלת מהדלת עצמה',
  r_triggers_unresolvable: 'לא ניתן לזהות מה מפעיל את האוטומציה',
  r_uncorroborated: 'ההפעלה לא אומתה מול מצב המערכת',
  r_door_rate_hour: 'הדלת הגיעה למכסה השעתית שלה',
  r_door_rate_day: 'הדלת הגיעה למכסה היומית שלה',
  r_restored: 'כובה אחרי שחזור גיבוי',
  o_sent: 'נשלח',
  o_refused: 'לא נשלח',
  o_unknown: 'לא ידוע אם נשלח',
  o_not_sent: 'לא נשלח',
  o_pending: 'בטיפול',
};

type Key = keyof typeof he;

const en: Partial<Record<Key, string>> = packTable<typeof import('./lang/en/i18n/door-automation').en>('en', 'i18n/door-automation', 'en');

const ar: Partial<Record<Key, string>> = packTable<typeof import('./lang/ar/i18n/door-automation').ar>('ar', 'i18n/door-automation', 'ar');

const ru: Partial<Record<Key, string>> = packTable<typeof import('./lang/ru/i18n/door-automation').ru>('ru', 'i18n/door-automation', 'ru');

export type DatKey = Key;
export type DatLang = 'he' | 'en' | 'ar' | 'ru';

export function datLang(): DatLang {
  return docLang(['en', 'ar', 'ru']);
}

const TABLES: Record<DatLang, Partial<Record<Key, string>>> = { he, en, ar, ru };
/** The columns that are an initial, unreviewed translation. */
export const DAT_DEV_MARKED: readonly DatLang[] = ['ar', 'ru'];

export function dat(key: Key, vars?: Record<string, string | number>, lang: DatLang = datLang()): string {
  const raw = TABLES[lang][key] ?? he[key] ?? key;
  return fill(raw, vars);
}

/** A server reason / gate / outcome code as words; an unknown code falls back to a neutral word, never the code itself. */
export function datCode(prefix: 'r' | 'g' | 'o', code: string | null | undefined, lang: DatLang = datLang()): string {
  const key = `${prefix}_${code ?? ''}` as Key;
  if (key in he) return dat(key, undefined, lang);
  return prefix === 'o' ? dat('o_refused', undefined, lang) : dat('r_not_armed', undefined, lang);
}

export const DAT_KEYS = Object.keys(he) as Key[];
export const DAT_TABLES = TABLES;

registerCatalogue('i18n/door-automation', { he, en, ar, ru }, DAT_DEV_MARKED);
