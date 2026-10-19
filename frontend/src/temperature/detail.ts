import { LitElement, html, css, nothing } from 'lit';
import { customElement, property, state, query } from 'lit/decorators.js';
import '../components/sw-icon';
import { describeError } from '../api/client';
import { ackUnit, clearLearned, decideWindow, getHistory, listEvents, muteUnit, unmuteUnit, type HistoryResponse, type RangeKey, type TempEvent, type TempUnit } from '../api/temperature';
import { LOOK_OF, STATUS_ICON, STATUS_KEY, TEMPERATURE_HREF, chipsOf, deg, doorRuns, durationText, eventText, fmt1, hhmm, hvacText, stateRuns, windowText, type Run } from './model';
import { bigChart, bigFrame, gauge, ring, spark, type BigChartData } from './charts';
import { tempCss } from './styles';
import { tt, type TtKey } from '../i18n/temperature';

const WIDE_KEY = 'sw.temperature.detailWide';
const MUTES = [15, 30, 60, 120];

function readWide(): boolean {
  try {
    return localStorage.getItem(WIDE_KEY) === '1';
  } catch {
    return false;
  }
}

/**
 * CR-INFRA-TEMPERATURE 2.9.1: one unit's detail (a side sheet, expandable to the full width - the choice is remembered in this browser). Owner
 * decision 1: the card gauge AND the 24-hour ring are both kept. Panels: the head (gauge, chips, sensors by friendly name - the technical id only
 * for a manager, rules, and for a climate unit its mode / action / setpoint), the chart (24 h / 7 days / 30 days; band, door openings,
 * defrost windows, the setpoint step line, out-of-range in the alarm colour; hover / touch shows the reading), the statistics (out of range
 * excludes defrost time - owner decision 3), the 24-hour timeline bars, the comparison with the other units, the ring, the defrost panel
 * (learned windows: confirm / reject / clear for a manager) and the recent events. Footer: acknowledge, mute warnings (alarms never), edit.
 */
@customElement('temp-detail')
export class TempDetail extends LitElement {
  @property({ attribute: false }) unit!: TempUnit;
  @property({ attribute: false }) units: TempUnit[] = [];
  @property({ type: Boolean }) canAck = false;
  @property({ type: Boolean }) canManage = false;
  @property({ type: Boolean }) stale = false;
  @state() private range: RangeKey = '24h';
  @state() private hist: HistoryResponse | null = null;
  @state() private histError = '';
  @state() private events: TempEvent[] = [];
  @state() private wide = readWide();
  @state() private muteOpen = false;
  @state() private busy = false;
  @state() private err = '';
  @state() private chartW = 560;
  @state() private cross: { x: number; y: number | null; i: number } | null = null;
  @query('.bigchart') private chartBox?: HTMLElement;
  private ro?: ResizeObserver;
  private loadedFor = '';

