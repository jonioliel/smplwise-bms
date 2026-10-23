/**
 * VENDORARRIVAL126B-295: the words of the settings card for planned vendor visits (the vendor's "I have arrived" tap on his page and the
 * missed-arrival detector). Hebrew first, English second (the settings screens are he / en today). Only the settings screen imports this.
 */
import { ticketsLang } from './text';

const he = {
  card: 'ביקורי ספקים והגעה לאתר',
  enabled: 'ביקורי ספקים',
  enabledSub: 'ביקור מתוכנן לכל ספק חיצוני, זיהוי ספק שלא הגיע והתראה למנהל',
  publicArrival: 'כפתור "הגעתי" בדף הספק',
  publicArrivalSub: 'הספק לוחץ פעם אחת בדף שלו; לחיצה היא דיווח שלו ולא הוכחת נוכחות, והדף לא פותח שום דלת',
  claimCounts: 'דיווח הספק נחשב הגעה',
  claimCountsSub: 'כבוי: הדיווח נשאר "דווח" עד שמנהל מאשר',
  offer: 'הפניה לבקשת קוד כניסה אחרי ההגעה',
  offerSub: 'כבוי כברירת מחדל. הבקשה עצמה עוברת תמיד אישור של מנהל; דורש שכרטיס "כניסה לאתר" זמין',
  notifyVendor: 'תזכורת לספק שלא הגיע',
  notifyVendorSub: 'כבוי כברירת מחדל; ההודעה נשלחת רק בשעות השליחה המותרות',
  grace: 'סבלנות אחרי סוף החלון',
  graceSub: 'דקות עד שביקור נחשב כלא הגיע (0–240)',
  early: 'הכפתור נפתח לפני החלון',
  earlySub: 'דקות לפני תחילת החלון (0–720)',
  save: 'שמירה',
  minutes: 'דק׳',
  errRange: 'ערך מחוץ לטווח',
} as const;

const en: Record<keyof typeof he, string> = {
  card: 'Vendor visits and arrival on site',
  enabled: 'Vendor visits',
  enabledSub: 'A planned visit for each outside vendor, detection of a vendor who did not arrive, and an alert to the manager',
  publicArrival: '"I have arrived" button on the vendor page',
  publicArrivalSub: 'The vendor taps once on his page; the tap is his own report, not proof of presence, and the page never opens a door',
  claimCounts: 'The vendor report counts as an arrival',
  claimCountsSub: 'Off: the report stays "reported" until a manager confirms',
  offer: 'Point to the entry-code request after arrival',
  offerSub: 'Off by default. The request itself always needs a manager approval; needs the "Site access" card to be available',
  notifyVendor: 'Reminder to a vendor who did not arrive',
  notifyVendorSub: 'Off by default; sent only within the allowed send hours',
  grace: 'Grace after the window ends',
  graceSub: 'Minutes before a visit counts as missed (0-240)',
  early: 'The button opens before the window',
  earlySub: 'Minutes before the window starts (0-720)',
  save: 'Save',
  minutes: 'min',
  errRange: 'Value out of range',
};

export type VsKey = keyof typeof he;

export function vst(key: VsKey): string {
  return ticketsLang() === 'en' ? en[key] : he[key];
}
