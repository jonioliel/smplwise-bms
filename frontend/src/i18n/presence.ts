/**
 * WHOIN034-295 (board r034 / r035): the words of "מי במבנה" (מפה › מי במבנה) and of the place editors (הגדרות › אפליקציה לנייד ›
 * מקומות). Hebrew first; English follows the document language (a missing key falls back to the Hebrew; Arabic and Russian fall back
 * to the Hebrew until a native translation exists). `{x}` placeholders are filled by `pt(key, { x })`. Operator screens never name the
 * home platform.
 */
const he = {
  tab: 'מי במבנה',
  title: 'מי במבנה',
  subtitle: 'מפה · {n} במבנה · עודכן {ago}',
  subtitleOff: 'מפה · שיתוף הנתונים מהאפליקציה כבוי',
  loadError: 'לא ניתן לטעון את רשימת הנוכחים',
  refresh: 'רענון',
  places: 'מקומות וספים',
  kpiInside: 'במבנה',
  kpiFloors: 'מוקמו בקומה',
  kpiSite: 'באתר, ללא קומה',
  kpiHidden: 'ביקשו לא להופיע',
  allFloors: 'כל הקומות',
  siteOnly: 'ללא קומה',
  floorFilter: 'סינון לפי קומה',
  search: 'חיפוש שם או אזור',
  listTitle: 'נוכחים',
  listCount: '{n} אנשים',
  listEmpty: 'אין אנשים להצגה',
  countsOnly: 'מוצגות ספירות בלבד, ללא שמות',
  noPlan: 'לקומה הזו אין תוכנית',
  noFloors: 'אין קומות בקטלוג',
  mapView: 'מפה',
  listView: 'רשימה',
  zoneCount: '{name} · {n}',
  onFloor: '{n} בקומה',
  unplaced: '{n} בקומה ללא אזור',
  srcBeacon: 'משדר',
  srcWifi: 'רשת Wi-Fi',
  srcGeofence: 'גדר גאוגרפית',
  agoNow: 'עכשיו',
  agoMin: 'לפני {n} דק׳',
  agoHour: 'לפני {n} שע׳',
  offTitle: 'שיתוף הנתונים מהאפליקציה כבוי',
  offBody: 'המסך יתמלא כשהשיתוף יופעל בהגדרות, אחרי שההודעה לעובדים נשלחה.',
  offLink: 'להגדרות האפליקציה לנייד',
  noPlacesTitle: 'עדיין לא הוגדרו מקומות',
  noPlacesBody: 'כדי לדעת מי במבנה מגדירים גדר גאוגרפית לאתר, ואם רוצים לדעת באיזו קומה ואזור, גם משדרים או רשתות Wi-Fi.',
  noPlacesLink: 'להגדרת מקומות',
  hiddenNote: '{n} ביקשו לא להופיע במסך ונספרים בסך הכול בלבד',
  // the opt-out (the user's own choice)
  optOut: 'לא להופיע במסך מי במבנה',
  optOutHint: 'נספרים בסך הכול בלבד, בלי שם ובלי קומה',
  optOutSaved: 'ההעדפה נשמרה',
  // the editors (הגדרות › אפליקציה לנייד › מקומות)
  segGeneral: 'שיתוף ומדיניות',
  segPlaces: 'מקומות',
  segScreen: 'מסך מי במבנה',
  sitesTitle: 'גדרות גאוגרפיות',
  sitesSub: 'אתר הוא מעגל סביב נקודה; הטלפון מדווח כניסה ויציאה',
  beaconsTitle: 'משדרים',
  beaconsSub: 'משדר בקומה או באזור; הטלפון מדווח קרבה',
  wifiTitle: 'רשתות Wi-Fi',
  wifiSub: 'שם הרשת נשמר כגיבוב בלבד',
  add: 'הוספה',
  edit: 'עריכה',
  remove: 'הסרה',
  save: 'שמור',
  saved: 'המקומות נשמרו',
  cancel: 'ביטול',
  done: 'סיום',
  name: 'שם',
  lat: 'קו רוחב',
  lon: 'קו אורך',
  radius: 'רדיוס (מטר)',
  uuid: 'UUID',
  major: 'Major',
  minor: 'Minor',
  site: 'אתר',
  floor: 'קומה',
  zone: 'אזור',
  none: 'ללא',
  ssids: 'שמות רשת להוספה',
  ssidsHint: 'שם אחד בכל שורה; יישמר כגיבוב ולא יוצג שוב',
  ssidCount: '{n} רשתות שמורות',
  clearSsids: 'מחיקת הרשתות השמורות',
  emptySites: 'אין גדרות',
  emptyBeacons: 'אין משדרים',
  emptyWifi: 'אין רשתות',
  needSite: 'קודם מגדירים גדר גאוגרפית',
  pBadCoords: 'קואורדינטות לא תקינות',
  pBadRadius: 'רדיוס בין 30 ל־5000 מטר',
  pBadUuid: 'UUID לא תקין',
  pNoSite: 'יש לבחור אתר',
  pZoneNoFloor: 'אזור דורש קומה',
  pNoSsid: 'יש להזין לפחות שם רשת אחד',
  pMax: 'יותר מדי פריטים',
  // the screen's thresholds
  screenTitle: 'מסך מי במבנה',
  screenSub: 'הספים שקובעים מי נחשב במבנה',
  staleMin: 'תוקף מצב גדר (דקות)',
  beaconAge: 'תוקף דיווח משדר (דקות)',
  wifiAge: 'תוקף דיווח רשת (דקות)',
  minProximity: 'קרבה מינימלית למשדר',
  proxImmediate: 'צמוד',
  proxNear: 'קרוב',
  proxFar: 'רחוק',
  showNames: 'הצגת שמות',
  showNamesHint: 'כבוי: ספירות לפי קומה ואזור בלבד',
  refreshSec: 'רענון המסך (שניות)',
  optOutCount: '{n} משתמשים ביקשו לא להופיע',
  rangeHint: 'בין {lo} ל־{hi}',
};