  static styles = [tempCss, css`
    :host { position: fixed; inset: 0; z-index: var(--sw-z-modal); display: block; }
    .ovl { position: absolute; inset: 0; background: var(--sw-overlay); }
    .drawer {
      position: absolute; inset-block: 0; inset-inline-end: 0; inline-size: min(560px, 100vw); background: var(--sw-bg); box-shadow: var(--sw-shadow-3);
      display: flex; flex-direction: column; min-block-size: 0;
    }
    .drawer.wide { inline-size: min(1240px, 100vw); }
    .dh { display: flex; align-items: center; gap: 10px; padding: 14px 16px; border-block-end: 1px solid var(--sw-border); background: var(--sw-surface); }
    .dh h2 { margin: 0; font-size: var(--sw-fs-xl); }
    .dh small { color: var(--sw-text-2); font-size: var(--sw-fs-xs); }
    .dh .t { flex: 1; min-inline-size: 0; }
    .icb { inline-size: 36px; block-size: 36px; padding: 0; justify-content: center; }
    .db { flex: 1; overflow: auto; padding: 14px 16px; display: grid; gap: 12px; align-content: start; }
    .wide .db { grid-template-columns: minmax(0, 1.7fr) minmax(300px, 1fr); }
    .col { display: grid; gap: 12px; align-content: start; min-inline-size: 0; }
    .df { display: flex; gap: 8px; flex-wrap: wrap; align-items: center; padding: 10px 16px calc(10px + env(safe-area-inset-bottom)); border-block-start: 1px solid var(--sw-border); background: var(--sw-surface); position: relative; }
    .df .sp { flex: 1; }
    .headrow { display: flex; gap: 16px; align-items: center; }
    .summ { display: grid; gap: 4px; font-size: var(--sw-fs-sm); }
    .summ > div { display: flex; gap: 10px; justify-content: space-between; border-block-end: 1px solid var(--sw-border); padding-block: 5px; }
    .summ > div > span { color: var(--sw-text-2); flex: none; }
    .summ b { font-weight: var(--sw-fw-medium); text-align: end; min-inline-size: 0; }
    .seg { display: inline-flex; background: var(--sw-surface-2); border-radius: var(--sw-r-pill); padding: 3px; gap: 2px; }
    .seg button { border: 0; background: transparent; border-radius: var(--sw-r-pill); padding: 4px 12px; font: inherit; font-size: var(--sw-fs-sm); color: var(--sw-text-2); cursor: pointer; }
    .seg button[aria-pressed='true'] { background: var(--sw-surface); color: var(--sw-text); box-shadow: var(--sw-shadow-1); font-weight: var(--sw-fw-semibold); }
    .ph { display: flex; align-items: center; gap: 10px; flex-wrap: wrap; margin-block-end: 8px; }
    .ph h4 { flex: 1; }
    .bigchart { position: relative; block-size: 250px; touch-action: pan-y; }
    .bigchart svg { inline-size: 100%; block-size: 100%; display: block; }
    .tip {
      position: absolute; pointer-events: none; transform: translate(-50%, -115%); background: var(--sw-surface-solid); border: 1px solid var(--sw-border);
      border-radius: var(--sw-r-sm); padding: 6px 9px; box-shadow: var(--sw-shadow-2); font-size: var(--sw-fs-xs); white-space: nowrap; direction: ltr;
    }
    .tip b { font-size: var(--sw-fs-md); }
    .stat4 { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 8px; margin-block-start: 10px; }
    .stat4 > div { background: var(--sw-surface-2); border-radius: var(--sw-r-sm); padding: 8px 10px; display: grid; gap: 2px; }
    .stat4 span { font-size: var(--sw-fs-xs); color: var(--sw-text-2); }
    .stat4 b { font-size: var(--sw-fs-lg); }
    .stat4 small { font-size: var(--sw-fs-2xs); color: var(--sw-text-3); }
    .tlrow { display: grid; gap: 4px; margin-block-end: 10px; }
    .tlrow .lbl { display: flex; justify-content: space-between; gap: 8px; font-size: var(--sw-fs-xs); color: var(--sw-text-2); flex-wrap: wrap; }
    .cmp { display: grid; gap: 8px; }
    .ci { display: grid; grid-template-columns: minmax(0, 1fr) minmax(0, 1.4fr) auto; gap: 10px; align-items: center; padding: 6px 8px; border-radius: var(--sw-r-sm); border: 0; background: transparent; font: inherit; color: inherit; text-align: start; cursor: pointer; }
    .ci:hover { background: var(--sw-hover-wash); }
    .ci small { display: block; color: var(--sw-text-3); font-size: var(--sw-fs-2xs); }
    .ci .spark { block-size: 30px; }
    .ci .o { font-size: var(--sw-fs-xs); color: var(--sw-text-2); white-space: nowrap; }
    .ringrow { display: flex; gap: 16px; align-items: center; }
    .ring { inline-size: 150px; block-size: 150px; flex: none; }
    .ring svg { inline-size: 100%; block-size: 100%; }
    .events { display: grid; }
    .ev { display: grid; grid-template-columns: auto minmax(0, 1fr) auto; gap: 10px; align-items: center; padding-block: 8px; border-block-end: 1px solid var(--sw-border); font-size: var(--sw-fs-sm); }
    .ev time { color: var(--sw-text-2); font-variant-numeric: tabular-nums; }
    .ev i { display: inline-block; inline-size: 8px; block-size: 8px; border-radius: 50%; background: var(--c, var(--sw-accent)); margin-inline-end: 6px; }
    .wins { display: grid; gap: 6px; }
    .win { display: flex; align-items: center; gap: 8px; flex-wrap: wrap; font-size: var(--sw-fs-sm); }
    .win .w { font-variant-numeric: tabular-nums; direction: ltr; }
    .pop {
      position: absolute; inset-block-end: calc(100% + 6px); inset-inline-start: 16px; background: var(--sw-menu-surface); border: 1px solid var(--sw-menu-border);
      border-radius: var(--sw-r-md); box-shadow: var(--sw-shadow-3); padding: 6px; display: grid; min-inline-size: 220px; z-index: 1;
    }
    .pop .hd { padding: 6px 10px; font-weight: var(--sw-fw-semibold); font-size: var(--sw-fs-sm); }
    .pop .nt { padding: 0 10px 6px; font-size: var(--sw-fs-xs); color: var(--sw-text-2); }
    .pop button { display: flex; justify-content: space-between; gap: 16px; border: 0; background: transparent; padding: 8px 10px; border-radius: var(--sw-r-sm); font: inherit; color: inherit; cursor: pointer; text-align: start; }
    .pop button:hover { background: var(--sw-hover-wash); }
    .err { color: var(--sw-danger-text); font-size: var(--sw-fs-sm); }
    @media (max-width: 900px) {
      .wide .db { grid-template-columns: minmax(0, 1fr); }
    }
    @media (max-width: 600px) {
      .drawer, .drawer.wide { inline-size: 100vw; }
      .headrow { flex-direction: column; align-items: stretch; }
      .headrow > .gauge { align-self: center; }
      .stat4 { grid-template-columns: repeat(2, minmax(0, 1fr)); }
      .ringrow { flex-direction: column; }
    }
  `];

