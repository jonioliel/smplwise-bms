/**
 * CR-FLEET215: the strings of Settings › דיווח בריאות (`#/system/fleet-report`). The page is written for the simplest technician:
 * one short sentence per item, no hash / schema / enrollment / epoch wording (the technical names sit behind one toggle). The
 * home platform is "תשתית המערכת", never its product name (UI_COPY_RULES). Hebrew first; the English column is used when the
 * document language is English (a missing key falls back to the Hebrew). `{name}` placeholders are filled by `ft(key, { name })`.
 */
const he = {
  tab: 'דיווח בריאות',
  title: 'דיווח בריאות',
  sub: 'פעם ביום המערכת שולחת ל-SmplWise דוח קצר על מצבה, כדי שתקלה תטופל לפני שהלקוח מרגיש בה.',
  keywords: 'דיווח בריאות דוח יומי smplwise fleet צי התקנות מוכנות הדגמה נתוני דוגמה קוד רישום חתימה שקט',
  loading: 'טוען את הגדרות הדיווח…',
  errorTitle: 'הגדרות הדיווח לא נטענו',
  errorHint: 'המערכת עצמה עובדת. רק העמוד הזה לא הצליח להיטען. נסו שוב בעוד רגע.',
  forbiddenTitle: 'רק מנהל מערכת יכול לראות את דיווח הבריאות',
  retry: 'נסו שוב',

  // the answer card
  switchLabel: 'שליחת דוח יומי',
  sendNow: 'שליחת דוח עכשיו',
  sendRetry: 'ניסיון שליחה עכשיו',
  sending: 'שולח…',
  sentOk: 'הדוח נשלח והתקבל.',
  sentFail: 'השליחה נכשלה. הניסיון נשמר ברשימת הדוחות.',
  saveFail: 'השינוי לא נשמר. נסו שוב.',
  stopNote: 'בכיבוי נשלחת הודעה אחרונה אחת, "הדיווח הופסק", כדי ש-SmplWise יידעו שכיבית ולא שהמערכת נפלה.',

  offTitle: 'הדיווח כבוי',
  offSub: 'שום דבר לא נשלח ל-SmplWise. אם תהיה תקלה, נדע עליה רק כשהלקוח יתקשר.',
  offDo: 'כדי להתחיל: הדליקו את המתג "שליחת דוח יומי".',
  offLast: 'הדוח האחרון נשלח לפני הכיבוי: {when}',
  offLastNone: 'עדיין לא נשלח אף דוח',
  stoppedSent: 'הודעת "הדיווח הופסק" נשלחה ל-SmplWise.',
  stoppedFail: 'הודעת "הדיווח הופסק" לא הגיעה ל-SmplWise. אצלם ההתקנה תופיע כ"לא מדווחת" עד שיעודכנו.',

  onTitle: 'הדיווח פועל ותקין',
  onSub: 'הדוח האחרון התקבל {when}. הבא נשלח לבד {next}.',
  onFirstTitle: 'הדיווח פועל, מחכה לדוח הראשון',
  onFirstSub: 'המתג דולק. הדוח הראשון יישלח בקרוב לבד, או עכשיו בלחיצה על הכפתור.',
  onDo: 'אין מה לעשות.',
  onFirstDo: 'אפשר ללחוץ "שליחת דוח עכשיו" כדי לראות שהחיבור עובד.',

  nourlTitle: 'הדיווח דולק, אבל עדיין לא נשלח',
  nourlSub: 'המתג דולק, אבל עוד לא הוגדר לאן לשלוח. לכן לא יצא אף דוח.',
  nourlDo: 'מה לעשות: המתקין פותח את הגדרות ההתקנה ומזין את כתובת השרת של SmplWise. הלקוח לא צריך לעשות כלום.',
  nourlBad: 'כתובת השרת שהוגדרה בהתקנה אינה תקינה. המתקין צריך לתקן אותה בהגדרות ההתקנה.',
  nourlLast: 'עדיין לא נשלח אף דוח',

  failTitle: 'השליחה האחרונה נכשלה',
  failSub: 'הדוח של {when} לא הגיע ל-SmplWise. המערכת תנסה שוב לבד {next}.',
  failDo: 'מה לעשות: לבדוק שיש אינטרנט באתר. אם יש, ללחוץ "ניסיון שליחה עכשיו". אם זה נכשל שוב, להתקשר ל-SmplWise.',

  // readiness
  readyTitleNone: 'מוכנות ההתקנה: הכול מוכן',
  readyTitle: 'מוכנות ההתקנה: {n} דברים עוד חסרים',
  readyTitleOne: 'מוכנות ההתקנה: דבר אחד עוד חסר',
  readySub: 'הרשימה המלאה, הספים והמשקלים נמצאים במסך המוכנות. הדוח היומי מראה ל-SmplWise רק את הציון ומה חסר.',
  readyAllOk: 'כל מה שנדרש הוגדר.',
  readyUnavailable: 'מוכנות ההתקנה לא נטענה. שאר העמוד תקין.',
  readyOpen: 'למסך המוכנות ›',

  // what is sent
  sentTitle: 'מה נשלח בדוח',
  sentCount: '· {n} פריטים',
  sentSub: 'רק מספרים ומצבים (תקין / אזהרה / תקלה). לעולם לא: שמות, כתובות, סיסמאות, תמונות, אירועים, יומנים.',
  sentNever: 'לעולם לא',
  sentIntro: 'לפי נושא. כל פריט הוא מספר, זמן, כן/לא או מצב מרשימה קבועה.',
  techNames: 'שמות טכניים',
  neverTitle: 'מה לעולם לא יוצא מההתקנה',
  neverX: 'גם לא בטעות: הדוח בנוי מרשימה סגורה, ואין בו מקום לדברים האלה',
  sentHeader: 'בנוסף, בכותרת השליחה (לא בדוח עצמו) נשלח מספר אחד: אחרי כמה שעות בלי דוח ההתקנה נחשבת "לא מדווחת".',

  // last reports
  lastTitle: 'דוחות אחרונים',
  colWhen: 'מתי',
  colWhat: 'מה קרה',
  colSeq: 'מספר דוח',
  seqHint: 'מספר הדוח רק עולה. אם בשרת חסר מספר, יודעים שדוח לא הגיע.',
  logEmpty: 'עדיין לא נשלח אף דוח',
  logOk: 'התקבל',
  logRejected: 'נדחה בשרת',
  logUnreachable: 'לא נשלח, אין חיבור',
  logRefused: 'נעצר בבדיקה, לא נשלח',
  logStop: 'הודעת הפסקה',
  exactTitle: 'הדוח המדויק שנשלח',
  exactHint: 'כמו שהשרת מקבל אותו. למנהל המערכת שרוצה לבדוק בעצמו.',
  exactNow: 'הדוח שיישלח עכשיו',
  exactLast: 'הדוח האחרון שנשלח',
  exactLoad: 'טוען…',
  exactNone: 'אין עדיין דוח להצגה.',

  // technician card
  techTitle: 'חיבור ל-SmplWise ופרטים למתקין',
  techReady: 'מחובר ל-SmplWise · חתימה תקינה',
  techAllSet: 'הכול מוגדר. הדיווח יתחיל מיד עם ההדלקה.',
  techMissing: 'חסר: לאן לשלוח',
  whereTo: 'לאן נשלח הדוח',
  whereToHint: 'המתקין מגדיר את זה פעם אחת בהגדרות ההתקנה. הלקוח לא צריך לגעת.',
  isSet: 'הוגדר',
  notSet: 'עדיין לא הוגדר',
  invalid: 'הכתובת אינה תקינה',
  signature: 'חתימה על הדוח',
  signatureHint: 'כל דוח חתום במפתח של ההתקנה הזאת, כך שאי אפשר לזייף אותו.',
  signatureNone: 'המפתח ייווצר עם ההדלקה',
  signatureOk: 'תקינה',
  installId: 'מספר ההתקנה',
  installIdHint: 'מספר אקראי. זה מה שהשרת מכיר, לא שם או כתובת.',
  enrollCode: 'קוד רישום',
  enrollHint: 'המתקין מזין אותו פעם אחת בשרת של SmplWise, וכך השרת יודע שהדוחות מגיעים מכאן.',
  copy: 'העתקה',
  copied: 'הועתק',
  copyFail: 'ההעתקה לא הצליחה. סמנו את הקוד והעתיקו ידנית.',
  silentLabel: 'מתי נחשבת "לא מדווחת"',
  silentHint: 'אחרי כמה שעות בלי אף דוח השרת של SmplWise מסמן את ההתקנה כ"לא מדווחת". ברירת המחדל {def} שעות.',
  hoursUnit: 'שעות',
  silentSave: 'שמירה',
  silentRange: 'בין {min} ל-{max} שעות',
  silentSaved: 'נשמר',

  // field groups
  g_report: 'על הדוח עצמו',
  g_report_x: 'איזה דוח זה ומתי נוצר',
  g_versions: 'גרסאות',
  g_versions_x: 'כדי לדעת מי צריך עדכון',
  g_components: 'מצב חלקי המערכת',
  g_components_x: 'תקין / אזהרה / תקלה לכל חלק',
  g_counts: 'כמויות',
  g_counts_x: 'מספרים בלבד, בלי שמות',
  g_alerts: 'התראות פתוחות',
  g_alerts_x: 'כמה, לא מה',
  g_disk: 'דיסק',
  g_backup: 'גיבוי',
  g_update: 'עדכון',
  g_readiness: 'מוכנות',
  g_readiness_x: 'מה עוד חסר להתקנה',

  ty_const: 'קבוע',
  ty_id: 'מספר אקראי',
  ty_num: 'מספר',
  ty_time: 'זמן',
  ty_enum: 'מצב מרשימה',
  ty_bool: 'כן / לא',
  ty_version: 'מספר גרסה',
  ty_list: 'רשימה קבועה',
} as const;

