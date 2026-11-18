/**
 * MGRDASH phase 1: the text catalogue of the manager overview ("סקירה", the first tab of the service area for managers), its settings rows
 * and the handler's own numbers on "שלי". Hebrew + English, like the board's catalogue (the board module has no ar / ru texts). The same
 * naming rules as board-text.ts (D33): a text that names the module is a template with the tokens of tickets/naming.ts - `{ticket}`,
 * `{tickets}`, `{f:..|m:..}` - and the default name is never written here (tests/unit-tickets-overview.spec.ts fails when it is).
 */
import { registerCatalogue } from '../i18n/core';
import { NAV_OT } from '../i18n/nav-labels'; // CR-NAV-LABELS-2436: the shell's tab label lives there
import { makeCatalogue } from './catalogue'; // CR-TK-CATALOGUE-2440: the shared template / text / key-list lines
import { packTable, withEntries } from '../i18n/lang-packs';

const he = {
  tab: NAV_OT.he.tab,
  title: 'סקירה',
  toBoard: 'לוח מנהל',
  updated: 'עודכן {when}',
  justNow: 'עכשיו',
  offline: 'אין חיבור · הנתונים מ-{time}',
  deptGroup: 'מחלקות',
  allMyDepts: 'כל המחלקות שלי',
  allDepts: 'כל המחלקות',
  fold: 'קיפול {name}',
  unfold: 'פתיחת {name}',
  retry: 'נסה שוב',
  unavailable: 'לא זמין כרגע',
  loadFailed: 'משהו השתבש בטעינה',
  notManager: 'הסקירה פתוחה למנהלי מחלקות',
  emptyAll: 'אין עדיין {tickets} במחלקה',
  newTicket: 'פתיחת {ticket}',
  atLeast: 'לפחות {n}',
  truncated: 'מוצגות {n} {f:הראשונות|m:הראשונים}',
  showAll: 'הצג הכול',
  showLess: 'הצג פחות',
  yesterdayUp: 'עלייה של {n} מאתמול',
  yesterdayDown: 'ירידה של {n} מאתמול',

  // card 1 - the numbers row
  kOpen: '{f:פתוחות|m:פתוחים}',
  kStuck: '{f:תקועות|m:תקועים}',
  kWaiting: '{f:ממתינות|m:ממתינים} לי',
  kOverdue: 'באיחור',
  kApproval: '{f:ממתינות|m:ממתינים} לאישורי',

  // card 11 (phase 1 from the board) - department comparison
  cmpTitle: 'השוואת מחלקות',
  cmpQ: 'איזו מחלקה בבעיה?',
  cmpDept: 'מחלקה',
  cmpOpen: '{f:פתוחות|m:פתוחים}',
  cmpStuck: '{f:תקועות|m:תקועים}',
  cmpOverdue: 'באיחור',
  cmpWaiting: '{f:ממתינות|m:ממתינים} לי',
  cmpBusy: 'מטפלים עמוסים',
  cmpDecide: '{f:מחכות|m:מחכים} להחלטה',
  cmpDone7: 'טופלו ב-7 ימים',

  // card 5 - how much was handled (phase 3)
  thTitle: 'כמה טופל',
  thQ: 'כמה כל אחד סיים?',
  thPeriod: 'תקופה',
  pd_today: 'היום',
  pd_7d: '7 ימים',
  pd_30d: 'חודש',
  thHandler: 'מטפל',
  thDone: 'סומנו "בוצע"',
  thClosed: 'נסגרו',
  thReturned: 'הוחזרו לטיפול',
  thMedian: 'זמן טיפול חציוני',
  thTotal: 'סה"כ',
  thNone: 'אין סגירות בתקופה',

  // card 6 - opened vs closed (phase 3)
  dyTitle: 'נפתחו מול נסגרו',
  dyQ: 'עומדים בקצב?',
  dyOpened: 'נפתחו',
  dyClosed: 'נסגרו',
  dyNet: '{n} בשבועיים',
  dyNetLabel: 'צבר נטו בשבועיים: {n}',
  dyDay: 'יום',
  dyChart: 'נפתחו מול נסגרו, 14 ימים',
  dyNone: 'אין תנועה בשבועיים',

  // card 7 - waiting for my approval (phase 3)
  apTitle: 'ממתין לאישורי',
  apQ: 'מה תקוע בגללי?',
  apQuotes: 'הצעות מחיר ל{ticket}',
  apClaims: 'דרישות תשלום',
  apSecond: 'אישור שני לבחירת ספק',
  apWaits: 'מחכה {age}',
  apNone: 'אין מה לאשר',

  // card 8 - requests for quotation (phase 3)
  rqTitle: 'בקשות להצעת מחיר',
  rqQ: 'מה מחכה להחלטה?',
  rq_second: 'ממתין לאישור שני',
  rq_due: 'עבר המועד - לבחור',
  rq_decide: '{quoted} מתוך {invited} הצעות התקבלו - לבחור',
  rq_received: '{quoted} מתוך {invited} הצעות התקבלו',
  rq_collecting: 'אוספת הצעות · {quoted} מתוך {invited}',
  rqQuestion: 'שאלה מספק',
  rqQuestions: '{n} שאלות מספקים',
  rqDue: 'מועד הגשה {date}',
  rqNone: 'אין בקשות שמחכות להחלטה',

  // card 2 - where stuck
  stTitle: 'איפה נתקע',
  stQ: 'באיזה מקום ולמה?',
  stAll: 'כל הסיבות',
  stReasons: 'סיבות',
  stTree: 'בניין ‹ קומה ‹ אזור',
  stNone: 'אין {f:תקועות|m:תקועים}',
  stOfOpen: 'מתוך {n} {f:פתוחות|m:פתוחים}',
  rs_unopened: 'לא נפתח',
  rs_ack: 'לא אושרה קבלה',
  rs_stuck: 'אין עדכון',
  rs_waiting: 'ממתין לחלק',
  rs_overdue: 'עבר היעד',
  rs_unassigned: 'לא שויך',
  noPlace: 'ללא מיקום',

  // card 3 - handler load
  ldTitle: 'עומס מטפלים',
  ldQ: 'מי עמוס ומי פנוי?',
  ldOpen: '{f:פתוחות|m:פתוחים}',
  ldWaiting: '{f:מחכות|m:מחכים} לו/ה',
  ldStuck: '{f:תקועות|m:תקועים}',
  ldHandled: 'טופלו',
  ldLoad: 'עומס',
  ldMeter: 'עומס {on} מתוך {total}',
  ldOldest: '{f:הוותיקה|m:הוותיק} ביותר: {age}',
  ldFree: 'פנוי/ה',
  ldVendor: 'ספק',
  ldBusy: 'עמוס',
  ldBusyCount: '{n} עמוס',
  ldVendors: 'ספקים',
  ldStaff: 'עובדים',
  ldNone: 'אין {tickets} בטיפול',
  ldUnassigned: 'ללא מטפל',
  clearHandler: 'הסרת הסינון: {name}',

  // card 4 - who waits for whom
  wwTitle: 'מי מחכה למי',
  wwQ: 'אצל מי הכדור?',
  wwMe: 'לי',
  wwStaff: 'למטפלים',
  wwVendors: 'לספקים',
  wwOldest: '{f:הוותיקה|m:הוותיק}: {age}',
  wwNone: 'אין מה שמחכה',
  wwQuiet: 'הכדור לא אצלך',

  // card 9 - overdue
  odTitle: 'באיחור',
  odQ: 'מה עבר את המועד?',
  odNone: 'אין איחורים',
  odSla: 'יעד זמן עבר',
  odEta: 'מועד הגעה עבר בלי עדכון',
  odRfq: 'מועד הבקשה עבר בלי החלטה',
  odBy: '{what} · {dur}',
  odNobody: 'ללא מטפל',

  // card 10 - the next two weeks
  agTitle: 'השבועיים הקרובים',
  agQ: 'מי מגיע ומה לשלם?',
  agNone: 'אין מועדים בשבועיים הקרובים',
  agToday: 'היום',
  agTomorrow: 'מחר',
  agVisitVendor: 'הגעת ספק',
  agVisitStaff: 'הגעת עובד',
  agWorkStart: 'תחילת עבודה',
  agRfqDue: 'מועד הגשה',
  agPayment: 'מועד תשלום',
  agAllDay: '-',
  agRfqPartial: 'מועדי הגשה, תחילת עבודה ותשלומים - לא זמין כרגע',
  pyTitle: 'תשלומים',
  pyQ: 'מה מחכה לתשלום שלי?',
  pyOverdue: 'מועד התשלום עבר',
  pyUpcoming: 'בשבועיים הקרובים',
  pyClaims: 'דרישות תשלום שאושרו ולא שולמו',
  pyNone: 'אין תשלומים שמחכים',
  pyLateDays: 'באיחור של {n} ימים',
  pyLateDay: 'באיחור של יום',
  pyDueToday: 'היום',
  pyDueTomorrow: 'מחר',
  pyDueIn: 'בעוד {n} ימים',
  pyKind_advance: 'מקדמה',
  pyKind_progress: 'תשלום ביניים',
  pyKind_final: 'תשלום סופי',
  pyDemandNone: 'טרם נוצרה דרישה',
  pyDemandOpen: 'דרישה פתוחה',
  pyApproved: 'אושרה לפני {age}',
  pyMoved: 'המועד שונה',
  odPay: 'מועד תשלום עבר',

  // the handler's own numbers ("שלי")
  myGroup: 'המספרים שלי',
  myOpen: '{f:פתוחות|m:פתוחים} אצלי',
  myWaiting: '{f:מחכות|m:מחכים} לי',
  myOverdue: 'באיחור',
  myVisits: 'הגעות היום',

  // Settings > the module > display: the overview card
  setCard: 'סקירת מנהל',
  setHandlerNumbers: 'מספרי מטפל',
  setHandlerNumbersSub: 'מי רואה את המספרים של מטפל',
  hn_managers: 'מנהלים בלבד',
  hn_own: 'כל מטפל את שלו',
  hn_everyone: 'כולם',
  setVendors: 'ספקים בכרטיס העומס',
  setVendorsSub: 'באותה רשימה, ברשימה נפרדת או בלי',
  vd_tagged: 'עם תגית',
  vd_separate: 'רשימה נפרדת',
  vd_hidden: 'בלי',
  setBusy: 'סף "עמוס"',
  setBusySub: '{f:פתוחות|m:פתוחים} אצל מטפל · ברירת המחדל לכל מחלקה',
  setBusyDept: 'סף לפי מחלקה',
  setBusyDeptSub: 'ריק = ברירת המחדל',
  setCompare: 'השוואת מחלקות',
  setCompareSub: 'למנהל כל המחלקות',
  cp_top: 'ראשונה',
  cp_below_numbers: 'מתחת למספרים',
  cp_bottom: 'בתחתית',
  setBusyInvalid: 'מספר בין 1 ל-99',
  setDigestHour: 'שעת סיכום הבוקר',
  setDigestHourSub: 'ימים א׳-ה׳ · ההתראה עצמה נדלקת בהגדרות ההתראות',
  setDeptStuck: 'סף "מחלקה עמוסה"',
  setDeptStuckSub: '{f:תקועות|m:תקועים} במחלקה · להתראה למנהלי המחלקה',
  setDeptStuckInvalid: 'מספר בין 1 ל-999',
  // OVERVIEWFIT-297: the widget pages on a desktop
  pagesGroup: 'עמודי הסקירה',
  pagePrev: 'העמוד הקודם',
  pageNext: 'העמוד הבא',
  pageOf: 'עמוד {n} מתוך {of}',
  pageDot: 'עמוד {n} מתוך {of}: {names}',
  pageAlert: 'יש בו מספר אדום',
};

export type OverviewTextKey = keyof typeof he;

const en: Partial<Record<OverviewTextKey, string>> = withEntries(packTable<typeof import('../i18n/lang/en/tickets/overview-text').en>('en', 'tickets/overview-text', 'en'), {
  tab: NAV_OT.en.tab,
});

/** The raw template of a key (the unit tests read it). */
const catalogue = makeCatalogue<OverviewTextKey>(he, en);

/** The raw template of a key in a language; English falls back to Hebrew (the unit tests and the completeness spec read it). */
export const overviewTemplate = catalogue.template;

/** A text of the overview: the template in the document's language, the module's name rendered (D33), then `{var}`s. */
export const ot = catalogue.t;

export const OVERVIEW_TEXT_KEYS = catalogue.KEYS;
export const OVERVIEW_TEXT_EN_KEYS = catalogue.EN_KEYS;

registerCatalogue('tickets/overview-text', { he, en });