  private onKey = (e: KeyboardEvent) => {
    if (e.key === 'Escape') {
      if (this.muteOpen) this.muteOpen = false;
      else this.close();
    }
  };

  connectedCallback() {
    super.connectedCallback();
    window.addEventListener('keydown', this.onKey);
  }

  disconnectedCallback() {
    window.removeEventListener('keydown', this.onKey);
    this.ro?.disconnect();
    super.disconnectedCallback();
  }

  firstUpdated() {
    this.renderRoot.querySelector<HTMLElement>('[data-temp-close]')?.focus({ preventScroll: true });
  }

  updated(changed: Map<string, unknown>) {
    if (this.unit && this.loadedFor !== `${this.unit.id}:${this.range}`) {
      this.loadedFor = `${this.unit.id}:${this.range}`;
      void this.loadHistory();
      if (changed.has('unit') && (changed.get('unit') as TempUnit | undefined)?.id !== this.unit.id) void this.loadEvents();
    }
    const box = this.chartBox;
    if (box && !this.ro) {
      this.ro = new ResizeObserver(() => {
        const w = Math.round(box.clientWidth);
        if (w > 0 && Math.abs(w - this.chartW) > 2) this.chartW = w;
      });
      this.ro.observe(box);
    }
  }

  private close() {
    this.dispatchEvent(new CustomEvent('close'));
  }

  private async loadHistory() {
    const id = this.unit.id;
    try {
      const h = await getHistory(id, this.range, undefined, undefined, Math.max(200, Math.min(1200, this.chartW)));
      if (this.unit.id === id) {
        this.hist = h;
        this.histError = '';
      }
    } catch (e) {
      this.histError = describeError(e);
    }
  }

