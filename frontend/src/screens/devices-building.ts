import { LitElement, html, css, nothing, type PropertyValues } from 'lit';
import { customElement, state } from 'lit/decorators.js';
import { classMap } from 'lit/directives/class-map.js';
import { repeat } from 'lit/directives/repeat.js';
import '../components/sw-page';
import '../components/sw-badge';
import '../components/sw-icon';
import '../components/sw-kpi';
import { isScrollLocked } from '../components/scroll-lock';
import './area-quick-sheet'; // AREAPOPUP-297: the area quick-control pop-up (drawer / pop-up / phone sheet)
import { pressTarget, type Box, type QuickMode } from './area-quick-logic';
import { elevatorsAccess, refreshElevatorsVisibility } from '../elevators/access'; // CR-INFRA-ELEVATORS: the home tiles
import type { Elevator } from '../api/elevators';
import { refreshTemperatureVisibility, temperatureAccess } from '../temperature/access'; // CR-INFRA-TEMPERATURE phase 3: the home widget (idea 12)
import type { TempUnit } from '../api/temperature';
import { loadHomeGeneratorsChecked } from '../generator/access'; // GENWIDGET 2.9.3: the home generator widget
import { generatorsAvailable } from '../generator/home-widget-model';
import { loadHomeDoorsChecked } from '../door-windows/access'; // DOORWIN2-295: the home doors widget
import { doorsWidgetAvailable, type DoorsWidgetData } from '../door-windows/home-widget-model';
import { doorWindowsTabOn, noticesModuleOn } from '../shell/nav';
import { getBuildingPresence, type BuildingSnapshot } from '../api/building-presence'; // PRESENCE-2280: the home presence widget
import { presenceWidgetAvailable } from './building-presence-widget';
import { loadHomeNoticesChecked, noticesWidgetAvailable, noticesWidgetOffered, type NoticesWidgetData } from '../notices/home-widget'; // NOTICEPAGE-295: the home notice board widget
import type { LiveSummaryItem } from '../api/generator';
import '../components/sw-state-panel';
import '../components/sw-button';
import './devices-bulk';
import type { StateKind } from '../components/sw-badge';
import type { IconName } from '../components/sw-icon';
import { canAnywhere, isApi } from '../api/session';
import { pl } from '../i18n/polish';
import { ApiError, describeError, patch } from '../api/client';
import { getSettings } from '../api/media';
import { invalidateSettings } from '../api/prefs';
import { LiveController } from '../api/live-refresh'; // HOMELIVE-295
import { hl } from '../i18n/home-live';
import { haPushLive, subscribeHa, type HaSyncState } from '../api/ha';
import { ALARM_HE, getDevicesTree, refreshDevicesFromHa, type DeviceArea, type DeviceCounts, type DeviceFloor, type DeviceTree } from '../api/devices';
import { mapHrefForArea } from '../api/plan-links';
import { loadTree as loadCatalogTree } from '../api/catalog';
import type { Floor as PlanFloor } from '../api/types';
import './explore-floor-map';
import type { DevicesBulkMenu } from './devices-bulk';
import { bidi, ltrNum } from '../i18n/bidi';
import type { BulkKind } from '../api/device-bulk';
import type { BulkRequest, DevicesBulkDialog } from './devices-bulk';
import { applyDevicesPrefs, DEVICES_PREFS_DEFAULT, devicesStyleTokens, loadDevicesPrefs, type DevicesPrefs } from './devices-style';
import { DevicesLayoutController, titleOf, type LayoutGrid, type MeasuredGrid } from './devices-layout';
import './devices-tiles-panel';
import { ITEMS_FILTERS, type ItemsFilter } from './devices-tiles-panel';
import { TILE_KINDS, type ItemsScope, type TileKind } from '../api/devices';
import { effectiveTileSetting, TileLayoutController } from '../api/tile-layout';
import { onRouteChange, parseRoute, pushRoute, replaceRoute } from '../router';
import { phoneRestricted } from '../shell/phone';
import { notifyScreenViews, registerScreenView } from '../shell/screen-view';
import './home-widgets';
import './home-ambient-bar';
import { AMBIENT_WIDGETS } from './home-ambient-bar';
import { infoStyleFor, loadScreenDisplay, BULK_IDLE_DEFAULT, FLOOR_TITLE_LINES_DEFAULT, INFO_STYLE_DEFAULT, type BulkIdle, type FloorTitleLines, type InfoStyle } from '../api/screen-display';
import {
  areaQuick, climateQuick, effectiveScreen, floorCardsMax, floorCardsSplit, HOME_SCREEN_DEFAULT, homeAlerts, isTabletLandscape, loadHomeScreen, rowQuickMax,
  screenFormBody, showRoomTemp, summaryKindsShown, tileQuickMax, type HomeScreenForm, type HomeScreenOptions, type PersonalScreen, type QuickKind, type SummaryKind,
} from '../api/home-screen';
import { hs } from '../i18n/home-screen';
import { HOME_SCREEN_CSS } from './home-screen-css';
import './home-screen-options'; // (the phone's area sheet draws <devices-area>, defined by the shell's route table - no import here: it imports this module)
import './home-edit-panel';
import type { QuickInfo } from './home-widgets';
import {
  getHomeCandidates, HOME_DEFAULT, HOME_PERSONAL_EVENT, HOME_TITLE_DEFAULT, homeViewOf, loadHomeSettings, loadPersonal, moveAmong, NO_DATA, orderFloors, previewData, PHONE_MAX_WIDTH, resolveWidgets, saveHomeSettings, suggestConfig, widgetOn,
  type Direction, type HomeCandidates, type HomeSettings, type HomeView, type QuickAction, type WidgetId, type WidgetItem,
} from '../api/home';
import { demoHome } from './home-demo';
import { media } from '../api/media-screens';
import { hueOf, SkinController } from '../design/skin';
import { areaIndicators, effectiveRows, floorKinds, loadPersonalRow, ROW_MAX_PHONE, ROW_MAX_WIDE, splitRow, type AreaRowPersonal, type FloorItem, type Indicator } from '../api/area-row';
import { dayTimeText, timeText } from '../api/day-format';

/** Owner notes 2026-09-30: the home route's edit mode is entered by the address (`#/devices/building?edit=1`, from the
 * user menu's "עריכת המסך הראשי"), not by a button on the screen. */
export const EDIT_PARAM = 'edit';

/** How tight the screen is packed to fit the viewport without a vertical scroll (owner notes 2026-09-30, item 7): 0 = as
 * designed, 1 = smaller tiles / rows, 2 = the smallest (and the secondary strips drop). Stepped up by measuring. */
export type FitLevel = 0 | 1 | 2;
/** The packed layout is for a desktop-width screen; a phone scrolls. */
export const FIT_MIN_WIDTH = 900;

/** The nearest ancestor that scrolls vertically (crossing shadow roots) - the shell's page area. */
export function scrollParentOf(el: Element): HTMLElement | null {
  let node: Node | null = el;
  while (node) {
    const parent: Node | null = (node as Element).assignedSlot ?? node.parentNode ?? (node as ShadowRoot).host ?? null;
    if (parent instanceof HTMLElement && ['auto', 'scroll'].includes(getComputedStyle(parent).overflowY)) return parent;
    node = parent;
  }
  return null;
}

/** The count pills' keys that open the tiles' panel (cameras and sensors are counts only). */
const PILL_KIND: Partial<Record<keyof DeviceCounts, TileKind>> = { lights: 'lights', switches: 'switches', covers: 'covers', climate: 'climate', heating: 'heating', media: 'media', locks: 'locks' };

/** The panel's deep link on the building screen (owner 2026-09-29): `#/devices/building?domain=<kind>[&floor=<id> |
 * &area=<id>][&filter=active|inactive|unavailable]` - the hash-query convention of the other screens (router.ts). */
export function panelFromParams(p: URLSearchParams): { kind: TileKind; scope: ItemsScope; id: string; filter: ItemsFilter } | null {
  const kind = p.get('domain') as TileKind | null;
  if (!kind || !TILE_KINDS.includes(kind)) return null;
  const floor = p.get('floor');
  const area = p.get('area');
  const f = p.get('filter') as ItemsFilter | null;
  return { kind, scope: area ? 'area' : floor ? 'floor' : 'building', id: area ?? floor ?? '', filter: f && ITEMS_FILTERS.includes(f) ? f : 'all' };
}

export function panelParams(kind: TileKind, scope: ItemsScope, id: string, filter: ItemsFilter): URLSearchParams {
  const q = new URLSearchParams({ domain: kind });
  if (scope === 'floor') q.set('floor', id);
  if (scope === 'area') q.set('area', id);
  if (filter !== 'all') q.set('filter', filter);
  return q;
}

/** Refetches are throttled, not debounced: the first push starts a window, every push inside it rides the same
 * refetch, and a push during the fetch itself queues exactly one more (loadAgain). A screen full of sensors updating
 * several times a second therefore refreshes about every REFRESH_WINDOW_MS instead of never (a resetting debounce
 * would starve - review finding). */
export const REFRESH_WINDOW_MS = 400;
/** How long "מבנה עודכן" stays up after a structure change refetched the screen (CR-007 HA refresh). */
export const STRUCTURE_FLASH_MS = 4000;
/** How long after a manual refresh's answer its own structure_changed push is still expected. */
const INFO_CHOICES: readonly ('bar' | 'cards')[] = ['bar', 'cards']; // HOMEINFO-295: the edit bar's two explicit choices (the options form also offers auto)
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
  return `${what} ב־${dayTimeText(new Date(t))}`;
}

/** The two timing lines next to the refresh button: when the structure last CHANGED (last_structure_at) and when it
 * was last CHECKED against Home Assistant (last_registry_at - every refresh, changed or not). */
