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

// ---- WDX: alert ladder (CR-030 section 5.2) and picture frame (section 6.1)
export type AlertSeverity = 'info' | 'alert' | 'critical';
export interface AlertLike { id: string; severity: AlertSeverity; last_at: string; count: number }
export const INFO_CHIP_S = 20;
const RANK: Record<AlertSeverity, number> = { info: 0, alert: 1, critical: 2 };

export interface AlertView<T> {
  /** critical items: the whole screen, newest first; never times out */
  takeover: T[];
  /** the alert tile of the top-start cell (the one `tap` selects) and how many more there are */
  tile: T | null;
  more: number;
  /** items folded into the strip: seen, timed out or info */
  chips: T[];
}

/**
 * `shownAt`: when this display first showed each item (the display's own clock); `seenUntil`: the local "seen" collapse.
 * critical -> takeover until acknowledged/resolved (a "seen" only collapses it for `timeoutS`, then it comes back);
 * alert -> tile for `timeoutS` since first shown, then a chip; info -> a chip for 20 s.
 */
export function alertView<T extends AlertLike>(alerts: T[], shownAt: Map<string, number>, seenUntil: Map<string, number>, nowMs: number, timeoutS: number, tap = 0): AlertView<T> {
  const newest = [...alerts].sort((a, b) => (a.last_at < b.last_at ? 1 : a.last_at > b.last_at ? -1 : 0));
  const takeover: T[] = [];
  const tiles: T[] = [];
  const chips: T[] = [];
  for (const a of newest) {
    const seen = (seenUntil.get(a.id) ?? 0) > nowMs;
    const age = (nowMs - (shownAt.get(a.id) ?? nowMs)) / 1000;
    if (a.severity === 'critical') (seen ? chips : takeover).push(a);
    else if (a.severity === 'alert') (seen || age >= timeoutS ? chips : tiles).push(a);
    else if (age < INFO_CHIP_S) chips.push(a);
  }
  const i = tiles.length ? ((tap % tiles.length) + tiles.length) % tiles.length : 0;
  return { takeover, tile: tiles[i] ?? null, more: Math.max(0, tiles.length - 1), chips };
}

/** An item of at least `severity` is open: a sleeping display wakes (section 4.3). */
export function wakesDisplay(alerts: AlertLike[], severity: 'alert' | 'critical'): boolean {
  return alerts.some((a) => RANK[a.severity] >= RANK[severity]);
}

/** An open item that needs attention (>= alert) keeps the frame away and resets the idle timer. */
export function needsAttention(alerts: AlertLike[]): boolean {
  return alerts.some((a) => RANK[a.severity] >= RANK.alert);
}

/** The picture frame shows after `idleMin` minutes without a touch and without an item needing attention. Sleep wins over it. */
export function frameActive(i: { enabled: boolean; photos: number; idleMin: number; lastActivityMs: number; nowMs: number; asleep: boolean; attention: boolean }): boolean {
  if (!i.enabled || i.photos < 1 || i.asleep || i.attention) return false;
  return (i.nowMs - i.lastActivityMs) / 60_000 >= i.idleMin;
}

/** A random permutation of 0..n-1 (one per cycle); `rnd` is injectable for tests. Never starts with `avoidFirst` when n > 1. */
export function shuffleOrder(n: number, rnd: () => number = Math.random, avoidFirst = -1): number[] {
  const a = Array.from({ length: n }, (_, k) => k);
  for (let k = n - 1; k > 0; k--) {
    const j = Math.floor(rnd() * (k + 1));
    [a[k], a[j]] = [a[j], a[k]];
  }
  if (n > 1 && a[0] === avoidFirst) [a[0], a[1]] = [a[1], a[0]];
  return a;
}

/** Press-and-hold acknowledge progress, 0..1, over 1.5 s (section 5.4). */
export const HOLD_MS = 1500;
export function holdProgress(startedMs: number | null, nowMs: number): number {
  return startedMs === null ? 0 : clamp((nowMs - startedMs) / HOLD_MS, 0, 1);
}