  private async loadEvents() {
    const id = this.unit.id;
    try {
      const r = await listEvents({ unit: id, range: '24h', limit: 8 });
      if (this.unit.id === id) this.events = r.events;
    } catch {
      this.events = [];
    }
  }

  private async act(fn: () => Promise<unknown>, okKey: TtKey, vars?: Record<string, string>) {
    this.busy = true;
    this.err = '';
    try {
      await fn();
      this.dispatchEvent(new CustomEvent('changed', { detail: tt(okKey, vars) }));
      void this.loadEvents();
    } catch (e) {
      this.err = describeError(e);
    } finally {
      this.busy = false;
    }
  }

  private toggleWide() {
    this.wide = !this.wide;
    try {
      localStorage.setItem(WIDE_KEY, this.wide ? '1' : '0');
    } catch {
      /* per-browser convenience only */
    }
    this.ro?.disconnect();
    this.ro = undefined;
  }

  private chartData(): BigChartData | null {
    const h = this.hist;
    if (!h) return null;
    return {
      points: h.points.map((p) => [p[0], p[1]] as [number, number]), setpoints: this.unit.source === 'climate' ? h.points.map((p) => [p[0], p[5]] as [number, number | null]) : undefined,
      low: this.unit.low, high: this.unit.high, doors: h.doors, defrost: h.defrost, t0: h.from, t1: h.to, step: h.step,
    };
  }

  private hover(e: PointerEvent, dt: BigChartData) {
    const box = this.chartBox;
    if (!box || !dt.points.length) return;
    const rect = box.getBoundingClientRect();
    const f = bigFrame(dt, this.chartW, 250);
    const px = ((e.clientX - rect.left) / rect.width) * this.chartW;
    const t = f.t0 + ((px - f.ml) / (this.chartW - f.ml - f.mr)) * (f.t1 - f.t0);
    let best = 0;
    for (let i = 1; i < dt.points.length; i++) if (Math.abs(dt.points[i][0] - t) < Math.abs(dt.points[best][0] - t)) best = i;
    const p = dt.points[best];
    const x = f.ml + ((p[0] - f.t0) / Math.max(1, f.t1 - f.t0)) * (this.chartW - f.ml - f.mr);
    const y = f.mt + ((f.hi - p[1]) / Math.max(1e-9, f.hi - f.lo)) * (250 - f.mt - f.mb);
    this.cross = { x, y, i: best };
  }

  private tip(dt: BigChartData, lang: string) {
    if (!this.cross) return nothing;
    const p = dt.points[this.cross.i];
    if (!p) return nothing;
    const ms = p[0] * 1000;
    const inDoor = dt.doors.some(([a, b]) => p[0] >= a && p[0] <= b);
    const inDef = dt.defrost.some(([a, b]) => p[0] >= a && p[0] <= b);
    const sp = dt.setpoints?.[this.cross.i]?.[1] ?? null;
    const out = p[1] > dt.high || p[1] < dt.low;
    const day = this.range === '24h' ? '' : `${new Date(ms).toLocaleDateString(lang, { day: 'numeric', month: 'numeric' })} · `;
    return html`<div class="tip" style=${`inset-inline-start:${(this.cross.x / this.chartW) * 100}%;inset-block-start:${((this.cross.y ?? 20) / 250) * 100}%`} data-temp-tip>
      <div>${day}<span class="num">${hhmm(ms, lang)}</span></div><b class="num">${fmt1(p[1])} °C</b>
      ${sp !== null ? html`<div>${tt('lgSetpoint')}: ${deg(sp)}</div>` : nothing}
      ${inDoor ? html`<div>${tt('lgDoor')}</div>` : nothing}${inDef ? html`<div>${tt('lgDefrost')}</div>` : nothing}${out ? html`<div class="err">${tt('lgOut')}</div>` : nothing}
    </div>`;
  }

