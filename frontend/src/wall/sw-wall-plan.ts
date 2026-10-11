import { LitElement, css, html, nothing, type PropertyValues } from 'lit';
import { customElement, property, state } from 'lit/decorators.js';
import { loadMap, type MapBundle } from '../api/maps';
import { geometryFor } from '../api/geometry';
import { loadLibrary, lookup3dOf, lookupMaterialsOf } from '../api/plan-catalog';
import { DEFAULT_VIEW, planViewPrefs, type PlanViewDials } from '../api/plan-view';
import type { GeometryDoc } from '../map/geometry';
import type { Catalog3DLookup, SceneDescription } from '../map/scene-builder';
import type { CatalogMaterialLookup } from '../map/material-resolve';
import { layerSignature, type RoomStateLayer } from '../map/room-state';
import { viewMode } from '../map/quality-ladder';
import { planChangeKey } from '../map/plan-change-key';
import { readWallPins, resolveWallPlan, type WallPlanSetting } from '../map/wall-plan-mode';
import { skinOf, themeScope } from '../map/theme-scope';
import { resolveSite, type ResolvedSite } from '../map/sun';
import { webglAvailable } from '../map/webgl';
import { hasStills, renderStills, stillsLevel } from '../screens/floor-stills';
import { wallCircuitStates, wallLevel, wallRoomStates, wallScene } from './wall-plan-scene';

/** The map band refreshes the floor's circuit switches (and a new publish or a new set of stills) this often. */
const REFRESH_MS = 30_000;

/**
 * CR-029 S5-B (docs/changes/CR-029-ST7-S5B-NOTES.md), the plan in the map band of a portrait wall display (CR-030 `show_map`): the slot
 * `sw-wall` reserved for Studio 6. It draws the floor of the wall's profile - the live 3D in the bare kiosk view, or the baked stills
 * (zero WebGL frames) - by the screen's own plan setting (mode, quality, idle time; map/wall-plan-mode.ts: the screen > this browser's
 * pin > the installation's dials). A live view idles into the baked still after the idle time and wakes on a touch or when a lamp's
 * circuit changes (sw-plan-3d idleS); a hidden tab draws no frames. The plan takes the wall's theme, not the installation's scheme.
 * Nothing in it is operated: no pins, no cameras, no selection. A wall user holds no entity states, so the lit rooms come from the
 * floor's circuits (wall-plan-scene.ts); the band stays an empty surface until the floor loads, and on any failure - a wall never
 * explains itself. Loaded by `sw-wall` on demand, so the 3D chunk is fetched only when a live view is drawn.
 */
@customElement('sw-wall-plan')
export class SwWallPlan extends LitElement {
  @property() floorId: string | null = null;
  @property({ attribute: false }) plan: Partial<WallPlanSetting> | undefined;
  /** The wall's theme: dark / light force the plan's colours and the stills' style; follow keeps the installation's scheme. */
  @property() theme: 'dark' | 'light' | 'follow' = 'follow';
  @state() private bundle: MapBundle | null = null;
  @state() private geometry: GeometryDoc | null = null;
  @state() private catalog3d: Catalog3DLookup | null = null;
  @state() private materials: CatalogMaterialLookup | null = null;
  @state() private dials: PlanViewDials = { ...DEFAULT_VIEW };
  /** Where the sun stands (the home's location, map/sun.ts resolveSite): the idle still's time band follows it. */
  @state() private site: ResolvedSite = resolveSite(null);
  @state() private threeReady = false;
  /** The live ladder ran out on this device (the element's `stills-fallback`): the still set takes over for good. */
  @state() private exhausted = false;
  @state() private real = false;
  private seq = 0;
  private timer = 0;
  private threeAsked = false;
  private sceneMemo: { key: string; desc: SceneDescription | null } | null = null;

  static styles = css`
    :host {
      display: block;
      position: absolute;
      inset: 0;
    }
    .fill {
      position: absolute;
      inset: 0;
    }
    sw-plan-3d,
    sw-plan-stills {
      position: absolute;
      inset: 0;
      inline-size: 100%;
      block-size: 100%;
      min-block-size: 0;
    }
  `;

  connectedCallback(): void {
    super.connectedCallback();
    this.timer = window.setInterval(() => void this.refresh(), REFRESH_MS);
  }

  disconnectedCallback(): void {
    super.disconnectedCallback();
    window.clearInterval(this.timer);
    this.timer = 0;
    this.seq++; // an answer still on its way is dropped
  }

  protected willUpdate(changed: PropertyValues<this>): void {
    if (changed.has('floorId')) void this.load();
    // the live view needs the 3D element's module (and three with it); fetched once, only when a live view is wanted
    if (!this.threeAsked && this.decide().mode === 'live') {
      this.threeAsked = true;
      void import('../map/sw-plan-3d').then(() => (this.threeReady = true)).catch(() => (this.exhausted = true));
    }
  }

