import { LitElement, html, css, nothing, type TemplateResult } from 'lit';
import { customElement, property, state } from 'lit/decorators.js';
import '../components/sw-page';
import '../components/sw-button';
import '../components/sw-state-panel';
import '../xsection/sw-fire-bar';
import { bidi, ltrNum } from '../i18n/bidi';
import { xt } from '../i18n/xsection';
import { describeError } from '../api/client';
import { loadTree, type CatalogTree } from '../api/catalog';
import { listEvents, type VmsEvent } from '../api/events';
import { canAnywhere, isApi } from '../api/session';
import type { Building, Floor } from '../api/types';
import { navigate, parseRoute } from '../router';
import { demoBuilding, demoSignals, loadXsData, type XsData } from '../xsection/xs-data';
import { acknowledgeFire, fireAck, fireReport, onFire, setFireMock } from '../xsection/fire-store';
import { ackName, mayAck } from '../xsection/sw-fire-bar';
import { xi } from '../xsection/xs-icons';
import { alarmFloors, onXsOptions, signalsOf, synColumns, tempState, totalsOf, xsFromParams, xsOptions, type FloorSignal, type SynColumn, type XsOptions } from '../xsection/xs-model';

const REFRESH_MS = 30_000;
const clock = () => new Date().toLocaleTimeString('he-IL', { hour: '2-digit', minute: '2-digit' });

/**
 * Release 2.29.0 - ראשי › מפה סינופטית (`#/devices/synoptic`, and the wall screen `#/kiosk/synoptic`): the whole building as a live status board,
 * one row per floor and one column per kind of signal - lighting, temperature, presence (only while the presence module is on), cameras, open
 * doors, alerts, fire detection (hidden until an integration exists; the alarm UI is behind the off-by-default option `fire_ui` and the labelled demo).
 * A value with no source is shown as unknown ("-"), never as zero. No page scroll: the rows share the height. Selecting a row (and the tree beside the board
 * on wide screens) shows that floor's detail line with the way into its map and cameras.
 */
@customElement('devices-synoptic')
export class DevicesSynoptic extends LitElement {
  /** The wall screen: no page frame and no tree, bigger type and a clock (a fixed control-room display). */
  @property({ type: Boolean, reflect: true }) wall = false;
  @state() private tree: CatalogTree | null = null;
  @state() private data: XsData | null = null;
  @state() private events: VmsEvent[] | null = null;
  @state() private error = '';
  @state() private sel = 'all';
  @state() private now = clock();
  private timers: number[] = [];
  private stops: Array<() => void> = [];
  private readonly onResize = () => this.requestUpdate();

