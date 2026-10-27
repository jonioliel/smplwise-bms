import { LitElement, html, css, nothing, type PropertyValues } from 'lit';
import { customElement, property, state } from 'lit/decorators.js';
import { classMap } from 'lit/directives/class-map.js';
import { repeat } from 'lit/directives/repeat.js';
import '../components/sw-icon';
import '../components/sw-button';
import '../components/sw-toggle';
import './devices-camera-card';
import type { IconName } from '../components/sw-icon';
import { deepFocusables } from '../components/sw-drawer';
import { lockScrollChain } from '../components/scroll-lock';
import { canAnywhere, isApi } from '../api/session';
import { ApiError } from '../api/client';
import { fmtTime, subscribeHa } from '../api/ha';
import { getDevicesArea, type CardId, type DeviceArea, type DeviceAreaDetail, type DeviceRow } from '../api/devices';
import type { BulkKind } from '../api/device-bulk';
import { activateScene, automations, type Item } from '../api/automations';
import { listSchedules, type Schedule } from '../api/schedules';
import { EVENT_LABEL, listEvents, type VmsEvent } from '../api/events';
import { bidi, ltrNum } from '../i18n/bidi';
import { hs, type HsKey } from '../i18n/home-screen';
import { deg, DeviceControls, deviceControlStyles, EQUIPMENT_DOMAINS, rowLabel } from './devices-controls';
import {
  CLOSE_MS, OPEN_MS, SPRING_FLICK, SPRING_OPEN, controllableRows, detentHeight, dragOffset, flipFrom, flipTransform, peekSections, releaseDetent, sectionsFor, sensorRows,
  sideSectionsAllowed, springLinear, type Box, type Detent, type QuickMode, type QuickSection,
} from './area-quick-logic';

const reducedMotion = () => {
  try {
    return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  } catch {
    return false;
  }
};

/** The element that really holds focus (through nested roots). */
function deepActive(): HTMLElement | null {
  let a: Element | null = document.activeElement;
  while (a?.shadowRoot?.activeElement) a = a.shadowRoot.activeElement;
  return a as HTMLElement | null;
}

const SECTION_LABEL: Record<Exclude<QuickSection, 'quick'>, HsKey> = {
  lighting: 'qcSecLighting', switches: 'qcSecSwitches', climate: 'qcSecClimate', heating: 'qcSecHeating', covers: 'qcSecCovers', media: 'qcSecMedia', sensors: 'qcSecSensors',
  cameras: 'qcSecCameras', scenes: 'qcSecScenes', schedules: 'qcSecSchedules', events: 'qcSecEvents',
};
const SECTION_ICON: Record<Exclude<QuickSection, 'quick'>, IconName> = {
  lighting: 'light', switches: 'bolt', climate: 'snow', heating: 'flame', covers: 'layers', media: 'play', sensors: 'sensor', cameras: 'camera', scenes: 'sparkle', schedules: 'clock', events: 'history',
};

/**
 * AREAPOPUP-297 (round 4, owner requirement 2026-10-27): the area quick-control pop-up. Pressing an area on the home screen (a tile, a
 * card row, a tree row) or a neighbouring area on the area screen's plan opens it over the page with fast control of everything in
 * the area - the quick strip (the area's bulk actions), the devices a person may control (the SAME controls as the area screen,
 * devices-controls.ts: optimistic, confirmed by the reported state, rolled back on timeout), its sensors, cameras, scenes, schedules
 * and recent events - and it can grow to a larger view.
 *
 * Three shapes, all drawn through the semantic tokens (so every skin dresses it, no skin rule of its own):
 *   - `drawer` (the installation's default, home.screen.desktop_area): a side panel at the inline start; "expand" widens it to two columns;
 *   - `popup`: a centred pop-up that grows out of the pressed element (a FLIP from its rectangle) and shrinks back into it;
 *   - `sheet` (a phone): a bottom sheet with three detents - peek, half, full - dragged by the grabber or the head; a release projects the
 *     finger's momentum to the nearest detent, past the peek it closes, above the full height it rubber-bands.
 * The motion is a spring (Apple's damping 1.0 / response 0.36, sampled into a CSS `linear()` easing so the compositor runs it), every
 * transition retargets from where the panel is (a second press, Escape mid-open, a drag released early), and `prefers-reduced-motion`
 * keeps only a short cross-fade. Accessibility: role dialog, focus moves in and is trapped, Escape and the scrim close, focus returns
 * to the opener, the page behind stops scrolling. Events: `close`, `area-bulk` (detail: { kind, position? } - the host's confirmation
 * dialog sends it, the server authorises it again), `open-screen` (the area's own screen).
 */
@customElement('area-quick-sheet')
export class AreaQuickSheet extends LitElement {
  @property({ attribute: false }) area: DeviceArea | null = null;
  @property() floorName = '';
  @property() icon: IconName = 'home';
  @property({ reflect: true }) mode: QuickMode = 'drawer';
  @property({ type: Boolean, reflect: true }) open = false;
  /** The pressed element's rectangle (viewport): the pop-up grows out of it. */
  @property({ attribute: false }) origin: Box | null = null;
  /** The caller may start a bulk action on this area (the quick strip). */
  @property({ type: Boolean }) canBulk = false;
  @property({ type: Boolean }) offline = false;

  @state() private expanded = false;
  @state() private detent: Detent = 'half';
  @state() private detail: DeviceAreaDetail | null = null;
  @state() private error = '';
  @state() private scenes: Item[] = [];
  @state() private schedules: Schedule[] = [];
  @state() private events: VmsEvent[] = [];
  @state() private sceneBusy = '';

  private ctl = new DeviceControls(this, () => this.scheduleReload());
  private opener: HTMLElement | null = null;
  private releaseScroll: (() => void) | null = null;
  private stopHa: (() => void) | null = null;
  private reloadTimer = 0;
  private loadSeq = 0;
  private drag: { y0: number; t0: number; id: number; base: number; last: number; lastT: number; v: number } | null = null;
  /** The last pointer sequence moved the sheet: its trailing click is not a tap. */
  private dragged = false;
  /** The close in flight came from the keyboard: focus goes back to the opener. */
  private closedByKey = false;
  private hideTimer = 0;

