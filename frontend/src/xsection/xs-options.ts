/**
 * CR-SHELL-LAZY-2436 (review 08:F02): the installation's cross-section and synoptic map options (`ui.xs`, backend
 * services/xs_options.py) - the option lists, the defaults (the owner's), normalisation, the current value and its listeners. Moved
 * out of xs-model.ts unchanged so the shell, which only reads and sets the options, does not import the whole model for them;
 * xs-model.ts re-exports every name, so its importers are unchanged. Plain data and functions, no imports.
 */

/* ---------------------------------------------------------------- options (ui.xs) */

export const XS_DESKTOP_PLACE = ['left', 'right', 'off'] as const; // A: in the empty area (default), B: at the other side, C: off
export const XS_PHONE_PLACE = ['side', 'card', 'sheet'] as const; // A: a tile beside each card (default), B: a compact card, C: a button
export const XS_MANY = ['steps', 'scroll', 'near'] as const; // A: cards shrink in steps (default), B: the list scrolls, C: selected + neighbours
export const XS_LINKS = ['fold', 'full', 'hide'] as const; // A: folds to one row when space is short (default), B: always full, C: no drawing
export const XS_CLICK = ['select', 'open'] as const; // A: first selects, second opens (default), B: opens at once
export const XS_COLUMNS_ALL = ['light', 'temp', 'presence', 'cameras', 'doors', 'alerts'] as const; // the fire column is not listed: it follows the connection
export const XS_ACK = ['hold', 'confirm', 'tap'] as const; // A: long press 1.2 s (default), B: press then confirm, C: one press
export const XS_ACK_WHO = ['separate', 'viewers', 'admin'] as const; // A: anyone who sees the board, B: a new separate permission (default), C: administrators
export const XS_ALARM_BAR = ['everywhere', 'home'] as const; // A: a red bar on every screen (default), B: only Home and the synoptic map
export const XS_FIRE_COLUMN = ['hidden', 'dashed'] as const; // B: hidden until connected (default), A: a dashed "not connected" column
/** SWITCH-LIGHT-DIMMER-2331 "מפסקים בעמודת התאורה": only the switches typed as a light (default) / every switch.* entity. */
export const XS_SYN_SWITCHES = ['typed', 'all'] as const;
/** SYNOPTIC-MOBILE-2342 "תצוגת המפה הסינופטית בטלפון" (under 768 px): A compact table (default), B one card per floor, C the cross-section first. */
export const XS_SYN_PHONE_VIEW = ['table', 'cards', 'section'] as const;
/**
 * SYNOPTIC-PHONE-SETTINGS-2360 "תאורה בטלפון": how a floor's lights are drawn under its "2/10" on the phone table and the floor cards - a
 * small bar (default, today's fixed behaviour), the segment strip of the wide board (one segment a light, up to eight, in the same 34 px), or
 * the number only. The building cross-section colours the slab by the share of lights on whatever this says (the setting does not apply there).
 */
export const XS_SYN_PHONE_LIGHT = ['bar', 'segments', 'number'] as const;
/** SYNOPTIC-PHONE-SETTINGS-2360 "שורת סיכום בטלפון": the board's summary behind an info button in the head (default, today's), as a line under the board, or none. */
export const XS_SYN_PHONE_SUMMARY = ['button', 'line', 'off'] as const;
export const XS_SYN_COLUMNS = ['all', 'few', 'custom'] as const; // A: seven columns (default), B: temperature, light, alerts, fire, C: the columns ticked in syn_custom
/** SYN-COLUMNS-2321: every column of the board in its fixed order (the custom choice ticks any of them; the order never changes). */
export const SYN_COLUMN_ORDER = ['light', 'temp', 'presence', 'cameras', 'doors', 'alerts', 'fire'] as const;

export type XsColumn = (typeof XS_COLUMNS_ALL)[number];
/** A column of the synoptic board: the six above and the fire column (which follows the connection). */
export type SynColumn = XsColumn | 'fire';

