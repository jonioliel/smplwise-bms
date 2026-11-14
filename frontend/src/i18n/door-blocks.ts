// WXUNBLK: the strings of Settings › חיבורים › "חסימות פתיחת דלתות" (the list of what the door path blocks and the one audited switch per
// entity). Hebrew is the product language; the English column is used when the document language is English (a key missing there falls
// back to the Hebrew). A Settings page may name the integration; no internal code is shown as text. The server's own sentences (what a
// guard does to an item, why a door item stays refused) arrive in the data and are shown as they are.
import { docLang, fill, registerCatalogue } from './core';
const he = {
  title: 'חסימות פתיחת דלתות',
  sub: 'כל עוד יש דלת אינטרקום, התקן וירטואלי (תבנית) שלא ניתן להוכיח שאינו דלת נחסם, וכך גם פריט שמשתמש בו. מנהל מערכת יכול לשחרר התקן אחד ולהחזיר אותו לחסימה. כל שינוי נרשם ביומן.',
  entities: 'התקנים וירטואליים',
  items: 'פריטים חסומים',
  search: 'חיפוש לפי שם, אזור או סיבה',
  fAll: 'הכול',
  fBlocked: 'חסומים',
  fReleased: 'משוחררים',
  refresh: 'רענון',
  more: 'הצג עוד ({n})',
  retry: 'נסה שוב',
  none: 'אין דלת אינטרקום בהתקנה, ולכן שום התקן אינו חסום',
  noEntities: 'אין התקנים וירטואליים לשחרור',
  noMatch: 'אין התאמות לחיפוש',
  noItems: 'אין פריטים חסומים',
  truncated: 'הרשימה קטועה: מוצגים רק ההתקנים הראשונים לפי שם',
  summary: '{blocked} חסומים · {released} משוחררים',
  summaryItems: '{blocked} פריטים חסומים',
  sBlocked: 'חסום',
  sReleased: 'משוחרר',
  sDoor: 'משויך לדלת',
  sStale: 'כבר אינו בקטלוג',
  usedBy: 'בשימוש: {names}',
  usedMore: ' ועוד {n}',
  releasedBy: 'שוחרר בידי {who} · {when}',
  toggle: 'שחרור {name}',
  itemFreed: 'אינו חסום עוד',
  itemBlocked: 'חסום',
  itemDevices: 'התקנים וירטואליים: {names}',
  itemDevicesMore: ' ועוד {n}',
  itemDeviceReleased: '{name} (משוחרר)',
  itemStays: 'נשאר חסום גם אחרי שחרור ההתקנים',
  // the confirmation questions
  releaseTitle: 'שחרור התקן וירטואלי',
  releaseText: 'ההתקן יפסיק להיחסם: כפתורי התקנים, פעולה מרוכזת ופריטים שמשתמשים בו יורשו מ־Arx, גם אם הוא פותח דלת אינטרקום. השחרור נרשם ביומן עם שמך והסיבה, ואפשר להחזיר את החסימה בכל עת.',
  noteLabel: 'סיבה לשחרור (חובה)',
  noteHint: 'לפחות 3 תווים, עד {max}',
  release: 'שחרור',
  reblockTitle: 'החזרת חסימה להתקן',
  reblockText: 'פעולות על ההתקן ייחסמו שוב, ופריטים שמשתמשים בו לא יופעלו מ־Arx עד שיוסר ממנו.',
  reblock: 'החזרת חסימה',
  noteOptional: 'סיבה (לא חובה)',
  cancel: 'ביטול',
  saved: 'נשמר',
  needNote: 'נדרשת סיבה (לפחות 3 תווים)',
  tooLong: 'הסיבה ארוכה מדי (עד {max} תווים)',
  // the kind of a device, as a word
  d_lock: 'מנעול',
  d_switch: 'מתג',
  d_light: 'תאורה',
  d_cover: 'תריס או שער',
  d_fan: 'מאוורר',
  d_button: 'כפתור',
  d_media_player: 'נגן',
  d_select: 'בחירה',
  d_number: 'ערך',
  d_valve: 'ברז',
  d_vacuum: 'שואב',
  d_alarm_control_panel: 'לוח אזעקה',
  d_climate: 'מיזוג',
  d_other: 'התקן',
};

