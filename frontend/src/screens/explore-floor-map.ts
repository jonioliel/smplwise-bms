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
import '../map/sw-plan-canvas';
import type { PlanMarker, MarkerSelectDetail, SwPlanCanvas } from '../map/sw-plan-canvas';
import type { StateKind } from '../components/sw-badge';
import type { SceneKind } from '../components/sw-scene';
import { demoCameras, demoEntities, demoFloors, type DemoCamera, type DemoEntity } from '../fixtures/demo';
import { demoScene } from '../fixtures/catalog';
import { t } from '../i18n/he';
import { navigate } from '../router';
import { cameraState, loadMap, type MapBundle } from '../api/maps';
import { loadTree, type CatalogTree } from '../api/catalog';
import { describeError } from '../api/client';
import type { Anchor } from '../api/types';

type ScreenState = 'ready' | 'loading' | 'empty' | 'error' | 'forbidden' | 'stale' | 'partial';
type Layer = 'cameras' | 'doors' | 'lights' | 'sensors';

const LAYERS: { id: Layer; icon: 'camera' | 'door' | 'light' | 'sensor'; label: () => string }[] = [
  { id: 'cameras', icon: 'camera', label: () => t('floor.cameras') },
  { id: 'doors', icon: 'door', label: () => t('floor.doors') },
  { id: 'lights', icon: 'light', label: () => t('floor.lights') },
  { id: 'sensors', icon: 'sensor', label: () => t('floor.sensors') },
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
  @state() private selectedId: string | null = null;
  @state() private anchor: { x: number; y: number } | null = null;
  @state() private layers = new Set<Layer>(['cameras', 'doors', 'lights', 'sensors']);
  @state() private pinned = false;
  @state() private narrow = false;
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
      const [tree, bundle] = await Promise.all([this.tree ? Promise.resolve(this.tree) : loadTree(), loadMap(this.floorId)]);
      this.tree = tree;
      this.bundle = bundle;
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
      .filter((a) => (a.resource_type === 'camera' ? this.layers.has('cameras') : true))
      .map((a) => ({
        id: a.id,
        kind: a.resource_type === 'camera' ? 'camera' : a.layer_id === 'doors' ? 'lock' : a.layer_id === 'lights' ? 'light' : 'binary_sensor',
        label: a.camera?.name ?? a.label ?? a.resource_id,
        x: a.position.x,
        y: a.position.y,
        rotation: a.rotation_degrees,
        fov: a.field_of_view_degrees ?? undefined,
        state: a.resource_type === 'camera' ? cameraState(a) : 'neutral',
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
        : html`<sw-camera-tile name="" state=${st === 'live' ? 'live' : 'unknown'} scene=${scene}></sw-camera-tile>`}
      <div class="statusrow"><sw-badge kind=${st}></sw-badge><span>${floorName} · ערוץ ${cam?.channel ?? '?'}</span></div>
      <dl class="meta">
        <dt>שם ב־NVR</dt><dd>${cam?.name_source || '—'}</dd>
        <dt>Track</dt><dd><span class="ltr">${cam?.main_track ?? '?'} / ${cam?.sub_track ?? '?'}</span></dd>
        <dt>נראתה לאחרונה</dt><dd>${cam?.last_seen_at ? cam.last_seen_at.replace('T', ' ').replace('Z', ' UTC') : 'לא נבדק'}</dd>
      </dl>
      <div class="note">וידאו חי יתחבר דרך go2rtc במקטע הבא (T017); התמונה כאן היא איור.</div>
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
      heading = a.camera?.name ?? a.label ?? a.resource_id;
      sub = `${b.buildingName} · ${b.floorName}`;
      body = a.resource_type === 'camera' ? this.apiCameraBody(a, b.floorName) : html`<div class="note">ישות HA · ${a.resource_id} — מצב יגיע עם גשר HA (T025).</div>`;
      footer = html`<sw-button variant="primary" size="sm" icon="expand" disabled title="וידאו חי מגיע במקטע הבא">צפייה חיה</sw-button>
        <sw-button size="sm" icon="history" disabled>${t('camera.recordings')}</sw-button>
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
        .dimEntities=${this.screenState === 'stale'}
        @marker-select=${this.onSelect}
        @view-change=${this.onViewChange}></sw-plan-canvas>
      <div class="legend" aria-label="מקרא">
        <span><i style="--lg: var(--sw-accent)"></i>חי</span>
        <span><i style="--lg: var(--sw-stale)"></i>לא מעודכן</span>
        <span><i style="--lg: var(--sw-offline)"></i>מנותק</span>
        <span><i style="--lg: var(--sw-forbidden)"></i>ללא הרשאה</span>
        <span><i style="--lg: #fff; box-shadow: 0 0 0 1px var(--sw-border-strong)"></i>ישות HA</span>
      </div>
      ${this.renderCard()}
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
