import { LitElement, html, css, nothing, svg, type TemplateResult } from 'lit';
import { customElement, property, state } from 'lit/decorators.js';
import { repeat } from 'lit/directives/repeat.js';
import './sw-icon';
import type { IconName } from './sw-icon';
import { SUN_FALLBACK, type SunTimes } from '../api/schedules';
import { CATEGORY_LABEL, DAY_MIN, clampCreate, clampEdge, clampMoveStart, clock, minutesToPercent, offsetToMinutes, type SlotCategory } from '../screens/schedule-grid-logic';

/**
 * CR-014 S4: the 24-hour scheme of a schedule (docs/design/mockups/scheduler screens 05 / 06 / 21 / 24).
 *
 * A row is one day (week grid), or the single day of the day view; the time axis runs 00:00 → 24:00 from the left (an
 * LTR axis inside the RTL page, like `sw-week-grid`), or from the top in the vertical (phone) orientation. A slot is a
 * bar from its start (the thick edge: the moment the action runs) to the end of its window; a point action is a pin.
 *
 * The grid draws and reports; it never edits. Every change is an event the editor applies with the pure operations of
 * `screens/schedule-grid-logic.ts` - the same functions (`clampEdge`, `clampMoveStart`, `clampCreate`) that draw the
 * drag preview here, so what the person sees while dragging is what lands.
 *
 *   slot-select  {key, row}                    a press without movement / Enter
 *   slot-create  {row, from, to}               a drag on an empty track (a click gives one hour)
 *   slot-move    {key, row, delta}             a drag of a slot body / ← → (a step)
 *   slot-resize  {key, row, edge, minute, detach}
 *   slot-remove  {key, row}                    Delete
 *   row-add      {row}                         the button of an inactive day
 *   row-select   {row}                         the day's label
 *
 * Keyboard (focus a slot): ← → (↑ ↓ in the vertical orientation) move by one step; Shift + arrow moves the END edge,
 * Ctrl + arrow the START edge; Delete removes; Enter selects; ↑ ↓ (← → vertically) go to the same slot of the next day.
 */

export type GridIcon = IconName | 'thermo' | 'sun' | 'fan' | 'blinds';

export interface GridSlotView {
  key: string;
  start: number;
  end: number;
  category: SlotCategory;
  title: string;
  timeLabel: string;
  icon: GridIcon;
  point?: boolean;
  sunStart?: boolean;
  sunEnd?: boolean;
  /** Content the editor cannot rewrite (read-only, round-tripped untouched). */
  locked?: boolean;
  sensitive?: boolean;
  lowering?: boolean;
  invalid?: boolean;
  aria: string;
}

export interface GridRowView {
  key: string;
  label: string;
  sub?: string;
  today?: boolean;
  /** The day belongs to the schedule (an inactive row is hatched with an add button). */
  active: boolean;
  slots: GridSlotView[];
  addLabel?: string;
  /** Shown, but not editable here (the linked days while one day is being edited alone). */
  readOnly?: boolean;
}

interface Ghost {
  key: string | null;
  row: string;
  start: number;
  end: number;
  kind: 'create' | 'move' | 'start' | 'end';
  point?: boolean;
}

interface Drag {
  kind: 'create' | 'move' | 'start' | 'end';
  row: string;
  key: string | null;
  pointerId: number;
  rect: DOMRect;
  anchor: number;
  x0: number;
  y0: number;
  orig: { start: number; end: number } | null;
  locked?: boolean;
  point?: boolean;
  moved: boolean;
}

const LOCAL_ICONS: Record<'thermo' | 'sun' | 'fan' | 'blinds', TemplateResult> = {
  thermo: svg`<path d="M10 14.5V5a2 2 0 0 1 4 0v9.5a4 4 0 1 1-4 0z"/><path d="M12 9v7"/>`,
  sun: svg`<circle cx="12" cy="12" r="4"/><path d="M12 2v2.5M12 19.5V22M2 12h2.5M19.5 12H22M4.9 4.9l1.8 1.8M17.3 17.3l1.8 1.8M4.9 19.1l1.8-1.8M17.3 6.7l1.8-1.8"/>`,
  fan: svg`<circle cx="12" cy="12" r="1.6"/><path d="M12 10.4C12 6 9 3.5 6.5 5.2 4.7 6.5 6.5 10 10.6 11.2M13.6 12c4.4 0 6.9 3 5.2 5.5-1.3 1.8-4.8 0-6-4.1M12 13.6C12 18 15 20.5 17.5 18.8c1.8-1.3 0-4.8-4.1-6"/>`,
  blinds: svg`<path d="M4 4h16M4 8h16M4 12h16M4 16h9M12 16v5"/>`,
};

const icon = (name: GridIcon, size = 14): TemplateResult =>
  name in LOCAL_ICONS
    ? html`<svg class="ic" width=${size} height=${size} viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${LOCAL_ICONS[name as keyof typeof LOCAL_ICONS]}</svg>`
    : html`<sw-icon .name=${name as IconName} size=${size}></sw-icon>`;

