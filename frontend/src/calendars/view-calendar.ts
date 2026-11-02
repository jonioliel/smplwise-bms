import { LitElement, html, nothing, css, type PropertyValues } from 'lit';
import { customElement, property, state } from 'lit/decorators.js';
import '../components/sw-icon';
import { ApiError, describeError } from '../api/client';
import type { Calendar, NewEvent, Occurrence } from '../api/calendars';
import { CAL_EVENTS, emit, visibleCals, type CalCtx } from './ctx';
import {
  DAY_LONG, DAY_SHORT, MONTHS, TYPE_GROUP, addDays, colorVar, grouped, hm, isoDate, markOf, minutesOf, monthGrid, onDay, pad, pageOf, placeDay, sameDay, startOfDay, weekStart,
} from './model';
import { calCss } from './styles';
import { parseDateParam, readHashParam, rruleOf, writeHashParams } from './booking-logic';
import {
  Press, UndoStack, clickSpan, dragSpan, durText, hintFor, hintTag, instantAt, kbStep, minOfDay, minuteAt, moveSpan, movedText, openOn, resizeSpan, snapFloor, stepOf,
  type Band, type Hint, type HintSettings, type KbSel, type PressTarget, type UndoItem,
} from './grid-logic';
import './grid-overlays';
import type { Anchor, QuickDraft } from './grid-overlays';

export type CalMode = 'month' | 'week' | 'day';
const FROM_H = 7;
const TO_H = 22;
const BAND: Band = { from: FROM_H * 60, to: TO_H * 60 };
const HINT_DEFAULTS: HintSettings = { contested_requests: 'queue', maintenance_overlap: 'first_holds', editors_bypass_approval: true, pending_holds_slot: false };
const COACH_KEY = 'sw.cal.grid.coach';
const UNDO_TOAST_MS = 6000; // the organizer's cancel / move notice waits as long (setting cancel_notice_delay_s, default 6 s)

interface Col { key: string; day: Date; cal?: Calendar }
interface Drag { occ: Occurrence; mode: 'move' | 'resize'; col: number; s: number; e: number; grab: number; hint: Hint | null; same: boolean }
interface Toast { text: string; undo: boolean; bad: boolean; id: number }

/**
 * CALENDARS-UI-2310 slice A: יומנים › יומן - month / week / day with the calendar switcher (the approved round-8 mock-up). The switcher
 * groups the viewer's calendars by type (colour check boxes, a lock for view-only); on a tablet it is hidden and opens on tap (setting
 * `tablet_panels`, owner answer 23A) or kept narrow; on the phone it opens as a sheet. Week and day draw the hour band 07-22 with the now
 * line; entries the sync flagged stand side by side with a red frame (setting `sync_conflict_display`, owner answer 22A). Nothing scrolls:
 * the month caps the entries per cell ("עוד N"), the day pages its calendars.
 *
 * CAL-GRID-EDIT-2343 (owner answers 02.11, the approved round-13 prototype): Outlook-style editing on the week and day grid.
 * - drag over free time selects it; a click is 30 minutes (or one step); the quick create opens next to the selection (a sheet on the phone);
 * - a click on an entry opens its peek card (ערוך · שכפל · מחק · אישור / דחייה for the calendar's manager), a double click the full drawer;
 * - dragging an entry moves it (across days in the week, across calendars in the day), its bottom edge resizes it - snapped to the calendar's
 *   own step (2C) - unless the installation chose "create only" (setting `grid_edit`, owner answer 1B);
 * - phone and tablet: a long press selects and a drag extends it; a long press on an entry picks it up (4A); "+ חדש" stays;
 * - keyboard: arrows / Shift + arrows / Enter / Esc / Ctrl+Z / Delete (keyboard actions never animate);
 * - feedback while dragging per the product's rules (grid-logic.hintFor); every write is the server's PATCH / POST, which decides again;
 * - "בטל" after a move, a resize, a delete or a create, and Ctrl+Z (the organizer's notice waits for it on the server).
 * In the resident's phone flow (`resident`) the day shows only the rooms he may book; other people's bookings read "תפוס".
 */