  static styles = [
    deviceControlStyles,
    css`
      :host {
        display: contents;
        --qc-spring: linear(0, 0.4, 0.75, 0.92, 1);
        --qc-spring-flick: var(--qc-spring);
        --qc-open-ms: 576ms;
        --qc-close-ms: 180ms;
        --qc-w: 480px;
        --qc-w-wide: min(900px, calc(100vw - 48px));
        --qc-pop-w: 620px;
        --qc-pop-w-wide: min(1040px, calc(100vw - 48px));
      }
      .scrim {
        position: fixed;
        inset: 0;
        z-index: var(--sw-z-modal);
        background: var(--sw-overlay);
        -webkit-backdrop-filter: var(--sw-backdrop-blur); /* taste-skill-ignore: the skin contract's scrim blur, none by default */
        backdrop-filter: var(--sw-backdrop-blur); /* taste-skill-ignore: the skin contract's scrim blur, none by default */
        opacity: 0;
        pointer-events: none;
        transition: opacity var(--qc-close-ms) var(--sw-ease-out);
      }
      :host([open]) .scrim {
        opacity: 1;
        pointer-events: auto;
        transition: opacity 240ms var(--sw-ease);
      }
      .panel {
        position: fixed;
        z-index: calc(var(--sw-z-modal) + 1);
        box-sizing: border-box;
        display: flex;
        flex-direction: column;
        color: var(--sw-text);
        background: var(--sw-surface-solid);
        border: 1px solid var(--sw-border-strong); /* taste-skill-ignore: the floating dialog's edge over a dark page */
        box-shadow: inset 0 1px 0 var(--sw-highlight), var(--sw-shadow-3); /* taste-skill-ignore: a real overlay (dialog) floats */
        isolation: isolate;
        overflow: hidden;
        visibility: hidden;
        will-change: transform;
        transition: transform var(--qc-close-ms) var(--sw-ease-out), opacity var(--qc-close-ms) var(--sw-ease-out), inline-size var(--qc-open-ms) var(--qc-spring), visibility 0s linear var(--qc-close-ms);
      }
      :host([open]) .panel {
        visibility: visible;
        transition: transform var(--qc-open-ms) var(--qc-spring), opacity 200ms var(--sw-ease-dialog), inline-size var(--qc-open-ms) var(--qc-spring), visibility 0s;
      }
      /* ---- drawer: the inline start (right in Hebrew) ---- */
      :host([mode='drawer']) .panel {
        inset-block: 0;
        inset-inline-start: 0;
        inline-size: min(var(--qc-w), 100vw);
        border-inline-start: 0;
        border-block: 0;
        border-start-end-radius: var(--sw-r-xl);
        border-end-end-radius: var(--sw-r-xl);
        transform: translateX(var(--qc-out, 100%));
      }
      :host-context([dir='ltr']) :host([mode='drawer']) .panel,
      :host([mode='drawer'][data-ltr]) .panel {
        --qc-out: -100%;
      }
      :host([mode='drawer'][data-expanded]) .panel {
        inline-size: var(--qc-w-wide);
      }
      :host([mode='drawer'][open][data-shown]) .panel {
        transform: none;
      }
      /* ---- pop-up: centred, grows out of the pressed element ---- */
      :host([mode='popup']) .panel {
        inset-inline: 0;
        margin-inline: auto;
        inset-block-start: 50%;
        inline-size: min(var(--qc-pop-w), calc(100vw - 32px));
        max-block-size: min(86vh, 900px);
        border-radius: var(--sw-r-xl);
        opacity: 0;
        transform: translateY(-50%) var(--qc-from, scale(0.96));
      }
      :host([mode='popup'][data-expanded]) .panel {
        inline-size: var(--qc-pop-w-wide);
      }
      :host([mode='popup'][open][data-shown]) .panel {
        opacity: 1;
        transform: translateY(-50%);
      }
      /* ---- bottom sheet (phone): three detents, dragged ---- */
      :host([mode='sheet']) .panel {
        inset-inline: 0;
        inset-block-end: 0;
        block-size: 100dvh;
        border-inline: 0;
        border-block-end: 0;
        border-start-start-radius: var(--sw-r-2xl);
        border-start-end-radius: var(--sw-r-2xl);
        padding-block-end: env(safe-area-inset-bottom, 0px);
        transform: translateY(100%);
      }
      /* the list scrolls with the finger; the grabber and the head drag the sheet */
      :host([mode='sheet']) .body {
        touch-action: pan-y;
        -webkit-mask-image: linear-gradient(to bottom, #000 calc(100% - 28px), transparent 100%); /* taste-skill-ignore: a fade MASK at the cut edge, not a fill */
        mask-image: linear-gradient(to bottom, #000 calc(100% - 28px), transparent 100%); /* taste-skill-ignore: a fade MASK at the cut edge, not a fill */
      }
      :host([mode='sheet'][open][data-shown]) .panel {
        transform: translateY(var(--qc-rest, 38%));
      }
      :host([data-dragging]) .panel {
        transition: none !important;
      }
      :host([data-flick]) .panel {
        transition-timing-function: var(--qc-spring-flick);
      }
      .grab {
        display: none;
        flex: none;
        inline-size: 100%;
        block-size: 32px;
        border: 0;
        background: transparent;
        padding: 0;
        cursor: grab;
        touch-action: none;
        -webkit-tap-highlight-color: transparent;
        user-select: none;
        -webkit-user-select: none;
      }
      .grab::before {
        content: '';
        display: block;
        inline-size: 40px;
        block-size: 5px;
        border-radius: 3px;
        margin: 10px auto 0;
        background: var(--sw-text-3);
        opacity: 0.55;
      }
      :host([mode='sheet']) .grab {
        display: block;
      }
      :host([mode='sheet']) header {
        padding-block-start: 2px;
        touch-action: none;
      }
      /* ---- the head: icon ring, name, the floor and the temperature, the actions ---- */
      header {
        flex: none;
        display: grid;
        grid-template-columns: auto minmax(0, 1fr) auto;
        align-items: center;
        column-gap: 12px;
        padding: 16px 18px 10px;
      }
      .ring {
        inline-size: 40px;
        block-size: 40px;
        border-radius: 50%;
        display: grid;
        place-items: center;
        background: var(--sw-accent-soft);
        color: var(--sw-accent-text);
      }
      .ring[data-on] {
        background: var(--sw-lit-soft);
        color: var(--sw-heading);
      }
      .ttl {
        min-inline-size: 0;
        display: flex;
        flex-direction: column;
        line-height: 1.2;
      }
      h2 {
        margin: 0;
        font-size: var(--sw-fs-xl);
        font-weight: var(--sw-fw-bold);
        letter-spacing: -0.01em;
        color: var(--sw-heading);
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
      }
      .sub {
        margin-block-start: 2px;
        font-size: var(--sw-fs-sm);
        color: var(--sw-text-2);
        font-variant-numeric: tabular-nums;
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
      }
      .sub b {
        font-weight: var(--sw-fw-semibold);
        color: var(--sw-text);
      }
      /* each piece of the sub-line keeps its own direction (a number next to Hebrew never swaps places) */
      .sub > span {
        unicode-bidi: isolate;
      }
      .acts {
        display: inline-flex;
        align-items: center;
        gap: 4px;
      }
      .ib {
        inline-size: 36px;
        block-size: 36px;
        border: 0;
        border-radius: 50%;
        background: transparent;
        color: var(--sw-text-2);
        display: grid;
        place-items: center;
        cursor: pointer;
        padding: 0;
        text-decoration: none;
        touch-action: manipulation;
        -webkit-tap-highlight-color: transparent;
        user-select: none;
        -webkit-user-select: none;
        transition: background-color var(--sw-t-fast) var(--sw-ease), transform 120ms var(--sw-ease-out);
      }
      .ib:active {
        transform: scale(0.94);
      }
      @media (hover: hover) and (pointer: fine) {
        .ib:hover {
          background: var(--sw-hover-wash);
          color: var(--sw-text);
        }
      }
      .ib:focus-visible,
      .qb:focus-visible,
      .scene:focus-visible,
      .grab:focus-visible {
        outline: var(--sw-focus-w) solid var(--sw-focus);
        outline-offset: var(--sw-focus-offset);
      }
      @media (max-width: 767px) {
        .ib {
          inline-size: 44px;
          block-size: 44px;
        }
        /* a narrow head: the floor, the temperature and the count may take a second line instead of an ellipsis */
        .sub {
          white-space: normal;
          display: -webkit-box;
          -webkit-box-orient: vertical;
          -webkit-line-clamp: 2;
          line-clamp: 2;
        }
      }
      /* ---- the body: no scroll where it fits; a scroll only when it does not ---- */
      .body {
        flex: 1 1 auto;
        min-block-size: 0;
        overflow-y: auto;
        overflow-x: hidden;
        overscroll-behavior: contain;
        scrollbar-width: thin;
        padding: 4px 18px 18px;
      }
      .cols {
        display: flex;
        flex-direction: column;
        gap: 14px;
      }
      /* expanded: two CSS columns in a box of its own height (a column box with a fixed height spills sideways - break-ui found it) */
      :host([data-expanded]) .cols {
        display: block;
        column-count: 2;
        column-gap: 20px;
      }
      :host([data-expanded]) .cols > * {
        break-inside: avoid;
        margin-block-end: 16px;
      }
      :host([data-expanded]) .cols > .quick,
      :host([data-expanded]) .cols > .note {
        column-span: all;
      }
      /* the content focuses in as the panel lands */
      :host([open][data-shown]) .cols > * {
        animation: qc-in var(--qc-open-ms) var(--sw-ease-dialog) both;
      }
      :host([open][data-shown]) .cols > :nth-child(2) {
        animation-delay: 40ms;
      }
      :host([open][data-shown]) .cols > :nth-child(3) {
        animation-delay: 80ms;
      }
      :host([open][data-shown]) .cols > :nth-child(n + 4) {
        animation-delay: 110ms;
      }
      @keyframes qc-in {
        from {
          opacity: 0;
          transform: translateY(6px);
        }
      }
      /* ---- the quick strip: the area's group actions ---- */
      .quick {
        display: flex;
        flex-wrap: wrap;
        gap: 8px;
      }
      .qb {
        display: inline-flex;
        align-items: center;
        gap: 6px;
        min-block-size: 36px;
        padding: 0 14px;
        border: 1px solid var(--sw-border-strong); /* taste-skill-ignore: the same outlined pill as the home's own quick actions */
        border-radius: var(--sw-r-pill);
        background: var(--sw-surface-2);
        color: var(--sw-text);
        font: inherit;
        font-size: var(--sw-fs-sm);
        font-weight: var(--sw-fw-medium);
        cursor: pointer;
        touch-action: manipulation;
        -webkit-tap-highlight-color: transparent;
        user-select: none;
        -webkit-user-select: none;
        transition: background-color var(--sw-t-fast) var(--sw-ease), border-color var(--sw-t-fast) var(--sw-ease), transform 120ms var(--sw-ease-out);
      }
      .qb:active {
        transform: scale(0.97);
      }
      .qb:disabled {
        opacity: 0.5;
        cursor: default;
      }
      @media (hover: hover) and (pointer: fine) {
        .qb:hover:not(:disabled) {
          background: var(--sw-surface-3);
          border-color: var(--sw-text-3);
        }
      }
      .qb.main {
        background: var(--sw-surface);
        border-color: var(--sw-danger);
        color: var(--sw-danger);
      }
      @media (hover: hover) and (pointer: fine) {
        .qb.main:hover:not(:disabled) {
          background: var(--sw-danger-soft);
          border-color: var(--sw-danger);
        }
      }
      @media (max-width: 767px) {
        .qb {
          min-block-size: 44px;
        }
      }
      /* ---- a section: a small label with its icon and count, then the rows ---- */
      .sec {
        display: flex;
        flex-direction: column;
        gap: 6px;
        min-inline-size: 0;
      }
      .sh {
        display: flex;
        align-items: center;
        gap: 6px;
        padding-inline: 2px;
        padding-block-start: 2px;
        font-size: var(--sw-fs-sm);
        font-weight: var(--sw-fw-semibold);
        letter-spacing: 0.01em;
        color: var(--sw-text-2);
      }
      .sh .n {
        margin-inline-start: auto;
        font-variant-numeric: tabular-nums;
        font-weight: var(--sw-fw-regular);
      }
      .rows {
        display: flex;
        flex-direction: column;
        gap: 4px;
      }
      .row {
        display: grid;
        grid-template-columns: auto minmax(0, 1fr) auto;
        grid-template-areas: 'ic nm ct' 'ic st ct';
        align-items: center;
        column-gap: 10px;
        min-block-size: 44px;
        padding: 6px 10px;
        border-radius: var(--sw-r-md);
        background: var(--sw-surface-2);
        border: 1px solid transparent; /* taste-skill-ignore: reserves the width, no visible line */
        transition: background-color var(--sw-t-fast) var(--sw-ease), border-color var(--sw-t-fast) var(--sw-ease);
      }
      .row.on {
        background: var(--sw-lit-soft);
      }
      .row.on[data-card='climate'],
      .row.on[data-card='heating'],
      .row.on[data-card='covers'],
      .row.on[data-card='media'] {
        background: var(--sw-accent-soft);
      }
      .row > sw-icon {
        grid-area: ic;
        color: var(--sw-text-3);
      }
      .row.on > sw-icon {
        color: var(--sw-heading);
      }
      .row .nm {
        grid-area: nm;
        font-size: var(--sw-fs-name);
        font-weight: var(--sw-fw-medium);
        color: var(--sw-heading);
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
        line-height: 1.25;
      }
      .row .st {
        grid-area: st;
        font-size: var(--sw-fs-state);
        color: var(--sw-text-2);
        font-variant-numeric: tabular-nums;
        line-height: 1.25;
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
      }
      .row .ct {
        grid-area: ct;
        display: inline-flex;
        align-items: center;
      }
      /* the shared controls (devices-controls.ts) take a whole line under the name and the state */
      .row > .ctl-row,
      .row > .ctl-range,
      .row > .cmd-status,
      .row > .rollback-note {
        grid-column: 1 / -1;
        grid-row: auto;
      }
      .row > .ctl-row {
        margin-block-start: 4px;
      }
      /* sensors: value chips */
      .sens {
        display: grid;
        grid-template-columns: repeat(auto-fill, minmax(120px, 1fr));
        gap: 6px;
      }
      .sv {
        display: flex;
        flex-direction: column;
        min-inline-size: 0;
        padding: 6px 10px;
        border-radius: var(--sw-r-sm);
        background: var(--sw-surface-2);
        line-height: 1.25;
      }
      .sv b {
        font-size: var(--sw-fs-md);
        font-weight: var(--sw-fw-semibold);
        color: var(--sw-heading);
        font-variant-numeric: tabular-nums;
      }
      .sv span {
        font-size: var(--sw-fs-xs);
        color: var(--sw-text-3);
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
      }
      /* cameras */
      .cams {
        display: grid;
        grid-template-columns: repeat(auto-fill, minmax(200px, 1fr));
        gap: 8px;
      }
      .cams devices-camera-card {
        border-radius: var(--sw-r-media);
        overflow: hidden;
      }
      /* scenes: chips that run */
      .scenes {
        display: flex;
        flex-wrap: wrap;
        gap: 6px;
      }
      .scene {
        display: inline-flex;
        align-items: center;
        gap: 6px;
        min-block-size: 36px;
        padding: 0 12px;
        border: 1px solid var(--sw-border-strong); /* taste-skill-ignore: the same outlined pill as the home's own quick actions */
        border-radius: var(--sw-r-pill);
        background: var(--sw-surface);
        color: var(--sw-text);
        font: inherit;
        font-size: var(--sw-fs-sm);
        cursor: pointer;
        touch-action: manipulation;
        -webkit-tap-highlight-color: transparent;
        user-select: none;
        -webkit-user-select: none;
        transition: transform 120ms var(--sw-ease-out), background-color var(--sw-t-fast) var(--sw-ease);
      }
      .scene:active {
        transform: scale(0.97);
      }
      .scene[data-busy] {
        opacity: 0.6;
      }
      @media (hover: hover) and (pointer: fine) {
        .scene:hover {
          background: var(--sw-surface-2);
        }
      }
      /* schedules and events: quiet lines */
      .line {
        display: flex;
        align-items: center;
        gap: 10px;
        min-block-size: 36px;
        padding: 4px 10px;
        border-radius: var(--sw-r-sm);
        background: var(--sw-surface-2);
        font-size: var(--sw-fs-sm);
      }
      .line .nm {
        flex: 1;
        min-inline-size: 0;
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
        color: var(--sw-heading);
        font-weight: var(--sw-fw-medium);
      }
      .line .tm {
        flex: none;
        color: var(--sw-text-3);
        font-variant-numeric: tabular-nums;
        font-size: var(--sw-fs-xs);
      }
      .line.off .nm {
        color: var(--sw-text-3);
        font-weight: var(--sw-fw-regular);
      }
      .line .dot {
        flex: none;
        inline-size: 8px;
        block-size: 8px;
        border-radius: 50%;
        background: var(--sw-success);
      }
      .line.off .dot {
        background: var(--sw-text-3);
        opacity: 0.5;
      }
      .note {
        padding: 18px 8px;
        text-align: center;
        color: var(--sw-text-3);
        font-size: var(--sw-fs-sm);
      }
      .spin {
        inline-size: 18px;
        block-size: 18px;
        margin: 24px auto;
        border-radius: 50%;
        border: 2px solid var(--sw-border-strong);
        border-block-start-color: var(--sw-accent);
        animation: qc-spin 0.7s linear infinite;
      }
      @keyframes qc-spin {
        to {
          transform: rotate(360deg);
        }
      }
      /* ---- solid when the browser cannot blur or the OS asks for less transparency / more contrast ---- */
      @media (prefers-reduced-transparency: reduce) {
        .scrim {
          -webkit-backdrop-filter: none; /* taste-skill-ignore: the reset */
          backdrop-filter: none; /* taste-skill-ignore: the reset */
        }
      }
      @media (prefers-contrast: more) {
        .panel {
          border-color: var(--sw-text-2);
        }
      }
      /* ---- reduced motion: a short cross-fade, no travel, no spring ---- */
      @media (prefers-reduced-motion: reduce) {
        .panel,
        :host([open]) .panel,
        :host([mode='drawer']) .panel,
        :host([mode='popup']) .panel,
        :host([mode='sheet']) .panel {
          transition: opacity 160ms var(--sw-ease), visibility 0s linear 160ms !important;
          opacity: 0;
        }
        :host([mode='drawer'][open][data-shown]) .panel,
        :host([mode='popup'][open][data-shown]) .panel,
        :host([mode='sheet'][open][data-shown]) .panel {
          opacity: 1;
          transition: opacity 160ms var(--sw-ease), visibility 0s !important;
        }
        :host([mode='drawer']) .panel {
          transform: none;
        }
        :host([mode='popup']) .panel {
          transform: translateY(-50%);
        }
        :host([mode='sheet']) .panel {
          transform: translateY(var(--qc-rest, 38%));
        }
        :host([open][data-shown]) .cols > * {
          animation: none;
        }
        .spin {
          animation-duration: 1.4s;
        }
      }
    `,
  ];

