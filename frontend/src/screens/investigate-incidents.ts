import { LitElement, html, css, nothing, type PropertyValues } from 'lit';
import { customElement, property, state } from 'lit/decorators.js';
import '../components/sw-button';
import '../components/sw-icon';
import '../components/sw-state-panel';
import '../components/sw-camera-tile';
import '../components/sw-case-picker';
import '../components/sw-sheet';
import '../map/sw-plan-canvas';
import '../incidents/settings-form';
import type { PlanMarker } from '../map/sw-plan-canvas';
import type { NewCaseItem } from '../api/cases';
import { ApiError, describeError } from '../api/client';
import { isApi, canAnywhere, can } from '../api/session';
import { cameraState, loadMap, type MapBundle } from '../api/maps';
import { entityMarkerKind } from '../api/ha';
import { zonesWithChips } from '../map/shared-space';
import { snapshotUrl } from '../api/media';
import { REFUSED_MS } from '../api/live-budget';
import { liveCapTitle } from '../components/sw-live-player';
import { listElevators, type Elevator } from '../api/elevators';
import { listDevices, type GenDevice } from '../api/generator';
import { getAccessEvents } from '../api/access-events';
import { loadTree } from '../api/catalog';
import { dayMonthText, timeText } from '../api/day-format';
import {
  ackIncident, closeIncident, elapsed, getIncident, incidentCameras, incidentDoors, listIncidents, noteIncident, openIncident, DEFAULT_SETTINGS,
  type Incident, type IncidentCameras, type IncidentDetail, type IncidentDoors, type IncidentStep, type IncidentSettings,
} from '../api/incidents';
import { elt } from '../i18n/elevators';
import { it } from '../i18n/incidents';
import { navigate } from '../router';
import { refreshIncidents } from '../incidents/store';
import { SkinController } from '../design/skin';
import { leadReserveStyles } from '../styles/lead-reserve';

type Part = 'cams' | 'map' | 'doors' | 'chain';
type Look = 'ok' | 'warn' | 'alarm' | 'off' | 'unk' | 'acc';
type Panel<T> = { state: 'loading' } | { state: 'ready'; data: T } | { state: 'forbidden' } | { state: 'error'; message: string } | { state: 'hidden' };

const NARROW = '(max-width: 1199px)';
const ELEVATOR_STATE_KEY: Record<string, Parameters<typeof elt>[0]> = {
  fire_service: 'stateFireService', fault: 'stateFault', out_of_service: 'stateOutOfService', active: 'stateActive', moving_up: 'stateMovingUp',
  moving_down: 'stateMovingDown', door_open: 'stateDoorOpen', waiting: 'stateWaiting', travelling: 'stateTravelling', unknown: 'stateUnknown',
};
const ELEVATOR_LOOK: Record<string, Look> = { fire_service: 'alarm', fault: 'alarm', out_of_service: 'off', unknown: 'unk', moving_up: 'acc', moving_down: 'acc', travelling: 'acc' };

const forbidden = (err: unknown) => err instanceof ApiError && err.status === 403;

/**
 * CR-LIVEEVENT100 (owner-approved mockup v2, docs/design/mockups/liveevent-100): אבטחה › חקירה › "אירוע חי".
 *
 * `#/investigate/incidents` - the list (the open incidents first, then the closed ones of the retention window) and the manual opening;
 * `#/investigate/incidents/<id>` - ONE screen for ONE incident: the floor plan with the event location, the nearest cameras live (sub
 * profile, a budget of live tiles, the rest snapshots), the doors around it (state, who opened), the elevators and the generator, and the
 * chain of handling as a vertical timeline in the side rail.
 *
 * Read-mostly: the only actions are the existing, already-permissioned ones (acknowledge, add to a case, close, links out). NOTHING
 * physical is operated from here: no door open, no emergency, no alarm arm / disarm / bypass, no PTZ ("לדלת" opens the device's own
 * screen, where every door command keeps its existing per-action confirmation).
 *
 * NO SCROLLING (owner hard rule 2026-10-24): the page fills the height the shell leaves it; every panel either sizes to its content or
 * fills what remains (flex: 1; min-height: 0); the plan letterboxes inside its box and the tiles fill their cells. Below 1200 px one part
 * of the board is on screen at a time (cameras first). There is no overflow: hidden on the page frame, so a layout that does not fit
 * shows up as a failing scroll assertion (tests/layout-incidents.spec.ts), never as hidden content.
 */
@customElement('investigate-incidents')
export class InvestigateIncidents extends LitElement {
  readonly bubbleSkin = new SkinController(this);
  /** The incident in the address (`#/investigate/incidents/<id>`); empty = the list. */
  @property() incidentId = '';

  @state() private pane: Part = 'cams';
  @state() private narrow = typeof window !== 'undefined' && window.matchMedia(NARROW).matches;
  @state() private now = Date.now();
  @state() private pageError: { kind: 'off' | 'error' | 'forbidden' | 'missing'; message: string } | null = null;
  @state() private detail: IncidentDetail | null = null;
  @state() private list: { incidents: Incident[]; retention_days: number; can_open: boolean; can_configure: boolean; settings: Partial<IncidentSettings> } | null = null;
  @state() private bundle: MapBundle | null = null;
  @state() private mapState: 'none' | 'loading' | 'ready' | 'forbidden' | 'missing' = 'none';
  @state() private cams: Panel<IncidentCameras> = { state: 'loading' };
  @state() private doors: Panel<IncidentDoors> = { state: 'loading' };
  @state() private who: Record<string, string> = {};
  @state() private elevators: Panel<Elevator[]> = { state: 'loading' };
  @state() private generators: Panel<GenDevice[]> = { state: 'loading' };
  @state() private live = new Set<string>();
  @state() private paused = false;
  /** Tiles the relay refused for the live quota (camera id -> the quota it named, 0 = unknown), until REFUSED_MS passes. */
  @state() private capped = new Map<string, number>();
  private capTimers = new Map<string, number>();
  @state() private snapBust = Date.now();
  @state() private sheet: 'settings' | 'close' | 'manual' | 'note' | null = null;
  @state() private casePick: NewCaseItem | null = null;
  @state() private toast = '';
  @state() private busy = false;
  @state() private closeNoteText = '';
  @state() private noteText = '';
  @state() private manualFloors: { id: string; label: string }[] = [];
  @state() private manualFloor = '';
  @state() private manualTitle = '';

  private mq?: MediaQueryList;
  private clockTimer = 0;
  private pollTimer = 0;
  private snapTimer = 0;
  private hiddenTimer = 0;
  private toastTimer = 0;
  private loadedFloor = '';

