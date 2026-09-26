import { LitElement, html, css, nothing } from 'lit';
import { customElement, property, state, query } from 'lit/decorators.js';
import '../components/sw-button';
import '../components/sw-badge';
import '../components/sw-chip';
import '../components/sw-drawer';
import '../components/sw-popover';
import '../components/sw-icon';
import '../components/sw-field';
import '../components/sw-camera-tile';
import '../components/sw-state-panel';
import '../components/sw-dialog';
import '../map/sw-plan-canvas';
import type { PlanMarker, MarkerSelectDetail, SwPlanCanvas } from '../map/sw-plan-canvas';
import type { StateKind } from '../components/sw-badge';
import type { SceneKind } from '../components/sw-scene';
import { demoCameras, demoEntities, demoFloors, demoRooms, type DemoCamera, type DemoEntity } from '../fixtures/demo';
import { demoScene } from '../fixtures/catalog';
import { t } from '../i18n/he';
import { navigate } from '../router';
import { cameraState, entityName, loadMap, updateAnchor, type MapBundle } from '../api/maps';
import { snapshotUrl } from '../api/media';
import { findFloor, firstFloor, loadTree, type CatalogTree } from '../api/catalog';
import { isApi } from '../api/session';
import { bidi } from '../i18n/bidi';
import { ApiError, describeError } from '../api/client';
import type { Anchor } from '../api/types';
import { pointInPolygon } from '../api/zones';
import { createView, listViews, wallHref, type SavedView } from '../api/views';
import '../components/sw-toggle';
import { ACTION_ERROR_LABEL, ACTION_STATUS_LABEL, awaitAction, domainLabel, entityMarkerKind, entityTone, fmtTime, runAction, stateLabel, subscribeHa, type HaActionArgSpec, type HaActionRecord, type HaActionSpec, type HaEntity } from '../api/ha';
import { geometryFor } from '../api/geometry';
import { circuitToken, type AnchorPosition, type CatalogLookup, type GeometryDoc } from '../map/geometry';
import { loadLibrary, lookup3dOf, lookupOf } from '../api/plan-catalog';
import { buildScene, type Catalog3DLookup, type SceneAnchor, type SceneDescription, type SceneInput } from '../map/scene-builder';
import type { ScenePreset } from '../map/scene-three'; // type only: the three chunk stays out of the entry bundle
import type { PartSelectDetail } from '../map/sw-plan-3d';
import { boundItemOf } from '../map/part-select';
import { WEBGL_UNAVAILABLE_HE, webglAvailable } from '../map/webgl';
import { demoSceneInput, demoSceneLabels } from '../fixtures/demo-3d';
import { circuitAction } from '../map/circuit-action';
import { countLabel, renderLevelChips } from './plan-studio-panel';

/** Hebrew names for enum choices the adapters offer (T040). */
const ARG_CHOICE_HE: Record<string, string> = { off: 'כבוי', heat: 'חימום', cool: 'קירור', heat_cool: 'חימום/קירור', auto: 'אוטומטי', dry: 'ייבוש', fan_only: 'מאוורר בלבד' };

type ScreenState = 'ready' | 'loading' | 'empty' | 'error' | 'forbidden' | 'stale' | 'partial';
type Layer = 'cameras' | 'doors' | 'lights' | 'sensors' | 'zones' | 'structure' | 'objects' | 'connectors';

const LAYERS: { id: Layer; icon: 'camera' | 'door' | 'light' | 'sensor' | 'map' | 'wall' | 'grid' | 'stairs'; label: () => string }[] = [
  { id: 'cameras', icon: 'camera', label: () => t('floor.cameras') },
  { id: 'doors', icon: 'door', label: () => t('floor.doors') },
  { id: 'lights', icon: 'light', label: () => t('floor.lights') },
  { id: 'sensors', icon: 'sensor', label: () => t('floor.sensors') },
  { id: 'zones', icon: 'map', label: () => 'חדרים ואזורים' },
  { id: 'structure', icon: 'wall', label: () => 'מבנה' },
  { id: 'objects', icon: 'grid', label: () => 'עצמים' },
  { id: 'connectors', icon: 'stairs', label: () => 'מחברים' },
];
/** Layers that came after the first stored layer lists: stored as "-<id>" when switched off, so an old list still shows them. */
const LATE_LAYERS: Layer[] = ['structure', 'objects', 'connectors'];

/** One build of the 3D scene with what it was built from (T087): the structure keys compare by identity, the live states
 * by a signature string; the camera list and hover labels are built with it. */
interface SceneBuild {
  structure: unknown[];
  states: string;
  desc: SceneDescription;
  cameras: { id: string; label: string }[];
  labels: Record<string, string>;
}

const SCENES: SceneKind[] = ['entrance', 'lobby', 'corridor', 'hall', 'parking', 'warehouse', 'backyard', 'driveway', 'night'];

/**
 * SC04 — interactive floor plan (board 1 screen 4). Backed by the add-on API (published plan image,
 * anchors, camera registry) with the demo fixtures as a stand-in when no backend answers.
 */

/** A short label for a floor button: the number in the name ("קומה -1" → "-1", "מתנס – קרקע" → "קרקע", else first 4 letters). */
function floorShort(name: string): string {
  const num = name.match(/-?\d+/);
  if (num) return num[0];
  if (/קרקע/.test(name)) return 'ק';
  if (/גג/.test(name)) return 'גג';
  if (/מרתף/.test(name)) return 'מ';
  const last = name.split(/[\s–-]+/).filter(Boolean).pop() ?? name;
  return last.slice(0, 4);
}

@customElement('explore-floor-map')
export class ExploreFloorMap extends LitElement {
  @property() floorId = 'f0';
  @property() screenState: ScreenState = 'ready';
  /** Search hits: zone id to highlight and zoom to; camera / entity id whose pin to open. */
  @property() focusZone = '';
  @property() focusCamera = '';
  @property() focusEntity = '';
  /** A global search hit of kind object (T085): the object to centre on and mark. */
  @property() focusObject = '';
  @state() private focusedObjectId: string | null = null;
  @state() private selectedZoneId: string | null = null;

  @state() private bundle: MapBundle | null = null;
  @state() private tree: CatalogTree | null = null;
  @state() private loadError = '';
  @state() private noFloors = false;
  @state() private selectedId: string | null = null;
  @state() private anchor: { x: number; y: number } | null = null;
  @state() private layers = new Set<Layer>(['cameras', 'doors', 'lights', 'sensors', 'zones', 'structure', 'objects', 'connectors']);
  /** T085: the library's shapes for the object layer, fetched by the bundle's catalog revision. */
  @state() private catalogLookup: CatalogLookup | null = null;
  @state() private levelFilter: string | null = null;
  /** Plan Studio: the published structure of the shown version (fetched by hash after the bundle). */
  @state() private geometry: GeometryDoc | null = null;
  /** T087: the 2D / 3D toggle. The element's module - and with it the three chunk - is imported on the first switch. */
  @state() private view3d = false;
  @state() private threeState: 'idle' | 'loading' | 'ready' | 'error' = 'idle';
  @state() private threeError = '';
  @state() private preset3d: ScenePreset = 'iso';
  @state() private catalog3d: Catalog3DLookup | null = null;
  private itemNames = new Map<string, string>();
  private sceneMemo: SceneBuild | null = null;
  private sceneTimer = 0;
  private sceneDue = false;
  private geomSeq = 0;
  @state() private pinned = false;
  @state() private panel = false;
  /** Multi-camera selection (T043): anchor ids of the picked cameras while the mode is on. */
  @state() private multi = false;
  /** Side list of what is on the plan (2.10): open state kept per browser. */
  @state() private sideList = (() => { try { return localStorage.getItem('sw.map.sidelist') === '1'; } catch { return false; } })();
  /** Owner round 3 (2.6): a jump from the list pans only, unless the viewer asks for a zoom as well. */
  @state() private jumpZoom = (() => { try { return localStorage.getItem('sw.map.jumpzoom') === '1'; } catch { return false; } })();
  private focusZoom = true;
  /** "Save the selection as a view" dialog (T043) and the view it produced. */
  @state() private saveView: { name: string; cols: number; rows: number; shared: boolean; canShare: boolean; busy: boolean; error: string | null } | null = null;
  @state() private savedView: SavedView | null = null;
  @state() private picked: string[] = [];
  @state() private narrow = false;
  @state() private syncConnected = true;
  @state() private action: { entityId: string; spec: HaActionSpec; record: HaActionRecord | null; error: string; busy: boolean } | null = null;
  @state() private confirmSpec: { entityId: string; spec: HaActionSpec } | null = null;
  private stopWs: (() => void) | null = null;
  @query('sw-plan-canvas') private canvas?: SwPlanCanvas;
  @query('.stage') private stage?: HTMLDivElement;

  private mq = window.matchMedia('(max-width: 767px)');
  private onMq = () => (this.narrow = this.mq.matches);