  connectedCallback() {
    super.connectedCallback();
    this.style.setProperty('--qc-spring', springLinear(SPRING_OPEN.response, SPRING_OPEN.bounce));
    this.style.setProperty('--qc-spring-flick', springLinear(SPRING_FLICK.response, SPRING_FLICK.bounce));
    this.style.setProperty('--qc-open-ms', `${OPEN_MS}ms`);
    this.style.setProperty('--qc-close-ms', `${CLOSE_MS}ms`);
    window.addEventListener('keydown', this.onKey);
    window.addEventListener('resize', this.onResize);
  }

  disconnectedCallback() {
    window.removeEventListener('keydown', this.onKey);
    window.removeEventListener('resize', this.onResize);
    this.stopLive();
    this.releaseScroll?.();
    this.releaseScroll = null;
    window.clearTimeout(this.hideTimer);
    super.disconnectedCallback();
  }

  protected willUpdate(changed: PropertyValues<this>) {
    if (changed.has('area') && this.area) {
      const prev = changed.get('area') as DeviceArea | null | undefined;
      if (prev?.area_id !== this.area.area_id) {
        this.detail = null;
        this.scenes = [];
        this.schedules = [];
        this.events = [];
        this.error = '';
      }
    }
    if (changed.has('mode') || changed.has('open')) {
      if (this.open && this.mode === 'sheet') this.expanded = false;
    }
  }

