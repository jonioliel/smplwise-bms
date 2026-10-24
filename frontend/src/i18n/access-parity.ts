// CR-036 S12: the strings of the parity segment ("בדיקת התאמה") of the Settings page "בקרת כניסה" and of the stations-screen display
// card of "מתגי מסכי כניסה". Hebrew is the product language; the English column is used when the document language is English (a key
// missing there falls back to the Hebrew). A Settings page may name the integration; no internal code is shown as text.
const he = {
  title: 'השוואה למסכי האינטרקום',
  sub: 'לכל מסך: כמה רשומות יש באינטרקום, כמה מוצגות ב־Arx, ואם ההבדל נובע מההרשאות. מספרים בלבד - בלי שמות.',
  subject: 'עבור',
  subjectMe: 'אני',
  window: 'חלון יומן הכניסות',
  window24: '24 שעות',
  window168: '7 ימים',
  run: 'הרץ בדיקה',
  running: 'בודק…',
  notRun: 'עוד לא הורצה בדיקה. הבדיקה קוראת מהאינטרקום כ־30 פעמים, ולכן היא רצה רק בלחיצה.',
  colScreen: 'מסך',
  colSource: 'באינטרקום',
  colNative: 'ב־Arx',
  colOutcome: 'תוצאה',
  colWhy: 'הסבר',
  colOpen: 'פתיחה',
  scr_stations: 'תחנות ודלתות',
  scr_people: 'אנשים',
  scr_events: 'פעילות',
  scr_groups: 'קבוצות ושדות',
  scr_schedules: 'לוחות זמנים',
  scr_alerts: 'התרעות',
  out_match: 'תואם',
  out_filtered: 'מסונן לפי הרשאות',
  out_mismatch: 'לא תואם',
  out_partial: 'חלקי',
  out_not_permitted: 'אין הרשאה למסך',
  out_unsupported: 'לא נתמך בגרסה המותקנת',
  out_unavailable: 'לא ענה',
  why_station_scope: 'הוסרו רשומות של תחנות מחוץ לתחום ההרשאה',
  why_installation_wide: 'המסך מוצג רק למי שמורשה לכל התחנות',
  why_permission: 'למשתמש אין הרשאה לפתוח את המסך',
  why_mismatch: 'Arx מציג משהו אחר ממה שההרשאות מאפשרות. הריצו שוב; אם זה חוזר - זו תקלה.',
  why_partial: 'הקריאה נעצרה במגבלת הסריקה, ולכן אין הכרעה',
  why_match: '',
  expected: 'צפוי {n}',
  notComplete: 'לפחות {n}',
  openArx: 'Arx',
  openClassic: 'החלון הקלאסי',
  ranFor: 'נבדק עבור {name} · {when}',
  windowNote: 'חלון יומן הכניסות: {n} שעות',
  summary: '{match} תואמים · {filtered} מסוננים · {mismatch} לא תואמים',
  checklistTitle: 'בדיקה ידנית צד לצד',
  checklistSub: 'פתחו את המסך של Arx ואת החלון הקלאסי זה לצד זה וסמנו מה נבדק. הסימון נשמר בדפדפן הזה בלבד.',
  checklistClear: 'ניקוי הסימונים',
  checklistDone: '{done} מתוך {all}',
  chk_overview: 'מרכז הכניסה',
  chk_stations: 'תחנות ודלתות',
  chk_people: 'אנשים',
  chk_events: 'פעילות',
  chk_schedules: 'לוחות זמנים',
  item_stations_count: 'מספר התחנות והמחוברות שבהן',
  item_ringing: 'צלצול או שיחה פעילה מופיעים בשני המסכים',
  item_doors: 'רשימת הדלתות של תחנה אחת',
  item_technical: 'דגם וקושחה של תחנה אחת',
  item_people_count: 'מספר האנשים',
  item_sample_person: 'אדם אחד לדוגמה: קבוצות, תוקף ותחנות',
  item_last_events: '20 האירועים האחרונים',
  item_event_filters: 'סינון לפי תחנה ולפי תוצאה',
  item_schedule: 'לוח הזמנים של דלת אחת',
  // the stations drawer's way to the entry log of the station (CR-036 S12)
  stationEvents: 'פעילות התחנה',
  // the stations-screen display card (Settings › מתגי מסכי כניסה)
  dispTitle: 'תצוגת מסך התחנות',
  dispSub: 'חל על מסך "תחנות ודלתות" של Arx בלבד. כל שינוי נשמר עם כפתור השמירה של הכרטיס הזה.',
  dispCallHint: 'רמז לשיחה נכנסת',
  dispCallHintText: '"שיחה נכנסת" / "בשיחה" על כרטיס התחנה, בלי שם המתקשר',
  dispCallHintEveryone: 'כל מי שרואה את התחנה',
  dispCallHintCall: 'רק מי שרשאי לענות',
  dispTalk: 'כפתור דיבור',
  dispTalkText: 'בשלב זה הדיבור נפתח בחלון הקלאסי',
  dispTalkClassic: 'מוצג · נפתח בחלון הקלאסי',
  dispTalkHidden: 'מוסתר',
  // live video and talk in the stations drawer (`access.station_media`, CR-036 S18): one clean row, nothing explained beside it
  dispMedia: 'וידאו ודיבור במסך התחנות',
  dispMediaOff: 'כבוי',
  dispMediaVideo: 'וידאו',
  dispMediaTalk: 'וידאו ודיבור',
  // the longest talk (`access.station_media_max_talk_s`), shown only while talk is on: the label and the number, the unit beside it
  dispTalkMax: 'משך דיבור מרבי',
  dispTalkMaxUnit: 'שניות',
  dispTalkMaxInvalid: 'מספר שלם בין {min} ל-{max}',
  dispAnnounce: 'יעדי הכרזה',
  dispAnnounceText: 'המערכת מכריזה רק לתחנות שבתחום ההרשאה של המשתמש',
  dispAnnounceScope: 'תחנה, מקום או כל התחנות',
  dispAnnounceStation: 'תחנה אחת בכל פעם',
  dispPhrases: 'משפטים מוכנים להכרזה',
  dispPhrasesText: 'משפט בכל שורה, עד {n} משפטים של עד {len} תווים. ריק = המשפטים המובנים.',
  dispPhrasesCount: '{n} משפטים יוצגו',
  dispPhrasesBuiltIn: 'יוצגו המשפטים המובנים',
  dispPhrasesDropped: '{n} שורות ארוכות או עודפות לא יוצגו',
  dispSave: 'שמור',
  dispSaved: 'נשמר',
  dispReadOnly: 'שינוי ההגדרות דורש הרשאת מנהל מערכת.',
  dispRetry: 'נסה שוב',
  dispLoading: 'טוען…',
};

