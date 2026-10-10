import { LitElement, html, css, nothing } from 'lit';
import { customElement, property } from 'lit/decorators.js';
import './sw-icon';
import './sw-button';
import './sw-state-panel';
import './frigate-event-control';
import { cardTime, objectLabel, playbackState, spanRows, spanText, timelineText, type ReviewDetail, type ReviewLayer } from '../api/frigate';
import { fx, frigateLocale } from '../i18n/frigate-text';

const MAX_EVENT_ROWS = 6;
const hms = (iso: string, tz: string) => new Intl.DateTimeFormat(frigateLocale(), { timeZone: tz, hour: '2-digit', minute: '2-digit', second: '2-digit', hourCycle: 'h23' }).format(new Date(iso));

/**
 * NN5-F1B / FRGD: the body of the review drawer - the still as a hero, the facts as a quiet two-column grid, the tracked-object
 * timeline (data only), the event actions (retain / sub-label, their own element) and the action row. "פתח הקלטה" uses the existing
 * recording screen when the backend says the item can be opened (`playback.available`); otherwise it is disabled with one short reason.
 * "ייצוא הקטע" is offered only when the screen says the caller may export now (`canExport`). Fires `review-play`, `review-toggle`,
 * `review-export` ({ id }). Clean operator screen: no hints, no paragraphs; the facts speak.
 */
@customElement('frigate-review-detail')
export class FrigateReviewDetail extends LitElement {
  @property({ attribute: false }) detail: ReviewDetail | null = null;
  @property({ type: Boolean }) canReview = true;
  /** the caller holds analytics.events somewhere: the retain / sub-label rows are tried (each one hides itself unless the server says it may change that event now) */
  @property({ type: Boolean }) canEvents = false;
  /** the caller may create a Frigate export of this item now (permission AND the exports class on): the action is drawn */
  @property({ type: Boolean }) canExport = false;
  @property() tz = 'Asia/Jerusalem';

