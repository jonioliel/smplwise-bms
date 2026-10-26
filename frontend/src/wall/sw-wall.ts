import { LitElement, html, css, nothing } from 'lit';
import { customElement, state } from 'lit/decorators.js';
import { keyed } from 'lit/directives/keyed.js';
import '../components/sw-camera-tile';
import '../components/sw-icon';
import { ApiError } from '../api/client';
import { healthSummary } from '../api/health';
import { effectiveTransport, productSettings } from '../api/prefs';
import { loadSession, session } from '../api/session';
import type { ProductSettings } from '../api/media';
import { ackWallAlert, frameUrl, getFrameList, getWallAnnouncement, getWallConfig, getWallStates, wallSocketUrl, type WallAlert, type WallDisplayConfig, type WallState } from '../api/wall';
import { classifyDevice, readDeviceEnv } from './device-class';
import { alertView, frameActive, holdProgress, isAwake, needsAttention, pageCameras, pixelShift, reconnectDelayMs, resolveLayout, serverHealth, shuffleOrder, tileHealth, wakesDisplay, wallScale } from './wall-logic';
import { timeText } from '../api/day-format';
import { closeLabel, dirOf, headingOf, pollMs, sizeOf, visibleNow, type ScreenAnnouncement } from '../announce/screen-overlay';

type Phase = 'loading' | 'ready' | 'removed' | 'remote-refused' | 'no-connection';
const RETRY_BACKOFF_S = [2, 4, 8, 15];

/**
 * CR-030 section 4: the wall display. Mounted by the shell INSTEAD of the application when an enabled wall user signs in
 * on a tablet-class device (device-class.ts). No rail, no router, no user menu: the only interactive element is a
 * long-press (1.2 s) on the clock that shows the read-only installer panel for 10 s. Control is impossible by design
 * (the `kiosk` role is live video and map only).
 * Built here: layout presets, strip, page rotation, pixel shift / shuffle / dim, schedule sleep, camera and server
 * offline ladders, live configuration over the websocket. WDX adds: alert tiles (info chip, alert tile, critical takeover,
 * seen / press-and-hold acknowledge, the 'alert' strip chip, wake on severity) and the picture frame (idle slideshow of the
 * profile's own photo set, yields to touch / alerts / sleep).
 */
@customElement('sw-wall')
export class SwWall extends LitElement {
  @state() private phase: Phase = 'loading';
  @state() private data: WallDisplayConfig | null = null;
  @state() private states: WallState[] = [];
  @state() private healthOk: boolean | null = null;
  @state() private now = Date.now();
  @state() private vw = window.innerWidth;
  @state() private vh = window.innerHeight;
  @state() private panel = false;
  @state() private chipUpdated = false;
  @state() private touchedAt = Date.now();
  @state() private wakeUntil = 0;
  @state() private tick = 0;
  @state() private alerts: WallAlert[] = [];
  /** ANNOUNCEB-295: a voice announcement addressed to this display (text only, until its time ends) and the id a person closed on this screen */
  @state() private announcement: ScreenAnnouncement | null = null;
  @state() private annClosed = '';
  private annTimer = 0;
  @state() private tap = 0;
  @state() private resolved: { id: string; text: string; until: number }[] = [];
  @state() private holdStart: number | null = null;
  @state() private frameIdx = 0;
  private photos: { id: string; w: number; h: number }[] = [];
  private order: number[] = [];
  private frameSwitchAt = 0;
  private frameListFor = '';
  private activityAt = Date.now();
  private shownAt = new Map<string, number>();
  private seenUntil = new Map<string, number>();
  private holdTimer = 0;
  private settings: ProductSettings | null = null;
  private ws: WebSocket | null = null;
  private downSince: number | null = null;
  private timer = 0;
  private retry = 0;
  private longPress = 0;
  private panelTimer = 0;
  private updatedTimer = 0;
  private lastStates = 0;
  private lastHealth = 0;
  private ok = new Map<string, boolean>();
  private drop = new Map<string, number>();
  private epoch = new Map<string, number>();
  private tries = new Map<string, number>();
  private nextTry = new Map<string, number>();
  private planLoaded = false;
  private readonly env = readDeviceEnv();
  private readonly onResize = () => {
    this.vw = window.innerWidth;
    this.vh = window.innerHeight;
  };
  private readonly onTouch = () => {
    this.touchedAt = Date.now();
    this.activityAt = this.touchedAt;
    if (this.data?.config.schedule.wake_on_touch) this.wakeUntil = Date.now() + 10 * 60_000;
  };

