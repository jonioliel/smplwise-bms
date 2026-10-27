/**
 * BUSTIMES-295 - the TV board's bus-times markup (strings, like the rest of the TV page; no DOM access). Three layouts of the approved mock-up
 * (private/review/BUS_TIMES_MOCKUP_HE_2026-10-26.html): `side` (a panel under the clock), `strip` (cards under the notice) and `slide` (a slide
 * of its own in the rotation, one column per stop). All of them draw the same row: line badge, destination (the stop's name too when
 * several stops are mixed), the time. Colours are the TV tokens only (day and night); the markup carries no inline style (CSP).
 *
 * States: fresh = minutes (clock from `clock_after_min`); cached = scheduled clock times and "not updated since HH:MM"; expired = the
 * panel says the data is unavailable; an empty window says so and names the next bus.
 */
import { esc } from './tv-logic';
import { agoText, ahead, badgeWide, distanceText, etaOf, noneText, ts, windowChip, type TransitColumn, type TransitDigest, type TransitItem, type TransitMore } from './transit-logic';

type Lang = 'he' | 'en';

export interface TransitCtx {
  lang: Lang;
  /** the instant the countdown counts to (the server clock as the screen last saw it) */
  nowMs: number;
  /** ms since the digest arrived, on the screen's own stopwatch (the age of a vehicle position keeps growing between two fetches) */
  elapsedMs?: number;
}

function ic(n: string, cls = ''): string {
  return '<svg class="ic' + (cls ? ' ' + cls : '') + '" aria-hidden="true"><use href="#i-' + n + '"/></svg>';
}

function badge(line: string): string {
  return '<span class="ln' + (badgeWide(line) ? ' w4' : '') + '">' + esc(line) + '</span>';
}

function etaCell(at: string, hm: string, d: TransitDigest, c: TransitCtx, more?: TransitMore[], quality?: string): string {
  const e = etaOf(at, hm, d, c.nowMs);
  const main = e.kind === 'now' ? '<b class="w">' + esc(ts(c.lang, 'now')) + '</b>' : e.kind === 'min' ? '<b class="num">' + e.text + '</b><small>' + esc(ts(c.lang, 'min')) + '</small>' : '<b class="num cl">' + esc(e.text) + '</b>';
  const extra = more && more.length ? '<span class="emore num">' + more.map((m) => esc(etaOf(m.at, m.hm, d, c.nowMs).kind === 'clock' ? m.hm : String(Math.max(0, Math.floor((Date.parse(m.at) - c.nowMs) / 60_000))))).join(' · ') + '</span>' : '';
  const rt = quality === 'realtime' && d.state === 'fresh'; // a small broadcast icon for a live estimate, a grey clock for the timetable
  return '<span class="eta">' + extra + (rt ? '<span class="mk rt">' + ic('rt', 'liveic') + '</span>' : '<span class="mk sc">' + ic('clock') + '</span>') + main + '</span>';
}

/**
 * The estimate wording of a row that has a fresh vehicle position: "800 m away · est. in 3 min" (distance first, then the estimate; "est. at 14:35"
 * from `clock_after_min` on). '' when the row is not a derived estimate or no distance may be printed - the marker and the legend say "estimate".
 */
export function estimateLine(it: TransitItem, d: TransitDigest, c: TransitCtx): string {
  if (it.quality !== 'realtime' || d.state !== 'fresh') return '';
  const dist = distanceText(c.lang, it, d, c.elapsedMs ?? 0);
  if (!dist) return '';
  const e = etaOf(it.at, it.hm, d, c.nowMs);
  const est = e.kind === 'now' ? ts(c.lang, 'estNow') : e.kind === 'min' ? ts(c.lang, 'estIn', { n: e.text }) : ts(c.lang, 'estAt', { t: e.text });
  return '<span class="d">' + esc(dist) + '</span><i> · </i><span class="e">' + esc(est) + '</span>';
}

function stopName(d: TransitDigest, code: number): string {
  return d.stops?.find((s) => s.code === code)?.name ?? String(code);
}

function rowHtml(it: TransitItem, d: TransitDigest, c: TransitCtx, multi: boolean): string {
  const far = it.mins >= 40 ? ' far' : '';
  const est = estimateLine(it, d, c);
  return '<div class="brow' + far + (est ? ' hasest' : '') + '">' + badge(it.line) + '<span class="dest"><b>' + esc(it.dest) + '</b>' + (multi ? '<small>' + esc(stopName(d, it.stop)) + '</small>' : '') + (est ? '<small class="est">' + est + '</small>' : '') + '</span>' + etaCell(it.at, it.hm, d, c, it.more, it.quality) + '</div>';
}

