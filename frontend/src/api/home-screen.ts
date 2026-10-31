/**
 * HOME-295 (owner answers on the home mockup round 2, 2026-10-25): the home screen's display options. Every answer is only the DEFAULT;
 * each one is changeable in the screen settings (installer / administrator, system.configure) - one installation setting `home.screen`
 * (GET /settings, read back as an object with every key; keep in step with smplwise_vms/backend/smplwise/services/home_screen_options.py,
 * tests/test_home_screen_options_295.py compares the lists). A holder of screen.personalize may choose his own summary tiles (only while
 * the installation lets users choose: summary_chooser = user) and how an area opens on his phone (/me/prefs `home.personal.screen`).
 *
 * The other choices of the same answers live in their existing keys (one key per choice): the view `devices.default_view` (cards by
 * default), the info row `home.info_style` (auto: cards in the cards view, the thin bar in tiles - api/screen-display.ts) and the customer
 * logo on dark `brand.dark_mode` (invert by default - design/brand-logo.ts).
 * Pure logic + the read / write helpers; nothing here draws.
 */
import { patch } from './client';
import { invalidateSettings, productSettings } from './prefs';
import { isApi } from './session';
import type { DeviceArea, DeviceCounts, DeviceFloor } from './devices';
import type { InfoStyle } from './screen-display';
import { popupOf, type PopupState } from './popup-layout';

export type SummaryKind = 'lights' | 'switches' | 'covers' | 'climate' | 'heating' | 'media' | 'locks' | 'sensors' | 'cameras' | 'alarm';
export const SUMMARY_KINDS: readonly SummaryKind[] = ['lights', 'switches', 'covers', 'climate', 'heating', 'media', 'locks', 'sensors', 'cameras', 'alarm'];
export type QuickKind = 'lights' | 'climate' | 'covers' | 'switches';
export const QUICK_KINDS: readonly QuickKind[] = ['lights', 'climate', 'covers', 'switches'];
/** An area nobody configured shows the kinds it has, in QUICK_KINDS order, at most this many. */
export const DEFAULT_QUICK_MAX = 3;

export type SummaryChooser = 'admin' | 'user';
export type RowActions = 'quick' | 'indicators';
export type TileBlinds = 'pct' | 'buttons';
export type TileClimate = 'both' | 'target' | 'room';
export type PhoneArea = 'sheet' | 'full';
/** AREAPOPUP-297: how an area opens on a desktop / tablet - the quick-control side drawer (default), the pop-up that grows out of the tile, or its screen. */
export type DesktopArea = 'drawer' | 'popup' | 'screen';
export type FloorOff = 'menu' | 'buttons';
export type ManyFloors = 'more' | 'tree_scroll';
export type BuildingOffTablet = 'hide' | 'keep';
export type QuickCard = 'show' | 'hide';
export type PhoneFloors = 'selector' | 'all';
/** AREAEDIT-2290: a section's sensor the manager hid appears in the area pop-up, red, only while it is in alarm (show), or stays hidden (hide). */
export type PopupAlert = 'show' | 'hide';

/** The single-choice options: every value, in the order the settings show them (the first is not necessarily the default). */
export const CHOICES = {
  summary_chooser: ['admin', 'user'],
  row_actions: ['quick', 'indicators'],
  tile_blinds: ['pct', 'buttons'],
  tile_climate: ['both', 'target', 'room'],
  phone_area: ['sheet', 'full'],
  desktop_area: ['drawer', 'popup', 'screen'],
  floor_off: ['menu', 'buttons'],
  many_floors: ['more', 'tree_scroll'],
  building_off_tablet: ['hide', 'keep'],
  quick_card: ['show', 'hide'],
  phone_floors: ['selector', 'all'],
  popup_alert: ['show', 'hide'],
  // MULTIBUILDING-HOME-2330: a site of several buildings only - where the home opens, and whether "כבה הכל באתר" checks the shared building
  site_entry: ['site', 'last', 'fixed'],
  site_off_shared: ['exclude', 'include'],
} as const;
export type ChoiceKey = keyof typeof CHOICES;
export const CHOICE_KEYS = Object.keys(CHOICES) as ChoiceKey[];

/** The owner's answers (round 2): the defaults of a new installation. */
export const CHOICE_DEFAULTS = {
  summary_chooser: 'admin',
  row_actions: 'quick',
  tile_blinds: 'pct',
  tile_climate: 'both',
  phone_area: 'sheet',
  desktop_area: 'drawer',
  floor_off: 'menu',
  many_floors: 'more',
  building_off_tablet: 'hide',
  quick_card: 'show',
  phone_floors: 'selector',
  popup_alert: 'show',
  site_entry: 'site',
  site_off_shared: 'exclude',
} as const;