  static styles = css`
    :host {
      display: block;
    }
    .wrap {
      display: grid;
      gap: var(--sw-s-4);
    }
    .hero {
      position: relative;
      inline-size: 100%;
      aspect-ratio: 16 / 9;
      border-radius: var(--sw-r-md);
      background: var(--sw-video-bg);
      overflow: hidden;
    }
    .hero img {
      position: absolute;
      inset: 0;
      inline-size: 100%;
      block-size: 100%;
      object-fit: cover;
      display: block;
      direction: ltr;
    }
    .nopic {
      position: absolute;
      inset: 0;
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 6px;
      color: var(--sw-on-video-2);
      font-size: var(--sw-fs-sm);
      background: linear-gradient(135deg, var(--sw-surface-3), var(--sw-video-bg));
    }
    .tag {
      position: absolute;
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
    .tag.layer {
      inset-inline-start: var(--sw-s-2);
    }
    .tag.state {
      inset-inline-end: var(--sw-s-2);
    }
    .tag.state[data-review-state='new'] {
      background: var(--sw-accent);
    }
    .tag i {
      inline-size: 7px;
      block-size: 7px;
      border-radius: 50%;
      background: var(--sw-recorded);
    }
    .tag[data-layer='alert'] i {
      background: var(--sw-danger);
    }
    .tag[data-layer='detection'] i {
      background: var(--sw-stale);
    }
    .tag.state i {
      background: #fff;
      inline-size: 6px;
      block-size: 6px;
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
      direction: ltr;
      font-variant-numeric: tabular-nums;
    }
    .facts {
      display: grid;
      grid-template-columns: repeat(2, minmax(0, 1fr));
      gap: var(--sw-s-2);
      margin: 0;
    }
    .fact {
      display: grid;
      gap: 2px;
      padding: var(--sw-s-2) var(--sw-s-3);
      border-radius: var(--sw-r-sm);
      background: var(--sw-surface-2);
      min-inline-size: 0;
    }
    .fact.wide {
      grid-column: 1 / -1;
    }
    .fact dt {
      font-size: var(--sw-fs-xs);
      color: var(--sw-text-3);
    }
    .fact dd {
      margin: 0;
      font-size: var(--sw-fs-sm);
      font-weight: var(--sw-fw-medium);
      color: var(--sw-text);
      overflow-wrap: anywhere;
    }
    .fact dd time {
      direction: ltr;
      unicode-bidi: isolate;
      font-variant-numeric: tabular-nums;
    }
    .objs {
      display: flex;
      flex-wrap: wrap;
      gap: 4px;
    }
    .obj {
      display: inline-flex;
      padding: 1px var(--sw-s-2);
      border-radius: var(--sw-r-pill);
      background: var(--sw-surface-3);
      font-size: var(--sw-fs-xs);
      font-weight: var(--sw-fw-medium);
    }
    h3 {
      margin: 0 0 var(--sw-s-2);
      font-size: var(--sw-fs-xs);
      font-weight: var(--sw-fw-semibold);
      color: var(--sw-text-3);
      text-transform: uppercase;
      letter-spacing: 0.04em;
    }
    .obj-block {
      border-block-start: 1px solid var(--sw-border);
      padding-block: var(--sw-s-2);
    }
    .obj-h {
      display: flex;
      justify-content: space-between;
      gap: var(--sw-s-2);
      font-size: var(--sw-fs-sm);
      font-weight: var(--sw-fw-medium);
    }
    .obj-h small {
      color: var(--sw-text-2);
      font-weight: var(--sw-fw-regular);
      font-variant-numeric: tabular-nums;
    }
    ol {
      list-style: none;
      margin: var(--sw-s-2) 0 0;
      padding: 0 var(--sw-s-3) 0 0;
      display: grid;
      gap: 6px;
      position: relative;
    }
    ol::before {
      content: '';
      position: absolute;
      inset-block: 4px;
      inset-inline-start: 3px;
      inline-size: 2px;
      border-radius: 1px;
      background: var(--sw-border-strong);
    }
    li {
      position: relative;
      display: flex;
      gap: var(--sw-s-3);
      font-size: var(--sw-fs-xs);
      min-inline-size: 0;
      padding-inline-start: var(--sw-s-3);
    }
    li::before {
      content: '';
      position: absolute;
      inset-inline-start: 0;
      inset-block-start: 5px;
      inline-size: 8px;
      block-size: 8px;
      border-radius: 50%;
      background: var(--sw-surface);
      border: 2px solid var(--sw-accent);
      box-sizing: border-box;
    }
    li[data-timeline-row='end']::before,
    li[data-timeline-row='exit']::before {
      border-color: var(--sw-text-3);
    }
    li[data-timeline-row='ongoing']::before {
      background: var(--sw-live);
      border-color: var(--sw-live);
    }
    li time {
      flex: none;
      color: var(--sw-text-2);
      direction: ltr;
      unicode-bidi: isolate;
      font-variant-numeric: tabular-nums;
      min-inline-size: 4.6em;
    }
    .actions {
      display: flex;
      flex-wrap: wrap;
      gap: var(--sw-s-2);
      align-items: center;
      padding-block-start: var(--sw-s-2);
      border-block-start: 1px solid var(--sw-border);
    }
    .events {
      display: grid;
      gap: var(--sw-s-2);
      border-block-start: 1px solid var(--sw-border);
      padding-block-start: var(--sw-s-3);
    }
    .events:not(:has([ready])) {
      display: none;
    }
    .why {
      font-size: var(--sw-fs-xs);
      color: var(--sw-text-2);
      display: flex;
      align-items: center;
      gap: 4px;
    }
  `;

  private fire(name: 'review-play' | 'review-toggle' | 'review-export') {
    this.dispatchEvent(new CustomEvent(name, { detail: { id: this.detail?.id }, bubbles: true, composed: true }));
  }

  /** One row per tracked object (capped), only for a caller who may act on events. The names follow `objects` when the counts match. */
  private eventControls(d: ReviewDetail) {
    const ids = (d.detection_ids ?? []).slice(0, MAX_EVENT_ROWS);
    if (!this.canEvents || !d.recorder_id || !ids.length || d.layer === 'motion') return nothing;
    const named = d.objects.length === (d.detection_ids ?? []).length;
    return html`<section class="events" data-review-events>
      ${ids.map((id, i) => html`<frigate-event-control recorder-id=${d.recorder_id} event-id=${id} label=${named ? objectLabel(d.objects[i]) : `${fx().control.eventObject} ${i + 1}`}></frigate-event-control>`)}
    </section>`;
  }