  /**
   * KIOSK polish (2026-10-11). The wall is read at a distance, so type is one tier larger than the shell's and scales with
   * the physical screen (`--s`, wall-logic.ts wallScale). Colours: the per-profile wall THEME (dark / light, `cfg.theme`) is
   * independent of the product scheme, so the four `--wall-*` knobs below carry both themes themselves (a light wall inside a
   * dark product and the reverse are both configured installations); everything that does not depend on the theme reads the
   * product tokens - the on-video family (same in both schemes), the state colours, radii, weights, shadows. Idle: the whole
   * composition glides on the burn-in shift (a 2 s transition, so a 2 px move is never a jump), the strip loses its fill and the
   * clock becomes an outline when dimmed (no static bright pixels), the sleep clock drifts. State changes land with a short
   * fade / rise; every transition and animation is off under prefers-reduced-motion.
   */
  static styles = css`
    :host {
      position: fixed;
      inset: 0;
      display: block;
      direction: rtl;
      background: var(--wall-bg);
      color: var(--wall-text);
      font-family: var(--sw-font);
      line-height: 1.3;
      overflow: hidden;
      -webkit-font-smoothing: antialiased;
      /* the dark wall theme: the product's video canvas, white HUD text */
      --wall-bg: var(--sw-video-bg);
      --wall-text: var(--sw-on-video);
      --wall-text-2: var(--sw-on-video-2);
      --wall-tile: #060912;
      --wall-tile-border: var(--sw-video-line);
      --wall-strip: rgba(255, 255, 255, 0.06);
      --wall-chip: rgba(127, 140, 170, 0.18);
      --wall-chip-strong: rgba(127, 140, 170, 0.3);
      --wall-dot: rgba(255, 255, 255, 0.3);
      --wall-dot-on: rgba(255, 255, 255, 0.85);
      --wall-danger-soft: rgba(255, 107, 98, 0.22);
      --wall-danger-text: #ffb3ad;
      --wall-stale-soft: rgba(245, 176, 67, 0.22);
      --wall-stale-text: #ffd08a;
      --wall-panel: rgba(20, 24, 38, 0.96);
    }
    :host([data-wall-theme='light']) {
      --wall-bg: #dfe5f0;
      --wall-text: #1e2e47;
      --wall-text-2: #5b6a85;
      --wall-tile: #0f1729;
      --wall-tile-border: rgba(30, 46, 71, 0.12);
      --wall-strip: rgba(255, 255, 255, 0.85);
      --wall-chip: rgba(30, 46, 71, 0.08);
      --wall-chip-strong: rgba(30, 46, 71, 0.14);
      --wall-dot: rgba(30, 46, 71, 0.25);
      --wall-dot-on: rgba(30, 46, 71, 0.85);
      --wall-danger-soft: rgba(239, 68, 68, 0.14);
      --wall-danger-text: #b91c1c;
      --wall-stale-soft: rgba(245, 158, 11, 0.18);
      --wall-stale-text: #b45309;
      --wall-panel: rgba(255, 255, 255, 0.96);
    }
    .wall {
      position: absolute;
      inset: 0;
      display: grid;
      padding: var(--pad);
      gap: var(--gap);
      --pad: calc(16px * var(--s, 1));
      --gap: calc(12px * var(--s, 1));
      --strip-h: calc(64px * var(--s, 1));
      --chip-h: calc(44px * var(--s, 1));
      grid-template-rows: var(--strip-h) minmax(0, 1fr);
      /* the pixel shift glides and the dim fades: a burn-in move is never a visible jump */
      transition: opacity 3s ease, transform 2s ease-in-out;
    }
    .wall[data-preset='tablet-portrait'] {
      grid-template-rows: var(--strip-h) minmax(0, 1fr) auto;
    }
    .wall[data-preset='tablet-portrait'][data-map] {
      grid-template-rows: var(--strip-h) minmax(0, 1fr) minmax(0, 0.55fr) auto;
    }
    .wall[data-preset='single'] {
      grid-template-rows: minmax(0, 1fr);
    }
    .wall[data-preset='single'] .strip {
      position: absolute;
      inset: var(--pad) var(--pad) auto;
      z-index: 2;
      background: linear-gradient(var(--sw-video-scrim), transparent);
      color: var(--sw-on-video);
      --wall-text-2: var(--sw-on-video-2);
    }
    .strip {
      display: flex;
      align-items: center;
      gap: var(--gap);
      block-size: var(--strip-h);
      padding: 0 calc(var(--pad) * 0.75);
      background: var(--wall-strip);
      border-radius: var(--sw-r-lg);
      transition: background-color 3s ease;
    }
    :host-context(html[data-skin='bubble']) .strip,
    :host-context(html[data-skin='bubble']) .panel {
      border-radius: var(--sw-r-pill);
    }
    .place {
      font-size: calc(19px * var(--s, 1));
      font-weight: var(--sw-fw-semibold);
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
      min-inline-size: 0;
    }
    .clock {
      margin-inline: auto;
      display: flex;
      align-items: baseline;
      gap: calc(12px * var(--s, 1));
      min-block-size: calc(44px * var(--s, 1));
      padding-inline: calc(8px * var(--s, 1));
      font-size: calc(34px * var(--s, 1));
      font-weight: var(--sw-fw-bold);
      letter-spacing: 0.02em;
      font-variant-numeric: tabular-nums;
      user-select: none;
      -webkit-user-select: none;
      touch-action: manipulation;
      transition: color 3s ease;
    }
    .clock .date {
      font-size: calc(15px * var(--s, 1));
      font-weight: var(--sw-fw-regular);
      color: var(--wall-text-2);
    }
    /* dimmed (burn-in): the strip's fill goes, the clock becomes an outline, the chips recede - nothing stays bright */
    .dim .clock {
      -webkit-text-stroke: 1px var(--wall-text);
      color: transparent;
    }
    .dim .strip {
      background-color: transparent;
    }
    .dim .chip,
    .dim .place,
    .dim .dots {
      opacity: 0.7;
    }
    .chips {
      display: flex;
      gap: calc(8px * var(--s, 1));
      align-items: center;
    }
    .chip {
      display: inline-flex;
      align-items: center;
      gap: calc(8px * var(--s, 1));
      block-size: var(--chip-h);
      padding: 0 calc(14px * var(--s, 1));
      border-radius: var(--sw-r-pill);
      background: var(--wall-chip);
      font-size: calc(16px * var(--s, 1));
      white-space: nowrap;
      transition: opacity 3s ease;
      animation: rise 0.5s var(--sw-ease) both;
    }
    .chip b {
      font-weight: var(--sw-fw-semibold);
      font-variant-numeric: tabular-nums;
    }
    .chip i {
      inline-size: calc(9px * var(--s, 1));
      block-size: calc(9px * var(--s, 1));
      border-radius: 50%;
      background: var(--sw-live);
      flex: none;
    }
    .chip[data-tone='stale'] i {
      background: var(--sw-stale);
    }
    .chip[data-tone='danger'] {
      background: var(--wall-danger-soft);
      color: var(--wall-danger-text);
      font-weight: var(--sw-fw-semibold);
    }
    .chip[data-tone='danger'] i {
      background: var(--sw-danger);
      animation: breathe 2.4s ease-in-out infinite;
    }
    .grid {
      display: grid;
      gap: var(--gap);
      min-block-size: 0;
      position: relative;
      grid-template-columns: repeat(var(--cols, 2), minmax(0, 1fr));
      grid-template-rows: repeat(var(--rows, 2), minmax(0, 1fr));
    }
    .wall[data-preset='tablet-portrait'] .grid {
      grid-template-columns: minmax(0, 1fr);
    }
    .tile {
      position: relative;
      display: grid;
      place-items: center;
      container-type: size;
      background: var(--wall-tile);
      border: 1px solid var(--wall-tile-border);
      border-radius: var(--sw-r-lg);
      overflow: hidden;
      min-block-size: 0;
      direction: ltr;
      animation: fade-in 0.6s var(--sw-ease) both;
    }
    /* the picture keeps its 16:9 and sits centred in the cell (a portrait cell is taller than wide: no dead band under the
       video, the letterbox is split above and below); where container units are missing the tile fills the width as before */
    .tile sw-camera-tile {
      display: block;
      inline-size: 100%;
      inline-size: min(100%, calc(100cqh * 16 / 9));
      max-block-size: 100%;
      border-radius: 0;
      box-shadow: none;
    }
    .tile[data-health='stale'] sw-camera-tile {
      filter: brightness(0.55) saturate(0.7);
      transition: filter 1s ease;
    }
    .tile[data-health='stale']::after {
      content: '';
      position: absolute;
      inset: 0;
      background: repeating-linear-gradient(135deg, rgba(0, 0, 0, 0.28) 0 6px, transparent 6px 14px);
      pointer-events: none;
    }
    .tile[data-health='lost'] sw-camera-tile {
      visibility: hidden;
    }
    /* the map pane of a portrait wall (cfg.show_map): the tile material under the plan that sw-wall-plan draws (CR-029 S5-B); an
       empty surface until the floor loads, and for a profile with no floor */
    .pane {
      position: relative;
      min-block-size: 0;
      background: var(--wall-tile);
      border: 1px solid var(--wall-tile-border);
      border-radius: var(--sw-r-lg);
      overflow: hidden;
      animation: fade-in 0.6s var(--sw-ease) both;
    }
    .badge,
    .lost {
      position: absolute;
      z-index: 1;
      direction: rtl;
    }
    .badge {
      inset-block-start: calc(10px * var(--s, 1));
      inset-inline-start: calc(10px * var(--s, 1));
      display: inline-flex;
      align-items: center;
      gap: calc(8px * var(--s, 1));
      padding: 0 calc(12px * var(--s, 1));
      min-block-size: calc(32px * var(--s, 1));
      border-radius: var(--sw-r-pill);
      background: var(--sw-video-scrim);
      color: var(--sw-on-video);
      font-size: calc(15px * var(--s, 1));
      font-weight: var(--sw-fw-medium);
      font-variant-numeric: tabular-nums;
      animation: rise 0.5s var(--sw-ease) both;
    }
    .badge::before {
      content: '';
      inline-size: calc(9px * var(--s, 1));
      block-size: calc(9px * var(--s, 1));
      border-radius: 50%;
      background: var(--sw-stale);
    }
    .lost {
      inset: 0;
      display: grid;
      place-content: center;
      text-align: center;
      gap: calc(8px * var(--s, 1));
      font-size: calc(18px * var(--s, 1));
      color: var(--sw-on-video-2);
    }
    .lost b {
      font-size: calc(24px * var(--s, 1));
      font-weight: var(--sw-fw-semibold);
      color: var(--sw-on-video);
    }
    .banner {
      background: var(--wall-danger-soft);
      color: var(--wall-danger-text);
      padding: 0 calc(16px * var(--s, 1));
      border-radius: var(--sw-r-pill);
      block-size: var(--chip-h);
      display: inline-flex;
      align-items: center;
      gap: calc(10px * var(--s, 1));
      font-size: calc(16px * var(--s, 1));
      font-weight: var(--sw-fw-semibold);
      animation: rise 0.5s var(--sw-ease) both;
    }
    .banner::before {
      content: '';
      inline-size: calc(9px * var(--s, 1));
      block-size: calc(9px * var(--s, 1));
      border-radius: 50%;
      background: var(--sw-danger);
      animation: breathe 2.4s ease-in-out infinite;
    }
    .band {
      display: flex;
      gap: var(--gap);
      flex-wrap: wrap;
      align-items: center;
      padding: calc(4px * var(--s, 1)) 0;
    }
    .dots {
      position: absolute;
      inset-block-end: calc(8px * var(--s, 1));
      inset-inline: 0;
      display: flex;
      justify-content: center;
      gap: calc(8px * var(--s, 1));
      pointer-events: none;
      transition: opacity 3s ease;
    }
    .dots i {
      inline-size: calc(8px * var(--s, 1));
      block-size: calc(8px * var(--s, 1));
      border-radius: 50%;
      background: var(--wall-dot);
      transition: background-color 0.4s ease, transform 0.4s var(--sw-ease);
    }
    .dots i[data-on] {
      background: var(--wall-dot-on);
      transform: scale(1.25);
    }
    .center {
      position: absolute;
      inset: 0;
      display: grid;
      place-content: center;
      text-align: center;
      gap: calc(12px * var(--s, 1));
      padding: calc(32px * var(--s, 1));
      animation: fade-in 0.25s var(--sw-ease) both;
    }
    .center h1 {
      margin: 0;
      font-size: calc(30px * var(--s, 1));
      font-weight: var(--sw-fw-bold);
      line-height: 1.2;
    }
    .center p {
      margin: 0;
      color: var(--wall-text-2);
      font-size: calc(18px * var(--s, 1));
      max-inline-size: 36ch;
      justify-self: center;
    }
    .center .mark {
      inline-size: calc(56px * var(--s, 1));
      block-size: calc(56px * var(--s, 1));
      margin: 0 auto calc(8px * var(--s, 1));
      display: grid;
      place-content: center;
      border-radius: 50%;
      background: var(--wall-chip);
      color: var(--wall-text-2);
    }
    .center .mark[data-tone='danger'] {
      background: var(--wall-danger-soft);
      color: var(--wall-danger-text);
    }
    .center .mark[data-tone='live'] {
      color: var(--sw-live);
    }
    .center .mark[data-tone='live'] sw-icon {
      animation: breathe 2.4s ease-in-out infinite;
    }
    .empty {
      display: grid;
      place-content: center;
      text-align: center;
      color: var(--wall-text-2);
      font-size: calc(20px * var(--s, 1));
    }
    .sleep .bigclock {
      position: absolute;
      font-size: calc(72px * var(--s, 1));
      font-weight: var(--sw-fw-bold);
      opacity: 0.2;
      letter-spacing: 0.02em;
      font-variant-numeric: tabular-nums;
      transition: inset 2s ease-in-out;
    }
    .sleep .bigclock small {
      display: block;
      font-size: calc(18px * var(--s, 1));
      font-weight: var(--sw-fw-regular);
      letter-spacing: 0;
      text-align: center;
    }
    .panel {
      position: absolute;
      inset-block-start: calc(var(--pad) + var(--strip-h) + 8px);
      inset-inline-start: 50%;
      transform: translateX(50%);
      z-index: 5;
      min-inline-size: calc(340px * var(--s, 1));
      padding: calc(16px * var(--s, 1)) calc(20px * var(--s, 1));
      border-radius: var(--sw-r-lg);
      background: var(--wall-panel);
      color: var(--wall-text);
      box-shadow: var(--sw-shadow-3);
      font-size: calc(16px * var(--s, 1));
      animation: rise 0.3s var(--sw-ease) both;
    }
    .panel dl {
      display: grid;
      grid-template-columns: auto 1fr;
      gap: calc(6px * var(--s, 1)) calc(20px * var(--s, 1));
      margin: 0;
    }
    .panel dt {
      color: var(--wall-text-2);
    }
    .panel dd {
      margin: 0;
      direction: ltr;
      text-align: end;
      font-variant-numeric: tabular-nums;
    }
    .updated {
      position: absolute;
      inset-block-end: calc(var(--pad) + 6px);
      inset-inline-start: 50%;
      transform: translateX(50%);
      z-index: 4;
      background: var(--wall-chip-strong);
    }
    .atile {
      position: relative;
      display: grid;
      grid-template-rows: auto minmax(0, 1fr) auto;
      background: var(--wall-tile);
      border: 2px solid var(--sw-stale);
      border-radius: var(--sw-r-lg);
      overflow: hidden;
      min-block-size: 0;
      color: var(--sw-on-video);
      --wall-text-2: var(--sw-on-video-2);
      animation: fade-in 0.6s var(--sw-ease) both;
    }
    .atile .head {
      display: flex;
      align-items: center;
      gap: calc(14px * var(--s, 1));
      padding: calc(12px * var(--s, 1)) calc(16px * var(--s, 1));
      background: rgba(245, 176, 67, 0.14);
    }
    .atile .head > div {
      min-inline-size: 0;
    }
    .atile .head b {
      display: block;
      font-size: calc(24px * var(--s, 1));
      font-weight: var(--sw-fw-bold);
      line-height: 1.15;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }
    .atile .head span.sub {
      font-size: calc(15px * var(--s, 1));
      color: var(--wall-text-2);
    }
    .atile .icon {
      inline-size: calc(44px * var(--s, 1));
      block-size: calc(44px * var(--s, 1));
      border-radius: 50%;
      display: grid;
      place-content: center;
      background: var(--sw-stale);
      color: #1b1403;
      flex: none;
    }
    .atile .media {
      position: relative;
      min-block-size: 0;
      direction: ltr;
    }
    .atile .media sw-camera-tile {
      position: absolute;
      inset: 0;
      display: block;
    }
    .atile .foot,
    .takeover .foot {
      display: flex;
      align-items: center;
      flex-wrap: wrap;
      gap: calc(12px * var(--s, 1));
      padding: calc(10px * var(--s, 1)) calc(16px * var(--s, 1));
    }
    .more {
      margin-inline-start: auto;
      display: inline-grid;
      place-content: center;
      min-inline-size: calc(44px * var(--s, 1));
      min-block-size: calc(44px * var(--s, 1));
      padding: 0 calc(12px * var(--s, 1));
      border-radius: var(--sw-r-pill);
      background: var(--sw-video-hover);
      font-size: calc(16px * var(--s, 1));
      font-weight: var(--sw-fw-semibold);
      font-variant-numeric: tabular-nums;
      cursor: pointer;
      user-select: none;
      -webkit-user-select: none;
    }
    .btn {
      position: relative;
      display: inline-flex;
      align-items: center;
      gap: calc(10px * var(--s, 1));
      min-block-size: calc(48px * var(--s, 1));
      min-inline-size: calc(120px * var(--s, 1));
      padding: 0 calc(22px * var(--s, 1));
      border: 0;
      border-radius: var(--sw-r-pill);
      background: var(--wall-chip-strong);
      color: inherit;
      font: inherit;
      font-weight: var(--sw-fw-semibold);
      font-size: calc(17px * var(--s, 1));
      overflow: hidden;
      touch-action: none;
      user-select: none;
      -webkit-user-select: none;
      cursor: pointer;
      transition: transform var(--sw-t-fast) var(--sw-ease), background-color var(--sw-t-fast) ease;
    }
    .btn:active {
      transform: scale(0.97);
    }
    .btn:focus-visible {
      outline: var(--sw-focus-w) solid var(--sw-on-video);
      outline-offset: var(--sw-focus-offset);
    }
    .btn[data-hold]::before {
      content: '';
      position: absolute;
      inset-block: 0;
      inset-inline-start: 0;
      inline-size: calc(var(--hold, 0) * 100%);
      background: rgba(255, 107, 98, 0.55);
    }
    .btn > * {
      position: relative;
    }
    .note {
      display: inline-flex;
      align-items: center;
      gap: calc(6px * var(--s, 1));
      font-size: calc(15px * var(--s, 1));
      color: var(--wall-text-2);
    }
    .announce {
      position: absolute;
      inset: 0;
      z-index: 8;
      display: flex;
      align-items: center;
      justify-content: center;
      padding: calc(48px * var(--s, 1)) calc(64px * var(--s, 1));
      box-sizing: border-box;
      overflow: hidden;
      background: radial-gradient(120% 90% at 85% 10%, #1d2a44 0%, #121a2c 55%, #0a101d 100%);
      color: var(--sw-on-video);
    }
    .announce[data-critical='1'] {
      background: radial-gradient(120% 90% at 85% 10%, #5a1515 0%, #3a0d0d 50%, #220808 100%);
    }
    .announce .ann-in {
      display: flex;
      flex-direction: column;
      gap: calc(28px * var(--s, 1));
      max-inline-size: 100%;
      max-block-size: 100%;
      min-inline-size: 0;
    }
    .announce .ann-tag {
      align-self: flex-start;
      padding: calc(6px * var(--s, 1)) calc(20px * var(--s, 1));
      border-radius: 999px;
      font-size: calc(20px * var(--s, 1));
      font-weight: 600;
      background: rgba(255, 255, 255, 0.14);
    }
    .announce .ann-body {
      display: flex;
      flex-direction: column;
      gap: calc(24px * var(--s, 1));
      min-block-size: 0;
    }
    .announce .ann-t {
      margin: 0;
      font-weight: 500;
      line-height: 1.22;
      overflow-wrap: anywhere;
      text-wrap: balance;
    }
    .announce .ann-t + .ann-t {
      padding-block-start: calc(22px * var(--s, 1));
      border-block-start: 1px solid rgba(255, 255, 255, 0.22);
    }
    .announce [data-size='xl'] .ann-t { font-size: calc(104px * var(--s, 1)); font-weight: 600; }
    .announce [data-size='l'] .ann-t { font-size: calc(64px * var(--s, 1)); }
    .announce [data-size='m'] .ann-t { font-size: calc(44px * var(--s, 1)); }
    .announce [data-size='s'] .ann-t { font-size: calc(30px * var(--s, 1)); }
    .announce .ann-close {
      position: absolute;
      inset-block-start: calc(16px * var(--s, 1));
      inset-inline-end: calc(16px * var(--s, 1));
      inline-size: calc(48px * var(--s, 1));
      block-size: calc(48px * var(--s, 1));
      border: 0;
      border-radius: 50%;
      background: rgba(255, 255, 255, 0.16);
      color: inherit;
      cursor: pointer;
    }
    .takeover {
      position: absolute;
      inset: 0;
      z-index: 6;
      display: grid;
      grid-template-rows: var(--strip-h) minmax(0, 1fr) auto;
      gap: var(--gap);
      padding: var(--pad);
      background: #080506;
      color: var(--sw-on-video);
      --wall-text-2: var(--sw-on-video-2);
      --wall-chip: rgba(255, 255, 255, 0.1);
      --wall-chip-strong: rgba(255, 255, 255, 0.18);
      border: calc(8px * var(--s, 1)) solid var(--sw-danger);
      animation: pulse 2s ease-in-out 30, takeover-in 0.5s var(--sw-ease-dialog) both;
    }
    @keyframes pulse {
      50% {
        border-color: rgba(255, 107, 98, 0.35);
      }
    }
    .takeover .strip {
      background: rgba(255, 255, 255, 0.06);
    }
    .takeover .media {
      position: relative;
      border-radius: var(--sw-r-lg);
      overflow: hidden;
      background: #14100f;
      direction: ltr;
    }
    .takeover .media sw-camera-tile {
      position: absolute;
      inset: 0;
      display: block;
    }
    .takeover .titles {
      position: absolute;
      z-index: 1;
      inset-block-start: calc(18px * var(--s, 1));
      inset-inline-start: calc(22px * var(--s, 1));
      inset-inline-end: calc(22px * var(--s, 1));
      display: flex;
      gap: calc(18px * var(--s, 1));
      align-items: center;
      direction: rtl;
      text-shadow: 0 2px 14px rgba(0, 0, 0, 0.75);
    }
    .takeover .titles b {
      display: block;
      font-size: calc(46px * var(--s, 1));
      font-weight: var(--sw-fw-bold);
      line-height: 1.1;
    }
    .takeover .titles span.sub {
      font-size: calc(21px * var(--s, 1));
      color: var(--sw-on-video-2);
    }
    .takeover .icon {
      inline-size: calc(68px * var(--s, 1));
      block-size: calc(68px * var(--s, 1));
      border-radius: 50%;
      display: grid;
      place-content: center;
      background: var(--sw-danger);
      color: var(--sw-on-video);
      flex: none;
    }
    .takeover .foot {
      justify-content: center;
    }
    .frame {
      position: absolute;
      inset: 0;
      background: #000;
      overflow: hidden;
      transition: opacity 3s ease, transform 2s ease-in-out;
    }
    .frame img {
      position: absolute;
      inset: 0;
      inline-size: 100%;
      block-size: 100%;
      animation: fade-in 0.8s ease both;
    }
    .frame[data-motion='slow'] img {
      animation: fade-in 0.8s ease both, kb 40s ease-in-out infinite alternate;
    }
    @keyframes kb {
      to {
        transform: scale(1.08);
      }
    }
    .frame .fclock {
      position: absolute;
      inset-block-end: calc(28px * var(--s, 1));
      inset-inline-end: calc(32px * var(--s, 1));
      text-align: end;
      text-shadow: 0 2px 14px rgba(0, 0, 0, 0.75);
      color: var(--sw-on-video);
      direction: rtl;
    }
    .frame .fclock b {
      display: block;
      font-size: calc(58px * var(--s, 1));
      font-weight: var(--sw-fw-bold);
      letter-spacing: 0.02em;
      font-variant-numeric: tabular-nums;
      line-height: 1.1;
    }
    .frame .fclock span {
      font-size: calc(17px * var(--s, 1));
      color: var(--sw-on-video-2);
    }
    .frame .chips {
      position: absolute;
      inset-block-start: calc(18px * var(--s, 1));
      inset-inline-start: calc(18px * var(--s, 1));
      --wall-chip: var(--sw-video-scrim);
      --wall-danger-soft: rgba(255, 107, 98, 0.3);
      --wall-danger-text: #ffb3ad;
      color: var(--sw-on-video);
    }
    @keyframes fade-in {
      from {
        opacity: 0;
      }
    }
    @keyframes rise {
      from {
        opacity: 0;
        transform: translateY(6px);
      }
    }
    @keyframes takeover-in {
      from {
        opacity: 0;
        transform: scale(1.02);
      }
    }
    @keyframes breathe {
      50% {
        opacity: 0.45;
      }
    }
    @media (prefers-reduced-motion: reduce) {
      * {
        transition: none !important;
        animation: none !important;
      }
    }
  `;

