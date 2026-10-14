/**
 * CR-038 slice 3: the texts of the device integration (the "{tickets}" tab of the device window, the long-press menu of D17, the create
 * sheet's device block and history preview, the history section of a ticket, the map card entry and the D17 setting). Kept apart from
 * tickets/text.ts so the slices that run in parallel never edit the same catalogue; read through `dt()`, which renders the module's
 * configured name (owner decision D33) with the SAME tokens as tt(): `{ticket}`, `{tickets}`, `{f:..|m:..}`. The default name is never
 * written here (tests/unit-tickets-device.spec.ts and the D33 lint fail when it is).
 */
import { tn, type TicketLang } from './naming';
import { ticketsLang } from './text';

const he = {
  tab: '{tickets}',
  menuLabel: 'פעולות למכשיר',
  menuNew: 'פתיחת {ticket}',
  menuList: '{the_tickets} של הרכיב',
  menuDevice: 'פתיחת המכשיר',
  menuHistory: 'היסטוריה',
  menuSchedules: 'תזמונים',
  newBtn: '{ticket} {f:חדשה|m:חדש}',
  openCount: '{f:פתוחות|m:פתוחים}: {n}',
  empty: 'אין {tickets} למכשיר הזה',
  loadFailed: 'לא ניתן לטעון את {the_tickets}',
  retry: 'נסו שוב',
  noDevice: 'אין גישה למכשיר הזה',
  closedGroup: '{f:סגורות|m:סגורים}',
  noAssignee: 'ללא מטפל',
  // the create sheet
  device: 'מכשיר',
  existing: '{tickets} {f:פתוחות|m:פתוחים} למכשיר הזה',
  openExisting: 'פתיחת {the_ticket} {f:הקיימת|m:הקיים}',
  historyAttach: 'תצורף היסטוריה של {h} שעות · {n} שינויים',
  historyNone: 'אין שינויים ב-{h} השעות האחרונות',
  historyTruncated: '{n} השינויים האחרונים',
  historyWithheld: 'היסטוריה לא תצורף',
  created: '{ticket} #{n} {f:נפתחה|m:נפתח}',
  // a ticket's history section
  sHistory: 'היסטוריית המכשיר',
  historyWindow: '{h} שעות לפני הפתיחה',
  historyEmpty: 'לא היו שינויים',
  historyNotAttached: 'היסטוריה לא צורפה',
  historyAttached: 'צורפה היסטוריית המכשיר · {n} שינויים',
  historyCut: 'מוצגים {n} השינויים האחרונים בלבד',
  historyGaps: 'חלק מהתקופה לא תועד',
  actor_person: 'אדם',
  actor_automation: 'אוטומציה',
  actor_script: 'סקריפט',
  actor_scene: 'סצנה',
  actor_schedule: 'תזמון',
  actor_device: 'המכשיר',
  actor_system: 'המערכת',
  actor_unknown: 'לא ידוע',
  kind_availability: 'זמינות',
  // the map card
  mapAction: '{tickets}',
  countChip: '{n} {tickets} {f:פתוחות|m:פתוחים}',
  // Settings > the module > general (D17)
  setLongPress: 'לחיצה ארוכה על מכשיר',
  setLongPressSub: 'במסכי הבית: חלון המכשיר עם לשונית {the_tickets} בסוף, או תפריט קצר',
  lp_sheet: 'חלון המכשיר',
  lp_menu: 'תפריט קצר',
};

export type DeviceTextKey = keyof typeof he;

const en: Partial<Record<DeviceTextKey, string>> = {
  tab: '{tickets}',
  menuLabel: 'Device actions',
  menuNew: 'Open a {ticket}',
  menuList: "The device's {tickets}",
  menuDevice: 'Open the device',
  menuHistory: 'History',
  menuSchedules: 'Schedules',
  newBtn: 'New {ticket}',
  openCount: 'Open: {n}',
  empty: 'No {tickets} for this device',
  loadFailed: 'The {tickets} could not be loaded',
  retry: 'Try again',
  noDevice: 'No access to this device',
  closedGroup: 'Closed',
  noAssignee: 'No handler',
  device: 'Device',
  existing: 'Open {tickets} for this device',
  openExisting: 'Open the existing {ticket}',
  historyAttach: '{h} hours of history will be attached · {n} changes',
  historyNone: 'No changes in the last {h} hours',
  historyTruncated: 'The last {n} changes',
  historyWithheld: 'No history will be attached',
  created: '{ticket} #{n} opened',
  sHistory: 'Device history',
  historyWindow: '{h} hours before it was opened',
  historyEmpty: 'No changes',
  historyNotAttached: 'No history attached',
  historyAttached: 'Device history attached · {n} changes',
  historyCut: 'Only the last {n} changes are shown',
  historyGaps: 'Part of the period was not recorded',
  actor_person: 'A person',
  actor_automation: 'Automation',
  actor_script: 'Script',
  actor_scene: 'Scene',
  actor_schedule: 'Schedule',
  actor_device: 'The device',
  actor_system: 'The system',
  actor_unknown: 'Unknown',
  kind_availability: 'Availability',
  mapAction: '{tickets}',
  countChip: '{n} open {tickets}',
  setLongPress: 'Long press on a device',
  setLongPressSub: 'On the home screens: the device window with the {tickets} tab last, or a short menu',
  lp_sheet: 'Device window',
  lp_menu: 'Short menu',
};

export function deviceTemplate(key: DeviceTextKey, lang: 'he' | 'en' = ticketsLang()): string {
  return (lang === 'en' ? en[key] : undefined) ?? he[key];
}

/** A text of the device integration: the template in the document's language, the module's name rendered (D33), then `{var}`s. */
export function dt(key: DeviceTextKey, vars?: Record<string, string | number>): string {
  const lang = ticketsLang();
  const named = tn(deviceTemplate(key, lang), lang as TicketLang);
  return vars ? named.replace(/\{(\w+)\}/g, (m, k: string) => (k in vars ? String(vars[k]) : m)) : named;
}

export const DEVICE_TEXT_KEYS = Object.keys(he) as DeviceTextKey[];
export const DEVICE_TEXT_EN_KEYS = Object.keys(en) as DeviceTextKey[];
