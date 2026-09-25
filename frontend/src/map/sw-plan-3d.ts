import { LitElement, html, css, nothing, type PropertyValues } from 'lit';
import { customElement, property, query, state } from 'lit/decorators.js';
import '../components/sw-button';
import '../components/sw-chip';
import { SceneView, type SceneHit, type ScenePreset } from './scene-three';
import type { SceneDescription, Vec3 } from './scene-builder';

export interface PartSelectDetail {
  id: string | null;
  kind: string | null;
}
export interface PartHoverDetail {
  id: string;
  kind: string;
  label: string;
  x: number;
  y: number;
}

const KIND_HE: Record<string, string> = { wall: 'קיר', opening: 'פתח', object: 'עצם', connector: 'מחבר', camera: 'מצלמה', entity: 'ישות', zone: 'חדר', label: 'תווית', level: 'מפלס' };

/**
 * The schematic 3D view of a floor (T087, design 10.3): a SceneView on a canvas, the presets, the export, the hover
 * label and the data attributes the tests read. The screen builds the description (scene-builder) and owns the
 * selection: `selectedId` comes in as a source id, `part-select` goes out with one. This module is loaded through a
 * dynamic import: importing it is what fetches the three chunk.
 */
@customElement('sw-plan-3d')
export class SwPlan3d extends LitElement {
  @property({ attribute: false }) description: SceneDescription | null = null;
  @property() selectedId: string | null = null;
  @property({ attribute: false }) preset: ScenePreset = 'iso';
  @property({ attribute: false }) cameras: { id: string; label: string }[] = [];
  @property({ attribute: false }) labels: Record<string, string> = {};
  @property() exportName = 'plan-3d';
  @state() private hover: PartHoverDetail | null = null;
  @state() private ready = false;
  @state() private exporting = false;
  @state() private error = '';
  @query('.stage') private stage!: HTMLDivElement;
  private view: SceneView | null = null;
  private ro?: ResizeObserver;
  /** The preset is applied once with the first description (the screen's choice), then only when the property changes:
   * a live state push replaces the description and must not snap the camera back. */
  private presetApplied = false;

  static styles = css`
    :host {
      display: block;
      position: relative;
      inline-size: 100%;
      block-size: 100%;
      min-block-size: 240px;
      background: var(--sw-map-bg);
      direction: ltr;
      overflow: hidden;
      border-radius: inherit;
    }
    .stage {
      position: absolute;
      inset: 0;
    }
    .stage canvas {
      inline-size: 100% !important;
      block-size: 100% !important;
    }
    .bar {
      position: absolute;
      inset-inline-start: 12px;
      inset-block-end: 12px;
      z-index: var(--sw-z-map-ui);
      display: flex;
      align-items: center;
      gap: 6px;
      flex-wrap: wrap;
      max-inline-size: calc(100% - 24px);
      direction: rtl;
    }
    .bar select {
      font: inherit;
      font-size: var(--sw-fs-xs);
      border: 1px solid var(--sw-border-strong);
      border-radius: 999px;
      padding: 4px 8px;
      background: var(--sw-surface);
      color: var(--sw-text);
      max-inline-size: 160px;
    }
    .tip {
      position: absolute;
      z-index: var(--sw-z-map-ui);
      pointer-events: none;
      background: var(--sw-surface);
      border: 1px solid var(--sw-border);
      border-radius: var(--sw-r-sm);
      padding: 3px 8px;
      font-size: var(--sw-fs-xs);
      color: var(--sw-text);
      box-shadow: var(--sw-shadow-1);
      direction: rtl;
      white-space: nowrap;
      transform: translate(-50%, -140%);
    }
    .note {
      position: absolute;
      inset-inline-end: 12px;
      inset-block-end: 12px;
      z-index: var(--sw-z-map-ui);
      font-size: var(--sw-fs-xs);
      color: var(--sw-text-2);
      background: var(--sw-surface);
      border: 1px solid var(--sw-border);
      border-radius: var(--sw-r-pill);
      padding: 2px 8px;
      direction: rtl;
    }
    .spinner {
      position: absolute;
      inset: 0;
      display: grid;
      place-items: center;
      font-size: var(--sw-fs-sm);
      color: var(--sw-text-2);
      background: var(--sw-surface);
    }
    .err {
      color: var(--sw-danger);
    }
    @media (max-width: 640px) {
      .bar {
        inset-inline-start: 8px;
        inset-block-end: 8px;
        gap: 4px;
      }
      .note {
        display: none;
      }
    }
  `;

  protected firstUpdated(): void {
    this.init();
  }

  connectedCallback(): void {
    super.connectedCallback();
    if (this.hasUpdated && !this.view) this.init(); // moved in the DOM: the canvas was disposed on the way out
  }

  disconnectedCallback(): void {
    super.disconnectedCallback();
    this.ro?.disconnect();
    this.view?.dispose();
    this.view = null;
  }

  private init(): void {
    try {
      this.view = new SceneView({
        mount: this.stage,
        color: (token) => getComputedStyle(this).getPropertyValue(`--sw-${token}`).trim() || '#888888',
        onSelect: (hit) => this.emitSelect(hit),
        onHover: (hit, x, y) => this.setHover(hit, x, y),
        onFrame: (frames, fps) => {
          this.setAttribute('data-frames', String(frames));
          this.setAttribute('data-fps', String(fps));
        },
      });
    } catch (err) {
      this.error = err instanceof Error ? err.message : String(err);
      return;
    }
    this.ro = new ResizeObserver(() => this.view?.resize());
    this.ro.observe(this);
    this.presetApplied = false;
    if (this.description) this.apply(this.description);
    this.ready = true;
    this.setAttribute('data-ready', '');
    this.setAttribute('data-selected', this.selectedId ?? '');
  }

