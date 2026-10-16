import { LitElement, html, css, nothing, type PropertyValues, type TemplateResult } from 'lit';
import { customElement, property, state } from 'lit/decorators.js';
import '../components/sw-dialog';
import { automationsStyles } from '../styles/automations-glass';
import { applyAutomationsGlass } from '../api/automations-demo';
import { SkinController } from '../design/skin';
import { bubbleChrome } from '../styles/bubble-chrome';
import { bidi } from '../i18n/bidi';
import { describeError } from '../api/client';
import { loadTree } from '../api/catalog';
import { loadMap, type MapBundle } from '../api/maps';
import { geometryFor } from '../api/geometry';
import { mapHref, ticketsMapApi, type MapElementAnswer, type MapElementPick } from '../api/tickets-map';
import { mapLine, nearestElement, pickerElements, pickOf, type PickerElement } from './map-picker-model';
import { tIcon } from './icons';
import { ticketDetailStyles, ticketFormStyles } from './styles';
import { MAP_TEXT } from './map-text';

export { MAP_TEXT };


const TYPE_ICON: Record<PickerElement['type'], 'camera' | 'flag' | 'grid'> = { camera: 'camera', ha_entity: 'flag', object: 'grid' };

/**
 * TKMAP1 `<ticket-map-element .ticketId>`: the request's map line in the Overview tab - the element's name · floor · room, "הצג במפה"
 * (the live map with the element focused), "מה הספק רואה" (the very picture the vendor page shows), and for a manager or the creator
 * "הוסף רכיב מהמפה" / "החלף רכיב" / "הסר". Self-contained (its own load and its own picker), so `<ticket-detail>` only places it.
 * Renders nothing while the request has no element and the caller cannot add one.
 */
@customElement('ticket-map-element')
export class TicketMapElement extends LitElement {
  readonly bubbleSkin = new SkinController(this);
  @property({ attribute: false }) ticketId = '';
  @state() private answer: MapElementAnswer | null = null;
  @state() private picking = false;
  @state() private preview = false;
  @state() private busy = false;
  @state() private error = '';
  @state() private note = '';

  static styles = [bubbleChrome, ...automationsStyles, ticketDetailStyles, css`
    :host { display: block; }
    .mline { display: flex; flex-wrap: wrap; align-items: center; gap: 8px; }
    .mline .what { display: inline-flex; align-items: center; gap: 6px; font-weight: 600; color: var(--dv-text-1); }
    .acts { display: flex; flex-wrap: wrap; gap: 6px; margin-block-start: 8px; }
    .acts a.btn { text-decoration: none; }
    .gone { color: var(--dv-text-2); font-size: var(--sw-fs-sm); }
    .pv { margin-block-start: 10px; border: 1px solid var(--dv-border); border-radius: var(--sw-r-lg); overflow: hidden; background: #fff; }
    .pv img { display: block; inline-size: 100%; block-size: auto; }
    .err { color: var(--dv-bad-text, #b42318); font-size: var(--sw-fs-sm); }
    .ok { color: var(--dv-text-2); font-size: var(--sw-fs-sm); }
  `];

  connectedCallback(): void {
    super.connectedCallback();
    applyAutomationsGlass(this);
  }

  protected willUpdate(changed: PropertyValues<this>): void {
    if (changed.has('ticketId') && this.ticketId) {
      this.answer = null;
      this.preview = false;
      this.note = '';
      void this.load();
    }
  }

  private async load(): Promise<void> {
    const id = this.ticketId;
    try {
      const a = await ticketsMapApi.get(id);
      if (id === this.ticketId) this.answer = a;
    } catch {
      if (id === this.ticketId) this.answer = null; // the line is optional: a failed read hides it rather than breaking the drawer
    }
  }

  private async run(fn: () => Promise<MapElementAnswer>, done: string): Promise<void> {
    if (this.busy) return;
    this.busy = true;
    this.error = '';
    try {
      this.answer = await fn();
      this.note = done;
      this.dispatchEvent(new CustomEvent('map-element-changed', { bubbles: true, composed: true }));
    } catch (e) {
      this.error = describeError(e);
    } finally {
      this.busy = false;
    }
  }

