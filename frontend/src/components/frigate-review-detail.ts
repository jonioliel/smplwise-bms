import { LitElement, html, css, nothing } from 'lit';
import { customElement, property } from 'lit/decorators.js';
import './sw-icon';
import './sw-button';
import './sw-state-panel';
import './frigate-event-control';
import { LAYER_TEXT, cardTime, objectLabel, playbackState, spanRows, spanText, timelineText, type ReviewDetail } from '../api/frigate';
import { he } from '../i18n/he';

const MAX_EVENT_ROWS = 6;
const hms = (iso: string, tz: string) => new Intl.DateTimeFormat('he-IL', { timeZone: tz, hour: '2-digit', minute: '2-digit', second: '2-digit', hourCycle: 'h23' }).format(new Date(iso));

/**
 * NN5-F1B: the body of the review drawer - the still, the facts, the tracked-object timeline (data only) and the actions.
 * "פתח הקלטה" uses the existing recording screen when the backend says the item can be opened (`playback.available`); otherwise it is
 * shown disabled with the reason (not ready / no recording in the range). Fires `review-play` and `review-toggle` ({ id }).
 */
@customElement('frigate-review-detail')
export class FrigateReviewDetail extends LitElement {
  @property({ attribute: false }) detail: ReviewDetail | null = null;
  @property({ type: Boolean }) canReview = true;
  /** the caller holds analytics.events somewhere: the retain / sub-label rows are tried (each one hides itself unless the server says it may change that event now) */
  @property({ type: Boolean }) canEvents = false;
  @property() tz = 'Asia/Jerusalem';

  static styles = css`
    :host {
      display: block;
    }
    .wrap {
      display: grid;
      gap: var(--sw-s-4);
    }
    .pic {
      inline-size: 100%;
      aspect-ratio: 16 / 9;
      border-radius: var(--sw-r-md);
      background: var(--sw-surface-3);
      object-fit: cover;
      display: block;
      direction: ltr;
    }
    .nopic {
      aspect-ratio: 16 / 9;
      border-radius: var(--sw-r-md);
      background: var(--sw-surface-3);
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 6px;
      color: var(--sw-text-3);
      font-size: var(--sw-fs-sm);
    }
    dl {
      margin: 0;
      display: grid;
      grid-template-columns: max-content 1fr;
      gap: var(--sw-s-1) var(--sw-s-3);
      font-size: var(--sw-fs-sm);
    }
    dt {
      color: var(--sw-text-2);
    }
    dd {
      margin: 0;
      min-inline-size: 0;
      overflow-wrap: anywhere;
    }
    h3 {
      margin: 0 0 var(--sw-s-2);
      font-size: var(--sw-fs-sm);
      font-weight: var(--sw-fw-semibold);
    }
    .obj {
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
    }
    ol {
      list-style: none;
      margin: var(--sw-s-2) 0 0;
      padding: 0;
      display: grid;
      gap: var(--sw-s-1);
      border-inline-start: 2px solid var(--sw-border-strong);
      padding-inline-start: var(--sw-s-3);
    }
    li {
      display: flex;
      gap: var(--sw-s-3);
      font-size: var(--sw-fs-xs);
      min-inline-size: 0;
    }
    li time {
      flex: none;
      color: var(--sw-text-2);
      direction: ltr;
      unicode-bidi: isolate;
      font-variant-numeric: tabular-nums;
    }
    .actions {
      display: flex;
      flex-wrap: wrap;
      gap: var(--sw-s-2);
      align-items: center;
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
    .muted {
      color: var(--sw-text-2);
      font-size: var(--sw-fs-sm);
    }
  `;

  private fire(name: 'review-play' | 'review-toggle') {
    this.dispatchEvent(new CustomEvent(name, { detail: { id: this.detail?.id }, bubbles: true, composed: true }));
  }

  /** One row per tracked object (capped), only for a caller who may act on events. The names follow `objects` when the counts match. */
  private eventControls(d: ReviewDetail) {
    const ids = (d.detection_ids ?? []).slice(0, MAX_EVENT_ROWS);
    if (!this.canEvents || !d.recorder_id || !ids.length || d.layer === 'motion') return nothing;
    const named = d.objects.length === (d.detection_ids ?? []).length;
    return html`<section class="events" data-review-events>
      ${ids.map((id, i) => html`<frigate-event-control recorder-id=${d.recorder_id} event-id=${id} label=${named ? objectLabel(d.objects[i]) : `${he.frigate.control.eventObject} ${i + 1}`}></frigate-event-control>`)}
    </section>`;
  }

  render() {
    const d = this.detail;
    if (!d) return nothing;
    const r = he.frigate.review;
    const pb = playbackState(d);
    const dur = spanText(d.start, d.end);
    const where = [d.area_name, d.floor_name].filter(Boolean).join(' · ');
    return html`<div class="wrap" data-review-detail=${d.id}>
      ${d.thumbnail === 'ready'
        ? html`<img class="pic" alt="" src=${d.thumb_url ?? ''} />`
        : html`<div class="nopic"><sw-icon name="image" size="20"></sw-icon>${r.noThumb}</div>`}
      <dl>
        <dt>${r.camera}</dt><dd>${d.camera_name}</dd>
        <dt>${r.time}</dt><dd>${cardTime(d.start, this.tz)}${dur ? ` · ${r.duration} ${dur}` : ''}</dd>
        ${where ? html`<dt>${r.where}</dt><dd>${where}</dd>` : nothing}
        <dt>${r.zones}</dt><dd>${d.zones.length ? d.zones.join(' · ') : r.noZones}</dd>
        <dt>${r.objects}</dt><dd>${d.objects.length ? d.objects.map(objectLabel).join(', ') : '—'}</dd>
        ${d.detections ? html`<dt>${r.detections}</dt><dd data-review-detections>${d.detections}</dd>` : nothing}
        ${d.layer === 'motion' ? nothing : html`<dt>${LAYER_TEXT[d.layer].one}</dt><dd>${d.reviewed ? r.reviewed : r.unreviewed}</dd>`}
      </dl>
      <section data-review-timeline>
        <h3>${d.tracked.length ? r.timeline : r.activity}</h3>
        ${d.tracked.length
          ? d.tracked.map((o) => html`<div class="obj" data-tracked=${o.id}>
              <div class="obj-h"><span>${objectLabel(o.label)}${o.sub_label ? ` · ${o.sub_label}` : ''}</span><small>${o.top_score != null ? `${r.topScore} ${Math.round(o.top_score * 100)}%` : ''}</small></div>
              <ol>${o.timeline.map((row) => html`<li data-timeline-row=${row.kind}><time datetime=${row.at}>${hms(row.at, this.tz)}</time><span>${timelineText(row.kind, row.zone, row.note)}</span></li>`)}</ol>
            </div>`)
          : html`<ol data-review-activity>${spanRows(d).map((row) => html`<li data-timeline-row=${row.kind}><time datetime=${row.at}>${hms(row.at, this.tz)}</time><span>${timelineText(row.kind)}</span></li>`)}</ol>`}
      </section>
      ${this.eventControls(d)}
      <div class="actions">
        <sw-button variant="primary" icon="history" data-review-play ?disabled=${!pb.available} @click=${() => pb.available && this.fire('review-play')}>${r.openRecording}</sw-button>
        ${this.canReview ? html`<sw-button icon="check" data-review-detail-toggle @click=${() => this.fire('review-toggle')}>${d.reviewed ? r.markUnreviewed : r.markReviewed}</sw-button>` : nothing}
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
