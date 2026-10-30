/**
 * LOBBY-STYLES-2300 - the markup pieces the three hi-tech lobby styles (Lumen, Axis, Prism) share. Pure strings, no DOM: unit specs run them in Node.
 * The mock-up they come from: private/design-system-2026-10-27/round7/noticeboard-hitech (hx.js). Every class is nb-prefixed (the engine's root is #nbk).
 */
import { esc } from './tv-logic';
import type { Skin } from './skin-logic';

/** A number or a time range inside running text stays left-to-right inside a right-to-left line (a single short number is left alone). */
export function numIso(escaped: string): string {
  return escaped.replace(/(\d(?:[\d:.]*\d)?(?:\s*[–-]\s*\d(?:[\d:.]*\d)?)?)/g, (m) => (/^\d+$/.test(m) && m.length < 3 ? m : '<bdi dir="ltr" class="nb-num">' + m + '</bdi>'));
}
export const tx = (s: string): string => numIso(esc(s));

/** A title set word by word: Lumen masks whole lines (spans `.nb-wd`, grouped into lines later), Axis moves single words (`.nb-wm > .nb-wi`). */
export function words(skin: Skin, text: string): string {
  return String(text ?? '').split(/\s+/).filter(Boolean).map((w) => (skin === 'axis' ? '<span class="nb-wm"><span class="nb-wi">' + tx(w) + '</span></span>' : '<span class="nb-wd">' + tx(w) + '</span>')).join(' ');
}

/** The clock as digit cells: each digit sits in its own mask so it can roll (the colon stays put). */
export function digitsHtml(t: string): string {
  return [...t].map((c) => (c === ':' ? '<span class="nb-dg nb-col">:</span>' : '<span class="nb-dg"><span class="nb-dv">' + esc(c) + '</span></span>')).join('');
}

/** What the "meta" line of a notice says: the severity word (with its light) and the time window (or "from the building management" on a slide). */
export function metaHtml(o: { severity: string; word: string; when: string }): string {
  const sv = o.word ? '<span class="nb-svw" data-sev="' + esc(o.severity) + '"><i aria-hidden="true"></i><b class="nb-sv">' + esc(o.word) + '</b></span>' : '';
  return '<p class="nb-meta">' + sv + '<span dir="auto">' + tx(o.when) + '</span></p>';
}

/** Prism: the next hours as figures in a row (read from 4 m, not compared as a trend, so no chart). */
export function hoursRow(hours: { at: string; t: number }[], label: string): string {
  if (!hours.length) return '';
  return '<div class="nb-hrs" aria-label="' + esc(label) + '">' + hours.map((x) => '<span><b class="nb-num">' + x.t + '°</b>' + esc(x.at) + '</span>').join('') + '</div>';
}