  connectedCallback(): void {
    super.connectedCallback();
    window.addEventListener('resize', this.onResize);
    window.addEventListener('orientationchange', this.onResize);
    this.addEventListener('pointerdown', this.onTouch);
    this.timer = window.setInterval(() => this.onTick(), 1000);
    void productSettings().then((s) => (this.settings = s)).catch(() => undefined);
    void this.load();
    void this.pollAnnouncement();
  }

  disconnectedCallback(): void {
    super.disconnectedCallback();
    window.removeEventListener('resize', this.onResize);
    window.removeEventListener('orientationchange', this.onResize);
    this.removeEventListener('pointerdown', this.onTouch);
    window.clearInterval(this.timer);
    window.clearTimeout(this.retry);
    window.clearTimeout(this.longPress);
    window.clearTimeout(this.panelTimer);
    window.clearTimeout(this.updatedTimer);
    window.clearInterval(this.holdTimer);
    window.clearTimeout(this.annTimer);
    this.closeSocket();
  }

  // ---- ANNOUNCEB-295: the voice announcement text
  /** Ask the server for this display's announcement every `poll_s` seconds (it answers 0 while this display is not an announcement screen: then look again in a minute). */
  private async pollAnnouncement(): Promise<void> {
    let next = 60_000;
    try {
      const r = await getWallAnnouncement();
      this.announcement = r.announcement;
      next = pollMs(r.poll_s, 60_000);
    } catch {
      /* offline or not a wall user: the next look finds out */
    }
    window.clearTimeout(this.annTimer);
    this.annTimer = window.setTimeout(() => void this.pollAnnouncement(), next);
  }

