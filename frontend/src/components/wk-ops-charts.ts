import { LitElement, html, css, svg, nothing, type TemplateResult } from 'lit';
import { customElement, property, state } from 'lit/decorators.js';
import type { TrendPoint } from '../api/intercom-ops';
import { T, barPath, compact, dayLabel, linePath, nearest, niceMax, stackBars, ticks, trendPoints } from '../screens/intercom-ops-logic';

/**
 * WISKEY-OPS-VIEWS-2400: the two charts of Settings › תפעול האינטרקום (the data-viz method; the reasoning and the validated palette are in
 * screens/intercom-ops-logic.ts). Inline SVG, tokens only besides the two validated series hues (light-dark()), the hover / focus
 * tooltip on every mark, a numbers table behind a toggle (and always for screen readers), the marks never mirrored by RTL (only the time
 * axis runs the way the page reads). Width follows the host (ResizeObserver), so the drawing is the same at a given width every time.
 */

const shared = css`
  :host {
    display: block;
    position: relative;
    min-inline-size: 0;
    contain: inline-size;
    /* two categorical slots, validated (light #2a78d6 / #eb6834, dark #3987e5 / #d95926) */
    --c-s1: light-dark(#2a78d6, #3987e5);
    --c-s2: light-dark(#eb6834, #d95926);
    --c-text: var(--sw-text-3);
    --c-grid: var(--sw-border);
    --c-surface: var(--sw-surface);
    --c-tip-bg: var(--sw-toast-bg);
    --c-tip-text: var(--sw-toast-text);
  }
  svg {
    inline-size: 100%;
    display: block;
    overflow: visible;
    /* the geometry is drawn in absolute x (axis at the right, time running right to left); text anchors must not flip with RTL */
    direction: ltr;
  }
  text {
    fill: var(--c-text);
    font-size: var(--sw-fs-xs);
    font-family: inherit;
  }
  text.v {
    fill: var(--sw-text-2);
    font-weight: var(--sw-fw-medium);
    font-variant-numeric: tabular-nums;
  }
  .grid {
    stroke: var(--c-grid);
    stroke-width: 1;
    shape-rendering: crispEdges;
  }
  .hit {
    fill: transparent;
  }
  g.band:focus {
    outline: none;
  }
  g.band:focus-visible .hit {
    fill: color-mix(in srgb, var(--sw-focus) 12%, transparent);
  }
  g.band.hot .hit {
    fill: color-mix(in srgb, var(--sw-text) 5%, transparent);
  }
  .tip {
    position: absolute;
    inset-block-start: 0;
    transform: translate(-50%, -100%) translateY(-6px);
    background: var(--c-tip-bg);
    color: var(--c-tip-text);
    border-radius: var(--sw-r-sm);
    padding: 6px 9px;
    font-size: var(--sw-fs-sm);
    line-height: 1.35;
    white-space: nowrap;
    pointer-events: none;
    box-shadow: var(--sw-shadow-2);
    z-index: 2;
    display: grid;
    gap: 2px;
  }
  .tip b {
    font-weight: var(--sw-fw-semibold);
    font-variant-numeric: tabular-nums;
  }
  .tip .k {
    display: inline-block;
    inline-size: 10px;
    block-size: 2px;
    border-radius: 1px;
    vertical-align: middle;
    margin-inline-end: 6px;
  }
  .tip small {
    font-size: var(--sw-fs-xs);
    opacity: 0.85;
  }
  .legend {
    display: flex;
    gap: 14px;
    flex-wrap: wrap;
    font-size: var(--sw-fs-sm);
    color: var(--sw-text-2);
    margin-block-start: 6px;
  }
  .legend i {
    display: inline-block;
    inline-size: 12px;
    block-size: 12px;
    border-radius: var(--sw-r-2xs, 2px);
    margin-inline-end: 6px;
    vertical-align: -1px;
  }
  .tgl {
    cursor: pointer;
    font: inherit;
    font-size: var(--sw-fs-sm);
    margin-block-start: 6px;
    color: var(--sw-accent-text);
    background: none;
    border: 0;
    padding: 0 4px;
    min-block-size: 40px;
    display: inline-flex;
    align-items: center;
  }
  .tgl:focus-visible {
    outline: var(--sw-focus-w) solid var(--sw-focus);
    outline-offset: 1px;
    border-radius: var(--sw-r-sm);
  }
  .tw {
    overflow-x: auto;
  }
  table {
    border-collapse: collapse;
    inline-size: 100%;
    margin-block-start: 8px;
    font-size: var(--sw-fs-sm);
    color: var(--sw-text-2);
  }
  th,
  td {
    padding: 4px 8px;
    border-block-end: 1px solid var(--c-grid);
    text-align: start;
    font-weight: var(--sw-fw-regular, 400);
  }
  th {
    color: var(--sw-text-3);
    font-weight: var(--sw-fw-medium);
  }
  td.n {
    font-variant-numeric: tabular-nums;
  }
  .sr {
    position: absolute;
    inline-size: 1px;
    block-size: 1px;
    overflow: hidden;
    clip-path: inset(50%);
  }
  .empty {
    color: var(--sw-text-3);
    font-size: var(--sw-fs-sm);
    padding: 12px 0;
  }
`;

