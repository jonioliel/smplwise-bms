import { html, nothing, type LitElement, type ReactiveController, type TemplateResult } from 'lit';
import { classMap } from 'lit/directives/class-map.js';
import { styleMap } from 'lit/directives/style-map.js';
import '../components/sw-button';
import '../components/sw-dialog';
import '../components/sw-icon';
import type { IconName } from '../components/sw-icon';
import { api, ApiError, describeError, post, put } from '../api/client';
import { can, isApi } from '../api/session';
import { registerScreenEdit } from '../shell/screen-edit';
import { LAYOUT_ROLE_IDS, type LayoutRoleId } from '../styles/devices-palettes';
import { bulkSelect, CARD_TYPES, CARDS_VERSION, findSlot, groupPicks, isCardType, libraryTypes, newCardKey, nextTitle, type AreaEntity, type PickEntity } from './devices-layout-cards';

/**
 * CR-007 slice 6b: the layout editor of the device screens (owner decisions 7.11; docs/design/DEVICE_THEMES.md §7).
 *
 * One layout per installation and screen, stored on the server (routers/device_layouts.py), shown to everyone,
 * edited only by a holder of system.configure - the "ערוך פריסה" button exists only for them, checked against the
 * session's own permissions (`can('system.configure')`, installation scope), and the server checks it again.
 *
 * A layout places the screen's items (building: `floor:<id>` floor cards and `area:<id>` area tiles; area screen:
 * `card:<id>` domain cards) on a grid: 12 columns on a desktop, 4 on a phone, rows of 8 px. Positions and sizes are
 * LOGICAL grid units: x counts from the start edge (the right in RTL), so the same record is right in Hebrew and
 * mirrored for an LTR viewer; the grid is CSS grid placement (devices-layout-css.ts), never absolute pixels.
 *
 * Per item: position and size, text size (3 steps), background and border colour as palette ROLES (never a colour
 * value), a custom title and an icon of the product's set, hidden. The phone layout is derived automatically from
 * the desktop one (one column, in the desktop's reading order) until it is edited on its own; "חזור לאוטומטי" drops it.
 *
 * A grid with nothing stored keeps the screen's automatic layout, pixel for pixel. Entering the editor measures that
 * automatic layout (what the editor sees is what it starts from).
 *
 * Slice 6c (owner 2026-09-29, "1.א"): inside the area screen's domain cards, each device tile can be arranged too. In
 * edit mode a card's "סידור התקנים" opens that card alone ("tile arrangement": a breadcrumb back to the cards), where
 * tiles are dragged into a new order (keyboard: arrows move a tile earlier / later, Shift + arrows change its span, H
 * hides it) and the side panel sets span (of the card's TILE_COLS columns), size (s / m / l), hidden and a custom title.
 * Stored per card item as `tiles` = {entity id: {order, span, size, hidden, title}} in a layout of schema `v: 2`; a
 * hidden tile and the card's `hidden_entities` are one set. "אפס סידור" drops the card's arrangement. The phone layout
 * derives the tile order from the desktop one (one column: every tile full width) and can then be arranged on its own.
 */

export type LayoutScope = 'building' | 'area';
export type LayoutVariant = 'desktop' | 'phone';
export type LayoutText = 'sm' | 'md' | 'lg';

/** The icons a card may carry (keep in step with ICONS in routers/device_layouts.py - a backend test compares them). */
export const LAYOUT_ICONS = [
  'light', 'bolt', 'activity', 'layers', 'shield', 'play', 'sensor', 'home', 'building', 'floor', 'stairs', 'elevator',
  'lock', 'door', 'camera', 'eye', 'bell', 'clock', 'calendar', 'wifi', 'volume', 'users', 'map', 'grid', 'dashboard',
  'star', 'sparkle', 'cube', 'hand', 'info',
] as const satisfies readonly IconName[];
export type LayoutIcon = (typeof LAYOUT_ICONS)[number];

/** The palette roles a card's colours may take (ROLES in routers/device_layouts.py; resolved in devices-palettes.ts). */
export const LAYOUT_ROLES = ['accent', 'warm', 'cool', 'success', 'warning', 'danger', 'neutral'] as const satisfies readonly LayoutRoleId[];

const ICON_HE: Record<LayoutIcon, string> = {
  light: 'תאורה', bolt: 'חשמל', activity: 'מיזוג', layers: 'תריסים', shield: 'אבטחה', play: 'מסכים', sensor: 'חיישן', home: 'בית',
  building: 'מבנה', floor: 'קומה', stairs: 'מדרגות', elevator: 'מעלית', lock: 'מנעול', door: 'דלת', camera: 'מצלמה', eye: 'צפייה',
  bell: 'פעמון', clock: 'שעון', calendar: 'לוח שנה', wifi: 'רשת', volume: 'שמע', users: 'אנשים', map: 'מפה', grid: 'אריחים',
  dashboard: 'לוח מחוונים', star: 'כוכב', sparkle: 'ניצוץ', cube: 'קובייה', hand: 'יד', info: 'מידע',
};
export const ROLE_HE: Record<LayoutRoleId, string> = { accent: 'הדגשה', warm: 'חם', cool: 'קריר', success: 'הצלחה', warning: 'אזהרה', danger: 'סכנה', neutral: 'ניטרלי' };

export type TileSize = 's' | 'm' | 'l';

/** Slice 6c: one device tile inside an area card. */
export interface TileLayout {
  /** Its place in the card (0 first; unique within the card). */
  order: number;
  /** Its width in the card's tile columns (TILE_COLS). */
  span: number;
  size: TileSize;
  hidden: boolean;
  /** A custom title (plain text), else the device's own name. */
  title: string | null;
}

export interface TileEntry {
  id: string;
  t: TileLayout;
}

/** The tile columns of each area card (keep in step with TILE_COLS in routers/device_layouts.py - a backend test compares them). */
export const TILE_COLS: Record<string, number> = { lighting: 2, switches: 2, climate: 2, covers: 2, security: 2, media: 2, sensors: 2 };
/** The layout schema this editor writes (1 = 6b; 2 = 6c, device tiles). routers/device_layouts.py LAYOUT_VERSION. */
export const LAYOUT_VERSION = 2;
export const SIZE_HE: Record<TileSize, string> = { s: 'קטן', m: 'רגיל', l: 'גדול' };

export interface LayoutItem {
  x: number;
  y: number;
  w: number;
  h: number;
  text: LayoutText;
  bg: LayoutRoleId | null;
  border: LayoutRoleId | null;
  title: string | null;
  icon: LayoutIcon | null;
  hidden: boolean;
  /** Area cards: the entities the card does not show (they still count in its numbers). */
  hidden_entities: string[];
  /** Slice 6c, area cards: the card's device-tile arrangement (absent or empty: the automatic order). */
  tiles?: Record<string, TileLayout>;
  /** Layout v 3 (card library): a custom card's type and devices (keys `card:c-<id>`; read from the DESKTOP layout). */
  custom?: { type: string; entities: string[] };
  /** Layout v 3: a built-in card the editor deleted (its devices simply show in no card of that name). */
  removed?: boolean;
}

export interface Layout {
  v: 1 | 2 | 3;
  cols: number;
  items: Record<string, LayoutItem>;
}

export interface LayoutVariantRecord {
  layout: Layout;
  revision: number;
  updated_by: string | null;
  updated_at: string;
}

export interface LayoutRecord {
  scope: LayoutScope;
  id: string;
  desktop: LayoutVariantRecord | null;
  phone: LayoutVariantRecord | null;
  can_edit: boolean;
  /** A floor-scoped reader got only the items they can see: the rows the others held are packed away. */
  narrowed?: boolean;
}

export const COLS: Record<LayoutVariant, number> = { desktop: 12, phone: 4 };
/** One grid row, in px. */
export const ROW_PX = 8;
/** The gap left between cards the editor places (2 rows = 16 px). */
export const GAP_ROWS = 2;
const PHONE_MQ = '(max-width: 767px)';

const path = (scope: LayoutScope, id: string) => `devices/layouts/${scope}/${encodeURIComponent(id)}`;
export const getLayout = (scope: LayoutScope, id: string) => api<LayoutRecord>(path(scope, id));
export const putLayout = (scope: LayoutScope, id: string, variant: LayoutVariant, revision: number, layout: Layout) => put<LayoutRecord>(path(scope, id), { variant, revision, layout });
export const resetLayout = (scope: LayoutScope, id: string, variant: LayoutVariant | 'all', revision?: number) =>
  api<LayoutRecord>(`${path(scope, id)}?variant=${variant}${revision !== undefined ? `&revision=${revision}` : ''}`, { method: 'DELETE' });
export const copyLayoutToAllAreas = (id: string, revision: number) => post<{ copied_to: number; source: LayoutRecord }>(`${path('area', id)}/copy-to-all-areas`, { revision });

// ------------------------------------------------------------------------------------------------ pure geometry

export function newItem(x: number, y: number, w: number, h: number): LayoutItem {
  return { x, y, w, h, text: 'md', bg: null, border: null, title: null, icon: null, hidden: false, hidden_entities: [] };
}

/**
 * What a viewer sees of one grid when some items are not drawn (hidden, or a floor / area this viewer cannot see, or
 * one that left Home Assistant): the rows they held are packed away, so no empty band is left (review MEDIUM 2).
 * An item moves up only when something above it in its columns is gone (or moved up itself): it then sits `gap` rows
 * under the nearest drawn item above it (or at the top); the rest keep their place, columns and order. `all` packs
 * every item that way (a narrowed record, where what is gone is not even known; the compact density, with `gap` 1).
 */
export function pack(items: Record<string, LayoutItem>, keys: string[], gone: Set<string>, all: boolean, gap: number): Record<string, LayoutItem> {
  const out: Record<string, LayoutItem> = { ...items };
  const shown = keys.filter((k) => items[k] && !gone.has(k)).sort((a, b) => items[a].y - items[b].y || items[a].x - items[b].x);
  const removed = keys.filter((k) => items[k] && gone.has(k));
  const placed: string[] = [];
  for (const k of shown) {
    const it = items[k];
    const cols = (o: LayoutItem) => o.x < it.x + it.w && it.x < o.x + o.w;
    const above = placed.filter((p) => cols(items[p]) && items[p].y + items[p].h <= it.y);
    const affected = all || removed.some((r) => cols(items[r]) && items[r].y < it.y) || above.some((p) => out[p].y !== items[p].y);
    let y = it.y;
    if (affected) y = Math.max(0, ...above.map((p) => out[p].y + out[p].h + Math.min(gap, Math.max(0, it.y - items[p].y - items[p].h))));
    for (let guard = 0; guard < 500; guard++) {
      const hit = placed.find((p) => cols(out[p]) && y < out[p].y + out[p].h && out[p].y < y + it.h);
      if (!hit) break;
      y = out[hit].y + out[hit].h + gap;
    }
    out[k] = { ...it, y };
    placed.push(k);
  }
  return out;
}

function overlap(a: LayoutItem, b: LayoutItem): boolean {
  return a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h;
}

/** `fixed` stays where it is; every peer it (or a peer pushed by it) now covers moves down below it, keeping the
 * 16 px gap. Peers are the keys of the same grid; everything else is left alone. */