type Key = keyof typeof he;

const en: Partial<Record<Key, string>> = {
  tab: 'Who is in', title: 'Who is in the building', subtitle: 'Map · {n} inside · updated {ago}', subtitleOff: 'Map · app data sharing is off',
  loadError: 'Could not load who is in', refresh: 'Refresh', places: 'Places and thresholds', kpiInside: 'Inside', kpiFloors: 'On a floor',
  kpiSite: 'On site, no floor', kpiHidden: 'Asked not to appear', allFloors: 'All floors', siteOnly: 'No floor', floorFilter: 'Filter by floor',
  search: 'Search name or area', listTitle: 'People inside', listCount: '{n} people', listEmpty: 'Nobody to show', countsOnly: 'Counts only, no names',
  noPlan: 'This floor has no plan', noFloors: 'No floors in the catalogue', mapView: 'Map', listView: 'List', zoneCount: '{name} · {n}', onFloor: '{n} on the floor',
  unplaced: '{n} on the floor, no area', srcBeacon: 'Beacon', srcWifi: 'Wi-Fi', srcGeofence: 'Geofence', agoNow: 'now', agoMin: '{n} min ago', agoHour: '{n} h ago',
  offTitle: 'App data sharing is off', offBody: 'The screen fills once sharing is switched on in Settings, after the employee notice was sent.',
  offLink: 'Phone app settings', noPlacesTitle: 'No places yet', noPlacesBody: 'Define a geofence for the site; add beacons or Wi-Fi networks to know the floor and area.',
  noPlacesLink: 'Define places', hiddenNote: '{n} asked not to appear and are only counted in the total', optOut: 'Do not show me on "who is in"',
  optOutHint: 'Counted in the total only, without a name or a floor', optOutSaved: 'Preference saved', segGeneral: 'Sharing and policy', segPlaces: 'Places',
  segScreen: 'Who-is-in screen', sitesTitle: 'Geofences', sitesSub: 'A circle around a point; the phone reports enter and exit', beaconsTitle: 'Beacons',
  beaconsSub: 'A beacon on a floor or in an area; the phone reports proximity', wifiTitle: 'Wi-Fi networks', wifiSub: 'The network name is kept as a hash only',
  add: 'Add', edit: 'Edit', remove: 'Remove', save: 'Save', saved: 'Places saved', cancel: 'Cancel', done: 'Done', name: 'Name', lat: 'Latitude', lon: 'Longitude',
  radius: 'Radius (m)', site: 'Site', floor: 'Floor', zone: 'Area', none: 'None', ssids: 'Network names to add', ssidsHint: 'One per line; kept as a hash, never shown again',
  ssidCount: '{n} networks stored', clearSsids: 'Delete the stored networks', emptySites: 'No geofences', emptyBeacons: 'No beacons', emptyWifi: 'No networks',
  needSite: 'Define a geofence first', pBadCoords: 'Invalid coordinates', pBadRadius: 'Radius 30 to 5000 m', pBadUuid: 'Invalid UUID', pNoSite: 'Choose a site',
  pZoneNoFloor: 'An area needs a floor', pNoSsid: 'Enter at least one network name', pMax: 'Too many items', screenTitle: 'Who-is-in screen',
  screenSub: 'The thresholds that decide who counts as inside', staleMin: 'Geofence state valid for (min)', beaconAge: 'Beacon report valid for (min)',
  wifiAge: 'Network report valid for (min)', minProximity: 'Minimum beacon proximity', proxImmediate: 'Immediate', proxNear: 'Near', proxFar: 'Far',
  showNames: 'Show names', showNamesHint: 'Off: counts per floor and area only', refreshSec: 'Screen refresh (s)', optOutCount: '{n} users asked not to appear',
  rangeHint: '{lo} to {hi}',
};

export type PtLang = 'he' | 'en';
export function ptLang(): PtLang {
  const l = typeof document !== 'undefined' ? (document.documentElement.lang || '').toLowerCase() : '';
  return l.startsWith('en') ? 'en' : 'he';
}

const TABLES: Record<PtLang, Partial<Record<Key, string>>> = { he, en };

export function pt(key: Key, vars?: Record<string, string | number>, lang: PtLang = ptLang()): string {
  const raw = TABLES[lang][key] ?? he[key] ?? key;
  return vars ? raw.replace(/\{(\w+)\}/g, (m, k: string) => (k in vars ? String(vars[k]) : m)) : raw;
}

export type PtKey = Key;
export const PT_KEYS = Object.keys(he) as Key[];
export const PT_TABLES = TABLES;