@customElement('sw-schedule-grid')
export class SwScheduleGrid extends LitElement {
  @property({ attribute: false }) rows: GridRowView[] = [];
  /** Snap step in minutes (5 / 15 / 30). */
  @property({ type: Number }) snap = 15;
  @property({ type: Boolean, reflect: true }) editable = false;
  @property({ attribute: false }) sun: SunTimes | null = null;
  /** Minutes since midnight for the "now" line; null hides it. */
  @property({ type: Number }) now: number | null = null;
  /** The selected slot's key: it is highlighted on every day that shares it. */
  @property() selected = '';
  @property({ reflect: true }) orientation: 'horizontal' | 'vertical' = 'horizontal';
  @property({ type: Boolean, reflect: true }) compact = false;
  /** Text of the sun markers' tooltip / label suffix: today's times are estimates. */
  @property() sunNote = 'משוער להיום';
  @state() private ghost: Ghost | null = null;
  @state() private live = '';
  private drag: Drag | null = null;
  /** The width of the tracks in pixels (a pin's label goes to the side that has room). */
  @state() private trackW = 0;
  private ro: ResizeObserver | null = null;

  connectedCallback() {
    super.connectedCallback();
    this.ro = new ResizeObserver(() => {
      const t = this.renderRoot.querySelector<HTMLElement>('.track');
      const w = t?.clientWidth ?? 0;
      if (Math.abs(w - this.trackW) > 2) this.trackW = w;
    });
    this.ro.observe(this);
  }

  disconnectedCallback() {
    super.disconnectedCallback();
    this.ro?.disconnect();
    this.ro = null;
  }

  /** A point action's label sits right of its pin unless the pin is so near the end of the day that it would not fit. */
  private pinFlips(s: GridSlotView): boolean {
    if (!s.point || this.vertical || !this.trackW) return false;
    const room = ((DAY_MIN - s.start) / DAY_MIN) * this.trackW - 34;
    return room < 8 * s.title.length + 22;
  }

