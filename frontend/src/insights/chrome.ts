import { html, nothing, type TemplateResult } from 'lit';
import '../components/sw-tabs';
import type { TabItem } from '../components/sw-tabs';
import { ix } from '../i18n/insights';
import { insightsStatus } from './access';

export type InsightPage = 'building' | 'doors' | 'waste';
const HREF: Record<InsightPage, string> = { building: '#/tickets/reports/building', doors: '#/tickets/reports/doors', waste: '#/tickets/reports/waste' };

/** The pages of the section the viewer may open now (their switch is on): drawn like the other screens' page rows (sw-tabs, compact underline). */
export function pageItems(): TabItem[] {
  const s = insightsStatus();
  const out: TabItem[] = [];
  if (s.report) out.push({ id: 'building', label: ix('pageBuilding'), href: HREF.building });
  if (s.doors) out.push({ id: 'doors', label: ix('tabDoors'), href: HREF.doors });
  if (s.waste) out.push({ id: 'waste', label: ix('tabWaste'), href: HREF.waste });
  return out;
}

/** Crumbs, h1, subtitle and the page row - the head every temperature / schedules screen draws. */
export function pageHead(page: InsightPage, title: string, sub: string, actions: TemplateResult | typeof nothing = nothing): TemplateResult {
  const items = pageItems();
  return html`<div class="head"><div><div class="crumbs"><a href="#/tickets/reports/building">${ix('crumbArea')}</a> › <a href="${HREF.building}">${ix('crumbSection')}</a></div>
      <h1 data-insight-title>${title}</h1>${sub ? html`<p class="sub">${sub}</p>` : nothing}</div>${actions}</div>
    ${items.length > 1 ? html`<sw-tabs class="pages" variant="underline-compact" .items=${items} .active=${page} data-insight-pages></sw-tabs>` : nothing}`;
}

/** A KPI tile of the temperature screen's row; `pressed` makes it a filter. */
export function kpi(value: string, label: string, look: 'ok' | 'bad' | 'warn' | 'unk' | '' = '', opts: { unit?: string; note?: string; noteTone?: string; pressed?: boolean; onClick?: () => void; key?: string } = {}): TemplateResult {
  const inner = html`<span class="dot"></span><div><b>${value}${opts.unit ? html` <small>${opts.unit}</small>` : nothing}</b><span class="l">${label}</span>${opts.note ? html` <span class="d ${opts.noteTone ?? 'muted'}">${opts.note}</span>` : nothing}</div>`;
  return opts.onClick
    ? html`<button class="kpi" data-look=${look} data-kpi=${opts.key ?? ''} aria-pressed=${opts.pressed ? 'true' : 'false'} @click=${opts.onClick}>${inner}</button>`
    : html`<div class="kpi" data-look=${look} data-kpi=${opts.key ?? ''}>${inner}</div>`;
}