  protected updated(changed: PropertyValues<this>) {
    this.toggleAttribute('data-expanded', this.expanded && this.mode !== 'sheet');
    this.toggleAttribute('data-ltr', getComputedStyle(this.parentElement ?? document.documentElement).direction === 'ltr');
    this.applyRest();
    if (changed.has('open') || (changed.has('area') && this.open)) {
      if (this.open) this.onOpen(changed.has('open'));
      else if (changed.get('open') === true) this.onClose();
    }
  }

  // ------------------------------------------------------------------------------------------------ open / close

  private onOpen(fresh: boolean) {
    window.clearTimeout(this.hideTimer);
    if (fresh) {
      const a = deepActive();
      if (a && !this.contains(a)) this.opener = a;
      this.detent = 'half';
      this.placeAtOrigin();
      this.releaseScroll?.();
      this.releaseScroll = lockScrollChain(this);
      this.startLive();
      // the frame after the start transform painted: the panel springs to its place (a FLIP, a slide or a rise)
      requestAnimationFrame(() => requestAnimationFrame(() => {
        if (!this.open) return;
        this.toggleAttribute('data-shown', true); // the panel is in its resting place: the spring runs from the painted start

        void this.updateComplete.then(() => this.focusIn());
      }));
    }
    void this.load();
  }

