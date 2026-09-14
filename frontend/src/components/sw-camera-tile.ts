import { LitElement, html, css } from 'lit';
import { customElement, property } from 'lit/decorators.js';
import './sw-icon';
import './sw-badge';
import type { StateKind } from './sw-badge';

/**
 * Camera tile placeholder. Deliberately shows no picture: a connected stream (T017) replaces the
 * placeholder area; until then the tile states that no stream is attached.
 */
@customElement('sw-camera-tile')
export class SwCameraTile extends LitElement {
  @property() name = '';
  @property() meta = '';
  @property({ reflect: true }) state: StateKind = 'unknown';
  @property({ type: Boolean, reflect: true }) selected = false;
  @property({ type: Boolean, reflect: true }) compact = false;
  @property({ type: Boolean, reflect: true }) dark = false;

  static styles = css`
    :host {
      display: block;
      border-radius: var(--sw-r-md);
      overflow: hidden;
      background: var(--sw-surface);
      border: 1px solid var(--sw-border);
      cursor: pointer;
      transition: box-shadow var(--sw-t-fast) var(--sw-ease), border-color var(--sw-t-fast) var(--sw-ease);
      min-inline-size: 0;
    }
    :host(:hover) {
      box-shadow: var(--sw-shadow-2);
    }
    :host([selected]) {
      border-color: var(--sw-accent);
      box-shadow: 0 0 0 2px var(--sw-accent-soft);
    }
    .frame {
      position: relative;
      aspect-ratio: 16 / 9;
      background: linear-gradient(135deg, #172033 0%, #0b1220 60%, #111a2e 100%);
      color: rgba(255, 255, 255, 0.72);
      display: grid;
      place-items: center;
      text-align: center;
      font-size: var(--sw-fs-xs);
      gap: 4px;
      padding: var(--sw-s-2);
    }
    .frame::after {
      content: '';
      position: absolute;
      inset: 0;
      background-image: linear-gradient(rgba(255, 255, 255, 0.04) 1px, transparent 1px), linear-gradient(90deg, rgba(255, 255, 255, 0.04) 1px, transparent 1px);
      background-size: 24px 24px;
      pointer-events: none;
    }
    :host([state='offline']) .frame,
    :host([state='forbidden']) .frame,
    :host([state='unknown']) .frame {
      background: var(--sw-surface-3);
      color: var(--sw-text-2);
    }
    :host([state='offline']) .frame::after,
    :host([state='forbidden']) .frame::after,
    :host([state='unknown']) .frame::after {
      display: none;
    }
    .badge {
      position: absolute;
      inset-inline-start: var(--sw-s-2);
      inset-block-start: var(--sw-s-2);
      z-index: 1;
    }
    .inner {
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 4px;
      z-index: 1;
    }
    footer {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: var(--sw-s-2);
      padding: var(--sw-s-2) var(--sw-s-3);
      font-size: var(--sw-fs-sm);
    }
    :host([dark]) {
      background: #0b1220;
      border-color: rgba(255, 255, 255, 0.08);
    }
    :host([dark]) footer {
      color: #fff;
    }
    .name {
      font-weight: var(--sw-fw-semibold);
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }
    .meta {
      color: var(--sw-text-3);
      font-size: var(--sw-fs-xs);
      white-space: nowrap;
    }
    :host([compact]) footer {
      padding: 6px 10px;
      font-size: var(--sw-fs-xs);
    }
  `;

  private message() {
    switch (this.state) {
      case 'live':
        return 'אין זרם מחובר בשלב זה';
      case 'recorded':
      case 'historic':
        return 'הקלטה תוצג כאן';
      case 'offline':
        return 'המצלמה מנותקת';
      case 'forbidden':
        return 'אין הרשאת צפייה';
      case 'stale':
        return 'מצב לא מעודכן';
      default:
        return 'מצב לא ידוע';
    }
  }

  render() {
    return html`
      <div class="frame">
        <sw-badge class="badge" kind=${this.state}></sw-badge>
        <div class="inner">
          <sw-icon name=${this.state === 'forbidden' ? 'lock' : this.state === 'offline' ? 'offline' : 'camera'} size=${this.compact ? 20 : 28}></sw-icon>
          ${this.compact ? '' : html`<span>${this.message()}</span>`}
        </div>
      </div>
      <footer>
        <span class="name">${this.name}</span>
        <span class="meta">${this.meta}</span>
      </footer>
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'sw-camera-tile': SwCameraTile;
  }
}