abstract class Sized extends LitElement {
  @state() protected w = 640;
  private ro?: ResizeObserver;

  connectedCallback(): void {
    super.connectedCallback();
    this.ro = new ResizeObserver((e) => {
      const w = Math.round(e[0].contentRect.width);
      if (w > 160 && Math.abs(w - this.w) > 2) this.w = w;
    });
    this.ro.observe(this);
  }

  disconnectedCallback(): void {
    super.disconnectedCallback();
    this.ro?.disconnect();
  }
}

export interface DayCount {
  day: string;
  granted: number;
  denied: number;
}

/** Entries per day: granted (slot 1) with denied stacked on top (slot 2). */
@customElement('wk-ops-day-chart')
export class WkOpsDayChart extends Sized {
  @property({ attribute: false }) days: DayCount[] = [];
  @property({ type: Number }) height = 200;
  @state() private hot: string | null = null;
  @state() private table = false;

  static styles = [
    shared,
    css`
      .g {
        fill: var(--c-s1);
      }
      .d {
        fill: var(--c-s2);
      }
      g.band.hot .g,
      g.band.hot .d {
        filter: brightness(1.08);
      }
      .legend .lg {
        background: var(--c-s1);
      }
      .legend .ld {
        background: var(--c-s2);
      }
    `,
  ];

