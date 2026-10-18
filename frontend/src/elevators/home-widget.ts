import { css, html, nothing, type TemplateResult } from 'lit';
import type { Elevator } from '../api/elevators';
import type { ElevatorsCfg, WidgetItem } from '../api/home-config';
import { ELEVATORS_HREF, agoText, summaryLine, widgetView, type ShownElevator } from './model';
import { doorIcon, elevatorCss, stateBadge } from './styles';
import { elt } from '../i18n/elevators';

/**
 * CR-INFRA-ELEVATORS 2.8.0: the elevators home widget (decision 10b, owner feedback 2026-10-18). The owner chooses HOW (`mode`): ONE combined card
 * for all elevators, one card per elevator, or both; WHICH (`hidden`), and whether only the alerting states are listed (`filter`). Place and size
 * come from the home edit mode like every widget: small = the combined summary (the loudest elevator, the counts and a dot per elevator),
 * medium = the summary and the first rows, large = every row with how long ago its state began. Read-only: a tap opens תשתיות › מעליות.
 * No direction is ever shown. Drawn by `home-widgets` through `renderElevators` (the host's own card shell and edit bar).
 */
export interface ElevatorsWidgetHost {
  cfg: ElevatorsCfg;
  elevators: readonly Elevator[];
  stale: boolean;
  editing: boolean;
  now: Date;
  shell: (it: WidgetItem, cls: string, extra: Record<string, string>, body: TemplateResult) => TemplateResult;
}

const ROWS: Record<WidgetItem['size'], number> = { s: 0, m: 4, l: 12 };

export const ELEVATOR_WIDGET_STYLES = [elevatorCss, css`
  .wg-elev { gap: 8px; }
  .wg-elev .el-h { display: flex; align-items: center; gap: 8px; font-size: var(--sw-fs-base); color: var(--sw-text-2); }
  .wg-elev .el-h b { color: var(--sw-text); font-size: var(--sw-fs-lg); }
  .wg-elev .el-big { display: flex; align-items: center; gap: 12px; min-inline-size: 0; }
  .wg-elev .el-big .t { display: grid; gap: 2px; min-inline-size: 0; }
  .wg-elev .el-big .t b { font-size: var(--sw-fs-lg); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .wg-elev .el-big .t small { color: var(--sw-text-2); font-size: var(--sw-fs-state); }
  .wg-elev .dots { display: flex; flex-wrap: wrap; gap: 6px; }
  .wg-elev .dots i { inline-size: 12px; block-size: 12px; border-radius: 50%; background: var(--el-c); display: inline-block; }
  .wg-elev .dots i[data-look='off'] { border-radius: 3px; } /* out of service: a square, not only a colour */
  .wg-elev .lst { display: grid; gap: 6px; }
  .el-row {
    display: flex; align-items: center; gap: 8px; font-size: var(--sw-fs-base); color: inherit; text-decoration: none; min-inline-size: 0;
    border-radius: 10px; padding: 2px 4px;
  }
  .el-row:focus-visible, .el-card:focus-visible { outline: 2px solid var(--sw-accent); outline-offset: 2px; }
  .el-row .nm { flex: 1; font-weight: 600; min-inline-size: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .el-row small { color: var(--sw-text-2); font-size: var(--sw-fs-state); white-space: nowrap; }
  .el-row[aria-disabled='true'], .el-card[aria-disabled='true'] { pointer-events: none; }
  .wg-elev .none { color: var(--sw-text-2); font-size: var(--sw-fs-base); }
  /* one card per elevator: the section is a transparent row of small cards */
  .wg.wg-elev-cards { background: transparent; border: 0; box-shadow: none; backdrop-filter: none; -webkit-backdrop-filter: none; padding: 0; overflow: visible; }
  .el-cards { display: flex; flex-wrap: wrap; gap: 10px; }
  .el-card {
    display: flex; align-items: center; gap: 10px; padding: 10px 14px; border-radius: var(--sw-r-md, 20px); text-decoration: none; color: var(--sw-text);
    background: var(--sw-surface); border: 1px solid var(--sw-border); box-shadow: var(--sw-shadow-1); min-inline-size: 150px; flex: 1 1 150px; box-sizing: border-box;
  }
  .el-card[data-look='fire'] { border-color: color-mix(in srgb, var(--sw-el-fire) 55%, transparent); background: linear-gradient(160deg, color-mix(in srgb, var(--sw-el-fire) 14%, transparent), var(--sw-surface)); }
  .el-card[data-look='fault'] { border-color: color-mix(in srgb, var(--sw-el-fault) 50%, transparent); }
  .el-card[data-look='off'] { border-color: var(--sw-el-off); border-inline-start-width: 4px; }
  .el-card .t { display: grid; gap: 4px; min-inline-size: 0; }
  .el-card .t b { font-size: var(--sw-fs-md); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .el-card small { color: var(--sw-text-2); font-size: var(--sw-fs-state); }
  [data-size='s'] .el-card { min-inline-size: 120px; padding: 8px 10px; }
  [data-size='l'] .el-card { flex-basis: 220px; }
`];

