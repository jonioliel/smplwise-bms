import { css, html, nothing, type TemplateResult } from 'lit';
import type { TempUnit, UnitStatus } from '../api/temperature';
import type { TemperatureCfg, WidgetItem } from '../api/home-config';
import { LOOK_OF, STATUS_KEY, TEMPERATURE_HREF, fmt1, hasHealthIssue, type Look } from './model';
import { tt } from '../i18n/temperature';

/**
 * CR-INFRA-TEMPERATURE phase 3 (idea 12, like the elevators widget): the temperatures on the home screen. The owner chooses HOW (`mode`): ONE
 * combined card, one small card per unit (a tile coloured by its state), or both; WHICH units (`hidden`), and whether only the units in an
 * alert are listed (`filter`). Place and size come from the home edit mode like every widget: small = the loudest unit, the counts and a dot
 * per unit; medium = the summary and the first rows; large = every row. Read-only: a tap opens תשתיות › טמפרטורות (the unit's detail).
 * Drawn by `home-widgets` through `renderTemperature` (the host's own card shell and edit bar).
 */
export interface TemperatureWidgetHost {
  cfg: TemperatureCfg;
  units: readonly TempUnit[];
  stale: boolean;
  editing: boolean;
  shell: (it: WidgetItem, cls: string, extra: Record<string, string>, body: TemplateResult) => TemplateResult;
}

const ROWS: Record<WidgetItem['size'], number> = { s: 0, m: 4, l: 12 };
const RANK: Record<UnitStatus, number> = { alarm: 0, warning: 1, offline: 2, unknown: 3, ok: 4, off: 5 };

export const TEMPERATURE_WIDGET_STYLES = css`
  .wg-temp { gap: 8px; }
  .wg-temp [data-look='ok'], .tw-card[data-look='ok'] { --tw: var(--sw-success); }
  .wg-temp [data-look='warn'], .tw-card[data-look='warn'] { --tw: var(--sw-warning); }
  .wg-temp [data-look='alarm'], .tw-card[data-look='alarm'] { --tw: var(--sw-danger); }
  .wg-temp [data-look='off'], .tw-card[data-look='off'] { --tw: var(--sw-offline); }
  .wg-temp [data-look='idle'], .wg-temp [data-look='unk'], .tw-card[data-look='idle'], .tw-card[data-look='unk'] { --tw: var(--sw-unknown); }
  .wg-temp .tw-h { display: flex; align-items: center; gap: 8px; font-size: var(--sw-fs-base); color: var(--sw-text-2); flex-wrap: wrap; }
  .wg-temp .tw-h b { color: var(--sw-text); font-size: var(--sw-fs-lg); }
  .wg-temp .tw-big { display: flex; align-items: center; gap: 12px; min-inline-size: 0; }
  .wg-temp .tw-big .v { font-size: var(--sw-fs-3xl); font-weight: var(--sw-fw-semibold); color: var(--tw); font-variant-numeric: tabular-nums; direction: ltr; }
  .wg-temp .tw-big .t { display: grid; gap: 2px; min-inline-size: 0; }
  .wg-temp .tw-big .t b { font-size: var(--sw-fs-lg); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .wg-temp .tw-big .t small { color: var(--sw-text-2); font-size: var(--sw-fs-state); }
  .wg-temp .dots { display: flex; flex-wrap: wrap; gap: 6px; }
  .wg-temp .dots i { inline-size: 12px; block-size: 12px; border-radius: 50%; background: var(--tw); display: inline-block; }
  .wg-temp .dots i[data-look='off'] { border-radius: 3px; } /* sensor offline: a square, not only a colour */
  .wg-temp .lst { display: grid; gap: 6px; }
  .tw-row { display: flex; align-items: center; gap: 8px; font-size: var(--sw-fs-base); color: inherit; text-decoration: none; min-inline-size: 0; border-radius: 10px; padding: 4px 6px; margin-inline: -2px; }
  /* POLISH-CONTROL-297: a row and a card are links - they answer hover (fine pointers only), the press and the keyboard with the product's
     focus ring (transform and colour only, token durations - zero under reduced motion) */
  .tw-row, .tw-card { transition: background-color var(--sw-t-fast) var(--sw-ease), border-color var(--sw-t-fast) var(--sw-ease), box-shadow var(--sw-t-fast) var(--sw-ease), transform var(--sw-t-fast) var(--sw-ease); }
  .tw-row:active { transform: scale(0.985); }
  .tw-card:active { transform: scale(0.98); }
  .tw-row:focus-visible, .tw-card:focus-visible { outline: var(--sw-focus-w) solid var(--sw-focus); outline-offset: 2px; }
  @media (hover: hover) and (pointer: fine) {
    .tw-row:hover { background: color-mix(in srgb, var(--sw-text) 6%, transparent); }
    .tw-card:hover { box-shadow: var(--sw-shadow-2); border-color: var(--sw-border-strong); border-inline-start-color: var(--tw); }
  }
  /* the state dot carries a soft halo of its colour (the KPI dots of the temperature screen) */
  .tw-row i { inline-size: 10px; block-size: 10px; border-radius: 50%; background: var(--tw); flex: none; box-shadow: 0 0 0 3px color-mix(in srgb, var(--tw) 18%, transparent); }
  .tw-row .nm { flex: 1; font-weight: 600; min-inline-size: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .tw-row .vv { font-variant-numeric: tabular-nums; direction: ltr; white-space: nowrap; }
  .tw-row small { color: var(--sw-text-2); font-size: var(--sw-fs-state); white-space: nowrap; }
  .tw-row[aria-disabled='true'], .tw-card[aria-disabled='true'] { pointer-events: none; }
  .wg-temp .none { color: var(--sw-text-2); font-size: var(--sw-fs-base); }
  .wg.wg-temp-cards { background: transparent; border: 0; box-shadow: none; backdrop-filter: none; -webkit-backdrop-filter: none; padding: 0; overflow: visible; }
  .tw-cards { display: flex; flex-wrap: wrap; gap: 10px; }
  .tw-card {
    display: grid; gap: 2px; padding: 10px 14px; border-radius: var(--sw-r-md, 20px); text-decoration: none; color: var(--sw-text); background: var(--sw-surface);
    border: 1px solid var(--sw-border); border-inline-start: 4px solid var(--tw); box-shadow: var(--sw-shadow-1); min-inline-size: 130px; flex: 1 1 130px; box-sizing: border-box;
  }
  .tw-card b { font-size: var(--sw-fs-md); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .tw-card .vv { font-size: var(--sw-fs-xl); font-weight: var(--sw-fw-semibold); color: var(--tw); font-variant-numeric: tabular-nums; direction: ltr; text-align: start; }
  .tw-card small { color: var(--sw-text-2); font-size: var(--sw-fs-state); }
  [data-size='s'] .tw-card { min-inline-size: 110px; padding: 8px 10px; }
`;

