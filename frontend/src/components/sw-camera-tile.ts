import { LitElement, html, css } from 'lit';
import { customElement, property } from 'lit/decorators.js';
import './sw-icon';
import './sw-badge';
import type { StateKind } from './sw-badge';

export type SceneKind = 'outdoor' | 'indoor' | 'garage' | 'night' | 'none';

/**
 * Camera tile in the board-1 language: a picture area with the camera name and a green live dot
 * overlaid at the bottom, a small state pill at the top. Until a stream is attached (T017) the picture
 * is an illustrative scene gradient marked "דמו"; it never pretends to be a frame from a camera.
 */
@customElement('sw-camera-tile')
export class SwCameraTile extends LitElement {
  @property() name = '';
  @property() meta = '';
  @property({ reflect: true }) state: StateKind = 'unknown';
  @property({ reflect: true }) scene: SceneKind = 'indoor';
  @property({ type: Boolean, reflect: true }) selected = false;
  @property({ type: Boolean, reflect: true }) compact = false;
  @property({ type: Boolean, reflect: true }) dark = false;
  @property() stamp = '';

  static styles = css`
    :host {
      display: block;
      border-radius: var(--sw-r-md);
      overflow: hidden;
      background: var(--sw-surface);
      border: 1px solid var(--sw-border);
      box-shadow: var(--sw-shadow-1);
      cursor: pointer;
      transition: box-shadow var(--sw-t-fast) var(--sw-ease), border-color var(--sw-t-fast) var(--sw-ease), transform var(--sw-t-fast) var(--sw-ease);
      min-inline-size: 0;
    }
    :host(:hover) {
      box-shadow: var(--sw-shadow-2);
      transform: translateY(-1px);
    }
    :host([selected]) {
      border-color: var(--sw-accent);
      box-shadow: 0 0 0 3px var(--sw-accent-soft);
    }
    .frame {
      position: relative;
      aspect-ratio: 16 / 9;
      overflow: hidden;
      background: #0f1729;
      display: grid;
      place-items: center;
      color: rgba(255, 255, 255, 0.85);
    }
    /* Illustrative scenes: sky / wall / floor bands with a soft vignette. */
    :host([scene='outdoor']) .frame {
      background: linear-gradient(180deg, #a9c4e6 0%, #cfdff0 34%, #8fa58b 50%, #5f7358 70%, #3f4d3c 100%);
    }
    :host([scene='indoor']) .frame {
      background: linear-gradient(180deg, #f3ede3 0%, #e4d9c8 40%, #b7a58d 58%, #7d6b57 80%, #4d4235 100%);
    }
    :host([scene='garage']) .frame {
      background: linear-gradient(180deg, #d9dee6 0%, #b8c0cc 42%, #7f8896 60%, #4b535f 82%, #2f353f 100%);
    }
    :host([scene='night']) .frame {
      background: linear-gradient(180deg, #1c2a45 0%, #233a63 40%, #172440 60%, #0d1424 100%);
    }
    .frame::before {
      content: '';
      position: absolute;
      inset: 0;
      background:
        linear-gradient(115deg, rgba(255, 255, 255, 0.22) 0%, rgba(255, 255, 255, 0) 38%),
        radial-gradient(120% 90% at 50% 45%, rgba(0, 0, 0, 0) 55%, rgba(0, 0, 0, 0.35) 100%);
      pointer-events: none;
    }
    .frame::after {
      content: '';
      position: absolute;
      inset-inline: 12%;
      inset-block-end: 26%;
      block-size: 1px;
      background: rgba(255, 255, 255, 0.28);
      pointer-events: none;
    }
    :host([state='offline']) .frame,
    :host([state='forbidden']) .frame,
    :host([state='unknown']) .frame,
    :host([scene='none']) .frame {
      background: var(--sw-surface-3);
      color: var(--sw-text-2);
    }
    :host([state='offline']) .frame::before,
    :host([state='forbidden']) .frame::before,
    :host([state='unknown']) .frame::before,
    :host([state='offline']) .frame::after,
    :host([state='forbidden']) .frame::after,
    :host([state='unknown']) .frame::after {
      display: none;
    }
    .pill {
      position: absolute;
      inset-inline-end: 8px;
      inset-block-start: 8px;
      z-index: 2;
    }
    .demo {
      position: absolute;
      inset-inline-start: 8px;
      inset-block-start: 8px;
      z-index: 2;
      font-size: 10px;
      letter-spacing: 0.04em;
      background: rgba(17, 24, 39, 0.55);
      color: #fff;
      border-radius: 4px;
      padding: 1px 6px;
    }
    .label {
      position: absolute;
      inset-inline-start: 10px;
      inset-block-end: 10px;
      z-index: 2;
      display: inline-flex;
      align-items: center;
      gap: 7px;
      color: #fff;
      font-size: var(--sw-fs-sm);
      font-weight: var(--sw-fw-semibold);
      text-shadow: 0 1px 2px rgba(0, 0, 0, 0.6);
      max-inline-size: calc(100% - 20px);
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }
    .label .dot {
      inline-size: 8px;
      block-size: 8px;
      border-radius: 50%;
      background: var(--sw-live);
      box-shadow: 0 0 0 2px rgba(255, 255, 255, 0.35);
      flex-shrink: 0;
    }
    :host([state='stale']) .label .dot {
      background: var(--sw-stale);
    }
    :host([state='offline']) .label,
    :host([state='forbidden']) .label,
    :host([state='unknown']) .label {
      color: var(--sw-text);
      text-shadow: none;
    }
    :host([state='offline']) .label .dot,
    :host([state='unknown']) .label .dot {
      background: var(--sw-offline);
      box-shadow: none;
    }
    :host([state='forbidden']) .label .dot {
      background: var(--sw-danger);
      box-shadow: none;
    }
    .stamp {
      position: absolute;
      inset-inline-end: 10px;
      inset-block-end: 10px;
      z-index: 2;
      font-family: var(--sw-font-mono);
      font-size: 10.5px;
      color: rgba(255, 255, 255, 0.9);
      text-shadow: 0 1px 2px rgba(0, 0, 0, 0.6);
      direction: ltr;
    }
    .off {
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 6px;
      font-size: var(--sw-fs-xs);
      z-index: 1;
    }
    footer {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: var(--sw-s-2);
      padding: 8px 12px;
      font-size: var(--sw-fs-sm);
    }
    :host([compact]) footer {
      display: none;
    }
    :host([compact]) .label {
      font-size: var(--sw-fs-xs);
    }
    :host([dark]) {
      background: #0b1220;
      border-color: rgba(255, 255, 255, 0.08);
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
  `;

  private offMessage() {
    return this.state === 'forbidden' ? 'אין הרשאת צפייה' : this.state === 'offline' ? 'המצלמה מנותקת' : 'מצב לא ידוע';
  }

  render() {
    const off = this.state === 'offline' || this.state === 'forbidden' || this.state === 'unknown';
    return html`
      <div class="frame">
        ${off
          ? html`<div class="off"><sw-icon name=${this.state === 'forbidden' ? 'lock' : 'offline'} size=${this.compact ? 20 : 26}></sw-icon><span>${this.offMessage()}</span></div>`
          : html`<span class="demo">דמו</span>${this.stamp ? html`<span class="stamp">${this.stamp}</span>` : ''}`}
        ${this.state === 'stale' || this.state === 'recorded' || this.state === 'historic' ? html`<sw-badge class="pill" onImage kind=${this.state}></sw-badge>` : ''}
        ${this.name ? html`<span class="label"><span class="dot"></span>${this.name}</span>` : ''}
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