  private async load(): Promise<void> {
    const id = this.floorId;
    const seq = ++this.seq;
    this.sceneMemo = null;
    if (!id) {
      this.bundle = null;
      return;
    }
    try {
      const [b, prefs] = await Promise.all([loadMap(id), planViewPrefs()]);
      if (seq !== this.seq) return;
      this.dials = prefs.effective;
      this.site = resolveSite(prefs.location);
      const [geometry, lib] = await Promise.all([geometryFor(b), loadLibrary(b.catalogRevision).catch(() => null)]);
      if (seq !== this.seq) return;
      this.geometry = geometry;
      this.catalog3d = lib ? lookup3dOf(lib) : null;
      this.materials = lib ? lookupMaterialsOf(lib) : null;
      this.bundle = b;
    } catch {
      /* the band stays as it is: an empty surface (or the last good picture) */
    }
  }

  /** A quiet re-read of the floor: new circuit states, a new set of stills, a new publish. Nothing changes (no render) when the
   * answer says the same. A hidden tab does not ask. */
  private async refresh(): Promise<void> {
    const id = this.floorId;
    const old = this.bundle;
    if (!id || !old || document.hidden) return;
    const seq = this.seq;
    try {
      const b = await loadMap(id);
      if (seq !== this.seq || !this.isConnected) return;
      if (b.geometryRef?.doc_hash !== old.geometryRef?.doc_hash || b.planVersionId !== old.planVersionId) {
        void this.load(); // a new publish: the structure document too
        return;
      }
      const sig = (x: MapBundle): string => JSON.stringify([x.circuitStates, x.bakes]);
      if (sig(b) !== sig(old)) this.bundle = b;
    } catch {
      /* the next tick asks again */
    }
  }

  /** What to draw now: the effective plan (screen > browser pin > installation) and the view it asks for. */
  private decide() {
    const b = this.bundle;
    const level = b ? wallLevel(b) : null;
    const stills = !!b && hasStills(b, stillsLevel(b, level));
    const plan = resolveWallPlan(this.plan, readWallPins(), this.dials);
    const mode = b ? viewMode({ webgl: webglAvailable(), wallDisplay: true, wallMode: plan.mode, idle: false, exhausted: this.exhausted, hasStills: stills, want3d: true }) : '2d';
    return { b, level, stills, plan, mode };
  }

  private layer(b: MapBundle): RoomStateLayer | null {
    return wallRoomStates(b, this.geometry, Date.now());
  }

  private scene(b: MapBundle, level: string | null, layer: RoomStateLayer | null): SceneDescription | null {
    const key = [b.floorId, b.planVersionId, b.geometryRef?.doc_hash, level, this.real, JSON.stringify(wallCircuitStates(b)), layerSignature(layer), this.catalog3d ? 1 : 0].join('|');
    if (this.sceneMemo?.key === key) return this.sceneMemo.desc;
    const desc = wallScene({ bundle: b, geometry: this.geometry, catalog3d: this.catalog3d, materials: this.materials }, { level, realistic: this.real, layer });
    this.sceneMemo = { key, desc };
    return desc;
  }

  protected render() {
    const { b, level, stills, plan, mode } = this.decide();
    if (!b) return nothing;
    const forced = this.theme === 'dark' || this.theme === 'light' ? this.theme : null;
    const scope = forced ? themeScope(forced, skinOf(document.documentElement)) : '';
    const layer = this.layer(b);
    const lvl = stillsLevel(b, level);
    const dials = forced ? { ...this.dials, style: forced } : this.dials;
    if (mode === 'stills' || (mode === 'live' && !this.threeReady && stills)) {
      return html`<div class="fill" style=${scope} data-wall-plan="stills">${renderStills(b, lvl, layer, dials, new Date(), { autoBand: true, site: this.site })}</div>`;
    }
    if (mode !== 'live' || !this.threeReady) return nothing;
    const desc = this.scene(b, level, layer);
    if (!desc) return nothing;
    const key = planChangeKey({ layer, circuits: wallCircuitStates(b), cameras: {} });
    return html`<div class="fill" style=${scope} data-wall-plan="live">
      <sw-plan-3d kiosk data-wall-plan-3d .description=${desc} .frameKey=${b.floorId} .activeLevel=${level} .stillsAvailable=${stills}
        .qualityForce=${plan.quality} .idleS=${plan.idleS} .changeKey=${key} .themeForce=${forced}
        @realistic-change=${(e: CustomEvent<{ on: boolean }>) => { if (this.real !== e.detail.on) this.real = e.detail.on; }}
        @stills-fallback=${() => { this.exhausted = true; }}>
        ${stills ? renderStills(b, lvl, layer, dials, new Date(), { slot: 'idle-still', autoBand: true, site: this.site }) : nothing}
      </sw-plan-3d>
    </div>`;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'sw-wall-plan': SwWallPlan;
  }
}