  private onClose() {
    this.toggleAttribute('data-shown', false);
    this.removeAttribute('data-flick');
    this.releaseScroll?.();
    this.releaseScroll = null;
    this.stopLive();
    const back = this.opener;
    this.opener = null;
    // focus returns to the opener after a KEYBOARD close (Escape, the grabber's keys); a pointer close (scrim, flick, the close button)
    // leaves focus alone - a programmatic focus after a tap counts as keyboard focus and opened the row's own focus summary on a phone
    const byKey = this.closedByKey;
    this.closedByKey = false;
    if (byKey && back?.isConnected) requestAnimationFrame(() => back.focus({ preventScroll: true }));
  }

  /** The pop-up starts where the pressed element is (its rectangle moved and scaled onto the panel's resting box). */
  private placeAtOrigin() {
    if (this.mode !== 'popup') {
      this.style.removeProperty('--qc-from');
      return;
    }
    const o = this.origin;
    if (!o || reducedMotion()) {
      this.style.removeProperty('--qc-from');
      return;
    }
    const w = Math.min(this.expanded ? 1040 : 620, window.innerWidth - 32);
    const h = Math.min(window.innerHeight * 0.86, 900, Math.max(320, (this.detail ? 620 : 420)));
    const to: Box = { x: (window.innerWidth - w) / 2, y: (window.innerHeight - h) / 2, w, h };
    this.style.setProperty('--qc-from', flipTransform(flipFrom(o, to)));
  }

  /** The sheet's resting offset for its detent (a share of the viewport); the drawer and pop-up ignore it. */
  private applyRest() {
    if (this.mode !== 'sheet') return;
    const H = window.innerHeight;
    const rest = H - detentHeight(this.detent, H);
    this.style.setProperty('--qc-rest', `${rest}px`);
  }

  private onResize = () => {
    this.applyRest();
    this.requestUpdate();
  };

  close() {
    if (!this.open) return;
    this.open = false;
    this.dispatchEvent(new CustomEvent('close', { bubbles: true, composed: true }));
  }

  private onKey = (e: KeyboardEvent) => {
    if (!this.open) return;
    if (e.key === 'Escape') {
      // a nested confirmation (the host's bulk dialog) keeps Escape for itself
      const path = e.composedPath();
      if (path.some((n) => n instanceof Element && (n.tagName === 'SW-DIALOG' || n.tagName === 'DEVICES-BULK-DIALOG'))) return;
      e.preventDefault();
      this.closedByKey = true;
      this.close();
      return;
    }
    if (e.key === 'Tab') this.trapTab(e);
  };

  private trapTab(e: KeyboardEvent) {
    const panel = this.renderRoot.querySelector('.panel');
    if (!panel) return;
    const all = deepFocusables(panel).filter((el) => !el.classList.contains('grab'));
    if (!all.length) {
      e.preventDefault();
      return;
    }
    const active = deepActive();
    const inside = active ? panel.contains(active) || this.contains(active) : false;
    const first = all[0];
    const last = all[all.length - 1];
    if (!inside) {
      e.preventDefault();
      (e.shiftKey ? last : first).focus({ preventScroll: true });
    } else if (e.shiftKey && active === first) {
      e.preventDefault();
      last.focus({ preventScroll: true });
    } else if (!e.shiftKey && active === last) {
      e.preventDefault();
      first.focus({ preventScroll: true });
    }
  }

