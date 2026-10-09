import { LitElement, html, css, nothing } from 'lit';
import { customElement, property, state } from 'lit/decorators.js';
import './sw-icon';
import { cardTime, objectLabel, spanText, type ReviewItem, type ReviewLayer } from '../api/frigate';
import { fx } from '../i18n/frigate-text';

/** The table view's columns, one grid template shared by the header row (investigate-reviews) and every row (this element):
 * tick, still, camera, time, duration, objects, zones, where, state, actions. A CSS literal so both static sheets can interpolate it. */
export const ROW_COLUMNS_CSS = css`44px 96px minmax(140px, 1.4fr) 112px 72px minmax(120px, 1.2fr) minmax(120px, 1fr) minmax(100px, 1fr) 84px 150px`;

/**
 * NN5-F1B / FRGD: one review item - a card in the grid (`variant="card"`) or a row of the table view (`variant="row"`). Still,
 * camera, time, duration, where, objects, zones, severity layer, per-user reviewed state. Functional markup with tokens only; the
 * layer is told by icon and text as well as colour, "reviewed" is a check and a dimmed item, "new" a dot with text for screen readers.
 * Events (all bubble, composed): `review-open` / `review-select` / `review-toggle` with `detail: { id }`.
 */
@customElement('frigate-review-card')
export class FrigateReviewCard extends LitElement {
  @property({ attribute: false }) item!: ReviewItem;
  @property({ type: Boolean, reflect: true }) selected = false;
  @property({ type: Boolean, reflect: true }) focused = false;
  /** The reviewed toggle and the selection tick are offered (not for a motion span, which is no item). */
  @property({ type: Boolean }) canReview = true;
  @property({ reflect: true }) variant: 'card' | 'row' = 'card';
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
      overflow: hidden;
      min-inline-size: 0;
      transition: border-color var(--sw-t-fast) var(--sw-ease), box-shadow var(--sw-t-fast) var(--sw-ease), transform var(--sw-t-fast) var(--sw-ease);
    }
    article:hover {
      border-color: var(--sw-border-strong);
      box-shadow: var(--sw-shadow-2);
    }
    :host([selected]) article {
      border-color: var(--sw-accent);
      box-shadow: 0 0 0 1px var(--sw-accent);
    }
    :host([focused]) article {
      outline: var(--sw-focus-w) solid var(--sw-focus);
      outline-offset: 2px;
    }
    :host([data-reviewed]) .body,
    :host([data-reviewed]) .thumb img,
    :host([data-reviewed]) .cells {
      opacity: 0.6;
    }
    /* ---- the still ---- */
    .thumb {
      position: relative;
      display: block;
      inline-size: 100%;
      aspect-ratio: 16 / 9;
      padding: 0;
      border: 0;
      background: var(--sw-video-bg);
      cursor: pointer;
      color: var(--sw-text-3);
      overflow: hidden;
    }
    .thumb img {
      position: absolute;
      inset: 0;
      inline-size: 100%;
      block-size: 100%;
      object-fit: cover;
      /* a still is a picture of the camera: never mirrored by RTL */
      direction: ltr;
      transition: transform var(--sw-t-med) var(--sw-ease);
    }
    article:hover .thumb img {
      transform: scale(1.03);
    }
    .thumb .shade {
      position: absolute;
      inset: auto 0 0 0;
      block-size: 46%;
      background: linear-gradient(to top, rgba(8, 12, 22, 0.78), rgba(8, 12, 22, 0));
      pointer-events: none;
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
      color: var(--sw-on-video-2);
      background: linear-gradient(135deg, var(--sw-surface-3), var(--sw-video-bg));
    }
    .layer {
      position: absolute;
      inset-inline-start: var(--sw-s-2);
      inset-block-start: var(--sw-s-2);
      display: inline-flex;
      align-items: center;
      gap: 5px;
      padding: 2px var(--sw-s-2) 2px 6px;
      border-radius: var(--sw-r-pill);
      font-size: var(--sw-fs-xs);
      font-weight: var(--sw-fw-semibold);
      color: var(--sw-on-video);
      background: var(--sw-video-scrim);
      backdrop-filter: blur(6px);
      -webkit-backdrop-filter: blur(6px);
    }
    .layer i {
      inline-size: 7px;
      block-size: 7px;
      border-radius: 50%;
      background: var(--sw-recorded);
    }
    .layer[data-layer='alert'] i {
      background: var(--sw-danger);
    }
    .layer[data-layer='detection'] i {
      background: var(--sw-stale);
    }
    .dur {
      position: absolute;
      inset-inline-end: var(--sw-s-2);
      inset-block-end: var(--sw-s-2);
      padding: 1px 6px;
      border-radius: var(--sw-r-sm);
      background: var(--sw-video-scrim);
      color: var(--sw-on-video);
      font-size: var(--sw-fs-xs);
      font-variant-numeric: tabular-nums;
      direction: ltr;
    }
    .state {
      position: absolute;
      inset-inline-end: var(--sw-s-2);
      inset-block-start: var(--sw-s-2);
      display: inline-flex;
      align-items: center;
      justify-content: center;
      gap: 4px;
      min-inline-size: 22px;
      block-size: 22px;
      padding-inline: 7px;
      border-radius: var(--sw-r-pill);
      background: var(--sw-video-scrim);
      color: var(--sw-on-video);
      font-size: var(--sw-fs-xs);
      font-weight: var(--sw-fw-medium);
    }
    .state[data-review-state='new'] {
      background: var(--sw-accent);
    }
    .state i {
      inline-size: 6px;
      block-size: 6px;
      border-radius: 50%;
      background: #fff;
    }
    .over {
      position: absolute;
      inset-inline: var(--sw-s-3);
      inset-block-end: var(--sw-s-2);
      display: flex;
      align-items: baseline;
      justify-content: space-between;
      gap: var(--sw-s-2);
      color: var(--sw-on-video);
      text-align: start;
      pointer-events: none;
      min-inline-size: 0;
    }
    .over .cam {
      font-weight: var(--sw-fw-semibold);
      font-size: var(--sw-fs-md);
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
      min-inline-size: 0;
      text-shadow: 0 1px 2px rgba(0, 0, 0, 0.5);
    }
    time {
      flex: none;
      font-size: var(--sw-fs-xs);
      direction: ltr;
      unicode-bidi: isolate;
      font-variant-numeric: tabular-nums;
    }
    .over time {
      color: rgba(255, 255, 255, 0.9);
    }
    /* ---- the body ---- */
    .body {
      display: grid;
      gap: 6px;
      padding: var(--sw-s-2) var(--sw-s-3) var(--sw-s-2);
      min-inline-size: 0;
    }
    .meta {
      display: flex;
      flex-wrap: wrap;
      align-items: center;
      gap: 4px var(--sw-s-2);
      font-size: var(--sw-fs-xs);
      color: var(--sw-text-2);
      min-inline-size: 0;
    }
    .where,
    .zones {
      font-size: var(--sw-fs-xs);
      color: var(--sw-text-2);
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
      min-inline-size: 0;
    }
    .where {
      display: inline-flex;
      align-items: center;
      gap: 4px;
    }
    .objs {
      display: flex;
      flex-wrap: wrap;
      gap: 4px;
      margin: 0;
      padding: 0;
      list-style: none;
    }
    .obj {
      display: inline-flex;
      align-items: center;
      padding: 1px var(--sw-s-2);
      border-radius: var(--sw-r-pill);
      background: var(--sw-surface-3);
      color: var(--sw-text);
      font-size: var(--sw-fs-xs);
      font-weight: var(--sw-fw-medium);
    }
    footer {
      display: flex;
      align-items: center;
      gap: var(--sw-s-2);
      padding: 0 var(--sw-s-2) 0 var(--sw-s-1);
      border-block-start: 1px solid var(--sw-border);
      min-block-size: 38px;
    }
    label.tick {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      min-inline-size: 40px;
      min-block-size: 36px;
      cursor: pointer;
    }
    label.tick input {
      inline-size: 16px;
      block-size: 16px;
      margin: 0;
      accent-color: var(--sw-accent);
    }
    button.mark {
      margin-inline-start: auto;
      display: inline-flex;
      align-items: center;
      gap: 5px;
      min-block-size: 32px;
      padding-inline: var(--sw-s-2);
      border-radius: var(--sw-r-sm);
      border: 0;
      background: transparent;
      color: var(--sw-accent-text);
      font: inherit;
      font-size: var(--sw-fs-xs);
      font-weight: var(--sw-fw-medium);
      cursor: pointer;
    }
    button.mark:hover {
      background: var(--sw-accent-soft);
    }
    :host([data-reviewed]) button.mark {
      color: var(--sw-text-2);
    }
    :host([data-reviewed]) button.mark:hover {
      background: var(--sw-surface-2);
    }
    button:focus-visible,
    input:focus-visible {
      outline: var(--sw-focus-w) solid var(--sw-focus);
      outline-offset: 2px;
    }
    /* ---- the table row ---- */
    :host([variant='row']) article {
      display: grid;
      grid-template-columns: var(--rv-cols, ${ROW_COLUMNS_CSS});
      align-items: center;
      gap: var(--sw-s-2);
      border-radius: 0;
      border-inline: 0;
      border-block-start: 0;
      background: transparent;
      min-block-size: 56px;
      padding-inline: var(--sw-s-1);
    }
    :host([variant='row']) article:hover {
      background: var(--sw-surface-2);
      box-shadow: none;
    }
    :host([variant='row'][selected]) article {
      background: var(--sw-accent-soft);
      box-shadow: inset 3px 0 0 var(--sw-accent);
    }
    :host([variant='row']) .thumb {
      inline-size: 96px;
      block-size: 54px;
      aspect-ratio: auto;
      border-radius: var(--sw-r-sm);
    }
    :host([variant='row']) .thumb .dur {
      inset: auto 3px 3px auto;
      font-size: var(--sw-fs-2xs);
      padding: 0 4px;
    }
    :host([variant='row']) .none {
      font-size: 0;
      gap: 0;
    }
    .cell {
      min-inline-size: 0;
      font-size: var(--sw-fs-sm);
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
      color: var(--sw-text);
    }
    .cell.muted {
      color: var(--sw-text-2);
      font-size: var(--sw-fs-xs);
    }
    .cell.cam {
      display: grid;
      gap: 1px;
    }
    .cell.cam b {
      font-weight: var(--sw-fw-semibold);
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }
    .cell.cam small {
      color: var(--sw-text-2);
      font-size: var(--sw-fs-xs);
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }
    .cell time {
      color: var(--sw-text-2);
      font-size: var(--sw-fs-sm);
    }
    .cell .objs {
      flex-wrap: nowrap;
      overflow: hidden;
    }
    .pill {
      display: inline-flex;
      align-items: center;
      gap: 5px;
      padding: 1px var(--sw-s-2) 1px 6px;
      border-radius: var(--sw-r-pill);
      font-size: var(--sw-fs-xs);
      font-weight: var(--sw-fw-medium);
      background: var(--sw-surface-3);
      color: var(--sw-text);
    }
    .pill i {
      inline-size: 7px;
      block-size: 7px;
      border-radius: 50%;
      background: var(--sw-recorded);
    }
    .pill[data-layer='alert'] i {
      background: var(--sw-danger);
    }
    .pill[data-layer='detection'] i {
      background: var(--sw-stale);
    }
    .pill[data-review-state='new'] {
      background: var(--sw-accent-soft);
      color: var(--sw-accent-text);
    }
    .pill[data-review-state='new'] i {
      background: var(--sw-accent);
    }
    .pill[data-review-state='reviewed'] {
      color: var(--sw-text-2);
    }
    .rowacts {
      display: flex;
      align-items: center;
      justify-content: flex-end;
      gap: 2px;
    }
    .rowacts button {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      gap: 4px;
      min-inline-size: 36px;
      min-block-size: 36px;
      padding-inline: var(--sw-s-2);
      border: 0;
      border-radius: var(--sw-r-sm);
      background: transparent;
      color: var(--sw-text-2);
      font: inherit;
      font-size: var(--sw-fs-xs);
      cursor: pointer;
    }
    .rowacts button:hover {
      background: var(--sw-surface-3);
      color: var(--sw-text);
    }
    .rowacts button.mark {
      margin: 0;
      color: var(--sw-accent-text);
    }
    .rowacts button.mark:hover {
      background: var(--sw-accent-soft);
    }
    /* a narrow table (tablet portrait, phone): the row folds to the still and two text lines; the header is hidden by the screen */
    @media (max-width: 899px) {
      :host([variant='row']) article {
        grid-template-columns: 40px 96px minmax(0, 1fr) auto;
        grid-template-areas: 'tick thumb main acts';
        padding-block: var(--sw-s-2);
      }
      :host([variant='row']) label.tick {
        grid-area: tick;
      }
      :host([variant='row']) .thumb {
        grid-area: thumb;
      }
      :host([variant='row']) .fold {
        grid-area: main;
        display: grid;
        gap: 2px;
        min-inline-size: 0;
      }
      :host([variant='row']) .cell:not(.in-fold) {
        display: none;
      }
      :host([variant='row']) .rowacts {
        grid-area: acts;
      }
      :host([variant='row']) .rowacts .txt {
        display: none;
      }
    }
    @media (min-width: 900px) {
      :host([variant='row']) .fold {
        display: contents;
      }
      /* the duration has its own column on a wide table */
      :host([variant='row']) .fold-only {
        display: none;
      }
    }
  `;

  private emit(name: 'review-open' | 'review-select' | 'review-toggle') {
    this.dispatchEvent(new CustomEvent(name, { detail: { id: this.item.id }, bubbles: true, composed: true }));
  }

  updated() {
    this.toggleAttribute('data-reviewed', this.item?.reviewed === true);
  }

  private still(it: ReviewItem, dur: string | null, overlay: boolean) {
    const r = fx().review;
    const src = it.thumb_url ?? '';
    const lt = this.layerText(it.layer);
    return html`<button type="button" class="thumb" data-review-open aria-label=${`${r.open}: ${it.camera_name}`} @click=${() => this.emit('review-open')}>
      ${it.thumbnail === 'ready' && src && !this.broken
        ? html`<img src=${src} alt="" loading="lazy" @error=${() => (this.broken = true)} />`
        : html`<span class="none"><sw-icon name="image" size="22"></sw-icon>${r.noThumb}</span>`}
      ${overlay ? html`<span class="shade"></span>` : nothing}
      ${overlay ? html`<span class="layer" data-layer=${it.layer}><i></i>${lt}</span>` : nothing}
      ${overlay && it.layer !== 'motion' ? html`<span class="state" data-review-state=${it.reviewed ? 'reviewed' : 'new'}>${it.reviewed ? html`<sw-icon name="check" size="12"></sw-icon><span>${r.reviewed}</span>` : html`<i></i><span>${r.unreviewed}</span>`}</span>` : nothing}
      ${dur && !overlay ? html`<span class="dur">${dur}</span>` : nothing}
      ${overlay ? html`<span class="over"><span class="cam" title=${it.camera_name}>${it.camera_name}</span><time datetime=${it.start}>${cardTime(it.start, this.tz)}${dur ? ` · ${dur}` : ''}</time></span>` : nothing}
    </button>`;
  }

  private layerText(l: ReviewLayer): string {
    const r = fx().review;
    return l === 'alert' ? r.layerAlertOne : l === 'detection' ? r.layerDetectionOne : r.layerMotionOne;
  }

  private card(it: ReviewItem) {
    const r = fx().review;
    const dur = spanText(it.start, it.end);
    const where = [it.area_name, it.floor_name].filter(Boolean).join(' · ');
    return html`<article data-review-card=${it.id} data-layer=${it.layer} data-reviewed=${String(it.reviewed)}>
      ${this.still(it, dur, true)}
      <div class="body">
        <div class="meta">
          ${it.objects.length ? html`<ul class="objs" aria-label=${r.objects}>${it.objects.map((o) => html`<li class="obj" data-obj=${o}>${objectLabel(o)}</li>`)}</ul>` : nothing}
          <span class="zones" data-review-zones>${it.zones.length ? it.zones.join(' · ') : r.noZones}</span>
        </div>
        ${where ? html`<div class="where" data-review-where><sw-icon name="pin" size="11"></sw-icon><span>${where}</span></div>` : nothing}
      </div>
      ${this.canReview
        ? html`<footer>
            <label class="tick"><input type="checkbox" data-review-select .checked=${this.selected} aria-label=${`${r.selected}: ${it.camera_name}`} @change=${() => this.emit('review-select')} /></label>
            <button type="button" class="mark" data-review-toggle @click=${() => this.emit('review-toggle')}><sw-icon name="check" size="14"></sw-icon>${it.reviewed ? r.markUnreviewed : r.markReviewed}</button>
          </footer>`
        : nothing}
    </article>`;
  }

  private row(it: ReviewItem) {
    const r = fx().review;
    const dur = spanText(it.start, it.end);
    const where = [it.area_name, it.floor_name].filter(Boolean).join(' · ');
    const lt = this.layerText(it.layer);
    return html`<article role="row" data-review-card=${it.id} data-layer=${it.layer} data-reviewed=${String(it.reviewed)}>
      ${this.canReview
        ? html`<label class="tick" role="cell"><input type="checkbox" data-review-select .checked=${this.selected} aria-label=${`${r.selected}: ${it.camera_name}`} @change=${() => this.emit('review-select')} /></label>`
        : html`<span role="cell"></span>`}
      ${this.still(it, dur, false)}
      <div class="fold">
        <div class="cell cam in-fold" role="cell"><b class="cam" title=${it.camera_name}>${it.camera_name}</b>${where ? html`<small data-review-where>${where}</small>` : nothing}</div>
        <div class="cell in-fold" role="cell"><time datetime=${it.start}>${cardTime(it.start, this.tz)}</time>${dur ? html`<span class="muted fold-only"> · ${dur}</span>` : nothing}</div>
        <div class="cell muted" role="cell">${dur ?? '—'}</div>
        <div class="cell in-fold" role="cell">${it.objects.length ? html`<ul class="objs" aria-label=${r.objects}>${it.objects.map((o) => html`<li class="obj" data-obj=${o}>${objectLabel(o)}</li>`)}</ul>` : html`<span class="muted">—</span>`}</div>
        <div class="cell muted zones" role="cell">${it.zones.length ? it.zones.join(' · ') : r.noZones}</div>
        <div class="cell muted" role="cell">${where || '—'}</div>
        <div class="cell" role="cell">${it.layer === 'motion'
          ? html`<span class="pill layer" data-layer=${it.layer}><i></i>${lt}</span>`
          : html`<span class="pill" data-review-state=${it.reviewed ? 'reviewed' : 'new'}>${it.reviewed ? html`<sw-icon name="check" size="12"></sw-icon>` : html`<i></i>`}${it.reviewed ? r.reviewed : r.unreviewed}</span>`}</div>
      </div>
      <div class="rowacts" role="cell">
        ${this.canReview ? html`<button type="button" class="mark" data-review-toggle title=${it.reviewed ? r.markUnreviewed : r.markReviewed} @click=${() => this.emit('review-toggle')}><sw-icon name="check" size="14"></sw-icon><span class="txt">${it.reviewed ? r.markUnreviewed : r.markReviewed}</span></button>` : nothing}
        <button type="button" data-review-open-row title=${r.open} aria-label=${`${r.open}: ${it.camera_name}`} @click=${() => this.emit('review-open')}><sw-icon name="chevronBack" size="16"></sw-icon></button>
      </div>
    </article>`;
  }

  render() {
    const it = this.item;
    if (!it) return nothing;
    return this.variant === 'row' ? this.row(it) : this.card(it);
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'frigate-review-card': FrigateReviewCard;
  }
}
