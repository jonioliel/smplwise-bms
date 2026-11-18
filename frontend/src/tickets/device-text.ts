/**
 * CR-038 slice 3: the texts of the device integration (the "{tickets}" tab of the device window, the long-press menu of D17, the create
 * sheet's device block and history preview, the history section of a ticket, the map card entry and the D17 setting). Kept apart from
 * tickets/text.ts so the slices that run in parallel never edit the same catalogue; read through `dt()`, which renders the module's
 * configured name (owner decision D33) with the SAME tokens as tt(): `{ticket}`, `{tickets}`, `{f:..|m:..}`. The default name is never
 * written here (tests/unit-tickets-device.spec.ts and the D33 lint fail when it is).
 */
import { makeCatalogue } from './catalogue'; // CR-TK-CATALOGUE-2440: the shared template / text / key-list lines
import { registerCatalogue } from '../i18n/core';
import { packTable } from '../i18n/lang-packs';

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

const en: Partial<Record<DeviceTextKey, string>> = packTable<typeof import('../i18n/lang/en/tickets/device-text').en>('en', 'tickets/device-text', 'en');

const catalogue = makeCatalogue<DeviceTextKey>(he, en);

/** The raw template of a key in a language; English falls back to Hebrew (the unit tests and the completeness spec read it). */
export const deviceTemplate = catalogue.template;

/** A text of the device integration: the template in the document's language, the module's name rendered (D33), then `{var}`s. */
export const dt = catalogue.t;

export const DEVICE_TEXT_KEYS = catalogue.KEYS;
export const DEVICE_TEXT_EN_KEYS = catalogue.EN_KEYS;

registerCatalogue('tickets/device-text', { he, en });
