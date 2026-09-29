import { LitElement, html, css, nothing } from 'lit';
import { customElement, state } from 'lit/decorators.js';
import { classMap } from 'lit/directives/class-map.js';
import { repeat } from 'lit/directives/repeat.js';
import '../components/sw-page';
import '../components/sw-badge';
import '../components/sw-icon';
import '../components/sw-kpi';
import '../components/sw-state-panel';
import '../components/sw-button';
import './devices-bulk';
import type { StateKind } from '../components/sw-badge';
import type { IconName } from '../components/sw-icon';
import { canAnywhere, isApi } from '../api/session';
import { ApiError, describeError } from '../api/client';
import { subscribeHa, type HaSyncState } from '../api/ha';
import { ALARM_HE, getDevicesTree, HVAC_HE, refreshDevicesFromHa, type ClimateSummary, type DeviceArea, type DeviceCounts, type DeviceFloor, type DeviceTree } from '../api/devices';
import { bidi, ltrNum } from '../i18n/bidi';
import type { BulkKind } from '../api/device-bulk';
import type { BulkRequest, DevicesBulkDialog } from './devices-bulk';
import { applyDevicesPrefs, DEVICES_PREFS_DEFAULT, devicesStyleTokens, loadDevicesPrefs, type DevicesPrefs } from './devices-style';
import { DevicesLayoutController, titleOf, type LayoutGrid, type MeasuredGrid } from './devices-layout';

/** Refetches are throttled, not debounced: the first push starts a window, every push inside it rides the same
 * refetch, and a push during the fetch itself queues exactly one more (loadAgain). A screen full of sensors updating
 * several times a second therefore refreshes about every REFRESH_WINDOW_MS instead of never (a resetting debounce
 * would starve - review finding). */
export const REFRESH_WINDOW_MS = 400;
/** How long "מבנה עודכן" stays up after a structure change refetched the screen (CR-007 HA refresh). */
export const STRUCTURE_FLASH_MS = 4000;
/** How long after a manual refresh's answer its own structure_changed push is still expected. */
const MANUAL_PUSH_GRACE_MS = 1000;

/** "<what> עכשיו / לפני …": seconds under a minute, then minutes, hours, else the date. '' for no / bad time. */
export function agoHe(what: string, iso: string | null | undefined, now: number = Date.now()): string {
  if (!iso) return '';
  const t = new Date(iso).getTime();
  if (Number.isNaN(t)) return '';
  const s = Math.max(0, Math.round((now - t) / 1000));
  if (s < 10) return `${what} עכשיו`;
  if (s < 60) return `${what} לפני ${s} שניות`;
  const m = Math.round(s / 60);
  if (m < 60) return m === 1 ? `${what} לפני דקה` : `${what} לפני ${m} דקות`;
  const h = Math.round(m / 60);
  if (h < 24) return h === 1 ? `${what} לפני שעה` : `${what} לפני ${h} שעות`;
  return `${what} ב־${new Date(t).toLocaleString('he-IL', { dateStyle: 'short', timeStyle: 'short' })}`;
}

/** The two timing lines next to the refresh button: when the structure last CHANGED (last_structure_at) and when it
 * was last CHECKED against Home Assistant (last_registry_at - every refresh, changed or not). */
export function structureTiming(sync: HaSyncState | null | undefined, now: number = Date.now()): { changed: string; checked: string } {
  if (!sync?.last_registry_at) return { changed: 'המבנה טרם נטען מ־Home Assistant', checked: '' };
  return {
    changed: agoHe('המבנה עודכן', sync.last_structure_at, now) || 'המבנה לא השתנה מאז הפעלת ה־Add-on',
    checked: agoHe('נבדק מול Home Assistant', sync.last_registry_at, now),
  };
}

/** What a tile / floor row shows for each kind that exists there: icon, "on/total", and whether "on" is the warm state. */
export interface CountPill {
  key: keyof DeviceCounts;
  icon: IconName;
  label: string;
  total: number;
  on: number | null;
  warm: boolean;
}

export function pillsOf(c: DeviceCounts): CountPill[] {
  const out: CountPill[] = [];
  if (c.lights) out.push({ key: 'lights', icon: 'light', label: 'תאורה', total: c.lights, on: c.lights_on, warm: c.lights_on > 0 });
  if (c.switches) out.push({ key: 'switches', icon: 'bolt', label: 'מתגים', total: c.switches, on: c.switches_on, warm: c.switches_on > 0 });
  if (c.covers) out.push({ key: 'covers', icon: 'layers', label: 'תריסים פתוחים', total: c.covers, on: c.covers_open, warm: c.covers_open > 0 });
  if (c.climate) out.push({ key: 'climate', icon: 'activity', label: 'מיזוג פעיל', total: c.climate, on: c.climate_active, warm: c.climate_active > 0 });
  if (c.media) out.push({ key: 'media', icon: 'play', label: 'מסכים דולקים', total: c.media, on: c.media_on, warm: c.media_on > 0 });
  if (c.locks) out.push({ key: 'locks', icon: 'lock', label: 'נעולים', total: c.locks, on: c.locks_locked, warm: false });
  if (c.cameras) out.push({ key: 'cameras', icon: 'camera', label: 'מצלמות', total: c.cameras, on: null, warm: false });
  if (c.sensors) out.push({ key: 'sensors', icon: 'sensor', label: 'חיישנים', total: c.sensors, on: null, warm: false });
  return out;
}

export function alarmTone(state: string | null): StateKind {
  if (!state) return 'neutral';
  if (state === 'triggered') return 'error';
  if (state === 'disarmed') return 'neutral';
  if (state === 'unavailable' || state === 'unknown') return 'offline';
  return 'live';
}

const DEMO_CLIMATE = [{ entity_id: 'climate.lobby', name: 'מזגן לובי', area_name: 'לובי', hvac_mode: 'cool', hvac_action: 'cooling', current_temperature: 24.5, target_temperature: 22, unit: '°C', available: true }];

const DEMO: DeviceTree = {
  floors: [
    {
      floor_id: 'ground', name: 'קרקע', level: 0, icon: null,
      counts: { entities: 14, lights: 6, lights_on: 3, switches: 2, switches_on: 1, covers: 2, covers_open: 1, climate: 1, climate_active: 1, media: 1, media_on: 0, locks: 1, locks_locked: 1, alarm: 'armed_home', cameras: 1, sensors: 2 },
      areas: [
        { area_id: 'lobby', name: 'לובי', icon: null, floor_id: 'ground', has_camera: true, counts: { entities: 8, lights: 4, lights_on: 3, switches: 1, switches_on: 1, covers: 1, covers_open: 1, climate: 1, climate_active: 1, media: 0, media_on: 0, locks: 1, locks_locked: 1, alarm: 'armed_home', cameras: 1, sensors: 1 } },
        { area_id: 'kitchen', name: 'מטבח', icon: null, floor_id: 'ground', has_camera: false, counts: { entities: 6, lights: 2, lights_on: 0, switches: 1, switches_on: 0, covers: 1, covers_open: 0, climate: 0, climate_active: 0, media: 1, media_on: 0, locks: 0, locks_locked: 0, alarm: null, cameras: 0, sensors: 1 } },
      ],
      climate: DEMO_CLIMATE,
    },
    {
      floor_id: 'first', name: 'קומה 1', level: 1, icon: null,
      counts: { entities: 5, lights: 3, lights_on: 0, switches: 0, switches_on: 0, covers: 2, covers_open: 2, climate: 0, climate_active: 0, media: 0, media_on: 0, locks: 0, locks_locked: 0, alarm: null, cameras: 0, sensors: 0 },
      areas: [{ area_id: 'office', name: 'משרד', icon: null, floor_id: 'first', has_camera: false, counts: { entities: 5, lights: 3, lights_on: 0, switches: 0, switches_on: 0, covers: 2, covers_open: 2, climate: 0, climate_active: 0, media: 0, media_on: 0, locks: 0, locks_locked: 0, alarm: null, cameras: 0, sensors: 0 } }],
      climate: [],
    },
  ],
  unassigned: { area_id: 'unassigned', name: 'ללא שיוך', counts: { entities: 1, lights: 0, lights_on: 0, switches: 1, switches_on: 0, covers: 0, covers_open: 0, climate: 0, climate_active: 0, media: 0, media_on: 0, locks: 0, locks_locked: 0, alarm: null, cameras: 0, sensors: 0 } },
  building: { entities: 20, lights: 9, lights_on: 3, switches: 3, switches_on: 1, covers: 4, covers_open: 3, climate: 1, climate_active: 1, media: 1, media_on: 0, locks: 1, locks_locked: 1, alarm: 'armed_home', cameras: 1, sensors: 2 },
  building_climate: DEMO_CLIMATE,
  scoped: false,
  sync: { connected: false, last_snapshot_at: null, last_event_at: null, last_registry_at: null, last_error: null, reconnects: 0, sequence: 0, entities: 20, started_at: null, ha_version: null },
};