  static styles = css`
    :host {
      display: block;
      direction: ltr;
      font-size: var(--sw-fs-xs);
      user-select: none;
      -webkit-user-select: none;
      --label-w: 64px;
      --row-h: 46px;
      --axis-h: 22px;
      /* DU1: the slot colours are the product's state tokens (so dark mode and the skins reach the grid); the fills are the same colours at a low share */
      --sc-on: var(--sw-success-text);
      --sc-on-bg: color-mix(in srgb, var(--sw-success) 16%, transparent);
      --sc-off: var(--sw-text-2);
      --sc-off-bg: color-mix(in srgb, var(--sw-text-3) 15%, transparent);
      --sc-level: var(--sw-warning-text);
      --sc-level-bg: color-mix(in srgb, var(--sw-warning) 18%, transparent);
      --sc-climate: var(--sw-accent-text);
      --sc-climate-bg: color-mix(in srgb, var(--sw-accent) 14%, transparent);
      --sc-cover: var(--sw-circuit-6);
      --sc-cover-bg: color-mix(in srgb, var(--sw-circuit-6) 16%, transparent);
      --sc-secure: var(--sw-purple);
      --sc-secure-bg: color-mix(in srgb, var(--sw-purple) 15%, transparent);
      --sc-custom: var(--sw-text-2);
      --sc-custom-bg: color-mix(in srgb, var(--sw-text-2) 12%, transparent);
      --sc-empty: var(--sw-text-3);
      --sc-empty-bg: color-mix(in srgb, var(--sw-text-3) 10%, transparent);
      --sc-night: color-mix(in srgb, var(--sw-text) 4.5%, transparent);
    }
    :host([compact]) {
      --row-h: 32px;
      --label-w: 56px;
    }
    .sr {
      position: absolute;
      inline-size: 1px;
      block-size: 1px;
      overflow: hidden;
      clip-path: inset(50%);
      white-space: nowrap;
    }
    /* ------------------------------------------------------------------ horizontal */
    .board {
      display: flex;
      flex-direction: column;
    }
    .head {
      display: grid;
      grid-template-columns: 1fr var(--label-w);
      block-size: calc(var(--axis-h) + 16px);
    }
    .axis {
      position: relative;
    }
    .hour {
      position: absolute;
      inset-block-end: 2px;
      transform: translateX(-50%);
      color: var(--sw-text-3);
      font-size: var(--sw-fs-2xs);
      font-variant-numeric: tabular-nums;
    }
    .hour:first-child {
      transform: none;
    }
    .mark {
      position: absolute;
      inset-block-start: 0;
      transform: translateX(-50%);
      display: inline-flex;
      align-items: center;
      gap: 3px;
      color: var(--sw-warning-text);
      font-size: var(--sw-fs-2xs);
      white-space: nowrap;
      direction: rtl;
    }
    .mark.now {
      color: var(--sw-danger);
      font-weight: var(--sw-fw-semibold);
    }
    .tracks {
      position: relative;
      display: flex;
      flex-direction: column;
      gap: 6px;
    }
    .row {
      display: grid;
      grid-template-columns: 1fr var(--label-w);
      align-items: stretch;
      min-inline-size: 0;
    }
    .rowlabel {
      direction: rtl;
      display: flex;
      flex-direction: column;
      justify-content: center;
      align-items: flex-start;
      padding-inline-start: 8px;
      border: 0;
      background: none;
      font: inherit;
      color: var(--sw-text);
      text-align: start;
      cursor: pointer;
      border-radius: var(--sw-r-xs);
      min-inline-size: 0;
    }
    .rowlabel:hover {
      background: var(--sw-surface-3);
    }
    .rowlabel b {
      font-size: var(--sw-fs-sm);
      font-weight: var(--sw-fw-semibold);
      white-space: nowrap;
    }
    .rowlabel small {
      color: var(--sw-text-3);
      font-size: var(--sw-fs-2xs);
    }
    .row.today .rowlabel b,
    .row.today .rowlabel small {
      color: var(--sw-accent-text);
    }
    .row.off .rowlabel b {
      color: var(--sw-text-3);
    }
    .track {
      position: relative;
      block-size: var(--row-h);
      border-radius: var(--sw-r-sm);
      background: var(--sw-surface-2);
      border: 1px solid var(--sw-border);
      overflow: hidden;
      touch-action: pan-y;
      cursor: crosshair;
    }
    :host(:not([editable])) .track,
    .row.ro .track {
      cursor: default;
    }
    .row.off .track {
      background: repeating-linear-gradient(135deg, transparent 0 6px, rgba(148, 163, 184, 0.14) 6px 8px);
      cursor: default;
    }
    .row.ro .track {
      opacity: 0.72;
    }
    .add {
      position: absolute;
      inset: 0;
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 6px;
      border: 0;
      background: none;
      font: inherit;
      color: var(--sw-text-2);
      cursor: pointer;
      direction: rtl;
    }
    .add:hover,
    .add:focus-visible {
      background: var(--sw-accent-soft);
      color: var(--sw-accent-text);
    }
    .empty-hint {
      position: absolute;
      inset: 0;
      display: grid;
      place-items: center;
      color: var(--sw-text-3);
      pointer-events: none;
      direction: rtl;
    }
    .overlay {
      position: absolute;
      inset-block: 0;
      inset-inline: 0 var(--label-w);
      pointer-events: none;
      z-index: 2;
    }
    .night {
      position: absolute;
      inset-block: 0;
      background: var(--sc-night);
    }
    .vline {
      position: absolute;
      inset-block: 0;
      inline-size: 0;
      border-inline-start: 1px dashed rgba(217, 119, 6, 0.7);
    }
    .vline.now {
      border-inline-start: 2px solid var(--sw-danger);
    }
    .grid-line {
      position: absolute;
      inset-block: 0;
      inline-size: 1px;
      background: rgba(30, 46, 71, 0.06);
    }
    .grid-line.major {
      background: rgba(30, 46, 71, 0.12);
    }
    /* ------------------------------------------------------------------ slots */
    .slot {
      --c: var(--sc-custom);
      --bg: var(--sc-custom-bg);
      position: absolute;
      inset-block: 4px;
      box-sizing: border-box;
      border-radius: var(--sw-r-xs);
      border: 1px solid color-mix(in srgb, var(--c) 45%, transparent);
      border-inline-start: 4px solid var(--c);
      background: var(--bg);
      color: color-mix(in srgb, var(--c) 72%, #000);
      cursor: grab;
      container-type: inline-size;
      display: flex;
      align-items: center;
      z-index: 1;
      outline: none;
      touch-action: pan-y;
    }
    .slot.cat-on {
      --c: var(--sc-on);
      --bg: var(--sc-on-bg);
    }
    .slot.cat-off {
      --c: var(--sc-off);
      --bg: var(--sc-off-bg);
    }
    .slot.cat-level {
      --c: var(--sc-level);
      --bg: var(--sc-level-bg);
    }
    .slot.cat-climate {
      --c: var(--sc-climate);
      --bg: var(--sc-climate-bg);
    }
    .slot.cat-cover {
      --c: var(--sc-cover);
      --bg: var(--sc-cover-bg);
    }
    .slot.cat-secure {
      --c: var(--sc-secure);
      --bg: var(--sc-secure-bg);
    }
    .slot.cat-empty {
      --c: var(--sc-empty);
      --bg: var(--sc-empty-bg);
      border-style: dashed;
    }
    .slot.sel {
      outline: 2px solid var(--sw-accent);
      outline-offset: 1px;
      z-index: 3;
    }
    .slot:focus-visible {
      outline: var(--sw-focus-w) solid var(--sw-focus);
      outline-offset: 2px;
      z-index: 4;
    }
    .slot.dragging {
      opacity: 0.35;
    }
    .slot.invalid {
      box-shadow: 0 0 0 2px var(--sw-danger);
    }
    /* the marker of a sensitive / lowering slot stays visible on a narrow bar too (the flags inside hide there) */
    .slot.lowering::after,
    .slot.sensitive::after {
      content: '';
      position: absolute;
      inset-block-start: -4px;
      inset-inline-end: -4px;
      inline-size: 9px;
      block-size: 9px;
      border-radius: 50%;
      background: var(--sw-danger);
      border: 2px solid var(--sw-surface);
      z-index: 3;
      pointer-events: none;
    }
    .slot.sensitive::after {
      background: var(--sc-secure);
    }
    .slot.locked {
      cursor: default;
      background-image: repeating-linear-gradient(135deg, transparent 0 5px, rgba(71, 85, 105, 0.1) 5px 7px);
    }
    .slot .body {
      direction: rtl;
      display: flex;
      align-items: center;
      gap: 5px;
      padding-inline: 6px;
      min-inline-size: 0;
      inline-size: 100%;
      overflow: hidden;
      pointer-events: none;
    }
    .slot .txt {
      display: flex;
      flex-direction: column;
      min-inline-size: 0;
      line-height: 1.2;
    }
    .slot .txt b {
      font-weight: var(--sw-fw-semibold);
      font-size: var(--sw-fs-xs);
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }
    .slot .txt small {
      font-size: var(--sw-fs-2xs);
      opacity: 0.85;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }
    .slot .flags {
      display: inline-flex;
      gap: 3px;
      margin-inline-start: auto;
      flex: none;
    }
    .slot .flag {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      inline-size: 16px;
      block-size: 16px;
      border-radius: 50%;
      background: color-mix(in srgb, var(--c) 18%, #fff);
      color: var(--c);
    }
    .slot .flag.warn {
      background: var(--sw-danger-soft);
      color: var(--sw-danger);
    }
    @container (max-inline-size: 84px) {
      .slot .txt small,
      .slot .flags {
        display: none;
      }
    }
    @container (max-inline-size: 46px) {
      .slot .txt {
        display: none;
      }
      .slot .body {
        justify-content: center;
        padding-inline: 0;
      }
    }
    .handle {
      position: absolute;
      inset-block: 0;
      inline-size: 9px;
      cursor: ew-resize;
      z-index: 2;
      touch-action: none;
    }
    .handle.s {
      inset-inline-start: -4px;
    }
    .handle.e {
      inset-inline-end: -3px;
    }
    .handle::after {
      content: '';
      position: absolute;
      inset-block: 30%;
      inset-inline-start: 4px;
      inline-size: 2px;
      border-radius: 2px;
      background: color-mix(in srgb, var(--c) 55%, transparent);
      opacity: 0;
      transition: opacity var(--sw-t-fast) var(--sw-ease);
    }
    .slot:hover .handle::after,
    .slot.sel .handle::after,
    .slot:focus-visible .handle::after {
      opacity: 1;
    }
    :host(:not([editable])) .handle,
    .row.ro .handle,
    .slot.locked .handle {
      display: none;
    }
    @media (pointer: coarse) {
      .handle {
        inline-size: 18px;
      }
      .handle.s {
        inset-inline-start: -8px;
      }
      .handle.e {
        inset-inline-end: -8px;
      }
    }
    /* a point action: a pin with its label beside it */
    .slot.point {
      border-inline-start-width: 1px;
      border-radius: var(--sw-r-lg);
      inset-block: 8px;
      inline-size: 28px;
      min-inline-size: 28px;
      justify-content: center;
      overflow: visible;
    }
    .slot.point .body {
      padding: 0;
      justify-content: center;
      overflow: visible;
    }
    .slot.point .txt {
      display: flex;
      position: absolute;
      /* physical sides: the bar sits on an LTR axis, its label goes to the later side (the flipped one, near the end of the
         day, to the earlier side) whatever the direction of the text inside */
      left: calc(100% + 5px);
      inline-size: max-content;
      max-inline-size: 240px;
      background: color-mix(in srgb, var(--bg) 70%, var(--sw-surface));
      padding: 1px 6px;
      border-radius: var(--sw-r-xs);
    }
    .slot.point.flip .txt {
      left: auto;
      right: calc(100% + 5px);
    }
    .slot.point .flags {
      display: none;
    }
    .slot.point .handle {
      display: none;
    }
    .ghost {
      position: absolute;
      inset-block: 2px;
      border-radius: var(--sw-r-xs);
      border: 2px dashed var(--sw-accent);
      background: rgba(39, 103, 237, 0.1);
      z-index: 5;
      pointer-events: none;
      display: flex;
      align-items: flex-start;
      justify-content: center;
      box-sizing: border-box;
    }
    .ghost.point {
      inline-size: 28px;
    }
    .ghost span {
      transform: translateY(-115%);
      background: var(--sw-toast-bg);
      color: var(--sw-toast-text);
      border-radius: var(--sw-r-2xs);
      padding: 1px 6px;
      font-size: var(--sw-fs-2xs);
      white-space: nowrap;
      direction: ltr;
      font-variant-numeric: tabular-nums;
    }
    /* ------------------------------------------------------------------ vertical (phone day view) */
    :host([orientation='vertical']) .board {
      display: grid;
      grid-template-columns: 34px 1fr;
      gap: 0;
    }
    :host([orientation='vertical']) .head {
      display: block;
      block-size: auto;
      position: relative;
    }
    :host([orientation='vertical']) .axis {
      position: relative;
      block-size: 100%;
    }
    :host([orientation='vertical']) .hour {
      inset-block-end: auto;
      inset-inline-start: 0;
      transform: translateY(-50%);
      inline-size: 28px;
      text-align: end;
    }
    :host([orientation='vertical']) .hour:first-child {
      transform: none;
    }
    :host([orientation='vertical']) .mark {
      inset-block-start: auto;
      inset-inline: 0 auto;
      inline-size: 32px;
      justify-content: flex-end;
      transform: translateY(-100%);
      font-size: var(--sw-fs-2xs);
    }
    :host([orientation='vertical']) .mark sw-icon,
    :host([orientation='vertical']) .mark svg {
      display: none;
    }
    :host([orientation='vertical']) .tracks {
      flex-direction: row;
      gap: 6px;
      block-size: calc(24 * var(--hour-h, 44px));
    }
    :host([orientation='vertical']) .row {
      display: flex;
      flex-direction: column;
      flex: 1;
      min-inline-size: 0;
    }
    :host([orientation='vertical']) .rowlabel {
      display: none;
    }
    :host([orientation='vertical']) .track {
      flex: 1;
      block-size: auto;
      touch-action: auto;
    }
    :host([orientation='vertical']) .overlay {
      inset: 0;
      inset-block-start: 0;
    }
    :host([orientation='vertical']) .grid-line {
      inset-block: auto;
      inset-inline: 0;
      inline-size: auto;
      block-size: 1px;
    }
    :host([orientation='vertical']) .vline {
      inset-block: auto;
      inset-inline: 0;
      inline-size: auto;
      block-size: 0;
      border-inline-start: 0;
      border-block-start: 1px dashed rgba(217, 119, 6, 0.7);
    }
    :host([orientation='vertical']) .vline.now {
      border-block-start: 2px solid var(--sw-danger);
    }
    :host([orientation='vertical']) .night {
      inset-block: auto;
      inset-inline: 0;
    }
    :host([orientation='vertical']) .slot {
      inset-block: auto;
      inset-inline: 6px;
      border-inline-start-width: 1px;
      border-block-start: 4px solid var(--c);
      touch-action: auto;
      align-items: flex-start;
    }
    :host([orientation='vertical']) .slot .body {
      padding-block: 4px;
      align-items: flex-start;
    }
    :host([orientation='vertical']) .handle {
      inset-block: auto;
      inset-inline: 0;
      inline-size: auto;
      block-size: 16px;
      cursor: ns-resize;
    }
    :host([orientation='vertical']) .handle.s {
      inset-block-start: -8px;
      inset-inline-start: 0;
    }
    :host([orientation='vertical']) .handle.e {
      inset-block-end: -8px;
      inset-inline-end: 0;
    }
    :host([orientation='vertical']) .handle::after {
      inset-block: 7px auto;
      inset-inline: 30%;
      inline-size: auto;
      block-size: 2px;
    }
    :host([orientation='vertical']) .slot.point {
      inline-size: auto;
      min-inline-size: 0;
      block-size: 28px;
      min-block-size: 28px;
      inset-inline: 6px;
      border-radius: var(--sw-r-lg);
      justify-content: flex-start;
    }
    :host([orientation='vertical']) .slot.point .body {
      justify-content: flex-start;
      padding-inline: 8px;
    }
    :host([orientation='vertical']) .slot.point .txt {
      position: static;
      inline-size: auto;
      background: none;
      padding: 0;
      flex-direction: row;
      gap: 6px;
      align-items: center;
    }
    :host([orientation='vertical']) .ghost {
      inset-block: auto;
      inset-inline: 6px;
    }
    :host([orientation='vertical']) .ghost span {
      transform: none;
      align-self: center;
    }
    :host([orientation='vertical']) .empty-hint {
      align-items: start;
      padding-block-start: 30%;
    }
    @media (prefers-reduced-motion: reduce) {
      .handle::after {
        transition: none;
      }
    }
  `;