function cardHtml(it: TransitItem, d: TransitDigest, c: TransitCtx): string {
  const est = estimateLine(it, d, c);
  return '<div class="bcard' + (est ? ' hasest' : '') + '"><div class="ct">' + badge(it.line) + '<span>' + esc(it.dest) + '</span></div>' + etaCell(it.at, it.hm, d, c, it.more, it.quality) + (est ? '<div class="est">' + est + '</div>' : '') + '</div>';
}

/** The title line: the one stop's name, or the first with "and N more". */
export function stopsTitle(d: TransitDigest, lang: Lang): string {
  const names = (d.stops ?? []).map((s) => s.name);
  if (!names.length) return ts(lang, 'title');
  return names.length === 1 ? names[0] : names[0] + (lang === 'he' ? ' ועוד ' : ' and ') + (names.length - 1) + (lang === 'he' ? '' : ' more');
}

function subLine(d: TransitDigest, lang: Lang, elapsedMs = 0): string {
  if (d.state === 'cached' && d.source_down) return agoText(lang, d, elapsedMs) || ts(lang, 'sched'); // BUSSTATUS-297: "updated N min ago"
  return d.state === 'cached' && d.updated_hm ? ts(lang, 'stale', { t: d.updated_hm }) : ts(lang, 'sched');
}

/** BUSSTATUS-297: the one calm line of a provider outage (the stale note is the sub-line "updated N min ago"). */
function outageLine(d: TransitDigest, lang: Lang): string {
  return d.source_down ? '<div class="bnote down" data-bus-note="source-down">' + ic('clock') + '<span>' + esc(ts(lang, 'sourceDown')) + '</span></div>' : '';
}

function note(d: TransitDigest, lang: Lang): string {
  if (d.source_down) return outageLine(d, lang);
  return d.state === 'cached' && d.updated_hm ? '<div class="bnote">' + ic('clock') + '<span>' + esc(ts(lang, 'stale', { t: d.updated_hm })) + '</span></div>' : '';
}

function footer(d: TransitDigest, lang: Lang): string {
  const anyRt = d.state === 'fresh' && (d.realtime || (d.columns ?? []).some((col) => col.items.some((i) => i.quality === 'realtime')));
  return '<div class="bf">' + (anyRt ? '<span class="lg2 rt">' + ic('rt') + '<span>' + esc(ts(lang, 'rt')) + '</span></span>' : '') + '<span class="lg2">' + ic('clock') + '<span>' + esc(ts(lang, 'sched')) + '</span></span><span class="bsp"></span>' +
    (d.updated_hm ? '<span class="num">' + esc(d.updated_hm) + '</span>' : '') + '</div>';
}

function expiredBlock(lang: Lang, sourceDown = false): string {
  return '<div class="bmsg" data-bus-state="expired">' + ic('bus') + '<p>' + esc(ts(lang, sourceDown ? 'sourceDown' : 'expiredTitle')) + '</p><span>' + esc(ts(lang, 'expiredHint')) + '</span></div>';
}

function emptyBlock(d: TransitDigest, c: TransitCtx, next: TransitItem | null | undefined): string {
  if (d.partial && d.source_down) return '<div class="bmsg" data-bus-state="unknown">' + ic('bus') + '<p>' + esc(ts(c.lang, 'sourceDownPartial')) + '</p></div>'; // unknown, not "no buses"
  const nx = next
    ? '<div class="nx"><span>' + esc(ts(c.lang, 'next')) + '</span>' + badge(next.line) + '<span>' + esc(next.dest) + '</span><b class="num">' + esc(next.hm) + '</b></div>'
    : '';
  return '<div class="bmsg" data-bus-state="empty">' + ic('bus') + '<p>' + esc(noneText(c.lang, d.window_min ?? 60)) + '</p>' + nx + '</div>';
}

function header(d: TransitDigest, c: TransitCtx): string {
  return '<header class="bh">' + ic('bus') + '<div class="tt"><b>' + esc(stopsTitle(d, c.lang)) + '</b><span>' + esc(subLine(d, c.lang, c.elapsedMs ?? 0)) + '</span></div><span class="win2">' + esc(windowChip(c.lang, d.window_min ?? 60)) + '</span></header>';
}

/** The "and N more" line under the rows (always present, empty when nothing is hidden: the fit step fills it when it has to drop rows). */
function bmore(n: number, c: TransitCtx): string {
  return '<div class="bmore" data-n="' + n + '">' + (n > 0 ? esc(ts(c.lang, 'more', { n })) : '') + '</div>';
}