  static styles = css`
    :host { display: block; block-size: 100%; min-block-size: 0; }
    sw-page { block-size: 100%; box-sizing: border-box; }
    :host([wall]) { position: fixed; inset: 0; background: var(--sw-bg); padding: 16px 20px; box-sizing: border-box; }
    .syn { display: grid; grid-template-columns: minmax(0, 1fr); gap: 14px; min-block-size: 0; block-size: 100%; }
    .syn.wide { grid-template-columns: 200px minmax(0, 1fr); }
    .syn.wide.ev { grid-template-columns: 200px minmax(0, 1fr) 280px; }
    .card { background: var(--sw-surface); border: 1px solid var(--sw-border); border-radius: var(--sw-r-lg); box-shadow: var(--sw-shadow-1); min-block-size: 0; min-inline-size: 0; }
    nav.tree { padding: 10px; display: flex; flex-direction: column; gap: 4px; overflow: hidden; align-self: stretch; }
    nav.tree button { display: flex; align-items: center; gap: 8px; padding: 8px 10px; border: 0; border-radius: var(--sw-r-sm); background: transparent; font: inherit; color: var(--sw-text); text-align: start; cursor: pointer; min-block-size: 36px; min-inline-size: 0; touch-action: manipulation; }
    nav.tree button[aria-pressed='true'] { background: var(--sw-accent-soft); color: var(--sw-accent-text); font-weight: var(--sw-fw-semibold); }
    nav.tree .nm { flex: 1; min-inline-size: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
    nav.tree .lit { color: var(--sw-text-3); font-size: 12px; font-variant-numeric: tabular-nums; direction: ltr; display: inline-flex; gap: 3px; align-items: center; }
    .xi { inline-size: 14px; block-size: 14px; flex: none; }
    .syn { grid-template-rows: minmax(0, 1fr); }
    .syn > * { align-self: stretch; min-block-size: 0; }
    .board { display: grid; grid-template-rows: auto auto auto minmax(0, 1fr) auto; gap: 10px; padding: 14px 16px 12px; block-size: 100%; box-sizing: border-box; }
    .bhead { display: flex; align-items: center; gap: 10px; flex-wrap: wrap; min-inline-size: 0; }
    .bhead h2 { margin: 0; font-size: var(--sw-fs-xl); font-weight: var(--sw-fw-bold); color: var(--sw-heading); display: flex; gap: 8px; align-items: center; }
    .chips { display: inline-flex; gap: 6px; flex-wrap: wrap; }
    .chip { display: inline-flex; align-items: center; gap: 5px; block-size: 28px; padding: 0 10px; border-radius: 999px; background: var(--sw-surface-2); color: var(--sw-text-2); font-size: 12.5px; white-space: nowrap; }
    .chip b { color: var(--sw-text); direction: ltr; unicode-bidi: isolate; font-variant-numeric: tabular-nums; }
    .chip.warm { background: color-mix(in srgb, var(--sw-lit) 26%, var(--sw-surface)); }
    .chip.alert { background: color-mix(in srgb, var(--sw-danger) 14%, var(--sw-surface)); color: var(--sw-danger-text, var(--sw-danger)); }
    .chip.dash { background: transparent; outline: 1.5px dashed var(--sw-border-strong); outline-offset: -1.5px; }
    .chip.mock { background: repeating-linear-gradient(135deg, transparent 0 5px, color-mix(in srgb, var(--sw-border-strong) 45%, transparent) 5px 6px), var(--sw-surface); box-shadow: inset 0 0 0 1px var(--sw-border-strong); color: var(--sw-text); font-weight: 600; }
    .live { margin-inline-start: auto; color: var(--sw-text-3); font-size: 12px; display: inline-flex; gap: 6px; align-items: center; }
    .live i { inline-size: 7px; block-size: 7px; border-radius: 50%; background: var(--sw-live); }
    .clock { font-size: 22px; font-weight: 800; font-variant-numeric: tabular-nums; direction: ltr; color: var(--sw-heading); }
    .sgrid { display: grid; grid-template-columns: minmax(110px, 1.3fr) repeat(var(--cols, 6), minmax(0, 1fr)); align-items: center; gap: 10px; }
    .shdr { padding: 0 12px; color: var(--sw-text-3); font-size: 12px; font-weight: var(--sw-fw-semibold); }
    .shdr span { display: inline-flex; gap: 5px; align-items: center; min-inline-size: 0; overflow: hidden; white-space: nowrap; text-overflow: ellipsis; }
    .srows { display: flex; flex-direction: column; justify-content: flex-start; gap: 5px; min-block-size: 0; container-type: size; }
    .srow { flex: 1 1 0; min-block-size: 0; max-block-size: 76px; padding: 0 12px; border: 0; border-radius: 12px; background: var(--sw-surface-2); text-align: start; color: inherit; font: inherit; cursor: pointer; transition: background var(--sw-t-hover, 120ms) var(--sw-ease-color, ease), transform var(--sw-t-press, 100ms) var(--sw-ease, ease); touch-action: manipulation; -webkit-tap-highlight-color: transparent; user-select: none; }
    .srow:active { transform: scale(var(--sw-press-scale, 0.98)); }
    @media (hover: hover) and (pointer: fine) { .srow:hover:not([aria-pressed='true']) { background: var(--sw-surface-3); } }
    .srow[aria-pressed='true'] { background: var(--sw-accent-soft); box-shadow: inset 0 0 0 2px var(--sw-accent); }
    .srow[data-temp='hot'] { background: color-mix(in srgb, var(--sw-heat) 12%, var(--sw-surface-2)); }
    .srow[data-temp='cold'] { background: color-mix(in srgb, var(--sw-cool) 12%, var(--sw-surface-2)); }
    .srow[data-off] { background: repeating-linear-gradient(135deg, transparent 0 7px, color-mix(in srgb, var(--sw-border) 55%, transparent) 7px 8px), var(--sw-surface-2); box-shadow: inset 0 0 0 1px var(--sw-border-strong); }
    .srow[data-fire='alarm'] { background: color-mix(in srgb, var(--sw-danger) 14%, var(--sw-surface)); box-shadow: inset 0 0 0 2px var(--sw-danger); }
    .srow[data-fire='fault'] { outline: 1.5px dashed var(--sw-border-strong); outline-offset: -1.5px; }
    .nm { min-inline-size: 0; display: flex; flex-direction: column; gap: 1px; }
    .nm .t { font-size: clamp(10px, calc(100cqh / var(--n, 6) * 0.3), var(--sw-fs-md)); font-weight: var(--sw-fw-bold); color: var(--sw-heading); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
    .nm .s { font-size: 12px; color: var(--sw-text-2); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
    .cell { min-inline-size: 0; display: inline-flex; align-items: center; gap: 5px; font-variant-numeric: tabular-nums; font-size: clamp(10px, calc(100cqh / var(--n, 6) * 0.3), 15px); }
    .cell b { font-weight: var(--sw-fw-bold); direction: ltr; unicode-bidi: isolate; }
    .cell.muted { color: var(--sw-text-3); }
    .cell.warn { color: var(--sw-danger-text, var(--sw-danger)); font-weight: var(--sw-fw-semibold); }
    .cell .w { min-inline-size: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
    .deg { font-size: clamp(11px, calc(100cqh / var(--n, 6) * 0.42), 24px); font-weight: 800; color: var(--sw-heading); direction: ltr; unicode-bidi: isolate; font-variant-numeric: tabular-nums; }
    .deg small { font-size: 0.6em; color: var(--sw-text-3); }
    .deg.none { color: var(--sw-text-3); }
    [data-temp='hot'] .deg { color: var(--sw-heat); }
    [data-temp='cold'] .deg { color: var(--sw-cool); }
    .fac { display: inline-flex; gap: 2px; padding: 2px; border-radius: 5px; background: var(--sw-border); block-size: clamp(8px, calc(100cqh / var(--n, 6) * 0.3), 22px); }
    .fac i { inline-size: 7px; border-radius: 2px; background: var(--sw-surface-2); }
    .fac i.on { background: color-mix(in srgb, var(--sw-lit) 82%, var(--sw-surface)); }
    .fz { display: inline-flex; gap: 5px; align-items: center; font-weight: var(--sw-fw-semibold); }
    .fz.alarm { color: var(--sw-danger-text, var(--sw-danger)); }
    .fz.fault { color: var(--sw-text-2); }
    .ground { flex: none; block-size: 2px; margin: 2px 6px; border-radius: 2px; background: var(--sw-border-strong); }
    .detail { display: flex; align-items: center; gap: 12px; flex-wrap: wrap; min-block-size: 40px; padding-block-start: 4px; border-block-start: 1px solid var(--sw-border); color: var(--sw-text-2); font-size: 13px; }
    .detail b { color: var(--sw-heading); }
    .detail .grow { flex: 1; min-inline-size: 0; }
    .empty { display: grid; place-items: center; padding: 24px; color: var(--sw-text-3); }
    .nc { display: flex; gap: 8px; align-items: center; color: var(--sw-text-2); font-size: 12.5px; }
    .alarmpanel { display: flex; align-items: center; gap: 12px; flex-wrap: wrap; padding: 10px 14px; border-radius: var(--sw-r-md); background: var(--sw-danger); color: #fff; }
    .alarmpanel.ackd { background: color-mix(in srgb, var(--sw-danger) 80%, #000); }
    .alarmpanel .tx { flex: 1 1 220px; min-inline-size: 0; display: flex; flex-direction: column; }
    .alarmpanel .tag { display: inline-flex; padding: 1px 8px; border-radius: 999px; background: rgba(0, 0, 0, 0.25); font-size: 11.5px; font-weight: 700; margin-inline-start: 8px; }
    .alarmpanel .lnk { min-block-size: 40px; padding: 0 14px; border-radius: 999px; border: 0; background: transparent; box-shadow: inset 0 0 0 1.5px rgba(255, 255, 255, 0.7); color: #fff; font: inherit; font-weight: 600; cursor: pointer; }
    aside.events { padding: 14px 16px; display: flex; flex-direction: column; gap: 8px; overflow: hidden; align-self: stretch; }
    aside.events h3 { margin: 0; font-size: var(--sw-fs-md); color: var(--sw-heading); display: flex; gap: 6px; align-items: center; }
    .ev { display: grid; grid-template-columns: auto 1fr auto; gap: 8px; align-items: start; font-size: 12.5px; }
    .ev small { display: block; color: var(--sw-text-3); }
    .ev time { color: var(--sw-text-3); font-variant-numeric: tabular-nums; direction: ltr; }
    :host([wall]) .nm .t { font-size: clamp(14px, calc(100cqh / var(--n, 6) * 0.4), 30px); }
    :host([wall]) .cell, :host([wall]) .deg { font-size: clamp(14px, calc(100cqh / var(--n, 6) * 0.4), 30px); }
    :host([wall]) .shdr { font-size: 16px; }
    .wallhead { display: flex; align-items: center; justify-content: space-between; margin-block-end: 10px; gap: 12px; }
    .wallhead h1 { margin: 0; font-size: 26px; color: var(--sw-heading); }
    @media (max-width: 767px) {
      .syn.wide, .syn.wide.ev { grid-template-columns: minmax(0, 1fr); }
      .sgrid { grid-template-columns: minmax(80px, 1.3fr) repeat(var(--pcols, 3), minmax(0, auto)); gap: 8px; }
      .hide-phone { display: none !important; }
      .bhead h2 { font-size: var(--sw-fs-lg); }
    }
    :focus-visible { outline: 2px solid var(--sw-focus, var(--sw-accent)); outline-offset: 2px; }
  `;

