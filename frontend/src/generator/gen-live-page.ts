import { LitElement, html, nothing, type TemplateResult } from 'lit';
import { customElement, property, state } from 'lit/decorators.js';
import '../components/sw-icon';
import '../components/sw-button';
import './gen-chart-set';
import { getLive, loadViewMode, saveViewMode, type GenDevice, type GenRange, type LiveResponse, type ViewMode } from '../api/generator';
import { navigate } from '../router';
import { he } from '../i18n/he';
import { elecCss } from '../electricity/styles';
import { SkinController } from '../design/skin';
import { genCss } from './gen-styles';
import { flowSvg } from './gen-flow';
import {
  ageOf, agoText, capsOf, engineRows, fill, flowPlan, fmtDateTime, fmtNum, gaugeList, num, phaseTable, phoneKpis, str, toneOfEngine,
  type Gauge, type PhaseTable, type EngineState,
} from './gen-logic';

const G = he.generator;
const POLL_MS = 5000;
const RANGE_SET: GenRange[] = ['1h', '24h', '7d', '30d'];

function gaugeSvg(g: Gauge): TemplateResult {
  const r = 42;
  const cx = 60;
  const cy = 56;
  const a0 = (-210 * Math.PI) / 180;
  const total = 240;
  const at = (deg: number): [number, number] => [cx + r * Math.cos(a0 + (deg * Math.PI) / 180), cy + r * Math.sin(a0 + (deg * Math.PI) / 180)];
  const [sx, sy] = at(0);
  const [tx, ty] = at(total);
  const [ex, ey] = at((total * g.pct) / 100);
  const large = (total * g.pct) / 100 > 180 ? 1 : 0;
  const lim = g.limit;
  const limText = !lim ? '' : lim.kind === 'idle' ? G.gauge.limIdle : lim.kind === 'min' ? fill(G.gauge.limMin, { a: fmtNum(lim.a, g.digits) }) : lim.kind === 'max' && g.role === 'load_pct' ? fill(G.gauge.limRated, { a: fmtNum(lim.a) }) : fill(G.gauge.limMax, { a: fmtNum(lim.a, g.digits) });
  return html`<div class="gauge" data-gauge=${g.role}>
    <svg viewBox="0 0 120 92" aria-hidden="true">
      <path class="track" d="M${sx} ${sy} A${r} ${r} 0 1 1 ${tx} ${ty}"></path>
      ${g.pct > 0 ? html`<path class="arc ${g.tone}" d="M${sx} ${sy} A${r} ${r} 0 ${large} 1 ${ex} ${ey}"></path>` : nothing}
      <text x="60" y="60" text-anchor="middle" class="gv">${fmtNum(g.value, g.digits)}</text>
      <text x="60" y="76" text-anchor="middle" class="gu">${g.unit}</text>
    </svg>
    <div class="k">${(G.gauge as Record<string, string>)[g.role]}</div>${limText ? html`<div class="lim">${limText}</div>` : nothing}
  </div>`;
}

/**
 * תשתיות › גנרטור › מצב חי (CR-031 GEN1, approved mockup): status strip, the power-flow diagram beside the engine card, then ONE of the dials or the charts (the
 * user's choice, stored in `generator.view_mode`, default dials) and the phase table. Every piece is bound to roles: a piece whose role the controller does not
 * expose is not drawn and the grids close up. Values are polled from /live every 5 s (no websocket). View and alerts only - no control of the generator anywhere.
 */
@customElement('gen-live-page')
export class GenLivePage extends LitElement {
  readonly bubbleSkin = new SkinController(this);
  @property({ attribute: false }) device!: GenDevice;
  @property({ type: Boolean }) manage = false;
  @state() private live: LiveResponse | null = null;
  @state() private view: ViewMode = 'gauges';
  @state() private range: GenRange = '24h';
  @state() private phone = window.matchMedia('(max-width: 767px)').matches;
  @state() private tick = Date.now();
  private timer = 0;
  private mq = window.matchMedia('(max-width: 767px)');
  private onMq = () => (this.phone = this.mq.matches);
  private seq = 0;

  static styles = [elecCss, genCss];

