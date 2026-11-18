/**
 * TKUI3 (release 2.6.0): the text catalogue of the request's Costs tab (IA §4.1 / §6.3, mock-up v5) - the stage chip and stepper, the
 * vendor's quote card and its decisions, the baseline, the payment demand's comparison with the quote, the allowed line kinds, and the
 * "לשלוח הודעה לספק?" dialog. The tickets/text.ts contract: Hebrew first, the English column falls back to the Hebrew, the module's
 * name only through the tokens of tickets/naming.ts (`{ticket}`), variables `{name}`-style filled after the name.
 * Vocabulary (owner 16.10): the retired cost term is never written. Before the work the vendor sends a quote ("הצעת מחיר"); after the
 * work a payment demand ("דרישת תשלום"); a request for quotes from several vendors is an RFQ ("בקשת הצעות מחיר", its own screen).
 */
import { makeCatalogue } from './catalogue'; // CR-TK-CATALOGUE-2440: the shared template / text / key-list lines
import { registerCatalogue } from '../i18n/core';
import { packTable } from '../i18n/lang-packs';

const he = {
  // the tab's header: the stage chip (contract 4.3 flow.stage) and the read-only stepper
  st_none: 'לא נדרשת',
  st_quote_optional: 'הצעת מחיר לא חובה',
  st_quote_requested: 'ממתין להצעת מחיר מהספק',
  st_quote_submitted: 'הצעת מחיר ממתינה לאישורך',
  st_quote_fix_requested: 'הצעה הוחזרה לתיקון',
  st_quote_rejected: 'הצעה נדחתה',
  st_quote_approved: 'הצעה אושרה · טרם החלה העבודה',
  st_work: 'בעבודה · לפי הצעה מאושרת',
  st_demand_awaiting: 'ממתין לדרישת תשלום מהספק',
  st_demand_submitted: 'דרישת תשלום ממתינה לאישורך',
  st_demand_rejected: 'דרישת התשלום הוחזרה לתיקון',
  st_demand_approved: 'דרישת התשלום אושרה · לתשלום',
  st_paid: 'שולם',
  step_quote: 'הצעה',
  step_work: 'עבודה',
  step_demand: 'דרישה',
  step_paid: 'שולם',
  stepper: 'שלבי העלות',
  waitingPart: 'ממתין לחלק',

  // the quote card
  quoteTitle: 'הצעת מחיר',
  quoteSub: 'לפני העבודה',
  quoteVersion: 'גרסה {n}',
  quoteSubmitted: 'הוגשה {when}',
  quoteOnBehalf: 'הוזנה בשם הספק · {who}',
  quoteNone: 'טרם הוגשה',
  quoteRequired: 'נדרשת לפני העבודה',
  qs_submitted: 'ממתינה לאישורך',
  qs_fix_requested: 'הוחזרה לתיקון',
  qs_approved: 'אושרה',
  qs_partially_approved: 'אושרה חלקית',
  qs_rejected: 'נדחתה',
  qs_superseded: 'הוחלפה בגרסה חדשה',
  qs_withdrawn: 'בוטלה',
  qs_not_awarded: 'לא נבחרה',
  decidedBy: '{state} · {who} · {when}',
  workWindow: 'חלון עבודה',
  quoteNote: 'הערת הספק',
  vendorRef: 'מספר הצעה',
  quoteFullTotal: 'סה״כ בהצעה המלאה',
  lineApproved: 'אושר',
  lineNotApproved: 'לא אושר',
  older: 'גרסאות קודמות ({n})',
  amountsHidden: 'הסכומים גלויים רק למי שמורשה לצפות בעלויות',

  // quote decisions
  approveQuote: 'אישור ההצעה',
  partialQuote: 'אישור חלקי',
  fixQuote: 'בקשת תיקון',
  rejectQuote: 'דחיית ההצעה',
  more: 'פעולות נוספות',
  pickLines: 'סמנו את הסעיפים לאישור',
  approveSelected: 'אישור הסעיפים שנבחרו',
  selectedTotal: 'סה״כ מאושר',
  cancel: 'ביטול',
  approveTitle: 'אישור הצעת המחיר',
  partialTitle: 'אישור חלקי של ההצעה',
  fixTitle: 'בקשת תיקון בהצעה',
  rejectTitle: 'דחיית הצעת המחיר',
  fixReason: 'מה לתקן',
  rejectReason: 'נימוק',
  vendorSees: 'יוצג למטפל החיצוני',
  internalNote: 'הערה פנימית (לא נשלחת למטפל החיצוני)',
  approveNote: 'ההצעה המאושרת תהיה בסיס העלות של דרישת התשלום.',
  required: 'חובה',
  back: 'חזרה',
  stale: 'ההצעה השתנתה בינתיים. הפרטים נטענו מחדש.',
  loadFailed: 'לא ניתן לטעון את העלויות',
  retry: 'נסו שוב',

  // the baseline (the approved quote) and the payment demand against it
  baseline: 'בסיס העלות המאושר',
  baselineLine: 'גרסה {n} · {total}',
  demandTitle: 'דרישת תשלום',
  demandSub: 'אחרי העבודה',
  demandLater: 'תוגש על ידי הספק אחרי העבודה, מול ההצעה המאושרת',
  againstQuote: 'מול הצעה גרסה {n} · {total}',
  delta: 'הפרש מההצעה המאושרת',
  // CR-CLAIM-PREFILL: the demand against the approved quote (or one instalment of its schedule)
  qcDiffers: 'שונה מההצעה המאושרת',
  qcPaymentN: 'תשלום {n}',
  qcInstalment: 'מול תשלום {n} מלוח התשלומים · {total}',
  qcReason: 'הסבר הספק לסכום הגבוה',
  qc_above_quote: 'מעל המאושר',
  qc_below_quote: 'מתחת למאושר',
  qc_lines_differ: 'סעיפים שונים',
  qc_currency: 'מטבע אחר',
  exceptional: 'סעיפים חריגים',
  exc_pending: 'לבדיקה',
  exc_accepted: 'אושר',
  exc_excluded: 'הוחרג',
  exc_not_in_quote: 'לא בהצעה',
  exc_kind_not_allowed: 'סעיף לא מותר',
  approveDemand: 'אישור הדרישה',
  approveWithExc: 'אישור כולל החריג',
  approveNoExc: 'אישור בלי החריג',
  fixDemand: 'בקשת תיקון',
  fixDemandTitle: 'החזרת הדרישה לתיקון',

  // the folds (managers)
  kindsFold: 'סעיפים מותרים לספק',
  kindsLevel_request: 'הוגדר ל{ticket} {f:הזו|m:הזה}',
  kindsLevel_department: 'ברירת המחדל של המחלקה',
  kindsLevel_installation: 'ברירת המחדל של ההתקנה',
  kindsReset: 'חזרה לברירת המחדל',
  kindsFixed: 'עבודה תמיד מותרת',
  requirementFold: 'דרישות מהספק',
  quoteMode: 'הצעת מחיר',
  claimMode: 'דרישת תשלום',
  m_required: 'חובה',
  m_optional: 'רשות',
  m_off: 'בלי',
  setKindsHint: 'שורה מסוג אחר בדרישת תשלום תסומן כחריגה',
  kindsDefault: 'לפי ההתקנה',
  kindsInstallation: 'כל המחלקות',
  askQuote: 'בקשת הצעת מחיר',
  emptyCosts: 'לא נדרשת הצעת מחיר או דרישת תשלום',
  noMoneyStaff: 'עובד ללא חשבון · אין עלויות בשיוך הזה',

  // after a decision: "לשלוח הודעה לספק?" (never sent automatically; the default is not sending)
  sendTitle_quote_approved: 'הצעת המחיר אושרה',
  sendTitle_quote_partially_approved: 'הצעת המחיר אושרה חלקית',
  sendTitle_quote_fix_requested: 'ההצעה הוחזרה לתיקון',
  sendTitle_quote_rejected: 'ההצעה נדחתה',
  sendTitle_claim_approved: 'דרישת התשלום אושרה',
  sendTitle_claim_rejected: 'הדרישה הוחזרה לתיקון',
  sendAsk: 'לשלוח הודעה לספק? הנוסח ניתן לעריכה; בלי אישורך לא נשלח דבר.',
  sendTo: 'הודעה ל{name} · בדף הקישור',
  sendNotify: 'להודיע לספק גם בהודעה (וואטסאפ / דוא״ל)',
  sendText: 'נוסח ההודעה',
  notNow: 'לא עכשיו',
  sendToVendor: 'שלח לספק',
  sent: 'ההודעה נשלחה ל{name}',
  notSent: 'נשמר · לא נשלחה הודעה לספק',
  sendFailed: 'ההודעה לא נשלחה',
  decided: 'נשמר',
  // a quote entered on the vendor's behalf (TKUI3B): the entry points, the dialog, the self-approval rule
  obEntry: 'הזנת הצעה בשם הספק',
  obNewVersion: 'הזנת גרסה חדשה בשם הספק',
  obTitle: 'הזנת הצעת מחיר בשם הספק',
  obNotice: 'ההצעה תירשם כהצעה שהוזנה על ידך בשם {vendor}. את ההצעה שהזנת בעצמך אי אפשר לאשר: אדם אחר צריך לאשר אותה.',
  obReplaces: 'גרסה חדשה מחליפה את ההצעה הממתינה של הספק.',
  obWorkFrom: 'תחילת העבודה',
  obWorkTo: 'סיום העבודה',
  obWorkHint: 'התאריכים לא חובה. אפשר מיום אחד אחורה ועד שנה קדימה.',
  obWorkFormat: 'התאריך אינו תקין',
  obWorkRange: 'התאריך מחוץ לטווח המותר',
  obWorkOrder: 'סיום העבודה לפני התחלתה',
  obLinesRequired: 'צריך לפחות שורה אחת תקינה, מסוג מותר',
  obSave: 'הזנת ההצעה',
  obSaved: 'ההצעה הוזנה בשם הספק. אדם אחר צריך לאשר אותה.',
  obOwn: 'את ההצעה הזנת בעצמך: אדם אחר צריך לאשר אותה.',
  selfApproval: 'את ההצעה הזאת הזנת בעצמך: אדם אחר צריך לאשר אותה.',
  obValidUntil: 'תוקף ההצעה',
  obValidHint: 'לא חובה. עד שנה קדימה.',
  obValidFormat: 'התאריך אינו תקין',
  obValidRange: 'התוקף חייב להיות לכל היותר שנה קדימה, ולא יותר מיום אחד אחורה',
  validUntil: 'תוקף ההצעה',
  validExpiredChip: 'התוקף פג',
  expiredConfirmSentence: 'תוקף ההצעה פג ב-{date}. אני מאשר/ת הצעה שתוקפה פג.',
  expiredNeeded: 'צריך לסמן את האישור כדי לאשר הצעה שתוקפה פג',
  expiredRefused: 'תוקף ההצעה פג. סמנו את האישור ונסו שוב.',
} as const;

export type QuoteTextKey = keyof typeof he;

const en: Partial<Record<QuoteTextKey, string>> = packTable<typeof import('../i18n/lang/en/tickets/quote-text').en>('en', 'tickets/quote-text', 'en');

const catalogue = makeCatalogue<QuoteTextKey>(he, en);

/** The raw template of a key in a language; English falls back to Hebrew (the unit tests and the completeness spec read it). */
export const quoteTemplate = catalogue.template;

/** A text of the Costs tab: the template in the screen's language, the module's name rendered (D33), then `{var}`s. */
export const qt = catalogue.t;

export const QUOTE_TEXT_KEYS = catalogue.KEYS;
export const QUOTE_TEXT_EN_KEYS = catalogue.EN_KEYS;

registerCatalogue('tickets/quote-text', { he, en });
