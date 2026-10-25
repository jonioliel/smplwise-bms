/**
 * POLISH-295 (owner approval 2026-10-25): the installation's display choices of the polished control screens, all product settings
 * (GET /settings, writable with system.configure - keep in step with smplwise_vms/backend/smplwise/routers/settings.py):
 *  - `home.info_style`: the clock, the weather, Shabbat and the alarm on the home screen as a thin bar in the header (`bar`, the
 *    default) or as the large widget cards (`cards`).
 *  - `ui.schedules_view`: the schedules list's view when this browser has not chosen one (`rows`, the default | cards | table | week).
 *  - `ui.page_size.<list>` / `ui.page_size.<list>_phone`: how many rows one page of a long list holds (control screens never scroll:
 *    the rest is behind the pager), on a desktop and on a phone.
 */
import { productSettings } from './prefs';
import { isApi } from './session';

export type InfoStyle = 'bar' | 'cards';
export const INFO_STYLES: readonly InfoStyle[] = ['bar', 'cards'];
export const INFO_STYLE_DEFAULT: InfoStyle = 'bar';

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

/** The page size a paged list uses: the setting is the maximum; `fit` (what fits the screen's height, null = not measured) lowers it. */
export const fittedPageSize = (setting: number, fit: number | null): number => (fit === null ? setting : Math.max(1, Math.min(setting, fit)));

/** NOSCROLL-295: `?fit=off` in the address turns the fit off for this page (the page size setting alone decides) - for the evidence specs
 * that read every item on one page (`page_size=50`) or a whole page of the setting at a viewport the cards do not fit. */
export function fitDisabled(): boolean {
  try {
    return new URLSearchParams(location.search).get('fit') === 'off';
  } catch {
    return false;
  }
}

export interface FitTarget {
  /** The screen element that scrolls (its bottom is the bottom of the screen). */
  host: HTMLElement;
  /** The list (rows, a table or a grid of cards) holding the items. */
  list: HTMLElement | null;
  /** The items inside the list. */
  itemSelector: string;
  /** The pager band under the list, when it is shown (otherwise a 44 px band is kept for it). */
  pager?: HTMLElement | null;
  /** Elements whose block-end padding sits under the list (the page wrapper). */
  padded?: readonly (HTMLElement | null)[];
}

/**
 * FIX2200 (generalised by NOSCROLL-295; owner rule 2026-10-24: control screens never scroll, sized for 1366x768): how many items of a paged
 * list fit between the top of the list and the bottom of the screen, less the pager's band - a whole number of rows times the columns of a
 * grid of cards (one column for rows and tables). The callers take a new fit only when it is smaller than the one in force (or none is),
 * and reset it to none on a resize or a change of view, so cards of different heights cannot make it oscillate. Null when nothing can be measured (no list, no items, a hidden screen). Never less than one row (a phone may fit one tall card; the page size setting's own minimum, PAGE_SIZE_MIN, bounds the setting, not the fit).
 */
export function measureFitItems(t: FitTarget): number | null {
  if (fitDisabled()) return null;
  const { host, list } = t;
  const items = list ? list.querySelectorAll<HTMLElement>(t.itemSelector) : null;
  if (!list || !items || !items.length || !host.clientHeight) return null;
  const lr = list.getBoundingClientRect();
  const r0 = items[0].getBoundingClientRect();
  if (r0.height <= 0) return null;
  const cs = getComputedStyle(list);
  const tracks = cs.display.includes('grid') ? cs.gridTemplateColumns.split(' ').filter((x) => x && x !== 'none').length : 0;
  const sameRow = [...items].filter((el) => Math.abs(el.getBoundingClientRect().top - r0.top) < 2).length;
  const cols = Math.max(1, tracks || sameRow);
  const next = [...items].find((el) => el.getBoundingClientRect().top > r0.top + 2);
  const pitch = next ? next.getBoundingClientRect().top - r0.top : r0.height + (parseFloat(cs.rowGap) || 0);
  if (pitch <= 0) return null;
  // NOSCROLL-295: cards differ in height, so the rows are counted where they are (their bottoms against the screen's bottom), not as
  // `list height / pitch` - that ratio moves with the cards shown and the fit flipped between two values without end
  const bottoms: number[] = []; // the bottom of each row of items, top to bottom
  let rowTop = -Infinity;
  for (const r of [...items].map((el) => el.getBoundingClientRect()).sort((a, b) => a.top - b.top)) {
    if (r.top > rowTop + 2) {
      rowTop = r.top;
      bottoms.push(r.bottom);
    } else bottoms[bottoms.length - 1] = Math.max(bottoms[bottoms.length - 1], r.bottom);
  }
  const last = bottoms[bottoms.length - 1];
  const tail = lr.bottom - last; // the list's own padding and border under the last row
  const pager = t.pager ? t.pager.getBoundingClientRect().bottom - lr.bottom : 44;
  const pad = [...(t.padded ?? []), host].reduce((n, el) => n + (el ? parseFloat(getComputedStyle(el).paddingBlockEnd) || 0 : 0), 0);
  const limit = host.getBoundingClientRect().top + host.clientHeight - tail - pager - pad; // with the screen scrolled to its top
  const scrolled = host.scrollTop;
  let rows = 0;
  for (const b of bottoms) {
    if (b + scrolled > limit) break;
    rows++;
  }
  // every row shown fits: as many more as the pitch allows below the last one
  if (rows === bottoms.length) rows += Math.max(0, Math.floor((limit - (last + scrolled)) / pitch));
  return Math.max(1, rows) * cols;
}