const en: Partial<Record<keyof typeof he, string>> = {
  tab: 'Health report',
  title: 'Health report',
  sub: 'Once a day the system sends SmplWise a short report on its state, so a fault is handled before the customer feels it.',
  loading: 'Loading the report settings…',
  errorTitle: 'The report settings did not load',
  errorHint: 'The system itself is working. Only this page failed to load. Try again in a moment.',
  forbiddenTitle: 'Only a system administrator can see the health report',
  retry: 'Try again',
  switchLabel: 'Send a daily report',
  sendNow: 'Send a report now',
  sendRetry: 'Try sending now',
  offTitle: 'Reporting is off',
  onTitle: 'Reporting is on and healthy',
  nourlTitle: 'Reporting is on, but nothing is sent yet',
  failTitle: 'The last send failed',
  sentTitle: 'What is sent in the report',
  lastTitle: 'Recent reports',
  techTitle: 'SmplWise connection and installer details',
  copy: 'Copy',
  copied: 'Copied',
  readyOpen: 'Open the readiness screen ›',
};

export type FleetTextKey = keyof typeof he;

function lang(): 'he' | 'en' {
  return typeof document !== 'undefined' && (document.documentElement.lang || '').toLowerCase().startsWith('en') ? 'en' : 'he';
}

export function ft(key: FleetTextKey, vars?: Record<string, string | number>): string {
  const raw = (lang() === 'en' ? en[key] : undefined) ?? he[key] ?? key;
  return vars ? raw.replace(/\{(\w+)\}/g, (m, k: string) => (k in vars ? String(vars[k]) : m)) : raw;
}

/** The server's he/en pair (readiness labels) in the document language. */
export function pickLang(v: { he: string; en: string } | null | undefined): string {
  return v ? (lang() === 'en' ? v.en || v.he : v.he) : '';
}

export const FLEET_TEXT_KEYS = Object.keys(he) as FleetTextKey[];
