/**
 * CR-023 round 3: the consumption chart of a bill (and of the account history): the previous periods as bars (at most 12), the
 * current period highlighted, the same period last year marked. It renders the snapshot's `history` (ELECTRICITY_BILL_SNAPSHOT.md):
 * a period with no data draws no bar (a gap, never an invented number), a partial period is hatched, a first bill with no history
 * draws nothing at all. Hebrew RTL labels (the oldest period at the right, as the text reads), a numbers table as the accessible
 * fallback (screen readers, or a visible table inside the printed bill).
 */
import { LitElement, html, css, svg, nothing } from 'lit';
import { customElement, property, state } from 'lit/decorators.js';
import type { BillHistory } from '../api/electricity-billing';
import { f2, fmtRange, monthShort } from './elec-format';

export interface Bar {
  key: string;
  label: string;
  title: string;
  kwh: number | null;
  kind: 'prev' | 'cur' | 'ly';
  partial: boolean;
}

/** The bars of a series in reading order, oldest first: last year, previous periods, the current period. Pure (unit specs use it). */
export function chartBars(h: BillHistory | null | undefined): Bar[] {
  if (!h) return [];
  const out: Bar[] = [];
  const ly = h.same_period_last_year;
  if (ly && ly.kwh !== null) out.push({ key: 'ly', label: monthShort(ly.to), title: `אותה תקופה אשתקד, ${fmtRange(ly.from, ly.to)}`, kwh: Number(ly.kwh), kind: 'ly', partial: ly.status === 'partial' });
  for (const p of h.previous.slice(-12)) out.push({ key: `p${p.to}`, label: monthShort(p.to), title: fmtRange(p.from, p.to), kwh: p.kwh === null ? null : Number(p.kwh), kind: 'prev', partial: p.status === 'partial' });
  if (h.current) out.push({ key: 'cur', label: monthShort(h.current.to), title: `התקופה הנוכחית, ${fmtRange(h.current.from, h.current.to)}`, kwh: Number(h.current.kwh), kind: 'cur', partial: false });
  return out;
}
/** A series draws a chart only when at least one bar other than the current period has data. */
export const hasComparison = (h: BillHistory | null | undefined): boolean => chartBars(h).some((b) => b.kind !== 'cur' && b.kwh !== null);

@customElement('elec-chart')
export class ElecChart extends LitElement {
  @property({ attribute: false }) series: BillHistory | null = null;
  /** `sr`: the numbers table only for screen readers; `visible`: a table under the chart (the printed bill); `details`: a collapsible table */
  @property() table: 'sr' | 'visible' | 'details' = 'sr';
  /** the print palette (the bill paper is always light, whatever the skin) */
  @property({ type: Boolean, reflect: true }) print = false;
  @property({ type: Number }) height = 200;
  @state() private w = 640;
  private ro?: ResizeObserver;

