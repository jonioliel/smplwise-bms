/**
 * VENDORARRIVAL126-295: the words of the settings card for the vendor's "I have arrived" tap and the missed-arrival alert. Hebrew first,
 * English second (the settings screens are he / en today). Only the settings screen imports this file.
 */
import { ticketsLang } from './text';

const he = {
  card: 'הגעת ספק לאתר',
  on: 'כפתור "הגעתי" בדף הספק והתראה על ספק שלא הגיע',
  onSub: 'כבוי כברירת מחדל. הספק לוחץ פעם אחת בדף שלו; ההתראה נשלחת אם המועד הצפוי עבר ולא נרשמה הגעה. הדף לא פותח שום דלת.',
  window: 'אורך חלון ברירת מחדל',
  windowSub: 'למועד הגעה בלי שעת סיום (15–1440 דקות)',
  day: 'שעות היום כשנקבע רק תאריך',
  daySub: 'החלון הוא מהשעה הראשונה עד השנייה, באזור הזמן של ההתקנה',
  grace: 'סבלנות אחרי סוף החלון',
  graceSub: 'דקות עד להתראה (0–720)',
  repeat: 'חזרה על ההתראה',
  repeatSub: 'כל כמה דקות (0 = פעם אחת בלבד)',
  max: 'מספר התראות מרבי',
  maxSub: '1–5 לכל חלון',
  managers: 'מנהלי המחלקה מקבלים את ההתראה',
  managersSub: 'כל אחד רק לבקשות שהוא רשאי לראות',
  users: 'עוד נמענים',
  addUser: 'הוספת משתמש',
  remove: 'הסרת {name}',
  offer: 'הפניה לבקשת קוד כניסה אחרי ההגעה',
  offerSub: 'הבקשה עצמה עוברת תמיד אישור של מנהל; דורש שכרטיס "כניסה לאתר" זמין',
  save: 'שמירה',
  minutes: 'דק׳',
  errRange: 'ערך מחוץ לטווח',
  errDay: 'שעת הסיום חייבת להיות אחרי שעת ההתחלה',
  saved: 'נשמר',
} as const;

const en: Record<keyof typeof he, string> = {
  card: 'Vendor arrival on site',
  on: '"I have arrived" button on the vendor page and a missed-arrival alert',
  onSub: 'Off by default. The vendor taps once on his page; the alert goes out if the expected time passed with no arrival recorded. The page never opens a door.',
  window: 'Default window length',
  windowSub: 'For an arrival time with no end (15-1440 minutes)',
  day: 'Day hours when only a date is set',
  daySub: 'The window runs from the first time to the second, in the installation time zone',
  grace: 'Grace after the window ends',
  graceSub: 'Minutes before the alert (0-720)',
  repeat: 'Repeat the alert',
  repeatSub: 'Every how many minutes (0 = once only)',
  max: 'Maximum alerts',
  maxSub: '1-5 per window',
  managers: 'The department managers receive the alert',
  managersSub: 'Each only for the requests he may see',
  users: 'Additional recipients',
  addUser: 'Add a user',
  remove: 'Remove {name}',
  offer: 'Point to the entry-code request after arrival',
  offerSub: 'The request itself always needs a manager approval; needs the "Site access" card to be available',
  save: 'Save',
  minutes: 'min',
  errRange: 'Value out of range',
  errDay: 'The end time must be after the start time',
  saved: 'Saved',
};

export type VaKey = keyof typeof he;

export function vat(key: VaKey, vars?: Record<string, string | number>): string {
  const raw = ticketsLang() === 'en' ? en[key] : he[key];
  return vars ? raw.replace(/\{(\w+)\}/g, (m, k: string) => (k in vars ? String(vars[k]) : m)) : raw;
}