export function resolveCollisions(items: Record<string, LayoutItem>, fixed: string, peers: string[]): Record<string, LayoutItem> {
  const out: Record<string, LayoutItem> = { ...items };
  const placed = [fixed];
  const rest = peers.filter((k) => k !== fixed && out[k]).sort((a, b) => out[a].y - out[b].y || out[a].x - out[b].x);
  for (const k of rest) {
    let it = out[k];
    for (let guard = 0; guard < 500; guard++) {
      const hit = placed.find((p) => overlap(it, out[p]));
      if (!hit) break;
      it = { ...it, y: out[hit].y + out[hit].h + GAP_ROWS };
    }
    out[k] = it;
    placed.push(k);
  }
  return out;
}

/** Every item of every grid in reading order (top to bottom, start to end). */
function readingOrder(items: Record<string, LayoutItem>, keys: string[]): string[] {
  return keys.filter((k) => items[k]).sort((a, b) => items[a].y - items[b].y || items[a].x - items[b].x);
}

/** Slice 6c: the phone rule for a card's tiles - the desktop order, one column (every tile the card's full width). */
function phoneTiles(key: string, d: LayoutItem): Partial<LayoutItem> {
  if (!d.tiles || !Object.keys(d.tiles).length) return {};
  const cols = TILE_COLS[key.slice(key.indexOf(':') + 1)] ?? 1;
  return { tiles: Object.fromEntries(Object.entries(d.tiles).map(([id, t]) => [id, { ...t, span: cols }])) };
}

/**
 * Slice 6c: a card's tiles in their arranged order - the arranged ones by `order`, then any device the arrangement
 * does not know yet (added in Home Assistant since) in the screen's own order, with the card's default span. `ids` are
 * the devices the card has now (a stored tile of a device gone from the card is left out). Hidden = the tile's own flag
 * or the card's hidden_entities (one set).
 */
export function orderedTiles(it: LayoutItem | null | undefined, ids: string[], span: number): TileEntry[] {
  const stored = it?.tiles ?? {};
  const hide = new Set(it?.hidden_entities ?? []);
  const known = ids.filter((id) => stored[id]).sort((a, b) => stored[a].order - stored[b].order);
  const fresh = ids.filter((id) => !stored[id]);
  return [...known, ...fresh].map((id, i) => {
    const s = stored[id];
    return { id, t: s ? { ...s, order: i, hidden: s.hidden || hide.has(id) } : { order: i, span, size: 'm', hidden: hide.has(id), title: null } };
  });
}

/** Whether a card item carries a tile arrangement. */
export function arranged(it: LayoutItem | null | undefined): boolean {
  return !!it?.tiles && Object.keys(it.tiles).length > 0;
}

/** The automatic phone layout: one column, in the desktop's reading order, each grid on its own. */
export function derivePhone(desktop: Layout, grids: string[][]): Layout {
  const items: Record<string, LayoutItem> = {};
  const seen = new Set<string>();
  const prefix = (k: string) => k.slice(0, k.indexOf(':') + 1);
  /** Per key prefix: the first free row under what was stacked so far. */
  const next = new Map<string, number>();
  for (const keys of grids) {
    let y = 0;
    for (const k of readingOrder(desktop.items, keys)) {
      const d = desktop.items[k];
      items[k] = { ...d, x: 0, w: COLS.phone, y, ...phoneTiles(k, d) };
      y += d.h + GAP_ROWS;
      seen.add(k);
    }
    for (const k of keys) next.set(prefix(k), Math.max(next.get(prefix(k)) ?? 0, y));
  }
  // keys this screen does not draw now - another view's grid, or (owner feedback 2026-09-29) a domain card whose area
  // has nothing of it: one column too, in reading order, stacked under what is drawn, so a saved phone layout never has
  // two items in one place (the server refuses overlaps) and each comes back in order when it shows
  for (const k of readingOrder(desktop.items, Object.keys(desktop.items).filter((x) => !seen.has(x)))) {
    const d = desktop.items[k];
    const y = next.get(prefix(k)) ?? 0;
    items[k] = { ...d, x: 0, w: COLS.phone, y, ...phoneTiles(k, d) };
    next.set(prefix(k), y + d.h + GAP_ROWS);
  }
  return { v: desktop.v, cols: COLS.phone, items };
}

/** One grid as the screen draws it now, measured into grid units (the editor starts from what it sees). */
export interface MeasuredGrid {
  el: HTMLElement;
  items: { key: string; el: HTMLElement }[];
}

export function deriveFromDom(grid: MeasuredGrid, cols: number): Record<string, LayoutItem> {
  const g = grid.el.getBoundingClientRect();
  const cs = getComputedStyle(grid.el);
  const rtl = cs.direction === 'rtl';
  const tracks = Math.max(1, cs.gridTemplateColumns.split(/\s+/).filter((t) => /px$/.test(t)).length);
  const gap = parseFloat(cs.columnGap) || 0;
  const step = (g.width + gap) / tracks;
  const out: Record<string, LayoutItem> = {};
  const keys: string[] = [];
  for (const { key, el } of grid.items) {
    const r = el.getBoundingClientRect();
    if (!r.width && !r.height) continue;
    const start = rtl ? g.right - r.right : r.left - g.left;
    const col = Math.max(0, Math.round(start / step));
    const span = Math.max(1, Math.round((r.width + gap) / step));
    let x = Math.round((col * cols) / tracks);
    let w = Math.max(1, Math.round((span * cols) / tracks));
    if (w > cols) w = cols;
    if (x + w > cols) x = cols - w;
    out[key] = newItem(x, Math.max(0, Math.round((r.top - g.top) / ROW_PX)), w, Math.max(2, Math.ceil(r.height / ROW_PX)));
    keys.push(key);
  }
  // rounding may make two neighbours touch or overlap: settle them in reading order
  let settled = out;
  for (const k of readingOrder(out, keys)) settled = resolveCollisions(settled, k, readingOrder(settled, keys).filter((o) => settled[o].y >= settled[k].y));
  return settled;
}

/** Items the screen shows that the layout does not know yet (an area added in Home Assistant since): appended below
 * the grid's own items - three per row on a desktop, one on a phone. */
export function complete(layout: Layout, grids: string[][], defaultH: (key: string) => number): Layout {
  const items = { ...layout.items };
  const per = layout.cols === COLS.desktop ? 3 : 1;
  const w = Math.floor(layout.cols / per);
  for (const keys of grids) {
    const missing = keys.filter((k) => !items[k]);
    if (!missing.length || missing.length === keys.length) continue; // a grid the layout never touched stays automatic
    let y = Math.max(0, ...keys.filter((k) => items[k]).map((k) => items[k].y + items[k].h)) + GAP_ROWS;
    missing.forEach((k, i) => {
      const col = i % per;
      if (i && col === 0) y += Math.max(...missing.slice(i - per, i).map((m) => defaultH(m))) + GAP_ROWS;
      items[k] = newItem(col * w, y, w, defaultH(k));
    });
  }
  return { ...layout, items };
}

function clone(l: Layout): Layout {
  return JSON.parse(JSON.stringify(l)) as Layout;
}

function clamp(n: number, lo: number, hi: number): number {
  return Math.min(hi, Math.max(lo, n));
}

// ------------------------------------------------------------------------------------------------ the controller

export interface LayoutGrid {
  /** A stable id of this grid on the screen (e.g. "fcards", "areas:<floor>"). */
  id: string;
  /** The items it shows, in the screen's own order. */
  keys: string[];
}

export interface LayoutOptions {
  scope: LayoutScope;
  /** The record's id: "main" for the building, the area id on the area screen. */
  id: () => string;
  /** What the edit bar calls this screen ("מסך המבנה", "מסך האזור › לובי"). */
  screenName: () => string;
  /** The rendered grids, for the editor's first measurement. */
  measure: () => MeasuredGrid[];
  /** The height (in rows) of an item appended to a layout that does not know it yet. */
  defaultH: (key: string) => number;
  /** The screen's label of an item (the chip on it and the panel's heading). */
  label: (key: string) => string;
  /** Called when the editor opens (the building screen shows every floor). */
  onEnter?: () => void;
  /** The screen's compact density: a viewer's layout packs its gaps to one row (8 px). */
  compact?: () => boolean;
  /** Area cards: the entities a card can show, in the order the card draws them automatically - the panel's "visible
   * entities" checklist and (6c) the card's tiles. */
  entities?: (key: string) => { id: string; name: string; group?: string }[];
  /** Area screen, card library (layout v 3): every device of the area (all the built-in cards' devices), for the device
   * picker of a custom card, the library's starting selections and the "unplaced" count. */
  pool?: () => AreaEntity[];
  /** Slice 6c: a card's automatic tile span (a two-up tile card: 1; a card of full-width rows: its TILE_COLS). */
  tileSpan?: (key: string) => number;
  /** The screen's own edits that live next to the layout in one edit session (the home screen's title, widgets and floor
   * order, owner notes 2026-09-30): they count for "unsaved", are saved with "שמור" (before the layout) and are dropped
   * with the session. Without them, saving with nothing changed still stores the measured layout, as before. */
  extras?: {
    dirty: () => boolean;
    /** Persists the edits; rejects (with a readable message) when the server refuses. */
    save: () => Promise<void>;
    /** The session ended without saving. */
    discard: () => void;
  };
}

interface TileDrag {
  key: string;
  id: string;
  pointerId: number;
  x0: number;
  y0: number;
  started: boolean;
}

interface Drag {
  key: string;
  mode: 'move' | 'resize';
  pointerId: number;
  x0: number;
  y0: number;
  item0: LayoutItem;
  snapshot: Record<string, LayoutItem>;
  step: number;
  rtl: boolean;
  moved: boolean;
  started: boolean;
}

export class DevicesLayoutController implements ReactiveController {
  record: LayoutRecord | null = null;
  /** The first read of the record has answered (a record, or none): the editor may start from what is stored. */
  loaded = false;
  editing = false;
  variant: LayoutVariant = 'desktop';
  selected: string | null = null;
  busy = false;
  error = '';
  conflict = false;
  note = '';
  confirm: 'reset' | 'copy' | null = null;
  live = '';
  /** Card library (owner request 2026-09-30): the device picker's search, the library dialog, and the last deleted card
   * (an undo toast in the bar, until the next change of the card set, a save or a cancel). */
  entFilter = '';
  libOpen = false;
  libAll = false;
  undo: { label: string; snapshot: Record<string, LayoutItem> } | null = null;
  /** Slice 6c: the card whose device tiles are being arranged ("סידור התקנים"), and its selected tile. */
  tileCard: string | null = null;
  tileSel: string | null = null;
  private tdrag: TileDrag | null = null;
  private draft: Layout | null = null;
  private base = '';
  private phone = false;
  private mq: MediaQueryList | null = null;
  private loadedId = '';
  private view: Layout | null = null;
  private grids: LayoutGrid[] = [];
  private activeGrids = new Set<string>();
  private gridOf = new Map<string, string>();
  private drag: Drag | null = null;
  private pressTimer = 0;

  constructor(
    private host: LitElement,
    private opts: LayoutOptions,
  ) {
    host.addController(this);
  }

  /** UI round 1c: the area screen's layout editor is entered from the user menu (shell/screen-edit.ts), not from a button in
   * the page; the home screen's editor keeps its own `?edit=1` address (devices-building.ts). */
  private offScreenEdit: (() => void) | null = null;

