import { LitElement, html, css, nothing } from 'lit';
import { leadReserveStyles } from '../styles/lead-reserve';
import { customElement, property, state } from 'lit/decorators.js';
import '../components/sw-button';
import '../components/sw-badge';
import '../components/sw-chip';
import '../components/sw-card';
import '../components/sw-icon';
import '../components/sw-field';
import '../components/sw-state-panel';
import '../components/sw-timeline';
import '../components/sw-case-picker';
import { clipAround, type NewCaseItem } from '../api/cases';
import '../map/sw-plan-canvas';
import type { PlanMarker, MarkerSelectDetail } from '../map/sw-plan-canvas';
import { minuteLabel, secondLabel, type TimelineEvent } from '../components/sw-timeline';
import type { DemoSegment } from '../fixtures/catalog';
import { demoCameras, demoEntities, demoFloors, demoPlan } from '../fixtures/demo';
import { isApi } from '../api/session';
import { bidi } from '../i18n/bidi';
import { navigate } from '../router';
import { describeError } from '../api/client';
import { productSettings } from '../api/prefs';
import { initialLevel } from '../map/studio-ops';
import { loadTree, type CatalogTree } from '../api/catalog';
import { entityName, loadMap, type MapBundle } from '../api/maps';
import { EVENT_LABEL, listEvents, type EventKind, type VmsEvent } from '../api/events';
import { dateInZone, frameUrl, instantInZone, minuteInZone, recordingsForDay, type RecordingsResponse } from '../api/recordings';
import { entityMarkerKind, stateLabel } from '../api/ha';
import { geometryAt, geometryFor } from '../api/geometry';
import type { AnchorPosition, CatalogLookup, GeometryDoc } from '../map/geometry';
import { loadLibrary, lookup3dOf, lookupMaterialsOf, lookupOf } from '../api/plan-catalog';
import { buildScene, type Catalog3DLookup, type SceneAnchor, type SceneDescription } from '../map/scene-builder';
import type { CatalogMaterialLookup } from '../map/material-resolve';
import type { ScenePreset } from '../map/scene-three';
import type { PartSelectDetail, RealisticChangeDetail } from '../map/sw-plan-3d';
import { REPLAY_VIEW, replayStates } from '../map/replay-3d';
import { boundItemOf } from '../map/part-select';
import { zonesWithChips } from '../map/shared-space';
import { WEBGL_UNAVAILABLE_HE, webglAvailable } from '../map/webgl';
import { sameRefs } from '../map/memo';
import { SkinController } from '../design/skin';
import { bubbleChrome } from '../styles/bubble-chrome';
import { INVESTIGATE_R5 } from './investigate-r5-css';
import { dateInputLang, dayTimeText, timeText } from '../api/day-format';
import '../components/sw-history-lanes';
import type { SwTimeline } from '../components/sw-timeline';
import { isFeatureOff, apiErrorCode, isoZ, loadRange, loadSnapshot, type HistoryRange, type HistorySnapshot, type LayerStatus } from '../api/history-scrub';
import {
  LAYER_COLOR, LAYER_IDS, LAYER_NAME, LAYER_STORAGE_KEY, RANGE_LAYERS, SPEEDS, advance, classifyEntity, coverageText, defaultSwitches, drawnStates, gapAt, gapsInWindow,
  laneOf, layerDraws, layerStatusText, parseSwitches, replayFromRange, replayFromSnapshot, roomsKnown, serializeSwitches,
  type EntityLayerId, type FloorReplay, type Lane, type LayerId, type LayerSwitches, type Speed,
} from '../map/history-replay';
import { layerSignature, roomStates, type RoomStateLayer } from '../map/room-state';
import { stateEntitiesOf, stateFactsOf, type StateFacts } from '../map/state-facts';
import { defaultLevelId } from '../map/studio-ops';

const NEAR_MIN = 10;
/** The window choices of the time scrub's bar (minutes); the track below zooms through the same values. */
const SCRUB_WINDOWS: { label: string; minutes: number }[] = [
  { label: 'יום', minutes: 1440 },
  { label: '6 שע׳', minutes: 360 },
  { label: 'שעה', minutes: 60 },
  { label: '10 דק׳', minutes: 10 },
];
/** The elevator states the evaluator records (services/elevators_runtime.py), in the elevators screen's words. */
const ELEVATOR_STATE: Record<string, string> = { ok: 'תקין', fault: 'תקלה', fire_service: 'שירות כבאים', out_of_service: 'מושבת', unknown: 'לא ידוע' };
/** While playing, the plan's states follow the cursor at most this often (CR section 5: cursor debounce 150 ms during play). */
const PLAY_STATE_MS = 150;

function markerKind(t: EventKind): TimelineEvent['kind'] {
  return t === 'person' || t === 'vehicle' || t === 'motion' || t === 'line' || t === 'offline' || t === 'door' ? t : 'motion';
}

/**
 * SC11 / M16 — historical map: the floor at a chosen instant. Cameras show whether a recording covers that
 * instant (blue) or not (dashed "unknown"), HA entities are always "unknown" because no state history is
 * stored yet (never the last live value), events around the instant are listed and the timeline at the
 * bottom scrubs the day. Physical actions are not offered here. Without a backend the demo rendering stays.
 */
@customElement('investigate-history-map')
export class InvestigateHistoryMap extends LitElement {
  /** 0.1.157: the bubble skin's chrome keys on the host's data-skin (styles/bubble-chrome.ts). */
  readonly bubbleSkin = new SkinController(this);
  @property() floorId = 'f0';
  /** Instant to open at (UTC ISO), e.g. an event time; empty = now. */
  @property() at = '';
  /** Camera to preselect. */
  @property() camera = '';
  @state() private minute = 615;
  @state() private tz = 'Asia/Jerusalem';
  @state() private date = '';
  @state() private tree: CatalogTree | null = null;
  @state() private bundle: MapBundle | null = null;
  @state() private events: VmsEvent[] = [];
  @state() private recordings = new Map<string, RecordingsResponse | null>();
  @state() private selectedId: string | null = null;
  @state() private loading = false;
  @state() private error = '';
  /** Instant (UTC ISO) whose frame is shown for the selected camera; updated after the cursor settles. */
  @state() private frameAt = '';
  @state() private frameFailed = false;
  @state() private casePick: NewCaseItem | null = null;
  /** Plan Studio: the structure published at the instant (one plan version can have several structure publishes). */
  @state() private geometry: GeometryDoc | null = null;
  /** `plan.levels` (0.1.89) applied once per floor load: null (all levels) or the floor's default level id. There is
   * no level bar on this screen, so it stays fixed for the floor and only culls the 3D structure (walls, objects,
   * zones) — cameras and entities keep showing on every level (`anchorsEveryLevel`), matching the 2D, which never
   * hid anchors either. */
  @state() private level: string | null = null;
  @state() private catalogLookup: CatalogLookup | null = null;
  /** The loaded plan picture switch (owner request 2026-09-26), a switch of its own like the live map's and the
   * editor's, remembered per floor in this browser. */
  @state() private planImage = true;
  private geomSeq = 0;
  private frameTimer = 0;
  /** T087: the 2D / 3D toggle of the historical map (no actions here, the states are those of the instant). */
  @state() private view3d = false;
  private default3d = false;
  @state() private threeState: 'idle' | 'loading' | 'ready' | 'error' = 'idle';
  @state() private threeError = '';
  /** Kept in a field: the element re-applies a preset only when the property changes (an inline literal would snap the camera every render). */
  @state() private preset3d: ScenePreset = 'iso';
  @state() private catalog3d: Catalog3DLookup | null = null;
  /** ST7HIST: the element draws the realistic level (its `realistic-change`): the description carries the realistic part. */
  @state() private real3d = false;
  private materials3d: CatalogMaterialLookup | null = null;
  /** The bundle reload of the latest settled cursor (an older answer arriving late never replaces a newer one). */
  private bundleSeq = 0;
  private itemNames = new Map<string, string>();
  /** `refs`: what the scene getter reads, by identity (a hit skips the anchor list and its JSON key); `keys`: the signature. */
  private sceneMemo: { refs: unknown[]; keys: unknown[]; desc: SceneDescription; labels: Record<string, string> } | null = null;

  // ---- CR-TIMESCRUB101: the time scrub (setting history.timescrub; off = the screen above, unchanged) ----
  /** The setting is on and the routes answered (a 404 feature_off turns it back off for the visit). */
  @state() private scrub = false;
  @state() private switches: LayerSwitches = defaultSwitches();
  /** The snapshot of the latest settled cursor. */
  @state() private snapshot: HistorySnapshot | null = null;
  @state() private snapLoading = false;
  @state() private snapError = '';
  /** One range for the visible window (lanes + playback); never a request per frame. */
  @state() private range: HistoryRange | null = null;
  @state() private rangeNote = '';
  @state() private mode: 'snapshot' | 'play' = 'snapshot';
  @state() private playing = false;
  @state() private speed: Speed = 1;
  /** The visible window: its length and its left edge in minutes of the chosen day. */
  @state() private winMinutes = 1440;
  @state() private winStart = 0;
  /** Phone: the detail cards as a sheet over the plan. */
  @state() private detailsOpen = false;
  /** While playing: the cursor (ms), and the instant the plan's states are computed for (follows at PLAY_STATE_MS). */
  @state() private playMs = 0;
  @state() private stateMs = 0;
  private rangeMaxDays = 7;
  private snapSeq = 0;
  private rangeSeq = 0;
  private rangeKey = '';
  private rangeTimer = 0;
  private raf = 0;
  private lastFrame = 0;
  private lastStateTick = 0;
  private factsMemo: { geometry: GeometryDoc; w: number; h: number; catalog: CatalogLookup | null; facts: StateFacts } | null = null;
  private replayMemo: { refs: unknown[]; value: FloorReplay | null } | null = null;
  private drawnMemo: { refs: unknown[]; value: { states: Record<string, string | null>; lastChanged: Record<string, string | null> } } | null = null;
  private roomMemo: { refs: unknown[]; value: RoomStateLayer | null } | null = null;
  private snapReplayMemo: { snap: HistorySnapshot; value: FloorReplay } | null = null;

