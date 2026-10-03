import { LitElement, html, css, nothing } from 'lit';
import { customElement, property, state } from 'lit/decorators.js';
import '../components/sw-icon';
import '../components/sw-state-panel';
import '../components/sw-badge';
import { describeError } from '../api/client';
import { cameraSources, disableHaLive, enableHaLive, sameSource, type CameraSource, type CameraSources, type PickerHaCamera } from '../api/camera-card';
import { bidi } from '../i18n/bidi';
import { cap } from '../api/session';

/** `camera-picked`: the user chose a camera. `detail.name` is the camera's own name (a title for the card, if it has none). */
export interface CameraPickedDetail {
  source: CameraSource;
  name: string;
}

const FILTER_FROM = 8;

/**
 * The camera picker of one camera card (owner 2026-09-30): the cameras THIS user may watch, and only those (the server
 * lists them by video.live with the camera scope, `GET /devices/camera-card/sources`) - NVR channels grouped by recorder,
 * then the system's other cameras, which show a picture only.
 *
 *   <devices-camera-picker .value=${source} @camera-picked=${(e) => use(e.detail.source, e.detail.name)}></devices-camera-picker>
 *
 * A Home Assistant camera that is one of the NVR's own channels is not listed twice: it is the channel's card.
 *
 * A camera that shows a picture only has a "הצג בזרם חי" button for someone who may configure sources (`sources.configure`;
 * off by default, per camera): the server reads the camera's stream and starts it; "בטל שידור חי" turns it back into a picture.
 */
@customElement('devices-camera-picker')
export class DevicesCameraPicker extends LitElement {
  /** The current choice (marked in the list). */
  @property({ attribute: false }) value: CameraSource | null = null;
  @state() private data: CameraSources | null = null;
  @state() private error = '';
  @state() private filter = '';
  /** The entity whose live option is being switched (its button waits), and the last refusal in a few words. */
  @state() private busy = '';
  @state() private liveError = '';

  static styles = css`
    :host {
      display: block;
      min-inline-size: 0;
    }
    .find {
      inline-size: 100%;
      box-sizing: border-box;
      font: inherit;
      font-size: var(--sw-fs-sm);
      padding: 6px 10px;
      margin-block-end: 8px;
      border: 1px solid var(--sw-border);
      border-radius: var(--sw-r-sm);
      background: var(--sw-surface);
      color: var(--sw-text);
    }
    .grp {
      margin-block-end: 10px;
    }
    .grp h4 {
      margin: 0 0 4px;
      font-size: var(--sw-fs-xs);
      font-weight: var(--sw-fw-medium);
      color: var(--sw-text-3);
    }
    [role='listbox'] {
      display: flex;
      flex-direction: column;
      gap: 4px;
      max-block-size: 320px;
      overflow: auto;
    }
    .row {
      display: flex;
      gap: 6px;
      align-items: stretch;
    }
    .row button.opt {
      flex: 1;
      min-inline-size: 0;
      inline-size: auto;
    }
    button.act {
      flex: none;
      font: inherit;
      font-size: var(--sw-fs-xs);
      padding: 0 10px;
      border: 1px solid var(--sw-border);
      border-radius: var(--sw-r-sm);
      background: var(--sw-surface);
      color: var(--sw-text-2);
      cursor: pointer;
    }
    button.act:hover:not(:disabled) {
      background: var(--sw-surface-2);
    }
    button.act:disabled {
      opacity: 0.6;
      cursor: progress;
    }
    button.act:focus-visible {
      outline: 2px solid var(--sw-accent);
      outline-offset: 1px;
    }
    .err {
      margin-block-start: 6px;
      font-size: var(--sw-fs-xs);
      color: var(--sw-danger, #b42318);
    }
    button.opt {
      display: flex;
      align-items: center;
      gap: 8px;
      inline-size: 100%;
      text-align: start;
      font: inherit;
      font-size: var(--sw-fs-sm);
      padding: 7px 10px;
      border: 1px solid var(--sw-border);
      border-radius: var(--sw-r-sm);
      background: var(--sw-surface);
      color: var(--sw-text);
      cursor: pointer;
    }
    button.opt:hover {
      background: var(--sw-surface-2);
    }
    button.opt[aria-selected='true'] {
      border-color: var(--sw-accent);
      background: var(--sw-accent-soft);
    }
    button.opt:focus-visible {
      outline: 2px solid var(--sw-accent);
      outline-offset: 1px;
    }
    .dot {
      inline-size: 8px;
      block-size: 8px;
      border-radius: 50%;
      background: var(--sw-offline);
      flex: none;
    }
    .dot.online {
      background: var(--sw-live);
    }
    .name {
      flex: 1;
      min-inline-size: 0;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }
    .meta {
      font-size: var(--sw-fs-xs);
      color: var(--sw-text-3);
      font-variant-numeric: tabular-nums;
    }
    .none {
      font-size: var(--sw-fs-xs);
      color: var(--sw-text-3);
    }
  `;

  connectedCallback() {
    super.connectedCallback();
    void this.load();
  }

  /** Reload the list (a card being edited asks again after the user's access changed). */
  async load() {
    this.error = '';
    this.data = null;
    try {
      this.data = await cameraSources();
    } catch (err) {
      this.error = describeError(err);
    }
  }

