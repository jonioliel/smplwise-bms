/**
 * CR-ORG-LOCATIONS: the words of the organisation-location screens (Settings > service management > "מיקומי הארגון") and of the
 * location picker in the request / RFQ creation forms. Hebrew is the source; English mirrors it key for key.
 */
import { hasNameTokens, tn } from './naming';
import { ticketsLang } from './text';
import { fillVars } from './catalogue'; // CR-TK-CATALOGUE-2440: the shared template / text / key-list lines
import { registerCatalogue } from '../i18n/core';
import { packTable } from '../i18n/lang-packs';

const he = {
  tab: 'מיקומים',
  title: 'מיקומי הארגון',
  sub: 'כתובות קבועות לבחירה בטופסי {the_tickets} ובקשות הצעת המחיר.',
  add: 'הוספת מיקום',
  edit: 'עריכה',
  save: 'שמירה',
  cancel: 'ביטול',
  deactivate: 'השבתה',
  activate: 'הפעלה',
  remove: 'מחיקה',
  navigate: 'ניווט',
  makeDefault: 'קביעה כברירת מחדל',
  defaultChip: 'ברירת מחדל',
  inactiveChip: 'מושבת',
  inUse: 'בשימוש ב-{n}',
  empty: 'עדיין לא הוגדרו מיקומים.',
  loading: 'טוען מיקומים',
  fName: 'שם המיקום',
  fStreet: 'רחוב ומספר',
  fCity: 'עיר',
  fDetails: 'פרטים נוספים',
  fDetailsPh: 'בניין, קומה, כניסה, הוראות גישה',
  fCoords: 'קואורדינטות (לא חובה)',
  fLat: 'קו רוחב',
  fLng: 'קו אורך',
  fSort: 'סדר',
  fActive: 'פעיל',
  fArea: 'אזור בתוכנית (לא חובה)',
  areaNone: 'ללא קישור לתוכנית',
  areaMissing: 'אזור מקושר (אין הרשאה להציג אותו)',
  areaLinked: 'מקושר לתוכנית: {name}',
  showOnMap: 'הצגה במפה',
  err_area: 'האזור לא נמצא או שאין הרשאה לקשר אליו',
  fDefault: 'ברירת המחדל של הארגון',
  deptTitle: 'ברירת מחדל לפי מחלקה',
  deptSub: 'לא חובה. ברירת המחדל של המחלקה גוברת על זו של הארגון.',
  deptNone: 'לפי ברירת המחדל של הארגון',
  err_required: 'נא למלא שם',
  err_too_long: 'הטקסט ארוך מדי',
  err_duplicate: 'כבר קיים מיקום בשם הזה',
  err_address: 'נא למלא רחוב או עיר',
  err_url: 'בלי קישורים בטקסט',
  err_coords: 'קו רוחב בין ‎-90 ל-90 וקו אורך בין ‎-180 ל-180, שניהם יחד',
  err_in_use: 'המיקום כבר משמש בקשות קיימות. אפשר להשבית אותו במקום למחוק.',
  err_inactive_default: 'מיקום מושבת לא יכול להיות ברירת מחדל',
  saved: 'המיקום נשמר',
  removed: 'המיקום נמחק',
  confirmRemove: 'למחוק את המיקום "{name}"?',
  retry: 'נסו שוב',
  // the picker of the creation forms
  fLocation: 'מיקום',
  pickNone: 'ללא מיקום',
  pickOther: 'אחר (טקסט חופשי)',
  otherPh: 'למשל: חדר הישיבות בקומה 2',
  otherLabel: 'מיקום אחר',
  manage: 'ניהול מיקומים',
  navOn: 'לצרף קישור ניווט להודעה',
  navOnSub: 'הספק יקבל קישור למפה לפי הקואורדינטות של המיקום.',
  navNoCoords: 'למיקום הזה לא הוגדרו קואורדינטות.',
};

export type LocTextKey = keyof typeof he;

const en: Record<LocTextKey, string> = packTable<typeof import('../i18n/lang/en/tickets/org-locations-text').en>('en', 'tickets/org-locations-text', 'en');

export const LOC_TEXT_HE: Readonly<Record<LocTextKey, string>> = he;
export const LOC_TEXT_EN: Readonly<Record<LocTextKey, string>> = en;

/** CR-TK-CATALOGUE-2440: was `lt`, the same short name as list-text's (review 08:F07). */
export function loct(key: LocTextKey, vars?: Record<string, string | number>): string {
  const s = (ticketsLang() === 'en' ? en[key] : he[key]) ?? he[key];
  const out = fillVars(s, vars);
  return hasNameTokens(out) ? tn(out) : out; // D33: the module's name through the naming tokens (integ/264)
}

registerCatalogue('tickets/org-locations-text', { he: LOC_TEXT_HE, en: LOC_TEXT_EN });
