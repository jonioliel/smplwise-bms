import { LitElement, html, nothing } from 'lit';
import { customElement, property, state } from 'lit/decorators.js';
import './sw-button';
import './sw-dropdown';
import type { WireCamera } from '../api/frigate';
import { CLIP_MAX_S, SUPERVISED_KINDS, clipUrl, type FirstWrites } from '../api/frigate-control';
import { fx } from '../i18n/frigate-text';
import { adminStyles, epochToLocal, localToEpoch, supervisedBox } from './frigate-admin-shared';

/**
 * FRGD: the supervision view of ONE Frigate recorder (Settings only; CR-029 section 11): which kinds already had their first supervised
 * write, and the supervised clip read - a window of at most one hour from one camera, opened as the clip Arx streams (GET only,
 * `video.playback` on the camera); the first read of a recorder carries `supervised=true` from a system administrator. Nothing here
 * writes to Frigate.
 */
@customElement('frigate-supervision')
export class FrigateSupervision extends LitElement {
  @property({ attribute: 'recorder-id' }) recorderId = '';
  @property({ attribute: false }) first: FirstWrites | null = null;
  @property({ attribute: false }) cams: WireCamera[] = [];
  /** the caller holds video.playback somewhere: the clip control is drawn */
  @property({ type: Boolean }) canPlayback = false;
  @state() private camera = '';
  @state() private start = epochToLocal(Math.floor(Date.now() / 1000) - 600);
  @state() private end = epochToLocal(Math.floor(Date.now() / 1000));
  @state() private supervised = false;
  @state() private error = '';

  static styles = adminStyles;

  private openClip() {
    const t = fx().control.settings.supervision;
    const s = localToEpoch(this.start);
    const e = localToEpoch(this.end);
    const cam = this.camera || this.cams.find((c) => c.enabled)?.id || '';
    if (!cam) return void (this.error = fx().control.settings.exports.chooseCamera);
    if (s == null || e == null || e <= s || e - s > CLIP_MAX_S || e > Date.now() / 1000 + 60) return void (this.error = t.clipRangeError);
    this.error = '';
    const url = clipUrl(this.recorderId, cam, s, e, this.supervised);
    this.dispatchEvent(new CustomEvent('frigate-clip-open', { detail: { url }, bubbles: true, composed: true }));
    window.open(url, '_blank', 'noopener');
  }

  render() {
    const t = fx().control.settings.supervision;
    const s = fx().control.settings;
    const first = this.first;
    const items = this.cams.filter((c) => c.enabled).map((c) => ({ id: c.id, label: c.name }));
    const camera = this.camera || items[0]?.id || '';
    const needSup = !!first && first.can_supervise && !first.done.clip_read;
    const blocked = !!first && !first.done.clip_read && !first.can_supervise;
    return html`<div class="panel" data-frigate-supervision>
      <div class="head"><h4>${t.title}</h4></div>
      <p class="note">${t.intro}</p>
      ${first
        ? html`<div class="tbl" role="table" style="--cols: minmax(160px, 1fr) 110px" data-fs-kinds>
            ${SUPERVISED_KINDS.map((k) => html`<div class="r" role="row" data-fs-kind=${k} data-done=${String(!!first.done[k])}>
              <div class="c main" role="cell">${s.kinds[k]}</div>
              <div class="c acts" role="cell"><span class=${`chip ${first.done[k] ? 'ok' : ''}`}>${first.done[k] ? t.done : t.pending}</span></div>
            </div>`)}
          </div>`
        : html`<div class="msg err" data-fs-failed>${s.unavailable}</div>`}
      ${this.canPlayback && items.length
        ? html`<h5>${t.clipTitle}</h5>
          <p class="note">${t.clipText}</p>
          <div class="form" data-fs-clip>
            <label>${s.exports.camera}<sw-dropdown block data-fs-camera .label=${s.exports.camera} .placeholder=${s.exports.camera} .value=${camera} .items=${items} @change=${(e: CustomEvent<{ id: string }>) => (this.camera = e.detail.id)}></sw-dropdown></label>
            <div class="two">
              <label>${s.exports.from}<input type="datetime-local" data-fs-start .value=${this.start} @input=${(e: Event) => (this.start = (e.target as HTMLInputElement).value)} /></label>
              <label>${s.exports.to}<input type="datetime-local" data-fs-end .value=${this.end} @input=${(e: Event) => (this.end = (e.target as HTMLInputElement).value)} /></label>
            </div>
            ${supervisedBox(first, 'clip_read', this.supervised, (v) => (this.supervised = v), 'clip_read')}
            ${this.error ? html`<div class="err" role="alert" data-fs-error>${this.error}</div>` : nothing}
            <div class="inline"><sw-button size="sm" icon="play" data-fs-open ?disabled=${blocked || (needSup && !this.supervised)} @click=${() => this.openClip()}>${t.open}</sw-button></div>
          </div>`
        : nothing}
    </div>`;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'frigate-supervision': FrigateSupervision;
  }
}