  connectedCallback() {
    super.connectedCallback();
    this.mq.addEventListener('change', this.onMq);
    this.timer = window.setInterval(() => {
      this.tick = Date.now();
      if (!document.hidden) void this.poll();
    }, POLL_MS);
    void loadViewMode().then((m) => (this.view = m)).catch(() => undefined);
  }
  disconnectedCallback() {
    this.mq.removeEventListener('change', this.onMq);
    window.clearInterval(this.timer);
    super.disconnectedCallback();
  }
  protected willUpdate(c: Map<string, unknown>) {
    if (c.has('device')) {
      const prev = c.get('device') as GenDevice | undefined;
      if (!prev || prev.id !== this.device.id) {
        this.live = null;
        void this.poll();
      }
    }
  }

  private async poll() {
    const my = ++this.seq;
    try {
      const r = await getLive(this.device.id);
      if (my === this.seq) this.live = r;
    } catch {
      /* the last values stay; the shell's device poll reports a lost server */
    }
  }

  private setView(m: ViewMode) {
    if (m === this.view) return;
    this.view = m;
    void saveViewMode(m).catch(() => undefined);
  }

  private statusText(name: string, e: EngineState, onGen: boolean, mode: string | null, mains: boolean | null, hasAts: boolean): string {
    if (e === 'running') return fill(onGen || !hasAts ? (mode === 'test' && !onGen ? G.live.statusRunningTest : G.live.statusRunningLoad) : mode === 'test' ? G.live.statusRunningTest : G.live.statusRunningIdle, { name });
    if (e === 'stopped') return fill(mains ? G.live.statusStoppedMains : G.live.statusStopped, { name });
    return fill(G.live.statusOther, { name, state: G.engine[e] });
  }

  private engineCard(e: EngineState, stale: boolean) {
    const d = this.device;
    const caps = capsOf(d);
    const v = this.live?.values ?? d.values;
    const rows = engineRows(caps);
    const cell = (k: string): TemplateResult | string => {
      switch (k) {
        case 'state': return html`<span class="chip c-${toneOfEngine(e) === 'ok' ? 'ok' : toneOfEngine(e) === 'err' ? 'err' : toneOfEngine(e) === 'warn' ? 'warn' : 'mut'}">${G.engine[e]}</span>`;
        case 'mode': { const m = str(v, 'controller_mode'); return m ? html`${G.modes[m as keyof typeof G.modes] ?? m}${m !== 'auto' && m !== 'test' ? html` <span class="chip c-warn nodot">${G.notAuto}</span>` : nothing}` : '-'; }
        case 'hours': return html`<span class="num">${fmtNum(num(v, 'run_hours'), 1)}</span> ${G.rows.hoursUnit}${caps.has('starts') && num(v, 'starts') !== null ? html` · <span class="num">${fmtNum(num(v, 'starts'))}</span> ${G.rows.startsUnit}` : nothing}`;
        case 'rpm': return e === 'running' ? html`<span class="num">${fmtNum(num(v, 'rpm'))}</span>` : '-';
        case 'last_start': { const r = str(v, 'last_start_reason'); return html`<span class="num">${fmtDateTime(str(v, 'last_start_at'))}</span>${r ? ` · ${r}` : ''}`; }
        case 'last_test': { const r = str(v, 'last_test_result'); return html`<span class="num">${fmtDateTime(str(v, 'last_test_at'))}</span>${r ? ` · ${r}` : ''}`; }
        case 'next_test': return html`<span class="num">${fmtDateTime(str(v, 'next_test_at'))}</span>`;
        default: { const h = num(v, 'service_hours_left'); return h === null ? '-' : html`<span class="chip c-${h <= (d.thresholds?.service_warn_h ?? 25) ? 'warn' : 'ok'} nodot">${fill(G.rows.serviceIn, { n: fmtNum(h) })}</span>`; }
      }
    };
    const seen = this.live?.at ?? d.last_seen_at;
    return html`<div class="card ${stale ? 'stale' : ''}" data-card="engine"><div class="hd"><span class="h3">${G.live.engineTitle}</span><div class="sp"></div>
      <span class="last-seen"><sw-icon name="clock" size="14"></sw-icon> ${stale ? fill(G.live.lastSeen, { t: fmtDateTime(d.last_seen_at) }) : fill(G.live.updated, { t: agoText(ageOf(seen, this.tick), G.live.ago) })}</span></div>
      <dl class="kv">${rows.map((k) => html`<dt>${G.rows[k]}</dt><dd>${cell(k)}</dd>`)}</dl>
      ${d.capabilities.values < d.capabilities.values_total ? html`<div class="mut" style="margin-block-start:10px">${fill(G.live.counts, { n: d.capabilities.values, total: d.capabilities.values_total })}${this.manage ? html` · <a class="lnk" href="#/system/infra/generator/mapping?device=${encodeURIComponent(d.id)}">${G.live.mapping}</a>` : nothing}</div>` : nothing}</div>`;
  }