  private onPicked = (ev: CustomEvent<{ pick: MapElementPick; name: string; floorName: string }>) => {
    this.picking = false;
    void this.run(() => ticketsMapApi.attach(this.ticketId, ev.detail.pick, ev.detail), MAP_TEXT.attached);
  };

  render(): TemplateResult | typeof nothing {
    const a = this.answer;
    if (!a || (!a.element && !a.can.attach)) return nothing;
    const e = a.element;
    const line = e ? mapLine(e) : null;
    const href = e ? mapHref(e) : null;
    return html`<section class="sect" data-sect="map" data-map-element=${e ? (e.present ? 'present' : 'gone') : 'none'}>
      <h4><span class="tag">${tIcon('layers')}</span>${MAP_TEXT.section}</h4>
      ${e && line ? html`<div class="mline"><span class="what" data-map-line>${tIcon(TYPE_ICON[e.type])}${bidi(line.text)}</span></div>
        ${line.gone ? html`<div class="gone" data-map-gone>${MAP_TEXT.gone}</div>` : nothing}` : nothing}
      <div class="acts">
        ${href ? html`<a class="btn" href=${href} data-map-show>${tIcon('eye')}${MAP_TEXT.show}</a>` : nothing}
        ${e && line?.vendorImage ? html`<button type="button" class="btn" data-map-preview aria-pressed=${String(this.preview)} @click=${() => (this.preview = !this.preview)}>${tIcon('image')}${this.preview ? MAP_TEXT.vendorPreviewHide : MAP_TEXT.vendorPreview}</button>` : nothing}
        ${a.can.attach ? html`<button type="button" class="btn" data-map-pick ?disabled=${this.busy} @click=${() => (this.picking = true)}>${tIcon(e ? 'edit' : 'plus')}${e ? MAP_TEXT.replace : MAP_TEXT.add}</button>` : nothing}
        ${a.can.detach ? html`<button type="button" class="btn" data-map-remove ?disabled=${this.busy} @click=${() => void this.run(() => ticketsMapApi.detach(this.ticketId), MAP_TEXT.removed)}>${tIcon('trash')}${MAP_TEXT.remove}</button>` : nothing}
      </div>
      ${e && !line?.vendorImage && !line?.gone ? html`<div class="gone" data-map-vendor-text>${MAP_TEXT.vendorNoImage}</div>` : nothing}
      ${this.preview && e?.vendor_image ? html`<figure class="pv" style="margin:10px 0 0" data-map-preview-image><img src=${ticketsMapApi.vendorPreviewUrl(this.ticketId)} alt=${line?.text ?? ''} loading="lazy" decoding="async" /></figure>` : nothing}
      ${this.error ? html`<div class="err" role="alert" data-map-error>${this.error}</div>` : this.note ? html`<div class="ok" role="status" data-map-note>${this.note}</div>` : nothing}
      ${this.picking ? html`<ticket-map-picker open @map-picked=${this.onPicked} @close=${() => (this.picking = false)}></ticket-map-picker>` : nothing}
    </section>`;
  }
}

interface FloorOption {
  id: string;
  label: string;
  hasPlan: boolean;
}

/**
 * TKMAP1 `<ticket-map-picker open>`: choose a floor, then click an element on its map (the floor's drawing with its cameras, devices and
 * plan objects as dots); "צרף לבקשה" sends `map-picked` {pick, name, floorName}. The map data is the live map's own (GET /floors/{id}/map
 * and its published structure), so only what the caller may see on that map is offered; the server checks again on attach.
 */
@customElement('ticket-map-picker')
export class TicketMapPicker extends LitElement {
  readonly bubbleSkin = new SkinController(this);
  @property({ type: Boolean }) open = false;
  /** a floor to start on (the request's floor) */
  @property({ attribute: false }) floorId = '';
  @state() private floors: FloorOption[] | null = null;
  @state() private floor = '';
  @state() private bundle: MapBundle | null = null;
  @state() private elements: PickerElement[] = [];
  @state() private chosen: PickerElement | null = null;
  @state() private loading = false;
  @state() private error = '';

