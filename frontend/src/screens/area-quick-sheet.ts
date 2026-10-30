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
import { can, canAnywhere, isApi } from '../api/session';
import { ApiError } from '../api/client';
import { fmtTime, subscribeHa } from '../api/ha';
import { getDevicesArea, type CardId, type DeviceArea, type DeviceAreaDetail, type DeviceRow } from '../api/devices';
import type { BulkKind } from '../api/device-bulk';
import { activateScene, automations, type Item } from '../api/automations';
import { HOME_SCREEN_DEFAULT, loadHomeScreen, type HomeScreenOptions, type PopupAlert } from '../api/home-screen';
import { EMPTY_LAYOUT, POPUP_ITEM_SECTIONS, isVersionConflict, savePopupLayout, type PopupLayout } from '../api/popup-layout';
import { invalidateSettings } from '../api/prefs';
import { listSchedules, type Schedule } from '../api/schedules';
import { EVENT_LABEL, listEvents, type VmsEvent } from '../api/events';
import { bidi, ltrNum } from '../i18n/bidi';
import { hs, type HsKey } from '../i18n/home-screen';
import { deg, DeviceControls, deviceControlStyles, EQUIPMENT_DOMAINS, rowLabel } from './devices-controls';
import {
  EditRow, buildLayout, editItems, editSections, hiddenCount, isAlarming, isTechnical, layoutFor, moveTo, nothingVisible, shownItems, shownSections, toggleItem, toggleSection, withItemOrder, withSectionOrder,
} from './area-quick-edit-logic';
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
  // AREAEDIT-2290: the installation's pop-up layout and the editor (managers only; the server stays the authority)
  @state() private opts: HomeScreenOptions = HOME_SCREEN_DEFAULT;
  @state() private editing = false;
  @state() private draft: PopupLayout = EMPTY_LAYOUT;
  @state() private applyTo: 'area' | 'site' = 'area';
  @state() private alertDraft: PopupAlert = 'show';
  @state() private openSec: string | null = null;
  @state() private moreItems = false;
  @state() private confirmReset = false;
  @state() private saving = false;
  @state() private saveError = '';
  @state() private conflict = false;
  private edDrag: { list: string; id: string; pid: number } | null = null;

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
      /* HOMEFABLE-297 (emil-design-eng: a modal under 300-500 ms; apple-design: materialize - blur and scale arrive together): the
         pop-up lands in 380 ms on the same spring, the scrim behind it blurs the page a touch */
      :host([mode='popup']) {
        --qc-open-ms: 380ms;
      }
      :host([mode='popup']) .scrim {
        -webkit-backdrop-filter: var(--sw-popup-blur); /* taste-skill-ignore: the dimmed page behind a dialog */
        backdrop-filter: var(--sw-popup-blur); /* taste-skill-ignore: the dimmed page behind a dialog */
      }
      :host([mode='popup']) .panel {
        inset-inline: 0;
        margin-inline: auto;
        inset-block-start: 50%;
        inline-size: min(var(--qc-pop-w), calc(100vw - 32px));
        max-block-size: min(86vh, 900px);
        border-radius: var(--sw-r-2xl);
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
      /* AREAEDIT-2290: the editor's footer (reset / cancel / save) must always be on screen. The browsing sheet is a full-height panel
         pushed down by its detent (its lower part is cropped; the list scrolls); the editor panel is only as tall as the visible part. */
      :host([mode='sheet'][data-editing]) .panel {
        inset-block-start: 0;
        inset-block-end: auto;
        block-size: calc(100dvh - var(--qc-rest, 0px));
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
      /* HOMEFABLE-297 (impeccable typeset): the room's name is the display line of the surface - 24 px / 800, tight - over a 14.5 px
         reading line; the icon ring a 46 px object with the ladder's first shadow, lit when something is on */
      header {
        flex: none;
        display: grid;
        grid-template-columns: auto minmax(0, 1fr) auto;
        align-items: center;
        column-gap: 14px;
        padding: 18px 20px 12px;
      }
      .ring {
        inline-size: 46px;
        block-size: 46px;
        border-radius: 50%;
        display: grid;
        place-items: center;
        background: var(--sw-accent-soft);
        color: var(--sw-accent-text);
        box-shadow: var(--sw-shadow-1), inset 0 1px 0 var(--sw-highlight);
        --sw-icon-stroke: 2;
      }
      .ring[data-on] {
        background: var(--sw-lit-soft);
        color: var(--sw-heading);
      }
      .ttl {
        min-inline-size: 0;
        display: flex;
        flex-direction: column;
        line-height: 1.15;
      }
      h2 {
        margin: 0;
        font-size: var(--sw-fs-2xl);
        font-weight: 800;
        letter-spacing: -0.03em;
        color: var(--sw-heading);
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
      }
      .sub {
        margin-block-start: 3px;
        font-size: var(--sw-fs-md);
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
        padding: 4px 20px 20px;
      }
      .cols {
        display: flex;
        flex-direction: column;
        gap: 18px;
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
      /* HOMEFABLE-297 (apple-design materials, emil press): the group actions are raised keys (a tone step, the first shadow, 14.5 px
         semibold) and the one that turns the room off is a filled danger key, not a red outline; a press sinks the key at once */
      .qb {
        display: inline-flex;
        align-items: center;
        gap: 7px;
        min-block-size: 40px;
        padding: 0 16px;
        border: 1px solid var(--sw-border); /* taste-skill-ignore: the key's edge, one step under the panel outline */
        border-radius: var(--sw-r-pill);
        background: var(--sw-surface-2);
        box-shadow: var(--sw-shadow-1); /* taste-skill-ignore: a raised key (owner: depth) */
        color: var(--sw-heading);
        font: inherit;
        font-size: var(--sw-fs-md);
        font-weight: var(--sw-fw-semibold);
        cursor: pointer;
        touch-action: manipulation;
        -webkit-tap-highlight-color: transparent;
        user-select: none;
        -webkit-user-select: none;
        transition: background-color var(--sw-t-fast) var(--sw-ease), box-shadow var(--sw-t-fast) var(--sw-ease), transform var(--sw-t-press) var(--sw-ease-out);
      }
      .qb:active:not(:disabled) {
        transform: scale(var(--sw-press-scale, 0.97));
        box-shadow: none;
        background: var(--sw-pressed-wash);
      }
      .qb:disabled {
        opacity: 0.5;
        cursor: default;
      }
      @media (hover: hover) and (pointer: fine) {
        .qb:hover:not(:disabled) {
          background: var(--sw-surface);
          box-shadow: var(--sw-shadow-2);
        }
      }
      .qb.main {
        background: var(--sw-danger-soft);
        border-color: color-mix(in srgb, var(--sw-danger) 35%, transparent);
        color: var(--sw-danger-text);
      }
      @media (hover: hover) and (pointer: fine) {
        .qb.main:hover:not(:disabled) {
          background: var(--sw-danger-soft);
          border-color: color-mix(in srgb, var(--sw-danger) 60%, transparent);
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
      /* HOMEFABLE-297: a section is a real heading (14.5 px bold, heading ink, the icon in the accent) with its count as a filled pill */
      .sh {
        display: flex;
        align-items: center;
        gap: 7px;
        padding-inline: 2px;
        padding-block-start: 6px;
        font-size: var(--sw-fs-md);
        font-weight: var(--sw-fw-bold);
        letter-spacing: -0.01em;
        color: var(--sw-heading);
      }
      .sh > sw-icon {
        color: var(--sw-accent);
      }
      .sh .n {
        margin-inline-start: auto;
        min-inline-size: 22px;
        padding: 1px 8px;
        border-radius: var(--sw-r-pill);
        background: var(--sw-surface-3);
        color: var(--sw-text-2);
        font-size: var(--sw-fs-xs);
        font-weight: var(--sw-fw-bold);
        font-variant-numeric: tabular-nums;
        text-align: center;
      }
      .rows {
        display: flex;
        flex-direction: column;
        gap: 5px;
      }
      .row {
        display: grid;
        grid-template-columns: auto minmax(0, 1fr) auto;
        grid-template-areas: 'ic nm ct' 'ic st ct';
        align-items: center;
        column-gap: 12px;
        min-block-size: 50px;
        padding: 7px 12px;
        border-radius: var(--sw-r-md);
        background: var(--sw-surface-2);
        border: 1px solid transparent; /* taste-skill-ignore: reserves the width, no visible line */
        transition: background-color var(--sw-t-state) var(--sw-ease), border-color var(--sw-t-fast) var(--sw-ease);
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
        font-weight: var(--sw-fw-semibold);
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
        padding: 8px 12px;
        border-radius: var(--sw-r-md);
        background: var(--sw-surface-2);
        line-height: 1.25;
      }
      .sv b {
        font-size: var(--sw-fs-xl);
        font-weight: 800;
        letter-spacing: -0.02em;
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

      /* ---- AREAEDIT-2290: the editor (same panel; hide + order). Tokens only; green is never used here, the switch is accent blue ---- */
      /* the name keeps its ellipsis, the "editing" label never leaves; on the phone the head carries only the close button while editing */
      h2 {
        display: flex;
        align-items: center;
        min-inline-size: 0;
      }
      h2 .hn {
        min-inline-size: 0;
        overflow: hidden;
        text-overflow: ellipsis;
      }
      h2 .editing {
        flex: none;
        display: inline-flex;
        align-items: center;
        gap: 4px;
        margin-inline-start: 10px;
        padding: 2px 8px;
        border-radius: var(--sw-r-pill);
        background: var(--sw-accent-soft);
        color: var(--sw-accent-text);
        font-size: var(--sw-fs-xs);
        font-weight: var(--sw-fw-semibold);
        letter-spacing: 0;
        vertical-align: middle;
      }
      /* a 375 px row: four 44 px controls + the name; the "hidden" word gives way to the dimmed row and the closed eye */
      :host([mode='sheet']) .er {
        gap: 2px;
        padding-inline: 4px;
      }
      :host([mode='sheet']) .er .hidtag {
        display: none;
      }
      :host([mode='sheet'][data-editing]) [data-qc-expand],
      :host([mode='sheet'][data-editing]) [data-qc-open-screen] {
        display: none;
      }
      .ed {
        position: relative;
        flex: 1 1 auto;
        min-block-size: 0;
        display: flex;
        flex-direction: column;
      }
      .ed-main {
        flex: 1 1 auto;
        min-block-size: 0;
        overflow-y: auto; /* only when the sections do not fit (an accordion keeps it rare); the footer never scrolls away */
        overflow-x: hidden;
        padding: 4px 20px 8px;
        display: flex;
        flex-direction: column;
        gap: 12px;
      }
      /* two columns (list + side) only where there is room: the pop-up and the widened drawer; the 480 px drawer and the phone stack them */
      :host([mode='popup']) .ed-main,
      :host([mode='drawer'][data-expanded]) .ed-main {
        flex-direction: row;
        align-items: flex-start;
      }
      :host([mode='popup']) .ed-list,
      :host([mode='drawer'][data-expanded]) .ed-list {
        flex: 1 1 auto;
        min-inline-size: 0;
      }
      .ed-list {
        min-inline-size: 0;
      }
      .ed-side {
        flex: none;
      }
      :host([mode='popup']) .ed-side,
      :host([mode='drawer'][data-expanded]) .ed-side {
        flex: 0 0 240px;
      }
      .er {
        display: flex;
        align-items: center;
        gap: 6px;
        min-block-size: 48px; /* a 44 px control and 2 px of air on each side */
        padding: 2px 6px;
        border-radius: var(--sw-r-md);
        background: var(--sw-surface-2);
        margin-block-end: 4px;
        font-size: var(--sw-fs-md);
        color: var(--sw-text);
      }
      .er.off .nm {
        color: var(--sw-text-3);
      }
      .er.off {
        opacity: 0.7;
      }
      .er.it {
        margin-inline-start: 24px;
        min-block-size: 46px; /* the 44 px control inside the 1 px edge */
        padding-block: 0;
        background: transparent;
        border: 1px solid var(--sw-border);
      }
      .er .nm {
        min-inline-size: 0;
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
        font-weight: var(--sw-fw-semibold);
      }
      .er .meta,
      .er .hidtag {
        font-size: var(--sw-fs-xs);
        color: var(--sw-text-3);
        white-space: nowrap;
      }
      .er .tag {
        font-size: var(--sw-fs-xs);
        padding: 1px 6px;
        border-radius: var(--sw-r-pill);
        background: var(--sw-surface);
        border: 1px solid var(--sw-border);
        color: var(--sw-text-2);
        white-space: nowrap;
      }
      .grow {
        flex: 1 1 auto;
      }
      .eye,
      .mv,
      .grip,
      .exp {
        inline-size: 44px; /* a touch target is 44 x 44 at every width (owner rule); the 375 px row drops the drag handle to make room */
        block-size: 44px;
        flex: none;
        display: grid;
        place-items: center;
        padding: 0;
        border: 0;
        border-radius: var(--sw-r-md);
        background: transparent;
        color: var(--sw-text-2);
        cursor: pointer;
        touch-action: manipulation;
        -webkit-tap-highlight-color: transparent;
      }
      .grip {
        cursor: grab;
        touch-action: none; /* a finger on the handle reorders; it never scrolls the list or drags the sheet */
      }
      :host([data-ed-dragging]) .grip {
        cursor: grabbing;
      }
      .eye[aria-pressed='true'] {
        color: var(--sw-accent-text);
      }
      .mv:disabled {
        opacity: 0.3;
        cursor: default;
      }
      .exp sw-icon {
        transition: transform var(--sw-t-fast) var(--sw-ease);
      }
      .exp[aria-expanded='true'] sw-icon {
        transform: rotate(180deg);
      }
      .exp-gap {
        inline-size: 44px;
        flex: none;
      }
      /* the editor's other controls reach 44 px too: the apply-to switch, "show more", the footer keys, the head's buttons, the sheet's handle,
         the alert switch (its host is padded to 44 x 44; a press on the padding flips it) */
      :host([data-editing]) .ib,
      :host([data-editing]) .qb,
      .seg button,
      .more {
        min-block-size: 44px;
      }
      :host([data-editing]) .ib {
        inline-size: 44px;
        block-size: 44px;
      }
      :host([data-editing]) .grab {
        block-size: 44px;
      }
      .more {
        padding-inline: 12px;
      }
      .ed-side sw-toggle {
        padding: 10px 1px;
        box-sizing: content-box;
      }
      @media (hover: hover) and (pointer: fine) {
        .eye:hover,
        .mv:hover:not(:disabled),
        .grip:hover,
        .exp:hover {
          background: var(--sw-hover-wash);
          color: var(--sw-text);
        }
      }
      .eye:focus-visible,
      .mv:focus-visible,
      .grip:focus-visible,
      .exp:focus-visible,
      .more:focus-visible,
      .seg button:focus-visible {
        outline: var(--sw-focus-w) solid var(--sw-focus);
        outline-offset: var(--sw-focus-offset);
      }
      .more {
        margin-inline-start: 24px;
        border: 0;
        background: transparent;
        color: var(--sw-accent-text);
        font: inherit;
        font-size: var(--sw-fs-sm);
        cursor: pointer;
        padding: 6px 12px;
      }
      .ed-side {
        display: flex;
        flex-direction: column;
        gap: 10px;
      }
      .ed-side .fld {
        display: flex;
        flex-direction: column;
        gap: 6px;
      }
      .ed-side .fld.tgrow {
        flex-direction: row;
        align-items: center;
        justify-content: space-between;
        gap: 10px;
      }
      .ed-side b {
        font-size: var(--sw-fs-sm);
        font-weight: var(--sw-fw-semibold);
        color: var(--sw-text);
      }
      .ed-side small,
      .ed-side .fine {
        font-size: var(--sw-fs-xs);
        color: var(--sw-text-3);
        line-height: 1.4;
      }
      .ed-side .fine {
        display: flex;
        gap: 6px;
        align-items: flex-start;
      }
      .vh {
        position: absolute;
        inline-size: 1px;
        block-size: 1px;
        overflow: hidden;
        clip-path: inset(50%);
      }
      .seg {
        display: flex;
        padding: 3px;
        gap: 3px;
        border-radius: var(--sw-r-md);
        background: var(--sw-surface-2);
      }
      .seg button {
        flex: 1 1 0;
        min-block-size: 44px;
        display: inline-flex;
        align-items: center;
        justify-content: center;
        gap: 5px;
        border: 0;
        border-radius: var(--sw-r-sm, var(--sw-r-md));
        background: transparent;
        color: var(--sw-text-2);
        font: inherit;
        font-size: var(--sw-fs-sm);
        font-weight: var(--sw-fw-semibold);
        cursor: pointer;
      }
      .seg button.on {
        background: var(--sw-surface-solid);
        color: var(--sw-text);
        box-shadow: var(--sw-shadow-1);
      }
      .seg button:disabled {
        opacity: 0.45;
        cursor: default;
      }
      .sitewarn,
      .warn {
        display: flex;
        align-items: center;
        gap: 6px;
        padding: 8px 10px;
        border-radius: var(--sw-r-md);
        background: var(--sw-warning-soft, var(--sw-surface-2));
        color: var(--sw-text);
        font-size: var(--sw-fs-xs);
        line-height: 1.4;
      }
      .warn {
        margin-inline: 20px;
        margin-block-end: 6px;
        flex-wrap: wrap;
      }
      .ed-foot {
        flex: none;
        display: flex;
        align-items: center;
        gap: 8px;
        padding: 10px 20px calc(12px + env(safe-area-inset-bottom, 0px));
        border-block-start: 1px solid var(--sw-border);
        background: var(--sw-surface-solid);
      }
      .ed-foot .qb {
        white-space: nowrap;
        flex: none;
      }
      :host([mode='sheet']) .ed-foot {
        padding-inline: 12px;
        gap: 6px;
      }
      :host([mode='sheet']) .ed-foot .qb {
        padding-inline: 12px;
      }
      .ed-side sw-toggle {
        --sw-toggle-on: var(--sw-accent); /* the editor's switch is accent blue, never the success green */
      }
      :host([data-editing]) .sub {
        white-space: normal;
      }
      :host([mode='drawer']:not([data-expanded])) .ed-foot .lockn {
        display: none; /* the narrow drawer has no room for the note; the head's hint and the disabled controls say it */
      }
      .ed-foot .lockn {
        display: inline-flex;
        align-items: center;
        gap: 5px;
        font-size: var(--sw-fs-xs);
        color: var(--sw-text-3);
      }
      .qb.pri {
        background: var(--sw-accent);
        border-color: var(--sw-accent);
        color: var(--sw-text-inverse);
      }
      .ed-foot .qb:focus-visible,
      .warn .qb:focus-visible,
      .cf .qb:focus-visible {
        outline: var(--sw-focus-w) solid var(--sw-focus);
        outline-offset: var(--sw-focus-offset);
      }
      .cf-scrim {
        position: absolute;
        inset: 0;
        background: var(--sw-overlay);
        z-index: 2;
      }
      .cf {
        position: absolute;
        z-index: 3;
        inset-inline: 20px;
        inset-block-end: 20px;
        padding: 16px;
        border-radius: var(--sw-r-xl);
        background: var(--sw-surface-solid);
        border: 1px solid var(--sw-border-strong);
        box-shadow: var(--sw-shadow-3);
      }
      .cf h3 {
        margin: 0 0 6px;
        font-size: var(--sw-fs-lg);
        color: var(--sw-heading);
      }
      .cf p {
        margin: 0 0 12px;
        font-size: var(--sw-fs-md);
        color: var(--sw-text-2);
      }
      .cf .row2 {
        display: flex;
        justify-content: flex-end;
        gap: 8px;
      }
      /* a hidden sensor that is in alarm: shown for as long as it alarms, red (only an alarm is red) */
      .sv.alarm {
        background: var(--sw-danger-soft);
        outline: 1px solid color-mix(in srgb, var(--sw-danger) 55%, transparent);
        outline-offset: -1px;
      }
      .sv.alarm b {
        color: var(--sw-danger-text);
      }
      .sv.alarm em {
        font-style: normal;
        font-size: var(--sw-fs-xs);
        color: var(--sw-danger-text);
        line-height: 1.3;
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
        this.editing = false;
        this.confirmReset = false;
      }
    }
    if (changed.has('mode') || changed.has('open')) {
      if (this.mode === 'sheet' && this.editing) this.editing = false; // a resize to phone width closes the editor
      if (this.open && this.mode === 'sheet') this.expanded = false;
    }
  }

  protected updated(changed: PropertyValues<this>) {
    this.toggleAttribute('data-expanded', this.expanded && this.mode !== 'sheet');
    this.toggleAttribute('data-editing', this.editing);
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
    this.editing = false;
    this.confirmReset = false;
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
      if (this.confirmReset) {
        this.confirmReset = false;
        return;
      }
      if (this.editing) {
        this.cancelEdit();
        return;
      }
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
    if (!quiet) {
      void this.loadSide(a, seq);
      void loadHomeScreen().then((o) => {
        if (seq === this.loadSeq && !this.editing) this.opts = o;
      });
    }
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


  // ------------------------------------------------------------------------------------------------ AREAEDIT-2290: the editor

  private startEdit() {
    if (!this.canEdit) return;
    this.draft = this.layout;
    this.applyTo = 'area';
    this.alertDraft = this.opts.popup_alert;
    this.openSec = null;
    this.moreItems = false;
    this.confirmReset = false;
    this.saveError = '';
    this.conflict = false;
    this.editing = true;
    if (this.mode === 'sheet') this.detent = 'full'; // the editor needs the whole sheet
    void this.updateComplete.then(() => (this.renderRoot.querySelector('[data-qc-ed-save]') as HTMLElement | null)?.focus({ preventScroll: true }));
  }

  private cancelEdit() {
    this.editing = false;
    this.confirmReset = false;
    this.saveError = '';
    this.conflict = false;
  }

  private get listedSections(): EditRow[] {
    return editSections(this.availableSections, this.draft);
  }

  private edToggleSection(id: string) {
    this.draft = toggleSection(this.draft, id);
  }

  private edToggleItem(sec: string, id: string) {
    const order = editItems(this.itemRows(sec), sec, this.draft).map((x) => x.row.entity_id);
    this.draft = toggleItem(this.draft, sec, id, order);
  }

  /** Move a section or an item: `list` = 'sections' or the section id; `to` = the index it lands on. */
  private edMove(list: string, id: string, to: number) {
    const ids = list === 'sections' ? this.listedSections.map((r) => r.id) : editItems(this.itemRows(list), list, this.draft).map((x) => x.row.entity_id);
    const next = moveTo(ids, ids.indexOf(id), to);
    this.draft = list === 'sections' ? withSectionOrder(this.draft, next) : withItemOrder(this.draft, list, next);
  }

  private edStep(list: string, id: string, delta: -1 | 1) {
    const ids = list === 'sections' ? this.listedSections.map((r) => r.id) : editItems(this.itemRows(list), list, this.draft).map((x) => x.row.entity_id);
    this.edMove(list, id, ids.indexOf(id) + delta);
  }

  private onGripKey(e: KeyboardEvent, list: string, id: string) {
    if (e.key !== 'ArrowUp' && e.key !== 'ArrowDown') return;
    e.preventDefault();
    this.edStep(list, id, e.key === 'ArrowUp' ? -1 : 1);
    void this.updateComplete.then(() => (this.renderRoot.querySelector(`[data-ed-grip="${CSS.escape(id)}"]`) as HTMLElement | null)?.focus({ preventScroll: true }));
  }

  private onGripDown(e: PointerEvent, list: string, id: string) {
    if (e.button !== 0) return;
    e.preventDefault();
    e.stopPropagation(); // the sheet's own drag listens on the panel: a handle never drags the sheet
    this.edDrag = { list, id, pid: e.pointerId };
    try {
      (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    } catch {
      /* no capture */
    }
    this.toggleAttribute('data-ed-dragging', true);
  }

  private onGripMove(e: PointerEvent) {
    const d = this.edDrag;
    if (!d || e.pointerId !== d.pid) return;
    const rows = [...this.renderRoot.querySelectorAll(`[data-ed-list="${CSS.escape(d.list)}"] > [data-ed-row]`)] as HTMLElement[];
    const at = rows.findIndex((r) => {
      const b = r.getBoundingClientRect();
      return e.clientY >= b.top && e.clientY <= b.bottom;
    });
    const from = rows.findIndex((r) => r.dataset.edRow === d.id);
    if (at >= 0 && from >= 0 && at !== from) this.edMove(d.list, d.id, at);
  }

  private onGripUp(e: PointerEvent) {
    if (!this.edDrag || e.pointerId !== this.edDrag.pid) return;
    this.edDrag = null;
    this.toggleAttribute('data-ed-dragging', false);
  }

  private async saveEdit(force = false) {
    if (this.saving || !this.area) return;
    const toSite = this.applyTo === 'site';
    const layout = buildLayout(this.draft, this.listedSections.map((r) => r.id));
    const installation = can('system.configure');
    const alert = installation && this.alertDraft !== this.opts.popup_alert ? this.alertDraft : undefined;
    this.saving = true;
    this.saveError = '';
    try {
      const r = await savePopupLayout(toSite ? null : this.area.area_id, this.opts.popup.version, layout, { force, alert });
      this.opts = { ...this.opts, popup: r.popup, popup_alert: r.popup_alert };
      this.editing = false;
      this.conflict = false;
    } catch (err) {
      if (isVersionConflict(err)) this.conflict = true;
      else this.saveError = err instanceof ApiError && err.status === 403 ? err.message : hs('qcSaveFailed');
    } finally {
      this.saving = false;
    }
  }

  /** "Reload": take what the other manager saved, keep the editor open on it. */
  private async reloadEdit() {
    invalidateSettings();
    this.opts = await loadHomeScreen(true);
    this.draft = this.layout;
    this.alertDraft = this.opts.popup_alert;
    this.conflict = false;
  }

  private doReset() {
    this.draft = EMPTY_LAYOUT;
    this.confirmReset = false;
    this.openSec = null;
  }

  private renderEditor() {
    const a = this.area!;
    const rows = this.listedSections;
    const phone = this.mode === 'sheet';
    const site = this.applyTo === 'site';
    const installation = can('system.configure');
    const label = (id: string) => (id === 'quick' ? hs('qcQuickLabel') : hs(SECTION_LABEL[id as Exclude<QuickSection, 'quick'>]));
    const eye = (hidden: boolean, name: string, onClick: () => void) =>
      html`<button type="button" class="eye" data-ed-eye aria-pressed=${String(!hidden)} aria-label=${hidden ? hs('qcShowIt', { name }) : hs('qcHideIt', { name })} title=${hidden ? hs('qcShowIt', { name }) : hs('qcHideIt', { name })} @click=${onClick}><sw-icon name=${hidden ? 'eyeOff' : 'eye'} size=${16}></sw-icon></button>`;
    const mv = (list: string, id: string, i: number, n: number) => html`
      <button type="button" class="mv" data-ed-up aria-label=${hs('qcMoveUp')} title=${hs('qcMoveUp')} ?disabled=${i === 0} @click=${() => this.edStep(list, id, -1)}><sw-icon name="arrowUp" size=${14}></sw-icon></button>
      <button type="button" class="mv" data-ed-down aria-label=${hs('qcMoveDown')} title=${hs('qcMoveDown')} ?disabled=${i === n - 1} @click=${() => this.edStep(list, id, 1)}><sw-icon name="arrowDown" size=${14}></sw-icon></button>`;
    const grip = (list: string, id: string) =>
      html`<button type="button" class="grip" data-ed-grip=${id} aria-label=${hs('qcDragHandle')} title=${hs('qcDragHandle')} @pointerdown=${(e: PointerEvent) => this.onGripDown(e, list, id)} @pointermove=${(e: PointerEvent) => this.onGripMove(e)} @pointerup=${(e: PointerEvent) => this.onGripUp(e)} @pointercancel=${(e: PointerEvent) => this.onGripUp(e)} @keydown=${(e: KeyboardEvent) => this.onGripKey(e, list, id)}><sw-icon name="grip" size=${15}></sw-icon></button>`;
    const itemSection = (id: string) => (POPUP_ITEM_SECTIONS as readonly string[]).includes(id) && this.itemRows(id).length > 0;
    const limit = phone ? 4 : 6;
    const renderItems = (sec: string) => {
      const items = editItems(this.itemRows(sec), sec, this.draft);
      const shown = this.moreItems ? items : items.slice(0, limit);
      return html`<div class="ed-items" role="list" data-ed-list=${sec} aria-label=${hs('qcItemsOf', { name: label(sec) })}>
        ${repeat(shown, (x) => x.row.entity_id, (x, i) => html`<div class=${classMap({ er: true, it: true, off: x.hidden })} role="listitem" data-ed-row=${x.row.entity_id}>
          ${grip(sec, x.row.entity_id)}${eye(x.hidden, x.row.name, () => this.edToggleItem(sec, x.row.entity_id))}
          <span class="nm">${bidi(x.row.name)}</span>${sec === 'sensors' && isTechnical(x.row) ? html`<span class="tag" data-ed-tech>${hs('qcTechTag')}</span>` : nothing}${x.hidden ? html`<span class="hidtag">${hs('qcHiddenTag')}</span>` : nothing}
          <span class="grow"></span>${mv(sec, x.row.entity_id, i, items.length)}</div>`)}
        ${items.length > limit && !this.moreItems ? html`<button type="button" class="more" data-ed-more @click=${() => (this.moreItems = true)}>${hs('qcShowMoreN', { n: items.length - limit })}</button>` : nothing}
      </div>`;
    };
    return html`<div class="ed" data-qc-editor>
      <div class="ed-main">
        <div class="ed-list" role="list" data-ed-list="sections" aria-label=${hs('qcEditTitle')}>
          ${repeat(rows, (r) => r.id, (r, i) => {
            const open = this.openSec === r.id;
            const hc = hiddenCount(this.draft, r.id);
            return html`<div class=${classMap({ er: true, sr: true, off: r.hidden, open })} role="listitem" data-ed-row=${r.id}>
                ${grip('sections', r.id)}${eye(r.hidden, label(r.id), () => this.edToggleSection(r.id))}
                <span class="nm">${label(r.id)}</span>${hc ? html`<span class="meta">· ${hs('qcHiddenN', { n: hc })}</span>` : nothing}${r.hidden ? html`<span class="hidtag">${hs('qcHiddenTag')}</span>` : nothing}
                <span class="grow"></span>${mv('sections', r.id, i, rows.length)}
                ${itemSection(r.id) ? html`<button type="button" class="exp" data-ed-expand=${r.id} aria-expanded=${String(open)} aria-label=${hs('qcItemsOf', { name: label(r.id) })} @click=${() => { this.openSec = open ? null : r.id; this.moreItems = false; }}><sw-icon name="chevronDown" size=${14}></sw-icon></button>` : html`<span class="exp-gap"></span>`}
              </div>${open ? renderItems(r.id) : nothing}`;
          })}
        </div>
        <aside class="ed-side">
          <div class="fld">
            <b class=${phone ? 'vh' : ''}>${hs('qcApplyTo')}</b>
            <div class="seg" role="radiogroup" aria-label=${hs('qcApplyTo')}>
              <button type="button" role="radio" aria-checked=${String(!site)} class=${classMap({ on: !site })} data-ed-apply="area" @click=${() => (this.applyTo = 'area')}><sw-icon name="pin" size=${13}></sw-icon>${hs('qcApplyArea')}</button>
              <button type="button" role="radio" aria-checked=${String(site)} class=${classMap({ on: site })} data-ed-apply="site" ?disabled=${!installation} @click=${() => (this.applyTo = 'site')}><sw-icon name="home" size=${13}></sw-icon>${hs('qcApplySite')}</button>
            </div>
            ${site ? html`<div class="sitewarn" data-ed-sitewarn><sw-icon name="warning" size=${13}></sw-icon><span>${hs('qcSiteWarn')}</span></div>` : phone ? nothing : html`<small>${hs('qcAreaNote', { name: a.name })}</small>`}
          </div>
          ${installation ? html`<div class="fld tgrow"><div><b>${hs('qcAlertTitle')}</b>${phone ? nothing : html`<small>${this.alertDraft === 'show' ? hs('qcAlertOn') : hs('qcAlertOff')}</small>`}</div>
            <sw-toggle data-ed-alert .checked=${this.alertDraft === 'show'} label=${hs('qcAlertTitle')} labelHidden @change=${(e: CustomEvent<{ checked: boolean }>) => (this.alertDraft = e.detail.checked ? 'show' : 'hide')}></sw-toggle></div>` : nothing}
          ${phone ? nothing : html`<div class="fine"><sw-icon name="info" size=${13}></sw-icon><span>${hs('qcFine')}</span></div>`}
        </aside>
      </div>
      ${nothingVisible(rows) ? html`<div class="warn" data-ed-allhidden role="status"><sw-icon name="warning" size=${13}></sw-icon>${hs('qcAllHiddenWarn')}</div>` : nothing}
      ${this.saveError ? html`<div class="warn" data-ed-error role="alert">${this.saveError}</div>` : nothing}
      ${this.conflict ? html`<div class="warn" data-ed-conflict role="alert"><span>${hs('qcConflict')}</span><button type="button" class="qb" data-ed-reload @click=${() => void this.reloadEdit()}>${hs('qcReload')}</button><button type="button" class="qb main" data-ed-force @click=${() => void this.saveEdit(true)}>${hs('qcOverwrite')}</button></div>` : nothing}
      <footer class="ed-foot">
        <button type="button" class="qb" data-ed-reset @click=${() => (this.confirmReset = true)}>${hs('qcResetBtn')}</button>
        ${phone ? nothing : html`<span class="lockn"><sw-icon name="lock" size=${13}></sw-icon>${hs('qcLockNote')}</span>`}
        <span class="grow"></span>
        <button type="button" class="qb" data-ed-cancel @click=${() => this.cancelEdit()}>${hs('qcCancel')}</button>
        <button type="button" class="qb pri" data-qc-ed-save ?disabled=${this.saving} @click=${() => void this.saveEdit()}>${site ? hs('qcSaveSite') : hs('qcSaveArea')}</button>
      </footer>
      ${this.confirmReset ? html`<div class="cf-scrim" @click=${() => (this.confirmReset = false)}></div>
        <div class="cf" role="alertdialog" aria-labelledby="qc-cf-t" data-ed-confirm><h3 id="qc-cf-t">${hs('qcResetTitle')}</h3><p>${site ? hs('qcResetBodySite') : hs('qcResetBody')}</p>
          <div class="row2"><button type="button" class="qb" data-ed-confirm-no @click=${() => (this.confirmReset = false)}>${hs('qcCancel')}</button><button type="button" class="qb pri" data-ed-confirm-yes @click=${() => this.doReset()}>${hs('qcResetGo')}</button></div></div>` : nothing}
    </div>`;
  }

  // ------------------------------------------------------------------------------------------------ render

  /** Every camera this person may see here (before the layout hides or orders them). */
  private get allCameras(): DeviceRow[] {
    const allowed = sideSectionsAllowed((p) => !isApi() || canAnywhere(p));
    if (!allowed.cameras) return [];
    return (this.detail?.cards.security?.entities ?? []).filter((r) => r.kind === 'camera' && r.available);
  }

  private get cameras(): DeviceRow[] {
    return shownItems(this.allCameras, 'cameras', this.layout, false).rows.slice(0, 4);
  }

  private get layout(): PopupLayout {
    return layoutFor(this.opts.popup, this.area?.area_id);
  }

  /** The editor shows to a manager only: the server refuses a save from anyone else (system.configure on the area's scope). */
  private get canEdit(): boolean {
    // the editor is not offered on a phone (the sheet mode): hiding / ordering is a tablet and desktop task (owner 2026-10-30)
    return this.mode !== 'sheet' && isApi() && canAnywhere('system.configure') && !!this.area;
  }

  /** The items of a section that this person may see, before the layout (what the editor lists). */
  private itemRows(s: string): DeviceRow[] {
    const d = this.detail;
    if (s === 'sensors') return sensorRows(d?.cards.sensors, Infinity);
    if (s === 'cameras') return this.allCameras;
    return controllableRows(d?.cards[s as CardId], EQUIPMENT_DOMAINS);
  }

  /** A hidden sensor is in alarm now and the installation shows such a sensor: the sensors section appears for it. */
  private get alarmingHidden(): boolean {
    if (this.opts.popup_alert !== 'show') return false;
    const hid = this.layout.items.sensors?.hidden ?? [];
    return this.itemRows('sensors').some((r) => hid.includes(r.entity_id) && isAlarming(r));
  }

  /** Every section this person may see (before the layout), in today's order. */
  private get availableSections(): QuickSection[] {
    const d = this.detail;
    return sectionsFor({ cards: d?.cards ?? null, cameras: this.allCameras.length, scenes: this.scenes.length, schedules: this.schedules.length, events: this.events.length, canBulk: this.canBulk && !!this.area && (d?.can_bulk ?? true) }, EQUIPMENT_DOMAINS);
  }

  private get sections(): QuickSection[] {
    const lay = this.layout;
    const showAlert = this.opts.popup_alert === 'show';
    // the layout hides / orders what this person may already see; a section whose every item is hidden drops out
    const all = shownSections(this.availableSections, lay, this.alarmingHidden).filter(
      (s) => !(POPUP_ITEM_SECTIONS as readonly string[]).includes(s) || shownItems(this.itemRows(s), s, lay, showAlert && s === 'sensors').rows.length > 0,
    );
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
            <h2><span class="hn">${a ? bidi(a.name) : ''}</span>${this.editing ? html`<span class="editing" data-qc-editing><sw-icon name="edit" size=${12}></sw-icon>${hs('qcEditing')}</span>` : nothing}</h2>
            <span class="sub">${this.editing ? html`<span class="ed-hint">${this.mode === 'sheet' ? hs('qcEditHintPhone') : hs('qcEditHintDesk')}</span>` : [this.floorName ? html`<span>${bidi(this.floorName)}</span>` : '', temp ? html`<span><b>${temp}</b></span>` : '', c ? html`<span>${ltrNum(c.entities)} ${hs('qcDevicesLabel')}</span>` : ''].filter((x) => x !== '').map((x, i) => (i ? html` · ${x}` : x))}</span>
          </div>
          <span class="acts">
            ${this.canEdit && !this.editing ? html`<button type="button" class="ib" data-qc-edit aria-label=${hs('qcEditTitle')} title=${hs('qcEditTitle')} @click=${() => this.startEdit()}><sw-icon name="edit" size=${17}></sw-icon></button>` : nothing}
            <button type="button" class="ib" data-qc-expand aria-label=${expandLabel} title=${expandLabel} aria-pressed=${String(expandedNow)} @click=${() => this.toggleExpand()}><sw-icon name="expand" size=${17}></sw-icon></button>
            ${a ? html`<a class="ib" href=${`#/devices/areas/${encodeURIComponent(a.area_id)}`} data-qc-open-screen aria-label=${hs('qcOpenScreen')} title=${hs('qcOpenScreen')} @click=${(e: Event) => this.openScreen(e)}><sw-icon name="chevron" size=${17}></sw-icon></a>` : nothing}
            <button type="button" class="ib" data-qc-close aria-label=${hs('close')} title=${hs('close')} @click=${() => this.close()}><sw-icon name="close" size=${18}></sw-icon></button>
          </span>
        </header>
        ${this.editing ? this.renderEditor() : html`<div class="body" data-qc-body><div class="cols">${this.renderBody()}</div></div>`}
      </section>`;
  }

  private renderBody() {
    if (this.error && !this.detail) return html`<div class="note" data-qc-error>${this.error}</div>`;
    if (!this.detail) return html`<div class="spin" role="status" aria-label="טוען"></div>`;
    const secs = this.sections;
    if (!secs.length) return html`<div class="note" data-qc-empty>${this.availableSections.length ? hs('qcEmptyLayout') : hs('qcEmpty')}</div>`;
    return repeat(secs, (s) => s, (s) => this.renderSection(s));
  }

  private renderSection(s: QuickSection) {
    if (s === 'quick') return this.renderQuick();
    const head = (n: number) => html`<div class="sh"><sw-icon .name=${SECTION_ICON[s]} size=${13}></sw-icon>${hs(SECTION_LABEL[s])}<span class="n">${ltrNum(n)}</span></div>`;
    if (s === 'sensors') {
      const shown = shownItems(this.itemRows('sensors'), 'sensors', this.layout, this.opts.popup_alert === 'show');
      const rows = shown.rows.slice(0, 6);
      return html`<div class="sec" data-qc-section="sensors">${head(rows.length)}<div class="sens">${rows.map((r) => this.renderSensor(r, shown.revealed.has(r.entity_id)))}</div></div>`;
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
    const rows = shownItems(this.itemRows(s), s, this.layout, false).rows;
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

  private renderSensor(r: DeviceRow, revealed = false) {
    const value = r.domain === 'sensor' && r.value !== null && r.value !== undefined ? `${ltrNum(Number.isInteger(r.value) ? r.value : r.value.toFixed(1))}${r.unit ? ` ${r.unit}` : ''}` : rowLabel(r);
    return html`<div class=${classMap({ sv: true, alarm: revealed })} data-qc-sensor=${r.entity_id} data-qc-alarm=${revealed ? 'true' : nothing} title=${revealed ? `${r.name} - ${hs('qcRevealed')}` : r.name}><b>${value}</b><span>${bidi(r.name)}</span>${revealed ? html`<em>${hs('qcRevealed')}</em>` : nothing}</div>`;
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