export interface HomeScreenOptions {
  /** null = every kind the site has devices of. */
  summary_tiles: SummaryKind[] | null;
  summary_chooser: SummaryChooser;
  /** Per area id: its quick actions in order (an empty list = none); an area not listed takes defaultQuick. */
  area_quick: Record<string, QuickKind[]>;
  row_actions: RowActions;
  tile_blinds: TileBlinds;
  tile_climate: TileClimate;
  phone_area: PhoneArea;
  desktop_area: DesktopArea;
  floor_off: FloorOff;
  many_floors: ManyFloors;
  building_off_tablet: BuildingOffTablet;
  /** QUICKHIDE-295: whether the home's quick-actions widget (lights off / all off pills) is drawn. */
  quick_card: QuickCard;
  /** FIX2232A-295: a phone shows one floor with the floor switch + tree button (selector) or every floor stacked down the page (all). */
  phone_floors: PhoneFloors;
  /** AREAEDIT-2290: whether a hidden sensor that goes into alarm shows in the area pop-up (red) until the alarm ends. */
  popup_alert: PopupAlert;
  /** AREAEDIT-2290: the area pop-up layout - a site default and one override per area (api/popup-layout.ts). */
  popup: PopupState;
  /** MULTIBUILDING-HOME-2330: where the home opens on a multi-building site (site = the whole site, last = the last building on this
   * device, fixed = site_entry_building), and whether "כבה הכל באתר" checks the shared building by default. */
  site_entry: SiteEntry;
  site_entry_building: string;
  site_off_shared: SiteOffShared;
}
export type SiteEntry = 'site' | 'last' | 'fixed';
export type SiteOffShared = 'exclude' | 'include';

export const HOME_SCREEN_DEFAULT: HomeScreenOptions = { summary_tiles: null, area_quick: {}, ...CHOICE_DEFAULTS, popup: { version: 0, site: null, areas: {} }, site_entry_building: '' };

/** The user's own choices (home.personal.screen). */
export interface PersonalScreen {
  summary_tiles?: SummaryKind[];
  phone_area?: PhoneArea;
  /** MULTIBUILDING-HOME-2330: this user's own entry view and fixed building (absent = the installation's), and "הסתר משותף". */
  site_entry?: SiteEntry;
  site_entry_building?: string;
  hide_shared?: boolean;
}

function kinds<T extends string>(v: unknown, allowed: readonly T[]): T[] | null {
  if (!Array.isArray(v)) return null;
  const out: T[] = [];
  for (const x of v) if (allowed.includes(x as T) && !out.includes(x as T)) out.push(x as T);
  return out;
}

/** What the server sent, read tolerantly: anything missing or foreign takes the default. */
export function homeScreenOf(raw: unknown): HomeScreenOptions {
  let o: Record<string, unknown> = {};
  if (typeof raw === 'string' && raw) {
    try {
      o = JSON.parse(raw) as Record<string, unknown>;
    } catch {
      o = {};
    }
  } else if (raw && typeof raw === 'object') o = raw as Record<string, unknown>;
  const out: HomeScreenOptions = { ...HOME_SCREEN_DEFAULT, area_quick: {}, popup: popupOf(o.popup) };
  out.summary_tiles = o.summary_tiles === null || o.summary_tiles === undefined ? null : kinds(o.summary_tiles, SUMMARY_KINDS);
  if (o.area_quick && typeof o.area_quick === 'object' && !Array.isArray(o.area_quick)) {
    for (const [id, v] of Object.entries(o.area_quick as Record<string, unknown>)) {
      const k = kinds(v, QUICK_KINDS);
      if (id && k) out.area_quick[id] = k;
    }
  }
  for (const key of CHOICE_KEYS) {
    const v = o[key];
    if ((CHOICES[key] as readonly string[]).includes(v as string)) (out as unknown as Record<string, unknown>)[key] = v;
  }
  if (typeof o.site_entry_building === 'string') out.site_entry_building = o.site_entry_building;
  return out;
}

export function personalScreenOf(raw: unknown): PersonalScreen {
  if (!raw || typeof raw !== 'object') return {};
  const o = raw as Record<string, unknown>;
  const out: PersonalScreen = {};
  const t = kinds(o.summary_tiles, SUMMARY_KINDS);
  if (t) out.summary_tiles = t;
  if (CHOICES.phone_area.includes(o.phone_area as PhoneArea)) out.phone_area = o.phone_area as PhoneArea;
  if (CHOICES.site_entry.includes(o.site_entry as SiteEntry)) out.site_entry = o.site_entry as SiteEntry;
  if (typeof o.site_entry_building === 'string' && o.site_entry_building) out.site_entry_building = o.site_entry_building;
  if (o.hide_shared === true) out.hide_shared = true;
  return out;
}