  hostConnected() {
    if (this.opts.scope === 'area') {
      this.offScreenEdit = registerScreenEdit({ id: 'devices-layout', label: 'עריכת פריסה', icon: 'edit', can: () => this.canEdit && !this.editing, run: () => void this.enter() });
    }
    try {
      this.mq = window.matchMedia(PHONE_MQ);
      this.phone = this.mq.matches;
      this.mq.addEventListener('change', this.onMq);
    } catch {
      this.mq = null;
    }
    void this.load();
  }

  /** Review MEDIUM 3: while the layout is edited the cards' own controls are `inert` (no Tab, no keys, no pointer, out of
   * the accessibility tree) - a key on a slider must never switch a real device. Set after every render. */
  hostUpdated() {
    const root = this.host.renderRoot as ParentNode;
    for (const el of root.querySelectorAll<HTMLElement>('[data-lay-inert]')) {
      const parent = el.parentElement?.classList;
      if (parent?.contains('lay-edit') || parent?.contains('lay-tedit')) continue;
      el.inert = false;
      el.removeAttribute('aria-hidden');
      el.removeAttribute('data-lay-inert');
    }
    if (!this.editing) return;
    // 6c: the same for the device tiles while their card is arranged (a key on a tile's slider never reaches a device)
    for (const item of root.querySelectorAll<HTMLElement>('.lay-item.lay-edit, .lay-tile.lay-tedit')) {
      const body = item.firstElementChild as HTMLElement | null;
      if (!body || body.classList.contains('lay-hd') || body.classList.contains('lay-thd') || body.hasAttribute('data-lay-inert')) continue;
      body.inert = true;
      body.setAttribute('aria-hidden', 'true');
      body.setAttribute('data-lay-inert', '');
    }
  }

  hostDisconnected() {
    this.offScreenEdit?.();
    this.offScreenEdit = null;
    this.mq?.removeEventListener('change', this.onMq);
    window.clearTimeout(this.pressTimer);
    this.endTileDrag();
    this.host.removeAttribute('data-lay-editing');
  }

  private onMq = () => {
    this.phone = this.mq?.matches ?? false;
    this.host.requestUpdate();
  };

  private update() {
    this.host.requestUpdate();
  }

  /** The screen's id changed (another area): a fresh record, the editor closed. */
  async load(force = false) {
    const id = this.opts.id();
    if (!isApi() || !id) return;
    if (!force && id === this.loadedId && this.record) return;
    if (id !== this.loadedId) this.close();
    this.loadedId = id;
    try {
      const r = await getLayout(this.opts.scope, id);
      if (this.opts.id() !== id) return;
      this.record = r;
    } catch {
      this.record = null; // no layout (or no permission to read one): the automatic layout
    }
    this.loaded = true;
    this.update();
  }

  /** The session's own permission (installation scope), never a flag from the reply. */
  get canEdit(): boolean {
    return isApi() && can('system.configure');
  }

  /** The layout itself was changed in this session. */
  private get layoutDirty(): boolean {
    return this.editing && !!this.draft && JSON.stringify(this.draft) !== this.base;
  }

  /** Anything of this session is unsaved: the layout, or the screen's own edits (`extras`). */
  get dirty(): boolean {
    return this.layoutDirty || (this.editing && !!this.opts.extras?.dirty());
  }

  private viewVariant(): LayoutVariant {
    return this.editing ? this.variant : this.phone ? 'phone' : 'desktop';
  }

  private stored(v: LayoutVariant): Layout | null {
    return this.record?.[v]?.layout ?? null;
  }

  private gridKeys(): string[][] {
    return this.grids.map((g) => g.keys);
  }

  /** What a viewer sees for a variant: the stored layout, or (phone) the one derived from the desktop layout. */
  private viewerLayout(v: LayoutVariant): Layout | null {
    if (v === 'desktop') return this.stored('desktop');
    const phone = this.stored('phone');
    if (phone) return this.dropStale(phone);
    const desk = this.stored('desktop');
    return desk ? derivePhone(desk, this.gridKeys()) : null;
  }

  /** What the editor calls an item: the screen's label, or a custom card's own name. */
  labelOf(key: string): string {
    return key.startsWith('card:c-') ? this.customTitle(key) : this.opts.label(key);
  }

  /** The title of a custom card as the editor names it (its own, else its type's). */
  customTitle(key: string): string {
    const it = this.desktopLayout()?.items[key] ?? this.draft?.items[key];
    return it?.title ?? (it?.custom ? (CARD_TYPES[it.custom.type as keyof typeof CARD_TYPES]?.label ?? 'כרטיס') : 'כרטיס');
  }

  // -------------------------------------------------------------------------------------------- card library (v 3)

  /** The desktop layout the card set lives in (custom and deleted cards are defined once, there; the phone layout only
   * places them): the draft while the desktop is edited, else the stored one. */
  private desktopLayout(): Layout | null {
    return this.editing && this.variant === 'desktop' ? this.draft : this.stored('desktop');
  }

  /** The custom cards' keys in reading order of the desktop layout. */
  customKeys(): string[] {
    const items = this.desktopLayout()?.items ?? {};
    const keys = Object.keys(items).filter((k) => !!items[k].custom);
    return keys.sort((a, b) => items[a].y - items[b].y || items[a].x - items[b].x);
  }

  customOf(key: string): { type: string; entities: string[] } | undefined {
    return this.desktopLayout()?.items[key]?.custom;
  }

  /** A built-in card the editor deleted (desktop layout). */
  isRemoved(key: string): boolean {
    return !!this.desktopLayout()?.items[key]?.removed;
  }

  removedKeys(): string[] {
    const items = this.desktopLayout()?.items ?? {};
    return Object.keys(items).filter((k) => items[k].removed);
  }

  /** A saved phone layout may still hold a custom card that was deleted on the desktop: it is not part of the screen. */
  private dropStale(layout: Layout): Layout {
    const stale = Object.keys(layout.items).filter((k) => k.startsWith('card:c-') && !this.customOf(k));
    if (!stale.length) return layout;
    const items = { ...layout.items };
    for (const k of stale) delete items[k];
    return { ...layout, items };
  }

  /** Every variant carries the same card set: each custom card with its definition, each deleted card flagged, a card
   * that no longer exists dropped (the desktop layout is the source; the phone layout only places them). */
  private withCards(layout: Layout, source: Layout | null): Layout {
    const src = source?.items ?? {};
    const items: Record<string, LayoutItem> = {};
    for (const [k, it] of Object.entries(layout.items)) {
      if (k.startsWith('card:c-')) {
        if (!src[k]?.custom) continue;
        items[k] = { ...it, custom: src[k].custom, removed: undefined };
      } else if (src[k]?.removed) items[k] = { ...it, removed: true };
      else items[k] = { ...it, removed: undefined, custom: undefined };
    }
    // a device-less draft item may hold `undefined` keys: JSON drops them, the comparison against the base must too
    return JSON.parse(JSON.stringify({ ...layout, items })) as Layout;
  }

  /** The area's devices that no card shows now: their built-in card is deleted or hides them, and no custom card lists
   * them. A deleted card's devices are "unplaced", never gone from the platform. */
  unplaced(pool: AreaEntity[] = this.opts.pool?.() ?? []): AreaEntity[] {
    const items = this.desktopLayout()?.items ?? {};
    const inCustom = new Set<string>();
    for (const it of Object.values(items)) {
      if (!it.custom) continue;
      const hide = new Set(it.hidden_entities ?? []);
      for (const id of it.custom.entities) if (!hide.has(id)) inCustom.add(id);
    }
    return pool.filter((e) => {
      const b = items[`card:${e.card}`];
      const shownBuiltin = !b?.removed && !(b?.hidden_entities ?? []).includes(e.id) && !b?.hidden;
      return !shownBuiltin && !inCustom.has(e.id);
    });
  }

  /** "מחק כרטיס": a custom card is dropped, a built-in one flagged; the rows under it move up. Nothing leaves the
   * platform - the devices join the unplaced pool. An undo toast in the bar brings the card back. */
  removeCard(key: string) {
    if (!this.draft || this.variant !== 'desktop' || this.opts.scope !== 'area') return;
    const it = this.draft.items[key];
    if (!it) return;
    const label = this.labelOf(key);
    const keys = Object.keys(this.draft.items).filter((k) => !this.draft!.items[k].removed);
    const packed = pack(this.draft.items, keys, new Set([key]), false, GAP_ROWS);
    const items = { ...packed };
    if (key.startsWith('card:c-')) delete items[key];
    else items[key] = { ...packed[key], removed: true };
    this.undo = { label, snapshot: this.draft.items };
    this.draft = { ...this.draft, items };
    this.selected = null;
    if (this.tileCard === key) this.leaveTiles();
    this.live = `הכרטיס "${label}" נמחק. ההתקנים שבו חזרו למאגר ההתקנים הלא ממוקמים.`;
    this.update();
  }

  undoRemove() {
    if (!this.undo || !this.draft) return;
    this.draft = { ...this.draft, items: this.undo.snapshot };
    this.live = `הכרטיס "${this.undo.label}" חזר.`;
    this.undo = null;
    this.update();
  }

  /** "הוסף כרטיס": a card of a library type, named, with its starting devices, placed in the first free slot. */
  addCard(typeId: string) {
    if (!this.draft || this.variant !== 'desktop' || this.opts.scope !== 'area' || !isCardType(typeId)) return;
    const info = CARD_TYPES[typeId];
    const pool = this.opts.pool?.() ?? [];
    const entities = (typeId === 'free' ? this.unplaced(pool) : pool.filter(info.match)).map((e) => e.id);
    const key = newCardKey(Object.keys(this.draft.items));
    const titles = [...Object.entries(this.draft.items)].filter(([, it]) => !it.removed).map(([k, it]) => it.title ?? this.labelOf(k));
    const w = Math.floor(this.draft.cols / 2);
    const h = 30;
    const { x, y } = findSlot(this.draft.items, this.draft.cols, w, h, GAP_ROWS);
    const item: LayoutItem = { ...newItem(x, y, w, h), title: nextTitle(info.label, titles), icon: (LAYOUT_ICONS as readonly string[]).includes(info.icon) ? (info.icon as LayoutIcon) : null, custom: { type: typeId, entities } };
    this.draft = { ...this.draft, items: { ...this.draft.items, [key]: item } };
    this.undo = null;
    this.libOpen = false;
    this.selected = key;
    this.entFilter = '';
    this.live = `נוסף כרטיס "${item.title}" עם ${entities.length} התקנים.`;
    this.update();
  }

  /** Called at the top of the screen's render with the grids it is about to draw. */
  prepare(grids: LayoutGrid[]) {
    this.grids = grids;
    this.gridOf = new Map(grids.flatMap((g) => g.keys.map((k) => [k, g.id] as [string, string])));
    // 6c review: the card being arranged lost its last device (a structure refresh): back to the cards, and say why
    // (its arrangement stays in the draft - the card returns with it when the domain does)
    if (this.tileCard && !this.gridOf.has(this.tileCard)) {
      const label = this.labelOf(this.tileCard);
      this.endTileDrag();
      this.tileCard = null;
      this.tileSel = null;
      this.note = `בכרטיס "${label}" כבר אין התקנים, ולכן חזרנו לכל הכרטיסים.`;
      this.live = this.note;
    }
    const layout = this.editing ? this.draft : this.viewerLayout(this.viewVariant());
    this.activeGrids = new Set(this.editing ? grids.map((g) => g.id) : grids.filter((g) => layout && g.keys.some((k) => layout.items[k])).map((g) => g.id));
    this.view = layout ? complete(layout, grids.map((g) => g.keys), this.opts.defaultH) : null;
    if (this.view && !this.editing) this.view = { ...this.view, items: this.packed(this.view.items, grids) };
  }

