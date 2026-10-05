import { LitElement, html, css, nothing } from 'lit';
import { customElement, property, state } from 'lit/decorators.js';
import './sw-icon';
import type { IconName } from './sw-icon';
import { LAYER_TEXT, cardTime, objectLabel, reviewThumbUrl, spanText, type ReviewItem, type ReviewLayer } from '../api/frigate';
import { he } from '../i18n/he';

const LAYER_ICON: Record<ReviewLayer, IconName> = { alert: 'warning', detection: 'eye', motion: 'activity' };

/**
 * NN5-F1B: one review item as a card - still, camera, time, where, objects, zones, severity layer, per-user reviewed state.
 * Functional markup with tokens only (a restyle changes the CSS, not the structure). Events (all bubble, composed):
 * `review-open` / `review-select` / `review-toggle` with `detail: { id }`.
 * The layer is told by icon and text as well as colour; "reviewed" is a check and a dimmed card, "new" a dot with text for screen readers.
 */
@customElement('frigate-review-card')
export class FrigateReviewCard extends LitElement {
  @property({ attribute: false }) item!: ReviewItem;
  @property({ type: Boolean, reflect: true }) selected = false;
  @property({ type: Boolean, reflect: true }) focused = false;
  /** analytics.review: the reviewed toggle and the selection tick are offered only to those who may mark. */
  @property({ type: Boolean }) canReview = true;
  @property() tz = 'Asia/Jerusalem';
  @state() private broken = false;

  static styles = css`
    :host {
      display: block;
      min-inline-size: 0;
    }
    article {
      position: relative;
      display: flex;
      flex-direction: column;
      border: 1px solid var(--sw-border);
      border-radius: var(--sw-r-md);
      background: var(--sw-surface);
      box-shadow: var(--sw-shadow-1);
      overflow: hidden;
      min-inline-size: 0;
    }
    :host([selected]) article {
      border-color: var(--sw-accent);
      box-shadow: 0 0 0 2px var(--sw-accent);
    }
    :host([focused]) article {
      outline: 2px solid var(--sw-focus);
      outline-offset: 2px;
    }
    :host([data-reviewed]) .body,
    :host([data-reviewed]) .thumb img {
      opacity: 0.62;
    }
    .thumb {
      position: relative;
      display: block;
      inline-size: 100%;
      aspect-ratio: 16 / 9;
      padding: 0;
      border: 0;
      background: var(--sw-surface-3);
      cursor: pointer;
      color: var(--sw-text-3);
    }
    .thumb img {
      position: absolute;
      inset: 0;
      inline-size: 100%;
      block-size: 100%;
      object-fit: cover;
      /* a still is a picture of the camera: never mirrored by RTL */
      direction: ltr;
    }
    .none {
      position: absolute;
      inset: 0;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      gap: 6px;
      font-size: var(--sw-fs-xs);
    }
    .layer {
      position: absolute;
      inset-inline-start: var(--sw-s-2);
      inset-block-start: var(--sw-s-2);
      display: inline-flex;
      align-items: center;
      gap: 4px;
      padding: 1px var(--sw-s-2);
      border-radius: var(--sw-r-pill);
      font-size: var(--sw-fs-xs);
      font-weight: var(--sw-fw-semibold);
      color: #fff;
      background: var(--sw-recorded);
    }
    .layer[data-layer='alert'] {
      background: var(--sw-danger);
    }
    .layer[data-layer='detection'] {
      background: var(--sw-stale);
      color: var(--sw-stale-text, #3b2a00);
    }
    .dur {
      position: absolute;
      inset-inline-end: var(--sw-s-2);
      inset-block-end: var(--sw-s-2);
      padding: 0 var(--sw-s-2);
      border-radius: var(--sw-r-sm);
      background: rgba(17, 24, 39, 0.6);
      color: #fff;
      font-size: var(--sw-fs-xs);
    }
    .state {
      position: absolute;
      inset-inline-end: var(--sw-s-2);
      inset-block-start: var(--sw-s-2);
      display: inline-flex;
      align-items: center;
      justify-content: center;
      min-inline-size: 22px;
      block-size: 22px;
      border-radius: var(--sw-r-pill);
      background: rgba(17, 24, 39, 0.6);
      color: #fff;
      font-size: var(--sw-fs-xs);
      padding-inline: 6px;
      gap: 4px;
    }
    .state i {
      inline-size: 8px;
      block-size: 8px;
      border-radius: 50%;
      background: var(--sw-accent);
    }
    .body {
      display: grid;
      gap: var(--sw-s-1);
      padding: var(--sw-s-2) var(--sw-s-3);
      min-inline-size: 0;
    }
    .row1 {
      display: flex;
      justify-content: space-between;
      gap: var(--sw-s-2);
      align-items: baseline;
      min-inline-size: 0;
    }
    .cam {
      font-weight: var(--sw-fw-semibold);
      font-size: var(--sw-fs-sm);
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
      min-inline-size: 0;
    }
    time {
      flex: none;
      font-size: var(--sw-fs-xs);
      color: var(--sw-text-2);
      direction: ltr;
      unicode-bidi: isolate;
    }
    .where,
    .zones {
      font-size: var(--sw-fs-xs);
      color: var(--sw-text-2);
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }
    .objs {
      display: flex;
      flex-wrap: wrap;
      gap: var(--sw-s-1);
      margin: 0;
      padding: 0;
      list-style: none;
    }
    .obj {
      padding: 0 var(--sw-s-2);
      border-radius: var(--sw-r-pill);
      background: var(--sw-surface-3);
      color: var(--sw-text);
      font-size: var(--sw-fs-xs);
    }
    footer {
      display: flex;
      align-items: center;
      gap: var(--sw-s-2);
      padding: var(--sw-s-1) var(--sw-s-2) var(--sw-s-2);
    }
    label.tick {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      min-inline-size: 44px;
      min-block-size: 36px;
      cursor: pointer;
    }
    label.tick input {
      inline-size: 18px;
      block-size: 18px;
      margin: 0;
      accent-color: var(--sw-accent);
    }
    button.mark {
      margin-inline-start: auto;
      display: inline-flex;
      align-items: center;
      gap: 4px;
      min-block-size: 36px;
      padding-inline: var(--sw-s-3);
      border-radius: var(--sw-r-sm);
      border: 1px solid var(--sw-border-strong);
      background: var(--sw-surface);
      color: var(--sw-text);
      font: inherit;
      font-size: var(--sw-fs-xs);
      cursor: pointer;
    }
    button.mark:hover {
      background: var(--sw-surface-2);
    }
    button:focus-visible,
    input:focus-visible {
      outline: 2px solid var(--sw-focus);
      outline-offset: 2px;
    }
  `;