  connectedCallback() {
    super.connectedCallback();
    this.stops.push(onXsOptions(() => this.requestUpdate()), onFire(() => this.requestUpdate()));
    window.addEventListener('resize', this.onResize);
    void this.load();
    this.timers.push(window.setInterval(() => (this.now = clock()), 15_000), window.setInterval(() => void this.refresh(), REFRESH_MS));
  }
  disconnectedCallback() {
    window.removeEventListener('resize', this.onResize);
    this.timers.forEach((t) => window.clearInterval(t));
    this.timers = [];
    this.stops.forEach((s) => s());
    this.stops = [];
    super.disconnectedCallback();
  }

  private async load() {
    try {
      this.tree = await loadTree();
      this.error = '';
    } catch (err) {
      this.error = describeError(err);
    }
    await this.refresh();
  }

  private async refresh() {
    this.data = await loadXsData();
    if (isApi() && canAnywhere('events.read')) {
      try {
        this.events = (await listEvents({ limit: 8, buildingId: this.building()?.id })).events;
      } catch {
        this.events = null;
      }
    }
  }

  private opts(): XsOptions {
    return isApi() ? xsOptions() : xsFromParams(xsOptions(), parseRoute().params);
  }

  private building(): Building | null {
    const t = this.tree;
    if (!t) return null;
    const wanted = parseRoute().params.get('b');
    const all = t.sites.flatMap((s) => s.buildings ?? []);
    const b = all.find((x) => x.id === wanted) ?? all[0] ?? null;
    if (!b) return null;
    const n = isApi() ? 0 : Number(parseRoute().params.get('xsdemo'));
    return Number.isInteger(n) && n > 3 && n <= 40 ? demoBuilding(n, b) : b;
  }

