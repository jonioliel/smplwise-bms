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
import { ApiError, describeError } from '../api/client';
import type { Anchor } from '../api/types';
import { ACTION_STATUS_LABEL, awaitAction, domainLabel, entityMarkerKind, entityTone, fmtTime, runAction, stateLabel, subscribeHa, type HaActionRecord, type HaActionSpec, type HaEntity } from '../api/ha';

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

  @state() private bundle: MapBundle | null = null;
  @state() private tree: CatalogTree | null = null;
  @state() private loadError = '';
  @state() private noFloors = false;
  @state() private selectedId: string | null = null;
  @state() private anchor: { x: number; y: number } | null = null;
  @state() private layers = new Set<Layer>(['cameras', 'doors', 'lights', 'sensors', 'zones']);
  @state() private pinned = false;
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

  connectedCallback() {
    super.connectedCallback();
    this.narrow = this.mq.matches;
    this.mq.addEventListener('change', this.onMq);
    void this.load();
  }

  disconnectedCallback() {
    super.disconnectedCallback();
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
      void this.load();
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
      this.bundle = await loadMap(this.floorId);
      if (this.bundle.source === 'api') this.startWs();
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

  private toggleLayer(layer: Layer) {
    const next = new Set(this.layers);
    if (next.has(layer)) next.delete(layer);
    else next.add(layer);
    this.layers = next;
  }

  private onSelect(e: CustomEvent<MarkerSelectDetail>) {
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
      const r = await runAction(entityId, spec.id, {}, confirmed);
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
      ${act
        ? html`<div class=${act.error || act.record?.status === 'failed' || act.record?.status === 'denied' ? 'warn' : 'note'}>${act.spec.label}: ${act.error ? act.error : act.record ? `${ACTION_STATUS_LABEL[act.record.status]}${act.record.error && act.record.status !== 'denied' ? ` (${act.record.error})` : ''}` : 'שולח…'}</div>`
        : nothing}
    `;
  }

  private entityFooter(a: Anchor) {
    const e = a.entity;
    const busy = Boolean(this.action && e && this.action.entityId === e.entity_id && this.action.busy);
    const specs = e?.actions ?? [];
    return html`${specs.map((s) => html`<sw-button size="sm" variant=${s.sensitive ? 'danger' : 'primary'} ?disabled=${busy || this.screenState === 'stale' || e?.state === 'unavailable'} @click=${() => e && this.trigger(e.entity_id, s)}>${s.label}</sw-button>`)}`;
  }

  private renderConfirm() {
    const c = this.confirmSpec;
    if (!c) return nothing;
    const ent = this.bundle?.anchors.find((a) => a.resource_type === 'ha_entity' && a.resource_id === c.entityId)?.entity;
    return html`<sw-dialog open heading=${t('entity.confirm')} subheading=${ent?.name ?? c.entityId} @close=${() => (this.confirmSpec = null)}>
      <div style="font-size:var(--sw-fs-sm);line-height:1.5">הפעולה <strong>${c.spec.label}</strong> על <span class="ltr">${c.entityId}</span> מסומנת כרגישה. היא תבוצע ב־Home Assistant בזהות שלך ותירשם באודיט.</div>
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
    return html`
      ${st === 'offline'
        ? html`<div class="off"><div><sw-icon name="offline" size=${22}></sw-icon><div>${t('camera.offlineReason')}</div></div></div>`
        : html`<sw-camera-tile name="" state=${st === 'live' ? 'live' : 'unknown'} scene=${scene} poster=${cam ? snapshotUrl(cam.id, Date.now()) : ''} @click=${() => cam && navigate(`/live/cameras/${cam.id}`)}></sw-camera-tile>`}
      <div class="statusrow"><sw-badge kind=${st}></sw-badge><span>${floorName} · ערוץ ${cam?.channel ?? '?'}</span></div>
      <dl class="meta">
        <dt>שם ב־NVR</dt><dd>${cam?.name_source || '—'}</dd>
        <dt>Track</dt><dd><span class="ltr">${cam?.main_track ?? '?'} / ${cam?.sub_track ?? '?'}</span></dd>
        <dt>נראתה לאחרונה</dt><dd>${cam?.last_seen_at ? cam.last_seen_at.replace('T', ' ').replace('Z', ' UTC') : 'לא נבדק'}</dd>
      </dl>
      <div class="note">התמונה היא צילום מה־NVR (מתרענן); "צפייה חיה" פותחת את הזרם.</div>
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
          ? html`<sw-button variant="primary" size="sm" icon="expand" ?disabled=${cameraState(a) === 'offline'} @click=${() => a.camera && navigate(`/live/cameras/${a.camera.id}`)}>צפייה חיה</sw-button>
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
        .zones=${this.layers.has('zones') ? b.zones : []}
        .dimEntities=${this.screenState === 'stale'}
        @marker-select=${this.onSelect}
        @view-change=${this.onViewChange}></sw-plan-canvas>
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
            <span>${cameraCount} מצלמות${b?.source === 'demo' ? ' · נתוני הדגמה' : b?.planStatus === 'published' ? ' · תוכנית מפורסמת' : ''}</span>
            ${apiFloor?.draft_version_id ? html`<sw-badge kind="stale" label="טיוטת תוכנית ממתינה לפרסום"></sw-badge>` : nothing}
          </div>
        </div>
        <div class="spacer"></div>
        <div class="tools">
          <div class="layers" role="group" aria-label=${t('floor.layers')}>
            ${LAYERS.map((l) => html`<button class=${this.layers.has(l.id) ? 'on' : ''} title=${l.label()} aria-label=${l.label()} aria-pressed=${this.layers.has(l.id)} @click=${() => this.toggleLayer(l.id)}><sw-icon name=${l.icon} size=${14}></sw-icon></button>`)}
          </div>
          <sw-field><select aria-label=${t('floor.switcher')} @change=${(e: Event) => navigate(`/explore/floors/${(e.target as HTMLSelectElement).value}`)}>${floors.map((f) => html`<option value=${f.id} ?selected=${f.id === this.floorId}>${f.name} · ${f.cameraCount} מצלמות${f.hasPlan ? '' : ' · אין תוכנית'}</option>`)}</select></sw-field>
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