  protected updated(changed: PropertyValues<this>): void {
    if (!this.view) return;
    if (changed.has('description') && this.description) this.apply(this.description);
    if (changed.has('selectedId') || changed.has('description')) {
      this.view.setSelected(this.selectedId);
      this.setAttribute('data-selected', this.selectedId ?? '');
    }
    if (changed.has('preset') && changed.get('preset') !== undefined) this.applyPreset(this.preset);
  }

  private apply(desc: SceneDescription): void {
    this.view?.setDescription(desc);
    this.setAttribute('data-parts', String(desc.parts.length));
    this.toggleAttribute('data-estimated', desc.estimated);
    if (!this.presetApplied) {
      this.applyPreset(this.preset);
      this.presetApplied = true;
    }
    this.view?.setSelected(this.selectedId);
  }

  private applyPreset(p: ScenePreset): void {
    this.view?.setPreset(p);
    this.setAttribute('data-preset', typeof p === 'string' ? p : 'camera');
  }

  private pickPreset(p: ScenePreset): void {
    this.preset = p;
    this.applyPreset(p);
  }

  private labelOf(hit: SceneHit): string {
    return this.labels[hit.id] ?? KIND_HE[hit.kind] ?? hit.id;
  }

  private emitSelect(hit: SceneHit | null): void {
    this.dispatchEvent(new CustomEvent<PartSelectDetail>('part-select', { detail: { id: hit?.id ?? null, kind: hit?.kind ?? null }, bubbles: true, composed: true }));
  }

  private setHover(hit: SceneHit | null, x: number, y: number): void {
    this.hover = hit ? { id: hit.id, kind: hit.kind, label: this.labelOf(hit), x, y } : null;
    this.dispatchEvent(new CustomEvent<PartHoverDetail | null>('part-hover', { detail: this.hover, bubbles: true, composed: true }));
  }

  /** Host pixels of a scene point (tests click through it). */
  toScreen(p: Vec3): { x: number; y: number } | null {
    return this.view?.projectPoint(p) ?? null;
  }

  async exportGltf(): Promise<Record<string, unknown>> {
    if (!this.view) throw new Error('3D view not ready');
    return this.view.exportGltf();
  }

  /** The existing download pattern (explore-plan-editor.exportJson): a Blob, an anchor with a download name, a click. */
  async download(): Promise<void> {
    if (this.exporting) return;
    this.exporting = true;
    try {
      const json = await this.exportGltf();
      const url = URL.createObjectURL(new Blob([JSON.stringify(json)], { type: 'model/gltf+json' }));
      const a = document.createElement('a');
      a.href = url;
      a.download = `${this.exportName}.gltf`;
      a.click();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    } catch (err) {
      this.error = err instanceof Error ? err.message : String(err);
    } finally {
      this.exporting = false;
    }
  }

  render() {
    const preset = typeof this.preset === 'string' ? this.preset : 'camera';
    const cameraId = typeof this.preset === 'string' ? '' : this.preset.camera.replace(/^cam:/, '');
    return html`
      <div class="stage"></div>
      ${!this.ready && !this.error ? html`<div class="spinner" data-3d-spinner>טוען תלת-ממד…</div>` : nothing}
      ${this.error ? html`<div class="spinner err" data-3d-error>${this.error}</div>` : nothing}
      <div class="bar" role="group" aria-label="תצוגות מוכנות" data-3d-bar>
        <sw-chip data-preset-top ?selected=${preset === 'top'} @click=${() => this.pickPreset('top')}>מלמעלה</sw-chip>
        <sw-chip data-preset-iso ?selected=${preset === 'iso'} @click=${() => this.pickPreset('iso')}>איזומטרי</sw-chip>
        ${this.cameras.length
          ? html`<select data-preset-camera aria-label="מבט מהמצלמה" .value=${cameraId} @change=${(e: Event) => this.onCameraChange(e)}>
              <option value="">מבט מהמצלמה…</option>
              ${this.cameras.map((c) => html`<option value=${c.id} ?selected=${c.id === cameraId}>${c.label}</option>`)}
            </select>`
          : nothing}
        <sw-button size="sm" variant="ghost" icon="download" data-export-gltf ?disabled=${!this.ready || this.exporting} @click=${() => this.download()}>${this.exporting ? 'מייצא…' : 'ייצוא glTF'}</sw-button>
      </div>
      ${this.description?.estimated ? html`<div class="note" data-3d-estimated>≈ מידות משוערות (התוכנית לא כוילה)</div>` : nothing}
      ${this.hover ? html`<div class="tip" data-3d-tip data-3d-tip-kind=${this.hover.kind} style=${`left:${this.hover.x}px;top:${this.hover.y}px`}>${this.hover.label}</div>` : nothing}
    `;
  }

  private onCameraChange(e: Event): void {
    const v = (e.target as HTMLSelectElement).value;
    if (v) this.pickPreset({ camera: `cam:${v}` });
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'sw-plan-3d': SwPlan3d;
  }
}