  static styles = [leadReserveStyles, css`
    :host { display: flex; flex-direction: column; min-block-size: 0; min-inline-size: 0; color: var(--sw-text); font-family: var(--sw-font); }
    [data-look='ok'] { --c: var(--sw-success); --c-text: var(--sw-success-text); --c-soft: var(--sw-success-soft); }
    [data-look='warn'] { --c: var(--sw-warning); --c-text: var(--sw-warning-text); --c-soft: var(--sw-warning-soft); }
    [data-look='alarm'] { --c: var(--sw-danger); --c-text: var(--sw-danger-text); --c-soft: var(--sw-danger-soft); }
    [data-look='off'] { --c: var(--sw-offline); --c-text: var(--sw-offline-text); --c-soft: var(--sw-offline-soft); }
    [data-look='unk'] { --c: var(--sw-unknown); --c-text: var(--sw-unknown-text); --c-soft: var(--sw-unknown-soft); }
    [data-look='acc'] { --c: var(--sw-accent); --c-text: var(--sw-accent-text); --c-soft: var(--sw-accent-soft); }
    .num { direction: ltr; unicode-bidi: isolate; font-variant-numeric: tabular-nums; }
    .screen { flex: 1; min-block-size: 0; display: flex; flex-direction: column; gap: 10px; padding: 12px var(--sw-page-pad) 14px; min-inline-size: 0; }
    .top { display: flex; align-items: center; gap: 12px; flex-wrap: wrap; flex: none; }
    .top h1 { margin: 0; font-size: var(--sw-fs-3xl); font-weight: var(--sw-h1-weight); letter-spacing: var(--sw-h1-tracking); line-height: 1.2; color: var(--sw-heading); display: flex; align-items: center; gap: 10px; flex-wrap: wrap; }
    .top .sub { margin: 2px 0 0; color: var(--sw-text-2); font-size: var(--sw-fs-base); }
    .top .sp { flex: 1; }
    .meta { display: flex; gap: 8px; flex-wrap: wrap; align-items: center; }
    .clock { display: inline-flex; align-items: center; gap: 6px; border-radius: var(--sw-r-pill); padding: 4px 12px; background: var(--sw-surface-3); color: var(--sw-heading); font-weight: var(--sw-fw-semibold); font-size: var(--sw-fs-md); }
    .clock sw-icon { color: var(--sw-text-3); }
    .badge { display: inline-flex; align-items: center; gap: 6px; border-radius: var(--sw-r-pill); padding: 3px 11px; white-space: nowrap; background: var(--c); color: var(--sw-text-inverse); font-size: var(--sw-fs-sm); font-weight: var(--sw-fw-semibold); line-height: 1.4; }
    .badge.sm { padding: 1px 9px; font-size: var(--sw-fs-xs); }
    .chip { display: inline-flex; align-items: center; gap: 5px; border-radius: var(--sw-r-pill); padding: 2px 9px; line-height: 1.5; font-size: var(--sw-fs-xs); font-weight: var(--sw-fw-medium); background: var(--sw-surface-2); color: var(--sw-text-2); white-space: nowrap; }
    .chip[data-look] { background: var(--c-soft); color: var(--c-text); }
    .chip .d { inline-size: 7px; block-size: 7px; border-radius: 50%; background: var(--c, var(--sw-text-3)); }
    .mut { color: var(--sw-text-3); font-size: var(--sw-fs-sm); }
    a.lnk { color: var(--sw-accent-text); font-size: var(--sw-fs-sm); font-weight: var(--sw-fw-semibold); text-decoration: none; white-space: nowrap; display: inline-flex; align-items: center; gap: 4px; }
    a.lnk:hover { text-decoration: underline; }
    .panel { background: var(--sw-surface); border: 1px solid var(--sw-border); border-radius: var(--sw-r-lg); box-shadow: var(--sw-shadow-2), inset 0 1px 0 var(--sw-highlight); min-inline-size: 0; min-block-size: 0; display: flex; flex-direction: column; overflow: hidden; }
    .panel .hd { display: flex; align-items: center; gap: 8px; padding: 11px 16px 8px; flex-wrap: wrap; flex: none; }
    /* R5-INVESTIGATE-297: a panel title is a title (17 px / 800); the panels carry the hero shadow */
    .panel .hd h2 { margin: 0; font-size: var(--sw-fs-xl); font-weight: 800; letter-spacing: -0.02em; color: var(--sw-heading); }
    .panel .hd .sp { flex: 1; }
    .panel > sw-state-panel { flex: 1; min-block-size: 0; }
    .board { flex: 1; min-block-size: 0; display: grid; grid-template-columns: minmax(0, 1fr) minmax(0, 1.15fr) minmax(0, .85fr); gap: 14px; }
    .col { display: flex; flex-direction: column; gap: 14px; min-block-size: 0; min-inline-size: 0; }
    .col > .fill { flex: 1; min-block-size: 0; }
    .map { position: relative; flex: 1; min-block-size: 0; margin: 0 16px 14px; border-radius: var(--sw-r-md); border: 1px solid var(--sw-border); background: var(--sw-surface-2); overflow: hidden; direction: ltr; }
    .map sw-plan-canvas { position: absolute; inset: 0; }
    .map .loc { position: absolute; inset: 0; display: grid; place-items: center; direction: rtl; color: var(--sw-text-2); font-size: var(--sw-fs-sm); text-align: center; padding: 12px; }
    .tiles { flex: 1; min-block-size: 0; display: grid; gap: 10px; padding: 0 16px 14px; }
    .tile { position: relative; min-block-size: 0; min-inline-size: 0; border-radius: var(--sw-r-md); overflow: hidden; background: var(--sw-video-bg); cursor: pointer; }
    .tile.hot { box-shadow: 0 0 0 2px var(--sw-danger); }
    .tile sw-camera-tile { position: absolute; inset: 0; block-size: 100%; inline-size: 100%; }
    .tile .rel { position: absolute; inset-block-start: 8px; inset-inline-end: 8px; padding: 2px 8px; border-radius: var(--sw-r-pill); background: var(--sw-video-scrim); color: var(--sw-on-video); font-size: var(--sw-fs-2xs); pointer-events: none; z-index: 1; }
    .capchip { position: absolute; inset-block-start: 8px; inset-inline-end: 8px; z-index: 1; display: inline-flex; align-items: center; gap: 4px; padding: 2px 8px; border-radius: var(--sw-r-pill); background: var(--sw-warning); color: #1e2e47; font-size: var(--sw-fs-xs); font-weight: var(--sw-fw-semibold); pointer-events: none; }
    .drs { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; }
    .drs { gap: 6px; padding: 0 12px 12px; }
    .dr { display: grid; grid-template-columns: 62px minmax(0, 1fr) auto auto; align-items: center; gap: 10px; min-block-size: 44px; padding: 6px 10px; border-radius: var(--sw-r-sm); background: var(--c-soft, var(--sw-surface-2)); }
    .dr .t1 { font-weight: var(--sw-fw-semibold); color: var(--sw-heading); font-size: var(--sw-fs-md); line-height: 1.3; overflow-wrap: anywhere; }
    .dr .t2 { display: block; font-size: var(--sw-fs-xs); color: var(--sw-text-3); line-height: 1.3; }
    .dr .when { font-size: var(--sw-fs-sm); color: var(--sw-text-2); }
    .rows { display: flex; flex-direction: column; gap: 5px; padding: 0 16px 12px; }
    .li { display: flex; gap: 10px; align-items: center; min-block-size: 44px; padding: 5px 10px; border: 0; border-radius: var(--sw-r-sm); background: var(--sw-surface-2); min-inline-size: 0; }
    .li .grow { flex: 1; min-inline-size: 0; }
    .li .t1 { font-weight: var(--sw-fw-semibold); color: var(--sw-heading); font-size: var(--sw-fs-md); line-height: 1.3; }
    .li .t2 { font-size: var(--sw-fs-xs); color: var(--sw-text-3); line-height: 1.3; }
    .li .ico { display: grid; place-items: center; inline-size: 34px; block-size: 34px; border-radius: 50%; background: var(--c-soft, var(--sw-surface-3)); color: var(--c-text, var(--sw-text-2)); flex: none; }
    .chain { list-style: none; margin: 0; padding: 2px 16px 12px; display: flex; flex-direction: column; flex: 1; min-block-size: 0; }
    .step { position: relative; display: grid; grid-template-columns: 14px minmax(0, 1fr) auto; column-gap: 10px; padding-block-end: 8px; }
    .step::before { content: ''; position: absolute; inset-inline-start: 6px; inset-block: 16px -2px; inline-size: 2px; background: var(--sw-border-strong); }
    .step:last-child { padding-block-end: 0; }
    .step:last-child::before { display: none; }
    .step .dot { position: relative; z-index: 1; inline-size: 14px; block-size: 14px; margin-block-start: 3px; border-radius: 50%; background: var(--c, var(--sw-accent)); box-shadow: 0 0 0 3px var(--sw-surface); }
    .step.wait .dot { background: var(--sw-surface); box-shadow: 0 0 0 2px var(--sw-border-strong), 0 0 0 5px var(--sw-surface); }
    .step .t1 { font-weight: var(--sw-fw-semibold); color: var(--sw-heading); font-size: var(--sw-fs-md); line-height: 1.35; overflow-wrap: anywhere; }
    .step .t2 { font-size: var(--sw-fs-xs); color: var(--sw-text-2); line-height: 1.35; overflow-wrap: anywhere; }
    .step .w { font-size: var(--sw-fs-xs); color: var(--sw-text-3); font-variant-numeric: tabular-nums; padding-block-start: 2px; }
    .step.wait .t1 { color: var(--sw-text-3); font-weight: var(--sw-fw-medium); }
    .chainfoot { flex: none; display: flex; gap: 8px; padding: 0 16px 12px; }
    .ptabs { display: none; }
    .only-phone { display: none; }
    table.t { inline-size: 100%; border-collapse: collapse; font-size: var(--sw-fs-md); }
    table.t th { text-align: start; font-weight: var(--sw-fw-semibold); font-size: var(--sw-fs-sm); color: var(--sw-text-2); padding: 8px 12px; border-block-end: 1px solid var(--sw-border-strong); white-space: nowrap; background: var(--sw-surface-2); }
    table.t td { padding: 12px 14px; border-block-end: 1px solid var(--sw-border); vertical-align: middle; white-space: nowrap; }
    table.t tbody tr { cursor: pointer; }
    table.t tbody tr:hover { background: var(--sw-hover-wash); }
    table.t tbody tr:last-child td { border-block-end: 0; }
    td .t1 { font-weight: var(--sw-fw-semibold); color: var(--sw-heading); font-size: var(--sw-fs-lg); }
    table.t td.num { font-weight: var(--sw-fw-semibold); color: var(--sw-heading); }
    td .t2 { display: block; font-size: var(--sw-fs-sm); color: var(--sw-text-3); white-space: normal; }
    .cards { display: none; gap: 8px; padding: 0 12px 12px; }
    .cards .c { border: 0; border-radius: var(--sw-r-sm); padding: 10px 12px; min-block-size: 56px; display: grid; gap: 2px; background: var(--sw-surface-2); cursor: pointer; text-align: start; font: inherit; color: inherit; }
    .cards .c .r1 { display: flex; justify-content: space-between; align-items: center; gap: 8px; }
    .cards .c .t1 { font-weight: var(--sw-fw-semibold); color: var(--sw-heading); min-inline-size: 0; }
    .listwrap { flex: 1; min-block-size: 0; }
    .toast { position: fixed; inset-block-end: 20px; inset-inline: 0; margin-inline: auto; inline-size: max-content; max-inline-size: 90vw; background: var(--sw-toast-bg); color: var(--sw-toast-text); border-radius: var(--sw-r-pill); padding: 8px 16px; z-index: var(--sw-z-toast); box-shadow: var(--sw-shadow-2); }
    .form { display: grid; gap: 10px; }
    .form label { display: grid; gap: 4px; font-size: var(--sw-fs-sm); color: var(--sw-text-2); }
    .form input, .form select, .form textarea { font: inherit; font-size: var(--sw-fs-md); background: var(--sw-surface); color: var(--sw-text); border: 1px solid var(--sw-border-strong); border-radius: var(--sw-r-sm); padding: 6px 10px; min-block-size: 36px; }
    .form textarea { min-block-size: 72px; resize: none; }
    .form .acts { display: flex; gap: 8px; justify-content: flex-end; }
    .form p { margin: 0; color: var(--sw-text-2); font-size: var(--sw-fs-sm); }
    /* a small laptop: the plan header keeps icons only (the legend is in the plan) */
    @media (min-width: 1200px) and (max-width: 1299px) { .panel .hd .bt { display: none; } }
    @media (min-height: 900px) and (min-width: 1200px) { .step { padding-block-end: 20px; } .step .t1 { font-size: var(--sw-fs-md); } .step .t2, .step .w { font-size: var(--sw-fs-sm); } }
    /* tablet and phone: ONE part of the board at a time (cameras first); the head and its actions stay */
    @media (max-width: 1199px) {
      .screen { padding: 10px 20px 12px; }
      .board { display: flex; flex-direction: column; gap: 10px; }
      .col { display: contents; }
      .board .panel { flex: 1; min-block-size: 0; }
      .board .panel.infra { flex: none; }
      .board .panel[hidden-part] { display: none; }
      .ptabs { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 3px; padding: 3px; background: var(--sw-surface-3); border-radius: var(--sw-r-md); flex: none; }
      .ptabs button { font: inherit; font-size: var(--sw-fs-sm); font-weight: var(--sw-fw-medium); border: 0; background: transparent; color: var(--sw-text-2); border-radius: var(--sw-r-sm); min-block-size: 36px; padding: 0 4px; cursor: pointer; display: inline-flex; align-items: center; justify-content: center; gap: 4px; white-space: nowrap; }
      .ptabs button[aria-pressed='true'] { background: var(--sw-surface); color: var(--sw-accent-text); font-weight: var(--sw-fw-semibold); box-shadow: var(--sw-shadow-1); }
      .ptabs .n { font-size: var(--sw-fs-2xs); border-radius: var(--sw-r-pill); padding: 0 6px; background: var(--sw-surface-3); color: var(--sw-text-2); }
      .ptabs .n[data-look] { background: var(--c); color: var(--sw-text-inverse); }
      .tiles { gap: 8px; padding: 0 12px 12px; }
      .only-desk { display: none !important; }
      .only-phone { display: inline; }
    }
    @media (max-width: 767px) {
      .screen { padding: 8px 12px 8px; gap: 8px; }
      .top { display: grid; grid-template-columns: minmax(0, 1fr) auto; gap: 6px; align-items: start; }
      .top .sp { display: none; }
      .top .meta { grid-column: 1 / -1; inline-size: 100%; flex-wrap: nowrap; gap: 6px; }
      .top .meta > sw-button { flex: 1; }
      .top .meta > sw-button[iconOnly] { flex: none; }
      .top h1 { font-size: var(--sw-fs-xl); gap: 8px; }
      .top .sub { font-size: var(--sw-fs-sm); }
      .clock { padding: 3px 8px; font-size: var(--sw-fs-sm); }
      .map { margin: 0 12px 12px; }
      .panel .hd { padding: 10px 12px 6px; }
      .dr { padding-inline: 10px; grid-template-columns: 56px minmax(0, 1fr) auto; }
      .dr .when { display: none; }
      .chain, .rows { padding-inline: 12px; }
      table.t { display: none; }
      .cards { display: grid; }
      .ptabs button { min-block-size: 44px; }
    }
    @media (prefers-reduced-motion: reduce) { * { animation: none !important; transition: none !important; } }
  `];