@customElement('cal-view-calendar')
export class CalViewCalendar extends LitElement {
  static styles = [calCss, css`
    :host { display: flex; gap: 14px; min-block-size: 0; min-inline-size: 0; position: relative; }
    .main { flex: 1; min-inline-size: 0; }
    .big { font-size: var(--sw-fs-2xl); font-weight: var(--sw-fw-bold); color: var(--sw-heading); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; min-inline-size: 0; }
    .switcher { inline-size: 270px; flex: none; gap: 2px; }
    .switcher.narrow { inline-size: 210px; }
    .switcher .grp { font-size: var(--sw-fs-sm); font-weight: var(--sw-fw-bold); color: var(--sw-text-2); margin: 8px 4px 2px; }
    .switcher .list { min-block-size: 0; overflow: hidden; display: flex; flex-direction: column; gap: 1px; }
    .cal-it { display: flex; align-items: center; gap: 10px; min-block-size: 32px; padding-inline: 8px; border-radius: var(--sw-r-md); font: inherit; font-size: var(--sw-fs-md);
      font-weight: var(--sw-fw-semibold); color: var(--sw-text); background: transparent; border: 0; cursor: pointer; text-align: start; inline-size: 100%; -webkit-tap-highlight-color: transparent; flex: none; }
    .cal-it .box { inline-size: 18px; block-size: 18px; border-radius: var(--sw-r-xs); flex: none; display: grid; place-items: center; box-shadow: inset 0 0 0 2px var(--h); color: var(--sw-text-inverse); }
    .cal-it[aria-pressed='true'] .box { background: var(--h); }
    .cal-it[aria-pressed='false'] { color: var(--sw-text-2); }
    .cal-it[aria-pressed='false'] .box sw-icon { visibility: hidden; }
    .cal-it .lock { margin-inline-start: auto; color: var(--sw-text-3); display: inline-flex; }
    @media (hover: hover) { .cal-it:hover { background: var(--sw-hover-wash); } }
    .scrim { position: fixed; inset: 0; background: var(--sw-overlay); z-index: var(--sw-z-modal); }
    .switcher.overlay { position: fixed; inset-block: 12px; inset-inline-end: 12px; z-index: calc(var(--sw-z-modal) + 1); box-shadow: var(--sw-shadow-3); inline-size: min(300px, calc(100vw - 24px)); }
    .month { flex: 1; min-block-size: 0; display: grid; grid-template-rows: auto minmax(0, 1fr); }
    .mhead, .mgrid { display: grid; grid-template-columns: repeat(7, minmax(0, 1fr)); }
    .mhead div { padding: 0 8px 6px; font-size: var(--sw-fs-sm); font-weight: var(--sw-fw-bold); color: var(--sw-text-2); }
    .mgrid { grid-template-rows: repeat(6, minmax(0, 1fr)); gap: 3px; min-block-size: 0; }
    .mcell { background: var(--sw-surface-2); border-radius: var(--sw-r-md); padding: 6px 6px 4px; display: flex; flex-direction: column; gap: 3px; min-block-size: 0; min-inline-size: 0;
      overflow: hidden; border: 0; font: inherit; text-align: start; cursor: pointer; color: inherit; -webkit-tap-highlight-color: transparent; }
    .mcell.we { background: var(--sw-surface-3); }
    .mcell.out { opacity: 0.5; }
    .mcell .d { font-size: var(--sw-fs-sm); font-weight: var(--sw-fw-bold); color: var(--sw-text-2); display: flex; align-items: center; gap: 6px; min-block-size: 22px; min-inline-size: 0; }
    .mcell.today .d b { background: var(--sw-accent); color: var(--sw-text-inverse); border-radius: var(--sw-r-pill); min-inline-size: 24px; block-size: 22px; display: inline-grid; place-items: center; padding-inline: 6px; }
    .mcell[aria-pressed='true'] { box-shadow: inset 0 0 0 2px var(--sw-accent); }
    .mcell .ev { font-size: var(--sw-fs-sm); font-weight: var(--sw-fw-semibold); block-size: 20px; line-height: 20px; padding: 0 6px; display: flex; gap: 5px; align-items: center; flex: none; inline-size: 100%; }
    .mcell .ev .t { font-weight: var(--sw-fw-bold); flex: none; }
    .mcell .more { font-size: var(--sw-fs-sm); font-weight: var(--sw-fw-bold); color: var(--sw-text-2); padding-inline: 6px; }
    .dots { display: flex; gap: 3px; flex-wrap: wrap; justify-content: center; }
    .dots i { inline-size: 7px; block-size: 7px; border-radius: 50%; background: var(--h); }
    .week { flex: 1; min-block-size: 0; display: grid; grid-template-columns: 52px repeat(var(--cols), minmax(0, 1fr)); grid-template-rows: auto minmax(0, 1fr); column-gap: 3px;
      user-select: none; -webkit-user-select: none; -webkit-touch-callout: none; outline: none; border-radius: var(--sw-r-md); }
    .week:focus-visible { outline: var(--sw-focus-w) solid var(--sw-focus); outline-offset: 4px; }
    @media (pointer: coarse) { .week { touch-action: none; } }
    .wh { padding: 0 6px 8px; font-weight: var(--sw-fw-bold); color: var(--sw-text-2); font-size: var(--sw-fs-sm); display: flex; gap: 6px; align-items: baseline; min-inline-size: 0;
      border: 0; background: transparent; font-family: inherit; cursor: pointer; text-align: start; }
    .wh b { font-size: var(--sw-fs-2xl); font-weight: var(--sw-fw-bold); color: var(--sw-heading); }
    .wh.today b { color: var(--sw-accent-text); }
    .wh.cal { align-items: center; cursor: default; }
    .wh.cal b { font-size: var(--sw-fs-lg); }
    .wh .lk { margin-inline-start: auto; font-size: var(--sw-fs-2xs); font-weight: var(--sw-fw-semibold); color: var(--sw-text-3); display: inline-flex; align-items: center; gap: 2px; white-space: nowrap; }
    .axis { position: relative; }
    .axis span { position: absolute; inset-inline-end: 6px; transform: translateY(-50%); font-size: var(--sw-fs-xs); color: var(--sw-text-3); font-weight: var(--sw-fw-semibold); }
    .axis span:first-child { transform: none; }
    .col { position: relative; background: var(--sw-surface-2); border-radius: var(--sw-r-md); min-block-size: 0; }
    .col.we { background: var(--sw-surface-3); }
    .col.lift-z { z-index: 3; }
    .col .hl { position: absolute; inset-inline: 0; block-size: 1px; background: color-mix(in srgb, var(--sw-text) 7%, transparent); pointer-events: none; }
    .col .ev { position: absolute; padding: 3px 6px; font-size: var(--sw-fs-xs); font-weight: var(--sw-fw-semibold); line-height: 1.3; z-index: 1; transition: opacity 150ms ease, box-shadow 150ms ease; }
    .col .ev b { display: flex; gap: 4px; align-items: center; font-size: var(--sw-fs-sm); min-inline-size: 0; }
    .col .ev .tm { display: block; font-variant-numeric: tabular-nums; }
    .col .ev[data-flag='conflict'] sw-icon { color: var(--sw-danger-text); flex: none; }
    .col .ev.contest { box-shadow: inset 0 0 0 2px var(--sw-danger); }
    .col .ev.ed { cursor: grab; }
    .col .ev.src { opacity: 0.3; }
    .col .ev.lift { box-shadow: var(--sw-shadow-2), inset 0 0 0 2px var(--sw-accent); z-index: 5; }
    .col .ev.fresh { animation: fresh 220ms var(--sw-ease-dialog); }
    @keyframes fresh { from { opacity: 0; transform: scale(0.97); } }
    .ev .rz { position: absolute; inset-inline: 0; inset-block-end: 0; block-size: 9px; cursor: ns-resize; }
    .ev .rz::after { content: ''; position: absolute; inset-block-end: 2px; inset-inline-start: 50%; inline-size: 22px; block-size: 3px; margin-inline-start: -11px; border-radius: 2px; background: currentColor; opacity: 0; transition: opacity 120ms ease; }
    @media (hover: hover) and (pointer: fine) { .ev.ed:hover .rz::after { opacity: 0.5; } }
    @media (pointer: coarse) { .ev .rz { block-size: 16px; } .ev .rz::after { opacity: 0.4; } }
    .col .allday { position: absolute; inset: 8px 8px auto; font-weight: var(--sw-fw-bold); color: var(--sw-text-2); font-size: var(--sw-fs-sm); pointer-events: none; }
    .closedz { position: absolute; inset-inline: 0; pointer-events: none; display: grid; place-items: center; font-size: var(--sw-fs-xs); color: var(--sw-text-3); font-weight: var(--sw-fw-semibold); }
    .closedz.t { border-radius: var(--sw-r-md) var(--sw-r-md) 0 0; }
    .closedz.b { border-radius: 0 0 var(--sw-r-md) var(--sw-r-md); }
    .closedz.all { border-radius: var(--sw-r-md); }
    .past { position: absolute; inset-inline: 0; inset-block-start: 0; background: color-mix(in srgb, var(--sw-text-3) 8%, transparent); pointer-events: none; border-radius: var(--sw-r-md) var(--sw-r-md) 0 0; }
    .held { position: absolute; inset-inline: 3px; border-radius: var(--sw-r-xs); outline: 1.5px dotted var(--sw-text-3); outline-offset: -1.5px; z-index: 0; font-size: var(--sw-fs-2xs); line-height: 1.3;
      color: var(--sw-text-3); padding: 3px 7px; pointer-events: none; background: color-mix(in srgb, var(--sw-text-3) 6%, transparent); overflow: hidden; }
    .hov { position: absolute; inset-inline: 3px; border-radius: var(--sw-r-xs); background: color-mix(in srgb, var(--sw-accent) 10%, transparent); color: var(--sw-accent-text);
      font-size: var(--sw-fs-2xs); font-weight: var(--sw-fw-bold); padding: 2px 7px; pointer-events: none; z-index: 1; }
    .sel, .drag { position: absolute; inset-inline: 3px; z-index: 7; pointer-events: none; }
    .sel .box { position: absolute; inset: 0; border-radius: var(--sw-r-xs); background: color-mix(in srgb, var(--sw-accent) 18%, var(--sw-surface-solid)); box-shadow: inset 0 0 0 2px var(--sw-accent);
      color: var(--sw-accent-text); padding: 3px 7px; font-size: var(--sw-fs-xs); overflow: hidden; display: flex; flex-direction: column; }
    .sel.lv-pend .box { background: color-mix(in srgb, var(--sw-accent) 8%, var(--sw-surface-solid)); box-shadow: none; outline: 2px dashed var(--sw-accent); outline-offset: -2px; }
    .sel.lv-bad .box, .sel.lv-contest .box { background: color-mix(in srgb, var(--sw-danger) 12%, var(--sw-surface-solid)); box-shadow: inset 0 0 0 2px var(--sw-danger); color: var(--sw-danger-text); }
    .drag > .ev { position: absolute; inset: 0; box-shadow: var(--sw-shadow-2), inset 0 0 0 2px var(--sw-accent); cursor: grabbing; }
    .drag.lv-bad > .ev, .drag.lv-contest > .ev { box-shadow: var(--sw-shadow-2), inset 0 0 0 2px var(--sw-danger); outline: none; background: color-mix(in srgb, var(--sw-danger) 12%, var(--sw-surface-solid)); color: var(--sw-danger-text); }
    .drag.lv-pend > .ev { outline: 2px dashed var(--sw-accent); outline-offset: -2px; }
    .tag { position: absolute; inset-inline-start: 0; inset-block-end: calc(100% + 4px); background: var(--sw-toast-bg); color: var(--sw-toast-text); font-size: var(--sw-fs-2xs); font-weight: var(--sw-fw-bold);
      padding: 2px 8px; border-radius: var(--sw-r-xs); white-space: nowrap; z-index: 8; }
    .why { position: absolute; inset-inline-start: 0; inset-block-start: calc(100% + 4px); inline-size: max-content; max-inline-size: 250px; background: var(--sw-danger); color: var(--sw-text-inverse);
      font-size: var(--sw-fs-2xs); font-weight: var(--sw-fw-semibold); padding: 4px 8px; border-radius: var(--sw-r-xs); line-height: 1.35; z-index: 8; display: flex; gap: 5px; align-items: flex-start; box-shadow: var(--sw-shadow-2); }
    .why.pend { background: var(--sw-surface-solid); color: var(--sw-accent-text); box-shadow: inset 0 0 0 1.5px var(--sw-accent), var(--sw-shadow-2); }
    .why.warn { background: var(--sw-surface-solid); color: var(--sw-warning-text); box-shadow: inset 0 0 0 1.5px var(--sw-warning), var(--sw-shadow-2); }
    .flip .tag { inset-block-end: auto; inset-block-start: calc(100% + 4px); }
    .flip .why { inset-block-start: calc(100% + 30px); }
    .flipb .why { inset-block-start: auto; inset-block-end: calc(100% + 30px); }
    .ring { position: absolute; inline-size: 48px; block-size: 48px; margin: -24px 0 0 -24px; border-radius: 50%; border: 3px solid var(--sw-accent); pointer-events: none; z-index: 9;
      animation: ring 450ms linear forwards; }
    @keyframes ring { from { transform: scale(0.45); opacity: 0.2; } to { transform: scale(1); opacity: 1; } }
    .now { position: absolute; inset-inline: 0; block-size: 2px; background: var(--sw-accent); z-index: 2; pointer-events: none; }
    .now::before { content: ''; position: absolute; inset-inline-end: -1px; inset-block-start: -4px; inline-size: 10px; block-size: 10px; border-radius: 50%; background: var(--sw-accent); }
    .coach { display: flex; align-items: center; gap: 8px; background: var(--sw-accent-soft); color: var(--sw-accent-text); border-radius: var(--sw-r-lg); padding: 7px 10px; font-size: var(--sw-fs-sm); font-weight: var(--sw-fw-semibold); }
    .coach .btn { margin-inline-start: auto; border: 0; background: transparent; color: inherit; inline-size: 32px; min-block-size: 32px; }
    .agenda { display: flex; flex-direction: column; gap: 6px; min-block-size: 0; overflow: hidden; }
    .agenda h3 { margin: 4px 0 0; font-size: var(--sw-fs-lg); font-weight: var(--sw-fw-bold); color: var(--sw-heading); }
    .agenda .row { min-block-size: 44px; border: 0; font: inherit; text-align: start; cursor: pointer; inline-size: 100%; flex: none; }
    .agenda .row b { color: var(--sw-heading); }
    .fail { color: var(--sw-danger-text); font-size: var(--sw-fs-sm); }
    .toasts { position: fixed; inset-inline: 0; inset-block-end: 24px; display: grid; justify-items: center; pointer-events: none; z-index: var(--sw-z-toast); }
    .toast { display: flex; align-items: center; gap: 12px; background: var(--sw-toast-bg); color: var(--sw-toast-text); border-radius: var(--sw-r-lg); padding-block: 9px; padding-inline: 14px 10px;
      font-size: var(--sw-fs-md); box-shadow: var(--sw-shadow-3); pointer-events: auto; max-inline-size: min(92vw, 640px);
      transform: translateY(calc(100% + 30px)); opacity: 0; transition: transform 240ms var(--sw-ease-dialog), opacity 240ms var(--sw-ease-dialog); }
    .toast.in { transform: none; opacity: 1; }
    .toast.bad { background: var(--sw-danger); color: var(--sw-text-inverse); }
    .toast .tb { border: 0; background: transparent; color: inherit; font: inherit; font-weight: var(--sw-fw-bold); text-decoration: underline; text-underline-offset: 3px; cursor: pointer; padding: 4px 6px; border-radius: var(--sw-r-xs); }
    .toast .tb:focus-visible { outline: 2px solid currentColor; }
    @media (prefers-reduced-motion: reduce) {
      .toast { transform: none; transition: opacity 200ms ease; }
      .col .ev.fresh { animation: none; }
      .ring { animation: ringfade 450ms linear forwards; }
      @keyframes ringfade { from { opacity: 0.2; } to { opacity: 1; } }
    }
    @media (max-width: 699px) {
      :host { flex-direction: column; }
      .panel { padding: 12px; gap: 10px; }
      .big { font-size: var(--sw-fs-xl); }
      .ph { gap: 6px; }
      .month { flex: none; block-size: 262px; }
      .mhead div { padding: 0 0 4px; text-align: center; }
      .mcell { padding: 3px; border-radius: var(--sw-r-sm); align-items: center; gap: 2px; }
      .mcell .d { justify-content: center; min-block-size: 20px; }
      .week { grid-template-columns: 40px repeat(var(--cols), minmax(0, 1fr)); }
      .wh b { font-size: var(--sw-fs-xl); }
      .toasts { inset-block-end: calc(var(--sw-bottomnav-h) + 16px + env(safe-area-inset-bottom, 0px)); }
    }
  `];

