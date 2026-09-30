import type { CardId } from '../api/devices';
import type { IconName } from '../components/sw-icon';
import { cameraCardDefinition } from './devices-camera-card';

/**
 * The area screen's card library (owner request 2026-09-30, layout schema v 3): what the layout editor offers when a card
 * is added, how a custom card picks its devices, and the small pure helpers behind the editor's device picker and the
 * automatic placement of a new card. Presentation only - nothing here talks to Home Assistant or the server; a custom card
 * is stored in the area's layout (routers/device_layouts.py validates it) and only ever lists devices the screen already
 * shows the caller.
 */

/** The layout schema version that carries custom and deleted cards (routers/device_layouts.py CARDS_VERSION). */
export const CARDS_VERSION = 3;

/** The library's card types (keep in step with CUSTOM_TYPES in routers/device_layouts.py - a backend test compares them):
 * the seven built-in domain cards, plus locks and gates, energy and the free card. */
export const CARD_TYPE_IDS = ['lighting', 'switches', 'climate', 'covers', 'security', 'media', 'sensors', 'locks', 'energy', 'free', 'camera'] as const;
export type CardTypeId = (typeof CARD_TYPE_IDS)[number];

/** A device of the area as the editor lists it (from the area's own cards - already what this caller may see). */
export interface AreaEntity {
  id: string;
  name: string;
  /** The built-in card the device belongs to automatically. */
  card: CardId;
  domain: string;
  /** The sensors card's own grouping (device class), when it has one. */
  group?: string;
  /** A door / garage / gate cover. */
  door?: boolean;
}

export interface CardTypeInfo {
  id: CardTypeId;
  label: string;
  desc: string;
  icon: IconName;
  /** Drawn as two-up tiles (lighting, switches, sensors, energy) or as full-width rows. */
  tiles: boolean;
  /** Which of the area's devices a new card of this type starts with (the free card starts with the unplaced ones). */
  match: (e: AreaEntity) => boolean;
}

const cameraDef = cameraCardDefinition();

export const CARD_TYPES: Record<CardTypeId, CardTypeInfo> = {
  lighting: { id: 'lighting', label: 'תאורה', desc: 'מנורות וספוטים: הדלקה, כיבוי ועוצמה', icon: 'light', tiles: true, match: (e) => e.card === 'lighting' },
  switches: { id: 'switches', label: 'מתגים', desc: 'שקעים, מתגים ומעגלים חשמליים', icon: 'bolt', tiles: true, match: (e) => e.card === 'switches' },
  climate: { id: 'climate', label: 'אקלים', desc: 'מזגנים, מאווררים ומכשירי לחות', icon: 'activity', tiles: false, match: (e) => e.card === 'climate' },
  covers: { id: 'covers', label: 'תריסים', desc: 'תריסים, וילונות ושליטה במיקום', icon: 'layers', tiles: false, match: (e) => e.card === 'covers' && !e.door },
  security: { id: 'security', label: 'מצלמות ואבטחה', desc: 'מצלמות, אזעקה וחיישני מגע ותנועה', icon: 'shield', tiles: false, match: (e) => e.card === 'security' && e.domain !== 'lock' },
  media: { id: 'media', label: 'מדיה', desc: 'טלוויזיות ונגנים: מצב, מקור ועוצמה', icon: 'play', tiles: false, match: (e) => e.card === 'media' },
  sensors: { id: 'sensors', label: 'חיישנים', desc: 'טמפרטורה, לחות, סוללה ושאר החיישנים', icon: 'sensor', tiles: true, match: (e) => e.card === 'sensors' },
  locks: { id: 'locks', label: 'מנעולים ושערים', desc: 'מנעולי דלתות, שערים ודלתות חניה', icon: 'lock', tiles: false, match: (e) => e.domain === 'lock' || (e.card === 'covers' && !!e.door) },
  energy: { id: 'energy', label: 'אנרגיה', desc: 'צריכת חשמל, הספק ומדי אנרגיה', icon: 'bolt', tiles: true, match: (e) => e.card === 'sensors' && e.group === 'power' },
  free: { id: 'free', label: 'כרטיס חופשי', desc: 'כרטיס ריק שבוחרים לו התקנים ושם בעצמכם', icon: 'grid', tiles: false, match: () => false },
  // the camera card (screens/devices-camera-card.ts) is added as a `camera:<slug>` layout item with a picked camera, not as a
  // `card:c-` custom card; it is in the library like every type, and offered where cameras exist and the user may watch
  camera: { id: 'camera', label: cameraDef.label, desc: cameraDef.description, icon: cameraDef.icon, tiles: false, match: () => false },
};