  private phaseCard(t: PhaseTable, stale: boolean, run: boolean) {
    const dash = '-';
    const cell = (c: string, r: PhaseTable['rows'][number]) =>
      c === 'v' ? html`<td class="num">${run && r.v !== null ? `${fmtNum(r.v)} V` : dash}</td>`
      : c === 'a' ? html`<td class="num">${run && r.a !== null ? `${fmtNum(r.a)} A` : dash}</td>`
      : c === 'kw' ? html`<td class="num">${run && r.kw !== null ? `${fmtNum(r.kw)} kW` : dash}</td>`
      : html`<td><div class="pbar"><i class=${(r.pct ?? 0) > 90 ? 'err' : (r.pct ?? 0) > 80 ? 'warn' : ''} style="inline-size:${Math.min(100, run ? r.pct ?? 0 : 0)}%"></i></div></td>`;
    const head = [t.hz !== null && this.device.capabilities.roles.includes('gen_hz') ? html`${G.phase.freq} <span class="num">${run ? `${fmtNum(t.hz, 1)} Hz` : dash}</span>` : nothing, t.pf !== null ? html`${G.phase.pf} <span class="num">${run ? fmtNum(t.pf, 2) : dash}</span>` : nothing];
    return html`<div class="card flush ${stale ? 'stale' : ''}" data-card="phases"><div class="hd"><span class="h3">${t.multi ? G.live.phaseTitle : G.live.phaseTitleOne}</span><div class="sp"></div><span class="mut">${head}</span></div>
      <div class="scrollx"><table class="t phase"><thead><tr><th>${t.multi ? G.phase.phase : ''}</th>${t.cols.map((c) => html`<th>${G.phase[c]}</th>`)}</tr></thead>
      <tbody>${t.rows.map((r) => html`<tr><td class="b">${r.label ? `L${r.label}` : G.phase.generator}</td>${t.cols.map((c) => cell(c, r))}</tr>`)}</tbody>
      ${t.multi ? html`<tfoot><tr><td>${G.phase.total}</td>${t.cols.map((c) => c === 'v' ? html`<td class="num">${run && t.avgV !== null ? `${G.phase.avg} ${fmtNum(t.avgV)} V` : dash}</td>` : c === 'a' ? html`<td class="num">${run && t.sumA !== null ? `${fmtNum(t.sumA)} A` : dash}</td>` : c === 'kw' ? html`<td class="num">${run && t.totalKw !== null ? `${fmtNum(t.totalKw)} kW` : dash}</td>` : html`<td></td>`)}</tr></tfoot>` : nothing}</table></div></div>`;
  }