  private rulesLine(u: TempUnit): string {
    const r = u.rules;
    const parts: string[] = [];
    if (u.door && r.door_alarm) parts.push(tt('ruleDoorShort', { x: r.door_alarm_min }));
    if (r.high_alarm) parts.push(tt('ruleHighShort', { t: deg(u.high), z: r.high_alarm_min }));
    if (r.low_alarm) parts.push(tt('ruleLowShort', { t: deg(u.low), z: r.low_alarm_min }));
    if (r.offline_warn) parts.push(tt('ruleOffShort', { n: r.offline_min }));
    if (r.quiet_enabled) parts.push(tt('ruleQuietShort', { a: r.quiet_from, b: r.quiet_to }));
    return parts.join(' · ');
  }

  private bars(u: TempUnit, now: number) {
    const lo = now - 86400_000;
    const door: Run[] = doorRuns(u.doors_24h ?? [], lo, now);
    const st: Run[] = stateRuns((u.spark ?? []).map((p) => [p[0], p[1]] as [number, number]), u.low, u.high, lo, now, u.defrost_24h ?? []);
    const s = u.stats_24h;
    const lang = document.documentElement.lang || 'he-IL';
    return html`
      ${u.door !== null || (u.doors_24h ?? []).length ? html`<div class="tlrow"><div class="lbl"><span>${tt('tlDoor')}</span><span>${tt('doorSummary', { n: s.door_opens, t: durationText(s.door_total_min), l: s.door_longest_min })}</span></div>
        <div class="tl" role="img" aria-label=${tt('tlDoor')} data-temp-doorbar>${door.map((r) => html`<span data-k=${r.k} style=${`flex:${r.pct.toFixed(2)}`}></span>`)}</div></div>` : nothing}
      <div class="tlrow"><div class="lbl"><span>${tt('tlTemp')}</span><span>${s.out_min ? tt('outOfRange', { d: durationText(s.out_min) }) : tt('allInRange')}</span></div>
        <div class="tl" role="img" aria-label=${tt('tlTemp')} data-temp-statebar>${st.map((r) => html`<span data-k=${r.k} style=${`flex:${r.pct.toFixed(2)}`}></span>`)}</div></div>
      <div class="axis"><span>${hhmm(lo, lang)}</span><span>${hhmm(lo + 6 * 3600_000, lang)}</span><span>${hhmm(lo + 12 * 3600_000, lang)}</span><span>${hhmm(lo + 18 * 3600_000, lang)}</span><span>${tt('now')}</span></div>
      <div class="legend"><span><i data-k="door"></i>${tt('lgDoor')}</span><span><i data-k="ok"></i>${tt('ringOk')}</span><span><i data-k="warn"></i>${tt('ringWarn')}</span><span><i data-k="alarm"></i>${tt('ringAlarm')}</span>${u.defrost.mode !== 'none' ? html`<span><i data-k="defrost"></i>${tt('lgDefrost')}</span>` : nothing}</div>`;
  }

