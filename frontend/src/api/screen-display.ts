/**
 * POLISH-295 (owner approval 2026-10-25): the installation's display choices of the polished control screens, all product settings
 * (GET /settings, writable with system.configure - keep in step with smplwise_vms/backend/smplwise/routers/settings.py):
 *  - `home.info_style`: the clock, the weather, Shabbat and the alarm on the home screen as a thin bar in the header (`bar`) or as the
 *    large widget cards (`cards`); HOME-295: `auto` (the default) = cards in the cards view, the bar in tiles.
 *  - `ui.schedules_view`: the schedules list's view when this browser has not chosen one (`rows`, the default | cards | table | week).
 *  - `ui.page_size.<list>` / `ui.page_size.<list>_phone`: how many rows one page of a long list holds (control screens never scroll:
 *    the rest is behind the pager), on a desktop and on a phone.
 */
import { productSettings } from './prefs';
import { isApi } from './session';

/** HOME-295 (owner answers round 2, item 5): `auto`, the new default = the large cards in the cards view and the thin bar in the tiles
 * view; `bar` / `cards` pin one style for both views. */
export type InfoStyle = 'auto' | 'bar' | 'cards';
export const INFO_STYLES: readonly InfoStyle[] = ['auto', 'bar', 'cards'];
export const INFO_STYLE_DEFAULT: InfoStyle = 'auto';

/** The style a view draws: `auto` follows the view (cards in cards, the bar in tiles and the plan). */
export function infoStyleFor(style: InfoStyle, view: string): 'bar' | 'cards' {
  if (style === 'auto') return view === 'cards' ? 'cards' : 'bar';
  return style;
}

export type SchedulesView = 'rows' | 'cards' | 'table' | 'week';
export const SCHEDULES_VIEWS: readonly SchedulesView[] = ['rows', 'cards', 'table', 'week'];
export const SCHEDULES_VIEW_DEFAULT: SchedulesView = 'rows';

export type PagedList = 'schedules' | 'automations';
/** The approved previews: 10 schedules / 12 automations on a 1440x900 desktop, 7 / 9 on a phone. */
export const PAGE_SIZE_DEFAULT: Record<PagedList, { wide: number; phone: number }> = { schedules: { wide: 10, phone: 7 }, automations: { wide: 12, phone: 9 } };
export const PAGE_SIZE_MIN = 3;
export const PAGE_SIZE_MAX = 50;

export const pageSizeKey = (list: PagedList, phone: boolean): string => `ui.page_size.${list}${phone ? '_phone' : ''}`;

export interface ScreenDisplay {
  infoStyle: InfoStyle;
  schedulesView: SchedulesView;
  pageSize: Record<PagedList, { wide: number; phone: number }>;
}

const pick = <T extends string>(v: unknown, allowed: readonly T[], fallback: T): T => (allowed.includes(v as T) ? (v as T) : fallback);

function size(v: unknown, fallback: number): number {
  const n = typeof v === 'number' ? v : typeof v === 'string' && v.trim() ? Number(v) : NaN;
  return Number.isInteger(n) && n >= PAGE_SIZE_MIN && n <= PAGE_SIZE_MAX ? n : fallback;
}

/** The choices as the server sent them, tolerant: anything missing or foreign takes the default. */
export function screenDisplayOf(raw: Record<string, unknown> | null | undefined): ScreenDisplay {
  const s = raw ?? {};
  const ps = (list: PagedList) => ({ wide: size(s[pageSizeKey(list, false)], PAGE_SIZE_DEFAULT[list].wide), phone: size(s[pageSizeKey(list, true)], PAGE_SIZE_DEFAULT[list].phone) });
  return {
    infoStyle: pick(s['home.info_style'], INFO_STYLES, INFO_STYLE_DEFAULT),
    schedulesView: pick(s['ui.schedules_view'], SCHEDULES_VIEWS, SCHEDULES_VIEW_DEFAULT),
    pageSize: { schedules: ps('schedules'), automations: ps('automations') },
  };
}

/** The demo (no backend) takes the defaults; `?home_info=cards|bar`, `?sched_view=` and `?page_size=<n>` (every list, desktop and phone)
 * in the address choose for a demo page. */
function demoOverrides(): Record<string, unknown> {
  try {
    const q = new URLSearchParams(location.search);
    const out: Record<string, unknown> = {};
    if (q.get('home_info')) out['home.info_style'] = q.get('home_info');
    if (q.get('sched_view')) out['ui.schedules_view'] = q.get('sched_view');
    const ps = q.get('page_size');
    if (ps) for (const l of ['schedules', 'automations'] as const) for (const phone of [false, true]) out[pageSizeKey(l, phone)] = ps;
    return out;
  } catch {
    return {};
  }
}

/** Read the choices (the shared settings cache); a failed read is the defaults, never an error on an operator screen. */
export async function loadScreenDisplay(): Promise<ScreenDisplay> {
  if (!isApi()) return screenDisplayOf(demoOverrides());
  try {
    return screenDisplayOf((await productSettings()) as unknown as Record<string, unknown>);
  } catch {
    return screenDisplayOf(null);
  }
}

// ------------------------------------------------------------------------------------------------ pages

export function pageCount(total: number, perPage: number): number {
  return Math.max(1, Math.ceil(Math.max(0, total) / Math.max(1, perPage)));
}

/** The page shown: within 1..pageCount (a page that vanished after a filter or a delete falls back to the last one). */
export function clampPage(page: number, total: number, perPage: number): number {
  return Math.min(Math.max(1, Math.floor(page) || 1), pageCount(total, perPage));
}

export function pageSlice<T>(items: readonly T[], page: number, perPage: number): T[] {
  const p = clampPage(page, items.length, perPage);
  return items.slice((p - 1) * perPage, p * perPage);
}
