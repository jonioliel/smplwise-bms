// HOME-FAVORITES-2500 (owner 22.11, Q77 / Q78 / Q79 = the recommendation): the pure logic of the favourites grid of a room screen.
// Q78: the person's order is kept. The grid used to pack with `grid-auto-flow: dense`, which moved a later small tile up into the gap a
// wide tile left at the end of a row, so the screen showed another order than the one the person chose. Each tile now gets its cell
// explicitly, in order (the CSS grid's own sparse placement), and every empty cell left before the last row in use is a "+ הוסף" hole
// that adds a favourite exactly there. Q77: the long-press drag drops a tile on another tile or on a hole (the arrows stay).
// Q79: which follow-up a scene suggests (lock the doors, arm the alarm); the dialog and the code are home-scene-2500.ts.
// No DOM and no tr() here: tests/unit-home-favorites-2500.spec.ts runs it in Node.
import type { Fav } from './home-api';

interface FavSize { w: number; h: number }
/** A favourite placed on the grid: 0-based row / column, its spans, and its index in the person's list. */
export interface FavCell<T> { kind: 'fav'; item: T; ix: number; r: number; c: number; w: number; h: number }
/** An empty run of cells in one row; `at` is where a favourite added there goes in the person's list. */
export interface FavHole { kind: 'hole'; at: number; r: number; c: number; w: number }
type GridCell<T> = FavCell<T> | FavHole;
interface GridPage<T> { cells: GridCell<T>[]; favs: FavCell<T>[] }

/** Places the favourites in order, page by page (a page is `cols` x `rows`; nothing ever scrolls), and finds the holes of each page.
 *  The placement is the CSS grid's sparse auto-placement: each tile goes to the first cell at or after the cursor where it fits, and the
 *  cursor moves to just after it; a tile that fits nowhere on the page starts the next one. */
export function layoutFavPages<T>(items: T[], size: (x: T, i: number) => FavSize, cols: number, rows: number): GridPage<T>[] {
  const pages: GridPage<T>[] = [];
  let occ: boolean[] = [];
  let cursor = 0;
  let favs: FavCell<T>[] = [];
  const fits = (p: number, w: number, h: number): boolean => {
    const r = Math.floor(p / cols);
    const c = p % cols;
    if (c + w > cols || r + h > rows) return false;
    for (let y = r; y < r + h; y++) for (let x = c; x < c + w; x++) if (occ[y * cols + x]) return false;
    return true;
  };
  const find = (w: number, h: number): number => {
    for (let p = cursor; p < cols * rows; p++) if (fits(p, w, h)) return p;
    return -1;
  };
  const close = (next: number) => {
    pages.push({ cells: withHoles(favs, occ, cols, next), favs });
    occ = [];
    cursor = 0;
    favs = [];
  };
  items.forEach((item, ix) => {
    const s = size(item, ix);
    const w = Math.min(Math.max(1, s.w), cols);
    const h = Math.min(Math.max(1, s.h), rows);
    let p = find(w, h);
    if (p < 0 && favs.length) {
      close(ix);
      p = find(w, h);
    }
    if (p < 0) p = 0; // cannot happen once w and h are clamped (an empty page takes any tile)
    const r = Math.floor(p / cols);
    const c = p % cols;
    for (let y = r; y < r + h; y++) for (let x = c; x < c + w; x++) occ[y * cols + x] = true;
    favs.push({ kind: 'fav', item, ix, r, c, w, h });
    cursor = p + w;
  });
  close(items.length);
  return pages;
}

/** The page's cells in reading order: its favourites and, in every row up to the last one in use, each run of empty cells as one hole.
 *  A hole's `at` is the list index of the first favourite placed after it (or `next`, the first index of the following page). */
function withHoles<T>(favs: FavCell<T>[], occ: boolean[], cols: number, next: number): GridCell<T>[] {
  if (!favs.length) return [];
  const last = Math.max(...favs.map((f) => f.r + f.h - 1));
  const holes: FavHole[] = [];
  for (let r = 0; r <= last; r++) {
    for (let c = 0; c < cols; c++) {
      const p = r * cols + c;
      if (occ[p]) continue;
      const after = favs.find((f) => f.r * cols + f.c > p);
      const at = after ? after.ix : next;
      const prev = holes[holes.length - 1];
      if (prev && prev.r === r && prev.c + prev.w === c && prev.at === at) prev.w += 1;
      else holes.push({ kind: 'hole', at, r, c, w: 1 });
    }
  }
  const key = (x: GridCell<T>) => x.r * cols + x.c;
  return [...favs, ...holes].sort((a, b) => key(a) - key(b));
}

/** The inline grid placement of a cell (1-based CSS lines). */
export const cellArea = (x: { r: number; c: number; w: number; h?: number }): string => `grid-area: ${x.r + 1} / ${x.c + 1} / span ${x.h ?? 1} / span ${x.w}`;

/** A copy of `list` with the item at `from` moved so it ends at index `to` (both in the list as it is now; out of range = unchanged). */
export function moveTo<T>(list: T[], from: number, to: number): T[] {
  const out = list.slice();
  if (from < 0 || from >= out.length || to < 0 || to >= out.length || from === to) return out;
  const [x] = out.splice(from, 1);
  out.splice(to, 0, x);
  return out;
}

/** Where a dragged favourite ends when it is dropped on another favourite (it takes that one's place) or on a hole (it goes in at the
 *  hole's `at`, counted before the dragged one leaves its place). */