function row(h: ElevatorsWidgetHost, x: ShownElevator, withAgo: boolean): TemplateResult {
  const ago = withAgo && x.chip.state !== 'unknown' ? agoText(x.e.since, h.now) : '';
  return html`<a class="el-row" href=${ELEVATORS_HREF} data-home-elevator=${x.e.id} data-elevator-state=${x.chip.state} aria-disabled=${String(h.editing)} tabindex=${h.editing ? -1 : 0}>
    ${doorIcon(x.chip, 18)}<span class="nm">${x.e.name}</span>${stateBadge(x.chip, true)}${ago ? html`<small>${ago}</small>` : nothing}</a>`;
}

function combined(h: ElevatorsWidgetHost, it: WidgetItem, extra: Record<string, string> = {}): TemplateResult {
  const v = widgetView(h.elevators, h.cfg, h.stale);
  if (!v.included.length) return h.shell(it, 'wg-elev', extra, html`<div class="el-h"><b>${it.title}</b></div><div class="none" data-home-elevators-none>${elt('allHidden')}</div>`);
  const top = v.loudest!;
  const summary = summaryLine(v.kpis);
  const dots = html`<div class="dots" role="list" aria-label=${summary} data-home-elevator-dots>${v.included.map((x) => html`<i role="listitem" data-look=${x.chip.look} title=${`${x.e.name}: ${x.chip.label}`} aria-label=${`${x.e.name}: ${x.chip.label}`}></i>`)}</div>`;
  if (it.size === 's') {
    return h.shell(it, 'wg-elev', { tone: top.chip.look, ...extra }, html`<div class="el-big">${doorIcon(top.chip, 30)}<div class="t"><b data-home-elevators-top>${top.e.name}: ${top.chip.label}</b><small>${summary}</small></div></div>${dots}`);
  }
  const listed = v.items.slice(0, ROWS[it.size]);
  const body = h.cfg.filter === 'alerts' && !v.items.length
    ? html`<div class="none" data-home-elevators-none>${elt('noAlerts')}</div>`
    : html`<div class="lst" data-home-elevator-list>${listed.map((x) => row(h, x, it.size === 'l'))}</div>`;
  return h.shell(it, 'wg-elev', { tone: top.chip.look, ...extra }, html`<div class="el-h"><b>${it.title}</b><span data-home-elevators-summary>${summary}</span></div>
    ${it.size === 'm' ? html`<div class="el-big">${doorIcon(top.chip, 34)}<div class="t"><b data-home-elevators-top>${top.e.name}: ${top.chip.label}</b>${top.chip.state !== 'unknown' && top.e.since ? html`<small>${agoText(top.e.since, h.now)}</small>` : nothing}</div></div>` : nothing}
    ${body}${it.size === 'l' ? dots : nothing}`);
}

function cardsBody(h: ElevatorsWidgetHost, it: WidgetItem): TemplateResult {
  const v = widgetView(h.elevators, h.cfg, h.stale);
  const icon = it.size === 's' ? 26 : it.size === 'm' ? 34 : 44;
  if (!v.items.length) return html`<div class="el-cards"><div class="el-card"><span class="none">${h.cfg.filter === 'alerts' && v.included.length ? elt('noAlerts') : elt('allHidden')}</span></div></div>`;
  return html`<div class="el-cards" role="list">${v.items.map((x) => html`<a class="el-card" role="listitem" href=${ELEVATORS_HREF} data-look=${x.chip.look} data-home-elevator-card=${x.e.id} data-elevator-state=${x.chip.state} aria-disabled=${String(h.editing)} tabindex=${h.editing ? -1 : 0}>
    ${doorIcon(x.chip, icon)}<span class="t"><b>${x.e.name}</b>${stateBadge(x.chip, true)}${it.size === 'l' && x.chip.state !== 'unknown' && x.e.since ? html`<small>${agoText(x.e.since, h.now)}</small>` : nothing}</span></a>`)}</div>`;
}

/** The widget for its mode: the combined card, the cards, or both (the combined card carries the edit bar; the cards follow it). */
export function renderElevators(h: ElevatorsWidgetHost, it: WidgetItem): TemplateResult {
  if (h.cfg.mode === 'cards') return h.shell(it, 'wg-elev-cards', { mode: 'cards' }, cardsBody(h, it));
  if (h.cfg.mode === 'both') {
    return html`${combined(h, it, { mode: 'both' })}<section class="wg wg-elev-cards" data-home-widget-part="elevators-cards" data-size=${it.size} aria-label=${it.title}>${cardsBody(h, it)}</section>`;
  }
  return combined(h, it, { mode: 'combined' });
}