  /** A viewer's layout without the rows of what is not drawn (hidden items, what the viewer cannot see, what left
   * Home Assistant), and with one-row gaps in the compact density. The editor always sees the stored positions. */
  private packed(items: Record<string, LayoutItem>, grids: LayoutGrid[]): Record<string, LayoutItem> {
    const drawn = new Set(grids.flatMap((g) => g.keys));
    const prefix = (k: string) => k.slice(0, k.indexOf(':') + 1);
    const strayPrefixes = new Set(Object.keys(items).filter((k) => !drawn.has(k)).map(prefix));
    const compact = this.opts.compact?.() ?? false;
    let out = items;
    for (const g of grids) {
      if (!this.activeGrids.has(g.id)) continue;
      const gone = new Set(g.keys.filter((k) => out[k]?.hidden || this.isRemoved(k)));
      const all = compact || !!this.record?.narrowed || g.keys.some((k) => strayPrefixes.has(prefix(k)));
      if (!gone.size && !all) continue;
      out = pack(out, g.keys, gone, all, compact ? 1 : GAP_ROWS);
    }
    return out;
  }

  /** Whether this grid is laid out (else the screen's automatic grid). */
  gridOn(id: string): boolean {
    return !!this.view && this.activeGrids.has(id);
  }

  get cols(): number {
    return this.view?.cols ?? COLS.desktop;
  }

  /** Attributes for a grid element: `class=${ctl.gridOn(id) ? 'lay-grid' : ''}` plus these. */
  gridCols(id: string): string | typeof nothing {
    return this.gridOn(id) ? String(this.cols) : nothing;
  }

  phonePreview(id: string): boolean {
    return this.gridOn(id) && this.editing && this.variant === 'phone' && !this.phone;
  }

  /** The item's stored settings (title, icon ...) when its grid is laid out. */
  item(key: string): LayoutItem | null {
    const g = this.gridOf.get(key);
    if (!g || !this.gridOn(g)) return null;
    return this.view?.items[key] ?? null;
  }

  /** One item: as it always was (no layout), hidden (for a viewer), or placed in grid units with its chrome. */
  wrap(key: string, content: TemplateResult | typeof nothing): TemplateResult | typeof nothing {
    const it = this.item(key);
    if (!it) return content;
    if (this.isRemoved(key)) return nothing; // a deleted built-in card (v 3) is not drawn, in the editor either
    if (it.hidden && !this.editing) return nothing;
    const style = { gridColumn: `${it.x + 1} / span ${it.w}`, gridRow: `${it.y + 1} / span ${it.h}` };
    const attrs = {
      bg: it.bg ?? nothing,
      border: it.border ?? nothing,
      text: it.text !== 'md' ? it.text : nothing,
    };
    if (!this.editing) {
      return html`<div class="lay-item" data-lay-key=${key} data-lay-bg=${attrs.bg} data-lay-border=${attrs.border} data-lay-text=${attrs.text} style=${styleMap(style)}>${content}</div>`;
    }
    const sel = this.selected === key;
    const label = this.labelOf(key);
    const pos = `${label}: ${it.w} × ${it.h} · עמודה ${it.x + 1}, שורה ${it.y + 1}${it.hidden ? ' · מוסתר' : ''}`;
    return html`<div
      class=${classMap({ 'lay-item': true, 'lay-edit': true, 'lay-sel': sel, 'lay-hidden': it.hidden, 'lay-drag': this.drag?.key === key && this.drag.started })}
      data-lay-key=${key}
      data-lay-bg=${attrs.bg}
      data-lay-border=${attrs.border}
      data-lay-text=${attrs.text}
      data-lay-pos=${`${it.x},${it.y},${it.w},${it.h}`}
      style=${styleMap(style)}
      tabindex="0"
      role="button"
      aria-pressed=${String(sel)}
      aria-label=${pos}
      @pointerdown=${(e: PointerEvent) => this.onDown(e, key)}
      @pointermove=${(e: PointerEvent) => this.onMove(e)}
      @pointerup=${(e: PointerEvent) => this.onUp(e)}
      @pointercancel=${(e: PointerEvent) => this.onUp(e, true)}
      @keydown=${(e: KeyboardEvent) => this.onKey(e, key)}
      @focus=${() => this.select(key, false)}
    >${content}<span class="lay-hd" data-lay-handle aria-hidden="true"><sw-icon name="move" size=${11}></sw-icon>${label} · ${it.w} × ${it.h}${it.hidden ? ' · מוסתר' : ''}</span><span class="lay-rz" data-lay-resize aria-hidden="true"></span>${this.canArrange(key)
      ? html`<button type="button" class="lay-tbtn" data-lay-tiles-enter=${key} aria-label=${`סידור התקנים: ${label}`} @click=${(e: Event) => { e.stopPropagation(); this.enterTiles(key); }}><sw-icon name="grid" size=${12}></sw-icon>סידור התקנים${arranged(it) ? ' ✓' : ''}</button>`
      : nothing}</div>`;
  }

  // -------------------------------------------------------------------------------------------- 6c: device tiles

  /** An area card with devices can have its tiles arranged. */
  private canArrange(key: string): boolean {
    return this.opts.scope === 'area' && (this.opts.entities?.(key).length ?? 0) > 0;
  }

  /** The card whose tiles are being arranged (in edit mode). */
  arranging(key: string): boolean {
    return this.editing && this.tileCard === key;
  }

  private tileIds(key: string): string[] {
    return (this.opts.entities?.(key) ?? []).map((e) => e.id);
  }

  private tileSpan(key: string): number {
    return this.opts.tileSpan?.(key) ?? 1;
  }

  private tileCols(key: string): number {
    const c = this.customOf(key); // a custom card's columns follow its type (the free card, locks and energy: two)
    if (c) return TILE_COLS[c.type] ?? 2;
    return TILE_COLS[key.slice(key.indexOf(':') + 1)] ?? 1;
  }

  private tileName(key: string, id: string): string {
    return this.opts.entities?.(key).find((e) => e.id === id)?.name ?? id;
  }

  private spanHe(key: string, span: number): string {
    const cols = this.tileCols(key);
    return span >= cols ? 'רוחב מלא' : cols === 2 ? 'חצי רוחב' : `${span} מתוך ${cols} עמודות`;
  }

  /** The draft's tiles of a card, in order (the editor's working list). */
  private tileList(key: string): TileEntry[] {
    return orderedTiles(this.draft?.items[key], this.tileIds(key), this.tileSpan(key));
  }

  /**
   * What a card draws: null = its automatic tiles (no arrangement, and not being arranged); else its tiles in order -
   * a viewer's without the hidden ones, the arranging editor's with them (dimmed, so they can come back). `ids` are the
   * card's devices in its automatic order.
   */
  tiles(key: string, ids: string[]): TileEntry[] | null {
    const it = this.item(key);
    const editing = this.arranging(key);
    if (!editing && !arranged(it)) return null;
    const list = orderedTiles(it, ids, this.tileSpan(key));
    return editing ? list : list.filter((x) => !x.t.hidden);
  }

  /** The arranging editor draws its card alone, full width, with the card's own colours and text size. */
  stage(key: string, content: TemplateResult): TemplateResult {
    const it = this.item(key);
    return html`<div class="lay-stage" data-lay-stage=${key} ?data-lay-phone-preview=${this.variant === 'phone' && !this.phone}>
      <div class="lay-item" data-lay-key=${key} data-lay-bg=${it?.bg ?? nothing} data-lay-border=${it?.border ?? nothing} data-lay-text=${it && it.text !== 'md' ? it.text : nothing}>${content}</div>
    </div>`;
  }

  /** One device tile: its span and size (a viewer), plus the arranging chrome (the editor). */
  wrapTile(key: string, x: TileEntry, index: number, count: number, content: TemplateResult): TemplateResult {
    const t = x.t;
    const style = { gridColumn: `span ${Math.min(t.span, this.tileCols(key))}` };
    const size = t.size !== 'm' ? t.size : nothing;
    if (!this.arranging(key)) {
      return html`<div class="lay-tile" data-lay-tile=${x.id} data-tile-size=${size} data-tile-span=${t.span} style=${styleMap(style)}>${content}</div>`;
    }
    const sel = this.tileSel === x.id;
    const name = t.title ?? this.tileName(key, x.id);
    const label = `${name}: מקום ${index + 1} מתוך ${count} · ${this.spanHe(key, t.span)} · גודל ${SIZE_HE[t.size]}${t.hidden ? ' · מוסתר' : ''}`;
    return html`<div
      class=${classMap({ 'lay-tile': true, 'lay-tedit': true, 'lay-tsel': sel, 'lay-hidden': t.hidden, 'lay-drag': this.tdrag?.id === x.id && this.tdrag.started })}
      data-lay-tile=${x.id}
      data-tile-size=${size}
      data-tile-span=${t.span}
      data-lay-tpos=${`${index},${t.span},${t.size}`}
      style=${styleMap(style)}
      tabindex="0"
      role="button"
      aria-pressed=${String(sel)}
      aria-label=${label}
      @pointerdown=${(e: PointerEvent) => this.onTDown(e, key, x.id)}
      @keydown=${(e: KeyboardEvent) => this.onTKey(e, key, x.id)}
      @focus=${() => this.selectTile(x.id, false)}
    >${content}<span class="lay-thd" data-lay-thandle aria-hidden="true"><sw-icon name="move" size=${10}></sw-icon>${index + 1}${t.hidden ? ' · מוסתר' : ''}${t.span >= this.tileCols(key) && this.tileCols(key) > 1 ? ' · רוחב מלא' : ''}</span></div>`;
  }

  /** "סידור התקנים": this card alone, its tiles editable. */
  enterTiles(key: string) {
    if (!this.editing || !this.draft?.items[key] || !this.canArrange(key)) return;
    this.tileCard = key;
    this.tileSel = null;
    this.selected = key;
    this.live = `סידור התקנים: ${this.labelOf(key)}`;
    this.update();
  }

  /** Back to the cards (the arrangement stays in the draft until "שמור" / "בטל"). */
  leaveTiles() {
    const key = this.tileCard;
    this.endTileDrag();
    this.tileCard = null;
    this.tileSel = null;
    this.update();
    if (key) void this.host.updateComplete.then(() => (this.host.renderRoot as ParentNode).querySelector<HTMLElement>(`.lay-item.lay-edit[data-lay-key="${CSS.escape(key)}"]`)?.focus({ preventScroll: false }));
  }

  private selectTile(id: string | null, announce = true) {
    if (this.tileSel === id) return;
    this.tileSel = id;
    if (announce && id && this.tileCard) this.announceTile(this.tileCard, id);
    this.update();
  }

  private announceTile(key: string, id: string) {
    const list = this.tileList(key);
    const i = list.findIndex((x) => x.id === id);
    if (i < 0) return;
    const t = list[i].t;
    this.live = `${t.title ?? this.tileName(key, id)}: מקום ${i + 1} מתוך ${list.length}, ${this.spanHe(key, t.span)}, גודל ${SIZE_HE[t.size]}${t.hidden ? ', מוסתר' : ''}`;
  }