/** The options this viewer sees: the installation's, with his own summary tiles (only while users may choose) and phone area. */
export function effectiveScreen(site: HomeScreenOptions, personal: PersonalScreen | null | undefined): HomeScreenOptions {
  if (!personal) return site;
  return {
    ...site,
    summary_tiles: site.summary_chooser === 'user' && personal.summary_tiles ? personal.summary_tiles : site.summary_tiles,
    phone_area: personal.phone_area ?? site.phone_area,
  };
}

// ------------------------------------------------------------------------------------------------ the summary tiles

/** How many of a kind the scope has (alarm: 1 when there is a panel). */
export function kindTotal(c: DeviceCounts, k: SummaryKind): number {
  if (k === 'alarm') return c.alarm ? 1 : 0;
  return c[k] ?? 0;
}

/** The summary tiles shown, in order: the chosen list (every kind when nothing was chosen), only kinds the site has. */
export function summaryKindsShown(o: HomeScreenOptions, c: DeviceCounts): SummaryKind[] {
  return (o.summary_tiles ?? SUMMARY_KINDS).filter((k) => kindTotal(c, k) > 0);
}

// ------------------------------------------------------------------------------------------------ the quick actions

function hasQuick(c: DeviceCounts, k: QuickKind): boolean {
  return (c[k] ?? 0) > 0;
}

/** An area nobody configured: the kinds it has, lights > climate > covers > switches, at most DEFAULT_QUICK_MAX. */
export function defaultQuick(c: DeviceCounts): QuickKind[] {
  return QUICK_KINDS.filter((k) => hasQuick(c, k)).slice(0, DEFAULT_QUICK_MAX);
}

/** The quick actions of one area, in order (only kinds it has; `max` cuts the list - the cards row shows the first two). */
export function areaQuick(o: HomeScreenOptions, a: Pick<DeviceArea, 'area_id' | 'counts'>, max = 4): QuickKind[] {
  const list = o.area_quick[a.area_id] ?? defaultQuick(a.counts);
  return list.filter((k) => hasQuick(a.counts, k)).slice(0, Math.max(0, max));
}

/** The approved sizes: a tile shows up to four (a phone two); a cards-mode row the first two (a portrait tablet one). */
export function tileQuickMax(width: number): number {
  return width <= PHONE_WIDTH ? 2 : 4;
}
export function rowQuickMax(width: number): number {
  return width > PHONE_WIDTH && width < 900 ? 1 : 2;
}

/** What the climate quick button says (the area's first unit that runs, else its first): off, the target, or "on" (room mode). */
export function climateQuick(a: DeviceArea, mode: TileClimate): { on: boolean; heat: boolean; target: number | null; label: 'off' | 'target' | 'on' } {
  const units = a.climate ?? [];
  const run = units.find((u) => u.hvac_mode && u.hvac_mode !== 'off') ?? null;
  const on = !!run || (a.counts.climate_active ?? 0) > 0;
  const heat = run?.hvac_mode === 'heat' || run?.hvac_action === 'heating';
  const target = run?.target_temperature ?? null;
  if (!on) return { on, heat, target, label: 'off' };
  if (mode === 'room' || target === null) return { on, heat, target, label: 'on' };
  return { on, heat, target, label: 'target' };
}

/** The room temperature shows in the header unless the climate display is "target only" for an area that has air conditioning. */
export function showRoomTemp(a: DeviceArea, mode: TileClimate): boolean {
  if (a.temperature === null || a.temperature === undefined) return false;
  return mode !== 'target' || !(a.counts.climate > 0);
}

// ------------------------------------------------------------------------------------------------ layout choices

/** Phones scroll; everything wider is a control screen that must fit (no scroll, 1366x768 reference). */
export const PHONE_WIDTH = 600;
/** A landscape tablet (the approved first tablet target is 1180x820). */
export const TABLET_MAX_WIDTH = 1180;
/** The cards view shows this many floor cards in one row; the rest through "more floors" / the tree. */
export const FLOOR_CARDS_MAX = 4;

export function isTabletLandscape(width: number, height: number): boolean {
  return width > 900 && width <= TABLET_MAX_WIDTH && width > height;
}

/** The floors the cards view draws and the ones left for "more floors": every floor while one is selected (that one only) or while
 * there are at most FLOOR_CARDS_MAX; otherwise the first FLOOR_CARDS_MAX. */
export function floorCardsSplit<T extends Pick<DeviceFloor, 'floor_id'>>(floors: T[], selected: string, max = FLOOR_CARDS_MAX): { shown: T[]; more: T[] } {
  if (selected !== 'all') {
    const one = floors.filter((f) => f.floor_id === selected);
    if (one.length) return { shown: one, more: [] };
  }
  return { shown: floors.slice(0, max), more: floors.slice(max) };
}