  /** Read out a message through the live region (the editor calls it after a keyboard change). */
  announce(text: string) {
    this.live = '';
    requestAnimationFrame(() => (this.live = text));
  }

  // ------------------------------------------------------------------------------------------ geometry helpers

  private get vertical() {
    return this.orientation === 'vertical';
  }

  private pos(min: number) {
    return `${minutesToPercent(min)}%`;
  }

  private slotStyle(s: { start: number; end: number; point?: boolean }, start = s.start, end = s.end) {
    if (s.point) return this.vertical ? `top:${this.pos(start)}` : `left:${this.pos(start)}`;
    const size = minutesToPercent(Math.max(0, end - start));
    return this.vertical ? `top:${this.pos(start)};height:${size}%` : `left:${this.pos(start)};width:${size}%`;
  }

  private minuteAt(e: { clientX: number; clientY: number }, rect: DOMRect): number {
    return this.vertical ? offsetToMinutes(e.clientY - rect.top, rect.height) : offsetToMinutes(e.clientX - rect.left, rect.width);
  }

  private spansOf(row: GridRowView) {
    return { spans: row.slots.map((s) => ({ start: s.start, end: s.end })), points: row.slots.map((s) => !!s.point) };
  }

  // ------------------------------------------------------------------------------------------ pointer

