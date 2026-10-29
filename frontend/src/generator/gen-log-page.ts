import { LitElement, html, css, nothing } from 'lit';
import { customElement, property, state } from 'lit/decorators.js';
import '../components/sw-icon';
import '../components/sw-state-panel';
import { getRuns, type GenDevice, type GenRun, type RunKind, type RunRange, type RunsResponse } from '../api/generator';
import { describeError } from '../api/client';
import { elecCss } from '../electricity/styles';
import { SkinController } from '../design/skin';
import { genCss } from './gen-styles';
import { fmtDateTime, fmtNum } from './gen-logic';
import { glt, type GltKey } from '../i18n/generator-log';

const RANGES: RunRange[] = ['7d', '30d', '90d', '365d'];
const KINDS: RunKind[] = ['test', 'mains_failure', 'manual', 'other'];
const KIND_TONE: Record<RunKind, string> = { test: 'info', mains_failure: 'alert', manual: 'mut', other: 'mut' };
/** Rows per page from the viewport height: the page fits it - a pager, never a scrolling list (owner rule: no scrolling in control screens). */
export const pageSizeFor = (h: number): number => Math.max(4, Math.min(12, Math.floor((h - 470) / 50)));
const POLL_MS = 30_000;

export const durText = (s: number): string => {
  const m = Math.max(0, Math.round(s / 60));
  if (m < 60) return `${m} ${glt('min')}`;
  return `${Math.floor(m / 60)}:${String(m % 60).padStart(2, '0')} ${glt('h')}`;
};
const kindChip = (k: RunKind) => html`<span class="sev ${KIND_TONE[k]}" data-kind=${k}>${glt(`kind_${k}` as GltKey)}</span>`;

/**
 * תשתיות › גנרטור › יומן הפעלות (GENLOG092-295, board row r092): the run log of the selected generator - a summary strip (runs per kind, run
 * hours, fuel used, refills, the last test and when the next is due), the run in progress, one page of runs (start, kind with the signal
 * that decided it, duration, hours, fuel, load, end) with a pager, and the latest fuel events. Everything is derived on the server from the
 * controller's readings: view only, nothing is sent to the controller. Shown only while the run-log switch is on (default off).
 */
@customElement('gen-log-page')
export class GenLogPage extends LitElement {
  readonly bubbleSkin = new SkinController(this);
  @property({ attribute: false }) device!: GenDevice;
  @state() private range: RunRange = '30d';
  @state() private kind: RunKind | '' = '';
  @state() private page = 1;
  @state() private data: RunsResponse | null = null;
  @state() private phase: 'loading' | 'ready' | 'error' = 'loading';
  @state() private error = '';
  private timer = 0;
  private seq = 0;

  static styles = [elecCss, genCss, css`
    :host { display: block; }
    .lg { display: grid; gap: 12px; }
    .lg .kpi .v small { font-size: var(--sw-fs-xs); font-weight: 400; color: var(--sw-text-2); }
    .lg .kpi .s { font-size: var(--sw-fs-xs); color: var(--sw-text-2); overflow-wrap: anywhere; }
    .lg .split { display: grid; grid-template-columns: minmax(0, 3fr) minmax(220px, 1fr); gap: 12px; align-items: start; }
    /* GATE-FIX-2270: the R5 round grew the severity chip (13 px, 20 px line) and the KPI figures, so the page of runs sized for the
       viewport ran 23 px past a 1024 x 768 screen (a control screen never scrolls): the run rows take 2 px less block padding and
       the pager - whose buttons are 44 px under 1100 px - drops its own block padding */
    .lg .pager { display: flex; gap: 8px; align-items: center; justify-content: flex-end; padding: 2px 12px; }
    .lg .fe { display: grid; gap: 6px; padding: 10px 12px; font-size: var(--sw-fs-sm); }
    .lg .fe > div { display: flex; justify-content: space-between; gap: 8px; }
    .lg td .why { display: block; font-size: var(--sw-fs-2xs); color: var(--sw-text-3); }
    .lg .seg button { white-space: nowrap; }
    .lg .row select { inline-size: auto; min-inline-size: 150px; flex: none; }
    .lg table.t td { padding: 5px 12px; }
    @media (max-width: 900px) { .lg .split { grid-template-columns: minmax(0, 1fr); } }
    /* the phone keeps start, kind, duration and fuel: no sideways scrolling either */
    @media (max-width: 767px) { .lg table.t th:nth-child(4), .lg table.t td:nth-child(4), .lg table.t th:nth-child(6), .lg table.t td:nth-child(6), .lg table.t th:nth-child(7), .lg table.t td:nth-child(7) { display: none; } }
  `];

