/**
 * WHOIN034-295 (board r034 / r035): the words of "מי במבנה" (מפה › מי במבנה) and of the place editors (הגדרות › אפליקציה לנייד ›
 * מקומות). Hebrew first; English follows the document language (a missing key falls back to the Hebrew; Arabic and Russian fall back
 * to the Hebrew until a native translation exists). `{x}` placeholders are filled by `pt(key, { x })`. Operator screens never name the
 * home platform.
 */
import { docLang, fill, registerCatalogue } from './core';
import { NAV_PT } from './nav-labels'; // CR-NAV-LABELS-2436: the shell's label lives there
import { packTable, withEntries } from './lang-packs';

const he = {
  tab: NAV_PT.he.tab,
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
  // MOBILE-CONTRACT-V22-2380: presence.value_check
  valueCheck: 'בדיקת ערכי החיישנים',
  valueCheckHint: 'מה השרת עושה עם ערך חיישן שלא בתבנית: כבוי - נשמר כפי שנשלח; נרמול - נשמרים רק השדות התקינים; קפדני - הדיווח נדחה. מומלץ לבחור נרמול לפני הפעלת השיתוף.',
  valueCheck_off: 'כבוי',
  valueCheck_normalize: 'נרמול',
  valueCheck_strict: 'קפדני',
};

type Key = keyof typeof he;

const en: Partial<Record<Key, string>> = withEntries(packTable<typeof import('./lang/en/i18n/presence').en>('en', 'i18n/presence', 'en'), {
  tab: NAV_PT.en.tab,
});

export type PtLang = 'he' | 'en';
export function ptLang(): PtLang {
  return docLang(['en']);
}

const TABLES: Record<PtLang, Partial<Record<Key, string>>> = { he, en };

export function pt(key: Key, vars?: Record<string, string | number>, lang: PtLang = ptLang()): string {
  const raw = TABLES[lang][key] ?? he[key] ?? key;
  return fill(raw, vars);
}

export type PtKey = Key;
export const PT_KEYS = Object.keys(he) as Key[];
export const PT_TABLES = TABLES;

registerCatalogue('i18n/presence', { he, en });