  connectedCallback() {
    super.connectedCallback();
    this.mq = window.matchMedia(NARROW);
    this.mq.addEventListener('change', this.onMq);
    document.addEventListener('visibilitychange', this.onVisibility);
    this.clockTimer = window.setInterval(() => (this.now = Date.now()), 1000);
  }

  disconnectedCallback() {
    super.disconnectedCallback();
    this.mq?.removeEventListener('change', this.onMq);
    document.removeEventListener('visibilitychange', this.onVisibility);
    for (const t of [this.clockTimer, this.snapTimer]) window.clearInterval(t);
    for (const t of [this.pollTimer, this.hiddenTimer, this.toastTimer, ...this.capTimers.values()]) window.clearTimeout(t);
    this.capTimers.clear();
    // leaving the page stops every player: the tiles leave the DOM with this element (sw-live-player tears its session down)
  }

  private onMq = (e: MediaQueryListEvent) => {
    this.narrow = e.matches;
    this.resetLive();
  };

  /** A hidden tab stops every player after `incident.hidden_stop_s`; showing it again restores them in ranking order. */
  private onVisibility = () => {
    window.clearTimeout(this.hiddenTimer);
    if (document.visibilityState === 'hidden') {
      this.hiddenTimer = window.setTimeout(() => (this.paused = true), this.setting('incident.hidden_stop_s') * 1000);
    } else {
      this.paused = false;
      void this.reload(true);
    }
  };