export function dropIndex(from: number, target: { kind: 'fav'; ix: number } | { kind: 'hole'; at: number }, length: number): number {
  if (target.kind === 'fav') return target.ix;
  const at = Math.min(Math.max(0, target.at), length);
  return at > from ? at - 1 : at;
}

/** A copy of `list` with `item` inserted at `at` (clamped). */
export function insertAt<T>(list: T[], at: number, item: T): T[] {
  const out = list.slice();
  out.splice(Math.min(Math.max(0, at), out.length), 0, item);
  return out;
}

// ---------------------------------------------------------------- what "+ הוסף" offers

interface AddWorld {
  rooms: { id: string; lights: { id: string; sw: boolean }[]; loads: { id: string }[]; zones: { id: string }[]; shades: { id: string }[]; doors: { id: string }[] }[];
  cameras: { id: string; room: string | null }[];
  scenes: { id: string; rooms: string[] }[];
  hasEnergy: boolean;
}

/** What may still be added to the favourites of `key` ('home' or a room id), in the order the picker shows it: for a room, its own scenes,
 *  lights, switches, climate, shades, doors and cameras, then the house scenes; for "הבית שלי", the house scenes, the whole-house tiles,
 *  the cameras, the doors and the climate of every room. What is already a favourite there is left out. */
export function addCandidates(key: string, w: AddWorld, current: Fav[]): Fav[] {
  const out: Fav[] = [];
  const houseScenes = w.scenes.filter((s) => s.rooms.length !== 1);
  if (key === 'home') {
    houseScenes.forEach((s) => out.push({ t: 'scene', id: s.id }));
    if (w.rooms.some((r) => r.lights.length)) out.push({ t: 'allLights' });
    if (w.hasEnergy) out.push({ t: 'energy' });
    w.cameras.forEach((c) => out.push({ t: 'cam', id: c.id }));
    w.rooms.forEach((r) => r.doors.forEach((d) => out.push({ t: 'door', id: d.id })));
    w.rooms.forEach((r) => r.zones.forEach((z) => out.push({ t: 'climate', id: z.id })));
  } else {
    const r = w.rooms.find((x) => x.id === key);
    if (r) {
      w.scenes.filter((s) => s.rooms.length === 1 && s.rooms[0] === r.id).forEach((s) => out.push({ t: 'scene', id: s.id }));
      r.lights.forEach((l) => out.push({ t: 'light', id: l.id, w: l.sw ? 1 : 2 }));
      r.loads.forEach((x) => out.push({ t: 'switch', id: x.id }));
      r.zones.forEach((z) => out.push({ t: 'climate', id: z.id }));
      r.shades.forEach((s) => out.push({ t: 'shade', id: s.id }));
      r.doors.forEach((d) => out.push({ t: 'door', id: d.id }));
      w.cameras.filter((c) => c.room === r.id).forEach((c) => out.push({ t: 'cam', id: c.id }));
      houseScenes.forEach((s) => out.push({ t: 'scene', id: s.id }));
    }
  }
  const same = (a: Fav, b: Fav) => a.t === b.t && (a.id ?? null) === (b.id ?? null);
  return out.filter((f) => !current.some((x) => same(x, f)));
}

// ---------------------------------------------------------------- Q79: what a scene suggests next

export type ArmMode = 'arm_away' | 'arm_home' | 'arm_night';
interface PanelLike {
  entity_id: string;
  state: string | null;
  available: boolean;
  arm_modes: string[];
  can: { arm: boolean };
  code: { arm: string };
}
interface DoorLike { id: string; ok: boolean; can: boolean; locked: boolean; wiskey: boolean; kind: 'door' | 'gate'; /** HONEST-STATES-2540: false = unknown state (not offered as an open door) */ known?: boolean }

export type Suggestion<P, D> = { kind: 'lock'; doors: D[] } | { kind: 'arm'; panel: P; mode: ArmMode };

/** What to offer after a scene ran (owner Q79 "חלון הצעה שצריך לאשר, עם הקוד הרגיל"): only after a leaving or a night scene (the scene's
 *  icon, read from its name), first the doors that are unlocked and may be locked from here (a WisKey door locks itself again, a gate
 *  is not "locked"), then the alarm when it is disarmed, the person may arm it and the panel's code rule can be met from the home
 *  interface (a personal code that is not set yet, or a code that cannot be checked, offers nothing). Nothing is ever run from here. */
export function sceneSuggestions<P extends PanelLike, D extends DoorLike>(icon: string, panels: P[], doors: D[]): Suggestion<P, D>[] {
  if (icon !== 'leave' && icon !== 'night') return [];
  const out: Suggestion<P, D>[] = [];
  const open = doors.filter((d) => d.kind === 'door' && d.ok && d.known !== false && d.can && !d.locked && !d.wiskey);
  if (open.length) out.push({ kind: 'lock', doors: open });
  const want: ArmMode[] = icon === 'leave' ? ['arm_away'] : ['arm_night', 'arm_home'];
  for (const p of panels) {
    if (!p.available || p.state !== 'disarmed' || !p.can.arm || p.code.arm === 'unverifiable' || p.code.arm === 'pin_missing') continue;
    const mode = want.find((m) => p.arm_modes.includes(m));
    if (mode) { out.push({ kind: 'arm', panel: p, mode }); break; }
  }
  return out;
}

/** Whether arming from the suggestion goes through the code pad (the panel's own rule, exactly as on the alarm screen). */
export const armNeedsCode = (p: { code: { arm: string } }): boolean => p.code.arm === 'pin' || p.code.arm === 'panel';
