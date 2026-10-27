/**
 * BOARDV2-297 - the bus-times markup of the V2 board (owner-approved mock-up private/review/NOTICE_BOARD_BUSTIMES_MOCKUP_V2_2026-10-26.html).
 * Strings only, like transit-view.ts (no DOM, no inline style: CSP). Three fixed areas, one per layout:
 *  - panel (side layout, and the portrait board): the stop header, up to the rows that fit (64 px each), the legend line (with "and N more");
 *  - strip: the stop at the start (its own column), one card per line;
 *  - slide: the whole stage for the stop(s), large rows read from across the lobby.
 * Every state draws into the same area: fresh (minutes, "now" in gold, the clock time from `clock_after_min`), cached (the scheduled clock
 * times and "not updated since" in orange), expired (the "not available" message fills the area), empty window (a message + the next bus),
 * and a digest that has not arrived yet (the header alone: the area is reserved, nothing moves when it arrives).
 * The "next arrivals" line (`next_row`) is a setting: show / hide.
 */
import { esc } from './tv-logic';
import { ahead, badgeWide, etaOf, noneText, ts, windowChip, type TransitDigest, type TransitItem } from './transit-logic';
import { stopsTitle } from './transit-view';

type Lang = 'he' | 'en';

export interface V2TransitCtx {
  lang: Lang;
  nowMs: number;
  /** the "next arrivals" line under / beside each line */
  next: boolean;
}

const S = {
  he: { next: 'הבאים', sched: 'לפי לוח זמנים', updated: 'עודכן {t}' },
  en: { next: 'Next', sched: 'Scheduled', updated: 'Updated {t}' },
};

function ic(n: string, cls = ''): string {
  return '<svg class="ic' + (cls ? ' ' + cls : '') + '" aria-hidden="true"><use href="#i-' + n + '"/></svg>';
}

function badge(line: string): string {
  return '<span class="b2ln' + (badgeWide(line) ? ' w4' : '') + '">' + esc(line) + '</span>';
}

/** The time of one arrival: "now" (gold), minutes + "min", or the clock time (over the clock threshold, and always for cached data). */
export function v2Eta(it: Pick<TransitItem, 'at' | 'hm' | 'quality'>, d: TransitDigest, c: V2TransitCtx): string {
  const e = etaOf(it.at, it.hm, d, c.nowMs);
  const main = e.kind === 'now' ? '<b class="now">' + esc(ts(c.lang, 'now')) + '</b>' : e.kind === 'min' ? '<b class="num">' + e.text + '</b><small>' + esc(ts(c.lang, 'min')) + '</small>' : '<b class="cl num">' + esc(e.text) + '</b>';
  const rt = it.quality === 'realtime' && d.state === 'fresh';
  return '<span class="b2eta">' + main + '<span class="b2mk' + (rt ? ' rt' : '') + '" title="' + esc(rt ? ts(c.lang, 'rt') : S[c.lang].sched) + '">' + ic(rt ? 'rt' : 'clock') + '</span></span>';
}

/** "24 · 39" (minutes) or "19:42 · 20:12" (clock times, the same rule as the main time); '' when there is nothing after this one. */
export function v2NextText(it: Pick<TransitItem, 'more'>, d: TransitDigest, nowMs: number): string {
  const more = it.more ?? [];
  if (!more.length) return '';
  return more.map((m) => {
    const e = etaOf(m.at, m.hm, d, nowMs);
    return e.kind === 'clock' ? m.hm : e.kind === 'now' ? '0' : e.text;
  }).join(' · ');
}

function nextHtml(it: TransitItem, d: TransitDigest, c: V2TransitCtx): string {
  if (!c.next) return '';
  const t = v2NextText(it, d, c.nowMs);
  return t ? '<span class="b2nx"><span>' + esc(S[c.lang].next) + '</span><span class="num">' + esc(t) + '</span></span>' : '';
}

function stopName(d: TransitDigest, code: number): string {
  return d.stops?.find((s) => s.code === code)?.name ?? '';
}

function head(d: TransitDigest | null, c: V2TransitCtx, big: boolean): string {
  const title = d ? stopsTitle(d, c.lang) : ts(c.lang, 'title');
  const win = d ? windowChip(c.lang, d.window_min ?? 60) : '';
  const sub = d && d.state === 'cached' && d.updated_hm ? '<span class="b2stale">' + esc(ts(c.lang, 'stale', { t: d.updated_hm })) + '</span>' : big ? '' : '<span>' + esc(S[c.lang].sched) + '</span>';
  return '<div class="b2bh">' + ic('bus') + '<div class="tt"><b>' + esc(title) + '</b><span class="sub">' + (win ? '<em>' + esc(win) + '</em>' : '') + sub + '</span></div></div>';
}

function legend(d: TransitDigest, c: V2TransitCtx, moreHtml = ''): string {
  const anyRt = d.state === 'fresh' && (d.realtime || (d.items ?? []).some((i) => i.quality === 'realtime'));
  const st = d.state === 'cached' && d.updated_hm
    ? '<span class="b2upd stale">' + esc(ts(c.lang, 'stale', { t: d.updated_hm })) + '</span>'
    : d.updated_hm ? '<span class="b2upd">' + esc(S[c.lang].updated.replace('{t}', '')) + '<span class="num">' + esc(d.updated_hm) + '</span></span>' : '';
  return '<div class="b2bf">' + (anyRt ? '<span class="lg2 rt">' + ic('rt') + esc(ts(c.lang, 'rt')) + '</span>' : '') + '<span class="lg2">' + ic('clock') + esc(S[c.lang].sched) + '</span>' + moreHtml + '<span class="sp"></span>' + st + '</div>';
}