  protected willUpdate(changed: PropertyValues<this>) {
    if (changed.has('incidentId')) void this.reload(false);
  }

  private setting<K extends keyof IncidentSettings>(k: K): IncidentSettings[K] {
    return (this.detail?.settings?.[k] ?? DEFAULT_SETTINGS[k]) as IncidentSettings[K];
  }

  private schedulePoll() {
    window.clearTimeout(this.pollTimer);
    this.pollTimer = window.setTimeout(() => {
      if (document.visibilityState === 'visible') void this.reload(true);
      else this.schedulePoll();
    }, this.setting('incident.refresh_s') * 1000);
  }

  private async reload(quiet: boolean) {
    const id = this.incidentId;
    if (!quiet) {
      this.pageError = null;
      this.detail = null;
      this.list = null;
      this.bundle = null;
      this.mapState = 'none';
      this.loadedFloor = '';
      this.cams = { state: 'loading' };
      this.doors = { state: 'loading' };
      this.live = new Set();
      this.pane = 'cams';
    }
    try {
      if (!id) {
        this.list = await listIncidents('all');
        this.pageError = null;
      } else {
        const d = await getIncident(id);
        if (this.incidentId !== id) return;
        this.detail = d;
        this.pageError = null;
        if (d.floor_id && d.floor_id !== this.loadedFloor) void this.loadPlan(d.floor_id);
        if (!d.floor_id) this.mapState = 'none';
        void this.loadCameras(id);
        void this.loadDoors(id);
        void this.loadInfra();
        window.clearInterval(this.snapTimer);
        this.snapTimer = window.setInterval(() => (this.snapBust = Date.now()), this.setting('incident.snapshot_refresh_s') * 1000);
      }
    } catch (err) {
      if (quiet && (this.detail || this.list)) return this.schedulePoll(); // keep what is on screen; the next poll tries again
      const code = err instanceof ApiError ? err.code : '';
      this.pageError = code === 'feature_disabled' ? { kind: 'off', message: '' } : forbidden(err) ? { kind: 'forbidden', message: '' }
        : err instanceof ApiError && err.status === 404 ? { kind: 'missing', message: '' } : { kind: 'error', message: describeError(err) };
      return;
    }
    if (id && this.detail?.status === 'open') this.schedulePoll();
    else if (!id) this.schedulePoll();
  }

  private async loadPlan(floorId: string) {
    this.loadedFloor = floorId;
    this.mapState = 'loading';
    try {
      const b = await loadMap(floorId);
      if (this.loadedFloor !== floorId) return;
      this.bundle = b;
      this.mapState = b.planStatus === 'none' ? 'missing' : 'ready';
    } catch (err) {
      this.bundle = null;
      this.mapState = forbidden(err) ? 'forbidden' : 'missing';
    }
  }

  private async loadCameras(id: string) {
    try {
      const c = await incidentCameras(id);
      const first = this.cams.state !== 'ready';
      this.cams = { state: 'ready', data: c };
      if (first || !this.live.size) this.resetLive();
    } catch (err) {
      this.cams = forbidden(err) ? { state: 'forbidden' } : { state: 'error', message: describeError(err) };
    }
  }

  private async loadDoors(id: string) {
    try {
      const d = await incidentDoors(id);
      this.doors = { state: 'ready', data: d };
      void this.loadWho(d);
    } catch (err) {
      this.doors = forbidden(err) ? { state: 'forbidden' } : { state: 'error', message: describeError(err) };
    }
  }

  /** "Who opened": the access log rows of the window for each mapped door the caller may read (access.events.read on that station). */
  private async loadWho(d: IncidentDoors) {
    if (!isApi()) {
      this.who = { 'lock.demo_parking': 'יוסי לוי · כרטיס', 'binary_sensor.demo_exit': 'ללא זיהוי · נפתחה מבפנים' };
      return;
    }
    const out: Record<string, string> = {};
    await Promise.all(d.doors.filter((x) => x.station_id && x.door).map(async (x) => {
      try {
        const r = await getAccessEvents({ station_id: x.station_id, door: x.door as 1 | 2, start: d.window.from, end: d.window.to }, null, 5);
        const ev = r.events?.records.find((e) => e.result === 'granted');
        if (ev) out[x.entity_id] = [ev.person_name || '—', ev.authentication === 'card' ? 'כרטיס' : ev.authentication === 'pin' ? 'קוד' : ''].filter(Boolean).join(' · ');
      } catch {
        /* no access.events.read on that station, or the log is down: the column stays empty */
      }
    }));
    this.who = out;
  }

  /** The elevators (devices.read) and the generator (generator.view) through their own endpoints: a half the caller lacks leaves. */
  private async loadInfra() {
    if (!isApi()) {
      this.elevators = { state: 'ready', data: [
        { id: 'e1', name: 'מעלית צפונית', area_id: null, area_name: 'קומה -1', state: 'door_open', reason: '', partial: false, stale: false, since: null, roles: [], extras: [] },
        { id: 'e2', name: 'מעלית דרומית', area_id: null, area_name: 'קומה 3', state: 'moving_down', reason: '', partial: false, stale: false, since: null, roles: [], extras: [] },
      ] };
      this.generators = { state: 'ready', data: [{ id: 'g1', name: 'גנרטור ראשי', area_id: null, area_name: 'גג', status: 'detected', source_kind: 'demo', rated_kw: null, rated_kva: null, fuel_type: 'diesel', detected_at: null, last_seen_at: null, revision: 1, availability: 'online', stale: false } as unknown as GenDevice] };
      return;
    }
    const [e, g] = await Promise.allSettled([listElevators(), listDevices()]);
    this.elevators = e.status === 'fulfilled' ? { state: 'ready', data: e.value.elevators } : { state: 'hidden' };
    this.generators = g.status === 'fulfilled' ? { state: 'ready', data: g.value.devices } : { state: 'hidden' };
  }

  // ---------------------------------------------------------------- the live budget

  private get liveCap(): number {
    const c = this.cams.state === 'ready' ? this.cams.data : null;
    return Math.max(1, this.narrow ? c?.max_live_phone ?? this.setting('incident.max_live_phone') : c?.max_live ?? this.setting('incident.max_live'));
  }

  private get tileCams() {
    const c = this.cams.state === 'ready' ? this.cams.data.cameras : [];
    const n = this.narrow ? Math.min(c.length, Math.max(4, this.liveCap)) : Math.min(c.length, Math.max(4, this.liveCap));
    return c.slice(0, n);
  }

  /** The first `liveCap` cameras in ranking order are live; the rest are snapshots. */
  private resetLive() {
    this.live = new Set(this.tileCams.slice(0, this.liveCap).map((c) => c.camera_id));
  }

  /** A tap on a snapshot swaps it in: the lowest-ranked live tile becomes a snapshot (the live wall's rule: the budget never grows). */
  private swapIn(id: string) {
    if (this.live.has(id)) {
      navigate(`/live/cameras/${id}`);
      return;
    }
    const order = this.tileCams.map((c) => c.camera_id);
    const next = new Set(this.live);
    if (next.size >= this.liveCap) {
      const drop = [...next].sort((a, b) => order.indexOf(b) - order.indexOf(a))[0];
      if (drop) next.delete(drop);
    }
    next.add(id);
    this.live = next;
  }