  static styles = [bubbleChrome, ...automationsStyles, ticketDetailStyles, ticketFormStyles, css`
    sw-dialog { --sw-surface: var(--dv-surface-solid); --sw-glass-blur: none; }
    .stage { position: relative; inline-size: 100%; border: 1px solid var(--dv-border); border-radius: var(--sw-r-lg); overflow: hidden; background: #fff;
      direction: ltr; /* map geometry is never mirrored by RTL */ cursor: crosshair; touch-action: manipulation; }
    .stage img { display: block; inline-size: 100%; block-size: auto; user-select: none; -webkit-user-drag: none; pointer-events: none; }
    .stage svg { position: absolute; inset: 0; inline-size: 100%; block-size: 100%; }
    .dot { cursor: pointer; }
    .hint, .state { color: var(--dv-text-2); font-size: var(--sw-fs-sm); }
    .chosen { display: flex; align-items: center; gap: 6px; font-weight: 600; }
    .err { color: var(--dv-bad-text, #b42318); font-size: var(--sw-fs-sm); }
    .list { display: flex; flex-wrap: wrap; gap: 6px; max-block-size: 132px; overflow: auto; }
    .list button[aria-pressed='true'] { outline: 2px solid var(--dv-accent, #2f6bff); }
  `];

  connectedCallback(): void {
    super.connectedCallback();
    applyAutomationsGlass(this);
  }

  protected willUpdate(changed: PropertyValues<this>): void {
    if (changed.has('open') && this.open && this.floors === null) void this.loadFloors();
  }

  private async loadFloors(): Promise<void> {
    try {
      const tree = await loadTree();
      const many = tree.sites.reduce((n, s) => n + (s.buildings ?? []).length, 0) > 1;
      this.floors = tree.sites.flatMap((s) => (s.buildings ?? []).flatMap((b) => [...(b.floors ?? [])].sort((x, y) => y.level - x.level)
        .map((f) => ({ id: f.id, label: many ? `${b.name} · ${f.name}` : f.name, hasPlan: f.has_plan }))));
      const start = this.floors.find((f) => f.id === this.floorId) ?? this.floors.find((f) => f.hasPlan) ?? this.floors[0];
      if (start) await this.pickFloor(start.id);
    } catch (e) {
      this.floors = [];
      this.error = describeError(e);
    }
  }

  private async pickFloor(id: string): Promise<void> {
    this.floor = id;
    this.chosen = null;
    this.bundle = null;
    this.elements = [];
    this.error = '';
    this.loading = true;
    try {
      const b = await loadMap(id);
      if (this.floor !== id) return;
      const doc = await geometryFor(b);
      if (this.floor !== id) return;
      this.bundle = b;
      this.elements = pickerElements(b.anchors, (doc?.objects ?? []) as never, (o) => (o.label && o.label.trim()) || o.item_id);
    } catch (e) {
      this.error = describeError(e);
    } finally {
      this.loading = false;
    }
  }

  private onStageClick = (ev: MouseEvent) => {
    const b = this.bundle;
    const el = ev.currentTarget as HTMLElement;
    if (!b) return;
    const r = el.getBoundingClientRect();
    if (!r.width || !r.height) return;
    const x = (ev.clientX - r.left) / r.width;
    const y = (ev.clientY - r.top) / r.height;
    const hit = nearestElement(this.elements, x, y, b.width / b.height, 0.035);
    if (hit) this.chosen = hit;
  };

  private save(): void {
    const c = this.chosen;
    const f = this.floors?.find((x) => x.id === this.floor);
    if (!c || !this.floor) return;
    this.dispatchEvent(new CustomEvent('map-picked', { detail: { pick: pickOf(this.floor, c), name: c.name, floorName: f?.label ?? '' }, bubbles: true, composed: true }));
  }