export type BuildingLayout = 'cards' | 'tiles';
export const LAYOUT_KEY = 'sw.devices.layout';

/** The viewer's own choice, or null when they never toggled (then הגדרות › חשמל והתקנים › devices.default_view decides). */
function readLayout(): BuildingLayout | null {
  try {
    const v = localStorage.getItem(LAYOUT_KEY);
    return v === 'tiles' || v === 'cards' ? v : null;
  } catch {
    return null;
  }
}

function writeLayout(l: BuildingLayout) {
  try {
    localStorage.setItem(LAYOUT_KEY, l);
  } catch {
    /* private mode: the choice lasts for this visit only */
  }
}

/** CR-007 6a: the building screen's own element rules for the "glass" style (tokens: devices-style.ts) and for the
 * compact density. Logical properties only; smplwise + comfortable match none of them. */
const BUILDING_GLASS = css`
  :host([data-devices-style='glass']) sw-kpi,
  :host([data-devices-style='glass']) nav.tree,
  :host([data-devices-style='glass']) section.fcard,
  :host([data-devices-style='glass']) a.tile {
    backdrop-filter: var(--sw-glass-blur);
    -webkit-backdrop-filter: var(--sw-glass-blur);
  }
  :host([data-devices-style='glass']) .kpis {
    gap: var(--dv-gap);
  }
  :host([data-devices-style='glass']) sw-kpi {
    padding-block: var(--dv-item-pad-block);
    padding-inline: var(--dv-item-pad-inline);
  }
  /* iOS-like segmented control for "פריסה" */
  :host([data-devices-style='glass']) .seg .opts {
    border: 0;
    border-radius: var(--dv-radius-control);
    background: var(--dv-surface-3);
    padding: 3px;
    gap: 2px;
  }
  :host([data-devices-style='glass']) .seg button {
    border-radius: var(--dv-radius-control);
    background: transparent;
    padding-block: 6px;
    padding-inline: var(--dv-item-pad-inline);
    font-weight: var(--sw-fw-semibold);
  }
  :host([data-devices-style='glass']) .seg button + button {
    border-inline-start: 0;
  }
  :host([data-devices-style='glass']) .seg button[aria-pressed='true'] {
    background: var(--sw-surface);
    color: var(--dv-text);
    box-shadow: var(--dv-shadow-control);
  }
  /* the tree panel: pill rows */
  :host([data-devices-style='glass']) .split {
    grid-template-columns: var(--dv-tree-inline) minmax(0, 1fr);
    gap: var(--dv-gap-lg);
  }
  :host([data-devices-style='glass']) nav.tree {
    padding: var(--dv-gap-sm);
    gap: 3px;
  }
  :host([data-devices-style='glass']) .tree-row {
    border-radius: var(--dv-radius-control);
    padding-block: 8px;
    padding-inline: var(--dv-item-pad-inline);
  }
  :host([data-devices-style='glass']) .tree-row.selected {
    background: var(--dv-accent-soft);
    color: var(--dv-accent-text);
  }
  /* larger floor ("room") cards */
  :host([data-devices-style='glass']) .fcards {
    grid-template-columns: repeat(auto-fill, minmax(var(--dv-floor-card-min), 1fr));
    gap: var(--dv-gap-lg);
  }
  :host([data-devices-style='glass']) .fcard header {
    padding-block: var(--dv-card-pad-block) var(--dv-gap-sm);
    padding-inline: var(--dv-card-pad-inline);
  }
  :host([data-devices-style='glass']) .fcard header h2,
  :host([data-devices-style='glass']) .floor-head h2 {
    font-size: var(--dv-fs-title);
    font-weight: var(--dv-fw-title);
    letter-spacing: -0.01em;
  }
  :host([data-devices-style='glass']) .fcard .rows {
    padding-block: 0 var(--dv-gap-sm);
    padding-inline: var(--dv-gap-sm);
    gap: 4px;
  }
  :host([data-devices-style='glass']) .arow {
    box-sizing: border-box;
    border-block-start: 0;
    border-radius: var(--dv-radius-sm);
    background: var(--sw-surface-2);
    padding-block: var(--dv-item-pad-block);
    padding-inline: var(--dv-item-pad-inline);
  }
  :host([data-devices-style='glass']) .arow:hover,
  :host([data-devices-style='glass']) .arow:focus-visible {
    background: var(--sw-surface);
  }
  :host([data-devices-style='glass']) .fcard footer {
    border-block-start: 0;
    padding-block: 4px var(--dv-card-pad-block);
    padding-inline: var(--dv-card-pad-inline);
  }
  :host([data-devices-style='glass']) .climate-strip {
    padding-block: 2px var(--dv-gap-sm);
    padding-inline: var(--dv-card-pad-inline);
  }
  /* icon-forward area tiles */
  :host([data-devices-style='glass']) .areas {
    grid-template-columns: repeat(auto-fill, minmax(var(--dv-area-tile-min), 1fr));
    gap: var(--dv-gap);
  }
  :host([data-devices-style='glass']) a.tile {
    min-block-size: var(--dv-tile-min-block);
    padding-block: var(--dv-tile-pad-block);
    padding-inline: var(--dv-tile-pad-inline);
    gap: var(--dv-item-pad-block);
  }
  :host([data-devices-style='glass']) .tile-head {
    gap: var(--dv-item-pad-block);
  }
  :host([data-devices-style='glass']) .tile-head > sw-icon {
    box-sizing: border-box;
    inline-size: var(--dv-icon-ring-size-lg);
    block-size: var(--dv-icon-ring-size-lg);
    padding: var(--dv-icon-ring-pad);
    border-radius: 50%;
    background: var(--dv-icon-ring-bg);
    color: var(--dv-icon-ring-fg);
  }
  :host([data-devices-style='glass']) .tile-head .name {
    font-size: var(--dv-fs-tile-name);
  }
  :host([data-devices-style='glass']) a.tile.on {
    background: linear-gradient(135deg, rgb(var(--dv-tile-on-warm) / var(--dv-glow-fill-start)), rgb(var(--dv-tile-on-warm) / var(--dv-glow-fill-end))), var(--sw-surface);
    border-color: rgb(var(--dv-tile-on-warm) / var(--dv-glow-border));
    box-shadow: 0 0 28px rgb(var(--dv-tile-on-warm) / var(--dv-glow-halo)), var(--dv-shadow-1);
  }
  :host([data-devices-style='glass']) a.tile.on .tile-head > sw-icon {
    background: rgb(var(--dv-tile-on-warm) / var(--dv-glow-fill-start));
  }
  :host([data-devices-style='glass']) a.tile.empty {
    background: var(--sw-surface-2);
  }
  :host([data-devices-style='glass']) .tile-wrap devices-bulk-menu {
    inset-block-start: var(--dv-gap-sm);
    inset-inline-end: var(--dv-gap-sm);
  }
  @media (prefers-reduced-motion: no-preference) {
    :host([data-devices-style='glass']) a.tile {
      transition: transform var(--sw-t-med) var(--sw-ease), box-shadow var(--sw-t-med) var(--sw-ease), border-color var(--sw-t-fast) var(--sw-ease);
    }
    :host([data-devices-style='glass']) a.tile:hover {
      transform: translateY(var(--dv-hover-lift));
    }
  }
  @media (max-width: 899px) {
    :host([data-devices-style='glass']) .split,
    :host([data-devices-style='glass']) .fcards {
      grid-template-columns: minmax(0, 1fr);
    }
  }

  /* compact density (either style): tighter tiles, rows and gaps */
  :host([data-devices-density='compact']) .kpis {
    grid-template-columns: repeat(auto-fill, minmax(130px, 1fr));
    gap: 8px;
  }
  :host([data-devices-density='compact']) sw-kpi {
    padding-block: 8px;
    padding-inline: 10px;
    gap: 4px;
  }
  :host([data-devices-density='compact']) .areas {
    grid-template-columns: repeat(auto-fill, minmax(160px, 1fr));
    gap: 8px;
  }
  :host([data-devices-density='compact']) a.tile {
    min-block-size: 68px;
    padding-block: 8px;
    padding-inline: 10px;
    gap: 6px;
  }
  :host([data-devices-density='compact']) .fcards {
    gap: 8px;
  }
  :host([data-devices-density='compact']) .fcard header {
    padding-block: 8px 6px;
    padding-inline: 10px;
  }
  :host([data-devices-density='compact']) .arow {
    padding-block: 5px;
    padding-inline: 8px;
  }
  :host([data-devices-density='compact']) .fcard footer {
    padding-block: 6px 8px;
    padding-inline: 10px;
  }
  :host([data-devices-density='compact']) .tree-row {
    padding-block: 4px;
    padding-inline: 8px;
  }
  :host([data-devices-style='glass'][data-devices-density='compact']) .tile-head > sw-icon {
    inline-size: calc(var(--dv-icon-ring-size-lg) - 10px);
    block-size: calc(var(--dv-icon-ring-size-lg) - 10px);
    padding: calc(var(--dv-icon-ring-pad) - 3px);
  }
`;