  private renderAnnouncement(onlyCritical = false) {
    const a = this.announcement;
    if (!a || !visibleNow(a, this.now, this.annClosed) || (onlyCritical && !a.critical)) return nothing;
    return html`<div class="announce" data-wall-announcement=${a.id} data-critical=${a.critical ? '1' : '0'} role="alert">
      <div class="ann-in" data-size=${sizeOf(a)}>
        <span class="ann-tag">${headingOf(a, 'he')}</span>
        <div class="ann-body">${a.texts.map((t) => html`<p class="ann-t" lang=${t.language} dir=${dirOf(t.language)}>${t.text}</p>`)}</div>
      </div>
      <button class="ann-close" type="button" data-wall-announcement-close aria-label=${closeLabel('he')} @click=${() => (this.annClosed = a.id)}><sw-icon name="close"></sw-icon></button>
    </div>`;
  }

  // ---- data
  private async load(): Promise<void> {
    try {
      const cfg = await getWallConfig();
      const first = !this.data;
      this.data = cfg;
      this.setAlerts(cfg.alerts ?? []);
      void this.loadFrame();
      this.phase = 'ready';
      this.downSince = null;
      if (!first) this.flashUpdated();
      this.openSocket();
      void this.refreshStates(true);
    } catch (err) {
      if (err instanceof ApiError && err.status === 401) {
        this.phase = 'removed';
        return;
      }
      if (err instanceof ApiError && err.status === 403) {
        if (err.body.code === 'wall_user_remote_not_allowed') this.phase = 'remote-refused';
        else void loadSession(); // wall mode is off or removed: the shell drops to the normal limited application
        return;
      }
      this.downSince ??= Date.now();
      if (!this.data) this.phase = 'no-connection';
      this.scheduleRetry();
    }
  }