  /** A 4429 / `remote_live_cap` from the relay (the connection's live quota, `remote.max_live_streams` / `media.max_live_sessions`): the
   * tile turns into its snapshot with "המכסה מלאה" (the player's own wording in the title) and is tried again after REFUSED_MS - never a
   * retry storm, never another tile pushed out. */
  private onPlayerStatus(id: string, e: Event) {
    const d = (e as CustomEvent<{ code?: string | number; max?: number }>).detail;
    if (d?.code !== 'remote_live_cap' && d?.code !== 4429) return;
    if (this.capped.has(id)) return;
    const next = new Map(this.capped);
    next.set(id, Number(d.max) || 0);
    this.capped = next;
    const t = window.setTimeout(() => {
      const m = new Map(this.capped);
      m.delete(id);
      this.capped = m;
      this.capTimers.delete(id);
    }, REFUSED_MS);
    this.capTimers.set(id, t);
  }

  // ---------------------------------------------------------------- actions (all existing, all permissioned on the server)

  private flash(text: string) {
    this.toast = text;
    window.clearTimeout(this.toastTimer);
    this.toastTimer = window.setTimeout(() => (this.toast = ''), 2200);
  }

  private async doAck() {
    if (!this.detail || this.busy) return;
    this.busy = true;
    try {
      await ackIncident(this.detail.id);
      this.flash(it('ackDone'));
      await this.reload(true);
    } catch (err) {
      this.flash(describeError(err));
    } finally {
      this.busy = false;
    }
  }

  private async doClose() {
    if (!this.detail || this.busy) return;
    this.busy = true;
    try {
      await closeIncident(this.detail.id, this.closeNoteText.trim() || undefined);
      this.sheet = null;
      this.closeNoteText = '';
      this.flash(it('closeDone'));
      void refreshIncidents();
      await this.reload(true);
    } catch (err) {
      this.flash(describeError(err));
    } finally {
      this.busy = false;
    }
  }

  private async doNote() {
    if (!this.detail || this.busy || !this.noteText.trim()) return;
    this.busy = true;
    try {
      await noteIncident(this.detail.id, this.noteText.trim());
      this.sheet = null;
      this.noteText = '';
      this.flash(it('noteDone'));
      await this.reload(true);
    } catch (err) {
      this.flash(describeError(err));
    } finally {
      this.busy = false;
    }
  }

  private async openManualSheet() {
    this.sheet = 'manual';
    try {
      const tree = await loadTree();
      this.manualFloors = tree.sites.flatMap((s) => (s.buildings ?? []).flatMap((b) => (b.floors ?? []).map((f) => ({ id: f.id, label: `${b.name} · ${f.name}` }))));
      this.manualFloor = this.manualFloor || this.manualFloors[0]?.id || '';
    } catch {
      this.manualFloors = [];
    }
  }

  private async doManual() {
    if (!this.manualFloor || this.busy) return;
    this.busy = true;
    try {
      const r = await openIncident({ floor_id: this.manualFloor, title: this.manualTitle.trim() || undefined });
      this.sheet = null;
      this.manualTitle = '';
      void refreshIncidents();
      navigate(`/investigate/incidents/${r.incident.id}`);
    } catch (err) {
      this.flash(describeError(err));
    } finally {
      this.busy = false;
    }
  }

  private caseItem(): NewCaseItem {
    const d = this.detail!;
    if (d.source === 'event' && d.source_ref) return { kind: 'event', event_id: d.source_ref, note: d.title };
    return { kind: 'note', note: `${it('pageTitle')} · ${d.title} · ${this.when(d.opened_at)}` };
  }

  // ---------------------------------------------------------------- render helpers

  private when(iso: string | null | undefined, withDay = false): string {
    if (!iso) return '-';
    return withDay ? `${dayMonthText(iso)} · ${timeText(iso)}` : timeText(iso, { seconds: true });
  }

  private canConfigure(): boolean {
    return !isApi() || can('system.configure');
  }

  private renderState(kind: 'off' | 'error' | 'forbidden' | 'missing', message = '') {
    if (kind === 'off') {
      return html`<div class="screen"><sw-state-panel icon="offline" state="empty" heading=${it('offTitle')} hint=${it('offHint')} data-incidents-off
        actionLabel=${this.canConfigure() ? it('toSettings') : ''} @action=${() => navigate('/system/security/incidents')}></sw-state-panel></div>`;
    }
    if (kind === 'forbidden') return html`<div class="screen"><sw-state-panel state="forbidden" heading=${it('forbidden')} data-incidents-forbidden></sw-state-panel></div>`;
    if (kind === 'missing') return html`<div class="screen"><sw-state-panel icon="search" state="empty" heading=${it('notFound')} actionLabel=${it('listTitle')} @action=${() => navigate('/investigate/incidents')}></sw-state-panel></div>`;
    return html`<div class="screen"><sw-state-panel state="error" heading=${it('errorTitle')} hint=${message || it('errorHint')} actionLabel=${it('retry')} data-incidents-error @action=${() => void this.reload(false)}></sw-state-panel></div>`;
  }

  render() {
    const body = this.pageError ? this.renderState(this.pageError.kind, this.pageError.message) : this.incidentId ? this.renderDetail() : this.renderList();
    return html`${body}${this.renderSheets()}${this.toast ? html`<div class="toast" role="status" data-incident-toast>${this.toast}</div>` : nothing}`;
  }

  private renderClock() {
    return html`<span class="clock" title=${it('clock')} data-incident-clock><sw-icon name="clock" size=${16}></sw-icon><span class="num">${timeText(this.now, { seconds: true })}</span></span>`;
  }

  // ---------------------------------------------------------------- the list (no event open, or several)

  private renderList() {
    const l = this.list;
    if (!l) return html`<div class="screen"><sw-state-panel state="loading" data-incidents-loading></sw-state-panel></div>`;
    const open = l.incidents.filter((i) => i.status === 'open');
    const closed = l.incidents.filter((i) => i.status === 'closed');
    const showClock = l.settings['incident.header_clock'] !== false;
    const dur = (i: Incident) => (i.closed_at ? it('minutes', { n: Math.max(1, Math.round((new Date(i.closed_at).getTime() - new Date(i.opened_at).getTime()) / 60000)) }) : elapsed(i.opened_at, this.now));
    const srcWord = (i: Incident) => ({ alarm: it('srcAlarm'), event: it('srcEvent'), notification: it('srcNotification'), manual: it('srcManual') })[i.source];
    const rows = [...open, ...closed];
    return html`<section class="screen" data-incidents-list>
      <div class="top lead-head">
        <div><h1>${it('listTitle')}</h1><p class="sub">${open.length ? it('listSubOpen', { n: open.length }) : it('listSub', { n: closed.length })}</p></div>
        <span class="sp"></span>
        ${showClock ? this.renderClock() : nothing}
        <div class="meta">
          ${l.can_open ? html`<sw-button variant="primary" icon="plus" data-incident-open-manual @click=${() => void this.openManualSheet()}>${it('openManual')}</sw-button>` : nothing}
          ${l.can_configure || !isApi() ? html`<sw-button iconOnly icon="system" label=${it('settings')} title=${it('settings')} data-incident-settings-open @click=${() => (this.sheet = 'settings')}></sw-button>` : nothing}
        </div>
      </div>
      ${open.length ? nothing : html`<sw-state-panel icon="shield" state="empty" compact heading=${it('listNone')} hint=${it('listNoneHint')} data-incidents-none style="flex:none"></sw-state-panel>`}
      <div class="panel listwrap">
        <div class="hd"><h2>${it('recent')}</h2><span class="sp"></span><span class="mut">${it('retention', { n: l.retention_days })}</span></div>
        ${rows.length ? html`
          <table class="t" data-incidents-table><thead><tr><th>${it('colState')}</th><th>${it('colIncident')}</th><th>${it('colSource')}</th><th>${it('colOpened')}</th><th>${it('colClosed')}</th><th>${it('colDuration')}</th></tr></thead><tbody>
            ${rows.slice(0, 8).map((i) => html`<tr data-incident-row=${i.id} data-status=${i.status} @click=${() => navigate(`/investigate/incidents/${i.id}`)}>
              <td><span class="badge" data-look=${i.status === 'open' ? 'alarm' : 'off'}>${i.status === 'open' ? it('statusOpen') : it('statusClosed')}</span></td>
              <td><span class="t1">${i.title}</span><span class="t2">${[i.building_name, i.floor_name].filter(Boolean).join(' · ')}</span></td>
              <td>${srcWord(i)}</td><td class="num">${this.when(i.opened_at, true)}</td><td class="num">${i.closed_at ? this.when(i.closed_at, true) : '-'}</td><td class="num">${dur(i)}</td>
            </tr>`)}
          </tbody></table>
          <div class="cards">${rows.slice(0, 5).map((i) => html`<button type="button" class="c" data-incident-card=${i.id} @click=${() => navigate(`/investigate/incidents/${i.id}`)}>
            <div class="r1"><span class="t1">${i.title}</span><span class="badge sm" data-look=${i.status === 'open' ? 'alarm' : 'off'}>${i.status === 'open' ? it('statusOpen') : it('statusClosed')}</span></div>
            <div class="mut">${srcWord(i)} · ${this.when(i.opened_at, true)} · ${dur(i)}</div></button>`)}</div>`
        : html`<sw-state-panel icon="list" state="empty" compact quiet heading=${it('listNone')}></sw-state-panel>`}
      </div>
    </section>`;
  }