  @property({ attribute: false }) ctx: CalCtx | null = null;
  /** CAL-GRID-EDIT-2343: the resident's phone day grid - only the rooms he may book, the day view only */
  @property({ type: Boolean }) resident = false;
  @state() private mode: CalMode = 'month';
  @state() private anchor: Date = startOfDay(new Date());
  @state() private picked: Date | null = null;
  @state() private hiddenCals = new Set<string>();
  @state() private occ: Occurrence[] = [];
  @state() private error = '';
  @state() private switcherOpen = false;
  @state() private dayPage = 1;
  @state() private cap = 3;
  // CAL-GRID-EDIT-2343
  @state() private sel: { col: number; s: number; e: number } | null = null;
  @state() private draft: QuickDraft | null = null;
  @state() private ov: 'quick' | 'peek' | null = null;
  @state() private ovAnchor: Anchor | null = null;
  @state() private ovInstant = false;
  @state() private ovBusy = false;
  @state() private ovError = '';
  @state() private seriesClash: number | null = null;
  @state() private peek: Occurrence | null = null;
  @state() private displaceAsk: { title: string | null; start: string; end: string } | null = null;
  @state() private drag: Drag | null = null;
  @state() private lifted = '';
  @state() private hover: { col: number; m: number } | null = null;
  @state() private ring: { col: number; x: number; y: number } | null = null;
  @state() private toast: Toast | null = null;
  @state() private toastIn = false;
  @state() private coach = true;
  @state() private live = '';
  @state() private fresh = new Set<string>();
  private hints: HintSettings = HINT_DEFAULTS;
  private undoStack = new UndoStack();
  private press: Press | null = null;
  private pressTimer = 0;
  private toastTimer = 0;
  private seriesTimer = 0;
  private kb: KbSel | null = null;
  private lastClick: { id: string; t: number } | null = null;
  private lastCal = '';
  private cols: Col[] = [];
  private loadedKey = '';
  private ro: ResizeObserver | null = null;
  private host: EventTarget | null = null;
  private onChanged = () => this.reload();
  private onDocKey = (e: KeyboardEvent) => this.docKey(e);
  private onDocDown = (e: PointerEvent) => {
    if (this.ov !== 'quick' && this.ov !== 'peek') return;
    if (e.composedPath().includes(this)) return;
    this.closeOverlay();
  };

  connectedCallback(): void {
    super.connectedCallback();
    const v = readHashParam('view');
    this.mode = this.resident ? 'day' : v === 'week' || v === 'day' ? v : 'month';
    this.anchor = parseDateParam(readHashParam('date'), this.ctx?.now ?? new Date());
    try {
      const raw = sessionStorage.getItem('sw.cal.hidden');
      if (raw && !this.resident) this.hiddenCals = new Set(JSON.parse(raw) as string[]);
      this.coach = localStorage.getItem(COACH_KEY) !== 'off';
    } catch {
      /* storage unavailable: every calendar shown, the hint shown */
    }
    this.ro = new ResizeObserver(() => this.fitMonth());
    // a booking made in the drawer (a sibling of this view) changes what is drawn: the page hears CAL_EVENTS.changed
    // (inside the resident's flow the page is one shadow root further up)
    let h: Element | null = (this.getRootNode() as ShadowRoot).host ?? null;
    while (h && h.tagName !== 'CALENDARS-PAGE' && h.getRootNode() instanceof ShadowRoot) h = (h.getRootNode() as ShadowRoot).host;
    this.host = h;
    this.host?.addEventListener(CAL_EVENTS.changed, this.onChanged);
    document.addEventListener('keydown', this.onDocKey);
    document.addEventListener('pointerdown', this.onDocDown);
    void this.loadSettings();
  }

  disconnectedCallback(): void {
    super.disconnectedCallback();
    this.ro?.disconnect();
    this.host?.removeEventListener(CAL_EVENTS.changed, this.onChanged);
    document.removeEventListener('keydown', this.onDocKey);
    document.removeEventListener('pointerdown', this.onDocDown);
    clearTimeout(this.pressTimer);
    clearTimeout(this.toastTimer);
    clearTimeout(this.seriesTimer);
  }

  protected updated(): void {
    const g = this.renderRoot.querySelector('.mgrid');
    if (g && this.ro) this.ro.observe(g);
  }

  protected willUpdate(changed: PropertyValues): void {
    if (changed.has('resident') && this.resident) this.mode = 'day';
    if (changed.has('ctx') || changed.has('mode') || changed.has('anchor')) void this.load();
  }

  private async loadSettings(): Promise<void> {
    try {
      const api = this.ctx?.api;
      if (!api) return;
      const { settings } = await api.settings();
      this.hints = { contested_requests: settings.contested_requests, maintenance_overlap: settings.maintenance_overlap, editors_bypass_approval: settings.editors_bypass_approval,
        pending_holds_slot: settings.pending_holds_slot };
    } catch {
      /* the hints use the documented defaults; the server decides anyway */
    }
  }

  /** The month caps the entries per cell by the cell's height ("עוד N" for the rest): no cell ever scrolls. */
  private fitMonth(): void {
    const cell = this.renderRoot.querySelector('.mcell') as HTMLElement | null;
    if (!cell) return;
    const cap = Math.max(0, Math.floor((cell.clientHeight - 52) / 23));
    if (cap !== this.cap) this.cap = cap;
  }

  private range(): { from: Date; to: Date } {
    if (this.mode === 'month') {
      const g = monthGrid(this.anchor);
      return { from: g[0].day, to: addDays(g[41].day, 1) };
    }
    if (this.mode === 'week') {
      const s = weekStart(this.anchor);
      return { from: s, to: addDays(s, 7) };
    }
    return { from: startOfDay(this.anchor), to: addDays(startOfDay(this.anchor), 1) };
  }

  private async load(): Promise<void> {
    const ctx = this.ctx;
    if (!ctx) return;
    const { from, to } = this.range();
    const key = `${from.toISOString()}|${to.toISOString()}|${ctx.cals.map((c) => c.id).join(',')}`;
    if (key === this.loadedKey) return;
    this.loadedKey = key;
    try {
      const r = await ctx.api.occurrences(from.toISOString(), to.toISOString());
      if (this.loadedKey !== key) return;
      this.occ = r.occurrences.filter((o) => !['cancelled', 'rejected', 'withdrawn', 'expired'].includes(o.state));
      this.error = '';
    } catch (e) {
      this.error = describeError(e);
    }
  }

  /** The page asks again after a booking (CAL_EVENTS.changed reloads the calendars, which hands a new ctx). */
  reload(): void {
    this.loadedKey = '';
    void this.load();
  }

  private setMode(m: CalMode): void {
    this.mode = this.resident ? 'day' : m;
    this.dayPage = 1;
    this.clearSel();
    if (!this.resident) writeHashParams({ view: m, date: isoDate(this.anchor) });
  }

  private go(step: number): void {
    const a = this.anchor;
    this.anchor = this.mode === 'month' ? new Date(a.getFullYear(), a.getMonth() + step, 1) : addDays(a, this.mode === 'week' ? step * 7 : step);
    this.picked = null;
    this.clearSel();
    if (!this.resident) writeHashParams({ view: this.mode, date: isoDate(this.anchor) });
  }

  private today(): void {
    this.anchor = startOfDay(this.ctx?.now ?? new Date());
    this.picked = null;
    this.clearSel();
    if (!this.resident) writeHashParams({ view: this.mode, date: isoDate(this.anchor) });
  }

  private toggle(id: string): void {
    const h = new Set(this.hiddenCals);
    if (h.has(id)) h.delete(id);
    else h.add(id);
    this.hiddenCals = h;
    try {
      sessionStorage.setItem('sw.cal.hidden', JSON.stringify([...h]));
    } catch {
      /* the choice lasts for this page only */
    }
  }

  private shownCals(): Calendar[] {
    const list = visibleCals(this.ctx as CalCtx).filter((c) => !this.hiddenCals.has(c.id));
    // the resident sees only the rooms he may book (owner answer 4A / prototype: other rooms are not his to see here)
    return this.resident ? list.filter((c) => c.type === 'room' && c.my_role && c.my_role !== 'view') : list;
  }

  private shownOcc(): Occurrence[] {
    const ids = new Set(this.shownCals().map((c) => c.id));
    return this.occ.filter((o) => ids.has(o.calendar_id) || o.room_calendar_ids.some((r) => ids.has(r)));
  }

  private calOf(id: string): Calendar | undefined {
    return this.ctx?.cals.find((c) => c.id === id);
  }

  private rangeTitle(): string {
    const a = this.anchor;
    if (this.mode === 'month') return `${MONTHS[a.getMonth()]} ${a.getFullYear()}`;
    if (this.mode === 'week') {
      const s = weekStart(a);
      const e = addDays(s, 6);
      return s.getMonth() === e.getMonth() ? `${s.getDate()}–${e.getDate()} ב${MONTHS[s.getMonth()]} ${s.getFullYear()}` : `${s.getDate()}.${pad(s.getMonth() + 1)}–${e.getDate()}.${pad(e.getMonth() + 1)}.${e.getFullYear()}`;
    }
    return `${DAY_LONG[a.getDay()]}, ${a.getDate()} ב${MONTHS[a.getMonth()]}`;
  }

  render() {
    const ctx = this.ctx;
    if (!ctx) return nothing;
    const dev = ctx.device;
    const collapse = this.resident || dev === 'phone' || (dev === 'tablet' && ctx.access.ui.tablet_panels === 'collapse');
    return html`
      ${collapse ? nothing : this.switcher(dev === 'tablet')}
      <section class="panel main" data-cal-view=${this.mode}>
        ${this.header(collapse)}
        ${this.error ? html`<div class="fail" role="alert" data-cal-error>${this.error}</div>` : nothing}
        ${this.coachLine()}
        ${this.mode === 'month' ? this.month() : this.week(this.mode === 'day')}
      </section>
      ${collapse && this.switcherOpen && !this.resident ? html`<div class="scrim" @click=${() => (this.switcherOpen = false)}></div>${this.switcher(false, true)}` : nothing}
      ${this.overlay()}
      <div class="toasts">${this.toast ? html`<div class=${`toast${this.toastIn ? ' in' : ''}${this.toast.bad ? ' bad' : ''}`} role="status" data-cal-grid-toast>
        <span>${this.toast.text}</span>${this.toast.undo ? html`<button type="button" class="tb" data-cal-undo @click=${() => void this.undo()}>בטל</button>` : nothing}</div>` : nothing}</div>
      <div class="vh" aria-live="polite" data-cal-live>${this.live}</div>`;
  }