  /** Rewrites a card's arrangement from its working list: orders 0..n-1, spans inside the card, and the hidden tiles
   * and the card's hidden_entities kept one set. */
  private editTiles(key: string, fn: (list: TileEntry[]) => TileEntry[]) {
    const it = this.draft?.items[key];
    if (!it) return;
    const cols = this.tileCols(key);
    const next = fn(this.tileList(key));
    const tiles: Record<string, TileLayout> = {};
    next.forEach(({ id, t }, i) => (tiles[id] = { ...t, order: i, span: clamp(t.span, 1, cols) }));
    const hide = new Set(it.hidden_entities ?? []);
    for (const { id, t } of next) {
      if (t.hidden) hide.add(id);
      else hide.delete(id);
    }
    this.patch(key, { tiles, hidden_entities: [...hide].sort() });
  }

  patchTile(key: string, id: string, change: Partial<TileLayout>) {
    this.editTiles(key, (list) => list.map((x) => (x.id === id ? { id, t: { ...x.t, ...change } } : x)));
    this.announceTile(key, id);
  }

  moveTile(key: string, id: string, to: number) {
    this.editTiles(key, (list) => {
      const from = list.findIndex((x) => x.id === id);
      const dest = clamp(to, 0, list.length - 1);
      if (from < 0 || dest === from) return list;
      const out = [...list];
      const [moved] = out.splice(from, 1);
      out.splice(dest, 0, moved);
      return out;
    });
    this.announceTile(key, id);
  }

  /** "אפס סידור": the card's automatic tile order again (its hidden devices stay hidden - the card's checklist). */
  resetTiles(key: string) {
    this.patch(key, { tiles: {} });
    this.tileSel = null;
    this.live = `${this.labelOf(key)}: הסדר האוטומטי`;
    this.update();
  }

  private refocusTile(id: string) {
    void this.host.updateComplete.then(() => (this.host.renderRoot as ParentNode).querySelector<HTMLElement>(`.lay-tile.lay-tedit[data-lay-tile="${CSS.escape(id)}"]`)?.focus({ preventScroll: true }));
  }

