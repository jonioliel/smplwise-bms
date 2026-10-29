import { ptLang } from './presence';

/**
 * BUILDING-PRESENCE-2271 / PRESENCE-2280: the words of the building-presence chip and card (overview), the plan-map chips and the settings page.
 * Hebrew first; English follows the document language (a missing English key falls back to the Hebrew). Short, no paragraphs, no platform
 * names. A person is never named: the numbers are rooms, not people.
 */
const he = {
  chipLabel: 'נוכחות במבנה',
  occupied: 'פעיל',
  occupiedRooms: (n: number) => (n === 1 ? 'חדר אחד' : `${n} חדרים`),
  empty: 'ריק',
  emptySince: (hhmm: string) => `ריק מ־${hhmm}`,
  unknown: 'אין מידע',
  heading: 'נוכחות במבנה',
  subheading: 'חיישני נוכחות שסומנו',
  noSensors: 'לא נמצאו חיישני נוכחות',
  tagged: 'מסומן',
  noRoom: 'ללא חדר',
  holdLabel: 'השהיה אחרי שהחיישן נרגע',
  holdUnit: 'שניות',
  emptyLabel: 'מבנה נחשב ריק אחרי',
  emptyUnit: 'דקות',
  save: 'שמירה',
  saved: 'נשמר',
  statusWord: { occupied: 'פעיל', clear: 'ריק', unknown: 'אין מידע' } as const,
  stateWord: (s: string | null) => (s === 'on' ? 'זוהתה נוכחות' : s === 'off' ? 'ללא נוכחות' : 'לא זמין'),
  tooManyHint: 'עד 200 חיישנים',
  // PRESENCE-2280
  masterLabel: 'מעקב נוכחות במבנה',
  masterHint: 'כבוי כברירת מחדל. כשכבוי לא נקראים חיישנים, לא נשמרת היסטוריה ושום דבר לא מוצג.',
  masterOffNote: 'המעקב כבוי',
  tagNote: 'הסימון נשמר ב־Arx בלבד; החיישן עצמו לא משתנה',
  roomPick: 'בחירת חדר',
  ownRoom: 'החדר לפי המערכת',
  homeLabel: 'במסך הראשי',
  homeCard: 'כרטיס',
  homeChip: 'שורה דקה',
  homeOff: 'כבוי',
  tintLabel: 'נוכחות על המפה',
  tintHint: 'תגית פעיל / ריק מ־… על כל חדר עם חיישן',
  historyHeading: 'היסטוריית נוכחות',
  retentionLabel: 'לשמור ימים (0 = לא לשמור)',
  retentionUnit: 'ימים',
  privacy: 'נשמר רק מתי כל חדר התחיל ונגמר להיות פעיל. בלי שמות, בלי טלפונים, בלי תמונות. גם כך אפשר ללמוד מזה על הרגלי עבודה, לכן כדאי לשמור רק כמה שצריך.',
  rowsKept: 'רשומות שמורות',
  oldest: 'הישנה ביותר',
  purge: 'מחיקת כל ההיסטוריה',
  purgeTitle: 'למחוק את כל היסטוריית הנוכחות?',
  purgeBody: (n: number) => `${n} רשומות יימחקו. אי אפשר לשחזר. המצב הנוכחי במפה ובמסך הראשי לא ייפגע.`,
  purgeConfirm: 'מחיקה',
  cancel: 'ביטול',
  purged: 'ההיסטוריה נמחקה',
  tab: 'חיישנים במבנה',
  timesHeading: 'זמנים ותצוגה',
  cardSub: (n: number, of: number) => `${n} מתוך ${of} חדרים עם חיישן פעילים`,
  cardAllEmpty: (of: number) => `כל ${of} החדרים ריקים`,
  cardNoInfo: 'החיישנים לא מדווחים',
  cardNote: 'חדרים, לא אנשים · בלי שמות',
  updated: (hhmm: string) => `עודכן ${hhmm}`,
  // mockup alignment
  found: 'נמצאו',
  filterLabel: 'סינון חיישנים',
  filterAll: 'הכל',
  filterTagged: 'מסומנים',
  filterUntagged: 'לא מסומנים',
  kindWord: (k: string | null) => (k === 'motion' ? 'חיישן תנועה' : 'חיישן נוכחות'),
  editTitle: 'עריכת סימון',
  stateNow: 'מצב עכשיו',
  removeTag: 'הסרת הסימון',
  close: 'סגירה',
  moreRooms: (n: number) => `ועוד ${n}`,
  onMap: 'במפה',
};
type Key = keyof typeof he;

