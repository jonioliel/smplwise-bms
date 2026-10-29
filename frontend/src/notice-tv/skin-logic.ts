/**
 * NOTICEBOARD-STYLES-2300 - the pure rules of the two maintenance-area notice-board styles "Ink" (an e-paper station display) and "Sign"
 * (public wayfinding signage), approved as mock-ups in private/design-system-2026-10-27/round7/noticeboard-styles and decided by the owner on
 * 2026-10-30 (both are selectable board designs; neither is a default; the long body SHRINKS to fit; the "Up next" list; the urgent take-over).
 * No DOM here: unit specs run it in Node, the DOM engine (skin-board.ts) imports it.
 */
import type { Severity } from './tv-logic';

export type Skin = 'ink' | 'sign';
export const SKINS: Skin[] = ['ink', 'sign'];
export const isSkin = (design: unknown): design is Skin => design === 'ink' || design === 'sign';

/** The smallest scale (of the style's own type sizes) a long notice may shrink to before the last resort (the body is cut by lines with an
 * ellipsis). 0.64 keeps the body at 29.4 px (Ink, 46 px) / 28.2 px (Sign, 44 px) on the 1080 px high canvas, 2.6 % of the screen height. */
export const FS_MIN = 0.64;
/** The urgent take-over and the announcement are one screen with larger type: they may shrink a little further. */
export const FS_MIN_TAKE = 0.56;
export const BODY_PX: Record<Skin, number> = { ink: 46, sign: 44 };
export const minBodyPx = (skin: Skin, take = false): number => Math.round(BODY_PX[skin] * (take ? FS_MIN_TAKE : FS_MIN) * 10) / 10;

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
