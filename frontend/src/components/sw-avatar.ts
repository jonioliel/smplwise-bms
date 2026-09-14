import { LitElement, html, css } from 'lit';
import { customElement, property } from 'lit/decorators.js';

/** Initials avatar (board 3: users table, top bar). */
@customElement('sw-avatar')
export class SwAvatar extends LitElement {
  @property() name = '';
  @property({ type: Number }) size = 32;

  static styles = css`
    :host {
      display: inline-grid;
      place-items: center;
      inline-size: var(--sz, 32px);
      block-size: var(--sz, 32px);
      border-radius: 50%;
      background: var(--sw-accent-soft);
      color: var(--sw-accent-text);
      font-size: calc(var(--sz, 32px) * 0.38);
      font-weight: var(--sw-fw-semibold);
      flex-shrink: 0;
      user-select: none;
    }
  `;

  render() {
    this.style.setProperty('--sz', `${this.size}px`);
    const parts = this.name.trim().split(/\s+/);
    const initials = parts.length > 1 ? parts[0][0] + parts[1][0] : this.name.slice(0, 2);
    return html`${initials}`;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'sw-avatar': SwAvatar;
  }
}