  private emit(name: 'review-open' | 'review-select' | 'review-toggle') {
    this.dispatchEvent(new CustomEvent(name, { detail: { id: this.item.id }, bubbles: true, composed: true }));
  }

  updated() {
    this.toggleAttribute('data-reviewed', this.item?.reviewed === true);
  }

  render() {
    const it = this.item;
    if (!it) return nothing;
    const r = he.frigate.review;
    const lt = LAYER_TEXT[it.layer].one;
    const dur = spanText(it.start, it.end);
    const where = [it.area_name, it.floor_name].filter(Boolean).join(' · ');
    const src = it.thumb_url ?? reviewThumbUrl(it.id);
    return html`<article data-review-card=${it.id} data-layer=${it.layer} data-reviewed=${String(it.reviewed)}>
      <button type="button" class="thumb" data-review-open aria-label=${`${r.open}: ${it.camera_name}`} @click=${() => this.emit('review-open')}>
        ${it.thumbnail === 'ready' && !this.broken
          ? html`<img src=${src} alt="" loading="lazy" @error=${() => (this.broken = true)} />`
          : html`<span class="none"><sw-icon name="image" size="24"></sw-icon>${r.noThumb}</span>`}
        <span class="layer" data-layer=${it.layer}><sw-icon name=${LAYER_ICON[it.layer]} size="12"></sw-icon>${lt}</span>
        <span class="state" data-review-state=${it.reviewed ? 'reviewed' : 'new'}>${it.reviewed ? html`<sw-icon name="check" size="12"></sw-icon><span>${r.reviewed}</span>` : html`<i></i><span>${r.unreviewed}</span>`}</span>
        ${dur ? html`<span class="dur">${dur}</span>` : nothing}
      </button>
      <div class="body">
        <div class="row1"><span class="cam" title=${it.camera_name}>${it.camera_name}</span><time datetime=${it.start}>${cardTime(it.start, this.tz)}</time></div>
        ${where ? html`<div class="where" data-review-where>${where}</div>` : nothing}
        ${it.objects.length ? html`<ul class="objs" aria-label=${r.objects}>${it.objects.map((o) => html`<li class="obj" data-obj=${o}>${objectLabel(o)}</li>`)}</ul>` : nothing}
        <div class="zones">${it.zones.length ? it.zones.join(' · ') : r.noZones}</div>
      </div>
      ${this.canReview
        ? html`<footer>
            <label class="tick"><input type="checkbox" data-review-select .checked=${this.selected} aria-label=${`${r.selected}: ${it.camera_name}`} @change=${() => this.emit('review-select')} /></label>
            <button type="button" class="mark" data-review-toggle @click=${() => this.emit('review-toggle')}><sw-icon name="check" size="14"></sw-icon>${it.reviewed ? r.markUnreviewed : r.markReviewed}</button>
          </footer>`
        : nothing}
    </article>`;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'frigate-review-card': FrigateReviewCard;
  }
}
