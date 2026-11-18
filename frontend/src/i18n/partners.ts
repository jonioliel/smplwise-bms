/**
 * PARTNERAPI113-295: the words of the "Partner interface" card (Settings › Connections). Hebrew first; English follows the document
 * language; Arabic and Russian fall back to the Hebrew until a translation is reviewed (dev-marked). Short texts only; no home-system
 * branding.
 */
import { docLang, fill, registerCatalogue } from './core';
import { packTable } from './lang-packs';
const he = {
  title: 'ממשק לשותפים',
  stateOff: 'כבוי',
  stateOn: 'פעיל',
  stateBlocked: 'ממתין לאישור הפעלה',
  apiSwitch: 'גישת קריאה לשותפים',
  webhooksSwitch: 'שליחת הודעות לשותפים',
  notPermitted: 'ההפעלה דורשת סקירת אבטחה ואישור בעלים.',
  localOnly: 'הפעלה רק מהרשת המקומית. כיבוי אפשרי מכל מקום.',
  tabPartners: 'שותפים',
  tabTokens: 'אסימונים',
  tabEndpoints: 'יעדי הודעות',
  tabLog: 'יומן משלוחים',
  tabSettings: 'הגדרות',
  partner: 'שותף',
  partnerName: 'שם השותף',
  addPartner: 'הוספת שותף',
  disable: 'השבתה',
  enable: 'הפעלה',
  remove: 'מחיקה',
  confirmRemove: 'למחוק? כל האסימונים והיעדים של השותף יבוטלו.',
  confirmRemoveEndpoint: 'למחוק את היעד? הודעות שבתור לא יישלחו.',
  none: 'אין',
  label: 'תיאור',
  scopes: 'הרשאות גישה',
  sc_tickets_read: 'קריאת קריאות שירות',
  sc_tickets_create: 'פתיחת קריאות שירות',
  sc_temperature_read: 'יחידות טמפרטורה',
  sc_elevators_read: 'מעליות',
  restriction: 'תחום',
  rk_installation: 'כל ההתקנה',
  rk_site: 'אתרים',
  rk_building: 'מבנים',
  rk_floor: 'קומות',
  departments: 'מחלקות',
  sourceCidrs: 'כתובות מקור מותרות (אופציונלי)',
  expiresDays: 'תוקף בימים',
  textOption: 'כותרת ותיאור הקריאה',
  peopleOption: 'שמות מבקש ומטפל',
  createToken: 'יצירת אסימון',
  rotate: 'החלפה',
  revoke: 'ביטול',
  confirmRevoke: 'לבטל את האסימון? השותף יאבד גישה מיד.',
  shownOnce: 'מוצג פעם אחת בלבד. העתיקו ושמרו עכשיו.',
  copy: 'העתקה',
  copied: 'הועתק',
  close: 'סגירה',
  expires: 'בתוקף עד',
  lastUsed: 'שימוש אחרון',
  st_active: 'פעיל',
  st_expired: 'פג תוקף',
  st_revoked: 'בוטל',
  st_pending: 'ממתין לבדיקה',
  st_paused: 'מושהה',
  st_disabled: 'מושבת',
  ownerGone: 'יוצר האסימון אינו פעיל',
  url: 'כתובת יעד (https, פורט {ports})',
  events: 'אירועים',
  skipOwn: 'לא לשלוח לשותף על קריאות שהוא פתח',
  createEndpoint: 'הוספת יעד',
  ping: 'בדיקה',
  pingOk: 'הבדיקה הצליחה',
  pingFail: 'הבדיקה נכשלה',
  pause: 'השהיה',
  resume: 'חידוש',
  rotateSecret: 'החלפת סוד',
  queued: 'בתור',
  dead: 'נכשלו',
  redeliver: 'שליחה חוזרת',
  attempt: 'ניסיון',
  status: 'תוצאה',
  ev_ticket_created: 'קריאה נפתחה',
  ev_ticket_status_changed: 'סטטוס קריאה השתנה',
  ev_ticket_done: 'טיפול הסתיים',
  ev_temperature_alarm: 'אזעקת טמפרטורה',
  ev_temperature_warning: 'חריגת טמפרטורה',
  ev_temperature_offline: 'חיישן טמפרטורה לא מדווח',
  ev_temperature_escalation: 'הסלמת אזעקת טמפרטורה',
  ev_temperature_resolved: 'טמפרטורה חזרה לתקינות',
  ev_elevator_fault: 'תקלת מעלית',
  ev_elevator_out_of_service: 'מעלית בהשבתה',
  ev_elevator_fire_service: 'מעלית בפיקוד כבאים',
  ev_elevator_resolved: 'מעלית חזרה לפעולה',
  v_token_default_days: 'תוקף ברירת מחדל (ימים)',
  v_token_max_days: 'תוקף מרבי (ימים)',
  v_max_endpoints: 'מספר יעדים מרבי',
  v_rate_per_min: 'בקשות לדקה לאסימון',
  v_rate_per_hour: 'בקשות לשעה לאסימון',
  v_create_per_hour: 'פתיחת קריאות לשעה',
  v_create_per_day: 'פתיחת קריאות ליום',
  v_expiry_notice_days: 'התראה לפני פקיעה (ימים)',
  v_rotation_overlap_hours: 'חפיפה בהחלפה (שעות)',
  save: 'שמירה',
  saved: 'נשמר',
  cancel: 'ביטול',
  choosePartner: 'בחירת שותף',
};
type Key = keyof typeof he;

const en: Partial<Record<Key, string>> = packTable<typeof import('./lang/en/i18n/partners').en>('en', 'i18n/partners', 'en');

export type PtLang = 'he' | 'en' | 'ar' | 'ru';
const TABLES: Record<PtLang, Partial<Record<Key, string>>> = { he, en, ar: {}, ru: {} };
/** Columns without a reviewed translation (they show the Hebrew). */
export const PT_DEV_MARKED: readonly PtLang[] = ['ar', 'ru'];

export function ptLang(): PtLang {
  return docLang(['en', 'ar', 'ru']);
}

export function pt(key: Key, vars?: Record<string, string | number>, lang: PtLang = ptLang()): string {
  const raw = TABLES[lang][key] ?? he[key] ?? key;
  return fill(raw, vars);
}

/** A code (scope, event, state, restriction kind, setting) as words; an unknown code falls back to the code itself. */
export function ptCode(prefix: 'sc_' | 'ev_' | 'st_' | 'rk_' | 'v_', code: string, lang: PtLang = ptLang()): string {
  const k = `${prefix}${code.replace(/\./g, '_')}` as Key;
  return k in he ? pt(k, undefined, lang) : code;
}

export const PT_KEYS = Object.keys(he) as Key[];
export const PT_TABLES = TABLES;

registerCatalogue('i18n/partners', { he, en }, PT_DEV_MARKED);
