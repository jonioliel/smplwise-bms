// HOME-SIMPLE-2420: the home interface's pure rules - the words it says, the paging that keeps every control screen free of
// scrolling, and the default favourites. No DOM, no network (unit-tested in tests/unit-home-simple-logic.spec.ts).
import type { Fav, HDoor, HLoad, HRoom, HZone, HScene, HCamera, HFloor } from './home-api';

export const lightsText = (n: number): string => (n === 0 ? 'כל האורות כבויים' : n === 1 ? 'אור אחד דולק' : `${n} אורות דולקים`);
export const onCount = (rs: HRoom[]): number => rs.reduce((n, r) => n + r.lights.filter((l) => l.on).length, 0);
export const onWord = (on: boolean): string => (on ? 'דולק' : 'כבוי');

export const MODES: Record<string, string> = { cool: 'קירור', heat: 'חימום', auto: 'אוטומטי', heat_cool: 'אוטומטי', dry: 'ייבוש', fan_only: 'אוורור', off: 'כבוי' };
export const PRESETS: [string, number][] = [['נעים', 23], ['חיסכון', 26], ['לילה', 22]];

export const zoneOn = (z: HZone): boolean => z.mode !== 'off' && z.ok;
export const roomActive = (r: HRoom): boolean => r.lights.some((l) => l.on) || r.zones.some(zoneOn);
export const activeRooms = (rs: HRoom[]): HRoom[] => rs.filter(roomActive);
export const loadsOn = (rs: HRoom[]): HLoad[] => rs.flatMap((r) => r.loads.filter((x) => x.on));

export function roomLights(r: HRoom): string {
  const n = r.lights.filter((l) => l.on).length;
  if (!r.lights.length && !r.shades.length && !r.zones.length && !r.loads.length) return 'אין כאן התקנים';
  if (!r.lights.length) return 'אין אורות';
  return n === 0 ? 'חשוך' : n === 1 ? 'אור אחד דולק' : `${n} אורות דולקים`;
}

export function activeText(r: HRoom): string {
  const p: string[] = [];
  const n = r.lights.filter((l) => l.on).length;
  if (n) p.push(n === 1 ? 'אור אחד' : `${n} אורות`);
  const z = r.zones.find(zoneOn);
  if (z) p.push(z.target != null ? `מיזוג ${z.target}°` : 'מיזוג');
  return p.join(' · ') || 'הכל כבוי';
}

export function homeBarText(rs: HRoom[]): string {
  const n = onCount(rs);
  const a = activeRooms(rs).length;
  return n || a ? `${lightsText(n)}${a ? (a === 1 ? ' · בחדר אחד' : ` · ב-${a} חדרים`) : ''}` : 'הכל כבוי בבית';
}

export function doorsText(doors: HDoor[]): string {
  const u = doors.filter((d) => !d.locked);
  if (!doors.length) return 'אין דלתות מחוברות';
  if (!u.length) return 'כל הדלתות נעולות';
  return u.length === 1 ? `${u[0].name} ${u[0].kind === 'gate' ? 'פתוח' : 'פתוחה'}` : `${u.length} דלתות פתוחות`;
}

// HOME-SIMPLE-2421 (lab 2.42.0): why a door offers no "open" here (the server's unlock_reason, the devices panel's own rule), in calm words
const DOOR_NO_OPEN: Record<string, string> = {
  door_not_mapped: 'הדלת עדיין לא משויכת לעמדה', no_permission: 'אין הרשאה לפתוח', no_control: 'אין הרשאה לפתוח', not_placed: 'אין הרשאה לפתוח את הדלת הזו',
  wall_profile: 'מסך קיר לא פותח דלתות', alarm_managed: 'נשלטת ממסך האזעקה',
};
export const doorNoOpenText = (reason: string): string => DOOR_NO_OPEN[reason] ?? 'אי אפשר לפתוח מכאן כרגע';
export const doorState = (d: HDoor): string => (d.kind === 'gate' ? (d.locked ? 'סגור' : 'פתוח') : d.locked ? 'נעולה' : 'פתוחה');

export function shadeText(pos: number | null, moving = false, state: string | null = null): string {
  if (moving) return state === 'closing' ? 'נסגר' : 'נפתח';
  if (pos == null) return state === 'open' ? 'פתוח' : state === 'closed' ? 'סגור' : 'לא ידוע';
  return pos === 0 ? 'סגור' : pos === 100 ? 'פתוח' : `פתוח ${pos}%`;
}

/** The mean brightness of the lit dimmable lights (the room's "all the lights" slider), 0 when none is lit. */
export function masterLevel(r: HRoom): number {
  const on = r.lights.filter((l) => l.on && !l.sw);
  return on.length ? Math.round(on.reduce((a, l) => a + l.lvl, 0) / on.length) : 0;
}

export function keptNote(rs: HRoom[]): string {
  const k = loadsOn(rs);
  return !k.length ? '' : k.length === 1 ? ` · ${k[0].name} נשאר דולק` : ` · ${k.length} מפסקים שאינם אור נשארו דולקים`;
}

export function greeting(name: string, at = new Date()): string {
  const h = at.getHours();
  const part = h < 5 ? 'לילה טוב' : h < 12 ? 'בוקר טוב' : h < 17 ? 'צהריים טובים' : h < 21 ? 'ערב טוב' : 'לילה טוב';
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

export function floorName(floors: HFloor[], id: string): string {
  return floors.find((f) => f.id === id)?.name ?? '';
}
