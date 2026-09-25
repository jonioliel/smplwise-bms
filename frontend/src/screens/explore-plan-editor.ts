import { LitElement, html, css, nothing } from 'lit';
import { customElement, property, query, state } from 'lit/decorators.js';
import { live } from 'lit/directives/live.js';
import '../components/sw-page';
import '../components/sw-card';
import '../components/sw-button';
import '../components/sw-field';
import '../components/sw-badge';
import '../components/sw-icon';
import '../components/sw-state-panel';
import '../components/sw-toggle';
import '../components/sw-dialog';
import '../components/sw-chip';
import '../map/sw-plan-canvas';
import type { GeomDragDetail, GeomDragMode, PlanMarker, MarkerSelectDetail, PlanZone, RulerOverlay, SwPlanCanvas } from '../map/sw-plan-canvas';
import type { IconName } from '../components/sw-icon';
import { navigate } from '../router';
import { cameraState, createAnchor, deleteAnchor, listVersions, loadMap, publishVersion, rollbackVersion, updateAnchor, versionDiff, type MapBundle, type VersionDiff, realignAnchors } from '../api/maps';
import { ApiError, describeError, resourceUrl } from '../api/client';
import type { Anchor, Camera, PlanVersion } from '../api/types';
import { domainLabel, entityMarkerKind, listEntities, stateLabel, type HaEntity } from '../api/ha';
import { ROOM_FILL_LABEL, setRenderMode, stylizeVersion, type RoomFill, type StylizeResult } from '../api/plans';
import { ZONE_KINDS, acceptZones, createZone, deleteZone, detectZones, pointInPolygon, updateZone, zoneKindLabel, type SpatialZone, type ZoneKind, type ZonePoint } from '../api/zones';
import { acceptDetection, calibrate, calibrateEstimate, copyGeometryFrom, detectStructure, exportUrl, geometryDiff, linkConnector, publishGeometry, type DetectResult, type DetectTarget, type GeometryDiffResponse } from '../api/geometry';
import { allIds, byConfidence, byKind, defaultStates, fromResult, moveVertex as moveCandidateVertex, rescale, takeDxfCandidates, withParents, type CandidateSet, type CandKind, type CandState } from '../map/candidates';
import { loadTree, type CatalogTree } from '../api/catalog';
import { productSettings } from '../api/prefs';
import { createItem, exportUrl as catalogExportUrl, importItems, itemOf, loadLibrary, lookupOf, type CatalogItem, type CatalogLibrary } from '../api/plan-catalog';
import { distanceM, effectiveScale, isClosedOutline, lengthPx, nearestWall, pointOnWall, snapPoint, type CatalogLookup, type ConnectorKind, type GeometryDoc, type GeomOpening, type GeomWall, type Pt } from '../map/geometry';
import { StudioController } from '../map/studio-controller';
import { ARRAY_MAX, BIND_DISTANCE_M, CIRCUIT_COLORS, addArray, addCircuit, addConnector, addLabel, addLevel, addObject, addOpening, addWall, arrayDefaults, circuitPower, defaultLevelId, duplicateObject, kindDefaults, moveConnectorVertex, moveGroup, moveObject, moveVertex, newId, nudgeT, openingRange, patchCircuit, patchConnector, patchLabel, patchObject, patchOpening, patchWall, removeCorner, removeGroup, removeItem, rotationTo, stretchedSize, toggleCircuitMember, translateWall, visibleUnderLevel, wallDirectionAt, type WallDefaults } from '../map/studio-ops';
import { ANCHOR_3D_DEFAULTS, anchor3dKind } from '../map/anchor-3d';
import { COLL_LABEL, CONNECTOR_LABEL, connectorDerived, countLabel, fmtMetres, fmtScale, renderArrayDialog, renderCalibPanel, renderCircuitPanel, renderConnectorPanel, renderCustomItemDialog, renderGroupDeleteDialog, renderGroupInspector, renderLevelChips, renderLevelDialog, renderDetectPanel, renderLibraryPanel, renderMeasurePanel, renderObjectInspector, renderConnectorSelection, renderStudioPanel, SAVE_LABEL, studioPanelStyles, lighterStrength, type ArrayDialogView, type CustomItemView, type DetectAcceptError, type DetectOpts, type DetectReplaceAsk, type DetectRunState, type GeomKind, type GeomSel, type LevelDialogView, type StudioMode } from './plan-studio-panel';

type Strength = 'light' | 'medium' | 'strong';
interface ZoneCandidate {
  polygon: ZonePoint[];
  name: string;
  kind: ZoneKind;
  include: boolean;
}
/** Same palette as the backend assigns on save, so candidates keep their colour once accepted. */
const PALETTE = ['#2767ED', '#22A06B', '#F59E0B', '#8B5CF6', '#0EA5E9', '#EC4899', '#14B8A6', '#F97316'];

type Tool = 'select' | 'camera' | 'lights' | 'entity' | 'zones' | 'structure' | 'library' | 'connectors' | 'circuits' | 'calibrate' | 'measure' | 'detect' | 'layers';
type Layer = 'cameras' | 'doors' | 'lights' | 'sensors';

const TOOLS: { id: Tool; icon: IconName; label: string; ready: boolean }[] = [
  { id: 'select', icon: 'target', label: 'בחירה וגרירה', ready: true },
  { id: 'camera', icon: 'camera', label: 'הוספת מצלמה', ready: true },
  { id: 'lights', icon: 'light', label: 'הוספת תאורה (מפסקים)', ready: true },
  { id: 'entity', icon: 'plus', label: 'ישות HA אחרת', ready: true },
  { id: 'zones', icon: 'map', label: 'חדרים ואזורים', ready: true },
  { id: 'structure', icon: 'wall', label: 'מבנה: קירות, דלתות וחלונות', ready: true },
  { id: 'library', icon: 'grid', label: 'ספריית עצמים', ready: true },
  { id: 'connectors', icon: 'stairs', label: 'מפלסים ומחברים', ready: true },
  { id: 'circuits', icon: 'bolt', label: 'מעגלי תאורה', ready: true },
  { id: 'calibrate', icon: 'scale', label: 'כיול קנה מידה', ready: true },
  { id: 'measure', icon: 'ruler', label: 'מדידת מרחק ושטח', ready: true },
  { id: 'detect', icon: 'sparkle', label: 'זיהוי אוטומטי של קירות ופתחים', ready: true },
  { id: 'layers', icon: 'layers', label: 'שכבות', ready: true },
];

/** Tools that work on the Plan Studio structure document (they need map.edit on the floor). */
const STUDIO_TOOLS: Tool[] = ['structure', 'library', 'connectors', 'circuits', 'calibrate', 'measure', 'detect'];
interface CalibState {
  a: Pt | null;
  b: Pt | null;
  metres: string;
  result: string;
  warning: string;
}
const EMPTY_CALIB: CalibState = { a: null, b: null, metres: '', result: '', warning: '' };
/** Arrow presses on one structure item less than this far apart (a held key, a quick run of taps) are one undo step. */
const NUDGE_BURST_MS = 1000;
const ARROWS = ['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown'];
/** Per-browser shelves of the library panel (design 4.3: "recent" and "favourites" per browser). */
const readList = (key: string): string[] => { try { const v = JSON.parse(localStorage.getItem(key) ?? '[]'); return Array.isArray(v) ? v.filter((x): x is string => typeof x === 'string') : []; } catch { return []; } };
const writeList = (key: string, list: string[]) => { try { localStorage.setItem(key, JSON.stringify(list.slice(0, 40))); } catch { /* private mode */ } };
const round = (v: number): number => Math.round(v * 1000) / 1000;
/** Screen pixels: a wall corner attracts a drawing / calibrating / measuring point this close (and in wall mode such a
 * press draws even on top of an opening or a label). */
const CORNER_SNAP_PX = 10;
/** Screen pixels: a click this close to a wall's centre line places an opening on that wall. */
const WALL_PICK_PX = 14;
/** Screen pixels beyond an opening's own width in which a placing click selects that opening instead of adding one. */
const OPENING_PICK_MARGIN_PX = 6;
/** The walls and openings of a structure in the publish previews ("קיר אחד, 3 פתחים"). */
const wallsAndOpenings = (walls: number, openings: number) => `${countLabel(walls, 'קיר אחד', 'קירות')}, ${countLabel(openings, 'פתח אחד', 'פתחים')}`;

const LAYERS: { id: Layer; label: string }[] = [
  { id: 'cameras', label: 'מצלמות' },
  { id: 'doors', label: 'דלתות ומנעולים' },
  { id: 'lights', label: 'תאורה ומתגים' },
  { id: 'sensors', label: 'חיישנים' },
];

/**
 * SC06 / M12 — floor plan editor: drag pins on the published (or draft) background, direction and
 * field-of-view handles on the selected camera, click-to-place for new cameras and HA entities, numeric
 * inspector, keyboard nudges, undo/redo, explicit save with optimistic revisions (409 → reload, nothing
 * is overwritten silently), publish a draft plan, and the stylized "SMPLWISE language" rendering.
 */
type DiffMode = 'publish' | 'rollback' | 'compare';
const GEOM_LABEL: Record<string, string> = { asset: 'קובץ', page: 'עמוד', rotation: 'סיבוב', crop: 'חיתוך', width_px: 'רוחב', height_px: 'גובה' };
const fmtWhen = (iso: string | null | undefined) => (iso ? new Intl.DateTimeFormat('he-IL', { dateStyle: 'short', timeStyle: 'short' }).format(new Date(iso)) : '');

@customElement('explore-plan-editor')
export class ExplorePlanEditor extends LitElement {
  @property() floorId = '';
  /** `?entity=<id>` from the catalogue: opens the entity tool with that id pre-searched. */
  @property() presetEntity = '';
  /** `?candidates=dxf`: the import screen stashed DXF candidates for this version; the detect tool opens on them. */
  @property() presetCandidates = '';
  @state() private bundle: MapBundle | null = null;
  @state() private anchors: Anchor[] = [];
  @state() private dirty = new Set<string>();
  @state() private undo: Anchor[][] = [];
  @state() private redo: Anchor[][] = [];
  @state() private selectedId: string | null = null;
  @state() private tool: Tool = 'select';
  @state() private layers = new Set<Layer>(['cameras', 'doors', 'lights', 'sensors']);
  @state() private placing: { kind: 'camera'; camera: Camera } | { kind: 'entity'; entity: HaEntity } | null = null;
  @state() private entQ = '';
  @state() private entResults: HaEntity[] | null = null;
  @state() private entBusy = false;
  /** The lighting tool lists switches only (the owner's relays); this adds `light.*` entities to it (R3). */
  @state() private lightsAll = false;
  @state() private busy = false;
  @state() private error = '';
  @state() private info = '';
  @state() private stylizing = false;
  @state() private stylized: StylizeResult | null = null;
  @state() private stylizeOpts: { strength: Strength; keepLines: boolean; roomFill: RoomFill } = { strength: 'medium', keepLines: false, roomFill: 'white' };
  @state() private zones: SpatialZone[] = [];
  /** Version history of the floor (T038) and the compare / publish / rollback dialog. */
  @state() private versions: PlanVersion[] = [];
  @state() private diff: { mode: DiffMode; version: PlanVersion; data: VersionDiff | null; error: string } | null = null;
  @state() private selectedZoneId: string | null = null;
  /** The corner of the selected zone picked by a press without a move (0.1.87): Delete removes that corner. */
  @state() private zoneVertexSel: { zoneId: string; index: number } | null = null;
  /** Which undo stack the last edit went to (0.1.87 fix round 1): in the select tool, which holds both pins and the
   * structure, Ctrl+Z / Ctrl+Y and the rail follow it, so a deleted wall comes back and repeated undo keeps going. */
  @state() private lastEdit: 'structure' | 'pins' | null = null;
  @state() private candidates: ZoneCandidate[] | null = null;
  @state() private detecting = false;
  @state() private detectStrength: Strength = 'medium';
  @state() private replaceAuto = true;
  @state() private drawing: ZonePoint[] | null = null;
  @state() private showZones = true;
  @state() private zoneBusy = false;
  @query('sw-plan-canvas') private canvas?: SwPlanCanvas;
  /** Plan Studio (T084): the structure draft of the shown plan version, autosaved two seconds after the last edit. */
  private studio = new StudioController(this);
  private studioVersion: string | null = null;
  @state() private studioMode: StudioMode = 'wall';
  @state() private wallDefaults: WallDefaults = { thickness_m: 0.2, kind: 'interior' };
  @state() private geomSel: GeomSel | null = null;
  /** A structure drag in progress: the draft as it will be after the drop. The canvas and the panel show it; nothing is
   * saved or undoable until the drop commits it. */
  @state() private geomPreview: GeometryDoc | null = null;
  /** The last arrow-key nudge: the item, the document it left and when. A press that continues it (same item, within
   * NUDGE_BURST_MS, nothing else edited in between) replaces its undo step instead of adding one. */
  private nudgeBurst: { key: string; doc: GeometryDoc; at: number } | null = null;
  // ---- Plan Studio phase 2 (T085): the library, placing, binding ----
  @state() private library: CatalogLibrary | null = null;
  private libLookup: CatalogLookup | null = null;
  @state() private libQ = '';
  @state() private libCategory: string | null = null;
  @state() private libRecent: string[] = readList('sw.studio.recent');
  @state() private libFav: string[] = readList('sw.studio.fav');
  /** The item the next click on the plan places (desktop: stays armed until Esc; phone: one placement). */
  @state() private placingItem: CatalogItem | null = null;
  /** An object dropped within BIND_DISTANCE_M of an anchor its item may represent: the offer to make it the anchor's body. */
  @state() private bindOffer: { objectId: string; anchor: Anchor } | null = null;
  /** The id a duplicate takes while it is dragged (Alt + drag), so the preview and the drop agree. */
  private dupId: string | null = null;
  /** Objects whose body offer the user answered "לא": they are not offered again (in this editor session). */
  private bindRefused = new Set<string>();
  private readonly phone = window.matchMedia('(max-width: 767px)');
  @state() private arrayDialog: (ArrayDialogView & { objectId: string }) | null = null;
  /** The group whose delete waits for the choice (members too, or not). */
  @state() private groupDelete: string | null = null;
  @state() private customDialog: (CustomItemView & { objectId: string; params: Record<string, unknown>; z: number }) | null = null;
  /** The level shown in the editor (null = every level): filters walls, labels, objects and pins; new items take it. */
  @state() private levelFilter: string | null = null;
  @state() private levelDialog: LevelDialogView | null = null;
  // ---- connectors (T085) ----
  @state() private connMode: ConnectorKind | null = null;
  @state() private connStart: Pt | null = null;
  @state() private tree: CatalogTree | null = null;
  @state() private linkFloor = '';
  @state() private linkBusy = false;
  // ---- circuits (T085) ----
  @state() private circuitSel: string | null = null;
  @state() private membersMode = false;
  @state() private circuitNew: { name: string; q: string; results: HaEntity[]; entity: HaEntity | null; color: string; busy: boolean } | null = null;
  private circuitTimer = 0;
  @state() private wallDraft: Pt[] | null = null;
  /** Raw plan position of the click that added the draft's last point (a double click there ends the wall). */
  private lastDrawClick: Pt | null = null;
  @state() private hover: Pt | null = null;
  @state() private calib: CalibState = { ...EMPTY_CALIB };
  @state() private measurePts: Pt[] = [];
  /** The structure preview of a published plan version: the version it compares, so a late answer or a confirm never
   * lands on another one. */
  @state() private geomDiff: { versionId: string; data: GeometryDiffResponse | null; error: string } | null = null;
  /** Setting `plan.estimates` (default true): estimated metres carry "≈" before calibration; false hides them. */
  @state() private showEstimates = true;
  /** Plan Studio phase 3 (T086): the detect tool - options, the running request, the candidate set and its states. The
   * set outlives a tool switch (only drawn while the tool is active) until it is confirmed, discarded or replaced. */
  @state() private detectOpts: DetectOpts = { walls: true, openings: true, strength: 0.6, replaceAuto: true };
  @state() private detectRun: DetectRunState = { busy: false, startedAt: 0, elapsed: 0, error: '', timedOut: false, limitS: null };
  /** Every run takes a token; only the latest run's answer and counter are used. */
  private detectToken = 0;
  @state() private cands: { set: CandidateSet; result: DetectResult; source: 'detect' | 'dxf' } | null = null;
  @state() private candStates: Record<string, CandState> = {};
  @state() private candSel: string | null = null;
  @state() private candEdits: Record<string, Partial<GeomWall>> = {};
  @state() private candObjectsOn = true;
  @state() private hintApplied = false;
  @state() private detectAsk: DetectReplaceAsk | null = null;
  @state() private detectErr: DetectAcceptError | null = null;
  /** A phone (the same query as `phone`): candidates are accepted or rejected there, their end points are not dragged. */
  @state() private narrow = false;
  private onNarrow = () => (this.narrow = this.phone.matches);
  private elapsedTimer: ReturnType<typeof setInterval> | undefined;
  private entTimer = 0;
  private onKey = (e: KeyboardEvent) => this.handleKey(e);

  static styles = [css`
    :host {
      display: flex;
      flex-direction: column;
      min-block-size: 100%;
    }
    .layout {
      display: grid;
      grid-template-columns: minmax(0, 1fr) 300px;
      gap: 16px;
      min-block-size: 560px;
      flex: 1;
    }
    .mapwrap {
      position: relative;
      border: 1px solid var(--sw-border);
      border-radius: var(--sw-r-lg);
      overflow: hidden;
      background: var(--sw-surface);
      min-block-size: 520px;
      box-shadow: var(--sw-shadow-1);
      display: flex;
      flex-direction: column;
    }
    .mapwrap sw-plan-canvas {
      flex: 1;
    }
    .rail {
      position: absolute;
      inset-inline-start: 12px;
      inset-block-start: 64px;
      display: flex;
      flex-direction: column;
      gap: 4px;
      background: var(--sw-surface);
      border: 1px solid var(--sw-border);
      border-radius: 12px;
      box-shadow: var(--sw-shadow-2);
      padding: 5px;
      z-index: var(--sw-z-map-ui);
    }
    .rail button {
      display: grid;
      place-items: center;
      inline-size: 38px;
      block-size: 38px;
      border: 0;
      border-radius: 9px;
      background: transparent;
      color: var(--sw-text-2);
      cursor: pointer;
    }
    .rail button:hover {
      background: var(--sw-surface-3);
      color: var(--sw-text);
    }
    .rail button.on {
      background: var(--sw-accent-soft);
      color: var(--sw-accent);
    }
    .rail button:disabled {
      opacity: 0.4;
      cursor: not-allowed;
    }
    .rail hr {
      border: 0;
      border-block-start: 1px solid var(--sw-border);
      margin: 2px 4px;
    }
    .floorchip {
      position: absolute;
      inset-inline-start: 12px;
      inset-block-start: 12px;
      display: inline-flex;
      align-items: center;
      gap: 8px;
      padding: 8px 12px;
      background: var(--sw-surface);
      border: 1px solid var(--sw-border);
      border-radius: 12px;
      box-shadow: var(--sw-shadow-1);
      font-size: var(--sw-fs-sm);
      font-weight: var(--sw-fw-semibold);
      z-index: var(--sw-z-map-ui);
    }
    .bar {
      display: flex;
      align-items: center;
      gap: 8px;
      flex-wrap: wrap;
      font-size: var(--sw-fs-xs);
      color: var(--sw-text-2);
      padding: 8px 12px;
      border-block-end: 1px solid var(--sw-border);
      background: var(--sw-surface);
    }
    .bar .grow {
      flex: 1;
    }
    .autosave {
      display: inline-flex;
      align-items: center;
      gap: 6px;
    }
    .autosave i {
      inline-size: 7px;
      block-size: 7px;
      border-radius: 50%;
      background: var(--sw-live);
    }
    .autosave.dirty i {
      background: var(--sw-stale);
    }
    .placing-hint {
      position: absolute;
      inset-inline: 0;
      inset-block-end: 14px;
      display: flex;
      justify-content: center;
      pointer-events: none;
      z-index: var(--sw-z-map-ui);
    }
    .placing-hint span {
      background: var(--sw-text);
      color: #fff;
      border-radius: 999px;
      padding: 6px 14px;
      font-size: var(--sw-fs-sm);
      box-shadow: var(--sw-shadow-2);
    }
    .legend {
      position: absolute;
      inset-inline-start: 12px;
      inset-block-end: 12px;
      display: flex;
      gap: 12px;
      background: var(--sw-surface);
      border: 1px solid var(--sw-border);
      border-radius: 10px;
      padding: 5px 10px;
      font-size: var(--sw-fs-xs);
      color: var(--sw-text-2);
      z-index: var(--sw-z-map-ui);
    }
    .legend i {
      display: inline-block;
      inline-size: 8px;
      block-size: 8px;
      border-radius: 50%;
      margin-inline-end: 5px;
      background: var(--sw-accent);
    }
    .legend i.ent {
      background: var(--sw-live);
    }
    .props {
      display: flex;
      flex-direction: column;
      gap: 12px;
      min-inline-size: 0;
    }
    .two {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 8px;
    }
    .note {
      font-size: var(--sw-fs-xs);
      color: var(--sw-text-3);
    }
    .err {
      color: var(--sw-danger);
    }
    .list {
      display: flex;
      flex-direction: column;
      gap: 4px;
      max-block-size: 260px;
      overflow: auto;
    }
    .list button {
      display: flex;
      justify-content: space-between;
      align-items: center;
      gap: 8px;
      padding: 7px 9px;
      border: 1px solid var(--sw-border);
      border-radius: 8px;
      background: var(--sw-surface);
      font: inherit;
      font-size: var(--sw-fs-xs);
      cursor: pointer;
      text-align: start;
    }
    .list button:hover,
    .list button.on {
      background: var(--sw-accent-soft);
      border-color: var(--sw-accent);
    }
    .kv {
      display: flex;
      justify-content: space-between;
      gap: 8px;
      padding: 6px 0;
      border-block-end: 1px solid var(--sw-border);
      font-size: var(--sw-fs-sm);
    }
    .kv .k {
      color: var(--sw-text-3);
    }
    .row {
      display: flex;
      justify-content: space-between;
      align-items: center;
      gap: 8px;
      padding: 8px 0;
      border-block-end: 1px solid var(--sw-border);
      font-size: var(--sw-fs-sm);
    }
    .row .lbl {
      display: flex;
      flex-direction: column;
    }
    .row .muted {
      font-size: var(--sw-fs-xs);
      color: var(--sw-text-3);
    }
    input[type='range'] {
      inline-size: 100%;
      accent-color: var(--sw-accent);
    }
    .cand {
      display: grid;
      grid-template-columns: auto auto minmax(0, 1fr) auto;
      gap: 6px;
      align-items: center;
      padding: 4px 0;
      border-block-end: 1px solid var(--sw-border);
    }
    .cand input.name {
      inline-size: 100%;
      min-inline-size: 0;
      border: 1px solid var(--sw-border);
      border-radius: 6px;
      padding: 4px 6px;
      font: inherit;
      color: var(--sw-text);
      background: var(--sw-surface);
    }
    .cand select {
      border: 1px solid var(--sw-border);
      border-radius: 6px;
      padding: 3px 4px;
      font: inherit;
      font-size: var(--sw-fs-xs);
      color: var(--sw-text-2);
      background: var(--sw-surface);
    }
    i.sw {
      display: inline-block;
      inline-size: 12px;
      block-size: 12px;
      border-radius: 3px;
      box-shadow: inset 0 0 0 1px rgba(15, 23, 42, 0.15);
      margin-inline-end: 6px;
      vertical-align: -2px;
    }
    .btns {
      display: flex;
      gap: 8px;
      flex-wrap: wrap;
      margin-block-start: 10px;
    }
    .chk {
      display: flex;
      align-items: center;
      gap: 6px;
      font-size: var(--sw-fs-xs);
      color: var(--sw-text-2);
      margin-block-start: 8px;
    }
    .legend i.zone {
      border-radius: 2px;
      background: var(--sw-accent);
      opacity: 0.45;
    }
    .layerlist label {
      display: flex;
      align-items: center;
      gap: 8px;
      padding: 6px 0;
      font-size: var(--sw-fs-sm);
    }
    .ltr {
      direction: ltr;
      unicode-bidi: isolate;
    }
    .compare {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 8px;
    }
    .vlist {
      display: flex;
      flex-direction: column;
      gap: 6px;
      max-block-size: 320px;
      overflow: auto;
      margin-block-start: 6px;
    }
    .vrow {
      display: grid;
      grid-template-columns: 56px minmax(0, 1fr);
      grid-template-areas: "img meta" "img acts";
      gap: 4px 8px;
      align-items: center;
      padding: 6px 8px;
      border: 1px solid var(--sw-border);
      border-radius: 8px;
      font-size: var(--sw-fs-xs);
    }
    .vrow.cur {
      border-color: var(--sw-accent);
      background: var(--sw-accent-soft);
    }
    .vrow img {
      grid-area: img;
      inline-size: 56px;
      block-size: 40px;
      object-fit: cover;
      border-radius: 4px;
      background: var(--sw-map-bg);
      border: 1px solid var(--sw-border);
    }
    .vrow .meta {
      grid-area: meta;
      display: flex;
      flex-direction: column;
      gap: 2px;
      min-inline-size: 0;
    }
    .vrow .acts {
      grid-area: acts;
      display: flex;
      gap: 4px;
      justify-content: flex-end;
    }
    .vrow .acts:empty {
      display: none;
    }
    .dsum {
      display: flex;
      flex-wrap: wrap;
      align-items: center;
      gap: 8px;
      font-size: var(--sw-fs-sm);
    }
    .ditems {
      display: flex;
      flex-direction: column;
      max-block-size: 160px;
      overflow: auto;
      font-size: var(--sw-fs-xs);
    }
    .ditems div {
      display: flex;
      justify-content: space-between;
      gap: 8px;
      padding: 3px 0;
      border-block-end: 1px solid var(--sw-border);
    }
    .compare img {
      inline-size: 100%;
      border: 1px solid var(--sw-border);
      border-radius: 8px;
      background: var(--sw-map-bg);
    }
    .bindbar {
      pointer-events: auto;
    }
    .bindbar button {
      margin-inline-start: 8px;
      border: 1px solid rgba(255, 255, 255, 0.6);
      background: transparent;
      color: #fff;
      border-radius: 999px;
      padding: 2px 10px;
      font: inherit;
      cursor: pointer;
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
      max-inline-size: 60%;
    }
    @media (max-width: 1023px) {
      .layout {
        grid-template-columns: minmax(0, 1fr);
      }
      .props {
        order: 2;
      }
    }
  `, studioPanelStyles];

