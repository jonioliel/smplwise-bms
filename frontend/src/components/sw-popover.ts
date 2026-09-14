import { LitElement, html, css } from 'lit';
import { customElement, property } from 'lit/decorators.js';
import './sw-button';

/**
 * Floating card anchored near a map marker (board 1 screen 4: "Office 2F – Entrance" card with the
 * live picture and a "Watch Live" button). Positioned by the parent in stage pixels; flips to keep
 * inside the stage.
 */
@customElement('sw-popover')
export class SwPopover extends LitElement {
  @property() heading = '';
  @property({ type: Number }) x = 0;
  @property({ type: Number }) y = 0;
  @property({ type: Number }) stageWidth = 0;
  @property({ type: Number }) stageHeight = 0;

  connectedCallback() {
    super.connectedCallback();
    // Same accessible contract as sw-drawer so tests and assistive tech see one "dialog" per selection.
    this.setAttribute('role', 'dialog');
    this.setAttribute('aria-modal', 'false');
  }

  protected willUpdate() {
    if (this.heading) this.setAttribute('aria-label', this.heading);
  }

  static styles = css`
    :host {
      position: absolute;
      z-index: var(--sw-z-drawer);
      inline-size: 300px;
      max-inline-size: calc(100% - 24px);
      background: var(--sw-surface);
      border: 1px solid var(--sw-border);
      border-radius: var(--sw-r-md);
      box-shadow: var(--sw-shadow-3);
      padding: 12px;
      display: flex;
      flex-direction: column;
      gap: 10px;
      animation: pop var(--sw-t-med) var(--sw-ease);
    }
    header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 8px;
    }
    h4 {
      margin: 0;
      font-size: var(--sw-fs-md);
      font-weight: var(--sw-fw-semibold);
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }
    footer {
      display: flex;
      gap: 8px;
      flex-wrap: wrap;
    }
    footer:not(:has(*)) {
      display: none;
    }
    @keyframes pop {
      from {
        opacity: 0;
        transform: translateY(4px);
      }
    }
  `;

  private close() {
    this.dispatchEvent(new CustomEvent('close', { bubbles: true, composed: true }));
  }

  protected updated() {
    const w = 300;
    const h = this.offsetHeight || 260;
    const gap = 16;
    let left = this.x + gap;
    if (this.stageWidth && left + w > this.stageWidth - 8) left = Math.max(8, this.x - w - gap);
    let top = this.y - h / 2;
    if (this.stageHeight) top = Math.max(8, Math.min(this.stageHeight - h - 8, top));
    this.style.left = `${left}px`;
    this.style.top = `${Math.max(8, top)}px`;
  }

  render() {
    return html`
      <header><h4>${this.heading}</h4><sw-button variant="ghost" size="sm" iconOnly icon="close" label="סגור" @click=${this.close}></sw-button></header>
      <slot></slot>
      <footer><slot name="footer"></slot></footer>
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'sw-popover': SwPopover;
  }
}
