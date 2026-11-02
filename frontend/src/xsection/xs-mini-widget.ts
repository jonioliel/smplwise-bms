import { css, html, nothing, type TemplateResult } from 'lit';
import type { WidgetItem } from '../api/home-config';
import { xi } from './xs-icons';
import { miniFloorLabel, type MiniFloor, type MiniModel } from './xs-mini-model';

/**
 * XS-MINI-WIDGET-2351: the home widget "חתך בניין" - the building drawn as a stack of slabs, top floor first, each slab tinted by the share
 * of its lights that are on (the cross-section's warm `--sw-lit`), with the cross-section's small markers beside it: an alarm (an area of the
 * floor in a triggered alarm), the demo fire alarm (only with the fire UI option on), hot / cold, open doors. A press on a slab opens the
 * floor (`onFloor`); a press on its lights count chip opens the floor lights popup (`onLights`, 2.33.1) - two sibling buttons, never one
 * inside the other. Read-only otherwise; in edit mode nothing is pressable. Sizes: small = slabs and markers only; medium = + the lights
 * chip per floor; large = + the floor name. The row band halves nothing: the cap per size (MINI_CAP) already keeps it no taller than its
 * neighbours. A state is never colour alone: every marker pairs an icon with a word in its accessible name.
 */

export interface MiniWidgetHost {
  model: MiniModel | null;
  editing: boolean;
  /** The multi-building view is on: the head names the building drawn. */
  multi: boolean;
  /** The row band (one compact strip). */
  compact?: boolean;
  /** May the viewer open a floor's lights popup (devices.read; the demo shows its own rows)? */
  lightsOk: (f: MiniFloor) => boolean;
  onFloor: (id: string) => void;
  onLights: (id: string) => void;
  onAll: () => void;
  shell: (it: WidgetItem, cls: string, extra: Record<string, string>, body: TemplateResult) => TemplateResult;
}

