/**
 * VENDORARRIVAL126B-295: the words of the settings card for planned vendor visits (the vendor's "I have arrived" tap on his page and the
 * missed-arrival detector). Hebrew first, English second (the settings screens are he / en today). Only the settings screen imports this.
 */
import { ticketsLang } from './text';
import { registerCatalogue } from '../i18n/core';
import { packTable } from '../i18n/lang-packs';

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

const en: Record<keyof typeof he, string> = packTable<typeof import('../i18n/lang/en/tickets/visits-settings-text').en>('en', 'tickets/visits-settings-text', 'en');

type VsKey = keyof typeof he;

export function vst(key: VsKey): string {
  return ticketsLang() === 'en' ? en[key] : he[key];
}

registerCatalogue('tickets/visits-settings-text', { he, en });