  private defrostPanel(u: TempUnit) {
    const d = u.defrost;
    if (d.mode === 'none') return nothing;
    const stKey: Record<string, TtKey> = { learned: 'wLearned', confirmed: 'wConfirmed', rejected: 'wRejected', fixed: 'wFixed' };
    const head = d.mode === 'fixed' ? tt('modeFixed') : d.state === 'learning' ? tt('stLearning', { d: Math.floor(d.days), n: u.rules.learn_min_repeats ?? 3 }) : d.state === 'learned' ? tt('stLearned') : d.state === 'none_found' ? tt('stNoneFound') : tt('modeLearn');
    return html`<div class="panel" data-temp-defrost><div class="ph"><h4>${tt('defrostTitle')}</h4><span class="chip" data-tone="acc">${d.mode === 'fixed' ? tt('modeFixed') : tt('modeLearn')}</span></div>
      <p class="hint" style="margin:0 0 8px">${head}</p>
      <div class="wins">${d.windows.map((w) => html`<div class="win" data-window=${w.start_min} data-status=${w.status}><sw-icon name="snow" size="14"></sw-icon><span class="w">${windowText(w)}</span>
        <span class="chip" data-tone=${w.status === 'rejected' ? 'mut' : w.status === 'confirmed' ? 'ok' : 'acc'}>${tt(stKey[w.status] ?? 'wLearned')}</span>${w.repeats ? html`<span class="hint">${tt('wRepeats', { n: w.repeats })}</span>` : nothing}
        ${this.canManage && w.status === 'learned' ? html`<span style="flex:1"></span><button type="button" class="btn sm" ?disabled=${this.busy} data-window-confirm @click=${() => this.act(() => decideWindow(u.id, w.start_min, 'confirm'), 'saved')}>${tt('confirm')}</button>
          <button type="button" class="btn sm ghost" ?disabled=${this.busy} data-window-reject @click=${() => this.act(() => decideWindow(u.id, w.start_min, 'reject'), 'saved')}>${tt('reject')}</button>` : nothing}</div>`)}</div>
      ${this.canManage && d.mode === 'learn' && d.windows.length ? html`<button type="button" class="btn sm ghost" style="margin-top:8px" ?disabled=${this.busy} data-learn-clear
          @click=${() => { if (window.confirm(tt('clearConfirm'))) void this.act(() => clearLearned(u.id), 'saved'); }}>${tt('clearLearned')}</button>` : nothing}
    </div>`;
  }