function anythingOn(c: DeviceCounts): boolean {
  return c.lights_on + c.switches_on + c.covers_open + c.climate_active + c.media_on > 0;
}

/** The data-counts attribute of an area row: the pills it shows (the sensors count drops with devices.show_sensors). */
function countsAttr(pills: CountPill[]): string {
  return pills.map((p) => `${p.key}:${p.on === null ? p.total : `${p.on}/${p.total}`}`).join(' ');
}

/**
 * חשמל והתקנים › המבנה (CR-007 slice 1, read-only): the building's live counts, then Home Assistant's floors in level
 * order, each with its areas as tiles that open the area screen. Everything here is a projection of the synced HA
 * catalogue; a state push on /ha/ws makes the screen refetch (no local mutation, so the counts always say what the
 * backend last computed). No single-entity controls here - a lit light is a warm tile; the area screen controls one
 * device.
 *
 * CR-007 slice 3 (owner feedback on 0.1.115: "add the mockup's layout, do not remove the current one") - two
 * presentations of the same data and the same actions, chosen with "פריסה: כרטיסים | אריחים" and remembered per viewer
 * (localStorage, LAYOUT_KEY):
 * - "כרטיסים" (default, the approved mockup's board 1): a tree panel on the inline-start side ("כל המבנה", floors as
 *   group headers with a "⋯" menu, area rows with a state dot, the lit count and a hover "כבה אזור"), and the main
 *   column's floor cards (header with the lit count and "כבה קומה ▾", one row per area with its state chips, footer
 *   "פתח קומה"). Choosing a floor in the tree (or "פתח קומה", or the floor card's title) narrows the cards to that
 *   floor. Owner feedback 2026-09-29: a click on an area row ENTERS the area; hovering it (or focusing it with the
 *   keyboard) shows the area popover as a summary - state chips, the quick actions, "כבה הכל באזור · אישור" and
 *   "פתח אזור ›" - and the row's own "⋯" opens the same popover on a touch screen (devices-bulk-menu `hover`).
 * - "אריחים": the slice-1 floor sections with area tiles, each tile with its "⋯" popover.
 * Owner feedback 2026-09-29 ("hide empty domains"): a building counter of a domain the installation has no entity of
 * at all is not shown (no "0/0 אין במבנה"), nor a lit count where there is no light; the pills show present kinds only.
 * The bulk actions exist only for a holder of devices.control_bulk and only where the tree says the server would
 * accept them (`can_bulk`); every one opens the confirmation dialog (devices-bulk-dialog), which alone sends, and the
 * tree refetches when a bulk action ends. "הצג על המפה" of the mockup waits for the HA area ↔ plan room link (CR-007
 * §7.1), which does not exist yet: nothing on this screen pretends to know where an area is on a map.
 */
@customElement('devices-building')
export class DevicesBuilding extends LitElement {
  @state() private tree: DeviceTree | null = null;
  @state() private error = '';
  @state() private forbidden = false;
  @state() private sync: HaSyncState | null = null;
  private stop: (() => void) | null = null;
  private timer = 0;
  private loading = false;
  private loadAgain = false;
  /** Owner feedback on 0.1.115: the mockup's tree + floor cards (default) or the slice-1 tiles, per viewer. CR-007 6a:
   * a viewer who never toggled opens on the installation's devices.default_view; their own toggle wins from then on. */
  @state() private layout: BuildingLayout = readLayout() ?? DEVICES_PREFS_DEFAULT.defaultView;
  private layoutChosen = readLayout() !== null;
  /** CR-007 6a: style, density, sensors count, climate strip (הגדרות › חשמל והתקנים). */
  @state() private prefs: DevicesPrefs = DEVICES_PREFS_DEFAULT;
  private prefsReady: Promise<void> = Promise.resolve();
  /** The tree's selection in the cards layout: every floor, or one floor id. */
  @state() private selected = 'all';
  /** CR-007 HA refresh: "מבנה עודכן" shown for a few seconds after a structure_changed push refetched the tree. */
  @state() private structureFlash = false;
  /** The manual "רענן מ-Home Assistant" request in flight, and its outcome line (error / "no change"). */
  @state() private refreshing = false;
  @state() private refreshNote = '';
  /** Re-renders the "עודכן לפני …" line while nothing else changes. */
  @state() private tick = 0;
  private flashTimer = 0;
  private tickTimer = 0;
  /** Until when a structure_changed push is taken as the echo of this user's own manual refresh (no second fetch). */
  private manualUntil = 0;

  /** CR-007 6b: the building screen's layout (one per installation: floor cards and area tiles; system.configure edits). */
  private lay = new DevicesLayoutController(this, {
    scope: 'building',
    id: () => 'main',
    screenName: () => (this.layout === 'cards' ? 'מסך המבנה › כרטיסי קומה' : 'מסך המבנה › אריחי אזורים'),
    measure: () => this.measureGrids(),
    defaultH: (key) => (key.startsWith('floor:') ? 30 : 14),
    label: (key) => this.layLabel(key),
    compact: () => this.prefs.density === 'compact',
    onEnter: () => {
      this.selected = 'all';
    },
  });

  private layLabel(key: string): string {
    const id = key.slice(key.indexOf(':') + 1);
    if (id === 'unassigned') return 'ללא שיוך';
    const t = this.tree;
    if (key.startsWith('floor:')) return t?.floors.find((f) => f.floor_id === id)?.name ?? id;
    for (const f of t?.floors ?? []) {
      const a = f.areas.find((x) => x.area_id === id);
      if (a) return a.name;
    }
    return id;
  }

  private measureGrids(): MeasuredGrid[] {
    return [...this.renderRoot.querySelectorAll<HTMLElement>('[data-lay-grid]')].map((el) => ({
      el,
      items: [...el.querySelectorAll<HTMLElement>(':scope > [data-lay-key]')].map((c) => ({ key: c.dataset.layKey!, el: c })),
    }));
  }

  /** The grids this render draws (a narrowed floor selection is never laid out: it shows one card). */
  private layGrids(t: DeviceTree): LayoutGrid[] {
    const loose = !!t.unassigned.counts.entities || !t.scoped;
    if (this.layout === 'cards') {
      if (this.selected !== 'all' && !this.lay.editing) return [];
      return [{ id: 'fcards', keys: [...t.floors.map((f) => `floor:${f.floor_id}`), ...(loose ? ['floor:unassigned'] : [])] }];
    }
    return [...t.floors.map((f) => ({ id: `areas:${f.floor_id}`, keys: f.areas.map((a) => `area:${a.area_id}`) })), ...(loose ? [{ id: 'areas:unassigned', keys: ['area:unassigned'] }] : [])];
  }

