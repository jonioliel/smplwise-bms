import { LitElement, html, css, nothing, type TemplateResult } from 'lit';
import { customElement, property, state } from 'lit/decorators.js';
import '../components/sw-page';
import '../components/sw-button';
import '../components/sw-state-panel';
import '../components/sw-sheet';
import '../xsection/sw-fire-bar';
import './devices-tiles-panel';
import { synPhoneStyles } from './devices-synoptic-phone-css';
import { bidi, ltrNum } from '../i18n/bidi';
import { xt } from '../i18n/xsection';
import { describeError } from '../api/client';
import { loadTree, type CatalogTree } from '../api/catalog';
import { listEvents, type VmsEvent } from '../api/events';
import { can, canAnywhere, isApi } from '../api/session';
import type { Building, Floor } from '../api/types';
import { navigate, parseRoute } from '../router';
import { demoBuilding, demoSignals, loadXsData, matchContext, type XsData } from '../xsection/xs-data';
import { acknowledgeFire, fireAck, fireReport, onFire, setFireMock } from '../xsection/fire-store';
import { ackName, mayAck } from '../xsection/sw-fire-bar';
import { xi } from '../xsection/xs-icons';
import { matchLine, unlinkedFloors } from '../xsection/sw-xsection';
import { phoneRestricted } from '../shell/phone';
import { multiBuildingOn } from '../api/mapping';
import { floorScreenBuilding } from '../api/home-site';
import { alarmFloors, floorLightsTarget, litPercent, onXsOptions, phoneBoardColumns, phoneColumns, phoneGridTemplate, phoneLightGauge, phoneSummaryParts, PHONE_DENSE_FLOORS, signalsOf, synBoardColumns, tempState, totalsOf, unassignedLights, xsFromParams, xsOptions, type FloorSignal, type SynColumn, type XsColumn, type XsOptions } from '../xsection/xs-model';
import type { XtKey } from '../i18n/xsection';
import { PollController } from '../components/poll-controller';