  render() {
    const u = this.unit;
    if (!u) return nothing;
    const now = Date.now();
    const lang = document.documentElement.lang || 'he-IL';
    const st = this.stale ? 'unknown' : u.status;
    const look = LOOK_OF[st];
    const chips = chipsOf(u, now, lang);
    const dt = this.chartData();
    const s = this.hist?.stats ?? u.stats_24h;
    const ackable = u.events.some((e) => (e.severity === 'alarm' || e.severity === 'warning') && !e.ack_at);
    const sensorLine = (name: string, id: string | null | undefined) => html`${name || '—'}${this.canManage && id ? html` <span class="mono ltr" title=${id}>${id}</span>` : nothing}`;
    const others = this.units.filter((x) => x.id !== u.id);
    const sevC: Record<string, string> = { alarm: 'var(--tc-alarm)', warning: 'var(--tc-warn)', info: 'var(--tc-acc)' };
    return html`<div class="ovl" @click=${() => this.close()}></div>
      <aside class="drawer ${this.wide ? 'wide' : ''}" role="dialog" aria-modal="true" aria-labelledby="d-title" data-temp-detail=${u.id}>
        <div class="dh"><div class="t"><h2 id="d-title">${u.name}</h2><small>${[u.area_name, u.temp_sensor_name].filter(Boolean).join(' · ')}</small></div>
          <span class="badge" data-look=${look}><sw-icon name=${STATUS_ICON[st]} size="14"></sw-icon>${tt(STATUS_KEY[st])}</span>
          <button type="button" class="btn icb" aria-label=${tt('expand')} title=${tt('expand')} aria-pressed=${String(this.wide)} data-temp-wide @click=${() => this.toggleWide()}><sw-icon name="grid" size="16"></sw-icon></button>
          <button type="button" class="btn icb" aria-label=${tt('close')} data-temp-close @click=${() => this.close()}><sw-icon name="close" size="16"></sw-icon></button></div>
        <div class="db">
          <div class="col">
            <div class="panel" data-look=${look}><div class="headrow">${gauge(u, look, u.trend, 132)}
              <div style="flex:1;display:grid;gap:8px;min-inline-size:0">
                <div class="chips" style="justify-content:flex-start">${chips.map((c) => html`<span class="chip" data-tone=${c.tone}><sw-icon name=${c.icon} size="12"></sw-icon>${c.text}</span>`)}</div>
                <div class="summ">
                  <div><span>${tt('sensorTemp')}</span><b>${sensorLine(u.temp_sensor_name, u.temp_entity_id)}</b></div>
                  ${u.hvac ? html`<div><span>${tt('lgSetpoint')}</span><b>${deg(u.hvac.setpoint)} · ${hvacText(u.hvac.hvac_mode, u.hvac.hvac_action)}</b></div>` : nothing}
                  <div><span>${tt('sensorDoor')}</span><b>${u.door ? sensorLine(u.door.sensor_name, u.door_entity_id) : tt('none')}</b></div>
                  <div><span>${tt('rulesLbl')}</span><b>${this.rulesLine(u)}</b></div>
                </div>
              </div></div></div>
            <div class="panel"><div class="ph"><h4>${tt('chartTitle')}</h4>
              <span class="seg" role="group" aria-label=${tt('chartTitle')}>${(['24h', '7d', '30d'] as RangeKey[]).map((r) => html`<button type="button" aria-pressed=${String(this.range === r)} data-range=${r}
                @click=${() => { this.range = r; this.cross = null; }}>${tt(r === '24h' ? 'r24' : r === '7d' ? 'r7' : 'r30')}</button>`)}</span></div>
              <div class="bigchart" data-temp-chart @pointermove=${(e: PointerEvent) => dt && this.hover(e, dt)} @pointerdown=${(e: PointerEvent) => dt && this.hover(e, dt)} @pointerleave=${() => { this.cross = null; }}>
                ${dt ? bigChart(dt, this.chartW, 250, lang, this.cross) : this.histError ? html`<p class="err">${this.histError}</p>` : html`<div class="skl" style="block-size:100%"></div>`}
                ${dt ? this.tip(dt, lang) : nothing}
              </div>
              <div class="legend"><span><i data-k="line"></i>${tt('lgTemp')}</span><span><i data-k="out"></i>${tt('lgOut')}</span><span><i data-k="band"></i>${tt('lgBand', { lo: deg(u.low), hi: deg(u.high) })}</span>
                ${u.source === 'climate' ? html`<span><i data-k="sp"></i>${tt('lgSetpoint')}</span>` : nothing}${u.door ? html`<span><i data-k="door"></i>${tt('lgDoor')}</span>` : nothing}${u.defrost.mode !== 'none' ? html`<span><i data-k="defrost"></i>${tt('lgDefrost')}</span>` : nothing}</div>
              <div class="stat4" data-temp-stats>
                <div><span>${tt('statMin')}</span><b class="num" dir="ltr">${deg(s.min)}</b></div>
                <div><span>${tt('statMax')}</span><b class="num" dir="ltr">${deg(s.max)}</b></div>
                <div><span>${tt('statAvg')}</span><b class="num" dir="ltr">${deg(s.avg)}</b></div>
                <div><span>${tt('statOut')}</span><b class="num" data-temp-out>${s.out_min ? durationText(s.out_min) : '0'}</b>${s.out_min_raw !== s.out_min ? html`<small>${tt('statOutRaw', { d: durationText(s.out_min_raw) })}</small>` : nothing}</div>
              </div>
            </div>
            <div class="panel"><h4 style="margin-block-end:10px">${tt('timeline')}</h4>${this.bars(u, now)}</div>
            ${others.length ? html`<div class="panel"><div class="ph"><h4>${tt('compare')}</h4><span class="hint">${tt('compareHint')}</span></div>
              <div class="cmp">${others.map((x) => html`<button type="button" class="ci" data-compare=${x.id} @click=${() => this.dispatchEvent(new CustomEvent('open-unit', { detail: x.id }))}>
                <div><b>${x.name}</b><small>${x.area_name ?? ''}</small></div>${spark(x, now, 200, 30)}<div class="o">${x.stats_24h.out_min ? tt('excursion', { d: durationText(x.stats_24h.out_min) }) : tt('inRange')}</div></button>`)}</div></div>` : nothing}
          </div>
          <div class="col">
            <div class="panel"><div class="ringrow"><div class="ring">${ring(u, now, lang)}</div>
              <div style="flex:1;display:grid;gap:6px"><h4>${tt('ringTitle')}</h4><p class="hint" style="margin:0">${tt('ringHint')}</p>
                <div class="legend"><span><i data-k="ok"></i>${tt('ringOk')}</span><span><i data-k="warn"></i>${tt('ringWarn')}</span><span><i data-k="alarm"></i>${tt('ringAlarm')}</span><span><i data-k="none"></i>${tt('ringNone')}</span></div></div></div></div>
            ${this.defrostPanel(u)}
            <div class="panel"><div class="ph"><h4>${tt('recent')}</h4><a class="btn sm ghost" href=${`${TEMPERATURE_HREF}/log?unit=${encodeURIComponent(u.id)}`} data-temp-fulllog>${tt('fullLog')}</a></div>
              <div class="events" data-temp-events>${this.events.length ? this.events.map((e) => html`<div class="ev" style=${`--c:${sevC[e.severity]}`}><time>${hhmm(Date.parse(e.started_at), lang)}</time>
                <div><i aria-hidden="true"></i>${eventText(e)}</div><span class="chip" data-tone=${e.ended_at ? 'mut' : 'err'}>${e.ended_at ? tt('closed') : tt('open')}</span></div>`) : html`<p class="hint">${tt('noRecent')}</p>`}</div></div>
          </div>
        </div>
        <div class="df">
          ${this.err ? html`<span class="err" role="alert">${this.err}</span>` : nothing}
          ${this.canAck ? html`<button type="button" class="btn pri" ?disabled=${!ackable || this.busy} data-temp-ack @click=${() => this.act(() => ackUnit(u.id), 'acked')}><sw-icon name="check" size="16"></sw-icon>${tt('ack')}</button>
            ${u.muted_until ? html`<button type="button" class="btn" ?disabled=${this.busy} data-temp-unmute @click=${() => this.act(() => unmuteUnit(u.id), 'saved')}><sw-icon name="bell" size="16"></sw-icon>${tt('unmute')}</button>`
              : html`<button type="button" class="btn" ?disabled=${this.busy} aria-expanded=${String(this.muteOpen)} data-temp-mute @click=${() => { this.muteOpen = !this.muteOpen; }}><sw-icon name="bellOff" size="16"></sw-icon>${tt('mute')}</button>`}` : nothing}
          <span class="sp"></span>
          ${this.canManage ? html`<button type="button" class="btn ghost" data-temp-detail-edit @click=${() => this.dispatchEvent(new CustomEvent('edit'))}><sw-icon name="edit" size="16"></sw-icon>${tt('edit')}</button>` : nothing}
          ${this.muteOpen ? html`<div class="pop" role="menu" data-temp-mutepop><div class="hd">${tt('muteTitle')}</div><div class="nt">${tt('muteNote')}</div>
            ${MUTES.map((m) => html`<button type="button" role="menuitem" data-mute=${m} @click=${() => { this.muteOpen = false; void this.act(() => muteUnit(u.id, { minutes: m }), 'muted', { t: hhmm(now + m * 60_000, lang) }); }}>${durationText(m)}<span class="num">${hhmm(now + m * 60_000, lang)}</span></button>`)}
            ${u.defrost.windows.some((w) => w.status !== 'rejected') ? html`<button type="button" role="menuitem" data-mute="defrost" @click=${() => { this.muteOpen = false; void this.act(() => muteUnit(u.id, { until_defrost_end: true }), 'saved'); }}>${tt('muteDefrost')}</button>` : nothing}
          </div>` : nothing}
        </div>
      </aside>`;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'temp-detail': TempDetail;
  }
}