export const XS_MINI_WIDGET_STYLES = css`
  .wg-xs { gap: 8px; justify-content: flex-start; }
  .wg-xs .wg-h { min-inline-size: 0; }
  .wg-xs .wg-h > span { flex: 1; min-inline-size: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .wg-xs .xm-go {
    display: inline-flex; align-items: center; flex: none; min-block-size: 44px; margin-block: -14px; padding: 0 4px; border: 0; background: none;
    border-radius: var(--sw-r-sm); color: var(--sw-accent-text, var(--sw-accent)); font: inherit; font-size: var(--sw-fs-sm); font-weight: var(--sw-fw-semibold);
    letter-spacing: 0; cursor: pointer; touch-action: manipulation; -webkit-tap-highlight-color: transparent; user-select: none;
  }
  .wg-xs .xm-go:disabled { cursor: default; opacity: 0.55; }
  .wg-xs .xm-go:focus-visible { outline: var(--sw-focus-w, 2px) solid var(--sw-focus, var(--sw-accent)); outline-offset: -6px; }
  @media (hover: hover) and (pointer: fine) {
    .wg-xs .xm-go:not(:disabled):hover { text-decoration: underline; text-underline-offset: 3px; }
  }
  .wg-xs .xm-sum { display: flex; align-items: center; gap: 10px; min-inline-size: 0; font-size: var(--sw-fs-xs); color: var(--sw-text-3); white-space: nowrap; }
  .wg-xs .xm-sum b { color: var(--sw-text); font-weight: var(--sw-fw-bold); direction: ltr; unicode-bidi: isolate; font-variant-numeric: tabular-nums; }
  .wg-xs .xm-sum .al { color: var(--sw-danger-text, var(--sw-danger)); font-weight: var(--sw-fw-semibold); }
  .wg-xs .xm-sum .xi, .wg-xs .xm-mk .xi, .wg-xs .xm-lc .xi { inline-size: 12px; block-size: 12px; flex: none; }
  /* the building: a roof line, the slabs, a ground line between the floors above and below ground */
  .wg-xs .xm-b { --xr: 18px; display: flex; flex-direction: column; gap: 3px; min-inline-size: 0; padding-block-start: 4px; border-block-start: 2px solid var(--sw-border-strong); }
  .wg-xs[data-size='s'] .xm-b { --xr: 14px; gap: 2px; }
  .wg-xs[data-size='l'] .xm-b { --xr: 20px; }
  .wg-xs.xm-compact .xm-b { --xr: 14px; gap: 2px; }
  @media (pointer: coarse) {
    .wg-xs .xm-b, .wg-xs[data-size='s'] .xm-b, .wg-xs.xm-compact .xm-b { --xr: 24px; }
  }
  .wg-xs .xm-r { display: grid; grid-template-columns: 22px minmax(0, 1fr) auto auto; align-items: center; gap: 6px; block-size: var(--xr); min-inline-size: 0; }
  .wg-xs .xm-mark { font-size: var(--sw-fs-2xs); font-weight: var(--sw-fw-bold); color: var(--sw-text-3); text-align: center; font-variant-numeric: tabular-nums; direction: ltr; unicode-bidi: isolate; }
  .wg-xs .xm-slab {
    position: relative; display: flex; align-items: center; gap: 6px; block-size: 100%; min-inline-size: 0; box-sizing: border-box; padding: 0 8px; border: 0;
    border-radius: var(--sw-r-sm); background: var(--sw-surface-2); color: var(--sw-text-2); font: inherit; font-size: var(--sw-fs-2xs); text-align: start; cursor: pointer;
    touch-action: manipulation; -webkit-tap-highlight-color: transparent; user-select: none;
  }
  .wg-xs .xm-slab:disabled { cursor: default; }
  .wg-xs .xm-slab .nm { min-inline-size: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .wg-xs .xm-slab[data-tint='1'] { background: color-mix(in srgb, var(--sw-lit) 24%, var(--sw-surface-2)); color: var(--sw-text); }
  .wg-xs .xm-slab[data-tint='2'] { background: color-mix(in srgb, var(--sw-lit) 50%, var(--sw-surface-2)); color: var(--sw-text); }
  .wg-xs .xm-slab[data-tint='3'] { background: color-mix(in srgb, var(--sw-lit) 80%, var(--sw-surface-2)); color: var(--sw-text); }
  .wg-xs .xm-r.below .xm-slab[data-tint='0'] { background: color-mix(in srgb, var(--sw-surface-2) 70%, var(--sw-surface-3)); }
  /* no data: an outline, no fill - said in words in the name */
  .wg-xs .xm-slab[data-off] { background: transparent; box-shadow: inset 0 0 0 1px var(--sw-border-strong); color: var(--sw-text-3); }
  .wg-xs .xm-r[data-alarm] .xm-slab { box-shadow: inset 0 0 0 2px var(--sw-danger); }
  .wg-xs .xm-slab:focus-visible, .wg-xs .xm-lc:focus-visible { outline: var(--sw-focus-w, 2px) solid var(--sw-focus, var(--sw-accent)); outline-offset: 1px; }
  .wg-xs .xm-gnd { block-size: 2px; margin-block: 1px; margin-inline: 28px 0; border-radius: 2px; background: var(--sw-border-strong); }
  .wg-xs .xm-mks { display: inline-flex; align-items: center; gap: 4px; min-inline-size: 0; }
  .wg-xs .xm-mk { display: inline-flex; align-items: center; gap: 2px; font-size: var(--sw-fs-2xs); font-weight: var(--sw-fw-semibold); color: var(--sw-text-2); white-space: nowrap; font-variant-numeric: tabular-nums; }
  .wg-xs .xm-mk.al { color: var(--sw-danger-text, var(--sw-danger)); }
  .wg-xs .xm-mk.hot { color: color-mix(in srgb, var(--sw-heat) 70%, var(--sw-text)); }
  .wg-xs .xm-mk.cold { color: color-mix(in srgb, var(--sw-cool) 70%, var(--sw-text)); }
  .wg-xs .xm-lc {
    display: inline-flex; align-items: center; gap: 3px; block-size: 100%; max-block-size: 22px; padding: 0 7px; border: 0; border-radius: var(--sw-r-pill, 999px);
    background: var(--sw-surface-2); color: var(--sw-text-2); font: inherit; font-size: var(--sw-fs-2xs); white-space: nowrap; font-variant-numeric: tabular-nums;
  }
  .wg-xs .xm-lc b { color: var(--sw-text); font-weight: var(--sw-fw-bold); direction: ltr; unicode-bidi: isolate; }
  .wg-xs .xm-lc.warm { background: color-mix(in srgb, var(--sw-lit) 26%, var(--sw-surface)); }
  .wg-xs button.xm-lc { cursor: pointer; touch-action: manipulation; -webkit-tap-highlight-color: transparent; user-select: none; }
  @media (pointer: coarse) {
    .wg-xs .xm-lc { max-block-size: none; }
  }
  .wg-xs .xm-more { font-size: var(--sw-fs-2xs); color: var(--sw-text-3); padding-inline-start: 28px; }
  .wg-xs .xm-empty { font-size: var(--sw-fs-sm); color: var(--sw-text-3); }
  @media (prefers-reduced-motion: no-preference) {
    .wg-xs .xm-slab, .wg-xs .xm-lc { transition: background-color var(--sw-t-state, 200ms) var(--sw-ease, ease), transform var(--sw-t-press, 100ms) var(--sw-ease, ease); }
    .wg-xs .xm-slab:not(:disabled):active, .wg-xs button.xm-lc:active { transform: scale(var(--sw-press-scale, 0.98)); }
  }
  @media (hover: hover) and (pointer: fine) {
    .wg-xs .xm-slab:not(:disabled):hover { filter: brightness(0.97); }
  }
`;