/** Side column: the whole panel (header, rows, legend). */
export function sidePanel(d: TransitDigest, c: TransitCtx): string {
  const items = ahead(d.items ?? [], c.nowMs);
  let body: string;
  if (d.state === 'expired') body = expiredBlock(c.lang, !!d.source_down);
  else if (!items.length) body = emptyBlock(d, c, d.next);
  else body = '<div class="rows">' + items.map((it) => rowHtml(it, d, c, !!d.multi)).join('') + '</div>';
  const more = bmore(d.state !== 'expired' && items.length ? d.overflow ?? 0 : 0, c);
  return '<section class="bus" data-bus="side" data-bus-state="' + d.state + '">' + header(d, c) + body + more + outageLine(d, c.lang) + footer(d, c.lang) + '</section>'; // the header's second line says how old the data is
}

/** Bottom strip: a label column and the cards (the fit step drops what does not fit and writes "and N more"). */
export function stripPanel(d: TransitDigest, c: TransitCtx): string {
  const items = ahead(d.items ?? [], c.nowMs);
  let body: string;
  if (d.state === 'expired') body = '<div class="cards msg" data-bus-state="expired">' + ic('bus') + '<div>' + esc(ts(c.lang, d.source_down ? 'sourceDown' : 'expiredTitle')) + '<span>' + esc(ts(c.lang, 'expiredHint')) + '</span></div></div>';
  else if (!items.length) {
    const n = d.next;
    body = '<div class="cards msg" data-bus-state="empty">' + ic('bus') + '<div>' + esc(noneText(c.lang, d.window_min ?? 60)) +
      (n ? '<span>' + esc(ts(c.lang, 'next')) + ' ' + esc(ts(c.lang, 'nextAt', { l: n.line, d: n.dest, t: n.hm })) + '</span>' : '') + '</div></div>';
  } else body = '<div class="cards" data-total="' + (items.length + (d.overflow ?? 0)) + '">' + items.map((it) => cardHtml(it, d, c)).join('') + '</div>';
  const stale = d.source_down && d.state === 'cached' ? '<div class="bnote stalen">' + ic('clock') + '<span>' + esc(agoText(c.lang, d, c.elapsedMs ?? 0)) + ' · ' + esc(ts(c.lang, 'sourceDown')) + '</span></div>'
    : d.state === 'cached' && d.updated_hm ? '<div class="bnote stalen">' + ic('clock') + '<span>' + esc(ts(c.lang, 'stale', { t: d.updated_hm })) + '</span></div>' : '';
  return '<section class="bus strip" data-bus="strip" data-bus-state="' + d.state + '"><div class="sl">' + ic('bus') + '<b>' + esc(stopsTitle(d, c.lang)) + '</b><span>' + esc(windowChip(c.lang, d.window_min ?? 60)) + '</span></div>' + body + stale + '</section>';
}

function columnHtml(col: TransitColumn, d: TransitDigest, c: TransitCtx): string {
  const items = ahead(col.items, c.nowMs);
  const sub = { ...d, items, overflow: col.overflow, next: col.next, multi: false, stops: [{ code: col.stop, name: col.name }] } as TransitDigest;
  let body: string;
  if (!items.length) body = emptyBlock(d, c, col.next);
  else body = '<div class="rows">' + items.map((it) => rowHtml(it, sub, c, false)).join('') + '</div>';
  const more = bmore(items.length ? col.overflow : 0, c);
  return '<section class="bus" data-bus="col" data-stop="' + col.stop + '"><header class="bh col"><div class="tt"><b>' + esc(col.name) + '</b></div></header>' + body + more + '</section>';
}

/** The rotating slide: one column per stop (the digest's `columns`), the clock-style note and legend once. */
export function slidePanel(d: TransitDigest, c: TransitCtx, clockHtml: string): string {
  const cols = d.columns ?? [];
  return '<article class="it transit" data-bus="slide" data-bus-state="' + d.state + '"><div class="bhead">' + ic('bus') + '<div class="tt"><b>' + esc(ts(c.lang, 'title')) + '</b><span>' + esc(subLine(d, c.lang, c.elapsedMs ?? 0)) + '</span></div>' +
    clockHtml + '</div>' + note(d, c.lang) + '<div class="cols" data-n="' + cols.length + '">' + cols.map((col) => columnHtml(col, d, c)).join('') + '</div>' + footer(d, c.lang) + '</article>';
}