const en: Partial<Record<Key, unknown>> = {
  chipLabel: 'Building presence', occupied: 'Active', occupiedRooms: (n: number) => (n === 1 ? '1 room' : `${n} rooms`), empty: 'Empty',
  emptySince: (hhmm: string) => `Empty since ${hhmm}`, unknown: 'No data', heading: 'Building presence', subheading: 'Tagged presence sensors',
  noSensors: 'No presence sensors found', tagged: 'tagged', noRoom: 'No room', holdLabel: 'Hold after the sensor calms down', holdUnit: 'seconds',
  emptyLabel: 'Building counts as empty after', emptyUnit: 'minutes', save: 'Save', saved: 'Saved',
  statusWord: { occupied: 'Active', clear: 'Empty', unknown: 'No data' }, stateWord: (s: string | null) => (s === 'on' ? 'Presence detected' : s === 'off' ? 'No presence' : 'Unavailable'),
  tooManyHint: 'Up to 200 sensors', masterLabel: 'Building presence tracking',
  masterHint: 'Off by default. While off, no sensor is read, no history is kept and nothing is shown.', masterOffNote: 'Tracking is off',
  tagNote: 'The tag is stored in Arx only; the sensor itself is not changed', roomPick: 'Choose a room', ownRoom: 'Room from the system', homeLabel: 'On the home screen',
  homeCard: 'Card', homeChip: 'Thin line', homeOff: 'Off', tintLabel: 'Presence on the map', tintHint: 'An Active / Empty since tag on every room with a sensor',
  historyHeading: 'Presence history', retentionLabel: 'Keep days (0 = keep none)', retentionUnit: 'days',
  privacy: 'Only when each room started and stopped being active is kept. No names, no phones, no pictures. Even so, work habits can be learned from it, so keep it only as long as needed.',
  rowsKept: 'Records kept', oldest: 'Oldest', purge: 'Delete all history', purgeTitle: 'Delete all presence history?',
  purgeBody: (n: number) => `${n} records will be deleted. This cannot be undone. The current state on the map and home screen is not affected.`,
  purgeConfirm: 'Delete', cancel: 'Cancel', purged: 'History deleted', tab: 'Building sensors', timesHeading: 'Times and display',
  cardSub: (n: number, of: number) => `${n} of ${of} rooms with a sensor are active`, cardAllEmpty: (of: number) => `All ${of} rooms are empty`,
  cardNoInfo: 'The sensors are not reporting', cardNote: 'Rooms, not people · no names', updated: (hhmm: string) => `Updated ${hhmm}`,
  found: 'found', filterLabel: 'Filter sensors', filterAll: 'All', filterTagged: 'Tagged', filterUntagged: 'Not tagged',
  kindWord: (k: string | null) => (k === 'motion' ? 'Motion sensor' : 'Presence sensor'), editTitle: 'Edit tag', stateNow: 'State now', removeTag: 'Remove tag', close: 'Close',
  moreRooms: (n: number) => `+${n} more`, onMap: 'On the map',
};

export const BP: typeof he = new Proxy(he, {
  get(target, key: string) {
    const table = ptLang() === 'en' ? en : target;
    return (table as Record<string, unknown>)[key] ?? (target as Record<string, unknown>)[key];
  },
});
