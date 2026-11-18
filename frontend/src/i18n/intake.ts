/**
 * CR-INTAKE99 / TENANTINTAKE098-295: the strings of the free-text request queue (`<tickets-intake-chip>`) and of its settings
 * (`<tickets-intake-settings>`, `<tickets-intake-known>`). Hebrew first; English follows the document language; Arabic and Russian
 * fall back to the Hebrew until a native translation exists (a missing key is never shown as a key). The module's own noun comes from
 * the naming setting (the server renders it); these labels name the queue ("פניות"), not the module. No explanatory paragraphs
 * (clean operator screens): labels and short confirmations only. WhatsApp may be named on a settings screen.
 */
import { docLang, registerCatalogue } from './core';
import { packTable } from './lang-packs';
const he = {
  chip: 'פניות לאישור',
  title: 'פניות בטקסט חופשי',
  empty: 'אין פניות ממתינות',
  back: 'חזרה לרשימה',
  prev: 'הקודם',
  next: 'הבא',
  of: 'מתוך',
  requester: 'פונה',
  unknownRequester: 'לא ידוע',
  text: 'ההודעה',
  evidence: 'מזוהה לפי',
  department: 'מחלקה',
  category: 'קטגוריה',
  place: 'מקום',
  urgency: 'דחיפות',
  titleField: 'כותרת',
  none: 'לא זוהה',
  low: 'נמוכה',
  normal: 'רגילה',
  high: 'גבוהה',
  urgent: 'דחוף',
  conf_high: 'ודאות גבוהה',
  conf_medium: 'ודאות בינונית',
  conf_low: 'ודאות נמוכה',
  conf_none: 'לא זוהה',
  approve: 'אשר ופתח בקשה',
  merge: 'צרף לבקשה קיימת',
  mergeNumber: 'מספר בקשה',
  reject: 'דחה',
  block: 'חסום את השולחן ל-30 ימים',
  save: 'שמור טיוטה',
  approved: 'הבקשה נפתחה',
  merged: 'הפנייה צורפה',
  rejected: 'הפנייה נדחתה',
  saved: 'נשמר',
  changed: 'הפנייה השתנתה. נטען מחדש.',
  notFound: 'לא נמצאה',
  multi: 'ייתכנו כמה נושאים',
  safety: 'בטיחות',
  emergency: 'במקרה חירום חייגו 101 / 102 / 100',
  negated: 'מילת בטיחות בשלילה',
  question: 'נראית כשאלה',
  notRequest: 'נראית כהודעת תודה',
  tooShort: 'קצרה מאוד',
  duplicates: 'ייתכנו כפילויות',
  reason_not_a_request: 'לא פנייה',
  reason_duplicate: 'כפילות',
  reason_spam: 'ספאם',
  reason_abusive: 'פוגענית',
  reason_out_of_scope: 'מחוץ לתחום',
  reason_test: 'בדיקה',
  more: 'הודעות',
  // settings
  setTitle: 'קליטת פניות בטקסט חופשי',
  enabled: 'קליטת פניות פעילה',
  whatsapp: 'קליטה מוואטסאפ',
  defaultDept: 'מחלקת ברירת מחדל',
  pickDept: 'בחרו מחלקה',
  approvalReply: 'תשובה עם מספר הבקשה אחרי אישור',
  unlistedReply: 'תשובה קבועה למספר שאינו ברשימה',
  classifier: 'זיהוי אוטומטי',
  coalesce: 'איחוד הודעות (דקות)',
  perDay: 'פניות למספר ביום',
  perWeek: 'פניות למספר בשבוע',
  perHour: 'פניות בשעה (כללי)',
  perDayAll: 'פניות ביום (כללי)',
  openMax: 'מקסימום ממתינות',
  ttl: 'תוקף טיוטה (ימים)',
  keep: 'שמירת נדחות (ימים)',
  blockDays: 'ימי חסימה',
  unlistedPerDay: 'תשובות למספר ביום',
  saveSetting: 'שמירה',
  failed: 'השמירה נכשלה',
  // known numbers
  knownTitle: 'מספרים שמורשים לפתוח פניות',
  knownEmpty: 'הרשימה ריקה',
  name: 'שם',
  phone: 'נייד',
  org: 'דירה / חברה',
  add: 'הוספה',
  remove: 'הסרה',
  added: 'המספר נוסף',
  removed: 'המספר הוסר',
  alreadyListed: 'המספר כבר ברשימה',
};

type Key = keyof typeof he;

const en: Partial<Record<Key, string>> = packTable<typeof import('./lang/en/i18n/intake').en>('en', 'i18n/intake', 'en');

export type IntakeKey = Key;
export type IntakeLang = 'he' | 'en' | 'ar' | 'ru';

export function intakeLang(): IntakeLang {
  return docLang(['en', 'ar', 'ru']);
}

export const INTAKE_TABLES: Record<IntakeLang, Partial<Record<Key, string>>> = { he, en, ar: {}, ru: {} };
export const INTAKE_KEYS = Object.keys(he) as Key[];

export function itx(key: Key, lang: IntakeLang = intakeLang()): string {
  return INTAKE_TABLES[lang][key] ?? he[key] ?? key;
}

registerCatalogue('i18n/intake', { he, en });