  private focusIn() {
    const panel = this.renderRoot.querySelector('.panel');
    if (!panel || !this.open) return;
    const active = deepActive();
    if (active && panel.contains(active)) return;
    const all = deepFocusables(panel).filter((el) => !el.classList.contains('grab'));
    (all.find((el) => el.hasAttribute('data-qc-close')) ?? all[0])?.focus({ preventScroll: true });
  }

  // ------------------------------------------------------------------------------------------------ expand / detents

  private toggleExpand() {
    if (this.mode === 'sheet') {
      this.detent = this.detent === 'full' ? 'half' : 'full';
      return;
    }
    this.expanded = !this.expanded;
  }

  /** A single tap on the grabber steps through the detents (WCAG 2.2: a pointer alternative to the drag); the keys do the same. */
  private onGrabClick() {
    if (this.mode !== 'sheet' || this.drag) return;
    if (this.dragged) {
      this.dragged = false; // the click that follows a real drag is the drag, not a tap
      return;
    }
    this.detent = this.detent === 'peek' ? 'half' : this.detent === 'half' ? 'full' : 'peek';
  }

  private onGrabKey(e: KeyboardEvent) {
    if (this.mode !== 'sheet') return;
    if (e.key === 'ArrowUp') this.detent = this.detent === 'peek' ? 'half' : 'full';
    else if (e.key === 'ArrowDown') {
      if (this.detent === 'peek') {
        this.closedByKey = true;
        this.close();
      }
      else this.detent = this.detent === 'full' ? 'half' : 'peek';
    } else return;
    e.preventDefault();
  }

  // ------------------------------------------------------------------------------------------------ the sheet's drag

  private currentOffset(panel: HTMLElement): number {
    try {
      const m = new DOMMatrixReadOnly(getComputedStyle(panel).transform);
      return m.f;
    } catch {
      return window.innerHeight - detentHeight(this.detent, window.innerHeight);
    }
  }

  private onDown = (e: PointerEvent) => {
    if (this.mode !== 'sheet' || !this.open || this.drag) return;
    const control = 'button:not(.grab), a, input, select, textarea, [role="slider"], sw-button, sw-toggle, devices-camera-card';
    const path = e.composedPath();
    if (path.some((n) => n instanceof Element && n.matches(control))) return;
    // only the grabber and the head drag the sheet: a finger on the list scrolls the list
    if (!path.some((n) => n instanceof Element && (n.matches('header') || n.classList.contains('grab')))) return;
    const panel = e.currentTarget as HTMLElement;
    // interruptible: the drag starts from where the panel IS (mid-spring too), with the grab offset kept
    const base = this.currentOffset(panel);
    this.drag = { y0: e.clientY, t0: performance.now(), id: e.pointerId, base, last: e.clientY, lastT: performance.now(), v: 0 };
    try {
      panel.setPointerCapture(e.pointerId);
    } catch {
      /* no capture */
    }
    this.toggleAttribute('data-dragging', true);
    panel.style.transform = `translateY(${base}px)`;
  };

  private onMove = (e: PointerEvent) => {
    const d = this.drag;
    if (!d || e.pointerId !== d.id) return;
    const now = performance.now();
    const dt = Math.max(1, now - d.lastT);
    d.v = d.v * 0.6 + ((e.clientY - d.last) / dt) * 0.4; // a short velocity history, not one sample
    d.last = e.clientY;
    d.lastT = now;
    const H = window.innerHeight;
    const dy = e.clientY - d.y0;
    const restNow = H - detentHeight(this.detent, H);
    // the finger's travel applied to where the panel was grabbed, rubber-banded above the full height
    const off = dragOffset(this.detent, dy + (d.base - restNow), H);
    (e.currentTarget as HTMLElement).style.transform = `translateY(${off}px)`;
  };

  private onUp = (e: PointerEvent) => {
    const d = this.drag;
    if (!d || e.pointerId !== d.id) return;
    this.drag = null;
    const panel = e.currentTarget as HTMLElement;
    const H = window.innerHeight;
    const restNow = H - detentHeight(this.detent, H);
    const dy = e.clientY - d.y0 + (d.base - restNow);
    const target = releaseDetent(this.detent, dy, d.v, H);
    const flick = Math.abs(d.v) > 0.45;
    this.dragged = Math.abs(e.clientY - d.y0) > 6;
    this.toggleAttribute('data-dragging', false);
    this.toggleAttribute('data-flick', flick);
    panel.style.transform = ''; // the stylesheet's resting transform takes over: the spring runs from the current value
    if (target === 'closed') this.close();
    else this.detent = target;
    window.setTimeout(() => this.removeAttribute('data-flick'), OPEN_MS);
  };

  // ------------------------------------------------------------------------------------------------ data

  private startLive() {
    this.stopLive();
    if (!isApi()) return;
    this.stopHa = subscribeHa((m) => {
      if (m.type === 'entity_state_changed' || m.type === 'structure_changed') this.scheduleReload();
    });
  }

  private stopLive() {
    this.stopHa?.();
    this.stopHa = null;
    window.clearTimeout(this.reloadTimer);
  }

  private scheduleReload() {
    window.clearTimeout(this.reloadTimer);
    this.reloadTimer = window.setTimeout(() => void this.load(true), 400);
  }

  private async load(quiet = false) {
    const a = this.area;
    if (!a || !this.open) return;
    const seq = ++this.loadSeq;
    try {
      const d = await getDevicesArea(a.area_id);
      if (seq !== this.loadSeq) return;
      this.detail = d;
      this.error = '';
      this.placeAtOrigin();
    } catch (err) {
      if (seq !== this.loadSeq) return;
      if (!this.detail) this.error = hs('qcLoadFailed');
    }
    if (!quiet) void this.loadSide(a, seq);
  }

