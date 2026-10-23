import { LitElement, html, nothing, type TemplateResult } from 'lit';
import { state } from 'lit/decorators.js';
import '../components/sw-icon';
import '../components/sw-place-tree';
import { ApiError } from '../api/client';
import { dateInputLang } from '../api/day-format';
import { isOff, type RangeId, type RangeQuery } from '../api/insights';
import { insightsAccess, onInsightsAccess, STATUS_EVENT, type InsightsAccess } from './access';
import { ALL_PLACES, customRange, placeTree, type PlaceNode } from './model';
import { ix } from '../i18n/insights';
import { SkinController } from '../design/skin';

export type ListPhase = 'loading' | 'ready' | 'error' | 'off' | 'forbidden';
const RANGES: readonly [RangeId, 'r24h' | 'r7d' | 'r30d' | 'rCustom'][] = [['24h', 'r24h'], ['7d', 'r7d'], ['30d', 'r30d'], ['custom', 'rCustom']];

/**
 * The shared frame of the two list screens (doors, waste): the range (24 hours, 7 days, 30 days, or two dates), the places tree of the
 * floors and areas (kept on every list screen: owner 2026-10-01; a chip with a picker on a phone), and the loading / error / switched-off /
 * forbidden phases. A subclass says how to fetch and which rows sit where.
 */
export abstract class InsightList<A> extends LitElement {
  readonly bubbleSkin = new SkinController(this);
  @state() protected access: InsightsAccess = insightsAccess();
  @state() protected phase: ListPhase = 'loading';
  @state() protected data: A | null = null;
  @state() protected range: RangeId = '7d';
  @state() protected from = '';
  @state() protected to = '';
  @state() protected place = ALL_PLACES;
  @state() protected collapsed: Set<string> = new Set();
  private stopAccess?: () => void;
  private seq = 0;
  private readonly redraw = () => this.requestUpdate();

  protected abstract fetchData(q: RangeQuery): Promise<A>;
  /** One entry per row of the answer, with its floor / area and its weight in the tree's counts. */
  protected abstract placed(a: A): { floor: string | null; area: string | null; w?: number }[];

  connectedCallback() {
    super.connectedCallback();
    this.stopAccess = onInsightsAccess((a) => (this.access = a));
    window.addEventListener(STATUS_EVENT, this.redraw);
    void this.load();
  }
  disconnectedCallback() {
    this.stopAccess?.();
    window.removeEventListener(STATUS_EVENT, this.redraw);
    super.disconnectedCallback();
  }

  protected async load() {
    const n = ++this.seq;
    this.phase = 'loading';
    try {
      const q: RangeQuery = this.range === 'custom' ? customRange(this.from, this.to) : { range: this.range };
      const a = await this.fetchData(q);
      if (n !== this.seq) return;
      this.data = a;
      this.phase = 'ready';
      if (!this.treeNodes().some((x) => x.id === this.place)) this.place = ALL_PLACES;
    } catch (e) {
      if (n !== this.seq) return;
      this.phase = isOff(e) ? 'off' : e instanceof ApiError && e.status === 403 ? 'forbidden' : 'error';
    }
  }

  protected treeNodes(): PlaceNode[] {
    return this.data ? placeTree(this.placed(this.data), this.collapsed) : [];
  }

  protected setRange(r: RangeId) {
    this.range = r;
    if (r !== 'custom') void this.load();
  }

  protected rangeBar(): TemplateResult {
    return html`<div class="seg" role="group" aria-label=${ix('range')}>${RANGES.map(
      ([id, key]) => html`<button data-range=${id} aria-pressed=${this.range === id} @click=${() => this.setRange(id)}>${ix(key)}</button>`,
    )}</div>
    ${this.range === 'custom' ? html`<span class="rangefields"><input class="inp" type="date" lang=${dateInputLang()} data-from aria-label=${ix('rangeFrom')} .value=${this.from} @change=${(e: Event) => (this.from = (e.target as HTMLInputElement).value)} />
      <input class="inp" type="date" lang=${dateInputLang()} data-to aria-label=${ix('rangeTo')} .value=${this.to} @change=${(e: Event) => (this.to = (e.target as HTMLInputElement).value)} />
      <button class="btn" data-apply ?disabled=${!this.from} @click=${() => void this.load()}>${ix('range')}</button></span>` : nothing}`;
  }

  /** The phone form of the tree: one chip-shaped picker. */
  protected placeSelect(nodes: readonly PlaceNode[]): TemplateResult {
    return html`<label class="chip place-m" data-place-select><sw-icon name="pin"></sw-icon>
      <select aria-label=${ix('places')} style="border:0;background:none;color:inherit;font:inherit" @change=${(e: Event) => (this.place = (e.target as HTMLSelectElement).value)}>
        ${nodes.map((n) => html`<option value=${n.id} ?selected=${n.id === this.place}>${n.depth ? '  ' : ''}${n.name} (${n.count})</option>`)}</select></label>`;
  }

  protected tree(nodes: readonly PlaceNode[]): TemplateResult {
    return html`<aside class="card treecol" aria-label=${ix('places')}><sw-place-tree data-insight-tree .rows=${nodes} .selected=${this.place} heading=${ix('places')}
      @place-select=${(e: CustomEvent<string>) => (this.place = e.detail)}
      @place-toggle=${(e: CustomEvent<string>) => {
        const next = new Set(this.collapsed);
        if (next.has(e.detail)) next.delete(e.detail);
        else next.add(e.detail);
        this.collapsed = next;
      }}></sw-place-tree></aside>`;
  }

  protected skeleton(): TemplateResult {
    return html`<div aria-busy="true" data-state="loading">${[44, 96, 70].map((h) => html`<div class="rs"><div class="skel" style="block-size:14px;inline-size:120px;margin-block-end:12px"></div><div class="skel" style="block-size:${h}px"></div></div>`)}</div>`;
  }

  protected errorBlock(): TemplateResult {
    return html`<div class="blank" data-state="error"><sw-icon name="warning" style="color:var(--sw-danger-text)"></sw-icon><b>${ix('errorTitle')}</b><span class="muted">${ix('errorBody')}</span>
      <button class="btn primary" data-retry @click=${() => void this.load()}>${ix('retry')}</button></div>`;
  }

  protected gone(): TemplateResult | typeof nothing {
    if (this.phase !== 'off' && this.phase !== 'forbidden') return nothing;
    return html`<div class="card" data-state=${this.phase}><div class="blank"><sw-icon name=${this.phase === 'off' ? 'offline' : 'lock'}></sw-icon>
      <b>${ix(this.phase === 'off' ? 'offTitle' : 'forbiddenTitle')}</b><a class="btn" href="#/">${ix('toHome')}</a></div></div>`;
  }
}
