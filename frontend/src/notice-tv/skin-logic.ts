/**
 * NOTICEBOARD-STYLES-2300 - the pure rules of the two maintenance-area notice-board styles "Ink" (an e-paper station display) and "Sign"
 * (public wayfinding signage), approved as mock-ups in private/design-system-2026-10-27/round7/noticeboard-styles and decided by the owner on
 * 2026-10-30 (both are selectable board designs; neither is a default; the long body SHRINKS to fit; the "Up next" list; the urgent take-over).
 * No DOM here: unit specs run it in Node, the DOM engine (skin-board.ts) imports it.
 */
import type { LiveBg, Severity, UrgentScreen } from './tv-logic';

/** ink / sign = the maintenance-area styles (NOTICEBOARD-STYLES-2300); lumen / axis / prism = the hi-tech lobby styles and
 * gallery / concierge / stone = the classic-luxury lobby styles (LOBBY-STYLES-2300). All eight run on one engine (skin-board.ts). */
export type Skin = 'ink' | 'sign' | 'lumen' | 'axis' | 'prism' | 'gallery' | 'concierge' | 'stone';
export type Family = 'station' | 'hitech' | 'luxury';
export const HITECH: readonly Skin[] = ['lumen', 'axis', 'prism'];
export const LUXURY: readonly Skin[] = ['gallery', 'concierge', 'stone'];
export const SKINS: Skin[] = ['ink', 'sign', 'lumen', 'axis', 'prism', 'gallery', 'concierge', 'stone'];
export const isSkin = (design: unknown): design is Skin => typeof design === 'string' && (SKINS as string[]).includes(design);
export const familyOf = (skin: Skin): Family => (HITECH.includes(skin) ? 'hitech' : LUXURY.includes(skin) ? 'luxury' : 'station');

/** The smallest scale (of the style's own type sizes) a long notice may shrink to before the last resort (the body is cut by lines with an
 * ellipsis). 0.64 keeps the body at 29.4 px (Ink, 46 px) / 28.2 px (Sign, 44 px) on the 1080 px high canvas, 2.6 % of the screen height. */
export const FS_MIN = 0.64;
/** The urgent take-over and the announcement are one screen with larger type: they may shrink a little further. */
export const FS_MIN_TAKE = 0.56;
export const BODY_PX: Record<Skin, number> = { ink: 46, sign: 44, lumen: 40, axis: 40, prism: 40, gallery: 40, concierge: 38, stone: 40 };
/** The lobby styles shrink further (owner 2026-10-30: to 55 %), in these steps; below them the body is set in two columns (three on a long landscape one). */
export const HX_STEPS: readonly number[] = [1, 0.92, 0.84, 0.77, 0.7, 0.64, 0.59, 0.55];
export const LOBBY_FS_MIN = 0.55;
export const minBodyPx = (skin: Skin, take = false): number => Math.round(BODY_PX[skin] * (take ? FS_MIN_TAKE : familyOf(skin) === 'station' ? FS_MIN : LOBBY_FS_MIN) * 10) / 10;

/** The scale steps a fit starts from: the largest scale in [min, 1] for which `fits` holds (a binary search over `iterations` halvings,
 * so a long body loses only as much size as it must). 0 = it does not fit even at `min` (the caller then cuts the body by lines). */
export function bestScale(fits: (scale: number) => boolean, min: number, iterations = 7): number {
  if (fits(1)) return 1;
  if (!fits(min)) return 0;
  let lo = min; // fits
  let hi = 1; // does not fit
  for (let i = 0; i < iterations; i++) {
    const mid = (lo + hi) / 2;
    if (fits(mid)) lo = mid;
    else hi = mid;
  }
  return Math.round(lo * 1000) / 1000;
}

/** The icon of a building chip (the feed's kind: elevators / generator / parking / gym). */
export type InfoIcon = 'elevator' | 'generator' | 'parking' | 'gym' | 'info';
export function infoIcon(kind: string): InfoIcon {
  if (kind === 'elevators' || kind === 'elevator') return 'elevator';
  if (kind === 'generator' || kind === 'parking' || kind === 'gym') return kind;
  return 'info';
}