  render(): TemplateResult {
    const days = this.days;
    if (!days.length) return html`<div class="empty" data-chart-empty>${T.empty}</div>`;
    const W = this.w;
    const H = this.height;
    const axis = 34; // the y labels' column at the inline start (right in RTL)
    const top = 16;
    const bottom = 22;
    const plotW = W - axis;
    const plotH = H - top - bottom;
    const max = niceMax(Math.max(...days.map((d) => d.granted + d.denied), 1));
    const bars = stackBars(days, plotW, plotH, max, true);
    const step = bars.length > 1 ? plotW / bars.length : plotW;
    const labelEvery = step < 34 ? Math.ceil(34 / step) : 1;
    const peak = days.reduce((b, d, i) => (d.granted + d.denied > days[b].granted + days[b].denied ? i : b), 0);
    const hotIdx = this.hot === null ? -1 : bars.findIndex((b) => b.key === this.hot);
    const hot = hotIdx >= 0 ? bars[hotIdx] : null;
    const aria = `${T.byDay}: ${days.map((d) => `${dayLabel(d.day)} ${T.granted} ${d.granted}, ${T.denied} ${d.denied}`).join('; ')}`;
    return html`
      <svg viewBox="0 0 ${W} ${H}" role="img" aria-label=${aria} data-day-chart @pointerleave=${() => (this.hot = null)}>
        ${ticks(max).map((t) => {
          const y = top + plotH - (t / max) * plotH;
          return svg`<line class="grid" x1="0" x2=${plotW} y1=${y} y2=${y} opacity=${t === 0 ? 1 : 0.6}></line>
            <text x=${W - 4} y=${y + 4} text-anchor="end">${compact(t)}</text>`;
        })}
        ${bars.map((b, i) => {
          const on = () => (this.hot = b.key);
          const off = () => {
            if (this.hot === b.key) this.hot = null;
          };
          const cx = b.x + b.w / 2;
          const total = b.values.granted + b.values.denied;
          const label = i % labelEvery === 0 || i === bars.length - 1 ? svg`<text x=${cx} y=${H - 6} text-anchor="middle">${dayLabel(b.key)}</text>` : nothing;
          const value = i === peak && total > 0 ? svg`<text class="v" x=${cx} y=${top + Math.min(b.granted.y, b.denied.h ? b.denied.y : b.granted.y) - 5} text-anchor="middle">${total}</text>` : nothing;
          return svg`<g class=${this.hot === b.key ? 'band hot' : 'band'} tabindex="0" data-day=${b.key} aria-label=${`${dayLabel(b.key)}: ${T.granted} ${b.values.granted}, ${T.denied} ${b.values.denied}`}
              @pointerenter=${on} @focus=${on} @blur=${off}>
            <rect class="hit" x=${b.x - (step - b.w) / 2} y=${top - 6} width=${step} height=${plotH + 6}></rect>
            <g transform=${`translate(0 ${top})`}>
              ${b.granted.h > 0 ? svg`<path class="g" d=${barPath(b.x, b.granted.y, b.w, b.granted.h, b.denied.h > 0 ? 0 : 4)}></path>` : nothing}
              ${b.denied.h > 0 ? svg`<path class="d" d=${barPath(b.x, b.denied.y, b.w, b.denied.h)}></path>` : nothing}
            </g>
            ${value}${label}
          </g>`;
        })}
      </svg>
      ${hot
        ? html`<div class="tip" role="tooltip" data-chart-tip style=${`left:${((hot.x + hot.w / 2) / W) * 100}%; inset-block-start:${((top + Math.min(hot.granted.y, hot.denied.h ? hot.denied.y : hot.granted.y)) / H) * 100}%`}>
            <span><span class="k" style="background:var(--c-s1)"></span><b>${hot.values.granted}</b> ${T.granted}</span>
            <span><span class="k" style="background:var(--c-s2)"></span><b>${hot.values.denied}</b> ${T.denied}</span>
            <small>${dayLabel(hot.key)}</small>
          </div>`
        : nothing}
      <div class="legend" data-chart-legend><span><i class="lg"></i>${T.granted}</span><span><i class="ld"></i>${T.denied}</span></div>
      <button type="button" class="tgl" data-chart-table-toggle aria-expanded=${this.table} @click=${() => (this.table = !this.table)}>${this.table ? T.hideTable : T.showTable}</button>
      <div class=${this.table ? 'tw' : 'sr'}>
        <table data-chart-table>
          <thead><tr><th scope="col">יום</th><th scope="col">${T.granted}</th><th scope="col">${T.denied}</th></tr></thead>
          <tbody>${days.map((d) => html`<tr><td>${dayLabel(d.day)}</td><td class="n">${d.granted}</td><td class="n">${d.denied}</td></tr>`)}</tbody>
        </table>
      </div>
    `;
  }
}

/** One station's user count over time, with its advertised limit as a hairline (single series: no legend box - the title names it). */
@customElement('wk-ops-trend-chart')
export class WkOpsTrendChart extends Sized {
  @property({ attribute: false }) points: TrendPoint[] = [];
  @property({ type: Number }) limit: number | null = null;
  @property() label = '';
  @property({ type: Number }) height = 180;
  /** formats an instant for the tooltip and the table (the screen passes its zone-aware formatter) */
  @property({ attribute: false }) fmt: (iso: string) => string = (iso) => iso;
  @state() private hot = -1;
  @state() private table = false;

  static styles = [
    shared,
    css`
      .line {
        fill: none;
        stroke: var(--c-s1);
        stroke-width: 2;
        stroke-linejoin: round;
        stroke-linecap: round;
      }
      .area {
        fill: var(--c-s1);
        opacity: 0.1;
      }
      .dot {
        fill: var(--c-s1);
        stroke: var(--c-surface);
        stroke-width: 2;
      }
      .limit {
        stroke: var(--sw-text-3);
        stroke-width: 1;
        shape-rendering: crispEdges;
      }
      .cross {
        stroke: var(--sw-text-3);
        stroke-width: 1;
      }
      .plot:focus {
        outline: none;
      }
      .plot:focus-visible {
        outline: var(--sw-focus-w) solid var(--sw-focus);
      }
    `,
  ];

  private move(e: PointerEvent, pts: { x: number }[]): void {
    const svgEl = this.renderRoot.querySelector('svg');
    if (!svgEl) return;
    const box = svgEl.getBoundingClientRect();
    this.hot = nearest(pts, ((e.clientX - box.left) / box.width) * this.w);
  }

