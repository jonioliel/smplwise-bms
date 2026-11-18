/**
 * TKUI1 (release 2.6.0, the v5 request drawer): the words of the status block, the one-sentence status (`sentenceFor`), the warning
 * line, the tabs and the Overview tab. A catalogue of its own beside tickets/text.ts (the board-text.ts pattern), so the sibling tasks
 * (TKUI2 conversation / history, TKUI3 costs, TKUI4 list / table / board) add their keys without editing the same lines.
 *
 * The tickets/text.ts contract (D33): Hebrew first, the English column falls back to the Hebrew, every text that names the module is a
 * template with the tokens of tickets/naming.ts (`{ticket}`, `{the_ticket}`, `{f:..|m:..}`) rendered with the configured name, and the
 * `{var}`s are filled after the name tokens. The default name is never written here (tests/unit-tickets-naming.spec.ts).
 * The retired term of the cost flow is not used: before the work = "הצעת מחיר", after the work = "דרישת תשלום" (IA §3.4).
 */
import { makeCatalogue } from './catalogue'; // CR-TK-CATALOGUE-2440: the shared template / text / key-list lines
import { registerCatalogue } from '../i18n/core';
import { packTable } from '../i18n/lang-packs';

const he = {
  // ---- the status block (IA §3.2): the sentence per state, manager view; {name} = the handler, {when} = a relative time
  sn_new: 'ממתין לשיוך מטפל · {f:נפתחה|m:נפתח} {when} על ידי {who}',
  sn_new_requester: '{f:התקבלה|m:התקבל} · ממתין לשיוך מטפל',
  sn_assigned_user: 'נמסר ל{name} · ממתין לאישור קבלה',
  sn_assigned_user_handler: 'נמסר לך · ממתין לאישור הקבלה שלך',
  sn_assigned_sent: 'נשלח ל{name}{via} {when} · הקישור טרם נפתח',
  sn_assigned_opened: '{name} פתח/ה את הקישור · ממתין לאישור קבלה',
  sn_assigned_contact: 'נמסר ל{name} · ממתין לאישור קבלה',
  sn_assigned_requester: 'נמסר למטפל · ממתין לאישור קבלה',
  via_whatsapp: ' בוואטסאפ',
  via_email: ' בדוא״ל',
  sn_ack: '{name} אישר/ה קבלה · צפי: {eta}',
  sn_ack_handler: 'אישרת קבלה · צפי: {eta}',
  sn_ack_requester: 'המטפל אישר קבלה · צפי: {eta}',
  sn_progress_eta: '{name} מטפל/ת · צפי {eta}',
  sn_progress_quiet: '{name} מטפל/ת · ללא עדכון מאז {when}',
  sn_progress_handler: 'בטיפולך · צפי: {eta}',
  sn_progress_requester: 'בטיפול · צפי: {eta}',
  sn_part: '{name} ממתין/ה לחלק · צפי {eta}',
  sn_part_handler: 'ממתין לחלק · צפי: {eta}',
  sn_part_requester: 'בטיפול · ממתין לחלק',
  sn_done: '{name} סימן/ה "בוצע" {when} · ממתין לאישורך ולסגירה',
  sn_done_other: '{name} סימן/ה "בוצע" {when} · ממתין לאישור המנהל ולסגירה',
  sn_done_claim_mine: '{name} סימן/ה "בוצע" {when} · דרישת תשלום ממתינה לאישורך',
  sn_done_claim_other: '{name} סימן/ה "בוצע" {when} · דרישת תשלום ממתינה לאישור',
  sn_done_claim_awaiting: '{name} סימן/ה "בוצע" {when} · ממתין לדרישת תשלום מהספק',
  sn_done_handler: 'סימנת "בוצע" {when} · ממתין לאישור המנהל ולסגירה',
  sn_done_requester: 'הטיפול הסתיים · ממתין לסגירה',
  sn_returned: '{name} החזיר/ה: {reason} · ממתין לשיוך מחדש',
  sn_returned_plain: '{f:הוחזרה|m:הוחזר} · ממתין לשיוך מחדש',
  sn_returned_requester: '{f:הוחזרה|m:הוחזר} למנהל · ממתין לשיוך מחדש',
  reason_not_mine: 'לא בתחומי',
  sn_closed: '{f:נסגרה|m:נסגר} {when} על ידי {who}',
  sn_closed_plain: '{f:נסגרה|m:נסגר} {when}',
  sn_cancelled: '{f:בוטלה|m:בוטל} {when}',
  sn_duplicate: 'כפילות של #{n}',
  eta_none: 'לא נמסר',
  eta_today: 'היום {time}',
  eta_tomorrow: 'מחר {time}',
  eta_date: '{date} {time}',
  handlerWord: 'המטפל',
  you: 'לך',

  // ---- the warning line (IA §3.3 rule 5: one item, ranked)
  w_send_failed: 'ההודעה לא נשלחה · שלחו שוב',
  w_link_expired: 'הקישור פג · שלחו קישור חדש',
  w_code_locked: 'נעילת קוד · שלחו קישור חדש',
  w_contact_changed: 'פרטי איש הקשר השתנו · שלחו קישור חדש',
  w_user_inactive: 'העובד אינו זמין · יש לשייך מחדש',
  w_stuck: '{reason}',
  w_stuck_reminders: '{reason} · נשלחו {n} תזכורות',
  w_stuck_reminder: '{reason} · נשלחה תזכורת',
  w_late_reply: 'תשובה מהמטפל הגיעה באיחור · לבדיקה',
  w_question: 'המטפל שואל אותך שאלה · השיבו בשיחה',
  w_reply: 'תשובה מהמטפל ממתינה לבדיקה',

  // ---- SLA (only when near or crossed; otherwise a quiet row in Overview)
  slaNear: 'יעד בעוד {dur}',
  slaOver: 'חריגה מהיעד · {dur}',
  slaFar: 'יעד בעוד {dur} · בתוך היעד',

  // ---- the block, the header and the actions
  statusGroup: 'מצב {the_ticket}',
  flowLabel: 'שלבי {the_ticket}',
  more: 'עוד פעולות',
  moveGroup: 'שינוי מצב',
  a_assign: 'שיוך מטפל',
  a_reassign: 'שיוך מחדש',
  a_ack: 'קיבלתי',
  a_start: 'בטיפול',
  a_done: 'בוצע',
  a_back: 'חזרה לטיפול',
  a_waitMark: 'סמן: ממתין לחלק',
  a_close: 'אישור וסגירה',
  a_closeMenu: 'סיום וסגירה',
  a_approveClaim: 'אישור דרישת התשלום',
  a_markPaid: 'סימון כשולם',
  a_resend: 'שלח שוב',
  a_update: 'עדכון ל{name}',
  a_note: 'הוספת הערה',
  a_reopen: 'פתיחה מחדש',
  a_cancel: 'סגירה ללא טיפול',
  a_eta: 'צפי סיום',
  a_return: 'החזרה',
  a_edit: 'עריכת הפרטים',
  a_page: 'פתיחה בדף מלא',
  a_toDrawer: 'למגירה',
  size: 'גודל התצוגה',
  size_drawer: 'מגירה צדדית',
  size_wide: 'פאנל רחב',
  size_full: 'מסך מלא',
  sheetHalf: 'כרטיס מקוצר',
  sheetFull: 'מסך מלא',
  showAll: 'הצג הכול',

  // ---- the tabs (IA §4.1); the badge is part of the accessible name
  tabs: 'לשוניות {the_ticket}',
  tab_overview: 'סקירה',
  tab_conv: 'שיחה',
  tab_costs: 'עלויות',
  tab_history: 'היסטוריה',
  badgeConvOne: 'הודעה אחת חדשה',
  badgeConvMany: '{n} הודעות חדשות',
  badgeCostsOne: 'פריט אחד ממתין לאישורך',
  badgeCostsMany: '{n} פריטים ממתינים לאישורך',

  // ---- Overview (IA §4.1, §6.1)
  ovPeople: 'אנשים',
  ovNow: 'עכשיו',
  ovFacts: 'פרטי {the_ticket}',
  ovPhotos: 'תמונות',
  ovDevice: 'היסטוריית ההתקן',
  noHandler: 'אין עדיין מטפל',
  roleVendor: 'גורם חיצוני',
  roleStaff: 'עובד',
  roleUser: 'מטפל',
  // ---- the internal owner (TKUI3B, contract v1.4 section 2)
  ownerLabel: 'אחראי בארגון',
  ownerNone: 'אין עדיין אחראי בארגון',
  ownerInactive: 'לא פעיל',
  ownerChange: 'החלפה',
  ownerSet: 'קביעת אחראי',
  ownerTitle: 'אחראי בארגון',
  ownerHelp: 'האחראי בארגון הוא מי שאחראי על {the_ticket} מול הגורם החיצוני. הוא אינו המטפל, והחלפתו לא משנה את המטפל.',
  ownerPick: 'מי יהיה האחראי',
  ownerNoOne: 'ללא אחראי',
  ownerCurrent: 'האחראי הנוכחי',
  ownerReason: 'סיבה (לא חובה)',
  ownerConfirm: 'האחראי בארגון יהיה {name}. ההחלפה תירשם בהיסטוריה.',
  ownerConfirmClear: 'לא יהיה אחראי בארגון. ההסרה תירשם בהיסטוריה.',
  ownerSave: 'שמירת האחראי',
  ownerSaved: 'האחראי בארגון עודכן',
  ownerNoCandidates: 'אין במחלקה הזו מי שאפשר לקבוע כאחראי',
  linkActive: 'קישור פעיל · נפתח {n} פעמים',
  linkNotOpened: 'הקישור טרם נפתח',
  linkOther: 'הקישור אינו פעיל',
  linkAudit: 'ביקורת הקישור',
  requesterLine: '{who} פתח/ה את {the_ticket} · {when}',
  nowEta: 'צפי',
  nowLast: 'הודעה אחרונה',
  nowCost: 'עלויות',
  nowSla: 'יעד',
  toConv: 'לשיחה',
  toCosts: 'לעלויות',
  toHistory: 'להיסטוריה',
  fPlace: 'מיקום',
  fDevice: 'התקן',
  fDept: 'מחלקה · קטגוריה',
  fPriority: 'עדיפות',
  fOpened: '{f:נפתחה|m:נפתח}',
  fDescription: 'תיאור',
  fDuplicate: 'כפילות',
  fRfqOrigin: 'הזמנת עבודה',
  rfqOrigin: '{f:נפתחה|m:נפתח} מבקשת הצעת מחיר {ref}',
  rfqSiblings: 'מאותה בקשה: {list}',
  rfqVendorFiles: 'קבצים מהספק',
  fCloseNote: 'סיכום',
  descMore: 'עוד',
  descLess: 'פחות',
  photosMore: '+{n}',
  photosAll: 'כל התמונות',

  // ---- cost words of the Overview line (the Costs tab itself is TKUI3)
  cs_awaiting: 'ממתין לדרישת תשלום מהספק',
  cs_submitted_mine: 'דרישת תשלום ממתינה לאישורך',
  cs_submitted: 'דרישת תשלום ממתינה לאישור',
  cs_rejected: 'הוחזרה לספק לתיקון',
  cs_approved: 'דרישת התשלום אושרה',
  cs_paid: 'שולם',

  // ---- the tabs whose content the sibling tasks build (TKUI2 / TKUI3): a quiet line above the reused blocks
  slotConv: 'הודעות והערות',
  costsEmpty: 'לא נדרשת הצעת מחיר או דרישת תשלום',
  slotHistory: 'ציר זמן וביקורת',

  // ---- the new-request sheet: the handler choice in three groups (owner 16.10)
  cg_account: 'עם חשבון',
  cg_staff: 'ללא חשבון',
  cg_vendor: 'ספקים וגורמים חיצוניים',
  cgSearch: 'חיפוש מטפל או ספק',
  cgNoMatch: 'אין תוצאות לחיפוש',
  cgVendorNext: '{the_ticket} {f:תיפתח|m:ייפתח} ללא שיוך, ומיד ייפתח אישור השליחה לספק',

  // ---- Settings › the module › display (the two drawer rows)
  setDrawerTab: 'לשונית ברירת המחדל',
  setDrawerTabSub: 'הלשונית שנפתחת עם {the_ticket}',
  setDrawerSize: 'גודל המגירה במחשב',
  setDrawerSizeSub: 'כל משתמש יכול לשנות לעצמו',
  setPhoneSheet: 'פתיחה בטלפון',
  setPhoneSheetSub: 'כרטיס מקוצר או מסך מלא',
  ps_half: 'כרטיס מקוצר',
  ps_full: 'מסך מלא',
};

export type DrawerTextKey = keyof typeof he;

const en: Partial<Record<DrawerTextKey, string>> = packTable<typeof import('../i18n/lang/en/tickets/drawer-text').en>('en', 'tickets/drawer-text', 'en');

/** The raw template of a key (the unit tests read it). */
const catalogue = makeCatalogue<DrawerTextKey>(he, en);

/** The raw template of a key in a language; English falls back to Hebrew (the unit tests and the completeness spec read it). */
export const drawerTemplate = catalogue.template;

/** A text of the drawer: the template in the document's language, the module's name rendered (D33), then the `{var}`s. */
export const dwt = catalogue.t;

export const DRAWER_TEXT_KEYS = catalogue.KEYS;
export const DRAWER_TEXT_EN_KEYS = catalogue.EN_KEYS;

registerCatalogue('tickets/drawer-text', { he, en });