  private scheduleRetry(): void {
    window.clearTimeout(this.retry);
    this.retry = window.setTimeout(() => void this.load(), reconnectDelayMs(this.downSince ? Date.now() - this.downSince : 0));
  }

  private openSocket(): void {
    if (this.ws && this.ws.readyState <= 1) return;
    try {
      const ws = new WebSocket(wallSocketUrl());
      this.ws = ws;
      ws.onopen = () => ws.send(JSON.stringify({ type: 'hello', payload: { class: classifyDevice(this.env), screen: `${this.env.screenWidth}x${this.env.screenHeight}` } }));
      ws.onmessage = (m) => {
        try {
          const msg = JSON.parse(String(m.data)) as { type: string; payload?: { version?: number; alerts?: WallAlert[] } };
          if (msg.type === 'config' && msg.payload?.version !== this.data?.version) void this.load();
          else if (msg.type === 'alerts') this.setAlerts((msg.payload as { alerts?: WallAlert[] } | undefined)?.alerts ?? []);
          else if (msg.type === 'disabled') void loadSession();
          else if (msg.type === 'revoked') this.phase = 'removed';
          else if (msg.type === 'hello') this.downSince = null;
        } catch {
          /* a frame we do not know */
        }
      };
      ws.onclose = (ev) => {
        this.ws = null;
        if (ev.code === 4401 && this.phase === 'ready') {
          void this.load(); // a 401 on the next request decides: removed, or an expired session
          return;
        }
        this.downSince ??= Date.now();
        this.scheduleRetry();
      };
    } catch {
      this.downSince ??= Date.now();
    }
  }

  private closeSocket(): void {
    const ws = this.ws;
    this.ws = null;
    if (ws) {
      ws.onclose = null;
      ws.close();
    }
  }

  private flashUpdated(): void {
    this.chipUpdated = true;
    window.clearTimeout(this.updatedTimer);
    this.updatedTimer = window.setTimeout(() => (this.chipUpdated = false), 3000);
  }

  // ---- alerts (CR-030 section 5): the server pushes the whole open list; the ladder is decided here, from the display's own clock
  private setAlerts(next: WallAlert[]): void {
    const now = Date.now();
    const ids = new Set(next.map((a) => a.id));
    for (const old of this.alerts) {
      if (!ids.has(old.id) && old.severity !== 'info') this.resolved = [...this.resolved.filter((r) => r.id !== old.id), { id: old.id, text: `נסגר · ${old.place || old.title}`, until: now + 5000 }];
    }
    for (const a of next) if (!this.shownAt.has(a.id)) this.shownAt.set(a.id, now);
    for (const id of [...this.shownAt.keys()]) if (!ids.has(id)) {
      this.shownAt.delete(id);
      this.seenUntil.delete(id);
    }
    this.alerts = next;
  }

  private alertsOn(): WallAlert[] {
    return this.data?.config.alerts.enabled ? this.alerts : [];
  }