  // ---------------------------------------------------------------- one incident

  private renderDetail() {
    const d = this.detail;
    if (!d) return html`<div class="screen"><sw-state-panel state="loading" data-incidents-loading></sw-state-panel></div>`;
    const open = d.status === 'open';
    const place = [d.building_name, d.floor_name, d.zone].filter(Boolean).join(' · ');
    const sub = [place, d.source_label, it('openedBy', { t: this.when(d.opened_at), who: d.opened_by_name || it('system') })].filter(Boolean).join(' · ');
    const doorsOpen = this.doors.state === 'ready' ? this.doors.data.doors.filter((x) => x.open).length : 0;
    const steps = d.steps.length + (d.pending.length ? 1 : 0);
    return html`<section class="screen" data-incident=${d.id} data-status=${d.status} data-part=${this.pane}>
      <div class="top lead-head">
        <div>
          <h1><span class="badge" data-look=${open ? 'alarm' : 'off'} style="font-size:var(--sw-fs-sm)" data-incident-status><sw-icon name=${open ? 'warning' : 'check'} size=${14}></sw-icon>${open ? it('statusOpen') : it('statusClosed')} · <span class="num" data-incident-elapsed>${elapsed(d.opened_at, d.closed_at ? new Date(d.closed_at).getTime() : this.now)}</span></span>${d.title}</h1>
          <p class="sub">${sub}</p>
        </div>
        <span class="sp"></span>
        ${this.setting('incident.header_clock') ? this.renderClock() : nothing}
        <div class="meta">
          ${open && d.can_ack ? html`<sw-button variant="primary" icon="check" data-incident-ack ?disabled=${this.busy} @click=${() => void this.doAck()}>${it('ack')}</sw-button>` : nothing}
          ${d.can_case ? html`<sw-button icon="case" data-incident-case @click=${() => (this.casePick = this.caseItem())}><span class="only-desk">${it('addCase')}</span><span class="only-phone">${it('addCaseShort')}</span></sw-button>` : nothing}
          ${open && d.can_ack ? html`<sw-button variant="danger" data-incident-close @click=${() => (this.sheet = 'close')}><span class="only-desk">${it('close')}</span><span class="only-phone">${it('closeShort')}</span></sw-button>` : nothing}
          ${d.can_configure ? html`<sw-button iconOnly icon="system" label=${it('settings')} title=${it('settings')} data-incident-settings-open @click=${() => (this.sheet = 'settings')}></sw-button>` : nothing}
          <sw-button class="only-desk" variant="ghost" icon="list" data-incident-to-events @click=${() => navigate('/investigate/events')}>${it('toEvents')}</sw-button>
        </div>
      </div>
      <div class="ptabs" role="group" aria-label=${it('parts')} data-incident-parts>
        ${(['cams', 'map', 'doors', 'chain'] as Part[]).map((p) => html`<button type="button" data-part-btn=${p} aria-pressed=${this.pane === p ? 'true' : 'false'} @click=${() => (this.pane = p)}>
          ${p === 'cams' ? html`<sw-icon name="camera" size=${16}></sw-icon>${it('partCams')}` : p === 'map' ? html`<sw-icon name="map" size=${16}></sw-icon>${it('partMap')}`
            : p === 'doors' ? html`${it('partDoors')}${doorsOpen ? html`<span class="n" data-look="warn">${doorsOpen}</span>` : nothing}` : html`${it('partChain')}<span class="n">${steps}</span>`}
        </button>`)}
      </div>
      <div class="board">
        <div class="col">${this.renderMap(d)}${this.renderDoors()}</div>
        <div class="col">${this.renderCameras(d)}${this.renderInfra()}</div>
        <div class="col">${this.renderChain(d)}</div>
      </div>
    </section>`;
  }

  /** In the narrow layout a panel that is not the chosen part leaves (one part on screen at a time). */
  private hiddenPart(p: Part): boolean {
    return this.narrow && this.pane !== p;
  }

  private get markers(): PlanMarker[] {
    const b = this.bundle;
    const d = this.detail;
    if (!b || !d) return [];
    const list: PlanMarker[] = b.anchors.map((a) => ({
      id: a.id, kind: a.resource_type === 'camera' ? 'camera' : entityMarkerKind(a.layer_id, a.entity?.domain), label: a.camera?.name ?? a.entity?.name ?? a.label ?? a.resource_id,
      x: a.position.x, y: a.position.y, rotation: a.rotation_degrees, fov: a.field_of_view_degrees ?? undefined, level: a.level_id ?? null,
      state: a.resource_type === 'camera' ? cameraState(a) : 'neutral',
    }));
    if (!d.anchor_id && d.x !== null && d.y !== null) list.push({ id: 'incident-pin', kind: 'binary_sensor', label: d.zone || d.title, x: d.x, y: d.y, state: 'error' });
    return list;
  }

  private renderMap(d: IncidentDetail) {
    const b = this.bundle;
    const camIds = new Set(this.cams.state === 'ready' ? this.cams.data.cameras.map((c) => c.camera_id) : []);
    const highlight = b ? b.anchors.filter((a) => a.resource_type === 'camera' && camIds.has(a.resource_id)).map((a) => a.id) : [];
    const selected = d.anchor_id || (d.x !== null && d.y !== null ? 'incident-pin' : null);
    const note = !d.floor_id ? it('noLocation') : this.mapState === 'forbidden' ? it('mapForbidden') : this.mapState === 'missing' ? it('noMap') : '';
    return html`<div class="panel fill" data-pane="map" ?hidden-part=${this.hiddenPart('map')}>
      <div class="hd"><h2>${it('mapTitle')}</h2>${d.zone ? html`<span class="chip" data-look="alarm"><span class="d"></span>${d.zone}</span>` : nothing}<span class="sp"></span>
        ${d.floor_id ? html`<a class="lnk" href=${`#/explore/floors/${d.floor_id}`} title=${it('liveMap')} data-incident-live-map><sw-icon name="map" size=${14}></sw-icon><span class="bt">${it('liveMap')}</span></a>
          <a class="lnk" href=${`#/investigate/floors/${d.floor_id}/history?t=${encodeURIComponent(d.opened_at)}`} title=${it('historyMap')}><sw-icon name="history" size=${14}></sw-icon><span class="bt">${it('historyMap')}</span></a>` : nothing}
      </div>
      <div class="map" data-incident-map>
        ${b && this.mapState === 'ready'
          ? html`<sw-plan-canvas .planWidth=${b.width} .planHeight=${b.height} .imageUrl=${b.imageUrl} .plan=${b.planSvg} .markers=${this.markers} .selectedId=${selected}
              .highlightIds=${highlight} .zones=${zonesWithChips(b.zones)} alwaysLabel dimEntities></sw-plan-canvas>`
          : html`<div class="loc">${this.mapState === 'loading' ? html`<sw-state-panel state="loading" compact quiet></sw-state-panel>` : html`<div><b>${[d.building_name, d.floor_name, d.zone].filter(Boolean).join(' · ') || '-'}</b><br />${note}</div>`}</div>`}
      </div>
    </div>`;
  }