  private signals(floors: Floor[]): FloorSignal[] {
    if (!isApi() || this.data?.demo) return demoSignals([...floors].sort((a, b) => b.level - a.level || b.sort_order - a.sort_order));
    return signalsOf(floors, this.data?.tree ?? null, this.data?.people ?? null);
  }

  private head(c: SynColumn): TemplateResult {
    const m: Record<SynColumn, [string, string]> = { light: ['light', xt('colLight')], temp: ['therm', xt('colTemp')], presence: ['person', xt('colPresence')], cameras: ['cam', xt('colCameras')], doors: ['door', xt('colDoors')], alerts: ['bell', xt('colAlerts')], fire: ['flame', xt('colFire')] };
    return html`<span class=${c === 'presence' || c === 'doors' || c === 'cameras' ? 'hide-phone' : ''} data-syn-col=${c}>${xi(m[c][0])}${m[c][1]}</span>`;
  }

  private cell(c: SynColumn, f: FloorSignal, o: XsOptions, fire: ReturnType<typeof fireReport>) {
    const t = tempState(f, o.temp_threshold);
    switch (c) {
      case 'light': {
        const k = 8;
        const on = f.lights ? Math.round(((f.lit ?? 0) / f.lights) * k) : 0;
        return f.lit === null || f.lights === null
          ? html`<span class="cell muted" title=${xt('noSource')}>-</span>`
          : html`<span class="cell"><span class="fac" aria-hidden="true">${Array.from({ length: k }, (_, i) => html`<i class=${i < on ? 'on' : ''}></i>`)}</span><b>${f.lit}/${f.lights}</b></span>`;
      }
      case 'temp':
        return f.temp === null || f.nodata ? html`<span class="deg none" title=${xt('noSource')}>-</span>` : html`<span class="deg" data-t=${t ?? ''}>${f.temp.toFixed(1)}<small>°</small></span>`;
      case 'presence':
        return f.people === null ? html`<span class="cell muted hide-phone">-</span>` : html`<span class="cell hide-phone ${f.people ? '' : 'muted'}">${xi('person')}<b>${f.people}</b></span>`;
      case 'cameras':
        return html`<span class="cell hide-phone ${f.cams ? '' : 'muted'}">${xi('cam')}<b>${f.cams}</b>${f.shared ? html`<span class="w">${xt('camsShared', { n: f.shared })}</span>` : nothing}</span>`;
      case 'doors':
        return f.doorsOpen === null ? html`<span class="cell muted hide-phone" title=${xt('noSource')}>-</span>` : html`<span class="cell hide-phone ${f.doorsOpen ? '' : 'muted'}">${xi('door')}<b>${f.doorsOpen}</b></span>`;
      case 'alerts':
        return f.alerts === null ? html`<span class="cell muted" title=${xt('alertsNone')}>-</span>` : f.alerts ? html`<span class="cell warn">${xi('bell')}<b>${f.alerts}</b></span>` : html`<span class="cell muted">0</span>`;
      case 'fire': {
        if (!fire.connected) return html`<span class="cell muted" data-fire-nc>${xi('offline')}<span class="w">${xt('fireNotConnected')}</span></span>`;
        const z = fire.floors[f.id];
        if (!z) return html`<span class="cell muted">-</span>`;
        return z.state === 'alarm'
          ? html`<span class="fz alarm">${xi('flame')}<span class="w">${xt('fireAlarm')}</span></span>`
          : z.state === 'fault'
            ? html`<span class="fz fault">${xi('wrench')}<span class="w">${xt('fireFault')}</span></span>`
            : html`<span class="fz">${xi('check')}<span class="w">${xt('fireOk')}</span></span>`;
      }
    }
  }