export interface XsOptions {
  desktop_place: (typeof XS_DESKTOP_PLACE)[number];
  phone_place: (typeof XS_PHONE_PLACE)[number];
  many: (typeof XS_MANY)[number];
  links: (typeof XS_LINKS)[number];
  click: (typeof XS_CLICK)[number];
  shafts: boolean; // stairs and lifts drawn on the section
  animate: boolean; // false = fade only
  temp_threshold: number; // degrees from the target before a floor reads hot / cold
  syn_tab: boolean; // the synoptic tab on Home
  syn_columns: (typeof XS_SYN_COLUMNS)[number];
  /** SYN-COLUMNS-2321: the columns of syn_columns=custom, in the board order (default: all seven). */
  syn_custom: SynColumn[];
  /** SYN-COLUMNS-2321: a column with no source on any floor of the building (no temperature sensors, no lights) is not drawn. Default ON. */
  syn_hide_empty: boolean;
  syn_events: boolean; // the event strip beside the board on wide screens
  /** SWITCH-LIGHT-DIMMER-2331: the lights column counts the switches typed as a light (typed, default) or every switch.* (all). */
  syn_switches: (typeof XS_SYN_SWITCHES)[number];
  /** SYNOPTIC-MOBILE-2342: the phone layout of the board (table, default / cards / section); tablet and desktop keep the table. */
  syn_phone_view: (typeof XS_SYN_PHONE_VIEW)[number];
  /** SYNOPTIC-PHONE-SETTINGS-2360: the lights gauge of the phone table and cards (bar, default / segments / number). */
  syn_phone_light: (typeof XS_SYN_PHONE_LIGHT)[number];
  /** SYNOPTIC-PHONE-SETTINGS-2360: the phone board's summary (info button, default / line under the board / off). */
  syn_phone_summary: (typeof XS_SYN_PHONE_SUMMARY)[number];
  fire_column: (typeof XS_FIRE_COLUMN)[number];
  fire_ui: boolean; // MASTER SWITCH of the alarm UI (off: no bar, no acknowledge, nothing about fire anywhere)
  ack: (typeof XS_ACK)[number];
  ack_who: (typeof XS_ACK_WHO)[number];
  alarm_bar: (typeof XS_ALARM_BAR)[number];
  wall: boolean; // the wall screen URL (#/kiosk/synoptic) is served
}

export const XS_DEFAULT: Readonly<XsOptions> = {
  desktop_place: 'left',
  phone_place: 'side',
  many: 'steps',
  links: 'fold',
  click: 'select',
  shafts: true,
  animate: true,
  temp_threshold: 2,
  syn_tab: true,
  syn_columns: 'all',
  syn_custom: [...SYN_COLUMN_ORDER],
  syn_hide_empty: true,
  syn_events: true,
  syn_switches: 'typed',
  syn_phone_view: 'table',
  syn_phone_light: 'bar',
  syn_phone_summary: 'button',
  fire_column: 'hidden',
  fire_ui: false,
  ack: 'hold',
  ack_who: 'separate',
  alarm_bar: 'everywhere',
  wall: true,
};

export const XS_THRESHOLDS = [1, 2, 3, 4] as const;
/** Hold time of the acknowledge press (owner decision 9). */
export const ACK_HOLD_MS = 1200;
/** Above this many floors the phone tile would be under 20 px high, so the compact card takes over (mock-up v3). */
export const PHONE_TILE_MAX_FLOORS = 12;

