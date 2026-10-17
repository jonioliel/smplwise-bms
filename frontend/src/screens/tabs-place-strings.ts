import type { DdPlace } from '../shell/tabs-mode';

/**
 * 2026-10-17: the strings of the header dropdown placement card (הגדרות › כללי › לשוניות). Screen-local on purpose: the settings screen
 * is the only reader. Hebrew is the product language; English is used when the document language is English.
 */
const STR = {
  he: {
    title: 'מיקום התפריט הנפתח בכותרת',
    sub: 'במסך רחב (מ־1100 פיקסלים). במסך צר התפריט תמיד בשורה משלו מעל הכותרת',
    inst: 'ברירת המחדל של ההתקנה',
    own: 'ההעדפה שלי',
    follow: 'לפי ההתקנה (כרגע: {v})',
    active: 'מה פעיל אצלי עכשיו:',
    saved: 'ברירת המחדל נשמרה',
    savedOwn: 'ההעדפה נשמרה',
    places: { '1': 'בשורה משלו מעל הכותרת', '2': 'בקצה הרחוק של שורת הכותרת', '3': 'מיד אחרי הכותרת', '4': 'בתחילת שורת הכותרת, לפני הכותרת' } as Record<DdPlace, string>,
  },
  en: {
    title: 'Header dropdown placement',
    sub: 'On a wide screen (1100 px and up). On a narrow screen the dropdown always has its own row above the title',
    inst: 'Installation default',
    own: 'My preference',
    follow: 'Follow the installation (now: {v})',
    active: 'Active for me now:',
    saved: 'Default saved',
    savedOwn: 'Preference saved',
    places: { '1': 'Own row above the title', '2': 'Far end of the title row', '3': 'Right after the title', '4': 'Start of the title row, before the title' } as Record<DdPlace, string>,
  },
};

export function placeStrings(): (typeof STR)['he'] {
  let lang = 'he';
  try {
    lang = document.documentElement.lang || 'he';
  } catch {
    /* no document (unit specs under node) */
  }
  return lang.toLowerCase().startsWith('en') ? STR.en : STR.he;
}