  private renderCameras(d: IncidentDetail) {
    const p = this.cams;
    const tiles = this.tileCams;
    const liveN = tiles.filter((c) => this.live.has(c.camera_id)).length;
    const n = tiles.length;
    const cols = this.narrow ? Math.max(1, n - 1) : n <= 4 ? Math.min(2, Math.max(1, n)) : 3;
    const rows = this.narrow ? (n > 1 ? 'minmax(0, 1fr) minmax(0, .42fr)' : 'minmax(0, 1fr)') : `repeat(${Math.max(1, Math.ceil(n / cols))}, minmax(0, 1fr))`;
    const first = tiles[0]?.camera_id;
    return html`<div class="panel fill" data-pane="cams" ?hidden-part=${this.hiddenPart('cams')}>
      <div class="hd"><h2>${it('camsTitle')}</h2>
        ${p.state === 'ready' && n ? html`<span class="chip" data-look="ok" data-incident-cams-chip><span class="d"></span><span class="num">${this.narrow ? it('camsPhone', { n: liveN, s: n - liveN }) : it('camsLive', { n: liveN })}</span></span>` : nothing}
        <span class="sp"></span>
        ${p.state === 'ready' && first ? html`<a class="lnk" href=${`#/investigate/playback?camera=${encodeURIComponent(first)}&t=${encodeURIComponent(d.opened_at)}`} data-incident-full-player><sw-icon name="play" size=${14}></sw-icon>${it('fullPlayer')}</a>` : nothing}
      </div>
      ${p.state === 'loading' ? html`<sw-state-panel state="loading" compact quiet></sw-state-panel>`
        : p.state === 'forbidden' ? html`<sw-state-panel state="forbidden" compact heading=${it('camsForbidden')} hint=${it('camsForbiddenHint')} data-incident-cams-forbidden></sw-state-panel>`
        : p.state === 'error' ? html`<sw-state-panel state="error" compact heading=${it('camsTitle')} hint=${p.message}></sw-state-panel>`
        : p.state === 'hidden' ? nothing
        : !n ? html`<sw-state-panel icon="camera" state="empty" compact quiet heading=${it('camsNone')}></sw-state-panel>`
        : html`<div class="tiles" data-incident-tiles style=${`grid-template-columns: repeat(${cols}, minmax(0, 1fr)); grid-template-rows: ${rows}`}>
            ${tiles.map((c, i) => {
              const capped = this.capped.get(c.camera_id);
              const isLive = this.live.has(c.camera_id) && !this.paused && capped === undefined;
              const style = this.narrow && i === 0 && n > 1 ? `grid-column: 1 / -1` : '';
              return html`<div class="tile ${i === 0 && c.relation !== 'floor' ? 'hot' : ''}" style=${style} data-incident-tile=${c.camera_id} data-live=${isLive ? 'true' : 'false'}
                role="button" tabindex="0" aria-label=${isLive ? c.name : `${c.name} · ${it('swapLive')}`}
                @click=${() => this.swapIn(c.camera_id)} @keydown=${(e: KeyboardEvent) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); this.swapIn(c.camera_id); } }}>
                <sw-camera-tile name=${c.name} meta=${c.relation_label} cameraId=${c.camera_id} state="live" profile="sub" transport="auto" fit="cover" ?compact=${this.narrow && i > 0}
                  ?live=${isApi() && isLive} ?snapshotOnly=${isApi() && !isLive} poster=${isApi() ? snapshotUrl(c.camera_id, isLive ? undefined : this.snapBust) : ''}
                  @player-status=${(e: Event) => this.onPlayerStatus(c.camera_id, e)}></sw-camera-tile>
                ${capped !== undefined ? html`<span class="capchip" data-incident-cap=${c.camera_id} title=${liveCapTitle(capped)}><sw-icon name="warning" size=${12}></sw-icon>${it('capFull')}</span>` : nothing}
              </div>`;
            })}
          </div>`}
    </div>`;
  }