export type BtKey = keyof typeof he;

const en: Partial<Record<BtKey, string>> = {
  title: 'Door blocks',
  sub: 'While there is an intercom door, a virtual device (template) that cannot be proven not to be a door is blocked, and so is any item that uses it. A system administrator can release a single device and block it again. Every change is logged.',
  entities: 'Virtual devices',
  items: 'Blocked items',
  search: 'Search by name, area or reason',
  fAll: 'All',
  fBlocked: 'Blocked',
  fReleased: 'Released',
  refresh: 'Refresh',
  more: 'Show more ({n})',
  retry: 'Try again',
  none: 'There is no intercom door in this installation, so no device is blocked',
  noEntities: 'No virtual devices to release',
  noMatch: 'Nothing matches the search',
  noItems: 'No blocked items',
  truncated: 'The list is cut short: only the first devices by name are shown',
  summary: '{blocked} blocked · {released} released',
  summaryItems: '{blocked} blocked items',
  sBlocked: 'Blocked',
  sReleased: 'Released',
  sDoor: 'Mapped to a door',
  sStale: 'No longer in the catalogue',
  usedBy: 'Used by: {names}',
  usedMore: ' and {n} more',
  releasedBy: 'Released by {who} · {when}',
  toggle: 'Release {name}',
  itemFreed: 'No longer blocked',
  itemBlocked: 'Blocked',
  itemDevices: 'Virtual devices: {names}',
  itemDevicesMore: ' and {n} more',
  itemDeviceReleased: '{name} (released)',
  itemStays: 'Stays blocked even after its devices are released',
  releaseTitle: 'Release a virtual device',
  releaseText: 'The device will no longer be blocked: device buttons, group actions and items that use it will be allowed from Arx, even if it opens an intercom door. The release is logged with your name and the reason, and you can block it again at any time.',
  noteLabel: 'Reason for the release (required)',
  noteHint: 'At least 3 characters, up to {max}',
  release: 'Release',
  reblockTitle: 'Block the device again',
  reblockText: 'Actions on the device will be blocked again, and items that use it will not run from Arx until it is removed from them.',
  reblock: 'Block again',
  noteOptional: 'Reason (optional)',
  cancel: 'Cancel',
  saved: 'Saved',
  needNote: 'A reason is required (at least 3 characters)',
  tooLong: 'The reason is too long (up to {max} characters)',
  d_lock: 'Lock',
  d_switch: 'Switch',
  d_light: 'Light',
  d_cover: 'Shutter or gate',
  d_fan: 'Fan',
  d_button: 'Button',
  d_media_player: 'Player',
  d_select: 'Selector',
  d_number: 'Value',
  d_valve: 'Valve',
  d_vacuum: 'Robot vacuum',
  d_alarm_control_panel: 'Alarm panel',
  d_climate: 'Air conditioning',
  d_other: 'Device',

};

export function btLang(): 'he' | 'en' {
  return docLang(['en']);
}

/** The text of `key` in the document's language, with `{name}` placeholders filled. */
export function bt(key: BtKey, vars?: Record<string, string | number>): string {
  const raw = (btLang() === 'en' ? en[key] : undefined) ?? he[key];
  return fill(raw, vars);
}

/** A run-time key (`d_<domain>`), or the fallback when there is none. */
export function btDynamic(key: string, fallback: BtKey, vars?: Record<string, string | number>): string {
  return key in he ? bt(key as BtKey, vars) : bt(fallback, vars);
}

export const DOOR_BLOCKS_HE = he;

registerCatalogue('i18n/door-blocks', { he, en });