function markers(f: MiniFloor, show: MiniModel['show']): TemplateResult {
  const out: TemplateResult[] = [];
  if (f.fire) out.push(html`<span class="xm-mk al" data-xs-mini-fire title="אזעקת אש (נתוני דמה)">${xi('flame')}</span>`);
  if (f.alarm) out.push(html`<span class="xm-mk al" data-xs-mini-alarm title="אזעקה">${xi('bell')}</span>`);
  if (!f.nodata && show.temp && f.temp) out.push(html`<span class="xm-mk ${f.temp}" title=${f.temp === 'hot' ? 'חם' : 'קר'}>${xi(f.temp === 'hot' ? 'flame' : 'snow')}</span>`);
  if (!f.nodata && show.doors && f.doorsOpen) out.push(html`<span class="xm-mk" data-xs-mini-doors title="דלתות פתוחות">${xi('door')}${f.doorsOpen}</span>`);
  return html`<span class="xm-mks" aria-hidden="true">${out}</span>`;
}

function lightsChip(h: MiniWidgetHost, f: MiniFloor, it: WidgetItem): TemplateResult | typeof nothing {
  if (it.size === 's' || h.compact || !h.model?.show.light || f.nodata || f.lit === null || f.lights === null) return html`<span></span>`;
  const inner = html`${xi('light')}<b>${f.lit}/${f.lights}</b>`;
  const cls = `xm-lc ${f.lit ? 'warm' : ''}`;
  if (!h.lightsOk(f)) return html`<span class=${cls} aria-hidden="true">${inner}</span>`;
  return html`<button type="button" class=${cls} data-xs-mini-lights=${f.id} ?disabled=${h.editing} aria-label=${`תאורה ב${f.name}: ${f.lit} מתוך ${f.lights} דולקות`}
    @click=${() => h.onLights(f.id)}>${inner}</button>`;
}

/** The widget. Never reached unless the host resolved the widget as available (devices.read and a building with floors). */
export function renderXsMini(h: XsMiniArgs, it: WidgetItem): TemplateResult {
  const m = h.model;
  const head = html`<div class="wg-h">${xi('section')}<span>${it.title}</span>${h.multi && m ? html`<small data-xs-mini-building><bdi>${m.buildingName}</bdi></small>` : nothing}
    <button type="button" class="xm-go" data-xs-mini-all ?disabled=${h.editing} @click=${h.onAll}>כל הקומות</button></div>`;
  if (!m || !m.floors.length) return h.shell(it, 'wg-xs', {}, html`${head}<div class="xm-empty">אין מידע מהקומות</div>`);
  const t = m.totals;
  const sum = it.size === 's'
    ? nothing
    : html`<div class="xm-sum" data-xs-mini-sum>${m.show.light && t.litKnown ? html`<span>${xi('light')} <b>${t.lit}/${t.lights}</b> דולקות</span>` : nothing}${t.alarms ? html`<span class="al">${xi('bell')} ${t.alarms === 1 ? 'קומה באזעקה' : `${t.alarms} קומות באזעקה`}</span>` : nothing}${m.show.doors && t.doorsOpen ? html`<span>${xi('door')} <b>${t.doorsOpen}</b> פתוחות</span>` : nothing}</div>`;
  const rows: TemplateResult[] = [];
  let ground = false;
  for (const f of m.floors) {
    if (m.hasBelow && f.level < 0 && !ground) {
      ground = true;
      rows.push(html`<i class="xm-gnd" aria-hidden="true"></i>`);
    }
    const label = miniFloorLabel(f, m.show);
    rows.push(html`<div class="xm-r ${f.level < 0 ? 'below' : ''}" data-xs-mini-floor=${f.id} ?data-alarm=${f.alarm || f.fire}>
      <span class="xm-mark" aria-hidden="true">${f.mark}</span>
      <button type="button" class="xm-slab" data-tint=${m.show.light ? f.tint : 0} ?data-off=${f.nodata} ?disabled=${h.editing} aria-label=${`פתיחת ${label}`} title=${label}
        @click=${() => h.onFloor(f.id)}>${it.size === 'l' && !h.compact ? html`<span class="nm" dir="auto">${f.name}</span>` : nothing}</button>
      ${markers(f, m.show)}${lightsChip(h, f, it)}
    </div>`);
  }
  const more = m.more ? html`<div class="xm-more" data-xs-mini-more>+${m.more} קומות</div>` : nothing;
  return h.shell(it, `wg-xs${h.compact ? ' xm-compact' : ''}`, {}, html`${head}${sum}<div class="xm-b" role="group" aria-label=${`חתך ${m.buildingName}: ${m.floors.length + m.more} קומות`}>${rows}</div>${more}`);
}

export type XsMiniArgs = MiniWidgetHost;