  private pick(id: string) {
    this.sel = this.sel === id ? 'all' : id;
  }

  private alarmPanel(f: FloorSignal, rep: ReturnType<typeof fireReport>) {
    const z = rep.floors[f.id];
    const ack = fireAck();
    const o = this.opts();
    return html`<div class="alarmpanel ${ack ? 'ackd' : ''}" role="alert" data-alarm-panel>
      <span class="tx"><b>${ack ? xt('fireAcked', { who: ack.who }).split(' · ')[0] : xt('fireAlarm')} · ${bidi(f.name)}${rep.demo ? html`<span class="tag">${xt('fireDemo')}</span>` : nothing}</b>
        <span>${ack ? xt('fireAcked', { who: ack.who }) : xt('fireBarWhere', { zone: z.zone ?? '', device: z.device ?? '', time: z.time ?? '' })}</span></span>
      ${ack ? nothing : html`<sw-ack-button .mode=${o.ack} .allowed=${mayAck(o)} @acked=${() => acknowledgeFire(ackName())}></sw-ack-button>`}
      <button class="lnk" @click=${() => navigate(`/explore/floors/${f.id}`)}>${xt('fireOpenFloor')}</button>
    </div>`;
  }

  render() {
    const o = this.opts();
    if (this.wall && !o.wall) return html`<sw-state-panel icon="tv" state="empty" heading=${xt('wallOff')}></sw-state-panel>`;
    if (!this.tree) return this.frame(html`<sw-state-panel icon="floor" state=${this.error ? 'error' : 'loading'} hint=${this.error}></sw-state-panel>`, 0);
    const b = this.building();
    const floors = b?.floors ?? [];
    if (!b || !floors.length) return this.frame(html`<sw-state-panel icon="floor" state="empty" heading=${xt('emptyFloors')}></sw-state-panel>`, 0);
    const sigs = this.signals(floors);
    const mock = parseRoute().params.get('firemock');
    setFireMock(o.fire_ui ? mock : null, sigs);
    const rep = o.fire_ui ? fireReport() : { connected: false, demo: false, floors: {} };
    const presenceOn = this.data?.demo ? true : !!this.data?.presenceOn;
    const cols = synColumns(o, presenceOn, rep.connected);
    const t = totalsOf(sigs, o.temp_threshold);
    const alarms = o.fire_ui ? alarmFloors(rep) : [];
    const alarmF = sigs.find((s) => s.id === alarms[0]);
    const hasBelow = sigs.some((s) => s.level < 0) && sigs.some((s) => s.level >= 0);
    const phoneCols = cols.filter((c) => c === 'light' || c === 'temp' || c === 'alerts' || c === 'fire');
    let groundDone = false;
    const rows: TemplateResult[] = [];
    sigs.forEach((f) => {
      if (hasBelow && f.level < 0 && !groundDone) {
        groundDone = true;
        rows.push(html`<div class="ground" aria-hidden="true"></div>`);
      }
      const tt = tempState(f, o.temp_threshold);
      const fz = rep.floors[f.id];
      rows.push(html`<button class="srow sgrid" style="--cols:${cols.length};--pcols:${phoneCols.length}" data-syn-row=${f.id} aria-pressed=${this.sel === f.id} data-temp=${tt ?? ''} ?data-off=${f.nodata} data-fire=${fz && fz.state !== 'ok' ? fz.state : ''} @click=${() => this.pick(f.id)}
        aria-label=${`${f.name}${f.nodata ? `, ${xt('noData')}` : ''}${fz?.state === 'alarm' ? `, ${xt('fireAlarm')} (${xt('fireDemo')})` : ''}`}>
        <span class="nm"><span class="t" dir="auto">${bidi(f.name)}</span><span class="s">${f.nodata ? xt('noDataSince') : xt('level', { n: ltrNum(f.level) })}</span></span>
        ${cols.map((c) => (this.isPhoneCol(c) ? this.cell(c, f, o, rep) : html`<span class="hide-phone">${this.cell(c, f, o, rep)}</span>`))}
      </button>`);
    });
    const sf = sigs.find((s) => s.id === this.sel) ?? null;
    const chips = html`<span class="chips">
      ${t.avg !== null ? html`<span class="chip">${xi('therm')}${xt('avgTemp')} <b>${t.avg.toFixed(1)}°</b></span>` : nothing}
      ${t.litKnown ? html`<span class="chip warm">${xi('light')}<b>${t.lit}/${t.lights}</b> ${xt('lightsOn')}</span>` : nothing}
      ${cols.includes('presence') && t.people !== null ? html`<span class="chip hide-phone">${xi('person')}<b>${t.people}</b> ${xt('colPresence')}</span>` : nothing}
      ${t.doorsOpen !== null ? html`<span class="chip hide-phone">${xi('door')}<b>${t.doorsOpen}</b> ${xt('colDoors')}</span>` : nothing}
      ${t.nodata ? html`<span class="chip dash">${xi('offline')}${xt('noDataCount', { n: t.nodata })}</span>` : nothing}
      ${alarms.length ? html`<span class="chip alert">${xi('flame')}${xt('fireAlarm')} <span>${xt('fireDemo')}</span></span>` : nothing}
      ${o.fire_ui && !rep.connected && o.fire_column === 'dashed' ? html`<span class="chip dash">${xi('flame')}${xt('colFire')}: ${xt('fireNotConnected')}</span>` : nothing}
      ${rep.demo ? html`<span class="chip mock">${xt('fireDemo')}</span>` : nothing}
    </span>`;
    const board = html`<section class="card board" aria-label=${xt('synTitle')} data-syn-board style="--n:${sigs.length}">
      <div class="bhead"><h2>${xi('synoptic')}${xt('synTitle')} · ${bidi(b.name)}</h2>${chips}<span class="live"><i></i>${this.now}</span></div>
      ${alarmF ? this.alarmPanel(alarmF, rep) : html`<span></span>`}
      <div class="sgrid shdr" style="--cols:${cols.length};--pcols:${phoneCols.length}"><span>${xt('synFloor')}</span>${cols.map((c) => (this.isPhoneCol(c) ? this.head(c) : html`<span class="hide-phone">${this.head(c)}</span>`))}</div>
      <div class="srows" style="--n:${sigs.length}">${rows}</div>
      <div class="detail" data-syn-detail>${sf
        ? html`<b>${bidi(sf.name)}</b><span class="grow">${sf.nodata ? xt('noSource') : `${xt('colTemp')}: ${sf.temp === null ? '-' : `${sf.temp.toFixed(1)}°`} · ${xt('colLight')}: ${sf.lit === null ? '-' : `${sf.lit}/${sf.lights}`} · ${xt('colCameras')}: ${sf.cams}${sf.people !== null ? ` · ${xt('colPresence')}: ${sf.people}` : ''}${sf.doorsOpen !== null ? ` · ${xt('colDoors')}: ${sf.doorsOpen}` : ''}`}</span>
          <sw-button size="sm" variant="ghost" icon="map" data-syn-open @click=${() => navigate(`/explore/floors/${sf.id}`)}>${xt('openMap')}</sw-button>`
        : html`<span class="grow">${xt('synAll')} · ${xt('synSub', { n: sigs.length })}</span>`}</div>
    </section>`;
    const wide = !this.wall;
    const tree = wide
      ? html`<nav class="card tree hide-phone hide-narrow" aria-label=${xt('synAll')} data-syn-tree>
          <button aria-pressed=${this.sel === 'all'} @click=${() => (this.sel = 'all')}>${xi('synoptic')}<span class="nm">${xt('synAll')}</span><span class="lit">${t.litKnown ? t.lit : '-'}${xi('light')}</span></button>
          ${sigs.map((f) => html`<button aria-pressed=${this.sel === f.id} data-syn-tree-row=${f.id} @click=${() => (this.sel = f.id)}><span class="nm" dir="auto">${bidi(f.name)}</span><span class="lit">${f.lit === null ? '-' : f.lit}${xi('light')}</span></button>`)}
        </nav>`
      : nothing;
    const events = wide && o.syn_events
      ? html`<aside class="card events hide-phone hide-narrow" aria-label=${xt('events')} data-syn-events><h3>${xi('light')}${xt('events')}</h3>
          ${this.events && this.events.length
            ? this.events.slice(0, 8).map((e) => html`<div class="ev"><span>${xi(e.type === 'door' ? 'door' : e.type === 'offline' ? 'offline' : 'bell')}</span><span><b>${e.raw_type}</b><small>${e.camera_name ?? ''}</small></span><time>${new Date(e.occurred_at).toLocaleTimeString('he-IL', { hour: '2-digit', minute: '2-digit' })}</time></div>`)
            : html`<span class="nc">${xt('eventsNone')}</span>`}
        </aside>`
      : nothing;
    const body = html`<div class="syn ${wide && window.innerWidth >= 1100 ? 'wide' : ''} ${wide && window.innerWidth >= 1500 && o.syn_events ? 'ev' : ''}" data-syn>${window.innerWidth >= 1100 ? tree : nothing}${board}${window.innerWidth >= 1500 ? events : nothing}</div>`;
    if (this.wall) {
      return html`<div class="wallhead"><h1>${xt('wallTitle')}</h1><span class="clock">${this.now}</span></div>${body}`;
    }
    return this.frame(body, sigs.length, true);
  }

  private isPhoneCol(c: SynColumn): boolean {
    return c === 'light' || c === 'temp' || c === 'alerts' || c === 'fire';
  }

  private frame(body: TemplateResult, n: number, ready = false) {
    return html`<sw-page heading=${xt('synTitle')} subheading=${ready ? xt('synSub', { n }) : ''} data-synoptic-screen>${body}</sw-page>`;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'devices-synoptic': DevicesSynoptic;
  }
}
