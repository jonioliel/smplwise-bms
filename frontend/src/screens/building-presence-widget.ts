import { css, html, nothing, type TemplateResult } from 'lit';
import '../components/sw-icon';
import './presence-pills';
import type { WidgetItem } from '../api/home-config';
import type { BuildingSnapshot } from '../api/building-presence';
import { compactView, presenceWidgetAvailable, type CompactView } from '../api/building-presence-logic';
import { BP } from '../i18n/building-presence';

/**
 * PRESENCE-2280 / PRESENCE-COMPACT-2310: the home widget "נוכחות במבנה". The round-7 card (four rows of chips, 200+ px tall) was rejected
 * on 30.10; this is the compact card of the round-9 mockup (private/design-system-2026-10-27/round9/presence-compact): it is never taller
 * than its neighbours in the row (clock, alarm, weather), so 5 rooms and 500 rooms look the same. Read-only. ABSENT (edit mode too, no
 * ghost) unless the caller holds presence.building.view and the server reports an enabled, configured module whose home display is "card"
 * and whose card style is not "off" (`presenceWidgetAvailable`).
 *
 * Four settings (Settings > Presence > Times and display; owner answers 31.10), read from the snapshot's settings:
 *   - card_style: strip (default) = a state word, the count, and ONE row of active-room pills (two in the large size) with an honest "+N";
 *                 floors = the active count large beside a short bar per floor; quiet = one sentence and the active names; off = no card.
 *   - card_empty_rooms: hide (default) = only active rooms; show = empty (grey) and unknown (dashed) pills after them while room is left.
 *   - card_details: hover (default) = the update time and the empty / unknown names only in the tooltip; inline = drawn in the card.
 *   - card_all_empty: last (default) = "<room> · ריק מ־HH:MM" (the room that emptied last) in place of the pills; count = the sentence only.
 * Sizes: small = the state line only; medium = + one row; large = + two rows (or one quiet line more). The row band halves what it shows.
 * Names sit in <bdi> so a Latin room name keeps its place in the Hebrew line; tone is never colour alone (the unknown lamp is hollow).
 */

export interface PresenceWidgetHost {
  snap: BuildingSnapshot | null;
  editing: boolean;
  /** The row band (a compact strip): fewer rows, one-line text. */
  compact?: boolean;
  shell: (it: WidgetItem, cls: string, extra: Record<string, string>, body: TemplateResult) => TemplateResult;
}

export { presenceWidgetAvailable };

/** Pills handed to the fitting row at most (the row shows what fits; "+N" counts the rest). */
const PILL_CAP = 60;
const FLOOR_ROWS: Record<WidgetItem['size'], number> = { s: 0, m: 3, l: 4 };
const QUIET_NAMES = 6;