  /** Show a standalone camera as live video, or stop (the server reads its source and writes / removes its stream; `sources.configure`).
   * Reloads the list quietly; the cards of the screen resolve again on the `HA_LIVE_CHANGED` event the api module fires. */
  private async toggleLive(h: PickerHaCamera) {
    if (this.busy) return;
    this.busy = h.entity_id;
    this.liveError = '';
    try {
      if (h.live_enabled) await disableHaLive(h.entity_id);
      else await enableHaLive(h.entity_id);
      this.data = await cameraSources();
    } catch (err) {
      this.liveError = describeError(err);
    } finally {
      this.busy = '';
    }
  }

  private pick(source: CameraSource, name: string) {
    this.dispatchEvent(new CustomEvent<CameraPickedDetail>('camera-picked', { detail: { source, name }, bubbles: true, composed: true }));
  }

  private match(text: string): boolean {
    const q = this.filter.trim().toLowerCase();
    return !q || text.toLowerCase().includes(q);
  }

  render() {
    if (this.error) return html`<sw-state-panel compact data-camera-picker-state="error" state="error" heading="לא ניתן לטעון את רשימת המצלמות" hint=${this.error} actionLabel="נסה שוב" @action=${() => void this.load()}></sw-state-panel>`;
    const d = this.data;
    if (!d) return html`<sw-state-panel compact data-camera-picker-state="loading" state="loading"></sw-state-panel>`;
    const stills = d.ha_cameras.filter((h) => h.mode === 'still_only');
    const recorders = cap('nvr') ? d.recorders : []; // NN1 D5: leftover camera rows of a removed NVR are not offered
    const total = recorders.reduce((n, r) => n + r.cameras.length, 0) + stills.length;
    if (!total) return html`<sw-state-panel compact data-camera-picker-state="empty" state="empty" heading="אין מצלמות זמינות לך" hint="מצלמות מופיעות כאן לפי ההרשאות שלך."></sw-state-panel>`;
    const groups = recorders.map((r) => ({ r, cams: r.cameras.filter((c) => this.match(`${c.name} ${c.channel}`)) })).filter((g) => g.cams.length);
    const more = stills.filter((h) => this.match(`${h.name} ${h.area_name ?? ''}`));
    return html`
      ${total > FILTER_FROM ? html`<input class="find" type="search" data-camera-find placeholder="חיפוש מצלמה" aria-label="חיפוש מצלמה" .value=${this.filter} @input=${(e: Event) => (this.filter = (e.target as HTMLInputElement).value)} />` : nothing}
      ${groups.map(
        ({ r, cams }) => html`<div class="grp" data-camera-group=${r.recorder_id}>
          <h4>${bidi(r.name)}</h4>
          <div role="listbox" aria-label=${`מצלמות ${r.name}`}>
            ${cams.map((c) => {
              const source: CameraSource = { kind: 'nvr', recorder_id: c.recorder_id, channel: c.channel };
              return html`<button type="button" class="opt" role="option" data-camera-option=${`nvr:${c.recorder_id}:${c.channel}`} aria-selected=${String(sameSource(this.value, source))} @click=${() => this.pick(source, c.name)}>
                <span class="dot ${c.status === 'online' ? 'online' : ''}" aria-hidden="true"></span>
                <span class="name">${bidi(c.name)}</span>
                <span class="meta">ערוץ ${c.channel}</span>
              </button>`;
            })}
          </div>
        </div>`,
      )}
      ${more.length
        ? html`<div class="grp" data-camera-group="more">
            <h4>מצלמות נוספות</h4>
            <div role="listbox" aria-label="מצלמות נוספות">
              ${more.map((h) => {
                const source: CameraSource = { kind: 'ha', entity_id: h.entity_id };
                const canToggle = cap('ha_cameras_live') && !!d.ha_live?.ready && !!d.ha_live.can_configure;
                return html`<div class="row">
                  <button type="button" class="opt" role="option" data-camera-option=${`ha:${h.entity_id}`} aria-selected=${String(sameSource(this.value, source))} @click=${() => this.pick(source, h.name)}>
                    <sw-icon name=${h.live_enabled ? 'camera' : 'image'} size=${14}></sw-icon>
                    <span class="name">${bidi(h.name)}</span>
                    <span class="meta">${h.area_name ? `${bidi(h.area_name)} · ` : ''}${h.live_enabled ? (h.live_issue ? 'שידור חי · לא יתעדכן' : 'שידור חי') : 'תמונה בלבד'}</span>
                  </button>
                  ${canToggle && h.live_issue
                    ? html`<button type="button" class="act" data-camera-live-refresh=${h.entity_id} ?disabled=${this.busy === h.entity_id} @click=${() => void this.toggleLive({ ...h, live_enabled: false })}>רענן</button>`
                    : nothing}
                  ${canToggle
                    ? html`<button type="button" class="act" data-camera-live-toggle=${h.entity_id} ?disabled=${this.busy === h.entity_id} @click=${() => void this.toggleLive(h)}>${h.live_enabled ? 'בטל שידור חי' : 'הצג בזרם חי'}</button>`
                    : nothing}
                </div>`;
              })}
            </div>
            ${this.liveError ? html`<div class="err" role="alert" data-camera-live-error>${this.liveError}</div>` : nothing}
          </div>`
        : nothing}
      ${!groups.length && !more.length ? html`<div class="none" data-camera-no-match>אין מצלמה שמתאימה לחיפוש.</div>` : nothing}
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'devices-camera-picker': DevicesCameraPicker;
  }
}