  static styles = css`
    :host {
      display: flex;
      flex-direction: column;
      block-size: 100%;
      min-block-size: 0;
    }
    .head {
      display: flex;
      flex-wrap: wrap;
      align-items: flex-end;
      gap: 10px 12px;
      padding: 14px 24px 12px;
    }
    .crumbs {
      display: flex;
      align-items: center;
      gap: 4px;
      color: var(--sw-text-3);
      font-size: var(--sw-fs-xs);
      margin-block-end: 4px;
    }
    .crumbs a {
      color: inherit;
      text-decoration: none;
    }
    .crumbs a:hover {
      color: var(--sw-accent-text);
    }
    .crumbs sw-icon {
      color: var(--sw-border-strong);
    }
    h1 {
      margin: 0;
      font-size: var(--sw-fs-2xl);
      font-weight: var(--sw-fw-semibold);
      line-height: 1.2;
      letter-spacing: -0.01em;
    }
    .sub {
      color: var(--sw-text-3);
      font-size: var(--sw-fs-sm);
      margin-block-start: 2px;
      display: flex;
      gap: 8px;
      align-items: center;
      flex-wrap: wrap;
    }
    .spacer {
      flex: 1;
    }
    .tools {
      display: flex;
      align-items: center;
      gap: 8px;
      flex-wrap: wrap;
    }
    .tools sw-field {
      inline-size: 170px;
    }
    .layers {
      display: inline-flex;
      gap: 2px;
      background: var(--sw-surface-3);
      border-radius: 8px;
      padding: 2px;
    }
    .layers button {
      border: 0;
      background: transparent;
      inline-size: 28px;
      block-size: 26px;
      border-radius: 6px;
      display: grid;
      place-items: center;
      color: var(--sw-text-3);
      cursor: pointer;
    }
    .layers button.on {
      background: var(--sw-surface);
      color: var(--sw-accent-text);
      box-shadow: var(--sw-shadow-1);
    }
    .stage {
      position: relative;
      flex: 1;
      min-block-size: 360px;
      margin: 0 24px 24px;
      border: 1px solid var(--sw-border);
      border-radius: var(--sw-r-lg);
      background: var(--sw-surface);
      box-shadow: var(--sw-shadow-1);
      overflow: hidden;
    }
    .floorbtns {
      position: absolute;
      inset-inline-start: 12px;
      inset-block-start: 56px;
      z-index: var(--sw-z-map-ui);
      display: flex;
      flex-direction: column;
      gap: 4px;
      max-block-size: 60%;
      overflow: auto;
    }
    .floorbtns button {
      font: inherit;
      font-size: var(--sw-fs-xs);
      font-weight: var(--sw-fw-semibold);
      min-inline-size: 38px;
      padding: 6px 8px;
      border-radius: 9px;
      border: 1px solid var(--sw-border);
      background: var(--sw-surface);
      color: var(--sw-text-2);
      cursor: pointer;
      box-shadow: var(--sw-shadow-1);
      direction: ltr;
    }
    .floorbtns button.on {
      background: var(--sw-accent);
      border-color: var(--sw-accent);
      color: #fff;
    }
    .jz {
      display: flex;
      gap: 6px;
      align-items: center;
      font-size: var(--sw-fs-xs);
      color: var(--sw-text-2);
      padding: 6px 12px;
      border-block-end: 1px solid var(--sw-border);
    }
    /* entity card on phones (owner round 3, 3.6): full-width actions, stacked state row */
    @media (max-width: 640px) {
      .estate {
        flex-direction: column;
        align-items: flex-start;
        gap: 4px;
      }
      .eactions {
        display: grid;
        grid-template-columns: repeat(2, minmax(0, 1fr));
      }
      .eactions .actrow {
        display: flex;
        flex-direction: column;
        align-items: stretch;
      }
      .eactions .actrow sw-button {
        min-inline-size: 0;
      }
      /* the map keeps the screen: one scrolling row of tools, floor buttons replace the floor select, no editor entry */
      .tools {
        flex-wrap: nowrap;
        overflow-x: auto;
        max-inline-size: 100%;
        padding-block-end: 2px;
      }
      .tools .layers,
      .tools sw-field,
      .tools sw-button[icon='edit'] {
        display: none;
      }
      /* the 3D toggle stays in the scrolling tool row, never squeezed (ruling R-P4-7) */
      .tools sw-button[data-view-3d] {
        flex: none;
      }
      .tools .note {
        white-space: nowrap;
      }
      .rename {
        flex-wrap: wrap;
      }
    }
    .floorchip {
      position: absolute;
      inset-inline-start: 12px;
      inset-block-start: 12px;
      z-index: var(--sw-z-map-ui);
      display: inline-flex;
      align-items: center;
      gap: 6px;
      background: var(--sw-surface);
      border: 1px solid var(--sw-border);
      border-radius: 10px;
      padding: 6px 10px;
      font-size: var(--sw-fs-sm);
      font-weight: var(--sw-fw-semibold);
      box-shadow: var(--sw-shadow-1);
    }
    .floorchip sw-icon {
      color: var(--sw-text-3);
    }
    .levelbar {
      position: absolute;
      inset-inline-start: 50%;
      transform: translateX(-50%);
      inset-block-start: 12px;
      z-index: var(--sw-z-map-ui);
      background: var(--sw-surface);
      border: 1px solid var(--sw-border);
      border-radius: 999px;
      padding: 4px 8px;
      box-shadow: var(--sw-shadow-1);
      display: flex;
      gap: 6px;
      flex-wrap: wrap;
      max-inline-size: 60%;
    }
    .circuits {
      position: absolute;
      inset-inline-end: 12px;
      inset-block-start: 12px;
      display: flex;
      flex-direction: column;
      gap: 4px;
      z-index: var(--sw-z-map-ui);
      max-inline-size: 260px;
    }
    /* the layers panel and the side list sit in the same corner: the strip steps aside */
    .circuits.shifted {
      inset-inline-end: 296px;
    }
    .circuits .circuit {
      display: grid;
      grid-template-columns: auto minmax(0, 1fr);
      grid-template-areas: "dot name" "dot cnt";
      gap: 0 8px;
      align-items: center;
      text-align: start;
      padding: 6px 10px;
      border: 1px solid var(--sw-border);
      border-radius: 10px;
      background: var(--sw-surface);
      box-shadow: var(--sw-shadow-1);
      font: inherit;
      font-size: var(--sw-fs-sm);
      color: var(--sw-text);
      cursor: pointer;
    }
    .circuits .circuit i {
      grid-area: dot;
      inline-size: 12px;
      block-size: 12px;
      border-radius: 50%;
      border: 2px solid var(--kc);
      background: transparent;
    }
    .circuits .circuit.on i {
      background: var(--sw-map-glow);
      box-shadow: 0 0 6px var(--sw-map-glow);
    }
    .circuits .circuit .cnt {
      grid-area: cnt;
      font-size: var(--sw-fs-xs);
      color: var(--sw-text-2);
    }
    .circuits .circuit.muted i {
      border-color: var(--sw-stale);
      background: transparent;
      box-shadow: none;
    }
    .circuits .circuit .cnote {
      color: var(--sw-stale);
    }
    .circuits .circuit:disabled {
      cursor: not-allowed;
      opacity: 0.7;
    }
    .circuits .cstatus {
      font-size: var(--sw-fs-xs);
      color: var(--sw-text-2);
      background: var(--sw-surface);
      border-radius: 8px;
      padding: 4px 8px;
    }
    .circuits .err {
      color: var(--sw-danger);
    }
    @media (max-width: 640px) {
      .circuits.shifted {
        display: none;
      }
    }
    .panel {
      position: absolute;
      inset-inline-end: 12px;
      inset-block-start: 12px;
      z-index: var(--sw-z-map-ui);
      inline-size: 272px;
      max-inline-size: calc(100% - 24px);
      background: var(--sw-surface);
      border: 1px solid var(--sw-border);
      border-radius: var(--sw-r-md);
      box-shadow: var(--sw-shadow-3);
      padding: 12px 14px;
    }
    .panel h3 {
      margin: 0;
      font-size: var(--sw-fs-md);
      font-weight: var(--sw-fw-semibold);
    }
    .panel .sub {
      margin-block-end: 6px;
    }
    .panel .prow {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 10px;
      padding: 8px 0;
      border-block-end: 1px solid var(--sw-border);
    }
    .panel .prow:last-of-type {
      border-block-end: 0;
    }
    .panel .prow .lbl {
      display: flex;
      flex-direction: column;
      gap: 1px;
      font-size: var(--sw-fs-sm);
      font-weight: var(--sw-fw-medium);
    }
    .panel .prow .cnt {
      font-size: var(--sw-fs-xs);
      color: var(--sw-text-3);
      font-weight: var(--sw-fw-regular);
    }
    .panel .pnote {
      margin-block-start: 8px;
      padding: 8px 10px;
      border-radius: var(--sw-r-sm);
      background: var(--sw-surface-3);
      font-size: var(--sw-fs-xs);
      color: var(--sw-text-2);
      display: flex;
      gap: 6px;
      align-items: center;
    }
    .pickbar {
      position: absolute;
      inset-inline: 12px;
      inset-block-start: 56px;
      z-index: var(--sw-z-map-ui);
      display: flex;
      align-items: center;
      gap: 8px;
      flex-wrap: wrap;
      background: var(--sw-surface);
      border: 1px solid var(--sw-accent);
      border-radius: var(--sw-r-md);
      padding: 8px 10px;
      box-shadow: var(--sw-shadow-2);
      font-size: var(--sw-fs-sm);
    }
    .pickbar .hint {
      color: var(--sw-text-3);
      font-size: var(--sw-fs-xs);
    }
    .pickbar .grow {
      flex: 1;
    }
    .pickbar .roomchips {
      display: inline-flex;
      flex-wrap: wrap;
      gap: 6px;
      align-items: center;
    }
    .sidelist {
      position: absolute;
      inset-inline-end: 12px;
      inset-block: 12px 56px;
      inline-size: 236px;
      z-index: var(--sw-z-map-ui);
      background: var(--sw-surface);
      border: 1px solid var(--sw-border);
      border-radius: var(--sw-r-md);
      box-shadow: var(--sw-shadow-2);
      display: flex;
      flex-direction: column;
      overflow: hidden;
      font-size: var(--sw-fs-sm);
    }
    .sidelist .sh {
      display: flex;
      align-items: center;
      gap: 6px;
      padding: 8px 10px;
      border-block-end: 1px solid var(--sw-border);
      font-weight: 600;
    }
    .sidelist .sh .grow {
      flex: 1;
    }
    .sidelist .body {
      overflow: auto;
      padding: 4px 0 8px;
    }
    .sidelist .grp {
      padding: 8px 10px 2px;
      font-size: var(--sw-fs-xs);
      color: var(--sw-text-3);
      text-transform: none;
    }
    .sidelist button.it {
      display: flex;
      align-items: center;
      gap: 8px;
      inline-size: 100%;
      padding: 6px 10px;
      border: 0;
      background: none;
      color: var(--sw-text);
      font: inherit;
      text-align: start;
      cursor: pointer;
    }
    .sidelist button.it:hover,
    .sidelist button.it.on {
      background: var(--sw-surface-3);
    }
    .sidelist button.it:focus-visible {
      outline: 2px solid var(--sw-accent);
      outline-offset: -2px;
    }
    .sidelist .dot {
      inline-size: 8px;
      block-size: 8px;
      border-radius: 50%;
      background: var(--dot, var(--sw-text-3));
      flex: none;
    }
    .sidelist .nm {
      flex: 1;
      min-inline-size: 0;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }
    .sidelist .st {
      font-size: var(--sw-fs-xs);
      color: var(--sw-text-3);
    }
    @media (max-width: 720px) {
      .sidelist {
        inline-size: min(236px, 70vw);
      }
    }
    .pickbar .saved {
      flex-basis: 100%;
      color: var(--sw-text-2);
      font-size: var(--sw-fs-xs);
    }
    .pickbar .saved a {
      color: var(--sw-accent);
    }
    .saveform {
      display: flex;
      flex-direction: column;
      gap: 10px;
      min-inline-size: min(480px, 80vw);
      font-size: var(--sw-fs-sm);
    }
    .saveform .row {
      display: flex;
      gap: 12px;
    }
    .saveform .note {
      font-size: var(--sw-fs-xs);
      color: var(--sw-text-3);
    }
    .saveform .err {
      color: var(--sw-danger);
    }
    .banner {
      position: absolute;
      inset-inline: 12px;
      inset-block-start: 12px;
      z-index: var(--sw-z-map-ui);
      background: var(--sw-stale-soft);
      border: 1px dashed var(--sw-stale);
      border-radius: var(--sw-r-md);
      color: var(--sw-text);
    }
    .banner sw-state-panel {
      --sw-accent-soft: transparent;
    }
    .cover {
      position: absolute;
      inset: 0;
      display: grid;
      place-items: center;
      background: var(--sw-surface);
      z-index: var(--sw-z-map-ui);
    }
    .legend {
      position: absolute;
      inset-inline-start: 12px;
      inset-block-end: 12px;
      z-index: var(--sw-z-map-ui);
      display: flex;
      gap: 10px;
      background: rgba(255, 255, 255, 0.92);
      border: 1px solid var(--sw-border);
      border-radius: var(--sw-r-pill);
      padding: 3px 10px;
      font-size: var(--sw-fs-xs);
      color: var(--sw-text-2);
      backdrop-filter: blur(6px);
    }
    .legend span {
      display: inline-flex;
      align-items: center;
      gap: 5px;
    }
    .legend i {
      inline-size: 9px;
      block-size: 9px;
      border-radius: 50%;
      background: var(--lg);
      box-shadow: 0 0 0 1px #fff;
    }
    .meta {
      display: grid;
      grid-template-columns: auto 1fr;
      gap: 4px 10px;
      font-size: var(--sw-fs-xs);
      margin: 0;
    }
    .meta dt {
      color: var(--sw-text-3);
      margin: 0;
    }
    .meta dd {
      margin: 0;
      font-weight: var(--sw-fw-medium);
    }
    .note {
      font-size: var(--sw-fs-xs);
      color: var(--sw-text-3);
    }
    .warn {
      color: var(--sw-danger);
      font-size: var(--sw-fs-xs);
    }
    .actrow {
      display: inline-flex;
      align-items: center;
      gap: 4px;
      flex-wrap: wrap;
    }
    .actrow .arg {
      font: inherit;
      font-size: var(--sw-fs-xs);
      border: 1px solid var(--sw-border-strong);
      border-radius: 6px;
      padding: 3px 6px;
      background: var(--sw-surface);
      color: var(--sw-text);
      max-inline-size: 110px;
    }
    .actrow input.arg[type='number'] {
      inline-size: 72px;
    }
    .actrow .argwrap {
      display: inline-flex;
      align-items: center;
      gap: 2px;
    }
    .actrow .unit {
      font-size: var(--sw-fs-xs);
      color: var(--sw-text-3);
    }
    .statusrow {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 8px;
      font-size: var(--sw-fs-xs);
      color: var(--sw-text-3);
    }
    /* HA entity card (R3): state first, actions as big buttons, details folded */
    .ecard {
      display: grid;
      gap: 10px;
    }
    .estate {
      display: flex;
      align-items: center;
      gap: 10px;
      padding: 10px 12px;
      border-radius: var(--sw-r-sm);
      background: var(--sw-surface-2);
      border: 1px solid var(--sw-border);
    }
    .estate.live {
      background: color-mix(in srgb, var(--sw-accent) 10%, var(--sw-surface));
      border-color: color-mix(in srgb, var(--sw-accent) 35%, var(--sw-border));
    }
    .estate .esub {
      font-size: var(--sw-fs-xs);
      color: var(--sw-text-3);
    }
    .eactions {
      display: flex;
      flex-wrap: wrap;
      gap: 8px;
    }
    .eactions .actrow sw-button {
      min-inline-size: 110px;
    }
    .rename {
      display: flex;
      gap: 6px;
      align-items: center;
    }
    .rename input {
      flex: 1;
      font: inherit;
      padding: 6px 8px;
      border: 1px solid var(--sw-border-strong);
      border-radius: 6px;
      background: var(--sw-surface);
      color: inherit;
    }
    details.more summary {
      cursor: pointer;
      font-size: var(--sw-fs-xs);
      color: var(--sw-text-3);
    }
    details.more .meta {
      margin-block-start: 6px;
    }
    .off {
      aspect-ratio: 16 / 9;
      background: var(--sw-surface-3);
      border-radius: var(--sw-r-sm);
      display: grid;
      place-items: center;
      color: var(--sw-text-2);
      text-align: center;
      padding: 10px;
      font-size: var(--sw-fs-xs);
    }
    .off sw-icon {
      margin-block-end: 4px;
      color: var(--sw-text-3);
    }
    @media (max-width: 767px) {
      .head {
        padding: 12px 12px 8px;
      }
      .stage {
        margin: 0;
        border-radius: 0;
        border-inline: 0;
        box-shadow: none;
      }
      h1 {
        font-size: var(--sw-fs-xl);
      }
      .legend {
        display: none;
      }
    }
  `;

