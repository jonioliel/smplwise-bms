import { LitElement, html, css, nothing } from 'lit';
import { customElement, property, state } from 'lit/decorators.js';
import '../components/sw-button';
import '../components/sw-badge';
import '../components/sw-card';
import '../components/sw-chip';
import '../components/sw-drawer';
import '../components/sw-icon';
import '../components/sw-state-panel';
import '../map/sw-plan-canvas';
import type { PlanMarker } from '../map/sw-plan-canvas';
import type { StateKind } from '../components/sw-badge';
import { demoCameras, demoEntities, demoFloors, demoPlan, demoSite, type DemoCamera, type DemoEntity } from '../fixtures/demo';
import { t } from '../i18n/he';
import { navigate } from '../router';

type ScreenState = 'ready' | 'loading' | 'empty' | 'error' | 'forbidden' | 'stale' | 'partial';
type Layer = 'cameras' | 'doors' | 'lights' | 'sensors';

/** SC04 — live floor map (skeleton on fixtures; real data arrives with T019/T022/T025). */
@customElement('explore-floor-map')
export class ExploreFloorMap extends LitElement {
  @property() floorId = 'f0';
  @property() screenState: ScreenState = 'ready';

  @state() private selectedId: string | null = null;
  @state() private layers = new Set<Layer>(['cameras', 'doors', 'lights', 'sensors']);
  @state() private pinned = false;

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
      padding: var(--sw-s-3) var(--sw-s-4);
    }
    .crumbs {
      display: flex;
      align-items: center;
      gap: var(--sw-s-1);
      color: var(--sw-text-2);
      font-size: var(--sw-fs-sm);
      min-inline-size: 0;
    }
    .crumbs strong {
      color: var(--sw-text);
      font-size: var(--sw-fs-xl);
      font-weight: var(--sw-fw-semibold);
    }
    .crumbs sw-icon {
      color: var(--sw-text-3);
    }
    .group {
      display: flex;
      align-items: center;
      gap: var(--sw-s-2);
      flex-wrap: wrap;
    }
    .spacer {
      flex: 1;
    }
    .stage {
      position: relative;
      flex: 1;
      min-block-size: 360px;
      margin: 0 var(--sw-s-4) var(--sw-s-4);
      border: 1px solid var(--sw-border);
      border-radius: var(--sw-r-lg);
      background: var(--sw-surface);
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
      --sw-surface-3: transparent;
    }
    .cover {
      position: absolute;
      inset: 0;
      display: grid;
      place-items: center;
      background: var(--sw-surface);
      z-index: var(--sw-z-map-ui);
    }
    .preview {
      aspect-ratio: 16 / 9;
      background: var(--sw-video-bg);
      border-radius: var(--sw-r-md);
      display: grid;
      place-items: center;
      color: var(--sw-text-inverse);
      position: relative;
      overflow: hidden;
      text-align: center;
      padding: var(--sw-s-3);
      font-size: var(--sw-fs-sm);
    }
    .preview .tag {
      position: absolute;
      inset-inline-start: var(--sw-s-2);
      inset-block-start: var(--sw-s-2);
    }
    .preview.off {
      background: var(--sw-surface-3);
      color: var(--sw-text-2);
    }
    .meta {
      display: grid;
      grid-template-columns: auto 1fr;
      gap: var(--sw-s-2) var(--sw-s-4);
      font-size: var(--sw-fs-sm);
    }
    .meta dt {
      color: var(--sw-text-2);
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
    @media (max-width: 767px) {
      .head {
        padding: var(--sw-s-2) var(--sw-s-3);
        gap: var(--sw-s-2);
      }
      /* One scrollable row per chip group keeps the map tall on phones. */
      .group {
        flex-wrap: nowrap;
        overflow-x: auto;
        max-inline-size: 100%;
        scrollbar-width: none;
        padding-block: 2px;
      }
      .group::-webkit-scrollbar {
        display: none;
      }
      .spacer {
        display: none;
      }
      .stage {
        margin: 0;
        border-radius: 0;
        border-inline: 0;
      }
      .crumbs strong {
        font-size: var(--sw-fs-lg);
      }
    }
  `;

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

  private onSelect(e: CustomEvent<{ id: string | null }>) {
    this.selectedId = e.detail.id;
  }

  private renderCameraDrawer(cam: DemoCamera) {
    const reason =
      cam.state === 'offline' ? t('camera.offlineReason') : cam.state === 'forbidden' ? t('camera.forbiddenReason') : cam.state === 'stale' ? t('camera.staleReason') : '';
    const canView = cam.state === 'live' || cam.state === 'stale';
    return html`
      <sw-drawer open heading=${cam.name} subheading=${`${this.floor.name} · ${cam.source}`} @close=${() => (this.selectedId = null)}>
        <div class="preview ${canView ? '' : 'off'}">
          <sw-badge class="tag" kind=${cam.state}></sw-badge>
          ${canView
            ? html`<span>${t('camera.preview')}: הזרם יתחבר ל־go2rtc במשימה T017</span>`
            : html`<sw-icon name=${cam.state === 'forbidden' ? 'lock' : 'offline'} size=${28}></sw-icon><span>${reason}</span>`}
        </div>
        <dl class="meta">
          <dt>${t('breadcrumb.floor')}</dt><dd>${this.floor.name}</dd>
          <dt>${t('camera.source')}</dt><dd>${cam.source}</dd>
          <dt>${t('camera.timeSource')}</dt><dd>NVR · <span class="ltr">Asia/Jerusalem</span></dd>
          <dt>${t('camera.quality')}</dt><dd>${t('camera.main')} / ${t('camera.sub')}</dd>
        </dl>
        ${reason && canView ? html`<div class="warn">${reason}</div>` : nothing}
        <div slot="footer">
          <sw-button variant="primary" icon="expand" ?disabled=${!canView}>${t('camera.enlarge')}</sw-button>
          <sw-button icon="history" ?disabled=${cam.state === 'forbidden'}>${t('camera.recordings')}</sw-button>
          <sw-button variant="ghost" icon="pin" @click=${() => (this.pinned = !this.pinned)}>${this.pinned ? t('camera.unpin') : t('camera.pin')}</sw-button>
        </div>
      </sw-drawer>
    `;
  }

  private renderEntityDrawer(ent: DemoEntity) {
    const stale = this.screenState === 'stale';
    const kind: StateKind = stale ? 'stale' : ent.state === 'on' || ent.state === 'unlocked' ? 'live' : 'neutral';
    return html`
      <sw-drawer open heading=${ent.name} subheading=${`${this.floor.name} · ${t(ent.domain === 'lock' ? 'entity.door' : ent.domain === 'light' ? 'entity.light' : 'entity.sensor')}`} @close=${() => (this.selectedId = null)}>
        <dl class="meta">
          <dt>${t('entity.state')}</dt><dd><sw-badge kind=${kind} label=${t(ent.stateLabelKey)}></sw-badge></dd>
          <dt>${t('entity.lastChanged')}</dt><dd>${ent.lastChanged}</dd>
          <dt>ID</dt><dd><span class="ltr">${ent.id}</span></dd>
        </dl>
        ${stale ? html`<div class="warn">${t('states.staleHint')}</div>` : nothing}
        ${!ent.controllable ? html`<div class="note">${t('entity.noControl')}</div>` : nothing}
        <div slot="footer">
          <sw-button variant="primary" ?disabled=${!ent.controllable || stale}>${t('entity.control')}</sw-button>
          <sw-button variant="ghost">${t('entity.openInHa')}</sw-button>
        </div>
      </sw-drawer>
    `;
  }

  private renderDrawer() {
    if (!this.selectedId) return nothing;
    const cam = demoCameras.find((c) => c.id === this.selectedId);
    if (cam) return this.renderCameraDrawer(cam);
    const ent = demoEntities.find((e) => e.id === this.selectedId);
    return ent ? this.renderEntityDrawer(ent) : nothing;
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
            <sw-button variant="primary" icon="upload">${t('floor.uploadPlan')}</sw-button>
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
        @marker-select=${this.onSelect}></sw-plan-canvas>
      ${this.renderDrawer()}
    `;
  }

  render() {
    const floor = this.floor;
    return html`
      <div class="head">
        <div class="crumbs">
          <span>${demoSite.name}</span><sw-icon name="chevron" size=${14}></sw-icon>
          <span>${demoSite.building}</span><sw-icon name="chevron" size=${14}></sw-icon>
          <strong>${floor.name}</strong>
        </div>
        <div class="group" role="group" aria-label=${t('floor.switcher')}>
          ${demoFloors.map(
            (f) => html`<sw-chip icon="floor" ?selected=${f.id === this.floorId} count=${f.cameraCount} @click=${() => navigate(`/explore/floors/${f.id}`)}>${f.name}</sw-chip>`,
          )}
        </div>
        <div class="spacer"></div>
        <div class="group" role="group" aria-label=${t('floor.layers')}>
          <sw-chip icon="camera" ?selected=${this.layers.has('cameras')} @click=${() => this.toggleLayer('cameras')}>${t('floor.cameras')}</sw-chip>
          <sw-chip icon="door" ?selected=${this.layers.has('doors')} @click=${() => this.toggleLayer('doors')}>${t('floor.doors')}</sw-chip>
          <sw-chip icon="light" ?selected=${this.layers.has('lights')} @click=${() => this.toggleLayer('lights')}>${t('floor.lights')}</sw-chip>
          <sw-chip icon="sensor" ?selected=${this.layers.has('sensors')} @click=${() => this.toggleLayer('sensors')}>${t('floor.sensors')}</sw-chip>
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
