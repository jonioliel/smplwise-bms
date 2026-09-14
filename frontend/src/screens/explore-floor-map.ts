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
import { demoCameras, demoEntities, demoFloors, demoPlan, demoSite, type DemoCamera, type DemoEntity } from '../fixtures/demo';
import { demoScene } from '../fixtures/catalog';
import { t } from '../i18n/he';
import { navigate } from '../router';

type ScreenState = 'ready' | 'loading' | 'empty' | 'error' | 'forbidden' | 'stale' | 'partial';
type Layer = 'cameras' | 'doors' | 'lights' | 'sensors';

const LAYERS: { id: Layer; icon: 'camera' | 'door' | 'light' | 'sensor'; label: () => string }[] = [
  { id: 'cameras', icon: 'camera', label: () => t('floor.cameras') },
  { id: 'doors', icon: 'door', label: () => t('floor.doors') },
  { id: 'lights', icon: 'light', label: () => t('floor.lights') },
  { id: 'sensors', icon: 'sensor', label: () => t('floor.sensors') },
];

/**
 * SC04 — interactive floor plan (board 1 screen 4): breadcrumb, "building – floor" title, a floor
 * dropdown, the plan drawn in thin blue-grey lines with bare blue camera pins and view cones, and a
 * floating camera card anchored to the selected pin (bottom sheet on phones).
 */