  private onDown = (e: PointerEvent) => {
    if (e.button !== 0) return;
    const target = e.target as HTMLElement;
    if (!this.editable) {
      // a view-only board: a press still selects a slot (to read what it does)
      const el = target.closest<HTMLElement>('.slot');
      if (el?.dataset.key) this.emit('slot-select', { key: el.dataset.key, row: el.dataset.row ?? '' });
      return;
    }
    const trackEl = target.closest<HTMLElement>('.track');
    if (!trackEl) return;
    const row = this.rows.find((r) => r.key === trackEl.dataset.track);
    if (!row || !row.active || row.readOnly) return;
    if (target.closest('.add')) return;
    const slotEl = target.closest<HTMLElement>('.slot');
    const handle = target.closest<HTMLElement>('[data-handle]');
    // vertical timeline on a touch screen: only the handles drag (the rest scrolls the page)
    if (e.pointerType === 'touch' && this.vertical && !handle) return;
    const rect = trackEl.getBoundingClientRect();
    const anchor = this.minuteAt(e, rect);
    let drag: Drag;
    if (slotEl) {
      const slot = row.slots.find((s) => s.key === slotEl.dataset.key);
      if (!slot) return;
      const kind = handle ? (handle.dataset.handle as 'start' | 'end') : 'move';
      drag = { kind, row: row.key, key: slot.key, pointerId: e.pointerId, rect, anchor, x0: e.clientX, y0: e.clientY, orig: { start: slot.start, end: slot.end }, locked: !!slot.locked, point: !!slot.point, moved: false };
    } else {
      drag = { kind: 'create', row: row.key, key: null, pointerId: e.pointerId, rect, anchor, x0: e.clientX, y0: e.clientY, orig: null, moved: false };
    }
    this.drag = drag;
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    if (drag.kind !== 'move') e.preventDefault();
  };