  private header(collapse: boolean) {
    const shown = this.shownCals().length;
    const modes: CalMode[] = this.resident ? ['day'] : ['month', 'week', 'day'];
    return html`<div class="ph" data-cal-head>
      <span class="big" data-cal-title>${this.rangeTitle()}</span>
      <button type="button" class="btn icon sm" aria-label="הקודם" data-cal-prev @click=${() => this.go(-1)}><sw-icon name="chevronBack" size="16"></sw-icon></button>
      <button type="button" class="btn icon sm" aria-label="הבא" data-cal-next @click=${() => this.go(1)}><sw-icon name="chevron" size="16"></sw-icon></button>
      <button type="button" class="btn sm" data-cal-today @click=${() => this.today()}>היום</button>
      <span class="sp"></span>
      ${collapse && !this.resident ? html`<button type="button" class="btn sm" data-cal-switcher-open aria-expanded=${String(this.switcherOpen)} @click=${() => (this.switcherOpen = true)}>
        <sw-icon name="calendar" size="16"></sw-icon><span class="num">${shown}</span> יומנים</button>` : nothing}
      ${modes.length > 1 ? html`<div class="seg" role="group" aria-label="תצוגה">
        ${modes.map((m) => html`<button type="button" aria-pressed=${String(this.mode === m)} data-cal-mode=${m} @click=${() => this.setMode(m)}>${{ month: 'חודש', week: 'שבוע', day: 'יום' }[m]}</button>`)}
      </div>` : nothing}
    </div>`;
  }

  private switcher(narrow: boolean, overlay = false) {
    const ctx = this.ctx as CalCtx;
    const list = visibleCals(ctx);
    const shown = list.filter((c) => !this.hiddenCals.has(c.id)).length;
    return html`<aside class=${`panel switcher${narrow && ctx.access.ui.tablet_panels === 'shrink' ? ' narrow' : ''}${overlay ? ' overlay' : ''}`} data-cal-switcher aria-label="יומנים">
      <div class="ph"><h2>יומנים</h2><span class="sp"></span><span class="muted num">${shown} מתוך ${list.length}</span>
        ${overlay ? html`<button type="button" class="btn icon sm" aria-label="סגירה" data-cal-switcher-close @click=${() => (this.switcherOpen = false)}><sw-icon name="close" size="16"></sw-icon></button>` : nothing}</div>
      <div class="list">
        ${grouped(list).map((g) => html`<div class="grp">${TYPE_GROUP[g.type]}</div>
          ${g.cals.map((c) => html`<button type="button" class="cal-it" style=${`--h:${colorVar(c.color)}`} aria-pressed=${String(!this.hiddenCals.has(c.id))} data-cal-toggle=${c.id} @click=${() => this.toggle(c.id)}>
            <span class="box"><sw-icon name="check" size="13"></sw-icon></span><span class="ell" title=${c.name}>${c.name}</span>
            ${c.my_role === 'view' ? html`<span class="lock" title="צפייה בלבד"><sw-icon name="lock" size="14"></sw-icon></span>` : nothing}</button>`)}`)}
      </div></aside>`;
  }

  // ---------- month ----------
  private month() {
    const ctx = this.ctx as CalCtx;
    const phone = ctx.device === 'phone';
    const grid = monthGrid(this.anchor);
    const occ = this.shownOcc().filter((o) => !o.held_slot);
    const now = ctx.now;
    const cap = phone ? 0 : this.cap;
    const picked = this.picked ?? (this.anchor.getMonth() === now.getMonth() && this.anchor.getFullYear() === now.getFullYear() ? startOfDay(now) : this.anchor);
    return html`<div class="month" data-cal-month>
        <div class="mhead">${(phone ? DAY_SHORT : DAY_LONG).map((d) => html`<div>${d}</div>`)}</div>
        <div class="mgrid">${grid.map(({ day, inMonth }) => {
          const evs = onDay(occ, day);
          const hol = evs.find((o) => o.kind === 'holiday');
          const rest = evs.filter((o) => o.kind !== 'holiday');
          const we = day.getDay() >= 5;
          const today = sameDay(day, now);
          return html`<button type="button" class=${`mcell${inMonth ? '' : ' out'}${we ? ' we' : ''}${today ? ' today' : ''}`} aria-pressed=${String(phone && sameDay(day, picked))}
            aria-label=${`${day.getDate()} ב${MONTHS[day.getMonth()]}, ${rest.length} אירועים`} data-cal-day=${isoDate(day)} @click=${() => this.pickDay(day)}>
            <div class="d"><b class="num">${day.getDate()}</b>${hol && !phone ? html`<span class="ell">${hol.title}</span>` : nothing}</div>
            ${rest.slice(0, cap).map((o) => this.monthEv(o))}
            ${phone ? html`<span class="dots">${evs.slice(0, 4).map((o) => html`<i style=${`--h:${colorVar(this.calOf(o.calendar_id)?.color)}`}></i>`)}</span>`
              : rest.length > cap ? html`<div class="more">עוד <span class="num">${rest.length - cap}</span></div>` : nothing}
          </button>`;
        })}</div>
      </div>
      ${phone ? this.agenda(picked, occ) : nothing}`;
  }

  private monthEv(o: Occurrence) {
    const c = this.calOf(o.calendar_id);
    return html`<span class="ev" data-mark=${markOf(o)} data-flag=${o.sync_flag === 'conflict' && this.ctx?.access.ui.sync_conflict_display !== 'list_only' ? 'conflict' : ''}
      style=${`--h:${colorVar(c?.color)}`} title=${o.title ?? 'תפוס'}><span class="t num">${hm(o.start)}</span><span class="ell">${o.title ?? 'תפוס'}</span></span>`;
  }

  /** On the phone a tap on a day lists its entries under the grid; elsewhere it opens the day. */
  private pickDay(day: Date): void {
    if (this.ctx?.device === 'phone') {
      this.picked = day;
      return;
    }
    this.anchor = day;
    this.setMode('day');
  }

  private agenda(day: Date, occ: Occurrence[]) {
    const list = onDay(occ, day);
    const now = this.ctx?.now ?? new Date();
    const fit = list.length > 3 ? 2 : 3;
    return html`<div class="agenda" data-cal-agenda>
      <h3>${sameDay(day, now) ? 'היום, ' : ''}${DAY_LONG[day.getDay()]} ${day.getDate()}.${pad(day.getMonth() + 1)}</h3>
      ${list.length ? list.slice(0, fit).map((o) => html`<button type="button" class="row" data-cal-entry=${o.event_id} @click=${() => this.openDrawer(o.event_id)}>
          <span class="dot" style=${`--h:${colorVar(this.calOf(o.calendar_id)?.color)}`}></span><b class="num">${o.all_day ? 'כל היום' : hm(o.start)}</b>
          <span class="grow ell">${o.title ?? 'תפוס'}</span>${o.state === 'pending' ? html`<span class="chip dash">ממתין</span>` : o.kind === 'maintenance' ? html`<span class="chip">תחזוקה</span>` : nothing}</button>`)
        : html`<span class="muted">אין אירועים ביום הזה.</span>`}
      ${list.length > fit ? html`<button type="button" class="btn sm" data-cal-agenda-more @click=${() => { this.anchor = day; this.setMode('day'); }}>עוד <span class="num">${list.length - fit}</span> · לתצוגת יום</button>` : nothing}
    </div>`;
  }

  // ---------- week / day: the editable grid ----------
  private touch(): boolean {
    return this.ctx?.device !== 'desktop' || matchMedia('(pointer: coarse)').matches;
  }

  private dragEnabled(): boolean {
    return this.ctx?.access.ui.grid_edit !== 'create_only';
  }

  private bookable(c: Calendar | undefined): boolean {
    return !!c && !c.archived && !!c.my_role && c.my_role !== 'view' && c.type !== 'maintenance';
  }

  /** The calendar a selection in column `ci` books in: the column's own (day view), or the last used / first bookable shown (week view). */
  private calForCol(ci: number): Calendar | undefined {
    const col = this.cols[ci];
    if (col?.cal) return this.bookable(col.cal) ? col.cal : undefined;
    const shown = this.shownCals().filter((c) => this.bookable(c));
    return shown.find((c) => c.id === this.lastCal) ?? shown.find((c) => c.type === 'room' && c.my_role === 'manage') ?? shown.find((c) => c.type === 'room') ?? shown[0];
  }

  private columns(day: boolean): { cols: Col[]; pager: unknown } {
    const ctx = this.ctx as CalCtx;
    const phone = ctx.device === 'phone';
    const occ = this.shownOcc();
    let pager: unknown = nothing;
    if (day) {
      const per = phone ? 2 : ctx.device === 'tablet' ? 4 : 6;
      const today = onDay(occ, this.anchor);
      // calendars with entries that day first, then the rest (a free room is a column too); the resident's rooms keep their order
      const shown = this.shownCals();
      const ordered = this.resident ? shown : [...shown.filter((c) => today.some((o) => o.calendar_id === c.id)), ...shown.filter((c) => !today.some((o) => o.calendar_id === c.id))];
      const pg = pageOf(ordered, this.dayPage, per);
      if (pg.pages > 1) {
        pager = html`<div class="pager" data-cal-pager><button type="button" class="btn sm" aria-label="יומנים קודמים" ?disabled=${pg.page <= 1} @click=${() => { this.dayPage = pg.page - 1; this.clearSel(); }}><sw-icon name="chevronBack" size="16"></sw-icon></button>
          <span class="num">${pg.page} / ${pg.pages}</span><button type="button" class="btn sm" aria-label="יומנים הבאים" ?disabled=${pg.page >= pg.pages} @click=${() => { this.dayPage = pg.page + 1; this.clearSel(); }}><sw-icon name="chevron" size="16"></sw-icon></button></div>`;
      }
      return { cols: pg.items.map((c) => ({ key: c.id, day: this.anchor, cal: c })), pager };
    }
    const s = weekStart(this.anchor);
    const all = Array.from({ length: 7 }, (_, i) => addDays(s, i));
    const mid = Math.min(Math.max(this.anchor.getDay(), 1), 5); // the phone shows three days around the chosen one
    const days = phone ? all.slice(mid - 1, mid + 2) : all;
    return { cols: days.map((d) => ({ key: isoDate(d), day: d })), pager };
  }