export type PtKey = keyof typeof he;

const en: Partial<Record<PtKey, string>> = {
  title: 'Comparison with the intercom screens',
  run: 'Run check',
  running: 'Checking…',
  colScreen: 'Screen',
  colSource: 'In the intercom',
  colNative: 'In Arx',
  colOutcome: 'Result',
  colWhy: 'Why',
  colOpen: 'Open',
  out_match: 'Same',
  out_filtered: 'Filtered by permissions',
  out_mismatch: 'Different',
  out_partial: 'Partial',
  out_not_permitted: 'No access to the screen',
  out_unsupported: 'Not offered by the installed version',
  out_unavailable: 'No answer',
  checklistTitle: 'Side-by-side checklist',
  dispTitle: 'Stations screen display',
  dispMedia: 'Video and talk on the stations screen',
  dispMediaOff: 'Off',
  dispMediaVideo: 'Video',
  dispMediaTalk: 'Video and talk',
  dispTalkMax: 'Longest talk',
  dispTalkMaxUnit: 'seconds',
  dispTalkMaxInvalid: 'A whole number from {min} to {max}',
  dispSave: 'Save',
};

export function ptLang(): 'he' | 'en' {
  return typeof document !== 'undefined' && (document.documentElement.lang || '').toLowerCase().startsWith('en') ? 'en' : 'he';
}

/** The text of `key` in the document's language, with `{name}` placeholders filled. */
export function pt(key: PtKey, vars?: Record<string, string | number>): string {
  const raw = (ptLang() === 'en' ? en[key] : undefined) ?? he[key];
  return vars ? raw.replace(/\{(\w+)\}/g, (m, k: string) => (k in vars ? String(vars[k]) : m)) : raw;
}

/** A run-time key (`out_<outcome>`, `why_<rule>`...), or the fallback when there is none. */
export function ptDynamic(key: string, fallback: PtKey, vars?: Record<string, string | number>): string {
  return key in he ? pt(key as PtKey, vars) : pt(fallback, vars);
}

export const PARITY_HE = he;
