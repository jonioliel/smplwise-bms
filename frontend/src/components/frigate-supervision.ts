import { LitElement, html, css, nothing } from 'lit';
import { customElement, property, state } from 'lit/decorators.js';
import './sw-button';
import './sw-dialog';
import './sw-dropdown';
import './sw-icon';
import type { WireCamera } from '../api/frigate';
import { CLIP_MAX_S, SUPERVISED_KINDS, clipUrl, type FirstWrites } from '../api/frigate-control';
import { fx } from '../i18n/frigate-text';
import { adminStyles, epochToLocal, localToEpoch, supervisedBox } from './frigate-admin-shared';

/**
 * FRGD: the supervision view of ONE Frigate recorder (Settings only; CR-029 section 11): which kinds already had their first supervised
 * write, and the supervised clip read - a window of at most one hour from one camera, opened as the clip Arx streams (GET only,
 * `video.playback` on the camera); the first read of a recorder carries `supervised=true` from a system administrator. Nothing here
 * writes to Frigate. FRG-polish: the clip plays in a dialog here (a plain video element over the same GET; loading / error states),
 * and can still be opened in a tab.
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
  /** the in-app viewer: the clip's address and what the video element reported so far */
  @state() private viewer: { url: string; state: 'loading' | 'ready' | 'error' } | null = null;

  static styles = [adminStyles, css`
    .clip {
      position: relative;
      inline-size: 100%;
      aspect-ratio: 16 / 9;
      border-radius: var(--sw-r-md);
      background: var(--sw-video-bg);
      overflow: hidden;
      direction: ltr;
    }
    .clip video {
      position: absolute;
      inset: 0;
      inline-size: 100%;
      block-size: 100%;
      background: var(--sw-video-bg);
    }
    .clip .state {
      position: absolute;
      inset: 0;
      display: flex;
      align-items: center;
      justify-content: center;
      gap: var(--sw-s-2);
      color: rgba(255, 255, 255, 0.82);
      font-size: var(--sw-fs-sm);
      pointer-events: none;
    }
    .clip[data-state='ready'] .state {
      display: none;
    }
    .clip[data-state='error'] video {
      visibility: hidden;
    }
    .clip .spin {
      animation: fs-spin 1.2s linear infinite;
    }
    @keyframes fs-spin {
      to { transform: rotate(360deg); }
    }
    @media (prefers-reduced-motion: reduce) {
      .clip .spin {
        animation: none;
      }
    }
  `];

  /** The clip's address for the chosen window, or null after the one-line reason was set. */
  private clipAddress(): string | null {
    const t = fx().control.settings.supervision;
    const s = localToEpoch(this.start);
    const e = localToEpoch(this.end);
    const cam = this.camera || this.cams.find((c) => c.enabled)?.id || '';
    if (!cam) {
      this.error = fx().control.settings.exports.chooseCamera;
      return null;
    }
    if (s == null || e == null || e <= s || e - s > CLIP_MAX_S || e > Date.now() / 1000 + 60) {
      this.error = t.clipRangeError;
      return null;
    }
    this.error = '';
    return clipUrl(this.recorderId, cam, s, e, this.supervised);
  }

  private openClip() {
    const url = this.clipAddress();
    if (!url) return;
    this.dispatchEvent(new CustomEvent('frigate-clip-open', { detail: { url }, bubbles: true, composed: true }));
    window.open(url, '_blank', 'noopener');
  }

  private playClip() {
    const url = this.clipAddress();
    if (!url) return;
    this.dispatchEvent(new CustomEvent('frigate-clip-open', { detail: { url }, bubbles: true, composed: true }));
    this.viewer = { url, state: 'loading' };
  }

  private viewerDialog() {
    const v = this.viewer;
    if (!v) return nothing;
    const t = fx().control.settings.supervision;
    const cam = this.cams.find((c) => c.id === (this.camera || this.cams.find((x) => x.enabled)?.id))?.name ?? '';
    return html`<sw-dialog open wide heading=${t.clipTitle} subheading=${cam} data-fs-viewer @close=${() => (this.viewer = null)}>
      <div class="clip" data-state=${v.state} data-fs-clip-state=${v.state}>
        <video controls playsinline preload="metadata" src=${v.url} data-fs-video
          @loadeddata=${() => (this.viewer = v.url === this.viewer?.url ? { url: v.url, state: 'ready' } : this.viewer)}
          @error=${() => (this.viewer = v.url === this.viewer?.url ? { url: v.url, state: 'error' } : this.viewer)}></video>
        <div class="state">${v.state === 'error'
          ? html`<sw-icon name="warning" size="18"></sw-icon>${t.clipError}`
          : html`<sw-icon class="spin" name="clock" size="18"></sw-icon>${t.clipLoading}`}</div>
      </div>
      <sw-button slot="footer" variant="ghost" icon="share" data-fs-viewer-tab @click=${() => window.open(v.url, '_blank', 'noopener')}>${t.openTab}</sw-button>
      <sw-button slot="footer" data-fs-viewer-close @click=${() => (this.viewer = null)}>${t.close}</sw-button>
    </sw-dialog>`;
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
            <div class="inline">
              <sw-button size="sm" variant="primary" icon="play" data-fs-play ?disabled=${blocked || (needSup && !this.supervised)} @click=${() => this.playClip()}>${t.play}</sw-button>
              <sw-button size="sm" variant="ghost" icon="share" data-fs-open ?disabled=${blocked || (needSup && !this.supervised)} @click=${() => this.openClip()}>${t.openTab}</sw-button>
            </div>
          </div>`
        : nothing}
      ${this.viewerDialog()}
    </div>`;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'frigate-supervision': FrigateSupervision;
  }
}