  connectedCallback() {
    super.connectedCallback();
    this.timer = window.setInterval(() => { if (!document.hidden) void this.load(true); }, POLL_MS);
  }
  disconnectedCallback() {
    window.clearInterval(this.timer);
    super.disconnectedCallback();
  }
  protected updated(c: Map<string, unknown>) {
    if (c.has('device')) { this.page = 1; void this.load(); }
  }

  private async load(quiet = false) {
    if (!this.device) return;
    const my = ++this.seq;
    if (!quiet) this.phase = 'loading';
    try {
      const r = await getRuns(this.device.id, { range: this.range, kind: this.kind, page: this.page, page_size: pageSizeFor(window.innerHeight) });
      if (my !== this.seq) return;
      this.data = r;
      this.phase = 'ready';
    } catch (e) {
      if (my !== this.seq) return;
      this.error = describeError(e);
      if (!quiet || !this.data) this.phase = 'error';
    }
  }
  private set(p: Partial<{ range: RunRange; kind: RunKind | ''; page: number }>) {
    if (p.range !== undefined) this.range = p.range;
    if (p.kind !== undefined) this.kind = p.kind;
    this.page = p.page ?? 1;
    void this.load(true);
  }

  private strip(d: RunsResponse) {
    const s = d.summary;
    const lt = s.last_test;
    return html`<div class="kpi-row" data-log-kpis>
      <div class="kpi" data-kpi="runs"><div class="k">${glt('kpiRuns')}</div><div class="v num">${s.runs}</div>
        <div class="s">${glt('byKind', { t: s.by_kind.test, m: s.by_kind.mains_failure, o: s.by_kind.manual + s.by_kind.other })}</div></div>
      <div class="kpi" data-kpi="hours"><div class="k">${glt('kpiHours')}</div><div class="v num">${fmtNum(s.hours, 1)}</div>
        ${s.counters.run_hours !== null ? html`<div class="s">${glt('kpiCounter')}: <span class="num">${fmtNum(s.counters.run_hours, 1)}</span></div>` : nothing}</div>
      <div class="kpi" data-kpi="fuel"><div class="k">${glt('kpiFuel')}</div><div class="v num">${fmtNum(s.fuel_used_pct, 0)}<small>%</small></div>
        ${s.fuel_used_l !== null ? html`<div class="s num">${fmtNum(s.fuel_used_l, 0)} L</div>` : nothing}</div>
      <div class="kpi" data-kpi="refills"><div class="k">${glt('kpiRefills')}</div><div class="v num">${s.refills}</div>
        ${s.refills ? html`<div class="s num">+${fmtNum(s.refilled_pct, 0)}%</div>` : nothing}</div>
      <div class="kpi" data-kpi="test"><div class="k">${glt('kpiLastTest')}</div>
        <div class="v" style="font-size:var(--sw-fs-md)">${lt ? html`<span class="num">${fmtDateTime(lt.started_at)}</span>` : glt('noTest')}</div>
        <div class="s">${s.test_overdue ? html`<span class="sev alert" data-test-overdue>${glt('testOverdue')}</span>` : s.next_test_due ? glt('testDue', { t: fmtDateTime(s.next_test_due) }) : nothing}</div></div>
    </div>`;
  }