  private markSeen(a: WallAlert): void {
    this.seenUntil.set(a.id, Date.now() + (this.data?.config.alerts.takeover_timeout_s ?? 120) * 1000);
    this.requestUpdate();
  }

  private holdBegin = (a: WallAlert): void => {
    this.holdStart = Date.now();
    window.clearInterval(this.holdTimer);
    this.holdTimer = window.setInterval(() => {
      if (this.holdStart === null) return;
      this.now = Date.now();
      if (holdProgress(this.holdStart, this.now) >= 1) {
        this.holdEnd();
        void ackWallAlert(a.id).then(() => (this.alerts = this.alerts.filter((x) => x.id !== a.id))).catch(() => undefined);
      }
    }, 80);
  };

  private holdEnd = (): void => {
    this.holdStart = null;
    window.clearInterval(this.holdTimer);
  };

  // ---- picture frame (section 6)
  private async loadFrame(): Promise<void> {
    const fr = this.data?.config.frame;
    const key = fr && fr.enabled && fr.folder ? `${fr.folder}:${this.data?.version}` : '';
    if (key === this.frameListFor) return;
    this.frameListFor = key;
    if (!key) {
      this.photos = [];
      return;
    }
    try {
      this.photos = (await getFrameList()).photos;
      this.order = shuffleOrder(this.photos.length);
      this.frameIdx = 0;
      this.frameSwitchAt = Date.now();
    } catch {
      this.photos = [];
      this.frameListFor = '';
    }
  }

  private frameOn(): boolean {
    const d = this.data;
    if (!d) return false;
    return frameActive({ enabled: d.config.frame.enabled, photos: this.photos.length, idleMin: d.config.frame.idle_min, lastActivityMs: this.activityAt, nowMs: this.now, asleep: !this.awake(), attention: needsAttention(this.alertsOn()) });
  }

  private async refreshStates(force = false): Promise<void> {
    const ids = this.data?.config.state_entities ?? [];
    const now = Date.now();
    if (ids.length && (force || now - this.lastStates > 30_000)) {
      this.lastStates = now;
      try {
        this.states = (await getWallStates(ids)).states;
      } catch {
        /* the chips keep their last value until the next poll */
      }
    }
    if (force || now - this.lastHealth > 60_000) {
      this.lastHealth = now;
      try {
        this.healthOk = (await healthSummary()).status === 'ok';
      } catch {
        this.healthOk = null;
      }
    }
  }

  // ---- time
  private onTick(): void {
    this.now = Date.now();
    this.tick += 1;
    if (this.phase !== 'ready' || !this.data) return;
    const cfg = this.data.config;
    for (const [id, ok] of this.ok) {
      if (ok) continue;
      const due = this.nextTry.get(id) ?? 0;
      if (this.now >= due) {
        const n = this.tries.get(id) ?? 0;
        this.epoch.set(id, (this.epoch.get(id) ?? 0) + 1);
        this.tries.set(id, n + 1);
        this.nextTry.set(id, this.now + RETRY_BACKOFF_S[Math.min(n, RETRY_BACKOFF_S.length - 1)] * 1000);
      }
    }
    void this.refreshStates();
    if (needsAttention(this.alertsOn())) this.activityAt = this.now; // an open item keeps the frame away and restarts the idle timer when it ends
    if (this.resolved.length) this.resolved = this.resolved.filter((r) => r.until > this.now);
    if (this.photos.length && this.frameOn() && this.now - this.frameSwitchAt >= cfg.frame.interval_s * 1000) {
      this.frameSwitchAt = this.now;
      if (this.frameIdx + 1 >= this.order.length) {
        this.order = shuffleOrder(this.photos.length, Math.random, this.order[this.order.length - 1]);
        this.frameIdx = 0;
      } else this.frameIdx += 1;
    }
    const w = cfg.schedule.windows;
    if (w.length) this.emitSleepState(!this.awake());
  }

  private lastEmit = '';
  private emitSleepState(asleep: boolean): void {
    const s = asleep ? 'sleep' : 'wake';
    if (s === this.lastEmit) return;
    this.lastEmit = s;
    document.title = asleep ? 'SmplWise Arx - sleep' : 'SmplWise Arx';
    try {
      window.parent.postMessage({ type: 'arx-wall', state: s }, '*');
    } catch {
      /* no parent */
    }
  }

  private awake(): boolean {
    if (!this.data) return true;
    if (this.now < this.wakeUntil) return true;
    if (wakesDisplay(this.alertsOn(), this.data.config.schedule.wake_on_alert_severity as 'alert' | 'critical')) return true;
    return isAwake(this.data.config.schedule.windows, this.data.zone, new Date(this.now));
  }

  private onPlayer(id: string, e: CustomEvent<{ status?: string }>): void {
    const status = e.detail?.status;
    if (status === 'playing') {
      this.ok.set(id, true);
      this.drop.delete(id);
      this.tries.set(id, 0);
      this.nextTry.delete(id);
    } else if (status === 'error' || status === 'ended') {
      if (this.ok.get(id) !== false) this.drop.set(id, Date.now());
      this.ok.set(id, false);
    }
    this.requestUpdate();
  }

  private pressStart = (): void => {
    window.clearTimeout(this.longPress);
    this.longPress = window.setTimeout(() => {
      this.panel = true;
      window.clearTimeout(this.panelTimer);
      this.panelTimer = window.setTimeout(() => (this.panel = false), 10_000);
    }, 1200);
  };
  private pressEnd = (): void => window.clearTimeout(this.longPress);

  // ---- render
  private clockParts(): { time: string; date: string } {
    const zone = this.data?.zone || 'Asia/Jerusalem';
    const d = new Date(this.now);
    try {
      return {
        time: timeText(d, { timeZone: zone }),
        date: new Intl.DateTimeFormat('he-IL', { timeZone: zone, weekday: 'long', day: 'numeric', month: 'long' }).format(d),
      };
    } catch {
      return { time: d.toTimeString().slice(0, 5), date: '' };
    }
  }

  private hhmmss(ms: number): string {
    return new Date(ms).toTimeString().slice(0, 8);
  }

