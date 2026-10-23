/**
 * CR-EMERG104: the words of the emergency readiness page (a tab of the maintenance section). Hebrew first; English follows the document
 * language; Arabic and Russian fall back to the Hebrew. Operator screens never name the home platform.
 */
const he = {
  tab: 'מוכנות לחירום',
  title: 'מוכנות לחירום',
  sub: 'האם הבניין מוכן לאירוע חירום עכשיו',
  verdict_ready: 'מוכן',
  verdict_ready_with_gaps: 'מוכן עם פערים',
  verdict_not_ready: 'לא מוכן',
  checkedAt: 'נבדק ב־{t}',
  print: 'הדפסה',
  critical: 'קריטי',
  kpiAll: 'הכול',
  kpiRed: 'לא תקין',
  kpiAmber: 'דורש תשומת לב',
  kpiUnknown: 'לא ידוע',
  kpiNa: 'לא רלוונטי',
  filterLabel: 'סינון לפי מצב',
  st_green: 'תקין',
  st_amber: 'תשומת לב',
  st_red: 'לא תקין',
  st_unknown: 'לא ידוע',
  st_not_applicable: 'לא רלוונטי',
  st_hidden: 'מוסתר',
  grp_power: 'חשמל',
  grp_fire: 'בטיחות אש וביקורות',
  grp_elevators: 'מעליות',
  grp_doors: 'דלתות',
  grp_people: 'אנשים',
  grp_records: 'מסירה ורשומות',
  grp_cameras: 'מצלמות והקלטה',
  fix: 'לטיפול',
  age: 'גיל הנתון: {n}',
  ageMin: '{n} דק׳',
  ageHour: '{n} שע׳',
  ageDay: '{n} ימים',
  naBy: 'אושר ע״י {by} ב־{at}',
  empty: 'אין פריטים במצב הזה',
  offTitle: 'המודול כבוי',
  offBody: 'מוכנות לחירום מופעלת בהגדרות המערכת.',
  forbiddenTitle: 'המסך הזה אינו זמין לך',
  errTitle: 'לא ניתן לטעון את המוכנות לחירום',
  errHint: 'משהו השתבש. נסו שוב.',
  retry: 'ניסיון חוזר',
  loading: 'טוען',
  hidden: 'פריטים שאין לך הרשאה לראות: {n}',
  printNote: 'הדף משקף נתונים שנאספו במערכת, אינו אישור ציות רגולטורי.',
  signed: 'נבדק ע״י ____________',
  banner_fire_service: 'פיקוד כבאים פעיל - אירוע בעיצומו',
  banner_door_incident: 'אירוע חירום פתוח בדלתות',
  banner_on_load: 'הגנרטור נושא את העומס כרגע',
  setModule: 'מוכנות לחירום',
  setModuleHint: 'לשונית תצוגה בלבד בתחזוקה ובקרה, מחושבת מנתונים קיימים. כבויה כברירת מחדל ודורשת את מודול התחזוקה.',
} as const;