  private key(e: KeyboardEvent, n: number): void {
    if (e.key !== 'ArrowLeft' && e.key !== 'ArrowRight') return;
    e.preventDefault();
    // RTL: newer is to the left
    const step = e.key === 'ArrowLeft' ? 1 : -1;
    this.hot = Math.max(0, Math.min(n - 1, (this.hot < 0 ? n - 1 : this.hot) + step));
  }

  render(): TemplateResult {
    const usable = this.points.filter((p) => p.users !== null);
    if (usable.length < 2) return html`<div class="empty" data-trend-empty>${T.trendNone}</div>`;
    const W = this.w;
    const H = this.height;
    const axis = 40;
    const top = 14;
    const bottom = 8;
    const plotW = W - axis;
    const plotH = H - top - bottom;
    const max = niceMax(Math.max(...usable.map((p) => p.users as number), this.limit ?? 0, 1) * 1.05);
    const pts = trendPoints(usable, plotW - 8, plotH, max, true).map((p) => ({ ...p, x: p.x + 4 }));
    const last = pts[pts.length - 1];
    const hot = this.hot >= 0 && this.hot < pts.length ? pts[this.hot] : null;
    const limitY = this.limit !== null ? top + plotH - (this.limit / max) * plotH : null;
    const area = `${linePath(pts.map((p) => ({ x: p.x, y: p.y + top })))}L${last.x},${top + plotH}L${pts[0].x},${top + plotH}Z`;
    const aria = `${this.label}: ${usable.map((p) => `${this.fmt(p.at)} ${p.users}`).join('; ')}`;
    return html`
      <svg viewBox="0 0 ${W} ${H}" role="img" aria-label=${aria} data-trend-chart>
        ${ticks(max).map((t) => {
          const y = top + plotH - (t / max) * plotH;
          return svg`<line class="grid" x1="0" x2=${plotW} y1=${y} y2=${y} opacity=${t === 0 ? 1 : 0.6}></line><text x=${W - 4} y=${y + 4} text-anchor="end">${compact(t)}</text>`;
        })}
        ${limitY !== null ? svg`<line class="limit" x1="0" x2=${plotW} y1=${limitY} y2=${limitY} data-trend-limit></line><text x="4" y=${limitY - 4} text-anchor="start">מגבלה ${this.limit}</text>` : nothing}
        <path class="area" d=${area}></path>
        <path class="line" d=${linePath(pts.map((p) => ({ x: p.x, y: p.y + top })))}></path>
        <circle class="dot" cx=${last.x} cy=${last.y + top} r="4"></circle>
        <text class="v" x=${last.x} y=${last.y + top - 9} text-anchor="middle">${last.v}</text>
        ${hot ? svg`<line class="cross" x1=${hot.x} x2=${hot.x} y1=${top} y2=${top + plotH}></line><circle class="dot" cx=${hot.x} cy=${hot.y + top} r="4"></circle>` : nothing}
        <rect class="plot" x="0" y=${top} width=${plotW} height=${plotH} fill="transparent" tabindex="0" aria-label=${this.label}
          @pointermove=${(e: PointerEvent) => this.move(e, pts)} @pointerleave=${() => (this.hot = -1)} @focus=${() => (this.hot = pts.length - 1)} @blur=${() => (this.hot = -1)}
          @keydown=${(e: KeyboardEvent) => this.key(e, pts.length)}></rect>
      </svg>
      ${hot
        ? html`<div class="tip" role="tooltip" data-chart-tip style=${`left:${(hot.x / W) * 100}%; inset-block-start:${((hot.y + top) / H) * 100}%`}>
            <span><span class="k" style="background:var(--c-s1)"></span><b>${hot.v}</b> ${this.label}</span><small>${this.fmt(hot.at)}</small>
          </div>`
        : nothing}
      <button type="button" class="tgl" data-chart-table-toggle aria-expanded=${this.table} @click=${() => (this.table = !this.table)}>${this.table ? T.hideTable : T.showTable}</button>
      <div class=${this.table ? 'tw' : 'sr'}>
        <table data-chart-table>
          <thead><tr><th scope="col">${T.sampledAt}</th><th scope="col">${this.label}</th></tr></thead>
          <tbody>${usable.map((p) => html`<tr><td>${this.fmt(p.at)}</td><td class="n">${p.users}</td></tr>`)}</tbody>
        </table>
      </div>
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'wk-ops-day-chart': WkOpsDayChart;
    'wk-ops-trend-chart': WkOpsTrendChart;
  }
}
