/** CR-030 section 4: pure layout and timing rules of the wall display (no DOM, unit-tested). */
export type Preset = 'tablet-landscape' | 'tablet-portrait' | 'single';
export interface WallGrid { cols: number; rows: number }

export interface LayoutInput {
  layout: 'auto' | Preset;
  grid: 'auto' | WallGrid;
  cameras: number;
  viewportW: number;
  viewportH: number;
  showMap: boolean;
  rotateS: number;
}

export interface Layout {
  preset: Preset;
  cols: number;
  rows: number;
  perPage: number;
  pages: number;
  /** seconds per page; 0 = no rotation */
  rotateS: number;
  /** the map band is shown (portrait preset only) */
  map: boolean;
}

/** More than this many sub streams on one page stall the lab NVR / relay (live review F15): the tablet presets never exceed it. */
export const MAX_PER_PAGE = 6;
export const DEFAULT_ROTATE_S = 30;

export function clamp(n: number, lo: number, hi: number): number {
  return Math.min(hi, Math.max(lo, n));
}

/** `--wall-scale = clamp(1, short / 800, 1.4)`: type and touch targets follow the physical screen. */
export function wallScale(screenW: number, screenH: number): number {
  return clamp(Math.min(screenW, screenH) / 800, 1, 1.4);
}

function autoGrid(preset: Preset, n: number, viewportH: number): WallGrid {
  if (preset === 'single' || n <= 1) return { cols: 1, rows: 1 };
  if (preset === 'tablet-portrait') return { cols: 1, rows: viewportH >= 1800 && n >= 3 ? 3 : 2 };
  if (n === 2) return { cols: 2, rows: 1 };
  if (n <= 4) return { cols: 2, rows: 2 };
  return { cols: 3, rows: 2 };
}

export function resolveLayout(i: LayoutInput): Layout {
  const n = Math.max(0, i.cameras);
  let preset: Preset;
  if (i.layout === 'auto') preset = n === 1 ? 'single' : i.viewportW >= i.viewportH ? 'tablet-landscape' : 'tablet-portrait';
  else preset = i.layout;
  let grid = autoGrid(preset, n, i.viewportH);
  if (i.grid !== 'auto' && preset !== 'single') grid = { cols: clamp(i.grid.cols, 1, 3), rows: clamp(i.grid.rows, 1, 3) };
  let perPage = Math.min(MAX_PER_PAGE, grid.cols * grid.rows);
  if (preset === 'single') perPage = 1;
  const pages = Math.max(1, Math.ceil(n / perPage));
  const rotateS = pages > 1 ? (i.rotateS > 0 ? i.rotateS : DEFAULT_ROTATE_S) : 0;
  return { preset, cols: grid.cols, rows: grid.rows, perPage, pages, rotateS, map: preset === 'tablet-portrait' && i.showMap };
}

/** The cameras of one page, after the hourly shuffle rotated the order by `shift` cells. */
export function pageCameras<T>(cams: T[], page: number, perPage: number, shift = 0): T[] {
  if (!cams.length) return [];
  const k = ((shift % cams.length) + cams.length) % cams.length;
  const rotated = [...cams.slice(k), ...cams.slice(0, k)];
  return rotated.slice(page * perPage, page * perPage + perPage);
}

/** Pixel shift (section 4.2): nine positions of (+-2, +-2) px, one step per minute. */
const SHIFT: [number, number][] = [[0, 0], [2, 0], [2, 2], [0, 2], [-2, 2], [-2, 0], [-2, -2], [0, -2], [2, -2]];
export function pixelShift(nowMs: number, enabled: boolean): [number, number] {
  return enabled ? SHIFT[Math.floor(nowMs / 60000) % SHIFT.length] : [0, 0];
}

/** Section 4.4, one camera: fresh -> stale (dimmed, hatched, time of the last frame) -> lost (the name on a dark tile) after `showLastFrameS`. */
export type TileHealth = 'live' | 'stale' | 'lost';
export function tileHealth(lastOkMs: number | null, nowMs: number, stallS = 8, showLastFrameS = 60): TileHealth {
  if (lastOkMs === null) return 'stale';
  const age = (nowMs - lastOkMs) / 1000;
  if (age < stallS) return 'live';
  return age < showLastFrameS + stallS ? 'stale' : 'lost';
}

/** Section 4.4, the server: how long the connection has been down decides what the display shows. */
export type ServerHealth = 'ok' | 'banner' | 'clock';
export function serverHealth(downSinceMs: number | null, nowMs: number): ServerHealth {
  if (downSinceMs === null) return 'ok';
  const down = (nowMs - downSinceMs) / 1000;
  if (down < 15) return 'ok';
  return down < 120 ? 'banner' : 'clock';
}

/** Reconnect delay: every 5 s, then every 15 s once the server has been gone for 5 minutes. */
export function reconnectDelayMs(downForMs: number): number {
  return downForMs >= 5 * 60_000 ? 15_000 : 5_000;
}

/** Awake / asleep by the weekly windows in the installation's zone (a display with no windows is always awake). */
export interface WallWindow { days: number[]; from: string; to: string }
export function isAwake(windows: WallWindow[], zone: string, at: Date): boolean {
  if (!windows.length) return true;
  let weekday = 0;
  let minutes = 0;
  try {
    const parts = new Intl.DateTimeFormat('en-US', { timeZone: zone, weekday: 'short', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).formatToParts(at);
    const get = (t: string) => parts.find((p) => p.type === t)?.value ?? '';
    weekday = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].indexOf(get('weekday'));
    minutes = Number(get('hour')) * 60 + Number(get('minute'));
  } catch {
    return true;
  }
  const mins = (s: string) => Number(s.slice(0, 2)) * 60 + Number(s.slice(3, 5));
  return windows.some((w) => w.days.includes(weekday) && minutes >= mins(w.from) && minutes < mins(w.to));
}