export type WeatherIcon = 'sun' | 'cloudsun' | 'cloud' | 'moon';
export function weatherIcon(condition: string): WeatherIcon {
  return condition === 'sun' || condition === 'cloudsun' || condition === 'cloud' || condition === 'moon' ? condition : 'cloud';
}

/** Ink draws a notice that announces a date and a time window (not an open-ended one, not an "until ...") as a solid frame. The feed has no
 * "event" flag, so the window text decides: a date (dd.mm) or a time (hh:mm) in it, and no "until" lead-in. */
export function isEventWhen(when: string, permanent: string): boolean {
  const w = (when || '').trim();
  if (!w || w === permanent) return false;
  if (/^(עד|until)(\s|$)/i.test(w)) return false; // (no \b: it is ASCII-only and never matches after a Hebrew word)
  return /\d{1,2}\.\d{1,2}|\d{1,2}:\d{2}/.test(w);
}

/** The "Up next" list: up to `max` of the notices after the current one, in rotation order, wrapping; `more` counts the rest. */
export interface QueueRow<T> { item: T; pos: number }
export function queueRows<T>(items: readonly T[], current: number, max: number): { rows: QueueRow<T>[]; more: number } {
  const n = items.length;
  if (n < 2) return { rows: [], more: 0 };
  const rows: QueueRow<T>[] = [];
  for (let k = 1; k < n && rows.length < max; k++) rows.push({ item: items[(current + k) % n], pos: (current + k) % n });
  return { rows, more: n - 1 - rows.length };
}

/** How many rows the list may try: 4 on a 16:9 landscape screen, 5 on a 16:10 tablet, 3 on a portrait screen (the engine then drops rows
 * from the end until the column fits, and says how many wait). */
export function queueMax(portrait: boolean, ratio10: boolean): number {
  return portrait ? 3 : ratio10 ? 5 : 4;
}

/** The design canvas of a viewport: 1920x1080 (1920x1200 for 16:10 and squarer), 1080x1920 (1200x1920 for tablets in portrait). A board that
 * forces an orientation (display.layout) keeps its own canvas on a viewport of the other shape (the page letterboxes it). */
export function canvasOf(vw: number, vh: number, force?: 'portrait' | 'landscape'): { w: number; h: number; portrait: boolean; ratio10: boolean } {
  const r = vw / vh;
  if (force === 'portrait' && r >= 1) return { w: 1080, h: 1920, portrait: true, ratio10: false };
  if (force === 'landscape' && r < 1) return { w: 1920, h: 1080, portrait: false, ratio10: false };
  const portrait = r < 1;
  if (portrait) {
    const wide = r >= 0.6;
    return { w: wide ? 1200 : 1080, h: 1920, portrait, ratio10: wide };
  }
  const tall = r <= 1.68;
  return { w: 1920, h: tall ? 1200 : 1080, portrait, ratio10: tall };
}

/** Rotation: the seconds one tick of a notice lasts (the board's interval, 6 to 60 as on the other designs), x its dwell ticks. */
export function tickSeconds(rotateS: number | undefined): number {
  return Math.max(6, Math.min(60, rotateS || 12));
}

/** Where the previous turn's trailing headline sits: Ink keeps a ghost of the old title for this long at this strength (owner: keep, 1 s, 7 %). */
export const GHOST_MS = 1100;
export const GHOST_OPACITY = 0.07;

/** Sign: the prisms of the rotating strips, fewer on a portrait screen. */
export const slatCount = (portrait: boolean): number => (portrait ? 6 : 8);

/** The severity word on a Sign pictogram plate. */
export function severityWord(sev: Severity, w: { urgent: string; alert: string; info: string }): string {
  return sev === 'critical' ? w.urgent : sev === 'alert' ? w.alert : w.info;
}

export const LANG_NAME: Record<'he' | 'en' | 'ru' | 'ar', string> = { he: 'עברית', en: 'English', ru: 'Русский', ar: 'العربية' };

// ---------------------------------------------------------------- LOBBY-STYLES-2300: the lobby styles' pure rules

/** The ambient (moving) background level: high = drifting layers, low = the layers frozen in place, off = no ambient layer. */
export type FxLevel = 'high' | 'low' | 'off';

