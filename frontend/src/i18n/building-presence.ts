import { localeFor } from './locale';
import { ptLang } from './presence';
import { registerCatalogue } from './core';
import { packTable, withEntries } from './lang-packs';

/** PRESENCE-DESIGN-2300: a count with the locale's group separator (1,284), never a raw number. */
const num = (n: number) => new Intl.NumberFormat(localeFor(ptLang())).format(n);

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
  // PRESENCE-DESIGN-2300 (break-ui): one room and no room read as words, never "כל 1 החדרים"
  cardSub: (n: number, of: number) => (of === 1 ? 'החדר היחיד עם חיישן פעיל' : `${num(n)} מתוך ${num(of)} חדרים עם חיישן פעילים`),
  cardAllEmpty: (of: number) => (of === 0 ? 'אין עדיין חדר עם חיישן' : of === 1 ? 'החדר היחיד עם חיישן ריק' : `כל ${num(of)} החדרים ריקים`),
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
  moreRooms: (n: number) => `ועוד ${num(n)}`,
  onMap: 'במפה',
  // PRESENCE-DESIGN-2300: the settings page's own loading and error states (a failed read never shows the switch as "off")
  loading: 'טוען את הגדרות הנוכחות',
  loadFailed: 'לא ניתן לקרוא את הגדרות הנוכחות',
  retry: 'נסה שוב',
  count: (n: number) => num(n),
  // PRESENCE-COMPACT-2310: the compact card (round-9 mockup) and its four display options
  stripSub: (n: number, of: number) => (of === 0 ? '' : of === 1 ? 'החדר היחיד עם חיישן' : `${num(n)} מתוך ${num(of)} חדרים`),
  lastEmpty: (name: string, hhmm: string) => `${name} · ריק מ־${hhmm}`,
  emptyNames: 'ריקים',
  unknownNames: 'אין מידע',
  activeRooms: 'חדרים פעילים',
  noFloor: 'ללא קומה',
  wholeBuilding: 'כל המבנה',
  plus: (n: number) => `+${num(n)}`,
  moreFloors: (n: number) => `+${num(n)} קומות`,
  cardHeading: 'הכרטיס במסך הראשי',
  styleLabel: 'סגנון',
  styleCount: 'מונה ושמות',
  styleStrip: 'רצועה',
  styleFloors: 'מונה וקומות',
  styleQuiet: 'שורה שקטה',
  styleOff: 'בלי כרטיס, רק המפה',
  emptyRoomsLabel: 'חדרים ריקים',
  emptyHide: 'רק פעילים בכרטיס',
  emptyShow: 'גם ריקים, באפור',
  detailsLabel: 'שעת עדכון וחדרים ריקים',
  detailsHover: 'רק במעבר עכבר',
  detailsInline: 'בתוך הכרטיס',
  allEmptyLabel: 'כשכל החדרים ריקים',
  allEmptyLast: 'החדר שהתרוקן אחרון',
  allEmptyCount: 'רק ״כל החדרים ריקים״',
  cardOnlyHint: 'חל כשהתצוגה במסך הראשי היא ״כרטיס״',
  // PRESENCE-COUNT-2400: the "count and names" card (round-16 direction A)
  countWord: (n: number) => (n === 1 ? 'חדר פעיל' : 'חדרים פעילים'),
  countEmpty: 'המבנה ריק',
  countUnknown: 'אין מידע מהחיישנים',
  countUnknownSub: 'החדרים יופיעו כשהחיישנים ידווחו',
  countAria: (n: number, of: number) => (n === 1 ? `חדר פעיל אחד מתוך ${num(of)}` : `${num(n)} מתוך ${num(of)} חדרים פעילים`),
  countShare: (n: number, of: number, pct: number) => `${num(n)} מתוך ${num(of)} חדרים פעילים (${num(pct)}%)`,
  // AREA-PRESENCE-LINE-2351: the presence line of the area screen and its switch
  areaLineLabel: 'נוכחות',
  areaLineAria: 'נוכחות באזור',
  people: (n: number) => (n === 1 ? 'אדם אחד' : `${num(n)} אנשים`),
  nobody: 'אין נוכחים',
  andMore: (n: number) => `ועוד ${num(n)}`,
  areaSwitchLabel: 'שורת נוכחות במסך האזור',
  areaSwitchHint: 'כבוי כברירת מחדל. מוצגת במסך האזור ובחלון האזור המהיר. מי שמורשה לראות שמות יראה שמות, השאר רק מספר',
};
type Key = keyof typeof he;

const en: Partial<Record<Key, unknown>> = withEntries(packTable<typeof import('./lang/en/i18n/building-presence').en>('en', 'i18n/building-presence', 'en'), {
  cardSub: (n: number, of: number) => (of === 1 ? 'The only room with a sensor is active' : `${num(n)} of ${num(of)} rooms with a sensor are active`),
  cardAllEmpty: (of: number) => (of === 0 ? 'No room has a sensor yet' : of === 1 ? 'The only room with a sensor is empty' : `All ${num(of)} rooms are empty`),
  moreRooms: (n: number) => `+${num(n)} more`,
  count: (n: number) => num(n),
  stripSub: (n: number, of: number) => (of === 0 ? '' : of === 1 ? 'The only room with a sensor' : `${num(n)} of ${num(of)} rooms`),
  plus: (n: number) => `+${num(n)}`,
  moreFloors: (n: number) => `+${num(n)} floors`,
  countAria: (n: number, of: number) => `${num(n)} of ${num(of)} rooms active`,
  countShare: (n: number, of: number, pct: number) => `${num(n)} of ${num(of)} rooms active (${num(pct)}%)`,
  people: (n: number) => (n === 1 ? '1 person' : `${num(n)} people`),
  andMore: (n: number) => `+${num(n)} more`,
});

export const BP: typeof he = new Proxy(he, {
  get(target, key: string) {
    const table = ptLang() === 'en' ? en : target;
    return (table as Record<string, unknown>)[key] ?? (target as Record<string, unknown>)[key];
  },
});

registerCatalogue('i18n/building-presence', { he, en });