function offBlock(c: V2TransitCtx): string {
  return '<div class="b2msg" data-bus-state="expired">' + ic('offline') + '<p>' + esc(ts(c.lang, 'expiredTitle')) + '</p><span>' + esc(ts(c.lang, 'expiredHint')) + '</span></div>';
}

function emptyBlock(d: TransitDigest, c: V2TransitCtx): string {
  const n = d.next;
  return '<div class="b2msg" data-bus-state="empty">' + ic('bus') + '<p>' + esc(noneText(c.lang, d.window_min ?? 60)) + '</p>' +
    (n ? '<span>' + esc(ts(c.lang, 'next')) + ' ' + esc(ts(c.lang, 'nextAt', { l: n.line, d: n.dest, t: n.hm })) + '</span>' : '') + '</div>';
}

/** What the area shows: 'rows' when there are arrivals ahead, else the message state. */
function stateOf(d: TransitDigest | null, items: TransitItem[]): 'wait' | 'off' | 'empty' | 'rows' {
  if (!d) return 'wait';
  if (d.state === 'expired') return 'off';
  return items.length ? 'rows' : 'empty';
}

function rowsOf(d: TransitDigest | null, c: V2TransitCtx): TransitItem[] {
  return d ? ahead(d.items ?? [], c.nowMs) : [];
}

function more(n: number, c: V2TransitCtx): string {
  return '<div class="bmore" data-n="' + n + '">' + (n > 0 ? esc(ts(c.lang, 'more', { n })) : '') + '</div>';
}

/** The panel of the side layout (under the weather, at the bottom of the information column) and of the portrait board. */
export function v2Panel(d: TransitDigest | null, c: V2TransitCtx): string {
  const items = rowsOf(d, c);
  const st = stateOf(d, items);
  const multi = !!d?.multi;
  let body = '';
  if (st === 'off') body = offBlock(c);
  else if (st === 'empty' && d) body = emptyBlock(d, c);
  else if (st === 'rows' && d) {
    body = '<div class="rows">' + items.map((it) => '<div class="b2r">' + badge(it.line) + '<span class="b2dest"><b>' + esc(it.dest) + '</b>' +
      (multi ? '<small>' + esc(stopName(d, it.stop)) + '</small>' : nextHtml(it, d, c)) + '</span>' + v2Eta(it, d, c) + '</div>').join('') + '</div>';
  }
  return '<section class="b2bus panel" data-b2bus="panel" data-bus-state="' + (d?.state ?? 'wait') + '">' + head(d, c, false) + body + (st === 'rows' && d ? legend(d, c, more(d.overflow ?? 0, c)) : '') + '</section>';
}

/** The strip of the strip layout: a fixed-height row under the notices (the stop in its own column, a card per line). */
export function v2Strip(d: TransitDigest | null, c: V2TransitCtx): string {
  const items = rowsOf(d, c);
  const st = stateOf(d, items);
  let body = '';
  if (st === 'off') body = offBlock(c);
  else if (st === 'empty' && d) body = emptyBlock(d, c);
  else if (st === 'rows' && d) {
    body = '<div class="cards" data-total="' + (items.length + (d.overflow ?? 0)) + '">' + items.map((it) => '<div class="bcard"><div class="h">' + badge(it.line) + '<span>' + esc(it.dest) + '</span></div>' +
      v2Eta(it, d, c) + nextHtml(it, d, c) + '</div>').join('') + '</div>';
  }
  return '<section class="b2bus strip" data-b2bus="strip" data-bus-state="' + (d?.state ?? 'wait') + '"><div class="sl">' + head(d, c, false) + (st === 'rows' && d ? legend(d, c) : '') + '</div>' + body + '</section>';
}

/** The slide of the slide layout: an item of the rotation (`.it.transit`) that takes the whole stage. */
export function v2Slide(d: TransitDigest | null, c: V2TransitCtx, on: boolean): string {
  const items = rowsOf(d, c);
  const st = stateOf(d, items);
  const multi = !!d?.multi;
  let body = '';
  if (st === 'off') body = offBlock(c);
  else if (st === 'empty' && d) body = emptyBlock(d, c);
  else if (st === 'rows' && d) {
    body = '<div class="rows">' + items.map((it) => '<div class="b2r">' + badge(it.line) + '<span class="b2dest">' + esc(it.dest) + (multi ? '<small>' + esc(stopName(d, it.stop)) + '</small>' : '') + '</span>' +
      v2Eta(it, d, c) + (c.next ? nextHtml(it, d, c) || '<span class="b2nx"></span>' : '') + '</div>').join('') + '</div>';
  }
  return '<article class="it transit b2bus slide' + (on ? ' on' : '') + (c.next ? '' : ' nonx') + '" data-b2bus="slide" data-bus-state="' + (d?.state ?? 'wait') + '">' + head(d, c, true) + body + (st === 'rows' && d ? legend(d, c, more(d.overflow ?? 0, c)) : '') + '</article>';
}