  private row(r: GenRun) {
    const fuel = r.fuel_used_pct !== null ? `${fmtNum(r.fuel_used_pct, 0)}%${r.fuel_used_l !== null ? ` · ${fmtNum(r.fuel_used_l, 0)} L` : ''}` : '-';
    const load = r.took_load ? (r.peak_load_pct !== null ? glt('loadPeak', { n: fmtNum(r.peak_load_pct, 0) }) : glt('loaded')) : glt('noLoad');
    return html`<tr data-run=${r.id}><td class="num">${fmtDateTime(r.started_at)}</td>
      <td>${kindChip(r.kind)}${r.short ? html` <span class="sev mut">${glt('short')}</span>` : nothing}<span class="why">${glt(`why_${r.kind_reason ?? 'none'}` as GltKey)}</span></td>
      <td class="num">${durText(r.duration_s)}</td><td class="num">${fmtNum(r.hours, 2)}</td><td class="num">${fuel}</td><td>${load}</td>
      <td class="num">${r.open ? html`<span class="sev info">${glt('open')}</span>` : html`${fmtDateTime(r.ended_at)}${r.end_reason === 'no_data' ? html`<span class="why">${glt('noData')}</span>` : nothing}`}</td></tr>`;
  }

  render() {
    if (this.phase === 'loading' && !this.data) return html`<div class="col" data-state="loading"><div class="skl" style="inline-size:240px"></div><div class="skl" style="block-size:72px"></div><div class="skl" style="block-size:220px"></div></div>`;
    if (this.phase === 'error' && !this.data) return html`<sw-state-panel state="error" heading=${glt('loadError')} hint=${this.error} data-state="error"></sw-state-panel>`;
    const d = this.data!;
    const cur = d.summary.current;
    return html`<div class="lg" data-gen-log>
      <div class="row"><span class="h2">${glt('title')}</span><div class="sp"></div>
        <div class="seg" role="group" aria-label=${glt('title')} data-log-range>${RANGES.map((r) => html`<button aria-pressed=${String(this.range === r)} data-range=${r} @click=${() => this.set({ range: r })}>${glt(`r${r}` as GltKey)}</button>`)}</div>
        <select aria-label=${glt('colKind')} .value=${this.kind} data-log-kind @change=${(e: Event) => this.set({ kind: (e.target as HTMLSelectElement).value as RunKind | '' })}>
          <option value="" ?selected=${this.kind === ''}>${glt('kindAll')}</option>${KINDS.map((k) => html`<option value=${k} ?selected=${this.kind === k}>${glt(`kind_${k}` as GltKey)}</option>`)}</select></div>
      ${this.strip(d)}
      ${cur ? html`<div class="notice" data-log-current><sw-icon name="bolt" size="18"></sw-icon><span>${glt('runningNow', { kind: glt(`kind_${cur.kind}` as GltKey), d: durText(cur.duration_s) })}</span></div>` : nothing}
      <div class="split">
        <div class="card flush" data-log-runs>${d.runs.length ? html`
          <table class="t"><thead><tr><th>${glt('colStart')}</th><th>${glt('colKind')}</th><th>${glt('colDur')}</th><th>${glt('colHours')}</th><th>${glt('colFuel')}</th><th>${glt('colLoad')}</th><th>${glt('colEnd')}</th></tr></thead>
            <tbody>${d.runs.map((r) => this.row(r))}</tbody></table>
          ${d.pages > 1 ? html`<div class="pager" data-log-pager><span class="mut">${glt('page_of', { p: d.page, n: d.pages })}</span>
            <button class="btn sm" ?disabled=${d.page <= 1} data-log-prev @click=${() => this.set({ page: d.page - 1 })}>${glt('prev')}</button>
            <button class="btn sm" ?disabled=${d.page >= d.pages} data-log-next @click=${() => this.set({ page: d.page + 1 })}>${glt('next')}</button></div>` : nothing}`
          : html`<div class="empty" data-state="empty"><div class="ic"><sw-icon name="clock" size="26"></sw-icon></div><h3>${glt('empty')}</h3><div class="mut">${glt('emptyBody')}</div></div>`}</div>
        <div class="card flush" data-log-fuel><div class="hd" style="padding:10px 12px 0"><span class="h3">${glt('fuelTitle')}</span></div>
          <div class="fe">${d.fuel_events.length ? d.fuel_events.slice(0, 5).map((f) => html`<div data-fuel=${f.kind}><span>${glt(f.kind === 'refill' ? 'fuelRefill' : 'fuelDrop', { a: fmtNum(f.from_pct, 0), b: fmtNum(f.to_pct, 0) })}</span><span class="mut num">${fmtDateTime(f.started_at)}</span></div>`)
            : html`<span class="mut">${glt('fuelNone')}</span>`}</div></div>
      </div></div>`;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'gen-log-page': GenLogPage;
  }
}
