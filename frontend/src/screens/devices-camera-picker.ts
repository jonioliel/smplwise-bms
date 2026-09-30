import { LitElement, html, css, nothing } from 'lit';
import { customElement, property, state } from 'lit/decorators.js';
import '../components/sw-icon';
import '../components/sw-state-panel';
import '../components/sw-badge';
import { describeError } from '../api/client';
import { cameraSources, sameSource, type CameraSource, type CameraSources } from '../api/camera-card';
import { bidi } from '../i18n/bidi';

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
 */
@customElement('devices-camera-picker')
export class DevicesCameraPicker extends LitElement {
  /** The current choice (marked in the list). */
  @property({ attribute: false }) value: CameraSource | null = null;
  @state() private data: CameraSources | null = null;
  @state() private error = '';
  @state() private filter = '';

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
    const total = d.recorders.reduce((n, r) => n + r.cameras.length, 0) + stills.length;
    if (!total) return html`<sw-state-panel compact data-camera-picker-state="empty" state="empty" heading="אין מצלמות זמינות לך" hint="מצלמות מופיעות כאן לפי ההרשאות שלך."></sw-state-panel>`;
    const groups = d.recorders.map((r) => ({ r, cams: r.cameras.filter((c) => this.match(`${c.name} ${c.channel}`)) })).filter((g) => g.cams.length);
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
                return html`<button type="button" class="opt" role="option" data-camera-option=${`ha:${h.entity_id}`} aria-selected=${String(sameSource(this.value, source))} @click=${() => this.pick(source, h.name)}>
                  <sw-icon name="image" size=${14}></sw-icon>
                  <span class="name">${bidi(h.name)}</span>
                  <span class="meta">${h.area_name ? `${bidi(h.area_name)} · ` : ''}תמונה בלבד</span>
                </button>`;
              })}
            </div>
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