  render() {
    const d = this.device;
    const caps = capsOf(d);
    const live = this.live;
    const values = live?.values ?? d.values;
    const availability = live?.availability ?? d.availability;
    const plan = flowPlan(values, caps, availability);
    const stale = plan.stale;
    const th = d.thresholds ?? {};
    const gauges = gaugeList(values, caps, th, plan.engine, d.rated_kw);
    const table = phaseTable(values, caps, d.rated_kva);
    const kpis = this.phone ? phoneKpis(values, caps) : [];
    const banner = availability === 'offline'
      ? html`<div class="banner err" role="alert" data-banner="offline"><sw-icon name="warning" size="18"></sw-icon><b>${G.live.offlineTitle}</b><span>${fill(G.live.lastSeen, { t: fmtDateTime(d.last_seen_at) })} · ${G.live.offlineBody}</span></div>`
      : availability === 'stale' ? html`<div class="banner" role="status" data-banner="stale"><sw-icon name="warning" size="18"></sw-icon><b>${G.live.staleTitle}</b><span>${G.live.staleBody}</span></div>` : nothing;
    const chip = !plan.showMains || plan.mainsOn === null ? nothing
      : plan.onGen && plan.showAts ? html`<span class="sev alert">${G.live.mainsLostChip}</span>` : plan.mode === 'test' ? html`<span class="sev info">${G.live.testChip}</span>` : plan.mainsOn ? html`<span class="sev cleared">${G.live.mainsOkChip}</span>` : html`<span class="sev alert">${G.live.mainsLostChip}</span>`;
    const pulse = toneOfEngine(plan.engine);
    const status = this.statusText(d.name, plan.engine, plan.onGen, plan.mode, plan.mainsOn, plan.showAts);
    const modeSwitch = (gauges.length || caps.size) ? html`<div class="row"><span class="h3">${this.view === 'gauges' ? G.live.viewGauges : G.live.historyTitle}</span><div class="sp"></div>
      ${this.view === 'charts' ? html`<div class="seg" role="group" aria-label=${G.charts.title} data-range>${RANGE_SET.map((r) => html`<button aria-pressed=${this.range === r} @click=${() => (this.range = r)}>${G.charts.ranges[r]}</button>`)}</div>
        <a class="btn sm" href="#/infra/generator/charts?device=${encodeURIComponent(d.id)}" data-full-view><sw-icon name="expand" size="16"></sw-icon> ${G.live.fullView}</a>` : nothing}
      <div class="seg" role="group" aria-label=${G.live.viewLabel} data-view-mode><button aria-pressed=${this.view === 'gauges'} @click=${() => this.setView('gauges')}>${G.live.viewGauges}</button><button aria-pressed=${this.view === 'charts'} @click=${() => this.setView('charts')}>${G.live.viewCharts}</button></div></div>` : nothing;
    const dials = gauges.length ? html`<div class="gauges n${gauges.length} ${stale ? 'stale' : ''}" data-view="gauges">${gauges.map(gaugeSvg)}</div>` : nothing;
    const charts = html`<gen-chart-set data-view="charts" .deviceId=${d.id} .roles=${d.capabilities.roles} .range=${this.range} mode="cards" @metric-open=${(e: CustomEvent<string>) => navigate(`/infra/generator/charts`, { device: d.id, metric: e.detail })}></gen-chart-set>`;
    return html`<div class="col" data-gen-live data-availability=${availability}>
      ${banner}
      <div class="status-strip"><span class="big" data-status><span class="pulse ${pulse}"></span>${status}</span>
        <span class="mut">${[d.area_name, d.rated_kva ? `${fmtNum(d.rated_kva)} kVA` : ''].filter(Boolean).join(' · ')}</span><div class="sp"></div>
        ${stale ? nothing : html`<span class="last-seen"><sw-icon name="clock" size="14"></sw-icon> ${G.live.dataLive}</span>`}</div>
      ${kpis.length ? html`<div class="kpi-row" data-kpis>${kpis.map((k) => html`<div class="kpi"><div class="k">${(G.kpi as Record<string, string>)[k.role]}</div><div class="v num">${fmtNum(k.value, k.digits)}${k.unit}</div></div>`)}</div>` : nothing}
      <div class="hero">
        <div class="card hero-card ${stale ? 'stale' : ''}" data-card="flow"><div class="hd"><span class="h3">${G.live.flowTitle}</span><div class="sp"></div>${chip}</div>${flowSvg(plan, { id: 'live', vertical: this.phone, name: d.name, still: window.matchMedia('(prefers-reduced-motion: reduce)').matches })}</div>
        ${this.engineCard(plan.engine, stale)}
      </div>
      ${modeSwitch}
      ${this.view === 'gauges' ? dials : charts}
      ${table ? this.phaseCard(table, stale, plan.engine === 'running') : nothing}
    </div>`;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'gen-live-page': GenLivePage;
  }
}