  connectedCallback() {
    super.connectedCallback();
    void this.load();
    window.addEventListener('keydown', this.onKey);
    this.narrow = this.phone.matches;
    this.phone.addEventListener('change', this.onNarrow);
    if (this.presetEntity) {
      this.tool = 'entity';
      this.entQ = this.presetEntity;
      void this.searchEntities();
    }
  }

  disconnectedCallback() {
    super.disconnectedCallback();
    window.removeEventListener('keydown', this.onKey);
    this.phone.removeEventListener('change', this.onNarrow);
    clearInterval(this.elapsedTimer);
    void this.studio.flush(); // an edit younger than the autosave delay is still saved when the editor closes
  }

  /** S4: realign items from an earlier plan version (crop maths, or accept after a look). */
  private async realign(mode: 'crop' | 'accept') {
    if (!this.bundle || this.busy) return;
    this.busy = true;
    try {
      const r = await realignAnchors(this.bundle.floorId, mode);
      this.error = r.moved || !r.skipped ? '' : `${r.skipped} פריטים לא ניתנים ליישור אוטומטי (שרטוט אחר) — בדוק אותם ולחץ "אשר מיקומים".`;
      await this.load();
    } catch (err) {
      this.error = describeError(err);
    } finally {
      this.busy = false;
    }
  }

  private async load() {
    this.error = '';
    try {
      const b = await loadMap(this.floorId || 'f0', true);
      if (this.bundle && this.bundle.floorId !== b.floorId) {
        this.levelFilter = null; // another floor: back to every level
        this.linkFloor = ''; // and a stale target floor cannot outlive the floor it was picked on (final review item 4)
      }
      this.bundle = b;
      void this.loadStudio(b);
      void this.loadLibraryFor(b);
      void productSettings()
        .then((s) => {
          this.showEstimates = s['plan.estimates'] !== 'false'; // undefined until the backend serves the setting (Task 13): estimates shown
        })
        .catch(() => {}); // settings unavailable: keep the default (estimates shown)
      this.anchors = b.anchors.map((a) => ({ ...a, position: { ...a.position } }));
      this.zones = b.zones;
      void this.loadVersions();
      if (this.selectedZoneId && !this.zones.some((z) => z.id === this.selectedZoneId)) this.selectedZoneId = null;
      this.dirty = new Set();
      this.undo = [];
      this.redo = [];
      if (this.selectedId && !this.anchors.some((a) => a.id === this.selectedId)) this.selectedId = null;
    } catch (err) {
      this.error = describeError(err);
    }
  }

  // ---- derived ----

  private get selected(): Anchor | undefined {
    return this.anchors.find((a) => a.id === this.selectedId);
  }

  private layerOf(a: Anchor): Layer {
    if (a.resource_type === 'camera') return 'cameras';
    return a.layer_id === 'doors' ? 'doors' : a.layer_id === 'lights' ? 'lights' : 'sensors';
  }

  private get markers(): PlanMarker[] {
    return this.anchors
      .filter((a) => this.layers.has(this.layerOf(a)) && this.onLevel(a))
      .map((a) => ({
        id: a.id,
        kind: a.resource_type === 'camera' ? 'camera' : entityMarkerKind(a.layer_id, a.entity?.domain),
        label: this.anchorName(a),
        x: a.position.x,
        y: a.position.y,
        rotation: a.rotation_degrees,
        fov: a.field_of_view_degrees ?? undefined,
        radius: a.coverage_radius ?? undefined,
        polygon: a.coverage_polygon ? a.coverage_polygon.map(([x, y]) => ({ x, y })) : undefined,
        labelPos: a.label_pos ?? undefined,
        level: a.level_id ?? null,
        state: a.resource_type === 'camera' ? (this.bundle?.source === 'demo' ? 'live' : cameraState(a)) : 'neutral',
      }));
  }

  /** Cameras keep the NVR / alias name; a placed HA entity shows its manual name first (R3), then the HA name. */
  private anchorName(a: Anchor) {
    if (a.resource_type === 'camera') return a.camera?.name ?? a.label ?? a.resource_id;
    return a.label ?? a.entity?.name ?? a.resource_id;
  }

  private get selectedZone(): SpatialZone | undefined {
    return this.zones.find((z) => z.id === this.selectedZoneId);
  }

  private get planZones(): PlanZone[] {
    if (!this.showZones) return [];
    const saved: PlanZone[] = this.zones.map((z) => ({ id: z.id, name: z.name, kind: z.kind, color: z.color, polygon: z.polygon, labelPos: z.label_pos }));
    const cands: PlanZone[] = (this.candidates ?? []).map((c, i) => ({ id: `cand-${i}`, name: c.include ? c.name : '', color: c.include ? PALETTE[i % PALETTE.length] : '#9AA3B5', polygon: c.polygon, candidate: true }));
    return [...saved, ...cands];
  }

  // ---- rooms & zones (M13) ----

  private async detect() {
    const b = this.bundle;
    if (!b) return;
    if (b.source === 'demo') {
      this.info = 'נתוני הדגמה: הזיהוי עובד מול השרת.';
      return;
    }
    this.detecting = true;
    this.error = '';
    try {
      const r = await detectZones(b.floorId, this.detectStrength);
      this.candidates = r.rooms.map((room, i) => ({ polygon: room.polygon, name: `חדר ${i + 1}`, kind: 'room' as ZoneKind, include: true }));
      this.selectedZoneId = null;
      this.selectedId = null;
      this.info = r.rooms.length ? `${r.rooms.length} חדרים זוהו · תן שמות ושמור` : 'לא זוהו חדרים סגורים; נסה עוצמה אחרת או צייר אזור ידנית';
      setTimeout(() => (this.info = ''), 5000);
    } catch (err) {
      this.error = describeError(err);
    } finally {
      this.detecting = false;
    }
  }

  private setCandidate(i: number, patch: Partial<ZoneCandidate>) {
    if (!this.candidates) return;
    this.candidates = this.candidates.map((c, j) => (j === i ? { ...c, ...patch } : c));
  }

  private async acceptCandidates() {
    const b = this.bundle;
    const chosen = (this.candidates ?? []).filter((c) => c.include);
    if (!b || !chosen.length) return;
    this.zoneBusy = true;
    this.error = '';
    try {
      const r = await acceptZones(b.floorId, chosen.map((c) => ({ polygon: c.polygon, name: c.name, kind: c.kind })), this.replaceAuto);
      this.candidates = null;
      this.zones = r.zones;
      this.info = `${r.created.length} חדרים נשמרו`;
      setTimeout(() => (this.info = ''), 3000);
    } catch (err) {
      this.error = describeError(err);
    } finally {
      this.zoneBusy = false;
    }
  }

  private startDrawing() {
    this.drawing = [];
    this.placing = null;
    this.candidates = null;
    this.selectedZoneId = null;
    this.selectedId = null;
  }

  private addDraftPoint(x: number, y: number) {
    const d = this.drawing;
    const b = this.bundle;
    if (!d || !b) return;
    if (d.length >= 3) {
      // a click on the first vertex closes the shape
      const z = this.canvas?.zoom ?? 1;
      const dist = Math.hypot((x - d[0].x) * b.width * z, (y - d[0].y) * b.height * z);
      if (dist < 12) {
        void this.finishDrawing();
        return;
      }
    }
    this.drawing = [...d, { x: +x.toFixed(4), y: +y.toFixed(4) }];
  }

  private async finishDrawing() {
    const d = this.drawing;
    const b = this.bundle;
    if (!d || !b || d.length < 3) return;
    if (b.source === 'demo') {
      this.info = 'נתוני הדגמה: השמירה עובדת מול השרת.';
      this.drawing = null;
      return;
    }
    this.zoneBusy = true;
    this.error = '';
    try {
      const z = await createZone(b.floorId, { name: `אזור ${this.zones.length + 1}`, kind: 'zone', polygon: d });
      this.drawing = null;
      this.zones = [...this.zones, z];
      this.selectedZoneId = z.id;
      this.info = 'האזור נוצר · תן לו שם';
      setTimeout(() => (this.info = ''), 3000);
    } catch (err) {
      this.error = describeError(err);
    } finally {
      this.zoneBusy = false;
    }
  }

  private async patchZone(z: SpatialZone, body: { name?: string; kind?: ZoneKind; color?: string; searchable?: boolean; polygon?: ZonePoint[]; label_pos?: string; level_id?: string; ceiling_height_m?: number }) {
    if (this.bundle?.source === 'demo') return;
    this.zoneBusy = true;
    this.error = '';
    try {
      const nz = await updateZone(z.id, { revision: z.revision, ...body });
      this.zones = this.zones.map((x) => (x.id === nz.id ? nz : x));
    } catch (err) {
      if (err instanceof ApiError && err.status === 409) {
        this.error = 'האזור השתנה בינתיים על ידי עורך אחר; נטען מחדש בלי לדרוס.';
        await this.load();
      } else this.error = describeError(err);
    } finally {
      this.zoneBusy = false;
    }
  }

  private async removeZone(z: SpatialZone) {
    if (this.bundle?.source === 'demo') return;
    if (!window.confirm(`למחוק את "${z.name}"? המצלמות והישויות בקומה לא מושפעות.`)) return;
    this.zoneBusy = true;
    this.error = '';
    try {
      await deleteZone(z.id);
      this.zones = this.zones.filter((x) => x.id !== z.id);
      if (this.selectedZoneId === z.id) this.selectedZoneId = null;
    } catch (err) {
      this.error = describeError(err);
    } finally {
      this.zoneBusy = false;
    }
  }

  // ---- edits (draft state; explicit save) ----

  private snapshot() {
    this.undo = [...this.undo.slice(-40), this.anchors.map((a) => ({ ...a, position: { ...a.position } }))];
    this.redo = [];
  }

  private apply(id: string, patch: Partial<Anchor> & { position?: { x: number; y: number } }) {
    this.snapshot();
    this.lastEdit = 'pins';
    this.anchors = this.anchors.map((a) => (a.id === id ? { ...a, ...patch, position: patch.position ?? a.position } : a));
    this.dirty = new Set(this.dirty).add(id);
  }

  private nudge(dx: number, dy: number) {
    const a = this.selected;
    if (!a) return;
    this.apply(a.id, { position: { x: +Math.min(1, Math.max(0, a.position.x + dx)).toFixed(4), y: +Math.min(1, Math.max(0, a.position.y + dy)).toFixed(4) } });
  }

  private doUndo() {
    const prev = this.undo[this.undo.length - 1];
    if (!prev) return;
    this.redo = [...this.redo, this.anchors];
    this.undo = this.undo.slice(0, -1);
    this.anchors = prev;
    this.dirty = new Set(this.anchors.map((a) => a.id));
  }

  private doRedo() {
    const next = this.redo[this.redo.length - 1];
    if (!next) return;
    this.undo = [...this.undo, this.anchors];
    this.redo = this.redo.slice(0, -1);
    this.anchors = next;
    this.dirty = new Set(this.anchors.map((a) => a.id));
  }