  private onKey = (e: KeyboardEvent) => {
    const t = e.composedPath()[0];
    const typing = t instanceof HTMLElement && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.tagName === 'SELECT' || t.isContentEditable);
    if (this.scrub && !typing && !e.ctrlKey && !e.metaKey && !e.altKey && this.onScrubKey(e, t)) return;
    if (e.key === '3' && !e.ctrlKey && !e.metaKey && !e.altKey && !typing) {
      e.preventDefault();
      if (e.repeat) return; // a held key flips the view once, as on the live map
      void this.toggle3d();
    }
  };

  static styles = [leadReserveStyles, css`
    :host {
      display: flex;
      flex-direction: column;
      min-block-size: 100%;
    }
    .head {
      display: flex;
      flex-wrap: wrap;
      align-items: center;
      gap: 10px;
      padding: 14px 24px 12px;
    }
    /* the header dropdown's lead reserve (styles/lead-reserve.ts) is ADDED to the row's own 24 px start padding, never in its place */
    .head.lead-head {
      padding-inline-start: calc(24px + var(--sw-lead-reserve, 0px));
    }
    h1 {
      margin: 0;
      font-size: var(--sw-fs-2xl);
      font-weight: var(--sw-fw-semibold);
    }
    .sub {
      font-size: var(--sw-fs-sm);
      color: var(--sw-text-3);
      margin-block-start: 2px;
    }
    .grow {
      flex: 1;
    }
    /* R5 assembly (owner decision 2026-10-28, option a): the time bar is the MAPS look - these are the pre-R5 base rules, and the
       R5-MAPS-297 block further down turns them into the recorded-tone status field with the 26 px recorded-tone time */
    .bar {
      display: flex;
      align-items: center;
      gap: 10px;
      margin: 0 24px 10px;
      padding: 8px 12px;
      background: var(--sw-recorded-soft);
      border: 1px solid #cddcff;
      border-radius: var(--sw-r-md);
      font-size: var(--sw-fs-sm);
      flex-wrap: wrap;
    }
    .time {
      font-family: var(--sw-font-mono);
      direction: ltr;
      font-weight: var(--sw-fw-semibold);
      color: var(--sw-accent-text);
    }
    input[type='range'] {
      inline-size: 260px;
      direction: ltr;
      accent-color: var(--sw-accent);
    }
    .layout {
      display: grid;
      grid-template-columns: minmax(0, 1fr) 320px;
      gap: 14px;
      margin: 0 24px 12px;
      align-items: start;
    }
    .stage {
      position: relative;
      block-size: 540px;
      border: 1px solid var(--sw-border);
      border-radius: var(--sw-r-lg);
      background: var(--sw-surface);
      box-shadow: var(--sw-shadow-1);
      overflow: hidden;
    }
    .stage.alone {
      block-size: auto;
      min-block-size: 480px;
      flex: 1;
      margin: 0 24px 24px;
    }
    .stage sw-plan-canvas {
      block-size: 100%;
    }
    .legend {
      position: absolute;
      inset-inline-start: 12px;
      inset-block-end: 12px;
      z-index: var(--sw-z-map-ui);
      display: flex;
      gap: 12px;
      /* the HUD panels over the plan are opaque (owner 2026-10-13, styles/menu-surface.ts): the legend was a white 92 % pill with the dark scheme's light ink on it */
      background: var(--sw-menu-surface);
      border: 1px solid var(--sw-border-strong);
      border-radius: var(--sw-r-pill);
      padding: 3px 10px;
      font-size: var(--sw-fs-xs);
      color: var(--sw-text-2);
    }
    .chip {
      position: absolute;
      inset-inline-start: 12px;
      inset-block-start: 12px;
      z-index: var(--sw-z-map-ui);
      background: var(--sw-menu-surface);
      border: 1px solid var(--sw-border-strong);
      border-radius: var(--sw-r-md);
      padding: 5px 10px;
      font-size: var(--sw-fs-sm);
      font-weight: var(--sw-fw-semibold);
      display: inline-flex;
      gap: 6px;
      align-items: center;
    }
    .hist {
      position: absolute;
      inset-inline-end: 12px;
      inset-block-start: 12px;
      z-index: var(--sw-z-map-ui);
      /* the "historical state" tag: the opaque surface with a purple hairline and the body ink (purple text on a fixed lavender fill read at 2.4:1 in the dark scheme) */
      background: var(--sw-menu-surface);
      border: 1px solid var(--sw-purple);
      color: var(--sw-text);
      border-radius: var(--sw-r-md);
      padding: 3px 9px; /* 4 / 10 minus the hairline: the tag keeps its size */
      font-size: var(--sw-fs-xs);
      font-weight: var(--sw-fw-semibold);
    }
    .hist.below {
      inset-block-start: 44px;
    }
    .panel {
      display: flex;
      flex-direction: column;
      gap: 12px;
      min-inline-size: 0;
    }
    dl {
      display: grid;
      grid-template-columns: auto 1fr;
      gap: 6px 12px;
      margin: 0;
      font-size: var(--sw-fs-sm);
      align-items: center;
    }
    dt {
      color: var(--sw-text-3);
      font-size: var(--sw-fs-xs);
    }
    dd {
      margin: 0;
      font-weight: var(--sw-fw-semibold);
      font-size: var(--sw-fs-md);
      color: var(--sw-heading);
      min-inline-size: 0;
      overflow-wrap: anywhere;
    }
    .evl {
      display: flex;
      flex-direction: column;
      gap: 4px;
    }
    .evl a {
      display: grid;
      grid-template-columns: 1fr auto;
      align-items: center;
      gap: 8px;
      min-block-size: 42px;
      padding: 7px 12px;
      background: var(--sw-surface-2);
      border-radius: var(--sw-r-sm);
      text-decoration: none;
      color: var(--sw-heading);
      font-size: var(--sw-fs-md);
      font-weight: var(--sw-fw-semibold);
      transition: transform var(--sw-t-press) var(--sw-ease-out);
    }
    .evl a:active {
      transform: scale(var(--sw-press-scale));
    }
    .evl a.hit {
      border-color: var(--sw-accent);
      background: var(--sw-accent-soft);
    }
    .evl .s {
      font-size: var(--sw-fs-xs);
      color: var(--sw-text-3);
    }
    .ltr {
      direction: ltr;
      unicode-bidi: isolate;
      font-family: var(--sw-font-mono);
    }
    .note {
      font-size: var(--sw-fs-xs);
      color: var(--sw-text-3);
    }
    .frame {
      margin-block-start: 8px;
      border-radius: var(--sw-r-sm);
      overflow: hidden;
      background: var(--sw-surface-3);
      aspect-ratio: 16 / 9;
      display: grid;
      place-items: center;
      font-size: var(--sw-fs-xs);
      color: var(--sw-text-3);
    }
    .frame img {
      inline-size: 100%;
      block-size: 100%;
      object-fit: cover;
      display: block;
    }
    .tl {
      margin: 0 24px 24px;
    }
    .tl sw-field {
      inline-size: 160px;
    }
    .tlbar {
      display: flex;
      align-items: center;
      gap: 10px;
      flex-wrap: wrap;
      margin-block-end: 6px;
      font-size: var(--sw-fs-sm);
      color: var(--sw-text-2);
    }
    @media (max-width: 900px) {
      .layout {
        grid-template-columns: 1fr;
      }
    }
    /* R5-MAPS-297 (impeccable bolder, HOMEFABLE pattern): a 26/700 title; the time bar is the status field of the screen (the recorded
       tone with its own hairline from the token - the fixed #cddcff was a light line on the dark scheme) and the chosen time its display
       digit (20/700, tabular, interface face); the plan is the hero (shadow 2); the event rows are wells and the one at the chosen time a
       filled accent field; press feedback on the rows; hover only with a fine pointer. */
    h1 {
      font-size: var(--sw-fs-3xl);
      font-weight: var(--sw-fw-bold);
      color: var(--sw-heading);
      letter-spacing: -0.02em;
    }
    .sub {
      font-weight: var(--sw-fw-medium);
      color: var(--sw-text-2);
    }
    .bar {
      padding: 12px 16px;
      border-color: var(--sw-recorded);
      box-shadow: var(--sw-shadow-2);
      font-weight: var(--sw-fw-medium);
      border-radius: var(--sw-r-lg);
    }
    .time {
      font-family: inherit;
      font-size: var(--sw-fs-3xl); /* loop 2: the chosen time is the display digit of this screen */
      font-weight: var(--sw-fw-bold);
      font-variant-numeric: tabular-nums;
      letter-spacing: -0.02em;
      line-height: 1.1;
      color: var(--sw-recorded-text);
    }
    .stage {
      box-shadow: var(--sw-shadow-2);
      --sw-map-bg: var(--sw-surface-3); /* loop 2: the ground a tone step down, the plan floats */
      border-color: transparent;
    }
    .chip {
      font-size: var(--sw-fs-md);
      font-weight: var(--sw-fw-bold);
      background: var(--sw-menu-surface); /* a HUD panel keeps the opaque menu surface (unit-menu-lint): weight from the accent edge + ink */
      border: 2px solid var(--sw-accent);
      color: var(--sw-accent-text);
      box-shadow: var(--sw-shadow-2);
    }
    .chip sw-icon {
      color: inherit;
    }
    .hist {
      background: color-mix(in srgb, var(--sw-purple) 14%, var(--sw-menu-surface));
      font-weight: var(--sw-fw-bold);
    }
    .legend {
      color: var(--sw-text);
      font-weight: var(--sw-fw-medium);
    }
    dd {
      font-weight: var(--sw-fw-semibold);
      color: var(--sw-heading);
    }
    dt {
      color: var(--sw-text-2);
    }
    .evl a {
      background: var(--sw-surface-2);
      border-color: transparent;
      transition: background var(--sw-t-hover) var(--sw-ease-color), border-color var(--sw-t-hover) var(--sw-ease-color), transform var(--sw-t-press) var(--sw-ease);
      -webkit-tap-highlight-color: transparent;
      touch-action: manipulation;
    }
    .evl a:active {
      transform: scale(var(--sw-press-scale));
    }
    .evl a.hit {
      background: var(--sw-accent-soft);
      border-color: var(--sw-accent);
      font-weight: var(--sw-fw-semibold);
    }
    .evl .s {
      color: var(--sw-text-2);
    }
    .tlbar {
      font-weight: var(--sw-fw-medium);
    }
    @media (max-width: 767px) {
      .head,
      .bar,
      .tl {
        margin-inline: 12px;
        padding-inline: 12px;
      }
      .head,
      .head.lead-head {
        padding-inline: 0;
      }
      .layout {
        margin-inline: 0;
      }
      .stage {
        border-radius: 0;
      }
      .legend {
        display: none;
      }
    }

    /* ===== CR-TIMESCRUB101 (owner layout rule 2026-10-24): the screen is a fixed-height column and NEVER scrolls - compact
       head, one-line status bar, the plan + panel area takes all the height left (the plan fills it), the timeline bar is
       pinned to the bottom; only the side panel scrolls, inside itself ===== */
    :host([data-scrub]) {
      block-size: 100%;
      min-block-size: 0;
      overflow: hidden;
    }
    :host([data-scrub]) .head {
      flex: none;
      gap: 8px 10px;
      padding-block: 8px 6px;
    }
    :host([data-scrub]) h1 {
      font-size: var(--sw-fs-xl);
      line-height: 1.25;
    }
    :host([data-scrub]) .sub {
      font-size: var(--sw-fs-xs);
      margin-block-start: 0;
    }
    .acts-h {
      display: flex;
      gap: 6px;
      align-items: center;
    }
    .details-btn,
    .sheet-hd {
      display: none;
    }
    :host([data-scrub]) .bar {
      flex: none;
      flex-wrap: nowrap;
      padding-block: 5px;
      margin-block-end: 8px;
      min-block-size: 34px;
      box-sizing: border-box;
    }
    :host([data-scrub]) .bar > span:not(.pill) {
      min-inline-size: 0;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }
    .pill {
      display: inline-flex;
      align-items: center;
      gap: 5px;
      flex: none;
      border-radius: var(--sw-r-pill);
      padding: 2px 9px;
      font-size: var(--sw-fs-xs);
      font-weight: var(--sw-fw-medium);
      white-space: nowrap;
      background: var(--sw-surface);
      color: var(--sw-recorded-text);
      border: 1px solid color-mix(in srgb, var(--sw-recorded) 35%, transparent);
    }
    .pill.warn {
      color: var(--sw-warning-text);
      background: var(--sw-warning-soft);
      border-color: color-mix(in srgb, var(--sw-warning) 45%, transparent);
    }
    .layout.ts {
      grid-template-rows: minmax(0, 1fr);
      gap: 12px;
      margin-block-end: 10px;
      align-items: stretch;
      flex: 1;
      min-block-size: 0;
      position: relative;
    }
    .layout.ts .stage {
      block-size: auto;
      min-block-size: 0;
    }
    .hist.gap {
      border-color: var(--sw-warning);
    }
    .layout.ts .panel {
      gap: 10px;
      min-block-size: 0;
      overflow-y: auto;
      overscroll-behavior: contain;
      scrollbar-width: thin;
      padding-inline-end: 2px;
    }
    .details {
      display: contents;
    }
    .cover {
      position: absolute;
      inset: 0;
      z-index: var(--sw-z-map-ui);
      display: flex;
      align-items: center;
      justify-content: center;
      padding: 24px;
      /* no scrim: the plan stays readable around the (opaque) state panel */
    }
    .cover sw-state-panel {
      max-inline-size: 420px;
      background: var(--sw-surface-solid, var(--sw-surface));
      border: 1px solid var(--sw-border);
      border-radius: var(--sw-r-lg);
      box-shadow: var(--sw-shadow-2);
    }
    .gapbar {
      position: absolute;
      inset-inline: 12px;
      inset-block-end: 48px;
      z-index: var(--sw-z-map-ui);
      display: flex;
      align-items: center;
      gap: 8px;
      padding: 6px 10px;
      border-radius: var(--sw-r-md);
      /* a HUD panel over the plan: the opaque surface with the warning hairline (styles/menu-surface.ts) */
      background: var(--sw-menu-surface);
      border: 1px solid var(--sw-warning);
      color: var(--sw-warning-text);
      font-size: var(--sw-fs-xs);
      font-weight: var(--sw-fw-semibold);
    }
    .lcard {
      background: var(--sw-surface);
      border: 1px solid var(--sw-border);
      border-radius: var(--sw-r-md);
      padding: 12px 14px;
      box-shadow: var(--sw-shadow-1);
      min-inline-size: 0;
    }
    .lhd {
      display: flex;
      align-items: center;
      gap: 8px;
      margin-block-end: 8px;
    }
    .lhd h2 {
      margin: 0;
      font-size: var(--sw-fs-md);
      font-weight: var(--sw-fw-semibold);
    }
    .lhd .grow {
      flex: 1;
    }
    .layers {
      display: flex;
      flex-direction: column;
      gap: 2px;
    }
    .lyr {
      display: grid;
      grid-template-columns: auto 1fr auto;
      align-items: center;
      gap: 8px;
      padding: 5px 6px;
      border-radius: var(--sw-r-sm);
      font-size: var(--sw-fs-sm);
      min-block-size: 34px;
      box-sizing: border-box;
    }
    /* R5-INVESTIGATE-297 loop 2: hover only under a fine pointer */
    @media (hover: hover) and (pointer: fine) {
      .lyr:hover {
        background: var(--sw-hover-wash);
      }
    }
    .lyr .sw {
      position: relative;
      inline-size: 30px;
      block-size: 18px;
      border-radius: var(--sw-r-pill);
      background: var(--sw-unknown);
      border: 0;
      cursor: pointer;
      flex: none;
      padding: 0;
      transition: background var(--sw-t-fast) var(--sw-ease);
    }
    .lyr .sw::after {
      content: '';
      position: absolute;
      inset-block-start: 2px;
      inset-inline-start: 2px;
      inline-size: 14px;
      block-size: 14px;
      border-radius: 50%;
      background: #fff;
      box-shadow: 0 1px 3px rgba(0, 0, 0, 0.18);
      transition: transform var(--sw-t-fast) var(--sw-ease);
    }
    .lyr .sw[aria-checked='true'] {
      background: var(--sw-accent);
    }
    .lyr .sw[aria-checked='true']::after {
      transform: translateX(-12px);
    }
    .lyr .sw:disabled {
      opacity: var(--sw-disabled-opacity, 0.5);
      cursor: default;
    }
    .lyr .sw:focus-visible {
      outline: var(--sw-focus-w, 2px) solid var(--sw-focus);
      outline-offset: 2px;
    }
    .lyr .nm {
      display: flex;
      align-items: center;
      gap: 7px;
      min-inline-size: 0;
    }
    .lyr .nm i {
      inline-size: 9px;
      block-size: 9px;
      border-radius: 50%;
      background: var(--c, var(--sw-accent));
      flex: none;
    }
    .lyr .cov {
      font-size: var(--sw-fs-xs);
      color: var(--sw-text-3);
      white-space: nowrap;
    }
    .lyr[data-off='true'] .nm {
      color: var(--sw-text-3);
    }
    .lyr .st {
      font-size: var(--sw-fs-xs);
      white-space: nowrap;
      display: inline-flex;
      align-items: center;
      gap: 3px;
    }
    .st[data-look='ok'] {
      color: var(--sw-success-text);
    }
    .st[data-look='unk'] {
      color: var(--sw-unknown-text);
    }
    .st[data-look='warn'] {
      color: var(--sw-warning-text);
    }
    .st[data-look='lock'] {
      color: var(--sw-forbidden-text);
    }
    .elev {
      display: flex;
      flex-wrap: wrap;
      gap: 4px;
    }
    .acts {
      display: flex;
      gap: 8px;
      flex-wrap: wrap;
      margin-block-start: 10px;
    }
    /* the timeline bar pinned to the bottom (never scrolled to; sticky is belt-and-braces) */
    .tlx {
      flex: none;
      position: sticky;
      inset-block-end: 0;
      z-index: var(--sw-z-map-ui);
      padding: 6px 24px 10px;
      background: var(--sw-bg);
      border-block-start: 1px solid var(--sw-border);
    }
    .tlrow {
      display: flex;
      align-items: center;
      gap: 8px;
      flex-wrap: nowrap;
      overflow: hidden;
      margin-block-end: 6px;
      font-size: var(--sw-fs-sm);
      color: var(--sw-text-2);
      min-block-size: 36px;
    }
    .tlrow > * {
      flex: none;
    }
    .tlrow .grow {
      flex: 1;
    }
    .tlrow .time {
      font-size: var(--sw-fs-md);
    }
    .tlrow sw-field {
      inline-size: 150px;
    }
    .seg {
      display: inline-flex;
      padding: 3px;
      gap: 2px;
      background: var(--sw-surface-3);
      border-radius: var(--sw-r-sm);
    }
    .seg button {
      padding: 3px 10px;
      border-radius: calc(var(--sw-r-sm) - 2px);
      color: var(--sw-text-2);
      cursor: pointer;
      font: inherit;
      font-size: var(--sw-fs-xs);
      white-space: nowrap;
      border: 0;
      background: transparent;
      min-block-size: 24px;
    }
    .seg button[aria-pressed='true'] {
      background: var(--sw-surface-solid, var(--sw-surface));
      color: var(--sw-text);
      font-weight: var(--sw-fw-semibold);
      box-shadow: var(--sw-shadow-1);
    }
    .play {
      display: inline-grid;
      place-items: center;
      inline-size: 36px;
      block-size: 36px;
      border-radius: 50%;
      border: 0;
      background: var(--sw-accent);
      color: var(--sw-text-inverse);
      cursor: pointer;
      box-shadow: var(--sw-shadow-primary, none);
      font: inherit;
    }
    @media (hover: hover) and (pointer: fine) {
      .play:hover {
        background: var(--sw-accent-hover, var(--sw-accent));
      }
    }
    .play:active {
      transform: scale(var(--sw-press-scale));
    }
    .kbd {
      font-family: var(--sw-font-mono);
      font-size: var(--sw-fs-2xs);
      border: 1px solid var(--sw-border-strong);
      border-radius: var(--sw-r-2xs, 4px);
      padding: 0 4px;
      color: var(--sw-text-3);
    }
    .track {
      position: relative;
      direction: ltr;
      background: var(--sw-surface);
      border: 1px solid var(--sw-border);
      border-radius: var(--sw-r-lg);
      box-shadow: var(--sw-shadow-1);
      padding: 6px 10px 2px;
      --sw-lanes-label-w: 92px;
    }
    .track .tlwrap {
      margin-left: calc(var(--sw-lanes-label-w) + 8px);
      margin-block-start: 4px;
    }
    .track .rangenote {
      direction: rtl;
      font-size: var(--sw-fs-xs);
      color: var(--sw-warning-text);
      padding-block-end: 2px;
    }
    @media (prefers-reduced-motion: reduce) {
      .lyr .sw,
      .lyr .sw::after {
        transition: none;
      }
    }
    /* tablet: the two columns stay (the panel narrows and scrolls) so nothing drops below the timeline; one control row
       stays one row - the hour steps, the date and the key hints leave it */
    @media (max-width: 1023px) {
      :host([data-scrub]) .head,
      :host([data-scrub]) .bar,
      .layout.ts {
        margin-inline: 16px;
      }
      :host([data-scrub]) .head,
      :host([data-scrub]) .head.lead-head {
        padding-inline: 0 0;
        padding-inline-start: var(--sw-lead-reserve, 0px);
      }
      .layout.ts {
        grid-template-columns: minmax(0, 1fr) 272px;
        gap: 10px;
      }
      .tlx {
        padding-inline: 16px;
      }
      .tlrow .keys,
      .tlrow .dateq,
      .tlrow [data-step='-60'],
      .tlrow [data-step='60'] {
        display: none;
      }
    }
    /* phone: the layer chips row above the plan, the plan fills the height between them and the pinned timeline, the
       detail cards open as a sheet over the plan ("פרטים") */
    @media (max-width: 767px) {
      :host([data-scrub]) .head,
      :host([data-scrub]) .head.lead-head {
        margin-inline: 0;
        padding: 6px 12px 4px;
        padding-inline-start: calc(12px + var(--sw-lead-reserve, 0px));
        flex-wrap: nowrap;
        gap: 8px;
      }
      :host([data-scrub]) h1 {
        font-size: var(--sw-fs-md);
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
      }
      :host([data-scrub]) .head > div:first-child {
        min-inline-size: 0;
      }
      :host([data-scrub]) .sub {
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
      }
      .acts-h {
        flex: none;
        gap: 4px;
      }
      .acts-h sw-field,
      .acts-h .note,
      .acts-h .lbl {
        display: none;
      }
      .details-btn {
        display: inline-flex;
      }
      :host([data-scrub]) .bar {
        display: none;
      }
      .layout.ts {
        margin: 0;
        gap: 0;
        grid-template-columns: minmax(0, 1fr);
        grid-template-rows: auto minmax(0, 1fr);
      }
      .layout.ts .stage {
        order: 2;
        border-radius: 0;
        border-inline: 0;
      }
      .layout.ts .panel {
        order: 1;
        overflow: visible;
        padding: 0 12px 6px;
        gap: 0;
      }
      .layers {
        flex-direction: row;
        overflow-x: auto;
        scrollbar-width: none;
        gap: 6px;
        padding-block-end: 2px;
      }
      .lcard {
        padding: 0;
        border: 0;
        background: transparent;
        box-shadow: none;
      }
      .lcard .lhd {
        display: none;
      }
      .lyr {
        grid-template-columns: auto auto;
        flex: none;
        border: 1px solid var(--sw-border);
        border-radius: var(--sw-r-pill);
        padding: 3px 10px 3px 6px;
        background: var(--sw-surface);
      }
      .lyr .cov,
      .lyr .st {
        display: none;
      }
      .lyr .sw {
        inline-size: 26px;
        block-size: 16px;
      }
      .lyr .sw::after {
        inline-size: 12px;
        block-size: 12px;
      }
      .lyr .sw[aria-checked='true']::after {
        transform: translateX(-10px);
      }
      .details {
        display: none;
        position: absolute;
        inset: 0;
        z-index: 8;
        background: var(--sw-bg);
        overflow-y: auto;
        overscroll-behavior: contain;
        padding: 10px 12px 12px;
        flex-direction: column;
        gap: 10px;
      }
      .details.open {
        display: flex;
      }
      .sheet-hd {
        display: flex;
        align-items: center;
        gap: 8px;
        font-size: var(--sw-fs-md);
        font-weight: var(--sw-fw-semibold);
      }
      .sheet-hd .grow {
        flex: 1;
      }
      .gapbar {
        inset-block-end: 10px;
      }
      .tlx {
        padding: 6px 12px 8px;
      }
      .tlrow {
        gap: 6px;
        min-block-size: 40px;
        margin-block-end: 4px;
      }
      .tlrow .win,
      .tlrow .speed {
        display: none;
      }
      .tlrow .time {
        font-size: var(--sw-fs-sm);
      }
      .track {
        --sw-lanes-label-w: 58px;
        --sw-lane-h: 8px;
        --sw-tl-h: 44px;
        padding: 4px 8px 0;
      }
    }
  `, bubbleChrome, INVESTIGATE_R5];

  connectedCallback() {
    super.connectedCallback();
    window.addEventListener('keydown', this.onKey);
    if (isApi()) void this.init();
  }

  disconnectedCallback() {
    super.disconnectedCallback();
    window.removeEventListener('keydown', this.onKey);
    this.stopPlay(false);
    window.clearTimeout(this.rangeTimer);
    window.clearTimeout(this.frameTimer);
  }

  protected willUpdate(changed: Map<string, unknown>) {
    // the fixed-height layout of the time scrub keys on the host (flag off: no attribute, today's scrolling page)
    if (changed.has('scrub')) this.toggleAttribute('data-scrub', this.scrub);
  }

  protected updated(changed: Map<string, unknown>) {
    if (!isApi()) return;
    // the setting map.default_view (owner 2026-09-29): a floor opens in 3D once its scene is there (no per-device memory
    // of the last view existed before, and none is added: the toggle still switches for the visit)
    if (this.default3d && !this.view3d && this.hasScene && webglAvailable()) {
      this.default3d = false;
      void this.toggle3d();
    }
    if ((changed.has('floorId') && changed.get('floorId') !== undefined) || (changed.has('at') && changed.get('at') !== undefined)) void this.init();
  }

  // ---- data ----

  private async init() {
    this.loading = true;
    this.error = '';
    try {
      const [settings, tree] = await Promise.all([productSettings(), this.tree ? Promise.resolve(this.tree) : loadTree()]);
      this.tz = settings['time.zone'] ?? this.tz;
      this.tree = tree;
      // CR-TIMESCRUB101: the flag (default off = today's screen unchanged) and the cap of one range request
      this.scrub = String(settings['history.timescrub'] ?? 'false') === 'true';
      const maxDays = Number(settings['history.range_max_days'] ?? 7);
      this.rangeMaxDays = Number.isFinite(maxDays) ? Math.max(1, Math.min(30, maxDays)) : 7;
      if (this.scrub) this.restoreSwitches();
      this.stopPlay(false);
      this.snapshot = null;
      this.snapError = '';
      this.range = null;
      this.rangeKey = '';
      this.rangeNote = '';
      // the navigation links the generic 'f0': with a backend, land on the first real floor (3.11)
      if (isApi() && this.floors.length && !this.floors.some((f) => f.id === this.floorId)) {
        const q = new URLSearchParams(window.location.hash.split('?')[1] ?? '').toString();
        window.location.replace(`#/investigate/floors/${this.floors[0].id}/history${q ? `?${q}` : ''}`);
        return;
      }
      const start = this.at ? new Date(this.at) : new Date();
      this.date = dateInZone(start, this.tz);
      this.minute = minuteInZone(start, this.tz);
      this.bundle = await loadMap(this.floorId, false, this.instant.toISOString().replace(/\.\d{3}Z$/, 'Z'));
      this.restorePlanImage();
      this.level = initialLevel(settings['plan.levels'], this.bundle); // 0.1.89: fixed for the floor, no level bar here
      this.default3d = settings['map.default_view'] === '3d' && !this.view3d;
      this.geometry = null; // another floor or instant: no structure until its document arrives
      if (this.bundle.source === 'api') {
        void loadLibrary(this.bundle.catalogRevision).then((lib) => {
          this.catalogLookup = lookupOf(lib);
          this.catalog3d = lookup3dOf(lib);
          this.materials3d = lookupMaterialsOf(lib);
          this.itemNames = new Map(lib.items.map((i) => [i.id, i.names.he]));
        }).catch(() => {}); // without the library objects draw as plain boxes
      }
      void this.updateGeometry();
      this.scheduleFrame();
      if (this.scrub) {
        this.fitWindow(true);
        void this.fetchSnapshot();
        this.scheduleRange(0);
      }
      if (this.camera) {
        const a = this.bundle.anchors.find((x) => x.resource_type === 'camera' && x.resource_id === this.camera);
        this.selectedId = a?.id ?? null;
        if (a) this.preset3d = { camera: `cam:${a.id}` }; // the event page hands its camera over: the 3D opens from it
      }
      await this.loadDay();
    } catch (err) {
      this.error = describeError(err);
    } finally {
      this.loading = false;
    }
  }

  /** The plan picture switch, per floor in this browser (its own key: the live map and the editor keep theirs). */
  private setPlanImage(on: boolean) {
    this.planImage = on;
    try {
      localStorage.setItem(`sw.history.background.${this.floorId}`, on ? '1' : '0');
    } catch {
      /* private mode or blocked storage: the choice lives for this page only */
    }
  }

  /** A floor never switched shows its picture. */
  private restorePlanImage() {
    try {
      this.planImage = localStorage.getItem(`sw.history.background.${this.floorId}`) !== '0';
    } catch {
      this.planImage = true;
    }
  }

  private async loadDay() {
    const b = this.bundle;
    if (!b) return;
    const camIds = b.anchors.filter((a) => a.resource_type === 'camera').map((a) => a.resource_id);
    const [ev, recs] = await Promise.all([
      listEvents({ date: this.date, limit: 1000 }).then((r) => r.events.filter((e) => e.camera_id && camIds.includes(e.camera_id))).catch(() => [] as VmsEvent[]),
      Promise.allSettled(camIds.map((id) => recordingsForDay(id, this.date))),
    ]);
    this.events = ev;
    const m = new Map<string, RecordingsResponse | null>();
    camIds.forEach((id, i) => {
      const r = recs[i];
      m.set(id, r.status === 'fulfilled' ? r.value : null);
    });
    this.recordings = m;
  }

  private get instant(): Date {
    return instantInZone(this.date, this.minute, this.tz);
  }

  /** Whole-day minutes of a recording segment list for one camera (null = search failed / unknown). */
  private segmentsFor(cameraId: string): DemoSegment[] | null {
    const r = this.recordings.get(cameraId);
    if (!r) return null;
    return r.segments.map((s) => {
      const a = minuteInZone(new Date(s.start_at), this.tz);
      let bMin = minuteInZone(new Date(s.end_at), this.tz);
      if (bMin < a) bMin = 1440;
      return { startMin: a, endMin: bMin, kind: s.kind === 'continuous' ? 'continuous' : 'motion' };
    });
  }

  private coverageAt(cameraId: string): { state: 'historic' | 'unknown'; segment?: DemoSegment } {
    const segs = this.segmentsFor(cameraId);
    if (!segs) return { state: 'unknown' };
    const seg = segs.find((s) => this.minute >= s.startMin && this.minute <= s.endMin);
    return seg ? { state: 'historic', segment: seg } : { state: 'unknown' };
  }

  private eventsNear(cameraId?: string, minutes = NEAR_MIN): VmsEvent[] {
    const t = this.instant.getTime();
    return this.events
      .filter((e) => (!cameraId || e.camera_id === cameraId) && Math.abs(new Date(e.occurred_at).getTime() - t) <= minutes * 60 * 1000)
      .sort((a, b) => Math.abs(new Date(a.occurred_at).getTime() - t) - Math.abs(new Date(b.occurred_at).getTime() - t));
  }

  private get apiMarkers(): PlanMarker[] {
    const b = this.bundle;
    if (!b) return [];
    return b.anchors.map((a) => {
      if (a.resource_type === 'camera') {
        const cov = this.coverageAt(a.resource_id);
        const near = this.eventsNear(a.resource_id, 5).length;
        const name = a.camera?.name ?? a.label ?? a.resource_id;
        return { id: a.id, kind: 'camera' as const, label: near ? `${name} · ${near} אירועים` : name, x: a.position.x, y: a.position.y, rotation: a.rotation_degrees, fov: a.field_of_view_degrees ?? undefined, radius: a.coverage_radius ?? undefined, polygon: a.coverage_polygon ? a.coverage_polygon.map(([x, y]) => ({ x, y })) : undefined, labelPos: a.label_pos ?? undefined, level: a.level_id ?? null, state: cov.state };
      }
      const sa = a.entity?.state_at;
      const name = entityName(a);
      return { id: a.id, kind: entityMarkerKind(a.layer_id, a.entity?.domain), label: sa?.known && sa.state ? `${name} · ${stateLabel({ ...(a.entity ?? { domain: '', unit: null, device_class: null, attributes: {} }), state: sa.state })}` : name, x: a.position.x, y: a.position.y, state: sa?.known ? ('historic' as const) : ('unknown' as const) };
    });
  }

  private get selectedAnchor() {
    return this.bundle?.anchors.find((a) => a.id === this.selectedId) ?? null;
  }

  private get limitMinute(): number {
    return this.date === dateInZone(new Date(), this.tz) ? minuteInZone(new Date(), this.tz) : 1440;
  }

  setMinute(m: number) {
    this.minute = Math.max(0, Math.min(this.limitMinute, m));
    if (this.scrub) {
      if (this.playing) {
        // a seek while playing moves the play head and keeps playing
        this.playMs = this.instant.getTime();
        this.stateMs = this.playMs;
      }
      this.fitWindow(false);
    }
    this.scheduleFrame();
  }

  /** The recording frame follows the cursor once it settles (a grab takes a few seconds; hovering must not flood). */
  private scheduleFrame() {
    window.clearTimeout(this.frameTimer);
    this.frameTimer = window.setTimeout(() => {
      this.frameAt = this.instant.toISOString().replace(/\.\d{3}Z$/, 'Z');
      this.frameFailed = false;
      void this.ensureVersion();
      if (this.scrub && !this.playing) void this.fetchSnapshot(); // the settled cursor's snapshot (the bundleSeq pattern)
    }, 600);
  }

  /** The structure follows the cursor like the anchors do; the timeline and the documents are cached, so moving is cheap. */
  private async updateGeometry() {
    const b = this.bundle;
    const seq = ++this.geomSeq;
    if (!b || b.source !== 'api' || !b.planVersionId) {
      this.geometry = null;
      return;
    }
    const t = this.instant.toISOString().replace(/\.\d{3}Z$/, 'Z');
    const g = b.history === 'exact' ? await geometryAt(b.planVersionId, t) : await geometryFor(b);
    if (seq === this.geomSeq) this.geometry = g;
  }

  /** The plan version, the anchors and the device states follow the instant (T038; ST7HIST): every settled cursor reloads the
   * bundle at its instant - the anchors carry the states of that instant (`state_at`), which the 2D, the panel and the 3D
   * replay; a cursor still at the bundle's own instant reloads nothing. */
  private async ensureVersion() {
    const b = this.bundle;
    if (!b || b.source !== 'api' || !b.at) return;
    const t = this.instant.toISOString().replace(/\.\d{3}Z$/, 'Z');
    if (t === b.at) {
      void this.updateGeometry();
      return;
    }
    const seq = ++this.bundleSeq;
    try {
      const nb = await loadMap(this.floorId, false, t);
      if (seq !== this.bundleSeq || this.bundle !== b) return; // a newer cursor or another floor answered meanwhile
      const before = b.anchors.map((a) => a.resource_id).sort().join(',');
      this.bundle = nb;
      if (nb.planVersionId !== b.planVersionId) this.geometry = null; // another plan version: its own structure, once fetched
      void this.updateGeometry();
      if (this.selectedId && !nb.anchors.some((a) => a.id === this.selectedId)) this.selectedId = null;
      if (nb.anchors.map((a) => a.resource_id).sort().join(',') !== before) await this.loadDay();
    } catch {
      /* keep the bundle that is shown */
    }
  }

  private renderEntityStates(b: MapBundle) {
    const ents = b.anchors.filter((a) => a.resource_type === 'ha_entity');
    if (!ents.length) return html`אין ישויות מוצבות בקומה`;
    const known = ents.filter((a) => a.entity?.state_at?.known);
    const cov = b.haHistory;
    return html`${known.length} מתוך ${ents.length} ידועות בזמן זה${cov?.from ? html` <span class="note">(היסטוריה מקומית מ־<span class="ltr">${this.fmtWhen(cov.from)}</span>, ${cov.retention_days} ימים)</span>` : html` <span class="note">(אין עדיין היסטוריה מקומית)</span>`}
      <div class="evl" style="margin-block-start:4px">${ents.slice(0, 8).map((a) => {
        const sa = a.entity?.state_at;
        const name = entityName(a);
        return html`<div data-history-entity data-known=${sa?.known ? 'true' : 'false'} data-source=${sa?.source ?? 'vms'}><span>${name}${sa?.source === 'ha_recorder' ? html` <span class="note" title="המצב מגיע מהיסטוריית המערכת (מקור משני)">· מקור משני</span>` : nothing}</span><span class="note">${sa?.known && sa.state ? html`${stateLabel({ ...(a.entity ?? { domain: '', unit: null, device_class: null, attributes: {} }), state: sa.state })} · מ־<span class="ltr">${sa.changed_at ? this.fmt(sa.changed_at) : ''}</span>` : html`לא ידוע${sa?.reason ? ` · ${sa.reason}` : ''}${sa?.state ? html` <span class="ltr">(אחרון: ${sa.state})</span>` : ''}`}</span></div>`;
      })}</div>`;
  }

  private fmtWhen(iso: string) {
    return dayTimeText(new Date(iso), { timeZone: this.tz });
  }

  private setDate(date: string) {
    if (!date) return;
    this.date = date;
    this.minute = Math.min(this.minute, this.limitMinute);
    void this.loadDay();
    if (this.scrub) {
      this.stopPlay(false);
      this.fitWindow(true);
      this.scheduleRange();
      this.scheduleFrame();
    }
  }

  private fmt(iso: string) {
    return timeText(new Date(iso), { timeZone: this.tz, seconds: true });
  }

  private get floors(): { id: string; name: string }[] {
    if (this.tree?.source !== 'api') return [];
    return this.tree.sites.flatMap((s) => (s.buildings ?? []).flatMap((b) => (b.floors ?? []).map((f) => ({ id: f.id, name: `${b.name} · ${f.name}` }))));
  }

  // ---- 3D (T087) ----

  /** The state of an HA entity at the instant, as the 2D shows it: known from the local history, else null (drawn as unknown). */
  private stateAt(a: MapBundle['anchors'][number]): string | null {
    return a.entity?.state_at?.known ? a.entity.state_at.state : null;
  }

  /** Cheap: the floor has a structure at the instant (the toggle's gate; the scene itself is built only while the 3D is on). */
  private get hasScene(): boolean {
    return this.bundle?.source === 'api' && this.geometry !== null;
  }

  /** The scene of the floor at the instant: the structure published then, the entity and circuit states of the instant, the
   * cameras blue where a recording covers the instant. Built only while the 3D is on, and rebuilt only when its inputs
   * changed: the memo is keyed on a signature of what the builder reads (anchors, states, coverage at the cursor, zones) plus
   * the structure document (cached by hash, so the same object while the cursor stays in one publish) and the library.
   * The anchors carry today's mount height and tilt: the history keeps only the current anchor row. The getter is read
   * several times per render: while nothing it reads changed - by identity, the screen replaces its bundle, structure,
   * library and recordings and never mutates them; the cursor's minute and zone are values - it answers the memo without
   * building the anchor list or its key (0.1.89 list, item 3). */
  private get sceneDescription(): SceneDescription | null {
    const b = this.bundle;
    const g = this.geometry;
    if (!this.view3d || !b || b.source !== 'api' || !g) return null;
    // CR-TIMESCRUB101: with the time scrub on, the 3D replays the same filtered states as the 2D (known states of enabled,
    // permitted layers only) and the same room-state layer; a switched-off layer's anchors are not drawn
    const drawn = this.scrub ? this.scrubDrawn : null;
    const scrubLayer = this.scrub ? this.scrubRoomLayer : null;
    const refs: unknown[] = [b, g, this.catalog3d, this.level, this.itemNames, this.recordings, this.minute, this.tz, this.real3d, this.materials3d, this.scrub, drawn, scrubLayer, this.switches];
    if (this.sceneMemo && sameRefs(this.sceneMemo.refs, refs)) return this.sceneMemo.desc;
    // ST7HIST (map/replay-3d.ts): the states of the instant - known only, explicit nulls otherwise (never the last live value);
    // a circuit's switch only when the history knows it at the instant
    const { entityStates, circuitStates } = drawn ? { entityStates: drawn.states, circuitStates: this.scrubCircuits } : replayStates(b.anchors, b.circuitStates);
    const shown = this.scrub ? b.anchors.filter((a) => this.scrubVisible(a)) : b.anchors;
    const anchors: SceneAnchor[] = shown.map((a) => ({
      id: a.id, resource_type: a.resource_type, resource_id: a.resource_id, x: a.position.x, y: a.position.y, rotation: a.rotation_degrees, fov: a.field_of_view_degrees ?? null, radius: a.coverage_radius ?? null,
      polygon: a.coverage_polygon ?? null, level_id: a.level_id ?? null, layer_id: a.layer_id, label: entityName(a), state: drawn ? drawn.states[a.resource_id] ?? null : this.stateAt(a),
      online: a.resource_type === 'camera' ? this.coverageAt(a.resource_id).state === 'historic' : null, mount_height_m: a.mount_height_m ?? null, tilt_deg: a.tilt_deg ?? null,
    }));
    const zones = b.zones.map((z) => ({ id: z.id, name: z.name, polygon: z.polygon, level_id: z.level_id ?? null }));
    const keys: unknown[] = [JSON.stringify([b.floorId, b.width, b.height, anchors, entityStates, circuitStates, zones, layerSignature(scrubLayer)]), g, this.catalog3d, this.level, this.itemNames, this.real3d, this.materials3d];
    if (this.sceneMemo && sameRefs(this.sceneMemo.keys, keys)) {
      this.sceneMemo = { ...this.sceneMemo, refs };
      return this.sceneMemo.desc;
    }
    // the realistic part only while the element draws level 3 (its `realistic-change`): levels 1-2 get exactly the description of before
    const desc = buildScene({ doc: g, width: b.width, height: b.height, anchors, entityStates, circuitStates, catalog: this.catalog3d, zones, level: this.level, anchorsEveryLevel: true,
      ...(scrubLayer ? { roomStates: scrubLayer } : {}),
      ...(this.real3d ? { realistic: true, materialsCatalog: this.materials3d } : {}) });
    // hover labels: anchors by their map name, objects by label or library name, zones by name
    const labels: Record<string, string> = {};
    for (const a of b.anchors) labels[a.id] = entityName(a);
    for (const o of g.objects) labels[o.id] = o.label || this.itemNames.get(o.item_id) || o.item_id;
    for (const z of b.zones) labels[z.id] = z.name;
    this.sceneMemo = { refs, keys, desc, labels };
    return desc;
  }

  /** The 3D is on screen. The 2D canvas stays mounted underneath (hidden), so its pan and zoom survive a round trip. */
  private get shows3d(): boolean {
    return this.view3d && this.threeState === 'ready' && this.sceneDescription !== null;
  }

  private async toggle3d(): Promise<void> {
    if (this.view3d) {
      this.view3d = false;
      return;
    }
    if (!webglAvailable() || !this.hasScene || this.threeState === 'loading') return;
    if (this.threeState !== 'ready') {
      this.threeState = 'loading';
      try {
        await import('../map/sw-plan-3d');
        this.threeState = 'ready';
      } catch (err) {
        this.threeState = 'error';
        this.threeError = describeError(err);
        return;
      }
    }
    this.view3d = true;
  }

  /** A click in the 3D of the past: the shared rule (part-select.boundItemOf) - a camera or an entity, or the entity a
   * door or an object is bound to (a lamp to its light, a door to its lock), becomes the selected pin (the panel follows);
   * nothing is actuated, the history offers no actions. The floor clears the selection; an unbound object and every other
   * part leave it (the history has no object selection). */
  private onPartSelect(e: CustomEvent<PartSelectDetail>) {
    const { id, kind } = e.detail;
    if (!id) {
      this.selectedId = null;
      return;
    }
    const t = kind ? boundItemOf({ id, kind }, this.geometry, this.bundle?.anchors ?? []) : null;
    if (!t || !('anchor' in t)) return;
    this.selectedId = t.anchor;
    this.frameFailed = false;
  }

  // ---- render ----

  private renderPanel(b: MapBundle) {
    return html`<div class="panel">${this.panelCards(b)}</div>`;
  }

  /** The "at the instant" card, the case picker and the events card. `x` (time scrub only) replaces the devices row with
   * the replay's, adds rows (rooms, alarm, elevators) and actions, and can switch the events list off (layer off / locked). */
  private panelCards(b: MapBundle, x?: { entities: unknown; rows: unknown; actions: unknown; eventsOff: string | null }) {
    const a = this.selectedAnchor;
    const cam = a?.resource_type === 'camera' ? a : null;
    const cov = cam ? this.coverageAt(cam.resource_id) : null;
    const recs = cam ? this.recordings.get(cam.resource_id) : undefined;
    const near = x?.eventsOff ? [] : this.eventsNear(undefined, NEAR_MIN);
    const tISO = this.instant.toISOString().replace(/\.\d{3}Z$/, 'Z');
    return html`
      <sw-card heading="בנקודת הזמן שנבחרה" subheading="זמן ונתונים מאותו רגע" data-history-panel>
        <dl>
          <dt>זמן</dt><dd><span class="ltr" data-history-time>${this.date} ${secondLabel(this.minute)}</span> <span class="note">${this.tz}</span></dd>
          <dt>מצלמה נבחרת</dt><dd data-history-camera>${cam ? cam.camera?.name ?? cam.resource_id : 'לחץ על מצלמה במפה'}</dd>
          ${cam
            ? html`<dt>הקלטה</dt><dd>${recs === undefined ? 'טוען…' : recs === null ? 'לא ניתן לבדוק מול ה־NVR' : cov?.segment ? html`יש הקלטה · ${minuteLabel(cov.segment.startMin)}–${minuteLabel(cov.segment.endMin)} · ${cov.segment.kind === 'continuous' ? 'רציף' : 'תנועה'}` : 'אין הקלטה בזמן זה (פער)'}</dd>
                <dt>אירועים ±5 דק׳</dt><dd>${this.eventsNear(cam.resource_id, 5).length}</dd>`
            : nothing}
          <dt>התקנים</dt><dd data-history-entities>${x ? x.entities : this.renderEntityStates(b)}</dd>
          ${x ? x.rows : nothing}
          ${cam && this.frameAt ? html`<dt>פריים</dt><dd><div class="frame" data-history-frame>${this.frameFailed ? html`<span>אין פריים בהקלטה בזמן זה</span>` : html`<img src=${frameUrl(cam.resource_id, this.frameAt)} alt="פריים מההקלטה בזמן שנבחר" @error=${() => (this.frameFailed = true)} />`}</div></dd>` : nothing}
          <dt>גרסת תוכנית</dt><dd data-history-plan-version data-history-mode=${b.history ?? 'live'}>${b.history === 'exact' && b.planPublishedAt ? html`בתוקף באותו זמן · פורסמה <span class="ltr">${this.fmtWhen(b.planPublishedAt)}</span>${b.planArchivedAt ? html` · הוחלפה <span class="ltr">${this.fmtWhen(b.planArchivedAt)}</span>` : ''}` : b.historyFrom ? html`המפה הנוכחית · היסטוריית המפה מתחילה <span class="ltr">${this.fmtWhen(b.historyFrom)}</span>` : 'המפה הנוכחית'}</dd>
        </dl>
        <div style="display:flex;gap:8px;flex-wrap:wrap;margin-block-start:10px">
          ${cam ? html`<sw-button variant="primary" size="sm" icon="history" @click=${() => navigate('/investigate/playback', { camera: cam.resource_id, t: tISO })}>נגן מכאן</sw-button>` : nothing}
          ${x ? x.actions : nothing}
          <sw-button size="sm" icon="case" data-add-to-case ?disabled=${!cam} title=${cam ? 'קטע של המצלמה הנבחרת סביב הזמן שנבחר (15 שניות לפני, 45 אחרי)' : 'בחר מצלמה במפה'} @click=${() => { if (cam) this.casePick = { kind: 'clip', camera_id: cam.resource_id, ...clipAround(this.instant) }; }}>הוסף לתיק</sw-button>
        </div>
      </sw-card>
      <sw-case-picker .item=${this.casePick} subheading=${cam ? `${cam.camera?.name ?? cam.resource_id} · ${this.date} ${secondLabel(this.minute)}` : ''} @close=${() => (this.casePick = null)}></sw-case-picker>
      <sw-card heading="אירועים סביב הזמן" subheading=${`±${NEAR_MIN} דקות · מצלמות הקומה`}>
        ${near.length
          ? html`<div class="evl" data-history-events>${near.slice(0, 8).map((e) => html`<a class=${cam && e.camera_id === cam.resource_id ? 'hit' : ''} href=${`#/investigate/events/${e.id}`}><span>${EVENT_LABEL[e.type] ?? e.type} · ${e.camera_name ?? e.channel ?? ''}<div class="s">${e.confidence === 'inferred' ? 'נגזר מהקלטה' : 'התראה מה־NVR'}${e.acked_at ? ' · טופל' : ''}</div></span><span class="ltr">${this.fmt(e.occurred_at)}</span></a>`)}</div>`
          : html`<div class="note">${x?.eventsOff ?? 'אין אירועים בחלון הזה.'}</div>`}
      </sw-card>`;
  }

  private renderApi() {
    const b = this.bundle;
    if (this.error && !b) return html`<div class="head lead-head"><h1>מפה היסטורית</h1></div><sw-state-panel state="error" hint=${this.error}></sw-state-panel>`;
    if (!b) return html`<div class="head lead-head"><h1>מפה היסטורית</h1></div><sw-state-panel state="loading"></sw-state-panel>`;
    const sel = this.selectedAnchor;
    const segs = sel?.resource_type === 'camera' ? this.segmentsFor(sel.resource_id) ?? [] : Array.from(this.recordings.keys()).flatMap((id) => this.segmentsFor(id) ?? []);
    const tlEvents: TimelineEvent[] = (sel?.resource_type === 'camera' ? this.events.filter((e) => e.camera_id === sel.resource_id) : this.events).map((e) => ({ minute: minuteInZone(new Date(e.occurred_at), this.tz), kind: markerKind(e.type), label: `${EVENT_LABEL[e.type] ?? e.type}${e.count > 1 ? ` ×${e.count}` : ''}` }));
    return html`
      <div class="head lead-head">
        <div><h1>המפה בזמן שנבחר · ${b.floorName}</h1><div class="sub">${b.buildingName} · <span class="ltr">${this.date} ${secondLabel(this.minute)}</span> · ${this.tz}</div></div>
        <span class="grow"></span>
        ${this.floors.length > 1 ? html`<sw-field><select aria-label="קומה" @change=${(e: Event) => navigate(`/investigate/floors/${(e.target as HTMLSelectElement).value}`, { t: this.instant.toISOString() })}>${this.floors.map((f) => html`<option value=${f.id} ?selected=${f.id === this.floorId}>${bidi(f.name)}</option>`)}</select></sw-field>` : nothing}
        ${b.imageUrl
          ? html`<sw-button icon="map" aria-pressed=${this.planImage} data-plan-background title=${this.planImage ? 'הסתר את תמונת התוכנית' : 'הצג את תמונת התוכנית'} @click=${() => this.setPlanImage(!this.planImage)}>תמונת התוכנית</sw-button>`
          : nothing}
        <sw-button icon="cube" aria-pressed=${this.view3d} data-view-3d ?disabled=${!this.view3d && (!webglAvailable() || !this.hasScene || this.threeState === 'loading')}
          title=${!webglAvailable() ? WEBGL_UNAVAILABLE_HE : !this.hasScene ? 'אין מבנה מפורסם בזמן הזה' : 'מקש 3'} @click=${() => this.toggle3d()}>${this.view3d ? '2D' : '3D'}</sw-button>
        ${webglAvailable() ? nothing : html`<span class="note" data-3d-unavailable>${WEBGL_UNAVAILABLE_HE}</span>`}
        <sw-button icon="live" data-back-live @click=${() => navigate(`/explore/floors/${b.floorId}`)}>חזרה למצב חי</sw-button>
      </div>
      <div class="bar"><sw-icon name="clock" size=${14}></sw-icon><span>מצב חקירה היסטורי — פעולות פיזיות אינן זמינות. מצב ללא היסטוריה מוצג כלא ידוע, לא כערך החי האחרון.</span>${this.loading ? html`<span class="note">טוען הקלטות ואירועים…</span>` : nothing}</div>
      <div class="layout">
        <div class="stage">
          <div class="chip"><sw-icon name="building" size=${14}></sw-icon>${b.floorName}</div>
          <div class="hist">מצב היסטורי · <span class="ltr">${secondLabel(this.minute)}</span></div>
          ${this.shows3d && this.sceneDescription
            ? html`<sw-plan-3d data-history-3d .description=${this.sceneDescription} .selectedId=${this.selectedId} .preset=${this.preset3d} .frameKey=${b.floorId} .labels=${this.sceneMemo?.labels ?? {}}
                .cameras=${b.anchors.filter((a) => a.resource_type === 'camera').map((a) => ({ id: a.id, label: entityName(a) }))} exportName=${`plan-3d-${b.floorName}-${this.date}`}
                .sunAt=${this.instant.getTime()} .walkable=${REPLAY_VIEW.walkable} .stillsAvailable=${REPLAY_VIEW.stillsAvailable}
                @realistic-change=${(e: CustomEvent<RealisticChangeDetail>) => { if (this.real3d !== e.detail.on) this.real3d = e.detail.on; }}
                @part-select=${(e: CustomEvent<PartSelectDetail>) => this.onPartSelect(e)}></sw-plan-3d>`
            : nothing}
          <sw-plan-canvas style=${this.shows3d ? 'display:none' : ''} alwaysLabel .planWidth=${b.width} .planHeight=${b.height} .plan=${b.planSvg} .imageUrl=${b.imageUrl} .hideImage=${!this.planImage} .markers=${this.apiMarkers} .selectedId=${this.selectedId} .zones=${zonesWithChips(b.zones)} .geometry=${this.geometry} .structureLevel=${this.level} .catalog=${this.catalogLookup} .anchorPositions=${Object.fromEntries(b.anchors.map((a) => [`${a.resource_type}:${a.resource_id}`, { x: a.position.x, y: a.position.y, rotation: a.rotation_degrees } as AnchorPosition]))} .entityStates=${Object.fromEntries(b.anchors.filter((a) => a.resource_type === 'ha_entity').map((a) => [a.resource_id, this.stateAt(a)]))} dimEntities
            @marker-select=${(e: CustomEvent<MarkerSelectDetail>) => { this.selectedId = e.detail.id; this.frameFailed = false; }}></sw-plan-canvas>
          ${this.threeState === 'loading' ? html`<div class="hist below" data-3d-loading>טוען תלת-ממד…</div>` : nothing}
          ${this.threeState === 'error' ? html`<div class="hist below" data-3d-load-error>תלת-ממד לא נטען: ${this.threeError}</div>` : nothing}
          ${this.shows3d ? nothing : html`<div class="legend"><span>כחול = יש הקלטה בזמן זה</span><span>מקווקו = אין הקלטה / לא ידוע</span><span>התקנים = מצב מההיסטוריה המקומית או לא ידוע</span></div>`}
        </div>
        ${this.renderPanel(b)}
      </div>
      <div class="tl">
        <div class="tlbar">
          <sw-badge kind="historic"></sw-badge>
          <span class="time">${this.date} ${secondLabel(this.minute)}</span>
          <sw-chip @click=${() => this.setMinute(this.minute - 60)}>-1 שעה</sw-chip><sw-chip @click=${() => this.setMinute(this.minute - 5)}>-5 דק׳</sw-chip><sw-chip @click=${() => this.setMinute(this.minute + 5)}>+5 דק׳</sw-chip><sw-chip @click=${() => this.setMinute(this.minute + 60)}>+1 שעה</sw-chip>
          <span class="grow"></span>
          <sw-field><input type="date" lang=${dateInputLang()} .value=${this.date} max=${dateInZone(new Date(), this.tz)} data-ltr aria-label="תאריך" @change=${(e: Event) => this.setDate((e.target as HTMLInputElement).value)} /></sw-field>
          <span class="note">${sel?.resource_type === 'camera' ? `ציר הזמן: ${sel.camera?.name ?? ''}` : 'ציר הזמן: כל מצלמות הקומה'}</span>
        </div>
        <sw-timeline .segments=${segs} .events=${tlEvents} .cursor=${this.minute} .limit=${this.limitMinute} .follow=${false} precision="estimated" @seek=${(e: CustomEvent<{ minute: number }>) => this.setMinute(e.detail.minute)} @scrub=${(e: CustomEvent<{ minute: number }>) => this.setMinute(e.detail.minute)}></sw-timeline>
      </div>
    `;
  }

  // ---- CR-TIMESCRUB101: data ----

  private restoreSwitches() {
    try {
      this.switches = parseSwitches(localStorage.getItem(LAYER_STORAGE_KEY));
    } catch {
      this.switches = defaultSwitches(); // blocked storage: the defaults (presence off)
    }
  }

  private toggleLayer(id: LayerId) {
    this.switches = { ...this.switches, [id]: !this.switches[id] };
    try {
      localStorage.setItem(LAYER_STORAGE_KEY, serializeSwitches(this.switches));
    } catch {
      /* private mode or blocked storage: the choice lives for this page only */
    }
  }

  /** The routes answered 404 (the setting is off on the server): today's historical map for this visit. */
  private featureOff() {
    this.stopPlay(false);
    this.scrub = false;
    this.snapshot = null;
    this.range = null;
    this.rangeKey = '';
  }

  /** The snapshot of the cursor's instant; an older answer arriving late never replaces a newer one (the bundleSeq pattern). */
  private async fetchSnapshot() {
    const b = this.bundle;
    if (!this.scrub || !b || b.source !== 'api') return;
    const at = isoZ(this.instant);
    if (this.snapshot && Date.parse(this.snapshot.at) === Date.parse(at)) return;
    const seq = ++this.snapSeq;
    const floor = this.floorId;
    this.snapLoading = true;
    try {
      const s = await loadSnapshot(floor, at);
      if (seq !== this.snapSeq || floor !== this.floorId) return;
      this.snapshot = s;
      this.snapError = '';
      const days = Number(s.settings?.range_max_days);
      if (Number.isFinite(days) && days >= 1) this.rangeMaxDays = Math.min(30, days);
    } catch (err) {
      if (seq !== this.snapSeq) return;
      if (isFeatureOff(err)) {
        this.featureOff();
        return;
      }
      this.snapError = describeError(err);
    } finally {
      if (seq === this.snapSeq) this.snapLoading = false;
    }
  }

  /** An instant (ms) of the chosen day's minute. */
  private msAt(minute: number): number {
    return instantInZone(this.date, minute, this.tz).getTime();
  }

  /** The minute of the chosen day for an instant (ms), fractional to the millisecond; the next midnight is 1440. */
  private minuteOfMs(ms: number): number {
    if (ms >= this.msAt(1440)) return 1440;
    if (ms <= this.msAt(0)) return 0;
    return Math.max(0, Math.min(1440, minuteInZone(new Date(ms), this.tz) + (((ms % 1000) + 1000) % 1000) / 60_000));
  }

  private get winFromMs(): number {
    return this.msAt(this.winStart);
  }

  /** The window's right edge, never past now. */
  private get winToMs(): number {
    return Math.min(this.msAt(this.winStart + this.winMinutes), this.msAt(this.limitMinute));
  }

  /** Keeps the cursor inside the visible window (recentred when it left it); `reset` = the window around the cursor anew. */
  private fitWindow(reset: boolean) {
    const w = this.winMinutes;
    if (!reset && this.minute >= this.winStart && this.minute <= this.winStart + w) return;
    const start = w >= 1440 ? 0 : Math.max(0, Math.min(1440 - w, this.minute - w / 2));
    if (start !== this.winStart || reset) {
      this.winStart = start;
      this.scheduleRange();
    }
  }

  private setWindow(minutes: number) {
    this.winMinutes = minutes;
    this.winStart = minutes >= 1440 ? 0 : Math.max(0, Math.min(1440 - minutes, this.minute - minutes / 2));
    this.scheduleRange();
  }

  /** The track zoomed itself (wheel): the window follows it. */
  private onTimelineWindow(e: Event) {
    const tl = e.target as SwTimeline;
    this.winMinutes = tl.windowMinutes;
    this.winStart = tl.start;
    this.scheduleRange();
  }

  private scheduleRange(delay = 300) {
    window.clearTimeout(this.rangeTimer);
    this.rangeTimer = window.setTimeout(() => void this.fetchRange(), delay);
  }

  /** ONE range for the visible window (lanes and playback), capped at history.range_max_days. */
  private async fetchRange() {
    const b = this.bundle;
    if (!this.scrub || !b || b.source !== 'api') return;
    const from = this.winFromMs;
    const to = Math.min(this.winToMs, from + this.rangeMaxDays * 86_400_000);
    if (!(to > from)) {
      this.range = null;
      this.rangeKey = '';
      return;
    }
    const key = `${this.floorId}|${from}|${to}`;
    if (key === this.rangeKey) return;
    const seq = ++this.rangeSeq;
    const floor = this.floorId;
    try {
      const r = await loadRange(floor, isoZ(from), isoZ(to), RANGE_LAYERS);
      if (seq !== this.rangeSeq || floor !== this.floorId) return;
      this.range = r;
      this.rangeKey = key;
      this.rangeNote = '';
    } catch (err) {
      if (seq !== this.rangeSeq) return;
      if (isFeatureOff(err)) {
        this.featureOff();
        return;
      }
      const code = apiErrorCode(err);
      this.range = null;
      this.rangeKey = '';
      this.rangeNote = code === 'range_too_large' ? 'יותר מדי שינויים בחלון - בחרו חלון קצר יותר' : code === 'range_too_long' ? 'החלון ארוך מהמותר - בחרו חלון קצר יותר' : `פסי השכבות לא נטענו: ${describeError(err)}`;
    }
  }

  /** The instant the plan's states are drawn for (ms): the play head's (stepped) while playing, the cursor's otherwise. */
  private get replayMs(): number {
    return this.playing ? this.stateMs : this.instant.getTime();
  }

  private get snapReplay(): FloorReplay | null {
    const s = this.snapshot;
    if (!s) return null;
    if (this.snapReplayMemo?.snap !== s) this.snapReplayMemo = { snap: s, value: replayFromSnapshot(s) };
    return this.snapReplayMemo.value;
  }

  /** The replay at the drawn instant: the snapshot when it is the settled cursor's, else computed from the range (playback,
   * or the cursor moved and its snapshot is not back yet); null = nothing known (everything drawn unknown). A snapshot of
   * another instant is never shown. */
  private get replay(): FloorReplay | null {
    const t = this.replayMs;
    const refs: unknown[] = [this.snapshot, this.range, t, this.playing];
    if (this.replayMemo && sameRefs(this.replayMemo.refs, refs)) return this.replayMemo.value;
    let value: FloorReplay | null = null;
    const s = this.snapshot;
    if (!this.playing && s && Math.abs(Date.parse(s.at) - t) < 1000) value = this.snapReplay;
    else if (this.range && t >= Date.parse(this.range.from) && t <= Date.parse(this.range.to)) value = replayFromRange(this.range, t, this.snapReplay);
    this.replayMemo = { refs, value };
    return value;
  }

  /** The status / retention per layer for the legend: the replay's, else the last snapshot's (permission and coverage). */
  private get layerStatus(): Partial<Record<LayerId, LayerStatus>> {
    return this.replay?.status ?? this.snapReplay?.status ?? {};
  }

  /** The layer of an anchored entity: the server's classification when the replay named it, else the client's mirror. */
  private layerOfAnchor(a: MapBundle['anchors'][number]): EntityLayerId {
    const id = a.resource_id;
    return this.replay?.entities[id]?.layer ?? this.snapReplay?.entities[id]?.layer ?? classifyEntity({ id, domain: a.entity?.domain ?? id.split('.')[0] ?? '', device_class: a.entity?.device_class ?? null, layer_id: a.layer_id });
  }

  /** An anchor is drawn when its layer is switched on (a locked layer's anchors stay, drawn unknown, with no state). */
  private scrubVisible(a: MapBundle['anchors'][number]): boolean {
    return a.resource_type === 'camera' ? this.switches.cameras : !!this.switches[this.layerOfAnchor(a)];
  }

  /** Entity id -> drawn state (known, enabled, permitted) or null, for every anchored entity of the floor. */
  private get scrubDrawn(): { states: Record<string, string | null>; lastChanged: Record<string, string | null> } {
    const b = this.bundle;
    const rep = this.replay;
    const refs: unknown[] = [b, rep, this.switches];
    if (this.drawnMemo && sameRefs(this.drawnMemo.refs, refs)) return this.drawnMemo.value;
    const ids = (b?.anchors ?? []).filter((a) => a.resource_type === 'ha_entity').map((a) => a.resource_id);
    const value = drawnStates(rep, this.switches, ids);
    this.drawnMemo = { refs, value };
    return value;
  }

  /** Circuit switches only from the bundle of the drawn instant itself (never during playback: the bundle is the settled
   * cursor's), and only while the lights layer draws. */
  private get scrubCircuits(): Record<string, string | null> {
    const b = this.bundle;
    const rep = this.replay;
    const none = () => Object.fromEntries(Object.keys(b?.circuitStates ?? {}).sort().map((k) => [k, null] as [string, string | null]));
    if (!b || !rep || this.playing || !b.at || Math.abs(Date.parse(b.at) - this.replayMs) >= 1000 || !layerDraws('lights', this.switches, rep.status)) return none();
    return replayStates(b.anchors, b.circuitStates).circuitStates;
  }

  private factsFor(g: GeometryDoc, b: MapBundle): StateFacts {
    const m = this.factsMemo;
    if (m && m.geometry === g && m.w === b.width && m.h === b.height && m.catalog === this.catalogLookup) return m.facts;
    const facts = stateFactsOf(g, b.width, b.height, this.catalogLookup);
    this.factsMemo = { geometry: g, w: b.width, h: b.height, catalog: this.catalogLookup, facts };
    return facts;
  }

  /** The room-state layer of the drawn instant, by the live map's own pure function (map/room-state.ts) from the drawn
   * states: unknown contributes nothing; presence without a fade in the past (a tint only while a sensor is on); no
   * attributes (the history does not record them). */
  private get scrubRoomLayer(): RoomStateLayer | null {
    const b = this.bundle;
    const g = this.geometry;
    if (!b || b.source !== 'api') return null;
    const drawn = this.scrubDrawn;
    const circuits = this.scrubCircuits;
    const refs: unknown[] = [b, g, this.catalogLookup, drawn, JSON.stringify(circuits), this.replayMs];
    if (this.roomMemo && sameRefs(this.roomMemo.refs, refs)) return this.roomMemo.value;
    const facts = g ? this.factsFor(g, b) : null;
    let value: RoomStateLayer | null = null;
    if (b.zones.length || facts?.openings.length) {
      const entities = stateEntitiesOf(b.anchors, drawn.states, { lastChanged: drawn.lastChanged, withAttributes: false });
      const lamps = (facts?.lamps ?? []).map((l) => ({ x: l.x, y: l.y, level_id: l.level_id, on: (l.circuit !== null && circuits[l.circuit] === 'on') || (l.entity !== null && drawn.states[l.entity] === 'on') }));
      const rooms = b.zones.map((z) => ({ id: z.id, polygon: z.polygon, level_id: z.level_id ?? null }));
      const fallback = this.levelFallback;
      value = roomStates({ rooms, entities, openings: facts?.openings ?? [], lamps, size: [b.width, b.height], scaleMPerPx: b.scaleMPerPx, now: this.replayMs, fade: 'off', levelOf: (id) => id ?? fallback });
    }
    this.roomMemo = { refs, value };
    return value;
  }

  private get levelFallback(): string {
    const b = this.bundle;
    return this.geometry ? defaultLevelId(this.geometry) : (b?.levels.find((l) => l.is_default)?.id ?? 'L0');
  }

  private markersMemo: { refs: unknown[]; key: string; value: PlanMarker[] } | null = null;

  /** The markers of the time scrub: switched-off layers are not drawn, an entity is "historic" only with a drawn state.
   * Memoised (playback renders every frame; the cameras' coverage and the events near the cursor change per minute). */
  private get scrubMarkers(): PlanMarker[] {
    const b = this.bundle;
    if (!b) return [];
    const drawn = this.scrubDrawn;
    const status = this.layerStatus;
    const refs: unknown[] = [b, drawn, this.switches, this.recordings, this.events, Math.floor(this.minute), this.date];
    const key = String(status.cameras ?? '');
    if (this.markersMemo && this.markersMemo.key === key && sameRefs(this.markersMemo.refs, refs)) return this.markersMemo.value;
    const camsLocked = status.cameras === 'not_permitted';
    const byId = new Map(b.anchors.map((x) => [x.id, x]));
    const out: PlanMarker[] = [];
    for (const m of this.apiMarkers) {
      const a = byId.get(m.id);
      if (!a || !this.scrubVisible(a)) continue;
      if (a.resource_type === 'camera') {
        out.push(camsLocked ? { ...m, label: a.camera?.name ?? a.label ?? a.resource_id, state: 'unknown' } : m);
        continue;
      }
      const s = drawn.states[a.resource_id] ?? null;
      const name = entityName(a);
      out.push({ ...m, label: s !== null ? `${name} · ${stateLabel({ ...(a.entity ?? { domain: '', unit: null, device_class: null, attributes: {} }), state: s })}` : name, state: s !== null ? 'historic' : 'unknown' });
    }
    this.markersMemo = { refs, key, value: out };
    return out;
  }

  private lanesMemo: { key: string; refs: unknown[]; value: Lane[] } | null = null;

  /** The lanes of the visible window: the HA layers and the elevators from the range, the events from the event list. */
  private scrubLanes(winFrom: number, winTo: number): Lane[] {
    const status = this.layerStatus;
    const key = JSON.stringify([winFrom, winTo, status]);
    const refs: unknown[] = [this.range, this.switches, this.events];
    if (this.lanesMemo && this.lanesMemo.key === key && sameRefs(this.lanesMemo.refs, refs)) return this.lanesMemo.value;
    const ids = ['lights', 'openings', 'presence', 'alarm', 'elevators'] as const;
    const value: Lane[] = ids.map((id) => laneOf(this.range, id, winFrom, winTo, this.switches, status));
    const evLocked = status.events === 'not_permitted';
    value.push({ id: 'events', label: LAYER_NAME.events, color: LAYER_COLOR.events, off: !this.switches.events || evLocked, locked: evLocked, spans: [],
      marks: evLocked ? [] : this.events.map((e) => Date.parse(e.occurred_at)).filter((t) => t >= winFrom && t <= winTo).sort((x, y) => x - y) });
    this.lanesMemo = { key, refs, value };
    return value;
  }

  // ---- CR-TIMESCRUB101: playback ----

  private startPlay() {
    if (this.playing) return;
    this.mode = 'play';
    const end = this.winToMs;
    let t = this.instant.getTime();
    if (t >= end - 1000 || t < this.winFromMs) t = this.winFromMs; // at the end (or outside the window): from the window's start
    if (!(end > t)) return;
    this.playing = true;
    this.playMs = t;
    this.stateMs = t;
    this.minute = this.minuteOfMs(t);
    this.lastFrame = performance.now();
    this.lastStateTick = this.lastFrame;
    this.raf = requestAnimationFrame(this.tick);
  }

  /** One animation frame while playing: N seconds of history per second at xN; the states follow at PLAY_STATE_MS; play
   * stops at the window's end (never past now). requestAnimationFrame runs only while playing. */
  private tick = (now: number) => {
    if (!this.playing) return;
    const dt = Math.min(250, Math.max(0, now - this.lastFrame));
    this.lastFrame = now;
    const r = advance(this.playMs, dt, this.speed, this.winToMs);
    this.playMs = r.t;
    this.minute = this.minuteOfMs(r.t);
    if (r.ended || now - this.lastStateTick >= PLAY_STATE_MS) {
      this.stateMs = r.t;
      this.lastStateTick = now;
    }
    if (r.ended) {
      this.stopPlay(true);
      return;
    }
    this.raf = requestAnimationFrame(this.tick);
  };

  /** Stops playing; `settle` = the paused instant gets its snapshot / frame / bundle (600 ms). */
  private stopPlay(settle: boolean) {
    if (this.raf) cancelAnimationFrame(this.raf);
    this.raf = 0;
    if (!this.playing) return;
    this.playing = false;
    this.stateMs = this.playMs;
    if (settle) this.scheduleFrame();
  }

  private togglePlay() {
    if (this.playing) this.stopPlay(true);
    else this.startPlay();
  }

  private setMode(m: 'snapshot' | 'play') {
    if (m === 'snapshot') this.stopPlay(true);
    this.mode = m;
  }

  /** Space = play / pause, arrows = a step (time flows left -> right on the track); handled = true. */
  private onScrubKey(e: KeyboardEvent, t: EventTarget | undefined): boolean {
    if (e.key === ' ' || e.code === 'Space') {
      // a focused button / switch keeps its own Space
      if (t instanceof HTMLElement && (t.tagName === 'BUTTON' || t.tagName === 'A' || t.getAttribute('role') === 'switch')) return false;
      e.preventDefault();
      if (!e.repeat) this.togglePlay();
      return true;
    }
    if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') {
      e.preventDefault();
      const step = e.shiftKey ? 10 : this.winMinutes <= 10 ? 1 / 6 : 1;
      this.setMinute(this.minute + (e.key === 'ArrowRight' ? step : -step));
      return true;
    }
    return false;
  }

  /** Jumps to an instant (another day when needed), e.g. the first recorded moment. */
  private goTo(ms: number) {
    this.stopPlay(false);
    const d = new Date(ms);
    const day = dateInZone(d, this.tz);
    const dayChanged = day !== this.date;
    this.date = day;
    this.minute = Math.min(this.limitMinute, minuteInZone(d, this.tz));
    if (dayChanged) void this.loadDay();
    this.fitWindow(true);
    this.scheduleFrame();
  }

  // ---- CR-TIMESCRUB101: render ----

  private fmtHm(ms: number): string {
    return timeText(new Date(ms), { timeZone: this.tz });
  }

  private renderLayers(status: Partial<Record<LayerId, LayerStatus>>, retention: Partial<Record<LayerId, number | null>>) {
    const camIds = (this.bundle?.anchors ?? []).filter((a) => a.resource_type === 'camera').map((a) => a.resource_id);
    const covered = camIds.filter((id) => this.coverageAt(id).state === 'historic').length;
    return html`<div class="lcard" data-history-layers>
      <div class="lhd"><h2>שכבות</h2><span class="grow"></span>${this.range?.bucket_s ? html`<span class="note">דגימה כל ${Math.max(1, Math.round(this.range.bucket_s / 60))} דק׳</span>` : nothing}</div>
      <div class="layers" role="group" aria-label="שכבות">
        ${LAYER_IDS.map((id) => {
          const st = status[id];
          const locked = st === 'not_permitted';
          const on = !!this.switches[id] && !locked;
          const s = layerStatusText(st);
          let text = s.text;
          if (!st) text = this.snapLoading ? '…' : 'לא ידוע';
          else if (id === 'elevators' && st === 'ok') text = 'מצב בלבד';
          else if (id === 'cameras' && st === 'ok') text = `${covered} מ־${camIds.length}`;
          const cov = id === 'cameras' ? '· לפי ה־NVR' : coverageText(retention[id]);
          return html`<div class="lyr" data-layer=${id} data-off=${on ? 'false' : 'true'} data-status=${st ?? ''}>
            <button class="sw" type="button" role="switch" aria-checked=${on ? 'true' : 'false'} aria-label=${LAYER_NAME[id]} ?disabled=${locked} @click=${() => this.toggleLayer(id)}></button>
            <span class="nm"><i style=${`background:${LAYER_COLOR[id]}`}></i>${LAYER_NAME[id]}${cov ? html` <span class="cov">${cov}</span>` : nothing}</span>
            <span class="st" data-look=${st ? s.look : 'unk'}>${locked ? html`<sw-icon name="lock" size=${13}></sw-icon>` : nothing}${text}</span>
          </div>`;
        })}
      </div>
    </div>`;
  }

  private reasonText(reason: string | null): string {
    switch (reason) {
      case 'gap':
        return 'פער בהקלטה';
      case 'forward_fill_exceeded':
        return 'אין שינוי מוקלט קרוב';
      case 'before_history':
        return 'לפני תחילת ההיסטוריה';
      default:
        return reason ?? '';
    }
  }

  /** The time scrub's parts of the "at the instant" card: the devices (from the replay), rooms, alarm, elevators, and
   * "all the floor's cameras from here". */
  private scrubPanelParts(b: MapBundle, rep: FloorReplay | null, status: Partial<Record<LayerId, LayerStatus>>) {
    const drawn = this.scrubDrawn;
    const ents = b.anchors.filter((a) => a.resource_type === 'ha_entity');
    const known = ents.filter((a) => drawn.states[a.resource_id] !== null && drawn.states[a.resource_id] !== undefined);
    const cov = rep?.coverage ?? this.snapshot?.coverage ?? null;
    const entities = !ents.length
      ? html`אין ישויות מוצבות בקומה`
      : html`${known.length} מתוך ${ents.length} ידועות בזמן זה${cov?.from ? html` <span class="note">(היסטוריה מקומית מ־<span class="ltr">${this.fmtWhen(cov.from)}</span>)</span>` : html` <span class="note">(אין עדיין היסטוריה מקומית)</span>`}
        <div class="evl" style="margin-block-start:4px">${ents.filter((a) => this.scrubVisible(a)).slice(0, 8).map((a) => {
          const layer = this.layerOfAnchor(a);
          const locked = status[layer] === 'not_permitted';
          const s = drawn.states[a.resource_id] ?? null;
          const e = rep?.entities[a.resource_id];
          const name = entityName(a);
          return html`<div data-history-entity data-known=${s !== null ? 'true' : 'false'} data-layer=${layer}><span>${name}</span><span class="note">${locked
            ? 'לא מורשה'
            : s !== null
              ? html`${stateLabel({ ...(a.entity ?? { domain: '', unit: null, device_class: null, attributes: {} }), state: s })}${e?.changedAt ? html` · מ־<span class="ltr">${this.fmt(e.changedAt)}</span>` : ''}${e?.changedDuring ? ' · השתנה בתוך הדגימה' : ''}`
              : html`לא ידוע${e?.reason ? ` · ${this.reasonText(e.reason)}` : ''}`}</span></div>`;
        })}</div>`;
    const rk = roomsKnown(b.zones, ents.map((a) => ({ x: a.position.x, y: a.position.y, level_id: a.level_id ?? null, state: drawn.states[a.resource_id] ?? null })), (id) => id ?? this.levelFallback);
    const alarmPanels = Object.entries(rep?.entities ?? {}).filter(([, e]) => e.layer === 'alarm');
    const alarmKnown = alarmPanels.find(([, e]) => e.known && e.state !== null);
    const alarm = status.alarm === 'not_permitted'
      ? html`<sw-icon name="lock" size=${12}></sw-icon> לא מורשה`
      : !this.switches.alarm
        ? 'השכבה כבויה'
        : status.alarm === 'empty'
          ? 'אין לוח אזעקה בקומה'
          : alarmKnown
            ? html`${stateLabel({ domain: 'alarm_control_panel', unit: null, device_class: null, attributes: {}, state: alarmKnown[1].state })}${alarmKnown[1].changedAt ? html` · מ־<span class="ltr">${this.fmt(alarmKnown[1].changedAt)}</span>` : ''}`
            : 'לא ידוע';
    const elevItems = Object.entries(rep?.elevators ?? {});
    const showElev = status.elevators !== undefined && status.elevators !== 'empty';
    const elevators = status.elevators === 'not_permitted'
      ? html`<sw-icon name="lock" size=${12}></sw-icon> לא מורשה`
      : !this.switches.elevators
        ? 'השכבה כבויה'
        : html`<div class="elev">${elevItems.length ? elevItems.map(([id, it]) => html`<sw-chip data-elevator=${id}>${it.name} · ${it.known && it.state ? ELEVATOR_STATE[it.state] ?? it.state : 'לא ידוע'}</sw-chip>`) : html`<span>לא ידוע</span>`}</div><div class="note">מיקום התא לא מוקלט</div>`;
    const rows = html`
      <dt>חדרים</dt><dd data-history-rooms>${rk.total ? `${rk.known} מתוך ${rk.total} ידועים` : 'אין חדרים מסומנים בקומה'}</dd>
      <dt>אזעקה</dt><dd data-history-alarm>${alarm}</dd>
      ${showElev ? html`<dt>מעליות</dt><dd data-history-elevators>${elevators}</dd>` : nothing}`;
    const camsLocked = status.cameras === 'not_permitted';
    const snapCams = this.snapshot?.layers.cameras?.camera_ids;
    const camIds = camsLocked || !this.switches.cameras ? [] : (snapCams && snapCams.length ? snapCams : b.anchors.filter((a) => a.resource_type === 'camera').map((a) => a.resource_id));
    const tISO = isoZ(this.instant);
    // the synchronized playback of the floor's cameras at the instant: the playback screen with its `extra` cameras (the
    // sync screen #/investigate/playback/sync reads no query parameters today); up to four cameras play together
    const actions = html`<sw-button size="sm" icon="camera" data-history-all-cameras ?disabled=${!camIds.length} title=${camIds.length > 4 ? 'ארבע המצלמות הראשונות של הקומה' : 'כל מצלמות הקומה מהזמן שנבחר'}
      @click=${() => { if (camIds.length) navigate('/investigate/playback', { camera: camIds[0], t: tISO, ...(camIds.length > 1 ? { extra: camIds.slice(1, 4).join(',') } : {}) }); }}>כל מצלמות הקומה מכאן</sw-button>`;
    const eventsOff = status.events === 'not_permitted' ? 'לא מורשה' : !this.switches.events ? 'השכבה כבויה' : null;
    return { entities, rows, actions, eventsOff };
  }

  private renderScrub() {
    const b = this.bundle;
    if (this.error && !b) return html`<div class="head lead-head"><h1>מפה היסטורית</h1></div><sw-state-panel state="error" hint=${this.error}></sw-state-panel>`;
    if (!b) return html`<div class="head lead-head"><h1>מפה היסטורית</h1></div><sw-state-panel state="loading"></sw-state-panel>`;
    const sel = this.selectedAnchor;
    const rep = this.replay;
    const status = this.layerStatus;
    const retention = rep?.retention ?? this.snapReplay?.retention ?? {};
    const coverage = rep?.coverage ?? this.snapshot?.coverage ?? this.range?.coverage ?? null;
    const tMs = this.replayMs;
    const gap = coverage ? gapAt(coverage.gaps, tMs) : null;
    const camsOn = this.switches.cameras && status.cameras !== 'not_permitted';
    const eventsOn = this.switches.events && status.events !== 'not_permitted';
    const segs = !camsOn ? [] : sel?.resource_type === 'camera' ? this.segmentsFor(sel.resource_id) ?? [] : Array.from(this.recordings.keys()).flatMap((id) => this.segmentsFor(id) ?? []);
    const tlEvents: TimelineEvent[] = !eventsOn ? [] : (sel?.resource_type === 'camera' ? this.events.filter((e) => e.camera_id === sel.resource_id) : this.events).map((e) => ({ minute: minuteInZone(new Date(e.occurred_at), this.tz), kind: markerKind(e.type), label: `${EVENT_LABEL[e.type] ?? e.type}${e.count > 1 ? ` ×${e.count}` : ''}` }));
    const when = `${this.date} ${secondLabel(this.minute)}`;
    const winFrom = this.winFromMs;
    const winTo = this.msAt(this.winStart + this.winMinutes);
    const limitMs = this.msAt(this.limitMinute);
    const cursorMs = this.playing ? this.playMs : this.instant.getTime();
    const lanes = this.scrubLanes(winFrom, winTo);
    const gaps = gapsInWindow(this.range?.coverage?.gaps ?? coverage?.gaps, winFrom, winTo);
    const historyFrom = coverage?.from ? Date.parse(coverage.from) : null;
    const noHistory = !!coverage && (historyFrom === null || tMs < historyFrom);
    const layer = this.scrubRoomLayer;
    const drawn = this.scrubDrawn;
    const minDate = coverage?.from ? dateInZone(new Date(coverage.from), this.tz) : undefined;
    const parts = this.scrubPanelParts(b, rep, status);
    return html`
      <div class="head lead-head">
        <div><h1>המפה בזמן שנבחר · ${b.floorName}</h1><div class="sub">${b.buildingName} · <span class="ltr">${when}</span> · ${this.tz}</div></div>
        <span class="grow"></span>
        <div class="acts-h">
          ${this.floors.length > 1 ? html`<sw-field><select aria-label="קומה" @change=${(e: Event) => navigate(`/investigate/floors/${(e.target as HTMLSelectElement).value}`, { t: this.instant.toISOString() })}>${this.floors.map((f) => html`<option value=${f.id} ?selected=${f.id === this.floorId}>${bidi(f.name)}</option>`)}</select></sw-field>` : nothing}
          ${b.imageUrl
            ? html`<sw-button icon="map" aria-pressed=${this.planImage} data-plan-background title=${this.planImage ? 'הסתר את תמונת התוכנית' : 'הצג את תמונת התוכנית'} @click=${() => this.setPlanImage(!this.planImage)}><span class="lbl">תמונת התוכנית</span></sw-button>`
            : nothing}
          <sw-button icon="cube" aria-pressed=${this.view3d} data-view-3d ?disabled=${!this.view3d && (!webglAvailable() || !this.hasScene || this.threeState === 'loading')}
            title=${!webglAvailable() ? WEBGL_UNAVAILABLE_HE : !this.hasScene ? 'אין מבנה מפורסם בזמן הזה' : 'מקש 3'} @click=${() => this.toggle3d()}>${this.view3d ? '2D' : '3D'}</sw-button>
          ${webglAvailable() ? nothing : html`<span class="note" data-3d-unavailable>${WEBGL_UNAVAILABLE_HE}</span>`}
          <sw-button icon="live" data-back-live title="חזרה למצב חי" @click=${() => navigate(`/explore/floors/${b.floorId}`)}><span class="lbl">חזרה למצב חי</span></sw-button>
          <sw-button class="details-btn" icon="inbox" data-history-details title="פרטים" aria-expanded=${this.detailsOpen ? 'true' : 'false'} @click=${() => (this.detailsOpen = !this.detailsOpen)}>פרטים</sw-button>
        </div>
      </div>
      <div class="bar">
        <sw-icon name="clock" size=${14}></sw-icon>
        <span>מצב חקירה היסטורי — פעולות פיזיות אינן זמינות. מצב ללא היסטוריה מוצג כלא ידוע, לא כערך החי האחרון.</span>
        <span class="grow"></span>
        ${this.rangeNote ? html`<span class="pill warn" data-history-range-note>${this.rangeNote}</span>` : nothing}
        ${this.mode === 'play'
          ? html`<span class="pill" data-history-mode="play">ניגון · <span class="ltr">${this.fmtHm(winFrom)}–${this.fmtHm(Math.min(winTo, limitMs))}</span>${this.range?.bucket_s ? ` · דגימה כל ${Math.max(1, Math.round(this.range.bucket_s / 60))} דק׳` : ''}</span>`
          : html`<span class="pill" data-history-mode="snapshot">רגע אחד</span>`}
      </div>
      <div class="layout ts">
        <div class="stage">
          <div class="chip"><sw-icon name="building" size=${14}></sw-icon>${b.floorName}</div>
          <div class="hist ${gap ? 'gap' : ''}" data-history-tag>מצב היסטורי · <span class="ltr">${secondLabel(this.minute)}</span></div>
          ${this.shows3d && this.sceneDescription
            ? html`<sw-plan-3d data-history-3d .description=${this.sceneDescription} .selectedId=${this.selectedId} .preset=${this.preset3d} .frameKey=${b.floorId} .labels=${this.sceneMemo?.labels ?? {}}
                .cameras=${b.anchors.filter((a) => a.resource_type === 'camera').map((a) => ({ id: a.id, label: entityName(a) }))} exportName=${`plan-3d-${b.floorName}-${this.date}`}
                .sunAt=${tMs} .walkable=${REPLAY_VIEW.walkable} .stillsAvailable=${REPLAY_VIEW.stillsAvailable}
                @realistic-change=${(e: CustomEvent<RealisticChangeDetail>) => { if (this.real3d !== e.detail.on) this.real3d = e.detail.on; }}
                @part-select=${(e: CustomEvent<PartSelectDetail>) => this.onPartSelect(e)}></sw-plan-3d>`
            : nothing}
          <sw-plan-canvas style=${this.shows3d ? 'display:none' : ''} alwaysLabel .planWidth=${b.width} .planHeight=${b.height} .plan=${b.planSvg} .imageUrl=${b.imageUrl} .hideImage=${!this.planImage} .markers=${this.scrubMarkers} .selectedId=${this.selectedId} .zones=${zonesWithChips(b.zones)} .geometry=${this.geometry} .structureLevel=${this.level} .catalog=${this.catalogLookup} .anchorPositions=${Object.fromEntries(b.anchors.map((a) => [`${a.resource_type}:${a.resource_id}`, { x: a.position.x, y: a.position.y, rotation: a.rotation_degrees } as AnchorPosition]))} .entityStates=${drawn.states} .roomStates=${layer} dimEntities
            @marker-select=${(e: CustomEvent<MarkerSelectDetail>) => { this.selectedId = e.detail.id; this.frameFailed = false; }}></sw-plan-canvas>
          ${this.threeState === 'loading' ? html`<div class="hist below" data-3d-loading>טוען תלת-ממד…</div>` : nothing}
          ${this.threeState === 'error' ? html`<div class="hist below" data-3d-load-error>תלת-ממד לא נטען: ${this.threeError}</div>` : nothing}
          ${this.shows3d ? nothing : html`<div class="legend"><span>כחול = יש הקלטה</span><span>מקווקו = לא ידוע / לא מוקלט</span><span>צהוב = מואר</span><span>כחול בהיר = נוכחות</span></div>`}
          ${gap ? html`<div class="gapbar" data-history-gap role="status"><sw-icon name="warning" size=${14}></sw-icon><span>פער בהקלטה <span class="ltr">${this.fmtHm(Date.parse(gap.from))}–${this.fmtHm(Date.parse(gap.to))}</span> — המערכת לא הייתה מחוברת. מצבי ההתקנים לא ידועים, המצלמות לפי ה־NVR.</span></div>` : nothing}
          ${this.snapLoading && !rep && !this.snapError ? html`<div class="cover" data-history-loading><sw-state-panel state="loading" heading="טוען את מצב הקומה…" hint="היסטוריה מקומית, הקלטות ואירועים."></sw-state-panel></div>` : nothing}
          ${this.snapError && !rep ? html`<div class="cover" data-history-error><sw-state-panel state="error" heading="לא ניתן לטעון את המצב ההיסטורי" hint="המפה הנוכחית מוצגת ללא מצבים. נסו שוב." actionLabel="ניסיון חוזר" @action=${() => { this.snapshot = null; void this.fetchSnapshot(); }}></sw-state-panel></div>` : nothing}
          ${noHistory && !this.snapLoading && !this.playing
            ? html`<div class="cover" data-history-none><sw-state-panel icon="history" state="empty" heading="אין עדיין היסטוריה לקומה הזאת" hint=${historyFrom !== null ? `ההיסטוריה המקומית מתחילה ${this.fmtWhen(coverage!.from!)}. לפני כן מוצגת התוכנית בלבד, ההקלטות לפי ה־NVR.` : 'לפני תחילת ההיסטוריה המקומית מוצגת התוכנית בלבד, ההקלטות לפי ה־NVR.'}
                actionLabel=${historyFrom !== null && historyFrom > tMs ? 'לרגע הראשון המוקלט' : ''} @action=${() => { if (historyFrom !== null) this.goTo(historyFrom); }}></sw-state-panel></div>`
            : nothing}
        </div>
        <div class="panel">
          ${this.renderLayers(status, retention)}
          <div class="details ${this.detailsOpen ? 'open' : ''}" data-history-details-sheet>
            <div class="sheet-hd"><span>פרטים</span><span class="grow"></span><sw-button size="sm" @click=${() => (this.detailsOpen = false)}>סגירה</sw-button></div>
            ${this.panelCards(b, parts)}
          </div>
        </div>
      </div>
      <div class="tlx" data-history-timeline>
        <div class="tlrow">
          <sw-badge kind="historic"></sw-badge>
          <span class="time" data-history-time-bar>${when}</span>
          <div class="seg" role="group" aria-label="אופן">
            <button type="button" aria-pressed=${this.mode === 'snapshot' ? 'true' : 'false'} data-mode="snapshot" @click=${() => this.setMode('snapshot')}>רגע אחד</button>
            <button type="button" aria-pressed=${this.mode === 'play' ? 'true' : 'false'} data-mode="play" @click=${() => this.setMode('play')}>ניגון תקופה</button>
          </div>
          ${this.mode === 'play'
            ? html`<button type="button" class="play" data-play aria-label=${this.playing ? 'השהיה' : 'ניגון'} aria-pressed=${this.playing ? 'true' : 'false'} @click=${() => this.togglePlay()}><sw-icon name=${this.playing ? 'pause' : 'play'} size=${18}></sw-icon></button>
              <div class="seg speed" role="group" aria-label="מהירות">${SPEEDS.map((s) => html`<button type="button" data-speed=${s} aria-pressed=${this.speed === s ? 'true' : 'false'} @click=${() => (this.speed = s)}>×${s}</button>`)}</div>`
            : nothing}
          <sw-chip data-step="-60" @click=${() => this.setMinute(this.minute - 60)}>-1 שעה</sw-chip><sw-chip data-step="-5" @click=${() => this.setMinute(this.minute - 5)}>-5 דק׳</sw-chip><sw-chip data-step="5" @click=${() => this.setMinute(this.minute + 5)}>+5 דק׳</sw-chip><sw-chip data-step="60" @click=${() => this.setMinute(this.minute + 60)}>+1 שעה</sw-chip>
          <span class="grow"></span>
          <div class="seg win" role="group" aria-label="חלון">${SCRUB_WINDOWS.map((w) => html`<button type="button" data-window=${w.minutes} aria-pressed=${this.winMinutes === w.minutes ? 'true' : 'false'} @click=${() => this.setWindow(w.minutes)}>${w.label}</button>`)}</div>
          <span class="dateq"><sw-field><input type="date" lang=${dateInputLang()} .value=${this.date} min=${minDate ?? ''} max=${dateInZone(new Date(), this.tz)} data-ltr aria-label="תאריך" @change=${(e: Event) => this.setDate((e.target as HTMLInputElement).value)} /></sw-field></span>
          ${this.mode === 'play' ? html`<span class="note keys"><span class="kbd">רווח</span> ניגון · <span class="kbd">←</span><span class="kbd">→</span> צעד</span>` : nothing}
        </div>
        <div class="track">
          <sw-history-lanes .lanes=${lanes} .gaps=${gaps} .from=${winFrom} .to=${winTo} .cursor=${cursorMs} .limit=${limitMs < winTo ? limitMs : null} @seek=${(e: CustomEvent<{ ms: number }>) => this.setMinute(this.minuteOfMs(e.detail.ms))}></sw-history-lanes>
          <div class="tlwrap">
            <sw-timeline compact .segments=${segs} .events=${tlEvents} .cursor=${this.minute} .limit=${this.limitMinute} .follow=${false} .windowMinutes=${this.winMinutes} .viewStart=${this.winStart} precision="estimated"
              @seek=${(e: CustomEvent<{ minute: number }>) => this.setMinute(e.detail.minute)} @scrub=${(e: CustomEvent<{ minute: number }>) => this.setMinute(e.detail.minute)} @window-change=${(e: Event) => this.onTimelineWindow(e)}></sw-timeline>
          </div>
        </div>
      </div>
    `;
  }

  // ---- demo (design preview without a backend) ----

  private get demoMarkers(): PlanMarker[] {
    const covered = (id: string) => (id === 'cam-3' ? 'unknown' : this.minute >= 190 && this.minute <= 205 ? 'unknown' : 'historic');
    const cams: PlanMarker[] = demoCameras.filter((c) => c.floorId === this.floorId).map((c) => ({ id: c.id, kind: 'camera', label: c.name, x: c.x, y: c.y, rotation: c.rotation, fov: c.fov, state: c.state === 'forbidden' ? 'forbidden' : covered(c.id) }));
    const ents: PlanMarker[] = demoEntities.filter((e) => e.floorId === this.floorId).map((e, i) => ({ id: e.id, kind: e.domain, label: e.name, x: e.x, y: e.y, state: i % 2 ? 'unknown' : 'historic' }));
    return [...cams, ...ents];
  }

  private renderDemo() {
    const floor = demoFloors.find((f) => f.id === this.floorId) ?? demoFloors[0];
    return html`
      <div class="head lead-head">
        <div><h1>מפה היסטורית · ${bidi(floor.name)}</h1><div class="sub">מצב המפה בזמן נבחר · פעולות פיזיות כבויות בחקירה · נתוני הדגמה</div></div>
        <span class="grow"></span>
        <a href="#/explore/floors/${floor.id}"><sw-button icon="live">חזרה ל־Live</sw-button></a>
      </div>
      <div class="bar">
        <sw-badge kind="historic"></sw-badge>
        <span class="time">2026-09-14 ${minuteLabel(this.minute)}</span>
        <input type="range" min="0" max="1439" .value=${String(this.minute)} @input=${(e: Event) => (this.minute = Number((e.target as HTMLInputElement).value))} aria-label="זמן" />
        <sw-chip @click=${() => (this.minute = Math.max(0, this.minute - 60))}>-1 שעה</sw-chip><sw-chip @click=${() => (this.minute = Math.min(1439, this.minute + 60))}>+1 שעה</sw-chip>
        <span class="grow"></span>
        <span style="font-size:var(--sw-fs-xs);color:var(--sw-text-2)">גרסת מפה 3 (תקפה מ־01.09)</span>
      </div>
      <div class="stage alone">
        <sw-plan-canvas .planWidth=${floor.planWidth} .planHeight=${floor.planHeight} .plan=${demoPlan(floor.id)} .markers=${this.demoMarkers}></sw-plan-canvas>
        <div class="legend"><span>כחול = יש הקלטה בזמן זה</span><span>מקווקו = לא ידוע / פער</span><span>ישות: מצב ידוע אחרון</span></div>
      </div>
    `;
  }

  render() {
    // CR-TIMESCRUB101: the time scrub only with a backend and the setting on; otherwise exactly the screens of before
    return isApi() ? (this.scrub ? this.renderScrub() : this.renderApi()) : this.renderDemo();
  }
}
