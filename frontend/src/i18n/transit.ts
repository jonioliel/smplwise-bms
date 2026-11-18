/**
 * BUSTIMES-295: the words of הגדרות › תחבורה ציבורית (the installation's stops and rules) and of the per-screen block in the board's תצוגה tab.
 * Hebrew first; English follows the document language (a missing key falls back to the Hebrew). `{x}` placeholders are filled by `tr(key, { x })`.
 * The TV page has its own few strings (src/notice-tv/transit-logic.ts). Operator screens never name the home platform.
 */
import { docLang, fill, registerCatalogue } from './core';
import { NAV_TR } from './nav-labels'; // CR-NAV-LABELS-2436: the shell's label lives there
import { packTable, withEntries } from './lang-packs';

const he = {
  tab: NAV_TR.he.tab,
  title: 'תחבורה ציבורית',
  sub: 'זמני אוטובוסים בתחנות ליד הבניין, בלוחות ההודעות (לפי לוח זמנים)',
  forbidden: 'אין הרשאה',
  forbiddenHint: 'הגדרות תחבורה ציבורית דורשות הרשאת הגדרת מערכת או ניהול לוחות.',
  loadError: 'לא ניתן לטעון את ההגדרות',
  retry: 'ניסיון חוזר',
  saved: 'נשמר',
  saveError: 'השמירה נכשלה',
  moduleCard: 'הפעלה',
  moduleOn: 'פועל',
  moduleOff: 'כבוי',
  moduleHint: 'כבוי כברירת מחדל. כשהמודול פועל, מסך שביקשת בו תחבורה ציבורית מציג את הזמנים; שום מסך אינו פונה למקור חיצוני - המערכת מעדכנת פעם בדקה ושומרת עותק.',
  stopsCard: 'תחנות הבניין',
  stopsHint: 'עד {n} תחנות. כל מסך בוחר מתוכן מה להציג.',
  stopsEmpty: 'עוד לא נבחרו תחנות. חפשו תחנה לפי עיר ושם, או לפי קוד התחנה, והוסיפו אותה.',
  stopCode: 'קוד {c}',
  displayName: 'שם לתצוגה',
  remove: 'הסרה',
  up: 'למעלה',
  down: 'למטה',
  searchCard: 'חיפוש תחנה',
  city: 'עיר',
  cityAny: 'כל הערים',
  nameFilter: 'שם הרחוב או התחנה',
  codeFilter: 'או קוד תחנה',
  search: 'חיפוש',
  noResults: 'לא נמצאו תחנות',
  add: 'הוספה',
  added: 'נוספה',
  limit: 'הגעתם למספר התחנות המרבי',
  resultsMore: 'מוצגות הראשונות - צמצמו את החיפוש',
  catalogueCard: 'קטלוג התחנות',
  catalogueEmpty: 'הקטלוג עדיין לא הורד. ההורדה הראשונה מתבצעת כשהמודול פועל, או בלחיצה על "רענון עכשיו".',
  catalogueInfo: '{n} תחנות · נכון ל-{d}',
  catalogueNightly: 'מתעדכן אוטומטית בכל לילה בשעה 04:00',
  catalogueError: 'ההורדה האחרונה נכשלה ({e}) - הקטלוג הקודם נשאר בתוקף',
  refreshNow: 'רענון עכשיו',
  refreshing: 'מרענן...',
  generalCard: 'כללים',
  clockAfter: 'מעבר לשעון',
  clockAfterHint: 'דקות עד שעה מוצגות כספירה; מכאן והלאה - שעת הגעה (0 = תמיד שעה)',
  grace: 'נתונים אחרונים כשהמקור לא עונה',
  graceHint: 'כל עוד המקור או הבניין מנותקים, מוצגים הזמנים האחרונים לפי לוח זמנים עד פרק הזמן הזה, ואז "אינו זמין" (0 = לא מציגים)',
  hideCloser: 'זמן הליכה לתחנה',
  hideCloserHint: 'אוטובוסים שמגיעים בעוד פחות מכך אינם מוצגים (0 = מציגים הכול)',
  minutes: 'דקות',
  hours: 'שעות',
  outageWarn: 'התראה על תקלה ממושכת במקור הנתונים',
  outageWarnHint: 'תקלה אצל ספק הנתונים החיצוני מוצגת כמצב רגוע ("מקור הנתונים אינו זמין"). רק אם נמשכה יותר מפרק הזמן הזה, בריאות המערכת תציג אזהרה',
  seconds: 'שניות',
  refreshCard: 'רענון הנתונים',
  refreshS: 'רענון המסך',
  refreshSHint: 'כל כמה שניות המסך קורא מהשרת את הזמנים (מהמטמון של השרת בלבד; בין קריאות הספירה ממשיכה לבד). כל מסך יכול לקבוע ערך משלו.',
  pollS: 'בדיקת המקור הציבורי',
  pollSHint: 'כל כמה שניות השרת שואל את המקור הציבורי, בקשה אחת לכל תחנה (ברירת מחדל 30). המקור הוא שירות קהילתי - מתחת ל-30 שניות רק באישור מפורש.',
  pollAck: 'אני מאשר לרדת מתחת ל-30 שניות (עומס על שירות קהילתי)',
  positionFresh: 'תוקף מיקום האוטובוס',
  positionFreshHint: 'מיקום ישן מזה אינו מוצג כהערכה ואין לצידו מרחק; מוצג הזמן לפי לוח זמנים.',
  showDistance: 'להציג מרחק האוטובוס מהתחנה',
  showDistanceHint: 'בשורה של הערכה: "800 מ׳ מהתחנה · הערכה בעוד 3 דק׳". כל מסך יכול לשנות.',
  healthCard: 'מצב המקור',
  st_off: 'לא בשימוש',
  st_ok: 'תקין',
  st_stale: 'לא מתעדכן - מוצגים נתונים אחרונים',
  st_down: 'לא זמין',
  lastOk: 'עדכון אחרון',
  never: 'עדיין לא',
  dataAge: 'גיל הנתונים',
  ageMin: '{n} דקות',
  errorsCount: 'שגיאות מאז ההפעלה',
  lastError: 'שגיאה אחרונה',
  codesInUse: 'תחנות בשימוש',
  backoff: 'המערכת ממתינה לפני ניסיון נוסף',
  // POLISH4-WP8 (owner-approved 02.11): the health card's "check now" and the idle / stale wording
  st_source_down: 'המקור החיצוני לא זמין',
  checkNow: 'בדוק עכשיו',
  checking: 'בודק…',
  checkOk: 'המקור ענה עכשיו ({n} תחנות נבדקו).',
  checkFail: 'המקור לא ענה עכשיו: {e}',
  checkWait: 'המקור ביקש להמתין עוד {ago} לפני ניסיון נוסף. לא נשלחה בקשה.',
  checkNoStops: 'אין תחנות מוגדרות לבדיקה.',
  checkedAt: 'נבדק ב־{t}',
  idleNote: 'אף מסך לא מציג כרגע את התחנות - הנתונים נבדקים רק כשמסך מציג אותן. "בדוק עכשיו" שואל את המקור פעם אחת.',
  lastGood: 'הצלחה אחרונה',
  errorAgo: 'לפני {ago}: {e}',
  agoOnly: 'לפני {ago}',
  agoMinute: 'דקה',
  agoMinutes: '{n} דקות',
  agoHour: 'שעה',
  agoHours: '{n} שעות',
  agoDay: 'יום',
  agoDays: '{n} ימים',
  err_http_503: 'המקור לא זמין (503)',
  err_http: 'המקור החזיר שגיאה ({c})',
  err_unreachable: 'המקור לא ענה בזמן',
  err_other: 'תשובה לא תקינה מהמקור ({c})',
  // the per-screen block (the board's תצוגה tab)
  scrTitle: 'תחבורה ציבורית',
  scrShow: 'להציג זמני אוטובוסים במסך זה',
  scrOffModule: 'המודול כבוי או שאין תחנות - מגדירים בהגדרות ‹ תחבורה ציבורית.',
  scrGo: 'להגדרות תחבורה ציבורית',
  scrStops: 'תחנות',
  scrStopsAll: 'כל התחנות שהוגדרו',
  scrLayout: 'פריסה',
  lay_side: 'עמודה צדדית',
  lay_strip: 'פס תחתון',
  lay_slide: 'שקף מתחלף',
  lay_side_hint: 'כרטיס מתחת לשעון; ההודעה נשארת בצד',
  lay_strip_hint: 'כרטיסים מתחת להודעה',
  lay_slide_hint: 'שקף משלו בסבב, עמודה לכל תחנה (במצב סבב)',
  scrWindow: 'חלון זמן',
  scrWindowFree: 'ערך חופשי (דקות)',
  scrRows: 'שורות',
  scrGroup: 'קיבוץ לפי קו',
  grp_auto: 'אוטומטי כשיש יותר הגעות משורות',
  grp_always: 'תמיד',
  grp_never: 'אף פעם',
  scrDwell: 'שניות בשקף',
  scrRefresh: 'רענון (שניות)',
  scrRefreshInherit: 'כמו בהגדרות ({n})',
  scrDistance: 'מרחק מהתחנה',
  scrDistInherit: 'כמו בהגדרות',
  scrDistOn: 'מציגים',
  scrDistOff: 'לא מציגים',
  scrFree: 'חלון בדקות, {a}-{b}',
};

const en: Partial<Record<keyof typeof he, string>> = withEntries(packTable<typeof import('./lang/en/i18n/transit').en>('en', 'i18n/transit', 'en'), {
  tab: NAV_TR.en.tab,
});

export type TrKey = keyof typeof he;
const TABLES: Record<'he' | 'en', Partial<Record<TrKey, string>>> = { he, en };

export function trLang(): 'he' | 'en' {
  return docLang(['en']);
}

export function tr(key: TrKey, vars?: Record<string, string | number>, lang: 'he' | 'en' = trLang()): string {
  const raw = TABLES[lang][key] ?? he[key] ?? key;
  return fill(raw, vars);
}

export const TR_KEYS = Object.keys(he) as TrKey[];

registerCatalogue('i18n/transit', { he, en });