  private gridAttrs(id: string) {
    return { on: this.lay.gridOn(id), cols: this.lay.gridCols(id), phone: this.lay.phonePreview(id) };
  }

  private setLayout(l: BuildingLayout) {
    this.layout = l;
    this.layoutChosen = true;
    writeLayout(l);
  }

  /** The count pills a tile / row / floor shows (the sensors count hides with devices.show_sensors = false). */
  private pillsShown(c: DeviceCounts): CountPill[] {
    const all = pillsOf(c);
    return this.prefs.showSensors ? all : all.filter((p) => p.key !== 'sensors');
  }

  /** CR-007 slice 3: a bulk action may be offered at all (the permission somewhere; the tree's can_bulk says where). */
  private get bulkAllowed(): boolean {
    return isApi() && canAnywhere('devices.control_bulk');
  }

  private get dialog(): DevicesBulkDialog | null {
    return this.renderRoot.querySelector('devices-bulk-dialog');
  }

  private onBulkRequest = (e: CustomEvent<BulkRequest>) => {
    e.stopPropagation();
    void this.dialog?.show(e.detail);
  };

  private building(kind: BulkKind) {
    void this.dialog?.show({ scope: 'building', id: '*', name: 'המבנה', kind });
  }

  static styles = [devicesStyleTokens, css`
    :host {
      display: block;
    }
    .ha-refresh {
      display: inline-flex;
      align-items: center;
      flex-wrap: wrap;
      gap: 8px;
    }
    .ha-refresh .refreshed {
      font-size: var(--sw-fs-xs);
      color: var(--sw-text-3);
    }
    .kpis {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(150px, 1fr));
      gap: 10px;
    }
    .floor {
      display: flex;
      flex-direction: column;
      gap: 10px;
      margin-block-start: 6px;
    }
    .floor-head {
      display: flex;
      align-items: baseline;
      gap: 10px;
      flex-wrap: wrap;
    }
    .floor-head h2 {
      margin: 0;
      font-size: var(--sw-fs-lg);
      font-weight: var(--sw-fw-semibold);
    }
    .level {
      font-size: var(--sw-fs-xs);
      color: var(--sw-text-3);
      font-variant-numeric: tabular-nums;
    }
    .floor-sum {
      display: flex;
      gap: 10px;
      flex-wrap: wrap;
      font-size: var(--sw-fs-xs);
      color: var(--sw-text-2);
      /* next to the title (owner's 1920 px screenshot: an auto margin pushed the chips to the far edge of the page) */
      margin-inline-start: 6px;
    }
    .floor-sum span {
      display: inline-flex;
      align-items: center;
      gap: 4px;
      font-variant-numeric: tabular-nums;
    }
    .floor-sum .warm {
      color: var(--sw-text);
      font-weight: var(--sw-fw-semibold);
    }
    .floor-sum .warm sw-icon,
    .pills .warm sw-icon {
      color: var(--sw-warning);
    }
    .areas {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(190px, 1fr));
      gap: 10px;
    }
    .tile-wrap {
      position: relative;
      display: flex;
      flex-direction: column;
    }
    .tile-wrap > a.tile {
      flex: 1;
    }
    .tile-wrap.bulk > a.tile .tile-head {
      padding-inline-end: 28px; /* room for the popover trigger in the corner */
    }
    .tile-wrap devices-bulk-menu {
      position: absolute;
      inset-block-start: 6px;
      inset-inline-end: 6px;
    }
    .floor-head devices-bulk-menu {
      margin-inline-start: 4px;
    }
    .bulk-buttons {
      display: inline-flex;
      gap: 6px;
      flex-wrap: wrap;
    }
    .toolbar {
      display: flex;
      align-items: center;
      gap: 10px 16px;
      flex-wrap: wrap;
    }
    .seg {
      display: inline-flex;
      align-items: center;
      gap: 6px;
      font-size: var(--sw-fs-xs);
      color: var(--sw-text-3);
    }
    .seg .opts {
      display: inline-flex;
      border: 1px solid var(--sw-border-strong);
      border-radius: 8px;
      overflow: hidden;
    }
    .seg button {
      border: 0;
      padding: 5px 12px;
      background: var(--sw-surface);
      color: var(--sw-text);
      font: inherit;
      font-size: var(--sw-fs-sm);
      cursor: pointer;
    }
    .seg button + button {
      border-inline-start: 1px solid var(--sw-border-strong);
    }
    .seg button[aria-pressed='true'] {
      background: var(--sw-accent);
      color: var(--sw-on-accent, #fff);
    }
    .toolbar .bulk-buttons {
      margin-inline-start: auto;
    }
    /* ---- the mockup's layout: tree panel (inline start) + floor cards */
    .split {
      display: grid;
      grid-template-columns: 250px minmax(0, 1fr);
      gap: 16px;
      align-items: start;
    }
    nav.tree {
      display: flex;
      flex-direction: column;
      gap: 2px;
      padding: 8px;
      border: 1px solid var(--sw-border);
      border-radius: var(--sw-r-md);
      background: var(--sw-surface);
      box-shadow: var(--sw-shadow-1);
      position: sticky;
      inset-block-start: 8px;
    }
    .tree-row {
      display: flex;
      align-items: center;
      gap: 8px;
      inline-size: 100%;
      padding: 6px 8px;
      border: 0;
      border-radius: var(--sw-r-sm);
      background: transparent;
      color: var(--sw-text);
      font: inherit;
      font-size: var(--sw-fs-sm);
      text-align: start;
      cursor: pointer;
      min-inline-size: 0;
    }
    .tree-row:hover,
    .tree-row:focus-visible {
      background: var(--sw-surface-2);
      outline: none;
    }
    .tree-row.selected {
      background: var(--sw-accent-soft, var(--sw-surface-2));
      font-weight: var(--sw-fw-semibold);
    }
    .tree-row .nm {
      flex: 1;
      min-inline-size: 0;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }
    .tree-row .lit {
      font-size: var(--sw-fs-xs);
      color: var(--sw-text-3);
      font-variant-numeric: tabular-nums;
      display: inline-flex;
      align-items: center;
      gap: 3px;
    }
    .tree-row .lit.warm {
      color: var(--sw-text);
    }
    .tree-row .lit.warm sw-icon {
      color: var(--sw-warning);
    }
    .tree-floor {
      display: flex;
      align-items: center;
      gap: 2px;
      margin-block-start: 6px;
    }
    .tree-floor .tree-row {
      font-weight: var(--sw-fw-semibold);
      font-size: var(--sw-fs-xs);
      color: var(--sw-text-2);
      text-transform: none;
    }
    .tree-area {
      display: flex;
      align-items: center;
      gap: 2px;
      padding-inline-start: 10px;
    }
    .tree-area devices-bulk-menu {
      flex: 1;
      min-inline-size: 0;
    }
    .sdot {
      inline-size: 8px;
      block-size: 8px;
      border-radius: 50%;
      background: var(--sw-border-strong);
      flex: none;
    }
    .sdot.on {
      background: var(--sw-warning);
    }
    .quick {
      opacity: 0;
      transition: opacity var(--sw-t-fast) var(--sw-ease);
    }
    .tree-area:hover .quick,
    .tree-area:focus-within .quick {
      opacity: 1;
    }
    @media (hover: none) {
      .quick {
        opacity: 1;
      }
    }
    .fcards {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(330px, 1fr));
      gap: 12px;
      align-items: start;
    }
    section.fcard {
      display: flex;
      flex-direction: column;
      border: 1px solid var(--sw-border);
      border-radius: var(--sw-r-md);
      background: var(--sw-surface);
      box-shadow: var(--sw-shadow-1);
    }
    .fcard header {
      display: flex;
      align-items: center;
      gap: 8px;
      padding: 12px 14px 8px;
      flex-wrap: wrap;
    }
    .fcard header h2 {
      margin: 0;
      font-size: var(--sw-fs-md);
      font-weight: var(--sw-fw-semibold);
    }
    /* owner feedback 2026-09-29: the floor's title enters the floor, like "פתח קומה" */
    .fcard header h2 .ftitle {
      border: 0;
      padding: 0;
      background: none;
      color: inherit;
      font: inherit;
      cursor: pointer;
      text-align: start;
      border-radius: 4px;
    }
    .fcard header h2 .ftitle:hover {
      color: var(--sw-accent);
      text-decoration: underline;
      text-underline-offset: 3px;
    }
    .fcard header h2 .ftitle:focus-visible {
      outline: 2px solid var(--sw-focus, var(--sw-accent));
      outline-offset: 2px;
    }
    /* an area row is a link into the area (owner feedback 2026-09-29) */
    a.tree-row,
    a.arow {
      box-sizing: border-box;
      text-decoration: none;
    }
    .fcard header .lit {
      font-size: var(--sw-fs-xs);
      color: var(--sw-text-2);
      display: inline-flex;
      align-items: center;
      gap: 4px;
      font-variant-numeric: tabular-nums;
    }
    .fcard header .lit.warm sw-icon {
      color: var(--sw-warning);
    }
    .fcard header devices-bulk-menu {
      margin-inline-start: auto; /* the card's own header: the floor action closes the row, as in the mockup */
    }
    .fcard .rows {
      display: flex;
      flex-direction: column;
      padding: 0 6px 6px;
    }
    /* CR-007 slice 4: the building/floor "מזגני הקומה" strip */
    .climate-strip {
      display: flex;
      align-items: center;
      gap: 6px;
      flex-wrap: wrap;
      padding: 4px 10px 8px;
      font-size: var(--sw-fs-xs);
    }
    .climate-strip .lbl {
      color: var(--sw-text-3);
      flex: none;
    }
    .climate-strip .chip {
      display: inline-flex;
      align-items: center;
      gap: 4px;
      padding: 2px 8px;
      border-radius: 999px;
      background: var(--sw-surface-2);
      color: var(--sw-text-2);
      white-space: nowrap;
    }
    .climate-strip .chip.warm {
      background: var(--sw-warning-soft);
      color: var(--sw-text);
    }
    .arow {
      display: flex;
      align-items: center;
      gap: 10px;
      inline-size: 100%;
      padding: 8px;
      border: 0;
      border-block-start: 1px solid var(--sw-border);
      background: transparent;
      color: var(--sw-text);
      font: inherit;
      font-size: var(--sw-fs-sm);
      text-align: start;
      cursor: pointer;
      flex-wrap: wrap;
    }
    .arow:hover,
    .arow:focus-visible {
      background: var(--sw-surface-2);
      outline: none;
    }
    .arow .nm {
      font-weight: var(--sw-fw-medium);
      min-inline-size: 90px;
    }
    .arow .pills {
      flex: 1;
    }
    .fcard footer {
      display: flex;
      gap: 8px;
      padding: 8px 14px 12px;
      border-block-start: 1px solid var(--sw-border);
    }
    .fcard.loose {
      border-style: dashed;
    }
    @media (max-width: 899px) {
      /* the floor cards carry every row and action of the tree: on a narrow screen they are the whole screen */
      .split {
        grid-template-columns: minmax(0, 1fr);
      }
      nav.tree {
        display: none;
      }
      .fcards {
        grid-template-columns: minmax(0, 1fr);
      }
    }
    a.tile {
      display: flex;
      flex-direction: column;
      gap: 8px;
      padding: 12px 14px;
      min-block-size: 92px;
      border: 1px solid var(--sw-border);
      border-radius: var(--sw-r-md);
      background: var(--sw-surface);
      box-shadow: var(--sw-shadow-1);
      color: inherit;
      text-decoration: none;
      transition: border-color var(--sw-t-fast) var(--sw-ease), box-shadow var(--sw-t-fast) var(--sw-ease);
    }
    a.tile:hover,
    a.tile:focus-visible {
      border-color: var(--sw-border-strong);
      box-shadow: var(--sw-shadow-2);
      outline: none;
    }
    a.tile.on {
      background: linear-gradient(180deg, var(--sw-warning-soft), var(--sw-surface) 70%);
      border-color: color-mix(in srgb, var(--sw-warning) 40%, var(--sw-border));
    }
    a.tile.empty {
      background: var(--sw-surface-2);
      color: var(--sw-text-2);
    }
    a.tile.unassigned {
      border-style: dashed;
    }
    .tile-head {
      display: flex;
      align-items: center;
      gap: 8px;
    }
    .tile-head .name {
      font-weight: var(--sw-fw-semibold);
      font-size: var(--sw-fs-md);
      flex: 1;
      min-inline-size: 0;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }
    .tile-head .dot {
      inline-size: 8px;
      block-size: 8px;
      border-radius: 50%;
      background: var(--sw-warning);
      flex: none;
    }
    .pills {
      display: flex;
      flex-wrap: wrap;
      gap: 6px 10px;
      font-size: var(--sw-fs-xs);
      color: var(--sw-text-2);
    }
    .pills span {
      display: inline-flex;
      align-items: center;
      gap: 4px;
      font-variant-numeric: tabular-nums;
    }
    .pills .warm {
      color: var(--sw-text);
      font-weight: var(--sw-fw-semibold);
    }
    .pills .none {
      color: var(--sw-text-3);
    }
    .note {
      font-size: var(--sw-fs-xs);
      color: var(--sw-text-3);
    }
    @media (max-width: 767px) {
      .kpis {
        grid-template-columns: repeat(2, minmax(0, 1fr));
      }
      .areas {
        grid-template-columns: repeat(auto-fill, minmax(150px, 1fr));
      }
      .floor-sum {
        margin-inline-start: 0;
      }
    }
  `, BUILDING_GLASS];