  static styles = css`
    :host {
      display: block;
      min-inline-size: 0;
      --c-bar: var(--sw-accent);
      --c-bar2: color-mix(in srgb, var(--sw-accent) 38%, var(--sw-surface-3));
      --c-text: var(--sw-text-3);
      --c-grid: var(--sw-border);
      --c-ly: var(--sw-text-2);
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
    }
    text {
      fill: var(--c-text);
      font-size: 11px;
      font-family: inherit;
    }
    text.v {
      font-variant-numeric: tabular-nums;
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
    }
    .lyline {
      stroke: var(--c-ly);
      stroke-width: 1;
      stroke-dasharray: 2 3;
      opacity: 0.7;
    }
    .gap {
      stroke: var(--c-text);
      stroke-width: 1.5;
    }
    .legend {
      display: flex;
      gap: 14px;
      flex-wrap: wrap;
      font-size: 12px;
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
    table {
      border-collapse: collapse;
      inline-size: 100%;
      margin-block-start: 8px;
      font-size: 11.5px;
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
    details summary {
      cursor: pointer;
      font-size: 12px;
      margin-block-start: 6px;
      color: var(--sw-accent-text);
      min-block-size: 24px;
    }
    @media (max-width: 1100px) {
      details summary {
        min-block-size: 44px;
        display: flex;
        align-items: center;
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
    const barW = Math.min(bw * 0.68, 46);
    const scale = (v: number) => (v / max) * (H - top - bottom);
    const base = H - bottom;
    // RTL: the oldest bar sits at the right edge, the current period at the left
    const xOf = (i: number) => W - pad - (i + 1) * bw + (bw - barW) / 2;
    const labelEvery = bw < 30 ? 2 : 1;
    const showVal = bw >= 30;
    const ly = bars.find((b) => b.kind === 'ly');
    const cur = bars.find((b) => b.kind === 'cur');
    const lyY = ly && ly.kwh !== null ? base - scale(ly.kwh) : null;
    const hasPartial = bars.some((b) => b.partial);
    const aria = `צריכה לפי תקופה: ${bars.filter((b) => b.kwh !== null).map((b) => `${b.label} ${f2(b.kwh as number)} קוט״ש`).join(', ')}`;
    return html`
      <svg viewBox="0 0 ${W} ${H}" role="img" aria-label=${aria} data-elec-chart>
        <defs>
          <pattern id="hatch" width="6" height="6" patternUnits="userSpaceOnUse" patternTransform="rotate(45)"><rect width="6" height="6" fill="var(--c-bar2)"></rect><rect width="2.5" height="6" fill="var(--c-bar)" opacity="0.55"></rect></pattern>
        </defs>
        <line class="grid" x1=${pad} x2=${W - pad} y1=${base} y2=${base}></line>
        ${lyY !== null && cur ? svg`<line class="lyline" x1=${pad} x2=${W - pad} y1=${lyY} y2=${lyY}></line>` : nothing}
        ${bars.map((b, i) => {
          const x = xOf(i);
          const cx = x + barW / 2;
          const label = i % labelEvery === 0 || b.kind !== 'prev' ? svg`<text x=${cx} y=${H - 6} text-anchor="middle">${b.kind === 'ly' ? 'אשתקד' : b.label}</text>` : nothing;
          if (b.kwh === null) return svg`<g data-bar="gap"><title>${b.title}: אין נתונים</title><line class="gap" x1=${cx - 5} x2=${cx + 5} y1=${base - 4} y2=${base - 4}></line>${label}</g>`;
          const h = Math.max(2, scale(b.kwh));
          const y = base - h;
          const cls = b.kind === 'cur' ? 'bar' : b.kind === 'ly' ? 'ly' : b.partial ? 'part' : 'bar2';
          return svg`<g data-bar=${b.kind}><title>${b.title}: ${f2(b.kwh)} קוט״ש${b.partial ? ' (נתונים חלקיים)' : ''}</title>
            <rect class=${cls} x=${x} y=${y} width=${barW} height=${h} rx="3"></rect>
            ${showVal ? svg`<text class="v" x=${cx} y=${y - 4} text-anchor="middle">${f2(b.kwh).replace(/\.00$/, '')}</text>` : nothing}${label}</g>`;
        })}
      </svg>
      <div class="legend">
        ${cur ? html`<span><i class="l-cur"></i>התקופה הנוכחית</span>` : nothing}
        <span><i class="l-prev"></i>תקופות קודמות</span>
        ${ly ? html`<span><i class="l-ly"></i>אותה תקופה אשתקד</span>` : nothing}
        ${hasPartial ? html`<span><i class="l-part"></i>נתונים חלקיים</span>` : nothing}
      </div>
      ${this.renderTable(bars)}
    `;
  }

  private renderTable(bars: Bar[]) {
    const t = html`<table data-elec-chart-table class=${this.table === 'sr' ? 'sr' : ''}>
      <thead><tr>${bars.map((b) => html`<th scope="col" title=${b.title}>${b.kind === 'ly' ? 'אשתקד' : b.label}</th>`)}</tr></thead>
      <tbody><tr>${bars.map((b) => html`<td>${b.kwh === null ? '-' : f2(b.kwh)}</td>`)}</tr></tbody>
    </table>`;
    if (this.table === 'details') return html`<details><summary>טבלת מספרים</summary>${t}</details>`;
    return t;
  }
}
declare global {
  interface HTMLElementTagNameMap {
    'elec-chart': ElecChart;
  }
}