  private stage(): TemplateResult {
    const b = this.bundle!;
    const r = Math.max(b.width, b.height) * 0.011;
    const color = (e: PickerElement) => (e.type === 'camera' ? '#2f6bff' : e.type === 'ha_entity' ? '#16a34a' : '#7b8794');
    return html`<div class="stage" data-map-stage style=${`aspect-ratio:${b.width} / ${b.height}`} @click=${this.onStageClick}>
      ${b.imageUrl ? html`<img src=${b.imageUrl} alt="" />` : b.planSvg ? html`<svg viewBox=${`0 0 ${b.width} ${b.height}`} aria-hidden="true">${b.planSvg}</svg>` : nothing}
      <svg viewBox=${`0 0 ${b.width} ${b.height}`} preserveAspectRatio="none" aria-hidden="true">
        ${this.elements.map((e) => {
          const on = this.chosen?.key === e.key;
          const cx = e.x * b.width;
          const cy = e.y * b.height;
          return html`<g class="dot" data-pick-dot=${e.key}>
            ${on ? html`<circle cx=${cx} cy=${cy} r=${r * 2.2} fill="#e0443c" fill-opacity="0.18" stroke="#e0443c" stroke-width=${r * 0.35}></circle>` : nothing}
            <circle cx=${cx} cy=${cy} r=${r} fill=${on ? '#e0443c' : color(e)} stroke="#fff" stroke-width=${r * 0.3}></circle></g>`;
        })}
      </svg>
    </div>`;
  }

  render(): TemplateResult | typeof nothing {
    if (!this.open) return nothing;
    const floors = this.floors;
    const b = this.bundle;
    return html`<sw-dialog open wide heading=${MAP_TEXT.pickTitle} data-map-picker @close=${() => this.dispatchEvent(new CustomEvent('close', { bubbles: true, composed: true }))}>
      <div class="form">
        <label class="fld"><span>${MAP_TEXT.pickFloor}</span>
          <select class="inp" data-map-floor ?disabled=${!floors?.length} @change=${(ev: Event) => void this.pickFloor((ev.target as HTMLSelectElement).value)}>
            ${(floors ?? []).map((f) => html`<option value=${f.id} ?selected=${f.id === this.floor}>${bidi(f.label)}</option>`)}
          </select></label>
        ${this.loading || floors === null ? html`<div class="state" role="status" aria-busy="true" data-map-loading>${MAP_TEXT.pickLoading}</div>`
          : b && b.planStatus === 'none' ? html`<div class="state" data-map-noplan>${MAP_TEXT.pickNoPlan}</div>`
          : b ? html`${this.elements.length ? html`<div class="hint">${MAP_TEXT.pickHint}</div>` : html`<div class="state" data-map-empty>${MAP_TEXT.pickNone}</div>`}
            ${this.stage()}
            ${this.elements.length ? html`<div class="list" role="group" aria-label=${MAP_TEXT.pickHint}>${this.elements.map((e) => html`<button type="button" class="btn sm" data-pick-item=${e.key}
              aria-pressed=${String(this.chosen?.key === e.key)} @click=${() => (this.chosen = e)}>${tIcon(TYPE_ICON[e.type])}${bidi(e.name)}</button>`)}</div>` : nothing}` : nothing}
        ${this.chosen ? html`<div class="chosen" data-map-chosen>${tIcon('check')}${MAP_TEXT.pickChosen}: ${bidi(this.chosen.name)}</div>` : nothing}
        ${this.error ? html`<div class="err" role="alert">${this.error}</div>` : nothing}
      </div>
      <div slot="footer" class="sheetfoot">
        <button type="button" class="btn primary" data-map-save ?disabled=${!this.chosen} @click=${() => this.save()}>${tIcon('check')}${MAP_TEXT.pickSave}</button>
        <button type="button" class="btn" @click=${() => this.dispatchEvent(new CustomEvent('close', { bubbles: true, composed: true }))}>${MAP_TEXT.pickCancel}</button>
      </div>
    </sw-dialog>`;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'ticket-map-element': TicketMapElement;
    'ticket-map-picker': TicketMapPicker;
  }
}
