import { LitElement, html, css, nothing } from 'lit';
import { customElement, property, state, query } from 'lit/decorators.js';
import '../components/sw-icon';
import { describeError } from '../api/client';
import { ackUnit, clearLearned, decideWindow, endMaintenance, getHistory, listEvents, muteUnit, startMaintenance, unmuteUnit, type HistoryResponse, type RangeKey, type TempEvent, type TempUnit } from '../api/temperature';
import { LOOK_OF, STATUS_ICON, STATUS_KEY, TEMPERATURE_HREF, chipsOf, deg, doorRuns, durationText, eventText, fmt1, hhmm, friendlyName, hvacText, normalize, stateRuns, windowText, type Run } from './model';
import { bigChart, bigFrame, gauge, ring, spark, type BigChartData } from './charts';
import { tempCss } from './styles';
import './ticket-dialog';
import './explain'; // TEMPEXPLAIN093-295: "why did it warm?"
import { ticketsEnabled } from '../tickets/gate'; // owner rule 2026-10-20: no ticket action while the tickets module is off
import { tt, type TtKey } from '../i18n/temperature';
import { dayMonthText } from '../api/day-format';

const WIDE_KEY = 'sw.temperature.detailWide';
const MUTES = [15, 30, 60, 120];
/** phase 3 (idea 9): the maintenance durations offered (those above the unit's `maintenance_max_min` are left out) */
const MAINT_MIN = [30, 60, 120, 240];
const COMPARE_MAX = 2;

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
  /** TEMPEXPLAIN093-295: offer "why?" on an excursion (installation setting explain_enabled) */
  @property({ type: Boolean }) explain = true;
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
  /** phase 3: the maintenance popover, the ticket dialog, the compared units and their scale */
  @state() private maintOpen = false;
  @state() private maintReason = '';
  @state() private maintMin = 60;
  @state() private ticket: { eventId: string | null } | null = null;
  @state() private cmp: string[] = [];
  @state() private cmpScale: 'shared' | 'norm' = 'shared';
  @state() private cmpHist: Record<string, HistoryResponse> = {};
  /** TEMPEXPLAIN093-295: the excursion (alert-log row) whose explanation is open; '' = none */
  @state() private whyEvent = '';
  @query('.bigchart') private chartBox?: HTMLElement;
  private ro?: ResizeObserver;
  private loadedFor = '';

  static styles = [tempCss, css`
    :host { position: fixed; inset: 0; z-index: var(--sw-z-modal); display: block; }
    .ovl { position: absolute; inset: 0; background: var(--sw-overlay); }
    .drawer {
      position: absolute; inset-block: 0; inset-inline-end: 0; inline-size: min(560px, 100vw); background: var(--sw-bg); box-shadow: var(--sw-shadow-3);
      display: flex; flex-direction: column; min-block-size: 0; min-inline-size: 0; max-inline-size: 100vw; overflow: hidden;
    }
    .drawer.wide { inline-size: min(1240px, 100vw); }
    /* R5-MEDIA-ENERGY-297 (emil: drawers 200-400 ms, ease-out; transform + opacity only): the drawer slides in from its edge in 280 ms, the scrim fades */
    .ovl { opacity: 1; transition: opacity var(--sw-t-slow) var(--sw-ease); }
    .drawer { opacity: 1; transform: translateX(0); transition: transform 280ms cubic-bezier(0.23, 1, 0.32, 1), opacity 200ms var(--sw-ease-out); }
    /* the drawer hangs on the inline end: in RTL (the product) that edge is the left, so it enters from the left; in LTR from the right */
    @starting-style { .ovl { opacity: 0; } .drawer { opacity: 0; transform: translateX(-28px); } }
    :host(:dir(ltr)) .drawer { transition: transform 280ms cubic-bezier(0.23, 1, 0.32, 1), opacity 200ms var(--sw-ease-out); }
    @starting-style { :host(:dir(ltr)) .drawer { transform: translateX(28px); } }
    .dh { display: flex; align-items: center; gap: 10px; padding: 14px 16px; border-block-end: 1px solid var(--sw-border); background: var(--sw-surface); }
    /* R5-MEDIA-ENERGY-297: the drawer's title is a title (24 px / 800), its statistics are wells with display numerals, its footer keys are raised */
    .dh h2 { margin: 0; font-size: var(--sw-fs-3xl); font-weight: 800; letter-spacing: -0.02em; line-height: 1.15; color: var(--sw-heading); }
    .dh small { color: var(--sw-text-2); font-size: var(--sw-fs-xs); }
    .dh .t { flex: 1; min-inline-size: 0; overflow-wrap: anywhere; }
    .dh .badge { flex: none; }
    .icb { inline-size: 36px; block-size: 36px; padding: 0; justify-content: center; }
    .db { flex: 1; min-inline-size: 0; overflow-x: hidden; overflow-y: auto; padding: 14px 16px; display: grid; grid-template-columns: minmax(0, 1fr); gap: 12px; align-content: start; }
    .wide .db { grid-template-columns: minmax(0, 1.7fr) minmax(300px, 1fr); }
    .col { display: grid; gap: 12px; align-content: start; min-inline-size: 0; }
    .df { display: flex; gap: 8px; flex-wrap: wrap; align-items: center; padding: 10px 16px calc(10px + env(safe-area-inset-bottom)); border-block-start: 1px solid var(--sw-border); background: var(--sw-surface); position: relative; }
    .df .sp { flex: 1; }
    .df { flex: none; min-inline-size: 0; }
    .df .err { flex: 1 1 100%; overflow-wrap: anywhere; }
    .headrow { display: flex; gap: 16px; align-items: center; min-inline-size: 0; }
    .headrow > * { min-inline-size: 0; }
    .headrow > .gauge { flex: none; }
    .summ { display: grid; gap: 4px; font-size: var(--sw-fs-sm); }
    .summ > div { display: flex; gap: 10px; justify-content: space-between; border-block-end: 1px solid var(--sw-border); padding-block: 5px; }
    .summ > div > span { color: var(--sw-text-2); flex: none; }
    .summ b { font-weight: var(--sw-fw-semibold); color: var(--sw-heading); text-align: end; min-inline-size: 0; overflow-wrap: anywhere; }
    .summ > div > span { overflow-wrap: anywhere; }
    .sname { overflow-wrap: anywhere; word-break: break-word; }
    .seg { display: inline-flex; background: var(--sw-surface-2); border-radius: var(--sw-r-pill); padding: 3px; gap: 2px; }
    .seg button { border: 0; background: transparent; border-radius: var(--sw-r-pill); padding: 4px 12px; font: inherit; font-size: var(--sw-fs-sm); color: var(--sw-text-2); cursor: pointer; }
    .seg button[aria-pressed='true'] { background: var(--sw-surface); color: var(--sw-text); box-shadow: var(--sw-shadow-1); font-weight: var(--sw-fw-semibold); }
    .ph { display: flex; align-items: center; gap: 10px; flex-wrap: wrap; margin-block-end: 8px; }
    .ph h4 { flex: 1; }
    .bigchart { position: relative; block-size: 250px; touch-action: pan-y; min-inline-size: 0; max-inline-size: 100%; overflow: hidden; }
    .bigchart svg { inline-size: 100%; block-size: 100%; display: block; }
    .tip {
      position: absolute; pointer-events: none; transform: translate(-50%, -115%); background: var(--sw-surface-solid); border: 1px solid var(--sw-border);
      border-radius: var(--sw-r-sm); padding: 6px 9px; box-shadow: var(--sw-shadow-2); font-size: var(--sw-fs-xs); white-space: nowrap; direction: ltr;
    }
    .tip b { font-size: var(--sw-fs-md); }
    .stat4 { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 8px; margin-block-start: 10px; }
    .stat4 > div { min-inline-size: 0; overflow-wrap: anywhere; background: var(--sw-surface-2); border-radius: var(--sw-r-md); padding: 10px 12px; display: grid; gap: 3px; }
    .stat4 span { font-size: var(--sw-fs-xs); color: var(--sw-text-2); font-weight: var(--sw-fw-medium); }
    .stat4 b { font-size: var(--sw-fs-2xl); font-weight: 800; letter-spacing: -0.02em; line-height: 1.1; color: var(--sw-heading); font-variant-numeric: tabular-nums; }
    .stat4 small { font-size: var(--sw-fs-2xs); color: var(--sw-text-3); }
    .tlrow { display: grid; gap: 4px; margin-block-end: 10px; }
    .tlrow .lbl { display: flex; justify-content: space-between; gap: 8px; font-size: var(--sw-fs-xs); color: var(--sw-text-2); flex-wrap: wrap; }
    .cmp { display: grid; gap: 8px; }
    .ci { display: grid; grid-template-columns: minmax(0, 1fr) minmax(0, 1.4fr) auto; gap: 10px; align-items: center; padding: 6px 8px; border-radius: var(--sw-r-sm); border: 0; background: transparent; font: inherit; color: inherit; text-align: start; cursor: pointer; }
    /* R5-MEDIA-ENERGY-297 (mobile-native): hover only under a pointer that hovers; the row answers the press */
    @media (hover: hover) and (pointer: fine) { .ci:hover { background: var(--sw-hover-wash); } }
    .ci:active { background: var(--sw-surface-3); }
    .ci > div { min-inline-size: 0; overflow-wrap: anywhere; }
    .ci small { display: block; color: var(--sw-text-3); font-size: var(--sw-fs-2xs); }
    .ci .spark { block-size: 30px; }
    .ci .o { font-size: var(--sw-fs-xs); color: var(--sw-text-2); white-space: nowrap; }
    .ringrow { display: flex; gap: 16px; align-items: center; min-inline-size: 0; }
    .ringrow > div:not(.ring) { min-inline-size: 0; }
    .ring { inline-size: 150px; block-size: 150px; flex: none; }
    .ring svg { inline-size: 100%; block-size: 100%; }
    .events { display: grid; }
    .ev { display: grid; grid-template-columns: auto minmax(0, 1fr) auto; gap: 10px; align-items: center; padding-block: 8px; border-block-end: 1px solid var(--sw-border); font-size: var(--sw-fs-sm); }
    .ev > div { min-inline-size: 0; overflow-wrap: anywhere; }
    .win, .ph, .legend, .cmpbar { min-inline-size: 0; }
    .legend span { overflow-wrap: anywhere; }
    .ev time { color: var(--sw-text-2); font-variant-numeric: tabular-nums; }
    .ev i { display: inline-block; inline-size: 8px; block-size: 8px; border-radius: 50%; background: var(--c, var(--sw-accent)); margin-inline-end: 6px; }
    .wins { display: grid; gap: 6px; }
    .win { display: flex; align-items: center; gap: 8px; flex-wrap: wrap; font-size: var(--sw-fs-sm); }
    .win .w { font-variant-numeric: tabular-nums; direction: ltr; }
    .pop {
      position: absolute; inset-block-end: calc(100% + 6px); inset-inline-start: 16px; background: var(--sw-menu-surface); border: 1px solid var(--sw-menu-border);
      border-radius: var(--sw-r-md); box-shadow: var(--sw-shadow-3); padding: 6px; display: grid; min-inline-size: min(220px, calc(100vw - 32px)); max-inline-size: calc(100vw - 32px); z-index: 1;
    }
    .pop .hd { padding: 6px 10px; font-weight: var(--sw-fw-semibold); font-size: var(--sw-fs-sm); }
    .pop .nt { padding: 0 10px 6px; font-size: var(--sw-fs-xs); color: var(--sw-text-2); }
    .pop button { display: flex; justify-content: space-between; gap: 16px; border: 0; background: transparent; padding: 8px 10px; border-radius: var(--sw-r-sm); font: inherit; color: inherit; cursor: pointer; text-align: start; }
    @media (hover: hover) and (pointer: fine) { .pop button:hover { background: var(--sw-hover-wash); } }
    .pop button:active { background: var(--sw-surface-3); }
    .err { color: var(--sw-danger-text); font-size: var(--sw-fs-sm); }
    /* phase 3 */
    .summ.hl b[data-bad='true'] { color: var(--sw-warning-text); font-weight: var(--sw-fw-semibold); }
    .warnline { color: var(--sw-warning-text) !important; }
    .fx { display: grid; gap: 2px; margin-block-start: 8px; }
    .fxr { display: grid; grid-template-columns: auto auto 1fr; gap: 12px; font-size: var(--sw-fs-xs); color: var(--sw-text-2); }
    .bars { display: flex; align-items: flex-end; gap: 4px; block-size: 46px; margin-block-start: 10px; }
    .bars span { flex: 1; block-size: 100%; display: flex; align-items: flex-end; background: var(--sw-surface-2); border-radius: var(--sw-r-2xs); overflow: hidden; }
    .bars i { display: block; inline-size: 100%; background: var(--tc-acc); opacity: 0.7; }
    .cmpbar { display: flex; gap: 8px; align-items: center; flex-wrap: wrap; margin-block-end: 8px; }
    .cirow { display: flex; align-items: center; gap: 4px; }
    .cirow .ci { flex: 1; min-inline-size: 0; }
    .cmpck { display: grid; place-items: center; inline-size: 32px; block-size: 32px; flex: none; }
    .cmpck input { inline-size: 18px; block-size: 18px; accent-color: var(--sw-accent); }
    .ev.tk { text-decoration: none; color: inherit; }
    .pop.maint { min-inline-size: min(320px, calc(100vw - 32px)); gap: 8px; padding: 10px; }
    .pop .mf { display: grid; gap: 4px; font-size: var(--sw-fs-sm); }
    .pop .in { min-block-size: var(--sw-ctl-h-md); border-radius: var(--sw-r-md); border: 1px solid var(--sw-border); background: var(--sw-surface); color: var(--sw-text); padding: 0 10px; font: inherit; }
    .pop.maint .seg button { display: inline-block; padding: 4px 10px; }
    .pop.maint > .btn { justify-self: start; }
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
      if (this.ticket) return; // the ticket dialog closes itself
      if (this.muteOpen) this.muteOpen = false;
      else if (this.maintOpen) this.maintOpen = false;
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
      const unitChanged = !this.loadedFor.startsWith(`${this.unit.id}:`);
      this.loadedFor = `${this.unit.id}:${this.range}`;
      if (unitChanged) {
        this.cmp = [];
        this.cmpHist = {};
        this.whyEvent = '';
      }
      void this.loadHistory();
      void this.loadCompare();
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

  /** phase 3 (idea 10): the compared units' history for the same range (each answer is scoped by the server like the unit itself) */
  private async loadCompare() {
    const range = this.range;
    const out: Record<string, HistoryResponse> = {};
    await Promise.all(this.cmp.map(async (id) => {
      try {
        out[id] = await getHistory(id, range, undefined, undefined, Math.max(200, Math.min(1200, this.chartW)));
      } catch {
        /* a unit that can no longer be read simply drops out of the comparison */
      }
    }));
    if (range === this.range) this.cmpHist = out;
  }

  private toggleCompare(id: string, on: boolean) {
    this.cmp = on ? [...this.cmp, id].slice(-COMPARE_MAX) : this.cmp.filter((x) => x !== id);
    void this.loadCompare();
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
    const u = this.unit;
    const norm = this.cmp.length > 0 && this.cmpScale === 'norm';
    const others = this.cmp.map((id) => ({ id, u: this.units.find((x) => x.id === id), h: this.cmpHist[id] })).filter((x) => x.u && x.h);
    const map = (pts: [number, number][], lo: number, hi: number) => (norm ? pts.map(([t, v]) => [t, normalize(v, lo, hi)] as [number, number]) : pts);
    return {
      points: map(h.points.map((p) => [p[0], p[1]] as [number, number]), u.low, u.high),
      setpoints: u.source === 'climate' && !norm ? h.points.map((p) => [p[0], p[5]] as [number, number | null]) : undefined,
      low: norm ? 0 : u.low, high: norm ? 1 : u.high, doors: h.doors, defrost: h.defrost, t0: h.from, t1: h.to, step: h.step,
      overlays: others.map((o) => ({ id: o.id, name: o.u!.name, points: map(o.h!.points.map((p) => [p[0], p[1]] as [number, number]), o.u!.low, o.u!.high) })),
      axisUnit: norm ? '' : '°',
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
    const day = this.range === '24h' ? '' : `${dayMonthText(new Date(ms))} · `;
    const norm = dt.axisUnit === '';
    const near = (pts: [number, number][]) => pts.reduce<[number, number] | null>((b, q) => (b === null || Math.abs(q[0] - p[0]) < Math.abs(b[0] - p[0]) ? q : b), null);
    return html`<div class="tip" style=${`inset-inline-start:${(this.cross.x / this.chartW) * 100}%;inset-block-start:${((this.cross.y ?? 20) / 250) * 100}%`} data-temp-tip>
      <div>${day}<span class="num">${hhmm(ms, lang)}</span></div><b class="num">${norm ? p[1].toFixed(2) : `${fmt1(p[1])} °C`}</b>
      ${(dt.overlays ?? []).map((o) => {
        const q = near(o.points);
        return q && Math.abs(q[0] - p[0]) <= dt.step * 2 ? html`<div>${o.name}: <span class="num">${norm ? q[1].toFixed(2) : `${fmt1(q[1])} °C`}</span></div>` : nothing;
      })}
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

  // ---------------------------------------------------------------- phase 3 panels

  /** Idea 8: the sensor's own device - battery, signal, the age of the reading, a frozen value. */
  private healthPanel(u: TempUnit, lang: string) {
    const h = u.health;
    if (!h) return nothing;
    const row = (label: TtKey, value: unknown, bad: boolean) => html`<div><span>${tt(label)}</span><b data-bad=${String(bad)}>${value}</b></div>`;
    const sig = h.signal === null ? tt('hNotReported') : h.signal_unit === 'dBm' ? html`<span class="num ltr">${h.signal} dBm</span>` : html`<span class="num ltr">LQI ${h.signal}</span>`;
    return html`<div class="panel" data-temp-health><div class="ph"><h4>${tt('healthTitle')}</h4>
        ${h.issues.length ? html`<span class="chip" data-tone="warn">${h.issues.length}</span>` : html`<span class="chip" data-tone="ok">${tt('hOk')}</span>`}</div>
      <div class="summ hl">
        ${row('hBattery', h.battery === null ? (h.battery_low ? tt('healthBatteryLow') : tt('hNotReported')) : html`<span class="num ltr">${Math.round(h.battery)}%</span>`, h.battery_low)}
        ${row('hSignal', h.signal_weak ? html`${sig} · ${tt('healthSignal')}` : sig, h.signal_weak)}
        ${row('hAge', h.age_min === null ? '—' : durationText(h.age_min), false)}
        ${h.frozen_since ? row('hFrozen', tt('healthFrozen', { t: hhmm(Date.parse(h.frozen_since), lang) }), true) : nothing}
      </div></div>`;
  }

  /** Idea 2: what each door opening does to the reading and how long the unit takes to recover. */
  private doorPanel(u: TempUnit, lang: string) {
    const d = u.insights?.door;
    if (!u.door || !d) return nothing;
    const verdict = d.opens === 0 || d.median_recovery_min === null ? tt('doorFxNone') : d.slow ? tt('doorFxSlow') : tt('doorFxOk');
    return html`<div class="panel" data-temp-doorfx data-slow=${String(d.slow)}><div class="ph"><h4>${tt('doorFxTitle')}</h4></div>
      <div class="stat4">
        <div><span>${tt('doorFxOpens')}</span><b class="num">${d.opens}</b></div>
        <div><span>${tt('doorFxRise')}</span><b class="num" dir="ltr">${d.avg_rise === null ? '—' : `+${fmt1(d.avg_rise)}°`}</b></div>
        <div><span>${tt('doorFxMaxRise')}</span><b class="num" dir="ltr">${d.max_rise === null ? '—' : `+${fmt1(d.max_rise)}°`}</b></div>
        <div><span>${tt('doorFxRecovery')}</span><b class="num">${d.median_recovery_min === null ? '—' : durationText(d.median_recovery_min)}</b></div>
      </div>
      <p class="hint ${d.slow ? 'warnline' : ''}" style="margin:8px 0 0">${verdict}</p>
      ${d.last.length ? html`<div class="fx"><span class="hint">${tt('doorFxLast')}</span>${[...d.last].reverse().map((e) => html`<div class="fxr"><time class="num">${hhmm(e.opened * 1000, lang)}</time>
        <span class="num ltr">+${fmt1(e.rise)}°</span><span>${e.recovery_min === null ? tt('doorFxNotBack') : durationText(e.recovery_min)}</span></div>`)}</div>` : nothing}
    </div>`;
  }

  /** Idea 6: the compressor duty cycle from the optional smart plug / current meter (read only). */
  private dutyPanel(u: TempUnit) {
    if (!u.power) return nothing;
    const d = u.insights?.duty;
    const pct = (v: number | null | undefined) => (v === null || v === undefined ? '—' : `${Math.round(v)}%`);
    return html`<div class="panel" data-temp-duty data-rising=${String(!!d?.rising)}><div class="ph"><h4>${tt('dutyTitle')}</h4>
        ${u.power.w !== null ? html`<span class="chip" data-tone=${u.power.on ? 'acc' : 'mut'}><sw-icon name="power" size="12"></sw-icon>${u.power.on ? tt('compressorOn') : tt('compressorOff')} · ${tt('dutyNow', { w: Math.round(u.power.w) })}</span>` : nothing}</div>
      ${d ? html`<div class="stat4" style="grid-template-columns:repeat(3,minmax(0,1fr))">
          <div><span>${tt('duty24')}</span><b class="num">${pct(d.pct_24h)}</b></div>
          <div><span>${tt('dutyRecent')}</span><b class="num">${pct(d.recent)}</b></div>
          <div><span>${tt('dutyBefore')}</span><b class="num">${pct(d.before)}</b></div></div>
        ${d.days.length ? html`<div class="bars" role="img" aria-label=${tt('dutyTitle')} dir="ltr">${d.days.map((x) => html`<span title=${`${x.day} · ${pct(x.pct)}`}><i style=${`block-size:${Math.max(2, x.pct ?? 0)}%`}></i></span>`)}</div>` : nothing}
        <p class="hint ${d.rising ? 'warnline' : ''}" style="margin:8px 0 0">${d.recent === null ? tt('dutyNoData') : d.rising ? tt('dutyRising') : tt('dutyStable')}</p>`
      : html`<p class="hint" style="margin:0">${tt('dutyNoData')}</p>`}</div>`;
  }

  /** Idea 11: the tickets opened from this unit (only those the person may see). */
  private ticketsPanel(u: TempUnit) {
    const list = u.tickets ?? [];
    if (!ticketsEnabled() || !list.length) return nothing;
    return html`<div class="panel" data-temp-tickets><div class="ph"><h4>${tt('ticketsLinked')}</h4></div>
      <div class="events">${list.map((x) => html`<a class="ev tk" href=${`#/tickets/${encodeURIComponent(x.ticket_id)}`} data-ticket-link=${x.ticket_id}><sw-icon name="ticket" size="14"></sw-icon>
        <div>${tt('ticketChip', { n: x.number })}</div><span class="chip">${x.status ?? ''}</span></a>`)}</div></div>`;
  }

  private maintPop(u: TempUnit, lang: string) {
    const max = u.rules.maintenance_max_min ?? 240;
    const opts = MAINT_MIN.filter((m) => m <= max);
    const go = () => {
      const r = this.maintReason.trim();
      if (!r) {
        this.err = tt('maintNeedReason');
        return;
      }
      this.maintOpen = false;
      const m = Math.min(this.maintMin, max);
      void this.act(() => startMaintenance(u.id, m, r), 'maintStarted', { t: hhmm(Date.now() + m * 60_000, lang) });
      this.maintReason = '';
    };
    return html`<div class="pop maint" role="dialog" aria-label=${tt('maintTitle')} data-temp-maintpop><div class="hd">${tt('maintTitle')}</div>
      <div class="nt">${u.rules.maintenance_includes_alarms ? tt('maintNoteAlarms') : tt('maintNote')}</div>
      <label class="mf"><span>${tt('maintReason')}</span><input class="in" maxlength="120" .value=${this.maintReason} placeholder=${tt('maintReasonPh')}
        @input=${(e: Event) => { this.maintReason = (e.target as HTMLInputElement).value; }} @keydown=${(e: KeyboardEvent) => { if (e.key === 'Enter') go(); }} data-maint-reason /></label>
      <div class="mf"><span>${tt('maintFor')}</span><span class="seg" role="group">${opts.map((m) => html`<button type="button" aria-pressed=${String(this.maintMin === m)} data-maint-min=${m}
        @click=${() => { this.maintMin = m; }}>${durationText(m)}</button>`)}</span></div>
      <button type="button" class="btn pri sm" ?disabled=${!this.maintReason.trim()} data-maint-start @click=${go}><sw-icon name="wrench" size="14"></sw-icon>${tt('maintStart')}</button>
    </div>`;
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
    /* owner 2026-10-20: the sensor row is the friendly name only (never the technical id); the unit's own name is the fallback */
    const sensorLine = (name: string | null | undefined) => html`<span class="sname">${friendlyName(name, u.name)}</span>`;
    const others = this.units.filter((x) => x.id !== u.id);
    const sevC: Record<string, string> = { alarm: 'var(--tc-alarm)', warning: 'var(--tc-warn)', info: 'var(--tc-acc)' };
    const openAlert = [...u.events].sort((a, b) => (a.severity === 'alarm' ? -1 : 0) - (b.severity === 'alarm' ? -1 : 0)).find((e) => e.severity === 'alarm' || e.severity === 'warning');
    return html`<div class="ovl" @click=${() => this.close()}></div>
      <aside class="drawer ${this.wide ? 'wide' : ''}" role="dialog" aria-modal="true" aria-labelledby="d-title" data-temp-detail=${u.id}>
        <div class="dh"><div class="t"><h2 id="d-title">${u.name}</h2><small>${[u.area_name, friendlyName(u.temp_sensor_name, '')].filter(Boolean).join(' · ')}</small></div>
          <span class="badge" data-look=${look}><sw-icon name=${STATUS_ICON[st]} size="14"></sw-icon>${tt(STATUS_KEY[st])}</span>
          <button type="button" class="btn icb" aria-label=${tt('expand')} title=${tt('expand')} aria-pressed=${String(this.wide)} data-temp-wide @click=${() => this.toggleWide()}><sw-icon name="grid" size="16"></sw-icon></button>
          <button type="button" class="btn icb" aria-label=${tt('close')} data-temp-close @click=${() => this.close()}><sw-icon name="close" size="16"></sw-icon></button></div>
        <div class="db">
          <div class="col">
            <div class="panel" data-look=${look}><div class="headrow">${gauge(u, look, u.trend, 132)}
              <div style="flex:1;display:grid;gap:8px;min-inline-size:0">
                <div class="chips" style="justify-content:flex-start">${chips.map((c) => html`<span class="chip" data-tone=${c.tone}><sw-icon name=${c.icon} size="12"></sw-icon>${c.text}</span>`)}</div>
                <div class="summ">
                  <div><span>${tt('sensorTemp')}</span><b>${sensorLine(u.temp_sensor_name)}</b></div>
                  ${u.hvac ? html`<div><span>${tt('lgSetpoint')}</span><b>${deg(u.hvac.setpoint)} · ${hvacText(u.hvac.hvac_mode, u.hvac.hvac_action)}</b></div>` : nothing}
                  <div><span>${tt('sensorDoor')}</span><b>${u.door ? sensorLine(u.door.sensor_name) : tt('none')}</b></div>
                  ${u.power ? html`<div><span>${tt('powerSensor')}</span><b>${sensorLine(u.power.sensor_name)}${u.power.w !== null ? html` · <span class="num ltr">${Math.round(u.power.w)} W</span>` : nothing}</b></div>` : nothing}
                  ${u.rules.predict_enabled !== false && !this.stale && u.status !== 'offline' ? html`<div data-temp-predict><span>${tt('predictRow')}</span><b>${u.prediction ? tt('predictChip', { t: deg(u.prediction.threshold), m: u.prediction.eta_min }) : tt('predictNone')}</b></div>` : nothing}
                  ${u.maintenance ? html`<div data-temp-maint><span>${tt('maintBtn')}</span><b>${tt('maintChip', { t: hhmm(Date.parse(u.maintenance.until), lang) })} · ${u.maintenance.reason}${u.maintenance.by_name ? ` · ${u.maintenance.by_name}` : ''}</b></div>` : nothing}
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
              <div class="legend"><span><i data-k="line"></i>${this.cmp.length ? u.name : tt('lgTemp')}</span>${(dt?.overlays ?? []).map((o, i) => html`<span><i data-k=${`ov${i}`}></i>${o.name}</span>`)}<span><i data-k="out"></i>${tt('lgOut')}</span><span><i data-k="band"></i>${dt?.axisUnit === '' ? tt('normHint') : tt('lgBand', { lo: deg(u.low), hi: deg(u.high) })}</span>
                ${u.source === 'climate' ? html`<span><i data-k="sp"></i>${tt('lgSetpoint')}</span>` : nothing}${u.door ? html`<span><i data-k="door"></i>${tt('lgDoor')}</span>` : nothing}${u.defrost.mode !== 'none' ? html`<span><i data-k="defrost"></i>${tt('lgDefrost')}</span>` : nothing}</div>
              <div class="stat4" data-temp-stats>
                <div><span>${tt('statMin')}</span><b class="num" dir="ltr">${deg(s.min)}</b></div>
                <div><span>${tt('statMax')}</span><b class="num" dir="ltr">${deg(s.max)}</b></div>
                <div><span>${tt('statAvg')}</span><b class="num" dir="ltr">${deg(s.avg)}</b></div>
                <div><span>${tt('statOut')}</span><b class="num" data-temp-out>${s.out_min ? durationText(s.out_min) : '0'}</b>${s.out_min_raw !== s.out_min ? html`<small>${tt('statOutRaw', { d: durationText(s.out_min_raw) })}</small>` : nothing}</div>
              </div>
            </div>
            <div class="panel"><h4 style="margin-block-end:10px">${tt('timeline')}</h4>${this.bars(u, now)}</div>
            ${others.length ? html`<div class="panel" data-temp-compare><div class="ph"><h4>${tt('compare')}</h4><span class="hint">${tt('compareHint')}</span></div>
              ${this.cmp.length ? html`<div class="cmpbar"><span class="hint">${tt('compareScale')}</span><span class="seg" role="group" aria-label=${tt('compareScale')}>
                  <button type="button" aria-pressed=${String(this.cmpScale === 'shared')} data-cmp-scale="shared" @click=${() => { this.cmpScale = 'shared'; this.cross = null; }}>${tt('scaleShared')}</button>
                  <button type="button" aria-pressed=${String(this.cmpScale === 'norm')} data-cmp-scale="norm" @click=${() => { this.cmpScale = 'norm'; this.cross = null; }}>${tt('scaleNorm')}</button></span>
                <button type="button" class="btn sm ghost" data-cmp-clear @click=${() => { this.cmp = []; this.cmpHist = {}; }}>${tt('compareClear')}</button></div>` : nothing}
              <div class="cmp">${others.map((x) => html`<div class="cirow"><label class="cmpck" title=${tt('compareChart')}><input type="checkbox" .checked=${this.cmp.includes(x.id)} data-cmp-pick=${x.id}
                  ?disabled=${!this.cmp.includes(x.id) && this.cmp.length >= COMPARE_MAX} aria-label=${`${tt('compareChart')}: ${x.name}`}
                  @change=${(e: Event) => this.toggleCompare(x.id, (e.target as HTMLInputElement).checked)} /></label>
                <button type="button" class="ci" data-compare=${x.id} @click=${() => this.dispatchEvent(new CustomEvent('open-unit', { detail: x.id }))}>
                <div><b>${x.name}</b><small>${x.area_name ?? ''}</small></div>${spark(x, now, 200, 30)}<div class="o">${x.stats_24h.out_min ? tt('excursion', { d: durationText(x.stats_24h.out_min) }) : tt('inRange')}</div></button></div>`)}</div>
              <p class="hint" style="margin:6px 0 0">${tt('compareMax')}</p></div>` : nothing}
          </div>
          <div class="col">
            ${this.explain && this.whyEvent ? html`<temp-explain .unitId=${u.id} .eventId=${this.whyEvent} @close=${() => { this.whyEvent = ''; }}></temp-explain>` : nothing}
            <div class="panel"><div class="ringrow"><div class="ring">${ring(u, now, lang)}</div>
              <div style="flex:1;display:grid;gap:6px"><h4>${tt('ringTitle')}</h4><p class="hint" style="margin:0">${tt('ringHint')}</p>
                <div class="legend"><span><i data-k="ok"></i>${tt('ringOk')}</span><span><i data-k="warn"></i>${tt('ringWarn')}</span><span><i data-k="alarm"></i>${tt('ringAlarm')}</span><span><i data-k="none"></i>${tt('ringNone')}</span></div></div></div></div>
            ${this.healthPanel(u, lang)}
            ${this.doorPanel(u, lang)}
            ${this.dutyPanel(u)}
            ${this.ticketsPanel(u)}
            ${this.defrostPanel(u)}
            <div class="panel"><div class="ph"><h4>${tt('recent')}</h4><a class="btn sm ghost" href=${`${TEMPERATURE_HREF}/log?unit=${encodeURIComponent(u.id)}`} data-temp-fulllog>${tt('fullLog')}</a></div>
              <div class="events" data-temp-events>${this.events.length ? this.events.map((e) => html`<div class="ev" style=${`--c:${sevC[e.severity]}`}><time>${hhmm(Date.parse(e.started_at), lang)}</time>
                <div><i aria-hidden="true"></i>${eventText(e)}${this.explain && (e.kind === 'high' || e.kind === 'low') ? html` <button type="button" class="btn sm ghost" data-temp-why-btn=${e.id}
                  aria-pressed=${String(this.whyEvent === e.id)} @click=${() => { this.whyEvent = this.whyEvent === e.id ? '' : e.id; void this.updateComplete.then(() => this.renderRoot.querySelector('temp-explain')?.scrollIntoView({ block: 'nearest', behavior: 'smooth' })); }}>${tt('whyBtn')}</button>` : nothing}</div>
                <span class="chip" data-tone=${e.ended_at ? 'mut' : 'err'}>${e.ended_at ? tt('closed') : tt('open')}</span></div>`) : html`<p class="hint">${tt('noRecent')}</p>`}</div></div>
          </div>
        </div>
        <div class="df">
          ${this.err ? html`<span class="err" role="alert">${this.err}</span>` : nothing}
          ${this.canAck ? html`<button type="button" class="btn pri" ?disabled=${!ackable || this.busy} data-temp-ack @click=${() => this.act(() => ackUnit(u.id), 'acked')}><sw-icon name="check" size="16"></sw-icon>${tt('ack')}</button>
            ${u.muted_until ? html`<button type="button" class="btn" ?disabled=${this.busy} data-temp-unmute @click=${() => this.act(() => unmuteUnit(u.id), 'saved')}><sw-icon name="bell" size="16"></sw-icon>${tt('unmute')}</button>`
              : html`<button type="button" class="btn" ?disabled=${this.busy} aria-expanded=${String(this.muteOpen)} data-temp-mute @click=${() => { this.muteOpen = !this.muteOpen; }}><sw-icon name="bellOff" size="16"></sw-icon>${tt('mute')}</button>`}` : nothing}
          ${this.canAck ? (u.maintenance
            ? html`<button type="button" class="btn" ?disabled=${this.busy} data-temp-maint-end @click=${() => this.act(() => endMaintenance(u.id), 'maintEnded')}><sw-icon name="wrench" size="16"></sw-icon>${tt('maintEnd')}</button>`
            : html`<button type="button" class="btn" ?disabled=${this.busy} aria-expanded=${String(this.maintOpen)} data-temp-maint @click=${() => { this.maintOpen = !this.maintOpen; this.muteOpen = false; }}><sw-icon name="wrench" size="16"></sw-icon>${tt('maintBtn')}</button>`) : nothing}
          <button type="button" class="btn" data-temp-report @click=${() => this.dispatchEvent(new CustomEvent('report', { detail: u.id }))}><sw-icon name="download" size="16"></sw-icon>${tt('report')}</button>
          ${this.canAck && ticketsEnabled() ? html`<button type="button" class="btn" data-temp-ticket-btn @click=${() => { this.ticket = { eventId: openAlert?.id ?? null }; }}><sw-icon name="ticket" size="16"></sw-icon>${tt('ticketBtn')}</button>` : nothing}
          <span class="sp"></span>
          ${this.canManage ? html`<button type="button" class="btn ghost" data-temp-detail-edit @click=${() => this.dispatchEvent(new CustomEvent('edit'))}><sw-icon name="edit" size="16"></sw-icon>${tt('edit')}</button>` : nothing}
          ${this.muteOpen ? html`<div class="pop" role="menu" data-temp-mutepop><div class="hd">${tt('muteTitle')}</div>${u.rules.mute_includes_alarms ? nothing : html`<div class="nt">${tt('muteNote')}</div>`}
            ${MUTES.map((m) => html`<button type="button" role="menuitem" data-mute=${m} @click=${() => { this.muteOpen = false; void this.act(() => muteUnit(u.id, { minutes: m }), 'muted', { t: hhmm(now + m * 60_000, lang) }); }}>${durationText(m)}<span class="num">${hhmm(now + m * 60_000, lang)}</span></button>`)}
            ${u.defrost.windows.some((w) => w.status !== 'rejected') ? html`<button type="button" role="menuitem" data-mute="defrost" @click=${() => { this.muteOpen = false; void this.act(() => muteUnit(u.id, { until_defrost_end: true }), 'saved'); }}>${tt('muteDefrost')}</button>` : nothing}
          </div>` : nothing}
          ${this.maintOpen ? this.maintPop(u, lang) : nothing}
        </div>
      </aside>
      ${this.ticket && ticketsEnabled() ? html`<temp-ticket .unitId=${u.id} .eventId=${this.ticket.eventId} @close=${() => { this.ticket = null; }}
          @done=${(e: CustomEvent<{ message: string }>) => { this.ticket = null; this.dispatchEvent(new CustomEvent('changed', { detail: e.detail.message })); }}></temp-ticket>` : nothing}`;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'temp-detail': TempDetail;
  }
}