  private week(day: boolean) {
    const ctx = this.ctx as CalCtx;
    const phone = ctx.device === 'phone';
    const now = ctx.now;
    const occ = this.shownOcc();
    const conflicts = ctx.access.ui.sync_conflict_display !== 'list_only';
    // the columns stay as they were while a gesture or an overlay is on (an entry moving must not reorder the day's columns under the pointer)
    const { cols: fresh, pager } = this.columns(day);
    const cols = this.drag || this.press || this.ov ? (this.cols.length ? this.cols : fresh) : fresh;
    this.cols = cols;
    const hours = TO_H - FROM_H;
    const lines = Array.from({ length: hours }, (_, k) => html`<div class="hl" style=${`top:${(k / hours) * 100}%`}></div>`);
    const nowTop = ((minutesOf(now) - FROM_H * 60) / (hours * 60)) * 100;
    const canCreate = cols.some((_, i) => !!this.calForCol(i));
    const label = canCreate ? 'לוח היומן. חצים מזיזים את הבחירה, Shift וחצים מאריכים, Enter יוצר אירוע' : 'לוח היומן, צפייה בלבד';
    return html`<div class="week" style=${`--cols:${Math.max(1, cols.length)}`} data-cal-week tabindex="0" role="application" aria-label=${label}
        @pointerdown=${this.onDown} @pointermove=${this.onMove} @pointerup=${this.onUp} @pointercancel=${this.onCancel} @pointerleave=${() => { if (!this.press) this.hover = null; }}
        @keydown=${this.onGridKey} @contextmenu=${(e: Event) => { if (this.touch()) e.preventDefault(); }}>
        <div></div>
        ${cols.map((c) => c.cal
          ? html`<div class="wh cal"><span class="dot" style=${`--h:${colorVar(c.cal.color)}`}></span><b class="ell" title=${c.cal.name}>${c.cal.name}</b>
              ${!this.bookable(c.cal) ? html`<span class="lk"><sw-icon name="lock" size="12"></sw-icon>צפייה</span>` : c.cal.approval_mode === 'always' && c.cal.my_role !== 'manage' ? html`<span class="lk"><sw-icon name="lock" size="12"></sw-icon>באישור</span>` : nothing}</div>`
          : html`<button type="button" class=${`wh${sameDay(c.day, now) ? ' today' : ''}`} @click=${() => { this.anchor = c.day; this.setMode('day'); }}>${phone ? DAY_SHORT[c.day.getDay()] : DAY_LONG[c.day.getDay()]} <b class="num">${c.day.getDate()}</b></button>`)}
        <div class="axis">${Array.from({ length: hours }, (_, k) => (k % 2 === 0 || !phone ? html`<span class="num" style=${`top:${(k / hours) * 100}%`}>${pad(FROM_H + k)}:00</span>` : nothing))}</div>
        ${cols.map((c, ci) => {
          const list = c.cal ? occ.filter((o) => o.calendar_id === c.cal?.id || o.room_calendar_ids.includes(c.cal?.id ?? '')) : occ;
          const held = onDay(list.filter((o) => o.held_slot), c.day);
          const placed = placeDay(list.filter((o) => !o.held_slot), c.day, FROM_H, TO_H);
          const allDay = onDay(list, c.day).filter((o) => o.all_day || o.kind === 'holiday');
          const we = !c.cal && (c.day.getDay() === 6 || allDay.length > 0);
          const lift = (this.sel?.col === ci) || (this.drag?.col === ci);
          return html`<div class=${`col${we ? ' we' : ''}${lift ? ' lift-z' : ''}`} data-cal-col=${c.key} data-ci=${ci}>
            ${lines}
            ${this.closedZones(c)}
            ${this.pastZone(c.day, now)}
            ${allDay.length ? html`<div class="allday ell">${allDay[0].title}</div>` : nothing}
            ${held.map((o) => html`<div class="held" data-cal-held=${o.event_id} style=${`top:${this.pct(minOfDay(o.start))}%;height:${this.pct(minOfDay(o.end)) - this.pct(minOfDay(o.start))}%`}>
              <b>${o.title ?? 'תפוס'}</b><br>המועד הקודם · שמור עד ההחלטה</div>`)}
            ${placed.map((p) => {
              const flag = conflicts && p.o.sync_flag === 'conflict';
              const w = 100 / p.lanes;
              const ed = this.editable(p.o, 'move') || this.editable(p.o, 'resize');
              const cls = `ev${ed ? ' ed' : ''}${p.o.contested ? ' contest' : ''}${this.drag?.occ.occurrence_id === p.o.occurrence_id ? ' src' : ''}${this.lifted === p.o.occurrence_id ? ' lift' : ''}${this.fresh.has(p.o.event_id) ? ' fresh' : ''}`;
              return html`<button type="button" class=${cls} data-mark=${markOf(p.o)} data-flag=${flag ? 'conflict' : ''} data-cal-entry=${p.o.event_id} data-occ=${p.o.occurrence_id}
                style=${`--h:${colorVar(this.calOf(p.o.calendar_id)?.color)};top:${p.top}%;height:${p.height}%;inset-inline-start:calc(${p.lane * w}% + 3px);inline-size:calc(${w}% - 6px)`}
                title=${flag ? 'התנגשות עם יומן חיצוני: שתי ההזמנות נשמרו, מחכה להחלטה' : `${p.o.title ?? 'תפוס'} · ${hm(p.o.start)}–${hm(p.o.end)}`}
                aria-label=${`${p.o.title ?? 'תפוס'}, ${this.calOf(p.o.calendar_id)?.name ?? ''}, ${hm(p.o.start)} עד ${hm(p.o.end)}${p.o.state === 'pending' ? ', ממתין לאישור' : ''}`}
                @click=${(e: MouseEvent) => { if (e.detail === 0) this.openPeek(p.o, e.currentTarget as HTMLElement); }}>
                <b>${flag || p.o.contested ? html`<sw-icon name="warning" size="13"></sw-icon>` : nothing}<span class="ell">${p.o.title ?? 'תפוס'}</span></b>
                ${p.height > 6 ? html`<span class="tm num ell ltr">${hm(p.o.start)}–${hm(p.o.end)}</span>` : nothing}
                ${this.editable(p.o, 'resize') ? html`<span class="rz" aria-hidden="true"></span>` : nothing}</button>`;
            })}
            ${this.hover?.col === ci && !this.sel ? html`<div class="hov" style=${`top:${this.pct(this.hover.m)}%;height:${(30 / (BAND.to - BAND.from)) * 100}%`}>+ ${this.mm(this.hover.m)}</div>` : nothing}
            ${this.selView(ci)}
            ${this.dragView(ci)}
            ${this.ring?.col === ci ? html`<div class="ring" style=${`left:${this.ring.x}px;top:${this.ring.y}px`}></div>` : nothing}
            ${sameDay(c.day, now) && nowTop > 0 && nowTop < 100 ? html`<div class="now" style=${`top:${nowTop}%`}></div>` : nothing}
          </div>`;
        })}
      </div>${pager}`;
  }

  private pct(m: number): number {
    return ((Math.min(Math.max(m, BAND.from), BAND.to) - BAND.from) / (BAND.to - BAND.from)) * 100;
  }

  private mm(m: number): string {
    return `${pad(Math.floor(m / 60))}:${pad(m % 60)}`;
  }

  /** The closed hours of a column: the calendar's own hours (day view), or the widest hours of the shown rooms (week view). */
  private closedZones(c: Col) {
    const cals = c.cal ? [c.cal] : this.shownCals().filter((x) => x.type === 'room');
    if (!cals.length || cals.some((x) => x.open_hours === undefined || x.open_hours === null)) return nothing;
    const os = cals.map((x) => openOn(x, c.day)).filter((o): o is { from: number; to: number } => !!o);
    if (!os.length) return html`<div class="closedz closed all" style="top:0;height:100%"><span>${c.day.getDay() === 6 ? 'שבת · סגור' : 'סגור'}</span></div>`;
    const from = Math.min(...os.map((o) => o.from));
    const to = Math.max(...os.map((o) => o.to));
    return html`${from > BAND.from ? html`<div class="closedz closed t" style=${`top:0;height:${this.pct(from)}%`}></div>` : nothing}
      ${to < BAND.to ? html`<div class="closedz closed b" style=${`top:${this.pct(to)}%;height:${100 - this.pct(to)}%`}>${BAND.to - to >= 90 ? html`<span>סגור</span>` : nothing}</div>` : nothing}`;
  }

  private pastZone(day: Date, now: Date) {
    if (startOfDay(day) < startOfDay(now)) return html`<div class="past" style="height:100%;border-radius:var(--sw-r-md)"></div>`;
    if (sameDay(day, now) && minutesOf(now) > BAND.from) return html`<div class="past" style=${`height:${this.pct(minutesOf(now))}%`}></div>`;
    return nothing;
  }

  /** May this viewer move (or resize) it from the grid: the server's `can_edit`, the installation's `grid_edit`, a single entry, not started
   * (a started one may still grow or shrink at its end). */
  private editable(o: Occurrence, mode: 'move' | 'resize'): boolean {
    if (!o.can_edit || !this.dragEnabled() || o.recurring || o.held_slot || o.all_day) return false;
    const now = this.ctx?.now ?? new Date();
    return mode === 'move' ? new Date(o.start) > now : new Date(o.end) > now;
  }

  // ---------- hints ----------
  private candidate(col: number, s: number, e: number, cal?: Calendar) {
    const c = this.cols[col];
    const k = cal ?? this.calForCol(col);
    if (!c || !k) return null;
    return { cal: k, start: instantAt(c.day, s), end: instantAt(c.day, e) };
  }

  private selHint(): Hint | null {
    const sel = this.sel;
    if (!sel) return null;
    const d = this.draft;
    const cal = d ? this.calOf(d.calId) : undefined;
    const cand = this.candidate(sel.col, sel.s, sel.e, cal);
    if (!cand) return null;
    return hintFor({ ...cand, behalf: d?.behalf, headcount: d?.headcount || undefined }, this.occ, this.hints, this.ctx?.now ?? new Date());
  }

  private selView(ci: number) {
    const sel = this.sel;
    if (!sel || sel.col !== ci) return nothing;
    const h = this.selHint();
    const lv = h?.level ?? 'bad';
    const tag = h ? hintTag(h) : { cls: '' as const, text: 'אין כאן יומן שאפשר להזמין בו' };
    const flip = sel.s - BAND.from < 60 ? ' flip' : sel.e > BAND.to - 70 && sel.s - BAND.from >= 60 ? ' flipb' : '';
    const cal = this.draft ? this.calOf(this.draft.calId) : this.calForCol(ci);
    return html`<div class=${`sel lv-${lv}${flip}`} data-cal-sel=${lv} style=${`top:${this.pct(sel.s)}%;height:${this.pct(sel.e) - this.pct(sel.s)}%`}>
      <div class="box"><b class="ltr num" style="text-align:right">${this.mm(sel.s)}–${this.mm(Math.min(sel.e, 1440))}</b>${this.draft?.title ? html`<small class="ell">${this.draft.title}</small>` : nothing}
        ${this.mode === 'week' && cal ? html`<small class="ell">${cal.name}</small>` : nothing}</div>
      ${tag ? html`<div class=${`why ${tag.cls}`}><sw-icon name=${tag.cls === 'pend' ? 'info' : 'warning'} size="13"></sw-icon><span>${tag.text}</span></div>` : nothing}</div>`;
  }