export const PRESENCE_WIDGET_STYLES = css`
  .wg-pres { gap: 8px; }
  .wg-pres[data-size='s'] { gap: 5px; }
  .wg-pres .wg-h { min-inline-size: 0; }
  .wg-pres .wg-h > span { flex: 1; min-inline-size: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .wg-pres .pr-go {
    display: inline-flex; align-items: center; gap: 4px; flex: none; min-block-size: 44px; margin-block: -14px; padding-inline: 4px;
    border-radius: var(--sw-r-sm); color: var(--sw-accent-text, var(--sw-accent)); text-decoration: none; font-size: var(--sw-fs-sm); font-weight: var(--sw-fw-semibold);
    letter-spacing: 0; touch-action: manipulation; -webkit-tap-highlight-color: transparent; user-select: none;
  }
  .wg-pres .pr-go[aria-disabled='true'] { pointer-events: none; opacity: 0.55; }
  .wg-pres .pr-go:focus-visible { outline: var(--sw-focus-w, 2px) solid var(--sw-focus, var(--sw-accent)); outline-offset: -6px; }
  .wg-pres .pr-go:active { opacity: 0.7; }
  @media (hover: hover) and (pointer: fine) {
    .wg-pres .pr-go:hover { text-decoration: underline; text-underline-offset: 3px; }
  }
  /* the lamp: green only while occupied; hollow for "no data" (shape, not colour alone) */
  .wg-pres .pr-lamp { inline-size: 10px; block-size: 10px; border-radius: 50%; flex: none; background: var(--sw-unknown); }
  .wg-pres[data-tone='ok'] .pr-lamp { background: var(--sw-success); box-shadow: 0 0 0 3px var(--sw-success-soft); }
  .wg-pres[data-tone='unknown'] .pr-lamp { background: transparent; box-shadow: inset 0 0 0 2px var(--sw-unknown); }
  .wg-pres .pr-line { display: flex; align-items: center; gap: 8px; min-inline-size: 0; }
  .wg-pres .pr-state { flex: none; font-size: var(--sw-fs-xl); font-weight: var(--sw-fw-bold); letter-spacing: -0.015em; line-height: 1.15; color: var(--sw-heading, var(--sw-text)); white-space: nowrap; }
  .wg-pres[data-tone='ok'] .pr-state { color: var(--sw-success-text); }
  .wg-pres .pr-sub { flex: 1; min-inline-size: 0; font-size: var(--sw-fs-sm); line-height: 1.35; color: var(--sw-text-2); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .wg-pres .pr-tm { flex: none; font-size: var(--sw-fs-xs); color: var(--sw-text-3); white-space: nowrap; direction: ltr; unicode-bidi: isolate; }
  .wg-pres .pr-last, .wg-pres .pr-rest, .wg-pres .pc-rooms { min-inline-size: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .wg-pres .pr-last { font-size: var(--sw-fs-sm); line-height: 24px; color: var(--sw-text-3); }
  .wg-pres .pr-rest { font-size: var(--sw-fs-xs); color: var(--sw-text-3); }
  /* floors: the active count large, a short bar per floor */
  .wg-pres .pb-body { display: grid; grid-template-columns: auto minmax(0, 1fr); gap: 4px 16px; align-items: center; min-inline-size: 0; }
  /* "2 / 5" in the reading order of the line (RTL: the active count first, at the start), like "2 מתוך 5" */
  .wg-pres .pb-n { line-height: 1; white-space: nowrap; }
  .wg-pres .pb-n b { font-size: var(--sw-fs-4xl, 32px); font-weight: var(--sw-fw-medium); letter-spacing: -0.04em; color: var(--sw-heading, var(--sw-text)); }
  .wg-pres[data-tone='ok'] .pb-n b { color: var(--sw-success-text); }
  .wg-pres[data-size='s'] .pb-n b { font-size: var(--sw-fs-3xl, 26px); }
  .wg-pres .pb-n span { font-size: var(--sw-fs-sm); color: var(--sw-text-3); }
  .wg-pres .pb-w { display: flex; align-items: center; gap: 6px; font-size: var(--sw-fs-xs); color: var(--sw-text-3); white-space: nowrap; }
  .wg-pres .pb-w .pr-state { font-size: var(--sw-fs-xs); font-weight: var(--sw-fw-semibold); letter-spacing: 0; }
  .wg-pres .pb-floors { display: grid; gap: 5px; min-inline-size: 0; }
  .wg-pres .pb-f { display: grid; grid-template-columns: minmax(0, 54px) minmax(0, 1fr) auto; align-items: center; gap: 8px; font-size: var(--sw-fs-xs); color: var(--sw-text-2); }
  .wg-pres .pb-f bdi { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .wg-pres .pb-f .bar { block-size: 5px; border-radius: 3px; background: var(--sw-surface-3); overflow: hidden; }
  .wg-pres .pb-f .bar i { display: block; block-size: 100%; inline-size: var(--p, 0%); background: var(--sw-success); border-radius: 3px; }
  .wg-pres .pb-f .c { color: var(--sw-text-3); direction: ltr; unicode-bidi: isolate; }
  .wg-pres .pb-more { font-size: var(--sw-fs-xs); color: var(--sw-text-3); }
  /* quiet: one ambient sentence */
  .wg-pres .pc-line { display: flex; align-items: center; gap: 8px; min-inline-size: 0; font-size: var(--sw-fs-base, 13px); color: var(--sw-text-2); }
  .wg-pres .pc-line .t { flex: 1; min-inline-size: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .wg-pres .pc-line .pr-state { font-size: inherit; font-weight: var(--sw-fw-semibold); letter-spacing: 0; }
  .wg-pres .pc-rooms { font-size: var(--sw-fs-sm); color: var(--sw-text-2); }
  .wg-pres .pc-rooms bdi + bdi::before { content: ', '; }
  .wg-pres .pc-rooms .rest { color: var(--sw-text-3); }
  @media (prefers-reduced-motion: no-preference) {
    .wg-pres .pr-lamp { transition: background-color var(--sw-t-state, 200ms) var(--sw-ease, ease), box-shadow var(--sw-t-state, 200ms) var(--sw-ease, ease); }
  }
`;

/** The update time in the line, only when the details are drawn inline and the card is not small. */
const timeIn = (v: CompactView, it: WidgetItem) =>
  v.opts.details === 'inline' && it.size !== 's' && v.at ? html`<span class="pr-tm" data-building-time>${v.at}</span>` : nothing;