export function isCardType(v: string): v is CardTypeId {
  return (CARD_TYPE_IDS as readonly string[]).includes(v);
}

/** The types worth offering for this area's devices: those with a matching device, plus the free card; all of them with
 * `all`. Each carries how many of the area's devices it would start with. */
export function libraryTypes(pool: AreaEntity[], all: boolean, counts: Partial<Record<CardTypeId, number>> = {}): { type: CardTypeInfo; count: number; sample: string[] }[] {
  return CARD_TYPE_IDS.map((id) => CARD_TYPES[id])
    .map((type) => {
      const hits = pool.filter(type.match);
      // a type the area's devices cannot tell (the camera card: cameras come from the NVR catalogue) gets its count from the caller
      return { type, count: counts[type.id] ?? hits.length, sample: hits.slice(0, 3).map((e) => e.name) };
    })
    .filter((x) => all || x.type.id === 'free' || x.count > 0);
}

/** A key for a new custom card: `card:c-` and 8 lowercase letters / digits (what the server accepts), unused so far. */
export function newCardKey(existing: Iterable<string>, random: () => number = Math.random): string {
  const used = new Set(existing);
  for (let guard = 0; guard < 50; guard++) {
    let id = '';
    for (let i = 0; i < 8; i++) id += 'abcdefghijklmnopqrstuvwxyz0123456789'[Math.floor(random() * 36)];
    const key = `card:c-${id}`;
    if (!used.has(key)) return key;
  }
  return `card:c-${Date.now().toString(36).slice(-8).padStart(8, '0')}`;
}

/** The title a new card gets: the type's name, numbered when one with that name exists ("חיישנים 2"). */
export function nextTitle(base: string, titles: Iterable<string>): string {
  const used = new Set(titles);
  if (!used.has(base)) return base;
  for (let n = 2; n < 200; n++) if (!used.has(`${base} ${n}`)) return `${base} ${n}`;
  return base;
}

interface Box {
  x: number;
  y: number;
  w: number;
  h: number;
  removed?: boolean;
}

/** Where a new card of w x h grid units goes: the first free place scanning rows top to bottom and columns from the
 * start edge, so it fills a gap beside existing cards before it opens a new row (deleted cards leave no slot). */
export function findSlot(items: Record<string, Box>, cols: number, w: number, h: number, gap = 2): { x: number; y: number } {
  const live = Object.values(items).filter((b) => !b.removed);
  const width = Math.min(w, cols);
  const bottom = Math.max(0, ...live.map((b) => b.y + b.h));
  const free = (x: number, y: number) => live.every((b) => !(x < b.x + b.w && b.x < x + width && y < b.y + b.h + gap && b.y < y + h + gap));
  for (let y = 0; y <= bottom; y++) {
    for (let x = 0; x + width <= cols; x++) {
      if (free(x, y)) return { x, y };
    }
  }
  return { x: 0, y: bottom + (live.length ? gap : 0) };
}

/** A device passes the picker's search box: any word of the query is in its name or id (case-insensitive). */
export function matchesQuery(e: { id: string; name: string }, query: string): boolean {
  const words = query.trim().toLowerCase().split(/\s+/).filter(Boolean);
  if (!words.length) return true;
  const hay = `${e.name} ${e.id}`.toLowerCase();
  return words.every((w) => hay.includes(w));
}

export interface PickEntity {
  id: string;
  name: string;
  /** The type header the picker groups it under (empty = one group, no header). */
  group?: string;
}

/** The picker's list in groups, in the order the groups first appear; the filter keeps only matching devices. */
export function groupPicks(list: PickEntity[], query: string): { label: string; items: PickEntity[] }[] {
  const groups = new Map<string, PickEntity[]>();
  for (const e of list) {
    if (!matchesQuery(e, query)) continue;
    const g = e.group ?? '';
    const items = groups.get(g);
    if (items) items.push(e);
    else groups.set(g, [e]);
  }
  return [...groups].map(([label, items]) => ({ label, items }));
}

/** The selection after a bulk action over `scope` (the filtered ids): everything in it, nothing of it, or flipped. */
export function bulkSelect(selected: Set<string>, scope: string[], mode: 'all' | 'none' | 'invert'): Set<string> {
  const next = new Set(selected);
  for (const id of scope) {
    if (mode === 'all') next.add(id);
    else if (mode === 'none') next.delete(id);
    else if (next.has(id)) next.delete(id);
    else next.add(id);
  }
  return next;
}