  private onTKey(e: KeyboardEvent, key: string, id: string) {
    const list = this.tileList(key);
    const i = list.findIndex((x) => x.id === id);
    if (i < 0) return;
    const t = list[i].t;
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      this.selectTile(id);
      return;
    }
    if (e.key === 'Escape') {
      e.preventDefault();
      if (this.tileSel) this.selectTile(null);
      else this.leaveTiles();
      return;
    }
    if (e.code === 'KeyH' && !e.ctrlKey && !e.metaKey && !e.altKey) {
      // by the key's place, not its letter: "H" on a Hebrew keyboard types "י"
      e.preventDefault();
      this.tileSel = id;
      this.patchTile(key, id, { hidden: !t.hidden });
      this.refocusTile(id);
      return;
    }
    const rtl = getComputedStyle(e.currentTarget as HTMLElement).direction === 'rtl';
    // logical order: in RTL the start is on the right, so ArrowRight moves a tile earlier
    const toEnd = e.key === 'ArrowLeft' ? (rtl ? 1 : -1) : e.key === 'ArrowRight' ? (rtl ? -1 : 1) : 0;
    const down = e.key === 'ArrowDown' ? 1 : e.key === 'ArrowUp' ? -1 : 0;
    const d = toEnd || down;
    if (!d) return;
    e.preventDefault();
    this.tileSel = id;
    if (e.shiftKey) this.patchTile(key, id, { span: t.span + d });
    else this.moveTile(key, id, i + d);
    this.refocusTile(id);
  }

  private onTDown(e: PointerEvent, key: string, id: string) {
    if (e.pointerType === 'mouse' && e.button !== 0) return;
    const el = e.currentTarget as HTMLElement;
    const onHandle = !!(e.target as HTMLElement).closest('[data-lay-thandle]');
    this.endTileDrag();
    window.addEventListener('pointermove', this.onTMove);
    window.addEventListener('pointerup', this.onTUp);
    window.addEventListener('pointercancel', this.onTUp);
    if (e.pointerType === 'touch' && !onHandle) {
      // a finger on a tile scrolls the page; a long press picks the tile (then the arrows / the panel move it)
      this.pressTimer = window.setTimeout(() => {
        this.selectTile(id);
        el.focus({ preventScroll: true });
      }, 450);
      this.tdrag = { key, id, pointerId: -1, x0: e.clientX, y0: e.clientY, started: false };
      return;
    }
    e.preventDefault();
    this.tdrag = { key, id, pointerId: e.pointerId, x0: e.clientX, y0: e.clientY, started: false };
    this.selectTile(id);
    el.focus({ preventScroll: true });
  }

  /** A drag reorders live: over another tile, the dragged one takes its place (the DOM order is the tile order, so a
   * tile may be re-inserted under the pointer - the listeners are on the window, not on the tile). */
  private onTMove = (e: PointerEvent) => {
    const d = this.tdrag;
    if (!d) return;
    if (d.pointerId === -1) {
      if (Math.hypot(e.clientX - d.x0, e.clientY - d.y0) > 8) this.endTileDrag(); // a touch that moves scrolls
      return;
    }
    if (e.pointerId !== d.pointerId) return;
    if (!d.started) {
      if (Math.hypot(e.clientX - d.x0, e.clientY - d.y0) < 6) return;
      d.started = true;
      this.update();
    }
    const root = this.host.renderRoot as ParentNode;
    for (const el of root.querySelectorAll<HTMLElement>('.lay-tile.lay-tedit')) {
      const over = el.dataset.layTile;
      if (!over || over === d.id) continue;
      const r = el.getBoundingClientRect();
      if (e.clientX < r.left || e.clientX > r.right || e.clientY < r.top || e.clientY > r.bottom) continue;
      const to = this.tileList(d.key).findIndex((x) => x.id === over);
      if (to >= 0) this.moveTile(d.key, d.id, to);
      break;
    }
  };

  private onTUp = (e: PointerEvent) => {
    const d = this.tdrag;
    if (d && d.pointerId !== -1 && e.pointerId !== d.pointerId) return;
    const moved = d?.started;
    this.endTileDrag();
    if (moved && d) this.refocusTile(d.id);
    this.update();
  };

  private endTileDrag() {
    window.clearTimeout(this.pressTimer);
    this.tdrag = null;
    window.removeEventListener('pointermove', this.onTMove);
    window.removeEventListener('pointerup', this.onTUp);
    window.removeEventListener('pointercancel', this.onTUp);
  }

  // -------------------------------------------------------------------------------------------- entering / leaving

  /** "ערוך פריסה": the viewport's own variant. */
  async enter(variant: LayoutVariant = this.phone ? 'phone' : 'desktop') {
    if (!this.canEdit || this.editing) return;
    this.opts.onEnter?.();
    await this.host.updateComplete; // measure what the screen draws after onEnter (every floor on the building screen)
    this.open(variant);
  }

  private open(variant: LayoutVariant) {
    const measured = this.opts.measure();
    const keysNow = this.gridKeys();
    // the desktop layout the editor builds on: the stored one, completed with any grid it never touched as it is drawn now
    const desk: Layout = clone(this.stored('desktop') ?? { v: 1, cols: COLS.desktop, items: {} });
    for (const m of measured) {
      const keys = m.items.map((i) => i.key);
      if (!keys.some((k) => desk.items[k])) Object.assign(desk.items, deriveFromDom(m, COLS.desktop));
    }
    let layout: Layout;
    if (variant === 'desktop') layout = desk;
    else {
      layout = this.dropStale(clone(this.stored('phone') ?? derivePhone(desk, keysNow)));
      for (const m of measured) {
        const keys = m.items.map((i) => i.key);
        if (!keys.some((k) => layout.items[k])) Object.assign(layout.items, derivePhone({ v: 1, cols: 12, items: deriveFromDom(m, COLS.desktop) }, [keys]).items);
      }
    }
    this.variant = variant;
    this.draft = complete(layout, keysNow, this.opts.defaultH);
    this.base = JSON.stringify(this.draft);
    this.editing = true;
    this.selected = null;
    this.tileCard = null;
    this.tileSel = null;
    this.error = '';
    this.note = '';
    this.conflict = false;
    this.host.setAttribute('data-lay-editing', '');
    this.update();
  }

  private close() {
    this.editing = false;
    this.draft = null;
    this.selected = null;
    this.drag = null;
    this.endTileDrag();
    this.tileCard = null;
    this.tileSel = null;
    this.confirm = null;
    this.undo = null;
    this.libOpen = false;
    this.entFilter = '';
    this.host.removeAttribute('data-lay-editing');
    this.opts.extras?.discard(); // after a save the extras have already taken their saved values: discarding is then a no-op
  }

  cancel() {
    this.close();
    this.error = '';
    this.update();
  }

  switchVariant(v: LayoutVariant) {
    if (v === this.variant || this.dirty) return;
    this.open(v);
  }

  async save() {
    if (!this.draft || this.busy) return;
    this.busy = true;
    this.error = '';
    this.update();
    const rev = this.record?.[this.variant]?.revision ?? 0;
    const extras = this.opts.extras;
    try {
      // the screen's own edits first; a refusal keeps the session open with its message
      if (extras?.dirty()) await extras.save();
      // a screen with its own edits stores the layout only when the layout itself changed (a title change must not pin
      // the automatic layout); without them a save with nothing stored keeps storing the measured one, as before
      const storeLayout = !extras || this.layoutDirty;
      if (storeLayout) {
        // written in the current schema (v 2: device tiles allowed; v 3 only when a custom / deleted card is in the set);
        // a 6b record is upgraded on its next save. Every variant carries the desktop layout's card set.
        const out = this.opts.scope === 'area' ? this.withCards(this.draft, this.desktopLayout()) : this.draft;
        const cards = Object.values(out.items).some((i) => i.custom || i.removed);
        this.record = await putLayout(this.opts.scope, this.opts.id(), this.variant, rev, { ...out, v: cards ? CARDS_VERSION : LAYOUT_VERSION });
      }
      const phone = this.variant === 'phone';
      this.close();
      this.note = !storeLayout ? 'השינויים נשמרו לכל המשתמשים.' : phone ? 'פריסת הטלפון נשמרה לכל המשתמשים.' : 'הפריסה נשמרה לכל המשתמשים.';
    } catch (err) {
      this.conflict = err instanceof ApiError && err.status === 409;
      this.error = this.conflict ? 'מישהו אחר שמר את הפריסה בינתיים. טענו אותה מחדש וערכו שוב.' : describeError(err);
    } finally {
      this.busy = false;
      this.update();
    }
  }

  async reloadAfterConflict() {
    this.close();
    this.error = '';
    this.conflict = false;
    await this.load(true);
  }

  /** "אפס לברירת מחדל": both variants go; the screen is automatic again. */
  async reset() {
    this.busy = true;
    this.update();
    try {
      this.record = await resetLayout(this.opts.scope, this.opts.id(), 'all', this.record?.desktop?.revision);
      this.close();
      this.note = 'הפריסה חזרה לברירת המחדל האוטומטית.';
    } catch (err) {
      this.confirm = null;
      this.error = describeError(err);
    } finally {
      this.busy = false;
      this.update();
    }
  }

  /** "חזור לאוטומטי" (phone): the stored phone layout goes; the editor shows the derived one again. */
  async phoneAuto() {
    this.busy = true;
    this.update();
    try {
      if (this.record?.phone) this.record = await resetLayout(this.opts.scope, this.opts.id(), 'phone', this.record.phone.revision);
      const desk = this.stored('desktop');
      this.draft = desk ? complete(derivePhone(desk, this.gridKeys()), this.gridKeys(), this.opts.defaultH) : null;
      if (!this.draft) {
        this.close();
        this.note = 'פריסת הטלפון אוטומטית.';
      } else {
        this.base = JSON.stringify(this.draft);
        this.note = 'פריסת הטלפון חזרה להיות אוטומטית (לפי סדר המחשב).';
      }
    } catch (err) {
      this.error = describeError(err);
    } finally {
      this.busy = false;
      this.update();
    }
  }

  async copyToAll() {
    this.busy = true;
    this.update();
    try {
      const r = await copyLayoutToAllAreas(this.opts.id(), this.record?.desktop?.revision ?? 0);
      this.record = r.source;
      this.confirm = null;
      this.note = `הפריסה הועתקה ל־${r.copied_to} אזורים.`;
    } catch (err) {
      this.confirm = null;
      this.error = describeError(err);
    } finally {
      this.busy = false;
      this.update();
    }
  }

  // -------------------------------------------------------------------------------------------- editing one item

  private select(key: string | null, announce = true) {
    if (this.selected === key) return;
    this.selected = key;
    this.entFilter = '';
    if (announce && key) this.announce(key);
    this.update();
  }

  private announce(key: string) {
    const it = this.draft?.items[key];
    if (it) this.live = `${this.labelOf(key)}: עמודה ${it.x + 1}, שורה ${it.y + 1}, רוחב ${it.w}, גובה ${it.h}`;
  }

  private peers(key: string): string[] {
    const g = this.gridOf.get(key);
    const keys = (this.grids.find((x) => x.id === g)?.keys ?? [key]).filter((k) => !this.draft?.items[k]?.removed); // a deleted card leaves no slot
    // Owner feedback 2026-09-29: an item the screen does not draw now (a domain card whose area has nothing of it)
    // keeps its saved slot; on a one-grid screen it stays a peer, so a drawn card moved onto that slot pushes it down
    // instead of overlapping it (the server refuses overlapping items of one grid)
    if (this.grids.length !== 1 || !this.draft) return keys;
    const drawn = new Set(keys);
    return [...keys, ...Object.keys(this.draft.items).filter((k) => !drawn.has(k) && !this.draft!.items[k].removed)];
  }

  /** Changes one item; a position or size change pushes the peers it now covers down. */
  patch(key: string, change: Partial<LayoutItem>, from?: Record<string, LayoutItem>) {
    if (!this.draft) return;
    const items = from ?? this.draft.items;
    const cur = items[key];
    if (!cur) return;
    const next: LayoutItem = { ...cur, ...change };
    next.w = clamp(next.w, 1, this.draft.cols);
    next.x = clamp(next.x, 0, this.draft.cols - next.w);
    next.y = clamp(next.y, 0, 4000);
    next.h = clamp(next.h, 2, 400);
    const geometry = next.x !== cur.x || next.y !== cur.y || next.w !== cur.w || next.h !== cur.h;
    const merged = { ...items, [key]: next };
    this.draft = { ...this.draft, items: geometry ? resolveCollisions(merged, key, this.peers(key)) : merged };
    if (geometry) this.announce(key);
    this.update();
  }

  private onDown(e: PointerEvent, key: string) {
    if (e.pointerType === 'mouse' && e.button !== 0) return;
    const el = e.currentTarget as HTMLElement;
    const target = e.target as HTMLElement;
    if (target.closest('[data-lay-tiles-enter]')) return; // 6c: the card's "סידור התקנים" button is a button, not a drag
    const onResize = !!target.closest('[data-lay-resize]');
    const onHandle = onResize || !!target.closest('[data-lay-handle]');
    const it = this.draft?.items[key];
    if (!it || !this.draft) return;
    if (e.pointerType === 'touch' && !onHandle) {
      // a finger on a card scrolls the page; a long press picks the card (then the arrows move it)
      window.clearTimeout(this.pressTimer);
      const x0 = e.clientX;
      const y0 = e.clientY;
      this.pressTimer = window.setTimeout(() => {
        this.select(key);
        el.focus({ preventScroll: true });
      }, 450);
      this.drag = { key, mode: 'move', pointerId: -1, x0, y0, item0: it, snapshot: this.draft.items, step: 1, rtl: false, moved: false, started: false };
      return;
    }
    e.preventDefault();
    const grid = el.parentElement!;
    const cs = getComputedStyle(grid);
    const gap = parseFloat(cs.columnGap) || 0;
    const step = (grid.getBoundingClientRect().width + gap) / this.draft.cols;
    const item0 = onResize ? { ...it, h: Math.max(it.h, Math.round(el.getBoundingClientRect().height / ROW_PX)) } : it;
    this.drag = { key, mode: onResize ? 'resize' : 'move', pointerId: e.pointerId, x0: e.clientX, y0: e.clientY, item0, snapshot: this.draft.items, step, rtl: cs.direction === 'rtl', moved: false, started: onHandle };
    try {
      el.setPointerCapture(e.pointerId);
    } catch {
      /* the pointer is gone already */
    }
    this.select(key);
    el.focus({ preventScroll: true });
  }

  private onMove(e: PointerEvent) {
    const d = this.drag;
    if (!d) return;
    if (d.pointerId === -1) {
      // a touch waiting for its long press: moving means scrolling
      if (Math.hypot(e.clientX - d.x0, e.clientY - d.y0) > 8) {
        window.clearTimeout(this.pressTimer);
        this.drag = null;
      }
      return;
    }
    if (e.pointerId !== d.pointerId) return;
    const dx = e.clientX - d.x0;
    const dy = e.clientY - d.y0;
    if (!d.started && Math.hypot(dx, dy) < 4) return;
    d.started = true;
    const dcol = Math.round((d.rtl ? -dx : dx) / d.step);
    const drow = Math.round(dy / ROW_PX);
    const change: Partial<LayoutItem> = d.mode === 'move' ? { x: d.item0.x + dcol, y: d.item0.y + drow } : { w: d.item0.w + dcol, h: d.item0.h + drow };
    const cur = this.draft?.items[d.key];
    const want = { ...d.item0, ...change };
    if (cur && (d.mode === 'move' ? want.x !== cur.x || want.y !== cur.y : want.w !== cur.w || want.h !== cur.h)) {
      d.moved = true;
      // from the snapshot taken at the start: a card pushed aside comes back when the dragged one moves on
      this.patch(d.key, change, { ...d.snapshot, [d.key]: d.item0 });
    }
  }

  private onUp(e: PointerEvent, cancelled = false) {
    const d = this.drag;
    window.clearTimeout(this.pressTimer);
    if (!d) return;
    if (d.pointerId !== -1 && e.pointerId !== d.pointerId) return;
    if (cancelled && d.pointerId !== -1 && this.draft) this.draft = { ...this.draft, items: d.snapshot };
    this.drag = null;
    this.update();
  }

  private onKey(e: KeyboardEvent, key: string) {
    const it = this.draft?.items[key];
    if (!it || (e.target as HTMLElement).closest?.('[data-lay-tiles-enter]')) return;
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      this.select(key);
      return;
    }
    if (e.key === 'Escape') {
      this.select(null);
      return;
    }
    const rtl = getComputedStyle(e.currentTarget as HTMLElement).direction === 'rtl';
    // logical columns: in RTL the start edge is on the right, so ArrowRight moves toward the start
    const toEnd = e.key === 'ArrowLeft' ? (rtl ? 1 : -1) : e.key === 'ArrowRight' ? (rtl ? -1 : 1) : 0;
    const down = e.key === 'ArrowDown' ? 1 : e.key === 'ArrowUp' ? -1 : 0;
    if (!toEnd && !down) return;
    e.preventDefault();
    this.selected = key;
    if (e.shiftKey) this.patch(key, { w: it.w + toEnd, h: it.h + down });
    else this.patch(key, { x: it.x + toEnd, y: it.y + down });
  }

  // -------------------------------------------------------------------------------------------- rendering the chrome

  /** The edit bar at the top of the screen, and the confirmations; the saved / reset note otherwise. */
  renderBar(): TemplateResult | typeof nothing {
    if (!this.editing) {
      if (!this.note && !this.error) return nothing;
      return html`<div class=${classMap({ 'lay-msg': true, err: !!this.error })} role="status" data-layout-note>${this.error || this.note}</div>`;
    }
    const stored = this.record?.[this.variant] ?? null;
    const dirty = this.dirty;
    const areaScope = this.opts.scope === 'area';
    return html`<div class="lay-bar" data-layout-bar ?data-tiles=${!!this.tileCard} role="toolbar" aria-label="עריכת פריסה">
        <span class="what"><sw-icon name="edit" size=${15}></sw-icon>מצב עריכה</span>
        <span class="where">${this.opts.screenName()} · ${this.variant === 'phone' ? 'פריסת טלפון' : 'פריסת מחשב'}${this.variant === 'phone' && !this.record?.phone ? ' (אוטומטית עד שתישמר)' : ''}</span>
        <span class="lay-seg" role="group" aria-label="פריסה">
          <button type="button" data-layout-variant="desktop" aria-pressed=${String(this.variant === 'desktop')} ?disabled=${dirty && this.variant !== 'desktop'} title=${dirty ? 'שמרו או בטלו קודם' : ''} @click=${() => this.switchVariant('desktop')}>מחשב</button>
          <button type="button" data-layout-variant="phone" aria-pressed=${String(this.variant === 'phone')} ?disabled=${dirty && this.variant !== 'phone'} title=${dirty ? 'שמרו או בטלו קודם' : ''} @click=${() => this.switchVariant('phone')}>טלפון</button>
        </span>
        <span class="acts">
          <sw-button size="sm" data-layout-cancel ?disabled=${this.busy} @click=${() => this.cancel()}>${dirty ? 'בטל' : 'סיום עריכה'}</sw-button>
          ${this.variant === 'phone' ? html`<sw-button size="sm" data-layout-phone-auto ?disabled=${this.busy || (!this.record?.phone && !dirty)} @click=${() => void this.phoneAuto()}>חזור לאוטומטי</sw-button>` : nothing}
          <sw-button size="sm" data-layout-reset ?disabled=${this.busy || (!this.record?.desktop && !this.record?.phone)} @click=${() => this.ask('reset')}>אפס לברירת מחדל</sw-button>
          ${areaScope ? html`<sw-button size="sm" icon="layers" data-layout-copy ?disabled=${this.busy || dirty || !this.record?.desktop} title=${dirty ? 'שמרו קודם' : !this.record?.desktop ? 'אין עדיין פריסה שמורה להעתקה' : ''} @click=${() => this.ask('copy')}>העתק לכל האזורים</sw-button>` : nothing}
          ${areaScope && this.variant === 'desktop' ? html`<sw-button size="sm" icon="plus" data-layout-add-card ?disabled=${this.busy} @click=${() => { this.libOpen = true; this.update(); }}>הוסף כרטיס</sw-button>` : nothing}
          <sw-button size="sm" variant="primary" icon="check" data-layout-save ?disabled=${this.busy || (!dirty && (!!stored || !!this.opts.extras))} @click=${() => void this.save()}>שמור</sw-button>
        </span>
        ${this.error ? html`<span class="lay-msg err" role="alert" data-layout-error>${this.error}${this.conflict ? html` <sw-button size="sm" variant="ghost" data-layout-reload @click=${() => void this.reloadAfterConflict()}>טען מחדש</sw-button>` : nothing}</span>` : nothing}
        ${this.note ? html`<span class="lay-msg" role="status">${this.note}</span>` : nothing}
        ${this.undo ? html`<span class="lay-msg" role="status" data-layout-undo-msg>הכרטיס "${this.undo.label}" נמחק · ההתקנים חזרו למאגר <button type="button" class="lay-undo" data-layout-undo @click=${() => this.undoRemove()}>בטל מחיקה</button></span>` : nothing}
        ${this.tileCard
          ? html`<nav class="lay-crumb" data-layout-tiles-crumb aria-label="מיקום בעורך">
              <button type="button" data-layout-tiles-back @click=${() => this.leaveTiles()}><span aria-hidden="true">→</span> כל הכרטיסים</button>
              <span aria-hidden="true">›</span>
              <span class="here" aria-current="page">${this.labelOf(this.tileCard)} · סידור התקנים</span>
            </nav>`
          : nothing}
        <span class="lay-live" aria-live="polite" data-layout-live>${this.live}</span>
      </div>
      ${this.renderConfirm()}${areaScope ? this.renderLibrary() : nothing}`;
  }

  private ask(what: 'reset' | 'copy') {
    this.confirm = what;
    this.error = '';
    this.update();
  }

  private renderConfirm() {
    if (!this.confirm) return html`<sw-dialog data-layout-confirm="closed"></sw-dialog>`;
    const copy = this.confirm === 'copy';
    const close = () => {
      this.confirm = null;
      this.update();
    };
    return html`<sw-dialog open data-layout-confirm=${this.confirm} heading=${copy ? 'להעתיק את הפריסה לכל האזורים?' : 'לאפס את הפריסה?'} @close=${close}>
      <div>${copy
        ? 'הפריסה השמורה של האזור הזה (מחשב, וטלפון אם נשמרה) תחליף את הפריסה של כל שאר האזורים, גם אם נערכה בהם פריסה משלהם. הפעולה נרשמת ביומן.'
        : 'הפריסה השמורה (מחשב וטלפון) תימחק לכל המשתמשים, והמסך יחזור לסידור האוטומטי. הפעולה נרשמת ביומן.'}</div>
      <div style="display:flex;gap:8px;justify-content:flex-end">
        <sw-button data-layout-confirm-cancel autofocus @click=${close}>ביטול</sw-button>
        <sw-button variant=${copy ? 'primary' : 'danger'} data-layout-confirm-ok ?disabled=${this.busy} @click=${() => void (copy ? this.copyToAll() : this.reset())}>${copy ? 'העתק לכל האזורים' : 'אפס'}</sw-button>
      </div>
    </sw-dialog>`;
  }

  /** Review ruling 4: which entities an area card shows - a checklist; a hidden one still counts in the card's numbers. */
  /**
   * The device picker of an area card (owner request 2026-09-30): which devices the card shows - for a built-in card its
   * own devices (a hidden one still counts in the card's numbers), for a custom card any device of the area. A search box,
   * "בחר הכל" / "הסר הכל" / "הפוך בחירה" over the filtered results (the whole list when the box is empty), the list grouped
   * under type headers with a select box each, and a header count that stays live. The list itself never scrolls: the
   * panel does, and the search / buttons row sticks to its top.
   */
  private renderEntities(key: string, it: LayoutItem): TemplateResult | typeof nothing {
    const custom = key.startsWith('card:c-') ? this.customOf(key) : undefined;
    if (custom && this.variant !== 'desktop') return html`<div class="lay-hint" data-layout-picker-desktop-only>בחירת ההתקנים של כרטיס נערכת בפריסת המחשב.</div>`;
    let list: PickEntity[];
    let selected: Set<string>;
    let apply: (next: Set<string>) => void;
    if (custom) {
      list = (this.opts.pool?.() ?? []).map((e) => ({ id: e.id, name: e.name, group: CARD_TYPES[e.card as keyof typeof CARD_TYPES]?.label ?? '' }));
      selected = new Set(custom.entities);
      apply = (next) => this.patch(key, { custom: { ...custom, entities: [...next].sort() } });
    } else {
      list = this.opts.entities?.(key) ?? [];
      const hide = new Set(it.hidden_entities ?? []);
      selected = new Set(list.filter((e) => !hide.has(e.id)).map((e) => e.id));
      apply = (next) => {
        // the hidden set: what is not selected, plus what the list no longer holds (a device gone from the card)
        const listed = new Set(list.map((e) => e.id));
        const nextHide = new Set([...(it.hidden_entities ?? []).filter((id) => !listed.has(id)), ...list.filter((e) => !next.has(e.id)).map((e) => e.id)]);
        // 6c: an arranged tile's own "hidden" follows (one set)
        const tiles = arranged(it) ? Object.fromEntries(Object.entries(it.tiles!).map(([k, t]) => [k, listed.has(k) ? { ...t, hidden: nextHide.has(k) } : t])) : it.tiles;
        this.patch(key, { hidden_entities: [...nextHide].sort(), ...(tiles ? { tiles } : {}) });
      };
    }
    if (!list.length && !custom) return nothing;
    const groups = groupPicks(list, this.entFilter);
    const scope = groups.flatMap((g) => g.items.map((e) => e.id));
    const filtered = this.entFilter.trim() !== '';
    const chosen = list.filter((e) => selected.has(e.id)).length;
    const act = (mode: 'all' | 'none' | 'invert') => apply(bulkSelect(selected, scope, mode));
    const toggle = (id: string, on: boolean) => apply(bulkSelect(selected, [id], on ? 'all' : 'none'));
    const groupBox = (label: string, ids: string[]) => {
      const on = ids.filter((id) => selected.has(id)).length;
      return html`<label class="lay-check lay-ghead"><input type="checkbox" data-layout-ent-group=${label} .checked=${on === ids.length} .indeterminate=${on > 0 && on < ids.length} @change=${(ev: Event) => apply(bulkSelect(selected, ids, (ev.target as HTMLInputElement).checked ? 'all' : 'none'))} /><span>${label}</span><span class="cnt">${on}/${ids.length}</span></label>`;
    };
    return html`<div class="lay-f lay-picker" data-layout-picker><span class="lbl" data-layout-ent-count>${custom ? 'התקנים בכרטיס' : 'ישויות מוצגות בכרטיס'} (${chosen} מתוך ${list.length})</span>
      <div class="lay-ptool">
        <input type="search" data-layout-ent-filter placeholder="חיפוש התקן" aria-label="חיפוש התקן" .value=${this.entFilter} @input=${(ev: Event) => { this.entFilter = (ev.target as HTMLInputElement).value; this.update(); }} />
        <div class="lay-pbtns" role="group" aria-label=${filtered ? `פעולות על ${scope.length} תוצאות` : 'פעולות על כל ההתקנים'}>
          <button type="button" data-layout-ent-all ?disabled=${!scope.length} @click=${() => act('all')}>בחר הכל</button>
          <button type="button" data-layout-ent-none ?disabled=${!scope.length} @click=${() => act('none')}>הסר הכל</button>
          <button type="button" data-layout-ent-invert ?disabled=${!scope.length} @click=${() => act('invert')}>הפוך בחירה</button>
        </div>
        ${filtered ? html`<span class="lay-hint" data-layout-ent-scope>הפעולות חלות על ${scope.length} התוצאות בלבד.</span>` : nothing}
      </div>
      <div class="lay-ents" data-layout-entities>
        ${groups.length
          ? groups.map((g) => html`<div class="lay-pgroup" data-layout-group=${g.label}>
              ${g.label ? groupBox(g.label, g.items.map((e) => e.id)) : nothing}
              ${g.items.map((e) => html`<label class="lay-check"><input type="checkbox" data-layout-entity=${e.id} .checked=${selected.has(e.id)} @change=${(ev: Event) => toggle(e.id, (ev.target as HTMLInputElement).checked)} />${e.name}</label>`)}
            </div>`)
          : html`<span class="lay-hint" data-layout-ent-none-found>${list.length ? 'לא נמצאו התקנים.' : 'אין התקנים באזור.'}</span>`}
      </div>
      ${custom ? nothing : html`<span class="lay-hint">ישות מוסתרת עדיין נספרת במונים של הכרטיס.</span>`}</div>`;
  }

  /** The library dialog: every card type that makes sense for the area's devices (all of them on request), each with a
   * one-line description and a small preview; choosing one adds the card (any number, several of a type). */
  private renderLibrary(): TemplateResult {
    if (!this.libOpen) return html`<sw-dialog data-layout-library="closed"></sw-dialog>`;
    const pool = this.opts.pool?.() ?? [];
    const types = libraryTypes(pool, this.libAll);
    const free = this.unplaced(pool).length;
    const close = () => {
      this.libOpen = false;
      this.update();
    };
    return html`<sw-dialog open data-layout-library="open" heading="הוספת כרטיס" subheading=${free ? `${free} התקנים לא ממוקמים באף כרטיס` : 'בחרו סוג כרטיס'} @close=${close}>
      <div class="lay-lib">
        <label class="lay-check lay-libAll"><input type="checkbox" data-layout-library-all .checked=${this.libAll} @change=${(ev: Event) => { this.libAll = (ev.target as HTMLInputElement).checked; this.update(); }} />הצג את כל סוגי הכרטיסים</label>
        <div class="lay-libList" role="list">
          ${types.map(({ type, count, sample }) => html`<button type="button" role="listitem" class="lay-libItem" data-layout-add=${type.id} @click=${() => this.addCard(type.id)}>
            <span class="lay-libIcon"><sw-icon .name=${type.icon} size=${20}></sw-icon></span>
            <span class="lay-libTxt"><b>${type.label}</b><span>${type.desc}</span>
              <span class="lay-libPrev" aria-hidden="true">${type.id === 'free' ? (free ? `${free} התקנים לא ממוקמים` : 'כרטיס ריק') : sample.length ? sample.join(' · ') : 'אין באזור התקן מהסוג הזה'}</span></span>
            <span class="lay-libCnt">${type.id === 'free' ? free : count}</span>
          </button>`)}
        </div>
      </div>
      <div style="display:flex;gap:8px;justify-content:flex-end"><sw-button data-layout-library-close @click=${close}>סגור</sw-button></div>
    </sw-dialog>`;
  }

  /** The panel of the selected item (a bottom sheet on a phone). */
  renderPanel(): TemplateResult | typeof nothing {
    if (!this.editing || !this.draft) return nothing;
    if (this.tileCard && this.draft.items[this.tileCard]) return this.renderTilePanel(this.tileCard);
    const key = this.selected;
    const it = key ? this.draft.items[key] : null;
    if (!key || !it) {
      return html`<aside class="lay-panel" data-layout-panel="none" aria-label="מאפייני הכרטיס">
        <div class="ph">מאפייני הכרטיס</div>
        <div class="lay-hint">בחרו כרטיס כדי לערוך אותו (בטלפון: לחיצה ארוכה). גררו כרטיס כדי להזיז אותו והידית בפינה משנה את גודלו, בקפיצות של עמודה ו־8 פיקסלים. במקלדת: Tab לכרטיס, חיצים מזיזים, Shift עם חיצים משנה גודל.</div>
        ${this.opts.scope === 'area' && this.variant === 'desktop' ? html`<button type="button" class="btn" data-layout-add-card-panel @click=${() => { this.libOpen = true; this.update(); }}>הוסף כרטיס…</button>` : nothing}
      </aside>`;
    }
    const label = this.labelOf(key);
    // attribute NAMES cannot be bound in a Lit template: one swatch template per field
    const swatch = (field: 'bg' | 'border', r: LayoutRoleId | null) => {
      const name = r ? ROLE_HE[r] : 'ללא';
      const on = String(it[field] === r);
      const click = () => this.patch(key, field === 'bg' ? { bg: r } : { border: r });
      return field === 'bg'
        ? html`<button type="button" class="lay-swatch" data-role=${r ?? 'none'} data-layout-bg=${r ?? 'none'} aria-pressed=${on} aria-label=${name} title=${name} @click=${click}></button>`
        : html`<button type="button" class="lay-swatch" data-role=${r ?? 'none'} data-layout-border=${r ?? 'none'} aria-pressed=${on} aria-label=${name} title=${name} @click=${click}></button>`;
    };
    const roleRow = (field: 'bg' | 'border', title: string) => html`<div class="lay-f"><span class="lbl">${title}</span>
      <div class="lay-swatches" role="group" aria-label=${title}>${swatch(field, null)}${LAYOUT_ROLE_IDS.map((r) => swatch(field, r))}</div></div>`;
    const nudge = (txt: string, lbl: string, change: Partial<LayoutItem>, attr: string) =>
      html`<button type="button" data-layout-nudge=${attr} aria-label=${lbl} title=${lbl} @click=${() => this.patch(key, change)}>${txt}</button>`;
    return html`<aside class="lay-panel" data-layout-panel=${key} aria-label=${`מאפייני הכרטיס: ${label}`}>
      <div class="ph">מאפייני הכרטיס<span class="chip">${label}</span></div>
      <div class="lay-f"><label for="lay-title">כותרת</label>
        <input id="lay-title" type="text" maxlength="60" data-layout-title .value=${it.title ?? ''} placeholder=${label} @input=${(e: Event) => this.patch(key, { title: (e.target as HTMLInputElement).value.trim() ? (e.target as HTMLInputElement).value : null })} /></div>
      <div class="lay-f"><label for="lay-icon">אייקון</label>
        <select id="lay-icon" data-layout-icon @change=${(e: Event) => { const v = (e.target as HTMLSelectElement).value; this.patch(key, { icon: v ? (v as LayoutIcon) : null }); }}>
          <option value="" ?selected=${!it.icon}>ברירת המחדל</option>
          ${LAYOUT_ICONS.map((i) => html`<option value=${i} ?selected=${it.icon === i}>${ICON_HE[i]}</option>`)}
        </select></div>
      <div class="lay-f"><span class="lbl">גודל טקסט</span>
        <span class="lay-seg" role="group" aria-label="גודל טקסט">
          ${(['sm', 'md', 'lg'] as const).map((t) => html`<button type="button" data-layout-text=${t} aria-pressed=${String(it.text === t)} @click=${() => this.patch(key, { text: t })}>${t === 'sm' ? 'קטן' : t === 'md' ? 'רגיל' : 'גדול'}</button>`)}
        </span></div>
      ${roleRow('bg', 'צבע רקע (מתוך ערכת הצבעים)')}
      ${roleRow('border', 'צבע מסגרת')}
      <div class="lay-row2">
        <div class="lay-f"><label for="lay-w">רוחב (עמודות מתוך ${this.draft.cols})</label><input id="lay-w" type="number" min="1" max=${this.draft.cols} data-layout-w .value=${String(it.w)} @change=${(e: Event) => this.patch(key, { w: Number((e.target as HTMLInputElement).value) || it.w })} /></div>
        <div class="lay-f"><label for="lay-h">גובה מינימלי (שורות של 8 פיקסלים)</label><input id="lay-h" type="number" min="2" max="400" data-layout-h .value=${String(it.h)} @change=${(e: Event) => this.patch(key, { h: Number((e.target as HTMLInputElement).value) || it.h })} /></div>
      </div>
      <div class="lay-f"><span class="lbl">הזזה ושינוי גודל</span>
        <div class="lay-nudge">
          ${nudge('▲', 'הזז למעלה', { y: it.y - 1 }, 'up')}
          ${nudge('▼', 'הזז למטה', { y: it.y + 1 }, 'down')}
          ${nudge('→', 'הזז לתחילת השורה', { x: it.x - 1 }, 'start')}
          ${nudge('←', 'הזז לסוף השורה', { x: it.x + 1 }, 'end')}
          ${nudge('רחב +', 'הרחב בעמודה', { w: it.w + 1 }, 'wider')}
          ${nudge('רחב −', 'הצר בעמודה', { w: it.w - 1 }, 'narrower')}
          ${nudge('גובה +', 'הגבה ב־8 פיקסלים', { h: it.h + 1 }, 'taller')}
          ${nudge('גובה −', 'הנמך ב־8 פיקסלים', { h: it.h - 1 }, 'shorter')}
        </div></div>
      ${this.renderEntities(key, it)}
      ${this.canArrange(key) ? html`<button type="button" class="btn" data-layout-tiles-open @click=${() => this.enterTiles(key)}>סידור התקנים בכרטיס${arranged(it) ? ' (מסודר)' : ''}…</button>` : nothing}
      <label class="lay-check"><input type="checkbox" data-layout-hidden .checked=${it.hidden} @change=${(e: Event) => this.patch(key, { hidden: (e.target as HTMLInputElement).checked })} />מוסתר לכולם</label>
      ${this.opts.scope === 'area' && this.variant === 'desktop'
        ? html`<button type="button" class="btn lay-del" data-layout-delete-card @click=${() => this.removeCard(key)}>מחק כרטיס</button><div class="lay-hint">מחיקה מוציאה את הכרטיס מהמסך בלבד: ההתקנים לא נמחקים מהמערכת, אלא חוזרים למאגר ההתקנים הלא ממוקמים, ואפשר לצרף אותם לכרטיס אחר. "בטל מחיקה" מחזיר את הכרטיס.</div>`
        : nothing}
      <div class="lay-hint">הצבעים הם תפקידים בערכת הצבעים של האזור (הגדרות › חשמל והתקנים), כך שהפריסה נראית נכון בכל ערכה, בהיר או כהה. הגובה הוא מינימום: כרטיס לא חותך את ההתקנים שבו.</div>
    </aside>`;
  }

  /** 6c: the panel while a card's tiles are arranged - the selected tile's span, size, place, hidden and title. */
  private renderTilePanel(key: string): TemplateResult {
    const label = this.labelOf(key);
    const list = this.tileList(key);
    const cols = this.tileCols(key);
    const isArranged = arranged(this.draft?.items[key]);
    const reset = html`<button type="button" class="btn" data-layout-tiles-reset ?disabled=${!isArranged} @click=${() => this.resetTiles(key)}>אפס סידור</button>`;
    const i = this.tileSel ? list.findIndex((x) => x.id === this.tileSel) : -1;
    if (i < 0) {
      return html`<aside class="lay-panel" data-layout-panel=${`tiles:${key}`} aria-label=${`סידור התקנים: ${label}`}>
        <div class="ph">סידור התקנים<span class="chip">${label}</span></div>
        <div class="lay-hint">בחרו התקן כדי לערוך אותו (בטלפון: לחיצה ארוכה). גררו התקן כדי לשנות את מקומו בכרטיס. במקלדת: Tab להתקן, חיצים מזיזים אותו לפני או אחרי, Shift עם חיצים משנה את רוחבו, H מסתיר או מחזיר אותו.</div>
        <div class="lay-tacts">${reset}</div>
        <div class="lay-hint">"אפס סידור" מחזיר את הסדר האוטומטי של הכרטיס. התקנים מוסתרים נשארים מוסתרים - מחזירים אותם כאן או ברשימת "ישויות מוצגות" של הכרטיס.</div>
      </aside>`;
    }
    const { id, t } = list[i];
    const name = this.tileName(key, id);
    return html`<aside class="lay-panel" data-layout-panel=${`tile:${id}`} aria-label=${`מאפייני ההתקן: ${t.title ?? name}`}>
      <div class="ph">מאפייני ההתקן<span class="chip">${t.title ?? name}</span></div>
      <div class="lay-f"><label for="lay-ttitle">כותרת</label>
        <input id="lay-ttitle" type="text" maxlength="60" data-layout-tile-title .value=${t.title ?? ''} placeholder=${name} @input=${(e: Event) => { const v = (e.target as HTMLInputElement).value; this.patchTile(key, id, { title: v.trim() ? v : null }); }} /></div>
      <div class="lay-f"><span class="lbl">רוחב בכרטיס</span>
        <span class="lay-seg" role="group" aria-label="רוחב בכרטיס">
          ${Array.from({ length: cols }, (_, k) => k + 1).map((s) => html`<button type="button" data-layout-tile-span=${s} aria-pressed=${String(t.span === s)} @click=${() => this.patchTile(key, id, { span: s })}>${this.spanHe(key, s)}</button>`)}
        </span></div>
      <div class="lay-f"><span class="lbl">גודל</span>
        <span class="lay-seg" role="group" aria-label="גודל">
          ${(['s', 'm', 'l'] as const).map((z) => html`<button type="button" data-layout-tile-size=${z} aria-pressed=${String(t.size === z)} @click=${() => this.patchTile(key, id, { size: z })}>${SIZE_HE[z]}</button>`)}
        </span></div>
      <div class="lay-f"><span class="lbl">מקום בכרטיס: ${i + 1} מתוך ${list.length}</span>
        <div class="lay-nudge">
          <button type="button" data-layout-tile-move="first" ?disabled=${i === 0} @click=${() => this.moveTile(key, id, 0)}>ראשון</button>
          <button type="button" data-layout-tile-move="earlier" ?disabled=${i === 0} @click=${() => this.moveTile(key, id, i - 1)}>הקדם</button>
          <button type="button" data-layout-tile-move="later" ?disabled=${i === list.length - 1} @click=${() => this.moveTile(key, id, i + 1)}>אחר</button>
          <button type="button" data-layout-tile-move="last" ?disabled=${i === list.length - 1} @click=${() => this.moveTile(key, id, list.length - 1)}>אחרון</button>
        </div></div>
      <label class="lay-check"><input type="checkbox" data-layout-tile-hidden .checked=${t.hidden} @change=${(e: Event) => this.patchTile(key, id, { hidden: (e.target as HTMLInputElement).checked })} />מוסתר (עדיין נספר במונים של הכרטיס)</label>
      <div class="lay-tacts">${reset}</div>
    </aside>`;
  }
}

/** An area card's entities without the ones its layout hides (the card still counts them) - the card's list and
 * (6c) its hidden tiles, one set. */
export function shownEntities<T extends { entity_id: string }>(it: LayoutItem | null, rows: T[]): T[] {
  const hide = new Set(it?.hidden_entities ?? []);
  for (const [id, t] of Object.entries(it?.tiles ?? {})) if (t.hidden) hide.add(id);
  return hide.size ? rows.filter((r) => !hide.has(r.entity_id)) : rows;
}

/** The title an item shows: the layout's own, else the screen's. */
export function titleOf(it: LayoutItem | null, fallback: string): string {
  return it?.title ?? fallback;
}