export interface TemperatureView {
  included: TempUnit[];
  items: TempUnit[];
  loudest: TempUnit | null;
  counts: { n: number; alarm: number; warning: number };
}

/** Pure: the units the widget shows (left-out ones removed; `alerts` keeps the units in an alert or with a sensor problem), loudest first. */
export function temperatureView(units: readonly TempUnit[], cfg: TemperatureCfg, stale: boolean): TemperatureView {
  const included = units.filter((u) => !cfg.hidden.includes(u.id));
  const st = (u: TempUnit): UnitStatus => (stale ? 'unknown' : u.status);
  const sorted = [...included].sort((a, b) => RANK[st(a)] - RANK[st(b)]);
  const alerting = (u: TempUnit) => ['alarm', 'warning', 'offline'].includes(st(u)) || (!stale && hasHealthIssue(u));
  const items = cfg.filter === 'alerts' ? sorted.filter(alerting) : sorted;
  return { included, items, loudest: sorted[0] ?? null,
    counts: { n: included.length, alarm: included.filter((u) => st(u) === 'alarm').length, warning: included.filter((u) => st(u) === 'warning').length } };
}

const lookOf = (u: TempUnit, stale: boolean): Look => LOOK_OF[stale ? 'unknown' : u.status];
const valueOf = (u: TempUnit, stale: boolean): string => `${fmt1(stale ? u.value_last : u.value ?? u.value_last)}°`;
const hrefOf = (u: TempUnit) => `${TEMPERATURE_HREF}?unit=${encodeURIComponent(u.id)}`;

