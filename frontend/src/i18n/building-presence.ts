/**
 * BUILDING-PRESENCE-2271: the words of the building-presence chip (overview) and its settings card. Hebrew; short, no paragraphs, no
 * platform names. A person is never named: the numbers are rooms, not people.
 */
export const BP = {
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
} as const;