  private onMove = (e: PointerEvent) => {
    const d = this.drag;
    if (!d || e.pointerId !== d.pointerId) return;
    if (!d.moved && Math.hypot(e.clientX - d.x0, e.clientY - d.y0) < 4) return;
    d.moved = true;
    const row = this.rows.find((r) => r.key === d.row);
    if (!row) return;
    const cur = this.minuteAt(e, d.rect);
    const { spans, points } = this.spansOf(row);
    const step = this.snap;
    if (d.kind === 'create') {
      const span = clampCreate(spans, d.anchor, cur, step);
      this.ghost = span ? { key: null, row: d.row, start: span.start, end: span.end, kind: 'create' } : null;
      return;
    }
    const i = row.slots.findIndex((s) => s.key === d.key);
    if (i < 0 || !d.orig || d.locked) return;
    if (d.kind === 'move') {
      const start = clampMoveStart(spans, i, cur - d.anchor, step);
      this.ghost = { key: d.key, row: d.row, start, end: start + (d.orig.end - d.orig.start), kind: 'move', point: d.point };
    } else {
      const m = clampEdge(spans, points, i, d.kind, cur, step, e.altKey);
      this.ghost = d.kind === 'end' ? { key: d.key, row: d.row, start: d.orig.start, end: m, kind: 'end' } : { key: d.key, row: d.row, start: m, end: d.orig.end, kind: 'start' };
    }
  };

  private onUp = (e: PointerEvent) => {
    const d = this.drag;
    if (!d || e.pointerId !== d.pointerId) return;
    this.drag = null;
    const g = this.ghost;
    this.ghost = null;
    if (!d.moved) {
      if (d.kind === 'create') {
        // a click on an empty stretch: one hour from there (the editor clamps it to the free gap)
        this.emit('slot-create', { row: d.row, from: d.anchor, to: d.anchor + 60 });
      } else if (d.key) this.emit('slot-select', { key: d.key, row: d.row });
      return;
    }
    if (!g) return;
    if (d.kind === 'create') this.emit('slot-create', { row: d.row, from: g.start, to: g.end });
    else if (d.kind === 'move' && d.orig) {
      if (g.start !== d.orig.start) this.emit('slot-move', { key: d.key, row: d.row, delta: g.start - d.orig.start });
      else this.emit('slot-select', { key: d.key, row: d.row });
    } else if (d.kind === 'start' || d.kind === 'end') this.emit('slot-resize', { key: d.key, row: d.row, edge: d.kind, minute: d.kind === 'start' ? g.start : g.end, detach: e.altKey });
  };

  private onCancel = () => {
    this.drag = null;
    this.ghost = null;
  };

  private emit(name: string, detail: unknown) {
    this.dispatchEvent(new CustomEvent(name, { detail, bubbles: true, composed: true }));
  }

  // ------------------------------------------------------------------------------------------ keyboard