  protected render() {
    const scale = wallScale(this.env.screenWidth, this.env.screenHeight);
    const s = `--s:${scale}`;
    if (this.phase === 'loading') return html`<div class="center" data-wall-state="loading" style=${s}><span class="mark" data-tone="live"><sw-icon name="camera" size="28"></sw-icon></span><p>טוען…</p></div>`;
    if (this.phase === 'no-connection') return html`<div class="center" data-wall-state="no-connection" style=${s}><span class="mark" data-tone="danger"><sw-icon name="warning" size="28"></sw-icon></span><h1>אין חיבור לשרת</h1><p>מנסה שוב אוטומטית</p></div>`;
    if (this.phase === 'removed') return html`<div class="center" data-wall-state="access-removed" style=${s}><span class="mark"><sw-icon name="lock" size="28"></sw-icon></span><h1>הגישה למסך הזה הוסרה</h1><p>יש להתחבר מחדש עם משתמש מסך קיר</p></div>`;
    if (this.phase === 'remote-refused') return html`<div class="center" data-wall-state="remote-refused" style=${s}><span class="mark"><sw-icon name="lock" size="28"></sw-icon></span><h1>המסך הזה אינו מורשה להתחבר מרחוק</h1><p>יש להתחבר מהרשת המקומית, או לאפשר גישה מרחוק בהגדרות מסכי קיר</p></div>`;
    const data = this.data;
    if (!data) return nothing;
    const cfg = data.config;
    this.setAttribute('data-wall-theme', cfg.theme === 'light' ? 'light' : 'dark');
    const clock = this.clockParts();
    const asleep = !this.awake();
    if (asleep) {
      const [x, y] = [10 + ((this.now / 60000) % 60) * 1.3, 15 + ((this.now / 90000) % 60) * 1.2];
      return html`<div class="wall sleep" data-wall-state="sleep" style=${`${s};display:block`}><div class="bigclock" style=${`inset-inline-start:${x}%;inset-block-start:${y}%`}>${clock.time}${clock.date ? html`<small>${clock.date}</small>` : nothing}</div>${this.renderAnnouncement(true)}</div>`;
    }
    const layout = resolveLayout({ layout: cfg.layout, grid: cfg.grid, cameras: data.cameras.length, viewportW: this.vw, viewportH: this.vh, showMap: cfg.show_map, rotateS: cfg.rotate_s });
    const page = layout.rotateS > 0 ? Math.floor(this.now / (layout.rotateS * 1000)) % layout.pages : 0;
    const shuffle = cfg.burn_in.shuffle_h > 0 && data.cameras.length > 1 && layout.preset !== 'single' ? Math.floor(this.now / (cfg.burn_in.shuffle_h * 3_600_000)) : 0;
    const cams = pageCameras(data.cameras, page, layout.perPage, shuffle);
    const [dx, dy] = pixelShift(this.now, cfg.burn_in.shift);
    const idleMin = (this.now - this.touchedAt) / 60_000;
    const dim = cfg.burn_in.dim_after_min > 0 && idleMin >= cfg.burn_in.dim_after_min;
    const down = serverHealth(this.downSince, this.now);
    if (down === 'clock') {
      const [x, y] = [20 + ((this.now / 60000) % 60) * 0.6, 20 + ((this.now / 90000) % 60) * 0.7];
      return html`<div class="wall sleep" data-wall-state="server-offline-clock" style=${`${s};display:block`}><div class="bigclock" style=${`inset-inline-start:${x}%;inset-block-start:${y}%;opacity:.5`}>${clock.time}${clock.date ? html`<small>${clock.date}</small>` : nothing}</div><div class="banner" style="position:absolute;inset-block-end:var(--pad);inset-inline-start:var(--pad)">אין חיבור למערכת · מנסה שוב</div></div>`;
    }
    const transport = effectiveTransport(this.settings);
    const view = alertView(this.alertsOn(), this.shownAt, this.seenUntil, this.now, cfg.alerts.takeover_timeout_s, this.tap);
    const folded = view.chips.filter((a) => a.severity !== 'info');
    const alertChips = [
      ...this.resolved.map((r) => html`<span class="chip" data-wall-resolved>${r.text}</span>`),
      ...view.chips.filter((a) => a.severity === 'info').map((a) => html`<span class="chip" data-wall-info-chip><i></i>${a.title}${a.place ? ` · ${a.place}` : ''}</span>`),
      ...(folded.length ? [html`<span class="chip" data-tone="danger" data-wall-alert-chip><i></i>התראות · ${folded.length}</span>`] : []),
    ];
    if (this.frameOn() && this.photos.length) return this.renderFrame(data, clock, scale, alertChips);
    const chips = alertChips.concat(cfg.strip.includes('health') ? [this.healthChip()] : []).concat(this.states.map((s) => html`<span class="chip" data-chip=${s.id}>${s.name} <b>${s.state ?? ''}${s.unit ? ` ${s.unit}` : ''}</b></span>`));
    const stripEl = html`<div class="strip" data-wall-strip>
      <span class="place" data-wall-title>${data.title}</span>
      ${cfg.strip.includes('clock')
        ? html`<span class="clock" data-wall-clock @pointerdown=${this.pressStart} @pointerup=${this.pressEnd} @pointerleave=${this.pressEnd} @pointercancel=${this.pressEnd}>${clock.time}${cfg.strip.includes('date') && clock.date ? html`<span class="date">${clock.date}</span>` : nothing}</span>`
        : html`<span style="margin-inline:auto"></span>`}
      <span class="chips">${down === 'banner' ? html`<span class="banner" data-wall-banner>אין חיבור למערכת · מנסה שוב</span>` : chips}</span>
    </div>`;
    return html`<div class=${`wall ${dim ? 'dim' : ''}`} data-wall-state="base" data-preset=${layout.preset} ?data-map=${layout.map} data-wall-class=${classifyDevice(this.env)} style=${`${s};--cols:${layout.cols};--rows:${layout.rows};transform:translate(${dx}px,${dy}px);opacity:${dim ? cfg.burn_in.dim_to : 1}`}>
      ${stripEl}
      ${cams.length || view.tile
        ? html`<div class="grid" data-wall-grid>${view.tile ? this.renderAlertTile(view.tile, view.more, cfg, transport) : nothing}${cams.slice(view.tile ? 1 : 0).map((c) => this.renderTile(c, transport, cfg.offline.show_last_frame_s))}${layout.pages > 1 ? html`<div class="dots" data-wall-dots>${Array.from({ length: layout.pages }, (_, i) => html`<i ?data-on=${i === page}></i>`)}</div>` : nothing}</div>`
        : html`<div class="empty" data-wall-state="no-cameras">לא הוגדרו מצלמות למסך הזה</div>`}
      ${layout.map ? this.renderMapPane() : nothing}
      ${layout.preset === 'tablet-portrait' ? html`<div class="band" data-wall-band>${chips}</div>` : nothing}
      ${view.takeover.length ? this.renderTakeover(view.takeover, data, clock, transport) : nothing}
      ${this.renderAnnouncement()}
      ${this.panel ? this.renderPanel(data) : nothing}
      ${this.chipUpdated ? html`<span class="chip updated" data-wall-updated>ההגדרות עודכנו</span>` : nothing}
    </div>`;
  }