  private onKey = (e: KeyboardEvent) => {
    if (e.key === '3' && !e.ctrlKey && !e.metaKey && !e.altKey && !this.typing(e)) {
      if (this.confirmSpec || this.saveView || e.repeat) return; // a dialog is open, or the key is held down
      e.preventDefault();
      void this.toggle3d();
      return;
    }
    if (e.key !== 'Escape') return;
    if (this.confirmSpec) return; // the dialog handles its own Escape
    if (this.selectedId) {
      const id = this.selectedId;
      this.close();
      if (!this.shows3d) this.canvas?.focusMarker(id);
    } else if (this.panel) this.panel = false;
  };

  /** A key pressed inside a text field, a select or an editable node belongs to it. */
  private typing(e: KeyboardEvent): boolean {
    const target = e.composedPath()[0];
    return target instanceof HTMLElement && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.tagName === 'SELECT' || target.isContentEditable);
  }

  connectedCallback() {
    super.connectedCallback();
    this.narrow = this.mq.matches;
    this.mq.addEventListener('change', this.onMq);
    window.addEventListener('keydown', this.onKey);
    void this.load();
  }

  disconnectedCallback() {
    super.disconnectedCallback();
    window.removeEventListener('keydown', this.onKey);
    this.mq.removeEventListener('change', this.onMq);
    window.clearTimeout(this.sceneTimer);
    this.sceneTimer = 0;
    this.stopWs?.();
    this.stopWs = null;
  }

  /** Entity state pushes (scoped server-side to the floors this user may read). */
  private startWs() {
    if (this.stopWs || !isApi()) return;
    this.stopWs = subscribeHa((m) => {
      const b = this.bundle;
      if (m.type === 'entity_state_changed' && b) {
        const eid = m.entity.entity_id;
        const switches = Object.values(b.circuitStates).some((s) => s.entity_id === eid);
        if (!switches && !b.anchors.some((a) => a.resource_type === 'ha_entity' && a.resource_id === eid)) return;
        this.bundle = {
          ...b,
          anchors: b.anchors.map((a) => (a.resource_type === 'ha_entity' && a.resource_id === eid ? { ...a, entity: { ...(a.entity ?? ({} as HaEntity)), ...m.entity, actions: a.entity?.actions } } : a)),
          // a circuit's switch changed: its lamps follow at once (T085)
          circuitStates: switches ? Object.fromEntries(Object.entries(b.circuitStates).map(([id, s]) => [id, s.entity_id === eid ? { ...s, state: m.entity.state, fresh: m.entity.fresh, available: m.entity.available } : s])) : b.circuitStates,
        };
      } else if (m.type === 'ha_sync_state') this.syncConnected = m.connected;
      else if (m.type === 'heartbeat') this.syncConnected = m.sync.connected;
    });
  }

  protected updated(changed: Map<string, unknown>) {
    if (changed.has('floorId') && changed.get('floorId') !== undefined) {
      this.selectedId = null;
      this.anchor = null;
      this.selectedZoneId = null;
      void this.load();
    } else if ((changed.has('focusZone') || changed.has('focusCamera') || changed.has('focusEntity') || changed.has('focusObject')) && this.bundle) {
      void this.applyFocus();
    }
  }

  /** Bring a search hit into view once the map is on screen. */
  private async applyFocus() {
    const b = this.bundle;
    if (!b || (!this.focusZone && !this.focusCamera && !this.focusEntity && !this.focusObject)) return;
    await this.updateComplete;
    const canvas = this.shows3d ? undefined : this.canvas; // hidden under the 3D: the selection still applies, the zoom does not
    const z = this.focusZone ? b.zones.find((x) => x.id === this.focusZone) : null;
    if (z) {
      const xs = z.polygon.map((p) => p.x);
      const ys = z.polygon.map((p) => p.y);
      this.selectedZoneId = z.id;
      canvas?.zoomToBox(Math.min(...xs), Math.min(...ys), Math.max(...xs), Math.max(...ys));
    }
    const a = this.focusCamera
      ? b.anchors.find((x) => x.resource_type === 'camera' && x.resource_id === this.focusCamera)
      : this.focusEntity
        ? b.anchors.find((x) => x.resource_type === 'ha_entity' && x.resource_id === this.focusEntity)
        : null;
    if (a) {
      if (canvas) {
        if (this.focusZoom) canvas.zoomToBox(a.position.x - 0.15, a.position.y - 0.15, a.position.x + 0.15, a.position.y + 0.15, 48, 2.2);
        else canvas.centerOn(a.position.x, a.position.y);
        await this.updateComplete;
      }
      const p = canvas?.toScreen(a.position.x, a.position.y) ?? null;
      this.selectedId = a.id;
      this.anchor = p ? { x: p.x, y: p.y } : null;
    }
    if (this.focusObject) {
      const o = this.geometry?.objects.find((x) => x.id === this.focusObject);
      if (!o) return; // the document arrives after the bundle: the geometry load calls applyFocus again
      this.focusedObjectId = o.id;
      canvas?.centerOn(o.position[0], o.position[1]);
    }
  }

  private async load() {
    this.loadError = '';
    try {
      let tree = this.tree ?? (await loadTree());
      // a floor created after the tree was cached (a hash navigation to it): read the tree again before redirecting
      if (isApi() && this.tree && !findFloor(tree, this.floorId)) tree = await loadTree();
      this.tree = tree;
      // Links such as the nav entry point at the fixture floor "f0"; with a backend, open the first real floor.
      if (isApi() && !findFloor(tree, this.floorId)) {
        const first = firstFloor(tree);
        if (first && first.id !== this.floorId) {
          navigate(`/explore/floors/${first.id}`);
          return;
        }
        if (!first) {
          // Fresh installation: no site/building/floor yet — say so instead of asking the API for a fixture id.
          this.noFloors = true;
          this.bundle = null;
          return;
        }
      }
      this.noFloors = false;
      this.restoreLayers();
      this.levelFilter = null;
      this.bundle = await loadMap(this.floorId);
      const seq = ++this.geomSeq;
      this.geometry = null;
      void geometryFor(this.bundle).then((g) => {
        if (seq === this.geomSeq) {
          this.geometry = g; // live HA updates replace the bundle object: compare loads, not objects
          if (this.focusObject) void this.applyFocus();
        }
      });
      if (this.bundle.source === 'api') {
        this.startWs();
        void loadLibrary(this.bundle.catalogRevision).then((lib) => {
          this.catalogLookup = lookupOf(lib);
          this.catalog3d = lookup3dOf(lib);
          this.itemNames = new Map(lib.items.map((i) => [i.id, i.names.he]));
        }).catch(() => {}); // without the library objects draw as plain boxes
      }
      void this.applyFocus();
    } catch (err) {
      this.loadError = describeError(err);
      this.bundle = null;
    }
  }

  /** Floors of the building this floor belongs to, with a short unique label each (the quick buttons on the map). */
  private get buildingFloors(): { id: string; name: string; short: string; hasPlan: boolean }[] {
    if (this.tree?.source !== 'api') return [];
    for (const s of this.tree.sites) {
      for (const b of s.buildings ?? []) {
        const fl = b.floors ?? [];
        if (!fl.some((f) => f.id === this.floorId)) continue;
        const shorts = fl.map((f) => floorShort(f.name));
        return fl.map((f, i) => ({ id: f.id, name: f.name, hasPlan: f.has_plan, short: shorts.filter((x) => x === shorts[i]).length > 1 ? `${shorts[i]}${i + 1}` : shorts[i] }));
      }
    }
    return [];
  }

  private get floors(): { id: string; name: string; cameraCount: number; hasPlan: boolean }[] {
    if (this.tree?.source === 'api') {
      return this.tree.sites.flatMap((s) => (s.buildings ?? []).flatMap((b) => (b.floors ?? []).map((f) => ({ id: f.id, name: `${b.name} · ${f.name}`, cameraCount: f.camera_count, hasPlan: f.has_plan }))));
    }
    return demoFloors.map((f) => ({ id: f.id, name: f.name, cameraCount: f.cameraCount, hasPlan: f.hasPlan }));
  }

  private get markers(): PlanMarker[] {
    const b = this.bundle;
    if (!b) return [];
    const stale = this.screenState === 'stale';
    if (b.source === 'demo') {
      const cams: PlanMarker[] = this.layers.has('cameras')
        ? demoCameras.filter((c) => c.floorId === b.floorId).map((c) => ({ id: c.id, kind: 'camera', label: c.name, x: c.x, y: c.y, rotation: c.rotation, fov: c.fov, state: c.state }))
        : [];
      const ents: PlanMarker[] = demoEntities
        .filter((e) => e.floorId === b.floorId)
        .filter((e) => (e.domain === 'lock' && this.layers.has('doors')) || (e.domain === 'light' && this.layers.has('lights')) || (e.domain === 'binary_sensor' && this.layers.has('sensors')))
        .map((e) => ({ id: e.id, kind: e.domain, label: e.name, x: e.x, y: e.y, state: (stale ? 'stale' : 'neutral') as StateKind }));
      return [...cams, ...ents];
    }
    return b.anchors
      .filter((a) => (a.resource_type === 'camera' ? this.layers.has('cameras') : this.layers.has(a.layer_id === 'doors' ? 'doors' : a.layer_id === 'lights' ? 'lights' : 'sensors')))
      .filter((a) => !this.levelFilter || (a.level_id ?? b.levels.find((l) => l.is_default)?.id ?? 'L0') === this.levelFilter)
      .map((a) => ({
        id: a.id,
        kind: a.resource_type === 'camera' ? 'camera' : entityMarkerKind(a.layer_id, a.entity?.domain),
        label: entityName(a),
        x: a.position.x,
        y: a.position.y,
        rotation: a.rotation_degrees,
        fov: a.field_of_view_degrees ?? undefined,
        radius: a.coverage_radius ?? undefined,
        polygon: a.coverage_polygon ? a.coverage_polygon.map(([x, y]) => ({ x, y })) : undefined,
        labelPos: a.label_pos ?? undefined,
        level: a.level_id ?? null,
        state: a.resource_type === 'camera' ? cameraState(a) : stale ? 'stale' : this.entityTone(a.entity),
      }));
  }

  /** T085: what the object layer needs from the bundle - bound bodies sit on their live anchors, lamps glow by their
   * circuit's switch or their own entity. */
  private get anchorPositions(): Record<string, AnchorPosition> {
    const out: Record<string, AnchorPosition> = {};
    for (const a of this.bundle?.anchors ?? []) out[`${a.resource_type}:${a.resource_id}`] = { x: a.position.x, y: a.position.y, rotation: a.rotation_degrees };
    return out;
  }

  private get circuitStateMap(): Record<string, string | null> {
    return Object.fromEntries(Object.entries(this.bundle?.circuitStates ?? {}).map(([id, s]) => [id, s.state]));
  }

  private get entityStateMap(): Record<string, string | null> {
    const out: Record<string, string | null> = {};
    for (const a of this.bundle?.anchors ?? []) if (a.resource_type === 'ha_entity') out[a.resource_id] = a.entity?.state ?? null;
    return out;
  }

  // ---- 3D (T087) ----

  /** The 3D shows no live state on a stale screen or while the Home Assistant sync is down - the 2D dims its entity pins
   * then too (entityTone with fresh && syncConnected). */
  private get states3dStale(): boolean {
    return this.screenState === 'stale' || !this.syncConnected;
  }

  /** The entity states the 3D reads: null (unknown) when stale or when the entity itself is not fresh. */
  private get entityStates3d(): Record<string, string | null> {
    const stale = this.states3dStale;
    const out: Record<string, string | null> = {};
    for (const a of this.bundle?.anchors ?? []) if (a.resource_type === 'ha_entity') out[a.resource_id] = stale || a.entity?.fresh === false ? null : a.entity?.state ?? null;
    return out;
  }

  /** The circuit switches the 3D reads: null when stale or when the switch is not fresh (its lamps do not glow). */
  private get circuitStates3d(): Record<string, string | null> {
    const stale = this.states3dStale;
    return Object.fromEntries(Object.entries(this.bundle?.circuitStates ?? {}).map(([id, c]) => [id, stale || c.fresh === false ? null : c.state]));
  }

  /** The anchor layer switches of the 2D markers, shared by the 3D. */
  private anchorShown(a: { resource_type: string; layer_id: string }): boolean {
    return a.resource_type === 'camera' ? this.layers.has('cameras') : this.layers.has(a.layer_id === 'doors' ? 'doors' : a.layer_id === 'lights' ? 'lights' : 'sensors');
  }

  /** The anchors as the scene builder wants them, filtered by the same layer switches as the 2D markers. A marker the
   * viewer may not see (state "forbidden") is left out: the builder knows no permissions. */
  private get sceneAnchors(): SceneAnchor[] {
    const b = this.bundle;
    if (!b || b.source !== 'api') return [];
    const states = this.entityStates3d;
    return b.anchors
      .filter((a) => this.anchorShown(a) && (a.resource_type !== 'camera' || cameraState(a) !== 'forbidden'))
      .map((a) => ({
        id: a.id, resource_type: a.resource_type, resource_id: a.resource_id, x: a.position.x, y: a.position.y, rotation: a.rotation_degrees, fov: a.field_of_view_degrees ?? null, radius: a.coverage_radius ?? null,
        polygon: a.coverage_polygon ?? null, level_id: a.level_id ?? null, layer_id: a.layer_id, label: entityName(a), state: a.resource_type === 'ha_entity' ? states[a.resource_id] ?? null : null,
        online: a.resource_type === 'camera' ? (a.camera ? a.camera.status === 'online' : null) : null, mount_height_m: a.mount_height_m ?? null, tilt_deg: a.tilt_deg ?? null,
      }));
  }

  /** What the scene reads from the bundle apart from the live states. A state push replaces the bundle and its anchor
   * list but keeps every value here, so it never counts as a structural change. */
  private sceneStructureKeys(b: MapBundle): unknown[] {
    const anchors = b.source === 'api'
      ? b.anchors.map((a) => [a.id, a.revision, a.position.x, a.position.y, a.rotation_degrees, a.field_of_view_degrees, a.coverage_radius, a.coverage_polygon?.length, a.level_id, a.layer_id, a.mount_height_m, a.tilt_deg, entityName(a)].join('|')).join(';')
      : '';
    return [b.floorId, b.width, b.height, anchors, b.zones, this.geometry, this.layers, this.levelFilter, this.catalog3d, this.itemNames, this.screenState];
  }

  /** The live values the scene reads: entity states (doors, lamps, sprites), circuit switches, camera status. */
  private sceneStatesKey(b: MapBundle): string {
    if (b.source === 'demo') return '';
    const cams = b.anchors.filter((a) => a.resource_type === 'camera').map((a) => `${a.id}:${a.camera?.status ?? ''}`).join(',');
    return JSON.stringify([this.entityStates3d, this.circuitStates3d, cams, this.syncConnected]);
  }

  /** The floor has something to show in 3D - a cheap test for the toggle; the scene itself is built only in 3D. */
  private get hasScene(): boolean {
    const b = this.bundle;
    if (!b) return false;
    if (b.source === 'demo') return !!demoFloors.find((f) => f.id === b.floorId)?.hasPlan && demoRooms(b.floorId).length > 0;
    return this.geometry !== null;
  }

  /** The scene of the shown floor with its camera list and hover labels. Called only while the 3D is on screen - the 2D
   * never builds it. Rebuilt at once when what it reads changed; live state changes (a lamp that switches changes its
   * instance group) are collected for 100 ms and built once, so a burst of pushes costs one scene. */
  private scene3d(): SceneBuild | null {
    const b = this.bundle;
    if (!b || !this.hasScene) return null;
    const structure = this.sceneStructureKeys(b);
    const states = this.sceneStatesKey(b);
    const memo = this.sceneMemo;
    const same = !!memo && memo.structure.length === structure.length && memo.structure.every((k, i) => k === structure[i]);
    if (memo && same && memo.states === states) return memo;
    if (memo && same && !this.sceneDue) {
      if (!this.sceneTimer) this.sceneTimer = window.setTimeout(() => { this.sceneTimer = 0; this.sceneDue = true; if (this.view3d) this.requestUpdate(); }, 100);
      return memo;
    }
    let base: SceneInput | null = null;
    // a stale screen or a lost Home Assistant sync hands the builder explicit nulls: it draws every live state as
    // unknown, like the dimmed 2D pins (the api branch reads entityStates3d / circuitStates3d, which apply the same rule)
    const stale = this.states3dStale;
    const unknown = (m: Record<string, string | null>) => (stale ? Object.fromEntries(Object.keys(m).map((k) => [k, null])) : m);
    let cameras: { id: string; label: string }[] = [];
    const labels: Record<string, string> = {};
    if (b.source === 'demo') {
      const demo = demoSceneInput(b.floorId);
      const hidden = new Set(demoCameras.filter((c) => c.floorId === b.floorId && c.state === 'forbidden').map((c) => c.id));
      if (demo) base = { ...demo, entityStates: unknown(demo.entityStates), circuitStates: unknown(demo.circuitStates), anchors: demo.anchors.filter((a) => this.anchorShown(a) && !hidden.has(a.id)).map((a) => (stale ? { ...a, state: null } : a)) };
      cameras = this.layers.has('cameras') ? demoCameras.filter((c) => c.floorId === b.floorId && !hidden.has(c.id)).map((c) => ({ id: c.id, label: c.name })) : [];
      Object.assign(labels, demoSceneLabels(b.floorId));
    } else if (this.geometry) {
      base = { doc: this.geometry, width: b.width, height: b.height, anchors: this.sceneAnchors, entityStates: this.entityStates3d, circuitStates: this.circuitStates3d, catalog: this.catalog3d,
        zones: b.zones.map((z) => ({ id: z.id, name: z.name, polygon: z.polygon, level_id: z.level_id ?? null })) };
      cameras = b.anchors.filter((a) => a.resource_type === 'camera' && this.layers.has('cameras') && cameraState(a) !== 'forbidden').map((a) => ({ id: a.id, label: entityName(a) }));
      // hover labels: anchors by their map name, objects by label or library name, zones by name
      for (const a of b.anchors) labels[a.id] = entityName(a);
      for (const o of this.geometry.objects) labels[o.id] = o.label || this.itemNames.get(o.item_id) || o.item_id;
      for (const z of b.zones) labels[z.id] = z.name;
    }
    if (!base) return null;
    const desc = buildScene({ ...base, level: this.levelFilter, layers: { structure: this.layers.has('structure'), objects: this.layers.has('objects'), connectors: this.layers.has('connectors'), zones: this.layers.has('zones') } });
    this.sceneMemo = { structure, states, desc, cameras, labels };
    this.sceneDue = false;
    window.clearTimeout(this.sceneTimer); // a pending state rebuild is part of this one
    this.sceneTimer = 0;
    return this.sceneMemo;
  }

  /** The 3D is on screen (the element's module loaded and the floor has a scene): the 2D canvas stays mounted but hidden
   * underneath (its pan and zoom survive the round trip) and the 2D legend of pin colours steps aside. */
  private get shows3d(): boolean {
    return this.view3d && this.threeState === 'ready' && this.hasScene;
  }

  private get can3d(): boolean {
    return webglAvailable() && this.hasScene;
  }

  private async toggle3d(): Promise<void> {
    if (this.shows3d) {
      this.view3d = false;
      await this.updateComplete;
      this.onViewChange(); // the canvas is back: an open card re-anchors at its pin
      return;
    }
    if (!this.can3d || this.threeState === 'loading') return;
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
    if (!this.can3d) return; // the floor changed (or lost its structure) while the chunk loaded
    this.anchor = null; // the 3D has no pin to hang a popover on: an open card continues as a drawer
    this.sceneDue = true; // states that changed while the 2D was shown are built at once, not after the push window
    this.view3d = true;
  }

  /** The shared selection, as the 3D shows it: the pin, else the focused object, else the room. */
  private get sel3d(): string | null {
    return this.selectedId ?? this.focusedObjectId ?? this.selectedZoneId;
  }

  /** A click in the 3D (ruling R-P4-6), mirroring the 2D handlers: a camera or an entity opens its existing card; a lamp
   * of a circuit runs the circuit's existing action (circuitAction + trigger: the strip's route, permission, guards and
   * confirmation) and is selected - when the action is blocked only the selection happens and the strip's disabled
   * button says why; the body of an entity opens that entity's card; a room toggles its selection; the floor clears.
   * While picking cameras (multi) a camera or a room toggles its picks and a lamp neither switches nor selects.
   * Everything else follows the rule shared with the history map and the event page (part-select.boundItemOf): a door or
   * an object bound to an entity opens that entity's card, an unbound object is focused, walls, connectors and unbound
   * openings leave the selection as it is. */
  private onPartSelect(e: CustomEvent<PartSelectDetail>) {
    const { id, kind } = e.detail;
    const b = this.bundle;
    if (!id || !kind || !b) {
      if (this.multi) return; // the 2D keeps the picks on an empty click as well
      this.close();
      this.focusedObjectId = null;
      this.selectedZoneId = null;
      return;
    }
    if (this.multi && kind !== 'zone') {
      const a = b.anchors.find((x) => x.id === id);
      if (kind === 'camera' && a?.resource_type === 'camera') this.togglePick(a.id);
      return;
    }
    if (kind === 'object') {
      const circuit = this.geometry?.circuits.find((k) => k.member_ids.includes(id));
      const s = circuit ? b.circuitStates[circuit.id] : undefined;
      if (s) {
        const act = circuitAction(s, { busy: !!this.action?.busy && this.action.entityId === s.entity_id, stale: this.screenState === 'stale' });
        if (act.spec && !act.blocked) this.trigger(s.entity_id, act.spec);
        this.close();
        this.selectedZoneId = null;
        this.focusedObjectId = id;
        return;
      }
    }
    const t = kind === 'zone' ? null : boundItemOf({ id, kind }, this.geometry, b.anchors);
    if (t && 'anchor' in t) {
      this.selectedZoneId = null;
      this.focusedObjectId = null;
      this.selectedId = t.anchor;
      this.anchor = null; // no pin on screen: the card opens as a drawer
      return;
    }
    if (t) {
      this.close();
      this.selectedZoneId = null;
      this.focusedObjectId = t.object;
      return;
    }
    if (kind === 'zone') {
      if (this.multi) {
        this.pickZone(id);
        return;
      }
      this.focusedObjectId = null;
      this.selectedZoneId = this.selectedZoneId === id ? null : id; // the 2D zone-select toggles the same way
      this.close();
    }
  }

  private render3d(b: MapBundle) {
    const s = this.scene3d();
    if (!s) return nothing;
    const now = new Date(); // the local date (toISOString is UTC: a day behind in the evening, a day ahead after midnight)
    const stamp = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
    return html`<sw-plan-3d data-floor-3d .description=${s.desc} .selectedId=${this.sel3d} .preset=${this.preset3d} .cameras=${s.cameras} .labels=${s.labels}
      exportName=${`plan-3d-${b.floorName}${this.levelFilter ? `-${this.levelFilter}` : ''}-${stamp}`} @part-select=${(e: CustomEvent<PartSelectDetail>) => this.onPartSelect(e)}></sw-plan-3d>`;
  }

  /** Items per layer for the panel (M07: counts next to every toggle). */
  private layerCounts(): Record<Layer, number> {
    const b = this.bundle;
    const out: Record<Layer, number> = { cameras: 0, doors: 0, lights: 0, sensors: 0, zones: b?.zones.length ?? 0, structure: this.geometry?.walls.length ?? 0,
      objects: this.geometry?.objects.length ?? 0, connectors: this.geometry?.connectors.length ?? 0 };
    if (!b) return out;
    if (b.source === 'demo') {
      out.cameras = demoCameras.filter((c) => c.floorId === b.floorId).length;
      for (const e of demoEntities.filter((x) => x.floorId === b.floorId)) {
        if (e.domain === 'lock') out.doors++;
        else if (e.domain === 'light') out.lights++;
        else out.sensors++;
      }
      return out;
    }
    for (const a of b.anchors) {
      if (a.resource_type === 'camera') out.cameras++;
      else if (a.layer_id === 'doors') out.doors++;
      else if (a.layer_id === 'lights') out.lights++;
      else out.sensors++;
    }
    return out;
  }

  /** Name of the zone a pin sits in (M06: "קומה 2 / ליד המעליות"). */
  private zoneOf(a: Anchor): string | null {
    const z = this.bundle?.zones.find((zone) => pointInPolygon(a.position, zone.polygon));
    return z?.name ?? null;
  }

  private toggleLayer(layer: Layer) {
    const next = new Set(this.layers);
    if (next.has(layer)) next.delete(layer);
    else next.add(layer);
    this.setLayers(next);
  }

  /** Layer state is remembered per floor in this browser (M07: "מצב שכבות נשמר עם התצוגה"); never on the server.
   * '-structure' (and, since T085, '-objects' / '-connectors') records an explicit "off": lists stored before those layers
   * existed must still show them. */
  private setLayers(next: Set<Layer>) {
    this.layers = next;
    try {
      const stored: string[] = [...next];
      for (const id of LATE_LAYERS) if (!next.has(id)) stored.push(`-${id}`);
      localStorage.setItem(`sw.floor.layers.${this.floorId}`, JSON.stringify(stored));
    } catch {
      /* private mode or blocked storage: the choice lives for this page only */
    }
  }

  private restoreLayers() {
    try {
      const raw = localStorage.getItem(`sw.floor.layers.${this.floorId}`);
      if (!raw) return;
      const arr = JSON.parse(raw) as string[];
      if (!Array.isArray(arr)) return;
      const next = new Set<Layer>(arr.filter((l): l is Layer => LAYERS.some((x) => x.id === l)));
      for (const id of LATE_LAYERS) if (!arr.includes(`-${id}`)) next.add(id);
      this.layers = next;
    } catch {
      /* ignore */
    }
  }

  // ---- multi-camera selection (T043) ----

  private cameraAnchors() {
    return (this.bundle?.anchors ?? []).filter((a) => a.resource_type === 'camera' && this.layers.has('cameras'));
  }

  private togglePick(anchorId: string) {
    this.picked = this.picked.includes(anchorId) ? this.picked.filter((x) => x !== anchorId) : [...this.picked, anchorId];
  }

  private pickedCameraIds(): string[] {
    const by = new Map((this.bundle?.anchors ?? []).map((a) => [a.id, a.resource_id]));
    return this.picked.map((id) => by.get(id)).filter((x): x is string => !!x);
  }

  private setMulti(on: boolean) {
    this.multi = on;
    this.picked = [];
    this.saveView = null;
    this.savedView = null;
    if (on) this.close();
  }

  /** Rectangle selection from the canvas: the cameras inside the box join the selection (T043). */
  private addPicks(ids: string[]) {
    const cams = new Set(this.cameraAnchors().map((a) => a.id));
    const add = ids.filter((id) => cams.has(id) && !this.picked.includes(id));
    if (add.length) this.picked = [...this.picked, ...add];
  }

  /** A click on a room while picking toggles every camera placed inside it (T043 "room"). */
  private pickZone(zoneId: string) {
    const z = this.bundle?.zones.find((x) => x.id === zoneId);
    if (!z) return;
    const inside = this.cameraAnchors().filter((a) => pointInPolygon(a.position, z.polygon)).map((a) => a.id);
    if (!inside.length) return;
    const all = inside.every((id) => this.picked.includes(id));
    this.picked = all ? this.picked.filter((id) => !inside.includes(id)) : [...this.picked, ...inside.filter((id) => !this.picked.includes(id))];
  }

  /** One chip per room that holds cameras (2.4): picking a room by name never needs a click inside a concave shape. */
  private roomChips() {
    const b = this.bundle;
    if (!b) return nothing;
    const cams = this.cameraAnchors();
    const rooms = b.zones.map((z) => ({ z, ids: cams.filter((a) => pointInPolygon(a.position, z.polygon)).map((a) => a.id) })).filter((r) => r.ids.length);
    if (!rooms.length) return nothing;
    return html`<span class="roomchips" data-room-chips>${rooms.map((r) => html`<sw-chip icon="layers" data-room-chip=${r.z.id} ?selected=${r.ids.every((id) => this.picked.includes(id))} @click=${() => this.pickZone(r.z.id)}>${r.z.name} (${r.ids.length})</sw-chip>`)}</span>`;
  }

  /** Side list (2.10): cameras and HA entities on this plan; a click zooms to the pin and opens its card. */
  private toggleSideList() {
    this.sideList = !this.sideList;
    try {
      localStorage.setItem('sw.map.sidelist', this.sideList ? '1' : '0');
    } catch {
      /* private mode */
    }
  }

  private async jumpTo(a: Anchor) {
    if (a.resource_type === 'camera') {
      this.focusCamera = a.resource_id;
      this.focusEntity = '';
    } else {
      this.focusEntity = a.resource_id;
      this.focusCamera = '';
    }
    this.focusZone = '';
    if (this.multi && a.resource_type === 'camera') {
      this.togglePick(a.id);
      return;
    }
    this.focusZoom = this.jumpZoom;
    await this.applyFocus();
    // the focus properties re-trigger applyFocus on the next update: keep the choice for that pass, then back to the default
    window.setTimeout(() => (this.focusZoom = true), 900);
  }

  private setJumpZoom(on: boolean) {
    this.jumpZoom = on;
    try {
      localStorage.setItem('sw.map.jumpzoom', on ? '1' : '0');
    } catch {
      /* private mode */
    }
  }

  private renderSideList() {
    const b = this.bundle;
    if (!b || !this.sideList || b.source !== 'api') return nothing;
    const cams = b.anchors.filter((a) => a.resource_type === 'camera');
    const ents = b.anchors.filter((a) => a.resource_type === 'ha_entity');
    const domains: Record<string, string> = { light: 'תאורה', switch: 'מפסקים', lock: 'מנעולים', binary_sensor: 'חיישנים', sensor: 'חיישנים', cover: 'תריסים', climate: 'מיזוג', media_player: 'מדיה', alarm_control_panel: 'אזעקה' };
    const groups = new Map<string, Anchor[]>();
    for (const a of ents) {
      const d = a.entity?.domain ?? a.resource_id.split('.')[0];
      groups.set(d, [...(groups.get(d) ?? []), a]);
    }
    const dotOf = (a: Anchor) => (a.camera ? (a.camera.status === 'online' ? '#22c55e' : a.camera.status === 'offline' ? '#ef4444' : 'var(--sw-text-3)') : a.entity?.state === 'on' || a.entity?.state === 'unlocked' || a.entity?.state === 'open' ? 'var(--sw-accent)' : 'var(--sw-text-3)');
    return html`<div class="sidelist" data-sidelist>
      <div class="sh"><sw-icon name="list" size=${14}></sw-icon>על התוכנית<span class="grow"></span><sw-button variant="ghost" size="sm" iconOnly icon="close" label="סגור" @click=${() => this.toggleSideList()}></sw-button></div>
      <label class="jz" data-jump-zoom-row><input type="checkbox" data-jump-zoom .checked=${this.jumpZoom} @change=${(e: Event) => this.setJumpZoom((e.target as HTMLInputElement).checked)} /> זום בקפיצה לרכיב</label>
      <div class="body">
        <div class="grp">קומות</div>
        ${this.floors.map((f) => html`<button class="it ${f.id === this.floorId ? 'on' : ''}" data-side-floor=${f.id} @click=${() => { if (f.id !== this.floorId) navigate(`/explore/floors/${f.id}`); }}>
          <sw-icon name="building" size=${12}></sw-icon><span class="nm">${bidi(f.name)}</span><span class="st">${f.cameraCount} מצלמות${f.hasPlan ? '' : ' · אין תוכנית'}</span></button>`)}
        <div class="grp">מצלמות (${cams.length})</div>
        ${cams.map((a) => html`<button class="it ${this.selectedId === a.id || this.picked.includes(a.id) ? 'on' : ''}" data-side-camera=${a.resource_id} @click=${() => this.jumpTo(a)}>
          <span class="dot" style="--dot:${dotOf(a)}"></span><span class="nm">${a.camera?.name ?? a.label ?? a.resource_id}</span><span class="st">${a.camera?.status === 'online' ? 'חיה' : a.camera?.status === 'offline' ? 'מנותקת' : ''}</span></button>`)}
        ${[...groups.entries()].map(([d, list]) => html`<div class="grp">${domains[d] ?? d} (${list.length})</div>
          ${list.map((a) => html`<button class="it ${this.selectedId === a.id ? 'on' : ''}" data-side-entity=${a.resource_id} @click=${() => this.jumpTo(a)}>
            <span class="dot" style="--dot:${dotOf(a)}"></span><span class="nm">${entityName(a)}</span><span class="st">${a.entity ? stateLabel(a.entity) : ''}</span></button>`)}`)}
        ${!cams.length && !ents.length ? html`<div class="grp">אין פריטים מוצבים על התוכנית הזו.</div>` : nothing}
      </div>
    </div>`;
  }

  /** The selection split the way the task card asks: watchable now, offline, and without live permission. */
  private pickSummary() {
    const picked = this.picked.map((id) => this.bundle?.anchors.find((a) => a.id === id)).filter((a): a is Anchor => !!a);
    const denied = picked.filter((a) => a.camera?.can_view_live === false).length;
    const online = picked.filter((a) => a.camera?.can_view_live !== false && a.camera?.status === 'online').length;
    return { total: picked.length, online, offline: picked.length - online - denied, denied };
  }

  private pickDot(a: Anchor | undefined): string {
    if (!a?.camera) return 'var(--sw-text-3)';
    if (a.camera.can_view_live === false) return 'var(--sw-text-3)';
    return a.camera.status === 'online' ? '#22c55e' : '#ef4444';
  }

  /** The cameras a saved view may hold: the picked ones the caller may watch live, sixteen at most. */
  private saveableCameraIds(): string[] {
    const by = new Map((this.bundle?.anchors ?? []).map((a) => [a.id, a]));
    return this.picked.map((id) => by.get(id)).filter((a): a is Anchor => !!a && a.camera?.can_view_live !== false).map((a) => a.resource_id).slice(0, 16);
  }

  private openSave() {
    const n = this.saveableCameraIds().length;
    if (!n) return;
    const cols = n <= 1 ? 1 : n <= 4 ? 2 : n <= 9 ? 3 : 4;
    const rows = Math.max(1, Math.min(4, Math.ceil(n / cols)));
    const floorName = this.floors.find((f) => f.id === this.floorId)?.name ?? this.bundle?.floorName ?? 'מפה';
    this.savedView = null;
    this.saveView = { name: `${floorName} · ${n} מצלמות`, cols, rows, shared: false, canShare: false, busy: false, error: null };
    listViews().then((r) => { if (this.saveView) this.saveView = { ...this.saveView, canShare: r.can_share }; }).catch(() => undefined);
  }

  private async submitSave() {
    const s = this.saveView;
    if (!s || s.busy) return;
    if (!s.name.trim()) {
      this.saveView = { ...s, error: 'לתצוגה צריך שם.' };
      return;
    }
    const cameras = this.saveableCameraIds();
    if (!cameras.length) {
      this.saveView = { ...s, error: 'אין בבחירה מצלמה שמותר לך לצפות בה.' };
      return;
    }
    this.saveView = { ...s, busy: true, error: null };
    try {
      this.savedView = await createView({ name: s.name.trim(), cameras, cols: s.cols, rows: s.rows, shared: s.shared, kiosk: false });
      this.saveView = null;
    } catch (err) {
      this.saveView = { ...s, busy: false, error: describeError(err) };
    }
  }

  private renderSaveDialog() {
    const s = this.saveView;
    if (!s) return nothing;
    const cameras = this.saveableCameraIds();
    const { denied } = this.pickSummary();
    const over = Math.max(0, this.picked.length - denied - 16);
    const set = (patch: Partial<NonNullable<typeof s>>) => (this.saveView = { ...s, ...patch });
    return html`<sw-dialog open heading="שמירה כתצוגה" subheading=${`${cameras.length} מצלמות מהמפה · התצוגה נפתחת בקיר החי או בקיוסק`} data-save-view-dialog @close=${() => (this.saveView = null)}>
      <div class="saveform">
        <sw-field label="שם"><input data-save-view-name .value=${s.name} maxlength="60" @input=${(ev: Event) => set({ name: (ev.target as HTMLInputElement).value })} @keydown=${(ev: KeyboardEvent) => ev.key === 'Enter' && this.submitSave()} /></sw-field>
        <div class="row">
          <sw-field label="עמודות (קיוסק)"><select data-save-view-cols @change=${(ev: Event) => set({ cols: Number((ev.target as HTMLSelectElement).value) })}>${[1, 2, 3, 4].map((n) => html`<option value=${n} ?selected=${n === s.cols}>${n}</option>`)}</select></sw-field>
          <sw-field label="שורות (קיוסק)"><select data-save-view-rows @change=${(ev: Event) => set({ rows: Number((ev.target as HTMLSelectElement).value) })}>${[1, 2, 3, 4].map((n) => html`<option value=${n} ?selected=${n === s.rows}>${n}</option>`)}</select></sw-field>
        </div>
        <sw-toggle ?checked=${s.shared} ?disabled=${!s.canShare} label=${s.canShare ? 'משותפת לכל המשתמשים' : 'משותפת (דורש הרשאת ניהול משתמשים)'} data-save-view-shared @change=${(ev: CustomEvent<{ checked: boolean }>) => set({ shared: ev.detail.checked })}></sw-toggle>
        ${denied ? html`<div class="note">${denied} מצלמות ללא הרשאת צפייה חיה לא ייכללו בתצוגה.</div>` : nothing}
        ${over ? html`<div class="note">תצוגה מכילה עד 16 מצלמות; ${over} האחרונות שנבחרו לא ייכללו.</div>` : nothing}
        <div class="note">הקיר פותח את המצלמות בפריסה אוטומטית; הקיוסק מציג ${s.cols}×${s.rows} מצלמות בעמוד.</div>
        ${s.error ? html`<div class="err" role="alert" data-save-view-error>${s.error}</div>` : nothing}
      </div>
      <div slot="footer"><sw-button variant="primary" ?disabled=${s.busy} data-save-view-submit @click=${() => this.submitSave()}>${s.busy ? 'שומר…' : 'שמור תצוגה'}</sw-button><sw-button variant="ghost" @click=${() => (this.saveView = null)}>${t('actions.cancel')}</sw-button></div>
    </sw-dialog>`;
  }

  private openWall() {
    const ids = this.pickedCameraIds();
    if (ids.length) navigate('/live/wall', { cameras: ids.join(',') });
  }

  private openSync() {
    const ids = this.pickedCameraIds();
    if (!ids.length) return;
    navigate('/investigate/playback', { camera: ids[0], extra: ids.slice(1, 4).join(',') });
  }

  private renderPickbar() {
    const b = this.bundle;
    if (!b) return nothing;
    const cams = this.cameraAnchors();
    const anchorOf = (id: string) => b.anchors.find((x) => x.id === id);
    const name = (id: string) => { const a = anchorOf(id); return a?.camera?.name ?? a?.label ?? a?.resource_id ?? id; };
    const sum = this.pickSummary();
    const placed = b.anchors.filter((a) => a.resource_type === 'camera').length;
    const onFloor = this.floors.find((f) => f.id === this.floorId)?.cameraCount ?? placed;
    const unplaced = Math.max(0, onFloor - placed);
    const hint = sum.total
      ? `נבחרו ${sum.total} · ${sum.online} זמינות${sum.offline ? ` · ${sum.offline} לא מקוונות` : ''}${sum.denied ? ` · ${sum.denied} ללא הרשאה` : ''}${unplaced ? ` · ${unplaced} מצלמות של הקומה אינן על המפה` : ''}`
      : `לחץ על מצלמות או גרור מלבן על המפה · לחיצה על חדר בוחרת את מצלמותיו · Shift+גרירה מזיזה את המפה · עד 4 לניגון מסונכרן${unplaced ? ` · ${unplaced} מצלמות של הקומה אינן על המפה` : ''}`;
    return html`<div class="pickbar" data-pickbar>
      <span class="hint" data-pick-hint>${hint}</span>
      ${this.picked.map((id) => { const a = anchorOf(id); const denied = a?.camera?.can_view_live === false; return html`<sw-chip selected icon="camera" dot=${this.pickDot(a)} title=${denied ? 'אין הרשאת צפייה חיה' : a?.camera?.status === 'online' ? 'מקוונת' : 'לא מקוונת'} data-pick-chip=${denied ? 'denied' : a?.camera?.status ?? 'unknown'} @click=${() => this.togglePick(id)}>${name(id)}</sw-chip>`; })}
      <sw-chip data-pick-all @click=${() => (this.picked = cams.map((a) => a.id))}>בחר הכל (${cams.length})</sw-chip>
      ${this.roomChips()}
      <span class="grow"></span>
      <sw-button variant="primary" size="sm" icon="live" ?disabled=${!this.picked.length} data-pick-wall @click=${() => this.openWall()}>קיר חי (${this.picked.length})</sw-button>
      <sw-button size="sm" icon="history" ?disabled=${!this.picked.length || this.picked.length > 4} data-pick-sync @click=${() => this.openSync()}>ניגון מסונכרן</sw-button>
      <sw-button size="sm" icon="layers" ?disabled=${!this.saveableCameraIds().length} data-pick-save @click=${() => this.openSave()}>שמור כתצוגה</sw-button>
      <sw-button variant="ghost" size="sm" @click=${() => (this.picked = [])}>נקה</sw-button>
      <sw-button variant="ghost" size="sm" icon="close" @click=${() => this.setMulti(false)}>סיום</sw-button>
      ${this.savedView ? html`<span class="saved" data-view-saved>התצוגה „${this.savedView.name}” נשמרה (${this.savedView.cameras.length} מצלמות) · <a href="#/live/views" data-view-saved-open>תצוגות שמורות</a> · <a href=${wallHref(this.savedView)}>פתח בקיר</a></span>` : nothing}
    </div>`;
  }

  private onSelect(e: CustomEvent<MarkerSelectDetail>) {
    this.focusedObjectId = null;
    if (this.multi) {
      const a = e.detail.id ? this.bundle?.anchors.find((x) => x.id === e.detail.id) : null;
      if (a?.resource_type === 'camera') this.togglePick(a.id);
      return;
    }
    this.selectedZoneId = null;
    this.selectedId = e.detail.id;
    this.anchor = e.detail.id && e.detail.sx !== undefined && e.detail.sy !== undefined ? { x: e.detail.sx, y: e.detail.sy } : null;
  }

  private onViewChange() {
    if (!this.selectedId || !this.canvas || this.shows3d) return; // under the 3D the card is a drawer
    const m = this.markers.find((x) => x.id === this.selectedId);
    if (!m) return;
    const p = this.canvas.toScreen(m.x, m.y);
    this.anchor = { x: p.x, y: p.y };
  }

  private close() {
    this.selectedId = null;
    this.anchor = null;
  }

  private entityTone(e: HaEntity | null | undefined): StateKind {
    if (!e) return 'unknown';
    return entityTone({ ...e, fresh: e.fresh && this.syncConnected });
  }

  // ---- HA actions (through the bridge integration, in the user's own HA identity) ----

  /** Values typed for actions with arguments (T040), keyed by action id; defaults come from the entity's attributes. */
  @state() private actionArgs: Record<string, string> = {};

  private argDefault(e: HaEntity, arg: HaActionArgSpec): string {
    const at = e.attributes as Record<string, unknown>;
    if (arg.name === 'hvac_mode') return String((at.hvac_mode as string) ?? e.state ?? arg.choices?.[0] ?? '');
    if (arg.name === 'temperature') return String((at.temperature as number) ?? 21);
    if (arg.name === 'volume_level') return String(Math.round(((at.volume_level as number) ?? 0.5) * 100));
    if (arg.name === 'value') return String(e.state ?? at.min ?? 0);
    if (arg.name === 'option') return String(e.state ?? (at.options as string[] | undefined)?.[0] ?? '');
    if (arg.name === 'brightness_pct') return String(typeof at.brightness === 'number' ? Math.round((at.brightness / 255) * 100) : 100);
    if (arg.name === 'percentage') return String((at.percentage as number) ?? 100);
    return String(arg.choices?.[0] ?? arg.min ?? '');
  }

  /** The argument values to send: numbers as numbers (volume back to a fraction), enums / text as typed. */
  private argsFor(e: HaEntity, spec: HaActionSpec): Record<string, unknown> {
    const out: Record<string, unknown> = {};
    for (const a of spec.argument_specs ?? []) {
      const raw = this.actionArgs[`${spec.id}:${a.name}`] ?? this.argDefault(e, a);
      if (a.type === 'int' || a.type === 'float') {
        const n = Number(raw);
        if (!Number.isFinite(n)) continue;
        out[a.name] = a.name === 'volume_level' ? Math.min(1, Math.max(0, n / 100)) : n;
      } else out[a.name] = raw;
    }
    return out;
  }

  private argChoices(e: HaEntity, arg: HaActionArgSpec): string[] {
    const at = e.attributes as Record<string, unknown>;
    if (arg.name === 'hvac_mode' && Array.isArray(at.hvac_modes)) return (at.hvac_modes as string[]).filter((m) => arg.choices?.includes(m));
    if (arg.name === 'option' && Array.isArray(at.options)) return at.options as string[];
    return arg.choices ?? [];
  }

  private renderArg(e: HaEntity, spec: HaActionSpec, arg: HaActionArgSpec) {
    const key = `${spec.id}:${arg.name}`;
    const value = this.actionArgs[key] ?? this.argDefault(e, arg);
    const set = (v: string) => (this.actionArgs = { ...this.actionArgs, [key]: v });
    const at = e.attributes as Record<string, unknown>;
    const choices = this.argChoices(e, arg);
    if (choices.length) return html`<select class="arg" data-action-arg=${key} aria-label=${arg.name} @change=${(ev: Event) => set((ev.target as HTMLSelectElement).value)}>${choices.map((c) => html`<option value=${c} ?selected=${c === value}>${ARG_CHOICE_HE[c] ?? c}</option>`)}</select>`;
    if (arg.type === 'int' || arg.type === 'float') {
      const min = arg.name === 'volume_level' ? 0 : arg.name === 'value' ? ((at.min as number) ?? arg.min) : arg.name === 'temperature' ? ((at.min_temp as number) ?? arg.min) : arg.min;
      const max = arg.name === 'volume_level' ? 100 : arg.name === 'value' ? ((at.max as number) ?? arg.max) : arg.name === 'temperature' ? ((at.max_temp as number) ?? arg.max) : arg.max;
      const step = arg.name === 'value' ? ((at.step as number) ?? 1) : arg.name === 'temperature' ? 0.5 : 1;
      const unit = arg.name === 'volume_level' || arg.name === 'brightness_pct' || arg.name === 'percentage' ? '%' : arg.name === 'temperature' ? '°' : '';
      return html`<span class="argwrap"><input class="arg" type="number" data-action-arg=${key} aria-label=${arg.name} .value=${value} min=${String(min ?? '')} max=${String(max ?? '')} step=${String(step)} data-ltr @change=${(ev: Event) => set((ev.target as HTMLInputElement).value)} />${unit ? html`<span class="unit">${unit}</span>` : nothing}</span>`;
    }
    return html`<input class="arg" type="text" data-action-arg=${key} aria-label=${arg.name} .value=${value} maxlength=${String(arg.max_len ?? 80)} @change=${(ev: Event) => set((ev.target as HTMLInputElement).value)} />`;
  }

  private trigger(entityId: string, spec: HaActionSpec) {
    if (spec.sensitive) {
      this.confirmSpec = { entityId, spec };
      return;
    }
    void this.send(entityId, spec, false);
  }

  private async send(entityId: string, spec: HaActionSpec, confirmed: boolean) {
    this.confirmSpec = null;
    this.action = { entityId, spec, record: null, error: '', busy: true };
    try {
      const ent = this.bundle?.anchors.find((a) => a.resource_type === 'ha_entity' && a.resource_id === entityId)?.entity;
      const r = await runAction(entityId, spec.id, ent ? this.argsFor(ent, spec) : {}, confirmed);
      this.action = { entityId, spec, record: r, error: '', busy: r.status === 'pending' };
      if (r.status === 'pending') {
        const token = this.action;
        await awaitAction(r.id, (a) => {
          if (this.action === token || this.action?.record?.id === a.id) this.action = { entityId, spec, record: a, error: '', busy: a.status === 'pending' };
        });
      }
    } catch (err) {
      const msg = err instanceof ApiError && err.code === 'bridge_not_paired' ? 'גשר SMPLWISE אינו מצומד ב־Home Assistant. התקנה וצימוד: הגדרות → גשר Home Assistant.' : describeError(err);
      this.action = { entityId, spec, record: null, error: msg, busy: false };
    }
  }

  private apiEntityBody(a: Anchor, floorName: string) {
    const e = a.entity;
    if (!e) return html`<div class="note">ישות HA · <span class="ltr">${a.resource_id}</span> — לא נמצאה בקטלוג המסונכרן (ייתכן שהוסרה מ־Home Assistant).</div>`;
    const tone = this.entityTone(e);
    const act = this.action?.entityId === e.entity_id ? this.action : null;
    const fresh = e.fresh && this.syncConnected;
    const renaming = this.renaming?.id === a.id ? this.renaming : null;
    return html`
      <div class="ecard" data-entity-card>
        <div class="estate ${tone}"><sw-badge kind=${tone} label=${stateLabel(e)}></sw-badge><span class="esub">${domainLabel(e.domain)}${e.area_name ? ` · ${e.area_name}` : ''} · ${floorName}</span></div>
        ${a.label && e.name && a.label !== e.name ? html`<div class="note">ב־Home Assistant: ${e.name}</div>` : nothing}
        ${this.notice ? html`<div class="note" data-notice>${this.notice}</div>` : nothing}
        ${renaming
          ? html`<div class="rename" data-rename-form><input .value=${renaming.value} placeholder=${e.name ?? a.resource_id} aria-label="שם במפה" @input=${(ev: Event) => (this.renaming = { id: a.id, value: (ev.target as HTMLInputElement).value })} @keydown=${(ev: KeyboardEvent) => { if (ev.key === 'Enter') void this.saveRename(a); if (ev.key === 'Escape') this.renaming = null; }} />
              <sw-button size="sm" variant="primary" icon="check" data-rename-save ?disabled=${renaming.busy} @click=${() => this.saveRename(a)}>שמור</sw-button>
              <sw-button size="sm" variant="ghost" @click=${() => (this.renaming = null)}>ביטול</sw-button></div>`
          : nothing}
        ${this.entityActions(a)}
        <details class="more"><summary>פרטים</summary>
          <dl class="meta">
            <dt>${t('entity.lastChanged')}</dt><dd>${fmtTime(e.last_changed)}</dd>
            <dt>נראה לאחרונה</dt><dd>${fmtTime(e.state_seen_at)}</dd>
            <dt>ID</dt><dd><span class="ltr">${e.entity_id}</span></dd>
          </dl>
        </details>
      </div>
      ${!fresh ? html`<div class="warn">${e.state === 'unavailable' ? 'Home Assistant מדווח שהישות אינה זמינה.' : 'הסנכרון מול Home Assistant מנותק — המצב עלול להיות מיושן.'}</div>` : nothing}
      ${e.actions === undefined ? html`<div class="note">${t('entity.noControl')}</div>` : e.actions.length === 0 ? html`<div class="note">קריאה בלבד — אין פעולות מותרות ל־${domainLabel(e.domain)}.</div>` : nothing}
      ${e.actions?.some((s) => s.granted === false) ? html`<div class="note" data-grant-note>פעולה מעומעמת דורשת הרשאה נפרדת (למשל פתיחת דלת) שאינה חלק משליטה כללית בישויות.</div>` : nothing}
      ${act
        ? html`<div class=${act.error || act.record?.status === 'failed' || act.record?.status === 'denied' ? 'warn' : 'note'}>${act.spec.label}: ${act.error ? act.error : act.record ? `${ACTION_STATUS_LABEL[act.record.status]}${act.record.error ? ` — ${ACTION_ERROR_LABEL[act.record.error] ?? act.record.error}` : ''}` : 'שולח…'}</div>`
        : nothing}
    `;
  }

  /** Rename from the card (R3): the manual name lives on the anchor (`label`) and needs placement.edit. */
  @state() private renaming: { id: string; value: string; busy?: boolean } | null = null;
  @state() private notice = '';

  private async saveRename(a: Anchor) {
    const r = this.renaming;
    if (!r || r.id !== a.id || r.busy) return;
    this.renaming = { ...r, busy: true };
    try {
      const saved = await updateAnchor(a.id, { revision: a.revision, label: r.value.trim() || null });
      if (this.bundle) this.bundle = { ...this.bundle, anchors: this.bundle.anchors.map((x) => (x.id === a.id ? { ...x, label: saved.label, revision: saved.revision } : x)) };
      this.renaming = null;
      this.notice = saved.label ? `השם „${saved.label}“ נשמר` : 'חזרה לשם מ־Home Assistant';
    } catch (err) {
      this.notice = describeError(err);
      this.renaming = { ...r, busy: false };
    }
  }

  /** The actions as big buttons inside the card (R3) - the footer keeps only edit / rename. */
  private entityActions(a: Anchor) {
    const e = a.entity;
    const specs = e?.actions ?? [];
    if (!specs.length) return nothing;
    return html`<div class="eactions" data-entity-actions>${this.entityFooter(a)}</div>`;
  }

  private entityFooter(a: Anchor) {
    const e = a.entity;
    const busy = Boolean(this.action && e && this.action.entityId === e.entity_id && this.action.busy);
    const specs = e?.actions ?? [];
    return html`${specs.map((s) => html`<span class="actrow" data-action-row=${s.id}>${e && s.argument_specs?.length ? s.argument_specs.map((a) => this.renderArg(e, s, a)) : nothing}<sw-button block variant=${s.risk === 'sensitive' ? 'danger' : s.sensitive ? 'danger' : 'primary'} ?disabled=${busy || this.screenState === 'stale' || e?.state === 'unavailable' || s.granted === false} title=${s.granted === false ? `נדרשת הרשאה נפרדת: ${s.grant ?? ''}` : s.risk_label ? `פעולה ${s.risk_label}` : ''} data-action=${s.id} data-risk=${s.risk ?? (s.sensitive ? 'attention' : 'routine')} data-granted=${s.granted === false ? 'no' : 'yes'} @click=${() => e && this.trigger(e.entity_id, s)}>${s.label}</sw-button></span>`)}`;
  }

  private renderConfirm() {
    const c = this.confirmSpec;
    if (!c) return nothing;
    const ent = this.bundle?.anchors.find((a) => a.resource_type === 'ha_entity' && a.resource_id === c.entityId)?.entity;
    return html`<sw-dialog open heading=${t('entity.confirm')} subheading=${ent?.name ?? c.entityId} @close=${() => (this.confirmSpec = null)}>
      <div style="font-size:var(--sw-fs-sm);line-height:1.5">הפעולה <strong>${c.spec.label}</strong> על <span class="ltr">${c.entityId}</span> היא פעולה ${c.spec.risk_label ?? 'רגישה'}${c.spec.risk === 'sensitive' ? ' (הרשאה נפרדת)' : ''}. היא תבוצע ב־Home Assistant בזהות שלך ותירשם באודיט.</div>
      <div slot="footer"><sw-button variant="danger" @click=${() => this.send(c.entityId, c.spec, true)}>${c.spec.label}</sw-button><sw-button variant="ghost" @click=${() => (this.confirmSpec = null)}>${t('actions.cancel')}</sw-button></div>
    </sw-dialog>`;
  }

  // ---- demo card bodies (fixtures) ----

  private demoCameraBody(cam: DemoCamera, floorName: string) {
    const reason = cam.state === 'offline' ? t('camera.offlineReason') : cam.state === 'forbidden' ? t('camera.forbiddenReason') : cam.state === 'stale' ? t('camera.staleReason') : '';
    const canView = cam.state === 'live' || cam.state === 'stale';
    return html`
      ${canView
        ? html`<sw-camera-tile name="" state=${cam.state} scene=${demoScene[cam.id] ?? 'lobby'} @click=${() => navigate(`/live/cameras/${cam.id}`)}></sw-camera-tile>`
        : html`<div class="off"><div><sw-icon name=${cam.state === 'forbidden' ? 'lock' : 'offline'} size=${22}></sw-icon><div>${reason}</div></div></div>`}
      <div class="statusrow"><sw-badge kind=${cam.state}></sw-badge><span>${floorName} · ${cam.source}</span></div>
      ${reason && canView ? html`<div class="warn">${reason}</div>` : nothing}
    `;
  }

  private demoEntityBody(ent: DemoEntity) {
    const stale = this.screenState === 'stale';
    const kind: StateKind = stale ? 'stale' : ent.state === 'on' || ent.state === 'unlocked' ? 'live' : 'neutral';
    return html`
      <dl class="meta">
        <dt>${t('entity.state')}</dt><dd><sw-badge kind=${kind} label=${t(ent.stateLabelKey)}></sw-badge></dd>
        <dt>${t('entity.lastChanged')}</dt><dd>${ent.lastChanged}</dd>
        <dt>ID</dt><dd><span class="ltr">${ent.id}</span></dd>
      </dl>
      ${stale ? html`<div class="warn">${t('states.staleHint')}</div>` : nothing}
      ${!ent.controllable ? html`<div class="note">${t('entity.noControl')}</div>` : nothing}
    `;
  }

  // ---- API card body ----

  private apiCameraBody(a: Anchor, floorName: string) {
    const cam = a.camera;
    const st = cameraState(a);
    const scene = SCENES[((cam?.channel ?? 1) - 1) % SCENES.length];
    const canLive = st === 'live' && !!cam && cam.can_view_live !== false;
    const zone = this.zoneOf(a);
    const where = zone ? `${floorName} / ${zone}` : `${floorName} · ערוץ ${cam?.channel ?? '?'}`;
    return html`
      ${st === 'offline'
        ? html`<div class="off"><div><sw-icon name="offline" size=${22}></sw-icon><div>${t('camera.offlineReason')}</div></div></div>`
        : html`<sw-camera-tile name="" state=${st === 'live' ? 'live' : 'unknown'} scene=${scene} poster=${cam ? snapshotUrl(cam.id, Date.now()) : ''} ?live=${canLive} .cameraId=${canLive ? cam.id : ''} data-live=${canLive ? '1' : '0'} @click=${() => cam && navigate(`/live/cameras/${cam.id}`)}></sw-camera-tile>`}
      <div class="statusrow"><sw-badge kind=${st}></sw-badge><span data-where>${where}</span></div>
      <dl class="meta">
        <dt>שם ב־NVR</dt><dd>${cam?.name_source || '—'}${cam ? html` · <span class="ltr">ch ${cam.channel}</span>` : nothing}</dd>
        <dt>נראתה לאחרונה</dt><dd>${cam?.last_seen_at ? cam.last_seen_at.replace('T', ' ').replace('Z', ' UTC') : 'לא נבדק'}</dd>
      </dl>
      <div class="note">${canLive ? 'הזרם נפתח לכרטיס הזה בלבד ונסגר איתו; "צפייה מלאה" פותחת את המצלמה במסך מלא.' : st === 'offline' ? 'המצלמה מנותקת לפי ה־NVR.' : 'תמונה: צילום מה־NVR (מתרענן).'}</div>
    `;
  }

  private renderCard() {
    const b = this.bundle;
    if (!this.selectedId || !b) return nothing;
    let heading = '';
    let sub = '';
    let body: unknown = nothing;
    let footer: unknown = nothing;
    if (b.source === 'demo') {
      const cam = demoCameras.find((c) => c.id === this.selectedId);
      const ent = cam ? undefined : demoEntities.find((e) => e.id === this.selectedId);
      if (!cam && !ent) return nothing;
      heading = cam ? cam.name : ent!.name;
      sub = cam ? `${b.floorName} · ${cam.source}` : `${b.floorName} · ${t(ent!.domain === 'lock' ? 'entity.door' : ent!.domain === 'light' ? 'entity.light' : 'entity.sensor')}`;
      body = cam ? this.demoCameraBody(cam, b.floorName) : this.demoEntityBody(ent!);
      const canView = cam ? cam.state === 'live' || cam.state === 'stale' : false;
      footer = cam
        ? html`<sw-button variant="primary" size="sm" icon="expand" ?disabled=${!canView} @click=${() => navigate(`/live/cameras/${cam.id}`)}>צפייה חיה</sw-button>
            <sw-button size="sm" icon="history" ?disabled=${cam.state === 'forbidden'} @click=${() => navigate('/investigate/playback')}>${t('camera.recordings')}</sw-button>
            <sw-button variant="ghost" size="sm" iconOnly icon="pin" label=${this.pinned ? t('camera.unpin') : t('camera.pin')} @click=${() => (this.pinned = !this.pinned)}></sw-button>`
        : html`<sw-button variant="primary" size="sm" ?disabled=${!ent!.controllable || this.screenState === 'stale'}>${t('entity.control')}</sw-button><sw-button variant="ghost" size="sm">${t('entity.openInHa')}</sw-button>`;
    } else {
      const a = b.anchors.find((x) => x.id === this.selectedId);
      if (!a) return nothing;
      heading = entityName(a);
      sub = `${b.buildingName} · ${b.floorName}`;
      body = a.resource_type === 'camera' ? this.apiCameraBody(a, b.floorName) : this.apiEntityBody(a, b.floorName);
      footer = html`${a.resource_type === 'camera'
          ? html`<sw-button variant="primary" size="sm" icon="expand" ?disabled=${cameraState(a) === 'offline'} @click=${() => a.camera && navigate(`/live/cameras/${a.camera.id}`)}>צפייה מלאה</sw-button>
            <sw-button size="sm" icon="history" ?disabled=${!a.camera} @click=${() => a.camera && navigate('/investigate/playback', { camera: a.camera.id })}>${t('camera.recordings')}</sw-button>`
          : nothing}
        ${a.resource_type === 'ha_entity' && b.permissions.edit && a.entity ? html`<sw-button variant="ghost" size="sm" icon="edit" data-rename @click=${() => (this.renaming = { id: a.id, value: a.label ?? '' })}>שנה שם</sw-button>` : nothing}
        ${b.permissions.edit ? html`<sw-button variant="ghost" size="sm" icon="edit" @click=${() => navigate(`/explore/floors/${b.floorId}/edit`)}>עריכה</sw-button>` : nothing}`;
    }
    if (this.narrow || !this.anchor || this.shows3d) { // over the 3D a 2D pin position means nothing: always the drawer
      return html`<sw-drawer open heading=${heading} subheading=${sub} @close=${this.close}>${body}<div slot="footer">${footer}</div></sw-drawer>`;
    }
    const w = this.stage?.clientWidth ?? 0;
    const h = this.stage?.clientHeight ?? 0;
    return html`<sw-popover heading=${heading} .x=${this.anchor.x} .y=${this.anchor.y} .stageWidth=${w} .stageHeight=${h} @close=${this.close}>${body}<div slot="footer">${footer}</div></sw-popover>`;
  }

  private renderPanel() {
    const counts = this.layerCounts();
    const rows: { id: Layer; label: string; count: string }[] = [
      { id: 'cameras', label: t('floor.cameras'), count: `${counts.cameras} ממוקמות` },
      { id: 'doors', label: 'דלתות ואינטרקום', count: `${counts.doors} ישויות` },
      { id: 'lights', label: t('floor.lights'), count: `${counts.lights} ישויות` },
      { id: 'sensors', label: 'אבטחה וחיישנים', count: `${counts.sensors} ישויות` },
      { id: 'zones', label: 'שמות חדרים', count: counts.zones ? `${counts.zones} אזורים · תוויות לפי רמת זום` : 'אין חדרים מוגדרים' },
      { id: 'structure', label: 'מבנה', count: this.geometry ? `${this.geometry.walls.length} קירות · ${this.geometry.openings.length} פתחים` : 'לא שורטט מבנה' },
      { id: 'objects', label: 'עצמים', count: this.geometry ? `${this.geometry.objects.length} עצמים מהספרייה` : 'אין עצמים' },
      { id: 'connectors', label: 'מחברים', count: this.geometry ? `${this.geometry.connectors.length} מדרגות, רמפות ומעליות` : 'אין מחברים' },
    ];
    return html`<div class="panel" role="group" aria-label="שכבות פעילות" data-layers-panel>
      <h3>שכבות פעילות</h3>
      <div class="sub">הצג רק מה שרלוונטי כרגע</div>
      ${rows.map((r) => html`<div class="prow"><span class="lbl">${r.label}<span class="cnt">${r.count}</span></span><sw-toggle ?checked=${this.layers.has(r.id)} label=${r.label} labelHidden data-layer=${r.id} @change=${(e: CustomEvent<{ checked: boolean }>) => { const next = new Set(this.layers); if (e.detail.checked) next.add(r.id); else next.delete(r.id); this.setLayers(next); }}></sw-toggle></div>`)}
      <div class="pnote"><sw-icon name="shield" size=${14}></sw-icon><span>מתג משנה תצוגה בלבד; ייבוא ישות אינו מעניק הרשאת שליטה בה.</span></div>
    </div>`;
  }

  /** T085: one button per lighting circuit of the published structure - its switch state, and the toggle through the
   * existing entity action path (the same permission, the same confirmation rules, the same audit). */
  private renderCircuitStrip() {
    const b = this.bundle;
    const states = b?.circuitStates ?? {};
    const ids = Object.keys(states);
    if (!b || !ids.length) return nothing;
    const act = this.action;
    return html`<div class="circuits ${this.panel || this.sideList ? 'shifted' : ''}" role="group" aria-label="מעגלי תאורה" data-circuit-strip>
      ${ids.map((id) => {
        const s = states[id];
        const on = s.state === 'on';
        // the entity card's guards (circuitAction, shared with a lamp click in the 3D): no second send while one for this
        // switch is in flight, none on a stale screen or an unavailable switch
        const { spec, blocked, why } = circuitAction(s, { busy: !!act?.busy && act.entityId === s.entity_id, stale: this.screenState === 'stale' });
        const stale = this.screenState === 'stale' || !s.fresh;
        const note = !s.available ? 'לא זמין' : stale ? 'לא מעודכן' : '';
        return html`<button class="circuit ${on ? 'on' : ''} ${note ? 'muted' : ''}" data-circuit-toggle=${id} data-state=${s.state ?? 'unknown'} data-available=${s.available ? 'yes' : 'no'} style=${`--kc: var(--sw-${circuitToken(s.color_token) ?? 'circuit-1'})`} ?disabled=${blocked}
            title=${why ?? (on ? 'כיבוי המעגל' : 'הדלקת המעגל')} @click=${() => { if (spec && !blocked) this.trigger(s.entity_id, spec); }}>
          <i></i><span>${s.name ?? id}</span><span class="cnt">${countLabel(s.member_ids.length, 'מנורה אחת', 'מנורות')} · ${s.state === null ? 'לא ידוע' : on ? 'דולק' : 'כבוי'}${s.power_w ? ` · ${s.power_w} W` : ''}${note ? html` · <span class="cnote" data-circuit-note>${note}</span>` : nothing}</span>
        </button>`;
      })}
      ${act && ids.some((id) => states[id].entity_id === act.entityId)
        ? html`<span class="cstatus" data-circuit-status>${act.error ? html`<span class="err" data-circuit-error>${act.error}</span>` : act.record ? ACTION_STATUS_LABEL[act.record.status] + (act.record.error ? ` · ${ACTION_ERROR_LABEL[act.record.error] ?? act.record.error}` : '') : act.busy ? 'שולח…' : ''}</span>`
        : nothing}
    </div>`;
  }

  private renderStage() {
    const b = this.bundle;
    if (this.loadError) return html`<div class="cover"><sw-state-panel state="error" hint=${this.loadError} actionLabel=${t('states.retry')} @action=${() => this.load()}></sw-state-panel></div>`;
    if (this.noFloors) return html`<div class="cover"><sw-state-panel state="empty" heading="עדיין אין קומות" hint="צור אתר, מבנה וקומה ואז ייבא תוכנית קומה."><div style="margin-block-start:10px"><sw-button variant="primary" icon="building" @click=${() => navigate('/explore/sites')}>לאתרים ומבנים</sw-button></div></sw-state-panel></div>`;
    if (!b) return html`<div class="cover"><sw-state-panel state="loading"></sw-state-panel></div>`;
    switch (this.screenState) {
      case 'loading':
        return html`<div class="cover"><sw-state-panel state="loading"></sw-state-panel></div>`;
      case 'error':
        return html`<div class="cover"><sw-state-panel state="error" actionLabel=${t('states.retry')}></sw-state-panel></div>`;
      case 'forbidden':
        return html`<div class="cover"><sw-state-panel state="forbidden"></sw-state-panel></div>`;
      default:
        break;
    }
    if (this.screenState === 'empty' || b.planStatus === 'none') {
      return html`<div class="cover">
        <sw-state-panel state="empty" heading=${t('floor.noPlan')} hint=${b.permissions.import ? t('floor.noPlanHint') : 'עורך המפות של הקומה יכול להעלות תוכנית.'}>
          <div style="display:flex;gap:8px;margin-block-start:10px;justify-content:center;flex-wrap:wrap">
            ${b.permissions.import ? html`<sw-button variant="primary" icon="upload" @click=${() => navigate(`/explore/floors/${b.floorId}/import`)}>${t('floor.uploadPlan')}</sw-button>` : nothing}
            <sw-button icon="list" @click=${() => navigate('/live/wall')}>${t('floor.listView')}</sw-button>
          </div>
        </sw-state-panel>
      </div>`;
    }
    return html`
      ${this.screenState === 'stale' || this.screenState === 'partial'
        ? html`<div class="banner"><sw-state-panel compact state=${this.screenState}></sw-state-panel></div>`
        : b.needsAlignment
          ? html`<div class="banner"><sw-state-panel compact state="partial" heading="פריטים הוצבו על גרסת תוכנית קודמת" hint="בדוק שהמיקומים עדיין נכונים על הרקע החדש (עורך התוכנית)."></sw-state-panel></div>`
          : nothing}
      ${this.shows3d ? this.render3d(b) : nothing}
      <sw-plan-canvas
        style=${this.shows3d ? 'display:none' : ''}
        .planWidth=${b.width}
        .planHeight=${b.height}
        .plan=${b.planSvg}
        .imageUrl=${b.imageUrl}
        .geometry=${this.layers.has('structure') || this.layers.has('objects') || this.layers.has('connectors') ? this.geometry : null}
        .hideStructure=${!this.layers.has('structure')}
        .hideObjects=${!this.layers.has('objects')}
        .hideConnectors=${!this.layers.has('connectors')}
        .selectedGeomId=${this.focusedObjectId}
        .structureLevel=${this.levelFilter}
        .catalog=${this.catalogLookup}
        .anchorPositions=${this.anchorPositions}
        .circuitStates=${this.circuitStateMap}
        .entityStates=${this.entityStateMap}
        .markers=${this.markers}
        .selectedId=${this.selectedId}
        .selectedIds=${this.multi ? this.picked : []}
        .boxSelect=${this.multi}
        @box-select=${(e: CustomEvent<{ ids: string[] }>) => this.addPicks(e.detail.ids)}
        .zones=${this.layers.has('zones') ? b.zones.map((z) => ({ ...z, labelPos: z.label_pos })) : []}
        .selectedZoneId=${this.selectedZoneId}
        .dimEntities=${this.screenState === 'stale'}
        @zone-select=${(e: CustomEvent<{ id: string }>) => { if (this.multi) { this.pickZone(e.detail.id); return; } this.selectedZoneId = this.selectedZoneId === e.detail.id ? null : e.detail.id; this.close(); }}
        @marker-select=${this.onSelect}
        @view-change=${this.onViewChange}></sw-plan-canvas>
      ${this.threeState === 'loading' ? html`<div class="cover" data-3d-loading><sw-state-panel state="loading" hint="טוען תלת-ממד…"></sw-state-panel></div>` : nothing}
      ${this.threeState === 'error' ? html`<div class="banner" data-3d-load-error><sw-state-panel compact state="error" heading="תלת-ממד לא נטען" hint=${this.threeError}></sw-state-panel></div>` : nothing}
      <div class="floorchip" data-floorchip><sw-icon name="building" size=${14}></sw-icon>${b.floorName}</div>
      ${b.levels.length > 1 ? html`<div class="levelbar">${renderLevelChips(b.levels, this.levelFilter, (id) => (this.levelFilter = id))}</div>` : nothing}
      ${b.source === 'api' && this.buildingFloors.length > 1
        ? html`<div class="floorbtns" role="group" aria-label="מעבר מהיר בין קומות" data-floor-buttons>
            ${this.buildingFloors.map((f) => html`<button class=${f.id === this.floorId ? 'on' : ''} data-floor-button=${f.id} title=${`${f.name}${f.hasPlan ? '' : ' · אין תוכנית'}`} aria-pressed=${f.id === this.floorId} @click=${() => { if (f.id !== this.floorId) navigate(`/explore/floors/${f.id}`); }}>${f.short}</button>`)}
          </div>`
        : nothing}
      ${this.panel ? this.renderPanel() : nothing}
      ${this.renderCircuitStrip()}
      ${this.multi ? this.renderPickbar() : nothing}
      ${this.renderSideList()}
      ${this.renderSaveDialog()}
      ${this.shows3d ? nothing : html`<div class="legend" aria-label="מקרא">
        ${b.zones.length && this.layers.has('zones') ? html`<span><i style="--lg: var(--sw-accent); border-radius: 2px; opacity: 0.5"></i>${b.zones.length} אזורים</span>` : nothing}
        <span><i style="--lg: var(--sw-accent)"></i>חי</span>
        <span><i style="--lg: var(--sw-stale)"></i>לא מעודכן</span>
        <span><i style="--lg: var(--sw-offline)"></i>מנותק</span>
        <span><i style="--lg: var(--sw-forbidden)"></i>ללא הרשאה</span>
        <span><i style="--lg: #fff; box-shadow: 0 0 0 1px var(--sw-border-strong)"></i>ישות HA</span>
      </div>`}
      ${this.renderCard()}
      ${this.renderConfirm()}
    `;
  }

  render() {
    const b = this.bundle;
    const floors = this.floors;
    const current = floors.find((f) => f.id === this.floorId);
    const cameraCount = b ? (b.source === 'demo' ? current?.cameraCount ?? 0 : b.anchors.filter((a) => a.resource_type === 'camera').length) : 0;
    const apiFloor = this.tree?.source === 'api' ? this.tree.sites.flatMap((s) => (s.buildings ?? []).flatMap((x) => x.floors ?? [])).find((f) => f.id === this.floorId) : null;
    return html`
      <div class="head">
        <div>
          <div class="crumbs">
            <a href="#/explore/sites">${b?.siteName ?? 'אתרים'}</a><sw-icon name="chevron" size=${11}></sw-icon>
            <a href="#/explore/buildings/${b?.source === 'api' ? apiFloor?.building_id ?? 'bld-a' : 'bld-a'}/floors">${b?.buildingName ?? ''}</a><sw-icon name="chevron" size=${11}></sw-icon>
            <span>${b?.floorName ?? ''}</span>
          </div>
          <h1>${b ? `${b.buildingName} – ${b.floorName}` : 'מפת קומה'}</h1>
          <div class="sub">
            <span>${cameraCount} מצלמות${b && b.source === 'api' ? ` · ${b.anchors.length - cameraCount} ישויות HA${b.zones.length ? ` · ${b.zones.length} אזורים` : ''}` : ''}${b?.source === 'demo' ? ' · נתוני הדגמה' : b?.planStatus === 'published' ? ' · תוכנית מפורסמת' : ''}</span>
            ${apiFloor?.draft_version_id ? html`<sw-badge kind="stale" label="טיוטת תוכנית ממתינה לפרסום"></sw-badge>` : nothing}
          </div>
        </div>
        <div class="spacer"></div>
        <div class="tools">
          <div class="layers" role="group" aria-label=${t('floor.layers')}>
            ${LAYERS.map((l) => html`<button class=${this.layers.has(l.id) ? 'on' : ''} title=${l.label()} aria-label=${l.label()} aria-pressed=${this.layers.has(l.id)} @click=${() => this.toggleLayer(l.id)}><sw-icon name=${l.icon} size=${14}></sw-icon></button>`)}
          </div>
          <sw-button icon="cube" aria-pressed=${this.shows3d} data-view-3d ?disabled=${!this.shows3d && (!this.can3d || this.threeState === 'loading')}
            title=${!webglAvailable() ? WEBGL_UNAVAILABLE_HE : !this.hasScene ? 'אין מבנה מפורסם לקומה הזו' : 'מקש 3'} @click=${() => this.toggle3d()}>${this.shows3d ? '2D' : '3D'}</sw-button>
          ${webglAvailable() ? nothing : html`<span class="note" data-3d-unavailable>${WEBGL_UNAVAILABLE_HE}</span>`}
          <sw-button icon="layers" aria-pressed=${this.panel} @click=${() => (this.panel = !this.panel)}>${t('floor.layers')}</sw-button>
          ${b && b.source === 'api' ? html`<sw-button icon="list" aria-pressed=${this.sideList} data-sidelist-toggle @click=${() => this.toggleSideList()}>רשימה</sw-button><sw-button icon="grid" aria-pressed=${this.multi} data-multi-toggle @click=${() => this.setMulti(!this.multi)}>בחירת מצלמות</sw-button>` : nothing}
          <sw-field style="min-inline-size:280px"><select aria-label=${t('floor.switcher')} @change=${(e: Event) => navigate(`/explore/floors/${(e.target as HTMLSelectElement).value}`)}>${floors.map((f) => html`<option value=${f.id} ?selected=${f.id === this.floorId}>${bidi(f.name)} · ${f.cameraCount} מצלמות${f.hasPlan ? '' : ' · אין תוכנית'}</option>`)}</select></sw-field>
          ${!b || b.permissions.edit ? html`<sw-button icon="edit" @click=${() => navigate(`/explore/floors/${this.floorId}/edit`)}>עריכת תוכנית</sw-button>` : nothing}
        </div>
      </div>
      <div class="stage">${this.renderStage()}</div>
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'explore-floor-map': ExploreFloorMap;
  }
}
