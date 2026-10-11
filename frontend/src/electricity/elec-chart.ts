/**
 * CR-023 round 3: the consumption chart of a bill (and of the account history): the previous periods as bars (at most 12), the
 * current period highlighted, the same period last year marked. It renders the snapshot's `history` (ELECTRICITY_BILL_SNAPSHOT.md):
 * a period with no data draws no bar (a gap, never an invented number), a partial period is hatched, a first bill with no history
 * draws nothing at all. Hebrew RTL labels (the oldest period at the right, as the text reads), a numbers table as the accessible
 * fallback (screen readers, or a visible table inside the printed bill).
 *
 * MEDIA-polish (2026-10-10, the data-viz rules): thin bars (at most 24 px, a rounded data end, square at the baseline), values only
 * where they carry the story (the current period, the highest period, last year) - every other value lives in the hover / focus
 * tooltip and in the table twin; the bars take keyboard focus (Tab) and the tooltip follows; the gridline is a solid hairline.
 * The print palette (the bill paper) is unchanged.
 */
import { LitElement, html, css, svg, nothing } from 'lit';
import { customElement, property, state } from 'lit/decorators.js';
import type { BillHistory } from '../api/electricity-billing';
import { f2 } from './elec-format';
import { BAR_MAX, barPath, chartBars, hasComparison, labelledBars, type Bar } from './elec-chart-data';

@customElement('elec-chart')
export class ElecChart extends LitElement {
  @property({ attribute: false }) series: BillHistory | null = null;
  /** `sr`: the numbers table only for screen readers; `visible`: a table under the chart (the printed bill); `details`: a collapsible table */
  @property() table: 'sr' | 'visible' | 'details' = 'sr';
  /** the print palette (the bill paper is always light, whatever the skin) */
  @property({ type: Boolean, reflect: true }) print = false;
  @property({ type: Number }) height = 200;
  @state() private w = 640;
  @state() private showTable = false;
  /** the hovered / focused bar (its key), the tooltip's anchor */
  @state() private hot: string | null = null;
  private ro?: ResizeObserver;

  static styles = css`
    :host {
      display: block;
      position: relative;
      min-inline-size: 0;
      contain: inline-size;
      --c-bar: var(--sw-accent);
      --c-bar2: color-mix(in srgb, var(--sw-accent) 38%, var(--sw-surface-3));
      --c-text: var(--sw-text-3);
      --c-grid: var(--sw-border);
      --c-ly: var(--sw-text-2);
      --c-tip-bg: var(--sw-toast-bg);
      --c-tip-text: var(--sw-toast-text);
    }
    :host([print]) {
      --c-bar: #2767ed;
      --c-bar2: #a9c1f7;
      --c-text: #5b6a85;
      --c-grid: #d5dbe6;
      --c-ly: #1d2433;
      font-family: 'Heebo', Arial, sans-serif;
    }
    svg {
      inline-size: 100%;
      display: block;
      overflow: visible;
    }
    text {
      fill: var(--c-text);
      font-size: var(--sw-fs-xs);
      font-family: inherit;
    }
    text.v {
      font-variant-numeric: tabular-nums;
      fill: var(--sw-text-2);
      font-weight: var(--sw-fw-medium);
    }
    :host([print]) text.v {
      fill: var(--c-ly);
    }
    .bar {
      fill: var(--c-bar);
    }
    .bar2 {
      fill: var(--c-bar2);
    }
    .part {
      fill: url(#hatch);
    }
    .ly {
      fill: none;
      stroke: var(--c-ly);
      stroke-width: 1.6;
      stroke-dasharray: 4 3;
    }
    .grid {
      stroke: var(--c-grid);
      stroke-width: 1;
      shape-rendering: crispEdges;
    }
    .lyline {
      stroke: var(--c-ly);
      stroke-width: 1;
      stroke-dasharray: 2 3;
      opacity: 0.6;
    }
    .gap {
      stroke: var(--c-text);
      stroke-width: 1.5;
    }
    /* the hit area of a band: wider than the mark, invisible; hover and focus light the bar */
    .hit {
      fill: transparent;
      cursor: default;
    }
    g.band:focus {
      outline: none;
    }
    g.band:focus-visible .hit {
      fill: color-mix(in srgb, var(--sw-focus) 10%, transparent);
    }
    g.band.hot .hit {
      fill: color-mix(in srgb, var(--sw-text) 5%, transparent);
    }
    g.band.hot .bar2 {
      fill: color-mix(in srgb, var(--sw-accent) 55%, var(--sw-surface-3));
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
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 1px;
    }
    .tip b {
      font-weight: var(--sw-fw-semibold);
      font-variant-numeric: tabular-nums;
      direction: ltr;
      unicode-bidi: isolate;
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
      color: var(--c-text);
      margin-block-start: 6px;
    }
    .legend i {
      display: inline-block;
      inline-size: 12px;
      block-size: 12px;
      border-radius: 3px;
      margin-inline-end: 5px;
      vertical-align: -1px;
    }
    .legend .l-cur {
      background: var(--c-bar);
    }
    .legend .l-prev {
      background: var(--c-bar2);
    }
    .legend .l-ly {
      border: 1.6px dashed var(--c-ly);
    }
    .legend .l-part {
      background: repeating-linear-gradient(45deg, var(--c-bar2) 0 3px, transparent 3px 6px);
      border: 1px solid var(--c-bar2);
    }
    .tw {
      overflow-x: auto;
    }
    table {
      border-collapse: collapse;
      inline-size: 100%;
      margin-block-start: 8px;
      font-size: var(--sw-fs-xs);
      color: var(--c-text);
    }
    th,
    td {
      padding: 3px 6px;
      border-block-end: 1px solid var(--c-grid);
      text-align: center;
      font-weight: 500;
    }
    td {
      direction: ltr;
      font-variant-numeric: tabular-nums;
    }
    .sr {
      position: absolute;
      inline-size: 1px;
      block-size: 1px;
      overflow: hidden;
      clip-path: inset(50%);
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
      min-block-size: var(--elec-touch, 32px);
      display: inline-flex;
      align-items: center;
    }
    @media (max-width: 1100px) {
      :host {
        --elec-touch: 44px;
      }
    }
    @media print {
      .tip {
        display: none;
      }
    }
  `;