  private dragView(ci: number) {
    const d = this.drag;
    if (!d || d.col !== ci) return nothing;
    const lv = d.same ? 'ok' : d.hint?.level ?? 'ok';
    const tag = d.same || !d.hint ? null : hintTag(d.hint);
    const flip = d.s - BAND.from < 60 ? ' flip' : d.e > BAND.to - 70 && d.s - BAND.from >= 60 ? ' flipb' : '';
    const col = this.cols[ci];
    const toCal = col?.cal && col.cal.id !== d.occ.calendar_id ? col.cal.name : '';
    const toDay = !col?.cal && col && !sameDay(col.day, new Date(d.occ.start)) ? DAY_LONG[col.day.getDay()] : '';
    const extra = [toCal, toDay, d.mode === 'resize' ? durText(d.e - d.s) : ''].filter(Boolean).join(' · ');
    return html`<div class=${`drag lv-${lv}${flip}`} data-cal-drag=${lv} style=${`top:${this.pct(d.s)}%;height:${this.pct(d.e) - this.pct(d.s)}%`}>
      <div class="ev" data-mark=${markOf(d.occ)} style=${`--h:${colorVar(this.calOf(d.occ.calendar_id)?.color)}`}><b><span class="ell">${d.occ.title ?? 'תפוס'}</span></b></div>
      <div class="tag ltr num">${this.mm(d.s)}–${this.mm(d.e)}${extra ? html` <span dir="rtl">· ${extra}</span>` : nothing}</div>
      ${tag ? html`<div class=${`why ${tag.cls}`}><sw-icon name=${tag.cls === 'pend' ? 'info' : 'warning'} size="13"></sw-icon><span>${tag.text}</span></div>` : nothing}</div>`;
  }

  // ---------- pointer: select, move, resize (prototype onDown / onMove / onUp) ----------
  private colAt(e: PointerEvent): { el: HTMLElement; ci: number } | null {
    const el = (e.composedPath().find((n) => n instanceof HTMLElement && n.classList.contains('col')) as HTMLElement | undefined) ?? null;
    return el ? { el, ci: Number(el.dataset.ci) } : null;
  }

  private colEls(): HTMLElement[] {
    return [...this.renderRoot.querySelectorAll<HTMLElement>('.week .col')];
  }

  private minuteIn(el: HTMLElement, y: number): number {
    const r = el.getBoundingClientRect();
    return minuteAt((y - r.top) / r.height, BAND);
  }

  /** The column under x (or the nearest) while dragging. */
  private colAtX(x: number): number {
    let best = -1;
    let bd = Infinity;
    this.colEls().forEach((el, i) => {
      const r = el.getBoundingClientRect();
      const d = x < r.left ? r.left - x : x > r.right ? x - r.right : 0;
      if (d < bd) {
        bd = d;
        best = i;
      }
    });
    return best;
  }

  private onDown = (e: PointerEvent) => {
    if (e.button !== 0) return;
    const hit = this.colAt(e);
    if (!hit) return;
    this.hover = null;
    if (this.ov) this.closeOverlay();
    const touch = e.pointerType !== 'mouse';
    const at = this.minuteIn(hit.el, e.clientY);
    const path = e.composedPath();
    const evEl = path.find((n) => n instanceof HTMLElement && n.dataset.occ) as HTMLElement | undefined;
    let target: PressTarget;
    if (evEl) {
      const o = this.occ.find((x) => x.occurrence_id === evEl.dataset.occ);
      if (!o) return;
      const resize = path.some((n) => n instanceof HTMLElement && n.classList.contains('rz'));
      const mode = resize ? 'resize' : 'move';
      target = { kind: 'event', col: hit.ci, at, id: o.occurrence_id, editable: this.editable(o, mode), mode };
    } else if (this.calForCol(hit.ci)) {
      target = { kind: 'slot', col: hit.ci, at };
    } else {
      target = { kind: 'none' };
    }
    try {
      (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId); // the drag keeps going when the pointer leaves the column
    } catch {
      /* a pointer that is already gone (or a synthetic one) cannot be captured: the press still works inside the grid */
    }
    const p = new Press(target, e.clientX, e.clientY, touch);
    this.press = p;
    if (touch && target.kind !== 'none') {
      if (target.kind === 'slot') {
        const r = hit.el.getBoundingClientRect();
        this.ring = { col: hit.ci, x: e.clientX - r.left, y: e.clientY - r.top };
      }
      this.pressTimer = window.setTimeout(() => {
        if (this.press !== p) return;
        const r = p.onTimer();
        this.ring = null;
        if (r === 'select' && target.kind === 'slot') {
          const cal = this.calForCol(target.col);
          const sp = dragSpan(snapFloor(target.at, stepOf(cal), BAND), target.at, stepOf(cal), BAND, 30);
          this.sel = { col: target.col, ...sp };
          navigator.vibrate?.(8);
        } else if (r === 'lift' && target.kind === 'event') {
          this.lifted = target.id;
          navigator.vibrate?.(8);
        }
      }, p.delay);
    }
  };

  private onMove = (e: PointerEvent) => {
    const p = this.press;
    if (!p) {
      this.hoverAt(e);
      return;
    }
    const step = p.onMove(e.clientX, e.clientY);
    if (step === 'cancel') {
      clearTimeout(this.pressTimer);
      this.ring = null;
      return;
    }
    if (step === 'none') return;
    const t = p.target;
    if (t.kind === 'slot') {
      const el = this.colEls()[t.col];
      if (!el) return;
      const cal = this.calForCol(t.col);
      const st = stepOf(cal);
      this.sel = { col: t.col, ...dragSpan(snapFloor(t.at, st, BAND), this.minuteIn(el, e.clientY), st, BAND, p.touch ? 30 : st) };
    } else if (t.kind === 'event') {
      const o = this.occ.find((x) => x.occurrence_id === t.id);
      if (!o) return;
      if (step === 'start') this.lifted = '';
      this.updateDrag(o, t, e);
    }
  };

  private updateDrag(o: Occurrence, t: Extract<PressTarget, { kind: 'event' }>, e: PointerEvent): void {
    const cur = { s: minOfDay(o.start), e: sameDay(new Date(o.start), new Date(o.end)) ? minOfDay(o.end) : 1440 };
    let ci = t.col;
    let span: { s: number; e: number };
    const homeCal = this.calOf(o.calendar_id);
    if (t.mode === 'move') {
      const hit = this.colAtX(e.clientX);
      if (hit >= 0) ci = hit;
      const el = this.colEls()[ci];
      const target = this.cols[ci]?.cal ?? homeCal;
      span = moveSpan(cur, this.minuteIn(el, e.clientY), t.at - cur.s, stepOf(target), BAND);
    } else {
      const el = this.colEls()[t.col];
      span = resizeSpan(cur, this.minuteIn(el, e.clientY), stepOf(homeCal), BAND);
    }
    const col = this.cols[ci];
    const toCal = col?.cal ?? homeCal;
    const same = !!col && toCal?.id === o.calendar_id && sameDay(col.day, new Date(o.start)) && span.s === cur.s && span.e === cur.e;
    let hint: Hint | null = null;
    if (!same && col && toCal) {
      const started = new Date(o.start) <= (this.ctx?.now ?? new Date());
      hint = hintFor({ cal: toCal, start: instantAt(col.day, span.s), end: instantAt(col.day, span.e), ignoreId: o.event_id, moving: o.state === 'confirmed' ? 'confirmed' : 'pending', started },
        this.occ, this.hints, this.ctx?.now ?? new Date());
      if (col.cal && !this.bookable(col.cal)) hint = { ...hint, level: 'bad', reason: `${col.cal.name}: צפייה בלבד` };
    }
    this.drag = { occ: o, mode: t.mode, col: ci, s: span.s, e: span.e, grab: t.at - cur.s, hint, same };
  }

  private onUp = (e: PointerEvent) => {
    const p = this.press;
    if (!p) return;
    clearTimeout(this.pressTimer);
    this.ring = null;
    this.press = null;
    const end = p.onUp();
    const t = p.target;
    if (t.kind === 'slot') {
      if (end === 'coach') {
        this.showCoach();
        return;
      }
      if (end !== 'click') return;
      if (!this.sel || !p.started) {
        const cal = this.calForCol(t.col);
        this.sel = { col: t.col, ...clickSpan(t.at, stepOf(cal), BAND) };
      }
      this.openQuick(false);
      return;
    }
    if (t.kind === 'event') {
      const o = this.occ.find((x) => x.occurrence_id === t.id);
      this.lifted = '';
      if (end === 'drop' && this.drag) {
        void this.endDrag();
        return;
      }
      if (end === 'click' && o) {
        const now = Date.now();
        if (this.lastClick && this.lastClick.id === o.occurrence_id && now - this.lastClick.t < 350) {
          this.lastClick = null;
          this.closeOverlay();
          this.openDrawer(o.event_id); // double click: the full drawer
          return;
        }
        this.lastClick = { id: o.occurrence_id, t: now };
        const el = this.renderRoot.querySelector(`[data-occ="${CSS.escape(o.occurrence_id)}"]`) as HTMLElement | null;
        this.openPeek(o, el);
      }
    }
    void e;
  };

  private onCancel = () => {
    clearTimeout(this.pressTimer);
    this.press = null;
    this.ring = null;
    this.drag = null;
    this.lifted = '';
  };

  private hoverAt(e: PointerEvent): void {
    if (e.pointerType !== 'mouse' || this.ov || this.mode === 'month') {
      if (this.hover) this.hover = null;
      return;
    }
    const hit = this.colAt(e);
    const onEv = e.composedPath().some((n) => n instanceof HTMLElement && n.dataset.occ);
    const cal = hit ? this.calForCol(hit.ci) : undefined;
    if (!hit || onEv || !cal) {
      if (this.hover) this.hover = null;
      return;
    }
    const m = snapFloor(this.minuteIn(hit.el, e.clientY), stepOf(cal), BAND);
    const day = this.cols[hit.ci]?.day;
    const o = day ? openOn(cal, day) : null;
    const past = !!day && instantAt(day, m) < (this.ctx?.now ?? new Date());
    if (!o || m < o.from || m + 30 > o.to || past) {
      if (this.hover) this.hover = null;
      return;
    }
    if (this.hover?.col !== hit.ci || this.hover.m !== m) this.hover = { col: hit.ci, m };
  }

