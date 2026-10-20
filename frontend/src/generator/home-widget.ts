import { css, html, nothing, svg, type TemplateResult } from 'lit';
import type { LiveSummaryItem } from '../api/generator';
import type { WidgetItem } from '../api/home-config';
import { GEN_HOME_HREF, STATE_KEY, SUPPLY_KEY, SUPPLY_LOOK, genHomeView, type GenHomeItem, type GenLook, type GenSupply } from './home-widget-model';
import { gwt } from '../i18n/generator-widget';

/**
 * GENWIDGET 2.9.3: the generator home widget, built like the elevators one (elevators/home-widget.ts): one card in the host's shell, drawn
 * only while the viewer sees at least one generator. At a glance: the site's supply line (on mains / on generator / no mains / unknown) with
 * the generator glyph in the supply colour, and the state chip of the generator (standby, running, starting, cooling, alert, fault, unknown).
 * With more than one generator: the summary in the head and one compact row per generator (name + state chip), the loudest first.
 * Sizes: small = the supply line and the chip (dots for several); medium = adds the rows (up to 4); large = every row with fuel / load.
 * Read-only: the supply block opens תשתיות › גנרטור, a row opens that generator. Clean operator card: no hints, no paragraphs.
 */
export interface GeneratorsWidgetHost {
  generators: readonly LiveSummaryItem[];
  editing: boolean;
  shell: (it: WidgetItem, cls: string, extra: Record<string, string>, body: TemplateResult) => TemplateResult;
}

const ROWS: Record<WidgetItem['size'], number> = { s: 0, m: 4, l: 12 };
// the generator screen's power-flow glyphs (gen-flow.ts ICON), drawn here in the supply colour
const ENGINE = 'M3 10h3l2-3h6l2 3h5v7h-5l-2 3H8l-2-3H3zM9 13h6';
const GRID = 'M12 2v20M5 22l7-20 7 20M7 10h10M5 16h14';

export const GENERATOR_WIDGET_STYLES = css`
  :host {
    --sw-gw-ok: #15803d;
    --sw-gw-run: #1d4ed8;
    --sw-gw-trans: #0e7490;
    --sw-gw-warn: #c2410c;
    --sw-gw-fault: #c81e1e;
    --sw-gw-unk: #667085;
  }
  .wg-gen [data-look='ok'], .gw-chip[data-look='ok'] { --gw-c: var(--sw-gw-ok); }
  .wg-gen [data-look='run'], .gw-chip[data-look='run'] { --gw-c: var(--sw-gw-run); }
  .wg-gen [data-look='trans'], .gw-chip[data-look='trans'] { --gw-c: var(--sw-gw-trans); }
  .wg-gen [data-look='warn'], .gw-chip[data-look='warn'] { --gw-c: var(--sw-gw-warn); }
  .wg-gen [data-look='fault'], .gw-chip[data-look='fault'] { --gw-c: var(--sw-gw-fault); }
  .wg-gen [data-look='unk'], .gw-chip[data-look='unk'] { --gw-c: var(--sw-gw-unk); }
  .wg-gen { gap: 8px; }
  .wg-gen .gw-h { display: flex; align-items: center; gap: 8px; font-size: var(--sw-fs-base); color: var(--sw-text-2); }
  .wg-gen .gw-h b { color: var(--sw-text); font-size: var(--sw-fs-lg); }
  .wg-gen .gw-big { display: flex; align-items: center; gap: 12px; min-inline-size: 0; color: inherit; text-decoration: none; border-radius: 12px; }
  .wg-gen .gw-big:focus-visible, .gw-row:focus-visible { outline: 2px solid var(--sw-accent); outline-offset: 2px; }
  .wg-gen .gw-big .t { display: grid; gap: 4px; min-inline-size: 0; justify-items: start; }
  .wg-gen .gw-big .t b { font-size: var(--sw-fs-lg); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; max-inline-size: 100%; }
  .wg-gen .gw-big .t small { color: var(--sw-text-2); font-size: var(--sw-fs-state); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; max-inline-size: 100%; }
  .gw-ic {
    --gi: 40px;
    inline-size: var(--gi); block-size: var(--gi); flex: none; border-radius: 30%; display: grid; place-items: center; box-sizing: border-box;
    color: var(--gw-c); background: color-mix(in srgb, var(--gw-c) 14%, transparent); border: 1.5px solid color-mix(in srgb, var(--gw-c) 55%, transparent);
  }
  .gw-ic svg { inline-size: 62%; block-size: 62%; fill: none; stroke: currentColor; stroke-width: 1.8; stroke-linecap: round; stroke-linejoin: round; }
  .gw-chip {
    display: inline-flex; align-items: center; border-radius: 999px; padding: 2px 9px; background: var(--gw-c); color: #fff;
    font-size: var(--sw-fs-state); font-weight: 600; white-space: nowrap; line-height: 1.4;
  }
  .wg-gen .dots { display: flex; flex-wrap: wrap; gap: 6px; }
  .wg-gen .dots i { inline-size: 12px; block-size: 12px; border-radius: 50%; background: var(--gw-c); display: inline-block; }
  .wg-gen .lst { display: grid; gap: 6px; }
  .gw-row {
    display: flex; align-items: center; gap: 8px; font-size: var(--sw-fs-base); color: inherit; text-decoration: none; min-inline-size: 0;
    border-radius: 10px; padding: 2px 4px;
  }
  .gw-row .dot { inline-size: 10px; block-size: 10px; border-radius: 50%; background: var(--gw-c); flex: none; }
  .gw-row .nm { flex: 1; font-weight: 600; min-inline-size: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .gw-row small { color: var(--sw-text-2); font-size: var(--sw-fs-state); white-space: nowrap; }
  .gw-row[aria-disabled='true'], .wg-gen .gw-big[aria-disabled='true'] { pointer-events: none; }
  @media (prefers-reduced-motion: no-preference) {
    .wg-gen .gw-ic[data-look='run'] svg { animation: gw-hum 2.4s ease-in-out infinite; }
  }
  @keyframes gw-hum { 50% { opacity: 0.6; } }
`;

