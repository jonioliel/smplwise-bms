// HOME-SIMPLE-2420: the home interface's pure rules - the words it says, the paging that keeps every control screen free of
// scrolling, and the default favourites. No DOM, no network (unit-tested in tests/unit-home-simple-logic.spec.ts).
import type { Fav, HDoor, HLoad, HRoom, HZone, HScene, HCamera, HFloor } from './home-api';
import { tr } from '../i18n/msg/home';

export const lightsText = (n: number): string => (n === 0 ? tr('כל האורות כבויים') : n === 1 ? tr('אור אחד דולק') : tr('{n} אורות דולקים', { n }));
export const onCount = (rs: HRoom[]): number => rs.reduce((n, r) => n + r.lights.filter((l) => l.on).length, 0);
export const onWord = (on: boolean): string => (on ? tr('דולק') : tr('כבוי'));

export const MODES: Record<string, string> = { cool: tr('קירור'), heat: tr('חימום'), auto: tr('אוטומטי'), heat_cool: tr('אוטומטי'), dry: tr('ייבוש'), fan_only: tr('אוורור'), off: tr('כבוי') };
export const PRESETS: [string, number][] = [[tr('נעים'), 23], [tr('חיסכון'), 26], [tr('לילה'), 22]];

export const zoneOn = (z: HZone): boolean => z.mode !== 'off' && z.ok;
const roomActive = (r: HRoom): boolean => r.lights.some((l) => l.on) || r.zones.some(zoneOn);
export const activeRooms = (rs: HRoom[]): HRoom[] => rs.filter(roomActive);
export const loadsOn = (rs: HRoom[]): HLoad[] => rs.flatMap((r) => r.loads.filter((x) => x.on));

export function roomLights(r: HRoom): string {
  const n = r.lights.filter((l) => l.on).length;
  if (!r.lights.length && !r.shades.length && !r.zones.length && !r.loads.length) return tr('אין כאן התקנים');
  if (!r.lights.length) return tr('אין אורות');
  return n === 0 ? tr('חשוך') : n === 1 ? tr('אור אחד דולק') : tr('{n} אורות דולקים', { n });
}

export function activeText(r: HRoom): string {
  const p: string[] = [];
  const n = r.lights.filter((l) => l.on).length;
  if (n) p.push(n === 1 ? tr('אור אחד') : tr('{n} אורות', { n }));
  const z = r.zones.find(zoneOn);
  if (z) p.push(z.target != null ? tr('מיזוג {target}°', { target: z.target }) : tr('מיזוג'));
  return p.join(' · ') || tr('הכל כבוי');
}

export function homeBarText(rs: HRoom[]): string {
  const n = onCount(rs);
  const a = activeRooms(rs).length;
  return n || a ? `${lightsText(n)}${a ? (a === 1 ? tr(' · בחדר אחד') : tr(' · ב-{a} חדרים', { a })) : ''}` : tr('הכל כבוי בבית');
}

// HONEST-STATES-2540 (deep review SCR-10): a lock that is offline, or answers no state the home interface knows, is neither locked nor
// open - it is "unknown". It is never counted, announced or coloured as an open door, and never as a locked one either.
const LOCK_STATES = new Set(['locked', 'unlocked', 'open', 'opening', 'locking', 'unlocking', 'jammed']);
/** Whether a lock row's state is one the home interface can say (available, and a lock state it knows). */
export const lockKnown = (state: string | null, available: boolean): boolean => available && state != null && LOCK_STATES.has(state);
/** FIX-HOME-MAPS-2570 (MH-03): the three known lock states that are neither "locked" nor "open" - jammed (a warning of its own) and the
 * two transitions. null = an ordinary locked / unlocked / open state (or an unknown one). */
export type DoorPhase = 'jammed' | 'locking' | 'unlocking';
export const doorPhaseOf = (state: string | null, available: boolean): DoorPhase | null => (available && (state === 'jammed' || state === 'locking' || state === 'unlocking') ? state : null);
/** A door that is open now (its state is known, it is not locked, and it is not jammed or moving - those are never announced as open). */
export const doorOpen = (d: Pick<HDoor, 'known' | 'locked'> & { phase?: DoorPhase | null }): boolean => d.known && !d.locked && !d.phase;
/** A door that is jammed (its own warning: the lock cannot say whether the door is locked). */
const doorJammed = (d: { phase?: DoorPhase | null }): boolean => d.phase === 'jammed';
/** A door the screen cannot vouch for as locked: open, or its state is unknown (the "לא נעולות" filter keeps both). */
export const doorNotLocked = (d: Pick<HDoor, 'known' | 'locked'>): boolean => !d.known || !d.locked;
type DoorTone = 'ok' | 'warn' | 'neutral';
/** The tone of a door's own icon and state: locked = ok, open = warn, unknown = neutral. */
export const doorTone = (d: Pick<HDoor, 'known' | 'locked'> & { phase?: DoorPhase | null }): DoorTone =>
  !d.known ? 'neutral' : d.phase === 'jammed' ? 'warn' : d.phase ? 'neutral' : d.locked ? 'ok' : 'warn';
