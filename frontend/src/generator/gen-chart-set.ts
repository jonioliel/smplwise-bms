import { LitElement, html, nothing } from 'lit';
import { customElement, property, state } from 'lit/decorators.js';
import '../components/sw-state-panel';
import { getHistory, type GenRange, type HistoryResponse } from '../api/generator';
import { describeError } from '../api/client';
import { he } from '../i18n/he';
import { elecCss } from '../electricity/styles';
import { SkinController } from '../design/skin';
import { genCss } from './gen-styles';
import { fmtClock, fmtNum, metricsOf, plotSeries, Caps, type MetricDef } from './gen-logic';

const G = he.generator;
const unitOf = (m: MetricDef) => m.unit;
const label = (role: string) => (G.charts.metrics as Record<string, string>)[role] ?? role;

/**
 * CR-031 GEN1: the value-history charts of one generator - the small cards of the live screen (`mode="cards"`, one per mapped metric, press = full view) or the
 * single full-size chart (`mode="big"`, the metric chosen by the page). One request per range change (the roles are the mapped numeric ones); gaps in the data
 * break the line. Only metrics whose role is mapped are drawn.
 */
@customElement('gen-chart-set')
export class GenChartSet extends LitElement {
  readonly bubbleSkin = new SkinController(this);
  @property() deviceId = '';
  @property({ attribute: false }) roles: string[] = [];
  @property() range: GenRange = '24h';
  @property() from = '';
  @property() to = '';
  @property() mode: 'cards' | 'big' = 'cards';
  @property() metric = '';
  @state() private data: HistoryResponse | null = null;
  @state() private phase: 'loading' | 'ready' | 'error' = 'loading';
  @state() private error = '';
  private seq = 0;
  private timer = 0;

  static styles = [elecCss, genCss];

  protected updated(c: Map<string, unknown>) {
    if (c.has('deviceId') || c.has('range') || c.has('from') || c.has('to') || c.has('roles')) void this.load();
  }

  connectedCallback() {
    super.connectedCallback();
    this.timer = window.setInterval(() => {
      if (this.range !== 'custom' && !document.hidden) void this.load(true);
    }, 60_000);
  }
  disconnectedCallback() {
    window.clearInterval(this.timer);
    super.disconnectedCallback();
  }

  private async load(quiet = false) {
    if (!this.deviceId || !this.roles.length) return;
    if (this.range === 'custom' && (!this.from || !this.to)) return;
    const my = ++this.seq;
    if (!quiet) this.phase = 'loading';
    try {
      const r = await getHistory(this.deviceId, this.roles, this.range, this.range === 'custom' ? new Date(this.from).toISOString() : undefined, this.range === 'custom' ? new Date(this.to).toISOString() : undefined);
      if (my !== this.seq) return;
      this.data = r;
      this.phase = 'ready';
      this.dispatchEvent(new CustomEvent('history-loaded', { detail: r, bubbles: true, composed: true }));
    } catch (e) {
      if (my !== this.seq) return;
      this.error = describeError(e);
      if (!quiet) this.phase = 'error';
    }
  }

  private card(m: MetricDef, big: boolean) {
    const d = this.data!;
    const pts = d.series[m.role] ?? [];
    const W = 600;
    const H = big ? 300 : 120;
    const p = plotSeries(pts, d.from, d.to, d.step_s, W, H, m.fixed);
    const gid = `cg-${m.role}${big ? 'b' : ''}`;
    const axis = this.range === 'custom' ? [fmtClock(d.from * 1000), fmtClock(d.to * 1000)] : [G.charts.axisAgo[this.range], G.charts.axisNow];
    const body = p.n
      ? html`<div class="plot"><svg viewBox="0 0 ${W} ${H}" preserveAspectRatio="none" class="chart ${big ? 'big' : ''}" role="img" aria-label=${label(m.role)} dir="ltr" data-chart=${m.role}>
            <defs><linearGradient id=${gid} x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="var(--sw-accent)" stop-opacity=".28"></stop><stop offset="1" stop-color="var(--sw-accent)" stop-opacity="0"></stop></linearGradient></defs>
            ${[0.25, 0.5, 0.75].map((f) => html`<line x1="8" x2=${W - 8} y1=${8 + f * (H - 16)} y2=${8 + f * (H - 16)} stroke="var(--sw-border)" stroke-dasharray="3 4"></line>`)}
            ${p.areas.map((a) => html`<path d=${a} fill="url(#${gid})"></path>`)}
            ${p.lines.map((l) => html`<path d=${l} fill="none" stroke="var(--sw-accent)" stroke-width=${big ? 2.2 : 1.8} vector-effect="non-scaling-stroke" stroke-linejoin="round"></path>`)}
          </svg><div class="axy"><span class="num">${fmtNum(p.hi, m.digits)}</span><span class="num">${fmtNum(p.lo, m.digits)}</span></div></div>
          <div class="axx"><span>${axis[0]}</span><span>${axis[1]}</span></div>
          <div class="mut stats"><span>${G.charts.min} <b class="num">${fmtNum(p.min, m.digits)}</b></span><span>${G.charts.avg} <b class="num">${fmtNum(p.avg, m.digits)}</b></span><span>${G.charts.max} <b class="num">${fmtNum(p.max, m.digits)}</b></span></div>`
      : html`<div class="nodata" data-chart-empty=${m.role}>${G.charts.noData}</div>`;
    const open = () => this.dispatchEvent(new CustomEvent('metric-open', { detail: m.role, bubbles: true, composed: true }));
    return html`<div class="card chartcard ${big ? '' : 'clickable'}" data-metric=${m.role} @click=${big ? nothing : open}>
      <div class="hd"><span class="h3">${label(m.role)}</span><div class="sp"></div>${p.last !== null ? html`<span class="num cur">${fmtNum(p.last, m.digits)} ${unitOf(m)}</span>` : nothing}</div>${body}</div>`;
  }

  render() {
    const caps = new Caps(this.roles);
    const ms = metricsOf(caps);
    if (!ms.length) return nothing;
    if (this.phase === 'loading' && !this.data) return html`<div class="charts" data-state="loading">${ms.slice(0, this.mode === 'big' ? 1 : 4).map(() => html`<div class="card"><div class="skl" style="inline-size:40%"></div><div class="skl" style="block-size:${this.mode === 'big' ? 280 : 100}px;margin-block-start:10px"></div></div>`)}</div>`;
    if (this.phase === 'error' && !this.data) return html`<sw-state-panel state="error" heading=${G.loadError} hint=${this.error} data-state="error"></sw-state-panel>`;
    if (this.mode === 'big') {
      const m = ms.find((x) => x.role === this.metric) ?? ms[0];
      return html`<div data-state="ready">${this.card(m, true)}</div>`;
    }
    return html`<div class="charts" data-state="ready">${ms.map((m) => this.card(m, false))}</div>`;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'gen-chart-set': GenChartSet;
  }
}