  private async endDrag(): Promise<void> {
    const d = this.drag;
    if (!d) return;
    const col = this.cols[d.col];
    const toCal = col?.cal ?? this.calOf(d.occ.calendar_id);
    if (d.same || !col || !toCal) {
      this.drag = null;
      return;
    }
    if (d.hint?.level === 'bad') {
      this.drag = null;
      this.showToast(d.hint.reason ?? 'אי אפשר להזיז לכאן', false, true);
      return;
    }
    const o = d.occ;
    const start = instantAt(col.day, d.s);
    const end = instantAt(col.day, d.e);
    const before = { calendarId: o.calendar_id, start: o.start, end: o.end };
    // optimistic: the entry sits where it was dropped while the server decides
    this.occ = this.occ.map((x) => (x.occurrence_id === o.occurrence_id ? { ...x, calendar_id: toCal.id, start: start.toISOString(), end: end.toISOString() } : x));
    this.drag = null;
    try {
      const api = (this.ctx as CalCtx).api;
      const r = await api.patchEvent(o.event_id, { revision: o.revision ?? 1, start: start.toISOString(), end: end.toISOString(), ...(toCal.id !== o.calendar_id ? { calendar_id: toCal.id } : {}) });
      this.pushUndo({ kind: 'move', eventId: o.event_id, rev: r.event.revision, before });
      const dayTxt = sameDay(start, new Date(o.start)) ? null : `${DAY_SHORT[start.getDay()]} ${start.getDate()}.${start.getMonth() + 1}`;
      const text = r.change_withdrawn ? 'השינוי בוטל · ההזמנה חזרה למועד המאושר'
        : movedText(d.mode, toCal.id !== o.calendar_id ? toCal.name : null, dayTxt, start, end, r.event.state, !!r.event.held, r.event.contested);
      this.showToast(text, true);
      this.say(text);
      this.changed();
    } catch (err) {
      this.showToast(describeError(err), false, true);
      this.reload();
    }
  }

  // ---------- keyboard ----------
  private onGridKey = (e: KeyboardEvent) => {
    if (e.target !== e.currentTarget) return; // an entry's own button (Enter = its card) or a control inside
    if (!['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Enter'].includes(e.key)) return;
    const ctx = this.ctx as CalCtx;
    const canCreate = this.cols.some((_, i) => !!this.calForCol(i));
    if (!canCreate) {
      if (e.key !== 'Enter') this.say('צפייה בלבד');
      return;
    }
    e.preventDefault();
    const todayCol = this.cols.findIndex((c) => sameDay(c.day, ctx.now));
    const firstCol = Math.max(0, this.cols.findIndex((_, i) => !!this.calForCol(i) && (todayCol < 0 || i >= todayCol)));
    const startMin = todayCol >= 0 ? Math.ceil(minutesOf(ctx.now) / 15) * 15 : 9 * 60;
    const st = stepOf(this.calForCol(this.kb?.col ?? firstCol));
    const r = kbStep(this.kb, e.key, e.shiftKey, this.cols.length, st, BAND, { col: firstCol, min: Math.min(Math.max(startMin, BAND.from), BAND.to - st) },
      getComputedStyle(this).direction !== 'ltr');
    if (r.kind === 'none') return;
    if (r.kind === 'open') {
      this.sel ??= { col: r.span.col, s: r.span.s, e: r.span.e };
      this.openQuick(true);
      return;
    }
    this.kb = r.sel;
    this.sel = { col: r.span.col, s: r.span.s, e: r.span.e };
    const c = this.cols[r.span.col];
    this.say(`${c?.cal ? c.cal.name : DAY_LONG[c?.day.getDay() ?? 0]} ${this.mm(r.span.s)} עד ${this.mm(r.span.e)}`);
  };