/** The option set in its canonical form: every key present, an unknown value reads as the default (the server refuses it with 422). */
export function normalizeXs(raw: unknown): XsOptions {
  const out: XsOptions = { ...XS_DEFAULT, syn_custom: [...XS_DEFAULT.syn_custom] };
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return out;
  const r = raw as Record<string, unknown>;
  const pick = <T extends string>(v: unknown, set: readonly T[], d: T): T => (typeof v === 'string' && (set as readonly string[]).includes(v) ? (v as T) : d);
  const bool = (v: unknown, d: boolean) => (typeof v === 'boolean' ? v : d);
  out.desktop_place = pick(r.desktop_place, XS_DESKTOP_PLACE, XS_DEFAULT.desktop_place);
  out.phone_place = pick(r.phone_place, XS_PHONE_PLACE, XS_DEFAULT.phone_place);
  out.many = pick(r.many, XS_MANY, XS_DEFAULT.many);
  out.links = pick(r.links, XS_LINKS, XS_DEFAULT.links);
  out.click = pick(r.click, XS_CLICK, XS_DEFAULT.click);
  out.shafts = bool(r.shafts, XS_DEFAULT.shafts);
  out.animate = bool(r.animate, XS_DEFAULT.animate);
  out.temp_threshold = typeof r.temp_threshold === 'number' && (XS_THRESHOLDS as readonly number[]).includes(r.temp_threshold) ? r.temp_threshold : XS_DEFAULT.temp_threshold;
  out.syn_tab = bool(r.syn_tab, XS_DEFAULT.syn_tab);
  out.syn_columns = pick(r.syn_columns, XS_SYN_COLUMNS, XS_DEFAULT.syn_columns);
  out.syn_custom = Array.isArray(r.syn_custom) ? SYN_COLUMN_ORDER.filter((c) => (r.syn_custom as unknown[]).includes(c)) : [...XS_DEFAULT.syn_custom];
  out.syn_hide_empty = bool(r.syn_hide_empty, XS_DEFAULT.syn_hide_empty);
  out.syn_events = bool(r.syn_events, XS_DEFAULT.syn_events);
  out.syn_switches = pick(r.syn_switches, XS_SYN_SWITCHES, XS_DEFAULT.syn_switches);
  out.syn_phone_view = pick(r.syn_phone_view, XS_SYN_PHONE_VIEW, XS_DEFAULT.syn_phone_view);
  out.syn_phone_light = pick(r.syn_phone_light, XS_SYN_PHONE_LIGHT, XS_DEFAULT.syn_phone_light);
  out.syn_phone_summary = pick(r.syn_phone_summary, XS_SYN_PHONE_SUMMARY, XS_DEFAULT.syn_phone_summary);
  out.fire_column = pick(r.fire_column, XS_FIRE_COLUMN, XS_DEFAULT.fire_column);
  out.fire_ui = bool(r.fire_ui, XS_DEFAULT.fire_ui);
  out.ack = pick(r.ack, XS_ACK, XS_DEFAULT.ack);
  out.ack_who = pick(r.ack_who, XS_ACK_WHO, XS_DEFAULT.ack_who);
  out.alarm_bar = pick(r.alarm_bar, XS_ALARM_BAR, XS_DEFAULT.alarm_bar);
  out.wall = bool(r.wall, XS_DEFAULT.wall);
  return out;
}

let current: XsOptions = { ...XS_DEFAULT };
const listeners = new Set<() => void>();
export const xsOptions = (): Readonly<XsOptions> => current;
/** The installation's value (`ui.xs`) after the settings load or a save; every open screen follows. */
export function setXsOptions(raw: unknown): void {
  current = normalizeXs(raw);
  for (const l of listeners) l();
}
export function onXsOptions(fn: () => void): () => void {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

/** The demo (no backend) and the specs may override single options from the route (`?xs_phone_place=card`): never used with a backend. */
export function xsFromParams(base: Readonly<XsOptions>, params: URLSearchParams): XsOptions {
  const o: Record<string, unknown> = { ...base };
  params.forEach((v, k) => {
    if (!k.startsWith('xs_')) return;
    const key = k.slice(3);
    if (!(key in XS_DEFAULT)) return;
    const d = (XS_DEFAULT as unknown as Record<string, unknown>)[key];
    o[key] = typeof d === 'boolean' ? v === '1' || v === 'true' : typeof d === 'number' ? Number(v) : Array.isArray(d) ? v.split(',').filter(Boolean) : v;
  });
  return normalizeXs(o);
}