  private layerText(l: ReviewLayer): string {
    const r = fx().review;
    return l === 'alert' ? r.layerAlertOne : l === 'detection' ? r.layerDetectionOne : r.layerMotionOne;
  }

  render() {
    const d = this.detail;
    if (!d) return nothing;
    const r = fx().review;
    const pb = playbackState(d);
    const dur = spanText(d.start, d.end);
    const where = [d.area_name, d.floor_name].filter(Boolean).join(' · ');
    return html`<div class="wrap" data-review-detail=${d.id}>
      <div class="hero">
        ${d.thumbnail === 'ready' ? html`<img class="pic" alt="" src=${d.thumb_url ?? ''} />` : html`<div class="nopic"><sw-icon name="image" size="20"></sw-icon>${r.noThumb}</div>`}
        <span class="tag layer" data-layer=${d.layer}><i></i>${this.layerText(d.layer)}</span>
        ${d.layer === 'motion' ? nothing : html`<span class="tag state" data-review-state=${d.reviewed ? 'reviewed' : 'new'}>${d.reviewed ? html`<sw-icon name="check" size="12"></sw-icon>${r.reviewed}` : html`<i></i>${r.unreviewed}`}</span>`}
        ${dur ? html`<span class="dur">${dur}</span>` : nothing}
      </div>
      <dl class="facts">
        <div class="fact"><dt>${r.camera}</dt><dd>${d.camera_name}</dd></div>
        <div class="fact"><dt>${r.time}</dt><dd><time datetime=${d.start}>${cardTime(d.start, this.tz)}</time>${dur ? ` · ${dur}` : ''}</dd></div>
        ${where ? html`<div class="fact"><dt>${r.where}</dt><dd>${where}</dd></div>` : nothing}
        <div class="fact"><dt>${r.zones}</dt><dd>${d.zones.length ? d.zones.join(' · ') : r.noZones}</dd></div>
        <div class="fact ${where ? 'wide' : ''}"><dt>${r.objects}${d.detections ? html` · <span data-review-detections>${d.detections}</span>` : nothing}</dt>
          <dd>${d.objects.length ? html`<span class="objs">${d.objects.map((o) => html`<span class="obj" data-obj=${o}>${objectLabel(o)}</span>`)}</span>` : '—'}</dd></div>
      </dl>
      <section data-review-timeline>
        <h3>${d.tracked.length ? r.timeline : r.activity}</h3>
        ${d.tracked.length
          ? d.tracked.map((o) => html`<div class="obj-block" data-tracked=${o.id}>
              <div class="obj-h"><span>${objectLabel(o.label)}${o.sub_label ? ` · ${o.sub_label}` : ''}</span><small>${o.top_score != null ? `${r.topScore} ${Math.round(o.top_score * 100)}%` : ''}</small></div>
              <ol>${o.timeline.map((row) => html`<li data-timeline-row=${row.kind}><time datetime=${row.at}>${hms(row.at, this.tz)}</time><span>${timelineText(row.kind, row.zone, row.note)}</span></li>`)}</ol>
            </div>`)
          : html`<ol data-review-activity>${spanRows(d).map((row) => html`<li data-timeline-row=${row.kind}><time datetime=${row.at}>${hms(row.at, this.tz)}</time><span>${timelineText(row.kind)}</span></li>`)}</ol>`}
      </section>
      ${this.eventControls(d)}
      <div class="actions">
        <sw-button variant="primary" icon="history" data-review-play ?disabled=${!pb.available} @click=${() => pb.available && this.fire('review-play')}>${r.openRecording}</sw-button>
        ${this.canExport && d.layer !== 'motion' ? html`<sw-button icon="download" data-review-export @click=${() => this.fire('review-export')}>${r.exportClip}</sw-button>` : nothing}
        ${this.canReview ? html`<sw-button variant="ghost" icon="check" data-review-detail-toggle @click=${() => this.fire('review-toggle')}>${d.reviewed ? r.markUnreviewed : r.markReviewed}</sw-button>` : nothing}
      </div>
      ${pb.available ? nothing : html`<div class="why" data-review-play-why><sw-icon name="info" size="14"></sw-icon>${pb.reason}</div>`}
    </div>`;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'frigate-review-detail': FrigateReviewDetail;
  }
}