  private renderDoors() {
    const p = this.doors;
    const data = p.state === 'ready' ? p.data : null;
    const openN = data ? data.doors.filter((x) => x.open).length : 0;
    return html`<div class="panel" data-pane="doors" ?hidden-part=${this.hiddenPart('doors')}>
      <div class="hd"><h2>${it('doorsTitle')}</h2>${openN ? html`<span class="chip" data-look="warn"><span class="d"></span>${it('doorsOpen', { n: openN })}</span>` : nothing}<span class="sp"></span>
        ${data ? html`<span class="mut">${it('doorsWindow', { n: Math.round(data.window_s / 60) })}</span>` : nothing}</div>
      ${p.state === 'loading' ? html`<sw-state-panel state="loading" compact quiet></sw-state-panel>`
        : p.state !== 'ready' ? html`<sw-state-panel icon="door" state=${p.state === 'forbidden' ? 'forbidden' : 'error'} compact quiet heading=${it('doorsTitle')}></sw-state-panel>`
        : !p.data.doors.length ? html`<sw-state-panel icon="door" state="empty" compact quiet heading=${it('doorsNone')}></sw-state-panel>`
        : html`<ul class="drs" data-incident-doors>${p.data.doors.slice(0, this.narrow ? 6 : 3).map((x) => {
            const look: Look = x.open === null ? 'unk' : x.open ? 'warn' : 'ok';
            const label = x.open === null ? (p.data.state_visible ? it('doorUnknown') : it('doorHidden')) : x.open ? it('doorOpen') : it('doorLocked');
            const who = this.who[x.entity_id];
            return html`<li class="dr" data-look=${look} data-door=${x.entity_id}>
              <span class="badge sm">${label}</span>
              <div><span class="t1">${x.name}</span><span class="t2">${[x.area_name, who].filter(Boolean).join(' · ')}</span></div>
              <span class="when num ${x.open ? '' : 'mut'}">${x.since ? this.when(x.since) : ''}</span>
              <a class="lnk" href=${`#/devices?entity=${encodeURIComponent(x.entity_id)}`} data-incident-to-door>${it('toDoor')}</a>
            </li>`;
          })}</ul>`}
    </div>`;
  }

  private renderInfra() {
    const e = this.elevators.state === 'ready' ? this.elevators.data : null;
    const g = this.generators.state === 'ready' ? this.generators.data : null;
    if (!e?.length && !g?.length) return nothing; // the panel leaves entirely when the caller lacks both (or the site has neither)
    const rows = [
      ...(e ?? []).slice(0, 2).map((x) => ({ id: x.id, icon: 'elevator' as const, name: x.name, sub: x.area_name ?? it('elevator'), look: (ELEVATOR_LOOK[x.state] ?? 'ok') as Look, badge: elt(ELEVATOR_STATE_KEY[x.state] ?? 'stateUnknown') })),
      ...(g ?? []).slice(0, 1).map((x) => ({ id: x.id, icon: 'power' as const, name: x.name, sub: x.area_name ?? it('generator'),
        look: (x.availability === 'online' && !x.stale ? 'ok' : x.availability === 'offline' ? 'off' : 'warn') as Look,
        badge: x.availability === 'online' && !x.stale ? it('genOnline') : x.availability === 'offline' ? it('genOffline') : it('genStale') })),
    ];
    return html`<div class="panel infra" data-pane="doors" data-incident-infra ?hidden-part=${this.hiddenPart('doors')}>
      <div class="hd"><h2>${it('infraTitle')}</h2><span class="sp"></span><a class="lnk" href="#/infra/elevators">${it('infraLink')}</a></div>
      <div class="rows">${rows.map((r) => html`<div class="li" data-look=${r.look} data-infra=${r.id}><span class="ico"><sw-icon name=${r.icon} size=${16}></sw-icon></span>
        <div class="grow"><div class="t1">${r.name}</div><div class="t2">${r.sub}</div></div><span class="badge sm">${r.badge}</span></div>`)}</div>
    </div>`;
  }

  private stepText(s: IncidentStep): { t1: string; t2: string; look: Look } {
    const who = s.actor || it('system');
    switch (s.kind) {
      case 'opened': return { t1: s.text || it('stepOpened'), t2: it('stepOpenedBy', { src: this.detail?.source_label ?? '', who }), look: 'alarm' };
      case 'notified': return { t1: it('stepNotified', { n: s.recipients?.length ?? Number(s.text ?? 0) }), t2: (s.recipients ?? []).join(', '), look: 'acc' };
      case 'acked': return { t1: it('stepAcked', { who }), t2: s.text === 'first' ? it('stepAckedFirst') : '', look: 'ok' };
      case 'door_open': return { t1: s.actor ? it('stepDoorOpenBy', { who: s.actor }) : it('stepDoorOpen'), t2: [s.text, s.unconfirmed ? it('stepDoorUnconfirmed') : ''].filter(Boolean).join(' · '), look: 'warn' };
      case 'note': return { t1: it('stepNote', { who }), t2: s.text ? `"${s.text}"` : '', look: 'acc' };
      case 'event_added': return { t1: it('stepAdded'), t2: s.text ?? '', look: 'warn' };
      case 'closed': return { t1: it('stepClosed', { who }), t2: s.text ?? '', look: 'off' };
      default: return { t1: s.text ?? '', t2: '', look: 'unk' };
    }
  }

  private renderChain(d: IncidentDetail) {
    // the newest steps when the rail cannot hold them all (never an inner scroll): the full chain is in the audit
    const max = this.narrow ? 9 : 8;
    const steps = d.steps.slice(-max);
    return html`<div class="panel fill" data-pane="chain" ?hidden-part=${this.hiddenPart('chain')}>
      <div class="hd"><h2>${it('chainTitle')}</h2>${d.pending.length ? html`<span class="chip" data-look="warn"><span class="d"></span>${it('chainWaiting', { n: d.pending.length })}</span>` : nothing}<span class="sp"></span>
        ${d.can_audit ? html`<a class="lnk" href=${`#/system/audit?resource_id=${encodeURIComponent(d.id)}`} data-incident-audit>${it('audit')}</a>` : nothing}</div>
      <ol class="chain" data-incident-chain>
        ${steps.map((s) => {
          const t = this.stepText(s);
          return html`<li class="step" data-look=${t.look} data-step=${s.kind}><span class="dot"></span><div><div class="t1">${t.t1}</div>${t.t2 ? html`<div class="t2">${t.t2}</div>` : nothing}</div><span class="w num">${this.when(s.at)}</span></li>`;
        })}
        ${d.pending.length && d.status === 'open' ? html`<li class="step wait" data-step="waiting"><span class="dot"></span><div><div class="t1">${it('stepWaiting')}</div><div class="t2">${d.pending.join(' · ')}</div></div><span class="w">-</span></li>` : nothing}
      </ol>
      ${d.status === 'open' && d.can_ack ? html`<div class="chainfoot"><sw-button size="sm" variant="ghost" icon="edit" data-incident-note @click=${() => (this.sheet = 'note')}>${it('addNote')}</sw-button></div>` : nothing}
    </div>`;
  }

  private renderSheets() {
    const d = this.detail;
    return html`
      <sw-sheet ?open=${this.sheet === 'settings'} heading=${it('sTitle')} data-incident-settings-sheet @close=${() => (this.sheet = null)}>
        ${this.sheet === 'settings' ? html`<incident-settings-form sheet @close=${() => (this.sheet = null)} @saved=${() => { this.sheet = null; this.flash(it('saved')); void this.reload(true); }}></incident-settings-form>` : nothing}
      </sw-sheet>
      <sw-sheet ?open=${this.sheet === 'close'} narrow heading=${it('close')} data-incident-close-sheet @close=${() => (this.sheet = null)}>
        <div class="form"><p>${it('closeConfirm')}</p>
          <label>${it('closeNote')}<textarea maxlength="500" .value=${this.closeNoteText} @input=${(e: Event) => (this.closeNoteText = (e.target as HTMLTextAreaElement).value)}></textarea></label>
          <div class="acts"><sw-button @click=${() => (this.sheet = null)}>${it('cancel')}</sw-button><sw-button variant="danger" data-incident-close-confirm ?disabled=${this.busy} @click=${() => void this.doClose()}>${it('closeDo')}</sw-button></div></div>
      </sw-sheet>
      <sw-sheet ?open=${this.sheet === 'note'} narrow heading=${it('addNote')} @close=${() => (this.sheet = null)}>
        <div class="form"><label>${it('addNote')}<textarea maxlength="500" placeholder=${it('notePlaceholder')} .value=${this.noteText} data-incident-note-text @input=${(e: Event) => (this.noteText = (e.target as HTMLTextAreaElement).value)}></textarea></label>
          <div class="acts"><sw-button @click=${() => (this.sheet = null)}>${it('cancel')}</sw-button><sw-button variant="primary" data-incident-note-save ?disabled=${this.busy || !this.noteText.trim()} @click=${() => void this.doNote()}>${it('noteSave')}</sw-button></div></div>
      </sw-sheet>
      <sw-sheet ?open=${this.sheet === 'manual'} narrow heading=${it('openManualTitle')} data-incident-manual-sheet @close=${() => (this.sheet = null)}>
        <div class="form">
          <label>${it('manualFloor')}<select data-incident-manual-floor .value=${this.manualFloor} @change=${(e: Event) => (this.manualFloor = (e.target as HTMLSelectElement).value)}>
            ${this.manualFloors.map((f) => html`<option value=${f.id} ?selected=${f.id === this.manualFloor}>${f.label}</option>`)}</select></label>
          <label>${it('manualTitle')}<input maxlength="120" placeholder=${it('manualDefault')} .value=${this.manualTitle} @input=${(e: Event) => (this.manualTitle = (e.target as HTMLInputElement).value)} /></label>
          <p>${it('physicalNote')}</p>
          <div class="acts"><sw-button @click=${() => (this.sheet = null)}>${it('cancel')}</sw-button><sw-button variant="primary" data-incident-manual-open ?disabled=${this.busy || !this.manualFloor} @click=${() => void this.doManual()}>${it('manualOpen')}</sw-button></div>
        </div>
      </sw-sheet>
      ${d ? html`<sw-case-picker .item=${this.casePick} subheading=${`${it('pageTitle')} · ${d.title}`} @close=${() => (this.casePick = null)}></sw-case-picker>` : nothing}`;
  }
}

/** The event page's entry (CR §3 T2): open a live incident from an event - only while the module is on and the caller holds events.ack
 * somewhere (the server checks it on the camera). Exported for the event page and the unit spec. */
export function mayOpenFromEvent(moduleOn: boolean): boolean {
  return moduleOn && (!isApi() || canAnywhere('events.ack'));
}

declare global {
  interface HTMLElementTagNameMap {
    'investigate-incidents': InvestigateIncidents;
  }
}