function strip(v: CompactView, it: WidgetItem, compact: boolean) {
  const rows = it.size === 's' ? 0 : it.size === 'l' && !compact ? 2 : 1;
  const line = html`<div class="pr-line" title=${v.tip}><span class="pr-lamp" aria-hidden="true"></span><span class="pr-state" data-building-presence-big>${v.word}</span><span class="pr-sub">${v.sub}</span>${timeIn(v, it)}</div>`;
  if (!rows) return line;
  const pills = [...v.active, ...v.others].slice(0, PILL_CAP);
  const below = v.last
    ? html`<div class="pr-last" data-building-last title=${v.tip}><bdi>${v.last}</bdi></div>`
    : pills.length
      ? html`<presence-pills .rooms=${pills} activeTotal=${v.active.length} rows=${rows}></presence-pills>`
      : nothing;
  const rest = it.size === 'l' && !compact && v.rest ? html`<div class="pr-rest" data-building-rest>${v.rest}</div>` : nothing;
  return html`${line}${below}${rest}`;
}

function floors(v: CompactView, it: WidgetItem, compact: boolean) {
  if (v.tone === 'unknown') return strip(v, it, compact);
  // `cap` lines in all: when the floors do not fit, the last line is "+N קומות"
  const cap = compact ? Math.ceil(FLOOR_ROWS[it.size] / 2) : FLOOR_ROWS[it.size];
  const shown = v.floors.length > cap ? Math.max(1, cap - 1) : cap;
  const bars = v.floors.slice(0, shown).map(
    (f) => html`<div class="pb-f" data-building-floor><bdi>${f.name}</bdi><span class="bar"><i style=${`--p:${f.of ? Math.round((f.on / f.of) * 100) : 0}%`}></i></span><span class="c">${f.on}/${f.of}</span></div>`,
  );
  const more = cap && v.floors.length > shown ? html`<div class="pb-more">${BP.moreFloors(v.floors.length - shown)}</div>` : nothing;
  const count = html`<div><div class="pb-n"><b>${BP.count(v.active.length)}</b> <span>/ ${BP.count(v.of)}</span></div>
    <div class="pb-w"><span class="pr-lamp" aria-hidden="true"></span><span class="pr-state" data-building-presence-big>${v.word}</span>${timeIn(v, it)}</div></div>`;
  return html`<div class="pb-body" title=${v.tip}>${count}${cap ? html`<div class="pb-floors">${bars}${more}</div>` : nothing}</div>${it.size === 'l' && !compact && v.rest ? html`<div class="pr-rest" data-building-rest>${v.rest}</div>` : nothing}`;
}

function quiet(v: CompactView, it: WidgetItem, compact: boolean) {
  const line = html`<div class="pc-line" title=${v.tip}><span class="pr-lamp" aria-hidden="true"></span><span class="t"><span class="pr-state" data-building-presence-big>${v.word}</span>${v.sub ? ` · ${v.sub}` : ''}${v.last ? html` · <bdi data-building-last>${v.last}</bdi>` : nothing}</span>${timeIn(v, it)}</div>`;
  if (it.size === 's') return line;
  const shown = v.active.slice(0, QUIET_NAMES);
  const others = v.others.length ? html` <span class="rest">· ${BP.emptyNames}: ${v.others.slice(0, QUIET_NAMES).map((r) => r.name).join(', ')}</span>` : nothing;
  const names = shown.length || v.others.length
    ? html`<div class="pc-rooms" data-building-rooms>${shown.map((r) => html`<bdi class="r" title=${r.title}>${r.name}</bdi>`)}${v.active.length > QUIET_NAMES ? ` ${BP.plus(v.active.length - QUIET_NAMES)}` : ''}${others}</div>`
    : nothing;
  const rest = it.size === 'l' && !compact && v.rest ? html`<div class="pr-rest" data-building-rest>${v.rest}</div>` : nothing;
  return html`${line}${names}${rest}`;
}

/** The widget. Never reached unless the host resolved `presenceWidgetAvailable` first. */
export function renderPresence(h: PresenceWidgetHost, it: WidgetItem): TemplateResult {
  const v = compactView(h.snap);
  const compact = !!h.compact;
  const link = html`<a class="pr-go" href="#/explore" data-building-card-map aria-disabled=${String(h.editing)} tabindex=${h.editing ? -1 : 0}>${BP.onMap}</a>`;
  const head = html`<div class="wg-h"><sw-icon name="users" size="15"></sw-icon><span>${it.title}</span>${link}</div>`;
  const body = v.opts.style === 'floors' ? floors(v, it, compact) : v.opts.style === 'quiet' ? quiet(v, it, compact) : strip(v, it, compact);
  return h.shell(it, `wg-pres pr-${v.opts.style}${compact ? ' pr-compact' : ''}`, { tone: v.tone }, html`${head}${body}`);
}