/** The tone of the doors' summary: an open door warns; otherwise a door in an unknown state (or no door) is neutral; all locked = ok. */
export const doorsTone = (doors: (Pick<HDoor, 'known' | 'locked'> & { phase?: DoorPhase | null })[]): DoorTone =>
  doors.some(doorOpen) || doors.some(doorJammed) ? 'warn' : !doors.length || doors.some((d) => !d.known) ? 'neutral' : 'ok';

export function doorsText(doors: HDoor[]): string {
  const u = doors.filter(doorOpen);
  if (!doors.length) return tr('אין דלתות מחוברות');
  if (u.length) return u.length === 1 ? `${u[0].name} ${u[0].kind === 'gate' ? tr('פתוח') : tr('פתוחה')}` : tr('{length} דלתות פתוחות', { length: u.length });
  const jam = doors.filter(doorJammed);
  if (jam.length) return jam.length === 1 ? tr('{name} תקועה', { name: jam[0].name }) : tr('{length} מנעולים תקועים', { length: jam.length });
  const mv = doors.filter((d) => d.phase);
  if (mv.length) return mv.length === 1 ? `${mv[0].name} ${mv[0].phase === 'locking' ? tr('ננעלת…') : tr('נפתחת…')}` : tr('{length} דלתות בתנועה', { length: mv.length });
  const k = doors.filter((d) => !d.known);
  if (!k.length) return tr('כל הדלתות נעולות');
  if (k.length === doors.length) return k.length === 1 ? tr('מצב {name} לא ידוע', { name: k[0].name }) : tr('מצב הדלתות לא ידוע');
  return k.length === 1 ? tr('מצב {name} לא ידוע', { name: k[0].name }) : tr('מצב {length} דלתות לא ידוע', { length: k.length });
}

// HOME-SIMPLE-2421 (lab 2.42.0): why a door offers no "open" here (the server's unlock_reason, the devices panel's own rule), in calm words
const DOOR_NO_OPEN: Record<string, string> = {
  door_not_mapped: tr('הדלת עדיין לא משויכת לעמדה'), no_permission: tr('אין הרשאה לפתוח'), no_control: tr('אין הרשאה לפתוח'), not_placed: tr('אין הרשאה לפתוח את הדלת הזו'),
  wall_profile: tr('מסך קיר לא פותח דלתות'), alarm_managed: tr('נשלטת ממסך האזעקה'),
};
export const doorNoOpenText = (reason: string): string => DOOR_NO_OPEN[reason] ?? tr('אי אפשר לפתוח מכאן כרגע');
export const doorState = (d: HDoor): string =>
  !d.ok ? tr('לא זמינה כרגע') : !d.known ? tr('לא ידוע') : d.phase === 'jammed' ? tr('תקועה') : d.phase === 'locking' ? tr('ננעלת…') : d.phase === 'unlocking' ? tr('נפתחת…') : d.kind === 'gate' ? (d.locked ? tr('סגור') : tr('פתוח')) : d.locked ? tr('נעולה') : tr('פתוחה');

export function shadeText(pos: number | null, moving = false, state: string | null = null): string {
  if (moving) return state === 'closing' ? tr('נסגר') : tr('נפתח');
  if (pos == null) return state === 'open' ? tr('פתוח') : state === 'closed' ? tr('סגור') : tr('לא ידוע');
  return pos === 0 ? tr('סגור') : pos === 100 ? tr('פתוח') : tr('פתוח {pos}%', { pos });
}

/** The mean brightness of the lit dimmable lights (the room's "all the lights" slider), 0 when none is lit. */
export function masterLevel(r: HRoom): number {
  const on = r.lights.filter((l) => l.on && !l.sw);
  return on.length ? Math.round(on.reduce((a, l) => a + l.lvl, 0) / on.length) : 0;
}

export function keptNote(rs: HRoom[]): string {
  const k = loadsOn(rs);
  return !k.length ? '' : k.length === 1 ? tr(' · {name} נשאר דולק', { name: k[0].name }) : tr(' · {length} מפסקים שאינם אור נשארו דולקים', { length: k.length });
}

export function greeting(name: string, at = new Date()): string {
  const h = at.getHours();
  const part = h < 5 ? tr('לילה טוב') : h < 12 ? tr('בוקר טוב') : h < 17 ? tr('צהריים טובים') : h < 21 ? tr('ערב טוב') : tr('לילה טוב');
  // HOME-V3-AUDITFIX-2437 (audit item 29): a first name longer than 14 characters would wrap the greeting to three lines on a phone
  return name && [...name].length <= 14 ? `${part}, ${name}` : part;
}

// ---------------------------------------------------------------- paging (no control screen ever scrolls)

export interface Page<T> { items: T[]; pages: number; page: number }

export function paged<T>(list: T[], per: number, page: number): Page<T> {
  const pages = Math.max(1, Math.ceil(list.length / Math.max(1, per)));
  const p = Math.max(0, Math.min(page, pages - 1));
  return { items: list.slice(p * per, p * per + per), pages, page: p };
}