export function structureTiming(sync: HaSyncState | null | undefined, now: number = Date.now()): { changed: string; checked: string } {
  if (!sync?.last_registry_at) return { changed: 'המבנה טרם נטען', checked: '' };
  return {
    changed: agoHe('המבנה עודכן', sync.last_structure_at, now) || 'המבנה לא השתנה מאז ההפעלה',
    checked: agoHe('נבדק', sync.last_registry_at, now),
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
  if (c.climate) out.push({ key: 'climate', icon: 'snow', label: 'מיזוג פעיל', total: c.climate, on: c.climate_active, warm: c.climate_active > 0 });
  if (c.heating) out.push({ key: 'heating', icon: 'flame', label: 'חימום פעיל', total: c.heating, on: c.heating_active, warm: c.heating_active > 0 });
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

/** The demo-mode building (also the shell's phone area picker in the bubble skin reads it: no backend, fixture only). */
export const DEMO_DEVICES_TREE: DeviceTree = {
  floors: [
    {
      floor_id: 'ground', name: 'קרקע', level: 0, icon: null,
      counts: { entities: 14, lights: 6, lights_on: 3, switches: 2, switches_on: 1, covers: 2, covers_open: 1, climate: 1, climate_active: 1, heating: 0, heating_active: 0, media: 1, media_on: 0, locks: 1, locks_locked: 1, alarm: 'armed_home', cameras: 1, sensors: 2 },
      areas: [
        { area_id: 'lobby', name: 'לובי', icon: null, floor_id: 'ground', has_camera: true, counts: { entities: 8, lights: 4, lights_on: 3, switches: 1, switches_on: 1, covers: 1, covers_open: 1, climate: 1, climate_active: 1, heating: 0, heating_active: 0, media: 0, media_on: 0, locks: 1, locks_locked: 1, alarm: 'armed_home', cameras: 1, sensors: 1 }, climate: DEMO_CLIMATE, temperature: 23.5, open_count: 0 },
        { area_id: 'kitchen', name: 'מטבח', icon: null, floor_id: 'ground', has_camera: false, counts: { entities: 6, lights: 2, lights_on: 0, switches: 1, switches_on: 0, covers: 1, covers_open: 0, climate: 0, climate_active: 0, heating: 0, heating_active: 0, media: 1, media_on: 0, locks: 0, locks_locked: 0, alarm: null, cameras: 0, sensors: 1 }, climate: [], temperature: 26, open_count: 1 },
      ],
      climate: DEMO_CLIMATE,
    },
    {
      floor_id: 'first', name: 'קומה 1', level: 1, icon: null,
      counts: { entities: 5, lights: 3, lights_on: 0, switches: 0, switches_on: 0, covers: 2, covers_open: 2, climate: 0, climate_active: 0, heating: 0, heating_active: 0, media: 0, media_on: 0, locks: 0, locks_locked: 0, alarm: null, cameras: 0, sensors: 0 },
      areas: [{ area_id: 'office', name: 'משרד', icon: null, floor_id: 'first', has_camera: false, counts: { entities: 6, lights: 3, lights_on: 0, switches: 0, switches_on: 0, covers: 2, covers_open: 2, climate: 2, climate_active: 1, heating: 0, heating_active: 0, media: 0, media_on: 0, locks: 0, locks_locked: 0, alarm: null, cameras: 0, sensors: 0 },
        climate: [
          { entity_id: 'climate.office_1', name: 'מזגן משרד 1', area_name: 'משרד', hvac_mode: 'heat', hvac_action: 'heating', current_temperature: 20.5, target_temperature: 23, unit: '°C', available: true },
          { entity_id: 'climate.office_2', name: 'מזגן משרד 2', area_name: 'משרד', hvac_mode: 'off', hvac_action: 'off', current_temperature: 21, target_temperature: null, unit: '°C', available: true },
        ], temperature: null, open_count: 0 }],
      climate: [],
    },
  ],
  unassigned: { area_id: 'unassigned', name: 'ללא שיוך', counts: { entities: 1, lights: 0, lights_on: 0, switches: 1, switches_on: 0, covers: 0, covers_open: 0, climate: 0, climate_active: 0, heating: 0, heating_active: 0, media: 0, media_on: 0, locks: 0, locks_locked: 0, alarm: null, cameras: 0, sensors: 0 } },
  building: { entities: 20, lights: 9, lights_on: 3, switches: 3, switches_on: 1, covers: 4, covers_open: 3, climate: 1, climate_active: 1, heating: 0, heating_active: 0, media: 1, media_on: 0, locks: 1, locks_locked: 1, alarm: 'armed_home', cameras: 1, sensors: 2 },
  building_climate: DEMO_CLIMATE,
  scoped: false,
  sync: { connected: false, last_snapshot_at: null, last_event_at: null, last_registry_at: null, last_error: null, reconnects: 0, sequence: 0, entities: 20, started_at: null, ha_version: null },
};

const ZERO: DeviceCounts = { entities: 0, lights: 0, lights_on: 0, switches: 0, switches_on: 0, covers: 0, covers_open: 0, climate: 0, climate_active: 0, heating: 0, heating_active: 0, media: 0, media_on: 0, locks: 0, locks_locked: 0, alarm: null, cameras: 0, sensors: 0 };
function sumCounts(list: DeviceCounts[]): DeviceCounts {
  const out: DeviceCounts = { ...ZERO };
  for (const c of list) {
    for (const k of Object.keys(ZERO) as (keyof DeviceCounts)[]) if (k !== 'alarm') (out[k] as number) += c[k] as number;
    if (c.alarm === 'triggered' || (c.alarm && !out.alarm)) out.alarm = c.alarm;
  }
  return out;
}

/** HOME-295: the approved mockup's demo site (3 floors, 8 areas) for `?hs_state=` in demo mode - the evidence specs' states: `site`
 * (normal), `alarm` (the garden's alarm triggered), `offline` (no connection), `empty` (no floors yet), `many` (six floors). The plain
 * demo (no hs_state) keeps DEMO_DEVICES_TREE, which older specs and baselines read. */
export function demoTreeFor(state: string): DeviceTree {
  if (!state) return DEMO_DEVICES_TREE;
  if (state === 'empty') return { ...DEMO_DEVICES_TREE, floors: [], unassigned: { area_id: 'unassigned', name: 'ללא שיוך', counts: { ...ZERO, entities: 14, switches: 14 } }, building: { ...ZERO }, building_climate: [] };
  const alarm = state === 'alarm';
  const cl = (id: string, name: string, mode: string, target: number, cur: number) => ({ entity_id: `climate.${id}`, name, area_name: name, hvac_mode: mode, hvac_action: mode === 'off' ? 'off' : mode === 'heat' ? 'heating' : 'cooling', current_temperature: cur, target_temperature: mode === 'off' ? null : target, unit: '°C', available: true });
  const area = (floor: string, id: string, name: string, t: number, c: Partial<DeviceCounts>, climate: ReturnType<typeof cl>[] = []): DeviceArea =>
    ({ area_id: id, name, icon: null, floor_id: floor, has_camera: false, can_bulk: true, counts: { ...ZERO, ...c, entities: 6 }, climate, temperature: t, open_count: 0 });
  const floor = (id: string, name: string, level: number, areas: DeviceArea[]): DeviceFloor => ({ floor_id: id, name, level, icon: null, areas, counts: sumCounts(areas.map((a) => a.counts)), climate: areas.flatMap((a) => a.climate ?? []), can_bulk: true });
  const floors: DeviceFloor[] = [
    floor('g', 'קרקע', 0, [
      area('g', 'lobby', 'לובי', 24.5, { lights: 4, lights_on: 3, climate: 1, climate_active: 1, covers: 1, covers_open: 1, locks: 1, locks_locked: 1, sensors: 3 }, [cl('lobby', 'מזגן לובי', 'cool', 23, 24.5)]),
      area('g', 'living', 'סלון', 25.5, { lights: 4, lights_on: 2, climate: 1, climate_active: 1, covers: 3, covers_open: 1, media: 2, media_on: 1, sensors: 6, cameras: 2 }, [cl('living', 'מזגן סלון', 'cool', 22, 25.5)]),
      area('g', 'kitchen', 'מטבח', 23.1, { lights: 3, switches: 2, switches_on: 1, sensors: 2 }),
      area('g', 'study', 'חדר עבודה', 26, { lights: 2, climate: 1, covers: 1, sensors: 1 }, [cl('study', 'מזגן חדר עבודה', 'off', 24, 26)]),
    ]),
    floor('f1', 'קומה 1', 1, [
      area('f1', 'office', 'משרד', 20.5, { lights: 2, lights_on: 1, climate: 1, climate_active: 1, covers: 1, covers_open: 1, locks: 1, locks_locked: 1 }, [cl('office', 'מזגן משרד', 'heat', 22, 20.5)]),
      area('f1', 'bed', 'חדר שינה', 23.4, { lights: 3, climate: 1, covers: 1, locks: 1, locks_locked: 1 }, [cl('bed', 'מזגן חדר שינה', 'off', 23, 23.4)]),
      area('f1', 'kids', 'חדר ילדים', 24, { lights: 2, climate: 1, climate_active: 1, covers: 1, covers_open: 1 }, [cl('kids', 'מזגן ילדים', 'cool', 24, 24)]),
    ]),
    floor('yd', 'חצר', 2, [area('yd', 'garden', 'גינה', 28, { lights: 6, lights_on: 2, switches: 1, locks: 1, locks_locked: 1, cameras: 2, alarm: alarm ? 'triggered' : 'armed_away' })]),
  ];
  if (state === 'many') {
    for (const [i, n] of ['קומה 2', 'קומה 3', 'גג'].entries()) floors.push(floor(`m${i}`, n, 3 + i, [area(`m${i}`, `m${i}a`, `משרד ${i + 2}`, 22 + i, { lights: 3, lights_on: i, climate: 1, covers: 2 }, [cl(`m${i}`, `מזגן ${i + 2}`, 'off', 23, 22)])]));
  }
  const building = sumCounts(floors.map((f) => f.counts));
  building.alarm = alarm ? 'triggered' : 'armed_home';
  return { ...DEMO_DEVICES_TREE, floors, unassigned: { area_id: 'unassigned', name: 'ללא שיוך', counts: { ...ZERO, entities: 3, lights: 1, switches: 1, sensors: 1 } }, building, building_climate: floors.flatMap((f) => f.climate), can_bulk: true };
}

/** The Bubble skin (phase C, 2026-10-02; the approved board docs/design/mockups/bubble-taste/home.html): the floor cards are bare
 * groups under a separator title, every area row a pill with a hue ring, the area tiles pills too, the tree rows carry the ring;
 * `--sw-grid-min` (the density dial) sets the columns and `row` makes one column (the list view). Keyed on the host's data-skin. */
const BUILDING_BUBBLE = css`
  :host([data-skin='bubble']) .kpis {
    gap: var(--sw-gap);
  }
  :host([data-skin='bubble']) .fcards {
    grid-template-columns: repeat(auto-fill, minmax(min(100%, max(300px, var(--sw-grid-min))), 1fr));
    gap: 6px var(--sw-gap-grid);
  }
  :host([data-skin='bubble']) section.fcard {
    border: 0;
    border-radius: 0;
    background: transparent;
    box-shadow: none;
    gap: 4px;
  }
  :host([data-skin='bubble']) .fcard header {
    padding: 8px 4px 4px;
  }
  :host([data-skin='bubble']) .fcard header h2 {
    font-size: var(--sw-fs-lg);
    font-weight: var(--sw-fw-bold);
  }
  :host([data-skin='bubble']) .fh-top::after {
    content: '';
    flex: 1 1 24px;
    order: 5;
    block-size: 6px;
    border-radius: 3px;
    background: var(--sw-surface-2);
  }
  :host([data-skin='bubble']) .fcard header .fh-top devices-bulk-menu {
    order: 9;
    margin-inline-start: 0;
  }
  :host([data-skin='bubble']) .fcard .rows {
    gap: var(--sw-gap);
    padding: 0;
  }
  :host([data-skin='bubble']) .arow,
  :host([data-skin='bubble']) a.tile {
    border: 0;
    border-radius: var(--sw-r-pill);
    background: var(--sw-surface);
    box-shadow: none;
    min-block-size: calc(var(--sw-pill-h) * var(--sw-look-scale));
    padding: 4px 8px;
    gap: 10px;
    transition: background var(--sw-t-fast) var(--sw-ease);
  }
  :host([data-skin='bubble']) .arow:hover,
  :host([data-skin='bubble']) .arow:focus-visible,
  :host([data-skin='bubble']) a.tile:hover,
  :host([data-skin='bubble']) a.tile:focus-visible {
    background: var(--sw-surface-3);
    outline: none;
    box-shadow: none;
  }
  :host([data-skin='bubble']) .arow:focus-visible,
  :host([data-skin='bubble']) a.tile:focus-visible {
    outline: var(--sw-focus-w) solid var(--sw-focus);
    outline-offset: 2px;
  }
  :host([data-skin='bubble']) .arow .nm {
    font-weight: var(--sw-fw-semibold);
    font-size: calc(var(--sw-fs-name) * var(--sw-look-scale));
  }
  /* the ring: the area's hue, the lit halo when something is on */
  :host([data-skin='bubble']) .arow .sdot,
  :host([data-skin='bubble']) .tile-head .ring {
    inline-size: calc(var(--sw-icon-ring) * var(--sw-look-scale));
    block-size: calc(var(--sw-icon-ring) * var(--sw-look-scale));
    border-radius: 50%;
    background: var(--h, var(--sw-surface-2));
    color: var(--sw-ring-on-hue);
    display: grid;
    place-items: center;
    flex: none;
  }
  :host([data-skin='bubble']) .arow .sdot.on,
  :host([data-skin='bubble']) a.tile.on .ring {
    box-shadow: 0 0 0 3px var(--sw-lit-soft);
  }
  :host([data-skin='bubble']) .tree-row .sdot {
    inline-size: 22px;
    block-size: 22px;
    background: var(--h, var(--sw-surface-3));
    color: var(--sw-ring-on-hue);
    display: grid;
    place-items: center;
  }
  :host([data-skin='bubble']) .tree-row .sdot.on {
    box-shadow: 0 0 0 2px var(--sw-lit-soft);
  }
  :host([data-skin='bubble']) .tree-row.selected .sdot {
    box-shadow: 0 0 0 2px rgba(255, 255, 255, 0.5);
  }
  :host([data-skin='bubble']) .ind .i.more {
    background: var(--sw-surface-2);
  }
  :host([data-skin='bubble']) .fcard footer {
    border: 0;
    padding: 4px 4px 0;
  }
  :host([data-skin='bubble']) .fcard.loose {
    border: 0;
  }
  :host([data-skin='bubble']) .fcard.loose .arow {
    background: var(--sw-surface-2);
  }
  /* the tiles view: a pill per area with the ring at the start */
  :host([data-skin='bubble']) a.tile {
    flex-direction: row;
    align-items: center;
    min-block-size: calc(var(--sw-pill-h) * var(--sw-look-scale));
    padding: 4px 8px;
  }
  :host([data-skin='bubble']) a.tile.on {
    background: var(--sw-surface);
  }
  :host([data-skin='bubble']) a.tile .tile-head {
    flex: 1 1 auto;
    min-inline-size: 0;
  }
  :host([data-skin='bubble']) a.tile .tile-head > sw-icon,
  :host([data-skin='bubble']) a.tile .tile-head .dot {
    display: none;
  }
  :host([data-skin='bubble']) .tile-wrap devices-bulk-menu {
    inset-block-start: 50%;
    transform: translateY(-50%);
  }
  :host([data-skin='bubble']) .areas {
    grid-template-columns: repeat(auto-fill, minmax(min(100%, var(--sw-grid-min)), 1fr));
    gap: var(--sw-gap-grid);
  }
  :host([data-skin='bubble']) .floor-head h2 {
    font-size: var(--sw-fs-lg);
    font-weight: var(--sw-fw-bold);
  }
  :host([data-skin='bubble']) button.chip,
  :host([data-skin='bubble']) .chip,
  :host([data-skin='bubble']) .fchips button.chip {
    border: 0;
    border-radius: var(--sw-r-pill);
    background: var(--sw-surface-2);
    min-block-size: var(--sw-touch-desktop);
    padding-inline: 12px;
  }
  /* the targets of the tree and the floor headers: the fold, the title, the "⋯" (the layout guard's touch dial) */
  :host([data-skin='bubble']) .tfold {
    inline-size: var(--sw-touch-desktop);
    block-size: var(--sw-touch-desktop);
    border-radius: 50%;
  }
  :host([data-skin='bubble']) .tree-area {
    padding-inline-start: calc(var(--sw-touch-desktop) - 20px);
  }
  :host([data-skin='bubble']) .fcard header h2 .ftitle {
    min-block-size: var(--sw-touch-desktop);
    min-inline-size: var(--sw-touch-desktop);
    display: inline-flex;
    align-items: center;
    justify-content: flex-start;
  }
  /* the area tile's "⋯" sits in the row, never over the tile */
  :host([data-skin='bubble']) .tile-wrap {
    flex-direction: row;
    align-items: center;
    gap: 4px;
  }
  :host([data-skin='bubble']) .tile-wrap > a.tile {
    flex: 1 1 auto;
    min-inline-size: 0;
  }
  :host([data-skin='bubble']) .tile-wrap.bulk > a.tile .tile-head {
    padding-inline-end: 0;
  }
  :host([data-skin='bubble']) .tile-wrap devices-bulk-menu {
    position: static;
    transform: none;
    flex: none;
  }
  @media (max-width: 1100px) {
    :host([data-skin='bubble']) button.chip,
    :host([data-skin='bubble']) .fchips button.chip,
    :host([data-skin='bubble']) .fcard header h2 .ftitle {
      min-block-size: 44px;
    }
    :host([data-skin='bubble']) .tfold {
      inline-size: 44px;
      block-size: 44px;
    }
  }
  :host([data-skin='bubble']) button.chip:hover,
  :host([data-skin='bubble']) button.chip:focus-visible {
    background: var(--sw-surface-3);
  }
  :host([data-skin='bubble']) .seg .opts {
    border: 0;
    border-radius: var(--sw-r-pill);
    background: var(--sw-surface-2);
    padding: 3px;
  }
  :host([data-skin='bubble']) .seg button {
    border-radius: var(--sw-r-pill);
    background: transparent;
  }
  :host([data-skin='bubble']) .seg button[aria-pressed='true'] {
    background: var(--sw-surface-solid);
  }
  :host([data-skin='bubble']) .floor-filter .opts {
    border: 0;
    border-radius: var(--sw-r-pill);
    background: var(--sw-surface-2);
    padding: 3px;
  }
  :host([data-skin='bubble']) .floor-filter button {
    border: 0;
    border-radius: var(--sw-r-pill);
    background: transparent;
    min-block-size: 36px;
  }
  :host([data-skin='bubble']) .floor-filter button[aria-pressed='true'] {
    background: var(--sw-surface-solid);
  }
`;

export type BuildingLayout = 'cards' | 'tiles' | 'plan';
export const LAYOUT_KEY = 'sw.devices.layout';

/** The viewer's own choice, or null when they never toggled (then הגדרות › חשמל והתקנים › devices.default_view decides). */
function readLayout(): BuildingLayout | null {
  try {
    const v = localStorage.getItem(LAYOUT_KEY);
    return v === 'tiles' || v === 'cards' || v === 'plan' ? v : null;
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

/** The tree panel's collapsed floors (a JSON array of floor ids), per user and device; default: every floor open. */
export const TREE_COLLAPSED_KEY = 'sw.devices.treeCollapsed';

function readCollapsed(): Set<string> {
  try {
    const v: unknown = JSON.parse(localStorage.getItem(TREE_COLLAPSED_KEY) ?? '[]');
    return new Set(Array.isArray(v) ? v.filter((x): x is string => typeof x === 'string') : []);
  } catch {
    return new Set();
  }
}

function writeCollapsed(ids: Set<string>) {
  try {
    localStorage.setItem(TREE_COLLAPSED_KEY, JSON.stringify([...ids]));
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
    /* owner 2026-09-29: a wide screen gives the tree (and its area names) more room */
    grid-template-columns: clamp(var(--dv-tree-inline), 16vw, var(--dv-tree-inline-max, 340px)) minmax(0, 1fr);
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

/** Owner 2026-09-29: the compact summary tiles (ui.tile_layout, `data-tile-layout` on the host) - the building's counters
 * and the area tiles of the "אריחים" view as rectangles, icon beside the value. Every size is a `--dv-kpi-*` knob
 * (styles/devices-themes.ts); placed after the glass and density rules so it wins over both. */
const TILE_LAYOUT = css`
  :host([data-tile-layout='compact']) .kpis {
    grid-template-columns: repeat(auto-fill, minmax(var(--dv-kpi-compact-col-min), 1fr));
    grid-auto-rows: 1fr; /* review low: every compact tile as tall as the tallest */
    gap: var(--dv-kpi-compact-grid-gap);
  }
  :host([data-tile-layout='compact']) sw-kpi {
    min-block-size: var(--dv-kpi-compact-min-block);
    padding-block: var(--dv-kpi-compact-pad-block);
    padding-inline: var(--dv-kpi-compact-pad-inline);
    column-gap: var(--dv-kpi-compact-gap);
    row-gap: 0;
  }
  :host([data-tile-layout='compact']) .areas {
    grid-template-columns: repeat(auto-fill, minmax(var(--dv-kpi-compact-col-min), 1fr));
    gap: var(--dv-kpi-compact-grid-gap);
  }
  :host([data-tile-layout='compact']) a.tile {
    min-block-size: var(--dv-kpi-compact-min-block);
    padding-block: var(--dv-kpi-compact-pad-block);
    padding-inline: var(--dv-kpi-compact-pad-inline);
    gap: 4px;
  }
  :host([data-tile-layout='compact'][data-devices-style='glass']) .tile-head > sw-icon {
    inline-size: var(--dv-kpi-compact-icon);
    block-size: var(--dv-kpi-compact-icon);
    padding: calc(var(--dv-icon-ring-pad) - 2px);
  }
  @media (max-width: 599px) {
    :host([data-tile-layout='compact']) .kpis,
    :host([data-tile-layout='compact']) .areas {
      grid-template-columns: repeat(var(--dv-kpi-compact-cols-phone), minmax(0, 1fr));
    }
    /* an odd last tile takes the whole row */
    :host([data-tile-layout='compact']) .kpis > sw-kpi:last-child:nth-child(odd) {
      grid-column: 1 / -1;
    }
  }
`;

/** Owner notes 2026-09-30: the home screen's own compact layout - the header row, the small summary tiles, the packed
 * "אריחים" view beside the tree, the fit steps (`data-fit`) and edit mode's card. Declared after the glass / density /
 * tile-shape rules on purpose: at equal specificity it wins over them. */
const HOME_LAYOUT = css`
  .hdr {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    justify-content: flex-end;
    gap: 6px 10px;
    min-inline-size: 0;
  }
  .ha-refresh {
    gap: 6px;
    flex-wrap: nowrap;
  }
  /* POLISH-295: the info bar sits first in the header row and gives way (it clips its own text) before the refresh icon does */
  .hdr home-ambient-bar {
    flex: 0 1 auto;
    min-inline-size: 0;
  }
  /* POLISH-295: a counter that has something on takes its kind's colour (sw-kpi --sw-kpi-on-*): light, switches and screens warm,
     cooling cool, heating amber; covers and locks keep the live green */
  sw-kpi[data-tile-kind='lights'],
  sw-kpi[data-tile-kind='switches'],
  sw-kpi[data-tile-kind='media'] {
    --sw-kpi-on-bg: var(--sw-lit-soft);
    --sw-kpi-on-fg: var(--sw-warning-text);
  }
  /* the owner's explicit "compact" tile choice stays compact: one label line, the 18 px numeral, the knobs' own height */
  :host([data-tile-layout='compact']) .kpis[data-kpis] > sw-kpi[data-kpi][layout='compact'] {
    --sw-kpi-label-lines: 1;
    --sw-kpi-compact-value-fs: var(--sw-fs-xl);
    min-block-size: var(--dv-kpi-compact-min-block);
    padding-block: var(--dv-kpi-compact-pad-block);
  }
  /* HOMEFABLE-297: the display size is for numerals; the alarm tile's value is a word ("armed (home)") and keeps the 16 px reading size, so a
     wrapped state never stretches the whole counter row */
  :host .kpis[data-kpis] > sw-kpi[data-tile-kind='alarm'][layout='compact'] {
    --sw-kpi-compact-value-fs: var(--sw-fs-lg);
  }
  sw-kpi[data-tile-kind='climate'] {
    --sw-kpi-on-bg: var(--sw-accent-soft);
    --sw-kpi-on-fg: var(--sw-accent-text);
  }
  sw-kpi[data-tile-kind='heating'] {
    --sw-kpi-on-bg: var(--sw-warning-soft);
    --sw-kpi-on-fg: var(--sw-warning-text);
  }
  /* the widgets (home redesign): direction a puts the band above the summary tiles, c a compact row, b a column beside the
     floors (the tree becomes a floor filter in the toolbar row); a phone gets a snap row above the tiles */
  .page-body {
    display: flex;
    flex-direction: column;
    gap: 16px;
    min-inline-size: 0;
  }
  .kpis[data-kpis] {
    grid-auto-rows: minmax(44px, 1fr);
  }
  .page-body[data-fit='1'],
  .page-body[data-fit='2'] {
    gap: 8px;
  }
  .bgrid {
    display: grid;
    grid-template-columns: minmax(0, 1fr) var(--side-w, 300px);
    gap: 18px;
    align-items: start;
    min-inline-size: 0;
  }
  .bgrid[data-side='start'] {
    grid-template-columns: var(--side-w, 300px) minmax(0, 1fr);
  }
  .bgrid[data-side='start'] > .bside {
    order: -1;
  }
  .bmain {
    display: flex;
    flex-direction: column;
    gap: 14px;
    min-inline-size: 0;
  }
  .bgrid[data-fit='1'] .bmain {
    gap: 10px;
  }
  .floor-filter {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    font-size: var(--sw-fs-xs);
    color: var(--sw-text-3);
    flex-wrap: wrap;
  }
  .floor-filter .opts {
    display: inline-flex;
    flex-wrap: wrap;
    border: 1px solid var(--sw-border-strong);
    border-radius: var(--sw-r-sm);
    overflow: hidden;
  }
  .floor-filter button {
    border: 0;
    padding: 5px 12px;
    background: var(--sw-surface);
    color: var(--sw-text);
    font: inherit;
    font-size: var(--sw-fs-sm);
    cursor: pointer;
  }
  .floor-filter button + button {
    border-inline-start: 1px solid var(--sw-border-strong);
  }
  .floor-filter button:hover {
    background: var(--sw-hover-wash);
  }
  .floor-filter button:focus-visible {
    outline: var(--sw-focus-w) solid var(--sw-focus);
    outline-offset: -2px;
  }
  .floor-filter button[aria-pressed='true'] {
    background: var(--sw-accent);
    color: var(--sw-text-inverse);
  }
  .split[data-no-tree] {
    grid-template-columns: minmax(0, 1fr);
  }
  @media (max-width: 899px) {
    .bgrid,
    .bgrid[data-side='start'] {
      grid-template-columns: minmax(0, 1fr);
    }
  }
  /* the summary tiles: small rectangles, the icon at the end of the text */
  :host .kpis[data-kpis] {
    grid-template-columns: repeat(auto-fit, minmax(140px, 1fr));
    grid-auto-rows: auto;
    gap: 10px;
  }
  /* HOMEFABLE-297 (impeccable typeset, taste-skill §5 "the figure leads"): the counter is a display numeral (the type scale's 2xl, 800,
     tight), its label a full 12 px line under it (two lines before an ellipsis, never "תאורה..."), the icon a quiet 30 px mark; the
     tile is a tone step DOWN from the floor cards (surface-2, a hairline, no shadow) so the floors read as the page's objects */
  :host .kpis[data-kpis] > sw-kpi[data-kpi][layout='compact'] {
    --sw-kpi-compact-icon: 30px;
    --sw-kpi-compact-value-fs: var(--sw-fs-2xl);
    --sw-kpi-label-lines: 2;
    min-block-size: 56px;
    padding-block: 5px;
    padding-inline: 12px;
    column-gap: 10px;
    row-gap: 0;
  }
  /* "אריחים": the floors as packed sections beside the tree - floors with few areas share a row */
  .floors {
    --tw: 172px;
    --th: 78px;
    display: flex;
    flex-wrap: wrap;
    align-items: flex-start;
    align-content: flex-start;
    gap: 8px 14px;
    min-inline-size: 0;
  }
  .floors > section.floor {
    margin: 0;
    gap: 6px;
    flex: var(--n, 3) 1 calc(var(--n, 3) * var(--tw) + (var(--n, 3) - 1) * 8px);
    min-inline-size: min(100%, var(--tw));
    max-inline-size: 100%;
  }
  .floors > section.floor.laid {
    flex: 1 1 100%;
  }
  :host .floors .areas:not(.lay-grid) {
    grid-template-columns: repeat(auto-fill, minmax(var(--tw), 1fr));
    gap: 8px;
  }
  :host .floors a.tile {
    min-block-size: var(--th);
    padding-block: var(--tpad, 10px);
    padding-inline: 10px;
    gap: 4px;
  }
  :host([data-devices-density='compact']) .floors {
    --tpad: 6px;
    --th: 62px;
  }
  .floors .floor-head h2 {
    font-size: var(--sw-fs-md);
  }
  .split[data-layout-view='tiles'] > .floors {
    align-self: start;
  }
  /* the floor card's header is two rows: the title with the floor action, then the counts (home redesign) */
  .fcard header {
    flex-direction: column;
    flex-wrap: nowrap; /* a wrapping column sizes its one line by the widest row: a long chip row then pushed the floor action out of the card */
    align-items: stretch;
    gap: 6px;
  }
  .fh-top,
  .fh-chips {
    display: flex;
    align-items: center;
    gap: 8px;
    flex-wrap: wrap;
    min-inline-size: 0;
  }
  @media (max-width: 767px) {
    /* the floor header's chips stay on one line (release 0.1.149); a long list scrolls sideways instead of wrapping */
    .fh-chips {
      flex-wrap: nowrap;
      overflow-x: auto;
      scrollbar-width: none;
    }
    .fh-chips::-webkit-scrollbar {
      display: none;
    }
    .fh-chips > *,
    .fchips {
      flex: none;
    }
    .fchips {
      flex-wrap: nowrap;
    }
  }
  .fh-top .lay-title-icon {
    flex: none;
  }
  .fcard header .fh-top devices-bulk-menu {
    margin-inline-start: auto;
  }
  /* fit step 1: smaller tiles and rows */
  .split[data-fit='1'] .floors {
    --tw: 156px;
    --th: 60px;
    gap: 6px 12px;
  }
  .split[data-fit='1'] .floors a.tile {
    padding-block: 6px;
    padding-inline: 8px;
    gap: 2px;
  }
  .split[data-fit='1'] .floor-head .level {
    display: none;
  }
  .split[data-fit='1'] .fcard header {
    padding-block: 8px 4px;
  }
  .split[data-fit='1'] .arow {
    padding-block: 4px;
  }
  .split[data-fit='1'] .fcard footer {
    padding-block: 4px 8px;
  }
  .split[data-fit='1'] .tree-row {
    padding-block: 3px;
  }
  /* fit step 2: the smallest */
  .split[data-fit='2'] .floors {
    --tw: 140px;
    --th: 0px;
    gap: 4px 10px;
  }
  .split[data-fit='2'] .floors a.tile {
    padding-block: 4px;
    padding-inline: 8px;
    gap: 0;
  }
  .split[data-fit='2'] .fcard footer,
  .split[data-fit='2'] .floor-head .level {
    display: none;
  }
  .split[data-fit='2'] .arow {
    padding-block: 2px;
  }
  @media (max-width: 899px) {
    .floors {
      --tw: 150px;
    }
    .floors > section.floor {
      flex: 1 1 100%;
    }
  }
`;

function anythingOn(c: DeviceCounts): boolean {
  return c.lights_on + c.switches_on + c.covers_open + c.climate_active + c.heating_active + c.media_on > 0;
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
  /** CR-015: how many approved screens this user may see (media.read); null = not known yet / not readable. Feeds `resolveWidgets`. */
  @state() private mediaScreens: number | null = null;
  /** CR-INFRA-ELEVATORS: the elevators the viewer sees (empty = no tiles at all; null = not read yet). */
  @state() private elevators: Elevator[] | null = null;
  @state() private elevatorsStale = false;
  /** CR-INFRA-TEMPERATURE phase 3: the temperature units for the home widget (empty = no widget; the installation may switch it off). */
  @state() private tempUnits: TempUnit[] = [];
  @state() private tempStale = false;
  @state() private tempWidget = false;
  /** GENWIDGET 2.9.3: the generators the viewer sees (empty = no widget at all). */
  @state() private generators: LiveSummaryItem[] = [];
  /** DOORWIN2-295: the doors widget's data (none = no widget at all); polled by the HOMELIVE-295 live controller below. */
  @state() private doorsData: DoorsWidgetData = { windows: null, emergency: null };
  /** NOTICEPAGE-295: the notices widget's data (none = no widget at all); polled by the live controller below. */
  @state() private noticesData: NoticesWidgetData = { notices: null, emptyMode: 'hide' };
  /** PRESENCE-2280: the building presence answer (null = not read, or the caller may not see it: then there is no presence widget at all). */
  @state() private presenceSnap: BuildingSnapshot | null = null;
  /** HOMELIVE-295: ONE controller for every live read of this screen (the tree, the elevators, the temperature units, the generators): polls
   * only while the page is visible and online, catches up on visibility / focus / pageshow / online, backs off on failures (api/live-refresh.ts). */
  private readonly live = new LiveController();
  /** The sources whose FIRST read failed: they keep being polled (a phone that woke up offline must recover without a manual refresh). */
  private readonly firstReadFailed = new Set<string>();
  /** The last tree read failed while an older tree is on screen: shown as the tiny stale dot on the refresh button. */
  private treeFailed = false;
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
  /** POLISH-295: the clock, the weather, Shabbat and the alarm as a thin header bar (default) or as the large cards (home.info_style). */
  @state() private infoStyle: InfoStyle = INFO_STYLE_DEFAULT;
  /** POLISH-CONTROL-297 (owner decisions 2026-10-27): the floor-name clamp of the card headers and whether an idle bulk button is disabled. */
  @state() private floorTitleLines: FloorTitleLines = FLOOR_TITLE_LINES_DEFAULT;
  @state() private bulkIdle: BulkIdle = BULK_IDLE_DEFAULT;
  /** HOMEINFO-295: may this caller change the installation's info style from the layout editor (system.configure)? Demo: yes, in memory. */
  @state() private infoCanEdit = false;
  /** The cards drawn by the last render (edit mode in the thin-bar style draws fewer than all): a drag / move index counts these. */
  private cardIds: WidgetId[] = [];
  /** K88 plan view: the plan floors of the catalogue (the map's floors, not the platform's), the chosen one, and the
   * area summary opened by a room tap. */
  @state() private planFloors: PlanFloor[] = [];
  @state() private planFloorId: string | null = null;
  @state() private planPop: { area: DeviceArea; x: number; y: number } | null = null;
  private planFloorsLoaded = false;
  /** Release 0.1.149: the user's own choice of what shows next to an area's name (a holder of screen.personalize), over prefs.areaRow. */
  @state() private personalRow: AreaRowPersonal | null = null;
  private prefsReady: Promise<void> = Promise.resolve();
  /** The tree's selection in the cards layout: every floor, or one floor id. */
  @state() private selected = 'all';
  /** The tree panel's collapsed floors (their area rows are not drawn); a floor that gets selected opens again. */
  @state() private collapsed: Set<string> = readCollapsed();
  /** Bubble phase C: the skin in force mirrored on the host (the bubble rules key on it; the rows carry a hue ring there). */
  private skin = new SkinController(this);
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
  /** Owner 2026-09-29: the summary tiles' shape (ui.tile_layout, resolved; `data-tile-layout` on the host). */
  private tiles = new TileLayoutController(this);
  /** The tiles' panel: which kind, over which scope (null = closed). Mirrors the route's `domain` / `floor` / `area`. */
  @state() private panel: { kind: TileKind; scope: ItemsScope; id: string; name: string; filter: ItemsFilter } | null = null;
  private offRoute: (() => void) | null = null;
  /** The panel's history entry was pushed by this screen (Back / close go back over it). */
  private pushedPanel = false;
  /** Owner notes 2026-09-30: the installation's home settings (title, floor order, widgets) as saved, and - only while the
   * layout editor is open - the draft being edited next to the layout (saved together by "שמור"). */
  @state() private homeSaved: HomeSettings = HOME_DEFAULT;
  @state() private homeDraft: HomeSettings | null = null;
  /** What the draft started from (its floor order is the full current order, so a reorder is a plain comparison). */
  private homeBase: HomeSettings = HOME_DEFAULT;
  @state() private candidates: HomeCandidates | null = null;
  @state() private candidatesError = '';
  /** How tight the tiles / rows are packed so the whole screen fits the viewport (FitLevel). */
  @state() private fit: FitLevel = 0;
  /** `?edit=1` was seen and acted on (entered, or refused): not again until the parameter goes and comes back. */
  private editHandled = false;
  private wasEditing = false;
  private fitTimer = 0;
  /** The widget whose settings are open in edit mode (a card's "הגדרות" button, or its row). */
  @state() private openWidget: WidgetId | '' = '';

  // ---------------------------------------------------------------------------------- HOME-295 (owner answers on the home mockup round 2)
  /** The installation's display options (home.screen) and this user's own (home.personal.screen, screen.personalize). */
  @state() private screenSite: HomeScreenOptions = HOME_SCREEN_DEFAULT;
  @state() private screenPersonal: PersonalScreen = {};
  /** The screen editor's draft of the options (saved with "שמור", like the rest of the editor). */
  @state() private screenDraft: HomeScreenForm | null = null;
  private screenBase: HomeScreenForm | null = null;
  /** Phone: the floor tree in a bottom sheet. */
  @state() private treeSheet = false;
  /** AREAPOPUP-297: the area quick-control pop-up - the pressed area, its shape (home.screen.desktop_area / phone_area) and where it grows from. */
  @state() private quick: { area: DeviceArea; floorName: string; mode: QuickMode; origin: Box | null } | null = null;
  /** The alert rows the viewer confirmed ("אישור"): hidden until the alarm clears and triggers again. */
  @state() private acked: string[] = [];
  /** The area whose blinds' open / stop / close choice is open (tile_blinds = pct). */
  @state() private coverMenu = '';
  /** The tree's "more floors" list is open (many_floors = more). */
  @state() private treeMore = false;
  /** Demo only (`?hs_state=alarm|offline|empty|many`): the states of the approved mockup without a backend, for the evidence specs. */
  private demoState = '';

  /** The options this viewer sees: the editor's draft while editing, else the installation's with his own laid over them. */
  private get screen(): HomeScreenOptions {
    if (this.lay.editing && this.screenDraft) return this.screenDraft.screen;
    return effectiveScreen(this.screenSite, this.screenPersonal);
  }

  /** No connection: the server cannot be read, or Home Assistant is disconnected (the values on screen are the last ones, grey). */
  private get offline(): boolean {
    if (!isApi()) return this.demoState === 'offline';
    return this.treeFailed || this.sync?.connected === false;
  }

  /** CR-007 6b: the building screen's layout (one per installation: floor cards and area tiles; system.configure edits). */
  private lay = new DevicesLayoutController(this, {
    scope: 'building',
    id: () => 'main',
    screenName: () => (this.layout === 'cards' ? 'מסך המבנה ‹ כרטיסי קומה' : 'מסך המבנה ‹ אריחי אזורים'),
    measure: () => this.measureGrids(),
    defaultH: (key) => (key.startsWith('floor:') ? 30 : 14),
    label: (key) => this.layLabel(key),
    compact: () => this.prefs.density === 'compact',
    onEnter: () => {
      this.selected = 'all';
      this.beginHomeEdit();
    },
    barExtra: () => this.renderInfoChoice(),
    extras: {
      dirty: () => this.homeDirty,
      save: () => this.saveHome(),
      discard: () => {
        this.homeDraft = null;
        this.screenDraft = null;
      },
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
    notifyScreenViews();
  }

  /** The count pills a tile / row / floor shows (the sensors count hides with devices.show_sensors = false). */
  private pillsShown(c: DeviceCounts): CountPill[] {
    const all = pillsOf(c);
    return this.prefs.showSensors ? all : all.filter((p) => p.key !== 'sensors');
  }

  /** Release 0.1.149: the installation's choice of what shows next to an area's name and in a floor's header, with the user's own
   * (screen.personalize) laid over it. */
  private get rows() {
    return effectiveRows(this.prefs.areaRow, this.prefs.floorRow, this.personalRow);
  }

  /** The floor header's chips in the floor row's order: pills of the kinds the row lists (cameras are a pill of their own). */
  private floorPills(c: DeviceCounts): CountPill[] {
    const all = new Map(pillsOf(c).map((p) => [p.key as string, p]));
    return floorKinds(c, this.rows.floor.items, this.prefs.showSensors).map((k) => all.get(k)).filter((p): p is CountPill => !!p);
  }

  private hasFloorItem(k: FloorItem): boolean {
    return this.rows.floor.items.includes(k);
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

  /** A scope's display name from the tree (the panel shows the server's own name once it loads). */
  private scopeName(scope: ItemsScope, id: string): string {
    if (scope === 'building') return 'המבנה';
    if (id === 'unassigned') return 'ללא שיוך';
    const t = this.tree;
    if (scope === 'floor') return t?.floors.find((f) => f.floor_id === id)?.name ?? '';
    for (const f of t?.floors ?? []) {
      const a = f.areas.find((x) => x.area_id === id);
      if (a) return a.name;
    }
    return '';
  }

  /** Owner 2026-09-29: a summary tile / floor chip opens the tiles' panel for its kind over its scope - written to the
   * address (replaceRoute, no history entry), which the route listener turns into `panel`. */
  private openPanel(kind: TileKind, scope: ItemsScope = 'building', id = '') {
    if (this.lay.editing) return; // the layout editor owns the screen
    this.panel = { kind, scope, id, name: this.scopeName(scope, id), filter: 'all' };
    // review M1: a history entry of its own, so the browser's / the phone's Back closes the panel, not the screen
    pushRoute('/devices/building', panelParams(kind, scope, id, 'all'));
    this.pushedPanel = true;
  }

  private closePanel = () => {
    const was = this.panel;
    this.panel = null;
    if (this.pushedPanel) {
      this.pushedPanel = false;
      history.back(); // the entry this screen pushed; the route listener sees the address without the panel
    } else if (was && panelFromParams(parseRoute().params)?.kind === was.kind) replaceRoute('/devices/building'); // a deep link: no entry of ours - but never over an address that already moved on
  };

  /** Re-review M3: the panel leaves for another screen - the panel's own entry is REPLACED by the target, so no Back
   * is queued behind the navigation. */
  private onPanelNavigate = (e: CustomEvent<{ path: string; params?: URLSearchParams }>) => {
    this.panel = null;
    this.pushedPanel = false;
    replaceRoute(e.detail.path, e.detail.params);
  };

  private onPanelFilter = (e: CustomEvent<ItemsFilter>) => {
    const p = this.panel;
    if (!p) return;
    this.panel = { ...p, filter: e.detail };
    replaceRoute('/devices/building', panelParams(p.kind, p.scope, p.id, e.detail));
  };

  private isOpen(kind: TileKind, scope: ItemsScope = 'building', id = ''): boolean {
    const p = this.panel;
    return !!p && p.kind === kind && p.scope === scope && (scope === 'building' || p.id === id);
  }

  // ---------------------------------------------------------------------------------- home settings (owner notes 2026-09-30, home redesign)

  /** Edit mode's own edits (title, direction, widgets, floor order) differ from what the session started with. */
  private get homeDirty(): boolean {
    const screenDirty = !!this.screenDraft && !!this.screenBase && Object.keys(screenFormBody(this.screenBase, this.screenDraft)).length > 0;
    return screenDirty || (!!this.homeDraft && JSON.stringify(this.homeDraft) !== JSON.stringify(this.homeBase));
  }

  /** The layout editor opened: the draft starts from the saved settings, with the floor order as the screen shows it now. */
  private beginHomeEdit() {
    const order = this.tree ? this.tree.floors.map((f) => f.floor_id) : this.homeSaved.floorOrder;
    this.homeBase = { ...this.homeSaved, floorOrder: order };
    this.homeDraft = JSON.parse(JSON.stringify(this.homeBase)) as HomeSettings;
    // HOME-295: the display options are edited here too (the summary tiles, the quick actions per area, ...)
    this.screenBase = { screen: this.screenSite, info: this.infoStyle, view: this.prefs.defaultView === 'tiles' ? 'tiles' : 'cards' };
    this.screenDraft = JSON.parse(JSON.stringify(this.screenBase)) as HomeScreenForm;
    this.candidates = null;
    this.candidatesError = '';
    this.openWidget = '';
    getHomeCandidates().then(
      (c) => (this.candidates = c),
      (err) => (this.candidatesError = describeError(err)),
    );
  }

  private onDraft = (e: CustomEvent<HomeSettings>) => {
    if (this.homeDraft) this.homeDraft = e.detail;
  };

  /** "שמור" in edit mode: the changed keys go to PATCH /settings (system.configure, audited); the tree is refetched so the
   * order and the widgets are the server's. A floor order equal to the one the session started with is not written. */
  private async saveHome(): Promise<void> {
    // HOME-295: the display options first (their own keys; system.configure, audited)
    const sd = this.screenDraft;
    const sb = this.screenBase;
    if (sd && sb) {
      const body = screenFormBody(sb, sd);
      if (Object.keys(body).length) {
        await patch('settings', body);
        invalidateSettings();
        this.screenSite = sd.screen;
        this.infoStyle = sd.info;
        this.prefs = { ...this.prefs, defaultView: sd.view };
        this.screenBase = JSON.parse(JSON.stringify(sd)) as HomeScreenForm;
      }
    }
    const d = this.homeDraft;
    if (!d) return;
    const orderChanged = JSON.stringify(d.floorOrder) !== JSON.stringify(this.homeBase.floorOrder);
    const to: HomeSettings = { ...d, title: d.title.trim(), floorOrder: orderChanged ? d.floorOrder : this.homeSaved.floorOrder };
    this.homeSaved = await saveHomeSettings(this.homeSaved, to);
    this.homeBase = { ...this.homeSaved, floorOrder: d.floorOrder };
    this.homeDraft = JSON.parse(JSON.stringify(this.homeBase)) as HomeSettings;
    await this.load();
  }

  /** "אפס ווידג׳טים לברירת מחדל": the draft's widgets back to the built-in default with the catalogue's suggestions (saved with "שמור"). */
  private onHomeReset = () => {
    if (this.homeDraft) this.homeDraft = { ...this.homeDraft, direction: 'a', side: 'end', config: suggestConfig(this.candidates) };
  };

  /** What the home block shows: the server's (which already carries the caller's personal override), or - while editing - the
   * draft's direction and widgets with the entities' data previewed from the candidate list. */
  private homeOf(t: DeviceTree): HomeView {
    // P6 item 4: the invented demo home (weather, Shabbat times, alarm) is for the static demo only; against a server without a
    // home block the widgets show their own empty / unavailable states instead of fake data
    const v = homeViewOf(t.home) ?? (isApi() ? homeViewOf({ ...demoHome(), config: {}, data: {} }) : homeViewOf(demoHome()))!;
    const d = this.homeDraft;
    if (!d || !this.lay.editing) return v;
    return { ...v, direction: d.direction, side: d.side, config: d.config, data: previewData(d.config, v.data, this.candidates) };
  }

  /** Which of the two quick actions this user may run (devices.control_bulk on the whole building), and the numbers under them. */
  private quickInfo(t: DeviceTree): QuickInfo {
    const ok = this.bulkAllowed && t.can_bulk === true;
    return { allowed: { lights_off: ok, all_off: ok }, lightsOn: t.building.lights_on, switchesOn: t.building.switches_on };
  }

  /** The widget cards this render draws (edit mode adds the ghosts that say why a widget is not shown). */
  private widgetItems(t: DeviceTree, h: HomeView): WidgetItem[] {
    return resolveWidgets(h.config, h.direction, h.data, { editing: this.lay.editing, quickAllowed: this.quickInfo(t).allowed, phone: this.isPhone, mediaAvailable: this.mediaScreens === null ? undefined : this.mediaScreens > 0,
      elevatorsAvailable: !!this.elevators?.length, temperatureAvailable: this.tempWidget && this.tempUnits.length > 0,
      generatorsAvailable: generatorsAvailable(this.generators), doorsAvailable: doorsWidgetAvailable(this.doorsData, doorWindowsTabOn()),
      noticesAvailable: (this.lay.editing ? noticesWidgetOffered : noticesWidgetAvailable)(this.noticesData, noticesModuleOn()), presenceAvailable: this.presenceOffered() });
  }

  /** CR-015: whether the home's media widget has anything to show - the approved screens of this user (the same question the widget
   * asks for itself); a failure or a missing permission leaves it to the widget. */
  private async loadMediaScreens() {
    if (isApi() && !canAnywhere('media.read')) {
      this.mediaScreens = 0;
      return;
    }
    try {
      if (!(await media().status()).enabled) {
        this.mediaScreens = 0;
        return;
      }
      this.mediaScreens = (await media().list()).devices.filter((d) => d.kind === 'screen').length;
    } catch {
      this.mediaScreens = null;
    }
  }

  /** CR-INFRA-ELEVATORS: the elevators for the home widget (2.8.0: the widget replaces the 2.7.x KPI-row tiles, owner feedback) - read once,
   * then every 30 s only while at least one exists (an installation without elevators asks once and never again; a failure shows nothing). */
  private async loadElevators(): Promise<boolean> {
    const r = await refreshElevatorsVisibility();
    // UXREST2-295: a failed read keeps what was shown and marks the widget failed (a first read that fails stays "no widget": nothing is known to exist)
    this.setWidgetFailed('elevators', !r && elevatorsAccess().view && !!this.elevators?.length);
    this.elevators = r ? r.elevators : (this.elevators ?? []);
    this.elevatorsStale = r?.stale ?? false;
    return this.noteRead('elevators', !!r || !elevatorsAccess().view);
  }

  /** HOMELIVE-295: a failed first read keeps the source polled; a good read clears that. Returns `ok` for the controller. */
  private noteRead(id: string, ok: boolean): boolean {
    if (ok) this.firstReadFailed.delete(id);
    else this.firstReadFailed.add(id);
    return ok;
  }

  /** CR-INFRA-TEMPERATURE phase 3 (idea 12): the units for the home widget - read once, then every 30 s only while at least one exists and the
   * installation offers the widget (an installation without units asks once and never again; a failure shows nothing). */
  private async loadTemperature(): Promise<boolean> {
    const r = await refreshTemperatureVisibility();
    this.setWidgetFailed('temperature', !r && temperatureAccess().view && this.tempUnits.length > 0);
    if (r || !this.tempUnits.length) {
      this.tempUnits = r?.units ?? [];
      this.tempWidget = r?.home_widget !== false;
    }
    this.tempStale = r?.stale ?? false;
    return this.noteRead('temperature', !!r || !temperatureAccess().view);
  }

  /** GENWIDGET 2.9.3: the generators for the home widget - read once, then every 30 s only while at least one exists (an installation without
   * a generator, or a viewer without generator.view, asks once and never again; a failure shows nothing). */
  private async loadGenerators(): Promise<boolean> {
    const g = await loadHomeGeneratorsChecked();
    this.setWidgetFailed('generators', g === null && this.generators.length > 0);
    if (g !== null) this.generators = g;
    return this.noteRead('generators', g !== null);
  }

  /** HOMELIVE-295: wire the sources (once per connect). The widgets poll every 30 s; the tree is pushed by the socket, so its poll is a slow
   * fallback (5 min) that tightens to 60 s while the socket is down. */
  private setupLive() {
    const poll = (id: string, run: () => Promise<boolean>, enabled: () => boolean, silent: () => boolean) => this.live.add({ id, run, pollMs: 30_000, enabled, silent });
    poll('elevators', () => this.loadElevators(), () => elevatorsAccess().view && (!!this.elevators?.length || this.firstReadFailed.has('elevators')), () => !this.elevators?.length);
    poll('temperature', () => this.loadTemperature(), () => temperatureAccess().view && ((this.tempUnits.length > 0 && this.tempWidget) || this.firstReadFailed.has('temperature')), () => !this.tempUnits.length);
    poll('generators', () => this.loadGenerators(), () => generatorsAvailable(this.generators) || this.firstReadFailed.has('generators'), () => !generatorsAvailable(this.generators));
    poll('doors', () => this.loadDoors(), () => doorsWidgetAvailable(this.doorsData, doorWindowsTabOn()) || (doorWindowsTabOn() && this.firstReadFailed.has('doors')), () => !doorsWidgetAvailable(this.doorsData, doorWindowsTabOn()));
    poll('notices', () => this.loadNotices(), () => noticesWidgetOffered(this.noticesData, noticesModuleOn()) || (noticesModuleOn() && this.firstReadFailed.has('notices')), () => !noticesWidgetOffered(this.noticesData, noticesModuleOn()));
    poll('presence', () => this.loadPresence(), () => this.presenceMayRead(), () => !this.presenceOffered());
    this.live.add({ id: 'tree', run: () => this.reloadTree(), pollMs: () => (haPushLive() ? 300_000 : 60_000), enabled: () => isApi() && !this.forbidden && !this.lay.editing });
    this.live.onChange(() => this.requestUpdate());
    this.live.start();
  }

  private async reloadTree(): Promise<boolean> {
    await this.load();
    this.live.markRead('tree', !this.treeFailed);
    return !this.treeFailed;
  }

  /** HOMELIVE-295: the data on screen is not current (a read failed, or a source that should poll has not read for far longer than its period). */
  private isStale(): boolean {
    if (this.treeFailed || this.live.failing()) return true;
    const old = (id: string, ms: number) => {
      const a = this.live.ageOf(id);
      return Number.isFinite(a) && a > ms;
    };
    return old('tree', 600_000) || old('elevators', 150_000) || old('temperature', 150_000) || old('generators', 150_000) || old('doors', 150_000) || old('notices', 150_000);
  }

  /** DOORWIN2-295: the doors widget - read once (nothing at all while the doors tab is off), then every 30 s only while it is offered
   * (HOMELIVE-295: the poll is the live controller's 'doors' source, set up in setupLive). */
  private async loadDoors(): Promise<boolean> {
    const d = await loadHomeDoorsChecked();
    this.setWidgetFailed('doors', d === null && doorsWidgetAvailable(this.doorsData, doorWindowsTabOn()));
    if (d !== null) this.doorsData = d;
    return this.noteRead('doors', d !== null);
  }

  /** NOTICEPAGE-295: the notices widget - read once (nothing at all while the module is off), then every 30 s only while it is offered. */
  private async loadNotices(): Promise<boolean> {
    const d = await loadHomeNoticesChecked();
    this.setWidgetFailed('notices', d === null && noticesModuleOn());
    if (d !== null) this.noticesData = d;
    return this.noteRead('notices', d !== null);
  }

  /** PRESENCE-2280: the caller holds presence.building.view (without it nothing is asked at all). */
  private presenceMayRead(): boolean {
    return isApi() && canAnywhere('presence.building.view');
  }

  /** PRESENCE-2280: the presence widget exists only for a permitted caller while the server reports an enabled, configured module shown as a card. */
  private presenceOffered(): boolean {
    return this.presenceMayRead() && presenceWidgetAvailable(this.presenceSnap);
  }

  /** PRESENCE-2280: the presence widget - read every 30 s while permitted; a failed read keeps the last answer (nothing is invented). */
  private async loadPresence(): Promise<boolean> {
    if (!this.presenceMayRead()) return true;
    try {
      this.presenceSnap = await getBuildingPresence();
      return true;
    } catch {
      return false;
    }
  }

  /** UXREST2-295: the home widgets whose own read failed (home-widgets draws a failure panel with a retry in each one's slot). */
  @state() private failedWidgets: WidgetId[] = [];
  private setWidgetFailed(id: WidgetId, failed: boolean) {
    const has = this.failedWidgets.includes(id);
    if (failed && !has) this.failedWidgets = [...this.failedWidgets, id];
    else if (!failed && has) this.failedWidgets = this.failedWidgets.filter((x) => x !== id);
  }

  private onWidgetRetry = (e: CustomEvent<{ id: WidgetId }>) => {
    if (e.detail.id === 'elevators' || e.detail.id === 'temperature' || e.detail.id === 'generators' || e.detail.id === 'doors' || e.detail.id === 'notices') this.live.refreshOne(e.detail.id);
  };

  /** A phone (under 600 px): the widgets have their own presentation there - layout, size and on / off (home redesign). */
  private get isPhone(): boolean {
    return window.innerWidth <= PHONE_MAX_WIDTH;
  }

  /** FIX2232A-295 (setting home.screen.phone_floors = all): a phone shows every floor stacked down the page - no floor switch, no tree button. */
  private get phoneAll(): boolean {
    return this.isPhone && !this.lay.editing && this.screen.phone_floors === 'all';
  }

  /** Where the widgets sit: a phone gets the presentation chosen for it (a snap row, one under the other, two per row), a tablet
   * the band (direction b has no room for its column), a desktop the direction's own place. */
  private widgetLayout(direction: Direction, config: HomeSettings['config']): 'hero' | 'side' | 'row' | 'snap' | 'stack' | 'two' {
    const w = window.innerWidth;
    if (this.isPhone) return config.phone_layout;
    if (w < FIT_MIN_WIDTH) return 'hero';
    return direction === 'a' ? 'hero' : direction === 'b' ? 'side' : 'row';
  }

  private renderWidgets(t: DeviceTree, h: HomeView, items: WidgetItem[], layout: 'hero' | 'side' | 'row' | 'snap' | 'stack' | 'two') {
    if (!items.length) return nothing;
    return html`<home-widgets layout=${layout} ?quick-hidden=${!this.lay.editing && this.screen.quick_card === 'hide'} .items=${items} .config=${h.config} .data=${h.data} .quick=${this.quickInfo(t)} .zone=${h.time_zone} ?editing=${this.lay.editing} data-fit=${this.fit} ?alarmLink=${canAnywhere('alarm.view')}
      .elevators=${this.elevators ?? []} ?elevatorsStale=${this.elevatorsStale} .temperatureUnits=${this.tempUnits} ?temperatureStale=${this.tempStale} .generators=${this.generators} .doors=${this.doorsData} .notices=${this.noticesData} .presence=${this.presenceOffered() ? this.presenceSnap : null} .failed=${this.failedWidgets}
      @home-widget-retry=${this.onWidgetRetry} @home-widget-size=${this.onWidgetSize} @home-widget-toggle=${this.onWidgetToggle} @home-widget-move=${this.onWidgetMove} @home-widget-edit=${this.onWidgetEdit} @home-quick=${this.onQuick}></home-widgets>`;
  }

  private onWidgetSize = (e: CustomEvent<{ id: WidgetId; size: 's' | 'm' | 'l' }>) => {
    const d = this.homeDraft;
    if (!d) return;
    const c = JSON.parse(JSON.stringify(d.config)) as HomeSettings['config'];
    // on a phone the card's own controls edit the PHONE size, on a wider screen the direction's size
    if (this.isPhone) c[e.detail.id].phone_size = e.detail.size;
    else c[e.detail.id].sizes[d.direction] = e.detail.size;
    this.homeDraft = { ...d, config: c };
  };

  private onWidgetToggle = (e: CustomEvent<{ id: WidgetId }>) => {
    const d = this.homeDraft;
    if (!d) return;
    const c = JSON.parse(JSON.stringify(d.config)) as HomeSettings['config'];
    const w = c[e.detail.id];
    if (this.isPhone) w.phone_on = !widgetOn(w, true); // hide / add on the phone only
    else w.on = !w.on;
    this.homeDraft = { ...d, config: c };
  };

  private onWidgetMove = (e: CustomEvent<{ id: WidgetId; to: number }>) => {
    const d = this.homeDraft;
    if (!d) return;
    // `to` is a place among the cards drawn now (edit mode draws all five, in the configured order)
    // HOMEINFO-295: in the thin-bar style the drawn cards are not all of the order: `to` is a place among the drawn ones
    const drawn = this.cardIds.length ? this.cardIds : d.config.order;
    this.homeDraft = { ...d, config: { ...d.config, order: moveAmong(d.config.order, drawn, e.detail.id, e.detail.to) } };
  };

  /** HOMEINFO-295: the layout editor's own choice between the thin row and the widget cards: saved at once for the installation
   * (home.info_style, system.configure) and applied to this screen immediately, so the edit view and the normal view always agree. */
  private renderInfoChoice() {
    return html`<span class="info-choice" data-home-info-style><span class="lbl">${pl('infoHeading')}</span>
      <span class="lay-seg" role="group" aria-label=${pl('infoHeading')}>
        ${INFO_CHOICES.map((s) => html`<button type="button" data-home-info-option=${s} aria-pressed=${String(this.effectiveInfo() === s)} ?disabled=${!this.infoCanEdit} @click=${() => this.chooseInfo(s)}>${s === 'bar' ? pl('infoBar') : pl('infoCards')}</button>`)}
      </span></span>`;
  }

  /** The info style in force now: the draft of the options form while editing (HOME-295), else the saved one; `auto` resolves by the view. */
  private effectiveInfo(): 'bar' | 'cards' {
    return infoStyleFor(this.lay.editing && this.screenDraft ? this.screenDraft.info : this.infoStyle, this.layout);
  }

  private chooseInfo(next: 'bar' | 'cards') {
    const before = this.infoStyle;
    if (!INFO_CHOICES.includes(next) || !this.infoCanEdit) return;
    this.infoStyle = next;
    // the options form (HOME-295) shares this value: keep its draft and base equal so the choice is saved here and is not a pending change there
    if (this.screenDraft) this.screenDraft = { ...this.screenDraft, info: next };
    if (this.screenBase) this.screenBase = { ...this.screenBase, info: next };
    if (!isApi()) return;
    void patch('settings', { 'home.info_style': next }).then(
      () => invalidateSettings(),
      (err) => {
        this.infoStyle = before;
        if (this.screenDraft) this.screenDraft = { ...this.screenDraft, info: before };
        if (this.screenBase) this.screenBase = { ...this.screenBase, info: before };
        this.error = describeError(err);
      },
    );
  }

  private onWidgetEdit = (e: CustomEvent<{ id: WidgetId }>) => {
    this.openWidget = e.detail.id;
    void this.updateComplete.then(() => this.renderRoot.querySelector('home-edit-panel')?.scrollIntoView({ block: 'nearest', behavior: 'smooth' }));
  };

  private onQuick = (e: CustomEvent<{ action: QuickAction }>) => {
    if (!this.lay.editing) this.building(e.detail.action);
  };

  /** Edit mode's card beside the layout bar: the title, the direction, every widget and the floor order. */
  private renderHomeEdit(t: DeviceTree) {
    const d = this.homeDraft;
    if (!d) return nothing;
    const names = new Map(t.floors.map((f) => [f.floor_id, f.name]));
    const floors = this.floorsOf(t).map((f) => ({ id: f.floor_id, name: names.get(f.floor_id) ?? f.floor_id }));
    const areas = this.floorsOf(t).flatMap((f) => f.areas.map((a) => ({ id: a.area_id, name: a.name, floor: f.name, counts: a.counts })));
    return html`<home-edit-panel .draft=${d} .candidates=${this.candidates} .candidatesError=${this.candidatesError} .baseData=${homeViewOf(t.home)?.data ?? NO_DATA} .floors=${floors} .open=${this.openWidget} .elevators=${this.elevators ?? []} .temperatureUnits=${this.tempWidget ? this.tempUnits : []} ?generators=${generatorsAvailable(this.generators)} ?doors=${doorsWidgetAvailable(this.doorsData, doorWindowsTabOn())} ?notices=${noticesWidgetOffered(this.noticesData, noticesModuleOn())} ?presence=${this.presenceOffered()}
      @home-draft=${this.onDraft} @home-reset=${this.onHomeReset} @home-edit-open=${(e: CustomEvent<{ id: WidgetId | '' }>) => (this.openWidget = e.detail.id)}></home-edit-panel>
      ${this.screenDraft
        ? html`<section class="hs-edit" data-home-screen-edit aria-label=${hs('heading')}><h3>${hs('heading')}</h3>
            <home-screen-options editable .value=${this.screenDraft} .areas=${areas} @hs-change=${(e: CustomEvent<HomeScreenForm>) => (this.screenDraft = e.detail)}></home-screen-options></section>`
        : nothing}`;
  }

  // ---------------------------------------------------------------------------------- edit by address, and the fit

  private get wantsEdit(): boolean {
    return parseRoute().params.get(EDIT_PARAM) === '1';
  }

  /** The address without `edit` (the URL stays clean once edit mode ends, or is refused). */
  private dropEditParam() {
    const r = parseRoute();
    const p = new URLSearchParams(r.params);
    p.delete(EDIT_PARAM);
    replaceRoute(r.path, p);
  }

  /** `#/devices/building?edit=1` opens the layout editor (the same permission as always - the server checks it again on
   * every write); the parameter goes when the session ends, or at once for a viewer who may not edit. */
  private syncEditFromRoute() {
    const want = this.wantsEdit;
    const editing = this.lay.editing;
    if (!want) this.editHandled = false;
    else if (!this.editHandled && this.tree && !this.forbidden && (this.lay.loaded || !isApi())) {
      this.editHandled = true;
      if (this.lay.canEdit && !phoneRestricted('layout_editor')) void this.lay.enter(); // (the phone option is a UX guard; the server checks the permission again)
      else this.dropEditParam();
    }
    if (this.wasEditing && !editing && want) this.dropEditParam();
    this.wasEditing = editing;
  }

  private fitKey = '';

  /** Owner notes 2026-09-30, item 7: on a desktop-width screen the whole screen should fit the viewport without a vertical
   * scroll (for the owner's site: 3 floors, 8 areas, ~150 devices). The tiles and rows are packed tighter one step at a
   * time while the page area still scrolls; the packing restarts from the loosest whenever the viewport, the view or the
   * building's shape changes. A phone (under FIT_MIN_WIDTH) scrolls as usual, and so does the layout editor. */
  private measureFit = () => {
    this.fitTimer = 0;
    const t = this.tree;
    if (!t || !this.isConnected) return;
    // UIJANK-293: while an overlay covers the page (the tiles' panel, any modal drawer locking the page area) the packing is FROZEN
    // at its level - it used to fall back to the loosest level the moment the panel opened, so the whole page behind it grew and
    // jumped down, and stepped back up again on closing. The page behind an overlay never re-flows.
    if (this.panel || isScrollLocked(document.documentElement)) return;
    const eligible = window.innerWidth >= FIT_MIN_WIDTH && !this.lay.editing;
    if (!eligible) {
      if (this.fit !== 0) this.fit = 0;
      return;
    }
    const h = this.homeOf(t);
    const key = [window.innerWidth, window.innerHeight, this.layout, this.selected, t.floors.length, t.floors.reduce((n, f) => n + f.areas.length, 0), h.direction, h.side, this.isPhone, h.config.phone_layout, this.widgetItems(t, h).map((i) => `${i.id}${i.size}`).join(',')].join('|');
    if (key !== this.fitKey) {
      this.fitKey = key;
      if (this.fit !== 0) {
        this.fit = 0; // measured again after this render
        return;
      }
    }
    const sc = scrollParentOf(this);
    if (sc && sc.scrollHeight - sc.clientHeight > 1 && this.fit < 2) this.fit = (this.fit + 1) as FitLevel;
  };

  /** The user's own home screen changed (החשבון שלי › המסך שלי): fetch the tree again, the server applies it. */
  private onPersonal = () => {
    void this.load();
    void loadPersonal().then((p) => {
      this.screenPersonal = p.screen ?? {};
    });
    void loadPersonalRow().then((p) => {
      this.personalRow = Object.keys(p).length ? p : null;
    });
  };

  private onResize = () => {
    this.requestUpdate();
  };

  private viewKey = '';
  private offView: (() => void) | null = null;

  protected willUpdate(changed: PropertyValues) {
    // never hide what is selected: a floor that gets selected (the tree, a floor card, the filter) opens in the tree
    if (changed.has('selected') && this.collapsed.has(this.selected)) this.setCollapsed(this.selected, false);
  }

  private setCollapsed(id: string, collapse: boolean) {
    const next = new Set(this.collapsed);
    if (collapse) next.add(id);
    else next.delete(id);
    this.collapsed = next;
    writeCollapsed(next);
  }

  /** The master toggle beside "כל המבנה": every floor that has area rows folds, or (when all are folded) unfolds. */
  private toggleAllFloors(floors: DeviceFloor[]) {
    const withAreas = floors.filter((f) => f.areas.length);
    const next = new Set(this.collapsed);
    if (withAreas.every((f) => next.has(f.floor_id))) withAreas.forEach((f) => next.delete(f.floor_id));
    else withAreas.forEach((f) => next.add(f.floor_id));
    this.collapsed = next;
    writeCollapsed(next);
  }

  protected updated() {
    this.syncEditFromRoute();
    // HOME-295: no connection greys the last values (CSS keys on the host); the scrolling tree takes exactly the height that is left
    this.toggleAttribute('data-offline', this.offline);
    // (a control screen never scrolls: on a wide screen the tree - every floor with tree_scroll, the first ones with "more" - scrolls inside
    // the height that is left under the summary)
    const tree = this.renderRoot.querySelector<HTMLElement>('.split > nav.tree');
    if (tree && window.innerWidth >= FIT_MIN_WIDTH && !this.lay.editing) {
      const top = tree.getBoundingClientRect().top + (scrollParentOf(this)?.scrollTop ?? 0);
      tree.style.maxBlockSize = `${Math.max(160, Math.floor(window.innerHeight - top - 28))}px`;
    } else tree?.style.removeProperty('max-block-size');
    const vk = `${this.layout}|${this.lay.editing}`;
    if (vk !== this.viewKey) {
      this.viewKey = vk;
      notifyScreenViews(); // the user menu's view choice re-reads the value (and hides itself while the layout editor is open)
    }
    if (!this.fitTimer) this.fitTimer = window.requestAnimationFrame(this.measureFit);
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
    .ha-refresh {
      position: relative;
    }
    .ha-refresh .stale-dot {
      position: absolute;
      inset-block-start: 4px;
      inset-inline-end: 4px;
      inline-size: 7px;
      block-size: 7px;
      border-radius: 50%;
      background: var(--sw-warning);
      pointer-events: none;
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
      color: var(--sw-heading);
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
      border-radius: var(--sw-r-sm);
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
    .seg button:hover {
      background: var(--sw-hover-wash);
    }
    .seg button:focus-visible {
      outline: var(--sw-focus-w) solid var(--sw-focus);
      outline-offset: -2px;
    }
    .seg button[aria-pressed='true'] {
      background: var(--sw-accent);
      color: var(--sw-text-inverse);
    }
    .toolbar .bulk-buttons {
      margin-inline-start: auto;
    }
    /* ---- the mockup's layout: tree panel (inline start) + floor cards */
    /* K88: the plan view - the live plan beside the tree, the floor chooser above it, the room's area summary over it */
    .planview {
      position: relative;
      display: flex;
      flex-direction: column;
      min-inline-size: 0;
      min-block-size: min(70vh, 720px);
      border: 1px solid var(--sw-border);
      border-radius: var(--sw-r-lg);
      background: var(--sw-surface);
      overflow: hidden;
    }
    .planview explore-floor-map {
      flex: 1;
      min-block-size: 0;
    }
    .planfloors {
      display: flex;
      gap: 6px;
      padding: 8px 10px 0;
      overflow-x: auto;
    }
    .planfloors button {
      border: 1px solid var(--sw-border);
      border-radius: 999px;
      background: var(--sw-surface-2, var(--sw-surface));
      color: var(--sw-text-2);
      padding: 4px 12px;
      font: inherit;
      font-size: var(--sw-fs-sm);
      cursor: pointer;
      white-space: nowrap;
    }
    .planfloors button.on {
      border-color: var(--sw-accent);
      color: var(--sw-text);
      background: var(--sw-accent-soft);
    }
    .planpop {
      position: absolute;
      inline-size: 1px;
      block-size: 1px;
      z-index: 6;
    }
    .planpop .poptrig {
      display: block;
      inline-size: 1px;
      block-size: 1px;
    }
    @media (max-width: 899px) {
      .planview {
        min-block-size: 70vh;
      }
    }
    .split {
      display: grid;
      /* owner 2026-09-29: a wide screen gives the tree (and its area names) more room */
      grid-template-columns: clamp(250px, 16vw, 320px) minmax(0, 1fr);
      gap: 18px;
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
      /* owner 2026-09-29 ("unnecessary scrolling"): the tree never scrolls on its own unless it is itself taller than
         the viewport - then it sticks and scrolls inside the visible height (the top bar and the page padding off) */
      box-sizing: border-box;
      max-block-size: calc(100dvh - var(--sw-topbar-h) - var(--sw-banner-h, 0px) - 16px); /* the view under the top bar, minus the 8 px sticky offset top and bottom */
      overflow-y: auto;
      overscroll-behavior: contain;
      scrollbar-width: thin;
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
    .tree-row:hover {
      background: var(--sw-hover-wash);
    }
    /* HOME polish (2026-10-10): keyboard focus is a ring, not only a wash (the wash alone vanished on a hovered row) */
    .tree-row:focus-visible {
      background: var(--sw-hover-wash);
      outline: var(--sw-focus-w) solid var(--sw-focus);
      outline-offset: -2px;
    }
    .tree-row.selected {
      background: var(--sw-accent-soft, var(--sw-surface-2));
      color: var(--sw-accent-text);
      font-weight: var(--sw-fw-semibold);
    }
    @media (prefers-reduced-motion: no-preference) {
      .tree-row,
      .arow,
      .sdot,
      .tile-head .dot,
      .ind .i,
      button.chip {
        transition: background-color var(--sw-t-fast) var(--sw-ease), color var(--sw-t-state) var(--sw-ease), border-color var(--sw-t-state) var(--sw-ease), box-shadow var(--sw-t-state) var(--sw-ease);
      }
    }
    .tree-row .nm {
      flex: 1;
      min-inline-size: 0;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }
    /* owner 2026-09-29 (tree rows): the name takes the row (inline-start, ellipsis only when truly out of room, the full
       name in its title); the lit count sits in a fixed column at the inline end, then the "⋯" column - so every row
       lines up, with or without a menu (a row without one keeps the menu's width free) */
    .tree-row .lit {
      flex: none;
      box-sizing: border-box;
      inline-size: var(--dv-tree-count-w, 44px);
      justify-content: flex-end;
      font-size: var(--sw-fs-xs);
      color: var(--sw-text-3);
      font-variant-numeric: tabular-nums;
      display: inline-flex;
      align-items: center;
      gap: 3px;
    }
    .tree-row.nomenu {
      inline-size: auto;
      margin-inline-end: var(--dv-tree-menu-w, 30px);
    }
    .tree-floor .tree-row {
      flex: 1;
      min-inline-size: 0;
    }
    .tree-floor devices-bulk-menu {
      flex: none;
      inline-size: var(--dv-tree-menu-w, 30px);
      justify-content: center;
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
      margin-block-start: 6px;
    }
    /* a floor is the tree's grouping level: it reads as the heading of its area rows, not as a smaller caption */
    .tree-floor .tree-row {
      font-weight: var(--sw-fw-semibold);
      font-size: var(--sw-fs-sm);
      color: var(--sw-text);
      text-transform: none;
    }
    .tree-floor .tree-row > sw-icon {
      color: var(--sw-text-3);
    }
    .tree-floor .tree-row.selected > sw-icon {
      color: inherit;
    }
    /* the floor's fold chevron: a compact column at the row's start (a touch screen's hit area grows invisibly past it) */
    .tfold {
      position: relative;
      flex: none;
      display: inline-flex;
      align-items: center;
      justify-content: center;
      box-sizing: border-box;
      inline-size: 22px;
      block-size: 28px;
      padding: 0;
      border: 0;
      border-radius: var(--sw-r-sm);
      background: transparent;
      color: var(--sw-text-3);
      font: inherit;
    }
    button.tfold {
      cursor: pointer;
    }
    button.tfold:hover,
    button.tfold:focus-visible {
      background: var(--sw-hover-wash);
      color: var(--sw-text);
      outline: none;
    }
    button.tfold:focus-visible {
      outline: var(--sw-focus-w) solid var(--sw-focus);
      outline-offset: 1px;
    }
    @media (pointer: coarse) {
      button.tfold::before {
        content: '';
        position: absolute;
        inset-block: -8px;
        inset-inline: -11px; /* UXFIX-A11Y-295: 22 + 22 = 44 px wide, 28 + 16 = 44 px tall */
      }
    }
    .tfold .chev.folded {
      transform: rotate(90deg); /* points to the inline start (left, in Hebrew) */
    }
    .tfold .chev.folded:dir(ltr) {
      transform: rotate(-90deg);
    }
    @media (prefers-reduced-motion: no-preference) {
      .tfold .chev {
        transition: transform var(--sw-t-fast) var(--sw-ease);
      }
      .tree-areas {
        animation: tree-areas-in var(--sw-t-med) var(--sw-ease);
      }
    }
    @keyframes tree-areas-in {
      from {
        opacity: 0;
        transform: translateY(-4px);
      }
    }
    .tree-floor.tree-all {
      margin-block-start: 0;
    }
    .tree-area {
      position: relative;
      display: flex;
      align-items: center;
      padding-inline-start: 24px; /* under the floor's name: past the fold chevron's column */
    }
    .tree-area devices-bulk-menu {
      flex: 1;
      min-inline-size: 0;
    }
    .tree-row .nm[title] {
      cursor: inherit;
    }
    .sdot {
      inline-size: 8px;
      block-size: 8px;
      border-radius: 50%;
      background: var(--sw-border-strong);
      flex: none;
    }
    /* something is on: the warm dot carries a soft halo, so the state reads from across the room and in both schemes */
    .sdot.on {
      background: var(--sw-warning);
      box-shadow: 0 0 0 3px color-mix(in srgb, var(--sw-warning) 22%, transparent);
    }
    /* the hover "כבה אזור" takes NO room in the row (owner 2026-09-29: an invisible button used to squeeze the names):
       it floats over the count column, before the "⋯", while the row is hovered or focused; on a touch screen the
       row's "⋯" carries the same action, so it is not drawn there at all */
    .quick {
      position: absolute;
      inset-block: 0;
      inset-inline-end: var(--dv-tree-menu-w, 30px);
      display: flex;
      align-items: center;
      opacity: 0;
      pointer-events: none;
      transition: opacity var(--sw-t-fast) var(--sw-ease);
    }
    .quick sw-button {
      background: var(--dv-surface-solid, var(--sw-surface));
      border-radius: var(--sw-r-sm);
    }
    .tree-area:hover .quick,
    .tree-area:focus-within .quick {
      opacity: 1;
      pointer-events: auto;
    }
    @media (hover: none) {
      .quick {
        display: none;
      }
    }
    .fcards {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(330px, 1fr));
      gap: 14px;
      align-items: start;
    }
    /* HOMEFABLE-297 (impeccable bolder / layout): the floor cards are the page's hero tier - the rounder radius, the ladder's second
       step, a floor title at 20 px / 800; the rows inside are wells (tone step, rounded), not a ruled table */
    section.fcard {
      display: flex;
      flex-direction: column;
      border: 1px solid var(--sw-border);
      border-radius: var(--sw-r-lg);
      background: var(--sw-surface);
      box-shadow: var(--sw-shadow-2);
    }
    /* the hero step over every skin's own panel rule (the skins keep their material; the ladder step and the radius are the home's) */
    :host .fcards > section.fcard {
      border-radius: var(--sw-r-lg);
      box-shadow: var(--sw-shadow-2), inset 0 1px 0 var(--sw-highlight);
    }
    :host .kpis[data-kpis] > sw-kpi[data-kpi] {
      background: var(--sw-surface-2);
      box-shadow: var(--sw-shadow-1), inset 0 1px 0 var(--sw-highlight);
    }
    .fcard header {
      display: flex;
      align-items: center;
      gap: 8px;
      padding: 16px 18px 10px;
      flex-wrap: wrap;
    }
    .fcard header h2 {
      margin: 0;
      font-size: var(--sw-fs-2xl);
      font-weight: 800;
      color: var(--sw-heading);
      letter-spacing: -0.025em;
      line-height: 1.15;
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
      border-radius: var(--sw-r-2xs);
    }
    /* POLISH-CONTROL-297 (owner decision, P6 item "long floor names"): the name is clamped to the installation's line count (2 by default,
       the full name in the tooltip); 1 = one line with an ellipsis */
    .fcard header h2 .ftitle {
      display: -webkit-box;
      -webkit-box-orient: vertical;
      -webkit-line-clamp: 2;
      line-clamp: 2;
      overflow: hidden;
      overflow-wrap: anywhere;
      min-inline-size: 0;
      max-inline-size: 100%;
    }
    .fcard header h2 .ftitle[data-lines='3'] {
      -webkit-line-clamp: 3;
      line-clamp: 3;
    }
    .fcard header h2 .ftitle[data-lines='1'] {
      display: block;
      white-space: nowrap;
      text-overflow: ellipsis;
    }
    .fcard header h2 .ftitle:hover {
      color: var(--sw-accent);
      text-decoration: underline;
      text-underline-offset: 3px;
    }
    .fcard header h2 .ftitle:focus-visible {
      outline: var(--sw-focus-w) solid var(--sw-focus);
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
      gap: 4px;
      padding: 0 10px 10px;
    }
    .arow {
      display: flex;
      align-items: center;
      gap: 10px;
      inline-size: 100%;
      min-block-size: 42px;
      padding: 7px 10px;
      border: 0;
      border-radius: var(--sw-r-sm);
      background: var(--sw-surface-2);
      color: var(--sw-text);
      font: inherit;
      font-size: var(--sw-fs-sm);
      text-align: start;
      cursor: pointer;
      flex-wrap: nowrap;
      transition: transform var(--sw-t-press) var(--sw-ease-out), background-color var(--sw-t-fast) var(--sw-ease);
    }
    /* mobile-native: a hover only under a pointer that hovers (a tap would leave it stuck); the press answers on pointer-down */
    @media (hover: hover) and (pointer: fine) {
      .arow:hover {
        background: var(--sw-surface-3);
      }
    }
    .arow {
      touch-action: manipulation;
      -webkit-tap-highlight-color: transparent;
      user-select: none;
      -webkit-user-select: none;
    }
    .arow:active {
      transform: scale(var(--sw-press-scale));
    }
    .arow:focus-visible {
      background: var(--sw-surface-3);
      outline: var(--sw-focus-w) solid var(--sw-focus);
      outline-offset: -2px;
      border-radius: var(--sw-r-sm);
    }
    .arow-q .arow {
      background: transparent;
    }
    .arow-q:not([data-lit]):not([data-bad]) {
      background: var(--sw-surface-2);
    }
    @media (hover: hover) and (pointer: fine) {
      .arow-q:not([data-lit]):not([data-bad]):hover {
        background: var(--sw-surface-3);
      }
    }
    .arow.empty {
      color: var(--sw-text-3);
      cursor: default;
    }
    .arow.empty:hover {
      background: transparent;
    }
    .arow .nm {
      font-size: var(--sw-fs-md);
      font-weight: var(--sw-fw-semibold);
      color: var(--sw-heading);
      flex: 1 1 auto;
      min-inline-size: 3ch; /* P6 item 2: the name never squeezes under three letters - the indicators yield first */
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }
    /* P6 item 2: the temperature / stale time never shrinks or clips ("21.0°" read as "0°"); tabular so rows align */
    .arow .tm {
      flex: none;
      white-space: nowrap;
      font-variant-numeric: tabular-nums;
    }
    /* release 0.1.149: what sits after an area's name - one line, never wrapping; at most three on a phone, the rest as "+N" */
    .ind {
      display: inline-flex;
      align-items: center;
      min-block-size: 20px; /* an empty row is as tall as one with indicators */
      flex: none;
      gap: 10px;
      font-size: var(--sw-fs-xs);
      color: var(--sw-text-2);
      font-variant-numeric: tabular-nums;
      white-space: nowrap;
    }
    .ind.none {
      color: var(--sw-text-3);
    }
    .ind .i {
      display: inline-flex;
      align-items: center;
      gap: 3px;
    }
    .ind .i.warm {
      color: var(--sw-text);
      font-weight: var(--sw-fw-semibold);
    }
    .ind .i.warm sw-icon {
      color: var(--sw-warning);
    }
    .ind .i[data-ind='climate'].warm sw-icon {
      color: var(--sw-accent);
    }
    .ind .i[data-ind='climate'].warm.heat sw-icon {
      color: var(--sw-warning);
    }
    .ind .i.dim {
      opacity: 0.5;
    }
    .ind .i.more {
      padding-inline: 6px;
      border-radius: 999px;
      background: var(--sw-surface-3);
      color: var(--sw-text-2);
    }
    .fcard footer {
      display: flex;
      gap: 8px;
      padding: 6px 18px 14px;
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
    }
    @media (prefers-reduced-motion: no-preference) {
      a.tile {
        transition: border-color var(--sw-t-fast) var(--sw-ease), box-shadow var(--sw-t-fast) var(--sw-ease), background-color var(--sw-t-state) var(--sw-ease), transform var(--sw-t-fast) var(--sw-ease);
      }
      a.tile:hover {
        transform: translateY(var(--sw-hover-lift));
      }
    }
    a.tile:hover {
      border-color: var(--sw-border-strong);
      box-shadow: var(--sw-shadow-2);
    }
    a.tile:focus-visible {
      border-color: var(--sw-border-strong);
      outline: var(--sw-focus-w) solid var(--sw-focus);
      outline-offset: var(--sw-focus-offset);
    }
    /* HOMEFABLE-297: a lit area tile is a solid lit field (the same status field as the cards-mode rows), not a fade */
    a.tile.on {
      background: var(--sw-lit-soft);
      border-color: color-mix(in srgb, var(--sw-warning) 40%, var(--sw-border));
    }
    .tile-head > sw-icon {
      color: var(--sw-text-2);
    }
    a.tile.on .tile-head > sw-icon {
      color: var(--sw-warning-text);
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
      box-shadow: 0 0 0 3px color-mix(in srgb, var(--sw-warning) 22%, transparent);
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
    /* ---- the loading skeleton (HOME polish 2026-10-10) ---- */
    .skeleton {
      display: flex;
      flex-direction: column;
      gap: 12px;
      min-inline-size: 0;
    }
    .skl {
      position: relative;
      overflow: hidden;
      border-radius: var(--sw-r-md);
      background: var(--sw-skeleton);
    }
    .skl::after {
      content: '';
      position: absolute;
      inset: 0;
      transform: translateX(-100%);
      background: linear-gradient(90deg, transparent, var(--sw-skeleton-shine), transparent);
    }
    @media (prefers-reduced-motion: no-preference) {
      .skl::after {
        animation: skl-shine 1.4s var(--sw-ease) infinite;
      }
    }
    @keyframes skl-shine {
      to {
        transform: translateX(100%);
      }
    }
    .skl-band {
      display: flex;
      gap: 12px;
    }
    .skl-band .wg {
      flex: 1 1 210px;
      block-size: 146px;
    }
    .skl-kpis {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(140px, 1fr));
      gap: 8px;
    }
    .skl-kpis .kpi {
      block-size: 44px;
    }
    .skl-split {
      display: grid;
      grid-template-columns: clamp(250px, 16vw, 320px) minmax(0, 1fr);
      gap: 16px;
      align-items: start;
    }
    .skl-split .tree {
      block-size: 220px;
    }
    .skl-cards {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(330px, 1fr));
      gap: 12px;
    }
    .skl-cards .card {
      block-size: 180px;
    }
    @media (max-width: 899px) {
      .skl-band .wg:nth-child(n + 3),
      .skl-split .tree {
        display: none;
      }
      .skl-split,
      .skl-cards {
        grid-template-columns: minmax(0, 1fr);
      }
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
    /* owner 2026-09-29: a floor's count chips (and the floor card's lit count) open the tiles' panel for that floor */
    .chip {
      display: inline-flex;
      align-items: center;
      gap: 4px;
      font: inherit;
      font-size: var(--sw-fs-xs);
      font-variant-numeric: tabular-nums;
      padding: 2px 8px;
      border: 1px solid transparent;
      border-radius: 999px;
      background: transparent;
      color: var(--sw-text-2);
    }
    .fchips {
      display: inline-flex;
      flex-wrap: wrap;
      gap: 4px;
    }
    .fchips:empty {
      display: none;
    }
    /* HOME polish: the count chips are quiet pills on the card (no outline); the lit chip takes the warm tone when something is on */
    .fchips button.chip {
      position: relative;
      background: var(--sw-surface-2);
      border-color: transparent;
      min-block-size: 28px;
    }
    .fh-chips button.chip.lit {
      background: var(--sw-surface-2);
      border-color: transparent;
    }
    .fh-chips button.chip.lit.warm {
      background: var(--sw-warning-soft);
      color: var(--sw-warning-text);
    }
    .fh-chips button.chip.lit.warm sw-icon {
      color: var(--sw-warning);
    }
    @media (max-width: 767px), (pointer: coarse) {
      .fchips button.chip {
        min-block-size: 36px;
      }
      .fchips button.chip::before {
        content: '';
        position: absolute;
        inset-block: -4px;
        inset-inline: 0;
      }
    }
    button.chip {
      min-block-size: 28px;
      border-color: var(--sw-border);
      background: var(--sw-surface);
      cursor: pointer;
    }
    button.chip.warm {
      color: var(--sw-text);
      font-weight: var(--sw-fw-semibold);
    }
    button.chip:hover {
      border-color: var(--sw-border-strong);
      background: var(--sw-surface-3);
    }
    button.chip:focus-visible {
      outline: var(--sw-focus-w) solid var(--sw-focus);
      outline-offset: 1px;
    }
    button.chip[aria-expanded='true'] {
      border-color: var(--sw-accent);
    }
    @media (max-width: 767px), (pointer: coarse) {
      button.chip {
        min-block-size: 44px;
        padding-inline: 10px;
      }
    }
  `, BUILDING_GLASS, TILE_LAYOUT, HOME_LAYOUT, BUILDING_BUBBLE, HOME_SCREEN_CSS];

  connectedCallback() {
    super.connectedCallback();
    this.prefsReady = Promise.all([
      loadDevicesPrefs().then((p) => {
        this.prefs = p;
        applyDevicesPrefs(this, p);
        if (!this.layoutChosen) this.layout = p.defaultView;
      }),
      loadHomeSettings().then((h) => {
        if (!this.lay.editing) this.homeSaved = h;
      }),
      loadPersonalRow().then((p) => {
        this.personalRow = Object.keys(p).length ? p : null;
      }),
      loadScreenDisplay().then((d) => {
        this.infoStyle = d.infoStyle;
        this.floorTitleLines = d.floorTitleLines;
        this.bulkIdle = d.bulkIdle;
      }),
      // HOME-295: the display options and the user's own (his summary tiles / phone area)
      loadHomeScreen().then((s) => {
        if (!this.lay.editing) this.screenSite = s;
      }),
      loadPersonal().then((p) => {
        this.screenPersonal = p.screen ?? {};
      }),
      // HOMEINFO-295: may this caller change the installation's info style from the edit bar (system.configure)? Demo: yes, in memory.
      (isApi() ? getSettings().then((x) => x.can_edit === true, () => false) : Promise.resolve(true)).then((ok) => {
        this.infoCanEdit = ok;
      }),
    ]).then(() => undefined);
    window.addEventListener('resize', this.onResize);
    window.addEventListener(HOME_PERSONAL_EVENT, this.onPersonal);
    void this.loadMediaScreens();
    this.setupLive();
    void this.loadElevators().then((ok) => this.live.markRead('elevators', ok));
    void this.loadTemperature().then((ok) => this.live.markRead('temperature', ok));
    void this.loadGenerators().then((ok) => this.live.markRead('generators', ok));
    void this.loadDoors().then((ok) => this.live.markRead('doors', ok));
    void this.loadNotices().then((ok) => this.live.markRead('notices', ok));
    void this.loadPresence().then((ok) => this.live.markRead('presence', ok));
    // the view choice (cards | tiles) lives in the user menu, not on the page (home redesign follow-up)
    this.registerView();
    void this.prefsReady.then(() => this.registerView()); // K88: the plan view appears once plan.surfaces says so
    // the tiles' panel follows the address (a deep link from search or the Live overview, or this screen's own tiles)
    this.offRoute = onRouteChange((r) => {
      if (r.segments[0] !== 'devices' || (r.segments[1] ?? 'building') !== 'building') return;
      this.requestUpdate(); // `?edit=1` comes and goes with the address (syncEditFromRoute, in updated())
      const want = panelFromParams(r.params);
      if (!want) {
        this.panel = null;
        this.pushedPanel = false; // Back already left the panel's entry
        return;
      }
      const cur = this.panel;
      if (cur && cur.kind === want.kind && cur.scope === want.scope && cur.id === want.id) {
        if (cur.filter !== want.filter) this.panel = { ...cur, filter: want.filter };
        return;
      }
      this.panel = { ...want, name: this.scopeName(want.scope, want.id) };
    });
    if (!isApi()) {
      this.demoState = new URLSearchParams(location.search).get('hs_state') ?? '';
      this.tree = { ...demoTreeFor(this.demoState), home: demoHome() };
      this.sync = DEMO_DEVICES_TREE.sync;
      return;
    }
    if (!canAnywhere('devices.read')) {
      this.forbidden = true;
      return;
    }
    void this.reloadTree();
    this.tickTimer = window.setInterval(() => (this.tick += 1), 15_000);
    this.stop = subscribeHa(
      (m) => {
        if (m.type === 'entity_state_changed') {
          this.scheduleReload();
          // HOMELIVE-295: a state moved - the elevators / temperature / generators derive from states, so they re-read (bounded: at most one read per source per 15 s)
          for (const id of ['elevators', 'temperature', 'generators']) this.live.nudge(id);
        } else if (m.type === 'structure_changed') {
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
    this.offRoute?.();
    this.offRoute = null;
    this.stop?.();
    this.stop = null;
    window.clearTimeout(this.timer);
    this.timer = 0;
    window.clearTimeout(this.flashTimer);
    window.clearInterval(this.tickTimer);
    this.flashTimer = this.tickTimer = 0;
    window.clearTimeout(this.noteTimer);
    window.cancelAnimationFrame(this.fitTimer);
    this.noteTimer = this.fitTimer = 0;
    window.removeEventListener('resize', this.onResize);
    this.live.stop();
    for (const id of ['elevators', 'temperature', 'generators', 'doors', 'notices', 'presence', 'tree']) this.live.remove(id);
    window.removeEventListener(HOME_PERSONAL_EVENT, this.onPersonal);
    this.offView?.();
    this.offView = null;
  }

  private noteTimer = 0;

  /** The outcome of a refresh press, for a few seconds (a short confirmation, not a standing line). */
  private noteRefresh(text: string) {
    this.refreshNote = text;
    window.clearTimeout(this.noteTimer);
    if (text) this.noteTimer = window.setTimeout(() => (this.refreshNote = ''), 6000);
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
    this.noteRefresh('');
    this.manualUntil = Number.POSITIVE_INFINITY; // the push this request causes may arrive before its answer
    try {
      const r = await refreshDevicesFromHa();
      this.sync = r.sync;
      if (r.changed) this.flashStructure();
      else this.noteRefresh('אין שינויים במבנה');
      await this.load();
      this.live.refreshAll(['tree']); // HOMELIVE-295: the button refreshes every widget, not only the structure
    } catch (err) {
      this.noteRefresh(describeError(err));
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
      void this.reloadTree();
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
      this.treeFailed = false;
    } catch (err) {
      if (err instanceof ApiError && err.status === 403) this.forbidden = true;
      else {
        this.error = describeError(err);
        this.treeFailed = true;
      }
    } finally {
      this.loading = false;
      if (this.loadAgain) {
        this.loadAgain = false;
        void this.load();
      }
    }
  }

  render() {
    // owner notes 2026-09-30: the title is the installation's own text (edit mode), empty = the default; shown live while editing
    const heading = ((this.lay.editing && this.homeDraft ? this.homeDraft.title : this.homeSaved.title).trim() || HOME_TITLE_DEFAULT);
    if (this.forbidden) {
      return html`<sw-page heading=${heading} subheading="המבנה"><sw-state-panel data-devices-state="no_permission" state="forbidden" heading="אין לך הרשאת צפייה בחשמל והתקנים" hint="נדרשת ההרשאה צפייה בחשמל והתקנים. פנה למנהל המערכת."></sw-state-panel></sw-page>`;
    }
    const t = this.tree;
    if (!t) {
      return html`<sw-page heading=${heading} subheading="המבנה" wide>${this.error
        ? html`<sw-state-panel data-devices-state="load_error" state="error" heading="לא ניתן לטעון את עץ המבנה" hint=${this.error} actionLabel="נסה שוב" @action=${() => void this.load()}></sw-state-panel>`
        : this.renderSkeleton()}</sw-page>`;
    }
    // POLISH-295 (owner approval 2026-10-25): no technical line under the title (floors · areas · devices · demo data) - clean operator screen
    const connected = this.sync?.connected ?? false;
    this.lay.prepare(this.layGrids(t));
    // home redesign: the direction (a / b / c) and the widgets, from the server's block (the caller's personal override already
    // applied there) or, while editing, from the draft
    const h = this.homeOf(t);
    const items = this.widgetItems(t, h);
    let layout = this.widgetLayout(h.direction, h.config);
    // HOME-295: the info row of the new home (`auto`, the cards view) is the approved mockup's compact row of cards, not the tall band
    if (!this.lay.editing && this.infoStyle === 'auto' && layout === 'hero' && window.innerWidth >= FIT_MIN_WIDTH) layout = 'row';
    // HOME-295 (owner answer 8): on a landscape tablet the "כיבוי במבנה" card drops (the action stays in the floor menu) - a setting
    const dropQuick = !this.lay.editing && (this.screen.quick_card === 'hide' || (this.screen.building_off_tablet === 'hide' && isTabletLandscape(window.innerWidth, window.innerHeight)));
    const quickShown = dropQuick || items.some((i) => i.id === 'quick' && i.avail === 'ok');
    const alarmShown = items.some((i) => i.id === 'alarm' && i.avail === 'ok');
    // POLISH-295: in the thin-bar style the clock, the weather, Shabbat and the alarm leave the card band for the header (edit mode
    // keeps every card: that is where they are switched on, sized and ordered). HOME-295 (owner answer 5): `auto` = the cards in the
    // cards view, the bar in tiles. HOMEINFO-295: the edit view follows the chosen style too (the four are switched on / sized / ordered in the editor's list).
    const bar = this.effectiveInfo() === 'bar';
    // (the mockup: with an alert row or the no-connection row on a tablet / 1366 screen, the multimedia card folds so nothing scrolls)
    const banner = !this.lay.editing && (this.offline || homeAlerts(t).some((x) => !this.acked.includes(`${x.scope}:${x.id}`)));
    const dropMedia = banner && window.innerWidth <= 1366;
    const cardItems = (bar ? items.filter((i) => !AMBIENT_WIDGETS.includes(i.id)) : items).filter((i) => !(dropQuick && i.id === 'quick') && !(dropMedia && i.id === 'media'));
    this.cardIds = cardItems.map((i) => i.id);
    const ambient = bar ? items.filter((i) => AMBIENT_WIDGETS.includes(i.id) && i.avail === 'ok') : [];
    const widgets = this.renderWidgets(t, h, cardItems, layout);
    const sideLayout = layout === 'side' && cardItems.length > 0;
    const body = html`${!t.floors.length
        ? html`<sw-state-panel icon="building" data-devices-state="empty" state="empty" heading=${t.scoped ? 'אין התקנים בקומות שלך' : 'אין קומות ואזורים'} hint=${t.scoped ? 'מוצגות רק הקומות שבהרשאתך.' : 'המבנה יופיע כאן כשיוגדרו קומות ואזורים.'}></sw-state-panel>`
        : nothing}
      ${this.lay.editing ? this.renderHomeEdit(t) : nothing}
      ${this.layout === 'cards' ? this.renderCards(t, sideLayout) : this.layout === 'plan' ? this.renderPlan(t, sideLayout) : this.renderTiles(t, sideLayout)}`;
    // owner notes 2026-09-30: no "ערוך פריסה" button here (the user menu's "עריכת המסך הראשי" opens `?edit=1`); the header
    // row carries only a "not synced" chip when the state is NOT fine, and a small refresh icon
    return html`<sw-page heading=${heading} wide @bulk-request=${this.onBulkRequest}>
      <div slot="actions" class="hdr">
        ${ambient.length ? html`<home-ambient-bar .items=${ambient} .config=${h.config} .data=${h.data} .zone=${h.time_zone}></home-ambient-bar>` : nothing}
        ${t.scoped ? html`<sw-badge kind="partial" label="לפי הקומות שלך"></sw-badge>` : nothing}
        ${isApi() && !connected && !this.offline ? html`<sw-badge data-devices-sync kind="stale" label="לא מסונכרן"></sw-badge>` : nothing}
        ${isApi() ? this.renderRefresh() : nothing}
      </div>
      ${this.error && !this.offline ? html`<sw-state-panel compact state="error" heading="הרענון האחרון נכשל" hint=${this.error}></sw-state-panel>` : nothing}
      <div class="page-body" data-home-direction=${h.direction} data-home-layout=${layout} data-fit=${this.fit}>
        ${this.lay.renderBar()}
        ${this.renderBanner(t)}
        ${sideLayout ? nothing : widgets}
        ${this.renderKpis(t.building, alarmShown)}
        ${this.isPhone && !this.lay.editing && !this.phoneAll && this.layout !== 'plan' ? this.renderPhoneFloors(t) : nothing}
        ${sideLayout
          ? html`<div class="bgrid" data-side=${h.side} data-fit=${this.fit} data-bgrid>
              <div class="bmain">${this.renderToolbar(t, !quickShown, true)}${body}</div>
              <div class="bside" data-home-column>${widgets}</div>
            </div>`
          : html`${this.renderToolbar(t, !quickShown, false)}${body}`}
      </div>
      ${this.bulkAllowed ? html`<devices-bulk-dialog @bulk-done=${() => void this.load()}></devices-bulk-dialog>` : nothing}
      ${this.lay.renderPanel()}
      ${this.renderSheets(t)}
      ${this.renderQuickSheet()}
      <devices-tiles-panel ?open=${!!this.panel} .kind=${this.panel?.kind ?? 'lights'} .scope=${this.panel?.scope ?? 'building'} .scopeId=${this.panel?.id ?? ''} .scopeName=${this.panel?.name || this.scopeName(this.panel?.scope ?? 'building', this.panel?.id ?? '')} .filter=${this.panel?.filter ?? 'all'} @panel-close=${this.closePanel} @panel-filter=${this.onPanelFilter} @panel-changed=${() => this.scheduleReload()} @panel-navigate=${this.onPanelNavigate}></devices-tiles-panel>
    </sw-page>`;
  }

  /** HOME polish (2026-10-10): the loading state is the screen's own shape - the widget band, the summary strip, the tree and two
   * floor cards as skeleton blocks (tokens `--sw-skeleton` / `--sw-skeleton-shine`; the shimmer stops under reduced motion) -
   * so the first paint does not jump when the tree arrives. */
  private renderSkeleton() {
    const block = (cls: string) => html`<div class=${`skl ${cls}`}></div>`;
    return html`<div class="skeleton" data-devices-state="loading" role="status" aria-label="טוען…" aria-busy="true">
      <div class="skl-band">${block('wg')}${block('wg')}${block('wg')}${block('wg')}</div>
      <div class="skl-kpis">${block('kpi')}${block('kpi')}${block('kpi')}${block('kpi')}${block('kpi')}</div>
      <div class="skl-split">
        ${block('tree')}
        <div class="skl-cards">${block('card')}${block('card')}</div>
      </div>
    </div>`;
  }

  /** The toolbar row: the view switch, in direction b the floor filter (the tree is gone there), and - unless the quick-actions
   * widget carries them - the building's bulk buttons. */
  private renderToolbar(t: DeviceTree, showBulk: boolean, floorFilter: boolean) {
    const bulkBuilding = showBulk && this.bulkAllowed && t.can_bulk === true;
    const floors = this.floorsOf(t);
    const filter = floorFilter && floors.length > 1;
    // the view choice (cards | tiles) is in the user menu now (registerScreenView): with neither the floor filter nor the
    // bulk buttons there is nothing to put in this row, so it is not drawn at all
    if (!filter && !bulkBuilding) return nothing;
    return html`<div class="toolbar" data-toolbar>
      ${filter
        ? html`<span class="floor-filter" role="group" aria-label="קומה" data-floor-filter>קומה:
            <span class="opts">
              <button type="button" data-floor-filter-btn="all" aria-pressed=${String(this.selected === 'all')} @click=${() => (this.selected = 'all')}>כל המבנה</button>
              ${floors.map((f) => html`<button type="button" data-floor-filter-btn=${f.floor_id} aria-pressed=${String(this.selected === f.floor_id)} @click=${() => (this.selected = f.floor_id)}>${bidi(f.name)}</button>`)}
            </span>
          </span>`
        : nothing}
      ${bulkBuilding
        ? html`<span class="bulk-buttons" data-bulk-building>
            <sw-button size="sm" icon="light" data-bulk-kind="lights_off" ?disabled=${this.bulkIdle === 'disabled' && !(t.building.lights_on > 0)} @click=${() => this.building('lights_off')}>כבה תאורה בלבד</sw-button>
            <sw-button size="sm" variant="danger" icon="bolt" data-bulk-kind="all_off" ?disabled=${this.bulkIdle === 'disabled' && !(t.building.lights_on > 0 || t.building.switches_on > 0)} @click=${() => this.building('all_off')}>כבה הכל בבניין</sw-button>
          </span>`
        : nothing}
    </div>`;
  }

  /** CR-007 HA refresh: the manual refresh, when the structure was last read from HA, and "מבנה עודכן" after a change. */
  private renderRefresh() {
    void this.tick; // re-rendered every 15 s so the "לפני …" lines keep up
    const timing = structureTiming(this.sync);
    // owner notes 2026-09-30: one small icon-only button; when the structure was last read is only its tooltip. A short
    // outcome (an error / "no change") shows for a few seconds after a press, and "מבנה עודכן" after a real change.
    const stale = this.isStale();
    const at = this.live.lastOkAt();
    const updated = at ? `${hl('updated')} ${timeText(new Date(at))}` : '';
    const tip = [this.refreshing ? 'מרענן…' : 'רענן', stale ? hl('stale') : '', updated, timing.changed, timing.checked].filter(Boolean).join(' · ');
    return html`<span class="ha-refresh">
      ${this.structureFlash ? html`<sw-badge data-structure-changed kind="live" label="מבנה עודכן"></sw-badge>` : nothing}
      ${this.refreshNote ? html`<span class="refreshed" role="status" data-devices-refresh-note>${this.refreshNote}</span>` : nothing}
      <sw-button size="sm" variant="ghost" icon="refresh" iconOnly label=${tip} data-devices-refresh ?disabled=${this.refreshing} @click=${() => void this.refreshFromHa()}></sw-button>
      ${stale ? html`<span class="stale-dot" data-home-stale aria-hidden="true"></span>` : nothing}
    </span>`;
  }

  /** The floors as this render shows them: the tree's own order (the installation's floor order, applied by the server),
   * or - while the order is being edited - the draft's, so the tree and the cards / tiles preview it. */
  private floorsOf(t: DeviceTree): DeviceFloor[] {
    return this.lay.editing && this.homeDraft ? orderFloors(t.floors, this.homeDraft.floorOrder) : t.floors;
  }

  /** The slice-1 presentation: floor sections with area tiles (the "⋯" popover on each tile for a bulk holder) - now beside
   * the floors tree, as in the cards view, and packed side by side so the whole screen fits the viewport (owner notes
   * 2026-09-30, item 7). */
  private renderTiles(t: DeviceTree, noTree = false) {
    if (!t.floors.length && !t.unassigned.counts.entities) return nothing;
    const all = this.floorsOf(t);
    const shown = this.selected === 'all' ? all : all.filter((f) => f.floor_id === this.selected);
    const phoneOne = this.isPhone && !this.lay.editing && !this.phoneAll && this.selected !== 'all'; // HOME-295: a phone shows one floor at a time once a floor is picked; the first, default choice is every floor (owner 2026-10-29)
    const floors = phoneOne ? [this.phoneFloorOf(all)].filter((f): f is DeviceFloor => !!f) : shown.length ? shown : all; // a floor that vanished from the tree: back to everything
    const loose = !phoneOne && (this.selected === 'all' || !shown.length) && (t.unassigned.counts.entities || !t.scoped);
    return html`<div class="split" data-layout-view="tiles" data-fit=${this.fit} ?data-no-tree=${noTree}>
      ${noTree ? nothing : this.renderTreePanel(t)}
      <div class="floors" data-floors>
        ${repeat(floors, (f) => f.floor_id, (f) => this.renderFloor(f))}
        ${loose
          ? html`<section class=${classMap({ floor: true, laid: this.lay.gridOn('areas:unassigned') })} style="--n:1" data-floor="unassigned">
              <div class="floor-head"><h2>ללא שיוך</h2><span class="level">התקנים שאינם משויכים לאזור</span></div>
              ${this.renderAreasGrid('areas:unassigned', html`${this.lay.wrap('area:unassigned', this.renderTile({ area_id: 'unassigned', name: t.unassigned.name, icon: null, floor_id: null, counts: t.unassigned.counts, has_camera: false }, true))}`)}
            </section>`
          : nothing}
      </div>
    </div>`;
  }

  /** The approved mockup's presentation: the tree panel and the floor cards. */
  private renderCards(t: DeviceTree, noTree = false) {
    if (!t.floors.length && !t.unassigned.counts.entities) return nothing;
    const all = this.floorsOf(t);
    const shown = this.selected === 'all' ? all : all.filter((f) => f.floor_id === this.selected);
    let floors = shown.length ? shown : all; // a floor that vanished from the tree: back to everything
    // HOME-295 (owner answer 7): more floors than one row holds - four cards on a desktop (three on a landscape tablet), the rest through
    // the tree ("עוד קומות", or the scrolling tree - many_floors); a phone shows one floor at a time (renderPhoneFloors)
    const max = floorCardsMax(window.innerWidth);
    let cols = '';
    if (this.phoneAll) floors = all;
    else if (this.isPhone && !this.lay.editing && this.selected !== 'all') floors = [this.phoneFloorOf(all)].filter((f): f is DeviceFloor => !!f);
    else if (!this.lay.editing && !this.gridAttrs('fcards').on && this.selected === 'all' && window.innerWidth >= 900) {
      // the floors share ONE row (the mockup: three floors = three columns), at most `max` of them
      floors = floorCardsSplit(all, 'all', max).shown;
      cols = String(Math.max(1, Math.min(all.length, max)));
    }
    // HOME-295: "ללא שיוך" sits at the foot of the tree (the mockup); its own card only where no tree is drawn (a portrait tablet)
    const loose = (this.selected === 'all' || !shown.length) && !this.isPhone && window.innerWidth < 900 && (t.unassigned.counts.entities || !t.scoped) && !cols;
    return html`<div class="split" data-layout-view="cards" data-fit=${this.fit} ?data-no-tree=${noTree}>
      ${noTree ? nothing : this.renderTreePanel(t)}
      <div class=${classMap({ fcards: true, 'lay-grid': this.gridAttrs('fcards').on })} data-lay-grid="fcards" data-lay-cols=${this.gridAttrs('fcards').cols} ?data-lay-phone-preview=${this.gridAttrs('fcards').phone} data-cols=${cols || nothing} data-floor-count=${all.length}>
        ${repeat(floors, (f) => f.floor_id, (f) => this.lay.wrap(`floor:${f.floor_id}`, this.renderFloorCard(f)))}
        ${loose || (this.lay.editing && (t.unassigned.counts.entities || !t.scoped))
          ? this.lay.wrap('floor:unassigned', html`<section class="fcard loose" data-floor-card="unassigned" data-lay-key="floor:unassigned">
              <header><h2>ללא שיוך</h2><span class="lit">${t.unassigned.counts.entities} התקנים שאינם משויכים לאזור</span></header>
              <div class="rows">${this.renderAreaRow({ area_id: 'unassigned', name: t.unassigned.name, icon: null, floor_id: null, counts: t.unassigned.counts, has_camera: false }, 'card', true)}</div>
            </section>`)
          : nothing}
      </div>
    </div>`;
  }

  /** The view choice (cards | tiles | plan) in the user menu; the plan view only when the installation shows the live plan here. */
  private registerView(): void {
    this.offView?.();
    const plan = this.prefs.planSurfaces.includes('devices') && isApi();
    if (!plan && this.layout === 'plan') this.layout = this.prefs.defaultView;
    this.offView = registerScreenView({
      id: 'devices-building-view',
      label: 'תצוגה',
      options: [{ value: 'cards', label: 'כרטיסים' }, { value: 'tiles', label: 'אריחים' }, ...(plan ? [{ value: 'plan', label: 'תוכנית' }] : [])],
      value: () => this.layout,
      set: (v) => this.setLayout(v === 'tiles' ? 'tiles' : v === 'plan' && plan ? 'plan' : 'cards'),
      can: () => !this.lay.editing && !this.forbidden,
    });
  }

  /** K88: the plan view - the floors tree stays at the side, the selected floor's live plan fills the rest; a room tap
   * opens the area's summary (the same popover as a tree row), "פתח אזור" and "הצג על המפה" inside it. */
  private renderPlan(t: DeviceTree, noTree = false) {
    if (!this.planFloorsLoaded) {
      this.planFloorsLoaded = true;
      void loadCatalogTree().then((c) => { this.planFloors = c.sites.flatMap((s) => (s.buildings ?? []).flatMap((b) => b.floors ?? [])); }).catch(() => {});
    }
    const floors = this.planFloors.filter((f) => f.has_plan);
    const floorId = this.planFloorFor(t, floors);
    const pop = this.planPop;
    return html`<div class="split" data-layout-view="plan" data-fit=${this.fit} ?data-no-tree=${noTree}>
      ${noTree ? nothing : this.renderTreePanel(t)}
      <div class="planview" data-plan-view>
        ${floors.length > 1
          ? html`<div class="planfloors" role="group" aria-label="קומות התוכנית" data-plan-floors>
              ${floors.map((f) => html`<button class=${f.id === floorId ? 'on' : ''} data-plan-floor=${f.id} aria-pressed=${f.id === floorId} @click=${() => { this.planFloorId = f.id; this.planPop = null; }}>${bidi(f.name)}</button>`)}
            </div>`
          : nothing}
        ${floorId
          ? html`<explore-floor-map embedded data-plan-map .floorId=${floorId} @area-open=${(e: CustomEvent<{ zone_id: string; zone_name: string; area_id: string | null; x: number; y: number }>) => this.onAreaOpen(t, e)}></explore-floor-map>`
          : this.planFloorsLoaded && this.planFloors.length
            ? html`<sw-state-panel icon="building" state="empty" heading="אין תוכנית קומה" hint="העלו תוכנית לקומה במפה כדי לראות אותה כאן."></sw-state-panel>`
            : html`<sw-state-panel state="loading"></sw-state-panel>`}
        ${pop
          ? html`<div class="planpop" data-plan-pop style=${`left:${Math.round(pop.x)}px;top:${Math.round(pop.y)}px`}>
              <devices-bulk-menu data-plan-pop-menu scope="area" .targetId=${pop.area.area_id} .targetName=${pop.area.name} .counts=${pop.area.counts} variant="popover" align="start"
                .actions=${this.bulkAllowed && pop.area.can_bulk === true} openHref=${`#/devices/areas/${encodeURIComponent(pop.area.area_id)}`} label=${pop.area.name}>
                <span slot="trigger" class="poptrig" aria-hidden="true"></span>
              </devices-bulk-menu>
            </div>`
          : nothing}
      </div>
    </div>`;
  }

  /** The plan floor to show: the viewer's pick, else the plan floor most of the selected tree floor's areas link to,
   * else the first floor with a plan. */
  private planFloorFor(t: DeviceTree, floors: PlanFloor[]): string | null {
    if (this.planFloorId && floors.some((f) => f.id === this.planFloorId)) return this.planFloorId;
    const treeFloor = this.selected !== 'all' ? t.floors.find((f) => f.floor_id === this.selected) : null;
    const votes = new Map<string, number>();
    for (const a of treeFloor?.areas ?? t.floors.flatMap((f) => f.areas)) if (a.map?.floor_id) votes.set(a.map.floor_id, (votes.get(a.map.floor_id) ?? 0) + 1);
    const best = [...votes.entries()].sort((x, y) => y[1] - x[1])[0]?.[0];
    if (best && floors.some((f) => f.id === best)) return best;
    return floors[0]?.id ?? null;
  }

  private async onAreaOpen(t: DeviceTree, e: CustomEvent<{ zone_id: string; zone_name: string; area_id: string | null; x: number; y: number }>) {
    const { area_id: areaId, x, y } = e.detail;
    const area = areaId ? t.floors.flatMap((f) => f.areas).find((a) => a.area_id === areaId) : undefined;
    if (!area) {
      this.planPop = null;
      return;
    }
    const host = (e.target as HTMLElement | null);
    const stage = host?.shadowRoot?.querySelector<HTMLElement>('[data-stage]') ?? host;
    const view = this.renderRoot.querySelector<HTMLElement>('[data-plan-view]');
    const sr = stage?.getBoundingClientRect();
    const vr = view?.getBoundingClientRect();
    this.planPop = { area, x: (sr && vr ? sr.left - vr.left : 0) + x, y: (sr && vr ? sr.top - vr.top : 0) + y };
    await this.updateComplete;
    this.renderRoot.querySelector<DevicesBulkMenu>('[data-plan-pop-menu]')?.showPanel();
  }

  private renderTreePanel(t: DeviceTree) {
    // the count column is always drawn (empty without lights), so the rows line up (owner 2026-09-29)
    const lit = (c: DeviceCounts) => (c.lights ? html`<span class=${classMap({ lit: true, warm: c.lights_on > 0 })} title="תאורה דולקת"><sw-icon name="light" size=${12}></sw-icon>${ltrNum(c.lights_on)}</span>` : html`<span class="lit" aria-hidden="true"></span>`);
    const floors = this.floorsOf(t);
    const foldable = floors.filter((f) => f.areas.length);
    const allFolded = foldable.length > 0 && foldable.every((f) => this.collapsed.has(f.floor_id));
    // owner 2026-10-01: each floor folds its area rows (a chevron at the start of its row, apart from the select button);
    // the same column beside "כל המבנה" carries the fold-all / unfold-all toggle
    const chev = (folded: boolean) => html`<sw-icon class=${classMap({ chev: true, folded })} name="chevronDown" size=${14}></sw-icon>`;
    // HOME-295 (owner answer 7): more floors than the cards hold - `more` lists the first ones in full and the rest behind "עוד N קומות";
    // `tree_scroll` lists every floor and the tree scrolls inside its own panel (the page itself never scrolls)
    const max = floorCardsMax(window.innerWidth);
    const many = this.layout === 'cards' && !this.lay.editing && floors.length > max;
    const scrollTree = many && this.screen.many_floors === 'tree_scroll';
    const hideRest = many && !scrollTree && !this.treeMore && !this.treeSheet;
    const rest = hideRest ? floors.slice(max).filter((f) => f.floor_id !== this.selected) : [];
    const listed = hideRest ? floors.filter((f) => !rest.includes(f)) : floors;
    const loose = t.unassigned.counts.entities > 0 && (this.layout === 'cards' || this.treeSheet);
    return html`<nav class="tree" aria-label="עץ המבנה" data-devices-tree ?data-tree-scroll=${scrollTree}>
      <div class="tree-floor tree-all">
        ${foldable.length > 1
          ? html`<button type="button" class="tfold" data-tree-fold-all aria-label=${allFolded ? 'הרחב הכל' : 'כווץ הכל'} title=${allFolded ? 'הרחב הכל' : 'כווץ הכל'} @click=${() => this.toggleAllFloors(floors)}>${chev(allFolded)}</button>`
          : html`<span class="tfold" aria-hidden="true"></span>`}
        <button class=${classMap({ 'tree-row': true, nomenu: true, selected: this.selected === 'all' })} data-tree="all" aria-current=${this.selected === 'all' ? 'true' : 'false'} @click=${() => (this.selected = 'all')}>
          <sw-icon name="building" size=${15}></sw-icon><span class="nm" title="כל המבנה">כל המבנה</span>${lit(t.building)}
        </button>
      </div>
      ${repeat(
        listed,
        (f) => f.floor_id,
        (f) => {
          const folded = f.areas.length > 0 && this.collapsed.has(f.floor_id);
          return html`<div class="tree-group" data-tree-floor=${f.floor_id} data-folded=${String(folded)}>
          <div class="tree-floor">
            ${f.areas.length
              ? html`<button type="button" class="tfold" data-tree-fold=${f.floor_id} aria-expanded=${String(!folded)} aria-label=${folded ? 'הרחב קומה' : 'כווץ קומה'} title=${folded ? 'הרחב קומה' : 'כווץ קומה'} @click=${() => this.setCollapsed(f.floor_id, !folded)}>${chev(folded)}</button>`
              : html`<span class="tfold" aria-hidden="true"></span>`}
            <button class=${classMap({ 'tree-row': true, nomenu: !(this.bulkAllowed && f.can_bulk), selected: this.selected === f.floor_id })} data-tree-select=${f.floor_id} aria-current=${this.selected === f.floor_id ? 'true' : 'false'} @click=${() => (this.selected = f.floor_id)}>
              <sw-icon name="floor" size=${14}></sw-icon><span class="nm" title=${f.name}>${bidi(f.name)}</span>${lit(f.counts)}
            </button>
            ${this.bulkAllowed && f.can_bulk
              ? html`<devices-bulk-menu scope="floor" .targetId=${f.floor_id} .targetName=${f.name} .counts=${f.counts} variant="menu" label="פעולות לקומה" data-bulk-floor=${f.floor_id}></devices-bulk-menu>`
              : nothing}
          </div>
          ${folded ? nothing : html`<div class="tree-areas">${repeat(f.areas, (a) => a.area_id, (a) => this.renderAreaRow(a, 'tree'))}</div>`}
        </div>`;
        },
      )}
      ${rest.length ? html`<button type="button" class="tree-more" data-tree-more=${rest.length} aria-expanded="false" @click=${() => (this.treeMore = true)}><sw-icon name="floor" size=${14}></sw-icon>${hs('moreFloors', { n: rest.length })}</button>` : nothing}
      ${loose
        ? html`<a class="tree-row tree-loose" data-tree-unassigned href="#/devices/areas/unassigned" @click=${(e: MouseEvent) => this.onAreaLink(e, 'unassigned', t.unassigned.name)}><sw-icon name="help" size=${15}></sw-icon><span class="nm">${t.unassigned.name}</span><span class="lit">${ltrNum(t.unassigned.counts.entities)}</span></a>`
        : nothing}
    </nav>`;
  }

  private renderFloorCard(f: DeviceFloor) {
    const c = f.counts;
    const it = this.lay.item(`floor:${f.floor_id}`); // CR-007 6b: the layout's own title and icon
    return html`<section class="fcard" data-floor-card=${f.floor_id} data-lay-key=${`floor:${f.floor_id}`}>
      <header>
        <div class="fh-top">
          ${it?.icon ? html`<sw-icon class="lay-title-icon" .name=${it.icon} size=${16}></sw-icon>` : nothing}
          <h2><button type="button" class="ftitle" data-floor-title=${f.floor_id} data-lines=${this.floorTitleLines} aria-current=${this.selected === f.floor_id ? 'true' : 'false'} title=${`${titleOf(it, f.name)} · פתח קומה`} @click=${() => (this.selected = f.floor_id)}>${bidi(titleOf(it, f.name))}</button></h2>
          ${this.bulkAllowed && f.can_bulk ? this.renderFloorOff(f) : nothing}
        </div>
        <div class="fh-chips">
          ${c.lights && this.hasFloorItem('lights') ? html`<button type="button" class=${classMap({ lit: true, chip: true, warm: c.lights_on > 0 })} data-lit=${c.lights_on} data-floor-chip="lights" aria-haspopup="dialog" aria-expanded=${String(this.isOpen('lights', 'floor', f.floor_id))} title=${`תאורה · ${f.name}`} @click=${() => this.openPanel('lights', 'floor', f.floor_id)}><sw-icon name="light" size=${13}></sw-icon>${ltrNum(c.lights_on)} דולקות מתוך ${ltrNum(c.lights)}</button>` : nothing}
          <span class="fchips" data-floor-chips=${f.floor_id}>${this.renderFloorChips(f, 12, true)}</span>
        </div>
      </header>
      <div class="rows">
        ${f.areas.length ? repeat(f.areas, (a) => a.area_id, (a) => this.renderAreaRow(a, 'card')) : html`<div class="arow empty">אין אזורים בקומה</div>`}
      </div>
      ${this.selected !== f.floor_id
        ? html`<footer><sw-button size="sm" icon="floor" data-open-floor=${f.floor_id} @click=${() => (this.selected = f.floor_id)}>פתח קומה</sw-button></footer>`
        : html`<footer><sw-button size="sm" variant="ghost" data-open-floor="all" @click=${() => (this.selected = 'all')}>כל המבנה</sw-button></footer>`}
    </section>`;
  }

  /** What sits after an area's name on its row (release 0.1.149): the indicators of the installation's / the user's list, on ONE line
   * - a phone shows at most three, a wider screen six - and the rest as "+N"; a tap anywhere on the row opens the area. */
  private renderIndicators(a: DeviceArea) {
    const c = a.counts;
    if (c.entities === 0) return html`<span class="ind none" data-area-indicators="">אין התקנים</span>`;
    const list = areaIndicators(a, this.rows.area);
    const { shown, hidden } = splitRow(list, this.isPhone ? ROW_MAX_PHONE : ROW_MAX_WIDE);
    const one = (i: Indicator) => html`<span class=${classMap({ i: true, warm: i.warm, dim: i.dim, heat: i.icon === 'flame' })} data-ind=${i.id} title=${i.title}><sw-icon name=${i.icon} size=${14}></sw-icon>${i.text ? html`<span class="t">${i.text}</span>` : nothing}</span>`;
    return html`<span class="ind" data-area-indicators=${list.map((i) => i.id).join(' ')}>${shown.map(one)}${hidden.length ? html`<span class="i more" data-ind-more=${hidden.length} title=${hidden.map((i) => i.title).join(' · ')}>${ltrNum(`+${hidden.length}`)}</span>` : nothing}</span>`;
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
    // the bubble skin: the state dot is a hue ring with the area's icon (decoration only; the lit halo says something is on)
    const bubble = this.skin.bubble;
    const it = bubble ? this.lay.item(`area:${a.area_id}`) : undefined;
    const dot = html`<span class=${classMap({ sdot: true, on })}>${bubble ? html`<sw-icon .name=${it?.icon ?? (unassigned ? 'help' : 'home')} size=${where === 'tree' ? 12 : 18}></sw-icon>` : nothing}</span>`;
    const hueStyle = bubble && !unassigned ? `--h:var(--sw-hue-${hueOf(a.area_id)})` : '';
    // HOME-295 (owner answer 2): the cards-mode row carries the area's first two quick actions (row_actions = quick) - the room
    // temperature, the alarm text or the time of the last values before them; `indicators` keeps the row of 0.1.149
    const quickRow = where === 'card' && !unassigned && this.screen.row_actions === 'quick';
    const bad = !unassigned && c.alarm === 'triggered';
    const mid = bad
      ? html`<span class="btx" data-area-alert>${hs('alarmTriggered')}</span>`
      : this.offline
        ? html`<span class="tm" data-area-stale>${this.lastOkTime()}</span>`
        : showRoomTemp(a, this.screen.tile_climate)
          ? html`<span class="tm" data-area-temp>${ltrNum(`${(a.temperature as number).toFixed(1)}°`)}</span>`
          : nothing;
    const body =
      where === 'tree'
        ? html`${dot}<span class="nm" dir="auto" title=${a.name}>${bidi(a.name)}</span>${c.lights ? html`<span class=${classMap({ lit: true, warm: c.lights_on > 0 })} title="תאורה דולקת"><sw-icon name="light" size=${12}></sw-icon>${ltrNum(c.lights_on)}</span>` : html`<span class="lit" aria-hidden="true"></span>`}`
        : quickRow
          ? html`${dot}<span class="nm" dir="auto" title=${a.name}>${bidi(a.name)}</span>${mid}`
          : html`${dot}<span class="nm" title=${a.name}>${bidi(a.name)}</span>${this.renderIndicators(a)}`;
    const attrs = { area: a.area_id, on: String(on), counts: countsAttr(pills) };
    if (unassigned) {
      return html`<a class=${where === 'tree' ? 'tree-row' : 'arow'} href=${href} data-area-row=${attrs.area} data-on=${attrs.on} data-counts=${attrs.counts} style="text-decoration:none">${body}</a>`;
    }
    const menu = html`<devices-bulk-menu block hover scope="area" .targetId=${a.area_id} .targetName=${a.name} .counts=${c} variant="popover" align="start" .actions=${bulk} openHref=${href} mapHref=${mapHrefForArea(a.map) ?? ''} label="סיכום האזור"
        data-tree-area=${where === 'tree' ? a.area_id : nothing} data-card-area=${where === 'card' ? a.area_id : nothing}>
        <a slot="trigger" class=${where === 'tree' ? 'tree-row' : 'arow'} href=${href} data-area-row=${attrs.area} data-on=${attrs.on} data-counts=${attrs.counts} style=${hueStyle || nothing} aria-label=${`${a.name} · ${c.entities} התקנים · כניסה לאזור`} @click=${(e: MouseEvent) => this.onAreaLink(e, a.area_id, a.name)}>${body}</a>
      </devices-bulk-menu>`;
    if (quickRow) {
      return html`<div class="arow-q" data-area-quick-row=${a.area_id} ?data-lit=${on && !this.offline && !bad} ?data-bad=${bad}>${menu}${this.renderQuick(a, rowQuickMax(window.innerWidth), true)}</div>`;
    }
    if (where === 'card') return menu;
    return html`<div class="tree-area">
      ${menu}
      ${bulk
        ? html`<span class="quick"><sw-button size="sm" variant="ghost" icon="bolt" data-quick-off=${a.area_id} label=${`כבה אזור: ${a.name}`} @click=${() => void this.dialog?.show({ scope: 'area', id: a.area_id, name: a.name, kind: 'all_off' })}>כבה אזור</sw-button></span>`
        : nothing}
    </div>`;
  }

  /** The building's summary tiles. Owner 2026-09-29: each is a real button (aria-expanded) opening the tiles' panel for
   * its kind across the building, in the installation's tile shape (ui.tile_layout: cards or compact). */
  private renderKpis(c: DeviceCounts, hideAlarm = false) {
    // owner notes 2026-09-30: small rectangles with the icon at the END of the text (the left side in Hebrew) - the
    // installation's tile shape only decides whether an explicit "כרטיסים" (tall cards) is kept
    void this.tiles.layout; // the controller re-renders this screen when the tile shape changes
    const layout = effectiveTileSetting() === 'cards' ? 'cards' : 'compact';
    const open = (kind: TileKind) => () => this.openPanel(kind);
    // owner feedback 2026-09-29: a domain the installation has nothing of is not a counter at all (no "0/0 אין במבנה")
    // POLISH-295: "5 / 12" reads as a count of a total (spaced, tabular), and a counter that has something on takes its kind's colour -
    // light, switches and screens warm, cooling cool, heating amber; everything else keeps the live green
    const stale = this.offline; // HOME-295: no connection - the counters show a dash, never an old number as if current
    const kpi = (label: string, on: number, total: number, icon: IconName, kind: TileKind, warm = true) =>
      !total
        ? nothing
        : html`<sw-kpi data-kpi=${label} data-tile-kind=${kind} data-value=${`${on}/${total}`} label=${label} value=${stale ? '–' : `${on} / ${total}`} .icon=${icon} tone=${warm && on > 0 && !stale ? 'live' : 'neutral'} layout=${layout} icon-end action ?expanded=${this.isOpen(kind)} hint="הצג ושלוט" @click=${open(kind)}></sw-kpi>`;
    // HOME-295 (owner answer 3): the tiles shown are the administrator's choice (or the user's, when the installation lets users choose),
    // in the chosen order; every kind the site has by default. Sensors and cameras are counts (no panel behind them).
    const off = this.offline;
    const count = (label: string, total: number, icon: IconName, kind: string) =>
      html`<sw-kpi data-kpi=${label} data-tile-kind=${kind} data-value=${String(total)} label=${label} value=${off ? '–' : String(total)} .icon=${icon} tone="neutral" layout=${layout} icon-end></sw-kpi>`;
    const one: Record<SummaryKind, () => unknown> = {
      lights: () => kpi('תאורה דולקת', c.lights_on, c.lights, 'light', 'lights'),
      switches: () => kpi('מתגים פעילים', c.switches_on, c.switches, 'bolt', 'switches'),
      covers: () => kpi('תריסים פתוחים', c.covers_open, c.covers, 'layers', 'covers'),
      climate: () => kpi('מיזוג פעיל', c.climate_active, c.climate, 'snow', 'climate'),
      heating: () => kpi('חימום פעיל', c.heating_active, c.heating, 'flame', 'heating'),
      media: () => kpi('מסכים דולקים', c.media_on, c.media, 'play', 'media'),
      locks: () => html`<sw-kpi data-kpi="נעולים" data-tile-kind="locks" data-value=${`${c.locks_locked}/${c.locks}`} label="מנעולים נעולים" value=${`${c.locks_locked} / ${c.locks}`} icon="lock" tone=${c.locks_locked === c.locks ? 'live' : 'stale'} detail=${c.locks_locked === c.locks ? 'הכול נעול' : 'יש מנעול פתוח'} layout=${layout} icon-end action ?expanded=${this.isOpen('locks')} hint="הצג ושלוט" @click=${open('locks')}></sw-kpi>`,
      sensors: () => count('חיישנים', c.sensors, 'sensor', 'sensors'),
      cameras: () => count('מצלמות', c.cameras, 'camera', 'cameras'),
      alarm: () => (c.alarm && !hideAlarm ? html`<sw-kpi data-kpi="אזעקה" data-tile-kind="alarm" label="אזעקה" value=${ALARM_HE[c.alarm] ?? c.alarm} icon="shield" tone=${alarmTone(c.alarm)} layout=${layout} icon-end action ?expanded=${this.isOpen('alarm')} hint="הצג" @click=${open('alarm')}></sw-kpi>` : nothing),
    };
    const kinds = summaryKindsShown(this.screen, c);
    // (one row on a control screen: the chosen tiles share it - the mockup)
    return html`<div class="kpis" data-kpis data-summary=${kinds.join(' ')} style=${`--kn:${Math.max(1, kinds.length)}`}>${kinds.map((k) => one[k]())}</div>`;
  }

  /** A floor's count pills as buttons (owner 2026-09-29): each opens the tiles' panel for its kind on that floor;
   * cameras and sensors stay plain counts. */
  private renderFloorChips(f: DeviceFloor, size: number, card = false) {
    // the floor card (owner 2026-09-29): switches / covers / climate / locks / screens next to its own lights count
    // (the card's lit count is the lights chip), icon + number only - the words in the tooltip and the aria-label
    const pills = this.floorPills(f.counts).filter((p) => !card || (p.key !== 'lights' && PILL_KIND[p.key]));
    const chip = (kind: TileKind | undefined, key: string, icon: IconName, text: string, title: string, warm: boolean) =>
      kind
        ? html`<button type="button" class=${classMap({ chip: true, warm })} data-floor-chip=${kind} aria-haspopup="dialog" aria-expanded=${String(this.isOpen(kind, 'floor', f.floor_id))} title=${`${title} · ${f.name}`} aria-label=${`${title}: ${text} · ${f.name}`} @click=${() => this.openPanel(kind, 'floor', f.floor_id)}><sw-icon .name=${icon} size=${size}></sw-icon>${text}</button>`
        : html`<span class=${classMap({ chip: true, warm })} data-floor-count=${key} title=${title}><sw-icon .name=${icon} size=${size}></sw-icon>${text}</span>`;
    return html`${pills.map((p) => chip(PILL_KIND[p.key], p.key, p.icon, p.on === null ? String(p.total) : `${p.on}/${p.total}`, p.label, p.warm))}
      ${f.counts.alarm && !card ? chip('alarm', 'alarm', 'shield', ALARM_HE[f.counts.alarm] ?? f.counts.alarm, 'אזעקה', f.counts.alarm !== 'disarmed') : nothing}`;
  }

  private renderFloor(f: DeviceFloor) {
    return html`<section class=${classMap({ floor: true, laid: this.lay.gridOn(`areas:${f.floor_id}`) })} style=${`--n:${Math.min(4, Math.max(1, f.areas.length))}`} data-floor=${f.floor_id}>
      <div class="floor-head">
        <h2>${bidi(f.name)}</h2>
        ${f.level !== null && f.floor_id !== 'none' ? html`<span class="level">מפלס ${ltrNum(f.level)}</span>` : nothing}
        <span class="level">${f.areas.length} אזורים</span>
        ${this.bulkAllowed && f.can_bulk
          ? html`<devices-bulk-menu scope="floor" .targetId=${f.floor_id} .targetName=${f.name} .counts=${f.counts} variant="menu" align="start" label="פעולות לקומה" data-bulk-floor=${f.floor_id}></devices-bulk-menu>`
          : nothing}
        <div class="floor-sum" data-floor-sum=${f.floor_id}>${this.renderFloorChips(f, 13)}</div>
      </div>
      ${this.renderAreasGrid(`areas:${f.floor_id}`, html`${repeat(f.areas, (a) => a.area_id, (a) => this.lay.wrap(`area:${a.area_id}`, this.renderTile(a)))}`)}
    </section>`;
  }

  /** A floor's area tiles: the automatic grid, or (CR-007 6b) the laid-out one. */
  private renderAreasGrid(id: string, content: unknown) {
    const g = this.gridAttrs(id);
    return html`<div class=${classMap({ areas: true, 'lay-grid': g.on })} data-lay-grid=${id} data-lay-cols=${g.cols} ?data-lay-phone-preview=${g.phone}>${content}</div>`;
  }

  // ---------------------------------------------------------------------------------- HOME-295: the new pieces of the approved mockup

  /** When the values on screen were last read (the live controller's last good read, else the last HA event), as HH:MM. */
  private lastOkTime(): string {
    if (!isApi()) return timeText(new Date(Date.now() - 4 * 60_000));
    const at = this.live.lastOkAt() ?? (this.sync?.last_event_at ? new Date(this.sync.last_event_at).getTime() : null);
    return at ? timeText(new Date(at)) : '–';
  }

  /** An area link (AREAPOPUP-297): the press opens the quick-control pop-up - a phone's bottom sheet (phone_area = sheet), the desktop's side
   * drawer or pop-up (desktop_area) - growing out of the pressed element; otherwise (the "screen" choices, a modifier key) the link navigates. */
  private onAreaLink(e: MouseEvent, id: string, _name: string) {
    if (this.lay.editing || e.defaultPrevented || e.metaKey || e.ctrlKey || e.button !== 0) return;
    const mode = pressTarget(this.isPhone, this.screen.phone_area, this.screen.desktop_area);
    if (mode === 'screen') return;
    const found = this.findArea(id);
    if (!found) return;
    e.preventDefault();
    const el = (e.currentTarget as HTMLElement | null) ?? (e.target as HTMLElement | null);
    const r = el?.getBoundingClientRect();
    this.treeSheet = false;
    this.openQuick(found.area, found.floorName, mode, r ? { x: r.left, y: r.top, w: r.width, h: r.height } : null);
  }

  private findArea(id: string): { area: DeviceArea; floorName: string } | null {
    for (const f of this.tree?.floors ?? []) for (const a of f.areas) if (a.area_id === id) return { area: a, floorName: f.floor_id === 'none' ? '' : f.name };
    return null;
  }

  private openQuick(area: DeviceArea, floorName: string, mode: QuickMode, origin: Box | null) {
    this.quick = { area, floorName, mode, origin };
  }

  private openArea(a: { area_id: string; name: string }) {
    const mode = pressTarget(this.isPhone, this.screen.phone_area, this.screen.desktop_area);
    const found = mode === 'screen' ? null : this.findArea(a.area_id);
    if (found && mode !== 'screen') this.openQuick(found.area, found.floorName, mode, null);
    else location.hash = `#/devices/areas/${encodeURIComponent(a.area_id)}`;
  }

  /** The pop-up's group action: the same confirmation dialog as the tiles and the tree (the server authorises it again). */
  private onQuickBulk(e: CustomEvent<{ kind: BulkKind; position?: number; area: DeviceArea }>) {
    const { kind, position, area } = e.detail;
    if (!this.bulkAllowed || area.can_bulk !== true) return;
    void this.dialog?.show({ scope: 'area', id: area.area_id, name: area.name, kind, position });
  }

  /** A quick action pressed: a bulk action through the confirmation dialog (the server authorises it again) - or, for a viewer without
   * the bulk permission there / an action that has no bulk form (turning an air conditioner on), the area itself. */
  private onQuickAct(e: Event, a: DeviceArea, kind: BulkKind | null) {
    e.preventDefault();
    e.stopPropagation();
    this.coverMenu = '';
    if (this.lay.editing || this.offline) return;
    if (kind && this.bulkAllowed && a.can_bulk === true) void this.dialog?.show({ scope: 'area', id: a.area_id, name: a.name, kind });
    else this.openArea(a);
  }

  /** The quick actions of one area: ONE builder for the tile (tiles view) and the row (cards view, `small`). */
  private renderQuick(a: DeviceArea, max: number, small: boolean) {
    const kinds = areaQuick(this.screen, a, max);
    if (!kinds.length) return nothing;
    return html`<span class=${classMap({ qa: true, sm: small })} data-quick=${a.area_id} data-quick-kinds=${kinds.join(' ')}>${kinds.map((k) => this.quickButton(a, k, small))}</span>`;
  }

  private quickButton(a: DeviceArea, k: QuickKind, small: boolean) {
    const c = a.counts;
    const sz = small ? 13 : 15;
    const off = this.offline;
    const label = (what: string) => `${what} · ${a.name}`;
    if (k === 'lights') {
      const on = c.lights_on > 0;
      return html`<button type="button" class="qb l" data-quick-kind="lights" aria-pressed=${String(on && !off)} ?disabled=${off} aria-label=${label(hs('qLights'))} title=${label(hs('qLights'))} @click=${(e: Event) => this.onQuickAct(e, a, on ? 'lights_off' : 'lights_on')}><sw-icon name="light" size=${sz}></sw-icon>${ltrNum(`${c.lights_on}/${c.lights}`)}</button>`;
    }
    if (k === 'switches') {
      const on = c.switches_on > 0;
      return html`<button type="button" class="qb s" data-quick-kind="switches" aria-pressed=${String(on && !off)} ?disabled=${off} aria-label=${label(hs('qSwitches'))} title=${label(hs('qSwitches'))} @click=${(e: Event) => this.onQuickAct(e, a, on ? 'switches_off' : 'switches_on')}><sw-icon name="bolt" size=${sz}></sw-icon>${ltrNum(`${c.switches_on}/${c.switches}`)}</button>`;
    }
    if (k === 'climate') {
      const q = climateQuick(a, this.screen.tile_climate);
      const text = q.label === 'off' ? hs('climateOff') : q.label === 'on' ? hs('climateOn') : ltrNum(`${Math.round(q.target as number)}°`);
      return html`<button type="button" class=${classMap({ qb: true, c: !q.heat, h: q.heat })} data-quick-kind="climate" aria-pressed=${String(q.on && !off)} ?disabled=${off} aria-label=${label(hs('qClimate'))} title=${label(hs('qClimate'))} @click=${(e: Event) => this.onQuickAct(e, a, q.on ? 'climate_off' : null)}><sw-icon name=${q.heat ? 'flame' : 'snow'} size=${sz}></sw-icon>${text}</button>`;
    }
    // covers: a count that offers open / stop / close (pct), or the two direct buttons (buttons)
    if (this.screen.tile_blinds === 'buttons') {
      return html`<button type="button" class="qb ico" data-quick-kind="covers_open" ?disabled=${off} aria-label=${label(hs('openBlinds'))} title=${label(hs('openBlinds'))} @click=${(e: Event) => this.onQuickAct(e, a, 'covers_open')}><sw-icon name="arrowUp" size=${sz}></sw-icon></button><button type="button" class="qb ico" data-quick-kind="covers_close" ?disabled=${off} aria-label=${label(hs('closeBlinds'))} title=${label(hs('closeBlinds'))} @click=${(e: Event) => this.onQuickAct(e, a, 'covers_close')}><sw-icon name="arrowDown" size=${sz}></sw-icon></button>`;
    }
    const open = this.coverMenu === a.area_id;
    return html`<button type="button" class="qb" data-quick-kind="covers" aria-expanded=${String(open)} ?disabled=${off} aria-label=${label(hs('qCovers'))} title=${label(hs('qCovers'))} @click=${(e: Event) => { e.preventDefault(); e.stopPropagation(); this.coverMenu = open ? '' : a.area_id; }}><sw-icon name="layers" size=${sz}></sw-icon>${ltrNum(`${c.covers_open}/${c.covers}`)}</button>${open
      ? html`<span class="cmenu" role="group" data-cover-menu=${a.area_id} aria-label=${label(hs('qCovers'))}>
          <button type="button" class="qb ico" data-cover="open" aria-label=${hs('coversOpen')} title=${hs('coversOpen')} @click=${(e: Event) => this.onQuickAct(e, a, 'covers_open')}><sw-icon name="arrowUp" size=${sz}></sw-icon></button>
          <button type="button" class="qb ico" data-cover="stop" aria-label=${hs('coversStop')} title=${hs('coversStop')} @click=${(e: Event) => this.onQuickAct(e, a, 'covers_stop')}><sw-icon name="stopSquare" size=${sz - 2}></sw-icon></button>
          <button type="button" class="qb ico" data-cover="close" aria-label=${hs('coversClose')} title=${hs('coversClose')} @click=${(e: Event) => this.onQuickAct(e, a, 'covers_close')}><sw-icon name="arrowDown" size=${sz}></sw-icon></button>
        </span>`
      : nothing}`;
  }

  /** The floor card's "turn off" control (owner answer 6): one button with a menu (default) or two direct buttons - lights / all. */
  private renderFloorOff(f: DeviceFloor) {
    if (this.screen.floor_off === 'buttons') {
      const off = this.offline;
      return html`<span class="foff" data-floor-off=${f.floor_id}>
        <button type="button" data-floor-off-kind="lights_off" ?disabled=${off} title=${hs('offFloorLights')} aria-label=${`${hs('offFloorLights')} · ${f.name}`} @click=${() => void this.dialog?.show({ scope: 'floor', id: f.floor_id, name: f.name, kind: 'lights_off' })}><sw-icon name="light" size=${14}></sw-icon>${hs('offLights')}</button>
        <button type="button" class="danger" data-floor-off-kind="all_off" ?disabled=${off} title=${hs('offFloorAll')} aria-label=${`${hs('offFloorAll')} · ${f.name}`} @click=${() => void this.dialog?.show({ scope: 'floor', id: f.floor_id, name: f.name, kind: 'all_off' })}><sw-icon name="bolt" size=${14}></sw-icon>${hs('offAll')}</button>
      </span>`;
    }
    return html`<devices-bulk-menu class=${this.offline ? 'off-dim' : ''} scope="floor" .targetId=${f.floor_id} .targetName=${f.name} .counts=${f.counts} variant="menu" triggerLabel="כבה קומה" data-floor-menu=${f.floor_id}></devices-bulk-menu>`;
  }

  /** The rows above the summary (owner: one row per alert, at most three; no paragraphs): the triggered alarms, or "no connection". */
  private renderBanner(t: DeviceTree) {
    if (this.lay.editing) return nothing;
    if (this.offline) {
      return html`<div class="conn" role="status" data-home-offline><sw-icon name="offline" size=${17}></sw-icon><b>${hs('offline')}</b>${this.isPhone ? nothing : html`<span class="w">${hs('valuesFrom', { t: this.lastOkTime() })}</span>`}
        <span class="gx"><span class="spin" aria-hidden="true"></span>${this.isPhone ? nothing : html`<span class="w">${hs('reconnecting')}</span>`}<button type="button" class="abtn" data-home-retry @click=${() => { this.live.refreshAll([]); void this.load(); }}>${hs('retry')}</button></span></div>`;
    }
    const list = homeAlerts(t, this.isPhone ? 2 : 3).filter((x) => !this.acked.includes(`${x.scope}:${x.id}`));
    if (!list.length) return nothing;
    return html`<div class="alerts" role="alert" data-home-alerts=${list.length}>${list.map((x) => {
      const key = `${x.scope}:${x.id}`;
      const where = x.scope === 'building' ? '' : x.name;
      const area = x.scope === 'area' ? t.floors.flatMap((f) => f.areas).find((a) => a.area_id === x.id) : undefined;
      return html`<div class="al" data-home-alert=${key}><sw-icon name="shield" size=${17}></sw-icon><b>${hs('alarmTriggered')}</b>${where ? html`<span class="w">${bidi(where)}</span>` : nothing}
        <span class="gx">${this.isPhone
          ? nothing
          : area
            ? html`<button type="button" class="abtn" data-alert-open @click=${() => this.openArea(area)}>${hs('openArea')}</button>`
            : canAnywhere('alarm.view') || !isApi()
              ? html`<button type="button" class="abtn" data-alert-security @click=${() => (location.hash = '#/security/alarm')}>${hs('toSecurity')}</button>`
              : nothing}
          <button type="button" class="abtn" data-alert-ack aria-label=${hs('ack')} @click=${() => (this.acked = [...this.acked, key])}>${hs('ack')}</button></span></div>`;
    })}</div>`;
  }

  /** Phone (owner): one floor at a time - the floor switch and the "עץ" button that opens the whole tree in a sheet. */
  private phoneFloorOf(floors: DeviceFloor[]): DeviceFloor | undefined {
    return floors.find((f) => f.floor_id === this.selected) ?? floors[0];
  }

  private renderPhoneFloors(t: DeviceTree) {
    const floors = this.floorsOf(t);
    if (!floors.length) return nothing;
    const cur = this.phoneFloorOf(floors);
    return html`<div class="pfl" data-phone-floors>
      <button type="button" class="treebtn" data-phone-tree aria-haspopup="dialog" @click=${() => (this.treeSheet = true)}><sw-icon name="list" size=${16}></sw-icon>${hs('tree')}</button>
      ${floors.length > 1
        ? html`<span class="segs" role="group" aria-label=${hs('floorsLabel')}><button type="button" data-phone-floor="all" aria-pressed=${String(this.selected === 'all')} @click=${() => (this.selected = 'all')}>${hs('allFloors')}</button>${floors.map((f) => html`<button type="button" data-phone-floor=${f.floor_id} aria-pressed=${String(this.selected !== 'all' && f.floor_id === cur?.floor_id)} @click=${() => (this.selected = f.floor_id)}>${bidi(f.name)}</button>`)}</span>`
        : nothing}
    </div>`;
  }

  /** The phone's sheet: the floor tree (an area opens in the quick-control sheet, AREAPOPUP-297). */
  private renderSheets(t: DeviceTree) {
    if (!this.isPhone) return nothing;
    if (this.treeSheet) {
      return html`<div class="scrim" @click=${() => (this.treeSheet = false)}></div>
        <div class="hsheet" role="dialog" aria-modal="true" aria-label=${hs('treeTitle')} data-tree-sheet
          @click=${(e: Event) => { if ((e.composedPath() as Element[]).some((n) => n instanceof HTMLElement && n.dataset?.treeSelect !== undefined)) this.treeSheet = false; }}>
          <div class="grab" aria-hidden="true"></div>
          <div class="sh"><b>${hs('treeTitle')}</b><button type="button" class="x" aria-label=${hs('close')} @click=${() => (this.treeSheet = false)}><sw-icon name="close" size=${15}></sw-icon></button></div>
          ${this.renderTreePanel(t)}
        </div>`;
    }
    return nothing;
  }

  /** AREAPOPUP-297: the one quick-control element of the screen (closed = out of the way; the same element serves every area). */
  private renderQuickSheet() {
    const q = this.quick;
    const live = q ? (this.findArea(q.area.area_id)?.area ?? q.area) : null; // the tree's fresh counts while it is open
    const it = q ? this.lay.item(`area:${q.area.area_id}`) : undefined;
    return html`<area-quick-sheet data-area-quick=${q?.area.area_id ?? nothing} .area=${live} .floorName=${q?.floorName ?? ''} .icon=${it?.icon ?? 'home'} .mode=${q?.mode ?? 'drawer'} ?open=${!!q}
      .origin=${q?.origin ?? null} ?canBulk=${this.bulkAllowed} ?offline=${this.offline} @close=${() => (this.quick = null)} @area-bulk=${this.onQuickBulk}></area-quick-sheet>`;
  }

  private renderTile(a: DeviceArea, unassigned = false) {
    const c = a.counts;
    const pills = this.pillsShown(c);
    const on = anythingOn(c) && !this.offline;
    const bulk = !unassigned && this.bulkAllowed && a.can_bulk === true;
    const it = this.lay.item(`area:${a.area_id}`); // CR-007 6b: the layout's own title and icon
    const bubble = this.skin.bubble;
    // HOME-295: the area's quick actions on the bottom line (its own choice, home.screen.area_quick), the room temperature in the head
    // (tile_climate), the alarm colours the tile, and with no connection the last values are grey with their time
    const quick = unassigned ? nothing : this.renderQuick(a, tileQuickMax(window.innerWidth), false);
    const bad = !unassigned && a.counts.alarm === 'triggered';
    const temp = !unassigned && showRoomTemp(a, this.screen.tile_climate) ? html`<span class="tmp" data-area-temp>${ltrNum(`${(a.temperature as number).toFixed(1)}°`)}</span>` : nothing;
    const sub = bad
      ? html`<div class="sub bad" data-area-alert>${hs('alarmTriggered')}</div>`
      : this.offline && !unassigned
        ? html`<div class="sub" data-area-stale>${hs('lastUpdate', { t: this.lastOkTime() })}</div>`
        : quick !== nothing
          ? nothing // the quick row carries the counts (the mockup: name, temperature, the actions - no second line of counts)
          : html`<div class="pills">${this.renderIndicators(a)}</div>`;
    return html`<div class=${classMap({ 'tile-wrap': true, bulk, 'has-qa': quick !== nothing })} data-lay-key=${`area:${a.area_id}`}><a
      class=${classMap({ tile: true, on, empty: c.entities === 0, unassigned })}
      href=${`#/devices/areas/${encodeURIComponent(a.area_id)}`}
      data-area=${a.area_id}
      data-on=${String(on)}
      ?data-bad=${bad}
      data-counts=${pills.map((p) => `${p.key}:${p.on === null ? p.total : `${p.on}/${p.total}`}`).join(' ')}
      style=${bubble && !unassigned ? `--h:var(--sw-hue-${hueOf(a.area_id)})${on ? ';--sw-m-tone:var(--sw-lit);--sw-m-on:1' : ''}` : nothing}
      aria-label=${`${a.name} · ${c.entities} התקנים`}
      @click=${(e: MouseEvent) => this.onAreaLink(e, a.area_id, a.name)}
    >
      <div class="tile-head">
        ${bubble ? html`<span class="ring"><sw-icon .name=${it?.icon ?? (unassigned ? 'help' : 'home')} size=${18}></sw-icon></span>` : nothing}
        <sw-icon .name=${bad ? 'warning' : it?.icon ?? (unassigned ? 'help' : 'home')} size=${16}></sw-icon>
        <span class="name">${bidi(titleOf(it, a.name))}</span>
        ${temp}
        ${on ? html`<span class="dot" title="יש התקן פעיל"></span>` : nothing}
      </div>
      ${sub}
    </a>${quick}${bulk
      ? html`<devices-bulk-menu scope="area" .targetId=${a.area_id} .targetName=${a.name} .counts=${c} variant="popover" label="פעולות לאזור" data-bulk-area=${a.area_id}></devices-bulk-menu>`
      : nothing}</div>`;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'devices-building': DevicesBuilding;
  }
}