const REFRESH_MS = 30_000;
const COL_LABEL: Record<SynColumn, XtKey> = { light: 'colLight', temp: 'colTemp', presence: 'colPresence', cameras: 'colCameras', doors: 'colDoors', alerts: 'colAlerts', fire: 'colFire' };
/** SYNOPTIC-MOBILE-2342: the icon and the short word of each column on the phone board (the header icons carry the full name as a title). */
const PH_ICON: Record<SynColumn, string> = { light: 'light', temp: 'therm', presence: 'person', cameras: 'cam', doors: 'door', alerts: 'bell', fire: 'flame' };
const PH_WORD: Record<SynColumn, XtKey> = { light: 'lightsOn', temp: 'phTemp', presence: 'phPresence', cameras: 'colCameras', doors: 'phDoors', alerts: 'phAlerts', fire: 'phFire' };
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
  /** SWITCH-LIGHT-DIMMER-2331: the floor whose lights popup is open (a press on its lights strip / count, or the detail line's button). */
  @state() private lightsOf: FloorSignal | null = null;
  @state() private events: VmsEvent[] | null = null;
  @state() private error = '';
  @state() private sel = 'all';
  @state() private now = clock();
  /** SYNOPTIC-MOBILE-2342: the phone board's info sheet (the summary line of the wide board, behind the info button). */
  @state() private info = false;
  /** BUILDING-SCOPE-CONTROL-2351: the multi-building switch (home.multi_building) - the floor lights popup names its building to the server. */
  @state() private multiOn = false;
  private timers: number[] = [];
  /** CR-POLL-SCREENS-A-2436: the board re-read every 30 s - paused while hidden, no overlap, caught up on resume (the clock stays a plain timer). */
  private poll = new PollController(this);
  private stops: Array<() => void> = [];
  private readonly onResize = () => this.requestUpdate();

  static styles = [css`
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
    nav.tree button { transition: background var(--sw-t-hover, 120ms) var(--sw-ease-color, ease), transform var(--sw-t-press, 100ms) var(--sw-ease, ease); }
    nav.tree button:active { transform: scale(var(--sw-press-scale, 0.98)); }
    @media (hover: hover) and (pointer: fine) { nav.tree button[aria-pressed='false']:hover { background: var(--sw-surface-2); } }
    nav.tree .nm { flex: 1; min-inline-size: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
    nav.tree .lit { color: var(--sw-text-3); font-size: var(--sw-fs-state); font-variant-numeric: tabular-nums; direction: ltr; display: inline-flex; gap: 3px; align-items: center; }
    .xi { inline-size: 14px; block-size: 14px; flex: none; }
    .syn { grid-template-rows: minmax(0, 1fr); }
    .syn > * { align-self: stretch; min-block-size: 0; }
    .board { display: grid; grid-template-rows: auto auto auto minmax(0, 1fr) auto; gap: 10px; padding: 14px 16px 12px; block-size: 100%; box-sizing: border-box; }
    .bhead { display: flex; align-items: center; gap: 10px; flex-wrap: wrap; min-inline-size: 0; }
    .bhead h2 { margin: 0; font-size: var(--sw-fs-xl); font-weight: var(--sw-fw-bold); color: var(--sw-heading); display: flex; gap: 8px; align-items: center; }
    .chips { display: inline-flex; gap: 6px; flex-wrap: wrap; }
    .chip { display: inline-flex; align-items: center; gap: 5px; block-size: 28px; padding: 0 10px; border-radius: 999px; background: var(--sw-surface-2); color: var(--sw-text-2); font-size: var(--sw-fs-sm); white-space: nowrap; }
    .chip b { color: var(--sw-text); direction: ltr; unicode-bidi: isolate; font-variant-numeric: tabular-nums; }
    .chip.warm { background: color-mix(in srgb, var(--sw-lit) 26%, var(--sw-surface)); }
    .chip.alert { background: color-mix(in srgb, var(--sw-danger) 14%, var(--sw-surface)); color: var(--sw-danger-text, var(--sw-danger)); }
    .chip.dash { background: transparent; outline: 1.5px dashed var(--sw-border-strong); outline-offset: -1.5px; }
    .chip.mock { background: repeating-linear-gradient(135deg, transparent 0 5px, color-mix(in srgb, var(--sw-border-strong) 45%, transparent) 5px 6px), var(--sw-surface); box-shadow: inset 0 0 0 1px var(--sw-border-strong); color: var(--sw-text); font-weight: 600; }
    .live { margin-inline-start: auto; color: var(--sw-text-3); font-size: var(--sw-fs-state); display: inline-flex; gap: 6px; align-items: center; }
    .live i { inline-size: 7px; block-size: 7px; border-radius: 50%; background: var(--sw-live); }
    .clock { font-size: var(--sw-fs-2xl); font-weight: 800; font-variant-numeric: tabular-nums; direction: ltr; color: var(--sw-heading); }
    .sgrid { display: grid; grid-template-columns: minmax(110px, 1.3fr) repeat(var(--cols, 6), minmax(0, 1fr)); align-items: center; gap: 10px; }
    .shdr { padding: 0 12px; color: var(--sw-text-3); font-size: var(--sw-fs-state); font-weight: var(--sw-fw-semibold); }
    .shdr span { display: inline-flex; gap: 5px; align-items: center; min-inline-size: 0; overflow: hidden; white-space: nowrap; text-overflow: ellipsis; }
    .srows { display: flex; flex-direction: column; justify-content: flex-start; gap: 5px; min-block-size: 0; container-type: size; }
    .srow, nav.tree button { user-select: none; -webkit-user-select: none; -webkit-touch-callout: none; touch-action: manipulation; -webkit-tap-highlight-color: transparent; }
        .srow { flex: 1 1 0; min-block-size: 0; max-block-size: 76px; padding: 0 12px; border: 0; border-radius: var(--sw-r-md); background: var(--sw-surface-2); text-align: start; color: inherit; font: inherit; cursor: pointer; transition: background var(--sw-t-hover, 120ms) var(--sw-ease-color, ease), box-shadow var(--sw-t-hover, 120ms) var(--sw-ease-color, ease), transform var(--sw-t-press, 100ms) var(--sw-ease, ease); touch-action: manipulation; -webkit-tap-highlight-color: transparent; user-select: none; }
    .srow:active { transform: scale(var(--sw-press-scale, 0.98)); }
    @media (hover: hover) and (pointer: fine) { .srow:hover:not([aria-pressed='true']) { background: var(--sw-surface-3); } }
    .srow[aria-pressed='true'] { background: var(--sw-accent-soft); box-shadow: inset 0 0 0 2px var(--sw-accent); }
    .srow[data-temp='hot'] { background: color-mix(in srgb, var(--sw-heat) 12%, var(--sw-surface-2)); }
    .srow[data-temp='cold'] { background: color-mix(in srgb, var(--sw-cool) 12%, var(--sw-surface-2)); }
    /* SYNOPTIC-HA-2310: a floor without data is the same well, said once in muted words (no stripes, no extra edge) */
    .srow[data-off] .nm .t { color: var(--sw-text-2); }
    /* rows too short for two lines (many floors): the name only; the selected floor's detail line carries its home-system floor */
    .srows[data-dense] .nm .s { display: none; }
    .srow[data-off] .nm .s { color: var(--sw-text-3); }
    .lnk { font: inherit; font-weight: var(--sw-fw-semibold); color: var(--sw-accent-text, var(--sw-accent)); background: none; border: 0; padding: 0; cursor: pointer; text-decoration: underline; text-underline-offset: 2px; white-space: nowrap; }
    .srow[data-fire='alarm'] { background: color-mix(in srgb, var(--sw-danger) 14%, var(--sw-surface)); box-shadow: inset 0 0 0 2px var(--sw-danger); }
    .srow[aria-pressed='true'][data-fire='alarm'] { box-shadow: inset 0 0 0 2px var(--sw-accent), inset 0 0 0 4px color-mix(in srgb, var(--sw-danger) 45%, transparent); }
    .srow[data-fire='fault'] { outline: 1.5px dashed var(--sw-border-strong); outline-offset: -1.5px; }
    .nm { min-inline-size: 0; display: flex; flex-direction: column; gap: 1px; }
    .nm .t { font-size: clamp(10px, calc(100cqh / var(--n, 6) * 0.3), var(--sw-fs-md)); font-weight: var(--sw-fw-bold); color: var(--sw-heading); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
    .nm .s { font-size: var(--sw-fs-state); color: var(--sw-text-2); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
    .cell { min-inline-size: 0; display: inline-flex; align-items: center; gap: 5px; font-variant-numeric: tabular-nums; font-size: clamp(10px, calc(100cqh / var(--n, 6) * 0.3), 15px); }
    .cell b { font-weight: var(--sw-fw-bold); direction: ltr; unicode-bidi: isolate; }
    .cell.muted { color: var(--sw-text-3); }
    .cell.warn { color: var(--sw-danger-text, var(--sw-danger)); font-weight: var(--sw-fw-semibold); }
    .cell .w { min-inline-size: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
    .deg { font-size: clamp(11px, calc(100cqh / var(--n, 6) * 0.42), 24px); font-weight: 800; color: var(--sw-heading); direction: ltr; unicode-bidi: isolate; font-variant-numeric: tabular-nums; }
    .deg small { font-size: 0.6em; color: var(--sw-text-3); }
    .deg.none { color: var(--sw-text-3); }
    [data-temp='hot'] .deg { color: color-mix(in srgb, var(--sw-heat) 62%, var(--sw-heading)); }
    [data-temp='cold'] .deg { color: color-mix(in srgb, var(--sw-cool) 62%, var(--sw-heading)); }
    .fac { display: inline-flex; gap: 2px; padding: 2px; border-radius: var(--sw-r-2xs); background: var(--sw-border); block-size: clamp(8px, calc(100cqh / var(--n, 6) * 0.3), 22px); }
    .fac i { inline-size: 7px; border-radius: 2px; background: var(--sw-surface-2); }
    .fac i.on { background: color-mix(in srgb, var(--sw-lit) 82%, var(--sw-surface)); }
    .fz { display: inline-flex; gap: 5px; align-items: center; font-weight: var(--sw-fw-semibold); }
    .fz.alarm { color: var(--sw-danger-text, var(--sw-danger)); }
    .fz.fault { color: var(--sw-text-2); }
    .ground { flex: none; block-size: 2px; margin: 2px 6px; border-radius: 2px; background: var(--sw-border-strong); }
    .detail { display: flex; align-items: center; gap: 12px; flex-wrap: wrap; min-block-size: 40px; padding-block-start: 4px; border-block-start: 1px solid var(--sw-border); color: var(--sw-text-2); font-size: var(--sw-fs-base); }
    .detail b { color: var(--sw-heading); }
    .detail .grow { flex: 1; min-inline-size: 0; }
    /* SYN-COLUMNS-2321: the columns left out for want of a source, said once and quietly at the foot of the board */
    .hidnote { margin-inline-start: auto; color: var(--sw-text-3); font-size: var(--sw-fs-state); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; min-inline-size: 0; max-inline-size: 100%; }
    .hidnote .lnk { color: var(--sw-text-2); font-weight: var(--sw-fw-medium); }
    .empty { display: grid; place-items: center; padding: 24px; color: var(--sw-text-3); }
    .nc { display: flex; gap: 8px; align-items: center; color: var(--sw-text-2); font-size: var(--sw-fs-sm); }
    .alarmpanel { display: flex; align-items: center; gap: 12px; flex-wrap: wrap; padding: 10px 14px; border-radius: var(--sw-r-md); background: color-mix(in srgb, var(--sw-danger) 80%, black); color: var(--sw-text-inverse); }
    .alarmpanel.ackd { background: color-mix(in srgb, var(--sw-danger) 66%, black); }
    .alarmpanel .tx { flex: 1 1 220px; min-inline-size: 0; display: flex; flex-direction: column; }
    .alarmpanel .tag { display: inline-flex; padding: 1px 8px; border-radius: 999px; background: rgba(0, 0, 0, 0.25); font-size: var(--sw-fs-xs); font-weight: 700; margin-inline-start: 8px; }
    .alarmpanel .lnk { min-block-size: 40px; padding: 0 14px; border-radius: 999px; border: 0; background: transparent; box-shadow: inset 0 0 0 1.5px rgba(255, 255, 255, 0.7); color: var(--sw-text-inverse); font: inherit; font-weight: 600; cursor: pointer; }
    aside.events { padding: 14px 16px; display: flex; flex-direction: column; gap: 8px; overflow: hidden; align-self: stretch; }
    aside.events h3 { margin: 0; font-size: var(--sw-fs-md); color: var(--sw-heading); display: flex; gap: 6px; align-items: center; }
    .ev { display: grid; grid-template-columns: auto 1fr auto; gap: 8px; align-items: start; font-size: var(--sw-fs-sm); }
    .ev small { display: block; color: var(--sw-text-3); }
    .ev time { color: var(--sw-text-3); font-variant-numeric: tabular-nums; direction: ltr; }
    :host([wall]) .nm .t { font-size: clamp(14px, calc(100cqh / var(--n, 6) * 0.4), 30px); }
    :host([wall]) .cell, :host([wall]) .deg { font-size: clamp(14px, calc(100cqh / var(--n, 6) * 0.4), 30px); }
    :host([wall]) .shdr { font-size: var(--sw-fs-xl); }
    .wallhead { display: flex; align-items: center; justify-content: space-between; margin-block-end: 10px; gap: 12px; }
    .wallhead h1 { margin: 0; font-size: var(--sw-fs-3xl); color: var(--sw-heading); }
    @media (max-width: 767px) {
      .syn.wide, .syn.wide.ev { grid-template-columns: minmax(0, 1fr); }
      /* SYNOPTIC-MOBILE-2342 root cause: number columns of minmax(0, auto) shrank to nothing while the lights strip and the number did not,
         so lighting spilled over the cameras. The narrow wide board (only the wall screen still draws it under 768 px) gets fixed columns. */
      .sgrid { grid-template-columns: minmax(0, 1fr) repeat(var(--pcols, 3), 64px); gap: 8px; }
      .fac { display: none; }
      .cell { overflow: hidden; }
      .hide-phone { display: none !important; }
      .bhead h2 { font-size: var(--sw-fs-lg); }
    }
    .lights-hit { cursor: pointer; border-radius: var(--sw-r-sm); }
    @media (hover: hover) and (pointer: fine) { .lights-hit:hover { background: color-mix(in srgb, var(--sw-lit) 14%, transparent); } }
    :focus-visible { outline: 2px solid var(--sw-focus, var(--sw-accent)); outline-offset: 2px; }
  `, synPhoneStyles];

  connectedCallback() {
    super.connectedCallback();
    this.stops.push(onXsOptions(() => this.requestUpdate()), onFire(() => this.requestUpdate()));
    window.addEventListener('resize', this.onResize);
    void this.load();
    this.timers.push(window.setInterval(() => (this.now = clock()), 15_000));
    this.poll.every('board', REFRESH_MS, () => this.refresh());
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
    void multiBuildingOn().then((on) => (this.multiOn = on));
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

  /** SWITCH-LIGHT-DIMMER-2331: the lights popup of a floor - not on the wall screen, only with lights on the floor and devices.read (the demo shows its own rows). */
  private lightsAllowed(f: FloorSignal): boolean {
    if (this.wall || f.nodata || f.lights === null) return false;
    if (!isApi() || this.data?.demo) return true;
    return canAnywhere('devices.read') && floorLightsTarget(f) !== null;
  }

  private openLights(e: Event | null, f: FloorSignal) {
    e?.stopPropagation(); // the row's own press (select) does not run as well
    this.lightsOf = f;
  }

  private renderLights() {
    const f = this.lightsOf;
    const demo = !isApi() || !!this.data?.demo;
    const t = f && !demo ? floorLightsTarget(f) : null;
    return html`<devices-tiles-panel kind="lights" data-floor-lights=${f?.id ?? ''} ?open=${!!f} pairedMaster
      scope=${t?.scope ?? 'building'} scopeId=${t?.scopeId ?? ''} scopeName=${f?.name ?? ''} .areaFilter=${t ? t.areaIds : null} switches=${this.opts().syn_switches}
      .building=${t ? this.ctlBuilding() : ''}
      headingText=${f ? xt('floorLightsTitle', { name: f.name }) : ''}
      @panel-close=${() => (this.lightsOf = null)} @panel-changed=${() => void this.refresh()}></devices-tiles-panel>`;
  }

  /** BUILDING-SCOPE-CONTROL-2351: the building shown, when the multi-building switch is on and the site has two or more buildings ('' otherwise). */
  private ctlBuilding(): string {
    const b = this.building();
    const site = b ? this.tree?.sites.find((s) => (s.buildings ?? []).some((x) => x.id === b.id)) : null;
    return floorScreenBuilding(this.multiOn, site?.buildings?.length ?? 0, b?.id);
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
    return Number.isInteger(n) && n >= 1 && n <= 40 ? demoBuilding(n, b, parseRoute().params.get('xsnames') === 'long') : b;
  }

  private signals(floors: Floor[]): FloorSignal[] {
    if (!isApi() || this.data?.demo) return demoSignals([...floors].sort((a, b) => b.level - a.level || b.sort_order - a.sort_order), isApi() ? null : parseRoute().params.get('xsdata'));
    return signalsOf(floors, this.data?.tree ?? null, this.data?.people ?? null, this.ctx(floors), { switches: this.opts().syn_switches });
  }

  private ctx(floors: Floor[]) {
    const bid = floors[0]?.building_id;
    const site = this.tree?.sites.find((s) => (s.buildings ?? []).some((b) => b.id === bid)) ?? null;
    return matchContext(this.data, site);
  }

  /** SYNOPTIC-MOBILE-2342: the lights on no floor (not in the head chip, not in a row) - said once in the info sheet and the chip's title. */
  private noFloorLights(floors: Floor[], sigs: FloorSignal[]) {
    if (!isApi() || this.data?.demo) return null;
    return unassignedLights(this.data?.tree ?? null, sigs, this.ctx(floors), { switches: this.opts().syn_switches });
  }

  private head(c: SynColumn): TemplateResult {
    const m: Record<SynColumn, [string, string]> = { light: ['light', xt('colLight')], temp: ['therm', xt('colTemp')], presence: ['person', xt('colPresence')], cameras: ['cam', xt('colCameras')], doors: ['door', xt('colDoors')], alerts: ['bell', xt('colAlerts')], fire: ['flame', xt('colFire')] };
    return html`<span data-syn-col=${c}>${xi(m[c][0])}${m[c][1]}</span>`;
  }

  private cell(c: SynColumn, f: FloorSignal, o: XsOptions, fire: ReturnType<typeof fireReport>) {
    const t = tempState(f, o.temp_threshold);
    switch (c) {
      case 'light': {
        const k = 8;
        const on = f.lights ? Math.round(((f.lit ?? 0) / f.lights) * k) : 0;
        const can = this.lightsAllowed(f);
        return f.lit === null || f.lights === null
          ? html`<span class="cell muted" title=${xt('noSource')}>-</span>`
          : html`<span class="cell ${can ? 'lights-hit' : ''}" data-syn-lights=${can ? f.id : nothing} title=${can ? xt('floorLightsOpen', { name: f.name }) : nothing} @click=${(e: Event) => can && this.openLights(e, f)}><span class="fac" aria-hidden="true">${Array.from({ length: k }, (_, i) => html`<i class=${i < on ? 'on' : ''}></i>`)}</span><b>${f.lit}/${f.lights}</b></span>`;
      }
      case 'temp':
        return f.temp === null || f.nodata ? html`<span class="deg none" title=${xt('noSource')}>-</span>` : html`<span class="deg" data-t=${t ?? ''}>${f.temp.toFixed(1)}<small>°</small></span>`;
      case 'presence':
        return f.people === null ? html`<span class="cell muted">-</span>` : html`<span class="cell ${f.people ? '' : 'muted'}">${xi('person')}<b>${f.people}</b></span>`;
      case 'cameras':
        return html`<span class="cell ${f.cams ? '' : 'muted'}">${xi('cam')}<b>${f.cams}</b>${f.shared ? html`<span class="w">${xt('camsShared', { n: f.shared })}</span>` : nothing}</span>`;
      case 'doors':
        return f.doorsOpen === null ? html`<span class="cell muted" title=${xt('noSource')}>-</span>` : html`<span class="cell ${f.doorsOpen ? '' : 'muted'}">${xi('door')}<b>${f.doorsOpen}</b></span>`;
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
    // SYN-COLUMNS-2321: the chosen columns (preset or custom), less the ones the building has no source for (syn_hide_empty, on by default)
    const { cols, hiddenEmpty } = synBoardColumns(o, presenceOn, rep.connected, sigs);
    const has = (c: SynColumn) => cols.includes(c);
    const t = totalsOf(sigs, o.temp_threshold);
    const alarms = o.fire_ui ? alarmFloors(rep) : [];
    const alarmF = sigs.find((s) => s.id === alarms[0]);
    const hasBelow = sigs.some((s) => s.level < 0) && sigs.some((s) => s.level >= 0);
    const phoneCols = phoneColumns(cols);
    this.phoneSet = new Set(phoneCols);
    let groundDone = false;
    const rows: TemplateResult[] = [];
    sigs.forEach((f) => {
      if (hasBelow && f.level < 0 && !groundDone) {
        groundDone = true;
        rows.push(html`<div class="ground" aria-hidden="true"></div>`);
      }
      const tt = has('temp') ? tempState(f, o.temp_threshold) : null;
      const fz = rep.floors[f.id];
      rows.push(html`<button class="srow sgrid" style="--cols:${cols.length};--pcols:${phoneCols.length}" data-syn-row=${f.id} aria-pressed=${this.sel === f.id} data-temp=${tt ?? ''} ?data-off=${f.nodata} data-fire=${fz && fz.state !== 'ok' ? fz.state : ''} @click=${() => this.pick(f.id)}
        aria-label=${`${f.name}${f.nodata ? `, ${xt('noData')}` : ''}${fz?.state === 'alarm' ? `, ${xt('fireAlarm')} (${xt('fireDemo')})` : ''}`}>
        <span class="nm"><span class="t" dir="auto" title=${f.name}>${bidi(f.name)}</span><span class="s" data-syn-match=${f.match?.how ?? (f.match ? 'none' : '')}>${this.subLine(f)}</span></span>
        ${cols.map((c) => (this.isPhoneCol(c) ? this.cell(c, f, o, rep) : html`<span class="hide-phone">${this.cell(c, f, o, rep)}</span>`))}
      </button>`);
    });
    const sf = sigs.find((s) => s.id === this.sel) ?? null;
    const noFloor = has('light') ? this.noFloorLights(floors, sigs) : null;
    const chips = html`<span class="chips">
      ${has('temp') && t.avg !== null ? html`<span class="chip" data-syn-chip="temp">${xi('therm')}${xt('avgTemp')} <b>${t.avg.toFixed(1)}°</b></span>` : nothing}
      ${has('light') && t.litKnown ? html`<span class="chip warm" data-syn-chip="light" title=${noFloor ? `${xt('synInfoNoFloor')}: ${xt('synInfoNoFloorVal', noFloor)}` : nothing}>${xi('light')}<b>${t.lit}/${t.lights}</b> ${xt('lightsOn')}</span>` : nothing}
      ${has('presence') && t.people !== null ? html`<span class="chip hide-phone" data-syn-chip="presence">${xi('person')}<b>${t.people}</b> ${xt('colPresence')}</span>` : nothing}
      ${has('doors') && t.doorsOpen !== null ? html`<span class="chip hide-phone" data-syn-chip="doors">${xi('door')}<b>${t.doorsOpen}</b> ${xt('colDoors')}</span>` : nothing}
      ${t.nodata ? html`<span class="chip dash">${xi('offline')}${xt('noDataCount', { n: t.nodata })}</span>` : nothing}
      ${alarms.length ? html`<span class="chip alert">${xi('flame')}${xt('fireAlarm')} <span>${xt('fireDemo')}</span></span>` : nothing}
      ${o.fire_ui && !rep.connected && o.fire_column === 'dashed' ? html`<span class="chip dash">${xi('flame')}${xt('colFire')}: ${xt('fireNotConnected')}</span>` : nothing}
      ${rep.demo ? html`<span class="chip mock">${xt('fireDemo')}</span>` : nothing}
    </span>`;
    if (!this.wall && window.innerWidth < 768) {
      // SYNOPTIC-MOBILE-2342 (sub-answer 4C): only the page title, the building and its floors under it - no second title on the card
      const phone = this.renderPhone(b, sigs, cols, hiddenEmpty, o, rep, chips, alarmF ?? null, hasBelow, noFloor);
      return this.frame(html`${phone}${this.renderLights()}`, sigs.length, true, xt('synSite', { name: bidi(b.name), n: sigs.length }));
    }
    const board = html`<section class="card board" aria-label=${xt('synTitle')} data-syn-board style="--n:${sigs.length}">
      <div class="bhead"><h2>${xi('synoptic')}${xt('synTitle')} · ${bidi(b.name)}</h2>${chips}<span class="live"><i></i>${this.now}</span></div>
      ${alarmF ? this.alarmPanel(alarmF, rep) : html`<span></span>`}
      <div class="sgrid shdr" style="--cols:${cols.length};--pcols:${phoneCols.length}"><span>${xt('synFloor')}</span>${cols.map((c) => (this.isPhoneCol(c) ? this.head(c) : html`<span class="hide-phone">${this.head(c)}</span>`))}</div>
      <div class="srows" style="--n:${sigs.length}" ?data-dense=${(window.innerHeight - 330) / Math.max(1, sigs.length) < 40}>${rows}</div>
      <div class="detail" data-syn-detail>${sf
        ? html`<b>${bidi(sf.name)}</b><span class="grow">${matchLine(sf.match) ? `${matchLine(sf.match)!.text} · ` : ''}${sf.nodata ? xt('noSource') : this.detailText(sf, has)}</span>
          ${matchLine(sf.match)?.linked === false && this.canLink() ? html`<button class="lnk" data-syn-link=${sf.id} @click=${() => this.linkFloor(b, sf.id)}>${xt('matchFix')}</button>` : nothing}
          ${has('light') && this.lightsAllowed(sf) ? html`<sw-button size="sm" variant="ghost" icon="light" data-syn-lights-open=${sf.id} @click=${() => this.openLights(null, sf)}>${xt('floorLightsBtn')}</sw-button>` : nothing}
          <sw-button size="sm" variant="ghost" icon="map" data-syn-open @click=${() => navigate(`/explore/floors/${sf.id}`)}>${xt('openMap')}</sw-button>`
        : this.allLine(b, sigs)}${this.hiddenNote(hiddenEmpty)}</div>
    </section>`;
    const wide = !this.wall;
    const tree = wide
      ? html`<nav class="card tree hide-phone hide-narrow" aria-label=${xt('synAll')} data-syn-tree>
          <button aria-pressed=${this.sel === 'all'} @click=${() => (this.sel = 'all')}>${xi('synoptic')}<span class="nm">${xt('synAll')}</span>${has('light') ? html`<span class="lit">${t.litKnown ? t.lit : '-'}${xi('light')}</span>` : nothing}</button>
          ${sigs.map((f) => html`<button aria-pressed=${this.sel === f.id} data-syn-tree-row=${f.id} @click=${() => (this.sel = f.id)}><span class="nm" dir="auto">${bidi(f.name)}</span>${has('light') ? html`<span class="lit">${f.lit === null ? '-' : f.lit}${xi('light')}</span>` : nothing}</button>`)}
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
    return this.frame(html`${body}${this.renderLights()}`, sigs.length, true);
  }

  /** SYNOPTIC-HA-2310: the row's second line - the level and the home-system floor it stands for (how it was matched), or why there is no data. */
  private subLine(f: FloorSignal): string {
    const ml = matchLine(f.match);
    if (!ml) return f.nodata ? xt('noDataSince') : xt('level', { n: ltrNum(f.level) });
    return ml.linked ? `${xt('level', { n: ltrNum(f.level) })} · ${ml.text}` : ml.text;
  }

  /** The detail line with no floor selected: the building, or - once - the floors no rule links to the home system, with the way to link them. */
  private allLine(b: Building, sigs: FloorSignal[]) {
    const un = unlinkedFloors(sigs);
    if (!un.length) return html`<span class="grow">${xt('synAll')} · ${xt('synSub', { n: sigs.length })}</span>`;
    const text = un.length === 1 ? xt('matchHintOne', { name: un[0].name }) : xt('matchHintMany', { n: un.length });
    return html`<span class="grow" data-syn-hint>${text}</span>${this.canLink() ? html`<button class="lnk" data-syn-link=${un[0].id} @click=${() => this.linkFloor(b, un[0].id)}>${xt('matchHintAction')}</button>` : nothing}`;
  }

  /** SYNOPTIC-PHONE-SETTINGS-2360: who may open הגדרות › כללי (the route's own permission, nav.ts: system.configure). The demo has no sign-in. */
  private canOpenMapSettings(): boolean {
    return !this.wall && (!isApi() || can('system.configure'));
  }

  private canLink(): boolean {
    // the editor lives with the floors' structure tools, which a phone hides by the installation's option (ui.mobile hide_structure)
    return !this.wall && !phoneRestricted('structure') && (!isApi() || canAnywhere('site.content.configure'));
  }

  /** The link editor lives with the floors (floors screen, "קישור למערכת הבית"); `?ha=` opens it on that floor. */
  private linkFloor(b: Building, floorId: string) {
    const keep = isApi() ? {} : Object.fromEntries([...parseRoute().params.entries()].filter(([k]) => k.startsWith('xs')));
    navigate(`/explore/buildings/${b.id}/floors`, { ...keep, ha: floorId });
  }

  /** The phone's columns of the current render (phoneColumns: at most three signals, lighting / temperature / alerts first). */
  private phoneSet = new Set<SynColumn>();
  private isPhoneCol(c: SynColumn): boolean {
    return this.phoneSet.has(c);
  }

  /** The selected floor's line: only the columns the board draws (a hidden column is not repeated here as a "-"). */
  private detailText(f: FloorSignal, has: (c: SynColumn) => boolean): string {
    const parts: string[] = [];
    if (has('temp')) parts.push(`${xt('colTemp')}: ${f.temp === null ? '-' : `${f.temp.toFixed(1)}°`}`);
    if (has('light')) parts.push(`${xt('colLight')}: ${f.lit === null ? '-' : `${f.lit}/${f.lights}`}`);
    if (has('cameras')) parts.push(`${xt('colCameras')}: ${f.cams}`);
    if (has('presence') && f.people !== null) parts.push(`${xt('colPresence')}: ${f.people}`);
    if (has('doors') && f.doorsOpen !== null) parts.push(`${xt('colDoors')}: ${f.doorsOpen}`);
    return parts.join(' · ');
  }

  /** SYN-COLUMNS-2321: the quiet note under the board - which columns the hide-empty rule left out, and the way to the option. */
  private hiddenNote(hidden: readonly SynColumn[]) {
    if (!hidden.length) return nothing;
    const names = hidden.map((c) => xt(COL_LABEL[c])).join(', ');
    return html`<span class="hidnote" data-syn-hidden=${hidden.join(',')}>${xt('hiddenEmpty', { cols: names })}${this.wall ? nothing : html` · <button class="lnk" data-syn-hidden-opt @click=${() => navigate('/system/diagnostics', { focus: 'xs' })}>${xt('hiddenEmptyOpt')}</button>`}</span>`;
  }

  private frame(body: TemplateResult, n: number, ready = false, sub?: string) {
    return html`<sw-page heading=${xt('synTitle')} subheading=${ready ? sub ?? xt('synSub', { n }) : ''} data-synoptic-screen>${body}</sw-page>`;
  }

  /* ------------------------------------------------------------ the phone board (SYNOPTIC-MOBILE-2342) */

  private openFloor(f: FloorSignal) {
    this.info = false;
    navigate(`/explore/floors/${f.id}`);
  }

  /**
   * Under 768 px: the layout of "תצוגת המפה הסינופטית בטלפון" (ui.xs syn_phone_view) - A table (default), B floor cards, C the cross-section
   * first. All three: the head chips with the clock and the info button (the summary lives in its sheet, sub-answer 3B), a press on a floor's
   * lighting opens its lights popup, only the list scrolls. A and B open the floor from its name; C selects it first (the strip opens it).
   */
  private renderPhone(b: Building, sigs: FloorSignal[], cols: SynColumn[], hiddenEmpty: readonly XsColumn[], o: XsOptions, rep: ReturnType<typeof fireReport>, chips: TemplateResult, alarmF: FloorSignal | null, hasBelow: boolean, noFloor: { lit: number; lights: number } | null) {
    const w = window.innerWidth;
    const { cols: pc, dashed } = phoneBoardColumns(cols, sigs, w);
    const dash = new Set<SynColumn>(dashed);
    const dense = sigs.length > PHONE_DENSE_FLOORS;
    const view = o.syn_phone_view;
    // SYNOPTIC-PHONE-SETTINGS-2360: "שורת סיכום בטלפון" - the info button and its sheet (default), a line under the board, or neither
    const sum = phoneSummaryParts(o.syn_phone_summary, this.canOpenMapSettings());
    const sumLine = sum.line ? this.summaryLine(b, sigs, hiddenEmpty, noFloor, view !== 'section') : nothing;
    const head = html`<div class="phead">${chips}<span class="live"><i></i>${this.now}</span>
      ${sum.button ? html`<button class="ib" data-syn-info aria-haspopup="dialog" aria-label=${xt('synInfo')} title=${xt('synInfo')} @click=${() => (this.info = true)}>${xi('info')}</button>` : nothing}
      ${sum.settings ? html`<button class="ib" data-syn-map-settings aria-label=${xt('synInfoSettings')} title=${xt('synInfoSettings')} @click=${() => navigate('/system/diagnostics', { focus: 'xs' })}>${xi('wrench')}</button>` : nothing}</div>`;
    const alarm = alarmF ? this.alarmPanel(alarmF, rep) : html`<span></span>`;
    const isBelow = (f: FloorSignal, i: number) => hasBelow && f.level < 0 && (i === 0 || sigs[i - 1].level >= 0);
    const rowAria = (f: FloorSignal) => `${f.name}${f.nodata ? `, ${xt('noData')}` : ''}${this.detailText(f, (c) => pc.includes(c)) ? `: ${this.detailText(f, (c) => pc.includes(c))}` : ''}`;
    const grid = phoneGridTemplate(pc);
    let body: TemplateResult;
    if (view === 'cards') {
      const items: TemplateResult[] = [];
      sigs.forEach((f, i) => {
        if (isBelow(f, i)) items.push(html`<div class="pgl" aria-hidden="true">${xt('synGroundLine')}</div>`);
        const fz = rep.floors[f.id];
        const name = html`<span><span class="t" dir="auto" title=${f.name}>${bidi(f.name)}</span>${dense ? nothing : html`<span class="s" data-syn-match=${f.match?.how ?? (f.match ? 'none' : '')}>${this.subLine(f)}</span>`}</span>`;
        items.push(dense
          ? html`<div class="card pfc row" role="group" aria-label=${rowAria(f)} data-syn-row=${f.id} ?data-off=${f.nodata} data-fire=${fz && fz.state !== 'ok' ? fz.state : ''}>
              <div class="pfr" style="--pgrid:${grid} 16px">
                <button class="pfh" data-syn-open-floor=${f.id} @click=${() => this.openFloor(f)}>${name}</button>
                ${pc.map((c) => this.phoneCell(c, f, o, rep, dash.has(c)))}${xi('fwd', 'fwd')}
              </div></div>`
          : html`<div class="card pfc" role="group" aria-label=${rowAria(f)} data-syn-row=${f.id} ?data-off=${f.nodata} data-fire=${fz && fz.state !== 'ok' ? fz.state : ''}>
              <button class="pfh" data-syn-open-floor=${f.id} @click=${() => this.openFloor(f)}>${name}${xi('fwd', 'fwd')}</button>
              ${pc.length ? html`<div class="pfm">${pc.map((c) => this.phoneMetric(c, f, o, rep, dash.has(c)))}</div>` : nothing}
            </div>`);
      });
      body = html`<section class="pboard pb" aria-label=${xt('synTitle')} data-syn-board data-syn-phone="cards" data-sum=${o.syn_phone_summary}>${head}${alarm}<div class="pbl" ?data-dense=${dense}>${items}</div>${sumLine}</section>`;
    } else if (view === 'section') {
      const slab = w < 360 ? 52 : w > 410 ? 72 : 64;
      const showSub = w >= 360 && !dense;
      const out: TemplateResult[] = [html`<span class="roof" aria-hidden="true"></span><span aria-hidden="true"></span>`];
      sigs.forEach((f, i) => {
        if (isBelow(f, i)) out.push(html`<span class="soil" aria-hidden="true"></span><span class="soiltx" aria-hidden="true"></span>`);
        const on = this.sel === f.id;
        out.push(html`<span class="sl ${f.level < 0 ? 'bg' : ''}" aria-hidden="true" ?data-sel=${on}><i style="inline-size:${litPercent(f)}%"></i><em>${ltrNum(f.level)}</em></span>
          <div class="ci" role="group" aria-label=${rowAria(f)} data-syn-row=${f.id} ?data-off=${f.nodata}>
            <button class="pl1" data-syn-sel=${f.id} aria-pressed=${on} aria-label=${xt('synSelectAria', { name: f.name })} @click=${() => this.pick(f.id)}><span class="t" dir="auto" title=${f.name}>${bidi(f.name)}</span>${showSub ? html`<span class="s" data-syn-match=${f.match?.how ?? (f.match ? 'none' : '')}>${this.subLine(f)}</span>` : nothing}</button>
            <span class="ppls">${pc.map((c) => this.phonePill(c, f, o, rep, dash.has(c)))}</span>
          </div>`);
      });
      const sf = sigs.find((s) => s.id === this.sel) ?? null;
      const t = totalsOf(sigs, o.temp_threshold);
      const lightsText = (lit: number | null, lights: number | null) => (lit === null || lights === null ? '' : ` · ${ltrNum(`${lit}/${lights}`)} ${xt('lightsOn')}`);
      const strip = sf
        ? html`<span class="tx"><b title=${sf.name}>${bidi(sf.name)}</b>${this.subLine(sf)}${pc.includes('light') ? lightsText(sf.lit, sf.lights) : ''}</span>
            <sw-button size="sm" variant="primary" data-syn-open @click=${() => this.openFloor(sf)}>${xt('synOpenFloor')}</sw-button>`
        : html`<span class="tx"><b>${xt('synAll')}</b>${xt('synFloorsN', { n: sigs.length })}${pc.includes('light') && t.litKnown ? lightsText(t.lit, t.lights) : ''}</span>
            ${sum.button ? html`<sw-button size="sm" variant="ghost" data-syn-details @click=${() => (this.info = true)}>${xt('synDetails')}</sw-button>` : nothing}`;
      body = html`<section class="card pboard pc" aria-label=${xt('synTitle')} data-syn-board data-syn-phone="section" data-sum=${o.syn_phone_summary} style="--slab:${slab}px">${head}${alarm}
        <div class="cl" ?data-dense=${dense}>${out}</div><div class="dstrip" data-syn-strip>${strip}</div>${sumLine}</section>`;
    } else {
      const rows: TemplateResult[] = [];
      sigs.forEach((f, i) => {
        if (isBelow(f, i)) rows.push(html`<div class="ground" aria-hidden="true"></div>`);
        const tt = pc.includes('temp') ? tempState(f, o.temp_threshold) : null;
        const fz = rep.floors[f.id];
        const sub = this.subLine(f);
        rows.push(html`<div class="par" role="group" aria-label=${rowAria(f)} data-syn-row=${f.id} data-temp=${tt ?? ''} ?data-off=${f.nodata} data-fire=${fz && fz.state !== 'ok' ? fz.state : ''}>
          <button class="pan" data-syn-open-floor=${f.id} @click=${() => this.openFloor(f)}><span class="t" dir="auto" title=${f.name}>${bidi(f.name)}</span><span class="s" title=${sub} data-syn-match=${f.match?.how ?? (f.match ? 'none' : '')}>${sub}</span></button>
          ${pc.map((c) => this.phoneCell(c, f, o, rep, dash.has(c)))}
        </div>`);
      });
      body = html`<section class="card pboard pa" aria-label=${xt('synTitle')} data-syn-board data-syn-phone="table" data-sum=${o.syn_phone_summary} style="--pgrid:${grid}">${head}${alarm}
        <div class="pah" aria-hidden="true"><span>${xt('synFloor')}</span>${pc.map((c) => html`<span data-syn-col=${c} title=${xt(COL_LABEL[c])}>${xi(PH_ICON[c])}</span>`)}</div>
        <div class="plist" ?data-dense=${dense}>${rows}</div>${sumLine}</section>`;
    }
    return html`${body}${sum.button ? this.renderInfo(b, sigs, cols, pc, hiddenEmpty, noFloor) : nothing}`;
  }

  /** What one phone cell / metric / pill draws for a column: the value (null = no source, drawn "-"), whether it is quiet, a warning, a tone. */
  private phoneValue(c: SynColumn, f: FloorSignal, o: XsOptions, rep: ReturnType<typeof fireReport>): { v: TemplateResult | null; mut: boolean; warn?: boolean; tone?: string; title?: string; nc?: boolean } {
    switch (c) {
      case 'light':
        return f.lit === null || f.lights === null || f.nodata ? { v: null, mut: true } : { v: html`<span class="n">${f.lit}</span><small>/${f.lights}</small>`, mut: !f.lit };
      case 'temp':
        return f.temp === null || f.nodata ? { v: null, mut: true } : { v: html`<span class="n">${f.temp.toFixed(1)}</span><small>°</small>`, mut: false, tone: tempState(f, o.temp_threshold) ?? undefined };
      case 'presence':
        return f.people === null ? { v: null, mut: true } : { v: html`<span class="n">${f.people}</span>`, mut: !f.people };
      case 'cameras':
        return { v: html`<span class="n">${f.cams}</span>${f.shared ? html`<small>+${f.shared}</small>` : nothing}`, mut: !f.cams && !f.shared, title: f.shared ? xt('camsShared', { n: f.shared }) : undefined };
      case 'doors':
        return f.doorsOpen === null || f.nodata ? { v: null, mut: true } : { v: html`<span class="n">${f.doorsOpen}</span>`, mut: !f.doorsOpen };
      case 'alerts':
        return f.alerts === null ? { v: null, mut: true, title: xt('alertsNone') } : { v: html`<span class="n">${f.alerts}</span>`, mut: !f.alerts, warn: !!f.alerts };
      case 'fire': {
        if (!rep.connected) return { v: xi('offline'), mut: true, title: xt('fireNotConnected'), nc: true };
        const z = rep.floors[f.id];
        if (!z) return { v: null, mut: true };
        return z.state === 'alarm' ? { v: xi('flame'), mut: false, warn: true, title: xt('fireAlarm') } : z.state === 'fault' ? { v: xi('wrench'), mut: true, title: xt('fireFault') } : { v: xi('check'), mut: true, title: xt('fireOk') };
      }
    }
  }

  private lightsAria(f: FloorSignal): string {
    return xt('synLightsAria', { name: f.name, lit: f.lit ?? 0, lights: f.lights ?? 0 });
  }

  /**
   * SYNOPTIC-PHONE-SETTINGS-2360 "תאורה בטלפון" (ui.xs syn_phone_light): what sits under "2/10" in the table cell and the card tile - the small bar
   * (default, as 2.34.2), the segment strip (one segment a light, at most eight, in the same width) or nothing (the number only).
   */
  private lightGauge(f: FloorSignal, o: XsOptions) {
    const g = phoneLightGauge(o.syn_phone_light, f);
    if (g.kind === 'none') return nothing;
    if (g.kind === 'segments') return html`<span class="mb seg" aria-hidden="true" data-syn-gauge="segments">${Array.from({ length: g.total }, (_, i) => html`<i class=${i < g.on ? 'on' : ''}></i>`)}</span>`;
    return html`<span class="mb" aria-hidden="true" data-syn-gauge="bar"><i style="inline-size:${g.percent}%"></i></span>`;
  }

  /**
   * SYNOPTIC-PHONE-SETTINGS-2360: the summary as one line under the board (syn_phone_summary=line) - the wide board's detail line: the building and
   * its floors, the columns the hide-empty rule left out (with the way to the setting), the lights on no floor, the floors no rule links. With
   * `title` off (the cross-section, whose bottom strip already says "כל המבנה · N קומות") only the notes appear, and nothing at all when there are none.
   */
  private summaryLine(b: Building, sigs: FloorSignal[], hiddenEmpty: readonly XsColumn[], noFloor: { lit: number; lights: number } | null, title: boolean) {
    const un = unlinkedFloors(sigs);
    const hint = un.length ? (un.length === 1 ? xt('matchHintOne', { name: un[0].name }) : xt('matchHintMany', { n: un.length })) : '';
    if (!title && !hiddenEmpty.length && !noFloor && !hint) return nothing;
    return html`<div class="psum" data-syn-summary="line">
      ${title ? html`<span class="st"><b>${xt('synAll')}</b> · ${xt('synFloorsN', { n: sigs.length })}</span>` : nothing}
      ${this.hiddenNote(hiddenEmpty)}
      ${noFloor ? html`<span data-syn-summary-nofloor>${xt('synInfoNoFloor')}: ${xt('synInfoNoFloorVal', noFloor)}</span>` : nothing}
      ${hint ? html`<span data-syn-hint>${hint}${this.canLink() ? html` · <button class="lnk" data-syn-link=${un[0].id} @click=${() => this.linkFloor(b, un[0].id)}>${xt('matchHintAction')}</button>` : nothing}</span>` : nothing}
    </div>`;
  }

  /** A - a table cell (B's dense row too): the number centred in its fixed column; lighting is "2/10" over a small bar and opens the popup. */
  private phoneCell(c: SynColumn, f: FloorSignal, o: XsOptions, rep: ReturnType<typeof fireReport>, dashed: boolean) {
    const p = this.phoneValue(c, f, o, rep);
    if (c === 'light' && p.v && !dashed) {
      const inner = html`<span class="pv ${p.mut ? 'mut' : ''}"><span class="n">${f.lit}/${f.lights}</span></span>${this.lightGauge(f, o)}`;
      return this.lightsAllowed(f)
        ? html`<button class="plc" data-syn-lights=${f.id} aria-label=${this.lightsAria(f)} title=${xt('floorLightsOpen', { name: f.name })} @click=${(e: Event) => this.openLights(e, f)}>${inner}</button>`
        : html`<span class="plc">${inner}</span>`;
    }
    const none = dashed || !p.v;
    return html`<span class="pcell" data-syn-cell=${c} ?data-fire-nc=${p.nc}><span class="pv ${none || p.mut ? 'mut' : ''} ${p.warn ? 'warn' : ''}" data-t=${p.tone ?? nothing} title=${none ? xt('noSource') : p.title ?? nothing}>${none ? '-' : p.v}</span></span>`;
  }

  /** B - a metric tile of a floor card: the word over the number; lighting carries a bar and opens the popup; a column with no source is dashed. */
  private phoneMetric(c: SynColumn, f: FloorSignal, o: XsOptions, rep: ReturnType<typeof fireReport>, dashed: boolean) {
    const p = this.phoneValue(c, f, o, rep);
    const none = dashed || !p.v;
    const k = html`<span class="k">${xi(PH_ICON[c])}${xt(PH_WORD[c])}</span>`;
    if (c === 'light' && !none) {
      const inner = html`${k}<span class="pval">${p.v}</span>${this.lightGauge(f, o)}`;
      return this.lightsAllowed(f)
        ? html`<button class="pmt lit" data-syn-lights=${f.id} aria-label=${this.lightsAria(f)} @click=${(e: Event) => this.openLights(e, f)}>${inner}</button>`
        : html`<div class="pmt lit">${inner}</div>`;
    }
    return html`<div class="pmt ${none ? 'mut' : p.mut ? 'mut' : ''} ${dashed ? 'dash' : ''} ${p.warn ? 'warn' : ''}" data-syn-cell=${c} ?data-fire-nc=${p.nc} title=${none ? xt('noSource') : p.title ?? nothing}>${k}<span class="pval" data-t=${p.tone ?? nothing}>${none ? '-' : p.v}</span></div>`;
  }

  /** C - a pill beside a floor of the section. */
  private phonePill(c: SynColumn, f: FloorSignal, o: XsOptions, rep: ReturnType<typeof fireReport>, dashed: boolean) {
    const p = this.phoneValue(c, f, o, rep);
    const none = dashed || !p.v;
    if (c === 'light' && !none && this.lightsAllowed(f)) {
      return html`<button class="ppl lit" data-syn-lights=${f.id} aria-label=${this.lightsAria(f)} @click=${(e: Event) => this.openLights(e, f)}>${xi('light')}<span class="n">${f.lit}/${f.lights}</span></button>`;
    }
    const cls = c === 'light' && !none ? 'lit' : none ? (dashed ? 'dash mut' : 'mut') : `${p.mut ? 'mut' : ''} ${p.warn ? 'warn' : ''}`;
    return html`<span class="ppl ${cls}" data-syn-cell=${c} ?data-fire-nc=${p.nc} title=${none ? xt('noSource') : p.title ?? xt(COL_LABEL[c])}>${c === 'fire' ? nothing : xi(PH_ICON[c])}${none ? '-' : c === 'light' ? html`<span class="n">${f.lit}/${f.lights}</span>` : p.v}</span>`;
  }

  /** Sub-answer 3B: the wide board's summary line (floors, the columns drawn and hidden, lights on no floor, unlinked floors) as a sheet. */
  private renderInfo(b: Building, sigs: FloorSignal[], cols: readonly SynColumn[], pc: readonly SynColumn[], hiddenEmpty: readonly XsColumn[], noFloor: { lit: number; lights: number } | null) {
    const names = (cs: readonly SynColumn[]) => cs.map((c) => xt(COL_LABEL[c])).join(', ');
    const wideOnly = cols.filter((c) => !pc.includes(c));
    const un = unlinkedFloors(sigs);
    const hint = un.length ? (un.length === 1 ? xt('matchHintOne', { name: un[0].name }) : xt('matchHintMany', { n: un.length })) : '';
    return html`<sw-sheet narrow heading=${xt('synInfoTitle', { name: bidi(b.name) })} ?open=${this.info} data-syn-info-sheet @close=${() => (this.info = false)}>
      ${this.info
        ? html`<div class="pinfo">
            <p class="sub">${xt('synBoardSub')}</p>
            <dl>
              <dt>${xt('synInfoFloors')}</dt><dd>${ltrNum(sigs.length)}</dd>
              <dt>${xt('synInfoShown')}</dt><dd data-syn-info-shown>${pc.length ? names(pc) : '-'}</dd>
              ${wideOnly.length ? html`<dt>${xt('synInfoWide')}</dt><dd data-syn-info-wide>${names(wideOnly)}</dd>` : nothing}
              ${hiddenEmpty.length ? html`<dt>${xt('synInfoHidden')}</dt><dd data-syn-info-hidden>${names(hiddenEmpty)}</dd>` : nothing}
              ${noFloor ? html`<dt>${xt('synInfoNoFloor')}</dt><dd data-syn-info-nofloor>${xt('synInfoNoFloorVal', noFloor)}</dd>` : nothing}
            </dl>
            ${hint ? html`<p class="hint" data-syn-hint>${hint}</p>` : nothing}
            <div class="acts">
              ${hint && this.canLink() ? html`<sw-button size="sm" variant="ghost" data-syn-link=${un[0].id} @click=${() => this.linkFloor(b, un[0].id)}>${xt('matchHintAction')}</sw-button>` : nothing}
              <sw-button size="sm" variant="ghost" data-syn-info-settings @click=${() => { this.info = false; navigate('/system/diagnostics', { focus: 'xs' }); }}>${xt('synInfoSettings')}</sw-button>
            </div>
          </div>`
        : nothing}
    </sw-sheet>`;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'devices-synoptic': DevicesSynoptic;
  }
}
