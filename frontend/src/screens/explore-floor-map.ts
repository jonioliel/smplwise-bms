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
import { demoCameras, demoEntities, demoFloors, type DemoCamera, type DemoEntity } from '../fixtures/demo';
import { demoScene } from '../fixtures/catalog';
import { t } from '../i18n/he';
import { navigate } from '../router';
import { cameraState, loadMap, type MapBundle } from '../api/maps';
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

/** Hebrew names for enum choices the adapters offer (T040). */
const ARG_CHOICE_HE: Record<string, string> = { off: 'כבוי', heat: 'חימום', cool: 'קירור', heat_cool: 'חימום/קירור', auto: 'אוטומטי', dry: 'ייבוש', fan_only: 'מאוורר בלבד' };

type ScreenState = 'ready' | 'loading' | 'empty' | 'error' | 'forbidden' | 'stale' | 'partial';
type Layer = 'cameras' | 'doors' | 'lights' | 'sensors' | 'zones';

const LAYERS: { id: Layer; icon: 'camera' | 'door' | 'light' | 'sensor' | 'map'; label: () => string }[] = [
  { id: 'cameras', icon: 'camera', label: () => t('floor.cameras') },
  { id: 'doors', icon: 'door', label: () => t('floor.doors') },
  { id: 'lights', icon: 'light', label: () => t('floor.lights') },
  { id: 'sensors', icon: 'sensor', label: () => t('floor.sensors') },
  { id: 'zones', icon: 'map', label: () => 'חדרים ואזורים' },
];

const SCENES: SceneKind[] = ['entrance', 'lobby', 'corridor', 'hall', 'parking', 'warehouse', 'backyard', 'driveway', 'night'];

/**
 * SC04 — interactive floor plan (board 1 screen 4). Backed by the add-on API (published plan image,
 * anchors, camera registry) with the demo fixtures as a stand-in when no backend answers.
 */
@customElement('explore-floor-map')
export class ExploreFloorMap extends LitElement {
  @property() floorId = 'f0';
  @property() screenState: ScreenState = 'ready';
  /** Search hits: zone id to highlight and zoom to; camera / entity id whose pin to open. */
  @property() focusZone = '';
  @property() focusCamera = '';
  @property() focusEntity = '';
  @state() private selectedZoneId: string | null = null;