function row(h: TemperatureWidgetHost, u: TempUnit): TemplateResult {
  return html`<a class="tw-row" href=${hrefOf(u)} data-look=${lookOf(u, h.stale)} data-home-temp=${u.id} aria-disabled=${String(h.editing)} tabindex=${h.editing ? -1 : 0}>
    <i aria-hidden="true"></i><span class="nm">${u.name}</span><span class="vv">${valueOf(u, h.stale)}</span><small>${tt(STATUS_KEY[h.stale ? 'unknown' : u.status])}</small></a>`;
}

function combined(h: TemperatureWidgetHost, it: WidgetItem, extra: Record<string, string> = {}): TemplateResult {
  const v = temperatureView(h.units, h.cfg, h.stale);
  if (!v.included.length || !v.loudest) return h.shell(it, 'wg-temp', extra, html`<div class="tw-h"><b>${it.title}</b></div><div class="none" data-home-temp-none>${tt('wAllHidden')}</div>`);
  const top = v.loudest;
  const summary = tt('wSummary', { n: v.counts.n, a: v.counts.alarm, w: v.counts.warning });
  const tone = lookOf(top, h.stale);
  const dots = html`<div class="dots" role="list" aria-label=${summary} data-home-temp-dots>${v.included.map((u) => html`<i role="listitem" data-look=${lookOf(u, h.stale)}
    title=${`${u.name}: ${valueOf(u, h.stale)}`} aria-label=${`${u.name}: ${valueOf(u, h.stale)} · ${tt(STATUS_KEY[h.stale ? 'unknown' : u.status])}`}></i>`)}</div>`;
  const big = html`<div class="tw-big" data-look=${tone}><span class="v">${valueOf(top, h.stale)}</span><div class="t"><b data-home-temp-top>${top.name}</b>
    <small>${tt(STATUS_KEY[h.stale ? 'unknown' : top.status])}${top.area_name ? ` · ${top.area_name}` : ''}</small></div></div>`;
  if (it.size === 's') return h.shell(it, 'wg-temp', { tone, ...extra }, html`${big}${dots}`);
  const listed = v.items.slice(0, ROWS[it.size]);
  const body = h.cfg.filter === 'alerts' && !v.items.length
    ? html`<div class="none" data-home-temp-none>${tt('wNoAlerts')}</div>`
    : html`<div class="lst" data-home-temp-list>${listed.map((u) => row(h, u))}</div>`;
  return h.shell(it, 'wg-temp', { tone, ...extra }, html`<div class="tw-h"><b>${it.title}</b><span data-home-temp-summary>${summary}</span></div>
    ${it.size === 'm' ? big : nothing}${body}${it.size === 'l' ? dots : nothing}`);
}

function cardsBody(h: TemperatureWidgetHost, it: WidgetItem): TemplateResult {
  const v = temperatureView(h.units, h.cfg, h.stale);
  if (!v.items.length) return html`<div class="tw-cards"><div class="tw-card"><span class="none">${h.cfg.filter === 'alerts' && v.included.length ? tt('wNoAlerts') : tt('wAllHidden')}</span></div></div>`;
  return html`<div class="tw-cards" role="list">${v.items.map((u) => html`<a class="tw-card" role="listitem" href=${hrefOf(u)} data-look=${lookOf(u, h.stale)} data-home-temp-card=${u.id}
    aria-disabled=${String(h.editing)} tabindex=${h.editing ? -1 : 0}><b>${u.name}</b><span class="vv">${valueOf(u, h.stale)}</span>
    ${it.size !== 's' ? html`<small>${tt(STATUS_KEY[h.stale ? 'unknown' : u.status])}</small>` : nothing}</a>`)}</div>`;
}

/** The widget for its mode: the combined card, the cards, or both (the combined card carries the edit bar; the cards follow it). */
export function renderTemperature(h: TemperatureWidgetHost, it: WidgetItem): TemplateResult {
  if (h.cfg.mode === 'cards') return h.shell(it, 'wg-temp-cards', { mode: 'cards' }, cardsBody(h, it));
  if (h.cfg.mode === 'both') {
    return html`${combined(h, it, { mode: 'both' })}<section class="wg wg-temp-cards" data-home-widget-part="temperature-cards" data-size=${it.size} aria-label=${it.title}>${cardsBody(h, it)}</section>`;
  }
  return combined(h, it, { mode: 'combined' });
}