  connectedCallback() {
    super.connectedCallback();
    this.prefsReady = loadDevicesPrefs().then((p) => {
      this.prefs = p;
      applyDevicesPrefs(this, p);
      if (!this.layoutChosen) this.layout = p.defaultView;
    });
    if (!isApi()) {
      this.tree = DEMO;
      this.sync = DEMO.sync;
      return;
    }
    if (!canAnywhere('devices.read')) {
      this.forbidden = true;
      return;
    }
    void this.load();
    this.tickTimer = window.setInterval(() => (this.tick += 1), 15_000);
    this.stop = subscribeHa(
      (m) => {
        if (m.type === 'entity_state_changed') this.scheduleReload();
        else if (m.type === 'structure_changed') {
          // an entity moved / an area renamed / a device added or removed in HA: same throttled refetch, plus a note.
          // The push of this user's own "רענן" is skipped: refreshFromHa refetches once itself.
          if (Date.now() >= this.manualUntil) this.scheduleReload();
          this.flashStructure();
        } else if (m.type === 'ha_sync_state') {
          if (this.sync) this.sync = { ...this.sync, connected: m.connected };
          this.scheduleReload();
        } else if (m.type === 'heartbeat') this.sync = m.sync;
      },
      (connected) => {
        if (connected) this.scheduleReload(); // pushes sent while the socket was down are gone: catch up now
      },
    );
  }

  disconnectedCallback() {
    super.disconnectedCallback();
    this.stop?.();
    this.stop = null;
    window.clearTimeout(this.timer);
    this.timer = 0;
    window.clearTimeout(this.flashTimer);
    window.clearInterval(this.tickTimer);
    this.flashTimer = this.tickTimer = 0;
  }

  private flashStructure() {
    this.structureFlash = true;
    window.clearTimeout(this.flashTimer);
    this.flashTimer = window.setTimeout(() => (this.structureFlash = false), STRUCTURE_FLASH_MS);
  }

