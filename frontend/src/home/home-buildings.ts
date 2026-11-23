// MULTI-BUILDING-HOME-2500 (owner decisions 22.11, Q64-Q67): the building level of the home interface on a multi-building site.
// Pure rules (tests/unit-mb-home-2500.spec.ts) - the server decides everything that matters: which buildings the person's rooms reach
// (GET /home/overview `buildings`, sent only while the multi-building switch is on and the rooms reach two or more), each room's building,
// and the cut of "כבה הכל" for one building (the bulk route's `building`, services/building_scope). The choice here is DISPLAY only.
//
// - Q64: "כל הבניינים" is offered only when the installation allows it (`building_all`).
// - Q65: the building the interface opens on: a wall panel's room building or the administrator's building for the person
//   (`entry_building`), else the last one chosen on this device, else the first one.
// - Q66: "כבה הכל" acts on the chosen building only and names it; under "כל הבניינים" there is no whole-site off.
// - Q67: an item serving two buildings (a meter, a scene schedule) shows in each of them with "גם ב<the other>".
import { tr } from '../i18n/msg/home';

export interface HBuilding { id: string; name: string; shared: boolean }
/** "כל הבניינים" (only when the installation offers it) */
export const ALL = '*';
const LAST_KEY = 'home.building';

/** The building last chosen on this device ('' when none, or the storage is off). */
export function readLast(): string {
  try { return localStorage.getItem(LAST_KEY) ?? ''; } catch { return ''; }
}

export function saveLast(id: string): void {
  try { localStorage.setItem(LAST_KEY, id); } catch { /* storage off: the next visit opens on the entry building again */ }
}

/** Q65: the building the interface opens on. '' = no building level (one building, or the switch off). */
export function pickBuilding(buildings: HBuilding[], entry: string | null, last: string, allowAll: boolean): string {
  if (buildings.length < 2) return '';
  const known = (id: string | null) => !!id && buildings.some((b) => b.id === id);
  if (known(entry)) return entry as string;
  if (last === ALL && allowAll) return ALL;
  if (known(last)) return last;
  return buildings[0].id;
}

/** A building choice still valid after the overview changed (a building gone, "כל הבניינים" no longer offered). */
export function keepBuilding(cur: string, buildings: HBuilding[], allowAll: boolean, entry: string | null): string {
  if (buildings.length < 2) return '';
  if (cur === ALL ? allowAll : buildings.some((b) => b.id === cur)) return cur;
  return pickBuilding(buildings, entry, readLast(), allowAll);
}

type Placed = { bld?: string | null };

/** The rooms shown for a building: its own rooms and the rooms the mapping puts in no building (shown with every building). */
export function roomsIn<T extends Placed>(rooms: T[], b: string): T[] {
  if (!b || b === ALL) return rooms;
  return rooms.filter((r) => r.bld === b || r.bld == null);
}

/** Q66: the rooms "כבה הכל" of a building reaches - its own rooms only (the server's cut agrees: an unplaced room is in no building). */
export function offRooms<T extends Placed>(rooms: T[], b: string): T[] {
  if (!b || b === ALL) return rooms;
  return rooms.filter((r) => r.bld === b);
}

/** Q67: the buildings an item serves, from the areas it touches: an area's building; an area of the shared building serves every building
 * (the car park, the lobby). In the buildings' order. An item with no placed area serves none (it shows with every building). */
export function servedBy(areas: (string | null | undefined)[], areaB: Record<string, string>, buildings: HBuilding[]): string[] {
  const ids = new Set<string>();
  for (const a of areas) {
    const b = a ? areaB[a] : undefined;
    if (!b) continue;
    if (buildings.find((x) => x.id === b)?.shared) buildings.forEach((x) => ids.add(x.id));
    else ids.add(b);
  }
  return buildings.filter((b) => ids.has(b.id)).map((b) => b.id);
}

/** Whether an item serving `served` shows under the building `b`. */
export function shows(served: string[], b: string): boolean {
  return !b || b === ALL || served.length === 0 || served.includes(b);
}

/** Q67: "גם במגדל ב" / "גם במגדל ב ובחניון" - the other buildings an item serves; '' when it serves only this one (or under "כל הבניינים"). */
export function alsoNote(served: string[], b: string, buildings: HBuilding[]): string {
  if (!b || b === ALL) return '';
  const others = served.filter((id) => id !== b).map((id) => buildings.find((x) => x.id === id)?.name).filter((n): n is string => !!n);
  if (!others.length || !served.includes(b)) return '';
  return tr('גם ב{names}', { names: others.join(tr(' וב')) });
}

/** Under "כל הבניינים": the building a floor column belongs to (the building of its first placed room), so the columns group by building
 * (never interleaved: the floors sorted by their building's order, unplaced floors last) and each header names its building. */
export function floorBuilding(floorId: string, rooms: (Placed & { floor: string })[], buildings: HBuilding[]): HBuilding | undefined {
  const b = rooms.find((r) => r.floor === floorId && r.bld)?.bld;
  return b ? buildings.find((x) => x.id === b) : undefined;
}

export function byBuilding<F extends { id: string }>(floors: F[], rooms: (Placed & { floor: string })[], buildings: HBuilding[]): F[] {
  const at = (f: F) => { const b = floorBuilding(f.id, rooms, buildings); return b ? buildings.indexOf(b) : buildings.length; };
  return floors.map((f, i) => ({ f, i, k: at(f) })).sort((a, b) => a.k - b.k || a.i - b.i).map((x) => x.f);
}

/** The building's name ('' for none / all). */
export function nameOf(buildings: HBuilding[], b: string): string {
  return b && b !== ALL ? buildings.find((x) => x.id === b)?.name ?? '' : '';
}

/** Q66: the house-off button's words: "כבה הכל ב<building>". */
export const offLabel = (name: string): string => tr('כבה הכל ב{name}', { name });