@customElement('explore-floor-map')
export class ExploreFloorMap extends LitElement {
  @property() floorId = 'f0';
  @property() screenState: ScreenState = 'ready';

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
      inline-size: 150px;
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
  }

  disconnectedCallback() {
    super.disconnectedCallback();
    this.mq.removeEventListener('change', this.onMq);
  }

  private get floor() {
    return demoFloors.find((f) => f.id === this.floorId) ?? demoFloors[0];
  }

  private get markers(): PlanMarker[] {
    const stale = this.screenState === 'stale';
    const cams: PlanMarker[] = this.layers.has('cameras')
      ? demoCameras.filter((c) => c.floorId === this.floorId).map((c) => ({ id: c.id, kind: 'camera', label: c.name, x: c.x, y: c.y, rotation: c.rotation, fov: c.fov, state: c.state }))
      : [];
    const ents: PlanMarker[] = demoEntities
      .filter((e) => e.floorId === this.floorId)
      .filter((e) => (e.domain === 'lock' && this.layers.has('doors')) || (e.domain === 'light' && this.layers.has('lights')) || (e.domain === 'binary_sensor' && this.layers.has('sensors')))
      .map((e) => ({ id: e.id, kind: e.domain, label: e.name, x: e.x, y: e.y, state: (stale ? 'stale' : 'neutral') as StateKind }));
    return [...cams, ...ents];
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

  /** Keep the card glued to its pin while the user pans or zooms. */
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

  private cameraBody(cam: DemoCamera) {
    const reason =
      cam.state === 'offline' ? t('camera.offlineReason') : cam.state === 'forbidden' ? t('camera.forbiddenReason') : cam.state === 'stale' ? t('camera.staleReason') : '';
    const canView = cam.state === 'live' || cam.state === 'stale';
    return html`
      ${canView
        ? html`<sw-camera-tile name="" state=${cam.state} scene=${demoScene[cam.id] ?? 'lobby'} @click=${() => navigate(`/live/cameras/${cam.id}`)}></sw-camera-tile>`
        : html`<div class="off"><div><sw-icon name=${cam.state === 'forbidden' ? 'lock' : 'offline'} size=${22}></sw-icon><div>${reason}</div></div></div>`}
      <div class="statusrow">
        <sw-badge kind=${cam.state}></sw-badge>
        <span>${this.floor.name} · ${cam.source}</span>
      </div>
      ${reason && canView ? html`<div class="warn">${reason}</div>` : nothing}
    `;
  }

  private cameraFooter(cam: DemoCamera) {
    const canView = cam.state === 'live' || cam.state === 'stale';
    return html`
      <sw-button variant="primary" size="sm" icon="expand" ?disabled=${!canView} @click=${() => navigate(`/live/cameras/${cam.id}`)}>צפייה חיה</sw-button>
      <sw-button size="sm" icon="history" ?disabled=${cam.state === 'forbidden'} @click=${() => navigate('/investigate/playback')}>${t('camera.recordings')}</sw-button>
      <sw-button variant="ghost" size="sm" iconOnly icon="pin" label=${this.pinned ? t('camera.unpin') : t('camera.pin')} @click=${() => (this.pinned = !this.pinned)}></sw-button>
    `;
  }

  private entityBody(ent: DemoEntity) {
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

  private entityFooter(ent: DemoEntity) {
    const stale = this.screenState === 'stale';
    return html`
      <sw-button variant="primary" size="sm" ?disabled=${!ent.controllable || stale}>${t('entity.control')}</sw-button>
      <sw-button variant="ghost" size="sm">${t('entity.openInHa')}</sw-button>
    `;
  }

  private renderCard() {
    if (!this.selectedId) return nothing;
    const cam = demoCameras.find((c) => c.id === this.selectedId);
    const ent = cam ? undefined : demoEntities.find((e) => e.id === this.selectedId);
    if (!cam && !ent) return nothing;
    const heading = cam ? cam.name : ent!.name;
    const sub = cam ? `${this.floor.name} · ${cam.source}` : `${this.floor.name} · ${t(ent!.domain === 'lock' ? 'entity.door' : ent!.domain === 'light' ? 'entity.light' : 'entity.sensor')}`;
    const body = cam ? this.cameraBody(cam) : this.entityBody(ent!);
    const footer = cam ? this.cameraFooter(cam) : this.entityFooter(ent!);
    if (this.narrow || !this.anchor) {
      return html`<sw-drawer open heading=${heading} subheading=${sub} @close=${this.close}>${body}<div slot="footer">${footer}</div></sw-drawer>`;
    }
    const w = this.stage?.clientWidth ?? 0;
    const h = this.stage?.clientHeight ?? 0;
    return html`<sw-popover heading=${heading} .x=${this.anchor.x} .y=${this.anchor.y} .stageWidth=${w} .stageHeight=${h} @close=${this.close}>${body}<div slot="footer">${footer}</div></sw-popover>`;
  }

  private renderStage() {
    const floor = this.floor;
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
    if (this.screenState === 'empty' || !floor.hasPlan) {
      return html`<div class="cover">
        <sw-state-panel state="empty" heading=${t('floor.noPlan')} hint=${t('floor.noPlanHint')}>
          <div style="display:flex;gap:8px;margin-block-start:10px;justify-content:center;flex-wrap:wrap">
            <sw-button variant="primary" icon="upload" @click=${() => navigate(`/explore/floors/${floor.id}/import`)}>${t('floor.uploadPlan')}</sw-button>
            <sw-button icon="list">${t('floor.listView')}</sw-button>
          </div>
        </sw-state-panel>
      </div>`;
    }
    return html`
      ${this.screenState === 'stale' || this.screenState === 'partial'
        ? html`<div class="banner"><sw-state-panel compact state=${this.screenState}></sw-state-panel></div>`
        : nothing}
      <sw-plan-canvas
        .planWidth=${floor.planWidth}
        .planHeight=${floor.planHeight}
        .plan=${demoPlan(floor.id)}
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
    const floor = this.floor;
    return html`
      <div class="head">
        <div>
          <div class="crumbs">
            <a href="#/explore/sites">${demoSite.name}</a><sw-icon name="chevron" size=${11}></sw-icon>
            <a href="#/explore/buildings/bld-a/floors">${demoSite.building}</a><sw-icon name="chevron" size=${11}></sw-icon>
            <span>${floor.name}</span>
          </div>
          <h1>${demoSite.building} – ${floor.name}</h1>
          <div class="sub">${floor.cameraCount} מצלמות · ${floor.entityCount} ישויות HA · נתוני הדגמה</div>
        </div>
        <div class="spacer"></div>
        <div class="tools">
          <div class="layers" role="group" aria-label=${t('floor.layers')}>
            ${LAYERS.map((l) => html`<button class=${this.layers.has(l.id) ? 'on' : ''} title=${l.label()} aria-label=${l.label()} aria-pressed=${this.layers.has(l.id)} @click=${() => this.toggleLayer(l.id)}><sw-icon name=${l.icon} size=${14}></sw-icon></button>`)}
          </div>
          <sw-field><select aria-label=${t('floor.switcher')} @change=${(e: Event) => navigate(`/explore/floors/${(e.target as HTMLSelectElement).value}`)}>${demoFloors.map((f) => html`<option value=${f.id} ?selected=${f.id === this.floorId}>${f.name} · ${f.cameraCount} מצלמות</option>`)}</select></sw-field>
          <sw-button icon="edit" @click=${() => navigate(`/explore/floors/${floor.id}/edit`)}>עריכת תוכנית</sw-button>
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