function glyph(supply: GenSupply, size: number): TemplateResult {
  const look: GenLook = SUPPLY_LOOK[supply];
  return html`<span class="gw-ic" data-look=${look} style=${`--gi:${size}px`} aria-hidden="true"><svg viewBox="0 0 24 24">${svg`<path d=${supply === 'mains' ? GRID : ENGINE}></path>`}</svg></span>`;
}

const chip = (x: GenHomeItem): TemplateResult => html`<span class="gw-chip" data-look=${x.look} data-home-generator-chip=${x.state}>${gwt(STATE_KEY[x.state])}</span>`;

function extraOf(x: GenHomeItem): string {
  if (x.fuel !== null) return gwt('fuel', { n: Math.round(x.fuel) });
  if (x.load !== null && x.engine === 'running') return gwt('load', { n: Math.round(x.load) });
  return '';
}

function row(h: GeneratorsWidgetHost, x: GenHomeItem, withExtra: boolean): TemplateResult {
  const extra = withExtra ? extraOf(x) : '';
  return html`<a class="gw-row" href=${x.href} data-home-generator=${x.id} data-generator-state=${x.state} data-look=${x.look} aria-disabled=${String(h.editing)} tabindex=${h.editing ? -1 : 0}>
    <span class="dot" aria-hidden="true"></span><span class="nm">${x.name}</span>${chip(x)}${extra ? html`<small>${extra}</small>` : nothing}</a>`;
}

/** The widget: the supply block (the glyph, the supply line, the chip of the only / loudest generator), then the rows when there are several. */
export function renderGenerators(h: GeneratorsWidgetHost, it: WidgetItem): TemplateResult {
  const v = genHomeView(h.generators);
  const top = v.loudest;
  if (!top) return html``; // never reached: the widget is not resolved without a generator
  const multi = v.total > 1;
  const supplyText = gwt(SUPPLY_KEY[v.supply]);
  const parts = [gwt('summary', { n: v.total })];
  if (v.running) parts.push(gwt('summaryRunning', { n: v.running }));
  if (v.faults) parts.push(gwt('summaryFault', { n: v.faults }));
  const summary = parts.join(' · ');
  const href = multi ? GEN_HOME_HREF : top.href;
  const icon = it.size === 's' ? 34 : it.size === 'm' ? 40 : 46;
  const sub = multi ? (it.size === 's' ? summary : '') : it.size === 'l' ? extraOf(top) : '';
  const big = html`<a class="gw-big" href=${href} data-home-generators-supply=${v.supply} data-supply-inferred=${String(v.supplyInferred)} aria-disabled=${String(h.editing)} tabindex=${h.editing ? -1 : 0}>
    ${glyph(v.supply, icon)}<span class="t"><b data-home-generators-line>${supplyText}</b>${multi && it.size !== 's' ? nothing : html`<span>${chip(top)}</span>`}${sub ? html`<small>${sub}</small>` : nothing}</span></a>`;
  const extra = { tone: top.look };
  if (!multi) {
    return h.shell(it, 'wg-gen', extra, html`${it.size === 's' ? nothing : html`<div class="gw-h"><b>${it.title}</b><span>${top.name}</span></div>`}${big}`);
  }
  const dots = html`<div class="dots" role="list" aria-label=${summary} data-home-generator-dots>${v.items.map((x) => html`<i role="listitem" data-look=${x.look} title=${`${x.name}: ${gwt(STATE_KEY[x.state])}`} aria-label=${`${x.name}: ${gwt(STATE_KEY[x.state])}`}></i>`)}</div>`;
  if (it.size === 's') return h.shell(it, 'wg-gen', extra, html`${big}${dots}`);
  const listed = v.items.slice(0, ROWS[it.size]);
  return h.shell(it, 'wg-gen', extra, html`<div class="gw-h"><b>${it.title}</b><span data-home-generators-summary>${summary}</span></div>${big}
    <div class="lst" data-home-generator-list>${listed.map((x) => row(h, x, it.size === 'l'))}</div>`);
}