  /** The side lists, each behind its permission and each tolerant of a 403 (hidden) or a failure (hidden) - the server is the authority. */
  private async loadSide(a: DeviceArea, seq: number) {
    const allowed = sideSectionsAllowed((p) => !isApi() || canAnywhere(p));
    const quiet = <T,>(p: Promise<T>, empty: T) => p.catch((err) => (err instanceof ApiError && (err.status === 403 || err.status === 404) ? empty : empty));
    const [scenes, schedules, events] = await Promise.all([
      allowed.scenes ? quiet(automations().list({ kind: 'scene', area: a.area_id, limit: 8 }).then((r) => r.items.filter((i) => i.can.run)), [] as Item[]) : Promise.resolve([] as Item[]),
      allowed.schedules ? quiet(listSchedules({ area: a.area_id }).then((r) => r.items.slice(0, 6)), [] as Schedule[]) : Promise.resolve([] as Schedule[]),
      allowed.events && a.map?.zone_id ? quiet(listEvents({ zoneId: a.map.zone_id, limit: 5 }).then((r) => r.events.slice(0, 5)), [] as VmsEvent[]) : Promise.resolve([] as VmsEvent[]),
    ]);
    if (seq !== this.loadSeq) return;
    this.scenes = scenes;
    this.schedules = schedules;
    this.events = events;
  }

  private async runScene(it: Item) {
    if (this.sceneBusy) return;
    this.sceneBusy = it.id;
    try {
      await activateScene(it.id);
    } catch {
      /* the automations screen reports; here the chip simply releases */
    } finally {
      this.sceneBusy = '';
    }
  }

  private bulk(kind: BulkKind, position?: number) {
    if (!this.area || this.offline) return;
    this.dispatchEvent(new CustomEvent('area-bulk', { detail: { kind, position, area: this.area }, bubbles: true, composed: true }));
  }

  private openScreen(e: Event) {
    e.preventDefault();
    const a = this.area;
    if (!a) return;
    this.dispatchEvent(new CustomEvent('open-screen', { detail: { area: a }, bubbles: true, composed: true }));
    this.close();
    location.hash = `#/devices/areas/${encodeURIComponent(a.area_id)}`;
  }

  // ------------------------------------------------------------------------------------------------ render

  private get cameras(): DeviceRow[] {
    const allowed = sideSectionsAllowed((p) => !isApi() || canAnywhere(p));
    if (!allowed.cameras) return [];
    return (this.detail?.cards.security?.entities ?? []).filter((r) => r.kind === 'camera' && r.available).slice(0, 4);
  }

  private get sections(): QuickSection[] {
    const d = this.detail;
    const all = sectionsFor({ cards: d?.cards ?? null, cameras: this.cameras.length, scenes: this.scenes.length, schedules: this.schedules.length, events: this.events.length, canBulk: this.canBulk && !!this.area && (d?.can_bulk ?? true) }, EQUIPMENT_DOMAINS);
    return this.mode === 'sheet' && this.detent === 'peek' ? peekSections(all) : all;
  }

  render() {
    const a = this.area;
    const c = a?.counts;
    const on = !!c && (c.lights_on > 0 || c.switches_on > 0 || c.climate_active > 0 || c.media_on > 0);
    const temp = a?.temperature !== null && a?.temperature !== undefined ? ltrNum(`${a.temperature.toFixed(1)}°`) : '';
    const expandLabel = this.mode === 'sheet' ? (this.detent === 'full' ? hs('qcCollapse') : hs('qcExpand')) : this.expanded ? hs('qcCollapse') : hs('qcExpand');
    const expandedNow = this.mode === 'sheet' ? this.detent === 'full' : this.expanded;
    return html`<div class="scrim" data-qc-scrim @click=${() => this.close()}></div>
      <section class="panel" role="dialog" aria-modal="true" aria-label=${a?.name ?? ''} data-qc-panel data-qc-mode=${this.mode} data-qc-detent=${this.mode === 'sheet' ? this.detent : nothing} ?data-qc-expanded=${expandedNow}
        @pointerdown=${this.onDown} @pointermove=${this.onMove} @pointerup=${this.onUp} @pointercancel=${this.onUp}>
        <button type="button" class="grab" aria-label=${hs('qcGrab')} data-qc-grab @keydown=${this.onGrabKey} @click=${this.onGrabClick}></button>
        <header>
          <span class="ring" ?data-on=${on}><sw-icon .name=${this.icon} size=${20}></sw-icon></span>
          <div class="ttl">
            <h2>${a ? bidi(a.name) : ''}</h2>
            <span class="sub">${[this.floorName ? html`<span>${bidi(this.floorName)}</span>` : '', temp ? html`<span><b>${temp}</b></span>` : '', c ? html`<span>${ltrNum(c.entities)} ${hs('qcDevicesLabel')}</span>` : ''].filter((x) => x !== '').map((x, i) => (i ? html` · ${x}` : x))}</span>
          </div>
          <span class="acts">
            <button type="button" class="ib" data-qc-expand aria-label=${expandLabel} title=${expandLabel} aria-pressed=${String(expandedNow)} @click=${() => this.toggleExpand()}><sw-icon name="expand" size=${17}></sw-icon></button>
            ${a ? html`<a class="ib" href=${`#/devices/areas/${encodeURIComponent(a.area_id)}`} data-qc-open-screen aria-label=${hs('qcOpenScreen')} title=${hs('qcOpenScreen')} @click=${(e: Event) => this.openScreen(e)}><sw-icon name="chevron" size=${17}></sw-icon></a>` : nothing}
            <button type="button" class="ib" data-qc-close aria-label=${hs('close')} title=${hs('close')} @click=${() => this.close()}><sw-icon name="close" size=${18}></sw-icon></button>
          </span>
        </header>
        <div class="body" data-qc-body><div class="cols">${this.renderBody()}</div></div>
      </section>`;
  }

  private renderBody() {
    if (this.error && !this.detail) return html`<div class="note" data-qc-error>${this.error}</div>`;
    if (!this.detail) return html`<div class="spin" role="status" aria-label="טוען"></div>`;
    const secs = this.sections;
    if (!secs.length) return html`<div class="note" data-qc-empty>${hs('qcEmpty')}</div>`;
    return repeat(secs, (s) => s, (s) => this.renderSection(s));
  }

