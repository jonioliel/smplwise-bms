import { LitElement, html, css, nothing } from 'lit';
import { customElement, property } from 'lit/decorators.js';
import './sw-icon';
import './sw-badge';
import './sw-scene';
import type { StateKind } from './sw-badge';
import type { SceneKind } from './sw-scene';

export type { SceneKind } from './sw-scene';

/**
 * Camera tile as drawn on the boards: only a picture with the camera name and a green dot overlaid at
 * the bottom-start corner, a small state pill at the top when the state is not plain "live". Until a
 * stream is attached (T017) the picture is an illustrated scene tagged "דמו"; it never pretends to be a
 * real frame. Offline / forbidden / unknown tiles show a grey card with an icon and the reason.
 */
@customElement('sw-camera-tile')
export class SwCameraTile extends LitElement {
  @property() name = '';
  @property() meta = '';
  @property({ reflect: true }) state: StateKind = 'unknown';
  @property({ reflect: true }) scene: SceneKind = 'lobby';
  @property({ type: Boolean, reflect: true }) selected = false;
  @property({ type: Boolean, reflect: true }) compact = false;
  @property({ type: Boolean, reflect: true }) dark = false;
  @property({ type: Boolean, reflect: true }) noDemo = false;
  @property() stamp = '';

  static styles = css`
    :host {
      display: block;
      position: relative;
      aspect-ratio: 16 / 9;
      border-radius: var(--sw-r-md);
      overflow: hidden;
      background: var(--sw-surface-3);
      cursor: pointer;
      min-inline-size: 0;
      box-shadow: var(--sw-shadow-1);
      transition: box-shadow var(--sw-t-fast) var(--sw-ease), transform var(--sw-t-fast) var(--sw-ease);
      isolation: isolate;
    }
    :host(:hover) {
      box-shadow: var(--sw-shadow-2);
    }
    :host([selected]) {
      box-shadow: 0 0 0 2px var(--sw-accent), var(--sw-shadow-2);
    }
    sw-scene {
      position: absolute;
      inset: 0;
    }
    .shade {
      position: absolute;
      inset: 0;
      background: linear-gradient(180deg, rgba(0, 0, 0, 0.12) 0%, rgba(0, 0, 0, 0) 30%, rgba(0, 0, 0, 0) 55%, rgba(0, 0, 0, 0.45) 100%);
      pointer-events: none;
    }
    .off {
      position: absolute;
      inset: 0;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      gap: 6px;
      font-size: var(--sw-fs-xs);
      color: var(--sw-text-2);
      background: var(--sw-surface-3);
      text-align: center;
      padding: 8px;
    }
    :host([dark]) .off {
      background: #172036;
      color: rgba(255, 255, 255, 0.65);
    }
    .off sw-icon {
      color: var(--sw-text-3);
    }
    .demo {
      position: absolute;
      inset-inline-end: 8px;
      inset-block-start: 8px;
      font-size: 9.5px;
      letter-spacing: 0.04em;
      background: rgba(17, 24, 39, 0.5);
      color: #fff;
      border-radius: 4px;
      padding: 1px 6px;
    }
    .pill {
      position: absolute;
      inset-inline-start: 8px;
      inset-block-start: 8px;
    }
    .label {
      position: absolute;
      inset-inline-start: 10px;
      inset-block-end: 8px;
      display: inline-flex;
      align-items: center;
      gap: 6px;
      color: #fff;
      font-size: var(--sw-fs-sm);
      font-weight: var(--sw-fw-semibold);
      text-shadow: 0 1px 2px rgba(0, 0, 0, 0.55);
      max-inline-size: calc(100% - 20px);
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }
    :host([compact]) .label {
      font-size: var(--sw-fs-xs);
      inset-inline-start: 8px;
      inset-block-end: 6px;
    }
    .label .dot {
      inline-size: 7px;
      block-size: 7px;
      border-radius: 50%;
      background: var(--sw-live);
      box-shadow: 0 0 0 1.5px rgba(255, 255, 255, 0.5);
      flex-shrink: 0;
    }
    :host([state='stale']) .label .dot {
      background: var(--sw-stale);
    }
    :host([state='recorded']) .label .dot,
    :host([state='historic']) .label .dot {
      background: var(--sw-accent);
    }
    .off .label {
      position: static;
      color: var(--sw-text);
      text-shadow: none;
      font-weight: var(--sw-fw-semibold);
    }
    :host([dark]) .off .label {
      color: #fff;
    }
    .off .label .dot {
      background: var(--sw-offline);
      box-shadow: none;
    }
    :host([state='forbidden']) .off .label .dot {
      background: var(--sw-danger);
    }
    .stamp {
      position: absolute;
      inset-inline-end: 10px;
      inset-block-end: 8px;
      font-family: var(--sw-font-mono);
      font-size: 10px;
      color: rgba(255, 255, 255, 0.9);
      text-shadow: 0 1px 2px rgba(0, 0, 0, 0.6);
      direction: ltr;
    }
    :host([compact]) .stamp {
      display: none;
    }
    .meta {
      position: absolute;
      inset-inline-end: 10px;
      inset-block-end: 8px;
      font-size: var(--sw-fs-xs);
      color: rgba(255, 255, 255, 0.85);
      text-shadow: 0 1px 2px rgba(0, 0, 0, 0.6);
    }
  `;

  private offMessage() {
    return this.state === 'forbidden' ? 'אין הרשאת צפייה' : this.state === 'offline' ? 'המצלמה מנותקת' : 'מצב לא ידוע';
  }

  render() {
    const off = this.state === 'offline' || this.state === 'forbidden' || this.state === 'unknown';
    if (off) {
      return html`<div class="off">
        <sw-icon name=${this.state === 'forbidden' ? 'lock' : 'offline'} size=${this.compact ? 18 : 24}></sw-icon>
        <span>${this.offMessage()}</span>
        ${this.name ? html`<span class="label"><span class="dot"></span>${this.name}</span>` : nothing}
      </div>`;
    }
    return html`
      <sw-scene kind=${this.scene}></sw-scene>
      <div class="shade"></div>
      ${this.noDemo ? nothing : html`<span class="demo">דמו</span>`}
      ${this.state === 'stale' || this.state === 'recorded' || this.state === 'historic' ? html`<sw-badge class="pill" onImage kind=${this.state}></sw-badge>` : nothing}
      ${this.name ? html`<span class="label"><span class="dot"></span>${this.name}</span>` : nothing}
      ${this.stamp ? html`<span class="stamp">${this.stamp}</span>` : this.meta && !this.compact ? html`<span class="meta">${this.meta}</span>` : nothing}
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'sw-camera-tile': SwCameraTile;
  }
}