  @state() private bundle: MapBundle | null = null;
  @state() private tree: CatalogTree | null = null;
  @state() private loadError = '';
  @state() private noFloors = false;
  @state() private selectedId: string | null = null;
  @state() private anchor: { x: number; y: number } | null = null;
  @state() private layers = new Set<Layer>(['cameras', 'doors', 'lights', 'sensors', 'zones']);
  @state() private pinned = false;
  @state() private panel = false;
  /** Multi-camera selection (T043): anchor ids of the picked cameras while the mode is on. */
  @state() private multi = false;
  /** Side list of what is on the plan (2.10): open state kept per browser. */
  @state() private sideList = (() => { try { return localStorage.getItem('sw.map.sidelist') === '1'; } catch { return false; } })();
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
    if (e.key !== 'Escape') return;
    if (this.confirmSpec) return; // the dialog handles its own Escape
    if (this.selectedId) {
      const id = this.selectedId;
      this.close();
      this.canvas?.focusMarker(id);
    } else if (this.panel) this.panel = false;
  };

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
    this.stopWs?.();
    this.stopWs = null;
  }

  /** Entity state pushes (scoped server-side to the floors this user may read). */
  private startWs() {
    if (this.stopWs || !isApi()) return;
    this.stopWs = subscribeHa((m) => {
      const b = this.bundle;
      if (m.type === 'entity_state_changed' && b) {
        if (!b.anchors.some((a) => a.resource_type === 'ha_entity' && a.resource_id === m.entity.entity_id)) return;
        this.bundle = { ...b, anchors: b.anchors.map((a) => (a.resource_type === 'ha_entity' && a.resource_id === m.entity.entity_id ? { ...a, entity: { ...(a.entity ?? ({} as HaEntity)), ...m.entity, actions: a.entity?.actions } } : a)) };
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
    } else if ((changed.has('focusZone') || changed.has('focusCamera') || changed.has('focusEntity')) && this.bundle) {
      void this.applyFocus();
    }
  }

  /** Bring a search hit into view once the map is on screen. */
  private async applyFocus() {
    const b = this.bundle;
    if (!b || (!this.focusZone && !this.focusCamera && !this.focusEntity)) return;
    await this.updateComplete;
    const canvas = this.canvas;
    if (!canvas) return;
    const z = this.focusZone ? b.zones.find((x) => x.id === this.focusZone) : null;
    if (z) {
      const xs = z.polygon.map((p) => p.x);
      const ys = z.polygon.map((p) => p.y);
      this.selectedZoneId = z.id;
      canvas.zoomToBox(Math.min(...xs), Math.min(...ys), Math.max(...xs), Math.max(...ys));
    }
    const a = this.focusCamera
      ? b.anchors.find((x) => x.resource_type === 'camera' && x.resource_id === this.focusCamera)
      : this.focusEntity
        ? b.anchors.find((x) => x.resource_type === 'ha_entity' && x.resource_id === this.focusEntity)
        : null;
    if (a) {
      canvas.zoomToBox(a.position.x - 0.15, a.position.y - 0.15, a.position.x + 0.15, a.position.y + 0.15, 48, 2.2);
      await this.updateComplete;
      const p = canvas.toScreen(a.position.x, a.position.y);
      this.selectedId = a.id;
      this.anchor = { x: p.x, y: p.y };
    }
  }

  private async load() {
    this.loadError = '';
    try {
      const tree = this.tree ?? (await loadTree());
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
      this.bundle = await loadMap(this.floorId);
      if (this.bundle.source === 'api') this.startWs();
      void this.applyFocus();
    } catch (err) {
      this.loadError = describeError(err);
      this.bundle = null;
    }
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
      .map((a) => ({
        id: a.id,
        kind: a.resource_type === 'camera' ? 'camera' : entityMarkerKind(a.layer_id, a.entity?.domain),
        label: a.camera?.name ?? a.entity?.name ?? a.label ?? a.resource_id,
        x: a.position.x,
        y: a.position.y,
        rotation: a.rotation_degrees,
        fov: a.field_of_view_degrees ?? undefined,
        state: a.resource_type === 'camera' ? cameraState(a) : stale ? 'stale' : this.entityTone(a.entity),
      }));
  }

  /** Items per layer for the panel (M07: counts next to every toggle). */
  private layerCounts(): Record<Layer, number> {
    const b = this.bundle;
    const out: Record<Layer, number> = { cameras: 0, doors: 0, lights: 0, sensors: 0, zones: b?.zones.length ?? 0 };
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

  /** Layer state is remembered per floor in this browser (M07: "מצב שכבות נשמר עם התצוגה"); never on the server. */
  private setLayers(next: Set<Layer>) {
    this.layers = next;
    try {
      localStorage.setItem(`sw.floor.layers.${this.floorId}`, JSON.stringify([...next]));
    } catch {
      /* private mode or blocked storage: the choice lives for this page only */
    }
  }

  private restoreLayers() {
    try {
      const raw = localStorage.getItem(`sw.floor.layers.${this.floorId}`);
      if (!raw) return;
      const arr = JSON.parse(raw) as Layer[];
      if (Array.isArray(arr)) this.layers = new Set(arr.filter((l) => ['cameras', 'doors', 'lights', 'sensors', 'zones'].includes(l)));
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
    await this.applyFocus();
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
      <div class="body">
        <div class="grp">קומות</div>
        ${this.floors.map((f) => html`<button class="it ${f.id === this.floorId ? 'on' : ''}" data-side-floor=${f.id} @click=${() => { if (f.id !== this.floorId) navigate(`/explore/floors/${f.id}`); }}>
          <sw-icon name="building" size=${12}></sw-icon><span class="nm">${bidi(f.name)}</span><span class="st">${f.cameraCount} מצלמות${f.hasPlan ? '' : ' · אין תוכנית'}</span></button>`)}
        <div class="grp">מצלמות (${cams.length})</div>
        ${cams.map((a) => html`<button class="it ${this.selectedId === a.id || this.picked.includes(a.id) ? 'on' : ''}" data-side-camera=${a.resource_id} @click=${() => this.jumpTo(a)}>
          <span class="dot" style="--dot:${dotOf(a)}"></span><span class="nm">${a.camera?.name ?? a.label ?? a.resource_id}</span><span class="st">${a.camera?.status === 'online' ? 'חיה' : a.camera?.status === 'offline' ? 'מנותקת' : ''}</span></button>`)}
        ${[...groups.entries()].map(([d, list]) => html`<div class="grp">${domains[d] ?? d} (${list.length})</div>
          ${list.map((a) => html`<button class="it ${this.selectedId === a.id ? 'on' : ''}" data-side-entity=${a.resource_id} @click=${() => this.jumpTo(a)}>
            <span class="dot" style="--dot:${dotOf(a)}"></span><span class="nm">${a.entity?.name ?? a.label ?? a.resource_id}</span><span class="st">${a.entity ? stateLabel(a.entity) : ''}</span></button>`)}`)}
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
    if (!this.selectedId || !this.canvas) return;
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
    return html`
      <div class="statusrow"><sw-badge kind=${tone} label=${stateLabel(e)}></sw-badge><span>${floorName} · ${domainLabel(e.domain)}${e.area_name ? ` · ${e.area_name}` : ''}</span></div>
      <dl class="meta">
        <dt>${t('entity.lastChanged')}</dt><dd>${fmtTime(e.last_changed)}</dd>
        <dt>נראה לאחרונה</dt><dd>${fmtTime(e.state_seen_at)}</dd>
        <dt>ID</dt><dd><span class="ltr">${e.entity_id}</span></dd>
      </dl>
      ${!fresh ? html`<div class="warn">${e.state === 'unavailable' ? 'Home Assistant מדווח שהישות אינה זמינה.' : 'הסנכרון מול Home Assistant מנותק — המצב עלול להיות מיושן.'}</div>` : nothing}
      ${e.actions === undefined ? html`<div class="note">${t('entity.noControl')}</div>` : e.actions.length === 0 ? html`<div class="note">קריאה בלבד — אין פעולות מותרות ל־${domainLabel(e.domain)}.</div>` : nothing}
      ${e.actions?.some((s) => s.granted === false) ? html`<div class="note" data-grant-note>פעולה מעומעמת דורשת הרשאה נפרדת (למשל פתיחת דלת) שאינה חלק משליטה כללית בישויות.</div>` : nothing}
      ${act
        ? html`<div class=${act.error || act.record?.status === 'failed' || act.record?.status === 'denied' ? 'warn' : 'note'}>${act.spec.label}: ${act.error ? act.error : act.record ? `${ACTION_STATUS_LABEL[act.record.status]}${act.record.error ? ` — ${ACTION_ERROR_LABEL[act.record.error] ?? act.record.error}` : ''}` : 'שולח…'}</div>`
        : nothing}
    `;
  }

  private entityFooter(a: Anchor) {
    const e = a.entity;
    const busy = Boolean(this.action && e && this.action.entityId === e.entity_id && this.action.busy);
    const specs = e?.actions ?? [];
    return html`${specs.map((s) => html`<span class="actrow" data-action-row=${s.id}>${e && s.argument_specs?.length ? s.argument_specs.map((a) => this.renderArg(e, s, a)) : nothing}<sw-button size="sm" variant=${s.risk === 'sensitive' ? 'danger' : s.sensitive ? 'danger' : 'primary'} ?disabled=${busy || this.screenState === 'stale' || e?.state === 'unavailable' || s.granted === false} title=${s.granted === false ? `נדרשת הרשאה נפרדת: ${s.grant ?? ''}` : s.risk_label ? `פעולה ${s.risk_label}` : ''} data-action=${s.id} data-risk=${s.risk ?? (s.sensitive ? 'attention' : 'routine')} data-granted=${s.granted === false ? 'no' : 'yes'} @click=${() => e && this.trigger(e.entity_id, s)}>${s.label}</sw-button></span>`)}`;
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
      heading = a.camera?.name ?? a.entity?.name ?? a.label ?? a.resource_id;
      sub = `${b.buildingName} · ${b.floorName}`;
      body = a.resource_type === 'camera' ? this.apiCameraBody(a, b.floorName) : this.apiEntityBody(a, b.floorName);
      footer = html`${a.resource_type === 'camera'
          ? html`<sw-button variant="primary" size="sm" icon="expand" ?disabled=${cameraState(a) === 'offline'} @click=${() => a.camera && navigate(`/live/cameras/${a.camera.id}`)}>צפייה מלאה</sw-button>
            <sw-button size="sm" icon="history" ?disabled=${!a.camera} @click=${() => a.camera && navigate('/investigate/playback', { camera: a.camera.id })}>${t('camera.recordings')}</sw-button>`
          : this.entityFooter(a)}
        ${b.permissions.edit ? html`<sw-button variant="ghost" size="sm" icon="edit" @click=${() => navigate(`/explore/floors/${b.floorId}/edit`)}>עריכה</sw-button>` : nothing}`;
    }
    if (this.narrow || !this.anchor) {
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
    ];
    return html`<div class="panel" role="group" aria-label="שכבות פעילות" data-layers-panel>
      <h3>שכבות פעילות</h3>
      <div class="sub">הצג רק מה שרלוונטי כרגע</div>
      ${rows.map((r) => html`<div class="prow"><span class="lbl">${r.label}<span class="cnt">${r.count}</span></span><sw-toggle ?checked=${this.layers.has(r.id)} label=${r.label} labelHidden data-layer=${r.id} @change=${(e: CustomEvent<{ checked: boolean }>) => { const next = new Set(this.layers); if (e.detail.checked) next.add(r.id); else next.delete(r.id); this.setLayers(next); }}></sw-toggle></div>`)}
      <div class="pnote"><sw-icon name="shield" size=${14}></sw-icon><span>מתג משנה תצוגה בלבד; ייבוא ישות אינו מעניק הרשאת שליטה בה.</span></div>
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
      <sw-plan-canvas
        .planWidth=${b.width}
        .planHeight=${b.height}
        .plan=${b.planSvg}
        .imageUrl=${b.imageUrl}
        .markers=${this.markers}
        .selectedId=${this.selectedId}
        .selectedIds=${this.multi ? this.picked : []}
        .boxSelect=${this.multi}
        @box-select=${(e: CustomEvent<{ ids: string[] }>) => this.addPicks(e.detail.ids)}
        .zones=${this.layers.has('zones') ? b.zones : []}
        .selectedZoneId=${this.selectedZoneId}
        .dimEntities=${this.screenState === 'stale'}
        @zone-select=${(e: CustomEvent<{ id: string }>) => { if (this.multi) { this.pickZone(e.detail.id); return; } this.selectedZoneId = this.selectedZoneId === e.detail.id ? null : e.detail.id; this.close(); }}
        @marker-select=${this.onSelect}
        @view-change=${this.onViewChange}></sw-plan-canvas>
      <div class="floorchip" data-floorchip><sw-icon name="building" size=${14}></sw-icon>${b.floorName}</div>
      ${this.panel ? this.renderPanel() : nothing}
      ${this.multi ? this.renderPickbar() : nothing}
      ${this.renderSideList()}
      ${this.renderSaveDialog()}
      <div class="legend" aria-label="מקרא">
        ${b.zones.length && this.layers.has('zones') ? html`<span><i style="--lg: var(--sw-accent); border-radius: 2px; opacity: 0.5"></i>${b.zones.length} אזורים</span>` : nothing}
        <span><i style="--lg: var(--sw-accent)"></i>חי</span>
        <span><i style="--lg: var(--sw-stale)"></i>לא מעודכן</span>
        <span><i style="--lg: var(--sw-offline)"></i>מנותק</span>
        <span><i style="--lg: var(--sw-forbidden)"></i>ללא הרשאה</span>
        <span><i style="--lg: #fff; box-shadow: 0 0 0 1px var(--sw-border-strong)"></i>ישות HA</span>
      </div>
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