  /** "רענן מ-Home Assistant": the server re-reads HA's registries; a change also arrives as structure_changed, but the
   * tree is refetched here anyway so the answer never depends on the push socket being up. */
  private async refreshFromHa() {
    if (this.refreshing) return;
    this.refreshing = true;
    this.refreshNote = '';
    this.manualUntil = Number.POSITIVE_INFINITY; // the push this request causes may arrive before its answer
    try {
      const r = await refreshDevicesFromHa();
      this.sync = r.sync;
      if (r.changed) this.flashStructure();
      else this.refreshNote = 'אין שינויים במבנה';
      await this.load();
    } catch (err) {
      this.refreshNote = describeError(err);
      // No answer (429, 502, 503 ...): nothing was refetched here, so a real HA change pushed meanwhile must not be
      // lost - stop skipping pushes at once and refetch the tree (re-review leftover).
      this.manualUntil = 0;
      this.refreshing = false;
      this.scheduleReload();
      return;
    } finally {
      if (this.refreshing) {
        this.refreshing = false;
        this.manualUntil = Date.now() + MANUAL_PUSH_GRACE_MS;
      }
    }
  }

  private scheduleReload() {
    if (this.timer) return; // a refetch is already on its way: this push rides it
    this.timer = window.setTimeout(() => {
      this.timer = 0;
      void this.load();
    }, REFRESH_WINDOW_MS);
  }

  private async load() {
    if (this.loading) {
      this.loadAgain = true;
      return;
    }
    this.loading = true;
    try {
      // the first paint already carries the installation's style and first view (no smplwise -> glass flash)
      const [t] = await Promise.all([getDevicesTree(), this.prefsReady]);
      this.tree = t;
      this.sync = t.sync;
      this.error = '';
    } catch (err) {
      if (err instanceof ApiError && err.status === 403) this.forbidden = true;
      else this.error = describeError(err);
    } finally {
      this.loading = false;
      if (this.loadAgain) {
        this.loadAgain = false;
        void this.load();
      }
    }
  }

  render() {
    const heading = 'חשמל והתקנים';
    if (this.forbidden) {
      return html`<sw-page heading=${heading} subheading="המבנה"><sw-state-panel data-devices-state="no_permission" state="forbidden" heading="אין לך הרשאת צפייה בחשמל והתקנים" hint="נדרשת ההרשאה צפייה בחשמל והתקנים. פנה למנהל המערכת."></sw-state-panel></sw-page>`;
    }
    const t = this.tree;
    if (!t) {
      return html`<sw-page heading=${heading} subheading="המבנה">${this.error
        ? html`<sw-state-panel data-devices-state="load_error" state="error" heading="לא ניתן לטעון את עץ המבנה" hint=${this.error}></sw-state-panel>`
        : html`<sw-state-panel state="loading"></sw-state-panel>`}</sw-page>`;
    }
    const floors = t.floors.filter((f) => f.floor_id !== 'none').length;
    const areas = t.floors.reduce((n, f) => n + f.areas.length, 0);
    const sub = `${floors} קומות · ${areas} אזורים · ${t.building.entities} התקנים${!isApi() ? ' · נתוני הדגמה' : ''}`;
    const connected = this.sync?.connected ?? false;
    const bulkBuilding = this.bulkAllowed && t.can_bulk === true;
    this.lay.prepare(this.layGrids(t));
    return html`<sw-page heading=${heading} subheading=${sub} wide @bulk-request=${this.onBulkRequest}>
      <div slot="actions">
        ${this.lay.renderEditButton()}
        ${t.scoped ? html`<sw-badge kind="partial" label="לפי הקומות שלך"></sw-badge>` : nothing}
        ${isApi() ? html`<sw-badge data-devices-sync kind=${connected ? 'live' : 'stale'} label=${connected ? 'מסונכרן עם Home Assistant' : 'לא מסונכרן עם Home Assistant'}></sw-badge>` : nothing}
        ${isApi() ? this.renderRefresh() : nothing}
      </div>
      ${this.error ? html`<sw-state-panel compact state="error" heading="הרענון האחרון נכשל" hint=${this.error}></sw-state-panel>` : nothing}
      ${this.renderKpis(t.building)}
      ${this.renderClimateStrip(t.building_climate, 'מזגנים בבניין')}
      <div class="toolbar">
        <span class="seg" role="group" aria-label="פריסה">פריסה:
          <span class="opts">
            <button data-layout="cards" aria-pressed=${String(this.layout === 'cards')} ?disabled=${this.lay.editing} @click=${() => this.setLayout('cards')}>כרטיסים</button>
            <button data-layout="tiles" aria-pressed=${String(this.layout === 'tiles')} ?disabled=${this.lay.editing} @click=${() => this.setLayout('tiles')}>אריחים</button>
          </span>
        </span>
        ${bulkBuilding
          ? html`<span class="bulk-buttons" data-bulk-building>
              <sw-button size="sm" icon="light" data-bulk-kind="lights_off" @click=${() => this.building('lights_off')}>כבה תאורה בלבד</sw-button>
              <sw-button size="sm" variant="danger" icon="bolt" data-bulk-kind="all_off" @click=${() => this.building('all_off')}>כבה הכל בבניין · דורש אישור</sw-button>
            </span>`
          : nothing}
      </div>
      ${!t.floors.length
        ? html`<sw-state-panel data-devices-state="empty" state="empty" heading=${t.scoped ? 'אין התקנים בקומות שלך' : 'אין קומות ואזורים מ־Home Assistant'} hint=${t.scoped ? 'רק ישויות שהוצבו על המפה של הקומות שבהרשאתך מופיעות כאן.' : 'צרו קומות ואזורים ב־Home Assistant ושייכו אליהם התקנים; העץ יתעדכן מעצמו אחרי סנכרון הרישום.'}></sw-state-panel>`
        : nothing}
      ${this.lay.renderBar()}
      ${this.layout === 'cards' ? this.renderCards(t) : this.renderTiles(t)}
      <div class="note">${this.bulkAllowed
        ? 'מצב ההתקנים כפי ש־Home Assistant מדווח אותו. פעולות מרוכזות (⋯ בקומה או באזור, והכפתורים למעלה) נפתחות תמיד בחלון אישור שמפרט מה יישלח; מנעולים, אזעקה ושחרור דלתות אינם נכללים לעולם. שליטה בהתקן בודד - במסך האזור.'
        : 'תצוגה לקריאה בלבד: מצב ההתקנים כפי ש־Home Assistant מדווח אותו. שליטה בהתקן בודד - במסך האזור.'}</div>
      ${this.bulkAllowed ? html`<devices-bulk-dialog @bulk-done=${() => void this.load()}></devices-bulk-dialog>` : nothing}
      ${this.lay.renderPanel()}
    </sw-page>`;
  }

  /** CR-007 HA refresh: the manual refresh, when the structure was last read from HA, and "מבנה עודכן" after a change. */
  private renderRefresh() {
    void this.tick; // re-rendered every 15 s so the "לפני …" lines keep up
    const timing = structureTiming(this.sync);
    return html`<span class="ha-refresh">
      ${this.structureFlash ? html`<sw-badge data-structure-changed kind="live" label="מבנה עודכן"></sw-badge>` : nothing}
      <sw-button size="sm" icon="refresh" data-devices-refresh ?disabled=${this.refreshing} @click=${() => void this.refreshFromHa()}
        >${this.refreshing ? 'מרענן…' : 'רענן מ־Home Assistant'}</sw-button
      >
      <span class="refreshed" data-devices-refreshed>${timing.changed}</span>
      ${timing.checked ? html`<span class="refreshed" data-devices-checked>· ${timing.checked}</span>` : nothing}
      ${this.refreshNote ? html`<span class="refreshed" role="status" data-devices-refresh-note>${this.refreshNote}</span>` : nothing}
    </span>`;
  }

  /** The slice-1 presentation: floor sections with area tiles (the "⋯" popover on each tile for a bulk holder). */
  private renderTiles(t: DeviceTree) {
    return html`${repeat(t.floors, (f) => f.floor_id, (f) => this.renderFloor(f))}
      ${t.unassigned.counts.entities || !t.scoped
        ? html`<section class="floor" data-floor="unassigned">
            <div class="floor-head"><h2>ללא שיוך</h2><span class="level">התקנים שאינם משויכים לאזור ב־Home Assistant</span></div>
            ${this.renderAreasGrid('areas:unassigned', html`${this.lay.wrap('area:unassigned', this.renderTile({ area_id: 'unassigned', name: t.unassigned.name, icon: null, floor_id: null, counts: t.unassigned.counts, has_camera: false }, true))}`)}
          </section>`
        : nothing}`;
  }