/** The level in force: the administrator's `live_bg` setting wins; auto follows what the screen itself measured; reduced motion always freezes. */
export function fxLevelFor(setting: LiveBg, measured: FxLevel, reducedMotion: boolean): FxLevel {
  if (setting === 'off') return 'off';
  if (setting === 'frozen') return 'low';
  if (reducedMotion) return measured === 'off' ? 'off' : 'low';
  return setting === 'full' ? 'high' : measured;
}

/** One measurement step of the auto level (the 90th percentile of the frame time in ms): slow once = high -> low, slow twice in a row = low -> off,
 * six fast samples in a row = one level back up (never on a device with two cores or fewer). */
export interface FxState { level: FxLevel; slow: number; fast: number }
export function fxStep(s: FxState, p90: number, cores: number): FxState {
  let { level, slow, fast } = s;
  if (p90 > 24) { slow++; fast = 0; } else if (p90 < 18) { fast++; slow = 0; }
  if (slow >= 1 && level === 'high') { level = 'low'; slow = 0; } else if (slow >= 2 && level === 'low') { level = 'off'; slow = 0; } else if (fast >= 6 && level !== 'high' && cores > 2) { level = level === 'off' ? 'low' : 'high'; fast = 0; }
  return { level, slow, fast };
}
/** The level a device starts at: two cores or fewer start frozen. */
export const fxStart = (cores: number): FxLevel => (cores <= 2 ? 'low' : 'high');

export type Sky = 'morning' | 'noon' | 'evening' | 'night';
const mins = (hhmm: string | undefined): number | null => {
  const m = /^(\d{1,2}):(\d{2})$/.exec(hhmm || '');
  return m ? Number(m[1]) * 60 + Number(m[2]) : null;
};
/** Prism's colour field follows the time of day (owner 2026-10-30): with the day's sun times, morning = sunrise to +4 h, noon until 3 h before sunset,
 * evening until 45 min after it, night the rest; without them 05-10 / 10-16 / 16-20 / night. */
export function skyOf(minute: number, sun?: { rise: string; set: string }): Sky {
  const r = mins(sun?.rise);
  const st = mins(sun?.set);
  if (r !== null && st !== null && st > r) {
    if (minute >= r && minute < r + 240) return 'morning';
    if (minute >= r + 240 && minute < st - 180) return 'noon';
    if (minute >= st - 180 && minute < st + 45) return 'evening';
    return 'night';
  }
  const h = Math.floor(minute / 60);
  return h >= 5 && h < 10 ? 'morning' : h >= 10 && h < 16 ? 'noon' : h >= 16 && h < 20 ? 'evening' : 'night';
}

export type Greeting = 'greetMorning' | 'greetNoon' | 'greetEvening' | 'greetNight';
export function greetingKey(hour: number): Greeting {
  return hour < 5 ? 'greetNight' : hour < 12 ? 'greetMorning' : hour < 17 ? 'greetNoon' : hour < 21 ? 'greetEvening' : 'greetNight';
}

/** Does an urgent notice take the whole screen during its turn in the rotation? Hi-tech: yes as the mockup ("style" = the style's own rule);
 * luxury: only in its first minute (the page's take-over), then a regular message marked urgent - unless the administrator says "always". */
export function urgentInRotation(skin: Skin, setting: UrgentScreen): boolean {
  if (setting === 'always') return true;
  if (setting === 'minute') return false;
  return familyOf(skin) === 'hitech';
}

/** The dwell of a notice in ticks: an urgent or long (more than 160 characters) one stays twice as long. */
export const lobbyDwell = (severity: string, body: string): number => (severity === 'critical' || (body || '').length > 160 ? 2 : 1);

/** Group the offsetTops of a title's words into lines (a new line when the top moves by more than 4 px). */
export function lineBreaks(tops: readonly number[]): number[][] {
  const out: number[][] = [];
  let top: number | null = null;
  tops.forEach((t, i) => {
    if (top === null || Math.abs(Math.round(t) - top) > 4) { out.push([]); top = Math.round(t); }
    out[out.length - 1].push(i);
  });
  return out;
}

/** Columns of a long body (characters of the body text): two above 380, three above 1100 on a landscape screen. */
export const colsFor = (chars: number, landscape: boolean): 1 | 2 | 3 => (chars > 1100 && landscape ? 3 : chars > 380 ? 2 : 1);