  private renderSection(s: QuickSection) {
    const d = this.detail!;
    if (s === 'quick') return this.renderQuick();
    const head = (n: number) => html`<div class="sh"><sw-icon .name=${SECTION_ICON[s]} size=${13}></sw-icon>${hs(SECTION_LABEL[s])}<span class="n">${ltrNum(n)}</span></div>`;
    if (s === 'sensors') {
      const rows = sensorRows(d.cards.sensors);
      return html`<div class="sec" data-qc-section="sensors">${head(rows.length)}<div class="sens">${rows.map((r) => this.renderSensor(r))}</div></div>`;
    }
    if (s === 'cameras') {
      const cams = this.cameras;
      return html`<div class="sec" data-qc-section="cameras">${head(cams.length)}<div class="cams">${cams.map((r) => html`<devices-camera-card .source=${{ kind: 'ha' as const, entity_id: r.entity_id }} .title=${r.name} size="s"></devices-camera-card>`)}</div></div>`;
    }
    if (s === 'scenes') {
      return html`<div class="sec" data-qc-section="scenes">${head(this.scenes.length)}<div class="scenes">${this.scenes.map(
        (it) => html`<button type="button" class="scene" data-qc-scene=${it.id} ?data-busy=${this.sceneBusy === it.id} ?disabled=${!!this.sceneBusy} @click=${() => void this.runScene(it)}><sw-icon name="play" size=${13}></sw-icon>${bidi(it.name)}</button>`,
      )}</div></div>`;
    }
    if (s === 'schedules') {
      return html`<div class="sec" data-qc-section="schedules">${head(this.schedules.length)}<div class="rows">${this.schedules.map(
        (sc) => html`<div class=${classMap({ line: true, off: !sc.enabled })} data-qc-schedule=${sc.id}><span class="dot" aria-hidden="true"></span><span class="nm">${bidi(sc.display_name)}</span>${sc.next_run ? html`<span class="tm">${hs('qcNext', { t: fmtTime(sc.next_run.at) })}</span>` : nothing}</div>`,
      )}</div></div>`;
    }
    if (s === 'events') {
      return html`<div class="sec" data-qc-section="events">${head(this.events.length)}<div class="rows">${this.events.map(
        (ev) => html`<div class="line" data-qc-event=${ev.id}><sw-icon name="camera" size=${13}></sw-icon><span class="nm">${EVENT_LABEL[ev.type] ?? ev.type}${ev.camera_name ? ` · ${bidi(ev.camera_name)}` : ''}</span><span class="tm">${fmtTime(ev.occurred_at)}</span></div>`,
      )}</div></div>`;
    }
    const rows = controllableRows(d.cards[s as CardId], EQUIPMENT_DOMAINS);
    return html`<div class="sec" data-qc-section=${s}>${head(rows.length)}<div class="rows">${repeat(rows, (r) => r.entity_id, (r) => this.renderRow(r, s as CardId))}</div></div>`;
  }

  /** The quick strip: the area's group actions through the host's confirmation dialog (the server authorises them again). */
  private renderQuick() {
    const c = this.area!.counts;
    const off = this.offline;
    const b = (kind: BulkKind, label: string, icon: IconName, main = false) =>
      html`<button type="button" class=${classMap({ qb: true, main })} data-qc-quick=${kind} ?disabled=${off} @click=${() => this.bulk(kind)}><sw-icon .name=${icon} size=${14}></sw-icon>${label}</button>`;
    return html`<div class="quick" data-qc-section="quick">
      ${c.lights_on > 0 ? b('lights_off', hs('qcLightsOff'), 'light') : nothing}
      ${b('all_off', hs('qcOffNow'), 'power', true)}
      ${c.covers > 0 ? html`${b('covers_open', hs('coversOpen'), 'arrowUp')}${b('covers_close', hs('coversClose'), 'arrowDown')}` : nothing}
      ${c.climate_active > 0 ? b('climate_off', `${hs('qClimate')} · ${hs('climateOff')}`, 'snow') : nothing}
    </div>`;
  }

  private renderSensor(r: DeviceRow) {
    const value = r.domain === 'sensor' && r.value !== null && r.value !== undefined ? `${ltrNum(Number.isInteger(r.value) ? r.value : r.value.toFixed(1))}${r.unit ? ` ${r.unit}` : ''}` : rowLabel(r);
    return html`<div class="sv" data-qc-sensor=${r.entity_id} title=${r.name}><b>${value}</b><span>${bidi(r.name)}</span></div>`;
  }

  private renderRow(raw: DeviceRow, card: CardId) {
    const simple = card === 'lighting' || card === 'switches';
    const r = simple ? this.ctl.shownRow(raw) : raw;
    const on = r.active && r.available && r.state !== 'unavailable';
    const icon: IconName = card === 'lighting' ? 'light' : card === 'switches' ? 'bolt' : card === 'climate' ? 'snow' : card === 'heating' ? 'flame' : card === 'covers' ? 'layers' : 'play';
    // a climate unit: its mode, the room now and the target - words, not an arrow (an arrow flips its meaning in a right-to-left line)
    const state = card === 'climate' && r.domain === 'climate' ? `${rowLabel(r)} · ${deg(r.current_temperature)}${r.target_temperature !== null && r.target_temperature !== undefined ? ` · יעד ${deg(r.target_temperature)}` : ''}` : rowLabel(r);
    return html`<div class=${classMap({ row: true, on, pending: this.ctl.rowPendingVisible(r.entity_id) })} data-qc-row=${r.entity_id} data-card=${card} data-active=${String(on)}>
      <sw-icon .name=${icon} size=${16}></sw-icon>
      <span class="nm">${bidi(r.name)}</span>
      <span class="st">${state}</span>
      ${simple ? html`<span class="ct">${this.ctl.renderPowerToggle(r)}</span>` : nothing}
      ${simple && card === 'lighting' && (on || this.ctl.live<boolean>(r.entity_id, 'power') === true) && r.brightness_pct !== undefined ? this.ctl.renderBrightnessSlider(r) : nothing}
      ${card === 'climate' || card === 'heating' ? this.ctl.renderClimateControls(r) : nothing}
      ${card === 'covers' ? this.ctl.renderCoverControls(r) : nothing}
      ${card === 'media' ? this.ctl.renderMediaControls(r) : nothing}
      ${this.ctl.renderCmdStatus(r.entity_id)}
    </div>`;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'area-quick-sheet': AreaQuickSheet;
  }
}