  private onKey = (e: KeyboardEvent) => {
    const el = (e.target as HTMLElement).closest<HTMLElement>('.slot');
    if (!el) return;
    const key = el.dataset.key ?? '';
    const rowKey = el.dataset.row ?? '';
    const row = this.rows.find((r) => r.key === rowKey);
    const slot = row?.slots.find((s) => s.key === key);
    if (!row || !slot) return;
    if (e.key === 'Escape' && this.drag) {
      this.onCancel();
      return;
    }
    const timeAxis = this.vertical ? ['ArrowUp', 'ArrowDown'] : ['ArrowLeft', 'ArrowRight'];
    const crossAxis = this.vertical ? ['ArrowLeft', 'ArrowRight'] : ['ArrowUp', 'ArrowDown'];
    const forward = e.key === 'ArrowRight' || e.key === 'ArrowDown';
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      this.emit('slot-select', { key, row: rowKey });
    } else if (timeAxis.includes(e.key)) {
      e.preventDefault();
      if (!this.editable || row.readOnly || slot.locked) return;
      const step = this.snap * (forward ? 1 : -1);
      const { spans, points } = this.spansOf(row);
      const i = row.slots.findIndex((s) => s.key === key);
      if (e.shiftKey && !slot.point) {
        this.emit('slot-resize', { key, row: rowKey, edge: 'end', minute: slot.end + step, detach: e.altKey });
        this.announce(`סיום ${clock(clampEdge(spans, points, i, 'end', slot.end + step, this.snap, e.altKey))}`);
      } else if ((e.ctrlKey || e.metaKey) && !slot.point) {
        this.emit('slot-resize', { key, row: rowKey, edge: 'start', minute: slot.start + step, detach: e.altKey });
        this.announce(`התחלה ${clock(clampEdge(spans, points, i, 'start', slot.start + step, this.snap, e.altKey))}`);
      } else {
        this.emit('slot-move', { key, row: rowKey, delta: step });
        this.announce(`התחלה ${clock(clampMoveStart(spans, i, step, this.snap))}`);
      }
    } else if (e.key === 'Delete' || e.key === 'Backspace') {
      e.preventDefault();
      if (this.editable && !row.readOnly && !slot.locked) this.emit('slot-remove', { key, row: rowKey });
    } else if (crossAxis.includes(e.key)) {
      e.preventDefault();
      this.focusNeighbour(rowKey, key, forward ? 1 : -1, slot.start);
    } else if (e.key === 'Home' || e.key === 'End') {
      e.preventDefault();
      const list = row.slots.slice().sort((a, b) => a.start - b.start);
      this.focusSlot(rowKey, (e.key === 'Home' ? list[0] : list[list.length - 1]).key);
    }
  };

  private focusSlot(row: string, key: string) {
    const el = this.renderRoot.querySelector<HTMLElement>(`.slot[data-row="${CSS.escape(row)}"][data-key="${CSS.escape(key)}"]`);
    el?.focus();
  }

  /** Focus the same slot (or the nearest by start time) on the next / previous day that has slots. */
  private focusNeighbour(rowKey: string, key: string, dir: 1 | -1, start: number) {
    const idx = this.rows.findIndex((r) => r.key === rowKey);
    for (let k = idx + dir; k >= 0 && k < this.rows.length; k += dir) {
      const r = this.rows[k];
      if (!r.active || !r.slots.length) continue;
      const same = r.slots.find((s) => s.key === key) ?? r.slots.slice().sort((a, b) => Math.abs(a.start - start) - Math.abs(b.start - start))[0];
      this.focusSlot(r.key, same.key);
      return;
    }
  }

  // ------------------------------------------------------------------------------------------ render

  private renderSlot(row: GridRowView, s: GridSlotView) {
    const dragging = this.ghost && this.ghost.key === s.key && this.drag?.row === row.key;
    const cls = ['slot', `cat-${s.category}`, s.point ? 'point' : '', s.key === this.selected ? 'sel' : '', dragging ? 'dragging' : '', s.locked ? 'locked' : '', s.invalid ? 'invalid' : '', this.pinFlips(s) ? 'flip' : '', s.lowering ? 'lowering' : s.sensitive ? 'sensitive' : '']
      .filter(Boolean)
      .join(' ');
    return html`<div
      class=${cls}
      role="button"
      tabindex="0"
      style=${this.slotStyle(s)}
      data-key=${s.key}
      data-row=${row.key}
      aria-label=${s.aria}
      aria-pressed=${s.key === this.selected ? 'true' : 'false'}
      aria-describedby="kbhelp"
      title=${`${s.title} · ${s.timeLabel}`}
    >
      <span class="handle s" data-handle="start"></span>
      <div class="body">
        ${icon(s.locked ? 'lock' : s.icon)}
        <span class="txt"><b>${s.title}</b><small><bdi dir="ltr">${s.timeLabel}</bdi></small></span>
        <span class="flags">
          ${s.sunStart || s.sunEnd ? html`<span class="flag" title="לפי שמש">${icon('sun', 11)}</span>` : nothing}
          ${s.lowering ? html`<span class="flag warn" title="פותח או מנטרל">${icon('warning', 11)}</span>` : s.sensitive ? html`<span class="flag" title="פעולה רגישה">${icon('shield', 11)}</span>` : nothing}
        </span>
      </div>
      <span class="handle e" data-handle="end"></span>
    </div>`;
  }

  private renderRow(row: GridRowView) {
    const cls = ['row', row.today ? 'today' : '', row.active ? '' : 'off', row.readOnly ? 'ro' : ''].filter(Boolean).join(' ');
    const g = this.ghost;
    // the preview is drawn on every editable day that shares the slot being dragged (linked days) and on the row of a new one
    const showGhost = !!g && row.active && !row.readOnly;
    const label = html`<button class="rowlabel" type="button" @click=${() => this.emit('row-select', { row: row.key })}><b>${row.label}</b>${row.sub ? html`<small>${row.sub}</small>` : nothing}</button>`;
    return html`<div class=${cls}>
      <div class="track" data-track=${row.key}>
        ${!row.active
          ? html`<button class="add" type="button" ?disabled=${!this.editable || !!row.readOnly} @click=${() => this.emit('row-add', { row: row.key })}>${row.addLabel ?? 'הוספה לתזמון'} ${icon('plus', 13)}</button>`
          : row.slots.length === 0 && this.editable && !row.readOnly
            ? html`<div class="empty-hint">גררו כדי ליצור משבצת</div>`
            : nothing}
        ${repeat(row.active ? row.slots : [], (s) => s.key, (s) => this.renderSlot(row, s))}
        ${showGhost && g ? html`<div class="ghost ${g.point ? 'point' : ''}" style=${this.slotStyle({ start: g.start, end: g.end, point: g.point }, g.start, g.end)}><span>${clock(g.start)}–${clock(g.end)}</span></div>` : nothing}
      </div>
      ${label}
    </div>`;
  }

  render() {
    const sun = this.sun ?? SUN_FALLBACK;
    const hours = this.vertical ? Array.from({ length: 24 }, (_, i) => i + 1) : Array.from({ length: 13 }, (_, i) => i * 2);
    const marks = [
      { min: sun.sunrise, label: this.vertical ? clock(sun.sunrise) : `זריחה ${clock(sun.sunrise)}`, cls: '' },
      { min: sun.sunset, label: this.vertical ? clock(sun.sunset) : `שקיעה ${clock(sun.sunset)}`, cls: '' },
    ];
    const posStyle = (m: number) => (this.vertical ? `top:${this.pos(m)}` : `left:${this.pos(m)}`);
    return html`<div class="board">
      <div class="head">
        <div class="axis">
          ${hours.map((h) => html`<span class="hour" style=${posStyle(h * 60)}>${String(h % 24 === 0 && h > 0 && !this.vertical ? 24 : h).padStart(2, '0')}</span>`)}
          ${marks.map((m) => html`<span class="mark" style=${posStyle(m.min)} title=${this.sunNote}>${icon('sun', 11)}${m.label}</span>`)}
          ${this.now !== null ? html`<span class="mark now" style=${posStyle(this.now)}>${this.vertical ? '' : 'עכשיו '}${clock(this.now)}</span>` : nothing}
        </div>
      </div>
      <div class="tracks" @pointerdown=${this.onDown} @pointermove=${this.onMove} @pointerup=${this.onUp} @pointercancel=${this.onCancel} @keydown=${this.onKey}>
        <div class="overlay" aria-hidden="true">
          <div class="night" style=${this.vertical ? `top:0;height:${this.pos(sun.sunrise)}` : `left:0;width:${this.pos(sun.sunrise)}`}></div>
          <div class="night" style=${this.vertical ? `top:${this.pos(sun.sunset)};height:${minutesToPercent(DAY_MIN - sun.sunset)}%` : `left:${this.pos(sun.sunset)};width:${minutesToPercent(DAY_MIN - sun.sunset)}%`}></div>
          ${Array.from({ length: 23 }, (_, i) => i + 1).map((h) => html`<div class="grid-line ${h % 6 === 0 ? 'major' : ''}" style=${posStyle(h * 60)}></div>`)}
          <div class="vline" style=${posStyle(sun.sunrise)}></div>
          <div class="vline" style=${posStyle(sun.sunset)}></div>
          ${this.now !== null ? html`<div class="vline now" style=${posStyle(this.now)}></div>` : nothing}
        </div>
        ${repeat(this.rows, (r) => r.key, (r) => this.renderRow(r))}
      </div>
    </div>
    <p class="sr" id="kbhelp">חצים: הזזת המשבצת. Shift וחצים: שינוי שעת הסיום. Ctrl וחצים: שינוי שעת ההתחלה. Delete: מחיקה. Enter: בחירה.</p>
    <div class="sr" aria-live="polite" role="status">${this.live}</div>`;
  }
}

/** The legend of the bar colours (always with text; shared by the editor and the read-only week view). */
export const LEGEND: { cat: SlotCategory; label: string }[] = (['on', 'off', 'level', 'climate', 'cover', 'secure'] as SlotCategory[]).map((cat) => ({ cat, label: CATEGORY_LABEL[cat] }));

declare global {
  interface HTMLElementTagNameMap {
    'sw-schedule-grid': SwScheduleGrid;
  }
}