  private docKey(e: KeyboardEvent): void {
    const first = e.composedPath()[0] as HTMLElement | undefined;
    const typing = !!first && /^(INPUT|SELECT|TEXTAREA)$/.test(first.tagName);
    if (this.drawerOpen()) return; // the booking drawer has its own keys
    if (e.key === 'Escape') {
      if (this.drag) {
        this.press = null;
        this.drag = null;
        return;
      }
      if (this.ov) {
        this.closeOverlay();
        this.focusGrid();
        return;
      }
      if (this.sel) this.clearSel();
      return;
    }
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z' && !typing && this.undoStack.size && this.mode !== 'month') {
      e.preventDefault();
      void this.undo();
      return;
    }
    if ((e.key === 'Delete' || e.key === 'Backspace') && this.ov === 'peek' && !typing && this.peek && this.peek.can_edit) {
      e.preventDefault();
      void this.del(this.peek);
    }
  }

  private drawerOpen(): boolean {
    return !!(this.host as Element | null)?.shadowRoot?.querySelector('cal-event-drawer, cal-maint-drawer');
  }

  private focusGrid(): void {
    (this.renderRoot.querySelector('.week') as HTMLElement | null)?.focus({ preventScroll: true });
  }

  private say(t: string): void {
    this.live = t;
  }

  // ---------- the quick create ----------
  private selAnchor(): Anchor | null {
    const el = this.renderRoot.querySelector('.sel .box') as HTMLElement | null;
    if (!el) return null;
    const r = el.getBoundingClientRect();
    return { x: r.left, y: r.top, w: r.width, h: r.height };
  }

  private openQuick(fromKeyboard: boolean): void {
    const sel = this.sel;
    if (!sel) return;
    const cal = this.calForCol(sel.col);
    const col = this.cols[sel.col];
    if (!cal || !col) return;
    this.draft = { calId: cal.id, day: startOfDay(col.day), s: sel.s, e: sel.e, title: '', allDay: false, repeat: 'none', count: 9, behalf: 'self', behalfLabel: '', headcount: 0 };
    this.ov = 'quick';
    this.ovInstant = fromKeyboard;
    this.ovError = '';
    this.seriesClash = null;
    void this.updateComplete.then(() => (this.ovAnchor = this.selAnchor()));
  }

  private onQuickChange(p: Partial<QuickDraft>): void {
    const d = this.draft;
    if (!d) return;
    const next = { ...d, ...p };
    if (p.calId && p.calId !== d.calId && d.allDay) {
      const o = openOn(this.calOf(p.calId) as Calendar, d.day) ?? { from: 0, to: 1440 };
      next.s = o.from;
      next.e = o.to;
    }
    this.draft = next;
    this.ovError = '';
    // the selection follows the popover's times (and its calendar's column in the day view, when that column is on screen)
    if (this.sel) {
      let col = this.sel.col;
      if (p.calId && this.mode === 'day') {
        const ci = this.cols.findIndex((c) => c.cal?.id === p.calId);
        if (ci >= 0) col = ci;
      }
      this.sel = { col, s: Math.max(BAND.from, next.s), e: Math.min(BAND.to, Math.max(next.e, next.s + 5)) };
      void this.updateComplete.then(() => (this.ovAnchor = this.selAnchor() ?? this.ovAnchor));
    }
    if ('repeat' in p || 'count' in p || 's' in p || 'e' in p || 'calId' in p) this.scheduleSeries();
  }

  /** A series is checked by the server (every occurrence): POST /calendar/events/preview, debounced. */
  private scheduleSeries(): void {
    clearTimeout(this.seriesTimer);
    const d = this.draft;
    if (!d || d.repeat === 'none') {
      this.seriesClash = null;
      return;
    }
    this.seriesTimer = window.setTimeout(async () => {
      const b = this.quickBody(true);
      if (!b) return;
      try {
        const r = await (this.ctx as CalCtx).api.previewEvent(b);
        if (this.draft === d) this.seriesClash = new Set(r.conflicts.map((c) => c.start)).size;
      } catch {
        this.seriesClash = null;
      }
    }, 300);
  }

  private quickBody(preview = false): NewEvent | null {
    const d = this.draft;
    const ctx = this.ctx as CalCtx;
    const cal = d ? this.calOf(d.calId) : undefined;
    if (!d || !cal) return null;
    const title = d.title.trim() || (preview ? 'בדיקה' : cal.type === 'room' ? 'הזמנת חדר' : 'אירוע');
    const out: NewEvent = { calendar_id: cal.id, kind: 'booking', title, start: instantAt(d.day, d.s).toISOString(), end: instantAt(d.day, Math.min(d.e, 1440)).toISOString() };
    const rr = rruleOf(d.repeat, d.count);
    if (rr) out.rrule = rr;
    if (ctx.access.can.book_for_others && d.behalf !== 'self') out.on_behalf = { kind: d.behalf, label: d.behalfLabel.trim() };
    if (d.headcount > 0) out.headcount = d.headcount;
    return out;
  }

  private quickHint(): Hint | null {
    const d = this.draft;
    if (!d) return null;
    const cal = this.calOf(d.calId);
    if (!cal) return null;
    return hintFor({ cal, start: instantAt(d.day, d.s), end: instantAt(d.day, Math.min(d.e, 1440)), behalf: d.behalf, headcount: d.headcount || undefined }, this.occ, this.hints, this.ctx?.now ?? new Date());
  }

  private async saveQuick(): Promise<void> {
    const d = this.draft;
    const b = this.quickBody();
    if (!d || !b || this.ovBusy) return;
    const h = this.quickHint();
    if (h?.level === 'bad') {
      this.ovError = h.reason ?? '';
      return;
    }
    if (d.behalf !== 'self' && !d.behalfLabel.trim()) {
      this.ovError = `חסר שם ה${{ team: 'צוות', class: 'חוג', customer: 'לקוח', department: 'מחלקה', vendor: 'ספק', self: '' }[d.behalf]}.`;
      return;
    }
    this.ovBusy = true;
    try {
      const r = await (this.ctx as CalCtx).api.createEvent(b);
      this.lastCal = d.calId;
      this.pushUndo({ kind: 'create', eventId: r.event.id, rev: r.event.revision });
      const text = d.repeat !== 'none' ? (r.state === 'pending' ? 'הסדרה נשלחה לאישור' : 'הסדרה נשמרה') : r.state === 'pending' ? (r.event.contested ? 'נשלחה בקשה מתחרה לאישור' : 'הבקשה נשלחה לאישור') : 'ההזמנה נשמרה';
      this.fresh = new Set([r.event.id]);
      this.closeOverlay();
      this.showToast(text, true);
      this.say(text);
      this.focusGrid();
      this.changed();
    } catch (e) {
      this.ovError = describeError(e);
    } finally {
      this.ovBusy = false;
    }
  }

  private moreQuick(): void {
    const d = this.draft;
    if (!d) return;
    emit(this, CAL_EVENTS.newEvent, { calendarId: d.calId, start: instantAt(d.day, d.s).toISOString(), end: instantAt(d.day, Math.min(d.e, 1440)).toISOString(), title: d.title,
      repeat: d.repeat, count: d.count, behalf: d.behalf, behalfLabel: d.behalfLabel, headcount: d.headcount || undefined });
    this.closeOverlay();
  }

  // ---------- the peek card ----------
  private openPeek(o: Occurrence, el: HTMLElement | null): void {
    if (o.held_slot) return;
    this.clearSel();
    const r = el?.getBoundingClientRect();
    this.peek = o;
    this.ov = 'peek';
    this.ovAnchor = r ? { x: r.left, y: r.top, w: r.width, h: r.height } : null;
    this.ovError = '';
    this.displaceAsk = null;
  }

  private openDrawer(eventId: string): void {
    emit(this, CAL_EVENTS.newEvent, { eventId });
  }

  private async del(o: Occurrence): Promise<void> {
    const api = (this.ctx as CalCtx).api;
    this.ovBusy = true;
    try {
      let text: string;
      if (o.held) {
        const r = await api.withdrawEvent(o.event_id, o.revision ?? 1);
        this.pushUndo({ kind: 'move', eventId: o.event_id, rev: r.event.revision, before: { calendarId: o.calendar_id, start: o.start, end: o.end } });
        text = 'בקשת השינוי נמשכה · ההזמנה חזרה למועד הקודם';
      } else if (o.recurring && o.local_start) {
        await api.cancelEvent(o.event_id, o.revision ?? 1, o.local_start);
        text = 'המועד בוטל';
      } else {
        const r = await api.cancelEvent(o.event_id, o.revision ?? 1);
        this.pushUndo({ kind: 'delete', eventId: o.event_id, rev: r.event.revision });
        text = o.state === 'pending' ? 'הבקשה נמשכה' : 'ההזמנה בוטלה';
      }
      this.closeOverlay();
      this.showToast(text, !(o.recurring && !o.held));
      this.say(text);
      this.focusGrid();
      this.changed();
    } catch (e) {
      this.ovError = describeError(e);
    } finally {
      this.ovBusy = false;
    }
  }

  /** "שכפל": the same length on the same calendar, at the first free time after it that day, else the same time on a following shown day. */
  private async dup(o: Occurrence): Promise<void> {
    const cal = this.calOf(o.calendar_id);
    if (!cal) return;
    const len = Math.round((new Date(o.end).getTime() - new Date(o.start).getTime()) / 60000);
    const st = stepOf(cal);
    const day0 = startOfDay(new Date(o.start));
    const { to } = this.range();
    let found: { start: Date; end: Date } | null = null;
    for (let k = 0; k < 7 && !found; k += 1) {
      const day = addDays(day0, k);
      if (day >= to) break;
      for (let s = k === 0 ? minOfDay(o.end) : minOfDay(o.start); s + len <= BAND.to; s += st) {
        const start = instantAt(day, s);
        const end = instantAt(day, s + len);
        const h = hintFor({ cal, start, end }, this.occ, this.hints, this.ctx?.now ?? new Date());
        if (h.level === 'ok' || h.level === 'pend') {
          found = { start, end };
          break;
        }
        if (k > 0) break;
      }
    }
    if (!found) {
      this.showToast('אין מועד פנוי לשכפול בימים שמוצגים', false, true);
      return;
    }
    this.ovBusy = true;
    try {
      const r = await (this.ctx as CalCtx).api.createEvent({ calendar_id: cal.id, kind: 'booking', title: o.title ?? 'הזמנה', start: found.start.toISOString(), end: found.end.toISOString() });
      this.pushUndo({ kind: 'create', eventId: r.event.id, rev: r.event.revision });
      this.fresh = new Set([r.event.id]);
      this.closeOverlay();
      const other = !sameDay(found.start, new Date(o.start)) ? `${DAY_SHORT[found.start.getDay()]} ${found.start.getDate()}.${found.start.getMonth() + 1} ` : '';
      this.showToast(`שוכפל ל־${other}${hm(found.start)}–${hm(found.end)}${r.state === 'pending' ? ' · ממתין לאישור' : ''}`, true);
      this.changed();
    } catch (e) {
      this.ovError = describeError(e);
    } finally {
      this.ovBusy = false;
    }
  }

  private async decide(o: Occurrence, decision: 'approve' | 'reject', displace = false): Promise<void> {
    const api = (this.ctx as CalCtx).api;
    this.ovBusy = true;
    this.ovError = '';
    try {
      const room = o.room_calendar_ids.includes(o.calendar_id) && o.room_calendar_ids.length ? o.calendar_id : null;
      const r = await api.decide(o.event_id, { decision, revision: o.revision ?? 1, room_calendar_id: room, ...(displace ? { displace_existing: true } : {}) });
      this.closeOverlay();
      const changeRejected = (r as { change_rejected?: boolean }).change_rejected;
      this.showToast(decision === 'reject' ? (changeRejected ? 'בקשת השינוי נדחתה · ההזמנה נשארה במועד הקודם' : 'הבקשה נדחתה · המארגן יקבל הודעה') : displace ? 'אושר · ההזמנה הקודמת נדחקה, המארגן יבחר מועד אחר' : 'הבקשה אושרה', false);
      this.changed();
    } catch (e) {
      if (e instanceof ApiError && e.body.code === 'slot_held' && this.ctx?.access.ui.allow_displace) {
        const c = ((e.body.details as { conflicts?: { event_id: string; start: string; end: string }[] }).conflicts ?? [])[0];
        const other = c ? this.occ.find((x) => x.event_id === c.event_id) : undefined;
        this.displaceAsk = c ? { title: other?.title ?? null, start: c.start, end: c.end } : null;
        if (!c) this.ovError = describeError(e);
      } else this.ovError = describeError(e);
    } finally {
      this.ovBusy = false;
    }
  }

  private overlay() {
    const ctx = this.ctx as CalCtx;
    const phone = ctx.device === 'phone';
    if (this.ov === 'quick' && this.draft) {
      return html`<cal-quick-create .ctx=${ctx} .draft=${this.draft} .hint=${this.quickHint()} .anchor=${this.ovAnchor} ?sheet=${phone} ?instant=${this.ovInstant} ?busy=${this.ovBusy}
        .error=${this.ovError} .seriesClash=${this.seriesClash}
        @qc-change=${(e: CustomEvent<Partial<QuickDraft>>) => this.onQuickChange(e.detail)} @qc-save=${() => void this.saveQuick()} @qc-more=${() => this.moreQuick()}
        @qc-close=${() => { this.closeOverlay(); this.focusGrid(); }}></cal-quick-create>`;
    }
    if (this.ov === 'peek' && this.peek) {
      const o = this.peek;
      return html`<cal-peek .ctx=${ctx} .occ=${o} .anchor=${this.ovAnchor} ?sheet=${phone} ?busy=${this.ovBusy} .error=${this.ovError} .displaceAsk=${this.displaceAsk}
        @pk-close=${() => { this.closeOverlay(); this.focusGrid(); }} @pk-edit=${() => { this.closeOverlay(); this.openDrawer(o.event_id); }}
        @pk-dup=${() => void this.dup(o)} @pk-del=${() => void this.del(o)} @pk-reject=${() => void this.decide(o, 'reject')}
        @pk-approve=${(e: CustomEvent<{ displace: boolean }>) => void this.decide(o, 'approve', e.detail.displace)} @pk-back=${() => (this.displaceAsk = null)}></cal-peek>`;
    }
    return nothing;
  }

  private closeOverlay(clearSel = true): void {
    this.ov = null;
    this.peek = null;
    this.displaceAsk = null;
    this.ovError = '';
    clearTimeout(this.seriesTimer);
    if (clearSel) this.clearSel();
  }

  private clearSel(): void {
    this.sel = null;
    this.draft = null;
    this.kb = null;
  }

  // ---------- coach, toast, undo ----------
  private coachLine() {
    if (!this.coach || this.mode === 'month' || !this.touch() || !this.ctx?.access.can.book) return nothing;
    return html`<div class="coach" role="note" data-cal-coach><sw-icon name="hand" size="16"></sw-icon><span>לחיצה ארוכה על שעה פנויה בוחרת זמן. ממשיכים לגרור כדי להאריך.</span>
      <button type="button" class="btn icon sm" aria-label="הסתרת הרמז" @click=${() => this.hideCoach()}><sw-icon name="close" size="14"></sw-icon></button></div>`;
  }

  private showCoach(): void {
    this.coach = true;
  }

  private hideCoach(): void {
    this.coach = false;
    try {
      localStorage.setItem(COACH_KEY, 'off');
    } catch {
      /* the hint comes back next time */
    }
  }

  private showToast(text: string, undo: boolean, bad = false): void {
    clearTimeout(this.toastTimer);
    this.toast = { text, undo: undo && this.undoStack.size > 0, bad, id: Date.now() };
    this.toastIn = false;
    requestAnimationFrame(() => requestAnimationFrame(() => (this.toastIn = true)));
    this.toastTimer = window.setTimeout(() => {
      this.toastIn = false;
      this.toastTimer = window.setTimeout(() => (this.toast = null), 200);
    }, undo ? UNDO_TOAST_MS : 3400);
  }

  private pushUndo(u: UndoItem): void {
    this.undoStack.push(u);
  }

  private async undo(): Promise<void> {
    const u = this.undoStack.pop();
    if (!u) return;
    const api = (this.ctx as CalCtx).api;
    try {
      if (u.kind === 'move') await api.patchEvent(u.eventId, { revision: u.rev, calendar_id: u.before.calendarId, start: u.before.start, end: u.before.end });
      else if (u.kind === 'delete') await api.restoreEvent(u.eventId, u.rev);
      else await api.cancelEvent(u.eventId, u.rev);
      this.closeOverlay();
      this.showToast('הפעולה בוטלה', false);
      this.say('הפעולה בוטלה');
      this.changed();
    } catch (e) {
      this.showToast(describeError(e), false, true);
      this.reload();
    }
  }

  /** Something changed on the server: this view reloads, and the page (counts, other views) hears it. */
  private changed(): void {
    this.reload();
    emit(this, CAL_EVENTS.changed);
    window.setTimeout(() => (this.fresh = new Set()), 400);
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'cal-view-calendar': CalViewCalendar;
  }
}