  /** The approved mockup's presentation: the tree panel and the floor cards. */
  private renderCards(t: DeviceTree) {
    if (!t.floors.length && !t.unassigned.counts.entities) return nothing;
    const shown = this.selected === 'all' ? t.floors : t.floors.filter((f) => f.floor_id === this.selected);
    const floors = shown.length ? shown : t.floors; // a floor that vanished from the tree: back to everything
    return html`<div class="split" data-layout-view="cards">
      ${this.renderTreePanel(t)}
      <div class=${classMap({ fcards: true, 'lay-grid': this.gridAttrs('fcards').on })} data-lay-grid="fcards" data-lay-cols=${this.gridAttrs('fcards').cols} ?data-lay-phone-preview=${this.gridAttrs('fcards').phone}>
        ${repeat(floors, (f) => f.floor_id, (f) => this.lay.wrap(`floor:${f.floor_id}`, this.renderFloorCard(f)))}
        ${(this.selected === 'all' || !shown.length) && (t.unassigned.counts.entities || !t.scoped)
          ? this.lay.wrap('floor:unassigned', html`<section class="fcard loose" data-floor-card="unassigned" data-lay-key="floor:unassigned">
              <header><h2>ללא שיוך</h2><span class="lit">${t.unassigned.counts.entities} התקנים שאינם משויכים לאזור ב־Home Assistant</span></header>
              <div class="rows">${this.renderAreaRow({ area_id: 'unassigned', name: t.unassigned.name, icon: null, floor_id: null, counts: t.unassigned.counts, has_camera: false }, 'card', true)}</div>
            </section>`)
          : nothing}
      </div>
    </div>`;
  }

  private renderTreePanel(t: DeviceTree) {
    const lit = (c: DeviceCounts) => (c.lights ? html`<span class=${classMap({ lit: true, warm: c.lights_on > 0 })} title="תאורה דולקת"><sw-icon name="light" size=${12}></sw-icon>${ltrNum(c.lights_on)}</span>` : nothing);
    return html`<nav class="tree" aria-label="עץ המבנה" data-devices-tree>
      <button class=${classMap({ 'tree-row': true, selected: this.selected === 'all' })} data-tree="all" aria-current=${this.selected === 'all' ? 'true' : 'false'} @click=${() => (this.selected = 'all')}>
        <sw-icon name="building" size=${15}></sw-icon><span class="nm">כל המבנה</span>${lit(t.building)}
      </button>
      ${repeat(
        t.floors,
        (f) => f.floor_id,
        (f) => html`<div class="tree-group" data-tree-floor=${f.floor_id}>
          <div class="tree-floor">
            <button class=${classMap({ 'tree-row': true, selected: this.selected === f.floor_id })} data-tree-select=${f.floor_id} aria-current=${this.selected === f.floor_id ? 'true' : 'false'} @click=${() => (this.selected = f.floor_id)}>
              <sw-icon name="floor" size=${14}></sw-icon><span class="nm">${bidi(f.name)}</span>${lit(f.counts)}
            </button>
            ${this.bulkAllowed && f.can_bulk
              ? html`<devices-bulk-menu scope="floor" .targetId=${f.floor_id} .targetName=${f.name} .counts=${f.counts} variant="menu" label="פעולות לקומה" data-bulk-floor=${f.floor_id}></devices-bulk-menu>`
              : nothing}
          </div>
          ${repeat(f.areas, (a) => a.area_id, (a) => this.renderAreaRow(a, 'tree'))}
        </div>`,
      )}
    </nav>`;
  }

  /** CR-007 slice 4: "מזגני הקומה" / the building's own strip - mode + target only, never the full climate card
   * (that lives on the area screen). Compact chips, read-only here. */
  private renderClimateStrip(list: ClimateSummary[], label: string) {
    if (!list.length || !this.prefs.showClimateStrip) return nothing;
    return html`<div class="climate-strip" data-climate-strip>
      <span class="lbl">${label}:</span>
      ${list.map(
        (c) => html`<span class=${classMap({ chip: true, warm: c.hvac_mode !== null && c.hvac_mode !== 'off' })} data-climate=${c.entity_id} title=${c.name}>
          <sw-icon name="activity" size=${12}></sw-icon>${bidi(c.name)} · ${c.hvac_mode ? (HVAC_HE[c.hvac_mode] ?? c.hvac_mode) : '—'}${c.target_temperature !== null && c.target_temperature !== undefined ? ` · ${ltrNum(c.target_temperature)}°` : ''}
        </span>`,
      )}
    </div>`;
  }

  private renderFloorCard(f: DeviceFloor) {
    const c = f.counts;
    const it = this.lay.item(`floor:${f.floor_id}`); // CR-007 6b: the layout's own title and icon
    return html`<section class="fcard" data-floor-card=${f.floor_id} data-lay-key=${`floor:${f.floor_id}`}>
      <header>
        ${it?.icon ? html`<sw-icon class="lay-title-icon" .name=${it.icon} size=${16}></sw-icon>` : nothing}
        <h2><button type="button" class="ftitle" data-floor-title=${f.floor_id} aria-current=${this.selected === f.floor_id ? 'true' : 'false'} title="פתח קומה" @click=${() => (this.selected = f.floor_id)}>${bidi(titleOf(it, f.name))}</button></h2>
        ${c.lights ? html`<span class=${classMap({ lit: true, warm: c.lights_on > 0 })} data-lit=${c.lights_on}><sw-icon name="light" size=${13}></sw-icon>${ltrNum(c.lights_on)} דולקות מתוך ${ltrNum(c.lights)}</span>` : nothing}
        ${this.bulkAllowed && f.can_bulk
          ? html`<devices-bulk-menu scope="floor" .targetId=${f.floor_id} .targetName=${f.name} .counts=${c} variant="menu" triggerLabel="כבה קומה" data-floor-menu=${f.floor_id}></devices-bulk-menu>`
          : nothing}
      </header>
      ${this.renderClimateStrip(f.climate, 'מזגני הקומה')}
      <div class="rows">
        ${f.areas.length ? repeat(f.areas, (a) => a.area_id, (a) => this.renderAreaRow(a, 'card')) : html`<div class="arow" style="cursor:default">אין אזורים בקומה</div>`}
      </div>
      ${this.selected !== f.floor_id
        ? html`<footer><sw-button size="sm" icon="floor" data-open-floor=${f.floor_id} @click=${() => (this.selected = f.floor_id)}>פתח קומה</sw-button></footer>`
        : html`<footer><sw-button size="sm" variant="ghost" data-open-floor="all" @click=${() => (this.selected = 'all')}>כל המבנה</sw-button></footer>`}
    </section>`;
  }