/** How many floor cards share the row: four on a desktop (owner answer 7), three on a landscape tablet. */
export function floorCardsMax(width: number): number {
  return width > TABLET_MAX_WIDTH ? FLOOR_CARDS_MAX : 3;
}

// ------------------------------------------------------------------------------------------------ the alerts strip

export interface HomeAlert {
  kind: 'alarm';
  scope: 'building' | 'floor' | 'area';
  id: string;
  name: string;
}
/** The alarm rows above the floors (owner: one row each, at most three, and the tile is coloured): every place whose alarm panel is
 * triggered, the most specific first (areas, then floors, then the building), at most `max`. */
export function homeAlerts(t: { floors: DeviceFloor[]; building: DeviceCounts }, max = 3): HomeAlert[] {
  const out: HomeAlert[] = [];
  for (const f of t.floors) for (const a of f.areas) if (a.counts.alarm === 'triggered') out.push({ kind: 'alarm', scope: 'area', id: a.area_id, name: a.name });
  for (const f of t.floors) if (f.counts.alarm === 'triggered' && !f.areas.some((a) => a.counts.alarm === 'triggered')) out.push({ kind: 'alarm', scope: 'floor', id: f.floor_id, name: f.name });
  if (!out.length && t.building.alarm === 'triggered') out.push({ kind: 'alarm', scope: 'building', id: '*', name: '' });
  return out.slice(0, max);
}

// ------------------------------------------------------------------------------------------------ read / write

/** The demo (no backend) takes the defaults; `?hs_<key>=<value>` (and `?hs_tiles=lights,locks`, `?hs_quick=<area>:lights,covers;...`)
 * in the address choose for a demo page and the evidence specs. */
export function demoScreenOverrides(search: string = typeof location !== 'undefined' ? location.search : ''): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  try {
    const q = new URLSearchParams(search);
    for (const k of CHOICE_KEYS) {
      const v = q.get(`hs_${k}`);
      if (v) out[k] = v;
    }
    const tiles = q.get('hs_tiles');
    if (tiles !== null) out.summary_tiles = tiles ? tiles.split(',') : [];
    const quick = q.get('hs_quick');
    if (quick) {
      const aq: Record<string, string[]> = {};
      for (const part of quick.split(';')) {
        const [id, list] = part.split(':');
        if (id) aq[id] = list ? list.split(',') : [];
      }
      out.area_quick = aq;
    }
  } catch {
    /* no address */
  }
  return out;
}

/** The installation's options (the shared settings cache); never throws - the defaults on any failure. */
export async function loadHomeScreen(force = false): Promise<HomeScreenOptions> {
  if (!isApi()) return homeScreenOf(demoScreenOverrides());
  try {
    return homeScreenOf(((await productSettings(force)) as unknown as Record<string, unknown>)['home.screen']);
  } catch {
    return HOME_SCREEN_DEFAULT;
  }
}

/** The changed keys only (a PATCH of home.screen is partial on the server). */
export function homeScreenPatch(from: HomeScreenOptions, to: HomeScreenOptions): Partial<HomeScreenOptions> {
  const out: Partial<HomeScreenOptions> = {};
  for (const k of Object.keys(to) as (keyof HomeScreenOptions)[]) {
    if (JSON.stringify(to[k]) !== JSON.stringify(from[k])) (out as Record<string, unknown>)[k] = to[k];
  }
  return out;
}

/** What the options form edits: home.screen plus the two choices that keep their own keys - the info row and the default view. */
export interface HomeScreenForm {
  screen: HomeScreenOptions;
  info: InfoStyle;
  view: 'cards' | 'tiles';
}

/** The PATCH /settings body for what differs between two forms (home.screen partial; the other keys whole). */
export function screenFormBody(from: HomeScreenForm, to: HomeScreenForm): Record<string, unknown> {
  const body: Record<string, unknown> = {};
  const screen = homeScreenPatch(from.screen, to.screen);
  if (Object.keys(screen).length) body['home.screen'] = screen;
  if (to.info !== from.info) body['home.info_style'] = to.info;
  if (to.view !== from.view) body['devices.default_view'] = to.view;
  return body;
}

/** Saves the changed keys (system.configure, audited by the server) and refreshes the shared settings cache. */
export async function saveHomeScreen(from: HomeScreenOptions, to: HomeScreenOptions): Promise<HomeScreenOptions> {
  const body = homeScreenPatch(from, to);
  if (!Object.keys(body).length) return to;
  const r = await patch<{ settings: Record<string, unknown> }>('settings', { 'home.screen': body });
  invalidateSettings();
  return homeScreenOf(r.settings['home.screen']);
}