  connectedCallback() {
    super.connectedCallback();
    this.ro = new ResizeObserver((e) => {
      const w = Math.round(e[0].contentRect.width);
      if (w > 120 && Math.abs(w - this.w) > 2) this.w = w;
    });
    this.ro.observe(this);
  }
  disconnectedCallback() {
    super.disconnectedCallback();
    this.ro?.disconnect();
  }

  render() {
    const bars = chartBars(this.series);
    if (!hasComparison(this.series)) return nothing;
    const W = this.w;
    const H = this.height;
    const pad = 12;
    const top = 18;
    const bottom = 22;
    const n = bars.length;
    const bw = (W - pad * 2) / n;
    const vals = bars.map((b) => b.kwh ?? 0);
    const max = Math.max(...vals, 1) * 1.12;
    const barW = Math.min(bw * 0.68, BAR_MAX);
    const scale = (v: number) => (v / max) * (H - top - bottom);
    const base = H - bottom;
    // RTL: the oldest bar sits at the right edge, the current period at the left
    const bandX = (i: number) => W - pad - (i + 1) * bw;
    const xOf = (i: number) => bandX(i) + (bw - barW) / 2;
    const labelEvery = bw < 30 ? 2 : 1;
    const labelled = labelledBars(bars);
    const showVal = bw >= 30;
    const cur = bars.find((b) => b.kind === 'cur');
    const lyBar = bars.find((b) => b.kind === 'ly' || b.lyMark);
    const lyY = lyBar && lyBar.kwh !== null ? base - scale(lyBar.kwh) : null;
    const hasPartial = bars.some((b) => b.partial);
    const aria = `צריכה לפי תקופה: ${bars.filter((b) => b.kwh !== null).map((b) => `${b.label} ${f2(b.kwh as number)} קוט״ש`).join(', ')}`;
    const hotIdx = this.hot === null ? -1 : bars.findIndex((b) => b.key === this.hot);
    const hotBar = hotIdx >= 0 ? bars[hotIdx] : null;
    return html`
      <svg viewBox="0 0 ${W} ${H}" role="img" aria-label=${aria} data-elec-chart @pointerleave=${() => (this.hot = null)}>
        <defs>
          <pattern id="hatch" width="6" height="6" patternUnits="userSpaceOnUse" patternTransform="rotate(45)"><rect width="6" height="6" fill="var(--c-bar2)"></rect><rect width="2.5" height="6" fill="var(--c-bar)" opacity="0.55"></rect></pattern>
        </defs>
        <line class="grid" x1=${pad} x2=${W - pad} y1=${base} y2=${base}></line>
        ${lyY !== null && cur ? svg`<line class="lyline" x1=${pad} x2=${W - pad} y1=${lyY} y2=${lyY}></line>` : nothing}
        ${bars.map((b, i) => {
          const x = xOf(i);
          const cx = x + barW / 2;
          const name = b.kind === 'ly' ? 'אשתקד' : b.label;
          const label = i % labelEvery === 0 || b.kind !== 'prev' ? svg`<text x=${cx} y=${H - 6} text-anchor="middle">${name}</text>` : nothing;
          const hot = this.hot === b.key;
          const hit = svg`<rect class="hit" x=${bandX(i)} y=${top - 10} width=${bw} height=${H - top + 10 - bottom + 4}></rect>`;
          const on = () => (this.hot = b.key);
          const off = () => {
            if (this.hot === b.key) this.hot = null;
          };
          if (b.kwh === null) {
            return svg`<g class=${hot ? 'band hot' : 'band'} data-bar="gap" tabindex="0" aria-label=${`${b.title}: אין נתונים`} @pointerenter=${on} @focus=${on} @blur=${off}>
              ${hit}<line class="gap" x1=${cx - 5} x2=${cx + 5} y1=${base - 4} y2=${base - 4}></line>${label}</g>`;
          }
          const h = Math.max(2, scale(b.kwh));
          const y = base - h;
          const ring = b.lyMark ? svg`<rect class="ly" x=${x - 2} y=${y - 2} width=${barW + 4} height=${h + 2} rx="4"></rect>` : nothing;
          const cls = b.kind === 'cur' ? 'bar' : b.kind === 'ly' ? 'ly' : b.partial ? 'part' : 'bar2';
          const value = showVal && labelled.has(b.key) ? svg`<text class="v" x=${cx} y=${y - 5} text-anchor="middle">${f2(b.kwh).replace(/\.00$/, '')}</text>` : nothing;
          return svg`<g class=${hot ? 'band hot' : 'band'} data-bar=${b.kind} tabindex="0" aria-label=${`${b.title}: ${f2(b.kwh)} קוט״ש${b.partial ? ' (נתונים חלקיים)' : ''}`} @pointerenter=${on} @focus=${on} @blur=${off}>
            ${hit}<path class=${cls} d=${barPath(x, y, barW, h)}></path>
            ${ring}${value}${label}</g>`;
        })}
      </svg>
      ${hotBar
        ? html`<div class="tip" role="tooltip" data-chart-tip style=${`left:${((xOf(hotIdx) + barW / 2) / W) * 100}%; inset-block-start:${((hotBar.kwh === null ? base - 8 : base - Math.max(2, scale(hotBar.kwh))) / H) * 100}%`}>
            <b>${hotBar.kwh === null ? 'אין נתונים' : `${f2(hotBar.kwh)} קוט״ש`}</b><small>${hotBar.title}${hotBar.partial ? ' · נתונים חלקיים' : ''}</small>
          </div>`
        : nothing}
      <div class="legend">
        ${cur ? html`<span><i class="l-cur"></i>התקופה הנוכחית</span>` : nothing}
        <span><i class="l-prev"></i>תקופות קודמות</span>
        ${lyBar ? html`<span><i class="l-ly"></i>אותה תקופה אשתקד</span>` : nothing}
        ${hasPartial ? html`<span><i class="l-part"></i>נתונים חלקיים</span>` : nothing}
      </div>
      ${this.renderTable(bars)}
    `;
  }

  private renderTable(bars: Bar[]) {
    const t = html`<div class=${this.table === 'sr' ? 'sr' : 'tw'}><table data-elec-chart-table>
      <thead><tr>${bars.map((b) => html`<th scope="col" title=${b.title}>${b.kind === 'ly' ? 'אשתקד' : b.label}</th>`)}</tr></thead>
      <tbody><tr>${bars.map((b) => html`<td>${b.kwh === null ? '-' : f2(b.kwh)}</td>`)}</tr></tbody>
    </table></div>`;
    if (this.table === 'details')
      return html`<button type="button" class="tgl" data-chart-table-toggle aria-expanded=${this.showTable} @click=${() => (this.showTable = !this.showTable)}>${this.showTable ? 'הסתרת טבלת מספרים' : 'טבלת מספרים'}</button>${this.showTable ? t : nothing}`;
    return t;
  }
}
declare global {
  interface HTMLElementTagNameMap {
    'elec-chart': ElecChart;
  }
}