  /** One area as a row (tree panel or floor card): a link into the area, with the area popover as its hover / focus
   * summary and its "⋯" (owner feedback 2026-09-29); the tree row also carries a hover "כבה אזור" for a bulk holder.
   * The unassigned bucket is a plain link to its screen (it is not an area). */
  private renderAreaRow(a: DeviceArea, where: 'tree' | 'card', unassigned = false) {
    const c = a.counts;
    const on = anythingOn(c);
    const href = `#/devices/areas/${encodeURIComponent(a.area_id)}`;
    const bulk = !unassigned && this.bulkAllowed && a.can_bulk === true;
    const pills = this.pillsShown(c);
    const body =
      where === 'tree'
        ? html`<span class=${classMap({ sdot: true, on })}></span><span class="nm">${bidi(a.name)}</span><span class=${classMap({ lit: true, warm: c.lights_on > 0 })} title="תאורה דולקת"><sw-icon name="light" size=${12}></sw-icon>${ltrNum(c.lights_on)}</span>`
        : html`<span class=${classMap({ sdot: true, on })}></span><span class="nm">${bidi(a.name)}</span>
            <span class="pills">${pills.length
              ? pills.map((p) => html`<span class=${classMap({ warm: p.warm })} title=${p.label}><sw-icon .name=${p.icon} size=${12}></sw-icon>${p.on === null ? p.total : `${p.on}/${p.total}`}</span>`)
              : html`<span class="none">אין התקנים</span>`}${c.alarm ? html`<span class=${classMap({ warm: c.alarm !== 'disarmed' })} title="אזעקה"><sw-icon name="shield" size=${12}></sw-icon>${ALARM_HE[c.alarm] ?? c.alarm}</span>` : nothing}</span>`;
    const attrs = { area: a.area_id, on: String(on), counts: countsAttr(pills) };
    if (unassigned) {
      return html`<a class=${where === 'tree' ? 'tree-row' : 'arow'} href=${href} data-area-row=${attrs.area} data-on=${attrs.on} data-counts=${attrs.counts} style="text-decoration:none">${body}</a>`;
    }
    const menu = html`<devices-bulk-menu block hover scope="area" .targetId=${a.area_id} .targetName=${a.name} .counts=${c} variant="popover" align="start" .actions=${bulk} openHref=${href} label="סיכום האזור"
        data-tree-area=${where === 'tree' ? a.area_id : nothing} data-card-area=${where === 'card' ? a.area_id : nothing}>
        <a slot="trigger" class=${where === 'tree' ? 'tree-row' : 'arow'} href=${href} data-area-row=${attrs.area} data-on=${attrs.on} data-counts=${attrs.counts} aria-label=${`${a.name} · ${c.entities} התקנים · כניסה לאזור`}>${body}</a>
      </devices-bulk-menu>`;
    if (where === 'card') return menu;
    return html`<div class="tree-area">
      ${menu}
      ${bulk
        ? html`<span class="quick"><sw-button size="sm" variant="ghost" icon="bolt" data-quick-off=${a.area_id} label=${`כבה אזור: ${a.name}`} @click=${() => void this.dialog?.show({ scope: 'area', id: a.area_id, name: a.name, kind: 'all_off' })}>כבה אזור</sw-button></span>`
        : nothing}
    </div>`;
  }

  private renderKpis(c: DeviceCounts) {
    // owner feedback 2026-09-29: a domain the installation has nothing of is not a counter at all (no "0/0 אין במבנה")
    const kpi = (label: string, on: number, total: number, icon: IconName, warm = true) =>
      total === 0 ? nothing : html`<sw-kpi data-kpi=${label} data-value=${`${on}/${total}`} label=${label} value=${`${on}/${total}`} .icon=${icon} tone=${warm && on > 0 ? 'live' : 'neutral'}></sw-kpi>`;
    return html`<div class="kpis">
      ${kpi('תאורה דולקת', c.lights_on, c.lights, 'light')}
      ${kpi('מתגים פעילים', c.switches_on, c.switches, 'bolt')}
      ${kpi('תריסים פתוחים', c.covers_open, c.covers, 'layers')}
      ${kpi('מיזוג פעיל', c.climate_active, c.climate, 'activity')}
      ${kpi('מסכים דולקים', c.media_on, c.media, 'play')}
      ${c.locks ? html`<sw-kpi data-kpi="נעולים" data-value=${`${c.locks_locked}/${c.locks}`} label="מנעולים נעולים" value=${`${c.locks_locked}/${c.locks}`} icon="lock" tone=${c.locks_locked === c.locks ? 'live' : 'stale'} detail=${c.locks_locked === c.locks ? 'הכול נעול' : 'יש מנעול פתוח'}></sw-kpi>` : nothing}
      ${c.alarm ? html`<sw-kpi data-kpi="אזעקה" label="אזעקה" value=${ALARM_HE[c.alarm] ?? c.alarm} icon="shield" tone=${alarmTone(c.alarm)}></sw-kpi>` : nothing}
    </div>`;
  }

  private renderFloor(f: DeviceFloor) {
    const pills = this.pillsShown(f.counts);
    return html`<section class="floor" data-floor=${f.floor_id}>
      <div class="floor-head">
        <h2>${bidi(f.name)}</h2>
        ${f.level !== null && f.floor_id !== 'none' ? html`<span class="level">מפלס ${ltrNum(f.level)}</span>` : nothing}
        <span class="level">${f.areas.length} אזורים</span>
        ${this.bulkAllowed && f.can_bulk
          ? html`<devices-bulk-menu scope="floor" .targetId=${f.floor_id} .targetName=${f.name} .counts=${f.counts} variant="menu" align="start" label="פעולות לקומה" data-bulk-floor=${f.floor_id}></devices-bulk-menu>`
          : nothing}
        <div class="floor-sum">
          ${pills.map((p) => html`<span class=${classMap({ warm: p.warm })} title=${p.label}><sw-icon .name=${p.icon} size=${13}></sw-icon>${p.on === null ? p.total : `${p.on}/${p.total}`}</span>`)}
          ${f.counts.alarm ? html`<span class=${classMap({ warm: f.counts.alarm !== 'disarmed' })} title="אזעקה"><sw-icon name="shield" size=${13}></sw-icon>${ALARM_HE[f.counts.alarm] ?? f.counts.alarm}</span>` : nothing}
        </div>
      </div>
      ${this.renderClimateStrip(f.climate, 'מזגני הקומה')}
      ${this.renderAreasGrid(`areas:${f.floor_id}`, html`${repeat(f.areas, (a) => a.area_id, (a) => this.lay.wrap(`area:${a.area_id}`, this.renderTile(a)))}`)}
    </section>`;
  }

  /** A floor's area tiles: the automatic grid, or (CR-007 6b) the laid-out one. */
  private renderAreasGrid(id: string, content: unknown) {
    const g = this.gridAttrs(id);
    return html`<div class=${classMap({ areas: true, 'lay-grid': g.on })} data-lay-grid=${id} data-lay-cols=${g.cols} ?data-lay-phone-preview=${g.phone}>${content}</div>`;
  }

  private renderTile(a: DeviceArea, unassigned = false) {
    const c = a.counts;
    const pills = this.pillsShown(c);
    const on = anythingOn(c);
    const bulk = !unassigned && this.bulkAllowed && a.can_bulk === true;
    const it = this.lay.item(`area:${a.area_id}`); // CR-007 6b: the layout's own title and icon
    return html`<div class=${classMap({ 'tile-wrap': true, bulk })} data-lay-key=${`area:${a.area_id}`}><a
      class=${classMap({ tile: true, on, empty: c.entities === 0, unassigned })}
      href=${`#/devices/areas/${encodeURIComponent(a.area_id)}`}
      data-area=${a.area_id}
      data-on=${String(on)}
      data-counts=${pills.map((p) => `${p.key}:${p.on === null ? p.total : `${p.on}/${p.total}`}`).join(' ')}
      aria-label=${`${a.name} · ${c.entities} התקנים`}
    >
      <div class="tile-head">
        <sw-icon .name=${it?.icon ?? (unassigned ? 'help' : 'home')} size=${16}></sw-icon>
        <span class="name">${bidi(titleOf(it, a.name))}</span>
        ${on ? html`<span class="dot" title="יש התקן פעיל"></span>` : nothing}
      </div>
      <div class="pills">
        ${pills.length
          ? pills.map((p) => html`<span class=${classMap({ warm: p.warm })} title=${p.label}><sw-icon .name=${p.icon} size=${12}></sw-icon>${p.on === null ? p.total : `${p.on}/${p.total}`}</span>`)
          : html`<span class="none">אין התקנים</span>`}
        ${c.alarm ? html`<span class=${classMap({ warm: c.alarm !== 'disarmed' })} title="אזעקה"><sw-icon name="shield" size=${12}></sw-icon>${ALARM_HE[c.alarm] ?? c.alarm}</span>` : nothing}
      </div>
    </a>${bulk
      ? html`<devices-bulk-menu scope="area" .targetId=${a.area_id} .targetName=${a.name} .counts=${c} variant="popover" label="פעולות לאזור" data-bulk-area=${a.area_id}></devices-bulk-menu>`
      : nothing}</div>`;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'devices-building': DevicesBuilding;
  }
}
