/**
 * CR-036 S3: who may do what in the access-control area ("בקרת כניסה") - the ONE frontend source of the permissions the
 * native access-control screens use: their ids, their Hebrew labels (the roles screen's fallback, src/screens/system-access.ts)
 * and the caller's access. The screens only SHAPE themselves from this; the server enforces every permission per station
 * (services/intercom_authority.py) and never sends a field the caller may not see.
 *   read          access.read             the entry center's stations (online, ringing, doors, camera stills)
 *   stations      access.stations.read    a station's technical details
 *   events        access.events.read      the entry log, names included
 *   export        access.events.export    CSV export of the entry log (sensitive)
 *   people        access.people.read      people: names, station assignments, groups, validity
 *   sensitive     access.people.sensitive employee number, photo / portrait, phone, profile values (sensitive)
 *   manage        access.people.manage    the person editor (sensitive)
 *   message       access.people.message   a WhatsApp message to a person / a selection (sensitive; CR-036 WA)
 *   call          access.call             answer / reject / hang up, spoken announcement (sensitive; endpoints move in S11)
 *   admin         access.admin.read       Settings: health, sync, alerts, the intercom's own action log
 *   capture       access.cards.capture    reading a card at a station's reader (sensitive; with manage)
 *   pin           access.pin.generate     generating a person's PIN, shown once (S11; sensitive; with manage)
 *   (door)        access.doors.open       opening a door, door only (WXPERM; sensitive; legacy name access.release - see
 *                                         DOOR_PERMISSIONS; the server's per-station door answer decides)
 * The labels must equal the backend's routers/access.py PERMISSION_LABELS (tests/test_intercom_authority.py compares them).
 */
import { canAnywhere, isApi, onSession } from '../api/session';

export const ACCESS_CONTROL_PERMISSIONS = [
  'access.stations.read',
  'access.events.read',
  'access.events.export',
  'access.people.read',
  'access.people.sensitive',
  'access.people.message',
  'access.call',
  'access.admin.read',
  'access.schedules.manage',
  'access.stations.manage',
  'access.groups.manage',
  'access.pin.generate',
  'access.doors.open',
] as const;
export type AccessControlPermission = (typeof ACCESS_CONTROL_PERMISSIONS)[number];

/** Hebrew labels of the CR-036 permissions: the fallback while the server's role catalogue carries none of its own. */
export const ACCESS_CONTROL_PERMISSION_LABELS: Record<AccessControlPermission, string> = {
  'access.stations.read': 'בקרת כניסה: פרטים טכניים של עמדות (דגם, קושחה, ממסרים, שעון, תוכניות דלת, לוחות החזקה, האם מוגדר קוד)',
  'access.events.read': 'בקרת כניסה: יומן כניסות (כולל שמות)',
  'access.events.export': 'בקרת כניסה: ייצוא יומן הכניסות לקובץ',
  'access.people.read': 'בקרת כניסה: צפייה באנשים (שמות, שיוך לעמדות, קבוצות ותוקף)',
  'access.people.sensitive': 'בקרת כניסה: פרטים רגישים של אנשים (מספר עובד, תמונה, טלפון, שדות פרופיל)',
  'access.people.message': 'בקרת כניסה: שליחת הודעות וואטסאפ לאנשים',
  'access.call': 'בקרת כניסה: מענה לשיחה מעמדה והכרזה קולית',
  'access.admin.read': 'בקרת כניסה: מצב מערכת, סנכרון, התראות ויומן פעולות האינטרקום',
  'access.schedules.manage': 'בקרת כניסה: עריכת לוחות זמנים של דלתות',
  'access.stations.manage': 'בקרת כניסה: עריכת הגדרות עמדה (תוכניות דלת, החזקה פתוחה, קודים ציבוריים)',
  'access.groups.manage': 'בקרת כניסה: עריכת קבוצות ושדות פרופיל',
  'access.pin.generate': 'בקרת כניסה: יצירת קוד PIN לאדם (מוצג פעם אחת למבקש; דורש גם ניהול אנשים)',
  'access.doors.open': 'בקרת כניסה: פתיחת דלתות',
};

/** WXPERM (owner decision 2026-10-13): the door permission and its legacy name. The server expands a custom role's legacy
 * `access.release` into `access.doors.open` (rbac.LEGACY_PERMISSIONS), so /me already lists the new name; the legacy one is
 * kept here only so an older backend's answer still shows the door. Shaping only - the server's door rule decides. */
export const DOOR_PERMISSIONS = ['access.doors.open', 'access.release'] as const;

/** Whether `has` (a permission test, at any scope or at installation scope - the caller's choice) grants a door permission. */
export const holdsDoorPermission = (has: (permission: string) => boolean): boolean => DOOR_PERMISSIONS.some((p) => has(p));

/** The label of any permission id when it is one of the above (undefined otherwise), for label lookups keyed by a plain string. */
export const accessControlPermissionLabel = (id: string): string | undefined => (ACCESS_CONTROL_PERMISSION_LABELS as Record<string, string>)[id];

export interface AccessControlAccess {
  read: boolean;
  stations: boolean;
  events: boolean;
  export: boolean;
  people: boolean;
  sensitive: boolean;
  manage: boolean;
  message: boolean;
  call: boolean;
  admin: boolean;
  /** S11: card capture from a station reader (access.cards.capture) and PIN generation (access.pin.generate), at any scope. */
  capture: boolean;
  pin: boolean;
}

/** The caller's permissions at any scope (a station-scoped binding counts): what a screen offers. Without a backend (static
 * preview) everything is offered; the demo data carries nothing real. */
export function accessControlAccess(): AccessControlAccess {
  if (!isApi()) return { read: true, stations: true, events: true, export: true, people: true, sensitive: true, manage: true, message: true, call: true, admin: true, capture: true, pin: true };
  return {
    read: canAnywhere('access.read'),
    stations: canAnywhere('access.stations.read'),
    events: canAnywhere('access.events.read'),
    export: canAnywhere('access.events.export'),
    people: canAnywhere('access.people.read'),
    sensitive: canAnywhere('access.people.sensitive'),
    manage: canAnywhere('access.people.manage'),
    message: canAnywhere('access.people.message'),
    call: canAnywhere('access.call'),
    admin: canAnywhere('access.admin.read'),
    capture: canAnywhere('access.cards.capture'),
    pin: canAnywhere('access.pin.generate'),
  };
}

/** Calls `fn` now and whenever the session (and so the permissions) changes. Returns the stop function. */
export function onAccessControlAccess(fn: (a: AccessControlAccess) => void): () => void {
  return onSession(() => fn(accessControlAccess()));
}