  private handleKey(e: KeyboardEvent) {
    const target = e.composedPath()[0] as HTMLElement | undefined;
    const typing = target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.tagName === 'SELECT' || target.isContentEditable);
    if (e.key === 'Escape') {
      if (this.arrayDialog || this.groupDelete || this.customDialog) { this.arrayDialog = null; this.groupDelete = null; this.customDialog = null; return; }
      if (this.connStart) { this.connStart = null; return; }
      if (this.tool === 'circuits' && this.membersMode) { this.membersMode = false; return; }
      if (this.tool === 'detect') {
        if (this.detectAsk) this.detectAsk = null;
        else this.pickTool('select');
        return;
      }
      if (this.placingItem) this.placingItem = null;
      else if (this.bindOffer) this.bindOffer = null;
      else if (this.wallDraft) {
        this.wallDraft = null;
        this.hover = null;
      } else if (this.tool === 'measure' && this.measurePts.length) this.measurePts = [];
      else if (this.tool === 'calibrate' && this.calib.a) this.calib = { ...EMPTY_CALIB };
      else if (this.drawing) this.drawing = null;
      else if (this.placing) this.placing = null;
      else if (this.candidates) this.candidates = null;
      else {
        this.selectedId = null;
        this.selectedZoneId = null;
        this.zoneVertexSel = null;
        this.geomSel = null;
      }
      return;
    }
    if (typing) return;
    if (this.arrayDialog || this.groupDelete || this.customDialog) return; // an open dialog owns the keys: no Delete or nudge behind it
    if ((this.studioOn || this.selectGeomOn) && this.handleStudioKey(e)) return;
    if (e.key === 'Enter' && this.drawing) {
      e.preventDefault();
      void this.finishDrawing();
      return;
    }
    if ((e.key === 'Delete' || e.key === 'Backspace') && !this.selected && this.selectedZone) {
      e.preventDefault();
      const z = this.selectedZone;
      const v = this.zoneVertexSel;
      if (v && v.zoneId === z.id && v.index < z.polygon.length) {
        // a picked corner goes alone (0.1.87); a zone keeps at least three corners
        if (z.polygon.length <= 3) {
          this.info = 'לאזור נשארו שלוש פינות: אי אפשר להסיר עוד פינה';
          setTimeout(() => (this.info = ''), 3000);
          return;
        }
        this.zoneVertexSel = null;
        void this.patchZone(z, { polygon: z.polygon.filter((_, i) => i !== v.index) });
        return;
      }
      void this.removeZone(z);
      return;
    }
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z') {
      e.preventDefault();
      if (e.shiftKey) this.redoAny();
      else this.undoAny();
      return;
    }
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'y') {
      e.preventDefault();
      this.redoAny();
      return;
    }
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 's') {
      e.preventDefault();
      void this.save();
      return;
    }
    if (!this.selected) return;
    const step = e.shiftKey ? 0.01 : 0.002;
    if (e.key === 'ArrowLeft') {
      e.preventDefault();
      this.nudge(-step, 0);
    } else if (e.key === 'ArrowRight') {
      e.preventDefault();
      this.nudge(step, 0);
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      this.nudge(0, -step);
    } else if (e.key === 'ArrowDown') {
      e.preventDefault();
      this.nudge(0, step);
    } else if (e.key === 'Delete' || e.key === 'Backspace') {
      e.preventDefault();
      void this.removeSelected();
    }
  }

  private async save(): Promise<boolean> {
    if (!this.bundle || this.bundle.source === 'demo') {
      this.info = 'נתוני הדגמה: השינויים נשמרים רק במסך זה.';
      this.dirty = new Set();
      return true;
    }
    if (!this.dirty.size) return true;
    this.busy = true;
    this.error = '';
    let conflict = false;
    try {
      for (const id of this.dirty) {
        const a = this.anchors.find((x) => x.id === id);
        if (!a) continue;
        try {
          const saved = await updateAnchor(id, { revision: a.revision, x: a.position.x, y: a.position.y, rotation_degrees: a.rotation_degrees, field_of_view_degrees: a.field_of_view_degrees, label: a.label,
            coverage_radius: a.coverage_radius ?? null, coverage_polygon: a.coverage_polygon ?? null, label_pos: a.label_pos ?? 'auto', level_id: a.level_id ?? '',
            mount_height_m: a.mount_height_m ?? null, tilt_deg: a.tilt_deg ?? null });
          this.anchors = this.anchors.map((x) => (x.id === id ? { ...x, revision: saved.revision } : x));
        } catch (err) {
          if (err instanceof ApiError && err.code === 'stale_revision') conflict = true;
          else throw err;
        }
      }
      if (conflict) {
        this.error = 'חלק מהפריטים השתנו בינתיים על ידי עורך אחר; המפה נטענה מחדש בלי לדרוס את השינוי שלו.';
        await this.load();
        return false;
      }
      this.dirty = new Set();
      this.info = 'המיקומים נשמרו';
      setTimeout(() => (this.info = ''), 2500);
      return true;
    } catch (err) {
      this.error = describeError(err);
      return false;
    } finally {
      this.busy = false;
    }
  }

  private async place(x: number, y: number) {
    const p = this.placing;
    if (!p || !this.bundle) return;
    if (this.bundle.source === 'demo') {
      this.info = 'נתוני הדגמה: הוספה עובדת מול השרת.';
      this.placing = null;
      return;
    }
    if (this.dirty.size && !(await this.save())) return;
    this.busy = true;
    this.error = '';
    // with a level filter on, the pin goes to that level (else it would vanish from the filtered view on placement)
    const level = this.activeLevel ? { level_id: this.activeLevel } : {};
    try {
      const a =
        p.kind === 'camera'
          ? await createAnchor(this.bundle.floorId, { resource_type: 'camera', resource_id: p.camera.id, x, y, rotation_degrees: 0, field_of_view_degrees: 90, ...level })
          : await createAnchor(this.bundle.floorId, { resource_type: 'ha_entity', resource_id: p.entity.entity_id, x, y, rotation_degrees: 0, field_of_view_degrees: null, ...level });
      this.placing = null;
      await this.load();
      this.selectedId = a.id;
      this.tool = 'select';
      this.info = `${this.anchorName(a)} הוצב · גרור לדיוק, קבע כיוון בידיות`;
      setTimeout(() => (this.info = ''), 4000);
    } catch (err) {
      this.error = describeError(err);
    } finally {
      this.busy = false;
    }
  }

  private async removeSelected() {
    const a = this.selected;
    if (!a || !this.bundle) return;
    if (this.bundle.source === 'demo') {
      this.info = 'נתוני הדגמה: הסרה עובדת מול השרת.';
      return;
    }
    if (!window.confirm(`להסיר את "${this.anchorName(a)}" מהמפה? המקור עצמו לא נמחק.`)) return;
    this.busy = true;
    this.error = '';
    try {
      await deleteAnchor(a.id);
      this.selectedId = null;
      await this.load();
    } catch (err) {
      this.error = describeError(err);
    } finally {
      this.busy = false;
    }
  }

  private async loadVersions() {
    const b = this.bundle;
    if (!b || b.source === 'demo' || !b.permissions.edit) {
      this.versions = [];
      return;
    }
    try {
      this.versions = (await listVersions(b.floorId)).versions;
    } catch {
      this.versions = [];
    }
  }

  /** Publishing always goes through a preview. A draft plan version publishes its image, its pins (T038) and its
   * structure together; on the published version only the structure has something new to publish. */
  private async publish() {
    const b = this.bundle;
    if (!b?.planVersionId) return;
    if (this.dirty.size && !(await this.save())) return;
    if (!(await this.studio.flush())) {
      this.error = this.studio.error;
      return;
    }
    this.error = ''; // the draft is saved: a save error from an earlier attempt is over
    if (b.planStatus === 'published') {
      await this.openGeomDiff(b.planVersionId);
      return;
    }
    // load() does not wait for the version list: a click before it arrives reads it here. Without the draft's row
    // there is no preview to show, so nothing is published.
    let draft = this.versions.find((v) => v.id === b.planVersionId);
    if (!draft) {
      await this.loadVersions();
      draft = this.versions.find((v) => v.id === b.planVersionId);
    }
    if (!draft) {
      this.error = 'לא נמצאה טיוטה לפרסום — טען מחדש';
      return;
    }
    await this.openDiff('publish', draft);
  }

  private async openGeomDiff(versionId: string) {
    this.geomDiff = { versionId, data: null, error: '' };
    try {
      const data = await geometryDiff(versionId);
      if (this.geomDiff?.versionId === versionId) this.geomDiff = { versionId, data, error: '' }; // not closed meanwhile
    } catch (err) {
      if (this.geomDiff?.versionId === versionId) this.geomDiff = { versionId, data: null, error: describeError(err) };
    }
  }

  private async confirmGeomPublish() {
    const b = this.bundle;
    const d = this.geomDiff;
    if (!b || !d?.data) return;
    this.busy = true;
    try {
      const r = await publishGeometry(d.versionId); // the version the preview compared
      this.geomDiff = null;
      // The server publishes nothing when the draft already is what viewers see; its answer says so (unchanged).
      this.info = r.unchanged ? 'אין שינוי לפרסום' : 'המבנה פורסם; הצופים רואים אותו עכשיו';
      setTimeout(() => (this.info = ''), 4000);
      await this.loadStudio(b, true); // refresh what viewers see (the published hash)
    } catch (err) {
      this.geomDiff = { ...d, error: describeError(err) };
    } finally {
      this.busy = false;
    }
  }

  private async openDiff(mode: DiffMode, version: PlanVersion) {
    this.diff = { mode, version, data: null, error: '' };
    try {
      const data = await versionDiff(version.id);
      if (this.diff?.version.id === version.id) this.diff = { mode, version, data, error: '' };
    } catch (err) {
      if (this.diff?.version.id === version.id) this.diff = { mode, version, data: null, error: describeError(err) };
    }
  }

  private async confirmDiff() {
    const d = this.diff;
    if (!d?.data || d.mode === 'compare') return;
    // The editor's own draft publishes the structure the studio holds; another draft from the history publishes its own.
    const own = d.version.id === this.bundle?.planVersionId;
    this.busy = true;
    this.error = '';
    try {
      // The history row opens this dialog without publish(): unsaved structure edits are saved before they go out.
      if (own && !(await this.studio.flush())) {
        this.diff = { ...d, error: this.studio.error };
        return;
      }
      if (d.mode === 'publish') {
        await publishVersion(d.version.id);
        this.info = 'הגרסה פורסמה; הצופים רואים אותה עכשיו';
      } else {
        await rollbackVersion(d.version.id, d.version.revision, d.data.from?.id ?? null);
        this.info = 'הגרסה שוחזרה ופורסמה מחדש; העוגנים נשמרו';
      }
      this.diff = null;
      await this.load();
      if (this.bundle) await this.loadStudio(this.bundle, true); // the structure was published with the plan
      setTimeout(() => (this.info = ''), 4000);
    } catch (err) {
      this.diff = { ...d, error: describeError(err) };
      if (err instanceof ApiError && err.status === 409) void this.loadVersions();
      if (own && err instanceof ApiError && err.code === 'geometry_invalid') {
        this.pickTool('structure'); // the issue list is in the structure panel
        this.studioMode = 'select';
      }
    } finally {
      this.busy = false;
    }
  }

  private async searchEntities() {
    if (this.bundle?.source === 'demo') return;
    this.entBusy = true;
    try {
      // lighting tool: switches only (plus light.* when asked); the other tool: anything in the catalogue
      const lights = this.tool === 'lights';
      const r = await listEntities({ q: this.entQ || undefined, domain: lights && !this.lightsAll ? 'switch' : undefined, limit: lights ? 200 : 40 });
      this.entResults = lights ? r.entities.filter((e) => e.domain === 'switch' || (this.lightsAll && e.domain === 'light')).slice(0, 60) : r.entities;
    } catch (err) {
      this.error = describeError(err);
      this.entResults = [];
    } finally {
      this.entBusy = false;
    }
  }

  private onEntQuery(v: string) {
    this.entQ = v;
    window.clearTimeout(this.entTimer);
    this.entTimer = window.setTimeout(() => void this.searchEntities(), 250);
  }

  private async stylize(strength?: Strength, keepLines?: boolean) {
    if (!this.bundle?.planVersionId || this.bundle.source === 'demo') return;
    const o = this.stylizeOpts;
    if (strength !== undefined || keepLines !== undefined) this.stylizeOpts = { ...o, strength: strength ?? o.strength, keepLines: keepLines ?? o.keepLines };
    this.stylizing = true;
    this.error = '';
    try {
      this.stylized = await stylizeVersion(this.bundle.planVersionId, { strength: this.stylizeOpts.strength, keep_lines: this.stylizeOpts.keepLines, room_fill: this.stylizeOpts.roomFill });
    } catch (err) {
      this.error = describeError(err);
    } finally {
      this.stylizing = false;
    }
  }

  private async useRender(mode: 'source' | 'stylized') {
    if (!this.bundle?.planVersionId) return;
    this.busy = true;
    this.error = '';
    try {
      await setRenderMode(this.bundle.planVersionId, mode);
      this.stylized = null;
      await this.load();
      this.info = mode === 'stylized' ? 'המפה מציגה עכשיו את שפת SMPLWISE' : 'המפה מציגה את תוכנית המקור';
      setTimeout(() => (this.info = ''), 3000);
    } catch (err) {
      this.error = describeError(err);
    } finally {
      this.busy = false;
    }
  }

  /** A detection or an accept (or the estimate) of the detect tool is in flight: the draft must not change under it, so
   * tool switching and undo / redo wait. */
  private get detectBusy(): boolean {
    return this.detectRun.busy || (this.tool === 'detect' && this.busy);
  }

  private pickTool(tool: Tool) {
    if (this.detectBusy && tool !== this.tool) return;
    this.tool = tool;
    this.placing = null;
    this.wallDraft = null;
    this.hover = null;
    this.geomPreview = null;
    this.placingItem = null;
    this.bindOffer = null;
    this.connMode = null;
    this.connStart = null;
    this.membersMode = false;
    this.circuitNew = null;
    this.linkFloor = ''; // a floor picked for a connector link never survives a tool switch (final review item 4)
    if (tool === 'connectors' && !this.tree && this.bundle?.source === 'api') void loadTree().then((t) => (this.tree = t)).catch(() => {});
    if (tool === 'structure' && this.phone.matches && this.studioMode === 'wall') this.studioMode = 'select'; // wall drawing is desktop only: a phone opens the tool in select mode
    if (tool !== 'structure') this.geomSel = null;
    if (STUDIO_TOOLS.includes(tool)) {
      // a zone selected in the select or zones tool does not follow into a studio tool, where its body could be dragged
      this.selectedZoneId = null;
      this.zoneVertexSel = null;
    }
    if (tool !== 'measure') this.measurePts = [];
    if (tool !== 'calibrate') this.calib = { ...EMPTY_CALIB };
    if (tool !== 'detect') {
      this.candSel = null; // the candidate set stays (not drawn) until the tool returns, a new run, confirm or discard
      this.detectAsk = null;
    }
    if (tool === 'entity' || tool === 'lights') {
      this.entResults = null; // the two tools list different sets
      void this.searchEntities();
    }
  }

  // ---- Plan Studio: structure (T084) ----

  /** The structure draft follows the plan version the editor shows (a new draft or a restore changes it). True when this
   * call loaded the version's draft; false when there was nothing to load, the edit in hand could not be saved first or
   * the load failed (the last two leave no version recorded, so the next call tries again). */
  private async loadStudio(b: MapBundle, force = false): Promise<boolean> {
    if (b.source !== 'api' || !b.planVersionId || !b.permissions.structure) return false;
    if (!force && this.studioVersion === b.planVersionId) return false;
    this.studioVersion = b.planVersionId;
    try {
      // An unsaved edit is never dropped silently: when it cannot be saved the studio keeps its draft and says so (the
      // next load tries again). A reload after a conflict drops it on purpose: the user chose the stored draft.
      if (!(await this.studio.flush()) && !(force && this.studio.hasConflict)) {
        this.studioVersion = null;
        this.error = this.studio.error;
        return false;
      }
      await this.studio.load(b.planVersionId);
      this.geomSel = null;
      this.geomPreview = null;
      this.wallDraft = null;
      this.calib = { ...EMPTY_CALIB }; // points and measures belong to the document they were taken on
      this.measurePts = [];
      if (this.cands && this.cands.result.version_id !== b.planVersionId) this.discardCandidates(); // candidates belong to the version they came from
      if (this.presetCandidates === 'dxf') this.takeDxf(b.planVersionId);
      return true;
    } catch (err) {
      this.studioVersion = null;
      this.error = describeError(err);
      return false;
    }
  }

  private async loadLibraryFor(b: MapBundle) {
    if (b.source !== 'api') return;
    try {
      const lib = await loadLibrary(b.catalogRevision);
      this.library = lib;
      this.libLookup = lookupOf(lib);
    } catch (err) {
      this.error = describeError(err);
    }
  }

  /** The level new items go to: the level filter when one is on, else the document's default level. */
  private placeOpts(doc: GeometryDoc): { levelId: string; ceilingM: number } {
    const levelId = this.activeLevel ?? defaultLevelId(doc);
    return { levelId, ceilingM: doc.levels.find((l) => l.id === levelId)?.ceiling_height_m ?? 2.8 };
  }

  /** The level filter in force: a filter on a level the document no longer has (an undone "add level") is no filter. */
  private get activeLevel(): string | null {
    const lv = this.levelFilter;
    return lv && this.studio.doc?.levels.some((l) => l.id === lv) ? lv : null;
  }

  /** The walls the user can see: those of the filtered level, or all. Snapping and placing openings use only these. */
  private shownWalls(doc: GeometryDoc): GeomWall[] {
    const lv = this.activeLevel;
    return lv ? doc.walls.filter((w) => w.level_id === lv) : doc.walls;
  }

  /** Picks the level filter (a chip, a new level): a selection the new filter would hide closes, so the inspector never
   * shows an item the canvas dropped (final review item 1). */
  private setLevelFilter(id: string | null) {
    this.levelFilter = id;
    if (this.geomSel && this.studio.doc && !visibleUnderLevel(this.studio.doc, this.geomSel.id, id)) this.geomSel = null;
  }

  /** After an item's own level changes (setLevel, the object level patch): a filter that would now hide the item that is
   * still selected follows it to its new level instead, so the edit does not vanish from under the user (final review
   * item 1; the alternative, dropping the filter to null, was not chosen so the filter stays useful). */
  private followLevel(id: string, lv: string) {
    if (this.geomSel?.id === id && this.activeLevel !== null && this.activeLevel !== lv) this.levelFilter = lv;
  }

  private createLevel() {
    const doc = this.studio.doc;
    const v = this.levelDialog;
    if (!doc || !v) return;
    if (doc.levels.some((l) => l.elevation_m === v.elevation)) {
      this.levelDialog = { ...v, error: 'כבר יש מפלס בגובה הזה' };
      return;
    }
    const r = addLevel(doc, v.name, v.elevation, v.ceiling);
    this.studio.commit(r.doc);
    this.lastEdit = 'structure';
    this.levelDialog = null;
    this.setLevelFilter(r.id);
    this.info = `המפלס "${v.name}" נוסף; פריטים חדשים יוצבו בו`;
    setTimeout(() => (this.info = ''), 4000);
  }

  /** The other floors of this building, for the link picker. */
  private get otherFloors(): { id: string; name: string }[] {
    const b = this.bundle;
    if (!b || this.tree?.source !== 'api') return [];
    for (const s of this.tree.sites) for (const bl of s.buildings ?? []) if ((bl.floors ?? []).some((f) => f.id === b.floorId)) return (bl.floors ?? []).filter((f) => f.id !== b.floorId).map((f) => ({ id: f.id, name: f.name }));
    return [];
  }

  private async linkTo(connectorId: string) {
    const b = this.bundle;
    if (!b?.planVersionId || !this.linkFloor) return;
    this.linkBusy = true;
    this.error = '';
    try {
      if (!(await this.studio.flush())) {
        this.error = this.studio.error;
        return;
      }
      const r = await linkConnector(b.planVersionId, connectorId, this.linkFloor);
      await this.loadStudio(b, true); // the server changed both drafts: this one has a new revision
      this.geomSel = { id: connectorId, kind: 'connector' };
      this.info = `המחבר קושר לקומה "${this.otherFloors.find((f) => f.id === r.target.floor_id)?.name ?? ''}"; הוא מופיע בטיוטה שלה באותו מזהה`;
      setTimeout(() => (this.info = ''), 5000);
    } catch (err) {
      this.error = describeError(err);
    } finally {
      this.linkBusy = false;
    }
  }

  private renderConnectorTool(b: MapBundle) {
    const doc = this.studio.doc;
    if (!doc) return html`<sw-card heading="מפלסים ומחברים"><div class="note">${b.source === 'demo' ? 'נתוני הדגמה: המחברים עובדים מול השרת.' : this.error || 'טוען…'}</div></sw-card>`;
    return renderConnectorPanel(
      { doc, mode: this.connMode, start: this.connStart, sel: this.geomSel?.kind === 'connector' ? doc.connectors.find((c) => c.id === this.geomSel!.id) : undefined, saveState: this.studio.saveState,
        floors: this.otherFloors, linkFloor: this.linkFloor, linkBusy: this.linkBusy, phone: this.phone.matches },
      {
        setMode: (k) => {
          this.connMode = k;
          this.connStart = null;
          this.geomSel = null;
        },
        select: (id) => (this.geomSel = { id, kind: 'connector' }),
        patch: (id, patch) => this.edit((d) => patchConnector(d, id, patch)),
        remove: (id) => {
          this.edit((d) => removeItem(d, id));
          this.geomSel = null;
        },
        setLinkFloor: (f) => (this.linkFloor = f),
        link: (id) => void this.linkTo(id),
      },
    );
  }

  /** The switch catalogue of a circuit: the synced switch and light entities, asked by domain so no other domain crowds them out. */
  private async searchSwitches(q: string) {
    try {
      const [sw, li] = await Promise.all((['switch', 'light'] as const).map((domain) => listEntities({ domain, q: q || undefined, limit: 40 })));
      const results = [...sw.entities, ...li.entities].filter((e) => e.domain === 'switch' || e.domain === 'light').slice(0, 40);
      if (this.circuitNew && this.circuitNew.q === q) this.circuitNew = { ...this.circuitNew, results }; // a late answer to an older query is dropped
    } catch (err) {
      this.error = describeError(err);
    }
  }

  /** An undo (or a newer server document) that removes the selected circuit ends its selection and its member mode. */
  protected override willUpdate(): void {
    const doc = this.studio.doc;
    if (this.circuitSel && doc && !doc.circuits.some((k) => k.id === this.circuitSel)) {
      this.circuitSel = null;
      this.membersMode = false;
    }
  }

  private createCircuit() {
    const doc = this.studio.doc;
    const c = this.circuitNew;
    if (!doc || !c?.entity) return;
    const r = addCircuit(doc, c.name, c.entity.entity_id, c.color);
    this.studio.commit(r.doc);
    this.lastEdit = 'structure';
    this.circuitNew = null;
    this.circuitSel = r.id;
    this.membersMode = true;
    this.info = 'המעגל נוצר: לחץ על המנורות שלו';
    setTimeout(() => (this.info = ''), 4000);
  }

  private renderCircuitTool(b: MapBundle) {
    const doc = this.studio.doc;
    const lib = this.library;
    if (!doc) return html`<sw-card heading="מעגלי תאורה"><div class="note">${b.source === 'demo' ? 'נתוני הדגמה: המעגלים עובדים מול השרת.' : this.error || 'טוען…'}</div></sw-card>`;
    return renderCircuitPanel(
      { doc, sel: doc.circuits.find((k) => k.id === this.circuitSel), membersMode: this.membersMode, power: (k) => circuitPower(doc, k, (id) => (lib ? itemOf(lib, id) : undefined)), creating: this.circuitNew,
        saveState: this.studio.saveState, colors: CIRCUIT_COLORS },
      {
        select: (id) => {
          this.circuitSel = id;
          this.membersMode = false;
        },
        startNew: () => {
          this.circuitNew = { name: '', q: '', results: [], entity: null, color: CIRCUIT_COLORS[doc.circuits.length % CIRCUIT_COLORS.length], busy: false };
          void this.searchSwitches('');
        },
        cancelNew: () => (this.circuitNew = null),
        setNew: (patch) => {
          if (!this.circuitNew) return;
          this.circuitNew = { ...this.circuitNew, ...patch };
          if (patch.q !== undefined) {
            window.clearTimeout(this.circuitTimer);
            this.circuitTimer = window.setTimeout(() => void this.searchSwitches(patch.q ?? ''), 250);
          }
        },
        create: () => this.createCircuit(),
        patch: (id, patch) => this.edit((d) => patchCircuit(d, id, patch)),
        toggleMembers: () => (this.membersMode = !this.membersMode),
        remove: (id) => {
          this.edit((d) => removeItem(d, id));
          this.circuitSel = null;
          this.membersMode = false;
        },
      },
    );
  }

  /** Pins on other levels are hidden with the level filter (anchors without a level belong to the default one). */
  private onLevel(a: Anchor): boolean {
    const doc = this.studio.doc;
    const lv = this.activeLevel;
    if (!lv || !doc) return true;
    return (a.level_id ?? defaultLevelId(doc)) === lv;
  }

  private remember(itemId: string) {
    this.libRecent = [itemId, ...this.libRecent.filter((x) => x !== itemId)].slice(0, 12);
    writeList('sw.studio.recent', this.libRecent);
  }

  /** Place the armed item at a plan point; on a phone one placement disarms the item. */
  private placeItem(p: Pt) {
    const doc = this.studio.doc;
    const item = this.placingItem;
    if (!doc || !item) return;
    const r = addObject(doc, item, p, this.placeOpts(doc));
    this.studio.commit(r.doc);
    this.lastEdit = 'structure';
    this.geomSel = { id: r.id, kind: 'object' };
    this.remember(item.id);
    this.offerBinding(r.id);
    if (this.phone.matches) this.placingItem = null;
  }

  /** An item dragged from the library panel and dropped on the plan. */
  private onItemDrop(e: DragEvent) {
    const id = e.dataTransfer?.getData('text/x-sw-item');
    const canvas = this.canvas;
    const lib = this.library;
    if (!id || !canvas || !lib) return;
    e.preventDefault();
    const item = itemOf(lib, id);
    if (!item) return;
    const rect = canvas.getBoundingClientRect();
    const p = canvas.toPlan(e.clientX - rect.left, e.clientY - rect.top);
    this.placingItem = item;
    this.placeItem([p.x, p.y]);
    if (!this.phone.matches) this.placingItem = null; // a drop is one placement
  }

  /** After a placement or a move: an anchor of a kind the item may represent, within BIND_DISTANCE_M, is offered. */
  private offerBinding(objectId: string) {
    const b = this.bundle;
    const doc = this.studio.doc;
    const lib = this.library;
    this.bindOffer = null;
    if (!b || !doc || !lib) return;
    const o = doc.objects.find((x) => x.id === objectId);
    const item = o ? itemOf(lib, o.item_id) : undefined;
    if (!o || !item || !item.anchor_kinds.length || o.anchor_ref || this.bindRefused.has(objectId)) return;
    const { scale } = effectiveScale(doc);
    // an anchor that already has a body is not offered a second one
    const bodied = new Set(doc.objects.filter((x) => x.anchor_ref).map((x) => `${x.anchor_ref!.resource_type}:${x.anchor_ref!.resource_id}`));
    let best: { a: Anchor; d: number } | null = null;
    for (const a of this.anchors) {
      if (bodied.has(`${a.resource_type}:${a.resource_id}`) || !this.onLevel(a)) continue; // a pin hidden by the level filter is not offered
      const kind = a.resource_type === 'camera' ? 'camera' : (a.entity?.domain ?? a.resource_id.split('.')[0]);
      if (!item.anchor_kinds.includes(kind)) continue;
      const d = distanceM(o.position, [a.position.x, a.position.y], b.width, b.height, scale);
      if (d <= BIND_DISTANCE_M && (!best || d < best.d)) best = { a, d };
    }
    if (best) this.bindOffer = { objectId, anchor: best.a };
  }

  /** The object becomes the anchor's body: it takes the anchor's position and rotation now, and follows it from here on. */
  private bindObject(objectId: string, a: Anchor) {
    this.edit((d) => patchObject(d, objectId, { anchor_ref: { resource_type: a.resource_type, resource_id: a.resource_id }, position: [a.position.x, a.position.y], rotation_deg: a.rotation_degrees }));
    this.bindOffer = null;
    this.info = `העצם הוא עכשיו הגוף של ${this.anchorName(a)}`;
    setTimeout(() => (this.info = ''), 3000);
  }

  // ---- arrays, groups, custom items (T085) ----

  private openArray(objectId: string) {
    const doc = this.studio.doc;
    const lib = this.library;
    const o = doc?.objects.find((x) => x.id === objectId);
    const item = o && lib ? itemOf(lib, o.item_id) : undefined;
    if (!doc || !o) return;
    if (this.phone.matches) {
      this.info = 'מערכים זמינים בדסקטופ בלבד';
      setTimeout(() => (this.info = ''), 3000);
      return;
    }
    const d = item ? arrayDefaults(item) : { spacingX: round(o.size.w_m + 0.05), spacingY: round(o.size.d_m + 0.45) };
    this.arrayDialog = { objectId, item, rows: 2, cols: 4, spacingX: d.spacingX, spacingY: d.spacingY, directionDeg: o.rotation_deg, max: ARRAY_MAX, error: '' };
  }

  private createArray() {
    const b = this.bundle;
    const doc = this.studio.doc;
    const a = this.arrayDialog;
    if (!b || !doc || !a) return;
    const r = addArray(doc, a.objectId, a, b.width, b.height, effectiveScale(doc).scale);
    if (!r) {
      this.arrayDialog = { ...a, error: 'לא ניתן ליצור את המערך (העצם כבר במערך, או שיש יותר מדי עצמים)' }; // inside the dialog: the bar is behind the modal
      return;
    }
    this.arrayDialog = null;
    this.studio.commit(r.doc);
    this.lastEdit = 'structure';
    this.geomSel = { id: r.groupId, kind: 'group' };
    this.info = `${r.ids.length} עצמים במערך אחד`;
    setTimeout(() => (this.info = ''), 4000);
  }

  private deleteGroup(withMembers: boolean) {
    const gid = this.groupDelete;
    this.groupDelete = null;
    if (!gid) return;
    this.edit((d) => removeGroup(d, gid, withMembers));
    this.geomSel = null;
  }

  private openCustom(objectId: string) {
    const doc = this.studio.doc;
    const lib = this.library;
    const o = doc?.objects.find((x) => x.id === objectId);
    if (!doc || !lib || !o) return;
    const item = itemOf(lib, o.item_id);
    this.customDialog = {
      objectId, nameHe: item ? `${item.names.he} (מותאם)` : '', nameEn: item?.names.en ?? '', category: item?.category ?? 'storage', shape: item?.shape ?? 'box', icon: item?.icon ?? 'box',
      color: item?.color_token ?? 'object', size: { ...o.size }, basedOn: item ? (item.custom ? item.based_on : item.id) : null, busy: false, error: '',
      params: JSON.parse(JSON.stringify(o.params)) as Record<string, unknown>, z: item && item.z_ref === 'ceiling' ? item.z_m : o.z_m,
    };
  }

  private async createCustom() {
    const c = this.customDialog;
    const b = this.bundle;
    if (!c || !b) return;
    this.customDialog = { ...c, busy: true, error: '' };
    try {
      const item = await createItem({ based_on: c.basedOn, names: { he: c.nameHe.trim(), en: c.nameEn.trim() }, category: c.category, shape: c.shape, icon: c.icon, color_token: c.color, size: c.size, z_m: c.z, params: c.params });
      this.customDialog = null;
      await this.loadLibraryFor(b);
      this.remember(item.id);
      this.libCategory = 'recent';
      this.libQ = '';
      this.info = `הפריט "${item.names.he}" נוסף לספרייה`;
      setTimeout(() => (this.info = ''), 4000);
    } catch (err) {
      this.customDialog = { ...c, busy: false, error: describeError(err) };
    }
  }

  private async importLibrary(file: File) {
    const b = this.bundle;
    if (!b) return;
    try {
      let parsed: { format?: string; items?: unknown[] } | null;
      try {
        parsed = JSON.parse(await file.text()) as { format?: string; items?: unknown[] } | null;
      } catch {
        parsed = null; // not JSON at all
      }
      if (parsed?.format !== 'smplwise-catalog-1' || !Array.isArray(parsed.items)) throw new Error('הקובץ אינו ייצוא של ספרייה מותאמת (smplwise-catalog-1)');
      const r = await importItems(parsed.items);
      await this.loadLibraryFor(b);
      this.info = `${r.imported} יובאו, ${r.replaced} הוחלפו`;
      setTimeout(() => (this.info = ''), 4000);
    } catch (err) {
      this.error = err instanceof Error && !(err instanceof ApiError) ? err.message : describeError(err);
    }
  }

  private get catalogLookup(): CatalogLookup | null {
    return this.libLookup;
  }

  private get studioOn(): boolean {
    return STUDIO_TOOLS.includes(this.tool) && !!this.studio.doc;
  }

  /** Clicks on the plan go to the studio tool instead of selecting pins. */
  private get studioPlacing(): boolean {
    if (!this.studioOn) return false;
    if (this.tool === 'detect') return false; // its clicks are candidate clicks, handled by the canvas hits
    if (this.tool === 'library') return !!this.placingItem;
    if (this.tool === 'connectors') return !!this.connMode;
    if (this.tool === 'circuits') return false; // a click on a lamp selects it (member mode); a bare click places nothing
    return this.tool !== 'structure' || this.studioMode !== 'select';
  }

  /** What the pointer can grab in the structure (owner report on 0.1.82: a door just placed could not be slid along its
   * wall without switching to select mode). Select mode: everything, corners included. Every drawing mode: the existing
   * openings and labels, so a press on one drags it (or selects it) while a press on a bare wall still places a door;
   * in wall mode a corner stays a snap target for the new wall, not a handle. Nothing while a wall is being drawn: its
   * clicks belong to the drawing. The library tool: objects and connectors, unless an item is being placed. */
  private get geomDragMode(): GeomDragMode {
    if (!this.studio.doc) return 'none';
    // hotfix 0.1.87 (owner report 2026-09-25): the select tool ("בחירה וגרירה") selects and drags the structure too
    if (this.tool === 'select') return this.bundle?.permissions.structure && !this.placing && !this.drawing ? 'all' : 'none';
    if (this.tool === 'library') return this.placingItem ? 'none' : 'objects';
    if (this.tool === 'connectors') return this.connMode ? 'none' : 'objects';
    if (this.tool === 'circuits') return 'objects';
    if (this.tool !== 'structure') return 'none';
    if (this.studioMode === 'select') return 'all';
    return this.wallDraft ? 'none' : 'items';
  }

  /** Where a selected wall shows its corner handles, moves as a whole and a selected corner takes the keys: the
   * structure tool's select mode and the select tool (0.1.87). */
  private get geomSelectMode(): boolean {
    return (this.tool === 'structure' && this.studioMode === 'select') || this.tool === 'select';
  }

  /** A structure item is selected in the select tool: Delete, the arrows and Ctrl+Z / Ctrl+Y act on the structure. */
  private get selectGeomOn(): boolean {
    return this.tool === 'select' && !!this.geomSel && !!this.studio.doc && !this.selectedId;
  }

  /** The stack Ctrl+Z / the rail's undo acts on: the studio tools undo the structure; the select tool follows the last
   * edit's stack (lastEdit) and falls back to the other one when that stack is empty; other tools undo the pins. */
  private get undoTarget(): 'structure' | 'pins' | null {
    if (this.studioOn) return this.studio.canUndo ? 'structure' : null;
    if (this.tool === 'select' && this.studio.doc && this.studio.canUndo && (this.lastEdit === 'structure' || !this.undo.length)) return 'structure';
    return this.undo.length ? 'pins' : null;
  }

  private get redoTarget(): 'structure' | 'pins' | null {
    if (this.studioOn) return this.studio.canRedo ? 'structure' : null;
    if (this.tool === 'select' && this.studio.doc && this.studio.canRedo && (this.lastEdit === 'structure' || !this.redo.length)) return 'structure';
    return this.redo.length ? 'pins' : null;
  }

  private undoAny() {
    const t = this.undoTarget;
    if (t === 'structure') {
      this.studio.undo();
      this.geomSel = null;
      this.lastEdit = 'structure';
    } else if (t === 'pins') {
      this.doUndo();
      this.lastEdit = 'pins'; // a fallback undo moves the domain, so the next redo mirrors it
    }
  }

  private redoAny() {
    const t = this.redoTarget;
    if (t === 'structure') {
      this.studio.redo();
      this.geomSel = null;
      this.lastEdit = 'structure';
    } else if (t === 'pins') {
      this.doRedo();
      this.lastEdit = 'pins';
    }
  }

  private get issueIds(): string[] {
    return this.studio.issues.filter((i) => i.severity === 'error' && i.id).map((i) => i.id as string);
  }

  /** One undoable edit of the structure draft; an edit that changes nothing adds no undo step and no save. */
  private edit(fn: (doc: GeometryDoc) => GeometryDoc) {
    const doc = this.studio.doc;
    if (!doc) return;
    const next = fn(doc);
    if (next === doc || JSON.stringify(next) === JSON.stringify(doc)) return;
    this.studio.commit(next);
    this.lastEdit = 'structure';
  }

  private snap(p: Pt, prev: Pt | null, free: boolean): Pt {
    const b = this.bundle;
    const doc = this.studio.doc;
    if (!b || !doc) return p;
    return snapPoint(p, prev, this.shownWalls(doc), b.width, b.height, { tolPx: CORNER_SNAP_PX / (this.canvas?.zoom ?? 1), free });
  }

  /** A point of the wall being drawn: from three points on, the draft's own first point (closing the outline) wins over
   * every other snap, within a wall corner's tolerance - so the snap dot shows where a click closes. */
  private snapDraw(p: Pt, draft: Pt[], free: boolean): Pt {
    const b = this.bundle;
    const first = draft.length >= 3 ? draft[0] : null;
    if (b && first && Math.hypot((p[0] - first[0]) * b.width, (p[1] - first[1]) * b.height) * (this.canvas?.zoom ?? 1) <= CORNER_SNAP_PX) return first;
    return this.snap(p, draft.at(-1) ?? null, free);
  }

  /** The existing opening on `wall` whose span, widened by a few screen pixels, holds position t (the nearest one): a
   * placing click there takes that opening instead of stacking a second one on it (review of 0.1.83: a click 7 to 14 px
   * off the wall missed the opening's hit target but still found the wall). */
  private openingAt(doc: GeometryDoc, wall: GeomWall, t: number): GeomOpening | null {
    const lengthM = this.wallLengthM(wall, doc);
    const marginM = (OPENING_PICK_MARGIN_PX / (this.canvas?.zoom ?? 1)) * effectiveScale(doc).scale;
    let best: GeomOpening | null = null;
    let bestM = Number.POSITIVE_INFINITY;
    for (const o of doc.openings) {
      const m = o.wall_id === wall.id ? Math.abs(o.t - t) * lengthM : Number.POSITIVE_INFINITY;
      if (m <= o.width_m / 2 + marginM && m < bestM) {
        best = o;
        bestM = m;
      }
    }
    return best;
  }

  /** `onItem`: the cursor is on an existing opening or label - a press there takes that item, so no placing dot. */
  private onPlanHover(x: number, y: number, shift: boolean, onItem = false) {
    const b = this.bundle;
    const doc = this.studio.doc;
    if (!b || !doc || !this.studioPlacing || onItem) {
      this.hover = null;
      return;
    }
    const p: Pt = [x, y];
    if (this.tool === 'library') this.hover = p;
    else if (this.tool === 'connectors') this.hover = this.snap(p, null, true);
    else if (this.tool === 'calibrate') this.hover = this.snap(p, null, true);
    else if (this.tool === 'measure') this.hover = this.snap(p, this.measurePts.at(-1) ?? null, shift);
    else if (this.studioMode === 'wall') this.hover = this.snapDraw(p, this.wallDraft ?? [], shift);
    else if (this.studioMode === 'label') this.hover = p;
    else {
      // no dot where a click would take an existing opening rather than place a new one
      const hit = nearestWall(p, this.shownWalls(doc), b.width, b.height, WALL_PICK_PX / (this.canvas?.zoom ?? 1));
      this.hover = hit && !this.openingAt(doc, hit.wall, hit.t) ? pointOnWall(hit.wall, hit.t, b.width, b.height) : null;
    }
  }

  private studioClick(x: number, y: number, shift: boolean) {
    const b = this.bundle;
    const doc = this.studio.doc;
    if (!b || !doc) return;
    const p: Pt = [x, y];
    if (this.tool === 'library') {
      if (this.placingItem) this.placeItem(p);
      return;
    }
    if (this.tool === 'connectors') {
      if (!this.connMode) return;
      const q = this.snap(p, null, true);
      if (!this.connStart) {
        this.connStart = q;
        return;
      }
      const from = this.placeOpts(doc).levelId;
      const others = doc.levels.filter((l) => l.id !== from);
      const r = addConnector(doc, this.connMode, this.connStart, q, from, others.length === 1 ? others[0].id : null);
      this.connStart = null;
      this.studio.commit(r.doc);
      this.lastEdit = 'structure';
      this.geomSel = { id: r.id, kind: 'connector' };
      return;
    }
    if (this.tool === 'calibrate') {
      const q = this.snap(p, null, true); // corners of walls attract; no angle snapping - the distance is what counts
      const c = this.calib;
      this.calib = !c.a || c.b ? { ...EMPTY_CALIB, a: q } : { ...c, b: q };
      return;
    }
    if (this.tool === 'measure') {
      this.measurePts = [...this.measurePts, this.snap(p, this.measurePts.at(-1) ?? null, shift)];
      return;
    }
    const mode = this.studioMode;
    const zoom = this.canvas?.zoom ?? 1;
    if (mode === 'wall') {
      const d = this.wallDraft ?? [];
      const q = this.snapDraw(p, d, shift);
      // Tested on the raw click: the angle snap can move a click on a drawn point far from it. The raw position of the
      // last click counts too - the angle snap keeps the distance to the previous point, so without it a double click
      // would not end a wall whose last point the snap moved.
      const near = (a: Pt | null) => !!a && Math.hypot((a[0] - p[0]) * b.width, (a[1] - p[1]) * b.height) * zoom < 8;
      if (d.length && (near(d[d.length - 1]) || near(this.lastDrawClick))) {
        this.finishWall(); // a second click on the last point ends the wall (a double click does the same)
        return;
      }
      if (d.length >= 3 && q === d[0]) {
        this.wallDraft = [...d, d[0]]; // back on the first point (the snap put the click there): a closed outline
        this.finishWall();
        return;
      }
      this.wallDraft = [...d, q];
      this.lastDrawClick = p;
      return;
    }
    if (mode === 'label') {
      const r = addLabel(doc, p, 'תווית');
      const level = this.placeOpts(doc).levelId;
      this.studio.commit(level === defaultLevelId(doc) ? r.doc : patchLabel(r.doc, r.id, { level_id: level }));
      this.lastEdit = 'structure';
      this.geomSel = { id: r.id, kind: 'label' };
      return;
    }
    if (mode === 'select') return;
    const hit = nearestWall(p, this.shownWalls(doc), b.width, b.height, WALL_PICK_PX / zoom);
    if (!hit) {
      this.info = 'לחץ על קיר כדי להציב פתח';
      setTimeout(() => (this.info = ''), 2500);
      return;
    }
    const existing = this.openingAt(doc, hit.wall, hit.t);
    if (existing) {
      this.onGeomSelect(existing.id, 'opening'); // a click on an existing opening takes it: no second one on top
      return;
    }
    // a click near the end of the wall places the opening flush with the end, never sticking out of it
    const [lo, hi] = openingRange(kindDefaults(mode).width_m, this.wallLengthM(hit.wall, doc));
    const r = addOpening(doc, hit.wall.id, Math.min(hi, Math.max(lo, hit.t)), mode);
    this.studio.commit(r.doc);
    this.lastEdit = 'structure';
    this.geomSel = { id: r.id, kind: 'opening' };
  }

  private finishWall() {
    const d = this.wallDraft;
    this.wallDraft = null;
    this.hover = null;
    const doc = this.studio.doc;
    if (!doc || !d || d.length < 2) return;
    const r = addWall(doc, d, this.wallDefaults);
    const level = this.placeOpts(doc).levelId;
    this.studio.commit(level === defaultLevelId(doc) ? r.doc : patchWall(r.doc, r.id, { level_id: level }));
    this.lastEdit = 'structure';
    this.geomSel = { id: r.id, kind: 'wall' };
  }

  private onGeomSelect(id: string, kind: GeomKind, vertex?: number) {
    if (this.tool === 'circuits' && this.membersMode && kind === 'object' && this.circuitSel) {
      const doc = this.studio.doc;
      const lib = this.library;
      const o = doc?.objects.find((x) => x.id === id);
      const item = o && lib ? itemOf(lib, o.item_id) : undefined;
      if (item && item.role !== 'light') {
        this.info = `${item.names.he} אינו גוף תאורה`;
        setTimeout(() => (this.info = ''), 2500);
        return;
      }
      const cid = this.circuitSel;
      this.edit((d) => toggleCircuitMember(d, cid, id));
      return;
    }
    // the object inspector lives in the library tool (pickTool clears the selection, so it goes first); the select tool
    // shows the inspectors itself (0.1.87), so a click there never changes the tool
    if (kind === 'object' && this.tool !== 'library' && this.tool !== 'select') this.pickTool('library');
    if (kind === 'connector' && this.tool !== 'connectors' && this.tool !== 'select') this.pickTool('connectors');
    if (kind === 'connector' && this.tool === 'select' && !this.tree && this.bundle?.source === 'api') void loadTree().then((t) => (this.tree = t)).catch(() => {});
    this.zoneVertexSel = null;
    this.geomSel = vertex === undefined ? { id, kind } : { id, kind, vertex };
    this.selectedId = null;
    this.selectedZoneId = null;
    if (kind !== 'object' && kind !== 'group') this.bindOffer = null;
  }

  /** A wall's length in metres (estimated before calibration), in the bundle's plan pixels - as the validator measures it. */
  private wallLengthM(w: GeomWall, doc: GeometryDoc): number {
    const b = this.bundle;
    return b ? lengthPx(w.polyline, b.width, b.height) * effectiveScale(doc).scale : 0;
  }

  /** Where a structure drag puts its item: the document after the drop and what is selected then. A corner snaps to the
   * other walls' corners; an opening moves along its own wall by as much as the pointer did (it keeps the offset it was
   * grabbed at, no jump to the pointer) and stays inside the wall; a label moves by the pointer's movement. The live
   * preview and the drop use the same answer. */
  private dragged(doc: GeometryDoc, d: GeomDragDetail): { doc: GeometryDoc; sel: GeomSel } | null {
    const b = this.bundle;
    if (!b) return null;
    const p: Pt = [d.x, d.y];
    if (d.kind === 'object' || d.kind === 'object-duplicate') {
      const o = doc.objects.find((v) => v.id === d.id);
      if (!o) return null;
      if (o.anchor_ref) return { doc, sel: { id: d.id, kind: 'object' } }; // a body moves with its anchor, never by hand
      const to: Pt = [o.position[0] + d.x - d.sx, o.position[1] + d.y - d.sy]; // by the pointer's movement: no jump to the pointer
      if (d.kind === 'object-duplicate') {
        this.dupId ??= newId();
        const r = duplicateObject(doc, d.id, to, this.dupId);
        return { doc: r.doc, sel: { id: r.id, kind: 'object' } };
      }
      if (this.geomSel?.kind === 'group' && o.group_id === this.geomSel.id) {
        return { doc: moveGroup(doc, o.group_id, to[0] - o.position[0], to[1] - o.position[1]), sel: { id: o.group_id, kind: 'group' } }; // the whole array follows the dragged member
      }
      return { doc: moveObject(doc, d.id, to), sel: { id: d.id, kind: 'object' } };
    }
    if (d.kind === 'object-rotate') {
      const o = doc.objects.find((v) => v.id === d.id);
      if (!o || o.anchor_ref) return null;
      return { doc: patchObject(doc, d.id, { rotation_deg: rotationTo(o, p, b.width, b.height, d.shift ? 15 : 1) }), sel: { id: d.id, kind: 'object' } };
    }
    if (d.kind === 'object-stretch') {
      const o = doc.objects.find((v) => v.id === d.id);
      if (!o) return null;
      const size = stretchedSize(o, (d.index % 4) as 0 | 1 | 2 | 3, p, b.width, b.height, effectiveScale(doc).scale, d.shift);
      return { doc: patchObject(doc, d.id, { size }), sel: { id: d.id, kind: 'object' } };
    }
    if (d.kind === 'connector-vertex') {
      const c = doc.connectors.find((v) => v.id === d.id);
      if (!c || connectorDerived(c)) return null;
      return { doc: moveConnectorVertex(doc, d.id, d.index, this.snap(p, null, true)), sel: { id: d.id, kind: 'connector' } };
    }
    if (d.kind === 'wall') {
      const w = doc.walls.find((v) => v.id === d.id);
      if (!w) return null;
      return { doc: translateWall(doc, w.id, ...this.wallDelta(doc, w, d)), sel: { id: w.id, kind: 'wall' } };
    }
    if (d.kind === 'vertex') {
      const w = doc.walls.find((v) => v.id === d.id);
      if (!w) return null;
      const pl = w.polyline;
      const last = pl.length - 1;
      const closed = isClosedOutline(pl);
      const i = closed && d.index === last ? 0 : d.index; // the closing corner of an outline is one corner: both ends move
      // Snap targets: the other walls and this wall's own corners, except the dragged one and its neighbours.
      const corners = closed ? last : pl.length;
      const skip = closed ? [(i + corners - 1) % corners, i, (i + 1) % corners] : [i - 1, i, i + 1];
      const own: GeomWall = { ...w, polyline: pl.slice(0, corners).filter((_, k) => !skip.includes(k)) };
      const targets = [...doc.walls.filter((v) => v.id !== d.id), own];
      const q = snapPoint(p, i > 0 ? pl[i - 1] : null, targets, b.width, b.height, { tolPx: CORNER_SNAP_PX / (this.canvas?.zoom ?? 1), free: true });
      return { doc: closed && i === 0 ? moveVertex(moveVertex(doc, d.id, 0, q), d.id, last, q) : moveVertex(doc, d.id, i, q), sel: { id: d.id, kind: 'wall', vertex: i } };
    }
    if (d.kind === 'opening') {
      const sel: GeomSel = { id: d.id, kind: 'opening' };
      const o = doc.openings.find((v) => v.id === d.id);
      const w = o && doc.walls.find((v) => v.id === o.wall_id);
      const now = o && w ? nearestWall(p, [w], b.width, b.height, Number.POSITIVE_INFINITY) : null;
      const grab = o && w ? nearestWall([d.sx, d.sy], [w], b.width, b.height, Number.POSITIVE_INFINITY) : null;
      if (!o || !w || !now || !grab) return { doc, sel };
      const [lo, hi] = openingRange(o.width_m, this.wallLengthM(w, doc));
      return { doc: patchOpening(doc, d.id, { t: Math.min(hi, Math.max(lo, o.t + now.t - grab.t)) }), sel };
    }
    const l = doc.labels.find((v) => v.id === d.id);
    const sel: GeomSel = { id: d.id, kind: 'label' };
    return l ? { doc: patchLabel(doc, d.id, { position: [l.position[0] + d.x - d.sx, l.position[1] + d.y - d.sy] }), sel } : { doc, sel };
  }

  /** How far a whole-wall drag moves the wall (0.1.87): by the pointer's movement since the press; Shift keeps only the
   * larger of the two screen components (a straight horizontal or vertical move); then the corner snap - the first corner
   * of the wall that comes within the corner snap radius of another shown wall's corner lands on it, and the whole wall
   * follows by the same correction (with Shift only along the kept axis). */
  private wallDelta(doc: GeometryDoc, w: GeomWall, d: GeomDragDetail): [number, number] {
    const b = this.bundle;
    let dx = d.x - d.sx;
    let dy = d.y - d.sy;
    if (!b) return [dx, dy];
    if (d.shift) {
      if (Math.abs(dx * b.width) >= Math.abs(dy * b.height)) dy = 0;
      else dx = 0;
    }
    const others = this.shownWalls(doc).filter((v) => v.id !== w.id);
    const tolPx = CORNER_SNAP_PX / (this.canvas?.zoom ?? 1);
    let best: [number, number] | null = null;
    let bestD = Number.POSITIVE_INFINITY;
    const corners = isClosedOutline(w.polyline) ? w.polyline.slice(0, -1) : w.polyline;
    for (const v of corners) {
      const at: Pt = [v[0] + dx, v[1] + dy];
      const q = snapPoint(at, null, others, b.width, b.height, { tolPx, free: true });
      const c: [number, number] = [q[0] - at[0], q[1] - at[1]];
      const dist = Math.hypot(c[0] * b.width, c[1] * b.height);
      if (dist > 0 && dist < bestD) {
        best = c;
        bestD = dist;
      }
    }
    if (best && !d.shift) {
      dx += best[0];
      dy += best[1];
    } else if (best && dy === 0) dx += best[0]; // Shift: the correction only along the kept axis
    else if (best) dy += best[1];
    return [dx, dy];
  }

  /** While the pointer moves: the dragged item is the selection and shows where it is going (nothing is saved yet). */
  private onGeomDragMove(d: GeomDragDetail) {
    const doc = this.studio.doc;
    const r = doc ? this.dragged(doc, d) : null;
    this.geomPreview = r?.doc ?? null;
    if (r) this.onGeomSelect(r.sel.id, r.sel.kind, r.sel.vertex);
  }

  /** The drop: one undoable edit (an unchanged position adds none), autosaved like every edit. */
  private onGeomDrag(d: GeomDragDetail) {
    this.geomPreview = null;
    const doc = this.studio.doc;
    const r = doc ? this.dragged(doc, d) : null;
    if (!r) return;
    this.edit(() => r.doc);
    this.onGeomSelect(r.sel.id, r.sel.kind, r.sel.vertex);
    this.dupId = null;
    if (r.sel.kind === 'object') this.offerBinding(r.sel.id);
  }

  /** Arrow keys on the selected structure item (the structure tool, any mode), in screen directions. An opening moves
   * along its wall towards the arrow (owner ruling on 0.1.83): on a wall that runs more across the screen than up it
   * (|dx| >= |dy| at the opening) Right moves it towards the end with the larger x and Left the other way, on a steeper
   * wall Up moves it towards the end with the smaller y and Down the other way; a key across the wall does nothing. It
   * moves 1 cm (Shift: 10 cm) on a calibrated plan, else 0.2 % of the plan's width (Shift: 1 %), whatever the wall's
   * length, and never out of the wall. A label, and in select mode (the structure tool's, or the select tool) a selected
   * wall corner - or the whole selected wall when no corner is picked (0.1.87) - move by the same steps, inside the plan. */
  private nudgeGeom(e: KeyboardEvent): boolean {
    const sel = this.geomSel;
    const b = this.bundle;
    const doc = this.studio.doc;
    if (!sel || !b || !doc || this.geomPreview || this.wallDraft || e.ctrlKey || e.metaKey || e.altKey) return false;
    const { scale, estimated } = effectiveScale(doc);
    const stepPx = estimated ? (e.shiftKey ? 0.01 : 0.002) * b.width : (e.shiftKey ? 0.1 : 0.01) / scale; // plan pixels
    let next: GeometryDoc;
    let key = sel.id;
    if (sel.kind === 'opening') {
      const o = doc.openings.find((x) => x.id === sel.id);
      const w = o && doc.walls.find((x) => x.id === o.wall_id);
      const lengthPxW = w ? lengthPx(w.polyline, b.width, b.height) : 0;
      if (!o || !w || !(lengthPxW > 0)) return false;
      const [dx, dy] = wallDirectionAt(w, o.t, b.width, b.height); // towards the wall's end, y down
      const across = Math.abs(dx) >= Math.abs(dy); // the wall runs across the screen rather than up it
      let along = 0; // +1 towards the wall's end, -1 towards its start
      if (across && e.key === 'ArrowRight') along = Math.sign(dx);
      else if (across && e.key === 'ArrowLeft') along = -Math.sign(dx);
      else if (!across && e.key === 'ArrowDown') along = Math.sign(dy);
      else if (!across && e.key === 'ArrowUp') along = -Math.sign(dy);
      e.preventDefault(); // the key is the item's, also when it points across the wall (no page scroll)
      if (!along) return true;
      next = patchOpening(doc, o.id, { t: nudgeT(o.t, (along * stepPx) / lengthPxW, openingRange(o.width_m, this.wallLengthM(w, doc))) });
    } else {
      const dx = (e.key === 'ArrowRight' ? stepPx : e.key === 'ArrowLeft' ? -stepPx : 0) / b.width;
      const dy = (e.key === 'ArrowDown' ? stepPx : e.key === 'ArrowUp' ? -stepPx : 0) / b.height;
      if (sel.kind === 'object') {
        const o = doc.objects.find((x) => x.id === sel.id);
        if (!o || o.anchor_ref) return false;
        next = moveObject(doc, o.id, [o.position[0] + dx, o.position[1] + dy]);
      } else if (sel.kind === 'label') {
        const l = doc.labels.find((x) => x.id === sel.id);
        if (!l) return false;
        next = patchLabel(doc, l.id, { position: [l.position[0] + dx, l.position[1] + dy] });
      } else {
        const w = doc.walls.find((x) => x.id === sel.id);
        const i = sel.vertex;
        if (!this.geomSelectMode || !w) return false;
        if (i === undefined) {
          next = translateWall(doc, w.id, dx, dy); // no corner picked: the whole wall moves (0.1.87)
          key = `${w.id}:all`;
        } else {
          if (!w.polyline[i]) return false;
          const q: Pt = [w.polyline[i][0] + dx, w.polyline[i][1] + dy];
          const last = w.polyline.length - 1;
          next = isClosedOutline(w.polyline) && i === 0 ? moveVertex(moveVertex(doc, w.id, 0, q), w.id, last, q) : moveVertex(doc, w.id, i, q);
          key = `${w.id}:${i}`;
        }
      }
    }
    e.preventDefault(); // the key is the item's even at the end of its range (no page scroll)
    const item = (d: GeometryDoc) => JSON.stringify(sel.kind === 'opening' ? d.openings.find((x) => x.id === sel.id) : sel.kind === 'label' ? d.labels.find((x) => x.id === sel.id) : sel.kind === 'object' ? d.objects.find((x) => x.id === sel.id) : d.walls.find((x) => x.id === sel.id));
    if (item(next) !== item(doc)) this.commitNudge(key, next); // at the end of its range nothing moves and nothing is added
    return true;
  }

  /** One nudge. A press that continues the last burst takes the burst's own step back and commits the new position in
   * its place (the controller keeps a stack of documents and has no call that amends its top), so a held key is one
   * undo step that returns to where the burst started. */
  private commitNudge(key: string, next: GeometryDoc) {
    const doc = this.studio.doc;
    if (!doc) return;
    const now = performance.now();
    const burst = this.nudgeBurst;
    if (burst && burst.key === key && burst.doc === doc && now - burst.at < NUDGE_BURST_MS && this.studio.canUndo) this.studio.undo();
    this.studio.commit(next);
    this.lastEdit = 'structure';
    this.nudgeBurst = { key, doc: next, at: now };
  }

  /** Keys of the studio tools; true when the key was used. Ctrl+Z / Ctrl+Y undo the structure, not the pins. */
  private handleStudioKey(e: KeyboardEvent): boolean {
    const mod = e.ctrlKey || e.metaKey;
    const key = e.key.toLowerCase();
    if (e.key === 'Enter' && this.wallDraft) {
      e.preventDefault();
      this.finishWall();
      return true;
    }
    if ((e.key === 'Backspace' || e.key === 'Delete') && this.wallDraft) {
      e.preventDefault(); // while drawing, both remove the last point (never the item selected before)
      this.wallDraft = this.wallDraft.length > 1 ? this.wallDraft.slice(0, -1) : null;
      this.lastDrawClick = null;
      return true;
    }
    if (this.tool === 'detect') {
      if ((e.key === 'Delete' || e.key === 'Backspace') && this.candSel) {
        e.preventDefault();
        if ((this.candStates[this.candSel] ?? 'accepted') === 'accepted') this.toggleCandidate(this.candSel);
        return true;
      }
    }
    if (this.detectBusy && mod && (key === 'z' || key === 'y')) return true; // no undo while a detection or an accept is in flight
    if ((e.key === 'Delete' || e.key === 'Backspace') && this.geomSel) {
      e.preventDefault();
      const { id, kind, vertex } = this.geomSel;
      if (kind === 'group') {
        this.groupDelete = id; // never confirm(): the dialog asks whether the members go too
        return true;
      }
      const derivedConn = kind === 'connector' ? this.studio.doc?.connectors.find((c) => c.id === id) : undefined;
      if (derivedConn && connectorDerived(derivedConn)) {
        this.info = 'המחבר נגזר מעצם: מוחקים או עורכים את העצם עצמו'; // the server regenerates it on every save
        setTimeout(() => (this.info = ''), 4000);
        return true;
      }
      if (kind === 'wall' && vertex !== undefined && this.geomSelectMode) {
        // a selected corner goes alone while the wall keeps enough corners (studio-ops removeCorner), else the wall goes
        const doc = this.studio.doc;
        const r = doc ? removeCorner(doc, id, vertex) : null;
        if (r) this.edit(() => r.doc);
        this.geomSel = r && !r.wallRemoved ? { id, kind } : null;
        return true;
      }
      this.edit((d) => removeItem(d, id));
      this.geomSel = null;
      return true;
    }
    if (ARROWS.includes(e.key) && (this.tool === 'structure' || this.tool === 'library' || this.tool === 'select') && this.nudgeGeom(e)) return true;
    if (mod && (key === 'z' || key === 'y')) {
      e.preventDefault();
      if (key === 'y' || e.shiftKey) this.redoAny();
      else this.undoAny();
      return true;
    }
    if (mod && key === 's') {
      e.preventDefault();
      void this.studio.flush();
      if (this.tool === 'select' && this.dirty.size) void this.save(); // the select tool also holds moved pins (0.1.87)
      return true;
    }
    return false;
  }

  /** Bring an item into view and select it (the issue list, publish errors). */
  private focusGeom(id: string) {
    const b = this.bundle;
    const doc = this.studio.doc;
    if (!b || !doc) return;
    if (this.activeLevel !== null && !visibleUnderLevel(doc, id, this.activeLevel)) this.levelFilter = null; // lift a filter that would hide the target (final review item 1)
    const w = doc.walls.find((x) => x.id === id);
    const o = doc.openings.find((x) => x.id === id);
    const l = doc.labels.find((x) => x.id === id);
    const host = o ? doc.walls.find((x) => x.id === o.wall_id) : undefined;
    const ob = doc.objects.find((x) => x.id === id);
    const at: Pt | null = w ? pointOnWall(w, 0.5, b.width, b.height) : o && host ? pointOnWall(host, o.t, b.width, b.height) : l ? l.position : ob ? ob.position : null;
    if (ob) {
      this.pickTool('library');
      this.geomSel = { id, kind: 'object' };
      if (at) this.canvas?.centerOn(at[0], at[1]);
      return;
    }
    const cn = doc.connectors.find((x) => x.id === id);
    if (cn) {
      this.pickTool('connectors');
      this.geomSel = { id, kind: 'connector' };
      const mid = cn.polyline[Math.floor(cn.polyline.length / 2)];
      if (mid) this.canvas?.centerOn(mid[0], mid[1]);
      return;
    }
    this.tool = 'structure';
    this.studioMode = 'select';
    this.wallDraft = null;
    this.geomSel = w ? { id, kind: 'wall' } : o ? { id, kind: 'opening' } : l ? { id, kind: 'label' } : null;
    if (at) this.canvas?.centerOn(Math.min(1, Math.max(0, at[0])), Math.min(1, Math.max(0, at[1])));
  }

  private async copyStructure(fromVersionId: string) {
    const b = this.bundle;
    if (!b?.planVersionId) return;
    this.busy = true;
    this.error = '';
    try {
      if (!(await this.studio.flush())) {
        this.error = this.studio.error;
        return;
      }
      await copyGeometryFrom(b.planVersionId, fromVersionId);
      if (await this.loadStudio(b, true)) {
        this.info = 'המבנה הועתק לטיוטה; בדוק מיקומים ופרסם';
        setTimeout(() => (this.info = ''), 4000);
      }
    } catch (err) {
      this.error = describeError(err);
    } finally {
      this.busy = false;
    }
  }

  // ---- Plan Studio: detection (T086) ----

  private takeDxf(versionId: string) {
    const r = takeDxfCandidates(versionId);
    this.presetCandidates = '';
    if (!r) return;
    this.showCandidates(r, 'dxf');
    this.pickTool('detect');
  }

  /** A fresh candidate set: detected metres follow the document's effective scale (the server may have assumed another
   * one); DXF metres come from the drawing's units and stay. Everything starts accepted. */
  private showCandidates(r: DetectResult, source: 'detect' | 'dxf') {
    const doc = this.studio.doc;
    let set = fromResult(r);
    if (doc && source === 'detect') {
      const { scale } = effectiveScale(doc);
      if (set.scaleMPerPx === null || Math.abs(set.scaleMPerPx - scale) > scale * 1e-6) set = rescale(set, scale);
    }
    this.cands = { set, result: r, source };
    this.candStates = defaultStates(set);
    this.candSel = null;
    this.candEdits = {};
    this.candObjectsOn = true;
    this.hintApplied = false;
    this.detectAsk = null;
    this.detectErr = null;
  }

  private async runDetect() {
    const b = this.bundle;
    const versionId = b?.planVersionId;
    if (!versionId || this.detectRun.busy || this.busy || !this.detectOpts.walls) return;
    const token = ++this.detectToken;
    const limitS = this.detectRun.limitS;
    const startedAt = Date.now();
    // busy before the flush: a second press cannot start another run while the first one saves
    this.detectRun = { busy: true, startedAt, elapsed: 0, error: '', timedOut: false, limitS };
    const current = () => token === this.detectToken && this.bundle?.planVersionId === versionId;
    clearInterval(this.elapsedTimer);
    this.elapsedTimer = setInterval(() => {
      const s = Math.floor((Date.now() - startedAt) / 1000);
      if (token === this.detectToken && s !== this.detectRun.elapsed) this.detectRun = { ...this.detectRun, elapsed: s };
    }, 1000);
    try {
      if (!(await this.studio.flush())) {
        if (current()) this.error = this.studio.error;
        return;
      }
      if (!current()) return;
      const targets: DetectTarget[] = this.detectOpts.openings ? ['walls', 'openings'] : ['walls'];
      const r = await detectStructure(versionId, { targets, strength: this.detectOpts.strength });
      if (!current() || r.version_id !== versionId) return; // an older run, or the editor moved to another version meanwhile
      this.showCandidates(r, 'detect');
      this.detectRun = { busy: false, startedAt: 0, elapsed: Math.round((Date.now() - startedAt) / 1000), error: '', timedOut: false, limitS };
    } catch (err) {
      if (!current()) return;
      const timedOut = err instanceof ApiError && err.code === 'detect_timeout';
      const told = err instanceof ApiError ? Number(err.body.details?.timeout_s) : NaN;
      const limit = timedOut && told > 0 ? told : limitS;
      this.detectRun = {
        busy: false, startedAt: 0, elapsed: 0, timedOut, limitS: limit,
        error: timedOut ? `הזיהוי לא הסתיים${limit ? ` תוך ${limit} שניות` : ' בזמן'}. נסה שוב בעוצמת ניקוי נמוכה יותר (תוכנית גדולה או סריקה רועשת לוקחות זמן).` : describeError(err),
      };
    } finally {
      if (token === this.detectToken) {
        clearInterval(this.elapsedTimer);
        if (this.detectRun.busy) this.detectRun = { ...this.detectRun, busy: false };
      }
    }
  }

  /** A click toggles; a rejected wall takes its openings along, an accepted opening brings its wall back. */
  private toggleCandidate(id: string) {
    const set = this.cands?.set;
    if (!set || this.busy) return;
    const next: CandState = (this.candStates[id] ?? 'accepted') === 'accepted' ? 'rejected' : 'accepted';
    const states = { ...this.candStates, [id]: next };
    if (next === 'rejected') {
      for (const o of set.openings) if (o.wall_id === id) states[o.id] = 'rejected';
    } else {
      const o = set.openings.find((x) => x.id === id);
      if (o) states[o.wall_id] = 'accepted';
    }
    this.candStates = states;
    this.candSel = id;
    this.detectAsk = null;
  }

  private acceptRule(ids: string[]) {
    const set = this.cands?.set;
    if (!set || this.busy) return;
    const keep = new Set(withParents(set, ids));
    this.candStates = Object.fromEntries(allIds(set).map((id) => [id, keep.has(id) ? ('accepted' as const) : ('rejected' as const)]));
    this.detectAsk = null;
  }

  /** The ids "אשר" sends: accepted walls and openings (an accepted opening always with its wall), then the DXF objects
   * when they are included. Rooms never: they go to the zones layer. */
  private get acceptedCandidateIds(): string[] {
    const set = this.cands?.set;
    if (!set) return [];
    const shapes = withParents(set, allIds(set).filter((id) => (this.candStates[id] ?? 'accepted') === 'accepted'));
    return this.candObjectsOn ? [...shapes, ...set.objects.map((o) => o.id)] : shapes;
  }

  private focusCandidate(id: string) {
    const b = this.bundle;
    const set = this.cands?.set;
    if (!b || !set) return;
    this.candSel = id;
    const w = set.walls.find((x) => x.id === id);
    const o = set.openings.find((x) => x.id === id);
    const host = o ? set.walls.find((x) => x.id === o.wall_id) : undefined;
    const at: Pt | null = w ? pointOnWall(w, 0.5, b.width, b.height) : host && o ? pointOnWall(host, o.t, b.width, b.height) : null;
    if (at) this.canvas?.centerOn(Math.min(1, Math.max(0, at[0])), Math.min(1, Math.max(0, at[1])));
  }

  private onCandidateDrag(d: { id: string; index: number; x: number; y: number }) {
    const c = this.cands;
    if (!c || this.narrow || this.busy) return;
    const set = moveCandidateVertex(c.set, d.id, d.index, [d.x, d.y]);
    if (set === c.set) return;
    const w = set.walls.find((x) => x.id === d.id);
    if (!w) return;
    this.cands = { ...c, set };
    this.candEdits = { ...this.candEdits, [d.id]: { polyline: w.polyline } };
    this.candSel = d.id;
  }

  private discardCandidates() {
    this.cands = null;
    this.candStates = {};
    this.candSel = null;
    this.candEdits = {};
    this.candObjectsOn = true;
    this.hintApplied = false;
    this.detectAsk = null;
    this.detectErr = null;
  }

  /** Every source the set carries ("auto" for a detection, "imported" for DXF). */
  private setSources(set: CandidateSet): Set<string> {
    return new Set([...set.walls, ...set.openings, ...set.objects].map((i) => i.source));
  }

  /** The sources the accepted candidates carry: the server's replace_auto removes the draft's unlocked items of exactly these. */
  private acceptedSources(): Set<string> {
    const c = this.cands;
    const ids = new Set(this.acceptedCandidateIds);
    const out = new Set<string>();
    if (!c) return out;
    for (const i of [...c.set.walls, ...c.set.openings, ...c.set.objects]) if (ids.has(i.id)) out.add(i.source);
    return out;
  }

  /** What a replace removes from the live draft, by merge_candidates' rule: items of `sources` that are not locked (walls,
   * objects; an opening of those sources unless its wall stays), and the openings of another source on a removed wall. */
  private replacedIn(doc: GeometryDoc, sources: Set<string>): { walls: number; openings: number; objects: number; manual: number } {
    const replaced = (i: { source: string; locked?: boolean }) => sources.has(i.source) && i.locked !== true;
    const gone = new Set(doc.walls.filter(replaced).map((w) => w.id));
    const kept = new Set(doc.walls.filter((w) => !replaced(w)).map((w) => w.id));
    let openings = 0;
    let manual = 0;
    for (const o of doc.openings) {
      if (replaced(o) && !kept.has(o.wall_id)) openings += 1;
      else if (gone.has(o.wall_id)) manual += 1;
    }
    return { walls: gone.size, openings, objects: doc.objects.filter(replaced).length, manual };
  }

  /** The replace in force for an accept now: the option is on and the live draft has something it removes. */
  private replacePlan(doc: GeometryDoc): { walls: number; openings: number; objects: number; manual: number } | null {
    if (!this.detectOpts.replaceAuto) return null;
    const r = this.replacedIn(doc, this.acceptedSources());
    return r.walls + r.openings + r.objects > 0 ? r : null;
  }

  /** "אשר": when the accept replaces earlier automatic items, one more step names what goes; otherwise it is sent. */
  private confirmCandidates() {
    const c = this.cands;
    const doc = this.studio.doc;
    if (!c || !doc || !this.acceptedCandidateIds.length || this.busy) return;
    const plan = this.replacePlan(doc);
    if (plan) {
      this.detectAsk = { existing: { walls: plan.walls, openings: plan.openings, objects: plan.objects }, manualOnAuto: plan.manual };
      return;
    }
    void this.sendAccept();
  }

  private async sendAccept() {
    const b = this.bundle;
    const c = this.cands;
    const ids = this.acceptedCandidateIds;
    const versionId = b?.planVersionId;
    if (!b || !versionId || !c || !ids.length || this.busy) return;
    const moved = () => this.bundle?.planVersionId !== versionId;
    this.busy = true;
    this.error = '';
    this.detectErr = null;
    try {
      if (!(await this.studio.flush())) {
        if (!moved()) this.error = this.studio.error;
        return;
      }
      if (moved() || !this.studio.doc) return;
      const replace = this.replacePlan(this.studio.doc) !== null; // decided on the draft as saved just now
      const kept = new Set(ids);
      const edits = Object.fromEntries(Object.entries(this.candEdits).filter(([id]) => kept.has(id)));
      const r = await acceptDetection(versionId, {
        accepted: ids, edits, replace_auto: replace,
        candidates: { walls: c.set.walls, openings: c.set.openings, objects: c.set.objects },
        base_revision: this.studio.revision, detector: c.result.detector,
      });
      if (moved()) return;
      // like a save's answer (revision, hash, document, issues - and one undo step); when a local edit or another
      // version is in the way the stored draft is loaded instead
      if (!this.studio.adopt(r)) await this.loadStudio(b, true);
      if (moved()) return;
      const m = r.merge;
      this.discardCandidates();
      this.geomSel = null;
      this.info = `${countLabel(ids.length, 'פריט אחד נוסף', 'פריטים נוספו')} לטיוטת המבנה${m?.removed_auto ? ` · ${m.removed_auto} קודמים הוחלפו` : ''}${m?.removed_manual_openings ? ` · ${countLabel(m.removed_manual_openings, 'פתח ידני אחד הוסר', 'פתחים ידניים הוסרו')} עם הקירות שלהם` : ''}; בדוק ופרסם`;
      setTimeout(() => (this.info = ''), 6000);
    } catch (err) {
      if (moved()) return;
      const e = this.acceptErrorOf(err);
      this.detectErr = e;
      if (e.ids.length) this.focusCandidate(e.ids[0]);
    } finally {
      this.busy = false;
      this.detectAsk = null;
    }
  }

  /** A refused accept in Hebrew, with the candidate ids to mark (the codes of routers/plan_geometry.py detect/accept). */
  private acceptErrorOf(err: unknown): DetectAcceptError {
    const set = this.cands?.set;
    const known = new Set(set ? [...allIds(set), ...set.objects.map((o) => o.id)] : []);
    if (!(err instanceof ApiError)) return { code: 'network', message: describeError(err), ids: [], issues: [], stale: false };
    const details = err.body.details ?? {};
    const rawIds = Array.isArray(details.ids) ? details.ids.filter((x): x is string => typeof x === 'string') : [];
    const rawIssues = Array.isArray(details.issues) ? (details.issues as unknown[]) : [];
    const issues = rawIssues
      .filter((i): i is { id?: unknown; message?: unknown } => typeof i === 'object' && i !== null)
      .map((i) => ({ id: typeof i.id === 'string' ? i.id : null, message: typeof i.message === 'string' ? i.message : 'בעיה במבנה' }));
    const ids = [...new Set([...rawIds, ...issues.map((i) => i.id).filter((x): x is string => !!x)])].filter((id) => known.has(id));
    const copy: Record<string, string> = {
      stale_revision: 'טיוטת המבנה השתנתה בינתיים (עריכה בחלון אחר). טען את הטיוטה מחדש ואשר שוב; המועמדים נשארים.',
      unknown_candidate: 'מועמד שסומן לאישור לא נמצא בין המועמדים שנשלחו; הרץ זיהוי מחדש.',
      orphan_opening: 'פתח סומן לאישור בלי הקיר שלו: קבל גם את הקיר או דחה את הפתח.',
      candidate_source: 'מועמד בלי מקור אוטומטי או מיובא נשלח לאישור; הרץ זיהוי מחדש.',
      duplicate_candidate: 'אותו מועמד נשלח פעמיים; הרץ זיהוי מחדש.',
      candidate_shape: 'צורת מועמד שגויה (למשל פתח בלי מזהה קיר); דחה את המסומנים ברשימה ונסה שוב.',
      geometry_structure: 'המועמדים שנבחרו יוצרים מבנה לא תקין, ודבר לא נשמר. דחה או תקן את המסומנים ונסה שוב.',
    };
    return { code: err.code, message: copy[err.code] ?? describeError(err), ids, issues, stale: err.code === 'stale_revision' };
  }

  /** After a stale refusal: the stored draft replaces the local one (nothing unsaved is dropped: loadStudio flushes first). */
  private async reloadForDetect() {
    const b = this.bundle;
    if (!b || this.busy) return;
    this.busy = true;
    try {
      if (await this.loadStudio(b, true)) this.detectErr = null;
    } finally {
      this.busy = false;
    }
  }

  /** The door-width estimate is offered only while the document's calibration is not measured. */
  private get canEstimate(): boolean {
    return this.studio.doc?.dimensions.calibration?.status !== 'measured';
  }

  /** The candidates' metres follow the document's effective scale (after a calibration change or a reload). */
  private rescaleCandidates() {
    const doc = this.studio.doc;
    const c = this.cands;
    if (doc && c && c.source === 'detect') this.cands = { ...c, set: rescale(c.set, effectiveScale(doc).scale) };
  }

  private async applyCalibHint() {
    const b = this.bundle;
    const c = this.cands;
    const hint = c?.result.calibration_hint;
    const versionId = b?.planVersionId;
    if (!b || !versionId || !c || !hint || this.busy) return;
    const moved = () => this.bundle?.planVersionId !== versionId;
    this.busy = true;
    this.error = '';
    try {
      // The server rewrites the stored draft: an edit that is not saved yet would be lost or refused as stale.
      if (!(await this.studio.flush())) {
        if (!moved()) this.error = this.studio.error;
        return;
      }
      if (moved()) return;
      if (!this.canEstimate) {
        this.error = 'לתוכנית כבר יש כיול מדוד; ההערכה לא הוחלה.';
        return;
      }
      const r = await calibrateEstimate(versionId, hint.scale_m_per_px, hint.reason);
      if (moved() || !this.bundle) return;
      this.bundle = { ...this.bundle, scaleMPerPx: r.scale_m_per_px }; // the bundle as it is now, not the one the press saw
      if (!(await this.loadStudio(this.bundle, true)) || moved()) return;
      this.rescaleCandidates();
      this.hintApplied = true;
      this.info = `קנה מידה משוער נשמר: ≈ ${fmtScale(r.scale_m_per_px)}`;
      setTimeout(() => (this.info = ''), 4000);
    } catch (err) {
      if (moved() || !this.bundle) return;
      if (err instanceof ApiError && err.code === 'calibration_measured') {
        this.error = 'לתוכנית כבר יש כיול מדוד (כנראה מחלון אחר); הערכה לא מחליפה אותו. המידות לפי הכיול הקיים.';
        if ((await this.loadStudio(this.bundle, true)) && !moved()) this.rescaleCandidates(); // the measured calibration arrives and the hint goes away
      } else this.error = describeError(err);
    } finally {
      this.busy = false;
    }
  }

  private async importDxfRooms() {
    const b = this.bundle;
    const rooms = this.cands?.result.rooms ?? [];
    if (!b || !rooms.length || this.busy) return;
    this.busy = true;
    try {
      const r = await acceptZones(b.floorId, rooms.map((x) => ({ polygon: x.polygon, name: x.name })), false);
      this.zones = r.zones;
      this.cands = this.cands ? { ...this.cands, result: { ...this.cands.result, rooms: [] } } : null;
      this.info = `${countLabel(rooms.length, 'חדר אחד נוסף', 'חדרים נוספו')} כאזורים; תן להם שמות בכלי "חדרים ואזורים"`;
      setTimeout(() => (this.info = ''), 4000);
    } catch (err) {
      this.error = describeError(err);
    } finally {
      this.busy = false;
    }
  }

  private renderDetectTool(b: MapBundle) {
    const doc = this.studio.doc;
    if (!doc || !b.planVersionId) {
      return html`<sw-card heading="זיהוי אוטומטי" data-detect-panel><div class="note">${b.source === 'demo' ? 'נתוני הדגמה: הזיהוי עובד מול השרת.' : this.error || 'טוען את טיוטת המבנה…'}</div></sw-card>`;
    }
    const { scale, estimated } = effectiveScale(doc);
    const c = this.cands;
    return renderDetectPanel(
      {
        opts: this.detectOpts, run: this.detectRun,
        cands: c ? { source: c.source, set: c.set, states: this.candStates, sel: this.candSel, hint: c.result.calibration_hint, existingAuto: this.replacedIn(doc, this.setSources(c.set)), elapsedMs: c.result.elapsed_ms ?? null, rooms: c.result.rooms?.length ?? 0 } : null,
        acceptedCount: this.acceptedCandidateIds.length, objectsOn: this.candObjectsOn, hintApplied: this.hintApplied, canEstimate: this.canEstimate, busy: this.busy, narrow: this.narrow,
        estimated, showEstimates: this.showEstimates, scale,
        autoInDraft: doc.walls.filter((w) => w.source === 'auto').length + doc.openings.filter((o) => o.source === 'auto').length,
        ask: this.detectAsk, acceptError: this.detectErr,
      },
      {
        setOpts: (o) => {
          this.detectOpts = o;
          this.detectAsk = null;
        },
        run: () => void this.runDetect(),
        retryLighter: () => {
          this.detectOpts = { ...this.detectOpts, strength: lighterStrength(this.detectOpts.strength) };
          void this.runDetect();
        },
        acceptAll: () => { if (c) this.acceptRule(allIds(c.set)); },
        acceptAbove: (min) => { if (c) this.acceptRule(byConfidence(c.set, min)); },
        acceptKinds: (kinds: CandKind[]) => { if (c) this.acceptRule(byKind(c.set, kinds)); },
        rejectAll: () => {
          this.acceptRule([]);
          if (!this.busy) this.candObjectsOn = false;
        },
        toggle: (id) => this.toggleCandidate(id),
        focus: (id) => this.focusCandidate(id),
        setObjects: (on) => {
          this.candObjectsOn = on;
          this.detectAsk = null;
        },
        confirm: () => this.confirmCandidates(),
        confirmReplace: () => void this.sendAccept(),
        cancelReplace: () => (this.detectAsk = null),
        reload: () => void this.reloadForDetect(),
        discard: () => this.discardCandidates(),
        applyHint: () => void this.applyCalibHint(),
        importRooms: () => void this.importDxfRooms(),
      },
    );
  }

  private exportJson() {
    const doc = this.studio.doc;
    if (!doc) return;
    const url = URL.createObjectURL(new Blob([JSON.stringify(doc, null, 2)], { type: 'application/json' }));
    const a = document.createElement('a');
    a.href = url;
    a.download = `plan-structure-${doc.plan_version_id}.json`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  private renderStructurePanel(b: MapBundle, compact = false) {
    const doc = this.studio.doc;
    const versionId = b.planVersionId;
    if (!doc || !versionId) {
      return html`<sw-card heading="מבנה"><div class="note">${b.source === 'demo' ? 'נתוני הדגמה: ציור המבנה עובד מול השרת.' : this.error || 'טוען את טיוטת המבנה…'}</div></sw-card>`;
    }
    return renderStudioPanel(
      {
        // during a drag the panel shows where the item is going (the opening's distance field follows the pointer)
        doc: this.geomPreview ?? doc, W: b.width, H: b.height, mode: compact ? 'select' : this.studioMode, wallDefaults: this.wallDefaults, sel: this.geomSel, saveState: this.studio.saveState, saveError: this.studio.error,
        compact,
        conflict: this.studio.hasConflict,
        issues: this.studio.issues, copyCandidates: this.studio.copyCandidates, exportSvg: exportUrl(versionId, 'svg', { draft: true }), exportPng: exportUrl(versionId, 'png', { draft: true }), busy: this.busy,
        showEstimates: this.showEstimates,
        levels: doc.levels,
      },
      {
        setMode: (m) => {
          if (m === 'wall' && this.phone.matches) {
            this.info = 'ציור קירות זמין בדסקטופ בלבד; בטלפון אפשר להציב ולהזיז עצמים בודדים';
            setTimeout(() => (this.info = ''), 4000);
            return;
          }
          this.studioMode = m;
          this.wallDraft = null;
          this.hover = null;
          // corner handles live in select mode only: elsewhere the wall itself stays selected
          if (m !== 'select' && this.geomSel?.vertex !== undefined) this.geomSel = { id: this.geomSel.id, kind: this.geomSel.kind };
        },
        setWallDefaults: (d) => {
          this.wallDefaults = d;
        },
        patchWall: (id, patch) => this.edit((d) => patchWall(d, id, patch)),
        patchOpening: (id, patch) => this.edit((d) => patchOpening(d, id, patch)),
        patchLabel: (id, patch) => this.edit((d) => patchLabel(d, id, patch)),
        remove: (id) => {
          this.edit((d) => removeItem(d, id));
          this.geomSel = null;
        },
        focus: (id) => this.focusGeom(id),
        copyFrom: (id) => void this.copyStructure(id),
        exportJson: () => this.exportJson(),
        reload: () => void this.loadStudio(b, true),
        calibrate: () => this.pickTool('calibrate'),
        retry: async () => {
          if (await this.studio.flush()) void this.loadStudio(b); // a version switch held back by the failed save goes ahead
        },
        setLevel: (id, lv) => {
          this.edit((d) => (d.walls.some((w) => w.id === id) ? patchWall(d, id, { level_id: lv }) : patchLabel(d, id, { level_id: lv })));
          this.followLevel(id, lv);
        },
      },
    );
  }

  private renderLibraryTool(b: MapBundle, inspectorOnly = false) {
    const doc = this.studio.doc;
    const lib = this.library;
    if (!doc || !lib || !b.planVersionId) {
      return html`<sw-card heading="ספריית עצמים"><div class="note">${b.source === 'demo' ? 'נתוני הדגמה: הספרייה נטענת מהשרת.' : this.error || 'טוען את הספרייה…'}</div></sw-card>`;
    }
    const { estimated } = effectiveScale(doc);
    const canManage = b.permissions.structure; // catalog.manage rides with the editor roles (editor, site_admin, system_admin); the server refuses otherwise
    const sel = this.geomSel?.kind === 'object' ? doc.objects.find((o) => o.id === this.geomSel!.id) : undefined;
    const anchorOf = (o: { anchor_ref: { resource_type: string; resource_id: string } | null }) => {
      const a = o.anchor_ref && this.anchors.find((x) => x.resource_type === o.anchor_ref!.resource_type && x.resource_id === o.anchor_ref!.resource_id);
      return a ? this.anchorName(a) : null;
    };
    const group = this.geomSel?.kind === 'group' ? doc.groups.find((g) => g.id === this.geomSel!.id) : undefined;
    return html`${group ? renderGroupInspector(group, itemOf(lib, String((group.params as { item_id?: string }).item_id ?? '')), { select: (oid) => (this.geomSel = { id: oid, kind: 'object' }), askDelete: (gid) => (this.groupDelete = gid) }) : nothing}${sel
      ? renderObjectInspector(
          { o: sel, item: itemOf(lib, sel.item_id), levels: doc.levels, doc, estimated, showEstimates: this.showEstimates, anchorName: anchorOf(sel), phone: this.phone.matches, canManage,
            lib_category: (item) => lib.categories.find((c) => c.id === item.category)?.he ?? item.category },
          {
            patch: (id, patch) => {
              this.edit((d) => patchObject(d, id, patch));
              if (patch.level_id !== undefined) this.followLevel(id, patch.level_id);
            },
            unbind: (id) => this.edit((d) => patchObject(d, id, { anchor_ref: null })),
            remove: (id) => {
              this.edit((d) => removeItem(d, id));
              this.geomSel = null;
            },
            array: (id) => this.openArray(id),
            custom: (id) => this.openCustom(id),
            selectGroup: (gid) => (this.geomSel = { id: gid, kind: 'group' }),
          },
        )
      : nothing}
    ${inspectorOnly ? html`<div class="note" data-studio-save=${this.studio.saveState}>${SAVE_LABEL[this.studio.saveState]}</div>` : renderLibraryPanel(
      { lib, q: this.libQ, category: this.libCategory, recent: this.libRecent, favorites: this.libFav, placing: this.placingItem, saveState: this.studio.saveState, phone: this.phone.matches,
        exportHref: catalogExportUrl(), canManage },
      {
        setQuery: (q) => (this.libQ = q),
        setCategory: (id) => (this.libCategory = id),
        pick: (item) => {
          this.placingItem = this.placingItem?.id === item.id ? null : item;
          this.geomSel = null;
          this.bindOffer = null;
        },
        toggleFavorite: (id) => {
          this.libFav = this.libFav.includes(id) ? this.libFav.filter((x) => x !== id) : [...this.libFav, id];
          writeList('sw.studio.fav', this.libFav);
        },
        importFile: (f) => void this.importLibrary(f),
        cancelPlacing: () => (this.placingItem = null),
      },
    )}`;
  }

  /** Calibration and measuring segments with their lengths, drawn by the canvas. */
  private get rulers(): RulerOverlay[] {
    const bundle = this.bundle;
    const doc = this.studio.doc;
    if (!bundle || !doc) return [];
    const { scale, estimated } = effectiveScale(doc);
    const len = (a: Pt, c: Pt) => fmtMetres(distanceM(a, c, bundle.width, bundle.height, scale), estimated, this.showEstimates);
    if (this.tool === 'connectors' && this.connStart && this.hover) return [{ a: this.connStart, b: this.hover, label: this.connMode ? CONNECTOR_LABEL[this.connMode] : '', tone: 'muted' }];
    if (this.tool === 'calibrate') {
      const { a, b: end, metres } = this.calib;
      const tip = end ?? this.hover;
      if (!a || !tip) return [];
      return [{ a, b: tip, label: end ? (parseFloat(metres) > 0 ? `${metres} מ׳` : '? מ׳') : '', tone: end ? 'accent' : 'muted' }];
    }
    if (this.tool === 'measure') {
      const fixed = this.measurePts;
      const pts = this.hover && fixed.length ? [...fixed, this.hover] : fixed;
      const out: RulerOverlay[] = [];
      for (let i = 1; i < pts.length; i++) out.push({ a: pts[i - 1], b: pts[i], label: len(pts[i - 1], pts[i]), tone: i > fixed.length - 1 ? 'muted' : 'accent' });
      if (fixed.length >= 3) out.push({ a: fixed[fixed.length - 1], b: fixed[0], label: '', tone: 'muted' });
      return out;
    }
    return [];
  }

  private async saveCalibration() {
    const bundle = this.bundle;
    const { a, b: end, metres } = this.calib;
    const m = parseFloat(metres);
    if (!bundle?.planVersionId || !a || !end || !(m > 0)) return;
    this.busy = true;
    this.error = '';
    try {
      // The server rewrites the stored draft: an edit that is not saved yet would be lost or refused as stale.
      if (!(await this.studio.flush())) {
        this.error = this.studio.error;
        return;
      }
      const r = await calibrate(bundle.planVersionId, [{ a, b: end, metres: m }]);
      await this.loadStudio(bundle, true); // the server rewrote the draft's dimensions
      this.calib = { ...EMPTY_CALIB, result: `קנה המידה נשמר: ${fmtScale(r.scale_m_per_px)}`, warning: r.warning ?? '' };
    } catch (err) {
      this.error = describeError(err);
    } finally {
      this.busy = false;
    }
  }

  private renderCalibrate(bundle: MapBundle) {
    const doc = this.studio.doc;
    if (!doc) return html`<sw-card heading="כיול קנה מידה"><div class="note">${bundle.source === 'demo' ? 'נתוני הדגמה: הכיול עובד מול השרת.' : 'טוען…'}</div></sw-card>`;
    const { scale, estimated } = effectiveScale(doc);
    const c = this.calib;
    const pixels = c.a && c.b ? Math.hypot((c.b[0] - c.a[0]) * bundle.width, (c.b[1] - c.a[1]) * bundle.height) : null;
    return renderCalibPanel(
      { a: c.a, b: c.b, metres: c.metres, pixels, scale, estimated, showEstimates: this.showEstimates, result: c.result, warning: c.warning, busy: this.busy },
      (value) => {
        this.calib = { ...this.calib, metres: value };
      },
      () => void this.saveCalibration(),
      () => {
        this.calib = { ...EMPTY_CALIB };
      },
    );
  }

  private renderMeasure(bundle: MapBundle) {
    const doc = this.studio.doc;
    if (!doc) return html`<sw-card heading="מדידה"><div class="note">${bundle.source === 'demo' ? 'נתוני הדגמה: המדידה עובדת מול השרת.' : 'טוען…'}</div></sw-card>`;
    const { scale, estimated } = effectiveScale(doc);
    return renderMeasurePanel(this.measurePts, bundle.width, bundle.height, scale, estimated, this.showEstimates, () => {
      this.measurePts = [];
    });
  }

  // ---- panels ----

  /** R2: the coverage area - a cone radius (fraction of the plan width, dragged from the range handle or typed) or a
   * free polygon for special cameras (fisheye, panoramic): vertices dragged, added on midpoints, removed with a double click. */
  private renderCoverage(a: Anchor) {
    const poly = a.coverage_polygon;
    const radius = a.coverage_radius ?? 0;
    const pct = Math.round((radius || 0.1) * 100);
    const toPolygon = () => {
      // start from the cone as it is drawn: the pin plus the arc, sampled every ~15°
      const fov = a.field_of_view_degrees ?? 90;
      const r = radius || 0.1;
      const ar = this.bundle && this.bundle.height ? this.bundle.width / this.bundle.height : 1;
      const pts: [number, number][] = [[a.position.x, a.position.y]];
      const steps = Math.max(3, Math.round(fov / 15));
      for (let i = 0; i <= steps; i++) {
        const b = ((a.rotation_degrees - fov / 2 + (fov * i) / steps - 90) * Math.PI) / 180;
        pts.push([+Math.max(0, Math.min(1, a.position.x + Math.cos(b) * r)).toFixed(4), +Math.max(0, Math.min(1, a.position.y + Math.sin(b) * r * ar)).toFixed(4)]);
      }
      this.apply(a.id, { coverage_polygon: pts });
    };
    // owner round 4 (1.8): "רוחב" and "מרחק" looked coupled because coverage_radius had THREE separate
    // controls (a "מרחק" slider here, plus a duplicate "טווח" slider + number field below it) - dragging
    // one visually moved the other, since both were just bound to the same value. Now there is exactly one
    // slider per concept, and the precise number entry lives on the distance row instead of duplicating it.
    return html`<div class="row" data-coverage style="flex-direction:column;align-items:stretch;gap:6px">
      <span class="lbl">שטח כיסוי${poly ? ' · מצולע ידני' : ''}<span class="muted">${poly ? `${poly.length} נקודות · גרירה מזיזה, לחיצה על נקודת אמצע מוסיפה, לחיצה כפולה מסירה` : 'שני מחוונים נפרדים לגמרי זה מזה: רוחב (כמה ימינה ושמאלה, שווה לשני הצדדים) ומרחק (עד איפה המצלמה רואה). אפשר גם לגרור את הידיות על המפה.'}</span></span>
      ${poly ? nothing : html`<label class="note" style="display:flex;gap:8px;align-items:center" data-coverage-width>רוחב
          <input type="range" min="10" max="180" step="1" style="flex:1" .value=${String(Math.round(a.field_of_view_degrees ?? 90))} aria-label="רוחב שדה הראייה" @input=${(e: Event) => this.apply(a.id, { field_of_view_degrees: Number((e.target as HTMLInputElement).value) })} />
          <span class="ltr" style="min-inline-size:64px">${Math.round((a.field_of_view_degrees ?? 90) / 2)}° לכל צד</span></label>
        <label class="note" style="display:flex;gap:8px;align-items:center" data-coverage-distance>מרחק
          <input type="range" min="2" max="100" step="1" style="flex:1" .value=${String(pct)} aria-label="מרחק ראייה" @input=${(e: Event) => this.apply(a.id, { coverage_radius: Number((e.target as HTMLInputElement).value) / 100 })} />
          <input type="number" step="1" min="2" max="100" data-ltr data-coverage-radius style="inline-size:56px" .value=${String(pct)} aria-label="מרחק ראייה, אחוז מדויק" @change=${(e: Event) => this.apply(a.id, { coverage_radius: Math.min(1, Math.max(0.02, Number((e.target as HTMLInputElement).value) / 100)) })} />
          <span class="ltr" style="min-inline-size:24px">%</span></label>`}
      <div style="display:flex;gap:8px;align-items:center;flex-wrap:wrap">
        ${poly
          ? html`<sw-button size="sm" icon="undo" data-coverage-cone @click=${() => this.apply(a.id, { coverage_polygon: null })}>חזרה לקשת</sw-button>`
          : html`${radius ? html`<sw-button size="sm" variant="ghost" @click=${() => this.apply(a.id, { coverage_radius: null })}>מרחק לברירת מחדל</sw-button>` : nothing}
            <sw-button size="sm" icon="edit" data-coverage-polygon @click=${toPolygon}>כיסוי ידני (מצולע)</sw-button>`}
      </div>
    </div>`;
  }

  /** T087: the height above the floor (and, for a camera, the tilt) the 3D view places the item at; empty = the kind's
   * default, shown as the placeholder. A typed 0 is a value; an emptied field clears back to the default. */
  private renderMount(a: Anchor, withTilt: boolean) {
    const d = ANCHOR_3D_DEFAULTS[anchor3dKind(a)];
    const num = (raw: string, min: number, max: number): number | null => {
      if (raw.trim() === '') return null;
      const v = Number(raw);
      return Number.isFinite(v) ? Math.min(max, Math.max(min, v)) : null;
    };
    return html`<div class="two" data-anchor-3d>
      <sw-field label="גובה התקנה (מ׳)" hint=${`ברירת מחדל ${d.mount_height_m} מ׳ · לתצוגת התלת-ממד`}><input type="number" step="0.1" min="0" max="30" data-ltr data-anchor-mount placeholder=${String(d.mount_height_m)} .value=${live(a.mount_height_m == null ? '' : String(a.mount_height_m))} @change=${(e: Event) => this.apply(a.id, { mount_height_m: num((e.target as HTMLInputElement).value, 0, 30) })} /></sw-field>
      ${withTilt ? html`<sw-field label="הטיה (°)" hint=${`ברירת מחדל ${d.tilt_deg}° · חיובי = מטה`}><input type="number" step="any" min="-90" max="90" data-ltr data-anchor-tilt placeholder=${String(d.tilt_deg)} .value=${live(a.tilt_deg == null ? '' : String(a.tilt_deg))} @change=${(e: Event) => this.apply(a.id, { tilt_deg: num((e.target as HTMLInputElement).value, -90, 90) })} /></sw-field>` : nothing}
    </div>`;
  }

  private renderCameraInspector(a: Anchor) {
    const cam = a.camera;
    const fov = a.field_of_view_degrees ?? 0;
    return html`<sw-card heading="הגדרות מצלמה" subheading="גרירה במפה, ידיות לכיוון ולשדה הראייה, או הזנה מדויקת">
      <div class="kv"><span class="k">מצלמה</span><strong>${this.anchorName(a)}</strong></div>
      <div class="kv"><span class="k">מקור</span><span class="ltr">${cam ? `NVR · ch ${cam.channel}` : a.resource_id}</span></div>
      <sw-field label="כיוון מבט (°)" style="margin-block-start:10px"><input type="number" step="1" min="0" max="359" data-ltr .value=${String(Math.round(a.rotation_degrees))} @change=${(e: Event) => this.apply(a.id, { rotation_degrees: ((Number((e.target as HTMLInputElement).value) % 360) + 360) % 360 })} /></sw-field>
      <div class="two">
        <sw-field label="מיקום X (%)"><input type="number" step="0.1" min="0" max="100" data-ltr .value=${(a.position.x * 100).toFixed(1)} @change=${(e: Event) => this.apply(a.id, { position: { x: Math.min(1, Math.max(0, Number((e.target as HTMLInputElement).value) / 100)), y: a.position.y } })} /></sw-field>
        <sw-field label="מיקום Y (%)"><input type="number" step="0.1" min="0" max="100" data-ltr .value=${(a.position.y * 100).toFixed(1)} @change=${(e: Event) => this.apply(a.id, { position: { x: a.position.x, y: Math.min(1, Math.max(0, Number((e.target as HTMLInputElement).value) / 100)) } })} /></sw-field>
      </div>
      ${(this.studio.doc?.levels.length ?? 0) > 1 ? html`<sw-field label="מפלס"><select data-anchor-level @change=${(ev: Event) => this.apply(a.id, { level_id: (ev.target as HTMLSelectElement).value || null })}>${this.studio.doc!.levels.map((l) => html`<option value=${l.id} ?selected=${(a.level_id ?? defaultLevelId(this.studio.doc!)) === l.id}>${l.name}</option>`)}</select></sw-field>` : nothing}
      <sw-field label="תווית (אופציונלי)"><input .value=${a.label ?? ''} @change=${(e: Event) => this.apply(a.id, { label: (e.target as HTMLInputElement).value || null })} /></sw-field>
      <sw-field label="מיקום התווית"><select data-label-pos @change=${(e: Event) => this.apply(a.id, { label_pos: (e.target as HTMLSelectElement).value })}>${[['auto', 'אוטומטי'], ['top', 'מעל'], ['bottom', 'מתחת'], ['left', 'משמאל'], ['right', 'מימין']].map(([v, l]) => html`<option value=${v} ?selected=${(a.label_pos ?? 'auto') === v}>${l}</option>`)}</select></sw-field>
      ${this.renderMount(a, true)}
      ${fov ? this.renderCoverage(a) : nothing}
      <div class="row"><span class="lbl">הצג כיסוי משוער<span class="muted">זווית לתכנון, לא מדידת כיסוי בפועל</span></span><sw-toggle ?checked=${!!fov} label=${fov ? 'מוצג' : 'מוסתר'} @click=${() => this.apply(a.id, { field_of_view_degrees: fov ? null : 90 })}></sw-toggle></div>
      <div class="row"><span class="lbl">0° = למעלה, עם כיוון השעון<span class="muted">שינוי כיוון במפה אינו פקודת PTZ למצלמה</span></span></div>
      <div class="note" style="margin-block-start:6px">revision ${a.revision}${this.dirty.has(a.id) ? ' · שינויים לא שמורים' : ''} · חצים = הזזה עדינה (Shift = גדולה) · Delete = הסרה</div>
      <div style="display:flex;gap:8px;margin-block-start:10px;flex-wrap:wrap">
        <sw-button variant="primary" size="sm" icon="check" ?disabled=${!this.dirty.size || this.busy} @click=${() => this.save()}>שמירת מיקום</sw-button>
        <sw-button size="sm" variant="danger" icon="trash" ?disabled=${this.busy} @click=${() => this.removeSelected()}>הסר מהמפה</sw-button>
      </div>
    </sw-card>`;
  }

  private renderEntityInspector(a: Anchor) {
    const e = a.entity;
    return html`<sw-card heading="הגדרות ישות" subheading="הצבה בלבד; שליטה דורשת הרשאה נפרדת">
      <div class="kv"><span class="k">ישות</span><strong>${this.anchorName(a)}</strong></div>
      <div class="kv"><span class="k">מזהה</span><span class="ltr">${a.resource_id}</span></div>
      ${e ? html`<div class="kv"><span class="k">מצב עכשיו</span><span>${stateLabel(e)}</span></div><div class="kv"><span class="k">סוג</span><span>${domainLabel(e.domain)}</span></div>` : nothing}
      <sw-field label="שכבה" style="margin-block-start:8px"><select @change=${(ev: Event) => this.apply(a.id, { layer_id: (ev.target as HTMLSelectElement).value })}>${LAYERS.filter((l) => l.id !== 'cameras').map((l) => html`<option value=${l.id} ?selected=${a.layer_id === l.id}>${l.label}</option>`)}</select></sw-field>
      <div class="two">
        <sw-field label="מיקום X (%)"><input type="number" step="0.1" min="0" max="100" data-ltr .value=${(a.position.x * 100).toFixed(1)} @change=${(ev: Event) => this.apply(a.id, { position: { x: Math.min(1, Math.max(0, Number((ev.target as HTMLInputElement).value) / 100)), y: a.position.y } })} /></sw-field>
        <sw-field label="מיקום Y (%)"><input type="number" step="0.1" min="0" max="100" data-ltr .value=${(a.position.y * 100).toFixed(1)} @change=${(ev: Event) => this.apply(a.id, { position: { x: a.position.x, y: Math.min(1, Math.max(0, Number((ev.target as HTMLInputElement).value) / 100)) } })} /></sw-field>
      </div>
      ${(this.studio.doc?.levels.length ?? 0) > 1 ? html`<sw-field label="מפלס"><select data-anchor-level @change=${(ev: Event) => this.apply(a.id, { level_id: (ev.target as HTMLSelectElement).value || null })}>${this.studio.doc!.levels.map((l) => html`<option value=${l.id} ?selected=${(a.level_id ?? defaultLevelId(this.studio.doc!)) === l.id}>${l.name}</option>`)}</select></sw-field>` : nothing}
      <sw-field label="שם במפה (ידני)"><input data-entity-name placeholder=${e?.name ?? a.resource_id} .value=${a.label ?? ''} @change=${(ev: Event) => this.apply(a.id, { label: (ev.target as HTMLInputElement).value.trim() || null })} /></sw-field>
      <sw-field label="מיקום התווית"><select data-label-pos @change=${(ev: Event) => this.apply(a.id, { label_pos: (ev.target as HTMLSelectElement).value })}>${[['auto', 'אוטומטי'], ['top', 'מעל'], ['bottom', 'מתחת'], ['left', 'משמאל'], ['right', 'מימין']].map(([v, l]) => html`<option value=${v} ?selected=${(a.label_pos ?? 'auto') === v}>${l}</option>`)}</select></sw-field>
      ${this.renderMount(a, false)}
      <div class="note">ריק = השם מ־Home Assistant${e?.name ? ` („${e.name}“)` : ''}. השם הידני מוצג במפה, ברשימת הצד ובכרטיס.</div>
      <div class="note" style="margin-block-start:6px">revision ${a.revision}${this.dirty.has(a.id) ? ' · שינויים לא שמורים' : ''}</div>
      <div style="display:flex;gap:8px;margin-block-start:10px;flex-wrap:wrap">
        <sw-button variant="primary" size="sm" icon="check" ?disabled=${!this.dirty.size || this.busy} @click=${() => this.save()}>שמירת מיקום</sw-button>
        <sw-button size="sm" variant="danger" icon="trash" ?disabled=${this.busy} @click=${() => this.removeSelected()}>הסר מהמפה</sw-button>
      </div>
    </sw-card>`;
  }

  private renderToolPanel(b: MapBundle) {
    const anchoredIds = new Set(this.anchors.map((a) => a.resource_id));
    if (this.tool === 'structure') return this.renderStructurePanel(b);
    if (this.tool === 'library') return this.renderLibraryTool(b);
    if (this.tool === 'connectors') return this.renderConnectorTool(b);
    if (this.tool === 'circuits') return this.renderCircuitTool(b);
    if (this.tool === 'calibrate') return this.renderCalibrate(b);
    if (this.tool === 'measure') return this.renderMeasure(b);
    if (this.tool === 'detect') return this.renderDetectTool(b);
    if (this.tool === 'camera') {
      const available = b.cameras.filter((c) => !anchoredIds.has(c.id));
      return html`<sw-card heading="הוספת מצלמה" subheading="בחר מצלמה ואז לחץ על התוכנית במקום המבוקש">
        ${available.length
          ? html`<div class="list">${available.map((c) => html`<button class=${this.placing?.kind === 'camera' && this.placing.camera.id === c.id ? 'on' : ''} @click=${() => (this.placing = { kind: 'camera', camera: c })}><span>${c.name}</span><span class="ltr">ch ${c.channel} · ${c.status}</span></button>`)}</div>`
          : html`<div class="note">${b.cameras.length ? 'כל המצלמות הרשומות כבר מוצבות על הקומה.' : 'אין מצלמות רשומות עדיין; הגילוי מה־NVR רץ אוטומטית.'}</div><div style="margin-block-start:8px"><sw-button size="sm" @click=${() => navigate('/system/devices')}>למצלמות</sw-button></div>`}
      </sw-card>`;
    }
    if (this.tool === 'entity' || this.tool === 'lights') {
      const lights = this.tool === 'lights';
      const results = (this.entResults ?? []).filter((e) => !anchoredIds.has(e.entity_id));
      return html`<sw-card heading=${lights ? 'הוספת תאורה' : 'הוספת ישות Home Assistant אחרת'} subheading=${lights ? 'מפסקים (switch) מהקטלוג; לחץ על התוכנית להצבה. השם ניתן לשינוי אחרי ההצבה.' : 'כל ישות אחרת בקטלוג (דלתות, חיישנים, מזגנים…) ואז לחיצה על התוכנית'} data-tool-panel=${this.tool}>
        <sw-field><input type="search" placeholder=${lights ? 'חיפוש מפסק לפי שם או אזור' : 'חיפוש לפי שם, entity_id או אזור'} data-ltr .value=${this.entQ} @input=${(e: Event) => this.onEntQuery((e.target as HTMLInputElement).value)} /></sw-field>
        ${lights ? html`<label class="note" style="display:flex;gap:6px;align-items:center"><input type="checkbox" data-lights-all .checked=${this.lightsAll} @change=${(e: Event) => { this.lightsAll = (e.target as HTMLInputElement).checked; void this.searchEntities(); }} /> להציג גם ישויות light (נורות חכמות)</label>` : nothing}
        ${b.source === 'demo'
          ? html`<div class="note">נתוני הדגמה: החיפוש עובד מול השרת.</div>`
          : this.entBusy && !this.entResults
            ? html`<div class="note">מחפש…</div>`
            : results.length
              ? html`<div class="list">${results.map((e) => html`<button class=${this.placing?.kind === 'entity' && this.placing.entity.entity_id === e.entity_id ? 'on' : ''} @click=${() => (this.placing = { kind: 'entity', entity: e })}><span>${e.name || e.original_name || e.entity_id}<div class="note" style="margin:0">${domainLabel(e.domain)}${e.area_name ? ` · ${e.area_name}` : ''} · ${stateLabel(e)}</div></span><span class="ltr">${e.entity_id}</span></button>`)}</div>`
              : html`<div class="note">${this.entResults ? 'לא נמצאו ישויות (או שכולן כבר מוצבות).' : ''}</div>`}
      </sw-card>`;
    }
    if (this.tool === 'layers') {
      return html`<sw-card heading="שכבות" subheading="מה מוצג בעורך (לא משפיע על הצופים)">
        <div class="layerlist">${LAYERS.map((l) => html`<label><input type="checkbox" .checked=${this.layers.has(l.id)} @change=${(e: Event) => { const next = new Set(this.layers); if ((e.target as HTMLInputElement).checked) next.add(l.id); else next.delete(l.id); this.layers = next; }} /> ${l.label} <span class="note">(${this.anchors.filter((a) => this.layerOf(a) === l.id).length})</span></label>`)}
          <label><input type="checkbox" .checked=${this.showZones} @change=${(e: Event) => (this.showZones = (e.target as HTMLInputElement).checked)} /> חדרים ואזורים <span class="note">(${this.zones.length})</span></label></div>
      </sw-card>`;
    }
    if (this.tool === 'zones') return this.renderZonesPanel(b);
    if (this.tool === 'select' && this.geomSel && this.studio.doc) return this.renderSelectionPanel(b);
    return html`<sw-card heading="מאפיינים"><div class="note" data-select-hint>${b.permissions.structure && this.studio.doc
      ? 'לחץ על סיכה, קיר, פתח, תווית, עצם או אזור במפה כדי לבחור ולערוך אותם, או הוסף מצלמה / ישות מסרגל הכלים. גרירה מזיזה: סיכה, פתח, תווית ועצם מיד, קיר ואזור אחרי שנבחרו. הידיות על המצלמה הנבחרת קובעות כיוון ושדה ראייה. הצבה יוצרת Binding בלבד ואינה משנה תצורת מקור.'
      : 'בחר סיכה במפה כדי לערוך אותה, או הוסף מצלמה / ישות מסרגל הכלים. גרירה מזיזה; הידיות על המצלמה הנבחרת קובעות כיוון ושדה ראייה. הצבה יוצרת Binding בלבד ואינה משנה תצורת מקור.'}</div></sw-card>`;
  }

  /** The select tool with a structure item selected (0.1.87): the item's own inspector, as its studio tool shows it,
   * without that tool's drawing modes, library or lists. */
  private renderSelectionPanel(b: MapBundle) {
    const sel = this.geomSel;
    const doc = this.studio.doc;
    if (!sel || !doc) return nothing;
    if (sel.kind === 'object' || sel.kind === 'group') return this.renderLibraryTool(b, true);
    if (sel.kind === 'connector') {
      const c = doc.connectors.find((x) => x.id === sel.id);
      return c
        ? renderConnectorSelection(
            { doc, mode: null, start: null, sel: c, saveState: this.studio.saveState, floors: this.otherFloors, linkFloor: this.linkFloor, linkBusy: this.linkBusy, phone: this.phone.matches },
            {
              setMode: () => {},
              select: (id) => (this.geomSel = { id, kind: 'connector' }),
              patch: (id, patch) => this.edit((d) => patchConnector(d, id, patch)),
              remove: (id) => {
                this.edit((d) => removeItem(d, id));
                this.geomSel = null;
              },
              setLinkFloor: (f) => (this.linkFloor = f),
              link: (id) => void this.linkTo(id),
            },
          )
        : nothing;
    }
    return this.renderStructurePanel(b, true);
  }

  private renderZoneInspector(z: SpatialZone) {
    const cams = this.anchors.filter((a) => a.resource_type === 'camera' && pointInPolygon(a.position, z.polygon));
    const ents = this.anchors.filter((a) => a.resource_type !== 'camera' && pointInPolygon(a.position, z.polygon));
    return html`<div class="zone-insp" data-zone-inspector>
      <sw-field label="שם"><input .value=${z.name} placeholder="למשל: לובי, מחסן, חדר ישיבות" @change=${(e: Event) => this.patchZone(z, { name: (e.target as HTMLInputElement).value })} /></sw-field>
      <div class="two">
        <sw-field label="סוג"><select @change=${(e: Event) => this.patchZone(z, { kind: (e.target as HTMLSelectElement).value as ZoneKind })}>${ZONE_KINDS.map((k) => html`<option value=${k.id} ?selected=${z.kind === k.id}>${k.label}</option>`)}</select></sw-field>
        <sw-field label="צבע"><input type="color" data-ltr .value=${z.color} @change=${(e: Event) => this.patchZone(z, { color: (e.target as HTMLInputElement).value })} /></sw-field>
      </div>
      <sw-field label="מיקום שם החדר"><select data-zone-label-pos @change=${(e: Event) => this.patchZone(z, { label_pos: (e.target as HTMLSelectElement).value })}>${[['auto', 'אוטומטי'], ['top', 'מעל'], ['bottom', 'מתחת'], ['left', 'משמאל'], ['right', 'מימין']].map(([v, l]) => html`<option value=${v} ?selected=${(z.label_pos ?? 'auto') === v}>${l}</option>`)}</select></sw-field>
      ${(this.studio.doc?.levels.length ?? 0) > 1 ? html`<sw-field label="מפלס"><select data-zone-level @change=${(e: Event) => this.patchZone(z, { level_id: (e.target as HTMLSelectElement).value })}>${this.studio.doc!.levels.map((l) => html`<option value=${l.id} ?selected=${(z.level_id ?? defaultLevelId(this.studio.doc!)) === l.id}>${l.name}</option>`)}</select></sw-field>` : nothing}
      <div class="kv"><span class="k">מצלמות באזור</span><span>${cams.length ? cams.map((a) => this.anchorName(a)).join(', ') : 'אין'}</span></div>
      <div class="kv"><span class="k">ישויות HA באזור</span><span>${ents.length ? `${ents.length} ישויות` : 'אין'}</span></div>
      <div class="row"><span class="lbl">הכללה בחיפוש מרחבי<span class="muted">זמין לחוקי התראה ולחיפוש לפי מקום</span></span><sw-toggle ?checked=${z.searchable} label=${z.searchable ? 'כלול' : 'לא כלול'} @click=${() => this.patchZone(z, { searchable: !z.searchable })}></sw-toggle></div>
      <div class="note">${z.polygon.length} פינות · ${z.source === 'auto' ? 'זוהה אוטומטית מהתוכנית' : 'צויר ידנית'} · revision ${z.revision}</div>
      <div class="note" data-zone-hint>גרור פינה כדי לשנות צורה, גרור נקודת אמצע כדי להוסיף פינה, גרור את הגוף כדי להזיז; Delete על פינה מסיר אותה</div>
      <div class="note">אזור במפה הוא הקשר מרחבי בלבד: אינו אזור זיהוי במצלמה ואינו מסכת פרטיות, ואינו משנה תצורת NVR.</div>
      <div class="btns"><sw-button size="sm" variant="danger" icon="trash" ?disabled=${this.zoneBusy} @click=${() => this.removeZone(z)}>מחק אזור</sw-button><sw-button size="sm" variant="ghost" @click=${() => (this.selectedZoneId = null)}>סגור</sw-button></div>
    </div>`;
  }

  private renderZonesPanel(b: MapBundle) {
    const cands = this.candidates;
    const sel = this.selectedZone;
    return html`<sw-card heading="חדרים ואזורים" subheading="זיהוי מהתוכנית או ציור ידני; השמות מופיעים במפה">
      ${cands
        ? html`<div class="note">${cands.length} חדרים זוהו · סמן, תן שם ושמור. הפוליגונים מוצגים במפה בקו מקווקו.</div>
            <div class="candlist">${cands.map((c, i) => html`<div class="cand" data-candidate><input type="checkbox" .checked=${c.include} aria-label="כלול" @change=${(e: Event) => this.setCandidate(i, { include: (e.target as HTMLInputElement).checked })} /><i class="sw" style="background:${PALETTE[i % PALETTE.length]}"></i><input class="name" .value=${c.name} placeholder="שם החדר" aria-label="שם החדר" @input=${(e: Event) => this.setCandidate(i, { name: (e.target as HTMLInputElement).value })} /><select aria-label="סוג" @change=${(e: Event) => this.setCandidate(i, { kind: (e.target as HTMLSelectElement).value as ZoneKind })}>${ZONE_KINDS.map((k) => html`<option value=${k.id} ?selected=${c.kind === k.id}>${k.label}</option>`)}</select></div>`)}</div>
            ${this.zones.some((z) => z.source === 'auto') ? html`<label class="chk"><input type="checkbox" .checked=${this.replaceAuto} @change=${(e: Event) => (this.replaceAuto = (e.target as HTMLInputElement).checked)} /> החלף את החדרים שזוהו אוטומטית בעבר (${this.zones.filter((z) => z.source === 'auto').length})</label>` : nothing}
            <div class="btns"><sw-button variant="primary" size="sm" icon="check" ?disabled=${this.zoneBusy || !cands.some((c) => c.include)} @click=${() => this.acceptCandidates()}>שמור ${cands.filter((c) => c.include).length} חדרים</sw-button><sw-button variant="ghost" size="sm" @click=${() => (this.candidates = null)}>בטל</sw-button></div>`
        : this.drawing
          ? html`<div class="note">לחץ על התוכנית להוספת פינות (${this.drawing.length} עד כה). לחיצה על הפינה הראשונה או Enter סוגרים את הצורה · Esc לביטול.</div>
            <div class="btns"><sw-button variant="primary" size="sm" icon="check" ?disabled=${this.drawing.length < 3 || this.zoneBusy} @click=${() => this.finishDrawing()}>סיים אזור</sw-button><sw-button variant="ghost" size="sm" @click=${() => (this.drawing = null)}>בטל</sw-button></div>`
          : html`<div class="row"><span class="lbl">זיהוי חדרים מהתוכנית<span class="muted">עיבוד מקומי של הקירות (ללא AI); החדרים מוצעים ואתה נותן להם שמות</span></span><select aria-label="עוצמת זיהוי" @change=${(e: Event) => (this.detectStrength = (e.target as HTMLSelectElement).value as Strength)}><option value="light" ?selected=${this.detectStrength === 'light'}>קל</option><option value="medium" ?selected=${this.detectStrength === 'medium'}>בינוני</option><option value="strong" ?selected=${this.detectStrength === 'strong'}>חזק</option></select></div>
            <div class="btns"><sw-button variant="primary" size="sm" icon="map" ?disabled=${this.detecting || b.source === 'demo' || b.planStatus === 'none'} @click=${() => this.detect()}>${this.detecting ? 'מזהה…' : 'זהה חדרים'}</sw-button><sw-button size="sm" icon="edit" ?disabled=${this.zoneBusy} @click=${() => this.startDrawing()}>צייר אזור</sw-button></div>`}
      ${this.zones.length
        ? html`<div class="note" style="margin-block-start:10px">${this.zones.length} אזורים בקומה · לחיצה בוחרת במפה</div>
            <div class="list">${this.zones.map((z) => html`<button class=${z.id === this.selectedZoneId ? 'on' : ''} data-zone-row @click=${() => { this.selectedZoneId = z.id === this.selectedZoneId ? null : z.id; this.selectedId = null; }}><span><i class="sw" style="background:${z.color}"></i>${z.name}</span><span class="note" style="margin:0">${zoneKindLabel(z.kind)}${z.source === 'auto' ? ' · אוטומטי' : ''}</span></button>`)}</div>`
        : cands || this.drawing ? nothing : html`<div class="note" style="margin-block-start:10px">עדיין אין חדרים או אזורים בקומה.</div>`}
      ${sel ? this.renderZoneInspector(sel) : nothing}
    </sw-card>`;
  }

  private renderVersionCard(b: MapBundle) {
    const st = this.stylized;
    return html`<sw-card heading="גרסת תוכנית" subheading=${b.planStatus === 'draft' ? 'טיוטה: צופים רואים את הגרסה הקודמת' : b.planStatus === 'published' ? 'גרסה מפורסמת' : 'אין תוכנית'}>
      ${b.planStatus === 'none'
        ? nothing
        : html`<div class="row"><span class="lbl">תצוגת המפה<span class="muted">${b.renderMode === 'stylized' ? 'שפת SMPLWISE (עיבוד אוטומטי של המקור)' : 'תוכנית המקור כפי שהועלתה'}</span></span>${b.renderMode === 'stylized' ? html`<sw-button size="sm" ?disabled=${this.busy} @click=${() => this.useRender('source')}>הצג מקור</sw-button>` : b.stylizedAvailable ? html`<sw-button size="sm" ?disabled=${this.busy} @click=${() => this.useRender('stylized')}>הצג שפת SMPLWISE</sw-button>` : nothing}</div>
          <div class="row"><span class="lbl">עיבוד לשפת SMPLWISE<span class="muted">בחר מה להשאיר מהתוכנית; המקור נשמר תמיד</span></span></div>
          <div class="two" data-stylize-opts>
            <sw-field label="עוצמת ניקוי"><select aria-label="עוצמת ניקוי" @change=${(e: Event) => (this.stylizeOpts = { ...this.stylizeOpts, strength: (e.target as HTMLSelectElement).value as Strength })}><option value="light" ?selected=${this.stylizeOpts.strength === 'light'}>קל · קירות דקים נשמרים</option><option value="medium" ?selected=${this.stylizeOpts.strength === 'medium'}>בינוני · קירות כפולים מאוחדים</option><option value="strong" ?selected=${this.stylizeOpts.strength === 'strong'}>חזק · מדרגות וריהוט לגושים</option></select></sw-field>
            <sw-field label="מילוי חדרים"><select aria-label="מילוי חדרים" @change=${(e: Event) => (this.stylizeOpts = { ...this.stylizeOpts, roomFill: (e.target as HTMLSelectElement).value as RoomFill })}>${(Object.keys(ROOM_FILL_LABEL) as RoomFill[]).map((k) => html`<option value=${k} ?selected=${this.stylizeOpts.roomFill === k}>${ROOM_FILL_LABEL[k]}</option>`)}</select></sw-field>
          </div>
          <label class="chk"><input type="checkbox" .checked=${this.stylizeOpts.keepLines} @change=${(e: Event) => (this.stylizeOpts = { ...this.stylizeOpts, keepLines: (e.target as HTMLInputElement).checked })} /> ריהוט, דלתות וקווים דקים מהתוכנית (בגוון עדין)</label>
          <div class="btns"><sw-button variant="primary" size="sm" icon="image" ?disabled=${this.stylizing || b.source === 'demo'} @click=${() => this.stylize()}>${this.stylizing ? 'מעבד…' : 'עבד תצוגה מקדימה'}</sw-button></div>
          ${st
            ? html`<div class="compare" style="margin-block-start:8px"><div><div class="note">מקור</div><img src=${st.source_url} alt="תוכנית מקור" /></div><div><div class="note" data-stylize-caption>שפת SMPLWISE · ${st.rooms} חדרים · ${ROOM_FILL_LABEL[st.room_fill] ?? st.room_fill} · ${st.keep_lines ? 'עם קווים דקים' : 'ללא קווים דקים'}</div><img src=${st.stylized_url} alt="שפת SMPLWISE" /></div></div>
              <div style="display:flex;gap:8px;margin-block-start:8px"><sw-button variant="primary" size="sm" icon="check" ?disabled=${this.busy} @click=${() => this.useRender('stylized')}>השתמש בתוצאה</sw-button><sw-button variant="ghost" size="sm" @click=${() => (this.stylized = null)}>סגור</sw-button></div>
              <div class="note" style="margin-block-start:6px">עיבוד תמונה מקומי (ללא AI וללא שליחה החוצה): קירות וחדרים מזוהים לפי עובי הקווים; חדרים אינם מזוהים בשמם. אפשר לחזור למקור בכל רגע.</div>`
            : nothing}`}
      ${this.renderVersionHistory(b)}
      <div style="margin-block-start:8px"><sw-button size="sm" icon="upload" @click=${() => navigate(`/explore/floors/${b.floorId}/import`)}>ייבוא תוכנית חדשה</sw-button></div>
    </sw-card>`;
  }

  private renderVersionHistory(b: MapBundle) {
    if (!this.versions.length) return nothing;
    return html`<div class="row" style="margin-block-start:10px"><span class="lbl">היסטוריית גרסאות<span class="muted">כל פרסום נשמר; אפשר להשוות ולשחזר גרסה מהארכיון בלי לאבד עוגנים</span></span></div>
      <div class="vlist" data-version-list>
        ${this.versions.map((v) => {
          const cur = v.id === b.planVersionId;
          const kind = v.status === 'published' ? 'recorded' : v.status === 'draft' ? 'partial' : 'neutral';
          const label = v.status === 'published' ? 'מפורסמת' : v.status === 'draft' ? 'טיוטה' : 'ארכיון';
          return html`<div class="vrow ${cur ? 'cur' : ''}" data-version-row data-version-id=${v.id} data-version-status=${v.status}>
            <img src=${resourceUrl(v.image_url)} alt="" loading="lazy" />
            <div class="meta">
              <span><sw-badge kind=${kind} label=${label}></sw-badge> <span class="ltr">${fmtWhen(v.published_at ?? v.created_at)}</span></span>
              <span class="note">${v.width_px}×${v.height_px}${v.rotation ? ` · סיבוב ${v.rotation}°` : ''}${v.crop ? ' · חיתוך' : ''} · ${v.anchors_on ?? 0} פריטים${v.notes ? ` · ${v.notes}` : ''}</span>
            </div>
            <div class="acts">
              ${v.status !== 'published' ? html`<sw-button size="sm" variant="ghost" data-version-compare ?disabled=${this.busy} @click=${() => this.openDiff(v.status === 'draft' && b.permissions.publish ? 'publish' : 'compare', v)}>השווה</sw-button>` : nothing}
              ${v.status === 'archived' && b.permissions.publish ? html`<sw-button size="sm" icon="history" data-version-rollback ?disabled=${this.busy} @click=${() => this.openDiff('rollback', v)}>שחזר</sw-button>` : nothing}
            </div>
          </div>`;
        })}
      </div>`;
  }

  private renderDiffDialog() {
    const d = this.diff;
    if (!d) return nothing;
    const data = d.data;
    // The structure note: only for the editor's own draft (the studio holds no other version's structure), and whenever
    // the draft holds anything the server publishes (the collections its is_empty counts, as studio.pendingPublish).
    const doc = d.mode === 'publish' && d.version.id === this.bundle?.planVersionId ? this.studio.doc : null;
    const structure = doc && (doc.walls.length || doc.openings.length || doc.labels.length || doc.objects.length || doc.connectors.length) ? doc : null;
    // Every error blocks, with an item id or not: the confirm stays off until the issue list is clear (no 422 round trip).
    const blocked = !!structure && this.studio.issues.some((i) => i.severity === 'error');
    const title = d.mode === 'publish' ? 'פרסום גרסה' : d.mode === 'rollback' ? 'שחזור גרסה מהארכיון' : 'השוואת גרסאות';
    const sub = d.mode === 'publish' ? 'מה ישתנה לצופים ומה יקרה לפריטים המוצבים' : d.mode === 'rollback' ? 'הגרסה תפורסם מחדש כעותק חדש; הגרסה הנוכחית תעבור לארכיון' : 'מול הגרסה המפורסמת';
    return html`<sw-dialog open heading=${title} subheading=${sub} data-diff-dialog @close=${() => (this.diff = null)}>
      ${d.error ? html`<div class="err" data-diff-error>${d.error}</div>` : nothing}
      ${!data
        ? html`<div class="note">טוען השוואה…</div>`
        : html`<div class="compare">
              <div><div class="note">${data.from ? `מפורסמת · ${fmtWhen(data.from.published_at ?? data.from.created_at)}` : 'אין גרסה מפורסמת'}</div>${data.from ? html`<img src=${resourceUrl(data.from.image_url)} alt="הגרסה המפורסמת" />` : html`<div class="note">—</div>`}</div>
              <div><div class="note">${d.mode === 'rollback' ? 'לשחזור' : 'חדשה'} · ${fmtWhen(data.to.published_at ?? data.to.created_at)}</div><img src=${resourceUrl(data.to.image_url)} alt="הגרסה החדשה" /></div>
            </div>
            <div class="dsum" data-diff-summary>
              ${data.from
                ? data.geometry.same
                  ? html`<sw-badge kind="recorded" label="גאומטריה זהה"></sw-badge>`
                  : html`<sw-badge kind="partial" label=${`שינוי: ${data.geometry.changes.map((c) => GEOM_LABEL[c.field] ?? c.field).join(', ')}`}></sw-badge>`
                : html`<sw-badge kind="neutral" label="פרסום ראשון"></sw-badge>`}
              <span>${data.anchors.total} פריטים מוצבים · ${data.anchors.carried} עוברים כמו שהם · ${data.anchors.needs_alignment} ידרשו יישור</span>
            </div>
            ${structure
              ? html`<div class="note" data-diff-structure>המבנה של הטיוטה (${wallsAndOpenings(structure.walls.length, structure.openings.length)}) יפורסם יחד עם הגרסה${blocked ? '; יש בו שגיאות שחוסמות את הפרסום עד לתיקון: ראה את הסימון האדום על המפה ואת רשימת הבעיות של המבנה' : ''}.</div>`
              : nothing}
            ${data.anchors.items.length
              ? html`<div class="ditems" data-diff-items>${data.anchors.items.map((i) => html`<div><span>${i.resource_type === 'camera' ? 'מצלמה' : 'ישות'} · ${i.name}</span><span class=${i.outcome === 'carried' ? '' : 'err'}>${i.outcome === 'carried' ? 'עובר' : 'יישור נדרש'}</span></div>`)}</div>`
              : nothing}
            ${data.anchors.needs_alignment ? html`<div class="note">פריטים שידרשו יישור נשארים במקומם על גרסת התוכנית הקודמת ומסומנים במפה; שום פריט לא מוזז למיקום מומצא.</div>` : nothing}`}
      <sw-button slot="footer" variant="ghost" @click=${() => (this.diff = null)}>${d.mode === 'compare' ? 'סגור' : 'ביטול'}</sw-button>
      ${d.mode !== 'compare' && data
        ? html`<sw-button slot="footer" variant="primary" icon=${d.mode === 'publish' ? 'check' : 'history'} data-diff-confirm ?disabled=${this.busy || blocked} @click=${() => this.confirmDiff()}>${d.mode === 'publish' ? 'פרסם גרסה' : 'שחזר ופרסם'}</sw-button>`
        : nothing}
    </sw-dialog>`;
  }

  private renderGeomDiffDialog() {
    const d = this.geomDiff;
    if (!d) return nothing;
    const data = d.data;
    const errors = data ? data.issues.filter((i) => i.severity === 'error') : [];
    const rows = data ? Object.entries(data.diff.collections) : [];
    return html`<sw-dialog open heading="פרסום המבנה" subheading="מה ישתנה לצופים במפה" data-geom-diff @close=${() => (this.geomDiff = null)}>
      ${d.error ? html`<div class="err" data-geom-diff-error>${d.error}</div>` : nothing}
      ${!data
        ? d.error
          ? nothing
          : html`<div class="note">טוען השוואה…</div>`
        : html`<div class="ditems" data-geom-diff-rows>
              ${rows.length
                ? rows.map(([coll, c]) => html`<div><span>${COLL_LABEL[coll] ?? coll}</span><span>${c.added.length} נוספו · ${c.changed.length} שונו · ${c.removed.length} הוסרו</span></div>`)
                : html`<div><span>אין שינוי בפריטים</span></div>`}
              ${data.diff.calibration_changed ? html`<div><span>כיול</span><span>קנה המידה השתנה</span></div>` : nothing}
            </div>
            <div class="note">${data.published_counts ? `כעת: ${wallsAndOpenings(data.published_counts.walls, data.published_counts.openings)}` : 'פרסום ראשון של מבנה'} · אחרי הפרסום: ${wallsAndOpenings(data.counts.walls, data.counts.openings)}</div>
            ${errors.length ? html`<div class="err" data-geom-diff-error>${countLabel(errors.length, 'שגיאה חוסמת אחת', 'שגיאות חוסמות')} בטיוטה: הפרסום חסום עד לתיקון. ראה את הסימון האדום על המפה ואת רשימת הבעיות של המבנה.</div>` : nothing}`}
      <sw-button slot="footer" variant="ghost" data-geom-cancel @click=${() => (this.geomDiff = null)}>ביטול</sw-button>
      <sw-button slot="footer" variant="primary" icon="check" data-geom-publish ?disabled=${this.busy || !data || errors.length > 0} @click=${() => this.confirmGeomPublish()}>פרסם מבנה</sw-button>
    </sw-dialog>`;
  }

  render() {
    const b = this.bundle;
    if (this.error && !b) return html`<sw-page heading="עורך תוכנית"><sw-state-panel state="error" hint=${this.error} actionLabel="נסה שוב" @action=${() => this.load()}></sw-state-panel></sw-page>`;
    if (!b) return html`<sw-page heading="עורך תוכנית"><sw-state-panel state="loading"></sw-state-panel></sw-page>`;
    const sel = this.selected;
    const dirty = this.dirty.size;
    const cams = this.anchors.filter((a) => a.resource_type === 'camera').length;
    const ents = this.anchors.length - cams;
    return html`
      <sw-page heading="עורך תוכנית" subheading=${`${b.buildingName} · ${b.floorName} · ${b.planStatus === 'draft' ? 'טיוטה' : b.planStatus === 'published' ? 'תוכנית מפורסמת' : 'אין תוכנית'} · העוגנים נשמרים בנפרד מתמונת המקור${b.source === 'demo' ? ' · נתוני הדגמה' : ''}`} crumbs=${`אתרים | ${b.siteName} | ${b.buildingName} | ${b.floorName}`} wide>
        ${b.permissions.publish && (b.planStatus === 'draft' || this.studio.pendingPublish)
          ? html`<sw-button slot="actions" variant="primary" icon="check" data-publish ?disabled=${this.busy} @click=${() => this.publish()}>${b.planStatus === 'draft' ? 'פרסום גרסה' : 'פרסום המבנה'}</sw-button>`
          : nothing}
        <sw-button slot="actions" icon="eye" @click=${() => navigate(`/explore/floors/${b.floorId}`)}>תצוגה מקדימה</sw-button>
        <sw-button slot="actions" ?disabled=${!dirty || this.busy} icon="check" @click=${() => this.save()}>${dirty ? `שמירה (${dirty})` : 'הכל שמור'}</sw-button>
        <sw-button slot="actions" variant="ghost" icon="history" ?disabled=${!this.undo.length} @click=${() => this.doUndo()}>ביטול שינוי</sw-button>
        ${b.planStatus === 'none'
          ? html`<sw-state-panel state="empty" heading="לקומה אין תוכנית" hint="העלה תוכנית קודם; אחר כך אפשר להציב מצלמות וישויות."><div style="margin-block-start:10px"><sw-button variant="primary" icon="upload" @click=${() => navigate(`/explore/floors/${b.floorId}/import`)}>העלאת תוכנית</sw-button></div></sw-state-panel>`
          : html`<div class="layout">
              <div class="mapwrap">
                <div class="bar">
                  <span class="autosave ${dirty ? 'dirty' : ''}"><i></i>${dirty ? `${dirty} שינויים לא שמורים` : 'הכל שמור'}</span>
                  ${this.info ? html`<span style="color:#15803d">${this.info}</span>` : nothing}
                  ${this.error ? html`<span class="err">${this.error}</span>` : nothing}
                  <span class="grow"></span>
                  ${b.needsAlignment ? html`<sw-badge kind="partial" label="פריטים מגרסת תוכנית קודמת — בדוק מיקומים"></sw-badge>
                    <sw-button size="sm" data-realign-crop ?disabled=${this.busy} title="כשהגרסה החדשה היא חיתוך אחר של אותו שרטוט, המיקומים מחושבים דרך שני החיתוכים" @click=${() => this.realign('crop')}>יישר לפי החיתוך</sw-button>
                    <sw-button size="sm" variant="ghost" data-realign-accept ?disabled=${this.busy} title="אחרי בדיקה בעין: הפריטים נרשמים על הגרסה הנוכחית כפי שהם" @click=${() => this.realign('accept')}>אשר מיקומים</sw-button>` : nothing}
                  <span>גרירה מזיזה · גלגלת = זום · ידיות = כיוון ושדה ראייה</span>
                </div>
                <div class="floorchip"><sw-icon name="building" size=${14}></sw-icon>${b.floorName}</div>
                ${this.studio.doc && b.permissions.structure ? html`<div class="levelbar">${renderLevelChips(this.studio.doc.levels, this.activeLevel, (id) => this.setLevelFilter(id), () => (this.levelDialog = { name: '', elevation: -1.2, ceiling: 3.0, error: '' }))}</div>` : nothing}
                <div class="rail" role="toolbar" aria-label="כלי עריכה">
                  ${TOOLS.map((tl) => html`<button class=${tl.id === this.tool ? 'on' : ''} data-tool=${tl.id} ?disabled=${!tl.ready || (STUDIO_TOOLS.includes(tl.id) && !b.permissions.structure) || (this.detectBusy && tl.id !== this.tool)} title=${tl.label} aria-label=${tl.label} aria-pressed=${tl.id === this.tool} @click=${() => this.pickTool(tl.id)}><sw-icon .name=${tl.icon} size=${18}></sw-icon></button>`)}
                  <hr />
                  <button title="ביטול (Ctrl+Z)" aria-label="ביטול" data-rail-undo ?disabled=${this.detectBusy || !this.undoTarget} @click=${() => this.undoAny()}><sw-icon name="history" size=${18}></sw-icon></button>
                  <button title="בצע שוב (Ctrl+Y)" aria-label="בצע שוב" data-rail-redo ?disabled=${this.detectBusy || !this.redoTarget} @click=${() => this.redoAny()}><sw-icon name="refresh" size=${18}></sw-icon></button>
                </div>
                <sw-plan-canvas editable alwaysLabel .placing=${!!this.placing || !!this.drawing || this.studioPlacing} .planWidth=${b.width} .planHeight=${b.height} .plan=${b.planSvg} .imageUrl=${b.imageUrl} .markers=${this.markers} .selectedId=${this.selectedId}
                  .zones=${this.planZones} .selectedZoneId=${this.selectedZoneId} .selectedZoneVertex=${this.zoneVertexSel && this.zoneVertexSel.zoneId === this.selectedZoneId ? this.zoneVertexSel.index : null} .draftPoints=${this.drawing ?? []}
                  .geometry=${this.geomPreview ?? this.studio.doc} .geomDrag=${this.geomDragMode} .structureLevel=${this.activeLevel} .selectedGeomId=${this.geomSel?.id ?? null} .highlightIds=${this.geomSel?.kind === 'group' ? (this.studio.doc?.groups.find((g) => g.id === this.geomSel!.id)?.member_ids ?? []) : this.tool === 'circuits' && this.circuitSel ? (this.studio.doc?.circuits.find((k) => k.id === this.circuitSel)?.member_ids ?? []) : []} .selectedVertex=${this.geomSel?.vertex ?? null} .issueIds=${this.issueIds}
                  .cornerSnapPx=${this.tool === 'structure' && this.studioMode === 'wall' ? CORNER_SNAP_PX : 0}
                  .wallDraft=${this.wallDraft ?? []} .hoverPoint=${this.studioPlacing ? this.hover : null} .rulers=${this.rulers} .catalog=${this.catalogLookup}
                  .candidates=${this.tool === 'detect' && this.cands ? this.cands.set : null} .candidateStates=${this.candStates} .selectedCandidateId=${this.candSel} .candidateEditable=${this.tool === 'detect' && !this.narrow && !this.busy}
                  @candidate-select=${(e: CustomEvent<{ id: string }>) => this.toggleCandidate(e.detail.id)}
                  @candidate-drag=${(e: CustomEvent<{ id: string; index: number; x: number; y: number }>) => this.onCandidateDrag(e.detail)} .anchorPositions=${Object.fromEntries(this.anchors.map((a) => [`${a.resource_type}:${a.resource_id}`, { x: a.position.x, y: a.position.y, rotation: a.rotation_degrees }]))}
                  @plan-hover=${(e: CustomEvent<{ x: number; y: number; shift: boolean; item?: boolean }>) => this.onPlanHover(e.detail.x, e.detail.y, e.detail.shift, !!e.detail.item)}
                  @geom-select=${(e: CustomEvent<{ id: string; kind: GeomKind; vertex?: number }>) => this.onGeomSelect(e.detail.id, e.detail.kind, e.detail.vertex)}
                  @geom-drag-move=${(e: CustomEvent<GeomDragDetail>) => this.onGeomDragMove(e.detail)}
                  @geom-drag-cancel=${() => { this.geomPreview = null; this.dupId = null; }}
                  @geom-drag=${(e: CustomEvent<GeomDragDetail>) => this.onGeomDrag(e.detail)}
                  @zone-select=${(e: CustomEvent<{ id: string }>) => { if (this.placing || this.drawing || this.studioPlacing || this.tool === 'detect' || e.detail.id.startsWith('cand-')) return; if (this.tool === 'structure' || this.tool === 'library') { this.geomSel = null; return; } if (this.selectedZoneId !== e.detail.id) this.zoneVertexSel = null; this.selectedZoneId = e.detail.id; this.selectedId = null; this.geomSel = null; }}
                  @zone-edit=${(e: CustomEvent<{ id: string; polygon: ZonePoint[] }>) => { const z = this.zones.find((x) => x.id === e.detail.id); this.zoneVertexSel = null; if (z) void this.patchZone(z, { polygon: e.detail.polygon }); }}
                  @zone-vertex-select=${(e: CustomEvent<{ id: string; index: number }>) => { if (e.detail.id === this.selectedZoneId) this.zoneVertexSel = { zoneId: e.detail.id, index: e.detail.index }; }}
                  @marker-select=${(e: CustomEvent<MarkerSelectDetail>) => { if (this.placing || this.drawing || this.studioPlacing || this.tool === 'detect') return; this.selectedId = e.detail.id; this.selectedZoneId = null; this.zoneVertexSel = null; this.geomSel = null; }}
                  @marker-move=${(e: CustomEvent<{ id: string; x: number; y: number }>) => { if (this.tool === 'detect') return; this.apply(e.detail.id, { position: { x: +e.detail.x.toFixed(4), y: +e.detail.y.toFixed(4) } }); this.selectedId = e.detail.id; this.selectedZoneId = null; this.zoneVertexSel = null; this.geomSel = null; }}
                  @marker-orient=${(e: CustomEvent<{ id: string; rotation: number; fov: number }>) => this.apply(e.detail.id, { rotation_degrees: e.detail.rotation, field_of_view_degrees: e.detail.fov })}
                  @marker-coverage=${(e: CustomEvent<{ id: string; radius?: number; polygon?: { x: number; y: number }[] }>) => this.apply(e.detail.id, e.detail.polygon ? { coverage_polygon: e.detail.polygon.map((p) => [p.x, p.y] as [number, number]) } : { coverage_radius: e.detail.radius })}
                  @plan-click=${(e: CustomEvent<{ x: number; y: number; shift?: boolean }>) => (this.tool === 'detect' ? (this.candSel = null) : this.drawing ? this.addDraftPoint(e.detail.x, e.detail.y) : this.studioPlacing ? this.studioClick(e.detail.x, e.detail.y, !!e.detail.shift) : this.place(e.detail.x, e.detail.y))} @dragover=${(e: DragEvent) => { if (e.dataTransfer?.types.includes('text/x-sw-item')) e.preventDefault(); }} @drop=${(e: DragEvent) => this.onItemDrop(e)}></sw-plan-canvas>
                ${this.placing ? html`<div class="placing-hint"><span>לחץ על התוכנית כדי להציב את ${this.placing.kind === 'camera' ? this.placing.camera.name : this.placing.entity.name || this.placing.entity.entity_id} · Esc לביטול</span></div>` : nothing}
                ${this.drawing ? html`<div class="placing-hint"><span>ציור אזור: לחץ להוספת פינות (${this.drawing.length}) · לחיצה על הפינה הראשונה או Enter מסיימים · Esc לביטול</span></div>` : nothing}
                ${this.placingItem && !this.bindOffer ? html`<div class="placing-hint"><span>לחץ על התוכנית כדי להציב ${this.placingItem.names.he} · Esc לביטול</span></div>` : nothing}
                ${this.connMode ? html`<div class="placing-hint"><span>${this.connStart ? 'לחץ על הנקודה השנייה' : 'לחץ על הנקודה הראשונה'} · Esc לביטול</span></div>` : nothing}
                ${this.tool === 'circuits' && this.membersMode ? html`<div class="placing-hint"><span>לחץ על מנורה כדי להוסיף או להסיר אותה מהמעגל · Esc לסיום</span></div>` : nothing}
                ${this.bindOffer ? html`<div class="placing-hint bindbar" data-bind-offer><span>העצם ליד ${this.anchorName(this.bindOffer.anchor)} — להפוך אותו לגוף של הישות?
                    <button data-bind-accept @click=${() => this.bindObject(this.bindOffer!.objectId, this.bindOffer!.anchor)}>הצמד לישות</button><button data-bind-dismiss @click=${() => { this.bindRefused.add(this.bindOffer!.objectId); this.bindOffer = null; }}>לא</button></span></div>` : nothing}
                ${this.wallDraft ? html`<div class="placing-hint"><span>ציור קיר: ${this.wallDraft.length} נקודות · Enter או לחיצה חוזרת על הנקודה האחרונה מסיימים · לחיצה על הנקודה הראשונה סוגרת מתאר · Esc לביטול</span></div>` : nothing}
                <div class="legend"><span><i></i>מצלמות · ${cams}</span><span><i class="ent"></i>ישויות HA · ${ents}</span><span><i class="zone"></i>אזורים · ${this.zones.length}</span></div>
              </div>
              <div class="props">
                ${sel ? (sel.resource_type === 'camera' ? this.renderCameraInspector(sel) : this.renderEntityInspector(sel)) : this.selectedZone && this.tool !== 'zones' ? html`<sw-card heading="אזור" subheading=${this.selectedZone.name}>${this.renderZoneInspector(this.selectedZone)}</sw-card>` : this.renderToolPanel(b)}
                ${(sel || (this.selectedZone && this.tool !== 'zones')) && this.tool !== 'select' ? this.renderToolPanel(b) : nothing}
                ${this.renderVersionCard(b)}
              </div>
            </div>`}
        ${this.renderDiffDialog()}
        ${this.renderGeomDiffDialog()}
        ${this.arrayDialog ? renderArrayDialog(this.arrayDialog, (patch) => (this.arrayDialog = { ...this.arrayDialog!, error: '', ...patch }), () => this.createArray(), () => (this.arrayDialog = null)) : nothing}
        ${this.groupDelete ? renderGroupDeleteDialog(this.studio.doc?.groups.find((g) => g.id === this.groupDelete)?.member_ids.length ?? 0, () => this.deleteGroup(true), () => this.deleteGroup(false), () => (this.groupDelete = null)) : nothing}
        ${this.customDialog && this.library ? renderCustomItemDialog(this.customDialog, this.library, (patch) => (this.customDialog = { ...this.customDialog!, ...patch }), () => void this.createCustom(), () => (this.customDialog = null)) : nothing}
        ${this.levelDialog ? renderLevelDialog(this.levelDialog, (patch) => (this.levelDialog = { ...this.levelDialog!, ...patch }), () => this.createLevel(), () => (this.levelDialog = null)) : nothing}
      </sw-page>
    `;
  }
}