// ---------------------------------------------------------------- favourites (the room screen's widgets)

export const sameFav = (a: Fav, b: Fav): boolean => a.t === b.t && (a.id ?? null) === (b.id ?? null);
/** Widget width in grid columns (6 on a tablet, 3 on a phone) and height in rows. */
export const favWidth = (f: Fav, isSwitchLight = false): number =>
  f.t === 'scene' || f.t === 'energy' || f.t === 'switch' ? 1 : f.t === 'light' ? (isSwitchLight ? 1 : (f.w ?? 2)) : 2;
export const favHeight = (f: Fav): number => (f.t === 'cam' ? 2 : 1);

/** Pack the widgets into pages of `cols x rows` cells, in order (a widget that does not fit starts the next page). */
export function packPages<T>(items: T[], area: (x: T) => number, cols: number, rows: number): T[][] {
  const pages: T[][] = [[]];
  let used = 0;
  for (const x of items) {
    const a = Math.min(area(x), cols * rows);
    if (used + a > cols * rows) {
      pages.push([]);
      used = 0;
    }
    pages[pages.length - 1].push(x);
    used += a;
  }
  return pages;
}

export interface FavWorld { rooms: HRoom[]; cameras: HCamera[]; scenes: HScene[]; hasEnergy: boolean; hasSecurity: boolean }

const roomScenes = (w: FavWorld, roomId: string) => w.scenes.filter((s) => s.rooms.length === 1 && s.rooms[0] === roomId);
export const homeScenes = (w: FavWorld): HScene[] => w.scenes.filter((s) => s.rooms.length !== 1);

/** The starting widgets of a room (or of "הבית שלי") when neither the person nor the administrator chose any (the mockup's set). */
export function defaultFavs(key: string, w: FavWorld): Fav[] {
  const f: Fav[] = [];
  const allDoors = w.rooms.flatMap((r) => r.doors);
  const allZones = w.rooms.flatMap((r) => r.zones);
  if (key === 'home') {
    homeScenes(w).slice(0, 5).forEach((s) => f.push({ t: 'scene', id: s.id }));
    if (w.hasEnergy) f.push({ t: 'energy' });
    if (w.rooms.some((r) => r.lights.length)) f.push({ t: 'allLights' });
    if (w.cameras[0]) f.push({ t: 'cam', id: w.cameras[0].id });
    if (allDoors[0]) f.push({ t: 'door', id: allDoors[0].id });
    if (allZones[0]) f.push({ t: 'climate', id: allZones[0].id });
    if (allDoors[1]) f.push({ t: 'door', id: allDoors[1].id });
    return f;
  }
  const r = w.rooms.find((x) => x.id === key);
  if (!r) return f;
  roomScenes(w, r.id).slice(0, 2).forEach((s) => f.push({ t: 'scene', id: s.id }));
  r.lights.slice(0, 2).forEach((l) => f.push({ t: 'light', id: l.id, w: 2 }));
  r.loads.slice(0, 2).forEach((x) => f.push({ t: 'switch', id: x.id }));
  if (r.zones[0]) f.push({ t: 'climate', id: r.zones[0].id });
  if (r.cams[0]) f.push({ t: 'cam', id: r.cams[0] });
  if (r.shades[0]) f.push({ t: 'shade', id: r.shades[0].id });
  r.lights.slice(2, 4).forEach((l) => f.push({ t: 'light', id: l.id, w: 1 }));
  if (r.doors[0]) f.push({ t: 'door', id: r.doors[0].id });
  return f;
}

/** Whether a stored favourite still points at something this person can see (a removed device, a hidden room). */
export function favOk(f: Fav, w: FavWorld): boolean {
  const any = (pick: (r: HRoom) => { id: string }[]) => w.rooms.some((r) => pick(r).some((x) => x.id === f.id));
  switch (f.t) {
    case 'light': return any((r) => r.lights);
    case 'switch': return any((r) => r.loads);
    case 'climate': return any((r) => r.zones);
    case 'shade': return any((r) => r.shades);
    case 'door': return any((r) => r.doors);
    case 'cam': return w.cameras.some((c) => c.id === f.id);
    case 'scene': return w.scenes.some((s) => s.id === f.id);
    case 'energy': return w.hasEnergy;
    case 'security': return w.hasSecurity;
    default: return w.rooms.some((r) => r.lights.length);
  }
}

/** SCR-08: the favourites grid only shows what this person can see (favOk); a save of that list must not drop the stored ones that are hidden
 *  right now (a room hidden for a while, a device offline). The hidden ones stay, after the visible list, in their stored order. */
export function keepHiddenFavs(stored: Fav[], next: Fav[], w: FavWorld): Fav[] {
  return [...next, ...stored.filter((f) => !favOk(f, w) && !next.some((n) => sameFav(n, f)))];
}

export function floorName(floors: HFloor[], id: string): string {
  return floors.find((f) => f.id === id)?.name ?? '';
}