  private ago(a: WallAlert): string {
    const mins = Math.max(0, Math.round((this.now - new Date(a.first_at).getTime()) / 60000));
    const t = new Date(a.last_at);
    let hhmm = '';
    try {
      hhmm = new Intl.DateTimeFormat('he-IL', { timeZone: this.data?.zone || 'Asia/Jerusalem', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).format(t);
    } catch {
      hhmm = t.toTimeString().slice(0, 5);
    }
    return `${mins < 1 ? 'עכשיו' : `${mins} דקות`} · ${hhmm}`;
  }

  private alertCamera(a: WallAlert, transport: ReturnType<typeof effectiveTransport>, name?: string) {
    const cam = a.camera_id ? this.data?.cameras.find((c) => c.id === a.camera_id) : undefined;
    return cam ? html`<sw-camera-tile dark noDemo name=${name ?? cam.name} state="live" live cameraId=${cam.id} profile="sub" transport=${transport}></sw-camera-tile>` : nothing;
  }

  /** Section 5.4: "ראיתי" (local) and, only when the profile allows it, "אישור" with a 1.5 s press-and-hold. */
  private alertButtons(a: WallAlert, ackAllowed: boolean) {
    const p = holdProgress(this.holdStart, this.now);
    return html`<button class="btn" data-wall-seen=${a.id} @click=${() => this.markSeen(a)}><sw-icon name="eye"></sw-icon><span>ראיתי</span></button>
      ${ackAllowed
        ? html`<button class="btn" data-hold data-wall-ack=${a.id} style=${`--hold:${p}`} @pointerdown=${() => this.holdBegin(a)} @pointerup=${this.holdEnd} @pointerleave=${this.holdEnd} @pointercancel=${this.holdEnd}><sw-icon name="check"></sw-icon><span>אישור · החזק</span></button>`
        : html`<span class="note" data-wall-ack-off><sw-icon name="lock" size="14"></sw-icon> אישור מהמסך הזה לא מופעל</span>`}`;
  }

  private renderAlertTile(a: WallAlert, more: number, cfg: WallDisplayConfig['config'], transport: ReturnType<typeof effectiveTransport>) {
    return html`<div class="atile" data-wall-alert-tile=${a.id} data-severity=${a.severity}>
      <div class="head"><span class="icon"><sw-icon name="warning"></sw-icon></span><div><b data-wall-alert-title>${a.title}${a.place ? ` · ${a.place}` : ''}</b><span class="sub">${this.ago(a)}${a.count > 1 ? ` · ×${a.count}` : ''}</span></div>
        ${more > 0 ? html`<span class="more" data-wall-alert-more @click=${() => this.tap++}>+${more}</span>` : nothing}</div>
      <div class="media">${this.alertCamera(a, transport)}</div>
      <div class="foot">${this.alertButtons(a, cfg.alerts.ack_allowed)}</div>
    </div>`;
  }

  private renderTakeover(list: WallAlert[], data: WallDisplayConfig, clock: { time: string; date: string }, transport: ReturnType<typeof effectiveTransport>) {
    const a = list[0];
    return html`<div class="takeover" data-wall-state="takeover" data-wall-takeover=${a.id}>
      <div class="strip"><span class="place"><sw-icon name="warning"></sw-icon> התראה קריטית · ${data.title}</span><span class="clock">${clock.time}</span>${list.length > 1 ? html`<span class="chips"><span class="chip" data-tone="danger" data-wall-takeover-count>${list.length} התראות</span></span>` : nothing}</div>
      <div class="media">${this.alertCamera(a, transport)}
        <div class="titles"><span class="icon"><sw-icon name="warning"></sw-icon></span><div><b data-wall-alert-title>${a.title}</b><span class="sub">${a.place ? `${a.place} · ` : ''}${this.ago(a)}</span></div></div>
      </div>
      ${list.length > 1 ? html`<div class="foot" data-wall-takeover-stack>${list.slice(1, 4).map((x) => html`<span class="chip" data-tone="danger">${x.title}${x.place ? ` · ${x.place}` : ''}</span>`)}</div>` : nothing}
      <div class="foot">${this.alertButtons(a, data.config.alerts.ack_allowed)}</div>
    </div>`;
  }

  private renderFrame(data: WallDisplayConfig, clock: { time: string; date: string }, scale: number, alertChips: unknown[]) {
    const fr = data.config.frame;
    const [dx, dy] = pixelShift(this.now, data.config.burn_in.shift);
    const id = this.photos[this.order[this.frameIdx] ?? 0]?.id ?? this.photos[0].id;
    const idleMin = (this.now - this.touchedAt) / 60_000;
    const dim = data.config.burn_in.dim_after_min > 0 && idleMin >= data.config.burn_in.dim_after_min;
    return html`<div class="frame" data-wall-state="frame" data-motion=${fr.motion} style=${`--s:${scale};opacity:${dim ? data.config.burn_in.dim_to : 1};transform:translate(${dx}px,${dy}px)`}>
      <img data-wall-photo=${id} alt="" src=${frameUrl(id)} style=${`object-fit:${fr.fit}`} />
      ${alertChips.length ? html`<span class="chips" data-wall-frame-chips>${alertChips}</span>` : nothing}
      ${fr.clock ? html`<div class="fclock" data-wall-frame-clock><b>${clock.time}</b><span>${clock.date}${clock.date ? ' · ' : ''}${data.title}</span></div>` : nothing}
      ${this.renderAnnouncement()}
    </div>`;
  }

  /**
   * The map pane of a portrait wall (`cfg.show_map`, wall-logic.ts `Layout.map`): the floor's plan of the wall's profile
   * (CR-029 S5-B, `sw-wall-plan`: live 3D or the baked stills by the screen's own `plan` setting, the idle swap to the still, the
   * wall's theme). A profile with no floor, or a floor still loading, leaves the empty surface in the tile material (no copy, no
   * placeholder art: a wall never explains itself). The element is fetched on demand - a wall without a map never loads it.
   */
  private renderMapPane() {
    const d = this.data;
    if (!d?.floor_id) return html`<div class="pane" data-wall-map-slot aria-hidden="true"></div>`;
    if (!this.planLoaded) {
      this.planLoaded = true;
      void import('./sw-wall-plan');
    }
    return html`<div class="pane" data-wall-map-slot role="img" aria-label="תוכנית הקומה"><sw-wall-plan .floorId=${d.floor_id} .plan=${d.config.plan} .theme=${d.config.theme}></sw-wall-plan></div>`;
  }

  private healthChip() {
    if (this.healthOk === null) return html`<span class="chip" data-tone="stale" data-wall-health><i></i>מצב המערכת</span>`;
    return this.healthOk ? html`<span class="chip" data-tone="live" data-wall-health><i></i>המערכת תקינה</span>` : html`<span class="chip" data-tone="stale" data-wall-health><i></i>יש תקלות</span>`;
  }

  private renderTile(c: { id: string; name: string }, transport: ReturnType<typeof effectiveTransport>, showLastFrameS: number) {
    const ok = this.ok.get(c.id);
    const drop = this.drop.get(c.id) ?? null;
    const health = ok === false ? tileHealth(drop, this.now, 0, showLastFrameS) : 'live';
    return html`<div class="tile" data-wall-tile=${c.id} data-health=${health} @player-status=${(e: CustomEvent<{ status?: string }>) => this.onPlayer(c.id, e)}>
      ${keyed(`${c.id}:${this.epoch.get(c.id) ?? 0}`, html`<sw-camera-tile dark noDemo name=${c.name} state=${health === 'live' ? 'live' : 'stale'} ?live=${health !== 'lost'} cameraId=${c.id} profile="sub" transport=${transport}></sw-camera-tile>`)}
      ${health === 'stale' ? html`<span class="badge" data-wall-badge>אין וידאו${drop ? ` · ${this.hhmmss(drop)}` : ''}</span>` : nothing}
      ${health === 'lost' ? html`<div class="lost" data-wall-lost><b>${c.name}</b><span>אין וידאו</span></div>` : nothing}
    </div>`;
  }

  private renderPanel(data: WallDisplayConfig) {
    const me = session.me;
    const cls = classifyDevice(this.env);
    return html`<div class="panel" data-wall-panel role="status"><dl>
      <dt>משתמש</dt><dd>${me?.user.username ?? ''}</dd>
      <dt>מסך</dt><dd>${data.title}</dd>
      <dt>סוג מכשיר</dt><dd>${cls} · ${this.env.screenWidth}x${this.env.screenHeight}</dd>
      <dt>ערוץ</dt><dd>${me?.channel ?? 'local'}</dd>
      <dt>חיבור</dt><dd>${this.downSince ? 'מנותק' : 'מחובר'}</dd>
      <dt>גרסת הגדרות</dt><dd>${data.version}</dd>
    </dl></div>`;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'sw-wall': SwWall;
  }
}