const en: Record<keyof typeof he, string> = {
  tab: 'Emergency readiness',
  title: 'Emergency readiness',
  sub: 'Is the building ready for an emergency right now',
  verdict_ready: 'Ready',
  verdict_ready_with_gaps: 'Ready with gaps',
  verdict_not_ready: 'Not ready',
  checkedAt: 'Checked at {t}',
  print: 'Print',
  critical: 'Critical',
  kpiAll: 'All',
  kpiRed: 'Not OK',
  kpiAmber: 'Needs attention',
  kpiUnknown: 'Unknown',
  kpiNa: 'Not applicable',
  filterLabel: 'Filter by status',
  st_green: 'OK',
  st_amber: 'Attention',
  st_red: 'Not OK',
  st_unknown: 'Unknown',
  st_not_applicable: 'Not applicable',
  st_hidden: 'Hidden',
  grp_power: 'Power',
  grp_fire: 'Fire safety and inspections',
  grp_elevators: 'Elevators',
  grp_doors: 'Doors',
  grp_people: 'People',
  grp_records: 'Delivery and records',
  grp_cameras: 'Cameras and recording',
  fix: 'Fix',
  age: 'Data age: {n}',
  ageMin: '{n} min',
  ageHour: '{n} h',
  ageDay: '{n} days',
  naBy: 'Confirmed by {by} on {at}',
  empty: 'No items in this state',
  offTitle: 'The module is off',
  offBody: 'Emergency readiness is turned on in the system settings.',
  forbiddenTitle: 'This screen is not available to you',
  errTitle: 'Emergency readiness could not be loaded',
  errHint: 'Something went wrong. Try again.',
  retry: 'Try again',
  loading: 'Loading',
  hidden: 'Items you may not see: {n}',
  printNote: 'This page reflects data collected by the system and is not a regulatory compliance approval.',
  signed: 'Checked by ____________',
  banner_fire_service: 'Fire service is active - an event is in progress',
  banner_door_incident: 'An emergency incident is open on the doors',
  banner_on_load: 'The generator is carrying the load right now',
  setModule: 'Emergency readiness',
  setModuleHint: 'A read-only tab in maintenance, computed from existing data. Off by default and needs the maintenance module.',
};

export type EmKey = keyof typeof he;
export const EM_KEYS = Object.keys(he) as EmKey[];
export const EM_TABLES = { he, en } as const;

export function emLang(): 'he' | 'en' {
  const l = typeof document !== 'undefined' ? (document.documentElement.lang || '').toLowerCase() : '';
  return l.startsWith('en') ? 'en' : 'he';
}

export function em(key: EmKey, vars?: Record<string, string | number>, lang: 'he' | 'en' = emLang()): string {
  const raw: string = EM_TABLES[lang][key] ?? he[key] ?? key;
  return vars ? raw.replace(/\{(\w+)\}/g, (m, k: string) => (k in vars ? String(vars[k]) : m)) : raw;
}

/** Item titles are Hebrew from the server; English titles by id (the page and the print follow the document language). */
export const EN_TITLES: Record<string, string> = {
  E01: 'Last generator test', E02: 'Generator fuel and state', E02b: 'Mains or generator (information)', E03: 'Fire-safety certificate', E04: 'Fire extinguishers checked',
  E05: 'Hydrants and sprinklers', E06: 'Emergency lighting and exit signs', E07: 'Evacuation round', E08: 'Open fire-safety requests', E09: 'Elevator inspections (fire service)',
  E10: 'Elevator monitoring', E11: 'Door emergency controls', E12: 'Door faults and open emergency incident', E13: 'Emergency contacts', E14: 'Service suppliers',
  E15: 'Notification delivery', E16: 'Backup', E17: 'Recorders and recording', E18: 'Cameras online', E19: 'Clock and timestamps',
};

/** English sentence for an item `code` (the server sends Hebrew in `summary`); the Hebrew page shows `summary` as is. */
export const EN_SUMMARY: Record<string, string> = {
  no_generator: 'No generator detected', generator_test: 'Generator test status', generator_state: 'Generator fuel and state', on_load: 'The generator is carrying the load',
  on_mains: 'The building is on the mains', unbound: 'No ledger task is bound to this item', ledger_off: 'The certificates ledger is off', evacuation: 'Evacuation round status',
  doors_off: 'Door emergency control is off', door_faults: 'Door faults and open emergency incidents', doors_ready: 'Door emergency controls', contacts: 'Emergency contact list',
  suppliers: 'Service suppliers', deliveries: 'Notification delivery', backup: 'Backup status', recorders: 'Recorder status', cameras: 'Cameras online', clock: 'Recorder clocks',
  elevator_inspection: 'Elevator inspections', elevator_live: 'Elevator monitoring', tickets: 'Open fire-safety requests', none_open: 'No open fire-safety requests',
  tickets_off: 'The requests module is off', source_error: 'The source could not be verified', no_data: 'No data',
};
