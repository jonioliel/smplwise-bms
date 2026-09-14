import { LitElement, html, css, nothing } from 'lit';
import { customElement, property, state, query } from 'lit/decorators.js';
import '../components/sw-button';
import '../components/sw-badge';
import '../components/sw-card';
import '../components/sw-chip';
import '../components/sw-drawer';
import '../components/sw-popover';
import '../components/sw-icon';
import '../components/sw-toggle';
import '../components/sw-floor-glyph';
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
 * SC04 — live floor map (board 1 screen 4): breadcrumb, a side panel with the isometric floor list and
 * layer toggles, the plan with blue camera pins, and a floating camera card anchored to the selected pin
 * (bottom sheet on phones). Skeleton on fixtures; real data arrives with T019/T022/T025.
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
      align-items: center;
      gap: var(--sw-s-3);
      padding: var(--sw-s-4) var(--sw-s-5) var(--sw-s-3);
    }
    .crumbs {
      display: flex;
      align-items: center;
      gap: 6px;
      color: var(--sw-text-3);
      font-size: var(--sw-fs-sm);
      min-inline-size: 0;
    }
    .crumbs a {
      color: inherit;
      text-decoration: none;
    }
    .crumbs a:hover {
      color: var(--sw-accent-text);
    }
    .crumbs strong {
      color: var(--sw-text);
      font-size: var(--sw-fs-2xl);
      font-weight: var(--sw-fw-bold);
      letter-spacing: -0.01em;
    }
    .crumbs sw-icon {
      color: var(--sw-text-3);
    }
    .spacer {
      flex: 1;
    }
    .group {
      display: none;
      align-items: center;
      gap: var(--sw-s-2);
    }
    .body {
      flex: 1;
      display: grid;
      grid-template-columns: 250px minmax(0, 1fr);
      gap: var(--sw-s-4);
      padding: 0 var(--sw-s-5) var(--sw-s-5);
      min-block-size: 0;
    }
    .side {
      display: flex;
      flex-direction: column;
      gap: var(--sw-s-3);
      min-block-size: 0;
      overflow: auto;
    }
    .side h4 {
      margin: 0 0 8px;
      font-size: var(--sw-fs-xs);
      font-weight: var(--sw-fw-semibold);
      color: var(--sw-text-3);
      letter-spacing: 0.04em;
    }
    .floors {
      display: flex;
      flex-direction: column;
      gap: 6px;
    }
    .floor {
      display: flex;
      align-items: center;
      gap: 10px;
      padding: 8px;
      border: 1px solid transparent;
      border-radius: 10px;
      background: transparent;
      font: inherit;
      text-align: start;
      cursor: pointer;
      color: var(--sw-text);
      transition: background var(--sw-t-fast) var(--sw-ease), border-color var(--sw-t-fast) var(--sw-ease);
    }
    .floor:hover {
      background: var(--sw-surface-2);
    }
    .floor.on {
      background: var(--sw-accent-soft);
      border-color: var(--sw-accent);
    }
    .floor .n {
      font-weight: var(--sw-fw-semibold);
      font-size: var(--sw-fs-sm);
    }
    .floor .c {
      font-size: var(--sw-fs-xs);
      color: var(--sw-text-3);
    }
    .layer {
      display: flex;
      align-items: center;
      gap: 10px;
      padding: 7px 0;
      font-size: var(--sw-fs-sm);
      border-block-end: 1px solid var(--sw-border);
    }
    .layer:last-child {
      border-block-end: 0;
    }
    .layer sw-icon {
      color: var(--sw-text-2);
    }
    .layer .grow {
      flex: 1;
    }
    .legend {
      display: flex;
      flex-direction: column;
      gap: 6px;
      font-size: var(--sw-fs-xs);
      color: var(--sw-text-2);
    }
    .legend span {
      display: flex;
      align-items: center;
      gap: 8px;
    }
    .legend i {
      inline-size: 12px;
      block-size: 12px;
      border-radius: 50%;
      background: var(--lg);
      border: 2px solid #fff;
      box-shadow: 0 0 0 1px var(--sw-border-strong);
    }
    .stage {
      position: relative;
      min-block-size: 360px;
      border: 1px solid var(--sw-border);
      border-radius: var(--sw-r-lg);
      background: var(--sw-surface);
      box-shadow: var(--sw-shadow-1);
      overflow: hidden;
    }
    .banner {
      position: absolute;
      inset-inline: var(--sw-s-3);
      inset-block-start: var(--sw-s-3);
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
    .meta {
      display: grid;
      grid-template-columns: auto 1fr;
      gap: 6px var(--sw-s-3);
      font-size: var(--sw-fs-sm);
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
      font-size: var(--sw-fs-sm);
    }
    .statusrow {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 8px;
      font-size: var(--sw-fs-xs);
      color: var(--sw-text-3);
    }
    .preview {
      aspect-ratio: 16 / 9;
      background: var(--sw-surface-3);
      border-radius: var(--sw-r-sm);
      display: grid;
      place-items: center;
      color: var(--sw-text-2);
      text-align: center;
      padding: var(--sw-s-3);
      font-size: var(--sw-fs-sm);
    }
    .preview sw-icon {
      margin-block-end: 6px;
    }
    @media (max-width: 1023px) {
      .body {
        grid-template-columns: minmax(0, 1fr);
      }
      .side {
        display: none;
      }
      .group {
        display: flex;
        flex-wrap: nowrap;
        overflow-x: auto;
        max-inline-size: 100%;
        scrollbar-width: none;
        padding-block: 2px;
      }
      .group::-webkit-scrollbar {
        display: none;
      }
    }
    @media (max-width: 767px) {
      .head {
        padding: var(--sw-s-3) var(--sw-s-3) var(--sw-s-2);
        gap: var(--sw-s-2);
      }
      .spacer {
        display: none;
      }
      .body {
        padding: 0;
      }
      .stage {
        border-radius: 0;
        border-inline: 0;
        box-shadow: none;
      }
      .crumbs strong {
        font-size: var(--sw-fs-xl);
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
        ? html`<sw-camera-tile compact name=${cam.name} state=${cam.state} scene=${demoScene[cam.id] ?? 'indoor'} stamp="10:24:36" @click=${() => navigate(`/live/cameras/${cam.id}`)}></sw-camera-tile>`
        : html`<div class="preview"><div><sw-icon name=${cam.state === 'forbidden' ? 'lock' : 'offline'} size=${26}></sw-icon><div>${reason}</div></div></div>`}
      <div class="statusrow">
        <sw-badge kind=${cam.state}></sw-badge>
        <span>${this.floor.name} · ${cam.source}</span>
      </div>
      <dl class="meta">
        <dt>${t('camera.timeSource')}</dt><dd>NVR · <span class="ltr">Asia/Jerusalem</span></dd>
        <dt>${t('camera.quality')}</dt><dd>${t('camera.main')} / ${t('camera.sub')}</dd>
      </dl>
      ${reason && canView ? html`<div class="warn">${reason}</div>` : nothing}
    `;
  }

  private cameraFooter(cam: DemoCamera) {
    const canView = cam.state === 'live' || cam.state === 'stale';
    return html`
      <sw-button variant="primary" icon="live" ?disabled=${!canView} @click=${() => navigate(`/live/cameras/${cam.id}`)}>צפייה חיה</sw-button>
      <sw-button icon="history" ?disabled=${cam.state === 'forbidden'} @click=${() => navigate('/investigate/playback')}>${t('camera.recordings')}</sw-button>
      <sw-button variant="ghost" iconOnly icon="pin" label=${this.pinned ? t('camera.unpin') : t('camera.pin')} @click=${() => (this.pinned = !this.pinned)}></sw-button>
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
      <sw-button variant="primary" ?disabled=${!ent.controllable || stale}>${t('entity.control')}</sw-button>
      <sw-button variant="ghost">${t('entity.openInHa')}</sw-button>
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
          <div style="display:flex;gap:var(--sw-s-2);margin-block-start:var(--sw-s-3);justify-content:center;flex-wrap:wrap">
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
      ${this.renderCard()}
    `;
  }

  render() {
    const floor = this.floor;
    const idx = demoFloors.findIndex((f) => f.id === floor.id);
    return html`
      <div class="head">
        <div class="crumbs">
          <a href="#/explore/sites">${demoSite.name}</a><sw-icon name="chevron" size=${14}></sw-icon>
          <a href="#/explore/buildings/bld-a/floors">${demoSite.building}</a><sw-icon name="chevron" size=${14}></sw-icon>
          <strong>${floor.name}</strong>
        </div>
        <div class="spacer"></div>
        <div class="group" role="group" aria-label=${t('floor.switcher')}>
          ${demoFloors.map((f) => html`<sw-chip icon="floor" ?selected=${f.id === this.floorId} count=${f.cameraCount} @click=${() => navigate(`/explore/floors/${f.id}`)}>${f.name}</sw-chip>`)}
        </div>
        <div class="group" role="group" aria-label=${t('floor.layers')}>
          ${LAYERS.map((l) => html`<sw-chip icon=${l.icon} ?selected=${this.layers.has(l.id)} @click=${() => this.toggleLayer(l.id)}>${l.label()}</sw-chip>`)}
        </div>
        <sw-button icon="edit" @click=${() => navigate(`/explore/floors/${floor.id}/edit`)}>עריכת תוכנית</sw-button>
      </div>
      <div class="body">
        <aside class="side">
          <sw-card>
            <h4>${t('floor.switcher')}</h4>
            <div class="floors" role="group" aria-label=${t('floor.switcher')}>
              ${demoFloors.map(
                (f, i) => html`<button class="floor ${f.id === this.floorId ? 'on' : ''}" @click=${() => navigate(`/explore/floors/${f.id}`)} aria-pressed=${f.id === this.floorId}>
                  <sw-floor-glyph levels=${demoFloors.length} active=${demoFloors.length - 1 - i} ?selected=${f.id === this.floorId} size=${40}></sw-floor-glyph>
                  <div><div class="n">${f.name}</div><div class="c">${f.cameraCount} מצלמות · ${f.entityCount} ישויות${f.hasPlan ? '' : ' · אין תוכנית'}</div></div>
                </button>`,
              )}
            </div>
          </sw-card>
          <sw-card>
            <h4>${t('floor.layers')}</h4>
            ${LAYERS.map((l) => html`<div class="layer"><sw-icon name=${l.icon} size=${16}></sw-icon><span>${l.label()}</span><span class="grow"></span><sw-toggle ?checked=${this.layers.has(l.id)} label="" @change=${() => this.toggleLayer(l.id)}></sw-toggle></div>`)}
          </sw-card>
          <sw-card>
            <h4>מקרא</h4>
            <div class="legend">
              <span><i style="--lg: var(--sw-accent)"></i>מצלמה חיה</span>
              <span><i style="--lg: var(--sw-stale)"></i>מצב לא מעודכן (קו מקווקו)</span>
              <span><i style="--lg: var(--sw-offline)"></i>מנותקת (קו חוצה)</span>
              <span><i style="--lg: var(--sw-forbidden)"></i>ללא הרשאה (מנעול)</span>
              <span><i style="--lg: #fff"></i>ישות HA (דלת / תאורה / חיישן)</span>
            </div>
          </sw-card>
          ${idx >= 0 ? nothing : nothing}
        </aside>
        <div class="stage">${this.renderStage()}</div>
      </div>
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'explore-floor-map': ExploreFloorMap;
  }
}
